// engine/l1/mutate.js — mutation operators (10 §A9).
//
// PURITY (01 §4, N1–N3): no Math.random, no Date, no DOM, no upward imports.
// The rng is injected and every operator is a pure function of (genome, rng).
//
// A9 calls this "the most failure-prone part of the project": bad operators
// produce a stream of broken bodies and the player concludes the game is boring
// when it is actually buggy. Two invariants make that diagnosable rather than
// mysterious, and both are asserted in gate/breed.js:
//
//   1. EXACTLY ONE MUTATION PER CALL. Not "one per element with probability p".
//      A9 prefers this because it removes the need for mutation-rate
//      normalisation entirely, and it makes the diff between parent and child
//      readable: if an offspring is unrecognisable, the operator is at fault and
//      you can see which one.
//   2. THE GENOME GRAPH STAYS CONNECTED. Every structural operator that could
//      orphan a node refuses instead, so no repair pass exists and no operator
//      quietly changes two things — the removal and the repair.
//
// Mutation pressure is the ONE tuning knob: call mutate() 1–3 times per
// offspring (see breed.js), rather than a table of twelve probabilities.

import {
  RANGE, FREQ_MULTS, makeId, makeNode, makeConnection, q, qClamp, reachability,
} from './genome.js';
import { SLICE_LIMITS, ALL_FACES, clampReflection } from './factory.js';
// SAME LAYER, legal import (N3 forbids upward, not sideways). removeNode needs
// to know what a removal COSTS in expressed bodies, and morphogenesis is the
// only thing that knows. It is pure and deterministic, so this adds no state.
import { morphogenesis } from './morphogen.js';

/**
 * Gaussian field jitter, per A9: "scaled relative to the current value so large
 * quantities move freely and small ones tune finely, clamped to legal range".
 *
 * PURELY relative scaling has a hole A9 does not mention: a gene sitting at
 * exactly zero — `bias`, `hueShift`, `phaseLag` all reach it — has sigma zero and
 * can NEVER move again. It is an absorbing state, and it is the kind of defect
 * that shows up as "some lineages stop evolving" months later. So sigma carries a
 * floor proportional to the legal span.
 */
const REL_SIGMA = 0.25;   // of the current value
const MIN_SIGMA = 0.05;   // of the legal span

export function jitter(rng, value, range) {
  const [lo, hi] = range;
  const sigma = REL_SIGMA * Math.abs(value) + MIN_SIGMA * (hi - lo);
  // qClamp, not clamp-then-quantise: see genome.js. Clamping to exactly -PI and
  // then quantising produces a value BELOW -PI, which validateGenome rejects.
  return qClamp(value + rng.normal() * sigma, range);
}

/** Pick a value from `arr` that is not `current`. Returns `current` if it cannot. */
function resample(rng, arr, current) {
  const others = arr.filter(x => x !== current);
  return others.length ? others[rng.int(others.length)] : current;
}

// ── cloning ──────────────────────────────────────────────────────────────────
// Explicit, not structuredClone: the elites must survive breeding BYTE-IDENTICAL
// (N18), so every operator works on a private copy and the caller's genome is
// never touched. Writing the copy out by hand also means a schema field added
// later without updating this function shows up as a gate failure rather than as
// a mutation that silently shares state with its parent.

// EXPORTED for crossover.js. A graft copies individual nodes and connections out
// of the other parent, and writing a second copier there would be two hand-written
// statements of the same schema that drift apart silently — which is the exact
// failure the "explicit, not structuredClone" rule above exists to make loud.
export const cloneNode = (n) => ({
  id: n.id,
  dims: n.dims.slice(),
  density: n.density,
  recursiveLimit: n.recursiveLimit,
  joint: { type: n.joint.type, angleLimits: n.joint.angleLimits.slice(), phaseLag: n.joint.phaseLag },
  colorGenes: { ...n.colorGenes },
});

export const cloneConn = (c) => ({
  id: c.id,
  parentNodeId: c.parentNodeId,
  childNodeId: c.childNodeId,
  parentFace: c.parentFace,
  position: c.position.slice(),
  orientation: c.orientation.slice(),
  scale: c.scale.slice(),
  reflectX: c.reflectX, reflectY: c.reflectY, reflectZ: c.reflectZ,
  terminalOnly: c.terminalOnly,
});

export function cloneGenome(g) {
  const jointGenes = {};
  for (const k of Object.keys(g.controller.jointGenes)) jointGenes[k] = { ...g.controller.jointGenes[k] };
  return {
    version: g.version,
    seed: g.seed,
    rootNodeId: g.rootNodeId,
    nodes: g.nodes.map(cloneNode),
    connections: g.connections.map(cloneConn),
    material: { ...g.material },
    controller: {
      omega: g.controller.omega,
      preyGain: g.controller.preyGain,
      threatGain: g.controller.threatGain,
      jointGenes,
    },
    social: { ...g.social },
  };
}

// ── housekeeping ─────────────────────────────────────────────────────────────

/**
 * A9: "removeDanglingConnections before any connection mutation".
 *
 * With generated ids and the connectivity rule below, a dangling connection
 * cannot arise — every removal takes its own edges with it. The sweep runs
 * anyway and REPORTS what it removed, because a silent no-op and a silent repair
 * look identical from outside, and the gate asserts the count is zero. If it ever
 * stops being zero, an operator is leaking.
 */
export function removeDanglingConnections(g) {
  const ids = new Set(g.nodes.map(n => n.id));
  const before = g.connections.length;
  g.connections = g.connections.filter(c => ids.has(c.parentNodeId) && ids.has(c.childNodeId));
  return before - g.connections.length;
}

const outDegree = (g) => {
  const d = new Map(g.nodes.map(n => [n.id, 0]));
  for (const c of g.connections) d.set(c.parentNodeId, (d.get(c.parentNodeId) || 0) + 1);
  return d;
};

/** Every node still reachable from the root, following connections as directed edges. */
const stillConnected = (g) => reachability(g).connected;

// ── node operators ───────────────────────────────────────────────────────────

function addNode(g, rng, limits) {
  if (g.nodes.length >= limits.maxNodes) return null;
  const d = outDegree(g);
  const hosts = g.nodes.filter(n => d.get(n.id) < limits.maxConnPerNode);
  if (!hosts.length) return null;

  // A node with no inbound edge is unreachable, so it is never expressed and the
  // mutation is invisible. Node and edge arrive together — which is also what
  // makes this the inverse of removeNode.
  const node = randomNodeLike(rng, limits);
  const host = hosts[rng.int(hosts.length)];
  g.nodes.push(node);

  // FIX A (B2 §2.1) — THE NEW NODE'S ONLY INBOUND EDGE IS NEVER terminalOnly.
  //
  // This is the same defect factory.js:165–173 documents and fixes for spanning
  // edges; `randomConnLike` copied the pre-fix version of the draw. A
  // terminalOnly connection is only applied once `depth === node.recursiveLimit`
  // (morphogen.js), and a node reached by exactly one edge from a host sitting
  // at depth 0 with recursiveLimit >= 1 never reaches that condition. So the
  // edge NEVER FIRES: the genome grows a node, the animal grows nothing, and the
  // mutation is invisible.
  //
  // Measured on the shipped tree: the flag was drawn true 48.9% of the time, and
  // those additions grew the body 2.3% of the time against 48.3% for the rest.
  // That one line is half of the whole neutral-drift ratchet.
  //
  // The flag is set AFTER construction rather than by not drawing it, so the rng
  // stream is unchanged and the difference is attributable to this line alone.
  const edge = randomConnLike(rng, limits, host.id, node.id);
  edge.terminalOnly = false;
  g.connections.push(edge);
  g.controller.jointGenes[node.id] = {
    amplitude: q(rng.range(RANGE.amplitude[0], RANGE.amplitude[1])),
    bias: q(rng.range(RANGE.bias[0], RANGE.bias[1])),
    freqMult: FREQ_MULTS[rng.int(FREQ_MULTS.length)],
  };
  return 'addNode';
}

function removeNode(g, rng, limits) {
  // MIN_NODES = 1 (A9), and the root is never removable — it is the entry point
  // morphogenesis starts from, so removing it has no meaning.
  if (g.nodes.length <= 1) return null;
  const candidates = g.nodes.filter(n => n.id !== g.rootNodeId);

  // Candidates in random order, keeping only those whose removal leaves every
  // remaining node reachable. REFUSING is the whole design: the alternative is a
  // repair pass that reattaches orphans, which would make the call change two
  // things and break the one-mutation invariant.
  //
  // FIX B (B2 §2.1) — AMONG THE LEGAL REMOVALS, TAKE THE CHEAPEST.
  //
  // Removing a node removes every edge touching it, so a node that is the sole
  // route to a whole subtree costs far more than one box. Before this, the
  // choice was the first legal candidate in shuffled order, so `removeNode` cost
  // a mean of 1.25 bodies against `addNode`'s 0.37 gain and the walk ran
  // downhill whatever selection wanted. Sorting by cost does not make removal
  // free — it makes it SYMMETRIC with addition, which is the target: drift ~ 0,
  // so that SELECTION decides direction rather than the operator tree.
  //
  // Note what this is NOT. §2.1: "do not add a retry loop to the add operators."
  // A retry inverts the ratchet to +0.16 bodies/mutation and inflates every
  // lineage to the 24-body cap, which is the same defect facing the other way.
  //
  // shuffled() first, then a STABLE sort by cost, so ties stay random and the
  // operator does not develop a systematic preference among equal-cost removals.
  //
  // TOURNAMENT, NOT ARGMIN — see SLICE_LIMITS.removalTournament. The sort runs
  // over a random subset of fixed size rather than over every legal candidate,
  // because a full argmin gets STRONGER as the body gets wider and stops being
  // an inverse of addNode at all.
  const legal = shuffled(rng, candidates)
    .map((n) => {
      const nodes = g.nodes.filter(x => x.id !== n.id);
      const conns = g.connections.filter(c => c.parentNodeId !== n.id && c.childNodeId !== n.id);
      if (!stillConnected({ ...g, nodes, connections: conns })) return null;
      return { n, nodes, conns };
    })
    .filter(Boolean);
  if (!legal.length) return null;

  const k = limits.removalTournament ?? Infinity;
  const entrants = legal.slice(0, Math.max(1, Math.min(k, legal.length)));
  const scored = entrants.map((e) => {
    // Bodies SURVIVING the removal — maximising this minimises the cost.
    // -Infinity, not +, on a plan that will not build: such a candidate must
    // sort LAST, never first.
    let survives = -Infinity;
    try { survives = morphogenesis({ ...g, nodes: e.nodes, connections: e.conns }).bodyCount; } catch { /* sorts last */ }
    return { ...e, survives };
  }).sort((a, b) => b.survives - a.survives);

  const best = scored[0];
  g.nodes = best.nodes;
  g.connections = best.conns;
  delete g.controller.jointGenes[best.n.id];
  return 'removeNode';
}

/**
 * ONE field of one node. The field list is explicit rather than derived from
 * Object.keys so that adding a gene to the schema is a deliberate decision about
 * whether it should mutate, not an accident of iteration order.
 */
const NODE_FIELDS = [
  'dims0', 'dims1', 'dims2', 'density', 'recursiveLimit', 'jointType',
  'angle0', 'angle1', 'angle2', 'phaseLag', 'hueShift', 'valueShift', 'patternPhase',
];

/**
 * The fields that can actually CHANGE under these limits.
 *
 * `SLICE_LIMITS.density` is [1, 1], and `jitter` against a zero-width range
 * returns the value unchanged every time — sigma is nonzero but qClamp collapses
 * it. Leaving `density` in the list would spend 1 draw in 13 on an operator that
 * provably does nothing, which is B4's own recorded defect verbatim: a mutation
 * that changed nothing, and A9's named failure mode "simple creatures appear to
 * produce identical children".
 *
 * Derived from the limits rather than hard-coded, so restoring a real density
 * band at step F re-enables the operator with no further edit.
 */
function nodeFields(limits) {
  const band = limits.density ?? RANGE.density;
  return band[1] > band[0] ? NODE_FIELDS : NODE_FIELDS.filter(f => f !== 'density');
}

function mutateRandomNode(g, rng, limits) {
  const n = g.nodes[rng.int(g.nodes.length)];
  const fields = nodeFields(limits);
  const field = fields[rng.int(fields.length)];
  switch (field) {
    case 'dims0': case 'dims1': case 'dims2': {
      const i = +field.slice(4);
      n.dims[i] = jitter(rng, n.dims[i], RANGE.dim); break;
    }
    // Slice-scoped: see SLICE_LIMITS.density. Unreachable while the band is
    // degenerate, because nodeFields() drops the field.
    case 'density': n.density = jitter(rng, n.density, limits.density ?? RANGE.density); break;
    case 'recursiveLimit': {
      // Integer: +/-1. The single gene that decides whether a node type becomes
      // a chain of repeated segments — an eel — or one body.
      //
      // The DIRECTION is chosen from what is actually reachable, not chosen
      // freely and then clamped. Under SLICE_LIMITS the legal range is [1, 2],
      // so a clamped step is a no-op half the time at either end — a mutation
      // that reports success and changes nothing, which is exactly how "simple
      // creatures appear to produce identical children" (A9) happens.
      const hi = Math.min(limits.maxRecursion, RANGE.recursiveLimit[1]);
      const lo = RANGE.recursiveLimit[0];
      if (hi <= lo) return null;
      const up = n.recursiveLimit <= lo ? true : n.recursiveLimit >= hi ? false : rng.int(2) === 1;
      n.recursiveLimit += up ? 1 : -1;
      break;
    }
    case 'jointType': n.joint.type = resample(rng, limits.jointTypes, n.joint.type); break;
    case 'angle0': case 'angle1': case 'angle2': {
      const i = +field.slice(5);
      n.joint.angleLimits[i] = jitter(rng, n.joint.angleLimits[i], RANGE.angleLimit); break;
    }
    case 'phaseLag': n.joint.phaseLag = jitter(rng, n.joint.phaseLag, RANGE.phaseLag); break;
    default: n.colorGenes[field] = jitter(rng, n.colorGenes[field], RANGE[field]);
  }
  return `mutateRandomNode:${field}`;
}

// ── connection operators ─────────────────────────────────────────────────────

function addConnection(g, rng, limits) {
  const d = outDegree(g);
  const parents = g.nodes.filter(n => d.get(n.id) < limits.maxConnPerNode);
  if (!parents.length) return null;
  const parent = parents[rng.int(parents.length)];
  // The child may be ANY node including the parent itself: a self-reference is
  // recursion, not an error (10 §A5), and it is where segmented bodies come from.
  const child = g.nodes[rng.int(g.nodes.length)];
  g.connections.push(randomConnLike(rng, limits, parent.id, child.id));
  return 'addConnection';
}

function removeConnection(g, rng) {
  if (!g.connections.length) return null;
  for (const c of shuffled(rng, g.connections)) {
    const conns = g.connections.filter(x => x.id !== c.id);
    if (stillConnected({ ...g, connections: conns })) { g.connections = conns; return 'removeConnection'; }
  }
  return null;
}

const CONN_FIELDS = [
  'pos0', 'pos1', 'orient0', 'orient1', 'orient2', 'scale0', 'scale1', 'scale2',
  'parentFace', 'reflect', 'terminalOnly',
];

function mutateRandomConnection(g, rng, limits) {
  if (!g.connections.length) return null;
  const c = g.connections[rng.int(g.connections.length)];
  const field = CONN_FIELDS[rng.int(CONN_FIELDS.length)];
  // BOTH GEOMETRY RULES MUST HOLD UNDER MUTATION TOO, or they decay over
  // generations: the factory would respect them and the mutation operators would
  // walk straight back out. Three fields can violate one — pos0, pos1 and
  // reflect all move the clamp's operands or its precondition — so the clamp is
  // re-applied at the end of the switch rather than inside three cases.
  switch (field) {
    case 'pos0': case 'pos1': {
      const i = +field.slice(3);
      c.position[i] = jitter(rng, c.position[i], RANGE.position); break;
    }
    case 'orient0': case 'orient1': case 'orient2': {
      const i = +field.slice(6);
      c.orientation[i] = jitter(rng, c.orientation[i], RANGE.orientation); break;
    }
    case 'scale0': case 'scale1': case 'scale2': {
      const i = +field.slice(5);
      c.scale[i] = jitter(rng, c.scale[i], RANGE.scale); break;
    }
    case 'parentFace': c.parentFace = resample(rng, limits.allowedFaces ?? ALL_FACES, c.parentFace); break;
    case 'reflect': {
      // Flip ONE axis, and only if the result respects maxReflectionAxes — the
      // cap is structural in the factory (SLICE_LIMITS) and must not be reachable
      // by mutation either, or the constraint decays over generations.
      const axes = ['reflectX', 'reflectY', 'reflectZ'];
      const a = axes[rng.int(3)];
      const next = { ...c, [a]: !c[a] };
      const count = axes.filter(k => next[k]).length;
      if (count <= (limits.maxReflectionAxes ?? 3)) c[a] = !c[a];
      else return null;
      break;
    }
    default: c.terminalOnly = !c.terminalOnly;
  }
  clampReflection(c, limits);
  return `mutateRandomConnection:${field}`;
}

// ── controller operators ─────────────────────────────────────────────────────
//
// DEVIATION FROM A9, REPORTED. A9's controller branch is
// `addOscillator | removeOscillator | jitterRandomJoint`, which is Sims'
// controller — a free graph of oscillator nodes that can grow and shrink
// independently of the body. 10 §A7 replaced that with a fixed CPG carrying
// EXACTLY ONE oscillator per node, and validateGenome enforces the
// correspondence in both directions (a missing entry and an orphan entry are
// both errors). So an oscillator cannot be added or removed without adding or
// removing a node: `addOscillator` IS `addNode` in this schema, and A9's first
// two controller operators are unrepresentable.
//
// The three below preserve what those operators were FOR. Sims' add/remove
// changed the rhythmic structure; jitter tuned it. Here:
//   - resampleFreqMult changes structure — a joint moved from 0.5x to 2x beats
//     against its neighbours instead of with them, which is what turns a
//     travelling wave into a different gait.
//   - mutateOmega changes the whole body's tempo, the one global the CPG has.
//   - jitterRandomJoint tunes amplitude and bias, as A9 says.

function mutateOmega(g, rng) {
  g.controller.omega = jitter(rng, g.controller.omega, RANGE.omega);
  return 'mutateOmega';
}

/**
 * THE SENSOR GAINS. Without this operator the two genes are inert whatever the
 * factory draws: `mutateGenome` rebuilds the controller by copying `preyGain`
 * and `threatGain` verbatim, so an initial population could vary but a lineage
 * could never move. Selection needs both — variation to start from and variation
 * to keep generating — and this supplies the second.
 *
 * One gene per call rather than both, for the same reason every other operator
 * here touches one field: a mutation that moves two genes at once cannot be
 * attributed, and the approach/avoid decision is exactly the place where the
 * sign of ONE of them is the whole phenotype.
 */
function mutateSensorGain(g, rng) {
  const which = rng.int(2) ? 'preyGain' : 'threatGain';
  g.controller[which] = jitter(rng, g.controller[which], RANGE[which]);
  return `mutateSensorGain:${which}`;
}

function resampleFreqMult(g, rng) {
  const ids = Object.keys(g.controller.jointGenes);
  if (!ids.length) return null;
  const jg = g.controller.jointGenes[ids[rng.int(ids.length)]];
  const next = resample(rng, FREQ_MULTS, jg.freqMult);
  if (next === jg.freqMult) return null;
  jg.freqMult = next;
  return 'resampleFreqMult';
}

function jitterRandomJoint(g, rng) {
  const ids = Object.keys(g.controller.jointGenes);
  if (!ids.length) return null;
  const jg = g.controller.jointGenes[ids[rng.int(ids.length)]];
  if (rng.int(2)) jg.amplitude = jitter(rng, jg.amplitude, RANGE.amplitude);
  else jg.bias = jitter(rng, jg.bias, RANGE.bias);
  return 'jitterRandomJoint';
}

// ── appearance and social ────────────────────────────────────────────────────
//
// A FOURTH BRANCH, NOT IN A9'S TREE. DECLARED DEVIATION.
//
// A9's tree has three branches because Sims' genome had three parts. This genome
// has two more, and both must mutate or they are dead weight:
//   - 10 §A10 states outright that "MaterialGenes mutate like everything else.
//     Pattern is inherited, so lineages become visually recognisable." A frozen
//     material makes every descendant of one ancestor identically coloured, which
//     is precisely the opposite of that sentence.
//   - The six social genes drive every steering and feeding decision in L3
//     (12 §, via 03 §3). If they never mutate, the ecology cannot select on them
//     and D2's verdict is decided entirely by morphology.
//
// Equal weight with the other three, so each branch is 1/4 rather than 1/3.

function mutateMaterial(g, rng) {
  const keys = ['hue', 'hueVariance', 'patternScale', 'patternContrast', 'stripeAnisotropy', 'iridescence'];
  const k = keys[rng.int(keys.length)];
  g.material[k] = jitter(rng, g.material[k], RANGE[k]);
  return `mutateMaterial:${k}`;
}

function mutateSocial(g, rng) {
  const keys = ['trophic', 'boldness', 'cohesion', 'separation', 'alignment', 'separationRadius'];
  const k = keys[rng.int(keys.length)];
  g.social[k] = jitter(rng, g.social[k], RANGE[k]);
  return `mutateSocial:${k}`;
}

// ── the weighted tree ────────────────────────────────────────────────────────

const BRANCHES = {
  nodes:       [addNode, removeNode, mutateRandomNode],
  connections: [addConnection, removeConnection, mutateRandomConnection],
  controller:  [mutateOmega, resampleFreqMult, jitterRandomJoint, mutateSensorGain],
  material:    [mutateMaterial],
  social:      [mutateSocial],
};

/**
 * EXPLICIT WEIGHTS — B2 §2.3. They were implicit and equal before, and the
 * declared deviation from A9 ("a fourth branch was added, equal weight with the
 * other three") turned out to be expensive.
 *
 * MEASURED ON THE SHIPPED TREE: 27.3% of all mutations landed on genes that
 * nothing in the project measures. `social/*` took 12.5% and is L3, unimplemented
 * — six genes that no probe reads, no duel reads and no gate asserts on. Material
 * plus node colour took another 14.8%. Better than a quarter of every breeding
 * budget was spent where neither the player nor any measurement could see it.
 *
 * `material` KEEPS ITS SHARE. 10 §A10 is explicit that "MaterialGenes mutate
 * like everything else. Pattern is inherited, so lineages become visually
 * recognisable", and that is a player-facing property, not a measured one. It is
 * the one of the two that earns its 12.5%.
 *
 * `social` drops to 2.5% rather than to zero. Zero would make the six genes
 * absorbing — a lineage could never move them again — and 10 §A9's own hole is
 * exactly that: a gene with no operator is not "reserved for later", it is dead,
 * and D2 would then find the ecology decided entirely by morphology. 2.5% keeps
 * the channel warm at a cost of one mutation in forty. Restore to 12.5% at D.
 *
 * The 10 points released go to `nodes` and `connections` — the two branches that
 * change what the animal IS, and the two the §2.1 fixes just made unbiased.
 * Weight moved into structure is weight moved into the thing selection can see.
 */
const BRANCH_WEIGHTS = {
  nodes:       0.30,   // was 0.25
  connections: 0.30,   // was 0.25
  controller:  0.25,   // unchanged
  material:    0.125,  // unchanged — 10 §A10
  social:      0.025,  // was 0.125
};

const BRANCH_ORDER = Object.keys(BRANCH_WEIGHTS);

function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The branch order for one call: a weighted draw WITHOUT REPLACEMENT over
 * BRANCH_WEIGHTS.
 *
 * Not simply "pick one weighted branch and apply it". The fallback matters: an
 * operator returns null when it cannot apply — the body is at the node cap,
 * every removal would orphan something — and `mutate` walks the order until one
 * succeeds rather than returning an unchanged genome. A single weighted pick
 * would have to fail the whole call or fall back to an arbitrary order, and the
 * arbitrary order is where a silent bias lives.
 *
 * Drawing the WHOLE order weighted keeps the first pick exactly on the declared
 * weights and makes the fallback follow them too, so the tail is not uniform by
 * accident. Integer arithmetic against rng.int rather than a float accumulator,
 * for the reason trunk/rng.js gives: determinism is exact-integer or it is not
 * determinism.
 */
const WEIGHT_SCALE = 1000;

function weightedOrder(rng) {
  const pool = BRANCH_ORDER.map(k => ({ k, w: Math.round(BRANCH_WEIGHTS[k] * WEIGHT_SCALE) }));
  const out = [];
  while (pool.length) {
    let total = 0;
    for (const p of pool) total += p.w;
    let r = rng.int(total);
    let i = 0;
    while (r >= pool[i].w) { r -= pool[i].w; i++; }
    out.push(pool.splice(i, 1)[0].k);
  }
  return out;
}

/**
 * Apply EXACTLY ONE mutation and return a new genome. The caller's genome is
 * never modified.
 *
 * An operator returns null when it cannot apply — the body is at the node cap,
 * every removal would orphan something, there are no connections yet. Rather
 * than returning an unchanged genome (which would look like a mutation that did
 * nothing, and is how "some lineages stop evolving" happens), the tree is walked
 * until one operator succeeds. Operators within a branch are tried in random
 * order, branches in a rotated order, so the fallback does not systematically
 * favour any one operator.
 *
 * @param {object} genome
 * @param {object} rng  injected; `int`, `range`, `normal`
 * @param {object} [opts] `{ limits, lockMorphology }`
 * @returns {{genome: object, op: string}}
 */
export function mutate(genome, rng, opts = {}) {
  const limits = opts.limits ?? SLICE_LIMITS;
  const g = cloneGenome(genome);

  // A9's "useful extra": restrict mutation to the controller. Body preserved,
  // behaviour varies — "keep this shape, try different swimmers" costs one flag.
  const order = opts.lockMorphology
    ? ['controller']
    : weightedOrder(rng);

  const dangling = removeDanglingConnections(g);

  for (const branch of order) {
    for (const op of shuffled(rng, BRANCHES[branch])) {
      const applied = op(g, rng, limits);
      if (applied) return { genome: g, op: applied, dangling };
    }
  }
  // Unreachable for any genome with at least one node: mutateOmega always applies.
  throw new Error('mutate: no operator could apply — the genome is degenerate');
}

/**
 * Apply `n` mutations. A9: "call mutate() 1-3 times per offspring to control
 * mutation pressure — that single integer becomes your one tuning knob."
 */
export function mutateTimes(genome, rng, n, opts = {}) {
  let g = genome;
  const ops = [];
  for (let i = 0; i < n; i++) {
    const r = mutate(g, rng, opts);
    g = r.genome; ops.push(r.op);
  }
  return { genome: g, ops };
}

// ── random construction, shared with the factory's conventions ───────────────
// These duplicate factory.js's private helpers rather than importing them,
// because the factory's are shaped for building a whole genome at once. The
// RANGES come from the one table in genome.js either way, so they cannot drift.

function randomNodeLike(rng, limits) {
  const u = (r) => qClamp(rng.range(r[0], r[1]), r);
  return makeNode(makeId(rng, 'n'), {
    dims: [u(RANGE.dim), u(RANGE.dim), u(RANGE.dim)],
    density: u(limits.density ?? RANGE.density),   // slice-scoped
    recursiveLimit: RANGE.recursiveLimit[0]
      + rng.int(Math.min(limits.maxRecursion, RANGE.recursiveLimit[1]) - RANGE.recursiveLimit[0] + 1),
    joint: {
      type: limits.jointTypes[rng.int(limits.jointTypes.length)],
      angleLimits: [u(RANGE.angleLimit), u(RANGE.angleLimit), u(RANGE.angleLimit)],
      phaseLag: u(RANGE.phaseLag),
    },
    colorGenes: {
      hueShift: u(RANGE.hueShift), valueShift: u(RANGE.valueShift), patternPhase: u(RANGE.patternPhase),
    },
  });
}

function randomConnLike(rng, limits, parentNodeId, childNodeId) {
  const u = (r) => qClamp(rng.range(r[0], r[1]), r);
  const axes = ['reflectX', 'reflectY', 'reflectZ'];
  const flags = { reflectX: false, reflectY: false, reflectZ: false };
  const n = rng.int(Math.min(limits.maxReflectionAxes ?? 3, 3) + 1);
  const pool = axes.slice();
  for (let i = 0; i < n; i++) flags[pool.splice(rng.int(pool.length), 1)[0]] = true;

  const faces = limits.allowedFaces ?? ALL_FACES;
  return clampReflection(makeConnection(makeId(rng, 'c'), {
    parentNodeId, childNodeId,
    parentFace: faces[rng.int(faces.length)],   // back-face exclusion, §2.4
    position: [u(RANGE.position), u(RANGE.position)],
    orientation: [u(RANGE.orientation), u(RANGE.orientation), u(RANGE.orientation)],
    scale: [u(RANGE.scale), u(RANGE.scale), u(RANGE.scale)],
    ...flags,
    terminalOnly: rng.int(2) === 0,
  }), limits);
}

