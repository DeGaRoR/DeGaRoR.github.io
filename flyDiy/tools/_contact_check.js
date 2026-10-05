#!/usr/bin/env node
// _contact_check.js — GATE CONTACT (A6-GROUND G1000-G1004, the Jolene playtest: "the planes feel floaty when taxiing").
//
// The wheels stand on terrainH (30_solver.js). What the eye sees under a tyre is the drawn tyre on the drawn ground.
// This gate holds the three things A6-GROUND made agree, on the shipped sources (pavement.js, contact_shadow.js, the
// core), never a copy:
//   1. THE PAVEMENT IS DRAWN AT terrainH WHERE THE WHEELS ROLL (G1001, pavement.js). On the game's patch (sinkD0 given)
//      the lift is the side's: liftK 1 at the edge and outside, 0 from SINK.liftIn in; a row pinned there on strips and
//      roads; the ground patch drops SINK.pre by the same law (sinkAt), so the pavement stands over the ground by what
//      it always did. Measured on Jolene's own strips, roads and aprons (built with the page's arguments, the premises
//      composed off tools/fixtures/island_jolene.json): the drawn surface past liftIn within 10 mm of terrainH at p95,
//      and never a point of it within 5 mm of the drawn ground patch where it was not already on master (a ratchet).
//      The analytic world's strips (no sinkD0) keep their constant lift.
//   2. THE DRAWN TYRE IS ON ITS NODE (G1000, tools/ground_gap.js's arithmetic): the stock build at rest on flat ground,
//      every wheel's drawn bottom within 8 mm of the ground (the join's snapshot posed by poseModel's law).
//      [only with --drawn: ~15 s of the headless editor; the battery row runs the rest]
//   3. THE CONTACT SHADOWS (G1002, contact_shadow.js): at rest a blob under each wheel at full strength and one under
//      the body; lifted, the strength falls with the height and is gone at `reach`; none on floats; update() writes
//      the instance on the ground's plane at the wheel; one InstancedMesh, depthWrite off, drawn after the pavement;
//      app.js poses them after poseModel, build.js ships the module.
//
//   4. NOTHING LOOSE ON A PAVEMENT (G1003): pavedNear and its three dressers.
//   5. THE DRAWN GROUND UNDER THE WHEELS (GROUND-LATTICE G1540-G1543, tools/ground_drawn.js): the premises' patch at
//      terrainH where the wheels roll (its 2 cm only inside the lots' zones), no pit past a dead-end road (pavedAt's
//      roads end square, as their ribbons), TW_DRAW_DROP 0, the stock build's tyres on the drawn ground at every stand.
//
//   node tools/_contact_check.js [--drawn]   -> "GATE CONTACT: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const PAV = require(path.join(ROOT, 'src', 'viewer', 'pavement.js'));
const CS = require(path.join(ROOT, 'src', 'viewer', 'contact_shadow.js'));
const C = require(path.join(T, 'flight_core.js'));

// ---- 1. the lift law -------------------------------------------------------------------------------------------
{
  const L = PAV.SINK.liftIn;
  ok(L > 0 && L <= 2, 'SINK.liftIn is a metre or two', L);
  ok(PAV.liftK(-0.5, 0.5) === 1 && PAV.liftK(0, 0.5) === 1, 'the side and the edge keep the whole lift');
  ok(PAV.liftK(L, 0.5) === 0 && PAV.liftK(L + 3, Infinity) === 0 && PAV.liftK(L, 6.6) === 0, 'from liftIn in the lift is 0 on every class (concrete, grass, gravel)');
  let pairOk = true;
  for (let d = 0; d <= L; d += 0.05) { const lost = 0.07 * (1 - PAV.liftK(d, 0.5)), sunk = PAV.sinkAt(d, 0.5); if (sunk + 1e-9 < lost) pairOk = false; }
  ok(pairOk, 'the ground sinks at least what the pavement lost (SINK.pre by the same law), 0..liftIn');
  ok(PAV.sinkAt(0.5 + 3, 0.5) === PAV.SINK.S, 'the deep sink still reaches S past d0 + ramp');
  const flat = (x, z) => 0.3 * Math.sin(x / 40) + 0.2 * Math.cos(z / 55);
  const g = PAV.stripGeometry(THREE, { len: 400, wid: 24, hdg: 0.7, cx: 10, cz: -20, heightAt: flat, lift: 0.07, resU: 6, resV: 4, sinkD0: 0.5 });
  const P = g.attributes.position.array, A = g.attributes.aPav.array;
  let worst = 0, pinned = false;
  for (let i = 0; i < P.length / 3; i++) { const dE = A[i * 4 + 2]; if (Math.abs(dE - L) < 1e-3) pinned = true; if (dE >= L - 1e-6) worst = Math.max(worst, Math.abs(P[i * 3 + 1] - flat(P[i * 3], P[i * 3 + 2]))); }
  ok(pinned, 'a strip on the patch pins a row at liftIn inside its edge');
  ok(worst < 1e-5, 'every strip vertex from liftIn in is AT heightAt', worst.toExponential(1));
  const g0 = PAV.stripGeometry(THREE, { len: 400, wid: 24, hdg: 0.7, cx: 10, cz: -20, heightAt: flat, lift: 0.07, resU: 6, resV: 4 });
  const P0 = g0.attributes.position.array; let lift0 = Infinity;
  for (let i = 0; i < P0.length / 3; i++) lift0 = Math.min(lift0, P0[i * 3 + 1] - flat(P0[i * 3], P0[i * 3 + 2]));
  ok(Math.abs(lift0 - 0.07) < 1e-5, 'off the patch (no sinkD0) a strip keeps its constant lift', lift0.toFixed(4));
  // Jolene, as the page draws it: tools/ground_surface.js's survey (the same builders, the same arguments)
  const { execFileSync } = require('child_process');
  const grid = execFileSync(process.execPath, [path.join(T, 'ground_surface.js'), '--grid'], { encoding: 'utf8', maxBuffer: 1 << 24 });
  const row = k => { const m = new RegExp('^\\s+' + k.replace(/[:.]/g, '\\$&') + '\\s+n\\s+(\\d+)\\s+mean\\s+(\\S+)\\s+p5\\s+(\\S+)\\s+p95\\s+(\\S+)', 'm').exec(grid); return m ? { n: +m[1], mean: +m[2], p5: +m[3], p95: +m[4] } : null; };
  for (const k of ['road', 'apron', 'strip:concrete', 'strip:gravel', 'strip:grass']) {
    const r = row(k);
    ok(r && r.n > 1000 && Math.abs(r.mean) < 5 && r.p95 < 10 && r.p5 > -10, 'Jolene ' + k + ' past liftIn: the drawn surface within 10 mm of terrainH (p5..p95)', r ? 'n ' + r.n + ', mean ' + r.mean + ', p5 ' + r.p5 + ', p95 ' + r.p95 + ' mm' : 'no row');
  }
  const sep = execFileSync(process.execPath, [path.join(T, 'ground_surface.js'), '--sep'], { encoding: 'utf8', maxBuffer: 1 << 24 });
  // master b78f8d0c's counts of pavement points within 5 mm of the drawn ground (the 0.5 m grid), +10 % and +20 slack
  const BASE = { 'apron edge': 6, 'apron side': 98, 'road band': 19, 'road edge': 257, 'road side': 2862, 'concrete edge': 0, 'concrete band': 0, 'concrete side': 0, 'gravel edge': 0, 'grass edge': 0 };
  const ALLOW = { 'apron edge': 30, 'road band': 90 };      // G1001: the curvature misses, measured 18 and 75 (HANDOVER G1001)
  for (const k in BASE) {
    const m = new RegExp('^\\s+' + k + '\\s+n.*under 5 mm (\\d+)', 'm').exec(sep), n = m ? +m[1] : NaN;
    const lim = ALLOW[k] != null ? ALLOW[k] : Math.round(BASE[k] * 1.1) + 20;
    ok(n <= lim, 'Jolene ' + k + ': pavement points within 5 mm of the ground no more than master\'s ' + BASE[k] + ' (+ slack)', n + ' <= ' + lim);
  }
}

// ---- 2. the drawn tyre on its node (headless editor, opt-in) ----------------------------------------------------
if (process.argv.includes('--drawn')) {
  const { execFileSync } = require('child_process');
  const out = JSON.parse(execFileSync(process.execPath, [path.join(T, 'ground_gap.js'), '--build', 'stock', '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(l => l.trim()).slice(-1)[0] === ']' ? execFileSync(process.execPath, [path.join(T, 'ground_gap.js'), '--build', 'stock', '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 }) : '[]');
  const w = out[0] ? out[0].wheels : [];
  ok(w.length === 3, 'the stock build has three drawn wheels', w.length);
  // G1383 drew a taildragger's tail gear app.js's TW_DRAW_DROP (20 mm) under its node; G1543 put the dial back to 0
  for (const x of w)
    ok(Math.abs(x.drawnMm) < 8, 'stock ' + x.kind + ': the drawn tyre on the ground at rest (TW_DRAW_DROP 0: G1543)', x.drawnMm + ' mm');
}

// ---- 3. the contact shadows -----------------------------------------------------------------------------------
{
  const def = C.buildGen(JSON.parse(JSON.stringify(C.GEN_DEFAULT)));
  const flat = { terrainH: () => 0, waterH: () => -Infinity };
  const sim = C.makeSim(def, null);
  sim.reset(0); if (sim.stance) sim.stance();
  for (let i = 0; i < 360; i++) sim.step(1 / 60);
  const xa = sim.axes()[0], ax = [xa[0], xa[2]];
  const b0 = CS.blobsFor(sim, def, flat, { axis: ax });
  const nW = def.refs.mains.length + (def.refs.tw >= 0 ? 1 : 0);
  ok(b0.length === nW + 1, 'at rest: a blob under each wheel and one under the body', b0.length + ' for ' + nW + ' wheels');
  ok(b0.slice(0, nW).every(b => b.a > 0.9 * CS.S.a), 'at rest the wheels\' blobs are at full strength', b0.map(b => b.a.toFixed(2)).join(' '));
  const wIds = def.refs.mains.concat([def.refs.tw]);
  ok(b0.slice(0, nW).every((b, i) => Math.hypot(b.x - sim.p[wIds[i] * 3], b.z - sim.p[wIds[i] * 3 + 2]) < 1e-9 && b.gy === 0), 'each wheel\'s blob is straight under its node, on the ground');
  // lifted: the same pose raised by h
  const lifted = h => { const p = Float64Array.from(sim.p); for (let i = 1; i < p.length; i += 3) p[i] += h; return CS.blobsFor({ p, hydro: null }, def, flat, { axis: ax }); };
  const b1 = lifted(0.2), b2 = lifted(CS.S.reach + 0.01);
  ok(b1.length && b1[0].a < b0[0].a && b1[0].a > 0, '20 cm up the blobs are fainter', b1[0] && b1[0].a.toFixed(3));
  ok(b2.filter(b => b.kind === 'wheel').length === 0, 'past `reach` the wheels cast no blob', b2.length + ' left (the body\'s fades by bodyReach)');
  ok(CS.blobsFor({ p: sim.p, hydro: {} }, def, flat, { axis: ax }).length === 0, 'on floats (sim.hydro) no blob');
  const wet = { terrainH: () => 0, waterH: () => 0.5 };
  ok(CS.blobsFor(sim, def, wet, { axis: ax }).filter(b => b.kind === 'wheel').length === 0, 'over drawn water no wheel blob');
  // update(): the instances on the ground's plane
  const mesh = CS.make(THREE);
  ok(mesh.isInstancedMesh && mesh.material.depthWrite === false && mesh.material.transparent && mesh.renderOrder > 3 && !mesh.castShadow, 'one InstancedMesh, transparent, no depth write, after the pavement (renderOrder ' + mesh.renderOrder + '), casting nothing');
  const slope = { terrainH: (x, z) => 0.1 * x, waterH: () => -Infinity };
  const bs = CS.blobsFor(sim, def, slope, { axis: ax });
  CS.update(THREE, mesh, bs);
  ok(mesh.count === bs.length && mesh.visible, 'update writes one instance a blob', mesh.count);
  const m4 = new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, 0), c = new THREE.Vector3().setFromMatrixPosition(m4);
  const up = new THREE.Vector3(0, 1, 0).transformDirection(m4), want = new THREE.Vector3(-0.1, 1, 0).normalize();
  ok(Math.abs(c.y - (slope.terrainH(bs[0].x, bs[0].z) + CS.S.lift * want.y)) < 1e-4 && up.angleTo(want) < 1e-3, 'the first blob sits on the sloped ground, on its plane', 'y ' + c.y.toFixed(4) + ', tilt ' + (up.angleTo(want) * 57.3).toFixed(3) + ' deg');
  ok(Math.abs(mesh.userData.aA.array[0] - bs[0].a) < 1e-6, 'its strength rides the instance attribute');
  CS.update(THREE, mesh, []);
  ok(mesh.count === 0 && !mesh.visible, 'no blob: nothing drawn');
  // the wiring
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), build = fs.readFileSync(path.join(T, 'build.js'), 'utf8');
  const iPose = app.indexOf('    poseModel();\n    // G1002'), iCs = app.indexOf('contactShadows();', iPose);
  ok(iPose > 0 && iCs > iPose && iCs - iPose < 200, 'app.js poses the contact shadows right after poseModel in the frame');
  ok(/'contact_shadow\.js'/.test(build) && build.indexOf("'contact_shadow.js'") < build.indexOf("'app.js'"), 'build.js ships contact_shadow.js before app.js');
}

// ---- 4. nothing loose on a pavement (G1003) ---------------------------------------------------------------------
{
  const IN = require(path.join(T, 'island_node.js'));
  const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
  const O = W.premises.overlay, H = W.aerodromes.find(a => a.id === 'HOME'), w2 = W.aerodromes.find(a => a.id === 'w2');
  ok(typeof O.pavedNear === 'function', 'the premises answer pavedNear');
  const at = (a, u, v) => { const c = Math.cos(a.hdg), sn = Math.sin(a.hdg); return [a.x + c * (u - a.len / 2) + sn * v, a.z + sn * (u - a.len / 2) - c * v]; };
  const c0 = at(H, H.len * 0.3, 0), q0 = O.pavedNear(c0[0], c0[1], 0, null), q1 = O.pavedNear(c0[0], c0[1], 0, 'HOME');
  ok(q0 && q0.id === 'HOME' && q0.kind === 'strip', "13/31's centre is 13/31", q0 && q0.id);
  ok(q1 === null || q1.id !== 'HOME', 'skipped by its own id, 13/31 does not answer for itself', q1 && q1.id);
  const e0 = at(H, H.len * 0.3, H.wid / 2 + 0.3);
  ok(O.pavedNear(e0[0], e0[1], 0.5, null) && !O.pavedNear(e0[0], e0[1], 0, null), '0.3 m off its edge: near within 0.5 m, not on it');
  ok(!O.pavedNear(e0[0], e0[1], 0.5, 'HOME'), "...and its own band stones there are not refused by their own strip");
  // the crossing: 02/20's band stones that stand on 13/31 (or within 0.5 m of it) are refused
  const F = PAV.field({ len: w2.len, wid: w2.wid, hdg: w2.hdg, cx: w2.x, cz: w2.z, shoulderW: 8 });
  let cand = 0, onOther = 0;
  for (let u = -2; u < w2.len + 2; u += 1) for (const sg of [-1, 1]) for (let dv = 0.3; dv < 5.5; dv += 0.5) {
    const w = F.frame.toWorld(u, sg * (w2.wid / 2 + dv)); cand++;
    if (O.pavedNear(w[0], w[1], 0.5, 'w2')) onOther++;
  }
  ok(onOther > 20 && onOther < cand * 0.2, "02/20's band holds points on or by another pavement (the crossing, the turnarounds, the taxiways), and they are few", onOther + ' of ' + cand);
  // the shoulders: the surface layer's GRAVEL polygons (y_sh13_*) are the band's own ground, not a pavement
  const sh = at(H, H.len * 0.5, H.wid / 2 + 3);
  ok(O.surfaceAt(sh[0], sh[1]) === 6 && !O.pavedNear(sh[0], sh[1], 0.3, 'HOME'), "13/31's gravel shoulder (surface 6) is not a pavement to its stones");
  // the surface layer's PAVED apron (y_pad) is
  ok(!!O.pavedNear(-175, 690, 0, null), 'the pad (a PAVED surface polygon and its look polygon) answers');
  // the dressers ask it
  const rw = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');
  const iS = rw.indexOf('const standRocks = '), iE = rw.indexOf('rows.push(', iS);
  ok(iS > 0 && /pavedNear\(w\[0\], w\[1\], size \+ 0\.5, o\.id\)\) continue/.test(rw.slice(iS, iE)), 'render_world standRocks refuses a stone on or within its size + 0.5 m of another pavement');
  const sl = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'scenery_life.js'), 'utf8');
  ok(/host\.pavedNear\(px, pz, 0\.2, null\)\) continue/.test(sl), 'scenery_life: litter never lies on a pavement');
  ok(/PAVE_SKIP = rd\.id/.test(sl) && /PAVE_SKIP = null/.test(sl) && /paved && PAVE_SKIP !== undefined && host\.pavedNear/.test(sl), "scenery_life: a road's things keep off every pavement but their road, an apron's off every pavement");
  ok(/if \(PG\.inPoly\(poly, lx, lz\) \|\| !offRoad\(lx, lz, 1\)\) continue/.test(sl) && /if \(!PG\.inPoly\(poly, lx, lz\) && clear\(wp\[0\], wp\[1\], 0\.25, true\)/.test(sl), "scenery_life: the apron's clutter and cones stand outside it");
  const rp = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
  ok(/pavedNear: O\.pavedNear \?/.test(rp), 'render_premises hands the life its pavedNear');
}

// ---- 5. the drawn ground under the wheels (GROUND-LATTICE G1540-G1543) -------------------------------------------
// tools/ground_drawn.js stacks what the page draws (the pavement, the premises' patch, the fine tiles) and reads the one
// on top under each wheel. Held here: the patch at terrainH where the wheels roll (its 2 cm only where a lot can be), no
// pit past a dead-end road, TW_DRAW_DROP 0, and the stock build's tyres on the drawn ground at every Jolene stand.
{
  const GD = (() => { const a = process.argv; a.push('--none'); try { return require(path.join(T, 'ground_drawn.js')); } finally { a.pop(); } })();
  const W = GD.W, O = W.premises.overlay, PL = GD.PATCH;
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  ok(/const TW_DRAW_DROP = 0;/.test(app), 'app.js TW_DRAW_DROP is 0 (G1543: the drawn tail gear on its node)');
  ok(typeof PL.patchDrop === 'function', 'render_premises.js drops the patch by patchDrop (G1541), not a flat 2 cm');
  // the drop: 0 on the patch's open grass round every aerodrome (3 m and more off any pavement, outside the lots' zones);
  // the 2 cm kept under a pavement and its side (the translucent fade drawn over it) and in a village zone (the lots)
  const C2 = require(path.join(T, 'flight_core.js'));
  let open = 0, openBad = 0, under = 0, underBad = 0;
  for (const a of W.aerodromes) {
    if (!a.len || a.kind === 'water') continue;
    const c = Math.cos(a.hdg), sn = Math.sin(a.hdg);
    for (let u = -0.5; u <= 0.5; u += 0.05) for (const v of [0, a.wid / 2 + 6, a.wid / 2 + 12, a.wid / 2 + 25, -(a.wid / 2 + 6), -(a.wid / 2 + 12), -(a.wid / 2 + 25)]) {
      const x = a.x + c * u * a.len + sn * v, z = a.z + sn * u * a.len - c * v;
      if (!GD.covers(x, z) || PL.patchDepth(x, z) < PL.PATCH_TUCK.tuckW) continue;
      const q = O.pavedAt(x, z, PL.PATCH_TUCK.sideR1 + 0.01), dr = PL.dropAt(x, z);
      if (q && q.d > 0) { under++; if (Math.abs(dr - PL.PATCH_TUCK.drop) > 1e-12) underBad++; }
      else if (!q) { open++; if (dr !== 0) openBad++; }
    }
  }
  ok(open > 100 && openBad === 0, 'the patch at terrainH on the open grass round Jolene\'s aerodromes (no drop 3 m and more off a pavement)', open + ' points, ' + openBad + ' dropped');
  ok(under > 100 && underBad === 0, '...and 2 cm under a pavement, where its interior and side are drawn over it', under + ' points, ' + underBad + ' not');
  const vz = O.rec.layers.zones.find(z => z.kind === 'residential' && z.poly && z.poly.length >= 3);
  if (vz) { let cx = 0, cz = 0; for (const q of vz.poly) { cx += q[0]; cz += q[1]; } const w = O.frame.toWorld(cx / vz.poly.length, cz / vz.poly.length);
    ok(Math.abs(PL.dropAt(w[0], w[1]) - PL.PATCH_TUCK.drop) < 1e-12, 'inside a residential zone (' + vz.id + ') the lots keep the patch 2 cm under them (G434.2)', (PL.dropAt(w[0], w[1]) * 1000).toFixed(1) + ' mm'); }
  // the dead end: mn_strip's stand is the START of mn_stand_lane, a dead end; the parked wheels stand just past it
  const mn = C2.siteOf('mn_strip').stand, lane = O.roads.find(r => r.id === 'mn_stand_lane');
  if (lane && mn) {
    const P0 = O.frame.toWorld(lane.pts[0][0], lane.pts[0][1]), P1 = O.frame.toWorld(lane.pts[1][0], lane.pts[1][1]);
    const ul = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), ux = (P1[0] - P0[0]) / ul, uz = (P1[1] - P0[1]) / ul, at = k => [P0[0] + ux * k, P0[1] + uz * k];
    const past = at(-1.5), last = at(1), deep = at(6);
    ok(Math.hypot(P0[0] - mn.x, P0[1] - mn.z) < 0.5, 'mn_strip\'s stand is the start of mn_stand_lane', Math.hypot(P0[0] - mn.x, P0[1] - mn.z).toFixed(2) + ' m');
    // ISLAND-TOUR G1968: the mine's start / park area is an APRON now (mn_m_apron, the gravel look over the stand's pad):
    // past the lane's dead end the ground is paved by design, the patch sunk under the pavement drawn over it - the pit
    // G1542 cured was OPEN ground past the end. Without the apron the probe is G1542's own, unchanged
    const apronM = (O.rec.layers.material || []).find(m => m.id === 'mn_m_apron');
    if (apronM && C2.PREMISES_GEN.inPoly(apronM.poly, ...O.frame.toLocal(past[0], past[1]))) {
      const q = O.pavedAt(past[0], past[1]);
      ok(!!q && q.d > 0 && PL.sinkOf(past[0], past[1]) > 0.03, 'G1542 / G1968: past the dead end the mine\'s apron is paved and the patch sunk under it (the pavement drawn at the ground)',
        q ? q.cls + ' ' + q.d.toFixed(1) + ' m in, the patch ' + (PL.sinkOf(past[0], past[1]) * 100).toFixed(0) + ' cm under' : 'not paved');
    } else {
      ok(!O.pavedAt(past[0], past[1]) && PL.sinkOf(past[0], past[1]) === 0 && Math.abs(PL.at(past[0], past[1]) - W.terrainHBuild(past[0], past[1])) < 0.02,
        'G1542: 1.5 m past the dead end nothing is paved, nothing sunk, the drawn patch within 2 cm of the ground (it was a 0.4-0.6 m pit)', (1000 * (PL.at(past[0], past[1]) - W.terrainHBuild(past[0], past[1]))).toFixed(1) + ' mm');
      const sL = PL.sinkOf(last[0], last[1]), sD = PL.sinkOf(deep[0], deep[1]);
      ok(sL > 0.03 && sL <= 0.0701, '...1 m inside it the patch takes the edge\'s 7 cm, not the deep sink', (sL * 100).toFixed(1) + ' cm');
      ok(sD > 0.5, '...6 m inside, the deep sink', sD.toFixed(2) + ' m');
    }
  } else ok(false, 'mn_stand_lane and mn_strip\'s stand found');
  // the stock build at every stand: its tyres (node - r) on the drawn ground, and the physics contact on terrainH
  const def0 = C2.buildGen(JSON.parse(JSON.stringify(C2.GEN_DEFAULT)));
  const wheels = def0.refs.mains.concat(def0.refs.tw >= 0 ? [def0.refs.tw] : []);
  for (const a of W.aerodromes) {
    const site = C2.siteOf(a.id); if (!site || !site.stand || a.kind === 'water') continue;
    const sim = C2.makeSim(def0, W); sim.reset(0); if (sim.stance) sim.stance();
    C2.placeAtStand(sim, a, site.stand); for (let i = 0; i < 360; i++) sim.step(1 / 60);
    const rows = wheels.map(i => { const x = sim.p[i * 3], z = sim.p[i * 3 + 2], d = GD.drawnAt(x, z); return { on: d.kind, mm: 1000 * (sim.p[i * 3 + 1] - def0.nodes[i].r - d.y), g: 1000 * (d.y - W.terrainH(x, z)) }; });
    // (15 mm: mn_strip's mains stand 0.4-1.5 m past a dead end, where the patch's 2 m cell carries the last 2 m's 2 + 7 cm
    // a little way out - 10-13 mm; the 2 cm drop back reads 20 at w3, the pit 400 at mn_strip)
    ok(rows.every(r => Math.abs(r.mm) < 15 && Math.abs(r.g) < 15), a.id + ': the stock build\'s tyres on the drawn ground at the stand (|tyre - drawn|, |drawn - terrainH| < 15 mm)',
      rows.map(r => r.on + ' ' + r.mm.toFixed(1) + '/' + r.g.toFixed(1)).join(', '));
  }
}

console.log('GATE CONTACT: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
