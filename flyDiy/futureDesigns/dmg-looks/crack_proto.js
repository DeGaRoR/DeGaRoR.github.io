// DMG-LOOKS prototype 3 (node only): THE WINDOW'S CRACK MASK, PROCEDURAL, ONE PURE FUNCTION PER PIXEL.
//
// Light aircraft glazing is monolithic stretched / cast ACRYLIC (PMMA): brittle (notched Charpy ~2 kJ/m2), it cracks in a
// few long radial lines with concentric arcs, crazes white, and fails in LARGE SHARP SHARDS (or the pane leaves its
// frame) - never tempered glass's cubes, never laminated glass's held spider-web. Three states:
//   S1 CRAZING  a white hairline network (age, solvent, a hard landing's flex) - roughness / haze only, pane intact
//   S2 STAR     an impact: 5-9 radial cracks, 1-3 concentric arcs, whitened crack edges, a crazed core
//   S3 FAILED   S2 plus missing shards (alpha 0) near the impact, a jagged rim left in the frame
// mask(u, v, P) -> [R crack line, G haze / whitening, B hole] in the pane's own metres (the glass hook's `mm`:
// vSurf.xy * uFieldM), impact (P.cx, P.cy), severity P.s, seed P.seed. Written with no tables, no texture and no loop
// longer than a #define, so it ports 1:1 into the glass hook (aeroskin.js aeroGlass, beside AERO_WX_GLASS_FS) as an
// `if (uCrack.z > 0.0)` block. The same function bakes the optional atlas (crack_atlas.png, 512 x 512, 2 x 2 variants).
//   node crack_proto.js  -> crack_states.png (preview on a sky gradient) + crack_atlas.png (the RGB data atlas)
'use strict';
const fs = require('fs'), path = require('path'), PNG = require('./png.js'), N = require('./noise.js');
const TAU = Math.PI * 2;

function mask(u, v, P) {
  const dx = u - P.cx, dy = v - P.cy, r = Math.hypot(dx, dy) + 1e-6;
  let th = Math.atan2(dy, dx); if (th < 0) th += TAU;
  const NR = 5 + Math.floor(N.h1(1, P.seed) * 5);                    // 5-9 rays
  const reach = P.s < 2 ? 0 : (0.18 + 0.35 * P.k);                    // the rays' reach (m) grows with the impact
  let line = 0, haze = 0, hole = 0;
  // RAYS: the angular cell and its neighbour; each ray wanders in angle with r (fbm), tapers, ends at its own length
  const cell = th / TAU * NR;
  for (let o = -1; o <= 1; o++) {
    const k = (Math.floor(cell) + o + NR) % NR;
    const base = (k + 0.5 + 0.7 * (N.h1(k, P.seed + 3) - 0.5)) / NR * TAU;
    const ang = base + 0.10 * N.fbm1(r * 9 + k * 7.1, P.seed + 5, 3) + 0.25 * N.fbm1(r * 2.3 + k, P.seed + 6, 2) * Math.min(1, r / 0.1);
    let d = th - ang; d -= TAU * Math.round(d / TAU);
    const len = reach * (0.45 + 0.55 * N.h1(k, P.seed + 9)), dist = Math.abs(d) * r;
    const w = 0.0009 * (1 - Math.min(1, r / Math.max(len, 1e-3))) + 0.00025;
    if (r < len) line = Math.max(line, 1 - smooth(w * 0.5, w, dist));
    if (r < len) haze = Math.max(haze, 0.55 * (1 - smooth(w, w * 6, dist)));   // the whitened flanks of a crack
  }
  // RINGS: 1-3 arcs at geometric radii, each present only between some pairs of rays (seeded), wobbling
  if (P.s >= 2) {
    const NG = 1 + Math.floor(N.h1(2, P.seed) * 3), k = Math.floor(cell);
    for (let j = 0; j < NG; j++) {
      const R = (0.03 + 0.02 * N.h1(j, P.seed + 13)) * Math.pow(2.0, j) * (0.6 + P.k);
      if (N.h2(k, j, P.seed + 17) > 0.55 || R > reach) continue;
      const Rw = R * (1 + 0.08 * N.fbm1(th * 5 + j, P.seed + 19, 2)), dist = Math.abs(r - Rw);
      line = Math.max(line, 1 - smooth(0.0003, 0.0008, dist));
      haze = Math.max(haze, 0.45 * (1 - smooth(0.001, 0.004, dist)));
    }
  }
  // CRAZING: a fine cellular network (Voronoi edges), everywhere at S1, round the impact core at S2+
  const cz = P.s === 1 ? 0.7 * smooth(0.45, 0.75, N.fbm2(u * 4, v * 4, P.seed + 2, 3) * 0.5 + 0.5) :   // patchy, as solvent / sun crazing is
            (P.s >= 2 ? 0.9 * (1 - smooth(0.02, 0.06 + 0.06 * P.k, r)) : 0);
  if (cz > 0) { const e = voronoiEdge(u * 60, v * 60, P.seed + 23); haze = Math.max(haze, cz * (1 - smooth(0.02, 0.07, e)) * 0.8); }
  // HOLES (S3): the shard cells (between two rays, inside a ring) nearest the impact drop out; the pane keeps a jagged rim
  if (P.s >= 3) {
    const k = Math.floor(cell), Rh = (0.04 + 0.10 * P.k) * (0.6 + 0.8 * N.h1(k, P.seed + 29));
    const jag = 0.012 * N.fbm1(th * 18, P.seed + 31, 3);
    if (r < Rh + jag && N.h1(k, P.seed + 37) < 0.75) hole = 1;
    if (r < 0.012) hole = 1;
  }
  return [line, haze, hole];
}
function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
// distance to the nearest Voronoi cell border (iq's exact border distance), 3x3 search
function voronoiEdge(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y); let md = 9, mx = 0, my = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const px = i + N.h2(ix + i, iy + j, seed), py = j + N.h2(ix + i, iy + j, seed + 1), ddx = px - (x - ix), ddy = py - (y - iy), d = ddx * ddx + ddy * ddy; if (d < md) { md = d; mx = ddx; my = ddy; } }
  let e = 9;
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const px = i + N.h2(ix + i, iy + j, seed), py = j + N.h2(ix + i, iy + j, seed + 1), ddx = px - (x - ix), ddy = py - (y - iy);
    const qx = ddx - mx, qy = ddy - my; if (qx * qx + qy * qy > 1e-5) e = Math.min(e, ((mx + ddx) / 2 * qx + (my + ddy) / 2 * qy) / Math.hypot(qx, qy)); }
  return e;
}

// ---- the preview: a 0.9 m x 0.6 m windscreen half, sky behind, the frame dark ----
function preview() {
  const states = [{ s: 1, k: 0, cx: 0.45, cy: 0.3, seed: 3, t: 'S1 crazing' }, { s: 2, k: 0.3, cx: 0.32, cy: 0.36, seed: 5, t: 'S2 star (light)' },
                  { s: 2, k: 0.8, cx: 0.5, cy: 0.28, seed: 8, t: 'S2 star (hard)' }, { s: 3, k: 0.7, cx: 0.42, cy: 0.33, seed: 12, t: 'S3 failed' }];
  const PX = 360, PY = 240, M = 0.9 / PX, IW = PX * 2 + 30, IH = PY * 2 + 30, img = new Uint8Array(IW * IH * 4);
  for (let i = 0; i < img.length; i += 4) { img[i] = 30; img[i + 1] = 32; img[i + 2] = 36; img[i + 3] = 255; }
  states.forEach((P, q) => { const ox = 10 + (q % 2) * (PX + 10), oy = 10 + Math.floor(q / 2) * (PY + 10);
    for (let y = 0; y < PY; y++) for (let x = 0; x < PX; x++) {
      const u = (x + 0.5) * M, v = 0.6 - (y + 0.5) * M, [L, Hz, Ho] = mask(u, v, P);
      // what is seen: the sky through the pane (slightly tinted), the crack line dark-and-bright (a crack both blocks and glints),
      // the haze a white scatter; a hole is the sky untinted with the jagged edge's glint
      const sky = [0.42 + 0.35 * (y / PY), 0.58 + 0.25 * (y / PY), 0.82];
      let c = Ho ? sky : sky.map((s, i) => s * 0.88 + [0.02, 0.03, 0.04][i]);
      if (!Ho) { c = c.map(s => s + (0.92 - s) * Hz * 0.75); c = c.map(s => s * (1 - 0.55 * L) + 0.25 * L * ((x + y) % 3 === 0 ? 1 : 0)); }
      const o = ((oy + y) * IW + ox + x) * 4; img[o] = c[0] * 255; img[o + 1] = c[1] * 255; img[o + 2] = c[2] * 255;
    } });
  fs.writeFileSync(path.join(__dirname, 'crack_states.png'), PNG.encode(IW, IH, img));
  console.log('wrote crack_states.png (top-left S1 crazing, top-right S2 light, bottom-left S2 hard, bottom-right S3 failed)');
}
// ---- the optional atlas: 2 x 2 variants of S2/S3 at 256 px over 0.5 m, impact centred; RGB = line, haze, hole ----
function atlas() {
  const C = 256, IW = 512, img = new Uint8Array(IW * IW * 4), M = 0.5 / C;
  [[2, 0.6, 41], [2, 0.9, 43], [3, 0.6, 47], [3, 0.9, 53]].forEach(([s, k, seed], q) => { const ox = (q % 2) * C, oy = Math.floor(q / 2) * C;
    for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) { const [L, Hz, Ho] = mask((x + 0.5) * M, (y + 0.5) * M, { s, k, seed, cx: 0.25, cy: 0.25 });
      const o = ((oy + y) * IW + ox + x) * 4; img[o] = L * 255; img[o + 1] = Hz * 255; img[o + 2] = Ho * 255; img[o + 3] = 255; } });
  const buf = PNG.encode(IW, IW, img); fs.writeFileSync(path.join(__dirname, 'crack_atlas.png'), buf);
  console.log('wrote crack_atlas.png', buf.length, 'bytes (PNG; as an RGB KTX2/ETC1S it would be smaller still)');
}
function perf() {   // the per-pixel cost proxy: evaluations per ms in node (the GPU does this per covered pixel only while cracked)
  const P = { s: 3, k: 0.7, cx: 0.4, cy: 0.3, seed: 1 }; let n = 0; const t0 = Date.now();
  while (Date.now() - t0 < 300) { for (let i = 0; i < 1000; i++) mask(Math.random() * 0.9, Math.random() * 0.6, P); n += 1000; }
  console.log(`mask(): ${(n / 300).toFixed(0)} evaluations / ms in node (one core) - ~3 noise rays + rings + a 3x3+5x5 Voronoi`);
}
preview(); atlas(); perf();
