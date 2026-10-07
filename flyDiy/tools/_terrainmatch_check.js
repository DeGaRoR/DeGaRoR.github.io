#!/usr/bin/env node
// _terrainmatch_check.js - GATE TERRAINMATCH (G2115-G2119, TERRAIN-MATCH): THE DRAWN GROUND IS THE SOLVER'S WHERE WHEELS AND
// WRECKAGE TOUCH, at every Jolene aerodrome, on the gamer and potato budgets - and no budget's triangles grew to get there.
//
// The finding (DMG-SETTLE G2044, tools/dmg_settle_terrain.js): the drawn ground sat under the solver's (world.terrainH, the
// premises raster) by a median 3.2 cm, 5-13 cm at a site's worst, 0.4-0.7 m at three over-runs. tools/terrain_match.js
// measures the page's stack (the pavement, the premises' patch at its 2 m level, the fine tiles, the far terrain, and the 1 m
// contact tier under the aeroplane: src/viewer/ground_tier.js) at every stand, strip, lane and over-run, names each cause, and
// sets the aeroplanes on the stands. Held here, on the shipped sources:
//   1. THE SITES, both budgets: p95 within 5 mm and the worst within 30 mm everywhere off a crease or a step of terrainH itself
//      (a cut's bank, a DEM seam, the coast: no surface drawn through one meets it) - ALLOW below names the two that are not;
//      the over-runs on the patch, its border (the tuck, the far terrain) nowhere in them.
//   2. THE WHEELS: the user's Cub (builds/cub_2026-09-20_corrected.json), the Jodel, the metal Cessna settled at every stand -
//      the drawn ground under every wheel within 11 mm of terrainH.
//   3. THE LAWS, by unit: the near level's sink (render_premises sinkNear) only where the 1-ring is under the opaque interior;
//      a pavement's lift off over another pavement's interior (pavement.js liftOver); a strip's lift pinned at liftIn inside
//      its ends; the rows refined where the ground curves, never on the analytic world; a grass road's 1 cm margin.
//   4. THE TIER: its geometry (the edge band ON the layer it replaces to the float, the core on the law), the layer's uniform,
//      the hooks (render_world's ground hook sinks by uTier; the patch's materials and the fine tiles take their own; the
//      tier's copies share their layer's program and draw by a polygon offset), build.js ships ground_tier.js before
//      render_world.js.
//   5. THE BUDGET: at FRAMECOST's two views (HOME's stand and the half-way point of its taxi) the premises' patch (every block
//      at the level its distance draws: tools/patch_census.js) + the pavement within 3 km + the tier, against train 37b's own
//      numbers (frozen below) - on potato's budget (patchTolPx 3) and gamer's (1). The patch's skirts between two chunks of one
//      block (never seen: one LOD, one row of vertices) pay for the tier and the refined rows.
//
//   node tools/_terrainmatch_check.js   -> "GATE TERRAINMATCH: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
const node = (args, mb) => execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: (mb || 64) * 1024 * 1024, env: Object.assign({}, process.env, { FLYDIY_GROUND_RASTER: '1' }) });
const TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'terrainmatch-'));

// ---- 1-2. the sites and the wheels (tools/terrain_match.js, its own processes: the preset is read at its load) ----------
const TOL = { p95: 5, worst: 30, wheel: 11 };
// ALLOW: a site over the bound, its own bound and why (an entry admits that site only)
const ALLOW = [
  { id: 'nv_strip stand', p95: 15, worst: 50, why: 'nv_meadow: a grass polygon at its 2 m grid - refined it is +27 k triangles at nv_strip, where potato\'s count would grow (pavement.js REFINE: grass polygons not refined)' },
  { id: 'nv_strip overrun end', p95: 8, worst: 40, why: 'nv_meadow (as nv_strip stand)' },
  { id: 'nv_strip overrun start', p95: 8, why: 'nv_meadow (as nv_strip stand)' },
  { id: 'nv_strip lane', p95: 10, why: 'nv_meadow (as nv_strip stand)' },
  { id: 'mn_strip overrun start', p95: 8, why: 'mn_main across its 18 m on the cut past the end: rows across 3 m (REFINE.roadV off: 13 k more over Jolene)' },
];
const allow = id => ALLOW.find(a => a.id === id) || {};
for (const preset of ['gamer', 'potato']) {
  const jf = path.join(TMP, 'tm_' + preset + '.json');
  node([path.join(T, 'terrain_match.js'), '--preset', preset, '--brief', '--json', jf].concat(preset === 'gamer' ? [] : ['--nowheels']));
  const R = JSON.parse(fs.readFileSync(jf, 'utf8'));
  const gated = R.rows.filter(r => r.n && r.kind !== 'rim' && r.kind !== 'edge');
  ok(gated.length >= 25, preset + ': the sites measured (every land strip with a record: stand, strip, lanes, both over-runs)', gated.length + ' sites');
  for (const r of gated) {
    const A = allow(r.id), bp = A.p95 || TOL.p95, bw = A.worst || TOL.worst;
    ok(r.p95s <= bp && Math.abs(r.worstS) <= bw, `${preset} ${r.id}: |drawn - terrainH| p95 ${r.p95s.toFixed(1)} mm (<= ${bp}), worst ${r.worstS.toFixed(1)} (<= ${bw}) off ${r.creased} creased / stepped points` + (A.why ? ' [ALLOW: ' + A.why + ']' : ''),
      r.worstS ? 'worst at ' + r.atS + ' on ' + r.onS : '');
    // the construction's own faults are gone from every site: no pavement's sink in a visible triangle, no patch border,
    // no far terrain, no 2 m or 5 m lattice under the aeroplane
    const bad = Object.entries(r.causes || {}).filter(([k]) => /sunk vertex|border's tuck|far terrain|fine tiles|2 m lattice/.test(k));
    if (bad.length) ok(false, `${preset} ${r.id}: none of its points over 10 mm by the construction's old faults`, bad.map(([k, q]) => q.n + ' x ' + k).join('; '));
  }
  if (preset === 'gamer') {
    ok(R.wheels && R.wheels.length >= 12, 'the wheels: the Cub, the Jodel and the metal Cessna at every stand', (R.wheels || []).length + ' placings');
    let worst = 0, at = '';
    for (const w of R.wheels || []) for (const q of w.per) if (Math.abs(q.mm) > Math.abs(worst)) { worst = q.mm; at = w.aero + ' ' + w.build + ' on ' + q.on; }
    ok(Math.abs(worst) <= TOL.wheel, `the drawn ground under every wheel within ${TOL.wheel} mm of terrainH`, 'worst ' + worst.toFixed(1) + ' mm, ' + at);
  }
}

// ---- 1b. the over-runs are the patch's ----------------------------------------------------------------------------
const GD = (() => { const a = process.argv; a.push('--none'); process.env.FLYDIY_GROUND_RASTER = '1'; try { return require(path.join(T, 'ground_drawn.js')); } finally { a.pop(); } })();
const W = GD.W, O = W.premises.overlay, PL = GD.PATCH, GT = require(path.join(ROOT, 'src', 'viewer', 'ground_tier.js'));
const PAV = require(path.join(ROOT, 'src', 'viewer', 'pavement.js'));
{
  let n = 0, shallow = 0, worst = Infinity, at = '';
  const need = PL.PATCH_TUCK.ring1 + GT.S.patch.half * Math.SQRT2;
  for (const a of W.aerodromes) {
    if (!a.len || !a.wid || a.kind === 'water' || !a.premises) continue;
    const c = Math.cos(a.hdg), s = Math.sin(a.hdg);
    for (const sg of [1, -1]) for (let u = 3; u <= 100; u += 4) for (let v = -a.wid / 2; v <= a.wid / 2; v += a.wid / 4) {
      const uu = sg * (a.len / 2 + u), x = a.x + uu * c + v * s, z = a.z + uu * s - v * c, d = GD.covers(x, z) ? PL.patchDepth(x, z) : 0;
      n++; if (d < need) shallow++; if (d < worst) { worst = d; at = a.id + (sg > 0 ? ' end' : ' start') + ' +' + u + ' m'; }
    }
  }
  ok(n > 300 && shallow === 0, `every over-run (3-100 m past each end, the strip's width) lies ${need.toFixed(1)} m and more inside the patch (ring1 + the tier's half-diagonal): no tuck, no far terrain, the tier stands there`, n + ' points, the shallowest ' + worst.toFixed(1) + ' m at ' + at);
}

// ---- 3. the laws ----------------------------------------------------------------------------------------------------
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const RP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
const RW = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');
{
  // the near level's sink: from SINK0_IN (the 2 m cell's diagonal) further in than the coarse levels' - so every triangle of a
  // sunk vertex lies inside the opaque interior (pavedAt's depth is 1-Lipschitz)
  ok(/const sink0In = \(\) => PL\.res\[0\] \* Math\.SQRT2;/.test(RP) && /sinkAt\(q\.d - \(refinedPave\(q\.id\) \? sink0In\(\) : 0\),/.test(RP), 'render_premises: the near level sinks from SINK0_IN = res[0] x sqrt2 further in under a refined pavement (sinkNear; the town\'s roads keep the line)');
  ok(/const YL = L === 0 \? Y1 : Y;/.test(RP), '...the near level is drawn from Y1, the coarse levels from Y (G660\'s sink from the opaque line, unchanged)');
  // a 1-ring of the 2 m grid round a vertex whose depth is d0 + SINK0_IN reaches d0 at the least: the deep sink starts there
  const d0 = PAV.opaqueDepth('concrete', 20, null, 'strip'), D = PL.SINK0_IN;
  ok(Math.abs(D - 2 * Math.SQRT2) < 1e-12 && PAV.sinkAt(d0 + D - 1e-9 - D, d0, 10) === PAV.SINK.pre, 'the deep sink is 0 at a vertex SINK0_IN inside the opaque line (only the edge\'s 7 cm)', (D).toFixed(3) + ' m');
  // the pockets are gone: along every Jolene pavement edge, the near level's surface between the vertices (the patch law, on
  // its own triangles) at the opaque line and 3 m outside it, against the ground: nothing sunk past the 7 + 2 cm of the edge
  let worst = 0, n = 0, at = '';
  for (const a of W.aerodromes) {
    if (!a.len || !a.wid || a.kind === 'water' || !a.premises) continue;
    const c = Math.cos(a.hdg), s = Math.sin(a.hdg);
    for (let u = -0.45; u <= 0.45; u += 0.01) for (const sg of [1, -1]) for (const out of [0, 0.5, 1, 2, 3]) {
      const v = sg * (a.wid / 2 + out), x = a.x + c * u * a.len + s * v, z = a.z + s * u * a.len - c * v;
      if (!GD.covers(x, z) || PL.patchDepth(x, z) < PL.PATCH_TUCK.tuckW) continue;
      const q = O.pavedAt(x, z); if (q && q.dPre > 0) continue;   // (inside a pavement - another's, past this edge: the patch is sunk under it, out of sight)
      const e = PL.at(x, z) - W.terrainHBuild(x, z); n++; if (e < worst) { worst = e; at = a.id + ' ' + out + ' m out'; }
    }
  }
  ok(n > 1000 && worst > -(PAV.SINK.pre + PL.PATCH_TUCK.drop + 0.005), 'along every strip\'s edge (the line, 0.5-3 m out) the near level stands within the edge\'s 7 + 2 cm of the ground - no pocket of the deep sink (was 5-13 cm, 0.4 m at mn_strip)', n + ' points, the deepest ' + (worst * 1000).toFixed(1) + ' mm at ' + at);
}
{
  // liftOver: a pavement's lift off over another's interior, falling over liftIn; 1 off every other pavement
  const fake = (x, z, reach, skip) => (skip === 'A' && x > 0 ? { d: x } : null);
  const L = PAV.liftOver(fake, 'A');
  ok(L(-1, 0) === 1 && L(PAV.SINK.liftIn, 0) === 0 && L(PAV.SINK.liftIn / 2, 0) > 0.4 && L(PAV.SINK.liftIn / 2, 0) < 0.6, 'pavement.js liftOver: 1 off another pavement, 0 from liftIn inside it (its own lift law)');
  // a strip's ends: the lift ends SINK.liftIn inside them (a row pinned there), as it does inside the sides
  const flat = () => 0, st = PAV.stripGeometry(THREE, { len: 200, wid: 20, hdg: 0, cx: 0, cz: 0, heightAt: flat, lift: 0.07, resU: 6, resV: 3, sinkD0: 0.3 });
  const P = st.attributes.position.array, A = st.attributes.aPav.array; let atIn = -1, pastIn = 0;
  for (let k = 0; k < P.length / 3; k++) { const u = A[k * 4], v = A[k * 4 + 1]; if (Math.abs(v) > 5) continue;
    if (Math.abs(u - PAV.SINK.liftIn) < 1e-6) atIn = P[k * 3 + 1]; if (u >= PAV.SINK.liftIn - 1e-6 && u <= 200 - PAV.SINK.liftIn + 1e-6) pastIn = Math.max(pastIn, P[k * 3 + 1]); }
  ok(atIn === 0 && pastIn === 0, 'pavement.js stripGeometry: a row at liftIn inside each end, the strip at the ground from it in (tw_ski\'s start: +52 mm 1.5 m in)', 'at liftIn ' + atIn + ', past it ' + pastIn);
  // the rows earn their spacing: a strip on a crest (a parabola along) gains rows where it curves; the same strip with no
  // sinkD0 (the analytic world) keeps its own
  const crest = (x, z) => -0.002 * x * x;
  const g1 = PAV.stripGeometry(THREE, { len: 200, wid: 20, hdg: 0, cx: 0, cz: 0, heightAt: crest, lift: 0.07, resU: 6, resV: 3, sinkD0: 0.3 });
  const g0 = PAV.stripGeometry(THREE, { len: 200, wid: 20, hdg: 0, cx: 0, cz: 0, heightAt: crest, lift: 0.07, resU: 6, resV: 3 });
  const cols = g => g.userData.pav.cols;
  let worst = 0; { const Q = g1.attributes.position.array, I = g1.index.array, AP = g1.attributes.aPav.array;
    for (let t = 0; t < I.length; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2]; if (Math.min(AP[a * 4 + 2], AP[b * 4 + 2], AP[c * 4 + 2]) < PAV.SINK.liftIn) continue;
      const cx = (Q[a * 3] + Q[b * 3] + Q[c * 3]) / 3, cz = (Q[a * 3 + 2] + Q[b * 3 + 2] + Q[c * 3 + 2]) / 3, cy = (Q[a * 3 + 1] + Q[b * 3 + 1] + Q[c * 3 + 1]) / 3; worst = Math.max(worst, Math.abs(cy - crest(cx, cz))); } }
  ok(cols(g1) > cols(g0) && worst <= PAV.REFINE.tol * 1.5, 'pavement.js REFINE: a strip on a crest gains rows where it curves (its triangles\' centres within the tolerance past liftIn); no sinkD0 (the analytic world): its own rows', cols(g0) + ' -> ' + cols(g1) + ' rows along, worst centre ' + (worst * 1000).toFixed(2) + ' mm');
  ok(/refine: nearRunway\(rd\.pts\)/.test(RP) && /refine: RS\.cls !== 'grass' && nearRunway\(pp\.poly\)/.test(RP) && PAV.REFINE.roadV === false, 'render_premises: an aerodrome\'s roads (along) and its opaque aprons refine - the town\'s, the harbour\'s and the grass ones do not');
  // a grass road: its 1 cm margin (the patch 1 cm under, the road 1 cm over past its lift) - not the 7 + 2 cm
  ok(PAV.translucent('grass', 'road') && !PAV.translucent('grass', 'strip') && !PAV.translucent('grass', 'poly') && !PAV.translucent('gravel', 'road'), 'pavement.js translucent: a grass road alone (its tracks drawn, the grass between them the patch)');
  ok(PAV.sinkAt(5, Infinity, 5, PAV.SINK.tl) === PAV.SINK.tl && PAV.SINK.tl === 0.01, 'sinkAt under a grass road: 1 cm, no pre-sink', PAV.sinkAt(5, Infinity, 5, PAV.SINK.tl));
  const rd = { pts: [[0, 0], [100, 0]], w: 4 }; const PG = require(path.join(T, 'flight_core.js')).PREMISES_GEN, pr = PG.polyRoad(rd.pts, rd.w);
  const gr = PAV.roadGeometry(THREE, { road: pr, w: 4, cls: 'grass', heightAt: flat, lift: 0.07, step: 3, resV: 0.7, sinkD0: Infinity });
  const GP = gr.attributes.position.array, GA = gr.attributes.aPav.array; let mid = null; for (let k = 0; k < GP.length / 3; k++) if (Math.abs(GA[k * 4 + 1]) < 1e-6 && GA[k * 4] > 10) { mid = GP[k * 3 + 1]; break; }
  ok(mid !== null && Math.abs(mid - PAV.SINK.tl) < 1e-6, '...and the grass road stands 1 cm over the ground on its middle', mid);
  ok(/PAVEMENT\.translucent\(q\.cls, q\.kind\)\)\) \{ const d = q\.dPre/.test(RP), 'render_premises patchDrop: no 2 cm under a grass road (its own margin is the gap)');
}

// ---- 4. the tier ----------------------------------------------------------------------------------------------------
{
  const C = require(path.join(T, 'flight_core.js'));
  const PT = PL.PATCH_TUCK, R = 2;
  const law = (x, z) => { const r = Math.min(1, PL.patchDepth(x, z) / PT.tuckW); return W.terrainH(x, z) - PL.dropAt(x, z) * r - PT.tuck * (1 - r) * (1 - r); };
  const sink = (x, z) => PL.sink0Of(x, z), layerY = (x, z) => PL.vertex(x, z);
  for (const id of ['w3', 'mn_strip']) {
    const st = C.siteOf(id).stand, [cx, cz] = GT.centreOf(st.x, st.z), S = GT.S.patch;
    const spec = { cx, cz, half: S.half, step: S.step, cell: R, layer: GT.lattice(R, layerY), base: law, sink, nR: R, uv: () => [0, 0], coarse: false };
    const g = GT.build(THREE, spec); let r; do { r = g.next(); } while (!r.done);
    const { Y, N } = r.value; let eL = 0, eC = 0, nL = 0, nC = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = cx - S.half + i * S.step, z = cz - S.half + j * S.step, t = S.half - Math.max(Math.abs(x - cx), Math.abs(z - cz)), w = GT.weight(t, R), y = Y[j * N + i];
      if (w <= 0) { eL = Math.max(eL, Math.abs(y - PL.at(x, z))); nL++; }
      if (w >= 1) { eC = Math.max(eC, Math.abs(y - (law(x, z) - sink(x, z)))); nC++; }
    }
    ok(nL > 400 && eL < 1e-6 && nC > 900 && eC < 1e-9, `the tier at ${id}'s stand: its edge band ON the patch's near level (its own triangles) and its core ON the law`, `band ${nL} vertices, ${(eL * 1000).toFixed(4)} mm; core ${nC}, ${(eC * 1000).toFixed(6)} mm`);
    const u = GT.sinkU(cx, cz, S.half, R);
    ok(u[2] === S.half - R && u[3] === GT.S.drop && 2 * R + GT.S.ramp < S.half, '...the layer\'s uniform sinks its vertices more than a cell inside (their triangles within 2 cells: the band) - the core starts after the ramp', JSON.stringify(u));
    const tris = (N - 1) * (N - 1) * 2; ok(tris === 8192, '...one draw of ' + tris + ' triangles');
  }
  ok(/uniform vec4 uTier;/.test(RW) && /if \(max\(tD\.x, tD\.y\) < uTier\.z\) \{ transformed\.y -= uTier\.w; vWPi\.y -= uTier\.w; \}/.test(RW), 'render_world: the ground hook sinks a vertex under the tier by uTier (a vertex test: no discard, early-Z kept)');
  ok(/uTier: \{ value: new THREE\.Vector4\(0, 0, 0, 0\) \}/.test(RW) && /sh\.uniforms\.uTier = TIER_U\.fine;/.test(RW) && /tierU: TIER_U\.patch/.test(RW) && /if \(o\.tierU && !tier\) sh\.uniforms\.uTier = o\.tierU;/.test(RP), '...off for every ground program (the ring, the far terrain) but the patch\'s (opts.tierU) and the fine tiles\' (TIER_U.fine)');
  ok(/m\.onBeforeCompile = islandGroundHookFine; islandKeyed\(m, 'island-fine'\)/.test(RW) && /if \(tier\) \{ M\.polygonOffset = true;/.test(RP) && /m\.polygonOffset = true; m\.polygonOffsetFactor = -1;/.test(RW), '...the tier\'s own materials: the same program keys as their layer\'s, their own uniforms (no sink), a polygon offset over the band they share');
  ok(/if \(groundTier && cg\) groundTier\.update\(cg, fdt\);/.test(RW) && /if \(groundTier\) groundTier\.invalidate\(\);/.test(RW), '...worldUpdate drives it (the aeroplane\'s position), a live edit of the ground drops it');
  const B = fs.readFileSync(path.join(T, 'build.js'), 'utf8'), iT = B.indexOf("'ground_tier.js'"), iW = B.indexOf("'render_world.js'");
  ok(iT > 0 && iW > iT, 'build.js ships ground_tier.js before render_world.js');
}

// ---- 5. the budget --------------------------------------------------------------------------------------------------
{
  // train 37b's (068584d) own numbers at the two views: the patch drawn (tools/patch_census.js on its render_premises.js) and
  // the pavement within 3 km (tools/ground_drawn.js's meshes on its pavement.js)
  // potato's patchTolPx read off gfx_settings.js BUDGETS: 3 on train 37b; 6 on train 38 (POTATO-DEEP G1528, measured on
  // origin/claude/potato-deep-g1520's render_premises.js: 377 600 / 395 520) - the base the budget row of that train is held to
  const GFXS = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'gfx_settings.js'), 'utf8'), mP = /potato:\s*\{[^}]*patchTolPx: (\d+)/.exec(GFXS), POT = mP ? +mP[1] : 1;
  const PATCH0 = { 3: { 'HOME stand': 462272, 'HOME taxi': 528576 }, 6: { 'HOME stand': 377600, 'HOME taxi': 395520 } }[POT];
  ok(!!PATCH0, 'potato\'s patchTolPx (' + POT + ') has its train\'s frozen base here');
  const BASE = { potato: { 'HOME stand': (PATCH0 || {})['HOME stand'] + 258858, 'HOME taxi': (PATCH0 || {})['HOME taxi'] + 258858 }, gamer: { 'HOME stand': 924736 + 258858, 'HOME taxi': 939328 + 258858 } };
  const C = require(path.join(T, 'flight_core.js')), home = C.siteOf('HOME'), tp = home.taxiOut, m = tp[Math.floor(tp.length / 2)];
  const views = { 'HOME stand': [home.stand.x, home.stand.z], 'HOME taxi': m };
  const pav = {}; for (const [k, [x, z]] of Object.entries(views)) { let t = 0; for (const M of GD.MESHES) { const cx = (M.box[0] + M.box[2]) / 2, cz = (M.box[1] + M.box[3]) / 2; if (Math.hypot(cx - x, cz - z) < 3000) t += M.idx.length / 3; } pav[k] = t; }
  const tier = 2 * Math.pow(Math.round(2 * GT.S.patch.half / GT.S.patch.step), 2);
  for (const [preset, tol] of [['potato', POT], ['gamer', 1]]) {
    const jf = path.join(TMP, 'pc_' + tol + '.json');
    node([path.join(T, 'patch_census.js'), '--tolpx', String(tol), '--json', jf]);
    const P = JSON.parse(fs.readFileSync(jf, 'utf8'));
    for (const v of P.views) {
      if (!BASE[preset][v.id]) continue;
      const now = v.tris + pav[v.id] + tier;
      ok(now <= BASE[preset][v.id], `${preset} (patchTolPx ${tol}) ${v.id}: the patch + the pavement within 3 km + the tier no more than train 37b's`, `${BASE[preset][v.id]} -> ${now} (patch ${v.tris}, pavement ${pav[v.id]}, tier ${tier})`);
    }
  }
  ok(/if \(nc !== undefined && KIND\[nc\] === KIND\[c\] && blockOf\(nc\) === blockOf\(c\)\) continue;/.test(RP), 'render_premises: no skirt on an edge two chunks of one block share (one LOD: one row of vertices)');
}

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
console.log('GATE TERRAINMATCH: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
