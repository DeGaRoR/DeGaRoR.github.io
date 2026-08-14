// gate/motion.js — B3 assertions. 30 §4 B3 asks for determinism over 600 steps,
// N19 and N22; 10 §A14 #5 adds phase propagation. Two more are here because B3
// was broken by their absence, not by anything the plan anticipated: drag must
// never add energy (an explicit v² force does), and no creature may reach a
// non-finite state (that is what made Rapier panic, three steps downstream).
//
// Rapier's init is async, so this suite is async. gate/run.js awaits its loaders.

import { readFileSync } from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createArena, createSimulation, FIXED_DT, MOTOR_SCALE, swingTwistAngle, MUSCLE_STRESS, WALL, fitsTank, SOLVER_ITERATIONS } from '../engine/l1/physics.js';
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
function firstStepSpin(plan, world = W1_SLICE, opts = {}) {
  // gravity 0 so buoyancy and weight contribute nothing to the measurement.
  const sim = createSimulation(RAPIER, plan, testGenome(), { ...world, gravity: 0 }, { bounded: false, ...opts });
  sim.step();
  const a = sim.bodies[1].angvel();
  const s = Math.hypot(a.x, a.y, a.z);
  sim.free();
  return s;
}

/**
 * First-step spin AND the driven body's inertia about the spin axis, so a caller
 * can recover the TORQUE that produced it (tau ~ spin * I / dt) instead of using
 * spin as a proxy for it. Needed since C6.2: total inertia is now body inertia
 * PLUS added mass, and the added part is fluid — it does not scale with the
 * body's density, so a spin RATIO no longer isolates the torque law.
 */
function firstStepSpinAndInertia(plan, world = W1_SLICE, opts = {}) {
  const sim = createSimulation(RAPIER, plan, testGenome(), { ...world, gravity: 0 }, { bounded: false, ...opts });
  sim.step();
  const a = sim.bodies[1].angvel();
  const spin = Math.hypot(a.x, a.y, a.z);
  const pi = sim.bodies[1].principalInertia();
  // The spin axis in world terms is whatever the joint drove; the plan's bodies
  // are spawned axis-aligned, so projecting the (already small) first-step
  // angular velocity onto the principal axes is exact enough to recover I.
  const n = spin > 1e-12 ? [a.x / spin, a.y / spin, a.z / spin] : [1, 0, 0];
  const I = pi.x * n[0] * n[0] + pi.y * n[1] * n[1] + pi.z * n[2] * n[2];
  sim.free();
  return { spin, I };
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
  g.assertion('L1-18', 'N19: motor strength scales with joint geometry, not mass', (t) => {
    // AMENDED FOR THE TORQUE MODELS. The old wording said "scales with
    // cross-sectional area" and asserted the exponent LITERALLY — doubling A
    // doubles the spin. That is true of 'scale' (torque = motorScale * A) and
    // FALSE BY DESIGN of 'stress' (torque = sigma * A^(3/2), where doubling A
    // multiplies the spin by 2^1.5), so the assertion pinned one model rather
    // than the rule. N19 is not about the exponent. It says torque comes from
    // GEOMETRY and never from MASS, and that survives both.
    //
    // Both models are now asserted, each against ITS OWN predicted exponent
    // derived from its own rule, so the exponent is still predicted rather than
    // read back from physics.js — and neither can be changed silently.
    // EXTENDED TO THE MOTOR PATHS AT B2 §3.2, for the same reason it was
    // extended to the torque models: N19 is a statement about where strength
    // comes from, and it has to hold on whichever actuator is DEFAULT or the
    // law is only asserted about a path nothing runs.
    //
    // THE EXPONENT SURVIVES THE TORQUE BOUND, and this is worth stating because
    // it is not obvious. The bound scales k and c by f = ceiling/worst, and
    //     ceiling = motorScale*budget,  worst = motorScale*budget*(kStiff*maxError + kDamp*OMEGA_MAX)
    // so f = 1/(kStiff*maxError + kDamp*OMEGA_MAX) — the budget cancels. The
    // reduction is therefore INDEPENDENT of A and of density, and a bounded
    // solver joint is still exactly as geometric as an unbounded one. If that
    // ever stops being true this assertion is where it shows up.
    for (const [model, exponent] of [['scale', 1], ['stress', 1.5]]) {
      const o = { torqueModel: model, motor: 'pd' };
      const base = firstStepSpin(twoBodyPlan({ density: 1.0, xsec: 1.0 }), W1_SLICE, o);
      const wide = firstStepSpin(twoBodyPlan({ density: 1.0, xsec: 2.0 }), W1_SLICE, o);
      const dense = firstStepSpin(twoBodyPlan({ density: 8.0, xsec: 1.0 }), W1_SLICE, o);
      t.ok(base > 1e-6, `${model}/pd: the reference joint actually turns`, base);
      t.close(wide / base, Math.pow(2, exponent), 0.05 * Math.pow(2, exponent),
        `${model}/pd: doubling cross-sectional area multiplies the spin by 2^${exponent}`);

      // THE LOAD-BEARING CHECK: geometry held fixed, only density moves, so the
      // TORQUE must not follow it.
      //
      // AMENDED AT C6.2, and for the third time it is the same mistake being
      // corrected: the check asserted `dense/base === 1/8`, which is a property
      // of the old implementation rather than of N19. It held only because total
      // inertia used to be body inertia alone. Added mass puts a FLUID term in
      // the mass matrix, and fluid does not get denser when flesh does — so at
      // x8 density the total goes 8*I_body + I_added, not 8*(I_body + I_added),
      // and the ratio is legitimately 0.203 rather than 0.125. Asserting 1/8
      // would now forbid correct physics, exactly as the old L1-21 wording would
      // have forbidden swimming.
      //
      // Restated on the quantity N19 is actually about. Torque is recovered from
      // each run as spin * I, with I measured off the body rather than assumed,
      // and the invariant is that the two runs were driven by the SAME torque.
      // That is added-mass-agnostic, model-agnostic, and cannot be satisfied by
      // an implementation whose torque tracks mass.
      const bI = firstStepSpinAndInertia(twoBodyPlan({ density: 1.0, xsec: 1.0 }), W1_SLICE, o);
      const dI = firstStepSpinAndInertia(twoBodyPlan({ density: 8.0, xsec: 1.0 }), W1_SLICE, o);
      t.close((dI.spin * dI.I) / (bI.spin * bI.I), 1, 0.05,
        `${model}/pd: x8 density is driven by the SAME torque (spin x inertia)`);
      t.ok(dense / base < 0.5, `${model}/pd: torque does NOT track mass — spin still falls hard`, dense / base);
    }

    // ── THE SOLVER PATH, WHICH IS NOW THE DEFAULT — B2 §3.2 ──────────────────
    //
    // MEASURED FIRST, THEN ASSERTED, because the obvious extension is wrong.
    // Running firstStepSpin on the solver gives 2.528 where the budget predicts
    // 2^1.5 = 2.828, and it gives THE SAME 2.528 for both torque models — two
    // facts that together say what is happening. The solver branch always sizes
    // its gains from the stress budget and ignores `torqueModel`, so the models
    // cannot differ there; and an implicit spring's first-step response is
    // k*dt*e / (I + k*dt^2 + c*dt), whose denominator grows with k, so the
    // response is SUB-PROPORTIONAL to the torque by construction. Asserting
    // 2.828 through that integrator would be asserting a property of Rapier's
    // timestepping and calling it N19.
    //
    // So the exponent is asserted where the rule lives — on the configured
    // torque budget — and the integrator is asserted only for the thing it
    // cannot distort: that the response rises with geometry and falls with mass.
    // C1.1: N19 IS ASSERTED ON THE BUDGET, NOT THE GAIN. The budget is what N19
    // governs — the torque a joint is ALLOWED, geometric and mass-independent —
    // and it is exposed per joint (sim.motors.budget). The gain (stiffness) may be
    // shaped by inertia inside that budget once `motorFreqHz` is set, so asserting
    // mass-independence of the GAIN would forbid the reference actuator and is not
    // what N19 claims. Both branches are exercised below.
    const gains = (opts) => {
      const sim = createSimulation(RAPIER, twoBodyPlan(opts), testGenome(),
        { ...W1_SLICE, gravity: 0 }, { bounded: false, motor: 'solver', ...opts.sim });
      const m = sim.motors;
      const out = { stiff: m.stiff[0], damp: m.damp[0], bounded: m.bounded[0], budget: m.budget[0] };
      sim.free();
      return out;
    };
    // The BUDGET-DERIVED branch (motorFreqHz: null) — no longer the default (C1.3
    // defaults the reference below), but still supported and still the clearest
    // place to see N19 on the gain: here stiffness IS the area-derived budget.
    const bd = { sim: { motorFreqHz: null } };
    const gBase = gains({ density: 1.0, xsec: 1.0, ...bd });
    const gWide = gains({ density: 1.0, xsec: 2.0, ...bd });
    const gDense = gains({ density: 8.0, xsec: 1.0, ...bd });

    // THE BUDGET is the N19 quantity, and it holds in EVERY branch.
    t.ok(gBase.budget > 0, 'solver: the joint is given a torque budget', gBase.budget);
    t.close(gWide.budget / gBase.budget, Math.pow(2, 1.5), 0.02 * Math.pow(2, 1.5),
      'solver: doubling cross-sectional area multiplies the torque BUDGET by 2^1.5');
    t.close(gDense.budget / gBase.budget, 1, 1e-9,
      'solver: multiplying density by 8 leaves the torque BUDGET UNCHANGED — N19');

    // In the budget-derived branch the gain tracks the budget, so the same ratios
    // hold on the stiffness.
    t.ok(gBase.stiff > 0, 'solver/budget: the joint gets a stiffness', gBase.stiff);
    t.close(gWide.stiff / gBase.stiff, Math.pow(2, 1.5), 0.02 * Math.pow(2, 1.5),
      'solver/budget: stiffness follows the area-derived budget');
    t.close(gDense.stiff / gBase.stiff, 1, 1e-9,
      'solver/budget: stiffness does NOT track mass');
    t.close(gWide.damp / gBase.damp, gWide.stiff / gBase.stiff, 1e-9,
      'solver/budget: k and c scale together, preserving zeta');

    // THE REFERENCE (motorFreqHz) BRANCH — C1's default direction. Here the gain
    // is inertia-shaped ON PURPOSE, so it MUST track mass; what N19 requires is
    // that the BUDGET does not. This is the split the decision block in physics.js
    // makes explicit, asserted so it cannot be undone silently.
    //
    // `boundTorque: false` reads the DESIGNED gain. With the bound on, the current
    // gain-divide clamps the inertia-derived stiffness back down to the budget
    // ceiling — which negates the reference parametrisation and is exactly the
    // defect C1.2 replaces with a per-step error clamp. So the designed gain is
    // what proves the response is inertia-shaped; the budget is what N19 bounds.
    const ref = { sim: { motorFreqHz: 10, motorZeta: 0.9, boundTorque: false } };
    const rBase = gains({ density: 1.0, xsec: 1.0, ...ref });
    const rWide = gains({ density: 1.0, xsec: 2.0, ...ref });
    const rDense = gains({ density: 8.0, xsec: 1.0, ...ref });
    t.close(rWide.budget / rBase.budget, Math.pow(2, 1.5), 0.02 * Math.pow(2, 1.5),
      'solver/ref: the BUDGET is still area-derived — N19 holds on the reference actuator');
    t.close(rDense.budget / rBase.budget, 1, 1e-9,
      'solver/ref: the BUDGET is still mass-independent — N19 holds');
    t.ok(rDense.stiff / rBase.stiff > 1.5,
      'solver/ref: the GAIN is inertia-shaped and DOES rise with mass, by design', rDense.stiff / rBase.stiff);

    // boundTorque:false so the N19 spin ratio reads the actuator's INTRINSIC
    // mass-scaling. With the C1.2 clamp on, a joint saturates at its budget when
    // the error is large, and the first step from rest is exactly such a case, so
    // a base joint that has not yet saturated and a dense one that has would give
    // a spin ratio off 1/8 by the clamp's nonlinearity — a saturation artefact,
    // not a mass dependence. The clamp bounds delivered torque to the budget,
    // which is itself mass-independent (asserted above); this checks the gain law.
    // motorFreqHz:null tests the budget-derived branch, where spin follows area:
    // the reference default's gain is inertia-shaped, so its spin does NOT rise
    // with area (the body inertia is unchanged by cross-section) — that is the
    // designed response, checked as a gain ratio in the ref block above, not here.
    for (const [label, o] of [['scale', { torqueModel: 'scale' }], ['stress', { torqueModel: 'stress' }]]) {
      const s = { ...o, motor: 'solver', boundTorque: false, motorFreqHz: null };
      const base = firstStepSpin(twoBodyPlan({ density: 1.0, xsec: 1.0 }), W1_SLICE, s);
      const wide = firstStepSpin(twoBodyPlan({ density: 1.0, xsec: 2.0 }), W1_SLICE, s);
      const dense = firstStepSpin(twoBodyPlan({ density: 8.0, xsec: 1.0 }), W1_SLICE, s);
      t.ok(base > 1e-6, `${label}/solver: the reference joint actually turns`, base);
      t.ok(wide > base, `${label}/solver: more cross-section turns faster`, wide / base);
      t.ok(wide / base < Math.pow(2, 1.5), `${label}/solver: and sub-proportionally, as an implicit spring must`, wide / base);
      // Multiplying mass by 8 suppresses the spin steeply toward the ideal 1/8.
      // It does not reach exactly 1/8 and MUST NOT be pinned there: the same
      // implicit-spring denominator that makes the WIDE case sub-proportional
      // (k*dt^2 non-negligible now that the gains are no longer divided down by
      // the old bound) keeps the dense spin a little above 0.125. What N19 needs
      // is that torque does not TRACK mass — the spin falls steeply with it —
      // which is the pair of bounds below, not the exact ratio.
      t.ok(dense / base < 0.25, `${label}/solver: multiplying density by 8 suppresses the spin toward 1/8`, dense / base);
      t.ok(dense / base > 1 / 8 - 1e-6, `${label}/solver: and not below the ideal 1/8`, dense / base);
      t.ok(Math.abs(dense / base - 1) > 0.5, `${label}/solver: torque does NOT track mass`, dense / base);
    }
    t.ok(MOTOR_SCALE > 0, 'MOTOR_SCALE is a positive tuning constant', MOTOR_SCALE);
    t.ok(MUSCLE_STRESS > 0, 'MUSCLE_STRESS is a positive derived constant', MUSCLE_STRESS);
  });

  // ── L1-19 · N22 ───────────────────────────────────────────────────────────
  g.assertion('L1-19', 'N22: only creature-creature contacts can damage', (t) => {
    // NOT plans[0]. `createArena` omits the environment entirely for a creature
    // that does not fit the tank — oversize is a viability question, not a
    // physics one, and the alternative is Rapier panicking on a body spawned
    // inside a wall. So this assertion needs a creature that FITS, and picking
    // one by index couples a statement about damage tagging to whatever the
    // factory happens to draw first. B2 §2.2's widening moved the oversize
    // fraction from 8.7% to 29.6% and plans[0] became one of them.
    const idx = plans.findIndex(p => fitsTank(p, W1_SLICE));
    t.ok(idx >= 0, 'the corpus contains at least one tank-sized creature', idx);
    const sim = createSimulation(RAPIER, plans[idx], pop[idx], W1_SLICE);
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

  // ── L1-37 · the torus (B2 §4.2) ───────────────────────────────────────────
  //
  // The boundary is ABSORBING and that is what corrupts every long measurement:
  // 30 creatures over 240 s decay from a 6.2 m median wall gap to 1.8 m and lose
  // 4x of their speed. The torus is the fix for measurement. The rule it has to
  // obey is that A WRAP IS NOT A PHYSICAL EVENT — the creature must not be able
  // to feel it, and no measurement may see the seam.
  g.assertion('L1-37', 'B2 §4.2: the torus wraps atomically and is invisible to physics and to displacement', (t) => {
    const plan = plans.find(p => fitsTank(p, W1_SLICE)) ?? plans[0];
    const genome = pop[plans.indexOf(plan)];

    // Launched hard along +X so the seam is reached inside the window. Same
    // creature, same seed, one wrapping and one not: an infinite tank and a
    // torus must produce the SAME TRAJECTORY, because they differ only by a
    // change of coordinates.
    const run = (wrap) => {
      const sim = createSimulation(RAPIER, plan, genome, { ...W1_SLICE, gravity: 0 },
        { bounded: false, wrap, origin: [0, 0, 0] });
      // TOWED, not launched. A single impulse is killed by the fluid term in
      // well under a metre, so a one-shot launch never reaches the seam and the
      // assertion passes vacuously. The velocity is re-imposed every step, in
      // BOTH runs identically, so the comparison is still a comparison — the
      // only difference between the arms remains the wrap itself.
      const path = [];
      for (let k = 0; k < 1800; k++) {
        for (const rb of sim.bodies) rb.setLinvel({ x: 3, y: 0, z: 0 }, true);
        sim.step();
        if (k % 200 === 0) path.push(sim.centreOfMass());
      }
      const out = { path, end: sim.centreOfMass(), raw: sim.rawCentreOfMass(), wraps: sim.wrapCount };
      sim.free();
      return out;
    };
    const open = run(false);
    const torus = run(true);

    t.ok(torus.wraps > 0, 'the creature actually crossed the seam', torus.wraps);
    t.ok(Math.abs(open.end[0]) > W1_SLICE.tankBounds[0] / 2,
      'the control run left the volume, so the comparison is about the seam', open.end[0]);

    // AND THE CREATURE IS ACTUALLY INSIDE THE BOX. The whole point is a finite
    // volume; if the raw centre also ran off to infinity the wrap did nothing.
    for (let a = 0; a < 3; a++) {
      t.ok(Math.abs(torus.raw[a]) <= W1_SLICE.tankBounds[a] / 2 + 1e-6,
        `the raw centre stays inside the volume on axis ${a}`, torus.raw[a]);
    }

    // ── WHAT IS ACTUALLY ASSERTED, AND WHY NOT THE OBVIOUS THING ─────────────
    //
    // The obvious assertion is that the unwrapped trajectory equals the
    // unbounded one. It is true in exact arithmetic and FALSE in floating point,
    // measured here at 0.49 m over 15 s. The cause is not the wrap: the two arms
    // run at different distances from the origin — one reaches 45 m, the other
    // stays inside +-8 m — so they carry different rounding, and a multibody
    // solver amplifies that difference exponentially. Asserting agreement over a
    // long window would be asserting that this simulation is not chaotic, which
    // it is, and the assertion would then fail for a reason having nothing to do
    // with the torus.
    //
    // So the invariant is asserted where it is EXACT: across the wrap step
    // itself. A wrap is a rigid translation of every body by one world extent,
    // so shape and velocity are untouched and the displacement is exactly the
    // extent. That is the whole claim, and it is immune to how chaotic the run
    // is either side of it.
    const sim = createSimulation(RAPIER, plan, genome, { ...W1_SLICE, gravity: 0 },
      { bounded: false, wrap: true, origin: [0, 0, 0] });
    const snapshot = () => ({
      pos: sim.bodies.map(b => { const p = b.translation(); return [p.x, p.y, p.z]; }),
      vel: sim.bodies.map(b => { const v = b.linvel(); return [v.x, v.y, v.z]; }),
      ang: sim.bodies.map(b => { const a = b.angvel(); return [a.x, a.y, a.z]; }),
      com: sim.rawCentreOfMass(),
      shift: sim.wrapShift,
    });
    let checked = 0;
    let before = snapshot();
    for (let k = 0; k < 1800 && checked < 2; k++) {
      const wrapsBefore = sim.wrapCount;
      for (const rb of sim.bodies) rb.setLinvel({ x: 3, y: 0, z: 0 }, true);
      sim.step();
      const after = snapshot();
      if (sim.wrapCount > wrapsBefore) {
        checked++;
        // SHAPE. Every pairwise inter-body distance survives, which is what
        // catches the failure that matters — a PER-BODY wrap, which tears the
        // creature across the seam and would leave the graph connected in the
        // genome and shredded in the world.
        let shape = 0;
        for (let i = 0; i < after.pos.length; i++) {
          for (let jj = i + 1; jj < after.pos.length; jj++) {
            const d0 = Math.hypot(before.pos[i][0] - before.pos[jj][0],
                                  before.pos[i][1] - before.pos[jj][1],
                                  before.pos[i][2] - before.pos[jj][2]);
            const d1 = Math.hypot(after.pos[i][0] - after.pos[jj][0],
                                  after.pos[i][1] - after.pos[jj][1],
                                  after.pos[i][2] - after.pos[jj][2]);
            shape = Math.max(shape, Math.abs(d1 - d0));
          }
        }
        // One step of physics happens too, so shape may move by what a step
        // moves it — the bound is that it moved by far less than the extent it
        // would have if one body had wrapped alone.
        t.ok(shape < 1.0, 'a wrap does not change the creature\'s shape', shape);

        // DISPLACEMENT. The raw centre moved by one world extent, minus whatever
        // the step itself contributed — 3 m/s at 1/120 s is 25 mm.
        const jump = Math.abs(after.com[0] - before.com[0]);
        t.close(jump, W1_SLICE.tankBounds[0], 0.2,
          'the raw centre moved by exactly one world extent');

        // AND THE UNWRAPPED CENTRE DID NOT JUMP. This is the property every
        // caller depends on: settle, the probes, assessViability and every
        // displacement figure read centreOfMass().
        // before.shift, NOT sim.wrapShift — the latter is the shift AFTER the
        // wrap, so using it puts the check exactly one world extent out. It
        // failed at 15.9 m against a 16 m tank, which is the clearest possible
        // statement of an off-by-one-extent and is kept here as the note.
        const unwrapped = sim.centreOfMass();
        const cont = Math.abs(unwrapped[0] - (before.com[0] + before.shift[0]));
        t.ok(cont < 0.2, 'the unwrapped centre is continuous across the seam', cont);
      }
      before = after;
    }
    t.ok(checked >= 1, 'at least one wrap was inspected step-by-step', checked);
    sim.free();
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
      // rb.mass(), not the plan's totalMass, and that stays correct under an
      // added-mass term (C6.2): this assertion is about the energy the SOLVER
      // integrates, and applyEnvironment's guard is written against the same
      // mass. The two are equal today and would diverge there — the biological
      // mass is the one the UI prints, never the one this measures.
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


  // ── L1-47 · the constraint solver converges, so creatures stay in one piece ──
  //
  // THE DEFECT THIS GUARDS. Rapier's default iteration count (4) does not converge
  // on these joint trees. A creature swims normally for ~50 minutes and then comes
  // apart in a SINGLE STEP, reaching a spread of 1300 times its own rest radius;
  // in the open ocean its fragments then sweep the world forever, unlocking food
  // chunks until the screen is unusable and reporting an intake that is fiction.
  // Measured on a genome taken from a player's own save
  // (tools/_zboom_polypoda.json): 4 iterations burst at 3040 s, 8 and 16 never.
  //
  // WHY IT IS ASSERTED THIS WAY. The failure itself takes ~50 MINUTES of
  // simulation to appear, which is far past any gate budget. But the mechanism is
  // visible immediately: a converging solver moves a jointed body by a small
  // fraction of a rest radius per step, and a non-converging one does not. So this
  // measures the per-step joint violation over a few seconds — the CAUSE, at a
  // cost the gate can afford — rather than waiting for the consequence.
  //
  // MUTATION TEST: setting SOLVER_ITERATIONS back to 4 must turn this red.
  g.assertion('L1-47', 'The constraint solver converges: joints do not slip per step', (t) => {
    t.ok(SOLVER_ITERATIONS >= 8,
      `SOLVER_ITERATIONS is ${SOLVER_ITERATIONS}; 4 lets a creature disintegrate after ~50 min`);

    const genome = JSON.parse(readFileSync(
      new URL('../tools/_zboom_polypoda.json', import.meta.url), 'utf8'));
    const plan = morphogenesis(genome);
    const arena = createArena(RAPIER, W1_SLICE, { bounded: false });
    const sim = createSimulation(RAPIER, plan, genome, W1_SLICE, { arena, wrap: false });

    // Per-step change in spread. This is the quantity that goes to hundreds in one
    // step when the solver fails, and it is bounded by the joint's own slip when
    // the solver holds.
    let prev = sim.integrity().spread;
    let worstJump = 0, worstSpread = prev;
    for (let i = 0; i < 240 * 20; i++) {          // 20 s at the fixed timestep
      arena.stepAll([sim]);
      const s = sim.integrity().spread;
      const jump = Math.abs(s - prev);
      if (jump > worstJump) worstJump = jump;
      if (s > worstSpread) worstSpread = s;
      prev = s;
    }

    // HONESTY ABOUT WHAT HAS TEETH HERE. Mutation-tested: setting
    // SOLVER_ITERATIONS back to 4 turns this assertion RED — but only through the
    // literal pin above. The per-step slip below still PASSES at 4 iterations,
    // because over 20 s the divergence has not yet grown enough to show. It is
    // kept because it is the right quantity and it guards a different failure
    // (a solver change that keeps the count but breaks convergence some other
    // way), but it is NOT what catches a reverted iteration count, and it must
    // not be mistaken for that. The real detector remains tools/_zboom.mjs, which
    // needs 50 minutes of simulation the gate cannot afford.
    t.ok(worstJump < 0.05,
      `worst single-step joint slip ${worstJump.toFixed(4)} rest radii (converged is ~0.002)`);
    t.ok(worstSpread < 2,
      `the creature stays assembled: max spread ${worstSpread.toFixed(2)} (a pose cannot reach 3)`);

    // `integrity()` must actually be able to SEE a separation, or the arrest that
    // depends on it is decorative. Teleport one body and confirm it reports.
    const far = sim.bodies[sim.bodies.length - 1];
    const at = far.translation();
    far.setTranslation({ x: at.x + 500, y: at.y, z: at.z }, true);
    t.ok(sim.integrity().spread > 3,
      `integrity() detects a separated body (${sim.integrity().spread.toFixed(0)} rest radii)`);

    sim.free();
    arena.free();
  });

  // ── L1-45 · the cross-flow force points LEEWARD ───────────────────────────
  g.assertion('L1-45', 'A plate at incidence is pushed toward its leeward side', (t) => {
    // THIS ASSERTION EXISTS BECAUSE A TERM WAS DELETED, and it is the only thing
    // standing between the corpus and that term being pasted back.
    //
    // The reference's lift block — Cl = 1.2|c|sqrt(1-c^2) applied along
    // (u x n) x u — was ported on top of a drag term applied along -n. But -n
    // ALREADY carries the cross-flow force: n = c*u + sqrt(1-c^2)*d, so
    // F_drag = -mag*c*u - mag*sqrt(1-c^2)*d, and that second term IS lift. The
    // ported block adds +1.2*mag*sqrt(1-c^2)*d — same axis, opposite sign.
    // Measured with tools/_zplate.mjs: the combination cuts a plate's cross-flow
    // force to 20% AND REVERSES it, ratio -0.200 at every incidence from 5 to
    // 75 degrees. The term is gone; this keeps it gone.
    //
    // The invariant is SIGN-ONLY and unit-free, so it survives any later change
    // to Cd, to the quadrature (C6.4), or to the unit system: a surface meeting
    // flow obliquely is pushed toward the side its windward normal points away
    // from — exactly as a hydrofoil lifts toward its suction side.
    const dims = [2, 0.05, 2];   // big faces +-Y; the edge faces are 2.5% of them
    const n = [0, 1, 0];         // windward normal for a positive incidence
    for (const deg of [5, 15, 30, 45, 60, 75]) {
      const a = (deg * Math.PI) / 180;
      const u = [Math.cos(a), Math.sin(a), 0];
      const plan = twoBodyPlan({ density: 1, dims });
      plan.bodies.length = 1; plan.joints.length = 0; plan.bodyCount = 1; plan.jointCount = 0;
      const sim = createSimulation(RAPIER, plan, testGenome(), { ...W1_SLICE, gravity: 0 },
        { bounded: false, motorScale: 0 });
      const rb = sim.bodies[0];
      // Rotation locked: this is about the FORCE, and a free plate would tumble
      // out of its own incidence inside one step.
      rb.setEnabledRotations(false, false, false, true);
      const m = rb.mass();
      rb.setLinvel({ x: u[0], y: u[1], z: u[2] }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      sim.step();
      const v1 = rb.linvel();
      const F = [
        (m * (v1.x - u[0])) / FIXED_DT,
        (m * (v1.y - u[1])) / FIXED_DT,
        (m * (v1.z - u[2])) / FIXED_DT,
      ];
      const along = F[0] * u[0] + F[1] * u[1] + F[2] * u[2];
      const crossN = (F[0] - along * u[0]) * n[0]
                   + (F[1] - along * u[1]) * n[1]
                   + (F[2] - along * u[2]) * n[2];
      t.ok(along < 0, `${deg} deg: the along-flow component opposes motion`, along);
      t.ok(crossN < 0, `${deg} deg: cross-flow pushes LEEWARD, not windward`, crossN);
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
    // AMENDED AT THE DERIVED-TORQUE DELIVERY, and the number moved for a reason
    // rather than to go green. 25 m/s was calibrated against MOTOR_SCALE 1.0, an
    // actuator budget now known to be roughly fifty times below muscle. With
    // torque derived from muscle stress a limb tip legitimately reaches
    // OMEGA_MAX * limb radius ~ 10 rad/s * 2 m = 20 m/s, so the old bound
    // measured the weakness of the motors, not the plausibility of the physics.
    //
    // The bound that is actually physical is TUNNELLING: above WALL / FIXED_DT a
    // body crosses a wall between two collision queries and the arena stops
    // being solid. That is derived from the timestep and the geometry, and it is
    // the same rule clampKinematics() uses.
    //
    // NOTE WHAT THIS DOES NOT SAY. This is the fastest BODY, not the creature —
    // a limb tip at 20 m/s belongs to a creature travelling at 0.1 m/s. And the
    // TAIL still exceeds the tunnelling speed (p90 74.7 at the time of writing),
    // which is a real recorded obligation rather than something this assertion
    // waves through: see the peak-speed obligation below.
    t.ok(p50 < WALL / FIXED_DT, 'the median creature stays under the tunnelling speed', p50.toFixed(1));

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
      // ── REVIEWED 2026-08-14 against design/PLAN.md. Live items first, then
      // settled ones kept because their numbers still get quoted, then a
      // do-not-re-quote block for figures this suite used to assert and no
      // longer believes. The deduplicated debt list is design/PLAN.md §6.
      'B2 §4.2 THE TORUS IS OPT-IN, AND THE TWO ARENAS ASK DIFFERENT QUESTIONS. Scoring runs `bounded: false, wrap: true` (engine/l2/objective.js), which is why tank size is bit-identical across an 8x size sweep. The goal and beacon trials run BOUNDED on purpose: a target 8 cm away in a wrapped world is a different task. HANDOVER-STEERING paid for this — a gain conclusion taken under `wrap: true` reversed when re-run bounded (mean closure 0.065 -> 0.153, arrivals 2/54 -> 10/54). NEVER compare a figure across the two arms, and say which arena produced any number quoted.',
      'B2 §4.2: a wrap is EXACT in exact arithmetic and NOT bit-identical in floating point. Measured: an unwrapped and a wrapped run of the same creature diverge 0.49 m over 15 s, because one arm runs at 45 m from the origin and the other stays inside +-8 m, so they carry different rounding and a multibody solver amplifies it. L1-37 therefore asserts the invariant across the wrap STEP, where it is exact, and not trajectory agreement, which would be asserting that this simulation is not chaotic.',
      "B2 §3.2: THE DESIGN'S SOLVER FIGURES STILL DO NOT REPRODUCE, AND THE QUALITATIVE CLAIM IS THE ONLY ONE THAT SURVIVES: design matters enormously through the solver. Do not use §0.2's absolute figures as targets. What this tree can now be compared against is measured and current — random draws p50 0.0088 body-lengths/s, the shipped library's best 0.0933, and the owner's own hand-bred stock at 0.235 (worlds/w1_reef.js), against a campaign champion cruise of 0.478 cm/s. Any locomotion number quoted against a design figure instead of one of those is being compared to the wrong thing.",
      'B2 §3.2: `work` on the solver path is a RECONSTRUCTION, not a measurement — Rapier does not expose the motor impulse, so it is rebuilt from the same spring-damper law the motor was configured with, reading state at the start of the step. Exact in steady oscillation, overstates during fast transients. Solver-to-solver cost of transport is comparable without qualification; solver-to-PD is not, below a few percent.',
      'B2 §3.3: THE OPENING TANK IS NOW QUIET, AND THAT IS CORRECT. Locomotion over the gate window fell from median 0.90 m to 0.10 m. §0.2: through the PD a designed swimmer beats a random creature by ~7x and through the solver by ~50x, so this is the actuator making design matter rather than a regression. IT MAKES §3.3 LOAD-BEARING: the opening population can no longer be purely random, and seeding from worlds/seeds.js plus authored strangers is now the thing that keeps the first screen alive, not a variety nicety. Do not reach for motorFreqHz/motorZeta first.',
      'MOTOR_SCALE 1.0 IS TUNED, NOT DERIVED, and that is still true after the MUSCLE_STRESS split. 2.0 roughly doubles locomotion and widens the peak-speed tail sharply. What the split fixed is that the constant was doing two jobs: the ceiling is now physical (MUSCLE_STRESS 2e6 barye, ceiling only) and the gain scale is separate (MOTOR_GAIN_STRESS 200, documented as a gain scale in stress units and NOT a stress), so raising one no longer silently raises the other — which is what made every earlier attempt at this a negative result.',
      'MUTATION VIABILITY WAS 57% AGAINST A 60% TARGET AND HAS NOT BEEN RE-MEASURED SINCE. The corpus has moved twice under it — the taper gradient at GENOME_V 6 (factory acceptance 37.3% -> 46%) and the receptor draw at GENOME_V 9 — so the figure is a memory rather than a measurement (M1). Read the rejection MIX, not just the rate, before touching any cap, and re-measure before anyone argues from it.',
      'B3 AND B4 CHECKPOINTS ARE HUMAN AND STILL UNSIGNED. "At least some undulate rather than twitch", and "six creatures, select, breed, repeat, and it holds attention for twenty minutes; offspring visibly resemble parents". Neither can be asserted; both are now judged against the VIVARIUM screen, since the tank they name no longer exists; design/PLAN.md Phase 4 owns them. Reread VIVARIUM_30 §4\'s stop conditions first, so the judgement is made against them rather than against hope.',
      // ── SETTLED OR SUPERSEDED. Kept, briefly, so a figure met in an older
      // document is recognisable as dead rather than merely unfamiliar (M11).
      // SETTLED = the question closed and the answer still constrains work.
      // SUPERSEDED = the claim itself died; do not re-quote the number.
      'SUPERSEDED (the peak-speed tail): it was LARGELY A BUOYANCY ARTEFACT and mostly went away with the density delivery. In the bounded tank the peak-speed p95 fell from 171 m/s to 20.7 m/s (n=40, 15 s) because most of that tail was buoyant acceleration into a wall, not actuation. What remains is a genuine actuator tail and MOTOR_SCALE 1.0 is still tuned rather than derived. Re-measure the residual before C1 reads work or displacement as a capability; the old figures (p95 220 m/s, worst 82000) no longer describe this generator.',
      'SETTLED (buoyancy), AND THE SETTLEMENT HAS A COST THAT IS STILL LIVE. World gravity is numerically correct and BIOLOGICALLY ABSENT in W1, so nothing selects for density distribution, hydrostatic stability, flotation or ballast. The unpin is a WORLD change (Track W, deferred — design/PLAN.md §5) and must NOT be done by restoring the old [0.15, 1.8] band, which only means anything if its extremes correspond to gas cavities and mineralised structure. The original measurement is kept below because it is the reason for the pin, and it was worse than first recorded: buoyant drift exceeded locomotion by a median 108x, not ~40x, and only 13% of the corpus was within 5% of neutral — A1\u2019s \u201Cneutrally buoyant by chance\u201D was measured false, because bulk density is volume-weighted and not the midpoint of the gene range. SLICE_LIMITS.density is now [1, 1], which is what the reference does (mycoolfin/the-simsulator has no density gene and runs water at zero gravity). Measured after: bulk density 1.000 at every percentile, net buoyant acceleration 0.00 m/s^2, drift 0.000 m, 0/40 pinned. NOTE: world.gravity is therefore DEAD CODE in W1 — (mediumDensity - density) is exactly zero — and it comes back only with a world that needs it. Step F restores the band per world, not per slice.',
    ],
  };
}
