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
