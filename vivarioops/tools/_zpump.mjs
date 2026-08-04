// _zpump.mjs — is the actuator INJECTING energy? `work` uses |tau*omega| and
// therefore cannot tell injection from dissipation. This splits the sign.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();
const N = Number(process.argv[2] || 8);
const SECONDS = Number(process.argv[3] || 300), WIN = 30;
const nW = Math.round(SECONDS / WIN);

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 8; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan });
}

const KE = (sim) => {
  let e = 0;
  for (const rb of sim.bodies) {
    const v = rb.linvel(), w = rb.angvel(), m = rb.mass();
    e += 0.5 * m * (v.x * v.x + v.y * v.y + v.z * v.z);
    e += 0.5 * m * (w.x * w.x + w.y * w.y + w.z * w.z) * 0.1;
  }
  return e;
};

const rows = [];
for (const { genome, plan } of corpus) {
  const sim = createSimulation(RAPIER, plan, genome, W1_SLICE,
    { bounded: false, wrap: true, effort: 0, turnBias: 0 });
  for (let s = 0; s < Math.round(3 / FIXED_DT); s++) sim.step();
  sim.resetClock();
  sim.control.effort = 1;

  const J = plan.jointCount;
  const inj = new Float64Array(nW), dis = new Float64Array(nW);
  const ke = new Float64Array(nW), keN = new Float64Array(nW);
  const om = new Float64Array(nW), omN = new Float64Array(nW);
  const fvS = new Float64Array(nW);

  const steps = Math.round(SECONDS / FIXED_DT);
  for (let s = 0; s < steps; s++) {
    sim.step();
    const w = Math.min(nW - 1, Math.floor(sim.t / WIN));
    const d = sim.motorDiag;
    for (let j = 0; j < J; j++) {
      // spring torque times joint rate: >0 means the SPRING is doing positive
      // work on the joint, i.e. the actuator is injecting.
      const p = d.springTau[j] * d.relOmega[j];
      if (p > 0) inj[w] += p * FIXED_DT; else dis[w] -= p * FIXED_DT;
      om[w] += Math.abs(d.relOmega[j]); omN[w]++;
      fvS[w] += Math.max(0, 1 - Math.abs(d.relOmega[j]) / 10);
    }
    if (s % 30 === 0) { ke[w] += KE(sim); keN[w]++; }
  }
  rows.push({
    J,
    inj: Array.from(inj), dis: Array.from(dis),
    ke: Array.from({ length: nW }, (_, w) => ke[w] / (keN[w] || 1)),
    om: Array.from({ length: nW }, (_, w) => om[w] / (omN[w] || 1)),
    fv: Array.from({ length: nW }, (_, w) => fvS[w] / (omN[w] || 1)),
  });
  process.stdout.write('.');
  sim.free();
}
console.log('\n');

const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN; };
const f = (x, n = 3) => (Number.isFinite(x) ? x.toExponential(n) : ' n/a ');
const g = (x) => (Number.isFinite(x) ? x.toFixed(3) : ' n/a ');

console.log('window   inject     dissip    inj/dis   meanKE     |relOmega|   fv');
for (let w = 0; w < nW; w++) {
  const i = med(rows.map(r => r.inj[w])), d = med(rows.map(r => r.dis[w]));
  console.log(`${String((w + 1) * WIN).padStart(5)}s  ${f(i, 2)}  ${f(d, 2)}  ${g(i / d)}  ${f(med(rows.map(r => r.ke[w])), 2)}  ${g(med(rows.map(r => r.om[w])))}      ${g(med(rows.map(r => r.fv[w])))}`);
}
console.log('\nper-creature KE trajectory:');
for (const r of rows) console.log(`  J=${String(r.J).padStart(2)}  ` + r.ke.map(x => f(x, 1)).join(' '));
