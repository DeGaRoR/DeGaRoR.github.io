// ============================================================
// THE SOIL'S WETNESS (DIRT-DUST, 2026-11-09) - how wet the top of the ground is, a pure function of the instant.
// The user (9 Nov): "when it's really dry, there are huge puffs of dirt clouds ... at every take-off and landing";
// when it is wet, little or no dust and mud off the puddles instead. The day knows the rain NOW (07d_weather_plan.js
// meta.rain) and nothing of the rain that fell yesterday; this is that memory, without state.
//
// THE MODEL: a bucket. The top 1-2 cm of the ground (what a tyre or a prop's blast can lift) holds CAP mm of water
// at saturation; S = held / CAP, 0 bone dry .. 1 saturated. Per hour of the weather plan:
//   IN     the rain, R = 12 rain^1.5 mm/h (the plan's own rain law, 07d surfaceVisKm), into what is not yet full: R (1 - S)
//   OUT    evaporation at the potential rate (a two-term Penman reduced to what the day knows: the sun's share,
//          sin(elevation) x the clouds' (1 - 0.75 cover), and the air's, the vapour-pressure deficit x the wind),
//          slowed as the surface dries (stage-2 drying: S / (S + 0.15)), and damped while it rains (the air is wet)
//   DRAIN  what soaks down, k S an hour: sand at once, a compacted dirt strip slowly, a turf's thatch holds it
//   BELOW  a second store under it (SUB_CAP mm, the root zone's top): the rain the top cannot take and what drains from
//          it fill it, it drains away slowly (deeper), and it RE-WETS THE TOP by capillary rise when it is the wetter -
//          so a soaked strip dries on top through a sunny afternoon and is damp again the next morning, for a day or two
// integrated over the WINDOW (96 h before the instant) from a dry start, four steps an hour, so the answer depends
// on the instant alone: the page, the physics worker and a gate compute the same number with no message. A storm
// (12 mm/h at its peak) soaks every class; a clear summer day after it dries a dirt strip to dust by the evening,
// sand by noon, turf by the next day - INFERRED from the drying literature's orders of magnitude (stage-1 rates
// 0.3-0.6 mm/h under a high sun, stage 2 a few times slower), not measured here.
//
// THE CLASSES are the pavement's loose ones (the runway record's `look`): dirt, sand, gravel, grass. The paved ones
// do not hold water in this sense (their film is pavement.js's `wet`) and read the dirt row.
//
// WITHOUT A PLAN (the sandbox's declared weather): the rain now (day.rain, 0 unless a spec says) and the air's
// humidity stand in - a saturated morning is damp, a dry afternoon dust. SOIL_WET.force (a number, or null) holds
// any instant at a chosen wetness: the bench's and the rigs' lever, never saved.
//
//   SOIL_WET.at(day) -> R (ONE object, reused: read it, do not keep it):
//     R.wet       0..1  the dirt class's S (the strip's default; DIRT-STRIP's puddle fill and damp tint read this)
//     R.cls       { dirt, sand, gravel, grass } each class's S
//     R.rainNow   0..1  the plan's rain at the instant
//     R.hoursDry  h     since the rain last fell harder than 0.2 mm/h (96 = not inside the window)
//     R.mud       0..1  how much of the dirt class is mud (smoothstep 0.55 .. 0.9 of S)
//     R.src       'plan' | 'sandbox' | 'force'
//   SOIL_WET.CLASS    the classes' CAP (mm), DRAIN (/h), DRY (x the potential rate)
// Pure in (day.jdn, day.utc, day.geo, day.planSpec): no Date, no THREE, no random. The hours' weather is cached by
// the hour (a bounded map), the window's result by the hour pair - a frame's call is an interpolation. GATE SOILWET.
// ============================================================
var SOIL_WET = (function () {
  'use strict';
  const CLASS = Object.freeze({
    dirt:   Object.freeze({ cap: 6,  drain: 0.04, dry: 1.0, deep: 0.012, rise: 0.06 }),
    sand:   Object.freeze({ cap: 3,  drain: 0.30, dry: 1.4, deep: 0.05,  rise: 0.02 }),
    gravel: Object.freeze({ cap: 4,  drain: 0.15, dry: 1.2, deep: 0.03,  rise: 0.03 }),
    grass:  Object.freeze({ cap: 10, drain: 0.03, dry: 0.6, deep: 0.010, rise: 0.06 }),
  });
  const KEYS = ['dirt', 'sand', 'gravel', 'grass'];
  const WINDOW_H = 96, SUB = 4, S0 = 0.05, D0 = 0.1, SUB_CAP = 30, WET_RAIN_MM = 0.2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const es = T => 0.6108 * Math.exp(17.27 * T / (T + 237.3));        // kPa, Tetens
  const rainMm = r => 12 * Math.pow(clamp(r || 0, 0, 1), 1.5);        // 07d's law

  // ---- one hour's weather off the plan, cached by the absolute hour ------------------------------------------------
  const HC = new Map(), HC_MAX = 400;
  function hourWx(k, geo) {
    const key = k + '|' + geo.lat + '|' + geo.lon;
    let h = HC.get(key);
    if (h) return h;
    const j = Math.floor(k / 24), utc = k * 3600 - j * 86400;
    const P = WEATHER_PLAN.at(j, utc, geo), sp = P.spec;
    const el = SOLAR.sun({ jdn: j, utc, lat: geo.lat, lon: geo.lon }).el;
    const T = +sp.oatC || 10, Td = Math.min(T, sp.dewC != null ? +sp.dewC : T - 4);
    const wMs = sp.wind && sp.wind.kts != null ? +sp.wind.kts * 0.514444 : 0;
    const rad = Math.max(0, Math.sin(el * Math.PI / 180)) * (1 - 0.75 * clamp(+sp.cloudCover || 0, 0, 1));
    const vpd = Math.max(0, es(T) - es(Td));
    const rain = clamp(P.meta.rain || 0, 0, 1);
    // the potential rate, mm/h: the sun's term (0.55 mm/h under a clear high sun) and the air's (VPD x the wind)
    const pet = (0.55 * rad + 0.05 * vpd * (1 + 0.25 * wMs)) * (1 - 0.85 * rain);
    h = { R: rainMm(rain), pet, rain };
    if (HC.size >= HC_MAX) HC.delete(HC.keys().next().value);
    HC.set(key, h);
    return h;
  }
  // ---- the window integrated to the START of hour H (exclusive), every class -----------------------------------------
  // out: [S per class..., D per class..., hours dry]
  function windowAt(H, geo, out) {
    const NK = KEYS.length;
    for (let c = 0; c < NK; c++) { out[c] = S0; out[NK + c] = D0; }
    let dryH = WINDOW_H;
    for (let k = H - WINDOW_H; k < H; k++) {
      const w = hourWx(k, geo), dt = 1 / SUB;
      if (w.R > WET_RAIN_MM) dryH = H - 1 - k;
      for (let c = 0; c < NK; c++) {
        const C = CLASS[KEYS[c]];
        let S = out[c], D = out[NK + c];
        for (let s = 0; s < SUB; s++) {
          // mm/h: the rain the top takes and what it passes down, the top's drain, the deep drain, the capillary rise
          const rinT = w.R * (1 - S), rinD = w.R * S, dr = C.drain * S * C.cap, dp = C.deep * D * SUB_CAP;
          const up = C.rise * C.cap * Math.max(0, D - S), ev = w.pet * C.dry * (S / (S + 0.15));
          S = clamp(S + (rinT - dr - ev + up) / C.cap * dt, 0, 1);
          D = clamp(D + ((rinD + dr) * (1 - D) - dp - up) / SUB_CAP * dt, 0, 1);
        }
        out[c] = S; out[NK + c] = D;
      }
    }
    out[2 * NK] = dryH;
    return out;
  }
  const WC = { H: NaN, geoKey: '', a: new Float64Array(2 * KEYS.length + 1), b: new Float64Array(2 * KEYS.length + 1) };
  const R = { wet: 0, cls: { dirt: 0, sand: 0, gravel: 0, grass: 0 }, rainNow: 0, hoursDry: WINDOW_H, mud: 0, src: 'sandbox' };
  function fill(src, rainNow, hoursDry) {
    R.wet = R.cls.dirt; R.rainNow = rainNow; R.hoursDry = hoursDry; R.mud = smooth(0.55, 0.9, R.wet); R.src = src;
    return R;
  }
  function at(day) {
    const F = API.force;
    if (F != null && isFinite(+F)) {
      const v = clamp(+F, 0, 1);
      for (const k of KEYS) R.cls[k] = v;
      return fill('force', 0, v > 0.3 ? 0 : WINDOW_H);
    }
    if (!day) { for (const k of KEYS) R.cls[k] = S0; return fill('sandbox', 0, WINDOW_H); }
    const rainNow = clamp(+day.rain || 0, 0, 1);
    if (!day.planSpec || typeof WEATHER_PLAN === 'undefined' || typeof SOLAR === 'undefined') {
      // the sandbox: the rain now, and a saturated air's dew on the ground
      const damp = 0.45 * smooth(0.8, 1.0, +day.rh || 0);
      for (const k of KEYS) { const C = CLASS[k]; R.cls[k] = clamp(S0 + damp * (C.cap / 6) * (1 / C.dry) * 0.6 + rainNow * 1.2, 0, 1); }
      return fill('sandbox', rainNow, rainNow > 0.05 ? 0 : WINDOW_H);
    }
    const geo = day.geo, abs = day.jdn * 86400 + day.utc, Hf = abs / 3600, H = Math.floor(Hf), f = Hf - H;
    const gk = geo.lat + '|' + geo.lon;
    if (WC.H !== H || WC.geoKey !== gk) {
      if (WC.H === H - 1 && WC.geoKey === gk) { const t = WC.a; WC.a = WC.b; WC.b = t; windowAt(H + 1, geo, WC.b); }
      else { windowAt(H, geo, WC.a); windowAt(H + 1, geo, WC.b); }
      WC.H = H; WC.geoKey = gk;
    }
    for (let c = 0; c < KEYS.length; c++) R.cls[KEYS[c]] = WC.a[c] + (WC.b[c] - WC.a[c]) * f;
    const dA = WC.a[2 * KEYS.length], dB = WC.b[2 * KEYS.length];
    return fill('plan', rainNow, dB === 0 ? 0 : Math.min(WINDOW_H, dA + f));
  }
  // the class a loose surface reads (a paved or unknown look reads dirt's)
  function ofLook(R0, look) { return R0.cls[look] != null ? R0.cls[look] : R0.cls.dirt; }
  const API = { at, ofLook, CLASS, KEYS, WINDOW_H, force: null, _clear() { HC.clear(); WC.H = NaN; } };
  return API;
})();
