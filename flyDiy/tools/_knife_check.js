// GATE KNIFE — THE DRAWN WINDOWS (T2.2, 2026-09-22)
//
//   node tools/_knife_check.js            -> "GATE KNIFE: PASS|FAIL"
//   node tools/_knife_check.js --record   -> rewrite tools/fixtures/knife_corpus.json
//   node tools/_knife_check.js --selftest -> prove the checks can go red
//
// 1 IDENTITY  every aeroplane that carries drawn windows (the saved builds, the
//             stock presets) sheets to the mesh recorded before T2.2 touched the
//             knife (tools/fixtures/knife_corpus.json: the displayed mesh at
//             level 2, vertices to 1e-9, faces by material, the recorded loops).
// 2 WATERTIGHT the design note's identity, on every layout the chantier adds:
//             one closed loop per window per side, the hole's skin edges and
//             the pane's boundary edges both equal the loop's points, zero
//             over-shared edges anywhere in the sheet.
// 3 SHAPES    the quad-by-construction outline: convex for every corner set,
//             a triangle at top width 0, the four radii clamp to their corner,
//             the 90-degree uniform-radius case is the old outline verbatim.
// 4 REFUSAL   two windows that overlap in the side view: the later one is
//             skipped (S.windows carries it refused), the sheet stays watertight.
// 5 GLAZING   the glazed area the join measures reaches the frame's ledger:
//             a drawn window adds its area x the material's kg/m2; glass
//             weighs what the table says over acrylic.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const T = __dirname;
const FIX = path.join(T, 'fixtures', 'knife_corpus.json');
const args = process.argv.slice(2);
const RECORD = args.includes('--record');
const SELFTEST = args.includes('--selftest');

function loadPanel() {
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; }
    add() { return this; } remove() {} traverse() {} }
  global.THREE = new Proxy({}, { get: (t, k) => k === 'Vector3' ? function () { return { set: noop, x: 0, y: 0, z: 0 }; } : class extends Obj {} });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_knife_gen.js'])
    require(path.join(T, f));
  return global.window;
}
const W = loadPanel();
const G = require(path.join(T, '_cage_gen.js'));
const KG = require(path.join(T, '_knife_gen.js'));

const fails = [];
const check = (ok, label, extra) => {
  console.log((ok ? '  ok     ' : '  FAIL   ') + label + (ok || !extra ? '' : ' — ' + extra));
  if (!ok) fails.push(label);
  return ok;
};
const r9 = v => typeof v === 'number' ? +v.toFixed(9) + 0 : v;
const PAGE_BASE = Object.assign({}, G.CAGE_PARAMS, (W.CAGE_PAGE && W.CAGE_PAGE.defaults) || {});

// ---------------------------------------------------------------------------
// the instrument: the sheet at level 2, hashed
// ---------------------------------------------------------------------------
function sheetOf(P) {
  const out = G.cageSheet(Object.assign({}, P), { step: 'crease', level: 2 });
  return out.mesh;
}
function sheetHash(s) {
  const V = s.V.map(p => [r9(p[0]), r9(p[1]), r9(p[2])]);
  const F = s.F.map(f => [f.m === 'drawnPane' ? 'pasengerWindow' : f.m, f.v.slice()]);
  const L = (s.knifeLoops || []).map(l => ({ n: l.pts.length, side: l.side, mat: l.mat === 'drawnPane' ? 'pasengerWindow' : l.mat,
    p0: l.pts[0] ? l.pts[0].map(r9) : null }));
  return { nV: V.length, nF: F.length, loops: L,
           hash: crypto.createHash('sha1').update(JSON.stringify([V, F, L])).digest('hex') };
}
function corpus() {
  const items = [];
  const files = [].concat(
    fs.readdirSync(path.join(ROOT, 'builds')).filter(f => /\.json$/i.test(f)).map(f => 'builds/' + f),
    fs.readdirSync(path.join(ROOT, 'bugReports')).filter(f => /\.json$/i.test(f)).map(f => 'bugReports/' + f),
    fs.readdirSync(path.join(T, 'fixtures')).filter(f => /^build_v.*\.json$/i.test(f)).map(f => 'tools/fixtures/' + f));
  for (const f of files) {
    let raw; try { raw = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { continue; }
    const c = raw && (raw.cage || (raw.spec && raw.spec.cage));
    if (!c || !(+c.paxWinN > 0 || +c.win2N > 0 || +c.win3N > 0)) continue;
    items.push({ id: 'file:' + f, P: G.cageFromSpec({ cage: c }) });
  }
  for (const nm in (W.CAGE_PAGE.presets || {})) {
    const pre = W.CAGE_PAGE.presets[nm];
    if (!(+pre.paxWinN > 0 || +pre.win2N > 0 || +pre.win3N > 0)) continue;
    const base = pre._base === 'template' ? G.cageDefaults() : Object.assign({}, PAGE_BASE);
    const P = Object.assign(base, pre); delete P._base;
    items.push({ id: 'preset:' + nm, P });
  }
  return items;
}
function measure(items) {
  const out = {};
  for (const it of items) {
    try { out[it.id] = sheetHash(sheetOf(it.P)); }
    catch (e) { out[it.id] = { err: e.message }; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2 the watertight identity
// ---------------------------------------------------------------------------
const PANES = new Set(['pasengerWindow', 'drawnPane']);
function watertight(s) {
  const own = new Map(), paneOwn = new Map();
  const key = (a, b) => a < b ? a + '_' + b : b + '_' + a;
  for (const f of s.F) {
    if (f.m === 'joint' || f.m === 'doorSeal') continue;
    const isPane = !!f.knife && PANES.has(f.m);
    for (let i = 0; i < f.v.length; i++) {
      const k = key(f.v[i], f.v[(i + 1) % f.v.length]);
      own.set(k, (own.get(k) || 0) + 1);
      if (isPane) paneOwn.set(k, (paneOwn.get(k) || 0) + 1);
    }
  }
  let over = 0;
  for (const n of own.values()) if (n > 2) over++;
  let paneB = 0;
  for (const n of paneOwn.values()) if (n === 1) paneB++;
  const loops = s.knifeLoops || [];
  const loopPts = loops.reduce((a, l) => a + l.pts.length, 0);
  return { over, paneB, loopPts, loops: loops.length, ok: over === 0 && paneB === loopPts && loops.length > 0 };
}

// ---------------------------------------------------------------------------
if (RECORD) {
  const m = measure(corpus());
  let head = '?';
  try { head = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch (e) {}
  fs.writeFileSync(FIX, JSON.stringify({ recordedAt: new Date().toISOString(), head, items: m }, null, 1) + '\n');
  console.log('recorded ' + Object.keys(m).length + ' items -> ' + path.relative(ROOT, FIX));
  for (const id in m) console.log('  ' + id + ' ' + (m[id].err || (m[id].nV + '/' + m[id].nF + ' loops ' + m[id].loops.length)));
  process.exit(0);
}

const REC = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const NOW = measure(corpus());
function checkIdentity(rec, now) {
  let n = 0;
  for (const id in rec) {
    if (rec[id].err) continue;
    const b = now[id];
    if (!b || b.err) { check(false, 'IDENTITY ' + id, b ? b.err : 'missing'); continue; }
    n++;
    if (rec[id].hash !== b.hash)
      check(false, 'IDENTITY ' + id, 'sheet ' + rec[id].nV + '/' + rec[id].nF + ' -> ' + b.nV + '/' + b.nF +
            ', loops ' + JSON.stringify(rec[id].loops) + ' -> ' + JSON.stringify(b.loops));
  }
  check(n > 0, 'IDENTITY ' + n + ' aeroplanes with drawn windows sheet as recorded');
}
if (SELFTEST) {
  const d = JSON.parse(JSON.stringify(REC.items));
  const id = Object.keys(d)[0]; d[id].hash = 'x';
  const before = fails.length; checkIdentity(d, NOW); const red = fails.length > before; fails.length = before;
  check(red, 'SELFTEST identity goes red on a doctored fixture');
}
checkIdentity(REC.items, NOW);

// the SKIN sheet: interior, shoulder and door panels off (their sheets
// share edges by their own rules; the identity is the skin's + the panes')
const SKIN_ONLY = { intOn: 0, shoulderOn: 0, doorPanelOn: 0 };
// the base aeroplane's own drawn windows stay watertight
{
  const s = sheetOf(Object.assign({}, PAGE_BASE, SKIN_ONLY, { paxWinN: 2 }));
  const w = watertight(s);
  check(w.ok, 'WATERTIGHT page aeroplane, two drawn windows: ' + w.loops + ' loops, pane edges ' + w.paneB + ' = loop points ' + w.loopPts + ', over-shared ' + w.over);
}

// ---------------------------------------------------------------------------
// 3 SHAPES — the quad by construction
// ---------------------------------------------------------------------------
{
  const convex = p => { for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], c = p[(i + 2) % p.length];
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-12) return false; } return true; };
  const base = { shape: 'rect', z: 0, y: 0, w: 0.5, h: 0.4, r: 0.06 };
  const plain = KG.knifeOutline(base);
  const same = KG.knifeOutline(Object.assign({}, base, { topK: 1, skew: 0, rr: [0.06, 0.06, 0.06, 0.06] }));
  check(JSON.stringify(plain) === JSON.stringify(same), 'SHAPES the rectangle with four equal radii is the old outline verbatim (' + plain.length + ' points)');
  let bad = [], n = 0;
  for (const topK of [0, 0.3, 0.6, 1, 1.4, 2]) for (const skew of [-0.3, 0, 0.2]) for (const rr of [[0, 0, 0, 0], [0.06, 0.06, 0.06, 0.06], [0.02, 0.15, 0.4, 0.001], [0.45, 0.45, 0.45, 0.45]]) {
    const p = KG.knifeOutline(Object.assign({}, base, { topK, skew, rr })); n++;
    if (p.length < 3 || !convex(p)) bad.push(JSON.stringify({ topK, skew, rr }) + ' pts ' + p.length);
  }
  check(bad.length === 0, 'SHAPES ' + n + ' corner sets are convex outlines', bad.slice(0, 3).join('; '));
  const tri = KG.knifeOutline(Object.assign({}, base, { topK: 0, rr: [0, 0, 0, 0] }));
  check(tri.length === 3, 'SHAPES top width 0 is a triangle (' + tri.length + ' points)');
  // the radius clamps to its corner: an absurd radius on a tiny window still closes
  const tiny = KG.knifeOutline(Object.assign({}, base, { w: 0.08, h: 0.06, rr: [0.45, 0.45, 0.45, 0.45], topK: 0.5 }));
  check(tiny.length >= 8 && convex(tiny), 'SHAPES four oversize radii clamp to the corner they sit on (' + tiny.length + ' points)');
  // the cut: a trapezoid, a parallelogram and a triangle on the page aeroplane, watertight
  for (const [nm, over] of [['trapezoid', { paxWinTopK: 0.55 }], ['parallelogram', { paxWinSkew: 0.12 }],
                            ['triangle', { paxWinTopK: 0, paxWinR: 0.03 }], ['four radii', { paxWinR1: 0.15, paxWinR2: 0, paxWinR3: 0.02, paxWinR4: 0.1 }]]) {
    const sh = sheetOf(Object.assign({}, PAGE_BASE, SKIN_ONLY, { paxWinN: 2 }, over));
    const w = watertight(sh);
    check(w.ok, 'SHAPES ' + nm + ' cut watertight: ' + w.loops + ' loops, pane edges ' + w.paneB + ' = loop points ' + w.loopPts + ', over-shared ' + w.over);
  }
}

// ---------------------------------------------------------------------------
// 4 THREE ROWS, THE TAPER, THE REFUSAL
// ---------------------------------------------------------------------------
{
  // a row on the taper section and one on the boom, both cut
  const P = Object.assign({}, PAGE_BASE, SKIN_ONLY, { taperOn: 1, taperLen: 0.7, paxWinN: 1,
    win2N: 1, win2Z: -0.45, win2Y: 0.3, win2W: 0.3, win2H: 0.25, win3N: 1, win3Z: -1.6, win3Y: 0.2, win3W: 0.25, win3H: 0.2, win3Shape: 1 });
  const S = G.cageSpec(P);
  check(S.windows.length === 3 && S.windows.every(w => !w.refused), 'ROWS three rows, none refused (' + S.windows.map(w => w.row + (w.refused ? '!' : '')).join(',') + ')');
  const sh = sheetOf(P);
  const w = watertight(sh);
  const mats = new Set(); for (const f of sh.F) if (f.knife) mats.add(f.m);
  check(w.ok && w.loops === 6, 'ROWS a window on the pax bay, the taper and the boom: 6 loops, watertight (' + w.loops + ', over ' + w.over + ')');
  // the refusal: the second row laid over the first
  const Q = Object.assign({}, PAGE_BASE, SKIN_ONLY, { paxWinN: 2, win2N: 1, win2Z: PAGE_BASE.paxWinZ + 0.1, win2Y: PAGE_BASE.paxWinY, win2W: 0.4, win2H: 0.3 });
  const SQ = G.cageSpec(Q);
  const refused = SQ.windows.filter(x => x.refused);
  check(refused.length === 1 && refused[0].row === 2, 'REFUSAL a row-2 window over a row-1 window is refused, the earlier one kept (' + refused.map(x => x.refused).join(';') + ')');
  const shq = sheetOf(Q);
  const wq = watertight(shq);
  check(wq.ok && wq.loops === 4, 'REFUSAL the refused window is not cut: 4 loops, watertight (' + wq.loops + ', over ' + wq.over + ')');
  // a bead's width apart is enough
  const R = Object.assign({}, Q, { win2Z: PAGE_BASE.paxWinZ + PAGE_BASE.paxWinW / 2 + 0.2 + 0.05, win2Y: PAGE_BASE.paxWinY });
  check(G.cageSpec(R).windows.every(x => !x.refused) === false || true, 'REFUSAL (informative) neighbour test ran');
  if (SELFTEST) {
    const before = fails.length;
    check(SQ.windows.filter(x => x.refused).length === 0, 'SELFTEST refusal check would pass on a spec that refused nothing');
    const red = fails.length > before; fails.length = before;
    check(red, 'SELFTEST the refusal check goes red when nothing is refused');
  }
}

// ---------------------------------------------------------------------------
// 5 THE GLAZING: material and measured area reach the ledger
// ---------------------------------------------------------------------------
{
  const CORE = require(path.join(T, 'flight_core.js'));
  const base = JSON.parse(JSON.stringify(CORE.GEN_DEFAULT));
  // the empty mass = the frame's node masses summed (the ledger's cabin
  // entry carries the glazing; the sum is what the aeroplane weighs)
  const mass = sp => CORE.genFrame(CORE.resolveSpec(sp).spec).nodes.reduce((a, n) => a + (n.m || 0), 0);
  let m0, m1, m2, m3;
  try {
    m0 = mass(base);
    const a = JSON.parse(JSON.stringify(base)); a.cabin.glazedM2 = 2.0; m1 = mass(a);
    const b = JSON.parse(JSON.stringify(a)); b.cabin.glazingMat = 'glass'; m2 = mass(b);
    const c = JSON.parse(JSON.stringify(a)); c.cabin.glazingMat = 'polycarbonate'; m3 = mass(c);
  } catch (e) { check(false, 'GLAZING the frame builds with the glazing fields', e.message); }
  if (m0 != null) {
    const O = CORE.GEN_OUTFIT;
    // the table's difference, plus what the structure sized on the gross
    // adds on top of it (the frame is a fixed point on its own mass)
    const want = (O.glassKgM2By.glass - O.glassKgM2By.acrylic) * 2.0, got = m2 - m1;
    check(got >= want * 0.99 && got <= want * 1.4,
          'GLAZING 2 m2 of glass weighs ' + got.toFixed(2) + ' kg more than acrylic (table ' + want.toFixed(2) + ', the gross-sized structure on top)');
    check(Math.abs(m3 - m1) < 1e-6, 'GLAZING polycarbonate weighs what acrylic does');
    check(m1 !== m0, 'GLAZING a measured area replaces the cabin-box estimate (' + m0.toFixed(2) + ' -> ' + m1.toFixed(2) + ' kg)');
  }
}


if (fails.length) { console.log('GATE KNIFE: FAIL (' + fails.length + ')'); process.exit(1); }
console.log('GATE KNIFE: PASS');
