#!/usr/bin/env node
// GATE HEADING (G2470 JODEL-PITCH) - THE AIR HAS NO PREFERRED HEADING.
//
// The Munk body couple (30_solver, G461) divided its moment by the fore-to-aft ring spacing measured in the WORLD
// x-y plane: the body's length flying along x, less on any other heading - the couple grew as 1 / cos(heading) and
// switched off within 9 deg of world +-z. GATE ROUTE's Jodel flew 1890 N.m of it for a true 300 on WP4's leg, the pilot
// held 0.12 of nose-down elevator against it, and when it vanished the nose dropped at 9.6 deg/s (the porpoise). G970's
// world-z span in the induction's template was the same mistake. This gate flies the SAME open-loop seconds on eight
// headings and asks the same aeroplane back: a world-frame term anywhere in the air's forces shows as a heading that
// flies differently.
//
//   node tools/_heading_check.js             -> "GATE HEADING: PASS|FAIL"
//   node tools/_heading_check.js --show      the per-build spread
//   node tools/_heading_check.js --selftest  the old world-plane arm put back in a copy of the core: must go red
//
// Each validated build (the user's Cub, the Jodel, the metal Cessna, the Cessna on floats, the twin on floats -
// tools/_treecrash_lib.js BUILDS), damage off, no world (no ground, no wind): placed 1000 m up at its cruise speed with
// 4 deg of alpha, the throttle at its cruise, the engines running, every control fixed (0.10 of nose-up elevator held: the
// aeroplane pitches, which is what is compared), yawed about its CG to 0, 45, ... 315 deg, then 3 s of steps. Against heading 0:
// the pitch, the bank, the alpha, the vertical speed and the turn (heading change) every step, within TOL.
'use strict';
const fs = require('fs'), path = require('path'), Module = require('module');
const T = __dirname;
const argv = process.argv.slice(2);
const SHOW = argv.includes('--show'), SELF = argv.includes('--selftest');
const KEYS = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];
const HDGS = [0, 45, 90, 135, 180, 225, 270, 315];
const SECS = 3, DT = 1 / 60, DE = 0.10;   // 0.10 of nose-up elevator held: every build pitches several degrees
// the tolerance: round-off of a rotated state through 180 frames of the solver (measured on the fixed tree: <= 1.1e-6
// deg, 4e-7 m/s - the floats' hulls the most); the world-plane arm it guards against spread the eight headings by 2.7 -
// 11.8 deg of pitch in these 3 s (--selftest)
const TOL = { deg: 1e-3, vs: 1e-3 };

// --selftest: the core with the arm measured in the world's x-y plane again (the pre-G2470 line), compiled from text
function doctoredCore() {
  const F = path.join(T, 'flight_core.js');
  let s = fs.readFileSync(F, 'utf8');
  const fixed = 'const L = Math.abs((bx - ax) * xAft[0] + (by - ay) * xAft[1] + (bz - az) * xAft[2]);';
  if (!s.includes(fixed)) throw new Error('selftest: the arm line not found in flight_core.js');
  s = s.replace(fixed, 'const L = hyp2(bx - ax, by - ay);');
  const m = new Module(F, null); m.filename = F; m.paths = Module._nodeModulePaths(T);
  m._compile(s, F); require.cache[F] = m; m.loaded = true;
}
if (SELF) doctoredCore();
const L = require(path.join(T, '_treecrash_lib.js'));
const C = L.core();
const D = 180 / Math.PI;

function fly(def, psiDeg) {
  const sim = C.makeSim(def, null);
  sim.reset(0);
  const n = sim.p.length / 3, p = sim.p, v = sim.v, m = sim.m;
  let cx = 0, cy = 0, cz = 0, M = 0;
  for (let i = 0; i < n; i++) { cx += p[i*3] * m[i]; cy += p[i*3+1] * m[i]; cz += p[i*3+2] * m[i]; M += m[i]; }
  cx /= M; cy /= M; cz /= M;
  const A = def.params.ap || {}, V = A.VCruise || 30, al = 4 / D;
  const psi = psiDeg / D, c = Math.cos(psi), s = Math.sin(psi);
  // the def's nose points to -x: the velocity forward and down by alpha (the air from below), then everything yawed
  const v0x = -V * Math.cos(al), v0y = -V * Math.sin(al);
  for (let i = 0; i < n; i++) {
    const x = p[i*3] - cx, z = p[i*3+2] - cz;
    p[i*3] = cx + c * x + s * z; p[i*3+1] += 1000; p[i*3+2] = cz - s * x + c * z;
    v[i*3] = c * v0x; v[i*3+1] = v0y; v[i*3+2] = -s * v0x;
  }
  if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
  sim.ctl.thr = A.thrCruise ?? 0.6; sim.ctl.de = DE; sim.ctl.da = 0; sim.ctl.dr = 0;
  const out = [];
  let h0 = null;
  for (let k = 0; k < SECS / DT; k++) {
    sim.step(DT);
    const o = sim.out;
    if (h0 === null) h0 = o.hdg;
    let dh = o.hdg - h0; dh = (dh - 2 * Math.PI * Math.round(dh / (2 * Math.PI))) * D;   // (out.hdg is radians)
    out.push([o.pitch * D, o.roll * D, o.alpha * D, o.vs, dh]);   // (out.pitch / roll / alpha are radians)
    if (!L.finite(sim)) break;
  }
  return out;
}

const fail = [];
const t0 = Date.now();
for (const key of KEYS) {
  const def = L.defOf(key, { elastic: true });
  const ref = fly(def, 0);
  let worst = { d: 0, at: '' }, worstVs = 0, motion = 0;
  for (const r of ref) motion = Math.max(motion, Math.abs(r[0] - ref[0][0]));
  for (const h of HDGS.slice(1)) {
    const tr = fly(def, h);
    if (tr.length !== ref.length) { fail.push(key + ' at ' + h + ' deg: the flight ended early'); continue; }
    for (let k = 0; k < tr.length; k++) {
      for (const j of [0, 1, 2, 4]) { const d = Math.abs(tr[k][j] - ref[k][j]); if (d > worst.d) worst = { d, at: h + ' deg, t ' + ((k + 1) * DT).toFixed(2) + ' s, ' + ['pitch', 'bank', 'alpha', '', 'turn'][j] }; }
      worstVs = Math.max(worstVs, Math.abs(tr[k][3] - ref[k][3]));
    }
  }
  const ok = worst.d <= TOL.deg && worstVs <= TOL.vs && motion > 1;
  if (!ok) fail.push(key + ': the same seconds flown differently on another heading - ' + worst.d.toExponential(2) + ' deg (' + worst.at + '), vs ' + worstVs.toExponential(2) + ' m/s' + (motion > 1 ? '' : ' (the reference did not pitch: ' + motion.toFixed(2) + ' deg - nothing compared)'));
  if (SHOW || !ok) console.log('  ' + key + ': pitch moved ' + motion.toFixed(1) + ' deg in ' + SECS + ' s; worst spread over 8 headings ' + worst.d.toExponential(2) + ' deg (' + worst.at + '), vs ' + worstVs.toExponential(2) + ' m/s');
}
const secs = ((Date.now() - t0) / 1000).toFixed(0);
if (SELF) {
  const caught = fail.length > 0;
  console.log('selftest: the world-plane arm put back - ' + fail.length + ' build(s) caught: ' + fail.map(f => f.split(':')[0]).join(', '));
  console.log('GATE HEADING: ' + (caught ? 'PASS' : 'FAIL') + ' (selftest, ' + secs + ' s)');
  process.exit(caught ? 0 : 1);
}
for (const f of fail) console.log('  FAIL ' + f);
console.log('HEADING: ' + fail.length + ' failure(s), ' + secs + ' s');
console.log('GATE HEADING: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
