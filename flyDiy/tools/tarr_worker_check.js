#!/usr/bin/env node
// tarr_worker_check.js - G845: house_tarr's canvas pass in a WORKER, proven on the real maps in a real Chrome. Every
// house map of media/tex/house (the colour sets diff / paint, the normal + rough pairs) and a few flat colours go
// through the town's own pass, T.pack (packOff: the Blob worker on ImageBitmaps / OffscreenCanvas, packStack's text),
// three ways on a page served from here (headless, --disable-gpu: the 2D canvas is the CPU's either way; no GPU lock):
//   check   ?tarrcheck=1  the worker's stacks against the page's own pass, byte for byte (stats.check)
//   worker  the default   where it ran, its wall, and the main thread's long tasks (>= 50 ms) while it ran
//   page    ?tarrw=0      the pass as before (on the main thread): its time and its long task
//
//   node tools/tarr_worker_check.js [--px 512] [--port 8571] [--chrome <exe>] [--json <out>]
// Prints TARR WORKER CHECK: PASS when the bytes are identical, the worker ran, and its run - the transfer back of the
// stacks included - made no main-thread task of 50 ms or more.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const PX = +opt('px', 512), PORT = +opt('port', 8571);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }

const DIR = path.join(ROOT, 'media', 'tex', 'house');
const files = fs.readdirSync(DIR).filter(f => /\.jpg$/.test(f)).sort();
const setOf = f => f.replace(/_(diff|paint|nor_gl|rough)_.*$/, '');
const A = files.filter(f => /_(diff|paint)_/.test(f));
const sets = [...new Set(files.filter(f => /_(nor_gl|rough)_/.test(f)).map(setOf))];
const N = sets.map(s => [files.find(f => f.indexOf(s + '_nor_gl_') === 0) || null, files.find(f => f.indexOf(s + '_rough_') === 0) || null]);

const PAGE = `<!doctype html><meta charset="utf-8"><body><script src="/vendor/three.min.js"></script><script src="/src/viewer/house_tarr.js"></script>
<script>
window.run = async (A, N, flats) => {
  const load = f => new Promise((res, rej) => { if (!f) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(f)); i.src = '/media/tex/house/' + f; });
  const IA = (await Promise.all(A.map(load))).concat(flats);
  const IN = await Promise.all(N.map(p => Promise.all(p.map(load))));
  await Promise.all(IA.concat(IN.flat()).filter(i => i && i.decode).map(i => i.decode()));
  const long = [];
  const po = new PerformanceObserver(l => { for (const e of l.getEntries()) long.push(Math.round(e.duration)); });
  po.observe({ type: 'longtask', buffered: false });
  await new Promise(r => setTimeout(r, 200)); long.length = 0;
  const T = HOUSE_TARR.make(THREE, { px: ${PX} });
  const t0 = performance.now();
  const D = await T.pack(IA, IN);
  const wall = Math.round(performance.now() - t0);
  await new Promise(r => setTimeout(r, 200)); po.disconnect();
  let h = 2166136261; const fnv = d => { for (let i = 0; i < d.length; i += 7) h = Math.imul(h ^ d[i], 16777619) >>> 0; };
  fnv(D.dA); fnv(D.dN);
  return { where: T.stats.where, packMs: T.stats.packMs, wall, check: T.stats.check || null, err: T.stats.workerErr || null, long, bytes: D.dA.length + D.dN.length, layers: [IA.length, IN.length], hash: h.toString(16) };
};
</script>`;

const TYPES = { '.js': 'text/javascript', '.jpg': 'image/jpeg', '.html': 'text/html' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/' || u === '/index.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(PAGE); }
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const exe = opt('chrome', ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p)));
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--disable-gpu'] });
  const out = {};
  try {
    for (const [name, q] of [['check', '?tarrcheck=1'], ['worker', ''], ['page', '?tarrw=0']]) {
      const page = await browser.newPage();
      const logs = []; page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') logs.push(m.text().slice(0, 200)); }); page.on('pageerror', e => logs.push('pageerror: ' + e.message));
      await page.goto(`http://127.0.0.1:${PORT}/${q}`, { waitUntil: 'load' });
      out[name] = await page.evaluate(([a, n]) => window.run(a, n, [[200, 180, 160], [90, 90, 90]]), [A, N]);
      if (logs.length) out[name].logs = logs;
      await page.close();
      const o = out[name];
      console.log(`${name.padEnd(6)} ran in ${o.where}, ${o.layers[0]} colour + ${o.layers[1]} normal layers at ${PX} px (${(o.bytes / 1048576).toFixed(1)} MiB): pass ${o.packMs} ms, wall ${o.wall} ms, main-thread long tasks [${o.long.join(', ')}] ms` +
        (o.check ? `, check: ${o.check.colour} colour + ${o.check.normal} normal bytes differ of ${o.check.bytes}` : '') + (o.err ? ', worker error: ' + o.err : '') + `, hash ${o.hash}` + (o.logs ? '\n   ' + o.logs.join('\n   ') : ''));
    }
  } finally { await browser.close(); server.close(); }
  // the worker's run, from the bitmaps to the stacks' transfer back (the layers' ArrayBuffers arriving in the page's
  // onmessage task): no main-thread task of 50 ms or more (a long task is >= 50 ms by definition: none observed)
  const quiet = out.worker.long.length === 0;
  console.log(`worker run, transfer back included: ${quiet ? 'no main-thread task >= 50 ms' : 'main-thread tasks >= 50 ms: ' + out.worker.long.join(', ')}`);
  const c = out.check, ok = c.where === 'worker' && c.check && c.check.colour === 0 && c.check.normal === 0 && out.worker.where === 'worker' && out.page.where === 'page' && out.worker.hash === out.page.hash && quiet;
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(out, null, 1));
  console.log('TARR WORKER CHECK: ' + (ok ? 'PASS' : 'FAIL'));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); server.close(); process.exit(2); });
