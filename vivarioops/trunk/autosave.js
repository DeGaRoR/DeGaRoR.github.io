// trunk/autosave.js — THE STORE BACKS ITSELF UP, WITHOUT BEING ASKED.
//
// ── WHY A MANUAL EXPORT WAS NOT ENOUGH ──────────────────────────────────────
//
// `trunk/backup.js` has had `exportAll`/`importAll` for a long time, wired into
// Settings as a download button. It works. It did not help: on 2026-08-13 the
// owner's twenty-seven saved specimens went out of IndexedDB and the most recent
// export was never taken, because taking one is a thing a person has to remember
// to do and the moment you need it is the moment you did not.
//
// Eleven creatures survived, and every one of them survived for the same reason:
// somebody had promoted it into a file in the repo. That is the whole lesson, so
// this does it automatically.
//
// ── WHAT IT IS AND WHAT IT IS NOT ───────────────────────────────────────────
//
// DEV ONLY, and silently absent otherwise. It POSTs to an endpoint that only
// `tools/serve.js` serves; on GitHub Pages the probe fails once and the module
// disables itself for the session. A player's browser is not quietly shipping
// their creatures anywhere.
//
// NOT A SYNC. It is a one-way dump of the whole store to one file, debounced.
// The file is in the repo, so git is the actual history and this only has to get
// the data out of the browser.
//
// ── THE FAILURE MODE IT IS BUILT AGAINST ────────────────────────────────────
//
// The obvious way to write this destroys exactly what it protects: the store is
// wiped, the wipe fires an autosave, and the backup is overwritten with nothing.
// So there are two guards, and both live on the SERVER where they cannot be
// bypassed by a page:
//
//   1. an empty payload is refused outright
//   2. every write rotates the previous file to `.prev.json` first
//
// Rotation is what makes a bad save survivable: the last good state is always
// one file away, even after a wipe has been faithfully mirrored.
import * as store from './store.js';
import { exportAll } from './backup.js';

/** Where the dev server writes. Git-tracked; `_z` is the tools convention. */
export const AUTOSAVE_URL = '/tools/_zautosave.json';
const ENDPOINT = '/_autosave';

/**
 * How long to wait after the last write before dumping. Breeding a generation
 * writes a lineage record and up to six specimens in a burst; a debounce turns
 * that into one dump instead of seven, and three seconds is far below the
 * interval at which a person does anything twice.
 */
const DEBOUNCE_MS = 3000;

let timer = null;
let available = null;      // null = unprobed, false = not a dev server
let inFlight = false;
let lastError = null;
let saves = 0;

/** @returns {{available:boolean|null, saves:number, lastError:string|null}} */
export const autosaveStatus = () => ({ available, saves, lastError });

async function dump() {
  if (available === false || inFlight) return;
  inFlight = true;
  try {
    const payload = await exportAll();
    // A store with nothing in it is never worth writing, and writing it is the
    // one thing that would turn a wipe into a permanent loss. The server refuses
    // this too; refusing it here as well saves a pointless round trip.
    if (!payload || !Array.isArray(payload.records) || payload.records.length === 0) return;
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    available = res.ok;
    if (res.ok) { saves++; lastError = null; } else lastError = `HTTP ${res.status}`;
  } catch (e) {
    // A missing endpoint is the NORMAL case outside dev, so it disables quietly
    // rather than logging on every write for the rest of the session.
    available = false;
    lastError = String(e && e.message ? e.message : e).slice(0, 120);
  } finally {
    inFlight = false;
  }
}

/**
 * Wrap `store.set` and `store.del` so every mutation schedules a dump. Those two
 * are the only writers, so this is the whole surface — no caller has to remember
 * anything, which is the entire point.
 *
 * Idempotent: calling it twice does not double-wrap.
 */
let installed = false;
export function installAutosave() {
  if (installed) return;
  installed = true;
  store.onWrite(() => {
    if (available === false) return;
    clearTimeout(timer);
    timer = setTimeout(dump, DEBOUNCE_MS);
  });
}
