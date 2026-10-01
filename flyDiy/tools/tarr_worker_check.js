#!/usr/bin/env node
// tarr_worker_check.js - G845: house_tarr's canvas pass in a WORKER, proven on the real maps in a real Chrome. Every
// house map of media/tex/house (the colour sets diff / paint, the normal + rough pairs) and a few flat colours go
// through the town's own pass, T.pack (packOff: the Blob worker - the maps' files decoded there, OffscreenCanvas,
// packDrawer + packStack's text - the maps the layer shrinks drawn on the page a task each), three ways on a page
// served from here (headless Chrome over its DevTools protocol, --disable-gpu: the 2D canvas is the CPU's either way;
// no GPU lock):
//   check   ?tarrcheck=1  the worker's stacks against the page's own pass, byte for byte (stats.check)
//   worker  the default   where it ran, its wall, the main thread's long tasks (>= 50 ms) while it ran, the page-side draws
//   page    ?tarrw=0      the pass as before (on the main thread): its time and its long task
//
//   node tools/tarr_worker_check.js [--px 512] [--port 8571] [--chrome <exe>] [--json <out>]
// Prints TARR WORKER CHECK: PASS when the bytes are identical, the worker ran, its run - the transfer back of the
// stacks included - made no main-thread task of 50 ms or more, and no page-side draw took 50 ms.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const PX = +opt('px', 512), PORT = +opt('port', 8571);
const os = require('os');
const { spawn, execSync } = require('child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = u => new Promise((res, rej) => http.get(u, r => { let s = ''; r.on('data', d => s += d); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on('error', rej));

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
  const po = new PerformanceObserver(l => { for (const e of l.getEntries()) long.push(Math.round(e.duration) + '@' + Math.round(e.startTime)); });
  po.observe({ type: 'longtask', buffered: false });
  await new Promise(r => setTimeout(r, 200)); long.length = 0;
  const T = HOUSE_TARR.make(THREE, { px: ${PX} });
  const t0 = performance.now();
  const D = await T.pack(IA, IN);
  const wall = Math.round(performance.now() - t0);
  await new Promise(r => setTimeout(r, 200)); po.disconnect();
  let h = 2166136261; const fnv = d => { for (let i = 0; i < d.length; i += 7) h = Math.imul(h ^ d[i], 16777619) >>> 0; };
  fnv(D.dA); fnv(D.dN);
  return { where: T.stats.where, packMs: T.stats.packMs, marks: T.stats.marks || null, wall, check: T.stats.check || null, err: T.stats.workerErr || null, long, bytes: D.dA.length + D.dN.length, layers: [IA.length, IN.length], hash: h.toString(16) };
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
  // Chrome over its DevTools protocol (rollout_perf's way: no Playwright on the box), headless, its own profile
  const DPORT = 9800 + (process.pid % 150), UDD = path.join(os.tmpdir(), 'tarr_worker_check_' + DPORT);
  const ch = spawn(exe, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + DPORT, '--user-data-dir=' + UDD, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { if (process.platform === 'win32') execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} };
  process.on('exit', kill);
  let tgt = null;
  for (let i = 0; i < 50 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0, logs = [], loaded = null; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Page.loadEventFired' && loaded) { loaded(); loaded = null; }
    if (m.method === 'Runtime.exceptionThrown') logs.push('pageerror: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text || '').split('\n')[0]);
    if (m.method === 'Runtime.consoleAPICalled' && /warning|error/.test(m.params.type)) logs.push(m.params.type + ': ' + m.params.args.map(a => a.value).join(' ').slice(0, 200)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await cmd('Page.enable'); await cmd('Runtime.enable');
  const out = {};
  try {
    for (const [name, q] of [['check', '?tarrcheck=1'], ['worker', ''], ['page', '?tarrw=0']]) {
      logs = [];
      const ld = new Promise(r => loaded = r);
      await cmd('Page.navigate', { url: `http://127.0.0.1:${PORT}/${q}` }); await ld;
      const r = await cmd('Runtime.evaluate', { expression: `window.run(${JSON.stringify(A)}, ${JSON.stringify(N)}, [[200, 180, 160], [90, 90, 90]])`, awaitPromise: true, returnByValue: true });
      if (!r.result || r.result.exceptionDetails) throw new Error(name + ': ' + JSON.stringify(r.result && r.result.exceptionDetails || r).slice(0, 400));
      out[name] = r.result.result.value;
      if (logs.length) out[name].logs = logs;
      const o = out[name];
      console.log(`${name.padEnd(6)} ran in ${o.where}, ${o.layers[0]} colour + ${o.layers[1]} normal layers at ${PX} px (${(o.bytes / 1048576).toFixed(1)} MiB): pass ${o.packMs} ms, wall ${o.wall} ms, main-thread long tasks [${o.long.join(', ')}] ms` +
        (o.check ? `, check: ${o.check.colour} colour + ${o.check.normal} normal bytes differ of ${o.check.bytes}` : '') + (o.err ? ', worker error: ' + o.err : '') + `, hash ${o.hash}` + (o.marks ? `, marks ${JSON.stringify(o.marks)}` : "") + (o.check && o.check.layers ? `
   differing layers [index, bytes, max diff, source]: ${o.check.layers.slice(0, 16).map(l => JSON.stringify(l)).join(" ")}` : "") + (o.logs ? '\n   ' + o.logs.join('\n   ') : ''));
    }
  } finally { try { ws.close(); } catch (e) {} kill(); server.close(); }
  // the worker's run, from the bitmaps to the stacks' transfer back (the layers' ArrayBuffers arriving in the page's
  // onmessage task): no main-thread task of 50 ms or more (a long task is >= 50 ms by definition: none observed)
  const quiet = out.worker.long.length === 0;
  console.log(`worker run, transfer back included: ${quiet ? 'no main-thread task >= 50 ms' : 'main-thread tasks >= 50 ms: ' + out.worker.long.join(', ')}`);
  // the maps the layer shrinks are drawn on the page, a task each: their count, total and worst (each under 50 ms)
  const M = out.worker.marks || {}, small = !(M.hereMax >= 50);
  console.log(`page-side draws (the maps the layer shrinks, a task each): ${M.here || 0}, ${M.hereMs || 0} ms in all, the worst ${M.hereMax || 0} ms`);
  const c = out.check, ok = c.where === 'worker' && c.check && c.check.colour === 0 && c.check.normal === 0 && out.worker.where === 'worker' && out.page.where === 'page' && out.worker.hash === out.page.hash && quiet && small;
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(out, null, 1));
  console.log('TARR WORKER CHECK: ' + (ok ? 'PASS' : 'FAIL'));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); server.close(); process.exit(2); });
