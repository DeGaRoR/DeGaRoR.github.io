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
//     S.get() / S.set(o)   { on, far, near, spacing, cell, gain, standIn, rowMs }
//     S.has(x, z)          the chunk under a point is built (render_world's hole census, G2930)
//     S.stat()             { chunks, instances, lastMs, maxMs, baked }
//     S.root               the group (a visible toggle is the A/B)
'use strict';
const STAND_CARDS = (() => {
  function make(THREE, ctx) {
    const { scene, world, ISLC, BIO, FILL, treeBuild, chunkBounds, bakeImpostorAtlas, impostorMat, tintUniformsOf,
            ttypeAt, codeAt, forestHere, openHere, vnoise, hsh, U_NOTHIN, treesSettled, rdy, rdyMin, polyMix, polyGround, POLY_CAN, sheetMean, composeCardAtlas } = ctx;
    // THE WHOLE ISLAND (2026-09-22, the user: "extend the visibility range even beyond the 18 km ... just
    // filling all the parts of the island visible from the camera"): measured 171 k cards at 18 km,
    // 193 k at 26, 193.6 k at 40 - it SATURATES, because Jolene is 39 km across and there is no more
    // land to plant. 30 km covers the island's diagonal from any point on it, so `far` is the island's
    // own size now and nothing is left bare; the visible SIDE needs no test of its own - a chunk is
    // one InstancedMesh with a sphere and three culls it per frame.
    // STAND-IN (G2930, TREE-STREAM; the user: "far away, everything is OK, then there is a transition with nothing"): the
    // cards are planted from the EYE out (not from `near`), and inside `near` a card draws wherever the fill's chunk under
    // it is not built yet - render_world's readiness grid (ctx.rdy), read per instance in the impostor's vertex stage. A
    // built chunk dissolves its cards; the fill never leaves a hole while it streams. standIn false: the old cut by
    // distance alone (the A/B). rowMs: a chunk's rows in flight stop once this much of the frame is spent (they ran whole)
    // compose (G3184): the card drawn from its species' own impostor sheets (false: the merged block's bake, levelled - the A/B)
    const S = { on: true, far: 30000, near: 4000, spacing: 32, cell: 2048, gain: 6, block: 4, treeH: 12, mixKey: 'conifer_young', standIn: true, rowMs: 4, compose: true };
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
      const byMat = new Map(), layout = []; const n = S.block, sp = S.spacing / S.block; let seed = 7;
      const R = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
        const p = draw(R()); let b = null; try { b = treeBuild(THREE, p.key, 1, 'rungs'); } catch (e) { continue; }
        if (!b || !b.parts.length) continue;
        const s = S.treeH * (0.8 + 0.4 * R()) / p.h, yaw = R() * Math.PI * 2;
        const x = (ix - (n - 1) / 2) * sp + (R() - 0.5) * sp * 0.6, z = (iz - (n - 1) / 2) * sp + (R() - 0.5) * sp * 0.6;
        const m = new THREE.Matrix4().makeRotationY(yaw).scale(new THREE.Vector3(s, s, s)).setPosition(x, 0, z);
        layout.push({ x, z, s, key: p.key });   // G3184: the block's trees, for the card composed from their sheets
        for (const q of b.parts) { let L = byMat.get(q.mat); if (!L) byMat.set(q.mat, L = []); L.push({ geo: q.geo, mat: q.mat, m }); }
      }
      const parts = [];
      for (const [mt, L] of byMat) { const g = mergeParts(L); chunkBounds(g, 1024); parts.push({ geo: g, mat: mt, cutout: !!(mt.alphaTest && mt.alphaTest > 0) }); }
      // G3180: each pool species' own tint uniforms (its leaf part's, its bark's light), by reference - the card's tint is
      // their weighted mean, live (tintNow below), not the first species' alone
      const tintOf = key => { let b = null; try { b = treeBuild(THREE, key, 1, 'rungs'); } catch (e) { return null; } if (!b) return null;
        const leaf = b.parts.find(q => q.mat.userData && q.mat.userData.uLeaf && q.mat.userData.uLeaf.value > 0.5), bark = b.parts.find(q => q.mat.userData && q.mat.userData.uLeaf && !(q.mat.userData.uLeaf.value > 0.5) && q.mat.userData.uLight);
        const u = leaf && leaf.mat.userData; return u && u.uHue ? { uHue: u.uHue, uSat: u.uSat, uLight: u.uLight, uLightB: bark ? bark.mat.userData.uLight : u.uLight } : null; };
      const tints = pool.map(q => ({ w: q.w, key: q.key, u: tintOf(q.key) })).filter(q => q.u);
      return parts.length ? { parts, pool, tints, layout } : null;
    }
    let P0 = null, tries = 0, TINT = null, levelTries = 0, COMPOSED = false;
    const tintNow = () => { if (!TINT || !P0 || !P0.tints) return; let w = 0, h = 0, sa = 0, li = 0, lb = 0;
      for (const q of P0.tints) { w += q.w; h += q.w * q.u.uHue.value; sa += q.w * q.u.uSat.value; li += q.w * q.u.uLight.value; lb += q.w * q.u.uLightB.value; }
      if (w > 0) { TINT.uHue.value = h / w; TINT.uSat.value = sa / w; TINT.uLight.value = li / w; TINT.uLightB.value = lb / w; } };
    // THE LEVEL (G3180): the card's sheet, drawn, against its species' rungs sheets drawn at their own levels (G2591's
    // IMP_LEVEL), weighted as the block was dealt - k = sum(w Y_s L_s) / sum(w) / Y_card, set as the card sheet's level
    // (TREE_LOD.impLevel: the same live map the measured sheets use). A dense block of crowns baked as one picture is not
    // its trees' mean picture; this is what makes it one. STAT.level / STAT.levelSrc say what it found.
    const lum = v => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    const CARD_SCREEN_K = 0.74;   // G3183: 1 / 1.35, measured on screen under the default look (see matchLevel)
    function matchLevel(P, atlas) {
      const LOD = (typeof TREE_LOD !== 'undefined') ? TREE_LOD : null;
      if (!sheetMean || !LOD || !LOD.impLevel || !atlas || !atlas.key) return;
      const card = sheetMean(atlas.key, atlas.series || 'rungs'); if (!card || !(lum(card) > 1e-5)) { STAT.levelSrc = 'no card sheet'; return; }
      let w = 0, y = 0, n = 0;
      for (const q of P.pool) { const m = sheetMean(q.key, 'rungs'); if (!m) continue; w += q.w; y += q.w * lum(m) * LOD.impLevel(q.key + '|rungs'); n++; }
      if (!n || !(w > 0)) { STAT.levelSrc = 'no species sheet'; return; }
      // x CARD_SCREEN_K: the sheets match at 3.15 but ON SCREEN the card then drew 1.35x its impostors (cardmatch_probe, 13 Oct
      // 02:50 + 03:07, the default look) - a block's baked normals face the sky more than a tree's: the light the sheet cannot see
      const k = Math.max(0.25, Math.min(4, (y / w) / lum(card) * CARD_SCREEN_K));
      LOD.impLevel(atlas.key + '|' + (atlas.series || 'rungs'), k);
      STAT.level = +k.toFixed(3); STAT.levelSrc = n + ' species sheets, card luma ' + lum(card).toFixed(4) + ', theirs ' + (y / w).toFixed(4);
    }
    function ensure() {
      if (proto || failed) return !!proto;
      const t0 = performance.now();
      if (!P0) P0 = buildProto(); const P = P0; if (!P) { failed = true; return false; }
      // G3184: THE CARD COMPOSED FROM ITS SPECIES' OWN SHEETS (render_world composeCardAtlas) - their texels, their normals: the
      // same colour as the impostors by construction, no level to match. Until their sheets exist it waits (the fill bakes
      // them); after ~10 s of tries the old bake of the merged block takes over, levelled (matchLevel, G3181-G3183)
      let atlas = null; COMPOSED = false;
      if (composeCardAtlas && S.compose && tries < 600) { atlas = composeCardAtlas(P.layout, { key: 'stand:' + S.mixKey, series: 'rungs' }); if (!atlas) { tries++; return false; } COMPOSED = true; }
      if (!atlas) atlas = bakeImpostorAtlas(P.parts, { key: 'stand:' + S.mixKey, series: 'rungs' });
      if (!atlas || !atlas.tex || atlas.refused) { if (++tries > 1200) failed = true; return false; }   // refused = a map not decoded yet: again next frame (ten seconds of tries)
      // G3180 (CARD-MATCH): THE CARD'S OWN TINT, the proportion-weighted mean of its species' (tintNow, every update); and ITS
      // LEVEL, matched to their sheets at this bake (matchLevel) - one source for the colour of both tiers
      TINT = P.tints && P.tints.length ? { uHue: { value: 0 }, uSat: { value: 1 }, uLight: { value: 1 }, uLightB: { value: 1 }, bark: false } : null;
      if (TINT) tintNow();
      mat = impostorMat(atlas, S.far, 0, TINT || tintUniformsOf(P.parts), S.gain, U_NOTHIN, { value: S.near }, undefined, (S.standIn && rdy) ? rdy : null);
      if (!COMPOSED) matchLevel(P, atlas); else { if (typeof TREE_LOD !== 'undefined' && TREE_LOD.impLevel) TREE_LOD.impLevel(atlas.key + '|' + atlas.series, null); STAT.level = 1; STAT.levelSrc = 'composed from ' + P.layout.length + ' trees\' own sheets'; }
      quad = new THREE.PlaneGeometry(1, 1); chunkBounds(quad, S.cell / 2);
      proto = { parts: P.parts, atlas };
      STAT.baked = true; STAT.lastMs = performance.now() - t0;
      return true;
    }

    // ---- a chunk: one card per 32 m cell of treed ground ------------------------------------------
    const T = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3();
    // G1075 (LOAD-SETTLE): A CHUNK BY ROWS. A chunk's cards are 64 rows of heights (terrainH through the premises'
    // raster: 0.1-0.8 s over a town's roads) - in flight it is still one call, every row; in the loading's settle
    // (app.js worldAtRest, FLYDIY_SLICE) the rows stop once the slice's 40 ms are spent and the next call goes on
    // from the row it stopped at. The same rows in the same order: the same cards.
    const sliceSpent = () => { const SL = typeof window !== 'undefined' && window.FLYDIY_SLICE; return !!(SL && performance.now() >= SL.until); };
    const inSlice = () => !!(typeof window !== 'undefined' && window.FLYDIY_SLICE);
    const chunkJob = k => { const [cx, cz] = k.split(',').map(Number); return { k, cx, cz, iz: 0, xs: [], ms: 0 }; };
    function chunkRows(J) {   // -> true once every row is done
      const t0 = performance.now(), C = S.cell, sp = S.spacing, n = C / sp, cx = J.cx, cz = J.cz, x0 = cx * C, z0 = cz * C, xs = J.xs;
      const spc = sp / S.block;   // the block's tree spacing: the density the fill would plant at
      while (J.iz < n) { const iz = J.iz++; for (let ix = 0; ix < n; ix++) {
        const gx = cx * n + ix, gz = cz * n + iz;
        const x = x0 + (ix + 0.5) * sp + (hsh(gx + 7, gz) - 0.5) * sp * 0.8, z = z0 + (iz + 0.5) * sp + (hsh(gx, gz + 7) - 0.5) * sp * 0.8;
        if (!ISLC || !ISLC.ttype) continue;
        // G2935 (BIOME-POLY): a premises polygon's own mix opens the gate and stands floored, as the fill's walk does
        const pm = polyMix ? polyMix(x, z, BIO) : undefined;
        if (!forestHere(x, z) && !openHere(x, z) && !(pm && polyGround && polyGround(x, z))) continue;
        const tt = ttypeAt(x, z); if (tt < 2 && !pm) continue;
        const mix = pm !== undefined ? pm : BIO.mixAt(codeAt(x, z, hsh(gx + 21, gz + 23))); if (!mix) continue;
        const MF = BIO.mixOf(mix).forest || {};
        let can = ISLC.canopyAt(x, z), floored = false;
        if ((tt === 3 || tt === 2) && !pm) can = Math.min(can, 3.0);
        if (pm) { floored = true; can = Math.max(can, MF.canopyFloor || 0, POLY_CAN || 12); }
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
      } if (sliceSpent() || (!inSlice() && performance.now() - t0 > S.rowMs)) break; }   // (G2930: in flight too - the same rows, the same cards)
      J.ms += performance.now() - t0;
      return J.iz >= n;
    }
    // the chunk's mesh, once its rows are done
    function chunkMesh(J) {
      const t0 = performance.now(), C = S.cell, x0 = J.cx * C, z0 = J.cz * C, xs = J.xs;
      const N = xs.length / 4;
      if (!N) { STAT.lastMs = J.ms + performance.now() - t0; return null; }
      const m = new THREE.InstancedMesh(quad, mat, N); m.renderOrder = -1;   // an occluder before the ground (render_world.js ORDER_NOTE)
      const ox = x0 + C / 2, oz = z0 + C / 2; m.position.set(ox, 0, oz);
      // one card is not its neighbour (2026-09-23): a lightness off the card's own position, the near
      // tier's rule (render_world treeVary), so a stand of cards is not one flat colour from the air
      const col = new Float32Array(N * 3); const vary = (typeof TREE_LOD !== 'undefined' && TREE_LOD.impVary) ? TREE_LOD.impVary() : 0.1;
      for (let i = 0; i < N; i++) { const h = Math.sin(xs[i * 4] * 12.9898 + xs[i * 4 + 2] * 78.233) * 43758.5453;
        const k = 1 + (2 * (h - Math.floor(h)) - 1) * vary; col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k; }
      m.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
      for (let i = 0; i < N; i++) { V.set(xs[i * 4] - ox, xs[i * 4 + 1], xs[i * 4 + 2] - oz); SC.setScalar(xs[i * 4 + 3]); T.compose(V, Q, SC); m.setMatrixAt(i, T); }
      m.instanceMatrix.needsUpdate = true; m.frustumCulled = true; m.castShadow = false; m.receiveShadow = false;
      STAT.lastMs = J.ms + performance.now() - t0; STAT.maxMs = Math.max(STAT.maxMs, STAT.lastMs);
      return m;
    }
    function drop(k) { const c = chunks.get(k); if (!c) return; if (c.mesh) { root.remove(c.mesh); c.mesh.dispose(); } chunks.delete(k); }

    // ---- per frame ---------------------------------------------------------------------------------
    let tick = 0, queue = [], job = null;   // job: the chunk whose rows are under way (G1075)
    function update(cg) {
      root.visible = S.on;
      if (!S.on || !ISLC || (treesSettled && !treesSettled())) return;   // the bytes AND the maps (the bake's rule)
      if (!proto && sliceSpent()) return;   // (the stand's bake is a slice's worth: at the head of one)
      if (!ensure()) return;
      tintNow();   // G3180: the card's tint follows its species' every frame (a look's tint, a kind's master)
      // ...and the level, once its species' sheets exist (the fill may bake them after this card): a try a second, a minute at most
      if (STAT.level === undefined && proto && !COMPOSED && (tick % 30) === 0 && ++levelTries <= 60) matchLevel(P0, proto.atlas);
      if ((tick++ % 20) === 0) {
        const C = S.cell, R = Math.ceil(S.far / C) + 1, cx0 = Math.floor(cg[0] / C), cz0 = Math.floor(cg[2] / C);
        const B = world.bounds;   // no chunk outside the island's own square: the sea plants nothing
        const want = new Set();
        for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
          const cx = cx0 + dx, cz = cz0 + dz, ex = (cx + 0.5) * C - cg[0], ez = (cz + 0.5) * C - cg[2], d = Math.hypot(ex, ez);
          if (d > S.far + C * 0.71 || (!(S.standIn && rdy) && d < S.near - C * 0.71)) continue;
          if (B && ((cx + 1) * C < B.x0 || cx * C > B.x1 || (cz + 1) * C < B.z0 || cz * C > B.z1)) continue;
          want.add(cx + ',' + cz);
        }
        for (const k of chunks.keys()) if (!want.has(k)) drop(k);
        if (job && !want.has(job.k)) job = null;
        queue = [...want].filter(k => (!chunks.has(k) || chunks.get(k).stale) && !(job && job.k === k)).sort((a, b) => {
          const A = a.split(',').map(Number), B = b.split(',').map(Number);
          return Math.hypot((A[0] + 0.5) * C - cg[0], (A[1] + 0.5) * C - cg[2]) - Math.hypot((B[0] + 0.5) * C - cg[0], (B[1] + 0.5) * C - cg[2]); });
      }
      if (!job && queue.length && !sliceSpent()) job = chunkJob(queue.shift());
      if (job && !sliceSpent() && chunkRows(job)) { const mesh = chunkMesh(job); const old = chunks.get(job.k); if (old && old.mesh) { root.remove(old.mesh); old.mesh.dispose(); }   // a restaled chunk: the swap
        if (mesh) root.add(mesh); chunks.set(job.k, { mesh }); job = null; }
      // a chunk wholly inside the edge draws only while a fill cell under it is not fully ready (rdyMin < 1): the steady
      // state submits what it did before G2930 (those chunks did not exist), a stand-in costs its draw only while it stands
      let ni = 0, nh = 0;
      for (const [k, c] of chunks) { if (!c.mesh) continue; ni += c.mesh.count;
        if (S.standIn && rdy && rdyMin) { const C = S.cell, [cx, cz] = k.split(',').map(Number), d = Math.hypot((cx + 0.5) * C - cg[0], (cz + 0.5) * C - cg[2]);
          c.mesh.visible = !(d < S.near - C * 0.71 && rdyMin(cx * C, cz * C, (cx + 1) * C, (cz + 1) * C) >= 1); if (!c.mesh.visible) nh++; } }
      STAT.instances = ni; STAT.chunks = chunks.size; STAT.parked = nh;
    }
    const api = {
      update, root,
      get: () => Object.assign({}, S),
      set: o => { const was = { far: S.far, near: S.near, spacing: S.spacing, standIn: S.standIn, compose: S.compose }; Object.assign(S, o || {});
        if (S.far !== was.far || S.near !== was.near || S.spacing !== was.spacing || S.standIn !== was.standIn || S.compose !== was.compose) { for (const k of [...chunks.keys()]) drop(k); if (mat) { mat.dispose(); } proto = null; mat = null; job = null; tries = 0; failed = false; delete STAT.level; levelTries = 0; }
        return api.get(); },
      replant: () => { for (const k of [...chunks.keys()]) drop(k); job = null; },
      // G2935: the chunks under these world boxes (every chunk with null) are walked again; each keeps its cards drawn
      // until its new mesh lands (a biome edit never blanks the far forest); returns how many
      restale: boxes => { let n = 0; const C = S.cell;
        for (const [k, c] of chunks) { const [cx, cz] = k.split(',').map(Number);
          if (boxes && !boxes.some(b => b.x1 >= cx * C && b.x0 <= (cx + 1) * C && b.z1 >= cz * C && b.z0 <= (cz + 1) * C)) continue;
          c.stale = true; n++; if (job && job.k === k) job = null; }
        if (n) tick = 0;   // the want list at the next update
        STAT.restaled = (STAT.restaled || 0) + n; return n; },
      stat: () => Object.assign({}, STAT),
      has: (x, z) => !!chunks.get(Math.floor(x / S.cell) + ',' + Math.floor(z / S.cell)),
      atlas: () => proto && proto.atlas,
    };
    return api;
  }
  return { make };
})();
if (typeof window !== 'undefined') window.STAND_CARDS = STAND_CARDS;
