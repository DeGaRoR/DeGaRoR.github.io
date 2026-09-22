// ============================================================================
// cover_ring.js — THE COVER RING (G454.13, BIOMES-IN-GAME-2026-09-20.md L2 + L3):
// the grass, the flowers, the rocks and the bushes of the biome, in a ring
// around the EYE.
//
// The trees stream in 1 km chunks because a tree is seen from 5 km; a tuft is
// seen from 200 m and only from low, so the cover is not a chunk layer - it is
// a ring of 32 m CELLS around the camera's ground point, each cell planted
// once (hashed on its index, so the same cell is the same cover for ever),
// kept while it is within reach, dropped beyond. Nothing is regenerated as
// the eye moves inside the ring: the fade is in the vertex shader (trees.js
// fadeHook: full to `near`, (1 - t)^(1 + 2 taper) to nothing at `reach`, and
// gone above `aglOff` metres of height), so a cell is planted at FULL density
// and thins per frame by its distance to the eye. The rules are the bench's
// (tools/_trees.html, G454.5-G454.10), read from the same numbers:
//   the mix's row per species: proportion, density (per m2), patch (beds of
//     `patch` metres holding `patchShare` of the area at density / share),
//     size (a rock's, per setting); the mix's forest: under (shrubs / 1000 m2),
//     rocks (/ 1000 m2), reach, coverNear, taper, blotch / blotchM (a species'
//     density drifts by area), coverSpread (the tufts' size jitter);
//   the species' place: hMin / hMax (a bush, uniform in metres), bury (a rock,
//     the fraction of its height under the ground), vary (a tuft's own
//     lightness jitter), lift + contrast (the tuft's colour: THE GROUND'S AT
//     ITS FOOT - the two set means of the code's row through the shared
//     fields' mixK and shade, x lift, the max channel capped at 0.7 - and the
//     texel flattened toward its map's mean by contrast), noTint (a flower
//     keeps its picture), aspect + maps (a flower: three crossed cards).
// The biome at a point is the walker's (ctx.biomeAt: the terrain-type code at
// the ground's wobbled position -> the mix), so the grass stands on the set the
// ground draws there. The set means are the splat manifest's
// (SPLAT_TEX_SETS[i].mean, linear) or the table below measured from the same
// files. Covers cast no shadow (the bench's rule); bushes and rocks do.
//
//   COVER_RING.make(THREE, ctx) -> ring
//     ctx = { scene, world, camera, treeBuild, treeList, LEAF (TREE_LEAF), BIO, GF,
//             biomeAt(x, z, r) -> mixName | null, okAt(x, z) -> bool (land, not paved) }
//     ring.update()            once a frame, after the camera is placed
//     ring.get() / ring.set(o) the dials (F8): on, reach, near, taper, aglFull,
//                              aglOff, density, budgetMs, cell
//     ring.stat()              cells live / queued, instances, the last build's ms
//     ring.dispose()
// ============================================================================
'use strict';
var COVER_RING = (() => {
  // the library's means (linear rgb, tools/splat_tex_prep.js's measure), until the
  // manifest carries them (SPLAT_TEX_SETS[i].mean)
  const MEANS = { beach: [0.2826, 0.2371, 0.196], rocksA: [0.2155, 0.1901, 0.107], rocksB: [0.1648, 0.1158, 0.046], mud: [0.0897, 0.0702, 0.0458],
    leaves: [0.2264, 0.1177, 0.0461], cliff: [0.3136, 0.1726, 0.11], rocksG: [0.2521, 0.2134, 0.1638], rockyA: [0.0807, 0.0773, 0.0122],
    rockyB: [0.0855, 0.053, 0.0176], grassRock: [0.169, 0.1211, 0.0241], forestAir: [0.1259, 0.083, 0.026], snowAir: [0.2491, 0.2483, 0.3039],
    lush: [0.0584, 0.1065, 0.0218], grass: [0.119, 0.1528, 0.0305], pebble: [0.2178, 0.2034, 0.1649], dry: [0.3005, 0.2486, 0.1239], dirt: [0.1326, 0.1085, 0.0826] };
  const meanRaw = key => {
    if (typeof SPLAT_TEX_SETS !== 'undefined' && SPLAT_TEX_SETS) { const s = SPLAT_TEX_SETS.find(x => x.key === key); if (s && s.mean) return s.mean; }
    return MEANS[key] || [0.15, 0.15, 0.08];
  };
  // THE MEAN AS DRAWN (2026-09-22, the roads session and the user: "the tufts do not take the ground colour at
  // all ... pale beige over green ground"): the tuft took the set's SHIPPED mean while the ground under it wears
  // the hand grade and, since G485, the normalisation to the imagery (dry x 0.19) - a tuft three times brighter
  // than its ground. The splat's own gain, the shader's formula: hand.gain x (1 + (norm - 1) x albedoNorm).
  const meanOf = key => {
    const m = meanRaw(key);
    const SP = (typeof WORLD !== 'undefined' && WORLD && WORLD.ground && WORLD.ground.splat) ? WORLD.ground.splat() : null;
    if (!SP || !SP.grade) return m;
    let g = [1, 1, 1];
    try { const h = SP.grade(key); if (h && h.gain) { const c = new THREE.Color(h.gain); g = [c.r, c.g, c.b]; }
      const nm = SP.norm ? SP.norm()[key] : null, K = SP.knobs ? SP.knobs() : {}, kA = K.albedoNorm === undefined ? 1 : K.albedoNorm;
      if (nm) g = g.map((v, i) => v * (1 + (nm[i] - 1) * kA)); } catch (e) {}
    return [m[0] * g[0], m[1] * g[1], m[2] * g[2]];
  };
  const hsh = (ix, iz) => { let h = (ix * 374761393 + iz * 668265263 + 1013904223) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const rng = seed => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const hashStr = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const vnoise = (x, z, cell, seed) => {
    const fx = x / cell, fz = z / cell, ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz, sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
    const n = (a, b) => hsh(a * 7 + seed * 131, b * 13 + seed * 17);
    return (n(ix, iz) * (1 - sx) + n(ix + 1, iz) * sx) * (1 - sz) + (n(ix, iz + 1) * (1 - sx) + n(ix + 1, iz + 1) * sx) * sz;
  };
  const smooth = (lo, hi, v) => { const t = Math.max(0, Math.min(1, (v - lo) / Math.max(1e-6, hi - lo))); return t * t * (3 - 2 * t); };

  function make(THREE, ctx) {
    const { scene, world, camera, treeBuild, treeList, LEAF, BIO, GF } = ctx;
    const S = { on: true, cell: 32, reach: 220, near: 50, taper: 0.5, aglFull: 60, aglOff: 150, density: 2, shrubs: 1, rocks: 1, budgetMs: 4, maxCells: 400 };   // density 2 (2026-09-22, the user: "the grass is really too sparse")
    const pack = (typeof TREE_PACK !== 'undefined') ? TREE_PACK : null;
    const cells = new Map();            // 'cx,cz' -> { group, n, meshes }
    const protos = new Map();           // species key -> [{ key, w, parts:[{geo, mat}], h, kind }]
    const STAT = { built: 0, lastMs: 0, maxMs: 0, live: 0, queued: 0, instances: 0, agl: 0, mixAt: null, by: {} };
    let flowerTex = new Map();
    const root = new THREE.Group(); root.name = 'coverRing'; scene.add(root);

    // ---- the prototypes: every species of the kinds the ring plants, built once ------
    const speciesOf = () => (pack ? pack.collections : []).filter(c => ['cover', 'shrub', 'rock'].includes(c.kind));
    const measureMean = mat => {   // the map's mean lightness (HSL l of the sRGB mean over the kept texels) - the bench's measureMats
      const img = mat.map && mat.map.image; if (!img || !img.width) return;
      try {
        const c = measureMean.cnv || (measureMean.cnv = document.createElement('canvas')); c.width = c.height = 64;
        const g = c.getContext('2d', { willReadFrequently: true }); g.clearRect(0, 0, 64, 64); g.drawImage(img, 0, 0, 64, 64);
        const d = g.getImageData(0, 0, 64, 64).data; let R = 0, G = 0, B = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
        if (!n) return;
        const mx = Math.max(R, G, B) / n / 255, mn = Math.min(R, G, B) / n / 255;
        mat.userData.uFlatMean.value = (mx + mn) / 2;
      } catch (e) {}
    };
    function flowerCards(H, aspect, seed) {
      const r = rng(seed), W = H * aspect, pos = [], uv = [], idx = [];
      for (let c = 0; c < 3; c++) {
        const a = c * Math.PI / 3 + (r() - 0.5) * 0.3, tilt = (r() - 0.5) * 0.17, dx = Math.cos(a), dz = Math.sin(a), ox = (r() - 0.5) * 0.15 * W, oz = (r() - 0.5) * 0.15 * W;
        const y0 = -0.05 * H, y1 = 0.95 * H, lean = Math.sin(tilt) * H, b = pos.length / 3;
        pos.push(ox - dx * W / 2, y0, oz - dz * W / 2, ox + dx * W / 2, y0, oz + dz * W / 2,
                 ox + dx * W / 2 - dz * lean, y1, oz + dz * W / 2 + dx * lean, ox - dx * W / 2 - dz * lean, y1, oz - dz * W / 2 + dx * lean);
        uv.push(0, 1, 1, 1, 1, 0, 0, 0); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    }
    const flowerMat = url => {
      let t = flowerTex.get(url);
      if (!t) { t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; flowerTex.set(url, t); }
      const m = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
      LEAF.fadeHook(m); return LEAF.upHook ? LEAF.upHook(m) : m;
    };
    function protosOf(c) {
      let P = protos.get(c.name);
      if (P) return P;
      P = [];
      const place = c.place || {};
      if (c.maps && c.maps.length) {                         // a flower: its pictures on cards
        c.maps.forEach((url, v) => P.push({ key: c.name + '|' + v, w: 1 / c.maps.length, kind: 'cover', h: place.size || 1, noTint: true,
                                            parts: [{ geo: flowerCards(place.size || 1, place.aspect || 1, hashStr(c.name) + v * 977), mat: flowerMat(url) }] }));
      } else {
        const subs = treeList('all').filter(e => e.col === c);
        for (const e of subs) {
          let b = null; try { b = treeBuild(THREE, e.key, 0, 'rungs'); } catch (err) { continue; }
          if (!b || !b.parts.length) continue;
          const parts = b.parts.map(q => {
            let mat = q.mat;
            if (c.kind === 'rock') {                            // the leaf hook's AO attribute drew the rocks black (the bench): a plain copy
              mat = new THREE.MeshStandardMaterial({ map: q.mat.map || null, roughness: 1, metalness: 0 });
              // THE SKIRT IS CUT (2026-09-22, the coast scans): a photoscanned strip carries the sand round its rocks, and
              // that skirt lay on the terrain as a pale plate wherever the ground fell away under it. A rock row's
              // `cut` (metres above the subject's floor - its own ground level, coast_rocks_tune.py) discards every
              // fragment below it in the rock's own frame: the rocks stand out of the real ground, the sand is the ground's
              if (place.cut > 0) {
                const uCut = { value: place.cut };
                mat.onBeforeCompile = sh => { sh.uniforms.uCut = uCut;
                  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + String.fromCharCode(10) + 'varying float vRockY;')
                    .replace('#include <begin_vertex>', '#include <begin_vertex>' + String.fromCharCode(10) + 'vRockY = position.y;');
                  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + String.fromCharCode(10) + 'varying float vRockY; uniform float uCut;')
                    .replace('#include <map_fragment>', 'if (vRockY < uCut) discard;' + String.fromCharCode(10) + '#include <map_fragment>'); };
              }
              LEAF.fadeHook(mat); if (place.cut > 0) mat.customProgramCacheKey = () => 'fade-rockcut';
            } else {
              LEAF.fadeHook(mat);
              if (c.kind === 'cover' && LEAF.upHook) LEAF.upHook(mat);   // the tuft shades as the ground (trees.js UP_VS)
              if (c.kind === 'cover' && mat.userData.uFlat) { mat.userData.uFlat.value = place.contrast === undefined ? 1 : place.contrast; measureMean(mat);
                if (mat.map && !(mat.map.image && mat.map.image.width)) { const t0 = mat.map; const poll = () => { if (t0.image && t0.image.width) measureMean(mat); else setTimeout(poll, 500); }; setTimeout(poll, 500); } }
            }
            return { geo: q.geo, mat };
          });
          const h = (e.sub.bb ? e.sub.bb[4] - e.sub.bb[1] : (e.sub.h || 1)) * (place.size || 1);
          P.push({ key: e.key, w: 1 / subs.length, kind: c.kind, h, h0: (e.sub.bb ? e.sub.bb[4] - e.sub.bb[1] : (e.sub.h || 1)), parts, size: place.size || 1,
                   r0: e.sub.bb ? Math.max(e.sub.bb[3] - e.sub.bb[0], e.sub.bb[5] - e.sub.bb[2]) / 2 : 1 });   // half its footprint: a slab's tilt is read over its own extent
        }
      }
      protos.set(c.name, P);
      return P;
    }
    const draw = (P, r) => { let acc = r; for (const p of P) { acc -= p.w; if (acc <= 0) return p; } return P[P.length - 1]; };

    // ---- the tuft's colour: the ground's at its foot -------------------------------
    const rowOf = code => (GF && GF.CODES && GF.CODES[code]) || null;
    const colAt = (x, z, code) => {   // the ground's colour at lift 1, uncapped (the cap is per species, below)
      const row = rowOf(code);
      if (!row || !GF.groundColor) return null;
      const A = meanOf(row.sets[0]), B = row.sets[1] ? meanOf(row.sets[1]) : A;
      const c = GF.groundColor(x, z, row.period, row.bias, row.sharp, A, B), sh = GF.shade(x, z, row.vary[2]);
      const t = GF.hueTurn(c, sh.hue * row.vary[0] * Math.PI / 180), k = 1 + sh.value * row.vary[1];
      return [t[0] * k, t[1] * k, t[2] * k];
    };
    const lifted = (c, lift) => { const mx = Math.max(c[0], c[1], c[2]) * lift, sc = mx > 0.7 ? 0.7 / mx : 1;   // the max channel capped at 0.7
      return [c[0] * lift * sc, c[1] * lift * sc, c[2] * lift * sc]; };
    // THE CELL'S SUB-GRID (the cost): the code, the mix, the land test and the ground's colour
    // are smooth over metres (the fields' cells are 15-40 m, the map's 10 m), so a cell samples
    // them on a 4 m lattice once and every tuft reads the nearest node - a point-by-point
    // biomeAt (four terrainH, a canopy, two noises) at 2 500 tufts a cell was 50 ms a cell
    const SG = 4;
    // THE IMAGERY AT A POINT (linear rgb): the tuft's colour where no CODES row stands (code 10 'built' -
    // the pale-beige tufts on the village's ground) and where the mix has no ground of its own
    const imageryAt = (x, z) => {
      const I = world.island; if (!I || !I.albedo || !I.cellAt) return null;
      const k = I.cellAt(x, z); if (k < 0) return null;
      const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return [lin(I.albedo[k * 3]), lin(I.albedo[k * 3 + 1]), lin(I.albedo[k * 3 + 2])];
    };
    // THE COVER'S QUERY (v1.17, the roads session's world.coverAt through ctx.coverAt): per lattice node -
    // kill (1 on a pavement and its band, falling over the fade), boost (the border past a band), kind
    // (0 the biome's, 1 a plot's LAWN, 2 a plot's meadow, 3 none), the lawn's height and density factor,
    // and `col` (the linear colour the DRAWN ground has beside a pavement) taken as the tuft's ground
    const KIND = { lawn: 1, meadow: 2, none: 3 };
    function subGrid(x0, z0, C) {
      const N = Math.round(C / SG) + 1, mix = new Array(N * N), code = new Int16Array(N * N), ok = new Uint8Array(N * N), col = new Float32Array(N * N * 3);
      const kill = new Float32Array(N * N), boost = new Float32Array(N * N), kind = new Uint8Array(N * N), lawnH = new Float32Array(N * N), lawnD = new Float32Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = x0 + i * SG, z = z0 + j * SG, k = j * N + i, r = hsh(Math.round(x * 3.7), Math.round(z * 5.3));
        const cd = ctx.codeAt ? ctx.codeAt(x, z, r) : -1;
        code[k] = cd; mix[k] = cd < 0 ? null : BIO.mixAt(cd); ok[k] = (ctx.okAt(x, z) && !(ctx.poolAt && (cd === 3 || cd === 7) && ctx.poolAt(x, z) > 0.5)) ? 1 : 0;   // no tuft in a puddle (the shader's pools, in JS)
        let cv = null; try { cv = ctx.coverAt ? ctx.coverAt(x, z) : null; } catch (e) { cv = null; }
        if (cv) { kill[k] = cv.kill || 0; boost[k] = cv.boost || 0; kind[k] = KIND[cv.kind] || 0;
          if (cv.grass) { lawnH[k] = cv.grass.h || 0.12; lawnD[k] = cv.grass.density === undefined ? 1 : cv.grass.density; }
          // a plot is the biome's ground with a lawn on it: the tuft stands, the mix does not
          if (kind[k] && !mix[k]) mix[k] = 'lawn'; if (kind[k] && !ok[k] && ctx.okAt(x, z)) ok[k] = 1; }
        const c = (cv && cv.col) ? cv.col : (cd >= 0 ? colAt(x, z, cd) : null) || imageryAt(x, z);
        if (c) { col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2]; } else { col[k * 3] = 0.3; col[k * 3 + 1] = 0.3; col[k * 3 + 2] = 0.15; }
      }
      const at = (x, z) => Math.round((z - z0) / SG) * N + Math.round((x - x0) / SG);
      let bmax = 0, lawn = 0; for (let k = 0; k < N * N; k++) { if (boost[k] > bmax) bmax = boost[k]; if (kind[k] === 1) lawn++; }
      return { N, mix, code, ok, col, kill, boost, kind, lawnH, lawnD, at, bmax, lawn };
    }

    // ---- one cell -------------------------------------------------------------------
    function buildCell(cx, cz) {
      const t0 = performance.now();
      STAT.building = cx + ',' + cz;
      const C = S.cell, x0 = cx * C, z0 = cz * C;
      const seed = (hsh(cx, cz) * 4294967295) >>> 0;
      const R = rng(seed);
      // the mix at the cell's centre says which species to plant; each point checks its own
      const G = subGrid(x0, z0, C);
      const centreMix = G.mix[G.at(x0 + C / 2, z0 + C / 2)];
      const group = new THREE.Group(); group.position.set(0, 0, 0);
      const cell = { group, n: 0, meshes: [], by: {} };   // by: this cell's tally per species (STAT.by is the live sum)
      cells.set(cx + ',' + cz, cell);
      if (!centreMix && !G.lawn) { root.add(group); STAT.lastMs = performance.now() - t0; return cell; }
      const M = BIO.mixOf(centreMix) || { species: {}, forest: {} }, F = M.forest || {};   // a cell of plots alone ('lawn' stands for a mix) plants its lawn and nothing else
      const blotch = F.blotch || 0, blotchM = F.blotchM || 18, spread = F.coverSpread === undefined ? 0.08 : F.coverSpread;
      if (GF && GF.C && GF.C.blotch) { GF.C.blotch.amount = blotch; GF.C.blotch.cellM = blotchM; }
      const blotchAt = (x, z, seed) => (GF && GF.blotch) ? GF.blotch(x, z, seed) : 1 - blotch * vnoise(x, z, blotchM, seed % 1000);
      const items = new Map();   // proto -> { pos: [], col: [] | null }
      // the instance record: x y z s yaw tx tz - tx/tz the ground's slope under a rock that `tilt`s to it (0 0 = upright)
      const push = (p, x, y, z, s, yaw, col, tx, tz) => { let it = items.get(p); if (!it) { it = { p, xs: [], col: col ? [] : null }; items.set(p, it); } it.xs.push(x, y, z, s, yaw, tx || 0, tz || 0); if (col) it.col.push(col[0], col[1], col[2]); };
      // THE SHORE (2026-09-22, the coast rock scans): a rock row's `shore` culls its rocks by the distance inland
      // (the island's coast field, positive inland): 1 keeps the water's edge and none past 15 m, 0 keeps all
      const coastAt = world.island && world.island.coastAt ? world.island.coastAt : null;
      // THE LAWN (a plot's, kind 1): the dry tuft short and dense - the height from the plot's rule (0.10-0.15 m),
      // LAWN_D tufts a m2 x the rule's density factor - on the lawn nodes alone, the biome's rows skip them
      if (G.lawn > 0) {
        const c = speciesOf().find(q => q.name === 'grass_dry');
        const P = c && protosOf(c);
        if (P && P.length) {
          const place = c.place || {}, LAWN_D = 6, n = Math.round(LAWN_D * C * C * G.lawn / (G.N * G.N)) * 2;   // twice the lawn share's count: half the draws fall off the lawn nodes
          const h0 = P[0].h0 || 1, lift = place.lift === undefined ? 1 : place.lift;
          for (let i = 0; i < n; i++) {
            const x = x0 + R() * C, z = z0 + R() * C, r2 = R(), r3 = R();
            const gk = G.at(x, z); if (G.kind[gk] !== 1 || !G.ok[gk]) continue;
            if (G.kill[gk] > 0 && R() < G.kill[gk]) continue;
            if (G.lawnD[gk] < 1 && R() > G.lawnD[gk]) continue;
            const p = draw(P, r2), y = world.terrainH(x, z);
            const s = ((G.lawnH[gk] || 0.12) / h0) * (0.85 + 0.3 * R());
            const col = lifted([G.col[gk * 3], G.col[gk * 3 + 1], G.col[gk * 3 + 2]], lift);
            push(p, x, y, z, s, r3 * Math.PI * 2, col); STAT.by.lawn = (STAT.by.lawn || 0) + 1; cell.by.lawn = (cell.by.lawn || 0) + 1;
          }
        }
      }
      for (const c of speciesOf()) {
        const row = M.species && M.species[c.name]; if (!row) continue;
        const place = c.place || {};
        const P = protosOf(c); if (!P.length) continue;
        const sSeed = hashStr(c.name);
        const isRock = c.kind === 'rock', isShrub = c.kind === 'shrub';
        let per = 0;   // per m2
        if (isRock) per = (F.rocks || 0) / 1000 * S.rocks * (row.proportion === undefined ? 1 : row.proportion);
        else if (isShrub) { const tot = Object.keys(M.species).filter(k => { const cc = pack.collections.find(q => q.name === k); return cc && cc.kind === 'shrub'; }).reduce((a, k) => a + (M.species[k].proportion === undefined ? 1 : M.species[k].proportion), 0) || 1;
          per = (F.under || 0) / 1000 * S.shrubs * (row.proportion === undefined ? 1 : row.proportion) / tot; }
        else per = (row.density !== undefined ? row.density : (place.density || 0)) * S.density;   // the bench: a cover's density is its own, no proportion
        if (per <= 0) continue;
        const patch = row.patch !== undefined ? row.patch : (place.patch || 0), share = place.patchShare || row.patchShare || 0.35;
        // the bench's beds: centres for 0.25 x patchShare of the area, each of radius `patch`,
        // so a bed stands at density / (0.25 share) - here the beds are the top slice of a noise
        const bedFrac = patch ? Math.min(1, 0.25 * share) : 1;
        const n = Math.round(per * C * C * (patch ? 1 / bedFrac : 1) * (1 + G.bmax));   // (1 + bmax): the border's boost is drawn from this envelope
        const lift = place.lift === undefined ? 1 : place.lift, noTint = !!place.noTint || !!c.maps;
        const vary = place.vary === undefined ? 0.05 : place.vary;
        for (let i = 0; i < n; i++) {
          const x = x0 + R() * C, z = z0 + R() * C, r1 = R(), r2 = R(), r3 = R();
          if (patch && vnoise(x, z, patch * 2, sSeed % 1000) < 1 - bedFrac) continue;
          // the bench's GF.blotch: keeps 1 - blotch .. 1 by area; rocks skip it unless their row says `cluster`
          // (THE ROCKY SHORE, 2026-09-22: a foreshore's rocks lie in beds along the tide line, not evenly)
          if (blotch && (!isRock || row.cluster) && r1 > blotchAt(x, z, sSeed)) continue;
          if (isRock && row.shore > 0 && coastAt) { const sd = coastAt(x, z); if (sd < -2 || R() > 1 - row.shore * smooth(2, 15, sd)) continue; }
          const gk = G.at(x, z);
          if (!G.ok[gk] || G.mix[gk] !== centreMix) continue;
          // the cover's query: nothing on a pavement (kill), more on a border (boost), a plot's lawn or
          // meadow or nothing instead of the biome's rows (the LAWN row is planted below, on its own)
          if (G.kind[gk] === 1 || G.kind[gk] === 3) continue;
          if (G.bmax > 0 || G.kill[gk] > 0) { const keep = (1 - G.kill[gk]) * (1 + G.boost[gk]) / (1 + G.bmax); if (keep < 1 && R() > keep) continue; }   // a rejection sampler: n was drawn at (1 + bmax) x
          const p = draw(P, r2);
          const y = world.terrainH(x, z);
          let s = 1, yaw = r3 * Math.PI * 2, col = null;
          if (isRock) { s = (row.size !== undefined ? row.size : (place.size || 1)) * Math.exp((R() * 2 - 1) * (place.sizeVar === undefined ? 0.35 : place.sizeVar)); }
          else if (isShrub && place.hMin !== undefined && place.hMax !== undefined && p.h0 > 0) s = (place.hMin + R() * (place.hMax - place.hMin)) / p.h0;
          else s = (place.size || 1) * Math.exp((R() * 2 - 1) * spread);   // the species' size ALWAYS (the reed model is 288 units tall at size 0.012 - unscaled it was a 130 m screen-filling card, 450 ms a frame)
          // a rock's row may say how deep it sits (`bury`, a fraction of its height; the shore's lie deeper)
          const yy = isRock ? y - p.h0 * s * (row.bury !== undefined ? row.bury : (place.bury === undefined ? 0.45 : place.bury)) : y - (place.sink || 0);
          if (isRock && row.tint > 0) {
            // the rock takes the ground's colour at its foot, by `tint` (0 = the pack's pale grey as it is, 1 = the
            // tufts' rule): the free_rock pack is one pale texture and read as gravel thrown on the dark foreshore
            // the ground's CHROMA (its colour at full brightness), not its value: a straight multiply by a dark
            // foreshore left the pack's own blue-grey showing through as lavender - the hue must be the ground's
            const g = [G.col[gk * 3], G.col[gk * 3 + 1], G.col[gk * 3 + 2]], gm = Math.max(g[0], g[1], g[2], 1e-3);
            const j = (1 + (R() * 2 - 1) * vary) * (1 - 0.35 * row.tint);   // and a third darker at full tint (the pack is pale)
            col = [(1 + (g[0] / gm - 1) * row.tint) * j, (1 + (g[1] / gm - 1) * row.tint) * j, (1 + (g[2] / gm - 1) * row.tint) * j];
          } else if (!noTint && !isRock && !isShrub) {
            col = lifted([G.col[gk * 3], G.col[gk * 3 + 1], G.col[gk * 3 + 2]], lift);
            if (vary) { const j = 1 + (R() * 2 - 1) * vary; col = [col[0] * j, col[1] * j, col[2] * j]; }
          } else if (noTint && !isRock && !isShrub && vary) { const j = 1 + (R() * 2 - 1) * vary; col = [j, j, j]; }
          // `tilt`: the rock leans to the ground's slope (a slab lies ON the foreshore, not level in it) - the slope
          // from terrainH at +-1.5 m, scaled by the row's tilt (1 = the ground's own)
          let tx = 0, tz = 0;
          // (over the rock's own footprint: a 10 m strip read at +-1.5 m stood on the wrong plane and showed its skirt as a plate)
          if (isRock && row.tilt > 0) { const rr = Math.max(1.5, 0.45 * p.r0 * s); tx = (world.terrainH(x + rr, z) - world.terrainH(x - rr, z)) / (2 * rr) * row.tilt; tz = (world.terrainH(x, z + rr) - world.terrainH(x, z - rr)) / (2 * rr) * row.tilt; }
          push(p, x, yy, z, s, yaw, col, tx, tz); STAT.by[c.name] = (STAT.by[c.name] || 0) + 1; cell.by[c.name] = (cell.by[c.name] || 0) + 1;
        }
      }
      // the meshes: one InstancedMesh per prototype part
      const T = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
      let yLo = Infinity, yHi = -Infinity; for (const it of items.values()) for (let i = 1; i < it.xs.length; i += 7) { if (it.xs[i] < yLo) yLo = it.xs[i]; if (it.xs[i] > yHi) yHi = it.xs[i]; }
      const NRM = new THREE.Vector3(), QT = new THREE.Quaternion();
      if (!isFinite(yLo)) { yLo = yHi = world.terrainH(x0 + C / 2, z0 + C / 2); }
      const yMid = (yLo + yHi) / 2, ySpan = (yHi - yLo) / 2;
      for (const it of items.values()) {
        const n = it.xs.length / 7; if (!n) continue;
        const rand = new Float32Array(n); for (let i = 0; i < n; i++) rand[i] = R();
        for (const part of it.p.parts) {
          const m = new THREE.InstancedMesh(part.geo, part.mat, n);
          for (let i = 0; i < n; i++) {
            const o = i * 7; Q.setFromAxisAngle(UP, it.xs[o + 4]); V.set(it.xs[o], it.xs[o + 1], it.xs[o + 2]); SC.setScalar(it.xs[o + 3]);
            if (it.xs[o + 5] || it.xs[o + 6]) { NRM.set(-it.xs[o + 5], 1, -it.xs[o + 6]).normalize(); QT.setFromUnitVectors(UP, NRM); Q.premultiply(QT); }   // the lean: up -> the ground's normal, after the yaw
            T.compose(V, Q, SC); m.setMatrixAt(i, T);
          }
          if (it.col) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(it.col), 3); }
          // the prototype's buffers shared, the instanced aRand per mesh: a thin geometry wrapper
          const geo = part.geo, g2 = new THREE.BufferGeometry(); g2.index = geo.index; for (const k in geo.attributes) g2.setAttribute(k, geo.attributes[k]);
          g2.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 1));
          // the cell's own sphere (the instances hold world positions, the mesh stands at the
          // origin): three culls the cell as one - half the ring is behind the eye
          g2.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + C / 2, yMid, z0 + C / 2), C * 0.71 + ySpan + 3);
          m.geometry = g2;
          m.frustumCulled = true;
          m.castShadow = it.p.kind !== 'cover'; m.receiveShadow = true;
          m.instanceMatrix.needsUpdate = true;
          group.add(m); cell.meshes.push(m);
        }
        cell.n += n;
      }
      root.add(group);
      STAT.built++; STAT.lastMs = performance.now() - t0; STAT.maxMs = Math.max(STAT.maxMs, STAT.lastMs); STAT.building = null;
      return cell;
    }
    function dropCell(key) {
      const cell = cells.get(key); if (!cell) return;
      root.remove(cell.group);
      for (const m of cell.meshes) { m.geometry.dispose(); }   // the wrapper only: buffers are the prototype's
      for (const k in cell.by) { STAT.by[k] -= cell.by[k]; if (STAT.by[k] <= 0) delete STAT.by[k]; }   // the tally is LIVE (it ran up for the page's life before L4)
      cells.delete(key);
    }

    // ---- per frame ------------------------------------------------------------------
    let queue = [];
    function update() {
      if (!S.on || !pack || !BIO) { if (root.visible) root.visible = false; return; }
      const ex = camera.position.x, ez = camera.position.z, gy = world.terrainH(ex, ez);
      const agl = Math.max(0, camera.position.y - gy); STAT.agl = agl;
      const aglK = 1 - smooth(S.aglFull, S.aglOff, agl);
      LEAF.fade(S.near, S.reach, S.taper, aglK);
      root.visible = aglK > 0.001;
      if (aglK <= 0.001) { if (cells.size) for (const k of [...cells.keys()]) dropCell(k); queue.length = 0; STAT.live = 0; return; }
      const C = S.cell, R2 = (S.reach + C) * (S.reach + C), Rdrop = (S.reach + 2 * C) * (S.reach + 2 * C);
      const cx0 = Math.floor(ex / C), cz0 = Math.floor(ez / C), nr = Math.ceil((S.reach + C) / C);
      queue.length = 0;
      for (let dz = -nr; dz <= nr; dz++) for (let dx = -nr; dx <= nr; dx++) {
        const cx = cx0 + dx, cz = cz0 + dz;
        const mx = (cx + 0.5) * C - ex, mz = (cz + 0.5) * C - ez, d2 = mx * mx + mz * mz;
        if (d2 > R2) continue;
        if (!cells.has(cx + ',' + cz)) queue.push([d2, cx, cz]);
      }
      queue.sort((a, b) => a[0] - b[0]);
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < S.budgetMs && cells.size < S.maxCells) { const [, cx, cz] = queue.shift(); buildCell(cx, cz); }
      for (const [k, cell] of cells) { const [cx, cz] = k.split(',').map(Number); const mx = (cx + 0.5) * C - ex, mz = (cz + 0.5) * C - ez; if (mx * mx + mz * mz > Rdrop) dropCell(k); }
      STAT.live = cells.size; STAT.queued = queue.length;
      let ni = 0; for (const c of cells.values()) ni += c.n; STAT.instances = ni;
      STAT.mixAt = ctx.biomeAt(ex, ez, 0.5);
    }
    const api = {
      update, root,
      get: () => Object.assign({}, S),
      set: o => { const was = { cell: S.cell, density: S.density, shrubs: S.shrubs, rocks: S.rocks }; Object.assign(S, o || {});
        if (S.cell !== was.cell || S.density !== was.density || S.shrubs !== was.shrubs || S.rocks !== was.rocks) api.replant(); return api.get(); },
      replant: () => { for (const k of [...cells.keys()]) dropCell(k); },
      stat: () => Object.assign({}, STAT, { by: Object.assign({}, STAT.by) }),   // a copy of the tally too (a shallow copy shared it)
      dispose: () => { api.replant(); scene.remove(root); },
    };
    return api;
  }
  return { make };
})();
if (typeof window !== 'undefined') window.COVER_RING = COVER_RING;
