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
  /**
   * GRAFTING IS ON. Was `false` from A2 through B4, on 30 R3's reading that
   * "10 §3 sets allowGrafting: false; scheduling it here was a contradiction".
   *
   * WHAT CHANGED IS NOT THE READING, IT IS THE MEASUREMENT. R3's implicit cost
   * model was that recombination would push the viability filter past what its
   * 12 attempts could absorb — a live concern, since mutation viability is 57%
   * against a 60% target and the B2 §2.2 obligation says exactly this quantity
   * gets squeezed again from the other side. Measured instead (tools/_xgraft.mjs,
   * 6 lineages x 8 generations x 5 rates, random 3-7 node parents):
   *
   *     graftRate   grafted   viability   attempts/birth   fellBack   nodes/creature
   *       0.00         0%        76%          1.15            0%           4.91
   *       0.50        45%        75%          1.24            0%           5.26
   *       1.00       100%        71%          1.27            0%           5.85
   *
   * Recombinant viability is ~75%, ABOVE the asexual path's 57%, and the fallback
   * to an unmutated parent never fired once in 720 births. The reason is
   * structural rather than lucky: a graft copies nodes and edges VERBATIM out of
   * a genome that already passed the filter, and MUTATIONS_PER_RECOMBINANT is
   * [0, 2] against [1, 3], so a recombinant carries less novelty per birth than a
   * mutant does — it just carries it from somewhere real.
   *
   * The pin in gate/l1.js:110 moves with this line, and stays a pin.
   */
  allowGrafting: true,

  /**
   * Fraction of offspring that mix two parents, when two or more are selected.
   *
   * ONE, NOT 10 §A17.3's 0.6 — DECLARED DEVIATION. With two selected there are
   * three offspring slots; with three selected there are two. At a probabilistic
   * rate, "did the mixing work?" is a question about a sample of two, and the
   * answer is indistinguishable from a bug. That is the same argument, at the
   * same sizes, that breed.js already makes against sampling parents with
   * replacement. A fractional value is implemented and works; it is simply not
   * what a six-slot tank should ship.
   */
  crossoverRate: 1,

  /**
   * Of those, the fraction that also transplant a subgraph rather than crossing
   * the scalar genes alone. ANDed with allowGrafting.
   *
   * 0.5 from the sweep above: viability is flat from 0 to 0.75 and only dips at
   * 1.0, and body inflation is mild here (+7% mean nodes against +19% at 1.0).
   * Half the children are chimeric and half are this parent wearing the other's
   * colours — which is also the mix that makes the two readable against each
   * other on screen.
   */
  graftRate: 0.5,

  allowRadialSymmetry: false,
  /**
   * SPHERICAL DROPPED AT B2 §3.1 / §12. Was `['revolute', 'twist', 'spherical']`.
   *
   * The design offered three options and recommended this one on the strength of
   * a single measurement: `corr(spherical fraction, net speed) = 0.60` on the
   * solver path against 0.15 on the PD path, because Rapier exposes motors on
   * revolute-family joints only and spherical joints therefore keep the PD relay.
   * Any selection run on the solver path would optimise "which joints escaped
   * the fix" rather than which creature swims.
   *
   * CHECKED AGAINST THE PINNED BINDING, and the case is stronger than that.
   * `SphericalImpulseJoint` in @dimforge/rapier3d-compat 0.19.3 carries NO motor
   * surface at all — not a missing `setMotorMaxForce`, but no
   * `configureMotorPosition`, no `configureMotorModel`, nothing. So option 3,
   * "upgrade the binding", is not a version bump; there is no motorised
   * spherical joint to bind to.
   *
   * AND IT HAS NO `setLimits` EITHER. physics.js:535 skips spherical when
   * applying angle limits, which the slice set made unavoidable, so every
   * spherical joint has carried three `angleLimits` genes that do nothing. A gene
   * that cannot be expressed is worse than an absent one: mutation spends draws
   * on it and selection cannot see the result.
   *
   * AND IT IS THE KNOWN DIVERGENCE. physics.js:944 records a two-body spherical
   * joint winding from 4 rad/s to 1e21 and taking the whole simulation
   * non-finite, stable at MOTOR_SCALE 0.5 and divergent at 2.0 — the signature
   * of a pump. MOTOR_SCALE 2.0 is B3's own tuning candidate.
   *
   * WHAT IT COSTS: mean DOF per joint 5.0 -> 3.0, and the 3-DOF joint is gone
   * from the slice. Measured reliability holds at r = 0.77. That is a real loss
   * and it is smaller than selecting on an artefact for a whole chantier.
   *
   * RESTORED AT STEP F, when either a binding with a motorised spherical joint
   * exists or the bounded-PD calibration has been done. One array entry, and
   * `JOINT_TYPES` in genome.js is untouched — the SCHEMA still has all seven, so
   * this is a config change and never a migration (L1-9 asserts exactly that).
   */
  jointTypes: ['revolute', 'twist'],   // full: all 7. spherical dropped at B2 §3.1.

  /**
   * AMBIGUITY RESOLVED AT B2 §2.2 — reading (a). Was 1 from B1 to session 10.
   *
   * A2 writes `allowRadialSymmetry: false, // bilateral and none only`, but A5
   * correction 3 drops the global symmetry gene entirely and replaces it with
   * three independent per-connection reflection booleans that MULTIPLY: all three
   * set spawns eight limbs from one connection.
   *
   * So "radial symmetry" either (a) names the dropped global gene, making the
   * constraint vacuous, or (b) means at most one reflection axis, since two axes
   * give a four-fold cross and three give eight-fold — neither of which is
   * bilateral. Reading (b) was implemented because it was the one that
   * constrained anything, and the decision was parked for B4 "when bodies are
   * visible", then deferred again to B5.
   *
   * DECIDED: reading (a), the FULL_LIMITS value. Bodies are visible now and the
   * question turned out not to be about locomotion at all. B3 deferred this on
   * the grounds that "every locomotion figure gets worse at 2 and 3", which is
   * true and is not the point — B2 §0.2 measured the whole authored library
   * collapsing into a band narrower than noise on the PD path, so the locomotion
   * figures this was weighed against were not measuring design. What it IS worth
   * is the single largest lever on variety in the project: effective body-plan
   * variety 16 -> 118 with nodeCount below, and -> 155+ with the clamp.
   *
   * Radial symmetry is now REACHABLE, which is what "bounded asymmetry" in
   * 00 §7 B should have meant: bounded by the geometry budget (§2.4), not by a
   * constant. The first radial creature in the project — `jelly`, a bell with a
   * four-fold tentacle crown — is not expressible at 1.
   */
  maxReflectionAxes: 3,

  /**
   * 10 §A17.1: nodeCount = randInt(2,5). WIDENED at B2 §2.2 to [3, 7] — the
   * conservative half of FULL_LIMITS' [2, 12]. maxNodes 8 still leaves headroom
   * for mutation.
   *
   * The floor moving 2 -> 3 is the half that matters. At 2 the factory produces
   * a two-box hinge 28% of the time, which is the single most common creature in
   * the game and is not a creature.
   */
  nodeCount: [3, 7],

  /**
   * WIDENED to [1, 5] at B2 §2.2, but NOT for the reason §2.2 gives.
   *
   * §2.2 offers it as "worth 2.2x on its own; take it if 2.2 leaves headroom",
   * i.e. as a variety lever. As a variety lever it is not needed — the §2.4 gate
   * of 155 is met without it. It is taken because of what the FLOOR does to the
   * mutation operators, which is a §2.1 question and is not mentioned anywhere.
   *
   * MEASURED. At a floor of 0 a large share of genomes are pure spanning trees,
   * and in a spanning tree EVERY edge is load-bearing: `removeConnection`
   * refuses, because no single removal leaves the graph connected. So the
   * connection branch degenerates into add-only. Measured over 3000 mutations,
   * `removeConnection` applied 212 times against `addConnection`'s 361, and the
   * pair carried +0.043 bodies/mutation of upward drift on its own — four times
   * the whole §2.1 gate, from an operator that was simply unable to run.
   *
   * At a floor of 1 there is always one redundant edge to give back, the pair
   * closes to -0.068, and the drift becomes something the node operators can
   * balance. Guaranteeing the inverse operator is APPLICABLE is worth more than
   * tuning the operator that is.
   */
  extraEdges: [1, 5],

  /**
   * REMOVAL TOURNAMENT SIZE — B2 §2.1 Fix B, and a deliberate weakening of it.
   *
   * §2.1 says "among removals that keep the graph connected, prefer the one
   * costing fewest bodies. One sort." Implemented literally — a full argmin over
   * every legal candidate — it OVERSHOOTS at the widened limits and inverts the
   * ratchet: drift +0.110 against a target of zero, and lineages climb towards
   * the body cap. That is the failure mode §2.1 warns about for retry loops,
   * arriving through the other operator.
   *
   * The mechanism is the geometry budget (§2.4). At a 74% discard rate a full
   * argmin does not find the CHEAPEST removal, it finds a FREE one: a node whose
   * limbs were being rejected anyway, or whose removal unblocks limbs that then
   * survive. Measured, the full argmin grew the body 18% of the time it was
   * asked to shrink it, and its mean cost collapsed from 1.25 bodies to 0.05. An
   * operator that costs nothing is not an inverse of addNode, it is a no-op with
   * a name, and the argmin gets stronger as the candidate pool widens — so the
   * literal Fix B would need re-tuning at every future change to the limits.
   *
   * A tournament of FIXED size does not scale with the pool, which is the whole
   * point. 2 is the smallest value that is not "no preference at all", and it is
   * where the drift crosses zero: measured over 30 000 mutations, k=1 gives
   * -0.139, k=2 gives +0.012, k=infinity gives +0.062.
   *
   * READ THE ERROR BAR BEFORE RE-TUNING THIS. Per-mutation delta has sd ~1.6
   * bodies, so 2 s.e. at n = 30 000 is +-0.026 — larger than the gate itself.
   * The k=2 figure is not distinguishable from zero and neither is k=1's at
   * n = 3000, which is how the first pass of this work read k=1 as passing.
   */
  removalTournament: 2,

  /**
   * BACK-FACE EXCLUSION — B2 §2.4. A connection may not select parentFace 2.
   *
   * `morphogen.js FACE_NORMAL[2]` is -Z, and every child attaches by its OWN -Z
   * face (placeChild, "fixed convention, never revisited"). So a child on face 2
   * is aimed straight back down the axis its parent arrived along, into the
   * grandparent — and grandparent collision is the largest single rejection
   * class in the corpus at 34%. Excluding one of six faces is worth +3 effective
   * variety on its own and rather more in combination with the clamp below.
   *
   * This is NOT a slice restriction to be lifted at step F: the geometry is the
   * same at any limits, which is why FULL_LIMITS carries it too.
   */
  allowedFaces: [0, 1, 3, 4, 5],

  /**
   * REFLECTION CLAMP — B2 §2.2. A connection with `reflectX` must be offset from
   * the face centre by at least this much in `position[0]`; same for `reflectY`
   * and `position[1]`.
   *
   * `morphogen.js placeChild` builds the anchor as
   *     faceNormal*pHalf + faceRight*pHalf*position[0] + faceUp*pHalf*position[1]
   * and reflectX mirrors by NEGATING faceRight. The negation reaches the anchor
   * only through the term it multiplies, so a limb at position[0] === 0 IS ITS
   * OWN MIRROR: both variants land on the same point, one is destroyed by the
   * overlap test, and the connection spent its reflection flag on nothing.
   * Measured before the clamp: 41% of reflected connections sat inside the zone.
   *
   * THE MORPHOGEN IS CORRECT — that is what a reflection about a plane through
   * the face centre means — so the fix belongs here and in mutate.js, and
   * morphogen.js is not touched. `reflectZ` negates faceNormal, which no position
   * component scales, so it has no degenerate zone and no clamp.
   */
  reflectMinOffset: 0.6,

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

/** All six, for callers that pass limits without the field. See `allowedFaces`. */
export const ALL_FACES = [0, 1, 2, 3, 4, 5];

/**
 * Push a face coordinate out of the degenerate zone, IN PLACE, for whichever
 * axes carry a reflection. See SLICE_LIMITS.reflectMinOffset for why.
 *
 * Shared with mutate.js rather than duplicated, because the two generators
 * drifting apart on this rule is exactly how a constraint decays over
 * generations: the factory would respect it and mutation would walk out of it.
 *
 * The remap is a MONOTONE SIGN-PRESERVING RESCALE of the degenerate interval
 * (-m, m) onto [+-m, +-1], not a redraw and not a hard clamp. Three reasons.
 *
 *   - It consumes no rng draw, so the stream is not shifted a second time on top
 *     of the shift nodeCount already causes.
 *   - It is IDEMPOTENT: a value already outside the zone is returned untouched.
 *     This is load-bearing, not tidiness. `mutateRandomConnection` re-applies the
 *     clamp after every field it touches, so a rescale that moved legal values
 *     too would ratchet `position` towards +-1 a little on every generation, and
 *     the drift would be invisible until lineages were all limbs-at-the-corners.
 *   - It is order-preserving, so `jitter` still moves the value in the direction
 *     it moved before and a mutation cannot be inverted by the clamp. A hard
 *     clamp to exactly +-m would instead pile every squeezed draw on one point.
 *
 * A value of exactly 0 has no sign and is sent positive.
 */
export function clampReflection(c, limits = SLICE_LIMITS) {
  const m = limits.reflectMinOffset ?? 0;
  if (m <= 0) return c;
  const push = (p) => {
    const a = Math.abs(p);
    if (a >= m) return p;                       // already legal — untouched
    return qClamp((p < 0 ? -1 : 1) * (m + (1 - m) * (a / m)), RANGE.position);
  };
  if (c.reflectX) c.position[0] = push(c.position[0]);
  if (c.reflectY) c.position[1] = push(c.position[1]);
  return c;
}
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

  const faces = limits.allowedFaces ?? ALL_FACES;
  return clampReflection(makeConnection(makeId(rng, 'c'), {
    parentNodeId, childNodeId,
    // Back-face exclusion, §2.4. Drawn from the allowed set rather than drawn
    // freely and rejected, so the distribution over the remaining faces stays
    // uniform and the draw count does not depend on the outcome.
    parentFace: pick(rng, faces),
    position: [uniform(rng, RANGE.position), uniform(rng, RANGE.position)],
    // NARROW, +/- pi/4. 10 §A5 correction 4: this single constant does more for
    // plausibility than any viability filter.
    orientation: [uniform(rng, RANGE.orientation), uniform(rng, RANGE.orientation), uniform(rng, RANGE.orientation)],
    scale: [uniform(rng, RANGE.scale), uniform(rng, RANGE.scale), uniform(rng, RANGE.scale)],
    ...flags,
    terminalOnly: rng.int(2) === 0,
  }), limits);
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
      // ── THE SENSOR GAINS, LIVE ─────────────────────────────────────────────
      //
      // These read `preyGain: 0, threatGain: 0` from B1 to C1, under the comment
      // "present and DORMANT until C1 wires the sensors". C1 wired them —
      // `controller.js sensorTurnBias` reads both and `duel.js senseOpponent`
      // calls it — and the constant was never removed. Combined with `mutate.js`
      // copying both fields straight through with no operator, the value was not
      // merely initialised to zero, it was UNREACHABLE: no mutation could move
      // it and no breeding could recombine it, because nothing ever differed.
      //
      // Measured consequence: over any random corpus, `sensorTurnBias` returned
      // clamp(0*bearing + 0*bearing) for every creature, so the sensor's
      // contribution to a seek trial was identically 0.000 — not close to zero,
      // exactly zero. No creature with a sensor had ever been born, so no
      // selection could ever have found one. Every steering result in sessions
      // 5-10 was measured on a population with the channel switched off.
      //
      // 11 §10 and the comment on RANGE.preyGain both say the SIGN IS EVOLVED,
      // not declared, so the draw is over the full [-1, 1]: a creature that
      // flees prey and chases threats is legal, and will simply lose.
      //
      // NOTE ON THE RNG STREAM. Two draws inserted here shift every subsequent
      // draw, so `social` genes now differ for a given seed. Morphology, joints
      // and the rest of the controller are drawn earlier and are untouched — the
      // physical creature a seed produces is bit-identical. Social genes are L3
      // and nothing measures them yet.
      preyGain: uniform(rng, RANGE.preyGain),
      threatGain: uniform(rng, RANGE.threatGain),
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

/**
 * All seven joint types, full recursion, four connections per node. Step F.
 *
 * `allowedFaces` and `reflectMinOffset` are INHERITED from SLICE_LIMITS and are
 * deliberately not loosened. Both are geometry, not slice policy: face 2 aims a
 * child at its grandparent and a reflection at the face centre is its own mirror
 * at any limits. Widening the slice does not make either of those a good idea.
 */
export const FULL_LIMITS = {
  ...SLICE_LIMITS,
  maxNodes: 24, maxRecursion: 6, maxConnPerNode: 4,
  allowGrafting: true, allowRadialSymmetry: true,
  jointTypes: JOINT_TYPES, maxReflectionAxes: 3,
  nodeCount: [2, 12], extraEdges: [0, 6],
};
