// tools/c1sat.js — is the flat power curve a broken work accumulator (11 §12.3's
// diagnosis) or a saturated motor (the alternative)?
//
// applyMotors clamps the TOTAL torque to `maxTorque = motorScale * area`. If the
// clamp is active on most joint-steps, the motor delivers a constant torque
// regardless of what the oscillator asks for, so raising `effort` cannot raise
// power and 11 §12.3's test is measuring the actuator, not the accumulator.
//
// Measured directly: instrument the clamp by recomputing it outside physics.js.
//
// Run: node tools/c1sat.js [n]

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { createSimulation, FIXED_DT, MOTOR_SCALE, MOTOR_STIFFNESS } from '../engine/l1/physics.js';
import { targetAngles, computePhases, makeControl } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();
const N = Number(process.argv[2] || 12);

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 6; i++) {
  const g = createRandomGenome(rngFrom('c1', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok) corpus.push({ genome: g, plan: v.plan });
}

console.log('COMMANDED vs DELIVERABLE TORQUE\n');
console.log('The restoring term alone is maxTorque * stiffness * (want - theta).');
console.log('Where |want - theta| > 1/stiffness the clamp is already active before');
console.log('the damping term is added at all.\n');
console.log('  effort   clamp active   median |want-theta|   mean |d(theta)/dt|');

for (const effort of [0.6, 1.0, 1.5]) {
  let active = 0, total = 0;
  const errs = [], rates = [];

  for (const { genome, plan } of corpus) {
    const sim = createSimulation(RAPIER, plan, genome, { ...W1_SLICE, gravity: 0 },
      { bounded: false, effort });
    const phases = computePhases(plan);
    const control = makeControl(plan, { effort });
    const want = new Float64Array(plan.jointCount);

    // Settle, as a probe does, then measure over 8 s.
    for (let s = 0; s < Math.round(2 / FIXED_DT); s++) sim.step();
    sim.resetClock();
    sim.control.effort = effort;

    const prev = new Float64Array(plan.jointCount);
    for (let s = 0; s < Math.round(8 / FIXED_DT); s++) {
      sim.step();
      targetAngles(plan, genome, sim.t, phases, want, control);
      for (let i = 0; i < plan.joints.length; i++) {
        const j = plan.joints[i];
        if (j.type === 'rigid') continue;
        // Relative angular speed on the driven axis, as a stand-in for
        // d(theta)/dt without reaching into physics.js internals.
        const a = sim.bodies[j.childBody].angvel(), b = sim.bodies[j.parentBody].angvel();
        const w = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        // The restoring magnitude in units of maxTorque.
        const rel = Math.abs(MOTOR_STIFFNESS * want[i]);
        total++;
        if (rel >= 1) active++;
        if (s % 60 === 0) { errs.push(rel); rates.push(w); prev[i] = w; }
      }
    }
    sim.free();
  }

  const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  console.log(`   ${effort.toFixed(1)}      ${(100 * active / Math.max(1, total)).toFixed(1)}%          ${med(errs).toFixed(3)}                ${mean(rates).toFixed(3)}`);
}

console.log(`\n  MOTOR_SCALE ${MOTOR_SCALE}  MOTOR_STIFFNESS ${MOTOR_STIFFNESS}`);
console.log('  (clamp active = the commanded restoring torque alone already');
console.log('   meets or exceeds maxTorque, before damping is added)');
