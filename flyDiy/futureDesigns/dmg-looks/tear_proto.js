// DMG-LOOKS prototype 1 (node only, nothing in src/ touched): A TORN SEAM INSTEAD OF A CUT ONE.
//
// Today (skin_break.js event(), step 3) a triangle whose vertices sit on two pieces is removed. On a regular skin
// that is a one-triangle-wide straight slot along the break: "disassembled, not torn" (the user, 25 Oct 2026).
// This prototype runs the proposed EVENT-TIME rule on a flat test panel (1.2 m x 0.8 m, triangles ~3.5 cm, about
// the flown Cub snapshot's density) and draws the result with a software raster that stands in for the shader:
//   1. a TEAR PATH per material, seeded, replacing the straight seam (which vertex goes with which piece);
//   2. a GAP: extra triangles removed along the path where the material loses some (fabric springs open, composite
//      sheds shards); triangles are still only REMOVED, as today (index collapse: no new geometry, no re-layout);
//   3. RIM JITTER: the vertices left on the torn edge move in the surface plane by seeded noise (breaks the staircase);
//   4. an EDGE-DISTANCE field e (metres from the torn edge, Dijkstra over the kept mesh, band-limited to 15 cm): one
//      scalar per place. It drives the RIM BAND colours (bare metal, primer, raw wood, frayed thread, exposed fibre) and
//   5. the CURL field: petals of sheet curled out / in near the edge, a fabric flap sagging - a fixed offset per place
//      made at the event, exactly like the existing DRAPE field (skin_break.js, G1852).
// With --erode the raster also does the optional sub-triangle erosion (a shader `discard` where e + noise < 0).
//
//   node tear_proto.js            -> tear_panels.png (rows: today, alu 2024-T3, doped fabric, composite, plywood)
//   node tear_proto.js --erode    -> tear_panels_erode.png
//   node tear_proto.js --perf     -> the event's cost on an 85k-place mesh (the Cub snapshot's welded places)
'use strict';
const fs = require('fs');
const path = require('path');
const PNG = require('./png.js');
const N = require('./noise.js');

const W = 1.2, H = 0.8, HS = 0.035;          // the panel (m) and its triangle size
const X0 = 0.6 + 0.37 * HS;                   // the break (a frame / rib line), off the grid lines like a real seam
const BAND = 0.15;                            // the edge field's reach (m)

function grid(w, h, hs) {
  const nx = Math.round(w / hs), ny = Math.round(h / hs), nv = (nx + 1) * (ny + 1);
  const P = new Float64Array(nv * 3), T = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const v = j * (nx + 1) + i; P[v * 3] = i * w / nx; P[v * 3 + 1] = j * h / ny; }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    if ((i + j) & 1) T.push(a, b, d, a, d, c); else T.push(a, b, c, b, d, c);
  }
  return { nx, ny, nv, P, T: Int32Array.from(T), nt: T.length / 3 };
}

// ---- THE TEAR PATH, per material: x of the tear at height y (a polyline sampled every cm) ----
const PROFILES = {
  // TODAY: the seam itself, straight
  today: { path: () => y => X0, gap: () => 0, curl: null, noJitter: true, paint: [0.91, 0.90, 0.87], back: [0.91, 0.90, 0.87], rivets: true },
  // 2024-T3 RIVETED SHEET: it UNZIPS along rivet lines (the frame at X0, stringer lines +-0.12 m) in runs, then tears
  // ACROSS the sheet to the next line in a jagged diagonal; the edge petals curl out and in; paint flakes off the bent rim
  alu: {
    path(seed) {
      const r = N.rng(seed), lines = [X0 - 0.12, X0, X0 + 0.12], xs = [];
      let k = 1, y = 0, x = X0;
      while (y <= H + 0.01) {
        const run = 0.08 + 0.17 * r();
        for (let t = 0; t < run && y <= H + 0.01; t += 0.01, y += 0.01) xs.push(lines[k] + 0.003 * N.fbm1(y * 60, seed, 3));
        if (r() < 0.55) { const k2 = Math.max(0, Math.min(2, k + (r() < 0.5 ? -1 : 1))); if (k2 !== k) {
          const dy = 0.04 + 0.05 * r(), xa = lines[k], xb = lines[k2];
          for (let t = 0; t < dy && y <= H + 0.01; t += 0.01, y += 0.01) xs.push(xa + (xb - xa) * (t / dy) + 0.012 * N.fbm1(y * 35, seed + 7, 3));
          k = k2; } }
      }
      return yy => xs[Math.max(0, Math.min(xs.length - 1, Math.round(yy / 0.01)))];
    },
    gap: (y, seed) => Math.max(0, 0.006 * N.fbm1(y * 20, seed + 3, 2)),
    curl: { L: 0.10, A: 0.07, petal: [0.06, 0.15] },
    rim: [[0.004, [0.80, 0.82, 0.85]], [0.014, [0.55, 0.62, 0.30]], [0.03, 'chip']],   // bare alu, primer, chipped paint
    paint: [0.91, 0.90, 0.87], back: [0.55, 0.62, 0.30], rivets: true,
  },
  // DOPED FABRIC over tube: it tears ALONG THE WEAVE (straight runs, right-angle steps), springs open (drum-tight
  // dope: the gap is centimetres), frays (loose threads), and a flap hangs in, showing its undoped underside
  fabric: {
    path(seed) {
      const r = N.rng(seed), xs = []; let x = X0, y = 0;
      while (y <= H + 0.01) {
        const run = 0.10 + 0.25 * r();
        for (let t = 0; t < run && y <= H + 0.01; t += 0.01, y += 0.01) xs.push(x + 0.002 * N.fbm1(y * 120, seed, 2));
        if (r() < 0.6) x = Math.max(X0 - 0.15, Math.min(X0 + 0.15, x + (r() < 0.5 ? -1 : 1) * (0.04 + 0.08 * r())));
      }
      return yy => xs[Math.max(0, Math.min(xs.length - 1, Math.round(yy / 0.01)))];
    },
    gap: (y, seed) => 0.015 + 0.03 * Math.max(0, N.fbm1(y * 4, seed + 3, 2) + 0.4),
    curl: { L: 0.18, A: -0.05, petal: [0.15, 0.35], flap: true },
    rim: [[0.003, [0.85, 0.82, 0.72]], [0.008, 'fray']],
    paint: [0.91, 0.70, 0.12], back: [0.80, 0.77, 0.68], threads: true, tubes: true,
  },
  // GLASS / CARBON LAMINATE: it CRACKS - an angular polyline, shards missing along it, no stretch, no curl; the rim shows
  // the pale fibre under the gelcoat and tufts
  composite: {
    path(seed) {
      const r = N.rng(seed), xs = []; let x = X0, y = 0, a = 0;
      while (y <= H + 0.01) {
        const seg = 0.03 + 0.07 * r(); a = (r() < 0.5 ? -1 : 1) * (0.35 + 0.7 * r());
        for (let t = 0; t < seg && y <= H + 0.01; t += 0.01, y += 0.01) { x += Math.tan(a) * 0.01; x = Math.max(X0 - 0.1, Math.min(X0 + 0.1, x)); xs.push(x); }
      }
      return yy => xs[Math.max(0, Math.min(xs.length - 1, Math.round(yy / 0.01)))];
    },
    gap: (y, seed) => 0, shards: 0.35,
    curl: null,
    rim: [[0.006, [0.78, 0.80, 0.72]], [0.012, [0.45, 0.46, 0.42]]],
    paint: [0.95, 0.94, 0.91], back: [0.60, 0.60, 0.55], tufts: true,
  },
  // PLYWOOD (a Jodel's ply fuselage, a leading-edge D-box): it SPLINTERS - the break across the grain is a comb of
  // slivers along the grain (x here), interlocking; raw wood shows at the rim
  ply: {
    path(seed) {
      const xs = [];
      for (let y = 0; y <= H + 0.01; y += 0.01) {
        const band = Math.floor(y / 0.016), f = (y / 0.016) - band, len = (N.h1(band, seed) * 2 - 1) * 0.07;
        xs.push(X0 + len * (1 - Math.abs(2 * f - 1)) + 0.004 * N.fbm1(y * 50, seed, 2));
      }
      return yy => xs[Math.max(0, Math.min(xs.length - 1, Math.round(yy / 0.01)))];
    },
    gap: (y, seed) => 0.003,
    curl: { L: 0.05, A: 0.015, petal: [0.02, 0.05] },
    rim: [[0.008, [0.73, 0.55, 0.32]], [0.016, [0.52, 0.36, 0.20]]],
    paint: [0.30, 0.42, 0.62], back: [0.66, 0.50, 0.30],
  },
};

// ---- THE EVENT: pieces, removed triangles, rim jitter, edge field, curl. Returns per-place arrays ----
function event(M, prof, seed) {
  const { P, T, nv, nt } = M, xp = prof.path(seed);
  const side = new Int8Array(nv), s = new Float64Array(nv);
  for (let v = 0; v < nv; v++) { s[v] = P[v * 3] - xp(P[v * 3 + 1]); side[v] = s[v] < 0 ? 0 : 1; }
  const dead = new Uint8Array(nt);
  for (let t = 0; t < nt; t++) {
    const a = T[t * 3], b = T[t * 3 + 1], c = T[t * 3 + 2];
    if (side[a] !== side[b] || side[a] !== side[c]) { dead[t] = 1; continue; }             // today's rule: spans the break
    const cy = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3, g = prof.gap(cy, seed);
    if (g > 0 && Math.min(Math.abs(s[a]), Math.abs(s[b]), Math.abs(s[c])) < g) dead[t] = 1;  // the material lost along the tear
  }
  // rim places (on a kept AND a dead triangle), then the edge field over the kept mesh
  const onKept = new Uint8Array(nv), onDead = new Uint8Array(nv);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) (dead[t] ? onDead : onKept)[T[t * 3 + k]] = 1;
  const e = dijkstra(M, dead, v => onKept[v] && onDead[v]);
  if (prof.shards) {          // composite: shards drop out in clusters near the crack (a second, seeded pass)
    for (let t = 0; t < nt; t++) { if (dead[t]) continue; const a = T[t * 3], b = T[t * 3 + 1], c = T[t * 3 + 2];
      const em = Math.min(e[a], e[b], e[c]), cx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, cy = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3;
      if (em < 0.04 && N.v2(cx * 30, cy * 30, seed + 11) < prof.shards * (1 - em / 0.04)) dead[t] = 1; }
    onKept.fill(0); onDead.fill(0);
    for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) (dead[t] ? onDead : onKept)[T[t * 3 + k]] = 1;
    e.set(dijkstra(M, dead, v => onKept[v] && onDead[v]));
  }
  // rim jitter (in the surface plane) and the curl field (along the normal, z here)
  const off = new Float64Array(nv * 3);
  for (let v = 0; v < nv; v++) {
    if (!onKept[v]) continue;
    const x = P[v * 3], y = P[v * 3 + 1];
    if (e[v] === 0 && !prof.noJitter) { off[v * 3] += 0.35 * HS * N.fbm2(x * 40, y * 40, seed + 5, 2); off[v * 3 + 1] += 0.35 * HS * N.fbm2(x * 40, y * 40, seed + 9, 2); }
    const C = prof.curl; if (!C || e[v] >= C.L) continue;
    const f = (1 - e[v] / C.L) ** 2;
    // petals: segments along the tear, seeded widths, alternating out / in, some flat
    const pw = C.petal[0] + (C.petal[1] - C.petal[0]) * N.h1(Math.floor(y / C.petal[1]), seed + side[v] * 101);
    const pk = Math.floor(y / pw), sg = C.flap ? 1 : [1, -0.6, 0, 1, 0.5, -1][Math.floor(N.h1(pk, seed + 13 + side[v]) * 6)];
    const bell = Math.sin(Math.PI * ((y / pw) - pk));
    off[v * 3 + 2] += C.A * f * sg * (C.flap ? 1 : bell);
  }
  return { side, dead, e, off, xp };
}

function dijkstra(M, dead, isSrc) {
  const { P, T, nv, nt } = M, e = new Float64Array(nv).fill(Infinity), adj = new Map();   // only the places the triangles touch
  const link = (a, b) => { let L = adj.get(a); if (!L) adj.set(a, L = []); L.push(b); };
  for (let t = 0; t < nt; t++) { if (dead[t]) continue; for (let k = 0; k < 3; k++) { const a = T[t * 3 + k], b = T[t * 3 + (k + 1) % 3]; link(a, b); link(b, a); } }
  const heap = [];
  const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const v of adj.keys()) if (isSrc(v)) { e[v] = 0; push(0, v); }
  while (heap.length) { const [d, v] = pop(); if (d > e[v] || d > BAND) continue;
    for (const u of adj.get(v) || []) { const nd = d + Math.hypot(P[u * 3] - P[v * 3], P[u * 3 + 1] - P[v * 3 + 1]); if (nd < e[u]) { e[u] = nd; push(nd, u); } } }
  for (let v = 0; v < nv; v++) if (e[v] > BAND) e[v] = BAND;
  return e;
}

// ---- THE RASTER (a stand-in for the shader: lambert on the curled surface, the rim band from e) ----
const MPX = 0.002, MARGIN = 20, SEP = 0.05;          // 2 mm a pixel; piece B drawn 5 cm off (the parting)
const PW = Math.round((W + SEP) / MPX) + 2 * MARGIN, PH = Math.round(H / MPX) + 2 * MARGIN;
const LIGHT = (() => { const l = [-0.45, 0.55, 0.70], n = Math.hypot(...l); return l.map(c => c / n); })();

function render(prof, ev, M, seed, erode, img, oy, IW) {
  const { P, T, nt } = M, BG = [0.17, 0.18, 0.20];
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const o = ((oy + y) * IW + x) * 4; img[o] = BG[0] * 255; img[o + 1] = BG[1] * 255; img[o + 2] = BG[2] * 255; img[o + 3] = 255; }
  const put = (x, y, c) => { if (x < 0 || y < 0 || x >= PW || y >= PH) return; const o = ((oy + y) * IW + x) * 4; img[o] = Math.min(255, c[0] * 255); img[o + 1] = Math.min(255, c[1] * 255); img[o + 2] = Math.min(255, c[2] * 255); };
  const scr = v => { const dx = ev.side[v] ? SEP : 0, z = ev.off[v * 3 + 2];
    return [MARGIN + (P[v * 3] + ev.off[v * 3] + dx) / MPX, MARGIN + (H - (P[v * 3 + 1] + ev.off[v * 3 + 1]) - 0.6 * z) / MPX]; };
  // the structure seen through the hole (fabric over tube): two tubes behind the skin
  if (prof.tubes) for (const tx of [X0 - 0.02, X0 + 0.27]) for (let y = 0; y < PH; y++) for (let w = -5; w <= 5; w++) {
    const sh = 0.35 + 0.4 * Math.cos(w / 5 * 1.4); put(Math.round(MARGIN + tx / MPX) + w, y, [0.42 * sh + 0.1, 0.45 * sh + 0.1, 0.40 * sh + 0.1]); }
  for (let t = 0; t < nt; t++) {
    if (ev.dead[t]) continue;
    const a = T[t * 3], b = T[t * 3 + 1], c = T[t * 3 + 2], A = scr(a), B = scr(b), C = scr(c);
    // face normal on the curled surface
    const p = v => [P[v * 3] + ev.off[v * 3], P[v * 3 + 1] + ev.off[v * 3 + 1], ev.off[v * 3 + 2]];
    const pa = p(a), pb = p(b), pc = p(c), u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], w = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const nl = Math.hypot(...n); n = n.map(q => q / nl);
    if (n[2] < 0) n = n.map(q => -q);
    const tilt = Math.abs(ev.off[a * 3 + 2] + ev.off[b * 3 + 2] + ev.off[c * 3 + 2]) / 3;
    const backside = prof.curl && prof.curl.flap ? (ev.off[a * 3 + 2] < -0.012 && ev.off[b * 3 + 2] < -0.012 && ev.off[c * 3 + 2] < -0.012)
                   : (prof.curl && tilt > 0.035 && Math.abs(n[0]) > 0.55);   // a petal turned far enough shows its inside
    const lam = 0.35 + 0.65 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const x0 = Math.floor(Math.min(A[0], B[0], C[0])), x1 = Math.ceil(Math.max(A[0], B[0], C[0])), y0 = Math.floor(Math.min(A[1], B[1], C[1])), y1 = Math.ceil(Math.max(A[1], B[1], C[1]));
    const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5, l1 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / den, l2 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const wx = (px - MARGIN) * MPX, wy = H - (py - MARGIN) * MPX;
      let e = l1 * ev.e[a] + l2 * ev.e[b] + l3 * ev.e[c];
      const nz = N.fbm2(wx * 90, wy * 90, seed + 21, 3);          // the fine noise the shader would add (sub-triangle)
      const ee = e + 0.006 * nz;
      if (erode && ee < 0.002) continue;                           // the optional erosion: a discard along the rim
      let col = backside ? prof.back : prof.paint;
      if (prof.rim && !backside) for (const [lim, cc] of prof.rim) {
        if (ee < lim) {
          if (cc === 'chip') { if (N.v2(wx * 160, wy * 160, seed + 31) > 0.45 + 12 * (ee - 0.014)) col = [0.80, 0.82, 0.85]; }
          else if (cc === 'fray') { if (N.v2(wx * 400, wy * 60, seed + 33) > 0.5) col = [0.85, 0.82, 0.72]; }
          else col = cc;
          break;
        }
      }
      if (prof.rivets && !backside) {                              // rivet heads on the lines (25 mm pitch); pulled through on the tear
        for (const lx of [X0 - 0.12, X0, X0 + 0.12]) { const ry = Math.round(wy / 0.025) * 0.025, dx = wx - lx - (ev.side[a] ? SEP : 0), dy = wy - ry;
          if (dx * dx + dy * dy < 0.0028 * 0.0028) col = ee < 0.006 ? BG : [0.62, 0.63, 0.64]; }
      }
      put(x, y, col.map(q => q * lam));
    }
  }
  // fabric: loose threads off the torn edge; composite: fibre tufts
  if (prof.threads || prof.tufts) { const r = N.rng(seed + 77);
    for (let t = 0; t < nt; t++) { if (ev.dead[t]) continue; for (let k = 0; k < 3; k++) { const v = T[t * 3 + k]; if (ev.e[v] !== 0 || r() > 0.5) continue;
      const S = scr(v), dir = ev.side[v] ? 1 : -1, L = (prof.threads ? 6 : 3) + r() * (prof.threads ? 14 : 5), ang = (r() - 0.5) * (prof.threads ? 0.9 : 1.6), sag = prof.threads ? 0.06 : 0;
      for (let i = 0; i < L; i++) put(Math.round(S[0] - dir * i * Math.cos(ang)), Math.round(S[1] + i * Math.sin(ang) + sag * i * i / L), prof.threads ? [0.80, 0.77, 0.66] : [0.82, 0.84, 0.78]); } } }
}

function main() {
  const erode = process.argv.includes('--erode');
  if (process.argv.includes('--perf')) return perf();
  const rows = ['today', 'alu', 'fabric', 'composite', 'ply'], IW = PW, IH = PH * rows.length;
  const img = new Uint8Array(IW * IH * 4), M = grid(W, H, HS), seed = 1935;
  rows.forEach((k, i) => { const ev = event(M, PROFILES[k], seed + i); render(PROFILES[k], ev, M, seed + i, erode, img, i * PH, IW);
    const dead = ev.dead.reduce((s, d) => s + d, 0); console.log(`${k.padEnd(10)} triangles removed ${String(dead).padStart(4)} / ${M.nt}  rim places ${ev.e.reduce((s, x) => s + (x === 0), 0)}`); });
  const out = path.join(__dirname, erode ? 'tear_panels_erode.png' : 'tear_panels.png');
  fs.writeFileSync(out, PNG.encode(IW, IH, img)); console.log('wrote', out, IW + 'x' + IH);
}

// THE COST: the event on an 85k-place mesh (the user's Cub snapshot: ~500k drawn vertices, ~85k welded places - G1818),
// with a tear across it. Only the band near the break is walked by the edge field.
function perf() {
  const M = grid(10.2, 10.2, 0.035);   // 292 x 292 cells -> ~85k places
  console.log('places', M.nv, 'triangles', M.nt);
  for (const k of ['alu', 'fabric', 'composite', 'ply']) {
    const prof = Object.assign({}, PROFILES[k]);
    const t0 = process.hrtime.bigint(); const ev = event(M, prof, 7); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`${k.padEnd(10)} event ${ms.toFixed(1)} ms (whole mesh, unoptimised: adjacency built per call)  removed ${ev.dead.reduce((s, d) => s + d, 0)}`);
  }
  // ...and as the real event would run it: only the triangles within 0.25 m of the break at rest (the places bound to the
  // broken members' nodes), here a 10.2 m long tear across the whole sheet
  const keep = []; for (let t = 0; t < M.nt; t++) { const a = M.T[t * 3]; if (Math.abs(M.P[a * 3] - X0) < 0.25) keep.push(M.T[t * 3], M.T[t * 3 + 1], M.T[t * 3 + 2]); }
  const S = { P: M.P, nv: M.nv, T: Int32Array.from(keep), nt: keep.length / 3 };
  for (const k of ['alu', 'fabric', 'composite', 'ply']) {
    let ms = 0; for (let r = 0; r < 3; r++) { const t0 = process.hrtime.bigint(); event(S, PROFILES[k], 7 + r); ms = Number(process.hrtime.bigint() - t0) / 1e6; }
    console.log(`${k.padEnd(10)} event ${ms.toFixed(1)} ms on the band only (${S.nt} triangles, a 10.2 m tear; warm, 3rd run; the per-place loops still walk all ${M.nv})`);
  }
}
if (require.main === module) main();
module.exports = { grid, event, PROFILES, W, H, HS, X0 };
