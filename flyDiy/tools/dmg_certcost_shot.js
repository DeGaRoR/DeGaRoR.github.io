#!/usr/bin/env node
// dmg_certcost_shot.js - DMG-CERTCOST (G1890): WHAT THE CERTIFICATE COSTS IN A BROWSER, AND WHAT IT COSTS THE PAGE.
// The bench worker's 'cert' job (bench_worker.js benchCertRun, the Blob worker the page starts at roll-out: app.js
// certKick) in headless Chromium, per validated build: its wall time and its per-case split (C.ms.cases), with the
// page's main thread running a frame loop beside it - each requestAnimationFrame one sim.step(1/60) of the stock Cub
// (damage off: the flight's own step), the frame intervals, the step's cost and the long tasks (PerformanceObserver)
// - first with the worker idle (the reference), then while the worker computes. Optionally under CDP CPU throttling
// (Emulation.setCPUThrottlingRate: the potato's stand-in) and on two cores (run the whole tool under `taskset -c 0,1`).
// It is NOT the game's page (no WebGL, no world): the frame loop is the flight's physics alone.
//   node tools/build.js && NODE_PATH=$(npm root -g) node tools/dmg_certcost_shot.js [--builds=cub,twinFloats]
//        [--throttle=1,4,6] [--idle=4] [--load=1] [--json=<file>]
// (--load=k: k steps a frame - a page that spends real CPU on its frames; the CDP throttle stretches the page's own
// thread and leaves its cores to the worker, so it cannot show the two competing: measured, the worker's time is the
// same at x1 and x6)
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')));
}
const L = require('./_treecrash_lib.js'), C = L.core();
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const KEYS = arg('builds', Object.keys(L.BUILDS).join(',')).split(',');
const RATES = arg('throttle', '1').split(',').map(Number);
const IDLE_S = +arg('idle', '4');
const JSON_OUT = arg('json', null);
const LOAD = +arg('load', '1');   // sim.step(1/60) calls a frame on the page (a busier page: real CPU, unlike the CDP throttle)
const specOf = k => { const B = L.BUILDS[k]; let j = JSON.parse(fs.readFileSync(path.join(ROOT, B.build), 'utf8')); if (B.patch) j = B.patch(j);
  return C.genMigrateSpec ? C.genMigrateSpec(j.spec || j) : (j.spec || j); };
const PAGE = '<!doctype html><meta charset="utf-8"><title>cert cost</title><script src="tools/flight_core.js"></script>' +
             '<script src="src/viewer/bench_worker.js"></script>';
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/__certcost.html') { r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGE); return; }
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const q = (a, f) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const stats = a => ({ n: a.length, med: q(a, 0.5), p95: q(a, 0.95), max: a.length ? Math.max(...a) : null });

(async () => {
  await new Promise(res => srv.listen(0, res));
  const port = srv.address().port;
  const br = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await br.newContext();
  const pg = await ctx.newPage();
  pg.on('console', m => { if (m.type() === 'error') console.log('  page:', m.text()); });
  await pg.goto('http://localhost:' + port + '/__certcost.html');
  const cdp = await ctx.newCDPSession(pg);
  // the page's frame loop: the stock Cub's flight step, one a frame
  await pg.evaluate(([spec, LOAD]) => {
    const def = buildGen(spec);
    const sim = makeSim(Object.assign({}, def, { params: Object.assign({}, def.params, { damage: false }) }), null);
    sim.reset(0);
    const S = window.__CC = { sim, run: false, dt: [], st: [], lt: [], last: 0 };
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (S.run) S.lt.push(e.duration); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
    const tick = ts => {
      if (S.run) {
        if (S.last) S.dt.push(ts - S.last);
        S.last = ts;
        const t0 = performance.now(); for (let k = 0; k < LOAD; k++) sim.step(1 / 60); S.st.push(performance.now() - t0);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [specOf('cub'), LOAD]);
  const loopOn = () => pg.evaluate(() => { const S = window.__CC; S.dt = []; S.st = []; S.lt = []; S.last = 0; S.run = true; });
  const loopOff = () => pg.evaluate(() => { const S = window.__CC; S.run = false; return { dt: S.dt, st: S.st, lt: S.lt }; });
  const certJob = spec => pg.evaluate(spec => new Promise(res => {
    const t0 = performance.now();
    const w = window.BENCH_WORKER.start(m => { if (!m || m.kind !== 'cert' && !m.error) return; w.kill();
      res(m.error ? { error: m.error } : { ms: performance.now() - t0, inner: m.ms, nb: m.nb, ftSum: Array.from(m.Ft).reduce((a, b) => a + b, 0) }); },
      why => res({ error: 'worker: ' + why }));
    if (!w) { res({ error: 'no worker' }); return; }
    w.post({ kind: 'cert', spec, seq: 1 });
  }), spec);
  const out = { when: new Date().toISOString(), cores: require('os').cpus().length, affinity: process.env.TASKSET || null, load: LOAD, rows: [] };
  for (const rate of RATES) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    // the reference: the worker idle (after as long again of the same loop: the page's JIT warm)
    await loopOn(); await new Promise(r => setTimeout(r, IDLE_S * 1000)); await loopOff();
    await loopOn(); await new Promise(r => setTimeout(r, IDLE_S * 1000)); const idle = await loopOff();
    const ref = { dt: stats(idle.dt), st: stats(idle.st), longN: idle.lt.length, longMs: idle.lt.reduce((a, b) => a + b, 0) };
    console.log(`x${rate} idle: frame ${ref.dt.med.toFixed(1)} / p95 ${ref.dt.p95.toFixed(1)} ms, step ${ref.st.med.toFixed(2)} / p95 ${ref.st.p95.toFixed(2)} ms, long tasks ${ref.longN}`);
    for (const k of KEYS) {
      await loopOn();
      const rc = await certJob(specOf(k));
      const busy = await loopOff();
      const row = { build: k, rate, ms: rc.ms, inner: rc.inner, error: rc.error || null, ftSum: rc.ftSum, idle: ref,
                    busy: { dt: stats(busy.dt), st: stats(busy.st), longN: busy.lt.length, longMs: busy.lt.reduce((a, b) => a + b, 0) } };
      out.rows.push(row);
      if (rc.error) { console.log(`x${rate} ${k}: ${rc.error}`); continue; }
      const cs = rc.inner && rc.inner.cases ? Object.entries(rc.inner.cases).map(([a, b]) => a + ' ' + Math.round(b)).join(', ') : '';
      console.log(`x${rate} ${k}: cert ${(rc.ms / 1000).toFixed(1)} s in the worker (static ${Math.round(rc.inner.flight)} ms, bench ${Math.round(rc.inner.bench)}, dynamic ${Math.round(rc.inner.drop)}: ${cs})`);
      console.log(`      the page meanwhile: frame ${row.busy.dt.med.toFixed(1)} / p95 ${row.busy.dt.p95.toFixed(1)} / max ${row.busy.dt.max.toFixed(1)} ms, step ${row.busy.st.med.toFixed(2)} / p95 ${row.busy.st.p95.toFixed(2)} ms, long tasks ${row.busy.longN} (${row.busy.longMs.toFixed(0)} ms)`);
    }
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
  await br.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
