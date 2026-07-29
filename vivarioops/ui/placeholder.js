// ui/placeholder.js — the empty-screen body used by every A1 tab root.
// No hex colours, no raw pixel values: tokens only (N16).
export function placeholder(el, title, body) {
  const wrap = document.createElement('div');
  wrap.className = 'placeholder';
  const h = document.createElement('h1'); h.textContent = title;
  const p = document.createElement('p'); p.textContent = body;
  wrap.append(h, p);
  el.append(wrap);
}
