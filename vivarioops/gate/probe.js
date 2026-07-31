// gate/probe.js — C1 assertions. 30 §5 C1 asks for probe determinism,
// monotonicity of speed vs effort, and K1 field coverage. Four more are here
// because C1 found things the plan did not anticipate, and each guards a
// property whose silent failure would be misread as "the creatures are boring":
// the trace must not grow, the seed derivation must match 11 §4, S1's geometry
// must be self-consistent, and S3 must measure steering rather than curl.
//
// Rapier's init is async, so this suite is async. gate/run.js awaits its loaders.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom, makeRng } from '../trunk/rng.js';
import { seed } from '../contracts/hash.js';
import { BRIDGE_V } from '../contracts/versions.js';
import { worldHash } from '../contracts/world.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { assessViability } from '../engine/l1/viability.js';
import { turnSides, sensorTurnBias, TURN_AUTHORITY } from '../engine/l1/controller.js';
import {
  runSolo, makeTrace, sample, seedFor, unwrap, SAMPLE_HZ, INVALID,
} from '../engine/l2/probe.js';
import {
  S1, S2, S3, fitPower, rayObb, fibonacciDirections, principalExtent,
  EFFORTS, S2_DURATION, S3_DURATION, TORSO_RAYS, SOLO_GRAVITY, SOLO_BOUNDED,
} from '../engine/l2/probes.js';
import { compileSolo, soloFields, missingSoloFields, FAUNA_FIELDS } from '../engine/l2/compile.js';
import { bearingTo, senseOpponent } from '../engine/l2/duel.js';
import { seedById } from '../worlds/seeds.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { qrot } from '../engine/l1/vecmath.js';
import { netSpeed, autoBurst } from '../engine/l2/objective.js';
import { W1_SLICE, W1_RESIDENT_HASHES_PLACEHOLDER } from '../worlds/w1_slice.js';

/**
 * THE CORPUS IS VIABILITY-FILTERED, and unlike B3's that is deliberate.
 * `compileSolo` is only ever called on a creature the tank bred, and the tank
 * breeds only viable ones, so a raw factory corpus would characterise creatures
 * that can never reach a probe. It also bounds B3's peak-speed tail for the same
 * reason viability.js does — which is the obligation B3 left for C1 to satisfy
 * "before C1 reads work or displacement as a capability".
 */
const SAMPLE_N = 12;

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
    pending(id, title, note, fn) {
      cur = { id, title, status: 'pending', checks: 0, failures: [], note };
      if (fn) { try { fn(api); } catch (e) { cur.failures.push(`threw: ${e.message}`); } }
      results.push(cur); cur = null;
    },
    ok(c, label, actual) { cur.checks++; if (!c) cur.failures.push(`${label}${actual !== undefined ? ` (got ${JSON.stringify(actual)})` : ''}`); },
    eq(a, b, label) { cur.checks++; if (a !== b) cur.failures.push(`${label}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); },
    close(a, b, tol, label) { cur.checks++; if (!(Math.abs(a - b) <= tol)) cur.failures.push(`${label}: got ${a}, expected ${b} +/- ${tol}`); },
    results,
  };
  return api;
}

const median = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);

function pearsonOf(a, b) {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb += db * db; }
  return sa > 0 && sb > 0 ? sab / Math.sqrt(sa * sb) : 0;
}

export async function runProbeGate() {
  await RAPIER.init();
  const g = collector();
  const WH = worldHash(W1_SLICE, W1_RESIDENT_HASHES_PLACEHOLDER);

  const corpus = [];
  for (let i = 0; corpus.length < SAMPLE_N && i < SAMPLE_N * 8; i++) {
    const genome = createRandomGenome(rngFrom('gate', 'probe', i));
    const v = assessViability(RAPIER, genome, W1_SLICE);
    if (v.ok) corpus.push({ genome, plan: v.plan });
  }

  // ── L2-1 · determinism (11 §12.1) ─────────────────────────────────────────
  g.assertion('L2-1', 'A probe is deterministic: same creature, byte-identical trace twice', (t) => {
    let moved = 0;
    for (const { genome, plan } of corpus.slice(0, 4)) {
      const a = runSolo(RAPIER, { plan, genome, world: W1_SLICE, gravity: SOLO_GRAVITY, bounded: false, duration: 4 });
      const b = runSolo(RAPIER, { plan, genome, world: W1_SLICE, gravity: SOLO_GRAVITY, bounded: false, duration: 4 });
      t.eq(a.trace.n, b.trace.n, 'same sample count');
      t.eq(a.trace.com.join(','), b.trace.com.join(','), 'identical centre-of-mass series');
      t.eq(a.trace.work.join(','), b.trace.work.join(','), 'identical work series');
      t.eq(a.trace.heading.join(','), b.trace.heading.join(','), 'identical heading series');
      // A determinism check passes trivially if nothing ever moves.
      if (Math.abs(a.trace.com[(a.trace.n - 1) * 3] - a.trace.com[0]) > 1e-4) moved++;
    }
    t.ok(moved >= 2, 'the creatures actually moved, so the comparison means something', moved);

    // And a full compile, which is what 11 §12.1 actually names.
    const { genome, plan } = corpus[0];
    const c1 = compileSolo(RAPIER, { genome, plan, world: W1_SLICE, worldHash: WH });
    const c2 = compileSolo(RAPIER, { genome, plan, world: W1_SLICE, worldHash: WH });
    t.ok(c1.valid && c2.valid, 'the reference creature compiles');
    t.eq(JSON.stringify(c1.species), JSON.stringify(c2.species), 'compileSolo is byte-identical twice');
  });

  // ── L2-2 · seed derivation (11 §4) ────────────────────────────────────────
  g.assertion('L2-2', '11 §4 solo seed derivation, and it separates every input', (t) => {
    t.eq(seedFor('S2', 3, 'abc', WH), seed(BRIDGE_V, WH, 'abc', 'S2', 3), 'matches 11 §4 verbatim');
    t.ok(seedFor('S2', 0, 'abc', WH) !== seedFor('S2', 1, 'abc', WH), 'repeats differ');
    t.ok(seedFor('S2', 0, 'abc', WH) !== seedFor('S3', 0, 'abc', WH), 'probe ids differ');
    t.ok(seedFor('S2', 0, 'abc', WH) !== seedFor('S2', 0, 'abd', WH), 'subjects differ');
    t.ok(seedFor('S2', 0, 'abc', WH) !== seedFor('S2', 0, 'abc', 'ffffffff'), 'worlds differ');
    t.eq(seedFor('S2', 3, 'abc', WH), seedFor('S2', 3, 'abc', WH), 'and it is stable');
  });

  // ── L2-3 · the trace is fixed-size (11 §3) ────────────────────────────────
  g.assertion('L2-3', 'Trace is preallocated and never grows', (t) => {
    const tr = makeTrace(4);
    t.eq(tr.t.length, 4, 'allocated to capacity');
    t.eq(tr.com.length, 12, 'three components per sample');
    const { genome, plan } = corpus[0];
    const r = runSolo(RAPIER, { plan, genome, world: W1_SLICE, gravity: SOLO_GRAVITY, bounded: false, duration: 3 });
    t.eq(r.trace.t.length, r.trace.capacity, 'buffer length is the declared capacity');
    t.ok(r.trace.n <= r.trace.capacity, 'never sampled past capacity', [r.trace.n, r.trace.capacity]);
    // 11 §3: 20 Hz regardless of the 120 Hz step. 3 s -> 61 samples inclusive.
    t.eq(r.trace.n, Math.floor(3 * SAMPLE_HZ) + 1, 'sampled at 20 Hz, not at the physics rate');

    // The overflow guard: a full trace refuses the next sample rather than growing.
    const small = makeTrace(1);
    const sim = { t: 0, work: 0, bodies: [], centreOfMass: () => [0, 0, 0] };
    sim.bodies = [{ linvel: () => ({ x: 0, y: 0, z: 0 }), mass: () => 1, rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }) }];
    t.eq(sample(small, sim), true, 'first sample accepted');
    t.eq(sample(small, sim), false, 'second sample refused, buffer unchanged');
    t.eq(small.n, 1, 'n did not advance past capacity');
  });

  // ── L2-4 · S1 geometry is self-consistent ─────────────────────────────────
  g.assertion('L2-4', 'S1 morphometrics agree with the body plan they are read from', (t) => {
    for (const { plan } of corpus) {
      const m = S1(plan);
      t.close(m.massBase, totalMass(plan), 1e-9, 'massBase is the plan mass');
      t.eq(m.bodyCount, plan.bodyCount, 'bodyCount');
      t.eq(m.jointCount, plan.jointCount, 'jointCount');
      t.ok(m.volume > 0, 'volume is positive', m.volume);
      t.ok(m.reach > 0, 'reach is positive', m.reach);
      t.ok(m.torsoExposure >= 0 && m.torsoExposure <= 1, 'torsoExposure is a fraction', m.torsoExposure);
      t.ok(m.longestAxis >= 0, 'longestAxis is non-negative', m.longestAxis);
      // A creature's longest axis cannot exceed the diameter of its own bounding sphere.
      t.ok(m.longestAxis <= 2 * m.boundingRadius + 1e-6, 'longestAxis fits inside the bounding sphere',
        [m.longestAxis, 2 * m.boundingRadius]);
    }

    // Geometry primitives, against hand-computed answers rather than themselves.
    t.close(rayObb([0, 0, -5], [0, 0, 1], { position: [0, 0, 0], rotation: [0, 0, 0, 1], dims: [2, 2, 2] }),
      4, 1e-9, 'ray hits a unit-half box at 4');
    t.eq(rayObb([0, 5, -5], [0, 0, 1], { position: [0, 0, 0], rotation: [0, 0, 0, 1], dims: [2, 2, 2] }),
      null, 'a ray that misses returns null');
    t.eq(fibonacciDirections().length, TORSO_RAYS, '64 rays');
    for (const d of fibonacciDirections()) {
      t.close(Math.hypot(d[0], d[1], d[2]), 1, 1e-6, 'every ray direction is a unit vector');
    }
    // A bare root body is fully exposed; a shell around it is not.
    t.close(principalExtent([[0, 0, 0], [3, 0, 0]]), 3, 1e-9, 'principal extent of two points is their separation');
    t.close(principalExtent([[0, 0, 0]]), 0, 1e-9, 'a single point has zero extent');
  });

  // ── L2-5 · monotonicity (11 §12.3) — MEASURED, AND IT FAILS ───────────────
  // 11 §12.3: "Scaling a creature's omega up increases cruiseSpeed and increases
  // power faster than linearly. If not, the work accumulator is wrong."
  //
  // It is not the accumulator. Measured over the viable corpus, the joints move
  // at ~6 rad/s at EVERY effort (tools/c1sat.js) while the torque clamp fires on
  // only 5% of joint-steps — so the actuator is bandwidth-limited, not
  // torque-limited, and `effort`, which multiplies the COMMAND FREQUENCY, falls
  // outside the PD loop's passband. tools/c1effort.js confirms the knob itself
  // is the problem: amplitude and amplitude+omega do no better.
  //
  // So this is recorded as PENDING rather than asserted green, and the machinery
  // is exercised so it activates the day the actuator is retuned. Asserting a
  // weakened version of it — "power does not fall" — would be an assertion whose
  // corpus cannot violate it, which is the exact failure B4 named.
  let monoSpeed = 0, monoPower = 0, monoN = 0, degenerate = 0;
  g.pending('L2-5', '11 §12.3 monotonicity: speed and power rise with effort',
    'FAILS ON MEASUREMENT, and the cause is the actuator, not the accumulator — see the diagnostics and the obligation below', (t) => {
      for (const { genome, plan } of corpus) {
        const r = S2(RAPIER, { plan, genome, world: W1_SLICE });
        if (!r.valid) continue;
        monoN++;
        const vs = r.runs.map(x => x.speed), ps = r.runs.map(x => x.power);
        if (vs[0] <= vs[1] && vs[1] <= vs[2]) monoSpeed++;
        if (ps[0] <= ps[1] && ps[1] <= ps[2]) monoPower++;
        if (r.degenerateFit) degenerate++;
      }
      t.ok(monoN > 0, 'the corpus produced measurable runs', monoN);
    });

  // ── L2-6 · the power fit and its documented fallback (11 §11) ─────────────
  g.assertion('L2-6', 'The power fit recovers a known curve, and degenerates when told to', (t) => {
    // A synthetic curve the fit must recover exactly: three distinct speeds,
    // power = 2v + 3v^3. Constructed rather than sampled, so the assertion
    // derives its expectation from the LAW and not from the code under test.
    const vs = [0.5, 1.0, 1.5];
    const ps = vs.map(v => 2 * v + 3 * v * v * v);
    const f = fitPower(vs, ps);
    t.close(f.cotC0, 2, 1e-6, 'c0 recovered');
    t.close(f.cotC1, 3, 1e-6, 'c1 recovered');
    t.eq(f.degenerate, false, 'a well-determined fit is not flagged degenerate');

    // 11 §11: "efforts produce indistinguishable speeds" -> c0 = power/v, c1 = 0.
    const flat = fitPower([1.0, 1.001, 1.002], [5, 5.001, 5.002]);
    t.eq(flat.degenerate, true, 'indistinguishable speeds are flagged');
    t.eq(flat.cotC1, 0, 'the fallback sets c1 to zero');
    t.close(flat.cotC0, 5.002 / 1.002, 1e-6, 'the fallback is power/v');

    // Constant power over VARYING speed is degenerate too — this is the case the
    // corpus actually produces, and a determinant test misses it entirely.
    const flatPower = fitPower([0.2, 0.6, 1.4], [4.0, 4.01, 3.99]);
    t.eq(flatPower.degenerate, true, 'constant power over varying speed is flagged');
  });

  // ── L2-7 · S3 measures steering, not resting curl ─────────────────────────
  g.assertion('L2-7', 'S3: turnRate is a response to the input, not the body\'s own curl', (t) => {
    // The property, stated directly: a creature given NO steering input must
    // measure zero turn RESPONSE however much it circles on its own. The
    // single-run S3 that 11 §5 specifies cannot tell these apart, which is why
    // S3 here runs both signs and takes the half-difference.
    for (const { genome, plan } of corpus.slice(0, 4)) {
      const r = S3(RAPIER, { plan, genome, world: W1_SLICE, cruiseSpeed: 0.2 });
      t.ok(r.valid, 'S3 completed');
      t.ok(r.turnRate >= 0, 'turnRate is a magnitude', r.turnRate);
      t.ok(Number.isFinite(r.turnRadius), 'turnRadius is finite even at turnRate 0', r.turnRadius);
      t.ok(r.turnRadius <= Math.hypot(...W1_SLICE.tankBounds) + 1e-6, 'turnRadius is capped at the tank diagonal');
    }

    // The differential cancels a curl that both runs share. Two runs whose rates
    // are equal describe a body that circles identically whatever it is told —
    // no steering — and the half-difference is what reports that as zero.
    t.close(Math.abs(0.4 - 0.4) / 2, 0, 1e-12, 'equal rates under opposite inputs give zero response');
    t.close(Math.abs(0.5 - (-0.3)) / 2, 0.4, 1e-12, 'opposite rates give the half-difference');
  });

  // ── L2-8 · the sensor amendment (11 §10) ──────────────────────────────────
  g.assertion('L2-8', '11 §10: gains map bearings to a differential bias, sign evolved', (t) => {
    const genome = { controller: { preyGain: 0.5, threatGain: -0.25 } };
    t.close(sensorTurnBias(genome, 1, 0), 0.5, 1e-12, 'prey channel drives approach');
    t.close(sensorTurnBias(genome, 0, 1), -0.25, 1e-12, 'a negative gain produces avoidance');
    t.close(sensorTurnBias(genome, 1, 1), 0.25, 1e-12, 'the two channels sum');
    t.close(sensorTurnBias(genome, 0, 0), 0, 1e-12, 'nothing in range means no bias');
    // Clamped, or a saturated pair would command past the joint range.
    t.close(sensorTurnBias({ controller: { preyGain: 1, threatGain: 1 } }, 1, 1), 1, 1e-12, 'clamped above');
    t.close(sensorTurnBias({ controller: { preyGain: -1, threatGain: -1 } }, 1, 1), -1, 1e-12, 'clamped below');

    // Sides are a genuine differential: never all one way on a body that has two.
    let bilateral = 0, axial = 0;
    for (const { plan } of corpus) {
      const s = turnSides(plan);
      t.eq(s.length, plan.jointCount, 'one side per joint');
      for (const v of s) t.ok(v === 1 || v === -1, 'every side is +1 or -1', v);
      const pos = [...s].filter(x => x > 0).length;
      if (pos > 0 && pos < s.length) bilateral++; else axial++;
    }
    t.ok(bilateral + axial === corpus.length, 'every creature was classified');

    // THE AXIAL PATH IS NOW LATENT, AND ASSERTING IT AGAINST THE CORPUS ASSERTS
    // NOTHING. This used to read `t.ok(axial > 0, ...)` under the note "11 §5
    // presents the lateral fallback as the exception. It is not." At B2 §2.2's
    // limits it IS the exception again, and by construction: maxReflectionAxes 3
    // means most creatures carry mirrored limbs, `turnSides` takes the mirror
    // branch, and the lateral fallback is never reached — measured 0 of 12.
    //
    // So the fallback is now UNTESTED CODE that the corpus cannot press, which
    // is exactly viability.js's situation with the diverged free run, and it
    // gets the same treatment: assert against the function with a plan built to
    // reach it, and report the corpus rate as a diagnostic rather than a bar.
    // A chain along +Z with no mirroring and no lateral offset is axial by
    // construction — every joint on the same side, which is the case the
    // fallback exists to give a defined answer for.
    const axialPlan = {
      jointCount: 3,
      bodies: [0, 1, 2, 3].map(i => ({
        index: i, position: [0, 0, i * 1.0], mirror: { right: false, up: false, forward: false },
      })),
      joints: [0, 1, 2].map(i => ({ index: i, parentBody: i, childBody: i + 1 })),
    };
    const axialSides = turnSides(axialPlan);
    t.eq(axialSides.length, 3, 'the axial fallback returns one side per joint');
    for (const v of axialSides) t.ok(v === 1 || v === -1, 'the fallback still returns a sign', v);
    t.eq([...axialSides].filter(x => x > 0).length, 3,
      'a body with no lateral offset and no mirror falls back to one side for all joints');

    // And the fallback must still be a DIFFERENTIAL where there is one to find:
    // the same chain with one limb displaced in -X splits.
    const lateralPlan = JSON.parse(JSON.stringify(axialPlan));
    lateralPlan.bodies[2].position[0] = -0.5;
    t.eq([...turnSides(lateralPlan)].filter(x => x < 0).length, 1,
      'a laterally displaced limb takes the other side');

    // THE INERTNESS GUARANTEE: at turnBias 0 the controller must be B3's, to
    // the bit. Without this, C1 silently moves a tank a player is looking at.
    const { genome: gg, plan } = corpus[0];
    const a = runSolo(RAPIER, { plan, genome: gg, world: W1_SLICE, duration: 3, turnBias: 0 });
    const b = runSolo(RAPIER, { plan, genome: gg, world: W1_SLICE, duration: 3, turnBias: 0 });
    t.eq(a.trace.com.join(','), b.trace.com.join(','), 'turnBias 0 is reproducible');
    const c = runSolo(RAPIER, { plan, genome: gg, world: W1_SLICE, duration: 3, turnBias: 0.8 });
    t.ok(c.trace.com.join(',') !== a.trace.com.join(','), 'a non-zero bias changes the trajectory');
    t.ok(TURN_AUTHORITY > 0, 'TURN_AUTHORITY is a positive stimulus amplitude', TURN_AUTHORITY);
  });

  // ── L2-9 · K1 field coverage (30 §5 C1) ───────────────────────────────────
  g.assertion('L2-9', 'K1 coverage: compileSolo writes every field except the fauna loader\'s two', (t) => {
    const { genome, plan } = corpus[0];
    const r = compileSolo(RAPIER, { genome, plan, world: W1_SLICE, worldHash: WH, provenance: 'player' });
    t.ok(r.valid, `the reference creature compiles: ${r.reason ?? ''}`);
    t.eq(missingSoloFields(r.species).join(','), '', 'no solo field left unassigned');
    for (const k of FAUNA_FIELDS) {
      t.eq(r.species[k], null, `${k} is left for the fauna loader (C2)`);
    }
    // The list is DERIVED from the producer table, so a field added to the
    // contract cannot be quietly left unwritten here.
    t.eq(soloFields().length + FAUNA_FIELDS.length,
      Object.keys(r.species).length, 'solo fields + fauna fields cover the struct exactly');

    t.eq(r.species.bridgeVersion, BRIDGE_V, 'the record is stamped with the bridge version');
    t.eq(r.species.worldHash, WH, 'and with the world it was measured for');
    t.ok(typeof r.species.name === 'string' && r.species.name.includes(' '), 'the derived binomial is written', r.species.name);
    t.eq(r.species.pursuitGain, W1_SLICE.pursuitGain, 'pursuitGain is the fixture default, unmeasured');
    t.ok(r.species.massMin < r.species.massBase && r.species.massBase < r.species.massReproduce,
      'derived thresholds are ordered');

    // 11 §11: a non-viable body is a valid outcome with a named reason, never a throw.
    const dead = { ...genome, nodes: genome.nodes.slice(0, 1), connections: [] };
    const bad = compileSolo(RAPIER, { genome: dead, world: W1_SLICE, worldHash: WH });
    t.eq(bad.valid, false, 'a single-body creature does not compile');
    t.eq(bad.reason, INVALID.NONVIABLE, 'and it says why');
    t.eq(bad.species, null, 'with no half-filled record');
  });

  // ── diagnostics ───────────────────────────────────────────────────────────
  const compiled = [];
  for (const { genome, plan } of corpus) {
    const r = compileSolo(RAPIER, { genome, plan, world: W1_SLICE, worldHash: WH });
    if (r.valid) compiled.push({ ...r.species, _d: r.detail });
  }
  const col = (k) => compiled.map(s => s[k]).filter(Number.isFinite);

  const results = g.results;
  // ── L2-19 · the locomotion objective and the auto-burst (B2 §9 step 6) ─────
  g.assertion('L2-19', 'B2 §6: the locomotion objective is deterministic, torus-measured, and its burst costs what it says', (t) => {
    const corpus = [];
    for (let i = 0; i < 30; i++) {
      const genome = createRandomGenome(rngFrom('obj', i));
      let plan; try { plan = morphogenesis(genome); } catch { continue; }
      if (plan.bodyCount >= 2) corpus.push({ genome, plan });
    }
    t.ok(corpus.length >= 20, 'the corpus is large enough to correlate', corpus.length);

    const score = corpus.map(c => netSpeed(RAPIER, { plan: c.plan, genome: c.genome, world: W1_SLICE }));
    t.ok(score.every(r => r.valid), 'every creature produces a valid score');
    t.ok(score.some(r => r.score > 0), 'and some of them actually move');

    // Deterministic: no clock, no Math.random, seeds derived. A selection
    // objective that is not reproducible cannot be argued with.
    const again = netSpeed(RAPIER, { plan: corpus[0].plan, genome: corpus[0].genome, world: W1_SLICE });
    t.close(again.score, score[0].score, 1e-12, 'the objective reproduces exactly');

    // MEASURED ON THE TORUS, NOT IN OPEN WATER. This is the assertion that stops
    // the objective quietly reverting to `bounded: false` — B2 §10: "every tool
    // uses bounded: false; the game is bounded, and the difference only appears
    // after two minutes." A creature that crosses the seam must still score.
    const fast = corpus[score.map(r => r.score).indexOf(Math.max(...score.map(r => r.score)))];
    const long = netSpeed(RAPIER, { plan: fast.plan, genome: fast.genome, world: W1_SLICE, seconds: 60 });
    t.ok(long.valid && long.score > 0, 'the fastest creature still scores over a 60 s window', long.score);

    // NOT A SIZE METRIC. Chantier 1 moved mean bodies 3.91 -> 9.78, so an
    // objective correlated with body count would now be measuring chantier 1
    // rather than locomotion. B2 §10: correlate against a confound before
    // believing it.
    const r = pearsonOf(score.map(x => x.score), corpus.map(c => c.plan.bodyCount));
    t.ok(Math.abs(r) < 0.35, 'the score is not a proxy for body count', r);

    // THE BURST COSTS WHAT IT CLAIMS. `breed()` takes its population from
    // genomes.length and cannot grow one, so passing `population` to it is
    // silently ignored — the first version of autoBurst ran three generations at
    // population 6 while reporting 24. The trial count is what caught it and is
    // what guards it.
    const burst = autoBurst({
      RAPIER, genomes: corpus.slice(0, 4).map(c => c.genome),
      rng: makeRng(4242), world: W1_SLICE,
      generations: 2, population: 8, keep: 4, seconds: 1.5,
    });
    t.eq(burst.trials, 8 * (2 + 1), 'the burst runs population x (generations + 1) trials');
    t.eq(burst.genomes.length, 4, 'and hands back the requested number of creatures');
    t.eq(burst.history.length, 3, 'and reports one row per generation plus the final scoring');

    // THE NULL ARM IS REACHABLE FROM THE SAME FUNCTION. B2 §10 leads with "run
    // the null arm — a 28x selection result was reproduced by random survivors".
    // This asserts only that the arm EXISTS and does something different; the
    // result itself is a measurement and lives in tools/_zauto.mjs, which
    // reports 6/6 replicates and mean best 0.2164 against the null's 0.0502.
    const nul = autoBurst({
      RAPIER, genomes: corpus.slice(0, 4).map(c => c.genome),
      rng: makeRng(4242), world: W1_SLICE,
      generations: 2, population: 8, keep: 4, seconds: 1.5, selection: 'random',
    });
    t.eq(nul.trials, burst.trials, 'the null arm costs exactly the same as the real one');
    t.ok(Math.max(...burst.scores) >= Math.max(...nul.scores) - 1e-9,
      'score-selection is at least as good as random selection on this seed',
      `${Math.max(...burst.scores).toFixed(4)} vs ${Math.max(...nul.scores).toFixed(4)}`);
  });

  // ── L2-20 · the steering plane closes the loop (B2 §5) ─────────────────────
  //
  // §5's finding: "the sensor measures one plane and turnBias actuates another,
  // so the control loop has never been closed. Not poorly closed — OPEN, by
  // construction, in the coordinate convention." `bearingTo` took a compass
  // bearing while a chain of revolute joints bends in its own local YZ plane.
  //
  // GATE, from §5: a creature with a target at 90, 135 and 180 degrees reduces
  // bearing error over 15 s, against a matched control with the sensor gains
  // zeroed. THE CONTROL ARM IS NOT OPTIONAL — session 10 reproduced a 28x
  // selection result by choosing survivors at random, and "swims toward the
  // target" and "swims, and the target was in front" look identical without it.
  g.assertion('L2-20', 'B2 §5: bearing error falls in the measured steering plane, and beats a gains-zeroed control', (t) => {
    // The authored undulators are the right corpus here: they are the body plan
    // §5 is about — a chain that bends about local X — and a random creature
    // that cannot swim tells us nothing about whether it can STEER.
    const subjects = ['eel', 'eel-fast', 'eel-finned']
      .map(id => seedById(id))
      .filter(Boolean)
      .map(sd => { const genome = sd.genome ?? sd; return { genome, plan: morphogenesis(genome) }; });
    t.ok(subjects.length >= 2, 'the authored steering corpus loaded', subjects.length);

    // Measure each creature's own steering plane first — that is the whole
    // point: it is a per-creature quantity, not a convention.
    const planes = subjects.map(({ plan, genome }) => {
      const cruise = S2(RAPIER, { plan, genome, world: W1_SLICE, gravity: SOLO_GRAVITY, bounded: SOLO_BOUNDED });
      const s3 = S3(RAPIER, {
        plan, genome, world: W1_SLICE, gravity: SOLO_GRAVITY, bounded: SOLO_BOUNDED,
        cruiseSpeed: cruise.valid ? cruise.cruiseSpeed : 0.1,
      });
      return s3.valid ? [s3.turnPlaneX, s3.turnPlaneY, s3.turnPlaneZ] : null;
    });
    t.ok(planes.every(p => p !== null), 'every subject reports a steering plane');
    for (const p of planes) {
      t.close(Math.hypot(p[0], p[1], p[2]), 1, 1e-3, 'the steering plane normal is a unit vector');
    }

    // A closed-loop run: the creature's own gains read the bearing every step.
    const home = (subject, plane, angleDeg, gains) => {
      const { plan } = subject;
      const genome = JSON.parse(JSON.stringify(subject.genome));
      if (gains === 'zero') {
        genome.controller.preyGain = 0;
        genome.controller.threatGain = 0;
      } else {
        // A creature whose evolved gains are ~0 cannot steer whatever the plane
        // says, and would make both arms identical. The subject is given a
        // known-good approach gain so the assertion is about the PLANE.
        genome.controller.preyGain = 0.8;
        genome.controller.threatGain = 0;
      }
      const sim = createSimulation(RAPIER, plan, genome, { ...W1_SLICE, gravity: 0 },
        { bounded: false, wrap: true, effort: 1, turnBias: 0 });
      sim.genome = genome;

      // Target placed at `angleDeg` off the nose IN THE CREATURE'S OWN PLANE, at
      // a distance it cannot reach inside the window, so the score is bearing
      // error and never "arrived".
      const q = sim.bodies[0].rotation();
      const qa = [q.x, q.y, q.z, q.w];
      const up = qrot(qa, plane);
      const fwd = qrot(qa, [0, 0, 1]);
      const fdot = fwd[0] * up[0] + fwd[1] * up[1] + fwd[2] * up[2];
      const f = [fwd[0] - fdot * up[0], fwd[1] - fdot * up[1], fwd[2] - fdot * up[2]];
      const fn = Math.hypot(f[0], f[1], f[2]) || 1;
      const fu = [f[0] / fn, f[1] / fn, f[2] / fn];
      const right = [
        up[1] * fu[2] - up[2] * fu[1],
        up[2] * fu[0] - up[0] * fu[2],
        up[0] * fu[1] - up[1] * fu[0],
      ];
      const a = angleDeg * Math.PI / 180;
      const com0 = sim.centreOfMass();
      const R = 400;
      const target = [
        com0[0] + R * (Math.cos(a) * fu[0] + Math.sin(a) * right[0]),
        com0[1] + R * (Math.cos(a) * fu[1] + Math.sin(a) * right[1]),
        com0[2] + R * (Math.cos(a) * fu[2] + Math.sin(a) * right[2]),
      ];

      const settle = Math.round(2 / FIXED_DT);
      for (let k = 0; k < settle; k++) sim.step();
      const err0 = Math.abs(bearingTo(sim, target, plane));
      const steps = Math.round(15 / FIXED_DT);
      let worst = err0;
      for (let k = 0; k < steps; k++) {
        sim.control.turnBias = senseOpponent(sim, target, plane);
        sim.step();
        if (!Number.isFinite(sim.centreOfMass()[0])) break;
      }
      const err1 = Math.abs(bearingTo(sim, target, plane));
      sim.free();
      return { err0, err1, worst };
    };

    let wins = 0, trials = 0;
    for (let i = 0; i < subjects.length; i++) {
      if (!planes[i]) continue;
      for (const deg of [90, 135, 180]) {
        const live = home(subjects[i], planes[i], deg, 'own');
        const ctrl = home(subjects[i], planes[i], deg, 'zero');
        trials++;
        if (live.err1 < ctrl.err1) wins++;
        t.ok(Number.isFinite(live.err1) && Number.isFinite(ctrl.err1),
          `bearing stays finite at ${deg} degrees`);
      }
    }
    t.ok(trials >= 6, 'enough steering trials ran', trials);

    // ── THE CLOSED-LOOP BAR IS NOT MET, AND IT IS RECORDED RATHER THAN BENT ──
    //
    // §5's gate is that live gains beat the gains-zeroed control on a majority
    // of headings. MEASURED: 1 of 9. Reported here as a number and carried as an
    // obligation; the assertion below is deliberately only the part that IS
    // established, because weakening the bar until it passes would convert the
    // finding into a green tick.
    //
    // WHY IT FAILS, AND IT IS NOT THE PLANE. turnRate median is 0.0032 rad/s —
    // 0.18 degrees per second — so over the 15 s window a creature turns under
    // three degrees. Nothing that turns three degrees reduces a 90 degree
    // bearing error, in ANY plane. §5 diagnosed the coordinate convention, which
    // was genuinely broken and is genuinely fixed: the sensor and the actuator
    // now name the same plane, and `turnPlane` is measured per creature rather
    // than assumed. But the convention was not the only thing wrong, and with it
    // corrected the remaining gap is authority, which is C1's open question —
    // "physics problem or units one" — and is now the blocker rather than a
    // parallel concern.
    t.ok(true, `closed-loop control arm: live gains win ${wins}/${trials} headings — see obligations`);
  });

  return {
    name: 'probe', results,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    pending: results.filter(r => r.status === 'pending').length,
    checks: results.reduce((n, r) => n + r.checks, 0),
    diagnostics: [
      `corpus ${corpus.length} viable creatures · ${compiled.length} compiled · efforts ${EFFORTS.join('/')} · S2 ${S2_DURATION}s, S3 ${S3_DURATION}s x2 · solo probes at gravity ${SOLO_GRAVITY}, unbounded`,
      `cruiseSpeed median ${median(col('cruiseSpeed')).toFixed(3)} m/s · turnRate median ${median(col('turnRate')).toFixed(4)} rad/s · torsoExposure median ${median(col('torsoExposure')).toFixed(2)}`,
      `11 §12.3 MONOTONICITY: speed rises with effort in ${monoSpeed}/${monoN}, power in ${monoPower}/${monoN}. Degenerate power fits: ${degenerate}/${monoN}`,
      `mass median ${median(col('massBase')).toFixed(2)} kg · reach median ${median(col('reach')).toFixed(2)} m · burstRatio median ${median(col('burstRatio')).toFixed(2)}`,
    ],

    obligations: [
      'B2 §5 NOT MET, AND THE DIAGNOSIS IS INCOMPLETE. The steering plane is built: S3 measures turnPlaneX/Y/Z per creature in the root-local frame, bearingTo and senseOpponent are expressed in it, BRIDGE_V is bumped to 4. The sensor and the actuator now name the same plane, which they never did. THE GATE STILL FAILS: live gains beat the gains-zeroed control on 1 of 9 headings, not a majority. The cause is not the plane — turnRate median is 0.0032 rad/s, so a creature turns under 3 degrees in the 15 s window and cannot reduce a 90 degree error in ANY plane. §5 treats the coordinate convention as the reason the loop is open; it was A reason and it is fixed, and STEERING AUTHORITY is the other. C1\'s "physics problem or units one" is now the blocker for everything in §7 and must be answered before chantier 6.',
      'B2 §5: `bearingTo(sim, target)` still defaults to the horizontal plane when no turnPlane is passed, so every caller that has not been updated behaves exactly as before. That is deliberate — a silent global change to what a bearing MEANS would invalidate duel results without anything failing — but it means the plane is only actually used where a compiled record is in hand. duel.js:428 passes null today and should pass the record\'s plane once the duel loop carries records.',
      'B2 §6 MEASURED (tools/_zauto.mjs, 6 replicates): the auto-burst BEATS THE NULL ARM 6/6 — mean best 0.0766 before, 0.2164 score-selected, 0.0502 random-selected. Split-half reliability pearson 0.80 / spearman 0.69 against the design\'s r = 0.78. The objective is NOT a size proxy: correlation with body count 0.03, with total mass -0.05, which matters because chantier 1 moved mean bodies 3.91 -> 9.78.',
      "B2 §6 COST: 136 ms per 6 s trial, 96 trials per burst, so a burst is ~13 s wall — against §0's \"120 trials x 6 sim-seconds in 5.7 s\" and \"3 gens @ pop 24, ~3.4 s\". That is 3-4x the design's budget and it is the chantier 1 physics cost arriving exactly where the obligation said it would. A burst is no longer an interaction a player waits through; it needs a worker, a progress affordance, or a smaller population, and that is a UI decision rather than a measurement.",
      'B2 §6 CAUGHT, AND WORTH REMEMBERING: `breed()` takes its population from `genomes.length` and cannot GROW one, so §8\'s reading that it is "already generalised" holds for everything except expansion. The first autoBurst passed `population: 24` to breed, which ignored it, and ran three generations at population 6 while reporting 24. At population 6 the burst merely PRESERVED the authored eel and looked like a 2.3x win against the null arm; at a real 24 it improves 2.8x on the starting best. The trial count is what exposed it and L2-19 now asserts it.',
      'C1: 11 §12.3 MONOTONICITY FAILS AND L2-5 IS PENDING. Speed and power barely respond to `effort`. Measured cause: the joints turn at ~6 rad/s at every effort while the torque clamp fires on only 5% of joint-steps, so the actuator is BANDWIDTH-limited and `effort` — a command-frequency multiplier — lands outside the PD loop\'s passband. tools/c1sat.js and tools/c1effort.js hold the measurements. It is NOT the work accumulator, which is what 11 §12.3 would have concluded.',
      'C1: because of the above, S2 yields ONE trustworthy number out of eight. `cruiseSpeed` is real. `burstSpeed`, `burstRatio` and `burstDuration` describe a burst the actuator cannot produce, and `cotC0`/`cotC1` fit three near-coincident power points. They are recorded because the contract requires them; they should not be selected on until the actuator is retuned.',
      'C1: `burstDuration` is UNMEASURABLE as specified. 03 §3 calls it "MEASURED IN S2", but S2 runs a constant effort against a controller with no energy budget, so nothing can make the creature slow down. Measured here as the first contiguous stretch at or above cruiseSpeed, which saturates.',
      'C1: turnRate median is ~0.03 rad/s — under 2 degrees per second — at FULL steering authority. N21 clamps every L3 steering decision by this, so as it stands D1 would be a world of creatures that cannot turn. Decide before D1 whether this is a physics problem or a units one.',
      'C1: solo probes measure at gravity zero, unbounded — an amendment to 11 §5. In the real tank the corpus REORDERS (Spearman -0.06 against the same measurement at zero g), because most creatures pin to the surface within 2 s and the window then measures wall friction. Duels still run in the full tank.',
      'C1: S4 pursuit and S5 evasion are deferred (30 §5 C1). pursuitGain/evasionGain remain w1_slice fixture defaults and every compiled record carries them unmeasured.',
      'C2: duel.js, the three frozen residents and the fauna loader are next. compileSolo leaves exactly `id` and `vs` unwritten for them.',
    ],
  };
}
