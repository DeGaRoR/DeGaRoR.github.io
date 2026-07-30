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

import { mutateTimes } from './mutate.js';
import { createRandomGenome, SLICE_LIMITS } from './factory.js';
import { assessViability, newTally, record, VIABILITY } from './viability.js';

/** 10 §A17.3: "Population is fixed at 6." */
export const POPULATION = 6;

/**
 * A9's single tuning knob: mutations per offspring. Higher means children look
 * less like their parents, which is the difference between "breeding does
 * nothing" and "breeding scrambles everything".
 */
export const MUTATIONS_PER_OFFSPRING = [1, 3];

export const KIND = { ELITE: 'elite', OFFSPRING: 'offspring', STRANGER: 'stranger' };

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
 */
const ELITE_CAP = POPULATION - 1;

/**
 * @param {object} args
 * @param {object} args.RAPIER     already-initialised Rapier namespace
 * @param {object[]} args.genomes  the current generation, length POPULATION
 * @param {number[]} args.selected indices into `genomes`, in the order tapped
 * @param {object} args.rng        injected; forked per offspring
 * @param {object} args.world
 * @param {object} [args.limits]   defaults to SLICE_LIMITS
 * @param {boolean} [args.lockMorphology]  A9's extra: vary behaviour, keep the body
 * @returns {{genomes:object[], provenance:object[], tally:object, droppedElite:number|null}}
 */
export function breed({ RAPIER, genomes, selected, rng, world, limits = SLICE_LIMITS, lockMorphology = false }) {
  if (!Array.isArray(selected) || selected.length === 0) {
    // 10 §A17.3: "0 selected -> button disabled". Reaching here is a UI bug, and
    // silently breeding from an arbitrary parent would hide it.
    throw new Error('breed: nothing selected');
  }
  if (genomes.length !== POPULATION) {
    throw new Error(`breed: population is ${genomes.length}, expected ${POPULATION}`);
  }

  const elites = selected.slice(0, ELITE_CAP);
  const droppedElite = selected.length > ELITE_CAP ? selected[ELITE_CAP] : null;

  const next = new Array(POPULATION).fill(null);
  const provenance = new Array(POPULATION).fill(null);

  // N18 — SELECTED CREATURES SURVIVE UNCHANGED. The same object reference, not a
  // copy and not a re-derivation: a creature the player liked must be the same
  // creature next generation, byte-identical, or the loop is punishing. Elites
  // also KEEP THEIR SLOT, so the thing you selected does not move on you.
  for (const i of elites) {
    next[i] = genomes[i];
    provenance[i] = { kind: KIND.ELITE, parent: i, ops: [], attempts: 0, fellBack: false };
  }

  const free = [];
  for (let i = 0; i < POPULATION; i++) if (next[i] === null) free.push(i);

  // The stranger takes a free slot at random rather than always the last one: a
  // fixed position teaches the player to ignore it, which defeats the purpose.
  const strangerSlot = free.splice(rng.int(free.length), 1)[0];

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

  // The stranger is drawn LAST so that its rng consumption cannot shift the
  // offspring, which keeps a breed reproducible while the stranger rule is
  // being argued about.
  const stranger = strangerFor(RAPIER, rng.fork(`stranger:${strangerSlot}`), world, limits, tally);
  next[strangerSlot] = stranger.genome;
  provenance[strangerSlot] = {
    kind: KIND.STRANGER, parent: null, ops: [],
    attempts: stranger.attempts, fellBack: false,
    // H3b — false only when the search was exhausted. The UI labels it; nothing
    // silently presents an unviable creature as an ordinary one.
    viable: stranger.viable,
  };

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
 * The opening generation: six unrelated viable strangers. 21 §4.6 auto-creates a
 * lineage on first run, so this is what the player meets.
 */
export function seedPopulation({ RAPIER, rng, world, limits = SLICE_LIMITS }) {
  const tally = newTally();
  const drawn = [];
  for (let i = 0; i < POPULATION; i++) {
    drawn.push(strangerFor(RAPIER, rng.fork(`seed:${i}`), world, limits, tally));
  }
  return {
    genomes: drawn.map(d => d.genome),
    tally,
    provenance: drawn.map(d => ({
      kind: KIND.STRANGER, parent: null, ops: [],
      attempts: d.attempts, fellBack: false, viable: d.viable,
    })),
  };
}
