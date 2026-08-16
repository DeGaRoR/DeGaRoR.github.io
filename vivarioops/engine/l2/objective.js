// engine/l2/objective.js — SELECTION OBJECTIVES AND THE AUTO-BURST (B2 §9 step 6).
//
// PURITY (01 §4, N1-N3): no clock, no Math.random, no DOM, no imports from
// /trunk/, /ui/, /render/. Rapier and the rng arrive injected.
//
// NOT A PROBE, DELIBERATELY. 11 §3's probes produce fields of the compiled
// Species record and every one of them costs a BRIDGE_V bump to change. An
// objective is what SELECTION reads, it is not part of any creature's identity,
// and it must stay free to change without invalidating every cached record in
// the project. S4 and S5 are also already reserved for pursuit and evasion, so
// taking an S-number here would have been wrong twice.
//
// ── WHY THIS EXISTS AT ALL ───────────────────────────────────────────────────
//
// B2 §0: "the breeding loop rarely improves — child beats parent 18% of
// generations; stranger beats elite 3%", and "more strangers makes it worse".
// A player tapping six creatures is a very weak optimiser. The auto-burst is the
// cheap fix that was measured to work: 3 generations at population 24 moves taps
// that improve from 27% to 47%, while 10 generations at population 60 gives 23%
// at eight times the cost. SHORT BURSTS WORK AND LONG ONES DO NOT, which is the
// opposite of the obvious intuition and is why the numbers below are small.

import { runSolo } from './probe.js';
import { forageProfile, FORAGE_WARMUP } from './forage.js';
import { morphogenesis, totalMass, boundingRadius } from '../l1/morphogen.js';
import { breed, seedPopulation, POPULATION } from '../l1/breed.js';
import { SLICE_LIMITS } from '../l1/factory.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants of the OBJECTIVE. Unlike the probe constants these do NOT bump
// BRIDGE_V, because nothing they produce is stored on a record.
// ─────────────────────────────────────────────────────────────────────────────

/** B2 §0: "120 trials x 6 sim-seconds in 5.7 s wall; split-half reliability r = 0.78". */
export const TRIAL_SECONDS = 6.0;

/** §0: 3 generations at population 24. Both numbers are measured, not chosen. */
export const BURST_GENERATIONS = 3;
export const BURST_POPULATION = 24;

/**
 * NET SPEED over a fixed window, ON THE TORUS.
 *
 * `bounded: false` would measure open water, which is not the world the player
 * is in; `bounded: true` would measure the wall, because the boundary is
 * absorbing and a creature that reaches it stops. `wrap: true` is the only
 * option that is both finite and boundary-free, and it is the reason §4.2 was
 * built before this rather than after.
 *
 * NET, NOT PATH LENGTH. Distance between the start and end of the window
 * divided by its duration. A creature that thrashes in place scores zero, which
 * is what an objective for LOCOMOTION has to say about it — path length would
 * rank the thrashers first.
 *
 * @returns {{score:number, valid:boolean, reason?:string}}
 */
export function netSpeed(RAPIER, { plan, genome, world, seconds = TRIAL_SECONDS, simOpts = {} }) {
  const r = runSolo(RAPIER, {
    plan, genome, world,
    duration: seconds,
    effort: 1,
    turnBias: 0,
    bounded: false,
    wrap: true,
    // Actuator/world overrides for experiments (e.g. boundTorque:false). Default
    // {} keeps the shipped actuator, so selection measures the world the player is
    // in. NOT persisted — an objective carries no record identity.
    simOpts,
  });
  if (!r.valid) return { score: 0, valid: false, reason: r.reason };

  const tr = r.trace;
  const n = tr.n;
  if (n < 2) return { score: 0, valid: false, reason: 'short' };

  // `com` is interleaved xyz, and it is the UNWRAPPED centre — sample() reads
  // sim.centreOfMass(), which adds the torus shift back. That is exactly why the
  // wrap was made invisible at the simulation rather than compensated here.
  const dx = tr.com[(n - 1) * 3 + 0] - tr.com[0];
  const dy = tr.com[(n - 1) * 3 + 1] - tr.com[1];
  const dz = tr.com[(n - 1) * 3 + 2] - tr.com[2];
  const d = Math.hypot(dx, dy, dz);
  const dt = tr.t[n - 1] - tr.t[0];
  if (!Number.isFinite(d) || dt <= 0) return { score: 0, valid: false, reason: 'unstable' };
  return { score: d / dt, valid: true };
}

/**
 * Score a whole population. Returns scores aligned with `genomes`.
 *
 * A genome that will not build scores zero rather than throwing: an objective
 * that can crash cannot be used by a UI action, and morphogenesis rejecting a
 * body IS a verdict about it.
 */
export function scorePopulation(RAPIER, genomes, world, seconds = TRIAL_SECONDS, simOpts = {}) {
  return genomes.map((genome) => {
    let plan;
    try { plan = morphogenesis(genome); } catch { return 0; }
    if (plan.bodyCount < 2) return 0;
    const r = netSpeed(RAPIER, { plan, genome, world, seconds, simOpts });
    return r.valid ? r.score : 0;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SELECTABLE OBJECTIVES — what the player can point a burst AT.
//
// The burst used to have exactly one objective, hard-coded, and the screen never
// said which. "It auto-selects, on what parameter?" is a question the UI could not
// answer, so it is answered here and surfaced in the burst sheet.
//
// EACH ONE CARRIES ITS OWN RELIABILITY. That is the point of the `trusted` field:
// the project has measured, for every number it can produce, whether that number
// means anything, and an objective the player can choose is exactly where that
// finding has to be visible. Selecting hard on a number that is noise produces
// six creatures optimised for nothing, and it looks identical to it working.
//
// ── WHAT IS DELIBERATELY ABSENT, AND WHY ─────────────────────────────────────
//
//   TURNING. `turnRate` is measured at a median of 0.0032 rad/s — 0.18 degrees
//   per second — so a creature turns under 3 degrees in a 15 s window. Selecting
//   on it would be selecting on measurement noise. It comes back when B2 §5's
//   steering-authority blocker is answered, not before.
//
//   EFFICIENCY / cost of transport. `cotC0`/`cotC1` fit three near-coincident
//   power points, and on the solver path `work` is a RECONSTRUCTION rather than a
//   measurement (Rapier does not expose the motor impulse). C1's own finding is
//   that S2 yields one trustworthy number out of eight.
//
// Adding one here is a data change and nothing else — the burst loop reads this
// list, and the sheet builds its buttons from it.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Objective
 * @property {string} id
 * @property {string} label      shown on the burst sheet's button
 * @property {string} note       one line, shown under it — what the number IS
 * @property {boolean} adapt     hill-climb the gait before scoring (see below)
 * @property {boolean} trusted   has this number been validated as a selector?
 * @property {function} measure  (RAPIER, genome, plan, world, seconds) -> number
 */

/**
 * `adapt` MEANS "this objective is meaningless on a birth gait".
 *
 * gait.js's finding: a random morphology is almost never handed a controller that
 * makes it swim, so scoring it as born measures the draw and not the body — 0/12
 * random creatures clear 0.02 body-lengths/s at birth against 7/12 after a few
 * hill-climb steps. Any objective that reads MOTION has to adapt first or it is
 * ranking controller luck.
 *
 * Geometry does not: mass and reach are exact functions of the body plan, cost no
 * simulation at all, and cannot be improved by a better gait. That is why the
 * geometric bursts return instantly and the speed burst takes twenty seconds —
 * the difference is real work, not a throttle.
 *
 * NOTE THE COUPLING, so it is not discovered later: `adaptGait` hill-climbs NET
 * SPEED specifically. It is the right adapter for `speed` because they read the
 * same quantity. A second motion objective added here would need its own adapter
 * or it would optimise one thing and select on another.
 */
export const OBJECTIVES = [
  {
    id: 'speed', cost: 'motion', label: 'Speed', adapt: true, trusted: true,
    note: 'net distance per second, gait adapted first',
    measure: (RAPIER, genome, plan, world, seconds) => {
      const r = netSpeed(RAPIER, { plan, genome, world, seconds });
      return r.valid ? r.score : 0;
    },
  },
  {
    id: 'size', cost: 'free', label: 'Size', adapt: false, trusted: true,
    note: 'total mass — shape, not swimming',
    measure: (_RAPIER, _genome, plan) => totalMass(plan),
  },
  {
    // RENAMED FROM "Reach". `reach` is DUEL vocabulary — engagement separation is
    // k*(reachA+reachB) — and on a burst button it read as "how far it can get",
    // i.e. as a locomotion objective. It is not: it is boundingRadius, a pure
    // geometric extent, so it selects big sprawling bodies exactly as `Size`
    // selects heavy ones. A player choosing it to breed better swimmers got
    // bigger ones and no way to tell why.
    //
    // Same number, honest name. The two geometric objectives now differ only in
    // WHICH bigness they reward — mass versus span — and both say "no simulation"
    // so it is clear neither watches the creature move. Speed is the one that does.
    id: 'reach', cost: 'free', label: 'Span', adapt: false, trusted: true,
    note: 'how far the body sprawls from its centre — shape, not swimming',
    measure: (_RAPIER, _genome, plan) => boundingRadius(plan),
  },

  // ══ THE FORAGE OBJECTIVES ══════════════════════════════════════════════════
  //
  // Three readings of ONE trial. `forageProfile` returns intake, spend and the
  // ratio from a single run, so which of these the player picks costs exactly
  // the same — the choice is about WHAT IS BEING SELECTED FOR, not about budget.
  //
  // ── THE CHEAP TRIAL, AND WHY IT IS NOT THE CANONICAL ONE ───────────────────
  //
  // `BURST_WINDOW` is 60 s against `FORAGE_WINDOW`'s 150. This is R9's
  // cheap-trial-ranks / canonical-trial-reports split, which `design/PLAN.md`
  // Phase 4 names as the way to make a programme fit a button. Measured on four
  // creatures: 150 s costs 1751 ms and 60 s costs 886 ms, and the two produce
  // the SAME ORDERING. 40 s is cheaper again and reverses two of the four, so
  // the saving stops being free somewhere between them.
  //
  // ⚠ n = 4. That is enough to reject 40 s and not enough to certify 60 s over a
  // whole corpus. The burst RANKS with this; the Atlas card and the specimen
  // page still report the canonical `PROFILE_TAG` measurement, and the two are
  // deliberately different numbers with different names.
  //
  // THE WARMUP IS NOT NEGOTIABLE and is kept at the full 30 s. A creature wakes
  // inside an untouched patch and eats at ~3x the stabilised rate; a trial
  // without warmup measures where it was dropped.
  //
  // ── `adapt: false`, AND THIS IS THE HONEST SETTING ─────────────────────────
  //
  // Read the note on `adapt` above: `adaptGait` hill-climbs NET SPEED. Handing
  // it a forage objective would tune every body for travel and then score it on
  // eating — optimising one quantity and selecting on another, which is the
  // exact failure that note exists to prevent. `forage.js`'s own docstring says
  // it outright: "Any burst that selects on this function must pass an adapter
  // that hill-climbs THIS score, or pass none at all."
  //
  // There is no forage adapter. `design/PLAN.md` lists "No forage-specific gait
  // adapter" as a live debt against Phase 2. So these score the BIRTH GAIT.
  //
  // AND THAT COSTS NOTHING MEASURABLE HERE, which was not the expected answer.
  // Running the same 12 random draws through `adaptGait` first and then scoring:
  // food still gives 8 distinct values and yield still gives 10 — identical
  // discrimination — for 1158 ms per body against 720. The speed adapter buys
  // 60% more wall-clock and no more ordering, so declining it is not a
  // compromise forced by the missing adapter; on this measurement it is simply
  // the better setting.
  {
    id: 'food', cost: 'forage', label: 'Food', adapt: false, trusted: true,
    note: 'grams eaten per second, after the field settles',
    measure: (RAPIER, genome, plan, world) => {
      const p = burstForage(RAPIER, plan, genome, world);
      return p ? p.foodPerSecond : 0;
    },
  },
  {
    // ── NOT TRUSTED, AND THE REASON IS MEASURED ───────────────────────────────
    //
    // ROADMAP §5b's first `_zselect` lesson: "never select on the ratio — it is a
    // margin, won by not spending, and the cheapest way not to spend is not to
    // move." Drifter posts the best multiplier in the whole library — 94x — on a
    // THIRD of the teal snarlback's intake. A player who picks this and runs it
    // hard breeds something that has perfected sitting still.
    //
    // IT SHIPS ANYWAY. It is a real quantity, it is the one a breeder asks for by
    // name, and `trusted: false` is the mechanism this file already has for
    // saying "this number is choosable and you should know what it does". Hiding
    // it would not stop anyone wanting it; labelling it is what the field is for.
    id: 'ledger', cost: 'forage', label: 'Ledger', adapt: false, trusted: false,
    note: 'intake over spend — a RATIO, and it is won by not moving',
    measure: (RAPIER, genome, plan, world) => {
      const p = burstForage(RAPIER, plan, genome, world);
      return p && Number.isFinite(p.multiplier) ? p.multiplier : 0;
    },
  },
  {
    // ── THE ONE TO ACTUALLY BREED ON ──────────────────────────────────────────
    //
    // Intake times ratio. The product is what closes the hole in each half: a
    // glutton that spends everything scores a poor ratio, and a drifter that
    // spends nothing has almost no intake to multiply. Neither degenerate
    // strategy wins, which is exactly what neither number alone can say.
    //
    // Dimensionally it is g/s x (dimensionless), so it reads as a rate — "food
    // per second, discounted by what the swimming cost". Ranking is all that is
    // asked of it, so the units not being meaningful in isolation is acceptable;
    // it is not reported anywhere as a measurement.
    id: 'yield', cost: 'forage', label: 'Yield', adapt: false, trusted: true,
    note: 'food per second x ledger — rewards eating well AND cheaply',
    measure: (RAPIER, genome, plan, world) => {
      const p = burstForage(RAPIER, plan, genome, world);
      if (!p || !Number.isFinite(p.multiplier)) return 0;
      return p.foodPerSecond * p.multiplier;
    },
  },
];

/** The cheap ranking trial. See the block above for why 60 s and why 30 s warmup. */
export const BURST_WINDOW = 60;

/**
 * One forage trial, or null if the creature will not run or came apart.
 *
 * `intact` IS CHECKED. ROADMAP §5b lesson 3: a body that disintegrates reports
 * fictional intake — 7864 g against rivals' 31-49 — so an objective that skipped
 * this would rank every exploded creature first and select for explosion.
 */
function burstForage(RAPIER, plan, genome, world) {
  try {
    const p = forageProfile(RAPIER, {
      plan, genome, world, foodOpts: { seed: 11 },
      warmup: FORAGE_WARMUP, window: BURST_WINDOW,
    });
    if (!p.valid || !p.intact) return null;

    // ── THERE IS NO MOVEMENT CULL HERE, AND ONE WAS TRIED AND REMOVED ────────
    //
    // design/15-BREEDING.md §1.3 rates "select on controlled movement first" as
    // NOT OPTIONAL, so a cull was added: reject anything that did not translate
    // one body radius. Measured over 12 random draws it rejected 9 — including a
    // creature eating 21 mg/s — and flattened every forage score to zero, which
    // the gate caught as "tells creatures apart: got 1".
    //
    // THE ADVICE IS RIGHT AND WAS APPLIED TO THE WRONG OBJECTIVE. Read it in
    // full: "nothing in a random corpus ARRIVES, so an ARRIVAL-FLAVOURED
    // objective has no gradient until this is done." It is about goal-seeking,
    // where a stationary creature scores an identical zero to every other
    // stationary creature and selection has nothing to climb. Foraging is not
    // like that: intake IS the gradient, it discriminates on the birth gait over
    // a random corpus (8 distinct food values and 10 distinct yields out of 12),
    // and a creature that sweeps a local patch without translating is foraging
    // successfully by a strategy the cull would have called failure.
    //
    // Kept as a comment rather than deleted, because "cull on movement first" is
    // going to look obviously correct again the next time someone reads §1.3.
    return p;
  } catch { return null; }
}

export const objectiveById = (id) => OBJECTIVES.find(o => o.id === id) ?? OBJECTIVES[0];

/**
 * Score genomes under a chosen objective. Mirrors `scorePopulation`'s contract —
 * a genome that will not build scores zero rather than throwing, because
 * morphogenesis rejecting a body IS a verdict about it and an objective that can
 * crash cannot be driven from a button.
 */
export function scoreBy(RAPIER, objective, genomes, world, seconds = TRIAL_SECONDS) {
  return genomes.map((genome) => {
    let plan;
    try { plan = morphogenesis(genome); } catch { return 0; }
    if (plan.bodyCount < 2) return 0;
    try { return objective.measure(RAPIER, genome, plan, world, seconds); } catch { return 0; }
  });
}

/**
 * ONE AUTO-BURST: expand to `population`, run `generations` of scored selection,
 * and hand back the best `keep` genomes.
 *
 * ── THE NULL ARM IS NOT OPTIONAL ─────────────────────────────────────────────
 *
 * `selection: 'random'` runs the identical loop and picks survivors AT RANDOM.
 * B2 §10 leads with this: "run the null arm — a 28x selection result was
 * reproduced by random survivors." Any claim that this function improves
 * anything has to be a claim about the DIFFERENCE between the two arms, and the
 * cheapest way to guarantee that stays possible is for the null arm to be a
 * parameter of the real function rather than a separate script somebody has to
 * remember to write.
 *
 * @param {object} args `{ RAPIER, genomes, rng, world, limits, generations,
 *                         population, keep, seconds, selection }`
 * @returns `{ genomes, scores, history, trials }`
 */
export function autoBurst({
  RAPIER, genomes, rng, world,
  limits = SLICE_LIMITS,
  generations = BURST_GENERATIONS,
  population = BURST_POPULATION,
  keep = POPULATION,
  seconds = TRIAL_SECONDS,
  selection = 'score',
  // B2 §7.1 — THE OBJECTIVE IS A PARAMETER. It was `scorePopulation` hardcoded,
  // which made the burst a locomotion burst by construction and would have
  // forced a second near-identical function the moment intent needed selecting
  // for. The null arm, the expansion and the trial accounting are the parts
  // worth sharing; WHAT is being selected for is not.
  objective = null,
  // C3 — THE GAIT INNER LOOP, INJECTED. When supplied (gait.js `adaptPopulation`,
  // signature `(RAPIER, genomes, world, {rng}) -> {genomes, scores}`), each body
  // is adapted before it is scored. This is the "a body is judged by its adapted
  // gait, never its birth gait" rule that turned 0/12 random creatures above
  // 0.02 L/s into more. Injected rather than imported to keep objective.js free of
  // a gait.js dependency (no import cycle).
  adaptFn = null,
  /**
   * ── WHAT THE ADAPTED CONTROLLER IS ALLOWED TO DO — the Weismann barrier. ────
   *
   * 'weismann'   (DEFAULT) the adapted gait SCORES the body and is then DISCARDED.
   *              Selection sees the adapted score; breeding sees the BIRTH genome.
   * 'lamarckian' the adapted controller replaces the birth one and is inherited.
   *              The pre-2026-08-08 behaviour, kept so the two can be compared.
   *
   * WHY THE DEFAULT MOVED. This was unconditionally Lamarckian, and it was never a
   * decision — the word appears in the code but no document chose it, while both
   * the standing design (planLocomotion E2) and the plan that supersedes it reject
   * Lamarckian inheritance explicitly and adopt Baldwinian + genetic assimilation.
   *
   * AND IT IS NOT MERELY INCONSISTENT. `adaptGait` is a (1+lambda) hill climb on
   * NET DISPLACEMENT MEASURED BY THE SIMULATOR. The creature has no access to that
   * objective and does not perform the search; it is an external optimizer whose
   * result was being written into the germ line. Under it:
   *
   *   - selection cannot favour a good BIRTH controller, because every body is
   *     rescued to its local optimum before it is judged;
   *   - the Baldwin instrumentation is unreadable. The innate probe measures the
   *     gap between the born and the learned, and an oracle that closes that gap
   *     before reproduction makes the gap zero by construction. The whole of the
   *     plan's Phase 5 is unmeasurable while this is on.
   *
   * Scoring a body at its best is a legitimate MEASUREMENT choice and is kept.
   * Inheriting the result is a claim about heredity, and that one is withdrawn.
   *
   * ── AND IT COSTS ALMOST NOTHING. MEASURED, 3 generations at population 24, ──
   * identical seeds in both arms, final-generation best on the netSpeed objective:
   *
   *     seed    weismann   lamarckian    delta
   *        1      0.9149       1.1267   +0.2119
   *        2      1.0501       0.9619   -0.0882      <-- the OTHER way
   *        3      0.7552       0.9613   +0.2061
   *     mean      0.9067       1.0166   +12.1%
   *
   * So the oracle was worth ~12% of final score, and NOT CONSISTENTLY — one seed
   * of three reversed. At n=3 with a sign flip that is barely distinguishable from
   * noise. It was buying very little, and it was buying it by making the central
   * claim of the project's evolutionary story untrue.
   */
  inheritance = 'weismann',
}) {
  let pop = genomes.slice();
  const history = [];
  let trials = 0;

  // Score a population, and — with adaptFn — adapt each body's gait first.
  // Returns { genomes, scores }; accumulates the true evaluation count into trials.
  //
  // THE ONE LINE THAT IS THE WEISMANN BARRIER is the `genomes:` field below. Under
  // 'weismann' the adapted genomes are used for nothing but their scores and the
  // BIRTH population is handed back; under 'lamarckian' the adapted ones survive.
  // Same simulation, same trial count, same scores — the only difference is what
  // reproduces.
  const evaluate = (population, tag) => {
    if (adaptFn) {
      const a = adaptFn(RAPIER, population, world, { rng: rng.fork(`adapt:${tag}`) });
      trials += a.evals ?? population.length;
      return {
        genomes: inheritance === 'lamarckian' ? a.genomes : population,
        scores: a.scores,
      };
    }
    trials += population.length;
    const scores = objective ? objective(RAPIER, population) : scorePopulation(RAPIER, population, world, seconds);
    return { genomes: population, scores };
  };

  // ── EXPAND FIRST, AND IT HAS TO BE DONE HERE ─────────────────────────────
  //
  // `breed()` takes its population from `genomes.length` — it FOLLOWS the size
  // it is handed and cannot grow one. B2 §8 reads it as "already generalised
  // (POPULATION is a default, strangerCount is a rate)", which is true of
  // everything except the one thing this needed: passing `population: 24` to
  // breed is silently ignored, and the first version of this function ran three
  // generations at population 6 while reporting that it had run them at 24.
  // Caught by the trial count, which came out at 24 where 3 generations at
  // population 24 must cost 78.
  //
  // Expansion is by fresh strangers rather than by cloning the player's six.
  // Clones give three generations of mutation on one lineage, which is a much
  // narrower search than the population number implies, and §0 already measured
  // that more strangers makes the PLAYER's loop worse — that finding is about
  // the six-slot tank, where a stranger costs a visible slot. Here it costs
  // nothing visible and buys the only diversity the burst has.
  if (pop.length < population) {
    const extra = seedPopulation({
      RAPIER, rng: rng.fork('burst:expand'), world, limits,
      population: population - pop.length,
      authoredSlots: 0,
    });
    pop = pop.concat(extra.genomes);
  }

  for (let gen = 0; gen < generations; gen++) {
    const stepped = evaluate(pop, `${gen}`);
    // Under 'weismann' this is the birth population unchanged; under 'lamarckian'
    // the adapted controllers survive into selection and breed. See `inheritance`.
    pop = stepped.genomes;
    const scores = stepped.scores;

    const order = scores
      .map((s, i) => ({ s, i }))
      .sort((a, b) => b.s - a.s);

    // HALF THE POPULATION SURVIVES, which keeps the pressure mild on purpose.
    // §0's finding is that this loop is worth running BRIEFLY; a harsh truncation
    // over three generations converges on one lineage and hands the player back
    // six copies of the same animal, which is the failure the variety work in
    // chantier 1 exists to prevent.
    const nSurvive = Math.max(2, Math.floor(pop.length / 2));
    let survivors;
    if (selection === 'random') {
      const shuffled = pop.map((_, i) => i);
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      survivors = shuffled.slice(0, nSurvive);
    } else {
      survivors = order.slice(0, nSurvive).map(x => x.i);
    }

    history.push({
      gen,
      best: order.length ? order[0].s : 0,
      median: median(scores),
      mean: scores.reduce((a, b) => a + b, 0) / (scores.length || 1),
    });

    // CROSSOVER IS OFF IN THE BURST, DELIBERATELY, and this is a scheduling
    // decision rather than a judgement that it would hurt. `survivors` is half
    // the population, so the moment SLICE_LIMITS.crossoverRate went to 1 every
    // burst would have gone sexual for free — and every figure this loop has
    // ever produced (tools/_zauto.mjs, _zburst.mjs, _zoutcome.mjs, and the
    // §6 numbers quoted in the session log) would silently stop being comparable
    // to the runs that produced them. The auto-burst is a MEASUREMENT instrument
    // before it is a feature, and an instrument that changes under you without
    // saying so is worse than a slow one.
    //
    // It should be turned on, and probably wins: HYDRODYNAMICS.md:1130 recommends
    // grafting for exactly this kind of locomotion search. That is its own
    // session, with a null arm, not a side effect of a UI change.
    const r = breed({
      RAPIER,
      genomes: pop,
      selected: survivors,
      rng: rng.fork(`burst:${gen}`),
      world,
      limits: { ...limits, crossoverRate: 0 },
      population,
    });
    pop = r.genomes;
  }

  // FINAL SCORING IS A REAL GENERATION, not bookkeeping: without it the returned
  // population is the offspring of the last selection and has never been
  // measured, so `keep` would be picking on the parents' merits.
  const finalStep = evaluate(pop, 'final');
  pop = finalStep.genomes;
  const finalScores = finalStep.scores;
  const ranked = finalScores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
  history.push({
    gen: generations, best: ranked.length ? ranked[0].s : 0,
    median: median(finalScores),
    mean: finalScores.reduce((a, b) => a + b, 0) / (finalScores.length || 1),
  });

  const chosen = (selection === 'random'
    ? finalScores.map((_, i) => i).slice(0, keep)
    : ranked.slice(0, keep).map(x => x.i));

  return {
    genomes: chosen.map(i => pop[i]),
    scores: chosen.map(i => finalScores[i]),
    history,
    trials,
  };
}

function median(xs) {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}
