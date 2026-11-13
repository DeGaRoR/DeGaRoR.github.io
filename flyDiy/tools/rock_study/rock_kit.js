// rock_kit.js - ROCK-STUDY (2026-11-13): A PROCEDURAL ROCK KIT. A rock is a closed shape built from a sphere of
// directions: r(dir) = the soft minimum of an ellipsoid and K planes (the planes are the faces rock breaks along -
// joints, bedding, cleavage - which is what makes a stone read as a stone and not a blob), roughened by a low noise.
// The SAME shape is evaluated on icospheres of three densities, so the LOD rungs are one rock, not three.
//
//   ROCK_KIT.make(THREE, { seeds }) -> [{ arch, seed, size: [x, y, z], lods: [BufferGeometry x 3], tris: [..] }]
//   archetypes (unit frame: y up, +z the face that looks out of the hill, the base at y = 0):
//     boulder  rounded, 7-9 planes cutting it          (talus, the edge, rocky ground)
//     block    six near-axis planes + three random     (jointed outcrop)
//     slab     flat (0.35 tall), plates                 (ledges, scree)
//     cliff    a SHARD for a face: 1 wide, 0.8 tall, 0.4 deep, a flat back and base (they go into the hill), the front cut
//              by vertical joints and tilted beds       (the cliff cover)
//   Each vertex carries aRock: x = how deep it sits in a crease (0 open .. 1 deep, the cheap AO), y = its height in the
//   rock's own box (0 base .. 1 top, the foot's blend into the ground).
'use strict';
var ROCK_KIT = (() => {
  const rnd = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  function icosphere(n) {
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
      .map(v => { const l = Math.hypot(...v); return v.map(c => c / l); });
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let k = 0; k < n; k++) {
      const mid = new Map(), F2 = [];
      const m = (a, b) => { const key = a < b ? a * 100000 + b : b * 100000 + a; let i = mid.get(key); if (i !== undefined) return i;
        const v = [V[a][0] + V[b][0], V[a][1] + V[b][1], V[a][2] + V[b][2]], l = Math.hypot(...v); V.push(v.map(c => c / l)); i = V.length - 1; mid.set(key, i); return i; };
      for (const [a, b, c] of F) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      F = F2;
    }
    return { V, F };
  }
  const SPH = [icosphere(4), icosphere(3), icosphere(2), icosphere(1)];   // 5120 / 1280 / 320 / 80 triangles (the cliff's ladder; the small rocks start a rung down)
  // a small 3D value noise for the roughness
  const hh = (x, y, z, s) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const vn = (x, y, z, s) => { const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = x - X, v = y - Y, w = z - Z, f = t => t * t * (3 - 2 * t);
    const a = f(u), b = f(v), c = f(w); let r = 0;
    for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
      r += hh(X + dx, Y + dy, Z + dz, s) * (dx ? a : 1 - a) * (dy ? b : 1 - b) * (dz ? c : 1 - c);
    return r - 0.5; };
  // the shape: an ellipsoid (radii E) cut by planes [nx, ny, nz, offset], blended by a soft minimum of sharpness K
  function shapeOf(arch, seed) {
    const R = rnd(seed * 7919 + 17); const P = [];
    const plane = (nx, ny, nz, o) => { const l = Math.hypot(nx, ny, nz); P.push([nx / l, ny / l, nz / l, o]); };
    const rdir = () => { const z = R() * 2 - 1, a = R() * 6.2832, s = Math.sqrt(1 - z * z); return [s * Math.cos(a), z, s * Math.sin(a)]; };
    let E, K, rough, base = -0.42;
    if (arch === 'boulder') { E = [1.1, 0.85 + 0.15 * R(), 0.95 + 0.1 * R()]; K = 30; rough = 0.045;
      const n = 10 + Math.floor(R() * 4); for (let i = 0; i < n; i++) { const d = rdir(); plane(d[0], d[1] * 0.8, d[2], 0.55 + 0.3 * R()); } }
    else if (arch === 'block') { E = [1.3, 1.1, 1.2]; K = 45; rough = 0.03;
      const yaw = R() * 0.5; const c = Math.cos(yaw), s = Math.sin(yaw);
      for (const [x, y, z] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) {
        const j = () => (R() - 0.5) * 0.5; plane(x * c - z * s + j(), y + j(), x * s + z * c + j(), 0.5 + 0.25 * R()); }
      for (let i = 0; i < 6; i++) { const d = rdir(); plane(d[0], d[1], d[2], 0.6 + 0.25 * R()); } }
    else if (arch === 'slab') { E = [1.1, 0.42, 0.9]; K = 22; rough = 0.03; base = -0.2;
      plane((R() - 0.5) * 0.3, 1, (R() - 0.5) * 0.3, 0.22 + 0.06 * R());
      for (let i = 0; i < 6; i++) { const a = R() * 6.2832; plane(Math.cos(a), (R() - 0.5) * 0.6, Math.sin(a), 0.6 + 0.25 * R()); } }
    else {   // cliff shard
      E = [1.5, 1.35, 0.9]; K = 60; rough = 0.025; base = -0.6;
      plane(0, 0, -1, 0.18);                                      // the flat back: into the hill
      for (let i = 0; i < 9; i++) { const a = (R() - 0.5) * 2.0; plane(Math.sin(a), (R() - 0.5) * 0.5, Math.cos(a), 0.26 + 0.2 * R()); }   // joints across the front
      for (let i = 0; i < 4; i++) { const a = (R() - 0.5) * 1.2; plane((R() - 0.5) * 0.5, 1, Math.sin(a) * 0.9, 0.35 + 0.35 * R()); }      // tilted beds: the top's ledges
      for (let i = 0; i < 3; i++) { const a = (R() - 0.5) * 1.0; plane((R() - 0.5) * 0.5, -1, Math.sin(a) * 0.9 + 0.3, 0.45 + 0.3 * R()); }  // the underside's beds
      for (let i = 0; i < 2; i++) { const a = (R() - 0.5) * 1.2; plane(Math.cos(a) * (i ? 1 : -1), 0.15 * (R() - 0.5), Math.sin(a) * 0.4, 0.7 + 0.25 * R()); }   // the ends
    }
    plane(0, -1, 0, -base);   // the base: flat (it is buried)
    return { E, K, rough, P, base };
  }
  function radius(S, d, seed) {
    const re = 1 / Math.sqrt((d[0] / S.E[0]) ** 2 + (d[1] / S.E[1]) ** 2 + (d[2] / S.E[2]) ** 2);
    let sum = Math.exp(-S.K * re), mn = re;
    for (const p of S.P) { const c = d[0] * p[0] + d[1] * p[1] + d[2] * p[2]; if (c > 1e-3) { const t = p[3] / c; sum += Math.exp(-S.K * t); if (t < mn) mn = t; } }
    let r = -Math.log(sum) / S.K; if (!isFinite(r)) r = mn;
    const q = 2.3;
    r *= 1 + S.rough * (vn(d[0] * q + 9, d[1] * q, d[2] * q, seed) * 2 + vn(d[0] * q * 3, d[1] * q * 3, d[2] * q * 3 + 5, seed) * 0.8);
    return { r, crease: Math.max(0, Math.min(1, (re - r) / re)) };
  }
  function build(THREE, arch, seed) {
    const S = shapeOf(arch, seed);
    const first = arch === 'cliff' ? 0 : 1;   // a small rock's finest rung is the 1280 sphere
    const lods = [], raw = [];
    for (let L = 0; L < 4; L++) {
      const sph = SPH[Math.min(3, first + L)];
      const pos = new Float32Array(sph.V.length * 3), rk = new Float32Array(sph.V.length * 2);
      let y0 = 1e9, y1 = -1e9;
      sph.V.forEach((d, i) => { const { r, crease } = radius(S, d, seed); pos[i * 3] = d[0] * r; pos[i * 3 + 1] = d[1] * r; pos[i * 3 + 2] = d[2] * r; rk[i * 2] = crease; y0 = Math.min(y0, pos[i * 3 + 1]); y1 = Math.max(y1, pos[i * 3 + 1]); });
      for (let i = 0; i < sph.V.length; i++) { pos[i * 3 + 1] -= y0; rk[i * 2 + 1] = pos[i * 3 + 1] / (y1 - y0); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRock', new THREE.BufferAttribute(rk, 2));
      g.setIndex(sph.F.flat()); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
      lods.push(g); raw.push(sph.F.length);
    }
    const bb = lods[0].boundingBox; const size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
    return { arch, seed, size, lods, tris: raw };
  }
  function make(THREE, opt) {
    const n = (opt && opt.seeds) || 4, out = [];
    for (const arch of ['cliff', 'block', 'boulder', 'slab']) for (let s = 0; s < n; s++) out.push(build(THREE, arch, s + 1));
    return out;
  }
  return { make, shapeOf, radius };
})();
if (typeof window !== 'undefined') window.ROCK_KIT = ROCK_KIT;
