#!/usr/bin/env node
// dash_stills.js - THE DASH FROM THE BENCH, AS PICTURES (G3340, DASH-REDESIGN)
//
//   node tools/dash_stills.js --build builds/cub_2026-09-20_corrected.json --out <dir>/cub_after
//        [--tools <dir>] [--over '{"dashStyle":1}'] [--roi <json from a first run>] [--px 900]
//
// The bench's headless scene (tools/_scene_headless.js: the page's own
// PAGE.post chain, the crew, the panel and the energy layer included, as
// GATE TANKMOUNT builds it) drawn by a small software rasteriser, because
// the garage's WebGL view draws only the sky under the cloud's SwiftShader
// (G1320). Geometry is the real thing; the shading is flat Lambert, no
// textures. Three views of the cockpit's front, each a PNG:
//   side  from the left, the near half of the skin cut away
//   front from the seat looking forward, everything aft of the panel less 0.15 m cut away
//   q34   from aft, left and above, the near skin and the cabin aft cut away
// and per view a second PNG, the DASH ALONE (its silhouette, nothing in
// front of it), which tools/dash_stills_compose.py outlines on the overlays.
// `--roi` reuses a first run's framing so a before and an after line up
// pixel for pixel. A JSON beside them carries the dash's box and the energy
// layer's fit verdict per tank (the 'through the dash' count).
//
// `--tools <dir>` builds with another tree's tools/ (the BEFORE: a worktree
// of the base branch). One build per process: the layers keep module state.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const TOOLS = path.resolve(opt('tools', __dirname));
const BUILD = opt('build', null);
const OUT = opt('out', 'dash');
const OVER = opt('over', null) ? JSON.parse(opt('over')) : null;
const ROI_IN = opt('roi', null);
const PX = +opt('px', 900);
if (!BUILD) { console.log('dash_stills: --build <file> required'); process.exit(2); }

const SH = require(path.join(TOOLS, '_scene_headless.js'));
for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js',
                 '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
const BJ = require(path.join(TOOLS, '_bake_joined.js'));
const { C } = BJ.loadPanel();
const C0 = SH.context();
const W = C0.ctx;
SH.stubCanvas();
const cerr = console.error; console.error = () => {};

const { spec: spec0 } = SH.loadFixture(BUILD);
const spec = JSON.parse(JSON.stringify(spec0));
if (OVER) spec.cage = Object.assign({}, spec.cage || {}, OVER);
const def = C.buildGen(JSON.parse(JSON.stringify(spec)));
W.CAGE_ENERGY.fromSpec(spec.energy, spec);
const r = SH.sceneBuild(spec, { garage: spec, resolved: () => def.spec, inGame: true });
console.error = cerr;
if (r.errors.length) console.log('dash_stills: scene errors: ' + r.errors.map(e => String(e).split('\n')[0]).join(' | '));

// ---- the triangles, world metres, each with a colour and a class
const SKIN = new Set(['body', 'cloth', 'plywood', 'waistband', 'floorLoop', 'ceilingLoop', 'paneEdge',
  'pillarTail', 'pillarPassenger', 'pillarCabin', 'pillarWindow', 'pillarFront', 'shoulder', 'bulkhead',
  'taperPanel', 'composite', 'alu', 'metal', 'fabric']);
const GLASS = /window|windshield|glass|pane$|canopy/i;
const COL = {
  dash: [0.13, 0.13, 0.14], dashFace: [0.62, 0.64, 0.67],
  fire: [0.78, 0.74, 0.66], frame: [0.58, 0.40, 0.30], skin: [0.86, 0.82, 0.74],
  pilot: [0.36, 0.46, 0.68], seat: [0.36, 0.36, 0.40], ctl: [0.30, 0.30, 0.32], panel: [0.22, 0.22, 0.24],
  tankOk: [0.30, 0.70, 0.36], tankBad: [0.92, 0.22, 0.20], eng: [0.32, 0.32, 0.35], other: [0.6, 0.6, 0.6],
};
const tris = [];   // {p:[9], c:[3], k:class}
const FS = r.FS, M = r.built.sheet;
for (const f of M.F) {
  const v = f.v; if (!v || v.length < 3) continue;
  const m = f.m || '';
  if (GLASS.test(m)) continue;
  let c, k;
  if (m === 'dash') { c = COL.dash; k = 'dash'; }
  else if (m === 'dashFace') { c = COL.dashFace; k = 'dash'; }
  else if (/^fire/.test(m)) { c = COL.fire; k = 'fire'; }
  else if (m === 'tube' || m === 'joint' || /Frame$/.test(m) || /frame/i.test(m)) { c = COL.frame; k = 'frame'; }
  else { c = COL.skin; k = 'skin'; }
  for (let i = 1; i + 1 < v.length; i++) {
    const p = [];
    for (const vi of [v[0], v[i], v[i + 1]]) { const q = M.V[vi]; p.push(q[0] * FS, q[1] * FS, q[2] * FS); }
    tris.push({ p, c, k });
  }
}
// a tank is drawn RED when the energy layer's fit finds it through the DASH
// (the question these stills answer), green otherwise - its other verdicts
// (the crew, the skin) are in the JSON beside the pictures
const unfit = new Set();
for (const rr of (W.CAGE_ENERGY.results() || [])) if (rr && /through the dash/.test((rr.why || []).join(' '))) unfit.add(W.CAGE_ENERGY.EN.vessels.indexOf(rr.v));
const V = new C0.THREE.Vector3();
const visibleChain = o => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
const SKIP_LAYERS = /cageLayer:(wing|fin|stab|gear|hinge|access|light|float|brace)/;
for (const layer of r.scene.children) {
  if (SKIP_LAYERS.test(layer.name || '')) continue;
  layer.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || !visibleChain(o)) return;
    let c = COL.other, k = 'other';
    const chain = []; for (let q = o; q && q !== layer; q = q.parent) chain.push(q.name || '');
    const nm = chain.join('/');
    if (layer.name === 'cageLayer:energy') {
      const vi = +((/edVessel_(\d+)_|edFuel_(\d+)/.exec(nm) || [])[1] || 0);
      if (/edFuel_/.test(nm)) return;                           // the fuel inside: the shell is the tank
      c = unfit.has(vi) ? COL.tankBad : COL.tankOk; k = 'tank';
    } else if (layer.name === 'cageLayer:crew') {
      if (/edDum/.test(nm)) { c = COL.pilot; k = 'pilot'; }
      else if (/edSeat/.test(nm)) { c = COL.seat; k = 'seat'; }
      else if (/edPanel|edGauge|edSwitch/.test(nm)) { c = COL.panel; k = 'panel'; }
      else { c = COL.ctl; k = 'ctl'; }
    } else if (layer.name === 'cageLayer:eng') { c = COL.eng; k = 'eng'; }
    else if (layer.name === 'cageLayer:cowl') { c = COL.skin; k = 'skin'; }
    else if (layer.name === 'cageLayer:energy') { c = COL.tankOk; k = 'tank'; }
    const g = o.geometry, P = g.attributes.position, I = g.index;
    const n = I ? I.count : P.count;
    const W3 = [];
    for (let i = 0; i < P.count; i++) { V.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); W3.push(V.x, V.y, V.z); }
    for (let t = 0; t + 2 < n; t += 3) {
      const a = I ? I.getX(t) : t, b = I ? I.getX(t + 1) : t + 1, d = I ? I.getX(t + 2) : t + 2;
      tris.push({ p: [W3[a * 3], W3[a * 3 + 1], W3[a * 3 + 2], W3[b * 3], W3[b * 3 + 1], W3[b * 3 + 2],
                      W3[d * 3], W3[d * 3 + 1], W3[d * 3 + 2]], c, k });
    }
  });
}

// ---- the dash's box (metres) and the framing
const dbb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
for (const t of tris) if (t.k === 'dash') for (let j = 0; j < 9; j++) { const a = j % 3; dbb[a] = Math.min(dbb[a], t.p[j]); dbb[a + 3] = Math.max(dbb[a + 3], t.p[j]); }
let ROI;
if (ROI_IN) ROI = JSON.parse(fs.readFileSync(ROI_IN, 'utf8')).roi;
else {
  const hw = Math.max(Math.abs(dbb[0]), Math.abs(dbb[3]));
  ROI = { x0: -hw - 0.12, x1: hw + 0.12, y0: dbb[4] - 0.80, y1: dbb[4] + 0.16, z0: dbb[2] - 0.55, z1: dbb[2] + 0.70,
          zA: dbb[2], yTop: dbb[4] };
}
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// each view: the look direction, and which triangles it keeps (the cutaway)
const cen = t => [(t.p[0] + t.p[3] + t.p[6]) / 3, (t.p[1] + t.p[4] + t.p[7]) / 3, (t.p[2] + t.p[5] + t.p[8]) / 3];
const VIEWS = {
  side: { d: [1, 0, 0], keep: (t, c) => !((t.k === 'skin') && c[0] < 0.0) },
  front: { d: [0, 0, 1], keep: (t, c, zMin) => zMin > ROI.zA - 0.15 && t.k !== 'pilot' && t.k !== 'seat' },
  q34: { d: norm([0.62, -0.42, 0.66]), keep: (t, c, zMin) => !((t.k === 'skin') && c[0] < 0.0) && zMin > ROI.zA - 0.45 && t.k !== 'pilot' },
};
const corners = [];
for (const x of [ROI.x0, ROI.x1]) for (const y of [ROI.y0, ROI.y1]) for (const z of [ROI.z0, ROI.z1]) corners.push([x, y, z]);
const L = norm([-0.35, 0.8, -0.45]);           // the key light: above, behind-left of the pilot
const png = (w, h, rgb) => {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const crc = (() => { const T = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c; }
    return b => { let c = -1; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }; })();
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]);
    const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};
fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
for (const [vn, vw] of Object.entries(VIEWS)) {
  const d = norm(vw.d);
  const up0 = Math.abs(d[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  const rt = norm(cross(d, up0)), up = cross(rt, d);
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const p of corners) { const u = dot(p, rt), v = dot(p, up); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const SS = 2, w = PX * SS, s = w / (u1 - u0), h = Math.ceil((v1 - v0) * s);
  const zb = new Float32Array(w * h).fill(Infinity), zd = new Float32Array(w * h).fill(Infinity);
  const img = new Float32Array(w * h * 3).fill(1), msk = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const g = 0.93 + 0.05 * (Math.floor(i / w) / h); img[i * 3] = g; img[i * 3 + 1] = g; img[i * 3 + 2] = g + 0.02; }
  for (const t of tris) {
    const c3 = cen(t);
    if (!vw.keep(t, c3, Math.min(t.p[2], t.p[5], t.p[8]))) continue;
    const P = [0, 1, 2].map(j => [t.p[j * 3], t.p[j * 3 + 1], t.p[j * 3 + 2]]);
    const n = norm(cross([P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]]));
    if (!isFinite(n[0])) continue;
    const nf = dot(n, d) > 0 ? [-n[0], -n[1], -n[2]] : n;          // two-sided: face the eye
    const sh = 0.38 + 0.50 * Math.max(0, dot(nf, L)) + 0.12 * Math.max(0, -dot(nf, d));
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
      const z = w0 * S[0][2] + w1 * S[1][2] + w2 * S[2][2];
      const i = y * w + x;
      if (t.k === 'dash' && z < zd[i]) { zd[i] = z; msk[i] = 1; }
      if (z < zb[i]) { zb[i] = z; img[i * 3] = col[0]; img[i * 3 + 1] = col[1]; img[i * 3 + 2] = col[2]; }
    }
  }
  // down-sample SSxSS
  const W2 = w / SS, H2 = Math.floor(h / SS);
  const rgb = Buffer.alloc(W2 * H2 * 3), mrgb = Buffer.alloc(W2 * H2 * 3);
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    let a = 0, b = 0, c = 0, m = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) { const i = (y * SS + dy) * w + x * SS + dx; a += img[i * 3]; b += img[i * 3 + 1]; c += img[i * 3 + 2]; m += msk[i]; }
    const k = SS * SS, o = (y * W2 + x) * 3;
    rgb[o] = Math.round(255 * a / k); rgb[o + 1] = Math.round(255 * b / k); rgb[o + 2] = Math.round(255 * c / k);
    mrgb[o] = mrgb[o + 1] = mrgb[o + 2] = Math.round(255 * m / k);
  }
  fs.writeFileSync(OUT + '_' + vn + '.png', png(W2, H2, rgb));
  fs.writeFileSync(OUT + '_' + vn + '_dash.png', png(W2, H2, mrgb));
}
const verdict = (W.CAGE_ENERGY.results() || []).map(rr => ({ bay: rr.v && rr.v.bay, litres: rr.v && +rr.v.capacity, ok: rr.ok,
  why: rr.why || [], dashPts: +(((rr.why || []).join(' ').match(/through the dash \((\d+)/) || [])[1] || 0) }));
// the dials the panel layer drew on the plate (the flexible layout's effect)
const gauges = new Set();
r.scene.traverse(o => { const m = /^edGauge_([a-zA-Z0-9]+)/.exec(o.name || ''); if (m && !/^(faces|ao|sw|reg)$/.test(m[1])) gauges.add(m[1]); });
const out = { build: path.basename(BUILD), tools: TOOLS, over: OVER, dashStyle: r.P.dashStyle, roi: ROI, gauges: [...gauges].sort(),
  dashBox: dbb.map(x => +x.toFixed(4)), tanks: verdict, errors: r.errors.length };
fs.writeFileSync(OUT + '.json', JSON.stringify(out, null, 1));
console.log('dash_stills: ' + OUT + ' dash box ' + out.dashBox.join(' ') + ' tanks ' + JSON.stringify(verdict.map(v => [v.bay, v.litres, v.ok, v.dashPts])));
