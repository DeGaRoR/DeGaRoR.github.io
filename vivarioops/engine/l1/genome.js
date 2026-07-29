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

export const RANGE = {
  // Node — 10 §A5, density amended by A1 (was 0.6..1.4)
  dim:            [0.2, 2.0],       // m, full extent per axis
  density:        [0.15, 1.8],      // relative to water; midpoint ~0.98 = neutral
  recursiveLimit: [1, 6],           // integer
  angleLimit:     [0, Math.PI / 2], // radians, symmetric about zero
  phaseLag:       [-Math.PI, Math.PI],

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
export const FREQ_MULTS = [0.5, 1, 2];

/** Instantiation caps — 10 §A5. Morphogenesis truncates; truncation is normal. */
export const CAPS = { maxBodies: 24, maxConnPerNode: 4 };

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
  };
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

export function deserialise(text) {
  const raw = typeof text === 'string' ? JSON.parse(text) : text;
  if (typeof raw?.version !== 'number') throw new Error('genome: missing version');
  const g = migrate(raw);
  // Rebuild jointGenes as a map keyed by nodeId; canonical() re-emits it sorted.
  const jointGenes = {};
  for (const jg of g.controller.jointGenes) {
    jointGenes[jg.nodeId] = { amplitude: jg.amplitude, bias: jg.bias, freqMult: jg.freqMult };
  }
  return { ...g, controller: { ...g.controller, jointGenes } };
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
  if (!Number.isInteger(g.seed) || g.seed < 0) e.push(`seed is not a uint32: ${g.seed}`);
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
    n.joint?.angleLimits?.forEach((a, i) => { if (!inRange(a, RANGE.angleLimit)) e.push(`node ${n.id}: angleLimits[${i}] = ${a}`); });
    if (!inRange(n.joint?.phaseLag, RANGE.phaseLag)) e.push(`node ${n.id}: phaseLag ${n.joint?.phaseLag}`);
    for (const k of ['hueShift', 'valueShift', 'patternPhase']) {
      if (!inRange(n.colorGenes?.[k], RANGE[k])) e.push(`node ${n.id}: colorGenes.${k} = ${n.colorGenes?.[k]}`);
    }
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
    c.position?.forEach((v, i) => { if (!inRange(v, RANGE.position)) e.push(`connection ${c.id}: position[${i}] = ${v}`); });
    c.orientation?.forEach((v, i) => { if (!inRange(v, RANGE.orientation)) e.push(`connection ${c.id}: orientation[${i}] = ${v}`); });
    c.scale?.forEach((v, i) => { if (!inRange(v, RANGE.scale)) e.push(`connection ${c.id}: scale[${i}] = ${v}`); });
    for (const k of ['reflectX', 'reflectY', 'reflectZ', 'terminalOnly']) {
      if (typeof c[k] !== 'boolean') e.push(`connection ${c.id}: ${k} is not a boolean`);
    }
  }
  for (const [nodeId, d] of outDegree) {
    if (d > CAPS.maxConnPerNode) e.push(`node ${nodeId}: ${d} outgoing connections, cap is ${CAPS.maxConnPerNode}`);
  }

  for (const k of ['omega', 'preyGain', 'threatGain']) {
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
  }
  for (const c of g.connections) out.push(...c.position, ...c.orientation, ...c.scale);
  out.push(g.controller.omega, g.controller.preyGain, g.controller.threatGain);
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
