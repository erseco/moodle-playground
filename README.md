# Moodle Playground

PoC estática para arrancar Moodle 4.4 dentro del navegador con `php-wasm`, `php-cgi-wasm`, Service Workers y `@electric-sql/pglite`.

## Estructura

- `index.html`: shell de la PoC, progreso de bootstrap y preview en iframe.
- `app.js`: registro del Service Worker y orquestación del bootstrap.
- `sw.js`: servidor virtual con `PhpCgiWorker`.
- `lib/moodle-loader.js`: descarga del ZIP oficial y escritura en el VFS.
- `lib/config-template.js`: genera `config.php` y `php.ini`.
- `lib/php-runtime.js`: ejemplo explícito de `new PhpWeb({ PGlite })` para pruebas directas.

## Cómo probar

Sirve el directorio desde un origen local que soporte Service Workers, por ejemplo:

```bash
python3 -m http.server 8080
```

Abre `http://localhost:8080/`.

## Qué hace

1. Registra `sw.js` como Service Worker módulo.
2. Descarga `https://download.moodle.org/releases/security/moodle-latest-44.zip`.
3. Descomprime Moodle en memoria y lo escribe en el VFS de `php-cgi-wasm`.
4. Genera `config.php` con `dbtype=pgsql` y `dbhost=idb-storage`.
5. Deriva `/moodle/*.php` al worker CGI y sirve assets estáticos desde el mismo VFS.

## Límites actuales

- Esta PoC usa el runtime estándar de `php-wasm`. Moodle puede pedir extensiones adicionales como `intl`, `mbstring`, `xml`, `zip`, `openssl` o `sodium`.
- El estado es efímero. Una recarga completa puede requerir volver a bootstrapear si el worker se reinicia.
- El primer arranque es pesado: Moodle 4.4 ocupa decenas de megabytes comprimido y miles de archivos descomprimidos.
