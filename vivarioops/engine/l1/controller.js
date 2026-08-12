// engine/l1/controller.js — the CPG (10 §A7).
//
// PURE: a function of (bodyPlan, genome, t). No rng, no clock — `t` is passed in
// as simulation time, so a controller state is reproducible from the tick index.
//
// Sims used evolved neural networks. They work and they produce twitchy motion.
// Coupled oscillators produce undulation, gait and travelling waves at a fraction
// of the complexity, which is the whole reason this is a CPG.

/**
 * PHASE PROPAGATION — the one detail that decides whether creatures look alive.
 *
 * A child joint's phase is its PARENT JOINT's phase plus a genetic lag, so a
 * chain of segments with a consistent lag produces a TRAVELLING WAVE: an eel
 * swimming, a centipede's metachronal gait, a ray's fin ripple. Independent
 * per-joint phases produce noise that reads as convulsion.
 *
 * Joints attached to the root body have phase 0 (10 §A7: "root joint phase = 0");
 * their own phaseLag is what their children inherit, not what they use.
 *
 * ── RESOLVED AT H10: the lag belongs to the PARENT joint. ────────────────────
 *
 * The alternative — `childPhase = parentPhase + childJoint.phaseLag` — is the
 * more conventional reading and was raised as a probable defect. It is not one.
 * It was weighed and rejected: it puts the root joint at its own lag rather than
 * zero, which contradicts 10 §A7 outright, and it moves the phase origin of the
 * whole animal whenever a single gene near the root mutates.
 *
 * TWO CONSEQUENCES, BOTH REAL, BOTH DELIBERATE:
 *
 *   1. A TERMINAL joint's phaseLag gene is inert — nothing inherits from it.
 *      Over the corpus that is a meaningful share of nodes, so this is one named
 *      contributor to the inert-mutation rate, and it belongs to the capability
 *      sets at H13 rather than being repaired here.
 *   2. All joints on the root body start at phase 0 together, so a symmetric
 *      pair of root limbs beats in phase and their thrust cancels. That remains
 *      a candidate explanation for why body plan barely affects locomotion. It
 *      is a question for the re-measurement at H11, and if it proves to be the
 *      cause the repair is to give mirrored limbs an antiphase offset — which is
 *      a statement about MIRRORING, where the asymmetry actually lives, not a
 *      reinterpretation of what a lag gene means.
 *
 * L1-20 pins this against a chain with DISTINCT lags, because a uniform lag
 * cannot tell the two interpretations apart.
 *
 * @returns {Float64Array} phase per joint, indexed by joint.index
 */
export function computePhases(plan) {
  const phases = new Float64Array(plan.jointCount);
  // Joint feeding each body, so a joint can find its parent joint.
  const jointOfBody = new Int32Array(plan.bodyCount).fill(-1);
  for (const j of plan.joints) jointOfBody[j.childBody] = j.index;

  // plan.joints is already in breadth-first order, so a parent joint is always
  // resolved before its children. No sort, no second pass.
  for (const j of plan.joints) {
    const parentJoint = jointOfBody[j.parentBody];
    phases[j.index] = parentJoint < 0 ? 0 : phases[parentJoint] + plan.joints[parentJoint].phaseLag;
  }
  return phases;
}

/** The driven angular range of a joint, per driven axis. */
export function jointRange(plan, jointIndex, axis = 0) {
  return plan.joints[jointIndex].angleLimits[axis];
}

// ─────────────────────────────────────────────────────────────────────────────
// C1 · THE STEERING SENSOR — 11 §10, the amendment L2 cannot exist without.
//
// "As specified, the L1 controller is a pure oscillator with an empty sensor
// vector. Such a creature cannot steer toward or away from anything. It
// therefore cannot pursue, cannot evade, and cannot meaningfully duel — two
// creatures would simply follow their gaits and collide by accident."
//
// The genes have been present and dormant since B1 (GENOME_V 2). This is the
// one line that reads them, plus the two pieces of bookkeeping it needs.
//
// EVERYTHING HERE IS INERT AT turnBias 0. `targetAngles` adds nothing when the
// bias is zero, so B3's and B4's numbers are unchanged to the bit — which is
// the point: C1 must not move a tank the player is currently looking at.
// ─────────────────────────────────────────────────────────────────────────────

const clamp1 = (x) => (x < -1 ? -1 : x > 1 ? 1 : x);

/**
 * DECISION, unstated in either document. 11 §10 gives `turnBias` as a raw sum of
 * gene x bearing, both in [-1, 1], so it lands in [-2, 2] — radians, against
 * joint ranges whose maximum is PI/2. Applied raw it would saturate every joint
 * against its limit at any bearing worth steering by, so the creature would have
 * two states rather than a steering response, and S3 would measure the limit
 * rather than the body.
 *
 * So the bias is expressed the way `amplitude` already is: as a FRACTION OF THE
 * JOINT'S OWN ANGULAR RANGE. `TURN_AUTHORITY` is the deflection commanded at
 * full input, and the input is clamped to [-1, 1] first. 0.5 means a saturated
 * sensor asks for half the joint's range of differential deflection, leaving the
 * other half for the gait — the oscillation and the steering share the joint
 * rather than one erasing the other.
 *
 * It is a control-input amplitude, not a fitted constant: S3 measures the
 * creature's RESPONSE to it, so a change here rescales `turnRate` for every
 * creature and largely preserves their ordering. BRIDGE_V must bump if it
 * moves, because every compiled record would be measured against a different
 * input.
 *
 * SET TO 1.0 — full range — and the value is chosen from measurement rather
 * than taste. Swept over the viable corpus at 0.25 / 0.50 / 1.00, the median
 * response was x1.00 / x2.05 / x3.38: mildly saturating but close enough to
 * linear that the constant is nearly a pure scale (Spearman 0.74 between the
 * orderings at 0.25 and 1.00). Given that, the value that makes `turnRate`
 * MEAN something is the largest one: at full authority the number is "the
 * fastest this creature can turn when asked as hard as the mechanism can ask",
 * which is the capability N21 clamps L3 steering against. At any smaller value
 * it would be a response to an arbitrary poke.
 */
export const TURN_AUTHORITY = 1.0;

/** 11 §10: `turnBias = preyGain * preyBearing + threatGain * threatBearing`. */
export function sensorTurnBias(genome, preyBearing, threatBearing) {
  return clamp1(genome.controller.preyGain * preyBearing
              + genome.controller.threatGain * threatBearing);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4.3 · THE SECOND STEERING OUTPUT — and the reason there has to be one.
//
// Until now the whole nervous system was ONE NUMBER. `turnBias` is a scalar, so
// whatever the body is capable of, the only postures a controller can command
// are a one-dimensional family: bend this way, or bend exactly the opposite way.
// That is why `turnPlane` is a single measured vector and why `steeringAuthority`
// asks only whether the two signs reverse. THE PLANE WAS THE CONTROLLER'S, NOT
// ALWAYS THE BODY'S.
//
// Measured over the library — spread of joint axes, normalised eigenvalues of
// their covariance:
//
//     eel, eel-fast, eel-slow, eel-unison, eel-finned   1.000 / 0.000 / 0.000
//     stumbler-striped                                  1.000 / 0.000 / 0.000
//     snarlback-teal                                    0.992 / 0.008 / 0.000
//     protea                                            0.737 / 0.203 / 0.060
//     spokebeast-banded                                 0.754 / 0.174 / 0.072
//
// The eels are genuinely planar: `seeds.js` chains parallel revolute hinges, and
// no command could ever bend one sideways. But `spokebeast-banded` and `protea`
// have joint axes spanning all three dimensions — bodies that CAN bend in more
// than one plane, which nothing could tell them to do. That is the gap this
// closes, and it is a controller gap.
//
// IT IS EXACTLY ZERO ON A SINGLE-PLANE BODY, by construction rather than by a
// threshold: the weights are the projection of each joint's axis onto the SECOND
// principal axis of the body's own axis spread, and for a body whose hinges are
// all parallel that residual is the zero vector and there is no second axis to
// find. An eel is therefore bit-identical, not approximately unchanged.
// ─────────────────────────────────────────────────────────────────────────────

/** 11 §10's form, on the OUT-OF-PLANE component of the same bearing. */
export function sensorTurnBias2(genome, preyElev, threatElev) {
  return clamp1((genome.controller.preyGain2 ?? 0) * preyElev
              + (genome.controller.threatGain2 ?? 0) * threatElev);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4.3 · THE SECOND OUTPUT THE PLAN ASKED FOR — `effort`, not just steering.
//
// 11 §5 gives `effort` as "a global multiplier on omega" and the plan's Phase 4.3
// is "widen outputs — add `effort`". Until now the only thing that modulated it
// was the forage kinesis; a creature pursuing a target ran at full effort no
// matter how badly it was aimed.
//
// ── WHY IT READS |bearing| AND NOT DISTANCE ──────────────────────────────────
//
// The obvious brake is "slow down when you get close", and it is not available:
// `bearingTo` returns a BEARING and nothing in this project gives a creature a
// RANGE. Braking on distance would hand it a quantity it cannot perceive, which
// is the "omniscient compass" already on the debts list, made worse.
//
// It is also the half that does not work. Measured over four placements, closest
// approach in cm, brake on distance+bearing against brake on bearing alone:
//
//     creature                 none    dist+bearing    bearing only
//     spotted teal snarlback   3.56        1.36            1.49
//     Polypoda bitailus        7.24        5.47            5.45
//     glossy teal flapper      4.45        4.03            4.02
//     Very fast swimmer        1.41        4.47            2.02
//
// The distance term adds nothing to the three it helps and does most of the
// damage to the one it hurts. So the honest half and the effective half are the
// same half.
//
// ── AND IT IS A GENE, NOT A CONSTANT, BECAUSE THE RIGHT VALUE IS PER-LINEAGE ──
//
// Braking is a STRATEGY and the corpus wants opposite ones. Creatures whose
// closest approach comes in the first quarter of a trial — they pass by and leave
// — get much better with it (3.56 -> 1.49). Creatures still converging at 75% of
// the trial get much worse (1.41 -> 2.02, and 1.79 -> 6.73 with both terms),
// because braking slows a grind that was working. A global constant would fix
// half the library and break its two best pursuers.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lower bound on commanded effort. NOT a new constant: `engine/l2/forage.js` has
 * bounded its own effort output at 0.5 since Phase 2, and a second, different
 * floor for the same physical quantity — how far below its own gait a creature
 * may throttle — would be exactly the ungrounded coefficient standing rule 5
 * forbids. The brake measurements above were taken at 0.4; the effects are far
 * larger than 0.1 of floor, but they are worth re-running at the shipped value.
 */
export const BRAKE_FLOOR = 0.5;

/**
 * The effort a creature commands given how badly it is aimed. 1 is full gait.
 *
 * Returns exactly 1 at `brakeGain` 0 — every stored creature, and the factory
 * draw — so this is inert until a mutation switches it on.
 */
export function sensorEffort(genome, bearing) {
  const g = genome.controller.brakeGain ?? 0;
  if (g === 0) return 1;
  const e = 1 - g * Math.abs(bearing);
  return e < BRAKE_FLOOR ? BRAKE_FLOOR : e;
}

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The direction that best fits a set of axes, sign-free — the dominant
 * eigenvector of `sum(v vᵀ)`.
 *
 * POWER ITERATION, NOT A CLOSED FORM, for two reasons. The closed-form symmetric
 * eigenvector needs a branch per degenerate case and each branch is a place to
 * be subtly wrong; and this must be DETERMINISTIC to the bit (N6), which a fixed
 * start vector and a fixed iteration count give for free.
 *
 * The start vector is tried against all three axes because a start exactly
 * orthogonal to the answer produces the zero vector and converges to nothing.
 * That is not a hypothetical here: every body axis in this project is built from
 * world-aligned frames, so exact orthogonality is the COMMON case, not a corner.
 */
function dominantAxis(vs) {
  for (const start of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    let x = start;
    let ok = true;
    for (let it = 0; it < 24; it++) {
      const y = [0, 0, 0];
      for (const v of vs) {
        const d = dot3(v, x);
        y[0] += d * v[0]; y[1] += d * v[1]; y[2] += d * v[2];
      }
      const n = Math.hypot(y[0], y[1], y[2]);
      if (n < 1e-12) { ok = false; break; }
      x = [y[0] / n, y[1] / n, y[2] / n];
    }
    if (ok) return x;
  }
  return null;
}

/**
 * Per-joint weight for the second steering channel: how much of this joint's
 * hinge axis lies along the body's SECOND principal bend axis.
 *
 * The sign is the projection's own, and that is deliberate — it replaces
 * `turnSides`' mirror heuristic with the geometry itself. Two mirrored limbs
 * carry reflected axes, so their projections have opposite signs and a single
 * command bends them antisymmetrically without anything having to know which is
 * the mirror instance.
 *
 * Returns all zeros — channel B silent — when the body has no second axis, which
 * is every parallel-hinge chain in the library.
 *
 * @param {object} plan
 * @param {number[][]} jointAxes spawn-frame axis per joint, from physics.js
 *   `jointAxisAtSpawn`. Passed in rather than recomputed so the channel is
 *   driven by the SAME axes the solver constrains against, and so this file
 *   does not have to import the plan geometry it has never needed.
 */
export function turnAxis2(plan, jointAxes) {
  const w = new Float64Array(plan.jointCount);
  if (!jointAxes || jointAxes.length !== plan.jointCount || plan.jointCount === 0) return w;

  const e1 = dominantAxis(jointAxes);
  if (!e1) return w;

  // What is left of each axis once the primary bend direction is removed. For a
  // chain of parallel hinges this is the zero vector for every joint.
  const resid = [];
  for (const a of jointAxes) {
    const d = dot3(a, e1);
    const r = [a[0] - d * e1[0], a[1] - d * e1[1], a[2] - d * e1[2]];
    if (Math.hypot(r[0], r[1], r[2]) > 1e-6) resid.push(r);
  }
  if (!resid.length) return w;          // single-plane body — nothing to command

  const e2 = dominantAxis(resid);
  if (!e2) return w;
  for (let i = 0; i < plan.jointCount; i++) w[i] = dot3(jointAxes[i], e2);
  return w;
}

/** An odd number of reflections makes a limb a mirror instance of its twin. */
const isMirrored = (b) =>
  (((b.mirror.right ? 1 : 0) + (b.mirror.up ? 1 : 0) + (b.mirror.forward ? 1 : 0)) & 1) === 1;

/**
 * Which side of the body each joint sits on, as +1 / -1. 11 §5 S3: "mirrored
 * joint instances receive +turnBias, non-mirrored receive -turnBias. (Mirror
 * provenance is known from morphogenesis; for radial or asymmetric bodies, fall
 * back to the sign of the body's lateral offset from the root.)"
 *
 * THE FALLBACK IS THE COMMON CASE, not the exception, and that is worth stating
 * because the spec presents it as the other way round. `SLICE_LIMITS` caps
 * reflection axes at 1 and most factory genomes set none, which is why B4's
 * naming pass found `1 - limbs` saturating at exactly 1 for half the corpus.
 * A body with no mirrored limb at all has no left and right to differentiate,
 * so the lateral offset is what supplies one.
 *
 * A body with NO lateral extent either — a straight axial chain, an eel — gets
 * +1 on every joint, and that is correct rather than a degenerate case: a
 * uniform bias curls the whole chain into an arc, and a curled swimming body
 * turns. Both mechanisms produce a turn; only the geometry differs.
 *
 * Computed once per simulation (N4).
 */
export function turnSides(plan) {
  const sides = new Int8Array(plan.jointCount);

  let mirrored = 0;
  for (const j of plan.joints) if (isMirrored(plan.bodies[j.childBody])) mirrored++;

  // All-mirrored is as useless as none-mirrored: it is not a differential.
  if (mirrored > 0 && mirrored < plan.jointCount) {
    for (const j of plan.joints) sides[j.index] = isMirrored(plan.bodies[j.childBody]) ? 1 : -1;
    return sides;
  }

  // One micron, the genome quantum — below it the sign is rounding, not geometry.
  const LATERAL_EPS = 1e-6;
  const rootX = plan.bodies[0].position[0];
  for (const j of plan.joints) {
    const dx = plan.bodies[j.childBody].position[0] - rootX;
    sides[j.index] = dx < -LATERAL_EPS ? -1 : 1;
  }
  return sides;
}

/**
 * The mutable control input a simulation carries. Probes and duels write to it
 * between steps; nothing allocates once it exists (N4).
 *
 * `effort` is 11 §5's "global multiplier on omega" — S2 runs at 0.6, 1.0, 1.5.
 * `turnBias` is in [-1, 1]: S3 writes a constant, a duel writes sensorTurnBias().
 */
export function makeControl(plan, opts = {}, jointAxes = null) {
  return {
    effort: opts.effort ?? 1,
    turnBias: opts.turnBias ?? 0,
    /** Phase 4.3. Inert at 0, and inert regardless on a single-plane body. */
    turnBias2: opts.turnBias2 ?? 0,
    sides: turnSides(plan),
    axis2: turnAxis2(plan, jointAxes),
  };
}

export const NEUTRAL_CONTROL = { effort: 1, turnBias: 0, turnBias2: 0, sides: null, axis2: null };

/**
 * Target angle for every joint at simulation time `t`.
 *
 *   theta_j(t) = bias_j + amplitude_j * limitRange_j
 *                * sin(freqMult_j * omega * t + phase_j)
 *
 * @param {object} plan
 * @param {object} genome
 * @param {number} t seconds
 * @param {Float64Array} phases from computePhases()
 * @param {Float64Array} [out] reused across ticks — no allocation in the loop (N4)
 */
export function targetAngles(plan, genome, t, phases, out, control = NEUTRAL_CONTROL, phi = null) {
  const n = plan.jointCount;
  const dst = out && out.length === n ? out : new Float64Array(n);
  const omega = genome.controller.omega * control.effort;
  const turn = control.turnBias;
  const sides = control.sides;
  const turn2 = control.turnBias2 ?? 0;
  const axis2 = control.axis2;
  for (let i = 0; i < n; i++) {
    const j = plan.joints[i];
    const g = genome.controller.jointGenes[j.nodeId];
    const range = j.angleLimits[0];
    // A5. `phi` is the ENTRAINED phase, integrated per joint by advancePhases()
    // and owned by the caller. When it is absent the argument is the open-loop
    // form verbatim — not an equivalent expression, the same expression — so a
    // K = 0 creature has nothing for a determinism assertion to trip over.
    const arg = phi ? phi[i] : g.freqMult * omega * t + phases[i];
    dst[i] = g.bias + g.amplitude * range * Math.sin(arg);
    // Guarded rather than always-added so that the neutral case is not merely
    // equal to B3's arithmetic but IS B3's arithmetic — no `+ 0`, no rounding
    // difference, nothing for a determinism assertion to trip over.
    // ── THE TWO STEERING CHANNELS SHARE ONE JOINT, SO THEY SHARE ITS BUDGET ──
    //
    // Both terms add to the SAME scalar joint angle, so unbudgeted they simply
    // sum and a joint can be asked to bend twice as far as either channel alone
    // could ask. Measured consequence, three-seed A/B: giving a lineage the
    // second channel made overall goal closure WORSE on average (-0.032), and
    // the seed with the largest loss ended 3.7x slower than its locked control
    // (speed p50 0.0070 against 0.0257). That is the joint running out of range,
    // the stroke rectifying against its limit and thrust collapsing — the same
    // failure that made S3 read `eel-fast` at 1.25 deg/s when its real capability
    // is 8.88, rebuilt one layer up.
    //
    // L1, NOT EUCLIDEAN, and that is forced rather than chosen: the two
    // contributions are added to one number, so what the joint experiences is
    // |a| + |b|. A Euclidean norm would permit sqrt(2) times the deflection at
    // 45 degrees between the channels and clip exactly as before.
    //
    // BIT-IDENTICAL WHEN CHANNEL B IS SILENT, which is every stored creature and
    // every measurement taken so far. `sides[i]` is +-1 and `clamp1` bounds
    // `turn`, so with `turn2 = 0` the magnitude is |turn| <= 1, the scale is
    // exactly 1, and the expression reduces to the term that was here before.
    // The whole block is still skipped when both are zero, so B3's arithmetic is
    // untouched rather than merely reproduced.
    if (turn !== 0 || turn2 !== 0) {
      const a = sides[i] * turn;
      const b = axis2 ? axis2[i] * turn2 : 0;
      const m = Math.abs(a) + Math.abs(b);
      dst[i] += (a + b) * (m > 1 ? 1 / m : 1) * TURN_AUTHORITY * range;
    }
  }
  return dst;
}

/**
 * A5 — PROPRIOCEPTION. Advance each joint's own phase, entrained by the joint
 * the body is actually executing.
 *
 *   phi_j += omega_j * dt  +  K * sin(phiHat_j - phi_j) * dt
 *
 * THE DEFECT IT REPAIRS. Until now the CPG was a pure function of (genome, t):
 * it received nothing back from the body, so when a joint failed to reach its
 * commanded angle the oscillator marched on regardless and the phase relation
 * between command and body drifted freely. Real spinal CPGs are entrained by
 * stretch receptors — the rhythm recalibrates against the body executing it,
 * which is why a lamprey's gait survives load, damage and a change of shape.
 *
 * This is the FIRST STATEFUL ELEMENT in Vivarioops. After it, the controller is
 * no longer a pure function of the genome and the clock. Purity is preserved
 * where it matters (N1-N3): this function holds no state of its own, it advances
 * a buffer the CALLER owns, exactly as `targetAngles` writes into a caller-owned
 * `out`.
 *
 * PHASE ESTIMATION. If theta = bias + A*range*sin(phi) then
 *
 *     (theta - bias) / (A*range)      = sin(phi)
 *     relOmega / (omega * A*range)    = cos(phi)
 *
 * so `atan2` of the two recovers the phase the joint is actually at. The two
 * denominators are the numerical care this needs and both are guarded:
 * `A*range` is the commanded half-swing and goes to zero for a joint the genome
 * has switched off, and `omega` goes to zero at `effort` 0. Below either floor
 * the joint falls back to OPEN LOOP — `phiHat = phi`, so the correction term is
 * exactly zero rather than a large angle derived from noise. Same class of guard
 * as LATERAL_EPS above.
 *
 * WHAT IS NOT CHANGED. Inter-joint coupling still comes from the A3 gradient:
 * `phi` is SEEDED from `computePhases()` and each joint keeps advancing at its
 * own `omega_j`. Sensory feedback modulates a joint's own phase; it does not
 * replace the wave.
 *
 * NOT EVOLVABLE-AS-ORGAN. Proprioception is plumbing. Its absence is a defect,
 * not a design space, and a lineage "discovering" that its muscles have stretch
 * receptors is not a watchable event. `K` is a tunable gene; the receptor is
 * always present.
 *
 * @param {object} plan
 * @param {object} genome
 * @param {Float64Array} phi     caller-owned, seeded from computePhases(); MUTATED
 * @param {Float64Array} theta   measured joint angle, per joint
 * @param {Float64Array} relOmega measured joint angular rate, per joint
 * @param {number} dt
 * @param {object} control
 */
export function advancePhases(plan, genome, phi, theta, relOmega, dt, control = NEUTRAL_CONTROL, parents = null, couple = COUPLE) {
  const n = plan.jointCount;
  const omega = genome.controller.omega * control.effort;
  const K = genome.controller.proprioGain ?? 0;
  const par = parents || parentJoints(plan);
  for (let i = 0; i < n; i++) {
    const j = plan.joints[i];
    const g = genome.controller.jointGenes[j.nodeId];
    const wj = g.freqMult * omega;

    // ── INTER-JOINT COUPLING — this is what keeps it a WAVE ──────────────────
    //
    // Without it A5 destroys A3. Measured, and it is worth recording because the
    // headline metric hid it: with the sensory term alone, commanded inter-joint
    // coherence collapsed 0.959 -> 0.557 while the achieved/commanded RATIO went
    // UP, because the denominator fell faster than the numerator. The animal was
    // less coordinated and the ratio said it was more.
    //
    // The cause is structural. `computePhases` sets the phase RELATION between
    // joints; once each phase becomes a free variable pulled toward its own
    // joint's local mechanics, that relation is only an initial condition and
    // dissolves within a few seconds. So the relation has to be maintained, not
    // merely seeded: each joint is pulled toward `parent + lag`, which is exactly
    // the identity `computePhases` computes statically.
    //
    // This is the standard coupled-oscillator CPG (Cohen/Ijspeert lamprey): an
    // inter-oscillator term carrying the desired lag, plus a sensory term. The
    // design document asks for precisely this — "inter-joint coupling is
    // unchanged: phi_j still inherits from its parent through the gradient.
    // Sensory feedback modulates each joint's own phase; it does not replace the
    // gradient."
    //
    // A ROOT-ATTACHED JOINT HAS NO PARENT and runs free at its own omega. It is
    // the pacemaker the rest of its chain is pulled toward, which is the dynamic
    // reading of 10 §A7's "root joint phase = 0".
    let corr = 0;
    const p = par[i];
    if (p >= 0) corr += couple * Math.sin(phi[p] + plan.joints[p].phaseLag - phi[i]);

    if (K > 0) {
      const half = g.amplitude * j.angleLimits[0];
      if (half > PHASE_EPS && Math.abs(wj) > PHASE_EPS) {
        const s = (theta[i] - g.bias) / half;
        const c = relOmega[i] / (wj * half);
        // Both components tiny means the joint is not moving and its phase is
        // unobservable; atan2(0, 0) is 0, which would yank the oscillator to a
        // phase the body never expressed.
        if (s * s + c * c > PHASE_OBS) corr += K * Math.sin(Math.atan2(s, c) - phi[i]);
      }
    }
    phi[i] += (wj + corr) * dt;
  }
  return phi;
}

/**
 * Parent joint of every joint, or -1 for a joint on the root body. Same walk
 * `computePhases` does; computed once by the caller and reused, since the plan
 * does not change during a life.
 */
export function parentJoints(plan) {
  const jointOfBody = new Int32Array(plan.bodyCount).fill(-1);
  for (const j of plan.joints) jointOfBody[j.childBody] = j.index;
  const out = new Int32Array(plan.jointCount);
  for (const j of plan.joints) out[j.index] = jointOfBody[j.parentBody];
  return out;
}

/**
 * Inter-oscillator coupling rate, 1/s. PLUMBING, not a gene — the same argument
 * that makes proprioception itself not evolvable-as-organ: a chain whose
 * segments do not talk to each other is a defect, not a design space, and the
 * thing worth selecting on is the LAG the coupling carries, which is already
 * genetic (phaseBase/phaseSlope/phaseLag).
 *
 * Sized above `RANGE.proprioGain`'s ceiling of 3.0 so that sensory feedback
 * bends the wave rather than breaking it. Below `omega`'s ceiling of 6.0, so it
 * cannot dominate a joint's own advance.
 */
export const PHASE_COUPLE = 4.0;
const COUPLE = PHASE_COUPLE;

/** Commanded half-swing, and |omega|, below which a joint's phase is unobservable. */
const PHASE_EPS = 1e-6;
/** Minimum |(sin, cos)| for the estimate to be signal rather than noise. */
const PHASE_OBS = 0.01;

/**
 * Target angular VELOCITY, for the velocity-motor drive mode.
 *
 * 10 §A7 and 30 §4 both flag velocity motors as the fallback if position targets
 * look convulsive: driving joint velocity directly is often more stable than
 * chasing a position target, and is cheaper. Built now rather than after B3
 * fails, so the comparison is a switch instead of a rewrite.
 *
 * C1 NOTE, and it is a real constraint on that fallback: a CONSTANT differential
 * bias has zero derivative, so it does not survive into a velocity target. This
 * drive can carry `effort` but it cannot carry `turnBias` at all — steering
 * would have to be re-expressed as an amplitude or frequency asymmetry between
 * the sides. If DRIVE.VELOCITY is ever taken up, S3 and every duel go with it.
 */
export function targetVelocities(plan, genome, t, phases, out, control = NEUTRAL_CONTROL) {
  const n = plan.jointCount;
  const dst = out && out.length === n ? out : new Float64Array(n);
  const omega = genome.controller.omega * control.effort;
  for (let i = 0; i < n; i++) {
    const j = plan.joints[i];
    const g = genome.controller.jointGenes[j.nodeId];
    dst[i] = g.amplitude * j.angleLimits[0] * g.freqMult * omega
           * Math.cos(g.freqMult * omega * t + phases[i]);
  }
  return dst;
}

export const DRIVE = { POSITION: 'position', VELOCITY: 'velocity' };
