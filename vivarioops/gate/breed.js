// gate/breed.js — B4 assertions. 30 §4 B4 asks for the mutation viability rate
// as a standing diagnostic, and 10 §A5 promotes N17 and N18 to gate assertions.
// The rest are here because A9 names them as the ways this goes wrong quietly:
// operators that change more than one thing, operators that change nothing, and
// a viability filter whose rejection rate is not watched.
//
// STANDING LESSON (HANDOFF.md): three separate gate bugs in this project were
// the same defect — an assertion deriving its own bound from the code under
// test. Every bound below is either a literal restated from the spec or a value
// predicted from the rule rather than read back from the implementation.
//
// Rapier's init is async, so this suite is async. gate/run.js awaits its loaders.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom, makeRng } from '../trunk/rng.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { FIXED_DT } from '../engine/l1/physics.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import {
  serialise, validateGenome, reachability, CAPS, FREQ_MULTS, RANGE,
} from '../engine/l1/genome.js';
import { mutate, mutateTimes, cloneGenome, jitter } from '../engine/l1/mutate.js';
import {
  assessViability, newTally, record, viabilityRate, VIABILITY, REASONS,
} from '../engine/l1/viability.js';
import { breed, seedPopulation, POPULATION, KIND, MUTATIONS_PER_OFFSPRING } from '../engine/l1/breed.js';
import { binomial, signature, genusSpace, EPITHET_COUNT, NAME_AXES } from '../engine/l1/naming.js';
import {
  cellCentres, unionBounds, stepBudget, hitRadius, classifyPointer, nextSpeed,
  SPEEDS, GRID, TAP, BREEDING_MS,
} from '../ui/tank/sim.js';
import W1_SLICE from '../worlds/w1_slice.js';

const CORPUS = 300;   // structural checks — no physics, so this can be large
const PHYSICS_SAMPLE = 60;   // viability assessments; ~36 ms each

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
    close(a, b, tol, label) { cur.checks++; if (!(Math.abs(a - b) <= tol)) cur.failures.push(`${label}: got ${a}, expected ${b} +/- ${tol}`); },
    throws(fn, label) { cur.checks++; try { fn(); cur.failures.push(`${label}: did not throw`); } catch {} },
    results,
  };
  return api;
}

// ── genome diff ──────────────────────────────────────────────────────────────
// What changed between parent and child, by id. Written here rather than in
// mutate.js deliberately: an assertion that asked the module under test what it
// changed would pass however wrong the module was.

const nodeKey = (n) => JSON.stringify(n);
const connKey = (c) => JSON.stringify(c);

/**
 * Differing SCALARS between two values, recursively.
 *
 * Counting changed ELEMENTS is not enough and a mutation test proved it: a
 * seeded defect that made `jitterRandomJoint` write both amplitude and bias
 * escaped, because one oscillator entry had still changed and the count was
 * still 1. "Exactly one mutation" is a statement about leaves, not about how
 * many objects those leaves are grouped into.
 */
function leafCount(a, b) {
  if (a === b) return 0;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return 1;
  let n = 0;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) n += leafCount(a[k], b[k]);
  return n;
}

function diffGenome(a, b) {
  const byId = (arr) => new Map(arr.map(x => [x.id, x]));
  const an = byId(a.nodes), bn = byId(b.nodes);
  const ac = byId(a.connections), bc = byId(b.connections);

  const d = {
    nodesAdded: [...bn.keys()].filter(k => !an.has(k)),
    nodesRemoved: [...an.keys()].filter(k => !bn.has(k)),
    nodesChanged: [...an.keys()].filter(k => bn.has(k) && nodeKey(an.get(k)) !== nodeKey(bn.get(k))),
    connsAdded: [...bc.keys()].filter(k => !ac.has(k)),
    connsRemoved: [...ac.keys()].filter(k => !bc.has(k)),
    connsChanged: [...ac.keys()].filter(k => bc.has(k) && connKey(ac.get(k)) !== connKey(bc.get(k))),
    materialChanged: Object.keys(a.material).filter(k => a.material[k] !== b.material[k]),
    socialChanged: Object.keys(a.social).filter(k => a.social[k] !== b.social[k]),
    omegaChanged: a.controller.omega !== b.controller.omega,
    jointGenesAdded: Object.keys(b.controller.jointGenes).filter(k => !(k in a.controller.jointGenes)),
    jointGenesRemoved: Object.keys(a.controller.jointGenes).filter(k => !(k in b.controller.jointGenes)),
    jointGenesChanged: Object.keys(a.controller.jointGenes).filter(k =>
      k in b.controller.jointGenes
      && JSON.stringify(a.controller.jointGenes[k]) !== JSON.stringify(b.controller.jointGenes[k])),
  };
  d.total = d.nodesAdded.length + d.nodesRemoved.length + d.nodesChanged.length
    + d.connsAdded.length + d.connsRemoved.length + d.connsChanged.length
    + d.materialChanged.length + d.socialChanged.length + (d.omegaChanged ? 1 : 0)
    + d.jointGenesAdded.length + d.jointGenesRemoved.length + d.jointGenesChanged.length;

  // The same count at LEAF granularity — how many scalar genes moved, not how
  // many elements contain them. This is the number "one mutation per call" is
  // actually about.
  d.leaves = d.nodesChanged.reduce((n, k) => n + leafCount(an.get(k), bn.get(k)), 0)
    + d.connsChanged.reduce((n, k) => n + leafCount(ac.get(k), bc.get(k)), 0)
    + d.jointGenesChanged.reduce((n, k) => n + leafCount(a.controller.jointGenes[k], b.controller.jointGenes[k]), 0)
    + d.materialChanged.length + d.socialChanged.length + (d.omegaChanged ? 1 : 0);
  return d;
}

/** What each operator is ALLOWED to have touched. Restated from A9, not read from mutate.js. */
const EXPECTED = {
  addNode: (d, t) => {
    t.eq(d.nodesAdded.length, 1, 'addNode adds exactly one node');
    t.eq(d.connsAdded.length, 1, 'addNode adds exactly one connection, so the node is expressed');
    t.eq(d.jointGenesAdded.length, 1, 'addNode adds exactly one oscillator');
    t.eq(d.nodesChanged.length + d.connsChanged.length + d.jointGenesChanged.length, 0,
      'addNode leaves every pre-existing element byte-identical');
    t.eq(d.nodesRemoved.length + d.connsRemoved.length, 0, 'addNode removes nothing');
  },
  removeNode: (d, t) => {
    t.eq(d.nodesRemoved.length, 1, 'removeNode removes exactly one node');
    t.eq(d.jointGenesRemoved.length, 1, 'removeNode removes its oscillator too');
    t.eq(d.nodesAdded.length + d.connsAdded.length, 0, 'removeNode adds nothing');
    t.eq(d.nodesChanged.length + d.connsChanged.length + d.jointGenesChanged.length, 0,
      'removeNode leaves survivors byte-identical');
  },
  addConnection: (d, t) => {
    t.eq(d.connsAdded.length, 1, 'addConnection adds exactly one connection');
    t.eq(d.total, 1, 'addConnection changes nothing else');
  },
  removeConnection: (d, t) => {
    t.eq(d.connsRemoved.length, 1, 'removeConnection removes exactly one connection');
    t.eq(d.total, 1, 'removeConnection changes nothing else');
  },
  mutateRandomNode: (d, t) => {
    t.eq(d.nodesChanged.length, 1, 'mutateRandomNode changes exactly one node');
    t.eq(d.total, 1, 'mutateRandomNode changes nothing else');
    t.eq(d.leaves, 1, 'mutateRandomNode moves exactly one gene inside that node');
  },
  mutateRandomConnection: (d, t) => {
    t.eq(d.connsChanged.length, 1, 'mutateRandomConnection changes exactly one connection');
    t.eq(d.total, 1, 'mutateRandomConnection changes nothing else');
    t.eq(d.leaves, 1, 'mutateRandomConnection moves exactly one gene inside that connection');
  },
  mutateOmega: (d, t) => {
    t.eq(d.omegaChanged, true, 'mutateOmega changes omega');
    t.eq(d.total, 1, 'mutateOmega changes nothing else');
  },
  resampleFreqMult: (d, t) => {
    t.eq(d.jointGenesChanged.length, 1, 'resampleFreqMult changes exactly one oscillator');
    t.eq(d.total, 1, 'resampleFreqMult changes nothing else');
    t.eq(d.leaves, 1, 'resampleFreqMult moves exactly one gene inside that oscillator');
  },
  jitterRandomJoint: (d, t) => {
    t.eq(d.jointGenesChanged.length, 1, 'jitterRandomJoint changes exactly one oscillator');
    t.eq(d.total, 1, 'jitterRandomJoint changes nothing else');
    t.eq(d.leaves, 1, 'jitterRandomJoint moves exactly one gene inside that oscillator');
  },
  mutateMaterial: (d, t) => {
    t.eq(d.materialChanged.length, 1, 'mutateMaterial changes exactly one material gene');
    t.eq(d.total, 1, 'mutateMaterial changes nothing else');
  },
  mutateSocial: (d, t) => {
    t.eq(d.socialChanged.length, 1, 'mutateSocial changes exactly one social gene');
    t.eq(d.total, 1, 'mutateSocial changes nothing else');
  },
};

export async function runBreedGate() {
  await RAPIER.init();
  const g = collector();

  const pop = [];
  for (let i = 0; i < CORPUS; i++) pop.push(createRandomGenome(rngFrom('gate', 'b4', i)));

  // One mutant per parent, kept for reuse across assertions.
  const mutants = pop.map((p, i) => {
    const r = mutate(p, rngFrom('gate', 'b4', 'mut', i));
    return { parent: p, ...r };
  });
  const opCounts = new Map();
  for (const m of mutants) {
    const k = m.op.split(':')[0];
    opCounts.set(k, (opCounts.get(k) || 0) + 1);
  }

  // ── L1-23 · exactly one mutation per call ─────────────────────────────────
  g.assertion('L1-23', 'A9: exactly one mutation per call, confined to what the operator names', (t) => {
    let checkedOps = new Set();
    for (const m of mutants) {
      const op = m.op.split(':')[0];
      checkedOps.add(op);
      const expect = EXPECTED[op];
      if (!expect) { t.ok(false, `unknown operator reported: ${m.op}`); continue; }
      expect(diffGenome(m.parent, m.genome), t);
    }
    // An assertion over operators that never fired asserts nothing. All eleven
    // must have been exercised by the corpus, or the sample is too small and
    // this check is weaker than it looks.
    t.eq(checkedOps.size, Object.keys(EXPECTED).length,
      `every operator fired at least once over ${CORPUS} mutations (${[...checkedOps].sort().join(', ')})`);

    // AND: no mutation is a no-op. A9's failure mode is "simple creatures appear
    // to produce identical children"; an operator that clamps back to its own
    // value reports success and changes nothing. Measured before the
    // recursiveLimit repair: 2 in 400.
    let noops = 0;
    for (const m of mutants) if (serialise(m.parent) === serialise(m.genome)) noops++;
    t.eq(noops, 0, 'no mutation leaves the genome byte-identical');

    // AND: the parent is never modified in place. The elites depend on this.
    for (let i = 0; i < 20; i++) {
      t.eq(serialise(pop[i]), serialise(createRandomGenome(rngFrom('gate', 'b4', i))),
        `parent ${i} is untouched by mutation`);
    }
  });

  // ── L1-24 · determinism ───────────────────────────────────────────────────
  g.assertion('L1-24', 'Mutation is deterministic in its seed, and different seeds diverge', (t) => {
    for (let i = 0; i < 25; i++) {
      const a = mutate(pop[i], rngFrom('gate', 'b4', 'det', i));
      const b = mutate(pop[i], rngFrom('gate', 'b4', 'det', i));
      t.eq(serialise(a.genome), serialise(b.genome), `seed ${i} reproduces byte-for-byte`);
      t.eq(a.op, b.op, `seed ${i} picks the same operator`);
    }
    let differ = 0;
    for (let i = 0; i < 25; i++) {
      const a = mutate(pop[i], makeRng(1000 + i));
      const b = mutate(pop[i], makeRng(9000 + i));
      if (serialise(a.genome) !== serialise(b.genome)) differ++;
    }
    t.ok(differ >= 24, 'different seeds give different mutants', differ);

    // mutateTimes(n) is n applications, not one.
    const chain = mutateTimes(pop[0], rngFrom('gate', 'b4', 'chain'), 3);
    t.eq(chain.ops.length, 3, 'mutateTimes(3) reports three operators');
  });

  // ── L1-25 · every mutant is legal ─────────────────────────────────────────
  g.assertion('L1-25', 'Every mutant is a valid, connected genome inside the slice limits', (t) => {
    let invalid = 0, disconnected = 0, overCap = 0, overDegree = 0, overReflect = 0, danglings = 0;
    const firstErrors = [];
    // Three mutations deep, which is the maximum an offspring receives, so the
    // corpus here is what breeding actually produces rather than one step from a
    // factory-fresh genome.
    for (let i = 0; i < CORPUS; i++) {
      const { genome: m } = mutateTimes(pop[i], rngFrom('gate', 'b4', 'deep', i), 3);
      const v = validateGenome(m);
      if (!v.ok) { invalid++; if (firstErrors.length < 3) firstErrors.push(`${i}: ${v.errors[0]}`); }
      if (!reachability(m).connected) disconnected++;
      if (m.nodes.length > SLICE_LIMITS.maxNodes) overCap++;

      const deg = new Map();
      for (const c of m.connections) deg.set(c.parentNodeId, (deg.get(c.parentNodeId) || 0) + 1);
      for (const d of deg.values()) if (d > SLICE_LIMITS.maxConnPerNode) overDegree++;

      for (const c of m.connections) {
        const axes = (c.reflectX ? 1 : 0) + (c.reflectY ? 1 : 0) + (c.reflectZ ? 1 : 0);
        if (axes > SLICE_LIMITS.maxReflectionAxes) overReflect++;
      }
      const ids = new Set(m.nodes.map(n => n.id));
      for (const c of m.connections) if (!ids.has(c.parentNodeId) || !ids.has(c.childNodeId)) danglings++;
    }
    t.eq(invalid, 0, `all ${CORPUS} triple-mutants validate${firstErrors.length ? ` — ${firstErrors.join('; ')}` : ''}`);
    t.eq(disconnected, 0, 'no mutation orphans a node from the root');
    t.eq(danglings, 0, 'no connection references a node that is not there');
    // Restated as literals from 10 §3 Amendment A2, NOT read from SLICE_LIMITS,
    // which is the constant a mutation test would change.
    t.eq(SLICE_LIMITS.maxNodes, 8, 'A2 slice cap: 8 nodes');
    t.eq(SLICE_LIMITS.maxConnPerNode, 3, 'A2 slice cap: 3 connections per node');
    t.eq(overCap, 0, 'no mutant exceeds the node cap');
    t.eq(overDegree, 0, 'no mutant exceeds the per-node connection cap');
    t.eq(overReflect, 0, 'mutation never exceeds the reflection-axis cap the factory respects');
    t.ok(CAPS.maxBodies === 24, 'the instantiation cap is unchanged at 24', CAPS.maxBodies);

    // THE CAPS MUST BE PRESSED, not merely respected. A mutation test caught
    // this: a seeded defect that removed the node-cap check entirely escaped,
    // because a factory genome holds 2-5 nodes and three mutations can add at
    // most three — the corpus above never reaches 8 and the cap is never tested.
    // An assertion whose corpus cannot violate it asserts nothing.
    let deepMax = 0, deepOverCap = 0, deepOverDegree = 0, deepInvalid = 0;
    for (let i = 0; i < 60; i++) {
      const { genome: m } = mutateTimes(pop[i], rngFrom('gate', 'b4', 'press', i), 30);
      deepMax = Math.max(deepMax, m.nodes.length);
      if (m.nodes.length > SLICE_LIMITS.maxNodes) deepOverCap++;
      if (!validateGenome(m).ok || !reachability(m).connected) deepInvalid++;
      const deg = new Map();
      for (const c of m.connections) deg.set(c.parentNodeId, (deg.get(c.parentNodeId) || 0) + 1);
      for (const d of deg.values()) if (d > SLICE_LIMITS.maxConnPerNode) deepOverDegree++;
    }
    t.ok(deepMax === SLICE_LIMITS.maxNodes,
      'thirty mutations actually reach the node cap, so the cap is under test', deepMax);
    t.eq(deepOverCap, 0, 'no genome exceeds the node cap even when mutation pushes against it');
    t.eq(deepOverDegree, 0, 'no genome exceeds the degree cap even when mutation pushes against it');
    t.eq(deepInvalid, 0, 'thirty-deep mutants are still valid and connected');
  });

  // ── L1-26 · lock morphology ───────────────────────────────────────────────
  g.assertion('L1-26', "A9's lock: mutation restricted to the controller leaves the body identical", (t) => {
    let bodyChanged = 0, controllerUnchanged = 0;
    for (let i = 0; i < 60; i++) {
      const { genome: m } = mutateTimes(pop[i], rngFrom('gate', 'b4', 'lock', i), 3, { lockMorphology: true });
      const d = diffGenome(pop[i], m);
      if (d.nodesAdded.length || d.nodesRemoved.length || d.nodesChanged.length
        || d.connsAdded.length || d.connsRemoved.length || d.connsChanged.length) bodyChanged++;
      if (!d.omegaChanged && d.jointGenesChanged.length === 0) controllerUnchanged++;
      // The body plan itself must be identical, which is the property the player
      // is promised — "keep this shape, try different swimmers".
      if (i < 20) {
        t.eq(JSON.stringify(morphogenesis(m).bodies), JSON.stringify(morphogenesis(pop[i]).bodies),
          `locked mutant ${i} instantiates the identical body`);
      }
    }
    t.eq(bodyChanged, 0, 'no locked mutation touches a node or a connection');
    t.eq(controllerUnchanged, 0, 'every locked mutation does change the controller');
  });

  // ── L1-27 · N17 stranger slot ─────────────────────────────────────────────
  g.assertion('L1-27', 'N17: one tank slot is always an unrelated random genome', (t) => {
    const seed = seedPopulation({ RAPIER, rng: rngFrom('gate', 'b4', 'n17seed'), world: W1_SLICE });
    let gen = seed.genomes;

    // Five generations of breeding by taste from the SAME two creatures, which is
    // exactly the behaviour 20 §3 says collapses a population within about five
    // generations without this rule.
    for (let k = 0; k < 5; k++) {
      const before = gen;
      const r = breed({ RAPIER, genomes: gen, selected: [0, 1], rng: rngFrom('gate', 'b4', 'n17', k), world: W1_SLICE });

      const strangers = r.provenance.filter(p => p.kind === KIND.STRANGER);
      t.eq(strangers.length, 1, `generation ${k}: exactly one slot is a stranger`);

      // "Unrelated" asserted from the GENOME, not from the label: node ids are
      // generated, never reused, so a genome sharing no node id with anything in
      // the previous generation cannot be descended from it.
      const slot = r.provenance.findIndex(p => p.kind === KIND.STRANGER);
      const priorIds = new Set(before.flatMap(x => x.nodes.map(n => n.id)));
      const shared = r.genomes[slot].nodes.filter(n => priorIds.has(n.id)).length;
      t.eq(shared, 0, `generation ${k}: the stranger shares no ancestry with the tank`);

      gen = r.genomes;
    }

    // And the point of the rule: five generations of inbreeding still leaves
    // unrelated genetic material in the tank.
    const rootIds = new Set(seed.genomes.flatMap(x => x.nodes.map(n => n.id)));
    const novel = gen.filter(x => x.nodes.every(n => !rootIds.has(n.id))).length;
    t.ok(novel > 0, 'after five generations the tank still holds unrelated material', novel);
  });

  // ── L1-28 · N18 elites unchanged ──────────────────────────────────────────
  g.assertion('L1-28', 'N18: selected creatures survive unchanged, in their own slot', (t) => {
    const seed = seedPopulation({ RAPIER, rng: rngFrom('gate', 'b4', 'n18seed'), world: W1_SLICE });
    for (const selected of [[0], [1, 3], [0, 2, 4], [0, 1, 2, 3, 4]]) {
      const r = breed({ RAPIER, genomes: seed.genomes, selected, rng: rngFrom('gate', 'b4', 'n18', selected.join()), world: W1_SLICE });
      for (const i of selected) {
        t.eq(serialise(r.genomes[i]), serialise(seed.genomes[i]),
          `selection ${selected.join('+')}: slot ${i} survives byte-identical in its own slot`);
        t.eq(r.provenance[i].kind, KIND.ELITE, `slot ${i} is labelled an elite`);
      }
    }
  });

  // ── L1-29 · breed semantics, 10 §A17.3 ────────────────────────────────────
  g.assertion('L1-29', 'A17.3 breed semantics: population 6, elites + offspring + one stranger', (t) => {
    const seed = seedPopulation({ RAPIER, rng: rngFrom('gate', 'b4', 'semseed'), world: W1_SLICE });
    t.eq(POPULATION, 6, 'A17.3: population is fixed at 6');
    t.eq(seed.genomes.length, 6, 'the opening generation has six creatures');

    // 0 selected -> the button is disabled; calling anyway is a UI bug and must
    // be loud rather than silently breeding from an arbitrary parent.
    t.throws(() => breed({ RAPIER, genomes: seed.genomes, selected: [], rng: rngFrom('x'), world: W1_SLICE }),
      'breeding with nothing selected throws');

    // 1 selected -> 1 elite, 1 stranger, 4 offspring, all from that one parent.
    const one = breed({ RAPIER, genomes: seed.genomes, selected: [2], rng: rngFrom('gate', 'b4', 'one'), world: W1_SLICE });
    // Counted into a SORTED string: an object literal compares by insertion
    // order, so the same census read in a different slot order looks different.
    const kinds = (r) => Object.values(KIND)
      .map(k => `${k} ${r.provenance.filter(p => p.kind === k).length}`).join(', ');
    t.eq(one.genomes.length, 6, 'one selected: population stays at 6');
    t.eq(kinds(one), 'elite 1, offspring 4, stranger 1', 'one selected: 1 elite + 4 offspring + 1 stranger');
    t.ok(one.provenance.filter(p => p.kind === KIND.OFFSPRING).every(p => p.parent === 2),
      'one selected: every offspring descends from the selected creature');

    // 3 selected -> 3 elites, 1 stranger, 2 offspring, parents only from the pool.
    const three = breed({ RAPIER, genomes: seed.genomes, selected: [0, 3, 5], rng: rngFrom('gate', 'b4', 'three'), world: W1_SLICE });
    t.eq(kinds(three), 'elite 3, offspring 2, stranger 1', 'three selected: 3 elites + 2 offspring + 1 stranger');
    t.ok(three.provenance.filter(p => p.kind === KIND.OFFSPRING).every(p => [0, 3, 5].includes(p.parent)),
      'three selected: offspring parents come only from the selected pool');

    // SPEC GAP, asserted so the resolution is visible: N17 and N18 cannot both
    // hold when all six are selected. N17 wins and the LAST selection is dropped.
    const all = breed({ RAPIER, genomes: seed.genomes, selected: [0, 1, 2, 3, 4, 5], rng: rngFrom('gate', 'b4', 'all'), world: W1_SLICE });
    t.eq(kinds(all), 'elite 5, offspring 0, stranger 1',
      'all six selected: five elites and the stranger — N17 is not negotiable');
    t.eq(all.droppedElite, 5, 'the elite dropped is the last one selected, so the outcome is predictable');

    // Mutation pressure is A9's single knob and must stay a small integer.
    t.eq(JSON.stringify(MUTATIONS_PER_OFFSPRING), JSON.stringify([1, 3]), 'A9: 1-3 mutations per offspring');
  });

  // ── L1-30 · the viability filter ──────────────────────────────────────────
  const tally = newTally();
  let fellBack = 0, offspringMade = 0;
  g.assertion('L1-30', 'A9 viability: each rule rejects what it names, and the fallback holds', (t) => {
    // Constructed cases, one rule at a time. A filter tested only on random
    // genomes is tested only on what the factory happens to produce.
    const base = pop[0];

    // bodies: a single-node genome with no connections instantiates one body.
    const single = cloneGenome(base);
    single.nodes = [single.nodes[0]];
    single.connections = [];
    single.rootNodeId = single.nodes[0].id;
    single.controller.jointGenes = { [single.nodes[0].id]: base.controller.jointGenes[base.nodes[0].id] };
    t.eq(assessViability(RAPIER, single, W1_SLICE).reason, 'bodies', 'a jointless single body is rejected');

    // mass: density is capped by RANGE, so mass is driven through the ceiling
    // with dimensions instead — 2 m cubes at maximum density.
    const heavy = cloneGenome(base);
    for (const n of heavy.nodes) { n.dims = [2, 2, 2]; n.density = RANGE.density[1]; }
    const heavyResult = assessViability(RAPIER, heavy, W1_SLICE);
    t.ok(['mass', 'oversizeTank'].includes(heavyResult.reason),
      'an implausibly massive creature is rejected', heavyResult.reason);

    // inert: amplitude zero everywhere is a creature whose motors never move.
    // This is the check A9 says "removes most of the why-are-they-all-just-
    // sitting-there experience".
    let inertCaught = 0, inertTried = 0;
    for (let i = 0; i < 12; i++) {
      const still = cloneGenome(pop[i]);
      for (const k of Object.keys(still.controller.jointGenes)) {
        still.controller.jointGenes[k].amplitude = 0;
        still.controller.jointGenes[k].bias = 0;
      }
      const r = assessViability(RAPIER, still, W1_SLICE);
      if (r.reason === 'bodies' || r.reason === 'mass' || r.reason === 'oversizeTank') continue;
      inertTried++;
      if (r.reason === 'inert') inertCaught++;
    }
    t.ok(inertTried >= 8, 'enough motionless creatures reached the inertness check', inertTried);
    t.eq(inertCaught, inertTried, 'every creature whose motors are silent is rejected as inert');

    // The thresholds themselves, restated from A9 as literals.
    t.eq(VIABILITY.minBodies, 2, 'A9: fewer than 2 bodies is not viable');
    t.eq(VIABILITY.maxBodies, 24, 'A9: more than 24 bodies is not viable');
    t.eq(VIABILITY.minMass, 0.2, 'A9: minimum mass 0.2');
    t.eq(VIABILITY.maxMass, 40, 'A9: maximum mass 40');
    t.eq(VIABILITY.maxAttempts, 12, 'A9: max 12 attempts before falling back');
    t.eq(VIABILITY.settleSeconds, 2.0, 'A9: simulate headless for 2 seconds');

    // The fallback. With a filter that rejects everything, A9 requires the
    // unmutated parent — never an invalid creature and never an empty slot.
    const seed = seedPopulation({ RAPIER, rng: rngFrom('gate', 'b4', 'fbseed'), world: W1_SLICE });
    const impossible = { ...W1_SLICE, tankBounds: [0.001, 0.001, 0.001] };
    const r = breed({ RAPIER, genomes: seed.genomes, selected: [0], rng: rngFrom('gate', 'b4', 'fb'), world: impossible });
    const kids = r.provenance.filter(p => p.kind === KIND.OFFSPRING);
    t.ok(kids.every(p => p.fellBack), 'when nothing is viable, every offspring falls back', kids.map(p => p.fellBack));
    t.ok(kids.every(p => p.attempts === VIABILITY.maxAttempts), 'the fallback happens only after 12 attempts');
    for (let i = 0; i < POPULATION; i++) t.ok(r.genomes[i] != null, `slot ${i} is never left empty`);
    for (const p of kids) {
      const slot = r.provenance.indexOf(p);
      t.eq(serialise(r.genomes[slot]), serialise(seed.genomes[0]), 'the fallback is the unmutated parent');
    }

    // The standing rate, over mutants — which is the population A9's 60% target
    // is about. Not asserted as a bound here: it IS the diagnostic, and asserting
    // on it would turn a health signal into a thing to be tuned until green.
    for (let i = 0; i < PHYSICS_SAMPLE; i++) {
      const { genome: m } = mutateTimes(pop[i], rngFrom('gate', 'b4', 'rate', i), 1 + (i % 3));
      record(tally, assessViability(RAPIER, m, W1_SLICE));
    }
    t.ok(tally.attempts === PHYSICS_SAMPLE, 'the viability rate was measured over the whole sample', tally.attempts);

    // Every reason must be reachable, or a rule is dead code that looks alive.
    t.ok(REASONS.length === 7, 'seven rejection reasons are defined', REASONS.length);

    // Breeding health over several generations, for the fallback rate.
    let gen = seed.genomes;
    for (let k = 0; k < 4; k++) {
      const b = breed({ RAPIER, genomes: gen, selected: [0, 1], rng: rngFrom('gate', 'b4', 'health', k), world: W1_SLICE });
      for (const p of b.provenance) {
        if (p.kind === KIND.OFFSPRING) { offspringMade++; if (p.fellBack) fellBack++; }
      }
      gen = b.genomes;
    }
    t.eq(fellBack, 0, `no offspring fell back to its parent over ${offspringMade} births in normal conditions`);
  });

  // ── L1-31 · naming ────────────────────────────────────────────────────────
  const names = new Map();
  g.assertion('L1-31', 'A10: the binomial is derived from structure and is deterministic', (t) => {
    for (let i = 0; i < CORPUS; i++) {
      const plan = morphogenesis(pop[i]);
      const b = binomial(plan, pop[i]);
      names.set(b.binomial, (names.get(b.binomial) || 0) + 1);
      if (i < 30) {
        t.eq(binomial(morphogenesis(pop[i]), pop[i]).binomial, b.binomial, `creature ${i} names identically twice`);
      }
    }

    // THE POINT OF DERIVED NAMING: same structure, same genus — regardless of
    // everything that is not structure. Two creatures differing only in colour
    // and social genes are the same species.
    for (let i = 0; i < 20; i++) {
      const repainted = cloneGenome(pop[i]);
      repainted.material.hue = (repainted.material.hue + 0.5) % 1;
      repainted.social.boldness = 1 - repainted.social.boldness;
      t.eq(binomial(morphogenesis(repainted), repainted).binomial, binomial(morphogenesis(pop[i]), pop[i]).binomial,
        `creature ${i}: recolouring does not rename it`);
    }

    // And the converse: a structural change must be able to rename. If nothing
    // ever renames, the name is a constant dressed up as a derivation.
    let renamed = 0;
    for (let i = 0; i < 60; i++) {
      const { genome: m } = mutateTimes(pop[i], rngFrom('gate', 'b4', 'name', i), 6);
      if (binomial(morphogenesis(m), m).binomial !== binomial(morphogenesis(pop[i]), pop[i]).binomial) renamed++;
    }
    t.ok(renamed >= 12, 'six mutations rename a fair share of the corpus', renamed);

    // The signature axes are the four A10 names, and each is reachable.
    const sigs = pop.slice(0, CORPUS).map(x => signature(morphogenesis(x), x));
    for (const axis of ['segmentBucket', 'symmetry', 'limbBucket', 'depthBucket']) {
      t.ok(new Set(sigs.map(s => s[axis])).size >= 2, `signature axis ${axis} varies over the corpus`,
        [...new Set(sigs.map(s => s[axis]))]);
    }
    t.eq(genusSpace().length, 72, 'the genus table spans 4 segment x 6 form x 3 suffix');
    t.eq(EPITHET_COUNT, 24, 'A17.5: 24 species epithets');
    t.eq(NAME_AXES.length, 12, 'twelve trait axes, two poles each');
    t.ok(names.size >= 30, `the corpus produces a spread of binomials`, names.size);
  });

  // ── L1-32 · the tank's arithmetic (21 §4.2, §4.3, 01 §7) ──────────────────
  // A screen is the one thing a gate cannot look at, so everything that can be
  // moved out of it has been. These four decisions all fail silently: cells that
  // overlap let creatures interpenetrate across tanks, an unclamped accumulator
  // presents as "the app froze", and a hit radius without a floor makes the
  // smallest creature in the tank unselectable.
  g.assertion('L1-32', 'Tank layout tiles without overlap and the timestep is clamped', (t) => {
    const cells = cellCentres(W1_SLICE.tankBounds);
    t.eq(cells.length, POPULATION, 'there is one cell per creature');
    t.eq(GRID.cols * GRID.rows, POPULATION, 'the grid holds exactly the population');

    // NO TWO CELLS OVERLAP. Each creature is confined to its own W1 tank, so
    // cell centres one full tank apart make cross-tank contact impossible —
    // which is what lets six independent simulations read as one aquarium.
    const [w, h, d] = W1_SLICE.tankBounds;
    let tooClose = 0;
    for (let a = 0; a < cells.length; a++) {
      for (let b = a + 1; b < cells.length; b++) {
        const dx = Math.abs(cells[a][0] - cells[b][0]);
        const dz = Math.abs(cells[a][2] - cells[b][2]);
        if (dx < w - 1e-9 && dz < d - 1e-9) tooClose++;
      }
    }
    t.eq(tooClose, 0, 'no two tank cells overlap');

    // The drawn wireframe is the union of the six real tanks, not a bigger box
    // invented to look roomy.
    const u = unionBounds(W1_SLICE.tankBounds);
    t.eq(JSON.stringify(u), JSON.stringify([w * GRID.cols, h, d * GRID.rows]),
      'the drawn bounds are exactly the union of the cells');
    for (const c of cells) {
      t.ok(Math.abs(c[0]) + w / 2 <= u[0] / 2 + 1e-9 && Math.abs(c[2]) + d / 2 <= u[2] / 2 + 1e-9,
        'every cell lies inside the drawn bounds', c);
    }

    // The accumulator. 01 §7 fixes the step at 1/120 whatever the display does.
    const exact = stepBudget(FIXED_DT * 3, FIXED_DT);
    t.eq(exact.steps, 3, 'three steps of debt run three steps');
    t.ok(Math.abs(exact.carry) < 1e-12, 'an exact multiple leaves no carry', exact.carry);
    const partial = stepBudget(FIXED_DT * 2.5, FIXED_DT);
    t.eq(partial.steps, 2, 'a partial step is carried, not rounded up');
    t.ok(Math.abs(partial.carry - FIXED_DT * 0.5) < 1e-12, 'the remainder carries forward');
    // THE CLAMP. A 400 ms stall asks for 48 steps; running them takes longer
    // than a frame, which asks for more next time. Dropping simulated time is
    // the correct failure — the creatures run slow rather than the page hanging.
    const stall = stepBudget(0.4, FIXED_DT);
    t.ok(stall.steps <= 8, 'a long stall is clamped rather than spiralling', stall.steps);
    t.eq(stall.dropped, true, 'and the drop is reported rather than hidden');
  });

  // ── L1-33 · selection is fair to small creatures (21 §4.3) ────────────────
  g.assertion('L1-33', '21 §4.3: a small creature is never harder to select than a large one', (t) => {
    const fov = 42 * Math.PI / 180, viewport = 800, tap = 44;
    // The floor is what the rule is: at any distance, the hit sphere is at least
    // the tap target. Without it, selecting the smallest creature in the tank is
    // a game of its own and the player concludes selection is broken.
    for (const dist of [10, 40, 120]) {
      const tiny = hitRadius(0.05, dist, fov, viewport, tap);
      const large = hitRadius(6.0, dist, fov, viewport, tap);
      const floor = (tap / 2) * ((2 * dist * Math.tan(fov / 2)) / viewport);
      t.close(tiny, floor, 1e-9, `at ${dist} m a tiny creature gets the full tap target`);
      t.eq(large, 6.0, `at ${dist} m a large creature keeps its own radius`);
      t.ok(tiny > 0, 'the hit radius is positive');
    }
    // Further away means a bigger world-space floor, or the rule stops holding
    // as the player zooms out.
    t.ok(hitRadius(0.05, 120, fov, viewport, tap) > hitRadius(0.05, 10, fov, viewport, tap),
      'the tap floor grows with distance');

    // Tap versus drag, 21 §4.3, implemented once.
    t.eq(classifyPointer({ dx: 2, dy: 2, ms: 100 }), 'tap', 'a small brief press is a tap');
    t.eq(classifyPointer({ dx: 40, dy: 0, ms: 100 }), 'drag', 'movement past 8 px is a drag');
    t.eq(classifyPointer({ dx: 1, dy: 1, ms: 500 }), 'longpress', '400 ms without moving is a long press');
    t.eq(TAP.longPressMs, 400, '21 §4.3: long-press is 400 ms');
    t.eq(TAP.maxMovePx, 8, '21 §4.3: a tap moves less than 8 px');
    t.eq(TAP.maxDurationMs, 250, '21 §4.3: a tap releases inside 250 ms');
    t.eq(BREEDING_MS, 600, '21 §4.4: the BREEDING beat is 600 ms');
    t.eq(JSON.stringify(SPEEDS), JSON.stringify([1, 2, 4]), '21 §4.3: speed cycles 1x/2x/4x');
    t.eq(nextSpeed(4), 1, 'speed wraps');
  });

  const results = g.results;
  const sortedNames = [...names.entries()].sort((a, b) => b[1] - a[1]);
  const rate = viabilityRate(tally);
  const rejections = REASONS.filter(r => tally[r] > 0).map(r => `${r} ${tally[r]}`).join(', ') || 'none';

  return {
    name: 'breed', results,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    pending: 0,
    checks: results.reduce((n, r) => n + r.checks, 0),
    diagnostics: [
      // THE standing diagnostic 30 §4 asks for. Target >= 60%.
      `MUTATION VIABILITY RATE: ${(rate * 100).toFixed(0)}% over ${tally.attempts} mutants ` +
        `(target >= 60%) · rejected: ${rejections}`,
      `fallback to unmutated parent: ${fellBack}/${offspringMade} births`,
      `operator mix over ${CORPUS}: ` + [...opCounts.entries()].sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`).join(' · '),
      `naming: ${names.size} distinct binomials over ${CORPUS} · most common ` +
        sortedNames.slice(0, 3).map(([k, v]) => `${k} x${v}`).join(' · '),
    ],
    obligations: [
      'B4 CHECKPOINT IS HUMAN: "six creatures, select, breed, repeat, and it holds attention for twenty minutes; offspring visibly resemble parents". Needs the tank screen and a person.',
      'B4: 10 §A17.3 still specifies the 40/30/30 asexual/crossover/graft mix. 30 R3 removed recombination from the slice, so only the asexual path exists. Amend A17.3 or step F will read it as implemented.',
      'B4: N17 and N18 are jointly unsatisfiable when all six creatures are selected. N17 wins and the last selection is dropped. Neither 10 §A17.3 nor 21 §4.3 states this.',
      "B4: 10 §A9's inertness threshold (0.05 m in 2 s) rejects 46% of this corpus and its size rule (4x the tank) rejects nothing. Both are amended in viability.js against measurement.",
      "B4: A9's controller operators addOscillator/removeOscillator are unrepresentable — 10 §A7 binds exactly one oscillator per node, so adding one IS addNode. Replaced by resampleFreqMult and mutateOmega.",
      'B4: material and social genes have no branch in A9\'s mutation tree, but 10 §A10 requires MaterialGenes to mutate and L3 selects on the social genes. A fourth branch was added; A9 should be amended.',
    ],
  };
}
