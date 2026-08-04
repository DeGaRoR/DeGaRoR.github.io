// _zdt.mjs — THE decisive test. If halving the timestep removes the energy
// growth, the explosion is NUMERICAL (explicit integration of a velocity-
// dependent force). If it survives, it is a MODEL error and dt is innocent.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as C from '../engine/l1/physics.js';
import * as F from '../engine/l1/_zphys_480.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const N = 16, SECONDS = 200;
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 10; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan, idx: i });
}
const KE = (s) => { let e = 0; for (const rb of s.bodies) { const v = rb.linvel(); e += 0.5 * rb.mass() * (v.x*v.x+v.y*v.y+v.z*v.z); } return e; };

function run(M, plan, genome, opts = {}) {
  const sim = M.createSimulation(RAPIER, plan, genome, W1_SLICE,
    { bounded: false, wrap: true, effort: 0, turnBias: 0, ...opts });
  for (let s = 0; s < Math.round(3 / M.FIXED_DT); s++) sim.step();
  sim.resetClock(); sim.control.effort = 1;
  const steps = Math.round(SECONDS / M.FIXED_DT);
  let e1 = 0, n1 = 0, e2 = 0, n2 = 0, clampHits = 0, samp = 0;
  const smp = Math.round(0.25 / M.FIXED_DT);
  for (let s = 0; s < steps; s++) {
    sim.step();
    if (s % smp === 0) {
      const k = KE(sim); samp++;
      const frac = s / steps;
      if (frac > 0.30 && frac < 0.55) { e1 += k; n1++; }
      if (frac > 0.75) { e2 += k; n2++; }
      const ig = sim.integrity ? sim.integrity() : null;
      if (ig && ig.clampFraction > 0) clampHits++;
    }
  }
  const r = (e2/n2) / (e1/n1);
  sim.free();
  return { ratio: r, keLate: e2/n2, clamp: clampHits/samp };
}

console.log(' #   J    coarse dt=1/120        fine dt=1/480         verdict');
console.log('            ratio     KE          ratio     KE');
let numer = 0, model = 0, stable = 0;
for (const { genome, plan, idx } of corpus) {
  const a = run(C, plan, genome);
  const b = run(F, plan, genome);
  const g = (x) => (Number.isFinite(x) ? x.toFixed(2).padStart(6) : '   n/a');
  const e = (x) => (Number.isFinite(x) ? x.toExponential(1).padStart(8) : '     n/a');
  let v;
  if (a.ratio < 1.25) { v = 'stable'; stable++; }
  else if (b.ratio < 1.25) { v = 'NUMERICAL — fixed by dt'; numer++; }
  else { v = 'model — survives dt'; model++; }
  console.log(`${String(idx).padStart(2)}  ${String(plan.jointCount).padStart(2)}   ${g(a.ratio)} ${e(a.keLate)}     ${g(b.ratio)} ${e(b.keLate)}    ${v}`);
}
console.log(`\nstable ${stable}   numerical ${numer}   model ${model}   of ${corpus.length}`);
