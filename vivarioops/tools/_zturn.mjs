// tools/_zturn.mjs — WHERE DOES THE STEERING COMMAND GO? (C1's open question)
//
// turnRate median is 0.0032 rad/s — 0.18 degrees per second. A creature turns
// under three degrees in a fifteen-second window, so no sensor, no plane and no
// gain can close a steering loop. B2 §5 assumed the coordinate convention was
// the reason; it was A reason, it is fixed, and this is the rest.
//
// C1 posed the question as "physics problem or units one". THE UNITS BRANCH IS
// ALREADY NEARLY CLOSED and the codebase says so: controller.js sets
// TURN_AUTHORITY = 1.0, meaning the commanded deflection is the joint's FULL
// angular range, chosen from a sweep at 0.25/0.50/1.00 that measured x1.00 /
// x2.05 / x3.38. You cannot ask a joint for more than its range — beyond 1.0 the
// command lands outside angleLimits and setLimits clamps it, so the extra is
// discarded by the constraint solver rather than delivered.
//
// But that sweep was run on the PD path, BEFORE the solver was defaulted, and
// turnRate fell 10x when it was (0.03 -> 0.0032). So the question is no longer
// "is the constant too small" but "which stage of the chain stopped passing the
// command through". Three stages, measured separately:
//
//   L1  COMMAND      TURN_AUTHORITY * range * side -> the target offset asked for.
//                    Pure arithmetic. If this is not linear the bug is in
//                    targetAngles and nothing else matters.
//   L2  ACTUATION    target offset -> ACHIEVED mean joint angle offset. This is
//                    where a weak or bounded motor loses the command, and where
//                    angleLimits clamps it.
//   L3  HYDRODYNAMICS achieved joint offset -> body turn rate. This is where an
//                    asymmetric gait either does or does not produce a turning
//                    moment against the fluid.
//
// AND A SPECIFIC SUSPECT. The 00 §9 torque bound added at B2 §3.2 sizes itself
// on the WORST-CASE command, which includes the full turn deflection:
//     maxError = |bias| + amplitude*range + TURN_AUTHORITY*range + range
// so a creature that COULD steer hard gets its stiffness divided by a larger
// number, permanently, whether or not it ever issues that command. If that is
// what happened, the bound is paying for steering authority it then prevents.
// `boundTorque: false` isolates it.
//
//   node tools/_zturn.mjs [nRandom]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { TURN_AUTHORITY, turnSides } from '../engine/l1/controller.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const N_RANDOM = Number(process.argv[2] ?? 12);
await RAPIER.init();

const SETTLE = 2.0;
const RUN = 8.0;

/**
 * One run at a fixed turn bias. Returns the achieved mean joint deflection and
 * the body's turn rate, so L2 and L3 can be read separately.
 */
function probe(plan, genome, bias, opts) {
  const sim = createSimulation(RAPIER, plan, genome, { ...W1_SLICE, gravity: 0 },
    { bounded: false, wrap: true, effort: 1, turnBias: 0, ...opts });
  for (let k = 0; k < Math.round(SETTLE / FIXED_DT); k++) sim.step();
  sim.control.turnBias = bias;

  const steps = Math.round(RUN / FIXED_DT);
  const dirs = [];
  let angleSum = 0, angleN = 0;
  let last = sim.centreOfMass();
  for (let k = 0; k < steps; k++) {
    sim.step();
    if (k % 12 === 0) {
      // ACHIEVED joint deflection: the mean signed relative angle, taken against
      // the side pattern so a bilateral creature's two sides do not cancel.
      let s = 0;
      for (let j = 0; j < plan.jointCount; j++) s += sim.relativeAngle(j) * (sim.control.sides ? sim.control.sides[j] : 1);
      angleSum += s / Math.max(1, plan.jointCount); angleN++;

      const c = sim.centreOfMass();
      const d = [c[0] - last[0], c[1] - last[1], c[2] - last[2]];
      const n = Math.hypot(...d);
      if (n > 1e-6) dirs.push([d[0] / n, d[1] / n, d[2] / n]);
      last = c;
    }
  }
  // Turn rate: total swept angle of the velocity direction, per second.
  let total = 0;
  for (let i = 1; i < dirs.length; i++) {
    const p = dirs[i - 1], q = dirs[i];
    const c = [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    total += Math.asin(Math.min(1, Math.hypot(...c)));
  }
  const stiff = sim.motors ? sim.motors.stiff[0] : 0;
  const bounded = sim.motors ? [...sim.motors.bounded].reduce((a, b) => a + b, 0) : 0;
  sim.free();
  return {
    turnRate: total / RUN,
    achieved: angleN ? angleSum / angleN : 0,
    stiff, bounded,
  };
}

/** Differenced across +/- bias, exactly as S3 does, so intrinsic drift cancels. */
function differenced(plan, genome, bias, opts) {
  const a = probe(plan, genome, +bias, opts);
  const b = probe(plan, genome, -bias, opts);
  return {
    turnRate: Math.abs(a.turnRate - b.turnRate) / 2,
    achieved: Math.abs(a.achieved - b.achieved) / 2,
    stiff: a.stiff, bounded: a.bounded,
  };
}

// ── the corpus ───────────────────────────────────────────────────────────────
const subjects = [];
for (const sd of SEEDS) {
  if (sd.id === 'staircase') continue;
  const genome = sd.genome ?? sd;
  try { subjects.push({ id: sd.id, genome, plan: morphogenesis(genome) }); } catch { /* skip */ }
}
let added = 0;
for (let i = 0; added < N_RANDOM; i++) {
  const genome = createRandomGenome(rngFrom('turn', i));
  let plan; try { plan = morphogenesis(genome); } catch { continue; }
  if (plan.bodyCount < 3) continue;
  subjects.push({ id: `r${i}`, genome, plan }); added++;
}

const median = (xs) => { const a = xs.slice().sort((p, q) => p - q); return a[Math.floor(a.length / 2)] ?? 0; };

// ── L1 · the command is pure arithmetic. Verify it before measuring anything. ─
console.log(`\n  _zturn · TURN_AUTHORITY = ${TURN_AUTHORITY} (full joint range)\n`);
console.log('  L1 COMMAND — commanded deflection = TURN_AUTHORITY * range * turnBias');
{
  const s = subjects[0];
  const sides = turnSides(s.plan);
  const nz = [...sides].filter(x => x !== 0).length;
  const allSame = [...sides].every(x => x === sides[0]);
  const range = s.plan.joints[0].angleLimits[0];
  console.log(`     ${s.id}: ${s.plan.jointCount} joints · range ${range.toFixed(3)} rad · `
    + `sides ${allSame ? 'ALL THE SAME (uniform curl)' : 'MIXED (differential)'} · non-zero ${nz}`);
  console.log(`     commanded offset at bias 1.0 = ${(TURN_AUTHORITY * range).toFixed(3)} rad `
    + `= ${(100 * TURN_AUTHORITY).toFixed(0)}% of range — THE COMMAND IS ALREADY MAXIMAL\n`);
}

// ── L2 + L3 · sweep the ask, across actuator and torque bound ────────────────
const CONDITIONS = [
  ['pd',              { motor: 'pd' }],
  ['solver bounded',  { motor: 'solver', boundTorque: true }],
  ['solver unbounded', { motor: 'solver', boundTorque: false }],
];
const BIASES = [0.25, 0.5, 1.0, 2.0, 4.0];

console.log('  L2 ACTUATION + L3 HYDRODYNAMICS — median over '
  + `${subjects.length} creatures (${subjects.length - added} authored + ${added} random)\n`);
console.log(`  ${'condition'.padEnd(18)} ${'bias'.padStart(5)}  ${'achieved rad'.padStart(13)} `
  + `${'turnRate rad/s'.padStart(15)}  ${'deg/s'.padStart(7)}  ${'x vs bias .25'.padStart(13)}`);

for (const [label, opts] of CONDITIONS) {
  const base = { achieved: 0, turn: 0 };
  for (const bias of BIASES) {
    const rows = subjects.map(s => differenced(s.plan, s.genome, bias, opts));
    const ach = median(rows.map(r => r.achieved));
    const turn = median(rows.map(r => r.turnRate));
    if (bias === BIASES[0]) { base.achieved = ach; base.turn = turn; }
    console.log(`  ${label.padEnd(18)} ${String(bias).padStart(5)}  ${ach.toFixed(4).padStart(13)} `
      + `${turn.toFixed(5).padStart(15)}  ${(turn * 180 / Math.PI).toFixed(2).padStart(7)}  `
      + `${(base.turn > 0 ? turn / base.turn : 0).toFixed(2).padStart(13)}`);
  }
  console.log('');
}

// ── the torque bound, isolated ───────────────────────────────────────────────
console.log('  THE TORQUE BOUND — what it costs the joints it is sizing\n');
const b = subjects.map(s => differenced(s.plan, s.genome, 1.0, { motor: 'solver', boundTorque: true }));
const u = subjects.map(s => differenced(s.plan, s.genome, 1.0, { motor: 'solver', boundTorque: false }));
console.log(`  joints reduced by the bound: ${b.filter(r => r.bounded > 0).length}/${b.length} creatures`);
console.log(`  median stiffness   bounded ${median(b.map(r => r.stiff)).toExponential(2)}`
  + `   unbounded ${median(u.map(r => r.stiff)).toExponential(2)}`
  + `   ratio ${(median(b.map(r => r.stiff)) / Math.max(1e-30, median(u.map(r => r.stiff)))).toFixed(3)}`);
console.log(`  median achieved    bounded ${median(b.map(r => r.achieved)).toFixed(4)}`
  + `   unbounded ${median(u.map(r => r.achieved)).toFixed(4)}`);
console.log(`  median turnRate    bounded ${median(b.map(r => r.turnRate)).toFixed(5)}`
  + `   unbounded ${median(u.map(r => r.turnRate)).toFixed(5)}\n`);
