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
import { createSimulation, FIXED_DT, MOTOR_SCALE } from '../engine/l1/physics.js';
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
  g.assertion('L1-20', 'Phase propagates down the tree: equal lags give an arithmetic sequence', (t) => {
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
  });

  // ── L1-21 · drag is dissipative ───────────────────────────────────────────
  g.assertion('L1-21', 'Drag never adds energy and never reverses a velocity', (t) => {
    // Written as a plain explicit v² force this fails at high speed: the drag
    // impulse exceeds the momentum it opposes and flips the sign, which is how
    // B3 diverged to non-finite and made Rapier panic. Tested at speeds far past
    // anything the creatures reach, because that is exactly where it broke.
    for (const speed of [1, 10, 100, 1e3, 1e5]) {
      // ONE FREE BODY. With a joint in the plan the solver's corrective impulses
      // dwarf the drag and the measurement stops being about drag at all.
      const plan = twoBodyPlan({ density: 0.15, dims: [2, 2, 0.05] });   // light and broad: worst case
      plan.bodies.length = 1; plan.joints.length = 0; plan.bodyCount = 1; plan.jointCount = 0;
      const sim = createSimulation(RAPIER, plan, testGenome(), { ...W1_SLICE, gravity: 0 },
        { bounded: false, motorScale: 0 });
      sim.bodies[0].setLinvel({ x: speed, y: 0, z: 0 }, true);
      sim.bodies[0].setAngvel({ x: 0, y: speed, z: 0 }, true);
      sim.step();
      const v = sim.bodies[0].linvel(), a = sim.bodies[0].angvel();
      t.ok(Number.isFinite(v.x) && Number.isFinite(a.y), `speed ${speed}: still finite`, [v.x, a.y]);
      t.ok(v.x >= 0, `speed ${speed}: linear drag did not reverse the velocity`, v.x);
      t.ok(v.x <= speed, `speed ${speed}: linear drag did not add energy`, v.x);
      t.ok(a.y >= 0, `speed ${speed}: angular drag did not reverse the spin`, a.y);
      t.ok(a.y <= speed, `speed ${speed}: angular drag did not add energy`, a.y);
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
    t.ok(p50 < 25, 'the median creature stays under 25 m/s, ~3x buoyant terminal velocity', p50.toFixed(1));

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
  // buoyant drift, which otherwise dominates it by two orders of magnitude.
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
      'B3: about one creature in eleven still reaches an implausible peak speed (p95 220 m/s, worst seen 82000) without going non-finite. The median is 11 m/s against a buoyant terminal velocity of ~7, so this is a tail, not a bias. Bound it before C1 reads work or displacement as a capability.',
      'B3: MOTOR_SCALE 1.0 is tuned, not derived. 2.0 roughly doubles locomotion and widens that tail sharply. Revisit once the tail is understood.',
      'B3: 02 §7 density range 0.15-1.8 against mediumDensity 1.0 means most creatures pin to the surface or the floor within a few seconds. Buoyant drift exceeds locomotion by ~40x. Worth a look at B5.',
    ],
  };
}
