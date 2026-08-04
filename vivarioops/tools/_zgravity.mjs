// tools/_zgravity.mjs — is `world.gravity` really inert?
//
// A4 corrects W1's gravity from 9.81 to 981 cm/s^2, which is the CGS value the
// units header has always called for. The justification for leaving it wrong was
// that it is unreachable: `applyEnvironment` uses g only in
// `(mediumDensity - density) * V * g`, and SLICE_LIMITS pins density to [1, 1]
// against mediumDensity 1.0, so that term is identically zero.
//
// THAT IS AN ARGUMENT, NOT A MEASUREMENT. A constant that "cannot matter" is
// exactly the kind of claim this repo has been wrong about before — the fluid
// guards were argued inert and were, the force accumulator was never argued
// about at all and was the whole defect. So this runs the corpus at both values
// and requires the centres of mass to agree TO THE BIT.
//
// If it ever stops passing, gravity has become reachable and every trajectory
// measured under the wrong value is invalid.
//
// Run: node tools/_zgravity.mjs [SECONDS=30] [N=10]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const SECONDS = Number(process.argv[2] ?? 30);
const N = Number(process.argv[3] ?? 10);

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 12; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan });
}

function finalCom(plan, genome, gravity) {
  const world = { ...W1_SLICE, gravity };
  const sim = createSimulation(RAPIER, plan, genome, world,
    { bounded: false, wrap: false, effort: 1, turnBias: 0 });
  const steps = Math.round(SECONDS / FIXED_DT);
  for (let s = 0; s < steps; s++) sim.step();
  const c = sim.centreOfMass();
  sim.free();
  return c;
}

console.log(`\n  GRAVITY INERTNESS — ${corpus.length} creatures x ${SECONDS} s, 9.81 vs 981 cm/s^2\n`);
console.log('    #     |dCoM|        verdict');
console.log('  ' + '-'.repeat(44));

let worst = 0;
corpus.forEach(({ plan, genome }, i) => {
  const a = finalCom(plan, genome, 9.81);
  const b = finalCom(plan, genome, 981);
  const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  worst = Math.max(worst, d);
  console.log('  ' + String(i).padStart(3) + d.toExponential(2).padStart(12)
    + (d === 0 ? '   identical' : '   MOVED').padStart(14));
});

console.log(`\n  worst |dCoM| over the corpus: ${worst.toExponential(2)}`);
console.log(worst === 0
  ? '  PASS — gravity is unreachable while density is pinned to [1, 1].\n'
  : '  FAIL — gravity is REACHABLE. Every trajectory measured at 9.81 is invalid.\n');
