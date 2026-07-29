// trunk/store.js — IndexedDB adapter + migration registry (20 §5).
//
// localStorage is never used (N8): its quota is too small for genomes and records.
// /trunk/ imports nothing outside /trunk/ except /contracts/, which is inert schema
// data with no game knowledge — the hard rule in 20 §10 exists to keep extraction
// possible, and a version constant does not compromise that.

import { GENOME_V } from '../contracts/versions.js';

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
// N9: every stored record carries { schemaVersion, profileId, updatedAt }.
// Enforced on the WRITE PATH, so it cannot be forgotten at a call site.

export function envelope(value, schemaVersion = GENOME_V) {
  return { schemaVersion, profileId: _profileId, updatedAt: Date.now(), value };
}

export function hasEnvelope(rec) {
  return !!rec && typeof rec === 'object'
    && typeof rec.schemaVersion === 'number'
    && typeof rec.profileId === 'string'
    && typeof rec.updatedAt === 'number'
    && 'value' in rec;
}

// ── migration registry ───────────────────────────────────────────────────────
// Keyed by GENOME_V, run forward on load (01 §8, 20 §5).

const MIGRATIONS = new Map();

/** @param {number} from  migrates `from` -> `from + 1` */
export function registerMigration(from, fn) { MIGRATIONS.set(from, fn); }

// A1: the 1 -> 2 step is written NOW so the mechanism is exercised before it is
// needed. B1 REPLACES this with the real migration (adds preyGain/threatGain at 0)
// — 30 §4 B1 requires a real one, not a no-op.
registerMigration(1, (v) => v);   // PLACEHOLDER — B1 replaces

/**
 * Run a stored value forward to the current schema version.
 * A version above the build is rejected with a message, never partially parsed (N10):
 * genomes will arrive from the future via shared files.
 */
export function migrate(value, fromVersion, toVersion = GENOME_V) {
  if (fromVersion > toVersion) throw new FutureVersionError(fromVersion, toVersion);
  let v = value;
  for (let k = fromVersion; k < toVersion; k++) {
    const step = MIGRATIONS.get(k);
    if (!step) throw new Error(`no migration registered for schema ${k} -> ${k + 1}`);
    v = step(v);
  }
  return v;
}

// ── adapter: get / set / delete / list ───────────────────────────────────────

export async function set(key, value, schemaVersion = GENOME_V) {
  const store = await tx('readwrite');
  return wrap(store.put(envelope(value, schemaVersion), key), key);
}

/** Reads, migrates forward, unwraps. Returns undefined for a missing key. */
export async function get(key) {
  const store = await tx('readonly');
  const rec = await wrap(store.get(key), key);
  if (rec === undefined) return undefined;
  if (!hasEnvelope(rec)) throw new Error(`record ${key} has no envelope — written outside store.set()`);
  return migrate(rec.value, rec.schemaVersion);
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
