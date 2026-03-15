import { PHP, __private__dont__use } from "@php-wasm/universal";
import { loadWebRuntime } from "@php-wasm/web";
import { MOODLE_ROOT } from "./config-template.js";
import { wrapPhpInstance } from "./php-compat.js";

const PERSIST_ROOT = "/persist";
const TEMP_ROOT = "/tmp/moodle";

/**
 * Create the primary PHP CGI runtime for serving Moodle requests.
 *
 * Returns a deferred object:
 * - Call refresh() to initialize the runtime (loads WASM)
 * - Then use request(), writeFile(), readFile(), etc.
 */
export function createPhpRuntime(_runtime, { appBaseUrl } = {}) {
  let wrapped = null;

  const deferred = {
    /**
     * Initialize the PHP runtime. Must be called before any other method.
     */
    async refresh() {
      const runtimeId = await loadWebRuntime("8.3", {
        withIntl: true,
      });
      const php = new PHP(runtimeId);
      const FS = php[__private__dont__use].FS;

      // Ensure directories exist
      try { FS.mkdirTree(TEMP_ROOT); } catch { /* exists */ }
      try { FS.mkdirTree(`${TEMP_ROOT}/sessions`); } catch { /* exists */ }
      try { FS.mkdirTree(MOODLE_ROOT); } catch { /* exists */ }
      try { FS.mkdirTree(PERSIST_ROOT); } catch { /* exists */ }

      const absoluteUrl = (appBaseUrl || "http://localhost:8080").replace(/\/$/u, "");
      wrapped = wrapPhpInstance(php, { syncFs: null, absoluteUrl });

      // Copy all methods from the wrapped instance onto this deferred object
      for (const key of Object.keys(wrapped)) {
        if (key !== "refresh") {
          deferred[key] = wrapped[key];
        }
      }

      Object.defineProperty(deferred, "binary", {
        get() { return wrapped.binary; },
        configurable: true,
      });
      Object.defineProperty(deferred, "_php", {
        get() { return wrapped._php; },
        configurable: true,
      });
    },

    // Placeholder methods that throw if called before refresh()
    async request() { throw new Error("PHP runtime not initialized. Call refresh() first."); },
    async analyzePath() { throw new Error("PHP runtime not initialized. Call refresh() first."); },
    async mkdir() { throw new Error("PHP runtime not initialized. Call refresh() first."); },
    async writeFile() { throw new Error("PHP runtime not initialized. Call refresh() first."); },
    async readFile() { throw new Error("PHP runtime not initialized. Call refresh() first."); },
    async run() { throw new Error("PHP runtime not initialized. Call refresh() first."); },
    addEventListener() {},
    removeEventListener() {},
  };

  return deferred;
}

/**
 * Create a lightweight PHP runtime for provisioning tasks (phpinfo capture).
 */
export function createProvisioningRuntime(_runtime) {
  let wrapped = null;

  const deferred = {
    async refresh() {
      const runtimeId = await loadWebRuntime("8.3", {
        withIntl: true,
      });
      const php = new PHP(runtimeId);
      wrapped = wrapPhpInstance(php);

      for (const key of Object.keys(wrapped)) {
        if (key !== "refresh") {
          deferred[key] = wrapped[key];
        }
      }
    },

    async run() { throw new Error("PHP runtime not initialized. Call refresh() first."); },
    addEventListener() {},
    removeEventListener() {},
  };

  return deferred;
}
