#!/usr/bin/env node
// _geoparity_shot.js — THE OVERLAY STILL (G2640 DESIGN-TRUST): the flight
// model's surfaces drawn over the drawn aeroplane, side and top, as a PNG.
//
// The user's acceptance rule for the tail fix (via A0): "a local session doing
// screenshot with overlay, and I'll accept when they match for a few planes".
// This is that picture without a GPU: the build through the page's own chain
// (_bake_joined: the drawing layers in the headless scene, the join, the
// merge), the drawn meshes projected flat (grey: the body; darker: the wing,
// stab and fin sheets), and over them, from buildGen's def, every AERO STRIP
// the solver flies (red: its chord line, leading to trailing edge, through its
// force point; a dot at the force point) and the fin's apex node (blue). Side
// view above (x aft to the right, y up), top view below (one half, z up).
//
//   node tools/_geoparity_shot.js <build.json> <out.png> [--cage k=v,...] [--title text]
//
// No fonts: the title goes in the file name and the caption.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const GP = require('./_geoparity_lib.js');

// ---- a tiny RGBA canvas and its PNG -------------------------------------
function canvas(w, h, bg) {
  const d = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { d[4 * i] = bg[0]; d[4 * i + 1] = bg[1]; d[4 * i + 2] = bg[2]; d[4 * i + 3] = 255; }
  const blend = (x, y, c, a) => {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = 4 * (y * w + x);
    for (let j = 0; j < 3; j++) d[k + j] = Math.round(d[k + j] * (1 - a) + c[j] * a);
  };
  const tri = (A, B, C, c, a) => {
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const ar = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    if (Math.abs(ar) < 1e-9) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / ar;
      const w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / ar;
      const w2 = 1 - w0 - w1;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) blend(x, y, c, a);
    }
  };
  const line = (A, B, c, th) => {
    const n = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) * 2) + 1;
    for (let i = 0; i <= n; i++) {
      const x = A[0] + (B[0] - A[0]) * i / n, y = A[1] + (B[1] - A[1]) * i / n;
      for (let dx = -th; dx <= th; dx++) for (let dy = -th; dy <= th; dy++) if (dx * dx + dy * dy <= th * th + 0.5) blend(x + dx, y + dy, c, 1);
    }
  };
  const dot = (P, c, r) => { for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (dx * dx + dy * dy <= r * r) blend(P[0] + dx, P[1] + dy, c, 1); };
  const png = () => {
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; d.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
    const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
    const chunk = (type, data) => { const L = Buffer.alloc(4); L.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]);
      const C = Buffer.alloc(4); C.writeUInt32BE(crc(td)); return Buffer.concat([L, td, C]); };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; ih[10] = 0; ih[11] = 0; ih[12] = 0;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  };
  return { tri, line, dot, png };
}

// every visible mesh under the mount, in the frame, tagged by its layer
function allTris(W) {
  const THREE = W.THREE;
  let mnt = W.CAGE_WING && W.CAGE_WING.group;
  while (mnt && mnt.parent && !mnt.parent.isScene && mnt.parent.parent && !mnt.parent.parent.isScene) mnt = mnt.parent;
  mnt.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(mnt.matrixWorld).invert();
  const tmp = new THREE.Matrix4(), v = new THREE.Vector3();
  const Dt = W.CAGE_DATUM || { zFw: 0, yD: 0 };
  const out = [];
  const layerOf = o => { for (let q = o; q; q = q.parent) if (q.name && /^cageLayer:/.test(q.name)) return q.name.slice(10); return 'body'; };
  mnt.traverse(o => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    if (o.userData && (o.userData.edHi || o.userData.edHw)) return;
    const g = o.geometry, p = g.attributes.position; if (!p) return;
    const lay = layerOf(o);
    if (lay === 'light' || lay === 'access' || lay === 'hinge') return;
    tmp.multiplyMatrices(inv, o.matrixWorld);
    const V = [];
    for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(tmp); V.push([Dt.zFw - v.z, v.y - Dt.yD, v.x]); }
    const ix = g.index ? g.index.array : null, nT = ix ? ix.length / 3 : p.count / 3;
    for (let t = 0; t < nT; t++) {
      const a = ix ? ix[3 * t] : 3 * t, b = ix ? ix[3 * t + 1] : 3 * t + 1, c = ix ? ix[3 * t + 2] : 3 * t + 2;
      out.push({ lay, t: [V[a], V[b], V[c]] });
    }
  });
  return out;
}

function shoot(spec, outFile, opts) {
  opts = opts || {};
  const r = GP.measure(spec);
  const def = r.def, tris = allTris(r.W);
  // the frame's extent: the drawn aeroplane
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z1 = 0;
  for (const T of tris) for (const p of T.t) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); z1 = Math.max(z1, Math.abs(p[2])); }
  const W = 1600, pad = 30;
  const s = (W - 2 * pad) / (x1 - x0);
  const hSide = Math.ceil((y1 - y0) * s) + 2 * pad, hTop = Math.ceil(z1 * s) + 2 * pad;
  const H = hSide + hTop;
  const cv = canvas(W, H, [250, 250, 248]);
  const side = p => [pad + (p[0] - x0) * s, pad + (y1 - p[1]) * s];
  const top = p => [pad + (p[0] - x0) * s, hSide + pad + (z1 - Math.abs(p[2])) * s];
  const COL = { body: [205, 205, 200], wing: [150, 150, 145], stab: [150, 150, 145], fin: [150, 150, 145] };
  // body first, the surfaces over it; the top view draws one half (z >= 0
  // or the build's own side for the surfaces)
  for (const pass of ['body', 'surf']) for (const T of tris) {
    const isS = T.lay === 'wing' || T.lay === 'stab' || T.lay === 'fin';
    if ((pass === 'body') === isS) continue;
    const c = COL[T.lay] || COL.body, a = isS ? 0.55 : 0.35;
    cv.tri(side(T.t[0]), side(T.t[1]), side(T.t[2]), c, a);
    if (T.t.every(p => p[2] >= -0.02)) cv.tri(top(T.t[0]), top(T.t[1]), top(T.t[2]), c, a);
  }
  // the separator
  cv.line([0, hSide], [W, hSide], [120, 120, 120], 0);
  // the flight model: each strip's chord line through its force point
  for (const st of def.strips) {
    const g = GP.stripGeo(def, st);
    const dir = [g.r[0] - g.f[0], g.r[1] - g.f[1], g.r[2] - g.f[2]];
    const L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const u = dir.map(v => v / L);
    const le = g.a.map((v, k) => v - 0.25 * st.chord * u[k]), te = g.a.map((v, k) => v + 0.75 * st.chord * u[k]);
    const red = [215, 30, 30];
    if (st.kind === 'fin' || g.a[2] >= -0.02) {
      cv.line(side(le), side(te), red, 1); cv.dot(side(g.a), red, 4);
    }
    if (st.kind !== 'fin' && g.a[2] >= -0.02) { cv.line(top(le), top(te), red, 1); cv.dot(top(g.a), red, 4); }
    if (st.kind === 'fin') { cv.line(top(le), top(te), red, 1); cv.dot(top(g.a), red, 4); }
  }
  const fin = def.nodes.find(n => n.tag === 'FIN');
  if (fin) { cv.dot(side(fin.p), [30, 60, 220], 6); }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, cv.png());
  return { file: outFile, worst: r.worst, centre: r.centre };
}

module.exports = { shoot };

if (require.main === module) {
  const a = process.argv.slice(2);
  const inF = a[0], outF = a[1];
  const j = JSON.parse(fs.readFileSync(inF, 'utf8'));
  const spec = j.spec || j;
  const ci = a.indexOf('--cage');
  if (ci >= 0) for (const kv of a[ci + 1].split(',')) { const [k, v] = kv.split('='); spec.cage[k] = +v; }
  if (a.includes('--floats')) { spec.gear.type = 'floats'; spec.cage.gearFloats = 1; }
  const r = shoot(spec, outF);
  console.log('wrote', r.file, JSON.stringify(r.worst, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
}
