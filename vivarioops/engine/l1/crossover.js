// engine/l1/crossover.js — sexual reproduction (10 §A9's graft, 10 §A17.3's mix).
//
// PURITY (01 §4, N1–N3): no Math.random, no Date, no DOM, no upward imports.
// The rng is injected and every function here is a pure function of its arguments;
// neither parent is modified, which N18 depends on absolutely — the elites that
// fathered a child must survive the same breed byte-identical.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────
//
// Until now `breed()` was asexual: every child had exactly one parent. Selecting
// three creatures produced three unchanged elites, one stranger and two
// single-parent mutants, so selecting MORE parents produced FEWER children and
// none of them mixed anything. The player reads that as a slot machine, because
// from outside it is one.
//
// genome.js:112 promised this would be cheap: "generated ids, never array indices
// — this is what makes crossover trivial at step F: no re-indexing, no dangling
// pointers to repair." That promise is collected here.
//
// ── TWO INDEPENDENT LAYERS, AND WHY THE SPLIT IS LOAD-BEARING ──────────────────
//
//   1. SCALAR crossover — a per-field coin flip over the 15 genes that are plain
//      numbers hanging off the genome root (material, the three controller
//      globals, social). Always applied. Cannot fail, cannot produce an illegal
//      genome, and carries most of the player-visible signal: A10 says pattern is
//      what makes a lineage recognisable, and hue/patternScale are the two most
//      legible genes in the game.
//
//   2. GRAFT — one subgraph of the other parent transplanted onto one of this
//      parent's connections. This is the interesting half and the risky half: it
//      moves body count, mass and interpenetration at once, so its viability
//      reject rate is materially worse than mutation's.
//
// The split is not tidiness. breed.js's ladder falls back from (1)+(2) to (1)
// alone before it falls back to the unmutated parent, and layer 1's morphology is
// this parent's untouched — so the middle rung's viability is within noise of the
// asexual path's. That is what keeps the fallback rate from regressing, and it is
// only available because the two layers are separable.
//
// ── DECLARED DEVIATION FROM 10 §A17.3 ──────────────────────────────────────────
//
// A9 also describes Sims' aligned-node crossover: line the two node lists up and
// swap corresponding entries. THAT IS NOT IMPLEMENTABLE IN THIS GENOME, and the
// reason is a deliberate earlier decision, not an oversight — genome.js:112
// abolished array indices, so there is no canonical node order to align against
// and no correspondence between "node 3 of A" and "node 3 of B". Only the graft
// half of A17.3's 30/30 exists here. Reported rather than quietly skipped.

import { makeId, CAPS } from './genome.js';
import { cloneGenome, cloneNode, cloneConn } from './mutate.js';
import { SLICE_LIMITS } from './factory.js';

/**
 * The genes that cross by coin flip, listed explicitly rather than derived from
 * Object.keys — for the reason mutate.js:238 gives about NODE_FIELDS: adding a
 * gene to the schema should be a deliberate decision about whether it recombines,
 * not an accident of iteration order.
 *
 * `controller.jointGenes` is DELIBERATELY ABSENT. It is keyed by node id
 * (genome.js:166) precisely because an oscillator belongs to a node; crossing
 * jointGenes across parents would rebind every joint's motion to a body that was
 * never its own, which is the exact failure the id-keying exists to prevent.
 * Joint genes travel with their node, in the graft, and nowhere else.
 */
export const CROSS_FIELDS = {
  material:   ['hue', 'hueVariance', 'patternScale', 'patternContrast', 'stripeAnisotropy', 'iridescence'],
  controller: ['omega', 'preyGain', 'threatGain', 'phaseBase', 'phaseSlope', 'proprioGain'],
  social:     ['trophic', 'boldness', 'cohesion', 'separation', 'alignment', 'separationRadius'],
};

/**
 * UNIFORM PICK, NEVER AN ARITHMETIC BLEND.
 *
 * Every value written here came verbatim out of a genome that already satisfies
 * validateGenome, so it is in range and already quantised: no qClamp, no new
 * invalid states, no interaction with QUANTUM. A mean would need re-quantising,
 * and would be actively wrong for the enum-valued genes anyway.
 *
 * It is also the difference between mixing and averaging. Averaging two parents
 * converges the population on the mean of whatever was selected — 20 §3's
 * "converges to a single animal" failure, arrived at faster. A coin flip per
 * field preserves the variance the player is selecting on.
 *
 * Mutates `g` in place; `g` is expected to be a private clone already.
 * @returns {number} how many of the 15 fields were taken from `b`
 */
export function crossScalars(g, b, rng) {
  let fromB = 0;
  for (const block of Object.keys(CROSS_FIELDS)) {
    for (const field of CROSS_FIELDS[block]) {
      if (rng.int(2) === 1) { g[block][field] = b[block][field]; fromB++; }
    }
  }
  return fromB;
}

// ── graph helpers ────────────────────────────────────────────────────────────

/** Fisher-Yates, same shape as mutate.js's private one. */
function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The node ids still reachable from the root if `skipConnId` were deleted.
 * Same walk as genome.js `reachability`, with one edge held out.
 */
function reachableWithout(g, skipConnId) {
  const adj = new Map();
  for (const c of g.connections) {
    if (c.id === skipConnId) continue;
    if (!adj.has(c.parentNodeId)) adj.set(c.parentNodeId, []);
    adj.get(c.parentNodeId).push(c.childNodeId);
  }
  const seen = new Set([g.rootNodeId]);
  const stack = [g.rootNodeId];
  while (stack.length) {
    for (const next of adj.get(stack.pop()) || []) {
      if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
  }
  return seen;
}

/**
 * The first `k` node ids in breadth-first order from `startId` over `b`'s edges.
 *
 * A BFS PREFIX IS REACHABILITY-CLOSED, which is the whole reason for breadth-first
 * rather than any other traversal: every node after the first was discovered via
 * an edge from a node already in the list, so truncating the list at any length
 * still leaves a subgraph in which every member is reachable from `startId` using
 * only edges INSIDE the subgraph. Truncation therefore cannot orphan anything, and
 * the budget check upstream can be a plain integer rather than a search.
 */
function bfsPrefix(b, startId, k) {
  const adj = new Map();
  for (const c of b.connections) {
    if (!adj.has(c.parentNodeId)) adj.set(c.parentNodeId, []);
    adj.get(c.parentNodeId).push(c.childNodeId);
  }
  const order = [startId];
  const seen = new Set(order);
  for (let i = 0; i < order.length && order.length < k; i++) {
    for (const next of adj.get(order[i]) || []) {
      if (seen.has(next)) continue;
      seen.add(next);
      order.push(next);
      if (order.length >= k) break;
    }
  }
  return order;
}

/**
 * Draw an id that collides with nothing in `used`, and reserve it.
 *
 * WHY A LOOP FOR A ONE-IN-SIXTY-MILLION EVENT. Crossover is the first thing in
 * the project that merges two id namespaces, and makeId gives 36^5 ≈ 60M, so a
 * chance collision is ~1e-6 per graft: invisible in every test that will ever be
 * written, and a mysterious rare gate RED in production a year from now. The loop
 * costs one Set lookup.
 */
function freshId(rng, prefix, used) {
  let id = makeId(rng, prefix);
  while (used.has(id)) id = makeId(rng, prefix);
  used.add(id);
  return id;
}

// ── the graft ────────────────────────────────────────────────────────────────

/**
 * Transplant a subgraph of `b` onto one of `a`'s connections.
 *
 * The operator 10 §A9 asks for ("take a subtree from one parent and attach it in
 * place of a subtree of the other"), made concrete for a graph whose edges may
 * point sideways and backwards, not a tree.
 *
 *   1. Choose the cut edge `cA` from A: the first edge, in random order, whose
 *      deletion frees at least one node of budget.
 *   2. Choose the graft root `y` uniformly from B's nodes.
 *   3. Take the BFS prefix from `y`, truncated to the budget.
 *   4. Give every transplanted node and edge a FRESH id.
 *   5. Repoint `cA` at the transplanted `y`.
 *   6. Drop every A node the cut left unreachable, with its edges and joint genes.
 *   7. Carry B's joint genes across for the transplanted nodes.
 *
 * ── THREE INVARIANTS, HELD BY CONSTRUCTION RATHER THAN BY A REPAIR PASS ────────
 * (mutate.js:16 — "no repair pass exists and no operator quietly changes two
 * things"; a graft that emitted a broken graph and then fixed it would be exactly
 * that.)
 *
 * NO ORPHANS. The surviving A nodes are, by definition, the ones reachable without
 * `cA`; the transplanted nodes are reachable from `y` through intra-graft edges
 * (step 3's closure property) and `y` is reachable through `cA`. An edge is kept
 * only when both its endpoints are kept, so nothing can point at a deleted node —
 * `removeDanglingConnections` must report 0, and the gate asserts it.
 *
 * OUT-DEGREE NEVER RISES. Step 5 REPOINTS `cA`, it does not add an edge, so the
 * cut's parent keeps the degree it had. Every other surviving A node can only lose
 * edges (to deleted nodes). Transplanted nodes carry B's out-degree restricted to
 * intra-graft edges, which is ≤ B's own, which was already legal. Note the cap
 * that matters is `limits.maxConnPerNode` (3 in the slice), not `CAPS` (4).
 *
 * NODE COUNT ≤ limits.maxNodes, by step 1's budget arithmetic.
 *
 * ── AND EVERY OTHER SLICE CONSTRAINT IS INHERITED FOR FREE ─────────────────────
 *
 * Connections are copied VERBATIM — face, position, orientation, scale, reflect
 * flags, terminalOnly — and nodes likewise. So `allowedFaces` (no back face),
 * `reflectMinOffset` (the L1-36 degenerate zone), `maxReflectionAxes`,
 * RANGE.orientation's narrow band, the density band, the joint-type set and
 * `recursiveLimit ≤ maxRecursion` all hold in the child because they held in both
 * parents and a verbatim copy cannot leave the set. This is the entire argument
 * for copying rather than re-drawing any field, and it is why this operator needs
 * no range logic of its own.
 *
 * ── CYCLES ARE NOT A HAZARD ────────────────────────────────────────────────────
 *
 * A back-edge or self-edge is RECURSION, not an error (genome.js:439), and
 * morphogen.js:107 resets depth on node change so a cycle never increments
 * `recursiveLimit`. The body cap at morphogen.js:116 is the only termination
 * guard and it holds for any topology. The factory already emits such cycles via
 * `extraEdges`, so this operator introduces no new class of graph.
 *
 * @returns {{genome:object, grafted:number}|null} null when no cut frees any budget
 */
export function graftSubgraph(a, b, rng, limits = SLICE_LIMITS) {
  const maxNodes = limits.maxNodes ?? CAPS.maxBodies;
  const g = cloneGenome(a);
  if (!g.connections.length || !b.nodes.length) return null;

  // Step 1. Random order, first fit — not "best fit". The widest cut would
  // systematically prefer grafting onto whichever limb happens to carry the most
  // nodes, which is a bias the player would eventually see as "it always replaces
  // the tail". mutate.js:201 makes the same argument for shuffling first.
  let cut = null;
  let kept = null;
  let budget = 0;
  for (const c of shuffled(rng, g.connections)) {
    const seen = reachableWithout(g, c.id);
    // The cut's own parent is always still reachable: any root-path that reached
    // it via `c` must have arrived at it once already before traversing `c`, and
    // that prefix does not use `c`. Checked anyway — the invariant is worth one
    // Set lookup at the point that depends on it, rather than only in a comment.
    if (!seen.has(c.parentNodeId)) continue;
    let keptCount = 0;
    for (const n of g.nodes) if (seen.has(n.id)) keptCount++;
    const k = maxNodes - keptCount;
    if (k >= 1) { cut = c; kept = seen; budget = k; break; }
  }
  if (!cut) return null;   // every edge is a back-edge, or A is already at the cap

  // Steps 2-3.
  const y = b.nodes[rng.int(b.nodes.length)];
  const take = bfsPrefix(b, y.id, budget);
  const takeSet = new Set(take);

  // Step 4. FRESH IDS UNCONDITIONALLY, never "fresh only if it collides".
  //
  // The duplicate-id case is the harmless one — validateGenome catches it loudly
  // (genome.js:351). The dangerous one is the opposite: two parents that share
  // ancestry share node ids, so merging BY id would silently resolve a node
  // present in both to the single copy carrying A's fields, and every one of B's
  // edges would quietly reattach to A's version. That is a wrong-genome bug with
  // no error message. Conditional freshening would also be a data-dependent branch
  // that never fires in a corpus of unrelated factory genomes and fires constantly
  // by generation five in the player's tank.
  const usedNodeIds = new Set(g.nodes.map(n => n.id));
  const usedConnIds = new Set(g.connections.map(c => c.id));
  const remap = new Map();
  for (const id of take) remap.set(id, freshId(rng, 'n', usedNodeIds));

  // Step 6 (nodes) then step 3's transplant.
  const nodes = g.nodes.filter(n => kept.has(n.id));
  for (const id of take) {
    const src = b.nodes.find(n => n.id === id);
    nodes.push({ ...cloneNode(src), id: remap.get(id) });
  }

  // Step 6 (edges) and step 5.
  const connections = g.connections.filter(
    c => c.id !== cut.id && kept.has(c.parentNodeId) && kept.has(c.childNodeId));
  // The cut keeps A's OWN connection genes — face, offset, orientation, scale,
  // reflection. B's limb arrives through A's joint geometry, which is what makes
  // the result a chimera rather than a swap: it is attached where A attached
  // something, at A's angle.
  connections.push({ ...cloneConn(cut), childNodeId: remap.get(y.id) });
  for (const c of b.connections) {
    if (!takeSet.has(c.parentNodeId) || !takeSet.has(c.childNodeId)) continue;
    connections.push({
      ...cloneConn(c),
      id: freshId(rng, 'c', usedConnIds),
      parentNodeId: remap.get(c.parentNodeId),
      childNodeId: remap.get(c.childNodeId),
    });
  }

  // Step 7. Joint genes follow their node — A's for the survivors, B's for the
  // transplant. Nothing is invented and nothing is averaged.
  const jointGenes = {};
  for (const n of g.nodes) {
    if (kept.has(n.id)) jointGenes[n.id] = { ...g.controller.jointGenes[n.id] };
  }
  for (const id of take) {
    const src = b.controller.jointGenes[id];
    // Unreachable for a genome that passed validateGenome (genome.js:418 requires
    // an entry per node). Refuse rather than emit a child with a jointless body:
    // a refusal is one null the ladder handles, a broken child is a crash in
    // morphogenesis with no provenance.
    if (!src) return null;
    jointGenes[remap.get(id)] = { ...src };
  }

  g.nodes = nodes;
  g.connections = connections;
  g.controller.jointGenes = jointGenes;
  // rootNodeId, seed and version stay A's. Keeping A's root keeps A's overall body
  // plan recognisable and rules out the degenerate outcome where the "child" is
  // simply B under another name.
  return { genome: g, grafted: take.length };
}

// ── the operator breed.js calls ──────────────────────────────────────────────

/**
 * One recombinant child of `a` and `b`. `a` is the primary parent: it supplies the
 * root, the body plan the graft is applied TO, and the genome the caller falls
 * back to when viability search is exhausted.
 *
 * `ops` uses mutate.js's convention — a flat array of short readable strings —
 * so provenance.ops stays one list whether the child was mutated, recombined or
 * both. `cross:7` is "seven of the fifteen scalar genes came from B"; `graft:3`
 * is "three nodes were transplanted".
 *
 * @param {object} a  primary parent
 * @param {object} b  secondary parent
 * @param {object} rng  injected; `int`
 * @param {object} [opts] `{ limits, graft }` — `graft:false` runs the scalar layer
 *        alone, which is the ladder's middle rung.
 * @returns {{genome:object, ops:string[], grafted:number}}
 */
export function crossGenomes(a, b, rng, opts = {}) {
  const limits = opts.limits ?? SLICE_LIMITS;
  const g = cloneGenome(a);
  const ops = [`cross:${crossScalars(g, b, rng)}`];

  // ANDed with the slice flag, so `allowGrafting: false` stays a real, testable
  // configuration and the A2 pin in gate/l1.js keeps controlling something.
  if (opts.graft === false || !limits.allowGrafting) return { genome: g, ops, grafted: 0 };

  const r = graftSubgraph(g, b, rng, limits);
  if (!r) return { genome: g, ops, grafted: 0 };
  ops.push(`graft:${r.grafted}`);
  return { genome: r.genome, ops, grafted: r.grafted };
}
