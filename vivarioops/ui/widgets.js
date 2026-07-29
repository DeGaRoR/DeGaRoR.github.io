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
