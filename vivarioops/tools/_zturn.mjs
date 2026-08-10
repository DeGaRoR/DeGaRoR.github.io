// tools/_zturn.mjs — SELECT ON TURN RATE. Offline. Not the game.
//
//     node tools/_zturn.mjs [generations] [population] [seeds]
//
// ── WHY THIS IS THE THING TO SELECT ON ───────────────────────────────────────
//
// `tools/_zlight.mjs` re-run post-Phase-A still fails: mean control-subtracted
// closing +0.0109, ONE creature helped of seven. But its declared secondary said
// exactly where the failure lives:
//
//     corr(score, turnRate3d)        =  0.91
//     corr(score, steeringAuthority) =  0.31
//     corr(score, |sensor gain|)     =  0.07
//
// Taxis is driven by turn rate and almost nothing else — the sensor gene explains
// essentially none of it. The threshold sits near 14 deg/s (eel-unison, the only
// creature that finds the light), the random corpus sits at 1.57 deg/s, and the
// authored library proves 15.95 deg/s is reachable inside the existing grammar.
//
// A NINE-FOLD GAP, IN A SPACE THAT DEMONSTRABLY CONTAINS THE ANSWER, AND NOTHING
// IN THIS PROJECT HAS EVER SELECTED FOR IT. That is what this tool is for.
//
// ── WHY IT SELECTS ON `turnCapability` AND NOT ON `turnRate3d` ───────────────
//
// Because `turnRate3d` alone is riggable, and the library already contains the
// creature that rigs it. `eel` measures 45 deg/s with +bias and 0 deg/s with
// -bias, always about the same axis: `steeringAuthority` 0.000. It does not steer,
// it CIRCLES, and a naive turn-rate objective would crown it and breed a tank of
// spinning animals that can never aim at anything.
//
//     turnCapability = turnRate3d * steeringAuthority        (contracts/species.js)
//
// which is what N21 now clamps L3 steering by, for the same reason.
//
//     creature      turnRate3d   authority   turnCapability
//     eel              1.85        0.000         0.00
//     eel-unison      15.95        1.000        15.95
//
// ── OFFLINE, DELIBERATELY ────────────────────────────────────────────────────
//
// This does not touch the app. The Vivarium keeps MANUAL selection on the ledger,
// which is the standing decision: automatic selection comes last and will be L3's
// birth-and-death, not a better burst button. This is a research tool that answers
// "is turn rate selectable at all", and its output is a number and a genome, not
// a change to what a player sees.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { assessViability } from '../engine/l1/viability.js';
import { seedPopulation } from '../engine/l1/breed.js';
import { autoBurst } from '../engine/l2/objective.js';
import { S3 } from '../engine/l2/probes.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();

const GENERATIONS = Number(process.argv[2] ?? 6);
const POPULATION = Number(process.argv[3] ?? 16);
const SEEDS = Number(process.argv[4] ?? 3);
const R2D = 180 / Math.PI;

/**
 * The objective. `turnCapability` in deg/s, zero for anything that will not build
 * or will not probe — a body that cannot be measured has not earned a score.
 *
 * S3 costs two 8 s runs per creature (it applies the bias in BOTH directions so
 * intrinsic curl cancels), so a generation of 16 is ~256 s of simulation. That is
 * the price of an honest turn measurement and it is why this is offline.
 */
function turnCapability(RAPIER_, genomes) {
  return genomes.map((g) => {
    let v;
    try { v = assessViability(RAPIER_, g, W1_SLICE); } catch { return 0; }
    if (!v.ok) return 0;
    try {
      const r = S3(RAPIER_, { plan: v.plan, genome: g, world: W1_SLICE, cruiseSpeed: 0.5 });
      if (!r.valid) return 0;
      const cap = r.turnRate3d * r.steeringAuthority * R2D;
      return Number.isFinite(cap) ? cap : 0;
    } catch { return 0; }
  });
}

/** Median, for reporting a population rather than its luckiest member. */
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

console.log(`_zturn — selection on turnCapability = turnRate3d * steeringAuthority`);
console.log(`${GENERATIONS} generations x population ${POPULATION} x ${SEEDS} seeds, vs a RANDOM-SELECTION null arm`);
console.log(`corpus baseline turnRate3d p50 1.57 deg/s · taxis threshold ~14 · eel-unison 15.95\n`);
console.log(`seed   arm       gen0 best   gen0 med    final best   final med    gain`);

const scoreArm = [], nullArm = [];

for (let s = 1; s <= SEEDS; s++) {
  for (const selection of ['score', 'random']) {
    // SAME OPENING POPULATION IN BOTH ARMS. The null arm is only a null if the
    // two differ in nothing but which survivors are kept — B2 §10 leads with
    // "a 28x selection result was reproduced by random survivors", and the only
    // defence against repeating that is to run them paired.
    //
    // `authoredSlots: 0` — no eels. This asks whether SELECTION can find a fast
    // turner, and seeding the population with a hand-built one that already turns
    // at 15.95 deg/s would answer a different and much easier question.
    const start = seedPopulation({
      RAPIER, rng: rngFrom('zturn', `seed:${s}`), world: W1_SLICE,
      population: 6, authoredSlots: 0,
    }).genomes;

    const r = autoBurst({
      RAPIER,
      genomes: start,
      rng: rngFrom('zturn', `burst:${s}:${selection}`),
      world: W1_SLICE,
      generations: GENERATIONS,
      population: POPULATION,
      keep: 6,
      selection,
      objective: turnCapability,
      // NO adaptFn. `adaptGait` hill-climbs NET SPEED (gait.js:88), so handing it
      // to a turning objective would tune every body for travel and then score it
      // on rotation — ROADMAP §4.4's exact warning, one objective further on.
      // And `inheritance` is left at its default 'weismann': the burst may score a
      // body at its best, but only the birth genome breeds.
    });

    const h0 = r.history[0], hN = r.history[r.history.length - 1];
    const gain = h0.best > 0 ? hN.best / h0.best : Infinity;
    console.log(
      String(s).padStart(4),
      selection.padEnd(9),
      h0.best.toFixed(2).padStart(10),
      h0.median.toFixed(2).padStart(10),
      hN.best.toFixed(2).padStart(13),
      hN.median.toFixed(2).padStart(11),
      (Number.isFinite(gain) ? `${gain.toFixed(2)}x` : '--').padStart(8),
    );
    (selection === 'score' ? scoreArm : nullArm).push(hN.best);
  }
}

console.log();
console.log(`PRIMARY   score-selected final best, median over seeds : ${med(scoreArm).toFixed(2)} deg/s`);
console.log(`NULL ARM  random-selected final best, median over seeds: ${med(nullArm).toFixed(2)} deg/s`);
const lift = med(nullArm) > 0 ? med(scoreArm) / med(nullArm) : Infinity;
console.log(`          selection over null: ${Number.isFinite(lift) ? `${lift.toFixed(2)}x` : 'n/a'}`);
console.log();
console.log(`A RESULT ONLY COUNTS IF IT BEATS THE NULL ARM. B2 §10: "a 28x selection`);
console.log(`result was reproduced by random survivors." Report both numbers or neither.`);
