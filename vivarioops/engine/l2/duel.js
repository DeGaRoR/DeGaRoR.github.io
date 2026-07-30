// engine/l2/duel.js — the duel probe (11 §6), reduced to a PairMatchup (03 §2).
//
// "One probe, run once per (subject, resident) pair per repeat. This is the whole
// matchup mechanism." (11 §6)
//
// PURITY (01 §4, N1-N3): no clock, no Math.random, no DOM, no imports from
// /trunk/, /ui/, /render/. Rapier is INJECTED and already initialised. Every
// stochastic choice draws from the CANONICAL PAIR SEED via the stateless
// counter-based `rand01` in contracts/hash.js — /engine/ cannot import
// trunk/rng.js (N3), and a duel needs four draws, not a stream.
//
// THIS IS THE FIRST TIME TWO CREATURES SHARE A PHYSICS WORLD. B4b tiled six
// private tanks because `createSimulation` built its own `RAPIER.World` per call
// (handoff, open decision 5). C1 extracted `createArena`; this file is the
// reason it was extracted.

import { rand01 } from '../../contracts/hash.js';
import { BRIDGE_V } from '../../contracts/versions.js';
import {
  canonicalPair, placementFirst, pairSeed, makeMatchup,
} from '../../contracts/matchup.js';
import { createArena, createSimulation, fitsTank, FIXED_DT, WALL } from '../l1/physics.js';
import { sensorTurnBias } from '../l1/controller.js';
import { SETTLE_SECONDS, UNSTABLE_SPEED, INVALID } from './probe.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants of the BRIDGE. Moving any of these changes what every recorded
// matchup MEANS, so each one must bump BRIDGE_V. Gathered here for that reason.
// ─────────────────────────────────────────────────────────────────────────────

/** 11 §6: separation `d = k * (reachA + reachB)`, k drawn per repeat. */
export const SEPARATION_K = [2, 3, 4, 5, 6];

/** 11 §6: relative bearing drawn per repeat. Radians. */
export const BEARINGS = [0, 72, 144, 216, 288].map(d => (d * Math.PI) / 180);

/**
 * 10 §7 guard 3: "a duel decided in under 0.5 s is flagged for review rather
 * than recorded". Seconds of MEASURED time, after the settle.
 */
export const REVIEW_SECONDS = 0.5;

/**
 * 10 §7 guard 2: "contact impulses above a plausibility threshold are ignored".
 *
 * DERIVED, NOT TUNED, and by the same argument viability.js uses for
 * `maxPeakSpeed`: the tank walls are one `WALL` thick, so a body that changes
 * velocity by more than one wall thickness per step can cross a wall between two
 * steps. A contact that imparts that much velocity to the body it strikes is not
 * a creature touching another creature — it is the solver resolving a
 * penetration it should never have been given, which is precisely the class of
 * exploit 10 §7 says is "content in L1, corrosive in L2".
 *
 * Applied as an impulse budget rather than a speed: an impulse `J` on a body of
 * mass `m` changes its velocity by `J/m`, so the test is `J > m * MAX_CONTACT_DV`
 * against the mass of the ROOT BODY being struck. Mass-relative, so it does not
 * quietly become a size filter.
 */
export const MAX_CONTACT_DV = WALL / FIXED_DT;   // 60 m/s, as viability.js

/** 11 §11: "NaN or |v| > 1000 in trace" -> aborted, valid = false. */
export { UNSTABLE_SPEED };

export const OUTCOME = { A: 'A', B: 'B', NONE: 'none' };

// ─────────────────────────────────────────────────────────────────────────────
// Setup — 11 §6, seeded canonically per 03 §2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything about a duel that is decided before it starts, derived ONLY from
 * the canonical pair seed.
 *
 * 03 §2: "Which body is placed first, and which is 'the subject' for reporting,
 * is derived SEPARATELY from the seed. A-vs-B and B-vs-A therefore run the
 * identical fights and merely read them from opposite ends." That is what K4
 * asserts, and it is why nothing below reads argument order.
 *
 * ── SPEC DEFECT, MEASURED: 11 §6's separation does not fit its own tank ──────
 *
 * 11 §6 asks for `d = k * (reachA + reachB)` with k drawn from {2,3,4,5,6}, and
 * 03 §4 puts L3's engagement radius at the same `4 * (reachA + reachB)`. Over a
 * viable corpus, reach has a median of 3.5 m — a creature's reach is very nearly
 * its whole size — so the requested separation has a median of **29 m inside a
 * 16 x 24 x 16 m tank**, and 03 §4's engagement radius is 28 m in that same 16 m
 * tank. Both documents ask for a distance the world they specify does not have.
 *
 * Clamping to the tank, which is what this function did first, made it worse in
 * a way worth recording: EVERY draw clamped to the same number, so `k` selected
 * nothing and all three repeats of every pair began at an identical separation.
 * That is B4's lesson about assertions restated as a fixture — a parameter whose
 * corpus cannot distinguish its values distinguishes nothing — and it would have
 * shipped three identical fights per pair under the name "deterministic
 * variations" (11 §4).
 *
 * So the k SET IS MAPPED ONTO THE ROOM THE TANK ACTUALLY HAS, order preserved:
 * k = 2 places the pair at touching range (their reach envelopes just meet) and
 * k = 6 places them as far apart as the tank permits, with the rest spaced
 * between. This keeps every property 11 §6 was after — an anchor in the
 * creatures' own size, five distinct separations, repeats varied but not random
 * — and drops only the absolute multiplier, which the tank had already made
 * unrealisable. `PairMatchup.engagementRadius` records what was achieved, and
 * the gate reports the ratio to what was asked.
 *
 * ── AND THEY MUST NOT SPAWN IN THE WALL ─────────────────────────────────────
 *
 * A creature placed at `span/2 - reach` touches the wall exactly, and physics.js
 * is explicit that a body spawned embedded in a wall is a penetration the solver
 * cannot resolve — Rapier panics. Measured before the margin was added: 20 of 84
 * duels aborted as `unstable`. One wall thickness of clearance is the same
 * quantity `WALL` that every other derived bound in this project is drawn from.
 *
 * THE BEARING IS REALISED AS A PLACEMENT DIRECTION, not as a rotation of either
 * body. Bodies are spawned world-aligned (physics.js) and forward is the root's
 * local +Z, so rotating a creature would mean rotating every body position and
 * rotation about the spawn origin. Placing the pair along a line at angle theta
 * instead gives the same thing the sensors actually read — the opponent at a
 * different bearing off each creature's own forward axis — over the same five
 * distinct relationships, and it leaves the spawn frame untouched.
 */
export function duelSetup({ aHash, bHash, reachA, reachB, repeat, world, worldHashStr }) {
  const s = pairSeed(BRIDGE_V, worldHashStr, aHash, bHash, repeat);

  const kIndex = Math.floor(rand01(s, 0) * SEPARATION_K.length);
  const k = SEPARATION_K[kIndex];
  const theta = BEARINGS[Math.floor(rand01(s, 1) * BEARINGS.length)];

  const reachSum = reachA + reachB;
  const wanted = k * reachSum;

  // The room between the walls ALONG THE PLACEMENT DIRECTION. Measuring it
  // against the smaller horizontal span regardless of bearing is simply wrong
  // geometry — it throws away the tank's diagonal, which is 22.6 m against a
  // 16 m side — and it was wrong in a way that hid itself: every bearing then
  // produced the same room, every k clamped to it, and all three repeats of a
  // pair became the identical fight under the name "deterministic variations"
  // (11 §4). L2-15 is the assertion that caught it.
  //
  // Distance from the tank centre to the wall along a unit direction is
  // min(hx/|dx|, hz/|dz|), the standard slab bound. The vertical axis is the
  // tank's longest but it is the one buoyancy owns, so a duel separated
  // vertically would be decided by density before either creature acted.
  const dir = [Math.sin(theta), 0, Math.cos(theta)];
  const hx = world.tankBounds[0] / 2;
  const hz = world.tankBounds[2] / 2;
  const toWall = Math.min(
    Math.abs(dir[0]) > 1e-9 ? hx / Math.abs(dir[0]) : Infinity,
    Math.abs(dir[2]) > 1e-9 ? hz / Math.abs(dir[2]) : Infinity,
  );
  const room = Math.max(0, 2 * (toWall - Math.max(reachA, reachB) - WALL));

  // Touching range is the floor: below it they start already in contact and the
  // duel measures the spawn, not the creatures.
  const near = Math.min(reachSum, room);
  const far = Math.max(near, room);
  const span01 = SEPARATION_K.length > 1 ? kIndex / (SEPARATION_K.length - 1) : 0;
  const separation = Math.min(near + span01 * (far - near), wanted);

  const half = separation / 2;

  return {
    seed: s,
    k, kIndex, theta, wanted, separation, room,
    /** How much of 11 §6's request the tank could honour. Reported, not hidden. */
    fitRatio: wanted > 0 ? separation / wanted : 1,
    clamped: separation < wanted - 1e-9,
    /** 03 §2: which hash is built into the world first. Not argument order. */
    first: placementFirst(BRIDGE_V, worldHashStr, aHash, bHash, repeat),
    originFor(hash) {
      const [lo] = canonicalPair(aHash, bHash);
      const sign = hash === lo ? -1 : 1;
      return [dir[0] * half * sign, 0, dir[2] * half * sign];
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensing — 11 §6, using the C1 amendment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signed bearing of `target` off `sim`'s forward axis, normalised to [-1, 1].
 *
 * 11 §10: "sensors = { preyBearing, threatBearing } — signed, normalised to
 * [-1, 1], 0 if none in range." Horizontal, for the same reason `headingOf` is
 * horizontal: a bearing is a compass bearing, and an opponent directly above is
 * not to the left or the right.
 */
export function bearingTo(sim, target) {
  const com = sim.centreOfMass();
  const dx = target[0] - com[0];
  const dz = target[2] - com[2];
  if (dx * dx + dz * dz < 1e-12) return 0;

  const q = sim.bodies[0].rotation();
  // Forward is the root's local +Z; heading is its horizontal angle.
  const fx = 2 * (q.x * q.z + q.w * q.y);
  const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const heading = Math.atan2(fx, fz);

  let d = Math.atan2(dx, dz) - heading;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d / Math.PI;
}

/**
 * 11 §6: "Each sees the other on its threat AND its prey channel — the
 * creature's own evolved gains decide whether it approaches or avoids. NOTHING
 * ASSIGNS ROLES."
 *
 * So both channels carry the SAME bearing and the two gains sum. A creature with
 * preyGain +0.8 and threatGain -0.2 nets +0.6 and closes; one with the signs
 * reversed flees. "A creature that flees prey and chases threats is possible and
 * will simply lose" (11 §10).
 */
export function senseOpponent(sim, opponentCom) {
  const bearing = bearingTo(sim, opponentCom);
  return sensorTurnBias(sim.genome, bearing, bearing);
}

// ─────────────────────────────────────────────────────────────────────────────
// Capture — 10 §7 guard 1 and guard 2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Has any of `attacker`'s colliders made a PLAUSIBLE contact with `victim`'s
 * root body?
 *
 * 10 §7 guard 1: "Capture requires contact with the root body." 11 §5 gives the
 * reason it is the root and not any part — it models "a weak point that
 * morphology can evolve to protect", which is what makes `torsoExposure` a
 * measurement rather than trivia.
 *
 * 10 §7 guard 2: an implausible impulse is IGNORED, not counted and not
 * flagged — the touch simply does not happen. A launch through a limb is the
 * solver's arithmetic, not the creature's body, and letting it decide a duel is
 * exactly what "corrosive in L2" means.
 *
 * @returns {{hit:boolean, impulse:number, ignored:number}}
 */
export function rootContact(world3d, attackerHandles, victim) {
  const root = victim.rootCollider;
  const rootMass = victim.bodies[0].mass();
  const budget = rootMass * MAX_CONTACT_DV;

  let hit = false, peak = 0, ignored = 0;

  world3d.contactPairsWith(root, (other) => {
    if (hit) return;
    if (!attackerHandles.has(other.handle)) return;

    world3d.contactPair(root, other, (manifold) => {
      const n = manifold.numContacts();
      let best = 0, touching = false;
      for (let i = 0; i < n; i++) {
        // A manifold can exist while the shapes are still apart: the broad phase
        // keeps a pair alive across a small gap. Only a non-positive distance is
        // contact.
        if (manifold.contactDist(i) > 0) continue;
        touching = true;
        const j = Math.abs(manifold.contactImpulse(i));
        if (j > best) best = j;
      }
      if (!touching) return;
      if (best > budget) { ignored++; return; }     // guard 2
      peak = Math.max(peak, best);
      hit = true;
    });
  });

  return { hit, impulse: peak, ignored };
}

// ─────────────────────────────────────────────────────────────────────────────
// One duel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run one repeat of one pair.
 *
 * @param {object} RAPIER already-initialised
 * @param {object} args
 * @param {{genome,plan,hash,reach}} args.a
 * @param {{genome,plan,hash,reach}} args.b
 * @param {object} args.world
 * @param {string} args.worldHash
 * @param {number} args.repeat
 * @param {function} [args.onSample]  observer for replay; called per sampled step
 * @returns {object} per-duel record — 11 §6
 */
export function runDuel(RAPIER, args) {
  const { a, b, world, worldHash: worldHashStr, repeat } = args;

  const setup = duelSetup({
    aHash: a.hash, bHash: b.hash,
    reachA: a.reach, reachB: b.reach,
    repeat, world, worldHashStr,
  });

  const base = {
    repeat, seed: setup.seed, k: setup.k, theta: setup.theta,
    clamped: setup.clamped, requestedSeparation: setup.wanted,
    outcome: OUTCOME.NONE, timeToOutcome: world.duelDuration,
    workA: 0, workB: 0, minDistance: Infinity,
    separation: setup.separation,
    flagged: false, ignoredContacts: 0, valid: true, reason: null,
  };

  // A creature that does not fit the tank cannot be placed in a SHARED arena at
  // all: the private case drops the walls for it (physics.js), but here the
  // walls belong to the opponent too. Viability already rejects these
  // (`oversizeTank`), so reaching this is a caller error rather than an outcome.
  if (!fitsTank(a.plan, world) || !fitsTank(b.plan, world)) {
    return { ...base, valid: false, reason: 'oversizeTank' };
  }

  const arena = createArena(RAPIER, world, { bounded: true });

  // Creation order is derived from the seed, never from argument order (03 §2).
  // Rapier's handles, and therefore its island and constraint ordering, follow
  // creation order — so if this read `a` before `b` the two directions of the
  // same pair would be different fights and K4 would be a lie.
  const firstIsA = setup.first === a.hash;
  const order = firstIsA ? [a, b] : [b, a];
  const sims = order.map(c => createSimulation(RAPIER, c.plan, c.genome, world, {
    arena, origin: setup.originFor(c.hash), effort: 0, turnBias: 0,
  }));
  const simA = firstIsA ? sims[0] : sims[1];
  const simB = firstIsA ? sims[1] : sims[0];

  const handlesA = new Set(simA.colliders.map(c => c.handle));
  const handlesB = new Set(simB.colliders.map(c => c.handle));

  // ── settle (11 §6: "Both creatures settled") ──────────────────────────────
  // In place, at effort 0, sensors off — the same preamble runSolo uses and for
  // the same reason. Both settle in the SAME arena so neither is measured in a
  // world the other was absent from.
  const settleSteps = Math.round(SETTLE_SECONDS / FIXED_DT);
  for (let s = 0; s < settleSteps; s++) arena.stepAll(sims);

  if (!finitePair(simA, simB)) {
    for (const s of sims) s.free();
    arena.free();
    return { ...base, valid: false, reason: INVALID.UNSTABLE };
  }

  simA.resetClock();
  simB.resetClock();

  // The separation the duel ACTUALLY begins at, after the settle moved them.
  // This is what 03 §2 means by `engagementRadius`, and it is measured rather
  // than assumed for exactly the reason the field exists.
  const startSeparation = distance(simA, simB);

  // ── the fight ─────────────────────────────────────────────────────────────
  const steps = Math.round(world.duelDuration / FIXED_DT);
  const sampleEvery = Math.round(1 / (20 * FIXED_DT));   // 20 Hz, as 11 §3
  let outcome = OUTCOME.NONE;
  let timeToOutcome = world.duelDuration;
  let minDistance = startSeparation;
  let ignored = 0;
  let unstable = false;

  for (let s = 1; s <= steps; s++) {
    // Sense, then act. Both creatures read the world as it was at the top of the
    // step, so neither gets to react to the other's reaction within one tick.
    const comA = simA.centreOfMass();
    const comB = simB.centreOfMass();
    simA.control.turnBias = senseOpponent(simA, comB);
    simB.control.turnBias = senseOpponent(simB, comA);

    arena.stepAll(sims);

    if (!finitePair(simA, simB) || overspeed(simA) || overspeed(simB)) { unstable = true; break; }

    const d = distance(simA, simB);
    if (d < minDistance) minDistance = d;

    const aHitsB = rootContact(arena.world3d, handlesA, simB);
    const bHitsA = rootContact(arena.world3d, handlesB, simA);
    ignored += aHitsB.ignored + bHitsA.ignored;

    if (aHitsB.hit || bHitsA.hit) {
      timeToOutcome = simA.t;
      // SPEC GAP, REPORTED. 11 §6 lists the three termination conditions as
      // "whichever comes first" and says nothing about two of them arriving in
      // the same step. Two creatures that strike each other's root simultaneously
      // is a mutual kill, and the only answer that survives K4 is a SYMMETRIC
      // one: picking A would make the outcome depend on which side asked.
      if (aHitsB.hit && bHitsA.hit) outcome = OUTCOME.NONE;
      else outcome = aHitsB.hit ? OUTCOME.A : OUTCOME.B;
      break;
    }

    if (args.onSample && s % sampleEvery === 0) {
      args.onSample({ t: simA.t, simA, simB, distance: d });
    }
  }

  const workA = simA.work;
  const workB = simB.work;

  for (const s of sims) s.free();
  arena.free();

  if (unstable) {
    return { ...base, valid: false, reason: INVALID.UNSTABLE, separation: startSeparation };
  }

  return {
    ...base,
    outcome, timeToOutcome, workA, workB,
    minDistance, separation: startSeparation,
    ignoredContacts: ignored,
    // 10 §7 guard 3 — flagged for review, NOT recorded. The reduction drops it.
    flagged: outcome !== OUTCOME.NONE && timeToOutcome < REVIEW_SECONDS,
  };
}

const distance = (x, y) => {
  const a = x.centreOfMass(), b = y.centreOfMass();
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};

function finitePair(x, y) {
  for (const sim of [x, y]) {
    for (const rb of sim.bodies) {
      const p = rb.translation(), v = rb.linvel(), a = rb.angvel();
      if (!Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z + a.x + a.y + a.z)) return false;
    }
  }
  return true;
}

function overspeed(sim) {
  for (const rb of sim.bodies) {
    const v = rb.linvel();
    if (Math.hypot(v.x, v.y, v.z) > UNSTABLE_SPEED) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reduction — 11 §6 over `duelRepeats`, into 03 §2's symmetric PairMatchup
// ─────────────────────────────────────────────────────────────────────────────

/** Median of a numeric array. Even lengths take the lower middle, so the value is one of the samples. */
function median(xs, fallback) {
  if (!xs.length) return fallback;
  const s = xs.slice().sort((p, q) => p - q);
  return s[Math.floor((s.length - 1) / 2)];
}

/**
 * Reduce a pair's repeats to a `PairMatchup`.
 *
 * 03 §2 replaces 11 §6's one-directional row: "One duel run produces both
 * directions; recording only the subject's side made the resident->player column
 * unreconstructible."
 *
 * FLAGGED REPEATS ARE DROPPED FROM THE DENOMINATOR, which is what 10 §7 guard 3
 * means by "flagged for review rather than recorded". Counting them as
 * stalemates would be recording them. If EVERY repeat is flagged the pair has no
 * honest reduction at all, so it records a full stalemate and carries
 * `underReview` — K3's invariant still holds, and the flag says why the numbers
 * are what they are instead of leaving a plausible-looking row.
 *
 * @param {object} args
 * @param {string} args.aHash @param {string} args.bHash  either order; canonicalised here
 * @param {object[]} args.duels  records from runDuel, in repeat order
 * @param {number} args.duelDuration
 */
export function reduceDuels({ aHash, bHash, duels, duelDuration }) {
  const [lo, hi] = canonicalPair(aHash, bHash);
  const loIsA = lo === String(aHash);

  const m = makeMatchup();
  m.aHash = lo;
  m.bHash = hi;
  m.repeats = duels.length;

  const counted = duels.filter(d => d.valid && !d.flagged);
  const n = counted.length;

  // `outcome` is reported in the CALLER's A/B terms; the matchup is canonical.
  // Translate once, here, rather than making every caller remember to.
  const wonByLo = counted.filter(d => (d.outcome === OUTCOME.A) === loIsA && d.outcome !== OUTCOME.NONE);
  const wonByHi = counted.filter(d => (d.outcome === OUTCOME.B) === loIsA && d.outcome !== OUTCOME.NONE);

  const workOf = (d, isLo) => (isLo === loIsA ? d.workA : d.workB);
  const rateOver = (ds, isLo) => (ds.length
    ? ds.reduce((acc, d) => acc + workOf(d, isLo) / Math.max(d.timeToOutcome, FIXED_DT), 0) / ds.length
    : 0);

  m.aToB = {
    pCapture: n ? wonByLo.length / n : 0,
    timeToCapture: median(wonByLo.map(d => d.timeToOutcome), duelDuration),
    energyRate: rateOver(counted, true),
  };
  m.bToA = {
    pCapture: n ? wonByHi.length / n : 0,
    timeToCapture: median(wonByHi.map(d => d.timeToOutcome), duelDuration),
    energyRate: rateOver(counted, false),
  };
  m.pStalemate = n ? 1 - m.aToB.pCapture - m.bToA.pCapture : 1;

  // The separation the duels actually began at, which is the honest reading of
  // 03 §2's "separation at which the duel began, in metres".
  m.engagementRadius = counted.length
    ? counted.reduce((acc, d) => acc + d.separation, 0) / counted.length
    : (duels[0]?.separation ?? 0);

  return {
    matchup: m,
    counted: n,
    flagged: duels.filter(d => d.flagged).length,
    invalid: duels.filter(d => !d.valid).length,
    clamped: duels.filter(d => d.clamped).length,
    ignoredContacts: duels.reduce((acc, d) => acc + (d.ignoredContacts || 0), 0),
    underReview: n === 0,
  };
}

/**
 * Every repeat of one pair, reduced. The unit the fauna loader consumes.
 *
 * `duelRepeats` is a WORLD constant (11 §6: "so a 'championship' world can raise
 * it"). The slice sets 3 against 11 §6's default of 5, which is 03 §5's choice
 * and is why probability resolution here is 0.33 rather than 0.2.
 */
export function duelPair(RAPIER, { a, b, world, worldHash, onDuel }) {
  const duels = [];
  for (let r = 0; r < world.duelRepeats; r++) {
    const d = runDuel(RAPIER, { a, b, world, worldHash, repeat: r });
    duels.push(d);
    if (onDuel) onDuel(d, r);
  }
  return { ...reduceDuels({ aHash: a.hash, bHash: b.hash, duels, duelDuration: world.duelDuration }), duels };
}
