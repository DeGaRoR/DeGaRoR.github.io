#!/usr/bin/env node
// garage_lag.js - GARAGE-LAG (G1280): THE EDITOR'S RESPONSE TO A PARAMETER CHANGE, per tree and per build.
// The user (2026-10-03): "the garage has become sluggish. Not the camera, but the update time when changing plane
// parameters." For each tree (a served copy - `git archive <sha> flyDiy | tar -x` under <repo>/_ab/<sha>/ - or this
// worktree's own flyDiy) and each build (master_bench's: the stock Cub, the user's metal Cessna), a FRESH Chrome on the
// same profile (CESSNA-LINKS), the page loaded into the garage, then a fixed script of changes, each --reps times on
// distinct values: the row's own widget is set and its event dispatched (what the browser does on a drag tick).
// Per change and rep:
//   sync   - the event's handler (the editor's build and whatever it runs inline)
//   frame  - from the event to the second rAF after it (the rebuilt aeroplane drawn)
//   busy   - the long tasks (>= 50 ms) from the event until the page has been quiet for --quiet ms (the async tails:
//            debounced commits, readouts, re-bakes), summed; settle = the end of the last one
//   fn     - inclusive ms in the wrapped functions (WRAP below) inside that window
// A slider's tick is a DRAG tick (GARAGE-LAG-2): a pointerdown on the slider first, as under a held pointer (a tree
// that does not listen for it is unchanged); its release is never sent, so a tree that defers work to the end of a
// drag pays it inside the window (busy, settle). --nodrag: the bare input event. The tank's tick + release is as
// before (input, then change).
// --prof: one extra, untimed rep per change under a CDP CPU profile: self ms by function and by file in the window.
// Usage: node tools/perf/garage_lag.js --port 8771 --udd D:/ugl1 --trees base=_ab/3da1c82a/flyDiy,today=_ab/06bbd8e3/flyDiy
//          [--builds cub,metal] [--reps 5] [--only fuseLen,wingSpan] [--prof] [--list] [--out file.json] [--page index.html] [--evms 60000] [--nodrag] [--norender]
// No --help (an unknown flag is ignored).
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const PORT = +opt('port', 0), UDD = opt('udd', null);
if (!PORT || !UDD) { console.error('garage_lag: --port and --udd are required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..');
const TREES = opt('trees', 'here=flyDiy').split(',').map(s => { const [k, p] = s.split('='); return { key: k, rel: p.replace(/\\/g, '/').replace(/\/$/, '') }; });
const WANT = opt('builds', 'cub,metal').split(',');
// the builds: the Cub as TODAY's first boot makes it (G770's default, captured once with --dumpwip from a 'default' load,
// so an older tree - whose default was not the Cub yet - builds the same aeroplane), and master_bench's metal Cessna
// (2026-10-03: the user's validated Cub is builds/cub_2026-09-20_corrected.json - the first boot is the Cub-ALIKE archetype)
const BUILDS = { cub: { label: 'Cub', build: 'builds/cub_2026-09-20_corrected.json' }, cubAlike: { label: 'Cub-alike (first boot, captured)', build: 'tools/perf/garage_lag_cub_wip.json' }, metal: MB.BUILDS.metal, default: { label: 'first boot', build: 'default' } };
const REPS = +opt('reps', 5), QUIET = +opt('quiet', 700), PAGE = opt('page', 'index.html');
// --evms: the page's answer per rep, ms (GARAGE-LAG-2: a SwiftShader cloud box links a new program in tens of seconds)
const EVMS = +opt('evms', 60000);
// --norender (GARAGE-LAG-2, the cloud): the page's render loop stopped once it is loaded (requestAnimationFrame
// answers nothing), so a SwiftShader box's minutes-long program links never land inside a measurement; sync and the
// JS tails (busy/settle: the deferred builds, the commits) are measured, frame is not (it reads as sync)
const NORENDER = flag('norender');
const ONLY = opt('only', null) ? new Set(opt('only').split(',')) : null;
const OUT = path.resolve(opt('out', path.join(__dirname, 'garage_lag_' + Date.now() + '.json')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => console.log('  ' + s);

// THE SCRIPT: [name, how to find the widget]. `id` a p_<key> row; `pick` a page expression returning the element
// (for widgets outside the row grammar: the finish tab's colours, the energy panel's capacity)
const CHANGES = [
  { name: 'fuseLen',   id: 'p_paxLen',   alt: ['p_boomLen'] },          // the cabin bay's length
  { name: 'fuseWidth', id: 'p_halfW' },
  { name: 'wingSpan',  id: 'p_wgSpan' },
  { name: 'wingChord', id: 'p_wgChord' },
  { name: 'tailSize',  id: 'p_stSpan' },
  { name: 'gearTrack', id: 'p_s1X' },                                  // the main gear's half track
  { name: 'engine',    id: 'p_engPreset' },
  { name: 'tankCap',   id: null, pick: 'tank', release: true },        // a drag tick (input) and its release (change: the commit)
  { name: 'livery',    id: null, pick: 'colour' },
  { name: 'frame',     id: 'p_frCabTopW', alt: ['p_frCabWaistW'] },
].filter(c => !ONLY || ONLY.has(c.name));
const PICK = {
  // the first colour input of the finish panel that is a section tint (the livery's own colours)
  colour: `(() => [...document.querySelectorAll('input[type=color]')].find(x => typeof x.oninput === 'function' && /^base colour/.test(((x.closest('.r') || x.parentElement || {}).textContent || '').trim())) || null)()`,
  // the energy panel's capacity: a number / range input whose row says litres
  tank: `(() => [...document.querySelectorAll('input[type=range]')].find(x => !/^p_/.test(x.id) && /^capacity/.test(((x.parentElement || {}).textContent || '').trim())) || null)()`,
};
// inclusive timers (only while a window is open): dotted paths off window, wrapped when they exist
const WRAP = ['buildGen', 'genShakedown', 'genNormaliseSpec', 'BUILD_SYNC', 'CAGE_ON_BUILD', 'BENCH_DIRTY',
  'CAGE_UI.build', 'CAGE_JOIN.export', 'CAGE_JOIN.joined', 'GARAGE_SPEC.commit', 'GARAGE_SPEC.update', 'GARAGE_SPEC.set',
  'VESSEL_GEN.bayCache', 'VESSEL_GEN.sLTable', 'CAGE_ENERGY.fitOf', 'CAGE_ENERGY.relayout', 'CAGE_ENERGY.commit', 'CAGE_ENERGY.fromSpec', 'CAGE_ENERGY.toSpec',
  'VESSEL_MESH.build', 'FLOWN_BAKE.forPayload', 'FLOWN_BAKE.mergeModel', 'FLOWN_BAKE.hybrid', 'PARKED.unwrap', 'PARKED.capture',
  'AEROSKIN.build', 'SIM_LINK.reinit', 'SIM_LINK.spec', 'cageSheet', 'applyDecals', 'applyWeather', 'buildMatPanel'];

const HARNESS = `(() => { if (window.__GL) return 'again'; const G = window.__GL = { on: false, fn: {}, lt: [], wrapped: [] };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => G.lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: false }); } catch (e) {}
  const get = p => p.split('.').reduce((o, k) => o == null ? o : o[k], window);
  for (const p of ${JSON.stringify(WRAP)}) { const i = p.lastIndexOf('.'), host = i < 0 ? window : get(p.slice(0, i)), k = i < 0 ? p : p.slice(i + 1);
    if (!host || typeof host[k] !== 'function' || host[k].__gl) continue; const f = host[k];
    const w = function () { if (!G.on) return f.apply(this, arguments); const t = performance.now(); try { return f.apply(this, arguments); } finally { const r = G.fn[p] || (G.fn[p] = [0, 0]); r[0] += performance.now() - t; r[1]++; } };
    w.__gl = 1; try { host[k] = w; G.wrapped.push(p); } catch (e) {} }
  const raf = () => new Promise(r => requestAnimationFrame(() => r(performance.now())));
  G.find = (id, alt, pick) => { if (pick) return pick; for (const x of [id].concat(alt || [])) { const e = x && document.getElementById(x); if (e) return e; } return null; };
  G.meta = el => { if (!el) return null; const row = el.closest('.r'); return { id: el.id, tag: el.tagName, type: el.type, min: el.min, max: el.max, step: el.step, value: el.value,
    label: row ? (row.querySelector('.k') || row).textContent.trim().slice(0, 60) : (el.title || ''), opts: el.tagName === 'SELECT' ? [...el.options].map(o => o.value) : null }; };
  G.set = (el, v, rel, pressed) => { if (${!flag('nodrag')} && el.type === 'range' && !rel && !pressed) el.dispatchEvent(new PointerEvent('pointerdown')); if (el.tagName === 'SELECT') { el.value = String(v); el.dispatchEvent(new Event('change')); }
    else if (el.type === 'checkbox') { el.checked = !!v; el.dispatchEvent(new Event('change')); }
    else if (el.type === 'range' || el.type === 'color') { el.value = String(v); el.dispatchEvent(new Event('input')); if (rel) el.dispatchEvent(new Event('change')); }
    else { el.value = String(v); if (typeof el.oninput === 'function') el.dispatchEvent(new Event('input')); else el.dispatchEvent(new Event('change')); } };
  G.quiet = async (t0, q, cap) => { while (true) { await new Promise(r => setTimeout(r, 100)); const now = performance.now(); const L = G.lt.filter(x => x[0] + x[1] > t0);
    const last = L.length ? Math.max(...L.map(x => x[0] + x[1])) : t0; if (now - last >= q || now - t0 > cap) return; } };
  G.one = async (el, v, q, rel) => { G.fn = {}; await G.quiet(performance.now(), 300, 4000);
    // GARAGE-INSTANT (G1446): the hand comes down a frame before it moves - the press is outside the tick (a tree that
    // does not listen for it is unchanged; one that measures its stand on it, G1443, does so there, as under a hand)
    const press = ${!flag('nodrag')} && el.type === 'range' && !rel;
    if (press) { el.dispatchEvent(new PointerEvent('pointerdown')); await new Promise(r => requestAnimationFrame(() => r())); await new Promise(r => setTimeout(r, 0)); }
    G.on = true; const t0 = performance.now(); G.set(el, v, rel, press); const t1 = performance.now();
    const tB = ${NORENDER} ? t1 : (await raf(), await raf()); await G.quiet(t0, q, 8000); G.on = false;
    const L = G.lt.filter(x => x[0] + x[1] > t0 - 1); const end = L.length ? Math.max(...L.map(x => x[0] + x[1])) : t1;
    const fn = {}; for (const k in G.fn) fn[k] = [+G.fn[k][0].toFixed(1), G.fn[k][1]];
    return { sync: +(t1 - t0).toFixed(1), frame: +(tB - t0).toFixed(1), busy: +L.reduce((a, x) => a + x[1], 0).toFixed(0), nLong: L.length,
      maxLong: L.length ? +Math.max(...L.map(x => x[1])).toFixed(0) : 0, settle: +(end - t0).toFixed(0), fn, t0 }; };
  return 'ok ' + G.wrapped.length; })()`;

// the values a rep sets: distinct per rep (no cache can hold the previous rep's answer), restored after the reps
function values(m, reps) {
  if (m.tag === 'SELECT') { const o = m.opts, i = o.indexOf(m.value), j = i + 1 < o.length ? i + 1 : i - 1; return Array.from({ length: reps }, (_, k) => k % 2 ? m.value : o[j]); }
  if (m.type === 'color') return Array.from({ length: reps }, (_, k) => '#' + [0x30 + 0x20 * k, 0x80, 0xd0 - 0x18 * k].map(x => (x & 255).toString(16).padStart(2, '0')).join(''));
  if (m.type === 'checkbox') return Array.from({ length: reps }, (_, k) => k % 2 === 0);
  const v = +m.value, lo = m.min !== '' ? +m.min : v * 0.5, hi = m.max !== '' ? +m.max : v * 1.5, st = +m.step || 0.001;
  const d = Math.max(st, (hi - lo) * 0.006), dir = (hi - v) >= (v - lo) ? 1 : -1;
  return Array.from({ length: reps }, (_, k) => +(v + dir * d * (k + 1)).toFixed(6));
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };

// a CPU profile's self time inside [t0, t1] (page clock = the profile's own after the offset), by function and by file
function hot(p) {
  const byId = new Map(p.nodes.map(n => [n.id, n])), parent = new Map();
  for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const name = cf => (cf.functionName || '(anon)') + ' ' + ((cf.url || '').split('/').pop().split('?')[0] || 'native') + ':' + (cf.lineNumber + 1);
  const self = new Map(), file = new Map(), incl = new Map(), inSelf = new Map();
  let syncUs = 0, gc = 0;
  for (let i = 0; i < p.samples.length; i++) {
    const us = p.timeDeltas[i + 1] || 0, n = byId.get(p.samples[i]); if (!n) continue;
    const k = name(n.callFrame); self.set(k, (self.get(k) || 0) + us);
    const f = (n.callFrame.url || '').split('/').pop().split('?')[0] || '(' + (n.callFrame.functionName || 'native') + ')'; file.set(f, (file.get(f) || 0) + us);
    if (/garbage/.test(n.callFrame.functionName)) gc += us;
    // the stack: the samples inside the change's own handler (the harness's G.set) are the tick's synchronous part
    const stk = []; for (let id = n.id; id != null; id = parent.get(id)) stk.push(byId.get(id).callFrame);
    if (!stk.some(cf => cf.functionName === 'G.set')) continue;
    syncUs += us; inSelf.set(k, (inSelf.get(k) || 0) + us);
    const seen = new Set(); for (const cf of stk) { const q = name(cf); if (seen.has(q)) continue; seen.add(q); incl.set(q, (incl.get(q) || 0) + us); }
  }
  const top = (m, n) => [...m].filter(x => !/^\((idle|program|garbage collector)\)/.test(x[0])).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, us]) => [k, +(us / 1000).toFixed(1)]);
  return { fn: top(self, 25), file: top(file, 12), gcMs: +(gc / 1000).toFixed(1), syncMs: +(syncUs / 1000).toFixed(1), syncIncl: top(incl, 60), syncSelf: top(inSelf, 30) };
}

(async () => {
  if (await MB.serveRoot(PORT)) { console.error('garage_lag: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT, opt('fallback', null)); await sleep(800);
  const root = await MB.serveRoot(PORT);
  if (!root || path.resolve(root) !== REPO) { console.error('garage_lag: the server serves ' + root + ', not ' + REPO); try { srv.kill(); } catch (e) {} process.exit(4); }
  const done = () => { try { srv.kill(); require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', done);
  const R = { date: new Date().toISOString(), trees: TREES, builds: WANT, reps: REPS, quiet: QUIET, udd: UDD, page: PAGE, rows: [], meta: [] };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  let b = null;
  const fresh = !fs.existsSync(UDD);
  for (const T of TREES) for (const bk of WANT) {
    const B = BUILDS[bk]; log('== ' + T.key + ' (' + T.rel + ') ' + B.label);
    if (b) await b.close(); b = await MB.browser(UDD);
    const url = 'http://localhost:' + PORT + '/' + T.rel + '/' + PAGE;
    if (fresh && !R.warmed) { log('warm-up load (discarded)'); await b.load(url, MB.preScript(B.build, null, B.patch)); await sleep(4000); await b.close(); b = await MB.browser(UDD); R.warmed = true; }
    const l = await b.load(url, MB.preScript(B.build, null, B.patch));
    log('loaded ' + l.state + ' in ' + l.sec + ' s');
    await sleep(6000);
    log('harness ' + await b.ev(HARNESS));
    if (NORENDER) { await b.ev("(() => { window.requestAnimationFrame = () => 0; return 1; })()"); await sleep(3000); log('render loop stopped'); }
    const ver = await b.ev("(() => { try { return (window.FLYDIY_BUILD || '') + ''; } catch (e) { return '?'; } })()");
    if (flag('dumpwip')) {
      const w = await b.ev("(() => { try { return localStorage.getItem('flydiy.wip') || ''; } catch (e) { return ''; } })()");
      fs.writeFileSync(path.join(__dirname, 'garage_lag_' + bk + '_wip.json'), w); log('wip ' + w.length + ' chars');
    }
    if (flag('list')) {
      const L = JSON.parse(await b.ev(`JSON.stringify((() => { const out = [];
        for (const el of document.querySelectorAll('[id^=p_]')) out.push(__GL.meta(el));
        for (const el of document.querySelectorAll('input[type=color]')) { const m = __GL.meta(el); m.ctx = (el.parentElement && el.parentElement.textContent || '').trim().slice(0, 50); m.oninput = typeof el.oninput; out.push(m); }
        for (const el of document.querySelectorAll('input')) { const t = (el.closest('.r, label, div') || {}).textContent || ''; if (/litre|capacity/i.test(t) && !/^p_/.test(el.id)) { const m = __GL.meta(el); m.ctx = t.trim().slice(0, 80); out.push(m); } }
        return out; })())`, 30000));
      fs.writeFileSync(OUT.replace(/\.json$/, '_list_' + T.key + '_' + bk + '.json'), JSON.stringify(L, null, 1));
      log('listed ' + L.length + ' widgets'); continue;
    }
    R.meta.push({ tree: T.key, build: bk, load: l, ver, exc: b.exc.slice() });
    for (const C of CHANGES) {
      const pickExpr = C.pick ? PICK[C.pick] : 'null';
      const findExpr = `__GL.find(${JSON.stringify(C.id)}, ${JSON.stringify(C.alt || [])}, ${pickExpr})`;
      const m = JSON.parse(await b.ev(`JSON.stringify(__GL.meta(${findExpr}))`));
      if (!m) { log(C.name.padEnd(10) + ' NO WIDGET'); R.rows.push({ tree: T.key, build: bk, change: C.name, missing: true }); continue; }
      const vals = values(m, REPS + (flag('prof') ? 1 : 0));
      const reps = []; let prof = null;
      for (let k = 0; k < vals.length; k++) {
        const P = flag('prof') && k === 0;
        if (P) { await b.cmd('Profiler.enable'); await b.cmd('Profiler.setSamplingInterval', { interval: 250 }); await b.cmd('Profiler.start'); }
        const r = JSON.parse(await b.ev(`(async () => JSON.stringify(await __GL.one(${findExpr}, ${JSON.stringify(vals[k])}, ${QUIET}, ${!!C.release})))()`, EVMS));
        if (P) { const p = await b.cmd('Profiler.stop'); prof = p.result && p.result.profile ? hot(p.result.profile) : null; await b.cmd('Profiler.disable'); continue; }
        reps.push(r);
      }
      // back to the build's own value (untimed), and let it settle
      await b.ev(`(async () => { __GL.set(${findExpr}, ${JSON.stringify(m.value)}, ${!!C.release}); await __GL.quiet(performance.now(), ${QUIET}, 8000); return 1; })()`, EVMS);
      const S = k => ({ med: med(reps.map(r => r[k])), max: reps.length ? Math.max(...reps.map(r => r[k])) : null });
      const fnSum = {}; for (const r of reps) for (const k in r.fn) { const a = fnSum[k] || (fnSum[k] = [0, 0]); a[0] += r.fn[k][0] / reps.length; a[1] += r.fn[k][1] / reps.length; }
      for (const k in fnSum) fnSum[k] = [+fnSum[k][0].toFixed(1), +fnSum[k][1].toFixed(1)];
      const row = { tree: T.key, build: bk, change: C.name, widget: m, vals, sync: S('sync'), frame: S('frame'), busy: S('busy'), settle: S('settle'), nLong: S('nLong'), maxLong: S('maxLong'), fn: fnSum, reps, prof };
      R.rows.push(row); save();
      log(C.name.padEnd(10) + ' ' + (m.id || m.type).padEnd(16) + ' sync ' + row.sync.med + '/' + row.sync.max + '  frame ' + row.frame.med + '/' + row.frame.max + '  busy ' + row.busy.med + '/' + row.busy.max + '  settle ' + row.settle.med + '/' + row.settle.max);
    }
    R.meta[R.meta.length - 1].excAfter = b.exc.slice();
  }
  if (b) await b.close();
  save(); console.log('  -> ' + OUT);
  process.exit(0);
})().catch(e => { console.error('garage_lag: ' + (e && e.stack || e)); process.exit(1); });
