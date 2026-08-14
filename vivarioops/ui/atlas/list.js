// ui/atlas/list.js — the dense row, the other half of the grid.
//
// ── WHY TWO DENSITIES ────────────────────────────────────────────────────────
//
// The card (ui/cards.js) is a COLLECTION card — portrait-led, name written
// across the art, built so a creature is recognisable at a glance. That is the
// right shape for browsing forty animals you bred yourself and the wrong shape
// for comparing three hundred on a number: a two-column grid of tall portraits
// puts four creatures on a phone screen, so "sort by food and see the top ten"
// is four flicks of scrolling.
//
// The row puts eleven on the same screen with the sorted number aligned down the
// right edge, which is the only way a sort is actually readable.
//
// ── WHAT A ROW SHOWS, AND WHY IT IS NOT CONFIGURABLE ─────────────────────────
//
// Thumbnail, name, binomial, the CURRENT SORT COLUMN, and one fixed companion
// (size). A user-configurable column set is a desktop-table idea; on a phone the
// interesting column is by definition the one you just sorted by, and making
// that automatic is both less work for the player and one less thing to get out
// of sync with the sort menu.
//
// Tokens only, no hex/px (N16).

import { mk } from '../widgets.js';
import { COLUMN_BY_ID } from './derive.js';

/**
 * One `.spec-row`.
 *
 * Shares the card's contract exactly: `data-key`, a `[data-pending]` art node
 * and a `loadThumb()`, so ui/atlas/reveal.js drives both without knowing which
 * it is looking at.
 *
 * @param {object} r  a Row
 * @param {object} o
 * @param {string} o.sortCol   which column to show on the right
 * @param {(key:string)=>Promise<string|null>} [o.thumb]
 * @param {Function} [o.onOpen]
 * @param {boolean} [o.selectable]
 * @param {boolean} [o.selected]
 * @param {Function} [o.onToggle]
 */
export function specRow(r, o = {}) {
  const interactive = o.selectable || o.onOpen;
  const el = document.createElement(interactive ? 'button' : 'div');
  el.className = 'spec-row';
  el.dataset.key = r.key;
  if (interactive) el.type = 'button';
  if (o.selectable) {
    el.dataset.on = o.selected ? 'yes' : 'no';
    el.addEventListener('click', () => {
      const next = el.dataset.on !== 'yes';
      if (o.onToggle?.(next) === false) return;
      el.dataset.on = next ? 'yes' : 'no';
    });
  } else if (o.onOpen) {
    el.addEventListener('click', () => o.onOpen(r));
  }

  const art = mk('spec-row-art', el);
  const img = mk('spec-row-thumb', art, 'img');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  if (o.thumb) {
    art.dataset.pending = 'yes';
    el.loadThumb = async () => {
      if (art.dataset.pending !== 'yes') return;
      art.dataset.pending = 'no';
      try { const src = await o.thumb(r.key); if (src) img.src = src; }
      catch { /* an empty frame, not a broken row */ }
    };
  }

  const text = mk('spec-row-text', el);
  mk('spec-row-name', text, 'b').textContent = r.name;
  if (r.binomial && r.binomial !== r.name) {
    mk('spec-row-bino', text, 'i').textContent = r.binomial;
  }

  // ── the numbers ───────────────────────────────────────────────────────────
  const nums = mk('spec-row-nums', el);
  const col = COLUMN_BY_ID.get(o.sortCol);
  const sortVal = col?.get(r);

  // The sorted column leads. When it is `Recent` or a name — nothing worth
  // aligning — the slot goes to the family instead, which is the most useful
  // thing to see repeated down a list you are scrolling.
  if (col && col.fmt && sortVal != null && Number.isFinite(sortVal)) {
    mk('spec-row-v', nums, 'span').textContent = col.fmt(sortVal);
  } else if (col?.measured && sortVal == null) {
    // NOT A DASH. A dash reads as "scored nothing"; these creatures have not
    // been put through the 180 s trial at all, and the difference matters when
    // the list is sorted on exactly that number.
    const v = mk('spec-row-v', nums, 'span');
    v.dataset.state = 'pending';
    v.textContent = '—';
  } else {
    mk('spec-row-v', nums, 'span').textContent = r.family;
  }

  // THE COMPANION LINE, AND IT MUST NOT REPEAT THE LINE ABOVE IT. Sorting by
  // Size otherwise printed `4.54 g` and then `4.54 g · 6` directly beneath —
  // half the row spent saying one number twice. When mass is already the
  // headline the slot goes to the family, which is the thing you actually want
  // repeated down a list you are scanning.
  const sub = mk('spec-row-sub', nums, 'span');
  sub.textContent = o.sortCol === 'mass'
    ? `${r.family} · ${r.bodies}`
    : `${r.mass.toFixed(2)} g · ${r.bodies}`;

  if (r.source === 'authored') {
    const b = mk('spec-row-badge', el, 'span');
    b.textContent = 'ref';
  }
  if (o.selectable) mk('spec-row-tick', el);

  return el;
}
