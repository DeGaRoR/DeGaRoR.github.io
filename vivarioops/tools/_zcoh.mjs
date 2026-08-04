// _zcoh.mjs — Denis's symptom: "they swim nicely, then lose consistency".
// Coherence = mean |Pearson r| between ADJACENT joint angle traces in a window.
// A travelling wave holds a stable lag, so r is stable. Decoherence = r falls.
// Also tracks the COMMANDED coherence as a control: the CPG never decoheres, so
// any fall is the BODY losing the wave, not the controller losing it.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();
const N = Number(process.argv[2] || 16);
const SECONDS = 300, WIN = 30, HZ = 10;
const nW = Math.round(SECONDS / WIN), perWin = WIN * HZ;
const every = Math.round(1 / (HZ * FIXED_DT));

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 10; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan });
}

function corr(a, b) {
  const n = a.length; let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sa = 0, sb = 0, sab = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sa += x * x; sb += y * y; sab += x * y; }
  return sa > 1e-12 && sb > 1e-12 ? sab / Math.sqrt(sa * sb) : NaN;
}

const KE = (sim) => {
  let e = 0;
  for (const rb of sim.bodies) { const v = rb.linvel(); e += 0.5 * rb.mass() * (v.x * v.x + v.y * v.y + v.z * v.z); }
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
  const th = Array.from({ length: J }, () => new Float64Array(perWin));
  const wa = Array.from({ length: J }, () => new Float64Array(perWin));
  const cohA = [], cohW = [], keW = [], satW = [], ampR = [];
  let k = 0, satAcc = 0, satN = 0, keAcc = 0, keN = 0;

  const steps = Math.round(SECONDS / FIXED_DT);
  for (let s = 0; s < steps; s++) {
    sim.step();
    const d = sim.motorDiag;
    for (let j = 0; j < J; j++) satAcc += d.clamped[j];
    satN += J;
    if (s % every === 0) {
      for (let j = 0; j < J; j++) { th[j][k] = d.theta[j]; wa[j][k] = d.want[j]; }
      k++;
      keAcc += KE(sim); keN++;
      if (k === perWin) {
        let ca = 0, cw = 0, n = 0, sa = 0, sw = 0;
        for (let j = 0; j + 1 < J; j++) {
          const a = corr(th[j], th[j + 1]), w = corr(wa[j], wa[j + 1]);
          if (Number.isFinite(a) && Number.isFinite(w)) { ca += Math.abs(a); cw += Math.abs(w); n++; }
        }
        for (let j = 0; j < J; j++) {
          let mx = 0, mn = 0, wx = 0, wn = 0;
          for (let i = 0; i < perWin; i++) {
            if (th[j][i] > mx) mx = th[j][i]; if (th[j][i] < mn) mn = th[j][i];
            if (wa[j][i] > wx) wx = wa[j][i]; if (wa[j][i] < wn) wn = wa[j][i];
          }
          sa += mx - mn; sw += wx - wn;
        }
        cohA.push(n ? ca / n : NaN); cohW.push(n ? cw / n : NaN);
        ampR.push(sw > 1e-9 ? sa / sw : NaN);
        keW.push(keAcc / keN); satW.push(satAcc / satN);
        k = 0; satAcc = 0; satN = 0; keAcc = 0; keN = 0;
      }
    }
  }
  rows.push({ J, cohA, cohW, keW, satW, ampR });
  process.stdout.write('.');
  sim.free();
}
console.log('\n');

const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN; };
const g = (x) => (Number.isFinite(x) ? x.toFixed(3) : ' n/a ');
const e = (x) => (Number.isFinite(x) ? x.toExponential(1) : ' n/a ');

console.log('window  coh(achieved)  coh(commanded)  amp ratio   sat     KE');
for (let w = 0; w < nW; w++) {
  console.log(`${String((w + 1) * WIN).padStart(5)}s     ${g(med(rows.map(r => r.cohA[w])))}          ${g(med(rows.map(r => r.cohW[w])))}       ${g(med(rows.map(r => r.ampR[w])))}   ${g(med(rows.map(r => r.satW[w])))}  ${e(med(rows.map(r => r.keW[w])))}`);
}

console.log('\nper-creature: coherence w1 -> w10');
for (const r of rows) console.log(`  J=${String(r.J).padStart(2)}  ` + r.cohA.map(g).join(' '));
console.log('\nper-creature: KE ratio last/first, amp ratio last');
for (const r of rows) console.log(`  J=${String(r.J).padStart(2)}  KE x${g(r.keW[nW - 1] / r.keW[0])}   amp ${g(r.ampR[nW - 1])}`);
