// tools/c1probe.js — C1 measurement, not a gate.
//
// The two questions C1 cannot answer from the spec:
//   1. Does S2 in W1 measure SWIMMING or BUOYANT DRIFT? B3 measured drift at
//      ~40x locomotion, so `speed = mean |velocity|` as 11 §5 writes it may be
//      reporting density rather than thrust.
//   2. Does the turn bias actually turn anything?
//
// Run: node tools/c1probe.js [n]

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { assessViability } from '../engine/l1/viability.js';
import { S1, S2, S3 } from '../engine/l2/probes.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();

const N = Number(process.argv[2] || 24);
const q = (a, f) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length * f)] : 0);
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(3) : String(x));

// The corpus is VIABILITY-FILTERED, unlike B3's. Compile is only ever called on
// a creature the tank bred, and the tank breeds only viable ones, so measuring
// against the raw factory corpus would characterise creatures that can never
// reach a probe. It also bounds B3's peak-speed tail for the same reason
// viability.js does.
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 6; i++) {
  const g = createRandomGenome(rngFrom('c1', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok) corpus.push({ genome: g, plan: v.plan });
}
console.log(`corpus: ${corpus.length} viable creatures\n`);

const rows = [];
for (const { genome, plan } of corpus) {
  const morph = S1(plan);

  const inTank = S2(RAPIER, { plan, genome, world: W1_SLICE });
  const zeroG = S2(RAPIER, { plan, genome, world: W1_SLICE, gravity: 0 });
  if (!inTank.valid || !zeroG.valid) { rows.push(null); continue; }

  const turn = S3(RAPIER, {
    plan, genome, world: W1_SLICE, cruiseSpeed: inTank.cruiseSpeed,
  });

  rows.push({
    mass: morph.massBase,
    reach: morph.reach,
    exposure: morph.torsoExposure,
    longest: morph.longestAxis,

    hTank: inTank.cruiseSpeed,
    dTank: inTank.runs[1].speed3d,
    hZero: zeroG.cruiseSpeed,

    burstRatio: inTank.burstRatio,
    burstSat: inTank.burstSaturated,
    degenerate: inTank.degenerateFit,
    power: inTank.runs[1].power,
    gait: inTank.gaitFrequency,
    straight: inTank.straightness,

    turnRate: turn.valid ? turn.turnRate : NaN,
    intrinsic: turn.valid ? Math.abs(turn.intrinsicRate) : NaN,
  });
}

const ok = rows.filter(Boolean);
const col = (k) => ok.map(r => r[k]).filter(Number.isFinite);

console.log('QUESTION 1 — is S2 measuring thrust or buoyancy?');
console.log('                          p10     p50     p90');
for (const [label, k] of [
  ['3-D speed, gravity on ', 'dTank'],
  ['horizontal, gravity on', 'hTank'],
  ['horizontal, gravity 0 ', 'hZero'],
]) {
  const c = col(k);
  console.log(`  ${label}  ${fmt(q(c, 0.1))}  ${fmt(q(c, 0.5))}  ${fmt(q(c, 0.9))}`);
}
const ratio = ok.map(r => r.dTank / Math.max(1e-9, r.hTank)).filter(Number.isFinite);
console.log(`  3-D / horizontal ratio: median ${fmt(q(ratio, 0.5))}`);
const agree = ok.map(r => r.hTank / Math.max(1e-9, r.hZero)).filter(Number.isFinite);
console.log(`  horizontal in-tank / at-zero-g: median ${fmt(q(agree, 0.5))}\n`);

console.log('QUESTION 2 — does the turn bias turn anything?');
const tr = col('turnRate'), ir = col('intrinsic');
console.log(`  turnRate  (response)  p10 ${fmt(q(tr, 0.1))}  p50 ${fmt(q(tr, 0.5))}  p90 ${fmt(q(tr, 0.9))} rad/s`);
console.log(`  intrinsic (curl)      p10 ${fmt(q(ir, 0.1))}  p50 ${fmt(q(ir, 0.5))}  p90 ${fmt(q(ir, 0.9))} rad/s`);
console.log(`  turnRate > 0.01 rad/s: ${tr.filter(x => x > 0.01).length}/${tr.length}`);
console.log(`  intrinsic exceeds response: ${ok.filter(r => r.intrinsic > r.turnRate).length}/${ok.length}\n`);

console.log('OTHER MEASURES');
for (const [label, k] of [
  ['mass          ', 'mass'],
  ['reach         ', 'reach'],
  ['torsoExposure ', 'exposure'],
  ['longestAxis   ', 'longest'],
  ['burstRatio    ', 'burstRatio'],
  ['power @1.0    ', 'power'],
  ['gaitFrequency ', 'gait'],
  ['straightness  ', 'straight'],
]) {
  const c = col(k);
  console.log(`  ${label}  p10 ${fmt(q(c, 0.1))}  p50 ${fmt(q(c, 0.5))}  p90 ${fmt(q(c, 0.9))}`);
}
console.log(`  degenerate power fits: ${ok.filter(r => r.degenerate).length}/${ok.length}`);
console.log(`  burstDuration saturated: ${ok.filter(r => r.burstSat).length}/${ok.length}`);
console.log(`  probes aborted unstable: ${rows.length - ok.length}/${rows.length}`);
