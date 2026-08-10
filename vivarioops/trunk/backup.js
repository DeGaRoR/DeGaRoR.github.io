// trunk/backup.js — EXPORT AND IMPORT THE WHOLE LOCAL STORE.
//
// ── WHY THIS EXISTS, AND IT IS NOT A CONVENIENCE ─────────────────────────────
//
// Everything a player has ever bred lives in ONE IndexedDB on ONE origin, with
// no copy anywhere. Clearing site data, switching browsers, or opening the app on
// a different port ends it. In one session the owner of this project twice
// believed their creatures were gone — both times they were fine, but the second
// time the store on the origin they were looking at genuinely had been cleared,
// and there was no way to check and no way back.
//
// A store that cannot be copied is a store that will eventually be lost. The
// Atlas is the one artefact in this project that is IRREPLACEABLE: a genome that
// took forty generations to breed cannot be regenerated from the source, unlike
// every authored specimen, every measurement and every compiled record.
//
// ── WHAT IT COPIES ───────────────────────────────────────────────────────────
//
// EVERYTHING under the current profile, not just specimens. A lineage record is
// what names a creature relative to its siblings, and a vivarium record is the
// tank the player left running; restoring specimens alone would bring back the
// animals and lose where they were.
//
// Values are exported AFTER migration (`store.get` runs the chain on read) and
// re-enveloped on import through `store.set`. So a backup taken at GENOME_V 6
// imports into a GENOME_V 7 build and migrates on the way in, which is the whole
// reason not to copy raw envelopes.
//
// ── IMPORT NEVER DELETES, AND NEVER SILENTLY REPLACES ────────────────────────
//
// The default is ADD-ONLY: a key already present is left alone and counted as
// skipped. Restoring a backup over a live store must not be able to destroy work
// done since the backup was taken — that would make this file the very thing it
// exists to prevent. `overwrite: true` is available and the caller has to ask.
import * as store from './store.js';
import { VERSION } from './version.js';

export const BACKUP_FORMAT = 'vivarioops-backup';
export const BACKUP_FORMAT_V = 1;

/**
 * ── THUMBNAILS ARE NOT BACKED UP, AND THAT IS THE DIFFERENCE BETWEEN A USABLE
 *    FILE AND AN UNUSABLE ONE ────────────────────────────────────────────────
 *
 * `PORTRAIT_SIZE` is 1024, so every specimen carries a 1024x1024 PNG as a base64
 * data URL. Measured on a real store of 46 records: exporting them whole produced
 * a **24.6 MB** file. Dropping the portraits takes the same store to roughly a
 * hundred kilobytes.
 *
 * They are pure derived data — `renderThumbnail(genome)` reproduces one exactly —
 * so backing them up stores the output of a function next to its input.
 *
 * `render` GOES WITH IT, AND IT HAS TO. `isStale()` tests that tag, and it is
 * what makes the Atlas re-draw a card; stripping the picture but keeping the tag
 * would import records that claim to be current and show blank. Dropping both
 * means an imported specimen reads as stale and is redrawn the first time the
 * Atlas is opened, which is the existing repair path rather than a new one.
 */
const DERIVED_FIELDS = ['thumb', 'render'];
const strip = (value) => {
  if (!value || typeof value !== 'object' || !('thumb' in value)) return value;
  const out = { ...value };
  for (const f of DERIVED_FIELDS) delete out[f];
  return out;
};

/**
 * Everything in the store, as a plain object ready for JSON.stringify.
 * @returns {Promise<{format:string, records:Array<{key:string,value:*}>}>}
 */
export async function exportAll() {
  const keys = await store.list('');
  const records = [];
  const failed = [];
  for (const key of keys) {
    try {
      const value = await store.get(key);
      if (value !== undefined && value !== null) records.push({ key, value: strip(value) });
    } catch (e) {
      // A record this build cannot read — a future schema, a corrupt row. It is
      // NAMED in the export rather than dropped silently, so a restore into a
      // build that can read it is still possible from the original store.
      failed.push({ key, reason: String(e && e.message ? e.message : e).slice(0, 200) });
    }
  }
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_V,
    app: VERSION.app,
    genome: VERSION.genome,
    bridge: VERSION.bridge,
    ecology: VERSION.ecology,
    profile: store.getProfile(),
    // Wall-clock, and only here: a backup is a real-world event, not a
    // simulation one, so this is the one place a timestamp is meaningful.
    exportedAt: new Date().toISOString(),
    counts: { records: records.length, unreadable: failed.length },
    unreadable: failed,
    records,
  };
}

/** `specimen:` rows the player made, as opposed to the shipped library. */
const isPlayerSpecimen = (key, v) =>
  key.startsWith('specimen:') && v && v.source !== 'authored';

/**
 * Merge a backup into the current store.
 *
 * @param {object} data parsed backup
 * @param {{overwrite?:boolean}} [opts] `overwrite` replaces existing keys.
 * @returns {Promise<{added:number, skipped:number, replaced:number, errors:Array}>}
 */
export async function importAll(data, { overwrite = false } = {}) {
  if (!data || data.format !== BACKUP_FORMAT) {
    throw new Error('not a Vivarioops backup file');
  }
  if (!Array.isArray(data.records)) throw new Error('backup has no records array');
  if (Number(data.genome) > Number(VERSION.genome)) {
    // Forward migration only. A newer genome cannot be run backwards, and
    // importing it would store rows this build will throw on for ever after.
    throw new Error(`backup is genome ${data.genome}, this build reads up to ${VERSION.genome}`);
  }

  const existing = new Set(await store.list(''));
  let added = 0, skipped = 0, replaced = 0;
  const errors = [];

  for (const rec of data.records) {
    if (!rec || typeof rec.key !== 'string') { errors.push({ key: null, reason: 'malformed row' }); continue; }
    const here = existing.has(rec.key);
    if (here && !overwrite) { skipped++; continue; }
    // EVEN WITH `overwrite`, A PLAYER'S OWN SPECIMEN IS NEVER REPLACED BY THE
    // IMPORTER unless the incoming row is also one. Restoring an old backup
    // should not be able to roll a creature back to an earlier version of
    // itself, or overwrite a newer one that happens to share a key.
    if (here && overwrite) {
      try {
        const cur = await store.get(rec.key);
        if (isPlayerSpecimen(rec.key, cur) && !isPlayerSpecimen(rec.key, rec.value)) { skipped++; continue; }
      } catch { /* unreadable current row — let the import replace it */ }
    }
    try {
      await store.set(rec.key, rec.value);
      if (here) replaced++; else added++;
    } catch (e) {
      errors.push({ key: rec.key, reason: String(e && e.message ? e.message : e).slice(0, 200) });
    }
  }
  return { added, skipped, replaced, errors };
}

/** `vivarioops-backup-2026-08-11.json` — sortable, and says what it is. */
export function backupFilename(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `vivarioops-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
    + `-${p(now.getHours())}${p(now.getMinutes())}.json`;
}
