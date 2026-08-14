// ui/release.js — the one channel between the Atlas and the tank.
//
// The Vivarium used to browse the Atlas itself, in a bottom sheet, with its own
// copy of the card grid and its own full read of every specimen record. That was
// a second, worse Atlas living inside the screen the Atlas exists to stock.
//
// Now the tank ASKS and the Atlas ANSWERS: `requestStock()` sends the player to
// the Atlas with a capacity, the Atlas turns its own grid into a selection with
// its own search and filters, and `release()` hands the picks back.
//
// ── WHY A MODULE AND NOT ONE OF THE OBVIOUS ALTERNATIVES ─────────────────────
//
// THE ATLAS WRITING `lineage:<seed>` DIRECTLY was rejected, and not on taste.
// `loadLineage` (ui/screens/vivarium.js) returns null on ANY structural failure,
// and the boot path then seeds a brand-new random population — so one malformed
// write from a second screen silently destroys the player's whole breeding line
// with no undo and no error. `lineageRecord()` stays the only author of that
// record. It would also mean the Atlas knowing POPULATION, the `provenance`
// shape, the slot-assignment rule and the undo-snapshot shape: every private
// detail of a 2000-line screen, copied.
//
// NAV PARAMS ON `goTab` was rejected because `goTab` deliberately takes none —
// a tab root's params are fixed at `start()` — so they would outlive the trip
// and have to be cleared, or the next tab switch would re-import. Widening
// trunk/nav.js, which is 167 deliberate lines with its own gate coverage, costs
// more than these thirty.
//
// `nav.push('atlas', {stock})` was rejected because it renders the Atlas UNDER
// the vivarium tab, and ui/base.css hides `#topbar` for `[data-tab="vivarium"]`
// — the Atlas would appear chromeless with a floating tab bar.
//
// A module-level mutable singleton is already this codebase's idiom for
// "at most one of these at a time" (see ui/menu.js).

import * as store from '../trunk/store.js';

/** `{ capacity }` while the Atlas is being used to stock the tank, else null. */
let request = null;

/**
 * Genomes chosen but not yet taken by the tank.
 *
 * MIRRORED TO THE STORE so a reload between the two screens does not drop them,
 * and it holds FULL GENOMES rather than keys: a queue that stored keys would
 * break if the record were deleted in the same trip, and the tank has no
 * business re-reading the Atlas to find out what it was handed.
 */
let queue = [];

const PENDING_KEY = 'vivarium:pending';

/** The tank wants creatures. Send the player to the Atlas to choose them. */
export function requestStock(capacity) {
  request = { capacity: Math.max(1, capacity | 0) };
}

/** The Atlas asks whether it is being used as a picker right now. */
export function stocking() { return request; }

/** The player backed out, or the Atlas unmounted without releasing. */
export function cancel() { request = null; }

/**
 * Hand specimens to the tank.
 *
 * @param {Array<object>} specs  stored records; only `.genome` is required
 */
export async function release(specs) {
  const cap = request?.capacity ?? specs.length;
  queue = specs.filter((s) => s?.genome).slice(0, cap);
  request = null;
  try { await store.set(PENDING_KEY, queue); } catch { /* in-memory is enough */ }
  return queue.length;
}

/**
 * Take whatever is waiting, and clear it.
 *
 * Called once from the Vivarium's boot, AFTER the cast exists — handing picks to
 * `importSpecimens` before `genomes` is populated would write into an empty
 * array. Returns `[]` when there is nothing, which is the common case.
 */
export async function drain() {
  if (!queue.length) {
    try { const saved = await store.get(PENDING_KEY); if (Array.isArray(saved)) queue = saved; }
    catch { /* nothing waiting */ }
  }
  const out = queue;
  queue = [];
  if (out.length) { try { await store.set(PENDING_KEY, []); } catch { /* transient */ } }
  return out;
}

export function pendingCount() { return queue.length; }
