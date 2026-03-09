import { PhpCgiWorker } from "https://cdn.jsdelivr.net/npm/php-cgi-wasm@0.0.9-alpha-32/+esm";
import { PGlite } from "https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js";
import {
  CGI_MIME_TYPES,
  DEFAULT_BOOT_OPTIONS,
  DOCROOT,
  MOODLE_BASE_PATH,
  MOODLEDATA_ROOT,
  MOODLE_ROOT,
  OPTIONAL_EXTENSION_NOTES,
  TEMP_ROOT,
} from "./lib/constants.js";
import {
  createBootstrapNotice,
  createMoodleConfigPhp,
  createPhpIni,
} from "./lib/config-template.js";
import {
  ensureDir,
  extractZipEntries,
  fetchWithProgress,
  writeEntriesToPhp,
} from "./lib/moodle-loader.js";

const bootState = {
  active: false,
  ready: false,
  lastError: null,
  entryUrl: `${MOODLE_BASE_PATH}/install.php`,
};

const textEncoder = new TextEncoder();

function nowIso() {
  return new Date().toISOString();
}

async function broadcast(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  await Promise.all(clients.map((client) => client.postMessage(message)));
}

function publishProgress(phase, detail, progress = null) {
  return broadcast({
    kind: "bootstrap-progress",
    phase,
    detail,
    progress,
    timestamp: nowIso(),
  });
}

function buildLoadingResponse(message, status = 503) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Moodle Playground</title><body><pre>${message}</pre></body>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

const php = new PhpCgiWorker({
  PGlite,
  prefix: MOODLE_BASE_PATH,
  docroot: DOCROOT,
  types: CGI_MIME_TYPES,
  rewrite: (pathname) => {
    if (pathname === MOODLE_BASE_PATH || pathname === `${MOODLE_BASE_PATH}/`) {
      return `${MOODLE_BASE_PATH}/install.php`;
    }

    return pathname;
  },
  notFound: (request) => {
    const url = new URL(request.url);

    if (url.pathname.startsWith(MOODLE_BASE_PATH) && !bootState.ready) {
      return buildLoadingResponse("Moodle Playground is still bootstrapping. Return to /index.html.");
    }

    return buildLoadingResponse(`No file found for ${url.pathname}`, 404);
  },
  onRequest: async () => {
    if (!bootState.ready) {
      await publishProgress("request", "Request received before bootstrap completed.");
    }
  },
  actions: {
    async bootstrapMoodle(phpInstance, rawOptions = {}) {
      if (bootState.active) {
        return {
          ok: false,
          ready: bootState.ready,
          message: "Bootstrap already running.",
          entryUrl: bootState.entryUrl,
        };
      }

      const options = { ...DEFAULT_BOOT_OPTIONS, ...rawOptions };
      const origin = options.origin || self.location.origin;
      const timezone = options.timezone || "UTC";

      bootState.active = true;
      bootState.ready = false;
      bootState.lastError = null;

      try {
        await publishProgress("runtime", "Refreshing php-cgi-wasm runtime.", 0.02);
        await phpInstance.refresh();

        await publishProgress("filesystem", "Creating Moodle directories.", 0.06);
        await ensureDir(phpInstance, DOCROOT);
        await ensureDir(phpInstance, MOODLE_ROOT);
        await ensureDir(phpInstance, MOODLEDATA_ROOT);
        await ensureDir(phpInstance, `${MOODLEDATA_ROOT}/cache`);
        await ensureDir(phpInstance, `${MOODLEDATA_ROOT}/localcache`);
        await ensureDir(phpInstance, `${MOODLEDATA_ROOT}/sessions`);
        await ensureDir(phpInstance, TEMP_ROOT);
        await ensureDir(phpInstance, `${TEMP_ROOT}/sessions`);

        await publishProgress("download", `Downloading Moodle from ${options.moodleZipUrl}`, 0.1);
        const zipBytes = await fetchWithProgress(options.moodleZipUrl, ({ ratio }) =>
          publishProgress("download", "Downloading Moodle ZIP.", 0.1 + ratio * 0.35),
        );

        await publishProgress("archive", "Expanding Moodle ZIP into memory.", 0.48);
        const entries = extractZipEntries(zipBytes);

        await publishProgress("filesystem", `Writing ${entries.length} files to the PHP VFS.`, 0.52);
        await writeEntriesToPhp(phpInstance, entries, MOODLE_ROOT, ({ ratio, path }) =>
          publishProgress("filesystem", `Writing ${path}`, 0.52 + ratio * 0.36),
        );

        const configPhp = createMoodleConfigPhp({
          origin,
          adminUser: options.adminUser,
          dbHost: options.dbHost,
          dbName: options.dbName,
          dbPassword: options.dbPassword,
          dbUser: options.dbUser,
          prefix: options.prefix,
        });

        const phpIni = createPhpIni({ timezone });

        await publishProgress("config", "Generating config.php and php.ini.", 0.92);
        await phpInstance.writeFile(`${MOODLE_ROOT}/config.php`, textEncoder.encode(configPhp));
        await phpInstance.writeFile(`${DOCROOT}/php.ini`, textEncoder.encode(phpIni));
        await phpInstance.writeFile(
          `${DOCROOT}/playground-bootstrap.php`,
          textEncoder.encode(createBootstrapNotice()),
        );

        bootState.active = false;
        bootState.ready = true;
        bootState.entryUrl = `${MOODLE_BASE_PATH}/install.php?lang=en`;

        await publishProgress("ready", "Moodle Playground is ready.", 1);
        await broadcast({
          kind: "bootstrap-ready",
          entryUrl: bootState.entryUrl,
          notes: OPTIONAL_EXTENSION_NOTES,
          timestamp: nowIso(),
        });

        return {
          ok: true,
          entryUrl: bootState.entryUrl,
          notes: OPTIONAL_EXTENSION_NOTES,
          fileCount: entries.length,
        };
      } catch (error) {
        bootState.active = false;
        bootState.ready = false;
        bootState.lastError = String(error?.stack || error?.message || error);

        await broadcast({
          kind: "bootstrap-error",
          error: bootState.lastError,
          timestamp: nowIso(),
        });

        throw error;
      }
    },

    getBootState() {
      return { ...bootState };
    },
  },
});

self.addEventListener("install", (event) => {
  self.skipWaiting();
  php.handleInstallEvent(event);
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  php.handleActivateEvent(event);
});

self.addEventListener("message", (event) => php.handleMessageEvent(event));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (!url.pathname.startsWith(MOODLE_BASE_PATH)) {
    return;
  }

  if (!bootState.ready && !bootState.active) {
    event.respondWith(
      buildLoadingResponse("Bootstrap Moodle from /index.html before opening Moodle routes."),
    );
    return;
  }

  if (bootState.active && !bootState.ready) {
    event.respondWith(buildLoadingResponse("Moodle Playground is bootstrapping. Please wait."));
    return;
  }

  php.handleFetchEvent(event);
});
