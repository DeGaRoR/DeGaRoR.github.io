// _serve.js — minimal static server for the repo root, replacing python's
// http.server which randomly resets large transfers (three.min.js,
// _cage_gen.js) under load. No caching: the browser's aggressive _cage*.js
// cache cost a session once (stale page code vs new node code).
// Usage: node flyDiy/tools/_serve.js [port] [root] [--fallback <dir>]
// --fallback (several with ';'): the next roots tried in order when a path is missing under the first -
// a WORKTREE served over the main checkout's gitignored data (bench/,
// assets/, node_modules/) WITHOUT a junction. Junctions in a worktree are
// followed by `git worktree remove` and the app's cleanup and have emptied
// bench/ twice (G434.1, 2026-09-20); this is the replacement.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

// bare arguments: [port] [root]; --fallback <dir> is skipped by the filter
const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--fallback');
const fbi = process.argv.indexOf('--fallback');
const PORT = Number(args[0]) || 8125;
// an optional second argument names the root (G348: a worktree served from another cwd)
const ROOT = args[1] ? path.resolve(args[1]) : process.cwd();
// several fallbacks, ';'-separated, searched in order (a peer worktree's uncommitted assets/ after the main checkout's)
const FALLBACKS = fbi > 0 ? process.argv[fbi + 1].split(';').filter(Boolean).map(p => path.resolve(p)) : [];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.obj': 'text/plain',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.bin': 'application/octet-stream',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let fp = path.join(ROOT, url);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(fp)) for (const F of FALLBACKS) {
    const fb = path.join(F, url);
    if (fb.startsWith(F) && fs.existsSync(fb)) { fp = fb; break; }
  }
  try {
    let st = fs.statSync(fp);
    if (st.isDirectory()) { fp = path.join(fp, 'index.html'); st = fs.statSync(fp); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(fp).pipe(res);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found: ' + url);
  }
}).listen(PORT, () => console.log(`_serve.js on http://localhost:${PORT}/ root=${ROOT}` + (FALLBACKS.length ? ` fallback=${FALLBACKS.join(';')}` : '')));
