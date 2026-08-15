// ui/widgets.js — the three primitives A1 needs. Tier 1 replaces these with the
// real chrome (top bar, ribbon, sheet, toast). Tokens only, no hex, no px (N16).

export function section(title) {
  const s = document.createElement('section');
  s.className = 'section';
  const h = document.createElement('h2'); h.textContent = title;
  s.append(h);
  return s;
}

export function row(label, value) {
  const r = document.createElement('div');
  r.className = 'row';
  const l = document.createElement('span'); l.className = 'row-l'; l.textContent = label;
  const v = document.createElement('span'); v.className = 'row-v'; v.textContent = value;
  r.append(l, v);
  return r;
}

export function button(label, onClick) {
  const b = document.createElement('button');
  b.className = 'btn'; b.type = 'button'; b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/**
 * Element, class, parent — the three things every DOM line in a screen needs.
 *
 * HOISTED, NOT INVENTED. `mk` was declared verbatim inside `mount()` in both
 * tank.js and forage.js, and `chip` twice with two different signatures (one
 * took a class, the other a label), which is how the two screens ended up with
 * chips that behaved differently. There is one of each now.
 */
export function mk(cls, parent, tag = 'div') {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (parent) parent.append(n);
  return n;
}

/**
 * Press and hold, the way a photo library does it.
 *
 * ── WHY NOT `contextmenu` ────────────────────────────────────────────────────
 *
 * `contextmenu` is the one-line version and it is wrong on both ends: on a
 * phone the browser's own text-selection callout races it, and on a desktop it
 * fires on right-click, which is not the gesture. Pointer events are the same
 * ones the tank already reads for its own long-press, and using them here means
 * one taxonomy of gesture across the app rather than two.
 *
 * ── THE CLICK THAT MUST NOT HAPPEN ───────────────────────────────────────────
 *
 * A long press ends in a `pointerup`, and the browser then fires `click` — so
 * without the capture-phase suppressor below, holding a card to SELECT it would
 * also open it. The flag is cleared on a timer rather than in the same handler
 * because the click arrives a tick later than the up.
 *
 * @param {HTMLElement} el
 * @param {Function} fn      called once, when the hold is recognised
 * @param {object} [o]
 * @param {number} [o.ms=400]     hold duration; TAP.longPressMs in ui/tank/sim.js
 * @param {number} [o.slop=8]     movement that turns a hold into a scroll
 * @returns {() => void} detach
 */
export function longPress(el, fn, o = {}) {
  const ms = o.ms ?? 400;
  const slop = o.slop ?? 8;
  let timer = 0, x = 0, y = 0, fired = false;

  const clear = () => { clearTimeout(timer); timer = 0; };

  const down = (e) => {
    // Primary button / single touch only. A two-finger gesture is a scroll.
    if (e.button > 0 || !e.isPrimary) return;
    x = e.clientX; y = e.clientY; fired = false;
    clear();
    timer = setTimeout(() => { timer = 0; fired = true; fn(e); }, ms);
  };
  const move = (e) => {
    if (!timer) return;
    if (Math.abs(e.clientX - x) > slop || Math.abs(e.clientY - y) > slop) clear();
  };
  const up = () => clear();
  // CAPTURE, so the suppression happens before the element's own click handler.
  const click = (e) => {
    if (!fired) return;
    fired = false;
    e.stopPropagation();
    e.preventDefault();
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move, { passive: true });
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('click', click, true);

  return () => {
    clear();
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('click', click, true);
  };
}

/**
 * A chip in the floating control cluster.
 *
 * @param {string} label   sentence case; '' when the caller sets it later
 * @param {Function} onClick
 * @param {string} [cls]   extra class — `speed`, `stranger`, `burst`
 */
export function chip(label, onClick, cls = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls ? `tank-chip ${cls}` : 'tank-chip';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
