// ===========================================================================
// THE CLIFFS — Poly Haven's photoscanned faces stood in the island's own steep
// ground (2026-09-22, the user: "Polyhaven has great cliff photoscans, is that
// an option? ... I worried about seams and junctions").
// ===========================================================================
// A cliff is NOT a rock: 20-90 m of real rock face, a landscape feature seen
// from kilometres, and the cover ring's 220 m reach and 150 m height fade are
// the wrong instrument for it. This places them itself.
//
//   WHERE. The island's own steepness picks the sites: a lattice over the
//   inner ring, every node whose slope passes `minSlope` and whose ground is
//   above the water, sorted by slope and thinned to `spacing` metres apart
//   (the steepest first: a cliff goes where the terrain already is one). The
//   `coast` knob keeps only sites within a distance of the waterline - a sea
//   cliff, which is what these scans are.
//
//   HOW IT SITS - THE SEAM, which is the whole difficulty:
//     - YAW: the scan's long axis runs along the CONTOUR (perpendicular to the
//       downhill), so its face looks the way the terrain's face looks;
//     - PITCH: it leans INTO the hill by the terrain's own slope, so the top
//       of the face is not sticking out of the ground and the foot is not
//       buried (the slab rule of G488 read over the cliff's own length);
//     - DEPTH: the whole body is sunk `bury` of its height into the hill, so
//       every edge of the scan is inside the terrain and only its middle
//       stands out. A scan has no back: what is not buried is a hole, and
//       sinking it is the only way its border is never the silhouette.
//     - SIZE: scaled so its height matches the terrain's own drop over its
//       footprint (`fit`), within [minK, maxK] of the scan's own size.
//   The seam is therefore never a JOIN - nothing is stitched - it is an
//   INTERSECTION: the ground passes through the scan and the two share the
//   contour line where they cross. That is the only honest way to put a
//   photoscan on procedural ground without re-meshing the terrain under it.
//
//   COST. One InstancedMesh per subject, built once at boot (no streaming):
//   at 8 000 triangles a piece and ~120 sites that is under a million (measured
//   960 k at 120 sites, 110 ms to place), and three's frustum culling drops most
//   of it. The cost is not why this is off.
//
//   THE VERDICT OF THE TRIAL (2026-09-22) - IT IS OFF BY DEFAULT, ?cliffs=1 to
//   see it. A cliff scan is A SLAB OF GROUND WITH ONE FACE: 40 x 9 m of rock
//   with a FLAT TOP, because that is what the photographer walked over. For it
//   to read as a cliff its top must be UNDER the terrain and its face must stand
//   over a real step. Jolene's DEM has no such step near the eye: at a 10 m grid
//   its steepest coastal nodes are 40-45 deg over a drop of 10-20 m, which is the
//   scan's own height - so a scan sunk enough to hide its top has its face buried
//   too (measured: bury 0.72 and 0.9 make them vanish), and one left proud reads
//   as a MESA on the hillside (bench/cliffs/d1_zoom.png - the flat pale top is the
//   giveaway). Nothing about the placement's maths fixes that; the ground has to
//   have the step. TWO WAYS ON, when the chantier comes:
//     - CARVE THE DEM at bake time (tools/island_prep.py writes the ledge where a
//       cliff will stand), so the terrain the SOLVER reads has it too - the honest
//       one, and the only one where the aeroplane can hit the cliff;
//     - or place them by hand where a step exists (the premises editor's cut
//       faces), which is a per-site decision, not a scatter.
'use strict';
var CLIFFS = (() => {
  function make(THREE, ctx) {
    const { scene, world, treeBuild, treeList, LEAF, pack } = ctx;
    // OFF BY DEFAULT: the trial's verdict below - ?cliffs=1 turns it on, F8 has the knobs
    const S = { on: false, n: 120, minSlope: 32, spacing: 110, coast: 0, bury: 0.4, fit: 1.2, minK: 0.6, maxK: 2.2, tilt: 0,
                lattice: 26, reach: 4200, off: false };
    if (typeof location !== 'undefined' && /[?&]cliffs=1/.test(location.search)) S.on = true;
    const STAT = { sites: 0, placed: 0, tris: 0, ms: 0 };
    let root = null;
    const hsh = (ix, iz) => { let h = (ix * 374761393 + iz * 668265263 + 1013904223) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

    const protos = () => {
      const out = [];
      for (const c of (pack ? pack.collections : [])) {
        if (c.kind !== 'cliff') continue;
        for (const e of treeList('all').filter(q => q.col === c)) {
          let b = null; try { b = treeBuild(THREE, e.key, 0, 'rungs'); } catch (err) { continue; }
          if (!b || !b.parts.length) continue;
          const bb = e.sub.bb || [-1, 0, -1, 1, 1, 1];
          const parts = b.parts.map(q => { const m = new THREE.MeshStandardMaterial({ map: q.mat.map || null, roughness: 1, metalness: 0 }); return { geo: q.geo, mat: m }; });
          out.push({ key: e.key, parts, len: Math.max(bb[3] - bb[0], bb[5] - bb[2]), h: bb[4] - bb[1], wide: (bb[3] - bb[0]) >= (bb[5] - bb[2]) });
        }
      }
      return out;
    };

    // the island's steep ground, thinned: [x, z, slope, downhill angle]
    function sites() {
      const P = [], L = S.lattice, R = S.reach, coastAt = world.island && world.island.coastAt;
      for (let z = -R; z <= R; z += L) for (let x = -R; x <= R; x += L) {
        const y = world.terrainH(x, z);
        if (y < 1.5) continue;
        if (coastAt && S.coast > 0 && coastAt(x, z) > S.coast) continue;   // a SEA cliff: within `coast` metres of the line
        const d = L * 0.75;
        const gx = (world.terrainH(x + d, z) - world.terrainH(x - d, z)) / (2 * d);
        const gz = (world.terrainH(x, z + d) - world.terrainH(x, z - d)) / (2 * d);
        const sl = Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI;
        if (sl < S.minSlope) continue;
        P.push([x, z, sl, Math.atan2(gz, gx)]);
      }
      P.sort((a, b) => b[2] - a[2]);
      const kept = [], s2 = S.spacing * S.spacing;
      for (const p of P) {
        if (kept.length >= S.n) break;
        let ok = true;
        for (const q of kept) { const dx = p[0] - q[0], dz = p[1] - q[1]; if (dx * dx + dz * dz < s2) { ok = false; break; } }
        if (ok) kept.push(p);
      }
      STAT.sites = P.length;
      return kept;
    }

    function build() {
      const t0 = performance.now();
      if (root) { scene.remove(root); root.traverse(o => { if (o.geometry && o.isInstancedMesh) o.geometry.dispose(); }); root = null; }
      if (!S.on || S.off) { STAT.placed = 0; STAT.tris = 0; return; }
      const P = protos(); if (!P.length) return;
      const K = sites();
      const by = new Map();   // proto -> instances
      for (let i = 0; i < K.length; i++) {
        const [x, z, sl, dn] = K[i];
        const p = P[Math.floor(hsh(Math.round(x), Math.round(z)) * P.length) % P.length];
        // the scale: the terrain's own drop over the scan's length, within the scan's own bounds
        const half = p.len / 2;
        const drop = Math.abs(world.terrainH(x + Math.cos(dn) * half, z + Math.sin(dn) * half) - world.terrainH(x - Math.cos(dn) * half, z - Math.sin(dn) * half));
        const k = Math.max(S.minK, Math.min(S.maxK, (drop * S.fit) / Math.max(1, p.h)));
        let a = by.get(p); if (!a) { a = []; by.set(p, a); }
        a.push([x, world.terrainH(x, z), z, k, dn, Math.atan(Math.hypot(Math.tan(sl * Math.PI / 180), 0))]);
      }
      root = new THREE.Group(); root.name = 'cliffs'; scene.add(root);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), SC = new THREE.Vector3();
      let tris = 0, placed = 0;
      for (const [p, arr] of by) {
        for (const part of p.parts) {
          const m = new THREE.InstancedMesh(part.geo, part.mat, arr.length);
          for (let i = 0; i < arr.length; i++) {
            const [x, y, z, k, dn, slope] = arr[i];
            // the long axis along the CONTOUR (the downhill turned a quarter), leaning into the hill by the slope
            // THE SCAN STAYS UPRIGHT (2026-09-22, measured: leaning it by the slope made every face jut out of
            // the hill like a fallen menhir - a cliff's rock is vertical, it is the GROUND that slopes past it).
            // Only the yaw: the long axis along the contour, the face looking downhill.
            E.set(0, -dn + (p.wide ? Math.PI / 2 : 0) + (S.tilt ? 0 : 0), 0, 'YXZ');
            Q.setFromEuler(E);
            if (S.tilt) { const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(dn), 0, Math.sin(dn)), -slope * S.tilt); Q.premultiply(tilt); }
            V.set(x, y - p.h * k * S.bury, z); SC.setScalar(k);
            M.compose(V, Q, SC); m.setMatrixAt(i, M);
          }
          m.instanceMatrix.needsUpdate = true;
          m.castShadow = true; m.receiveShadow = true; m.frustumCulled = true;
          m.geometry.computeBoundingSphere();
          root.add(m); tris += (part.geo.index ? part.geo.index.count / 3 : 0) * arr.length;
        }
        placed += arr.length;
      }
      STAT.placed = placed; STAT.tris = tris; STAT.ms = performance.now() - t0;
    }
    const api = { get: () => Object.assign({}, S), stat: () => Object.assign({}, STAT),
                  set: o => { Object.assign(S, o || {}); build(); return api.get(); }, rebuild: build };
    return { build, api };
  }
  return { make };
})();
if (typeof window !== 'undefined') window.CLIFFS = CLIFFS;
