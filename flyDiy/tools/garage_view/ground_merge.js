#!/usr/bin/env node
// GARAGE-VIEW, step 3: THE GROUND'S PICTURES INTO TEXTURES (the user, 22 Nov: "a high resolution picture right in front
// of the garage ... and merge with a global lower resolution one for the whole pavement").
//
// capture.js brought the ground from above in tiles (the game's own ground shader, the trees / vehicles / people hidden),
// each with its camera's matrices. Here every tile is RECTIFIED against the measured terrain - an output texel is a point
// of the world (x, the ground's height there, z), projected through each tile's own camera - and the tiles that see it are
// blended with a feather at their edges. Then the CARD (known sRGB texture values on a Standard material under the same
// light, shot from the same heights) turns a captured value back into the TEXTURE value a Standard material needs to
// show it: the mosaics come out as albedo-like maps, lit again by the garage's own sun and sky.
//
//   node tools/garage_view/ground_merge.js --cap <capture dir> --measure <dir> --out <dir> [--near 2048] [--mid 4096] [--wide 2048]
//     -> ground_near_<shed>.png, ground_mid.png, ground_wide.png  (RGBA: the texture values, alpha = covered)
//        raw_*.png (as captured, for the eye), ground.json (each mosaic's frame: origin, axes, metres, pixels; the card's curves)
'use strict';
const fs = require('fs'), path = require('path');
const PNG = require('./png.js');
const T = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const CAP = opt('cap'), MDIR = opt('measure', path.join(T, 'perf', 'garage_view')), OUT = opt('out', CAP);
if (!CAP) { console.error('usage: ground_merge.js --cap <capture dir> [--measure dir] [--out dir]'); process.exit(2); }
const M = JSON.parse(fs.readFileSync(path.join(MDIR, 'measure.json'), 'utf8'));
const C = JSON.parse(fs.readFileSync(path.join(CAP, 'capture.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

// ---- the ground's height: the near grid, the mid grid outside it (bilinear) ---------------------------------------
const gridH = g => (x, z) => { const fx = (x - g.x0) / g.step, fz = (z - g.z0) / g.step; if (fx < 0 || fz < 0 || fx > g.n - 1 || fz > g.n - 1) return null;
  const i = Math.min(g.n - 2, Math.floor(fx)), j = Math.min(g.n - 2, Math.floor(fz)), tx = fx - i, tz = fz - j, a = g.h[j * g.n + i], b = g.h[j * g.n + i + 1], c = g.h[(j + 1) * g.n + i], d = g.h[(j + 1) * g.n + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz; };
const hN = gridH(M.terrain.near), hM = gridH(M.terrain.mid);
const H = (x, z) => { const a = hN(x, z); if (a !== null) return a; const b = hM(x, z); return b !== null ? b : M.sheds[0].y; };

// ---- a grab as a camera: world -> pixel ------------------------------------------------------------------------------
function camOf(g) {
  const m = g.cam.mw, p = g.cam.pj, w = g.info.w, h = g.info.h;
  // the view matrix: the inverse of a rigid matrixWorld (column-major): R^T, -R^T t
  const r = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]], t = [m[12], m[13], m[14]];
  return { w, h, pos: t, px: (x, y, z) => { const dx = x - t[0], dy = y - t[1], dz = z - t[2];
      const vx = r[0] * dx + r[1] * dy + r[2] * dz, vy = r[3] * dx + r[4] * dy + r[5] * dz, vz = r[6] * dx + r[7] * dy + r[8] * dz;
      const cw = p[3] * vx + p[7] * vy + p[11] * vz + p[15]; if (cw <= 1e-6) return null;
      const nx = (p[0] * vx + p[4] * vy + p[8] * vz + p[12]) / cw, ny = (p[1] * vx + p[5] * vy + p[9] * vz + p[13]) / cw;
      return [(nx * 0.5 + 0.5) * w, (1 - (ny * 0.5 + 0.5)) * h]; } };
}
const imgs = new Map();
const img = name => { if (!imgs.has(name)) { const d = PNG.decode(fs.readFileSync(path.join(CAP, name + '.png'))); imgs.set(name, d); } return imgs.get(name); };
const sample = (I, x, y, out) => { const x0 = Math.max(0, Math.min(I.w - 2, Math.floor(x - 0.5))), y0 = Math.max(0, Math.min(I.h - 2, Math.floor(y - 0.5))), tx = Math.max(0, Math.min(1, x - 0.5 - x0)), ty = Math.max(0, Math.min(1, y - 0.5 - y0)), c = I.ch, o = (y0 * I.w + x0) * c, o2 = o + I.w * c;
  for (let k = 0; k < 3; k++) out[k] = (I.data[o + k] * (1 - tx) + I.data[o + c + k] * tx) * (1 - ty) + (I.data[o2 + k] * (1 - tx) + I.data[o2 + c + k] * tx) * ty; };

// ---- the card: what a texture value becomes under the tiles' light ------------------------------------------------------
function cardCurves(g) {
  const cam = camOf(g), I = img(g.name), K = g.card, cs = Math.cos(K.yaw), sn = Math.sin(K.yaw), rows = [], px = [0, 0, 0];
  for (let i = 0; i < K.cols.length; i++) { const c = i % K.grid[0], r = Math.floor(i / K.grid[0]), lx = ((c + 0.5) / K.grid[0] - 0.5) * K.w, lz = ((r + 0.5) / K.grid[1] - 0.5) * K.h;
    const q = cam.px(K.at[0] + lx * cs + lz * sn, K.at[1], K.at[2] - lx * sn + lz * cs); if (!q) { rows.push(null); continue; }
    // the patch's middle third, averaged
    const e = cam.px(K.at[0] + (lx + K.w / K.grid[0] / 6) * cs + lz * sn, K.at[1], K.at[2] - (lx + K.w / K.grid[0] / 6) * sn + lz * cs), rad = Math.max(1, Math.floor(Math.hypot(e[0] - q[0], e[1] - q[1]))), acc = [0, 0, 0]; let n = 0;
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const x = q[0] + dx, y = q[1] + dy; if (x < 1 || y < 1 || x > I.w - 2 || y > I.h - 2) continue; sample(I, x, y, px); acc[0] += px[0]; acc[1] += px[1]; acc[2] += px[2]; n++; }
    rows.push(n ? { tex: K.cols[i], got: acc.map(v => +(v / n).toFixed(2)), at: q.map(v => Math.round(v)) } : null);
  }
  // the greys (the first 8 patches) give each channel's curve; made monotone; inverted into a table: captured -> texture
  const greys = rows.slice(0, 8).filter(Boolean), lut = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
  for (let k = 0; k < 3; k++) { const xs = greys.map(r => r.got[k]), ys = greys.map(r => r.tex[k]); for (let i = 1; i < xs.length; i++) if (xs[i] <= xs[i - 1]) xs[i] = xs[i - 1] + 0.01;
    for (let v = 0; v < 256; v++) { let i = 0; while (i < xs.length - 2 && v > xs[i + 1]) i++; const t = (v - xs[i]) / (xs[i + 1] - xs[i]); lut[k][v] = Math.max(0, Math.min(255, Math.round(ys[i] + (ys[i + 1] - ys[i]) * t))); } }
  // how well the curves bring the coloured patches back: the worst error, in texture values
  let worst = 0; for (const r of rows.slice(8)) if (r) for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(lut[k][Math.round(r.got[k])] - r.tex[k]));
  return { name: g.name, h: g.h, rows, lut, worst };
}

// ---- a mosaic --------------------------------------------------------------------------------------------------------------
function mosaic(tag, tiles, F, curves) {
  const { o, eu, ev, U, V, W, Hh } = F, cams = tiles.map(g => ({ g, cam: camOf(g), I: img(g.name) }));
  const raw = new Uint8Array(W * Hh * 4), tex = new Uint8Array(W * Hh * 4), px = [0, 0, 0]; let covered = 0;
  // each tile's reach on the mosaic (its picture's corners on the ground, in texels): the tiles a texel may see
  for (const c of cams) { c.bb = [Infinity, Infinity, -Infinity, -Infinity]; const gy = c.g.at ? c.g.at[1] : H(c.cam.pos[0], c.cam.pos[2]), hh = c.cam.pos[1] - gy, f = c.g.cam.fov * Math.PI / 360, rad = hh * Math.tan(f) * Math.hypot(1, c.g.cam.aspect) * 1.25;
    const du = ((c.cam.pos[0] - o[0]) * eu[0] + (c.cam.pos[2] - o[1]) * eu[1]) / U * W, dv = ((c.cam.pos[0] - o[0]) * ev[0] + (c.cam.pos[2] - o[1]) * ev[1]) / V * Hh;
    c.bb = [du - rad / U * W, dv - rad / V * Hh, du + rad / U * W, dv + rad / V * Hh]; }
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const u = (i + 0.5) / W * U, v = (j + 0.5) / Hh * V, x = o[0] + eu[0] * u + ev[0] * v, z = o[1] + eu[1] * u + ev[1] * v, y = H(x, z);
    let r = 0, g = 0, b = 0, ws = 0;
    for (const c of cams) { if (i < c.bb[0] || i > c.bb[2] || j < c.bb[1] || j > c.bb[3]) continue; const q = c.cam.px(x, y, z); if (!q) continue;
      const m = Math.min(q[0], q[1], c.cam.w - q[0], c.cam.h - q[1]); if (m < 2) continue;
      const wt = Math.min(1, m / (0.06 * c.cam.h)); sample(c.I, q[0], q[1], px); r += px[0] * wt; g += px[1] * wt; b += px[2] * wt; ws += wt; }
    if (!ws) continue; covered++;
    const k = (j * W + i) * 4; r /= ws; g /= ws; b /= ws;
    raw[k] = r; raw[k + 1] = g; raw[k + 2] = b; raw[k + 3] = 255;
    tex[k] = curves.lut[0][Math.round(r)]; tex[k + 1] = curves.lut[1][Math.round(g)]; tex[k + 2] = curves.lut[2][Math.round(b)]; tex[k + 3] = 255;
  }
  fs.writeFileSync(path.join(OUT, 'raw_' + tag + '.png'), PNG.encode(W, Hh, 4, raw)); fs.writeFileSync(path.join(OUT, 'ground_' + tag + '.png'), PNG.encode(W, Hh, 4, tex));
  console.log('ground_merge: ' + tag + '  ' + W + ' x ' + Hh + ' px over ' + U.toFixed(1) + ' x ' + V.toFixed(1) + ' m (' + (U / W * 100).toFixed(1) + ' cm a texel), ' + tiles.length + ' tiles, ' + (100 * covered / (W * Hh)).toFixed(1) + ' % covered; card ' + curves.name);
  return Object.assign({ tag, file: 'ground_' + tag + '.png', tiles: tiles.length, covered: +(covered / (W * Hh)).toFixed(4), card: curves.name }, F);
}

const cards = C.grabs.filter(g => g.kind === 'card' && g.card).map(cardCurves);
for (const c of cards) console.log('card ' + c.name + ' (eye ' + c.h + ' m): greys ' + c.rows.slice(0, 8).map(r => r ? r.got.map(Math.round).join('/') : '-').join('  ') + '   worst colour patch error ' + c.worst);
const card = n => cards.find(c => c.name === n) || cards[0];
if (!cards.length) { console.error('ground_merge: no card in the capture'); process.exit(1); }
const S = M.sheds, out = { what: 'GARAGE-VIEW ground mosaics', made: new Date().toISOString(), mosaics: [], cards: cards.map(c => ({ name: c.name, h: c.h, worst: c.worst, rows: c.rows })) };
const dir = (Sd, lx, lz) => { const c = Math.cos(Sd.ry), s = Math.sin(Sd.ry); return [lx * c + lz * s, -lx * s + lz * c]; };
for (const Sd of S) { const id = Sd.id.replace(/\W/g, '_'), tiles = C.grabs.filter(g => g.kind === 'ground' && g.set === 'near_' + id), st = C.steps['ground_near_' + Sd.id]; if (!tiles.length || !st) continue;
  const [x0, x1, z0, z1] = st.rect, U = x1 - x0, V = z1 - z0, W = +opt('near', 2048), eu = dir(Sd, 1, 0), ev = dir(Sd, 0, 1), o0 = dir(Sd, x0, z0);
  out.mosaics.push(mosaic('near_' + id, tiles, { shed: Sd.id, o: [Sd.x + o0[0], Sd.z + o0[1]], eu, ev, U, V, W, Hh: Math.round(W * V / U), room: st.rect }, card('card_ground12'))); }
{ const tiles = C.grabs.filter(g => g.kind === 'ground' && g.set === 'mid'), st = C.steps.ground_mid;
  if (tiles.length && st) { const d = [S[0].doorDir.x, S[0].doorDir.z], t = [-d[1], d[0]], U = 560, V = 460, W = +opt('mid', 4096);
    out.mosaics.push(mosaic('mid', tiles, { o: [st.centre[0] - d[0] * 280 - t[0] * 230, st.centre[1] - d[1] * 280 - t[1] * 230], eu: d, ev: t, U, V, W, Hh: Math.round(W * V / U) }, card('card_ground120'))); } }
{ const tiles = C.grabs.filter(g => g.kind === 'ground' && g.set === 'wide');
  if (tiles.length) { const d = [S[0].doorDir.x, S[0].doorDir.z], t = [-d[1], d[0]], U = 1900, V = 1820, W = +opt('wide', 2048);   // (20 m cells whose lines fall on the mid picture's edges: cook.js's wide grid)
    out.mosaics.push(mosaic('wide', tiles, { o: [M.mid.x - d[0] * 350 - t[0] * 910, M.mid.z - d[1] * 350 - t[1] * 910], eu: d, ev: t, U, V, W, Hh: Math.round(W * V / U) }, card('card_ground120'))); } }
fs.writeFileSync(path.join(OUT, 'ground.json'), JSON.stringify(out));
console.log('ground_merge: ' + out.mosaics.length + ' mosaics -> ' + OUT);
