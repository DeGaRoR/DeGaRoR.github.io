// MESH QUERY — signed distance, ray parity and edge crossings over a
// triangle set (GATE CLIP, P0). Pure; loads in node and the browser.
//
// THE QUESTION IS "HOW FAR INSIDE THE DRAWN SKIN IS THIS VERTEX", and the
// instrument that answers it has to be the MESH, not the airframe table:
// meshAirframe interpolates a 96x72 ray-cast and is ±3.5 mm off across a
// crease (tools/_strut_gen.js:221), which is more than the 0.4-0.8 mm a
// fitting stands proud by. So: an AABB tree over the triangles, the nearest
// point on the surface, and the SIGN from the angle-weighted pseudonormal of
// the feature the nearest point lies on (face, edge or vertex — Baerentzen &
// Aanaes 2005). That sign is exact for a closed mesh and, unlike ray parity
// or the winding number, stays meaningful on an OPEN one: a deleted door, a
// knife-cut window or a bare frame just contribute boundary edges, and a
// point beside a hole reads its distance to the nearest real skin.
//
//   triSet({ V, F, scale, welded })  -> a set from cage-style V/F (quads ok)
//   triSetFromThree(mesh, THREE)     -> from a THREE.Mesh in WORLD space
//   set.signedDist(p, rMax)          -> { d, c, tri, region }  (d < 0 inside)
//   set.nearest(p, rMax)             -> the same, unsigned
//   set.rayHits(o, dir, tMax)        -> number of crossings
//   set.inside(p)                    -> parity vote of three axis rays
//   set.segmentHits(a, b)            -> true if the segment crosses a face
//   set.orient()                     -> makes the winding consistent per
//                                       component and outward by the
//                                       farthest-vertex rule; returns counts
'use strict';
(() => {
const EPS = 1e-12;

// ---- Ericson, closest point on a triangle, WITH the feature it lies on -----
// region: 0 face, 1 edge ab, 2 edge bc, 3 edge ca, 4 vertex a, 5 b, 6 c
function closestPtTri(p, a, b, c, out) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
  const apx = p[0] - a[0], apy = p[1] - a[1], apz = p[2] - a[2];
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return 4; }
  const bpx = p[0] - b[0], bpy = p[1] - b[1], bpz = p[2] - b[2];
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { out[0] = b[0]; out[1] = b[1]; out[2] = b[2]; return 5; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    out[0] = a[0] + abx * v; out[1] = a[1] + aby * v; out[2] = a[2] + abz * v;
    return 1;
  }
  const cpx = p[0] - c[0], cpy = p[1] - c[1], cpz = p[2] - c[2];
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; return 6; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    out[0] = a[0] + acx * w; out[1] = a[1] + acy * w; out[2] = a[2] + acz * w;
    return 3;
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    out[0] = b[0] + (c[0] - b[0]) * w; out[1] = b[1] + (c[1] - b[1]) * w; out[2] = b[2] + (c[2] - b[2]) * w;
    return 2;
  }
  const den = 1 / (va + vb + vc);
  const v = vb * den, w = vc * den;
  out[0] = a[0] + abx * v + acx * w; out[1] = a[1] + aby * v + acy * w; out[2] = a[2] + abz * v + acz * w;
  return 0;
}

// Moller-Trumbore, both faces, t in (0, tMax)
function rayTri(o, d, a, b, c, tMax) {
  const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
  const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
  const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (det > -EPS && det < EPS) return -1;
  const inv = 1 / det;
  const tx = o[0] - a[0], ty = o[1] - a[1], tz = o[2] - a[2];
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return -1;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
  if (v < 0 || u + v > 1) return -1;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return (t > EPS && t < tMax) ? t : -1;
}

// ---- the set ---------------------------------------------------------------
function weld(P, I, q) {
  const n = P.length / 3, map = new Map(), remap = new Int32Array(n), out = [];
  const Q = q || 1e-6;
  for (let i = 0; i < n; i++) {
    const k = Math.round(P[3 * i] / Q) + ',' + Math.round(P[3 * i + 1] / Q) + ',' + Math.round(P[3 * i + 2] / Q);
    let j = map.get(k);
    if (j === undefined) { j = out.length / 3; map.set(k, j); out.push(P[3 * i], P[3 * i + 1], P[3 * i + 2]); }
    remap[i] = j;
  }
  const I2 = new Uint32Array(I.length);
  for (let i = 0; i < I.length; i++) I2[i] = remap[I[i]];
  return { P: Float64Array.from(out), I: I2 };
}

function build(P, I, opts) {
  opts = opts || {};
  if (!opts.welded) ({ P, I } = weld(P, I, opts.quant));
  // drop degenerate triangles: they have no normal and no interior
  const keep = [], kept = [];
  for (let t = 0; t < I.length / 3; t++) {
    const a = I[3 * t], b = I[3 * t + 1], c = I[3 * t + 2];
    if (a === b || b === c || c === a) continue;
    const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2];
    const ux = P[3 * b] - ax, uy = P[3 * b + 1] - ay, uz = P[3 * b + 2] - az;
    const vx = P[3 * c] - ax, vy = P[3 * c + 1] - ay, vz = P[3 * c + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-20) continue;
    keep.push(a, b, c); kept.push(t);
  }
  I = Uint32Array.from(keep);
  const S = { P, I, nt: I.length / 3, nv: P.length / 3, keptFrom: kept };
  S.normals = null; S.tree = null;
  Object.assign(S, METHODS);
  S.buildTree();
  return S;
}

const METHODS = {
  vert(i, out) { out[0] = this.P[3 * i]; out[1] = this.P[3 * i + 1]; out[2] = this.P[3 * i + 2]; return out; },
  triVerts(t) {
    const P = this.P, I = this.I;
    const a = I[3 * t], b = I[3 * t + 1], c = I[3 * t + 2];
    return [[P[3 * a], P[3 * a + 1], P[3 * a + 2]], [P[3 * b], P[3 * b + 1], P[3 * b + 2]], [P[3 * c], P[3 * c + 1], P[3 * c + 2]]];
  },
  // ---- the tree: median split on the longest axis, leaves of <= 6 -------
  buildTree() {
    const nt = this.nt, P = this.P, I = this.I;
    const cen = new Float64Array(nt * 3), tb = new Float64Array(nt * 6);
    for (let t = 0; t < nt; t++) {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let k = 0; k < 3; k++) {
        const v = I[3 * t + k];
        const x = P[3 * v], y = P[3 * v + 1], z = P[3 * v + 2];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      tb[6 * t] = x0; tb[6 * t + 1] = y0; tb[6 * t + 2] = z0; tb[6 * t + 3] = x1; tb[6 * t + 4] = y1; tb[6 * t + 5] = z1;
      cen[3 * t] = (x0 + x1) * 0.5; cen[3 * t + 1] = (y0 + y1) * 0.5; cen[3 * t + 2] = (z0 + z1) * 0.5;
    }
    const order = new Uint32Array(nt); for (let t = 0; t < nt; t++) order[t] = t;
    const nodes = [];                       // {b:[6], l, r, s, n}
    const rec = (s, n) => {
      const id = nodes.length;
      const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let i = s; i < s + n; i++) {
        const t = order[i];
        for (let k = 0; k < 3; k++) { if (tb[6 * t + k] < b[k]) b[k] = tb[6 * t + k]; if (tb[6 * t + 3 + k] > b[3 + k]) b[3 + k] = tb[6 * t + 3 + k]; }
      }
      const node = { b, l: -1, r: -1, s, n };
      nodes.push(node);
      if (n <= 6) return id;
      let ax = 0, best = b[3] - b[0];
      if (b[4] - b[1] > best) { ax = 1; best = b[4] - b[1]; }
      if (b[5] - b[2] > best) ax = 2;
      const sub = Array.from(order.subarray(s, s + n));
      sub.sort((p, q) => cen[3 * p + ax] - cen[3 * q + ax]);
      for (let i = 0; i < n; i++) order[s + i] = sub[i];
      const h = n >> 1;
      node.l = rec(s, h); node.r = rec(s + h, n - h);
      return id;
    };
    rec(0, nt);
    this.tree = { nodes, order, tb };
    return this;
  },
  // ---- pseudonormals, computed once, lazily ------------------------------
  computeNormals() {
    const nt = this.nt, nv = this.nv, P = this.P, I = this.I;
    const FN = new Float64Array(nt * 3), VN = new Float64Array(nv * 3);
    const EN = new Map();
    const ekey = (a, b) => a < b ? a * nv + b : b * nv + a;
    for (let t = 0; t < nt; t++) {
      const ia = I[3 * t], ib = I[3 * t + 1], ic = I[3 * t + 2];
      const ax = P[3 * ia], ay = P[3 * ia + 1], az = P[3 * ia + 2];
      const bx = P[3 * ib], by = P[3 * ib + 1], bz = P[3 * ib + 2];
      const cx = P[3 * ic], cy = P[3 * ic + 1], cz = P[3 * ic + 2];
      let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      FN[3 * t] = nx; FN[3 * t + 1] = ny; FN[3 * t + 2] = nz;
      // angle-weighted vertex normals
      const vs = [[ia, ib, ic], [ib, ic, ia], [ic, ia, ib]];
      for (const [v, u, w] of vs) {
        const ux = P[3 * u] - P[3 * v], uy = P[3 * u + 1] - P[3 * v + 1], uz = P[3 * u + 2] - P[3 * v + 2];
        const wx = P[3 * w] - P[3 * v], wy = P[3 * w + 1] - P[3 * v + 1], wz = P[3 * w + 2] - P[3 * v + 2];
        const lu = Math.hypot(ux, uy, uz) || 1, lw = Math.hypot(wx, wy, wz) || 1;
        const cs = Math.max(-1, Math.min(1, (ux * wx + uy * wy + uz * wz) / (lu * lw)));
        const ang = Math.acos(cs);
        VN[3 * v] += nx * ang; VN[3 * v + 1] += ny * ang; VN[3 * v + 2] += nz * ang;
      }
      for (const [a, b, w] of [[ia, ib, ic], [ib, ic, ia], [ic, ia, ib]]) {
        const k = ekey(a, b);
        const e = EN.get(k);
        if (e) { e[0] += nx; e[1] += ny; e[2] += nz; e[3]++; }
        else EN.set(k, [nx, ny, nz, 1, a, b, w]);
      }
    }
    // A RIM DOES NOT VOTE BEYOND ITSELF. With one face only, the
    // pseudonormal of a boundary edge is that face's normal, and a point past
    // the rim in the plane of the missing skin would read "inside" (an open
    // wing panel read the whole span inboard of its root as inside — 0.89 m
    // deep). So every boundary edge, and every vertex on one, also carries
    // the in-plane direction AWAY from its face; signedDist reads a rim
    // feature's sign only for a point on the face's side of the rim, and
    // calls a point beyond it outside. A doorway's hole, a knife window and an
    // open loft end all behave: inside the skin next to the hole still reads
    // inside, over the hole reads outside.
    const VOUT = new Map();
    for (const e of EN.values()) {
      if (e[3] !== 1) continue;
      const a = e[4], b = e[5], w = e[6];
      const mx = (P[3 * a] + P[3 * b]) * 0.5, my = (P[3 * a + 1] + P[3 * b + 1]) * 0.5, mz = (P[3 * a + 2] + P[3 * b + 2]) * 0.5;
      let ex = P[3 * b] - P[3 * a], ey = P[3 * b + 1] - P[3 * a + 1], ez = P[3 * b + 2] - P[3 * a + 2];
      const le = Math.hypot(ex, ey, ez) || 1; ex /= le; ey /= le; ez /= le;
      let ox = mx - P[3 * w], oy = my - P[3 * w + 1], oz = mz - P[3 * w + 2];
      const dd = ox * ex + oy * ey + oz * ez; ox -= dd * ex; oy -= dd * ey; oz -= dd * ez;
      const lo = Math.hypot(ox, oy, oz) || 1; ox /= lo; oy /= lo; oz /= lo;
      e[7] = ox; e[8] = oy; e[9] = oz;
      for (const v of [a, b]) {
        const q = VOUT.get(v);
        if (q) { q[0] += ox; q[1] += oy; q[2] += oz; } else VOUT.set(v, [ox, oy, oz]);
      }
    }
    this.normals = { FN, VN, EN, VOUT, ekey };
    return this;
  },
  // ---- nearest point, branch and bound over the tree ---------------------
  nearest(p, rMax) {
    const { nodes, order } = this.tree, P = this.P, I = this.I;
    let best = (rMax == null ? Infinity : rMax * rMax), bt = -1, breg = 0;
    const bc = [0, 0, 0], tmp = [0, 0, 0];
    const boxD2 = b => {
      let d = 0;
      for (let k = 0; k < 3; k++) { const v = p[k]; if (v < b[k]) d += (b[k] - v) ** 2; else if (v > b[3 + k]) d += (v - b[3 + k]) ** 2; }
      return d;
    };
    const stack = [0];
    while (stack.length) {
      const id = stack.pop(), nd = nodes[id];
      if (boxD2(nd.b) >= best) continue;
      if (nd.l < 0) {
        for (let i = nd.s; i < nd.s + nd.n; i++) {
          const t = order[i];
          const ia = I[3 * t], ib = I[3 * t + 1], ic = I[3 * t + 2];
          const a = [P[3 * ia], P[3 * ia + 1], P[3 * ia + 2]];
          const b = [P[3 * ib], P[3 * ib + 1], P[3 * ib + 2]];
          const c = [P[3 * ic], P[3 * ic + 1], P[3 * ic + 2]];
          const reg = closestPtTri(p, a, b, c, tmp);
          const d2 = (tmp[0] - p[0]) ** 2 + (tmp[1] - p[1]) ** 2 + (tmp[2] - p[2]) ** 2;
          if (d2 < best) { best = d2; bt = t; breg = reg; bc[0] = tmp[0]; bc[1] = tmp[1]; bc[2] = tmp[2]; }
        }
      } else {
        const dl = boxD2(nodes[nd.l].b), dr = boxD2(nodes[nd.r].b);
        if (dl < dr) { stack.push(nd.r); stack.push(nd.l); } else { stack.push(nd.l); stack.push(nd.r); }
      }
    }
    if (bt < 0) return null;
    return { d: Math.sqrt(best), c: bc, tri: bt, region: breg };
  },
  // the feature's pseudonormal, unnormalised (its sign is all that is read)
  // the feature's pseudonormal, unnormalised, and — on a rim — the in-plane
  // direction away from the mesh
  featureNormal(tri, region) {
    if (!this.normals) this.computeNormals();
    const { FN, VN, EN, VOUT, ekey } = this.normals, I = this.I;
    if (region === 0) return { n: [FN[3 * tri], FN[3 * tri + 1], FN[3 * tri + 2]], out: null };
    const ia = I[3 * tri], ib = I[3 * tri + 1], ic = I[3 * tri + 2];
    if (region >= 4) {
      const v = [ia, ib, ic][region - 4];
      return { n: [VN[3 * v], VN[3 * v + 1], VN[3 * v + 2]], out: VOUT.get(v) || null };
    }
    const [a, b] = [[ia, ib], [ib, ic], [ic, ia]][region - 1];
    const e = EN.get(ekey(a, b));
    return { n: [e[0], e[1], e[2]], out: e[3] === 1 ? [e[7], e[8], e[9]] : null };
  },
  signedDist(p, rMax) {
    const q = this.nearest(p, rMax);
    if (!q) return null;
    const { n, out } = this.featureNormal(q.tri, q.region);
    const dx = p[0] - q.c[0], dy = p[1] - q.c[1], dz = p[2] - q.c[2];
    const beyond = out && (dx * out[0] + dy * out[1] + dz * out[2]) > 1e-9;
    const s = dx * n[0] + dy * n[1] + dz * n[2];
    q.d = (s < 0 && !beyond) ? -q.d : q.d;
    q.n = n; q.rim = !!out; q.beyond = !!beyond;
    return q;
  },
  // ---- rays and segments ---------------------------------------------------
  rayHits(o, d, tMax) {
    const { nodes, order } = this.tree, P = this.P, I = this.I;
    tMax = tMax == null ? Infinity : tMax;
    const inv = [1 / d[0], 1 / d[1], 1 / d[2]];
    const hitBox = b => {
      let t0 = 0, t1 = tMax;
      for (let k = 0; k < 3; k++) {
        let a = (b[k] - o[k]) * inv[k], c = (b[3 + k] - o[k]) * inv[k];
        if (a > c) { const s = a; a = c; c = s; }
        if (a > t0) t0 = a; if (c < t1) t1 = c;
        if (t0 > t1) return false;
      }
      return true;
    };
    let n = 0;
    const stack = [0];
    while (stack.length) {
      const nd = nodes[stack.pop()];
      if (!hitBox(nd.b)) continue;
      if (nd.l < 0) {
        for (let i = nd.s; i < nd.s + nd.n; i++) {
          const t = order[i];
          const ia = I[3 * t], ib = I[3 * t + 1], ic = I[3 * t + 2];
          const a = [P[3 * ia], P[3 * ia + 1], P[3 * ia + 2]];
          const b = [P[3 * ib], P[3 * ib + 1], P[3 * ib + 2]];
          const c = [P[3 * ic], P[3 * ic + 1], P[3 * ic + 2]];
          if (rayTri(o, d, a, b, c, tMax) > 0) n++;
        }
      } else { stack.push(nd.l); stack.push(nd.r); }
    }
    return n;
  },
  // three axis rays, majority vote — no orientation needed, tolerant of one
  // missing cap; the directions are slightly skewed so a ray never runs
  // along a shared edge of an axis-aligned mesh
  inside(p) {
    const D = [[0.9805, 0.1961, 0.0196], [0.0196, 0.9805, 0.1961], [0.1961, 0.0196, 0.9805]];
    let odd = 0;
    for (const d of D) if (this.rayHits(p, d) % 2 === 1) odd++;
    return odd >= 2;
  },
  segmentHits(a, b) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(d[0], d[1], d[2]);
    if (L < EPS) return false;
    return this.rayHits(a, [d[0] / L, d[1] / L, d[2] / L], L) > 0;
  },
  bounds() {
    return this.tree.nodes[0].b.slice();
  },
  // ---- orientation: consistent winding per component, outward ------------
  orient() {
    const nt = this.nt, nv = this.nv, I = this.I, P = this.P;
    const ekey = (a, b) => a < b ? a * nv + b : b * nv + a;
    const adj = new Map();                    // edge -> [tri, ...]
    for (let t = 0; t < nt; t++)
      for (let k = 0; k < 3; k++) {
        const key = ekey(I[3 * t + k], I[3 * t + (k + 1) % 3]);
        const l = adj.get(key); if (l) l.push(t); else adj.set(key, [t]);
      }
    const seen = new Uint8Array(nt);
    const compOf = new Int32Array(nt), compBox = [];
    let flipped = 0, comps = 0, outFlips = 0;
    const dirOf = (t, a, b) => {           // +1 if tri t walks a->b
      for (let k = 0; k < 3; k++) if (I[3 * t + k] === a && I[3 * t + (k + 1) % 3] === b) return 1;
      return -1;
    };
    const flip = t => { const s = I[3 * t + 1]; I[3 * t + 1] = I[3 * t + 2]; I[3 * t + 2] = s; flipped++; };
    for (let t0 = 0; t0 < nt; t0++) {
      if (seen[t0]) continue;
      comps++;
      const comp = [t0]; seen[t0] = 1;
      const q = [t0];
      while (q.length) {
        const t = q.pop();
        for (let k = 0; k < 3; k++) {
          const a = I[3 * t + k], b = I[3 * t + (k + 1) % 3];
          const l = adj.get(ekey(a, b));
          if (l.length !== 2) continue;      // boundary or non-manifold: no vote
          const u = l[0] === t ? l[1] : l[0];
          if (seen[u]) continue;
          if (dirOf(u, a, b) === 1) flip(u);   // same direction = inconsistent
          seen[u] = 1; comp.push(u); q.push(u);
        }
      }
      // outward: the component's farthest vertex from its centroid should
      // see its faces' normals pointing away from the centroid
      let cx = 0, cy = 0, cz = 0, n = 0;
      const vs = new Set();
      for (const t of comp) for (let k = 0; k < 3; k++) vs.add(I[3 * t + k]);
      for (const v of vs) { cx += P[3 * v]; cy += P[3 * v + 1]; cz += P[3 * v + 2]; n++; }
      cx /= n; cy /= n; cz /= n;
      let far = -1, fd = -1;
      for (const v of vs) { const d = (P[3 * v] - cx) ** 2 + (P[3 * v + 1] - cy) ** 2 + (P[3 * v + 2] - cz) ** 2; if (d > fd) { fd = d; far = v; } }
      let vote = 0;
      for (const t of comp) {
        const ia = I[3 * t], ib = I[3 * t + 1], ic = I[3 * t + 2];
        if (ia !== far && ib !== far && ic !== far) continue;
        const ax = P[3 * ia], ay = P[3 * ia + 1], az = P[3 * ia + 2];
        const nx = (P[3 * ib + 1] - ay) * (P[3 * ic + 2] - az) - (P[3 * ib + 2] - az) * (P[3 * ic + 1] - ay);
        const ny = (P[3 * ib + 2] - az) * (P[3 * ic] - ax) - (P[3 * ib] - ax) * (P[3 * ic + 2] - az);
        const nz = (P[3 * ib] - ax) * (P[3 * ic + 1] - ay) - (P[3 * ib + 1] - ay) * (P[3 * ic] - ax);
        vote += nx * (P[3 * far] - cx) + ny * (P[3 * far + 1] - cy) + nz * (P[3 * far + 2] - cz);
      }
      if (vote < 0) { for (const t of comp) flip(t); outFlips++; }
      const cb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (const v of vs) for (let k = 0; k < 3; k++) { const x = P[3 * v + k]; if (x < cb[k]) cb[k] = x; if (x > cb[3 + k]) cb[3 + k] = x; }
      for (const t of comp) compOf[t] = compBox.length;
      compBox.push(cb);
    }
    this.compOf = compOf; this.compBox = compBox;
    this.normals = null;
    return { flipped, comps, outFlips };
  },
};

// ---- constructors ----------------------------------------------------------
// cage-style { V: [[x,y,z]], F: [[i,j,k(,l)]] } (+ optional face filter), scaled
function triSet(m, opts) {
  opts = opts || {};
  const s = opts.scale || 1, keep = opts.faces;
  const P = new Float64Array(m.V.length * 3);
  for (let i = 0; i < m.V.length; i++) { P[3 * i] = m.V[i][0] * s; P[3 * i + 1] = m.V[i][1] * s; P[3 * i + 2] = m.V[i][2] * s; }
  const I = [];
  const src = [];
  m.F.forEach((f, fi) => {
    if (keep && !keep(f, fi)) return;
    const v = f.v || f;
    for (let k = 1; k + 1 < v.length; k++) { I.push(v[0], v[k], v[k + 1]); src.push(fi); }
  });
  const S = build(P, Uint32Array.from(I), { welded: true });
  S.faceOf = S.keptFrom.map(t => src[t]);    // triangle -> source face index
  return S;
}

// a THREE.Mesh (or a list of meshes) in world coordinates
function triSetFromThree(meshes, THREE, opts) {
  const list = Array.isArray(meshes) ? meshes : [meshes];
  const P = [], I = [];
  const v = new THREE.Vector3();
  const owner = [];
  for (const m of list) {
    const g = m.geometry, pos = g.attributes.position, idx = g.index;
    m.updateWorldMatrix(true, false);
    const base = P.length / 3;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      P.push(v.x, v.y, v.z);
    }
    const n = idx ? idx.count : pos.count;
    const tri0 = I.length / 3;
    for (let i = 0; i < n; i++) I.push(base + (idx ? idx.getX(i) : i));
    owner.push({ mesh: m, t0: tri0, t1: I.length / 3 });
  }
  const S = build(Float64Array.from(P), Uint32Array.from(I), opts);
  // triangle -> the mesh it came from (through the degenerate drop)
  S.ownerOf = new Int32Array(S.nt);
  for (let t = 0; t < S.nt; t++) {
    const o = S.keptFrom[t];
    let k = 0; while (k + 1 < owner.length && o >= owner[k].t1) k++;
    S.ownerOf[t] = k;
  }
  S.owner = owner;
  return S;
}

const API = { triSet, triSetFromThree, build, closestPtTri, rayTri, weld };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.MESH_QUERY = API;
})();
