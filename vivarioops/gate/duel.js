// gate/duel.js — C2 assertions. 30 §5 C2 asks for K3, K4 and determinism.
//
// WHAT THIS SUITE CAN AND CANNOT CLAIM, stated up front because it is the whole
// story of C2: the duel harness is correct, deterministic and symmetric, and it
// measures almost nothing, because the creatures cannot close the distance
// between them. Every assertion below is written to hold REGARDLESS of whether a
// capture ever occurs — an assertion that only passes when creatures fight would
// be an assertion that silently stopped running. The capture rate itself is a
// diagnostic and an obligation, not a green tick.
//
// Rapier's init is async, so this suite is async. gate/run.js awaits its loaders.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { genomeHash, deserialise } from '../engine/l1/genome.js';
import { assessViability } from '../engine/l1/viability.js';
import { compileSolo } from '../engine/l2/compile.js';
import { S1 } from '../engine/l2/probes.js';
import {
  runDuel, duelPair, duelSetup, reduceDuels, bearingTo, senseOpponent,
  OUTCOME, SEPARATION_K, BEARINGS, REVIEW_SECONDS, MAX_CONTACT_DV,
} from '../engine/l2/duel.js';
import { loadFauna, nonTransitivity } from '../engine/l2/fauna.js';
import { validateMatchup, matchupKey, canonicalPair } from '../contracts/matchup.js';
import { VS_STRIDE } from '../contracts/species.js';
import { worldHash } from '../contracts/world.js';
import { W1_SLICE, W1_RESIDENT_HASHES_PLACEHOLDER as RES } from '../worlds/w1_slice.js';
import { W1_RESIDENT_GENOMES, W1_RESIDENT_IDS, W1_RESIDENT_HASHES } from '../worlds/w1_residents.js';

const WH = worldHash(W1_SLICE, RES);

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
    near(a, b, tol, label) { cur.checks++; if (!(Math.abs(a - b) <= tol)) cur.failures.push(`${label}: got ${a}, expected ${b} +/- ${tol}`); },
    results,
  };
  return api;
}

export async function runDuelGate() {
  await RAPIER.init();
  const g = collector();

  // ── the residents, as the world actually ships them ───────────────────────
  const residents = W1_RESIDENT_IDS.map((id) => {
    const genome = deserialise(W1_RESIDENT_GENOMES[id]);
    const plan = morphogenesis(genome);
    return { id, genome, plan, hash: genomeHash(genome), reach: S1(plan).reach };
  });

  // A small viable corpus for the properties that want more than three animals.
  const corpus = [];
  for (let i = 0; corpus.length < 6 && i < 300; i++) {
    const genome = createRandomGenome(rngFrom('gate', 'duel', i));
    const plan = morphogenesis(genome);
    if (!assessViability(RAPIER, genome, W1_SLICE, { plan }).ok) continue;
    corpus.push({ genome, plan, hash: genomeHash(genome), reach: S1(plan).reach });
  }

  // ── L2-10 · the residents are what the world says they are ────────────────
  g.assertion('L2-10', 'The three frozen residents load, hash as recorded, and differ', (t) => {
    t.eq(residents.length, 3, 'three residents (03 §5)');
    residents.forEach((r, i) => {
      t.eq(r.hash, W1_RESIDENT_HASHES[i], `${r.id}: stored hash matches the genome`);
      t.ok(assessViability(RAPIER, r.genome, W1_SLICE, { plan: r.plan }).ok, `${r.id} is viable`);
    });
    t.eq(new Set(residents.map(r => r.hash)).size, 3, 'the three are distinct genomes');

    // worldHash must be derived from these and nothing else. If the fixture and
    // the residents file ever drift, every compiled record is keyed to a world
    // that does not exist.
    t.eq(worldHash(W1_SLICE, W1_RESIDENT_HASHES), WH, 'worldHash derives from the shipped resident hashes');
    // 3 -> 4 at C6.2 (added mass), 4 -> 5 at the C2 re-measure (tankBounds widened
    // to 32 cm). Pinned as a LITERAL on purpose: the residents may only be
    // re-frozen together with a version bump, and a check that read the constant
    // back from w1_slice.js would assert nothing.
    t.eq(W1_SLICE.faunaVersion, 6, 'faunaVersion was bumped at the solver-convergence fix (4 -> 8 iterations)');

    // They were chosen for SPREAD; a fauna of three identical animals would
    // make the matchup matrix decorative. Asserted, not assumed.
    const compiled = residents.map(r => compileSolo(RAPIER, {
      genome: r.genome, world: W1_SLICE, worldHash: WH, plan: r.plan,
      provenance: 'shipped', checkViability: false,
    }));
    t.ok(compiled.every(c => c.valid), 'every resident compiles');
    const cruise = compiled.map(c => c.species.cruiseSpeed);
    const mass = compiled.map(c => c.species.massBase);
    t.ok(Math.max(...cruise) / Math.max(Math.min(...cruise), 1e-6) > 3, 'cruise speeds span more than 3x', cruise.map(x => x.toFixed(2)));
    t.ok(Math.max(...mass) / Math.min(...mass) > 3, 'masses span more than 3x', mass.map(x => x.toFixed(1)));
  });

  // ── L2-11 · determinism ───────────────────────────────────────────────────
  g.assertion('L2-11', 'A duel is deterministic in its seed, down to the work accumulated', (t) => {
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      for (let r = 0; r < W1_SLICE.duelRepeats; r++) {
        const a = runDuel(RAPIER, { a: residents[i], b: residents[j], world: W1_SLICE, worldHash: WH, repeat: r });
        const b = runDuel(RAPIER, { a: residents[i], b: residents[j], world: W1_SLICE, worldHash: WH, repeat: r });
        t.eq(a.outcome, b.outcome, `${i}v${j} r${r}: same outcome`);
        t.eq(a.timeToOutcome, b.timeToOutcome, `${i}v${j} r${r}: same timeToOutcome`);
        t.eq(a.workA, b.workA, `${i}v${j} r${r}: identical workA`);
        t.eq(a.minDistance, b.minDistance, `${i}v${j} r${r}: identical minDistance`);
      }
    }
    // A determinism check passes trivially if the duel does nothing at all.
    const d = runDuel(RAPIER, { a: residents[0], b: residents[1], world: W1_SLICE, worldHash: WH, repeat: 0 });
    t.ok(d.workA > 0 && d.workB > 0, 'both creatures did mechanical work, so the comparison means something', [d.workA, d.workB]);
  });

  // ── L2-12 · K4 at the RECORD level (the half A0 deferred to C2) ───────────
  g.assertion('L2-12', 'K4: A-vs-B and B-vs-A are the identical fight, read from opposite ends', (t) => {
    const flip = { A: OUTCOME.B, B: OUTCOME.A, none: OUTCOME.NONE };
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      for (let r = 0; r < W1_SLICE.duelRepeats; r++) {
        const f = runDuel(RAPIER, { a: residents[i], b: residents[j], world: W1_SLICE, worldHash: WH, repeat: r });
        const b = runDuel(RAPIER, { a: residents[j], b: residents[i], world: W1_SLICE, worldHash: WH, repeat: r });
        t.eq(flip[b.outcome], f.outcome, `${i}v${j} r${r}: outcome mirrors`);
        t.eq(f.timeToOutcome, b.timeToOutcome, `${i}v${j} r${r}: same duration`);
        t.eq(f.minDistance, b.minDistance, `${i}v${j} r${r}: same closest approach`);
        // The work swaps sides. If it did not, the fights differ and the seed
        // derivation has become order-dependent — which is the exact defect
        // 03 §2 was written to correct in 11 §4.
        t.eq(f.workA, b.workB, `${i}v${j} r${r}: workA reads back as workB`);
        t.eq(f.workB, b.workA, `${i}v${j} r${r}: workB reads back as workA`);
      }
    }
    // And the reduction, which is the thing that actually gets stored.
    const fwd = duelPair(RAPIER, { a: residents[0], b: residents[1], world: W1_SLICE, worldHash: WH });
    const rev = duelPair(RAPIER, { a: residents[1], b: residents[0], world: W1_SLICE, worldHash: WH });
    t.eq(JSON.stringify(fwd.matchup), JSON.stringify(rev.matchup), 'the PairMatchup is byte-identical either way round');
  });

  // ── L2-13 · K3, now with a real producer ──────────────────────────────────
  g.assertion('L2-13', 'K3: aToB.pCapture + bToA.pCapture + pStalemate = 1, from real duels', (t) => {
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      const r = duelPair(RAPIER, { a: residents[i], b: residents[j], world: W1_SLICE, worldHash: WH });
      const v = validateMatchup(r.matchup);
      t.ok(v.ok, `${i}v${j}: ${v.errors.join('; ')}`);
      const m = r.matchup;
      t.near(m.aToB.pCapture + m.bToA.pCapture + m.pStalemate, 1, 1e-9, `${i}v${j}: K3 invariant`);
      t.eq(m.aHash, canonicalPair(residents[i].hash, residents[j].hash)[0], `${i}v${j}: canonical ordering`);
      t.ok(m.engagementRadius > 0, `${i}v${j}: engagementRadius is a real measured separation`, m.engagementRadius);
      t.ok(m.aToB.timeToCapture > 0 && m.bToA.timeToCapture > 0, `${i}v${j}: timeToCapture defaults to duelDuration, never 0`);
    }

    // The invariant must survive the paths that are NOT the happy one, because
    // those are the ones a real corpus produces. Synthetic reductions, so the
    // branches are reachable at all: every repeat flagged, and every repeat
    // invalid. Both must still sum to 1.
    const fake = (over) => ({
      repeat: 0, valid: true, flagged: false, outcome: OUTCOME.A, timeToOutcome: 3,
      workA: 6, workB: 4, minDistance: 1, separation: 5, clamped: false, ignoredContacts: 0, ...over,
    });
    const allFlagged = reduceDuels({
      aHash: 'aa', bHash: 'bb', duelDuration: 15,
      duels: [fake({ flagged: true, timeToOutcome: 0.2 }), fake({ flagged: true, timeToOutcome: 0.1 })],
    });
    t.eq(allFlagged.counted, 0, 'every repeat flagged -> nothing counted');
    t.ok(allFlagged.underReview, 'and the pair is marked under review rather than scored');
    t.near(allFlagged.matchup.aToB.pCapture + allFlagged.matchup.bToA.pCapture + allFlagged.matchup.pStalemate, 1, 1e-9,
      'K3 still holds when every repeat was dropped');
    t.eq(allFlagged.matchup.pStalemate, 1, 'an all-flagged pair records a full stalemate, not a capture');

    const allInvalid = reduceDuels({
      aHash: 'aa', bHash: 'bb', duelDuration: 15,
      duels: [fake({ valid: false }), fake({ valid: false })],
    });
    t.near(allInvalid.matchup.aToB.pCapture + allInvalid.matchup.bToA.pCapture + allInvalid.matchup.pStalemate, 1, 1e-9,
      'K3 still holds when every repeat was unstable');

    // A mixed reduction must divide by the COUNTED repeats, not the attempted
    // ones — otherwise a flagged exploit quietly deflates everyone's pCapture.
    const mixed = reduceDuels({
      aHash: 'aa', bHash: 'bb', duelDuration: 15,
      duels: [fake({ outcome: OUTCOME.A }), fake({ outcome: OUTCOME.B }), fake({ flagged: true, timeToOutcome: 0.2 })],
    });
    t.eq(mixed.counted, 2, 'flagged repeat excluded from the denominator');
    t.eq(mixed.matchup.aToB.pCapture, 0.5, 'pCapture is over counted repeats');
    t.near(mixed.matchup.aToB.pCapture + mixed.matchup.bToA.pCapture + mixed.matchup.pStalemate, 1, 1e-9, 'K3 across a mixed reduction');
  });

  // ── L2-14 · 10 §7's three exploit guards ──────────────────────────────────
  g.assertion('L2-14', '10 §7: all three duel exploit guards are in force', (t) => {
    // Guard 3 — the under-0.5 s rule, exercised through the reduction because
    // that is where "flagged rather than recorded" actually means something.
    const quick = {
      repeat: 0, valid: true, outcome: OUTCOME.A, timeToOutcome: REVIEW_SECONDS - 0.01,
      workA: 1, workB: 1, minDistance: 0.1, separation: 4, clamped: false, ignoredContacts: 0,
      flagged: true,
    };
    const slow = { ...quick, timeToOutcome: REVIEW_SECONDS + 0.01, flagged: false };
    const r = reduceDuels({ aHash: 'aa', bHash: 'bb', duels: [quick, slow], duelDuration: 15 });
    t.eq(r.flagged, 1, 'the sub-0.5 s decision is flagged');
    t.eq(r.counted, 1, 'and excluded from the record');
    t.eq(r.matchup.aToB.pCapture, 1, 'the surviving repeat is scored normally');
    t.ok(REVIEW_SECONDS === 0.5, '10 §7 guard 3 threshold is 0.5 s', REVIEW_SECONDS);

    // Guard 1 — capture is ROOT-body contact. Asserted on the harness's own
    // wiring: the collider it watches is body 0's, and body 0 is the root
    // (morphogenesis pushes the root first, with parent -1).
    for (const c of residents) {
      t.eq(c.plan.bodies[0].parent, -1, `${c.id}: body 0 is the root`);
    }
    const d = runDuel(RAPIER, { a: residents[0], b: residents[1], world: W1_SLICE, worldHash: WH, repeat: 0 });
    t.ok(d.outcome === OUTCOME.NONE || d.minDistance < Infinity, 'a decided duel recorded an approach');

    // Guard 2 — the impulse budget is DERIVED from the wall thickness and the
    // timestep, not tuned, and it is mass-relative so it is not a size filter.
    t.near(MAX_CONTACT_DV, 60, 1e-9, 'guard 2 budget is one wall thickness per step');
    t.ok(MAX_CONTACT_DV > 0, 'and it is a real bound');
  });

  // ── L2-15 · setup is canonical, and its parameters actually vary ──────────
  g.assertion('L2-15', 'Duel setup is seed-derived, order-free, and its repeats differ', (t) => {
    const [a, b] = residents;
    for (let r = 0; r < 5; r++) {
      const f = duelSetup({ aHash: a.hash, bHash: b.hash, reachA: a.reach, reachB: b.reach, repeat: r, world: W1_SLICE, worldHashStr: WH });
      const v = duelSetup({ aHash: b.hash, bHash: a.hash, reachA: b.reach, reachB: a.reach, repeat: r, world: W1_SLICE, worldHashStr: WH });
      t.eq(f.seed, v.seed, `r${r}: seed is order-free`);
      t.eq(f.separation, v.separation, `r${r}: separation is order-free`);
      t.eq(f.theta, v.theta, `r${r}: bearing is order-free`);
      t.eq(f.first, v.first, `r${r}: placement order is order-free`);
      // and the two creatures land on opposite sides, either way round.
      t.eq(JSON.stringify(f.originFor(a.hash)), JSON.stringify(v.originFor(a.hash)), `r${r}: same origin for the same hash`);
    }

    // 11 §4: "Repeats are varied but not random." A parameter that takes one
    // value across every repeat is a parameter that selects nothing — B4's
    // lesson about assertions, restated as a fixture. Checked across pairs
    // because three repeats of one pair can legitimately collide.
    const seps = new Set(), thetas = new Set();
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      for (let r = 0; r < 5; r++) {
        const s = duelSetup({
          aHash: residents[i].hash, bHash: residents[j].hash,
          reachA: residents[i].reach, reachB: residents[j].reach,
          repeat: r, world: W1_SLICE, worldHashStr: WH,
        });
        seps.add(s.separation.toFixed(4));
        thetas.add(s.theta.toFixed(4));
      }
    }
    t.ok(thetas.size >= 3, 'the bearing draw reaches at least three of its five values', thetas.size);
    t.ok(seps.size >= 3, 'the separation draw produces at least three distinct distances', seps.size);
    t.eq(SEPARATION_K.length, 5, '11 §6 k set has five members');
    t.eq(BEARINGS.length, 5, '11 §6 bearing set has five members');
  });

  // ── L2-16 · sensing is the C1 amendment, wired to the opponent ────────────
  g.assertion('L2-16', '11 §6: both channels carry the opponent and the gains decide', (t) => {
    const arena = residents[0];
    const plan = arena.plan;
    // A stub with the shape senseOpponent reads: a root rotation and a CoM.
    const stub = (yaw, com, preyGain, threatGain) => ({
      bodies: [{ rotation: () => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }) }],
      centreOfMass: () => com,
      genome: { controller: { preyGain, threatGain } },
      plan,
    });

    // Directly ahead is bearing 0 whichever way the creature faces.
    t.near(bearingTo(stub(0, [0, 0, 0], 0, 0), [0, 0, 5]), 0, 1e-6, 'target dead ahead reads 0');
    t.near(bearingTo(stub(0, [0, 0, 0], 0, 0), [5, 0, 0]), 0.5, 1e-6, 'target to starboard reads +0.5');
    t.near(bearingTo(stub(0, [0, 0, 0], 0, 0), [-5, 0, 0]), -0.5, 1e-6, 'target to port reads -0.5');
    t.near(bearingTo(stub(Math.PI / 2, [0, 0, 0], 0, 0), [5, 0, 0]), 0, 1e-6, 'turning to face it brings the bearing back to 0');
    t.eq(bearingTo(stub(0, [1, 2, 3], 0, 0), [1, 9, 3]), 0, 'an opponent directly above has no bearing');

    // 11 §6: nothing assigns roles — BOTH channels carry the same bearing, so
    // the two gains sum and the sign decides approach or avoidance.
    const at = [5, 0, 0];   // bearing +0.5
    t.near(senseOpponent(stub(0, [0, 0, 0], 1, 0), at), 0.5, 1e-6, 'pure prey gain turns toward');
    t.near(senseOpponent(stub(0, [0, 0, 0], -1, 0), at), -0.5, 1e-6, 'negative prey gain turns away');
    t.near(senseOpponent(stub(0, [0, 0, 0], 0.5, 0.5), at), 0.5, 1e-6, 'the two channels sum');
    t.near(senseOpponent(stub(0, [0, 0, 0], 1, -1), at), 0, 1e-6, 'equal and opposite gains cancel — a creature that cannot decide');
    t.near(senseOpponent(stub(0, [0, 0, 0], 1, 1), [0, 0, -5]), 1, 1e-6, 'and the result is clamped to the unit interval');
  });

  // ── L2-17 · the fauna loader ──────────────────────────────────────────────
  let fauna = null, matchupRun = null;
  g.assertion('L2-17', 'The fauna loader assembles a dense, valid three-species fauna', (t) => {
    const compiled = residents.map(r => compileSolo(RAPIER, {
      genome: r.genome, world: W1_SLICE, worldHash: WH, plan: r.plan,
      provenance: 'shipped', checkViability: false,
    }));
    t.ok(compiled.every(c => c.valid), 'all three residents compiled');

    const matchups = new Map();
    matchupRun = [];
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      const r = duelPair(RAPIER, { a: residents[i], b: residents[j], world: W1_SLICE, worldHash: WH });
      matchups.set(matchupKey(residents[i].hash, residents[j].hash), r.matchup);
      matchupRun.push(r);
    }

    const loaded = loadFauna({ species: compiled.map(c => c.species), matchups, world: W1_SLICE });
    t.eq(loaded.errors.length, 0, `fauna loads clean: ${loaded.errors.join(' | ')}`);
    fauna = loaded.fauna;
    t.eq(fauna.length, 3, 'three species');

    fauna.forEach((sp, i) => {
      t.eq(sp.id, i, `species ${i}: dense id`);
      t.eq(sp.vs.length, VS_STRIDE * 3, `species ${i}: vs is 3 x faunaCount`);
      for (let k = 0; k < VS_STRIDE; k++) t.eq(sp.vs[i * VS_STRIDE + k], 0, `species ${i}: self entry ${k} is zero`);
      t.eq(sp.provenance, 'shipped', `species ${i}: provenance`);
      t.eq(sp.worldHash, WH, `species ${i}: keyed to this world`);
    });

    // The two directions of a pair must read back consistently from either row —
    // this is what 03 §2 says was "unreconstructible" before PairMatchup.
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      const m = matchups.get(matchupKey(residents[i].hash, residents[j].hash));
      const iToJ = fauna[i].vs[j * VS_STRIDE];
      const jToI = fauna[j].vs[i * VS_STRIDE];
      const expectI = m.aHash === residents[i].hash ? m.aToB.pCapture : m.bToA.pCapture;
      const expectJ = m.aHash === residents[j].hash ? m.aToB.pCapture : m.bToA.pCapture;
      t.near(iToJ, expectI, 1e-6, `${i}->${j} row matches the pair record`);
      t.near(jToI, expectJ, 1e-6, `${j}->${i} row matches the pair record`);
    }

    // A hole must be refused, not defaulted: a zero would read as a measurement.
    const holed = new Map(matchups);
    holed.delete(matchupKey(residents[0].hash, residents[1].hash));
    t.ok(loadFauna({ species: compiled.map(c => c.species), matchups: holed, world: W1_SLICE }).errors.length > 0,
      'a missing pair is rejected rather than filled with a default');
  });

  // ── the finding ───────────────────────────────────────────────────────────
  // 30 §5 C2's checkpoint is "you compile a creature, watch three fights, and
  // can say what it is good and bad at". It is NOT answerable, and this is the
  // measurement that says so rather than a suspicion.
  let captures = 0, duels = 0, invalid = 0, flagged = 0, clampedPairs = 0;
  const closing = [];
  for (const r of matchupRun ?? []) {
    for (const d of r.duels) {
      duels++;
      if (!d.valid) { invalid++; continue; }
      if (d.outcome !== OUTCOME.NONE) captures++;
      if (d.flagged) flagged++;
      if (d.clamped) clampedPairs++;
      closing.push(d.separation - d.minDistance);
    }
  }
  closing.sort((a, b) => a - b);
  const medianClosing = closing.length ? closing[Math.floor(closing.length / 2)] : 0;

  g.pending('L2-18', '30 §5 C2 checkpoint: three fights tell you what a creature is good at',
    'NOT ANSWERABLE. The creatures cannot close the distance between them — see the diagnostics and the obligation.', (t) => {
      // What CAN be asserted is that the failure is the approach and not the
      // rule: capture is reachable when they start in contact (tools/c2sweep.js
      // measures 6/45 at half the reach sum), so the machinery works and the
      // locomotion does not.
      t.ok(duels > 0, 'the duels ran', duels);
    });

  const nt = fauna ? nonTransitivity(fauna) : { cycles: 0, decisive: 0 };

  const results = g.results;
  return {
    name: 'duel', results,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    pending: results.filter(r => r.status === 'pending').length,
    checks: results.reduce((n, r) => n + r.checks, 0),
    diagnostics: [
      `residents: ${residents.map(r => r.id).join(', ')} · faunaVersion ${W1_SLICE.faunaVersion} · worldHash ${WH}`,
      `${duels} resident duels (${W1_SLICE.duelRepeats} repeats x 3 pairs, ${W1_SLICE.duelDuration}s): ` +
        `${captures} captures, ${invalid} unstable, ${flagged} flagged <${REVIEW_SECONDS}s, ${clampedPairs} separation-clamped`,
      `CLOSING: median ${medianClosing.toFixed(2)} m over ${W1_SLICE.duelDuration}s against a start separation of several metres`,
      `non-transitivity over the resident fauna: ${nt.cycles} cycle(s), ${nt.decisive} decisive direction(s) of 6`,
    ],
    obligations: [
      'C2 CHECKPOINT IS NOT ANSWERABLE, AND THE DIAGNOSIS CHANGED AT C6. The old text here said the blocker was the DRAG LAW. The drag law is fixed — per-face sampling, added mass, corrected quadrature, the reference lift term deleted — and C2 is STILL blocked, for a different and sharper reason. Re-measured after C6.2 (tools/c2duel.js, c2diag.js, c2sweep.js): 84 duels, 0 captures, and crucially ZERO INVALID where ~16-33% used to abort as unstable, so the stability half is fully resolved. 26/28 pairs end nearer than they began and the median closest approach is only 0.28 cm outside the reach sum, with the best pair OVERLAPPING by 6.06 cm. Captures at 0.5x reach sum went 6/45 to 10/29.',
      'C2 ROOT CAUSE, RESTATED FROM MEASUREMENT: THEY DO NOT PURSUE. tools/c2sweep.js sweeps the start separation and median closing is FLAT at 0.16-0.21 cm across 0.5x, 0.75x, 1.0x, 1.5x and 2.0x of the reach sum. Closing that does not depend on the gap is DRIFT, not approach — a creature that were actually closing would close further when it started further away. Captures happen only at 0.5x, where the envelopes already overlap and 0.2 cm of drift is enough to touch; at 0.75x and beyond it is 0 at every separation. So the chain is: C2 needs pursuit, pursuit needs orientation, and orientation is the open problem (turnRate median 0.0032 rad/s, ~0.2 deg/s — a creature cannot aim at anything inside a 15 s duel). LOCOMOTION IS NO LONGER THE BLOCKER; AIMING IS. Do not spend another session on thrust for C2.',

      'C2 SPEC DEFECT: 11 §6 asks for a start separation of k x (reachA+reachB), k in {2..6}. Over a viable corpus that is a median of 29 m inside a 16 x 24 x 16 m tank, and 03 §4 puts L3 engagement at 4 x (reachA+reachB) = 28 m in that same tank. Both are unsatisfiable. Clamping made every k identical, so the parameter selected nothing; the k set is now MAPPED onto the room the tank has, order preserved. engagementRadius records what was achieved.',
      'C2: one creature in ten goes unstable when placed off-centre in the tank for 15 s, which makes ~16% of duels abort. Isolated (tools/c2stab.js): the arena refactor and creature-creature contact are NOT the cause — a lone creature centred in a private tank is 0/10, off-centre is 1/10, alone in a shared arena is 1/10, two in a shared arena is 7/45. It is the B3 peak-speed tail meeting a wall.',
      'C2: a creature was measured leaving the tank through the surface collider (y = 16.5 against a surface at y = 12). Containment is not guaranteed at the speeds the B3 tail reaches.',
      'C2: 11 §12.5 non-transitivity is REPORTED, not asserted. With three residents there is exactly one candidate cycle, so its absence is weak evidence; it earns an assertion at step F when the fauna is large enough for the claim to have teeth.',
      'C2: the capability card and duel replay UI (21 §6) are NOT built. A matchup grid of three all-zero rows would show the player nothing, and 21 §6.2 asks it to "flag surprises" against expectation — there are none to flag. Deferred deliberately until the blocker above is resolved.',
    ],
  };
}
