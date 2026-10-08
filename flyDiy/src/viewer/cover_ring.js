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
  // the library's means (linear rgb, the importer's measure, carried by ground_tex.js), until the
  // manifest carries them (SPLAT_TEX_SETS[i].mean)
  const MEANS = { beach: [0.2826, 0.2371, 0.196], rocksA: [0.2155, 0.1901, 0.107], rocksB: [0.1648, 0.1158, 0.046], mud: [0.0897, 0.0702, 0.0458],
    leaves: [0.2264, 0.1177, 0.0461], cliff: [0.3136, 0.1726, 0.11], rocksG: [0.2521, 0.2134, 0.1638], rockyA: [0.0807, 0.0773, 0.0122],
    rockyB: [0.0855, 0.053, 0.0176], grassRock: [0.169, 0.1211, 0.0241], forestAir: [0.1259, 0.083, 0.026], snowAir: [0.2491, 0.2483, 0.3039],
    lush: [0.0584, 0.1065, 0.0218], grass: [0.119, 0.1528, 0.0305], pebble: [0.2178, 0.2034, 0.1649], dry: [0.3005, 0.2486, 0.1239], dirt: [0.1326, 0.1085, 0.0826] };
  const meanRaw = key => {
    if (typeof SPLAT_TEX_SETS !== 'undefined' && SPLAT_TEX_SETS) { const s = SPLAT_TEX_SETS.find(x => x.key === key); if (s && s.mean) return s.mean; }
    return MEANS[key] || [0.15, 0.15, 0.08];
  };
  // THE SET'S MEAN IN THE BENCH'S UNITS - which is the whole of why the game's grass was a
  // black mask while the bench's, on the SAME dials, is a meadow.
  //
  // The bench (tools/_trees.html, GROUND_MEANS) measures a ground set by drawing it to a
  // canvas and averaging the BYTES, then stores that through `new THREE.Color(r/255, ...)`,
  // which reads its arguments in the WORKING (linear) space. So the number the tuft is
  // multiplied by is the texture's sRGB mean USED AS IF IT WERE LINEAR. That is not
  // colour-managed, and it is also the number every cover dial in the payload was fitted
  // against - `lift`, `contrast`, `light`, all of them.
  // This file instead took means.json, which holds the TRUE LINEAR means, and then applied
  // the splat's hand grade and G485's normalisation to the imagery on top. Measured on the
  // two sets the grassland mix uses:
  //     dry    bench 0.581,0.533,0.383   here 0.3005 x 0.19 = 0.057   -> 10.2x darker
  //     grass  bench 0.378,0.426,0.190   here 0.1190 x 0.37 = 0.044   ->  8.6x darker
  // With the same `lift` that lands a tuft's instanceColor at ~0.006 - an albedo where grass
  // is 0.10-0.20 - so the texel was multiplied into nothing and what reached the screen was
  // sky ambient on a silhouette. It is also why setting `contrast` and `sat` changed nothing
  // in an A/B: they are upstream of a multiply by zero.
  //
  // So the mean is handed over the bench's way: the set's mean sRGB-ENCODED, and no grade and
  // no normalisation, because the bench has neither. srgbEncode(linear mean) reproduces the
  // bench's measured GROUND_MEANS to within 1 % on both sets (dry 0.584 vs 0.581 measured,
  // grass 0.380 vs 0.378), so no second table has to ship.
  // If the drawn ground then reads dark under the tufts, it is the GROUND that moves: the
  // bench's other rule is that the ground wears the grass's colour, not the reverse.
  const srgbEnc = v => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const meanOf = key => meanRaw(key).map(srgbEnc);
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
  // ---- THE BEDS: where a cover row with a `patch` grows (fireweed, foam, bunchberry) ----------
  // The bench plants a bed as a DISC of radius `patch` round a random centre, beds covering
  // 0.25 x patchShare of the ground - the user: "super circular spots". This file thresholded
  // one octave of value noise at 1 - bedFrac instead, and that never delivered the area: a
  // bilinear value noise has thin tails, so measured on the game's own noise the beds covered
  // 0.87 % where foam and bunchberry intend 6.25 % (14 % of it) and 0.21 % where fireweed
  // intends 3 % (7 %) - a handful of specks at the noise's peaks, which is why fireweed was
  // never seen. The count was scaled up for an area that never materialised.
  // THE BENCH'S SHAPE, LESS ROUND. A thresholded noise field cannot hold a bed's SIZE and the
  // beds' SPACING at once (tried: a fine field shreds into slivers, a coarse one makes a few huge
  // blobs), and the bench's own method can: centres, and a radius of `patch`. So its structure
  // is kept and only the outline changes -
  //   - one bed per square of side patch x sqrt(pi / share), its centre jittered inside it: the
  //     beds cover the intended share by construction, as the bench's centres do
  //   - its radius `patch` x a scale of its own (0.7 - 1.3: the bench gives every bed its own
  //     density; here its own size), turned by three low harmonics of the angle, so a bed is
  //     lobed rather than a disc
  //   - a rim that wobbles with a small noise, and a soft ramp across it, so the tufts thin out
  //     raggedly into the grass instead of stopping on an outline
  // Deterministic and world-anchored: a bed is where it is whatever the eye does.
  const BED_NORM = 1.0;    // measured: with this the three flowers realise their intended share to within a few %
  const bedKeep = (x, z, patch, seed, frac) => {
    const sp = patch * Math.sqrt(Math.PI / frac), cx0 = Math.floor(x / sp), cz0 = Math.floor(z / sp);
    let best = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const ci = cx0 + i, cj = cz0 + j;
      const bx = (ci + 0.15 + 0.7 * hsh(ci * 3 + seed, cj * 5 - seed)) * sp;
      const bz = (cj + 0.15 + 0.7 * hsh(ci * 7 - seed, cj * 11 + seed)) * sp;
      const sc = 0.7 + 0.6 * hsh(ci * 13 + seed * 3, cj * 17 + 1);
      const dx = x - bx, dz = z - bz;
      if (dx * dx + dz * dz > (patch * sc * 2.4) * (patch * sc * 2.4)) continue;
      // its own oval: stretched 1 - 1.6x along an axis of its own, then its outline turned by
      // weak low harmonics - irregular, and never one repeated motif
      const psi = hsh(ci * 29 + 3, cj * 31 - seed) * 3.1416, el = 1 + 0.6 * hsh(ci * 37 - 5, cj * 41 + seed);
      const cs = Math.cos(psi), sn = Math.sin(psi), u = (dx * cs + dz * sn) / Math.sqrt(el), v = (dz * cs - dx * sn) * Math.sqrt(el);
      const d = Math.hypot(u, v), th = Math.atan2(v, u), ph = hsh(ci * 19 + 7, cj * 23 + seed * 5) * 6.2832;
      const r = patch * sc * BED_NORM * (1 + 0.20 * Math.sin(2 * th + ph) + 0.12 * Math.sin(3 * th + ph * 1.7) + 0.07 * Math.sin(5 * th + ph * 2.3));
      const rim = r * (1 + 0.5 * (vnoise(x, z, patch * 0.55, seed + 91) - 0.5));
      const k = 1 - smooth(rim * 0.8, rim * 1.12, d);
      if (k > best) best = k;
    }
    return best; };

  // ---- THE GRASS FIELD'S TABLES (GRASS-DENSE G2563; GRASS-STUDY §4.4) ---------------------------------------------------
  // the species the field plants (the reed, the one grass of every biome since G551) and, per MIX, the tuft's length: `h` its
  // median top (m), `sigma` the lognormal spread, `dens` a factor on the field's tufts a square metre (1 = the meadow), and the
  // clump field's cell / amplitude (neighbours share a length). A mix row of the reed may carry its own h / sigma / dens (the
  // biome's grass card, TYPES > biome) - the row wins. A mix not named is the meadow's.
  const FIELD_SPECIES = ['grass_reed'];
  const SIZE_MAX = 1.5;   // the size fade's ceiling: a tuft taller than the reference reaches at most 1.5 x the reach (trees.js FADE_VS, the same clamp)
  const FIELD_TYPES = {
    grassland:     { h: 0.30, sigma: 0.35, dens: 1.0 },                      // heath (2): the meadow, the reference
    muskeg:        { h: 0.40, sigma: 0.30, dens: 0.8, clumpM: 1.5, clumpAmp: 0.4 },   // muskeg (3) and scrub (7): sedge-like tussocks
    conifer_scrub: { h: 0.35, sigma: 0.35, dens: 0.9 },                      // dense scrub (14)
    conifer:       { h: 0.20, sigma: 0.30, dens: 0.35 },                     // the forest floor: short, sparse, shaded (13)
    conifer_young: { h: 0.20, sigma: 0.30, dens: 0.35 },                     // forest (8)
    conifer_steep: { h: 0.20, sigma: 0.30, dens: 0.35 },                     // rock / cliff (6, 12)
    deciduous:     { h: 0.25, sigma: 0.35, dens: 0.5 },
    borders:       { h: 0.40, sigma: 0.40, dens: 1.1 },                      // lush (15): the field edge
    village:       { h: 0.18, sigma: 0.25, dens: 0.6 },                      // built (10)
    city_trees:    { h: 0.15, sigma: 0.25, dens: 0.5 },                      // the town's wood (16)
  };
  const FIELD_MEADOW = FIELD_TYPES.grassland;
  // THE TUFT (GRASS-STUDY §4.2): the shipped patch's CARDS (its connected strips, by the index buffer) grouped K nearest to
  // nearest, each group one small geometry - the patch's own vertices, normals, uvs and AO, the group moved as a whole so its
  // foot is at the origin (a card is not bent, cut or redrawn). Of all the tufts the `keep` closest to the median one (its top,
  // its triangles) are the variants a draw holds, as the three patches were. -> [{ geo, top (units), tris }]
  function tuftsOf(THREE, geos, K, keep) {
    const all = [];
    for (const geo of geos) {
      const P = geo.attributes.position, I = geo.index; if (!P || !I) continue;
      const nv = P.count, idx = I.array, nt = idx.length / 3;
      const par = Int32Array.from({ length: nv }, (_, i) => i), f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
      const u = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
      for (let t = 0; t < nt; t++) { u(idx[t * 3], idx[t * 3 + 1]); u(idx[t * 3], idx[t * 3 + 2]); }
      const comp = new Map();
      for (let t = 0; t < nt; t++) { const r = f(idx[t * 3]); let c = comp.get(r); if (!c) comp.set(r, c = { tris: [], vs: new Set() }); c.tris.push(t); for (let k = 0; k < 3; k++) c.vs.add(idx[t * 3 + k]); }
      const cards = [...comp.values()].map(c => { let sx = 0, sz = 0; for (const i of c.vs) { sx += P.getX(i); sz += P.getZ(i); } return Object.assign(c, { x: sx / c.vs.size, z: sz / c.vs.size }); });
      cards.sort((a, b) => (b.x * b.x + b.z * b.z) - (a.x * a.x + a.z * a.z));   // outermost first (the study's greedy groups)
      const used = new Set();
      for (const a of cards) { if (used.has(a)) continue; used.add(a);
        const near = cards.filter(b => !used.has(b)).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z)).slice(0, K - 1);
        near.forEach(b => used.add(b));
        all.push({ geo, cards: [a, ...near] }); }
    }
    for (const t of all) { let sx = 0, sz = 0, n = 0, top = 0, tris = 0;
      for (const c of t.cards) { for (const i of c.vs) { sx += t.geo.attributes.position.getX(i); sz += t.geo.attributes.position.getZ(i); n++; top = Math.max(top, t.geo.attributes.position.getY(i)); } tris += c.tris.length; }
      t.cx = sx / n; t.cz = sz / n; t.top = top; t.tris = tris; }
    const med = k => { const a = all.map(t => t[k]).sort((x, y) => x - y); return a[a.length >> 1] || 1; };
    const mTop = med('top'), mTris = med('tris');
    const pick = all.slice().sort((a, b) => (Math.abs(a.top - mTop) / mTop + Math.abs(a.tris - mTris) / mTris) - (Math.abs(b.top - mTop) / mTop + Math.abs(b.tris - mTris) / mTris)).slice(0, keep);
    return pick.map(t => {
      const src = t.geo, map = new Map(), out = new THREE.BufferGeometry(), ix = [];
      for (const c of t.cards) for (const tri of c.tris) for (let k = 0; k < 3; k++) { const v = src.index.array[tri * 3 + k]; if (!map.has(v)) map.set(v, map.size); ix.push(map.get(v)); }
      const order = [...map.keys()];
      for (const name in src.attributes) {   // the raw stored values, the same type (a normalised byte stays one)
        const A = src.attributes[name], sz = A.itemSize, IL = A.isInterleavedBufferAttribute, raw = IL ? A.data.array : A.array, st = IL ? A.data.stride : sz, o0 = IL ? A.offset : 0;
        const arr = new raw.constructor(order.length * sz);
        order.forEach((v, j) => { for (let q = 0; q < sz; q++) arr[j * sz + q] = raw[v * st + o0 + q]; });
        if (name === 'position') for (let j = 0; j < order.length; j++) { arr[j * 3] -= t.cx; arr[j * 3 + 2] -= t.cz; }   // the tuft's foot to the origin, whole
        out.setAttribute(name, new THREE.BufferAttribute(arr, sz, A.normalized)); }
      out.setIndex(ix); out.computeBoundingSphere();
      return { geo: out, top: t.top, tris: t.tris };
    });
  }

  function make(THREE, ctx) {
    const { scene, world, camera, treeBuild, treeList, LEAF, BIO, GF } = ctx;
    // THE GRASS FIELD (GRASS-DENSE G2563, futureDesigns/GRASS-STUDY-2026-10.md §4): ctx.layer 'grass' makes a SECOND ring of
    // this file that plants the grass alone - the same cards cut into tufts of `cards` (protosOf: tuftsOf), on 16 m cells
    // drawn by 2 x 2 blocks, ten times the cards a square metre a third the height, the length by the ground (FIELD_TYPES),
    // cut beside and on the runways (the premises' coverAt `cut` / `surf`), in the ground's drawn colour (ctx.groundMeanAt),
    // to its own reach by its own fade set (trees.js fadeSet, with the size fade), and planted by TIERS (a cell keeps the
    // prefix of its candidate stream its nearest distance can show). The first ring then leaves the grass to it (ctx.owned).
    const FIELD = ctx.layer === 'grass';
    const FSET = FIELD && LEAF.fadeSet ? LEAF.fadeSet() : null;
    const S = FIELD
      ? { on: true, cell: 16, reach: 90, near: 15, taper: 1, aglFull: 27, aglOff: 90, density: 1, shrubs: 0, rocks: 0, budgetMs: 3, maxCells: 1400, blockBudget: 4, debrisKinds: 4, castMinH: 99, batch: false,
          aglPre: 150, preBudgetMs: 2, lead: 4, grow: 0.8, growNear: 60,
          tufts: 90, cards: 3, sizeFade: 1, hRef: 0.3, blotch: 0.3, clumpM: 4, clumpAmp: 0.3, hK: 1, sigmaK: 1, tier: 1, trunc: 1,
          colour: 1, match: 1, vary: 0.05, cutH: 0.08, cutSigma: 0.1, cutDens: 1.2, stripH: 0.07, stripDens: 1 }
      : { on: true, cell: 32, reach: 220, near: 50, taper: 0.5, aglFull: 60, aglOff: 150, density: 2, shrubs: 1, rocks: 1, budgetMs: 4, maxCells: 400, blockBudget: 2, debrisKinds: 4, castMinH: 0.35, batch: true,
          aglPre: 260, preBudgetMs: 2, lead: 4, grow: 0.8, growNear: 140, trunc: 1 };   // G670/G671: the grow, the pre-grow and the lead (update)   // density 2 (2026-09-22, the user: "the grass is really too sparse")
    if (FIELD) try { if (/[?&]grassfield=0/.test(location.search)) S.on = false; } catch (e) {}   // ?grassfield=0: today's grass (the first ring's patches) - the A/B
    const pack = (typeof TREE_PACK !== 'undefined') ? TREE_PACK : null;
    const cells = new Map();            // cellKey(cx, cz) -> { n, parts, inst, by, cx, cz, box }
    // G603 (A1-STAND): a cell's key is a NUMBER - update() asked the map for ~290 cells a frame by a fresh 'cx,cz'
    // string each, and split every live cell's key back into numbers to test its reach
    const cellKey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
    const protos = new Map();           // species key -> [{ key, w, parts:[{geo, mat}], h, kind }]
    const STAT = { built: 0, lastMs: 0, maxMs: 0, live: 0, queued: 0, instances: 0, agl: 0, mixAt: null, by: {} };
    let flowerTex = new Map();
    const root = new THREE.Group(); root.name = 'coverRing'; scene.add(root);

    // ---- the prototypes: every species of the kinds the ring plants, built once ------
    // (debris - the logs, sticks and stumps of vegetation/branches - is the rock machinery on its own density: F.debris)
    // (the field plants FIELD_SPECIES alone; the first ring every cover kind but what the field holds while it is on - ctx.owned)
    const speciesOf = () => (pack ? pack.collections : []).filter(c => FIELD ? FIELD_SPECIES.includes(c.name)
      : ['cover', 'shrub', 'rock', 'debris'].includes(c.kind) && !(ctx.owned && ctx.owned(c.name)));
    const rockish = c => c.kind === 'rock' || c.kind === 'debris';
    const measureMean = mat => {   // the map's mean lightness (HSL l of the sRGB mean over the kept texels) - the bench's measureMats
      const img = mat.map && mat.map.image; if (!img || !img.width) return;
      try {
        const c = measureMean.cnv || (measureMean.cnv = document.createElement('canvas')); c.width = c.height = 64;
        const g = c.getContext('2d', { willReadFrequently: true }); g.clearRect(0, 0, 64, 64); g.drawImage(img, 0, 0, 64, 64);
        const d = g.getImageData(0, 0, 64, 64).data; let R = 0, G = 0, B = 0, n = 0;
        const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        let lr = 0, lg = 0, lb = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; R += d[i]; G += d[i + 1]; B += d[i + 2]; lr += lin(d[i]); lg += lin(d[i + 1]); lb += lin(d[i + 2]); n++; }
        if (!n) return;
        const mx = Math.max(R, G, B) / n / 255, mn = Math.min(R, G, B) / n / 255;
        mat.userData.uFlatMean.value = (mx + mn) / 2;
        const had = !!mat.userData.texMean;
        mat.userData.texMean = [lr / n, lg / n, lb / n];   // G2562: the kept texels' mean, linear (the field's colour is the ground's over it)
        if (FIELD && !had && cells.size) api.replant();
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
      const m = MATLIB.make(THREE, 'cut', { map: t, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
      // no normal override (the bench has none): upHook forced the object normal up on this
      // DoubleSide card, which three flips to (0,-1,0) on the back face - half of every flower dark
      LEAF.fadeHook(m); return m;
    };
    function protosOf(c) {
      let P = protos.get(c.name);
      if (P) return P;
      P = [];
      const place = c.place || {};
      if (c.maps && c.maps.length) {                         // a flower: its pictures on cards
        c.maps.forEach((url, v) => P.push({ key: c.name + '|' + v, w: 1 / c.maps.length, kind: 'cover', h: place.size || 1, noTint: true,
                                            // built at UNIT height: the instance scale carries `size`, in metres, once -
                                            // as the bench (flowerCards(t.size) and a jitter). Built at size AND scaled by
                                            // it, fireweed stood 1.7 x 1.7 = 2.75 m, bunchberry 0.19 m against 0.43.
                                            parts: [{ geo: flowerCards(1, place.aspect || 1, hashStr(c.name) + v * 977), mat: flowerMat(url) }] }));
      } else {
        let subs = treeList('all').filter(e => e.col === c);
        // THE DEBRIS'S VARIETY IS ITS DRAW COUNT (PERF 2026-09-23): every model is a draw in every block and a shadow
        // draw - the two stick packs alone were 32 models, ~600 draws in a forest view. A debris pack keeps
        // S.debrisKinds of its models, evenly across its size range; the planting is the same (the pack's density,
        // spread over fewer shapes)
        if (c.kind === 'debris' && S.debrisKinds > 0 && subs.length > S.debrisKinds) {
          const hOf = e => (e.sub.bb ? e.sub.bb[4] - e.sub.bb[1] : (e.sub.h || 1));
          const sorted = subs.slice().sort((a, b) => hOf(a) - hOf(b)), n = S.debrisKinds;
          subs = Array.from({ length: n }, (_, k) => sorted[Math.round(k * (sorted.length - 1) / Math.max(1, n - 1))]);
        }
        // ONE MATERIAL PER MAP (G585): a rock's material is a plain copy made per part - the same values, the same
        // program - and a species' models mostly share one picture (the census: 16 rock parts on 4 maps). Shared, the
        // parts that wear the same picture can be one batch (below) instead of one draw each
        const plain = new Map();
        for (const e of subs) {
          let b = null; try { b = treeBuild(THREE, e.key, 0, 'rungs'); } catch (err) { continue; }
          if (!b || !b.parts.length) continue;
          const parts = b.parts.map(q => {
            let mat = q.mat;
            if (rockish(c) && plain.has(q.mat.map || null)) mat = plain.get(q.mat.map || null);
            else if (rockish(c)) {                              // the leaf hook's AO attribute drew the rocks black (the bench): a plain copy
              mat = MATLIB.make(THREE, 'std', { map: q.mat.map || null, roughness: 1, metalness: 0 });   // the ring's own: its fade (and a cut) hook it
              plain.set(q.mat.map || null, mat);
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
              LEAF.fadeHook(mat, FIELD ? FSET : null);   // (the field's own fade set: its reach, its size fade)
              // NO NORMAL OVERRIDE ON A COVER - the bench has none (tools/_trees.html builds a
              // cover's material from the pack's own and never touches its normal), and the
              // game's `upHook` (G484's UP_VS) was worse than a divergence: it forces the OBJECT
              // normal up on a DoubleSide material, and three's normal_fragment_begin then flips
              // it to (0,-1,0) on every back face - half the tufts black, by where the camera
              // stood. The mesh's own normals, as the bench draws them (and the flowers too, in
              // flowerMat above).
              // THE COVER KEEPS THE BENCH'S MASTER, because the game's was retuned for the
              // CONIFER CANOPY and the grass was collateral. trees.js says so itself: "the
              // conifer sheets' mean albedo as baked is 0.043 linear; the imagery's forest
              // cells read 0.026 ... light 1.12 -> 0.6 puts the rendered canopy on the
              // imagery's level; sat 1.58 -> 1.2". That measurement is about spruce, and it
              // takes the cover down with it - uLight 3 x 0.6 = 1.8 where the bench, on the
              // same payload dial, renders 3 x 1.12 = 3.36. A further 1.87x on top of the
              // tint's ~9x (see meanOf above). The bench's committed master is the one every
              // cover dial was fitted under, so cover is given it back; the trees keep theirs.
              // (G1385: trees.js retint now applies it - COVER_BASE, the same numbers - and the grass's own master on top,
              // so a master or a species tint moved later keeps it; asked again here for a material hooked before)
              if (c.kind === 'cover' && mat.userData.uLight && LEAF.retint) LEAF.retint(mat);
              if (c.kind === 'cover' && mat.userData.uFlat) { mat.userData.uFlat.value = place.contrast === undefined ? 1 : place.contrast; measureMean(mat);
                if (mat.map && !(mat.map.image && mat.map.image.width)) { const t0 = mat.map; const poll = () => { if (t0.image && t0.image.width) measureMean(mat); else setTimeout(poll, 500); }; setTimeout(poll, 500); } }
            }
            // A COVER CARRIES NO BAKED OCCLUSION - the bench forces it to 1 at load
            // (tools/_trees.html, `ensureAoAttr(o.geometry, 1)` over every cover group: "a grass
            // clump is eight triangles at ground level and the bake under aoBake 4 blackened its
            // base"). tree_prep never learnt that, so grass_reed ships 0.565..1.0 in its bin,
            // which at uAoBake 4 is pow(0.565, 4) = 0.10 of the ambient at its darkest vertices.
            // The bench's rule, applied here to the only geometry that is cover.
            if (c.kind === 'cover') { const A = q.geo.getAttribute('aoV'); if (A) { A.array.fill(1); A.needsUpdate = true; } }
            return { geo: q.geo, mat };
          });
          const h = (e.sub.bb ? e.sub.bb[4] - e.sub.bb[1] : (e.sub.h || 1)) * (place.size || 1);
          P.push({ key: e.key, w: 1 / subs.length, kind: c.kind, h, h0: (e.sub.bb ? e.sub.bb[4] - e.sub.bb[1] : (e.sub.h || 1)), parts, size: place.size || 1,
                   r0: e.sub.bb ? Math.max(e.sub.bb[3] - e.sub.bb[0], e.sub.bb[5] - e.sub.bb[2]) / 2 : 1 });   // half its footprint: a slab's tilt is read over its own extent
        }
        // THE FIELD'S TUFTS: the patches' cards in groups of S.cards, the three median ones the variants (tuftsOf above); one
        // material (the patches share the reed's), h0 the tuft's own top in the model's units (the height a scale is asked for)
        if (FIELD && c.kind === 'cover' && P.length && P[0].parts.length) {
          const mat = P[0].parts[0].mat, T = tuftsOf(THREE, P.map(p => p.parts[0].geo), Math.max(1, S.cards | 0), 3);
          P.length = 0;
          T.forEach((t, i) => P.push({ key: c.name + '|tuft' + i, w: 1 / T.length, kind: 'cover', h: t.top, h0: t.top, parts: [{ geo: t.geo, mat }], size: 1, r0: 1, tris: t.tris }));
        }
      }
      if (P.length) protos.set(c.name, P);   // G908: an empty set is not kept - its bins may come later (a grown tree catalogue)
      P.species = c.name;
      for (const p of P) p.all = P;   // a prototype knows its species' set (the batches are sized from it)
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
    // (the bench's cover master - tools/_trees_tuning.json `master`, sat 1.58 light 1.12 - is trees.js COVER_BASE since G1385)
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
    // G1385 (EDITOR-VEG): the strips' own clearances that keep the bushes out (20_world.js bushAeroBlocked)
    const bushOff = world.bushAeroBlocked || null;
    // IS THERE A PAVEMENT AT THIS NODE? (v1.17 coverAt's `cls`). The vocabulary is the premises' own -
    // grass, asphalt, concrete, worn, gravel, dirt, sand - plus the analytic world's asphalt / gravel / grass,
    // so the test is "a class at all", not a list to keep in step. The debris reads it because a GRASS strip's
    // `kill` never passes 0.6 (it is the world's grass, mown), and kill alone would leave a log lying across a
    // grass runway (the roads session, 2026-09-22).
    function subGrid(x0, z0, C) {
      const N = Math.round(C / SG) + 1, mix = new Array(N * N), code = new Int16Array(N * N), ok = new Uint8Array(N * N), col = new Float32Array(N * N * 3);
      const bush = new Uint8Array(N * N);   // G1385: inside a strip's own clearance that keeps the bushes out
      const kill = new Float32Array(N * N), boost = new Float32Array(N * N), kind = new Uint8Array(N * N), lawnH = new Float32Array(N * N), lawnD = new Float32Array(N * N), cls = new Uint8Array(N * N);
      const cut = new Float32Array(N * N), surf = new Uint8Array(N * N);   // G2565: the premises' cut grass (the 'sides' law)
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = x0 + i * SG, z = z0 + j * SG, k = j * N + i, r = hsh(Math.round(x * 3.7), Math.round(z * 5.3));
        const cd = ctx.codeAt ? ctx.codeAt(x, z, r) : -1;
        code[k] = cd; mix[k] = BIO.mixHere ? BIO.mixHere(cd, x, z) : (cd < 0 ? null : BIO.mixAt(cd)); bush[k] = bushOff && bushOff(x, z) ? 1 : 0; ok[k] = (ctx.okAt(x, z) && !(ctx.poolAt && (cd === 3 || cd === 7) && ctx.poolAt(x, z) > 0.5)) ? 1 : 0;   // no tuft in a puddle (the shader's pools, in JS)
        let cv = null; try { cv = ctx.coverAt ? ctx.coverAt(x, z) : null; } catch (e) { cv = null; }
        if (cv) { kill[k] = cv.kill || 0; boost[k] = cv.boost || 0; kind[k] = KIND[cv.kind] || 0; cls[k] = cv.cls ? 1 : 0; cut[k] = cv.cut || 0; surf[k] = cv.surf ? 1 : 0;
          if (cv.grass) { lawnH[k] = cv.grass.h || 0.12; lawnD[k] = cv.grass.density === undefined ? 1 : cv.grass.density; }
          // a plot is the biome's ground with a lawn on it: the tuft stands, the mix does not
          if (kind[k] && !mix[k]) mix[k] = 'lawn'; if (kind[k] && !ok[k] && ctx.okAt(x, z)) ok[k] = 1; }
        // THE FIELD'S COLOUR IS THE GROUND AS DRAWN (G2562): the splat's mean at the point (splat_ground meanAt, through
        // ctx.groundMeanAt) - except ON a grass pavement, which draws its own (cv.col: the class's set as graded)
        let c;
        if (FIELD && S.colour && ctx.groundMeanAt) c = (cv && cv.col && (cv.surf || (cv.cls === 'grass' && cv.kill > 0.5))) ? cv.col : (cd >= 0 ? ctx.groundMeanAt(x, z, cd) : null) || imageryAt(x, z);
        else c = (cv && cv.col) ? cv.col : (cd >= 0 ? colAt(x, z, cd) : null) || imageryAt(x, z);
        if (c) { col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2]; } else { col[k * 3] = 0.3; col[k * 3 + 1] = 0.3; col[k * 3 + 2] = 0.15; }
      }
      const at = (x, z) => Math.round((z - z0) / SG) * N + Math.round((x - x0) / SG);
      let bmax = 0, lawn = 0, paved = false; for (let k = 0; k < N * N; k++) { if (boost[k] > bmax) bmax = boost[k]; if (kind[k] === 1) lawn++; if (kill[k] > 0 || cut[k] > 0 || boost[k] > 0 || kind[k]) paved = true; }
      const G = { N, mix, code, ok, col, kill, boost, kind, cls, lawnH, lawnD, at, bmax, lawn, bush, cut, surf };
      if (FIELD) {
        // the colour between the nodes (bilinear: the imagery is 10 m, the nodes 4 m - a tuft's root on its own colour)
        G.colB = (x, z) => { const fx = Math.min(N - 1.001, Math.max(0, (x - x0) / SG)), fz = Math.min(N - 1.001, Math.max(0, (z - z0) / SG)), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
          const o = [0, 0, 0]; for (const [di, dj, w] of [[0, 0, (1 - tx) * (1 - tz)], [1, 0, tx * (1 - tz)], [0, 1, (1 - tx) * tz], [1, 1, tx * tz]]) { const k = (j + dj) * N + i + di; o[0] += col[k * 3] * w; o[1] += col[k * 3 + 1] * w; o[2] += col[k * 3 + 2] * w; }
          return o; };
        // THE GROUND'S HEIGHT ON A 2 m LATTICE (bilinear): a tuft a terrainH was the planting's cost at ten times the count
        const HG = 2, NH = Math.round(C / HG) + 1, hg = new Float32Array(NH * NH);
        for (let j = 0; j < NH; j++) for (let i = 0; i < NH; i++) hg[j * NH + i] = world.terrainH(x0 + i * HG, z0 + j * HG);
        G.hAt = (x, z) => { const fx = Math.min(NH - 1.001, Math.max(0, (x - x0) / HG)), fz = Math.min(NH - 1.001, Math.max(0, (z - z0) / HG)), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * NH + i;
          return (hg[k] * (1 - tx) + hg[k + 1] * tx) * (1 - tz) + (hg[k + NH] * (1 - tx) + hg[k + NH + 1] * tx) * tz; };
        // A CELL BY A PAVEMENT ASKS THE PREMISES EVERY METRE (the 4 m node is 2.8 m from the tuft it decides, and the drawn side
        // is 1.8 m): kill, cut, surf, boost, kind and the land test on a 1 m lattice, the tuft reads the nearest
        if (paved && ctx.coverAt) {
          const NF = C + 1, F = { NF, kill: new Float32Array(NF * NF), cut: new Float32Array(NF * NF), surf: new Uint8Array(NF * NF), boost: new Float32Array(NF * NF), kind: new Uint8Array(NF * NF), ok: new Uint8Array(NF * NF) };
          for (let j = 0; j < NF; j++) for (let i = 0; i < NF; i++) {
            const x = x0 + i, z = z0 + j, k = j * NF + i, cd = code[at(x, z)];
            let cv = null; try { cv = ctx.coverAt(x, z); } catch (e) { cv = null; }
            if (cv) { F.kill[k] = cv.kill || 0; F.cut[k] = cv.cut || 0; F.surf[k] = cv.surf ? 1 : 0; F.boost[k] = cv.boost || 0; F.kind[k] = KIND[cv.kind] || 0; }
            F.ok[k] = (ctx.okAt(x, z) && !(ctx.poolAt && (cd === 3 || cd === 7) && ctx.poolAt(x, z) > 0.5)) || (cv && cv.surf) ? 1 : 0;
          }
          F.at = (x, z) => Math.round(z - z0) * NF + Math.round(x - x0);
          G.fine = F;
        }
      }
      return G;
    }

    // ---- THE ROCKS OF ONE CELL (2026-09-22, the rock map) --------------------------------
    // The rock species plant on a stream of their OWN (the cell's seed xor the species' hash), so
    // the far tier's map (rock_map.js) can reproduce a cell's rocks without planting its grass:
    // one placement, two readers - the near cell's instances and the map's sprites agree by
    // construction. emit(p, x, y, z, s, yaw, col, tx, tz) per rock; returns the count.
    const coastAt = world.island && world.island.coastAt ? world.island.coastAt : null;
    function placeRocks(c, row, F, G, centreMix, cx, cz, C, emit) {
      const place = c.place || {};
      const P = protosOf(c); if (!P.length) return 0;
      const per = ((c.kind === 'debris' ? F.debris : F.rocks) || 0) / 1000 * S.rocks * (row.proportion === undefined ? 1 : row.proportion);
      if (per <= 0) return 0;
      const x0 = cx * C, z0 = cz * C, sSeed = hashStr(c.name);
      const Rq = rng((((hsh(cx, cz) * 4294967295) >>> 0) ^ sSeed) >>> 0);
      const blotch = F.blotch || 0, blotchM = F.blotchM || 18;
      const blotchAt = (x, z, seed) => (GF && GF.blotch) ? GF.blotch(x, z, seed) : 1 - blotch * vnoise(x, z, blotchM, seed % 1000);
      const vary = place.vary === undefined ? 0.05 : place.vary;
      const n = Math.round(per * C * C); let made = 0;
      for (let i = 0; i < n; i++) {
        const x = x0 + Rq() * C, z = z0 + Rq() * C, r1 = Rq(), r2 = Rq(), r3 = Rq();
        // the bench's GF.blotch: keeps 1 - blotch .. 1 by area; a rock takes it only when its row says `cluster`
        // (THE ROCKY SHORE: a foreshore's rocks lie in beds along the tide line, not evenly)
        if (blotch && row.cluster && r1 > blotchAt(x, z, sSeed)) continue;
        // THE SHORE: a rock row's `shore` culls by the distance inland (the island's coast field, positive inland):
        // 1 keeps the water's edge and none past 15 m, 0 keeps all
        if (row.shore > 0 && coastAt) { const sd = coastAt(x, z); if (sd < -2 || Rq() > 1 - row.shore * smooth(2, 15, sd)) continue; }
        // THE WRACK LINE (2026-09-22, the user: "they are usually packed at the beach far end, where the highest
        // tide takes them"): `band` [lo, hi] metres INLAND of the waterline - the drift piles where the highest
        // tide left it, not at the water's edge; kept full inside the band and fading a couple of metres either side
        if (row.band && coastAt) { const sd = coastAt(x, z);
          const k = Math.min(smooth(row.band[0] - 3, row.band[0] + 1, sd), 1 - smooth(row.band[1] - 1, row.band[1] + 4, sd));
          if (k <= 0 || Rq() > k) continue; }
        // THE POOLS (2026-09-22, the user: "floating in the muskeg ponds as well", then: "it should not be
        // restricted to ponds"): a row's `pool` is the SHARE of its pieces that float - this draw is a floating
        // one with that probability, and then it wants the shared pool field (28b_ground_fields, the muskeg's
        // puddles), lies flat on the water (no tilt) and is barely sunk; the rest are ordinary dry pieces on the
        // ground the ok[] test keeps (a tuft is never planted in a puddle). One row, both halves.
        // DECIDED HERE, not below: the hollow test reads it, and a `const` further down put that read in its
        // temporal dead zone - every row carrying `hollow` threw and its cell lost all its debris (2026-09-22)
        const floats = row.pool > 0 && Rq() < row.pool;
        // THE HOLLOWS (the same: "probably in packs in depressions"): `hollow` keeps a piece by how much the ground
        // DISHES under it - the Laplacian over its own footprint (the mean of four neighbours minus the centre,
        // positive in a dish) in centimetres per metre; 0 keeps everything, 1 keeps only a real hollow
        if (row.hollow > 0 && !floats) {
          const rr = Math.max(6, 2.5 * (row.size || 1)), y0 = world.terrainH(x, z);
          const lap = (world.terrainH(x + rr, z) + world.terrainH(x - rr, z) + world.terrainH(x, z + rr) + world.terrainH(x, z - rr)) / 4 - y0;
          if (Rq() > (1 - row.hollow) + row.hollow * smooth(0, 0.35, lap)) continue;
        }
        const gk = G.at(x, z);
        if (G.mix[gk] !== centreMix) continue;
        // NOTHING LIES ON A PAVEMENT (2026-09-22; G502's rule, kept whole, asked PER PIECE). A log has no
        // business on a runway, an apron, a road or a track. `kill` is 1 over a hard surface AND its drawn
        // band, falling to 0 over the 6 m fade past it - but a GRASS strip only ever thins the cover to 0.6,
        // so kill alone would leave a log across a grass runway at 40 %: the piece is refused wherever the
        // pavement has a CLASS and a grip on the ground (kill 0.5), and thinned by what is left of the fade
        // beyond it, which is what a graded gravel verge looks like.
        // The QUERY, not the node: the ring's lattice is 4 m, so a node's answer can be 2.8 m from the piece
        // it is deciding - and the whole of this law happens within 7 m of an edge. `pave` is the cheap half
        // of the query (0.19 us against 1.34: no plot walk, no drawn colour), which is what makes a call per
        // piece affordable here, and the far rock map shares this function.
        { const cv = ctx.coverAt ? ctx.coverAt(x, z, 1) : null;
          if (cv && cv.kill > 0) {
            if (cv.kill >= 1 || (cv.cls && cv.kill >= 0.5)) continue;
            if (Rq() > 1 - cv.kill) continue;
          } }
        if (floats) { if (!(ctx.poolAt && ctx.poolAt(x, z) > 0.6)) continue; }
        else if (!G.ok[gk]) continue;
        const p = draw(P, r2);
        const y = world.terrainH(x, z);
        const s = (row.size !== undefined ? row.size : (place.size || 1)) * Math.exp((Rq() * 2 - 1) * (place.sizeVar === undefined ? 0.35 : place.sizeVar));
        const yaw = r3 * Math.PI * 2;
        // a rock's row may say how deep it sits (`bury`, a fraction of its height; the shore's lie deeper)
        const yy = y - p.h0 * s * (floats ? (row.poolBury === undefined ? 0.06 : row.poolBury)
                                          : (row.bury !== undefined ? row.bury : (place.bury === undefined ? 0.45 : place.bury)));
        let col = null;
        // `dim` (2026-09-23, the user: "the debris are still much too bright ... look at the dead trunks,
        // debris should be barely brighter"): a straight factor on the instance colour, measured rather than
        // guessed - the log's map is 0.249 linear luma against the dead trunks' bark at 0.081, three times
        // brighter; the two stick packs 0.10-0.11 with single maps at 0.216. The row's factor lands each
        // species in the dead trunks' family. It multiplies AFTER the tint (which turns hue, not level).
        const dim = row.dim === undefined ? 1 : row.dim;
        if (row.tint > 0) {
          // the rock takes the ground's colour at its foot, by `tint` (0 = the pack's pale grey as it is, 1 = the
          // tufts' rule): the free_rock pack is one pale texture and read as gravel thrown on the dark foreshore -
          // the ground's CHROMA (its colour at full brightness), not its value: a straight multiply by a dark
          // foreshore left the pack's own blue-grey showing through as lavender
          const g = [G.col[gk * 3], G.col[gk * 3 + 1], G.col[gk * 3 + 2]], gm = Math.max(g[0], g[1], g[2], 1e-3);
          const j = (1 + (Rq() * 2 - 1) * vary) * (1 - 0.35 * row.tint);   // and a third darker at full tint (the pack is pale)
          col = [(1 + (g[0] / gm - 1) * row.tint) * j, (1 + (g[1] / gm - 1) * row.tint) * j, (1 + (g[2] / gm - 1) * row.tint) * j];
        }
        if (dim !== 1) { if (!col) col = [1, 1, 1]; col = [col[0] * dim, col[1] * dim, col[2] * dim]; }
        // `tilt`: the rock leans to the ground's slope over its OWN footprint (a 10 m strip read at +-1.5 m stood on
        // the wrong plane and showed its skirt as a plate), scaled by the row's tilt (1 = the ground's own)
        let tx = 0, tz = 0;
        if (row.tilt > 0 && !floats) { const rr = Math.max(1.5, 0.45 * p.r0 * s); tx = (world.terrainH(x + rr, z) - world.terrainH(x - rr, z)) / (2 * rr) * row.tilt; tz = (world.terrainH(x, z + rr) - world.terrainH(x, z - rr)) / (2 * rr) * row.tilt; }
        emit(p, x, yy, z, s, yaw, col, tx, tz); made++;
      }
      return made;
    }
    // THE ROCK MAP'S READ (rock_map.js): a cell's rocks as records, if its mix asks for a far tier
    // (`rockMap` on the mix's forest row), else null. The same subGrid, the same placeRocks.
    function rockPlan(cx, cz) {
      const C = S.cell, x0 = cx * C, z0 = cz * C;
      const cd = ctx.codeAt ? ctx.codeAt(x0 + C / 2, z0 + C / 2, hsh(Math.round((x0 + C / 2) * 3.7), Math.round((z0 + C / 2) * 5.3))) : -1;
      const centreMix = BIO.mixHere ? BIO.mixHere(cd, x0 + C / 2, z0 + C / 2) : (cd < 0 ? null : BIO.mixAt(cd));
      if (!centreMix) return null;
      const M = BIO.mixOf(centreMix), F = (M && M.forest) || {};
      if (!F.rockMap) return null;
      const G = subGrid(x0, z0, C);
      const out = [];
      for (const c of speciesOf()) { if (!rockish(c)) continue; const row = M.species && M.species[c.name]; if (!row) continue;
        placeRocks(c, row, F, G, centreMix, cx, cz, C, (p, x, y, z, s, yaw, col) => out.push({ p, x, z, s, yaw, col })); }
      return out;
    }

    // ---- THE BATCHES (G585) ---------------------------------------------------------
    // The rocks, the debris and the shrubs drew one InstancedMesh per prototype PART per block, and cast from each: at
    // the airfield stand ~1 400 draws a frame between them (rock 252 + 270 shadow, debris 340 + 181, shrub 192 + 198 -
    // the user's count). The tufts (cover) stay by block: 60 000+ instances, culled cheaply by the block's sphere.
    // A part's instances in a block are a handful, and every one of them paid the whole three.js draw. They are
    // BatchedMeshes now: one per (species, material, casts or not) ACROSS THE RING - the parts that share a picture
    // are one draw (a multi-draw of their ranges), three culls each INSTANCE against each camera and each shadow
    // camera (so no block is drawn for the one rock of it in view), and the block's reach test (below) switches its
    // instances instead of its meshes. The picture: the same geometry, material, matrices and colours, and the
    // fade's threshold carried in the colour's alpha (trees.js BATCH_RAND_VS) - the same instances thin at the same
    // distances. `batch: false` is the per-block instanced path, as before (the A/B).
    const batched = kind => S.batch && (kind === 'rock' || kind === 'debris' || kind === 'shrub');
    const castOf = p => p.kind !== 'cover' && !((p.kind === 'debris' || p.kind === 'rock') && p.h < S.castMinH);
    const attrSig = g => Object.keys(g.attributes).sort().map(k => k + g.attributes[k].itemSize).join(',') + (g.index ? '|i' : '');
    const batches = new Map();   // key -> BatchedMesh
    const V4 = new THREE.Vector4();
    // keyed by the SPECIES too: two species of one file share its material objects (trees.js, PACK.materials), and a
    // batch is sized for, and holds, the geometries of the one species it was made for
    function batchFor(P, part, cast) {
      const key = P.species + '|' + part.mat.uuid + '|' + (cast ? 1 : 0) + '|' + attrSig(part.geo);
      let bm = batches.get(key);
      if (bm) return bm;
      // every geometry this batch will ever draw is known now: the species' prototypes are built together (protosOf)
      const geos = [];
      for (const p of P) if (castOf(p) === cast) for (const q of p.parts) if (q.mat === part.mat && attrSig(q.geo) === attrSig(part.geo) && !geos.includes(q.geo)) geos.push(q.geo);
      let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : 0; }
      bm = new THREE.BatchedMesh(64, nv, ni, part.mat);
      bm.userData.geoIds = new Map(geos.map(g => [g, bm.addGeometry(g)]));
      bm.userData.nVis = 0; bm.visible = false;
      bm.perObjectFrustumCulled = true; bm.sortObjects = false; bm.frustumCulled = false;   // three's per-instance culling, each camera
      bm.matrixAutoUpdate = false; bm.renderOrder = -1;   // at the origin for ever; an occluder before the ground (render_world.js ORDER_NOTE)
      bm.castShadow = cast; bm.receiveShadow = true;
      bm.userData.coverKind = P[0].kind;
      bm.name = 'cover:' + P[0].kind;
      batches.set(key, bm); root.add(bm);
      return bm;
    }
    // a batch with no instance shown draws nothing at all (three would still set its program up, every pass): the
    // count of its shown instances decides its own visibility
    function batchVis(bm, id, v) {
      if (bm.getVisibleAt(id) === v) return;
      bm.setVisibleAt(id, v); bm.userData.nVis += v ? 1 : -1;
      const on = bm.userData.nVis > 0; if (bm.visible !== on) bm.visible = on;
    }
    function batchAdd(bm, geo) {
      if (bm.instanceCount >= bm.maxInstanceCount) bm.setInstanceCount(bm.maxInstanceCount * 2);   // full (no id to reuse): twice the room
      return bm.addInstance(bm.userData.geoIds.get(geo));
    }

    // ---- THE FIELD'S CELL (G2563) ---------------------------------------------------------------------------------------
    // the fade's keep at a distance (FADE_VS, before the height term): the planting's tiers and the draw's truncation read it
    const keepD = d => { const t = Math.max(0, Math.min(1, (d - S.near) / Math.max(1, S.reach - S.near))); return Math.pow(1 - t, 1 + 2 * S.taper); };
    const bandNow = () => (LEAF.grow ? LEAF.grow(null, null, null)[1] : 0.25);
    // the tinted texel's mean on the CPU (trees.js TINT_GLSL on the kept texels' mean): the field's colour is the ground's OVER it,
    // so a tuft's albedo lands on the ground's own (x `match`, the level the box fits)
    const tintMean = mat => {
      const U = mat.userData, c = U.texMean; if (!c || !U.uLight) return [0.4, 0.4, 0.4];
      const a = -(U.uHue ? U.uHue.value : 0) * 6.2831853, co = Math.cos(a), si = Math.sin(a);
      const c0 = [0.299 + 0.701 * co + 0.168 * si, 0.587 - 0.587 * co + 0.330 * si, 0.114 - 0.114 * co - 0.497 * si];
      const c1 = [0.299 - 0.299 * co - 0.328 * si, 0.587 + 0.413 * co + 0.035 * si, 0.114 - 0.114 * co + 0.292 * si];
      const c2 = [0.299 - 0.300 * co + 1.250 * si, 0.587 - 0.588 * co - 1.050 * si, 0.114 + 0.886 * co - 0.203 * si];
      const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2], rot = [dot(c, c0), dot(c, c1), dot(c, c2)], y = 0.2126 * rot[0] + 0.7152 * rot[1] + 0.0722 * rot[2];
      const sat = U.uSat ? U.uSat.value : 1, fl = U.uFlat ? U.uFlat.value : 1, fm = U.uFlatMean ? U.uFlatMean.value : 0.4, L = U.uLight.value;
      return rot.map(v => Math.max(0.02, Math.min(1, (fm + ((y + (v - y) * sat) - fm) * fl) * L)));
    };
    let fieldH0 = 1;   // the variants' mean top (model units): the size fade's reference is S.hRef over it
    // one 16 m cell of the field, planted for an eye no nearer than dTier (0: the whole stream). The candidate stream is the
    // cell's own (hashed on it) and draws the same eight numbers for every candidate whatever is kept, so a tier is a PREFIX of
    // the next: a candidate stands at dTier when its fade threshold (aRand, its own rand) is under what its own size can show
    // from there (x the shrink band) - nearer, the cell is planted again and only adds (G2563 tiers).
    function buildField(cx, cz, dTier, born) {
      const t0 = performance.now();
      const C = S.cell, x0 = cx * C, z0 = cz * C;
      const R = rng((hsh(cx, cz) * 4294967295) >>> 0);
      const cell = { n: 0, parts: new Map(), inst: [], by: {}, cx, cz, dTier, born, field: true };
      cells.set(cellKey(cx, cz), cell); markBlock(cx, cz);
      const c = speciesOf()[0], P = c ? protosOf(c) : [];
      if (!P.length || !BIO) { STAT.lastMs = performance.now() - t0; return cell; }
      for (const p of P) for (const q of p.parts) if (LEAF.fadeOwn) LEAF.fadeOwn(q.mat, FSET);
      fieldH0 = P.reduce((a, p) => a + p.h0, 0) / P.length;
      const G = subGrid(x0, z0, C);
      const types = new Map(), typeOf = mix => {
        if (types.has(mix)) return types.get(mix);
        const M = mix ? BIO.mixOf(mix) : null, row = M && M.species && M.species[c.name];
        let T = null;
        if (row) { const F = M.forest || {}, D = FIELD_TYPES[mix] || FIELD_MEADOW, pick = (k, d) => (row[k] !== undefined ? row[k] : (F[k] !== undefined ? F[k] : (D[k] !== undefined ? D[k] : d)));
          T = { h: pick('h', 0.3), sigma: pick('sigma', 0.35), dens: pick('dens', 1) * (F.cover === undefined ? 1 : F.cover), clumpM: pick('clumpM', S.clumpM), clumpAmp: pick('clumpAmp', S.clumpAmp) }; }
        types.set(mix, T); return T; };
      let dmax = 0; for (let k = 0; k < G.N * G.N; k++) { const T = typeOf(G.mix[k]); if (T && T.dens > dmax) dmax = T.dens; }
      const cutMax = Math.max(1, S.cutDens, S.stripDens);
      const env = S.tufts * dmax * cutMax * (1 + G.bmax);   // the candidates' density: every keep below is a share of it
      if (env <= 0) { STAT.lastMs = performance.now() - t0; return cell; }
      const n = Math.round(env * C * C), band = bandNow(), tierOn = S.tier && dTier > 0, blotchM = 18;
      const items = new Map(), mats = new Map();
      const F = G.fine;
      // (the tier's bound for ANY tuft of the cell - the tallest the size fade lets reach farthest: a rand over it is out at once)
      const tierMax = tierOn ? keepD(dTier / Math.max(1, 1 + (SIZE_MAX - 1) * S.sizeFade)) * (1 + band) * 1.05 : 2;
      for (let i = 0; i < n; i++) {
        const x = x0 + R() * C, z = z0 + R() * C, rand = R(), rA = R(), rV = R(), rY = R(), rH1 = R(), rH2 = R(), rJ = R();
        if (rand >= tierMax) continue;
        const gk = G.at(x, z), T = typeOf(G.mix[gk]); if (!T) continue;
        const fk = F ? F.at(x, z) : -1;
        const kill = fk >= 0 ? F.kill[fk] : G.kill[gk], kind = fk >= 0 ? F.kind[fk] : G.kind[gk], ok = fk >= 0 ? F.ok[fk] : G.ok[gk];
        if (!ok || kill >= 1 || kind === 1 || kind === 3) continue;   // a plot's lawn is the first ring's (grass_dry); 'none' plants nothing
        const cut = fk >= 0 ? F.cut[fk] : G.cut[gk], surf = fk >= 0 ? F.surf[fk] : G.surf[gk], boost = fk >= 0 ? F.boost[fk] : G.boost[gk];
        // THE DENSITY: the type's, more where it is cut; the blotch's holes (fewer than the first ring's, none in the cut);
        // the pavement's kill and the verge's boost - one draw against the share of the envelope
        let keep = T.dens * (cut > 0 ? 1 + ((surf ? S.stripDens : S.cutDens) - 1) * cut : 1) / (dmax * cutMax);
        if (S.blotch > 0) keep *= 1 - S.blotch * (0.5 + 0.5 * vnoise(x, z, blotchM, 4242)) * (1 - cut);
        keep *= (1 - kill) * (1 + boost) / (1 + G.bmax);
        if (rA >= keep) continue;
        // THE LENGTH (GRASS-STUDY §4.4): the type's median x a lognormal x the clump field (wild); cut: its own length, uniform
        let nz = Math.sqrt(-2 * Math.log(Math.max(1e-9, rH1))) * Math.cos(6.2831853 * rH2); nz = Math.max(-2.5, Math.min(2.5, nz));
        const clump = 1 + T.clumpAmp * (vnoise(x, z, T.clumpM, 977) - 0.5) * 2;
        const hw = T.h * S.hK * Math.exp(T.sigma * S.sigmaK * nz) * clump, hc = (surf ? S.stripH : S.cutH) * Math.exp(S.cutSigma * nz);
        const h = hw + (hc - hw) * cut;
        // THE TIER: what this tuft's own size can show from dTier (the size fade: a short one fades nearer) - its scale over the
        // reference exactly as FADE_VS reads it (h / its variant's top, over hRef / the variants' mean top). Every test is the
        // candidate's own fixed numbers, so the tuft kept from dTier is kept from any nearer one: the tiers nest
        const p = draw(P, rV);
        if (tierOn && rand >= keepD(dTier / Math.max(0.05, 1 + (Math.min(SIZE_MAX, Math.max(0.05, (h / p.h0) / (S.hRef / fieldH0))) - 1) * S.sizeFade)) * (1 + band) * 1.05) continue;
        const mat = p.parts[0].mat;
        let col;
        if (S.colour && ctx.groundMeanAt) {
          let M = mats.get(mat); if (!M) mats.set(mat, M = tintMean(mat));
          const g = G.colB(x, z), j = (1 + (rJ * 2 - 1) * S.vary) * S.match;
          col = [Math.min(3, g[0] / M[0] * j), Math.min(3, g[1] / M[1] * j), Math.min(3, g[2] / M[2] * j)];
        } else {   // the sets' means x lift (G551), the A/B
          const place = c.place || {}, l = place.lift === undefined ? 1 : place.lift, k3 = gk * 3, j = 1 + (rJ * 2 - 1) * S.vary;
          col = lifted([G.col[k3], G.col[k3 + 1], G.col[k3 + 2]], l).map(v => v * j);
        }
        let it = items.get(p); if (!it) { it = { p, xs: [], col: [], rand: [] }; items.set(p, it); }
        it.xs.push(x, G.hAt(x, z), z, h / p.h0, rY * 6.2831853, 0, 0); it.col.push(col[0], col[1], col[2]); it.rand.push(rand);
      }
      let yLo = Infinity, yHi = -Infinity;
      for (const it of items.values()) {
        const k = it.xs.length / 7, mm = new Float32Array(k * 16); let smax = 0;
        // the matrix written out (a turn about up and one scale: Matrix4.compose's own result, without its quaternion round trip)
        for (let i = 0; i < k; i++) { const o = i * 7, s = it.xs[o + 3], a = it.xs[o + 4], co = Math.cos(a) * s, si = Math.sin(a) * s, e = i * 16;
          mm[e] = co; mm[e + 2] = -si; mm[e + 5] = s; mm[e + 8] = si; mm[e + 10] = co; mm[e + 12] = it.xs[o]; mm[e + 13] = it.xs[o + 1]; mm[e + 14] = it.xs[o + 2]; mm[e + 15] = 1;
          if (s > smax) smax = s; if (it.xs[o + 1] < yLo) yLo = it.xs[o + 1]; if (it.xs[o + 1] > yHi) yHi = it.xs[o + 1]; }
        for (const part of it.p.parts) cell.parts.set(part, { n: k, mats: mm, col: new Float32Array(it.col), rand: new Float32Array(it.rand), cast: false, kind: 'cover', cell, smax });
        cell.n += k; cell.by[c.name] = (cell.by[c.name] || 0) + k; STAT.by[c.name] = (STAT.by[c.name] || 0) + k;
      }
      if (!isFinite(yLo)) { yLo = yHi = G.hAt(x0 + C / 2, z0 + C / 2); }
      cell.box = [x0, yLo - 1, z0, x0 + C, yHi + 2, z0 + C];
      STAT.built++; STAT.lastMs = performance.now() - t0; STAT.maxMs = Math.max(STAT.maxMs, STAT.lastMs);
      return cell;
    }

    // ---- one cell -------------------------------------------------------------------
    function buildCell(cx, cz, dTier, born) {
      if (FIELD) return buildField(cx, cz, dTier || 0, born);
      const t0 = performance.now();
      STAT.building = cx + ',' + cz;
      const C = S.cell, x0 = cx * C, z0 = cz * C;
      const seed = (hsh(cx, cz) * 4294967295) >>> 0;
      const R = rng(seed);
      // the mix at the cell's centre says which species to plant; each point checks its own
      const G = subGrid(x0, z0, C);
      const centreMix = G.mix[G.at(x0 + C / 2, z0 + C / 2)];
      // THE CELL HOLDS ITS INSTANCES, NOT MESHES (PERF 2026-09-23): the block it falls in (below) draws them
      const cell = { n: 0, parts: new Map(), inst: [], by: {}, cx, cz };   // inst: [batch, id, ...] - the batched instances (G585)   // by: this cell's tally per species (STAT.by is the live sum)
      cells.set(cellKey(cx, cz), cell); markBlock(cx, cz);
      if (!centreMix && !G.lawn) { STAT.lastMs = performance.now() - t0; return cell; }
      const M = BIO.mixOf(centreMix) || { species: {}, forest: {} }, F = M.forest || {};   // a cell of plots alone ('lawn' stands for a mix) plants its lawn and nothing else
      const blotch = F.blotch || 0, blotchM = F.blotchM || 18, spread = F.coverSpread === undefined ? 0.08 : F.coverSpread;
      if (GF && GF.C && GF.C.blotch) { GF.C.blotch.amount = blotch; GF.C.blotch.cellM = blotchM; }
      const blotchAt = (x, z, seed) => (GF && GF.blotch) ? GF.blotch(x, z, seed) : 1 - blotch * vnoise(x, z, blotchM, seed % 1000);
      const items = new Map();   // proto -> { pos: [], col: [] | null }
      // the instance record: x y z s yaw tx tz - tx/tz the ground's slope under a rock that `tilt`s to it (0 0 = upright)
      const push = (p, x, y, z, s, yaw, col, tx, tz) => { let it = items.get(p); if (!it) { it = { p, xs: [], col: col ? [] : null }; items.set(p, it); } it.xs.push(x, y, z, s, yaw, tx || 0, tz || 0); if (col) it.col.push(col[0], col[1], col[2]); };
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
        if (c.kind === 'cover' && LEAF.fadeOwn) for (const p of P) for (const q of p.parts) LEAF.fadeOwn(q.mat, null);   // (the reed back from the field: the shared fade)
        const sSeed = hashStr(c.name);
        const isRock = rockish(c), isShrub = c.kind === 'shrub';
        if (isRock) {   // the rocks and the debris: their own stream, shared with the rock map (placeRocks above)
          const made = placeRocks(c, row, F, G, centreMix, cx, cz, C, push);
          if (made) { STAT.by[c.name] = (STAT.by[c.name] || 0) + made; cell.by[c.name] = (cell.by[c.name] || 0) + made; }
          continue;
        }
        let per = 0;   // per m2
        if (isShrub) { const tot = Object.keys(M.species).filter(k => { const cc = pack.collections.find(q => q.name === k); return cc && cc.kind === 'shrub'; }).reduce((a, k) => a + (M.species[k].proportion === undefined ? 1 : M.species[k].proportion), 0) || 1;
          per = (F.under || 0) / 1000 * S.shrubs * (row.proportion === undefined ? 1 : row.proportion) / tot; }
        // THE BENCH'S COUNT: a cover's density times the MIX's own `forest.cover` (1 for every
        // shipped mix), then the ring's global `density` dial on top. The game used to skip the
        // mix's multiplier and lean on S.density alone.
        else per = (row.density !== undefined ? row.density : (place.density || 0)) * (F.cover === undefined ? 1 : F.cover) * S.density;   // no proportion, as the bench
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
          // the bed (see bedKeep): its own hash for the draw, so the cell's stream R() - and every
          // other species' positions in the cell - are not disturbed by a flower's beds
          if (patch) { const kp = bedKeep(x, z, patch, sSeed % 1000, bedFrac);
            if (kp <= 0 || hsh(Math.round(x * 13.7) + 5, Math.round(z * 11.3) - 3) > kp) continue; }
          if (blotch && r1 > blotchAt(x, z, sSeed)) continue;   // the bench's GF.blotch: keeps 1 - blotch .. 1 by area
          const gk = G.at(x, z);
          if (!G.ok[gk] || G.mix[gk] !== centreMix) continue;
          if (isShrub && G.bush[gk]) continue;   // G1385: a strip's own clearance with `bushes` keeps the tall vegetation out
          // the cover's query: nothing on a pavement (kill), more on a border (boost), a plot's lawn or
          // meadow or nothing instead of the biome's rows (the LAWN row is planted below, on its own)
          if (G.kind[gk] === 1 || G.kind[gk] === 3) continue;
          if (G.cut[gk] > 0.05) continue;   // G2565: the mown ground by a runway ('sides' law) grows the field's cut grass, no flower, no bush
          if (G.bmax > 0 || G.kill[gk] > 0) { const keep = (1 - G.kill[gk]) * (1 + G.boost[gk]) / (1 + G.bmax); if (keep < 1 && R() > keep) continue; }   // a rejection sampler: n was drawn at (1 + bmax) x
          const p = draw(P, r2);
          const y = world.terrainH(x, z);
          let s = 1, yaw = r3 * Math.PI * 2, col = null;
          if (isShrub && place.hMin !== undefined && place.hMax !== undefined && p.h0 > 0) s = (place.hMin + R() * (place.hMax - place.hMin)) / p.h0;
          // the species' size ALWAYS (the reed's 0.012 is absolute); a MIX ROW may scale it (`size`, a factor:
          // a village's grass is shorter than a moor's - 2026-09-22)
          else s = (place.size || 1) * (row.size === undefined ? 1 : row.size) * Math.exp((R() * 2 - 1) * spread);
          const yy = y - (place.sink || 0);
          if (!noTint && !isShrub) {
            col = lifted([G.col[gk * 3], G.col[gk * 3 + 1], G.col[gk * 3 + 2]], lift);
            if (vary) { const j = 1 + (R() * 2 - 1) * vary; col = [col[0] * j, col[1] * j, col[2] * j]; }
          } else if (noTint && !isShrub && vary) { const j = 1 + (R() * 2 - 1) * vary; col = [j, j, j]; }
          push(p, x, yy, z, s, yaw, col, 0, 0); STAT.by[c.name] = (STAT.by[c.name] || 0) + 1; cell.by[c.name] = (cell.by[c.name] || 0) + 1;
        }
      }
      // the meshes: one InstancedMesh per prototype part
      const T = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
      let yLo = Infinity, yHi = -Infinity; for (const it of items.values()) for (let i = 1; i < it.xs.length; i += 7) { if (it.xs[i] < yLo) yLo = it.xs[i]; if (it.xs[i] > yHi) yHi = it.xs[i]; }
      const NRM = new THREE.Vector3(), QT = new THREE.Quaternion();
      if (!isFinite(yLo)) { yLo = yHi = world.terrainH(x0 + C / 2, z0 + C / 2); }
      const yMid = (yLo + yHi) / 2, ySpan = (yHi - yLo) / 2;
      cell.box = [x0, yLo - 1, z0, x0 + C, yHi + 6, z0 + C];   // the instances' feet +- a bush's height: the reach test below
      for (const it of items.values()) {
        const n = it.xs.length / 7; if (!n) continue;
        const rand = new Float32Array(n); for (let i = 0; i < n; i++) rand[i] = R();
        const mats = new Float32Array(n * 16);
        for (let i = 0; i < n; i++) {
          const o = i * 7; Q.setFromAxisAngle(UP, it.xs[o + 4]); V.set(it.xs[o], it.xs[o + 1], it.xs[o + 2]); SC.setScalar(it.xs[o + 3]);
          if (it.xs[o + 5] || it.xs[o + 6]) { NRM.set(-it.xs[o + 5], 1, -it.xs[o + 6]).normalize(); QT.setFromUnitVectors(UP, NRM); Q.premultiply(QT); }   // the lean: up -> the ground's normal, after the yaw
          T.compose(V, Q, SC); T.toArray(mats, i * 16);
        }
        const col = it.col ? new Float32Array(it.col) : null;
        // every part of the prototype draws the same instances (a bark part and a leaf part)
        // (a twig or a pebble under S.castMinH casts no shadow: a texel of the map at most, and a shadow draw per model per
        // block; 0.5 m since G585 - the user: "shadows only for the kinds/sizes that show one (rocks > ~0.5 m)")
        const cast = castOf(it.p);
        if (batched(it.p.kind)) {   // into the ring's batches, hidden until the block they fall in is (re)built (buildBlock)
          for (const part of it.p.parts) {
            const bm = batchFor(it.p.all, part, cast);
            for (let i = 0; i < n; i++) {
              const id = batchAdd(bm, part.geo);
              T.fromArray(mats, i * 16); bm.setMatrixAt(id, T);
              V4.set(col ? col[i * 3] : 1, col ? col[i * 3 + 1] : 1, col ? col[i * 3 + 2] : 1, rand[i]); bm.setColorAt(id, V4);
              bm.setVisibleAt(id, false);
              cell.inst.push(bm, id);
            }
          }
        } else for (const part of it.p.parts) cell.parts.set(part, { n, mats, col, rand, cast, kind: it.p.kind, cell });
        cell.n += n;
      }
      STAT.built++; STAT.lastMs = performance.now() - t0; STAT.maxMs = Math.max(STAT.maxMs, STAT.lastMs); STAT.building = null;
      return cell;
    }
    function dropCell(key) {
      const cell = cells.get(key); if (!cell) return;
      markBlock(cell.cx, cell.cz);
      for (let k = 0; k < cell.inst.length; k += 2) { batchVis(cell.inst[k], cell.inst[k + 1], false); cell.inst[k].deleteInstance(cell.inst[k + 1]); }   // the batched ones go now (past Rdrop: out of reach)
      cell.inst.length = 0;
      for (const k in cell.by) { STAT.by[k] -= cell.by[k]; if (STAT.by[k] <= 0) delete STAT.by[k]; }   // the tally is LIVE (it ran up for the page's life before L4)
      cell.dead = true;   // (a grow in flight lets go of it)
      cells.delete(key);
    }

    // ---- THE BLOCKS (PERF 2026-09-23) -----------------------------------------------
    // A cell is 32 m because that is the planting's grain; it was also the DRAW's - one InstancedMesh
    // per prototype part per cell, ~10 a cell, 1 000 draws and 1 100 shadow draws at 120 m AGL over
    // a forest (the frame study's census), each of them a round of GL state through the command
    // buffer. The draw's grain is now a BLOCK of B x B cells: one InstancedMesh per part per block,
    // the cells' instance arrays copied in, rebuilt when a cell of it comes or goes (nearest first,
    // `blockBudget` a frame; until then the block draws what it held). Culling is the block's own
    // sphere (the frustum) and the fade's reach (below); the instances and the shader are the
    // cells' own, so the picture is the same.
    const B = FIELD ? 2 : 4, blocks = new Map();   // (the field's: 2 x 2 of its 16 m cells - the near band must not submit 128 m)
    const now = () => performance.now() / 1000;   // the grow's clock (trees.js uFadeNow / aBorn)
    // THE BATCHES GROW ON THE CPU (G670): a BatchedMesh instance has a matrix and a colour and no attribute of its own
    // (the fade's threshold already rides the colour's alpha), so a near cell's rocks, debris and shrubs are scaled
    // about their own origins, frame by frame, for S.grow s - [cell, t0, [bm, id, matrix x16, ...]]
    const growing = [], GM = new THREE.Matrix4();
    function growTick(t) {
      for (let g = growing.length - 1; g >= 0; g--) {
        const G = growing[g], cell = G[0], k = Math.min(1, (t - G[1]) / Math.max(1e-3, S.grow)), L = G[2];
        if (cell.dead) { growing.splice(g, 1); continue; }
        for (let i = 0; i < L.length; i += 3) {
          GM.fromArray(L[i + 2]); const e = GM.elements;
          if (k < 1) for (const j of [0, 1, 2, 4, 5, 6, 8, 9, 10]) e[j] *= Math.max(1e-3, k);
          L[i].setMatrixAt(L[i + 1], GM);
        }
        if (k >= 1) growing.splice(g, 1);
      }
    }
    const blockOf = (cx, cz) => Math.floor(cx / B) + ',' + Math.floor(cz / B);
    function markBlock(cx, cz) {
      const k = blockOf(cx, cz); let b = blocks.get(k);
      if (!b) { b = { key: k, bx: Math.floor(cx / B), bz: Math.floor(cz / B), group: new THREE.Group(), meshes: [], box: null, dirty: true }; root.add(b.group); blocks.set(k, b); }
      b.dirty = true;
    }
    function buildBlock(b) {
      for (const m of b.meshes) { b.group.remove(m); m.geometry.dispose(); if (m.dispose) m.dispose(); }   // the wrapper and the instance buffers; the prototype's own are shared
      b.meshes = []; b.dirty = false;
      const parts = new Map(); let box = null, live = 0;
      b.instCells = []; b.instVis = null;   // the cells whose batched instances this block switches with its reach (update) - cells, not
                                            // ids: a dropped cell's ids are handed to the next instances made
      const t = now(), ex = camera.position.x, ez = camera.position.z;
      for (let dz = 0; dz < B; dz++) for (let dx = 0; dx < B; dx++) {
        const cell = cells.get(cellKey(b.bx * B + dx, b.bz * B + dz)); if (!cell) continue;
        live++;
        // the first block that holds a cell is the moment it can be seen: its birth for the grow (a cell planted
        // while the ring is hidden - the pre-grow - is old by the time the fade lets it show, and does not grow)
        if (cell.born === undefined) {
          cell.born = root.visible ? t : -1e9;
          const mx = (cell.cx + 0.5) * S.cell - ex, mz = (cell.cz + 0.5) * S.cell - ez;
          if (cell.born > 0 && cell.inst.length && S.grow > 0 && mx * mx + mz * mz < S.growNear * S.growNear) {
            const L = [];
            for (let k = 0; k < cell.inst.length; k += 2) { const bm = cell.inst[k], id = cell.inst[k + 1]; bm.getMatrixAt(id, GM); L.push(bm, id, Float32Array.from(GM.elements)); }
            growing.push([cell, t, L]); growTick(t);
          }
        }
        if (cell.inst.length) b.instCells.push(cell);
        if (cell.box) { const c = cell.box; box = box ? [Math.min(box[0], c[0]), Math.min(box[1], c[1]), Math.min(box[2], c[2]), Math.max(box[3], c[3]), Math.max(box[4], c[4]), Math.max(box[5], c[5])] : c.slice(); }
        for (const [part, d] of cell.parts) { let a = parts.get(part); if (!a) parts.set(part, a = []); a.push(d); }
      }
      b.box = box;
      if (!live) { root.remove(b.group); blocks.delete(b.key); return; }
      if (!box) return;
      const sph = new THREE.Sphere(new THREE.Vector3((box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2),
                                   Math.hypot(box[3] - box[0], box[4] - box[1], box[5] - box[2]) / 2 + 8);
      for (const [part, list] of parts) {
        let n = 0; for (const d of list) n += d.n; if (!n) continue;
        // (made EMPTY and given its buffer: three's constructor writes an identity matrix into every instance, all of
        // them overwritten on the next line - most of a rebuilt block's cost at the stand's 66 000 tufts; G603)
        const m = new THREE.InstancedMesh(part.geo, part.mat, 0);
        m.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16); m.count = n;
        const hasCol = list.some(d => d.col), col = hasCol ? new Float32Array(n * 3).fill(1) : null, rand = new Float32Array(n), born = new Float32Array(n);
        let o = 0, smax = 0;
        for (const d of list) { m.instanceMatrix.array.set(d.mats, o * 16); if (d.col) col.set(d.col, o * 3); rand.set(d.rand, o); born.fill(d.cell.born, o, o + d.n); o += d.n; if (d.smax > smax) smax = d.smax; }
        // THE COUNT TRUNCATION (GRASS-DENSE G2561; GRASS-STUDY §4.3.1): an instance is drawn while the fade's keep x (1 + band)
        // is over its aRand, so the block's instances are put in order of aRand (a counting sort into BINS) and each frame
        // submits only the prefix the block's NEAREST point can show (update: mesh.count) - the ones left out are those the
        // vertex shader would have thrown off screen anyway, so the picture is the same to the pixel and the vertex work is
        // not paid for the ~70 % the fade has already collapsed. The matrices, colours, births move with their aRand (the
        // sway's phase is the instance's own aRand, never re-derived).
        let bins = null;
        // (not a mesh that CASTS - the batch: false A/B's rocks and shrubs: three's depth pass has no fade, so a collapsed instance
        // still casts, and leaving it out would move a shadow; the tufts never cast)
        if (S.trunc && !list[0].cast && part.mat.userData && part.mat.userData.fade) {
          const NB = 32, cnt = new Uint32Array(NB + 1);
          for (let i = 0; i < n; i++) cnt[Math.min(NB - 1, (rand[i] * NB) | 0) + 1]++;
          for (let b2 = 1; b2 <= NB; b2++) cnt[b2] += cnt[b2 - 1];
          bins = Uint32Array.from(cnt);   // bins[b] = the instances with aRand under b / NB
          const pos = Uint32Array.from(cnt), M0 = m.instanceMatrix.array, M1 = new Float32Array(n * 16), C1 = col ? new Float32Array(n * 3) : null, R1 = new Float32Array(n), B1 = new Float32Array(n);
          for (let i = 0; i < n; i++) { const b2 = Math.min(NB - 1, (rand[i] * NB) | 0), j = pos[b2]++;
            for (let q = 0; q < 16; q++) M1[j * 16 + q] = M0[i * 16 + q];
            if (C1) { C1[j * 3] = col[i * 3]; C1[j * 3 + 1] = col[i * 3 + 1]; C1[j * 3 + 2] = col[i * 3 + 2]; }
            R1[j] = rand[i]; B1[j] = born[i]; }
          m.instanceMatrix.array.set(M1); if (C1) col.set(C1); rand.set(R1); born.set(B1);
        }
        m.userData.bins = bins; m.userData.n = n; m.userData.smax = smax;
        if (col) m.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
        // the prototype's buffers shared, the instanced aRand per mesh: a thin geometry wrapper
        const geo = part.geo, g2 = new THREE.BufferGeometry(); g2.index = geo.index; for (const k in geo.attributes) g2.setAttribute(k, geo.attributes[k]);
        g2.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 1));
        g2.setAttribute('aBorn', new THREE.InstancedBufferAttribute(born, 1));   // G670: each instance its cell's birth (trees.js FADE_VS)
        // the block's own sphere (the instances hold world positions, the mesh stands at the origin),
        // on the geometry AND the object: r186 culls an InstancedMesh on its own, and would union the
        // geometry's at every instance otherwise
        g2.boundingSphere = sph; m.geometry = g2; m.boundingSphere = sph;
        m.frustumCulled = true; m.matrixAutoUpdate = false;   // at the origin, for ever
        m.renderOrder = -1;   // occluders before the ground (render_world.js ORDER_NOTE)
        m.castShadow = list[0].cast; m.receiveShadow = true;
        m.userData.coverKind = list[0].kind;   // cover / shrub / rock / debris: the instruments' read (PERF 2026-09-23)
        m.instanceMatrix.needsUpdate = true;
        b.group.add(m); b.meshes.push(m);
      }
    }

    // ---- per frame ------------------------------------------------------------------
    let queue = [];
    const EYE = { x: NaN, z: NaN, t: 0, vx: 0, vz: 0 };   // the eye's ground velocity, smoothed (the lead)
    function update() {
      if (!S.on || S.off || !pack || !BIO) { if (root.visible) root.visible = false; return; }   // (S.off: the GRAPHICS row's 'off' - the field's own `on` is the A/B)
      const ex = camera.position.x, ez = camera.position.z, gy = world.terrainH(ex, ez);
      const agl = Math.max(0, camera.position.y - gy); STAT.agl = agl;
      const aglK = 1 - smooth(S.aglFull, S.aglOff, agl); STAT.aglK = aglK;   // (the rock map reads the fade's height term)
      const t = now();
      LEAF.fade(S.near, S.reach, S.taper, aglK, FSET);   // (the field: its own set, and its size fade; the first ring: the shared one)
      if (FIELD && LEAF.fadeSize) LEAF.fadeSize(S.sizeFade, S.hRef / Math.max(1e-6, fieldH0), FSET);
      if (LEAF.grow) LEAF.grow(t, null, S.grow);
      { const dt = t - EYE.t;
        if (dt > 0 && dt < 0.5 && isFinite(EYE.x)) { const a = Math.min(1, dt / 0.5); EYE.vx += ((ex - EYE.x) / dt - EYE.vx) * a; EYE.vz += ((ez - EYE.z) / dt - EYE.vz) * a; }
        else if (!(dt > 0 && dt < 0.5)) { EYE.vx = 0; EYE.vz = 0; }   // a jump (a teleport, a pause): no lead from it
        EYE.x = ex; EYE.z = ez; EYE.t = t; }
      root.visible = aglK > 0.001;
      if (growing.length) growTick(t);
      // THE PRE-GROW (G671, A2-FADES; the playtest: "grass too late on approach"). The ring used to be dropped whole
      // above aglOff (150 m) and planted again from nothing on the way down - at budgetMs a frame, nearest first -
      // so the field was still filling while the fade was already letting it show. Below aglPre it now keeps
      // PLANTING while hidden (on preBudgetMs: it draws nothing, the fade holds every instance at 0), so on a
      // descent the ring is there when the height term opens; over aglPre it is dropped, as before.
      const hidden = aglK <= 0.001; STAT.hidden = hidden;
      if (hidden && agl > S.aglPre) { if (cells.size) for (const k of [...cells.keys()]) dropCell(k); for (const b of [...blocks.values()]) buildBlock(b); queue.length = 0; STAT.live = 0; return; }
      const C = S.cell, reachP = S.reach * (FIELD && S.sizeFade > 0 ? SIZE_MAX : 1);   // (the field plants as far as its tallest tuft shows)
      const R2 = (reachP + C) * (reachP + C), Rdrop = (reachP + 2 * C) * (reachP + 2 * C);
      const cx0 = Math.floor(ex / C), cz0 = Math.floor(ez / C), nr = Math.ceil((reachP + C) / C);
      // THE LEAD (G671): what the aeroplane is flying toward is planted first - the queue is ordered by the distance
      // to where the eye will be in S.lead s (at most 60 % of the reach ahead), still only the cells within the reach
      let lx = EYE.vx * S.lead, lz = EYE.vz * S.lead; { const l = Math.hypot(lx, lz), m = 0.6 * S.reach; if (l > m) { lx *= m / l; lz *= m / l; } }
      STAT.lead = Math.round(Math.hypot(lx, lz));
      queue.length = 0;
      for (let dz = -nr; dz <= nr; dz++) for (let dx = -nr; dx <= nr; dx++) {
        const cx = cx0 + dx, cz = cz0 + dz;
        const mx = (cx + 0.5) * C - ex, mz = (cz + 0.5) * C - ez, d2 = mx * mx + mz * mz;
        if (d2 > R2) continue;
        if (!cells.has(cellKey(cx, cz))) { const ax = mx - lx, az = mz - lz; queue.push([Math.min(d2, ax * ax + az * az), cx, cz]); }
      }
      queue.sort((a, b) => a[0] - b[0]);
      const t0 = performance.now(), budget = hidden ? S.preBudgetMs : S.budgetMs;
      // THE FIELD'S TIERS (G2563): a cell is planted for the nearest the eye now is to it (3-D: across the ground to its square,
      // and the height), less 40 % - the eye may come that much closer before the cell needs its next slice; within `near`
      // the whole stream. Nearer than that, it is planted again (the prefix and the next slice; its birth kept, so nothing
      // that stood grows again), nearest first, on the same budget after the new cells.
      const ey = camera.position.y;
      const nearOf = cell => { const dx = Math.max(0, Math.abs((cell.cx + 0.5) * C - ex) - C / 2), dz = Math.max(0, Math.abs((cell.cz + 0.5) * C - ez) - C / 2);
        return Math.hypot(dx, dz, Math.max(0, ey - (cell.box ? cell.box[4] : gy))); };
      const tierFor = d => (!FIELD || !S.tier || d <= S.near * 0.5) ? 0 : d * 0.6;
      while (queue.length && performance.now() - t0 < budget && cells.size < S.maxCells) { const [, cx, cz] = queue.shift();
        const dx = Math.max(0, Math.abs((cx + 0.5) * C - ex) - C / 2), dz = Math.max(0, Math.abs((cz + 0.5) * C - ez) - C / 2);
        buildCell(cx, cz, FIELD ? tierFor(Math.hypot(dx, dz, Math.max(0, ey - world.terrainH((cx + 0.5) * C, (cz + 0.5) * C) - 4))) : 0); }   // (the cell's own ground, a hill's tufts are nearer than the AGL)
      if (FIELD && S.tier && performance.now() - t0 < budget) {
        const up = [];
        for (const cell of cells.values()) if (cell.dTier > 0) { const d = nearOf(cell); if (d < cell.dTier) up.push([d, cell]); }
        up.sort((a, b) => a[0] - b[0]); STAT.tierUp = up.length;
        for (const [d, cell] of up) { if (performance.now() - t0 >= budget) break; const born = cell.born; dropCell(cellKey(cell.cx, cell.cz)); buildCell(cell.cx, cell.cz, tierFor(d), born); }
      }
      STAT.plantMs = performance.now() - t0;
      for (const [k, cell] of cells) { const mx = (cell.cx + 0.5) * C - ex, mz = (cell.cz + 0.5) * C - ez; if (mx * mx + mz * mz > Rdrop) dropCell(k); }
      // A CELL PAST THE REACH DRAWS NOTHING (PERF 2026-09-23): the fade collapses every instance whose
      // 3D distance to the eye is past `reach` (trees.js FADE_VS), so a cell whose NEAREST point is past
      // it is only vertex work, a draw and a shadow draw - in flight most of the ring (at 120 m AGL the
      // whole outer band). Hidden, the picture is the same to the pixel; what goes with it is the shadow
      // those collapsed instances still cast (three's depth material has no fade), which was a phantom.
      { const ey = camera.position.y, R2r = S.reach * S.reach, dist2 = b => { const x = b.box; if (!x) return 0;
          const dx = Math.max(x[0] - ex, 0, ex - x[3]), dy = Math.max(x[1] - ey, 0, ey - x[4]), dz = Math.max(x[2] - ez, 0, ez - x[5]); return dx * dx + dy * dy + dz * dz; };
        const dirty = []; for (const b of blocks.values()) if (b.dirty) dirty.push(b);
        if (dirty.length) { dirty.sort((a, b) => dist2(a) - dist2(b)); for (const b of dirty.slice(0, S.blockBudget)) buildBlock(b); }
        STAT.dirty = Math.max(0, dirty.length - S.blockBudget);   // G1119: the blocks still to rebuild after this frame (0: the ring is idle)
        let shown = 0, draws = 0, sub = 0, all = 0;
        const band = bandNow(), href = S.hRef / Math.max(1e-6, fieldH0), sizeK = FIELD ? S.sizeFade : 0;
        for (const b of blocks.values()) { const d2 = b.box ? dist2(b) : 0, v = !!b.box && d2 < R2r * (sizeK > 0 ? SIZE_MAX * SIZE_MAX : 1); if (b.group.visible !== v) b.group.visible = v;
          if (v) { shown++;
            // THE TRUNCATION (G2561, buildBlock): the prefix the block's nearest point can show - its largest instance's size
            // fade taken, so no instance that would draw is left out; a block that shows none is not drawn at all
            const d = Math.sqrt(d2);
            for (const m of b.meshes) { const N0 = m.userData.n;
              if (S.trunc && m.userData.bins) { const ratio = sizeK > 0 ? Math.max(0.05, 1 + (Math.min(SIZE_MAX, Math.max(0.05, m.userData.smax / href)) - 1) * sizeK) : 1;
                const th = keepD(d / ratio) * aglK * (1 + band), NB = m.userData.bins.length - 1, cnt = th >= 1 ? N0 : m.userData.bins[Math.min(NB, Math.ceil(th * NB))];
                if (m.count !== cnt) m.count = cnt; const vis = cnt > 0; if (m.visible !== vis) m.visible = vis; }
              else if (m.count !== N0) { m.count = N0; m.visible = true; }
              if (m.visible) { draws++; sub += m.count; } all += N0; } }
          if (b.instCells && b.instVis !== v) { for (const cell of b.instCells) for (let k = 0; k < cell.inst.length; k += 2) batchVis(cell.inst[k], cell.inst[k + 1], v); b.instVis = v; } }
        STAT.shown = shown; STAT.blocks = blocks.size; STAT.draws = draws + batches.size; STAT.batches = batches.size; STAT.submitted = sub; STAT.inBlocks = all; }
      STAT.live = cells.size; STAT.queued = queue.length;
      let ni = 0; for (const c of cells.values()) ni += c.n; STAT.instances = ni;
      STAT.mixAt = ctx.biomeAt(ex, ez, 0.5);
    }
    const api = {
      update, root,
      get: () => Object.assign({}, S),
      set: o => { const was = Object.assign({}, S); Object.assign(S, o || {});
        if (FIELD && S.cards !== was.cards) protos.clear();   // the tufts are cut again
        // what the planting reads (a replant); the fade's dials (near, reach, taper, AGL, the size fade's strength) are live
        const PLANT = FIELD ? ['cell', 'cards', 'tufts', 'hK', 'sigmaK', 'blotch', 'clumpM', 'clumpAmp', 'tier', 'hRef', 'colour', 'match', 'vary', 'cutH', 'cutSigma', 'cutDens', 'stripH', 'stripDens', 'trunc']
                            : ['cell', 'density', 'shrubs', 'rocks', 'batch', 'castMinH', 'trunc'];
        if (PLANT.some(k => S[k] !== was[k])) api.replant(); return api.get(); },
      species: () => (FIELD ? FIELD_SPECIES.slice() : []),   // what the field plants (the first ring leaves it to it: ctx.owned)
      fadeSet: () => FSET,   // the field's own fade uniforms (null: the shared set) - GATE COVER reads them
      field: FIELD,
      replant: () => { for (const k of [...cells.keys()]) dropCell(k); for (const b of [...blocks.values()]) buildBlock(b); growing.length = 0; },
      rockPlan,                                                           // the rock map's read (above)
      // WHAT THE RING SEES AT A POINT (the instrument, 2026-09-22): the sub-grid node's own answers -
      // the mix, the pavement's kill and class, the land test - so a "why is there a log on the runway"
      // is one call instead of a guess
      nodeAt: (x, z) => { const C = S.cell, cx = Math.floor(x / C), cz = Math.floor(z / C), G = subGrid(cx * C, cz * C, C), k = G.at(x, z);
        return { cell: [cx, cz], mix: G.mix[k], code: G.code[k], ok: !!G.ok[k], kill: +G.kill[k].toFixed(3), cls: G.cls[k], kind: G.kind[k], boost: +G.boost[k].toFixed(3) }; },
      rockProtos: () => speciesOf().filter(rockish).map(c => ({ c, P: protosOf(c) })),   // the sprites' subjects (rocks and debris)
      stat: () => Object.assign({}, STAT, { by: Object.assign({}, STAT.by) }),   // a copy of the tally too (a shallow copy shared it)
      dispose: () => { api.replant(); for (const bm of batches.values()) { root.remove(bm); bm.dispose(); } batches.clear(); scene.remove(root); },
    };
    return api;
  }
  return { make, FIELD_TYPES, FIELD_SPECIES };   // (the field's table: the biome card's defaults, world_rail)
})();
if (typeof window !== 'undefined') window.COVER_RING = COVER_RING;
