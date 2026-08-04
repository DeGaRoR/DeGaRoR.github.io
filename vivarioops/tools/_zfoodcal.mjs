// tools/_zfoodcal.mjs — RECALIBRATE FOOD_ENERGY after Phase A.
//
// w1_slice.js states the rule this implements: FOOD_ENERGY is CALIBRATED, not
// derived, and it is set so the MEDIAN creature roughly breaks even over a
// FORAGE_SECONDS trial. It has moved three times already — 1.4e3 under point
// sampling, 6.4e3 under body-proximity absorption, 4.2e4 for the mouth model —
// and the standing rule is to move it whenever the harvest model, the trial
// length, the metabolic cost or the body mass changes.
//
// PHASE A CHANGED THREE OF THOSE FOUR. A1 fixed an accumulating force, so every
// creature does far less work against a drag that was the summed history of its
// own motion; A0 moved the metabolic bill from unsigned `work` to `workOut`; A2
// and A3 changed what the corpus IS. Measured after all of it, the median
// intake/spend ratio is about 18 — food is eighteen times cheaper than the cost
// of living, 100% of the corpus breaks even, and "is it paying its way?" has
// stopped being a question with an answer.
//
// THE ARITHMETIC IS DIRECT, not a search. For one creature,
//
//     ratio = eaten * FOOD_ENERGY / (workOut + basal)
//
// so the value that puts a given creature exactly at break-even is
// `(workOut + basal) / eaten`. Take the median of that over the corpus and the
// median creature breaks even by construction.
//
// Creatures that eat nothing are EXCLUDED and counted separately: they are at
// ratio 0 for any FOOD_ENERGY whatsoever, so including them would drag the
// median toward a number that describes starvation rather than break-even.
//
// Run: node tools/_zfoodcal.mjs [SECONDS=300] [N=24]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { totalMass } from '../engine/l1/morphogen.js';
import { makeFood, mouthsOf, forageStep, ledger, INGEST_RATE, FORAGE_SECONDS } from '../engine/l2/forage.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const SECONDS = Number(process.argv[2] ?? FORAGE_SECONDS);
const N = Number(process.argv[3] ?? 24);

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 14; i++) {
  const g = createRandomGenome(rngFrom('food', 'cal', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 2) corpus.push({ genome: g, plan: v.plan });
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const pct = (a, f) => (100 * a.filter(f).length) / Math.max(1, a.length);

const rows = [];
for (const { genome, plan } of corpus) {
  const food = makeFood(W1_SLICE, { seed: 31337 });
  const mouths = mouthsOf(plan);
  if (!mouths.length) continue;
  const buf = mouths.map(() => [0, 0, 0]);
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, W1_SLICE,
      { bounded: true, wrap: false, effort: 1, turnBias: 0 });
  } catch { continue; }
  let eaten = 0;
  const steps = Math.round(SECONDS / FIXED_DT);
  for (let s = 0; s < steps; s++) {
    try { sim.step(); } catch { break; }
    eaten += forageStep(sim, plan, food, mouths, FIXED_DT, INGEST_RATE, buf);
  }
  const mass = totalMass(plan);
  const L = ledger(W1_SLICE, mass, eaten, sim.workOut, SECONDS);
  rows.push({ eaten, mass, workOut: sim.workOut, basal: L.basal, spend: L.spend, ratio: L.ratio });
  sim.free();
  process.stdout.write('.');
}
console.log('\n');

const fed = rows.filter((r) => r.eaten > 1e-9);
const breakEven = fed.map((r) => r.spend / r.eaten);
const target = med(breakEven);

console.log(`  FOOD_ENERGY RECALIBRATION — ${rows.length} creatures x ${SECONDS} s`);
console.log(`    ate nothing at all              ${pct(rows, (r) => r.eaten <= 1e-9).toFixed(0)}%  (excluded)`);
console.log(`    median grams eaten              ${med(fed.map((r) => r.eaten)).toFixed(3)} g`);
console.log(`    median workOut                  ${med(fed.map((r) => r.workOut)).toExponential(2)} erg`);
console.log(`    median basal                    ${med(fed.map((r) => r.basal)).toExponential(2)} erg`);
console.log(`    median spend                    ${med(fed.map((r) => r.spend)).toExponential(2)} erg`);
console.log(`\n    CURRENT FOOD_ENERGY             ${W1_SLICE.FOOD_ENERGY.toExponential(2)} erg/g`);
console.log(`    median intake/spend now         ${med(fed.map((r) => r.ratio)).toFixed(2)}   (target 1.0)`);
console.log(`\n    BREAK-EVEN FOOD_ENERGY          ${target.toExponential(3)} erg/g`);
console.log(`    i.e. divide the current one by  ${(W1_SLICE.FOOD_ENERGY / target).toFixed(1)}x`);

// What the corpus looks like at the proposed value: the spread matters as much
// as the median. A calibration that puts everyone at exactly 1.0 has removed the
// signal selection needs.
const at = (fe) => fed.map((r) => (r.eaten * fe) / r.spend);
const v = at(target).sort((a, b) => a - b);
console.log(`\n    at the proposed value — p10 ${v[Math.floor(v.length * 0.1)].toFixed(2)}`
  + `  median ${med(v).toFixed(2)}  p90 ${v[Math.floor(v.length * 0.9)].toFixed(2)}`);
console.log(`    fraction paying their way       ${pct(at(target).map((x) => ({ x })), (d) => d.x > 1).toFixed(0)}%`
  + `   (a real question again)\n`);
