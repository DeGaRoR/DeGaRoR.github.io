// THE WATERFRONT (G3030, 2026-10-12) - breakwaters, docks and their kin drawn
// along the editor's own lines, not as rectangles. The PROTOTYPE: the rubble
// breakwater (armour of individual blocks over its core) and the floating dock
// (a main float, its finger piers, a gangway, boats in the slips). The design
// note is futureDesigns/WATERFRONT-2026-10-12.md; GATE WATERFRONT
// (tools/_waterfront_check.js) holds the numbers.
//
// WHY NOT MARINE_GEN (tools/_marine_gen.js). That kit is a site ITEM: one
// rectangle in a house frame, a straight trapezoid of quads for a mole and
// round(L*1.4) axis-aligned boxes for its "armour" (about 1 stone per 8 m^2 of
// face). A real breakwater bends, ends in a round head and is MADE of its
// armour - Metlakatla's two moles are ~15 000 stones. This generator works on a
// polyline in WORLD x/z (the editor's line, the road's), keeps the same
// conventions (y up, sea level P.waterY, `P.bed(x, z)` the seabed / ground)
// and leaves MARINE_GEN's sites composing as they are.
//
// THE OUTPUT IS BATCH-READY: a handful of PROTOTYPE geometries (unit stones,
// boat hulls) plus per-instance data (a column-major 4x4 matrix, a colour, the
// prototype's index) for one BatchedMesh per material (cover_ring.js's idiom:
// per-instance culling, ~1 draw per material), and plain merged meshes for the
// core, the crest track and the dock's timber. Headless: no THREE needed, the
// gate builds it in node.
'use strict';
(() => {

// ---- small things --------------------------------------------------------
function rng(seed) {      // the village's stream (_marine_gen.js rng)
  let st = ((seed | 0) * 2654435761 + 7) >>> 0;
  return () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const nrm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// A plain mesh: positions, normals, colours, indices. `quad`/`tri` in order.
function Mesh(name) {
  const pos = [], nor = [], col = [], idx = [];
  const m = {
    name, pos, nor, col, idx,
    v(p, n, c) { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); col.push(c[0], c[1], c[2]); return pos.length / 3 - 1; },
    tri(a, b, c) { idx.push(a, b, c); },
    quad(a, b, c, d) { idx.push(a, b, c, a, c, d); },
    get tris() { return idx.length / 3; },
    get verts() { return pos.length / 3; },
  };
  return m;
}
// flat-shaded box between two corners (axis aligned in a frame: o + u*x + v*y + w*z)
function boxF(m, o, U, V, W, a, b, c) {
  const P = (x, y, z) => [o[0] + U[0] * x + V[0] * y + W[0] * z, o[1] + U[1] * x + V[1] * y + W[1] * z, o[2] + U[2] * x + V[2] * y + W[2] * z];
  const F = [ // [corners as x,y,z in 0/1], normal
    [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1], U], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0], U.map(x => -x)],
    [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0], V], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], V.map(x => -x)],
    [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1], W], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0], W.map(x => -x)]];
  for (const f of F) {
    const q = f.slice(0, 4).map(k => m.v(P(a[0] + (b[0] - a[0]) * k[0], a[1] + (b[1] - a[1]) * k[1], a[2] + (b[2] - a[2]) * k[2]), f[4], c));
    m.quad(q[0], q[1], q[2], q[3]);
  }
}

// ---- the line ------------------------------------------------------------
// pts [[x, z], ...] in world metres. Arc length, the closest point, and the side.
function line(pts) {
  const segs = []; let s = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (L < 1e-6) continue;
    segs.push({ a, b, tx: dx / L, tz: dz / L, L, s0: s }); s += L;
  }
  return { pts, segs, len: s };
}
// the closest point of the line: distance, the side (+1 left of travel), arc s,
// and `cap` - 0 inside, -1 past the root, +1 past the head (a round end's polar zone)
function closest(PL, x, z) {
  let best = null;
  for (const g of PL.segs) {
    const px = x - g.a[0], pz = z - g.a[1];
    const t = clamp(px * g.tx + pz * g.tz, 0, g.L);
    const cx = g.a[0] + g.tx * t, cz = g.a[1] + g.tz * t;
    const d = Math.hypot(x - cx, z - cz);
    if (!best || d < best.d - 1e-9) best = { d, g, t, side: (g.tx * (z - g.a[1]) - g.tz * (x - g.a[0])) >= 0 ? 1 : -1 };
  }
  const s = best.g.s0 + best.t;
  const cap = s <= 1e-6 ? -1 : s >= PL.len - 1e-6 ? 1 : 0;
  return { d: best.d, side: best.side, s, cap };
}
// a point and its frame at arc s (the tangent; the left normal)
function at(PL, s) {
  s = clamp(s, 0, PL.len);
  let g = PL.segs[PL.segs.length - 1];
  for (const q of PL.segs) if (s <= q.s0 + q.L) { g = q; break; }
  const t = s - g.s0;
  return { x: g.a[0] + g.tx * t, z: g.a[1] + g.tz * t, tx: g.tx, tz: g.tz, nx: -g.tz, nz: g.tx };
}

// ---- the stones ------------------------------------------------------------
// A QUARRY STONE, not a box and not a sphere: a rounded cube pushed about by a
// little noise and then FRACTURED by two or three planes (the flat split faces
// an armour stone has). Unit size (its bounding half-extent 1), flat shaded.
// THREE RUNGS OF ONE STONE - the noise is a function of the direction and the
// cuts are drawn first, so every rung is the same stone, coarser:
//   lod 0  a 2x2 grid a cube face   48 tris   (near, <= 40 m)
//   lod 1  an icosahedron           20 tris   (<= 120 m: a 1.8 m stone is ~15 px there at 1080p)
//   lod 2  the bare cube            12 tris   (<= 450 m: ~4 px; past it the core's mottle carries the look)
function stoneProto(seed, lod) {
  const R = rng(seed * 7919 + 13);
  const cut = [];
  for (let k = 0, K = 2 + (R() < 0.5 ? 1 : 0); k < K; k++) {
    const d = nrm3([R() * 2 - 1, (R() * 2 - 1) * 0.6, R() * 2 - 1]);
    cut.push({ d, o: 0.62 + R() * 0.2 });
  }
  const h0 = R() * 100, h1 = R() * 100;
  const shape = c => {        // a point on the unit cube's surface -> the stone's
    const l = Math.hypot(c[0], c[1], c[2]);
    let p = [lerp(c[0], c[0] / l, 0.38), lerp(c[1], c[1] / l, 0.38), lerp(c[2], c[2] / l, 0.38)];
    const u = c.map(x => x / l), hn = Math.sin(u[0] * 12.9898 + u[1] * 78.233 + u[2] * 37.719 + h0) * 43758.5453;
    const w = 0.9 + 0.18 * (hn - Math.floor(hn)) + 0.04 * Math.sin(u[0] * 3 + u[2] * 2 + h1);
    p = p.map(x => x * w);
    for (const q of cut) { const e = dot(p, q.d) - q.o; if (e > 0) p = [p[0] - q.d[0] * e, p[1] - q.d[1] * e, p[2] - q.d[2] * e]; }
    return p;
  };
  const tris = [];          // [[a, b, c] points]
  if (lod === 1) {
    const t = (1 + Math.sqrt(5)) / 2;
    const I = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
      .map(d => { const m = Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2])); return shape(d.map(x => x / m)); });
    const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (const f of F) tris.push([I[f[0]], I[f[1]], I[f[2]]]);
  } else {
    const n = lod === 0 ? 2 : 1, V = new Map();
    const vert = (i, j, k) => { const kk = i + ',' + j + ',' + k; if (!V.has(kk)) V.set(kk, shape([i / n * 2 - 1, j / n * 2 - 1, k / n * 2 - 1])); return V.get(kk); };
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const Q = [[[n, a, b], [n, a + 1, b], [n, a + 1, b + 1], [n, a, b + 1]], [[0, a, b], [0, a + 1, b], [0, a + 1, b + 1], [0, a, b + 1]],
        [[a, n, b], [a + 1, n, b], [a + 1, n, b + 1], [a, n, b + 1]], [[a, 0, b], [a + 1, 0, b], [a + 1, 0, b + 1], [a, 0, b + 1]],
        [[a, b, n], [a + 1, b, n], [a + 1, b + 1, n], [a, b + 1, n]], [[a, b, 0], [a + 1, b, 0], [a + 1, b + 1, 0], [a, b + 1, 0]]];
      for (const q of Q) { const P = q.map(g => vert(g[0], g[1], g[2])); tris.push([P[0], P[1], P[2]], [P[0], P[2], P[3]]); }
    }
  }
  const m = Mesh('stone' + seed + '_' + lod);
  const white = [1, 1, 1];
  for (let [a, b, c] of tris) {
    let fn = nrm3(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]));
    if (dot(fn, [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]) < 0) { const t = b; b = c; c = t; fn = fn.map(x => -x); }   // wound outward (a convex-ish stone)
    m.tri(m.v(a, fn, white), m.v(b, fn, white), m.v(c, fn, white));
  }
  // its half-extent back to 1 on the largest axis
  let e = 0; for (let i = 0; i < m.pos.length; i++) e = Math.max(e, Math.abs(m.pos[i]));
  for (let i = 0; i < m.pos.length; i++) m.pos[i] /= e;
  return m;
}

// THE LOD RINGS (m) for a batch's instances, chosen per instance per camera (the
// cover ring's BatchedMesh does exactly this: per-instance culling, a geometry id
// an instance). Past the last ring a stone is not drawn: the core's mottle is it.
const RINGS = { stone: [40, 120, 450], boat: [120, 700, 1800] };
// what a camera at `cam` [x, y, z] draws of a built feature: triangles by rung,
// the draws, the shadow casters. TWO CUTS the page makes per instance when the
// camera has moved (the cover ring's per-instance pass):
//   the BACK FLANK - a stone whose surface normal faces away from the eye sits on
//     the far face of a convex mound and is hidden by it (the section is convex;
//     the -0.15 margin keeps the crest's edge stones that peek over);
//   SHADOWS from rung 0 only, plus the core (cheap, and it carries the mound's
//     shadow; a stone past 40 m is under a texel of the sun map).
function viewCost(out, cam) {
  const C = { tris: 0, cast: 0, draws: 0, inst: [0, 0, 0, 0], back: 0 };
  for (const k in out.meshes) { const m = out.meshes[k]; if (m.tris) { C.tris += m.tris; C.draws++; if (k !== 'track') C.cast += m.tris; } }
  for (const k in out.batches) {
    const b = out.batches[k], I = b.inst, rings = RINGS[k] || RINGS.stone, protos = [b.proto0, b.proto1, b.proto2 || b.proto1];
    let any = false;
    for (let i = 0; i < I.n; i++) {
      const o = i * 16, d = Math.hypot(I.mat[o + 12] - cam[0], I.mat[o + 13] - cam[1], I.mat[o + 14] - cam[2]);
      const r = d <= rings[0] ? 0 : d <= rings[1] ? 1 : d <= rings[2] ? 2 : 3;
      if (r < 3 && I.nrm) {
        const f = ((cam[0] - I.mat[o + 12]) * I.nrm[i * 3] + (cam[1] - I.mat[o + 13]) * I.nrm[i * 3 + 1] + (cam[2] - I.mat[o + 14]) * I.nrm[i * 3 + 2]) / (d || 1);
        if (f < -0.15) { C.back++; continue; }
      }
      C.inst[r]++;
      if (r === 3) continue;
      any = true;
      const t = protos[r][I.proto[i]].tris; C.tris += t; if (r === 0) C.cast += t;
    }
    if (any) C.draws++;
  }
  return C;
}

// a column-major 4x4 (three's Matrix4.elements) from a frame and a scale
function mat4(c, X, Y, Z, s) {
  return [X[0] * s[0], X[1] * s[0], X[2] * s[0], 0, Y[0] * s[1], Y[1] * s[1], Y[2] * s[1], 0, Z[0] * s[2], Z[1] * s[2], Z[2] * s[2], 0, c[0], c[1], c[2], 1];
}

// ---- THE BREAKWATER ----------------------------------------------------------
// A rubble mound along a line. Its surface is ONE height field, so the mesh, the
// stones and the ground the wheels meet all agree:
//   M(x, z) = top - max(0, d - hw) / slope(side)      d = distance to the line
//   H(x, z) = max(bed(x, z), M(x, z))
// The distance to a polyline makes the ROUND HEAD (and the round outside of
// every bend) for free; `head: 'butt'` squares the seaward end off instead.
const BW_DEF = {
  crest: 8.0,            // crest width, m
  crestH: 4.0,           // crest over the water, m
  slopeL: 1.5, slopeR: 1.5,   // side slopes (h:1), left/right of travel (root -> head)
  block: 1.6,            // the armour's median stone, m (a 1.6 m stone is ~5 t)
  blockVar: 0.35,        // its size spread, +-
  band: 1.6,             // stones are laid down to this depth under the water (deeper: the core's colour only)
  head: 'round',         // 'round' | 'butt'
  track: 0,              // crest track width, m (0: the crest is armoured too)
  trackLook: 'gravel',   // 'gravel' | 'grass' (Walden Point's jetty)
  light: 1,              // a beacon on the head
  ds: 2.0,               // core station spacing, m
  seed: 1,
};
const LOOK = { gravel: [0.55, 0.53, 0.49], grass: [0.36, 0.42, 0.24] };

function breakwater(pts, P0, env) {
  const P = Object.assign({}, BW_DEF, P0 || {});
  const wy = env && isFinite(env.waterY) ? env.waterY : 0;
  const bed = env && env.bed ? env.bed : ((x, z) => wy - 6);
  const PL = line(pts);
  const R = rng(P.seed);
  const hw = P.crest / 2, top = wy + P.crestH;
  const M = (x, z) => {
    const c = closest(PL, x, z);
    let d = c.d;
    if (P.head === 'butt' && c.cap === 1) {        // a square end: the distance along the axis past the head
      const e = at(PL, PL.len), ax = x - e.x, az = z - e.z;
      d = Math.max(Math.abs(ax * e.nx + az * e.nz), (ax * e.tx + az * e.tz) * 3);
    }
    return top - Math.max(0, d - hw) / (c.side > 0 ? P.slopeL : P.slopeR);
  };
  const H = (x, z) => Math.max(bed(x, z), M(x, z));
  // the toe: how far out from the axis (along a horizontal ray) the mound meets the bed
  const toeAlong = (ox, oz, dx, dz) => {
    let r0 = hw, r1 = hw;
    const smax = Math.max(P.slopeL, P.slopeR);
    for (let r = hw; r < hw + (P.crestH + 40) * smax; r += 0.5) { r1 = r; if (M(ox + dx * r, oz + dz * r) <= bed(ox + dx * r, oz + dz * r)) break; r0 = r; }
    for (let k = 0; k < 24; k++) { const m = (r0 + r1) / 2; if (M(ox + dx * m, oz + dz * m) <= bed(ox + dx * m, oz + dz * m)) r1 = m; else r0 = m; }
    return r1;
  };

  // ---- the core: stations along the line, a section at each; round caps
  const core = Mesh('core');
  const K = 7;                                   // flank samples a side
  const rubble = (x, z, y) => {                  // the core's own colour: dark, mottled, darker under water (the far LOD's whole look)
    const n = Math.sin(x * 1.7 + z * 0.9) * Math.sin(x * 0.6 - z * 1.3) * 0.5 + 0.5;
    const k = (0.42 + 0.12 * n) * (y < wy ? 0.62 : 1);
    return [k * 1.0, k * 0.98, k * 0.93];
  };
  const vtx = (x, z) => { const y = H(x, z); return core.v([x, y, z], [0, 1, 0], rubble(x, z, y)); };
  const rays = [];                               // [{ox, oz, dx, dz}] one per station (both sides via the sign)
  const stS = [];
  for (let s = 0; s < PL.len; s += P.ds) stS.push(s);
  stS.push(PL.len);
  for (const g of PL.segs) for (const sv of [g.s0, g.s0 + g.L]) if (!stS.some(q => Math.abs(q - sv) < 0.3)) stS.push(sv);
  stS.sort((a, b) => a - b);
  const sections = [];
  for (const s of stS) {
    const f = at(PL, s);
    // a mitred normal at an interior vertex (the bisector, limited)
    let nx = f.nx, nz = f.nz;
    for (let i = 1; i + 1 < PL.pts.length; i++) {
      const g0 = PL.segs[i - 1], g1 = PL.segs[i];
      if (g0 && g1 && Math.abs(g1.s0 - s) < 1e-6) {
        let bx = -g0.tz - g1.tz, bz = g0.tx + g1.tx; const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl;
        const c = Math.max(0.5, bx * (-g1.tz) + bz * g1.tx); nx = bx / c; nz = bz / c;
      }
    }
    const row = [];
    for (const side of [-1, 1]) {
      const toe = toeAlong(f.x, f.z, nx * side, nz * side);
      const us = [hw * 0.5, hw];
      for (let k = 1; k <= K; k++) us.push(hw + (toe - hw) * (k / K));
      const list = us.map(u => vtx(f.x + nx * side * u, f.z + nz * side * u));
      if (side < 0) row.push(...list.reverse()); else { row.push(vtx(f.x, f.z)); row.push(...list); }
    }
    sections.push({ s, f, nx, nz, row });
  }
  for (let i = 0; i + 1 < sections.length; i++) {
    const a = sections[i].row, b = sections[i + 1].row;
    for (let k = 0; k + 1 < a.length; k++) core.quad(a[k], b[k], b[k + 1], a[k + 1]);
  }
  // the caps: a half fan of rays about each end. The root's is the same mound
  // (it meets the land, or the fill, and the max() buries what is under ground)
  for (const end of [0, 1]) {
    const f = at(PL, end ? PL.len : 0), fw = end ? 1 : -1;
    const A = 12;
    const ringOf = j => {
      const ph = -Math.PI / 2 + Math.PI * j / A;
      // the ray turns from the right normal through the axis to the left one (in travel terms)
      const dx = f.tx * fw * Math.cos(ph) + f.nx * Math.sin(ph) * -fw, dz = f.tz * fw * Math.cos(ph) + f.nz * Math.sin(ph) * -fw;
      const toe = toeAlong(f.x, f.z, dx, dz);
      const us = [hw * 0.5, hw]; for (let k = 1; k <= K; k++) us.push(hw + (toe - hw) * (k / K));
      return us.map(u => vtx(f.x + dx * u, f.z + dz * u));
    };
    const c = vtx(f.x, f.z), rings = [];
    for (let j = 0; j <= A; j++) rings.push(ringOf(j));
    for (let j = 0; j < A; j++) {
      const a = rings[j], b = rings[j + 1];
      if (end) core.tri(c, a[0], b[0]); else core.tri(c, b[0], a[0]);
      for (let k = 0; k + 1 < a.length; k++) { if (end) core.quad(a[k], a[k + 1], b[k + 1], b[k]); else core.quad(a[k], b[k], b[k + 1], a[k + 1]); }
    }
  }
  // smooth the core's normals from its faces (it is one surface)
  smoothNormals(core);

  // ---- the crest track (Walden Point's grassy jetty)
  const track = Mesh('track');
  if (P.track > 0) {
    const tw = Math.min(P.track, P.crest - 0.6) / 2, tc = LOOK[P.trackLook] || LOOK.gravel;
    let prev = null;
    for (const S of sections) {
      if (S.s > PL.len - hw * 0.6) break;
      const y = top + 0.03;
      const a = track.v([S.f.x + S.nx * tw, y, S.f.z + S.nz * tw], [0, 1, 0], tc), b = track.v([S.f.x - S.nx * tw, y, S.f.z - S.nz * tw], [0, 1, 0], tc);
      if (prev) track.quad(prev[0], prev[1], b, a);
      prev = [a, b];
    }
  }

  // ---- the armour: blue-noise stones over the core above `band`
  // Dart throwing on the core's own triangles, the BIGGEST stones first (a real
  // mound's primary armour, then the smaller ones in its gaps), each seated on
  // the surface ~45 % into it along the local normal.
  const tri = [], cum = [];
  let area = 0;
  const cp = core.pos, ci = core.idx;
  const trackHalf = P.track > 0 ? Math.min(P.track, P.crest - 0.6) / 2 : -1;
  for (let i = 0; i < ci.length; i += 3) {
    const a = ci[i] * 3, b = ci[i + 1] * 3, c = ci[i + 2] * 3;
    const ymax = Math.max(cp[a + 1], cp[b + 1], cp[c + 1]);
    if (ymax < wy - P.band) continue;
    const e1 = [cp[b] - cp[a], cp[b + 1] - cp[a + 1], cp[b + 2] - cp[a + 2]], e2 = [cp[c] - cp[a], cp[c + 1] - cp[a + 1], cp[c + 2] - cp[a + 2]];
    const cr = cross(e1, e2), ar = Math.hypot(cr[0], cr[1], cr[2]) / 2;
    if (ar < 1e-6) continue;
    area += ar; tri.push([a, b, c]); cum.push(area);
  }
  const D = P.block, rMean = D / 2;
  const target = area / (Math.PI * rMean * rMean * 0.8);
  const cands = [];
  for (let k = 0, N = Math.round(target * 9); k < N; k++) {
    const u = R() * area;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < u) lo = m + 1; else hi = m; }
    const [a, b, c] = tri[lo];
    let r1 = R(), r2 = R(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    const x = cp[a] + (cp[b] - cp[a]) * r1 + (cp[c] - cp[a]) * r2, z = cp[a + 2] + (cp[b + 2] - cp[a + 2]) * r1 + (cp[c + 2] - cp[a + 2]) * r2;
    const y = H(x, z);
    if (y < wy - P.band) continue;
    if (bed(x, z) >= y - 0.05) continue;                         // natural ground here, not the mound
    if (trackHalf > 0 && y > top - 0.01) { const q = closest(PL, x, z); if (q.d < trackHalf + 0.15 && q.s < PL.len - hw * 0.6) continue; }
    const r = rMean * (1 + P.blockVar * (R() * 2 - 1));
    cands.push({ x, y, z, r, k: R() });
  }
  cands.sort((p, q) => q.r - p.r || p.k - q.k);
  const cell = D * 1.4, grid = new Map(), gk = (i, j) => i * 73856093 ^ j * 19349663;
  const stones = [];
  const PACK = 0.70;                                              // centre spacing as a share of the two radii (stones interlock a little)
  for (const q of cands) {
    const gi = Math.floor(q.x / cell), gj = Math.floor(q.z / cell);
    let ok = true;
    for (let di = -1; di <= 1 && ok; di++) for (let dj = -1; dj <= 1 && ok; dj++) {
      const L = grid.get(gk(gi + di, gj + dj)); if (!L) continue;
      for (const o of L) { const dd = Math.hypot(o.x - q.x, o.y - q.y, o.z - q.z); if (dd < PACK * (o.r + q.r)) { ok = false; break; } }
    }
    if (!ok) continue;
    const k = gk(gi, gj); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(q);
    stones.push(q);
  }
  // RELAX: dart throwing leaves the spacing uneven (gaps a stone wide beside
  // pairs touching). Three rounds of push-apart, each stone put back on the
  // surface: the same count covers more of the face (the gate's 3a).
  for (let it = 0; it < 3; it++) {
    const g2 = new Map();
    for (const q of stones) { const k = gk(Math.floor(q.x / cell), Math.floor(q.z / cell)); if (!g2.has(k)) g2.set(k, []); g2.get(k).push(q); }
    for (const q of stones) {
      let mx = 0, mz = 0;
      const gi = Math.floor(q.x / cell), gj = Math.floor(q.z / cell);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const L = g2.get(gk(gi + di, gj + dj)); if (!L) continue;
        for (const o of L) {
          if (o === q) continue;
          const dx = q.x - o.x, dz = q.z - o.z, d = Math.hypot(dx, q.y - o.y, dz) || 1e-3, want = 0.95 * (o.r + q.r);
          if (d < want) { const f = (want - d) * 0.5 / d; mx += dx * f; mz += dz * f; }
        }
      }
      const ml = Math.hypot(mx, mz), cap = q.r * 0.35;
      if (ml > cap) { mx *= cap / ml; mz *= cap / ml; }
      const nx = q.x + mx, nz = q.z + mz, ny = H(nx, nz);
      if (ny < wy - P.band || bed(nx, nz) >= ny - 0.05) continue;
      if (trackHalf > 0 && ny > top - 0.01) { const c = closest(PL, nx, nz); if (c.d < trackHalf + 0.15 && c.s < PL.len - hw * 0.6) continue; }
      q.x = nx; q.z = nz; q.y = ny;
    }
  }
  // CHINKING: the gaps the primary armour leaves are filled with smaller stones
  // (0.45-0.7 of the median), dart-thrown against the relaxed layer - the
  // coverage the gate's 3a asks for, at a fraction of the count of a denser
  // primary layer
  {
    const g3 = new Map();
    for (const q of stones) { const k = gk(Math.floor(q.x / cell), Math.floor(q.z / cell)); if (!g3.has(k)) g3.set(k, []); g3.get(k).push(q); }
    const nPrim = stones.length;
    for (let k = 0, N = nPrim * 6; k < N; k++) {
      const u = R() * area;
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < u) lo = m + 1; else hi = m; }
      const [a, b, c] = tri[lo];
      let r1 = R(), r2 = R(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
      const x = cp[a] + (cp[b] - cp[a]) * r1 + (cp[c] - cp[a]) * r2, z = cp[a + 2] + (cp[b + 2] - cp[a + 2]) * r1 + (cp[c + 2] - cp[a + 2]) * r2;
      const y = H(x, z);
      if (y < wy - P.band || bed(x, z) >= y - 0.05) continue;
      if (trackHalf > 0 && y > top - 0.01) { const q = closest(PL, x, z); if (q.d < trackHalf + 0.15 && q.s < PL.len - hw * 0.6) continue; }
      const r = rMean * (0.45 + 0.25 * R());
      const gi = Math.floor(x / cell), gj = Math.floor(z / cell);
      let ok = true;
      for (let di = -1; di <= 1 && ok; di++) for (let dj = -1; dj <= 1 && ok; dj++) {
        const L = g3.get(gk(gi + di, gj + dj)); if (!L) continue;
        for (const o of L) if (Math.hypot(o.x - x, o.y - y, o.z - z) < PACK * (o.r + r)) { ok = false; break; }
      }
      if (!ok) continue;
      const q = { x, y, z, r, k: R(), chink: 1 };
      const kk = gk(gi, gj); if (!g3.has(kk)) g3.set(kk, []); g3.get(kk).push(q);
      stones.push(q);
    }
  }
  // pose each stone: lying on the slope (its short axis near the surface normal), turned at random
  const NP = 6;
  const proto0 = [], proto1 = [], proto2 = [];
  for (let i = 0; i < NP; i++) { proto0.push(stoneProto(P.seed * 31 + i, 0)); proto1.push(stoneProto(P.seed * 31 + i, 1)); proto2.push(stoneProto(P.seed * 31 + i, 2)); }
  const inst = { n: stones.length, mat: new Float32Array(stones.length * 16), col: new Float32Array(stones.length * 3), proto: new Uint8Array(stones.length), r: new Float32Array(stones.length), seat: new Float32Array(stones.length), nrm: new Float32Array(stones.length * 3), chink: new Uint8Array(stones.length) };
  const e = 0.25;
  stones.forEach((q, i) => {
    const gx = (H(q.x + e, q.z) - H(q.x - e, q.z)) / (2 * e), gz = (H(q.x, q.z + e) - H(q.x, q.z - e)) / (2 * e);
    const n = nrm3([-gx, 1, -gz]);
    let up = nrm3([lerp(n[0], 0, 0.2) + (R() - 0.5) * 0.35, lerp(n[1], 1, 0.2), lerp(n[2], 0, 0.2) + (R() - 0.5) * 0.35]);
    const sp = R() * Math.PI * 2;
    let X = nrm3(cross(up, [Math.cos(sp), 0, Math.sin(sp)])); if (!isFinite(X[0])) X = [1, 0, 0];
    const Z = cross(X, up);
    const ax = 1.05 + R() * 0.25, ay = 0.62 + R() * 0.2, az = 0.92 + R() * 0.22;   // tabular: the long axes lie in the slope
    const h = q.r * ay;
    const c = [q.x + n[0] * h * 0.55, q.y + n[1] * h * 0.55, q.z + n[2] * h * 0.55];
    inst.mat.set(mat4(c, X, up, Z, [q.r * ax, h, q.r * az]), i * 16);
    const v = 0.47 + R() * 0.2, w = (R() - 0.5) * 0.05;          // grey with a little warm or cool in it
    inst.col.set([v * (1 + w), v, v * (1 - w * 1.4)], i * 3);
    inst.proto[i] = Math.floor(R() * NP) % NP;
    inst.r[i] = q.r; inst.seat[i] = h * 0.55; inst.nrm.set(n, i * 3); inst.chink[i] = q.chink ? 1 : 0;
  });

  // ---- the beacon on the head
  const lights = [];
  const steel = Mesh('steel');
  if (P.light) {
    const f = at(PL, PL.len);
    const hx = f.x - f.tx * hw * 0.4, hz = f.z - f.tz * hw * 0.4;
    boxF(steel, [hx, top, hz], [1, 0, 0], [0, 1, 0], [0, 0, 1], [-0.09, 0, -0.09], [0.09, 4.2, 0.09], [0.86, 0.87, 0.85]);
    boxF(steel, [hx, top, hz], [1, 0, 0], [0, 1, 0], [0, 0, 1], [-0.6, 0, -0.6], [0.6, 0.5, 0.6], [0.8, 0.8, 0.78]);
    lights.push({ x: hx, y: top + 4.4, z: hz, col: [0.4, 1, 0.5], k: 1, range: 40, kind: 'beacon' });
  }

  const stats = statsOf({ core, track, steel }, { stone: { inst, proto0, proto1, proto2 } });
  stats.len = PL.len; stats.area = area; stats.stones = stones.length; stats.chinks = stones.filter(q => q.chink).length; stats.top = top;
  return { kind: 'breakwater', P, PL, H, M, bed, wy, top, hw, meshes: { core, track, steel }, batches: { stone: { inst, proto0, proto1, proto2 } }, lights, stats };
}

function smoothNormals(m) {
  // a height field: every face is wound to look UP (the strips and the two caps
  // are built in different senses; one rule here rather than three in the loops)
  for (let i = 0; i < m.idx.length; i += 3) {
    const a = m.idx[i] * 3, b = m.idx[i + 1] * 3, c = m.idx[i + 2] * 3, p = m.pos;
    const ny = (p[b + 2] - p[a + 2]) * (p[c] - p[a]) - (p[b] - p[a]) * (p[c + 2] - p[a + 2]);
    if (ny < 0) { const t = m.idx[i + 1]; m.idx[i + 1] = m.idx[i + 2]; m.idx[i + 2] = t; }
  }
  const n = new Float64Array(m.pos.length);
  for (let i = 0; i < m.idx.length; i += 3) {
    const a = m.idx[i] * 3, b = m.idx[i + 1] * 3, c = m.idx[i + 2] * 3, p = m.pos;
    const f = cross([p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]]);
    for (const v of [a, b, c]) { n[v] += f[0]; n[v + 1] += f[1]; n[v + 2] += f[2]; }
  }
  for (let i = 0; i < n.length; i += 3) {
    let v = [n[i], n[i + 1], n[i + 2]];
    if (v[1] < 0) v = v.map(x => -x);     // the core is a height field: every normal points up
    v = nrm3(v); m.nor[i] = v[0]; m.nor[i + 1] = v[1]; m.nor[i + 2] = v[2];
  }
}

// ---- THE FLOATING DOCK ----------------------------------------------------------
// A main float along a line (pts[0] = the shore end, where the gangway lands),
// finger floats at a pitch, the slips between them, a boat in a share of the
// slips. The deck rides `freeboard` over the water whatever the (visual) tide.
const FD_DEF = {
  w: 2.6, freeboard: 0.5, module: 6.0,
  fingers: 'both',       // 'both' | 'alt' | 'left' | 'right'
  pitch: 9.0, fingerL: 10.0, fingerW: 1.0, fingerStart: 6.0,
  gangway: 1, gangW: 1.2, abut: 2.6,    // the gangway lands where the ground reaches `abut` over the water
  guideSpc: 18,
  boats: 0.75,           // the share of slips with a boat in them
  seed: 2,
};
// the boats: procedural low-poly hulls (the repo's CC-BY Sketchfab boats are
// 30-370 k triangles each; a harbour of 80 needs ~200).
const BOAT_TYPES = [
  // name, length range, beam / length, cabin [x0, x1 as a share from the stern, height], mast
  { name: 'troller', L: [9, 13], b: 0.31, cab: [0.45, 0.7, 2.0], mast: 1, freeb: 1.1 },
  { name: 'seiner', L: [11, 15], b: 0.33, cab: [0.55, 0.85, 2.4], mast: 1, freeb: 1.3 },
  { name: 'cruiser', L: [8, 12], b: 0.33, cab: [0.25, 0.65, 1.7], mast: 0, freeb: 1.0 },
  { name: 'skiff', L: [5, 7.5], b: 0.36, cab: null, mast: 0, freeb: 0.6 },
];
const HULLS = [[0.92, 0.92, 0.9], [0.16, 0.27, 0.45], [0.62, 0.16, 0.13], [0.2, 0.42, 0.33]];
// a hull of unit length (x -1..1 stern to bow) and unit half-beam, lod 0 lofted, lod 1 a block
function boatProto(type, hull, lod) {
  const T = BOAT_TYPES[type], m = Mesh('boat' + type + '_' + hull + '_' + lod);
  const hc = HULLS[hull], deck = [0.78, 0.77, 0.72], white = [0.93, 0.93, 0.91];
  const fb = T.freeb, draft = 0.55;
  if (lod === 0) {
    const NS = 7, st = [];
    for (let i = 0; i <= NS; i++) {
      const x = -1 + 2 * i / NS, t = i / NS;
      const b = t < 0.6 ? lerp(0.86, 1, t / 0.6) : Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.6) / 0.4, 2)));   // a transom stern, a fine bow
      const sh = fb + 0.25 * Math.pow(t, 3);                     // the sheer rises to the bow
      st.push([[x, sh, b], [x, -draft * 0.35, b * 0.88], [x, -draft * (t > 0.92 ? 0.2 : 1), 0], [x, -draft * 0.35, -b * 0.88], [x, sh, -b]]);
    }
    const face = (a, b, c, col) => { const n = nrm3(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]])); m.tri(m.v(a, n, col), m.v(b, n, col), m.v(c, n, col)); };
    for (let i = 0; i < NS; i++) for (let k = 0; k < 4; k++) {
      const a = st[i][k], b = st[i + 1][k], c = st[i + 1][k + 1], d = st[i][k + 1];
      face(a, d, c, hc); face(a, c, b, hc);
    }
    for (let i = 0; i < NS; i++) { const a = st[i], b = st[i + 1]; face(a[0], b[0], b[4], deck); face(a[0], b[4], a[4], deck); }
    const s0 = st[0]; face(s0[0], s0[4], s0[3], hc); face(s0[0], s0[3], s0[1], hc); face(s0[1], s0[3], s0[2], hc);   // the transom
    if (T.cab) {
      const [c0, c1, ch] = T.cab, x0 = -1 + 2 * c0, x1 = -1 + 2 * c1;
      boxF(m, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [x0, fb, -0.62], [x1, fb + ch, 0.62], white);
    }
    if (T.mast) boxF(m, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [-0.02 + (T.cab ? -1 + 2 * T.cab[1] : 0) + 0.05, fb, -0.035], [0.05 + (T.cab ? -1 + 2 * T.cab[1] : 0) + 0.05, fb + 6.5, 0.035], white);
  } else {
    boxF(m, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, -draft, -0.9], [0.8, fb, 0.9], hc);
    if (T.cab) boxF(m, [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [-1 + 2 * T.cab[0], fb, -0.6], [-1 + 2 * T.cab[1], fb + T.cab[2], 0.6], white);
  }
  return m;
}

function floatDock(pts, P0, env) {
  const P = Object.assign({}, FD_DEF, P0 || {});
  const wy = env && isFinite(env.waterY) ? env.waterY : 0;
  const bed = env && env.bed ? env.bed : ((x, z) => wy - 6);
  const PL = line(pts);
  const R = rng(P.seed);
  const y = wy + P.freeboard;
  const body = Mesh('body'), deck = Mesh('deck'), steel = Mesh('steel'), pile = Mesh('pile');
  const BODY = [0.6, 0.62, 0.62], DECK = [0.55, 0.5, 0.42], STEEL = [0.72, 0.74, 0.75], PILE = [0.3, 0.27, 0.24];
  const Y = [0, 1, 0];
  const decks = [];                 // walkable rectangles {c, U, W, hu, hw, y} - the walkers' and the hit raster's
  const slab = (cx, cz, ux, uz, hu, hw2) => {
    const U = [ux, 0, uz], W = [-uz, 0, ux];
    boxF(body, [cx, 0, cz], U, Y, W, [-hu, wy - 0.45, -hw2], [hu, y - 0.08, hw2], BODY);
    boxF(deck, [cx, 0, cz], U, Y, W, [-hu + 0.02, y - 0.08, -hw2 + 0.02], [hu - 0.02, y, hw2 - 0.02], DECK);
    decks.push({ x: cx, z: cz, ux, uz, hu, hw: hw2, y });
  };
  // the main float: modules along each segment, a square joint at each bend
  for (const g of PL.segs) {
    const n = Math.max(1, Math.round(g.L / P.module)), ml = g.L / n;
    for (let i = 0; i < n; i++) { const t = (i + 0.5) * ml; slab(g.a[0] + g.tx * t, g.a[1] + g.tz * t, g.tx, g.tz, ml / 2 - 0.05, P.w / 2); }
  }
  for (let i = 1; i + 1 < PL.pts.length; i++) { const p = PL.pts[i], g = PL.segs[i]; slab(p[0], p[1], g.tx, g.tz, P.w / 2, P.w / 2); }
  // the fingers and the slips
  const fingers = [], slips = [];
  const sides = P.fingers === 'left' ? [1] : P.fingers === 'right' ? [-1] : [1, -1];
  let k = 0;
  for (let s = P.fingerStart; s <= PL.len - P.fingerW; s += P.pitch, k++) {
    // no finger on a bend's joint
    if (PL.segs.some(g => g.s0 > 0 && Math.abs(g.s0 - s) < P.w)) continue;
    const f = at(PL, s);
    for (const sd of sides) {
      if (P.fingers === 'alt' && ((k & 1) ? 1 : -1) !== sd) continue;
      const off = P.w / 2 + P.fingerL / 2;
      const cx = f.x + f.nx * sd * off, cz = f.z + f.nz * sd * off;
      slab(cx, cz, f.nx * sd, f.nz * sd, P.fingerL / 2, P.fingerW / 2);
      fingers.push({ s, side: sd, x: cx, z: cz });
      // cleats: two along each finger edge
      for (const e of [-1, 1]) for (const tt of [0.25, 0.8]) {
        const px = f.x + f.nx * sd * (P.w / 2 + P.fingerL * tt) + f.tx * e * (P.fingerW / 2 - 0.08), pz = f.z + f.nz * sd * (P.w / 2 + P.fingerL * tt) + f.tz * e * (P.fingerW / 2 - 0.08);
        boxF(steel, [px, y, pz], [f.tx, 0, f.tz], Y, [f.nx, 0, f.nz], [-0.05, 0, -0.18], [0.05, 0.12, 0.18], STEEL);
      }
    }
  }
  // the slips: between two neighbouring fingers on one side
  for (const sd of sides) {
    const fs = fingers.filter(q => q.side === sd).sort((a, b) => a.s - b.s);
    for (let i = 0; i + 1 < fs.length; i++) {
      const a = fs[i], b = fs[i + 1];
      if (b.s - a.s > P.pitch * 1.5) continue;
      slips.push({ side: sd, s0: a.s + P.fingerW / 2, s1: b.s - P.fingerW / 2 });
    }
  }
  // the pile guides: a pile from the bed through a hoop, alternating sides
  let gi = 0;
  for (let s = P.guideSpc / 2; s < PL.len; s += P.guideSpc, gi++) {
    const f = at(PL, s), sd = (gi & 1) ? 1 : -1;
    const px = f.x + f.nx * sd * (P.w / 2 + 0.35), pz = f.z + f.nz * sd * (P.w / 2 + 0.35);
    const b0 = Math.min(bed(px, pz), wy - 1) - 0.6;
    boxF(pile, [px, 0, pz], [1, 0, 0], Y, [0, 0, 1], [-0.2, b0, -0.2], [0.2, wy + 4.6, 0.2], PILE);
    boxF(steel, [px, 0, pz], [f.tx, 0, f.tz], Y, [f.nx, 0, f.nz], [-0.4, y - 0.05, -0.42], [0.4, y + 0.45, 0.42], STEEL);
  }
  // the gangway: from the float's shore end back along the line to where the
  // ground stands `abut` over the water (the quay, the fill), hinged there
  let gang = null;
  if (P.gangway) {
    const f = at(PL, 0);
    let L = 0;
    for (; L < 60; L += 0.25) if (bed(f.x - f.tx * L, f.z - f.tz * L) >= wy + P.abut - 0.4) break;
    const hx = f.x - f.tx * L, hz = f.z - f.tz * L, hy = Math.max(bed(hx, hz), wy + P.abut - 0.4) + 0.4;
    const U = [f.tx, 0, f.tz], W = [-f.tz, 0, f.tx];
    const run = L + 0.6;                                           // it rests 0.6 m onto the float
    const slope = (hy - (y + 0.15)) / run;
    const ang = Math.atan2(hy - (y + 0.15), run);
    const UU = [f.tx * Math.cos(ang), -Math.sin(ang), f.tz * Math.cos(ang)];
    const UN = nrm3(cross(W, UU)).map(v => -v);
    const o = [hx, hy, hz];
    boxF(deck, o, UU, UN[1] < 0 ? UN.map(v => -v) : UN, W, [0, -0.12, -P.gangW / 2], [Math.hypot(run, hy - y - 0.15), 0, P.gangW / 2], DECK);
    for (const e of [-1, 1]) boxF(steel, o, UU, Y, W, [0, 0, e * P.gangW / 2 - 0.03], [Math.hypot(run, hy - y - 0.15), 1.0, e * P.gangW / 2 + 0.03], STEEL);
    gang = { x0: hx, z0: hz, y0: hy, x1: f.x + f.tx * 0.6, z1: f.z + f.tz * 0.6, y1: y + 0.15, run, slope, L: Math.hypot(run, hy - y - 0.15) };
  }
  // the boats: one in a share of the slips, alongside a finger (0.35 m of fenders), bow to the main float
  const NT = BOAT_TYPES.length, NH = HULLS.length;
  const proto0 = [], proto1 = [];
  for (let t = 0; t < NT; t++) for (let h = 0; h < NH; h++) { proto0.push(boatProto(t, h, 0)); proto1.push(boatProto(t, h, 1)); }
  const boats = [];
  for (const sl of slips) {
    if (R() >= P.boats) continue;
    const slipW = sl.s1 - sl.s0;
    let t = Math.floor(R() * NT);
    const T = BOAT_TYPES[t];
    let L = lerp(T.L[0], T.L[1], R());
    L = Math.min(L, P.fingerL + 2.5);
    let B = Math.min(L * T.b, slipW - 0.7);
    if (B < 1.8) { t = 3; L = Math.min(6, P.fingerL); B = Math.min(L * 0.36, slipW - 0.7); if (B < 1.4) continue; }
    const hull = Math.floor(R() * NH);
    const lean = R() < 0.5 ? 0 : 1;                                // alongside the slip's first or second finger
    const sMid = lean ? sl.s1 - 0.35 - B / 2 : sl.s0 + 0.35 + B / 2;
    const f = at(PL, sMid);
    const along = P.w / 2 + 0.6 + L / 2;                           // bow 0.6 m off the main float
    const cx = f.x + f.nx * sl.side * along, cz = f.z + f.nz * sl.side * along;
    // the boat's x (stern -> bow) points at the main float
    const X = [-f.nx * sl.side, 0, -f.nz * sl.side], Z = cross(X, Y);
    boats.push({ proto: t * NH + hull, mat: mat4([cx, wy, cz], X, Y, Z, [L / 2, 1, B / 2]), L, B, x: cx, z: cz, X, side: sl.side, s: sMid, type: BOAT_TYPES[t].name });
  }
  const inst = { n: boats.length, mat: new Float32Array(boats.length * 16), col: new Float32Array(boats.length * 3).fill(1), proto: new Uint8Array(boats.length) };
  boats.forEach((b, i) => { inst.mat.set(b.mat, i * 16); inst.proto[i] = b.proto; });
  const meshes = { body, deck, steel, pile };
  const stats = statsOf(meshes, { boat: { inst, proto0, proto1 } });
  stats.len = PL.len; stats.fingers = fingers.length; stats.slips = slips.length; stats.boats = boats.length; stats.deckY = y;
  return { kind: 'float', P, PL, wy, y, bed, meshes, batches: { boat: { inst, proto0, proto1 } }, fingers, slips, boats, gang, decks, stats };
}

// ---- the numbers -------------------------------------------------------------
// triangles at each rung, the draws (a merged mesh is one; a batch is one per
// material), the bytes a GPU holds (positions + normals + colours as float32,
// indices as uint32; a batch's prototypes once plus 76 bytes an instance).
function statsOf(meshes, batches) {
  const S = { tris0: 0, tris1: 0, trisFar: 0, draws: 0, bytes: 0, per: {} };
  for (const k in meshes) {
    const m = meshes[k]; if (!m.tris) continue;
    S.per[k] = m.tris; S.tris0 += m.tris; S.tris1 += m.tris; S.draws++;
    S.bytes += m.verts * 36 + m.tris * 12;
    if (k === 'core' || k === 'track' || k === 'body' || k === 'deck') S.trisFar += m.tris;
  }
  for (const k in batches) {
    const b = batches[k]; if (!b.inst.n) continue;
    let t0 = 0, t1 = 0;
    for (let i = 0; i < b.inst.n; i++) { t0 += b.proto0[b.inst.proto[i]].tris; t1 += b.proto1[b.inst.proto[i]].tris; }
    S.per[k] = t0; S.tris0 += t0; S.tris1 += t1; S.draws++;
    for (const m of b.proto0.concat(b.proto1, b.proto2 || [])) S.bytes += m.verts * 36 + m.tris * 12;
    S.bytes += b.inst.n * 76;
  }
  return S;
}

// a stable digest of what was built (determinism): FNV-1a over mm-rounded numbers
function digest(out) {
  let h = 0x811c9dc5;
  const eat = v => { const q = Math.round(v * 1000) | 0; for (let s = 0; s < 32; s += 8) { h ^= (q >>> s) & 255; h = Math.imul(h, 16777619); } };
  for (const k of Object.keys(out.meshes).sort()) { const m = out.meshes[k]; for (const v of m.pos) eat(v); for (const v of m.idx) eat(v / 1000); }
  for (const k of Object.keys(out.batches).sort()) { const b = out.batches[k].inst; for (const v of b.mat) eat(v); for (const v of b.proto) eat(v / 1000); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const WATERFRONT_GEN = { BW_DEF, FD_DEF, BOAT_TYPES, RINGS, breakwater, floatDock, stoneProto, boatProto, line, closest, at, digest, statsOf, viewCost };
if (typeof window !== 'undefined') window.WATERFRONT_GEN = WATERFRONT_GEN;
if (typeof module !== 'undefined' && module.exports) module.exports = WATERFRONT_GEN;
})();
