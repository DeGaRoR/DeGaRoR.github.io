// gate/runtime.js — behavioural assertions that need code to actually run.
// Browser-capable; the IndexedDB ones report 'pending-env' under Node rather
// than being silently skipped, because a check that vanishes is a check that lies.

import { makeRng, rngFrom } from '../trunk/rng.js';
import { seed } from '../contracts/hash.js';
import { envelope, hasEnvelope, migrate, FutureVersionError, registerMigration, kindOf, SCHEMA_OF } from '../trunk/store.js';
import { GENOME_V, BRIDGE_V } from '../contracts/versions.js';
import { _internals } from '../trunk/nav.js';

function collector() {
  const results = [];
  let cur = null;
  const api = {
    async assertion(id, title, fn) {
      cur = { id, title, status: 'pass', checks: 0, failures: [] };
      try { await fn(api); } catch (e) { cur.failures.push(`threw: ${e.message}`); }
      if (cur.failures.length) cur.status = 'fail';
      results.push(cur); cur = null;
    },
    skip(id, title, note) { results.push({ id, title, status: 'pending', checks: 0, failures: [], note }); },
    ok(c, label, actual) { cur.checks++; if (!c) cur.failures.push(`${label}${actual !== undefined ? ` (got ${JSON.stringify(actual)})` : ''}`); },
    eq(a, b, label) { cur.checks++; if (a !== b) cur.failures.push(`${label}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); },
    throws(fn, Type, label) {
      cur.checks++;
      try { fn(); cur.failures.push(`${label}: did not throw`); }
      catch (e) { if (Type && !(e instanceof Type)) cur.failures.push(`${label}: threw ${e.name}`); }
    },
    results,
  };
  return api;
}

export async function runRuntimeGate() {
  const g = collector();

  // ── R1 · seeded RNG is deterministic and independent ──────────────────────
  await g.assertion('R1', 'Seeded RNG: same seed reproduces, forks are independent', (t) => {
    const a = makeRng(12345), b = makeRng(12345);
    const A = Array.from({ length: 64 }, () => a.u32());
    const B = Array.from({ length: 64 }, () => b.u32());
    t.eq(A.join(','), B.join(','), 'same seed, same stream');

    const c = makeRng(12346);
    t.ok(Array.from({ length: 16 }, () => c.u32()).join(',') !== A.slice(0, 16).join(','), 'different seed, different stream');

    // Derivation from stable strings, per 01 §5.
    t.eq(rngFrom('probe', 'S2', 3).seed, seed('probe', 'S2', 3), 'rngFrom derives via seed()');

    // A fork must not perturb its parent, or draw counts become load-bearing
    // and determinism dies the first time a caller adds a debug draw (N5).
    const p1 = makeRng(999), p2 = makeRng(999);
    p1.u32();
    const child = p1.fork('duel'); for (let i = 0; i < 500; i++) child.u32();
    p2.u32();
    t.eq(p1.u32(), p2.u32(), 'parent stream unaffected by fork consumption');
    t.ok(makeRng(999).fork('a').seed !== makeRng(999).fork('b').seed, 'fork labels give different streams');

    // int() must not be modulo-biased.
    const r = makeRng(7), counts = new Array(3).fill(0);
    for (let i = 0; i < 30000; i++) counts[r.int(3)]++;
    t.ok(counts.every(n => Math.abs(n - 10000) < 400), 'int(3) is unbiased', counts);
    t.throws(() => r.int(0), Error, 'int(0) rejected');

    // THE FIRST DRAW off a fresh seed must be uniform too. This is the dominant
    // usage pattern — rngFrom(...) then draw once — and a weak seeding routine
    // is uniform from about the tenth draw onward, so every test that reuses one
    // generator passes while every genome, probe and duel is quietly skewed.
    // Caught exactly this at B1: node counts averaged 2.90 against an expected 3.50.
    const N = 20000, K = 4, firstDraw = new Array(K).fill(0);
    for (let i = 0; i < N; i++) firstDraw[rngFrom('gate', 'firstdraw', i).int(K)]++;
    const expect = N / K, tol = 4 * Math.sqrt(expect * (1 - 1 / K));   // 4 sigma
    t.ok(firstDraw.every(n => Math.abs(n - expect) < tol),
      `first int(${K}) across ${N} fresh seeds is uniform within 4 sigma (+/-${tol.toFixed(0)})`, firstDraw);

    // ...and so must the first float, since range() is what gene values use.
    let mean = 0;
    for (let i = 0; i < N; i++) mean += rngFrom('gate', 'firstf', i).f32();
    mean /= N;
    t.ok(Math.abs(mean - 0.5) < 0.01, 'first f32() across fresh seeds has mean 0.5', mean.toFixed(4));
  });

  // ── R2 · N9 write-path envelope ───────────────────────────────────────────
  await g.assertion('N9', 'Every stored record carries schemaVersion, profileId, updatedAt', (t) => {
    const e = envelope({ hello: 'world' }, 'genome');
    t.ok(hasEnvelope(e), 'envelope() produces a complete envelope', e);
    t.eq(e.schemaVersion, GENOME_V, "a genome's schemaVersion is GENOME_V");
    t.eq(typeof e.profileId, 'string', 'profileId present');
    t.eq(typeof e.updatedAt, 'number', 'updatedAt present');
    t.ok(!hasEnvelope({ value: 1 }), 'a bare value is not a valid record');
    t.ok(!hasEnvelope({ schemaVersion: 2, profileId: 'x', updatedAt: 1 }), 'an envelope without a value is rejected');

    // ── H5: THE ENVELOPE IS TYPED, AND EACH KIND OWNS ITS SCHEMA. ───────────
    //
    // Every record used to be stamped GENOME_V and migrated through the genome
    // chain regardless of what it held. That is inert only while GENOME_V sits
    // still; the day it moves, every profile and run result in every player's
    // database is handed to a genome migration. The kind is derived from the KEY
    // so no call site can forget it.
    t.eq(kindOf('profile:devseed'), 'profile', 'the key names the kind');
    t.eq(kindOf('record:abc:w1'), 'record', 'and does so for records');
    t.eq(kindOf('nonsense:1'), 'opaque', 'an unrecognised prefix is opaque, never assumed to be a genome');
    t.eq(envelope({}, 'profile').schemaVersion, SCHEMA_OF.profile, 'a profile carries the profile schema');
    t.eq(envelope({}, 'record').schemaVersion, BRIDGE_V, 'a record carries the BRIDGE version, not the genome one');
    t.ok(SCHEMA_OF.record !== SCHEMA_OF.genome,
      'and those differ, so the distinction is load-bearing rather than decorative');
    t.eq(envelope({}, 'profile').kind, 'profile', 'the kind travels with the record');

    // A genome migration must never be reachable from another kind. Registered
    // against 'genome' only, so asking for it as a profile has to fail.
    registerMigration('genome', 90, (v) => ({ ...v, genomeOnly: true }));
    t.eq(migrate({ a: 1 }, 90, 'genome', 91).genomeOnly, true, 'the genome chain runs for genomes');
    t.throws(() => migrate({ a: 1 }, 90, 'profile', 91), Error,
      'and is unreachable from another kind — a missing step throws rather than silently skipping');
  });

  // ── R3 · N10 future-version rejection ─────────────────────────────────────
  await g.assertion('N10', 'A record from a future schema is rejected with a message, never parsed', (t) => {
    t.throws(() => migrate({}, GENOME_V + 1), FutureVersionError, 'future version throws');
    let msg = '';
    try { migrate({}, GENOME_V + 3); } catch (e) { msg = e.message; }
    t.ok(/newer version/i.test(msg), 'the message is for a player, not a stack trace', msg);
    t.ok(/\d/.test(msg), 'the message names the versions', msg);

    // The registry runs forward and is exercised before it is needed.
    registerMigration('genome', GENOME_V, (v) => ({ ...v, migrated: true }));
    t.eq(migrate({ a: 1 }, GENOME_V, 'genome', GENOME_V + 1).migrated, true, 'forward migration applies');
    t.eq(migrate({ a: 1 }, GENOME_V, 'genome', GENOME_V).a, 1, 'same version is a no-op');
  });

  // ── R4 · navigation stack ─────────────────────────────────────────────────
  await g.assertion('R4', 'Screen stack: tabs are independent roots, routes resolve', (t) => {
    const { parseRoute, TABS, PRIMARY } = _internals;
    t.eq(TABS.length, 4, 'four tabs');
    t.eq(PRIMARY, 'tank', 'primary tab is Tank');
    t.eq(parseRoute('#/world').tab, 'world', 'route names a tab');
    t.eq(parseRoute('#/atlas').screen, 'atlas', 'a tab root screen shares its tab id');
    t.eq(parseRoute('').tab, PRIMARY, 'empty route falls back to the primary tab');
    t.eq(parseRoute('#/nonsense').tab, PRIMARY, 'an unknown tab falls back, never blanks');
    t.eq(parseRoute('#/world/nonsense').screen, 'world', 'an unknown screen falls back to the tab root');
  });

  // ── R5 · persistence round-trip ───────────────────────────────────────────
  if (typeof indexedDB === 'undefined') {
    g.skip('R5', 'A value survives a write/read round-trip', 'IndexedDB unavailable under Node — runs in the browser from the dev panel');
  } else {
    await g.assertion('R5', 'A value survives a write/read round-trip', async (t) => {
      const store = await import('../trunk/store.js');
      const key = 'profile:gateprobe';
      const val = { n: 42, s: 'round-trip' };
      await store.set(key, val);
      const back = await store.get(key);
      t.eq(JSON.stringify(back), JSON.stringify(val), 'value round-trips');
      const raw = await store.getRaw(key);
      t.ok(hasEnvelope(raw), 'stored form carries the envelope', raw);
      await store.del(key);
      t.eq(await store.get(key), undefined, 'deleted key reads undefined');
      const keys = await store.list('profile:');
      t.ok(Array.isArray(keys), 'list() returns an array');
    });
  }

  const results = g.results;
  return {
    name: 'runtime', results,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    pending: results.filter(r => r.status === 'pending').length,
    checks: results.reduce((n, r) => n + r.checks, 0),
    obligations: [],
  };
}
