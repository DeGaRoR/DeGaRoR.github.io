// worlds/seeds.js — THE AUTHORED CREATURE LIBRARY.
//
// Hand-written genomes, in the same schema the factory emits, so mutation,
// breeding, serialisation, hashing and the fauna loader accept them unchanged.
// `deserialise` already exists and the residents already use it; what was
// missing was somewhere for authored bodies to live.
//
// EVERY ENTRY MUST VALIDATE. `validateGenome` enforces engine/l1/genome.js
// RANGE, and three of those bounds bite here and are easy to miss:
//
//   recursiveLimit  [1, 6]        a chain is capped at 7 segments, not 13
//   omega           [0.5, 6.0]    rad/s
//   angleLimit      [0, PI/2]     a half-range, applied symmetrically
//
// This is not the same thing as SLICE_LIMITS, which clamps only the RANDOM
// factory and never sees a hand-written genome. Session 10 measured a 12-segment
// chain at omega 8 before checking either, and both numbers were illegal — the
// physics was real, the creature was not expressible. `tools/_atlas.mjs` runs
// validate + serialise -> deserialise -> serialise on every entry so that cannot
// happen again silently.
//
// PARENT FACE IS THE WHOLE GAME FOR A CHAIN. `makeJointData` attaches a child by
// its own -Z face, so a self-connection on the parent's +X face (parentFace 0)
// is a ninety-degree turn: the chain becomes a staircase, spirals into itself,
// and obbOverlap rejects the fourth segment. Attach on +Z (parentFace 5) and the
// same slice builds a straight chain. `staircase` below is kept deliberately as
// the counter-example.

import { GENOME_V } from '../contracts/versions.js';

const colour = (hueShift = 0, valueShift = 0, patternPhase = 0) => ({ hueShift, valueShift, patternPhase });

/**
 * A straight self-connected chain — the undulatory body plan.
 *
 * `dims` puts the long axis on Z, which is the axis the child grows along, so
 * every segment continues the line instead of turning a corner.
 */
function chain({
  id, name, note,
  segs = 6, dims = [0.5, 0.35, 1.2], taper = 0.95, face = 5,
  lag = Math.PI / 2, amp = 0.8, omega = 4.0, angleLimit = 0.9,
  fin = null, hue = 0.55,
} = {}) {
  const nodes = [{
    id: 'seg', dims, density: 1, recursiveLimit: segs,
    joint: { type: 'revolute', angleLimits: [angleLimit, angleLimit, angleLimit], phaseLag: lag },
    colorGenes: colour(0, 0, 0),
    sites: [],           // GENOME_V 5 — no receptors; see the controller note below
  }];
  const connections = [{
    id: 'c_self', parentNodeId: 'seg', childNodeId: 'seg', parentFace: face,
    position: [0, 0], orientation: [0, 0, 0], scale: [taper, taper, taper],
    reflectX: false, reflectY: false, reflectZ: false, terminalOnly: false,
  }];
  const jointGenes = { seg: { amplitude: amp, bias: 0, freqMult: 1 } };
  if (fin) {
    nodes.push({
      id: 'fin', dims: fin.dims, density: 1, recursiveLimit: 1,
      joint: { type: 'revolute', angleLimits: [0.7, 0.7, 0.7], phaseLag: 0 },
      colorGenes: colour(0.08, -0.1, 0.5),
      sites: [],
    });
    connections.push({
      id: 'c_fin', parentNodeId: 'seg', childNodeId: 'fin', parentFace: fin.face ?? 5,
      position: [0, 0], orientation: [0, 0, 0], scale: [1, 1, 1],
      reflectX: false, reflectY: false, reflectZ: !!fin.paired, terminalOnly: true,
    });
    jointGenes.fin = { amplitude: fin.amp ?? 0.6, bias: 0, freqMult: 1 };
  }
  return {
    id, name, note,
    genome: {
      version: GENOME_V, seed: 0, rootNodeId: 'seg', nodes, connections,
      // GENOME_V 5 — the mouth, stated rather than derived. `dims` is longest on
      // Z for every seed in this file, so face 5 (+Z) at the centre is exactly
      // where `mouthsOf` used to put it: these animals are unchanged.
      mouth: { face: 5, at: [0, 0] },
      /**
       * GENOME_V 6 — the proportion gradient, and these animals were ALREADY
       * built to it by hand. Every seed's connection scale is `[taper, taper,
       * taper]`, isotropic, drawn from one number: the authored good swimmers
       * never had the per-axis independence the random factory had, which is a
       * quiet piece of evidence for the gene existing at all.
       *
       * Left at the NEUTRAL 0 / 1 rather than the descriptive 1 / taper, so these
       * literals stay bit-identical through the resolver's early return. Setting
       * t = 1 would in fact produce the same dims — geomean of [s,s,s] is s — but
       * "provably unchanged" beats "unchanged if the arithmetic is right".
       */
      morphology: { taperStrength: 0, taperRatio: 1 },
      /**
       * THESE ARE REFERENCES, AND NOW THEY SAY SO.
       *
       * An authored creature did not survive trial and error; it was designed to
       * work. That makes the library invaluable as a benchmark and as breeding
       * stock, and dangerous as evidence — two of the six opening tank slots are
       * authored eels, so a run that improves on them has shown that evolution
       * IMPROVES a competent founder, which is a much weaker claim than evolution
       * DISCOVERING swimming. Before this field the distinction was unrecoverable
       * one generation in.
       *
       * `founder` is inherited through mutation and crossover, so a descendant
       * fifty generations down still reports the eel it came from. A seed may
       * enter the population and must never bypass the objective.
       */
      origin: { founder: id, generations: 0 },
      material: {
        hue, hueVariance: 0.08, patternScale: 3.0, patternContrast: 0.4,
        stripeAnisotropy: 0.7, iridescence: 0.15,
      },
      // EVERY CONTROLLER GENE MUST BE PRESENT HERE, and the reason is that
      // `version: GENOME_V` above is a CLAIM about this literal.
      //
      // These seeds stamped themselves at the CURRENT version while carrying a
      // v2 controller block. Nothing corrected them: `migrate` sees version 4,
      // decides there is nothing to do, and the genome sails on missing three
      // fields. `canonical()` then emits them as `undefined`, JSON drops them,
      // and the hash of the seed differs from the hash of the SAME animal loaded
      // from a store and migrated forward — which is exactly how the Atlas
      // acquired a second Eel, Darter, Drifter, Flapper and Paddletail the
      // moment GENOME_V moved. `validateGenome` would also have rejected all
      // five.
      //
      // So: a gene added to the schema is added HERE in the same edit. The
      // alternative — declaring `version: 2` and letting the migration fill them
      // in — also works, but it makes the literal permanently a lie about what
      // it contains, and the duplicate returns the first time someone "tidies"
      // the version back up.
      controller: {
        omega,
        preyGain: 0.6,
        threatGain: -0.4,
        phaseBase: 0,        // A3 — neutral: no positional phase gradient
        phaseSlope: 0,       // A3
        proprioGain: 0,      // A5 — neutral: open loop
        chemoGain: 0,        // GENOME_V 5 — neutral: blind
        // GENOME_V 7 — neutral: no second steering channel. These eels are a
        // chain of PARALLEL hinges, so their joint-axis spread is 1.000 / 0.000
        // / 0.000 and the channel is inert on them whatever the gain: there is
        // no second bend axis to project onto. Declared anyway, because the
        // standing rule is that a gene added to the schema is added to this file
        // in the same edit — `version: GENOME_V` above is a CLAIM about this
        // literal, and a missing field would make it a false one.
        preyGain2: 0,
        threatGain2: 0,
        jointGenes,
      },
      social: {
        trophic: 0.4, boldness: 0.5, cohesion: 0.3, separation: 0.5,
        alignment: 0.4, separationRadius: 1.5,
      },
    },
  };
}

/**
 * A BELL WITH A FOUR-FOLD TENTACLE CROWN — the first radial creature here.
 *
 * WHY IT EXISTS, AND IT IS A TEST BEFORE IT IS AN ANIMAL. `factory.js` has cited
 * `jelly`, "a bell with a four-fold tentacle crown", as "the first radial creature
 * in the project" since `maxReflectionAxes` was raised to 3 — while this library
 * remained five eels and a staircase. A comment describing a creature that does
 * not exist is the same class of defect as a comment describing a constant that
 * does not hold, and this session has already been bitten by three of those.
 *
 * WHAT IT IS FOR. The open question is whether four-fold symmetry READS as a
 * medusa or as a box with four box-arms. That is an hour of work to answer
 * empirically and it gates a much larger decision: if it reads badly, the finding
 * is that symmetry legibility is a `proto/skin/` problem and any genome-schema
 * work on radial symmetry is premature. Look at it before believing either.
 *
 * WHY FOUR AND NOT FIVE. Reflection gives orders 1, 2, 4, 8 and nothing else — it
 * is the dihedral group of a rectangle, not C(n) — so an ODD count is unreachable
 * at any setting. Four-fold is the one case where the encoding and nature already
 * agree: Aurelia is tetramerous and ctenophores are eight-fold. A starfish is not
 * expressible and will not become so without a rotational repeat gene.
 *
 * THE CROWN IS ONE CONNECTION. `reflectX` and `reflectY` on a single connection
 * multiply it into four instances at (+-u, +-v) of the SAME parent face, so the
 * four tentacles are one gene and stay symmetric under mutation. Spreading them
 * over four connections would make them four independent genes that drift apart —
 * which is why radial symmetry only survives mutation along a reflection axis.
 *
 * TENTACLES BEAT IN UNISON (`lag: 0`), which is both the anatomy — a medusa
 * contracts its bell as one — and the measured better answer: `eel-unison` is the
 * only creature in this library with a usable turn rate (turnRate3d 15.95 deg/s at
 * steeringAuthority 1.000, and the only one of seven that `tools/_zlight.mjs` finds
 * the light with). The bell itself is a rigid box and cannot contract; the crown is
 * the only thing here that can produce thrust.
 */
function medusa({
  id, name, note,
  bell = [1.5, 1.5, 0.6], tent = [0.24, 0.24, 0.8],
  segs = 3, taper = 0.9, spread = 0.6,
  lag = 0, amp = 0.75, omega = 3.2, angleLimit = 0.8, hue = 0.78,
} = {}) {
  const nodes = [
    {
      id: 'bell', dims: bell, density: 1, recursiveLimit: 1,
      joint: { type: 'revolute', angleLimits: [angleLimit, angleLimit, angleLimit], phaseLag: 0 },
      colorGenes: colour(0, 0.05, 0),
      sites: [],
    },
    {
      id: 'tent', dims: tent, density: 1, recursiveLimit: segs,
      joint: { type: 'revolute', angleLimits: [angleLimit, angleLimit, angleLimit], phaseLag: lag },
      colorGenes: colour(0.02, -0.1, 0.3),
      sites: [],
    },
  ];
  const connections = [
    // THE CROWN. Face 2 is -Z, the trailing face: the bell leads and the tentacles
    // stream behind it, which is how a medusa swims and also puts the crown behind
    // the mouth. `position` off-centre in BOTH axes is what makes the four
    // reflected copies land at four distinct corners rather than on top of
    // each other.
    {
      id: 'c_crown', parentNodeId: 'bell', childNodeId: 'tent', parentFace: 2,
      position: [spread, spread], orientation: [0, 0, 0], scale: [taper, taper, taper],
      reflectX: true, reflectY: true, reflectZ: false, terminalOnly: false,
    },
    // Each tentacle extends itself. Face 5 (+Z) because a child attaches by its
    // OWN -Z face, so +Z continues the line away from the bell; any other face
    // turns a corner and `obbOverlap` rejects the third segment. That is the
    // `staircase` lesson at the head of this file.
    {
      id: 'c_tent', parentNodeId: 'tent', childNodeId: 'tent', parentFace: 5,
      position: [0, 0], orientation: [0, 0, 0], scale: [taper, taper, taper],
      reflectX: false, reflectY: false, reflectZ: false, terminalOnly: false,
    },
  ];
  return {
    id, name, note,
    genome: {
      version: GENOME_V, seed: 0, rootNodeId: 'bell', nodes, connections,
      // ON THE TRAILING FACE, among the tentacles — the subumbrellar mouth, which
      // is where a medusa's actually is. The chains put theirs on +Z because they
      // swim head-first into food; this one traps food in the crown and brings it
      // inward, so +Z would be the wrong end of the animal.
      mouth: { face: 2, at: [0, 0] },
      morphology: { taperStrength: 0, taperRatio: 1 },
      origin: { founder: id, generations: 0 },
      material: {
        hue, hueVariance: 0.12, patternScale: 1.6, patternContrast: 0.25,
        stripeAnisotropy: 0.2, iridescence: 0.55,
      },
      controller: {
        omega,
        preyGain: 0.6,
        threatGain: -0.4,
        phaseBase: 0,
        phaseSlope: 0,
        proprioGain: 0,
        chemoGain: 0,
        preyGain2: 0,        // GENOME_V 7 — neutral
        threatGain2: 0,
        jointGenes: {
          bell: { amplitude: 0, bias: 0, freqMult: 1 },
          tent: { amplitude: amp, bias: 0, freqMult: 1 },
        },
      },
      social: {
        trophic: 0.2, boldness: 0.3, cohesion: 0.4, separation: 0.6,
        alignment: 0.3, separationRadius: 2.0,
      },
    },
  };
}

/**
 * THE LIBRARY. Order is stable and is part of the file: an Atlas that reorders
 * itself between builds is not an atlas.
 */
export const SEEDS = [
  chain({
    id: 'eel', name: 'Eel',
    note: 'The reference undulator. 7 segments, pi/2 travelling wave. Measured at efficiency 0.9+ through the solver motor — the first body in this project to swim rather than vibrate.',
    segs: 6, lag: Math.PI / 2, omega: 4, hue: 0.55,
  }),
  chain({
    id: 'eel-fast', name: 'Darter',
    note: 'Same body, shorter wave (pi/4) and the fastest legal frequency. Trades efficiency for speed — the pi/4 wave is the speed optimum, pi/2 the efficiency optimum.',
    segs: 6, lag: Math.PI / 4, omega: 6, hue: 0.08,
  }),
  chain({
    id: 'eel-slow', name: 'Drifter',
    note: 'Long wave, low frequency. The cheapest swimmer in the library and the cleanest track.',
    segs: 6, lag: Math.PI / 2, omega: 1.5, amp: 0.9, hue: 0.32,
  }),
  chain({
    id: 'eel-unison', name: 'Flapper',
    note: 'CONTROL. Same body, zero phase lag: every joint beats together. Must be markedly less efficient than the eel, or the fluid model is wrong. This is the assertion HYDRODYNAMICS 56 asks for, as a creature.',
    segs: 6, lag: 0, omega: 4, hue: 0.75,
  }),
  chain({
    id: 'eel-finned', name: 'Paddletail',
    note: 'The eel with a terminal caudal fin — a broad flat plate on the last segment, driven in phase with it.',
    segs: 5, lag: Math.PI / 2, omega: 4, hue: 0.62,
    fin: { dims: [1.4, 0.25, 0.6], amp: 0.5 },
  }),
  chain({
    id: 'staircase', name: 'Staircase',
    note: 'COUNTER-EXAMPLE, kept deliberately. Identical genes except parentFace 0 instead of 5. Every self-connection is a ninety-degree turn, the chain self-intersects, and morphogenesis rejects it at four bodies however high recursiveLimit goes. This is the body every "6-segment serpent" in sessions 8 and 9 was actually measuring.',
    segs: 6, face: 0, lag: Math.PI / 2, omega: 4, hue: 0.0,
  }),
  medusa({
    id: 'jelly', name: 'Medusa',
    note: 'The first radial creature in the project, and it exists to be LOOKED AT rather than to win anything. A bell with a four-fold tentacle crown from one reflected connection — the encoding reaches orders 1/2/4/8 only, so four-fold is the one symmetry it shares with real animals (Aurelia is tetramerous). Cited in factory.js as an example for many sessions before it was built. Whether it reads as a medusa or as a box with four box-arms decides whether radial symmetry is a genome problem or a skinning one.',
  }),
];

/** Look one up by id. */
export const seedById = (id) => SEEDS.find((s) => s.id === id) ?? null;
