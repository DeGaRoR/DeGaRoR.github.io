// tools/_hydro_physics.mjs — LAB COPY of engine/l1/physics.js — Rapier, parameterised entirely by the World (10 §A4).
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

import { computePhases, targetAngles, targetVelocities, makeControl, DRIVE } from '../engine/l1/controller.js';
import { qrot, qmul, normalise } from '../engine/l1/vecmath.js';

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

  // ── LAB BUILD. applyEnvironment is parameterised so the drag law itself can be
  // measured against the reference implementation's. NOT the shipped engine.
  //   opts.fluid    'projected' (current engine) | 'faces' (reference) | 'none'
  //   opts.buoyancy true | false
  //   opts.gravityOn true | false
  const FLUID = opts.fluid ?? 'projected';
  const BUOY = opts.buoyancy ?? true;
  const GRAVON = opts.gravityOn ?? true;
  const LIFT = opts.lift ?? true;
  // 'magnitude' bounds |F|; 'energy' additionally projects out any component
  // that would do POSITIVE work on the body, which is what "drag must never add
  // energy" actually requires. A perpendicular impulse at the magnitude bound
  // still grows |v| by ~12% per step — Pythagoras, not physics.
  const GUARD = opts.fluidGuard ?? 'energy';

  // Reference face table: normal axis, two tangent axes.
  const FACES = [
    [0, 1, 2], [0, 1, 2],   // +-X : tangents Y,Z
    [1, 0, 2], [1, 0, 2],   // +-Y : tangents X,Z
    [2, 0, 1], [2, 0, 1],   // +-Z : tangents X,Y
  ];
  const SIGNS = [1, -1, 1, -1, 1, -1];

  function applyEnvironment() {
    for (let i = 0; i < plan.bodies.length; i++) {
      const b = plan.bodies[i];
      const rb = bodies[i];
      const vol = b.dims[0] * b.dims[1] * b.dims[2];
      const m = massOf[i];

      if (GRAVON) {
        const net = ((BUOY ? world.mediumDensity : 0) - b.density) * vol * world.gravity;
        rb.addForce({ x: 0, y: net, z: 0 }, true);
      }

      if (FLUID === 'none') continue;

      const q = rb.rotation();
      const lq = qmul([q.x, q.y, q.z, q.w], b.rotation);
      const lv = rb.linvel();
      const av = rb.angvel();

      if (FLUID === 'projected') {
        const speed = Math.hypot(lv.x, lv.y, lv.z);
        if (speed > 1e-6 && m > 0) {
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
        const aspeed = Math.hypot(av.x, av.y, av.z);
        const I = inertiaOf[i];
        if (aspeed > 1e-6 && I > 0) {
          const r = 0.5 * Math.max(b.dims[0], b.dims[1], b.dims[2]);
          const ka = 0.5 * world.mediumDensity * world.dragScale * world.dragCoefficient
                   * Math.pow(r, 5) * aspeed * 0.4;
          const ga = 1 / (1 + (ka / I) * FIXED_DT);
          rb.addTorque({ x: -ka * ga * av.x, y: -ka * ga * av.y, z: -ka * ga * av.z }, true);
        }
        continue;
      }

      // ── 'faces' — the reference model (ApplyFluidForcesSystem.cs). ──────────
      // Six faces x four quadrants = 24 sample points per body. Each sample sees
      // the LOCAL velocity v + omega x r, so rotation generates translational
      // force; the force is applied at r, so it generates torque. Both are what
      // the projected-area model cannot do.
      //
      // DEVIATION from the reference, deliberate: the reference places the face
      // centre at 0.5 * unitNormal WITHOUT scaling by the body dimension, while
      // scaling the in-plane quadrant offsets. That is dimensionally
      // inconsistent (a 2 m x 0.2 m box gets its +X face sampled 0.5 m out
      // instead of 1.0 m). Here the normal offset is scaled too.
      const rho = world.mediumDensity * world.dragScale;
      let fx = 0, fy = 0, fz = 0, txq = 0, tyq = 0, tzq = 0;
      for (let f = 0; f < 6; f++) {
        const [na, t1a, t2a] = FACES[f];
        const s = SIGNS[f];
        const nl = [0, 0, 0]; nl[na] = s;
        const wn = qrot(lq, nl);
        const s1 = b.dims[t1a], s2 = b.dims[t2a];
        const areaQ = 0.25 * s1 * s2;
        for (let ii = -1; ii <= 1; ii += 2) {
          for (let jj = -1; jj <= 1; jj += 2) {
            const ol = [0, 0, 0];
            ol[na] = 0.5 * s * b.dims[na];
            ol[t1a] = 0.25 * ii * s1;
            ol[t2a] = 0.25 * jj * s2;
            const r = qrot(lq, ol);
            const pvx = lv.x + (av.y * r[2] - av.z * r[1]);
            const pvy = lv.y + (av.z * r[0] - av.x * r[2]);
            const pvz = lv.z + (av.x * r[1] - av.y * r[0]);
            const sp2 = pvx * pvx + pvy * pvy + pvz * pvz;
            if (sp2 < 1e-8) continue;
            const sp = Math.sqrt(sp2);
            const ux = pvx / sp, uy = pvy / sp, uz = pvz / sp;
            const c = ux * wn[0] + uy * wn[1] + uz * wn[2];
            if (c <= 1e-3) continue;                  // face moving away: no push
            const ac = Math.min(c, 1);
            if (ac < 1e-2) continue;
            const d = 1 - ac;
            const Cd = 0.5 + 1.5 * d * d;
            const projV = ac * sp;
            const dragMag = 0.5 * rho * projV * projV * areaQ * Cd;
            let Fx = -dragMag * wn[0], Fy = -dragMag * wn[1], Fz = -dragMag * wn[2];
            const Cl = LIFT ? 1.2 * ac * Math.sqrt(Math.max(1 - ac * ac, 0)) : 0;
            const liftMag = 0.5 * rho * sp2 * areaQ * Cl * ac;
            const kx = uy * wn[2] - uz * wn[1];
            const ky = uz * wn[0] - ux * wn[2];
            const kz = ux * wn[1] - uy * wn[0];
            const km2 = kx * kx + ky * ky + kz * kz;
            if (km2 > 1e-6) {
              const km = Math.sqrt(km2);
              const lx = (ky * uz - kz * uy) / km;
              const ly = (kz * ux - kx * uz) / km;
              const lz = (kx * uy - ky * ux) / km;
              Fx += liftMag * lx; Fy += liftMag * ly; Fz += liftMag * lz;
            }
            fx += Fx; fy += Fy; fz += Fz;
            txq += r[1] * Fz - r[2] * Fy;
            tyq += r[2] * Fx - r[0] * Fz;
            tzq += r[0] * Fy - r[1] * Fx;
          }
        }
      }
      // Energy guard, in the spirit of the semi-implicit factor above: the
      // impulse this step may not exceed the momentum it opposes. The reference
      // instead hard-clamps force, dv and v at fixed magnitudes.
      // The bound is HALF the momentum the term opposes, per step, so the
      // aggregate is strictly dissipative even though individual faces are not.
      const speed = Math.hypot(lv.x, lv.y, lv.z);
      let fmag = Math.hypot(fx, fy, fz);
      if (!(fmag < 1e30)) { fx = 0; fy = 0; fz = 0; fmag = 0; }
      if (GUARD === 'energy' && speed > 1e-9 && fmag > 0) {
        const dot = fx * lv.x + fy * lv.y + fz * lv.z;
        if (dot > 0) {
          const k = dot / (speed * speed);
          fx -= k * lv.x; fy -= k * lv.y; fz -= k * lv.z;
          fmag = Math.hypot(fx, fy, fz);
        }
      }
      if (m > 0 && fmag > 0) {
        const maxF = (0.5 * m * speed) / FIXED_DT;
        if (fmag > maxF) { const k = maxF / fmag; fx *= k; fy *= k; fz *= k; }
      }
      const aspeed = Math.hypot(av.x, av.y, av.z);
      let tmag = Math.hypot(txq, tyq, tzq);
      const I = inertiaOf[i];
      if (!(tmag < 1e30)) { txq = 0; tyq = 0; tzq = 0; tmag = 0; }
      if (GUARD === 'energy' && aspeed > 1e-9 && tmag > 0) {
        const dot = txq * av.x + tyq * av.y + tzq * av.z;
        if (dot > 0) {
          const k = dot / (aspeed * aspeed);
          txq -= k * av.x; tyq -= k * av.y; tzq -= k * av.z;
          tmag = Math.hypot(txq, tyq, tzq);
        }
      }
      if (I > 0 && tmag > 0) {
        const maxT = (0.5 * I * aspeed) / FIXED_DT;
        if (tmag > maxT) { const k = maxT / tmag; txq *= k; tyq *= k; tzq *= k; }
      }
      rb.addForce({ x: fx, y: fy, z: fz }, true);
      rb.addTorque({ x: txq, y: tyq, z: tzq }, true);
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

    /** True if any body is in a non-finite state. Probe BEFORE stepping (B3). */
    finite() {
      for (const rb of bodies) {
        const p = rb.translation(), v = rb.linvel(), a = rb.angvel();
        if (!Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z + a.x + a.y + a.z)) return false;
      }
      return true;
    },

    step() {
      if (!ownsArena) {
        throw new Error('step() on a shared arena: call arena.stepAll([...]) instead');
      }
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
