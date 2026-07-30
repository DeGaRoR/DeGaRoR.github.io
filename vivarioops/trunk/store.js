// trunk/store.js — IndexedDB adapter + migration registry (20 §5).
//
// localStorage is never used (N8): its quota is too small for genomes and records.
// /trunk/ imports nothing outside /trunk/ except /contracts/, which is inert schema
// data with no game knowledge — the hard rule in 20 §10 exists to keep extraction
// possible, and a version constant does not compromise that.

import { GENOME_V, BRIDGE_V, ECOLOGY_V } from '../contracts/versions.js';

const DB_NAME = 'vivarium';
const DB_VERSION = 1;
const STORE = 'kv';

let _db = null;
let _profileId = 'default';

export function setProfile(id) { _profileId = id; }
export function getProfile() { return _profileId; }

/** Raised on quota exhaustion so callers can show a user-facing message (20 §5). */
export class StorageFullError extends Error {
  constructor(key) { super(`storage quota exceeded writing ${key}`); this.name = 'StorageFullError'; this.key = key; }
}

/** Raised when a record arrives from a future build (N10). Never partially parsed. */
export class FutureVersionError extends Error {
  constructor(found, supported) {
    super(`this specimen was made with a newer version of the game (schema ${found}, this build supports ${supported}). Update to open it.`);
    this.name = 'FutureVersionError';
    this.found = found; this.supported = supported;
  }
}

function idb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(mode) {
  return idb().then(db => db.transaction(STORE, mode).objectStore(STORE));
}

function wrap(req, key) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      const e = req.error;
      reject(e && e.name === 'QuotaExceededError' ? new StorageFullError(key) : e);
    };
  });
}

// ── envelope ─────────────────────────────────────────────────────────────────
// N9: every stored record carries { kind, schemaVersion, profileId, updatedAt }.
// Enforced on the WRITE PATH, so it cannot be forgotten at a call site.
//
// ── H5: THE ENVELOPE IS TYPED, AND SCHEMA VERSIONS ARE PER KIND. ────────────
//
// Every record used to be stamped with GENOME_V and, on load, run through the
// GENOME migration chain — a profile, a world, a lineage, a compiled record, a
// run result, all of them. That was harmless only because GENOME_V had not moved
// since the convention was written. The day it goes to 3, every profile and every
// run result in every player's database gets handed to a function written to
// turn a genome-2 into a genome-3, and whatever comes back is what the game then
// believes. A migration is domain-specific by definition; running one over a
// record of a different kind is not a version bump, it is corruption with a
// timestamp.
//
// So the kind travels with the record and is derived from the KEY rather than
// passed by the caller — a parameter is a thing to forget, and store.set() is
// called from screens that have no reason to think about schema at all.

/** The current schema version of each kind. */
export const SCHEMA_OF = {
  genome:   GENOME_V,
  specimen: GENOME_V,    // a specimen is a genome plus provenance
  lineage:  GENOME_V,    // a lineage is a population of genomes
  record:   BRIDGE_V,    // measurement: invalidated by any probe/reduction change
  run:      BRIDGE_V,
  world:    ECOLOGY_V,
  vivarium: 1,           // no versioned schema of its own yet
  profile:  1,
  opaque:   1,           // anything under an unrecognised prefix
};

/** Kind from key prefix. Unknown prefixes are `opaque` and never migrated. */
export function kindOf(key) {
  const prefix = String(key).split(':')[0];
  return Object.prototype.hasOwnProperty.call(SCHEMA_OF, prefix) ? prefix : 'opaque';
}

export function envelope(value, kind = 'opaque', schemaVersion = SCHEMA_OF[kind] ?? 1) {
  return { kind, schemaVersion, profileId: _profileId, updatedAt: Date.now(), value };
}

export function hasEnvelope(rec) {
  return !!rec && typeof rec === 'object'
    && typeof rec.schemaVersion === 'number'
    && typeof rec.profileId === 'string'
    && typeof rec.updatedAt === 'number'
    && 'value' in rec;
}

// ── migration registry ───────────────────────────────────────────────────────
// Keyed by KIND and version, run forward on load (01 §8, 20 §5).

const MIGRATIONS = new Map();   // `${kind}:${from}` -> fn

/**
 * @param {string} kind  e.g. 'genome'
 * @param {number} from  migrates `from` -> `from + 1`
 */
export function registerMigration(kind, from, fn) { MIGRATIONS.set(`${kind}:${from}`, fn); }

// A1: the genome 1 -> 2 step is written NOW so the mechanism is exercised before
// it is needed. B1 REPLACES this with the real migration (adds preyGain/threatGain
// at 0) — 30 §4 B1 requires a real one, not a no-op.
registerMigration('genome', 1, (v) => v);   // PLACEHOLDER — B1 replaces

/**
 * Run a stored value forward to the current schema version FOR ITS KIND.
 *
 * A version above the build is rejected with a message, never partially parsed
 * (N10): genomes will arrive from the future via shared files.
 */
export function migrate(value, fromVersion, kind = 'genome', toVersion = SCHEMA_OF[kind] ?? 1) {
  if (fromVersion > toVersion) throw new FutureVersionError(fromVersion, toVersion);
  let v = value;
  for (let k = fromVersion; k < toVersion; k++) {
    const step = MIGRATIONS.get(`${kind}:${k}`);
    if (!step) throw new Error(`no migration registered for ${kind} schema ${k} -> ${k + 1}`);
    v = step(v);
  }
  return v;
}

// ── adapter: get / set / delete / list ───────────────────────────────────────

export async function set(key, value, schemaVersion) {
  const kind = kindOf(key);
  const store = await tx('readwrite');
  return wrap(store.put(envelope(value, kind, schemaVersion ?? SCHEMA_OF[kind] ?? 1), key), key);
}

/** Reads, migrates forward WITHIN ITS KIND, unwraps. undefined for a missing key. */
export async function get(key) {
  const store = await tx('readonly');
  const rec = await wrap(store.get(key), key);
  if (rec === undefined) return undefined;
  if (!hasEnvelope(rec)) throw new Error(`record ${key} has no envelope — written outside store.set()`);

  const kind = kindOf(key);

  // LEGACY RECORDS, written before H5, carry no `kind` and were all stamped
  // GENOME_V whatever they held. For a genome that stamp was true; for anything
  // else it was noise, and running the genome chain over it is the very
  // corruption this change exists to prevent. So the old stamp is honoured only
  // where it meant something, and elsewhere the record is adopted at its kind's
  // current version — which is correct, because no other chain has ever run and
  // there is therefore nothing for it to be behind.
  if (rec.kind === undefined) {
    const genomeLike = SCHEMA_OF[kind] === GENOME_V;
    return genomeLike ? migrate(rec.value, rec.schemaVersion, kind) : rec.value;
  }

  if (rec.kind !== kind) {
    throw new Error(`record ${key} is stored as kind '${rec.kind}' but its key says '${kind}'`);
  }
  return migrate(rec.value, rec.schemaVersion, kind);
}

/** Reads without migrating or unwrapping — for inspection and the dev panel. */
export async function getRaw(key) {
  const store = await tx('readonly');
  return wrap(store.get(key), key);
}

export async function del(key) {
  const store = await tx('readwrite');
  return wrap(store.delete(key), key);
}

/** @param {string} [prefix] e.g. 'specimen:' */
export async function list(prefix = '') {
  const store = await tx('readonly');
  const keys = await wrap(store.getAllKeys(), prefix);
  return keys.filter(k => typeof k === 'string' && k.startsWith(prefix));
}

export async function clear() {
  const store = await tx('readwrite');
  return wrap(store.clear(), '*');
}

/** Bytes in use, when the browser will say. */
export async function usage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const { usage: used, quota } = await navigator.storage.estimate();
  return { used, quota };
}

// ── key builders — 20 §5, corrected by 03 §1 for records ────────────────────

export const KEY = {
  profile:  (id) => `profile:${id}`,
  vivarium: (id) => `vivarium:${id}`,
  lineage:  (id) => `lineage:${id}`,
  specimen: (id) => `specimen:${id}`,
  world:    (id) => `world:${id}`,
  run:      (id) => `run:${id}`,
  // record: built by contracts/world.js recordKey() — it carries worldHash and
  // bridgeVersion, which 20 §5's `record:<genomeHash>:<worldId>` predates.
};
