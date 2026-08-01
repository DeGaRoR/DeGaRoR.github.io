// engine/l1/breed.js — breed semantics (10 §A17.3), N17 and N18.
//
// PURITY: rng and Rapier are both injected. This function is the whole game loop
// of step B, and it is deliberately pure: given the same generation, the same
// selection and the same seed it produces the same next generation, which is
// what makes undo trivial (keep the previous array) and the gate meaningful.
//
// ── ASEXUAL ONLY IN THE SLICE ───────────────────────────────────────────────
// 10 §A17.3 says "offspring drawn from the selected pool using the 40/30/30
// asexual/crossover/graft mix", and A9 describes the grafting operator in
// detail. 30 R3 removed both from B4 — "10 §3 sets allowGrafting: false;
// scheduling it here was a contradiction. Offspring are mutated descendants of
// selected elites. Recombination returns at step F." The plan wins on what is in
// the slice, so there is one reproduction path here. 10 §A17.3 is stale and is
// reported as a spec defect.

import { mutateTimes, cloneGenome } from './mutate.js';
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
                        lockMorphology = false, injectStrangers = [] }) {
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
  let turn = rng.int(elites.length);
  for (const slot of free) {
    const parentIndex = elites[turn % elites.length];
    turn++;
    const child = makeOffspring({
      RAPIER, parent: genomes[parentIndex], rng: rng.fork(`offspring:${slot}`),
      world, limits, lockMorphology, tally,
    });
    next[slot] = child.genome;
    provenance[slot] = {
      kind: KIND.OFFSPRING, parent: parentIndex,
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
function makeOffspring({ RAPIER, parent, rng, world, limits, lockMorphology, tally }) {
  const [lo, hi] = MUTATIONS_PER_OFFSPRING;
  for (let attempt = 1; attempt <= VIABILITY.maxAttempts; attempt++) {
    const n = lo + rng.int(hi - lo + 1);
    const { genome, ops } = mutateTimes(parent, rng, n, { limits, lockMorphology });
    const v = record(tally, assessViability(RAPIER, genome, world));
    if (v.ok) return { genome, ops, attempts: attempt, fellBack: false };
  }
  return { genome: parent, ops: [], attempts: VIABILITY.maxAttempts, fellBack: true };
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
