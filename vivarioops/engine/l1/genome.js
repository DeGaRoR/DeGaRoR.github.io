// engine/l1/genome.js — the genome schema (10 §A5, amended by A1 and A3).
//
// PURITY (01 §4, N1–N3): no Math.random, no Date, no DOM, no imports from
// /trunk/, /ui/, /render/. Randomness arrives as an injected rng argument.
//
// THE SCHEMA IS FULL AND UNRESTRICTED. Only the factory and the mutation
// operators are slice-constrained (10 §3). Loosening at step F is a config
// change, never a migration.

import { fnv1a, hex8 } from '../../contracts/hash.js';
import { GENOME_V } from '../../contracts/versions.js';

// ── gene ranges ──────────────────────────────────────────────────────────────
// One table. Every range is here and nowhere else, so the factory, the mutation
// operators and the validator cannot drift apart.

/**
 * One angle limit per axis (H6). Each is a HALF-RANGE about zero, so physics
 * applies setLimits(-a, +a). Only axis 0 is read by anything today — see H14.
 */
export const ANGLE_AXES = 3;

export const RANGE = {
  // Node — 10 §A5, density amended by A1 (was 0.6..1.4)
  dim:            [0.2, 2.0],       // m, full extent per axis
  density:        [0.15, 1.8],      // relative to water; midpoint ~0.98 = neutral
  recursiveLimit: [1, 6],           // integer
  angleLimit:     [0, Math.PI / 2], // radians, symmetric about zero

  /**
   * AXIAL ROTATION IS NOT A BEND, and until now it was drawn from the same table.
   *
   * `jointAxisAtSpawn` gives a `twist` joint the axis `axes.z`, which is the face
   * normal — and the face normal is the axis the child EXTENDS ALONG, because
   * morphogen.js attaches every child by its own -Z face and offsets it +Z by a
   * half-depth. So a twist joint is a hinge about the limb's own long axis, and
   * drawing its limit from `angleLimit` gave it up to +-90 degrees: 180 degrees of
   * total roll about its own length. Nothing in a body does that. A forearm is the
   * outlier of the whole vertebrate skeleton at about +-75, and it is TWO bones
   * crossing, not one segment spinning in a socket.
   *
   * 0.35 rad (+-20 degrees) is the feathering band. It is enough for a fin to
   * change its angle of attack across a stroke — which is real, and is most of
   * what a twist joint is worth hydrodynamically — and far short of the barber-pole
   * spin that made jointed creatures read as non-physical.
   *
   * A SUBRANGE OF `angleLimit`, deliberately. Every value drawn here is still
   * valid under `validateGenome`, so this is a config change and never a
   * migration — the same standing rule SLICE_LIMITS.jointTypes is written to.
   * Genomes authored before this keep their wide stored values and are clamped at
   * EXPRESSION, in morphogen.js, so the plan the controller reads and the plan
   * physics spawns cannot disagree about what the limit is. It bites: w1_residents
   * and w1_spines express 42 twist joints between them, against 0 for the three
   * w1_player creatures — which is why those three are bit-identical across the
   * change and the other seven are not. tools/_ztwist.mjs measures it.
   */
  twistLimit:     [0, 0.35],        // radians, symmetric about zero

  /**
   * A3 — THIS IS NOW A DEVIATION, not the lag itself.
   *
   * The lag a joint contributes is `phaseBase + phaseSlope * depth + phaseLag`
   * (resolved in morphogen.js). The SCHEMA range stays the full circle because
   * migrated v2 genomes carry their old whole-lag values in this field and must
   * remain valid; the FACTORY draws from `phaseDeviation` below, which is narrow.
   */
  phaseLag:       [-Math.PI, Math.PI],
  phaseDeviation: [-0.32, 0.32],    // ~0.1 x the full circle — what the factory draws

  // A3 — the gradient itself, one pair per genome rather than one lag per node.
  // `phaseBase` is the lag every segment contributes; a CONSTANT lag along a
  // chain is exactly what makes a travelling wave. `phaseSlope` lets the lag
  // change with depth, which chirps the wave — kept narrow because a slope of
  // any size unwinds the wave within a few segments.
  phaseBase:      [-Math.PI, Math.PI],
  /**
   * NARROWED 0.35 -> 0.10 ON MEASUREMENT, and the first value contradicted the
   * sentence next to it. A slope applies PER SEGMENT OF DEPTH and accumulates:
   * at 0.35 a six-segment spine's lag drifts by 2.1 rad from head to tail, which
   * is two thirds of a half-cycle and unwinds the constant-lag wave that makes a
   * spine work at all. Measured: spined creatures' mean locomotion score fell
   * 0.0975 -> 0.0328 when the gradient landed, while the corpus mean barely
   * moved — the chirp was undoing A2's gains on exactly the bodies A2 added.
   * At 0.10 the same body drifts 0.6 rad, which bends the wave without
   * destroying it.
   */
  phaseSlope:     [-0.10, 0.10],    // rad per segment of depth

  /**
   * A5 — PROPRIOCEPTIVE GAIN. How hard a joint's oscillator is pulled toward the
   * phase the joint is ACTUALLY at (controller.js advancePhases). Units are 1/s:
   * K is a rate, so K = 1 corrects a phase error of one radian at one radian per
   * second, which is the same order as `omega` itself.
   *
   * FLOOR IS ZERO AND MEANS OPEN LOOP, which is what the migration sets and what
   * makes the organ neutral at insertion. The ceiling is deliberately below the
   * point where the correction term can dominate the joint's own advance: above
   * roughly `omega` the oscillator stops being a rhythm generator and becomes a
   * follower of the body, which is not a CPG.
   */
  proprioGain:    [0, 3.0],         // 1/s

  // Connection
  parentFace:     [0, 5],           // integer, 6 faces of the parent box
  position:       [-1, 1],          // on that face
  orientation:    [-Math.PI / 4, Math.PI / 4],  // NARROW — 10 §A5 correction 4
  scale:          [0.5, 2.0],       // cumulative down the chain

  // Controller — 10 §A7, gains added by A3
  omega:          [0.5, 6.0],       // rad/s, global body frequency
  amplitude:      [0, 1],
  bias:           [-0.5, 0.5],
  preyGain:       [-1, 1],          // sign is EVOLVED, not declared (P2)
  threatGain:     [-1, 1],

  // Material — 10 §A10
  hue:            [0, 1],
  hueVariance:    [0, 0.5],
  patternScale:   [0.5, 8.0],
  patternContrast:[0, 1],
  stripeAnisotropy: [0, 1],
  iridescence:    [0, 1],

  // Node colour — SPEC HOLE: 10 §A5 writes `colorGenes: {...}` with no contents.
  // Defined here so the schema is stable before B5; B5 may use or ignore them,
  // but adding fields later would force a migration.
  hueShift:       [-0.15, 0.15],    // offset from the genome hue
  valueShift:     [-0.3, 0.3],
  patternPhase:   [0, 1],

  /**
   * ORGAN PLACEMENT — where a mouth or a receptor sits on a body.
   *
   * DELIBERATELY THE CONNECTION IDIOM. A connection is already placed by
   * `parentFace` (0..5) plus `position[2]` in [-1,1] on that face, and
   * morphogen's `placeChild` already turns that triple into a local offset. An
   * organ is the same act — attach a thing to a face at (u,v) — so it reuses the
   * same shape rather than inventing a second one, and `FACE_NORMAL[face]` then
   * gives an outward direction for free. That normal is the entire affordance a
   * photoreceptor will need later, bought here at no cost.
   */
  siteAt:         [-1, 1],          // u,v on the chosen face

  /**
   * CHEMORECEPTION GAIN. Zero is blind, and blind is what every migrated genome
   * starts as. The SIGN IS EVOLVED, NOT DECLARED, exactly as `preyGain` is (P2,
   * 00 §70): a creature that swims away from food is representable and will
   * simply lose.
   */
  chemoGain:      [-1, 1],

  // Social — the six fields 03 §3 declares `from genome` and no document supplied.
  // Ranges are chosen here, not specified anywhere; each is justified inline.
  trophic:        [0, 1],   // 12 §: uptake scales (1-trophic), predation scales trophic.
                            // Continuous: no herbivore/carnivore flag (P2).
  boldness:       [0, 1],   // 12 §: prey accepted while massRatio < boldness*2
  cohesion:       [0, 1],   // Reynolds weights
  separation:     [0, 1],
  alignment:      [0, 1],
  separationRadius: [0.5, 4.0],     // m
};

export const JOINT_TYPES = ['rigid', 'revolute', 'twist', 'bendTwist', 'twistBend', 'universal', 'spherical'];

/**
 * The half-range table a joint of this type draws its angle limits from.
 *
 * ONE FUNCTION, FOUR CALLERS — factory.js and mutate.js draw through it,
 * mutate.js re-clamps through it when `jointType` resamples a joint into a new
 * type, and morphogen.js clamps through it at expression. Doing this per-caller
 * is how the density band and the recursion cap each ended up with a second,
 * subtly different copy; the point of the one table in this file is that there
 * is nowhere else for the number to live.
 *
 * The composite types are listed EXPLICITLY rather than defaulting. `bendTwist`,
 * `twistBend` and `universal` are in the schema, are not in the slice set, and
 * fall through to a plain revolute in physics.js `makeJointData` — so today they
 * bend and do not twist, and the bend band is the honest answer for them. When
 * step F implements them as real two-axis joints this is the site that has to
 * learn to return a range PER AXIS, and the explicit list is what will make that
 * a compile-time-obvious edit rather than a silent inheritance.
 */
export function limitRangeFor(type) {
  switch (type) {
    case 'twist':     return RANGE.twistLimit;
    case 'revolute':  return RANGE.angleLimit;
    case 'bendTwist': return RANGE.angleLimit;   // revolute in practice — see above
    case 'twistBend': return RANGE.angleLimit;   // revolute in practice — see above
    case 'universal': return RANGE.angleLimit;   // revolute in practice — see above
    case 'spherical': return RANGE.angleLimit;   // inert: no setLimits in the binding
    case 'rigid':     return RANGE.angleLimit;   // inert: no free axis to limit
    default:          return RANGE.angleLimit;
  }
}
export const FREQ_MULTS = [0.5, 1, 2];

/** Instantiation caps — 10 §A5. Morphogenesis truncates; truncation is normal. */
export const CAPS = { maxBodies: 24, maxConnPerNode: 4, maxSitesPerNode: 4 };

/**
 * THERE IS EXACTLY ONE MOUTH, AND IT IS ON THE ROOT BODY.
 *
 * Placement is genetic; COUNT IS NOT, and that is a decision rather than an
 * omission. `forageStep` gives every mouth its own `INGEST_RATE`, and a mouth is
 * a bare point — no mass, no drag, no collider, no work — so it appears on
 * neither side of the ledger's cost. Measured against the shipped field: one
 * mouth reaches ~1.9 items, and a 24-body creature carrying 24 of them would
 * reach ~46, which is a 24x intake multiplier for exactly zero cost. Nothing
 * else in the genome would matter again.
 *
 * `INGEST_RATE`'s own comment says "PER MOUTH, NOT PER AREA. That is the whole
 * point of the rebuild: a big animal gets no bonus for being big" — an invariant
 * that holds only while the count is one. Making count genetic would repeal it
 * silently. If it is ever wanted, it needs a gut: intake capped per CREATURE by
 * a throughput a mouth cannot raise.
 *
 * Root-only is also what makes "one" structural rather than policed. Organs
 * attach to NODES, and morphogen's `reflectionVariants` instantiates one node as
 * many bodies — which is precisely how receptors get their pairs. A node-placed
 * mouth would multiply the same way and would need a cap to stop it; the root
 * body is unique by construction, so it needs nothing.
 */

// ── quantisation ─────────────────────────────────────────────────────────────
// Every gene value is quantised to 1e-6 at every write site.
//
// WHY: without it, serialisation carries full double precision, the serialised
// form is long, and a mutation of 1e-17 changes genomeHash while changing nothing
// observable — so the cache misses and a creature recompiles for no reason.
// 1e-6 m is one micron against body dims of 0.2-2.0 m: far below any physical or
// perceptual threshold. Quantising also makes byte-identical round-trip trivial.

export const QUANTUM = 1e6;
export const q = (x) => Math.round(x * QUANTUM) / QUANTUM;
export const isQuantised = (x) => Math.abs(x * QUANTUM - Math.round(x * QUANTUM)) < 1e-6;

/**
 * Quantise INTO a range. `q` rounds to the nearest micron, which can round a
 * value that sits exactly on a bound to the wrong side of it: the range
 * `phaseLag: [-PI, PI]` has `q(-PI) = -3.141593`, which is 3.5e-7 BELOW its own
 * legal minimum, and `validateGenome` rejects it.
 *
 * Clamping before quantising does not help — that is what produces the failure.
 * The bound itself has to be moved to the nearest representable value INSIDE
 * the range, so the two operations agree.
 *
 * The factory has always had this defect and it has never fired there, because
 * a uniform draw lands within 5e-7 of a bound about once in ten million. A
 * mutation operator that clamps deliberately hits it every time it saturates,
 * which is how it was found. Both now use this function.
 */
export function qClamp(x, [lo, hi]) {
  const loQ = Math.ceil(lo * QUANTUM) / QUANTUM;
  const hiQ = Math.floor(hi * QUANTUM) / QUANTUM;
  const v = q(x);
  return v < loQ ? loQ : v > hiQ ? hiQ : v;
}

// ── ids ──────────────────────────────────────────────────────────────────────
// Generated ids, never array indices (10 §A5 correction 5). This is what makes
// crossover trivial at step F: no re-indexing, no dangling pointers to repair.

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function makeId(rng, prefix) {
  let s = prefix;
  for (let i = 0; i < 5; i++) s += ID_ALPHABET[rng.int(36)];
  return s;
}

// ── construction helpers ─────────────────────────────────────────────────────

export function makeNode(id, fields) {
  return {
    id,
    dims: fields.dims.map(q),
    density: q(fields.density),
    recursiveLimit: fields.recursiveLimit | 0,
    joint: {
      type: fields.joint.type,
      angleLimits: fields.joint.angleLimits.map(q),
      phaseLag: q(fields.joint.phaseLag),
    },
    colorGenes: {
      hueShift: q(fields.colorGenes.hueShift),
      valueShift: q(fields.colorGenes.valueShift),
      patternPhase: q(fields.colorGenes.patternPhase),
    },
    // DEFAULTS TO NONE, and absent is the neutral state rather than an error: a
    // node with no sites is a node with no receptors, which is what every
    // migrated genome and every hand-built tool literal is. `validateGenome`
    // still holds the range and the cap once they exist.
    sites: (fields.sites ?? []).map(makeSite),
  };
}

/** One organ attachment point: a face of the body, and (u,v) on that face. */
export function makeSite(fields) {
  return { face: fields.face | 0, at: fields.at.map(q) };
}

/**
 * The mouth `mouthsOf()` used to DERIVE: the leading face of the root body's own
 * longest axis, dead centre — "a head, by the only definition available without
 * a gene to say otherwise".
 *
 * ONE DEFINITION, used by both the factory and the 4->5 migration, so a new
 * genome and a migrated one cannot disagree about where a mouth starts. Faces
 * are `0:-X 1:-Y 2:-Z 3:+X 4:+Y 5:+Z` (morphogen.js:18), so the +axis face is
 * `axis + 3`, and morphogen's face arithmetic resolves `at: [0,0]` on it to
 * `local[axis] = dims[axis] * 0.5` — the old expression exactly.
 */
export function defaultMouth(rootNode) {
  const d = rootNode.dims;
  const axis = d[2] >= d[0] && d[2] >= d[1] ? 2 : (d[1] >= d[0] ? 1 : 0);
  return { face: axis + 3, at: [0, 0] };
}

export function makeConnection(id, fields) {
  return {
    id,
    parentNodeId: fields.parentNodeId,
    childNodeId: fields.childNodeId,
    parentFace: fields.parentFace | 0,
    position: fields.position.map(q),
    orientation: fields.orientation.map(q),
    scale: fields.scale.map(q),
    reflectX: !!fields.reflectX,
    reflectY: !!fields.reflectY,
    reflectZ: !!fields.reflectZ,
    terminalOnly: !!fields.terminalOnly,
  };
}

// ── canonical serialisation ──────────────────────────────────────────────────
//
// Fields are emitted in a FIXED order by explicit construction, never by
// iterating object keys. That is what makes serialise -> deserialise -> serialise
// byte-identical (gate assertion A14 #3) regardless of how a genome was built.
//
// `controller.jointGenes` is stored keyed by nodeId and emitted sorted by nodeId.
// 10 §A7 writes it as a bare array, but correction 5 forbids referencing nodes by
// array index — a positional array would silently rebind every joint's motion the
// first time crossover reorders nodes. DEVIATION, reported.

function canonNode(n) {
  return {
    id: n.id,
    dims: n.dims.slice(),
    density: n.density,
    recursiveLimit: n.recursiveLimit,
    joint: { type: n.joint.type, angleLimits: n.joint.angleLimits.slice(), phaseLag: n.joint.phaseLag },
    colorGenes: { hueShift: n.colorGenes.hueShift, valueShift: n.colorGenes.valueShift, patternPhase: n.colorGenes.patternPhase },
    // Emitted in the node's declared order, like everything else here. Sites are
    // NOT sorted: their order is genetic (crossover and mutation act on the
    // list), so re-ordering them would change the genome rather than normalise it.
    sites: (n.sites ?? []).map((s) => ({ face: s.face, at: s.at.slice() })),
  };
}

function canonConnection(c) {
  return {
    id: c.id,
    parentNodeId: c.parentNodeId,
    childNodeId: c.childNodeId,
    parentFace: c.parentFace,
    position: c.position.slice(),
    orientation: c.orientation.slice(),
    scale: c.scale.slice(),
    reflectX: c.reflectX, reflectY: c.reflectY, reflectZ: c.reflectZ,
    terminalOnly: c.terminalOnly,
  };
}

export function canonical(g) {
  return {
    version: g.version,
    seed: g.seed,
    rootNodeId: g.rootNodeId,
    // TOP LEVEL, NOT ON A NODE — see the CAPS note on why there is exactly one.
    mouth: { face: g.mouth.face, at: g.mouth.at.slice() },
    nodes: g.nodes.map(canonNode),
    connections: g.connections.map(canonConnection),
    material: {
      hue: g.material.hue,
      hueVariance: g.material.hueVariance,
      patternScale: g.material.patternScale,
      patternContrast: g.material.patternContrast,
      stripeAnisotropy: g.material.stripeAnisotropy,
      iridescence: g.material.iridescence,
    },
    controller: {
      omega: g.controller.omega,
      preyGain: g.controller.preyGain,
      threatGain: g.controller.threatGain,
      phaseBase: g.controller.phaseBase,
      phaseSlope: g.controller.phaseSlope,
      proprioGain: g.controller.proprioGain,
      chemoGain: g.controller.chemoGain,
      jointGenes: Object.keys(g.controller.jointGenes).sort().map((nodeId) => ({
        nodeId,
        amplitude: g.controller.jointGenes[nodeId].amplitude,
        bias: g.controller.jointGenes[nodeId].bias,
        freqMult: g.controller.jointGenes[nodeId].freqMult,
      })),
    },
    social: {
      trophic: g.social.trophic,
      boldness: g.social.boldness,
      cohesion: g.social.cohesion,
      separation: g.social.separation,
      alignment: g.social.alignment,
      separationRadius: g.social.separationRadius,
    },
  };
}

export function serialise(g) {
  return JSON.stringify(canonical(g));
}

/**
 * parse -> identify schema -> migrate -> VALIDATE -> return (H6).
 *
 * The validate step was missing, so this function's contract was "returns
 * something shaped like a genome, probably". Everything that arrives here is
 * EXTERNAL — a shared file, a pasted fiche, a record from an older build — and
 * the persistence philosophy is that external data is rejected cleanly or
 * accepted whole, never partially interpreted. A parsed-but-unvalidated genome
 * must not reach the engine, because the next thing that touches it is
 * morphogenesis, where a missing field is a crash with no provenance.
 */
export function deserialise(text) {
  const raw = typeof text === 'string' ? JSON.parse(text) : text;
  if (typeof raw?.version !== 'number') throw new Error('genome: missing version');
  const g = migrate(raw);

  // Shape before content: `for (const jg of ...)` on a non-iterable throws a
  // TypeError about Symbol.iterator, which tells a player nothing at all.
  if (!Array.isArray(g?.controller?.jointGenes)) {
    throw new Error('genome: controller.jointGenes must be an array');
  }
  // Rebuild jointGenes as a map keyed by nodeId; canonical() re-emits it sorted.
  const jointGenes = {};
  for (const jg of g.controller.jointGenes) {
    jointGenes[jg.nodeId] = { amplitude: jg.amplitude, bias: jg.bias, freqMult: jg.freqMult };
  }
  const hydrated = { ...g, controller: { ...g.controller, jointGenes } };

  const v = validateGenome(hydrated);
  if (!v.ok) throw new Error(`genome is not valid: ${v.errors.join('; ')}`);
  return hydrated;
}

// ── hash ─────────────────────────────────────────────────────────────────────

/**
 * 64-bit, as two FNV-1a lanes over different framings of the same canonical text.
 *
 * WHY NOT 32-BIT: genomeHash keys the capability-record cache. At 32 bits the
 * birthday bound is ~65 000 genomes, and a collision does not corrupt anything
 * visibly — it silently returns another creature's measured capabilities. A
 * player breeding across many sessions reaches that order. 16 hex characters cost
 * nothing and remove the failure mode.
 */
export function genomeHash(g) {
  const s = serialise(g);
  return hex8(fnv1a(s)) + hex8(fnv1a(`${s.length}|${s}|${GENOME_V}`));
}

// ── migration registry ───────────────────────────────────────────────────────
// 01 §8: keyed by GENOME_V, run forward on load. A genome above the build version
// is rejected by trunk/store.js (N10) before it reaches here.

const MIGRATIONS = {
  /**
   * 1 -> 2 · REAL, not a no-op (30 §4 B1).
   * A3 adds the two steering gains; both initialise to 0, which preserves a v1
   * creature's behaviour exactly — zero gain means the sensor term contributes
   * nothing to turnBias, so the body swims as it did before sensors existed.
   * The social block and node colorGenes did not exist at v1 either and are
   * filled with neutral values rather than being left absent.
   */
  1: (g) => ({
    ...g,
    version: 2,
    controller: { ...g.controller, preyGain: 0, threatGain: 0 },
    social: g.social ?? {
      trophic: 0, boldness: 0.5, cohesion: 0.5,
      separation: 0.5, alignment: 0.5, separationRadius: 1.5,
    },
    nodes: g.nodes.map((n) => ({
      ...n,
      colorGenes: n.colorGenes && 'hueShift' in n.colorGenes
        ? n.colorGenes
        : { hueShift: 0, valueShift: 0, patternPhase: 0 },
    })),
  }),

  /**
   * 2 -> 3 · A3, THE POSITIONAL PHASE GRADIENT. Real, and bit-identical.
   *
   * Before this, every node drew `joint.phaseLag` independently and
   * controller.js accumulated them along the tree, so phase along a chain was a
   * RANDOM WALK rather than a gradient — the controller was never asking for a
   * coordinated wave. Measured commanded inter-joint coherence 0.615, flat over
   * 300 s; after A2 put chains in the corpus it rose to 0.786, but the branched
   * bodies still read 0.08-0.15 while spines read 0.96-0.999. A spine was
   * already coherent BY ACCIDENT: one node repeated means one lag repeated,
   * which is a constant increment, which is a travelling wave. A body of
   * distinct nodes had nothing holding its increments together.
   *
   * The lag is now `phaseBase + phaseSlope * depth + phaseLag`, with `phaseLag`
   * demoted to a per-node DEVIATION.
   *
   * NEUTRAL AT INSERTION. Setting both coefficients to 0 leaves the lag equal to
   * the old `phaseLag` exactly, so a migrated v2 genome reproduces its v2 traces
   * to the bit. The coefficients do nothing until mutation moves them, which is
   * the discipline every organ in this project is held to.
   */
  2: (g) => ({
    ...g,
    version: 3,
    controller: { ...g.controller, phaseBase: 0, phaseSlope: 0 },
  }),

  /**
   * 3 -> 4 - A5, PROPRIOCEPTION. Real, and bit-identical.
   *
   * Before this the CPG received nothing back from the body: it was a pure
   * function of (genome, t), so a joint that could not reach its commanded angle
   * was simply ignored by the oscillator driving it. `proprioGain` is the gain on
   * the entrainment term.
   *
   * NEUTRAL AT INSERTION. K = 0 is open loop, and physics.js does not even run
   * the integrator in that case - it keeps the closed-form phase argument - so a
   * migrated genome reproduces its previous traces to the bit rather than to
   * within floating-point accumulation.
   */
  3: (g) => ({
    ...g,
    version: 4,
    controller: { ...g.controller, proprioGain: 0 },
  }),

  /**
   * 4 -> 5 · ORGAN PLACEMENT. Real, and bit-identical.
   *
   * Before this, `mouthsOf()` DERIVED the single mouth: root body, leading face
   * of its own longest axis, dead centre — "a head, by the only definition
   * available without a gene to say otherwise". Placement is now genetic, and
   * `node.sites` opens the same shape to receptors.
   *
   * NEUTRAL AT INSERTION, and the arithmetic is worth stating because it is what
   * makes that true rather than approximately true. Faces are indexed
   * `0:-X 1:-Y 2:-Z 3:+X 4:+Y 5:+Z` (morphogen.js:18), so the +axis face is
   * `axis + 3`; `at: [0,0]` is its centre; and morphogen's own face arithmetic
   * then resolves that to `local[axis] = dims[axis] * 0.5`, which is EXACTLY the
   * expression `mouthsOf` used. Every migrated creature keeps the mouth it had,
   * in the same place, to the bit — the whole 46-specimen Atlas and a
   * generation-68 lineage included.
   *
   * The root BODY's dims are the root NODE's dims verbatim (morphogen.js:71,
   * `cumulativeScale: [1,1,1]`), so this is computable from the genome alone and
   * does not need a morphogenesis pass to migrate.
   *
   * Once genetic it stops tracking the longest axis, which is the point: a
   * mutation may move the mouth somewhere the derivation would never have put it.
   *
   * `sites: []` and `chemoGain: 0` are the blind state. Nothing senses until a
   * mutation puts a site on a node AND moves the gain off zero.
   */
  4: (g) => ({
    ...g,
    version: 5,
    mouth: defaultMouth(g.nodes.find((n) => n.id === g.rootNodeId) ?? g.nodes[0]),
    nodes: g.nodes.map((n) => ({ ...n, sites: [] })),
    controller: { ...g.controller, chemoGain: 0 },
  }),
};

export function migrate(g, target = GENOME_V) {
  if (g.version > target) {
    throw new Error(`genome version ${g.version} is newer than this build (${target})`);
  }
  let out = g;
  for (let v = out.version; v < target; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`no genome migration registered for ${v} -> ${v + 1}`);
    out = step(out);
  }
  return out;
}

// ── validation ───────────────────────────────────────────────────────────────

const inRange = (x, [lo, hi]) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;

/**
 * Structural and range validation. Returns errors rather than throwing: a
 * malformed genome from a shared file is an expected event, not a crash (01 §9).
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validateGenome(g) {
  const e = [];
  if (!g || typeof g !== 'object') return { ok: false, errors: ['genome is not an object'] };
  if (g.version !== GENOME_V) e.push(`version ${g.version}, expected ${GENOME_V}`);
  // H6 — the message said uint32; the check only said "a non-negative integer",
  // so 2^53 passed as a seed and then silently lost precision in the PRNG.
  if (!Number.isInteger(g.seed) || g.seed < 0 || g.seed > 0xFFFFFFFF) e.push(`seed is not a uint32: ${g.seed}`);
  if (!Array.isArray(g.nodes) || g.nodes.length === 0) e.push('nodes is empty');
  if (!Array.isArray(g.connections)) e.push('connections is not an array');
  if (e.length) return { ok: false, errors: e };

  const ids = new Set();
  for (const n of g.nodes) {
    if (ids.has(n.id)) e.push(`duplicate node id: ${n.id}`);
    ids.add(n.id);
    if (!Array.isArray(n.dims) || n.dims.length !== 3) e.push(`node ${n.id}: dims must be 3 values`);
    else n.dims.forEach((d, i) => { if (!inRange(d, RANGE.dim)) e.push(`node ${n.id}: dims[${i}] = ${d} out of range`); });
    if (!inRange(n.density, RANGE.density)) e.push(`node ${n.id}: density ${n.density} out of range`);
    if (!Number.isInteger(n.recursiveLimit) || !inRange(n.recursiveLimit, RANGE.recursiveLimit)) e.push(`node ${n.id}: recursiveLimit ${n.recursiveLimit}`);
    if (!JOINT_TYPES.includes(n.joint?.type)) e.push(`node ${n.id}: joint type ${n.joint?.type}`);
    // H6 — ARITY IS CHECKED, NOT ASSUMED. `n.joint?.angleLimits?.forEach(...)`
    // ran zero times when the array was MISSING and reported nothing, so a
    // genome with no angle limits at all validated clean and then crashed in
    // morphogenesis. Optional chaining turns an absent field into a silent pass,
    // which is the opposite of what a validator is for.
    // H6 — ARITY IS CHECKED, NOT ASSUMED. `n.joint?.angleLimits?.forEach(...)`
    // ran zero times when the array was MISSING and reported nothing, so a
    // genome with no angle limits at all validated clean and then crashed in
    // morphogenesis. Optional chaining turns an absent field into a silent pass,
    // which is the opposite of what a validator is for.
    //
    // THREE SCALARS, NOT THREE PAIRS. Each entry is a half-range applied
    // symmetrically about zero — physics.js does setLimits(-a, +a) — so
    // RANGE.angleLimit starts at 0 and there is no min-exceeds-max case to
    // check. (Worth stating: an outside reading of this field as [min, max]
    // pairs is a natural mistake, and one that would silently change what
    // ANGLE_AXES means.)
    if (!Array.isArray(n.joint?.angleLimits) || n.joint.angleLimits.length !== ANGLE_AXES) {
      e.push(`node ${n.id}: angleLimits must be ${ANGLE_AXES} values, got ${n.joint?.angleLimits?.length ?? 'none'}`);
    } else {
      n.joint.angleLimits.forEach((a, i) => { if (!inRange(a, RANGE.angleLimit)) e.push(`node ${n.id}: angleLimits[${i}] = ${a}`); });
    }
    if (!inRange(n.joint?.phaseLag, RANGE.phaseLag)) e.push(`node ${n.id}: phaseLag ${n.joint?.phaseLag}`);
    for (const k of ['hueShift', 'valueShift', 'patternPhase']) {
      if (!inRange(n.colorGenes?.[k], RANGE[k])) e.push(`node ${n.id}: colorGenes.${k} = ${n.colorGenes?.[k]}`);
    }
    // SITES. Same arity discipline as angleLimits and connection.position: an
    // absent array is checked for, not optional-chained past, because a missing
    // field that iterates zero times validates clean and crashes later.
    if (!Array.isArray(n.sites)) e.push(`node ${n.id}: sites must be an array, got ${n.sites === undefined ? 'none' : typeof n.sites}`);
    else {
      if (n.sites.length > CAPS.maxSitesPerNode) e.push(`node ${n.id}: ${n.sites.length} sites, cap is ${CAPS.maxSitesPerNode}`);
      n.sites.forEach((s, si) => {
        if (!Number.isInteger(s?.face) || s.face < 0 || s.face > 5) e.push(`node ${n.id}: sites[${si}].face ${s?.face}`);
        if (!Array.isArray(s?.at) || s.at.length !== 2) {
          e.push(`node ${n.id}: sites[${si}].at must be 2 values, got ${s?.at?.length ?? 'none'}`);
        } else {
          s.at.forEach((v, i) => { if (!inRange(v, RANGE.siteAt)) e.push(`node ${n.id}: sites[${si}].at[${i}] = ${v}`); });
        }
      });
    }
  }

  // THE MOUTH. One, on the root, placement genic — see the CAPS note.
  if (!Number.isInteger(g.mouth?.face) || g.mouth.face < 0 || g.mouth.face > 5) e.push(`mouth.face ${g.mouth?.face}`);
  if (!Array.isArray(g.mouth?.at) || g.mouth.at.length !== 2) {
    e.push(`mouth.at must be 2 values, got ${g.mouth?.at?.length ?? 'none'}`);
  } else {
    g.mouth.at.forEach((v, i) => { if (!inRange(v, RANGE.siteAt)) e.push(`mouth.at[${i}] = ${v}`); });
  }

  if (!ids.has(g.rootNodeId)) e.push(`rootNodeId ${g.rootNodeId} is not a node`);

  const connIds = new Set();
  const outDegree = new Map();
  for (const c of g.connections) {
    if (connIds.has(c.id)) e.push(`duplicate connection id: ${c.id}`);
    connIds.add(c.id);
    if (!ids.has(c.parentNodeId)) e.push(`connection ${c.id}: unknown parent ${c.parentNodeId}`);
    if (!ids.has(c.childNodeId)) e.push(`connection ${c.id}: unknown child ${c.childNodeId}`);
    outDegree.set(c.parentNodeId, (outDegree.get(c.parentNodeId) || 0) + 1);
    if (!Number.isInteger(c.parentFace) || c.parentFace < 0 || c.parentFace > 5) e.push(`connection ${c.id}: parentFace ${c.parentFace}`);
    // H6 — same hole, same fix: a missing array iterated zero times and passed.
    for (const [field, arity] of [['position', 2], ['orientation', 3], ['scale', 3]]) {
      const arr = c[field];
      if (!Array.isArray(arr) || arr.length !== arity) {
        e.push(`connection ${c.id}: ${field} must be ${arity} values, got ${arr?.length ?? 'none'}`);
        continue;
      }
      arr.forEach((v, i) => { if (!inRange(v, RANGE[field])) e.push(`connection ${c.id}: ${field}[${i}] = ${v}`); });
    }
    for (const k of ['reflectX', 'reflectY', 'reflectZ', 'terminalOnly']) {
      if (typeof c[k] !== 'boolean') e.push(`connection ${c.id}: ${k} is not a boolean`);
    }
  }
  for (const [nodeId, d] of outDegree) {
    if (d > CAPS.maxConnPerNode) e.push(`node ${nodeId}: ${d} outgoing connections, cap is ${CAPS.maxConnPerNode}`);
  }

  for (const k of ['omega', 'preyGain', 'threatGain', 'phaseBase', 'phaseSlope', 'proprioGain', 'chemoGain']) {
    if (!inRange(g.controller?.[k], RANGE[k])) e.push(`controller.${k} = ${g.controller?.[k]}`);
  }
  const jg = g.controller?.jointGenes || {};
  for (const n of g.nodes) {
    const j = jg[n.id];
    if (!j) { e.push(`controller.jointGenes missing node ${n.id}`); continue; }
    if (!inRange(j.amplitude, RANGE.amplitude)) e.push(`jointGenes[${n.id}].amplitude = ${j.amplitude}`);
    if (!inRange(j.bias, RANGE.bias)) e.push(`jointGenes[${n.id}].bias = ${j.bias}`);
    if (!FREQ_MULTS.includes(j.freqMult)) e.push(`jointGenes[${n.id}].freqMult = ${j.freqMult}`);
  }
  for (const k of Object.keys(jg)) if (!ids.has(k)) e.push(`controller.jointGenes has orphan node ${k}`);

  for (const k of ['hue', 'hueVariance', 'patternScale', 'patternContrast', 'stripeAnisotropy', 'iridescence']) {
    if (!inRange(g.material?.[k], RANGE[k])) e.push(`material.${k} = ${g.material?.[k]}`);
  }
  for (const k of ['trophic', 'boldness', 'cohesion', 'separation', 'alignment', 'separationRadius']) {
    if (!inRange(g.social?.[k], RANGE[k])) e.push(`social.${k} = ${g.social?.[k]}`);
  }

  return { ok: e.length === 0, errors: e };
}

/**
 * Reachability from the root, following connections as directed edges.
 * A self-referential or ancestor-pointing connection is RECURSION, not a cycle
 * error (10 §A5): morphogenesis bounds it with recursiveLimit.
 * @returns {{connected:boolean, reachable:Set<string>, orphans:string[]}}
 */
export function reachability(g) {
  const adj = new Map();
  for (const c of g.connections) {
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
  const orphans = g.nodes.map(n => n.id).filter(id => !seen.has(id));
  return { connected: orphans.length === 0, reachable: seen, orphans };
}

/** Every numeric gene, flattened — used by the gate and by the mutation operators. */
export function geneValues(g) {
  const out = [];
  for (const n of g.nodes) {
    out.push(...n.dims, n.density, ...n.joint.angleLimits, n.joint.phaseLag,
      n.colorGenes.hueShift, n.colorGenes.valueShift, n.colorGenes.patternPhase);
    for (const s of n.sites ?? []) out.push(...s.at);
  }
  for (const c of g.connections) out.push(...c.position, ...c.orientation, ...c.scale);
  out.push(...g.mouth.at);
  out.push(g.controller.omega, g.controller.preyGain, g.controller.threatGain,
    g.controller.phaseBase, g.controller.phaseSlope, g.controller.proprioGain,
    g.controller.chemoGain);
  for (const k of Object.keys(g.controller.jointGenes)) {
    out.push(g.controller.jointGenes[k].amplitude, g.controller.jointGenes[k].bias);
  }
  out.push(...Object.values(g.material), ...Object.values(g.social));
  return out;
}

/**
 * THE PRODUCER for the six `Species` fields that 03 §3 declares come from the
 * genome. Named here so gate/l1.js can assert that the declaration in
 * contracts/species.js and the genome schema agree, rather than trusting a
 * comment. Closes the obligation A0 opened.
 */
export function genomeSourcedSpeciesFields(g) {
  return {
    trophic: g.social.trophic,
    boldness: g.social.boldness,
    cohesion: g.social.cohesion,
    separation: g.social.separation,
    alignment: g.social.alignment,
    separationRadius: g.social.separationRadius,
  };
}
