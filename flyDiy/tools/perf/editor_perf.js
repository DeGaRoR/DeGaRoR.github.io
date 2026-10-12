#!/usr/bin/env node
// editor_perf.js - EDITOR-PERF (G3080-G3089): EVERY SCENERY-EDITOR ACTION ON THE USER'S OWN FILE, timed, with what ran.
// The user (12 Oct): "If I'm stuck later this week with no credits, I'd rather have a good editor, not as laggy as the
// current one." editor_lag.js (G1400) timed five drags on fixtures it added; this one loads the USER'S scenery as the
// world (the game's save slot, before the boot - the same id, so it wins over the shipped one) and walks every action
// class of the editor, each --reps times, per tree (A/B: --trees base=_ab/<sha>/flyDiy,here=flyDiy) and per town
// (--town off,on: ?town=1 puts Metlakatla back, as the graphics row 'all' does):
//   open, close                 PREM.openEditor / PREM.close (the editor's door; a close then an open per rep)
//   sel:<kind>                  a select from nothing: a road (the longest), an area (the largest), a site, a placed object
//   pick                        the pick cycle: a second click where the first was (R.hitAll) on the longest road's point
//   drag:<kind>                 the hand in its three beats (dragStart / dragMove x --moves / dragEnd): a road point (the
//                               longest road's middle point), an area corner, a site's anchor, an object, a strip's end,
//                               a taxi point - per move and the release
//   rotate, scale               a placed object's yaw / s through the editor's 'set'
//   delete, undo, redo          a placed object deleted, the undo; the last road drag undone, redone
//   slider:<target>:<label>     EVERY inspector slider of the road / the area / the site: 8 input events 30 ms apart (the
//                               hand on it), then the rest (the 200 ms debounce's rebuild)
//   cam:<mode>                  orbit / map / fly: the eye swept over the densest part for 2 s (frames only)
// Per action: sync (the call's own ms), frame (to the 2nd rAF), worst frame interval and long tasks to quiet, settle (to
// quiet), and the editor's own 'edit' events (premises_ui G3082: the rebuild by step - compose, roads, houses, outlines
// - the inspector, the ground re-sample) - what ran. --prof: one extra untimed rep per action under a CDP CPU profile
// (self ms by function, the sync stack inclusive).
// Usage: node tools/perf/editor_perf.js --port 8773 --udd D:/uep1 [--file <scenery.json>] [--trees here=flyDiy]
//          [--town off,on] [--reps 3] [--moves 6] [--only open,sel:road,drag:road] [--prof] [--out file.json]
// Default file: D:/Dev/flydiy-notes/scenery-backups/Jolene_AFB_rev26_2026-10-12_0305.json (read only).
// The box: a GPU-lock slot booked with A0 (a browser run). No --help (an unknown flag is ignored).
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const PORT = +opt('port', 0), UDD = opt('udd', null);
if (!PORT || !UDD) { console.error('editor_perf: --port and --udd are required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..');
const FILE = opt('file', 'D:/Dev/flydiy-notes/scenery-backups/Jolene_AFB_rev26_2026-10-12_0305.json');
const TREES = opt('trees', 'here=flyDiy').split(',').map(s => { const [k, p] = s.split('='); return { key: k, rel: p.replace(/\\/g, '/').replace(/\/$/, '') }; });
const TOWNS = opt('town', 'off').split(',');
const REPS = +opt('reps', 3), MOVES = +opt('moves', 6), QUIET = +opt('quiet', 700), PAGE = opt('page', 'index.html');
const ONLY = opt('only', null) ? opt('only').split(',') : null;
const OUT = path.resolve(opt('out', path.join(__dirname, 'editor_perf_' + Date.now() + '.json')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => console.log('  ' + s);
const TXT = fs.readFileSync(FILE, 'utf8');
JSON.parse(TXT);   // (a file that is not JSON stops here, not in the page)

// the page side: the editor opened, the recorder's 'edit' events caught, the frames and long tasks kept
const HARNESS = `(async () => { if (window.__EP) return 'again'; const P = window.PREMISES_EDITOR; if (!P) return 'no editor';
  P.openEditor(); for (let i = 0; i < 400 && !P.ed; i++) await new Promise(r => setTimeout(r, 200)); if (!P.ed) return 'the editor did not open';
  const G = window.__EP = { lt: [], fr: [], ev: [], last: 0 };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => G.lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: false }); } catch (e) {}
  const loop = t => { if (G.last) G.fr.push([t, t - G.last]); G.last = t; if (G.fr.length > 50000) G.fr.splice(0, 20000); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  const F = window.FLIGHT_REC || (window.FLIGHT_REC = {}), ev0 = F.event;
  F.event = function (k, ms, d) { if (k === 'edit') G.ev.push([performance.now(), ms, d]); return ev0 ? ev0.apply(F, arguments) : undefined; };
  G.raf = () => new Promise(r => requestAnimationFrame(() => r(performance.now())));
  G.quiet = async (t0, q, cap) => { while (true) { await new Promise(r => setTimeout(r, 100)); const now = performance.now(); const L = G.lt.filter(x => x[0] + x[1] > t0);
    const last = L.length ? Math.max(...L.map(x => x[0] + x[1])) : t0; if (now - last >= q || now - t0 > cap) return; } };
  // one timed beat: fn() run synchronously, then the frames and the long tasks to quiet
  G.beat = async (fn, quiet) => { const t0 = performance.now(); let err = null; try { (function EPfire() { fn(); })(); } catch (e) { err = String(e && e.message || e); } const t1 = performance.now();
    await G.raf(); const tB = await G.raf(); await G.quiet(t0, quiet, 30000);
    const L = G.lt.filter(x => x[0] + x[1] > t0 - 1), end = L.length ? Math.max(t1, ...L.map(x => x[0] + x[1])) : t1, fr = G.fr.filter(x => x[0] > t0 && x[0] - x[1] < end + 50);
    return { err, sync: +(t1 - t0).toFixed(1), frame: +(tB - t0).toFixed(1), worstFrame: fr.length ? +Math.max(...fr.map(x => x[1])).toFixed(0) : null, longN: L.length, longMax: L.length ? +Math.max(...L.map(x => x[1])).toFixed(0) : 0,
      busy: +L.reduce((a, x) => a + x[1], 0).toFixed(0), settle: +(end - t0).toFixed(0), edits: G.ev.filter(e => e[0] >= t0).map(e => [+e[1], e[2]]) }; };
  G.P = P; return 'ok'; })()`;

// the targets on the user's record (untimed): the longest road, the largest area, a site, a placed object, a strip with a way out
const TARGETS = `(async () => { const G = window.__EP, ed = G.P.ed, R = G.P.R, rec = ed.record(), PG = window.PREMISES_GEN, out = {};
  const len = r => { let s = 0; for (let i = 1; i < r.pts.length; i++) s += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); return s; };
  const road = rec.layers.roads.filter(r => r.pts && r.pts.length > 3).sort((a, b) => len(b) - len(a))[0];
  if (road) { out.road = road.id; out.roadKey = 'v' + Math.floor(road.pts.length / 2); out.roadPt = road.pts[Math.floor(road.pts.length / 2)]; out.roadPts = road.pts.length; out.roadKm = +(len(road) / 1000).toFixed(1); }
  const area = (rec.layers.areas || []).filter(a => a.poly && a.poly.length > 2).sort((a, b) => Math.abs(PG.polyArea(b.poly)) - Math.abs(PG.polyArea(a.poly)))[0];
  if (area) out.area = area.id;
  const site = rec.layers.sites.find(s => s.at && (s.items || []).length); if (site) out.site = site.id;
  const ob = rec.layers.objects.find(o => o.kind === 'prop') || rec.layers.objects.find(o => o.kind === 'tree' || o.kind === 'billboard'); if (ob) out.object = ob.id;
  const rw = rec.layers.runways.find(r => r.taxiOut && r.taxiOut.length > 1) || rec.layers.runways[0]; if (rw) { out.strip = rw.id; out.taxi = rw.taxiOut && rw.taxiOut.length > 1 ? rw.id : null; }
  out.n = PG.LAYERS.reduce((a, k) => a + (rec.layers[k] || []).length, 0);
  out.town = window.FLYDIY_TOWN ? { all: !!window.FLYDIY_TOWN.all, cut: window.FLYDIY_TOWN.n || 0 } : null;
  await G.quiet(performance.now(), 1500, 60000);
  return JSON.stringify(out); })()`;

// THE SCRIPT: [name, the page code of one rep] - a rep returns G.beat's result (or a drag's, with its moves)
const sel = (k) => ({ name: 'sel:' + k, need: k, js: T => `G.P.ed.select(null); await G.quiet(performance.now(), 300, 5000); return await G.beat(() => G.P.ed.select(${JSON.stringify(T[k])}), ${QUIET});` });
const drag = (k, key) => ({ name: 'drag:' + k, need: k, js: (T, rep) => `const ed = G.P.ed, R = G.P.R, PG = window.PREMISES_GEN, id = ${JSON.stringify(T[k])};
  ed.setTool('select'); ed.select(id); await G.quiet(performance.now(), 300, 5000);
  const hs = R.handles(id), h = hs.find(q => q.key === ${JSON.stringify(key(T))}) || hs[0]; if (!h) return { err: 'no handle on ' + id };
  const F = R.overlay.frame, L0 = F.toLocal(h.p[0], h.p[2]), sg = ${rep} % 2 ? -1 : 1;
  if (!ed.cmd('dragStart', { key: h.key })) return { err: 'no drag on ' + h.key };
  const mv = []; for (let i = 1; i <= ${MOVES}; i++) { const t0 = performance.now(); G.P.host.ground(innerWidth / 2, innerHeight / 2); ed.cmd('dragMove', { x: +(L0[0] + 1.5 * i * sg).toFixed(2), z: L0[1] }); const t1 = performance.now(); await G.raf(); const tB = await G.raf(); mv.push([+(t1 - t0).toFixed(1), +(tB - t0).toFixed(1)]); }
  const r = await G.beat(() => ed.cmd('dragEnd'), ${QUIET}); r.moves = mv; r.key = h.key; return r;` });
const ACTIONS = [
  { name: 'close', js: () => `const r = await G.beat(() => G.P.close(), ${QUIET}); G.P.openEditor(); await G.quiet(performance.now(), 1000, 60000); return r;` },
  { name: 'open', js: () => `G.P.close(); await G.quiet(performance.now(), 800, 30000); return await G.beat(() => G.P.openEditor(), ${QUIET});` },
  sel('road'), sel('area'), sel('site'), sel('object'),
  { name: 'pick', need: 'road', js: T => `const ed = G.P.ed; ed.setTool('select'); ed.select(null); const p = ${JSON.stringify(T.roadPt)}; ed.cmd('click', { x: p[0], z: p[1] }); await G.quiet(performance.now(), 300, 5000);
    return await G.beat(() => ed.cmd('click', { x: p[0], z: p[1] }), ${QUIET});` },
  drag('road', T => T.roadKey), drag('area', () => 'v0'), drag('site', () => 'at'), drag('object', () => 'v0'), drag('strip', () => 'e1'), drag('taxi', () => 'tx0'),
  { name: 'undo', need: 'road', js: () => `return await G.beat(() => G.P.ed.undo(), ${QUIET});` },
  { name: 'redo', need: 'road', js: () => `return await G.beat(() => G.P.ed.redo(), ${QUIET});` },
  { name: 'rotate', need: 'object', js: (T, rep) => `const ed = G.P.ed, id = ${JSON.stringify(T.object)}, e = window.PREMISES_GEN.findById(ed.record(), id).entry; ed.select(id); await G.quiet(performance.now(), 300, 5000);
    return await G.beat(() => ed.cmd('set', { id, patch: { yaw: +((+e.yaw || 0) + (${rep} % 2 ? -0.3 : 0.3)).toFixed(4) } }), ${QUIET});` },
  { name: 'scale', need: 'object', js: (T, rep) => `const ed = G.P.ed, id = ${JSON.stringify(T.object)}; ed.select(id); await G.quiet(performance.now(), 300, 5000);
    return await G.beat(() => ed.cmd('set', { id, patch: { s: ${rep} % 2 ? 1 : 1.2 } }), ${QUIET});` },
  { name: 'delete', need: 'object', js: T => `const ed = G.P.ed, id = ${JSON.stringify(T.object)}; const r = await G.beat(() => ed.cmd('delete', { id }), ${QUIET}); const u = await G.beat(() => ed.undo(), ${QUIET}); r.undo = u; return r;` },
];
// the sliders: each one found in the inspector of its target, by its label (8 input events, then the rest)
const SLIDERS = ['road', 'area', 'site'];
const SLIDE = (k, T, i) => `const ed = G.P.ed, id = ${JSON.stringify(T[k])}; ed.setTool('select'); ed.select(id); await G.quiet(performance.now(), 300, 5000);
  const inps = [...document.querySelectorAll('#premPanel input[type=range]')], inp = inps[${i}]; if (!inp) return { err: 'no slider ${i}' };
  const lab = (inp.parentElement.querySelector('.k') || {}).textContent || '?', lo = +inp.min, hi = +inp.max, v0 = +inp.value, st = +inp.step || (hi - lo) / 100;
  const ticks = [], t0 = performance.now();
  for (let k = 1; k <= 8; k++) { const v = Math.min(hi, Math.max(lo, v0 + (v0 + 8 * st <= hi ? 1 : -1) * k * st)); inp.value = v; const a = performance.now(); inp.dispatchEvent(new Event('input')); ticks.push(+(performance.now() - a).toFixed(1)); await new Promise(r => setTimeout(r, 30)); }
  const r = await G.beat(() => {}, ${QUIET}); r.label = lab; r.ticks = ticks; r.settle = +(performance.now() - t0).toFixed(0);
  inp.value = v0; inp.dispatchEvent(new Event('input')); await G.quiet(performance.now(), ${QUIET}, 30000); return r;`;
const CAMS = ['orbit', 'map', 'fly'];
const CAM = m => `const C = G.P.host.cameras; C.set(${JSON.stringify(m)}); await G.quiet(performance.now(), 500, 10000); const v = C.view(), t0 = performance.now();
  while (performance.now() - t0 < 2000) { const u = (performance.now() - t0) / 2000; C.look(v.yaw + u * 1.2, v.pitch); await G.raf(); }
  const fr = G.fr.filter(x => x[0] > t0).map(x => x[1]).sort((a, b) => a - b), L = G.lt.filter(x => x[0] > t0);
  C.set('orbit'); return { frames: fr.length, p50: +fr[fr.length >> 1].toFixed(1), worstFrame: +fr[fr.length - 1].toFixed(0), longN: L.length, longMax: L.length ? +Math.max(...L.map(x => x[1])).toFixed(0) : 0 };`;

const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : null; };
const mx = a => { const s = a.filter(x => x != null); return s.length ? Math.max(...s) : null; };

// a CPU profile's self time by function, and the stack under the fire (EPfire), inclusive (editor_lag.js's hot())
function hot(p) {
  const byId = new Map(p.nodes.map(n => [n.id, n])), parent = new Map();
  for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const name = cf => (cf.functionName || '(anon)') + ' ' + ((cf.url || '').split('/').pop().split('?')[0] || 'native') + ':' + (cf.lineNumber + 1);
  const self = new Map(), incl = new Map(); let syncUs = 0;
  for (let i = 0; i < p.samples.length; i++) {
    const us = p.timeDeltas[i + 1] || 0, n = byId.get(p.samples[i]); if (!n) continue;
    const k = name(n.callFrame); self.set(k, (self.get(k) || 0) + us);
    const stk = []; for (let id = n.id; id != null; id = parent.get(id)) stk.push(byId.get(id).callFrame);
    if (!stk.some(cf => cf.functionName === 'EPfire')) continue;
    syncUs += us; const seen = new Set(); for (const cf of stk) { const q = name(cf); if (seen.has(q)) continue; seen.add(q); incl.set(q, (incl.get(q) || 0) + us); }
  }
  const top = (m, n) => [...m].filter(x => !/^\((idle|program|garbage collector)\)/.test(x[0])).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, us]) => [k, +(us / 1000).toFixed(1)]);
  return { fn: top(self, 20), syncMs: +(syncUs / 1000).toFixed(1), syncIncl: top(incl, 40) };
}

(async () => {
  if (await MB.serveRoot(PORT)) { console.error('editor_perf: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT, opt('fallback', null)); await sleep(800);
  const root = await MB.serveRoot(PORT);
  if (!root || path.resolve(root) !== REPO) { console.error('editor_perf: the server serves ' + root + ', not ' + REPO); try { srv.kill(); } catch (e) {} process.exit(4); }
  const done = () => { try { srv.kill(); if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', done);
  const R = { date: new Date().toISOString(), file: FILE, trees: TREES, towns: TOWNS, reps: REPS, moves: MOVES, quiet: QUIET, rows: [], meta: [] };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  const want = n => !ONLY || ONLY.some(o => n === o || n.indexOf(o + ':') === 0);
  let b = null;
  for (const T of TREES) for (const town of TOWNS) {
    log('== ' + T.key + ' (' + T.rel + '), town ' + town);
    if (b) await b.close(); b = await MB.browser(UDD);
    const pre = MB.preScript('default') + ';try{localStorage.setItem("flydiy.premises.game.jolene",' + JSON.stringify(TXT) + ')}catch(e){}';
    const l = await b.load('http://localhost:' + PORT + '/' + T.rel + '/' + PAGE + (town === 'on' ? '?town=1' : ''), pre);
    log('loaded ' + l.state + ' in ' + l.sec + ' s'); await sleep(4000);
    log('harness ' + await b.ev(HARNESS, 180000));
    const tg = JSON.parse(await b.ev(TARGETS, 120000)); log('targets ' + JSON.stringify(tg));
    R.meta.push({ tree: T.key, town, load: l, targets: tg, exc: b.exc.slice() });
    const list = ACTIONS.slice();
    for (const k of SLIDERS) if (tg[k]) for (let i = 0; i < 6; i++) list.push({ name: 'slider:' + k + ':' + i, need: k, js: () => SLIDE(k, tg, i) });
    for (const m of CAMS) list.push({ name: 'cam:' + m, js: () => CAM(m) });
    for (const A of list) {
      if (!want(A.name)) continue;
      if (A.need && !tg[A.need]) { R.rows.push({ tree: T.key, town, action: A.name, missing: true }); continue; }
      const reps = []; let prof = null, err = null;
      const n = REPS + (flag('prof') ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const P = flag('prof') && k === 0;
        if (P) { await b.cmd('Profiler.enable'); await b.cmd('Profiler.setSamplingInterval', { interval: 250 }); await b.cmd('Profiler.start'); }
        let raw; try { raw = await b.ev('(async () => { const G = window.__EP; const r = await (async () => { ' + A.js(tg, k) + ' })(); return JSON.stringify(r); })()', 300000); } catch (e) { raw = JSON.stringify({ err: String(e.message || e).split('\n')[0].slice(0, 200) }); }
        const r = raw === '__timeout' ? { err: 'a rep ran past 300 s' } : JSON.parse(raw);
        if (P) { const p = await b.cmd('Profiler.stop'); prof = p.result && p.result.profile ? hot(p.result.profile) : null; await b.cmd('Profiler.disable'); }
        if (r && r.err) { err = r.err; break; }
        if (!P) reps.push(r);
      }
      if (err) { log(A.name.padEnd(22) + ' ' + err); R.rows.push({ tree: T.key, town, action: A.name, err }); save(); continue; }
      const mv = [].concat(...reps.map(r => r.moves || []));
      const row = { tree: T.key, town, action: A.name, label: reps[0] && reps[0].label, sync: med(reps.map(r => r.sync)), syncMax: mx(reps.map(r => r.sync)), frame: med(reps.map(r => r.frame)),
        worstFrame: mx(reps.map(r => r.worstFrame)), longMax: mx(reps.map(r => r.longMax)), settle: med(reps.map(r => r.settle)), move: mv.length ? { med: med(mv.map(m => m[0])), max: mx(mv.map(m => m[0])), frameMax: mx(mv.map(m => m[1])) } : null,
        ticks: reps[0] && reps[0].ticks ? { med: med([].concat(...reps.map(r => r.ticks || []))), max: mx([].concat(...reps.map(r => r.ticks || []))) } : null,
        p50: med(reps.map(r => r.p50)), edits: reps[reps.length - 1] && reps[reps.length - 1].edits, reps, prof };
      R.rows.push(row); save();
      log(A.name.padEnd(22) + (row.label ? ' [' + row.label + ']' : '') + (row.move ? ' move ' + row.move.med + '/' + row.move.max : '') + (row.ticks ? ' tick ' + row.ticks.med + '/' + row.ticks.max : '') +
        (row.sync != null ? '  sync ' + row.sync + '/' + row.syncMax : '') + '  worst frame ' + row.worstFrame + '  long ' + row.longMax + (row.settle != null ? '  settle ' + row.settle : '') + (row.p50 != null ? '  p50 ' + row.p50 : '') +
        (row.edits && row.edits.length ? '  | ' + row.edits.map(e => Math.round(e[0]) + ' ' + String(e[1]).slice(0, 140)).join(' | ') : ''));
    }
    R.meta[R.meta.length - 1].excAfter = b.exc.slice();
  }
  if (b) await b.close();
  save(); console.log('  -> ' + OUT);
  // the table: action -> worst ms -> cause (the slowest edit event's detail)
  console.log('\n  ACTION                  tree/town        worst frame  long task  settle   what ran (the editor\'s own events)');
  for (const r of R.rows) if (!r.missing && !r.err) console.log('  ' + (r.action + (r.label ? ' ' + r.label : '')).slice(0, 23).padEnd(24) + (r.tree + '/' + r.town).padEnd(17) + String(r.worstFrame).padStart(11) + String(r.longMax).padStart(11) + String(r.settle == null ? '-' : r.settle).padStart(8) + '   ' +
    ((r.edits || []).slice().sort((a, b) => b[0] - a[0])[0] || ['', ''])[1].toString().slice(0, 120));
  process.exit(0);
})().catch(e => { console.error('editor_perf: ' + (e && e.stack || e)); process.exit(1); });
