// tools/_zsolver.mjs — RE-DERIVE VIABILITY.minSelfMotion FOR THE SOLVER CORPUS.
//
// B2 §3.2b, and it is not optional. The shipped threshold's own comment records
// how it was chosen: "set below the corpus's tenth percentile (0.013 m) so it
// removes creatures that do nothing at all without becoming the dominant
// rejection cause". THAT PERCENTILE IS FROM THE PD CORPUS. viability.js calls
// createSimulation(..., opts) and follows whatever motor is default, so on the
// day the solver is defaulted the same number becomes a much harsher filter
// than it was calibrated to be — and the symptom shows up three layers away as
// "breeding produces duplicates and the stranger slot is broken".
//
// THE RULE IS UNCHANGED. Only the number moves: below the tenth percentile of
// the new distribution, with the rejection rate it implies reported alongside.
//
//   node tools/_zsolver.mjs [N] [motor]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation } from '../engine/l1/physics.js';
import { VIABILITY } from '../engine/l1/viability.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const N = Number(process.argv[2] ?? 200);
await RAPIER.init();

const SETTLE = VIABILITY.settleSeconds ?? 2;
const STEPS = Math.round(SETTLE / (1 / 120));

function selfMotion(genome, motor) {
  const plan = morphogenesis(genome);
  if (plan.bodyCount < 2) return null;
  // Same conditions viability.js measures in: gravity zero, unbounded.
  const sim = createSimulation(RAPIER, plan, genome, { ...W1_SLICE, gravity: 0 },
    { bounded: false, motor });
  const com0 = sim.centreOfMass ? sim.centreOfMass() : null;
  const p0 = com0 ?? sim.bodies[0].translation();
  const a = [p0.x ?? p0[0], p0.y ?? p0[1], p0.z ?? p0[2]];
  for (let k = 0; k < STEPS; k++) sim.step();
  const p1 = sim.centreOfMass ? sim.centreOfMass() : sim.bodies[0].translation();
  const b = [p1.x ?? p1[0], p1.y ?? p1[1], p1.z ?? p1[2]];
  sim.free();
  const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return Number.isFinite(d) ? d : null;
}

const rows = [];
for (const motor of ['pd', 'solver']) {
  const travel = [];
  for (let i = 0; i < N; i++) {
    const g = createRandomGenome(rngFrom('viab', i));
    const d = selfMotion(g, motor);
    if (d !== null) travel.push(d);
  }
  travel.sort((a, b) => a - b);
  const pct = (q) => travel[Math.floor(travel.length * q)];
  const rejectedAt = (thr) => 100 * travel.filter(x => x < thr).length / travel.length;
  rows.push({ motor, n: travel.length, p10: pct(0.10), p50: pct(0.50), p90: pct(0.90), rejectedAt });
}

console.log(`\n  _zsolver · ${N} genomes · ${SETTLE} s at gravity 0, unbounded — viability.js's own conditions\n`);
console.log(`  ${'motor'.padEnd(8)} ${'n'.padStart(5)} ${'p10'.padStart(10)} ${'p50'.padStart(10)} ${'p90'.padStart(10)}`
  + `   rejected at 0.01 / 0.005 / 0.002`);
for (const r of rows) {
  console.log(`  ${r.motor.padEnd(8)} ${String(r.n).padStart(5)} ${r.p10.toFixed(4).padStart(10)} `
    + `${r.p50.toFixed(4).padStart(10)} ${r.p90.toFixed(4).padStart(10)}   `
    + `${r.rejectedAt(0.01).toFixed(0)}% / ${r.rejectedAt(0.005).toFixed(0)}% / ${r.rejectedAt(0.002).toFixed(0)}%`);
}
console.log(`\n  shipped minSelfMotion = ${VIABILITY.minSelfMotion} (set below the PD corpus p10 of 0.013)\n`);
