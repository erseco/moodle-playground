<!--
MAINTENANCE: Update this file when:
- Adding/removing npm scripts in package.json or targets in Makefile
- Changing the runtime flow (shell, remote host, service worker, php worker)
- Modifying the Moodle bundle format, manifest schema, or storage model
- Changing deployment assumptions for GitHub Pages or other static hosting
- Adding new conventions for blueprints, extensions, or persistent state
-->

# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

Moodle Playground runs a Moodle site entirely in the browser using WebAssembly.
It follows the same product shape as `omeka-s-playground`:

1. Shell UI: `index.html` and `src/shell/main.js`
2. Runtime host: `remote.html` and `src/remote/main.js`
3. Request routing: `sw.js` and `php-worker.js`
4. PHP/Moodle runtime: `src/runtime/*` + generated assets under `assets/moodle/`

The readonly Moodle core is loaded from a prebuilt VFS bundle while mutable state is kept in browser persistence.

## Build System

This project uses npm and a small Makefile workflow.

### Requirements

- Node.js 18+
- npm
- Python 3
- Git

### Common Commands

```bash
npm install
npm run sync-browser-deps
npm run prepare-runtime
npm run bundle

make prepare
make bundle
make serve
make up
```

### Generated Assets

- `assets/moodle/`: readonly runtime bundle files (`.vfs.bin`, index, optional zip)
- `assets/manifests/`: generated bundle manifests

Do not hand-edit generated bundle artifacts unless the task is specifically about the build output.

## Architecture

### Runtime Flow

```text
index.html
  -> src/shell/main.js
     -> remote.html
        -> src/remote/main.js
           -> sw.js
              -> php-worker.js
                 -> src/runtime/bootstrap.js
                 -> src/runtime/php-loader.js
                 -> php-cgi-wasm
```

Responsibilities:

- `index.html` / `src/shell/main.js`
  - Toolbar, URL bar, iframe host, blueprint import, runtime logs
- `remote.html` / `src/remote/main.js`
  - Registers the service worker and hosts the scoped playground iframe
- `sw.js`
  - Intercepts same-origin requests
  - Maps static vs scoped/runtime requests
  - Rewrites redirects and HTML links for GitHub Pages subpaths
- `php-worker.js`
  - Owns the `php-cgi-wasm` instance for a scope
  - Boots Moodle and serves HTTP requests through the bridge
- `src/runtime/bootstrap.js`
  - Prepares storage
  - Mounts the readonly Moodle bundle
  - Writes `config.php` and `php.ini`

## Storage Model

Current model:

- Readonly core: mounted in memory under `/www/moodle`
- Mutable state: persisted under `/persist`
- `moodledata`: `/persist/moodledata`
- Config and manifest markers: `/persist/config`

Avoid reintroducing boot-time file-by-file copies of the full Moodle core into persistent storage.

## SQLite Prototype Invariants

This repo is no longer using the old active PGlite database path for the main runtime.

Current database assumptions:

- Moodle runs against the deprecated SQLite PDO driver
- The SQLite database file is file-backed, not in-memory
- The DB file lives under `/persist/moodledata`
- The readonly Moodle core still lives under `/www/moodle`
- `config.php` is generated at boot and must continue to point at the persistent SQLite file

When touching the migration/runtime path, preserve these invariants:

1. Do not reintroduce PGlite as the active DB path
2. Do not move the DB out of the writable wasm filesystem
3. Do not turn the readonly core mount back into a full persistent copy of Moodle
4. Keep `$CFG->wwwroot` based on the real app base URL, not the scoped runtime path
5. Keep the default scope stable unless there is a deliberate migration plan for persisted state

Important files for this prototype:

- `src/runtime/config-template.js`
- `lib/config-template.js`
- `src/runtime/bootstrap.js`
- `src/runtime/php-loader.js`
- `sw.js`
- `src/remote/main.js`
- `vendor/php-cgi-wasm/PhpCgiBase.js`
- `lib/moodle-loader.js`
- `scripts/patch-moodle-source.sh`
- `patches/moodle/lib/dml/sqlite3_pdo_moodle_database.php`
- `patches/moodle/lib/ddl/sqlite_sql_generator.php`
- `patches/moodle/lib/xmlize.php`
- `patches/moodle/lib/xmldb/xmldb_file.php`
- `patches/moodle/lib/classes/encryption.php`

Prototype-specific defaults currently matter during first boot:

- `rememberusername` is intentionally disabled by default
- several Moodle config values are seeded manually during bootstrap
- `sodium` is not available in the current wasm runtime, so login/session-related encryption uses a local OpenSSL fallback patch

If you change any of the above behavior, update:

- `docs/sqlite-wasm-migration-notes.md`
- `docs/TROUBLESHOOTING.md`
- `docs/KNOWN-ISSUES.md`

## GitHub Pages and Base Path Handling

This project is expected to run under a subpath such as `/moodle-playground`.

When modifying `sw.js`, preserve all three behaviors:

1. App base path handling for static hosting in a subdirectory
2. Scoped runtime routing under `/playground/<scope>/<runtime>/...`
3. HTML response rewriting for Moodle-generated links and forms

Moodle, like Omeka, may emit HTML-escaped URLs. If navigation works on first load but breaks after clicking inside the site, inspect the HTML response body first.

## Extensions

The runtime currently resolves these browser-side PHP shared libraries:

- `dom`
- `iconv`
- `intl`
- `libxml`
- `simplexml`
- `zlib`
- `zip`
- `mbstring`
- `openssl`
- `phar`

If Moodle fails due to missing requirements, check:

- `playground.config.json`
- `src/runtime/runtime-registry.js`
- `scripts/sync-browser-deps.mjs`

Do not add a library name to runtime config unless the browser asset is actually available in `vendor/` or the sync/build pipeline has been updated accordingly.

The SQLite prototype currently does not ship all Moodle-required extensions. In practice:

- `sqlite`, `pdo_sqlite`, `xml`, `dom`, `simplexml`, `openssl`, `mbstring`, `intl`, `iconv`, `zip` are part of the working runtime path
- `curl`, `gd`, `fileinfo`, and `sodium` are still not present as wasm shared libraries in this repo

Do not claim an extension is "enabled" just because Moodle recommends it. Verify:

- `playground.config.json`
- `src/runtime/runtime-registry.js`
- `vendor/`

before changing bootstrap assumptions.

## Fragile Areas

These areas have repeatedly caused regressions during the SQLite migration:

- `sw.js`
  - query strings must survive scoped redirects
  - HTML rewriting must keep Moodle links/forms inside the scoped runtime
- `vendor/php-cgi-wasm/PhpCgiBase.js`
  - CGI environment variables such as `HTTP_USER_AGENT`, `SCRIPT_NAME`, and `SCRIPT_FILENAME` are critical
- `src/remote/main.js`
  - the nested iframe can stall with a valid URL/title but an empty body
- `lib/moodle-loader.js`
  - large readonly VFS downloads can trigger memory pressure if buffering is careless
- `src/runtime/bootstrap.js`
  - many install-time compatibility shims live here and are easy to break accidentally

If a change touches any of these files, prefer validating in a real browser, not only with syntax checks.

## Blueprints

Blueprints are JSON files that describe the desired state of a playground instance.

Relevant files:

- `assets/blueprints/default.blueprint.json`
- `assets/blueprints/blueprint-schema.json`
- `src/shared/blueprint.js`

The current blueprint model is intentionally narrow and centered on:

- site title / locale / timezone
- admin login
- extra users
- categories
- starter courses

When changing blueprint semantics, update both the schema and the runtime code that consumes it.

## Testing and Verification

There is no large formal test suite in this repository today. Verification is mostly targeted.

### Typical checks

```bash
node --check sw.js
node --check php-worker.js
node --check src/runtime/bootstrap.js
node --check src/runtime/php-loader.js
node --check src/shell/main.js
node --check src/remote/main.js
```

### Manual validation areas

- First boot install path
- Reload with persisted state
- Navigation inside Moodle
- GitHub Pages subpath behavior
- Service worker updates after redeploy

If a change touches routing or HTML rewriting, prefer checking real browser behavior, not only syntax.
