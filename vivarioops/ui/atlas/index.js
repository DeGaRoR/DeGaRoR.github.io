// ui/atlas/index.js — the Atlas's queryable view of the store.
//
// ── THE PROBLEM, MEASURED ────────────────────────────────────────────────────
//
// `render()` in ui/screens/atlas.js did `store.list('specimen:')` then one
// `store.get` per key, on every mount — and every tab switch is a mount, because
// nav.js remounts whenever the visible screen changes. Each record carries its
// 1024 px portrait INLINE as a PNG data URL (render/thumbnail.js), so that loop
// deserialises tens of megabytes of base64 into JS strings before one card
// exists. `atlasContext()` in ui/vernacular.js did the identical scan a second
// time, and ran `morphogenesis` over the results.
//
// At forty specimens that is slow. At three hundred it is a white screen.
//
// ── THE SHAPE OF THE FIX ─────────────────────────────────────────────────────
//
// Two separations, and everything else follows from them:
//
//   ROWS ARE NOT RECORDS. A Row (ui/atlas/derive.js) is ~400 bytes of primitives
//   with no thumb and no genome. The whole index is one small store value that
//   loads in a single `get`, and filtering/sorting/grouping never touches a
//   record at all.
//
//   PORTRAITS LOAD WHEN THEY ARE SEEN. `thumbFor(key)` fetches one record's
//   `thumb` on demand into a small LRU, driven by an IntersectionObserver on the
//   card. Twelve visible cards cost twelve portraits, not three hundred.
//
// ── WHY NOT A DERIVED BLOCK ON EACH RECORD ───────────────────────────────────
//
// Because writing one means rewriting the record VALUE — portrait included — for
// every specimen, every time a derivation changes. The index is a single key
// rewritten wholesale, and `INDEX_TAG` invalidates the lot in one comparison.
// For the same reason there is no `Map<hash, derived>` memo layered on top: the
// persisted row already IS that memo.
//
// ── WHY NO CHANGE TO trunk/store.js ──────────────────────────────────────────
//
// `kindOf` maps an unrecognised key prefix to `opaque`, which is never migrated
// — exactly right for derived state that may be thrown away at any moment. The
// `index:` entry in SCHEMA_OF is declaratory, not load-bearing.

import * as store from '../../trunk/store.js';
import { deriveRow, INDEX_TAG } from './derive.js';

const INDEX_KEY = 'index:atlas';
const PREFIX = 'specimen:';

/** How many portraits stay decoded. Twelve fit a screen; eighty is four screens
 *  of scrollback, which is as far back as anyone flicks before letting go. */
const THUMB_CAP = 80;

let _rows = [];
let _byKey = new Map();
let _loaded = false;
let _persistTimer = 0;

/** Keys whose record changed under us — see `watchStore` below. */
const _dirty = new Set();
/** Keys THIS module is mid-write on, so its own writes do not mark themselves. */
const _mine = new Set();

const _thumbs = new Map();          // key -> dataURL, insertion-ordered = LRU
const _thumbPending = new Map();    // key -> Promise, so twelve cards scrolling
                                    // past do not each start their own read

const _subs = new Set();
/** @returns {() => void} unsubscribe */
export function subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); }
function announce() { for (const fn of _subs) { try { fn(_rows); } catch { /* not ours */ } } }

function reindex() { _byKey = new Map(_rows.map((r) => [r.key, r])); }

// ── persistence ──────────────────────────────────────────────────────────────
//
// DEBOUNCED, because the measurement pass patches one row at a time and writing
// a three-hundred-row array three hundred times would cost more than the
// measurement it is recording.

function persistSoon() {
  if (_persistTimer) return;
  _persistTimer = setTimeout(async () => {
    _persistTimer = 0;
    try {
      _mine.add(INDEX_KEY);
      await store.set(INDEX_KEY, { tag: INDEX_TAG, rows: _rows });
    } catch { /* the index is derived; losing a write costs one rebuild */ }
    finally { _mine.delete(INDEX_KEY); }
  }, 400);
}

// ── building ─────────────────────────────────────────────────────────────────

async function rowFromStore(key) {
  try {
    const spec = await store.get(key);
    return deriveRow(key, spec);
  } catch { return null; }   // a record from a future build indexes as nothing
}

/**
 * rAF DOES NOT FIRE ON A HIDDEN PAGE, so a bare `await rAF` wedges a build the
 * moment the player switches browser tabs. The `setTimeout` is the fallback that
 * keeps it advancing; rAF still wins when visible, so a build never lands in the
 * middle of a paint. The same race ui/screens/atlas.js and runBurst already use.
 */
const yieldFrame = () => new Promise((r) => {
  let fired = false;
  const go = () => { if (!fired) { fired = true; r(); } };
  requestAnimationFrame(go);
  setTimeout(go, 50);
});

/**
 * Load, reconcile, and return the rows.
 *
 * THE RECONCILE IS THE WHOLE POINT. `store.list` is a `getAllKeys` — cheap, no
 * values — so diffing it against the index tells us exactly which specimens are
 * new and which are gone. ONLY NEW SPECIMENS ARE EVER READ. A warm Atlas with
 * three hundred records and nothing added costs one `get` and one `getAllKeys`.
 *
 * @param {object} [o]
 * @param {(done:number,total:number)=>void} [o.onProgress] fires during a rebuild
 * @param {() => boolean} [o.cancelled] checked between records
 */
export async function ensureIndex(o = {}) {
  if (!_loaded) {
    _loaded = true;
    try {
      const saved = await store.get(INDEX_KEY);
      // A tag mismatch is not a migration problem, it is a claim that is no
      // longer true. Drop it and rebuild rather than sorting on stale facts.
      if (saved?.tag === INDEX_TAG && Array.isArray(saved.rows)) _rows = saved.rows;
    } catch { /* rebuild from scratch */ }
    reindex();
  }

  let keys = [];
  try { keys = await store.list(PREFIX); } catch { return _rows; }

  const live = new Set(keys);
  const todo = keys.filter((k) => !_byKey.has(k) || _dirty.has(k));
  const vanished = _rows.length && _rows.some((r) => !live.has(r.key));

  if (todo.length) {
    let done = 0;
    for (const key of todo) {
      if (o.cancelled?.()) break;
      const row = await rowFromStore(key);
      const at = _rows.findIndex((r) => r.key === key);
      if (row) { if (at >= 0) _rows[at] = row; else _rows.push(row); }
      else if (at >= 0) _rows.splice(at, 1);
      _dirty.delete(key);
      done++;
      if (o.onProgress) o.onProgress(done, todo.length);
      // Only yield on a real build. Ten new records after a breeding session
      // should not cost ten frames.
      if (todo.length > 8) await yieldFrame();
    }
  }

  if (vanished) _rows = _rows.filter((r) => live.has(r.key));
  if (todo.length || vanished) {
    reindex();
    persistSoon();
    announce();
  }
  return _rows;
}

/**
 * Cross-screen writes — the Vivarium's Save, `seedAtlas`, `backup.importAll` —
 * do not come through `patch()`, and there is no other way to hear about them.
 * `store.onWrite` exists for exactly this. Marking the key dirty is enough: the
 * next `ensureIndex()` re-derives it, and nothing between now and then is
 * looking at the row.
 *
 * ── SUBSCRIBED AT MODULE LOAD, NOT ON FIRST USE ──────────────────────────────
 *
 * This was inside `ensureIndex` and it was a real hole. The Atlas boots
 * `seedAtlas()` FIRST — which rewrites every authored record that has drifted —
 * and only then builds the index. With the subscription deferred to that second
 * step, the replants happened while nothing was listening, and the reconcile
 * that follows only notices keys that are NEW or GONE. A record that changed in
 * place would have kept its stale row until something else happened to touch it,
 * which for a shipped library specimen is never.
 *
 * A module-level listener costs nothing and cannot be too late.
 */
store.onWrite((key) => {
  if (typeof key !== 'string' || !key.startsWith(PREFIX)) return;
  if (_mine.has(key)) return;
  _dirty.add(key);
  _thumbs.delete(key);       // the portrait may have been re-rendered
});

// ── reading ──────────────────────────────────────────────────────────────────

/** The rows as of the last `ensureIndex`. Synchronous; never triggers a load. */
export function rows() { return _rows; }
export function rowFor(key) { return _byKey.get(key); }
export function ready() { return _loaded; }

/** The full record, including genome and portrait. For release, detail and
 *  measurement — never for the list. */
export async function specFor(key) {
  try { return await store.get(key); } catch { return null; }
}

/**
 * One portrait, cached.
 *
 * THE SINGLE LARGEST WIN IN THE WHOLE ATLAS REWRITE, and it is four lines of
 * cache around one `get`. Cards call this from an IntersectionObserver, so the
 * bytes a session decodes is a function of how far the player scrolled rather
 * than of how many creatures they have ever kept.
 */
export async function thumbFor(key) {
  if (_thumbs.has(key)) {
    const v = _thumbs.get(key);       // touch: re-insert so it is now newest
    _thumbs.delete(key); _thumbs.set(key, v);
    return v;
  }
  if (_thumbPending.has(key)) return _thumbPending.get(key);

  const p = (async () => {
    let thumb = null;
    try { thumb = (await store.get(key))?.thumb ?? null; } catch { /* no portrait */ }
    _thumbs.set(key, thumb);
    while (_thumbs.size > THUMB_CAP) _thumbs.delete(_thumbs.keys().next().value);
    _thumbPending.delete(key);
    return thumb;
  })();
  _thumbPending.set(key, p);
  return p;
}

// ── writing ──────────────────────────────────────────────────────────────────

/**
 * Write fields onto a record AND refresh its row, as one operation.
 *
 * Every mutation the Atlas makes goes through here, which is why there is no
 * "detect that a record changed" problem for anything this screen does. The
 * `_mine` guard stops the write listener above marking a key dirty that we have
 * just re-derived — otherwise every patch would schedule its own redundant
 * re-read on the next `ensureIndex`.
 *
 * @returns {object|null} the new row
 */
export async function patch(key, partial) {
  let next = null;
  try {
    const cur = await store.get(key);
    if (!cur) return null;
    next = { ...cur, ...partial };
    _mine.add(key);
    await store.set(key, next);
  } catch { return null; }
  finally { _mine.delete(key); }

  const row = deriveRow(key, next);
  const at = _rows.findIndex((r) => r.key === key);
  if (row) { if (at >= 0) _rows[at] = row; else _rows.push(row); }
  else if (at >= 0) _rows.splice(at, 1);
  if (partial.thumb !== undefined) _thumbs.set(key, partial.thumb ?? null);
  reindex();
  persistSoon();
  announce();
  return row;
}

/** Delete a record and drop its row. */
export async function remove(key) {
  try {
    _mine.add(key);
    await store.del(key);
  } catch { return false; }
  finally { _mine.delete(key); }
  _rows = _rows.filter((r) => r.key !== key);
  _thumbs.delete(key);
  reindex();
  persistSoon();
  announce();
  return true;
}

/** Force a full rebuild on the next `ensureIndex` — for the dev screen, and for
 *  a restore that replaces the whole store under us. */
export function invalidateAll() {
  _rows = [];
  _byKey = new Map();
  _thumbs.clear();
  _dirty.clear();
  persistSoon();
}
