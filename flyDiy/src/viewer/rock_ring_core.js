// ============================================================================
// rock_ring_core.js - ROCK-STUDY: THE ISLAND'S ROCK, AS GEOMETRY - the pure part (no THREE, no DOM: it runs in the
// ring's worker, in node for the checks, and on the main thread when there is no Worker).
//
// The bench's v1 (tools/rock_study, the user's validated look, 17 Nov) was three things: the trondhjemite material, the
// world-space MACRO (trond_gen.py macro(): regional joints, the formations between them, grooves, weathering, the rock's
// exposure) and a 1.25 m RELIEF MESH that lifts the exposed rock out of the 5 m DEM by the macro's height plus the
// user's Blender 'Cliff-Rock' masses. The game's first R1 drew only the material on the smooth DEM: a "white carpet".
// This file is the macro and the mesh, ported: trond_gen.macro() per point (its noises at the same cell sizes, its joint
// sets on a hashed irregular spacing so they extend over the whole island, its blurs on the chunk's own lattice), the
// bench's medium() (the Blender height path, node for node) and its buildSkirt (?tskirt) - rounded masses, two Laplacian
// passes, the vertex out along the DEM's normal by macro height + exposure x (lift + amp x masses).
//
//   ROCK_RING_CORE.chunk(inp) -> { pos (the ground's), disp (the relief, along the DEM normal), nor, idx, attr (8 a vertex:
//                                  aRM, aRX - the ground material's), nv, nt, B (the boulders: pos, nor, attr, idx, nv) | null, ms }
//     inp: { x0, z0, C (m), step (m, 1.25), M (margin m, >= 24: the 20 m curvature), hs (the inputs' lattice m), nh (its side),
//            H, R, V, F, Sc, Fo (Float32Array nh*nh: height, the map's rock share 0..1, NDVI -1..1, flow 0..1, scree and forest
//            shares), rung (the boulders' LOD: 0 full, 1, 2), eye [x, z], K (knobs) } ; kit (ROCK_RING_CORE.kitPrep's): the boulders
//     attr per vertex: mult r, g, b (the macro's colour multiplier), veg (the green's chance), crev (the masses' crevice x
//     exposure), id (the mass's tone 0..1), expo (the exposure, smoothed), sink (1 = a seam vertex under the ground)
//   ROCK_RING_CORE.macroAt(...) the macro at one point (the checks' and the bench's)
// ============================================================================
'use strict';
function ROCK_RING_CORE_FACTORY() {
  // ---- noise: the bench's murmur hash and value noise (2D and 3D) ---------------------------------------------------
  const hh = (x, y, z) => { let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul((y | 0) + 0x632be5ab, 0x165667b1) ^ Math.imul((z | 0) + 0x7f4a7c15, 0x9e3779b1)) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const sm = t => t * t * (3 - 2 * t);
  const vn2 = (x, y, s) => { const X = Math.floor(x), Y = Math.floor(y), u = sm(x - X), v = sm(y - Y);
    const a = hh(X, Y, s), b = hh(X + 1, Y, s), c = hh(X, Y + 1, s), d = hh(X + 1, Y + 1, s);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; };
  // trond_gen fbm_at(Xt, Zt, n, seed, oct): n cells over 2048 m, gain 0.5, lacunarity 2 -> cell = 2048 / n metres
  const fbm = (x, z, n, seed, oct) => { let s = 0, a = 1, w = 0, f = n / 2048;
    for (let o = 0; o < oct; o++) { s += a * vn2(x * f, z * f, seed * 31 + o); w += a; a *= 0.5; f *= 2; } return s / w; };
  const vn3 = (x, y, z) => { const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), a = sm(x - X), b = sm(y - Y), c = sm(z - Z); let r = 0;
    for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
      r += hh(X + dx, Y + dy, Z + dz) * (dx ? a : 1 - a) * (dy ? b : 1 - b) * (dz ? c : 1 - c);
    return r; };
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hash2 = (a, b, s) => hh(a | 0, b | 0, s | 0);

  // ---- the regional joints (trond_gen jset): warped parallel lines at an IRREGULAR spacing - here hashed per band (the
  // bench drew them from a seeded list over its 3 km; the island needs them anywhere) - open in segments along them
  // -> [distance to the nearest line, its index, the band (between lines) the point is in, open 0..1, width]
  function jset(x, z, theta, smin, smax, seed, warpA, shift) {
    const nx = Math.cos(theta * Math.PI / 180), nz = Math.sin(theta * Math.PI / 180);
    let c = x * -nz + z * nx + (fbm(x, z, 16, seed, 3) - 0.5) * 2 * warpA + (fbm(x, z, 64, seed + 1, 2) - 0.5) * 2 * warpA * 0.25 + (shift || 0);
    const t = x * nx + z * nz, S = (smin + smax) / 2, J = (smax - smin) / S * 0.5;
    const b = Math.floor(c / S);
    // the lines: one per band k at (k + jitter) x S, jitter in +-J/2
    let best = 1e9, li = 0, lo = -1e9, hi = 1e9;
    for (let k = b - 1; k <= b + 2; k++) { const p = (k + (hash2(k, 0, seed + 2) - 0.5) * J) * S, d = Math.abs(c - p);
      if (d < best) { best = d; li = k; } if (p <= c && p > lo) lo = p; if (p > c && p < hi) hi = p; }
    const band = Math.round(lo / S);   // (the gap a point is in: named by its lower line)
    const op = ss(0.45, 0.6, vn2(t / 160 + li * 13.1, 0.5 + li * 0.0, seed + 3));
    const wid = 0.8 + 1.7 * hash2(li, 1, seed);
    return [best, li, band, op, wid];
  }
  // ---- the macro at a point (trond_gen macro(), per point): the joints, the formations, the grooves, the knobs; the
  // colour multiplier; the green's chance; the EXPOSURE. Y the ground's height, slope (deg), r the map's rock share
  // (blurred 6 m), cz (the DEM's 20 m Laplacian over its std: convex +), flow (D8 accumulation, log2 of 5 m cells / 14),
  // ndvi, lap (the macro height's 4 m Laplacian: the hollows - 0 on a first pass), down (the fall line, [x, z]). K the knobs.
  function macroAt(x, z, Y, slope, r, cz, flow, ndvi, lap, down, K, out) {
    const S = 7;
    const A = jset(x, z, 150, 10, 30, S + 1, 22);
    const B = jset(x, z, 60, 12, 38, S + 11, 18, hash2(A[2], 5, S) * 150);
    const Cj = jset(x, z, 105, 3.5, 10, S + 21, 6, hash2(A[2] * 7 + B[2], 7, S) * 80);
    const D = jset(x, z, 15, 4.5, 12, S + 31, 6, hash2(B[2] * 5 + A[2], 8, S) * 80);
    const wA = A[4] * 0.65, wB = B[4] * 0.65;
    const oB = B[3] * (hash2(A[2] * 97 + B[1], 6, S) < 0.65 ? 1 : 0);
    const oC = Cj[3] * (hash2(A[2] * 31 + Cj[1], 9, S) < 0.7 ? 1 : 0), oD = D[3] * (hash2(B[2] * 17 + D[1], 10, S) < 0.6 ? 1 : 0);
    const wC = Cj[4] * 0.4, wD = D[4] * 0.35;
    const dm = Math.min(A[3] > 0.05 ? A[0] : 999, oB > 0.05 ? B[0] : 999), dm2 = Math.min(oC > 0.05 ? Cj[0] : 999, oD > 0.05 ? D[0] : 999);
    const fid = A[2] * 7919 + B[2] * 104729 + Cj[2] * 13 + D[2] * 1009;
    const lift = (hash2(fid, 11, S) - 0.42) * 3.2, edgeF = ss(0, 10, dm) * ss(0, 4, dm2);
    let hgt = 0.9 * Math.pow(ss(0, 14, dm), 0.7) + lift * edgeF;
    // (K.px, the macro TEXTURE's texel: a groove narrower than it widens to it and fades by the same ratio - its share of the texel
    // kept, as v1's 0.78 m texture's mips averaged it; without, a 2-4 m texel caught a 1 m line or missed it: no lines far away)
    const px = K.px || 0, gl = (o, d, w) => { const we = Math.max(w, px * 0.75); return o * (1 - ss(0.3, 1, d / we)) * (w / we); };
    const groove = Math.max(gl(A[3], A[0], wA) * (0.6 + 0.9 * hash2(A[1], 2, S)),
                            gl(oB, B[0], wB) * (0.5 + 0.8 * hash2(B[1], 3, S)),
                            gl(oC, Cj[0], wC) * (0.35 + 0.5 * hash2(Cj[1], 4, S)),
                            gl(oD, D[0], wD) * (0.3 + 0.45 * hash2(D[1], 5, S)));
    hgt -= groove;
    hgt += (fbm(x, z, 192, S + 30, 3) - 0.5) * 1.1 + (fbm(x, z, 768, S + 34, 2) - 0.5) * 0.35;
    const steep = ss(38, 55, slope);
    // the colour multiplier
    const zone = fbm(x, z, 12, S + 40, 4);
    let m = 0.55 + 0.40 * ss(0.3, 0.75, zone), mr = m, mg = m, mb = m;
    const film = ss(0.6, 0.8, fbm(x, z, 6, S + 41, 3)) * 0.7; mr += (mr * 1.06 - mr) * film; mb += (mb * 0.9 - mb) * film;
    const jf = Math.min(1, Math.max(0, groove / 0.5)), jk = jf * (K.jointDirt === undefined ? 0.85 : K.jointDirt);
    mr += (0.40 - mr) * jk; mg += (0.38 - mg) * jk; mb += (0.30 - mb) * jk;
    const hol = Math.min(1, Math.max(0, -lap * 1.2)) * 0.8; mr += (0.55 - mr) * hol; mg += (0.5 - mg) * hol; mb += (0.4 - mb) * hol;
    const edgeR = ss(0.15, 0.35, r) * (1 - ss(0.45, 0.8, r)) * 0.7; mr += (0.5 - mr) * edgeR; mg += (0.46 - mg) * edgeR; mb += (0.36 - mb) * edgeR;
    // wet streaks down the real fall line (the bench's line-integral smear, as a noise stretched along the fall line)
    { const ax = down[0], az = down[1], u = x * az - z * ax, v = x * ax + z * az;
      const lic = vn2(u / 2.2, v / 26, S + 42) * 0.7 + vn2(u / 6, v / 60, S + 43) * 0.3;
      const st = ss(0.55, 0.8, lic) * steep * (K.wet === undefined ? 0.75 : K.wet);
      mr += (0.38 - mr) * st; mg += (0.38 - mg) * st; mb += (0.34 - mb) * st; }
    // the green's chance
    const veg0 = Math.min(1, Math.max(0, jf + Math.min(1, Math.max(0, -lap * 0.8)) * 0.6 + (1 - ss(14, 30, slope)) * 0.55 + edgeR / 0.7 * 0.6))
               * (0.55 + 0.45 * ss(0.3, 0.7, fbm(x, z, 96, S + 50, 3)));
    // THE EXPOSURE: the bench's v1 law exactly - high, steep, convex, the map's rock; vegetation down the drainage - and the
    // imagery's green (NDVI) as an option the user can dial in (0 by default: v1 had none)
    const mos = fbm(x, z, 48, S + 70, 4), fine = fbm(x, z, 256, S + 71, 3), ufine = fbm(x, z, 640, S + 72, 2);
    const ndK = K.ndvi === undefined ? 0 : K.ndvi, ndM = K.ndviMid === undefined ? 0.74 : K.ndviMid;
    let Ef = 0.42 * ss(K.hLo || 250, K.hHi || 760, Y) + 0.22 * ss(22, 48, slope) + 0.20 * Math.min(1, Math.max(-1, cz * 0.45)) - 0.35 * ss(0.45, 0.8, flow)
           + 0.30 * r - (K.off === undefined ? 0.08 : K.off)
           - ndK * ss(ndM - 0.2, ndM + 0.2, ndvi) + (mos - 0.5) * 0.5 + (fine - 0.5) * 0.5 + (ufine - 0.5) * 0.35;
    let expo = ss(0.42, 0.50, Ef) * (1 - jf * 0.7);
    out[7] = ss(0.42, 0.50, Ef);   // (the GEOMETRY's mask: no joint, no speckle - those are a groove and green on the outcrop, not a hole into the ground)
    const sp1 = fbm(x, z, 420, S + 73, 3), sp2 = fbm(x, z, 1000, S + 74, 2);
    expo *= 1 - Math.min(1, ss(0.56, 0.63, sp1) + ss(0.6, 0.66, sp2) * 0.8) * (0.55 + 0.45 * ss(0.3, 0.7, fine));
    const veg = Math.min(1, Math.max(veg0, 1 - expo));
    out[0] = hgt; out[1] = mr; out[2] = mg; out[3] = mb; out[4] = veg; out[5] = expo; out[6] = jf;
    return out;
  }
  // ---- the medium relief: the user's Blender 'Cliff-Rock' height path (the bench's medium(), node for node) ----------
  const vor3 = (x, y, z, sc, seed) => {
    x *= sc; y *= sc; z *= sc; const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    let f1 = 1e9, f2 = 1e9, e1 = 1e9, e2 = 1e9, id = 0;
    for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = X + i, cy = Y + j, cz = Z + k;
      const px = cx + hh(cx, cy, cz + seed), py = cy + hh(cx + 31, cy, cz + seed), pz = cz + hh(cx, cy + 57, cz + seed);
      const dx = px - x, dy = py - y, dz = pz - z, dm = Math.abs(dx) + Math.abs(dy) + Math.abs(dz), de = Math.hypot(dx, dy, dz);
      if (dm < f1) { f2 = f1; f1 = dm; id = hh(cx, cy + 7, cz + seed); } else if (dm < f2) f2 = dm;
      if (de < e1) { e2 = e1; e1 = de; } else if (de < e2) e2 = de;
    }
    return [f1, f2, (e2 - e1) * 0.5, id];
  };
  const fbm3 = (x, y, z, oct) => { let s = 0, a = 1, f = 1; for (let o = 0; o < oct; o++) { s += a * (vn3(x * f, y * f, z * f + o * 17) * 2 - 1); a *= 0.536; f *= 2; } return s; };
  function medium(x, y, z, unit, out) {
    const u = 1 / unit, qx = x * u, qy = y * u, qz = z * u;
    const m = fbm3(qx * 3.2, qy * 3.2, qz * 3.2, 6);
    const wx = qx + m / 10, wy = qy + m / 10, wz = qz + m / 10;
    const A = vor3(wx, wy, wz, 2.0, 11), Bv = vor3(wx, wy, wz, 2.5, 23), Cv = vor3(qx, qy, qz, 1.2, 37);
    const r1 = (1 - A[1]) / 5, r2 = (1 - A[2] * 2) / 4;
    const b = Math.pow(Math.max(r1 + r2, 0), 2) + 0.5;
    const e = (Math.pow(Math.pow(Bv[1], 0.025) + Math.pow(Cv[1], 0.2), 2) - 2) / 3.75;
    const t = Math.max(b, e) - 0.5 * Math.log(Math.max(A[1], 1e-3)) / Math.log(0.05) - m / 40;
    out[0] = Math.pow(Math.max(t, 0), 1.2); out[1] = 1 - ss(0, 0.12, A[2]); out[2] = A[3];
    return out;
  }
  // its normalisation (mean, sd): measured once on random points (the bench measured it on its patch - a constant of the law)
  let MEDN = null;
  const medNorm = unit => { if (MEDN) return MEDN; const o = [0, 0, 0]; let s1 = 0, s2 = 0;
    for (let k = 0; k < 3000; k++) { const x = (hh(k, 1, 2) - 0.5) * 4000, z = (hh(k, 3, 4) - 0.5) * 4000, y = hh(k, 5, 6) * 900, h = medium(x, y, z, unit, o)[0]; s1 += h; s2 += h * h; }
    const mu = s1 / 3000; return (MEDN = [mu, Math.sqrt(Math.max(1e-6, s2 / 3000 - mu * mu))]); };

  // ---- a box blur on a lattice (n x n), radius r cells, two passes ---------------------------------------------------
  // ---- THE ROCK GATE: the map's rock share DILATED ~30 m (a max filter, two passes, on the input lattice). The exposure law
  // needs no rock (height, slope, convexity raise it anywhere); a chunk is only BUILT where the map has rock in its input window
  // (chunk +- 37.5 m), so the geometry's exposure x this gate keeps every edge next to an unbuilt chunk SUNK - without it a built
  // chunk lifted its edge where the neighbour had no skin: an open edge standing in the air (the user's ground-level 'sheet',
  // 16 Nov) - and the macro texture takes the same gate, so the colour and the geometry agree
  function rockDil(R, nh, hs) {
    const r = Math.max(1, Math.round(30 / hs)), t = new Float32Array(nh * nh), o = new Float32Array(nh * nh);
    for (let j = 0; j < nh; j++) for (let i = 0; i < nh; i++) { let m = 0; for (let k = -r; k <= r; k++) { const q = R[j * nh + Math.min(nh - 1, Math.max(0, i + k))]; if (q > m) m = q; } t[j * nh + i] = m; }
    for (let j = 0; j < nh; j++) for (let i = 0; i < nh; i++) { let m = 0; for (let k = -r; k <= r; k++) { const q = t[Math.min(nh - 1, Math.max(0, j + k)) * nh + i]; if (q > m) m = q; } o[j * nh + i] = m; }
    return o; }
  const gateOf = rd => Math.min(1, Math.max(0, rd * 10));   // (0 with no rock within ~30 m, full by a tenth of a cell's share)
  function blur(src, n, r) {
    if (r < 1) return src.slice();
    const t = new Float32Array(n * n), o = new Float32Array(n * n), w = 2 * r + 1;
    for (let pass = 0; pass < 2; pass++) { const a = pass ? o.slice() : src;
      for (let y = 0; y < n; y++) { let acc = 0; const row = y * n; for (let k = -r; k <= r; k++) acc += a[row + Math.min(n - 1, Math.max(0, k))];
        for (let x = 0; x < n; x++) { t[row + x] = acc / w; acc += a[row + Math.min(n - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; } }
      for (let x = 0; x < n; x++) { let acc = 0; for (let k = -r; k <= r; k++) acc += t[Math.min(n - 1, Math.max(0, k)) * n + x];
        for (let y = 0; y < n; y++) { o[y * n + x] = acc / w; acc += t[Math.min(n - 1, y + r + 1) * n + x] - t[Math.max(0, y - r) * n + x]; } } }
    return o;
  }

  // ---- THE KIT: each subject's rungs (0 its own, 1 and 2 by VERTEX CLUSTERING - its box cut into 7^3 / 4^3 cells, a cell's
  // vertices merged to their mean, the collapsed triangles dropped: the bench v1's ladder) and the blockiest four (the big class)
  //   kitPrep([{ h, bb, pos, nor, idx }]) -> { subs: [{ h, bb, rungs: [{ pos, nor, idx, nv }] x3 }], blocky }
  function decimate(P, I, n) {
    let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9;
    for (let v = 0; v < P.length; v += 3) { mnx = Math.min(mnx, P[v]); mxx = Math.max(mxx, P[v]); mny = Math.min(mny, P[v + 1]); mxy = Math.max(mxy, P[v + 1]); mnz = Math.min(mnz, P[v + 2]); mxz = Math.max(mxz, P[v + 2]); }
    const sx = (mxx - mnx) / n || 1, sy = (mxy - mny) / n || 1, sz = (mxz - mnz) / n || 1, cell = new Map(), acc = [], remap = new Int32Array(P.length / 3);
    for (let v = 0; v < P.length / 3; v++) {
      const k = Math.min(n - 1, Math.floor((P[v * 3] - mnx) / sx)) * 65536 + Math.min(n - 1, Math.floor((P[v * 3 + 1] - mny) / sy)) * 256 + Math.min(n - 1, Math.floor((P[v * 3 + 2] - mnz) / sz));
      let c = cell.get(k); if (c === undefined) { c = acc.length / 4; cell.set(k, c); acc.push(0, 0, 0, 0); }
      acc[c * 4] += P[v * 3]; acc[c * 4 + 1] += P[v * 3 + 1]; acc[c * 4 + 2] += P[v * 3 + 2]; acc[c * 4 + 3]++; remap[v] = c; }
    const pos = new Float32Array(acc.length / 4 * 3); for (let c = 0; c < acc.length / 4; c++) for (let q = 0; q < 3; q++) pos[c * 3 + q] = acc[c * 4 + q] / acc[c * 4 + 3];
    const idx = []; for (let t = 0; t < I.length; t += 3) { const a = remap[I[t]], b = remap[I[t + 1]], c = remap[I[t + 2]]; if (a !== b && b !== c && a !== c) idx.push(a, b, c); }
    return { pos, idx: Uint32Array.from(idx), nor: vnormals(pos, idx), nv: pos.length / 3 };
  }
  function vnormals(pos, idx) {
    const nor = new Float32Array(pos.length);
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const q of [a, b, c]) { nor[q] += nx; nor[q + 1] += ny; nor[q + 2] += nz; } }
    for (let v = 0; v < nor.length; v += 3) { const l = Math.hypot(nor[v], nor[v + 1], nor[v + 2]) || 1; nor[v] /= l; nor[v + 1] /= l; nor[v + 2] /= l; }
    return nor;
  }
  // ---- THE PROCEDURAL KIT (the study's rock_kit.js, the user: "boulders need closed geometry"): a rock is a CLOSED shape from
  // a sphere of directions - r(dir) the soft minimum of an ellipsoid and K planes (the faces rock breaks along), roughened by a
  // low noise - evaluated on icospheres of three densities (1280 / 320 / 80 triangles): the LOD rungs are one rock, all closed.
  // Archetypes: boulder (rounded, 10-13 planes), block (near-axis planes: jointed), slab (flat plates). Each vertex: its crease
  // (how deep it sits under the ellipsoid: the cheap AO) and its height in the rock's box (the foot)
  //   procKit(seeds) -> [{ h, bb, arch, rungs: [{ pos, nor, idx, nv, crease, foot }] x3 }]
  function procKit(seeds) {
    const rnd = sd => () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
    const ico = n => { const t = (1 + Math.sqrt(5)) / 2;
      let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; });
      let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
      for (let k = 0; k < n; k++) { const mid = new Map(), F2 = [];
        const m = (a, b) => { const key = a < b ? a * 100000 + b : b * 100000 + a; let i = mid.get(key); if (i !== undefined) return i;
          const v = [V[a][0] + V[b][0], V[a][1] + V[b][1], V[a][2] + V[b][2]], l = Math.hypot(v[0], v[1], v[2]); V.push([v[0] / l, v[1] / l, v[2] / l]); i = V.length - 1; mid.set(key, i); return i; };
        for (const [a, b, c] of F) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
        F = F2; }
      return { V, F }; };
    const SPH = [ico(3), ico(2), ico(1)];
    const vn = (x, y, z, sd) => { const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), a = sm(x - X), b = sm(y - Y), c = sm(z - Z); let r = 0;
      for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) r += hh(X + dx, Y + dy, Z + dz + sd * 101) * (dx ? a : 1 - a) * (dy ? b : 1 - b) * (dz ? c : 1 - c);
      return r - 0.5; };
    const shapeOf = (arch, seed) => {
      const R = rnd(seed * 7919 + 17), P = [];
      const plane = (nx, ny, nz, o) => { const l = Math.hypot(nx, ny, nz); P.push([nx / l, ny / l, nz / l, o]); };
      const rdir = () => { const z = R() * 2 - 1, a = R() * 6.2832, q = Math.sqrt(1 - z * z); return [q * Math.cos(a), z, q * Math.sin(a)]; };
      let E, K, rough, base = -0.42;
      if (arch === 'boulder') { E = [1.1, 0.85 + 0.15 * R(), 0.95 + 0.1 * R()]; K = 30; rough = 0.045;
        const n = 10 + Math.floor(R() * 4); for (let i = 0; i < n; i++) { const d = rdir(); plane(d[0], d[1] * 0.8, d[2], 0.55 + 0.3 * R()); } }
      else if (arch === 'block') { E = [1.3, 1.1, 1.2]; K = 45; rough = 0.03;
        const yaw = R() * 0.5, c = Math.cos(yaw), sn = Math.sin(yaw);
        for (const [x, y, z] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) { const j = () => (R() - 0.5) * 0.5; plane(x * c - z * sn + j(), y + j(), x * sn + z * c + j(), 0.5 + 0.25 * R()); }
        for (let i = 0; i < 6; i++) { const d = rdir(); plane(d[0], d[1], d[2], 0.6 + 0.25 * R()); } }
      else { E = [1.1, 0.42, 0.9]; K = 22; rough = 0.03; base = -0.2;
        plane((R() - 0.5) * 0.3, 1, (R() - 0.5) * 0.3, 0.22 + 0.06 * R());
        for (let i = 0; i < 6; i++) { const a = R() * 6.2832; plane(Math.cos(a), (R() - 0.5) * 0.6, Math.sin(a), 0.6 + 0.25 * R()); } }
      plane(0, -1, 0, -base);
      return { E, K, rough, P }; };
    const radius = (S, d, seed) => {
      const re = 1 / Math.sqrt((d[0] / S.E[0]) ** 2 + (d[1] / S.E[1]) ** 2 + (d[2] / S.E[2]) ** 2);
      let sum = Math.exp(-S.K * re), mn = re;
      for (const p of S.P) { const c = d[0] * p[0] + d[1] * p[1] + d[2] * p[2]; if (c > 1e-3) { const t = p[3] / c; sum += Math.exp(-S.K * t); if (t < mn) mn = t; } }
      let r = -Math.log(sum) / S.K; if (!isFinite(r)) r = mn;
      const q = 2.3; r *= 1 + S.rough * (vn(d[0] * q + 9, d[1] * q, d[2] * q, seed) * 2 + vn(d[0] * q * 3, d[1] * q * 3, d[2] * q * 3 + 5, seed) * 0.8);
      return [r, Math.max(0, Math.min(1, (re - r) / re))]; };
    const out = [];
    for (const arch of ['boulder', 'block', 'slab']) for (let sd = 1; sd <= (seeds || 4); sd++) {
      const S = shapeOf(arch, sd), rungs = [];
      for (let L = 0; L < 3; L++) { const sph = SPH[L], nv = sph.V.length, pos = new Float32Array(nv * 3), crease = new Float32Array(nv), foot = new Float32Array(nv);
        let y0 = 1e9, y1 = -1e9;
        sph.V.forEach((d, i) => { const [r, cr] = radius(S, d, sd); pos[i * 3] = d[0] * r; pos[i * 3 + 1] = d[1] * r; pos[i * 3 + 2] = d[2] * r; crease[i] = cr; y0 = Math.min(y0, pos[i * 3 + 1]); y1 = Math.max(y1, pos[i * 3 + 1]); });
        for (let i = 0; i < nv; i++) { pos[i * 3 + 1] -= y0; foot[i] = pos[i * 3 + 1] / Math.max(1e-6, y1 - y0); }
        const idx = new Uint32Array(sph.F.length * 3); sph.F.forEach((f, i) => { idx[i * 3] = f[0]; idx[i * 3 + 1] = f[1]; idx[i * 3 + 2] = f[2]; });
        rungs.push({ pos, idx, nor: vnormals(pos, idx), nv, crease, foot }); }
      const P0 = rungs[0].pos; let mnx = 1e9, mxx = -1e9, mxy = -1e9, mnz = 1e9, mxz = -1e9;
      for (let v = 0; v < P0.length; v += 3) { mnx = Math.min(mnx, P0[v]); mxx = Math.max(mxx, P0[v]); mxy = Math.max(mxy, P0[v + 1]); mnz = Math.min(mnz, P0[v + 2]); mxz = Math.max(mxz, P0[v + 2]); }
      out.push({ arch, h: mxy, bb: [mnx, 0, mnz, mxx, mxy, mxz], rungs });
    }
    return out;
  }
  function kitPrep(list) {
    // (list null or 'proc': the procedural kit - CLOSED rocks; a scanned kit (open shells: the tree pack's paving blocks) only if asked)
    const subs = (!list || list === 'proc') ? procKit(4) : list.map(s => ({ h: s.h, bb: s.bb, rungs: [{ pos: s.pos, nor: s.nor, idx: s.idx, nv: s.pos.length / 3 }, decimate(s.pos, s.idx, 7), decimate(s.pos, s.idx, 4)] }));
    const blocky = subs.some(S => S.arch) ? subs.map((S, i) => [i, S.arch]).filter(a => a[1] === 'block' || a[1] === 'boulder').map(a => a[0])
      : subs.map((S, i) => [i, S.h / Math.max(S.bb[3] - S.bb[0], S.bb[5] - S.bb[2])]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(a => a[0]);
    // the scatter draws the BOULDERS and the BLOCKS (the user: "proper boulders" - the slab archetype is a plate)
    const pick = subs.some(S => S.arch) ? subs.map((S, i) => [i, S.arch]).filter(a => a[1] !== 'slab').map(a => a[0]) : subs.map((S, i) => i);
    // THE FOOTPRINT (16 Nov, the user: "very little of them in game"): v1 scattered the tree pack's scanned paving blocks, whose
    // width runs 1.4-3.6 x their height (capped at 2.6 by the law's kxz); the closed kit's rocks are ~1.4 x. Same count, same
    // heights, a third of the ground covered. So a closed rock takes the WIDTH of the scan v1 would have drawn (the same hash):
    // the 13 scans' width / height, and the big class's four blockiest.
    const proc = subs.some(S => S.arch);
    const bwOf = S => Math.max(S.bb[3] - S.bb[0], S.bb[5] - S.bb[2]) / Math.max(S.h, 0.02);
    return { subs, blocky, pick, bwV1: proc ? [1.70, 2.25, 2.29, 2.37, 2.99, 3.43, 2.78, 2.98, 1.42, 3.57, 1.68, 3.39, 2.02] : null,
      bwV1Big: proc ? [1.42, 1.68, 1.70, 2.02] : null, bwOf };
  }
  // the width over height a rock is drawn at (v1's scan for a closed kit; its own for a scanned one) and the stretch it needs
  function footOf(kit, S, big, r1) {
    const own = kit.bwOf(S), L = kit.bwV1 ? (big ? kit.bwV1Big : kit.bwV1) : null;
    const bw = L ? L[Math.floor(((r1 * 7.31) % 1) * L.length) % L.length] : own;   // (its own draw of the hash: not tied to the shape's)
    return { bw, wf: bw / own };
  }
  // the 20 m curvature's std on Mount Ardent (tools/rock_study export_patch: 1.45 m) - the law's z-score, a constant of the island
  const CZSD = 1.45;
  // ---- the drainage: D8 accumulation on a grid (the hydrology's 1024^2 heights in the game: ~38 m), as the bench's flow -
  // log2 of the catchment in 5 m cells, over 14 (cellArea5: a grid cell's area in 5 m cells)
  function flowGrid(Hg, N, cellArea5) {
    const n = N * N, ord = new Uint32Array(n); for (let k = 0; k < n; k++) ord[k] = k;
    ord.sort((a, b) => Hg[b] - Hg[a]);
    const acc = new Float32Array(n).fill(1);
    for (let q = 0; q < n; q++) { const k = ord[q], i = k % N, j = (k / N) | 0; let best = -1, bd = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { if (!a && !b) continue; const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
        const d = (Hg[k] - Hg[jj * N + ii]) / Math.hypot(a, b); if (d > bd) { bd = d; best = jj * N + ii; } }
      if (best >= 0) acc[best] += acc[k]; }
    const out = new Uint8Array(n), l5 = Math.log2(cellArea5);
    for (let k = 0; k < n; k++) out[k] = Math.min(255, Math.max(0, Math.round((Math.log2(acc[k]) + l5) * 255 / 14)));
    return out;
  }
  // ---- one chunk -------------------------------------------------------------------------------------------------------
  function farChunk(inp, kit, W) {
    const { x0, z0, C, M } = inp, { n, st, X, Z, Y, slope, dn, cz, ex, mac, bil, t0 } = W, eye = inp.eye || [x0 + C / 2, z0 + C / 2], reach = inp.reach || 450;
    const lat = (A, x, z) => { const fx = Math.min(n - 1.001, Math.max(0, (x - (x0 - M)) / st)), fz = Math.min(n - 1.001, Math.max(0, (z - (z0 - M)) / st)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * n + i;
      return (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + n] * (1 - u) + A[k + n + 1] * u) * v; };
    const e5 = new Float32Array(n * n); for (let k = 0; k < n * n; k++) e5[k] = mac[k * 7 + 5];
    const RB = { pos: [], nor: [], attr: [], idx: [] }; let base = 0;
    const mul = (inp.K && inp.K.scatter !== undefined) ? inp.K.scatter : 1.25;
    if (kit && kit.subs && kit.subs.length) for (let gz = z0; gz < z0 + C; gz += 6) for (let gx = x0; gx < x0 + C; gx += 6) {
      const jx = gx + 3 + (hh(Math.round(gx * 3), Math.round(gz * 3), 1) - 0.5) * 6, jz = gz + 3 + (hh(Math.round(gx * 3), Math.round(gz * 3), 2) - 0.5) * 6;
      const dP = Math.hypot(jx - eye[0], jz - eye[1]); if (dP <= reach || dP > (inp.farReach || 2000)) continue;
      const sl = lat(slope, jx, jz); if (sl > 50) continue;
      const cR = lat(e5, jx, jz), cS = inp.Sc ? bil(inp.Sc, jx, jz) : 0, cF = inp.Fo ? bil(inp.Fo, jx, jz) : 0, cv = lat(cz, jx, jz) * CZSD;
      const fi = Math.min(n - 1, Math.max(0, Math.round((jx - (x0 - M)) / st))), fj = Math.min(n - 1, Math.max(0, Math.round((jz - (z0 - M)) / st))), kk = fj * n + fi;
      const upx = -dn[kk * 2], upz = -dn[kk * 2 + 1];
      let face = 0; for (let s2 = 5; s2 <= 35; s2 += 5) if (lat(slope, jx + upx * s2, jz + upz * s2) > 45) { face = 1 - s2 / 45; break; }
      const talus = face * (sl < 42 ? 1 : 0) * (cv < 0.3 ? 1 : 0.4) * (1 - cF * 0.8);
      const clus = ss(0.40, 0.70, vn3(jx / 40, 0, jz / 40));
      const rocky = Math.max(cR, cS) * ss(18, 26, sl) * (1 - ss(44, 50, sl)) * clus * (1 - cF);
      const edge = (cR > 0.12 && cR < 0.88 ? 1 : 0) * (1 - ss(40, 50, sl)) * (1 - cF) * (0.4 + 0.6 * clus);
      const p = (talus * 0.33 + rocky * 0.055 + edge * 0.13) * mul;
      const bigOK = clus > 0.55 && hh(Math.round(jx * 5), Math.round(jz * 5), 9) < 0.07;
      if (!bigOK || hh(Math.round(jx * 7), Math.round(jz * 7), 3) >= p * 9) continue;
      const r1 = hh(Math.round(jx * 13), Math.round(jz * 13), 5), r2 = hh(Math.round(jx * 13), Math.round(jz * 13), 6), r3 = hh(Math.round(jx * 13), Math.round(jz * 13), 7);
      const hT = 2.5 + 2.5 * r2, S = kit.subs[kit.blocky[Math.floor(r1 * kit.blocky.length) % kit.blocky.length]];
      const { bw, wf } = footOf(kit, S, true, r1), rr2 = 0.4 * bw * hT;
      const c = lat(Y, jx, jz), gxp = (lat(Y, jx + rr2, jz) - lat(Y, jx - rr2, jz)) / (2 * rr2), gzp = (lat(Y, jx, jz + rr2) - lat(Y, jx, jz - rr2)) / (2 * rr2), G = Math.hypot(gxp, gzp);
      const kS = hT / Math.max(S.h, 0.02), kxz = Math.min(1, 2.6 / bw), bury = 0.3 + 0.15 * r3, yB = c - 0.2 * G * rr2 - hT * bury;
      let nxl = -gxp, nyl = 1, nzl = -gzp; const nl = Math.hypot(nxl, nyl, nzl); nxl /= nl; nyl /= nl; nzl /= nl;
      nxl *= 0.8; nyl = nyl * 0.8 + 0.2; nzl *= 0.8; const nl2 = Math.hypot(nxl, nyl, nzl); nxl /= nl2; nyl /= nl2; nzl /= nl2;
      const yaw = r1 * 6.2832 * 7, cy = Math.cos(yaw), sy = Math.sin(yaw), ax = nzl, az = -nxl, al = Math.hypot(ax, az), ct = nyl, st2 = Math.sqrt(Math.max(0, 1 - ct * ct));
      const kx = al > 1e-6 ? ax / al : 1, kz = al > 1e-6 ? az / al : 0;
      const rot = (vx, vy, vz) => { const x1 = vx * cy + vz * sy, z1 = -vx * sy + vz * cy, y1 = vy, dot = kx * x1 + kz * z1, crx = -kz * y1, cry = kz * x1 - kx * z1, crz = kx * y1;
        return [x1 * ct + crx * st2 + kx * dot * (1 - ct), y1 * ct + cry * st2, z1 * ct + crz * st2 + kz * dot * (1 - ct)]; };
      const sx = kS * kxz * wf * (0.8 + 0.4 * r3), sy2 = kS, sz = kS * kxz * wf * (0.8 + 0.4 * r2);
      const L = S.rungs[dP < 600 ? 1 : 2], vk = 0.85 + 0.3 * r3;   // (v1's ladder: 7^3 to 600 m, then 4^3)
      for (let v = 0; v < L.nv; v++) { const p0 = rot(L.pos[v * 3] * sx, L.pos[v * 3 + 1] * sy2, L.pos[v * 3 + 2] * sz); RB.pos.push(jx + p0[0], yB + p0[1], jz + p0[2]);
        const n0 = rot(L.nor[v * 3] / sx, L.nor[v * 3 + 1] / sy2, L.nor[v * 3 + 2] / sz), q2 = Math.hypot(n0[0], n0[1], n0[2]) || 1; RB.nor.push(n0[0] / q2, n0[1] / q2, n0[2] / q2);
        RB.attr.push(vk, vk, vk * 0.97, L.foot ? L.foot[v] : 0.5, L.crease ? L.crease[v] : 0, r3, 2, 0); }
      for (let t = 0; t < L.idx.length; t++) RB.idx.push(base + L.idx[t]); base += L.nv;
    }
    const B = RB.idx.length ? { pos: Float32Array.from(RB.pos), nor: Float32Array.from(RB.nor), attr: Float32Array.from(RB.attr), idx: Uint32Array.from(RB.idx), nv: RB.pos.length / 3 } : null;
    return { pos: new Float32Array(0), disp: new Float32Array(0), nor: new Float32Array(0), idx: new Uint32Array(0), attr: new Float32Array(0), nv: 0, nt: 0, B, boulders: B ? B.idx.length / 3 : 0, ms: Date.now() - t0, n };
  }
  // ---- THE MACRO TEXTURE (the bench v1's trond_gen macro: its 2560^2 texture at 0.78 m over the patch - macro_mult (the colour
  // multiplier / 1.5), macro_rock (the exposure), macro_nh (the height's normal x z, the green's chance, the height)): the
  // ground read it a PIXEL at a time, so the far rock stayed a fine mosaic broken by the joints' lines, its mips averaging it.
  // The game's first port carried it per relief VERTEX only (1.25 m, to 450 m) and fell back beyond to a procedural stand-in
  // faded to the tile's mean: the user's "patchy, pixely" far ground with no big lines (16 Nov). Here one tile of it, T x T
  // texels at st m (the texel's centre), from the same inputs as a chunk:
  //   macroTile({ x0, z0, C, st, M, hs, nh, H, R, V, F, K }) -> { A: Uint8Array T*T*4 (mult r g b / 1.5, expo), B: (nx, nz as
  //   0..1, veg, height (h + 2.04) / 5.27 - v1's range), T, ms }
  // Where the map has no rock within ~30 m the exposure is 0 (the relief's own rule: a chunk with no rock share builds none).
  function macroTile(inp) {
    const t0 = Date.now(), K = Object.assign({}, inp.K || {}, { px: inp.st });
    const { x0, z0, C, M, hs, nh, H, R, V, F } = inp, st = inp.st;
    const bil = (A, x, z) => { const fx = Math.min(nh - 1.001, Math.max(0, (x - (x0 - M)) / hs)), fz = Math.min(nh - 1.001, Math.max(0, (z - (z0 - M)) / hs));
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * nh + i;
      return (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + nh] * (1 - u) + A[k + nh + 1] * u) * v; };
    const Rd = rockDil(R, nh, hs);   // (the rock gate: the geometry's own)
    const T = Math.round(C / st), mg = Math.max(3, Math.ceil(9 / st)), n = T + 2 * mg, X = i => x0 + (i - mg + 0.5) * st, Z = j => z0 + (j - mg + 0.5) * st;   // (the work margin: the blurs' 4 m; the 20 m curvature reads the INPUT lattice, M >= 24)
    const Y = new Float32Array(n * n), Rr = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i; Y[k] = bil(H, X(i), Z(j)); Rr[k] = bil(R, X(i), Z(j)); }
    const Ys = blur(Y, n, Math.max(1, Math.round(4 / st))), Rb = blur(Rr, n, Math.max(1, Math.round(3 / st)));
    const tmp = new Float32Array(8), slope = new Float32Array(n * n), dn = new Float32Array(n * n * 2), cz = new Float32Array(n * n), fl = new Float32Array(n * n), nd = new Float32Array(n * n);
    const hgt = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i;
      const gx = (Ys[j * n + Math.min(n - 1, i + 1)] - Ys[j * n + Math.max(0, i - 1)]) / ((Math.min(n - 1, i + 1) - Math.max(0, i - 1)) * st);
      const gz = (Ys[Math.min(n - 1, j + 1) * n + i] - Ys[Math.max(0, j - 1) * n + i]) / ((Math.min(n - 1, j + 1) - Math.max(0, j - 1)) * st);
      const gl = Math.max(Math.hypot(gx, gz), 1e-4); slope[k] = Math.atan(Math.hypot(gx, gz)) * 57.2958; dn[k * 2] = -gx / gl; dn[k * 2 + 1] = -gz / gl;
      cz[k] = (bil(H, X(i), Z(j)) - 0.25 * (bil(H, X(i) - 20, Z(j)) + bil(H, X(i) + 20, Z(j)) + bil(H, X(i), Z(j) - 20) + bil(H, X(i), Z(j) + 20))) / CZSD;
      fl[k] = bil(F, X(i), Z(j)); nd[k] = bil(V, X(i), Z(j));
      macroAt(X(i), Z(j), Y[k], slope[k], Rb[k], cz[k], fl[k], nd[k], 0, [dn[k * 2], dn[k * 2 + 1]], K, tmp); hgt[k] = tmp[0]; }
    // pass 2: the hollows from the height's ~4 m Laplacian (the chunk's), the colour, the green, the exposure; out on the tile
    const hb = blur(hgt, n, Math.max(1, Math.round(2 / st)));
    const A = new Uint8Array(T * T * 4), B = new Uint8Array(T * T * 4), b8 = v => Math.max(0, Math.min(255, Math.round(v * 255)));
    for (let b = 0; b < T; b++) for (let a = 0; a < T; a++) { const i = a + mg, j = b + mg, k = j * n + i, o = (b * T + a) * 4;
      macroAt(X(i), Z(j), Y[k], slope[k], Rb[k], cz[k], fl[k], nd[k], hgt[k] - hb[k], [dn[k * 2], dn[k * 2 + 1]], K, tmp);
      const g = gateOf(bil(Rd, X(i), Z(j))), ex = tmp[5] * g, veg = Math.max(tmp[4], 1 - ex);
      A[o] = b8(tmp[1] / 1.5); A[o + 1] = b8(tmp[2] / 1.5); A[o + 2] = b8(tmp[3] / 1.5); A[o + 3] = b8(ex);
      // the height's normal (v1: central differences over the texel)
      const hx = (hgt[j * n + i + 1] - hgt[j * n + i - 1]) / (2 * st), hz = (hgt[(j + 1) * n + i] - hgt[(j - 1) * n + i]) / (2 * st), l = Math.hypot(hx, 1, hz);
      B[o] = b8(-hx / l * 0.5 + 0.5); B[o + 1] = b8(-hz / l * 0.5 + 0.5); B[o + 2] = b8(veg); B[o + 3] = b8((hgt[k] + 2.04) / 5.27); }
    return { A, B, T, ms: Date.now() - t0 };
  }
  function chunk(inp, kit) {
    if (Math.abs(inp.C / (inp.step || 1.25) - Math.round(inp.C / (inp.step || 1.25))) > 1e-6 || Math.abs(inp.M / inp.hs - Math.round(inp.M / inp.hs)) > 1e-6 || Math.abs(inp.C / inp.hs - Math.round(inp.C / inp.hs)) > 1e-6)
      throw new Error('rock ring: chunk ' + inp.C + ' / margin ' + inp.M + ' must be whole multiples of the step and the input lattice (a crack between chunks)');
    const t0 = Date.now(), K = inp.K || {};
    const { x0, z0, C, M, hs, nh, H, R, V, F } = inp, st = inp.step || 1.25;
    // the inputs (hs lattice from x0 - M) bilinear
    const bil = (A, x, z) => { const fx = Math.min(nh - 1.001, Math.max(0, (x - (x0 - M)) / hs)), fz = Math.min(nh - 1.001, Math.max(0, (z - (z0 - M)) / hs));
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * nh + i;
      return (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + nh] * (1 - u) + A[k + nh + 1] * u) * v; };
    // the work lattice: the chunk + its margin at st
    const n = Math.round((C + 2 * M) / st) + 1, X = i => x0 - M + i * st, Z = j => z0 - M + j * st;
    const Y = new Float32Array(n * n), Rr = new Float32Array(n * n);
    // THE BASE IS THE DRAWN GROUND (16 Nov, the user's ground-level 'sheet'): the game's fine tiles (render_world FINE: within
    // 700 m, so under the whole ring) draw terrainH at a 5 m grid aligned to 5 m, each cell cut by the diagonal (i, j+1)-(i+1, j);
    // the relief followed the BILINEAR surface between the nodes, and on rough ground a triangle stood up to a quarter of the
    // cell's twist over it (0.5-1 m on Ardent) - the drawn ground's triangles poked through the skin as flat green lids. The
    // skin's base is now those triangles exactly (every 5 m node is a point of the 2.5 m input lattice: no new sample)
    const tri5 = (x, z) => { const gx = x / 5, gz = z / 5, i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j, x0g = i * 5, z0g = j * 5;
      const a = bil(H, x0g, z0g), b = bil(H, x0g, z0g + 5), d = bil(H, x0g + 5, z0g);
      return u + v <= 1 ? a * (1 - u - v) + b * v + d * u : bil(H, x0g + 5, z0g + 5) * (u + v - 1) + b * (1 - u) + d * (1 - v); };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i; Y[k] = tri5(X(i), Z(j)); Rr[k] = bil(R, X(i), Z(j)); }
    const Ys = blur(Y, n, Math.max(1, Math.round(4 / st))), Rb = blur(Rr, n, Math.max(1, Math.round(3 / st)));
    // pass 1: the macro (lap 0), its height; pass 2 the hollows from that height's 4 m Laplacian - the colour and the green
    const mac = new Float32Array(n * n * 7), tmp = new Float32Array(8), slope = new Float32Array(n * n), dn = new Float32Array(n * n * 2);
    const cz = new Float32Array(n * n), fl = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i;
      const gx = (Ys[j * n + Math.min(n - 1, i + 1)] - Ys[j * n + Math.max(0, i - 1)]) / ((Math.min(n - 1, i + 1) - Math.max(0, i - 1)) * st);
      const gz = (Ys[Math.min(n - 1, j + 1) * n + i] - Ys[Math.max(0, j - 1) * n + i]) / ((Math.min(n - 1, j + 1) - Math.max(0, j - 1)) * st);
      const gl = Math.max(Math.hypot(gx, gz), 1e-4); slope[k] = Math.atan(Math.hypot(gx, gz)) * 57.2958; dn[k * 2] = -gx / gl; dn[k * 2 + 1] = -gz / gl;
      cz[k] = (bil(H, X(i), Z(j)) - 0.25 * (bil(H, X(i) - 20, Z(j)) + bil(H, X(i) + 20, Z(j)) + bil(H, X(i), Z(j) - 20) + bil(H, X(i), Z(j) + 20))) / CZSD;
      fl[k] = bil(F, X(i), Z(j));
      macroAt(X(i), Z(j), Y[k], slope[k], Rb[k], cz[k], fl[k], bil(V, X(i), Z(j)), 0, [dn[k * 2], dn[k * 2 + 1]], K, tmp);
      mac[k * 7] = tmp[0]; }
    const hgt = new Float32Array(n * n); for (let k = 0; k < n * n; k++) hgt[k] = mac[k * 7];
    const hb = blur(hgt, n, Math.max(1, Math.round(2 / st)));
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i;
      macroAt(X(i), Z(j), Y[k], slope[k], Rb[k], cz[k], fl[k], bil(V, X(i), Z(j)), hgt[k] - hb[k], [dn[k * 2], dn[k * 2 + 1]], K, tmp);
      for (let c = 0; c < 6; c++) mac[k * 7 + c] = tmp[c]; mac[k * 7 + 6] = tmp[7]; }
    // the exposure SMOOTHED over ~5 m (the geometry's mask: read raw, every speck stood up as a tooth - the bench)
    { const Rd = rockDil(R, nh, hs);   // THE ROCK GATE (above): the exposure - the geometry's and the colour's - x it
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i, g = gateOf(bil(Rd, X(i), Z(j)));
        if (g < 1) { mac[k * 7 + 6] *= g; mac[k * 7 + 5] *= g; mac[k * 7 + 4] = Math.max(mac[k * 7 + 4], 1 - mac[k * 7 + 5]); } } }
    const ex = new Float32Array(n * n); for (let k = 0; k < n * n; k++) ex[k] = mac[k * 7 + 6];
    const MC = {}; const mac7 = c => MC[c] || (MC[c] = (() => { const o = new Float32Array(n * n); for (let k = 0; k < n * n; k++) o[k] = mac[k * 7 + c]; return o; })());
    const exs = blur(ex, n, Math.max(1, Math.round(2.5 / st)));   // (~5 m across, two passes: the bench v1 averaged the exposure over a 2.5 m ring of 8 points + the centre)
    // the COVER mask: the smoothed exposure DILATED ~4 m - a hole narrower than ~8 m (a drainage line, a joint's soil) is a gully
    // ON the outcrop (no lift, green), not a hole into the ground under it (the ground there wears another material)
    const exD = (() => { const r = Math.max(1, Math.round(4 / st)), o = new Float32Array(n * n), t = new Float32Array(n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let m = 0; for (let k = -r; k <= r; k++) { const q = exs[j * n + Math.min(n - 1, Math.max(0, i + k))]; if (q > m) m = q; } t[j * n + i] = m; }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let m = 0; for (let k = -r; k <= r; k++) { const q = t[Math.min(n - 1, Math.max(0, j + k)) * n + i]; if (q > m) m = q; } o[j * n + i] = m; }
      return blur(o, n, Math.max(1, Math.round(2 / st))); })();
    // THE FAR LAYER (the bench v1's second scatter pass: big blocks only, a 6 m grid at 9 x the odds, to 2 km): no relief, the
    // boulders seated on the DEM
    if (inp.far) return farChunk(inp, kit, { n, st, X, Z, Y, slope, dn, cz, ex, mac, bil, t0 });
    const med = new Float32Array(3), [mu, sd] = medNorm(K.unit || 12);
    const lift = K.lift === undefined ? 0.6 : K.lift, amp = K.amp === undefined ? 1.5 : K.amp, sink = K.sink === undefined ? 0.35 : K.sink;
    // THE VERTEX STAGE ON AN EXTENDED LATTICE (the chunk + 2 cells): the masses' smoothing and the normals run across the chunk's
    // edge exactly as they do in its neighbour - its border vertices come out the same in both (no seam)
    const i0 = Math.round(M / st), i1 = i0 + Math.round(C / st), m1 = i1 - i0 + 1, E = 2, me = m1 + 2 * E, ke = (a, b) => (b + i0 - E) * n + (a + i0 - E);
    const zc = new Float32Array(me * me), cvD = new Float32Array(me * me), eXe = new Float32Array(me * me), cre = new Float32Array(me * me), ide = new Float32Array(me * me), dd = new Float32Array(me * me);
    for (let b = 0; b < me; b++) for (let a = 0; a < me; a++) { const k = ke(a, b), q = b * me + a, x = X(a + i0 - E), z = Z(b + i0 - E);
      eXe[q] = ss(0.25, 0.75, exs[k]); cvD[q] = ss(0.0, 1.0, ss(0.15, 0.75, exD[k]));   // (the cover's edge ramps over its whole dilation band: a sharp ramp stood as a thin sheet at eye level)
      if (eXe[q] > 0) { medium(x, Y[k], z, K.unit || 12, med); const z0m = (med[0] - mu) / sd; zc[q] = z0m > 0 ? z0m / (1 + 0.55 * z0m) : z0m / (1 - 0.25 * z0m); cre[q] = med[1]; ide[q] = med[2]; }
      else { zc[q] = 0; cre[q] = 0; ide[q] = 0.5; } }
    for (let pass = 0; pass < 2; pass++) { const o = zc.slice();
      for (let b = 1; b < me - 1; b++) for (let a = 1; a < me - 1; a++) { const q = b * me + a; o[q] = zc[q] * 0.5 + 0.125 * (zc[q - 1] + zc[q + 1] + zc[q - me] + zc[q + me]); }
      zc.set(o); }
    // the offset along the DEM's normal: the macro's height (where rock shows) + exposure x (lift + amp x masses); with no
    // exposure the vertex SINKS under the ground - the outcrop rises out of it, no z-fight with the ground drawn there
    const nrmD = new Float32Array(me * me * 3);
    for (let b = 0; b < me; b++) for (let a = 0; a < me; a++) { const k = ke(a, b), q = b * me + a, eX = eXe[q];
      const tg = Math.tan(slope[k] / 57.2958), gx = -dn[k * 2] * tg, gz = -dn[k * 2 + 1] * tg, l = Math.hypot(gx, 1, gz);
      nrmD[q * 3] = -gx / l; nrmD[q * 3 + 1] = 1 / l; nrmD[q * 3 + 2] = -gz / l;
      // THE FLOOR (16 Nov, the user's ground-level 'sheet'): the macro's grooves and hollows go to -2 m, but the skin only ADDS to the
      // ground (the terrain is drawn under it, uncut: a discard would cost every ground pixel its early-Z) - where the relief dipped
      // under the ground the ground stood over it as a lid, the boulders seated in the dip beneath. Under the cover the relief
      // never goes below the ground: a smooth max at 0 (k 0.2 m, no crease); a deep groove is flat-bottomed at the ground, its
      // colour (the macro's dirt and green) still the gully's
      const rel = mac[k * 7] * Math.min(1, eX * 3) + eX * (lift + amp * 0.6 * zc[q]), relF = 0.5 * (rel + Math.sqrt(rel * rel + 0.04));
      dd[q] = rel + (relF - rel) * cvD[q] + (K.proud === undefined ? 0.15 : K.proud) * cvD[q] - sink * (1 - cvD[q]); }   // (under the cover: 0.3 m proud - the ground's 5 m TRIANGLES stand up to that over the bilinear DEM the ring follows; outside it, sunk)
    const PX = (a, b, c) => { const q = b * me + a, k = ke(a, b); return c === 0 ? X(a + i0 - E) + nrmD[q * 3] * dd[q] : c === 1 ? Y[k] + nrmD[q * 3 + 1] * dd[q] : Z(b + i0 - E) + nrmD[q * 3 + 2] * dd[q]; };
    // the chunk's own vertices: those of cells where the smoothed exposure shows rock
    const vid = new Int32Array(m1 * m1).fill(-1), cellOn = new Uint8Array((m1 - 1) * (m1 - 1));
    for (let j = 0; j < m1 - 1; j++) for (let i = 0; i < m1 - 1; i++) {
      const a = (j + i0) * n + (i + i0); if (Math.max(exD[a], exD[a + 1], exD[a + n], exD[a + n + 1]) > 0.22) cellOn[j * (m1 - 1) + i] = 1; }   // (a corner that shows rock: eX > 0 from 0.25; its sunk neighbours make the seam)
    let nv = 0; for (let j = 0; j < m1; j++) for (let i = 0; i < m1; i++) {
      const on = (i > 0 && j > 0 && cellOn[(j - 1) * (m1 - 1) + i - 1]) || (i < m1 - 1 && j > 0 && cellOn[(j - 1) * (m1 - 1) + i]) || (i > 0 && j < m1 - 1 && cellOn[j * (m1 - 1) + i - 1]) || (i < m1 - 1 && j < m1 - 1 && cellOn[j * (m1 - 1) + i]);
      if (on) vid[j * m1 + i] = nv++; }
    const pos = new Float32Array(nv * 3), disp = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), attr = new Float32Array(nv * 8);
    for (let j = 0; j < m1; j++) for (let i = 0; i < m1; i++) { const v = vid[j * m1 + i]; if (v < 0) continue;
      const a = i + E, b = j + E, q = b * me + a, k = ke(a, b);
      pos[v * 3] = X(i + i0); pos[v * 3 + 1] = Y[k]; pos[v * 3 + 2] = Z(j + i0);
      for (let c = 0; c < 3; c++) disp[v * 3 + c] = nrmD[q * 3 + c] * dd[q];
      // the normal of the DISPLACED lattice, central differences (the same on both sides of a chunk's edge)
      const ux = PX(a + 1, b, 0) - PX(a - 1, b, 0), uy = PX(a + 1, b, 1) - PX(a - 1, b, 1), uz = PX(a + 1, b, 2) - PX(a - 1, b, 2);
      const vx = PX(a, b + 1, 0) - PX(a, b - 1, 0), vy = PX(a, b + 1, 1) - PX(a, b - 1, 1), vz = PX(a, b + 1, 2) - PX(a, b - 1, 2);
      let nx = uz * vy - uy * vz, ny = ux * vz - uz * vx, nz = uy * vx - ux * vy; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const nl = Math.hypot(nx, ny, nz) || 1; nor[v * 3] = nx / nl; nor[v * 3 + 1] = ny / nl; nor[v * 3 + 2] = nz / nl;
      // FOR THE GROUND'S OWN MATERIAL (the bench v1's skirt wore the ground's material - every type's PBR sets, height-blended -
      // with the macro read where it is): aRM = the macro's colour multiplier, 2 + the green's chance (2+: an outcrop vertex);
      // aRX = the exposure (the vote's rock share here), the macro's height 0..1, the masses' crevice, each mass's tone
      const o = v * 8; attr[o] = mac[k * 7 + 1]; attr[o + 1] = mac[k * 7 + 2]; attr[o + 2] = mac[k * 7 + 3]; attr[o + 3] = 2 + mac[k * 7 + 4];
      attr[o + 4] = mac[k * 7 + 5]; attr[o + 5] = Math.min(1, Math.max(0, (mac[k * 7] + 1.5) / 3.5)); attr[o + 6] = cre[q] * eXe[q]; attr[o + 7] = ide[q]; }
    const idx = []; for (let j = 0; j < m1 - 1; j++) for (let i = 0; i < m1 - 1; i++) { if (!cellOn[j * (m1 - 1) + i]) continue;
      const p = vid[j * m1 + i], q = vid[j * m1 + i + 1], r = vid[(j + 1) * m1 + i], t = vid[(j + 1) * m1 + i + 1]; idx.push(p, r, q, q, r, t); }
    // ---- THE BOULDERS (the bench v1's scatter, its rules per candidate on a jittered 2 m lattice inside the chunk): a TALUS
    // field (the concave foot of a face - ground over 45 deg within 35 m uphill) takes many small and mid blocks; a ROCKY
    // slope (the exposure or scree, 18-50 deg) sparse mid and large ones in CLUSTERS (a 40 m noise); the rock's EDGE into
    // the green; a BIG class (2.5-5 m) in the packs. Each leans 80 % to the slope, turned at random, SEATED on the displaced
    // surface (its lowest point under the footprint, sunk 30-45 % of its height; grown to bridge a rough footprint), and
    // MERGED into the chunk's geometry (one draw), wearing the outcrops' own material (aR1.z = 2: a boulder)
    const RB = { pos: [], nor: [], attr: [], idx: [] };
    if (kit && kit.subs && kit.subs.length && (K.boulders === undefined || K.boulders)) {
      const rung = Math.min(2, Math.max(0, inp.rung | 0)), eye = inp.eye || [x0 + C / 2, z0 + C / 2];
      const Sc = inp.Sc, Fo = inp.Fo;
      const lat = (A, x, z) => { const fx = Math.min(n - 1.001, Math.max(0, (x - (x0 - M)) / st)), fz = Math.min(n - 1.001, Math.max(0, (z - (z0 - M)) / st)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * n + i;
        return (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + n] * (1 - u) + A[k + n + 1] * u) * v; };
      // the displaced surface: the ground + the relief on the extended lattice (the DEM outside it)
      const surf = new Float32Array(n * n); for (let k = 0; k < n * n; k++) surf[k] = Y[k];
      for (let b = 0; b < me; b++) for (let a = 0; a < me; a++) { const q = b * me + a, k = ke(a, b); surf[k] = Y[k] + nrmD[q * 3 + 1] * dd[q]; }
      const surfY = (x, z) => lat(surf, x, z);
      const R0 = Math.hypot(x0 + C / 2 - eye[0], z0 + C / 2 - eye[1]);
      const mul = K.scatter === undefined ? 1.25 : K.scatter;
      let base = 0;
      for (let gz = z0; gz < z0 + C; gz += 2) for (let gx = x0; gx < x0 + C; gx += 2) {
        const jx = gx + 1 + (hh(Math.round(gx * 3), Math.round(gz * 3), 1) - 0.5) * 2, jz = gz + 1 + (hh(Math.round(gx * 3), Math.round(gz * 3), 2) - 0.5) * 2;
        const sl = lat(slope, jx, jz); if (sl > 50) continue;
        const cR = lat(mac7(5), jx, jz), cS = Sc ? bil(Sc, jx, jz) : 0, cF = Fo ? bil(Fo, jx, jz) : 0, cv = lat(cz, jx, jz) * CZSD;
        const fi = Math.min(n - 1, Math.max(0, Math.round((jx - (x0 - M)) / st))), fj = Math.min(n - 1, Math.max(0, Math.round((jz - (z0 - M)) / st))), kk = fj * n + fi;
        const upx = -dn[kk * 2], upz = -dn[kk * 2 + 1];
        let face = 0; for (let s2 = 5; s2 <= 35; s2 += 5) if (lat(slope, jx + upx * s2, jz + upz * s2) > 45) { face = 1 - s2 / 45; break; }
        const talus = face * (sl < 42 ? 1 : 0) * (cv < 0.3 ? 1 : 0.4) * (1 - cF * 0.8);
        const clus = ss(0.40, 0.70, vn3(jx / 40, 0, jz / 40));
        const rocky = Math.max(cR, cS) * ss(18, 26, sl) * (1 - ss(44, 50, sl)) * clus * (1 - cF);
        const edge = (cR > 0.12 && cR < 0.88 ? 1 : 0) * (1 - ss(40, 50, sl)) * (1 - cF) * (0.4 + 0.6 * clus);
        const p = (talus * 0.33 + rocky * 0.055 + edge * 0.13) * mul;
        const rr = hh(Math.round(jx * 7), Math.round(jz * 7), 3);
        if (rr >= p) continue;
        const big = clus > 0.55 && hh(Math.round(jx * 5), Math.round(jz * 5), 9) < 0.07, isTalus = talus > rocky * 0.16;
        const r1 = hh(Math.round(jx * 13), Math.round(jz * 13), 5), r2 = hh(Math.round(jx * 13), Math.round(jz * 13), 6), r3 = hh(Math.round(jx * 13), Math.round(jz * 13), 7);
        const pw = Math.pow(1 - r2, 3);
        let hT = big ? 2.5 + 2.5 * r2 : (isTalus ? 0.5 + 2.5 * pw : 1.2 + 4.8 * pw);
        // the eye's reach by size: small blocks to 250 m, mid to 450 m (the ring), the big ones to its edge
        const dP = Math.hypot(jx - eye[0], jz - eye[1]); if (dP > (hT < 1.5 ? 250 : (inp.reach || 450))) continue;   // (beyond the reach: the far layer's)
        const S = big ? kit.subs[kit.blocky[Math.floor(r1 * kit.blocky.length) % kit.blocky.length]] : kit.subs[kit.pick[Math.floor(r1 * kit.pick.length) % kit.pick.length]];
        const { bw, wf } = footOf(kit, S, big, r1);
        let c = 0, G = 0, rmin = 0, rr2 = 0, gxp = 0, gzp = 0;
        for (let pass = 0; pass < 2; pass++) {
          rr2 = 0.4 * bw * hT; c = surfY(jx, jz);
          const px_ = surfY(jx + rr2, jz), nx_ = surfY(jx - rr2, jz), pz_ = surfY(jx, jz + rr2), nz_ = surfY(jx, jz - rr2);
          gxp = (px_ - nx_) / (2 * rr2); gzp = (pz_ - nz_) / (2 * rr2); G = Math.hypot(gxp, gzp);
          const res = [px_ - (c + gxp * rr2), nx_ - (c - gxp * rr2), pz_ - (c + gzp * rr2), nz_ - (c - gzp * rr2)];
          const q = 0.7 * rr2; for (const [ox, oz] of [[q, q], [-q, q], [q, -q], [-q, -q]]) res.push(surfY(jx + ox, jz + oz) - (c + gxp * ox + gzp * oz));
          rmin = Math.min(0, ...res); const rmax = Math.max(0, ...res);
          if (rmax - rmin > 0.5 * hT && pass === 0) hT = Math.min(hT * 1.3, hT + (rmax - rmin) * 0.6); else break;
        }
        const kS = hT / Math.max(S.h, 0.02), kxz = Math.min(1, 2.6 / bw), bury = 0.3 + 0.15 * r3;
        const yB = c + rmin - 0.2 * G * rr2 - hT * bury;
        if (yB + hT < c + 0.15 * hT) continue;
        // the frame: up leaning 80 % to the slope's normal, a yaw at random
        let nxl = -gxp, nyl = 1, nzl = -gzp; const nl = Math.hypot(nxl, nyl, nzl); nxl /= nl; nyl /= nl; nzl /= nl;
        nxl *= 0.8; nyl = nyl * 0.8 + 0.2; nzl *= 0.8; const nl2 = Math.hypot(nxl, nyl, nzl); nxl /= nl2; nyl /= nl2; nzl /= nl2;
        const yaw = r1 * 6.2832 * 7, cy = Math.cos(yaw), sy = Math.sin(yaw);
        // the rotation: yaw about y, then the tilt from up to (nxl, nyl, nzl) (Rodrigues)
        const ax = nzl, az = -nxl, al = Math.hypot(ax, az), ct = nyl, st2 = Math.sqrt(Math.max(0, 1 - ct * ct));
        const kx = al > 1e-6 ? ax / al : 1, kz = al > 1e-6 ? az / al : 0;
        const rot = (vx, vy, vz) => { const x1 = vx * cy + vz * sy, z1 = -vx * sy + vz * cy, y1 = vy;
          // Rodrigues about k = (kx, 0, kz): v ct + (k x v) st + k (k . v)(1 - ct)
          const dot = kx * x1 + kz * z1, crx = -kz * y1, cry = kz * x1 - kx * z1, crz = kx * y1;
          return [x1 * ct + crx * st2 + kx * dot * (1 - ct), y1 * ct + cry * st2, z1 * ct + crz * st2 + kz * dot * (1 - ct)]; };
        const sx = kS * kxz * wf * (0.8 + 0.4 * r3), sy2 = kS, sz = kS * kxz * wf * (0.8 + 0.4 * r2);
        const L = S.rungs[rung], vk = 0.85 + 0.3 * r3;
        for (let v = 0; v < L.nv; v++) {
          const p0 = rot(L.pos[v * 3] * sx, L.pos[v * 3 + 1] * sy2, L.pos[v * 3 + 2] * sz);
          RB.pos.push(jx + p0[0], yB + p0[1], jz + p0[2]);
          const n0 = rot(L.nor[v * 3] / sx, L.nor[v * 3 + 1] / sy2, L.nor[v * 3 + 2] / sz), q2 = Math.hypot(n0[0], n0[1], n0[2]) || 1;
          RB.nor.push(n0[0] / q2, n0[1] / q2, n0[2] / q2);
          // the macro's colour at its foot, x its own tone; the foot (the lowest fifth) takes the ground's green
          const foot = L.pos[v * 3 + 1] / Math.max(S.h, 1e-3);
          RB.attr.push(vk, vk, vk * 0.97, L.foot ? L.foot[v] : foot, L.crease ? L.crease[v] : 0, r3, 2, 0);   // (a boulder: its tone, its foot, its crease, its hash, the marker)
        }
        for (let t = 0; t < L.idx.length; t++) RB.idx.push(base + L.idx[t]);
        base += L.nv;
      }
    }
    // the boulders: their own mesh (their own material: the bench v1's rockMat), final positions
    const B = RB.idx.length ? { pos: Float32Array.from(RB.pos), nor: Float32Array.from(RB.nor), attr: Float32Array.from(RB.attr), idx: Uint32Array.from(RB.idx), nv: RB.pos.length / 3 } : null;
    return { pos, disp, nor, idx: Uint32Array.from(idx), attr, nv, nt: idx.length / 3, B, boulders: B ? B.idx.length / 3 : 0, ms: Date.now() - t0, n };
  }
  return { chunk, macroTile, kitPrep, procKit, macroAt, medium, jset, fbm, hh, vn2, ss, flowGrid, CZSD };
}
var ROCK_RING_CORE = ROCK_RING_CORE_FACTORY();
// the worker's text (rock_ring.js): the factory's own source - one copy of the law
var ROCK_RING_CORE_SRC = 'var ROCK_RING_CORE = (' + ROCK_RING_CORE_FACTORY.toString() + ')();';
if (typeof module !== 'undefined' && module.exports) module.exports = ROCK_RING_CORE;
if (typeof window !== 'undefined') { window.ROCK_RING_CORE = ROCK_RING_CORE; window.ROCK_RING_CORE_SRC = ROCK_RING_CORE_SRC; }
