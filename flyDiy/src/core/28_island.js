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
    };
  }

  return { makeIsland, WC, ISLAND_GEO };
})();
if (typeof module !== 'undefined' && module.exports && !module.exports.makeWorld) module.exports = ISLAND_GEN;
