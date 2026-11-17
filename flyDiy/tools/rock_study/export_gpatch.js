#!/usr/bin/env node
// export_gpatch.js - ROCK-STUDY R1: the game's own ground inputs cropped round Mount Ardent, for ground_bench.html (which runs
// the game's splat_ground.js on them). The island's 10 m grids - pack A (ori1, canopy, coast, lake), pack B (ndvi, terrain
// type), the tint (rgb) with R1's TERRAIN BIAS in its alpha, computed exactly as render_world's rockBias() computes it
// (kept in step by hand: the same blurs, z-scores and encoding) - over the 2 km patch, WORLD coordinates.
//   node flyDiy/tools/rock_study/export_gpatch.js      (needs a built tools/flight_core.js: node tools/build.js)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
require(path.join(ROOT, 'tools', 'flight_core.js'));
const { islandWorld } = require(path.join(ROOT, 'tools', 'island_node'));
const W = islandWorld('jolene', {}), I = W.island, G = I.grid;
const CX = 9540, CZ = -5140, HALF = 1100;
const i0 = Math.floor((CX - HALF - G.x0) / G.cell), j0 = Math.floor((CZ - HALF - G.z0) / G.cell), w = Math.ceil(2 * HALF / G.cell), h = w;
// the bias, as render_world rockBias()
const t0 = Date.now(), g = W.hydro.grids, N = g.N, n = N * N, Hf = Float32Array.from(g.H), sea = g.sea;
const box = (src, r) => { const tmp = new Float32Array(n), out = new Float32Array(n), ww = 2 * r + 1;
  for (let y = 0; y < N; y++) { let acc = 0; const o = y * N;
    for (let k = -r; k <= r; k++) acc += src[o + Math.min(N - 1, Math.max(0, k))];
    for (let x = 0; x < N; x++) { tmp[o + x] = acc / ww; acc += src[o + Math.min(N - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } }
  for (let x = 0; x < N; x++) { let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[Math.min(N - 1, Math.max(0, k)) * N + x];
    for (let y = 0; y < N; y++) { out[y * N + x] = acc / ww; acc += tmp[Math.min(N - 1, y + r + 1) * N + x] - tmp[Math.max(0, y - r) * N + x]; } }
  return out; };
const b2 = box(Hf, 2), b8 = box(box(Hf, 4), 4);
let sL = 0, sC = 0, m = 0;
for (let k = 0; k < n; k += 7) { if (sea && sea[k]) continue; const l = Hf[k] - b2[k], c = b8[k] - Hf[k]; sL += l * l; sC += c * c; m++; }
const zL = 1 / Math.max(1e-3, Math.sqrt(sL / m)), zC = 1 / Math.max(1e-3, Math.sqrt(sC / m));
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const B = new Float32Array(n);
for (let k = 0; k < n; k++) B[k] = 0.20 * Math.min(1, Math.max(-1, (Hf[k] - b2[k]) * zL * 0.45)) - 0.35 * ss(0.6, 1.6, (b8[k] - Hf[k]) * zC);
const biasMs = Date.now() - t0;
const biasAt = (x, z) => { const fz = (z - g.z0) / g.dz - 0.5, fx = (x - g.x0) / g.dx - 0.5;
  const z0 = Math.max(0, Math.min(N - 2, Math.floor(fz))), x0 = Math.max(0, Math.min(N - 2, Math.floor(fx))), v = Math.min(1, Math.max(0, fz - z0)), u = Math.min(1, Math.max(0, fx - x0)), k = z0 * N + x0;
  const b = (B[k] * (1 - u) + B[k + 1] * u) * (1 - v) + (B[k + N] * (1 - u) + B[k + N + 1] * u) * v;
  return Math.round(Math.min(1, Math.max(0, (b + 0.6) / 0.8)) * 255); };
const A = new Uint8Array(w * h * 4), Bp = new Uint8Array(w * h * 2), T = new Uint8Array(w * h * 4);
for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
  const k = (j0 + j) * G.w + (i0 + i), o = j * w + i;
  A[o * 4] = I.ori1 ? I.ori1[k] : 0; A[o * 4 + 1] = I.canopy ? I.canopy[k] : 0; A[o * 4 + 2] = I.coast ? I.coast[k] : 255; A[o * 4 + 3] = I.lake ? I.lake[k] : 0;
  Bp[o * 2] = I.ndvi ? I.ndvi[k] : 0; Bp[o * 2 + 1] = I.ttype[k];
  for (let c = 0; c < 3; c++) T[o * 4 + c] = I.tint ? I.tint[k * 3 + c] : 110;
  T[o * 4 + 3] = biasAt(G.x0 + (i0 + i + 0.5) * G.cell, G.z0 + (j0 + j + 0.5) * G.cell);
}
const OUT = path.join(__dirname, 'data'); fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'gpatch.bin'), Buffer.concat([Buffer.from(A.buffer), Buffer.from(Bp.buffer), Buffer.from(T.buffer)]));
const albedo = I.albedo ? Array.from(I.albedo.subarray(0, 0)) : null;
fs.writeFileSync(path.join(OUT, 'gpatch.json'), JSON.stringify({ x0: G.x0 + i0 * G.cell, z0: G.z0 + j0 * G.cell, w, h, cell: G.cell, cx: CX, cz: CZ,
  layout: { A: [0, w * h * 4], B: [w * h * 4, w * h * 2], T: [w * h * 6, w * h * 4] }, biasMs, biasGrid: N }));
// a small island sample for make()'s normalisation (ttype + albedo, every 37th cell, the same stride as autoExposure reads)
const S = [], SA = [];
for (let k = 0; k < I.ttype.length; k += 37) { S.push(I.ttype[k]); SA.push(I.albedo[k * 3], I.albedo[k * 3 + 1], I.albedo[k * 3 + 2]); }
fs.writeFileSync(path.join(OUT, 'gisla.json'), JSON.stringify({ ttype: S, albedo: SA }));
console.log(`gpatch ${w}x${h} at (${G.x0 + i0 * G.cell}, ${G.z0 + j0 * G.cell}); bias ${biasMs} ms on ${N}^2 (node)`);
