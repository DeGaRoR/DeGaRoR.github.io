// tools/_zsplit.mjs — for a FIXED compute budget, is it better to run one long
// forage trial or several short ones?
//
// tools/_zsettle.mjs asked how long the multiplier takes to settle and got an
// answer that pointed somewhere else:
//
//   rank vs final     0.909 at 15 s, 0.958 by 60 s — the ORDER is settled almost
//                     immediately, and order is what selection consumes.
//   repeat spread     42% at 15 s, still 23% at 2400 s — run-to-run variation
//                     DOES NOT CONVERGE AWAY. Forty minutes of simulation buys
//                     almost nothing against a different field and spawn point.
//
// If the residual is between-run variance rather than within-run noise, then
// duration is the wrong lever and REPEATS are the right one, because averaging R
// independent trials cuts the spread by sqrt(R). That is a prediction, and this
// tool tests it instead of asserting it.
//
// METHOD. Every creature is run R_MAX times to T_MAX, with the ratio recorded at
// every mark. From that one dataset every (duration x repeats) split can be
// evaluated without re-simulating: a split (T, R) costs T*R creature-seconds and
// scores as the Spearman rank correlation of its averaged ranking against the
// reference. Splits are then compared AT EQUAL COST, which is the only comparison
// that answers the question.
//
// THE REFERENCE is the mean over all R_MAX repeats at T_MAX — the best estimate
// the dataset contains. It is not ground truth, and a split cannot beat it; what
// matters is which split gets closest per second spent.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { seedPopulation } from '../engine/l1/breed.js';
import { authoredList } from '../worlds/atlas_seed.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import {
  makeFood, mouthsOf, forageStep, ledger, INGEST_RATE,
} from '../engine/l2/forage.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const T_MAX = Number(process.argv[2] ?? 900);
const R_MAX = Number(process.argv[3] ?? 8);
const N_SEEDED = Number(process.argv[4] ?? 8);
const MARKS = [30, 60, 100, 150, 225, 300, 450, 600, T_MAX].filter((t) => t <= T_MAX);

const corpus = authoredList().slice(0, 6)
  .map((e) => ({ name: e.commonName ?? '(authored)', genome: e.genome }))
  .concat(seedPopulation({
    RAPIER, rng: rngFrom('split', 'corpus'), world: W1_SLICE,
    population: N_SEEDED, authoredSlots: 0,
  }).genomes.map((g, i) => ({ name: `seeded ${i + 1}`, genome: g })));

function trial(entry, repeat) {
  let plan;
  try { plan = morphogenesis(entry.genome); } catch { return null; }
  const mouths = mouthsOf(plan);
  if (!mouths.length) return null;
  const mass = totalMass(plan);
  const buf = mouths.map(() => [0, 0, 0]);
  // Independent field AND spawn per repeat: the whole point is between-run spread.
  const food = makeFood(W1_SLICE, { seed: 4400 + repeat * 7919 });
  const a = (repeat / R_MAX) * Math.PI * 2;
  const r = Math.min(W1_SLICE.tankBounds[0], W1_SLICE.tankBounds[2]) / 4;
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, entry.genome, W1_SLICE, {
      bounded: false, wrap: true, effort: 1, turnBias: 0,
      origin: [Math.cos(a) * r, 0, Math.sin(a) * r],
    });
  } catch { return null; }
  const out = [];
  let eaten = 0, mark = 0;
  for (let st = 0; st < Math.round(T_MAX / FIXED_DT); st++) {
    try { sim.step(); } catch { break; }
    eaten += forageStep(sim, plan, food, mouths, FIXED_DT, INGEST_RATE, buf);
    const t = (st + 1) * FIXED_DT;
    while (mark < MARKS.length && t >= MARKS[mark]) {
      out.push(ledger(W1_SLICE, mass, eaten, sim.work, MARKS[mark]).ratio);
      mark++;
    }
  }
  while (out.length < MARKS.length) out.push(out[out.length - 1] ?? 0);
  sim.free();
  return out;
}

function spearman(xs, ys) {
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    idx.forEach(([, i], k) => { r[i] = k; });
    return r;
  };
  const a = rank(xs), b = rank(ys), n = xs.length, m = (n - 1) / 2;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - m) * (b[i] - m); da += (a[i] - m) ** 2; db += (b[i] - m) ** 2; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : NaN;
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

const t0 = Date.now();
const data = [];                        // data[creature][repeat][mark]
for (const e of corpus) {
  const reps = [];
  for (let r = 0; r < R_MAX; r++) { const v = trial(e, r); if (v) reps.push(v); }
  if (reps.length === R_MAX) data.push(reps);
  process.stdout.write('\r  ' + '.'.repeat(data.length));
}
const wall = (Date.now() - t0) / 1000;
const perSec = wall / (data.length * R_MAX * T_MAX);   // wall seconds per creature-second

const iMax = MARKS.length - 1;
const reference = data.map((reps) => mean(reps.map((r) => r[iMax])));

console.log(`\r  ${data.length} creatures x ${R_MAX} repeats x ${T_MAX}s — ${wall.toFixed(0)}s wall`);
console.log(`  reference = mean of all ${R_MAX} repeats at ${T_MAX}s\n`);
console.log('   duration  repeats   cost (creature-s)   rank vs reference   est. wall for a 12-pool');
console.log('  ' + '-'.repeat(94));

const rows = [];
for (let m = 0; m < MARKS.length; m++) {
  for (const R of [1, 2, 3, 4, 6, 8]) {
    if (R > R_MAX) continue;
    if (m === iMax && R === R_MAX) continue;          // that IS the reference
    // Average the FIRST R repeats — an arbitrary but honest subset; using the
    // best R would be choosing the answer after seeing it.
    const est = data.map((reps) => mean(reps.slice(0, R).map((r) => r[m])));
    rows.push({ T: MARKS[m], R, cost: MARKS[m] * R, rho: spearman(est, reference) });
  }
}
// Print, sorted by cost, so the cost/quality frontier is readable down the page.
rows.sort((a, b) => a.cost - b.cost);
for (const r of rows) {
  if (r.cost > 2400) continue;
  console.log('  ' + `${r.T}s`.padStart(9) + String(r.R).padStart(9)
    + String(r.cost).padStart(20) + r.rho.toFixed(3).padStart(20)
    + (r.cost * perSec * 12).toFixed(1).padStart(20) + 's');
}

console.log('\n  THE FRONTIER: for each cost, the best rank correlation available.');
const byCost = new Map();
for (const r of rows) {
  const k = r.cost;
  if (!byCost.has(k) || byCost.get(k).rho < r.rho) byCost.set(k, r);
}
let best = -Infinity;
for (const [, r] of [...byCost.entries()].sort((a, b) => a[0] - b[0])) {
  if (r.rho <= best || r.cost > 2400) continue;
  best = r.rho;
  console.log(`   ${String(r.cost).padStart(5)} creature-s  ->  rho ${r.rho.toFixed(3)}   `
    + `(${r.T}s x ${r.R})`);
}
console.log();
