#!/usr/bin/env node
// editor_lag.js - EDITOR-LAG (G1400): THE WORLD EDITOR'S RESPONSE TO A HAND ON AN OBJECT, per tree.
// The user (2026-10-03): "the editor is also far too laggy when handling objects such as taxi points or assets ... like the
// garage, its response time should be gated for regressions." garage_lag.js's method on the game's world editor (app.js
// PREM: premises_host.js + premises_ui.js over render_premises.js): for each tree (a served copy - `git archive <sha> flyDiy
// | tar -x` under <repo>/_ab/<sha>/ - or this worktree's own flyDiy) a FRESH Chrome, the page loaded, the editor opened,
// the fixtures the script needs put in the record (untimed: a stand with three taxi points, a prop, a house, a zone), then
// a fixed script of actions, each --reps times. The hand is the editor's own drag in its three beats (premises_ui cmd
// dragStart / dragMove / dragEnd: the startDrag, moveDrag and onUp its mousedown / mousemove / mouseup run - synthetic
// MouseEvents were tried first and do not land on a handle reliably headless), each move with the host's ground pick.
//   DRAG actions (taxiDrag, propMove, houseMove, runwayEnd, polyVertex): select, dragStart on the handle, --moves
//     moves (1.5 m apart), dragEnd. Per move:
//       move    - the ground pick and the move's handler (sync)
//       mframe  - from the mousemove to the second rAF after it (the moved handle drawn)
//     and the release (the commit: the record's rebuild):
//       up      - the release's handler (the commit);  upFrame - to the second rAF;  busy / settle - the long tasks to quiet (async tails)
//   CLICK actions (taxiAdd, taxiDel): the inspector's button clicked: sync / frame / busy / settle as the release.
// --prof: one extra, untimed rep per action under a CDP CPU profile: self ms by function and by file over the moves, and the
//   release's synchronous stack (inclusive).
// Headless in the cloud: MB_CHROME=<chromium> MB_CHROME_FLAGS="--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader
//   --no-sandbox" (the times are then the CPU's; the box's own are A0's to take).
// Usage: node tools/perf/editor_lag.js --port 8772 --udd D:/uel1 [--trees base=_ab/<sha>/flyDiy,here=flyDiy] [--reps 5]
//          [--moves 8] [--only taxiDrag,propMove] [--prof] [--out file.json] [--page index.html]
// No --help (an unknown flag is ignored).
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const PORT = +opt('port', 0), UDD = opt('udd', null);
if (!PORT || !UDD) { console.error('editor_lag: --port and --udd are required'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..');
const TREES = opt('trees', 'here=flyDiy').split(',').map(s => { const [k, p] = s.split('='); return { key: k, rel: p.replace(/\\/g, '/').replace(/\/$/, '') }; });
const REPS = +opt('reps', 5), MOVES = +opt('moves', 8), QUIET = +opt('quiet', 700), PAGE = opt('page', 'index.html');
const ONLY = opt('only', null) ? new Set(opt('only').split(',')) : null;
const OUT = path.resolve(opt('out', path.join(__dirname, 'editor_lag_' + Date.now() + '.json')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => console.log('  ' + s);

// THE SCRIPT: [name, the fixture it acts on, the handle key (a drag) or the inspector button's text (a click)]
const ACTIONS = [
  { name: 'taxiDrag',   fix: 'rwy',   key: 'tx0' },             // a taxi point of the stand's way out
  { name: 'taxiAdd',    fix: 'rwy',   button: /^add a taxi point/ },
  { name: 'taxiDel',    fix: 'rwy',   button: /^drop the last taxi point/ },
  { name: 'propMove',   fix: 'prop',  key: 'v0' },              // a prop (an asset): its one disc
  { name: 'houseMove',  fix: 'site',  key: 'at' },              // a house (a site): its anchor
  { name: 'runwayEnd',  fix: 'rwy',   key: 'e1' },              // a runway's end
  { name: 'polyVertex', fix: 'zone',  key: 'v0' },              // a polygon's corner (a zone)
].filter(c => !ONLY || ONLY.has(c.name));
// inclusive timers (only while a window is open): dotted paths off window, wrapped when they exist
const WRAP = ['PREMISES_GEN.compose', 'PREMISES_GEN.checks', 'PREMISES_GEN.normalise', 'PREMISES_EDITOR.R.rebuild', 'PREMISES_EDITOR.R.setRecord',
  'PREMISES_EDITOR.R.preview', 'PREMISES_EDITOR.host.ground', 'PREMISES_EDITOR.R.pickHandle', 'WORLD.refreshGround', 'WORLD.repaintStrips', 'PAVEMENT.build'];

// the page side: the editor opened, the fixtures, the hand
const HARNESS = `(async () => { if (window.__EL) return 'again'; const P = window.PREMISES_EDITOR; if (!P) return 'no editor';
  P.openEditor(); for (let i = 0; i < 300 && !P.ed; i++) await new Promise(r => setTimeout(r, 200)); if (!P.ed) return 'the editor did not open';
  const G = window.__EL = { on: false, fn: {}, lt: [], wrapped: [] };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => G.lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: false }); } catch (e) {}
  const get = p => p.split('.').reduce((o, k) => o == null ? o : o[k], window);
  for (const p of ${JSON.stringify(WRAP)}) { const i = p.lastIndexOf('.'), host = i < 0 ? window : get(p.slice(0, i)), k = i < 0 ? p : p.slice(i + 1);
    if (!host || typeof host[k] !== 'function' || host[k].__el) continue; const f = host[k];
    const w = function () { if (!G.on) return f.apply(this, arguments); const t = performance.now(); try { return f.apply(this, arguments); } finally { const r = G.fn[p] || (G.fn[p] = [0, 0]); r[0] += performance.now() - t; r[1]++; } };
    w.__el = 1; try { host[k] = w; G.wrapped.push(p); } catch (e) {} }
  G.raf = () => new Promise(r => requestAnimationFrame(() => r(performance.now())));
  G.quiet = async (t0, q, cap) => { while (true) { await new Promise(r => setTimeout(r, 100)); const now = performance.now(); const L = G.lt.filter(x => x[0] + x[1] > t0);
    const last = L.length ? Math.max(...L.map(x => x[0] + x[1])) : t0; if (now - last >= q || now - t0 > cap) return; } };
  G.ed = P.ed; G.R = P.R; G.host = P.host; G.view = P.view;
  return 'ok ' + G.wrapped.length; })()`;

// the fixtures (untimed): what the record has, else what the script adds - ids answered
const FIXTURES = `(async () => { const G = window.__EL, ed = G.ed, R = G.R, rec = ed.record(), PG = window.PREMISES_GEN, F = R.overlay.frame, out = {};
  // the strip: the first with a stand (the way out), else the first, given a stand and its way out
  let rw = rec.layers.runways.find(r => r.stand && r.taxiOut && r.taxiOut.length) || rec.layers.runways[0];
  if (!rw) return JSON.stringify({ err: 'no runway in the record' });
  out.rwy = rw.id;
  { const E = PG.runwayEnds(Object.assign({}, PG.RUNWAY_DEF, rw)), c = rw.c, nx = -E.d[1], nz = E.d[0];
    const at = (s, o) => [+(c[0] + E.d[0] * s + nx * o).toFixed(2), +(c[1] + E.d[1] * s + nz * o).toFixed(2)];
    if (!rw.stand || !rw.taxiOut || rw.taxiOut.length < 3) { const st = at(-40, 60); ed.cmd('set', { id: rw.id, patch: { stand: { x: st[0], z: st[1], hdg: null }, taxiOut: [at(-30, 45), at(-20, 30), at(-10, 15), at(-10, 0)] } }); }
    out.near = at(0, 80); }
  const near = out.near;
  // a prop (an asset) and a house (a site) beside the strip, a zone
  const PR = typeof propReg === 'function' ? propReg() : null, pkeys = PR ? Object.keys(PR.props) : [];
  let pr = rec.layers.objects.find(o => o.kind === 'prop');
  if (!pr && pkeys.length) { out.propId = ed.cmd('add', { layer: 'objects', entry: { kind: 'prop', key: pkeys.find(k => /crate|barrel|drum|bench|car/i.test(k)) || pkeys[0], x: near[0] + 10, z: near[1], yaw: 0, dy: 0, on: 'ground' } }); }
  else out.propId = pr && pr.id;
  out.prop = out.propId;
  let st = rec.layers.sites.find(s => (s.items || []).some(i => /^house\\//.test(i.key))) || rec.layers.sites[0];
  if (!st && ed.cmd) { const keys = PG.collect(window).keys ? PG.collect(window).keys() : []; const key = keys.find(k => /^house\\//.test(k)) || keys[0];
    if (key) out.siteAdded = ed.cmd('add', { layer: 'sites', entry: { name: 'bench', at: { x: near[0] - 20, z: near[1], yaw: 0 }, items: [{ id: 'i1', key, x: 0, z: 0, yaw: 0, P: {} }], yard: null } }); st = PG.findById(ed.record(), out.siteAdded); st = st && st.entry; }
  out.site = st && st.id;
  let zn = rec.layers.zones[0];
  if (!zn) { const z0 = [near[0] + 40, near[1] + 40]; out.zoneAdded = ed.cmd('add', { layer: 'zones', entry: { kind: 'residential', poly: [[z0[0], z0[1]], [z0[0] + 60, z0[1]], [z0[0] + 60, z0[1] + 60], [z0[0], z0[1] + 60]], density: 0.5, seed: 7 } }); zn = PG.findById(ed.record(), out.zoneAdded).entry; }
  out.zone = zn && zn.id;
  out.n = PG.LAYERS.reduce((a, k) => a + ed.record().layers[k].length, 0);
  await G.quiet(performance.now(), 1500, 60000);
  return JSON.stringify(out); })()`;

// one action, one rep: in the page. A drag: select, frame it in the map, mousedown on the handle, the moves, the mouseup.
const ONE = (A, fixId, moves, quiet, rep) => `(async () => { const G = window.__EL, ed = G.ed, R = G.R, H = G.host, PG = window.PREMISES_GEN;
  const id = ${JSON.stringify(fixId)}, A = ${JSON.stringify({ key: A.key || null, button: A.button ? A.button.source : null })};
  if (ed.selected !== id) { ed.setTool('select'); ed.select(id); }
  const f = PG.findById(ed.record(), id); if (!f) return JSON.stringify({ err: 'no ' + id });
  const was = JSON.stringify(f.entry);
  // the handle's key: a point object's disc is its outline's, v0 (render_premises draws the point's disc as a polygon's corner)
  const hs = R.handles(id); const h = hs.find(q => q.key === A.key) || (A.key === 'v0' ? hs[0] : null);
  G.fn = {}; await G.quiet(performance.now(), 300, 6000);
  if (A.button) {
    const re = new RegExp(A.button), b = [...document.querySelectorAll('#premPanel button')].find(x => re.test(x.textContent.trim()));
    if (!b) return JSON.stringify({ err: 'no button ' + A.button });
    G.on = true; const t0 = performance.now(); (function ELfire() { b.click(); })(); const t1 = performance.now();
    await G.raf(); const tB = await G.raf(); await G.quiet(t0, ${quiet}, 15000); G.on = false;
    const L = G.lt.filter(x => x[0] + x[1] > t0 - 1); const end = L.length ? Math.max(...L.map(x => x[0] + x[1])) : t1;
    return JSON.stringify({ up: +(t1 - t0).toFixed(1), upFrame: +(tB - t0).toFixed(1), busy: +L.reduce((a, x) => a + x[1], 0).toFixed(0), maxLong: L.length ? +Math.max(...L.map(x => x[1])).toFixed(0) : 0, settle: +(end - t0).toFixed(0), fn: G.fn, t0 });
  }
  if (!h) return JSON.stringify({ err: 'no handle ' + A.key + ' on ' + id + ' (' + hs.map(q => q.key).join(',') + ')' });
  // the hand: the editor's own drag in its three beats (premises_ui cmd dragStart / dragMove / dragEnd - the startDrag,
  // moveDrag and onUp the mouse runs), each move with the host's ground pick (the ray's march, the mouse's per-move
  // cost before moveDrag) taken at the view's centre
  const F = R.overlay.frame, L0 = F.toLocal(h.p[0], h.p[2]);
  const dir = A.key === 'e1' || A.key === 'e0' ? (E => [-E.d[1], E.d[0]])(PG.runwayEnds(Object.assign({}, PG.RUNWAY_DEF, f.entry))) : [1, 0];
  const sgn = ${rep} % 2 ? -1 : 1, cx = innerWidth / 2, cy = innerHeight / 2;
  if (!ed.cmd('dragStart', { key: h.key })) return JSON.stringify({ err: 'the drag did not start on ' + h.key });
  const mv = [];
  for (let k = 1; k <= ${moves}; k++) {
    const lx = +(L0[0] + dir[0] * 1.5 * k * sgn).toFixed(2), lz = +(L0[1] + dir[1] * 1.5 * k * sgn).toFixed(2);
    G.on = true; const t0 = performance.now(); (function ELfire() { H.ground(cx, cy); ed.cmd('dragMove', { x: lx, z: lz }); })(); const t1 = performance.now();
    await G.raf(); const tB = await G.raf(); G.on = false;
    mv.push([+(t1 - t0).toFixed(1), +(tB - t0).toFixed(1)]);
  }
  const fnMove = G.fn; G.fn = {};
  G.on = true; const t0 = performance.now(); (function ELfire() { ed.cmd('dragEnd'); })(); const t1 = performance.now();
  await G.raf(); const tB = await G.raf(); await G.quiet(t0, ${quiet}, 15000); G.on = false;
  const L = G.lt.filter(x => x[0] + x[1] > t0 - 1); const end = L.length ? Math.max(...L.map(x => x[0] + x[1])) : t1;
  const after = PG.findById(ed.record(), id);
  return JSON.stringify({ moves: mv, fnMove, up: +(t1 - t0).toFixed(1), upFrame: +(tB - t0).toFixed(1), busy: +L.reduce((a, x) => a + x[1], 0).toFixed(0),
    maxLong: L.length ? +Math.max(...L.map(x => x[1])).toFixed(0) : 0, settle: +(end - t0).toFixed(0), fn: G.fn, moved: JSON.stringify(after && after.entry) !== was, t0 });
})()`;

const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const S = a => ({ med: med(a), max: a.length ? Math.max(...a) : null });

// a CPU profile's self time (by function and by file), and the stack under the fire (ELfire: the input's own handlers)
function hot(p) {
  const byId = new Map(p.nodes.map(n => [n.id, n])), parent = new Map();
  for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const name = cf => (cf.functionName || '(anon)') + ' ' + ((cf.url || '').split('/').pop().split('?')[0] || 'native') + ':' + (cf.lineNumber + 1);
  const self = new Map(), file = new Map(), incl = new Map();
  let syncUs = 0, gc = 0;
  for (let i = 0; i < p.samples.length; i++) {
    const us = p.timeDeltas[i + 1] || 0, n = byId.get(p.samples[i]); if (!n) continue;
    const k = name(n.callFrame); self.set(k, (self.get(k) || 0) + us);
    const f = (n.callFrame.url || '').split('/').pop().split('?')[0] || '(' + (n.callFrame.functionName || 'native') + ')'; file.set(f, (file.get(f) || 0) + us);
    if (/garbage/.test(n.callFrame.functionName)) gc += us;
    const stk = []; for (let id = n.id; id != null; id = parent.get(id)) stk.push(byId.get(id).callFrame);
    if (!stk.some(cf => cf.functionName === 'ELfire')) continue;
    syncUs += us;
    const seen = new Set(); for (const cf of stk) { const q = name(cf); if (seen.has(q)) continue; seen.add(q); incl.set(q, (incl.get(q) || 0) + us); }
  }
  const top = (m, n) => [...m].filter(x => !/^\((idle|program|garbage collector)\)/.test(x[0])).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, us]) => [k, +(us / 1000).toFixed(1)]);
  return { fn: top(self, 25), file: top(file, 12), gcMs: +(gc / 1000).toFixed(1), syncMs: +(syncUs / 1000).toFixed(1), syncIncl: top(incl, 50) };
}

(async () => {
  if (await MB.serveRoot(PORT)) { console.error('editor_lag: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT, opt('fallback', null)); await sleep(800);
  const root = await MB.serveRoot(PORT);
  if (!root || path.resolve(root) !== REPO) { console.error('editor_lag: the server serves ' + root + ', not ' + REPO); try { srv.kill(); } catch (e) {} process.exit(4); }
  const done = () => { try { srv.kill(); if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', done);
  const R = { date: new Date().toISOString(), trees: TREES, reps: REPS, moves: MOVES, quiet: QUIET, udd: UDD, page: PAGE, headless: /headless/.test(process.env.MB_CHROME_FLAGS || ''), rows: [], meta: [] };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  let b = null;
  for (const T of TREES) {
    log('== ' + T.key + ' (' + T.rel + ')');
    if (b) await b.close(); b = await MB.browser(UDD);
    const l = await b.load('http://localhost:' + PORT + '/' + T.rel + '/' + PAGE, MB.preScript('default'));
    log('loaded ' + l.state + ' in ' + l.sec + ' s');
    await sleep(4000);
    log('harness ' + await b.ev(HARNESS, 120000));
    const fx = JSON.parse(await b.ev(FIXTURES, 120000));
    log('fixtures ' + JSON.stringify(fx));
    R.meta.push({ tree: T.key, load: l, fixtures: fx, exc: b.exc.slice() });
    for (const A of ACTIONS) {
      const id = fx[A.fix];
      if (!id) { log(A.name.padEnd(11) + ' NO FIXTURE'); R.rows.push({ tree: T.key, action: A.name, missing: true }); continue; }
      const reps = []; let prof = null, err = null;
      const n = REPS + (flag('prof') ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const P = flag('prof') && k === 0;
        if (P) { await b.cmd('Profiler.enable'); await b.cmd('Profiler.setSamplingInterval', { interval: 250 }); await b.cmd('Profiler.start'); }
        const raw = await b.ev(ONE(A, id, MOVES, QUIET, k), 240000), r = raw === '__timeout' ? { err: 'a rep ran past 240 s' } : JSON.parse(raw);
        if (P) { const p = await b.cmd('Profiler.stop'); prof = p.result && p.result.profile ? hot(p.result.profile) : null; await b.cmd('Profiler.disable'); }
        if (r.err) { err = r.err; break; }
        if (!P) reps.push(r);
      }
      if (err) { log(A.name.padEnd(11) + ' ' + err); R.rows.push({ tree: T.key, action: A.name, err }); save(); continue; }
      const mv = [].concat(...reps.map(r => r.moves || []));
      const fnSum = {}; for (const r of reps) for (const k in r.fn) { const a = fnSum[k] || (fnSum[k] = [0, 0]); a[0] += r.fn[k][0] / reps.length; a[1] += r.fn[k][1] / reps.length; }
      const fnMove = {}; for (const r of reps) for (const k in r.fnMove || {}) { const a = fnMove[k] || (fnMove[k] = [0, 0]); a[0] += r.fnMove[k][0] / mv.length; a[1] += r.fnMove[k][1] / mv.length; }
      for (const o of [fnSum, fnMove]) for (const k in o) o[k] = [+o[k][0].toFixed(2), +o[k][1].toFixed(2)];
      const row = { tree: T.key, action: A.name, fixture: id, kind: A.button ? 'click' : 'drag',
        move: mv.length ? S(mv.map(m => m[0])) : null, mframe: mv.length ? S(mv.map(m => m[1])) : null,
        up: S(reps.map(r => r.up)), upFrame: S(reps.map(r => r.upFrame)), busy: S(reps.map(r => r.busy)), settle: S(reps.map(r => r.settle)), maxLong: S(reps.map(r => r.maxLong)),
        moved: reps.every(r => r.moved !== false), fnMove, fn: fnSum, reps, prof };
      R.rows.push(row); save();
      log(A.name.padEnd(11) + (row.move ? ' move ' + row.move.med + '/' + row.move.max + '  mframe ' + row.mframe.med + '/' + row.mframe.max : '') +
        '  ' + (A.button ? 'click' : 'up') + ' ' + row.up.med + '/' + row.up.max + '  frame ' + row.upFrame.med + '/' + row.upFrame.max + '  busy ' + row.busy.med + '/' + row.busy.max + '  settle ' + row.settle.med + '/' + row.settle.max + (row.moved ? '' : '  (DID NOT MOVE)'));
    }
    R.meta[R.meta.length - 1].excAfter = b.exc.slice();
  }
  if (b) await b.close();
  save(); console.log('  -> ' + OUT);
  process.exit(0);
})().catch(e => { console.error('editor_lag: ' + (e && e.stack || e)); process.exit(1); });
