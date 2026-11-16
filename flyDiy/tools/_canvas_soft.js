// _canvas_soft.js - A SMALL SOFTWARE 2-D CANVAS FOR NODE (QUICKSHOT-ONE, 15 Nov): enough of CanvasRenderingContext2D
// for the livery's own painters (src/viewer/aeroskin.js: the kit patterns, the stickers, the registration's distance
// field) to run headless, so quickshot.js draws the livery the garage paints instead of part colours.
//
//   const CS = require('./_canvas_soft.js');  const cv = CS.canvas(w, h);  cv.getContext('2d') ...  cv.data (RGBA)
//
// What it does: paths (moveTo, lineTo, bezierCurveTo, quadraticCurveTo, arc, ellipse, rect, closePath) filled nonzero or
// evenodd, strokes (each segment a quad, round joins), fillRect / clearRect / strokeRect, solid colours (#rgb, #rrggbb,
// rgb(), rgba(), a few names), linear and radial gradients, globalAlpha, source-over and destination-out, save / restore,
// translate / scale / rotate / transform / setTransform, clip, getImageData / putImageData / createImageData, drawImage
// of another soft canvas.
// What it does NOT: anti-aliasing (one sample a pixel), shadows, filters, patterns, line dashes. TEXT has no font
// rasteriser in node: fillText / strokeText draw a 5 x 7 block face (A-Z, 0-9, '-', '.', '/', ' ') at the font's size,
// a STAND-IN for the face the player picked - the letters' place, size and colour are the game's, their shape is not.
'use strict';

// ---- the stand-in face: 5 x 7 cells, rows top to bottom, '#' lit -------------------------------------------------
const GLYPH = {   // seven rows of five, '|' between rows
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.', C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.', E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#', I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..', K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#...#|#...#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#', O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....', Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..', U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.', 2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
  3: '#####|...#.|..#..|...#.|....#|#...#|.###.', 4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '..##.|.#...|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|.#...|.#...|.#...', 8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  9: '.###.|#...#|#...#|.####|....#|...#.|.##..', '-': '.....|.....|.....|#####|.....|.....|.....', '.': '.....|.....|.....|.....|.....|.##..|.##..',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....', ' ': '.....|.....|.....|.....|.....|.....|.....',
};
const glyph = ch => { const g = GLYPH[String(ch).toUpperCase()]; return (g == null ? GLYPH['-'] : g).replace(/\|/g, ''); };

// ---- colours ---------------------------------------------------------------------------------------------------
const NAMED = { black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], transparent: [0, 0, 0, 0] };
function parseColor(c) {
  if (c == null) return [0, 0, 0, 1];
  if (typeof c === 'number') return [(c >> 16) & 255, (c >> 8) & 255, c & 255, 1];
  const s = String(c).trim().toLowerCase();
  if (s[0] === '#') {
    const h = s.slice(1), f = h.length <= 4 ? h.split('').map(x => parseInt(x + x, 16)) : [0, 2, 4, 6].map(i => parseInt(h.slice(i, i + 2), 16));
    return [f[0] || 0, f[1] || 0, f[2] || 0, f.length > 3 && !isNaN(f[3]) ? f[3] / 255 : 1];
  }
  const m = /^rgba?\(([^)]*)\)/.exec(s);
  if (m) { const v = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; }
  const n = NAMED[s]; return n ? [n[0], n[1], n[2], n.length > 3 ? n[3] : 1] : [0, 0, 0, 1];
}
function gradient(kind, a) {
  const stops = [];
  return { kind, a, stops, addColorStop(t, c) { stops.push([+t, parseColor(c)]); stops.sort((p, q) => p[0] - q[0]); },
    at(t) {
      if (!stops.length) return [0, 0, 0, 0];
      if (t <= stops[0][0]) return stops[0][1];
      for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], u = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
        return [0, 1, 2, 3].map(k => c0[k] + (c1[k] - c0[k]) * u);
      }
      return stops[stops.length - 1][1];
    } };
}

// ---- the canvas ------------------------------------------------------------------------------------------------
function canvas(w, h) {
  const cv = { style: {}, addEventListener() {}, removeEventListener() {}, toDataURL: () => 'data:,', soft: true };
  let W = Math.max(1, w | 0 || 300), H = Math.max(1, h | 0 || 150), data = new Uint8ClampedArray(W * H * 4);
  Object.defineProperty(cv, 'width', { get: () => W, set: v => { W = Math.max(1, v | 0); data = new Uint8ClampedArray(W * H * 4); }, enumerable: true });
  Object.defineProperty(cv, 'height', { get: () => H, set: v => { H = Math.max(1, v | 0); data = new Uint8ClampedArray(W * H * 4); }, enumerable: true });
  Object.defineProperty(cv, 'data', { get: () => data, enumerable: false });
  let ctx = null;
  cv.getContext = () => ctx || (ctx = context2d(cv));
  return cv;
}

function context2d(cv) {
  let S = { m: [1, 0, 0, 1, 0, 0], fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
            globalCompositeOperation: 'source-over', clip: null, font: '10px sans-serif', textAlign: 'start',
            textBaseline: 'alphabetic', lineJoin: 'miter', lineCap: 'butt', miterLimit: 10 };
  const stack = [];
  let path = [], cur = null;                     // subpaths of device-space points; cur = the open one
  const T = (x, y) => [S.m[0] * x + S.m[2] * y + S.m[4], S.m[1] * x + S.m[3] * y + S.m[5]];
  const inv = () => { const [a, b, c, d, e, f] = S.m, det = a * d - b * c || 1e-12;
    return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]; };
  const last = () => cur && cur.pts.length ? cur.pts[cur.pts.length - 1] : null;
  // the user point of the open subpath's last point (for curves)
  let lastU = null;
  const g = {
    canvas: cv,
    get fillStyle() { return S.fillStyle; }, set fillStyle(v) { S.fillStyle = v; },
    get strokeStyle() { return S.strokeStyle; }, set strokeStyle(v) { S.strokeStyle = v; },
    get lineWidth() { return S.lineWidth; }, set lineWidth(v) { if (v > 0) S.lineWidth = +v; },
    get globalAlpha() { return S.globalAlpha; }, set globalAlpha(v) { S.globalAlpha = Math.max(0, Math.min(1, +v)); },
    get globalCompositeOperation() { return S.globalCompositeOperation; }, set globalCompositeOperation(v) { S.globalCompositeOperation = v; },
    get font() { return S.font; }, set font(v) { S.font = v; },
    get textAlign() { return S.textAlign; }, set textAlign(v) { S.textAlign = v; },
    get textBaseline() { return S.textBaseline; }, set textBaseline(v) { S.textBaseline = v; },
    get lineJoin() { return S.lineJoin; }, set lineJoin(v) { S.lineJoin = v; },
    get lineCap() { return S.lineCap; }, set lineCap(v) { S.lineCap = v; },
    get miterLimit() { return S.miterLimit; }, set miterLimit(v) { S.miterLimit = v; },
    imageSmoothingEnabled: true, letterSpacing: '0px', shadowBlur: 0, shadowColor: 'transparent', filter: 'none',
    save() { stack.push(Object.assign({}, S, { m: S.m.slice() })); },
    restore() { if (stack.length) S = stack.pop(); },
    setTransform(a, b, c, d, e, f) { if (a && typeof a === 'object') ({ a, b, c, d, e, f } = a); S.m = [a, b, c, d, e, f]; },
    resetTransform() { S.m = [1, 0, 0, 1, 0, 0]; },
    getTransform() { const [a, b, c, d, e, f] = S.m; return { a, b, c, d, e, f }; },
    transform(a, b, c, d, e, f) { const m = S.m; S.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; },
    translate(x, y) { g.transform(1, 0, 0, 1, x, y); },
    scale(x, y) { g.transform(x, 0, 0, y, 0, 0); },
    rotate(r) { const c = Math.cos(r), s = Math.sin(r); g.transform(c, s, -s, c, 0, 0); },
    beginPath() { path = []; cur = null; lastU = null; },
    moveTo(x, y) { cur = { pts: [T(x, y)], closed: false }; path.push(cur); lastU = [x, y]; },
    lineTo(x, y) { if (!cur) return g.moveTo(x, y); cur.pts.push(T(x, y)); lastU = [x, y]; },
    closePath() { if (cur) { cur.closed = true; const p0 = cur.pts[0]; cur = { pts: [p0], closed: false }; path.push(cur); } },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      if (!lastU) g.moveTo(c1x, c1y);
      const [x0, y0] = lastU, n = 24;
      for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t;
        g.lineTo(u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x, u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y); }
    },
    quadraticCurveTo(cx, cy, x, y) {
      if (!lastU) g.moveTo(cx, cy);
      const [x0, y0] = lastU, n = 16;
      for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; g.lineTo(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y); }
    },
    ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
      let d = a1 - a0;
      if (ccw) { if (d > 0) d -= Math.ceil(d / (2 * Math.PI)) * 2 * Math.PI; if (d < -2 * Math.PI) d = -2 * Math.PI; }
      else { if (d < 0) d += Math.ceil(-d / (2 * Math.PI)) * 2 * Math.PI; if (d > 2 * Math.PI) d = 2 * Math.PI; }
      const n = Math.max(8, Math.ceil(Math.abs(d) / (Math.PI / 24))), cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
      for (let i = 0; i <= n; i++) { const a = a0 + d * i / n, ex = rx * Math.cos(a), ey = ry * Math.sin(a), px = x + ex * cr - ey * sr, py = y + ex * sr + ey * cr;
        if (i === 0 && cur) g.lineTo(px, py); else if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    },
    arc(x, y, r, a0, a1, ccw) { g.ellipse(x, y, r, r, 0, a0, a1, ccw); },
    rect(x, y, w, h) { g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); },
    roundRect(x, y, w, h) { g.rect(x, y, w, h); },
    fill(a, b) { const rule = typeof a === 'string' ? a : b; paint(polys(path), S.fillStyle, rule === 'evenodd'); },
    stroke() { paint(strokePolys(path, S.lineWidth), S.strokeStyle, false); },
    clip(a) {
      const rule = typeof a === 'string' ? a : 'nonzero', m = new Uint8Array(cv.width * cv.height);
      raster(polys(path), rule === 'evenodd', (i) => { m[i] = 1; });
      if (S.clip) for (let i = 0; i < m.length; i++) m[i] &= S.clip[i];
      S.clip = m;
    },
    fillRect(x, y, w, h) { const save = path; g.beginPath(); g.rect(x, y, w, h); paint(polys(path), S.fillStyle, false); path = save; },
    strokeRect(x, y, w, h) { const save = path; g.beginPath(); g.rect(x, y, w, h); g.stroke(); path = save; },
    clearRect(x, y, w, h) { const save = path, op = S.globalCompositeOperation; g.beginPath(); g.rect(x, y, w, h);
      raster(polys(path), false, i => { const d = cv.data; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = d[i * 4 + 3] = 0; }); path = save; S.globalCompositeOperation = op; },
    createLinearGradient(x0, y0, x1, y1) { return gradient('linear', [x0, y0, x1, y1]); },
    createRadialGradient(x0, y0, r0, x1, y1, r1) { return gradient('radial', [x0, y0, r0, x1, y1, r1]); },
    createPattern() { return '#808080'; },
    getImageData(x, y, w, h) {
      const out = new Uint8ClampedArray(w * h * 4), d = cv.data, W = cv.width, H = cv.height;
      for (let j = 0; j < h; j++) { const yy = y + j; if (yy < 0 || yy >= H) continue;
        for (let i = 0; i < w; i++) { const xx = x + i; if (xx < 0 || xx >= W) continue; const s = (yy * W + xx) * 4, o = (j * w + i) * 4;
          out[o] = d[s]; out[o + 1] = d[s + 1]; out[o + 2] = d[s + 2]; out[o + 3] = d[s + 3]; } }
      return { data: out, width: w, height: h };
    },
    createImageData(w, h) { if (w && typeof w === 'object') ({ width: w, height: h } = w); return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    putImageData(img, x, y) {
      const d = cv.data, W = cv.width, H = cv.height;
      for (let j = 0; j < img.height; j++) { const yy = y + j; if (yy < 0 || yy >= H) continue;
        for (let i = 0; i < img.width; i++) { const xx = x + i; if (xx < 0 || xx >= W) continue; const o = (yy * W + xx) * 4, s = (j * img.width + i) * 4;
          d[o] = img.data[s]; d[o + 1] = img.data[s + 1]; d[o + 2] = img.data[s + 2]; d[o + 3] = img.data[s + 3]; } }
    },
    drawImage(src, ...a) {       // another soft canvas (or {data,width,height}); (dx,dy) or (dx,dy,dw,dh) or the 9-argument form
      const sd = src && (src.data || (src.getContext && src.data)), sw = src && src.width, sh = src && src.height;
      if (!sd || !sw) return;
      let sx = 0, sy = 0, sW = sw, sH = sh, dx, dy, dw = sw, dh = sh;
      if (a.length === 2) [dx, dy] = a; else if (a.length === 4) [dx, dy, dw, dh] = a; else [sx, sy, sW, sH, dx, dy, dw, dh] = a;
      const iv = inv(), save = path; g.beginPath(); g.rect(dx, dy, dw, dh);
      raster(polys(path), false, (i, px, py) => { const ux = iv[0] * px + iv[2] * py + iv[4], uy = iv[1] * px + iv[3] * py + iv[5];
        const X = Math.floor(sx + (ux - dx) / dw * sW), Y = Math.floor(sy + (uy - dy) / dh * sH); if (X < 0 || Y < 0 || X >= sw || Y >= sh) return;
        const s = (Y * sw + X) * 4; blend(i, [sd[s], sd[s + 1], sd[s + 2], sd[s + 3] / 255]); });
      path = save;
    },
    measureText(t) {
      const px = fontPx(), w = String(t || '').length * px * 0.7;
      return { width: w, actualBoundingBoxAscent: px * 0.35, actualBoundingBoxDescent: px * 0.35, actualBoundingBoxLeft: 0, actualBoundingBoxRight: w };
    },
    fillText(t, x, y) { text(t, x, y, 0); },
    strokeText(t, x, y) { text(t, x, y, S.lineWidth / 2); },
    setLineDash() {}, getLineDash: () => [],
  };
  function fontPx() { const m = /(\d+(?:\.\d+)?)px/.exec(S.font || ''); return m ? +m[1] : 10; }
  // the stand-in face: each lit cell a rect, grown by `grow` (a stroke's half width) for strokeText
  function text(t, x, y, grow) {
    const s = String(t || ''), px = fontPx(), adv = px * 0.7, cw = px * 0.1, chh = px * 0.1, gw = 5 * cw, gh = 7 * chh;
    const tw = s.length * adv - (adv - gw);
    let x0 = x - (S.textAlign === 'center' ? tw / 2 : S.textAlign === 'right' || S.textAlign === 'end' ? tw : 0);
    const y0 = y - (S.textBaseline === 'middle' ? gh / 2 : S.textBaseline === 'top' ? 0 : S.textBaseline === 'bottom' ? gh : gh);
    const save = path; g.beginPath();
    for (let k = 0; k < s.length; k++) { const G = glyph(s[k]);
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (G[r * 5 + c] === '#')
        g.rect(x0 + k * adv + c * cw - grow, y0 + r * chh - grow, cw + 2 * grow, chh + 2 * grow); }
    paint(polys(path), grow ? S.strokeStyle : S.fillStyle, false);
    path = save;
  }
  // the path's subpaths as closed polygons (a fill closes every subpath)
  function polys(p) { return p.filter(s => s.pts.length > 2).map(s => s.pts); }
  // a stroke: each segment a quad (its own orientation normalised so nonzero is a union), a round join at each vertex
  function strokePolys(p, lw) {
    const out = [], hw = lw / 2, sc = Math.sqrt(Math.abs(S.m[0] * S.m[3] - S.m[1] * S.m[2])) || 1, r = hw * sc;
    const ccw = q => { let a = 0; for (let i = 0; i < q.length; i++) { const u = q[i], v = q[(i + 1) % q.length]; a += u[0] * v[1] - v[0] * u[1]; } return a < 0 ? q.reverse() : q; };
    for (const s of p) {
      const pts = s.closed ? s.pts.concat([s.pts[0]]) : s.pts;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 1e-9) continue;
        const nx = -dy / l * r, ny = dx / l * r;
        out.push(ccw([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]));
        if (i > 0 || s.closed) { const d = []; for (let k = 0; k < 12; k++) d.push([a[0] + r * Math.cos(k * Math.PI / 6), a[1] + r * Math.sin(k * Math.PI / 6)]); out.push(ccw(d)); }
      }
    }
    return out;
  }
  // scanline fill, pixel centres, nonzero or even-odd; cb(i, x, y) per covered pixel inside the clip
  function raster(P, evenodd, cb) {
    const W = cv.width, H = cv.height, edges = [];
    let y0 = Infinity, y1 = -Infinity;
    for (const q of P) for (let i = 0; i < q.length; i++) {
      const a = q[i], b = q[(i + 1) % q.length]; if (a[1] === b[1]) continue;
      edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1], 1] : [b[0], b[1], a[0], a[1], -1]);
      y0 = Math.min(y0, a[1], b[1]); y1 = Math.max(y1, a[1], b[1]);
    }
    const ys = Math.max(0, Math.floor(y0)), ye = Math.min(H - 1, Math.ceil(y1));
    for (let y = ys; y <= ye; y++) {
      const py = y + 0.5, xs = [];
      for (const e of edges) if (py >= e[1] && py < e[3]) xs.push([e[0] + (py - e[1]) / (e[3] - e[1]) * (e[2] - e[0]), e[4]]);
      if (!xs.length) continue;
      xs.sort((p, q) => p[0] - q[0]);
      let wn = 0;
      for (let k = 0; k + 1 < xs.length; k++) {
        wn += evenodd ? 1 : xs[k][1];
        const inside = evenodd ? (wn & 1) : wn !== 0;
        if (!inside) continue;
        const xa = Math.max(0, Math.ceil(xs[k][0] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[k + 1][0] - 0.5));
        for (let x = xa; x <= xb; x++) { const i = y * W + x; if (S.clip && !S.clip[i]) continue; cb(i, x + 0.5, py); }
      }
    }
  }
  function blend(i, c) {
    const d = cv.data, a = Math.max(0, Math.min(1, (c[3] == null ? 1 : c[3]) * S.globalAlpha)), o = i * 4;
    if (S.globalCompositeOperation === 'destination-out') { d[o + 3] = d[o + 3] * (1 - a); return; }
    if (S.globalCompositeOperation === 'copy') { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = a * 255; return; }
    const da = d[o + 3] / 255, oa = a + da * (1 - a);
    if (oa <= 0) { d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0; return; }
    for (let k = 0; k < 3; k++) d[o + k] = (c[k] * a + d[o + k] * da * (1 - a)) / oa;
    d[o + 3] = oa * 255;
  }
  function paint(P, style, evenodd) {
    if (style && typeof style === 'object' && style.at) {
      const iv = inv(), G = style, A = G.a;
      raster(P, evenodd, (i, px, py) => {
        const ux = iv[0] * px + iv[2] * py + iv[4], uy = iv[1] * px + iv[3] * py + iv[5];
        let t;
        if (G.kind === 'linear') { const dx = A[2] - A[0], dy = A[3] - A[1], l2 = dx * dx + dy * dy || 1e-12; t = ((ux - A[0]) * dx + (uy - A[1]) * dy) / l2; }
        else t = (Math.hypot(ux - A[3], uy - A[4]) - A[2]) / ((A[5] - A[2]) || 1e-12);
        blend(i, G.at(Math.max(0, Math.min(1, t))));
      });
      return;
    }
    const c = parseColor(style);
    raster(P, evenodd, i => blend(i, c));
  }
  return g;
}

module.exports = { canvas, parseColor };
