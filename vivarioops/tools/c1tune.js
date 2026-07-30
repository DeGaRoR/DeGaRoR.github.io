// tools/c1tune.js — three follow-up measurements from tools/c1probe.js.
//
//  A. TURN_AUTHORITY is a stimulus amplitude. Is the response linear in it, or
//     does it saturate? If linear, the constant is a pure scale and only the
//     ORDERING of turnRate matters. If saturating, there is a right value.
//  B. 11 §12.3 asserts speed and power both rise with effort. c1probe found
//     burstRatio p10 = 0.607, so SPEED does not. Does POWER — which is what that
//     test is actually about, the work accumulator?
//  C. Does measuring in-tank rather than at gravity zero REORDER creatures?
//     Magnitudes differing by 1.35x is tolerable; a different ranking is not.
//
// Run: node tools/c1tune.js [n]

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { runSolo, indexAt, meanSpeed, meanPower, meanTurnRate } from '../engine/l2/probe.js';
import { S2, S2_DURATION, S2_WINDOW, S3_DURATION } from '../engine/l2/probes.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();
const N = Number(process.argv[2] || 20);
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(4) : String(x));
const q = (a, f) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length * f)] : 0);

/** Spearman rank correlation — the question is ordering, not magnitude. */
function spearman(a, b) {
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((p, r) => p[0] - r[0]);
    const out = new Array(v.length);
    idx.forEach(([, i], r) => { out[i] = r; });
    return out;
  };
  const ra = rank(a), rb = rank(b), n = a.length;
  let d2 = 0;
  for (let i = 0; i < n; i++) d2 += (ra[i] - rb[i]) ** 2;
  return 1 - (6 * d2) / (n * (n * n - 1));
}

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 6; i++) {
  const g = createRandomGenome(rngFrom('c1', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok) corpus.push({ genome: g, plan: v.plan });
}

// ── A. turn response vs stimulus amplitude ───────────────────────────────────
// runSolo takes turnBias in [-1,1] and controller.js multiplies by
// TURN_AUTHORITY. Sweeping turnBias sweeps the product, which is the same knob.
console.log('A. TURN RESPONSE vs STIMULUS  (turnRate, rad/s, differential)\n');
const AMPS = [0.25, 0.5, 1.0];
const byAmp = AMPS.map(() => []);

for (const { genome, plan } of corpus) {
  AMPS.forEach((amp, k) => {
    const rates = [];
    for (const sign of [+1, -1]) {
      const r = runSolo(RAPIER, {
        plan, genome, world: W1_SLICE, duration: S3_DURATION, turnBias: sign * amp,
      });
      if (!r.valid) { rates.push(NaN); continue; }
      rates.push(meanTurnRate(r.trace, 0, r.trace.n, new Float64Array(r.trace.n)));
    }
    byAmp[k].push(Math.abs(rates[0] - rates[1]) / 2);
  });
}

console.log('  stimulus   p10      p50      p90     vs 0.25');
AMPS.forEach((amp, k) => {
  const c = byAmp[k].filter(Number.isFinite);
  const base = q(byAmp[0].filter(Number.isFinite), 0.5);
  console.log(`   ${amp.toFixed(2)}      ${fmt(q(c, 0.1))}  ${fmt(q(c, 0.5))}  ${fmt(q(c, 0.9))}   x${(q(c, 0.5) / base).toFixed(2)}`);
});
const rankStable = spearman(byAmp[0], byAmp[2]);
console.log(`  ordering at 0.25 vs 1.00: Spearman ${fmt(rankStable)}\n`);

// ── B. monotonicity — 11 §12.3 ───────────────────────────────────────────────
console.log('B. MONOTONICITY IN EFFORT  (11 §12.3)\n');
let speedUp = 0, powerUp = 0, powerSuper = 0, n = 0;
const detail = [];
for (const { genome, plan } of corpus) {
  const vs = [], ps = [];
  for (const effort of [0.6, 1.0, 1.5]) {
    const r = runSolo(RAPIER, { plan, genome, world: W1_SLICE, duration: S2_DURATION, effort });
    if (!r.valid) { vs.length = 0; break; }
    const from = indexAt(r.trace, S2_DURATION - S2_WINDOW);
    vs.push(meanSpeed(r.trace, from, r.trace.n));
    ps.push(meanPower(r.trace, from, r.trace.n));
  }
  if (vs.length !== 3) continue;
  n++;
  if (vs[0] <= vs[1] && vs[1] <= vs[2]) speedUp++;
  if (ps[0] <= ps[1] && ps[1] <= ps[2]) powerUp++;
  // "faster than linearly" in EFFORT: power(1.5)/power(0.6) > 1.5/0.6 = 2.5
  if (ps[0] > 1e-12 && ps[2] / ps[0] > 2.5) powerSuper++;
  detail.push({ vr: vs[2] / Math.max(1e-12, vs[0]), pr: ps[2] / Math.max(1e-12, ps[0]) });
}
console.log(`  speed rises with effort:      ${speedUp}/${n}`);
console.log(`  power rises with effort:      ${powerUp}/${n}`);
console.log(`  power rises SUPERLINEARLY:    ${powerSuper}/${n}`);
console.log(`  speed ratio 1.5/0.6: p50 ${fmt(q(detail.map(d => d.vr), 0.5))}`);
console.log(`  power ratio 1.5/0.6: p50 ${fmt(q(detail.map(d => d.pr), 0.5))}  (linear would be 2.50)\n`);

// ── C. does gravity choice reorder creatures? ────────────────────────────────
console.log('C. DOES THE GRAVITY CHOICE REORDER CREATURES?\n');
const inTank = [], zeroG = [], threeD = [];
for (const { genome, plan } of corpus) {
  const a = S2(RAPIER, { plan, genome, world: W1_SLICE });
  const b = S2(RAPIER, { plan, genome, world: W1_SLICE, gravity: 0 });
  if (!a.valid || !b.valid) continue;
  inTank.push(a.cruiseSpeed);
  zeroG.push(b.cruiseSpeed);
  threeD.push(a.runs[1].speed3d);
}
console.log(`  horizontal in-tank vs horizontal at zero-g: Spearman ${fmt(spearman(inTank, zeroG))}`);
console.log(`  horizontal in-tank vs 3-D in-tank:          Spearman ${fmt(spearman(inTank, threeD))}`);
console.log(`  n = ${inTank.length}`);
