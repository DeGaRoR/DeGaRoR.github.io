#!/usr/bin/env node
// plane_stills.js - THE WHOLE AEROPLANE AS SIMPLE PICTURES, NO GAME, NO GPU (FLAGSHIP, 2026-11-02)
//
//   node tools/plane_stills.js --build <file.json> --out <dir>/<name> [--px 1100] [--label "text"]
//
// tools/dash_stills.js's headless scene (the editor's own PAGE.post chain: every drawing layer of the cage rows)
// and its software rasteriser, framed on the WHOLE aeroplane instead of the cockpit, nothing cut away. Flat Lambert,
// no textures: the shapes are the real drawn geometry. Colours by layer: the fuselage cream, the glass light blue,
// the wing and tail light grey, the floats a darker grey, the engine and the propeller dark. Views, each a PNG:
//   side  from the left        q34  from ahead, left and above        top  from above
// The user (2 Nov): "a simple render, not using the game". One build per process (the layers keep state).
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const TOOLS = __dirname;
const BUILD = opt('build', null);
const OUT = opt('out', 'plane');
const PX = +opt('px', 1100);
const LABEL = opt('label', '');
if (!BUILD) { console.log('plane_stills: --build <file> required'); process.exit(2); }

const SH = require(path.join(TOOLS, '_scene_headless.js'));
for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js',
                 '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
const BJ = require(path.join(TOOLS, '_bake_joined.js'));
const { C } = BJ.loadPanel();
const C0 = SH.context();
const W = C0.ctx;
SH.stubCanvas();
const cerr = console.error; console.error = () => {};
const raw = JSON.parse(fs.readFileSync(BUILD, 'utf8'));
const spec = JSON.parse(JSON.stringify(raw.spec || raw));
const def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
if (W.CAGE_ENERGY && W.CAGE_ENERGY.fromSpec) W.CAGE_ENERGY.fromSpec(spec.energy, spec);
const r = SH.sceneBuild(spec, { garage: spec, resolved: () => def.spec, inGame: true });
console.error = cerr;
if (r.errors.length) console.log('plane_stills: scene errors: ' + r.errors.map(e => String(e).split('\n')[0]).join(' | '));

const GLASS = /window|windshield|glass|pane$|canopy|sky/i;
const COL = {
  skin: [0.90, 0.86, 0.78], glass: [0.62, 0.78, 0.92], wing: [0.80, 0.82, 0.84], tail: [0.74, 0.78, 0.80],
  float: [0.58, 0.60, 0.62], eng: [0.25, 0.25, 0.28], prop: [0.12, 0.12, 0.13], strut: [0.55, 0.57, 0.60],
  crew: [0.36, 0.46, 0.68], other: [0.66, 0.66, 0.66],
};
const tris = [];
const FS = r.FS, M = r.built.sheet;
for (const f of M.F) {
  const v = f.v; if (!v || v.length < 3) continue;
  const c = GLASS.test(f.m || '') ? COL.glass : COL.skin;
  for (let i = 1; i + 1 < v.length; i++) {
    const p = [];
    for (const vi of [v[0], v[i], v[i + 1]]) { const q = M.V[vi]; p.push(q[0] * FS, q[1] * FS, q[2] * FS); }
    tris.push({ p, c });
  }
}
const V = new C0.THREE.Vector3();
const visibleChain = o => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
for (const layer of r.scene.children) {
  const ln = layer.name || '';
  const lc = /wing|brace/.test(ln) ? COL.wing : /fin|stab/.test(ln) ? COL.tail : /float|gear/.test(ln) ? COL.float
    : /eng/.test(ln) ? COL.eng : /cowl/.test(ln) ? COL.skin : /crew/.test(ln) ? COL.crew : COL.other;
  layer.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || !visibleChain(o)) return;
    const nm = []; for (let q = o; q && q !== layer; q = q.parent) nm.push(q.name || '');
    const s = nm.join('/');
    let c = lc;
    if (/blade|prop|spinner/i.test(s)) c = COL.prop;
    else if (/strut|wire|spreader/i.test(s)) c = COL.strut;
    else if (/glass|pane|window/i.test(s)) c = COL.glass;
    const g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count;
    const W3 = [];
    for (let i = 0; i < P.count; i++) { V.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); W3.push(V.x, V.y, V.z); }
    for (let t = 0; t + 2 < n; t += 3) {
      const a = I ? I.getX(t) : t, b = I ? I.getX(t + 1) : t + 1, d = I ? I.getX(t + 2) : t + 2;
      tris.push({ p: [W3[a * 3], W3[a * 3 + 1], W3[a * 3 + 2], W3[b * 3], W3[b * 3 + 1], W3[b * 3 + 2],
                      W3[d * 3], W3[d * 3 + 1], W3[d * 3 + 2]], c });
    }
  });
}
// the framing: the whole aeroplane's box, a margin round it
const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
for (const t of tris) for (let j = 0; j < 9; j++) { const a = j % 3; if (isFinite(t.p[j])) { bb[a] = Math.min(bb[a], t.p[j]); bb[a + 3] = Math.max(bb[a + 3], t.p[j]); } }
const corners = [];
for (const x of [bb[0], bb[3]]) for (const y of [bb[1], bb[4]]) for (const z of [bb[2], bb[5]]) corners.push([x, y, z]);
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// the cage frame: x to the right wing, y up, z FORWARD
const VIEWS = { side: [1, 0, 0], q34: norm([0.62, -0.36, -0.70]), top: [0, -1, 0] };
const L = norm([0.35, -0.85, -0.40]);
const png = (w, h, rgb) => {
  const rw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { rw[y * (w * 3 + 1)] = 0; rgb.copy(rw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const T = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c; }
  const crc = b => { let c = -1; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]);
    const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(rw)), chunk('IEND', Buffer.alloc(0))]);
};
fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
const out = { build: BUILD, label: LABEL, tris: tris.length, box: bb.map(x => +x.toFixed(3)), views: {} };
for (const [vn, d0] of Object.entries(VIEWS)) {
  const d = norm(d0);
  const up0 = Math.abs(d[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  const rt = norm(cross(d, up0)), up = cross(rt, d);
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const p of corners) { const u = dot(p, rt), v = dot(p, up); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const mg = 0.04 * (u1 - u0); u0 -= mg; u1 += mg; v0 -= mg; v1 += mg;
  const SS = 2, w = PX * SS, s = w / (u1 - u0), h = Math.ceil((v1 - v0) * s);
  const zb = new Float32Array(w * h).fill(Infinity), img = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { const g = 0.95 - 0.06 * (Math.floor(i / w) / h); img[i * 3] = g; img[i * 3 + 1] = g; img[i * 3 + 2] = g + 0.02; }
  for (const t of tris) {
    const P = [0, 1, 2].map(j => [t.p[j * 3], t.p[j * 3 + 1], t.p[j * 3 + 2]]);
    const n = norm(cross([P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]]));
    if (!isFinite(n[0])) continue;
    const nf = dot(n, d) > 0 ? [-n[0], -n[1], -n[2]] : n;
    const sh = 0.40 + 0.48 * Math.max(0, -dot(nf, L)) + 0.12 * Math.max(0, -dot(nf, d));
    const col = t.c.map(x => Math.min(1, x * sh));
    const S = P.map(p => [(dot(p, rt) - u0) * s, (v1 - dot(p, up)) * s, dot(p, d)]);
    const xmin = Math.max(0, Math.floor(Math.min(S[0][0], S[1][0], S[2][0]))), xmax = Math.min(w - 1, Math.ceil(Math.max(S[0][0], S[1][0], S[2][0])));
    const ymin = Math.max(0, Math.floor(Math.min(S[0][1], S[1][1], S[2][1]))), ymax = Math.min(h - 1, Math.ceil(Math.max(S[0][1], S[1][1], S[2][1])));
    if (xmin > xmax || ymin > ymax) continue;
    const ar = (S[1][0] - S[0][0]) * (S[2][1] - S[0][1]) - (S[2][0] - S[0][0]) * (S[1][1] - S[0][1]);
    if (Math.abs(ar) < 1e-9) continue;
    for (let y = ymin; y <= ymax; y++) for (let x = xmin; x <= xmax; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((S[1][0] - px) * (S[2][1] - py) - (S[2][0] - px) * (S[1][1] - py)) / ar;
      const w1 = ((S[2][0] - px) * (S[0][1] - py) - (S[0][0] - px) * (S[2][1] - py)) / ar;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * S[0][2] + w1 * S[1][2] + w2 * S[2][2], i = y * w + x;
      if (z < zb[i]) { zb[i] = z; img[i * 3] = col[0]; img[i * 3 + 1] = col[1]; img[i * 3 + 2] = col[2]; }
    }
  }
  const W2 = w / SS, H2 = Math.floor(h / SS), rgb = Buffer.alloc(W2 * H2 * 3);
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) for (let k = 0; k < 3; k++) {
    let a = 0; for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) a += img[((y * SS + dy) * w + x * SS + dx) * 3 + k];
    rgb[(y * W2 + x) * 3 + k] = Math.round(255 * Math.min(1, a / (SS * SS)));
  }
  const file = OUT + '_' + vn + '.png';
  fs.writeFileSync(file, png(W2, H2, rgb));
  out.views[vn] = { file, w: W2, h: H2 };
}
console.log('PLANE_STILLS ' + JSON.stringify(out));
