// ui/cards.js — the specimen card, in one place.
//
// EXTRACTED FROM atlas.js, where `card()` was a closure inside `mount()`. One
// card, drawn the same wherever it appears — a creature that looked different
// depending on which screen drew it would undermine the one thing a collection
// has to do, which is let you recognise something you have seen before.
//
// The uses differ in arguments, never in forks: a card can be SELECTABLE (the
// release bar ticks it), OPENABLE (tap for the specimen page), or carry a
// trailing action. Everything else is the same card.
//
// ── WHAT IT SAYS, AND IN WHICH ORDER ──────────────────────────────────────
//
// The name across the portrait is the creature's ONE name — the same string the
// tank prints, decided once in ui/names.js. The binomial is the italic line
// under it, and is suppressed when the two are the same rather than printed
// twice in two faces.
//
// 14 §9 reads "the tank speaks vernacular, the Atlas speaks Latin", and that
// split is NOT what this card implements. It is a rule for the ceremony screens
// (Describe, the species page) which do not exist yet; applying it here would
// mean deliberately making the big text differ between the tank and the Atlas,
// which is the exact confusion this component was rebuilt to remove. One primary
// string per creature, everywhere, outranks it.
//
// Tokens only, no hex/px (N16).

import { t } from '../trunk/i18n.js';
import { mk, longPress } from './widgets.js';

// `displayName` USED TO LIVE HERE, and `labelFor` in ui/vernacular.js said
// almost the same thing with one clause missing. Two precedence orders for "what
// is this creature called" is how a card and a picker ended up disagreeing about
// the same animal. There is one now, in ui/names.js, and it runs once per row at
// derive time — a card never decides what to call anything.

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

export function metricRows(r) {
  const p = r.profile ?? null;
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

  if (r.profileState === 'bad') {
    row(t('food'), t('came apart'), 'bad');
  } else if (!p) {
    pend(t('food'));
    pend(t('ledger'));
    pend(t('straight'));
  } else {
    // mg/s: grams are the engine unit but a creature eats milligrams a second,
    // and `0.034 g/s` on a card is three leading characters of nothing.
    row(t('food'), `${(1000 * p.fps).toFixed(0)} mg/s`, p.fps > 0 ? 'good' : 'bad');
    row(t('ledger'), fmtMult(p.mult), p.mult >= 1 ? 'good' : 'bad');
    row(t('straight'), p.straight.toFixed(2));
  }

  // Size is structural — it comes from the plan, not from a simulation — so it
  // is known the moment the row exists and never shows as pending.
  if (r.mass != null) {
    // CGS (01 §7): engine mass units ARE grams. A relabel, not a conversion.
    row(t('size'), `${r.mass.toFixed(2)} g${r.bodies != null ? ` · ${r.bodies}` : ''}`);
  }

  if (p?.turn != null && Number.isFinite(p.turn)) {
    row(t('turn'), `${p.turn.toFixed(1)}°/s`, p.turn >= 14 ? 'good' : null);
  } else if (r.profileState !== 'bad') {
    pend(t('turn'));
  }
  return out;
}

/**
 * ── THE CARD'S ONE LINE OF NUMBERS ───────────────────────────────────────────
 *
 * `metricRows` above is five label/value pairs, and it is right for a list row
 * and for the specimen page. On a CARD it was wrong, and measurably so: once the
 * grid went from two columns to auto-fill, a card measured 109 px wide and
 * 246 px tall with only 116 px of that being the animal. More than half of a
 * picture card was a stat block nobody can compare across a 7-wide grid anyway,
 * because the numbers do not line up between columns.
 *
 * So the card gets ONE line — intake and mass — and the other three live where
 * they can actually be read: the list view, which aligns the sorted column down
 * a single edge, and the specimen page. The grid is for recognising a creature;
 * the list is for comparing them. Making each good at its own job is the whole
 * reason there are two.
 *
 * INTAKE AND NOT THE MULTIPLIER, if only one can be shown. ROADMAP §5b's first
 * `_zselect` lesson: the ratio is a margin, won by not spending, and the cheapest
 * way not to spend is not to move. A card showing only `94×` breeds Drifters.
 */
export function cardStat(r) {
  const out = [];
  const v = (text, state) => {
    const s = document.createElement('span');
    s.textContent = text;
    if (state) s.dataset.state = state;
    out.push(s);
  };
  const p = r.profile ?? null;

  if (r.profileState === 'bad') v(t('came apart'), 'bad');
  else if (!p) v(t('measuring…'), 'pending');
  else v(`${(1000 * p.fps).toFixed(0)} mg/s`, p.fps > 0 ? 'good' : 'bad');

  if (r.mass != null) v(`${r.mass.toFixed(2)} g`);
  return out;
}

/**
 * Build a `.spec-card` from an INDEX ROW.
 *
 * ── IT TAKES A ROW NOW, NOT A RECORD, AND THAT IS THE POINT ──────────────────
 *
 * A record carries its 1024 px portrait inline. A card that took a record could
 * therefore only be built by a caller that had already paid to deserialise every
 * portrait it might draw — which is exactly what made the Atlas unopenable past
 * a few dozen creatures. A row is ~400 bytes of primitives; the portrait arrives
 * separately, and only if the card is actually looked at.
 *
 * @param {object} r  a Row from ui/atlas/derive.js
 * @param {object} [o]
 * @param {(key:string)=>Promise<string|null>} [o.thumb]  portrait loader. Called
 *        LAZILY — hand it `index.thumbFor` and drive it from an
 *        IntersectionObserver on `.spec-card-art` (see ui/atlas/reveal.js).
 *        Omit it and the card renders with an empty frame.
 * @param {boolean} [o.selectable]  render as a button that ticks when chosen
 * @param {boolean} [o.selected]    initial tick state
 * @param {Function} [o.onToggle]   (nextState) => boolean|void; false refuses
 * @param {Function} [o.onOpen]     tap on a non-selectable card
 * @param {HTMLElement} [o.action]  trailing control — the Atlas's Delete
 * @param {boolean} [o.stats=true]  show the measurement strip
 * @returns {HTMLElement} with `.spec-card-thumb` and `.spec-card-metrics`
 *          addressable, so a caller can swap either in place without a redraw
 */
export function specCard(r, o = {}) {
  const interactive = o.selectable || o.onOpen || o.onLongPress;
  const c = document.createElement(interactive ? 'button' : 'div');
  c.className = 'spec-card';
  c.dataset.key = r.key;
  if (interactive) c.type = 'button';
  if (o.selectable) {
    c.dataset.on = o.selected ? 'yes' : 'no';
    c.addEventListener('click', () => {
      const next = c.dataset.on !== 'yes';
      // The CALLER decides whether the toggle takes — a release caps the cast at
      // six, and a card that ticked itself and was then refused would be lying
      // about what happened.
      if (o.onToggle?.(next) === false) return;
      c.dataset.on = next ? 'yes' : 'no';
    });
  } else if (o.onOpen) {
    c.addEventListener('click', () => o.onOpen(r));
  }
  // PRESS AND HOLD TO START SELECTING, the way a photo library does. Available
  // in BOTH modes: out of selection mode it begins one, and inside it the tap
  // handler above already toggles, so the hold is harmless.
  if (o.onLongPress) longPress(c, () => o.onLongPress(r));

  // ── the art, with the name written across it ─────────────────────────────
  const art = mk('spec-card-art', c);
  const img = mk('spec-card-thumb', art, 'img');
  img.alt = '';
  // `loading`/`decoding` are free hints and they matter here: a data URL still
  // costs a decode, and a grid of them decoded synchronously is a dropped frame
  // per screenful.
  img.loading = 'lazy';
  img.decoding = 'async';
  if (o.thumb) {
    art.dataset.pending = 'yes';
    c.loadThumb = async () => {
      if (art.dataset.pending !== 'yes') return;
      art.dataset.pending = 'no';
      try { const src = await o.thumb(r.key); if (src) img.src = src; }
      catch { /* an empty frame, not a broken card */ }
    };
  }

  if (r.source === 'authored') {
    const badge = mk('spec-card-badge', art, 'span');
    badge.dataset.kind = 'library';
    badge.textContent = t('ref');
  }

  const legend = mk('spec-card-legend', art);
  mk('spec-card-name', legend, 'b').textContent = r.name;
  // The binomial is suppressed when it IS the name — printing it twice, once
  // upright and once italic, is how two of the shipped cards used to look.
  if (r.binomial && r.binomial !== r.name) {
    mk('spec-card-bino', legend, 'i').textContent = r.binomial;
  }

  if (o.stats !== false) mk('spec-card-metrics', c).replaceChildren(...cardStat(r));

  // ── WHAT A CHAMPION IS A CHAMPION AT ────────────────────────────────────────
  //
  // The five metrics above are a FORAGE-and-shape summary — food, multiplier,
  // straightness, size, turn — and not one of them says whether a creature can
  // find anything. Worse, `TURN` is `turnCapability`, and design/15-BREEDING.md
  // section 1.4 records it measured at Spearman -0.152 against actually arriving:
  // a card for an animal bred to reach a beacon was showing, as its only
  // behavioural number, the field this project retired as a seeking proxy.
  //
  // A promoted champion carries its own one-line verdict from the canonical
  // trial. It is the record's, not recomputed here — the same discipline the
  // vernacular follows — so a card cannot drift from the measurement that
  // justified the animal. Full provenance stays in the `note`, reachable as the
  // element's title without spending card real estate on it.
  if (r.headline) {
    const h = mk('spec-card-headline', c);
    h.textContent = r.headline;
    // Full provenance stays in the `note`, reachable as the element's title
    // without spending card real estate on it.
    if (r.note) h.title = r.note;
  }

  // A button inside a button is invalid HTML, so an openable card cannot carry
  // a trailing Delete. That is the right shape anyway: Delete belongs on the
  // specimen page or in the multi-select bar, not under every thumbnail.
  if (o.action && !interactive) c.append(o.action);
  else if (r.source === 'authored') {
    mk('spec-card-source', c).textContent = t('From the library');
  }

  // ── THE TICK IS AN OVERLAY, AND IT IS ADDED LAST AND UNCONDITIONALLY ───────
  //
  // It used to REPLACE the provenance line, which meant every library card lost
  // a row the moment selection began and the grid reflowed under the player's
  // thumb — a card measured 261 px browsing and 240 px selecting. A tick is a
  // state, not a different card. It is absolutely positioned over the art
  // (base.css `.spec-card-tick`), so it costs no height and nothing below it
  // moves.
  if (o.selectable) mk('spec-card-tick', c);

  return c;
}
