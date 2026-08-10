// tools/_zgoalevo.mjs — SELECTION ON ARRIVING.  ⚠ WRITES ONE FILE (see below)
//
//     node tools/_zgoalevo.mjs [population] [generations] [seed] [seconds]
//
// ── WHAT IS BEING SELECTED, AND WHAT WAS TRIED BEFORE ────────────────────────
//
// `tools/_zturn.mjs` selected on turn capability and measured what that breeds:
// capability 5.38 -> 21.21 deg/s over five generations while reachability stayed
// 0/5 and speed collapsed. It bred creatures that spin brilliantly in place.
// The lesson recorded in PLAN-TO-INTELLIGENCE Phase 3.2 was "select on the
// envelope, not on turn rate".
//
// `tools/_zgoal.mjs` says the envelope is wrong too — it is built on `S3` numbers
// measured at `turnBias = +-1.0`, the one operating point where the gait is
// destroyed, and it ranks the cast's best goal-reacher (`eel`, turnCapability
// 0.00 deg/s) below its worst. So this selects on the behaviour itself:
//
//     fitness = mean over directions of (closure live - closure blind)
//
// Control-subtracted because raw closure is largely a speed metric and because
// `snarlback-teal` scores 0.333 blind purely by wandering into the target.
//
// ── THE NULL ARM IS PAIRED, NOT MERELY PRESENT ───────────────────────────────
//
// Both arms start from the SAME generation-0 population, drawn from the same
// seed. The score arm keeps the top `ELITE` by fitness; the null arm keeps
// `ELITE` chosen at random from the same viable set, with the same mutation
// budget. Any difference is therefore selection and nothing else — not a luckier
// founding draw, which is the failure mode an unpaired null arm cannot exclude.
//
// ── ONE ZYGOTE PER REPRODUCTION ──────────────────────────────────────────────
//
// Phase 1.1 names `VIABILITY.maxAttempts = 12` as one of the "two invisible
// gods": a mutation that produces an inviable child is retried up to twelve
// times, which erases mutational load exactly where selection is being measured.
// This loop calls `mutate` directly and never re-rolls a child — an inviable
// child is a dead child and the slot is filled by another parent's offspring.
// That is `_evolve_seek`'s behaviour too; it is stated here because it is a
// property the experiment depends on rather than an accident of the imports.
//
// CROSSOVER IS OFF, following `_zselect`'s burst: mixing two parents while
// measuring what mutation reaches confounds the two.
//
// ── WRITES ───────────────────────────────────────────────────────────────────
//
//   tools/_zgoalevo_seed<seed>.json   — the winner genome of each arm plus the
//   per-generation history. Gitignored until a winner is promoted into
//   `worlds/w1_curated.js` by hand. `_evolve_seek` printed p50s and DISCARDED
//   the animal, which is why no seeker it ever found survived its own run.
import RAPIER from '@dimforge/rapier3d-compat';
import { writeFileSync } from 'node:fs';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { mutate } from '../engine/l1/mutate.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import W1_SLICE from '../worlds/w1_slice.js';
import { SEEDS } from '../worlds/seeds.js';
import { CURATED } from '../worlds/w1_curated.js';
import { goalScore, prepare, DIRECTIONS_FAST } from './_zgoal.mjs';

await RAPIER.init();

const POP = Number(process.argv[2] ?? 12);
const GENS = Number(process.argv[3] ?? 5);
const SEED = Number(process.argv[4] ?? 0);
const SECONDS = Number(process.argv[5] ?? 40);
/**
 * ── ROUND 2: AN ABSOLUTE TARGET, AND FOUNDERS THAT CAN REACH IT ──────────────
 *
 * Round 1 selected on a target scaled to each creature's own cruise speed, and
 * `tools/_zbeacon.mjs` then failed its gate at 1 of 30 arrivals for a reason the
 * reach column makes plain:
 *
 *     creature             closure   v cm/s   reach in 120 s   task
 *     oddfoot-glossy         0.202    0.019       2.3 cm       8 cm
 *     spokebeast-banded      0.311    0.033       4.0 cm       8 cm
 *     eel-unison             0.416    0.510      61.3 cm       8 cm
 *
 * The winners aim well and cannot travel. Scaling the target to the creature
 * normalised range out of the objective, so nothing ever selected for it, and
 * the guard that was supposed to catch this only checked that speed did not
 * COLLAPSE relative to generation 0 — it did not, it rose, from a base of
 * 0.012 cm/s that was never going to be enough.
 *
 * `distance` fixes the target where the tank puts it. `authored` seeds the
 * population from the fast library swimmers, because a body that can cover 8 cm
 * is a prerequisite the random draw supplies about never.
 *
 * ⚠ WHAT AN AUTHORED-FOUNDER RUN CAN AND CANNOT CLAIM — standing rule 10.
 * A seeded run shows that SELECTION IMPROVES COMPETENT FOUNDERS. It does not
 * show that evolution discovered seeking, and the round-1 random-founder result
 * is the one that speaks to that. Both are reported; neither is quoted as the
 * other. Descendants carry `origin.founder`, so the Atlas says so too.
 */
const DISTANCE = Number(process.argv[6] ?? 0);
const FOUNDERS = process.argv[7] ?? 'random';
const ELITE = Math.max(2, Math.round(POP * 0.3));

const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const p50 = (v) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };

/**
 * Score one genome. Returns null for anything that is not a subject — inviable,
 * no measurable cruise, no measurable steering plane, or it came apart. A
 * non-subject is not a low score: giving it 0 would make "cannot be simulated"
 * compete with "can be simulated and does not steer", which are different facts.
 */
function evaluate(genome) {
  const prep = prepare(RAPIER, genome, W1_SLICE);
  if (!prep || !(prep.speed > 1e-4)) return null;
  const r = goalScore(RAPIER, {
    plan: prep.plan, genome, world: W1_SLICE,
    plane: prep.plane, speed: prep.speed, seconds: SECONDS, dirs: DIRECTIONS_FAST,
    distance: DISTANCE,
  });
  if (!r.valid) return null;
  return {
    fitness: r.closure, live: r.live, blind: r.blind,
    speed: prep.speed, turnCapability: prep.turnCapability,
    gain: (genome.controller.preyGain ?? 0) + (genome.controller.threatGain ?? 0),
    bands: r.bands,
  };
}

/** Fill a population to `POP` by mutating the survivors, one zygote per attempt. */
function breedFrom(survivors, gen, arm) {
  const next = survivors.slice();
  let k = 0;
  while (next.length < POP && k < POP * 20) {
    const parent = survivors[k % survivors.length];
    const child = mutate(parent, rngFrom('goalevo', arm, SEED, gen, k)).genome;
    try { if (morphogenesis(child).jointCount >= 1) next.push(child); } catch { /* dead child */ }
    k++;
  }
  return next;
}

// ── the shared founding population ───────────────────────────────────────────
//
// FOUNDERS ARE PRE-SCREENED TO SUBJECTS, children are not. The first smoke run
// drew 4 founders and 2 of them were subjects — consistent with the corpus
// acceptance rate of 37% — which left the elite set larger than the scored set
// and stopped both arms at generation 0. Screening the founders makes generation
// 0 a real population; NOT screening the children is the point, because an
// inviable child is the mutational load Phase 1.1 says must not be re-rolled.
const founders = [];
const foundersScored = [];

/**
 * The authored swimmers, and their mutant offspring to fill the population.
 * Only the ones that can actually cover ground — `staircase` is a deliberate
 * counter-example and `protea`/`jelly` are too slow to be founders for a task
 * defined in absolute centimetres.
 */
const AUTHORED = ['eel', 'eel-fast', 'eel-unison', 'eel-finned', 'snarlback-teal'];
const draw = (i) => {
  if (FOUNDERS !== 'authored') return createRandomGenome(rngFrom('goalevo', 'init', SEED, i));
  const lib = [...SEEDS, ...CURATED].filter((s) => AUTHORED.includes(s.id));
  if (i < lib.length) return lib[i].genome;
  // Beyond the library, MUTANTS of it — variety to select among, from a stock
  // that can reach the target. Still one zygote per attempt.
  const parent = lib[i % lib.length].genome;
  return mutate(parent, rngFrom('goalevo', 'initmut', SEED, i)).genome;
};

for (let i = 0; founders.length < POP && i < POP * 40; i++) {
  const g = draw(i);
  let ok = false;
  try { ok = morphogenesis(g).jointCount >= 1; } catch { ok = false; }
  if (!ok) continue;
  const r = evaluate(g);
  if (!r) continue;
  founders.push(g);
  foundersScored.push({ g, ...r });
}
if (founders.length < 3) {
  console.log(`_zgoalevo seed ${SEED}: only ${founders.length} founding subjects — nothing to select on.`);
  process.exit(0);
}

console.log(`_zgoalevo — selection on control-subtracted goal closure`);
console.log(`  seed ${SEED}   population ${POP}   elites ${ELITE}   ${GENS} generations   ${SECONDS} s trials`);
console.log(`  target ${DISTANCE > 0 ? `${DISTANCE} cm ABSOLUTE` : 'scaled to each creature'}   founders: ${FOUNDERS}`
  + `${FOUNDERS === 'authored' ? '  ⚠ shows selection IMPROVING competent founders, not discovery' : ''}`);
console.log(`  directions ${JSON.stringify(DIRECTIONS_FAST)}  (winners re-scored on the full set afterwards)`);
console.log(`  arms: SCORE (top ${ELITE} by closure) vs NULL (${ELITE} at random), same founders\n`);

const history = { seed: SEED, pop: POP, gens: GENS, seconds: SECONDS, arms: {} };
const winners = {};

for (const arm of ['score', 'null']) {
  let pop = founders.slice();
  const rows = [];
  console.log(`  ── ${arm.toUpperCase()} ARM ──`);
  console.log('  gen   closure p50   closure best    speed p50   turnCap p50   |gain| p50   subjects');
  for (let gen = 0; gen < GENS; gen++) {
    // Generation 0 is the SAME population in both arms — that is what makes the
    // null arm paired — so it is scored once and reused rather than re-simulated.
    const scored = gen === 0 ? foundersScored.slice() : [];
    if (gen > 0) for (const g of pop) { const r = evaluate(g); if (r) scored.push({ g, ...r }); }
    if (scored.length < 2) { console.log(`  ${gen}  too few subjects (${scored.length}) — stopping this arm`); break; }
    scored.sort((a, b) => b.fitness - a.fitness);

    const row = {
      gen,
      closureP50: p50(scored.map((s) => s.fitness)),
      closureBest: scored[0].fitness,
      speedP50: p50(scored.map((s) => s.speed)),
      turnCapP50: p50(scored.map((s) => s.turnCapability)),
      gainP50: p50(scored.map((s) => Math.abs(s.gain))),
      subjects: scored.length,
    };
    rows.push(row);
    console.log(`  ${String(gen).padStart(3)}   ${row.closureP50.toFixed(4).padStart(10)}   ${row.closureBest.toFixed(4).padStart(11)}`
      + `   ${row.speedP50.toFixed(4).padStart(9)}   ${(row.turnCapP50 * 180 / Math.PI).toFixed(3).padStart(10)}`
      + `   ${row.gainP50.toFixed(3).padStart(9)}   ${String(row.subjects).padStart(8)}`);

    winners[arm] = { genome: scored[0].g, fitness: scored[0].fitness, gen };
    if (gen === GENS - 1) break;

    // THE ONLY DIFFERENCE BETWEEN THE TWO ARMS IS THESE THREE LINES.
    const keep = Math.min(ELITE, scored.length);
    const survivors = arm === 'score'
      ? scored.slice(0, keep).map((s) => s.g)
      : (() => {
          const r = rngFrom('goalevo', 'nullpick', SEED, gen);
          const pool = scored.map((s) => s.g);
          const out = [];
          // `rngFrom` returns the rng OBJECT, not a bare function. `int(n)` is
          // rejection-sampled, so this draw carries no modulo bias — which
          // matters here more than anywhere else in the file, since a biased
          // null arm is the one thing that could manufacture the result.
          while (out.length < keep && pool.length) out.push(pool.splice(r.int(pool.length), 1)[0]);
          return out;
        })();
    pop = breedFrom(survivors, gen, arm);
  }
  history.arms[arm] = rows;
  console.log('');
}

// ── the gate, computed here so it cannot be quoted from a different run ──────
const s = history.arms.score ?? [], z = history.arms.null ?? [];
const last = (a) => (a.length ? a[a.length - 1] : null);
const sL = last(s), zL = last(z), s0 = s[0];
console.log('  ── GATE 3 ──');
if (sL && zL && s0) {
  // A RATIO IS THE WRONG SUMMARY WHEN THE NULL ARM CAN GO NEGATIVE, and it does:
  // seed 1 finished at score 0.1744 against null -0.0005 and the ratio printed
  // as "-353.54x", which reads as a catastrophic failure of the thing it is
  // reporting as a success. The gate is "the score arm is at least twice the
  // null arm"; when the null arm is at or below zero any positive score arm
  // satisfies that, and the honest way to say so is to say so.
  const speedKeep = s0.speedP50 > 0 ? sL.speedP50 / s0.speedP50 : 0;
  const verdict = zL.closureP50 > 1e-9
    ? `ratio ${(sL.closureP50 / zL.closureP50).toFixed(2)}x`
    : (sL.closureP50 > 0 ? 'null arm <= 0, score arm positive — met' : 'both arms <= 0 — not met');
  console.log(`  median closure   score ${sL.closureP50.toFixed(4)}  vs  null ${zL.closureP50.toFixed(4)}`
    + `   ${verdict}   (gate: >= 2x)`);
  console.log(`  speed p50        gen0 ${s0.speedP50.toFixed(4)} -> gen${sL.gen} ${sL.speedP50.toFixed(4)}`
    + `   kept ${speedKeep.toFixed(2)}x   (gate: >= 0.80x — the anti-spin guard)`);
  console.log(`  best closure     ${sL.closureBest.toFixed(4)}   (gate: >= 0.5 for at least one lineage)`);
}

const path = new URL(`./_zgoalevo_seed${SEED}.json`, import.meta.url);
writeFileSync(path, JSON.stringify({ ...history, winners }, null, 1));
console.log(`\n  written: tools/_zgoalevo_seed${SEED}.json`);
