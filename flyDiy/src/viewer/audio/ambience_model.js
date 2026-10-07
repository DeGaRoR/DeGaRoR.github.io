// ============================================================
// THE AMBIENCE'S NUMBERS (G1650, SND-AMB-1; SOUND-2026-10-04 §6 / §2.4 / §9).
// PURE: no Web Audio, no DOM - runs in node; GATE AUDIO (AMB*) and the evidence
// (tools/audio/ambience_render.js) drive it on the real Jolene.
//
// What the world around the LISTENER (the camera: P.s[I.listenerX/Y/Z]) sounds
// like, as one TARGET WEIGHT per recorded bed (BEDS, the 19 beds G1636 ships),
// then SMOOTHED (seconds) into the weights the source plays.
//
//   THE PROBE    the world is read ONE ITEM A FRAME, a round of AM_PHASES items
//                every ~AM_ROUND_S (a frame does more items when frames are long,
//                so the round holds its time at any rate): the ground and the
//                water under the listener (AGL), the cover in two rings (WorldCover
//                + the canopy's reclass, read straight off the island's rasters),
//                the coast's signed field (surf vs rocks: the shore point's
//                GROUND_SURF row, else its slope), the lake's signed field, the
//                rivers (world.hydro.distW - the nearest water when no lake is
//                nearer), the premises zones (harbour / residential / commercial /
//                park, world coordinates through the record's frame) and the
//                analytic world's settlements, the aerodromes' fences (the runway's
//                box + a margin), the climate wind AT the listener
//                (world.climate.sample: never the solver's cache), the sun (DAY_CLOCK
//                walks world.day), the day's front. Spreading it makes every line
//                here run every frame - optimised, so no double is boxed (a function
//                called twice a second runs in V8's lower tiers, where every double
//                is a fresh heap box - G1672's finding).
//   THE TARGETS  at the round's end (AM_RULES below, one line a bed); the beds fade
//                with the height above the ground (silent above ~150 m, the winds
//                excepted); the garage plays the hangar (+ the roof's rain when it
//                rains) and a hint of the outside through the door; under water only
//                the rocks' bed (the user: "also fine as the underwater bed").
//   SMOOTHING    w += (target - w)(1 - e^(-dt/AM_TAU)), the step clamped to
//                AM_RATE per second: no bed ever jumps (GATE AUDIO AMBSMOOTH).
//   LEVELS       each bed's mix level (dB) + its catalogue trim to -23 LUFS (the
//                catalogue's `lufs`, mirrored in BEDS; GATE AUDIO holds them equal).
//
// ambienceState() -> st;  ambienceStep(st, P, world, dt) -> 1 when a round ended
// (st.t the targets, st.w the smoothed weights, st.f the features), else 0.
// ambienceTargets(st) recomputes st.t from st.f (the gate's canned places);
// gainOf(st, b) = st.w[b] x st.lv[b]. Allocation-free per frame (GATE AUDIO AMBALLOC);
// a new world (or a new premises record) re-reads its zones once (allocates, rare).
// ============================================================
var AMBIENCE_MODEL = (function () {
  'use strict';
  const AM_ROUND_S = 0.5;          // a round of the probe (the brief: every ~0.5 s, not every frame)
  const AM_TAU = 2.0;              // the weights' smoothing (s)
  const AM_RATE = 0.35;            // the most a weight moves in a second
  const AM_FLOOR = 0.012;          // a bed under this gain (linear, level included) is silent: not fetched, released
  const AM_LUFS = -23;             // the beds' target loudness (prep_sfx.js)
  const GARAGE_K = Math.pow(10, -12 / 20);   // the shed's beds, all of them (see THE GARAGE below)
  // THE BEDS: [key, the mix level dB, the catalogue's integrated LUFS (sfx_catalogue.json), group (0 outside, 1 room)]
  const BEDS = [
    ['amb.forest.day', -5, -25.4, 0], ['amb.forest.night', -6, -23, 0], ['amb.meadow', -8, -23, 0],
    ['amb.wind.light', -11, -23, 0], ['amb.wind.clear', -9, -23, 0], ['amb.wind.mountain', -9, -23, 0], ['amb.wind.storm', -5, -23, 0],
    ['amb.shore.surf', -4, -23, 0], ['amb.shore.rocks', -5, -28.4, 0],
    // the user: amb.lake.near "only very close to the water"; its file is quiet (-34.4: the peak cap) - trimmed, then low
    ['amb.lake.near', -10, -34.4, 0], ['amb.lake.lap', -8, -23, 0], ['amb.stream', -6, -23, 0],
    ['amb.harbour', -7, -23, 0], ['amb.village', -8, -23, 0], ['amb.airfield', -10, -23, 0],
    ['amb.hangar', -6, -23, 1], ['amb.rain.roof', -8, -23.4, 1],
    ['amb.frogs.night', -11, -23, 0],
    // the coordinator's three gap fills for SND-AMB-1's list (2026-10-04, CC0, unheard by the user): rain outside, birds over
    // open ground by day, and a lake shore recorded louder than amb.lake.near (which stays, lower, as texture)
    ['amb.rain.outside', -8, -23, 0], ['amb.birds.open', -10, -23, 0], ['amb.lake.shore', -8, -29.7, 0],
    // the open sea, past the surf (the user: "keep looking for an open sea option"): water along a hull underway
    ['amb.sea.open', -8, -23, 0],
    // the user: amb.loons "not too loud, really background"
    ['amb.loons', -17, -23, 0],
  ];
  const NB = BEDS.length;
  const B = {}; BEDS.forEach((b, i) => { B[b[0].slice(4).replace(/\.(\w)/g, (m, c) => c.toUpperCase())] = i; });
  // B.forestDay, B.forestNight, B.meadow, B.windLight, B.windClear, B.windMountain, B.windStorm, B.shoreSurf,
  // B.shoreRocks, B.lakeNear, B.lakeLap, B.stream, B.harbour, B.village, B.airfield, B.hangar, B.rainRoof,
  // B.frogsNight, B.loons, B.rainOutside, B.birdsOpen, B.lakeShore, B.seaOpen

  // THE FEATURES (st.f)
  const FN = ['x', 'y', 'z', 'agl', 'elev', 'under', 'tree', 'shrub', 'grass', 'built', 'bare', 'water', 'wet',
              'coast', 'rocky', 'lake', 'stream', 'village', 'harbour', 'aero', 'wind', 'sun', 'storm', 'rain',
              'garage', 'interior', 'open',
              // the wind the wind beds hear: under a canopy, near the ground, the trees take most of it (they rustle instead)
              'windB'];
  const F = {}; FN.forEach((k, i) => { F[k] = i; });
  const NF = FN.length;
  const FAR = 1e4;                 // "none near" for the signed / distance features
  // the cover accumulator (st.acc): tree shrub grass built bare water wet, the weight total
  const AC_N = 8;
  // THE ROUND: 0 the ground, 1..16 the rings, 17 the coast, 18 the shore's kind, 19 the lake and the rivers,
  // 20 the zones, 21 the aerodromes and settlements, 22 the wind, 23 the sky
  const AM_PHASES = 24;
  const RING = new Float64Array(32);   // 16 unit directions, (cos, sin), the second ring turned half a step
  for (let j = 0; j < 16; j++) { const a = (j < 8 ? j : j - 8 + 0.5) * Math.PI / 4; RING[2 * j] = Math.cos(a); RING[2 * j + 1] = Math.sin(a); }
  // WorldCover codes (28_island.js WC) and GROUND_SURF rows (00_registry.js)
  const WC_TREE = 10, WC_SHRUB = 20, WC_GRASS = 30, WC_CROP = 40, WC_BUILT = 50, WC_BARE = 60, WC_SNOW = 70, WC_WATER = 80, WC_WET = 90, WC_MOSS = 100;
  const S_GRASS = 0, S_ROCK = 1, S_SCREE = 2, S_FOREST = 3, S_WATER = 4, S_PAVED = 5, S_GRAVEL = 6, S_SAND = 7;
  const RECLASS = 2.5;             // the island's tree cover under 2.5 m of canopy is shrubland (28_island.js effClass)
  // the zone kinds that sound: residential / commercial / park / industrial -> the village, harbour -> the harbour
  const ZK = { residential: 1, commercial: 1, park: 1, industrial: 1, harbour: 2 };
  const Z_FALL = [0, 120, 180];    // metres outside a zone over which its bed fades
  // an aerodrome's fence, standing in: the runway's box + 200 m along, + max(120 m, 12 % of its length) across (the apron,
  // the stands: HOME's stand is 274 m off its centreline); a water lane has none (the dock is the harbour's)
  const AERO_MARGIN_L = 200, AERO_MARGIN_W = 120, AERO_MARGIN_WK = 0.12, AERO_FALL = 200;

  const sat = x => (x < 0 ? 0 : x > 1 ? 1 : x);

  function ambienceState() {
    const lv = new Float64Array(NB);
    for (let b = 0; b < NB; b++) lv[b] = Math.pow(10, (BEDS[b][1] + (AM_LUFS - BEDS[b][2])) / 20);
    const st = {
      f: new Float64Array(NF), t: new Float32Array(NB), w: new Float32Array(NB), lv,
      acc: new Float64Array(AC_N),
      // clk: [0] seconds since the last round ended, [1] the phase, [2] the probe's own clock (s, the wind's t),
      //      [3] rounds ended, [4] the ring's inner radius, [5] the outer, [6] the shore's inland nx, [7] nz,
      //      [8] the shore point x, [9] z, [10] the shore's distance (m, + inland), [11] the rain hook (0..1, -1 none)
      clk: new Float64Array(12),
      wnd: new Float64Array(3), tmp: new Float64Array(8), rv: new Float64Array(NR),
      // the world, read once per world / premises record: rasters, zones (world coordinates), aerodromes
      wref: null, prem: null, isl: null, zk: null, zb: null, zp: null, ad: null, sett: null,
    };
    st.clk[11] = -1;
    st.f[F.coast] = FAR; st.f[F.lake] = -FAR; st.f[F.stream] = FAR;
    return st;
  }

  // ---- THE WORLD, once per world: the island's rasters, the zones in world coordinates, the fences -----------------
  function prepWorld(st, world) {
    st.wref = world;
    const I = world && world.island;
    st.isl = I && I.grid && I.cover ? I : null;
    prepZones(st, world);
    const A = ((world && Array.isArray(world.aerodromes)) ? world.aerodromes : []).filter(a => a.kind !== 'water');
    st.ad = new Float64Array(A.length * 5);
    A.forEach((a, i) => { const len = +a.len || 600;
                          st.ad[i * 5] = +a.x || 0; st.ad[i * 5 + 1] = +a.z || 0; st.ad[i * 5 + 2] = +a.hdg || 0;
                          st.ad[i * 5 + 3] = len / 2 + AERO_MARGIN_L; st.ad[i * 5 + 4] = (+a.wid || 30) / 2 + Math.max(AERO_MARGIN_W, AERO_MARGIN_WK * len); });
    const S = (world && Array.isArray(world.settlements)) ? world.settlements : [];
    st.sett = new Float64Array(S.length * 3);
    S.forEach((s, i) => { st.sett[i * 3] = +s.x || 0; st.sett[i * 3 + 1] = +s.z || 0; st.sett[i * 3 + 2] = +s.r || 80; });
  }
  function prepZones(st, world) {
    const pm = world && world.premises, rec = pm ? pm.rec : null, ov = pm ? pm.overlay : null;
    st.prem = rec || null;
    const Z = rec && rec.layers && Array.isArray(rec.layers.zones) ? rec.layers.zones : [];
    const F0 = ov && ov.frame && typeof ov.frame.toWorld === 'function' ? ov.frame : null;
    const keep = Z.filter(z => ZK[z.kind] && Array.isArray(z.poly) && z.poly.length >= 3);
    st.zk = new Int8Array(keep.length); st.zb = new Float64Array(keep.length * 4); st.zp = [];
    keep.forEach((z, i) => {
      const p = new Float64Array(z.poly.length * 2);
      let x0 = 1e18, z0 = 1e18, x1 = -1e18, z1 = -1e18;
      z.poly.forEach((q, k) => {
        const w = F0 ? F0.toWorld(+q[0], +q[1]) : q;
        p[2 * k] = +w[0]; p[2 * k + 1] = +w[1];
        x0 = Math.min(x0, p[2 * k]); x1 = Math.max(x1, p[2 * k]); z0 = Math.min(z0, p[2 * k + 1]); z1 = Math.max(z1, p[2 * k + 1]);
      });
      st.zk[i] = ZK[z.kind]; st.zb[4 * i] = x0; st.zb[4 * i + 1] = z0; st.zb[4 * i + 2] = x1; st.zb[4 * i + 3] = z1;
      st.zp.push(p);
    });
  }

  // THE HELPERS take WHOLE METRES (a small integer is a Smi; a double argument to a call that TurboFan did not inline is
  // a fresh heap box) and answer a Smi, or into a typed slot (the same reason for a double result)
  // a signed u8 field (128 = 0, 4 m a unit: the coast + inland, the lake + inside), bilinear, at (x, z) -> out[k]
  function u8Signed(A, G, x, z, out, k) {
    const W = G.w, H = G.h;
    let u = (x - G.x0) / G.cell - 0.5, v = (z - G.z0) / G.cell - 0.5;
    u = u < 0 ? 0 : u > W - 1.001 ? W - 1.001 : u; v = v < 0 ? 0 : v > H - 1.001 ? H - 1.001 : v;
    const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, p = j * W + i;
    out[k] = ((A[p] * (1 - fu) + A[p + 1] * fu) * (1 - fv) + (A[p + W] * (1 - fu) + A[p + W + 1] * fu) * fv - 128) * 4;
  }
  // the island's effective class at (x, z): WorldCover, tree cover under RECLASS m of canopy -> shrub; off-grid = water
  function classIsl(I, x, z) {
    const G = I.grid, i = Math.floor((x - G.x0) / G.cell), j = Math.floor((z - G.z0) / G.cell);
    if (i < 0 || j < 0 || i >= G.w || j >= G.h) return WC_WATER;
    const k = j * G.w + i, c = I.cover[k];
    return c === WC_TREE && I.canopy && I.canopy[k] < RECLASS ? WC_SHRUB : c;
  }
  // the analytic world's stand-in: the GROUND_SURF row as a cover class
  function classSurf(world, x, z) {
    if (!world || typeof world.surface !== 'function') return WC_GRASS;
    const s = world.surface(x, z);
    return s === S_FOREST ? WC_TREE : s === S_WATER ? WC_WATER : s === S_GRASS ? WC_GRASS : s === S_PAVED ? WC_BUILT : WC_BARE;
  }
  function addCover(acc, c, wt) {   // wt: 4 the listener's cell, 2 the inner ring, 1 the outer (integers: see above)
    if (c === WC_TREE) acc[0] += wt; else if (c === WC_SHRUB) acc[1] += wt;
    else if (c === WC_GRASS || c === WC_CROP || c === WC_MOSS) acc[2] += wt; else if (c === WC_BUILT) acc[3] += wt;
    else if (c === WC_BARE || c === WC_SNOW) acc[4] += wt; else if (c === WC_WATER) acc[5] += wt; else if (c === WC_WET) acc[6] += wt;
    acc[7] += wt;
  }
  // the distance from (x, z) to a polygon (flat Float64Array of x, z): 0 inside -> out[k]
  function polyDist(p, x, z, out, k) {
    const n = p.length >> 1;
    let inside = false, d2 = 1e18;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = p[2 * j], az = p[2 * j + 1], bx = p[2 * i], bz = p[2 * i + 1];
      if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) inside = !inside;
      const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz;
      let t = L2 > 0 ? ((x - ax) * vx + (z - az) * vz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - ax - t * vx, ez = z - az - t * vz, e2 = ex * ex + ez * ez;
      if (e2 < d2) d2 = e2;
    }
    out[k] = inside ? 0 : Math.sqrt(d2);
  }

  // ---- THE FRAME --------------------------------------------------------------------------------------------------
  // P: the parameter block (audio_params.js: P.s, P.I); world: the composed world (AUDIO.world); dt: seconds.
  function ambienceStep(st, P, world, dt) {
    const s = P.s, I = P.I, f = st.f, clk = st.clk, acc = st.acc;
    const d = dt > 0 && dt < 1 ? dt : 0;
    clk[0] += d; clk[2] += d;
    f[F.x] = s[I.listenerX]; f[F.y] = s[I.listenerY]; f[F.z] = s[I.listenerZ];
    f[F.garage] = s[I.inGarage]; f[F.interior] = s[I.interior]; f[F.open] = s[I.open];
    if (world !== st.wref) { prepWorld(st, world); clk[1] = 0; acc.fill(0); }
    // the items this frame: the round in ~0.4 s at any frame rate, at least one a frame
    let n = Math.ceil(d * AM_PHASES / (0.8 * AM_ROUND_S)); if (n < 1) n = 1;
    const x = f[F.x], y = f[F.y], z = f[F.z], Isl = st.isl;
    const garage = f[F.garage] > 0;
    for (let k = 0; k < n && clk[1] < AM_PHASES; k++) {
      const ph = clk[1]; clk[1] = ph + 1;
      if (ph === 0) {
        // THE GROUND: the higher of the terrain and the water under the listener; the cover at the listener (x2)
        acc.fill(0);
        if (garage || !world) { f[F.agl] = 1.7; f[F.under] = 0; continue; }
        const xi = x | 0, zi = z | 0;
        let g = typeof world.terrainH === 'function' ? +world.terrainH(xi, zi) : 0;
        if (!(g === g)) g = 0;
        let wv = typeof world.waterH === 'function' ? +world.waterH(xi, zi) : -1e9;
        if (!(wv === wv) || wv < -1e8) wv = -1e9;
        const top = wv > g ? wv : g;
        f[F.elev] = g; f[F.agl] = y - top; f[F.under] = wv > g && y < wv - 0.3 ? 1 : 0;
        const r = f[F.agl] > 0 ? f[F.agl] : 0;
        clk[4] = 35 + 0.4 * (r < 400 ? r : 400); clk[5] = 110 + 0.6 * (r < 400 ? r : 400);
        addCover(acc, Isl ? classIsl(Isl, xi, zi) : classSurf(world, xi, zi), 4);
      } else if (ph <= 16) {
        // THE RINGS: 8 points at the inner radius (weight 1), 8 at the outer (0.5), turned half a step
        if (garage || !world) continue;
        const j = ph - 1, r = j < 8 ? clk[4] : clk[5];
        const px = (x + r * RING[2 * j]) | 0, pz = (z + r * RING[2 * j + 1]) | 0;
        addCover(acc, Isl ? classIsl(Isl, px, pz) : classSurf(world, px, pz), j < 8 ? 2 : 1);
      } else if (ph === 17) {
        // THE COAST: the signed distance (+ inland) and its gradient -> the shore point and the inland normal
        clk[10] = FAR;
        if (garage || !Isl || !Isl.coast) continue;
        const A = Isl.coast, G = Isl.grid, tm = st.tmp, xi = x | 0, zi = z | 0;
        // the listener's cell and its four neighbours 10 m away (one call site: one inlining)
        for (let q = 0; q < 5; q++) u8Signed(A, G, xi + (q === 1 ? 10 : q === 2 ? -10 : 0), zi + (q === 3 ? 10 : q === 4 ? -10 : 0), tm, q);
        const c0 = tm[0];
        clk[10] = c0;
        if (c0 > 500 || c0 < -500) continue;   // the field saturates at 508 m: no shore near
        let gx = tm[1] - tm[2], gz = tm[3] - tm[4];
        const gl = Math.sqrt(gx * gx + gz * gz);
        if (gl < 1e-6) { gx = 1; gz = 0; } else { gx /= gl; gz /= gl; }
        clk[6] = gx; clk[7] = gz; clk[8] = x - gx * c0; clk[9] = z - gz * c0;
      } else if (ph === 18) {
        // THE SHORE'S KIND: its GROUND_SURF row (rock / scree -> rocks, sand -> surf), else its slope over 35 m
        f[F.coast] = clk[10];
        if (garage || !world || clk[10] > 500 || clk[10] < -500) continue;
        const sx = clk[8], sz = clk[9], nx = clk[6], nz = clk[7];
        let rocky = -1;
        if (typeof world.surface === 'function') {
          const sf = world.surface((sx + 8 * nx) | 0, (sz + 8 * nz) | 0);
          if (sf === S_ROCK || sf === S_SCREE) rocky = 1; else if (sf === S_SAND) rocky = 0;
        }
        if (rocky < 0) {
          if (Isl && classIsl(Isl, (sx + 10 * nx) | 0, (sz + 10 * nz) | 0) === WC_BARE) rocky = 0.8;
          else if (typeof world.terrainH === 'function') {
            let h0 = +world.terrainH((sx + 5 * nx) | 0, (sz + 5 * nz) | 0), h1 = +world.terrainH((sx + 40 * nx) | 0, (sz + 40 * nz) | 0);
            if (!(h0 === h0)) h0 = 0; if (!(h1 === h1)) h1 = h0;
            const q = ((h1 - (h0 > 0 ? h0 : 0)) / 35 - 0.12) / 0.28, qq = q < 0 ? 0 : q > 1 ? 1 : q;
            rocky = qq * qq * (3 - 2 * qq);   // the slope over 35 m, 0.12 .. 0.4 (a smoothstep, inline: see the helpers)
          } else rocky = 0;
        }
        f[F.rocky] = rocky;
      } else if (ph === 19) {
        // THE LAKES (the island's signed lake field, + inside) and THE RIVERS (the nearest hydro water, unless a lake is it)
        if (garage || !world) { f[F.lake] = -FAR; f[F.stream] = FAR; continue; }
        if (Isl && Isl.lake) { u8Signed(Isl.lake, Isl.grid, x | 0, z | 0, st.tmp, 5); f[F.lake] = st.tmp[5]; } else f[F.lake] = -FAR;
        let sd = FAR;
        const H = world.hydro;
        if (H && typeof H.distW === 'function') {
          const dw = +H.distW(x | 0, z | 0);
          if (dw === dw && dw < FAR) sd = dw;
          if (f[F.lake] > -(sd + 25)) sd = FAR;   // the nearest water is the lake's (or we are on it)
          if (f[F.coast] < sd + 40) sd = FAR;     // ... or the sea's (distW counts the sea as water)
        }
        f[F.stream] = sd;
      } else if (ph === 20) {
        // THE ZONES: the village (residential / commercial / park / industrial), the harbour; re-read on a new record
        if (garage || !world) { f[F.village] = 0; f[F.harbour] = 0; continue; }
        if (world.premises && world.premises.rec !== st.prem) prepZones(st, world);
        let vil = 0, har = 0;
        const zk = st.zk, zb = st.zb, zp = st.zp, tm = st.tmp, xi = x | 0, zi = z | 0;
        for (let i = 0; i < zk.length; i++) {
          const fall = Z_FALL[zk[i]];
          if (x < zb[4 * i] - fall || x > zb[4 * i + 2] + fall || z < zb[4 * i + 1] - fall || z > zb[4 * i + 3] + fall) continue;
          polyDist(zp[i], xi, zi, tm, 6);
          const q = 1 - tm[6] / fall, qq = q < 0 ? 0 : q;
          const v = qq * qq * (3 - 2 * qq);   // 1 inside, a smoothstep to 0 at `fall` m outside
          if (zk[i] === 1) { if (v > vil) vil = v; } else if (v > har) har = v;
        }
        // the analytic world's settlements: a disc each
        const S = st.sett;
        for (let i = 0; i < S.length; i += 3) {
          const dx = x - S[i], dz = z - S[i + 1], dd = Math.sqrt(dx * dx + dz * dz) - S[i + 2];
          const q = 1 - (dd > 0 ? dd : 0) / Z_FALL[1], qq = q < 0 ? 0 : q;
          const v = qq * qq * (3 - 2 * qq);
          if (v > vil) vil = v;
        }
        f[F.village] = vil; f[F.harbour] = har;
      } else if (ph === 21) {
        // THE AERODROMES: inside the runway's box + a margin (the fence's stand-in), fading AERO_FALL m outside
        if (garage || !world) { f[F.aero] = 0; continue; }
        const A = st.ad;
        let best = 0;
        for (let i = 0; i < A.length; i += 5) {
          const dx = x - A[i], dz = z - A[i + 1], c = Math.cos(A[i + 2]), sn = Math.sin(A[i + 2]);
          const u = Math.abs(dx * c + dz * sn) - A[i + 3], v = Math.abs(-dx * sn + dz * c) - A[i + 4];
          const out = Math.sqrt((u > 0 ? u * u : 0) + (v > 0 ? v * v : 0));
          const q = 1 - out / AERO_FALL, qq = q < 0 ? 0 : q, w = qq * qq * (3 - 2 * qq);
          if (w > best) best = w;
        }
        f[F.aero] = best;
      } else if (ph === 22) {
        // THE WIND at the listener, horizontal (the climate field's own sample: never the solver's linearised cache)
        let ws = 0;
        const C = world && world.climate;
        if (C && typeof C.sample === 'function') {
          const o = st.wnd;
          C.sample(x | 0, (garage ? f[F.elev] + 10 : y) | 0, z | 0, clk[2] | 0, o);
          ws = Math.sqrt(o[0] * o[0] + o[2] * o[2]);
        } else if (world && world.day && world.day.wind && world.day.wind.kts > 0) ws = world.day.wind.kts * 0.5144;
        f[F.wind] = ws === ws ? ws : 0;
      } else {
        // THE SKY: the sun's elevation (DAY_CLOCK walks world.day), the day's front, the rain (owed by CLIMATE: the hook)
        const D = world && world.day;
        const se = D ? +D.sunEl : 45;
        f[F.sun] = se === se ? se : 45;
        const stm = D ? D.storm : null;
        f[F.storm] = stm && stm.I > 0 ? +stm.I : 0;
        const pr = D && typeof D.precip === 'number' ? D.precip : 0;
        f[F.rain] = clk[11] >= 0 ? clk[11] : pr > 0 ? (pr > 1 ? 1 : pr) : 0;
      }
    }
    // the targets EVERY frame (a few dozen operations): a function called twice a second would run in V8's lower tiers
    // and box its doubles; the smoothing below still moves the weights only once a round
    ambienceTargets(st);
    if (clk[1] < AM_PHASES || clk[0] < AM_ROUND_S) return 0;
    // ---- THE ROUND ENDS: the cover's shares (the next frame's targets read them), the smoothing ---------------------
    const tot = acc[7] > 0 ? acc[7] : 1;
    f[F.tree] = acc[0] / tot; f[F.shrub] = acc[1] / tot; f[F.grass] = acc[2] / tot; f[F.built] = acc[3] / tot;
    f[F.bare] = acc[4] / tot; f[F.water] = acc[5] / tot; f[F.wet] = acc[6] / tot;
    ambienceTargets(st);
    const dtR = clk[0] < 1.5 ? clk[0] : 1.5;
    const k = 1 - Math.exp(-dtR / AM_TAU), lim = AM_RATE * dtR, T = st.t, Wt = st.w;
    for (let b = 0; b < NB; b++) {
      let step = (T[b] - Wt[b]) * k;
      if (step > lim) step = lim; else if (step < -lim) step = -lim;
      Wt[b] = Wt[b] + step;
    }
    clk[0] = 0; clk[1] = 0; clk[3] += 1;
    return 1;
  }

  // ---- THE RULES: features -> one target weight per bed (0..1, before the bed's level) -------------------------------
  // THE RAMPS: every smoothstep the rules use, [lo, hi, the feature, its sign], evaluated in ONE loop (st.rv) - twenty-odd
  // calls of a helper would pass TurboFan's inlining budget, and a call it does not inline boxes its doubles
  const RAMPS = [
    ['day', -7, 3, 'sun', 1],
    ['g', 15, 150, 'agl', 1], ['gS', 30, 220, 'agl', 1], ['gZ', 25, 200, 'agl', 1], ['gL', 40, 320, 'agl', 1], ['gN', 4, 25, 'agl', 1],
    ['storm', 11, 17, 'windB', 1], ['alpE', 250, 600, 'elev', 1], ['alpA', 150, 400, 'agl', 1],
    ['wl', 3.5, 7.5, 'windB', 1], ['wcUp', 3, 6, 'windB', 1], ['wcDn', 11, 15, 'windB', 1], ['wm', 2, 5, 'windB', 1],
    ['shoreIn', 30, 250, 'coast', 1], ['shoreSea', 60, 300, 'coast', -1], ['sea', 100, 300, 'coast', -1],
    ['lap', 10, 70, 'lake', -1], ['nearIn', 10, 30, 'lake', 1], ['nearOut', 4, 25, 'lake', -1],
    ['strm', 12, 110, 'stream', 1], ['still', 20, 250, 'lake', -1], ['loon', 30, 450, 'lake', -1],
  ];
  const NR = RAMPS.length, RT = new Float64Array(NR * 4), R = {};
  RAMPS.forEach((r, k) => { R[r[0]] = k; RT[4 * k] = r[1]; RT[4 * k + 1] = r[2]; RT[4 * k + 2] = F[r[3]]; RT[4 * k + 3] = r[4]; });
  function ambienceTargets(st) {
    const f = st.f, T = st.t, rv = st.rv;
    const fo = f[F.tree] * 1.6, ag = f[F.agl];
    f[F.windB] = f[F.wind] * (1 - 0.65 * (fo > 1 ? 1 : fo) * (ag < 25 ? 1 : ag > 60 ? 0 : (60 - ag) / 35));
    for (let k = 0; k < NR; k++) {
      const lo = RT[4 * k], q = (RT[4 * k + 3] * f[RT[4 * k + 2]] - lo) / (RT[4 * k + 1] - lo), qq = q < 0 ? 0 : q > 1 ? 1 : q;
      rv[k] = qq * qq * (3 - 2 * qq);
    }
    const sun = f[F.sun], day = rv[R.day], night = 1 - day;
    const tw = 1 - Math.abs(sun + 3) / 9, twi = tw < 0 ? 0 : tw;  // the twilight: dawn and dusk, the sun near -3 deg
    const ws = f[F.wind];
    const g = 1 - rv[R.g];                                        // the ground's beds: silent above ~150 m
    const gS = 1 - rv[R.gS], gZ = 1 - rv[R.gZ], gL = 1 - rv[R.gL], gN = 1 - rv[R.gN];
    const forest = sat(f[F.tree] * 1.6);
    const open = sat((f[F.grass] + 0.6 * f[F.shrub] + 0.5 * f[F.wet] + 0.25 * f[F.bare]) * 1.3);
    const rustle = 0.75 + 0.5 * sat(ws / 12);                     // the trees rustle with the wind
    for (let b = 0; b < NB; b++) T[b] = 0;
    // THE WINDS (no height fade): light < clear < mountain (high ground, or the night's open ground: its crickets)
    // < storm (a heavy wind or the day's front)
    const storm = Math.max(rv[R.storm], f[F.storm]);
    const alpine = Math.max(rv[R.alpE], rv[R.alpA]);
    const nightOpen = night * g * open * (1 - forest);
    if (f[F.garage] > 0) {
      // THE GARAGE: the hangar's room tone, the roof's rain when it rains, a hint of the outside through the open door -
      // all of it FAINT (the user, 2026-10-05: "it should be really faint. That's a quiet environment, silent or calm
      // music"): GARAGE_K = -12 dB on every bed of the shed, under the music by some 23 dB
      T[B.hangar] = GARAGE_K;
      T[B.rainRoof] = GARAGE_K * sat(f[F.rain]);
      T[B.forestDay] = GARAGE_K * 0.22 * day; T[B.forestNight] = GARAGE_K * 0.2 * night; T[B.meadow] = GARAGE_K * 0.15 * day;
      T[B.windLight] = GARAGE_K * 0.15 * (1 - storm); T[B.windStorm] = GARAGE_K * 0.25 * storm;
      return T;
    }
    if (f[F.under] > 0) { T[B.shoreRocks] = 1; return T; }       // under water: the rocks' bed, muffled by the source
    T[B.windLight] = (1 - rv[R.wl]) * (0.5 + 0.5 * sat(f[F.windB] / 3)) * (1 - 0.5 * alpine);
    T[B.windClear] = rv[R.wcUp] * (1 - rv[R.wcDn]) * (1 - 0.6 * alpine);
    T[B.windMountain] = Math.max(rv[R.wm] * alpine, 0.6 * nightOpen) * (1 - storm);
    T[B.windStorm] = storm;
    // THE COVER
    T[B.forestDay] = g * day * forest * rustle;
    T[B.forestNight] = g * night * forest * rustle;
    T[B.meadow] = g * (day + 0.2 * night) * open * (1 - 0.6 * forest);
    T[B.birdsOpen] = 0.7 * g * day * open * (1 - 0.6 * forest);
    T[B.rainOutside] = g * sat(f[F.rain]);
    // THE SHORE: within ~250 m of the waterline (out to ~300 m over the sea), surf or rocks by the shore's kind
    const c = f[F.coast];
    const shore = c >= 0 ? 1 - rv[R.shoreIn] : 1 - rv[R.shoreSea];
    const seaK = 0.7 + 0.3 * sat(ws / 10);
    T[B.shoreSurf] = gS * shore * (1 - f[F.rocky]) * seaK;
    T[B.shoreRocks] = gS * shore * f[F.rocky] * seaK;
    // THE LAKES: lapping on and beside the water; the near bed only at the very edge, low (the user's rule)
    const L = f[F.lake];
    const lap = L >= 0 ? 1 : 1 - rv[R.lap];
    const sea = c < 0 ? rv[R.sea] * 0.8 : 0;                      // the open sea, past the surf: a lapping too
    T[B.lakeLap] = g * Math.max(lap, 0.3 * sea);   // a little lapping stays under the open sea's own bed
    T[B.seaOpen] = g * sea;
    const nearK = L >= 0 ? 1 - rv[R.nearIn] : 1 - rv[R.nearOut];
    T[B.lakeShore] = gN * nearK;            // the louder shore recording carries "very close to the water"
    T[B.lakeNear] = 0.4 * gN * nearK;       // the user's keep, lower, as texture under it
    // THE RIVERS
    const strm = 1 - rv[R.strm];
    T[B.stream] = g * strm;
    // THE PLACES: the village (a zone, or built cover around), the harbour, the airfield's fence
    T[B.village] = gZ * Math.max(f[F.village], sat(f[F.built] * 1.2) * 0.8 * (1 - f[F.aero]));   // (an airfield's pavement is built cover too)
    T[B.harbour] = gZ * f[F.harbour];
    T[B.airfield] = g * f[F.aero];
    // THE NIGHT AND THE TWILIGHT: frogs near still water, a stream, a bog; loons on and near the lakes at dawn and dusk
    const nearStill = Math.max(1 - rv[R.still], sat(f[F.wet] * 1.5), 0.6 * strm);
    T[B.frogsNight] = g * night * nearStill;
    T[B.loons] = gL * Math.max(twi, 0.3 * night) * (L >= 0 ? 1 : 1 - rv[R.loon]);
    return T;
  }

  const gainOf = (st, b) => st.w[b] * st.lv[b];
  return { ambienceState, ambienceStep, ambienceTargets, gainOf, BEDS, NB, B, F, FN, NF, FAR,
           AM_ROUND_S, AM_TAU, AM_RATE, AM_FLOOR, AM_LUFS, AM_PHASES, polyDist };
})();
if (typeof window !== 'undefined') window.AMBIENCE_MODEL = AMBIENCE_MODEL;
if (typeof module !== 'undefined' && module.exports) module.exports = AMBIENCE_MODEL;
