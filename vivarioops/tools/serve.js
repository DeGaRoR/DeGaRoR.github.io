// tools/serve.js — a static file server for the project root. `npm run serve`.
//
// WHY THIS IS NOT OPTIONAL. index.html and every module under it are ES modules,
// and a module is FETCHED. Opened as file:// the page has an opaque origin, so
// each import is a cross-origin request the browser refuses outright:
//
//   Access to script at 'file:///.../app.js' from origin 'null' has been blocked
//   by CORS policy: Cross origin requests are only supported for protocol
//   schemes: chrome, chrome-extension, ..., http, https, isolated-app.
//
// The page renders black with no further clue. There is nothing to fix in the
// application; it simply cannot be OPENED, only SERVED. This is the shortest
// path to serving it with no dependency, no install and no network.
//
// Deliberately minimal: no caching, no compression, no directory listing. It
// exists so a person can look at the tank, which is what two unsigned human
// checkpoints have been waiting on.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not `.pathname`: `.pathname` is `/D:/…` on Windows and join()
// doubles the drive into `D:\D:\…`, so every request 404s.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8080);

// .mjs and .wasm are the two that break silently when a server guesses wrong:
// a module served as application/octet-stream is refused by the module loader
// with a MIME error rather than a 404, which reads like a code fault.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';

    // Contain every request inside the project root — `..` in a URL must not
    // reach the rest of the disk, even on a development server.
    const path = join(ROOT, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!path.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

    const info = await stat(path);
    if (info.isDirectory()) { res.writeHead(404).end('not found'); return; }

    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': TYPES[extname(path)] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
}).listen(PORT, () => {
  console.log(`vivarioops  http://localhost:${PORT}/`);
  console.log('serving     ' + ROOT);
  console.log('ctrl-c to stop');
});
