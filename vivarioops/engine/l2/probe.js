// engine/l2/probe.js — the Probe abstraction (11 §3, §4, §5 preamble, §11).
//
// "There is exactly one extensible concept, the Probe. Adding a new measurement
// means adding a probe, never touching the pipeline." (11 §2)
//
// PURITY (01 §4, N1-N3): no clock, no Math.random, no DOM, no imports from
// /trunk/, /ui/, /render/. Rapier arrives INJECTED and already initialised,
// exactly as physics.js takes it. Seeds are derived, never generated.
//
// This file owns the trace buffer, the seed derivation and the solo run loop.
// The three probes themselves are in probes.js; the duel is in duel.js.

import { seed } from '../../contracts/hash.js';
import { BRIDGE_V } from '../../contracts/versions.js';
import { createSimulation, FIXED_DT } from '../l1/physics.js';
import { qrot } from '../l1/vecmath.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants of the BRIDGE, not of the world.
//
// 11 §4: "BRIDGE_VERSION bumps invalidate every cached record. This is the only
// invalidation mechanism and it must be respected." Everything below is an input
// to a measurement, so moving any of these numbers changes what every record
// means and MUST bump BRIDGE_V. They are gathered here so that is one decision
// in one place rather than a scatter of literals nobody can audit.
// ─────────────────────────────────────────────────────────────────────────────

/** 11 §3: "Sampling at 20 Hz regardless of the 120 Hz physics step." */
export const SAMPLE_HZ = 20;

/** 11 §5 preamble: settle 2 s, unmeasured, to remove instantiation transients. */
export const SETTLE_SECONDS = 2.0;

/** 11 §11: "NaN or |v| > 1000 in trace" -> probe aborted, valid = false. */
export const UNSTABLE_SPEED = 1000;

/** Per-sample flags. `flags` is 11 §3's "NaN / instability / termination cause". */
export const FLAG = {
  OK:         0,
  NONFINITE:  1 << 0,
  OVERSPEED:  1 << 1,
  TERMINATED: 1 << 2,   // the sample at which a duel ended
};

export const INVALID = { UNSTABLE: 'unstable', NONVIABLE: 'nonviable' };

// ─────────────────────────────────────────────────────────────────────────────
// Trace — fixed-size and preallocated. 11 §3: "no growth during simulation."
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number} capacity  samples. A 15 s duel at 20 Hz is 300.
 */
export function makeTrace(capacity) {
  return {
    capacity,
    n: 0,
    t:       new Float32Array(capacity),
    com:     new Float32Array(capacity * 3),
    vel:     new Float32Array(capacity * 3),
    heading: new Float32Array(capacity),      // yaw, radians, NOT unwrapped
    work:    new Float32Array(capacity),      // cumulative J
    contacts: new Int32Array(capacity),       // encoded contact events
    flags:   new Uint8Array(capacity),
  };
}

/** Samples a running simulation into the next trace slot. Allocates nothing. */
export function sample(trace, sim, flags = FLAG.OK, contacts = 0) {
  const i = trace.n;
  if (i >= trace.capacity) return false;      // fixed size is fixed
  const c = sim.centreOfMass();

  // Mass-weighted mean velocity IS the centre of mass's velocity. Reading one
  // body's would make every measurement depend on which body morphogenesis
  // happened to emit first, which is the defect the 0.7.1 speed label had.
  let vx = 0, vy = 0, vz = 0, m = 0;
  for (const rb of sim.bodies) {
    const lv = rb.linvel(), bm = rb.mass();
    vx += lv.x * bm; vy += lv.y * bm; vz += lv.z * bm; m += bm;
  }
  if (m > 0) { vx /= m; vy /= m; vz /= m; }

  trace.t[i] = sim.t;
  trace.com[i * 3] = c[0]; trace.com[i * 3 + 1] = c[1]; trace.com[i * 3 + 2] = c[2];
  trace.vel[i * 3] = vx; trace.vel[i * 3 + 1] = vy; trace.vel[i * 3 + 2] = vz;
  trace.heading[i] = headingOf(sim);
  trace.work[i] = sim.work;
  trace.contacts[i] = contacts;
  trace.flags[i] = flags;
  trace.n++;
  return true;
}

/**
 * The creature's yaw, from the ROOT body's forward axis.
 *
 * Bodies are spawned world-aligned and limb orientation is carried on the
 * collider (physics.js), so the root body's rotation IS the creature's
 * orientation and nothing has to be composed. Forward is the root's local +Z,
 * which is the axis every child attaches along (10 §A6: "the child attaches by
 * its own -Z face"), so it is the body's own anterior direction and not an
 * arbitrary choice.
 *
 * Projected onto the horizontal plane, because heading is a compass bearing:
 * a creature that pitches nose-up has not turned. Degenerate when the body
 * points straight up or down, which `atan2(0, 0)` resolves to 0 — recorded here
 * rather than guarded, because a creature holding a vertical attitude has no
 * heading and pretending otherwise would invent one.
 */
export function headingOf(sim) {
  const q = sim.bodies[0].rotation();
  const f = qrot([q.x, q.y, q.z, q.w], [0, 0, 1]);
  return Math.atan2(f[0], f[2]);
}

/**
 * Unwrap a heading series so differences are real turns, not +/-PI wraps.
 * Writes into `out` (N4). Returns the number of samples written.
 */
export function unwrap(heading, n, out) {
  if (n === 0) return 0;
  out[0] = heading[0];
  let acc = heading[0];
  for (let i = 1; i < n; i++) {
    let d = heading[i] - heading[i - 1];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    acc += d;
    out[i] = acc;
  }
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Determinism and seeding — 11 §4
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 11 §4 solo form: fnv1a(`${BRIDGE_V}|${worldHash}|${subjectHash}|${probeId}|${repeat}`)
 *
 * The duel form is NOT here: 03 §2 supersedes it with a canonical unordered
 * pair, and that derivation lives in contracts/matchup.js with K4 asserting it.
 * Two seed derivations in two files would be exactly the divergence 03 exists
 * to prevent, so this one covers solo probes and defers on duels.
 */
export function seedFor(probeId, repeat, subjectHash, worldHashStr) {
  return seed(BRIDGE_V, worldHashStr, subjectHash, probeId, repeat);
}

// ─────────────────────────────────────────────────────────────────────────────
// The solo run loop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run one creature alone and return its trace.
 *
 * THE SETTLE PREAMBLE (11 §5) is run at `effort = 0` rather than with the motors
 * switched off. "No control" reads either way, and the choice matters: with
 * motorScale 0 the limbs go limp and a multi-jointed body folds up under
 * buoyancy inside two seconds, so the probe would measure a collapsed animal.
 * At effort 0 the oscillator is frozen at its phase-0 pose and the motors hold
 * it, which is a creature at rest rather than a creature that has fainted. The
 * clock is then zeroed (`resetClock`) so the driven phase starts at t = 0 —
 * otherwise the oscillator jumps by whatever the settle consumed, reintroducing
 * precisely the transient the settle exists to remove.
 *
 * @param {object} RAPIER already-initialised
 * @param {object} args
 * @param {object} args.plan
 * @param {object} args.genome
 * @param {object} args.world
 * @param {number} args.duration        simulated seconds, measured
 * @param {number} [args.effort]        multiplier on omega (11 §5 S2)
 * @param {number} [args.turnBias]      constant differential bias (11 §5 S3)
 * @param {number} [args.settle]        seconds, unmeasured
 * @param {number} [args.gravity]       override the world's gravity
 * @param {boolean} [args.bounded]      tank walls present
 * @returns {{trace:object, valid:boolean, reason:string|null, mass:number}}
 */
export function runSolo(RAPIER, args) {
  const { plan, genome, world, duration } = args;
  const effort = args.effort ?? 1;
  const turnBias = args.turnBias ?? 0;
  const settleSeconds = args.settle ?? SETTLE_SECONDS;
  const w = args.gravity === undefined ? world : { ...world, gravity: args.gravity };

  const capacity = Math.floor(duration * SAMPLE_HZ) + 1;
  const trace = makeTrace(capacity);

  const sim = createSimulation(RAPIER, plan, genome, w, {
    bounded: args.bounded ?? true,
    effort: 0,
    turnBias: 0,
  });

  let mass = 0;
  for (const rb of sim.bodies) mass += rb.mass();

  // ── settle ────────────────────────────────────────────────────────────────
  const settleSteps = Math.round(settleSeconds / FIXED_DT);
  for (let s = 0; s < settleSteps; s++) sim.step();

  if (!finite(sim)) { sim.free(); return { trace, valid: false, reason: INVALID.UNSTABLE, mass }; }

  sim.resetClock();
  sim.control.effort = effort;
  sim.control.turnBias = turnBias;

  // ── measured ──────────────────────────────────────────────────────────────
  const steps = Math.round(duration / FIXED_DT);
  const every = Math.round((1 / SAMPLE_HZ) / FIXED_DT);    // 6 steps at 120 Hz / 20 Hz
  let reason = null;

  sample(trace, sim);
  for (let s = 1; s <= steps; s++) {
    sim.step();
    const bad = instability(sim);
    if (bad) {
      // 11 §11: the probe is ABORTED and the record marked invalid. The trace is
      // kept as far as it got, because a trace that stops is evidence and a
      // trace that is discarded is not.
      sample(trace, sim, bad | FLAG.TERMINATED);
      reason = INVALID.UNSTABLE;
      break;
    }
    if (s % every === 0) sample(trace, sim);
  }

  sim.free();
  return { trace, valid: reason === null, reason, mass };
}

/** Every body finite? Cheap, and the only thing that makes Rapier panic later. */
function finite(sim) {
  for (const rb of sim.bodies) {
    const p = rb.translation(), v = rb.linvel(), a = rb.angvel();
    if (!Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z + a.x + a.y + a.z)) return false;
  }
  return true;
}

/**
 * 11 §11's two instability conditions, as flags. Returns 0 when healthy.
 *
 * The overspeed bound is 11 §11's own 1000 m/s and it is DELIBERATELY LOOSER
 * than viability.js's 60 m/s. They answer different questions: viability asks
 * "should this creature be born", and rejects anything that could tunnel a tank
 * wall; a probe asks "is this trace physics or is it arithmetic", and a trace
 * is still physics at 100 m/s even though the creature is a bad one. Compiling
 * a creature the tank already refused to breed is a caller error, and the
 * pipeline (compile.js) checks viability first for exactly that reason.
 */
function instability(sim) {
  let f = 0;
  for (const rb of sim.bodies) {
    const p = rb.translation(), v = rb.linvel(), a = rb.angvel();
    if (!Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z + a.x + a.y + a.z)) return FLAG.NONFINITE;
    if (Math.hypot(v.x, v.y, v.z) > UNSTABLE_SPEED) f |= FLAG.OVERSPEED;
  }
  return f;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reductions shared by more than one probe
// ─────────────────────────────────────────────────────────────────────────────

/** Index of the first sample at or after `t`. */
export function indexAt(trace, t) {
  for (let i = 0; i < trace.n; i++) if (trace.t[i] >= t) return i;
  return trace.n;
}

/**
 * Mean speed over [from, to).
 *
 * `horizontal` drops the vertical component, and that is not a detail — it is
 * the same correction the tank's speed label needed at 0.7.1 and the same one
 * viability.js documents. In W1 buoyant drift exceeds locomotion by about 40x
 * (B3), gravity is the only vertical force, and the creature's density is a gene
 * it did not choose for swimming. A 3-D speed would therefore report a rise-and-
 * sink rate that reads nearly the same for every creature and would tell L3 that
 * a corpse with a swim bladder is fast. Horizontal motion is thrust and nothing
 * else.
 */
export function meanSpeed(trace, from, to, horizontal = true) {
  let s = 0, n = 0;
  for (let i = from; i < to; i++) {
    const x = trace.vel[i * 3], y = trace.vel[i * 3 + 1], z = trace.vel[i * 3 + 2];
    s += horizontal ? Math.hypot(x, z) : Math.hypot(x, y, z);
    n++;
  }
  return n ? s / n : 0;
}

/** Mean d(work)/dt over [from, to) — 11 §2: "Energy is mechanical work." */
export function meanPower(trace, from, to) {
  if (to - from < 2) return 0;
  const dt = trace.t[to - 1] - trace.t[from];
  return dt > 0 ? (trace.work[to - 1] - trace.work[from]) / dt : 0;
}

/** Net displacement / path length. 1 is a straight line, 0 is a closed loop. */
export function straightness(trace, from, to, horizontal = true) {
  if (to - from < 2) return 0;
  let path = 0;
  for (let i = from + 1; i < to; i++) {
    const dx = trace.com[i * 3] - trace.com[(i - 1) * 3];
    const dy = trace.com[i * 3 + 1] - trace.com[(i - 1) * 3 + 1];
    const dz = trace.com[i * 3 + 2] - trace.com[(i - 1) * 3 + 2];
    path += horizontal ? Math.hypot(dx, dz) : Math.hypot(dx, dy, dz);
  }
  const ax = trace.com[(to - 1) * 3] - trace.com[from * 3];
  const ay = trace.com[(to - 1) * 3 + 1] - trace.com[from * 3 + 1];
  const az = trace.com[(to - 1) * 3 + 2] - trace.com[from * 3 + 2];
  const net = horizontal ? Math.hypot(ax, az) : Math.hypot(ax, ay, az);
  return path > 1e-9 ? Math.min(1, net / path) : 0;
}

/**
 * 11 §5: "dominant frequency of vertical CoM oscillation, by zero-crossing count".
 *
 * DETRENDED FIRST, which the spec does not say and which decides the answer. The
 * vertical CoM in W1 is dominated by buoyant drift — a monotonic ramp — and a
 * signal that never returns to its own mean has zero crossings, so an
 * undetrended count reports 0 Hz for every creature in the corpus. The trend is
 * removed as a straight line between the window's endpoints, leaving the
 * oscillation about it.
 */
export function gaitFrequency(trace, from, to) {
  const n = to - from;
  if (n < 4) return 0;
  const y0 = trace.com[from * 3 + 1];
  const y1 = trace.com[(to - 1) * 3 + 1];
  const span = trace.t[to - 1] - trace.t[from];
  if (!(span > 0)) return 0;

  let crossings = 0, prev = 0;
  for (let i = from; i < to; i++) {
    const f = (trace.t[i] - trace.t[from]) / span;
    const d = trace.com[i * 3 + 1] - (y0 + (y1 - y0) * f);
    if (i > from && ((prev < 0 && d >= 0) || (prev > 0 && d <= 0))) crossings++;
    prev = d;
  }
  // Two zero crossings per cycle.
  return crossings / (2 * span);
}

/** Mean angular rate over [from, to), rad/s, from an unwrapped heading series. */
export function meanTurnRate(trace, from, to, scratch) {
  if (to - from < 2) return 0;
  const u = scratch && scratch.length >= trace.n ? scratch : new Float64Array(trace.n);
  unwrap(trace.heading, trace.n, u);
  const dt = trace.t[to - 1] - trace.t[from];
  return dt > 0 ? (u[to - 1] - u[from]) / dt : 0;
}
