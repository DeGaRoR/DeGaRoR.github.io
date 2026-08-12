// engine/l1/factory.js — random genome creation (10 §A17.1, constrained by A2).
//
// PURITY: the rng is injected. This module constructs no generator and reads no
// clock. Callers build the rng from trunk/rng.js and pass it in.
//
// The SCHEMA is unrestricted; only this factory is. Every constraint below is a
// single constant in SLICE_LIMITS, so step F loosens by editing numbers.

import {
  RANGE, JOINT_TYPES, FREQ_MULTS, makeId, makeNode, makeConnection, defaultMouth,
  qClamp, limitRangeFor,
} from './genome.js';
import { GENOME_V } from '../../contracts/versions.js';

/** 10 §3 Amendment A2. */
export const SLICE_LIMITS = {
  maxNodes: 8,              // full: 24 bodies instantiated

  /**
   * LIFTED 2 -> 6 AT A2, to the grammar's own full range. `RANGE.recursiveLimit`
   * is [1, 6] and this clamped the draw to [1, 2], so no chain longer than about
   * two segments could ever be generated: over 400 draws, `longestRun >= 4`
   * occurred ZERO times, against 6-7 for every authored creature in the Atlas.
   * The Eel — the animal the library is built around — is ONE node connected to
   * itself at recursiveLimit 6, and the slice forbade drawing it.
   *
   * MEASURED FREE (tools/_zrecur.mjs, 400 draws per setting): viability is flat
   * at 57-62% across maxRecursion 2/3/4/6 and median body count does not move.
   * Whatever the clamp was protecting, the measurement does not find it.
   *
   * MEASURED INSUFFICIENT, which is why A2 is three changes and not one: at 6 the
   * draw reaches run >= 4 only 5% of the time, because a chain needs a
   * self-connection AND a high recursiveLimit AND an axial face AND a scale that
   * does not run away, all at once. See `spineAxialRate` and `spineScale` below.
   */
  maxRecursion: 6,
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
   * ── THE PROPORTION GRADIENT'S DRAW BAND — and this IS the morphology change ──
   *
   * `RANGE.taperStrength` is [0, 1] because the whole span must stay expressible:
   * 0 is the pre-V6 behaviour and a migrated genome sits there. But the FACTORY
   * draws from [0.5, 1.0], and that narrower band is where the measured
   * improvement comes from, so it is the thing to argue for rather than slip in.
   *
   * THE ARITHMETIC. Effective anisotropy is `drawn_anisotropy^(1-t)`, so against
   * the measured p50 of 1.75:
   *
   *     t = 0.00  ->  1.75      (today)
   *     t = 0.50  ->  1.32
   *     t = 0.75  ->  1.17      <-- median of this band
   *     t = 1.00  ->  1.00
   *
   * A uniform draw on [0.5, 1.0] has median 0.75 and therefore lands anisotropy
   * p50 at ~1.17, against the plan's gate of <= 1.2. Chosen to MEET a declared
   * gate, and the gate came first.
   *
   * IS THIS AN AUTHORED PRIOR? Yes — and so is the [0.5, 2.0] it replaces. The
   * honest question is which prior has a justification behind it. Three
   * independent per-axis draws assert "each axis of a limb is unrelated to the
   * others", which is precisely what the 1.75 measurement says is false and what
   * makes chains of depth 8 come out as assemblies of stones. Biasing t high
   * asserts "proportion is mostly inherited along a chain", which is the same law
   * `phaseBase` encodes for phase, measured to work, in this repo, this month.
   * NEITHER end is forbidden: t can still mutate to 0 and evolve back to
   * independent axes if that ever wins.
   *
   * ── `taperRatio`: THE SYMMETRIC BAND WAS TRIED FIRST AND IT FAILED ─────────
   *
   * It shipped as [0.7, 1.3], deliberately unbiased, so that the plan's recorded
   * prediction — that this work would shrink the too-heavy mass tail — could fail
   * honestly. IT DID FAIL, and worse than baseline:
   *
   *     taperRatio      accept    mass p50   mass p90   mass rejections
   *     (pre-taper)      37.3%       16.4      111.2       107
   *     [0.70, 1.30]     34.5%       12.8      183.8       114   <-- WORSE
   *     [0.80, 1.15]     37.3%       13.2      129.1        99
   *     [0.75, 1.05]     44.5%        9.3       52.3        49   <-- shipped
   *     [0.70, 1.00]     45.8%        7.8       31.3        32
   *
   * WHY, AND IT IS THE INTERESTING PART. `r` compounds as `r^depth`, so a band
   * that looks symmetric in `r` is violently asymmetric in outcome: the grammar
   * reaches TREE DEPTH 8, and 1.3^8 is 8.2x per axis — 550x in volume — while
   * 0.7^8 merely vanishes and gets culled. Exponentiating a symmetric band
   * produces a heavy right tail, full stop.
   *
   * A second mechanism showed up in the tally: pre-taper, ANISOTROPY WAS ACTING
   * AS AN ACCIDENTAL VOLUME BRAKE. A distorted limb usually had one thin axis, so
   * `MIN_LIMB_DIMENSION` culled it and took its subtree with it. Removing the
   * distortion removed the brake — visible as `oversizeTank` falling 7 -> 1 and
   * `interpenetration` rising 37 -> 46, because the bodies are now chunkier.
   *
   * SO THE BAND IS DERIVED, NOT TUNED: it must satisfy `r^maxDepth` staying near
   * unity, and `maxDepth` is 8. At 1.05 that is 1.48x per axis (3.2x volume),
   * which a body plan can absorb; at 1.15 it is 3.1x (30x); at 1.3 it is absurd.
   * [0.75, 1.05] is the widest band that respects the depth the grammar actually
   * reaches, and it STILL PERMITS FLARING — a broad tail fluke remains
   * expressible, which [0.70, 1.00] would have forbidden outright for a better
   * acceptance number. That trade was declined.
   */
  taperStrength: [0.5, 1.0],
  taperRatio: [0.75, 1.05],

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
   * ── THE SPINE — A2 ────────────────────────────────────────────────────────
   *
   * A SELF-CONNECTION IS A SEGMENT THAT REPEATS. These three fields say that when
   * a segment repeats, it repeats ALONG THE BODY AXIS. They are a statement about
   * geometry, not about creatures: every other choice is a shape morphogenesis
   * throws away, and drawing it is not variety, it is waste.
   *
   * WHY THE FACE DOMINATES. `morphogen.js placeChild` attaches every child by its
   * own -Z face — "fixed convention, never revisited" — so a segment repeated on
   * the parent's +Z face (index 5) extends the body, and a segment repeated on
   * any other face turns ninety degrees EVERY TIME and spirals into itself.
   * `worlds/seeds.js:119` keeps that counter-example on purpose: genes identical
   * to the Eel except `parentFace: 0`, and "the chain self-intersects, and
   * morphogenesis rejects it at four bodies however high recursiveLimit goes".
   * Five of six allowed faces are doomed before anything else is drawn, which is
   * most of the gap between 46% of genomes carrying a self-connection and 0%
   * carrying a spine.
   *
   * NOT 1.0, DELIBERATELY. A coiled or radial repeat is a real animal — a snail,
   * a fiddlehead — and some of them survive the overlap test. The residual keeps
   * that reachable rather than legislating it away.
   *
   * `spineScale` is the second coincidence. Connection scale is CUMULATIVE down
   * the chain (`morphogen.js placeChild`: parent.cumulativeScale * c.scale), so
   * over six segments the full [0.5, 2.0] band spans 1/64x to 64x and either end
   * leaves the [MIN_LIMB_DIMENSION, MAX_LIMB_DIMENSION] window — the subtree is
   * dropped and the chain ends early. A band around 1 gives a chain that tapers
   * rather than one that detonates. Non-self connections keep the full range, so
   * limbs, fins and claws are untouched by any of this.
   *
   * `spineOrient` is the third: RANGE.orientation is +/- PI/4 per axis, which is
   * already NARROW (10 §A5 correction 4), but 45 degrees compounded over six
   * segments is 270 degrees of curl. This narrows it FOR REPEATS ONLY.
   */
  spineAxialRate: 0.8,
  /**
   * BIASED BELOW 1, so a chain TAPERS. Not a cosmetic choice — measured.
   *
   * Connection scale is cumulative and applies per axis, so a segment's VOLUME
   * goes as scale^3 per step. At a band centred on 0.95 a six-segment chain
   * weighs about 4.5x its first segment, and with `RANGE.dim` reaching 2.0 cm on
   * every axis that puts it straight through `VIABILITY.maxMass`: measured median
   * spine mass 26.4 g against a 40 g cap, with 42% over it, and `mass` was the
   * largest single rejection reason for drawn spines (25 of 42).
   *
   * Centred on ~0.82 the same chain weighs about 2.2x its first segment. It is
   * also what segmented swimmers do — an eel is not a stack of identical cubes —
   * so the constraint the viability filter was expressing was a real one.
   */
  spineScale: [0.60, 1.05],
  spineOrient: 0.35,        // fraction of RANGE.orientation retained on a repeat

  /**
   * How often the extra-edge pass is STEERED to make a self-connection. The pass
   * already produces them by chance — `pick(nodes)` lands on the parent about
   * 1/nodeCount of the time, measured at 46% of genomes carrying at least one —
   * and this raises that without removing the chance path.
   *
   * The lever the measurement pointed at (HANDOVER-FORAGE 23a) was "bias the draw
   * toward FEW nodes whose connections are self-referential", i.e. the node-count
   * distribution. That is the more invasive reading: `nodeCount` was raised
   * 2 -> 3 at B2 §2.2 because "at 2 the factory produces a two-box hinge 28% of
   * the time, which is not a creature", and lowering it again re-opens a defect
   * that was closed on measurement. Steering one edge gets the chain without
   * reversing that decision.
   */
  spineEdgeRate: 0.45,

  /**
   * A3b — the probability that a node takes the BODY's frequency multiplier
   * rather than drawing its own. See the measurement at the `jointGenes` draw in
   * `createRandomGenome`: a frequency mismatch between adjacent joints drops
   * their commanded coherence from 0.976 to 0.005, and no phase gradient can
   * repair it, because sines at different multiples of omega are orthogonal.
   *
   * 0 restores the pre-A3b independent draw exactly.
   */
  freqCoherence: 0.85,

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

  /**
   * ── A FLOOR UNDER THE BEND, AND IT IS THE PRODUCT THAT NEEDED FIXING ────────
   *
   * A bending joint's limit is drawn from this instead of from
   * `RANGE.angleLimit`. Twist joints keep their own band (see `randomNode`).
   *
   * THE DEFECT, MEASURED (`tools/_zjoint.mjs`, 300 draws, 414 joints). What a
   * joint actually swings is `amplitude x angleLimits[0]`, a product of two
   * independent uniforms — `amplitude ~ U[0,1]`, `angleLimits ~ U[0, PI/2]`. The
   * product's expectation is a QUARTER of the cap even though either gene alone
   * averages a half:
   *
   *     drawn stroke half-amplitude   p10 0.005   median 0.105 (6 deg)   max 1.212
   *     the authored eel              0.8 x 0.9 = 0.720 rad (41 deg)
   *
   * **88% of drawn joints swing less than half the eel's stroke, and the p10
   * joint swings a third of a degree** — a revolute joint behaving like a rigid
   * one. The 90-degree cap was never the problem; the bottom of the band was.
   *
   * THE A/B (`design/15-BREEDING.md` section 10e). Four arms, 20 generations x
   * 3 lines, same seed and the same draw sequence, so generation 0 was the same
   * genomes differing only in this band. Best BRED animal, canonical trial:
   *
   *     [0, 1.571]     control     1.610 cm      response 1.88x
   *     [0.35, 1.571]  THIS        5.297 cm      response 2.81x     <- 3.3x
   *     [0, 2.0]       ceiling     1.526 cm      response 2.55x
   *     [0.35, 2.0]    both        5.340 cm      response 5.34x
   *
   * The ceiling alone is no better than the control and its ark contained zero
   * bred animals; the floor is the whole effect, and the pair adds 1% to the
   * champion. So the floor ships and the ceiling does not.
   *
   * WHY 0.35 AND NOT A TUNED VALUE. It is `RANGE.twistLimit`'s ceiling: a
   * bending joint should bend at least as far as a feathering twist joint is
   * allowed to rotate. It is the one number already in the schema that means
   * "the smallest articulation this project considers worth having", and reusing
   * it is what keeps this from being the ungrounded coefficient standing rule 5
   * forbids.
   *
   * WHY THIS IS A CONFIG BAND AND NOT A SCHEMA EDIT, learned by breaking it:
   * `validateGenome` checks EVERY joint's `angleLimits` against
   * `RANGE.angleLimit`, twist joints included, and a twist joint's own band is
   * the subrange [0, 0.35]. Raising `RANGE.angleLimit[0]` therefore invalidates
   * every twist joint in the corpus at once — which is exactly how the first run
   * of the A/B died. Every value drawn here stays inside the schema range, so
   * nothing stored is invalidated and there is no migration.
   *
   * ⚠ THIS MOVES THE RANDOM CORPUS BUT NO STORED GENOME. `createRandomGenome`
   * at a given seed now yields a different animal, so every figure taken on a
   * drawn corpus before this date is measured on a different population and must
   * not be compared across it. NO `faunaVersion` BUMP, and that is deliberate:
   * that counter exists for changes that MOVE GENOME HASHES and invalidate
   * cached records, and nothing stored moves here — the seeds, the residents and
   * every Atlas specimen are untouched to the bit.
   */
  revoluteLimitBand: [0.35, RANGE.angleLimit[1]],
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

/**
 * The face a repeated segment must sit on to extend the body rather than spiral
 * into it. See `SLICE_LIMITS.spineAxialRate`. 5 is +Z in morphogen.js's face
 * table, and every child attaches by its own -Z, so 5 is the only face on which
 * "the same segment again" means "further along".
 */
export const AXIAL_FACE = 5;

/**
 * THE SPINE SUB-GRAMMAR — A2. Applied to a connection whose parent IS its child.
 *
 * Like `clampReflection` above, this exists because the morphogen is correct and
 * the DRAW was producing shapes the morphogen then had to throw away. It belongs
 * here and in mutate.js, and morphogen.js is not touched.
 *
 * Four coincidences had to land at once for a chain to form, and three of them
 * are handled here (the fourth, `recursiveLimit`, is a node gene):
 *
 *   1. the axial face          — 1 in 5, and 4 of the other 5 self-intersect
 *   2. `terminalOnly` false    — 1 in 2; a repeat that fires ONLY at the terminal
 *                                depth is not a repeat, it is a cap
 *   3. a scale near 1          — cumulative down the chain, so the tails of
 *                                [0.5, 2.0] leave the limb-size window and the
 *                                subtree is dropped part-way along
 *
 * SCALE AND ORIENTATION ARE REMAPPED, NOT CLAMPED. Clamping would pile the
 * probability mass on the two band edges — a uniform [0.5, 2.0] clamped to
 * [0.72, 1.18] puts over half the draws exactly on 1.18. The linear remap keeps
 * the draw uniform inside the narrower band and consumes no extra randomness, so
 * only the face test costs an rng call.
 */
export function applySpineGrammar(c, rng, limits = SLICE_LIMITS) {
  if (c.parentNodeId !== c.childNodeId) return c;

  // `terminalOnly` ON A SELF-EDGE IS A DEAD COMBINATION, always, so it is cleared
  // for every repeat and not only for axial ones. morphogenesis applies a
  // terminalOnly connection only once `depth === node.recursiveLimit` — at which
  // point the recursion has already stopped — so the edge can never fire and the
  // node makes one body. This is the same defect the spanning-edge pass above
  // documents ("a terminalOnly spanning edge NEVER FIRES ... 500 genomes gave a
  // minimum of 1 body"), reached through the other kind of edge.
  c.terminalOnly = false;

  const faces = limits.allowedFaces ?? ALL_FACES;
  const rate = limits.spineAxialRate ?? 0;
  // Drawn unconditionally so the rng stream does not depend on which branch the
  // face test would have taken — determinism is exact or it is not determinism.
  const roll = rng.range(0, 1);
  if (rate > 0 && faces.includes(AXIAL_FACE) && roll < rate) {
    c.parentFace = AXIAL_FACE;

    const band = limits.spineScale;
    if (band) {
      const [lo, hi] = RANGE.scale;
      const span = hi - lo;
      c.scale = c.scale.map((v) =>
        qClamp(band[0] + ((v - lo) / span) * (band[1] - band[0]), RANGE.scale));
    }
    const k = limits.spineOrient;
    if (k != null) c.orientation = c.orientation.map((v) => qClamp(v * k, RANGE.orientation));
  }
  return c;
}
// qClamp, not q: q rounds to the NEAREST micron and can land a draw just
// outside the range it came from. See genome.js. Never observed here — it needs
// a draw within 5e-7 of a bound — but it is the same defect that made every
// saturating mutation invalid, and it is fixed in one place for both.
const uniform = (rng, range) => qClamp(rng.range(range[0], range[1]), range);
const uniformInt = (rng, [lo, hi]) => lo + rng.int(hi - lo + 1);

function randomNode(rng, limits) {
  const id = makeId(rng, 'n');
  const dims = [uniform(rng, RANGE.dim), uniform(rng, RANGE.dim), uniform(rng, RANGE.dim)];
  // SLICE-SCOPED, not RANGE-scoped. A1's "approximately neutrally buoyant by
  // chance" was measured false; the band makes it true by construction. See
  // SLICE_LIMITS.density for the measurement and for the step-F restoration.
  const density = uniform(rng, limits.density ?? RANGE.density);
  const recursiveLimit = uniformInt(rng, [RANGE.recursiveLimit[0], Math.min(limits.maxRecursion, RANGE.recursiveLimit[1])]);
  // DRAWN BEFORE THE LIMITS BECAUSE THE LIMITS DEPEND ON IT, and the draw ORDER
  // is unchanged from when the type and the limits sat in one object literal —
  // literal properties evaluate top to bottom, so `type` already came first.
  // Three limit draws either way, whichever type came out, so the rng stream
  // keeps its shape and the only thing that changes is the width they land in.
  const type = pick(rng, limits.jointTypes);
  // ── A SLICE BAND FOR THE BEND, THE WAY `density` HAS ONE ────────────────────
  //
  // `limits.revoluteLimitBand` narrows what a BENDING joint's limit is DRAWN
  // from, leaving `RANGE.angleLimit` — the schema — alone. Absent, this is
  // `limitRangeFor(type)` exactly as before, so the default draw is unchanged to
  // the rng draw.
  //
  // WHY IT CANNOT BE A SCHEMA CHANGE, learned by breaking it: `validateGenome`
  // checks every joint's `angleLimits` against `RANGE.angleLimit`, TWIST JOINTS
  // INCLUDED, and a twist joint's own band is the subrange [0, 0.35]. Raising
  // `RANGE.angleLimit[0]` to put a floor under bending joints therefore
  // invalidates every twist joint in the corpus at once — which is what it did,
  // on the first run of the A/B this was written for.
  //
  // TWIST IS EXCLUDED HERE FOR THE SAME REASON IT HAS ITS OWN RANGE: it is a
  // hinge about a limb's own long axis, not a bend, and 0.35 rad is the
  // feathering band chosen for that. A floor meant for undulation has no
  // business raising it.
  const band = type === 'twist'
    ? limitRangeFor(type)
    : (limits.revoluteLimitBand ?? limitRangeFor(type));
  return makeNode(id, {
    dims,
    density,
    recursiveLimit,
    joint: {
      type,
      angleLimits: [uniform(rng, band), uniform(rng, band), uniform(rng, band)],
      // A3 — A DEVIATION FROM THE GRADIENT, not the whole lag. Drawn from the
      // narrow `phaseDeviation` band rather than the full circle, so a new
      // genome asks for a coherent travelling wave by default and selection has
      // to WORK to break it where a body needs asymmetry. Drawing this at full
      // range was the defect: independent per-node lags accumulated along the
      // tree into a random walk, and commanded coherence measured 0.615.
      phaseLag: uniform(rng, RANGE.phaseDeviation),
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
  return applySpineGrammar(clampReflection(makeConnection(makeId(rng, 'c'), {
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
  }), limits), rng, limits);
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
  const drawnExtras = uniformInt(rng, limits.extraEdges);
  // A2 — STEER ONE EXTRA EDGE INTO A SELF-CONNECTION, sometimes. The pass already
  // produces them by chance (`pick(nodes)` landing on the parent, 46% of genomes
  // carrying at least one); this raises the rate without closing the chance path,
  // and without touching `nodeCount`, whose floor was raised 2 -> 3 on
  // measurement at B2 §2.2 and should not be walked back.
  //
  // IT IS AN ADDITIONAL EDGE, NOT A CONVERTED ONE, and that detail is load-
  // bearing. `extraEdges` has a floor of 1, so converting the single extra into
  // the self-edge left the spine as the ONLY redundant edge in the graph — and
  // then `removeConnection` had no other legal removal and cut it, which is the
  // residue that survived deprioritising self-edges in that operator (spine
  // survival at 20 generations moved only 23% -> 31%). Adding one keeps a
  // non-spine edge available to give back, which is the same argument
  // `extraEdges` itself is justified by above.
  const spineRoll = rng.range(0, 1);
  let wantSpine = spineRoll < (limits.spineEdgeRate ?? 0);
  const extras = drawnExtras + (wantSpine ? 1 : 0);
  for (let k = 0; k < extras; k++) {
    const candidates = nodes.filter(n => outDegree.get(n.id) < limits.maxConnPerNode);
    if (!candidates.length) break;
    const parent = pick(rng, candidates);
    // The self-edge goes on a node with a recursiveLimit worth repeating: a
    // spine edge on a node capped at 1 produces two bodies and no chain.
    const child = wantSpine && parent.recursiveLimit >= 3 ? parent : pick(rng, nodes);
    if (child === parent) wantSpine = false;
    addEdge(parent.id, child.id, rng.int(2) === 0);
  }

  // A3b — ONE BODY, ONE FREQUENCY, BY DEFAULT.
  //
  // `freqMult` was an INDEPENDENT draw per node from [0.5, 1, 2], which is the
  // same defect class as `phaseLag` before A3: a per-node independent draw where
  // a body-wide default belongs. And it is the binding one.
  //
  // MEASURED (tools/_zgrad.mjs, 16 creatures, on the command alone):
  //
  //     adjacent joint pairs SHARING freqMult      coherence 0.976
  //     adjacent joint pairs DIFFERING             coherence 0.005
  //
  // The phase gradient does its whole job — 0.976 — wherever phase can act at
  // all. It cannot act across a frequency mismatch: sin(wt) and sin(2wt) are
  // ORTHOGONAL over a period, so their correlation is zero whatever their
  // phases are. With 20% of adjacent pairs mismatched, that alone held the
  // corpus median at 0.745 against a 0.90 gate.
  //
  // Real spinal CPGs run the whole body at one frequency and differentiate
  // segments by PHASE. A frequency doublet along a body axis is not a gait, it
  // is two animals.
  //
  // THE GENE IS NOT REMOVED AND NOTHING IS BANNED. `resampleFreqMult` still
  // moves a single joint to another multiple, which mutate.js describes as
  // "what turns a travelling wave into a different gait" — that remains
  // reachable, and selection can keep it. Only the DEFAULT changes: a new
  // genome asks for one rhythm, and a counter-rhythm has to be discovered.
  // `freqCoherence` is the one constant; set it to 0 for the old behaviour.
  // THE BODY'S DEFAULT IS 1, NOT A DRAW, and that is a separation of concerns
  // rather than a tuning choice. Once the body shares a multiplier, a body-wide
  // `freqMult` is REDUNDANT WITH `omega`: the commanded frequency is
  // `omega * freqMult`, and `omega` is already a free gene over [0.5, 6]. Drawing
  // the shared value from [0.5, 1, 2] therefore adds nothing omega cannot
  // express, while handing a third of all genomes a uniform half-speed penalty
  // for no reason. `omega` carries TEMPO; `freqMult` carries per-joint
  // DIFFERENTIATION — a joint beating against its neighbours — which is what
  // mutate.js `resampleFreqMult` describes it as being for, and which is still
  // reachable both from the freqCoherence miss below and from that operator.
  const bodyFreq = 1;
  const jointGenes = {};
  for (const n of nodes) {
    const roll = rng.range(0, 1);
    jointGenes[n.id] = {
      amplitude: uniform(rng, RANGE.amplitude),
      bias: uniform(rng, RANGE.bias),
      freqMult: roll < (limits.freqCoherence ?? 0) ? bodyFreq : pick(rng, FREQ_MULTS),
    };
  }

  return {
    version: GENOME_V,
    seed: rng.seed >>> 0,
    rootNodeId: nodes[0].id,
    /**
     * THE PROPORTION GRADIENT — drawn, because a gene the factory never reaches
     * is the `preyGain` precedent and it measured zero across the whole corpus
     * for six sessions.
     *
     * DRAWN FROM `SLICE_LIMITS.taperStrength`, NOT from the full `RANGE` [0, 1],
     * and that band is the actual morphology change. See the note there.
     */
    morphology: {
      taperStrength: uniform(rng, SLICE_LIMITS.taperStrength),
      taperRatio: uniform(rng, SLICE_LIMITS.taperRatio),
    },
    /**
     * A CREATURE THE FACTORY DREW HAS NO FOUNDER, and that is a positive claim
     * rather than a missing value: it arose from a random draw and nothing was
     * authored into it. `worlds/seeds.js` genomes carry their own id here, and
     * `mutate`/`crossover` propagate whatever they inherit, so an animal fifty
     * generations down from an eel still says so.
     */
    origin: { founder: null, generations: 0 },
    /**
     * THE MOUTH IS PLACED WHERE IT WAS DERIVED, AND NO RNG IS DRAWN FOR IT.
     *
     * The obvious thing is to draw the face and (u,v) so placement varies from
     * birth. Deliberately not done, for two reasons.
     *
     * A draw here would shift the rng stream (factory.js:708 warns about exactly
     * this), so every seed would produce a different creature and the whole
     * corpus of measured figures — the Atlas, a generation-68 lineage, the
     * selection runs, the gate's own reference numbers — would silently stop
     * being comparable to anything recorded before today. Consuming nothing
     * means generation 0 is bit-identical to what it was.
     *
     * And it matches the standing organ discipline: neutral at insertion. A
     * mouth drawn onto a random face would also, on five faces out of six, be a
     * behavioural change dressed as a schema change.
     *
     * `mutateMouth` is what moves it, so it is reachable in ONE mutation from
     * every genome in the population. Only the STARTING placement is the old
     * derived one — the `proprioGain` pattern verbatim.
     */
    mouth: defaultMouth(nodes[0]),
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
      // A3 — THE GRADIENT. `phaseBase` is the lag every joint contributes and is
      // what turns an accumulated phase into a travelling wave; it is drawn over
      // the full circle because any constant lag is a wave, and which one is a
      // real choice about gait. `phaseSlope` chirps that lag with depth and is
      // narrow by construction (RANGE.phaseSlope), because a large slope unwinds
      // the wave within a few segments.
      phaseBase: uniform(rng, RANGE.phaseBase),
      phaseSlope: uniform(rng, RANGE.phaseSlope),
      // ── A5. DRAWN AT ZERO, ON MEASUREMENT ──────────────────────────────────
      //
      // The receptor is always present and `mutateProprioGain` is live, so
      // selection can raise this whenever a lineage benefits. What it does NOT do
      // is impose a gain on every new genome, because the measured effect of a
      // non-zero one is negative (tools/_zproprio.mjs, 16 creatures, a nominal
      // body and the same animal carrying +30% mass):
      //
      //     K      achieved inter-joint coherence, loaded
      //     0      0.648
      //     0.25   0.541
      //     0.5    0.588
      //     1      0.535
      //     2      0.374
      //
      // The chantier's own gate — achieved/commanded >= 0.90 — is MET at K = 1,
      // and meeting it means nothing: the ratio rises only because commanded
      // coherence collapses faster than achieved does (0.959 -> 0.59). A ratio
      // whose denominator the treatment also moves is not a measurement. Swept
      // the inter-oscillator coupling at 4, 12 and 30 as well: achieved coherence
      // is FLAT at 0.535 across all three while the ratio climbs 0.905 -> 0.952,
      // which is the same artefact seen a second way.
      //
      // WHY THE ORGAN UNDER-DELIVERS, and it is the A4 story again. A5 was
      // specified against a world where "a joint fails to reach its commanded
      // angle and the oscillator marches on". After the A1 force-accumulation
      // fix joints largely DO reach their commands — amplitude tracking is ~0.95
      // and command-to-body lock ~0.75 — so the failure entrainment exists to
      // correct is now rare, and the extra phase dynamics mostly add noise to a
      // wave A3 had already made coherent.
      //
      // NOT THE preyGain PRECEDENT. That gene was unreachable because no operator
      // touched it. This one has its own operator, fires at a measured rate, and
      // crosses — it is reachable in one mutation from every genome in the
      // population. Only the STARTING value is zero.
      proprioGain: 0,
      // Blind at birth, and drawing no rng for the same reason the mouth does
      // not. `mutateChemoGain` moves it; until it does, a creature has receptors
      // that report nothing, which is what makes a site free to carry and makes
      // the cave-fish regression gate possible.
      chemoGain: 0,
      // GENOME_V 7 — the second steering channel, and silent at birth for the
      // same reason `chemoGain` is: neutral at insertion (standing rule 4). A
      // creature drawn today steers exactly as one drawn yesterday until
      // `mutateSteerGains2` moves one of these off zero. Draws no rng, so the
      // whole existing corpus reproduces from its seed unchanged.
      preyGain2: 0,
      threatGain2: 0,
      // GENOME_V 8 — no brake at birth. `mutateBrakeGain` switches it on, and
      // whether a lineage keeps it depends on whether it passes its target or
      // grinds toward it; both are in the corpus and they want opposite values.
      brakeGain: 0,
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
