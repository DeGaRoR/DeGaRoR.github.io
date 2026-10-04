// ============================================================
// THE ISLAND (W2, 2026-09-14) — a world source from DATA, not noise.
//
// makeWorld(seed, { island }) takes what makeIsland() returns and builds
// the same contract on it: the baked quadtree (19_terrain_codec) is the
// ground, the cover grid (ESA WorldCover, 10 m) is the classifier, the
// canopy grid (Meta/WRI, decimated to the same 10 m) is the trees' height.
// futureDesigns/ISLAND-ANNETTE.md is the document; tools/island_prep.py
// writes the grids and tools/terrain_bake.js the asset.
//
// THE FRAME. Game x = Albers E - origin E; game z = origin N - Albers N,
// so north is -z as in the analytic world (its mountains are "northern" at
// z < 0). Row 0 of every grid is the NORTH edge, at z0. The origin is the
// island's own: Jolene's is the WWII field's centre, so HOME's strip is
// cut where the real runways are.
//
// THE EFFECTIVE CLASS. WorldCover says "tree cover" on 20 % of Jolene's
// cells where the canopy map says under `reclass` metres — subalpine heath
// on the ridges, bog on the flats. Two layers disagreeing is information:
// tree cover without a canopy is SHRUBLAND here, for the classifier and the
// planting alike. The bench's knob, the user's 2.5 m (G392.3).
//
// Pure: no THREE, no DOM. In node the gates can build one from the files.
// ============================================================
var ISLAND_GEN = (function () {
  'use strict';
  const WC = { TREE: 10, SHRUB: 20, GRASS: 30, CROP: 40, BUILT: 50, BARE: 60,
               SNOW: 70, WATER: 80, WETLAND: 90, MOSS: 100 };
  const ISLAND_GEO = {
    jolene: { lat: 55.04327, lon: -131.57222, convergenceDeg: 19.32,
              tz: { std: -9, dst: 'us', name: 'AKST', dstName: 'AKDT' } },
  };

  // src: { id, header, topo: Uint8Array, payload: Uint8Array (gunzipped),
  //        grid: { meta, cover: Uint8Array, canopy: Uint8Array | null },
  //        reclass?: metres (default 2.5) }
  function makeIsland(src) {
    if (typeof TERRAIN_CODEC === 'undefined') throw new Error('island: no TERRAIN_CODEC');
    const H = src.header;
    const root = TERRAIN_CODEC.decodeRaw(H, src.topo, src.payload);
    const terrainQ = TERRAIN_CODEC.sampler(root, H);
    const g = src.grid.meta, cover = src.grid.cover, canopy = src.grid.canopy || null;
    const coast = src.grid.coast || null;      // signed distance to the waterline, 128 = 0, 4 m a unit, + inland
    const W = g.w, Hn = g.h, cell = g.cell, gx0 = g.x0, gz0 = g.z0;
    const reclass = src.reclass != null ? src.reclass : 2.5;

    const cellAt = (x, z) => {
      const i = Math.floor((x - gx0) / cell), j = Math.floor((z - gz0) / cell);
      if (i < 0 || j < 0 || i >= W || j >= Hn) return -1;
      return j * W + i;
    };
    const classAt = (x, z) => { const k = cellAt(x, z); return k < 0 ? WC.WATER : cover[k]; };
    // the signed coast, bilinear (the field's whole point: a smooth line through the cells)
    const coastAt = (x, z) => {
      if (!coast) return 1e9;
      const u = (x - gx0) / cell - 0.5, v = (z - gz0) / cell - 0.5;
      const i = Math.max(0, Math.min(W - 2, Math.floor(u))), j = Math.max(0, Math.min(Hn - 2, Math.floor(v)));
      const fu = Math.max(0, Math.min(1, u - i)), fv = Math.max(0, Math.min(1, v - j));
      const p = j * W + i;
      const a = coast[p], b = coast[p + 1], c = coast[p + W], d = coast[p + W + 1];
      return (((a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv) - 128) * 4;
    };
    // the signed lake field, bilinear, the same way (G413: the bake takes it as its lakes)
    const lakeAt = (x, z) => {
      const L = src.grid.lake; if (!L) return -1e9;
      const u = (x - gx0) / cell - 0.5, v = (z - gz0) / cell - 0.5;
      const i = Math.max(0, Math.min(W - 2, Math.floor(u))), j = Math.max(0, Math.min(Hn - 2, Math.floor(v)));
      const fu = Math.max(0, Math.min(1, u - i)), fv = Math.max(0, Math.min(1, v - j));
      const p = j * W + i;
      const a = L[p], b = L[p + 1], c = L[p + W], d = L[p + W + 1];
      return (((a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv) - 128) * 4;
    };
    // THE SEA FLOOR. The DEM is 0 over the sea; the game's water plane sits at
    // -0.4 and the floats' hydro wants a depth. There is no bathymetry, so the
    // sea is a shelf off the coast field: -5 m at the line (the far mesh is
    // eps 4: a shallower start let it lift the floor above the water plane in
    // patches - G402), -14 m by 500 m out, the DEM's own value on land.
    const seaFloor = sd => { const t = Math.min(1, -sd / 500); return -5.0 - 9.0 * t * t * (3 - 2 * t); };
    // THE LAKEBEDS ARE CARVED (LAKE-HOLES G1335, the user 2026-10-03: "unacceptable"). The IFSAR DEM returns a lake's
    // SURFACE, so the prep's flattened lake stood at its own level - often over it, 4 282 field texels on Jolene 0.8-3 m
    // and some 5 m - and the renderer CUT the ground away inside every lake (a discard a metre in) to hide it: wherever
    // the shore stood over the water the eye saw a vertical gap between the ground's jagged cut edge and the flat water,
    // the clear colour through it. Now the ground is CONTINUOUS and lies under the water: inside a lake's field
    // (the physics' lake field, + inside) the ground is held under the lake's level - `edge` under it at the line,
    // sloping to `depth` by `shoreW` metres in - and on the bank (outside the line) under a slope that rises out of the
    // line along a profile (THE BANK SHELVES, below), so a bank over the water meets the bed without a step (min with the DEM: a ground
    // already lower - a real bed, a bank below the lake - is kept; this only ever LOWERS the ground, so every ceiling
    // the codec gives (hMaxRect) still holds). WHICH LAKE: each field texel has ONE owner, made once here - an inside
    // texel (the field > 0) belongs to the lake whose box holds it, and where boxes overlap to the one whose level the
    // DEM there is nearest (the prep flattened each lake to its own level; a pond's box over a big lake's water is not
    // the pond's); a bank texel (within `bank` metres out) to the lake of the nearest inside texel. The bed and its bank
    // are then one lake's on both sides of the line and continuous across it (a rule by boxes alone stepped 10 m where
    // two lakes' boxes meet at different levels, and dug a 60 m pit round a hillside pond inside a big lake's box -
    // GATE LAKEBED's walk). The records are the ones the world keeps (level > 0.2, cells >= 3); a texel no record owns is
    // left as the DEM has it. Per lake a byte mask over its box and the bank's reach: 0.67 MB on Jolene, built in ~40 ms.
    // THE BANK SHELVES (SHORES G1500, the user 2026-10-04: the carved banks "read as steep, stretched slopes"). The bank
    // was s + s^2/16 over the line (`old` below) - 45 deg at the water, 63 deg by 8 m out - so a bank the DEM held over
    // the water became a wall: of the carved bank points outside the line, 10 400 of 13 700 steeper than 45 deg, many
    // where the DEM itself was 30-45. Now the bank is a SLOPE PROFILE (`prof`: [metres out, rise per metre] knots,
    // linear between, integrated): a lip that takes the ground just over the water (1:1 for 0.4 m, as before), a SHELF
    // at the waterline (1:5.5 from 1.2 to 4.5 m out: the margin a shore has, ~1 m over the water at 4.5 m), then a FACE
    // at 0.75 (37 deg) - the hill gives way further back instead of standing as a wall over the water.
    // THE CAP (`cap` 6 m): the gentle bank may cut at most `cap` metres deeper than the old law did (the ground known,
    // bed(x, z, g)) - a lake under a cliff gets its shelf and a gentle toe, then the cliff's own face lowered by at most
    // `cap` (the gentle law alone cut 35.7 m into one; no hill moves away from its lake); the cap fades to 0 over the last
    // 45 % of the reach, so at `bank` (30 m, as before: the same masks) the ground is the old law's - which met the DEM
    // before the reach everywhere on Jolene (GATE LAKEBED's walk). Without the ground (bed(x, z)) the gentle law alone.
    const LAKE_BED = { edge: 0.5, depth: 3.0, shoreW: 12, bank: 30, cap: 6,
                       prof: [[0, 1], [0.4, 1], [1.2, 0.18], [4.5, 0.18], [8, 0.75]] };
    // the bank's rise over (level - edge) at s metres out: the profile's slope integrated (trapezoids between knots)
    const bankRise = (() => {
      const K = LAKE_BED.prof, cum = [0];
      for (let k = 1; k < K.length; k++) cum.push(cum[k - 1] + (K[k][0] - K[k - 1][0]) * (K[k][1] + K[k - 1][1]) / 2);
      const last = K.length - 1;
      return s => {
        if (s >= K[last][0]) return cum[last] + (s - K[last][0]) * K[last][1];
        let k = 1; while (K[k][0] < s) k++;
        const s0 = K[k - 1][0], g0 = K[k - 1][1], g1 = K[k][1], d = s - s0, t = d / (K[k][0] - s0);
        return cum[k - 1] + d * (g0 + (g0 + (g1 - g0) * t)) / 2;
      };
    })();
    const bankOld = s => s + s * s / 16;   // LAKE-HOLES' bank (G1336): the cap's reference
    LAKE_BED.rise = bankRise; LAKE_BED.riseOld = bankOld;
    const lakeBed = (() => {
      const LF = src.grid.lake, recs = (src.grid.lakes || []).filter(L => L.level > 0.2 && L.cells >= 3);
      if (!LF || !recs.length) return null;
      const R = Math.ceil(LAKE_BED.bank / cell) + 1, VB = 128 - Math.ceil(LAKE_BED.bank / 4);   // the bank's reach: in texels, as a field byte
      const own = recs.map(L => {
        const i0 = Math.max(0, Math.floor((L.x0 - gx0) / cell) - 1 - R), i1 = Math.min(W - 1, Math.ceil((L.x1 - gx0) / cell) + 1 + R);
        const j0 = Math.max(0, Math.floor((L.z0 - gz0) / cell) - 1 - R), j1 = Math.min(Hn - 1, Math.ceil((L.z1 - gz0) / cell) + 1 + R);
        const o = { L, level: L.level, i0, j0, w: i1 - i0 + 1, h: j1 - j0 + 1, m: null };
        o.m = new Uint8Array(o.w * o.h);
        // inside: the box + a texel (255)
        const bi0 = Math.max(i0, Math.floor((L.x0 - gx0) / cell) - 1), bi1 = Math.min(i1, Math.ceil((L.x1 - gx0) / cell) + 1);
        const bj0 = Math.max(j0, Math.floor((L.z0 - gz0) / cell) - 1), bj1 = Math.min(j1, Math.ceil((L.z1 - gz0) / cell) + 1);
        const ins = [];
        for (let j = bj0; j <= bj1; j++) for (let i = bi0; i <= bi1; i++) if (LF[j * W + i] > 128) { o.m[(j - j0) * o.w + (i - i0)] = 255; ins.push(i, j); }
        // A LAGOON AT THE SEA'S LEVEL: a record whose inside the DEM holds at the sea's 0 (a tidal flat on the coast; the
        // record says ~2.7 m, the ground 0) is the SEA's water - the physics' sea rule takes it (20_world waterAt) and the
        // renderer draws its quad there (0, the median of the physics' samples) - so its bed is carved under 0, not under
        // a record the water never stands at. The median of up to 16 of its inside texels.
        if (ins.length) { const st = Math.max(1, Math.floor(ins.length / 2 / 16)), hs = [];
          for (let q = 0; q < ins.length; q += 2 * st) hs.push(terrainQ(gx0 + (ins[q] + 0.5) * cell, gz0 + (ins[q + 1] + 0.5) * cell));
          hs.sort((p, q) => p - q); if (hs[hs.length >> 1] <= 0.05) o.level = 0; }
        return o;
      });
      const pairs = [];
      for (let a = 0; a < own.length; a++) for (let b = a + 1; b < own.length; b++) {
        const A = own[a], B = own[b];
        if (A.i0 < B.i0 + B.w && B.i0 < A.i0 + A.w && A.j0 < B.j0 + B.h && B.j0 < A.j0 + A.h) pairs.push([A, B]);
      }
      // a texel both claim: the one rule decides, and the loser's byte is cleared
      const contest = (keepA) => { for (const [A, B] of pairs) {
        const i0 = Math.max(A.i0, B.i0), i1 = Math.min(A.i0 + A.w, B.i0 + B.w), j0 = Math.max(A.j0, B.j0), j1 = Math.min(A.j0 + A.h, B.j0 + B.h);
        for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
          const ka = (j - A.j0) * A.w + (i - A.i0), kb = (j - B.j0) * B.w + (i - B.i0), va = A.m[ka], vb = B.m[kb];
          if (!va || !vb) continue;
          if (keepA(A, B, va, vb, i, j)) B.m[kb] = 0; else A.m[ka] = 0;
        } } };
      // the inside: the lake whose own box holds the texel's centre, over one that reaches it only by its one-texel pad
      // (COLD-LINKS x LAKE-HOLES, lakes-2: a point 5 m inside a 31.70 m lake's box went to the 32.52 m lake whose box
      // ends 5 m short of it, by the DEM rule alone - GATE HYDRODYN); both boxes or neither: the level the DEM is nearest;
      // a tie, the smaller box
      const inBox = (L, x, z) => x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1;
      contest((A, B, va, vb, i, j) => {
        const x = gx0 + (i + 0.5) * cell, z = gz0 + (j + 0.5) * cell, ba = inBox(A.L, x, z), bb = inBox(B.L, x, z);
        if (ba !== bb) return ba;
        const h = terrainQ(x, z), da = Math.abs(h - A.level), db = Math.abs(h - B.level);
        if (da !== db) return da < db;
        return (A.L.x1 - A.L.x0) * (A.L.z1 - A.L.z0) <= (B.L.x1 - B.L.x0) * (B.L.z1 - B.L.z0); });
      // the bank: the nearest inside texel's lake (1 + its squared distance in texels) - a chamfer distance (3-4) over the
      // lake's rect, two passes (a 9 x 9 window search per bank texel was half the build)
      for (const o of own) {
        const m = o.m, w = o.w, h = o.h, d = new Uint16Array(w * h);
        for (let k = 0; k < d.length; k++) d[k] = m[k] === 255 ? 0 : 65000;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i; let v = d[k]; if (!v) continue;
          if (i > 0 && d[k - 1] + 3 < v) v = d[k - 1] + 3;
          if (j > 0) { if (d[k - w] + 3 < v) v = d[k - w] + 3; if (i > 0 && d[k - w - 1] + 4 < v) v = d[k - w - 1] + 4; if (i < w - 1 && d[k - w + 1] + 4 < v) v = d[k - w + 1] + 4; }
          d[k] = v; }
        for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) { const k = j * w + i; let v = d[k]; if (!v) continue;
          if (i < w - 1 && d[k + 1] + 3 < v) v = d[k + 1] + 3;
          if (j < h - 1) { if (d[k + w] + 3 < v) v = d[k + w] + 3; if (i < w - 1 && d[k + w + 1] + 4 < v) v = d[k + w + 1] + 4; if (i > 0 && d[k + w - 1] + 4 < v) v = d[k + w - 1] + 4; }
          d[k] = v; }
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const k = j * w + i; if (m[k]) continue;
          const v = LF[(j + o.j0) * W + (i + o.i0)]; if (v > 128 || v < VB) continue;
          const dd = d[k] / 3; if (dd <= R + 0.5) m[k] = 1 + Math.round(dd * dd);
        }
      }
      // ...and two lakes' banks: the nearer; a tie, the higher level (the lesser cut)
      contest((A, B, va, vb) => (va !== vb ? va < vb : A.level >= B.level));
      // the lakes over 256 m cells, a flat array over the grid (an empty cell is the common case and the cheap one: the
      // physics' hot path asks terrainH per node per substep - no field read there)
      const CELL = 256, CX = Math.ceil(W * cell / CELL) + 1, CZ = Math.ceil(Hn * cell / CELL) + 1, cells = new Array(CX * CZ);
      const cellOf = (x, z) => { const ix = Math.floor((x - gx0) / CELL), iz = Math.floor((z - gz0) / CELL); return ix < 0 || iz < 0 || ix >= CX || iz >= CZ ? -1 : iz * CX + ix; };
      for (const o of own)
        for (let ix = Math.floor(o.i0 * cell / CELL); ix <= Math.floor((o.i0 + o.w) * cell / CELL) && ix < CX; ix++)
          for (let iz = Math.floor(o.j0 * cell / CELL); iz <= Math.floor((o.j0 + o.h) * cell / CELL) && iz < CZ; iz++) {
            const k = iz * CX + ix; (cells[k] || (cells[k] = [])).push(o);
          }
      const sm = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
      // the bed's height at (x, z), or Infinity where no lake holds the ground down; g: the ground there (the bank's cap)
      const bed = (x, z, g) => {
        const ci = cellOf(x, z), a = ci < 0 ? null : cells[ci];
        if (!a) return Infinity;
        const sd = lakeAt(x, z);
        if (sd < -LAKE_BED.bank) return Infinity;
        const ti = Math.floor((x - gx0) / cell), tj = Math.floor((z - gz0) / cell);
        let lv = -Infinity;
        for (let n = 0; n < a.length; n++) {
          const o = a[n], i = ti - o.i0, j = tj - o.j0;
          if (i < 0 || j < 0 || i >= o.w || j >= o.h || !o.m[j * o.w + i]) continue;
          lv = o.level; break;
        }
        if (lv === -Infinity) return Infinity;
        if (sd >= 0) return lv - LAKE_BED.edge - (LAKE_BED.depth - LAKE_BED.edge) * sm(sd / LAKE_BED.shoreW);
        const s = -sd, b0 = lv - LAKE_BED.edge, gentle = b0 + bankRise(s);
        if (!(g < Infinity)) return gentle;
        // (the cap: never more than `cap` under the old law's carved ground, fading out over the reach's last 45 %)
        const t = Math.max(0, Math.min(1, (s - 0.55 * LAKE_BED.bank) / (0.45 * LAKE_BED.bank)));
        return Math.max(gentle, Math.min(g, b0 + bankOld(s)) - LAKE_BED.cap * (1 - t * t * (3 - 2 * t)));
      };
      // the owning lake's level INSIDE its line (the field >= 0), or -Infinity: the physics' water there (20_world waterAt)
      // - one lake per texel, the bed's own, so the floats ride the surface the bed was carved under
      bed.levelAt = (x, z) => {
        const ci = cellOf(x, z), a = ci < 0 ? null : cells[ci];
        if (!a || lakeAt(x, z) < 0) return -Infinity;
        const ti = Math.floor((x - gx0) / cell), tj = Math.floor((z - gz0) / cell);
        for (let n = 0; n < a.length; n++) {
          const o = a[n], i = ti - o.i0, j = tj - o.j0;
          // (an INSIDE texel only - 255. A bank texel ON the line - the field's 128, lakeAt 0 - is another lake's water or
          // none: a 5-cell pond at 9.06 m whose texels are all 128 answered its neighbours' 4.03 and 6.47 through their banks,
          // GATE HYDRODYN; waterAt's own rules answer there, as before LAKE-HOLES. COLD-LINKS x LAKE-HOLES, lakes-2)
          if (i >= 0 && j >= 0 && i < o.w && j < o.h && o.m[j * o.w + i] === 255) return o.level;
        }
        return -Infinity;
      };
      // a record's level as the bed takes it (the renderer's quad: 0 for a lagoon at the sea's level, else its own)
      const byRec = new Map(own.map(o => [o.L, o.level]));
      bed.levelOf = L => (byRec.has(L) ? byRec.get(L) : L.level);
      bed.bytes = own.reduce((t, o) => t + o.m.length, 0);
      return bed;
    })();
    // (the bed is NOT applied here: this is the island's raw ground, the one the hydrology is baked on and the premises
    // are composed over - makeWorld's terrainH takes the bed on top of the composed ground, 20_world.js G1335)
    const terrainH = coast
      ? (x, z) => { const h = terrainQ(x, z); const sd = coastAt(x, z);
                    return sd >= 0 ? h : Math.min(h, seaFloor(sd)); }
      : terrainQ;
    const canopyAt = (x, z) => { if (!canopy) return 0; const k = cellAt(x, z); return k < 0 ? 0 : canopy[k]; };
    const effClass = (x, z) => {
      const k = cellAt(x, z);
      if (k < 0) return WC.WATER;
      const c = cover[k];
      if (c === WC.TREE && canopy && canopy[k] < reclass) return WC.SHRUB;
      return c;
    };
    // the square domain the baker walked; the grid may be narrower (sea)
    const b = H.bounds;
    return {
      id: src.id || 'island', v: 1,
      bounds: { x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 },
      // WHERE IT STANDS (SKY S1): the origin's lat/lon, and how far the
      // grid's north (Alaska Albers, EPSG:3338) leans east of true north here
      // — measured with rasterio at the origin (19.32°; the analytic conic
      // formula n(λ-λ0) gives 19.35). A sun placed by true azimuth without
      // it would light from 19° off at noon. The header may override.
      geo: Object.assign({}, ISLAND_GEO[src.id] || ISLAND_GEO.jolene, H.geo || {}),
      hMax: H.hMax || 0,
      terrainH, classAt, canopyAt, effClass, cellAt, coastAt, lakeAt, seaFloor: coast ? seaFloor : null, WC,
      // (G1335) the carved lakebed (null without a lake field): makeWorld's terrainH and the far terrain's patches (the asset
      // is the raw DEM) take it as they take the sea's shelf; LAKE_BED the law's dials (GATE LAKEBED reads them)
      lakeBed, LAKE_BED,
      // the ground's ceiling over a rectangle (the codec's maxRect; the coast's min only lowers it)
      hMaxRect: (ax, az, bx, bz) => TERRAIN_CODEC.maxRect(root, H, ax, az, bx, bz),
      albedo: src.grid.albedo || null,
      tint: src.grid.tint || null, ori1: src.grid.ori1 || null, coastU8: coast, canopyU8: canopy,
      coverU8: cover, ndvi: src.grid.ndvi || null, lake: src.grid.lake || null, ttype: src.grid.ttype || null, lakes: src.grid.lakes || null,
      // 'blend' (G413, the default): the map's lakes, the bake's rivers between them, narrowed;
      // 'map': the map's lakes alone; 'proc': the analytic bake's lakes and rivers (G405, to compare)
      hydro: src.hydro || 'blend',
      // the far terrain's own tree (eps 4): the leaves the renderer merges into the far mesh
      farHeader: src.far ? src.far.header : null,
      farRoot: src.far ? TERRAIN_CODEC.decodeRaw(src.far.header, src.far.topo, src.far.payload) : null,
      canopyP90: (g.layers && g.layers.canopy && g.layers.canopy.p90OverTreeCover) || 15,
      grid: { w: W, h: Hn, cell, x0: gx0, z0: gz0 },
      header: H, root,
      // (G835) the premises' cooked data the loader fetched for this island (tools/premises_cook.js), or null:
      // today its raster cells, read by makeWorld's setPremises when the ground raster is on
      premCook: src.premCook || null,
    };
  }

  return { makeIsland, WC, ISLAND_GEO };
})();
if (typeof module !== 'undefined' && module.exports && !module.exports.makeWorld) module.exports = ISLAND_GEN;
