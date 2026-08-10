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
 * ── THE FIVE NUMBERS ON A CARD ───────────────────────────────────────────────
 *
 * Chosen so that no two say the same thing, and so that the pair a player is
 * most likely to confuse sits side by side where the difference is visible.
 *
 *   FOOD   g/s in the STABILISED REGIME (engine/l2/forage.js `forageProfile`),
 *          not total eaten. The first 30 s of any trial runs at 3x the rest
 *          because the creature wakes inside an untouched patch, so a total is
 *          mostly a fact about where it was dropped.
 *   ×      the ledger multiplier, intake over spend, over the same window.
 *   STRAIT net displacement over path length, 0..1. An arrow is 1, a thrasher
 *          near 0.
 *   SIZE   mass in grams.
 *   TURN   `turnCapability` = turnRate3d x steeringAuthority, deg/s.
 *
 * WHY FOOD AND `×` ARE BOTH HERE, AND ADJACENT. ROADMAP §5b's first `_zselect`
 * lesson: "never select on the ratio — it is a margin, won by not spending, and
 * the cheapest way not to spend is not to move." Measured, Drifter posts the best
 * multiplier in the library (94x) on a THIRD of the teal snarlback's intake. Show
 * only the multiplier and a player breeds Drifters; show only intake and they
 * breed gluttons. The two together are the honest question.
 *
 * WHY TURN IS CAPABILITY AND NOT RATE. `eel` turns 45 deg/s one way and 0 the
 * other about a fixed axis — a circler, authority 0.000. Rate alone would rank it
 * top of the Atlas.
 *
 * PENDING IS A STATE, NOT A BLANK. A profile costs a 180 s simulation, so it
 * cannot run for forty specimens on page open; the card shows the label greyed
 * until the measurement arrives. A dash with no explanation reads as "this
 * creature scored nothing".
 */
const fmtMult = (r) => {
  if (r == null || !Number.isFinite(r)) return r === Infinity ? '∞' : '—';
  if (r < 10) return `${r.toFixed(1)}×`;
  if (r < 1000) return `${r.toFixed(0)}×`;
  return `${(r / 1000).toFixed(1)}k×`;
};

export function metricRows(spec) {
  const p = spec.profile ?? null;
  const out = [];
  const row = (label, value, state) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    if (state) dd.dataset.state = state;
    out.push(dt, dd);
  };
  const pend = (label) => row(label, t('measuring…'), 'pending');

  if (!p) {
    pend(t('food'));
    pend(t('ledger'));
    pend(t('straight'));
  } else if (!p.valid) {
    row(t('food'), t('came apart'), 'bad');
  } else {
    // mg/s: grams are the engine unit but a creature eats milligrams a second,
    // and `0.034 g/s` on a card is three leading characters of nothing.
    row(t('food'), `${(1000 * p.foodPerSecond).toFixed(0)} mg/s`,
      p.foodPerSecond > 0 ? 'good' : 'bad');
    row(t('ledger'), fmtMult(p.multiplier), p.multiplier >= 1 ? 'good' : 'bad');
    row(t('straight'), p.straightness.toFixed(2));
  }

  // Size comes from the record's own stats and is known without a profile, so it
  // never shows as pending.
  const mass = spec.stats?.mass ?? p?.size?.mass;
  const bodies = spec.stats?.bodies ?? p?.size?.bodies;
  if (mass != null) {
    // CGS (01 §7): engine mass units ARE grams. A relabel, not a conversion.
    row(t('size'), `${mass.toFixed(2)} g${bodies != null ? ` · ${bodies}` : ''}`);
  }

  const turn = spec.stats?.turnCapability ?? p?.turnCapability;
  if (turn != null && Number.isFinite(turn)) {
    row(t('turn'), `${turn.toFixed(1)}°/s`, turn >= 14 ? 'good' : null);
  } else {
    pend(t('turn'));
  }
  return out;
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

  // ── the art, with the name written across it ─────────────────────────────
  const art = mk('spec-card-art', c);
  const img = mk('spec-card-thumb', art, 'img');
  img.alt = '';
  if (spec.thumb) img.src = spec.thumb;

  if (spec.source === 'authored') {
    const badge = mk('spec-card-badge', art, 'span');
    badge.dataset.kind = 'library';
    badge.textContent = t('ref');
  }

  const legend = mk('spec-card-legend', art);
  const { primary, secondary } = displayName(spec);
  mk('spec-card-name', legend, 'b').textContent = primary;
  if (secondary) mk('spec-card-bino', legend, 'i').textContent = secondary;

  if (o.stats !== false) mk('spec-card-metrics', c, 'dl').replaceChildren(...metricRows(spec));

  if (o.selectable) mk('spec-card-tick', c);
  else if (o.action) c.append(o.action);
  else if (spec.source === 'authored') {
    mk('spec-card-source', c).textContent = t('From the library');
  }

  return c;
}
