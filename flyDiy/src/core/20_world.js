// ============================================================
// WORLD — deterministic procedural terrain + trees, shared by
// physics and renderer. Integer-hash noise: identical across JS engines.
// v1 contract (futureDesigns/WORLD-CONTRACT.md) + v0 shim on one object.
// Seed 0 (or no argument) is the VALIDATED world, bit-identical to the
// pre-contract makeWorld(); nonzero seeds are coherent but unvalidated.
// GATE WORLD freezes seed-0 data with golden hashes — intentional terrain
// changes must re-capture goldens in the same commit.
// ============================================================
function makeWorld(seed) {
  const SEED = seed | 0;                     // undefined -> 0: no-arg callers get the validated world
  const SALT = Math.imul(SEED, 0x9E3779B9);  // 0 for seed 0 — exact identity in hash2/LCG below
  const smf = t => t * t * (3 - 2 * t);
  const sstep = (a, b, t) => smf(Math.min(1, Math.max(0, (t - a) / (b - a))));
  const hash2 = (ix, iz) => {
    let h = (ix * 374761393 + iz * 668265263 + 1013904223 + SALT) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  function vnoise(x, z, cell) {
    const fx = x / cell, fz = z / cell;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = smf(fx - ix), tz = smf(fz - iz);
    const a = hash2(ix, iz), b = hash2(ix + 1, iz),
          c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  const fbm = (x, z) =>
    vnoise(x, z, 1400) * 0.45 + vnoise(x + 91, z + 37, 650) * 0.30 +
    vnoise(x + 7, z + 211, 300) * 0.17 + vnoise(x + 313, z + 97, 140) * 0.08;
  const ridge = (x, z, cell) => 1 - Math.abs(2 * vnoise(x + 555, z + 777, cell) - 1);

  function h0(x, z) {
    const n = fbm(x, z);
    const mount = sstep(700, 3200, -z);
    const sea = sstep(500, 2400, z);
    const rid = ridge(x, z, 1100) * 0.6 + ridge(x, z, 520) * 0.4;
    let h = (n - 0.35) * 45 + (0.55 * (n - 0.3) + 0.65 * (rid - 0.35)) * 620 * mount - 95 * sea;
    const dxC = Math.max(0, Math.max(-3400 - x, x - 400));
    const dzC = Math.max(0, Math.abs(z) - 750);
    h *= 0.06 + 0.94 * sstep(0, 700, Math.hypot(dxC, dzC));
    const dxR = Math.max(0, Math.max(-1180 - x, x - 130));
    const dzR = Math.max(0, Math.abs(z) - 90);
    h *= sstep(0, 260, Math.hypot(dxR, dzR));
    return h;
  }

  // surface enum — reserved classes included (PAVED/GRAVEL/... arrive with
  // WORLD-GEN-PROC stages); the classifier below is the honest v1 minimum.
  const SURFACE = { GRASS: 0, ROCK: 1, SCREE: 2, FOREST_FLOOR: 3, WATER: 4, PAVED: 5, GRAVEL: 6, SAND: 7 };

  // aerodrome registry — DESCRIPTIVE for now: the AP still flies the
  // def.params.ap constants (contract rule 6 deferred), and the h0 runway
  // carve box / renderer decals are not yet driven from these records.
  // hdg in radians from +x toward +z; the main strip's takeoff run is
  // along -x (hdg PI). tdz = touchdown-zone target point. elev for
  // meadows is filled from h0 below.
  const aerodromes = [
    { id: 'HOME', name: 'Home Strip', kind: 'main', x: -520, z: 0, hdg: Math.PI,
      len: 1100, wid: 30, surface: SURFACE.GRASS, elev: 0, tdz: [-450, 0] },
    { id: 'M1', name: 'Meadow 1', kind: 'meadow', x: -2200, z: -1500, r: 230,
      hdg: 0, len: 460, wid: 460, surface: SURFACE.GRASS, elev: 0, tdz: [-2200, -1500] },
    { id: 'M2', name: 'Meadow 2', kind: 'meadow', x: 1800, z: 1500, r: 260,
      hdg: 0, len: 520, wid: 520, surface: SURFACE.GRASS, elev: 0, tdz: [1800, 1500] },
    { id: 'M3', name: 'Meadow 3', kind: 'meadow', x: -3400, z: 650, r: 240,
      hdg: 0, len: 480, wid: 480, surface: SURFACE.GRASS, elev: 0, tdz: [-3400, 650] },
  ];
  // landing meadows: blend terrain toward the height at each meadow centre.
  // v0 shim member, derived from the registry — same literals, same order,
  // same {x,z,r,h} shape as the pre-contract array.
  const meadows = aerodromes.filter(a => a.kind === 'meadow').map(a => ({ x: a.x, z: a.z, r: a.r }));
  for (const m of meadows) m.h = h0(m.x, m.z);
  aerodromes.filter(a => a.kind === 'meadow').forEach((a, i) => { a.elev = meadows[i].h; });
  // meadow blend, factored: used by the pre-hydro base and final terrainH.
  // Applied AFTER the river carve so meadow interiors stay exactly flat.
  function blendM(x, z, h) {
    for (const m of meadows) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.r) { const w = sstep(m.r * 0.45, m.r, d); h = m.h * (1 - w) + h * w; }
    }
    return h;
  }
  // runway-pad ramp: 0 inside the pad box, 1 past 260 m out — the same box
  // the h0 flatten uses; masks the river carve so the pad stays exactly 0.
  function padRamp(x, z) {
    const dxR = Math.max(0, Math.max(-1180 - x, x - 130));
    const dzR = Math.max(0, Math.abs(z) - 90);
    return sstep(0, 260, Math.hypot(dxR, dzR));
  }
  // ---- stage 1 hydrology (WORLD-GEN-PROC): baked on the pre-hydro base
  // plus bake-only "drainage domes" over the runway pad and meadows so
  // rivers route AROUND aerodromes (stage 4 grades them properly later).
  // Domes never touch the real terrain; river water surfaces are
  // dome-corrected back via wsAdjust.
  const DOME = 3;
  function domes(x, z) {
    let s = DOME * (1 - padRamp(x, z));
    for (const m of meadows) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.r * 1.6) s += DOME * (1 - sstep(0, m.r * 1.6, d));
    }
    return s;
  }
  const HYD = bakeHydrology(
    (x, z) => blendM(x, z, h0(x, z)) + domes(x, z),
    { x0: -4500, z0: -4500, x1: 4500, z1: 4500, N: 384,
      lakeMin: 1.5, A0: 500, kW: 0.35, kD: 0.4, maxW: 45, dLake: 2,
      dpEps: 25, bankFrac: 1.4, qCell: 96, wsAdjust: domes });
  function terrainH(x, z) {
    let h = h0(x, z);
    const r = padRamp(x, z);
    if (r > 0) h += (HYD.carve(x, z, h) - h) * r;
    return blendM(x, z, h);
  }

  // ---- stage 2 biomes: analytic classifier + tree placement plan ----
  // (waterAt/terrainH are function declarations — hoisted, safe to bind)
  const B = makeBiomes({ terrainH, waterOf: waterAt, distW: HYD.distW, SURFACE, salt: SALT });

  // trees: stage-2 biome placement — deterministic jittered 64 m grid,
  // order-independent per point (replaces the v0 sequential LCG loop);
  // density + species from the biome module, clustered by stand noise.
  // v0 exclusions kept verbatim (battery safety): corridor box, meadows
  // 0.8r; the runway pad self-rejects via h<2 (carve-masked flat at 0).
  // Records {x,z,h,s,sp}: h = GROUND height at base, s scale in the v0
  // envelope (solver radius/canopy formulas unchanged), sp = species.
  const trees = [], CELL = 64, grid = new Map();
  {
    const G0 = -4224, GN = 132, GS = 64;   // ±4224 m (v0 domain was ±4200)
    for (let gz = 0; gz < GN; gz++) for (let gx = 0; gx < GN; gx++) {
      const j1 = hash2(gx + 9173, gz - 2417), j2 = hash2(gx - 5807, gz + 7919),
            j3 = hash2(gx + 1229, gz + 4051);
      const x = G0 + (gx + 0.15 + 0.70 * j1) * GS;
      const z = G0 + (gz + 0.15 + 0.70 * j2) * GS;
      const h = terrainH(x, z);
      if (h < 2 || h > B.TREELINE) continue;
      if (Math.abs(z) < 60 && x < 150 && x > -3300) continue;
      let nearMeadow = false;
      for (const m of meadows)
        if (Math.hypot(x - m.x, z - m.z) < m.r * 0.8) { nearMeadow = true; break; }
      if (nearMeadow) continue;
      if (HYD.water(x, z) > h) continue;
      const tp = B.treeAt(x, z, h);
      if (!tp || j3 > tp.p) continue;
      const idx = trees.length;
      trees.push({ x, z, h, s: tp.s, sp: tp.sp });
      const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(idx);
    }
  }
  function treesNear(x, z, out) {
    out.length = 0;
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const cell = grid.get(`${cx + a},${cz + b}`);
      if (cell) for (const i of cell) out.push(i);
    }
    return out;
  }

  // ---- v1 continuous fields. waterH: stage-1 rivers at their monotone
  // reach surfaces + lakes at spill height + sea (level 0) where the
  // PRE-CARVE base is below 0 — a riverbed carved under sea level inland
  // is a dry trench, not sea. surface is still the pre-biome minimum
  // (stages 2/5 refine ROCK/SCREE/etc.).
  function waterAt(t, x, z) {
    const ws = HYD.water(x, z);
    if (ws > t) return ws;
    if (t < 0 && blendM(x, z, h0(x, z)) < 0) return 0;
    return -Infinity;
  }
  function waterH(x, z) { return waterAt(terrainH(x, z), x, z); }
  // surface: stage-2 biome classifier (WATER/SAND/ROCK/SCREE/FOREST_FLOOR/
  // GRASS from altitude+slope+moisture+distance-to-water; PAVED/GRAVEL
  // still reserved for stage 4)
  const surface = B.surface;

  // ---- v1 tiled features: lazy bucketing of the eager tree array plus
  // stage-1 river reaches (a reach spanning several tiles appears in each
  // of them — reach records {pts, ws, w, d, acc, term} are shared refs).
  // trees stays ONE flat index-stable array — treesNear returns indices
  // into it and the solver depends on that; tiles hold the same objects.
  // roads/buildings are empty until WORLD-GEN-PROC stage 3.
  // tile() is never called during makeWorld: zero load-time cost.
  const TILE = 512;
  let tileIndex = null;
  function tile(ix, iz) {
    if (!tileIndex) {
      tileIndex = new Map();
      const rec0 = key => {
        let rec = tileIndex.get(key);
        if (!rec) tileIndex.set(key, rec = { trees: [], rivers: [], roads: [], buildings: [] });
        return rec;
      };
      for (const t of trees) rec0(Math.floor(t.x / TILE) + ',' + Math.floor(t.z / TILE)).trees.push(t);
      for (const r of HYD.rivers) {
        const keys = new Set();
        for (let i = 0; i + 1 < r.pts.length; i++) {
          const tx0 = Math.floor(Math.min(r.pts[i][0], r.pts[i + 1][0]) / TILE);
          const tx1 = Math.floor(Math.max(r.pts[i][0], r.pts[i + 1][0]) / TILE);
          const tz0 = Math.floor(Math.min(r.pts[i][1], r.pts[i + 1][1]) / TILE);
          const tz1 = Math.floor(Math.max(r.pts[i][1], r.pts[i + 1][1]) / TILE);
          for (let a = tx0; a <= tx1; a++) for (let b = tz0; b <= tz1; b++) keys.add(a + ',' + b);
        }
        for (const key of keys) rec0(key).rivers.push(r);
      }
    }
    const key = ix + ',' + iz;
    let rec = tileIndex.get(key);
    if (!rec) tileIndex.set(key, rec = { trees: [], rivers: [], roads: [], buildings: [] });
    return rec;
  }

  // ---- wind field: steady vector + deterministic Dryden-ish gusts ----
  // setWind({ base:[wx,wy,wz], gust:g }) — gusts are sums of incommensurate
  // sines with spatial phase (advecting waves), amplitude g horizontal and
  // 0.6*g vertical. Deterministic by construction: gates can rely on it.
  // Default null: wind() returns the shared zero vector (fast path).
  let windSpec = null;
  const W0 = [0, 0, 0], WV = [0, 0, 0];
  const GC = [ // [freq rad/s, kx, kz, phase, axis weight x,y,z]
    [0.63, 0.011, 0.005, 0.7, 1.0, 0.35, 0.55],
    [1.37, 0.004, 0.013, 2.9, 0.55, 0.6, 1.0],
    [2.71, 0.009, 0.008, 5.1, 0.7, 1.0, 0.6],
    [0.29, 0.002, 0.003, 1.9, 1.0, 0.25, 0.8],
  ];
  function wind(x, y, z, t) {
    if (!windSpec) return W0;
    const b = windSpec.base, g = windSpec.gust || 0;
    WV[0] = b[0]; WV[1] = b[1]; WV[2] = b[2];
    if (g > 0) for (const [om, kx, kz, ph, ax, ay, az] of GC) {
      const s = Math.sin(om * t + kx * x + kz * z + ph);
      WV[0] += g * 0.30 * ax * s;
      WV[1] += g * 0.18 * ay * s;
      WV[2] += g * 0.30 * az * s;
    }
    return WV;
  }
  function setWind(spec) { windSpec = spec ? { base: spec.base || [0, 0, 0], gust: spec.gust || 0 } : null; }

  return {
    // ---- v1 contract (futureDesigns/WORLD-CONTRACT.md) ----
    v: 1, seed: SEED,
    bounds: { x0: -4500, z0: -4500, x1: 4500, z1: 4500 },
    terrainH, waterH, surface, SURFACE,
    TILE, tile, aerodromes, settlements: [],
    treesNear,
    // informative stage-1 block (not contract surface): gates/debug read
    // reach records and bake stats here without walking every tile.
    hydro: { rivers: HYD.rivers, lakeCount: HYD.lakeCount, lakeCells: HYD.lakeCells, bakeMs: HYD.stats.bakeMs, water: HYD.water, lakeSurf: HYD.lakeSurf, cellW: HYD.stats.cellW, distW: HYD.distW },
    // ---- v0 shim: same live objects, byte-identical values ----
    trees, meadows, CELL, wind, setWind,
  };
}
