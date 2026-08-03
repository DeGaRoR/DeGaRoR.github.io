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
  function terrainH(x, z) {
    let h = h0(x, z);
    for (const m of meadows) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.r) { const w = sstep(m.r * 0.45, m.r, d); h = m.h * (1 - w) + h * w; }
    }
    return h;
  }

  // trees on terrain, deterministic; spatial hash for collisions
  const rng = (st => () => (st = (st * 1664525 + 1013904223) >>> 0) / 4294967296)((7 + SALT) >>> 0);
  const trees = [], CELL = 64, grid = new Map();
  let guard = 0;
  while (trees.length < 2200 && guard++ < 60000) {
    const x = (rng() - 0.5) * 8400, z = (rng() - 0.5) * 8400;
    const h = terrainH(x, z);
    if (h < 2 || h > 160) continue;
    if (Math.abs(z) < 60 && x < 150 && x > -3300) continue;
    let nearMeadow = false;
    for (const m of meadows)
      if (Math.hypot(x - m.x, z - m.z) < m.r * 0.8) { nearMeadow = true; break; }
    if (nearMeadow) continue;
    const s = 0.7 + rng() * 1.1;
    const idx = trees.length;
    trees.push({ x, z, h, s });
    const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(idx);
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

  // ---- v1 continuous fields: honest minimal interiors, replaced by
  // WORLD-GEN-PROC stages 1 (hydrology -> waterH) and 2/5 (biomes/cliffs
  // -> surface). Sea level = 0 per bounds; the sea basin sits at -66..-110.
  function waterH(x, z) { return terrainH(x, z) < 0 ? 0 : -Infinity; }
  function surface(x, z) {
    const h = terrainH(x, z);
    if (h < 0) return SURFACE.WATER;
    if (h >= 220) return SURFACE.ROCK;  // renderer's rock-band onset
    return SURFACE.GRASS;
  }

  // ---- v1 tiled features: lazy bucketing of the eager tree array.
  // trees stays ONE flat index-stable array — treesNear returns indices
  // into it and the solver depends on that; tiles hold the same objects.
  // rivers/roads/buildings are empty until WORLD-GEN-PROC stages 1/3.
  // tile() is never called during makeWorld: zero load-time cost.
  const TILE = 512;
  let tileIndex = null;
  function tile(ix, iz) {
    if (!tileIndex) {
      tileIndex = new Map();
      for (const t of trees) {
        const key = Math.floor(t.x / TILE) + ',' + Math.floor(t.z / TILE);
        let rec = tileIndex.get(key);
        if (!rec) tileIndex.set(key, rec = { trees: [], rivers: [], roads: [], buildings: [] });
        rec.trees.push(t);
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
    // ---- v0 shim: same live objects, byte-identical values ----
    trees, meadows, CELL, wind, setWind,
  };
}
