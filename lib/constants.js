export const PHP_WASM_VERSION = "0.0.9-alpha-32";
export const PHP_WASM_MODULE_URL = `https://cdn.jsdelivr.net/npm/php-wasm@${PHP_WASM_VERSION}/PhpWeb.mjs`;
export const PHP_CGI_WASM_ESM_URL = `https://cdn.jsdelivr.net/npm/php-cgi-wasm@${PHP_WASM_VERSION}/+esm`;
export const PHP_CGI_MSG_BUS_URL = `https://cdn.jsdelivr.net/npm/php-cgi-wasm@${PHP_WASM_VERSION}/msg-bus/+esm`;
export const PGLITE_MODULE_URL = "https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js";
export const FFLATE_MODULE_URL = "https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js";

export const SERVICE_WORKER_URL = "./sw.js";
export const MOODLE_BASE_PATH = "/moodle";
export const DOCROOT = "/srv/www";
export const MOODLE_ROOT = `${DOCROOT}${MOODLE_BASE_PATH}`;
export const MOODLEDATA_ROOT = "/srv/moodledata";
export const TEMP_ROOT = "/tmp/moodle";

export const DEFAULT_MOODLE_ZIP_URL =
  "https://download.moodle.org/releases/security/moodle-latest-44.zip";

export const DEFAULT_BOOT_OPTIONS = {
  adminUser: "admin",
  dbName: "moodle",
  dbUser: "postgres",
  dbPassword: "postgres",
  dbHost: "idb-storage",
  moodleZipUrl: DEFAULT_MOODLE_ZIP_URL,
  prefix: "mdl_",
};

export const CGI_MIME_TYPES = {
  css: "text/css; charset=utf-8",
  gif: "image/gif",
  html: "text/html; charset=utf-8",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
  xml: "application/xml; charset=utf-8",
};

export const OPTIONAL_EXTENSION_NOTES = [
  "Moodle 4.4 exige o recomienda varias extensiones de PHP que el runtime estándar puede no tener activadas.",
  "Si el instalador se detiene por requisitos, el siguiente paso es servir las librerías compartidas de php-wasm y añadirlas a `sharedLibs`.",
];
