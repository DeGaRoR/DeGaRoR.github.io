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
  for (const x of w) ok(Math.abs(x.drawnMm) < 8, 'stock ' + x.kind + ': the drawn tyre on the ground at rest', x.drawnMm + ' mm');
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
  ok(b2.filter(b => b.len < 1).length === 0, 'past `reach` the wheels cast no blob', b2.length + ' left (the body\'s fades by bodyReach)');
  ok(CS.blobsFor({ p: sim.p, hydro: {} }, def, flat, { axis: ax }).length === 0, 'on floats (sim.hydro) no blob');
  const wet = { terrainH: () => 0, waterH: () => 0.5 };
  ok(CS.blobsFor(sim, def, wet, { axis: ax }).filter(b => b.len < 1).length === 0, 'over drawn water no wheel blob');
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

console.log('GATE CONTACT: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
