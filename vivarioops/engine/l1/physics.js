// engine/l1/physics.js — Rapier, parameterised entirely by the World (10 §A4).
//
// PURITY: no clock, no rng, no DOM, no upward imports. Rapier arrives as an
// INJECTED, already-initialised namespace — `RAPIER.init()` is async and 01 §4
// forbids async in /engine/, so the caller awaits it and passes it in.
//
// UNITS (01 §7): density is relative to water = 1.0, and mass = density x volume.
// A 1 m^3 body at density 1.0 masses 1 kg, which is what Rapier's collider
// density gives directly. This is 1000x lighter than real water and it is
// deliberate: it is what makes 03 §5's totalMass 6000 kg and biomassBudget 300 kg
// yield a sensible population against a median creature mass of ~4.8 kg. The
// scale is internally consistent; only MOTOR_SCALE has to be tuned to it,
// because torque follows area (N19) and does not rescale with mass.

import { computePhases, targetAngles, targetVelocities, makeControl, DRIVE } from './controller.js';
import { qrot, qmul, normalise } from './vecmath.js';

export const FIXED_DT = 1 / 120;      // 01 §7, substepped

/**
 * Torque per square metre of joint cross-section, at unit stiffness.
 * Tuned against the unit convention above; it is the one constant that does not
 * scale with the density choice.
 */
export const MOTOR_SCALE = 1.0;
export const MOTOR_STIFFNESS = 1.0;
export const MOTOR_DAMPING = 0.12;

/**
 * The joint axis, in the frame the rigid bodies are actually spawned in.
 *
 * `j.axes` are PARENT-LOCAL, in morphogenesis's sense of "local" — the frame of
 * the parent LIMB. Bodies are spawned world-aligned (see createSimulation), so
 * the parent limb's orientation lives on its collider, not on its body, and the
 * axis has to be rotated out of limb space into body space before Rapier sees it.
 */
function jointAxisAtSpawn(j, plan) {
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
  // 24 sample points per limb — 6 faces x 4 quadrants — matching the reference
  // (mycoolfin/the-simsulator, ApplyFluidForcesSystem.cs). Each entry is a unit
  // normal in limb space, an offset from the limb centre in limb space, and the
  // area that quadrant carries. Flat arrays, stride 7, so the hot loop reads
  // contiguous memory and allocates nothing.
  //
  // DEVIATION FROM THE REFERENCE, deliberate: it places the face centre at
  // 0.5 * unitNormal WITHOUT scaling by the limb dimension, while scaling the
  // in-plane quadrant offsets. That is dimensionally inconsistent — a
  // 2.0 x 0.2 x 2.0 plate gets its +X face sampled 0.5 m out instead of 1.0 m,
  // so its torque arm is wrong by 2x. The normal offset is scaled here.
  const FACE_N = 24, FACE_STRIDE = 7;
  const faceTable = new Float64Array(plan.bodyCount * FACE_N * FACE_STRIDE);
  {
    //          normal axis, tangent 1, tangent 2
    const AXES = [[0, 1, 2], [1, 0, 2], [2, 0, 1]];
    for (let i = 0; i < plan.bodies.length; i++) {
      const d = plan.bodies[i].dims;
      let w = i * FACE_N * FACE_STRIDE;
      for (const [na, t1, t2] of AXES) {
        for (const sgn of [1, -1]) {
          const areaQ = 0.25 * d[t1] * d[t2];
          for (const ii of [-1, 1]) {
            for (const jj of [-1, 1]) {
              const n = [0, 0, 0]; n[na] = sgn;
              const o = [0, 0, 0];
              o[na] = 0.5 * sgn * d[na];
              o[t1] = 0.25 * ii * d[t1];
              o[t2] = 0.25 * jj * d[t2];
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
  let work = 0;   // joules, sum |tau . omega| dt (01 §7) — S2 reads this at C1

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
  const MAX_SPEED = WALL / FIXED_DT;
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
      // NO LIFT TERM YET, and its absence is deliberate rather than an
      // oversight. The reference carries Cl = 1.2|c|sqrt(1-c^2) perpendicular to
      // the flow, and it measures another ~6x on top of this. It also diverges
      // here: a force perpendicular to velocity cannot be bounded by clamping
      // its MAGNITUDE, because a perpendicular impulse at any bound still grows
      // |v| by Pythagoras — about 12% per step at the bound tested. It needs an
      // integration that rotates the velocity rather than adding to it. Kept out
      // until that exists; see HYDRODYNAMICS.md.
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

        // Quadratic in the NORMAL component only, along the inward normal.
        const mag = 0.5 * rho * area * vn * vn;
        const Fx = -mag * nx, Fy = -mag * ny, Fz = -mag * nz;
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
      const sp = Math.hypot(lv.x, lv.y, lv.z);
      const fm = Math.hypot(fx, fy, fz);
      if (fm > 0) sc = Math.min(sc, (m * sp) / (FIXED_DT * fm));
      const asp = Math.hypot(av.x, av.y, av.z);
      const tm = Math.hypot(tx, ty, tz);
      if (tm > 0) sc = Math.min(sc, (I * asp) / (FIXED_DT * tm));

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

  function applyMotors() {
    const want = drive === DRIVE.VELOCITY
      ? targetVelocities(plan, genome, t, phases, targets, control)
      : targetAngles(plan, genome, t, phases, targets, control);

    for (let i = 0; i < plan.joints.length; i++) {
      const j = plan.joints[i];
      if (j.type === 'rigid') continue;

      // N19 — MOTOR STRENGTH SCALES WITH CROSS-SECTIONAL AREA, NOT MASS.
      // Mass goes with volume, strength with area. Getting this wrong makes all
      // creatures move alike regardless of size, because torque and inertia
      // would then cancel.
      const maxTorque = motorScale * j.minCrossSectionalArea;

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
      let tx, ty, tz;
      if (drive === DRIVE.VELOCITY) {
        const s = maxTorque * MOTOR_STIFFNESS * (want[i] - relOmega) * 0.5;
        tx = axisWorld[0] * s; ty = axisWorld[1] * s; tz = axisWorld[2] * s;
      } else {
        const theta = relativeAngle(i);
        const s = maxTorque * MOTOR_STIFFNESS * (want[i] - theta);
        const d = maxTorque * MOTOR_DAMPING;
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
      const mag = Math.hypot(tx, ty, tz);
      if (mag > maxTorque) {
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
     * Everything this creature contributes to one step, WITHOUT solving.
     * A shared arena calls this on every occupant before its single `world.step()`
     * — see createArena().stepAll. Apply-then-solve per creature would let the
     * first mover see a world the second had not yet pushed on, and the duel
     * would then depend on argument order, which is exactly what K4 forbids.
     */
    applyForces() {
      applyEnvironment();
      applyMotors();
    },

    /** Clock bookkeeping, separated so the arena advances it after the solve. */
    advanceClock() {
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
      t += FIXED_DT;
      steps++;
    },

    /** Mass-weighted centre of the whole creature, in world space. */
    centreOfMass() {
      let m = 0, x = 0, y = 0, z = 0;
      for (const rb of bodies) {
        const bm = rb.mass();
        const p = rb.translation();
        m += bm; x += p.x * bm; y += p.y * bm; z += p.z * bm;
      }
      return m > 0 ? [x / m, y / m, z / m] : [0, 0, 0];
    },

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
