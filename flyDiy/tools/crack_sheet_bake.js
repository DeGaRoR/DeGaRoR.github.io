#!/usr/bin/env node
// crack_sheet_bake.js - CANOPY-CRACKS (12 Nov, option B, the user's choice: "B is good. Laminated and acrylic look good,
// keep only these 2"): bakes the glazing's CRACK SHEETS ONCE, here, so the page never draws a crack procedurally. The study
// (futureDesigns/CANOPY-CRACKS-2026-11.md) is why: the G3623 star (rays wobbling through two fbm octaves, a 6x-wide haze,
// concentric rings, a Voronoi honeycomb) read "like children drawings"; a real acrylic pane cracks in a few straight,
// forking hairlines round a crushed white spot, and a laminated one in a spider web that holds.
//
// TWO SHEETS (dmg_glass.js SHEET_MATS): 'acrylic' (glazeMat 0 acrylic and, until it has a look of its own, 1 polycarbonate)
// and 'laminated' (glazeMat 2 glass, every pane). Each is ONE pattern at full severity, SHEET_N x SHEET_N texels over
// SHEET_SPAN metres round the hit; the shader rotates and mirrors it by the mark's seed. RGBA8, the texel's:
//   R  the distance to the nearest crack, 0..SHEET_DMAX (the line is drawn in the shader, a hairline at any zoom)
//   G  when that crack ARRIVED as the crack grew, 0..1: the shader shows what arrived before the mark's severity (one sheet
//      for every severity: a light set is the core's short cracks, the full star the runners), and tapers toward the tips
//   B  the crack facet's phase (the glint: a crack is a small mirror in the sheet, so a few stretches flash and the rest
//      stay faint, and the flashes move as the eye does)
//   A  the crushed, whitened core (acrylic) or the powdered cone (laminated) at full severity; the shader shrinks it with
//      the severity
// The growth rules are the study page's (futureDesigns/canopy-cracks/canopy_cracks.html genAcrylic / drawLaminated, the
// look the user approved), fixed at full severity and given an arrival per point. Deterministic: a seeded generator,
// no Math.random; GATE DMGGLASS row K re-bakes and compares the signature with the shipped table.
// Writes:
//   media/tex/crack/acrylic.<sha8>.png, media/tex/crack/laminated.<sha8>.png   (rows top-down: v = 0 is row 0, flipY off)
//   src/viewer/crack_sheet.js   GENERATED: the two paths, N, the span, the distance scale, the signature
//
//   node tools/crack_sheet_bake.js          (re-run after a change here or to dmg_glass.js's SHEET_*; GATE DMGGLASS K)
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const DG = require('../src/viewer/dmg_glass.js');
const ROOT = path.join(__dirname, '..');
const TAU = Math.PI * 2;
const N = DG.SHEET_N, SPAN = DG.SHEET_SPAN, DMAX = DG.SHEET_DMAX, RMAX = DG.SHEET_R;
const SEEDS = { acrylic: 11, laminated: 3 };   // the study page's mock-ups the user approved (12 Nov)

function rng(seed) { let a = (seed * 2654435761) >>> 0 || 1; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = R => (R() + R() + R() - 1.5) * 1.15;
const clamp01 = x => Math.min(1, Math.max(0, x));
// the facet phase drifts along a crack and stays inside (0.05, 0.95): the shader's sin(TAU * phase) never sees a wrap
function drift(p, d) { p += d; if (p > 0.95) p = 1.9 - p; if (p < 0.05) p = 0.1 - p; return Math.min(0.95, Math.max(0.05, p)); }
function atRadius(pts, r) { for (const p of pts) if (Math.hypot(p[0], p[1]) >= r) return p; return null; }

// ---- ACRYLIC: a crushed white spot, a fringe of short cracks (hackle), branching runners to the frame, a few short arcs.
// Arrival: a runner's point at path length s (from the hit, through its parents) arrives at (s - 0.07) / 0.46 + its
// runner's offset - the study's reach 0.07 + 0.46 sev; four runners start at once, the others later (a light set shows
// a small star, not every runner cut short)
function genAcrylic(seed) {
  const R = rng(seed), segs = [], mains = [];
  const reach = 0.53, rc = 0.026, NR = 8 + (R() < 0.5 ? 0 : 1), a0 = R() * TAU;
  const arr = (s, off) => clamp01((s - 0.07) / 0.46 + off);
  function grow(x, y, ang, len, depth, ph, s0, off, main) {
    const pts = [[x, y]]; let t = 0;
    while (t < len) {
      const sl = 0.010 + R() * 0.022;
      ang += gauss(R) * 0.03;
      if (R() < 0.13) ang += (R() < 0.5 ? -1 : 1) * (0.10 + R() * 0.24);
      const nx = x + Math.cos(ang) * sl, ny = y + Math.sin(ang) * sl, ph2 = drift(ph, gauss(R) * 0.06);
      segs.push({ x0: x, y0: y, x1: nx, y1: ny, g0: arr(s0 + t, off), g1: arr(s0 + t + sl, off), p0: ph, p1: ph2 });
      x = nx; y = ny; t += sl; ph = ph2; pts.push([x, y]);
      if (depth < 2 && R() < 0.12 * (1 - t / len)) {
        const sgn = R() < 0.5 ? -1 : 1;
        grow(x, y, ang + sgn * (0.22 + R() * 0.35), (len - t) * (0.3 + R() * 0.5), depth + 1, drift(ph, (R() - 0.5) * 0.4), s0 + t, off, 0);
      }
    }
    if (main) mains.push({ a: main, pts });
  }
  for (let i = 0; i < NR; i++) {
    const ang = a0 + i * TAU / NR + (R() - 0.5) * 0.6 * TAU / NR, len = reach * (0.45 + 0.55 * R());
    const off = i % 2 === 0 || i === 1 ? 0 : 0.08 + 0.45 * R();
    grow(Math.cos(ang) * rc * 0.25, Math.sin(ang) * rc * 0.25, ang, len, 0, 0.1 + 0.8 * R(), 0, off, ((ang % TAU) + TAU) % TAU || 1e-6);
  }
  const nH = 34;   // (a tick arrives with its radius: a light set's small core has its own fringe, nothing detached)
  for (let i = 0; i < nH; i++) {
    const a = R() * TAU, r0 = rc * (0.6 + 0.7 * R()), l = 0.003 + 0.016 * R() * 1.4, an = a + (R() - 0.5) * 0.6, g = clamp01((r0 - 0.012) / 0.03) * 0.6 + R() * 0.25, ph = 0.1 + 0.8 * R();
    segs.push({ x0: Math.cos(a) * r0, y0: Math.sin(a) * r0, x1: Math.cos(a) * r0 + Math.cos(an) * l, y1: Math.sin(a) * r0 + Math.sin(an) * l, g0: g, g1: g, p0: ph, p1: ph });
  }
  mains.sort((p, q) => p.a - q.a);
  const nA = 2 + Math.floor(R() * 2);
  for (let j = 0; j < nA; j++) {
    const i = Math.floor(R() * mains.length), m1 = mains[i], m2 = mains[(i + 1) % mains.length], rr = 0.022 + 0.045 * R();
    const p1 = atRadius(m1.pts, rr), p2 = atRadius(m2.pts, rr * (0.9 + 0.2 * R())), g = 0.80 + 0.18 * R(), ph = 0.1 + 0.8 * R();
    if (!p1 || !p2) continue;
    const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, ml = Math.hypot(mx, my) || 1, bow = 0.12 * Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
    const c = [mx + mx / ml * bow, my + my / ml * bow];
    segs.push({ x0: p1[0], y0: p1[1], x1: c[0], y1: c[1], g0: g, g1: g, p0: ph, p1: ph });
    segs.push({ x0: c[0], y0: c[1], x1: p2[0], y1: p2[1], g0: g, g1: g, p0: ph, p1: ph });
  }
  const core = []; const m = 9 + Math.floor(R() * 5);
  for (let i = 0; i < m; i++) core.push(rc * (0.6 + 0.6 * R()));
  return { segs, core, rc, white: [0.85, 0.55], speckle: 160, R };
}

// ---- LAMINATED: many straight radials, chords between neighbours at irregular radii (the web), a powdered white cone.
// Arrival: (s - 0.08) / 0.30 along a radial (the study's reach 0.08 + 0.30 sev), a chord when its radius is reached
function genLaminated(seed) {
  const R = rng(seed), segs = [], rays = [];
  const reach = 0.38, NR = 14 + Math.floor(R() * 8), a0 = R() * TAU;
  const arr = s => clamp01((s - 0.08) / 0.30);
  for (let i = 0; i < NR; i++) {
    let ang = a0 + i * TAU / NR + (R() - 0.5) * 0.35 * TAU / NR, x = 0, y = 0, t = 0, ph = 0.1 + 0.8 * R();
    const len = reach * (0.55 + 0.45 * R()), pts = [[0, 0]], off = i % 3 === 2 ? 0.1 + 0.2 * R() : 0;
    while (t < len) {
      const sl = 0.012 + R() * 0.02; ang += gauss(R) * 0.015; if (R() < 0.05) ang += (R() - 0.5) * 0.3;
      const nx = x + Math.cos(ang) * sl, ny = y + Math.sin(ang) * sl, ph2 = drift(ph, gauss(R) * 0.05);
      segs.push({ x0: x, y0: y, x1: nx, y1: ny, g0: clamp01(arr(t) + off), g1: clamp01(arr(t + sl) + off), p0: ph, p1: ph2 });
      x = nx; y = ny; t += sl; ph = ph2; pts.push([x, y]);
    }
    rays.push(pts);
  }
  let r = 0.012;
  while (r < reach * 0.95) {
    r *= 1.22 + R() * 0.32;
    for (let i = 0; i < NR; i++) {
      if (R() > 0.72) continue;
      const p1 = atRadius(rays[i], r * (0.93 + 0.14 * R())), p2 = atRadius(rays[(i + 1) % NR], r * (0.93 + 0.14 * R()));
      if (!p1 || !p2) continue;
      const g = clamp01(arr(r) + 0.05), ph = 0.1 + 0.8 * R();
      segs.push({ x0: p1[0], y0: p1[1], x1: p2[0], y1: p2[1], g0: g, g1: g, p0: ph, p1: ph });
    }
  }
  const rc = 0.026, core = []; for (let i = 0; i < 12; i++) core.push(rc * (0.8 + 0.4 * R()));
  return { segs, core, rc, white: [1.0, 0.75], speckle: 320, R };
}

// ---- the sheet: the distance field, the arrival and the phase of the nearest crack, the whitened core ----
function rasterise(P) {
  const tx = SPAN / N, D = new Float32Array(N * N).fill(DMAX), G = new Float32Array(N * N).fill(1), PH = new Float32Array(N * N).fill(0.5), A = new Float32Array(N * N);
  const X = i => (i + 0.5) * tx - SPAN / 2;
  for (const s of P.segs) {
    // the sheet's edge: a crack past RMAX is cut there (the shader returns nothing past it)
    if (Math.hypot(s.x0, s.y0) > RMAX) continue;
    let { x1, y1, g1, p1 } = s;
    const r1 = Math.hypot(x1, y1);
    if (r1 > RMAX) { const f = (RMAX - Math.hypot(s.x0, s.y0)) / Math.max(1e-9, r1 - Math.hypot(s.x0, s.y0)); x1 = s.x0 + (x1 - s.x0) * f; y1 = s.y0 + (y1 - s.y0) * f; g1 = s.g0 + (g1 - s.g0) * f; p1 = s.p0 + (p1 - s.p0) * f; }
    const dx = x1 - s.x0, dy = y1 - s.y0, L2 = dx * dx + dy * dy || 1e-12;
    const i0 = Math.max(0, Math.floor((Math.min(s.x0, x1) - DMAX + SPAN / 2) / tx)), i1 = Math.min(N - 1, Math.ceil((Math.max(s.x0, x1) + DMAX + SPAN / 2) / tx));
    const j0 = Math.max(0, Math.floor((Math.min(s.y0, y1) - DMAX + SPAN / 2) / tx)), j1 = Math.min(N - 1, Math.ceil((Math.max(s.y0, y1) + DMAX + SPAN / 2) / tx));
    for (let j = j0; j <= j1; j++) { const y = X(j);
      for (let i = i0; i <= i1; i++) { const x = X(i);
        const t = Math.min(1, Math.max(0, ((x - s.x0) * dx + (y - s.y0) * dy) / L2)), ex = s.x0 + dx * t - x, ey = s.y0 + dy * t - y, d = Math.sqrt(ex * ex + ey * ey);
        const k = j * N + i; if (d < D[k]) { D[k] = d; G[k] = s.g0 + (g1 - s.g0) * t; PH[k] = s.p0 + (p1 - s.p0) * t; } } }
  }
  // the core: an irregular polygon (its radius per angle between the drawn vertices), a radial falloff, and a speckle
  const rc = P.rc, m = P.core.length, rOut = rc * 1.6, R = P.R;
  const ic = Math.ceil(rOut / tx) + 2, c0 = N / 2;
  for (let j = Math.floor(c0 - ic); j <= Math.ceil(c0 + ic); j++) for (let i = Math.floor(c0 - ic); i <= Math.ceil(c0 + ic); i++) {
    const x = X(i), y = X(j), r = Math.hypot(x, y); let a = Math.atan2(y, x); if (a < 0) a += TAU;
    const f = a / TAU * m, k0 = Math.floor(f) % m, k1 = (k0 + 1) % m, rp = P.core[k0] + (P.core[k1] - P.core[k0]) * (f - Math.floor(f));
    const rg = rp * 1.25 / 1.2;   // the study's radial gradient, out to 1.25 rc, inside the polygon
    let w = 0;
    if (r < rp) { const u = r / rg; w = u < 0.6 ? P.white[0] + (P.white[1] - P.white[0]) * u / 0.6 : P.white[1] * Math.max(0, 1 - (u - 0.6) / 0.4); }
    A[j * N + i] = Math.max(A[j * N + i], w);
  }
  for (let s = 0; s < P.speckle; s++) {
    const a = R() * TAU, r = Math.sqrt(R()) * rOut, v = (0.15 + 0.5 * R()) * (1 - r / rOut), sz = 1 + Math.floor(R() * 2);
    const i = Math.floor((Math.cos(a) * r + SPAN / 2) / tx), j = Math.floor((Math.sin(a) * r + SPAN / 2) / tx);
    for (let jj = j; jj < j + sz; jj++) for (let ii = i; ii < i + sz; ii++) if (ii >= 0 && jj >= 0 && ii < N && jj < N) A[jj * N + ii] = Math.max(A[jj * N + ii], v);
  }
  const out = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    out[k * 4] = Math.round(Math.min(1, D[k] / DMAX) * 255);
    out[k * 4 + 1] = D[k] >= DMAX ? 255 : Math.round(clamp01(G[k]) * 255);
    out[k * 4 + 2] = Math.round(clamp01(PH[k]) * 255);
    out[k * 4 + 3] = Math.round(clamp01(A[k]) * 255);
  }
  return out;
}
const CACHE = {};
// bake(mat) -> { N, data: Uint8Array RGBA, row 0 = v 0 }: what the shipped PNG holds, byte for byte
function bake(mat) {
  if (CACHE[mat]) return CACHE[mat];
  if (!SEEDS[mat]) throw new Error('crack_sheet_bake: no sheet ' + mat);
  const P = mat === 'laminated' ? genLaminated(SEEDS[mat]) : genAcrylic(SEEDS[mat]);
  return (CACHE[mat] = { N, data: rasterise(P), segs: P.segs.length });
}
const sigOf = () => { const h = crypto.createHash('sha256'); for (const m of DG.SHEET_MATS) h.update(Buffer.from(bake(m).data.buffer)); return h.digest('hex').slice(0, 16); };

function png(W, H, rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

if (require.main === module) {
  const { writeMedia, pruneMedia } = require('./_media_lib.js');
  const t0 = Date.now(), files = {};
  for (const m of DG.SHEET_MATS) files[m] = writeMedia('tex/crack', m, 'png', png(N, N, bake(m).data));
  pruneMedia('tex/crack', Object.values(files));   // the baker owns media/tex/crack: an older sheet goes (GATE MEDIA's orphans)
  const meta = Object.assign({}, files, { N, span: SPAN, dmax: DMAX, sig: sigOf() });
  const out = '// crack_sheet.js - GENERATED by tools/crack_sheet_bake.js (CANOPY-CRACKS, 12 Nov): the glazing\'s two crack sheets\n' +
    '// (acrylic, laminated), baked once and shipped as images; app.js fetches the flown aeroplane\'s one at the flight\'s start.\n' +
    "// Do not edit: re-run the baker.\n'use strict';\nvar CRACK_SHEET = " + JSON.stringify(meta) + ';\n' +
    "if (typeof window !== 'undefined') window.CRACK_SHEET = CRACK_SHEET;\nif (typeof module !== 'undefined' && module.exports) module.exports = CRACK_SHEET;\n";
  fs.writeFileSync(path.join(ROOT, 'src', 'viewer', 'crack_sheet.js'), out);
  console.log('crack_sheet_bake: ' + DG.SHEET_MATS.map(m => files[m] + ' (' + fs.statSync(path.join(ROOT, files[m])).size + ' bytes, ' + bake(m).segs + ' segments)').join(' + ') + ', sig ' + meta.sig + ', ' + (Date.now() - t0) + ' ms');
}
module.exports = { bake, sigOf, png, SEEDS };
