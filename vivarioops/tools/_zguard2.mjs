// Does the guard bind during a COAST (high speed), where normal swimming never
// reaches? sc <= m*opposed/(dt*|F|) has dt in the denominator, so a coarser
// step throttles drag harder — exactly the observed direction.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as C from '../engine/l1/_zguardphys_120.js';
import * as F from '../engine/l1/_zguardphys_480.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const corpus = [];
for (let i = 0; corpus.length < 8 && i < 96; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan, idx: i });
}
function coast(M, plan, genome, kick) {
  const sim = M.createSimulation(RAPIER, plan, genome, W1_SLICE,
    { bounded: false, wrap: true, effort: 0, turnBias: 0 });
  for (let s = 0; s < Math.round(3 / M.FIXED_DT); s++) sim.step();
  sim.resetClock(); sim.control.effort = 0;
  for (const rb of sim.bodies) rb.setLinvel({ x: kick, y: 0, z: 0 }, true);
  M.guardReset();
  for (let s = 0; s < Math.round(2 / M.FIXED_DT); s++) sim.step();
  const g = M.guardStats(); sim.free(); return g;
}
for (const kick of [0.5, 2, 5]) {
  console.log(`\nkick ${kick} cm/s`);
  console.log('  #   1/120 mean sc  bind%  |  1/480 mean sc  bind%');
  for (const { genome, plan, idx } of corpus.slice(0, 5)) {
    const a = coast(C, plan, genome, kick), b = coast(F, plan, genome, kick);
    console.log(`${String(idx).padStart(3)}      ${a.mean.toFixed(3)}   ${(a.bind*100).toFixed(1).padStart(5)}  |     ${b.mean.toFixed(3)}   ${(b.bind*100).toFixed(1).padStart(5)}`);
  }
}
