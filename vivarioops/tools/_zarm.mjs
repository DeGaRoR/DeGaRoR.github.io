// _zarm.mjs — WHICH force is timestep-sensitive? Ratio fine/coarse of path
// speed per arm. Ratio ~1 means that arm is converged.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as C from '../engine/l1/physics.js';
import * as F from '../engine/l1/_zphys_480.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SECONDS = 60, N = 6;
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 12; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan, idx: i });
}
function speed(M, plan, genome, opts) {
  const sim = M.createSimulation(RAPIER, plan, genome, W1_SLICE,
    { bounded: false, wrap: true, effort: 0, turnBias: 0, ...opts });
  for (let s = 0; s < Math.round(3 / M.FIXED_DT); s++) sim.step();
  sim.resetClock(); sim.control.effort = 1;
  const steps = Math.round(SECONDS / M.FIXED_DT), smp = Math.max(1, Math.round(0.25 / M.FIXED_DT));
  let prev = null, dist = 0;
  for (let s = 0; s < steps; s++) {
    sim.step();
    if (s % smp === 0) { const c = sim.bodies[0].translation();
      if (prev) dist += Math.hypot(c.x-prev.x, c.y-prev.y, c.z-prev.z);
      prev = { x: c.x, y: c.y, z: c.z }; }
  }
  sim.free(); return dist / SECONDS;
}
const ARMS = [
  ['baseline',         {}],
  ['addedMass off',    { addedMass: false }],
  ['QUAD via lift off',{ boundTorque: false }],
  ['motorScale x0.25', { motorScale: 0.25 * 1 }],
];
const med = (a) => { const b = a.filter(Number.isFinite).sort((x,y)=>x-y); return b.length ? b[b.length>>1] : NaN; };
console.log('arm                 med speed 1/120   med speed 1/480   ratio');
for (const [lbl, opts] of ARMS) {
  const co = [], fi = [];
  for (const { genome, plan } of corpus) {
    co.push(speed(C, plan, genome, opts));
    fi.push(speed(F, plan, genome, opts));
  }
  const a = med(co), b = med(fi);
  console.log(`${lbl.padEnd(20)} ${a.toExponential(2).padStart(9)}        ${b.toExponential(2).padStart(9)}     ${(b/a).toFixed(3)}`);
}

console.log('\n--- drive path ---');
for (const [lbl, opts] of [['solver (shipped)', {}], ['pd (explicit torque)', { motor: 'pd' }]]) {
  const co = [], fi = [];
  for (const { genome, plan } of corpus) {
    co.push(speed(C, plan, genome, opts)); fi.push(speed(F, plan, genome, opts));
  }
  const a = med(co), b = med(fi);
  console.log(`${lbl.padEnd(22)} ${a.toExponential(2)}  ${b.toExponential(2)}   ratio ${(b/a).toFixed(3)}`);
}
