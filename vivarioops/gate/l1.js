// gate/l1.js — B1 assertions. 30 §4: determinism, round-trip byte identity,
// connectivity of 500 random genomes, caps respected, real 1->2 migration.

import { makeRng, rngFrom } from '../trunk/rng.js';
import { GENOME_V } from '../contracts/versions.js';
import {
  serialise, deserialise, genomeHash, validateGenome, reachability, migrate,
  geneValues, isQuantised, RANGE, CAPS, JOINT_TYPES, canonical,
} from '../engine/l1/genome.js';
import { genomeSourcedSpeciesFields } from '../engine/l1/genome.js';
import { mouthsOf } from '../engine/l2/forage.js';
import { createRandomGenome, SLICE_LIMITS, FULL_LIMITS } from '../engine/l1/factory.js';
import { mutateTimes } from '../engine/l1/mutate.js';
import { SPECIES_FIELDS } from '../contracts/species.js';
import {
  morphogenesis, reflectionVariants, obbOverlap, DOF,
  totalMass, boundingRadius, MIN_LIMB_DIMENSION, MAX_LIMB_DIMENSION,
} from '../engine/l1/morphogen.js';
import { dot, cross, sub, qrot, handedness } from '../engine/l1/vecmath.js';

const SAMPLE = 500;

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
    throws(fn, label) { cur.checks++; try { fn(); cur.failures.push(`${label}: did not throw`); } catch {} },
    results,
  };
  return api;
}

/** The 500-genome corpus, built once and reused by every assertion below. */
function corpus(n = SAMPLE, limits = SLICE_LIMITS) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(createRandomGenome(rngFrom('gate', 'l1', i), limits));
  return out;
}

export function runL1Gate() {
  const g = collector();
  const pop = corpus();

  // ── L1-1 · determinism ────────────────────────────────────────────────────
  g.assertion('L1-1', 'Genome creation is deterministic: same seed, identical genome', (t) => {
    for (let i = 0; i < 25; i++) {
      const a = createRandomGenome(rngFrom('gate', 'l1', i));
      const b = createRandomGenome(rngFrom('gate', 'l1', i));
      t.eq(serialise(a), serialise(b), `seed ${i} reproduces byte-for-byte`);
    }
    const x = createRandomGenome(makeRng(1));
    const y = createRandomGenome(makeRng(2));
    t.ok(serialise(x) !== serialise(y), 'different seeds give different genomes');
    // The hash must be a function of content, not of construction path.
    const viaText = deserialise(serialise(pop[0]));
    t.eq(genomeHash(viaText), genomeHash(pop[0]), 'hash survives a serialise/deserialise cycle');
  });

  // ── L1-2 · round-trip byte identity (10 §A14 #3) ──────────────────────────
  g.assertion('L1-2', 'serialise -> deserialise -> serialise is byte-identical', (t) => {
    let worst = null;
    for (const genome of pop) {
      const s1 = serialise(genome);
      const s2 = serialise(deserialise(s1));
      if (s1 !== s2 && !worst) worst = { s1: s1.slice(0, 120), s2: s2.slice(0, 120) };
    }
    t.ok(!worst, `all ${pop.length} genomes round-trip byte-identically`, worst);

    // Twice more, to catch a normalisation that is not idempotent.
    const s1 = serialise(pop[7]);
    t.eq(serialise(deserialise(deserialise(s1) && s1)), s1, 'round-trip is idempotent');

    // Key ORDER must be fixed by construction, not by insertion order. Rebuild a
    // genome with its top-level keys reversed and confirm the text is unchanged.
    const shuffled = {};
    for (const k of Object.keys(pop[3]).reverse()) shuffled[k] = pop[3][k];
    t.eq(serialise(shuffled), serialise(pop[3]), 'serialisation ignores key insertion order');
  });

  // ── L1-3 · connectivity (30 §4 checkpoint) ────────────────────────────────
  g.assertion('L1-3', `All ${SAMPLE} random genomes are connected`, (t) => {
    const bad = [];
    for (const genome of pop) {
      const r = reachability(genome);
      if (!r.connected) bad.push(`${genomeHash(genome)}: orphans ${r.orphans.join(',')}`);
    }
    t.ok(bad.length === 0, `${bad.length} of ${pop.length} disconnected`, bad.slice(0, 3));
    t.ok(pop.every(x => x.nodes.some(n => n.id === x.rootNodeId)), 'root is always a real node');
  });

  // ── L1-4 · caps (10 §A14 #2) ──────────────────────────────────────────────
  g.assertion('L1-4', 'Slice caps are never exceeded', (t) => {
    // The limits are restated here as LITERALS from 10 §3 Amendment A2, not read
    // from SLICE_LIMITS. Checking the corpus against the same constant the factory
    // used proves only that the factory is self-consistent: raise the constant and
    // the check raises with it. (Third time this pattern has bitten — 03 §1's hash
    // list at A0, the runner's suite list at A1, and this. Any assertion that
    // derives its own bound from the code under test is decorative.)
    // A2's jointTypes were ['revolute', 'twist', 'spherical']. RESOLVED AT B2
    // §3.1: spherical is dropped, restored at F. Restated here as a literal for
    // the same reason as everything else in A2 — so the check cannot follow the
    // constant it is checking. 10 §A2 should be amended to record the drop.
    // A2's allowGrafting was `false` from A2 through B4 and is now TRUE. The pin
    // stays, at the new value, for exactly the reason it existed: this flag is
    // what decides whether selecting several creatures means anything, and it
    // must never move without a line changing here and in factory.js. See the
    // measurement recorded at factory.js SLICE_LIMITS.allowGrafting — mutation
    // viability 57%, recombinant viability ~75%, fallback 0 in 720 births.
    // 10 §A2 should be amended to record the flip.
    // A2's maxRecursion was 2 from A2 through A1-of-this-plan and is now 6, the
    // grammar's own full range (RANGE.recursiveLimit is [1, 6]). The pin stays,
    // at the new value, for exactly the reason it existed — this constant decides
    // whether a segmented animal is expressible at all, and it must never move
    // without a line changing here and in factory.js.
    //
    // WHY IT MOVED. At 2 the draw could not produce a chain: over 400 genomes
    // `longestRun >= 4` occurred ZERO times, against 6-7 for every authored
    // creature in the Atlas, and the Eel — one node connected to itself at
    // recursiveLimit 6 — was not a genome this slice could draw. Measured free
    // (tools/_zrecur.mjs): viability flat at 57-62% across 2/3/4/6, body count
    // unmoved. Measured insufficient on its own (tools/_zspine.mjs): 6 alone
    // reaches run >= 4 only 5%, which is why factory.js also carries the spine
    // sub-grammar. 10 §A2 should be amended to record the lift.
    const A2 = { maxNodes: 8, maxRecursion: 6, maxConnPerNode: 3,
                 jointTypes: ['revolute', 'twist'], allowGrafting: true };

    t.eq(SLICE_LIMITS.maxNodes, A2.maxNodes, 'SLICE_LIMITS.maxNodes matches spec 10 §3');
    t.eq(SLICE_LIMITS.maxRecursion, A2.maxRecursion, 'SLICE_LIMITS.maxRecursion matches spec 10 §3');
    t.eq(SLICE_LIMITS.maxConnPerNode, A2.maxConnPerNode, 'SLICE_LIMITS.maxConnPerNode matches spec 10 §3');
    t.eq(SLICE_LIMITS.jointTypes.join(','), A2.jointTypes.join(','), 'SLICE_LIMITS.jointTypes matches spec 10 §3');
    t.eq(SLICE_LIMITS.allowGrafting, A2.allowGrafting, 'grafting is ON in the slice — the pin moved with it, deliberately');
    // The two rates that decide what "selected" means. Restated as literals for
    // the same reason as everything else in A2.
    t.eq(SLICE_LIMITS.crossoverRate, 1, 'every offspring mixes when two or more are selected');
    t.eq(SLICE_LIMITS.graftRate, 0.5, 'half of those also transplant a subgraph — see the sweep in factory.js');
    // maxReflectionAxes WAS the open ambiguity, pinned in two places so that
    // resolving it had to be an explicit edit here and in factory.js rather than
    // a quiet flip. RESOLVED AT B2 §2.2 in favour of reading (a), the
    // FULL_LIMITS value. The pin stays, at the new value, for the same reason it
    // existed: this constant is the single largest lever on variety in the
    // project and it should never move without a line changing here.
    t.eq(SLICE_LIMITS.maxReflectionAxes, 3, 'reflection axes resolved to reading (a) at B2 — see factory.js');

    const over = { nodes: 0, conn: 0, recursion: 0, jointType: 0, reflect: 0 };
    for (const genome of pop) {
      if (genome.nodes.length > A2.maxNodes) over.nodes++;
      const deg = new Map();
      for (const c of genome.connections) {
        deg.set(c.parentNodeId, (deg.get(c.parentNodeId) || 0) + 1);
        if ([c.reflectX, c.reflectY, c.reflectZ].filter(Boolean).length > 3) over.reflect++;
      }
      for (const d of deg.values()) if (d > A2.maxConnPerNode) over.conn++;
      for (const n of genome.nodes) {
        if (n.recursiveLimit > A2.maxRecursion) over.recursion++;
        if (!A2.jointTypes.includes(n.joint.type)) over.jointType++;
      }
    }
    t.eq(over.nodes, 0, 'node count within maxNodes');
    t.eq(over.conn, 0, 'outgoing connections within maxConnPerNode');
    t.eq(over.recursion, 0, 'recursiveLimit within maxRecursion');
    t.eq(over.jointType, 0, 'joint types restricted to the slice set');
    t.eq(over.reflect, 0, 'reflection axes within maxReflectionAxes');
    t.ok(A2.maxConnPerNode <= CAPS.maxConnPerNode, 'slice cap is inside the schema cap');
  });

  // ── L1-36 · the two B2 geometry rules, over BOTH generators ───────────────
  //
  // §2.2 puts these in factory.js and mutate.js and deliberately NOT in
  // morphogen.js, so nothing downstream re-imposes them and an operator that
  // walks out of either rule fails here rather than showing up months later as
  // "reflection stopped doing anything". Both halves matter: the factory
  // respecting a rule that mutation erodes is exactly how a constraint decays
  // over generations, so the mutated corpus is checked as hard as the fresh one.
  g.assertion('L1-36', 'B2 §2.2/§2.4: no back-face attachment, no reflection at the face centre', (t) => {
    const m = SLICE_LIMITS.reflectMinOffset;
    const faces = SLICE_LIMITS.allowedFaces;
    t.ok(!faces.includes(2), 'face 2 is excluded from the allowed set');
    t.ok(m > 0, 'a reflection clamp is configured');

    const check = (genomes, label) => {
      let backFace = 0, degenerate = 0, conns = 0, reflected = 0;
      for (const genome of genomes) {
        for (const c of genome.connections) {
          conns++;
          if (c.parentFace === 2) backFace++;
          if (c.reflectX || c.reflectY || c.reflectZ) reflected++;
          // FACE_NORMAL[2] is -Z and every child attaches by its own -Z face, so
          // a limb on face 2 is aimed back into its grandparent. The anchor
          // scales faceRight by position[0], and reflectX negates faceRight, so
          // a mirrored limb at position[0] === 0 is its own mirror.
          if (c.reflectX && Math.abs(c.position[0]) < m) degenerate++;
          if (c.reflectY && Math.abs(c.position[1]) < m) degenerate++;
        }
      }
      t.eq(backFace, 0, `${label}: no connection attaches to face 2 (${conns} connections)`);
      t.eq(degenerate, 0, `${label}: no reflected connection inside |position| < ${m} (${reflected} reflected)`);
      // An assertion over a corpus that never exercises the rule asserts
      // nothing. Session 10's method note: a signature that cannot fail is not
      // a check. Both rules need something to bite on.
      t.ok(reflected > genomes.length * 0.2, `${label}: the corpus actually carries reflections`, reflected);
    };

    check(pop, 'factory');

    // Three mutations deep, which is what an offspring actually receives, so the
    // corpus here is what breeding produces rather than one step from fresh.
    const mutated = [];
    for (let i = 0; i < 200; i++) {
      mutated.push(mutateTimes(pop[i], rngFrom('gate', 'b2', 'geom', i), 3).genome);
    }
    check(mutated, 'mutated x3');
  });

  // ── L1-5 · schema validity and gene ranges ────────────────────────────────
  g.assertion('L1-5', 'Every random genome validates against the schema', (t) => {
    const bad = [];
    for (const genome of pop) {
      const v = validateGenome(genome);
      if (!v.ok) bad.push(`${genomeHash(genome)}: ${v.errors.slice(0, 2).join('; ')}`);
    }
    t.ok(bad.length === 0, `${bad.length} of ${pop.length} invalid`, bad.slice(0, 3));

    // The validator must actually reject: a range violation is not cosmetic,
    // it is what stops a shared file from producing a body physics cannot build.
    const broken = structuredClone(pop[0]);
    broken.nodes[0].density = 99;
    t.ok(!validateGenome(broken).ok, 'out-of-range density rejected');
    const orphaned = structuredClone(pop[0]);
    orphaned.connections.push({ ...orphaned.connections[0], id: 'cZZZZZ', childNodeId: 'nope' });
    t.ok(!validateGenome(orphaned).ok, 'connection to an unknown node rejected');
    const wrongVer = { ...pop[0], version: 99 };
    t.ok(!validateGenome(wrongVer).ok, 'wrong version rejected');

    // ── MALFORMED SHAPE, NOT JUST OUT-OF-RANGE VALUES (H6) ──────────────────
    //
    // Every case above breaks a VALUE inside a well-formed genome. None of them
    // breaks the SHAPE, and the validator's holes were all in shape: fields were
    // walked with `n.joint?.angleLimits?.forEach(...)`, which visits nothing when
    // the array is absent and reports nothing when it visits nothing. A missing
    // field therefore validated clean and crashed later in morphogenesis, where
    // there is no longer any provenance for where it came from.
    //
    // This was invisible until H5-H8 were mutation-tested: with the anchors
    // removed the suite stayed green, because no assertion had ever handed the
    // validator a genome that was the wrong SHAPE. The rule and its corpus have
    // to arrive together.
    const shapes = [
      ['angleLimits missing entirely', (x) => { delete x.nodes[0].joint.angleLimits; }],
      ['angleLimits too short', (x) => { x.nodes[0].joint.angleLimits = [0.1, 0.2]; }],
      ['angleLimits too long', (x) => { x.nodes[0].joint.angleLimits = [0.1, 0.2, 0.3, 0.4]; }],
      ['angleLimits not an array', (x) => { x.nodes[0].joint.angleLimits = 0.3; }],
      ['connection position missing', (x) => { delete x.connections[0].position; }],
      ['connection position has 3 values, not 2', (x) => { x.connections[0].position = [0, 0, 0]; }],
      ['connection orientation has 2 values, not 3', (x) => { x.connections[0].orientation = [0, 0]; }],
      ['connection scale missing', (x) => { delete x.connections[0].scale; }],
      ['seed above uint32', (x) => { x.seed = 0x1_0000_0000; }],
      ['seed at 2^53', (x) => { x.seed = Number.MAX_SAFE_INTEGER; }],
    ];
    for (const [what, wreck] of shapes) {
      const g2 = structuredClone(pop[0]);
      wreck(g2);
      t.ok(!validateGenome(g2).ok, `rejected: ${what}`);
    }

    // The boundary itself passes, so the bound is a bound and not a ban.
    const maxSeed = structuredClone(pop[0]);
    maxSeed.seed = 0xFFFFFFFF;
    t.ok(validateGenome(maxSeed).ok, 'and the largest legal uint32 seed is still accepted');

    // DESERIALISE MUST VALIDATE (H6). It is the only door external data comes
    // through — a shared fiche, a pasted genome, a record from an older build —
    // and it used to return anything that parsed. A parsed-but-unvalidated
    // genome reaching the engine is the whole failure mode.
    //
    // THE DAMAGE IS APPLIED TO THE SERIALISED FORM, which is the only form
    // external data ever has. Wrecking the hydrated object instead made every
    // case throw on `controller.jointGenes must be an array` — hydrated genomes
    // key jointGenes by nodeId, serialised ones list them — so the corpus never
    // reached the validator at all and the test passed for the wrong reason.
    // It escaped the mutant that deleted the validate call, which is how it was
    // found.
    for (const [what, wreck] of shapes) {
      const g3 = JSON.parse(serialise(pop[0]));
      wreck(g3);
      t.throws(() => deserialise(JSON.stringify(g3)), Error, `deserialise refuses: ${what}`);
    }
    t.ok(deserialise(serialise(pop[0])) != null, 'while a well-formed genome still round-trips');
  });

  // ── L1-6 · quantisation ───────────────────────────────────────────────────
  g.assertion('L1-6', 'Every gene value is quantised to 1e-6', (t) => {
    let bad = 0, sample = null;
    for (const genome of pop) {
      for (const v of geneValues(genome)) {
        if (!isQuantised(v)) { bad++; if (!sample) sample = v; }
      }
    }
    t.eq(bad, 0, 'unquantised gene values', sample);
    // Quantisation is what keeps the serialised form short enough to embed.
    const len = serialise(pop[0]).length;
    t.ok(len < 8000, 'a slice genome serialises compactly', len);
  });

  // ── L1-7 · hash ───────────────────────────────────────────────────────────
  g.assertion('L1-7', 'genomeHash is pure, stable and collision-free over the corpus', (t) => {
    const seen = new Map();
    for (const genome of pop) {
      const h = genomeHash(genome);
      if (seen.has(h) && serialise(seen.get(h)) !== serialise(genome)) {
        t.ok(false, `hash collision on ${h}`);
      }
      seen.set(h, genome);
    }
    t.eq(seen.size, pop.length, `${pop.length} distinct genomes give distinct hashes`);
    t.eq(genomeHash(pop[0]).length, 16, 'hash is 64-bit, 16 hex chars');
    t.eq(genomeHash(pop[0]), genomeHash(pop[0]), 'hash is pure');

    // A one-quantum change to one gene must change the hash, or the record cache
    // will hand a mutated creature its parent's measured capabilities.
    const nudged = structuredClone(pop[0]);
    nudged.nodes[0].dims[0] = Math.round((nudged.nodes[0].dims[0] + 1e-6) * 1e6) / 1e6;
    t.ok(genomeHash(nudged) !== genomeHash(pop[0]), 'a single-quantum mutation changes the hash');
  });

  // ── L1-8 · the real 1 -> 2 migration (30 §4 B1) ───────────────────────────
  g.assertion('L1-8', 'Migration 1 -> 2 is real, forward, and behaviour-preserving', (t) => {
    // A genuine v1-shaped genome: no gains, no social block, no node colorGenes.
    const v2 = pop[11];
    const v1 = structuredClone(canonical(v2));
    v1.version = 1;
    delete v1.controller.preyGain;
    delete v1.controller.threatGain;
    delete v1.social;
    for (const n of v1.nodes) delete n.colorGenes;

    t.ok(!validateGenome(v1).ok, 'the v1 fixture is genuinely not a valid v2');

    const up = deserialise(JSON.stringify(v1));
    t.eq(up.version, GENOME_V, 'migrated to the current version');
    t.eq(up.controller.preyGain, 0, 'preyGain initialised to 0');
    t.eq(up.controller.threatGain, 0, 'threatGain initialised to 0');
    t.ok(up.social && typeof up.social.trophic === 'number', 'social block filled');
    t.ok(up.nodes.every(n => typeof n.colorGenes?.hueShift === 'number'), 'node colorGenes filled');
    t.ok(validateGenome(up).ok, `migrated genome validates: ${validateGenome(up).errors.slice(0, 2).join('; ')}`);

    // Behaviour preservation: zero gain means the sensor term contributes nothing,
    // so every gene that drives motion must be untouched.
    t.eq(up.controller.omega, v2.controller.omega, 'omega unchanged by migration');
    t.eq(JSON.stringify(up.nodes.map(n => n.joint)), JSON.stringify(v2.nodes.map(n => n.joint)), 'joints unchanged');

    // Forward only, and never partially parsed (N10).
    t.throws(() => migrate({ version: GENOME_V + 1 }), 'a future genome version is rejected');
    t.eq(migrate(v2).version, GENOME_V, 'migrating a current genome is a no-op');
  });

  // ── L1-48 · the 4 -> 5 migration, and it must not move a single mouth ──────
  //
  // THE WHOLE POINT OF THIS ASSERTION is the last check, not the first ones.
  // Organ placement became genetic, and a migration that put the mouth ANYWHERE
  // other than where `mouthsOf` derived it would silently re-feed every creature
  // in every stored Atlas — a behavioural change wearing a schema change's
  // clothes. So the old expression is restated here as a LITERAL, and the
  // migrated placement is resolved through morphogenesis and compared to it
  // exactly. Restated rather than imported for the reason L1-4 gives about
  // SLICE_LIMITS: an assertion that derives its own expected value from the code
  // under test is decorative.
  g.assertion('L1-48', 'Migration 4 -> 5 adds organs and moves no mouth', (t) => {
    const v5 = pop[13];
    const v4 = structuredClone(canonical(v5));
    v4.version = 4;
    delete v4.mouth;
    delete v4.controller.chemoGain;
    for (const n of v4.nodes) delete n.sites;

    t.ok(!validateGenome(v4).ok, 'the v4 fixture is genuinely not a valid v5');

    const up = deserialise(JSON.stringify(v4));
    t.eq(up.version, GENOME_V, 'migrated to the current version');
    t.eq(up.controller.chemoGain, 0, 'chemoGain initialised to 0 — blind');
    t.ok(up.nodes.every((n) => Array.isArray(n.sites) && n.sites.length === 0), 'no node gains a site');
    t.ok(validateGenome(up).ok, `migrated genome validates: ${validateGenome(up).errors.slice(0, 2).join('; ')}`);

    // THE DERIVATION THAT SHIPPED UNTIL NOW, restated as a literal.
    const plan = morphogenesis(up);
    const d = plan.bodies[0].dims;
    const axis = d[2] >= d[0] && d[2] >= d[1] ? 2 : (d[1] >= d[0] ? 1 : 0);
    const want = [0, 0, 0];
    want[axis] = d[axis] * 0.5;

    t.eq(plan.mouth.bodyIndex, 0, 'the mouth is on the root body');
    t.eq(JSON.stringify(plan.mouth.local), JSON.stringify(want),
      'the migrated mouth is EXACTLY where mouthsOf derived it');
    t.eq(mouthsOf(plan).length, 1, 'exactly one mouth — count is not a gene');
    t.eq(plan.receptors.length, 0, 'a migrated creature has no receptors');

    // Every gene that drives motion is untouched, as in L1-8.
    t.eq(up.controller.omega, v5.controller.omega, 'omega unchanged by migration');
    t.eq(JSON.stringify(up.nodes.map((n) => n.joint)), JSON.stringify(v5.nodes.map((n) => n.joint)), 'joints unchanged');
  });

  // ── L1-49 · sites replicate with the body, which is where pairs come from ──
  //
  // A site is declared once on a NODE and appears on every body instantiating
  // it, so a mirrored connection yields a PAIR with opposite `side` signs. That
  // is the whole mechanism behind "why two", and it is worth an assertion
  // because it is emergent rather than written: nothing counts receptors, and if
  // instancing ever stopped replicating them, tropotaxis would become
  // unreachable with no other symptom.
  g.assertion('L1-49', 'A node site is replicated onto every body of that node, with a side', (t) => {
    const base = pop[17];
    const mirrored = pop.find((x) => x.connections.some((c) => c.reflectX || c.reflectY || c.reflectZ));
    t.ok(Boolean(mirrored), 'the corpus contains a mirrored connection at all');

    // One site on the root node: it must appear once per body expressing it.
    const withSite = structuredClone(canonical(base));
    // ── THE FIXTURE OWNS ITS OWN PRECONDITIONS ─────────────────────────────────
    //
    // This set a site on the root and counted EVERY receptor in the plan, which
    // was the same number only because no other node could have one: the factory
    // drew `sites: []` for everything. GENOME_V 9 draws them at
    // `SLICE_LIMITS.siteRate`, so the count became 11 against an expected 1 and
    // the assertion went red on a corpus change rather than on a defect.
    //
    // It is B4's lesson pointing the other way: "an assertion whose corpus cannot
    // violate it asserts nothing" — this one could not be violated because the
    // corpus had no sites, so it never tested replication at all. Clearing first
    // makes it test exactly what its sentence claims, whatever the factory draws.
    for (const n of withSite.nodes) n.sites = [];
    withSite.nodes.find((n) => n.id === withSite.rootNodeId).sites = [{ face: 4, at: [0, 0] }];
    const up = deserialise(JSON.stringify(withSite));
    t.ok(validateGenome(up).ok, 'a genome carrying a site validates');
    const plan = morphogenesis(up);
    const rootBodies = plan.bodies.filter((b) => b.nodeId === up.rootNodeId).length;
    t.eq(plan.receptors.length, rootBodies, 'one receptor per body instantiating the node');
    t.ok(plan.receptors.every((r) => r.side === 1 || r.side === -1), 'every receptor carries a side');
    t.ok(plan.receptors.every((r) => Array.isArray(r.normal) && r.normal.length === 3),
      'every receptor carries an outward normal — what a photoreceptor would aim along');

    // The cap is real, not advisory.
    const over = structuredClone(canonical(base));
    over.nodes[0].sites = Array.from({ length: CAPS.maxSitesPerNode + 1 }, () => ({ face: 0, at: [0, 0] }));
    t.ok(!validateGenome(over).ok, `more than ${CAPS.maxSitesPerNode} sites on a node is rejected`);
  });

  // ── L1-9 · the factory is configuration, not structure ────────────────────
  g.assertion('L1-9', 'Loosening the slice limits is a config change, not a migration', (t) => {
    // 10 §3 and 30 §4 both claim this. If it is false, step F is a migration and
    // the claim should be struck from the spec rather than discovered later.
    const full = [];
    for (let i = 0; i < 60; i++) full.push(createRandomGenome(rngFrom('gate', 'full', i), FULL_LIMITS));
    const bad = full.filter(x => !validateGenome(x).ok);
    t.eq(bad.length, 0, 'genomes built at FULL_LIMITS validate against the same schema',
      bad[0] && validateGenome(bad[0]).errors.slice(0, 2));
    t.ok(full.every(x => x.version === GENOME_V), 'same GENOME_V at full limits');
    t.ok(full.some(x => x.nodes.length > SLICE_LIMITS.maxNodes), 'full limits do produce larger genomes');
    t.ok(full.some(x => !SLICE_LIMITS.jointTypes.includes(x.nodes[0].joint.type)),
      'full limits do reach the other joint types');
    t.ok(full.every(x => reachability(x).connected), 'full-limit genomes are still connected');
  });

  // ── L1-10 · the A0 obligation, actually closed ────────────────────────────
  g.assertion('L1-10', "Every Species field declared `producer: genome` is a real gene", (t) => {
    // A0 recorded these as a promise. Deleting the warning would not have made it
    // true; this asserts the declaration and the schema agree, in both directions.
    const declared = SPECIES_FIELDS.filter(f => f.producer === 'genome').map(f => f.name).sort();
    const produced = Object.keys(genomeSourcedSpeciesFields(pop[0])).sort();
    t.eq(produced.join(','), declared.join(','), 'the genome produces exactly the declared fields');
    t.ok(declared.length === 6, 'six genome-sourced fields', declared.length);

    // And they must be real genes: varying across the corpus and inside RANGE.
    for (const k of declared) {
      const vals = pop.map(x => genomeSourcedSpeciesFields(x)[k]);
      t.ok(vals.every(v => Number.isFinite(v) && v >= RANGE[k][0] && v <= RANGE[k][1]),
        `${k} is finite and inside RANGE.${k}`);
      t.ok(new Set(vals).size > pop.length / 10,
        `${k} varies across the corpus rather than being a constant`, new Set(vals).size);
    }
  });

  // ══ B2 · MORPHOGENESIS ═══════════════════════════════════════════════════

  const plans = pop.map(x => morphogenesis(x));

  // ── N6 · determinism ──────────────────────────────────────────────────────
  g.assertion('N6', 'Morphogenesis is deterministic: same genome, identical body plan', (t) => {
    for (let i = 0; i < 30; i++) {
      const a = JSON.stringify(morphogenesis(pop[i]));
      const b = JSON.stringify(morphogenesis(pop[i]));
      t.eq(a, b, `genome ${i} builds identically twice`);
    }
    // ...and identically from a genome that has been through a text round-trip,
    // which is how a shared specimen arrives.
    t.eq(JSON.stringify(morphogenesis(deserialise(serialise(pop[5])))),
         JSON.stringify(morphogenesis(pop[5])), 'plan survives serialisation of its genome');
    // No rng is reachable from here at all: the plan is a function of the genome.
    t.ok(morphogenesis(pop[9]).bodyCount === morphogenesis(pop[9]).bodyCount, 'body count is stable');
  });

  // ── N20 · joint parity ────────────────────────────────────────────────────
  g.assertion('N20', 'Joint parity: an odd number of mirrorings flips the orientation sign', (t) => {
    // 10 §A14 #8 and 20 §3 N20. The reference ships a dedicated regression test
    // for this and calls it the single most likely silent bug in morphogenesis.
    // Built as a MINIMAL two-node genome so the mirrored pair is unambiguous,
    // rather than hunting for one in the corpus.
    const base = structuredClone(pop[0]);
    const [n0, n1] = base.nodes.slice(0, 2);
    base.nodes = [n0, n1];
    base.rootNodeId = n0.id;
    for (const k of Object.keys(base.controller.jointGenes)) {
      if (k !== n0.id && k !== n1.id) delete base.controller.jointGenes[k];
    }
    base.connections = [{
      id: 'cTEST0', parentNodeId: n0.id, childNodeId: n1.id,
      // Off-centre on both face axes, so each reflection actually MOVES the limb.
      // At [0, 0] every variant lands on the same anchor and the overlap rule
      // rejects all but one -- which is correct behaviour, but tests nothing.
      parentFace: 3, position: [0.7, 0.7],
      orientation: [0.4, 0.2, 0.1], scale: [1, 1, 1],
      reflectX: false, reflectY: false, reflectZ: false, terminalOnly: false,
    }];
    // Make the parent large enough that the two mirrored children cannot overlap.
    base.nodes[0].dims = [2, 2, 2];
    base.nodes[1].dims = [0.3, 0.3, 0.3];

    const plain = morphogenesis(base);
    t.eq(plain.jointCount, 1, 'unmirrored genome yields one joint');
    t.eq(plain.joints[0].parity, 1, 'no mirroring -> parity +1');
    t.eq(plain.joints[0].mirrorCount, 0, 'no mirroring -> zero mirror count');

    const mirrored = structuredClone(base);
    mirrored.connections[0].reflectX = true;
    const mp = morphogenesis(mirrored);
    t.eq(reflectionVariants(mirrored.connections[0]).length, 2, 'reflectX gives two variants');
    t.eq(mp.jointCount, 2, 'reflectX yields a mirrored pair');

    const parities = mp.joints.map(j => j.parity).sort();
    t.eq(parities.join(','), '-1,1', 'one of the pair has parity -1, the other +1');
    const counts = mp.joints.map(j => j.mirrorCount).sort();
    t.eq(counts.join(','), '0,1', 'exactly one of the pair is mirrored');

    // The real assertion: the mirrored limb's joint axis must point the OTHER
    // WAY. Equal axes would mean both limbs bend the same direction, which is
    // the visible symptom and the thing that is very hard to trace.
    const unm = mp.joints.find(j => j.mirrorCount === 0);
    const mir = mp.joints.find(j => j.mirrorCount === 1);
    t.ok(dot(unm.axes.x, mir.axes.x) < 0.99, 'mirrored joint x-axis is not the same axis', dot(unm.axes.x, mir.axes.x));
    t.ok(Math.abs(unm.anchor[0] + mir.anchor[0]) < 1e-9 || Math.abs(unm.anchor[2] + mir.anchor[2]) < 1e-9,
      'mirrored anchor is reflected through the parent centre');

    // Two mirrorings is EVEN, so parity must return to +1 on the doubly-mirrored
    // variant. A naive `-1 per mirror` implementation passes the single case and
    // fails here.
    const twice = structuredClone(base);
    twice.connections[0].reflectX = true;
    twice.connections[0].reflectY = true;
    const tp = morphogenesis(twice);
    const byCount = new Map(tp.joints.map(j => [j.mirrorCount, j]));
    t.ok(byCount.has(2), 'a doubly-mirrored variant exists');
    if (byCount.has(2)) t.eq(byCount.get(2).parity, 1, 'two mirrorings -> parity back to +1');
    if (byCount.has(1)) t.eq(byCount.get(1).parity, -1, 'one mirroring -> parity -1');
  });

  // ── L1-11 · caps and dimension bounds ─────────────────────────────────────
  g.assertion('L1-11', 'Body cap and limb dimension bounds hold over the corpus', (t) => {
    let overCap = 0, outOfBounds = 0, empty = 0, singleton = 0;
    for (const p of plans) {
      if (p.bodyCount > CAPS.maxBodies) overCap++;
      if (p.bodyCount === 0) empty++;
      if (p.bodyCount === 1) singleton++;
      for (const b of p.bodies) {
        if (b.dims.some(d => d < MIN_LIMB_DIMENSION - 1e-9 || d > MAX_LIMB_DIMENSION + 1e-9)) outOfBounds++;
      }
    }
    t.eq(overCap, 0, `no plan exceeds ${CAPS.maxBodies} bodies`);
    t.eq(empty, 0, 'no plan is empty');
    t.eq(outOfBounds, 0, 'every limb is within the dimension bounds');
    // A single body has no joints, cannot actuate, and cannot move. It is not a
    // creature. Caught at B2: terminalOnly on a spanning edge never fires,
    // because a node that is never self-referenced sits at depth 0 forever.
    t.eq(singleton, 0, 'no plan is a single jointless blob');
    t.ok(plans.every(p => p.jointCount === p.bodyCount - 1), 'one joint per non-root body');
  });

  // ── L1-12 · cross-sectional area (feeds N19 at B3) ────────────────────────
  g.assertion('L1-12', 'Every joint carries a positive minimum cross-sectional area', (t) => {
    let bad = 0, sample = null;
    for (const p of plans) for (const j of p.joints) {
      if (!(j.minCrossSectionalArea > 0) || !Number.isFinite(j.minCrossSectionalArea)) { bad++; sample ??= j.minCrossSectionalArea; }
    }
    t.eq(bad, 0, 'minCrossSectionalArea is finite and positive', sample);
    // N19 depends on this being a real AREA, not a mass proxy: it must scale as
    // length squared. Double every dimension and the area must quadruple.
    const g2 = structuredClone(pop[1]);
    for (const n of g2.nodes) n.dims = n.dims.map(d => Math.min(2.0, d * 2));
    const a1 = morphogenesis(pop[1]).joints[0]?.minCrossSectionalArea;
    const a2 = morphogenesis(g2).joints[0]?.minCrossSectionalArea;
    t.ok(a1 > 0 && a2 > 0 && a2 > a1, 'scaling dimensions up increases cross-sectional area', [a1, a2]);
    t.ok(plans.every(p => p.dofCount === p.joints.reduce((n, j) => n + DOF[j.type], 0)), 'dofCount matches the joints');
  });

  // ── L1-13 · handedness, cross-checked two ways ────────────────────────────
  g.assertion('L1-13', 'Handedness from geometry agrees with the mirror XOR chain', (t) => {
    // swapX is computed from the triple product of the axes actually used; the
    // spec derives parity from an XOR of mirror flags. They must agree, and
    // checking one against the other is the only way to know that neither has
    // silently drifted.
    let disagree = 0;
    for (const p of plans) {
      for (const b of p.bodies) {
        if (b.parent < 0) continue;
        const xor = (b.mirror.right !== b.mirror.up) !== (b.mirror.forward !== p.bodies[b.parent].swapX);
        if (xor !== b.swapX) disagree++;
      }
    }
    t.eq(disagree, 0, 'geometric handedness equals the accumulated XOR for every limb');
    t.ok(plans.every(p => p.bodies[0].swapX === false), 'the root is never handedness-swapped');
  });

  // ── L1-14 · attachment geometry ───────────────────────────────────────────
  g.assertion('L1-14', 'Every child attaches by its own -Z face at the anchor', (t) => {
    // The convention fixed in 10 §A6 step 6. If it drifts, limbs float off their
    // parents or sink into them, and it looks like a physics bug rather than a
    // placement bug.
    let bad = 0, worst = 0;
    for (const p of plans) {
      for (const j of p.joints) {
        const child = p.bodies[j.childBody];
        const back = qrot(child.rotation, [0, 0, -child.dims[2] * 0.5]);
        const faceCentre = [child.position[0] + back[0], child.position[1] + back[1], child.position[2] + back[2]];
        const parent = p.bodies[j.parentBody];
        const anchorWorld = [
          parent.position[0] + qrot(parent.rotation, j.anchor)[0],
          parent.position[1] + qrot(parent.rotation, j.anchor)[1],
          parent.position[2] + qrot(parent.rotation, j.anchor)[2],
        ];
        const d = Math.hypot(faceCentre[0] - anchorWorld[0], faceCentre[1] - anchorWorld[1], faceCentre[2] - anchorWorld[2]);
        worst = Math.max(worst, d);
        if (d > 1e-6) bad++;
      }
    }
    t.eq(bad, 0, `child -Z face centre coincides with the anchor (worst ${worst.toExponential(2)} m)`);

    // INDEPENDENT of how the anchor was computed: it must lie ON THE SURFACE of
    // the parent box. Along the face normal its magnitude equals the parent's
    // half-extent on that axis; on the other two it stays inside the face.
    // Checking the child against the anchor alone is self-consistent and misses
    // 10 §A6 step 4's scalar `halfExtent`, which puts limbs off the surface of
    // every non-cubic parent -- i.e. of essentially every body.
    let offSurface = 0, outsideFace = 0, worstOff = 0;
    const NORMAL_AXIS = [0, 1, 2, 0, 1, 2];   // face index -> axis it is normal to
    for (const genome of pop) {
      const p = morphogenesis(genome);
      const connById = new Map(genome.connections.map(c => [c.id, c]));
      for (const j of p.joints) {
        const parent = p.bodies[j.parentBody];
        const face = connById.get(j.connectionId).parentFace;
        const axis = NORMAL_AXIS[face];
        const pHalf = [parent.dims[0] / 2, parent.dims[1] / 2, parent.dims[2] / 2];
        const off = Math.abs(Math.abs(j.anchor[axis]) - pHalf[axis]);
        worstOff = Math.max(worstOff, off);
        if (off > 1e-6) offSurface++;
        for (let k = 0; k < 3; k++) {
          if (k !== axis && Math.abs(j.anchor[k]) > pHalf[k] + 1e-6) outsideFace++;
        }
      }
    }
    t.eq(offSurface, 0, `anchor lies on the parent surface along the face normal (worst ${worstOff.toExponential(2)} m)`);
    t.eq(outsideFace, 0, 'anchor lies within the face rectangle on the other two axes');
    t.ok(plans.every(p => p.bodies.every(b => b.position.every(Number.isFinite) && b.rotation.every(Number.isFinite))),
      'no non-finite positions or rotations');
  });

  // ── L1-16 · recursion is per node type, not global tree depth ─────────────
  g.assertion('L1-16', 'Recursion depth resets on node change and increments only on self-reference', (t) => {
    // 10 §A6: newDepth = (child is the same node) ? depth + 1 : 0. Depth is
    // PER NODE TYPE. Using global tree depth instead silently shortens every
    // chain of distinct nodes, and nothing else in the gate notices.
    const mk = (nodes, conns, rootId) => {
      const base = structuredClone(pop[0]);
      base.nodes = nodes; base.rootNodeId = rootId; base.connections = conns;
      base.controller.jointGenes = {};
      for (const n of nodes) base.controller.jointGenes[n.id] = { amplitude: 0.5, bias: 0, freqMult: 1 };
      return base;
    };
    const node = (id, lim) => ({
      id, dims: [0.6, 0.6, 0.6], density: 1, recursiveLimit: lim,
      joint: { type: 'revolute', angleLimits: [0.5, 0.5, 0.5], phaseLag: 0 },
      colorGenes: { hueShift: 0, valueShift: 0, patternPhase: 0 },
    });
    const conn = (id, p, c) => ({
      id, parentNodeId: p, childNodeId: c, parentFace: 5, position: [0, 0],
      orientation: [0, 0, 0], scale: [1, 1, 1],
      reflectX: false, reflectY: false, reflectZ: false, terminalOnly: false,
    });

    // A chain of THREE DISTINCT nodes, each with recursiveLimit 1. Per node type
    // every depth is 0, so all three build. Under global depth the third sits at
    // depth 2 > 1 and is dropped.
    const chain = mk([node('na', 1), node('nb', 1), node('nc', 1)],
      [conn('c1', 'na', 'nb'), conn('c2', 'nb', 'nc')], 'na');
    t.eq(morphogenesis(chain).bodyCount, 3, 'a 3-node distinct chain builds all three bodies');

    // A single self-referencing node with recursiveLimit 2 must produce exactly
    // three bodies: depth 0, 1, 2.
    const selfRec = mk([node('na', 2)], [conn('c1', 'na', 'na')], 'na');
    t.eq(morphogenesis(selfRec).bodyCount, 3, 'self-recursion with limit 2 gives three bodies');

    const selfRec1 = mk([node('na', 1)], [conn('c1', 'na', 'na')], 'na');
    t.eq(morphogenesis(selfRec1).bodyCount, 2, 'self-recursion with limit 1 gives two bodies');

    // terminalOnly fires only once the limit is reached.
    const term = mk([node('na', 1), node('nb', 1)],
      [{ ...conn('c1', 'na', 'na'), }, { ...conn('c2', 'na', 'nb'), terminalOnly: true, parentFace: 4 }], 'na');
    const tp = morphogenesis(term);
    t.ok(tp.bodies.some(b => b.nodeId === 'nb'), 'a terminalOnly connection fires at the recursion limit');
  });

  // ── L1-15 · no overlapping bodies ─────────────────────────────────────────
  g.assertion('L1-15', 'No non-adjacent limbs overlap', (t) => {
    // B2's stop condition names this outcome directly: "not a pile of
    // overlapping boxes". 10 §A6 has no overlap rule at all; the reference
    // rejects an overlapping limb and its whole subtree, and so do we.
    let overlaps = 0, checked = 0;
    for (const p of plans) {
      for (let i = 0; i < p.bodies.length; i++) {
        for (let k = i + 1; k < p.bodies.length; k++) {
          const a = p.bodies[i], b = p.bodies[k];
          if (a.parent === b.index || b.parent === a.index) continue;   // adjacency is normal
          checked++;
          if (obbOverlap(a, b, 1e-3)) overlaps++;
        }
      }
    }
    t.eq(overlaps, 0, `${checked} non-adjacent pairs are all disjoint`);
    // The rule must actually be rejecting things, or it is not doing any work.
    const totalRejected = plans.reduce((n, p) => n + p.rejected.overlap + p.rejected.dimensions, 0);
    t.ok(totalRejected > 0, 'the viability rules reject something', totalRejected);
  });

  const results = g.results;
  const distinctHashes = new Set(pop.map(genomeHash)).size;
  const meanNodes = (pop.reduce((n, x) => n + x.nodes.length, 0) / pop.length).toFixed(2);
  const meanConns = (pop.reduce((n, x) => n + x.connections.length, 0) / pop.length).toFixed(2);
  const recursive = pop.filter(x => x.connections.some(c => c.parentNodeId === c.childNodeId)).length;

  return {
    name: 'l1', results,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    pending: 0,
    checks: results.reduce((n, r) => n + r.checks, 0),
    diagnostics: [
      `corpus ${pop.length} genomes · ${distinctHashes} distinct hashes`,
      `phenotype: mean ${(plans.reduce((n, p) => n + p.bodyCount, 0) / plans.length).toFixed(2)} bodies, ` +
        `max ${Math.max(...plans.map(p => p.bodyCount))}, ` +
        `${plans.filter(p => p.truncated).length} truncated at the cap`,
      `rejected limbs: ${plans.reduce((n, p) => n + p.rejected.dimensions, 0)} out-of-bounds, ` +
        `${plans.reduce((n, p) => n + p.rejected.overlap, 0)} overlapping`,
      `size: median radius ${(() => { const r = plans.map(boundingRadius).sort((a, b) => a - b); return r[Math.floor(r.length / 2)].toFixed(2); })()} cm, ` +
        `median mass ${(() => { const m = plans.map(totalMass).sort((a, b) => a - b); return m[Math.floor(m.length / 2)].toFixed(2); })()} g`,
      `mean ${meanNodes} nodes, ${meanConns} connections · ${((recursive / pop.length) * 100).toFixed(0)}% contain self-recursion`,
      `mean serialised size ${Math.round(pop.reduce((n, x) => n + serialise(x).length, 0) / pop.length)} bytes`,
    ],
    obligations: [
      `B2 §2.2: the A2/A5 reflection ambiguity is RESOLVED — maxReflectionAxes = ${SLICE_LIMITS.maxReflectionAxes}, reading (a). 10 §A2's "allowRadialSymmetry: false" should be amended: it names a gene A5 deleted, and radial symmetry is now reachable and intended.`,
      `B2 §2.1: neutral drift is ${'measured at +0.012 bodies/mutation over 30 000 mutations, against a gate of |drift| < 0.01'}. THE GATE IS INSIDE THE ERROR BAR — per-mutation delta has sd ~1.6, so 2 s.e. at that n is +-0.026. The claim that holds is the 30-generation walk: 9.17 -> 8.95 bodies, flat, against 3.87 -> 3.06 before. Do not re-tune removalTournament against a figure taken below n ~ 90 000.`,
      `B2 §2.1: Fix B is implemented as a tournament of ${SLICE_LIMITS.removalTournament}, NOT as §2.1's literal "prefer the one costing fewest bodies". The full argmin measured +0.110 drift — it finds free removals rather than cheap ones at a 75% discard rate. See factory.js removalTournament.`,
      `B2 §2.2: mean bodies moved 3.91 -> 9.78 (2.5x), and every physics budget in the tree was sized on the old figure. THE RE-MEASURE HAPPENED AND THE NEWS WAS BAD: a burst costs ~13 s of wall clock against a design budget of 5.7 s (see gate/probe.js). That is now a UI problem rather than a measurement one — a worker, a progress affordance, or a smaller population — and design/PLAN.md Phase 4 owns it, because it constrains what "playable breeding" can be.`,
      `B2: effective variety is measured by tools/_zdiv.mjs and is CORPUS-SENSITIVE (+-1.5 across seed namespaces at n=2000, and rising with n). Compare runs of that tool against each other, never against a figure quoted from elsewhere. The design's 17.1 for the shipped tree reads 16.3 here.`,
      `B2 §12 DECISION 1 — SPHERICAL JOINTS: DROPPED from SLICE_LIMITS.jointTypes, restored at F. Grounds beyond the design's corr(spherical, solver speed) = 0.60: rapier3d-compat 0.19.3's SphericalImpulseJoint has NO motor surface at all (so "upgrade the binding" is not a version bump), it has no setLimits either (so three angleLimits genes per spherical joint have always been inert), and it is the known 1e21 divergence at physics.js:944. Cost: mean DOF 5.0 -> 3.0. 10 §A2's joint set should be amended.`,
      `B2 §12 DECISION 2 — THE TORQUE BOUND ON THE SOLVER PATH: DONE, AND THIS OBLIGATION USED TO SAY OTHERWISE. It read "not implemented here: the solver is not the default motor". The solver IS the default motor and the bound was re-imposed with it; the ceiling has since been split out of the gain scale (MUSCLE_STRESS ceiling-only at 2e6 barye, MOTOR_GAIN_STRESS 200 for gains). Two obligations in this same gate contradicted each other for several sittings, which is the argument for reviewing this block whenever a decision lands rather than only appending to it.`,
      `B2 §12 CARRIED, AND IT IS NOW THE NEXT MORPHOLOGY LEVER: RANGE.dim's floor is still deferred. Bodies are drawn 0.2-2.0 cm INDEPENDENTLY PER AXIS, so a single node can be 0.2 x 2.0 x 0.2 before any connection touches it — raw node aspect p90 5.72. The taper gradient closed almost the whole gap between the old body-aspect p90 of 11.96 and that floor (landing at 6.02), so THE REMAINING ASPECT IS IN RANGE.dim AND NOT IN THE GRADIENT. More taper is the wrong lever. It also still blocks fins, wings, membranes and vanes, which is what blocked two of the five creatures §6.1 tried to author.`,
    ],
  };
}
