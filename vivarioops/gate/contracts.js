// gate/contracts.js — 03 §7, assertions K1..K8.
//
// A0 status: K1, K2, K4, K5, K6, K7, K8 run live. K3 is PENDING — its machinery is
// exercised against a synthetic fixture, but no producer exists until C2, and a
// fixture I wrote to satisfy an invariant proves nothing about a duel harness.

import { seed, rand01 } from '../contracts/hash.js';
import { BRIDGE_V } from '../contracts/versions.js';
import {
  validateWorld, worldHash, WORLD_HASH_FIELDS, WORLD_SCHEMA, WORLD_UNMEASURED, expectedHashPaths,
  recordKey, checkRecord, assertRecord, ContractError,
} from '../contracts/world.js';
import {
  SPECIES_FIELDS, SPECIES_PENDING_GENES, PRODUCERS, makeSpecies,
  validateSpecies, deriveThresholds, VS_STRIDE,
} from '../contracts/species.js';
import {
  makeMatchup, matchupKey, canonicalPair, pairSeed, placementFirst,
  validateMatchup, assembleVs, engagementRadius, captureModel, CAPTURE_CERTAIN,
} from '../contracts/matchup.js';
import { W1_SLICE, W1_RESIDENT_HASHES_PLACEHOLDER } from '../worlds/w1_slice.js';

// ── harness ──────────────────────────────────────────────────────────────────

function makeCollector() {
  const results = [];
  let current = null;

  const api = {
    assertion(id, title, fn) {
      current = { id, title, status: 'pass', checks: 0, failures: [] };
      try { fn(api); } catch (e) {
        current.failures.push(`threw: ${e.message}`);
      }
      if (current.failures.length) current.status = 'fail';
      results.push(current);
      current = null;
    },
    pending(id, title, note, fn) {
      current = { id, title, status: 'pending', checks: 0, failures: [], note };
      if (fn) { try { fn(api); } catch (e) { current.failures.push(`threw: ${e.message}`); } }
      results.push(current);
      current = null;
    },
    ok(cond, label, actual) {
      current.checks++;
      if (!cond) current.failures.push(`${label}${actual !== undefined ? ` (got: ${JSON.stringify(actual)})` : ''}`);
    },
    eq(a, b, label) {
      current.checks++;
      if (a !== b) current.failures.push(`${label}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
    },
    near(a, b, tol, label) {
      current.checks++;
      if (!(Math.abs(a - b) <= tol)) current.failures.push(`${label}: got ${a}, expected ${b} +/- ${tol}`);
    },
    throws(fn, label) {
      current.checks++;
      try { fn(); current.failures.push(`${label}: did not throw`); }
      catch (e) { if (!(e instanceof ContractError)) current.failures.push(`${label}: threw ${e.name}, expected ContractError`); }
    },
    results,
  };
  return api;
}

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Deterministic synthetic fauna of 3, used by K2/K3. Not a substitute for producers. */
function syntheticFauna() {
  const hashes = ['aaa11111', 'bbb22222', 'ccc33333'];
  const fauna = hashes.map((h, i) => ({ id: i, genomeHash: h }));
  const matchups = new Map();
  const pairs = [[0, 1], [0, 2], [1, 2]];
  const vals = [
    { ab: 0.5, ba: 0.2 },
    { ab: 0.1, ba: 0.7 },
    { ab: 0.0, ba: 0.0 },   // mutual stalemate — a legal outcome, not an error
  ];
  pairs.forEach(([i, j], k) => {
    const [lo, hi] = canonicalPair(hashes[i], hashes[j]);
    const m = makeMatchup();
    m.aHash = lo; m.bHash = hi; m.repeats = W1_SLICE.duelRepeats;
    m.aToB = { pCapture: vals[k].ab, timeToCapture: 6.0, energyRate: 1.2 };
    m.bToA = { pCapture: vals[k].ba, timeToCapture: 9.0, energyRate: 0.8 };
    m.pStalemate = 1 - vals[k].ab - vals[k].ba;
    m.engagementRadius = 4.0;
    matchups.set(matchupKey(lo, hi), m);
  });
  return { fauna, matchups, hashes };
}

// ── the gate ─────────────────────────────────────────────────────────────────

export function runContractGate() {
  const g = makeCollector();
  const W = W1_SLICE;
  const RES = W1_RESIDENT_HASHES_PLACEHOLDER;

  // Preflight: the fixture itself must satisfy the World contract.
  g.assertion('C0', 'W1_SLICE satisfies the World contract', (t) => {
    const v = validateWorld(W);
    t.ok(v.ok, `validateWorld: ${v.errors.join('; ')}`);
    t.ok(typeof worldHash(W, RES) === 'string', 'worldHash returns a string');
  });

  // K1 ───────────────────────────────────────────────────────────────────────
  g.assertion('K1', 'Every Species field has a named producer', (t) => {
    const names = SPECIES_FIELDS.map(f => f.name);
    t.eq(new Set(names).size, names.length, 'no duplicate field names');
    for (const f of SPECIES_FIELDS) {
      t.ok(f.producer in PRODUCERS, `field ${f.name}: unknown producer "${f.producer}"`);
    }
    // The teeth: the struct is GENERATED from the table, so a field cannot exist
    // without a declared producer.
    const tmpl = Object.keys(makeSpecies()).sort();
    t.eq(tmpl.join(','), names.slice().sort().join(','), 'makeSpecies() keys match the producer table exactly');
  });

  // K2 ───────────────────────────────────────────────────────────────────────
  g.assertion('K2', 'vs is dense: 3 x faunaCount, every pair present, self zero', (t) => {
    const { fauna, matchups } = syntheticFauna();
    const rows = assembleVs(fauna, matchups, W.duelDuration);
    t.eq(rows.length, 3, 'one row per species');

    rows.forEach((row, i) => {
      t.eq(row.length, VS_STRIDE * fauna.length, `row ${i} length`);
      for (let k = 0; k < VS_STRIDE; k++) t.eq(row[i * VS_STRIDE + k], 0, `row ${i} self entry ${k} is zero`);
      for (let j = 0; j < fauna.length; j++) {
        if (j === i) continue;
        t.ok(Number.isFinite(row[j * VS_STRIDE]), `row ${i} vs ${j} present`);
      }
    });

    // A full species passes validateSpecies with a dense row.
    const sp = makeSpecies();
    for (const f of SPECIES_FIELDS) sp[f.name] = 1;
    sp.id = 0; sp.vs = rows[0];
    Object.assign(sp, { massBase: 10, massMin: 5, massReproduce: 20 });
    const v = validateSpecies(sp, 3);
    t.ok(v.ok, `dense species accepted: ${v.errors.join('; ')}`);

    // Negatives: a hole, a wrong length, a nonzero self entry.
    const holed = new Map(matchups); holed.delete(matchupKey('aaa11111', 'bbb22222'));
    t.throws(() => assembleVs(fauna, holed, W.duelDuration), 'missing pair rejected');
    t.ok(!validateSpecies({ ...sp, vs: new Float32Array(5) }, 3).ok, 'wrong-length vs rejected');
    const bad = new Float32Array(rows[0]); bad[0] = 0.4;
    t.ok(!validateSpecies({ ...sp, vs: bad }, 3).ok, 'nonzero self entry rejected');
  });

  // K3 ───────────────────────────────────────────────────────────────────────
  g.pending('K3', 'PairMatchup: aToB.pCapture + bToA.pCapture + pStalemate = 1',
    'machinery exercised; activates at C2 when duel.js produces real matchups', (t) => {
      const { matchups } = syntheticFauna();
      for (const m of matchups.values()) {
        const v = validateMatchup(m);
        t.ok(v.ok, `synthetic matchup valid: ${v.errors.join('; ')}`);
      }
      const broken = makeMatchup();
      Object.assign(broken, {
        aHash: 'aaa', bHash: 'bbb', repeats: 3, pStalemate: 0.5, engagementRadius: 4,
        aToB: { pCapture: 0.4, timeToCapture: 5, energyRate: 1 },
        bToA: { pCapture: 0.4, timeToCapture: 5, energyRate: 1 },
      });
      t.ok(!validateMatchup(broken).ok, 'sum 1.3 rejected');
    });

  // K4 ───────────────────────────────────────────────────────────────────────
  g.assertion('K4', 'Canonical seeding: A-then-B and B-then-A are the same fights', (t) => {
    const wh = worldHash(W, RES);
    const pairs = [['aaa', 'bbb'], ['zzz', 'aaa'], ['m1', 'm2'], ['dup', 'dup']];
    for (const [a, b] of pairs) {
      for (let r = 0; r < W.duelRepeats; r++) {
        t.eq(pairSeed(BRIDGE_V, wh, a, b, r), pairSeed(BRIDGE_V, wh, b, a, r), `pairSeed symmetric ${a}/${b} r${r}`);
        t.eq(placementFirst(BRIDGE_V, wh, a, b, r), placementFirst(BRIDGE_V, wh, b, a, r), `placement symmetric ${a}/${b} r${r}`);
      }
      t.eq(matchupKey(a, b), matchupKey(b, a), `matchupKey symmetric ${a}/${b}`);
    }
    // Different repeats and different worlds must NOT collide.
    t.ok(pairSeed(BRIDGE_V, wh, 'aaa', 'bbb', 0) !== pairSeed(BRIDGE_V, wh, 'aaa', 'bbb', 1), 'repeats differ');
    t.ok(pairSeed(BRIDGE_V, 'ffffffff', 'aaa', 'bbb', 0) !== pairSeed(BRIDGE_V, wh, 'aaa', 'bbb', 0), 'worlds differ');
    t.ok(pairSeed(BRIDGE_V + 1, wh, 'aaa', 'bbb', 0) !== pairSeed(BRIDGE_V, wh, 'aaa', 'bbb', 0), 'bridge versions differ');
  });

  // K5 ───────────────────────────────────────────────────────────────────────
  g.assertion('K5', 'worldHash changes on physical/fauna change, not otherwise', (t) => {
    const base = worldHash(W, RES);

    // COMPLETENESS, checked independently of WORLD_HASH_FIELDS. Without this, an
    // entry deleted from the list also deletes its own perturbation check and K5
    // stays green while world identity silently narrows. (Caught by mutation test
    // MUT 1 at A0 — the original K5 did not catch dragCoefficient being removed.)
    const declared = expectedHashPaths().map(p => p.join('.')).sort();
    const actual = WORLD_HASH_FIELDS.map(p => p.join('.')).sort();
    t.eq(actual.join(','), declared.join(','), 'WORLD_HASH_FIELDS matches the schema hashed:true set');

    // Every schema key must make an explicit hashed/not-hashed decision, so a new
    // world parameter cannot be added without someone deciding whether it is identity.
    t.ok(Object.values(WORLD_SCHEMA).every(s => s.hashed !== undefined), 'every schema key declares `hashed`');

    const perturb = (v) => {
      if (typeof v === 'number') return v + 1;
      if (typeof v === 'boolean') return !v;
      if (typeof v === 'string') return v + 'x';
      if (Array.isArray(v)) { const a = v.slice(); a[0] = perturb(a[0]); return a; }
      return v;
    };

    for (const path of WORLD_HASH_FIELDS) {
      const w = clone(W);
      let ref = w; for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]];
      const leaf = path[path.length - 1];
      ref[leaf] = perturb(ref[leaf]);
      t.ok(worldHash(w, RES) !== base, `hashed field changes the hash: ${path.join('.')}`);
    }

    // Non-identity fields must NOT move the hash — otherwise every ecology tweak
    // invalidates every compiled record for no physical reason.
    for (const key of ['name', 'biomassBudget', 'runDuration', 'totalMass', 'HARVEST_RATE',
                       'MAX_AGE', 'diffusionRate', 'pursuitGain', 'phase']) {
      const w = clone(W); w[key] = perturb(w[key]);
      t.eq(worldHash(w, RES), base, `non-hashed field leaves the hash alone: ${key}`);
    }

    // Fauna. The permutations are DERIVED from RES rather than written out as
    // literals: C2 swapped the placeholder ids for real genome hashes and a
    // restated list silently stopped testing the thing it names.
    const swapped = RES.slice(); swapped[swapped.length - 1] += 'X';
    const rotated = RES.slice(1).concat(RES[0]);
    t.ok(worldHash(W, swapped) !== base, 'resident genome change moves the hash');
    t.eq(worldHash(W, rotated), base, 'resident order does not (sorted)');
    t.ok(worldHash(W, RES.slice(0, -1)) !== base, 'resident count change moves the hash');
    t.throws(() => worldHash(W, undefined), 'missing resident hashes rejected');

    // C2: world identity is now derived from the ACTUAL fauna, not placeholders.
    t.eq(RES.length, W.residents.length, 'one genome hash per declared resident');
    t.ok(RES.every(h => /^[0-9a-f]{16}$/.test(h)), 'every resident hash is a real genomeHash', RES);
  });

  // K6 ───────────────────────────────────────────────────────────────────────
  g.assertion('K6', 'Mismatched worldHash or bridgeVersion is rejected, never partially used', (t) => {
    const wh = worldHash(W, RES);
    const good = { genomeHash: 'g1', worldHash: wh, bridgeVersion: BRIDGE_V };

    t.ok(checkRecord(good, wh, BRIDGE_V).ok, 'matching record accepted');
    t.eq(assertRecord(good, wh, BRIDGE_V), good, 'assertRecord returns the record');

    const wrongWorld = { ...good, worldHash: 'deadbeef' };
    t.ok(!checkRecord(wrongWorld, wh, BRIDGE_V).ok, 'world mismatch rejected');
    t.ok(/world-mismatch/.test(checkRecord(wrongWorld, wh, BRIDGE_V).invalidReason), 'invalidReason names the world');
    t.throws(() => assertRecord(wrongWorld, wh, BRIDGE_V), 'world mismatch throws');

    const wrongBridge = { ...good, bridgeVersion: BRIDGE_V + 1 };
    t.ok(!checkRecord(wrongBridge, wh, BRIDGE_V).ok, 'bridge mismatch rejected');
    t.throws(() => assertRecord(wrongBridge, wh, BRIDGE_V), 'bridge mismatch throws');
    t.ok(!checkRecord(null, wh, BRIDGE_V).ok, 'missing record rejected');

    t.eq(recordKey('g1', wh, BRIDGE_V), `record:g1:${wh}:${BRIDGE_V}`, 'storage key carries all three');
  });

  // K7 ───────────────────────────────────────────────────────────────────────
  g.assertion('K7', 'Hazard calibration: P(capture within timeToCapture) = pCapture +/- 0.02', (t) => {
    const TRIALS = 10000;
    const dt = W.dt;

    for (const p of [0.05, 0.1, 0.3, 0.5, 0.8, 0.95]) {
      for (const T of [2.0, 7.5, 15.0]) {
        const model = captureModel(p, T, dt);
        t.eq(model.kind, 'hazard', `p=${p} T=${T} is a hazard model`);
        const ticks = Math.round(T / dt);
        const caseSeed = seed('K7', p, T);
        let hits = 0;
        for (let trial = 0; trial < TRIALS; trial++) {
          const s = seed(caseSeed, trial);
          for (let k = 0; k < ticks; k++) {
            if (rand01(s, k) < model.pTick) { hits++; break; }
          }
        }
        t.near(hits / TRIALS, p, 0.02, `p=${p} T=${T} observed capture frequency`);
      }
    }

    // 03 §4 guards.
    const none = captureModel(0, 10, dt);
    t.eq(none.kind, 'none', 'pCapture 0 -> pure energy drain');
    t.eq(none.pTick, 0, 'no hazard when pCapture is 0');
    const certain = captureModel(CAPTURE_CERTAIN, 10, dt);
    t.eq(certain.kind, 'certain', 'pCapture >= 0.999 -> certain');
    t.eq(certain.at, 10, 'certain capture fires AT timeToCapture, not at tick 1');

    // 10 -> 5: engagementK was HALVED (4.0 -> 2.0) at the C2 re-measure, because
    // k=4 asked for up to 44 cm of engagement inside a 32 cm tank. The literal is
    // pinned here on purpose so that moving the constant costs a deliberate edit
    // in two places — which is exactly what it just did.
    t.eq(engagementRadius(1.0, 1.5, W.engagementK), 5, 'engagementRadius = k x (reachA + reachB), k = 2');
  });

  // K8 ───────────────────────────────────────────────────────────────────────
  g.assertion('K8', 'Mass conservation through reproduction', (t) => {
    const massBase = 12.5, reach = 1.0;
    const d = deriveThresholds(massBase, reach, W);

    t.eq(d.massReproduce, W.MASS_REPRO_RATIO * massBase, 'massReproduce from the fixture ratio');
    t.eq(d.massMin, W.MASS_MIN_RATIO * massBase, 'massMin from the fixture ratio');
    t.ok(d.massMin < massBase && massBase < d.massReproduce, 'threshold ordering', d);

    // The conservation claim itself: one parent at massReproduce -> two at massBase.
    t.eq(d.massReproduce - 2 * massBase, 0, 'parent at 2 x massBase splits into two at massBase, drift 0');

    // No literal is baked in: change the ratio, the derivation must follow.
    const w3 = { ...W, MASS_REPRO_RATIO: 3.0 };
    t.eq(deriveThresholds(massBase, reach, w3).massReproduce, 3 * massBase, 'ratio is read, not hard-coded');

    // perceptionRadius clamps against world width.
    t.eq(d.perceptionRadius, Math.min(W.PERCEPTION_REACH_K * reach, W.PERCEPTION_WORLD_FRAC * W.worldSize[0]),
      'perceptionRadius = min(k x reach, frac x worldWidth)');
    t.eq(deriveThresholds(massBase, 0.1, W).perceptionRadius, W.PERCEPTION_REACH_K * 0.1, 'small reach is not clamped');
  });

  // ── summary ───────────────────────────────────────────────────────────────
  const results = g.results;
  const passed  = results.filter(r => r.status === 'pass').length;
  const failed  = results.filter(r => r.status === 'fail').length;
  const pending = results.filter(r => r.status === 'pending').length;
  const checks  = results.reduce((n, r) => n + r.checks, 0);

  return {
    name: 'contracts',
    results, passed, failed, pending, checks,
    obligations: [
      SPECIES_PENDING_GENES.length
        ? `B1: add ${SPECIES_PENDING_GENES.length} genes to the genome schema — ${SPECIES_PENDING_GENES.join(', ')}. Until then K1's "producer: genome" is a promise, not a fact.`
        : null,
      `C2: replace W1_SLICE.residents placeholders with real genome hashes and bump faunaVersion.`,
      `C2: K3 and the record-level half of K4 (byte-identical PairMatchup) activate when duel.js lands.`,
      `F: pursuitGain/evasionGain are unmeasured fixture defaults — ${WORLD_UNMEASURED.join(', ')}.`,
    ].filter(Boolean),
  };
}
