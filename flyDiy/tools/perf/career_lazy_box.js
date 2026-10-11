#!/usr/bin/env node
// career_lazy_box.js - THE CAREER-LAZY BOX ROWS (G2685-G2689, written in the cloud 8 Oct, run on A0's box). The cloud's
// GATE LAZY proves WHAT is requested (headless SwiftShader cannot time a boot); this times it, on the box's GPU, in
// headed Chrome (master_bench.js's CDP rig), served by a PAGES-LIKE server (below: gzip on the wire, max-age=600, ETag
// revalidation, byte ranges - what GitHub Pages sends; tools/_serve.js sends no cache headers and no gzip).
//
// THE ROWS (`--plan` prints them with their minutes, no browser):
//   1 COLD SANDBOX   index.html, a fresh profile per rep (empty HTTP, GPU and worker caches): navigation -> garage
//                    (BOOT.whenReady), and the page's requests - no career_core among them. With --base <flyDiy dir> the
//                    SAME row on that tree's built page (train 43's build: the page before the cut), reps interleaved
//                    (this, base, this, base ...): "not slower than today" is this row's median against base's, within
//                    the strict gate's cold slack (12 % or 8 s, train_gate.js R_LOAD.cold).
//   2 COLD CAREER    index.html?career=1, a fresh profile per rep: navigation -> garage, career_core's fetch (start, end,
//                    bytes on the wire, decoded), its run (the promote's script, ms) and when app.js ran - the extra
//                    fetch's cost; against row 1's median it is the career's whole price.
//   3 WARM CAREER    the last cold career profile again (a fresh Chrome on it, as a player's next visit): career_core
//                    served by sw.js's cache (Resource Timing: workerStart > 0, nothing on the wire), navigation -> garage.
//   4 OFFLINE CAREER the same profile with the network emulated OFF (within Pages' 600 s the page and its scripts are the
//                    HTTP cache's, media/ and career_core sw.js's): the career boots (FLYDIY_CAREER up) or the row says
//                    what failed. INFO: a row the cache headers decide as much as the build.
//
// Usage: node tools/perf/career_lazy_box.js --plan [--reps 3] [--base D:/wt/t43/flyDiy]
//        node tools/perf/career_lazy_box.js [--reps 3] [--base <flyDiy dir of the comparison build>] [--port 8760]
//               [--udd D:/clb] [--out tools/perf/career_lazy_box.json] [--size 2216x1023]
//   (GPU lock first: it is timed. --base: a worktree of the train-43 build, e.g. `git worktree add D:/wt/t43 df8eb904`
//    then `node tools/build.js` in it - its index.html is the page before the cut. No --help: an unknown flag is ignored.)
// Expected (the box, RTX 3080): a cold load ~58 s to the garage (train_gate's baseline) + ~10 s of Chrome; --reps 3 with
// --base ~14 min, without ~10 min (`--plan` sums it).
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib'), os = require('os'), crypto = require('crypto');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.join(__dirname, '..', '..');
const REPS = +opt('reps', 3);
const BASE_DIR = opt('base', null) ? path.resolve(opt('base')) : null;
const EST = { chrome: 10, cold: 58, warm: 25, offline: 25, settle: 8 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function plan() {
  const rows = [];
  for (let r = 1; r <= REPS; r++) {
    rows.push(['1 cold sandbox', 'this build, rep ' + r, EST.chrome + EST.cold]);
    if (BASE_DIR) rows.push(['1 cold sandbox', 'base build, rep ' + r, EST.chrome + EST.cold]);
  }
  for (let r = 1; r <= REPS; r++) rows.push(['2 cold career', '?career=1, rep ' + r, EST.chrome + EST.cold + EST.settle]);
  for (let r = 1; r <= REPS; r++) rows.push(['3 warm career', 'the career profile again, rep ' + r, EST.chrome + EST.warm]);
  rows.push(['4 offline career', 'network off (INFO)', EST.chrome + EST.offline]);
  return rows;
}

// ---- THE PAGES-LIKE SERVER: /flyDiy/* from one flyDiy dir, as GitHub Pages serves it -------------------------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.ktx2': 'image/ktx2', '.obj': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const GZ = /^(text\/|application\/(javascript|json)|image\/svg)/;
function pagesServer(dir, port) {
  const gzCache = new Map();
  const srv = http.createServer((req, res) => {
    let url; try { url = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); res.end(); return; }
    if (!url.startsWith('/flyDiy/')) { res.writeHead(404); res.end(); return; }
    const fp = path.join(dir, url.slice('/flyDiy/'.length));
    if (!fp.startsWith(dir)) { res.writeHead(403); res.end(); return; }
    let st; try { st = fs.statSync(fp); } catch (e) { res.writeHead(404); res.end(); return; }
    if (st.isDirectory()) { res.writeHead(404); res.end(); return; }
    const type = MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream';
    const etag = '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
    const h = { 'Content-Type': type, 'Cache-Control': 'max-age=600', 'ETag': etag, 'Last-Modified': st.mtime.toUTCString(), 'Access-Control-Allow-Origin': '*',
      'X-Serve-Root': encodeURIComponent(dir), 'Accept-Ranges': 'bytes', 'Vary': 'Accept-Encoding' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); res.end(); return; }
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range && !GZ.test(type)) {
      let a = range[1] ? +range[1] : 0, b = range[2] ? +range[2] : st.size - 1;
      if (!range[1] && range[2]) { a = Math.max(0, st.size - +range[2]); b = st.size - 1; }
      b = Math.min(b, st.size - 1);
      if (a > b) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); res.end(); return; }
      res.writeHead(206, Object.assign(h, { 'Content-Range': 'bytes ' + a + '-' + b + '/' + st.size, 'Content-Length': b - a + 1 }));
      fs.createReadStream(fp, { start: a, end: b }).pipe(res); return;
    }
    if (GZ.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      const key = fp + etag;
      let body = gzCache.get(key);
      if (!body) { body = zlib.gzipSync(fs.readFileSync(fp), { level: 6 }); gzCache.set(key, body); }
      res.writeHead(200, Object.assign(h, { 'Content-Encoding': 'gzip', 'Content-Length': body.length }));
      res.end(req.method === 'HEAD' ? undefined : body); return;
    }
    res.writeHead(200, Object.assign(h, { 'Content-Length': st.size }));
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(fp).pipe(res);
  });
  return new Promise((ok, no) => { srv.on('error', no); srv.listen(port, '127.0.0.1', () => ok(srv)); });
}

// the page's side of a row: when app.js ran, career_core's fetch and its run, every request's name
const HOOKS = `(function(){ if (window.__CL) return; var C = window.__CL = { app: null, run: null };
  var v, t0 = 0; Object.defineProperty(window, 'FLYDIY_CAREER_TEXT', { configurable: true,
    get: function () { if (v) t0 = performance.now(); return v; }, set: function (x) { if (x === null && v) C.run = +(performance.now() - t0).toFixed(1); v = x; } });
  var p; Object.defineProperty(window, 'FLYDIY_PLAYER', { configurable: true, get: function () { return p; },
    set: function (x) { if (!C.app) C.app = { t: Math.round(performance.now()), career: typeof careerNew === 'function' }; p = x; } });
})();`;
const READ = `JSON.stringify((() => {
  const all = performance.getEntriesByType('resource'), e = all.find(r => /\\/career_core\\.[0-9a-f]{8}\\.js$/.test(r.name));
  return { app: window.__CL && window.__CL.app, run: window.__CL && window.__CL.run, ran: window.FLYDIY_CAREER_RAN || null, door: window.FLYDIY_CAREER !== undefined,
    requests: all.length, careerReqs: all.filter(r => /career_core\\./.test(r.name)).length,
    fetch: e ? { start: Math.round(e.startTime), end: Math.round(e.responseEnd), ms: Math.round(e.responseEnd - e.startTime), wire: e.transferSize, enc: e.encodedBodySize, dec: e.decodedBodySize,
                 worker: e.workerStart > 0, delivery: e.deliveryType || '' } : null,
    nav: (() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { wire: n.transferSize, dcl: Math.round(n.domContentLoadedEventEnd) } : null; })() };
})())`;

(async () => {
  if (flag('plan')) {
    const rows = plan(); let t = 0;
    for (const r of rows) { t += r[2]; console.log('  ' + r[0].padEnd(17) + r[1].padEnd(36) + ('~' + r[2] + ' s').padStart(8)); }
    console.log('  ' + rows.length + ' loads, ~' + Math.round(t / 60) + ' min (the box; GPU lock first)');
    return;
  }
  process.argv.push('--size', opt('size', '2216x1023'));
  const MB = require('../master_bench.js');
  const port = +opt('port', 8760), basePort = port + 1;
  const servers = [await pagesServer(ROOT, port)];
  if (BASE_DIR) servers.push(await pagesServer(BASE_DIR, basePort));
  const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '');
  const UDD = path.resolve(opt('udd', path.join(os.tmpdir(), 'clb' + stamp)));
  const R = { meta: { date: new Date().toISOString(), reps: REPS, base: BASE_DIR, root: ROOT, udd: UDD,
    career: fs.readdirSync(ROOT).filter(f => /^career_core\.[0-9a-f]{8}\.js$/.test(f))[0] || null }, rows: [] };
  const log = (...a) => console.log('[' + new Date().toISOString().slice(11, 19) + ']', ...a);
  const one = async (row, label, url, udd, opts) => {
    const b = await MB.browser(udd);
    try {
      if (opts && opts.offline) { await b.cmd('Network.enable'); await b.cmd('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); }
      const l = await b.load(url, MB.preScript('default', null) + '\n' + HOOKS);
      await sleep(EST.settle * 1000);   // the worker's install / the career loader's word land
      const r = JSON.parse(await b.ev(READ, 30000));
      if (opts && opts.cached) r.swHas = await b.ev(`caches.match(new URL(${JSON.stringify(R.meta.career)}, location.href).href).then(m => !!m)`, 20000).catch(() => null);
      const out = Object.assign({ row, label, url, sec: l.sec, state: l.state, exc: b.exc.slice(0, 3) }, r);
      log(row, label, l.sec + ' s', l.state, r.fetch ? 'career_core ' + r.fetch.ms + ' ms (' + r.fetch.wire + ' B on the wire' + (r.fetch.worker ? ', the worker' : '') + ')' : 'no career_core', r.run != null ? 'run ' + r.run + ' ms' : '');
      R.rows.push(out); return out;
    } finally { await b.close(); }
  };
  const page = (p, q) => 'http://127.0.0.1:' + p + '/flyDiy/index.html' + (q || '');
  try {
    // 1 cold sandbox (this / base interleaved)
    for (let r = 1; r <= REPS; r++) {
      await one('1 cold sandbox', 'this ' + r, page(port), UDD + '_s' + r);
      if (BASE_DIR) await one('1 cold sandbox', 'base ' + r, page(basePort), UDD + '_b' + r);
    }
    // 2 cold career
    for (let r = 1; r <= REPS; r++) await one('2 cold career', 'career ' + r, page(port, '?career=1'), UDD + '_c' + r, { cached: true });
    // 3 warm career, on the last cold career's profile
    for (let r = 1; r <= REPS; r++) await one('3 warm career', 'warm ' + r, page(port, '?career=1'), UDD + '_c' + REPS, { cached: true });
    // 4 offline career (INFO)
    await one('4 offline career', 'offline', page(port, '?career=1'), UDD + '_c' + REPS, { offline: true });
  } catch (e) { R.error = String(e && e.stack || e); log('ERROR', R.error); }
  finally { for (const s of servers) s.close(); }
  // the summary: medians, and the verdicts the handover asks for
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : null; };
  const secs = (row, re) => R.rows.filter(x => x.row === row && re.test(x.label)).map(x => x.sec);
  const S = { thisCold: med(secs('1 cold sandbox', /^this/)), baseCold: med(secs('1 cold sandbox', /^base/)), careerCold: med(secs('2 cold career', /./)),
    careerWarm: med(secs('3 warm career', /./)) };
  const cf = R.rows.filter(x => x.row === '2 cold career' && x.fetch);
  S.careerFetchMs = med(cf.map(x => x.fetch.ms)); S.careerWire = cf.length ? cf[0].fetch.wire : null; S.careerRunMs = med(cf.map(x => x.run).filter(x => x != null));
  S.sandboxCareerReqs = R.rows.filter(x => x.row === '1 cold sandbox' && /^this/.test(x.label)).reduce((a, x) => a + x.careerReqs, 0);
  const wf = R.rows.filter(x => x.row === '3 warm career' && x.fetch);
  S.warmFromWorker = wf.length > 0 && wf.every(x => x.fetch.worker && !x.fetch.wire);
  const off = R.rows.find(x => x.row === '4 offline career');
  S.offlineBooted = !!(off && off.door && off.state === 'ready');
  // "not slower than today": the strict gate's cold slack (train_gate.js R_LOAD.cold: 12 % or 8 s, the larger)
  if (S.baseCold != null) S.notSlower = S.thisCold <= S.baseCold + Math.max(8, 0.12 * S.baseCold);
  R.summary = S;
  console.log('\n  CAREER-LAZY box rows: ' + JSON.stringify(S));
  console.log('  1 cold sandbox: ' + S.thisCold + ' s' + (S.baseCold != null ? ' vs base ' + S.baseCold + ' s -> ' + (S.notSlower ? 'NOT SLOWER (within 12 % / 8 s)' : 'SLOWER') : '') + '; career_core requested ' + S.sandboxCareerReqs + ' times (0 expected)');
  console.log('  2 cold career: ' + S.careerCold + ' s (the fetch ' + S.careerFetchMs + ' ms, ' + S.careerWire + ' B on the wire; its run ' + S.careerRunMs + ' ms)');
  console.log('  3 warm career: ' + S.careerWarm + ' s, career_core ' + (S.warmFromWorker ? 'from sw.js\'s cache' : 'NOT from the worker\'s cache'));
  console.log('  4 offline career (INFO): ' + (S.offlineBooted ? 'booted the career' : 'did not boot - ' + JSON.stringify(off && { state: off.state, door: off.door, exc: off.exc })));
  const out = path.resolve(opt('out', path.join(__dirname, 'career_lazy_box_' + stamp + '.json')));
  fs.writeFileSync(out, JSON.stringify(R, null, 1));
  console.log('  -> ' + out);
})();
