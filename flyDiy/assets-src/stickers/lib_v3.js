// shared drawing helpers for v3 (copied from v2/make_v2.js, 9 Nov): curves, tapered cuts, planes
const OUT = __dirname;
const I = '#fff', H = '#000';
const r2 = n => Math.round(n * 100) / 100;
const P = (d, f = I, ex = '') => `<path d="${d}" fill="${f}"${ex}/>`;
const C = (cx, cy, r, f = I) => `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${f}"/>`;
const G = (tr, inner, ex = '') => `<g transform="${tr}"${ex}>${inner}</g>`;
const CL = (id, inner) => `<g clip-path="url(#ID_${id})">${inner}</g>`;
const poly = pts => 'M' + pts.map(p => `${r2(p[0])},${r2(p[1])}`).join(' L') + ' Z';
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// a halo: the same shapes as a hole, grown by w/2 (the linocut gap that separates a figure from what is behind it)
const halo = (m, w) => m.replace(/fill="#fff"/g, `fill="#000" stroke="#000" stroke-width="${w}" stroke-linejoin="round"`);
const invert = m => m.replace(/fill="#(fff|000)"/g, (a, c) => c === 'fff' ? 'fill="#000"' : 'fill="#fff"');

// ---- curves ----
function curvePt(p, t) {
  if (p.length === 2) return [p[0][0] + (p[1][0] - p[0][0]) * t, p[0][1] + (p[1][1] - p[0][1]) * t];
  if (p.length === 3) { const u = 1 - t; return [u * u * p[0][0] + 2 * u * t * p[1][0] + t * t * p[2][0], u * u * p[0][1] + 2 * u * t * p[1][1] + t * t * p[2][1]]; }
  if (p.length === 4) { const u = 1 - t; return [0, 1].map(k => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]); }
  // catmull-rom through all points
  const n = p.length - 1, s = Math.min(n - 1e-9, t * n), i = Math.floor(s), u = s - i;
  const p0 = p[Math.max(0, i - 1)], p1 = p[i], q2 = p[i + 1], p3 = p[Math.min(n, i + 2)];
  return [0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + q2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * q2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * q2[k] + p3[k]) * u * u * u));
}
const PROF = {
  both: t => Math.pow(Math.sin(Math.PI * t), 0.55),
  end: t => Math.pow(Math.max(0, 1 - t), 0.6),          // full at start, point at end
  start: t => Math.pow(Math.max(0, t), 0.6),            // point at start, full at end
  flat: t => 1,
  blunt: t => 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * t), 0.5),
};
// a tapered cut (or ink stroke) along a curve: the carving tool's mark
function sliver(pts, w, f = H, prof = 'both', N = 24) {
  const pr = PROF[prof], L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = curvePt(pts, Math.max(0, t - 0.01)), b = curvePt(pts, Math.min(1, t + 0.01)), c = curvePt(pts, t);
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const h = w / 2 * pr(t);
    L.push([c[0] - dy * h, c[1] + dx * h]); R.unshift([c[0] + dy * h, c[1] - dx * h]);
  }
  return P(poly(L.concat(R)), f);
}
// a straight bar of width w between two points (struts, gear legs)
function bar(x1, y1, x2, y2, w, f = I) {
  let dx = x2 - x1, dy = y2 - y1; const l = Math.hypot(dx, dy); dx /= l; dy /= l; const h = w / 2;
  return P(poly([[x1 - dy * h, y1 + dx * h], [x2 - dy * h, y2 + dx * h], [x2 + dy * h, y2 - dx * h], [x1 + dy * h, y1 - dx * h]]), f);
}
// snow on a peak: a cap inset e below the skyline, with a ragged lower edge (tongues running down the gullies)
function snowcap(A, Lp, Rp, f, e, rnd, n = 5) {
  const off = (P0, P1) => { let dx = P1[0] - P0[0], dy = P1[1] - P0[1]; const l = Math.hypot(dx, dy); let nx = dy / l, ny = -dx / l; if (ny < 0) { nx = -nx; ny = -ny; } return [nx * e, ny * e]; };
  const oL = off(A, Lp), oR = off(A, Rp);
  // intersection of the two offset lines
  const a1 = [A[0] + oL[0], A[1] + oL[1]], d1 = [Lp[0] - A[0], Lp[1] - A[1]], a2 = [A[0] + oR[0], A[1] + oR[1]], d2 = [Rp[0] - A[0], Rp[1] - A[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0], t = ((a2[0] - a1[0]) * d2[1] - (a2[1] - a1[1]) * d2[0]) / den;
  const Ap = [a1[0] + d1[0] * t, a1[1] + d1[1] * t];
  const pl = [Ap[0] + d1[0] * f, Ap[1] + d1[1] * f], pr = [Ap[0] + d2[0] * f * 0.8, Ap[1] + d2[1] * f * 0.8];
  const pts = [Ap, pl];
  for (let i = 1; i < n; i++) {
    const u = i / n, x = pl[0] + (pr[0] - pl[0]) * u, yb = pl[1] + (pr[1] - pl[1]) * u;
    const depth = Math.abs(d1[1] * f) * 0.55;
    pts.push([x - 1, yb + (i % 2 ? depth * (0.5 + 0.6 * rnd()) : -depth * 0.25 * rnd())]);
  }
  pts.push(pr);
  return P(poly(pts), H);
}
// a spruce: narrow spire, drooping uneven branch tiers (base centre x,y; height h; width w)
function spruce(x, y, h, w, rnd, opt = {}) {
  const top = y - h, cb = y - h * (opt.trunk ?? 0.07), n = opt.tiers ?? Math.max(6, Math.round(h / 6.5));
  const L = [], R = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, yt = top + (cb - top) * Math.pow(t, 0.92), th = (cb - top) / n;
    const club = opt.club ? (t < 0.25 ? 0.75 : 1) : 1;
    for (const side of [-1, 1]) {
      const hw = w / 2 * (0.1 + 0.9 * Math.pow(t, 0.85)) * (0.82 + 0.36 * rnd()) * club;
      const droop = th * (0.15 + 0.35 * rnd());
      const tip = [x + side * hw, yt + droop], notch = [x + side * hw * (0.3 + 0.15 * rnd()), yt - th * 0.45];
      (side < 0 ? L : R).push(notch, tip);
    }
  }
  const tw = Math.max(opt.minTrunk ?? 1.4, w * 0.05);
  const pts = [[x, top - h * 0.02]].concat(L, [[x - tw, cb], [x - tw, y], [x + tw, y], [x + tw, cb]], R.reverse());
  return poly(pts);
}

// ---- the grizzly: walking, facing right (local 0..200 x 0..106, paws on y=104) ----
function bearPath(open) {
  // proportions: hump 90 above the paws, belly ~36 above, head carried low, nose at ~0.55 of the hump height
  const head = open
    ? 'C195,49 195.4,53 192.8,54.4 C190,55.4 187,55.6 184,55.6 L176,58.4 L186.6,61.6 C189.4,62.4 189,66 185.6,66.4 C179.6,67.4 174.6,67 170.6,65.4 C166.6,66.2 163.6,66.6 161,67.6'
    : 'C195,49 195.4,53.4 192.6,54.8 C190,56 187,56.2 184.6,57 C182.6,60.6 178.6,63.4 173.4,64 C168.6,65 164.4,65.6 161,67';
  return 'M20,50 C20,34 30,24 46,23 C62,22 76,27 92,26 C104,25 112,15 126,13 C136,12 143,18 147,25 C149,29 150,31.4 151,33 ' +
    'C150,28 154,25 157.5,26.5 C160.5,28 160.6,31.5 158.6,33.6 C163,33.8 167,35.4 170.4,38 ' +
    'C173,40.4 176,42.6 180.4,43.6 C185,44.6 189,45.6 192,47.4 ' + head + ' ' +
    'C157,69 156,74 157,79 C158.5,86 161,93 163.5,98 C165,100 168.5,100.4 171,101 C173.5,101.8 173,104.4 170,104.4 ' +
    'L150,104.4 C147,104.4 146.4,101 147.6,98.6 C146.6,92 145.4,85 143,79.6 C141,76.6 138,76.6 136.4,79 ' +
    'C135.4,86 135,95 135.2,100 L135.8,104.4 L118.6,104.4 C116.4,104.4 116,101.4 117.4,99.4 C119,93 119.6,84 118.4,76 ' +
    'C114,72 112,74.6 108.6,77.8 C106.6,74.6 104,72.6 100.6,72 C98.6,74.6 96,76.4 92.4,77.2 C91,74 88.4,72 84.4,71.2 C82,73.4 79.4,74.6 76.6,75 C76,72.6 75.4,71.2 74.4,70.4 ' +
    'C75.6,78 77.6,90 79.6,99 L81,104.4 L63,104.4 C61,104.4 61,101.4 62,99.6 C62.4,93 60.4,86 57.6,81.6 ' +
    'C55,79.6 51.6,80 49,82 C45,88 40.6,94 37.6,99 L38.6,104.4 L16.4,104.4 C13,104.4 12,100.6 14.4,98.6 ' +
    'C16.4,95 17.6,90 17.6,84 C15.4,76 15,62 20,50 Z';
}
// the top line of the bear (x -> y), for carving the fur along the back
const BEAR_TOP = [[20, 50], [24, 32], [32, 26], [46, 23], [62, 23.2], [76, 26], [92, 26], [104, 23.6], [112, 17], [126, 13], [136, 13.4], [143, 18], [147, 25]];
const topY = x => { for (let i = 1; i < BEAR_TOP.length; i++) if (x <= BEAR_TOP[i][0]) { const [x0, y0] = BEAR_TOP[i - 1], [x1, y1] = BEAR_TOP[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return 25; };
function bear(o = {}) {
  const w = o.cut ?? 3.0;
  let s = P(bearPath(o.open), I);
  // claws: long pale claws on the near forepaw, curving down to the ground
  for (const [y0, k] of [[99.6, 0], [101.9, 1], [104, 2]]) s += sliver([[168, y0 - 0.8], [175 + k * 0.6, y0 - 0.6], [180 + k * 0.4, y0 + 1.8]], 2.7, I, 'end');
  if (o.plain) return s;
  // contour cuts: the near foreleg and shoulder, the near thigh, the cheek ruff, the far legs
  s += sliver([[128, 24], [127, 46], [133, 64], [142.4, 78]], w * 1.15, H);
  s += sliver([[48, 30], [60, 48], [58, 68], [50, 81]], w * 1.15, H);
  s += sliver([[160.6, 35], [163, 48], [168, 59.6]], w, H);
  s += sliver([[121.6, 78], [121, 88], [119.4, 97]], w * 0.9, H, 'start');
  s += sliver([[73, 76], [72, 86], [70, 95]], w * 0.9, H, 'start');
  // the light on the coat: rows of short fur cuts raked back along the top line, thinning out down the flank
  const rows = [[6.4, 11.5, 8.6, 54, 146], [14, 9.5, 9.6, 98, 140]];
  rows.forEach(([d, len, step, xa, xb], ri) => {
    for (let x = xa + (ri % 2) * step / 2; x <= xb; x += step) {
      if (x > 120 && x < 136 && ri > 0 && Math.abs(x - 128) < 4) continue;   // keep the shoulder cut clean
      const y = topY(x) + d, sl = (topY(x + 2) - topY(x - 2)) / 4;              // slope of the back here
      const ang = Math.atan(sl) + 0.5, L = len * (0.85 + 0.3 * Math.abs(Math.sin(x * 1.7)));
      s += sliver([[x, y], [x - Math.cos(ang) * L * 0.55, y + Math.sin(ang) * L * 0.5 - 0.8], [x - Math.cos(ang) * L, y + Math.sin(ang) * L]], w * 0.9, H, 'end');
    }
  });
  // the ruff on the neck and the long hair behind the forearm
  for (const [x, y] of [[150, 40], [153, 47], [152.6, 55]]) s += sliver([[x, y], [x - 3, y + 3], [x - 7, y + 4]], w, H, 'end');
  s += sliver([[146.4, 84], [147.6, 89], [148.6, 93]], w * 0.9, H);
  s += `<ellipse cx="175.6" cy="41.8" rx="2" ry="1.7" fill="${H}"/>`;                     // eye
  if (!o.open) s += sliver([[192.4, 55], [186.6, 56.4], [179, 58.8]], 2.6, H, 'end');      // mouth
  s += sliver([[193.2, 49.2], [194.2, 50.8], [193.8, 52.4]], 2.4, H);                             // nostril
  return s;
}

// ---- the radial-engine floatplane (Beaver-like), side view facing right (local ~18..205 x 8..112; 1 m = 20 u) ----
function beaver(o = {}) {
  const lw = o.lw ?? 3, F = o.F ?? I, Hc = F === I ? H : I, det = o.detail !== false;
  let s = '';
  // float: upturned bow, straight deck, keel down to the step under the wing, afterbody rising to the stern
  s += P('M46,95 L186,95 C194,95 200.5,92 204.5,88.6 C206,92 204,97 199.5,101 C193.5,106.4 184.5,109.4 174,110.4 L121,111.4 L118.6,106.6 L53,100.6 C49,100.2 46,98.4 46,95 Z', F);
  s += P('M48.5,98 L43.5,98 L39,106.5 L43.5,107 Z', F);                      // water rudder
  // float struts (an N pair front and rear) and the wing strut
  s += bar(165, 70, 168, 96, lw, F) + bar(149, 72.5, 166.5, 96, lw, F) + bar(125.5, 73, 122, 96, lw, F) + bar(108, 70.5, 121.5, 96, lw, F);
  s += bar(149, 71, 143.6, 33, lw, F);
  // fuselage with the round radial cowl
  s += P('M20,47.6 L118,33.2 L150,32 L163.5,41.6 C165,42.6 167,42.8 169,42.8 L183,42.6 C189.6,42.6 192.4,49.4 192.4,56.4 C192.4,63.6 189.6,70.4 183,70.4 L169,70.4 C159,72.4 141,74.2 127,74 C100,72.4 60,62.4 22.4,54.2 C18.4,53.4 17.6,48.6 20,47.6 Z', F);
  // high wing seen at the root: rounded leading edge forward
  s += P('M114,34 C118,29.2 138,27 150,27.4 C154,27.6 157,29.2 157,31.4 C157,33.4 154.6,34.6 150.4,34.6 L114,34.6 Z', F);
  // tall fin, straight swept leading edge, rounded top; rudder trailing edge almost upright
  s += P('M66,45 C58,34 50,21 44.5,13 C42.6,10 39.6,8.4 35.4,8.4 L28,8.4 C23.6,8.4 21.4,11.2 21.2,15.6 L19,48.4 Z', F);
  s += P('M12,48.6 C12,47 13.4,46.6 15,46.6 L42,45.6 L54,46.8 L42,50.4 L15,51.2 C13.4,51.2 12,50.6 12,48.6 Z', F);   // stabiliser
  // propeller: spinner and two blades (tips at 2.7 m)
  s += P('M191.5,51.6 C196.5,51.6 199.6,54.2 199.6,56.4 C199.6,58.6 196.5,61.2 191.5,61.2 Z', F);
  s += P(`M${193.4 - lw * 0.15},53 C${192.2 - lw * 0.3},44 ${193 - lw * 0.3},35 ${195.2 - lw * 0.3},29.6 C${197.4 + lw * 0.2},28.8 ${198.4 + lw * 0.3},31 ${197.8 + lw * 0.3},34 L${196.6 + lw * 0.2},53 Z`, F);
  s += P(`M${193.4 - lw * 0.15},60 C${192.2 - lw * 0.3},69 ${193 - lw * 0.3},78 ${195.2 - lw * 0.3},83.4 C${197.4 + lw * 0.2},84.2 ${198.4 + lw * 0.3},82 ${197.8 + lw * 0.3},79 L${196.6 + lw * 0.2},60 Z`, F);
  if (det) {
    const g = Math.max(3.2, lw), top = 34.6 + Math.max(2.4, lw * 0.75), bot = 48.6;
    // three cabin windows: the rear one, the door, the front one raked parallel to the windscreen
    s += P(`M${110},${top + 1} L${124 - g / 2},${top} L${124 - g / 2},${bot - 1} L${112},${bot - 1.6} Z`, Hc);
    s += P(`M${124 + g / 2},${top} L${142 - g / 2},${top} L${142 - g / 2},${bot} L${124 + g / 2},${bot} Z`, Hc);
    s += P(`M${142 + g / 2},${top} L${150},${top} L${150 + (bot - top) * 0.62},${bot} L${142 + g / 2},${bot} Z`, Hc);
    s += sliver([[170.6, 44.4], [169.4, 56.4], [170.6, 68.6]], Math.max(2.4, lw * 0.8), Hc);       // cowl seam
    s += sliver([[186.6, 45.6], [189.4, 56.4], [186.6, 67.4]], Math.max(2.4, lw * 0.8), Hc);       // cowl lip
    s += sliver([[29, 10.5], [27.6, 28], [26.8, 46]], Math.max(2.2, lw * 0.7), Hc);               // rudder hinge
    s += sliver([[60, 99.4], [120, 100.4], [184, 99.6]], Math.max(2.2, lw * 0.7), Hc);            // float chine
  }
  return s;
}

// ---- the STOL taildragger (Cub-like), level attitude, facing right (local ~-6..147 x -20..50; axle at 110,40) ----
function cub(o = {}) {
  const lw = o.lw ?? 2.6, F = o.F ?? I, Hc = F === I ? H : I, det = o.detail !== false, tr = o.tyre ?? 10.5;
  let s = '';
  s += bar(101.5, 20.5, 112.6, -9.6, lw, F) + bar(101.5, 20.5, 89, -9.6, lw, F);                 // V lift struts
  s += P('M3,7.2 L84,-9.6 L114,-9.6 L124.4,1.4 C128,1.4 132,1.4 134.4,2 C138.4,3 140.4,6 140.4,9.4 C140.4,14 138.4,17 134.4,18 L124.4,19.4 C116,21 106,22 100,22.2 L5.4,11.8 C2.4,11.4 1.2,8.6 3,7.2 Z', F);
  s += P('M80,-9.4 C84,-13.6 104,-15.4 112,-15 C116,-14.8 118.6,-13.2 118.6,-11.6 C118.6,-10.2 116.4,-9.2 113,-9.2 L80,-9.2 Z', F);   // wing
  s += P('M23,5.4 C19,-1 15,-9 11.6,-14.4 C9.4,-18 5.4,-19.4 2.6,-18 C-0.6,-16.4 -1.6,-12 -1.6,-7 L-0.6,6.6 L3.4,7.4 Z', F);       // round Cub fin and rudder
  s += P('M-5,7.6 C-5,6.4 -4,6 -3,6 L20,5.6 L28,6.8 L20,8.8 L-3,9.4 C-4,9.4 -5,9 -5,7.6 Z', F);                                   // stabiliser
  s += P('M139.6,5.6 C144,5.6 146.6,7.6 146.6,9.4 C146.6,11.2 144,13.2 139.6,13.2 Z', F);                                         // spinner
  s += P(`M${142 - lw * 0.2},6.4 C${141.4 - lw * 0.3},0 ${142 - lw * 0.3},-6 ${143.2 - lw * 0.3},-9.4 C${144.8 + lw * 0.2},-10 ${145.6 + lw * 0.3},-8.6 ${145.2 + lw * 0.3},-6.4 L${144.6 + lw * 0.2},6.4 Z`, F);
  s += P(`M${142 - lw * 0.2},12.4 C${141.4 - lw * 0.3},19 ${142 - lw * 0.3},25 ${143.2 - lw * 0.3},28.4 C${144.8 + lw * 0.2},29 ${145.6 + lw * 0.3},27.6 ${145.2 + lw * 0.3},25.4 L${144.6 + lw * 0.2},12.4 Z`, F);
  // main gear: the vee and the axle, then the big low-pressure tundra tyre
  s += bar(106, 20, 110, 40, lw * 1.1, F) + bar(96.4, 21, 110, 40, lw, F);
  s += C(110, 40, tr, F);
  if (det) {
    const g = Math.max(2.6, lw);
    s += P(`M${90},${-9.2 + g} L${105 - g / 2},${-9.2 + g} L${105 - g / 2},${6} L${90},${6} Z`, Hc);
    s += P(`M${105 + g / 2},${-9.2 + g} L${113.4},${-9.2 + g} L${121.4 - g * 0.4},${2.4} L${121.4 - g * 0.4},${6} L${105 + g / 2},${6} Z`, Hc);
    // struts over the window
    s += bar(101.5, 20.5, 112.6, -9.6, lw, F) + bar(101.5, 20.5, 89, -9.6, lw, F);
    s += sliver([[125.6, 3.2], [124.8, 10.4], [125.6, 17.6]], Math.max(2.2, lw * 0.85), Hc);                        // cowl seam
    // tyre: rim cut and a hub
    const rr = tr * 0.52;
    s += `<path d="M${110 - rr - g * 0.5},40 a${rr + g * 0.5},${rr + g * 0.5} 0 1,0 ${2 * (rr + g * 0.5)},0 a${rr + g * 0.5},${rr + g * 0.5} 0 1,0 ${-2 * (rr + g * 0.5)},0Z M${110 - rr},40 a${rr},${rr} 0 1,0 ${2 * rr},0 a${rr},${rr} 0 1,0 ${-2 * rr},0Z" fill="${Hc}" fill-rule="evenodd"/>`;
    s += bar(106, 20, 110, 40, lw * 1.1, F);
  }
  // tailwheel on its spring
  s += bar(3.4, 10, -1.6, 16.8, lw * 0.9, F) + C(-1.6, 17.6, Math.max(3, lw * 1.15), F);
  return s;
}
// the rotation that puts the cub on three points (main tyre and tailwheel on the ground)
function cubThreePointDeg(tr = 10.5, lw = 2.6) {
  const tw = Math.max(3, lw * 1.15), ax = 110, ay = 40, tx = -1.6, ty = 17.6;
  // tyre bottom at ay+tr; tailwheel bottom (after rotation) at same y
  let best = 0, err = 1e9;
  for (let a = 0; a < 25; a += 0.05) {
    const r = -a * Math.PI / 180, dx = tx - ax, dy = ty - ay;
    const y = ay + dx * Math.sin(r) + dy * Math.cos(r) + tw;
    const e = Math.abs(y - (ay + tr)); if (e < err) { err = e; best = a; }
  }
  return -best;
}

module.exports = { I, H, r2, P, C, G, CL, poly, rng, halo, curvePt, sliver, bar, snowcap, spruce, beaver, cub, cubThreePointDeg, bear, bearPath };
