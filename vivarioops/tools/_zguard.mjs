// _zguard.mjs — is the fluid ENERGY GUARD the dt-dependent term? sc = min(1,
// -2P/(dt*Q)) scales the whole fluid force down, and dt is in the denominator:
// a COARSER step throttles drag HARDER. Measure how often it binds, per dt.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as C from '../engine/l1/_zguardphys_120.js';
import * as F from '../engine/l1/_zguardphys_480.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SECONDS = 60, N = 8;
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 12; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan, idx: i });
}
function run(M, plan, genome) {
  M.guardReset();
  const sim = M.createSimulation(RAPIER, plan, genome, W1_SLICE,
    { bounded: false, wrap: true, effort: 0, turnBias: 0 });
  for (let s = 0; s < Math.round(3 / M.FIXED_DT); s++) sim.step();
  sim.resetClock(); sim.control.effort = 1; M.guardReset();
  const steps = Math.round(SECONDS / M.FIXED_DT), smp = Math.max(1, Math.round(0.25/M.FIXED_DT));
  let prev = null, dist = 0;
  for (let s = 0; s < steps; s++) {
    sim.step();
    if (s % smp === 0) { const c = sim.bodies[0].translation();
      if (prev) dist += Math.hypot(c.x-prev.x, c.y-prev.y, c.z-prev.z);
      prev = { x: c.x, y: c.y, z: c.z }; }
  }
  const g = M.guardStats(); sim.free();
  return { speed: dist / SECONDS, mean: g.mean, bind: g.bind };
}
console.log(' #   J      dt=1/120                    dt=1/480              speed');
console.log('        mean sc  bind%   speed |  mean sc  bind%   speed |  ratio');
const rows = [];
for (const { genome, plan, idx } of corpus) {
  const a = run(C, plan, genome), b = run(F, plan, genome);
  rows.push([a, b]);
  console.log(`${String(idx).padStart(2)}  ${String(plan.jointCount).padStart(2)}   ${a.mean.toFixed(3)}   ${(a.bind*100).toFixed(1).padStart(5)}  ${a.speed.toExponential(1)} |   ${b.mean.toFixed(3)}   ${(b.bind*100).toFixed(1).padStart(5)}  ${b.speed.toExponential(1)} |  ${(b.speed/a.speed).toFixed(3)}`);
}
const med = (a) => a.slice().sort((x,y)=>x-y)[a.length>>1];
console.log(`\nmedian mean sc:  1/120 = ${med(rows.map(r=>r[0].mean)).toFixed(3)}   1/480 = ${med(rows.map(r=>r[1].mean)).toFixed(3)}`);
console.log(`median bind%:    1/120 = ${(med(rows.map(r=>r[0].bind))*100).toFixed(1)}%   1/480 = ${(med(rows.map(r=>r[1].bind))*100).toFixed(1)}%`);
