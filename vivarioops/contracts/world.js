// contracts/world.js — 03 §1 WorldKey, plus the World validator.
//
// PRECEDENCE: 03 wins over 02 §2. Where 02 said `surface.height`, this says
// `surface.y`, because 03 §1 hashes `surface.y` and 03 §5 supplies `surface.y`.
//
// PURITY: pure. Safe for /engine/.

import { fnv1a, hex8, canon } from './hash.js';

/** Thrown only for contract violations (01 §9). Domain outcomes never throw. */
export class ContractError extends Error {
  constructor(message, invalidReason) {
    super(message);
    this.name = 'ContractError';
    this.invalidReason = invalidReason;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
//
// Required set = exactly the W1_SLICE key set (A0 decision, defect 6).
// 02 §2's presentation fields and residentMatrix are OPTIONAL and absent in the slice.
// ─────────────────────────────────────────────────────────────────────────────

const N = 'number', S = 'string', B = 'boolean';

export const WORLD_SCHEMA = {
  // identity
  id:                   { type: S, hashed: true, note: 'world id' },
  name:                 { type: S, hashed: false, note: 'display name' },
  faunaVersion:         { type: N, hashed: true, note: 'bumps when the resident set changes' },

  // physics — read by L1 and L2
  gravity:              { type: N, hashed: true, note: 'm/s^2, -Y. 02 §1a: constant 9.81 in every world' },
  mediumDensity:        { type: N, hashed: true, note: 'relative to water = 1.0' },
  dragScale:            { type: N, hashed: true, note: 'multiplier on standard drag' },
  dragCoefficient:      { type: N, hashed: true, note: 'Cd' },
  floor:                { type: 'object', keys: { present: B, y: N, friction: N, restitution: N },
                          hashed: ['present', 'friction', 'restitution', 'y'] },
  surface:              { type: 'object', keys: { present: B, y: N }, hashed: ['present', 'y'] },
  tankBounds:           { type: 'array', len: 3, of: N, hashed: true, note: 'm — L1 tank' },

  // presentation — label only, never physics
  phase:                { type: S, note: "'liquid' | 'gas'", hashed: false },

  // ecology — read by L3
  worldSize:            { type: 'array', len: 2, of: N, note: 'cm, torus', hashed: false },
  substrateGrid:        { type: 'array', len: 2, of: N, hashed: false },
  totalMass:            { type: N, note: 'g — THE conserved quantity', hashed: false },
  fertility:            { type: 'object', keys: { noiseScale: N, noiseContrast: N, seed: N }, hashed: false },
  diffusionRate:        { type: N, hashed: false },
  HARVEST_RATE:         { type: N, hashed: false },
  PREDATION_EFFICIENCY: { type: N, hashed: false },
  KLEIBER:              { type: N, hashed: false },
  METABOLIC_SCALE:      { type: N, hashed: false },
  REPRO_COOLDOWN:       { type: N, hashed: false },
  MAX_AGE:              { type: N, hashed: false },
  dt:                   { type: N, note: 's per L3 tick', hashed: false },

  // derivation ratios — A0 addition (defect 5): 30 D1 forbids hard-coded constants,
  // and 03 §3 had 0.5 / 2.0 / 8 / 0.02 as literals.
  MASS_MIN_RATIO:       { type: N, note: 'massMin = ratio x massBase', hashed: false },
  MASS_REPRO_RATIO:     { type: N, note: 'massReproduce = ratio x massBase', hashed: false },
  PERCEPTION_REACH_K:   { type: N, note: 'perceptionRadius = min(k x reach, frac x worldWidth)', hashed: false },
  PERCEPTION_WORLD_FRAC:{ type: N, hashed: false },

  // run
  biomassBudget:        { type: N, note: 'kg the player may seed', hashed: false },
  runDuration:          { type: N, note: 's', hashed: false },

  // bridge
  duelRepeats:          { type: N, hashed: false },
  duelDuration:         { type: N, hashed: false },
  engagementK:          { type: N, note: 'engagementRadius = k x (reachA + reachB)', hashed: false },

  // disposition defaults — A0 addition (defect 2): 30 §5 C1 requires these in the
  // fixture; 03 §5 omitted them. Flagged unmeasured until S4/S5 land at step F.
  pursuitGain:          { type: N, note: 'UNMEASURED slice default; S4 replaces', hashed: false },
  evasionGain:          { type: N, note: 'UNMEASURED slice default; S5 replaces', hashed: false },

  // fauna
  residents:            { type: 'array', of: S, hashed: 'external',
                          note: 'resident ids; genome hashes are passed separately to worldHash()' },
};

/**
 * The set of paths that MUST appear in WORLD_HASH_FIELDS, derived from the schema's
 * `hashed` flags. This exists so K5 has an INDEPENDENT statement of what world
 * identity is. Checking WORLD_HASH_FIELDS against itself only proves the list is
 * self-consistent: delete an entry and you delete its own check. Membership is
 * cross-checked here; ORDER stays with WORLD_HASH_FIELDS, because 03 §1 pins it
 * and changing it changes every hash.
 *
 * `hashed: 'external'` means the value is fed to worldHash() as a separate
 * argument (residents), not read off the world object.
 */
export function expectedHashPaths() {
  const paths = [];
  for (const [key, spec] of Object.entries(WORLD_SCHEMA)) {
    if (spec.hashed === undefined) {
      throw new ContractError(`WORLD_SCHEMA.${key} does not declare \`hashed\``, 'undeclared-hash-membership');
    }
    if (spec.hashed === true) paths.push([key]);
    else if (Array.isArray(spec.hashed)) for (const sub of spec.hashed) paths.push([key, sub]);
  }
  return paths;
}

/** Present in 02 §2, not required by the slice. */
export const WORLD_OPTIONAL = ['blurb', 'palette', 'lightPreset', 'particulate', 'fogDensity', 'residentMatrix'];

/** Fields whose slice values are placeholders, surfaced on the dev panel. */
export const WORLD_UNMEASURED = ['pursuitGain', 'evasionGain'];

function typeOk(v, t) {
  if (t === N) return typeof v === 'number' && Number.isFinite(v);
  if (t === S) return typeof v === 'string';
  if (t === B) return typeof v === 'boolean';
  return false;
}

/** @returns {{ok:boolean, errors:string[]}} */
export function validateWorld(world) {
  const errors = [];
  if (!world || typeof world !== 'object') return { ok: false, errors: ['world is not an object'] };

  for (const [key, spec] of Object.entries(WORLD_SCHEMA)) {
    const v = world[key];
    if (v === undefined) { errors.push(`missing: ${key}`); continue; }

    if (spec.type === 'object') {
      if (typeof v !== 'object' || v === null) { errors.push(`${key}: not an object`); continue; }
      for (const [sk, st] of Object.entries(spec.keys)) {
        if (v[sk] === undefined) errors.push(`missing: ${key}.${sk}`);
        else if (!typeOk(v[sk], st)) errors.push(`${key}.${sk}: expected ${st}, got ${typeof v[sk]}`);
      }
    } else if (spec.type === 'array') {
      if (!Array.isArray(v)) { errors.push(`${key}: not an array`); continue; }
      if (spec.len !== undefined && v.length !== spec.len) errors.push(`${key}: expected length ${spec.len}, got ${v.length}`);
      v.forEach((e, i) => { if (!typeOk(e, spec.of)) errors.push(`${key}[${i}]: expected ${spec.of}`); });
    } else if (!typeOk(v, spec.type)) {
      errors.push(`${key}: expected ${spec.type}, got ${typeof v}`);
    }
  }

  const known = new Set([...Object.keys(WORLD_SCHEMA), ...WORLD_OPTIONAL]);
  for (const key of Object.keys(world)) if (!known.has(key)) errors.push(`unknown key: ${key}`);

  return { ok: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// WorldKey — 03 §1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ordered hash input. Declared as data so K5 can iterate it rather than
 * restating the list. `dragCoefficient` is an A0 addition (defect 3): it is a
 * physical parameter that scales every drag force and therefore every L2
 * measurement, and 03 §1 omitted it while K5 requires it.
 */
export const WORLD_HASH_FIELDS = [
  ['id'],
  ['gravity'],
  ['mediumDensity'],
  ['dragScale'],
  ['dragCoefficient'],
  ['floor', 'present'],
  ['floor', 'friction'],
  ['floor', 'restitution'],
  ['floor', 'y'],
  ['surface', 'present'],
  ['surface', 'y'],
  ['tankBounds'],
  ['faunaVersion'],
];

/**
 * 03 §1. Resident genome hashes are passed EXPLICITLY (A0 decision, defect 4):
 * W1_SLICE.residents holds ids, not genomes, and the genomes do not exist until C2.
 * Callers pass the ids as placeholders until then; faunaVersion bumps at the swap.
 * @param {object} world
 * @param {string[]} residentGenomeHashes
 * @returns {string} 8-char hex
 */
export function worldHash(world, residentGenomeHashes) {
  if (!Array.isArray(residentGenomeHashes)) {
    throw new ContractError('worldHash requires an explicit residentGenomeHashes array', 'bad-args');
  }
  const parts = [];
  for (const path of WORLD_HASH_FIELDS) {
    let v = world;
    for (const k of path) v = v?.[k];
    parts.push(Array.isArray(v) ? v.join(',') : canon(v));
  }
  parts.push(...residentGenomeHashes.map(canon).slice().sort());
  return hex8(fnv1a(parts.join('|')));
}

// ─────────────────────────────────────────────────────────────────────────────
// Record validity — 03 §1, §7 K6. Supersedes 20 §5's `record:<genomeHash>:<worldId>`
// and N13's wording, both of which predate WorldKey.
// ─────────────────────────────────────────────────────────────────────────────

export function recordKey(genomeHash, worldHashStr, bridgeV) {
  return `record:${canon(genomeHash)}:${canon(worldHashStr)}:${canon(bridgeV)}`;
}

/** @returns {{ok:boolean, invalidReason:string|null}} — legible, never silent (01 §9). */
export function checkRecord(record, worldHashStr, bridgeV) {
  if (!record || typeof record !== 'object') return { ok: false, invalidReason: 'record-missing' };
  if (record.worldHash !== worldHashStr) {
    return { ok: false, invalidReason: `world-mismatch: record ${record.worldHash} vs current ${worldHashStr}` };
  }
  if (record.bridgeVersion !== bridgeV) {
    return { ok: false, invalidReason: `bridge-mismatch: record ${record.bridgeVersion} vs build ${bridgeV}` };
  }
  return { ok: true, invalidReason: null };
}

/** Throws rather than returning a partially usable record. There is no partial reuse. */
export function assertRecord(record, worldHashStr, bridgeV) {
  const r = checkRecord(record, worldHashStr, bridgeV);
  if (!r.ok) throw new ContractError(`record rejected: ${r.invalidReason}`, r.invalidReason);
  return record;
}
