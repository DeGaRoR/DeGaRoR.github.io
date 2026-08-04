// _zfluid.mjs — is the dt-sensitivity in the BODY MOTION or in the FLUID?
// If joint amplitude is dt-invariant but speed is not, the fluid force is the
// non-converged term. Also: a single free body decelerating under drag alone.
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
function probe(M, plan, genome) {
  const sim = M.createSimulation(RAPIER, plan, genome, W1_SLICE,
    { bounded: false, wrap: true, effort: 0, turnBias: 0 });
  for (let s = 0; s < Math.round(3 / M.FIXED_DT); s++) sim.step();
  sim.resetClock(); sim.control.effort = 1;
  const J = plan.jointCount;
  const mx = new Float64Array(J).fill(-1e9), mn = new Float64Array(J).fill(1e9);
  const wx = new Float64Array(J).fill(-1e9), wn = new Float64Array(J).fill(1e9);
  const steps = Math.round(SECONDS / M.FIXED_DT), smp = Math.max(1, Math.round(0.25/M.FIXED_DT));
  let prev = null, dist = 0;
  for (let s = 0; s < steps; s++) {
    sim.step(); const d = sim.motorDiag;
    for (let j = 0; j < J; j++) {
      if (d.theta[j] > mx[j]) mx[j] = d.theta[j]; if (d.theta[j] < mn[j]) mn[j] = d.theta[j];
      if (d.want[j] > wx[j]) wx[j] = d.want[j]; if (d.want[j] < wn[j]) wn[j] = d.want[j];
    }
    if (s % smp === 0) { const c = sim.bodies[0].translation();
      if (prev) dist += Math.hypot(c.x-prev.x, c.y-prev.y, c.z-prev.z);
      prev = { x: c.x, y: c.y, z: c.z }; }
  }
  let sa = 0, sw = 0;
  for (let j = 0; j < J; j++) { sa += mx[j]-mn[j]; sw += wx[j]-wn[j]; }
  sim.free();
  return { amp: sa, cmd: sw, speed: dist / SECONDS };
}
console.log(' #    jointAmp 1/120  1/480   ratio |  cmdAmp ratio | speed ratio');
for (const { genome, plan, idx } of corpus) {
  const a = probe(C, plan, genome), b = probe(F, plan, genome);
  console.log(`${String(idx).padStart(2)}    ${a.amp.toFixed(3).padStart(8)} ${b.amp.toFixed(3).padStart(8)}  ${(b.amp/a.amp).toFixed(3)} |    ${(b.cmd/a.cmd).toFixed(3)}     |   ${(b.speed/a.speed).toFixed(3)}`);
}
