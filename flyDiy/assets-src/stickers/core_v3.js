// v3 core: logo-mark primitives. Swooshes are true filled shapes: two cubic beziers meeting at sharp tips.
const L = require('./lib_v3.js');
const { I, H, r2, P, C, G, poly } = L;

// a swoosh from A to B: the centre line bows by `bend` (positive = up for a left-to-right swoosh),
// max thickness w; k = share of the thickness below the centre line (0.5 = symmetric, 0 = flat underside)
function swoosh(A, B, bend, w, k = 0.5, f = I, skew = 0) {
  const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy), nx = dy / l, ny = -dx / l;
  const c1 = [A[0] + dx * (1 / 3 - skew) + nx * bend * 4 / 3, A[1] + dy * (1 / 3 - skew) + ny * bend * 4 / 3];
  const c2 = [A[0] + dx * (2 / 3 - skew) + nx * bend * 4 / 3, A[1] + dy * (2 / 3 - skew) + ny * bend * 4 / 3];
  const up = w * (1 - k) * 4 / 3, dn = w * k * 4 / 3;
  const u1 = [c1[0] + nx * up, c1[1] + ny * up], u2 = [c2[0] + nx * up, c2[1] + ny * up];
  const d1 = [c1[0] - nx * dn, c1[1] - ny * dn], d2 = [c2[0] - nx * dn, c2[1] - ny * dn];
  const p = q => `${r2(q[0])},${r2(q[1])}`;
  return P(`M${p(A)} C${p(u1)} ${p(u2)} ${p(B)} C${p(d2)} ${p(d1)} ${p(A)} Z`, f);
}
// a swoosh with free control points for the centre line (cubic A c1 c2 B), thickness w
function swooshC(A, c1, c2, B, w, k = 0.5, f = I) {
  // offset the controls along the chord normal
  const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy), nx = dy / l, ny = -dx / l;
  const up = w * (1 - k) * 4 / 3, dn = w * k * 4 / 3, p = q => `${r2(q[0])},${r2(q[1])}`;
  const o = (q, s) => [q[0] + nx * s, q[1] + ny * s];
  return P(`M${p(A)} C${p(o(c1, up))} ${p(o(c2, up))} ${p(B)} C${p(o(c2, -dn))} ${p(o(c1, -dn))} ${p(A)} Z`, f);
}
// context per mark: clip ids
function ctx(name) { let n = 0; const defs = []; return { defs, clip(d) { const id = `${name}_${++n}`; defs.push(`<clipPath id="ID_${id}"><path d="${d}"/></clipPath>`); return id; } }; }
const CLIP = (id, inner) => `<g clip-path="url(#ID_${id})">${inner}</g>`;
// a peak (apex A, base corners Lb, Rb) with a jagged snow band cut across it at fraction f down from the apex
function peak(cx, A, Lb, Rb, o = {}) {
  const f = o.f ?? 0.3, t = o.t ?? 4, n = o.n ?? 5, amp = o.amp ?? 5, F = o.F ?? I;
  const d = poly([A, Lb, Rb]);
  let s = P(d, F);
  if (o.snow === false) return s;
  const y0 = A[1] + (Lb[1] - A[1]) * f, xl = Math.min(Lb[0], A[0]) - 4, xr = Math.max(Rb[0], A[0]) + 4;
  const up = [], dn = [];
  for (let i = 0; i <= n * 2; i++) {
    const x = xl + (xr - xl) * i / (n * 2);
    const yu = y0 + (i % 2 ? amp * 0.35 : -amp * 0.15), yd = y0 + t + (i % 2 ? amp : -amp * 0.1) * (o.ragged ?? 1);
    up.push([x, yu]); dn.unshift([x, yd]);
  }
  const id = cx.clip(d);
  s += CLIP(id, P(poly(up.concat(dn)), F === I ? H : I));
  return s;
}
// a logo spruce: drooping tiers, a short trunk
function tree(x, yb, h, w, tiers = 4, f = I) {
  const trunkH = h * 0.1, top = yb - h, span = h - trunkH, th = span / (tiers * 0.72 + 0.28);
  let d = '';
  for (let i = 0; i < tiers; i++) {
    const t0 = top + i * th * 0.72, hw = w / 2 * (0.42 + 0.58 * (i + 1) / tiers), b = t0 + th;
    d += `M${r2(x)},${r2(t0)} C${r2(x + hw * 0.25)},${r2(t0 + th * 0.45)} ${r2(x + hw * 0.7)},${r2(t0 + th * 0.8)} ${r2(x + hw)},${r2(b)} ` +
      `Q${r2(x + hw * 0.45)},${r2(b - th * 0.22)} ${r2(x)},${r2(b - th * 0.12)} Q${r2(x - hw * 0.45)},${r2(b - th * 0.22)} ${r2(x - hw)},${r2(b)} ` +
      `C${r2(x - hw * 0.7)},${r2(t0 + th * 0.8)} ${r2(x - hw * 0.25)},${r2(t0 + th * 0.45)} ${r2(x)},${r2(t0)} Z `;
  }
  const tw = Math.max(1.6, w * 0.08);
  d += `M${r2(x - tw)},${r2(yb - trunkH - th * 0.2)} H${r2(x + tw)} V${r2(yb)} H${r2(x - tw)} Z`;
  return P(d, f);
}
// four-point star
const star = (x, y, r, f = I) => P(`M${x},${y - r} Q${x + r * 0.18},${y - r * 0.18} ${x + r},${y} Q${x + r * 0.18},${y + r * 0.18} ${x},${y + r} Q${x - r * 0.18},${y + r * 0.18} ${x - r},${y} Q${x - r * 0.18},${y - r * 0.18} ${x},${y - r} Z`, f);
// a ring (evenodd)
const ring = (cx, cy, r1, r0, f = I) => `<path fill="${f}" fill-rule="evenodd" d="M${cx - r1},${cy} a${r1},${r1} 0 1,0 ${2 * r1},0 a${r1},${r1} 0 1,0 ${-2 * r1},0Z M${cx - r0},${cy} a${r0},${r0} 0 1,0 ${2 * r0},0 a${r0},${r0} 0 1,0 ${-2 * r0},0Z"/>`;
// a logo cub: the v2 cub, chunkier lines, one window, solid tyre with a hub hole
function cubMark(o = {}) {
  const lw = o.lw ?? 4.4, tr = o.tyre ?? 12.5, F = o.F ?? I, Hc = F === I ? H : I;
  let s = L.cub({ lw, tyre: tr, detail: false, F });
  if (o.detail !== false) {
    s += P(`M92,${-9.2 + lw} L${117.4},${-9.2 + lw} L${121.4 - lw * 0.4},2.4 L${121.4 - lw * 0.4},5.6 L92,5.6 Z`, Hc);
    s += L.bar(101.5, 20.5, 112.6, -9.6, lw, F) + L.bar(101.5, 20.5, 89, -9.6, lw, F);
    s += C(110, 40, tr * 0.36, Hc);
  }
  return s;
}
// a high-wing plane seen head-on, centred on (0,0) = the cowl; span 2*sw
function headOn(sw = 70, o = {}) {
  const F = o.F ?? I, Hc = F === I ? H : I, lw = o.lw ?? 4;
  let s = '';
  // wing with a touch of dihedral, sitting on top of the cabin
  if (o.simple) s += P(`M${-sw},${-21} L${-6},${-26.6} L6,${-26.6} L${sw},${-21} L${sw},${-13} L6,${-18.6} L-6,${-18.6} L${-sw},${-13} Z`, F);   // thicker
  else s += P(`M${-sw},${-20} L${-6},${-25.4} L6,${-25.4} L${sw},${-20} L${sw},${-14.6} L6,${-20.2} L-6,${-20.2} L${-sw},${-14.6} Z`, F);
  // fin tip above the wing, tailplane behind the cowl
  // LIVERY-STICKERS (9 Nov, the user: "the head-on plane is crowded; simplify it"): o.simple drops the fin, the struts
  // and the propeller blades: a thicker wing, a solid cabin (no windscreen), the cowl, two fatter tyres on their legs
  if (!o.simple) s += P('M-2.6,-25 L-1.6,-37 L1.6,-37 L2.6,-25 Z', F);
  // cabin and windscreen
  s += P('M-11,-21 L11,-21 L13,-4 L-13,-4 Z', F) + (o.simple ? ''   // no windscreen: the cabin is one solid with the wing and the cowl
    : P('M-7.4,-17.6 L7.4,-17.6 L8.6,-8.6 L-8.6,-8.6 Z', Hc));
  // lift struts (V from the lower fuselage to the wing)
  if (!o.simple) s += L.bar(-9, 8, -sw * 0.52, -17.6, lw, F) + L.bar(9, 8, sw * 0.52, -17.6, lw, F);
  // gear: legs splayed out to two fat tyres
  s += L.bar(-6, 10, -24, 26, lw, F) + L.bar(6, 10, 24, 26, lw, F);
  { const rx = o.simple ? 7.6 : 6.4, ry = o.simple ? 11.4 : 10.4;
    s += `<ellipse cx="-25" cy="27" rx="${rx}" ry="${ry}" fill="${F}"/><ellipse cx="25" cy="27" rx="${rx}" ry="${ry}" fill="${F}"/>`; }
  // cowl with the engine opening, and the propeller
  s += C(0, 2, 13, F) + C(0, 2, 7.6, Hc) + C(0, 2, 3.4, F);
  if (o.simple) return s;
  s += P('M-3,0.6 C-14,-4 -26,-7 -34,-6.6 C-36,-5.6 -35.6,-3.6 -33,-3 C-24,-1.6 -12,1.6 -2.6,4 Z', F);
  s += P('M3,3.4 C14,7.6 26,10.6 34,10.6 C36,9.6 35.6,7.6 33,7 C24,5.6 12,2.4 2.6,0 Z', F);
  return s;
}
module.exports = Object.assign({}, L, { swoosh, swooshC, ctx, CLIP, peak, tree, star, ring, cubMark, headOn });
