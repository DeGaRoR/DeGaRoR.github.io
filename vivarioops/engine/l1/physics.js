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

import { computePhases, targetAngles, targetVelocities, DRIVE } from './controller.js';
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

/**
 * Build a live simulation from a body plan.
 * @param {object} RAPIER  already-initialised Rapier namespace
 * @param {object} plan
 * @param {object} genome
 * @param {object} world   W1_SLICE or another World
 * @param {object} [opts]  `{ drive, origin }`
 */
export function createSimulation(RAPIER, plan, genome, world, opts = {}) {
  const drive = opts.drive ?? DRIVE.POSITION;
  const origin = opts.origin ?? [0, 0, 0];
  const motorScale = opts.motorScale ?? MOTOR_SCALE;

  // Gravity is applied by hand per body, together with buoyancy, because both
  // are per-body quantities and letting Rapier apply gravity globally would make
  // the per-node density genes do nothing (10 §A4).
  const w = new RAPIER.World({ x: 0, y: 0, z: 0 });
  w.timestep = FIXED_DT;

  // ── environment ──────────────────────────────────────────────────────────
  // Floor, free surface and tank walls, read from the World (10 §A4). Without
  // them a creature that is not neutrally buoyant rises or sinks forever, which
  // reads as "it swam a long way" in any displacement measurement.
  //
  // N22: every environment collider is tagged. Ground and wall contacts NEVER
  // damage; only creature-creature contacts do. Tagging here rather than at the
  // damage system means the distinction cannot be lost later.
  const environment = [];
  const [tw, th, td] = world.tankBounds;
  const WALL = 0.5;
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

  // A creature larger than the tank would spawn deeply embedded in the walls,
  // and the solver cannot resolve that penetration -- Rapier panics outright.
  // Oversize creatures are a VIABILITY question (B4), not a physics question, so
  // the boundary is reported and omitted rather than crashing the sim.
  const half = [tw / 2, th / 2, td / 2];
  let reach = 0;
  for (const b of plan.bodies) {
    reach = Math.max(reach,
      Math.abs(b.position[0]) + b.dims[0], Math.abs(b.position[1]) + b.dims[1], Math.abs(b.position[2]) + b.dims[2]);
  }
  const fitsTank = reach < Math.min(half[0], half[1], half[2]);
  const bounded = (opts.bounded ?? true) && fitsTank;

  if (bounded && world.floor.present) addStatic(tw, WALL, td, 0, world.floor.y - WALL, 0, 'floor');
  if (bounded && world.surface.present) addStatic(tw, WALL, td, 0, world.surface.y + WALL, 0, 'surface');
  if (bounded) {
    addStatic(WALL, half[1], half[2], -half[0] - WALL, 0, 0, 'wall');
    addStatic(WALL, half[1], half[2], half[0] + WALL, 0, 0, 'wall');
    addStatic(half[0], half[1], WALL, 0, 0, -half[2] - WALL, 'wall');
    addStatic(half[0], half[1], WALL, 0, 0, half[2] + WALL, 'wall');
  }

  const environmentHandles = new Set(environment.map(e => e.collider.handle));

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

  // Preallocated scratch — no allocation inside the step loop (N4).
  const scratch = { v: [0, 0, 0], f: [0, 0, 0], axis: [0, 0, 0] };

  let t = 0, steps = 0;
  let work = 0;   // joules, sum |tau . omega| dt (01 §7) — S2 reads this at C1

  function applyEnvironment() {
    for (let i = 0; i < plan.bodies.length; i++) {
      const b = plan.bodies[i];
      const rb = bodies[i];
      const vol = b.dims[0] * b.dims[1] * b.dims[2];

      // Weight down, buoyancy up, both PER BODY (10 §A4). A creature can
      // therefore carry a light anterior float and a dense posterior keel, and
      // swim bladders emerge without being named.
      const net = (world.mediumDensity - b.density) * vol * world.gravity;
      rb.addForce({ x: 0, y: net, z: 0 }, true);

      // BOTH DRAG TERMS ARE INTEGRATED SEMI-IMPLICITLY, divided by
      // (1 + lambda*dt) where lambda is the decay rate the term implies. Written
      // as plain explicit forces they are UNCONDITIONALLY UNSTABLE above a
      // threshold these creatures reach constantly: the force goes as v^2 while
      // the timestep is fixed, so once lambda*dt > 2 the drag impulse exceeds
      // the momentum it opposes, reverses the velocity with a LARGER magnitude,
      // and the next step's drag is larger again. It diverged geometrically —
      // about x1000 per step — reaching non-finite in a handful of ticks, which
      // is what made Rapier's broad phase panic. Both terms diverge
      // independently; disabling either alone leaves the other unstable.
      //
      // The factor is the exact solution of dv/dt = -lambda*v over one step.
      // Where explicit drag was already valid (lambda*dt << 1) it is the
      // explicit force to within rounding, so the drag law is unchanged; it only
      // bounds the blow-up, and the bound is hard: |dv| = v*lambda*dt/(1+lambda*dt)
      // < v, so drag can never reverse a velocity and never adds energy.
      //
      // Quadratic drag opposing motion, with the TRUE PROJECTED AREA of the box
      // along the direction of travel.
      //
      // This is what makes swimming possible at all, and it was the last thing
      // stopping B3. The previous approximation used the largest face
      // regardless of orientation, and an orientation-INDEPENDENT drag area
      // cannot produce thrust: a limb sweeping back and forth meets identical
      // resistance on both strokes, so a full cycle nets to zero. Undulation
      // propels an animal precisely because drag normal to a surface exceeds
      // drag along it. Measured over the gate corpus with gravity zeroed, so
      // that displacement is locomotion and nothing else: largest-face drag
      // moved a creature a median 0.20 m in 15 s — a wiggle in place.
      //
      // Projected area of a box on a unit direction is the sum of each face
      // area weighted by that face normal's alignment with the direction. The
      // direction is rotated into limb space rather than the three face normals
      // into world space: one rotation instead of three, and no allocation (N4).
      const lv = rb.linvel();
      const speed = Math.hypot(lv.x, lv.y, lv.z);
      const m = massOf[i];
      if (speed > 1e-6 && m > 0) {
        const q = rb.rotation();
        // Limb orientation in world = body rotation composed with the collider's.
        const lq = qmul([q.x, q.y, q.z, q.w], b.rotation);
        // Rotate the unit velocity by the CONJUGATE of that, inline, into limb space.
        const cx = -lq[0], cy = -lq[1], cz = -lq[2], cw = lq[3];
        const ux = lv.x / speed, uy = lv.y / speed, uz = lv.z / speed;
        const tx = 2 * (cy * uz - cz * uy);
        const ty = 2 * (cz * ux - cx * uz);
        const tz = 2 * (cx * uy - cy * ux);
        const vx = ux + cw * tx + (cy * tz - cz * ty);
        const vy = uy + cw * ty + (cz * tx - cx * tz);
        const vz = uz + cw * tz + (cx * ty - cy * tx);
        const area = Math.abs(vx) * b.dims[1] * b.dims[2]
                   + Math.abs(vy) * b.dims[0] * b.dims[2]
                   + Math.abs(vz) * b.dims[0] * b.dims[1];
        const k = 0.5 * world.mediumDensity * world.dragScale * world.dragCoefficient * area * speed;
        const g = 1 / (1 + (k / m) * FIXED_DT);
        rb.addForce({ x: -k * g * lv.x, y: -k * g * lv.y, z: -k * g * lv.z }, true);
      }

      // Angular drag, so spinning is not free. 00 §9 lists "spin rapidly" as a
      // crude dominant optimum to guard against with physical cost, not rules.
      const av = rb.angvel();
      const aspeed = Math.hypot(av.x, av.y, av.z);
      const I = inertiaOf[i];
      if (aspeed > 1e-6 && I > 0) {
        const r = 0.5 * Math.max(b.dims[0], b.dims[1], b.dims[2]);
        const ka = 0.5 * world.mediumDensity * world.dragScale * world.dragCoefficient
                 * Math.pow(r, 5) * aspeed * 0.4;
        const ga = 1 / (1 + (ka / I) * FIXED_DT);
        rb.addTorque({ x: -ka * ga * av.x, y: -ka * ga * av.y, z: -ka * ga * av.z }, true);
      }
    }
  }

  /** Signed angle of the child relative to the parent about a world axis. */
  function relativeAngle(jointIndex, axisWorld) {
    const j = plan.joints[jointIndex];
    const qp = bodies[j.parentBody].rotation();
    const qc = bodies[j.childBody].rotation();
    // qRel = conj(qp) * qc
    const cx = -qp.x, cy = -qp.y, cz = -qp.z, cw = qp.w;
    const rx = cw * qc.x + cx * qc.w + (cy * qc.z - cz * qc.y);
    const ry = cw * qc.y + cy * qc.w + (cz * qc.x - cx * qc.z);
    const rz = cw * qc.z + cz * qc.w + (cx * qc.y - cy * qc.x);
    const rw = cw * qc.w - (cx * qc.x + cy * qc.y + cz * qc.z);
    // Swing-twist: project the rotation vector onto the axis.
    const proj = rx * axisWorld[0] + ry * axisWorld[1] + rz * axisWorld[2];
    return 2 * Math.atan2(proj, rw);
  }

  function applyMotors() {
    const want = drive === DRIVE.VELOCITY
      ? targetVelocities(plan, genome, t, phases, targets)
      : targetAngles(plan, genome, t, phases, targets);

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
        const theta = relativeAngle(i, axisWorld);
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
    bodies,
    joints,
    phases,
    environment,
    bounded,
    fitsTank,
    /** N22 — true only for creature-creature contacts. */
    isDamagingContact(handleA, handleB) {
      return !environmentHandles.has(handleA) && !environmentHandles.has(handleB);
    },
    get t() { return t; },
    get steps() { return steps; },
    get work() { return work; },

    step() {
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

    free() { w.free(); },
  };
}
