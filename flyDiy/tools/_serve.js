// _serve.js — minimal static server for the repo root, replacing python's
// http.server which randomly resets large transfers (three.min.js,
// _cage_gen.js) under load. No caching: the browser's aggressive _cage*.js
// cache cost a session once (stale page code vs new node code).
// Usage: node flyDiy/tools/_serve.js [port]   (cwd = repo root)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2]) || 8125;
const ROOT = process.cwd();
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.obj': 'text/plain',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let fp = path.join(ROOT, url);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
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
}).listen(PORT, () => console.log(`_serve.js on http://localhost:${PORT}/ root=${ROOT}`));
