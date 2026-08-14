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
import { readFile, writeFile, rename, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not `.pathname`: `.pathname` is `/D:/…` on Windows and join()
// doubles the drive into `D:\D:\…`, so every request 404s.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
// PORT wins, always — a harness that assigns a free port injects it, and the
// fallback must never fight that. The fallback matches .claude/launch.json's
// declared port so both paths land in the same place; it was 8080, which is the
// most contended port on any dev machine and collided with a second server
// running this same tree.
const PORT = Number(process.env.PORT || 8092);

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

// ── /_autosave — THE STORE MIRRORS ITSELF INTO THE REPO ─────────────────────
//
// `trunk/autosave.js` POSTs the whole IndexedDB store here after every write.
// The endpoint exists ONLY on this dev server, which is what keeps the feature
// out of a deployed build: on GitHub Pages the POST fails, the page disables
// autosave for the session and nobody's creatures go anywhere.
//
// TWO GUARDS, AND THEY LIVE HERE RATHER THAN IN THE PAGE, because the failure
// this protects against is the page faithfully mirroring a disaster:
//
//   1. AN EMPTY OR RECORD-LESS PAYLOAD IS REFUSED. Wipe the store and the very
//      next autosave would otherwise overwrite the backup with nothing, which
//      turns a recoverable accident into a permanent one.
//   2. EVERY WRITE ROTATES. The previous file becomes `.prev.json` first, so the
//      last good state is always one file away even after a bad save.
//
// Neither guard can be bypassed by a page, which is the point of putting them on
// this side of the wire.
// ROOT is `vivarioops/` — `new URL('..')` from `tools/serve.js` — and it is what
// every static request resolves against, so the served path `/tools/…` and this
// disk path are the same file by construction.
const AUTOSAVE = join(ROOT, 'tools', '_zautosave.json');
const AUTOSAVE_PREV = join(ROOT, 'tools', '_zautosave.prev.json');

async function handleAutosave(req, res) {
  const chunks = [];
  let bytes = 0;
  for await (const c of req) {
    bytes += c.length;
    // A backup is a few hundred KB of genomes and thumbnails; 64 MB is far above
    // anything real and far below anything that would exhaust this process.
    if (bytes > 64 * 1024 * 1024) { res.writeHead(413).end('too large'); return; }
    chunks.push(c);
  }
  let payload;
  try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { res.writeHead(400).end('not json'); return; }

  const n = Array.isArray(payload?.records) ? payload.records.length : 0;
  if (n === 0) {
    // Reported rather than silently accepted: a page that is trying to back up
    // nothing is a page whose store has just gone, and that is worth seeing.
    console.log('  autosave REFUSED — payload holds no records (store empty or unreadable)');
    res.writeHead(409).end('refusing to overwrite a backup with an empty store');
    return;
  }
  try {
    try { await rename(AUTOSAVE, AUTOSAVE_PREV); } catch { /* first save: nothing to rotate */ }
    await writeFile(AUTOSAVE, JSON.stringify(payload));
    console.log(`  autosave ${n} records -> tools/_zautosave.json`);
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, records: n }));
  } catch (e) {
    console.log(`  autosave FAILED: ${e.message}`);
    res.writeHead(500).end('write failed');
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/_autosave' && req.method === 'POST') { await handleAutosave(req, res); return; }
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
