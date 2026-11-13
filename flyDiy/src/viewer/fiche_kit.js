// fiche_kit.js - FICHE_KIT: the fiche's PHONE kit, one code path for every section (AIRCRAFT-LOOKS' Main, Cutaway and Mass,
// PHYSICS-PAGES' Drag, Physics, Electrics, Cooling, Integrity and Reference). The registry (fiche_board.js FICHE_BOARD.pages)
// hands each section ctx.layout = { screen: 'desktop' | 'phone', theme: 'cream' | 'dark', w, h }; on the phone a section
// draws ONE column, w wide (320-480 CSS px, design 360), as tall as it needs (h null: the fiche scrolls). Nothing wider than
// w, nothing clipped. Colours ONLY from the sheet's five tokens (--fi-paper, --fi-ink, --fi-dim, --fi-line, --fi-acc), with
// a fallback per theme when a page is drawn off the board (a test, a picture tool).
//
// Loaded by tools/build.js after fiche_board.js and fiche_mass.js (GATE PLANEFICHE keeps plane_fiche, fiche_board and
// fiche_mass adjacent; fiche_mass finds the kit when it draws, not when it loads), before fiche_physics.js. SVG strings
// only: no DOM but the token read, so node draws the same thing (the gates).
//
// THE API
//   FICHE_KIT.tokens(el)                  -> { paper, ink, dim, line, acc } off an element's computed style, or null
//   FICHE_KIT.palette(layout, tokens)     -> { paper, ink, dim, faint, line, acc, dark } (tokens first, the theme's fallback)
//   FICHE_KIT.wrap(text, size, width, w8) -> [lines]  (w8: the weight, 400 / 500 / 600 - a bold line is wider)
//   FICHE_KIT.textW(text, size, w8)       -> the estimated width, px
//   FICHE_KIT.column({ w, pad, palette }) -> a column C, top to bottom:
//     C.x0, C.x1, C.inner, C.y          its left edge, right edge, inner width, the next free y
//     C.eyebrow(text)                   the small caps line over a title
//     C.title(text, { sz })             a wrapped heading (default 22 px, 600)
//     C.text(text, { sz, c, w8, gap })  wrapped running text; c: 'ink' | 'dim' | 'faint' | 'acc' | a colour
//     C.label(text)                     a section label (small caps, faint), with the space above it
//     C.gap(h), C.rule()                space; a hairline across
//     C.rows(rows, { sz, chip })        label / value lines: [left, right, note?, chipColour?] - right aligned at x1, the
//                                       note under the left in dim; wraps the left when it would meet the right
//     C.figure(h, draw)                 reserve h px of the column; draw(x0, y0, inner, h) returns its svg
//     C.fit(vw, vh, draw, { maxH })     a drawing made in its own units (vw x vh) scaled to the inner width (or to maxH):
//                                       draw() returns svg in those units; returns the scale
//     C.chips(items)                    a wrapped line of [colour, text] chips (a legend)
//     C.push(svg)                       raw svg at absolute positions (the caller's own geometry)
//     C.svg(label, { sig })             the whole column: <svg viewBox="0 0 w H"> on the paper, H = where it ended
//   FICHE_KIT.esc(s)                    the text escape
'use strict';
(function (root) {
  const V = 1;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // the fallbacks: the board's cream sheet and the phone's black, as fiche_board.js defines them
  const FALL = { cream: { paper: '#f3ede0', ink: '#2b2924', dim: '#6d675b', line: '#d8cdb8', acc: '#b5652e' },
                 dark:  { paper: '#000000', ink: '#f2ece2', dim: '#bdb5a8', line: 'rgba(255,248,236,.18)', acc: '#e0915a' } };
  function tokens(el) {
    try {
      const cs = (root.getComputedStyle || getComputedStyle)(el), v = k => (cs.getPropertyValue(k) || '').trim() || null;
      const T = { paper: v('--fi-paper'), ink: v('--fi-ink'), dim: v('--fi-dim'), line: v('--fi-line'), acc: v('--fi-acc') };
      return (T.paper || T.ink) ? T : null;
    } catch (e) { return null; }
  }
  function palette(layout, T) {
    const L = layout || {}, dark = L.theme === 'dark' || (!L.theme && L.screen === 'phone'), F = dark ? FALL.dark : FALL.cream, t = T || {};
    const P = { paper: t.paper || F.paper, ink: t.ink || F.ink, dim: t.dim || F.dim, line: t.line || F.line, acc: t.acc || F.acc, dark };
    P.faint = P.dim;
    return P;
  }
  // the text's width: IBM Plex Sans' average advance, about 0.54 em regular and 0.58 em semibold (digits and capitals wider,
  // the narrow letters narrower - an estimate, rounded up a little so a line never overruns)
  const textW = (s, sz, w8) => String(s).length * sz * ((w8 || 400) >= 600 ? 0.585 : (w8 || 400) >= 500 ? 0.56 : 0.545);
  function wrap(s, sz, width, w8) {
    const words = String(s == null ? '' : s).split(/\s+/).filter(Boolean), out = []; let a = '';
    for (const x of words) { const t = a ? a + ' ' + x : x; if (a && textW(t, sz, w8) > width) { out.push(a); a = x; } else a = t; }
    if (a) out.push(a);
    return out.length ? out : [''];
  }
  function column(opts) {
    const o = opts || {}, w = Math.max(240, +o.w || 360), pad = o.pad != null ? o.pad : 16, P = o.palette || palette({ theme: 'cream' });
    const C = { w, pad, P, x0: pad, x1: w - pad, inner: w - 2 * pad, y: pad + 8, out: [] };
    const col = c => (c === 'ink' || !c) ? P.ink : c === 'dim' ? P.dim : c === 'faint' ? P.faint : c === 'acc' ? P.acc : c;
    const T = (x, y, s, sz, c, w8, a, ls) => `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${sz}" fill="${col(c)}"` +
      (w8 && w8 !== 400 ? ` font-weight="${w8}"` : '') + (a ? ` text-anchor="${a}"` : '') + (ls ? ` letter-spacing="${ls}"` : '') + `>${esc(s)}</text>`;
    C.T = T;
    C.eyebrow = s => { const lines = wrap(String(s).toUpperCase(), 11, C.inner * 0.9, 600); for (const l of lines) { C.y += 13; C.out.push(T(C.x0, C.y, l, 11, 'faint', 600, null, 1.4)); } C.y += 4; return C; };
    C.title = (s, op) => { const sz = (op && op.sz) || 22; for (const l of wrap(s, sz, C.inner, 600)) { C.y += sz * 1.18; C.out.push(T(C.x0, C.y, l, sz, 'ink', 600)); } C.y += 6; return C; };
    C.text = (s, op) => { const q = op || {}, sz = q.sz || 14, lh = q.lh || sz * 1.38;
      for (const l of wrap(s, sz, q.width || C.inner, q.w8)) { C.y += lh; C.out.push(T(q.x != null ? q.x : C.x0, C.y, l, sz, q.c || 'ink', q.w8)); }
      C.y += q.gap != null ? q.gap : 4; return C; };
    C.label = s => { C.y += 18; return C.eyebrow(s); };
    C.gap = h => { C.y += h; return C; };
    C.rule = () => { C.y += 10; C.out.push(`<line x1="${C.x0}" y1="${C.y.toFixed(1)}" x2="${C.x1}" y2="${C.y.toFixed(1)}" stroke="${P.line}" stroke-width="1"/>`); C.y += 6; return C; };
    C.rows = (rows, op) => {
      const q = op || {}, sz = q.sz || 14;
      for (const r of rows) {
        const [left, right, note, chip] = r, rw = right ? textW(right, sz, 600) : 0, lx = C.x0 + (chip ? 18 : 0);
        const lines = wrap(left, sz, Math.max(60, C.x1 - lx - rw - 12));
        C.y += sz * 1.4;
        if (chip) C.out.push(`<rect x="${C.x0}" y="${(C.y - sz * 0.78).toFixed(1)}" width="11" height="11" rx="2" fill="${chip}" stroke="${P.dark ? 'none' : 'rgba(43,41,36,.55)'}" stroke-width=".8"/>`);
        lines.forEach((l, i) => { if (i) C.y += sz * 1.3; C.out.push(T(lx, C.y, l, sz, 'ink')); if (!i && right) C.out.push(T(C.x1, C.y, right, sz, q.rc || 'ink', 600, 'end')); });
        if (note) for (const l of wrap(note, sz - 2, C.x1 - lx)) { C.y += (sz - 2) * 1.3; C.out.push(T(lx, C.y, l, sz - 2, 'dim')); }
      }
      C.y += 4; return C;
    };
    C.figure = (h, draw) => { const s = draw(C.x0, C.y, C.inner, h); if (s) C.out.push(s); C.y += h; return C; };
    C.fit = (vw, vh, draw, op) => {
      const q = op || {}, s = Math.min(C.inner / vw, q.maxH ? q.maxH / vh : Infinity), dx = C.x0 + (C.inner - vw * s) / 2;
      C.out.push(`<g transform="translate(${dx.toFixed(2)} ${C.y.toFixed(2)}) scale(${s.toFixed(5)})">${draw()}</g>`);
      C.y += vh * s; return s;
    };
    C.chips = items => {
      let x = C.x0; C.y += 18;
      for (const [c, t] of items) { const tw = 16 + textW(t, 12) + 14; if (x > C.x0 && x + tw > C.x1) { x = C.x0; C.y += 18; }
        C.out.push(`<rect x="${x}" y="${(C.y - 9).toFixed(1)}" width="11" height="10" rx="2" fill="${c}"/>` + T(x + 16, C.y, t, 12, 'dim')); x += tw; }
      C.y += 6; return C;
    };
    C.push = s => { C.out.push(s); return C; };
    C.svg = (label, op) => {
      const q = op || {}; if (q.sig) { C.y += 26; C.out.push(T(C.x1, C.y, q.sig, 11, 'faint', 400, 'end')); }
      const H = Math.ceil(C.y + pad);
      return `<svg viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" role="img" aria-label="${esc(label || '')}" xmlns="http://www.w3.org/2000/svg" font-family="'IBM Plex Sans', system-ui, sans-serif">` +
        `<rect width="${w}" height="${H}" fill="${P.paper}"/>${C.out.join('')}</svg>`;
    };
    return C;
  }
  const API = { V, tokens, palette, wrap, textW, column, esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.FICHE_KIT = API;
})(typeof window !== 'undefined' ? window : null);
