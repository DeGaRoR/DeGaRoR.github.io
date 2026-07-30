// engine/l1/viability.js — the viability filter (10 §A9).
//
// PURITY: Rapier is INJECTED, already initialised, exactly as physics.js takes
// it — `RAPIER.init()` is async and 01 §4 forbids async in /engine/.
//
// A9's list is implemented in cheapest-first order so that most rejections cost
// no simulation at all. THREE OF ITS RULES ARE AMENDED, each because it was
// measured against this build and found not to do what it says (200 genomes,
// 2 s settle, both gravities):
//
//   1. "bounding radius > 4x tank's smallest dimension" — 64 m in W1. It fires
//      on NOTHING. The constraint the simulation actually needs is unstated:
//      physics.js cannot instantiate a creature larger than the tank at all
//      (it spawns embedded in the walls and Rapier panics), so it silently drops
//      the environment for those, and an unbounded creature then drifts forever
//      and reads as "it swam a long way" in every displacement measurement.
//      Measured: 10% of the corpus does not fit. Both rules are implemented; the
//      spec's is kept so its uselessness is visible rather than assumed.
//
//   2. "reject if the centre of mass moved less than 0.05 units in 2 s" — with
//      gravity on this measures BUOYANT DRIFT, which exceeds locomotion by about
//      40x (B3), so it would pass a corpse. Measured at gravity zero, where
//      displacement is locomotion and nothing else, the corpus gives a median of
//      0.054 m in 2 s: A9's threshold rejects 46% of all creatures — against
//      A9's own warning that a rejection rate over ~40% means the operators are
//      broken. The threshold is set from the measured distribution instead.
//
//   3. "clip the smaller part's collision shape halfway back from its attachment
//      point, so it swings freely until its far end makes contact" — moot here.
//      B3 disables contacts between jointed bodies outright (10 §A6 exempts the
//      parent from overlap rejection and never states the matching contact
//      rule), so connected parts cannot jam against their parents. The clipping
//      trick solves a problem this build does not have.

import { morphogenesis, totalMass, boundingRadius, obbOverlap } from './morphogen.js';
import { createSimulation, FIXED_DT } from './physics.js';

export const VIABILITY = {
  minBodies: 2,          // A9. A single body has no joints and cannot move.
  maxBodies: 24,         // A9, = CAPS.maxBodies.
  minMass: 0.2,          // A9, kg (units: density x volume, water = 1.0).
  maxMass: 40,
  tankRadiusFactor: 4,   // A9's rule, kept and measured. See note 1 above.
  settleSeconds: 2.0,    // A9's "simulate headless for 2 seconds".

  /**
   * Inertness threshold, metres of centre-of-mass travel in `settleSeconds` AT
   * GRAVITY ZERO. See note 2. Set below the corpus's tenth percentile (0.013 m)
   * so it removes creatures that do nothing at all without becoming the dominant
   * rejection cause: measured 9% at 0.01, 13% at 0.02, 46% at A9's 0.05.
   */
  minSelfMotion: 0.01,

  /**
   * DERIVED, not tuned. The tank walls are 0.5 m thick (physics.js WALL). A body
   * moving faster than one wall thickness per step can pass through a wall
   * between two steps, so above this speed the tank stops containing anything
   * and the creature is an artefact of the solver rather than a swimmer. This
   * also puts a bound on the peak-speed tail B3 carries as an obligation — for
   * BRED creatures only; it does not repair B3, and the gate corpus is unfiltered.
   */
  maxPeakSpeed: 0.5 / FIXED_DT,   // 60 m/s

  maxAttempts: 12,       // A9: "max 12 attempts, then fall back to unmutated parent".

  /**
   * The STRANGER's cap, separate from A9's offspring cap and larger (H3b).
   *
   * An offspring that exhausts its attempts has a safe fallback: the unmutated
   * parent, which is by definition viable. A stranger has none — it is drawn
   * from nothing — so exhaustion used to return the last candidate WHETHER OR
   * NOT it passed, which put a knowingly invalid genome in the one slot whose
   * entire purpose is to keep the population healthy (N17).
   *
   * 12 attempts is A9's number for a problem that has a fallback. Four times
   * that costs nothing in the common case, because the loop stops at the first
   * viable draw and the measured stranger viability rate makes exhaustion
   * vanishingly rare. It stays DETERMINISTIC: attempt k forks the same stream it
   * always did, so raising the cap cannot change any lineage that succeeded
   * before the old one ran out.
   */
  strangerAttempts: 48,
};

export const REASONS = [
  'bodies', 'mass', 'oversizeSpec', 'oversizeTank', 'diverged', 'interpenetration', 'inert',
];

/** Bodies joined by a joint may interpenetrate (10 §A6); everything else may not. */
function adjacency(plan) {
  const adj = new Set();
  for (const j of plan.joints) {
    adj.add(`${j.parentBody}:${j.childBody}`);
    adj.add(`${j.childBody}:${j.parentBody}`);
  }
  return adj;
}

/**
 * Run the settle simulation A9 asks for, and report what happened during it.
 * This IS the "repel" half of repel-then-discard: non-adjacent bodies of the
 * same creature have live contacts, so the solver spends two seconds pushing
 * intersecting parts apart. Only what is STILL intersecting at the end counts.
 */
function settle(RAPIER, plan, genome, world, opts = {}) {
  const steps = Math.round(VIABILITY.settleSeconds / FIXED_DT);
  const sim = createSimulation(RAPIER, plan, genome, world, opts);
  const c0 = sim.centreOfMass();
  const adj = adjacency(plan);
  let peak = 0, nonFinite = false;

  // PERSISTENT, which is A9's word and not a detail. A single end-of-settle
  // snapshot rejects any creature that happens to be mid-stroke with a limb
  // crossing its own grandparent — a pose, not a defect. Measured: a one-sample
  // test rejected 20% of candidates and was the dominant rejection cause.
  // Overlap is sampled at several times and only pairs intersecting at EVERY
  // sample count, which is what distinguishes a limb swinging through from two
  // parts the solver cannot separate.
  const sampleAt = new Set([Math.round(steps * 0.5), Math.round(steps * 0.75), steps]);
  let persistent = null;

  const sampleOverlaps = () => {
    const pose = sim.readPose();
    const found = new Set();
    for (let a = 0; a < pose.length; a++) {
      for (let b = a + 1; b < pose.length; b++) {
        if (adj.has(`${a}:${b}`)) continue;
        const boxA = { position: pose[a].p, rotation: pose[a].q, dims: plan.bodies[a].dims };
        const boxB = { position: pose[b].p, rotation: pose[b].q, dims: plan.bodies[b].dims };
        if (obbOverlap(boxA, boxB)) found.add(`${a}:${b}`);
      }
    }
    persistent = persistent === null ? found : new Set([...persistent].filter(k => found.has(k)));
  };

  for (let s = 1; s <= steps; s++) {
    sim.step();
    for (const rb of sim.bodies) {
      const p = rb.translation(), v = rb.linvel();
      if (!Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z)) { nonFinite = true; break; }
      const sp = Math.hypot(v.x, v.y, v.z);
      if (sp > peak) peak = sp;
    }
    if (nonFinite) break;
    if (sampleAt.has(s) && persistent?.size !== 0) sampleOverlaps();
  }

  const c1 = sim.centreOfMass();
  const travel = nonFinite ? Infinity
    : Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);

  sim.free();
  return { travel, peak, nonFinite, overlaps: nonFinite ? 0 : (persistent?.size ?? 0) };
}

/**
 * The gravity-zero free run's verdict: `'diverged'`, `'inert'`, or null for OK.
 *
 * EXTRACTED SO THE GATE CAN REACH IT (H3). A DIVERGED FREE RUN MUST NOT READ AS
 * MOTION. `settle` reports Infinity travel when the state goes non-finite, and
 * `Infinity >= minSelfMotion` is TRUE — so a creature that blew up passed the
 * inertness test as the liveliest thing in the corpus, and the stranger slot,
 * which exists to keep the population healthy, could be filled by it. The live
 * settle has rejected divergence since B4; this run never did, and it is the one
 * whose entire job is to produce a number.
 *
 * It is extracted rather than inlined because the corpus cannot press it: over
 * 1200 random genomes at MOTOR_SCALE 1.0, zero diverge in this run. At scale 6
 * it is 1 in 600. So the escape is LATENT, and it goes live at exactly the
 * MOTOR_SCALE 2.0 that B3 carries as its tuning candidate. An assertion against
 * the live corpus would therefore assert nothing; against this function it
 * asserts the rule.
 *
 * `peak` is deliberately NOT consulted. `maxPeakSpeed` is derived from wall
 * thickness — a body faster than one wall per step can tunnel out of the tank —
 * and this run is unbounded by construction, so there is no wall to be about.
 *
 * @param {{travel:number, nonFinite:boolean}} free
 */
export function freeMotionVerdict(free, min = VIABILITY.minSelfMotion) {
  if (free.nonFinite || !Number.isFinite(free.travel)) return 'diverged';
  if (!(free.travel >= min)) return 'inert';
  return null;
}

/**
 * @param {object} RAPIER  already-initialised
 * @param {object} genome
 * @param {object} world
 * @param {object} [opts] `{ plan }` if morphogenesis has already run
 * @returns {{ok:boolean, reason:string|null, plan:object, metrics:object}}
 */
export function assessViability(RAPIER, genome, world, opts = {}) {
  const plan = opts.plan ?? morphogenesis(genome);
  const metrics = { bodies: plan.bodyCount, mass: totalMass(plan), radius: boundingRadius(plan) };
  const fail = (reason) => ({ ok: false, reason, plan, metrics });

  // ── free checks ─────────────────────────────────────────────────────────
  if (plan.bodyCount < VIABILITY.minBodies || plan.bodyCount > VIABILITY.maxBodies) return fail('bodies');
  if (metrics.mass < VIABILITY.minMass || metrics.mass > VIABILITY.maxMass) return fail('mass');
  if (metrics.radius > VIABILITY.tankRadiusFactor * Math.min(...world.tankBounds)) return fail('oversizeSpec');

  // The tank-fit rule, stated the same way physics.js computes `fitsTank` so the
  // two cannot drift: a creature that fails here gets NO environment colliders,
  // which is a different simulation from the one every measurement assumes.
  let reach = 0;
  for (const b of plan.bodies) {
    reach = Math.max(reach,
      Math.abs(b.position[0]) + b.dims[0],
      Math.abs(b.position[1]) + b.dims[1],
      Math.abs(b.position[2]) + b.dims[2]);
  }
  metrics.reach = reach;
  if (!(reach < Math.min(world.tankBounds[0], world.tankBounds[1], world.tankBounds[2]) / 2)) return fail('oversizeTank');

  // ── settle, in the world the creature will actually live in ─────────────
  const live = settle(RAPIER, plan, genome, world);
  metrics.peakSpeed = live.peak;
  metrics.overlaps = live.overlaps;
  if (live.nonFinite || live.peak > VIABILITY.maxPeakSpeed) return fail('diverged');
  if (live.overlaps > 0) return fail('interpenetration');

  // ── inertness, at gravity zero so the number is locomotion ──────────────
  const free = settle(RAPIER, plan, genome, { ...world, gravity: 0 }, { bounded: false });
  metrics.selfMotion = free.travel;

  const verdict = freeMotionVerdict(free);
  if (verdict) return fail(verdict);

  return { ok: true, reason: null, plan, metrics };
}

/** A fresh tally, for the rejection-rate diagnostic A9 asks to be logged. */
export function newTally() {
  const t = { attempts: 0, viable: 0 };
  for (const r of REASONS) t[r] = 0;
  return t;
}

export function record(tally, result) {
  tally.attempts++;
  if (result.ok) tally.viable++;
  else tally[result.reason]++;
  return result;
}

/** Viable fraction of everything assessed. A9: below ~0.6 the operators are wrong. */
export const viabilityRate = (tally) => (tally.attempts ? tally.viable / tally.attempts : 1);
