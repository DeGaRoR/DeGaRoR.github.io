// tools/_zbreed.mjs — THE BREEDING PROGRAMME.  ⚠ WRITES TWO FILES (see below)
//
//     node tools/_zbreed.mjs [gens] [pop] [lines] [seconds] [arm] [seed]
//
//     arm: score | null | both        default `score`
//
// This is `design/15-BREEDING.md` executed. Read that document for why; this
// header records only what the code does and the numbers it is built on.
//
// ── WHAT IS DIFFERENT FROM EVERY EARLIER SELECTION TOOL HERE ─────────────────
//
// 1. THE OBJECTIVE IS IN CENTIMETRES AND IT IS TASK-INVARIANT.
//
//        closedCm  =  mean over directions of  (d_blind - d_live)
//
//    "how much closer to the mark the creature got than its own blind body
//    would have". `_zgoalevo` selected on `closure`, a FRACTION of the task
//    distance, which is why moving the task moved the objective and why round 1
//    bred animals that aim beautifully and cannot travel. Multiply that fraction
//    by the distance and the distance cancels: `closedCm` is the same physical
//    quantity whatever the task is set to. It cannot be won by being slow (a
//    slow animal cannot close many centimetres) and it cannot be won by
//    wandering (the same body's unsteered run is subtracted). Speed and
//    orientation are both in it, with no weights to argue about.
//
// 2. SELECTION IS TWO INDEPENDENT CULLING LEVELS, NOT AN INDEX.
//
//    Cull half the population on how far it travels, THEN rank what is left on
//    `closedCm`. That is Denis's own protocol — "I dismiss creatures barely
//    moving", then "I look at the ones that bend their trajectories near the
//    beacon" — and it is also the textbook method when one trait has a threshold
//    character rather than a value that trades off (Hazel & Lush 1942; Young
//    1964). It needs no weights, no calibration constant, and no re-tuning when
//    a genome bump changes what the numbers mean. It also self-stages: while
//    nothing can travel the reach cull binds and reach is what is being bred
//    for; once everything travels the cull stops binding by itself.
//
// 3. LINES, NOT A POPULATION, AND THEY DO NOT EXCHANGE GENES UNTIL ONE STALLS.
//
//    Parent-offspring regression in this system is ~1.0 (`tools/_zherit.mjs`):
//    a child is its parent plus a small perturbation. So the classic breeder's
//    equation stops being the model after generation 1 — the founding variance
//    is spent immediately and everything after that is paid for by NEW mutation.
//    That is the mutation-limited regime, where the binding constraint is the
//    supply of beneficial mutations and the enemy is clonal interference: two
//    good mutations in one population compete and only one survives. Separate
//    lines convert that interference into parallel search, and the hybridisation
//    step at the end is what combines what they found.
//
// 4. A STALL IS DETECTED AND ANSWERED, RATHER THAN WAITED OUT.
//
//    `tools/_zselect.mjs` ran sixty generations and gained 5%, converged to one
//    species. That is what a mutation-limited line does once it is on a local
//    peak. Here a line whose best has not moved for `STALL_GENS` generations is
//    OUTCROSSED: the ark's most COMPLEMENTARY animal — best at whatever the
//    stalled champion is worst at — is injected into the stranger slot and
//    forced to breed next generation. Corrective mating, and it is Denis's
//    "hybridise with creatures having traits I miss" verbatim.
//
// 5. NO AUTHORED STOCK. Founders are random draws, screened. An `eel`-descended
//    result describes the eel's neighbourhood, which is the one region of genome
//    space this project already knows works.
//
// ── THE SHIPPED PATH, NOT A REIMPLEMENTATION ────────────────────────────────
//
// Reproduction goes through `engine/l1/breed.js` — N17's stranger slot, N18's
// untouched elites, crossover at `SLICE_LIMITS.crossoverRate`, the graft ladder.
// `_evobreed.mjs`'s rule: a conclusion drawn through a private harness is a
// statement about the harness. The one deviation is `viabilityAttempts: 1`,
// which `breed()` documents as the setting for "wherever selection is being
// measured" — twelve re-rolls per zygote erase developmental load uniformly.
//
// ── WRITES ───────────────────────────────────────────────────────────────────
//
//   tools/_zbreed_state_<seed>.json    resumable checkpoint, written per generation
//   tools/_zbreed_ark_<seed>.json      the ark: every champion, serialised
import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync, writeFileSync } from 'node:fs';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { mutate } from '../engine/l1/mutate.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { signature } from '../engine/l1/naming.js';
import { assessViability } from '../engine/l1/viability.js';
import { serialise, deserialise, genomeHash, RANGE } from '../engine/l1/genome.js';
import { breed } from '../engine/l1/breed.js';
import { binomial } from '../engine/l1/naming.js';
import W1_SLICE from '../worlds/w1_slice.js';
import { goalScore, prepare, DIRECTIONS_FAST, DIRECTIONS, GOAL_MIN_DIST, GOAL_CAPTURE } from './_zgoal.mjs';

await RAPIER.init();

// ── ZB_ANGLE_MIN / ZB_ANGLE_MAX — THE JOINT-LIMIT A/B ───────────────────────
//
// `RANGE.angleLimit` is the band a REVOLUTE joint's limit is drawn from, jittered
// within by `mutate`, and clamped to at expression by `morphogen.js`. All three
// read the same object, so setting it here sets it for the whole programme and
// the treatment cannot leak between the draw and the physics.
//
// TWIST JOINTS ARE UNTOUCHED: `limitRangeFor('twist')` returns `RANGE.twistLimit`,
// a separate band narrowed to 0.35 for an anatomical reason (a hinge about a
// limb's own long axis). Half of `SLICE_LIMITS.jointTypes` is twist, which is
// most of why the measured stroke mean is half what the revolute band alone
// would predict — and it is not what this experiment is about.
//
// ⚠ THIS IS AN INSTRUMENT SETTING A VARIABLE THE GAME LEAVES ALONE, declared the
// way `_zgoalch2.mjs` declares its `preyGain2` seeding. A genome drawn with
// `ZB_ANGLE_MAX` above PI/2 is INVALID on a shipped build — `validateGenome`
// checks against the unmutated range — so an ark from such a run must NOT be
// promoted into the library by `_zpromote.mjs` without the schema moving first.
// THE TWO HALVES GO TO DIFFERENT PLACES, and that asymmetry is the finding.
//
//   ZB_ANGLE_MIN — a FLOOR under what a bending joint is drawn with. It goes to
//   `SLICE_LIMITS.revoluteLimitBand`, a config band, because the schema range is
//   shared with twist joints whose own band is [0, 0.35]: raising
//   `RANGE.angleLimit[0]` invalidates every twist joint in the corpus. That is
//   not a hypothetical — it is how the first run of this A/B died.
//
//   ZB_ANGLE_MAX — a CEILING above PI/2 is a genuine schema change, because
//   `validateGenome` has to accept the wider value. It moves `RANGE.angleLimit`
//   and the draw band together.
const A_MIN = process.env.ZB_ANGLE_MIN;
const A_MAX = process.env.ZB_ANGLE_MAX;
if (A_MIN !== undefined || A_MAX !== undefined) {
  if (A_MAX !== undefined) RANGE.angleLimit[1] = Number(A_MAX);
  const lo = A_MIN !== undefined ? Number(A_MIN) : RANGE.angleLimit[0];
  const hi = RANGE.angleLimit[1];
  SLICE_LIMITS.revoluteLimitBand = [lo, hi];
  console.log(`\n  ⚠ TREATMENT: bending joints drawn from [${lo}, ${hi}]`
    + `   (shipped [0, ${(Math.PI / 2).toFixed(4)}])   twist joints untouched`);
  if (hi > Math.PI / 2) {
    console.log('    the SCHEMA range moved too — genomes from this run are INVALID on a');
    console.log('    shipped build, so do not promote this ark without moving RANGE first.');
  }
}

const GENS = Number(process.argv[2] ?? 20);
const POP = Number(process.argv[3] ?? 12);
const LINES = Number(process.argv[4] ?? 3);
const SECONDS = Number(process.argv[5] ?? 40);
const ARM_ARG = (process.argv[6] ?? 'score').toLowerCase();
const SEED = Number(process.argv[7] ?? 0);
if (!['score', 'null', 'both'].includes(ARM_ARG)) throw new Error(`unknown arm ${ARM_ARG}`);

// ── the constants, each with the measurement or the argument behind it ───────

/**
 * How many candidates the prospecting phase draws before the lines are founded.
 *
 * WHY THE BUDGET GOES HERE RATHER THAN INTO GENERATIONS. With a parent-offspring
 * regression near 1, the response in generation 1 is the whole founding
 * selection differential — the population simply becomes its best founder. The
 * founding draw is therefore the single largest step the programme will ever
 * take, and 36 samples of a morphospace (the original `_zwild` plan) is a thin
 * look at it. `_zwild` reached the same conclusion from the other direction and
 * widened its own draw for the same reason.
 */
const PROSPECT_DRAWS = Number(process.env.ZB_PROSPECT ?? 240);

/**
 * HOW MANY OF THE SCREENED CANDIDATES GET A FULL TRIAL.
 *
 * Measured on this machine: the cheap screen (morphogenesis + viability +
 * `netSpeed` over a 6 s window, all of it inside `prepare`) costs ~0.48 s; the
 * full trial costs ~2.4 s on top. So a draw that is screened and discarded is
 * ~6x cheaper than one that is trialled.
 *
 * ⚠ THE SCREEN IS NOT A CHEAP PROXY FOR THE OBJECTIVE, AND IT MUST NOT BE
 * DESCRIBED AS ONE. `tools/_zherit.mjs` at n = 40 measures cruise speed against
 * control-subtracted closure at r = 0.17 — speed tells you almost nothing about
 * aim. (An n = 8 pilot of the same tool read 0.96; that was the founding draw's
 * one fast animal, and quoting it would have been this project's own
 * "turnCapability is a proxy for arriving" mistake in a new place.)
 *
 * The screen is justified DIFFERENTLY, and the difference matters. It is stage
 * one of the same two-level cull the run itself uses, applied to the founding
 * draw: a creature has to be going somewhere before its aim is worth reading.
 * Speed against `arrived` is r = 0.73 and against raw closure r = 0.46, so the
 * trait it screens on is the trait it is meant to screen on.
 */
const PROSPECT_TRIAL = Number(process.env.ZB_TRIAL ?? 24);

/**
 * STAGE 1 OF SELECTION — the "barely moving" cull, as a proportion kept.
 *
 * Half, which with the stage-2 keep below gives an overall selected proportion
 * of about a third. Robertson (1960) puts the proportion that maximises LONG-run
 * response near a half; a third is the compromise this project's other tools
 * already use (`_zgoalevo`'s `ELITE = 0.3 * POP`) and keeping both stages near
 * equal intensity is the standard advice for independent culling levels when the
 * traits are positively correlated, which here they strongly are.
 */
const REACH_KEEP = 0.5;

/** Stage 2: how many survivors become parents. `breed()` treats them as elites. */
const keepOf = (n) => Math.max(2, Math.round(n / 3));

/**
 * ── WITHIN-FAMILY SELECTION: AT MOST THIS MANY PARENTS FROM ONE FAMILY ───────
 *
 * ADDED AFTER RUN 1, WHICH FAILED ITS OWN GATE BECAUSE OF ITS ABSENCE. Plain
 * truncation converged each line onto one animal's descendants inside a handful
 * of generations — and `SLICE_LIMITS.crossoverRate` is 1, so every offspring in
 * a converged line is a cross between two near-identical parents, which produces
 * nothing. The line silently falls back to mutation alone: 57% neutral, half the
 * step size (§1.2(d) of design/15-BREEDING.md).
 *
 * Run 1's null arm, which keeps parents AT RANDOM and therefore stays diverse,
 * beat the score arm on best-ever by 1.19x while losing on population median by
 * 23x. That is not selection failing; it is selection destroying the raw
 * material the shipped reproduction operator runs on.
 *
 * Capping parents per family is the standard livestock answer — within-family
 * selection roughly halves the rate of convergence for the same response — and
 * it is one line here. A "family" is descent from a distinct generation-0 slot,
 * carried through `breed()`'s provenance.
 */
const FAMILY_CAP = 2;

/**
 * THE RATCHET. The task distance is raised — never lowered — so that the
 * objective's own ceiling stays clear of the population.
 *
 * `closedCm` cannot exceed the task distance: close the whole gap and the score
 * saturates. A saturated objective has no variance and therefore no selection
 * differential, so the task has to move as the animals improve. It moves
 * MONOTONICALLY UPWARD so that a number from generation 20 is not measuring an
 * easier exam than a number from generation 5.
 *
 * `2 x p90(closedCm)` keeps the ceiling at twice the best of the population.
 * Bounded below by `GOAL_MIN_DIST` (three capture radii — below that, drifting a
 * body thickness would count as arriving) and above by 8 cm, which is the
 * distance `ui/screens/vivarium.js` actually places the beacon at. Reaching 8 is
 * the programme's terminal condition: from there the numbers are the tank's.
 */
const TASK_MAX = 8;
const RATCHET_HEADROOM = 2;

/**
 * STALL, AND WHY BOTH NUMBERS MOVED AFTER RUN 1.
 *
 * At 3 generations and 5% the detector fired 13 times in the score arm and 14 in
 * the null arm over 20 generations — every line was "stalled" essentially always,
 * so what was designed as an occasional rescue became permanent gene flow and
 * **all three lines returned the same animal**. Line independence, which is the
 * only reason to have lines at all, was destroyed by the mechanism meant to
 * protect them.
 *
 * The cause is `b ≈ 1` plus N18's untouched elites: the best animal in a line
 * rarely moves, because it is literally the same object from one generation to
 * the next. "Best has not improved" is the NORMAL state, not a stall. So the
 * detector reads the MEDIAN — which does move, as the population fills in behind
 * the champion — and the window is longer, and an outcross starts a cooldown.
 */
const STALL_GENS = 5;
const STALL_EPS = 0.02;
const OUTCROSS_COOLDOWN = 5;

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const quant = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const fmt = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : '—');

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The cheap screen. Everything `prepare` does — build, viability, a 6 s cruise,
 * and the S3 steering plane — and nothing that costs a full trial.
 */
function screen(genome) {
  let plan;
  try { plan = morphogenesis(genome); } catch { return null; }
  if (plan.jointCount < 1) return null;
  if (!assessViability(RAPIER, genome, W1_SLICE).ok) return null;
  const prep = prepare(RAPIER, genome, W1_SLICE);
  if (!prep || !(prep.speed > 1e-6)) return null;
  return prep;
}

/**
 * The full trial. `dist` is the CURRENT task distance and it is passed in rather
 * than derived per creature — one exam for the whole generation, which is the
 * property `goalScore`'s scaled default gives up and the reason round 1 failed.
 *
 * Returns null for a non-subject. A non-subject is not a score of zero: "cannot
 * be simulated" and "can be simulated and does not steer" are different facts.
 */
function trial(genome, prep, dist) {
  const r = goalScore(RAPIER, {
    plan: prep.plan, genome, world: W1_SLICE, plane: prep.plane,
    speed: prep.speed, seconds: SECONDS, dirs: DIRECTIONS_FAST, distance: dist,
    forage: FORAGE,
  });
  if (!r.valid) return null;
  return {
    // THE OBJECTIVE, in centimetres, invariant to `dist`. See the header.
    closedCm: r.closure * dist,
    outCm: r.bands.out.closure * dist,
    speed: prep.speed,
    excursion: r.shape.excursion,
    straightness: r.shape.straightness,
    loopClosure: r.shape.loopClosure,
    planarity: r.shape.planarity,
    arrived: r.arrived,
    dwell: r.dwell,
    eaten: r.eaten ?? 0,
    gain: Math.abs((genome.controller.preyGain ?? 0) + (genome.controller.threatGain ?? 0)),
    // THE CHAIN AND ITS WAVENUMBER, carried on every row so a run can be read
    // for whether selection KEEPS a spine, not only for whether it goes faster.
    // `_zspine` measures a half-life of 8 generations against the mutation
    // operator; whether selection outruns that is the open question.
    ...chainOf(genome),
    mass: totalMass(prep.plan),
    bodies: prep.plan.bodyCount,
    dist,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROSPECTING — the founding draw, screened cheap and trialled on the survivors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ── ZB_FOUNDERS=spine — FOUND THE LINES ON DRAWN CHAINS ─────────────────────
 *
 * Not authored stock: still random draws, filtered to the ones that happen to
 * carry a run of `SPINE_RUN` identical segments on the axial face. `_zspine.mjs`
 * and `_zeel.mjs` put that at 10-12% of draws and about 4% viable, so it is a
 * filter on the same population rather than an injection from outside it — the
 * no-authored-stock rule is untouched.
 *
 * It exists because the chain and the gait fail for different reasons and the
 * default prospect (fastest first) selects the chain out before the run starts:
 * a drawn chain is nearly in unison (`_zeel`: total phase 0.54 rad against the
 * eel's 7.85) and unison is slow, so ranking founders on speed discards exactly
 * the body this experiment is about.
 */
/**
 * ── ZB_METHOD — WHAT THE SECOND AND THIRD CULLING LEVELS RANK ON ────────────
 *
 * The priority order asked for is SEEK, then viability, then speed, then food.
 * Viability is not a level — a creature that will not build is never scored —
 * so what is left is three levels, and independent culling levels apply them in
 * order rather than weighting them against each other.
 *
 *   seek       reach cull to 50%, then rank `closedCm`. The validated protocol,
 *              kept as the control.
 *   seekfirst  rank `closedCm` FIRST to 2x the keep, then drop the slowest.
 *              Literally the stated priority: perception decides, speed breaks
 *              ties. Riskier — section 2.4 says a weak population has no seek
 *              gradient until it can travel — which is why `seek` still runs.
 *   forage     seekfirst, then rank the survivors by grams eaten on the way.
 *   dwell      seekfirst, then rank by station-keeping. "Arrived AND stayed" is
 *              the closest thing here to intent carried through to an outcome.
 */
const METHOD = (process.env.ZB_METHOD ?? 'seek').toLowerCase();
if (!['seek', 'seekfirst', 'forage', 'dwell'].includes(METHOD)) throw new Error(`unknown method ${METHOD}`);
/** Only `forage` pays for the food field; the others must stay comparable. */
const FORAGE = METHOD === 'forage';

const FOUNDER_MODE = (process.env.ZB_FOUNDERS ?? 'any').toLowerCase();
const SPINE_RUN = Number(process.env.ZB_SPINE_RUN ?? 4);

/** Longest run of identical repeated segments, and its wavenumber. */
function chainOf(genome) {
  try {
    const plan = morphogenesis(genome);
    const run = signature(plan, genome).longestRun;
    const edge = genome.connections.find((c) => c.parentNodeId === c.childNodeId && c.parentFace === 5);
    const node = edge ? genome.nodes.find((n) => n.id === edge.parentNodeId) : null;
    return { run, lag: node ? Math.abs(node.joint.phaseLag) : 0 };
  } catch { return { run: 0, lag: 0 }; }
}

function prospect() {
  const screened = [];
  let drawn = 0, rejected = 0, offPlan = 0;
  process.stdout.write('  prospecting ');
  for (let i = 0; drawn < PROSPECT_DRAWS; i++) {
    const g = createRandomGenome(rngFrom('zbreed', 'prospect', SEED, i));
    drawn++;
    if (FOUNDER_MODE === 'spine' && chainOf(g).run < SPINE_RUN) { offPlan++; continue; }
    const prep = screen(g);
    if (!prep) { rejected++; continue; }
    screened.push({ genome: g, prep });
    if (screened.length % 10 === 0) process.stdout.write('.');
  }
  console.log('');
  if (FOUNDER_MODE === 'spine') {
    console.log(`  founder mode SPINE: ${offPlan}/${drawn} draws had no run >= ${SPINE_RUN}`
      + ` on the axial face; ${screened.length} chains passed the cheap screen`);
  }
  screened.sort((a, b) => b.prep.speed - a.prep.speed);
  const short = screened.slice(0, PROSPECT_TRIAL);

  // The opening task distance comes from the shortlist's own cruise, through the
  // same ratchet rule the run will use from here on. Floored at GOAL_MIN_DIST.
  const reach0 = short.map((s) => s.prep.speed * SECONDS);
  const dist0 = Math.max(GOAL_MIN_DIST, Math.min(TASK_MAX, quant(reach0, 0.5)));

  const trialled = [];
  process.stdout.write('  trialling  ');
  for (const s of short) {
    const t = trial(s.genome, s.prep, dist0);
    process.stdout.write(t ? '.' : 'x');
    if (t) trialled.push({ genome: s.genome, ...t });
  }
  console.log('');
  trialled.sort((a, b) => b.closedCm - a.closedCm);
  return { trialled, drawn, rejected, screened: screened.length, dist0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECTION — two independent culling levels, in Denis's order
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param scored rows of {i, ...traits} for the SUBJECTS of one line
 * @param rng    used only by the null arm
 * @returns indices into the line's genome array, best first
 */
function select(scored, arm, rng, family) {
  if (scored.length < 2) return scored.map((s) => s.i);
  const keep = keepOf(scored.length);
  /** At most `FAMILY_CAP` parents descended from any one generation-0 slot. */
  const capped = (ranked) => {
    const seen = new Map(), out = [];
    for (const s of ranked) {
      const f = family[s.i];
      const n = seen.get(f) ?? 0;
      if (n >= FAMILY_CAP) continue;
      seen.set(f, n + 1);
      out.push(s.i);
      if (out.length >= keep) break;
    }
    // A line that has genuinely collapsed to one family still has to breed;
    // the cap is a preference, not a way to return an empty parent set.
    for (const s of ranked) { if (out.length >= keep) break; if (!out.includes(s.i)) out.push(s.i); }
    return out;
  };
  if (arm === 'null') {
    // THE PAIRED NULL: the same number of parents, chosen at random from the
    // same subject set, breeding through the same code. Any difference between
    // the arms is selection and nothing else — not a luckier founding draw,
    // which is the failure mode an unpaired control cannot exclude.
    const pool = scored.slice();
    const out = [];
    while (out.length < keep && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0].i);
    return out;
  }
  // STAGE 1 — reach. The creature has to be going somewhere before its aim is
  // worth reading. Measured on the BLIND traverse, so it is a property of the
  // body rather than of the sensor.
  if (METHOD === 'seek') {
    const byReach = [...scored].sort((a, b) => b.excursion - a.excursion);
    const survivors = byReach.slice(0, Math.max(keep, Math.round(scored.length * REACH_KEEP)));
    // STAGE 2 — aim, in centimetres, subject to the family cap.
    survivors.sort((a, b) => b.closedCm - a.closedCm);
    return capped(survivors);
  }
  // ── SEEK FIRST ──────────────────────────────────────────────────────────────
  // Perception decides who is in the running; the third trait only ORDERS those
  // already through. The shortlist is 2x the keep so the third level has room to
  // matter without being able to promote an animal that cannot aim at all.
  const shortlist = [...scored].sort((a, b) => b.closedCm - a.closedCm)
    .slice(0, Math.max(keep, Math.min(scored.length, keep * 2)));
  const third = METHOD === 'forage' ? (r) => r.eaten
    : METHOD === 'dwell' ? (r) => r.dwell
    : (r) => r.excursion;
  shortlist.sort((a, b) => third(b) - third(a));
  return capped(shortlist);
}

/**
 * THE OUTCROSS PARTNER — corrective mating, not "breed it to the best one".
 *
 * The stalled champion is z-scored on the two axes the programme selects on,
 * across the whole ark so the comparison does not depend on either trait's
 * units. Its WEAKER axis picks the direction, and the donor is the leader on
 * that axis.
 *
 * ── TWO RULES THAT ARE NOT DECORATION, AND RUN 1 WAS EXECUTED WITHOUT THEM ───
 *
 * 1. THE DONOR MUST BE ACCEPTABLE ON THE OBJECTIVE, NOT MERELY EXTREME ON THE
 *    DEFICIENT AXIS. Without this the rule picks the ark's fastest wanderer —
 *    seed 1 chose the same `closedCm = -0.111` animal for three different lines
 *    on three different stalls, and every one of its children was culled in the
 *    generation it arrived. That is not corrective mating, it is importing a bad
 *    animal because it is tall. Breeders choose the corrective sire from among
 *    the ones they would have used anyway; the pool is restricted to the ark's
 *    upper half on `closedCm` first, and the weak axis chooses within it.
 *
 * 2. A DONOR IS USED ONCE PER LINE. The stall detector fires again three
 *    generations later, and without a memory it re-imports the animal that has
 *    already failed to help — which is what run 1 did. `used` carries the hashes
 *    this line has already taken.
 */
function outcrossPartner(champ, ark, used, ownLine) {
  // NEVER FROM THIS LINE'S OWN ARK ENTRIES. Re-importing a line's own former
  // champion is not an outcross, it is a backcross to itself, and it was one of
  // the three ways run 1's lines collapsed onto a single animal. Falls back to
  // the whole eligible set only if the line's own entries are all that exist.
  const all = ark.filter((a) => a.hash !== champ.hash && !used.has(a.hash));
  const foreign = all.filter((a) => a.line !== ownLine);
  const eligible = foreign.length ? foreign : all;
  if (!eligible.length) return null;
  const z = (key) => {
    const xs = ark.map((a) => a[key]);
    const m = mean(xs), s = Math.sqrt(mean(xs.map((v) => (v - m) ** 2))) || 1;
    return (v) => (v - m) / s;
  };
  const zr = z('excursion'), za = z('closedCm');
  const weakest = zr(champ.excursion) <= za(champ.closedCm) ? 'excursion' : 'closedCm';
  // Rule 1: acceptable on the objective first. Falls back to the whole eligible
  // set if the upper half is empty, so a young ark still produces a donor.
  const cut = quant(eligible.map((a) => a.closedCm), 0.5);
  const pool = eligible.filter((a) => a.closedCm >= cut);
  const from = pool.length ? pool : eligible;
  const best = from.reduce((a, b) => (b[weakest] > a[weakest] ? b : a));
  return { donor: best, on: weakest };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE RUN
// ─────────────────────────────────────────────────────────────────────────────

const STATE = new URL(`./_zbreed_state_${SEED}.json`, import.meta.url);
const ARKFILE = new URL(`./_zbreed_ark_${SEED}.json`, import.meta.url);

let boot = null;
try {
  const st = JSON.parse(readFileSync(STATE, 'utf8'));
  // A checkpoint from a different EXPERIMENT is not a checkpoint: every one of
  // these changes what the numbers mean, so any mismatch starts fresh and says so.
  if (st.pop !== POP || st.lines !== LINES || st.seconds !== SECONDS || st.armArg !== ARM_ARG) {
    console.log(`  (checkpoint is ${st.pop}/${st.lines}/${st.seconds}s/${st.armArg} — this run is`
      + ` ${POP}/${LINES}/${SECONDS}s/${ARM_ARG}. Starting fresh.)\n`);
  } else boot = st;
} catch { /* fresh run */ }

console.log(`\n  THE BREEDING PROGRAMME · seed ${SEED}`);
console.log(`  ${LINES} lines x ${POP} x ${GENS} generations   ${SECONDS} s trials   arm(s): ${ARM_ARG}`);
console.log(`  method ${METHOD}${FORAGE ? ' (food field in the trial)' : ''}   founders ${FOUNDER_MODE}`);
console.log(`  objective: closedCm = mean(d_blind - d_live) over ${DIRECTIONS_FAST.length} directions, in cm`);
console.log(`  selection: cull to ${(100 * REACH_KEEP).toFixed(0)}% on blind reach, then top third on closedCm`);
console.log(`  founders:  random draws only — NO AUTHORED STOCK\n`);

let founding = boot?.founding;
if (!founding) {
  const p = prospect();
  if (p.trialled.length < LINES + 2) {
    console.log(`  only ${p.trialled.length} founding subjects — widen ZB_PROSPECT.`);
    process.exit(1);
  }
  console.log(`\n  drew ${p.drawn}, ${p.screened} passed the cheap screen (${(100 * p.screened / p.drawn).toFixed(0)}%),`
    + ` ${p.trialled.length}/${PROSPECT_TRIAL} trialled as subjects`);
  console.log(`  opening task ${p.dist0.toFixed(2)} cm; shortlist cruise`
    + ` p50 ${fmt(quant(p.trialled.map((t) => t.speed), 0.5), 4)} cm/s`
    + `, blind reach p50 ${fmt(quant(p.trialled.map((t) => t.excursion), 0.5), 2)} cm\n`);
  console.log('  the founding shortlist, best first:');
  for (const t of p.trialled.slice(0, LINES + 6)) {
    console.log(`    closedCm ${fmt(t.closedCm).padStart(7)}  reach ${fmt(t.excursion, 2).padStart(6)} cm`
      + `  v ${fmt(t.speed, 4).padStart(7)}  straight ${fmt(t.straightness, 2)}  planar ${fmt(t.planarity, 2)}`
      + `  ${binomial(morphogenesis(t.genome), t.genome).binomial}`);
  }
  founding = {
    dist0: p.dist0,
    stock: p.trialled.map((t) => ({ ...t, genome: undefined, serialised: serialise(t.genome) })),
  };
}
const stock = founding.stock.map((s) => ({ ...s, genome: deserialise(s.serialised) }));

/** One arm of the experiment: `LINES` lines, an ark, and a task distance. */
function newArm(arm) {
  const lines = [];
  for (let L = 0; L < LINES; L++) {
    const founder = stock[L % stock.length];
    // LINE BREEDING FROM ONE PROGENITOR — the line IS the founder plus its
    // descendants, which is what makes two lines independent searches rather
    // than two samples of one population.
    const genomes = [founder.genome];
    for (let k = 1; k < POP; k++) {
      let g = founder.genome;
      // ⚠ THE ARM IS DELIBERATELY NOT IN THIS KEY. `_zgoalch2` shipped with it
      // in, and the two arms then drew different mutations from generation 0 —
      // two independent runs wearing the name of a controlled comparison. Both
      // arms must start from a byte-identical generation 0 or the null arm
      // cannot exclude a luckier founding draw, which is its entire job.
      try { g = mutate(founder.genome, rngFrom('zbreed', 'found', SEED, L, k)).genome; } catch { /* keep parent */ }
      genomes.push(g);
    }
    lines.push({
      L, genomes, rows: new Array(POP).fill(null),
      // FAMILY = descent from a distinct generation-0 slot. Every founding slot
      // starts its own family; offspring inherit the primary parent's, and an
      // immigrant or an injected outcross starts a fresh one. This is what the
      // `FAMILY_CAP` in `select()` counts.
      family: Array.from({ length: POP }, (_, k) => k),
      nextFamily: POP,
      best: null, bestGen: 0, stallSince: 0, lastOutcross: -99, medBest: -Infinity,
      forced: [], events: [],
      // Hashes this line has already taken from the ark. A Set, so it has to be
      // converted on the way to and from the checkpoint — see `freezeArm`.
      used: new Set(),
    });
  }
  // The ark opens holding every founding candidate that was trialled — the
  // runners-up are the outcross stock, and throwing them away is what makes a
  // stalled line unrescuable. This is the gene bank, and it is the same idea as
  // a breeder keeping straws from bulls the programme did not use.
  const ark = stock.map((s) => ({
    hash: genomeHash(s.genome), serialised: s.serialised, gen: -1, line: -1,
    closedCm: s.closedCm, excursion: s.excursion, speed: s.speed,
  }));
  return { arm, lines, ark, dist: founding.dist0, history: [] };
}

const arms = (ARM_ARG === 'both' ? ['score', 'null'] : [ARM_ARG])
  .map((a) => (boot?.armState?.[a] ? reviveArm(boot.armState[a]) : newArm(a)));

function reviveArm(s) {
  return {
    ...s,
    lines: s.lines.map((l) => ({
      ...l,
      genomes: l.genomes.map((g) => deserialise(g)),
      used: new Set(l.used ?? []),
    })),
  };
}
function freezeArm(a) {
  return {
    ...a,
    lines: a.lines.map((l) => ({
      ...l, genomes: l.genomes.map((g) => serialise(g)), used: [...l.used],
    })),
  };
}

const gen0 = boot?.gen != null ? boot.gen + 1 : 0;
if (gen0) console.log(`  resuming at generation ${gen0}\n`);
const wall0 = Date.now();

for (let gen = gen0; gen <= GENS; gen++) {
  for (const A of arms) {
    // ── evaluate every unmeasured individual, at the CURRENT task distance ──
    const measureAll = () => {
      for (const line of A.lines) {
        for (let i = 0; i < line.genomes.length; i++) {
          if (line.rows[i]) continue;
          const prep = screen(line.genomes[i]);
          const t = prep ? trial(line.genomes[i], prep, A.dist) : null;
          line.rows[i] = t ? { i, ...t } : { i, dead: true };
        }
      }
    };
    measureAll();

    // ── THE RATCHET, computed across the whole arm so every line sits one exam ──
    //
    // AND WHEN IT MOVES, EVERYTHING IS RE-MEASURED. `closedCm` carries no factor
    // of the task distance — that is the point of it — but it is not literally
    // invariant to one: a target eight centimetres out is a different bearing
    // history from one four centimetres out, so a row taken at the old distance
    // is a row from a different experiment. Re-scoring the whole arm on the rare
    // generation the ratchet fires is what keeps a generation-20 number and a
    // generation-5 number comparable, and it is the cheap half of the bargain:
    // the ratchet is monotone and fires only when the population has genuinely
    // outgrown the exam.
    const allRows = A.lines.flatMap((l) => l.rows.filter((r) => !r.dead));
    if (allRows.length) {
      const want = RATCHET_HEADROOM * quant(allRows.map((r) => r.closedCm), 0.9);
      const next = Math.max(A.dist, Math.min(TASK_MAX, Math.max(GOAL_MIN_DIST, want)));
      if (next > A.dist + 1e-9) {
        console.log(`      ${A.arm}: task ${fmt(A.dist, 2)} -> ${fmt(next, 2)} cm — re-scoring the arm`);
        A.dist = next;
        for (const line of A.lines) line.rows = new Array(POP).fill(null);
        measureAll();
      }
    }

    for (const line of A.lines) {
      const scored = line.rows.filter((r) => !r.dead);
      // A LINE THAT DIES IS RESTOCKED FROM THE ARK rather than abandoned. A
      // breeding programme does not delete a line because a generation failed.
      if (scored.length < 2) {
        const rescue = A.ark.slice().sort((a, b) => b.closedCm - a.closedCm).slice(0, 2);
        line.genomes = line.genomes.map((g, k) => (k < rescue.length ? deserialise(rescue[k].serialised) : g));
        line.rows = new Array(POP).fill(null);
        line.events.push({ gen, kind: 'restock' });
        continue;
      }

      const champ = scored.reduce((a, b) => (b.closedCm > a.closedCm ? b : a));
      const champHash = genomeHash(line.genomes[champ.i]);
      // ── THE STALL TEST READS THE MEDIAN, NOT THE BEST ─────────────────────
      //
      // And it is measured BEFORE the running maximum is updated, or it would
      // compare a number to itself. Run 1 tested the best and fired 13 times in
      // 20 generations: with `b ≈ 1` and N18's untouched elites, the champion is
      // literally the same object from one generation to the next, so "the best
      // has not improved" is the normal state of a healthy line rather than a
      // stall. The median moves as the population fills in behind the champion,
      // and it stops moving when the line has genuinely run out of road.
      const med = quant(scored.map((r) => r.closedCm), 0.5);
      const grew = med > line.medBest * (1 + STALL_EPS) || line.medBest === -Infinity;
      if (med > line.medBest) line.medBest = med;
      if (!line.best || champ.closedCm > line.best.closedCm) {
        line.best = { ...champ, hash: champHash, gen };
        line.bestGen = gen;
        A.ark.push({
          hash: champHash, serialised: serialise(line.genomes[champ.i]), gen, line: line.L,
          closedCm: champ.closedCm, excursion: champ.excursion, speed: champ.speed,
        });
      }

      A.history.push({
        gen, arm: A.arm, line: line.L, dist: A.dist, subjects: scored.length,
        bestCm: champ.closedCm, medCm: med,
        // Distinct families among the subjects — the diversity the family cap
        // exists to hold on to, printed so a converging line is visible.
        families: new Set(scored.map((r) => line.family[r.i])).size,
        bestReach: champ.excursion, medReach: quant(scored.map((r) => r.excursion), 0.5),
        medRun: quant(scored.map((r) => r.run), 0.5),
        maxRun: Math.max(0, ...scored.map((r) => r.run)),
        medLag: quant(scored.map((r) => r.lag), 0.5),
        maxLag: Math.max(0, ...scored.map((r) => r.lag)),
        spines: scored.filter((r) => r.run >= SPINE_RUN).length,
        medPlanar: quant(scored.map((r) => r.planarity), 0.5),
        medStraight: quant(scored.map((r) => r.straightness), 0.5),
        arrived: champ.arrived, dwell: champ.dwell, gain: champ.gain,
      });

      if (gen === GENS) continue;

      // ── STALL AND OUTCROSS ────────────────────────────────────────────────
      if (grew) line.stallSince = gen;
      const inject = [];
      // THE COOLDOWN. An outcross takes a few generations to show whether it
      // helped; firing again inside that window turns a rescue into a permanent
      // migration channel, which is what merged run 1's three lines into one.
      if (gen - line.stallSince >= STALL_GENS && gen - line.lastOutcross >= OUTCROSS_COOLDOWN) {
        const pick = outcrossPartner(line.best, A.ark, line.used, line.L);
        if (pick) {
          inject.push(deserialise(pick.donor.serialised));
          line.used.add(pick.donor.hash);
          line.lastOutcross = gen;
          line.events.push({ gen, kind: 'outcross', on: pick.on, from: pick.donor.line, donorCm: pick.donor.closedCm });
          const src = pick.donor.line < 0 ? 'founding stock' : `line ${pick.donor.line} gen ${pick.donor.gen}`;
          console.log(`      ${A.arm} L${line.L}: STALLED — outcross on ${pick.on}`
            + ` to ${src} (${fmt(pick.donor.closedCm)} cm, reach ${fmt(pick.donor.excursion, 1)})`);
        } else {
          console.log(`      ${A.arm} L${line.L}: STALLED — ark exhausted, no unused donor`);
        }
        line.stallSince = gen;
      }

      // ── breed, through the shipped path ───────────────────────────────────
      // Common random numbers across the arms — the same stream, applied to
      // whatever each arm's selection handed it. The arms then differ by their
      // survivor sets and by nothing else. See the founding key above.
      const rng = rngFrom('zbreed', 'breed', SEED, line.L, gen);
      const selected = select(scored, A.arm, rngFrom('zbreed', 'nullpick', SEED, line.L, gen), line.family);
      // A FORCED PARENT: last generation's injected outcross breeds whether or
      // not it out-ranks the line's own animals, which is the whole point of
      // bringing it in. Appended last, so `breed()` drops it first if the elite
      // cap binds — it never displaces a selected animal.
      for (const fi of line.forced) if (!selected.includes(fi) && !line.rows[fi]?.dead) selected.push(fi);
      line.forced = [];

      const before = line.genomes;
      const out = breed({
        RAPIER, genomes: line.genomes, selected, rng, world: W1_SLICE,
        limits: SLICE_LIMITS, injectStrangers: inject,
        // See the header: one zygote per reproductive event wherever selection
        // is being measured. `breed()`'s own doc-comment says so.
        viabilityAttempts: 1,
      });
      line.genomes = out.genomes;
      line.rows = out.genomes.map((g, i) => (g === before[i] ? line.rows[i] : null));
      // FAMILY DESCENT. An elite keeps its own; an offspring takes its PRIMARY
      // parent's (`provenance.parent`, which `breed()` documents as keeping that
      // meaning even for a two-parent child); a stranger or an injected outcross
      // starts a new family, because that is exactly what it is.
      const prevFamily = line.family;
      line.family = out.provenance.map((p, i) => {
        if (out.genomes[i] === before[i]) return prevFamily[i];
        if (p && p.kind === 'offspring' && p.parent != null) return prevFamily[p.parent];
        return line.nextFamily++;
      });
      if (inject.length) {
        line.forced = out.provenance
          .map((p, i) => (p?.imported ? i : -1)).filter((i) => i >= 0);
      }
    }
  }

  // ── the generation line ─────────────────────────────────────────────────────
  for (const A of arms) {
    const rows = A.history.filter((h) => h.gen === gen);
    if (!rows.length) continue;
    const tag = arms.length > 1 ? `${A.arm.padEnd(5)} ` : '';
    console.log(`  gen ${String(gen).padStart(2)} ${tag}task ${fmt(A.dist, 2)} cm  `
      + rows.map((r) => `L${r.line}: ${fmt(r.bestCm).padStart(6)}/${fmt(r.medCm).padStart(6)} cm`
        + ` reach ${fmt(r.bestReach, 1).padStart(5)} fam ${String(r.families).padStart(2)}`
        + ` run ${String(r.maxRun).padStart(2)} spn ${String(r.spines).padStart(2)} lag ${fmt(r.maxLag, 2)}`).join('  ')
      + `  [${((Date.now() - wall0) / 1000).toFixed(0)}s]`);
  }

  writeFileSync(STATE, JSON.stringify({
    gen, pop: POP, lines: LINES, seconds: SECONDS, armArg: ARM_ARG, seed: SEED, founding,
    // `armState`, NOT `arms`. Both keys were `arms` at first — the string and the
    // object — so the object silently won and the identity check above compared
    // an object to a string, which is never equal: every resume started fresh
    // while reporting that it had found a checkpoint.
    armState: Object.fromEntries(arms.map((a) => [a.arm, freezeArm(a)])),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// THE VERDICT — winners re-scored on the canonical trial, never on the cheap one
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n  ── RE-SCORED ON THE CANONICAL TRIAL ──');
console.log(`  ${DIRECTIONS.length} directions x 90 s at the tank's own ${TASK_MAX} cm beacon.`);
console.log('  The cheap 3-direction trial RANKS; it does not report.\n');

const verdict = [];
for (const A of arms) {
  for (const line of A.lines) {
    if (!line.best) continue;
    const entry = A.ark.filter((a) => a.line === line.L).sort((a, b) => b.closedCm - a.closedCm)[0];
    if (!entry) continue;
    const g = deserialise(entry.serialised);
    const prep = screen(g);
    if (!prep) { console.log(`  ${A.arm} L${line.L}: champion no longer a subject`); continue; }
    const r = goalScore(RAPIER, {
      plan: prep.plan, genome: g, world: W1_SLICE, plane: prep.plane,
      speed: prep.speed, seconds: 90, dirs: DIRECTIONS, distance: TASK_MAX,
    });
    if (!r.valid) { console.log(`  ${A.arm} L${line.L}: ${r.reason}`); continue; }
    // ── WAS IT BRED? `origin.generations` is incremented by exactly one line in
    // the codebase — `breed()`'s live-birth counter — so 0 means this animal
    // never went through a reproductive event. At population 12, N17 puts TWO
    // fresh random genomes into every line every generation; over 20 generations
    // and 3 lines that is 120 random draws per arm, and one of them won run 3.
    // A champion that was never bred is a result about the DRAW, and the verdict
    // has to say so on the same line it reports the score. See standing rule R9b.
    const births = g.origin?.generations ?? 0;
    const row = {
      arm: A.arm, line: line.L, gen: entry.gen, hash: entry.hash, births,
      closedCm: r.closure * TASK_MAX, speed: prep.speed, arrived: r.arrived, dwell: r.dwell,
      inPlane: r.bands.inPlane.closure * TASK_MAX, out: r.bands.out.closure * TASK_MAX,
      binomial: binomial(prep.plan, g).binomial, serialised: entry.serialised,
    };
    verdict.push(row);
    console.log(`  ${A.arm.padEnd(5)} L${line.L}  closedCm ${fmt(row.closedCm).padStart(7)}`
      + `  v ${fmt(row.speed, 4)}  arrive ${fmt(row.arrived, 2)}  dwell ${fmt(row.dwell, 3)}`
      + `  inPlane ${fmt(row.inPlane, 2)} / out ${fmt(row.out, 2)}`
      + `  ${births ? `${births} births` : '⚠ NEVER BRED'}`
      + `  chain ${chainOf(g).run}/lag ${fmt(chainOf(g).lag, 2)}   ${row.binomial}`);
  }
}

// HOW MUCH OF THE ARK WAS BRED AT ALL. The counterpart to the per-champion flag
// above, over the whole run: a low number means the ark is largely a record of
// N17's random draws and the best-ever statistics are about the draw.
for (const A of arms) {
  const depths = A.ark.map((e) => { try { return deserialise(e.serialised).origin?.generations ?? 0; } catch { return 0; } });
  const bred = depths.filter((d) => d > 0).length;
  console.log(`\n  ${A.arm} ark: ${bred}/${depths.length} animals were bred`
    + ` (deepest ${Math.max(0, ...depths)} births). The rest are founding draws and N17 strangers.`);
}

if (ARM_ARG === 'both') {
  const s = verdict.filter((v) => v.arm === 'score').map((v) => v.closedCm);
  const z = verdict.filter((v) => v.arm === 'null').map((v) => v.closedCm);
  console.log(`\n  ── GATE 1 · best-ever ── mean closedCm  score ${fmt(mean(s))}  vs  null ${fmt(mean(z))}`
    + `   ${mean(z) > 1e-9 ? `${fmt(mean(s) / mean(z), 2)}x` : 'null arm <= 0'}   (pre-declared: >= 2x)`);
  console.log('  ⚠ CONSERVATIVE, AND IT CAN TIE BY CONSTRUCTION. Both arms share generation 0,');
  console.log('    so both arks contain the founders. If neither arm beats a strong founder,');
  console.log('    best-ever-vs-best-ever compares the same animal with itself.');
}

// ── GATE 2 · THE RESPONSE, which is what selection is actually asked for ─────
//
// Best-ever hides whether anything was BRED. This is the founder-relative gain:
// the line's final best against its own generation-0 best, per line, per arm.
// It is immune to the tie above because each line is measured against its own
// starting point rather than against the other arm's animals.
console.log('\n  ── GATE 2 · response over the founder ──');
console.log('  arm    line   gen0 best   final best    gain    x founder');
for (const A of arms) {
  for (const line of A.lines) {
    const h = A.history.filter((r) => r.line === line.L).sort((a, b) => a.gen - b.gen);
    if (h.length < 2) continue;
    const first = h[0].bestCm, last = Math.max(...h.map((r) => r.bestCm));
    console.log(`  ${A.arm.padEnd(6)} ${String(line.L).padStart(3)} ${fmt(first).padStart(11)}`
      + ` ${fmt(last).padStart(12)} ${fmt(last - first).padStart(8)}`
      + ` ${(Math.abs(first) > 1e-6 ? fmt(last / first, 2) : '—').padStart(10)}`);
  }
}
console.log(`\n  §1.2's pre-declared prediction: ~0.20 cm per generation early, declining as a`);
console.log('  line approaches its peak; the founding step alone was worth ~0.95 cm.');

// ── GATE 3 · THE POPULATION, which is the statistic run 1 showed is the one ──
//
// Best-ever is a MAXIMUM over an equal number of evaluations, and a diverse arm
// samples more distinct regions, so it can win the max while losing everywhere
// else. Run 1: null beat score 1.19x on best-ever and LOST 23x on the median.
// Both are declared here so neither can be chosen after the fact.
if (ARM_ARG === 'both') {
  console.log('\n  ── GATE 3 · median of the final generation ──');
  const med = (arm) => {
    const h = arms.find((a) => a.arm === arm)?.history.filter((r) => r.gen === GENS) ?? [];
    return h.length ? mean(h.map((r) => r.medCm)) : 0;
  };
  const s = med('score'), z = med('null');
  console.log(`  mean line median closedCm   score ${fmt(s)}  vs  null ${fmt(z)}`
    + `   ${Math.abs(z) > 1e-9 ? `${fmt(s / z, 2)}x` : '—'}   (pre-declared: >= 2x)`);
}

writeFileSync(ARKFILE, JSON.stringify({
  seed: SEED, pop: POP, lines: LINES, seconds: SECONDS, gens: GENS,
  genomeVersion: deserialise(stock[0].serialised).version,
  capture: GOAL_CAPTURE, task: TASK_MAX,
  verdict, arks: Object.fromEntries(arms.map((a) => [a.arm, a.ark])),
  events: Object.fromEntries(arms.map((a) => [a.arm, a.lines.flatMap((l) => l.events)])),
  history: arms.flatMap((a) => a.history),
}, null, 1));
console.log(`\n  written: tools/_zbreed_state_${SEED}.json · tools/_zbreed_ark_${SEED}.json\n`);
