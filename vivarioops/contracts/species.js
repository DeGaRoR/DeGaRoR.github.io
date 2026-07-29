// contracts/species.js — 03 §3. The canonical L2 -> L3 record. Flat. One struct.
// No other module may restate these fields.
//
// PURITY: pure. Safe for /engine/.

import { ContractError } from './world.js';

/**
 * Producer taxonomy. 03 §7 K1 names only S1/S2/S3/genome/derived, which leaves
 * `id`, `name`, `provenance`, `genomeHash`, `worldHash`, `bridgeVersion` and `vs`
 * with no legal producer. A0 extends the set with `identity`, `fauna`, `matchup`
 * and `fixture`, and reports the extension.
 */
export const PRODUCERS = {
  identity: 'set at compile from the genome and the world',
  fauna:    'assigned by the fauna loader when the species enters a fauna set',
  matchup:  'assembled by the fauna loader from PairMatchup records (03 §3)',
  S1:       'probe S1 morphometrics — free, no simulation',
  S2:       'probe S2 locomotion — three efforts, power fit, burstDuration',
  S3:       'probe S3 turning — turnRate, turnRadius, turnSpeedRatio',
  genome:   'read directly off the genome, not measured',
  derived:  'computed by deriveThresholds() from measured values + world ratios',
  fixture:  'slice default from the world fixture; UNMEASURED until its probe lands',
};

/**
 * The field table. This IS the schema — makeSpecies() is generated from it, so a
 * field cannot be added to the struct without declaring who writes it. That is
 * what gives K1 teeth.
 */
export const SPECIES_FIELDS = [
  // ── identity ───────────────────────────────────────────
  { name: 'id',            producer: 'fauna',    note: 'dense index into the fauna array' },
  { name: 'genomeHash',    producer: 'identity' },
  { name: 'worldHash',     producer: 'identity' },
  { name: 'bridgeVersion', producer: 'identity' },
  { name: 'name',          producer: 'identity', note: 'derived binomial, written at B4' },
  { name: 'provenance',    producer: 'identity', note: "'shipped' | 'player'" },

  // ── morphology · measured, S1 ──────────────────────────
  { name: 'massBase',      producer: 'S1', note: 'kg, physical body mass' },
  { name: 'volume',        producer: 'S1' },
  { name: 'boundingRadius',producer: 'S1' },
  { name: 'longestAxis',   producer: 'S1' },
  { name: 'frontalArea',   producer: 'S1' },
  { name: 'harvestArea',   producer: 'S1', note: 'exposed surface area. ONE name (was surfaceArea in 11)' },
  { name: 'reach',         producer: 'S1' },
  { name: 'torsoExposure', producer: 'S1' },
  { name: 'bodyCount',     producer: 'S1' },
  { name: 'jointCount',    producer: 'S1' },
  { name: 'dofCount',      producer: 'S1' },

  // ── locomotion · measured, S2 ──────────────────────────
  { name: 'cruiseSpeed',   producer: 'S2' },
  { name: 'burstSpeed',    producer: 'S2' },
  { name: 'burstRatio',    producer: 'S2' },
  { name: 'burstDuration', producer: 'S2', note: 's at burstSpeed before dropping to cruise' },
  { name: 'cotC0',         producer: 'S2', note: 'power(v) = cotC0*v + cotC1*v^3' },
  { name: 'cotC1',         producer: 'S2' },
  { name: 'basalRate',     producer: 'S2', note: 'W at rest' },
  { name: 'straightness',  producer: 'S2' },
  { name: 'gaitFrequency', producer: 'S2' },

  // ── turning · measured, S3 — N21 depends on turnRate ───
  { name: 'turnRate',      producer: 'S3', note: 'rad/s. N21 clamps all L3 steering by this' },
  { name: 'turnRadius',    producer: 'S3' },
  { name: 'turnSpeedRatio',producer: 'S3' },

  // ── disposition · S4/S5 deferred, fixture default in slice
  { name: 'pursuitGain',   producer: 'fixture', note: 'UNMEASURED — w1_slice default until S4' },
  { name: 'evasionGain',   producer: 'fixture', note: 'UNMEASURED — w1_slice default until S5' },

  // ── ecology thresholds · DERIVED ───────────────────────
  { name: 'massMin',       producer: 'derived', note: 'MASS_MIN_RATIO x massBase — death' },
  { name: 'massReproduce', producer: 'derived', note: 'MASS_REPRO_RATIO x massBase — split' },
  { name: 'perceptionRadius', producer: 'derived' },

  // ── from genome, not measured ──────────────────────────
  // CARRIED OBLIGATION FOR B1: none of these six genes exists in the genome schema
  // (10 §A5 + amendment A1). B1 must add them or K1's producer claim is a fiction.
  { name: 'trophic',         producer: 'genome'},
  { name: 'boldness',        producer: 'genome'},
  { name: 'cohesion',        producer: 'genome'},
  { name: 'separation',      producer: 'genome'},
  { name: 'alignment',       producer: 'genome'},
  { name: 'separationRadius',producer: 'genome'},

  // ── matchups · dense over the whole fauna ──────────────
  { name: 'vs', producer: 'matchup', note: 'Float32Array, 3 x faunaCount' },
];

/** Fields whose declared producer does not yet exist. Reported by the gate every run. */
export const SPECIES_PENDING_GENES = SPECIES_FIELDS.filter(f => f.pendingGene).map(f => f.name);

// `vs` layout — 03 §3.
export const VS_STRIDE = 3;
export const VS_PCAPTURE = 0;
export const VS_TIME = 1;
export const VS_ENERGY = 2;

/** Read this species' row against fauna member j. */
export function vsGet(species, j) {
  const o = j * VS_STRIDE;
  return {
    pCapture:      species.vs[o + VS_PCAPTURE],
    timeToCapture: species.vs[o + VS_TIME],
    energyRate:    species.vs[o + VS_ENERGY],
  };
}

/** All fields present and null. Producers fill it; nothing may be added ad hoc. */
export function makeSpecies() {
  const s = {};
  for (const f of SPECIES_FIELDS) s[f.name] = null;
  return s;
}

/**
 * 03 §3 derivation. Ratios come from the world fixture, never literals (30 D1).
 * @param {number} massBase  kg, from S1
 * @param {number} reach     m, from S1
 * @param {object} world     supplies MASS_MIN_RATIO, MASS_REPRO_RATIO,
 *                           PERCEPTION_REACH_K, PERCEPTION_WORLD_FRAC, worldSize
 */
export function deriveThresholds(massBase, reach, world) {
  const worldWidth = world.worldSize[0];
  return {
    massMin:       world.MASS_MIN_RATIO * massBase,
    massReproduce: world.MASS_REPRO_RATIO * massBase,
    perceptionRadius: Math.min(
      world.PERCEPTION_REACH_K * reach,
      world.PERCEPTION_WORLD_FRAC * worldWidth,
    ),
  };
}

/**
 * @param {object} sp
 * @param {number} faunaCount
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validateSpecies(sp, faunaCount) {
  const errors = [];
  if (!sp || typeof sp !== 'object') return { ok: false, errors: ['species is not an object'] };

  const declared = new Set(SPECIES_FIELDS.map(f => f.name));
  for (const f of SPECIES_FIELDS) {
    if (!(f.name in sp)) errors.push(`missing field: ${f.name}`);
    else if (sp[f.name] === null || sp[f.name] === undefined) errors.push(`unassigned field: ${f.name}`);
  }
  for (const k of Object.keys(sp)) if (!declared.has(k)) errors.push(`undeclared field: ${k}`);

  // K2 — vs density.
  if (!(sp.vs instanceof Float32Array)) {
    errors.push('vs: not a Float32Array');
  } else {
    const want = VS_STRIDE * faunaCount;
    if (sp.vs.length !== want) errors.push(`vs: length ${sp.vs.length}, expected ${want}`);
    else if (Number.isInteger(sp.id) && sp.id >= 0 && sp.id < faunaCount) {
      const o = sp.id * VS_STRIDE;
      for (let k = 0; k < VS_STRIDE; k++) {
        if (sp.vs[o + k] !== 0) errors.push(`vs: self entry [${sp.id}][${k}] is ${sp.vs[o + k]}, expected 0`);
      }
    }
    for (let i = 0; i < sp.vs.length; i++) {
      if (!Number.isFinite(sp.vs[i])) { errors.push(`vs[${i}] is not finite`); break; }
    }
  }

  // Threshold ordering — a species that is born dead is a contract violation, not an outcome.
  if (typeof sp.massBase === 'number' && typeof sp.massMin === 'number' && typeof sp.massReproduce === 'number') {
    if (!(sp.massMin < sp.massBase && sp.massBase < sp.massReproduce)) {
      errors.push(`threshold order: ${sp.massMin} < ${sp.massBase} < ${sp.massReproduce} is false`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Throws on a non-dense matrix — 01 §9 lists it as a contract violation. */
export function assertSpecies(sp, faunaCount) {
  const r = validateSpecies(sp, faunaCount);
  if (!r.ok) throw new ContractError(`species invalid: ${r.errors.join('; ')}`, r.errors[0]);
  return sp;
}
