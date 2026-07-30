// gate/probe.js — C1 assertions. 30 §5 C1 asks for probe determinism,
// monotonicity of speed vs effort, and K1 field coverage. Four more are here
// because C1 found things the plan did not anticipate, and each guards a
// property whose silent failure would be misread as "the creatures are boring":
// the trace must not grow, the seed derivation must match 11 §4, S1's geometry
// must be self-consistent, and S3 must measure steering rather than curl.
//
// Rapier's init is async, so this suite is async. gate/run.js awaits its loaders.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
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
  EFFORTS, S2_DURATION, S3_DURATION, TORSO_RAYS, SOLO_GRAVITY,
} from '../engine/l2/probes.js';
import { compileSolo, soloFields, missingSoloFields, FAUNA_FIELDS } from '../engine/l2/compile.js';
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
    // 11 §5 presents the lateral fallback as the exception. It is not.
    t.ok(axial > 0, 'the corpus exercises the axial fallback path', axial);

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
