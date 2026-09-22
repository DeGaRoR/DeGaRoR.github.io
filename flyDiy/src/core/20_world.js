// ============================================================
// WORLD — deterministic procedural terrain + trees, shared by
// physics and renderer. Integer-hash noise: identical across JS engines.
// v1 contract (futureDesigns/WORLD-CONTRACT.md) + v0 shim on one object.
// Seed 0 (or no argument) is the VALIDATED world, bit-identical to the
// pre-contract makeWorld(); nonzero seeds are coherent but unvalidated.
// GATE WORLD freezes seed-0 data with golden hashes — intentional terrain
// changes must re-capture goldens in the same commit.
// ============================================================
function makeWorld(seed, opts) {
  const SEED = seed | 0;                     // undefined -> 0: no-arg callers get the validated world
  // THE ISLAND (W2, 2026-09-14): a world source from data (28_island.js). With
  // it, the data's ground stands in for the noise, its cover grid for the
  // classifier, its canopy for the trees' size, its square for the domain;
  // settlements and the sea lane are not sited (nothing is reproduced - the
  // premise). Without it every line below is the analytic world, byte for
  // byte (GATE WORLD's goldens).
  const ISL = (opts && opts.island) || null;
  const BOUNDS = ISL ? { x0: ISL.bounds.x0, z0: ISL.bounds.z0, x1: ISL.bounds.x1, z1: ISL.bounds.z1 }
                     : { x0: -12000, z0: -12000, x1: 12000, z1: 12000 };
  // WHERE THE WORLD STANDS (SKY S1): the island declares its own geo (28_island.js:
  // the origin's lat/lon, the grid's convergence, the time zone); the analytic
  // world stands at Jolene's latitude with its -z as TRUE north (convergence 0).
  const GEO = (ISL && ISL.geo) || DAY.GEO_DEFAULT;
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
  // W7: 5th octave (65 m) sharpens detail; the warp channels below are
  // deliberately 2-octave — h0 is the physics hot path (per node per
  // substep), full-fbm warp would double it
  const fbm = (x, z) =>
    vnoise(x, z, 1400) * 0.43 + vnoise(x + 91, z + 37, 650) * 0.29 +
    vnoise(x + 7, z + 211, 300) * 0.16 + vnoise(x + 313, z + 97, 140) * 0.08 +
    vnoise(x + 173, z + 419, 65) * 0.04;
  const ridge = (x, z, cell) => 1 - Math.abs(2 * vnoise(x + 555, z + 777, cell) - 1);
  const wnoise = (x, z) =>
    vnoise(x, z, 1400) * 0.65 + vnoise(x + 47, z + 61, 650) * 0.35;

  // THE ISLAND'S GROUND. HOME's strip is CUT into it at the field's own
  // height (the premise: carve, never reproduce) through the same pad ramp
  // the analytic flatten uses; the approach-corridor damping does not apply
  // (the field sits on a flat lobe, and the DEM is the truth).
  // ...unless the island brings its own premises: then its field IS the
  // premises' (G404: Jolene's 13/31 is HOME), no analytic cut at the origin
  const ISL_CUT = ISL && !(opts && opts.premises);
  const PADH = ISL ? ISL.terrainH(-520, 0) : 0;
  const EXACT_GROUND = !!(opts && opts.exactGround);
  // THE SLOPE BOUND the solver's clearance cone stands on (30_solver.js): a
  // Lipschitz constant on terrainH, metres of rise per metre. Measured on the
  // analytic world: 4.46 at the steepest 0.25 m probe of the whole domain,
  // 0.33 in the home corridor; 12 is the bound, and GATE GE re-measures and
  // pins measured <= bound/2. The island's raster and a premises layer
  // declare none yet, so a sim over them samples the ground the old way.
  const SLOPE_MAX = ISL ? undefined : 12;
  function h0(x, z) {
    if (!ISL) return h0a(x, z);
    const h = ISL.terrainH(x, z);
    if (!ISL_CUT) return h;
    const r = padRamp(x, z);
    return r >= 1 ? h : PADH + (h - PADH) * r;
  }
  function h0a(x, z) {
    // THE PAD IS ZERO (2026-09-14, the gate rationalization): every term below
    // is multiplied by sstep(0, 260, distance-to-the-pad-box) at the end, which
    // is exactly 0 inside x in [-1180, 130], |z| <= 90 — so the whole noise
    // stack was computed for a runway that reads 0. Measured +0 at every
    // point of a 1 m grid over the box; GATE GE pins the identity. The island
    // never reaches here (h0 routes it to its raster) and the premises layer
    // composes on top. opts.exactGround keeps the long path for the proof.
    if (!EXACT_GROUND && x >= -1180 && x <= 130 && z >= -90 && z <= 90) return 0;
    // IQ-style domain warp (W7): displace the sampling point by two noise
    // channels before the main field — ridges curve, valleys wind, the
    // value-noise blobbiness dies. ⚙ WARP 320 m; the continental masks
    // get their own gentler warp (bays/headlands on the coast, a winding
    // mountain-belt edge) at ⚙ 700 m.
    const wq1 = wnoise(x + 1309, z + 3557), wq2 = wnoise(x - 911, z + 2129);
    const wx = x + 320 * (wq1 - 0.5), wz = z + 320 * (wq2 - 0.5);
    const n = fbm(wx, wz);
    // 24 km domain (W6): the mountain belt FALLS OFF beyond z~-6500 into
    // northern highlands/plains instead of extending as an endless plateau
    const mzw = z + 700 * (wq2 - 0.5);
    const mount = sstep(700, 3200, -mzw) * (1 - sstep(6500, 10500, -mzw));
    const sea = sstep(500, 2400, z + 700 * (wq1 - 0.5));
    const rid = ridge(wx, wz, 1100) * 0.6 + ridge(wx, wz, 520) * 0.4;
    let hm = (0.55 * (n - 0.3) + 0.65 * (rid - 0.35)) * 620 * mount;
    // W12 stage-5 cliffs: terrace the mountain component into strata
    // where it is high — flat treads + smoothstepped risers (C1 both
    // ends), band planes tilted by a coarse noise so strata dip like
    // real beds. Cheap amplitude gate instead of a slope probe: slope
    // cannot be computed inside the physics hot path. Risers steepen
    // locally and classify ROCK/SCREE through the existing slope rules.
    if (hm > 120) {
      const ST = 22, RW = 0.34;
      const t = (hm + (vnoise(wx + 888, wz + 1444, 700) - 0.5) * 16) / ST;
      const f = Math.floor(t), r = t - f;
      const terr = (f + smf(Math.min(1, Math.max(0, (r - (1 - RW) * 0.5) / RW)))) * ST;
      hm += (terr - hm) * 0.55 * sstep(120, 220, hm);
    }
    let h = (n - 0.35) * 45 + hm - 95 * sea;
    // far-field additions, EXACTLY zero inside the home box + 1.5 km
    // (box covers every validated circuit incl. the DC-3 turnback at
    // x=-5800 and its clearance mountains): long-wave continental relief
    // on land + an archipelago in the far sea. Validated trajectories fly
    // bit-identical base terrain.
    const bdx = Math.max(0, Math.max(-6300 - x, x - 600));
    const bdz = Math.max(0, Math.max(-3300 - z, z - 2600));
    const far = sstep(1500, 4000, Math.hypot(bdx, bdz));
    if (far > 0) {
      const big = vnoise(x + 4013, z + 1717, 5200);
      h += far * (big - 0.5) * 130 * (1 - sea);
      const isl = ridge(wx + 2222, wz + 4444, 2600);
      const islMask = sstep(3800, 5200, z);
      h += far * islMask * Math.max(0, isl - 0.62) * 520;
    }
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
      // G381: the touchdown target sits 20 % of the strip in from the threshold
      // it is landed over (thr1 at x = -1065, + 220 m) — it was at -450, 56 %
      // of the way along, "placed stupid" (the user); 24_world_aero.js puts
      // the other strips on the same rule
      len: 1100, wid: 30, surface: SURFACE.GRASS, elev: 0, tdz: [-845, 0],
      spawn: [0, 0] },   // the def-geometry rest position — W10 spawn identity
    { id: 'M1', name: 'Meadow 1', kind: 'meadow', x: -2200, z: -1500, r: 230,
      hdg: 0, len: 460, wid: 460, surface: SURFACE.GRASS, elev: 0, tdz: [-2200, -1500] },
    { id: 'M2', name: 'Meadow 2', kind: 'meadow', x: 1800, z: 1500, r: 260,
      hdg: 0, len: 520, wid: 520, surface: SURFACE.GRASS, elev: 0, tdz: [1800, 1500] },
    { id: 'M3', name: 'Meadow 3', kind: 'meadow', x: -3400, z: 650, r: 240,
      hdg: 0, len: 480, wid: 480, surface: SURFACE.GRASS, elev: 0, tdz: [-3400, 650] },
    // THE SEA LANE (H4, G393): a water aerodrome south of HOME for the
    // seaplanes — 1.5 km of open sea 15-95 m deep, along +z from the shore
    // (measured: every point of the lane 60 m either side is deeper than
    // 15 m). HOME's own conventions: the spawn identity at the near end
    // facing down the lane (hdg pi/2 -> nose +z), landed over the far end
    // with the touchdown target 20 % in. `kind: 'water'` — no site, no taxi
    // graph; the pilot flies it as it flies a meadow, on the water rudder.
    { id: 'SEA', name: 'The Sound', kind: 'water', x: 0, z: 2000, hdg: Math.PI / 2,
      len: 1500, wid: 200, surface: SURFACE.WATER, elev: 0, tdz: [0, 2530],
      // S1 (G451.1, playtest item 100): the spawn 35 m INSIDE the lane's end
      // (the premises rule) — at [0, 1250] it was the end line itself, where
      // G396.2 moored the centre white buoy, and the seaplane spawned on it
      spawn: [0, 1285] },
  ];
  // the island keeps HOME alone - at the field's height; no meadows, no
  // sea lane (the analytic coordinates mean nothing on it)
  if (ISL) { aerodromes.splice(1); aerodromes[0].elev = PADH; }
  // an island with premises: the analytic HOME record goes the moment the
  // premises declare one (setPremises below); the shim record stays until then
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
  // ...and over the PREMISES' strips (G413): the bake runs before the layer is
  // composed, so the strips are read off the raw record - a river had crossed
  // Jolene's 02/20 the moment the blend gave the island rivers
  const pmStrips = (opts && opts.premises && typeof PREMISES_GEN !== 'undefined')
    ? (((PREMISES_GEN.unwrap(opts.premises).rec || {}).layers || {}).runways || []).filter(r => r.c && r.len > 0)
        .map(r => ({ x: r.c[0], z: r.c[1], ca: Math.cos(r.hdg || 0), sa: Math.sin(r.hdg || 0), hl: r.len / 2 + 150, hw: (r.wid || 30) / 2 + 150 }))
    : [];
  function domes(x, z) {
    let s = DOME * (1 - padRamp(x, z));
    for (const m of meadows) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.r * 1.6) s += DOME * (1 - sstep(0, m.r * 1.6, d));
    }
    for (const r of pmStrips) {
      const dx = x - r.x, dz = z - r.z, u = dx * r.ca + dz * r.sa, v = -dx * r.sa + dz * r.ca;
      const d = Math.hypot(Math.max(0, Math.abs(u) - r.hl), Math.max(0, Math.abs(v) - r.hw));
      if (d < 260) s += DOME * (1 - sstep(0, 260, d));
    }
    return s;
  }
  const HYD = bakeHydrology(
    (x, z) => blendM(x, z, h0(x, z)) + domes(x, z),
    // 24 km domain at 46.9 m cells; A0m2 = physical drainage threshold
    // (river widths/depths are normalized to drainage AREA inside the
    // bake, so the same physical rivers emerge at any grid resolution)
    // the island: the DEM already holds its river beds (no carve to add) and
    // its lakes are the cover's water class (waterAt), not flooded sinks
    { x0: BOUNDS.x0, z0: BOUNDS.z0, x1: BOUNDS.x1, z1: BOUNDS.z1, N: (ISL && ISL.hydro === 'blend') ? 1024 : 512,
      // ...and no rivers either, for now (the user, 2026-09-14: "I hold my
      // judgment on procedural hydrology - maps first, procedural on top")
      // (G405: ?hydro=proc boots the analytic bake's water on the island, to compare with the map's)
      // THE BLEND (G413, the user: "lakes from the data correspond better to the
      // terrain, the procedural generation does the rivers - narrow the rivers"):
      // the map's lakes handed to the bake as its lakes (no flooded sinks of its
      // own), its rivers from 1.2 km2 of drainage (4x the mainland's threshold:
      // the real creeks, not every gully), 0.22 kW and 28 m at most (the
      // mainland's 0.35 / 45), at 1024 cells over the island (its 5 m DEM has
      // the beds; 76 m cells put a ribbon on the bank)
      lakeMin: (ISL && ISL.hydro !== 'proc') ? 1e9 : 1.5,
      A0m2: !ISL || ISL.hydro === 'proc' ? 274650 : ISL.hydro === 'blend' ? 1.2e6 : 1e12,
      kW: (ISL && ISL.hydro === 'blend') ? 0.22 : 0.35, kD: ISL ? 0.12 : 0.4, maxW: (ISL && ISL.hydro === 'blend') ? 28 : 45, dLake: 2,
      lakeOf: (ISL && ISL.hydro === 'blend') ? ISL.lakeAt : null, lakeSurf: !(ISL && ISL.hydro !== 'proc'),
      dpEps: 25, bankFrac: 1.4, qCell: 96, wsAdjust: domes });
  // stage 0+1 terrain: carved + meadow-blended, PRE-road (the settle bake
  // scores sites and derives grading targets on this)
  function tV1(x, z) {
    let h = h0(x, z);
    const r = padRamp(x, z);
    if (r > 0) h += (HYD.carve(x, z, h) - h) * r;
    return blendM(x, z, h);
  }

  // ---- stage 3 settlements & roads (WORLD-GEN-PROC): sites scored on
  // the stage-1 grids, organic road network grown from the home airfield,
  // bridges across water runs, building footprints. Roads add a shallow
  // grading term to terrainH below.
  const SET = ISL
    ? { settlements: [], roads: [], buildings: [], roadNear: () => 1e9, roadDelta: (x, z, h) => h,
        inCore: () => false, stats: { bakeMs: 0 } }
    : bakeSettlements({ grids: HYD.grids, terrain: tV1, water: HYD.water, distW: HYD.distW, meadows, salt: SALT });

  // stage 0-3 terrain: tV1 + road grading, masked off the runway pad
  // (padRamp) and faded inside meadows (same blend weight — meadow
  // centres stay EXACTLY at m.h, the WORLD gate pins that). Stage-4
  // aerodrome grading composes on top in terrainH below.
  let _cd = 0;   // carve depth at the last tV2 call — read by terrainH below
  function tV2(x, z) {
    let h = h0(x, z);
    const r = padRamp(x, z);
    _cd = 0;
    if (r > 0) {
      const hRaw = h;
      h += (HYD.carve(x, z, h) - h) * r;
      const carveDepth = hRaw - h;             // >0 inside river beds / lakes
      _cd = carveDepth;
      h = blendM(x, z, h);
      const g = SET.roadDelta(x, z, h) - h;
      if (g !== 0) {
        let mw = 1;
        for (const m of meadows) {
          const dd = Math.hypot(x - m.x, z - m.z);
          if (dd < m.r) { mw = sstep(m.r * 0.45, m.r, dd); break; }
        }
        // roads must never grade a carved bed back up — beds stay wet,
        // crossings are bridges (the deck spans, terrain keeps the carve)
        h += g * r * mw * (1 - Math.min(1, carveDepth / 1.5));
      }
      return h;
    }
    return blendM(x, z, h);
  }

  // ---- stage 4 aerodromes (WORLD-GEN-PROC): a main field per sizeable
  // town + fly-in backcountry strips, sited on the stage 0-3 terrain;
  // their grading composes into the final terrainH, records join the
  // W.aerodromes registry (still DESCRIPTIVE — AP integration pending).
  const AERO = bakeAerodromes({
    terrain: tV2, water: HYD.water, settlements: SET.settlements,
    meadows, roadNear: SET.roadNear, SURFACE, salt: SALT });
  // the island takes no generated strips (maps first: its field is a premises record)
  if (!ISL) for (const st of AERO.strips) aerodromes.push(st);

  // stage 0-4 terrain: the world as the generator makes it
  function baseH(x, z) {
    // strip grading must never fill a carved river bed (same rule as
    // roads) — fade it out by carve depth, sampled in the tV2 call
    const h = tV2(x, z);
    if (ISL) return h;                     // no generated strip grades an island
    const g = AERO.grade(x, z, h) - h;
    return g !== 0 ? h + g * (1 - Math.min(1, _cd / 1.5)) : h;
  }
  // ---- THE PREMISES (G385, PREMISES-CONTRACT §5, WORLD-V2 §6): the world
  // editor's record composed over THIS world as a layer of typed modifiers -
  // the ground it grades, the surfaces it answers, the trees it keeps out,
  // the strips it adds to the registry with their sites for the pilot. With
  // nothing loaded every hook below is a dead branch and the world is the
  // bare world byte for byte (GATE WORLD's goldens; GATE PREMISES 5b). The
  // layer composes on the stage 0-4 ground, so the strips the generator
  // sites keep their grading under it.
  let PM = null, PMrec = null;
  // the base world's water (what the premises compose against): the hydrology's alone on the analytic
  // world (Skarvik's plots are sown on it - byte for byte); on an island THE SEA TOO (G434.1: the
  // composer read -Infinity over the whole coast, a harbour zone's water level came from a pond up the
  // hill and the harbour never sowed a plot)
  const baseWorld = { id: ISL ? 'ISLAND-' + ISL.id : 'W-24km', terrainH: baseH, waterH: ISL ? ((x, z) => waterAt(baseH(x, z), x, z)) : ((x, z) => HYD.water(x, z)) };
  // coverAt (v1.17): the analytic roads by roadNear's distance (the road's own index), the analytic
  // strips by their box; the premises' answer wins where it has one
  const COV_FADE = 6, COV_BAND = 1.2;
  function coverAt(x, z) {
    if (PM && PM.coverAt) { const c = PM.coverAt(x, z); if (c) return c; }
    let kill = 0, boost = 0, cls = null;
    // the strips: a box test per aerodrome (fourteen at most; the bbox reject first)
    for (const a of aerodromes) {
      if (a.premises || a.kind === 'meadow' || a.kind === 'water') continue;
      const dx = x - a.x, dz = z - a.z; if (Math.abs(dx) + Math.abs(dz) > a.len / 2 + a.wid / 2 + 40) continue;
      const c = Math.cos(a.hdg), s = Math.sin(a.hdg), u = dx * c + dz * s, v = -dx * s + dz * c;
      const du = Math.abs(u) - a.len / 2, dv = Math.abs(v) - a.wid / 2;
      const out = Math.hypot(Math.max(du, 0), Math.max(dv, 0)) + Math.min(Math.max(du, dv), 0);
      const aCls = a.surface === SURFACE.PAVED ? 'asphalt' : a.surface === SURFACE.GRAVEL ? 'gravel' : 'grass';
      const band = aCls === 'asphalt' ? 1.5 : aCls === 'gravel' ? 2.5 : 1.5;
      if (out > band + COV_FADE + 6) continue;
      let k = out <= band ? 1 : Math.max(0, 1 - (out - band) / COV_FADE);
      if (aCls === 'grass') k *= 0.6;                       // a grass strip is the world's grass, mown: thinned, not bare
      const bump = out <= band ? 0 : Math.sin(Math.PI * Math.min(1, (out - band) / (COV_FADE + 6))) * 0.7;
      if (k > kill) kill = k; boost = Math.max(boost, bump); if (!cls || out <= 0) cls = aCls;
    }
    // the roads: the settlement bake's nearest road and its class - a 'road' is 5 m of gravel, a
    // 'track' 3 m of the world's grass with wheel ruts (the pavement's grass class draws only the
    // wear), so a track THINS the cover (0.6) rather than killing it
    if (SET.roadNearCls) {
      const q = SET.roadNearCls(x, z), track = q.cls === 'track', halfW = track ? 1.5 : 2.5, out = q.d - halfW;
      if (out <= COV_BAND + COV_FADE + 6) {
        let k = out <= COV_BAND ? 1 : Math.max(0, 1 - (out - COV_BAND) / COV_FADE);
        if (track) k *= 0.6;
        const bump = out <= COV_BAND ? 0 : Math.sin(Math.PI * Math.min(1, (out - COV_BAND) / (COV_FADE + 6))) * 0.7;
        if (k > kill) kill = k; boost = Math.max(boost, bump); if (out <= 0) cls = track ? 'grass' : 'gravel';
      }
    }
    if (!kill && !boost) return null;
    return { kill, boost: Math.min(1, boost * (1 - kill)), kind: null, cls, grass: null };
  }
  function setPremises(rec0, extra) {
    for (let i = aerodromes.length - 1; i >= 0; i--) if (aerodromes[i].premises) aerodromes.splice(i, 1);
    PM = null; PMrec = null;
    if (typeof terrainClear === 'function') terrainClear();   // the ground moved (G407: the height memo)
    if (!rec0 || typeof PREMISES_GEN === 'undefined') return null;
    const rec = PREMISES_GEN.unwrap(rec0).rec;
    const globals = typeof window !== 'undefined' ? window : {};
    const cat = (opts && opts.catalogue) || PREMISES_GEN.collect(globals);
    PM = PREMISES_GEN.compose(rec, baseWorld, Object.assign({ catalogue: cat, globals }, extra || {}));   // the renderer hands its builder (the cable's phase B) and the tree pool
    PMrec = rec;
    // the strips join the registry as the generator's do; a strip's site (its stand, its way out,
    // an authored pattern) is what siteOf answers the pilot with
    // a premises runway named HOME REPLACES the world's own (an island's field is its premises')
    if (ISL && PM.aerodromes.some(a => a.id === 'HOME')) { const i = aerodromes.findIndex(a => a.id === 'HOME' && !a.premises); if (i >= 0) aerodromes.splice(i, 1); }
    PM.aerodromes.forEach((a, i) => { aerodromes.push(a); if (typeof AIRFIELD_SITES !== 'undefined') { const st = PM.runways[i] && PM.runways[i].site; if (st) AIRFIELD_SITES[a.id] = st; else delete AIRFIELD_SITES[a.id]; } });
    return PM;
  }
  if (opts && opts.premises) setPremises(opts.premises);

  // THE HEIGHT IS MEMOISED (LOADING S2, G407). One ground texel of the
  // colour bake asked for the same (x, z) up to sixteen times - colorAt's
  // own sample, the biome classifier's (once from colorAt, once again from
  // forestHere), each with its slope taps - and the tree walks ask twice per
  // point; measured 2.5 s of the boot in h0a/vnoise. A direct-mapped cache
  // keyed on the EXACT doubles (a hit is the same x and the same z, so the
  // answer is the same bits: every golden holds) folds the repeats. `var`,
  // not const: terrainH is a hoisted declaration called before this line
  // runs, and a const would be in its dead zone. Cleared when the premises
  // change (setPremises), the one thing that moves the ground after make.
  var thX, thZ, thH;
  const TH_N = 16384;
  function terrainClear() { if (thX) thX.fill(NaN); }
  function terrainH(x, z) {
    if (!thX) { thX = new Float64Array(TH_N).fill(NaN); thZ = new Float64Array(TH_N); thH = new Float64Array(TH_N); }
    const i = (Math.imul((x * 4096) | 0, 73856093) ^ Math.imul((z * 4096) | 0, 19349663)) & (TH_N - 1);
    if (thX[i] === x && thZ[i] === z) return thH[i];
    const h0 = baseH(x, z);
    const h = PM ? PM.terrainH(x, z, h0) : h0;
    thX[i] = x; thZ[i] = z; thH[i] = h;
    return h;
  }

  // ---- stage 2 biomes: analytic classifier + tree placement plan ----
  // (waterAt/terrainH are function declarations — hoisted, safe to bind)
  //
  // THE REGISTRY'S DECLARED SURFACE IS READ HERE (G130). Every hand-written
  // aerodrome record carries `surface:` — and until now nothing consumed it:
  // only stage-4 generated strips answered through AERO.surfaceAt, so the
  // forestness field was free to claim the first 158 m of HOME's own takeoff
  // run as FOREST_FLOOR. The moment G121.3 priced that class (CRR 0.10 vs
  // the grass datum's 0.05), every roll off HOME paid double rolling
  // resistance over most of its length — the +4 s unstick the user felt as
  // "struggles to climb inside 90 s". The declaration wins inside the
  // strip's own footprint (strips: the hdg-rotated box with the same kind of
  // margin the pad carve uses; meadows: their radius), and everything
  // outside it still belongs to the classifier.
  const regSurf = (x, z) => {
    for (const a of aerodromes) {
      if (a.surface == null) continue;
      if (a.kind === 'meadow') {
        const dx = x - a.x, dz = z - a.z;
        if (dx * dx + dz * dz <= a.r * a.r) return a.surface;
      } else {
        const c = Math.cos(a.hdg), s = Math.sin(a.hdg);
        const u = (x - a.x) * c + (z - a.z) * s,
              v = -(x - a.x) * s + (z - a.z) * c;
        if (Math.abs(u) <= a.len / 2 + 20 && Math.abs(v) <= a.wid / 2 + 6)
          return a.surface;
      }
    }
    return -1;
  };
  const aeroSurfAll = (x, z) => {
    if (PM) { const s = PM.surfaceAt(x, z); if (s >= 0) return s; }   // a premises surface (an apron, a strip, a road) answers first
    const r = regSurf(x, z);
    return r >= 0 ? r : AERO.surfaceAt(x, z);
  };
  const B = makeBiomes({ terrainH, waterOf: waterAt, distW: HYD.distW, SURFACE, salt: SALT, roadNear: SET.roadNear, aeroSurf: aeroSurfAll });

  // trees: stage-2 biome placement — deterministic jittered 64 m grid,
  // order-independent per point (replaces the v0 sequential LCG loop);
  // density + species from the biome module, clustered by stand noise.
  // v0 exclusions kept verbatim (battery safety): corridor box, meadows
  // 0.8r; the runway pad self-rejects via h<2 (carve-masked flat at 0).
  // Records {x,z,h,s,sp}: h = GROUND height at base, s scale in the v0
  // envelope (solver radius/canopy formulas unchanged), sp = species.
  const trees = [], CELL = 64, grid = new Map();
  {
    const GS = 64, G0x = BOUNDS.x0, G0z = BOUNDS.z0;   // ±12000 m (24 km domain, W6): GN 375
    const GNx = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / GS), GNz = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / GS);
    for (let gz = 0; gz < GNz; gz++) for (let gx = 0; gx < GNx; gx++) {
      const j1 = hash2(gx + 9173, gz - 2417), j2 = hash2(gx - 5807, gz + 7919),
            j3 = hash2(gx + 1229, gz + 4051);
      const x = G0x + (gx + 0.15 + 0.70 * j1) * GS;
      const z = G0z + (gz + 0.15 + 0.70 * j2) * GS;
      const h = terrainH(x, z);
      if (h < 2 || h > B.TREELINE) continue;
      // the island: the collidable woodland stands where the effective class
      // is tree cover, at the canopy's height (the v0 scale envelope)
      let islS = 0;
      if (ISL) {
        if (ISL.effClass(x, z) !== ISL.WC.TREE) continue;
        islS = Math.max(0.65, Math.min(1.75, ISL.canopyAt(x, z) / 16));
      }
      if (Math.abs(z) < 60 && x < 150 && x > -3300) continue;
      let nearMeadow = false;
      for (const m of meadows)
        if (Math.hypot(x - m.x, z - m.z) < m.r * 0.8) { nearMeadow = true; break; }
      if (nearMeadow) continue;
      if (HYD.water(x, z) > h) continue;
      if (SET.roadNear(x, z) < 12) continue;   // clear of roads
      if (SET.inCore(x, z)) continue;          // clear of settlement cores
      if (AERO.inBox(x, z, 30)) continue;      // clear of strips + margin
      if (PM && PM.excludeAt(x, z, 'trees')) continue;   // clear of the premises' excludes: its plots, its strips' boxes, its sites, its clear zones
      const tp = B.treeAt(x, z, h);
      if (!tp || j3 > (ISL ? 0.85 : tp.p)) continue;
      const idx = trees.length;
      trees.push({ x, z, h, s: ISL ? islS : tp.s, sp: tp.sp });
      const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(idx);
    }
  }
  const obstacles = (typeof OBSTACLES !== 'undefined') ? OBSTACLES.make() : null;
  if (obstacles && SET && SET.buildings) {
    // the analytic world's settlement boxes (23_world_settle.js): w along the row, l across it,
    // stood on the ground at their centre; a box shape per size class, shared
    const shapes = new Map();
    for (const b of SET.buildings) {
      const k = b.w.toFixed(1) + 'x' + b.l.toFixed(1) + 'x' + b.hgt.toFixed(1);
      let sh = shapes.get(k); if (!sh) { sh = OBSTACLES.box(b.l, b.w, b.hgt, 1.0); shapes.set(k, sh); }
      obstacles.add({ x: b.x, z: b.z, yaw: b.rot, y0: terrainH(b.x, b.z), shape: sh, tag: 'settle' });
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
    if (ISL) {
      // the island: the sea is the DEM at 0 (sea level does the edges), a
      // lake is the cover's water class over land (the DEM holds it flat)
      if (t <= 0.05) return 0;
      if (ISL.classAt(x, z) === ISL.WC.WATER) return t + 0.3;
      return -Infinity;
    }
    if (t < 0 && blendM(x, z, h0(x, z)) < 0) return 0;
    return -Infinity;
  }
  function waterH(x, z, t) {
    const h = waterAt(terrainH(x, z), x, z);
    // THE SEA HAS WAVES (H4, G393; ruling ap: ONE surface, physics and
    // renderer sampling the same closed form). Only with a time argument,
    // only on the SEA (level 0 — lakes and rivers stay glassy), only when
    // the day has a sea state: the two-argument call is byte-identical to
    // what every gate and every bake reads. Gerstner heights (the design's
    // 3.1: analytic, cheap enough to sample per hull vertex per substep),
    // two octaves — the wind's own swell and a shorter cross chop.
    if (t == null || h !== 0 || !SEA.A) return h;
    let y = 0;
    for (const w of SEA.W) if (w.felt !== false) y += w.A * Math.cos(w.k * (w.dx * x + w.dz * z) - w.om * t + w.ph);
    return y;
  }
  // SEA STATE FROM THE WIND (ruling ar: sea state belongs to THE DAY, one
  // more consumer of setWeather's wind, never a second model). Amplitude
  // 0.018 m per m/s of wind (5 m/s: 0.09 m; 10: 0.18 - see setWind), wavelength 3 + 1.4 W
  // (5 m/s: 10 m), the swell down-wind, a 40 % chop 35 deg off it at half
  // the length. Calm air is glassy — no waves — which is the harder
  // landing (§2.5), for free. `world.sea` reads it; `setSea` overrides it
  // (the bench, a test) until the next setWind.
  // THE SPECTRUM (G460.3, the user: "your waves keep being a clearly visible grid
  // with repetition ... look at the state of the art for that issue"): a sum of
  // a FEW cosines is periodic by construction - one swell cosine lays parallel
  // ridges across the whole sea, and a handful of fixed chop trains weave over
  // it. The classical answer (Tessendorf's summed sinusoids, Crest's batched
  // Gerstner: dozens of components DRAWN FROM THE SPECTRUM) is 32 trains here:
  //   - the SWELL BAND, 8 components at wavelengths 0.78..1.28 L round the
  //     peak, +-9 deg of the wind, JONSWAP-shaped amplitudes; components a
  //     little apart in wavelength BEAT - the sea comes in groups, the ridges
  //     lose their period;
  //   - the WIND SEA, 24 components from L/1.4 to L/7 (geometric), spread
  //     narrowing toward the peak (+-12 deg long, +-55 deg short: Hasselmann)
  //     with a cos^2 weight, equilibrium amplitudes (A_i proportional to L_i)
  //     - short-crested up close, lines with groups from altitude.
  // Each band is normalised to the variance the two old trains carried (the
  // swell A^2/2, the chop (0.4 A)^2/2), so a slider's A means what it meant
  // and the floats feel the same energy. Directions and phases come from a
  // seeded generator: a day is the same day twice. The trains are WORLD DATA
  // (ruling ap): the shader draws these 32 (water.js holds 32; GATE WATER's
  // parity walks them). THE FELT BAND (G460.6): the floats are pushed by the
  // SWELL BAND (the 8 trains round L) and the wind sea (24 trains under L/1.4,
  // spread across the wind) is drawn as a slope only, like the ripple tile:
  // the hydro (G451's held forces and chine air law) water-looped the
  // crosswind take-off when it felt the long wind sea, and rides the swell
  // clean; `felt` marks the band, waterH sums it, the vertex displacement
  // follows waterH exactly (the hull sits in the wave it is drawn in). Cost:
  // waterH 0.9 -> ~1 us a call. setSea({ n: 2 }) gives the old pair.
  const SEA = { A: 0, L: 0, dir: 0, W: [] };
  const SEA_TRAINS = 32;
  // THE FELT BAND'S EDGE: the swell band (0.78..1.28 L) is felt, the wind sea (under L/1.4) is drawn
  // as a slope only. Bisected on GATE SEAPLANE's crosswind take-off (2026-09-21): the hull looping
  // on the long wind sea (5-9 m, spread across the wind) at 0.45 L, clean at 0.75 L. SEA_FELT=<f>
  // in the environment moves it for a test.
  const SEA_FELT = (typeof process !== 'undefined' && process.env && process.env.SEA_FELT) ? +process.env.SEA_FELT : 0.75;
  function seaFrom(A, L, dir, n) {
    SEA.A = A; SEA.L = L; SEA.dir = dir; SEA.W.length = 0;
    if (!(A > 0) || !(L > 0)) return;
    const N = Math.max(2, Math.min(SEA_TRAINS, n || SEA_TRAINS));
    const rows = [];
    if (N === 2) { rows.push([A, L, dir, 0], [0.4 * A, 0.5 * L, dir + 35 * Math.PI / 180, 1.7]); }
    else {
      let seed = 0x5EA5; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const D2R = Math.PI / 180;
      const nS = Math.max(1, Math.round(N / 4)), nW = N - nS;
      // the swell band: JONSWAP-shaped weights round L, normalised to A^2/2
      const sw = [];
      for (let i = 0; i < nS; i++) { const r = 0.78 + 0.5 * (nS === 1 ? 0.44 : i / (nS - 1)) + (rnd() - 0.5) * 0.04; const w = Math.exp(-Math.pow((r - 1) / 0.18, 2));
        sw.push({ l: L * r, w, d: dir + (rnd() - 0.5) * 18 * D2R, ph: rnd() * 2 * Math.PI }); }   // +-9 deg: a swell is long-crested (Hasselmann s ~ 10 at the peak)
      const cS = A / Math.sqrt(sw.reduce((q, t) => q + t.w * t.w, 0));
      for (const t of sw) rows.push([cS * t.w, t.l, t.d, t.ph]);
      // the wind sea: geometric wavelengths L/1.4 .. L/7, cos^2 spread, equilibrium amplitudes, normalised to (0.4 A)^2/2
      const ws = [];
      // the spread NARROWS toward the peak (Hasselmann): a long wind-sea component runs with the wind
      // (+-12 deg at L/1.4), the short chop spreads wide (+-55 deg at L/7) - from altitude the sea is
      // lines with groups, not a weave; up close the chop is short-crested
      for (let i = 0; i < nW; i++) { const u = nW === 1 ? 0 : i / (nW - 1), f = 1.4 * Math.pow(5, u); const th = (rnd() - 0.5) * (24 + 86 * u) * D2R;
        ws.push({ l: L / f * (0.94 + 0.12 * rnd()), w: (L / f / L) * Math.pow(Math.cos(th), 2), d: dir + th, ph: rnd() * 2 * Math.PI }); }
      const cW = 0.4 * A / Math.sqrt(ws.reduce((q, t) => q + t.w * t.w, 0));
      for (const t of ws) rows.push([cW * t.w, t.l, t.d, t.ph]);
    }
    for (const [a, l, d, ph] of rows) {
      const k = 2 * Math.PI / l;
      SEA.W.push({ A: a, k, om: Math.sqrt(9.81 * k), dx: Math.cos(d), dz: Math.sin(d), ph, felt: N === 2 || l >= SEA_FELT * L });   // the old pair is felt whole
    }
  }
  function setSea(spec) {
    if (!spec) { seaFrom(0, 0, 0); return; }
    seaFrom(spec.A || 0, spec.L || (3 + 1.4 * 5), spec.dir || 0, spec.n);
  }
  // surface: stage-2 biome classifier (WATER/SAND/ROCK/SCREE/FOREST_FLOOR/
  // GRASS from altitude+slope+moisture+distance-to-water; PAVED/GRAVEL
  // still reserved for stage 4)
  // THE ISLAND'S CLASSIFIER: the registry and the premises answer first (a
  // strip, an apron), then the sea, then the cover's effective class - tree
  // cover is the forest floor, the built-up class (the WWII cross, the town's
  // lots) is paved, bare ground is rock on a slope and scree below it, water
  // is a lake, everything green and short is grass (the muskeg included).
  const islandSurface = (x, z) => {
    const a = aeroSurfAll(x, z); if (a >= 0) return a;
    const h = terrainH(x, z);
    if (h <= 0.05) return SURFACE.WATER;
    const c = ISL.effClass(x, z);
    if (c === ISL.WC.WATER) return SURFACE.WATER;
    if (c === ISL.WC.TREE) return SURFACE.FOREST_FLOOR;
    if (c === ISL.WC.BUILT || c === ISL.WC.CROP) return SURFACE.PAVED;
    if (c === ISL.WC.BARE || c === ISL.WC.SNOW) {
      const d = 8, g = Math.hypot(terrainH(x + d, z) - terrainH(x - d, z), terrainH(x, z + d) - terrainH(x, z - d)) / (2 * d);
      return g > 0.7 ? SURFACE.ROCK : SURFACE.SCREE;
    }
    return SURFACE.GRASS;
  };
  const surface = ISL ? islandSurface : B.surface;

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
      const bucketPoly = (obj, list) => {
        const keys = new Set();
        for (let i = 0; i + 1 < obj.pts.length; i++) {
          const tx0 = Math.floor(Math.min(obj.pts[i][0], obj.pts[i + 1][0]) / TILE);
          const tx1 = Math.floor(Math.max(obj.pts[i][0], obj.pts[i + 1][0]) / TILE);
          const tz0 = Math.floor(Math.min(obj.pts[i][1], obj.pts[i + 1][1]) / TILE);
          const tz1 = Math.floor(Math.max(obj.pts[i][1], obj.pts[i + 1][1]) / TILE);
          for (let a = tx0; a <= tx1; a++) for (let b = tz0; b <= tz1; b++) keys.add(a + ',' + b);
        }
        for (const key of keys) rec0(key)[list].push(obj);
      };
      for (const r of HYD.rivers) bucketPoly(r, 'rivers');
      for (const r of SET.roads) bucketPoly(r, 'roads');
      for (const b of SET.buildings) rec0(Math.floor(b.x / TILE) + ',' + Math.floor(b.z / TILE)).buildings.push(b);
    }
    const key = ix + ',' + iz;
    let rec = tileIndex.get(key);
    if (!rec) tileIndex.set(key, rec = { trees: [], rivers: [], roads: [], buildings: [] });
    return rec;
  }

  // ---- THE WIND: the climate's (09_climate.js, K0 2026-09-22) -------------
  // The field the fleet was calibrated in (G72: base x power-law shear + the
  // four gust sines, the exact zero W0 when nothing is set) moved there
  // VERBATIM and is the whole field whenever the spec names no rich term; the
  // terrain-following flow, the breeze, the thermals and the winds aloft are
  // its rich terms. The day is made first: the climate's slow terms read it.
  const day = DAY.makeDay((opts && opts.day) || null, GEO);
  const climate = CLIMATE.make({
    terrainH, surface, SURFACE, bounds: BOUNDS, day, geo: GEO, seed: SEED,
    typeAt: ISL && ISL.ttype ? (x, z) => { const k = ISL.cellAt(x, z); return k < 0 ? -1 : ISL.ttype[k]; } : null,
    coastAt: ISL ? ISL.coastAt : null,
  });
  const wind = climate.wind;
  function setWind(spec) {
    const r = climate.setWind(spec);
    // ...and the sea follows the wind (H4, G393)
    const b = r.base;
    const Wv = Math.hypot(b[0], b[2]);
    // THE WIND -> SEA LAW (G460.6): 0.018 m of amplitude per m/s, calibrated to the SMB fetch-limited
    // sea of a 10 km sound (H_s 0.26 m at 5 m/s, 0.5 at 10; A_equiv = H_s / 2.8) - G393's 0.04 was a
    // guess that put a 0.57 m significant sea under a 5 m/s breeze, and with a real spectrum (groups
    // twice the single amplitude) the crosswind take-off of GATE SEAPLANE water-looped in it
    seaFrom(Wv > 0.5 ? 0.018 * Wv : 0, 3 + 1.4 * Wv, Math.atan2(b[2], b[0]));
  }

  // ---- the day: ONE weather state, air and wind together (G72) ------------
  // setWeather({ oatC, qnhPa, wind: { base, gust } }) — everything a day is.
  // They are one object rather than two setters because a hot gusty afternoon
  // is ONE thing a player picks, and because the solver has to be able to ask
  // "what is the air here" without knowing which preset put it there.
  //
  // `atmos` is read through a GETTER on the returned world so the sim sees a
  // change live, exactly as it already does for wind — no reset, mid-flight.
  // Absent weather is the standard day and the zero wind vector, so every
  // existing gate is untouched by the mere existence of this.
  //
  // THE DAY (SKY S1, 2026-09-14) extends this rather than standing beside it:
  // `day` (07_day.js) holds WHEN and WHERE and WATER and AEROSOL as well as
  // the air, and `atmos` is rebuilt ONLY when an air field moved — the same
  // object otherwise, so a consumer holding it (and GATE DAY) can tell. The
  // clock advances through day.advance(), which only the viewer calls.
  let weather = null;
  let atmos = ATMOS_ISA;
  function setDay(spec) {
    const airChanged = day.set(spec);
    if (airChanged) atmos = day.hasAir ? makeAtmos(day.air()) : ATMOS_ISA;
    if (spec && 'wind' in spec) setWind(spec.wind || null);
  }
  // setWeather({ oatC, qnhPa, wind }) — the AIR + WIND subset, as it always was:
  // absent fields are CLEARED (the standard day, the zero wind), so the
  // CONDITIONS presets and every gate read exactly what they read before.
  function setWeather(spec) {
    weather = spec || null;
    const p = { wind: spec ? (spec.wind || null) : null };
    for (const k of ['oatC', 'dISA', 'qnhPa', 'dewC', 'rh']) p[k] = spec && spec[k] != null ? spec[k] : null;   // the AIR, and the WATER when a preset names it
    setDay(p);
  }

  // P1.A (PILOT-ROADMAP §3.2): THE CANOPY — the top of the vegetation over
  // (x, z): the tallest tree within `r` (40 m by default) of the point, at
  // 16 m per unit of its placed scale — a stand-in for the packs' own
  // heights (13-20 m at size 1, trees_pack.js; the viewer draws the pack,
  // not `s`) until the placement publishes them. 0 in the clear. The
  // runway model's obstacle cone reads it (25_airfield.js); the viewer's
  // canopy map is a different thing (a shadow).
  const _cnr = [];
  function canopyH(x, z, r) {
    r = r || 40;
    treesNear(x, z, _cnr);
    let top = 0;
    for (const i of _cnr) {
      const t = trees[i], d2 = (t.x - x) * (t.x - x) + (t.z - z) * (t.z - z);
      if (d2 <= r * r) top = Math.max(top, 16 * t.s);
    }
    return top;
  }
  return {
    // ---- v1 contract (futureDesigns/WORLD-CONTRACT.md) ----
    v: 1, seed: SEED,
    bounds: BOUNDS,
    island: ISL ? { id: ISL.id, canopyAt: ISL.canopyAt, effClass: ISL.effClass, classAt: ISL.classAt, coastAt: ISL.coastAt, seaFloor: ISL.seaFloor,
                    WC: ISL.WC, hMax: ISL.hMax, grid: ISL.grid, albedo: ISL.albedo,
                    tint: ISL.tint, ori1: ISL.ori1, coast: ISL.coastU8 || null, canopy: ISL.canopyU8 || null, canopyP90: ISL.canopyP90,
                    cover: ISL.coverU8 || null, ndvi: ISL.ndvi || null, lake: ISL.lake || null, ttype: ISL.ttype || null, lakes: ISL.lakes || null, hydro: ISL.hydro, cellAt: ISL.cellAt,
                    farHeader: ISL.farHeader, farRoot: ISL.farRoot } : null,
    terrainH, waterH, surface, SURFACE,
    get slopeMax() { return PM ? undefined : SLOPE_MAX; },   // the cone's bound (30_solver.js); none under a premises layer
    TILE, tile, aerodromes, settlements: SET.settlements,
    treesNear, canopyH,
    // THE OBSTACLES (G433): the registry of solid things the solver pushes out of (29_obstacles.js) -
    // the settlements' own buildings stand in it from the start as plain boxes; the viewer adds what
    // it stands (houses, props, cars, parked aeroplanes) and moves the traffic
    obstacles,
    // informative stage-3 block (not contract surface): road/building
    // records and queries for gates, renderer and debug.
    // inCore / settlements published 2026-09-22: what stands beside a road (the guardrail) asks
    // whether a point is inside a settlement's core - the user's "nothing but forest"
    roadNet: { roads: SET.roads, buildings: SET.buildings, roadNear: SET.roadNear, inCore: SET.inCore, settlements: SET.settlements, bakeMs: SET.stats.bakeMs },
    // informative stage-1 block (not contract surface): gates/debug read
    // reach records and bake stats here without walking every tile.
    hydro: { rivers: HYD.rivers, lakeCount: HYD.lakeCount, lakeCells: HYD.lakeCells, bakeMs: HYD.stats.bakeMs, water: HYD.water, lakeSurf: HYD.lakeSurf, cellW: HYD.stats.cellW, distW: HYD.distW },
    // ---- the day (G72): the air is a getter so it is read LIVE ----
    get atmos() { return atmos; },
    get weather() { return weather; },
    setWeather,
    // ---- THE DAY (SKY S1): the whole day, read live; the sun in its sky ----
    day, setDay, geo: GEO,
    // H4 (G393): the sea state (read live) and its override
    get sea() { return SEA; }, setSea,
    // ---- v0 shim: same live objects, byte-identical values ----
    trees, meadows, CELL, wind, setWind,
    // ---- THE CLIMATE (K0): the field's keeper — sample(), the relief raster, the stats
    climate,
    // ---- THE PREMISES (G385): the layer, its record, and the setter that recomposes it live
    // (terrainH and the surface read PM at call time; the trees were placed once, at the make)
    premises: { get overlay() { return PM; }, get rec() { return PMrec; }, set: setPremises, base: baseWorld },
    // THE COVER'S QUERY (contract v1.17, 2026-09-22): what the cover ring may plant at a world point -
    // null (the biome's own) or { kill, boost, kind, cls, grass }: the premises' answer where it has
    // one (its strips, roads, aprons, plots - 27_premises.js coverAt), else the analytic world's
    // own roads (a 'road' 5 m of gravel, a 'track' 3 m of worn grass, band 1.2) and its strips (by
    // their surface class). The viewer adds `col`, the drawn ground's colour (render_world.js).
    coverAt,
  };
}
