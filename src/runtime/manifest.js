import { resolveBootstrapArchive } from "../../lib/moodle-loader.js";

export async function fetchManifest(manifestUrl) {
  if (!manifestUrl) {
    const base = typeof __APP_ROOT__ !== "undefined" ? __APP_ROOT__ : new URL("../../", import.meta.url).href;
    manifestUrl = new URL("assets/manifests/latest.json", base).toString();
  }
  const response = await fetch(manifestUrl, { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(`Unable to load Moodle manifest: ${response.status}`);
  }

  return response.json();
}

export function buildManifestState(manifest, runtimeId, bundleVersion) {
  return {
    runtimeId,
    bundleVersion,
    release: manifest.release,
    sha256: manifest.vfs?.data?.sha256 || manifest.bundle?.sha256 || null,
    generatedAt: manifest.generatedAt,
  };
}

export { resolveBootstrapArchive };
