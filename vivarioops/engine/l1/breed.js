// engine/l1/breed.js — breed semantics (10 §A17.3), N17 and N18.
//
// PURITY: rng and Rapier are both injected. This function is the whole game loop
// of step B, and it is deliberately pure: given the same generation, the same
// selection and the same seed it produces the same next generation, which is
// what makes undo trivial (keep the previous array) and the gate meaningful.
//
// ── TWO REPRODUCTION PATHS ──────────────────────────────────────────────────
//
// WAS "ASEXUAL ONLY IN THE SLICE". 30 R3 removed recombination from B4 on the
// grounds that "10 §3 sets allowGrafting: false; scheduling it here was a
// contradiction", and for six sessions every child had exactly one parent.
//
// THE PLAYER-FACING COST OF THAT, which is what brought it back: selecting three
// creatures produced three unchanged elites, one stranger and two single-parent
// mutants. Selecting MORE parents produced FEWER children and none of them mixed
// anything, so the one act the whole screen is built around — choosing which
// creatures should have children together — did nothing it looked like it did.
//
// Now: with ONE creature selected this file behaves exactly as it did, byte for
// byte and rng draw for rng draw. With two or more, offspring are recombinants of
// two selected parents (see crossover.js) and then mutated, at a reduced rate.
// A17.3's 40/30/30 mix is still not what happens — see MUTATIONS_PER_RECOMBINANT
// and CROSSOVER_RATE below — and the deviation is declared rather than silent.

import { mutateTimes, cloneGenome } from './mutate.js';
import { crossGenomes } from './crossover.js';
import { createRandomGenome, SLICE_LIMITS } from './factory.js';
import { assessViability, newTally, record, VIABILITY } from './viability.js';
// SIDEWAYS, not upward: /worlds/ is data in the engine's own schema — N3 forbids
// /trunk/, /ui/ and /render/, not this. seeds.js imports contracts/versions.js
// and nothing else, so the dependency stays acyclic and pure.
import { seedById } from '../../worlds/seeds.js';

/**
 * 10 §A17.3: "Population is fixed at 6." That is the TANK's population — six
 * slots is the player's screen — and it remains the default. It is no longer a
 * hard constraint on `breed()` itself: an auto-breeder running selection over
 * hundreds of individuals needs the same two rules at a different size, and
 * reimplementing them in a harness (as tools/_evo.mjs had to) means the shipped
 * path and the experiment are two different pieces of code that only look alike.
 */
export const POPULATION = 6;

/**
 * N17's IMMIGRATION RATE, which is what generalises — not the slot count.
 *
 * At the tank's six, "one slot is always a stranger" is one in six. Carry the
 * literal slot to a population of two hundred and immigration becomes 0.5%,
 * which is not the rule, it is the rule's corpse: 20 §3's finding is that
 * selection converges to a single animal within about five generations, and one
 * immigrant in two hundred does not slow that at all. The rate is the invariant.
 *
 * `max(1, round(n/6))` is exactly 1 at n = 6, so the tank's behaviour is
 * unchanged down to the rng draw, and it scales for everything else.
 */
export const strangerCount = (population) => Math.max(1, Math.round(population / 6));

/**
 * A9's single tuning knob: mutations per offspring. Higher means children look
 * less like their parents, which is the difference between "breeding does
 * nothing" and "breeding scrambles everything".
 */
export const MUTATIONS_PER_OFFSPRING = [1, 3];

/**
 * A9's "offspring from matings receive mutations too, but at reduced frequency".
 *
 * A separate constant rather than a scaling of the one above, because that one is
 * pinned as a literal by gate/breed.js and moving it would silently change the
 * asexual path while nobody was looking at it.
 *
 * The floor is 0 ON PURPOSE. It is the only way a pure recombinant — two parents
 * mixed and nothing else added — ever reaches the tank, and that is the child the
 * player can actually read as "those two, combined". Every other child carries
 * mutation noise on top and the mixing is a guess.
 */
export const MUTATIONS_PER_RECOMBINANT = [0, 2];

export const KIND = { ELITE: 'elite', OFFSPRING: 'offspring', STRANGER: 'stranger', AUTHORED: 'authored' };

/**
 * N17 — ONE TANK SLOT IS ALWAYS AN UNRELATED RANDOM GENOME.
 *
 * 20 §3 rates this as certain rather than probable: breeding by taste over six
 * individuals converges to a single animal within about five generations, and
 * the player experiences that as the game running out of content. It is the rule
 * "most likely to be lost in a refactor" (10 §A5), so it is not an option, a
 * config flag or a probability — the stranger slot is allocated first, before
 * elites and offspring compete for what is left.
 *
 * SPEC GAP, REPORTED. Neither 10 §A17.3 nor 21 §4.3 says what happens when the
 * player selects all six. "All selected survive unchanged as elites" (N18) and
 * "one slot is always a stranger" (N17) cannot both hold in six slots. N17 wins,
 * because it is the one whose absence kills the loop; the elite dropped is the
 * LAST one selected, so the outcome is predictable from the player's own last
 * action rather than arbitrary.
 *
 * Computed per call rather than fixed, since it is population minus the
 * immigration slots. At population 6 it is 5, exactly as before.
 */
const eliteCap = (population) => population - strangerCount(population);

/**
 * @param {object} args
 * @param {object} args.RAPIER     already-initialised Rapier namespace
 * @param {object[]} args.genomes  the current generation, length POPULATION
 * @param {number[]} args.selected indices into `genomes`, in the order tapped
 * @param {object} args.rng        injected; forked per offspring
 * @param {object} args.world
 * @param {object} [args.limits]   defaults to SLICE_LIMITS
 * @param {boolean} [args.lockMorphology]  A9's extra: vary behaviour, keep the body
 * @param {object[]} [args.injectStrangers]  genomes to place in the stranger slot(s)
 *        instead of drawing random ones — the player importing a saved creature as
 *        "the stranger" (N17's slot, filled by hand rather than by the factory).
 * @returns {{genomes:object[], provenance:object[], tally:object, droppedElite:number|null}}
 */
export function breed({ RAPIER, genomes, selected, rng, world, limits = SLICE_LIMITS,
                        lockMorphology = false, injectStrangers = [],
                        /**
                         * ── HOW MANY TIMES A ZYGOTE MAY BE RE-ROLLED ─────────
                         *
                         * Default `VIABILITY.maxAttempts` (12), which is A9's rule
                         * and the six-slot tank's behaviour, unchanged to the rng
                         * draw. Pass **1** for a Weismann-honest reproduction:
                         * one reproductive event, one zygote, and if development
                         * fails, THAT BIRTH FAILS.
                         *
                         * WHY THE OPTION EXISTS. With 12 tries and a parent-copy
                         * fallback, a genotype whose developmental neighbourhood
                         * is fragile has the SAME reproductive output as a robust
                         * one — the harness quietly pays its mutational load for
                         * it. Nothing then selects for developmental robustness,
                         * which is a property real evolution cares about a great
                         * deal, and `viableRate` below is the number that was
                         * being thrown away.
                         *
                         * KEEP 12 FOR THE PLAYER'S TANK, where a dead slot is a
                         * blank square and the loop is a toy. USE 1 WHEREVER
                         * SELECTION IS BEING MEASURED. That buys selection for
                         * robustness with no new fitness term and no new gene.
                         *
                         * MEASURED, 5 seeds x 6 slots, 30 reproductive events:
                         *
                         *     attempts 12  ->  0/30 fell back to a parent copy
                         *     attempts  1  ->  3/30 fell back
                         *
                         * So the re-roll was concealing a ~10% developmental
                         * failure rate, and concealing it UNIFORMLY — every
                         * lineage got the same free retries regardless of how
                         * fragile its neighbourhood was. That 10% is exactly the
                         * signal a robustness gradient would be made of.
                         */
                        viabilityAttempts = VIABILITY.maxAttempts }) {
  if (!Array.isArray(selected) || selected.length === 0) {
    // 10 §A17.3: "0 selected -> button disabled". Reaching here is a UI bug, and
    // silently breeding from an arbitrary parent would hide it.
    throw new Error('breed: nothing selected');
  }
  // The population is now whatever was handed in. The check that remains is the
  // one that catches a real bug: an empty generation.
  const population = genomes.length;
  if (population < 2) {
    throw new Error(`breed: population is ${population}, need at least 2`);
  }

  const ELITE_CAP = eliteCap(population);
  const elites = selected.slice(0, ELITE_CAP);
  const droppedElite = selected.length > ELITE_CAP ? selected[ELITE_CAP] : null;

  const next = new Array(population).fill(null);
  const provenance = new Array(population).fill(null);

  // N18 — SELECTED CREATURES SURVIVE UNCHANGED. The same object reference, not a
  // copy and not a re-derivation: a creature the player liked must be the same
  // creature next generation, byte-identical, or the loop is punishing. Elites
  // also KEEP THEIR SLOT, so the thing you selected does not move on you.
  for (const i of elites) {
    next[i] = genomes[i];
    provenance[i] = { kind: KIND.ELITE, parent: i, ops: [], attempts: 0, fellBack: false };
  }

  const free = [];
  for (let i = 0; i < population; i++) if (next[i] === null) free.push(i);

  // Strangers take free slots at random rather than always the last ones: a
  // fixed position teaches the player to ignore it, which defeats the purpose.
  // At population 6 this loop runs once and draws once, so the rng stream — and
  // therefore every existing seeded result — is unchanged.
  const strangerSlots = [];
  for (let k = 0; k < strangerCount(population) && free.length; k++) {
    strangerSlots.push(free.splice(rng.int(free.length), 1)[0]);
  }

  const tally = newTally();

  // Offspring parents are drawn ROUND-ROBIN from the selected pool, starting at
  // a random offset. Sampling with replacement, at these sizes, routinely gives
  // five children to one of two selected parents and none to the other, which
  // reads as the game ignoring half the selection.
  //
  // THE SECOND PARENT IS THE NEXT ONE ROUND, and it is derived arithmetically
  // rather than drawn. Two reasons, and the first is the load-bearing one:
  //
  //   1. It consumes NO rng. The single `rng.int(elites.length)` below is still
  //      the only top-level draw this loop makes, so breeding from one selected
  //      creature is bit-for-bit what it was before crossover existed, and every
  //      seeded gate result on that path is unmoved.
  //   2. It is fair in BOTH roles. Over a full cycle each selected creature is A
  //      exactly once and B exactly once. A randomly drawn B could hand a
  //      three-selected tank the pairs (0,2) and (0,2) and visibly ignore
  //      creature 1 — which is the same complaint, at the same sizes, that the
  //      paragraph above makes against sampling with replacement.
  let turn = rng.int(elites.length);
  for (const slot of free) {
    const parentIndex = elites[turn % elites.length];
    const mateIndex = elites.length >= 2 ? elites[(turn + 1) % elites.length] : null;
    turn++;
    const child = makeOffspring({
      RAPIER, parentA: genomes[parentIndex],
      parentB: mateIndex === null ? null : genomes[mateIndex],
      rng: rng.fork(`offspring:${slot}`),
      world, limits, lockMorphology, tally, viabilityAttempts,
    });
    next[slot] = child.genome;
    provenance[slot] = {
      // `parent` KEEPS ITS MEANING — the primary parent, a single index, the one
      // this child falls back to. `parents` is the new complete fact. Splitting
      // them rather than widening `parent` into an array is what lets old
      // persisted lineage records and every existing assertion read on unchanged.
      kind: KIND.OFFSPRING, parent: parentIndex,
      parents: child.crossed ? [parentIndex, mateIndex] : [parentIndex],
      crossed: child.crossed, grafted: child.grafted, tier: child.tier,
      ops: child.ops, attempts: child.attempts, fellBack: child.fellBack,
    };
  }

  // Strangers are drawn LAST so that their rng consumption cannot shift the
  // offspring, which keeps a breed reproducible while the stranger rule is
  // being argued about. Each forks on its own slot index, so the stream is
  // independent of how many there are.
  // An injected stranger (the player importing a saved creature) fills a stranger
  // slot BYTE-IDENTICAL and consumes no rng, so a breed with `injectStrangers`
  // empty is bit-for-bit what it was before — the gate and every seeded result
  // depend on that. Slots past the supply fall back to a fresh random draw, so a
  // single import into a one-stranger tank behaves exactly as designed.
  let injectAt = 0;
  for (const slot of strangerSlots) {
    if (injectAt < injectStrangers.length) {
      next[slot] = cloneGenome(injectStrangers[injectAt++]);
      provenance[slot] = {
        kind: KIND.STRANGER, parent: null, ops: [],
        attempts: 0, fellBack: false, viable: true, imported: true,
      };
      continue;
    }
    const stranger = strangerFor(RAPIER, rng.fork(`stranger:${slot}`), world, limits, tally);
    next[slot] = stranger.genome;
    provenance[slot] = {
      kind: KIND.STRANGER, parent: null, ops: [],
      attempts: stranger.attempts, fellBack: false,
      // H3b — false only when the search was exhausted. The UI labels it; nothing
      // silently presents an unviable creature as an ordinary one.
      viable: stranger.viable,
    };
  }

  return { genomes: next, provenance, tally, droppedElite };
}

/**
 * A9's retry loop: "reject and re-roll (max 12 attempts, then fall back to
 * unmutated parent)".
 *
 * The fallback produces a byte-identical twin of an elite, which the player sees
 * as two identical creatures — so the rate is recorded rather than hidden. If it
 * is ever more than a few percent, the viability filter is too strict or the
 * operators are producing rubbish, and A9 is explicit that this number is THE
 * diagnostic for whether mutation is healthy.
 */
function makeOffspring({ RAPIER, parentA, parentB, rng, world, limits, lockMorphology, tally,
                         viabilityAttempts = VIABILITY.maxAttempts }) {
  const crossed = wantsCrossover(parentB, rng, limits);
  const [lo, hi] = crossed ? MUTATIONS_PER_RECOMBINANT : MUTATIONS_PER_OFFSPRING;
  const graftPermille = Math.round((limits.graftRate ?? 0) * RATE_SCALE);

  for (let attempt = 1; attempt <= viabilityAttempts; attempt++) {
    let base = parentA;
    let ops = [];
    let grafted = 0;
    let tier = 0;

    if (crossed) {
      // ── THE LADDER ────────────────────────────────────────────────────────
      // Tier 1 (attempts 1-8): scalars crossed AND, at graftRate, a subgraph of
      // B transplanted. Tier 2 (9-12): scalars only.
      //
      // WHY TIER 2 EXISTS AND WHY IT IS THE RIGHT MIDDLE RUNG. A graft moves body
      // count, mass and interpenetration at the same time, so it fails viability
      // materially more often than a mutation does, and mutation is already at
      // 57% against a 60% target. Tier 2's morphology is parent A's, untouched —
      // the only genes differing from an ordinary asexual child are the fifteen
      // scalars, and of those only `controller.omega` measurably touches
      // viability (minSelfMotion). So tier 2's success rate is within noise of
      // the asexual path's: the ladder CANNOT push the fallback rate above what
      // it was before crossover existed, which is what protects L1-30. And the
      // child is still genuinely bipartental — colour, pattern, tempo, social.
      tier = attempt <= GRAFT_ATTEMPTS ? 1 : 2;
      const graft = tier === 1 && rng.int(RATE_SCALE) < graftPermille;
      const x = crossGenomes(parentA, parentB, rng, { limits, graft });
      base = x.genome; ops = x.ops; grafted = x.grafted;
    }

    const n = lo + rng.int(hi - lo + 1);
    const m = mutateTimes(base, rng, n, { limits, lockMorphology });
    const v = record(tally, assessViability(RAPIER, m.genome, world));
    if (v.ok) {
      // THE GENERATION COUNTER FIRES HERE AND NOWHERE ELSE, because this is the
      // only line in the codebase that constitutes a live birth. `cloneGenome`
      // carries `origin` through every scratch copy, hill-climb candidate and
      // serialisation round-trip; if it incremented there, `generations` would
      // count evaluations rather than ancestors and the number would be fiction.
      m.genome.origin = {
        founder: m.genome.origin.founder,
        generations: m.genome.origin.generations + 1,
      };
      return { genome: m.genome, ops: [...ops, ...m.ops], attempts: attempt,
               fellBack: false, crossed, grafted, tier };
    }
  }
  // THE FALLBACK IS PARENT A, and it is still "the unmutated parent" in the sense
  // L1-30 asserts: only an unmodified parent is viable by definition, and A is
  // the creature that would have been this child's sole parent on the asexual
  // path. A blend of two parents has no such guarantee, which is the whole reason
  // the last rung is not one.
  return { genome: parentA, ops: [], attempts: viabilityAttempts,
           fellBack: true, crossed, grafted: 0, tier: 0 };
}

/** Integer permille, for the reason mutate.js gives: determinism is exact-integer. */
const RATE_SCALE = 1000;

/** Attempts 1..GRAFT_ATTEMPTS may graft; the rest are scalar-only. See the ladder. */
const GRAFT_ATTEMPTS = 8;

/**
 * Whether this child is a recombinant. Decided ONCE per child, not per attempt,
 * so the ladder retries the same kind of animal rather than drifting between two.
 *
 * NO DRAW IS MADE AT RATE 0 OR RATE 1. A coin whose outcome is already determined
 * is not a decision, and spending an rng draw on one would mean `crossoverRate: 0`
 * did not reproduce the pre-crossover stream — which is precisely the property
 * that let this land in two commits, the second of which changed behaviour and
 * nothing else. A fractional rate in between still works and still costs one draw.
 */
function wantsCrossover(parentB, rng, limits) {
  if (!parentB) return false;
  const permille = Math.round((limits.crossoverRate ?? 0) * RATE_SCALE);
  if (permille <= 0) return false;
  if (permille >= RATE_SCALE) return true;
  return rng.int(RATE_SCALE) < permille;
}

/**
 * The stranger is filtered for viability too. An unrelated creature that sits
 * inert on the floor is indistinguishable from a bug, and it wastes the one slot
 * that exists to keep the population from collapsing.
 *
 * ── H3b: EXHAUSTION IS REPORTED, NEVER SILENT. ──────────────────────────────
 *
 * This used to `return last` — the final candidate, WHETHER OR NOT it passed —
 * so the one slot that exists to protect the population could knowingly contain
 * an invalid genome, and nothing downstream could tell. An offspring that
 * exhausts its attempts falls back to its unmutated parent, which is viable by
 * definition; a stranger is drawn from nothing and has no such fallback.
 *
 * Three ways out were considered. Throwing makes a rare draw crash a running
 * game. A frozen fallback fixture puts a hand-authored creature in a slot whose
 * whole point is that it is unrelated and random, and it would drift out of the
 * generator's distribution the moment step F loosens the factory. So the slot is
 * filled — the tank is never left short — and the verdict TRAVELS WITH IT:
 * `viable` reaches provenance, the UI can label it, and the gate can assert it.
 * Nothing crashes and nothing is quiet.
 *
 * @returns {{genome:object, viable:boolean, attempts:number}}
 */
function strangerFor(RAPIER, rng, world, limits, tally, maxAttempts = VIABILITY.strangerAttempts) {
  let last = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const g = createRandomGenome(rng.fork(`try:${attempt}`), limits);
    last = g;
    if (record(tally, assessViability(RAPIER, g, world)).ok) {
      return { genome: g, viable: true, attempts: attempt + 1 };
    }
  }
  // The slot is filled so the tank is never short, and the failure is stated.
  return { genome: last, viable: false, attempts: maxAttempts };
}

/**
 * The opening generation: unrelated viable strangers, six of them by default.
 * 21 §4.6 auto-creates a lineage on first run, so this is what the player meets.
 * `population` is an argument only so that an auto-breeder can start a run of a
 * hundred through the same path the tank uses; the default is unchanged and the
 * rng forks on the index, so seeding six is bit-identical to before.
 */
/**
 * AUTHORED SLOTS IN THE OPENING POPULATION — B2 §3.3.
 *
 * How many of the first `population` creatures come from `worlds/seeds.js`
 * rather than from the factory. Two of six, and it is not a taste call.
 *
 * Defaulting the solver motor (§3.2) moved the random corpus down by roughly 7x
 * at the median, and that is the CORRECT number rather than one to be tuned
 * away: §0.2 measures a designed swimmer beating a random creature by a large
 * factor through the solver and by very little through the PD, and "the PD makes
 * everything look alive and makes design irrelevant" is precisely the property
 * being given up on purpose. But it means the first screen a player sees cannot
 * be six random creatures, because six random creatures through an honest
 * actuator is a tank of things that barely move.
 *
 * SO THIS IS LOAD-BEARING, NOT A VARIETY NICETY, and it is the reason the seed
 * library was built before it was needed. Reach for authoring before reaching
 * for `motorFreqHz`/`motorZeta` (§3.3): the dial trades away the thing that
 * makes selection worth doing.
 *
 * TWO, NOT MORE. N17's stranger slot and the breeding loop both need room, and
 * an opening tank that is mostly hand-written is a demo rather than a generator.
 */
export const AUTHORED_SLOTS = 2;

/** Authored ids offered to the opening tank, in order. `staircase` is a deliberate counter-example and is excluded. */
export const OPENING_SEEDS = ['eel', 'eel-finned', 'eel-slow', 'eel-fast'];

export function seedPopulation({ RAPIER, rng, world, limits = SLICE_LIMITS, population = POPULATION,
                                 authoredSlots = AUTHORED_SLOTS }) {
  const tally = newTally();
  const drawn = [];

  // AUTHORED FIRST, so that a small population still gets them: at population 2
  // the tank is the two seeds rather than two randoms and a dropped intention.
  // Drawn WITHOUT viability filtering — an authored creature is authored, and
  // `tools/_atlas.mjs` already validates every entry. Running them through
  // strangerFor would let a threshold calibrated on the random corpus silently
  // reject the library that exists to compensate for that corpus.
  const authored = Math.min(authoredSlots, population);
  const chosen = [];
  for (let i = 0; i < authored; i++) {
    const seed = seedById(OPENING_SEEDS[i % OPENING_SEEDS.length]);
    if (!seed) continue;
    chosen.push(cloneGenome(seed.genome ?? seed));
  }
  for (const genome of chosen) {
    drawn.push({ genome, attempts: 0, viable: true, authored: true });
  }

  for (let i = drawn.length; i < population; i++) {
    drawn.push(strangerFor(RAPIER, rng.fork(`seed:${i}`), world, limits, tally));
  }
  return {
    genomes: drawn.map(d => d.genome),
    tally,
    provenance: drawn.map(d => ({
      kind: d.authored ? KIND.AUTHORED : KIND.STRANGER, parent: null, ops: [],
      attempts: d.attempts, fellBack: false, viable: d.viable,
    })),
  };
}
