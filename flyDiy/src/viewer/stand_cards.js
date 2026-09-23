// stand_cards.js - THE FAR FOREST AS STAND CARDS (2026-09-22, the user: "the mountains are covered
// with a thick fur of trees. Can't we have that? ... at least on the visible side of the mountains")
//
// Beyond the fill's ring (4.5 km, where the complement thins away) the terrain carried the imagery's
// colour and nothing stood on it - a mountain without trees. A card per TREE cannot reach the island's
// edge: the instances are the limit (a matrix and a colour per tree; 12 km of them killed the GPU
// process at 9 GB). A card per STAND can. ONE subject - a 4 x 4 block of the young conifer mix at the
// grid's own spacing (8 m: a 32 m stand of 16 trees), merged into two or three geometries and baked by
// the impostor baker exactly like a tree - and one octahedral card per 32 m of treed ground, planted
// on a 32 m grid in 2 km chunks from the ring's edge to STAND.far (18 km), keyed to the biome like
// the fill (the mix's density x the block's area, the canopy floor and the clumps), sized by the
// canopy like a tree. ~40 cards a hectare of forest: the whole visible island is a few hundred
// thousand cards, most of them a few pixels, one InstancedMesh a chunk, no near rung, no shadow.
//
//   STAND_CARDS.make(THREE, ctx) -> S
//     ctx: { scene, world, ISLC, BIO, FILL, treeBuild, chunkBounds, bakeImpostorAtlas, impostorMat,
//            tintUniformsOf, ttypeAt, codeAt, forestHere, openHere, vnoise, hsh, U_NOTHIN }
//     S.update(cg)         once a frame: the wanted chunks around the CG, one built per call, the far dropped
//     S.get() / S.set(o)   { on, far, near, spacing, cell, gain }
//     S.stat()             { chunks, instances, lastMs, maxMs, baked }
//     S.root               the group (a visible toggle is the A/B)
'use strict';
const STAND_CARDS = (() => {
  function make(THREE, ctx) {
    const { scene, world, ISLC, BIO, FILL, treeBuild, chunkBounds, bakeImpostorAtlas, impostorMat, tintUniformsOf,
            ttypeAt, codeAt, forestHere, openHere, vnoise, hsh, U_NOTHIN, treesSettled } = ctx;
    // THE WHOLE ISLAND (2026-09-22, the user: "extend the visibility range even beyond the 18 km ... just
    // filling all the parts of the island visible from the camera"): measured 171 k cards at 18 km,
    // 193 k at 26, 193.6 k at 40 - it SATURATES, because Jolene is 39 km across and there is no more
    // land to plant. 30 km covers the island's diagonal from any point on it, so `far` is the island's
    // own size now and nothing is left bare; the visible SIDE needs no test of its own - a chunk is
    // one InstancedMesh with a sphere and three culls it per frame.
    const S = { on: true, far: 30000, near: 4000, spacing: 32, cell: 2048, gain: 6, block: 4, treeH: 12, mixKey: 'conifer_young' };
    const STAT = { chunks: 0, instances: 0, lastMs: 0, maxMs: 0, baked: false };
    const root = new THREE.Group(); root.name = 'standCards'; scene.add(root);
    const chunks = new Map();
    let proto = null, mat = null, quad = null, failed = false;

    // ---- the subject: a block of trees merged into one geometry per part -------------------------
    function mergeParts(list) {   // list: [{ geo, mat, m: Matrix4 }] all sharing one material -> one geometry
      const N = { position: 0, normal: 0, uv: 0, aoV: 0 }; let nIdx = 0;
      for (const e of list) { for (const k in N) if (e.geo.attributes[k]) N[k] += e.geo.attributes[k].count; nIdx += e.geo.index ? e.geo.index.count : e.geo.attributes.position.count; }
      const pos = new Float32Array(N.position * 3), nrm = new Float32Array(N.normal * 3), uv = new Float32Array(N.uv * 2), ao = new Float32Array(N.aoV || N.position), idx = new Uint32Array(nIdx);
      let vo = 0, io = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3();
      for (const e of list) {
        const P = e.geo.attributes.position, Nn = e.geo.attributes.normal, U = e.geo.attributes.uv, A = e.geo.attributes.aoV; nm.getNormalMatrix(e.m);
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(e.m); pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
          if (Nn) { v.fromBufferAttribute(Nn, i).applyMatrix3(nm).normalize(); nrm[(vo + i) * 3] = v.x; nrm[(vo + i) * 3 + 1] = v.y; nrm[(vo + i) * 3 + 2] = v.z; }
          if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
          ao[vo + i] = A ? A.getX(i) : 1;
        }
        if (e.geo.index) { const I = e.geo.index; for (let i = 0; i < I.count; i++) idx[io + i] = I.getX(i) + vo; io += I.count; }
        else { for (let i = 0; i < P.count; i++) idx[io + i] = vo + i; io += P.count; }
        vo += P.count;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aoV', new THREE.BufferAttribute(ao, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1));
      return g;
    }
    function buildProto() {
      const M = BIO && BIO.mixOf(S.mixKey); if (!M || !M.species) return null;
      const pack = (typeof TREE_PACK !== 'undefined') ? TREE_PACK : null; if (!pack) return null;
      // the mix's TREE species with their proportions, each subject of each species at an equal share
      const pool = [];
      for (const [name, row] of Object.entries(M.species)) {
        const c = pack.collections.find(q => q.name === name); if (!c || (c.kind && c.kind !== 'tree') || !c.subjects || !c.subjects.length) continue;
        const w = (row.proportion === undefined ? 1 : row.proportion) / c.subjects.length; if (w <= 0) continue;
        for (const s of c.subjects) pool.push({ key: c.name + '|' + (s.key || s.name), w, h: (s.bb ? s.bb[4] - s.bb[1] : (s.h || 12)) || 12 });
      }
      if (!pool.length) return null;
      const tot = pool.reduce((a, p) => a + p.w, 0);
      const draw = r => { let acc = r * tot; for (const p of pool) { acc -= p.w; if (acc <= 0) return p; } return pool[pool.length - 1]; };
      // the block: n x n trees at the fill's spacing, the L1 rung (stick + full foliage), every tree at
      // treeH x a spread, merged per (species part) so each merged geometry keeps its own material
      const byMat = new Map(); const n = S.block, sp = S.spacing / S.block; let seed = 7;
      const R = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
        const p = draw(R()); let b = null; try { b = treeBuild(THREE, p.key, 1, 'rungs'); } catch (e) { continue; }
        if (!b || !b.parts.length) continue;
        const s = S.treeH * (0.8 + 0.4 * R()) / p.h, yaw = R() * Math.PI * 2;
        const x = (ix - (n - 1) / 2) * sp + (R() - 0.5) * sp * 0.6, z = (iz - (n - 1) / 2) * sp + (R() - 0.5) * sp * 0.6;
        const m = new THREE.Matrix4().makeRotationY(yaw).scale(new THREE.Vector3(s, s, s)).setPosition(x, 0, z);
        for (const q of b.parts) { let L = byMat.get(q.mat); if (!L) byMat.set(q.mat, L = []); L.push({ geo: q.geo, mat: q.mat, m }); }
      }
      const parts = [];
      for (const [mt, L] of byMat) { const g = mergeParts(L); chunkBounds(g, 1024); parts.push({ geo: g, mat: mt, cutout: !!(mt.alphaTest && mt.alphaTest > 0) }); }
      return parts.length ? { parts } : null;
    }
    let P0 = null, tries = 0;
    function ensure() {
      if (proto || failed) return !!proto;
      const t0 = performance.now();
      if (!P0) P0 = buildProto(); const P = P0; if (!P) { failed = true; return false; }
      const atlas = bakeImpostorAtlas(P.parts, { key: 'stand:' + S.mixKey, series: 'rungs' });
      if (!atlas || !atlas.tex || atlas.refused) { if (++tries > 600) failed = true; return false; }   // refused = a map not decoded yet: again next frame (ten seconds of tries)
      mat = impostorMat(atlas, S.far, 0, tintUniformsOf(P.parts), S.gain, U_NOTHIN, { value: S.near });
      quad = new THREE.PlaneGeometry(1, 1); chunkBounds(quad, S.cell / 2);
      proto = { parts: P.parts, atlas };
      STAT.baked = true; STAT.lastMs = performance.now() - t0;
      return true;
    }

    // ---- a chunk: one card per 32 m cell of treed ground ------------------------------------------
    const T = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3();
    function buildChunk(cx, cz) {
      const t0 = performance.now(), C = S.cell, sp = S.spacing, n = C / sp, x0 = cx * C, z0 = cz * C;
      const spc = sp / S.block;   // the block's tree spacing: the density the fill would plant at
      const xs = [];
      for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
        const gx = cx * n + ix, gz = cz * n + iz;
        const x = x0 + (ix + 0.5) * sp + (hsh(gx + 7, gz) - 0.5) * sp * 0.8, z = z0 + (iz + 0.5) * sp + (hsh(gx, gz + 7) - 0.5) * sp * 0.8;
        if (!ISLC || !ISLC.ttype) continue;
        if (!forestHere(x, z) && !openHere(x, z)) continue;
        const tt = ttypeAt(x, z); if (tt < 2) continue;
        const mix = BIO.mixAt(codeAt(x, z, hsh(gx + 21, gz + 23))); if (!mix) continue;
        const MF = BIO.mixOf(mix).forest || {};
        let can = ISLC.canopyAt(x, z), floored = false;
        if (tt === 3 || tt === 2) can = Math.min(can, 3.0);
        if (MF.canopyFloor > can) { can = MF.canopyFloor; floored = true; }
        if (MF.clump > 0 && vnoise(x, z, MF.clumpM || 30, 41) < MF.clump) continue;
        const kind = Math.min(1, BIO.density(mix) * spc * spc * FILL.island.biomeGain); if (kind <= 0) continue;
        let p = floored ? 1 : (can - FILL.island.from) / Math.max(0.5, FILL.island.full - FILL.island.from);
        p *= kind;
        if (p < 1 && hsh(gx + 13, gz + 29) > p) continue;
        const h = world.terrainH(x, z);
        // the card's scale: the canopy over the block's tree height, the fill's rule and clamps
        const s = Math.max(FILL.island.min, Math.min(FILL.island.max, (can * FILL.island.gain) / S.treeH));
        xs.push(x, h, z, s);
      }
      const N = xs.length / 4;
      if (!N) { STAT.lastMs = performance.now() - t0; return null; }
      const m = new THREE.InstancedMesh(quad, mat, N); m.renderOrder = -1;   // an occluder before the ground (render_world.js ORDER_NOTE)
      const ox = x0 + C / 2, oz = z0 + C / 2; m.position.set(ox, 0, oz);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3).fill(1), 3);
      for (let i = 0; i < N; i++) { V.set(xs[i * 4] - ox, xs[i * 4 + 1], xs[i * 4 + 2] - oz); SC.setScalar(xs[i * 4 + 3]); T.compose(V, Q, SC); m.setMatrixAt(i, T); }
      m.instanceMatrix.needsUpdate = true; m.frustumCulled = true; m.castShadow = false; m.receiveShadow = false;
      STAT.lastMs = performance.now() - t0; STAT.maxMs = Math.max(STAT.maxMs, STAT.lastMs);
      return m;
    }
    function drop(k) { const c = chunks.get(k); if (!c) return; if (c.mesh) { root.remove(c.mesh); c.mesh.dispose(); } chunks.delete(k); }

    // ---- per frame ---------------------------------------------------------------------------------
    let tick = 0, queue = [];
    function update(cg) {
      root.visible = S.on;
      if (!S.on || !ISLC || (treesSettled && !treesSettled())) return;   // the bytes AND the maps (the bake's rule)
      if (!ensure()) return;
      if ((tick++ % 20) === 0) {
        const C = S.cell, R = Math.ceil(S.far / C) + 1, cx0 = Math.floor(cg[0] / C), cz0 = Math.floor(cg[2] / C);
        const B = world.bounds;   // no chunk outside the island's own square: the sea plants nothing
        const want = new Set();
        for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
          const cx = cx0 + dx, cz = cz0 + dz, ex = (cx + 0.5) * C - cg[0], ez = (cz + 0.5) * C - cg[2], d = Math.hypot(ex, ez);
          if (d > S.far + C * 0.71 || d < S.near - C * 0.71) continue;
          if (B && ((cx + 1) * C < B.x0 || cx * C > B.x1 || (cz + 1) * C < B.z0 || cz * C > B.z1)) continue;
          want.add(cx + ',' + cz);
        }
        for (const k of chunks.keys()) if (!want.has(k)) drop(k);
        queue = [...want].filter(k => !chunks.has(k)).sort((a, b) => {
          const A = a.split(',').map(Number), B = b.split(',').map(Number);
          return Math.hypot((A[0] + 0.5) * C - cg[0], (A[1] + 0.5) * C - cg[2]) - Math.hypot((B[0] + 0.5) * C - cg[0], (B[1] + 0.5) * C - cg[2]); });
      }
      if (queue.length) { const k = queue.shift(); const [cx, cz] = k.split(',').map(Number); const mesh = buildChunk(cx, cz); if (mesh) root.add(mesh); chunks.set(k, { mesh }); }
      let ni = 0; for (const c of chunks.values()) if (c.mesh) ni += c.mesh.count; STAT.instances = ni; STAT.chunks = chunks.size;
    }
    const api = {
      update, root,
      get: () => Object.assign({}, S),
      set: o => { const was = { far: S.far, near: S.near, spacing: S.spacing }; Object.assign(S, o || {});
        if (S.far !== was.far || S.near !== was.near || S.spacing !== was.spacing) { for (const k of [...chunks.keys()]) drop(k); if (mat) { mat.dispose(); } proto = null; mat = null; }
        return api.get(); },
      replant: () => { for (const k of [...chunks.keys()]) drop(k); },
      stat: () => Object.assign({}, STAT),
      atlas: () => proto && proto.atlas,
    };
    return api;
  }
  return { make };
})();
if (typeof window !== 'undefined') window.STAND_CARDS = STAND_CARDS;
