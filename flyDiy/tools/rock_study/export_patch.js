#!/usr/bin/env node
// export_patch.js - ROCK-STUDY bench data (2026-11-13): a patch of Jolene's REAL ground and the game's rock meshes,
// written for tools/rock_study/bench.html. Run from anywhere:
//   node flyDiy/tools/rock_study/export_patch.js [--cx 9540 --cz -5140 --size 1200 --step 5]
// Writes tools/rock_study/data/patch.json + patch.bin (gitignored; ~1 MB) and rocks.json + rocks.bin.
//   heights   the game's own terrainH (the island's IFSAR 5 m DEM, the solver's surface) on the fine tiles' 5 m step
//   codes     the island raster's terrain type (10 m), as per-vertex weights of five groups the bench draws:
//             x rock (6), y scree (5), z forest (8, 13, 16), w heath/scrub (2, 7, 14, 3, 15) - a 3 x 3 box of cells
//             (the game votes a 5 x 5 kernel; this is the same idea, smaller)
//   fields    curvature (the Laplacian at 5 m and at 20 m), flow accumulation (D8 on the patch), the macro albedo
//             (the island's Landsat albedo, 10 m) - the inputs the tests (c) and (d) read
//   rocks     the trees pack's rock kits decoded by the game's own codec (src/core/53_tree_codec.js):
//             'rocks' (free_rock_assets_pack, 13 blocks), coast_rocks_05 (Poly Haven scan), namaqualand_cliff_02
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? +argv[i + 1] : d; };
const CX = opt('cx', 9540), CZ = opt('cz', -5140), SIZE = opt('size', 2000), STEP = opt('step', 5);
require(path.join(ROOT, 'tools', 'flight_core.js'));
const { islandWorld } = require(path.join(ROOT, 'tools', 'island_node'));
const W = islandWorld('jolene', {});
const I = W.island, g = I.grid;
const N = Math.round(SIZE / STEP) + 1, X0 = CX - SIZE / 2, Z0 = CZ - SIZE / 2;
const OUT = path.join(__dirname, 'data'); fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const H = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = W.terrainH(X0 + i * STEP, Z0 + j * STEP);
const cell = (x, z) => { const i = Math.floor((x - g.x0) / g.cell), k = Math.floor((z - g.z0) / g.cell);
  if (i < 0 || k < 0 || i >= g.w || k >= g.h) return -1; return k * g.w + i; };
const GROUP = { 6: 0, 12: 0, 5: 1, 8: 2, 13: 2, 16: 2, 2: 3, 7: 3, 14: 3, 3: 3, 15: 3, 11: 1, 4: 1, 9: 1, 10: 3, 1: 3, 0: 3 };
const codes = new Uint8Array(N * N * 4), alb = new Uint8Array(N * N * 3);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = X0 + i * STEP, z = Z0 + j * STEP, w = [0, 0, 0, 0]; let n = 0;
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const c = cell(x + a * g.cell, z + b * g.cell); if (c < 0) continue; w[GROUP[I.ttype[c]] ?? 3]++; n++; }
  for (let q = 0; q < 4; q++) codes[(j * N + i) * 4 + q] = Math.round(255 * w[q] / Math.max(n, 1));
  const c = cell(x, z); if (c >= 0 && I.albedo) for (let q = 0; q < 3; q++) alb[(j * N + i) * 3 + q] = I.albedo[c * 3 + q];
}
const at = (i, j) => H[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
// curvature: the Laplacian (m of height over the neighbours' mean; + = convex ridge, - = concave gully), at 5 m and 20 m
const curv = new Float32Array(N * N * 2);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  curv[(j * N + i) * 2] = at(i, j) - 0.25 * (at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1));
  curv[(j * N + i) * 2 + 1] = at(i, j) - 0.25 * (at(i - 4, j) + at(i + 4, j) + at(i, j - 4) + at(i, j + 4));
}
// flow accumulation, D8 on the patch (cells in metres^2 of catchment, log-scaled to a byte)
const ord = Array.from({ length: N * N }, (_, k) => k).sort((a, b) => H[b] - H[a]);
const acc = new Float32Array(N * N).fill(1);
for (const k of ord) { const i = k % N, j = (k / N) | 0; let best = -1, bd = 0;
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { if (!a && !b) continue; const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
    const d = (H[k] - H[jj * N + ii]) / Math.hypot(a, b); if (d > bd) { bd = d; best = jj * N + ii; } }
  if (best >= 0) acc[best] += acc[k]; }
const flow = new Uint8Array(N * N); for (let k = 0; k < N * N; k++) flow[k] = Math.min(255, Math.round(Math.log2(acc[k]) * 255 / 14));
const parts = [H, curv, codes, alb, flow];
const hdr = { cx: CX, cz: CZ, size: SIZE, step: STEP, n: N, x0: X0, z0: Z0, layout: [] };
let off = 0; const bufs = [];
for (const [name, a] of [['h', H], ['curv', curv], ['codes', codes], ['alb', alb], ['flow', flow]]) {
  const b = Buffer.from(a.buffer, a.byteOffset, a.byteLength); const pad = (4 - (b.length % 4)) % 4;
  hdr.layout.push({ name, type: a.constructor.name, off, len: a.length }); bufs.push(b, Buffer.alloc(pad)); off += b.length + pad; }
fs.writeFileSync(path.join(OUT, 'patch.bin'), Buffer.concat(bufs));
let hmin = 1e9, hmax = -1e9; for (const v of H) { hmin = Math.min(hmin, v); hmax = Math.max(hmax, v); } hdr.hmin = hmin; hdr.hmax = hmax;
fs.writeFileSync(path.join(OUT, 'patch.json'), JSON.stringify(hdr));
console.log(`patch ${N}x${N} at ${STEP} m around (${CX}, ${CZ}), h ${hmin.toFixed(0)}..${hmax.toFixed(0)} m, ${Date.now() - t0} ms`);
// ---- the rock kits, decoded by the game's codec
const { decodeTreePart } = require(path.join(ROOT, 'src', 'core', '53_tree_codec.js'));
const PACK = require(path.join(ROOT, 'src', 'viewer', 'trees_pack.js'));
const want = ['rocks', 'coast_rocks_05', 'namaqualand_cliff_02.glb'];
const rocks = { kits: [] }; const rb = []; let ro = 0;
const push = a => { const b = Buffer.from(a.buffer, a.byteOffset, a.byteLength); const pad = (4 - (b.length % 4)) % 4; const o = ro; rb.push(b, Buffer.alloc(pad)); ro += b.length + pad; return o; };
for (const c of PACK.collections) {
  if (!want.includes(c.name)) continue;
  const bin = new Uint8Array(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, c.bin))));
  const mats = (PACK.materials || {})[c.file] || (PACK.materials || {})[c.name] || {};
  const kit = { name: c.name, place: c.place, subjects: [] };
  for (const s of c.subjects) {
    const parts = s.rungs[0].parts.map(p => { const d = decodeTreePart(s.bb, p, bin); const M = mats[p.mat] || {};
      const rel = u => u ? path.relative(path.join(ROOT, 'tools', 'rock_study'), path.join(ROOT, u)).split(path.sep).join('/') : null;
      return { mat: p.mat, map: rel(M.base), nor: rel(M.nor), nv: d.pos.length / 3, nt: d.idx.length / 3, wide: d.idx instanceof Uint32Array,
        pos: push(d.pos), nrm: push(d.nrm), uv: push(d.uv), idx: push(d.idx) }; });
    kit.subjects.push({ name: s.name, h: s.h, bb: s.bb, tris: s.tris, parts });
  }
  rocks.kits.push(kit);
}
fs.writeFileSync(path.join(OUT, 'rocks.bin'), Buffer.concat(rb));
fs.writeFileSync(path.join(OUT, 'rocks.json'), JSON.stringify(rocks));
console.log('rocks: ' + rocks.kits.map(k => k.name + ' ' + k.subjects.length).join(', ') + `, ${(ro / 1024).toFixed(0)} KB`);
// ---- the ground sets the bench reads (the game's library files, media/tex/ground/<key>_{diff,nor_gl,height,rough}_512.*.jpg)
const GT = path.join(ROOT, 'media', 'tex', 'ground'), files = fs.readdirSync(GT);
const FG = require(path.join(ROOT, 'src', 'core', '28b_ground_fields.js'));
const RECIPE = (FG.GROUND_FIELDS || FG).RECIPE || (global.GROUND_FIELDS && GROUND_FIELDS.RECIPE);
const sets = {};
for (const k of ['grassRock', 'forestAir', 'rocksG', 'cliff', 'rocksB', 'darkRock']) {
  const f = s => { const m = files.find(n => n.startsWith(k + '_' + s + '_512.') && n.endsWith('.jpg')); return m ? '../../media/tex/ground/' + m : null; };
  sets[k] = { diff: f('diff'), nor: f('nor_gl'), height: f('height'), rough: f('rough'), grade: RECIPE && RECIPE.grade[k] || null,
    natural: RECIPE ? (RECIPE.library.find(r => r[0] === k) || [0, 0])[1] : 0 };
}
fs.writeFileSync(path.join(OUT, 'sets.json'), JSON.stringify({ sets, codes: RECIPE ? RECIPE.codes : null, knobs: RECIPE ? RECIPE.knobs : null }, null, 1));
console.log('sets: ' + Object.keys(sets).map(k => k + (sets[k].diff ? '' : ' (MISSING)')).join(', ') + (RECIPE ? '' : ' - RECIPE not found'));
