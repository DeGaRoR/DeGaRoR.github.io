// _zstiff.mjs — does making the actuator STRONGER fix the instability or feed it?
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = 16, SECONDS = 150;
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 10; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan });
}
const KE = (s) => { let e = 0; for (const rb of s.bodies) { const v = rb.linvel(); e += 0.5 * rb.mass() * (v.x*v.x+v.y*v.y+v.z*v.z); } return e; };
const med = (a) => { const b = a.filter(Number.isFinite).sort((x,y)=>x-y); return b.length ? b[b.length>>1] : NaN; };
const g3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : ' n/a ');
console.log('budgetScale  medKEratio  frac(KE>2x)  medAmpRatio  medSat  frac nonfinite');
for (const bs of [1, 3, 6, 12, 24]) {
  const keR = [], amp = [], sat = [];
  let bad = 0;
  for (const { genome, plan } of corpus) {
    const sim = createSimulation(RAPIER, plan, genome, W1_SLICE,
      { bounded: false, wrap: true, effort: 0, turnBias: 0, budgetScale: bs });
    for (let s = 0; s < Math.round(3 / FIXED_DT); s++) sim.step();
    sim.resetClock(); sim.control.effort = 1;
    const J = plan.jointCount;
    let ke0 = 0, ke1 = 0, n0 = 0, n1 = 0, sA = 0, sN = 0;
    let aMax = new Float64Array(J), aMin = new Float64Array(J), wMax = new Float64Array(J), wMin = new Float64Array(J);
    const steps = Math.round(SECONDS / FIXED_DT), half = steps / 2;
    for (let s = 0; s < steps; s++) {
      sim.step(); const d = sim.motorDiag;
      for (let j = 0; j < J; j++) sA += d.clamped[j];
      sN += J;
      if (s > half) for (let j = 0; j < J; j++) {
        if (d.theta[j] > aMax[j]) aMax[j] = d.theta[j]; if (d.theta[j] < aMin[j]) aMin[j] = d.theta[j];
        if (d.want[j] > wMax[j]) wMax[j] = d.want[j]; if (d.want[j] < wMin[j]) wMin[j] = d.want[j];
      }
      if (s % 30 === 0) { const k = KE(sim); if (s < steps*0.2) { ke0 += k; n0++; } else if (s > steps*0.8) { ke1 += k; n1++; } }
    }
    let sa = 0, sw = 0;
    for (let j = 0; j < J; j++) { sa += aMax[j]-aMin[j]; sw += wMax[j]-wMin[j]; }
    const r = (ke1/n1)/(ke0/n0);
    if (!Number.isFinite(r)) bad++; else keR.push(r);
    amp.push(sw > 1e-9 ? sa/sw : NaN); sat.push(sA/sN);
    sim.free();
  }
  console.log(`${String(bs).padStart(10)}  ${g3(med(keR))}       ${g3(keR.filter(x=>x>2).length/N)}        ${g3(med(amp))}      ${g3(med(sat))}   ${g3(bad/N)}`);
}
