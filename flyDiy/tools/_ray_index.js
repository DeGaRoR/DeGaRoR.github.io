// _ray_index.js - THE RAY INDEX (G1281, GARAGE-LAG 2026-10-03): three's Mesh raycast, the same answers, without
// testing every triangle.
//
// The user: "the garage has become sluggish ... the update time when changing plane parameters" - and "we aim for
// instantaneous feeling". Measured on the box (tools/perf/garage_lag.js, a CPU profile inside one slider tick): about
// HALF of every editor build was three's brute-force raycast - Mesh._computeIntersections walks EVERY triangle of a
// mesh for every ray, and the layers ask thousands: the wing's overAt/underAt probes (the tip light's outline walk,
// G-A7: ~200 ms a tick on the Cub), the hinges' sheet probes, the gear's pads, the crew's floor rays. 400 of the
// Cub's ~790 ms (dev.html), 150 of the metal Cessna's ~710.
//
// THE SAME DOOR, NOT A SECOND ESTIMATE: nothing here computes an intersection. A geometry asked often enough gets a
// bounding-volume hierarchy over its triangles' boxes (built once per geometry and per position/index version, kept
// in a WeakMap on the geometry); a ray walks it to the triangles whose (padded) box it meets - a triangle whose box the
// ray misses cannot be hit - and three's OWN _computeIntersections then runs over exactly those triangles, in their
// original order, through a view of the geometry whose index holds only them; each hit's faceIndex is mapped back.
// So every hit is three's arithmetic on three's triangle, the list is the same list in the same order (the caller's
// sort by distance is stable), and a mesh this cannot vouch for takes the untouched path:
//   - a material array (groups carry materialIndex), a skinned mesh, morph targets, a partial draw range
//     (a BatchedMesh's per-instance raycast), fewer than MIN_TRIS triangles;
//   - the first WARM asks of a geometry's version (a one-off ray never pays for an index).
// GATE RAYINDEX (tools/_rayindex_check.js) walks both ways - indexed and brute force - over real meshes and random,
// axis-aligned, grazing and inside-the-box rays, and asserts the hit lists equal field by field.
// RAY_INDEX.on = false (or ?rayindex=0) is the old path, for an A/B.
(function (root) {
  'use strict';
  const MIN_TRIS = 64, WARM = 2, LEAF = 6;
  function install(THREE) {
    if (!THREE || !THREE.Mesh || !THREE.Mesh.prototype._computeIntersections) return null;
    const MP = THREE.Mesh.prototype;
    if (MP._computeIntersections.__rayIndex) return MP._computeIntersections.__rayIndex;
    const orig = MP._computeIntersections;
    const IDX = new WeakMap();
    const RI = { on: true, built: 0, asks: 0, fast: 0, MIN_TRIS, WARM, orig };
    try { if (root.location && /[?&]rayindex=0\b/.test(root.location.search)) RI.on = false; } catch (e) {}
    const verOf = a => (a ? (a.isInterleavedBufferAttribute ? a.data.version : a.version) : -1);

    // the hierarchy: nodes in flat arrays (box min/max, then either two children or a leaf's run of triangle ids)
    function build(g, nT) {
      const pos = g.attributes.position, idx = g.index;
      const bx = new Float64Array(nT * 6), cx = new Float64Array(nT * 3);
      let lo0 = Infinity, lo1 = Infinity, lo2 = Infinity, hi0 = -Infinity, hi1 = -Infinity, hi2 = -Infinity;
      for (let t = 0; t < nT; t++) {
        let a0 = Infinity, a1 = Infinity, a2 = Infinity, b0 = -Infinity, b1 = -Infinity, b2 = -Infinity;
        for (let k = 0; k < 3; k++) {
          const v = idx ? idx.getX(t * 3 + k) : t * 3 + k;
          const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
          if (x < a0) a0 = x; if (x > b0) b0 = x; if (y < a1) a1 = y; if (y > b1) b1 = y; if (z < a2) a2 = z; if (z > b2) b2 = z;
        }
        const o = t * 6; bx[o] = a0; bx[o + 1] = a1; bx[o + 2] = a2; bx[o + 3] = b0; bx[o + 4] = b1; bx[o + 5] = b2;
        cx[t * 3] = (a0 + b0) / 2; cx[t * 3 + 1] = (a1 + b1) / 2; cx[t * 3 + 2] = (a2 + b2) / 2;
        if (a0 < lo0) lo0 = a0; if (a1 < lo1) lo1 = a1; if (a2 < lo2) lo2 = a2; if (b0 > hi0) hi0 = b0; if (b1 > hi1) hi1 = b1; if (b2 > hi2) hi2 = b2;
      }
      // the pad: far past float rounding at the model's own scale (a hit three computes on a triangle's edge can sit a
      // rounding outside its box) and far below anything that is geometry
      const ext = Math.max(hi0 - lo0, hi1 - lo1, hi2 - lo2, Math.abs(lo0), Math.abs(lo1), Math.abs(lo2), Math.abs(hi0), Math.abs(hi1), Math.abs(hi2));
      const pad = (isFinite(ext) ? ext : 1) * 1e-6 + 1e-9;
      const ids = new Uint32Array(nT); for (let t = 0; t < nT; t++) ids[t] = t;
      const nb = [], kids = [];                   // nb: 6 per node; kids: [left, right] or [-1 - start, count]
      const node = (s, e) => {
        const n = kids.length / 2; kids.push(0, 0); nb.push(0, 0, 0, 0, 0, 0);
        let a0 = Infinity, a1 = Infinity, a2 = Infinity, b0 = -Infinity, b1 = -Infinity, b2 = -Infinity;
        let c0 = Infinity, c1 = Infinity, c2 = Infinity, d0 = -Infinity, d1 = -Infinity, d2 = -Infinity;
        for (let i = s; i < e; i++) {
          const o = ids[i] * 6, q = ids[i] * 3;
          if (bx[o] < a0) a0 = bx[o]; if (bx[o + 1] < a1) a1 = bx[o + 1]; if (bx[o + 2] < a2) a2 = bx[o + 2];
          if (bx[o + 3] > b0) b0 = bx[o + 3]; if (bx[o + 4] > b1) b1 = bx[o + 4]; if (bx[o + 5] > b2) b2 = bx[o + 5];
          if (cx[q] < c0) c0 = cx[q]; if (cx[q] > d0) d0 = cx[q]; if (cx[q + 1] < c1) c1 = cx[q + 1]; if (cx[q + 1] > d1) d1 = cx[q + 1];
          if (cx[q + 2] < c2) c2 = cx[q + 2]; if (cx[q + 2] > d2) d2 = cx[q + 2];
        }
        const o = n * 6; nb[o] = a0 - pad; nb[o + 1] = a1 - pad; nb[o + 2] = a2 - pad; nb[o + 3] = b0 + pad; nb[o + 4] = b1 + pad; nb[o + 5] = b2 + pad;
        const sx = d0 - c0, sy = d1 - c1, sz = d2 - c2;
        if (e - s <= LEAF || !(Math.max(sx, sy, sz) > 0)) { kids[n * 2] = -1 - s; kids[n * 2 + 1] = e - s; return n; }
        const ax = sx >= sy && sx >= sz ? 0 : sy >= sz ? 1 : 2, mid = ax === 0 ? (c0 + d0) / 2 : ax === 1 ? (c1 + d1) / 2 : (c2 + d2) / 2;
        let i = s, j = e - 1;                     // partition about the centroids' midpoint on the widest axis
        while (i <= j) { if (cx[ids[i] * 3 + ax] < mid) i++; else { const t = ids[i]; ids[i] = ids[j]; ids[j] = t; j--; } }
        let m = i; if (m === s || m === e) m = (s + e) >> 1;
        const l = node(s, m), r = node(m, e);
        kids[n * 2] = l; kids[n * 2 + 1] = r; return n;
      };
      node(0, nT);
      return { nb: new Float64Array(nb), kids: new Int32Array(kids), ids, nT };
    }
    // the triangles whose padded box the ray meets (t >= 0, unbounded: three's own near/far apply after), ascending
    function cands(B, ray) {
      const o = ray.origin, d = ray.direction;
      const ix = 1 / d.x, iy = 1 / d.y, iz = 1 / d.z;
      const out = [], st = [0], nb = B.nb, kids = B.kids;
      while (st.length) {
        const n = st.pop(), q = n * 6;
        let t0 = 0, t1 = Infinity;
        // slabs; a zero direction component is inside-or-out on that axis
        if (d.x !== 0) { let a = (nb[q] - o.x) * ix, b = (nb[q + 3] - o.x) * ix; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; }
        else if (o.x < nb[q] || o.x > nb[q + 3]) continue;
        if (d.y !== 0) { let a = (nb[q + 1] - o.y) * iy, b = (nb[q + 4] - o.y) * iy; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; }
        else if (o.y < nb[q + 1] || o.y > nb[q + 4]) continue;
        if (d.z !== 0) { let a = (nb[q + 2] - o.z) * iz, b = (nb[q + 5] - o.z) * iz; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; }
        else if (o.z < nb[q + 2] || o.z > nb[q + 5]) continue;
        if (!(t0 <= t1)) continue;
        const k = kids[n * 2];
        if (k < 0) { const s = -1 - k, c = kids[n * 2 + 1]; for (let i = s; i < s + c; i++) out.push(B.ids[i]); }
        else { st.push(k, kids[n * 2 + 1]); }
      }
      return out.sort((a, b) => a - b);
    }
    MP._computeIntersections = function (raycaster, intersects, rayLocal) {
      const g = this.geometry, A = g && g.attributes, pos = A && A.position;
      if (!RI.on || !pos || Array.isArray(this.material) || this.isSkinnedMesh ||
          (g.morphAttributes && g.morphAttributes.position && g.morphAttributes.position.length))
        return orig.call(this, raycaster, intersects, rayLocal);
      const idx = g.index, n = idx ? idx.count : pos.count, dr = g.drawRange;
      const nT = Math.floor(n / 3);
      if (nT < MIN_TRIS || dr.start !== 0 || !(dr.count >= n)) return orig.call(this, raycaster, intersects, rayLocal);
      let e = IDX.get(g);
      if (!e || e.pos !== pos || e.idx !== idx || e.pv !== verOf(pos) || e.iv !== verOf(idx) || e.n !== n || e.pc !== pos.count) {
        e = { pos, idx, pv: verOf(pos), iv: verOf(idx), n, pc: pos.count, asks: 0, B: null };
        IDX.set(g, e);
      }
      RI.asks++;
      if (!e.B) { if (++e.asks <= WARM) return orig.call(this, raycaster, intersects, rayLocal); e.B = build(g, nT); RI.built++; }
      RI.fast++;
      const C = cands(e.B, rayLocal);
      if (!C.length) return;
      // three's own walk over a view of the geometry whose index is the candidates' vertices, in their order
      const sub = new Uint32Array(C.length * 3);
      for (let i = 0; i < C.length; i++) { const t = C[i] * 3; sub[i * 3] = idx ? idx.getX(t) : t; sub[i * 3 + 1] = idx ? idx.getX(t + 1) : t + 1; sub[i * 3 + 2] = idx ? idx.getX(t + 2) : t + 2; }
      const view = { index: { count: sub.length, getX: i => sub[i] }, attributes: A, groups: g.groups, morphAttributes: g.morphAttributes,
                     morphTargetsRelative: g.morphTargetsRelative, drawRange: { start: 0, count: Infinity } };
      const n0 = intersects.length;
      this.geometry = view;
      try { orig.call(this, raycaster, intersects, rayLocal); }
      finally { this.geometry = g; }
      for (let i = n0; i < intersects.length; i++) { const h = intersects[i]; if (h.object === this) h.faceIndex = C[h.faceIndex]; }
    };
    MP._computeIntersections.__rayIndex = RI;
    return RI;
  }
  const RI = install(root.THREE);
  root.RAY_INDEX = RI || { on: false, install };
  if (RI) RI.install = install;
  if (typeof module !== 'undefined' && module.exports) module.exports = { install };
})(typeof window !== 'undefined' ? window : globalThis);
