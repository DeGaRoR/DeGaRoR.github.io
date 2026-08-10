// engine/l2/probes.js — S1 morphometrics, S2 locomotion, S3 turning (11 §5).
//
// PURITY: as probe.js. Rapier injected, no clock, no rng that is not derived.
//
// 30 §5 C1 delivers three probes and is explicit that S3 is not optional:
// "D1 clamps all steering by measured turnRate and N21 makes that a
// non-negotiable — it is the primary carrier of physical identity into L3."
//
// S4 pursuit and S5 evasion are DEFERRED (30 §5 C1). The slice reads
// pursuitGain / evasionGain from w1_slice.js as explicit fixture defaults,
// flagged unmeasured on the developer panel.

import { qrot } from '../l1/vecmath.js';
import { totalMass, bodyVolume, boundingRadius, centreOfMass } from '../l1/morphogen.js';
import {
  turn3d,
  runSolo, indexAt, meanSpeed, meanPower, straightness, gaitFrequency, meanTurnRate,
  comSpeed, netSpeed,
  SAMPLE_HZ, INVALID,
} from './probe.js';

// ─────────────────────────────────────────────────────────────────────────────
// Probe constants. Every one of these is an input to a measurement: moving any
// of them changes what every stored record means and MUST bump BRIDGE_V.
// ─────────────────────────────────────────────────────────────────────────────

/** 11 §5 S2: "a global multiplier on omega: 0.6, 1.0, 1.5". */
export const EFFORTS = [0.6, 1.0, 1.5];

/** 11 §5 S2: "12 s each, measure over the final 8 s". */
export const S2_DURATION = 12.0;
export const S2_WINDOW = 8.0;

/** 11 §5 S3: 8 s. */
export const S3_DURATION = 8.0;

/**
 * The differential bias S3 applies, in units of TURN_AUTHORITY (controller.js):
 * 1.0 is a fully saturated steering input. S3 measures the RESPONSE to it, so
 * this is a stimulus amplitude and not a fitted constant.
 */
export const S3_BIAS = 1.0;

/**
 * ── THE BIAS SWEEP, AND WHY ONE POINT WAS NOT ENOUGH (Phase 3, 2026-08-10) ────
 *
 * S3 measured the turn at `turnBias = +-1.0` only, and at `TURN_AUTHORITY = 1.0`
 * that commands a differential offset of a FULL joint range on top of a gait
 * whose amplitude is already p50 0.69 of that range. `targetAngles` therefore
 * asks for an angle outside the joint's own limits; the joint pins against
 * `setLimits`, the stroke rectifies, and thrust collapses. The response is not
 * monotone in the command, and one point cannot see that:
 *
 *     creature        w @ 0.2   w @ 0.5   w @ 1.0    best radius       measured at 1.0
 *     eel-fast        6.18      8.88      1.25       2.11 cm @ 0.5     35.01 cm
 *     eel-unison      2.97     11.09     16.27       0.78 cm @ 1.0      1.80 cm
 *     snarlback-teal 12.67     24.10     31.33       0.32 cm @ 1.0      5.73 cm
 *     eel / eel-finned   —      2.11      ~0         ~1.1-1.3 cm       INFINITE
 *
 * `eel` and `eel-finned` reported `turnRate3d * steeringAuthority = 0.000` and an
 * infinite radius — and they are the two BEST goal-reachers in the library when
 * measured behaviourally (`tools/_zgoal.mjs`: +0.65 and +0.67 control-subtracted
 * closure, arriving in 4 of 6 directions). The field was not describing a body
 * that cannot turn. It was describing a body being asked the one question it
 * cannot answer.
 *
 * So the probe sweeps, and reports at the creature's OWN best operating point.
 * `bestBias` is a measured phenotype in exactly the sense `turnRadius` is — the
 * differential bend at which this body turns tightest — not a tuned constant and
 * not something the creature is told.
 *
 * COST: five points instead of one, so ten 8 s runs instead of two, against a
 * compile already budgeted at ~700 s. A caller that only wants the steering
 * PLANE, and does not need the capability numbers, passes `biases: [S3_BIAS]`
 * and gets today's arithmetic back unchanged.
 */
export const S3_BIASES = [0.2, 0.35, 0.5, 0.75, 1.0];

/** 64 rays, 11 §5 S1's own number. */
export const TORSO_RAYS = 64;

// ─────────────────────────────────────────────────────────────────────────────
// SOLO PROBE CONDITIONS — an amendment to 11 §5, and the measurement is the
// argument for it.
//
// 11 §5 runs the solo battery in the world the record is stamped for, which for
// W1 means gravity 9.81 inside a 16x24x16 tank. Measured over 20 viable
// creatures, that choice does not merely rescale the answer — IT REORDERS THE
// CORPUS. Spearman between horizontal cruise speed measured in the tank and the
// same measured at gravity zero: **-0.06**. The two measurements disagree about
// which creature is faster, completely.
//
// The reason is visible in the traces. Most creatures are not neutrally buoyant
// (02 §7's density range 0.15-1.8 against mediumDensity 1.0), so within about
// two seconds they pin against the surface or the floor and spend the measured
// window sliding along it. What is then measured is buoyancy and wall friction —
// where the creature happened to drift — not swimming. That is a boundary
// artefact, and it is why the ordering carries no information.
//
// So the solo battery measures at GRAVITY ZERO, UNBOUNDED: the creature alone
// with the medium, where displacement is locomotion and nothing else. There is
// precedent in this codebase and it was reached the same way — viability.js
// measures inertness at gravity zero for exactly this reason, and B3's
// locomotion diagnostic does too.
//
// Three things this does NOT do, stated so the amendment is not read wider than
// it is:
//   - It does not change the world. `worldHash` still says 9.81 and the record
//     is still stamped for W1. Probe conditions are part of the BRIDGE, which
//     is what BRIDGE_V versions (01 §8: "bumps on any probe, reduction or duel
//     rule change").
//   - It does not apply to DUELS. A duel needs the tank: two creatures have to
//     stay in one volume and be able to reach each other, and the walls are what
//     makes an engagement an engagement rather than a divergence.
//   - It does not claim gravity is irrelevant to L3. L3's world is a flat torus
//     with no vertical dimension at all, so a horizontal free-swimming speed is
//     the closer predictor of motion there than a wall-sliding one.
// ─────────────────────────────────────────────────────────────────────────────

export const SOLO_GRAVITY = 0;
export const SOLO_BOUNDED = false;

/**
 * Relative spread below which three operating points count as one — 11 §11's
 * "efforts produce indistinguishable speeds", made a number.
 */
export const MIN_EFFORT_SPREAD = 0.1;

/** Effort index of the cruise run, for readers. */
const CRUISE = 1;

// ─────────────────────────────────────────────────────────────────────────────
// S1 · Morphometrics — no simulation. Free.
// ─────────────────────────────────────────────────────────────────────────────

/** The 8 corners of a body's box, in world space. */
function corners(b, out) {
  const [hx, hy, hz] = [b.dims[0] / 2, b.dims[1] / 2, b.dims[2] / 2];
  let k = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const p = qrot(b.rotation, [sx * hx, sy * hy, sz * hz]);
    out[k][0] = b.position[0] + p[0];
    out[k][1] = b.position[1] + p[1];
    out[k][2] = b.position[2] + p[2];
    k++;
  }
  return out;
}

const cornerBuf = () => Array.from({ length: 8 }, () => [0, 0, 0]);

/**
 * Ray vs oriented box, slab method in the box's own frame.
 * @returns {number|null} distance along `dir` to the near face, or null
 */
export function rayObb(origin, dir, box) {
  // Into box space: translate, then rotate by the conjugate.
  const q = box.rotation;
  const conj = [-q[0], -q[1], -q[2], q[3]];
  const o = qrot(conj, [origin[0] - box.position[0], origin[1] - box.position[1], origin[2] - box.position[2]]);
  const d = qrot(conj, dir);
  const h = [box.dims[0] / 2, box.dims[1] / 2, box.dims[2] / 2];

  let tmin = -Infinity, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-12) {
      if (o[i] < -h[i] || o[i] > h[i]) return null;      // parallel and outside
      continue;
    }
    const inv = 1 / d[i];
    let t1 = (-h[i] - o[i]) * inv;
    let t2 = (h[i] - o[i]) * inv;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return tmax < 0 ? null : Math.max(tmin, 0);
}

/**
 * 64 directions spread evenly over the sphere — the Fibonacci lattice, which is
 * deterministic and needs no rng, and is far more even than latitude/longitude
 * bands (which cluster hard at the poles and would let a limb on the +Y face
 * occlude a disproportionate share of the count).
 */
export function fibonacciDirections(n = TORSO_RAYS) {
  const dirs = new Array(n);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * i + 1) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    dirs[i] = [Math.cos(th) * r, y, Math.sin(th) * r];
  }
  return dirs;
}

/**
 * S1 · Morphometrics. Read directly from the body plan (11 §5 S1).
 *
 * `torsoExposure` is "the cheap geometric half of defence": capture is contact
 * with the ROOT body (10 §7, 11 §5), modelling a weak point that morphology can
 * evolve to protect, so a well-shielded root is measurably harder to reach.
 * Rays leave the root's own surface outward; a direction counts as occluded if
 * any NON-root body lies across it.
 */
export function S1(plan) {
  const root = plan.bodies[0];
  const mass = totalMass(plan);

  let volume = 0, harvestArea = 0, frontalArea = 0;
  const buf = cornerBuf();

  // Forward is the root's local +Z — the axis every child attaches along.
  const fwd = qrot(root.rotation, [0, 0, 1]);

  for (const b of plan.bodies) {
    volume += bodyVolume(b);

    // SUM OF BOX SURFACES, and it over-counts where limbs meet: the faces that
    // are buried in a parent are still added. 11 §5 says "sum of exposed body
    // surface" without saying how to exclude the buried part, and the honest
    // exclusion needs a mesh boolean this build has no reason to carry. The
    // over-count is systematic rather than random — it scales with joint count
    // — so it shifts harvest rate for many-limbed creatures. Recorded as a
    // spec gap rather than silently approximated.
    harvestArea += 2 * (b.dims[0] * b.dims[1] + b.dims[1] * b.dims[2] + b.dims[2] * b.dims[0]);

    // Projected area of a box on a direction: each face area weighted by its
    // normal's alignment. Identical to the drag model in physics.js, so the two
    // cannot drift — and it over-counts overlapping bodies for the same reason
    // the drag model does, which at least makes them wrong in agreement.
    const conj = [-b.rotation[0], -b.rotation[1], -b.rotation[2], b.rotation[3]];
    const v = qrot(conj, fwd);
    frontalArea += Math.abs(v[0]) * b.dims[1] * b.dims[2]
                 + Math.abs(v[1]) * b.dims[0] * b.dims[2]
                 + Math.abs(v[2]) * b.dims[0] * b.dims[1];
  }

  // reach — 11 §5: "max distance from ROOT BODY CENTRE to any extremity".
  // Not from the centre of mass: 03 §4 builds engagementRadius out of it and a
  // duel opens at a separation between root bodies, so the root is the origin
  // the number has to be measured from.
  let reach = 0;
  const pts = [];
  for (const b of plan.bodies) {
    corners(b, buf);
    for (const c of buf) {
      reach = Math.max(reach, Math.hypot(
        c[0] - root.position[0], c[1] - root.position[1], c[2] - root.position[2]));
      pts.push([c[0], c[1], c[2]]);
    }
  }

  return {
    massBase: mass,
    volume,
    boundingRadius: boundingRadius(plan),
    longestAxis: principalExtent(pts),
    frontalArea,
    harvestArea,
    reach,
    torsoExposure: torsoExposure(plan),
    bodyCount: plan.bodyCount,
    jointCount: plan.jointCount,
    dofCount: plan.dofCount,
  };
}

/**
 * Extent along the principal axis of the point cloud — 11 §5's "principal axis
 * extent". Power iteration on the covariance, which converges in a handful of
 * steps for a 3x3 and needs no eigen solver. Deterministic: the start vector is
 * fixed, never drawn.
 */
export function principalExtent(pts) {
  const n = pts.length;
  if (n === 0) return 0;
  const c = [0, 0, 0];
  for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  c[0] /= n; c[1] /= n; c[2] /= n;

  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) {
    const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d[i] * d[j];
  }

  // A fixed, non-axis-aligned start so a body whose spread lies exactly on an
  // axis is not started orthogonal to its own answer.
  let v = [0.5773502691896258, 0.5773502691896258, 0.5773502691896258];
  for (let it = 0; it < 32; it++) {
    const w = [
      cov[0][0] * v[0] + cov[0][1] * v[1] + cov[0][2] * v[2],
      cov[1][0] * v[0] + cov[1][1] * v[1] + cov[1][2] * v[2],
      cov[2][0] * v[0] + cov[2][1] * v[1] + cov[2][2] * v[2],
    ];
    const m = Math.hypot(w[0], w[1], w[2]);
    if (!(m > 1e-15)) break;                 // degenerate cloud: a single point
    v = [w[0] / m, w[1] / m, w[2] / m];
  }

  let lo = Infinity, hi = -Infinity;
  for (const p of pts) {
    const t = p[0] * v[0] + p[1] * v[1] + p[2] * v[2];
    if (t < lo) lo = t;
    if (t > hi) hi = t;
  }
  return hi - lo;
}

/** Fraction of the root body's solid angle not occluded by other bodies. */
export function torsoExposure(plan) {
  const root = plan.bodies[0];
  const dirs = fibonacciDirections();
  const others = plan.bodies.slice(1);
  if (others.length === 0) return 1;

  let clear = 0;
  for (const d of dirs) {
    // Leave the root's own surface first, or the root occludes every direction.
    // The origin is the root's centre, which is INSIDE the box, so the useful
    // distance is where the ray exits — the far slab, not the near one.
    const far = farExit(root.position, d, root);
    const o = [
      root.position[0] + d[0] * (far + 1e-4),
      root.position[1] + d[1] * (far + 1e-4),
      root.position[2] + d[2] * (far + 1e-4),
    ];
    let blocked = false;
    for (const b of others) {
      if (rayObb(o, d, b) !== null) { blocked = true; break; }
    }
    if (!blocked) clear++;
  }
  return clear / dirs.length;
}

/** Distance from an interior point to where the ray leaves the box. */
function farExit(origin, dir, box) {
  const q = box.rotation;
  const conj = [-q[0], -q[1], -q[2], q[3]];
  const o = qrot(conj, [origin[0] - box.position[0], origin[1] - box.position[1], origin[2] - box.position[2]]);
  const d = qrot(conj, dir);
  const h = [box.dims[0] / 2, box.dims[1] / 2, box.dims[2] / 2];
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-12) continue;
    const inv = 1 / d[i];
    const t1 = (-h[i] - o[i]) * inv, t2 = (h[i] - o[i]) * inv;
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  return Number.isFinite(tmax) ? Math.max(0, tmax) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// S2 · Locomotion — three efforts, one curve
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Least squares for power(v) = c0*v + c1*v^3 over three points (11 §5 S2).
 * "Physically motivated: drag force proportional to v^2, power = force x
 * velocity proportional to v^3, with a linear term for internal losses."
 *
 * Two unknowns, three points, normal equations. 11 §11's degenerate case —
 * "efforts produce indistinguishable speeds" — leaves the 2x2 singular, and the
 * documented fallback is c0 = power/v, c1 = 0.
 */
export function fitPower(vs, ps) {
  // 11 §11's degenerate case is "efforts produce INDISTINGUISHABLE SPEEDS", and
  // that is a statement about the operating points, not about a determinant.
  // The first version of this function tested `det`, which is the wrong test
  // twice over: three nearly-coincident points still give a non-singular 2x2
  // with catastrophic conditioning, so it reported 0 degenerate fits over a
  // corpus where the power spread was 7%. Tested on the RELATIVE spread of both
  // axes instead, because a fit of power against speed is degenerate if EITHER
  // collapses — constant power over varying speed is as uninformative as
  // varying power over constant speed.
  const spread = (a) => {
    let lo = Infinity, hi = -Infinity, s = 0;
    for (const x of a) { lo = Math.min(lo, x); hi = Math.max(hi, x); s += x; }
    const mean = s / a.length;
    return mean > 1e-12 ? (hi - lo) / mean : 0;
  };
  const indistinguishable =
    spread(vs) < MIN_EFFORT_SPREAD || spread(ps) < MIN_EFFORT_SPREAD;

  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < vs.length; i++) {
    const v = vs[i], v3 = v * v * v;
    a11 += v * v; a12 += v * v3; a22 += v3 * v3;
    b1 += v * ps[i]; b2 += v3 * ps[i];
  }
  const det = a11 * a22 - a12 * a12;

  // The scale of the determinant is a11*a22, so the singularity test has to be
  // RELATIVE or it fires on unit choice rather than on rank. Creatures in this
  // corpus move at ~0.2 m/s, where v^6 is 6e-5 and an absolute epsilon would
  // call every healthy fit singular.
  const singular = !(Math.abs(det) > 1e-9 * Math.max(1e-30, a11 * a22));

  if (indistinguishable || singular) {
    // 11 §11's documented fallback: c0 = power/v, c1 = 0. A constant cost of
    // transport, which is at least a real ratio the creature exhibited.
    const i = vs.length - 1;
    const c0 = vs[i] > 1e-9 ? ps[i] / vs[i] : 0;
    return { cotC0: c0, cotC1: 0, degenerate: true };
  }
  return {
    cotC0: (b1 * a22 - b2 * a12) / det,
    cotC1: (a11 * b2 - a12 * b1) / det,
    degenerate: false,
  };
}

/**
 * S2 · Locomotion. Three runs, one fit (11 §5 S2).
 *
 * @returns measured fields + `runs` for diagnostics
 */
export function S2(RAPIER, { plan, genome, world, gravity, bounded }) {
  const g = gravity ?? SOLO_GRAVITY;
  const b = bounded ?? SOLO_BOUNDED;
  const runs = [];
  for (const effort of EFFORTS) {
    const r = runSolo(RAPIER, { plan, genome, world, gravity: g, bounded: b, duration: S2_DURATION, effort });
    if (!r.valid) return { valid: false, reason: r.reason, runs };
    const from = indexAt(r.trace, S2_DURATION - S2_WINDOW);
    const to = r.trace.n;
    runs.push({
      effort,
      speed: meanSpeed(r.trace, from, to),
      speed3d: meanSpeed(r.trace, from, to, false),
      power: meanPower(r.trace, from, to),
      straightness: straightness(r.trace, from, to),
      comSpeed: comSpeed(r.trace, from, to),
      netSpeed: netSpeed(r.trace, from, to),
      gaitFrequency: gaitFrequency(r.trace, from, to),
      trace: r.trace,
      mass: r.mass,
    });
  }

  const cruiseSpeed = runs[CRUISE].speed;
  const burstSpeed = runs[2].speed;
  const fit = fitPower(runs.map(r => r.speed), runs.map(r => r.power));

  // burstDuration — 03 §3 declares it "MEASURED IN S2".
  //
  // SPEC DEFECT, and it cannot be measured as specified. "s at burstSpeed before
  // dropping to cruise" describes fatigue, and S2 runs a CONSTANT effort against
  // a controller with no energy budget, so nothing in the model can make the
  // creature slow down. What is measured here is the honest remainder: the
  // length of the first contiguous stretch of the burst run in which
  // instantaneous speed stays at or above cruiseSpeed. It saturates at the
  // window length for any creature that reaches burst at all, which is most of
  // them, and the gate reports the saturating fraction so the emptiness of the
  // number is visible rather than inferred.
  const bFrom = indexAt(runs[2].trace, S2_DURATION - S2_WINDOW);
  const burstDuration = sustainedAbove(runs[2].trace, bFrom, runs[2].trace.n, cruiseSpeed);

  // basalRate — "power at effort 0, extrapolated, floored at KLEIBER x mass^0.75".
  //
  // SPEC DEFECT: 11 §5 uses KLEIBER as the COEFFICIENT, but 03 §5 defines
  // KLEIBER 0.75 as the EXPONENT ("basalRate proportional to mass^KLEIBER") and
  // METABOLIC_SCALE 0.02 as the coefficient ("W per kg^0.75"). Written 11's way
  // the floor would be 0.75 x mass^0.75, 37x too large and dimensionally
  // meaningless. 03 wins, as it does everywhere the two disagree.
  //
  // The extrapolation itself is always zero — power(0) = c0*0 + c1*0 — so the
  // floor is the value in every case. Kept as max() rather than collapsed,
  // because a fit with a constant term would make it live again.
  const mass = runs[0].mass;
  const floor = world.METABOLIC_SCALE * Math.pow(mass, world.KLEIBER);
  const basalRate = Math.max(0, floor);

  return {
    valid: true,
    reason: null,
    cruiseSpeed,
    burstSpeed,
    burstRatio: cruiseSpeed > 1e-9 ? burstSpeed / cruiseSpeed : 0,
    burstDuration,
    cotC0: fit.cotC0,
    cotC1: fit.cotC1,
    basalRate,
    // ── what the selection screen shows, and why there are three numbers ─────
    //
    // cruiseSpeed is the mean of |v| — how fast the BODY is moving. comSpeed is
    // the same thing measured along the path. netSpeed is how fast the creature
    // actually TRAVELS. For a swimmer all three converge; for a thrasher the
    // first two stay high while the third collapses, and efficiency is exactly
    // their ratio. Showing only cruiseSpeed is what made a vibrating creature
    // look like a fast one.
    comSpeed: runs[CRUISE].comSpeed,
    netSpeed: runs[CRUISE].netSpeed,
    efficiency: runs[CRUISE].straightness,
    straightness: runs[CRUISE].straightness,
    gaitFrequency: runs[CRUISE].gaitFrequency,
    degenerateFit: fit.degenerate,
    burstSaturated: burstDuration >= S2_WINDOW - 1 / SAMPLE_HZ,
    runs,
  };
}

/** Length of the first contiguous stretch in [from,to) with speed >= threshold. */
function sustainedAbove(trace, from, to, threshold) {
  let best = 0, start = -1;
  for (let i = from; i < to; i++) {
    const v = Math.hypot(trace.vel[i * 3], trace.vel[i * 3 + 2]);
    if (v >= threshold) {
      if (start < 0) start = i;
      best = Math.max(best, trace.t[i] - trace.t[start]);
    } else {
      if (start >= 0) return best;      // FIRST stretch, not the longest
      start = -1;
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3 · Turning — REQUIRED (30 §5 C1, N21)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * S3 · Turning.
 *
 * DEVIATION FROM 11 §5, and it is the difference between measuring the creature
 * and measuring its resting posture. The spec runs ONE 8 s trial with a constant
 * bias and reads `turnRate` as the mean d(heading)/dt. But a body with an
 * asymmetric rest pose already circles with no input at all — a bias gene on one
 * side, an odd limb, a single mirrored fin — and that trial cannot tell a
 * circling creature from a steerable one. It would hand L3 a large turnRate for
 * an animal that cannot choose a direction, and N21 clamps steering by exactly
 * this number.
 *
 * So the bias is applied in BOTH directions, 8 s each, and turnRate is half the
 * difference between the two mean rates. Intrinsic curl is common to both runs
 * and cancels; what survives is the creature's response to the control input,
 * which is what steering authority means. `intrinsicRate` — the half-SUM — is
 * returned alongside, unrecorded but reported, because a strong curl is a real
 * property and should be visible rather than merely subtracted away.
 *
 * Cost is one extra 8 s run, against a compile already budgeted at ~700 s.
 */
export function S3(RAPIER, { plan, genome, world, gravity, bounded, cruiseSpeed, biases = S3_BIASES }) {
  /** One bias amplitude, both directions, differenced. The old body of S3. */
  const atBias = (bias) => {
    const out = [];
    for (const sign of [+1, -1]) {
      const r = runSolo(RAPIER, {
        plan, genome, world,
        gravity: gravity ?? SOLO_GRAVITY,
        bounded: bounded ?? SOLO_BOUNDED,
        duration: S3_DURATION, turnBias: sign * bias,
      });
      if (!r.valid) return null;
      const scratch = new Float64Array(r.trace.n);
      const t3 = turn3d(r.trace, 0, r.trace.n);
      out.push({
        rate: meanTurnRate(r.trace, 0, r.trace.n, scratch),
        speed: meanSpeed(r.trace, 0, r.trace.n),
        rate3d: t3.rate, headingVec: t3.headingVec, axis3d: t3.axis, localAxis: t3.localAxis,
      });
    }
    const dHead = [0, 1, 2].map((i) => out[0].headingVec[i] - out[1].headingVec[i]);
    const rate3d = Math.hypot(...dHead) / 2;
    const speed = (out[0].speed + out[1].speed) / 2;
    return {
      bias, out, rate3d, speed,
      // THE QUANTITY THE SWEEP IS FOR. Radius from the speed and the turn rate
      // MEASURED AT THE SAME BIAS. The shipped `turnRadius` divided the STRAIGHT
      // cruise speed by the turn rate at full bias — two different operating
      // points — and creatures travel at 0.26-0.55x cruise while turning.
      radius: rate3d > 1e-9 ? speed / rate3d : Infinity,
    };
  };

  const swept = [];
  for (const b of biases) { const s = atBias(b); if (s) swept.push(s); }
  if (!swept.length) return { valid: false, reason: INVALID.UNSTABLE };

  // The creature's own best steering point: the bias at which its turning circle
  // is tightest. Ties and all-infinite cases fall to the largest bias tried,
  // which is the pre-sweep behaviour and the honest default for a body that does
  // not turn at any command.
  let best = swept[swept.length - 1];
  for (const s of swept) if (s.radius < best.radius) best = s;
  const at1 = swept.find((s) => s.bias === S3_BIAS) ?? swept[swept.length - 1];

  const out = best.out;
  const turnRate = Math.abs(out[0].rate - out[1].rate) / 2;
  const intrinsicRate = (out[0].rate + out[1].rate) / 2;

  // The same both-directions differencing applied to the 3-D turn and to the
  // ROTATION AXIS. `turnRate` above is the yaw component and reads near-zero for
  // a body that turns in pitch; `turnRate3d` is the turn in whatever plane it
  // happens in. `steeringAuthority` is the axis reversal — 1 means the two bias
  // directions turn the creature in exactly opposite senses (clean steering),
  // 0 means the input does not change which way it curls WHATEVER THE RATE SAYS.
  // A creature can have a large turn rate and zero authority; that is precisely
  // the confusion this probe's both-directions design prevents for the rate and
  // left unfixed for the axis.
  //
  // C0.1: difference the heading rate AS A VECTOR, not as a magnitude. The old
  // `|rate3d_+ - rate3d_-|/2` subtracted two magnitudes, so a creature that turns
  // hard LEFT under +bias and hard RIGHT under -bias — clean steering — cancelled
  // to zero. The vector difference of the two angular-velocity vectors adds the
  // opposite turns and cancels the shared drift, which is the coherent steering
  // response the diagnosis measures (0.12 deg/s shipped, ~4.6 normalised).
  const dHead = [0, 1, 2].map((i) => out[0].headingVec[i] - out[1].headingVec[i]);
  const turnRate3d = Math.hypot(...dHead) / 2;

  // ── THE STEERING PLANE — B2 §5 ──────────────────────────────────────────────
  //
  // The plane normal in the ROOT'S LOCAL FRAME, differenced across the two bias
  // directions exactly as the rate is. Differencing is the point: a creature
  // curls one way under +bias and the other way under -bias, so the DIFFERENCE
  // isolates the axis the input controls and cancels whatever the body was doing
  // on its own. Taking one direction's axis would record the creature's
  // intrinsic drift as its steering plane.
  //
  // §5's finding is that `bearingTo` measured a compass bearing — atan2(fx, fz),
  // the horizontal plane — while `turnBias` actuates whatever plane the joints
  // bend in. "The sensor measures one plane and turnBias actuates another, so
  // the control loop has never been closed. Not poorly closed — open, by
  // construction, in the coordinate convention." This is the quantity that
  // closes it, and it has to be MEASURED per creature: a chain of revolute
  // joints about local X turns in its local YZ plane, which is vertical, and no
  // convention chosen in advance gets that right for every body plan.
  //
  // ── THE PLANE STAYS AT FULL BIAS WHILE THE RATES MOVE TO bestBias ──────────
  //
  // The sweep does NOT relocate this measurement, and that is deliberate rather
  // than an oversight. The plane and the rate are different kinds of quantity
  // and they are best determined at different commands: the AXIS is cleanest
  // where the curl is largest, because the differenced local axis is what curl
  // expresses, while the RATE is best where the gait still runs.
  //
  // It is also the conservative choice. Everything measured against a steering
  // plane in this project — BRIDGE_V 7's records, the Vivarium beacon, the
  // `_zgoal` library baseline, the selection runs — used the full-bias plane, and
  // `_zgoal` PLACES ITS TARGETS in this plane as well as sensing through it. So
  // moving it does not refine a number, it changes the experiment.
  //
  // Measured, once, and it is why this is written down rather than assumed: two
  // selection winners re-scored with the bestBias plane instead of the full-bias
  // one came out at 0.219 against 0.508 and 0.217 against 0.234. That is n = 2
  // and it points the wrong way for moving it, which is not enough to move it on
  // and is enough not to move it silently. An honest test needs the n >= 15 this
  // session's own standing rule asks for, and it is a separate experiment.
  const dLocal = [0, 1, 2].map((i) => at1.out[0].localAxis[i] - at1.out[1].localAxis[i]);
  const dl = Math.hypot(...dLocal);
  // Falls back to world up — the horizontal plane, i.e. exactly the old compass
  // behaviour — when the two directions do not disagree. That is the honest
  // default: a creature with no measurable steering plane has no plane to use,
  // and steeringAuthority is the field that says so.
  const turnPlane = dl > 1e-6 ? dLocal.map(v => v / dl) : [0, 1, 0];
  const dAxis = [0, 1, 2].map((i) => at1.out[0].axis3d[i] - at1.out[1].axis3d[i]);
  const steeringAuthority = Math.min(1, Math.hypot(...dAxis) / 2);
  const turnSpeed = (out[0].speed + out[1].speed) / 2;

  // ── turnRadius, AND THE OPERATING POINT IT IS TAKEN AT ──────────────────────
  //
  // This was `cruiseSpeed / turnRate`, which mixes two different states: the
  // STRAIGHT-LINE cruise speed over the yaw turn rate under a saturated bias.
  // Measured, creatures travel at 0.26-0.55x cruise while holding a turn, so the
  // radius was overstated by roughly that factor for anything that steers, and
  // it used the yaw component, which reads near-zero for a body that turns in
  // pitch.
  //
  // Both are taken at `bestBias` now and from the same run: the mean speed and
  // the 3-D heading rate the creature actually had while turning. A creature
  // that does not turn at any swept bias still has an infinite radius, which is
  // true and unstorable — `Float32Array(Infinity)` is Infinity and
  // `validateSpecies` rejects it — so it is still capped at the tank diagonal.
  const tankDiagonal = Math.hypot(...world.tankBounds);
  const turnRadius = Number.isFinite(best.radius)
    ? Math.min(best.radius, tankDiagonal)
    : tankDiagonal;

  return {
    valid: true,
    reason: null,
    turnRate,
    turnRate3d,
    steeringAuthority,
    turnPlaneX: turnPlane[0], turnPlaneY: turnPlane[1], turnPlaneZ: turnPlane[2],
    turnRadius,
    turnSpeedRatio: cruiseSpeed > 1e-9 ? Math.min(4, turnSpeed / cruiseSpeed) : 0,
    intrinsicRate,
    /** The bias this creature turns tightest at. A measured phenotype (see S3_BIASES). */
    bestBias: best.bias,
    /**
     * The pre-sweep numbers, kept so every figure quoted before 2026-08-10 stays
     * auditable against the one that replaced it rather than silently changing
     * meaning. `turnRate3dAt1` is what `turnCapability` used to be built from.
     */
    turnRate3dAt1: at1.rate3d,
    turnRadiusAt1: Number.isFinite(at1.radius) ? Math.min(at1.radius, tankDiagonal) : tankDiagonal,
  };
}

export const PROBE_IDS = { S1: 'S1', S2: 'S2', S3: 'S3' };
export { INVALID };
