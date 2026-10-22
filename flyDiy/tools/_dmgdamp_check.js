#!/usr/bin/env node
// GATE DMGDAMP (G1886, DMG-DAMP): THE DEFORMATION DAMPER TAKES DEFORMATION, NOT ROTATION. The solver's DEFDAMP (0.5 /s)
// damped every node's velocity off the MEAN velocity, and a rigid rotation is not in the mean: the independent review
// (2026-10-04, D1) measured the stock build's roll, pitch and yaw decaying as exp(-0.5 t) in vacuum, a 2 s angular
// damper on every aeroplane, independent of the air. G1885 damps only the velocity off the RIGID-BODY field
// (v_cm + w x r, w = I^-1 L about the CG). On the five validated builds (the user's Cub, the Jodel, the metal Cessna,
// the Cessna on floats, the twin on floats), in VACUUM (the air at 1e-9 kg/m3 through setAtmos, no world, 3 km up so
// the solver's world-less ground at y = 0 is never reached; gravity as the solver has it, uniform, so no torque about
// the CG), spun at 1 rad/s about the body's roll, pitch and yaw axes for 10 s:
//   - L about the CG kept: |L(t) - L0| / |L0| <= 1e-3 over the 10 s. In the continuum it is exact (no external torque);
//     the solver's other parts (the shape-matched rigid clusters - the floats' hulls -, symplectic Euler at a finite
//     step, the air left at 1e-9) drift up to ~2e-4 (measured, the twin on floats) WITH THE DAMPER OFF (defDamp 0),
//     so 1e-3 is that with a 5x margin and a thousandth of what the old damper took (99.3 % of L by 10 s);
//   - the damper's OWN share: L with the damper on against L with it off (defDamp 0), the same start, every second:
//     |L_on - L_off| / |L0| <= 1e-5 (the damper may take energy out of the deformation, never angular momentum);
//   - THE CONTROL: the pre-G1885 damper (params.defDampMean, kept for this gate only) reproduces the review's
//     measurement: L(t)/L0 = exp(-0.5 t) within 1 % at 1, 2 and 4 s, every build, every axis.
// And a PLUCKED wing still rings down (the deformation is still damped): in the same vacuum, after 2 s of free fall
// (the 1 g sag let go), the right wingtip node (largest rest z) flicked at 1 m/s along body up; the strain energy above
// the free-fall rest, its peak per 0.5 s window over 5 s:
//   - the last window <= 2 % of the first (the ring decays);
//   - the last window <= 0.5 x the damper-off run's (DEFDAMP still does the work, the beams' own dampers alone do less);
//   - every window within 10 % of the old damper's (the deformation is damped as before: a pluck carries no rotation
//     worth the name, so the old and the new damper see the same deformation).
//   node tools/_dmgdamp_check.js [--show]       -> "GATE DMGDAMP: PASS|FAIL"
'use strict';
const path = require('path');
const L = require(path.join(__dirname, '_treecrash_lib.js'));
const C = L.core();
const SHOW = process.argv.includes('--show');
const KEYS = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];
const AXES = ['roll', 'pitch', 'yaw'];
const VAC = Object.assign({}, C.ATMOS_ISA, { rho: () => 1e-9, sigma: () => 1e-9 / C.ATMOS_ISA.rho(0) });
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; if (!ok || SHOW) console.log((ok ? 'PASS ' : 'FAIL ') + line); };

function vacSim(key, mode) {
  const d = L.defOf(key, { elastic: true });
  if (mode === 'mean') d.params.defDampMean = true;
  if (mode === 'off') d.params.defDamp = 0;
  const sim = C.makeSim(d, null); sim.reset(0);
  sim.setAtmos(VAC, 0);
  for (let i = 0; i < sim.n; i++) sim.p[i*3+1] += 3000;
  return { sim, m: d.nodes.map(nd => nd.m), def: d };
}
function Lcg(sim, m) {
  const c = sim.cgPos(), u = sim.cgVel(), Lv = [0, 0, 0];
  for (let i = 0; i < sim.n; i++) {
    const rx = sim.p[i*3] - c[0], ry = sim.p[i*3+1] - c[1], rz = sim.p[i*3+2] - c[2];
    const vx = sim.v[i*3] - u[0], vy = sim.v[i*3+1] - u[1], vz = sim.v[i*3+2] - u[2];
    Lv[0] += m[i] * (ry*vz - rz*vy); Lv[1] += m[i] * (rz*vx - rx*vz); Lv[2] += m[i] * (rx*vy - ry*vx);
  }
  return Lv;
}
// spun rigidly at 1 rad/s about a body axis; L about the CG every second for 10 s
function spin(key, axis, mode) {
  const { sim, m } = vacSim(key, mode);
  const ax = sim.axes(), a = axis === 'roll' ? ax[0] : axis === 'pitch' ? ax[2] : ax[1], c = sim.cgPos();
  for (let i = 0; i < sim.n; i++) {
    const rx = sim.p[i*3] - c[0], ry = sim.p[i*3+1] - c[1], rz = sim.p[i*3+2] - c[2];
    sim.v[i*3] = a[1]*rz - a[2]*ry; sim.v[i*3+1] = a[2]*rx - a[0]*rz; sim.v[i*3+2] = a[0]*ry - a[1]*rx;
  }
  const out = [Lcg(sim, m)];
  for (let f = 1; f <= 600; f++) { sim.step(1 / 60); if (f % 60 === 0) out.push(Lcg(sim, m)); }
  return out;
}
const nrm = v => Math.hypot(v[0], v[1], v[2]);
const dif = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// the pluck: the peak strain energy above the free-fall rest per 0.5 s window, 5 s
function pluck(key, mode) {
  const { sim, def } = vacSim(key, mode);
  for (let f = 0; f < 120; f++) sim.step(1 / 60);
  let tip = 0; for (let i = 1; i < sim.n; i++) if (def.nodes[i].p[2] > def.nodes[tip].p[2]) tip = i;
  const E = () => { let e = 0; for (const b of sim.beams) { if (b.broken) continue; const x = b.strain * b.L0 / (b.sK || 1); e += 0.5 * b.k * x * x; } return e; };
  const E0 = E(), up = sim.axes()[1];
  for (let k = 0; k < 3; k++) sim.v[tip*3+k] += up[k];
  const win = []; let pk = 0;
  for (let f = 1; f <= 300; f++) { sim.step(1 / 60); pk = Math.max(pk, E() - E0); if (f % 30 === 0) { win.push(pk); pk = 0; } }
  return win;
}

const res = { spin: {}, pluck: {} };
for (const key of KEYS) {
  const lab = L.BUILDS[key].label;
  for (const axis of AXES) {
    const on = spin(key, axis, 'on'), off = spin(key, axis, 'off'), mean = spin(key, axis, 'mean');
    const N0 = nrm(on[0]);
    let drift = 0, share = 0, ctl = 0;
    for (let s = 1; s <= 10; s++) { drift = Math.max(drift, dif(on[s], on[0]) / N0); share = Math.max(share, dif(on[s], off[s]) / N0); }
    for (const s of [1, 2, 4]) ctl = Math.max(ctl, Math.abs(nrm(mean[s]) / N0 / Math.exp(-0.5 * s) - 1));
    res.spin[key + ':' + axis] = { L0: N0, on: on.map(v => nrm(v) / N0), off: off.map(v => nrm(v) / N0), mean: mean.map(v => nrm(v) / N0), drift, share };
    verdict(drift <= 1e-3, `${lab} ${axis}: |L - L0| / L0 over 10 s = ${drift.toExponential(2)} (<= 1e-3; the old damper: L(10 s) / L0 = ${(nrm(mean[10]) / N0).toFixed(4)})`);
    verdict(share <= 1e-5, `${lab} ${axis}: the damper's own share |L_on - L_off| / L0 = ${share.toExponential(2)} (<= 1e-5)`);
    verdict(ctl <= 0.01, `${lab} ${axis}: CONTROL, the pre-G1885 damper: L / L0 at 1, 2, 4 s = ${[1, 2, 4].map(s => (nrm(mean[s]) / N0).toFixed(3)).join(', ')} against exp(-0.5 t) = 0.607, 0.368, 0.135 (worst ${(100 * ctl).toFixed(2)} %, <= 1 %)`);
  }
  const pOn = pluck(key, 'on'), pOff = pluck(key, 'off'), pMean = pluck(key, 'mean');
  res.pluck[key] = { on: pOn, off: pOff, mean: pMean };
  const last = pOn.length - 1, f = x => x.toExponential(2);
  verdict(pOn[last] <= 0.02 * pOn[0], `${lab} pluck: the strain energy's peak, last window / first = ${f(pOn[last])} / ${f(pOn[0])} J = ${(pOn[last] / pOn[0]).toExponential(2)} (<= 2e-2)`);
  verdict(pOn[last] <= 0.5 * pOff[last], `${lab} pluck: the last window ${f(pOn[last])} J against the damper off ${f(pOff[last])} J (<= 0.5 x)`);
  const wDev = Math.max(...pOn.map((x, i) => Math.abs(x / pMean[i] - 1)));
  verdict(wDev <= 0.1, `${lab} pluck: every window against the old damper's, worst ${(100 * wDev).toFixed(2)} % (<= 10 %)`);
}
if (process.argv.includes('--json')) console.log('JSON ' + JSON.stringify(res));
console.log(fails ? `GATE DMGDAMP: FAIL (${fails})` : 'GATE DMGDAMP: PASS');
process.exit(fails ? 1 : 0);
