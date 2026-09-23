// ============================================================
// THE DAY — one object that is everything a day is (SKY S1, 2026-09-14).
//
// The physics already had a day: setWeather({ oatC, qnhPa, wind }) makes the
// air (05_atmos) and the wind, read live by the solver. The sky had none — a
// constant sun vector. The rule (SKY-ATMOSPHERE §1, the user's own): EXTEND
// THE DAY, NEVER ADD A SECOND ONE. So this object carries
//
//   WHEN     date + utc seconds, and a rate (0 = frozen, 1 = real, 60 = a
//            minute a second); it ADVANCES only when the viewer ticks it —
//            the solver never does (the gate battery is deterministic)
//   WHERE    the world's geo: lat, lon (east +), tz, grid convergence
//   AIR      oatC | dISA, qnhPa — THE SAME FIELDS makeAtmos reads, plus (K2)
//            the SHAPE of the column: lapse ('isa' | 'mixed'), mixH, inversion
//   WEATHER  wind (the climate's spec), storm (a front on the clock),
//            diurnalC (the day's own temperature swing) — CLIMATE K2
//   WATER    dewC or rh          -> the dewpoint, the cloud base, the haze
//   AEROSOL  turbidity, ozone, groundAlbedo -> what the atmosphere looks like
//   CLOUD    cover, type          (a data slot: the cloud chantier draws them)
//
// and DERIVES, never declares, the sun and moon (06_solar), the twilight
// class, the cloud base (125 m per degree of dewpoint spread), a visibility.
// `version` bumps on every set() and never on advance(), so a consumer that
// re-bakes on a change (the atmosphere's LUTs) is not re-baking every frame.
//
// Never the wall clock: the default is 2026-06-21 18:00 UT — 10:00 AKDT on
// the summer solstice — so a screenshot, a fixture and a gate all see the
// same sun until somebody sets another. No Date, no THREE, no DOM.
// ============================================================
var DAY = (function () {
  'use strict';
  const DEFAULT = Object.freeze({
    date: '2026-06-21', utc: 18 * 3600, rate: 1,
    rh: 0.5, turbidity: 2.5, ozone: 300, groundAlbedo: 0.15,
    // THE SKY'S SEED IS THE DAY'S (CLIMATE K3): the renderer draws the weather
    // map from it and the climate reads the SAME map to know where the cumulus
    // are - a thermal sits under a cloud because they are one field, not two.
    cloudCover: 0.2, cloudType: 'cu', cloudSeed: 1,
  });
  // the geo a world declares; this default is Jolene's origin (28_island.js)
  // with NO convergence — the analytic world's own -z is true north
  const GEO_DEFAULT = Object.freeze({ lat: 55.04327, lon: -131.57222, convergenceDeg: 0,
                                      tz: { std: -9, dst: 'us', name: 'AKST', dstName: 'AKDT' } });
  // THE AIR IS WHAT makeAtmos READS, and since K2 that includes the column's
  // SHAPE: a mixed layer under a lid is as much a fact about the day's air as
  // its temperature. Listed here so that `air()` carries them and the world
  // rebuilds `atmos` when — and only when — one of them moves.
  // NOT the humidity: it does not change the density (a declared cut of
  // 05_atmos), and GATE DAY holds that moving it leaves `world.atmos` the SAME
  // object. The water rides beside the column, through atmosWater.
  const AIR_KEYS = ['oatC', 'dISA', 'qnhPa', 'lapse', 'mixH', 'inversion'];
  // A FRONT ON THE CLOCK (K2). Declared: `storm: { at, pre, dur, post, windK,
  // gustK, veerDeg, dTemp, dQnh, cover, type }` — `at` the UT second the front
  // passes, `pre`/`dur`/`post` its approach, passage and clearance in seconds.
  // The intensity I(utc) rises smoothly over `pre`, holds through `dur`, falls
  // over `post`; everything else is I times a declared amount, so a storm with
  // no fields moves nothing and `storm: null` is exactly today's day.
  const STORM_D = Object.freeze({ pre: 5400, dur: 2700, post: 7200, windK: 2.2, gustK: 2.5,
                                  veerDeg: 55, dTemp: -6, dQnh: -900, cover: 0.95, type: 'cb' });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad2 = n => String(n).padStart(2, '0');

  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
    if (!m) throw new Error('day: date must be YYYY-MM-DD, got ' + s);
    return SOLAR.jdn(+m[1], +m[2], +m[3]);
  }
  const dateOf = j => { const c = SOLAR.civil(j); return c.y + '-' + pad2(c.m) + '-' + pad2(c.d); };
  const dow = j => (j + 1) % 7;                        // 0 = Sunday
  // the US rule: second Sunday of March 02:00 standard -> first Sunday of November 02:00 daylight
  function usDst(j, utc, std) {
    const y = SOLAR.civil(j).y;
    const mar1 = SOLAR.jdn(y, 3, 1), nov1 = SOLAR.jdn(y, 11, 1);
    const start = mar1 + ((7 - dow(mar1)) % 7) + 7;   // second Sunday
    const end = nov1 + ((7 - dow(nov1)) % 7);         // first Sunday
    const t = j + utc / 86400;                          // UT instant as a day fraction
    return t >= start + (2 - std) / 24 && t < end + (2 - (std + 1)) / 24;
  }
  // Magnus (a 17.625, b 243.04 °C): dewpoint from relative humidity
  function dewFromRh(T, rh) { const g = Math.log(clamp(rh, 0.01, 1)) + 17.625 * T / (243.04 + T); return 243.04 * g / (17.625 - g); }
  function rhFromDew(T, Td) { return clamp(Math.exp(17.625 * Td / (243.04 + Td) - 17.625 * T / (243.04 + T)), 0, 1); }

  function makeDay(spec0, geo0) {
    const geo = Object.assign({}, GEO_DEFAULT, geo0 || {});
    const s = {};                                        // the declared spec (what round-trips)
    let jdn = 0, utc = 0, version = 0;
    const d = {};                                        // the derived block, rebuilt by recompute()
    let sunCache = null;

    function recompute() {
      const o = { jdn, utc, lat: geo.lat, lon: geo.lon };
      const su = SOLAR.sun(o), mo = SOLAR.moon(o);
      const conv = geo.convergenceDeg || 0;
      d.sunEl = su.el; d.sunAz = su.az; d.sunAzGrid = ((su.az - conv) % 360 + 360) % 360;
      d.sun = SOLAR.toFrame(su.el, su.az, conv);
      d.rigAzim = SOLAR.rigAzim(su.az, conv);
      d.sunUp = su.el >= -0.833;
      d.illumClass = su.el >= -0.833 ? 'day' : su.el >= -6 ? 'civil' : su.el >= -12 ? 'nautical' : su.el >= -18 ? 'astro' : 'night';
      d.isNight = su.el < -6;
      d.moonEl = mo.el; d.moonAz = mo.az; d.moonPhase = mo.phase; d.moonWaxing = mo.waxing;
      d.moon = SOLAR.toFrame(mo.el, mo.az, conv);
      d.moonUp = mo.el >= 0;
      // THE GROUND RUNS BEHIND THE SUN (CLIMATE K3). What drives the thermals is
      // not the sun's elevation now but the heat the ground has taken in, which
      // peaks about two hours later. One more call on the same pure almanac -
      // no state, no integration, and a gate's frozen day freezes this with it.
      d.sunElLag = SOLAR.sun({ jdn, utc: utc - 7200, lat: geo.lat, lon: geo.lon }).el;
      if (!sunCache || sunCache.jdn !== jdn) {          // the day's events, once per civil day
        const ev = SOLAR.events(o);
        sunCache = { jdn, noonUtc: ev.noon, sunriseUtc: ev.rise, sunsetUtc: ev.set, polar: ev.rise == null ? (ev.up ? 'day' : 'night') : null };
      }
      d.noonUtc = sunCache.noonUtc; d.sunriseUtc = sunCache.sunriseUtc; d.sunsetUtc = sunCache.sunsetUtc; d.polar = sunCache.polar;
      // ---- THE FRONT (K2): where the day is in it, and what that does -------
      // Pure in `utc`: a gate that never advances the clock sees a frozen
      // front, and the viewer's clock walks it. The phase is named as well as
      // the number so a panel can say "the front arrives" without arithmetic.
      const st = s.storm || null;
      if (st && st.at != null) {
        const pre = st.pre != null ? +st.pre : STORM_D.pre;
        const dur = st.dur != null ? +st.dur : STORM_D.dur;
        const post = st.post != null ? +st.post : STORM_D.post;
        const at = +st.at, t = utc;
        const I0 = st.intensity != null ? clamp(+st.intensity, 0, 1) : 1;
        const smf = x => { const q = clamp(x, 0, 1); return q * q * (3 - 2 * q); };
        let I = 0, phase = 'none';
        if (t < at - pre) { I = 0; phase = 'none'; }
        else if (t < at) { I = smf((t - (at - pre)) / pre); phase = 'pre'; }
        else if (t < at + dur) { I = 1; phase = 'passage'; }
        else if (t < at + dur + post) { I = 1 - smf((t - (at + dur)) / post); phase = 'post'; }
        d.storm = { I: I * I0, phase, at, pre, dur, post,
                    windK: 1 + (( st.windK != null ? +st.windK : STORM_D.windK) - 1) * I * I0,
                    gustK: 1 + (( st.gustK != null ? +st.gustK : STORM_D.gustK) - 1) * I * I0,
                    // the wind VEERS through the passage, not through the approach
                    veer: (st.veerDeg != null ? +st.veerDeg : STORM_D.veerDeg) * I0
                          * smf((t - (at - pre * 0.25)) / (dur + pre * 0.25)),
                    dTemp: (st.dTemp != null ? +st.dTemp : STORM_D.dTemp) * I0 * (t > at ? 1 : 0) * I,
                    dQnh: (st.dQnh != null ? +st.dQnh : STORM_D.dQnh) * I0 * I,
                    cover: st.cover != null ? +st.cover : STORM_D.cover,
                    type: st.type || STORM_D.type,
                    inS: at - t };
      } else d.storm = null;
      // the air and the water
      // THE DIURNAL SWING (K2): `diurnalC` is the day's peak-to-peak range, and
      // the declared oatC is its MEAN, so diurnalC 0 - the default - leaves
      // every existing day exactly where it was. The curve is a cosine peaking
      // three hours after solar noon (the lag of the ground's own heat); a
      // named cut, the real curve is asymmetric with a sharp post-dawn rise.
      let T = s.oatC != null ? s.oatC : 15 + (s.dISA || 0);
      const swing = s.diurnalC != null ? +s.diurnalC : 0;
      if (swing > 0) {
        const peak = (d.noonUtc != null ? d.noonUtc : 43200) + 3 * 3600;
        T += 0.5 * swing * Math.cos(2 * Math.PI * (utc - peak) / 86400);
      }
      if (d.storm) T += d.storm.dTemp;
      d.oatEff = T;
      d.qnhEff = (s.qnhPa != null ? s.qnhPa : 101325) + (d.storm ? d.storm.dQnh : 0);
      const Td = s.dewC != null ? s.dewC : dewFromRh(T, s.rh != null ? s.rh : DEFAULT.rh);
      d.oatC = T; d.dewC = Td; d.rh = s.dewC != null ? rhFromDew(T, Td) : (s.rh != null ? s.rh : DEFAULT.rh);
      // THE BASE MOVES ONLY WHEN THE DAY MOVES IT, and then it is QUANTISED to
      // 20 m: the cloud renderer keys its weather-map fit on the deck's base
      // (clouds.js layKey) and re-fits over a dozen frames whenever it changes,
      // so a base creeping by centimetres with the diurnal swing would re-fit
      // the sky every frame. A still day is bit-identical to before.
      const baseRaw = clamp(125 * (T - Td), 0, 6000);
      d.cloudBase = (swing > 0 || d.storm) ? Math.round(baseRaw / 20) * 20 : baseRaw;
      // what the sky is doing, the front included (the renderer reads these)
      d.cloudCoverEff = d.storm && d.storm.I > 0
        ? Math.max(day.cloudCover, day.cloudCover + (d.storm.cover - day.cloudCover) * d.storm.I)
        : day.cloudCover;
      d.cloudTypeEff = d.storm && d.storm.I > 0.5 ? d.storm.type : day.cloudType;
      // THE AIR KEY: one number that changes when — and only when — something
      // makeAtmos reads has moved. The world rebuilds `atmos` on it, lazily, so
      // a clock tick through a swing or a front makes new air without a
      // version bump (GATE DAY: a VISUAL change leaves atmos the SAME object).
      d.airKey = Math.round(T * 1000) + ':' + Math.round(d.qnhEff * 10) + ':' + (s.lapse || 'isa')
               + ':' + (s.mixH != null ? Math.round(s.mixH) : '-')
               + ':' + (s.inversion ? Math.round((s.inversion.dT || 0) * 100) + '/' + Math.round(s.inversion.thick || 0) : '-');
      // NOT the humidity (see AIR_KEYS)
      // an AUTHORED visibility: clear alpine air 60 km, a hazy T10 day 4 km, saturated air a sixth of that
      const tb = s.turbidity != null ? s.turbidity : DEFAULT.turbidity;
      d.visibilityKm = 375 / (tb * tb) * (1 - 0.85 * Math.pow(clamp((d.rh - 0.7) / 0.3, 0, 1), 2));
      // TWO NUMBERS OUT OF ONE HUMIDITY, AND THEY ARE NOT THE SAME MEDIUM. They sit
      // together deliberately, because keeping them apart is what went wrong before:
      // `visibilityKm` above is the COLUMN - the whole air, aerosol spread through the
      // boundary layer and above it, roughly uniform over kilometres, and the number a
      // Koschmieder extinction is calibrated from. `mistRho0` is the IN-LAYER density of
      // a shallow ground fog: droplets, tens of metres deep, absent above its lid. At
      // rh 0.90 the column gives 1.05e-4 /m and the layer 1.11e-3 - ten times denser -
      // and that is not a disagreement to reconcile, it is two media. A ray's
      // transmittance is the product of both, so an eye at the surface sees the SUM of
      // the extinctions (climate.haze().surfaceVisM), while an eye above the lid looking
      // at a ridge sees only the column. The renderer owns where the layer LIES (its top
      // follows the valley floors, it has banks); the day owns only how dense the air
      // makes it. One law, one place - atmo.js reads this and no longer carries a copy.
      // ...and THE MORNING TAKES IT AWAY (FOG-MIST F3c). Radiation fog forms under a clear
      // night and thins as the ground gives back the heat it has been taking - so the term
      // is the LAGGED sun, `sunElLag` (the elevation two hours ago, K3), not the sun now:
      // the fog does not thin because the sun is up, it thins because the GROUND has been
      // warming for a while. Using the lag rather than an hours-since-sunrise count is what
      // makes the poles fall out of the arithmetic instead of needing branches - polar night
      // keeps the lagged sun under 5 deg all day so `burn` is 0, polar day keeps it above so
      // burn proceeds on elevation alone, and there is no `sunriseUtc` to be null. An
      // overcast holds the fog in: no sun on the ground, nothing given back.
      // It multiplies the LAYER only. The column must not take it or the morning is counted
      // twice - `visibilityKm` is a function of `rh`, and `rh` already falls as diurnalC warms
      // the day against a fixed dew point, which is the same sunrise clearing the same haze.
      // `cloudCoverEff`, not `cloudCover`: the latter is not on the derived day at all (it is the
      // spec's), so it would have read undefined and the overcast term would have been silently
      // dead - the third time today that shape has come up. The effective one is the right input
      // anyway: a storm's overcast holds the fog in exactly as a fair-weather deck does.
      const cov = clamp(d.cloudCoverEff != null ? d.cloudCoverEff : 0, 0, 1);
      const burn = clamp((d.sunElLag - 5) / 20, 0, 1) * (1 - cov);
      d.mistBurn = burn;
      d.mistRho0 = 0.0025 * Math.pow(clamp((d.rh - 0.7) / 0.3, 0, 1), 2) * Math.max(0, 1 - burn);
      // local time
      const std = geo.tz ? geo.tz.std : 0;
      const dst = geo.tz && geo.tz.dst === 'us' ? usDst(jdn, utc, std) : false;
      d.offsetH = std + (dst ? 1 : 0);
      let ls = utc + d.offsetH * 3600, lj = jdn;
      if (ls < 0) { ls += 86400; lj--; } else if (ls >= 86400) { ls -= 86400; lj++; }
      d.localSeconds = ls; d.localDate = dateOf(lj);
      d.local = d.localDate + ' ' + pad2(Math.floor(ls / 3600)) + ':' + pad2(Math.floor(ls / 60) % 60) + ':' + pad2(Math.floor(ls) % 60)
              + ' ' + (geo.tz ? (dst ? geo.tz.dstName || 'DST' : geo.tz.name || ('UTC' + (std >= 0 ? '+' : '') + std)) : 'UTC');
      d.tzLabel = geo.tz ? (dst ? geo.tz.dstName || 'DST' : geo.tz.name || 'UTC') : 'UTC';
    }

    // set(spec) -> true when an AIR field changed (the world rebuilds atmos then, and only then)
    function set(spec) {
      const p = spec || {};
      let airChanged = false;
      for (const k of Object.keys(p)) {
        const v = p[k];
        if (k === 'date') { jdn = parseDate(v); s.date = v; sunCache = null; }
        else if (k === 'utc') { utc = +v; }
        else if (k === 'localHours') { /* below, needs the offset */ }
        else if (k === 'rate') { s.rate = +v; }
        else if (AIR_KEYS.includes(k)) { if (s[k] !== v) airChanged = true; if (v == null) delete s[k]; else s[k] = v; }
        else if (k === 'rh' || k === 'dewC') { delete s.rh; delete s.dewC; if (v != null) s[k] = v; }   // one fact, two spellings
        else if (v == null) delete s[k];
        else s[k] = v;
      }
      if (p.localHours != null) {                          // set by the local clock on the current date
        recompute();
        utc = p.localHours * 3600 - d.offsetH * 3600;
      }
      // normalise the instant onto a civil day
      while (utc < 0) { utc += 86400; jdn--; }
      while (utc >= 86400) { utc -= 86400; jdn++; }
      s.date = dateOf(jdn); s.utc = utc;
      version++;
      recompute();
      return airChanged;
    }
    // advance(dt seconds of play): the clock. Never bumps the version.
    function advance(dt) {
      const r = s.rate != null ? s.rate : 1;
      if (!(r > 0) || !(dt > 0)) return;
      utc += dt * r;
      while (utc >= 86400) { utc -= 86400; jdn++; }
      s.date = dateOf(jdn); s.utc = utc;
      recompute();
    }
    // air(): what makeAtmos reads — the EFFECTIVE temperature and pressure (the
    // swing and the front are already in them), the column's shape, and the
    // water it needs for the dew point and the condensation level.
    const air = () => {
      const a = {};
      for (const k of AIR_KEYS) if (s[k] != null) a[k] = s[k];
      if (s.oatC != null || s.diurnalC > 0 || d.storm) a.oatC = d.oatEff;
      if (s.qnhPa != null || d.storm) a.qnhPa = d.qnhEff;
      if (a.oatC != null) delete a.dISA;              // one temperature, not two
      return a;
    };

    const day = {
      set, advance,
      spec: () => { const o = {}; for (const k of Object.keys(s).sort()) o[k] = s[k]; return JSON.parse(JSON.stringify(o)); },
      air, get hasAir() { return AIR_KEYS.some(k => s[k] != null) || s.diurnalC > 0 || !!s.storm; },
      // K2: the declared weather, for the panel and the URL
      get wind() { return s.wind || null; },
      get stormSpec() { return s.storm || null; },
      get diurnalC() { return s.diurnalC != null ? +s.diurnalC : 0; },
      // K4: how long the sea takes to answer the wind (0 = at once, as it always was)
      get seaTau() { return s.seaTau != null ? Math.max(0, +s.seaTau) : 0; },
      get version() { return version; },
      get geo() { return geo; },
      get date() { return s.date; }, get utc() { return utc; }, get jdn() { return jdn; },
      get jd() { return SOLAR.jd(jdn, utc); },
      get rate() { return s.rate != null ? s.rate : 1; },
      get turbidity() { return s.turbidity != null ? s.turbidity : DEFAULT.turbidity; },
      get ozone() { return s.ozone != null ? s.ozone : DEFAULT.ozone; },
      get groundAlbedo() { return s.groundAlbedo != null ? s.groundAlbedo : DEFAULT.groundAlbedo; },
      get cloudCover() { return s.cloudCover != null ? s.cloudCover : DEFAULT.cloudCover; },
      get cloudType() { return s.cloudType || DEFAULT.cloudType; },
      get cloudSeed() { return s.cloudSeed != null ? (s.cloudSeed | 0) : DEFAULT.cloudSeed; },
      // THE UPPER DECKS (A6, 2026-09-20): [{ cover, type, base? }] above the low layer - at most two, sanitised
      // (a cover clamped, a base a number or absent); cloudLayers puts the low layer first, the field
      // (08_cloud_field.js layers()) stacks them without overlap
      get cloudUpper() {
        const u = Array.isArray(s.cloudUpper) ? s.cloudUpper : [];
        return u.slice(0, 2).map(o => { const r = { cover: clamp(+(o && o.cover) || 0, 0, 1), type: String((o && o.type) || 'ac') };
          if (o && o.base != null && isFinite(+o.base)) r.base = +o.base; if (o && o.thick != null && +o.thick > 0) r.thick = +o.thick; return r; });
      },
      get cloudLayers() { return [{ cover: day.cloudCover, type: day.cloudType, base: d.cloudBase }].concat(day.cloudUpper); },
      get qnhPa() { return s.qnhPa != null ? s.qnhPa : 101325; },
      // utcFor(elDeg, rising) — the UT second on THIS civil day when the sun crosses an
      // elevation (bisection on the monotone half-day); null when it never does.
      // The presets (dawn, golden, dusk...) are built on it by the clock.
      utcFor(elDeg, rising) {
        const o = { jdn, lat: geo.lat, lon: geo.lon };
        const el = u => SOLAR.sun(Object.assign({ utc: u }, o)).el;
        const noon = d.noonUtc;
        let a = rising ? noon - 43200 : noon, b = rising ? noon : noon + 43200;   // the half-day, in UT seconds (may leave the civil day)
        const fa = el(a) - elDeg, fb = el(b) - elDeg;
        if (fa * fb > 0) return null;
        let lo = a, hi = b, flo = fa;
        for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, fm = el(m) - elDeg; if (fm * flo <= 0) hi = m; else { lo = m; flo = fm; } }
        return (lo + hi) / 2;
      },
    };
    // the derived block as read-only getters
    for (const k of ['sun', 'sunEl', 'sunAz', 'sunAzGrid', 'rigAzim', 'sunUp', 'illumClass', 'isNight',
                     'moon', 'moonEl', 'moonAz', 'moonPhase', 'moonWaxing', 'moonUp',
                     'noonUtc', 'sunriseUtc', 'sunsetUtc', 'polar',
                     'oatC', 'dewC', 'rh', 'cloudBase', 'visibilityKm', 'mistRho0',
                     'storm', 'qnhEff', 'airKey', 'cloudCoverEff', 'cloudTypeEff',   // K2
                     'sunElLag',                                                       // K3
                     'mistBurn',                                                       // F3c: how much of the layer the morning has taken
                     'offsetH', 'localSeconds', 'localDate', 'local', 'tzLabel']) {
      Object.defineProperty(day, k, { get: () => d[k], enumerable: true });
    }
    set(Object.assign({}, DEFAULT, spec0 || {}));
    version = 0;
    return day;
  }

  return { makeDay, DEFAULT, GEO_DEFAULT, dewFromRh, rhFromDew, usDst };
})();
if (typeof module !== 'undefined' && module.exports && !module.exports.makeWorld) module.exports = DAY;
