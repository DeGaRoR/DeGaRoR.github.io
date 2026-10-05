#!/usr/bin/env node
// garage_release.js - RELEASE-FAST (G1450): WHAT A SLIDER'S RELEASE RUNS, ROW BY ROW - in node, no GPU.
// The page in node (tools/_page_node.js) booted into the garage on a build; each row of --only (default: GATE INSTANT's
// twelve and the metal's sheet-detail rows) is DRAGGED the player's way - pointerdown, --ticks input ticks a frame
// apart (the previews), then the RELEASE: the slider's change + the pointer up (the settle build runs inside them) -
// and REAL ms (process.hrtime) are taken:
//   tick     - the median drag tick's handler
//   release  - the change + pointerup handler (what the hand waits on when it lets go)
//   idle     - the page's timer callbacks over the next --relms of its clock (what was deferred to idle, and the
//              debounced commits), summed
//   chain    - each post-chain layer's self ms inside the release (CAGE_CHAIN.last; -1 = kept: not run)
//   sheet    - CAGE2.cageSheet inside the release (and, with --prof, each pass's inclusive ms off the CPU profile)
//   relWhy   - CAGE_UI.release (G1451: which way the release went: whole, or the layers it ran)
// --prof: the release of the FIRST rep under the inspector's CPU profiler: inclusive ms of the named generator passes
// and layers, and the top self functions.
// Usage: node --max-old-space-size=4096 tools/perf/garage_release.js --build cub|metal|jodel|cessna|floats
//          [--reps 3] [--ticks 4] [--only k1,k2] [--prof] [--out file.json] [--query 'garage=old'] [--relms 1500]
// No --help (an unknown flag is ignored).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json', floats: 'bugReports/cessnaFloatsWOrks.json' };
const BK = opt('build', 'cub'), REPS = +opt('reps', 3), TICKS = +opt('ticks', 4), RELMS = +opt('relms', 1500);
const ROWS = (opt('only', null) ? opt('only').split(',') : ['wgSpan', 'wgChord', 'stSpan', 's1X', 'seatH', 'paxLen', 'halfW', 'roofY', 'noseDroop',
  'frCabTopW', 'rimW', 'dashDepth', 'dashBack', 'rimRivet', 'rimRise', 'dashLip', 'shoulderT', 'doorDepth', 'skinT', 'winSillPilot']);
const OUT = path.resolve(opt('out', path.join(__dirname, 'garage_release_' + BK + '.json')));
const now = () => Number(process.hrtime.bigint()) / 1e6;
const med = a => { const s = a.filter(x => x != null).slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const log = s => console.log('  ' + s);
// the passes and steps named in the profile's inclusive table
const NAMED = /^(cageSheet|cageSpec|buildCage2|cageSubdivide|cageRefitArc|cageGlassSill|cageCut|knifeCut|knifeNormals|cageCanopy|cageRims|cageInterior|cageShoulder|cageExplodeFaces|meshFrom|meshGlass|applyWeather|aeroWxBakeCavity|buildMatPanel|applyDecals|decRange|decApplyRanges|placeEditor|refreshInterior|applyBuildClip|applyRowVis|syncFollow|draw|measureBox|disposeObj|buildSteps|deformTick|runLayer|sheetKept|sheetKeyOf|specKey|releaseSteps|passKept)$/;

(async () => {
  const { openPage } = require('../_page_node.js');
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[BK] || BK), 'utf8') };
  let dropJobs = false, wrapped = false;
  const hooks = { afterScript(name, P) {
    if (!wrapped && P.win.Worker) { wrapped = true; const Wk = P.win.Worker;
      P.win.Worker = function (u, o) { const w = new Wk(u, o); const pm = w.postMessage.bind(w); w.postMessage = (m, tr) => { if (dropJobs) return; return pm(m, tr); }; return w; }; } } };
  const t0 = now();
  const P = await openPage({ quiet: true, storage, hooks, query: opt('query', ''), workers: /readoutCompute|balanceCompute/ });
  const W = P.win, D = W.document;
  W.__realNow = now;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  await P.until(() => !!W.CAGE_UI, 60000);
  await P.until(() => false, 8000);
  log(BK + ': garage up in ' + ((now() - t0) / 1000).toFixed(1) + ' s; errors ' + P.errors.length + '; chain ' + (W.CAGE_CHAIN ? (W.CAGE_CHAIN.ok ? 'ok' : 'NOT OK') : 'absent'));
  W.requestAnimationFrame = () => 0;
  dropJobs = true;
  const BUSY = { ms: 0, n: 0 };
  for (const k of ['setTimeout', 'setInterval', 'requestIdleCallback']) { const f = W[k];
    W[k] = function (fn, ...a) { if (typeof fn !== 'function') return f.call(this, fn, ...a);
      return f.call(this, function () { const t = now(); try { return fn.apply(this, arguments); } finally { BUSY.ms += now() - t; BUSY.n++; } }, ...a); }; }
  const ACC = { on: false, m: {} };
  const wrapFn = (host, k, label) => { if (!host || typeof host[k] !== 'function' || host[k].__gr) return; const f = host[k];
    const w = function () { if (!ACC.on) return f.apply(this, arguments); const t = now(); try { return f.apply(this, arguments); } finally { ACC.m[label] = (ACC.m[label] || 0) + now() - t; } }; w.__gr = 1; host[k] = w; };
  wrapFn(W.CAGE2, 'cageSheet', 'sheet');
  for (const k of ['applyWeather', 'buildMatPanel', 'applyDecals', 'CAGE_ON_BUILD']) wrapFn(W, k, k);
  let SES = null; const post = (m, p) => new Promise((r, j) => SES.post(m, p || {}, (e, x) => e ? j(e) : r(x)));
  if (flag('prof')) { SES = new (require('inspector').Session)(); SES.connect(); await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 100 }); }
  const hot = p => {
    const byId = new Map(p.nodes.map(n => [n.id, n])), par = new Map(); for (const n of p.nodes) for (const c of n.children || []) par.set(c, n.id);
    const nm = cf => (cf.functionName || '(anon)') + ' ' + (cf.url || '').split(/[\/]/).pop() + ':' + (cf.lineNumber + 1);
    const self = new Map(), incl = new Map(), named = new Map();
    for (let i = 0; i < p.samples.length; i++) { const us = p.timeDeltas[i + 1] || 0, n = byId.get(p.samples[i]); if (!n) continue;
      const k = nm(n.callFrame); self.set(k, (self.get(k) || 0) + us);
      const seen = new Set(), seenN = new Set();
      for (let id = n.id; id != null; id = par.get(id)) { const cf = byId.get(id).callFrame, q = nm(cf);
        if (!seen.has(q)) { seen.add(q); incl.set(q, (incl.get(q) || 0) + us); }
        if (NAMED.test(cf.functionName) && !seenN.has(cf.functionName)) { seenN.add(cf.functionName); named.set(cf.functionName, (named.get(cf.functionName) || 0) + us); } } }
    const top = (m, n) => [...m].filter(x => !/^\((idle|program|root)\)/.test(x[0])).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, us]) => [k, +(us / 1000).toFixed(1)]);
    return { named: Object.fromEntries([...named].sort((a, b) => b[1] - a[1]).map(([k, us]) => [k, +(us / 1000).toFixed(1)])), self: top(self, 25), incl: top(incl, 60) };
  };
  const Ev = W.Event, PE = W.PointerEvent || W.Event, U = W.CAGE_UI;
  const R = { date: new Date().toISOString(), build: BK, query: opt('query', ''), rows: [] };
  for (const k of ROWS) {
    const el = D.getElementById('p_' + k);
    if (!el || el.type !== 'range' || el.offsetParent === null || el.disabled) { log(k.padEnd(12) + ' (no visible slider)'); continue; }
    const lo = +el.min, hi = +el.max, x0 = +el.value, st = +el.step || 0.001, dir = (hi - x0) > (x0 - lo) ? 1 : -1;
    const d = Math.max(st, (hi - lo) * 0.012);
    const ticks = [], rels = [], idles = [], pvs = [], sheets = [], chains = [], fns = [], whys = [];
    let prof = null;
    for (let r = 0; r <= REPS; r++) {                   // rep 0 is a warm-up (profiled with --prof)
      const base = x0 + dir * d * 5 * (r % 2);          // alternate: away and back, distinct values each rep
      // the pause that settles a drag is held off (the node page's clock runs ~10 us a call: a build's own calls would
      // carry it past 350 ms inside the gap between two ticks) - the release is the settle, as a hand lets go
      U.dragSettleMs = 1e9;
      const pv0 = U.preview ? U.preview.n : 0;
      el.dispatchEvent(new PE('pointerdown')); await P.until(() => false, 20);
      for (let i = 1; i <= TICKS; i++) {
        el.value = String(Math.min(hi, Math.max(lo, base + dir * d * i * (r % 2 ? -1 : 1) + dir * d * 0.5 * r)));
        const tA = now(); el.dispatchEvent(new Ev('input')); ticks.push(now() - tA);
        await P.until(() => false, 30);
      }
      if (W.CAGE_CHAIN) W.CAGE_CHAIN.last = null;
      if (prof === null && flag('prof') && r === 0) await post('Profiler.start');
      ACC.m = {}; ACC.on = true;
      const pvN = U.preview ? U.preview.n - pv0 : 0;
      U.dragSettleMs = 350;
      const tB = now(); el.dispatchEvent(new Ev('change')); W.dispatchEvent(new PE('pointerup')); const rel = now() - tB;
      ACC.on = false;
      if (flag('prof') && r === 0) prof = hot((await post('Profiler.stop')).profile);
      const fn = ACC.m; const chain = W.CAGE_CHAIN && W.CAGE_CHAIN.last ? W.CAGE_CHAIN.last.map(x => [x.name, x.ran ? x.ms : -1]) : null;
      const why = U.release ? JSON.stringify(U.release) : '';
      const b0 = BUSY.ms; await P.until(() => false, RELMS); const idle = BUSY.ms - b0;
      if (r === 0) continue;
      rels.push(rel); idles.push(idle); pvs.push(pvN); sheets.push(fn.sheet || 0); chains.push(chain); fns.push(fn); whys.push(why);
    }
    // back to the build's value (a whole build)
    el.value = String(x0); el.dispatchEvent(new Ev('input')); el.dispatchEvent(new Ev('change'));
    await P.until(() => false, 2000);
    const chainMed = chains[0] ? chains[0].map((c, j) => [c[0], +med(chains.map(x => x ? x[j][1] : null)).toFixed(1)]) : null;
    const fnMed = {}; for (const f of new Set(fns.flatMap(x => Object.keys(x)))) fnMed[f] = +med(fns.map(x => x[f] || 0)).toFixed(1);
    const row = { key: k, tick: +med(ticks).toFixed(1), release: +med(rels).toFixed(1), releaseMax: +Math.max(...rels).toFixed(1), idle: +med(idles).toFixed(1),
      sheet: +med(sheets).toFixed(1), previews: pvs.join('/'), fn: fnMed, chain: chainMed, why: whys[whys.length - 1], prof };
    R.rows.push(row); fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
    const ch = chainMed ? chainMed.filter(c => c[1] !== 0).map(c => c[0] + (c[1] < 0 ? '-' : ' ' + c[1])).join(' ') : '';
    log(k.padEnd(12) + ' tick ' + String(row.tick).padStart(6) + '  RELEASE ' + String(row.release).padStart(6) + ' (max ' + row.releaseMax + ')  idle ' + String(row.idle).padStart(6) + '  sheet ' + String(row.sheet).padStart(5) + '  previews ' + row.previews + '/' + TICKS + '  ' + (row.why || '') + '\n      ' + ch +
      '  | ' + Object.entries(fnMed).filter(([f]) => f !== 'sheet').map(([f, v]) => f + ' ' + v).join(' '));
    if (prof) log('      prof: ' + Object.entries(prof.named).slice(0, 22).map(([f, v]) => f + ' ' + v).join(', '));
  }
  log('-> ' + OUT);
  P.close(); process.exit(0);
})().catch(e => { console.error('garage_release: ' + (e && e.stack || e)); process.exit(1); });
