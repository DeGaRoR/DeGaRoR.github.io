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
];

/** Look one up by id. */
export const seedById = (id) => SEEDS.find((s) => s.id === id) ?? null;
