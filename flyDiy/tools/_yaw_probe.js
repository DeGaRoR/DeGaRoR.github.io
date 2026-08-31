#!/usr/bin/env node
// _yaw_probe.js — G115's measurement bench, run by hand, kept because its
// numbers justify decisions the code alone cannot:
//   1. Cn_beta (weathervane stiffness) across the fleet + the stock build —
//      fixes the SIGN convention and the plaque's warn/bad thresholds.
//   2. FREE-YAW DECAY at DEFDAMP 0.5 vs 0.05 — the review's S3 claim
//      ("~half the yaw damping is numerical") measured before any fix is
//      chosen. The fix itself is NOT taken here: it moves the whole fleet
//      and happens WITH the user.
//   3. The derived take-off AIR SEGMENT against the two flown measurements
//      the old 0.8·roll padding was built from (cub 23 m, gen 101 m).
// Usage: node tools/_yaw_probe.js
'use strict';
const C = require('./flight_core.js');
const { makeSim, makeWorld, buildGen, buildCub, buildPA18, buildC172,
        buildJodel, buildDC3, RHO } = C;

console.log('== 1 · Cn_beta, sideslip probe at cruise ==');
const FLEET = { gen: buildGen, cub: buildCub, pa18: buildPA18,
                c172: buildC172, jodel: buildJodel, dc3: buildDC3 };
for (const [nm, mk] of Object.entries(FLEET)) {
  const def = mk();
  const sim = makeSim(def, null); sim.reset(0);
  const V = (def.params.ap && def.params.ap.VCruise) || 30;
  const bet = 0.06;
  const yaw = b => sim.probe([-V * Math.cos(b), 0, -V * Math.sin(b)]).yawLeft;
  const dN = (yaw(bet) - yaw(-bet)) / (2 * bet);
  const g = def.params.gen || {};
  const Sw = g.Sw || 15, span = Math.sqrt(Sw * (g.AR || 6.5));
  const cn = dN / (0.5 * RHO * V * V * Sw * span);
  console.log(`  ${nm.padEnd(6)} dN/dbeta=${dN.toFixed(0).padStart(8)} N·m/rad` +
    `  Cn_beta=${cn.toFixed(4)}  (V=${V.toFixed(1)})`);
}

console.log('== 2 · free-yaw decay, DEFDAMP 0.5 vs 0.05 ==');
function yawDecay(mk, dd) {
  const def = mk();
  if (dd !== undefined) def.params.defDamp = dd;
  const sim = makeSim(def, null); sim.reset(0);
  // free flight: lift the aeroplane clear of the ground model, fly it
  // forward at cruise, and kick a yaw rate about the CG's vertical axis
  const V = (def.params.ap && def.params.ap.VCruise) || 30;
  const cg = sim.cgPos();
  for (let i = 0; i < sim.n; i++) sim.p[i * 3 + 1] += 400;
  const w0 = 0.30;                                   // rad/s initial yaw rate
  for (let i = 0; i < sim.n; i++) {
    const rx = sim.p[i * 3] - cg[0], rz = sim.p[i * 3 + 2] - cg[2];
    sim.v[i * 3] = -V + w0 * rz;                     // omega x r, y-axis
    sim.v[i * 3 + 2] = -w0 * rx;
  }
  sim.ctl.thr = 0; sim.ctl.de = sim.ctl.da = sim.ctl.dr = 0;
  // measured yaw rate: from the nose axis swing per step
  const rate = () => { const [xA] = sim.axes(); return Math.atan2(-xA[2], -xA[0]); };
  let hd0 = rate(), t = 0, half = null;
  let wPrev = null, wPeak = null;
  for (let s = 0; s < 12 * 60; s++) {
    const h0 = rate();
    sim.step(1 / 60); t += 1 / 60;
    let dh = rate() - h0;
    if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI;
    const w = dh * 60;
    if (wPeak === null) wPeak = Math.abs(w);
    if (half === null && Math.abs(w) < wPeak / 2) half = t;
    wPrev = w;
  }
  return { half, wEnd: wPrev };
}
for (const [nm, mk] of [['gen', buildGen], ['cub', buildCub]]) {
  const a = yawDecay(mk, undefined);
  const b = yawDecay(mk, 0.05);
  console.log(`  ${nm.padEnd(5)} half-life  DEFDAMP 0.5: ${a.half ? a.half.toFixed(2) + ' s' : '>12 s'}` +
    `   DEFDAMP 0.05: ${b.half ? b.half.toFixed(2) + ' s' : '>12 s'}`);
}

console.log('== 3 · derived take-off air segment vs the flown measurements ==');
for (const [nm, mk, flown] of [['cub', buildCub, 23], ['gen', buildGen, 101]]) {
  const def = mk();
  const world = makeWorld();
  const sim = makeSim(def, world); sim.reset(0);
  const W = sim.totalM * 9.81;
  const r = C.genTORunAt(sim, def, W);
  console.log(`  ${nm.padEnd(5)} roll=${r.sRoll} m  air=${r.air} m` +
    `  (flown air-to-2.5m: ${flown} m)  TORun=${r.TORun} m`);
}
