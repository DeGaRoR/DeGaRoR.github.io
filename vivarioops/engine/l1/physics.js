// engine/l1/physics.js — Rapier, parameterised entirely by the World (10 §A4).
//
// PURITY: no clock, no rng, no DOM, no upward imports. Rapier arrives as an
// INJECTED, already-initialised namespace — `RAPIER.init()` is async and 01 §4
// forbids async in /engine/, so the caller awaits it and passes it in.
//
// UNITS (01 §7): THIS IS CGS — centimetres, grams, seconds.
//
// Density is relative to water = 1.0 and mass = density x volume, which IS the
// g/cm^3 convention: a 1 cm^3 body at density 1.0 masses 1 g, which is what
// Rapier's collider density gives directly. The median creature is then ~7 cm
// and ~7.5 g, which is what the renderer has always drawn. Force is therefore
// the dyne (g.cm/s^2) and pressure the barye (0.1 Pa).
//
// THE LABELS USED TO SAY "m" AND "kg", which was not any consistent system:
// under a metre reading the mass unit is a TONNE. Naming the system CGS makes
// every constant below citable against a real number, and three of them carry a
// recorded debt against it:
//
//   MUSCLE_STRESS   200 barye = 20 Pa, against real muscle's 1e4-1e6 Pa.
//                   SCHEDULED to become 2e6 (= 2e5 Pa) at C6.7 — decided, not an
//                   open question. Measured justification: 10^4x muscle buys only
//                   2.5x speed, so this is a LABELLING correction, NOT the
//                   locomotion fix it might look like.
//   world.gravity   must become 981 cm/s^2 before SLICE_LIMITS.density unpins at
//                   step F. Inert until then — the buoyancy term below is
//                   identically zero while density is [1,1] against mediumDensity
//                   1.0, and that is bit-exact at g = 0 / 9.81 / 981.
//   dragCoefficient the constant-Cd quadratic law in applyEnvironment holds for
//                   Re >~ 1e3. At this reading and current speeds the corpus sits
//                   at Re ~ 32, where a bluff body's Cd is ~4x higher and
//                   Re-dependent. Revisit if the corpus is still under ~0.1
//                   body-lengths/s. C6.7 does NOT discharge this: 2.5x speed
//                   only moves Re to ~80. The Re debt and the L/s gap are one gap.
//
// Only MOTOR_SCALE has to be tuned to the density choice, because torque follows
// area (N19) and does not rescale with mass.

import { computePhases, targetAngles, targetVelocities, makeControl, DRIVE, TURN_AUTHORITY } from './controller.js';
import { qrot, qmul, normalise } from './vecmath.js';

export const FIXED_DT = 1 / 120;      // 01 §7, substepped

/**
 * Torque per square CENTIMETRE of joint cross-section, at unit stiffness.
 * Tuned against the unit convention above; it is the one constant that does not
 * scale with the density choice.
 */
export const MOTOR_SCALE = 1.0;

/**
 * Muscle stress in SLICE UNITS (barye, = 0.1 Pa), for the derived torque model.
 *
 * Vertebrate skeletal muscle sustains roughly 2e5 Pa, which in CGS is 2e6 barye.
 * THIS CONSTANT IS 200, i.e. 20 Pa — four orders of magnitude below any animal's
 * muscle, and below cnidarian mesoglea. It is wrong, it is known to be wrong, and
 * it is SCHEDULED to become 2e6 at C6.7 rather than carried as an open question.
 *
 * WHY IT IS NOT URGENT, measured rather than assumed: sweeping actuator strength
 * over four orders of magnitude (via motorScale, which multiplies the solver gain
 * and the C1.2 clamp ceiling together) moves body-lengths/s from 0.023 to 0.058 —
 * a 10^4x muscle buys 2.5x speed, and the eel's error clamp binds on 0.1% of
 * joint-steps. The actuator is nowhere near the bottleneck, so correcting this is
 * a LABELLING fix and must not be mistaken for a locomotion fix.
 *
 * It is a worldHash-affecting change (faunaVersion bump, full re-measure,
 * resident re-freeze), which is why it is sequenced rather than done in place.
 *
 * NOT A DIAL. Changing it is claiming something about muscle.
 */
export const MUSCLE_STRESS = 200;

/**
 * Maximum joint angular velocity under load, rad/s — the Hill force-velocity
 * ceiling. Muscle shortens at up to ~10 lengths/s; at a moment arm of sqrt(A)
 * the insertion speed is omega*sqrt(A), so the sqrt(A) cancels and the ceiling
 * is the same for every joint whatever its size. NOT A DIAL.
 */
export const OMEGA_MAX = 10;

/**
 * Stability speed ceiling, cm/s (the myriapod fix). A swimmer travels < 1 cm/s
 * and a hard burst a few cm/s, so 10 is ~an order of magnitude of headroom; a
 * creature that reaches it is pumping energy through its own actuator, not
 * swimming, and this is the speed at which the sim stops it running away and
 * tearing its joints apart. Held BELOW the wall-tunnelling ceiling
 * (WALL/FIXED_DT ~ 60 cm/s), which it therefore also tightens. NOT A DIAL — it is
 * a divergence guard, not a tuning knob.
 *
 * IT ALSO BOUNDS THE DIAGNOSTICS. clampKinematics() runs at the TOP of step(), so
 * any tool that prescribes a state above this and then recovers a force from the
 * velocity change is measuring the CLAMP, not the fluid law. tools/_dragmicro.mjs
 * still sweeps to 30 and its top row reads 3.074 for exactly that reason; the
 * "ratio 1.000 at every point" in HYDRODYNAMICS.md §10 predates this constant and
 * now holds only up to 10. tools/_zplate.mjs stays under it deliberately.
 */
export const STABLE_SPEED = 10;

/**
 * Moment arm as a FRACTION of the joint radius sqrt(A).
 *
 * The first stress model used the full joint radius, which assumes the muscle
 * inserts at the rim. Vertebrate tendons insert close to the axis — moment arm
 * over limb radius is roughly 0.1 to 0.3 — and the difference is a direct
 * multiplier on torque, so it is not a detail. 0.2 is the middle of that range.
 */
export const MOMENT_ARM_FRACTION = 0.2;

/**
 * Slew-rate limit on the COMMANDED joint angle, rad/s. A joint may not be told
 * to move faster than its muscle could follow, and OMEGA_MAX is already that
 * number — so this is derived rather than a second constant. The reference uses
 * 15 rad/s for its own actuator (UpdateJointAngleActuatorsSystem).
 */
export const TARGET_SLEW = OMEGA_MAX;

/**
 * Low-pass coefficient on the commanded angle, per step: higher is more
 * responsive. The reference's value, kept, because this is one of the parts of
 * its model that is already debugged.
 */
export const TARGET_FILTER = 0.8;
// The budget-derived spring gain is `motorScale * budget * MOTOR_STIFFNESS`. Was
// 1.0 (soft — tracking gain 0.27, the original locomotion problem). Raised to 12
// after the myriapod fix: at 12 the AREA-derived gain tracks as well as the
// inertia-derived reference (eel gain 0.82, per-joint lag spread ~14 deg) while
// staying stable on complex creatures the reference tore apart. The error clamp
// (C1.2) still bounds the delivered torque to the muscle budget, so a stiffer
// gain only tracks faster inside that budget — it does not exceed it.
export const MOTOR_STIFFNESS = 8.0;
export const MOTOR_DAMPING = 0.12;

/**
 * The joint axis, in the frame the rigid bodies are actually spawned in.
 *
 * `j.axes` are PARENT-LOCAL, in morphogenesis's sense of "local" — the frame of
 * the parent LIMB. Bodies are spawned world-aligned (see createSimulation), so
 * the parent limb's orientation lives on its collider, not on its body, and the
 * axis has to be rotated out of limb space into body space before Rapier sees it.
 */
/**
 * EXPORTED so that measurement code cannot get the axis wrong.
 *
 * `tools/_track.mjs` and `tools/_amp.mjs` both read `j.axisLocal ?? [1,0,0]`.
 * There is no `axisLocal` field anywhere in the engine, so the fallback always
 * fired and both measured the swing-twist angle about the PARENT BODY'S X AXIS
 * rather than about the joint's own. Every achieved-versus-commanded number
 * those two produced was about an arbitrary axis. The fix is not to add the
 * field — a denormalised copy would go stale — but to make the one correct
 * computation reachable from outside this module.
 */
export function jointAxisAtSpawn(j, plan) {
  const local = j.type === 'twist' ? j.axes.z : j.axes.x;
  return normalise(qrot(plan.bodies[j.parentBody].rotation, local));
}

/**
 * Rapier joint mapping — 10 §A17.2. Slice set is revolute, twist, spherical, rigid.
 *
 * WHY THIS IS CORRECT ONLY WITH WORLD-ALIGNED BODIES. Rapier's revolute joint
 * takes ONE axis and uses it to build the local frame of BOTH bodies — its own
 * doc says the axis is "expressed in the local-space of the rigid-bodies",
 * plural. The constraint it then enforces is that the child's rotation relative
 * to the parent must be a rotation ABOUT THAT AXIS. If limb orientation were
 * carried on the rigid bodies, a child's rest rotation relative to its parent
 * would be `parentSpaceRotation` — measured at a mean 128 degrees over the gate
 * corpus, and essentially never a rotation about the joint axis. Every joint
 * would be violated at spawn and the solver would snap every limb into line with
 * its parent, destroying the morphology. Spawning both bodies world-aligned
 * makes the rest relative rotation the identity, which is trivially a rotation
 * about any axis, so the constraint is satisfied exactly at t=0 and one axis is
 * genuinely valid for both frames.
 *
 * DEVIATION from 10 §A17.2's "implement GenericJoint once and express all seven
 * as configurations of it". `JointData.generic` is present in the JS binding but
 * the joint it returns has no `setLimits` — the typed constructors are the only
 * route to angle limits from JS. The typed joints ARE generic joints with preset
 * masks, so this is the same object by a different door; it is recorded because
 * step F's three 2-DOF types will need the generic path and a way around this.
 */
function makeJointData(RAPIER, j, plan) {
  const parent = plan.bodies[j.parentBody];
  const child = plan.bodies[j.childBody];
  // Both anchors are limb-space points rotated into their own body's frame.
  const a1 = qrot(parent.rotation, j.anchor);
  const a2 = qrot(child.rotation, [0, 0, -child.dims[2] * 0.5]);   // the child's -Z face
  const anchor1 = vec(a1);
  const anchor2 = vec(a2);

  switch (j.type) {
    case 'revolute':   // face-right axis
    case 'twist':      // same joint, face-normal axis
      return RAPIER.JointData.revolute(anchor1, anchor2, vec(jointAxisAtSpawn(j, plan)));
    case 'spherical':
      return RAPIER.JointData.spherical(anchor1, anchor2);
    case 'rigid':
      return RAPIER.JointData.fixed(anchor1, { x: 0, y: 0, z: 0, w: 1 }, anchor2, { x: 0, y: 0, z: 0, w: 1 });
    default:           // bendTwist, twistBend, universal — step F
      return RAPIER.JointData.revolute(anchor1, anchor2, vec(jointAxisAtSpawn(j, plan)));
  }
}

const vec = (a) => ({ x: a[0], y: a[1], z: a[2] });

/** Tank wall thickness, m. viability.js derives `maxPeakSpeed` from this. */
export const WALL = 0.5;

/**
 * Does this body plan fit inside the tank?
 *
 * A creature larger than the tank spawns deeply embedded in the walls and the
 * solver cannot resolve that penetration — Rapier panics outright. Oversize
 * creatures are a VIABILITY question (B4), not a physics question, so the
 * boundary is reported and the environment omitted rather than crashing the sim.
 *
 * Exported at C1 because `createArena` no longer sees the plan and the duel
 * harness has to make the same decision one step earlier.
 */
export function fitsTank(plan, world) {
  let reach = 0;
  for (const b of plan.bodies) {
    reach = Math.max(reach,
      Math.abs(b.position[0]) + b.dims[0],
      Math.abs(b.position[1]) + b.dims[1],
      Math.abs(b.position[2]) + b.dims[2]);
  }
  return reach < Math.min(world.tankBounds[0], world.tankBounds[1], world.tankBounds[2]) / 2;
}

/**
 * THE TANK ITSELF — a Rapier world plus its environment colliders.
 *
 * EXTRACTED AT C1, and it is the change B4b's tiling was a workaround for.
 * `createSimulation` used to build its own `RAPIER.World` per call, so two
 * creatures could never share one; that is why the tank tiles six private tanks
 * instead of putting six creatures in one (handoff, open decision 5), and why
 * they cannot touch. A DUEL is contact between two creatures and therefore
 * requires one world, so the world and its environment are now a separate
 * object that simulations attach to.
 *
 * With no arena passed, `createSimulation` builds a private one in exactly the
 * old order — environment colliders first, creature bodies after — so handles,
 * island ordering and every B3 number are unchanged.
 *
 * Floor, free surface and tank walls are read from the World (10 §A4). Without
 * them a creature that is not neutrally buoyant rises or sinks forever, which
 * reads as "it swam a long way" in any displacement measurement.
 *
 * N22: every environment collider is tagged. Ground and wall contacts NEVER
 * damage; only creature-creature contacts do. Tagging here rather than at the
 * damage system means the distinction cannot be lost later.
 *
 * @param {object} RAPIER  already-initialised
 * @param {object} world   W1_SLICE or another World
 * @param {object} [opts]  `{ bounded }` — false builds an open volume
 */
export function createArena(RAPIER, world, opts = {}) {
  const bounded = opts.bounded ?? true;

  // Rapier's own gravity is zero: gravity is applied by hand per body, together
  // with buoyancy, because both are per-body quantities and letting Rapier apply
  // gravity globally would make the per-node density genes do nothing (10 §A4).
  const w = new RAPIER.World({ x: 0, y: 0, z: 0 });
  w.timestep = FIXED_DT;

  const environment = [];
  const [tw, th, td] = world.tankBounds;
  const half = [tw / 2, th / 2, td / 2];

  const addStatic = (hx, hy, hz, x, y, z, kind) => {
    const rb = w.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    const col = w.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setFriction(world.floor.friction)
        .setRestitution(world.floor.restitution),
      rb);
    environment.push({ collider: col, kind, damaging: false });
    return col;
  };

  if (bounded && world.floor.present) addStatic(tw, WALL, td, 0, world.floor.y - WALL, 0, 'floor');
  if (bounded && world.surface.present) addStatic(tw, WALL, td, 0, world.surface.y + WALL, 0, 'surface');
  if (bounded) {
    addStatic(WALL, half[1], half[2], -half[0] - WALL, 0, 0, 'wall');
    addStatic(WALL, half[1], half[2], half[0] + WALL, 0, 0, 'wall');
    addStatic(half[0], half[1], WALL, 0, 0, -half[2] - WALL, 'wall');
    addStatic(half[0], half[1], WALL, 0, 0, half[2] + WALL, 'wall');
  }

  const environmentHandles = new Set(environment.map(e => e.collider.handle));

  return {
    world3d: w,
    world,
    environment,
    environmentHandles,
    bounded,
    /** N22 — true only for creature-creature contacts. */
    isDamagingContact(handleA, handleB) {
      return !environmentHandles.has(handleA) && !environmentHandles.has(handleB);
    },
    /**
     * Advance every attached simulation by one fixed step. Forces from ALL
     * occupants are applied before the single solve, which is the whole point of
     * a shared world: apply-then-solve per creature would let the first mover
     * see a world the second had not yet pushed on.
     */
    stepAll(sims) {
      for (const s of sims) s.applyForces();
      w.step();
      for (const s of sims) s.advanceClock();
    },
    free() { w.free(); },
  };
}

/**
 * Build a live simulation from a body plan.
 * @param {object} RAPIER  already-initialised Rapier namespace
 * @param {object} plan
 * @param {object} genome
 * @param {object} world   W1_SLICE or another World
 * @param {object} [opts]  `{ drive, origin, motorScale, bounded, arena, effort }`
 */
/**
 * Signed swing-twist angle of `qc` relative to `qp` about `axisLocal`.
 *
 * EXPORTED SO THE GATE CAN PRESS IT (H9). The live version is a closure over
 * Rapier bodies, so the invariance property — the thing that was actually broken
 * — could not be asserted from outside. The arithmetic is the whole rule, so the
 * arithmetic is what gets tested.
 *
 * `axisLocal` MUST be expressed in the parent's frame, because the vector part
 * of `conj(qp) * qc` is. Passing a world-space axis is the defect this replaces:
 * it makes the reported angle a function of the parent's global orientation.
 *
 * @param {{x:number,y:number,z:number,w:number}} qp parent rotation, world
 * @param {{x:number,y:number,z:number,w:number}} qc child rotation, world
 * @param {number[]} axisLocal joint axis in the PARENT's frame
 */
export function swingTwistAngle(qp, qc, axisLocal) {
  // qRel = conj(qp) * qc
  const cx = -qp.x, cy = -qp.y, cz = -qp.z, cw = qp.w;
  const rx = cw * qc.x + cx * qc.w + (cy * qc.z - cz * qc.y);
  const ry = cw * qc.y + cy * qc.w + (cz * qc.x - cx * qc.z);
  const rz = cw * qc.z + cz * qc.w + (cx * qc.y - cy * qc.x);
  const rw = cw * qc.w - (cx * qc.x + cy * qc.y + cz * qc.z);
  const proj = rx * axisLocal[0] + ry * axisLocal[1] + rz * axisLocal[2];
  return 2 * Math.atan2(proj, rw);
}

export function createSimulation(RAPIER, plan, genome, world, opts = {}) {
  const drive = opts.drive ?? DRIVE.POSITION;
  const origin = opts.origin ?? [0, 0, 0];
  const motorScale = opts.motorScale ?? MOTOR_SCALE;
  /** 'scale' (shipped) or 'stress' (derived from MUSCLE_STRESS). See applyMotors. */
  // DEFAULT STAYS 'scale' UNTIL THE STRESS MODEL IS FINISHED. It is measured to
  // work — locomotion p50 goes 0.78 -> 3.87 m and morphology starts to predict
  // travel — but as derived it is too hot: peak speeds reach 71 m/s median, and
  // it reds 9 assertions including L1-18, which pins torque proportional to A
  // and which the A^(3/2) form contradicts BY DESIGN. Flipping this one word is
  // the whole switch; see HYDRODYNAMICS.md for what has to be settled first.
  const torqueModel = opts.torqueModel ?? 'stress';
  const momentArm = opts.momentArm ?? MOMENT_ARM_FRACTION;
  /** Reference-parity command smoothing. Off by default until measured. */
  const smooth = opts.smooth ?? false;
  /** PD gains, exposed so saturation can be measured rather than argued about. */
  const kStiff = opts.stiffness ?? MOTOR_STIFFNESS;
  const kDamp = opts.damping ?? MOTOR_DAMPING;
  /**
   * 'pd'     the explicit PD, integrated outside the solver (shipped).
   * 'solver' Rapier's own joint motor, an IMPLICIT spring-damper solved inside
   *          the constraint solver — the reference's architecture.
   */
  // DEFAULT IS NOW 'solver' — B2 §3.2. The two blockers below are discharged:
  //
  //   1. WORK NOW ACCUMULATES on the solver path, reconstructed from the same
  //      spring-damper law the motor is configured with. See the tick loop for
  //      what the reconstruction is exact about and what it is not; the short
  //      version is that solver-to-solver cost of transport is comparable
  //      without qualification and solver-to-PD is not, below a few percent.
  //   2. L1-18 NOW ASSERTS N19 ON BOTH PATHS, each against its own predicted
  //      exponent, rather than pinning one actuator.
  //
  // And 00 §9's bounded actuator power, which §12 carried as a decision, is
  // re-imposed here rather than amended away — see the motor setup block.
  //
  // WHY THIS IS WORTH THE QUIET TANK. §0.2: through the PD a designed swimmer
  // beats a random creature by ~7x; through the solver, by ~50x, and session 10
  // measured the whole authored library collapsing into a 0.006-0.035 band
  // narrower than noise on the PD path. The PD makes everything look alive and
  // makes design irrelevant. That gap is not a problem to be tuned away, it is
  // the game — but it means the opening population cannot be purely random, and
  // §3.3's authored seeding is now load-bearing rather than a variety nicety.
  const motorMode = opts.motor ?? 'solver';

  /**
   * ── ACTUATOR PARAMETRISATION (experimental, off by default) ────────────────
   *
   * Both shipped paths set the joint's spring and damper FROM THE TORQUE BUDGET:
   * k = budget * kStiff, c = budget * kDamp, with budget = sigma * A^1.5 * arm.
   * That fixes the joint's STRENGTH and leaves its natural frequency and damping
   * ratio to fall out of whatever inertia the limb happens to have:
   *
   *     omega_n = sqrt(k / I)        c/(2 sqrt(k I)) = zeta
   *
   * Measured over the viable corpus (tools/_gains.mjs): omega_n p05 2, p50 9,
   * p95 38 rad/s, and zeta 0.1 to 2.3. The controller commands 1-3 rad/s, so the
   * slowest joints sit AT their own corner frequency while the fastest sit two
   * decades below it — and a second-order system's phase lag is a function of
   * omega/omega_n. Measured consequence (tools/_bode.mjs): per-joint lag spans
   * 4 to 152 degrees. A commanded pi/2 travelling wave cannot survive a plant
   * that adds an uncontrolled 150 degrees of its own.
   *
   * The reference specifies the OTHER TWO numbers instead — SpringFrequency
   * 10 Hz, DampingRatio 0.9 — and lets torque fall out. At 10 Hz against a
   * 1-3 rad/s command every joint sits at omega/omega_n < 0.05, where gain is
   * 1.00 and lag is a few degrees FOR EVERY JOINT WHATEVER ITS SIZE. That is not
   * a tuning preference; it is what makes a commanded phase relationship a real
   * phase relationship.
   *
   * Set `motorFreqHz` to switch to that parametrisation: k and c are then
   * derived from the child limb's own inertia. N19 is NOT abandoned — it moves
   * from the gain to the bound, which is where the reference has it too
   * (MaxImpulse = 2 * MinCrossSectionalArea). See the clamp note in the joint
   * loop for why the bound cannot currently be expressed in this binding.
   */
  // C1.3, AMENDED BY THE MYRIAPOD FIX. The default is the BUDGET-DERIVED gain
  // (`motorFreqHz: null`), made stiff enough to track well by MOTOR_STIFFNESS,
  // NOT the inertia-derived reference response. The reference (`motorFreqHz: 10`)
  // tracked the eel beautifully but TORE COMPLEX CREATURES APART: its gain is
  // k = I*wn^2, and for a many-jointed body with elongated limbs (high inertia) it
  // pumps energy until the joints separate (tools/_zmyria.mjs — Myriapoda multipes
  // 2 reaches 60 m/s in 2.8 s under freq10, and is calm under budget-derived gains
  // at every stiffness up to 16). A stiff AREA-derived gain tracks as well or
  // better (median lag spread 14 deg vs 62) AND stays stable, because k scales
  // with cross-section, not with an elongated limb's inertia. The reference
  // branch is kept, opt-in, for anyone who wants it. `?? null` so undefined and
  // an explicit null both take the budget branch; an explicit number opts in.
  const motorFreqHz = opts.motorFreqHz ?? null;
  const motorZeta = opts.motorZeta ?? 0.9;
  // C1.2/C1.3 — the muscle-budget multiplier, and a 00 §9 DECISION. The torque
  // ceiling the error-clamp saturates at is `budgetScale * MUSCLE_STRESS * A^1.5
  // * momentArm`. It scales the CEILING WITHOUT scaling the inertia-derived gains,
  // so it is the honest lever on muscle STRENGTH — how much torque a joint may
  // deliver, area-derived (N19 intact) — decoupled from the response shape.
  //
  // DEFAULT 6, and it is measured, not tuned (tools/_zladder.mjs). At the shipped
  // budget (1) the clamp binds so hard that a bounded joint tracks no better than
  // the old scattered default — gain 0.27 — because the reference response asks
  // for more torque than MUSCLE_STRESS * A^1.5 * momentArm allows. At 6x, a real
  // swimmer's spring torque sits at ~0.3 of the ceiling: it tracks EXACTLY as a
  // free (unbounded) joint does (eel gain 0.77, per-joint lag spread 15 deg) while
  // the clamp still caps the pathological tail that would otherwise ask for 20-
  // 1000x. 6x is the reference's own strength: MaxImpulse = 2*A is ~6x our budget
  // in impulse terms. COT rises ~2-4x for swimmers (only creatures that USE the
  // torque pay), not the 17x an across-the-board motorScale would cost.
  const budgetScale = opts.budgetScale ?? 6;

  /**
   * ADDED MASS (C6.2). OFF until it is measured and the corpus is re-frozen —
   * turning it on is a worldHash-affecting physics change, because it moves every
   * recorded capability. The derivation is at the body-construction site below.
   * `addedMassScale` exists so the sweep can find out how much of it the rest of
   * the model can carry, not as a tuning dial to leave at a fractional value.
   */
  const addedMass = opts.addedMass ?? false;
  const addedMassScale = opts.addedMassScale ?? 1;

  const fits = fitsTank(plan, world);

  // A shared arena is the caller's; a private one is ours to build and to free.
  const ownsArena = !opts.arena;
  const arena = opts.arena
    ?? createArena(RAPIER, world, { bounded: (opts.bounded ?? true) && fits });
  const w = arena.world3d;
  const bounded = arena.bounded;
  const environment = arena.environment;
  const environmentHandles = arena.environmentHandles;

  const bodies = [];
  const colliders = [];
  for (const b of plan.bodies) {
    // The body is spawned WORLD-ALIGNED and the limb's orientation is carried by
    // the collider instead. See makeJointData for why the joints require this.
    // Nothing else in the sim depends on the body frame carrying orientation:
    // buoyancy and drag are orientation-independent as approximated here, the
    // centre of mass is unchanged because the box is centred on the body origin,
    // and `readPose` composes the two rotations back together for the renderer.
    const rb = w.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(b.position[0] + origin[0], b.position[1] + origin[1], b.position[2] + origin[2])
        .setLinearDamping(0).setAngularDamping(0),
    );
    const col = w.createCollider(
      RAPIER.ColliderDesc.cuboid(b.dims[0] / 2, b.dims[1] / 2, b.dims[2] / 2)
        .setRotation({ x: b.rotation[0], y: b.rotation[1], z: b.rotation[2], w: b.rotation[3] })
        .setDensity(b.density)
        // N22: ground and wall contacts never damage; only creature-creature
        // contacts do. Contact events are collected per collider and the floor
        // and walls are tagged so the damage system at step F cannot confuse them.
        .setRestitution(world.floor.restitution)
        .setFriction(world.floor.friction),
      rb,
    );
    // ── ADDED MASS (C6.2) — opt-in until it is measured ──────────────────────
    //
    // The single largest physical omission in the fluid model. A body accelerating
    // through water drags fluid with it, and for a flat plate that fluid outweighs
    // the plate several times over. Without it, limbs are far too cheap to flick:
    // a correctly-sized muscle spins a fin to speeds real water forbids, which is
    // the peak-speed tail that STABLE_SPEED exists to cap. Added mass is the
    // missing PHYSICAL damper; the clamp has been standing in for it.
    //
    // IT GOES IN THE MASS MATRIX, NEVER AS A FORCE. An explicit added-mass force
    // with m_added > m is unconditionally unstable; solved inside the mass matrix
    // it is unconditionally stable, which is why Rapier's own API is the right
    // home for it.
    //
    // TRANSLATION, per axis, from the flat-plate limit: a face (dj, dk)
    // accelerating along its normal drags a slab of fluid of order
    // (pi/4)*min(dj,dk) thick, so
    //       mAdd_i = rho_f * (pi/4) * dj * dk * min(dj, dk)
    // Right where it matters (a thin fin) and an OVERESTIMATE for a compact body:
    // a cube gets 0.785*rho*d^3 against a sphere's 0.5*rho*V = 0.26*rho*d^3.
    // Rapier's translational added mass is a SCALAR, so the minimum over the three
    // axes is used — conservative, and for a plate that is the edgewise value,
    // which is nearly nothing. THE TRANSLATIONAL TERM IS THEREFORE ALMOST INERT
    // FOR FINS. That is a known limitation of the scalar API, not an oversight.
    //
    // ROTATION is where the effect actually lives, and Rapier takes it
    // ANISOTROPICALLY, so this part can be right. Treating each perpendicular
    // added-mass distribution as a uniform sheet swept about the axis:
    //       IAdd_i = mAdd_j * dk^2/12 + mAdd_k * dj^2/12
    // For a 2 x 0.05 x 2 plate about its in-plane axis that is ~31x the plate's
    // own inertia — which is correct, and is exactly the "limbs too cheap to
    // flick" number.
    //
    // The local frame is `b.rotation`: the body is spawned world-aligned and the
    // limb's orientation is carried by the collider (see above), so the added
    // inertia must be expressed in the limb's frame, not the body's.
    if (addedMass) {
      const d = b.dims;
      const K = Math.PI / 4;
      const mA = [
        world.mediumDensity * K * d[1] * d[2] * Math.min(d[1], d[2]),
        world.mediumDensity * K * d[0] * d[2] * Math.min(d[0], d[2]),
        world.mediumDensity * K * d[0] * d[1] * Math.min(d[0], d[1]),
      ];
      const iA = [
        (mA[1] * d[2] * d[2] + mA[2] * d[1] * d[1]) / 12,
        (mA[2] * d[0] * d[0] + mA[0] * d[2] * d[2]) / 12,
        (mA[0] * d[1] * d[1] + mA[1] * d[0] * d[0]) / 12,
      ];
      rb.setAdditionalMassProperties(
        Math.min(mA[0], mA[1], mA[2]) * addedMassScale,
        { x: 0, y: 0, z: 0 },                                  // centred on the limb
        { x: iA[0] * addedMassScale, y: iA[1] * addedMassScale, z: iA[2] * addedMassScale },
        { x: b.rotation[0], y: b.rotation[1], z: b.rotation[2], w: b.rotation[3] },
        true,
      );
      // RAPIER DEFERS THE MERGE. Without this, mass() and principalInertia() keep
      // reporting the collider-only values until the first world.step() — and
      // massOf/inertiaOf below are read BEFORE any step, so the fluid guard would
      // spend the whole run dividing by the un-augmented inertia. Measured: a
      // 2 x 0.05 x 2 plate reads Iz 0.0667 before this call and 2.1567 after.
      rb.recomputeMassPropertiesFromColliders();
    }

    bodies.push(rb);
    colliders.push(col);
  }

  // Mass properties, read once. They are constant for the life of the sim, and
  // `principalInertia()` allocates a Vector per call, so reading them per tick
  // would allocate inside the step loop (N4). The drag limiter below needs both.
  // The SMALLEST principal inertia is the stability-limiting axis: using it makes
  // the limiter conservative on every axis rather than only on the stiffest one.
  // ── per-body face table, built ONCE (N4: no allocation per step) ──────────
  //
  // 6 faces x QUAD^2 patches per limb. Each entry is a unit normal in limb space,
  // an offset from the limb centre in limb space, and the area that patch carries.
  // Flat arrays, stride 7, so the hot loop reads contiguous memory and allocates
  // nothing.
  //
  // QUAD WAS 2 (4 quadrants, 24 samples), matching the reference
  // (mycoolfin/the-simsulator, ApplyFluidForcesSystem.cs). MEASURED WRONG for
  // rotation. A 2x2 midpoint rule puts its samples at +-0.25*d, the midpoint of
  // each half-face. For a face rotating about the limb centre the flow varies
  // LINEARLY across it while the force is QUADRATIC in that flow, so integrating
  // r^2 and r^3 over [0, h] with one sample at h/2:
  //
  //     force  ~ mean r^2 : exact h^2/3  vs sampled h^2/4   (-25%)
  //     torque ~ mean r^3 : exact h^3/4  vs sampled h^3/8   (-50%)
  //
  // tools/_zplate.mjs test C measured exactly 0.500, flat in omega — the engine
  // was delivering HALF the rotational damping its own drag law specifies. That
  // matters because runaway spin is what STABLE_SPEED exists to cap: the law was
  // being blamed for an instability the quadrature was creating. QUAD 4 takes
  // force to -6% and torque to -12%, and also resolves the windward/leeward cut
  // across a rotating face to quarter-face rather than half-face granularity.
  //
  // FALLBACK, if a profile ever says 96 samples is too many: set QUAD = 2. That
  // reproduces the old table EXACTLY (patch centres fall at +-0.25*d), so it is a
  // one-character revert rather than a rewrite. MEASURED when this landed
  // (tools/_zquad.mjs, 18 creatures / 151 bodies / 6 s each): 38.1 -> 40.4 ms per
  // trial, +6%. Four times the samples cost 6% because the fluid loop is not the
  // dominant term — Rapier's solve is — so the fallback was not needed.
  //
  // IT ALSO DETONATED A LATENT BUG, which is recorded here because the next
  // person to touch QUAD needs it: at 2x2 a translating box's fluid torque
  // cancels to EXACTLY zero, and the momentum guard below used to divide by it.
  // At 4x4 the offsets leave a ~1e-17 residue, |T| became denormal-but-nonzero
  // against |omega| = 0, and the guard discarded the entire fluid force of every
  // non-rotating body. The guard is now projected onto the opposed component and
  // no longer has that cliff — see the note there.
  //
  // DEVIATION FROM THE REFERENCE, deliberate and unchanged: it places the face
  // centre at 0.5 * unitNormal WITHOUT scaling by the limb dimension, while
  // scaling the in-plane offsets. That is dimensionally inconsistent — a
  // 2.0 x 0.2 x 2.0 plate gets its +X face sampled 0.5 out instead of 1.0, so its
  // torque arm is wrong by 2x. The normal offset is scaled here.
  const QUAD = 4;
  const FACE_N = 6 * QUAD * QUAD, FACE_STRIDE = 7;
  const faceTable = new Float64Array(plan.bodyCount * FACE_N * FACE_STRIDE);
  {
    //          normal axis, tangent 1, tangent 2
    const AXES = [[0, 1, 2], [1, 0, 2], [2, 0, 1]];
    for (let i = 0; i < plan.bodies.length; i++) {
      const d = plan.bodies[i].dims;
      let w = i * FACE_N * FACE_STRIDE;
      for (const [na, t1, t2] of AXES) {
        for (const sgn of [1, -1]) {
          const areaQ = (d[t1] * d[t2]) / (QUAD * QUAD);
          for (let ii = 0; ii < QUAD; ii++) {
            for (let jj = 0; jj < QUAD; jj++) {
              // Patch centre as a fraction of the edge, in [-0.5, 0.5]. At QUAD 2
              // this is exactly +-0.25, which is what the table used to hold.
              const u1 = (ii + 0.5) / QUAD - 0.5;
              const u2 = (jj + 0.5) / QUAD - 0.5;
              const n = [0, 0, 0]; n[na] = sgn;
              const o = [0, 0, 0];
              o[na] = 0.5 * sgn * d[na];
              o[t1] = u1 * d[t1];
              o[t2] = u2 * d[t2];
              faceTable[w] = n[0]; faceTable[w + 1] = n[1]; faceTable[w + 2] = n[2];
              faceTable[w + 3] = o[0]; faceTable[w + 4] = o[1]; faceTable[w + 5] = o[2];
              faceTable[w + 6] = areaQ;
              w += FACE_STRIDE;
            }
          }
        }
      }
    }
  }

  /** 1 where Rapier's own motor drives the joint; the PD skips those. */
  const solverDriven = new Uint8Array(plan.jointCount);
  const motorStiff = new Float64Array(plan.jointCount);
  const motorDampC = new Float64Array(plan.jointCount);
  /**
   * The N19 torque BUDGET per joint — MUSCLE_STRESS * A^1.5 * momentArm, purely
   * geometric. This is what N19 governs (see the decision block below); the gains
   * `motorStiff`/`motorDampC` may be shaped by inertia inside this budget. Exposed
   * so L1-18 can assert N19 on the budget rather than on the gain, which is the
   * only form of the assertion that survives the reference actuator.
   */
  const motorBudget = new Float64Array(plan.jointCount);
  /** Which solver joints had their gains reduced to honour 00 §9. Reported, not asserted from inside. */
  const motorBounded = new Uint8Array(plan.jointCount);
  // ── PER-STEP ACTUATOR DIAGNOSTICS (C1.2) ──────────────────────────────────
  // Filled each step by applyMotors on the solver path, so a probe can read the
  // realised tracking (want vs theta), the relative angular velocity, and the
  // reconstructed spring/damping torques against the budget — the numbers C1.2's
  // clamp is decided on and C1.4 accepts against. Reporting, never behaviour.
  const motorTheta = new Float64Array(plan.jointCount);
  const motorWant = new Float64Array(plan.jointCount);
  const motorRelOmega = new Float64Array(plan.jointCount);
  const motorSpringTau = new Float64Array(plan.jointCount);
  const motorDampTau = new Float64Array(plan.jointCount);
  const motorClamped = new Uint8Array(plan.jointCount);

  // ── THE TORUS — B2 §4.2 ─────────────────────────────────────────────────────
  //
  // THE FINDING THIS EXISTS FOR: the tank boundary is ABSORBING. 30 random
  // creatures over 240 s in the shipped tank — median speed decays 4x and the
  // median wall gap decays monotonically from 6.2 m to 1.8 m, with a third of
  // the corpus below 0.02 m/s in the final window. A creature random-walks,
  // reaches a wall, and has no mechanism to leave. It takes 2-4 minutes to
  // develop, which is why every 40 s test in this project showed nothing.
  //
  // AND EVERY TOOL IN THE TREE MEASURES WITH `bounded: false` WHILE THE GAME
  // RUNS BOUNDED. So the numbers were taken in open water and the tank the
  // player watches is a different world. The torus is the third option: a finite
  // volume with no boundary, which is the one that makes a long measurement mean
  // something.
  //
  // WRAPPING IS SAFE HERE FOR A SPECIFIC REASON — creatures do not interact.
  // There is one creature per simulation and no creature-creature contact until
  // step D, so a body translated by the world extent cannot land inside anything.
  // The day that stops being true this needs a periodic broad-phase, not a
  // translate.
  //
  // ATOMIC, AND ON THE CENTRE OF MASS. Every body of the creature moves by the
  // same vector, between steps, decided by where the CENTRE crossed — never
  // per-body, which would tear a creature in half across the seam. Velocities
  // and orientations are untouched: a translation is not a physical event and
  // the creature must not be able to feel it.
  //
  // §4.3 — WHAT MUST NOT HAPPEN. No repulsive field, no scripted turn-at-wall,
  // no clamp on position. The constraint is that creatures are interacted with
  // without anything being prescripted, and a soft wall force would quietly
  // become the reason they appear to navigate.
  /** 00 §9 on the solver path. See the motor setup block. Off ONLY for measurement. */
  const boundTorque = opts.boundTorque ?? true;
  const wrap = opts.wrap ?? false;
  const wrapExtent = opts.wrapExtent ?? world.tankBounds;
  const wrapShift = [0, 0, 0];
  let wrapCount = 0;

  function rawCentre() {
    let m = 0, x = 0, y = 0, z = 0;
    for (const rb of bodies) {
      const bm = rb.mass();
      const p = rb.translation();
      m += bm; x += p.x * bm; y += p.y * bm; z += p.z * bm;
    }
    return m > 0 ? [x / m, y / m, z / m] : [0, 0, 0];
  }

  function wrapCreature() {
    const c = rawCentre();
    let dx = 0, dy = 0, dz = 0;
    const half = [wrapExtent[0] / 2, wrapExtent[1] / 2, wrapExtent[2] / 2];
    const cen = [origin[0], origin[1], origin[2]];
    // A single extent per axis, not a modulo. One step cannot cross more than
    // one period — clampKinematics caps speed at one wall thickness per step —
    // so a loop would only ever hide a violation of that bound.
    if (c[0] - cen[0] > half[0]) dx = -wrapExtent[0]; else if (c[0] - cen[0] < -half[0]) dx = wrapExtent[0];
    if (c[1] - cen[1] > half[1]) dy = -wrapExtent[1]; else if (c[1] - cen[1] < -half[1]) dy = wrapExtent[1];
    if (c[2] - cen[2] > half[2]) dz = -wrapExtent[2]; else if (c[2] - cen[2] < -half[2]) dz = wrapExtent[2];
    if (dx === 0 && dy === 0 && dz === 0) return;

    for (const rb of bodies) {
      const p = rb.translation();
      rb.setTranslation({ x: p.x + dx, y: p.y + dy, z: p.z + dz }, true);
    }
    // The shift is recorded with the OPPOSITE sign, so that adding it to the raw
    // centre reconstructs the position in an unbounded tank.
    wrapShift[0] -= dx; wrapShift[1] -= dy; wrapShift[2] -= dz;
    wrapCount++;
  }

  const massOf = new Float64Array(plan.bodyCount);
  const inertiaOf = new Float64Array(plan.bodyCount);
  for (let i = 0; i < bodies.length; i++) {
    massOf[i] = bodies[i].mass();
    const I = bodies[i].principalInertia();
    inertiaOf[i] = Math.min(I.x, I.y, I.z);
  }

  // Joints. Rapier gets the CONSTRAINT; actuation is an explicit PD torque
  // applied below, not a Rapier motor. Rapier's AccelerationBased motor model
  // normalises by inertia, which would make torque independent of body size and
  // defeat N19 outright; ForceBased would work but hides the law that N19 is
  // about. Applying the torque ourselves keeps 10 §A7 legible and assertable.
  const joints = [];
  const jointAxes = [];   // spawn-frame axis per joint, precomputed (N4)
  for (const j of plan.joints) {
    const jd = makeJointData(RAPIER, j, plan);
    const handle = w.createImpulseJoint(jd, bodies[j.parentBody], bodies[j.childBody], true);

    // ── SOLVER-SIDE MOTOR (reference parity) ─────────────────────────────────
    //
    // The reference drives joints with a RotationMotor CONSTRAINT, solved
    // implicitly. We integrated a PD outside the solver, and it saturated its
    // torque clamp 52% of the time — a saturated PD is a relay, and relays
    // limit-cycle. That was measured as the root cause of every locomotion
    // problem since session 1.
    //
    // ForceBased, not AccelerationBased, and that choice IS N19: a force-based
    // motor applies a torque, so a heavier limb accelerates less, while an
    // acceleration-based one would ignore inertia entirely and make motor
    // strength track nothing at all.
    //
    // N19 SURVIVES THE MOVE. The stiffness is the same muscle torque budget the
    // clamp used — MUSCLE_STRESS * A^(3/2) * momentArm — so torque still comes
    // from the joint's own cross-section and never from mass. Only the
    // INTEGRATION moved into the solver, which is not what N19 was about.
    //
    // Rapier's JS binding exposes motors on revolute-family joints only;
    // spherical has no configureMotorPosition. As of B2 §3.1 the slice set is
    // ['revolute', 'twist'] and spherical is dropped, so every slice joint is
    // solver-drivable and the PD relay is no longer a per-type fallback. It
    // stays as the fallback for the schema's other types, which step F restores.
    //
    // ── DECISION, IN WRITING — B2 §12: THE TORQUE BOUND ON THE SOLVER PATH ──
    //
    // 00 §9 requires bounded actuator power. It is enforced on the PD path by a
    // final clamp to maxTorque plus the Hill force-velocity term. IT IS NOT
    // ENFORCED HERE, and the reason is visible two lines below: the budget goes
    // into STIFFNESS — torque per unit tracking error — not into torque. Torque
    // is then `stiff * error`, and nothing bounds `error`, so nothing bounds the
    // torque.
    //
    // §12 offers two ways out: re-impose the bound outside the solver, or amend
    // 00 §9 for this path. THE DECISION IS TO RE-IMPOSE, and 00 §9 stands
    // unamended. The reason is not conservatism about the spec:
    //
    //   - §0.2's whole PD-vs-solver comparison — p50 0.100 against 0.015, the
    //     measurement the actuator decision rests on — is only a comparison if
    //     both paths get the same energy budget. Two actuators with different
    //     power bounds do not measure "efficiency versus speed", they measure
    //     which one was allowed more energy, and the 7x would be uninterpretable.
    //   - N19 says joint strength comes from geometry and never from mass, and
    //     L1-18 asserts it. The `budget` below honours that. An UNBOUNDED torque
    //     does not violate N19 so much as make it vacuous.
    //   - B3's peak-speed tail is the standing evidence for what an unbounded
    //     actuator does to this simulation.
    //
    // HOW, when chantier 2 implements it. `setMotorMaxForce` is absent from this
    // binding — checked, not assumed — so the cap cannot be handed to the solver
    // and must be imposed on the stiffness instead. The tracking error IS
    // bounded: setLimits holds each driven joint inside +-angleLimits[0], so the
    // worst error against a target inside that range is 2*angleLimits[0], and
    //     stiff <= budget / (2 * angleLimits[0])
    // bounds the delivered torque by the same muscle budget the PD clamp uses,
    // analytically, with no per-step work. Degenerate case: angleLimits[0] near
    // zero gives an unbounded stiffness, so it needs a floor — which is a
    // measurement, and measurements belong with the rest of chantier 2.
    //
    // NOT DONE HERE. The solver is not the default motor yet, so this path is
    // exercised by no shipped measurement, and §3.2 already binds the change to
    // the session that defaults it — together with `work` accumulating on this
    // path and L1-18's model-agnostic treatment. Landing an untested physics
    // change on a dormant path ahead of the measurements that would catch it is
    // how the B3 tail happened.
    //
    // ── N19 DECISION, IN WRITING — C1.1 (B3). RESOLVED, no longer owed. ────────
    //
    // The `motorFreqHz` branch below sets the gains from `inertiaOf[j.childBody]`,
    // which is mass-derived. N19 was raised against it three sessions running and
    // deferred each time with the branch default-off. C1 defaults it, so the
    // question is answered here rather than deferred a fourth time.
    //
    // THE DECISION: N19 constrains where the torque BUDGET comes from — geometry,
    // area, never mass — and not the RESPONSE SHAPE the joint delivers inside that
    // budget. The budget is `MUSCLE_STRESS * A^1.5 * momentArm` in BOTH branches
    // and bounds the delivered torque (the 00 §9 clamp below); the (omega_n, zeta)
    // that shape how the joint tracks inside it may come from the limb's inertia.
    // A bigger limb still gets its strength from its cross-section; a heavier limb
    // still accelerates less under the same torque — which is what N19 means. This
    // is exactly what the reference does: MaxImpulse = 2 * MinCrossSectionalArea is
    // the budget, SpringFrequency 10 Hz / DampingRatio 0.9 is the response.
    //
    // WHY IT IS NOT A DODGE: a mass-derived BUDGET would let a dense creature push
    // harder for free, which is the pay-to-win N19 forbids. A mass-derived
    // RESPONSE only decides how fast a joint converges on its target within a
    // budget it did not enlarge — the peak torque a dense joint can exert is the
    // same as a light one of the same cross-section. L1-18 is rewritten to assert
    // N19 on the budget (geometric, mass-independent) and to allow the gain to be
    // inertia-shaped, because asserting mass-independence of the GAIN would forbid
    // the reference actuator outright and is not what N19 claims.
    // N19 spec amended to match — see design/VIVARIUM_20_TRUNK.md.
    if (motorMode === 'solver' && handle.configureMotorPosition) {
      const A = j.minCrossSectionalArea;
      // The clamp ceiling carries `budgetScale`; the DEFAULT-branch gains below
      // use the raw `budget`, so budgetScale loosens the clamp without inflating
      // the gain. In the motorFreqHz branch the gains are inertia-derived and do
      // not see the budget at all, so the two are fully decoupled there.
      const budget = MUSCLE_STRESS * A * Math.sqrt(A) * momentArm;
      motorBudget[j.index] = budget * budgetScale;
      handle.configureMotorModel(RAPIER.MotorModel.ForceBased);
      if (motorFreqHz !== null) {
        // Reference parametrisation: the joint is specified by its RESPONSE, and
        // the torque it needs to deliver that response follows from the limb.
        // I is the child's smallest principal inertia — the same conservative
        // choice the drag limiter makes, so the fastest axis is the one tuned.
        // N19: this shapes the response; the budget above still caps the torque.
        const wn = 2 * Math.PI * motorFreqHz;
        const I = inertiaOf[j.childBody];
        motorStiff[j.index] = motorScale * I * wn * wn;
        motorDampC[j.index] = motorScale * 2 * motorZeta * I * wn;
      } else {
        motorStiff[j.index] = motorScale * budget * kStiff;
        motorDampC[j.index] = motorScale * budget * kDamp;
      }

      // ── BOUNDED ACTUATOR POWER ON THE SOLVER PATH (00 §9) — C1.2 ───────────
      //
      // THE DECISION IS ABOVE; THE IMPLEMENTATION MOVED. The old bound scaled k
      // and c down by ceiling/worst so the WORST-CASE torque fit the budget.
      // Measured (tools/_zladder.mjs), that cost the gain a factor of ~3.7 to pay
      // for a large-error transient steady swimming almost never reaches — and,
      // worse, it clamped the reference parametrisation's inertia-derived gains
      // straight back down to the budget, so `motorFreqHz: 10` under this bound
      // tracked at gain 0.23, no better than the shipped default. The bound WAS
      // the reason normalising the actuator bought nothing.
      //
      // THE BOUND NOW LIVES IN applyMotors AS A PER-STEP CLAMP ON THE COMMANDED
      // ERROR, not on the gain. `setMotorMaxForce` is absent from this binding, so
      // the cap cannot be handed to the solver; but the spring torque is
      // k*(target - theta), and clamping the target so |k*(eff - theta)| never
      // exceeds `motorScale * budget` bounds the SPRING torque exactly, per step,
      // at one clamp per joint — and costs NOTHING in the linear region, where the
      // error is small and the clamp does not bind. The joint tracks at its full
      // designed stiffness and saturates at the budget, which is what a muscle
      // does. So k and c are left at their DESIGNED values here; the ceiling
      // travels to the clamp in `motorBudget[j.index]`, set above.
      //
      // DAMPING RIDES AS PASSIVE DISSIPATION. The clamp bounds the active/spring
      // term; the solver's implicit damping is dissipative and, being inside the
      // constraint solver, cannot ring (the divergence that motivated the old
      // total-torque clamp was on the EXPLICIT PD path). Measured realised
      // |omega_rel| is p50 ~0.35, p95 ~1.3-2.2 rad/s against OMEGA_MAX 10, and the
      // damping torque it produces is p95 ~0.5*budget on the authored corpus —
      // modest, and dissipative, so it is not reserved against. This is the 00 §9
      // decision for this path: bound the active torque to the muscle budget, let
      // passive viscoelastic damping dissipate on top, exactly as the PD path's
      // Hill factor scales only the active term while damping keeps its budget.
      // `boundTorque: false` disables the clamp (applyMotors) and still means
      // "unbounded", so every pre-bound solver figure stays reproducible.
      handle.configureMotorPosition(0, motorStiff[j.index], motorDampC[j.index]);
      solverDriven[j.index] = 1;
    }

    // Jointed limbs OVERLAP BY CONSTRUCTION. 10 §A6's overlap rejection exempts
    // the parent — "face contact with the parent is normal" — so a child box may
    // interpenetrate its parent's box deeply. 10 §A6 grants the exemption and
    // never says the matching contact must be switched off; this is where it is
    // switched off, so the rule is stated in code rather than inherited.
    //
    // HONEST NOTE: measured against rapier3d-compat 0.19.3, two deeply
    // overlapping jointed cuboids generate no separation response even with
    // `contactsEnabled` left at its default of true, so this line is currently
    // defensive rather than load-bearing. The spawn jolts that were measured at
    // up to 4500 m/s came from the joint rest frames above, not from contacts.
    // The line stays because the invariant is ours to state, not Rapier's to
    // keep, and L1-19 asserts the property directly.
    if (handle.setContactsEnabled) handle.setContactsEnabled(false);

    if (handle.setLimits && j.type !== 'spherical' && j.type !== 'rigid') {
      handle.setLimits(-j.angleLimits[0], j.angleLimits[0]);
    }
    joints.push(handle);
    jointAxes.push(jointAxisAtSpawn(j, plan));
  }

  const phases = computePhases(plan);
  const targets = new Float64Array(plan.jointCount);

  // C1 — the mutable control input. Probes and duels write `effort` and
  // `turnBias` between steps; `sides` is computed once (N4). At the defaults
  // (effort 1, turnBias 0) `targetAngles` executes B3's arithmetic unchanged.
  const control = makeControl(plan, opts);

  // ── N4, STATED HONESTLY (H8) ───────────────────────────────────────────────
  //
  // There was a preallocated `scratch` object here, introduced with the comment
  // "no allocation inside the step loop (N4)". NOTHING EVER READ IT. It was
  // ceremony: a claim in the shape of code, which is worse than no claim at all,
  // because a reader takes it as evidence and it is evidence of nothing.
  //
  // What the loop actually does, measured rather than asserted: ~173 bytes per
  // step retained on a 6-body, 5-joint creature over 20 000 steps. `qmul` and
  // `qrot` return fresh arrays, Rapier's accessors hand back fresh wrapper
  // objects, and both are called per body and per joint per step.
  //
  // So the real invariant is BOUNDED allocation, not zero: nothing here grows
  // with time or with the number of steps taken, and the per-step cost is a
  // function of body and joint count alone. That is what the code delivers and
  // it is what the comment now says. Chasing literal zero would mean scalarising
  // every quaternion call site — a change that touches every number the project
  // has measured, for a garbage rate a generational collector absorbs without
  // noticing. If a profile ever says otherwise, that is the moment to spend it.
  // What must not happen again is a promise the code does not keep.

  let t = 0, steps = 0;
  let work = 0;
  let motorSteps = 0, motorSaturated = 0;   // joules, sum |tau . omega| dt (01 §7) — S2 reads this at C1

  // ── kinematic ceiling, DERIVED and not tuned ────────────────────────────────
  //
  // A body moving faster than one wall thickness per step can cross a wall
  // between two collision queries, so WALL / FIXED_DT is the speed above which
  // the arena stops being solid at all. Nothing physical happens up there; it is
  // where the discretisation stops describing anything.
  //
  // WHY IT IS NEEDED NOW, and it is a real consequence of the amended §A8 rather
  // than a patch over it. The old law carried an ad-hoc angular term
  // proportional to r^5, which damped every rotation hard regardless of shape.
  // The per-face law derives rotational resistance instead, and derives it
  // CORRECTLY: a thin plate spinning about its own face normal presents only its
  // edges to the flow and meets almost nothing. That is right — a frisbee does
  // spin nearly freely — but the joint motors will then drive omega without
  // bound, and omega x r at the corners feeds the fluid term speeds that no
  // guard on the fluid term itself can be blamed for. Peak spin reached 1.5e22
  // rad/s before this existed.
  //
  // The angular ceiling is PER BODY, from the same rule: the fastest-moving
  // point on a limb is its corner, so the limit is the linear ceiling divided by
  // the corner radius. A small limb may spin faster than a large one, which is
  // the correct shape for this bound.
  // Two ceilings, and the lower wins. WALL/FIXED_DT stops a body crossing a wall
  // in one step (tunnelling). STABLE_SPEED is the MYRIAPOD-FIX stability net: a
  // small fraction of bred morphologies pump energy through the actuator and, left
  // unchecked, run away to the tunnelling ceiling (~60 m/s) and tear their own
  // joints apart. No actuator gain avoids this for every body (tools/_zstab.mjs:
  // ~15% blow up under any strong gain), so the sim caps the runaway well below
  // the tearing regime. A swimmer does < 1 m/s and never feels it; a pumper is
  // held at a bounded thrash it cannot rip itself apart at. `stableSpeed` opt
  // exposes it for measurement; default is the constant.
  const MAX_SPEED = Math.min(WALL / FIXED_DT, opts.stableSpeed ?? STABLE_SPEED);
  const maxSpin = new Float64Array(plan.bodyCount);
  for (let i = 0; i < plan.bodies.length; i++) {
    const d = plan.bodies[i].dims;
    maxSpin[i] = MAX_SPEED / (0.5 * Math.hypot(d[0], d[1], d[2]));
  }

  function clampKinematics() {
    for (let i = 0; i < plan.bodies.length; i++) {
      const rb = bodies[i];
      const v = rb.linvel();
      const sp = Math.hypot(v.x, v.y, v.z);
      if (sp > MAX_SPEED && Number.isFinite(sp)) {
        const k = MAX_SPEED / sp;
        rb.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
      }
      const a = rb.angvel();
      const asp = Math.hypot(a.x, a.y, a.z);
      if (asp > maxSpin[i] && Number.isFinite(asp)) {
        const k = maxSpin[i] / asp;
        rb.setAngvel({ x: a.x * k, y: a.y * k, z: a.z * k }, true);
      }
    }
  }

  function applyEnvironment() {
    for (let i = 0; i < plan.bodies.length; i++) {
      const b = plan.bodies[i];
      const rb = bodies[i];
      const vol = b.dims[0] * b.dims[1] * b.dims[2];
      const m = massOf[i];
      const I = inertiaOf[i];

      // Weight down, buoyancy up, both PER BODY (10 §A4). A creature can
      // therefore carry a light anterior float and a dense posterior keel, and
      // swim bladders emerge without being named.
      //
      // In W1 this is currently ZERO for every body: SLICE_LIMITS.density is
      // [1, 1] and mediumDensity is 1.0, so the term cancels exactly and gravity
      // is dead code here. It is kept because it is the LAW, and the thick-gas
      // world at step F restores a real density band that needs it.
      const net = (world.mediumDensity - b.density) * vol * world.gravity;
      if (net !== 0) rb.addForce({ x: 0, y: net, z: 0 }, true);

      if (m <= 0 || I <= 0) continue;

      // ── the fluid, sampled PER FACE ────────────────────────────────────────
      //
      // 10 §A8 AS AMENDED. The previous law applied one force at the body
      // CENTRE, opposing the body's LINEAR velocity, with the true projected
      // area. Orientation-dependent area was necessary but nowhere near
      // sufficient, and the measurement said so: median locomotion 0.158 m in
      // 15 s against a 6-8 m duel separation, and body plan did not predict
      // travel at all (Spearman |rho| <= 0.16 against wetted area, aspect ratio
      // and body count). Two things were missing and both are structural.
      //
      //   1. LOCAL VELOCITY. The flow a surface meets is v + omega x r, not v.
      //      A limb rotating about its own centre has zero centre-of-mass
      //      velocity and therefore met NO drag at all under the old law. That
      //      is most of the missing thrust: a paddle felt nothing.
      //   2. APPLICATION POINT. A force applied at the centre of mass produces
      //      no torque, so rotational resistance had to be invented separately
      //      as an ad-hoc r^5 term with a tuned 0.4. Applying each face force AT
      //      that face makes the torque fall out of the same law, and the ad-hoc
      //      term is deleted.
      //
      // One-sided, as in the reference: a face whose normal points away from the
      // local flow contributes nothing. That asymmetry is what lets a full
      // stroke cycle net a non-zero impulse instead of cancelling.
      //
      // NO SEPARATE LIFT TERM, and that is now a MEASURED decision rather than a
      // deferred one. The drag term along -n already carries the cross-flow force;
      // the reference's Cl block is a different decomposition and adding it on top
      // reverses the result. Full derivation and the measurement at the face loop
      // below. (The older reason recorded here — that a perpendicular impulse
      // escapes a magnitude clamp by Pythagoras — is true, and is NOT why the term
      // is gone: the guard was fixed years of sessions ago and the term is simply
      // wrong. See HYDRODYNAMICS.md §23-25 for the superseded reasoning.)
      const lv = rb.linvel();
      const av = rb.angvel();
      const q = rb.rotation();
      // Limb orientation in world = body rotation composed with the collider's.
      const lq = qmul([q.x, q.y, q.z, q.w], b.rotation);

      // One rotation MATRIX per body per step, then 9 multiplies per vector.
      // Rotating 48 vectors by quaternion instead costs ~3x this (N4).
      const x = lq[0], y = lq[1], z = lq[2], w = lq[3];
      const m00 = 1 - 2 * (y * y + z * z), m01 = 2 * (x * y - z * w), m02 = 2 * (x * z + y * w);
      const m10 = 2 * (x * y + z * w), m11 = 1 - 2 * (x * x + z * z), m12 = 2 * (y * z - x * w);
      const m20 = 2 * (x * z - y * w), m21 = 2 * (y * z + x * w), m22 = 1 - 2 * (x * x + y * y);

      const rho = world.mediumDensity * world.dragScale * world.dragCoefficient;
      let fx = 0, fy = 0, fz = 0, tx = 0, ty = 0, tz = 0;
      const base = i * FACE_N * FACE_STRIDE;
      for (let k = 0; k < FACE_N; k++) {
        const o = base + k * FACE_STRIDE;
        const nlx = faceTable[o], nly = faceTable[o + 1], nlz = faceTable[o + 2];
        const olx = faceTable[o + 3], oly = faceTable[o + 4], olz = faceTable[o + 5];
        const area = faceTable[o + 6];

        const nx = m00 * nlx + m01 * nly + m02 * nlz;
        const ny = m10 * nlx + m11 * nly + m12 * nlz;
        const nz = m20 * nlx + m21 * nly + m22 * nlz;
        const rx = m00 * olx + m01 * oly + m02 * olz;
        const ry = m10 * olx + m11 * oly + m12 * olz;
        const rz = m20 * olx + m21 * oly + m22 * olz;

        // The flow this quadrant actually meets.
        const px = lv.x + (av.y * rz - av.z * ry);
        const py = lv.y + (av.z * rx - av.x * rz);
        const pz = lv.z + (av.x * ry - av.y * rx);

        // Normal component, signed. Negative means the face is retreating from
        // the flow and is shielded by the body: it contributes nothing.
        const vn = px * nx + py * ny + pz * nz;
        if (vn <= 0) continue;

        // Sample speed, kept as a GUARD only. The reference skips a sample below
        // MinSpeedSq = 1e-3; removing the guard would change trajectories at the
        // 1e-6 level, which L1-17's byte-identical determinism WOULD see, so it
        // stays even though nothing reads the speed itself any more.
        const sp2 = px * px + py * py + pz * pz;
        if (sp2 < 1e-6) continue;

        // Quadratic in the NORMAL component only, along the inward normal.
        const mag = 0.5 * rho * area * vn * vn;
        const Fx = -mag * nx, Fy = -mag * ny, Fz = -mag * nz;

        // ── THERE IS NO LIFT TERM HERE, AND THE REFERENCE'S MUST NOT BE PASTED
        // BACK. F2, measured by tools/_zplate.mjs. ────────────────────────────
        //
        // This law applies drag along -n, which ALREADY CONTAINS the correct
        // Newtonian lift. Decompose the unit normal into along-flow and
        // cross-flow parts, n = c*u + sqrt(1-c^2)*d, and the cross-flow force
        // falls out of the drag term by itself:
        //
        //     F_drag = -mag*n = -mag*c*u  -  mag*sqrt(1-c^2)*d
        //                        ^drag       ^ THIS IS ALREADY LIFT
        //
        // The reference's Cl block belongs to a DIFFERENT decomposition — drag
        // along -u, lift perpendicular to u, with an incidence-dependent
        // Cd = 0.5 + 1.5(1-|c|)^2. You may use either decomposition. You may not
        // mix them, and mixing them is what the port did:
        //
        //   its liftDir = (u x n) x u / |u x n|  is by BAC-CAB exactly
        //   (n - c*u)/sqrt(1-c^2) = +d — the SAME AXIS as the drag term's
        //   cross-flow component, opposite sign — while liftMag/mag =
        //   1.2*sqrt(1-c^2) against that component's own 1.0*sqrt(1-c^2).
        //
        // MEASURED, not derived: the combination cuts a plate's cross-flow force
        // to 20% AND REVERSES it, at every incidence from 5 to 75 degrees, ratio
        // -0.200 to three figures. It pushes the plate toward its WINDWARD side;
        // a real hydrofoil lifts toward its LEEWARD one. Gate L1-45 asserts that
        // sign, so pasting the block back turns the gate red rather than quietly
        // reversing every fin in the corpus.
        //
        // Circulatory lift (Cl ~ 2*pi*alpha, with a stall model) is a DIFFERENT
        // term and is not this one. It belongs after added mass (C6.2): hydrofoil
        // fins are only meaningful once fins have the right inertia.

        fx += Fx; fy += Fy; fz += Fz;
        tx += ry * Fz - rz * Fy;
        ty += rz * Fx - rx * Fz;
        tz += rx * Fy - ry * Fx;
      }

      if (fx === 0 && fy === 0 && fz === 0 && tx === 0 && ty === 0 && tz === 0) continue;

      // ── the energy guard, solved rather than clamped ──────────────────────
      //
      // The continuous law is strictly dissipative: every sample contributes
      // F_i . v_i = -mag * vn <= 0, and the rigid-body power is exactly the sum
      // of those, so P = F.v + T.omega <= 0 identically. Only the DISCRETE step
      // can add energy, by overshooting.
      //
      // Over one explicit step the kinetic energy changes by
      //     dE = P*dt + 0.5*dt^2*(|F|^2/m + |T|^2/I)
      // so scaling the fluid force and torque by s gives
      //     dE(s) = s*P*dt + 0.5*s^2*dt^2*Q,   Q = |F|^2/m + |T|^2/I
      // and dE(s) <= 0 for s <= -2P/(dt*Q). Taking s = min(1, that) makes the
      // step provably non-increasing in energy, with no tuned constant and no
      // clamp that distorts the law when it was already valid.
      //
      // THIS REPLACES the old per-term 1/(1+lambda*dt) factor, which worked only
      // because that law's force was antiparallel to v by construction. It is
      // not, here — and that is the point, because a force with a component
      // across the motion is exactly how a fin converts spin into travel.
      //
      // inertiaOf is the MINIMUM principal inertia, so Q is over-estimated and
      // the guard errs toward clamping. Conservative is the right direction.
      const P = fx * lv.x + fy * lv.y + fz * lv.z + tx * av.x + ty * av.y + tz * av.z;
      const Q = (fx * fx + fy * fy + fz * fz) / m + (tx * tx + ty * ty + tz * tz) / I;
      let sc = 1;
      if (Q > 0) {
        if (P >= 0) sc = 0;                                  // cannot happen in theory
        else sc = Math.min(1, (-2 * P) / (FIXED_DT * Q));
      }

      // AND THE IMPULSE MAY NOT EXCEED THE MOMENTUM IT OPPOSES. The energy
      // condition alone is not enough, and the gate caught it: an EXACT velocity
      // reversal is energy-neutral, so dE <= 0 permits v -> -v, which is the
      // precise mechanism B3 diverged by — reverse, overshoot, reverse larger.
      // At 1e5 m/s the free-body test reversed to -1.03e5 and the energy guard
      // was satisfied throughout.
      //
      // This is the old law's 1/(1+lambda*dt) guarantee restated in a form that
      // does not require the force to be antiparallel to v: cap the impulse at
      // the momentum, and the sign cannot flip. The two caps are independent —
      // energy bounds growth, momentum bounds reversal — and the smaller wins.
      // THE BOUND IS ON THE COMPONENT THE IMPULSE OPPOSES, not on the total speed.
      //
      // This was `sc <= m*|v| / (dt*|F|)` and `sc <= I*|omega| / (dt*|T|)`, using
      // the body's TOTAL linear and angular speed. That is degenerate, and C6.4
      // detonated it: a translating box has zero fluid torque only in EXACT
      // arithmetic — at 4x4 quadrature the +-0.125/+-0.375 patch offsets leave a
      // ~1e-17 residue instead of cancelling — so |T| became a denormal while
      // |omega| was 0, sc went to 0, and the guard threw away the ENTIRE fluid
      // force of every non-rotating body. Translation drag silently vanished.
      //
      // The cap exists to stop a REVERSAL (an exact velocity flip is
      // energy-neutral, so the energy guard permits it — that was B3's divergence
      // mechanism). Only the component of the velocity that the impulse OPPOSES
      // can be reversed, so that is what must be bounded. Where the impulse is
      // perpendicular to the motion, or accelerating it, there is nothing to
      // reverse and no cap belongs. A denormal torque now bounds a denormal
      // amount of counter-rotation instead of everything.
      const fm = Math.hypot(fx, fy, fz);
      if (fm > 0) {
        const opposed = -(fx * lv.x + fy * lv.y + fz * lv.z) / fm;   // >0 when F opposes v
        if (opposed > 0) sc = Math.min(sc, (m * opposed) / (FIXED_DT * fm));
      }
      const tm = Math.hypot(tx, ty, tz);
      if (tm > 0) {
        const opposed = -(tx * av.x + ty * av.y + tz * av.z) / tm;   // >0 when T opposes omega
        if (opposed > 0) sc = Math.min(sc, (I * opposed) / (FIXED_DT * tm));
      }

      if (!(sc > 0)) continue;

      rb.addForce({ x: fx * sc, y: fy * sc, z: fz * sc }, true);
      rb.addTorque({ x: tx * sc, y: ty * sc, z: tz * sc }, true);
    }
  }

  /**
   * Signed angle of the child relative to the parent, about the joint axis
   * EXPRESSED IN THE PARENT'S LOCAL FRAME (H9).
   *
   * THE AXIS MUST BE PARENT-LOCAL, AND WAS WORLD-SPACE. `qRel = conj(qp) * qc`
   * is the child's rotation relative to the parent, and its vector part is
   * therefore expressed in the PARENT'S frame. Projecting that onto a
   * world-space axis mixes two coordinate systems, and the two agree only while
   * the parent sits at its spawn orientation.
   *
   * Measured against this project's own vecmath, one articulation of 0.700 rad
   * held fixed while only the parent's global rotation varied:
   *
   *     parent rotation      world axis (was)     parent-local (is)
   *            0 deg              0.700                0.700
   *           30 deg              0.671                0.700
   *           60 deg              0.589                0.700
   *           90 deg              0.474                0.700
   *          180 deg              0.235                0.700
   *
   * The PD loop's error term is `(want - theta)`, so the effective position-loop
   * gain was a function of the creature's global pose — falling to about a third
   * at 180 deg. Corpus creatures average 78 deg of root tilt away from spawn and
   * peak past 110, so this was not a corner case; it was the normal operating
   * condition. A loop whose gain varies with pose is also indistinguishable from
   * one that is bandwidth-limited, which is what C1 concluded about `effort`.
   *
   * `jointAxes[i]` is already the axis in the parent body's frame and is already
   * precomputed, so the correction costs nothing. Torque is still applied about
   * `axisWorld`, which was always right — only the MEASUREMENT was wrong.
   */
  //
  // NO AXIS PARAMETER, DELIBERATELY. It used to take one, which is what made the
  // defect expressible: `axisWorld` was in scope at the call site and reads as
  // the obvious thing to pass. Mutation-testing the fix proved the point — with
  // the arithmetic pinned but the parameter still there, re-introducing the
  // original defect ESCAPED the gate, because the assertion tested the maths
  // with correct arguments while the bug lived in the call. The axis is now
  // looked up here, so the wrong frame is no longer something a caller can
  // choose.
  function relativeAngle(jointIndex) {
    const j = plan.joints[jointIndex];
    return swingTwistAngle(bodies[j.parentBody].rotation(), bodies[j.childBody].rotation(), jointAxes[jointIndex]);
  }

  /** Previous smoothed target per joint; the filter needs one step of state. */
  const prevTarget = new Float64Array(plan.jointCount);
  let targetPrimed = false;
  const smoothed = new Float64Array(plan.jointCount);

  /**
   * Slew-limit then low-pass the commanded targets (reference parity).
   * @param {Float64Array} raw
   * @returns {Float64Array}
   */
  function smoothTargets(raw) {
    const maxStep = TARGET_SLEW * FIXED_DT;
    if (!targetPrimed) { prevTarget.set(raw); targetPrimed = true; }
    for (let i = 0; i < raw.length; i++) {
      const d = raw[i] - prevTarget[i];
      const limited = prevTarget[i] + Math.min(maxStep, Math.max(-maxStep, d));
      prevTarget[i] += (limited - prevTarget[i]) * TARGET_FILTER;
      smoothed[i] = prevTarget[i];
    }
    return smoothed;
  }

  function applyMotors() {
    const raw = drive === DRIVE.VELOCITY
      ? targetVelocities(plan, genome, t, phases, targets, control)
      : targetAngles(plan, genome, t, phases, targets, control);

    // ── COMMAND SMOOTHING, from the reference ────────────────────────────────
    //
    // UpdateJointAngleActuatorsSystem.CalculateTargetAngle does two things we
    // did not, and it does them to the TARGET rather than to the torque:
    //
    //   1. a slew-rate limit — the commanded angle may not change faster than
    //      MAX_ANGULAR_VELOCITY (15 rad/s there);
    //   2. a low-pass filter — lerp(current, rateLimited, 0.8) every step.
    //
    // Both exist because a physical actuator cannot be commanded to step. Ours
    // could: the target came straight from a sine and the PD chased it with
    // whatever torque the clamp allowed. Measured before this: efficiency
    // (net displacement / COM path length) 0.022 against a fish's ~0.9, and
    // heading persistence -0.22 — consecutive seconds of travel ANTI-correlated,
    // which is oscillation in place rather than swimming.
    //
    // TARGET_SLEW is ours and derived rather than copied: a joint cannot be
    // commanded past what its muscle could follow, and OMEGA_MAX is already that
    // number. The reference's 15 is the same idea with its own actuator.
    const want = smooth ? smoothTargets(raw) : raw;

    for (let i = 0; i < plan.joints.length; i++) {
      const j = plan.joints[i];
      if (j.type === 'rigid') continue;

      // N19 — MOTOR STRENGTH SCALES WITH CROSS-SECTIONAL AREA, NOT MASS.
      // Mass goes with volume, strength with area. Getting this wrong makes all
      // creatures move alike regardless of size, because torque and inertia
      // would then cancel.

      // The axis is stored in the parent's SPAWN frame (see jointAxisAtSpawn)
      // and carried into world space by the parent's current rotation.
      const qp = bodies[j.parentBody].rotation();
      const axisWorld = qrot([qp.x, qp.y, qp.z, qp.w], jointAxes[i]);

      const avP = bodies[j.parentBody].angvel();
      const avC = bodies[j.childBody].angvel();
      const dwx = avC.x - avP.x, dwy = avC.y - avP.y, dwz = avC.z - avP.z;
      const relOmega = dwx * axisWorld[0] + dwy * axisWorld[1] + dwz * axisWorld[2];

      // The RESTORING term acts on the driven axis; the DAMPING term acts on the
      // WHOLE relative angular velocity, not just its projection.
      //
      // 10 §A17.2 gives each free angular DOF its own oscillator — a spherical
      // joint gets three phases, not one — and the slice controller drives one.
      // A PD that both drives and damps a single axis therefore leaves a
      // spherical joint's other two DOF entirely unobserved, and a torque held
      // along a fixed parent-frame axis while the child precesses about a
      // different one does net work over a cycle. Measured: one creature in the
      // corpus, a two-body spherical joint, wound from 4 rad/s to 1e21 over
      // fifteen seconds and took the whole simulation non-finite with it. It is
      // stable at MOTOR_SCALE 0.5 and diverges at 2.0, which is the signature of
      // a pump rather than a stiff constraint. Damping the full vector costs
      // nothing on the driven axis and makes the unobserved DOF dissipative,
      // which is also what a fleshy joint does.
      // ── how much torque a joint may produce (00 §9, bounded actuator power) ──
      //
      // 'scale'  maxTorque = motorScale * A. The shipped form, and MOTOR_SCALE
      //          1.0 has always been tuned rather than derived — the HANDOFF
      //          says so. It is dimensionally odd too: torque is [force][length]
      //          and A is [length]^2, so motorScale carries units of pressure x
      //          length and means nothing on its own.
      //
      // 'stress' maxTorque = MUSCLE_STRESS * A^(3/2). Derived. A muscle of
      //          cross-section A pulling at stress sigma exerts force sigma*A,
      //          and it inserts roughly one joint-radius from the axis, so the
      //          moment arm is sqrt(A) and the torque is sigma * A^(3/2). No new
      //          data is needed — the joint already knows its own cross-section.
      //
      // WHY THIS EXISTS: measured, travel rises monotonically with motorScale
      // (0.32 m at 0.25, 3.99 m at 64), and joints already OVERSHOOT their
      // targets, so this was never a tracking failure — the motors simply set
      // the energy budget and the shipped budget is far below muscle.
      // AND MUSCLE CANNOT PULL AT FULL FORCE WHILE SHORTENING FAST. The Hill
      // force-velocity relation: force falls roughly linearly with contraction
      // speed and reaches zero at the maximum shortening velocity. Leaving it
      // out is what made the first stress run blow up — peak spin 5185 rad/s
      // past a 343 rad/s ceiling — because a muscle sized realistically, with no
      // speed limit, accelerates a light limb without bound. The stress number
      // was right; the actuator was allowed to be infinitely fast.
      //
      // OMEGA_MAX is derived too, and it is size-independent, which is why it
      // needs no per-joint data. Muscle shortens at up to ~10 lengths per
      // second; the relevant length here is the moment arm sqrt(A), and the
      // shortening speed at the insertion is omega * sqrt(A). The sqrt(A)
      // cancels and the ceiling is ~10 rad/s for every joint regardless of size.
      // HILL APPLIES TO THE ACTIVE TERM ONLY, and getting that wrong is what
      // made the first attempt useless. Scaling the whole budget by fv also
      // scales the DAMPING term, so above OMEGA_MAX the joint produced neither
      // drive nor resistance and a limb that had been spun up simply coasted:
      // peak spin reached 732 rad/s against a 10 rad/s ceiling, and bodies
      // thrashed at a sustained 26.7 m/s while the creature travelled at
      // 0.19 m/s. Real muscle loses ACTIVE force as it shortens; the passive
      // viscoelasticity of the tissue does not disappear, and at high speed it
      // is what dominates. So fv multiplies the restoring torque and nothing
      // else, while damping and the final clamp keep the full structural budget.
      const A = j.minCrossSectionalArea;
      // motorScale MULTIPLIES whatever model is in force, and it must, because
      // `motorScale: 0` is how the gate and every diagnostic say "motors off".
      // The first stress implementation read motorScale only in the 'scale'
      // branch, so `motorScale: 0` silently left the motors running and L1-19
      // caught it: two deeply overlapping jointed limbs, meant to sit still,
      // picked up 1.6 mm/s of drive that had nothing to do with contact.
      const maxTorque = motorScale * (torqueModel === 'stress'
        ? MUSCLE_STRESS * A * Math.sqrt(A) * momentArm
        : A);
      const activeTorque = torqueModel === 'stress'
        ? maxTorque * Math.max(0, 1 - Math.hypot(dwx, dwy, dwz) / OMEGA_MAX)
        : maxTorque;

      let tx, ty, tz;
      if (drive === DRIVE.VELOCITY) {
        const s = activeTorque * kStiff * (want[i] - relOmega) * 0.5;
        tx = axisWorld[0] * s; ty = axisWorld[1] * s; tz = axisWorld[2] * s;
      } else {
        const theta = relativeAngle(i);
        const s = activeTorque * kStiff * (want[i] - theta);
        const d = maxTorque * kDamp;
        tx = axisWorld[0] * s - d * dwx;
        ty = axisWorld[1] * s - d * dwy;
        tz = axisWorld[2] * s - d * dwz;
      }

      // BOUNDED ACTUATOR POWER (00 §9). Clamping the TOTAL torque, not each term
      // separately, is the point: the damping term is proportional to relative
      // angular velocity and is otherwise unbounded, so a joint that gets spun
      // fast produces an enormous restoring torque, which spins it faster. That
      // is what took 5 of 12 creatures to NaN before this clamp. Now that the
      // damping term is a vector the clamp is on its magnitude.

      // A solver-driven joint gets its TARGET updated and nothing else — the
      // spring-damper lives inside the constraint solver, where it cannot ring.
      if (solverDriven[i]) {
        const thetaS = relativeAngle(i);

        // ── 00 §9 BOUND: CLAMP THE COMMANDED ERROR, NOT THE GAIN — C1.2 ───────
        // The spring torque is k*(eff - theta). Clamp the target so it never
        // exceeds the muscle budget `motorScale * motorBudget[i]`: the joint
        // tracks at its full designed stiffness and SATURATES at the budget only
        // when the error is large, instead of having its gain permanently divided
        // down (the old bound, which negated the reference parametrisation — see
        // the motor setup block and tools/_zladder.mjs). Costs one clamp per joint
        // and nothing in the linear region. `boundTorque: false` leaves it off, so
        // "unbounded" still reproduces every pre-bound solver figure.
        let eff = want[i];
        if (boundTorque && motorStiff[i] > 0) {
          const eMax = (motorScale * motorBudget[i]) / motorStiff[i];
          const e = want[i] - thetaS;
          const c = e < -eMax ? -eMax : (e > eMax ? eMax : e);
          eff = thetaS + c;
          motorClamped[i] = c !== e ? 1 : 0;
        } else {
          motorClamped[i] = 0;
        }
        joints[i].configureMotorPosition(eff, motorStiff[i], motorDampC[i]);

        // ── WORK ON THE SOLVER PATH — B2 §3.2, and it is an ESTIMATE ─────────
        //
        // Without this every solver measurement prints `n/a` for cost of
        // transport, which is the reason the solver could not be defaulted.
        //
        // Rapier computes the motor torque inside the constraint solver and the
        // JS binding does not expose the resulting impulse, so this RECONSTRUCTS
        // it from the same spring-damper law the solver was configured with:
        // tau = k*(target - theta) - c*omega_rel, about the driven axis. The
        // motor is axial on revolute and twist — the whole slice set as of §3.1
        // — so the scalar form is the analogue of the PD path's vector dot, not
        // a simplification of it.
        //
        // WHERE IT DIFFERS FROM THE TRUTH, and this must be carried rather than
        // forgotten: the implicit solver reaches its target within the step,
        // so the torque it actually delivers is the one that satisfies the
        // constraint at the END of the step, while this reads the state at the
        // START. The estimate therefore lags by one step and overstates work
        // during fast transients. It is exact in steady oscillation, which is
        // what a CPG produces and what every locomotion probe measures.
        //
        // CONSEQUENCE FOR COMPARISONS: cost of transport is comparable BETWEEN
        // SOLVER RUNS without qualification. Comparing a solver COT against a PD
        // COT compares a reconstruction against a measurement, and any claim
        // that rests on a difference smaller than a few percent is not entitled
        // to this number. §0.2's 7x is far outside that; a 1.05x would not be.
        // The spring torque is reconstructed from the CLAMPED target `eff`, so it
        // is the bounded torque the joint actually delivers.
        const springTau = motorStiff[i] * (eff - thetaS);
        const dampTau = -motorDampC[i] * relOmega;
        const tau = springTau + dampTau;
        work += Math.abs(tau * relOmega) * FIXED_DT;
        motorTheta[i] = thetaS; motorWant[i] = want[i]; motorRelOmega[i] = relOmega;
        motorSpringTau[i] = springTau; motorDampTau[i] = dampTau;
        motorSteps++;
        continue;
      }

      const mag = Math.hypot(tx, ty, tz);
      motorSteps++;
      if (mag > maxTorque) {
        motorSaturated++;
        const f = maxTorque / mag;
        tx *= f; ty *= f; tz *= f;
      }

      bodies[j.childBody].addTorque({ x: tx, y: ty, z: tz }, true);
      bodies[j.parentBody].addTorque({ x: -tx, y: -ty, z: -tz }, true);

      work += Math.abs(tx * dwx + ty * dwy + tz * dwz) * FIXED_DT;
    }
  }

  return {
    world: w,
    arena,
    bodies,
    colliders,
    joints,
    phases,
    environment,
    bounded,
    fitsTank: fits,
    plan,
    genome,
    /** C1 — mutable: `{ effort, turnBias, sides }`. Written between steps. */
    control,
    /** Joint angle about its own axis, parent-local frame. Exposed for tools/_zturn.mjs. */
    relativeAngle,
    /** Capture is contact with the ROOT body (10 §7, 11 §6). This is it. */
    rootCollider: colliders[0],
    /** N22 — true only for creature-creature contacts. */
    isDamagingContact(handleA, handleB) {
      return !environmentHandles.has(handleA) && !environmentHandles.has(handleB);
    },
    get t() { return t; },
    get steps() { return steps; },
    get work() { return work; },

    /**
     * The gains the solver motors were configured with, and which of them the
     * 00 §9 bound reduced. EXPOSED FOR L1-18 (H3, the same reason viability's
     * free-run verdict is extracted): on the solver path first-step spin is NOT
     * proportional to torque, because an implicit spring's first-step response
     * is k*dt*e/(I + k*dt^2 + c*dt) and the denominator grows with k too. So
     * measuring the exponent through the integrator measures the integrator.
     * N19 is a statement about where the TORQUE BUDGET comes from, and this is
     * where the budget is.
     */
    get motors() { return { stiff: motorStiff, damp: motorDampC, bounded: motorBounded, budget: motorBudget }; },
    /** Per-step actuator diagnostics (C1.2), updated by the last applyMotors call. */
    get motorDiag() {
      return {
        theta: motorTheta, want: motorWant, relOmega: motorRelOmega,
        springTau: motorSpringTau, dampTau: motorDampTau, clamped: motorClamped,
        budget: motorBudget, stiff: motorStiff, damp: motorDampC,
      };
    },
    get saturation() { return motorSteps ? motorSaturated / motorSteps : 0; },

    /**
     * Everything this creature contributes to one step, WITHOUT solving.
     * A shared arena calls this on every occupant before its single `world.step()`
     * — see createArena().stepAll. Apply-then-solve per creature would let the
     * first mover see a world the second had not yet pushed on, and the duel
     * would then depend on argument order, which is exactly what K4 forbids.
     */
    applyForces() {
      // THE CLAMP BELONGS HERE TOO, and its absence was a real asymmetry: step()
      // clamped before and after its solve while the SHARED-ARENA path did not
      // clamp at all — so the duel, the one place two creatures collide and the
      // one place tunnelling actually matters, ran with no speed or spin ceiling.
      // Putting it here and in advanceClock() gives stepAll() the same
      // before-and-after discipline step() has. step() is untouched: it inlines
      // applyEnvironment/applyMotors rather than calling this, so solo
      // trajectories — and L1-17's byte-identical determinism — do not move.
      clampKinematics();
      applyEnvironment();
      applyMotors();
    },

    /** Clock bookkeeping, separated so the arena advances it after the solve. */
    advanceClock() {
      // The AFTER half of the pair above: the ceiling has to hold on the velocity
      // the solve PRODUCED, because that is what the next collision query sees.
      clampKinematics();
      t += FIXED_DT;
      steps++;
    },

    /**
     * Zero the clock and the work accumulator without rebuilding anything.
     * A probe settles first (11 §5) and then measures; the driven phase must
     * start at t = 0 or the oscillator jumps by whatever the settle consumed,
     * which is precisely the instantiation transient the settle exists to remove.
     */
    resetClock() {
      t = 0; steps = 0; work = 0;
    },

    step() {
      if (!ownsArena) {
        throw new Error('step() on a shared arena: call arena.stepAll([...]) instead');
      }
      clampKinematics();
      applyEnvironment();
      applyMotors();
      w.step();
      // AND AGAIN AFTER THE STEP. The ceiling exists so that the arena stays
      // solid, and the query that needs it is the NEXT step's collision
      // detection — so the bound has to hold on the velocity the step produced,
      // not merely the one it started from. Clamping only beforehand let a
      // single step of lift and motor torque carry a limb tip to 76 m/s past a
      // 60 m/s limit, which is how a body walks through a wall.
      clampKinematics();
      if (wrap) wrapCreature();
      t += FIXED_DT;
      steps++;
    },

    /**
     * Mass-weighted centre of the whole creature, in world space, UNWRAPPED.
     *
     * `wrapShift` is the total displacement the torus has removed, so this
     * returns where the creature would be in an infinite tank. That is what
     * makes the wrap invisible to every existing caller: `settle`, the
     * locomotion probes, `assessViability`, `_zwall` and every displacement
     * figure ever recorded read this function, and a wrapped creature's raw
     * centre jumps by a whole world extent in one step. Reporting the raw
     * position and asking each caller to compensate is the version of this that
     * silently corrupts one measurement in ten.
     *
     * `rawCentreOfMass` is available for anything that genuinely wants the
     * position inside the box — the renderer, and the wrap test itself.
     */
    centreOfMass() {
      const c = rawCentre();
      return [c[0] + wrapShift[0], c[1] + wrapShift[1], c[2] + wrapShift[2]];
    },

    rawCentreOfMass: rawCentre,

    /** Total displacement the torus has removed. [0,0,0] when not wrapping. */
    get wrapShift() { return wrapShift.slice(); },
    get wrapCount() { return wrapCount; },

    /** Pose for the renderer. Writes into `out` to avoid per-frame allocation. */
    readPose(out) {
      const dst = out || bodies.map(() => ({ p: [0, 0, 0], q: [0, 0, 0, 1] }));
      for (let i = 0; i < bodies.length; i++) {
        const p = bodies[i].translation(), q = bodies[i].rotation();
        dst[i].p[0] = p.x; dst[i].p[1] = p.y; dst[i].p[2] = p.z;
        // The body carries none of the limb's orientation; the collider does.
        // The renderer wants the limb, so hand back the composition.
        const lq = qmul([q.x, q.y, q.z, q.w], plan.bodies[i].rotation);
        dst[i].q[0] = lq[0]; dst[i].q[1] = lq[1]; dst[i].q[2] = lq[2]; dst[i].q[3] = lq[3];
      }
      return dst;
    },

    /**
     * Frees the Rapier world only if this simulation built it. A SHARED arena
     * outlives its occupants — a duel frees the arena once, after both creatures.
     */
    free() { if (ownsArena) arena.free(); },
  };
}
