// _c2d_digest.js - A 2D CANVAS THAT KNOWS WHAT IT HOLDS, for the page in node (G2220, FLEET-PROPS A).
//
// The node page's 2D context (tools/_page_node.js make2D) draws nothing and reads back zeros, so an atlas the page
// paints (aeroskin's decal atlas, the parked capture's copy of it) has no pixels to hash. GATE PARKED 11 must still
// tell whether the SAME build captured under two different player builds yields the same atlas. This context keeps,
// per canvas, the list of the draws that are still VISIBLE - each draw with everything that decides its pixels (the
// call, its arguments, the transform, the clip, the styles, the source canvas's or image's own digest) and its
// device-space box - and a draw that certainly covers an earlier one (clearRect, an opaque fillRect, putImageData or a
// 'copy' draw, axis-aligned, unclipped, whose box holds the earlier one's whole box) takes it off the list. A canvas's
// DIGEST is its size and that list: two canvases with equal digests were painted the same; a history that ended in
// the same visible draws digests the same however it got there (a page cleared and redrawn, the size set again). It is
// a CONSERVATIVE model: a draw it cannot bound (an unbounded path, a filter) is never removed, so two equal pictures
// reached by different histories may digest apart (a false red, never a false green: equal digests mean equal draws).
//
//   const C2D = require('./_c2d_digest.js');
//   C2D.make(canvas, io)    -> the context (getContext('2d')'s answer in the page)
//   C2D.digest(x)           -> the digest of a canvas / image / ImageData (any source drawImage takes)
'use strict';
const crypto = require('crypto');
const H = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const r6 = v => (typeof v === 'number' ? (Number.isFinite(v) ? +v.toFixed(5) : String(v)) : v);
let uid = 0;

function digest(x) {
  if (x == null) return 'null';
  if (typeof x === 'string') return 's:' + H(x);
  if (x.__c2d) return x.__c2d();                                     // a gradient / pattern / ImageData of ours
  if (x.localName === 'canvas' || (x._ctx !== undefined && 'width' in x)) {
    const c = x._ctx;
    if (c && c.kind === '2d' && c.ctx && c.ctx.__digest) return c.ctx.__digest();
    if (c && c.ctx) return 'gl:' + (x.__uid || (x.__uid = ++uid)) + ':' + x.width + 'x' + x.height;   // a GL canvas: its identity
    return 'blank:' + x.width + 'x' + x.height;
  }
  if (x.localName === 'img' || typeof x.src === 'string') return 'img:' + H(String(x.src || '')) + ':' + (x.naturalWidth || x.width || 0);
  if (x.data && x.data.length !== undefined && 'width' in x) return 'id:' + x.width + 'x' + x.height + ':' + H(Buffer.from(x.data.buffer, x.data.byteOffset, x.data.byteLength));
  return 'obj:' + (x.__uid || (x.__uid = ++uid));
}
const opaqueColour = c => {
  if (typeof c !== 'string') return false;
  const s = c.trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(s)) return true;
  if (/^#[0-9a-f]{4}$/.test(s)) return s[4] === 'f';
  if (/^#[0-9a-f]{8}$/.test(s)) return s.slice(7) === 'ff';
  const m = /^(rgba|hsla)\(([^)]*)\)$/.exec(s);
  if (m) { const p = m[2].split(/[ ,\/]+/).filter(Boolean); return p.length < 4 || +p[3] >= 1; }
  return /^(rgb|hsl)\(/.test(s) || /^[a-z]+$/.test(s) && s !== 'transparent';
};

function make(cv, io) {
  io = io || {};
  const STYLE = { fillStyle: '#000', strokeStyle: '#000', font: '10px sans-serif', globalAlpha: 1, lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
                  miterLimit: 10, textAlign: 'start', textBaseline: 'alphabetic', direction: 'ltr', globalCompositeOperation: 'source-over',
                  imageSmoothingEnabled: true, imageSmoothingQuality: 'low', filter: 'none', shadowBlur: 0, shadowColor: 'rgba(0, 0, 0, 0)',
                  shadowOffsetX: 0, shadowOffsetY: 0, lineDashOffset: 0, letterSpacing: '0px', fontKerning: 'auto' };
  let st = Object.assign({ m: [1, 0, 0, 1, 0, 0], clip: '', dash: [] }, STYLE);
  const stack = [];
  let ops = [], path = null, size = '';
  const sized = () => { const s = cv.width + 'x' + cv.height; if (s !== size) { size = s; ops = []; } };
  const styleKey = () => { const o = []; for (const k in STYLE) { const v = st[k]; o.push(k + '=' + (v && typeof v === 'object' ? digest(v) : r6(v))); } return o.join(';') + ';dash=' + st.dash.join(',') + ';clip=' + st.clip; };
  const tp = (x, y) => { const m = st.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; };
  const boxOf = pts => { if (!pts.length) return null; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null; x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    return [x0, y0, x1, y1]; };
  const rectBox = (x, y, w, h) => boxOf([tp(x, y), tp(x + w, y), tp(x, y + h), tp(x + w, y + h)]);
  const axisAligned = () => Math.abs(st.m[1]) < 1e-12 && Math.abs(st.m[2]) < 1e-12;
  const inside = (a, b) => a && b && a[0] >= b[0] - 1e-6 && a[1] >= b[1] - 1e-6 && a[2] <= b[2] + 1e-6 && a[3] <= b[3] + 1e-6;
  const meets = (a, b) => !a || !b || (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]);
  const push = (name, args, box, extra) => {
    sized();
    const d = name + '(' + args.map(a => (a && typeof a === 'object' ? digest(a) : r6(a))).join(',') + ')' + (extra || '') + '|m=' + st.m.map(r6).join(',') + '|' + styleKey();
    ops.push({ d: H(d), box });
  };
  // a draw that certainly replaces every pixel of `box`: the earlier draws wholly inside it are gone
  const cover = box => { sized(); if (!box) return; ops = ops.filter(o => !inside(o.box, box)); };
  const exactRect = (x, y, w, h) => (axisAligned() && !st.clip) ? rectBox(x, y, w, h) : null;
  const gradient = (kind, args) => { const stops = []; const g = { addColorStop: (o, c) => { stops.push(r6(o) + ':' + c); }, __c2d: () => kind + '(' + args.map(r6).join(',') + ')[' + stops.join(';') + ']' }; return g; };
  const imgData = (w, h) => { const o = { width: w | 0, height: h | 0, data: new Uint8ClampedArray(Math.max(0, (w | 0) * (h | 0) * 4)), colorSpace: 'srgb' }; return o; };
  const pathPts = () => (path || (path = { d: [], pts: [] }));
  const P = (name, args, pts) => { const p = pathPts(); p.d.push(name + '(' + args.map(r6).join(',') + ')'); for (const q of pts) p.pts.push(tp(q[0], q[1])); };
  const fns = {
    save: () => { stack.push(Object.assign({}, st, { m: st.m.slice(), dash: st.dash.slice() })); },
    restore: () => { if (stack.length) st = stack.pop(); },
    setTransform: (a, b, c, d, e, f) => { if (a && typeof a === 'object') { st.m = [a.a, a.b, a.c, a.d, a.e, a.f]; } else st.m = [a, b, c, d, e, f].map(v => +v || 0); },
    resetTransform: () => { st.m = [1, 0, 0, 1, 0, 0]; },
    transform: (a, b, c, d, e, f) => { const m = st.m; st.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; },
    translate: (x, y) => fns.transform(1, 0, 0, 1, x, y),
    scale: (x, y) => fns.transform(x, 0, 0, y, 0, 0),
    rotate: a => fns.transform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0),
    getTransform: () => ({ a: st.m[0], b: st.m[1], c: st.m[2], d: st.m[3], e: st.m[4], f: st.m[5], invertSelf() { return this; }, multiplySelf() { return this; } }),
    setLineDash: a => { st.dash = Array.from(a || [], r6); }, getLineDash: () => st.dash.slice(),
    beginPath: () => { path = { d: [], pts: [] }; },
    closePath: () => P('Z', [], []),
    moveTo: (x, y) => P('M', [x, y], [[x, y]]), lineTo: (x, y) => P('L', [x, y], [[x, y]]),
    quadraticCurveTo: (a, b, x, y) => P('Q', [a, b, x, y], [[a, b], [x, y]]),
    bezierCurveTo: (a, b, c, d, x, y) => P('C', [a, b, c, d, x, y], [[a, b], [c, d], [x, y]]),
    arcTo: (a, b, c, d, r) => P('AT', [a, b, c, d, r], [[a, b], [c, d]]),
    rect: (x, y, w, h) => P('R', [x, y, w, h], [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]),
    roundRect: (x, y, w, h, r) => P('RR', [x, y, w, h, JSON.stringify(r)], [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]),
    arc: (x, y, r, a0, a1, ccw) => P('A', [x, y, r, a0, a1, !!ccw], [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]),
    ellipse: (x, y, rx, ry, rot, a0, a1, ccw) => { const R = Math.max(rx, ry); P('E', [x, y, rx, ry, rot, a0, a1, !!ccw], [[x - R, y - R], [x + R, y - R], [x - R, y + R], [x + R, y + R]]); },
    fill: rule => { const p = path || { d: [], pts: [] }; push('fill', [typeof rule === 'string' ? rule : 'nonzero'], boxOf(p.pts), p.d.join('')); },
    stroke: () => { const p = path || { d: [], pts: [] }; const b = boxOf(p.pts), w = st.lineWidth * Math.max(Math.hypot(st.m[0], st.m[1]), Math.hypot(st.m[2], st.m[3])) + 2;
      push('stroke', [], b ? [b[0] - w, b[1] - w, b[2] + w, b[3] + w] : null, p.d.join('')); },
    clip: rule => { const p = path || { d: [], pts: [] }; st.clip = H(st.clip + '|' + (typeof rule === 'string' ? rule : 'nonzero') + p.d.join('') + '|m=' + st.m.map(r6).join(',')); },
    clearRect: (x, y, w, h) => {
      const ex = exactRect(x, y, w, h);
      if (ex) { cover(ex); if (ops.some(o => meets(o.box, ex))) push('clearRect', [x, y, w, h], ex); }
      else push('clearRect', [x, y, w, h], rectBox(x, y, w, h));
    },
    fillRect: (x, y, w, h) => {
      const ex = exactRect(x, y, w, h);
      if (ex && st.globalAlpha >= 1 && (st.globalCompositeOperation === 'source-over' || st.globalCompositeOperation === 'copy') && opaqueColour(st.fillStyle) && st.filter === 'none') cover(ex);
      push('fillRect', [x, y, w, h], rectBox(x, y, w, h));
    },
    strokeRect: (x, y, w, h) => { const b = rectBox(x, y, w, h), e = st.lineWidth + 2; push('strokeRect', [x, y, w, h], b ? [b[0] - e, b[1] - e, b[2] + e, b[3] + e] : null); },
    fillText: (t, x, y, mw) => { const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(st.font) ? /(\d+(?:\.\d+)?)px/.exec(st.font)[1] : 10) || 10, w = String(t).length * px;
      push('fillText', [String(t), x, y, mw === undefined ? null : mw], rectBox(x - w, y - 2 * px, 2 * w, 4 * px)); },
    strokeText: (t, x, y, mw) => { const px = 40, w = String(t).length * px; push('strokeText', [String(t), x, y, mw === undefined ? null : mw], rectBox(x - w, y - 2 * px, 2 * w, 4 * px)); },
    drawImage: (img, ...a) => {
      io.c2dDraw = (io.c2dDraw || 0) + 1;
      let s = null, dx, dy, dw, dh;
      if (a.length >= 8) { s = a.slice(0, 4); [dx, dy, dw, dh] = a.slice(4, 8); }
      else if (a.length >= 4) [dx, dy, dw, dh] = a;
      else { [dx, dy] = a; dw = img && (img.width || img.naturalWidth) || 0; dh = img && (img.height || img.naturalHeight) || 0; }
      const ex = exactRect(dx, dy, dw, dh);
      if (ex && st.globalCompositeOperation === 'copy') cover(ex);
      push('drawImage', [img].concat(s || []).concat([dx, dy, dw, dh]), rectBox(dx, dy, dw, dh));
    },
    putImageData: (im, dx, dy, x0, y0, w0, h0) => {
      io.c2dPut = (io.c2dPut || 0) + 1;
      const w = w0 === undefined ? im.width : w0, h = h0 === undefined ? im.height : h0, ox = x0 || 0, oy = y0 || 0;
      sized();
      const box = [dx + ox, dy + oy, dx + ox + w, dy + oy + h];      // device space: putImageData ignores the transform and the clip
      ops = ops.filter(o => !inside(o.box, box));
      const d = 'putImageData(' + digest(im) + ',' + [dx, dy, ox, oy, w, h].map(r6).join(',') + ')';
      ops.push({ d: H(d), box });
    },
    getImageData: (x, y, w, h) => { io.c2dRead = (io.c2dRead || 0) + 1; io.c2dReadBytes = (io.c2dReadBytes || 0) + Math.max(0, (w | 0) * (h | 0) * 4); return imgData(w, h); },
    createImageData: (w, h) => (typeof w === 'object' ? imgData(w.width, w.height) : imgData(w, h)),
    measureText: s => ({ width: String(s).length * 6, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(s).length * 6, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }),
    createLinearGradient: (...a) => gradient('lin', a), createRadialGradient: (...a) => gradient('rad', a), createConicGradient: (...a) => gradient('con', a),
    createPattern: (img, rep) => { const o = { setTransform: m => { o.m = m ? [m.a, m.b, m.c, m.d, m.e, m.f].map(r6).join(',') : ''; }, m: '', __c2d: () => 'pat(' + digest(img) + ',' + rep + ',' + o.m + ')' }; return o; },
    isPointInPath: () => false, isPointInStroke: () => false,
    getContextAttributes: () => ({ alpha: true }),
    __digest: () => { sized(); return 'c2d:' + size + ':' + H(ops.map(o => o.d).join('|')) + ':' + ops.length; },
    __resize: () => { size = ''; sized(); },
    __ops: () => ops.length,
  };
  return new Proxy(st, {
    get: (t, k) => (k === 'canvas' ? cv : k in fns ? fns[k] : k in st ? st[k] : (typeof k === 'string' ? () => {} : undefined)),
    set: (t, k, v) => { st[k] = v; return true; },
  });
}
module.exports = { make, digest };
