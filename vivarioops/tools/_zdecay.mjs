// _zdecay.mjs — is the actuator defect STATIC or does it DEGRADE with time?
// Records per-joint commanded vs achieved angle in 30 s windows over 300 s.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();
const N = Number(process.argv[2] || 8);
const SECONDS = 300, WIN = 30;

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 8; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan });
}
console.log(`corpus ${corpus.length}, ${SECONDS}s, ${WIN}s windows\n`);

const rows = [];
for (const { genome, plan } of corpus) {
  const sim = createSimulation(RAPIER, plan, genome, W1_SLICE, { bounded: false, wrap: true, effort: 0, turnBias: 0 });
  for (let s = 0; s < Math.round(3 / FIXED_DT); s++) sim.step();
  sim.resetClock();
  sim.control.effort = 1;
  const nW = SECONDS / WIN;
  const J = plan.jointCount;
  // per window: sum of |want-neutral|, |theta-neutral|, sat count, steps
  const cmdA = new Float64Array(nW), achA = new Float64Array(nW);
  const satC = new Float64Array(nW), stepC = new Float64Array(nW);
  const comSpeed = new Float64Array(nW);
  // phase: track sign-crossing times of joint 0 and joint J-1 per window
  const lagSum = new Float64Array(nW), lagN = new Float64Array(nW);
  let prev0 = 0, prevL = 0, t0Cross = -1;

  let px = null;
  const steps = Math.round(SECONDS / FIXED_DT);
  for (let s = 0; s < steps; s++) {
    sim.step();
    const w = Math.min(nW - 1, Math.floor(sim.t / WIN));
    const d = sim.motorDiag;
    for (let j = 0; j < J; j++) {
      cmdA[w] += Math.abs(d.want[j]);
      achA[w] += Math.abs(d.theta[j]);
      satC[w] += d.clamped[j];
    }
    stepC[w] += J;
    // travelling-wave check: zero-crossing lag between first and last joint
    const a0 = d.theta[0], aL = d.theta[J - 1];
    if (prev0 < 0 && a0 >= 0) t0Cross = sim.t;
    if (prevL < 0 && aL >= 0 && t0Cross >= 0) {
      const lag = sim.t - t0Cross;
      if (lag > 0 && lag < 5) { lagSum[w] += lag; lagN[w]++; }
    }
    prev0 = a0; prevL = aL;
    if (s % 6 === 0) {
      const c = sim.bodies[0].translation();
      if (px) comSpeed[w] += Math.hypot(c.x - px.x, c.y - px.y, c.z - px.z) / (6 * FIXED_DT);
      px = { x: c.x, y: c.y, z: c.z };
    }
  }
  rows.push({
    J,
    gain: Array.from({ length: nW }, (_, w) => (cmdA[w] > 0 ? achA[w] / cmdA[w] : 0)),
    sat: Array.from({ length: nW }, (_, w) => satC[w] / stepC[w]),
    lag: Array.from({ length: nW }, (_, w) => (lagN[w] ? lagSum[w] / lagN[w] : NaN)),
    spd: Array.from({ length: nW }, (_, w) => comSpeed[w] / (WIN / (6 * FIXED_DT))),
    finalSat: sim.saturation,
  });
  process.stdout.write('.');
}
console.log('\n');

const nW = SECONDS / WIN;
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN; };
const f = (x) => (Number.isFinite(x) ? x.toFixed(3) : ' n/a ');

console.log('window   gain    sat    lag(s)   speed');
for (let w = 0; w < nW; w++) {
  console.log(
    `${String((w + 1) * WIN).padStart(5)}s  ${f(med(rows.map(r => r.gain[w])))}  ${f(med(rows.map(r => r.sat[w])))}  ${f(med(rows.map(r => r.lag[w])))}   ${f(med(rows.map(r => r.spd[w])))}`
  );
}
console.log('\nper-creature gain trajectory (w1 -> w10):');
for (const r of rows) console.log(`  J=${String(r.J).padStart(2)}  ` + r.gain.map(f).join(' '));
