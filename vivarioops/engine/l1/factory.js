// engine/l1/factory.js — random genome creation (10 §A17.1, constrained by A2).
//
// PURITY: the rng is injected. This module constructs no generator and reads no
// clock. Callers build the rng from trunk/rng.js and pass it in.
//
// The SCHEMA is unrestricted; only this factory is. Every constraint below is a
// single constant in SLICE_LIMITS, so step F loosens by editing numbers.

import {
  RANGE, JOINT_TYPES, FREQ_MULTS, makeId, makeNode, makeConnection, qClamp,
} from './genome.js';
import { GENOME_V } from '../../contracts/versions.js';

/** 10 §3 Amendment A2. */
export const SLICE_LIMITS = {
  maxNodes: 8,              // full: 24 bodies instantiated
  maxRecursion: 2,          // full: 6
  maxConnPerNode: 3,        // full: 4
  allowGrafting: false,     // full: true (30% of reproductions)
  allowRadialSymmetry: false,
  jointTypes: ['revolute', 'twist', 'spherical'],   // full: all 7

  /**
   * AMBIGUITY, REPORTED — not resolved silently.
   *
   * A2 writes `allowRadialSymmetry: false, // bilateral and none only`, but A5
   * correction 3 drops the global symmetry gene entirely and replaces it with
   * three independent per-connection reflection booleans that MULTIPLY: all three
   * set spawns eight limbs from one connection.
   *
   * So "radial symmetry" either (a) names the dropped global gene, making the
   * constraint vacuous, or (b) means at most one reflection axis, since two axes
   * give a four-fold cross and three give eight-fold — neither of which is
   * bilateral.
   *
   * Reading (b) is implemented because it is the one that constrains anything and
   * it matches "bounded asymmetry" in 00 §7 B. It is ONE NUMBER: set to 3 for
   * reading (a). Decide at B4 when bodies are visible.
   */
  maxReflectionAxes: 1,

  /** 10 §A17.1: nodeCount = randInt(2,5). maxNodes 8 leaves headroom for mutation. */
  nodeCount: [2, 5],
  extraEdges: [0, 3],

  /**
   * DENSITY IS NOT A VARIABLE IN THE SLICE. `RANGE.density` stays [0.15, 1.8] —
   * the schema is unrestricted (10 §3) — but the factory and the mutation
   * operators draw from this band, so W1 creatures are neutrally buoyant BY
   * CONSTRUCTION rather than by chance.
   *
   * WHY, MEASURED, and it is not a taste call. 10 §2 (amendment A1) claims a
   * random creature in water is "approximately neutrally buoyant by chance"
   * because the gene-range midpoint is ~0.98. That is false as generated: the
   * bulk density of an INSTANTIATED creature is volume-weighted, not the
   * midpoint of the range. Over 60 factory creatures the mass-weighted bulk
   * density is p10 0.557 / p50 1.033 / p90 1.442, only 13% land within 5% of
   * neutral, and the median carries 2.44 m/s^2 of net buoyant acceleration.
   * Buoyant drift exceeds locomotion by a median factor of 108.
   *
   * Pinning against a tank boundary, 40 creatures over 40 s (tools/_dband.mjs):
   *
   *     band              pinned    |dy| p90    |dy| worst
   *     [0.15, 1.8]        27/38      37.8 m      110.8 m
   *     [0.97, 1.03]        5/39      11.5 m       24.0 m
   *     [0.99, 1.01]        1/39       9.8 m       13.5 m
   *     [0.995, 1.005]      2/40       8.4 m       22.5 m
   *     [1, 1]              0/39       1.6 m        3.5 m
   *
   * No non-degenerate band is clean, and the pinned fraction does not fall off
   * monotonically — half-tank height is 12 m, so a residual 0.005 of density is
   * still metres of drift inside a 15 s duel. Only exact neutrality works.
   *
   * THE REFERENCE AGREES, and it got there first. `mycoolfin/the-simsulator`
   * has NO density gene at all — limb mass is the product of its dimensions,
   * i.e. density is implicitly 1.0 — and its aquatic trial runs at zero gravity
   * with no floor. Gravity and the fluid model are never both active. A1's
   * widening was justified by the thick-gas world, which the slice does not
   * contain; it is a step-F requirement that broke the slice.
   *
   * STEP F: restore [0.15, 1.8] together with the thick-gas world that needs it,
   * and re-derive this band per world rather than per slice. Buoyancy is a
   * world question, not a genome question. Widening is ONE NUMBER here.
   */
  density: [1, 1],
};

const pick = (rng, arr) => arr[rng.int(arr.length)];
// qClamp, not q: q rounds to the NEAREST micron and can land a draw just
// outside the range it came from. See genome.js. Never observed here — it needs
// a draw within 5e-7 of a bound — but it is the same defect that made every
// saturating mutation invalid, and it is fixed in one place for both.
const uniform = (rng, range) => qClamp(rng.range(range[0], range[1]), range);
const uniformInt = (rng, [lo, hi]) => lo + rng.int(hi - lo + 1);

function randomNode(rng, limits) {
  return makeNode(makeId(rng, 'n'), {
    dims: [uniform(rng, RANGE.dim), uniform(rng, RANGE.dim), uniform(rng, RANGE.dim)],
    // SLICE-SCOPED, not RANGE-scoped. A1's "approximately neutrally buoyant by
    // chance" was measured false; the band makes it true by construction. See
    // SLICE_LIMITS.density for the measurement and for the step-F restoration.
    density: uniform(rng, limits.density ?? RANGE.density),
    recursiveLimit: uniformInt(rng, [RANGE.recursiveLimit[0], Math.min(limits.maxRecursion, RANGE.recursiveLimit[1])]),
    joint: {
      type: pick(rng, limits.jointTypes),
      angleLimits: [uniform(rng, RANGE.angleLimit), uniform(rng, RANGE.angleLimit), uniform(rng, RANGE.angleLimit)],
      phaseLag: uniform(rng, RANGE.phaseLag),
    },
    colorGenes: {
      hueShift: uniform(rng, RANGE.hueShift),
      valueShift: uniform(rng, RANGE.valueShift),
      patternPhase: uniform(rng, RANGE.patternPhase),
    },
  });
}

function randomConnection(rng, limits, parentNodeId, childNodeId) {
  // Reflection axes are chosen as a SET of size <= maxReflectionAxes rather than
  // three independent coin flips, so the cap is structural and cannot be reached
  // by accident.
  const axes = ['reflectX', 'reflectY', 'reflectZ'];
  const flags = { reflectX: false, reflectY: false, reflectZ: false };
  const n = rng.int(Math.min(limits.maxReflectionAxes, 3) + 1);   // 0..cap
  const pool = axes.slice();
  for (let i = 0; i < n; i++) flags[pool.splice(rng.int(pool.length), 1)[0]] = true;

  return makeConnection(makeId(rng, 'c'), {
    parentNodeId, childNodeId,
    parentFace: rng.int(6),
    position: [uniform(rng, RANGE.position), uniform(rng, RANGE.position)],
    // NARROW, +/- pi/4. 10 §A5 correction 4: this single constant does more for
    // plausibility than any viability filter.
    orientation: [uniform(rng, RANGE.orientation), uniform(rng, RANGE.orientation), uniform(rng, RANGE.orientation)],
    scale: [uniform(rng, RANGE.scale), uniform(rng, RANGE.scale), uniform(rng, RANGE.scale)],
    ...flags,
    terminalOnly: rng.int(2) === 0,
  });
}

/**
 * @param {{int:(n:number)=>number, range:(a:number,b:number)=>number}} rng  injected
 * @param {object} [limits]  defaults to SLICE_LIMITS; step F passes a looser set
 * @returns a valid, connected Genome v2
 */
export function createRandomGenome(rng, limits = SLICE_LIMITS) {
  const nodeCount = Math.min(uniformInt(rng, limits.nodeCount), limits.maxNodes);
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) nodes.push(randomNode(rng, limits));

  const connections = [];
  const outDegree = new Map(nodes.map(n => [n.id, 0]));
  const addEdge = (parent, child, terminalOnly) => {
    const c = randomConnection(rng, limits, parent, child);
    c.terminalOnly = terminalOnly;
    connections.push(c);
    outDegree.set(parent, outDegree.get(parent) + 1);
  };

  // CONNECTIVITY FIRST. Every node after the root receives exactly one inbound
  // edge from an earlier node, so the graph is a spanning tree before anything
  // else is added. 10 §A17.1 is emphatic about this: purely random edge sets are
  // disconnected most of the time, which is the fastest way to conclude wrongly
  // that the generator is broken.
  //
  // SPANNING EDGES ARE NEVER terminalOnly. A17.1 sets the flag at 50% on every
  // connection, but morphogenesis only applies a terminalOnly connection once
  // `depth === node.recursiveLimit`, and a node that is never self-referenced
  // sits at depth 0 forever while its limit is at least 1. So a terminalOnly
  // spanning edge NEVER FIRES, and the genome is connected while the body is a
  // single blob with no joints. Measured before this fix: 500 genomes gave a
  // minimum of 1 body and a mean of 5.77. Connectivity of the genome graph is
  // not connectivity of the phenotype, and the spanning tree exists to guarantee
  // the latter.
  for (let i = 1; i < nodeCount; i++) {
    const candidates = nodes.slice(0, i).filter(n => outDegree.get(n.id) < limits.maxConnPerNode);
    // Every earlier node saturated is possible at small caps; fall back to the
    // root rather than emitting a disconnected node.
    const parent = candidates.length ? pick(rng, candidates) : nodes[0];
    addEdge(parent.id, nodes[i].id, false);
  }

  // THEN extra edges, which is where recursion and branching come from. A child
  // equal to its parent is self-recursion; a child pointing at an ancestor is
  // loop recursion. Both are intended (10 §A5). These MAY be terminalOnly —
  // that is where tails, hands and claws come from.
  const extras = uniformInt(rng, limits.extraEdges);
  for (let k = 0; k < extras; k++) {
    const candidates = nodes.filter(n => outDegree.get(n.id) < limits.maxConnPerNode);
    if (!candidates.length) break;
    addEdge(pick(rng, candidates).id, pick(rng, nodes).id, rng.int(2) === 0);
  }

  const jointGenes = {};
  for (const n of nodes) {
    jointGenes[n.id] = {
      amplitude: uniform(rng, RANGE.amplitude),
      bias: uniform(rng, RANGE.bias),
      freqMult: pick(rng, FREQ_MULTS),
    };
  }

  return {
    version: GENOME_V,
    seed: rng.seed >>> 0,
    rootNodeId: nodes[0].id,
    nodes,
    connections,
    material: {
      hue: uniform(rng, RANGE.hue),
      hueVariance: uniform(rng, RANGE.hueVariance),
      patternScale: uniform(rng, RANGE.patternScale),
      patternContrast: uniform(rng, RANGE.patternContrast),
      stripeAnisotropy: uniform(rng, RANGE.stripeAnisotropy),
      iridescence: uniform(rng, RANGE.iridescence),
    },
    controller: {
      omega: uniform(rng, RANGE.omega),
      // A3: present and DORMANT until C1 wires the sensors. Present from B1 so
      // that C1 is a behaviour change, not a schema migration.
      preyGain: 0,
      threatGain: 0,
      jointGenes,
    },
    social: {
      trophic: uniform(rng, RANGE.trophic),
      boldness: uniform(rng, RANGE.boldness),
      cohesion: uniform(rng, RANGE.cohesion),
      separation: uniform(rng, RANGE.separation),
      alignment: uniform(rng, RANGE.alignment),
      separationRadius: uniform(rng, RANGE.separationRadius),
    },
  };
}

/** All seven joint types, full recursion, four connections per node. Step F. */
export const FULL_LIMITS = {
  ...SLICE_LIMITS,
  maxNodes: 24, maxRecursion: 6, maxConnPerNode: 4,
  allowGrafting: true, allowRadialSymmetry: true,
  jointTypes: JOINT_TYPES, maxReflectionAxes: 3,
  nodeCount: [2, 12], extraEdges: [0, 6],
};
