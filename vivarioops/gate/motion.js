// gate/motion.js — B3 assertions. 30 §4 B3 asks for determinism over 600 steps,
// N19 and N22; 10 §A14 #5 adds phase propagation. Two more are here because B3
// was broken by their absence, not by anything the plan anticipated: drag must
// never add energy (an explicit v² force does), and no creature may reach a
// non-finite state (that is what made Rapier panic, three steps downstream).
//
// Rapier's init is async, so this suite is async. gate/run.js awaits its loaders.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT, MOTOR_SCALE, swingTwistAngle } from '../engine/l1/physics.js';
import { normalise, fromAxisAngle, qmul, qrot } from '../engine/l1/vecmath.js';
import { computePhases, targetAngles, DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';

const SAMPLE = 60;          // creatures stepped; the whole 500 would dominate gate time
const DUEL_STEPS = Math.round(W1_SLICE.duelDuration / FIXED_DT);   // 03 §5: 15 s

function collector() {
  const results = [];
  let cur = null;
  const api = {
    assertion(id, title, fn) {
      cur = { id, title, status: 'pass', checks: 0, failures: [] };
      try { fn(api); } catch (e) { cur.failures.push(`threw: ${e.message}`); }
      if (cur.failures.length) cur.status = 'fail';
      results.push(cur); cur = null;
    },
    ok(c, label, actual) { cur.checks++; if (!c) cur.failures.push(`${label}${actual !== undefined ? ` (got ${JSON.stringify(actual)})` : ''}`); },
    eq(a, b, label) { cur.checks++; if (a !== b) cur.failures.push(`${label}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); },
    close(a, b, tol, label) { cur.checks++; if (!(Math.abs(a - b) <= tol)) cur.failures.push(`${label}: got ${a}, expected ${b} ± ${tol}`); },
    results,
  };
  return api;
}

/**
 * A hand-built two-body plan. The N19 assertion has to vary ONE property at a
 * time — density without area, area without density — which no random genome
 * does, so the plan is constructed rather than sampled. Everything here is the
 * shape createSimulation and the controller read; nothing else.
 */
function twoBodyPlan({ density = 1.0, xsec = 1.0, dims = [1, 1, 1] } = {}) {
  return {
    genomeRoot: 'n0', truncated: false, rejected: { dimensions: 0, overlap: 0 },
    bodyCount: 2, jointCount: 1, dofCount: 1,
    bodies: [
      { index: 0, nodeId: 'n0', parent: -1, depth: 0, dims: dims.slice(), density,
        cumulativeScale: [1, 1, 1], position: [0, 0, 0], rotation: [0, 0, 0, 1],
        mirror: { right: false, up: false, forward: false }, swapX: false },
      { index: 1, nodeId: 'n0', parent: 0, depth: 0, dims: dims.slice(), density,
        cumulativeScale: [1, 1, 1], position: [0, 0, 1.0], rotation: [0, 0, 0, 1],
        mirror: { right: false, up: false, forward: false }, swapX: false },
    ],
    joints: [
      { index: 0, parentBody: 0, childBody: 1, nodeId: 'n0', connectionId: 'c0',
        type: 'revolute', angleLimits: [1.0, 0, 0], phaseLag: 0,
        anchor: [0, 0, 0.5], axes: { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
        minCrossSectionalArea: xsec, parity: 1, mirrorCount: 0 },
    ],
  };
}

const testGenome = (omega = 1.0) => ({
  controller: { omega, jointGenes: { n0: { amplitude: 1.0, bias: 0.5, freqMult: 1 } } },
});

/** Angular speed the child picks up in one step, from rest, motors only. */
function firstStepSpin(plan, world = W1_SLICE) {
  // gravity 0 so buoyancy and weight contribute nothing to the measurement.
  const sim = createSimulation(RAPIER, plan, testGenome(), { ...world, gravity: 0 }, { bounded: false });
  sim.step();
  const a = sim.bodies[1].angvel();
  const s = Math.hypot(a.x, a.y, a.z);
  sim.free();
  return s;
}

export async function runMotionGate() {
  await RAPIER.init();
  const g = collector();

  const pop = [];
  for (let i = 0; i < SAMPLE; i++) pop.push(createRandomGenome(rngFrom('gate', 'l1', i)));
  const plans = pop.map(x => morphogenesis(x));

  // ── L1-17 · same-device determinism (30 §4 B3, 10 §A14 #6) ────────────────
  g.assertion('L1-17', 'Physics is same-device deterministic over 600 steps', (t) => {
    const run = (k) => {
      const sim = createSimulation(RAPIER, plans[k], pop[k], W1_SLICE);
      for (let s = 0; s < 600; s++) sim.step();
      const c = sim.centreOfMass(), work = sim.work;
      sim.free();
      return { c, work };
    };
    let moved = 0;
    for (const k of [0, 1, 2, 3, 5, 8]) {
      const a = run(k), b = run(k);
      t.eq(JSON.stringify(a.c), JSON.stringify(b.c), `creature ${k}: identical centre of mass`);
      t.eq(a.work, b.work, `creature ${k}: identical accumulated work`);
      // A determinism check passes trivially if nothing ever moves.
      if (Math.hypot(a.c[0], a.c[1], a.c[2]) > 1e-3) moved++;
    }
    t.ok(moved >= 5, 'the creatures actually moved, so the comparison means something', moved);
  });

  // ── L1-18 · N19 ───────────────────────────────────────────────────────────
  g.assertion('L1-18', 'N19: motor strength scales with cross-sectional area, not mass', (t) => {
    // Torque = MOTOR_SCALE * minCrossSectionalArea. So from rest, in one step:
    //   spin = torque*dt/I,  I proportional to mass proportional to density.
    // Doubling the area doubles the torque and leaves inertia alone.
    // Multiplying the density by 8 leaves the torque alone and multiplies I by 8.
    // Both ratios are predicted from the RULE, not read back from physics.js.
    // Geometry is held IDENTICAL in all three, so the moment of inertia is the
    // only thing that could otherwise move: the first pair varies the recorded
    // cross-section alone, the second varies density alone.
    const base = firstStepSpin(twoBodyPlan({ density: 1.0, xsec: 1.0 }));
    const wide = firstStepSpin(twoBodyPlan({ density: 1.0, xsec: 2.0 }));
    const dense = firstStepSpin(twoBodyPlan({ density: 8.0, xsec: 1.0 }));
    t.ok(base > 1e-6, 'the reference joint actually turns', base);
    t.close(wide / base, 2.0, 0.05, 'doubling cross-sectional area doubles the spin');
    t.close(dense / base, 1 / 8, 0.02, 'multiplying density by 8 divides the spin by 8');
    // The mass-scaling mistake this guards against would make spin independent
    // of density, i.e. the ratio 1 rather than 1/8.
    t.ok(Math.abs(dense / base - 1) > 0.5, 'torque does NOT track mass', dense / base);
    t.ok(MOTOR_SCALE > 0, 'MOTOR_SCALE is a positive tuning constant', MOTOR_SCALE);
  });

  // ── L1-19 · N22 ───────────────────────────────────────────────────────────
  g.assertion('L1-19', 'N22: only creature-creature contacts can damage', (t) => {
    const sim = createSimulation(RAPIER, plans[0], pop[0], W1_SLICE);
    t.ok(sim.environment.length > 0, 'the tank built environment colliders', sim.environment.length);
    t.ok(sim.environment.every(e => e.damaging === false), 'every environment collider is tagged non-damaging');
    t.ok(sim.environment.every(e => ['floor', 'surface', 'wall'].includes(e.kind)), 'every environment collider names its kind');
    const envA = sim.environment[0].collider.handle;
    const envB = sim.environment[sim.environment.length - 1].collider.handle;
    const bodyA = sim.bodies[0].collider(0).handle;
    t.eq(sim.isDamagingContact(envA, bodyA), false, 'environment vs creature does not damage');
    t.eq(sim.isDamagingContact(bodyA, envA), false, 'the test is symmetric');
    t.eq(sim.isDamagingContact(envA, envB), false, 'environment vs environment does not damage');
    t.eq(sim.isDamagingContact(bodyA, bodyA + 100000), true, 'creature vs creature does damage');
    sim.free();

    // Jointed limbs overlap by construction — 10 §A6 exempts the parent from
    // overlap rejection but never says the matching contact must be switched
    // off. Two boxes sharing most of their volume, motors off, gravity off: if
    // contacts were live the solver would throw them apart within one step.
    // This currently also holds by Rapier's own behaviour for jointed pairs, so
    // it guards an invariant we depend on rather than a line we wrote.
    const overlapping = twoBodyPlan();
    overlapping.bodies[1].position = [0, 0, 0.1];        // almost entirely inside body 0
    const s2 = createSimulation(RAPIER, overlapping, testGenome(), { ...W1_SLICE, gravity: 0 },
      { bounded: false, motorScale: 0 });
    s2.step();
    let kick = 0;
    for (const rb of s2.bodies) { const v = rb.linvel(); kick = Math.max(kick, Math.hypot(v.x, v.y, v.z)); }
    s2.free();
    t.ok(kick < 1e-3, 'deeply overlapping jointed limbs are not pushed apart', kick);
  });

  // ── L1-20 · phase propagation (10 §A14 #5, 30 §4 "the one detail") ─────────
  g.assertion('L1-20', 'Phase propagates down the tree, and the lag belongs to the PARENT joint', (t) => {
    // A five-segment chain with one lag, exactly as A14 #5 specifies.
    const LAG = 0.37, N = 5;
    const chain = { bodyCount: N + 1, jointCount: N, joints: [] };
    for (let i = 0; i < N; i++) {
      chain.joints.push({ index: i, parentBody: i, childBody: i + 1, phaseLag: LAG });
    }
    const ph = computePhases(chain);
    t.eq(ph[0], 0, 'the root joint has phase 0');
    for (let i = 1; i < N; i++) t.close(ph[i], i * LAG, 1e-12, `joint ${i} phase is ${i} lags`);
    // Independent per-joint phases — the shortcut this guards against — would
    // leave the differences unequal.
    const d = [];
    for (let i = 1; i < N; i++) d.push(ph[i] - ph[i - 1]);
    t.ok(d.every(x => Math.abs(x - d[0]) < 1e-12), 'the differences are constant', d);

    // And the invariant itself, over every real plan in the sample.
    let broken = 0, checked = 0, roots = 0;
    for (const p of plans) {
      const ph2 = computePhases(p);
      const jointOfBody = new Int32Array(p.bodyCount).fill(-1);
      for (const j of p.joints) jointOfBody[j.childBody] = j.index;
      for (const j of p.joints) {
        checked++;
        const pj = jointOfBody[j.parentBody];
        if (pj < 0) { roots++; if (ph2[j.index] !== 0) broken++; }
        else if (Math.abs(ph2[j.index] - (ph2[pj] + p.joints[pj].phaseLag)) > 1e-12) broken++;
      }
    }
    t.eq(broken, 0, `all ${checked} joints in the sample propagate correctly`);
    t.ok(roots > 0, 'the sample contains root joints, so the phase-0 branch was exercised', roots);

    // ── WHOSE LAG IS IT? Pinned at H10, because nothing above pins it. ───────
    //
    // The chain at the top of this assertion uses ONE lag on every joint, and
    // under a uniform lag BOTH candidate semantics produce an arithmetic
    // sequence — they differ only by one term. The sample loop does discriminate,
    // because real plans carry different lags per node, but that is an accident
    // of the corpus: the day the sample became uniform, the discrimination would
    // vanish and nothing would say so.
    //
    // RESOLVED: the lag belongs to the PARENT joint, so a joint's own lag is
    // what its CHILDREN inherit and never what it uses itself. The rejected
    // reading is `childPhase = parentPhase + childJoint.phaseLag`, which puts
    // the root joint at its own lag rather than at zero and contradicts
    // 10 §A7. Distinct lags are what make the two visible.
    const LAGS = [0.11, 0.29, 0.53];
    const distinct = {
      bodyCount: 4, jointCount: 3,
      joints: LAGS.map((lag, i) => ({ index: i, parentBody: i, childBody: i + 1, phaseLag: lag })),
    };
    const dp = computePhases(distinct);
    t.eq(dp[0], 0, 'the root joint is at phase 0, not at its own lag');
    t.close(dp[1], LAGS[0], 1e-12, "joint 1 carries joint 0's lag");
    t.close(dp[2], LAGS[0] + LAGS[1], 1e-12, "joint 2 carries joints 0 and 1's lags");

    // Stated as the rejection it is: under child-lag semantics these would be
    // LAGS[0], LAGS[0]+LAGS[1] and LAGS[0]+LAGS[1]+LAGS[2]. Asserting the
    // difference explicitly means a silent reinterpretation cannot pass.
    t.ok(Math.abs(dp[0] - LAGS[0]) > 1e-9, 'and it is NOT the child-lag reading', [dp[0], LAGS[0]]);
    t.ok(Math.abs(dp[2] - (LAGS[0] + LAGS[1] + LAGS[2])) > 1e-9,
      'nor at the last joint', [dp[2], LAGS[0] + LAGS[1] + LAGS[2]]);

    // The terminal lag is INERT by construction — nothing inherits from it. It is
    // asserted rather than merely noted, because it is a named contributor to the
    // inert-mutation rate and H13 has to be able to rely on it being true.
    const changedTail = {
      ...distinct,
      joints: distinct.joints.map((j, i) => (i === 2 ? { ...j, phaseLag: 1.4 } : j)),
    };
    const cp = computePhases(changedTail);
    t.ok(dp.every((v, i) => Math.abs(v - cp[i]) < 1e-12),
      "the terminal joint's own lag changes no phase at all — it is inert, and H13 owns that");
  });

  // ── L1-23m · joint angle is measured in one frame (H9) ────────────────────
  g.assertion('L1-23m', 'A joint angle is invariant under global rotation of the whole creature', (t) => {
    // THE DEFECT THIS PINS. `conj(qp) * qc` has its vector part in the PARENT's
    // frame; the code projected it onto a WORLD-space axis. The two agree only
    // while the parent sits at spawn orientation, so the reported angle decayed
    // as the creature turned — 0.700 rad read as 0.235 at 180 degrees. The PD
    // loop's error term is (want - theta), so the position-loop GAIN became a
    // function of global pose. Corpus creatures average 78 degrees of root tilt,
    // so this was the normal operating condition, not a corner.
    //
    // The property is stated the way the review asked for it: same articulation,
    // many global orientations, one answer.
    const axisLocal = normalise([0.3, 0.9, -0.2]);
    const TRUE = 0.7;
    const qrel = fromAxisAngle(TRUE, axisLocal);

    const angles = [];
    for (const deg of [0, 15, 30, 60, 90, 120, 150, 180, 240, 300]) {
      for (const ax of [[1, 1, 0.3], [0, 1, 0], [1, 0, 0], [-0.4, 0.2, 0.9]]) {
        const qpA = fromAxisAngle(deg * Math.PI / 180, ax);
        const qcA = qmul(qpA, qrel);
        const qp = { x: qpA[0], y: qpA[1], z: qpA[2], w: qpA[3] };
        const qc = { x: qcA[0], y: qcA[1], z: qcA[2], w: qcA[3] };
        angles.push(swingTwistAngle(qp, qc, axisLocal));
      }
    }
    const worst = Math.max(...angles.map(a => Math.abs(a - TRUE)));
    t.ok(worst < 1e-9, `all ${angles.length} global orientations report the same articulation`, worst);

    // And the rejected reading must be visibly different, or this asserts
    // nothing: at spawn orientation the two agree, so a corpus of upright poses
    // would pass either way. This is the same trap L1-20 and L1-32 fell into.
    const qpA = fromAxisAngle(Math.PI, [1, 1, 0.3]);
    const qcA = qmul(qpA, qrel);
    const qp = { x: qpA[0], y: qpA[1], z: qpA[2], w: qpA[3] };
    const qc = { x: qcA[0], y: qcA[1], z: qcA[2], w: qcA[3] };
    const world = swingTwistAngle(qp, qc, qrot(qpA, axisLocal));
    t.ok(Math.abs(world - TRUE) > 0.4,
      'and a world-space axis at 180 deg reports something far wrong — the corpus reaches the boundary', [world, TRUE]);

    // Zero articulation reads as zero from every pose, including upside down.
    for (const deg of [0, 90, 180]) {
      const q = fromAxisAngle(deg * Math.PI / 180, [0.2, 0.7, 0.6]);
      const qq = { x: q[0], y: q[1], z: q[2], w: q[3] };
      t.close(swingTwistAngle(qq, qq, axisLocal), 0, 1e-12, `an unarticulated joint reads 0 at ${deg} deg`);
    }
  });

  // NOT YET PINNED, AND KNOWN: this assertion covers the ARITHMETIC, not the
  // CALL. Mutation-testing proved the difference — re-introducing the original
  // defect inside relativeAngle still escapes, because nothing here observes the
  // live simulation's frame. Removing the axis parameter narrowed the opening;
  // it did not close it.
  //
  // The test that closes it: at ZERO GRAVITY the whole system is rotationally
  // EQUIVARIANT, so a creature whose plan is rotated by any global R must produce
  // the trajectory of the unrotated creature, rotated by R. A joint measured in
  // the wrong frame breaks that equivariance and nothing else does. It needs the
  // plan-rotation plumbing that H12's arena work will introduce anyway, so it is
  // recorded here rather than half-built.

  // ── L1-21 · drag is dissipative ───────────────────────────────────────────
  g.assertion('L1-21', 'The fluid term never adds energy to a free body', (t) => {
    // AMENDED WITH THE PER-FACE LAW, and the old wording was the reason the
    // amendment was needed. It asserted that drag never increases LINEAR speed
    // and never increases SPIN, separately. That is a property of the old law —
    // one force at the centre of mass, antiparallel to v by construction — and
    // not a property of fluids. A rotating limb that pushes a creature forward
    // is drag converting spin into translation, which the old wording forbids.
    // It was an assertion that would have blocked swimming to protect a
    // stability guarantee that can be stated correctly instead:
    //
    //   THE FLUID TERM NEVER INCREASES TOTAL KINETIC ENERGY.
    //
    // That is what the energy guard in applyEnvironment solves for exactly, it
    // is what actually prevents the divergence B3 hit, and it permits the
    // exchange between rotation and translation that thrust requires.
    for (const speed of [1, 10, 100, 1e3, 1e5]) {
      // ONE FREE BODY. With a joint in the plan the solver's corrective impulses
      // dwarf the fluid term and the measurement stops being about it at all.
      const plan = twoBodyPlan({ density: 0.15, dims: [2, 2, 0.05] });   // light and broad: worst case
      plan.bodies.length = 1; plan.joints.length = 0; plan.bodyCount = 1; plan.jointCount = 0;
      const sim = createSimulation(RAPIER, plan, testGenome(), { ...W1_SLICE, gravity: 0 },
        { bounded: false, motorScale: 0 });
      const rb = sim.bodies[0];
      rb.setLinvel({ x: speed, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: speed, z: 0 }, true);

      // KE WITH THE FULL INERTIA TENSOR, not a scalar. The guard inside
      // applyEnvironment deliberately uses the MINIMUM principal inertia, which
      // makes it conservative; measuring energy the same way does not measure
      // energy. Spin about a high-inertia axis would be under-counted, and
      // converting it into translation would then read as energy appearing from
      // nowhere — it showed up as a 1.1e-7 relative rise before this was fixed.
      const mass = rb.mass();
      const pi = rb.principalInertia();
      const ke = (v, a) => {
        // omega into the body frame, where the principal axes lie.
        const q = rb.rotation();
        const cx = -q.x, cy = -q.y, cz = -q.z, cw = q.w;
        const tX = 2 * (cy * a.z - cz * a.y);
        const tY = 2 * (cz * a.x - cx * a.z);
        const tZ = 2 * (cx * a.y - cy * a.x);
        const wx = a.x + cw * tX + (cy * tZ - cz * tY);
        const wy = a.y + cw * tY + (cz * tX - cx * tZ);
        const wz = a.z + cw * tZ + (cx * tY - cy * tX);
        return 0.5 * mass * (v.x * v.x + v.y * v.y + v.z * v.z)
             + 0.5 * (pi.x * wx * wx + pi.y * wy * wy + pi.z * wz * wz);
      };
      const before = ke(rb.linvel(), rb.angvel());

      sim.step();
      const v = rb.linvel(), a = rb.angvel();
      const after = ke(v, a);

      t.ok(Number.isFinite(v.x + v.y + v.z + a.x + a.y + a.z), `speed ${speed}: still finite`, [v.x, a.y]);
      // A hair of tolerance: Rapier integrates the applied force itself, so the
      // arithmetic is not bit-identical to the guard's model of it.
      t.ok(after <= before * (1 + 1e-9) + 1e-9,
        `speed ${speed}: total kinetic energy did not increase`, [before, after]);

      // PURE TRANSLATION, no spin: here the old invariant DOES hold and is
      // meaningful, because with omega = 0 every sample sees the same flow and
      // the net force is antiparallel to v. Keeping it means the amendment
      // loosened the assertion exactly where it had to and nowhere else.
      rb.setLinvel({ x: speed, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      sim.step();
      const v2 = rb.linvel();
      t.ok(v2.x >= 0, `speed ${speed}: pure translation is never reversed`, v2.x);
      t.ok(v2.x <= speed, `speed ${speed}: pure translation is never accelerated`, v2.x);
      sim.free();
    }
  });

  // ── L1-22 · nothing diverges ──────────────────────────────────────────────
  let diverged = 0, peakV = 0, peakW = 0;
  const peaks = [];
  g.assertion('L1-22', 'No creature reaches a non-finite state over a full duel', (t) => {
    for (let k = 0; k < plans.length; k++) {
      const sim = createSimulation(RAPIER, plans[k], pop[k], W1_SLICE);
      let bad = -1, mineRun = 0;
      for (let s = 0; s < DUEL_STEPS; s++) {
        for (const rb of sim.bodies) {
          const p = rb.translation(), v = rb.linvel(), a = rb.angvel();
          if (!Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z + a.x + a.y + a.z)) { bad = s; break; }
          const sp = Math.hypot(v.x, v.y, v.z); peakV = Math.max(peakV, sp); mineRun = Math.max(mineRun, sp);
          peakW = Math.max(peakW, Math.hypot(a.x, a.y, a.z));
        }
        if (bad >= 0) break;
        sim.step();
      }
      peaks.push(mineRun);
      sim.free();
      if (bad >= 0) { diverged++; t.ok(false, `creature ${k} went non-finite at step ${bad}`); }
    }
    t.ok(diverged === 0, `all ${plans.length} creatures survive ${DUEL_STEPS} steps`, diverged);

    // Finite is not the same as physical. Buoyant terminal velocity in W1 is
    // about 7 m/s, so a population moving at hundreds would mean the solver is
    // pumping again even though nothing overflowed. The bound is on the MEDIAN,
    // which is the robust statistic here: roughly one creature in eleven still
    // reaches an implausible peak, and pretending otherwise by widening the
    // bound until the tail fits inside it would be an assertion that asserts
    // nothing. The tail is carried as an obligation instead.
    peaks.sort((a, b) => a - b);
    const p50 = peaks[Math.floor(peaks.length * 0.5)] ?? 0;
    // The bound is UNCHANGED; only its justification moved. It used to be read
    // as a multiple of buoyant terminal velocity, and there is no longer any
    // buoyancy in W1 to take a multiple of. 25 m/s is now what it always
    // physically was: half a wall thickness (0.5 m) per 1/120 s step, i.e. the
    // speed above which a creature can tunnel a boundary in one step.
    t.ok(p50 < 25, 'the median creature stays under 25 m/s, half a wall thickness per step', p50.toFixed(1));

    // STRESS PASS at twice the tuned motor scale. Without it this assertion only
    // says "the value currently checked in does not diverge", which a pumping
    // motor can satisfy by being weak. At 2x MOTOR_SCALE a motor that damps only
    // its own axis takes a spherical joint non-finite inside the duel; damping
    // the full relative angular velocity survives it.
    let stressed = 0;
    for (let k = 0; k < plans.length; k++) {
      const sim = createSimulation(RAPIER, plans[k], pop[k], W1_SLICE, { motorScale: MOTOR_SCALE * 2 });
      for (let st = 0; st < DUEL_STEPS; st++) {
        let bad = false;
        for (const rb of sim.bodies) {
          const v = rb.linvel(), a = rb.angvel();
          if (!Number.isFinite(v.x + v.y + v.z + a.x + a.y + a.z)) { bad = true; break; }
        }
        if (bad) { stressed++; break; }
        sim.step();
      }
      sim.free();
    }
    t.eq(stressed, 0, `nothing diverges at ${(MOTOR_SCALE * 2).toFixed(1)} motor scale either`);
  });

  // ── locomotion diagnostic — not an assertion ──────────────────────────────
  // B3's checkpoint is a human judgement ("it looks alive"), so this is reported
  // rather than asserted. Gravity is zeroed so the number is locomotion and not
  // buoyant drift, which used to dominate it by two orders of magnitude. Since
  // SLICE_LIMITS.density went to [1, 1] there is no drift to exclude, so the
  // zeroed gravity here is now belt-and-braces rather than load-bearing. Kept
  // because the measurement must not silently depend on a generator setting.
  const travel = [];
  for (let k = 0; k < plans.length; k++) {
    const sim = createSimulation(RAPIER, plans[k], pop[k], { ...W1_SLICE, gravity: 0 },
      { drive: DRIVE.POSITION, bounded: false });
    const c0 = sim.centreOfMass();
    for (let s = 0; s < DUEL_STEPS; s++) sim.step();
    const c1 = sim.centreOfMass();
    const d = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);
    if (Number.isFinite(d)) travel.push(d);
    sim.free();
  }
  travel.sort((a, b) => a - b);
  const q = (f) => (travel[Math.floor(travel.length * f)] ?? 0).toFixed(2);

  const results = g.results;
  return {
    name: 'motion', results,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    pending: 0,
    checks: results.reduce((n, r) => n + r.checks, 0),
    diagnostics: [
      `sample ${plans.length} creatures x ${DUEL_STEPS} steps (${W1_SLICE.duelDuration}s), MOTOR_SCALE ${MOTOR_SCALE}, position drive`,
      `peak speed: median ${(peaks[Math.floor(peaks.length * 0.5)] ?? 0).toFixed(1)}, p90 ${(peaks[Math.floor(peaks.length * 0.9)] ?? 0).toFixed(1)}, max ${peakV.toFixed(0)} m/s · peak spin ${peakW.toFixed(0)} rad/s · ${diverged} divergent`,
      `locomotion at gravity 0: median ${q(0.5)} m, p90 ${q(0.9)} m, best ${(travel[travel.length - 1] ?? 0).toFixed(2)} m`,
    ],
    obligations: [
      'B3 CHECKPOINT IS HUMAN: "at least some undulate rather than twitch" cannot be asserted. Watch the tank screen before calling B3 done.',
      'B3: the implausible peak-speed tail is LARGELY A BUOYANCY ARTEFACT and mostly went away with the density delivery. In the bounded tank the peak-speed p95 fell from 171 m/s to 20.7 m/s (n=40, 15 s) because most of that tail was buoyant acceleration into a wall, not actuation. What remains is a genuine actuator tail and MOTOR_SCALE 1.0 is still tuned rather than derived. Re-measure the residual before C1 reads work or displacement as a capability; the old figures (p95 220 m/s, worst 82000) no longer describe this generator.',
      'B3: MOTOR_SCALE 1.0 is tuned, not derived. 2.0 roughly doubles locomotion and widens that tail sharply. Revisit once the tail is understood.',
      'B3 RESOLVED at the density delivery, and the figure was worse than recorded: buoyant drift exceeded locomotion by a median 108x, not ~40x, and only 13% of the corpus was within 5% of neutral — A1\u2019s \u201Cneutrally buoyant by chance\u201D was measured false, because bulk density is volume-weighted and not the midpoint of the gene range. SLICE_LIMITS.density is now [1, 1], which is what the reference does (mycoolfin/the-simsulator has no density gene and runs water at zero gravity). Measured after: bulk density 1.000 at every percentile, net buoyant acceleration 0.00 m/s^2, drift 0.000 m, 0/40 pinned. NOTE: world.gravity is therefore DEAD CODE in W1 — (mediumDensity - density) is exactly zero — and it comes back only with a world that needs it. Step F restores the band per world, not per slice.',
    ],
  };
}
