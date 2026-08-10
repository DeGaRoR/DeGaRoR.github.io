// tools/_zgoalwin.mjs — RE-SCORE THE WINNERS ON THE CANONICAL TRIAL.
//
//     node tools/_zgoalwin.mjs [seed ...]        default 0 1 2
//
// `_zgoalevo` ranks on a cheap trial — three directions, 40 s — because it has to
// run that trial a few thousand times. THE CHEAP SET RANKS; IT DOES NOT REPORT.
// Nothing may be quoted as a result of the selection until it has been scored on
// the same six directions and 90 s the library baseline was measured on, because
// a number produced under one geometry and compared against another is the
// mistake that cost this project the `_zlight` "1 in 7 helped" reading.
//
// It also prints the null arm's winner. A selection run that produced a good
// animal and a null arm that produced an equally good one has demonstrated
// nothing, and that comparison has to survive the re-score too — a difference
// that only exists on the training geometry is an overfit to the training
// geometry, and here that would mean a lineage tuned to three specific bearings.
//
// Writes nothing. Prints a paste-ready block for `worlds/w1_curated.js` on
// request of the reader, not of the script — promotion into the library is a
// deliberate act with an ancestry note attached (standing rule 10).
import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync } from 'node:fs';
import { goalScore, prepare, GOAL_SECONDS, GOAL_CAPTURE, DIRECTIONS } from './_zgoal.mjs';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();
const R2D = 180 / Math.PI;
const SEEDS_ARG = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [0, 1, 2];

/**
 * THE BASELINE THIS IS AGAINST, measured this session on the same geometry:
 * the 9-creature authored library plus 8 random corpus creatures scored with
 * their own gains — mean control-subtracted closure 0.041, and 4 arrivals in
 * 102 cells. Quoted here so the comparison is in the same output as the result.
 */
const BASELINE = { meanClosure: 0.041, arrivedCells: 4, totalCells: 102, n: 17 };

console.log(`_zgoalwin — winners re-scored on ${DIRECTIONS.length} directions, ${GOAL_SECONDS} s, capture ${GOAL_CAPTURE} cm`);
console.log(`baseline for comparison: mean closure ${BASELINE.meanClosure} over n=${BASELINE.n},`
  + ` ${BASELINE.arrivedCells}/${BASELINE.totalCells} cells arriving\n`);
console.log('seed  arm     v cm/s   D cm  turnCap°/s  bestBias | live  blind  CLOSURE  arrive | inPlane   mid    out');

const rows = [];
for (const seed of SEEDS_ARG) {
  let data;
  try { data = JSON.parse(readFileSync(new URL(`./_zgoalevo_seed${seed}.json`, import.meta.url), 'utf8')); }
  catch { console.log(`  seed ${seed}: no result file — run tools/_zgoalevo.mjs ${14} 5 ${seed} 40`); continue; }

  for (const arm of ['score', 'null']) {
    const w = data.winners?.[arm];
    if (!w) { console.log(`  ${seed}    ${arm.padEnd(6)}  — no winner recorded`); continue; }
    // The FULL sweep here, not the single point `prepare` uses inside selection:
    // this is the reporting path and it can afford it, and `bestBias` is worth
    // seeing for an animal that is about to be proposed for the library.
    const prep = prepare(RAPIER, w.genome, W1_SLICE, { sweep: true });
    if (!prep) { console.log(`  ${seed}    ${arm.padEnd(6)}  — not a subject`); continue; }
    const r = goalScore(RAPIER, {
      plan: prep.plan, genome: w.genome, world: W1_SLICE,
      plane: prep.plane, speed: prep.speed, seconds: GOAL_SECONDS,
    });
    if (!r.valid) { console.log(`  ${seed}    ${arm.padEnd(6)}  — dropped (${r.reason})`); continue; }
    rows.push({ seed, arm, genome: w.genome, trainFitness: w.fitness, ...prep, ...r });
    console.log(
      `  ${seed}    ${arm.padEnd(6)} ${prep.speed.toFixed(3).padStart(7)} ${r.dist.toFixed(2).padStart(6)}`
      + ` ${(prep.turnCapability * R2D).toFixed(2).padStart(11)} ${String(prep.bestBias ?? '—').padStart(9)}`
      + ` | ${r.live.toFixed(3).padStart(5)} ${r.blind.toFixed(3).padStart(6)} ${r.closure.toFixed(3).padStart(8)}`
      + ` ${r.arrived.toFixed(2).padStart(7)} | ${r.bands.inPlane.closure.toFixed(3).padStart(7)}`
      + ` ${r.bands.mid.closure.toFixed(3).padStart(6)} ${r.bands.out.closure.toFixed(3).padStart(6)}`);
  }
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const score = rows.filter((r) => r.arm === 'score');
const nul = rows.filter((r) => r.arm === 'null');
console.log('\n  ── ON THE CANONICAL TRIAL ──');
console.log(`  score arm   n=${score.length}  mean closure ${mean(score.map((r) => r.closure)).toFixed(3)}`
  + `   cells arriving ${score.reduce((a, r) => a + r.cells.filter((c) => c.arrived).length, 0)}/${score.length * DIRECTIONS.length}`);
console.log(`  null arm    n=${nul.length}  mean closure ${mean(nul.map((r) => r.closure)).toFixed(3)}`
  + `   cells arriving ${nul.reduce((a, r) => a + r.cells.filter((c) => c.arrived).length, 0)}/${nul.length * DIRECTIONS.length}`);
console.log(`  baseline    n=${BASELINE.n}  mean closure ${BASELINE.meanClosure.toFixed(3)}`
  + `   cells arriving ${BASELINE.arrivedCells}/${BASELINE.totalCells}`);
console.log('\n  by band, score arm:  '
  + ['inPlane', 'mid', 'out'].map((b) => `${b} ${mean(score.map((r) => r.bands[b].closure)).toFixed(3)}`).join('   '));
console.log('  DOES THE TRAINING GEOMETRY TRANSFER? train vs canonical, score arm:');
for (const r of score) console.log(`    seed ${r.seed}   train ${r.trainFitness.toFixed(4)}   canonical ${r.closure.toFixed(4)}`);

// Paste-ready, for `worlds/w1_curated.js`. Printed last because it is long.
if (process.env.ZGOAL_EMIT) {
  for (const r of score) {
    console.log(`\n// ── seed ${r.seed} score-arm winner — closure ${r.closure.toFixed(3)}, arrives ${r.arrived.toFixed(2)} ──`);
    console.log(`const GOALSEEKER_${r.seed} = ${JSON.stringify(r.genome)};`);
  }
}
