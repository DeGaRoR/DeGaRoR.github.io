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
    function setWind(spec) {
      if (!spec) { windSpec = null; rich = null; mode = 'zero'; stats.mode = mode; version++; return { base: [0, 0, 0], spd: 0 }; }
      let base;
      if (spec.base) base = spec.base;
      else if (spec.mps != null || spec.kts != null)
        base = bearingToBase(spec.mps != null ? +spec.mps : +spec.kts * KT, spec.dirDeg, geo ? geo.convergenceDeg : 0);
      else base = [0, 0, 0];
      windSpec = { base, gust: spec.gust || 0, refH: spec.refH || 0,
                   alpha: spec.alpha != null ? spec.alpha : WIND_ALPHA };
      const isRich = (spec.terrain > 0) || (spec.breeze > 0) || (spec.thermals > 0) || spec.aloftK != null || spec.veerDeg != null;
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
      out[0] = ux; out[1] = uy; out[2] = uz;
      out[3] = 0; out[4] = 0; out[5] = 0;
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
    return {
      setWind, wind, sample, reliefAt, ensureRelief, surfaceWind,
      get mode() { return mode; }, get spec() { return windSpec; }, get rich() { return rich; },
      get relief() { return relief; }, get version() { return version; }, stats,
    };
  }
  return { make, bearingToBase, buildRelief, fnv, CH, NCH, CELL, GC, WIND_TOP_H, WIND_ALPHA, GRAD_H, KT };
})();
if (typeof module !== 'undefined' && module.exports && !module.exports.makeWorld) module.exports = CLIMATE;
