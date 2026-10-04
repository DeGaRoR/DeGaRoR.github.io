#!/usr/bin/env node
// mobile_garage_node.js - MOBILE-GARAGE (G1511): THE GARAGE WITHOUT THE WORLD, MEASURED IN NODE - a STUDY rig, nothing shipped.
// The page in node (tools/_page_node.js) boots dev.html on a build twice:
//   --mode full    the game's own boot (the 24 steps: the garage, then the world, the town, the parked cook, the ring, the
//                  settle, the flown bake, the world's compile and first light, the craft's programs)
//   --mode garage  a PROTOTYPE of a garage-only entry: the SAME app.js with the world's boot steps taken out by a source
//                  transform applied in THIS rig only (vm.runInContext is wrapped for src/viewer/app.js) and ?world=none
//                  (the island is never fetched). What stays: treeBins off, aircraft, garage, editor, seed, snapshot, spec,
//                  restore, compile, firstFrame, recheck (re-planning nothing). Every replacement must match once or the rig stops (a moved
//                  line in app.js is a stale prototype, not a silent full boot).
// Per boot step (BOOT.current's label): REAL ms (process.hrtime, node is ~1.6x the box's JS), the on-disk bytes the page
// read (fetch + XHR + images = the wire before HTTP compression), and the process's memory at the step's end (V8 heap
// used + ArrayBuffers: the page's JS-side retention - the recording GL keeps no GPU copies, so GPU memory is NOT here).
// Then, unless --nodrag: each row of --only is dragged the player's way (garage_release.js's procedure: pointerdown,
// --ticks input ticks 30 ms apart, change + pointerup) and the median tick / release / idle are taken.
// Usage: node --expose-gc --max-old-space-size=6144 tools/perf/mobile_garage_node.js --mode full|garage --build cub|metal
//          [--reps 2] [--ticks 4] [--only wgSpan,stSpan,paxLen,halfW,seatH] [--nodrag] [--out file.json]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json', floats: 'bugReports/cessnaFloatsWOrks.json' };
const MODE = opt('mode', 'full'), BK = opt('build', 'cub'), REPS = +opt('reps', 2), TICKS = +opt('ticks', 4);
const ROWS = opt('only', 'wgSpan,wgChord,stSpan,s1X,paxLen,halfW,seatH').split(',');
const OUT = path.resolve(opt('out', path.join(ROOT, 'reports/evidence/MOBILE-GARAGE', 'node_' + MODE + '_' + BK + '.json')));
const now = () => Number(process.hrtime.bigint()) / 1e6;
const MiB = x => +(x / 1048576).toFixed(1);
const med = a => { const s = a.filter(x => x != null).slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const log = s => console.log('  ' + s);
const mem = () => { const m = process.memoryUsage(); return { heap: MiB(m.heapUsed), ab: MiB(m.arrayBuffers), ext: MiB(m.external), rss: MiB(m.rss) }; };
const gc = () => { if (global.gc) { global.gc(); global.gc(); } };

// THE PROTOTYPE: the world's boot steps out of app.js (each must match exactly once)
const GARAGE_ONLY = [
  ["if (typeof treeWarm === 'function') treeWarm().catch(() => {});", ''],
  ["for (const id of ['world', 'town', 'parking', 'trees', 'ring', 'settle']) bootTripStep(id);", ''],
  ['if (window.PARKED && window.PARKED.captureAll) window.PARKED.captureAll();', ''],
  ['setTimeout(worldPrelinkSettled, 0); ', ''],
  ["bootTripStep('bake');", ''],
  ["for (const id of ['images', 'upload', 'worldCompile']) bootTripStep(id);", ''],
  ["bootTripStep('frames');", ''],
  ["bootTripStep('craft');", ''],
  ['if (SIMW) SIMW.prewarm(); }', '}'],
  // the boot's last step re-plans the aircraft's keyed steps and runs what moved - with bake and craft taken out above,
  // it ran the FLOWN BAKE there (seen on SwiftShader: recheck 140 -> 340 s); a garage-only boot re-plans nothing
  ["const plan = tripPlan('craft'); if (!plan.length) return;", 'return;'],
];
if (MODE === 'garage') {
  const run0 = vm.runInContext;
  vm.runInContext = function (code, ctx, o) {
    if (o && o.filename === 'src/viewer/app.js') {
      for (const [a, b] of GARAGE_ONLY) { const n = code.split(a).length - 1;
        if (n !== 1) { console.error('mobile_garage_node: the prototype is stale - "' + a + '" matched ' + n + ' times'); process.exit(3); }
        code = code.replace(a, b); }
    }
    return run0.call(this, code, ctx, o);
  };
}

(async () => {
  const { openPage } = require('../_page_node.js');
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[BK] || BK), 'utf8') };
  let dropJobs = false, wrapped = false;
  const hooks = { afterScript(name, P) {
    if (!wrapped && P.win.Worker) { wrapped = true; const Wk = P.win.Worker;
      P.win.Worker = function (u, o) { const w = new Wk(u, o); const pm = w.postMessage.bind(w); w.postMessage = (m, tr) => { if (dropJobs) return; return pm(m, tr); }; return w; }; } } };
  gc(); const m0 = mem(); const t0 = now();
  const P = await openPage({ quiet: true, storage, hooks, query: MODE === 'garage' ? 'world=none' : '', workers: /readoutCompute|balanceCompute/ });
  const W = P.win, D = W.document;
  const R = { date: new Date().toISOString(), mode: MODE, build: BK, before: m0, steps: [], rows: [] };
  // the boot, step by step: sampled at every harness turn the predicate is asked (throttled to 50 ms of real time)
  let last = null, lastT = 0;
  const io = () => P.io.fetchBytes + P.io.imgBytes;
  const sample = () => {
    const t = now(); if (t - lastT < 50 && W.BOOT && W.BOOT.state !== 'gone') return; lastT = t;
    const lab = W.BOOT && W.BOOT.current ? (W.BOOT.current.id || W.BOOT.current.label) : (W.BOOT ? 'BOOT ' + W.BOOT.state : 'page');
    if (!last || last.step !== lab) { if (last) { last.ms = +(t - last.t0).toFixed(0); last.bytes = io() - last.b0; Object.assign(last, mem()); }
      last = { step: lab, t0: t, b0: io() }; R.steps.push(last); }
  };
  await P.until(() => { sample(); return W.BOOT && W.BOOT.state === 'gone'; }, 900000);
  sample(); if (last) { last.ms = +(now() - last.t0).toFixed(0); last.bytes = io() - last.b0; Object.assign(last, mem()); }
  R.bootMs = +(now() - t0).toFixed(0);
  await P.until(() => !!W.CAGE_UI, 60000);
  await P.until(() => false, 8000);
  gc(); R.afterGC = mem(); R.io = Object.assign({}, P.io); R.fetchedN = P.fetched.length;
  // what was read, by kind (the on-disk size of each URL the page fetched / loaded as an image)
  const kind = u => /media\/tex\//.test(u) ? 'tex' : /media\/geo\//.test(u) ? 'geo' : /media\/world\/|world_packs|island/.test(u) ? 'world' : /media\/parked/.test(u) ? 'parked'
    : /media\/audio/.test(u) ? 'audio' : /\.js(\?|$)/.test(u) ? 'script' : /\.json(\?|$)/.test(u) ? 'json' : 'other';
  R.byKind = {}; const seen = new Set();
  for (const u of P.fetched) { const f = path.join(ROOT, String(u).replace(/^\.?\//, '').split('?')[0]); if (seen.has(f)) continue; seen.add(f);
    let n = 0; try { n = fs.statSync(f).size; } catch (e) {} const k = kind(String(u)); R.byKind[k] = (R.byKind[k] || 0) + n; }
  for (const k in R.byKind) R.byKind[k] = MiB(R.byKind[k]);
  R.bytesTotal = io(); R.errors = P.errors.slice(0, 20); R.errorsN = P.errors.length;
  R.worldBuilt = !!(W.WF || (W.FLYDIY_WF)); R.programs = P.glLinks ? P.glLinks.length : null;
  for (const s of R.steps) { delete s.t0; delete s.b0; }
  log(MODE + ' / ' + BK + ': boot ' + (R.bootMs / 1000).toFixed(1) + ' s real; read ' + MiB(R.bytesTotal) + ' MB in ' + R.fetchedN + ' reads; after GC heap ' + R.afterGC.heap + ' MB + ArrayBuffers ' + R.afterGC.ab + ' MB (before the page: ' + m0.heap + ' + ' + m0.ab + '); errors ' + R.errorsN);
  log('   read by kind (MB, unique files): ' + JSON.stringify(R.byKind));
  for (const s of R.steps) log('   ' + String(s.step).padEnd(22) + String(s.ms).padStart(7) + ' ms ' + String(MiB(s.bytes || 0)).padStart(7) + ' MB read  heap ' + s.heap + ' ab ' + s.ab);
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  if (flag('nodrag')) { log('-> ' + path.relative(ROOT, OUT)); P.close(); process.exit(0); }
  // the drags (garage_release.js's procedure)
  W.requestAnimationFrame = () => 0; dropJobs = true;
  const BUSY = { ms: 0 };
  for (const k of ['setTimeout', 'setInterval', 'requestIdleCallback']) { const f = W[k];
    W[k] = function (fn, ...a) { if (typeof fn !== 'function') return f.call(this, fn, ...a);
      return f.call(this, function () { const t = now(); try { return fn.apply(this, arguments); } finally { BUSY.ms += now() - t; } }, ...a); }; }
  const Ev = W.Event, PE = W.PointerEvent || W.Event, U = W.CAGE_UI;
  for (const k of ROWS) {
    const el = D.getElementById('p_' + k);
    if (!el || el.type !== 'range' || el.offsetParent === null || el.disabled) { log(k.padEnd(12) + ' (no visible slider)'); continue; }
    const lo = +el.min, hi = +el.max, x0 = +el.value, st = +el.step || 0.001, dir = (hi - x0) > (x0 - lo) ? 1 : -1, d = Math.max(st, (hi - lo) * 0.012);
    const ticks = [], rels = [], idles = [];
    for (let r = 0; r <= REPS; r++) {
      const base = x0 + dir * d * 5 * (r % 2);
      U.dragSettleMs = 1e9;
      el.dispatchEvent(new PE('pointerdown')); await P.until(() => false, 20);
      for (let i = 1; i <= TICKS; i++) {
        el.value = String(Math.min(hi, Math.max(lo, base + dir * d * i * (r % 2 ? -1 : 1) + dir * d * 0.5 * r)));
        const tA = now(); el.dispatchEvent(new Ev('input')); if (r) ticks.push(now() - tA);
        await P.until(() => false, 30);
      }
      U.dragSettleMs = 350;
      const tB = now(); el.dispatchEvent(new Ev('change')); W.dispatchEvent(new PE('pointerup')); const rel = now() - tB;
      const b0 = BUSY.ms; await P.until(() => false, 1500); const idle = BUSY.ms - b0;
      if (r) { rels.push(rel); idles.push(idle); }
    }
    el.value = String(x0); el.dispatchEvent(new Ev('input')); el.dispatchEvent(new Ev('change')); await P.until(() => false, 2000);
    const row = { key: k, tick: +med(ticks).toFixed(1), release: +med(rels).toFixed(1), idle: +med(idles).toFixed(1), why: U.release ? JSON.stringify(U.release) : '' };
    R.rows.push(row); fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
    log(k.padEnd(12) + ' tick ' + String(row.tick).padStart(6) + '  release ' + String(row.release).padStart(7) + '  idle ' + String(row.idle).padStart(7) + '  ' + row.why.slice(0, 80));
  }
  gc(); R.afterDrags = mem(); fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  log('after the drags, GC: heap ' + R.afterDrags.heap + ' ab ' + R.afterDrags.ab + '  -> ' + path.relative(ROOT, OUT));
  P.close(); process.exit(0);
})().catch(e => { console.error('mobile_garage_node: ' + (e && e.stack || e)); process.exit(1); });
