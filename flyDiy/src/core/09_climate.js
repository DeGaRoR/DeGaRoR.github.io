// ============================================================
// THE CLIMATE (K0, 2026-09-22 — futureDesigns/CLIMATE-2026-09-22.md).
// One vector field w(x, y, z, t) every consumer derives from: the solver's
// strips, the pilot's runway choice, the sea's spectrum, the clouds' drift,
// the windsocks, the smoke, the debug streamlines. Pure: no THREE, no DOM,
// no Date — node-runnable, deterministic, and the gate battery stands on it.
//
// FOUR RULES, WRITTEN ONCE:
//   1. TWO CLOCKS. Fast state (the gusts, a thermal's age, the sea's phase)
//      runs on the SIM clock `t` the solver passes; slow state (a front, the
//      diurnal swing, the thermal potential, the clouds' drift) on the DAY
//      clock `day.utc`, which only the viewer advances — a gate holds it.
//      Never the wall clock.
//   2. `wind()` IS THE SOLVER'S; EVERYONE ELSE `sample()`s. wind() keeps a
//      linearisation cache keyed on `t` (a reference point and its Jacobian,
//      so twenty strips cost one evaluation); a foreign caller at the
//      solver's `t` would re-centre it under the aeroplane's feet.
//   3. BIT-IDENTITY BY CONSTRUCTION. The wind field the fleet was calibrated
//      in (20_world.js G72: base x power-law shear + four gust sines) moved
//      here VERBATIM as windLegacy, and is the whole field whenever the spec
//      names no RICH term. No calibrated gate names one.
//   4. THE DAY DECLARES, THE CLIMATE DERIVES. A consumer that wants a number
//      (the 10 m wind, the visibility, a deck's drift) asks here, never
//      recomputes it.
//
// THE SPEC (a DAY key, `wind`; setDay forwards it, day.spec() round-trips it):
//   legacy   { base:[wx,wy,wz], gust, refH, alpha }        — G72's shape, exact
//   declared { kts | mps, dirDeg (FROM, true north; the grid's convergence
//              applied as sunAzGrid does), gust, refH:10, alpha,
//              aloftK, veerDeg, gradH,                      — the column above the surface layer
//              terrain, breeze, thermals: 0..1 }             — the rich terms (K1, K3)
// rich = any of terrain / breeze / thermals > 0, or aloftK / veerDeg named.
// Not rich -> windLegacy. No spec -> the shared exact zero W0 (the fast path
// every calm gate depends on: GATE WORLD checks the two calls return the SAME
// array).
//
// THE RELIEF RASTER (lazy, built on the first rich spec, never for a legacy
// one): 200 m cells over the world's bounds, twelve Float32 channels per
// cell — the height, two smoothed bands (1.2 km and 300 m), their gradients,
// a prominence (ridge exposure, -1..1), the signed coast distance and its
// unit gradient (inland +), and a ground heating class (0..1). The terrain
// terms read it bilinearly; nothing in the hot path calls terrainH twice.
// ============================================================
var CLIMATE = (function () {
  'use strict';
  // ---- the legacy field's tables, verbatim from 20_world.js (G72) ---------
  const GC = [ // [freq rad/s, kx, kz, phase, axis weight x,y,z]
    [0.63, 0.011, 0.005, 0.7, 1.0, 0.35, 0.55],
    [1.37, 0.004, 0.013, 2.9, 0.55, 0.6, 1.0],
    [2.71, 0.009, 0.008, 5.1, 0.7, 1.0, 0.6],
    [0.29, 0.002, 0.003, 1.9, 1.0, 0.25, 0.8],
  ];
  const WIND_TOP_H = 300;              // m agl: above this the profile has run out
  const WIND_ALPHA = 0.14;             // open grassland, the default surface here
  // ---- the rich column's defaults ----------------------------------------
  const GRAD_H = 1500;                 // m agl where the gradient wind is reached
  // THE RELIEF BANDS' DECAY HEIGHTS. Linear theory: a ground wave of wavelength lambda perturbs the
  // flow as exp(-2 pi z / lambda), and a band smoothed over a scale L carries wavelengths of ~4 L and
  // up, so it decays over ~L/1.6 (an isolated hill of half-width L: Jackson & Hunt's outer region).
  // The coarse band (a 1.2 km blur) over 800 m, the fine (300 m) over 200 m, the local (a 120 m
  // baseline) over 80 m - close to a steep face the lift is the wind times the slope, and it is gone
  // a few hundred metres up, which is what a ridge pilot knows.
  const D_COARSE = 800, D_FINE = 200, D_LOCAL = 80;
  const GD = 60;                       // m: the local slope's half-step (terrainH at +-GD, a 120 m baseline)
  // ---- the convection (K3) --------------------------------------------------
  const S0 = 1361, TAU_ATM = 0.75, CP = 1005;   // W/m2 the solar constant, a clear sky's transmission, J/(kg K)
  const TH_LIFE = 1200;                // s: a thermal's life (Allen 2006), on the DAY clock
  const TH_SPACE = 1.5;                // the spacing, in units of the mixed layer's depth (Lenschow)
  const TH_JIT = 0.35;                 // how far off its cell a thermal may sit (in cells)
  const TH_R2K = 0.102;                // the core's radius as a fraction of z_i (Allen)
  // THE CORE'S PEAK, against Lenschow's AREA MEAN. w_bar = w* (z/zi)^(1/3)(1 - 1.1 z/zi) is the mean
  // over the updraft area and comes to 0.36 w* at mid-layer - which is NOT what a glider feels in a
  // core. Deardorff's scaling puts the rms vertical velocity near 0.6 w* and individual cores at
  // 1.5-2 w*, so the peak is the mean times this: 1.5 w* at mid-layer. Declared, and the one number
  // that sets how good a day feels.
  const TH_CORE = 4.2;
  // ---- the breeze (K3) ------------------------------------------------------
  const SB_V = 4;                      // m/s: a sea breeze at the coast, at full drive
  const SB_H = 700;                    // m: how deep it runs
  const SB_IN = 20000, SB_OUT = 8000;  // m: how far it reaches inland, and out to sea
  const SLOPE_CAP = 0.7;               // a band's slope is capped here: no cliff makes more than 0.7 U
  const LIN_R2 = 40 * 40;              // m^2: a call within this of the reference rides its Jacobian
  const LIN_H = 10;                    // m: the forward-difference step
  const LIN_GROUND_H = 60;             // m agl: under it the ground is read exactly per call, above it linearised
  const KT = 0.514444;                 // m/s per knot
  const D2R = Math.PI / 180;
  // the relief raster
  const CELL = 200;
  const CH = Object.freeze({ h: 0, hc: 1, hf: 2, gxc: 3, gzc: 4, gxf: 5, gzf: 6, prom: 7, coast: 8, cgx: 9, cgz: 10, heat: 11 });
  const NCH = 12;
  const COAST_MAX = 30000;
  // the ground heating class by surface (a Bowen-ratio ordering: wet and green low, bare and dry high;
  // declared, not derived) and, when the island names a terrain type, by type
  const HEAT_BY_TYPE = [0, 0.05, 0.3, 0.15, 0.5, 0.55, 0.6, 0.3, 0.25, 0.05, 0.5, 0.45, 0.6, 0.25, 0.3];   // ttype 0..14
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // bearingToBase(spd, dirDeg, convDeg) -> [wx, 0, wz]: a wind FROM a true bearing, in the frame
  // x east, z south (north = -z). From north it blows toward +z; from west toward +x.
  function bearingToBase(spd, dirDeg, convDeg) {
    const th = ((dirDeg || 0) - (convDeg || 0)) * D2R;
    return [0 - Math.sin(th) * spd, 0, Math.cos(th) * spd];   // 0 - x: never a -0
  }
  // FNV-1a over a Float32Array's bits (the gate's raster fingerprint)
  function fnv(arr) {
    const u = new Uint32Array(arr.buffer, arr.byteOffset, arr.length);
    let h = 0x811c9dc5;
    for (let i = 0; i < u.length; i++) { h ^= u[i] & 0xff; h = Math.imul(h, 16777619); h ^= (u[i] >>> 8) & 0xff; h = Math.imul(h, 16777619); h ^= (u[i] >>> 16) & 0xff; h = Math.imul(h, 16777619); h ^= u[i] >>> 24; h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  // ---- the raster ----------------------------------------------------------
  // three-pass box blur of radius r in place, separable (variance r(r+1) cells^2 per axis: r 6 is a
  // 6.5-cell Gaussian, r 1 a 1.4-cell one); edges clamp
  function blur3(src, nx, nz, r) {
    const a = Float32Array.from(src), b = new Float32Array(nx * nz);
    const w = 2 * r + 1;
    for (let pass = 0; pass < 3; pass++) {
      for (let j = 0; j < nz; j++) {                       // along x
        let s = 0;
        for (let i = -r; i <= r; i++) s += a[j * nx + clamp(i, 0, nx - 1)];
        for (let i = 0; i < nx; i++) {
          b[j * nx + i] = s / w;
          s += a[j * nx + clamp(i + r + 1, 0, nx - 1)] - a[j * nx + clamp(i - r, 0, nx - 1)];
        }
      }
      for (let i = 0; i < nx; i++) {                       // along z
        let s = 0;
        for (let j = -r; j <= r; j++) s += b[clamp(j, 0, nz - 1) * nx + i];
        for (let j = 0; j < nz; j++) {
          a[j * nx + i] = s / w;
          s += b[clamp(j + r + 1, 0, nz - 1) * nx + i] - b[clamp(j - r, 0, nz - 1) * nx + i];
        }
      }
    }
    return a;
  }
  // 3-4 chamfer distance (cells x 3) from the marked cells, as 21_world_hydro does it
  function chamfer(mark, nx, nz) {
    const d = new Float32Array(nx * nz).fill(1e9);
    for (let k = 0; k < nx * nz; k++) if (mark[k]) d[k] = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; let v = d[k];
      if (i > 0 && d[k - 1] + 3 < v) v = d[k - 1] + 3;
      if (j > 0) {
        if (d[k - nx] + 3 < v) v = d[k - nx] + 3;
        if (i > 0 && d[k - nx - 1] + 4 < v) v = d[k - nx - 1] + 4;
        if (i + 1 < nx && d[k - nx + 1] + 4 < v) v = d[k - nx + 1] + 4;
      }
      d[k] = v;
    }
    for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
      const k = j * nx + i; let v = d[k];
      if (i + 1 < nx && d[k + 1] + 3 < v) v = d[k + 1] + 3;
      if (j + 1 < nz) {
        if (d[k + nx] + 3 < v) v = d[k + nx] + 3;
        if (i + 1 < nx && d[k + nx + 1] + 4 < v) v = d[k + nx + 1] + 4;
        if (i > 0 && d[k + nx - 1] + 4 < v) v = d[k + nx - 1] + 4;
      }
      d[k] = v;
    }
    return d;
  }
  function buildRelief(env) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    const b = env.bounds, terrainH = env.terrainH, surface = env.surface, S = env.SURFACE || {};
    const nx = Math.ceil((b.x1 - b.x0) / CELL) + 1, nz = Math.ceil((b.z1 - b.z0) / CELL) + 1, N = nx * nz;
    const h = new Float32Array(N), sea = new Uint8Array(N), land = new Uint8Array(N), heat = new Float32Array(N);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = b.x0 + (i + 0.5) * CELL, z = b.z0 + (j + 0.5) * CELL;
      const hh = terrainH(x, z);
      h[k] = hh;
      const sf = surface ? surface(x, z) : -1;
      // THE SEA is level 0 and classed water — the same rule waterH stands on (a lake sits above 0 and
      // is not a sea: no lake breeze)
      const isSea = hh <= 0.05 && sf === S.WATER;
      sea[k] = isSea ? 1 : 0; land[k] = isSea ? 0 : 1;
      let ht = sf === S.WATER ? 0 : sf === S.FOREST_FLOOR ? 0.25 : sf === S.GRASS ? 0.35 : (sf === S.GRAVEL || sf === S.SAND) ? 0.5
             : (sf === S.PAVED || sf === S.SCREE) ? 0.55 : sf === S.ROCK ? 0.6 : 0.35;
      if (env.typeAt) { const tt = env.typeAt(x, z); if (tt >= 0 && tt < HEAT_BY_TYPE.length) ht = HEAT_BY_TYPE[tt]; }
      heat[k] = ht;
    }
    const hc = blur3(h, nx, nz, 6);                        // the coarse band, ~1.2 km
    const hs = blur3(h, nx, nz, 1);                        // the ~300 m smoothing
    const hf = new Float32Array(N); for (let k = 0; k < N; k++) hf[k] = hs[k] - hc[k];   // the fine band, the residual
    const hf2 = new Float32Array(N); for (let k = 0; k < N; k++) hf2[k] = hf[k] * hf[k];
    const rms = blur3(hf2, nx, nz, 5);                      // the fine band's rms over ~2 km
    const dSea = chamfer(sea, nx, nz), dLand = chamfer(land, nx, nz);
    const data = new Float32Array(N * NCH);
    const at = (arr, i, j) => arr[clamp(j, 0, nz - 1) * nx + clamp(i, 0, nx - 1)];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, o = k * NCH;
      data[o + CH.h] = h[k]; data[o + CH.hc] = hc[k]; data[o + CH.hf] = hf[k];
      data[o + CH.gxc] = (at(hc, i + 1, j) - at(hc, i - 1, j)) / (2 * CELL);
      data[o + CH.gzc] = (at(hc, i, j + 1) - at(hc, i, j - 1)) / (2 * CELL);
      data[o + CH.gxf] = (at(hf, i + 1, j) - at(hf, i - 1, j)) / (2 * CELL);
      data[o + CH.gzf] = (at(hf, i, j + 1) - at(hf, i, j - 1)) / (2 * CELL);
      data[o + CH.prom] = clamp(hf[k] / (Math.sqrt(Math.max(0, rms[k])) + 5), -1, 1);
      // signed coast distance: + inland (to the nearest sea cell), - at sea (to the nearest land cell)
      const dc = sea[k] ? -dLand[k] : dSea[k];
      data[o + CH.coast] = clamp(dc * CELL / 3, -COAST_MAX, COAST_MAX);
      data[o + CH.heat] = heat[k];
    }
    const coastAt = (i, j) => data[(clamp(j, 0, nz - 1) * nx + clamp(i, 0, nx - 1)) * NCH + CH.coast];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {   // the coast gradient, unit, inland
      const k = j * nx + i, o = k * NCH;
      const gx = coastAt(i + 1, j) - coastAt(i - 1, j);
      const gz = coastAt(i, j + 1) - coastAt(i, j - 1);
      const m = Math.hypot(gx, gz);
      data[o + CH.cgx] = m > 1e-6 ? gx / m : 0; data[o + CH.cgz] = m > 1e-6 ? gz / m : 0;
    }
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    return { nx, nz, cell: CELL, x0: b.x0, z0: b.z0, data, CH, NCH, ms: t1 - t0, get hash() { return fnv(data); } };
  }

  // ---- the climate -----------------------------------------------------------
  // make(env) — env: { terrainH, surface, SURFACE, bounds, day, geo, typeAt?, coastAt?, seed }
  function make(env) {
    const terrainH = env.terrainH;
    const geo = env.geo || (env.day && env.day.geo) || null;
    // ---- the legacy field, verbatim (20_world.js G72) ----------------------
    // setWind({ base:[wx,wy,wz], gust:g }) — gusts are sums of incommensurate
    // sines with spatial phase (advecting waves), amplitude g horizontal and
    // 0.6*g vertical. Deterministic by construction: gates can rely on it.
    // Default null: wind() returns the shared zero vector (fast path).
    //
    // THE SURFACE LAYER (G72). `y` has been an argument of wind() since the
    // field was written and had never been read. It is read now: the ground
    // drags on the air, so the wind near it is slower than the wind above it,
    // and an aeroplane on final is in measurably different air from the one
    // at circuit height.
    //
    // WHERE THE REPORTED WIND IS. A wind speed is meaningless without a height,
    // and the height every anemometer, every windsock and every METAR means is
    // 10 m. So `refH` says which height `base` was measured at, and the profile
    // is the engineering power law u/uref = (z/zref)^alpha — the same one every
    // wind-resource and building-code calculation uses, with alpha set by how
    // rough the ground is (0.10 open water, 0.14 open grass, 0.20 scrub and
    // trees). It is a fit, not a derivation, and it is a good one to about 200 m.
    //
    // A SPEC WITH NO refH IS A UNIFORM COLUMN, which is exactly the pre-G72 model
    // and is what the fleet's whole wind calibration was measured in. That is a
    // deliberate, declared boundary rather than a compatibility fudge: "no
    // reference height" honestly means "we are not claiming to know where this
    // wind was measured", and the only answer that does not invent information is
    // to blow it everywhere equally. The XCTY gates anchored to that column; the
    // CONDITIONS presets and GATE HOTHIGH declare a refH and fly the profile.
    let windSpec = null;
    const W0 = [0, 0, 0], WV = [0, 0, 0];
    function shearK(x, y, z, refH, alpha) {
      const agl = y - terrainH(x, z);
      // a power law has no zero: floor the height rather than pretend it does.
      const h = Math.min(WIND_TOP_H, Math.max(0.2, agl));
      return Math.pow(h / refH, alpha);
    }
    function windLegacy(x, y, z, t) {
      if (!windSpec) return W0;
      const b = windSpec.base, g = windSpec.gust || 0;
      const k = windSpec.refH ? shearK(x, y, z, windSpec.refH, windSpec.alpha) : 1;
      WV[0] = b[0] * k; WV[1] = b[1] * k; WV[2] = b[2] * k;
      // the gusts ride the local wind, so they die out in the surface layer and
      // grow in the shear instead of being the same everywhere from grass to
      // circuit height
      const gk = g * k;
      if (gk > 0) for (const [om, kx, kz, ph, ax, ay, az] of GC) {
        const s = Math.sin(om * t + kx * x + kz * z + ph);
        WV[0] += gk * 0.30 * ax * s;
        WV[1] += gk * 0.18 * ay * s;
        WV[2] += gk * 0.30 * az * s;
      }
      return WV;
    }
    // the gust sines alone, at amplitude ga (the rich path's exact-per-call term)
    function addGust(x, y, z, t, ga, out) {
      if (!(ga > 0)) return;
      for (const [om, kx, kz, ph, ax, ay, az] of GC) {
        const s = Math.sin(om * t + kx * x + kz * z + ph);
        out[0] += ga * 0.30 * ax * s;
        out[1] += ga * 0.18 * ay * s;
        out[2] += ga * 0.30 * az * s;
      }
    }

    // ---- the resolved spec -------------------------------------------------
    let rich = null;                 // { terrain, breeze, thermals, aloftK, veerDeg, gradH } when a rich term is on
    let mode = 'zero';
    let relief = null;
    let version = 0;
    const stats = { mode, full: 0, linear: 0, recentres: 0, rasterMs: 0, tickMs: 0 };
    function ensureRelief() {
      if (!relief) { relief = buildRelief(env); stats.rasterMs = relief.ms; version++; }
      return relief;
    }
    // setWind(spec | null) -> { base, spd } (the world's sea law reads it); the spec's declared or
    // legacy form, resolved once
    // THE FRONT'S HAND ON THE WIND (K2). The day owns the timeline (07_day.js
    // storm: an intensity, a veer, a wind and gust factor, all pure in the
    // clock); the climate asks it for the numbers and re-resolves the column.
    // `stormOf()` is read at every resolve AND whenever the day's front has
    // moved — the viewer's tick calls `refresh()` for that — so the wind veers
    // and rises through a passage without anything else being touched.
    function stormOf() { const st = env.day && env.day.storm; return st && st.I > 0 ? st : null; }
    let spec0 = null;                                   // the DECLARED spec, before the front's hand
    function setWind(spec) {
      spec0 = spec || null;
      if (!spec) { windSpec = null; rich = null; mode = 'zero'; stats.mode = mode; version++; return { base: [0, 0, 0], spd: 0 }; }
      let base;
      if (spec.base) base = spec.base;
      else if (spec.mps != null || spec.kts != null)
        base = bearingToBase(spec.mps != null ? +spec.mps : +spec.kts * KT, spec.dirDeg, geo ? geo.convergenceDeg : 0);
      else base = [0, 0, 0];
      // the front: the wind rises, veers, and gusts harder through the passage
      const st = stormOf();
      let gust = spec.gust || 0;
      if (st) {
        const ph = st.veer * D2R, c = Math.cos(ph), sn = Math.sin(ph);
        const bx = base[0] * c - base[2] * sn, bz = base[2] * c + base[0] * sn;
        base = [bx * st.windK, base[1] * st.windK, bz * st.windK];
        gust = Math.min(1.5, gust * st.gustK + 0.25 * (st.gustK - 1));
      }
      windSpec = { base, gust, refH: spec.refH || 0,
                   alpha: spec.alpha != null ? spec.alpha : WIND_ALPHA };
      const isRich = (spec.terrain > 0) || (spec.breeze > 0) || (spec.thermals > 0) || spec.aloftK != null || spec.veerDeg != null || !!st;
      rich = isRich ? { terrain: +spec.terrain || 0, breeze: +spec.breeze || 0, thermals: +spec.thermals || 0,
                        aloftK: spec.aloftK != null ? +spec.aloftK : 1, veerDeg: spec.veerDeg != null ? +spec.veerDeg : 0,
                        gradH: spec.gradH != null ? +spec.gradH : GRAD_H } : null;
      mode = isRich ? 'rich' : 'legacy'; stats.mode = mode;
      if (isRich && (rich.terrain > 0 || rich.breeze > 0 || rich.thermals > 0)) ensureRelief();
      C.t = NaN;                                            // the cache is the old field's
      version++;
      return { base, spd: Math.hypot(base[0], base[2]) };
    }

    // ---- the rich field ----------------------------------------------------
    // THE FIELD IS TWO KINDS OF TERM. The SURFACE LAYER k(agl) — the legacy power law — is steep
    // curvature within metres of the ground, so it is never linearised: every call evaluates it
    // exactly (one pow) from an AGL the GROUND's own linearisation gives. Everything else has a scale
    // of 300 m or more and rides the Jacobian. So smooth() writes SEVEN channels at unit shear:
    //   col[3]  the synoptic column WITHOUT k (base, then the speed and the veer toward the gradient
    //           wind above the surface layer — Ekman: the surface wind is backed 15-30 deg and is
    //           0.6-0.75 of the gradient wind over land; aloftK 1.3 and veerDeg 20 are those, declared)
    //   rest[3] the terms that do not shear with the ground (K1 the terrain-following flow, K3 the
    //           breeze and the thermals; 0 in K0)
    //   TI      the turbulence intensity the gusts ride (K1 the lee rotor; 1 in K0)
    // and the wind at a point is  k * col + rest,  the gust amplitude  gust * k * TI.
    const shearOf = (agl, refH, alpha) => refH ? Math.pow(Math.min(WIND_TOP_H, Math.max(0.2, agl)) / refH, alpha) : 1;
    const RL = new Float32Array(NCH);
    // gl = [gx, gz]: the LOCAL slope at the point (terrainH central differences at +-GD), the third band
    function smooth(x, y, z, t, agl, gl, out) {
      const b = windSpec.base;
      let ux = b[0], uy = b[1], uz = b[2];
      if (rich.aloftK !== 1 || rich.veerDeg !== 0) {
        const s = smoothstep(WIND_TOP_H, rich.gradH, agl);
        if (s > 0) {
          const m = 1 + (rich.aloftK - 1) * s, ph = rich.veerDeg * s * D2R, c = Math.cos(ph), sn = Math.sin(ph);
          const vx = ux * c - uz * sn, vz = uz * c + ux * sn;   // a veer: clockwise seen from above
          ux = vx * m; uz = vz * m;
        }
      }
      let ti = 1;
      if (rich.terrain > 0) {
        // THE TERRAIN (K1). Linear hill theory, neutral, irrotational: over a relief band of horizontal
        // scale L the flow's perturbation decays as exp(-z/L). Two bands from the raster - the coarse
        // (~1.2 km) and the fine (~300 m) - each with its own decay. At the ground the vertical part IS
        // the kinematic condition, w = U . grad h (the air follows the slope): the windward face lifts,
        // the lee sinks, with no sign to choose. The slopes are capped at 0.7 so an un-smoothed cliff
        // cannot make more than 0.7 U. These channels are scaled by the surface layer's k in combine():
        // the deflection at a height is driven by the wind at that height.
        const R = reliefAt(x, z, RL), T = rich.terrain;
        let gxc = R[CH.gxc], gzc = R[CH.gzc], gxf = R[CH.gxf], gzf = R[CH.gzf];
        const mc = Math.hypot(gxc, gzc); if (mc > SLOPE_CAP) { gxc *= SLOPE_CAP / mc; gzc *= SLOPE_CAP / mc; }
        const mf = Math.hypot(gxf, gzf); if (mf > SLOPE_CAP) { gxf *= SLOPE_CAP / mf; gzf *= SLOPE_CAP / mf; }
        const a0 = Math.max(0, agl), ec = Math.exp(-a0 / D_COARSE), ef = Math.exp(-a0 / D_FINE);
        // THE LOCAL BAND: a 200 m raster smoothed over 300 m cuts a steep face's slope to a third (the
        // analytic world's 35 deg faces read 0.25), and a ridge pilot flies within a wingspan or two of
        // the slope, where the air follows the REAL ground. So the third band is the true slope at the
        // point (+-60 m) less what the raster already carries, decaying over 80 m - close to a steep
        // face the lift is the wind times the slope, as it is. Across the solver's footprint the slope
        // is the reference's (a 140 m ground wave moves it 0.1 over 12 m; one slope per aeroplane).
        let glx = gl[0] - gxc - gxf, glz = gl[1] - gzc - gzf;
        const ml = Math.hypot(glx, glz); if (ml > SLOPE_CAP) { glx *= SLOPE_CAP / ml; glz *= SLOPE_CAP / ml; }
        const el = Math.exp(-a0 / D_LOCAL);
        const wy = T * ((ux * gxc + uz * gzc) * ec + (ux * gxf + uz * gzf) * ef + (ux * glx + uz * glz) * el);
        // THE CREST SPEED-UP AND THE VALLEY'S SHELTER (Jackson & Hunt 1975: the fractional speed-up at a
        // 3-D hill's crest is ~1.6 h/L, capped at 0.8 here) on the fine band's height, signed by the
        // prominence (a crest +1, a valley floor -1, the shelter at 0.4 of the speed-up), decaying over
        // the same L; horizontal only, floored at half the wind
        const S = Math.min(0.8, 1.6 * Math.abs(R[CH.hf]) / 300), p = R[CH.prom];
        const m = Math.max(0.5, 1 + T * (p > 0 ? S * p : 0.4 * S * p) * ef);
        // THE LEE ROTOR: under a lee slope of 9 deg and more of the SMOOTHED relief (the downslope
        // steepness in the wind, the two bands together; a 300 m smoothing halves a real slope, so 0.15
        // here is a 17 deg hillside) the flow separates - linear theory has nothing to say, so this is a
        // declared amplitude: the gusts' intensity up to x4 at 22 deg, decaying over twice L. combine()
        // reads it.
        const U = Math.hypot(ux, uz);
        const lee = U > 0.1 ? Math.max(0, -((ux * (gxc + gxf) + uz * (gzc + gzf)) / U)) : 0;
        ti += 3 * T * smoothstep(0.15, 0.4, lee) * Math.exp(-a0 / (2 * D_FINE));
        ux *= m; uz *= m; uy += wy;
      }
      // the terms that do NOT shear with the ground: they are their own flows
      let rx = 0, ry = 0, rz = 0;
      if (rich.breeze > 0) {
        const C = convNow();
        breezeAt(x, z, agl, C, BR);
        rx += rich.breeze * BR[0]; ry += rich.breeze * BR[1]; rz += rich.breeze * BR[2];
      }
      if (rich.thermals > 0) {
        const C = convNow();
        if (C) {
          const utc = env.day ? env.day.utc : 0;
          ry += rich.thermals * thermalAt(x, z, agl, C, utc);
          // THE CONVECTION ROUGHENS THE AIR IT WORKS IN. A mixed layer is
          // turbulent everywhere, not only in the cores, so the gusts ride
          // harder inside it - and only inside it: above the lid the air is
          // smooth, and under the ground there is no air (that clause is not
          // pedantry, it was putting gusts below the terrain).
          if (agl > 0 && agl < C.zi) ti += 0.5 * rich.thermals;
        }
      }
      out[0] = ux; out[1] = uy; out[2] = uz;
      out[3] = rx; out[4] = ry; out[5] = rz;
      out[6] = ti;
    }
    // combine(S, agl, x, y, z, t, out): the wind from seven channels and the ground. The gusts ride
    // gust x TI, and a rotor gusts on its own (0.5 of the base per unit of TI above 1: a full rotor is
    // +-0.45 of the wind, the violence a lee is known for) so a calm
    // declared day is still rough in a lee.
    function combine(S, agl, x, y, z, t, out) {
      const k = shearOf(agl, windSpec.refH, windSpec.alpha);
      out[0] = k * S[0] + S[3]; out[1] = k * S[1] + S[4]; out[2] = k * S[2] + S[5];
      addGust(x, y, z, t, k * ((windSpec.gust || 0) * S[6] + 0.5 * (S[6] - 1)), out);
      return out;
    }
    // ---- THE CONVECTION (K3) -------------------------------------------------
    // WHAT DRIVES IT. The ground takes the sun's heat and gives it back to the
    // air as thermals. The sensible heat flux is what is left of the beam after
    // the albedo and the cloud, and it runs BEHIND the sun (the day's sunElLag):
    //
    //   H  = heat x (1 - albedo) x S0 x tau x max(0, sin El_lag) x (1 - 0.7 cover)
    //   w* = ( g/T x H/(rho cp) x z_i )^(1/3)                        (Deardorff)
    //
    // `heat` is the ground's own share, off the relief raster (water 0, forest
    // 0.25, rock 0.6 - a Bowen-ratio ordering), so a thermal stands over a
    // gravel bar and not over a lake. z_i is mixTop(): the LOWER of the day's
    // lid and its condensation level, which is why a capped day tops its
    // thermals early and an uncapped one puts a cumulus on each of them. A fair
    // afternoon gives 200-250 W/m2 and w* around 2 m/s, which is a good day.
    const mapCache = {};
    let conv = null, convKey = null;
    function convNow() {
      const day = env.day;
      if (!day || !windSpec) return null;
      const zi = mixTop();
      const cover = day.cloudCoverEff != null ? day.cloudCoverEff : day.cloudCover;
      const sinEl = Math.sin(Math.max(0, day.sunElLag != null ? day.sunElLag : day.sunEl) * D2R);
      const b = windSpec.base;
      const k = Math.round(zi) + ':' + Math.round(cover * 1000) + ':' + Math.round(sinEl * 1e4)
              + ':' + day.cloudSeed + ':' + (day.cloudTypeEff || day.cloudType)
              + ':' + Math.round((day.oatC || 15) * 10) + ':' + Math.round(b[0] * 100) + ',' + Math.round(b[2] * 100);
      if (k === convKey) return conv;
      convKey = k;
      if (!(sinEl > 0) || !(zi > 0)) { conv = null; return null; }   // night: no convection at all
      const alb = day.groundAlbedo != null ? day.groundAlbedo : 0.15;
      const T = (day.oatC != null ? day.oatC : 15) + 273.15;
      const atm = env.atmos ? env.atmos() : null;
      const rho = atm ? atm.rho(0) : 1.225;
      const beam = S0 * TAU_ATM * sinEl * (1 - alb) * (1 - 0.7 * clamp(cover, 0, 1));
      const wstarOf = heat => {
        const H = Math.max(0, heat) * beam;
        return H > 0 ? Math.cbrt((9.80665 / T) * (H / (rho * CP)) * zi) : 0;
      };
      // THE LATTICE DRIFTS AT ONE WIND, not at the wind where it is sampled: a
      // frame whose speed varied with the sample point would not be a frame.
      // That one wind is the boundary layer's mean - the declared base lifted
      // to half the layer's depth by the same power law the column shears on.
      const kBL = windSpec.refH ? Math.pow(Math.min(WIND_TOP_H, Math.max(0.2, 0.5 * zi)) / windSpec.refH, windSpec.alpha) : 1;
      conv = { zi, cover, sinEl, T, rho, beam, wstarOf,
               spacing: Math.max(400, TH_SPACE * zi),
               ux: b[0] * kBL, uz: b[2] * kBL, bx: b[0], bz: b[2],
               wRef: Math.max(0.5, wstarOf(0.35)),                   // for the tilt's lag, one number per day
               map: CLOUD_FIELD.weatherMap({ seed: day.cloudSeed, cover,
                                             type: day.cloudTypeEff || day.cloudType, cache: mapCache }) };
      return conv;
    }
    // THE LATTICE. A square lattice of spacing 1.5 z_i (Lenschow's thermal
    // spacing) in a frame advected by that one wind, so every thermal drifts
    // downwind with no per-thermal state to keep - and a gate whose day is
    // frozen has a frozen field. A cell's hash decides whether a thermal stands
    // there at all, with what strength and how far off centre; the probability
    // leans on the weather map's coverage, so the thermals cluster where the
    // cumulus are (they are one field: the clouds ARE the tops). The age runs on
    // the DAY clock with a smooth envelope - born, working, dying over twenty
    // minutes - which is the two-clocks rule again.
    function thash(i, j, n) {
      let h = (i * 374761393 + j * 668265263 + n * 1013904223 + (env.seed | 0) * 2654435761) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    }
    const smf01 = t => { const q = clamp(t, 0, 1); return q * q * (3 - 2 * q); };
    const TH_TMP = { x: 0, z: 0, k: 0, ok: false };
    const RL2 = new Float32Array(NCH), RL3 = new Float32Array(NCH);
    function thermalCell(i, j, C, utc, dx0, dz0, out) {
      const sp = C.spacing;
      const ph = thash(i, j, 7);
      const n = Math.floor(utc / TH_LIFE + ph);
      // WHERE IT STANDS, FIRST. The jitter comes before the tests, not after:
      // a cell is 1.5 z_i across and a thermal may sit a third of that off
      // centre, so asking 'is there cloud here' at the lattice point instead of
      // at the column's own place blurs the answer over most of a cloud
      // (measured: the clustering fell from nearly two-to-one to 1.4).
      const x0 = i * sp + dx0 + (thash(i, j, n * 31 + 2) - 0.5) * 2 * TH_JIT * sp;
      const z0 = j * sp + dz0 + (thash(i, j, n * 31 + 3) - 0.5) * 2 * TH_JIT * sp;
      // UNDER THE CLOUD. The map's coverage carries a soft edge, so most of a
      // covered texel reads well under 1; a linear ramp on it barely clusters
      // anything. What matters is whether there IS cloud overhead, so the odds
      // step over the edge instead of leaning on its depth.
      const cov = C.map ? CLOUD_FIELD.sample(C.map, x0, z0)[0] : 0;
      if (thash(i, j, n * 31 + 1) > 0.22 + 0.68 * smf01(cov / 0.25)) { out.ok = false; return out; }
      // AND ON GROUND THAT HEATS: no column stands over water. The raster is
      // bilinear, so a point just off a beach still carries some of the land's
      // heat; under this floor there is no thermal at all, not a weak one.
      if (reliefAt(x0, z0, RL3)[CH.heat] < 0.06) { out.ok = false; return out; }
      const a = (utc / TH_LIFE + ph) - n;                            // 0..1 through its life
      const e = smf01(a / 0.2) * (1 - smf01((a - 0.7) / 0.3));
      if (e <= 0.001) { out.ok = false; return out; }
      out.x = x0; out.z = z0;
      out.k = (0.6 + 0.8 * thash(i, j, n * 31 + 4)) * e;
      out.ok = true;
      return out;
    }
    // THE COLUMN'S SHAPE (Lenschow 1980 / Allen 2006): a mean updraft over the
    // layer's depth, a core of radius r2, and a SINK ANNULUS out to 2 r2 that
    // carries down exactly the air the core lifts - mass balanced by
    // construction (the core integrates to pi w r2^2 / 2 and the annulus to
    // 2 pi r2^2 w_ann, so w_ann = w/4). Above z_i there is nothing: a glider
    // does not climb into the cloud here, and that is a declared cut.
    function thermalAt(x, z, agl, C, utc) {
      const zi = C.zi;
      if (agl <= 0 || agl >= zi) return 0;
      const zr = agl / zi;
      const wbar = Math.pow(zr, 1 / 3) * (1 - 1.1 * zr);
      if (wbar <= 0) return 0;
      const r2 = Math.max(20, TH_R2K * Math.pow(zr, 1 / 3) * (1 - 0.25 * zr) * zi);
      const sp = C.spacing;
      const dx0 = C.ux * utc, dz0 = C.uz * utc;                      // the lattice, carried downwind
      // THE TILT IS THE SHEAR'S, NOT THE WIND'S. The column rides in the moving
      // air, so the wind itself carries the whole thing (that is the lattice's
      // drift above) and cannot lean it. What leans it is the DIFFERENCE between
      // the wind at this height and the mean the column travels at: a parcel
      // took agl/w* seconds to get here and spent them in air moving (U(z)-U_bl)
      // relative to the column. Using the whole wind instead put a 2 km lean on
      // a 900 m column - measured, and wrong by the width of the lattice.
      const kz = windSpec.refH ? Math.pow(Math.min(WIND_TOP_H, Math.max(0.2, agl)) / windSpec.refH, windSpec.alpha) : 1;
      const shx = C.bx * kz - C.ux, shz = C.bz * kz - C.uz;
      const lag = Math.min(900, agl / C.wRef);
      const tx = x - shx * lag, tz = z - shz * lag;
      const i0 = Math.floor((tx - dx0) / sp), j0 = Math.floor((tz - dz0) / sp);
      let w = 0;
      for (let di = 0; di <= 1; di++) for (let dj = 0; dj <= 1; dj++) {
        const c = thermalCell(i0 + di, j0 + dj, C, utc, dx0, dz0, TH_TMP);
        if (!c.ok) continue;
        const ddx = tx - c.x, ddz = tz - c.z, r = Math.hypot(ddx, ddz);
        if (r > 2 * r2) continue;
        const wstar = C.wstarOf(reliefAt(c.x, c.z, RL2)[CH.heat]);
        if (!(wstar > 0)) continue;
        const wpk = TH_CORE * wbar * wstar * c.k;                    // the core's peak (see TH_CORE)
        w += r <= r2 ? wpk * (1 - (r / r2) * (r / r2))
                     : -(wpk / 4) * (1 - Math.pow((r - 1.5 * r2) / (0.5 * r2), 2));
      }
      return w;
    }
    // THE SEA BREEZE (K3). The land heats, the air over it rises, and the sea's
    // cooler air runs in underneath: a flow along the coast's own gradient (the
    // raster's `cgx, cgz`, which points inland), driven by the same lagged sun,
    // killed by cloud, about 700 m deep, reaching ~20 km inland and ~8 km out.
    // At night it reverses, weakly, as the land gives its heat back.
    //
    // The VERTICAL part is continuity and nothing else: the horizontal flow dies
    // out inland, so what it carries has to go up. With A(d) = V exp(-|d|/D),
    //   div V_h = (1 - z/H) dA/dd = -(1 - z/H) A sgn(d) / D
    //   w(z)    = -int_0^z div  =  (A/D) sgn(d) z (1 - z/2H)
    // NAMED CUT, and it matters: that lift is BROAD - 0.05-0.1 m/s spread over
    // twenty kilometres, which is what a front's convergence comes to when it is
    // smeared over its whole envelope. The real sea-breeze front is a line, 1-2
    // m/s over a kilometre, and a glider works the line. That sharpening (where
    // the breeze meets the opposing gradient wind) is owed, not modelled here.
    // The breeze's WIND is honest and is the big effect: a coast that swings
    // onshore through the afternoon.
    function breezeAt(x, z, agl, C, out) {
      const R = reliefAt(x, z, RL2), d = R[CH.coast];
      const drive = C ? C.sinEl * (1 - 0.8 * clamp(C.cover, 0, 1)) : -0.25;
      const D = d >= 0 ? SB_IN : SB_OUT;
      const A = SB_V * drive * Math.exp(-Math.abs(d) / D);
      const zc = Math.min(agl, SB_H);
      const envZ = Math.max(0, 1 - agl / SB_H);
      out[0] = A * envZ * R[CH.cgx];
      out[2] = A * envZ * R[CH.cgz];
      out[1] = (A / D) * (d >= 0 ? 1 : -1) * zc * (1 - zc / (2 * SB_H));
      return out;
    }
    const BR = [0, 0, 0];
    // ---- the linearised sampler (rule 2) -----------------------------------
    // The reference: the ground and its gradient (three terrainH calls), the seven channels and their
    // Jacobian (four smooth() calls). A call within LIN_R of it at the same instant costs a pow and
    // 21 multiply-adds; a far call at the same instant is a full sample and leaves the reference alone.
    const NCHN = 7;
    const C = { t: NaN, x: 0, y: 0, z: 0, g0: 0, gx: 0, gz: 0, w0: new Float64Array(NCHN), J: new Float64Array(NCHN * 3) };
    const T1 = new Float64Array(NCHN), T2 = new Float64Array(NCHN), GL = [0, 0], GL2 = [0, 0];
    // the ground's plane at a point: central differences at +-GD (four terrainH calls), the same slope
    // the local band reads
    function groundAt(x, z, gl) {
      gl[0] = (terrainH(x + GD, z) - terrainH(x - GD, z)) / (2 * GD);
      gl[1] = (terrainH(x, z + GD) - terrainH(x, z - GD)) / (2 * GD);
    }
    function recentre(x, y, z, t) {
      const w0 = C.w0, J = C.J;
      const g0 = terrainH(x, z);
      groundAt(x, z, GL);
      C.g0 = g0; C.gx = GL[0]; C.gz = GL[1];
      smooth(x, y, z, t, y - g0, GL, w0);
      smooth(x + LIN_H, y, z, t, y - g0 - GL[0] * LIN_H, GL, T1);  for (let c = 0; c < NCHN; c++) J[c * 3] = (T1[c] - w0[c]) / LIN_H;
      smooth(x, y + LIN_H, z, t, y + LIN_H - g0, GL, T1);          for (let c = 0; c < NCHN; c++) J[c * 3 + 1] = (T1[c] - w0[c]) / LIN_H;
      smooth(x, y, z + LIN_H, t, y - g0 - GL[1] * LIN_H, GL, T1);  for (let c = 0; c < NCHN; c++) J[c * 3 + 2] = (T1[c] - w0[c]) / LIN_H;
      C.t = t; C.x = x; C.y = y; C.z = z;
      stats.full += 4; stats.recentres++;
    }
    function wind(x, y, z, t) {
      if (mode === 'zero') return W0;
      if (mode === 'legacy') return windLegacy(x, y, z, t);
      if (t !== C.t) {
        recentre(x, y, z, t);
        return combine(C.w0, y - C.g0, x, y, z, t, WV);
      }
      const dx = x - C.x, dy = y - C.y, dz = z - C.z;
      if (dx * dx + dy * dy + dz * dz > LIN_R2) {           // a far call at the same instant: full, no re-centre
        const agl = y - terrainH(x, z);
        groundAt(x, z, GL2);
        smooth(x, y, z, t, agl, GL2, T2); stats.full++;
        return combine(T2, agl, x, y, z, t, WV);
      }
      const w0 = C.w0, J = C.J;
      for (let c = 0; c < NCHN; c++) T2[c] = w0[c] + J[c * 3] * dx + J[c * 3 + 1] * dy + J[c * 3 + 2] * dz;
      stats.linear++;
      // THE GROUND IS EXACT IN THE SURFACE LAYER: under LIN_GROUND_H of it the power law's curvature
      // and the ground's own (a 65 m octave on the analytic world) make a linearised AGL worth up to
      // a metre — the take-off roll and the final are flown on the true ground, as the legacy field
      // was (one memoised terrainH per call, what every refH preset costs today); above it the
      // ground's plane is within a percent of the wind and costs nothing
      const agl = (C.y - C.g0) < LIN_GROUND_H ? y - terrainH(x, z) : y - (C.g0 + C.gx * dx + C.gz * dz);
      return combine(T2, agl, x, y, z, t, WV);
    }
    // sample(x, y, z, t, out): the full field into `out` (allocated when absent), never the cache
    function sample(x, y, z, t, out) {
      out = out || [0, 0, 0];
      if (mode === 'zero') { out[0] = out[1] = out[2] = 0; return out; }
      if (mode === 'legacy') { const w = windLegacy(x, y, z, t); out[0] = w[0]; out[1] = w[1]; out[2] = w[2]; return out; }
      const agl = y - terrainH(x, z);
      groundAt(x, z, GL2);
      smooth(x, y, z, t, agl, GL2, T2); stats.full++;
      return combine(T2, agl, x, y, z, t, out);
    }
    // reliefAt(x, z, out): the raster's channels at a point, bilinear, clamped at the edge
    const RA = new Float32Array(NCH);
    function reliefAt(x, z, out) {
      const R = ensureRelief(), o = out || RA;
      let u = (x - R.x0) / R.cell - 0.5, v = (z - R.z0) / R.cell - 0.5;
      u = clamp(u, 0, R.nx - 1.001); v = clamp(v, 0, R.nz - 1.001);
      const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
      const k00 = (j * R.nx + i) * NCH, k10 = k00 + NCH, k01 = k00 + R.nx * NCH, k11 = k01 + NCH, d = R.data;
      for (let c = 0; c < NCH; c++) {
        const a = d[k00 + c] + (d[k10 + c] - d[k00 + c]) * fu, b = d[k01 + c] + (d[k11 + c] - d[k01 + c]) * fu;
        o[c] = a + (b - a) * fv;
      }
      return o;
    }
    // surfaceWind(): the 10 m wind the sea and the socks read — the declared base for now (K4 smooths it)
    function surfaceWind() {
      const b = windSpec ? windSpec.base : W0;
      return { spd: Math.hypot(b[0], b[2]), dir: Math.atan2(b[2], b[0]), base: b };
    }
    // ---- THE COLUMN (K2) -----------------------------------------------------
    // One air, asked for twice: the DENSITY comes from the world's own atmos
    // (which is makeAtmos over the day's effective temperature, pressure and
    // column shape, rebuilt lazily on the day's airKey), and the WATER from
    // atmosWater over it. Both are cached on the pair of keys that can move
    // them, so `profile(h)` is a few multiplies in the steady state and the
    // panel can read it every frame.
    let wKey = null, water = null, wAtm = null;
    function waterNow() {
      const atm = env.atmos ? env.atmos() : null;
      const dew = env.day ? env.day.dewC : null;
      const k = (env.day ? env.day.airKey : '-') + '|' + (dew == null ? '-' : Math.round(dew * 100));
      if (k !== wKey || wAtm !== atm) { wKey = k; wAtm = atm; water = atm ? atmosWater(atm, dew) : null; }
      return water;
    }
    // profile(h) -> { T, p, rho, sigma, rh, Td, lcl } at an altitude MSL.
    // HORIZONTALLY UNIFORM, and that is a declared boundary rather than an
    // oversight: this is the COLUMN, the vertical law. A 2-D mist field - where
    // a layer's top sits over valley floors and water, where the patches are -
    // composes with it rather than competing: sample this for the vertical
    // shape at an (x, z) and let the field say where the top of it is.
    function profile(h) {
      const atm = env.atmos ? env.atmos() : null, w = waterNow();
      if (!atm) return null;
      return { T: atm.T(h) - 273.15, p: atm.p(h), rho: atm.rho(h), sigma: atm.sigma(h),
               rh: w ? w.rh(h) : null, Td: w ? w.Td(h) : null, lcl: w ? w.lcl : null,
               mixH: atm.mixH, densityAlt: atm.densityAlt(h) };
    }
    // THE THERMAL'S CEILING (K2, used by K3): the lower of the day's lid and
    // its condensation level. A capped day tops the columns at the lid and
    // makes no cloud; an uncapped one tops them at the base and marks every
    // one with a cumulus. Either way it is ONE number, derived, never declared.
    function mixTop() {
      const atm = env.atmos ? env.atmos() : null, w = waterNow();
      const lid = atm && atm.mixH != null ? atm.mixH : null;
      const lcl = w ? w.lcl : null;
      if (lid == null && lcl == null) return 1200;                  // a fair-weather default, named
      if (lid == null) return lcl;
      if (lcl == null) return lid;
      return Math.min(lid, lcl);
    }
    // haze(): THE INGREDIENTS OF A MIST, not a distance. Koschmieder's law turns
    // a visibility into an extinction, beta = 3.912 / V; the day's own
    // visibilityKm carries the turbidity and the humidity, and a front thickens
    // it. What is published is (rho0, top, H) - the layer itself - and the
    // consumer integrates along ITS OWN ray.
    //
    // TWO WARNINGS FOR WHOEVER CONSUMES THIS, both measured by the fog study
    // (futureDesigns/FOG-MIST-2026-09-21.md) rather than argued:
    //
    // 1. A VISIBILITY IS NOT A RADIUS. The mist is a layer with a lid at `top`,
    //    so how far an eye can see depends on where the eye is and where it is
    //    looking: from 200 m over Jolene the distant GROUND dies at about 4 km
    //    (that ray looks down through the layer) while the RIDGES stand at 5-9
    //    km (their ray never enters it). A far plane or a ring radius sized off
    //    a single surface number escapes by luck at rh 0.85 and shears the
    //    mountains off at rh 0.90. Integrate the ray; that is what these three
    //    numbers are for.
    // 2. THIS NUMBER MOVES DURING A FLIGHT NOW. It used to be a constant per
    //    day; a front takes it 60 -> 26 km over a couple of hours and the
    //    diurnal humidity walks it as well. Any consumer that sizes a STREAMED
    //    thing from it (the forest ring, a far cascade) needs two-radii
    //    hysteresis and a rate limit, or it re-imports the chunk-crossing pop.
    function haze() {
      const day = env.day;
      if (!day) return null;
      const st = stormOf();
      let visKm = day.visibilityKm;
      if (st) visKm *= 1 - 0.55 * st.I;                             // a front's murk, declared
      const w = waterNow();
      return { visibilityKm: visKm, rho0: 3.912 / Math.max(0.05, visKm * 1000),
               top: 60, H: 18, rhSfc: w ? w.rh(0) : null, lcl: w ? w.lcl : null };
    }
    // thermals(): every live column within `r` of a point, as records - what the
    // debug view draws, what a gate flies to, and what a panel counts. Pure in
    // the day's clock, like the field it reads.
    function thermals(x, z, r) {
      const C = convNow();
      if (!C || !rich || !(rich.thermals > 0)) return [];
      const utc = env.day ? env.day.utc : 0;
      const sp = C.spacing, dx0 = C.ux * utc, dz0 = C.uz * utc;
      r = r || 6000;
      const i0 = Math.floor((x - r - dx0) / sp), i1 = Math.floor((x + r - dx0) / sp);
      const j0 = Math.floor((z - r - dz0) / sp), j1 = Math.floor((z + r - dz0) / sp);
      const out = [];
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const c = thermalCell(i, j, C, utc, dx0, dz0, { x: 0, z: 0, k: 0, ok: false });
        if (!c.ok) continue;
        if (Math.hypot(c.x - x, c.z - z) > r) continue;
        const heat = reliefAt(c.x, c.z, RL2)[CH.heat];
        const wstar = C.wstarOf(heat);
        if (!(wstar > 0)) continue;
        const g = terrainH(c.x, c.z);
        // the peak at mid-layer, which is the number a pilot would quote, and the
        // axis THERE - the column leans with the shear, so where you circle is not
        // over where it was born (`x0, z0` is the source on the ground)
        const zr = 0.5, wbar = Math.pow(zr, 1 / 3) * (1 - 1.1 * zr);
        const mid = 0.5 * C.zi;
        const kz = windSpec.refH ? Math.pow(Math.min(WIND_TOP_H, Math.max(0.2, mid)) / windSpec.refH, windSpec.alpha) : 1;
        const lag = Math.min(900, mid / C.wRef);
        out.push({ i, j, x: c.x + (C.bx * kz - C.ux) * lag, z: c.z + (C.bz * kz - C.uz) * lag,
                   x0: c.x, z0: c.z, ground: g, zi: C.zi, top: g + C.zi, mid: g + mid, k: c.k, wstar,
                   wpk: TH_CORE * wbar * wstar * c.k,
                   r2: Math.max(20, TH_R2K * Math.pow(zr, 1 / 3) * (1 - 0.25 * zr) * C.zi) });
      }
      out.sort((a, b) => (b.wpk - a.wpk) || (a.x - b.x) || (a.z - b.z));
      return out;
    }
    // refresh(): the viewer's tick calls this when the DAY's clock has moved,
    // so a front's veer and rise reach the wind. Pure: re-resolving the
    // declared spec against the day as it now is. A day with no front and no
    // swing re-resolves to exactly the same numbers.
    function refresh() { if (spec0) setWind(spec0); }
    return {
      setWind, wind, sample, reliefAt, ensureRelief, surfaceWind,
      profile, mixTop, haze, refresh, thermals, get water() { return waterNow(); },
      get conv() { return convNow(); },
      get mode() { return mode; }, get spec() { return windSpec; }, get rich() { return rich; },
      get relief() { return relief; }, get version() { return version; }, stats,
    };
  }
  return { make, bearingToBase, buildRelief, fnv, CH, NCH, CELL, GC, WIND_TOP_H, WIND_ALPHA, GRAD_H, KT };
})();
if (typeof module !== 'undefined' && module.exports && !module.exports.makeWorld) module.exports = CLIMATE;
