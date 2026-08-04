// _zdecay2.mjs — PASSIVE drag decay vs ACTIVE thrust, under refinement.
// A body coasting to rest tests plain drag integration. A driven body tests
// thrust generation. If passive converges and active does not, the defect is
// in the coupling between joint motion and fluid, not in the drag law.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as C from '../engine/l1/physics.js';
import * as F from '../engine/l1/_zphys_480.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = 8;
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 12; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan, idx: i });
}
// PASSIVE: kick the whole creature, effort 0, measure distance coasted to rest.
function coast(M, plan, genome) {
  const sim = M.createSimulation(RAPIER, plan, genome, W1_SLICE,
    { bounded: false, wrap: true, effort: 0, turnBias: 0 });
  for (let s = 0; s < Math.round(3 / M.FIXED_DT); s++) sim.step();
  sim.resetClock(); sim.control.effort = 0;
  for (const rb of sim.bodies) rb.setLinvel({ x: 5, y: 0, z: 0 }, true);
  const p0 = sim.bodies[0].translation(); const s0 = { x: p0.x, y: p0.y, z: p0.z };
  const steps = Math.round(8 / M.FIXED_DT);
  let halfT = NaN;
  for (let s = 0; s < steps; s++) {
    sim.step();
    if (Number.isNaN(halfT)) {
      const v = sim.bodies[0].linvel();
      if (Math.hypot(v.x, v.y, v.z) < 2.5) halfT = s * M.FIXED_DT;
    }
  }
  const p1 = sim.bodies[0].translation();
  const d = Math.hypot(p1.x - s0.x, p1.y - s0.y, p1.z - s0.z);
  sim.free(); return { dist: d, halfT };
}
// ACTIVE: driven, net displacement rate.
function swim(M, plan, genome) {
  const sim = M.createSimulation(RAPIER, plan, genome, W1_SLICE,
    { bounded: false, wrap: true, effort: 0, turnBias: 0 });
  for (let s = 0; s < Math.round(3 / M.FIXED_DT); s++) sim.step();
  sim.resetClock(); sim.control.effort = 1;
  const steps = Math.round(60 / M.FIXED_DT), smp = Math.max(1, Math.round(0.25/M.FIXED_DT));
  let prev = null, dist = 0;
  for (let s = 0; s < steps; s++) { sim.step();
    if (s % smp === 0) { const c = sim.bodies[0].translation();
      if (prev) dist += Math.hypot(c.x-prev.x, c.y-prev.y, c.z-prev.z);
      prev = { x: c.x, y: c.y, z: c.z }; } }
  sim.free(); return dist / 60;
}
console.log(' #   PASSIVE coast dist          half-time         ACTIVE speed');
console.log('     1/120    1/480   ratio |  1/120  1/480 |  ratio');
const pr = [], ar = [];
for (const { genome, plan, idx } of corpus) {
  const a = coast(C, plan, genome), b = coast(F, plan, genome);
  const sa = swim(C, plan, genome), sb = swim(F, plan, genome);
  pr.push(b.dist / a.dist); ar.push(sb / sa);
  console.log(`${String(idx).padStart(2)}  ${a.dist.toFixed(3).padStart(7)} ${b.dist.toFixed(3).padStart(8)}  ${(b.dist/a.dist).toFixed(3)} |  ${a.halfT.toFixed(3)} ${b.halfT.toFixed(3)} |  ${(sb/sa).toFixed(3)}`);
}
const med = (x) => x.slice().sort((p,q)=>p-q)[x.length>>1];
console.log(`\nmedian PASSIVE coast ratio (fine/coarse): ${med(pr).toFixed(3)}`);
console.log(`median ACTIVE  speed ratio (fine/coarse): ${med(ar).toFixed(3)}`);
