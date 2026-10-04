#!/usr/bin/env node
// garage_census.js - GARAGE-INSTANT (G1440): EVERY GARAGE ROW, ITS RESPONSE AND WHERE THE TIME GOES - in node, no GPU.
// The page in node (tools/_page_node.js: dev.html's own scripts, the recording WebGL, a virtual clock) booted into the
// garage on a build, then every widget of the editor's panel - each p_<key> row (slider, select, checkbox, stepper),
// the finish tab's colour wells, the energy panel's ranges - moved the player's way (a slider: pointerdown, then
// input = a DRAG tick; then its release), REAL wall ms (process.hrtime, not the page's clock):
//   tick    - the input event's handler (what the hand waits on while dragging)
//   release - the change event + the timers the page runs in the next 2 s of its clock (the settle build, the commits)
//   layers  - inclusive ms of each PAGE.post layer inside the tick (wrapped as each tools/_cage_*.js file loads; a file's
//             wrapper includes the layers loaded before it, so self = incl - previous incl), the sheet (CAGE2.cageSheet),
//             the pre-post part of the build, the post tail (applyWeather, panels, draw)
// It is the JS side only: the fake GL uploads nothing and links nothing (the box adds the GPU's share: garage_lag.js).
// Usage: node --max-old-space-size=4096 tools/perf/garage_census.js --build cub|metal|jodel|cessna|floats
//          [--reps 3] [--only key1,key2] [--out file.json] [--query 'garage=old'] [--norelease] [--hash]
// --hash: no timing; the resolved spec of the build (the join's export) hashed after boot, after a move-and-back of
//         every row, and printed (the before/after bit-identity check).
// No --help (an unknown flag is ignored).
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json', floats: 'bugReports/cessnaFloatsWOrks.json' };
const BK = opt('build', 'cub'), REPS = +opt('reps', 3), ONLY = opt('only', null) ? new Set(opt('only').split(',')) : null;
const OUT = path.resolve(opt('out', path.join(__dirname, 'garage_census_' + BK + '.json')));
const now = () => Number(process.hrtime.bigint()) / 1e6;
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const log = s => console.log('  ' + s);

(async () => {
  const { openPage } = require('../_page_node.js');
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[BK] || BK), 'utf8') };
  const T = { on: false, acc: {} };              // inclusive ms per label while a measurement is open
  const add = (k, ms) => { const a = T.acc[k] || (T.acc[k] = [0, 0]); a[0] += ms; a[1]++; };
  const wrapPost = (W, label) => {
    // G1441: a tree with the flat chain times its layers itself (CAGE_CHAIN.last) - an assignment here would register
    if (W.CAGE_CHAIN) return;
    const PG = W.CAGE_PAGE; if (!PG || typeof PG.post !== 'function' || PG.post.__gc) return;
    const f = PG.post; const w = function (ctx) { if (!T.on) return f.apply(this, arguments); const t = now(); try { return f.apply(this, arguments); } finally { add('post:' + label, now() - t); } };
    w.__gc = 1; PG.post = w; T.postOrder.push(label);
  };
  T.postOrder = [];
  // THE READOUT WORKER'S JOBS ARE DROPPED once the garage is up (T.dropJobs): in the browser they run on their own thread;
  // here the harness waits for each (~3 s of shakedown a commit) before the page's next turn - wall time that is not the
  // page's. --keepjobs keeps them.
  let wrappedWorker = false;
  const hooks = { afterScript(name, P) {
    if (!wrappedWorker && P.win.Worker) { wrappedWorker = true; const Wk = P.win.Worker;
      P.win.Worker = function (u, o) { const w = new Wk(u, o); const pm = w.postMessage.bind(w); w.postMessage = (m, tr) => { if (T.dropJobs) return; return pm(m, tr); }; return w; }; } const m = /tools\/(_cage_\w+)\.js/.exec(name); if (m) wrapPost(P.win, m[1]); } };
  const t0 = now();
  // the energy panel's readout / balance worker runs as the browser runs it (a thread, off the page's clock): without it
  // the page computes them inline (3 s of shakedown in every release window - a node artefact)
  const P = await openPage({ quiet: true, storage, hooks, query: opt('query', ''), workers: /readoutCompute|balanceCompute/ });
  const W = P.win, D = W.document;
  W.__realNow = now;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  await P.until(() => !!W.CAGE_UI, 60000);
  // settle the boot's tails (the post-idle shakedown, the readouts)
  await P.until(() => false, 8000);
  log('garage up in ' + ((now() - t0) / 1000).toFixed(1) + ' s; errors ' + P.errors.length);
  // the render loop stopped (garage_lag's --norender): the node page's frames are the whole hangar through the recording
  // GL, seconds of them in a 2 s window; the census is the handlers and their timers (the box measures the frames)
  W.requestAnimationFrame = () => 0;
  if (!flag('keepjobs')) T.dropJobs = true;
  // THE MAIN THREAD'S BUSY: every timer callback the page schedules from here on is timed (real ms), so a release's
  // tails (the settle build, the post-idle commit) are the page's own work - not the harness's waits on worker threads
  const BUSY = { ms: 0, n: 0, long: 0 };
  for (const k of ['setTimeout', 'setInterval', 'requestIdleCallback']) { const f = W[k];
    W[k] = function (fn, ...a) { if (typeof fn !== 'function') return f.call(this, fn, ...a);
      return f.call(this, function () { const t = now(); try { return fn.apply(this, arguments); } finally { const d = now() - t; BUSY.ms += d; BUSY.n++; if (d >= 50) BUSY.long += d; } }, ...a); }; }
  // the ui's own extPass wrapper went on at boot: wrap it last
  wrapPost(W, 'ext');
  // the sheet and the build's whole, and named functions
  const wrapFn = (host, k, label) => { if (!host || typeof host[k] !== 'function' || host[k].__gc) return; const f = host[k];
    const w = function () { if (!T.on) return f.apply(this, arguments); const t = now(); try { return f.apply(this, arguments); } finally { add(label, now() - t); } }; w.__gc = 1; host[k] = w; };
  wrapFn(W.CAGE2, 'cageSheet', 'sheet');
  wrapFn(W.CAGE_UI, 'build', 'CAGE_UI.build');
  for (const k of ['applyWeather', 'buildMatPanel', 'applyDecals', 'CAGE_ON_BUILD', 'BUILD_SYNC', 'BENCH_DIRTY']) wrapFn(W, k, k);
  for (const [h, k] of [['GARAGE_SPEC', 'update'], ['GARAGE_SPEC', 'set'], ['CAGE_JOIN', 'export'], ['CAGE_JOIN', 'joined'], ['CAGE_ENERGY', 'relayout'], ['CAGE_ENERGY', 'commit']]) wrapFn(W[h], k, h + '.' + k);

  // ---- the widgets ----
  const visible = el => el.offsetParent !== null;
  const rowLabel = el => { const r = el.closest && el.closest('.r'); const k = r && r.querySelector('.k'); return ((k || r || {}).textContent || el.title || '').trim().slice(0, 50); };
  const W8 = [];
  for (const el of D.querySelectorAll('[id^=p_]')) {
    if (!/^(INPUT|SELECT)$/.test(el.tagName)) continue;
    const kind = el.tagName === 'SELECT' ? 'select' : el.type === 'range' ? 'slider' : el.type === 'checkbox' ? 'check' : 'step';
    W8.push({ key: el.id.slice(2), kind, el, label: rowLabel(el), vis: visible(el) });
  }
  for (const el of D.querySelectorAll('input[type=color]')) if (typeof el.oninput === 'function' || (el._ls && el._ls.input))
    W8.push({ key: 'colour:' + rowLabel(el).replace(/\s+/g, '_'), kind: 'colour', el, label: rowLabel(el), vis: visible(el) });
  for (const el of D.querySelectorAll('input[type=range]')) if (!/^p_/.test(el.id || ''))
    W8.push({ key: 'range:' + (el.id || rowLabel(el).replace(/\s+/g, '_')), kind: 'range', el, label: rowLabel(el), vis: visible(el) });
  // unique keys
  const seen = {}; for (const w of W8) { if (seen[w.key]) w.key += '#' + (++seen[w.key]); else seen[w.key] = 1; }
  log(W8.length + ' widgets (' + W8.filter(w => w.vis).length + ' visible)');
  const Ev = W.Event, PE = W.PointerEvent || W.Event;
  const values = (w, n) => {
    const el = w.el;
    if (w.kind === 'select') { const o = [...el.options].map(x => x.value), i = o.indexOf(el.value); const j = i + 1 < o.length ? i + 1 : i - 1; return Array.from({ length: n }, (_, k) => k % 2 ? el.value : o[j]); }
    if (w.kind === 'colour') return Array.from({ length: n }, (_, k) => '#' + [0x30 + 0x20 * k, 0x80, 0xd0 - 0x18 * k].map(x => (x & 255).toString(16).padStart(2, '0')).join(''));
    if (w.kind === 'check') return Array.from({ length: n }, (_, k) => k % 2 === 0 ? !el.checked : el.checked);
    const v = +el.value, lo = el.min !== '' && el.min != null ? +el.min : v * 0.5, hi = el.max !== '' && el.max != null ? +el.max : v * 1.5, st = +el.step || 0.001;
    const d = Math.max(st, (hi - lo) * 0.006), dir = (hi - v) >= (v - lo) ? 1 : -1;
    return Array.from({ length: n }, (_, k) => +(v + dir * d * (k + 1)).toFixed(6));
  };
  const set = (w, v, phase) => {          // phase: 'tick' (a drag tick) | 'release' | 'plain'
    const el = w.el;
    if (w.kind === 'select') { el.value = String(v); el.dispatchEvent(new Ev('change')); return; }
    if (w.kind === 'check') { el.checked = !!v; el.dispatchEvent(new Ev('change')); return; }
    if (w.kind === 'step') { el.value = String(v); el.dispatchEvent(new Ev('change')); return; }
    if (phase === 'release') { el.dispatchEvent(new Ev('change')); W.dispatchEvent(new Ev('pointerup')); return; }
    el.value = String(v); el.dispatchEvent(new Ev('input'));
  };
  // --prof: the warm-up rep of each row under the inspector's CPU profiler (this process IS the page): tick and release
  // apart, the top self and inclusive functions
  const PROF = flag('prof');
  let SES = null; const post = (m, p) => new Promise((r, j) => SES.post(m, p || {}, (e, x) => e ? j(e) : r(x)));
  if (PROF) { SES = new (require('inspector').Session)(); SES.connect(); await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 200 }); }
  const hot = p => {
    const byId = new Map(p.nodes.map(n => [n.id, n])), par = new Map(); for (const n of p.nodes) for (const c of n.children || []) par.set(c, n.id);
    const nm = cf => (cf.functionName || '(anon)') + ' ' + (cf.url || '').split(/[\/]/).pop() + ':' + (cf.lineNumber + 1);
    const self = new Map(), incl = new Map();
    for (let i = 0; i < p.samples.length; i++) { const us = p.timeDeltas[i + 1] || 0, n = byId.get(p.samples[i]); if (!n) continue;
      const k = nm(n.callFrame); self.set(k, (self.get(k) || 0) + us);
      const seen = new Set(); for (let id = n.id; id != null; id = par.get(id)) { const q = nm(byId.get(id).callFrame); if (seen.has(q)) continue; seen.add(q); incl.set(q, (incl.get(q) || 0) + us); } }
    const top = (m, n) => [...m].filter(x => !/^\((idle|program|root)\)/.test(x[0])).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, us]) => [k, +(us / 1000).toFixed(1)]);
    return { self: top(self, 30), incl: top(incl, 80) };
  };
  const RELMS = +opt('relms', 1500);
  const runFor = async ms => { const tA = now(); await P.until(() => false, ms); return now() - tA; };
  const snap = () => { const o = {}; for (const k in T.acc) o[k] = +T.acc[k][0].toFixed(1); return o; };

  // --lvl n: the sheet's subdivision level (the hidden #lvl; 2 is the game's) - the preview-resolution experiment
  if (opt('lvl', null) != null) { D.getElementById('lvl').value = String(opt('lvl')); W.CAGE_UI.build(); await runFor(1500); log('level ' + D.getElementById('lvl').value); }
  if (flag('hash')) {
    const hashSpec = () => { let s = null; try { s = W.CAGE_JOIN.export(); } catch (e) { return 'ERR ' + e.message; } return crypto.createHash('sha1').update(JSON.stringify(s)).digest('hex').slice(0, 16); };
    log('boot ' + hashSpec());
    process.exit(0);
  }

  const R = { date: new Date().toISOString(), build: BK, file: BUILDS[BK], reps: REPS, postOrder: T.postOrder, rows: [], errors0: P.errors.slice() };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  const KINDS = opt('kinds', null) ? new Set(opt('kinds').split(',')) : null;
  const SH = opt('shard', '0/1').split('/').map(Number);
  let wi = -1;
  for (const w of W8) {
    if (ONLY && !ONLY.has(w.key)) continue;
    if (!w.vis && !flag('hidden')) continue;
    if (w.el.disabled) continue;
    if (KINDS && !KINDS.has(w.kind)) continue;
    if (++wi % SH[1] !== SH[0]) continue;
    const v0 = w.kind === 'check' ? w.el.checked : w.el.value;
    const vals = values(w, REPS + 1);    // the first is a warm-up (untimed)
    const ticks = [], rels = [], lay = [], profs = {};
    const e0 = P.errors.length;
    for (let i = 0; i < vals.length; i++) {
      const pr = PROF && i === 0;
      if (pr) await post('Profiler.start');
      T.acc = {}; T.on = true;
      const pv0 = W.CAGE_UI.preview ? W.CAGE_UI.preview.n : 0;
      // the hand comes down a frame before it moves (the press is not the tick: G1443 measures the stand on it)
      if (w.kind === 'slider' || w.kind === 'range') { w.el.dispatchEvent(new PE('pointerdown')); await P.until(() => false, 20); }
      const tA = now(); set(w, vals[i], 'tick'); const tick = now() - tA;
      const previewed = W.CAGE_UI.preview ? W.CAGE_UI.preview.n > pv0 : false;
      const L = snap(); T.acc = {};
      const plan = previewed && W.CAGE_UI.preview.last ? W.CAGE_UI.preview.last.why.map((y, j) => y ? W.CAGE_CHAIN.layers[j].name + '(' + y + ')' : null).filter(Boolean).join(' ') : null;
      const CH = W.CAGE_CHAIN, chainL = CH && CH.last ? CH.last.map(x => [x.name, x.ran ? x.ms : -1]) : null;
      if (CH) CH.last = null;
      if (pr) { profs.tick = hot((await post('Profiler.stop')).profile); await post('Profiler.start'); }
      let rel = 0;
      if (!flag('norelease')) { const tB = now(); if (w.kind === 'slider' || w.kind === 'range' || w.kind === 'colour') set(w, vals[i], 'release'); rel = now() - tB; const b0 = BUSY.ms; await runFor(RELMS); rel += BUSY.ms - b0; }
      else await runFor(RELMS);
      const LR = snap(); T.on = false;
      if (pr) profs.release = hot((await post('Profiler.stop')).profile);
      if (i === 0) continue;
      ticks.push(tick); rels.push(rel); lay.push({ tick: L, release: LR, chain: chainL, preview: previewed, plan });
    }
    // back to the build's value, untimed
    T.on = false;
    if (w.kind === 'check') { w.el.checked = v0; w.el.dispatchEvent(new Ev('change')); }
    else { set(w, v0, 'tick'); set(w, v0, 'release'); }
    await runFor(2500);
    // the layers' self ms (median over reps of the tick)
    const lm = {}; for (const k of new Set(lay.flatMap(x => Object.keys(x.tick)))) lm[k] = +med(lay.map(x => x.tick[k] || 0)).toFixed(1);
    const self = {}; let prev = 0;
    for (const lab of T.postOrder) { const k = 'post:' + lab; if (lm[k] == null) continue; self[lab] = +(lm[k] - prev).toFixed(1); prev = lm[k]; }
    // the flat chain's own: self ms per layer (-1 = skipped by the preview's plan), median over the reps
    if (lay.length && lay[0].chain) for (let j = 0; j < lay[0].chain.length; j++) self[lay[0].chain[j][0]] = +med(lay.map(x => x.chain ? x.chain[j][1] : 0)).toFixed(1);
    const rm = {}; for (const k of new Set(lay.flatMap(x => Object.keys(x.release)))) rm[k] = +med(lay.map(x => x.release[k] || 0)).toFixed(1);
    const row = { key: w.key, kind: w.kind, label: w.label, tick: +med(ticks).toFixed(1), tickMax: +Math.max(...ticks).toFixed(1), release: +med(rels).toFixed(1),
      sheet: lm.sheet || 0, build: lm['CAGE_UI.build'] || 0, post: lm['post:ext'] || 0, self, fn: lm, rel: rm, preview: lay.filter(x => x.preview).length, plan: lay.length ? lay[lay.length - 1].plan : null, err: P.errors.length - e0, prof: PROF ? profs : undefined };
    R.rows.push(row); save();
    const top = Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k.replace('_cage_', '') + ' ' + v).join(', ');
    log(w.key.padEnd(26).slice(0, 26) + ' ' + w.kind.padEnd(6) + ' tick ' + String(row.tick).padStart(6) + '  rel ' + String(row.release).padStart(6) + '  sheet ' + String(row.sheet).padStart(5) + (row.preview ? ' P' : '  ') + ' | ' + top + (row.err ? '  ERR ' + row.err : '') + (row.plan ? '\n      plan: ' + row.plan : ''));
  }
  save(); log('-> ' + OUT);
  P.close(); process.exit(0);
})().catch(e => { console.error('garage_census: ' + (e && e.stack || e)); process.exit(1); });
