#!/usr/bin/env node
// GATE QUADWIN - THE FREE QUAD WINDOW (WINDOWS-FREE, 2026-10-27).
//
//   node tools/_quadwin_check.js            -> "GATE QUADWIN: PASS|FAIL"
//   node tools/_quadwin_check.js --selftest -> each judged row broken at its source, each must go red
//
// The user: "Today a window ... can't follow the Cub's angled wing line. EXTEND that system - no parallel one: a new
// window shape 'quad': 4 corners each placed freely in the side view (z, y per corner, snapped onto the skin) + each
// corner's own rounding (the existing R1-R4) ... The refusal test assumes convex outlines - extend it (or refuse
// non-convex quads with a clear message), the sheet must stay watertight. Old files load byte-identical." Rows:
//   1 FOLLOW    a row switched to 'quad' with no corner placed IS its rectangle (topK, skew and the four radii
//               included): the outlines match to a sample step, and the cut is watertight
//   2 CORNERS   the test quad (the Cub's rear window, tools/fixtures/cub_quadwin_2026-10.json) cut into the Cub's own
//               sheet: one closed loop a flank, watertight, and each corner lands where it was put - read off the
//               CUT LOOP (the knife's own on-skin outline), in the side view: a sharp corner within 2.5 mm of its
//               point, a rounded one at the arc's distance from it (r (1/sin(theta/2) - 1)) within 2.5 mm, and no
//               loop point outside the asked quad
//   3 FORE PART the quad's fore edge and wing-line top edge lie on the old window's (the band glass the Cub drew):
//               every loop point clear of the aft roundings within 3 mm of the old edges
//   4 REFUSAL   a concave quad and a crossed (bow-tie) quad are refused with their reason, never cut; the sheet
//               stays watertight and the row's other windows cut
//   5 SAVE      a build with no quad carries no corner row (cageToSpec), and the corners save and load back exact
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(__dirname, '..');
const SELFTEST = process.argv.includes('--selftest');

function loadPanel() {
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; }
    add() { return this; } remove() {} traverse() {} }
  global.THREE = new Proxy({}, { get: (t, k) => k === 'Vector3' ? function () { return { set: noop, x: 0, y: 0, z: 0 }; } : class extends Obj {} });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_knife_gen.js']) require(path.join(T, f));
  return global.window;
}
const W = loadPanel();
const G = require(path.join(T, '_cage_gen.js'));
const KG = require(path.join(T, '_knife_gen.js'));
const PAGE_BASE = Object.assign({}, G.CAGE_PARAMS, (W.CAGE_PAGE && W.CAGE_PAGE.defaults) || {});
const SKIN_ONLY = { intOn: 0, shoulderOn: 0, doorPanelOn: 0 };
const BREAK = {};

let fails = [], n = 0;
const check = (ok, label, info) => { n++; console.log((ok ? '  ok     ' : '  FAIL   ') + label + (info != null ? '  [' + info + ']' : '')); if (!ok) fails.push(label); return ok; };
const sheetOf = P => G.cageSheet(Object.assign({}, P), { step: 'crease', level: 2 }).mesh;
// GATE KNIFE's watertight identity, verbatim (tools/_knife_check.js): one closed loop per window per side, the
// pane's boundary edges equal the loops' points, no edge over-shared
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
  let over = 0; for (const c of own.values()) if (c > 2) over++;
  let paneB = 0; for (const c of paneOwn.values()) if (c === 1) paneB++;
  const loops = s.knifeLoops || [];
  const loopPts = loops.reduce((a, l) => a + l.pts.length, 0);
  return { over, paneB, loopPts, loops: loops.length, ok: over === 0 && paneB === loopPts && loops.length > 0 };
}
// the Hausdorff distance of two closed polylines (side view)
function segD(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}
const polyD = (p, L) => { let d = Infinity; for (let i = 0; i < L.length; i++) d = Math.min(d, segD(p, L[i], L[(i + 1) % L.length])); return d; };
const haus = (A, B) => Math.max(Math.max(...A.map(p => polyD(p, B))), Math.max(...B.map(p => polyD(p, A))));
const inside = (p, Q, tol) => {           // p inside the convex CCW polygon Q, within tol
  for (let i = 0; i < Q.length; i++) {
    const a = Q[i], b = Q[(i + 1) % Q.length];
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (c / Math.hypot(b[0] - a[0], b[1] - a[1]) < -tol) return false;
  }
  return true;
};
const ccw = Q => { let a = 0; for (let i = 0; i < Q.length; i++) { const p = Q[i], q = Q[(i + 1) % Q.length]; a += p[0] * q[1] - q[0] * p[1]; } return a > 0 ? Q : Q.slice().reverse(); };

function run() {
  // ---- 1 FOLLOW ---------------------------------------------------------------------------------------------
  for (const [nm, over] of [['plain', {}], ['trapezoid', { paxWinTopK: 0.55 }], ['parallelogram', { paxWinSkew: 0.12 }],
                            ['four radii', { paxWinR1: 0.15, paxWinR2: 0, paxWinR3: 0.02, paxWinR4: 0.1 }]]) {
    const P = Object.assign({}, PAGE_BASE, SKIN_ONLY, { paxWinN: 1 }, over);
    const rect = G.cageSpec(P).windows[0];
    const quad = G.cageSpec(Object.assign({}, P, { paxWinShape: 2 })).windows[0];
    const d = haus(KG.knifeOutline(rect), KG.knifeOutline(quad));
    check(quad.shape === 'quad' && !quad.refused && d < 0.013, '1 FOLLOW ' + nm + ': the unplaced quad is its rectangle',
      'outlines ' + (d * 1000).toFixed(2) + ' mm apart (cage units)');
    const w = watertight(sheetOf(Object.assign({}, P, { paxWinShape: 2 })));
    check(w.ok && w.loops === 2, '1 FOLLOW ' + nm + ': cut watertight', w.loops + ' loops, over-shared ' + w.over);
  }

  // ---- 2 CORNERS, on the Cub ----------------------------------------------------------------------------------
  const fix = JSON.parse(fs.readFileSync(path.join(T, 'fixtures', 'cub_quadwin_2026-10.json'), 'utf8'));
  const cub = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), 'utf8'));
  const Pq = Object.assign({}, G.cageFromSpec(fix.spec || fix), SKIN_ONLY);
  const Po = Object.assign({}, G.cageFromSpec(cub.spec || cub), SKIN_ONLY);
  const S = G.cageSpec(Pq), win = S.windows.find(w => w.row === 1);
  check(win && win.shape === 'quad' && !win.refused, '2 the Cub\'s rear window is a quad, not refused', win && win.refused);
  const sh = sheetOf(Pq), wt = watertight(sh);
  check(wt.ok && wt.loops === 2, '2 the Cub\'s quad cuts watertight, one loop a flank', wt.loops + ' loops, pane edges ' + wt.paneB + ' = loop points ' + wt.loopPts + ', over-shared ' + wt.over);
  const asked = win.corners.map(c => [c[0] + (BREAK.corner || 0), c[1]]);
  const rr = win.rr;
  for (const side of [1, -1]) {
    const loop = (sh.knifeLoops || []).find(l => l.side === side);
    if (!check(!!loop, '2 the ' + (side > 0 ? 'starboard' : 'port') + ' loop')) continue;
    const L = loop.pts.map(p => [p[2], p[1]]);           // the side view (z, y), cage units
    const Q = ccw(asked);
    const qi = Q === asked ? [0, 1, 2, 3] : [3, 2, 1, 0];
    for (let k = 0; k < 4; k++) {
      const P0 = asked[k], A = asked[(k + 3) % 4], B = asked[(k + 1) % 4];
      const e1 = [A[0] - P0[0], A[1] - P0[1]], e2 = [B[0] - P0[0], B[1] - P0[1]];
      const la = Math.hypot(...e1), lb = Math.hypot(...e2);
      const th = Math.acos(Math.max(-1, Math.min(1, (e1[0] * e2[0] + e1[1] * e2[1]) / (la * lb))));
      const r = Math.min(rr[k], Math.min(la, lb) / 2 * Math.tan(th / 2));
      const want = r > 1e-6 ? r * (1 / Math.sin(th / 2) - 1) : 0;
      const got = Math.min(...L.map(p => Math.hypot(p[0] - P0[0], p[1] - P0[1])));
      check(Math.abs(got - want) < 0.0025 / Pq.planeScale / (G.CAGE_UNIT || 1), '2 ' + (side > 0 ? 'stbd' : 'port') + ' corner Q' + (k + 1) +
        ' lands where it was put (r ' + r.toFixed(3) + ')', 'arc ' + (got * 1000).toFixed(1) + ' mm from the corner, wants ' + (want * 1000).toFixed(1) + ' mm (cage units)');
    }
    const out = L.filter(p => !inside(p, Q, 0.002)).length;
    check(out === 0, '2 ' + (side > 0 ? 'stbd' : 'port') + ': no loop point outside the asked quad', out + ' outside');
  }

  // ---- 3 FORE PART: the old window's fore and wing-line edges ------------------------------------------------
  {
    const so = sheetOf(Po);
    // the band glass's own outline, starboard: its boundary edges
    const E = new Map();
    for (const f of so.F) {
      if (f.m !== 'pasengerWindow' || f.v.reduce((a, i) => a + so.V[i][0], 0) <= 0) continue;
      for (let e = 0; e < f.v.length; e++) { const a = f.v[e], b = f.v[(e + 1) % f.v.length]; const k = a < b ? a + '|' + b : b + '|' + a; E.set(k, (E.get(k) || 0) + 1); }
    }
    const segs = [...E].filter(([k, c]) => c === 1).map(([k]) => k.split('|').map(i => [so.V[+i][2], so.V[+i][1]]));
    let zF = -Infinity; for (const sg of segs) for (const p of sg) zF = Math.max(zF, p[0]);
    // the fore edge (the segments at the fore station) and the top edge (the segments on the upper rail)
    const fore = segs.filter(sg => Math.abs(sg[0][0] - zF) < 1e-6 && Math.abs(sg[1][0] - zF) < 1e-6);
    const yTopAt = z => { let best = -Infinity; for (const sg of segs) { const [a, b] = sg; if (Math.abs(b[0] - a[0]) < 1e-9) continue;
      if ((z - a[0]) * (z - b[0]) > 0) continue; best = Math.max(best, a[1] + (b[1] - a[1]) * (z - a[0]) / (b[0] - a[0])); } return best; };
    const loop = (sh.knifeLoops || []).find(l => l.side === 1);
    // the loop judged ALONG its segments (a straight edge carries points only where it crosses the mesh's edges)
    const L0 = loop ? loop.pts.map(p => [p[2], p[1]]) : [], L = [];
    for (let i = 0; i < L0.length; i++) { const a = L0[i], b = L0[(i + 1) % L0.length];
      for (let k = 0; k < 8; k++) L.push([a[0] + (b[0] - a[0]) * k / 8, a[1] + (b[1] - a[1]) * k / 8]); }
    const aftZ = Math.max(win.corners[1][0] + rr[1], win.corners[2][0] + rr[2]) + 0.02;    // clear of the aft roundings
    const foreR = Math.max(rr[0], rr[3]) + 0.01;
    let worstF = 0, worstT = 0, nF = 0, nT = 0;
    const yTopFore = win.corners[0][1], yBotFore = win.corners[3][1];
    for (const p of L) {
      if (Math.abs(p[0] - zF) < 0.004 && p[1] < yTopFore - foreR && p[1] > yBotFore + foreR) {      // on the fore edge
        nF++; worstF = Math.max(worstF, Math.abs(p[0] - (zF + (BREAK.fore || 0))));
      } else if (p[0] > aftZ && p[0] < zF - foreR && p[1] > (yTopFore + yBotFore) / 2) {             // on the top edge
        nT++; worstT = Math.max(worstT, Math.abs(p[1] - (yTopAt(p[0]) + (BREAK.fore || 0))));
      }
    }
    const tol = 0.003 / ((G.CAGE_UNIT || 1) * Pq.planeScale);
    check(fore.length > 0 && nF > 1 && worstF < tol, '3 FORE PART the fore edge stands on the old window\'s', nF + ' loop points, worst ' + (worstF * 1000).toFixed(2) + ' mm (cage units)');
    check(nT > 3 && worstT < tol, '3 FORE PART the top edge follows the old window\'s wing line', nT + ' loop points, worst ' + (worstT * 1000).toFixed(2) + ' mm (cage units)');
  }

  // ---- 4 REFUSAL ------------------------------------------------------------------------------------------------
  {
    const base = Object.assign({}, PAGE_BASE, SKIN_ONLY, { paxWinN: 1, paxWinShape: 2, win2N: 1 });
    const R0 = G.cageQuadRect(base, 'paxWin');
    // concave: the aft top corner pushed in past the diagonal; crossed: the two aft corners swapped
    const mid = [(R0[0][0] + R0[2][0]) / 2, (R0[0][1] + R0[2][1]) / 2];
    const concave = Object.assign({}, base, { paxWinQ2Z: mid[0] + 0.02, paxWinQ2Y: mid[1] - 0.02 });
    const crossed = Object.assign({}, base, { paxWinQ2Z: R0[2][0], paxWinQ2Y: R0[2][1], paxWinQ3Z: R0[1][0], paxWinQ3Y: R0[1][1] });
    for (const [nm, P, word] of [['concave', concave, 'folds in'], ['crossed', crossed, 'cross']]) {
      const w = G.cageSpec(P).windows.find(x => x.row === 1);
      const said = (w && w.refused) || '';
      check(!!w.refused !== !!BREAK.refuse && said.indexOf(word) >= 0 === !BREAK.refuse, '4 REFUSAL a ' + nm + ' quad is refused, with its reason', said);
      const s = sheetOf(P), t = watertight(s);
      check(t.ok && t.loops === 2, '4 REFUSAL the ' + nm + ' quad is not cut, the row-2 window is, the sheet watertight', t.loops + ' loops, over-shared ' + t.over);
    }
  }

  // ---- 5 SAVE -----------------------------------------------------------------------------------------------------
  {
    const keysOf = o => Object.keys(o || {}).filter(k => /^(paxWin|win2|win3)Q[1-4][ZY]$/.test(k));
    const old = keysOf(G.cageToSpec(Po));
    check(old.length === 0, '5 SAVE a build with no quad (the Cub) saves no corner row', old.join(','));
    const saved = G.cageToSpec(Pq), back = G.cageFromSpec({ cage: saved });
    const k8 = keysOf(saved);
    check(k8.length === 8 && k8.every(k => back[k] === Pq[k]), '5 SAVE the quad\'s corners save and load back exact', k8.length + ' rows');
  }
}

if (SELFTEST) {
  let ok = true;
  for (const [nm, br] of [['corner', { corner: 0.01 }], ['fore part', { fore: 0.01 }], ['refusal', { refuse: 1 }]]) {
    Object.keys(BREAK).forEach(k => delete BREAK[k]); Object.assign(BREAK, br);
    fails = []; n = 0;
    run();
    console.log('SELFTEST ' + nm + ': ' + (fails.length ? 'red (good)' : 'STILL GREEN'));
    ok = ok && fails.length > 0;
  }
  console.log('GATE QUADWIN SELFTEST: ' + (ok ? 'PASS' : 'FAIL'));
  process.exit(ok ? 0 : 1);
}
run();
console.log(n + ' checks');
console.log('GATE QUADWIN: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
process.exit(fails.length ? 1 : 0);
