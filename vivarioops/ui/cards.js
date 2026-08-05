// ui/cards.js — the specimen card, in one place.
//
// EXTRACTED FROM atlas.js, where `card()` was a closure inside `mount()`. It is
// wanted in two places now — the Atlas grid and the Vivarium's import sheet —
// and a card that looks different depending on which screen drew it would
// undermine the one thing a collection has to do, which is let you recognise a
// creature you have seen before.
//
// The two uses differ in exactly two ways and both are arguments, not forks:
// a card can be SELECTABLE (the import sheet ticks it), and it can carry a
// trailing action (the Atlas's Delete). Everything else is the same card.
//
// ── WHAT IT SAYS, AND IN WHICH ORDER ──────────────────────────────────────
//
// 14 §9 ratifies the split: the tank speaks vernacular, the Atlas speaks Latin.
// An Atlas card is the point where they meet, so the vernacular is the heading
// and the binomial is the italic line under it. A player-authored common name
// overrides the generated vernacular entirely (14 §7) — it is a free-text
// release valve and has no rules.
//
// Tokens only, no hex/px (N16).

import { t } from '../trunk/i18n.js';
import { mk } from './widgets.js';

/**
 * The display name for a stored specimen, and the line under it.
 *
 * PRECEDENCE, and each step is a decision:
 *   1. the player's own name, if they typed one that is not just the binomial
 *   2. the stored vernacular, if the record carries one
 *   3. the binomial — always available, never wrong, merely unmemorable
 *
 * The vernacular is READ FROM THE RECORD, never recomputed here. 14 §4 scores
 * slots against the lineage, so recomputing on every render would rename a
 * creature as its neighbours changed — you would tap "the banded whipfoot" and
 * come back to find it called something else. It is minted once, when the
 * specimen is described, exactly as the binomial is.
 */
export function displayName(spec) {
  const bino = spec.binomial || t('Creature');
  const authored = spec.commonName && spec.commonName !== spec.binomial ? spec.commonName : null;
  const primary = authored || spec.vernacular || bino;
  return { primary, secondary: primary === bino ? null : bino, authored: Boolean(authored) };
}

/**
 * Build a `.spec-card`.
 *
 * @param {object} spec  a stored `specimen:` record
 * @param {object} [o]
 * @param {boolean} [o.selectable]  render as a button that ticks when chosen
 * @param {boolean} [o.selected]    initial tick state
 * @param {Function} [o.onToggle]   (nextState) => void; selectable cards only
 * @param {HTMLElement} [o.action]  trailing control — the Atlas's Delete
 * @param {boolean} [o.stats=true]  show the body/mass line
 * @returns {HTMLElement} with `.querySelector('.spec-card-thumb')` addressable,
 *          so a caller can swap in a re-rendered portrait without a full redraw
 */
export function specCard(spec, o = {}) {
  const c = document.createElement(o.selectable ? 'button' : 'div');
  c.className = 'spec-card';
  if (o.selectable) {
    c.type = 'button';
    c.dataset.on = o.selected ? 'yes' : 'no';
    c.addEventListener('click', () => {
      const next = c.dataset.on !== 'yes';
      // The CALLER decides whether the toggle takes — an import sheet caps the
      // cast at six, and a card that ticked itself and was then refused would be
      // lying about what happened.
      if (o.onToggle?.(next) === false) return;
      c.dataset.on = next ? 'yes' : 'no';
    });
  }

  const img = mk('spec-card-thumb', c, 'img');
  img.alt = '';
  if (spec.thumb) img.src = spec.thumb;

  const { primary, secondary } = displayName(spec);
  mk('spec-card-name', c).textContent = primary;
  if (secondary) mk('spec-card-bino', c).textContent = secondary;

  if (o.stats !== false) {
    const bodies = spec.stats?.bodies;
    const mass = spec.stats?.mass;
    const line = [
      bodies != null ? `${bodies} ${t('bodies')}` : null,
      // CGS (01 §7): engine mass units ARE grams. A relabel, not a conversion.
      mass != null ? `${mass.toFixed(2)} g` : null,
    ].filter(Boolean).join(' · ');
    if (line) mk('spec-card-stats', c).textContent = line;
  }

  if (o.selectable) mk('spec-card-tick', c);
  else if (o.action) c.append(o.action);
  else if (spec.source === 'authored') {
    mk('spec-card-source', c).textContent = t('From the library');
  }

  return c;
}
