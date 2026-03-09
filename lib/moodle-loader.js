import { unzipSync } from "../vendor/fflate.js";

function splitPath(path) {
  return path.split("/").filter(Boolean);
}

export async function fetchWithProgress(url, onProgress = () => {}) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to download Moodle ZIP: ${response.status} ${response.statusText}`);
  }

  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body?.getReader();

  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    onProgress({ loaded: buffer.byteLength, total, ratio: total ? 1 : 0 });
    return buffer;
  }

  const chunks = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    chunks.push(value);
    loaded += value.byteLength;
    onProgress({
      loaded,
      total,
      ratio: total ? loaded / total : 0,
    });
  }

  const buffer = new Uint8Array(loaded);
  let offset = 0;

  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  onProgress({ loaded, total, ratio: total ? 1 : 1 });

  return buffer;
}

function normalizeArchiveName(name) {
  return name.replaceAll("\\", "/").replace(/^\/+/, "");
}

export function extractZipEntries(zipBytes) {
  const archive = unzipSync(zipBytes);
  const names = Object.keys(archive).map(normalizeArchiveName).filter(Boolean);

  if (names.length === 0) {
    throw new Error("The Moodle archive is empty.");
  }

  const firstSegments = new Set(names.map((name) => splitPath(name)[0]).filter(Boolean));
  const stripLeadingFolder = firstSegments.size === 1 ? [...firstSegments][0] : null;

  return names
    .map((name) => {
      const originalData = archive[name];

      if (!originalData) {
        return null;
      }

      const normalized = stripLeadingFolder && name.startsWith(`${stripLeadingFolder}/`)
        ? name.slice(stripLeadingFolder.length + 1)
        : name;

      if (!normalized || normalized.endsWith("/")) {
        return null;
      }

      return {
        path: normalized,
        data: originalData,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.path.localeCompare(right.path));
}

export async function ensureDir(php, path) {
  const parts = splitPath(path);
  let current = "";

  for (const part of parts) {
    current += `/${part}`;
    try {
      await php.mkdir(current);
    } catch (error) {
      if (!String(error?.message || error).includes("File exists")) {
        throw error;
      }
    }
  }
}

async function ensureParentDir(php, filePath) {
  const parent = filePath.split("/").slice(0, -1).join("/") || "/";
  await ensureDir(php, parent);
}

export async function writeEntriesToPhp(php, entries, targetRoot, onProgress = () => {}) {
  let written = 0;
  const total = entries.length;

  for (const entry of entries) {
    const destination = `${targetRoot}/${entry.path}`.replaceAll("//", "/");
    await ensureParentDir(php, destination);
    await php.writeFile(destination, entry.data);
    written += 1;

    onProgress({
      written,
      total,
      ratio: total ? written / total : 1,
      path: entry.path,
    });
  }
}
