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
//   AIR      oatC | dISA, qnhPa — THE SAME FIELDS makeAtmos reads
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
    cloudCover: 0.2, cloudType: 'cu',
  });
  // the geo a world declares; this default is Jolene's origin (28_island.js)
  // with NO convergence — the analytic world's own -z is true north
  const GEO_DEFAULT = Object.freeze({ lat: 55.04327, lon: -131.57222, convergenceDeg: 0,
                                      tz: { std: -9, dst: 'us', name: 'AKST', dstName: 'AKDT' } });
  const AIR_KEYS = ['oatC', 'dISA', 'qnhPa'];
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
      if (!sunCache || sunCache.jdn !== jdn) {          // the day's events, once per civil day
        const ev = SOLAR.events(o);
        sunCache = { jdn, noonUtc: ev.noon, sunriseUtc: ev.rise, sunsetUtc: ev.set, polar: ev.rise == null ? (ev.up ? 'day' : 'night') : null };
      }
      d.noonUtc = sunCache.noonUtc; d.sunriseUtc = sunCache.sunriseUtc; d.sunsetUtc = sunCache.sunsetUtc; d.polar = sunCache.polar;
      // the air and the water
      const T = s.oatC != null ? s.oatC : 15 + (s.dISA || 0);
      const Td = s.dewC != null ? s.dewC : dewFromRh(T, s.rh != null ? s.rh : DEFAULT.rh);
      d.oatC = T; d.dewC = Td; d.rh = s.dewC != null ? rhFromDew(T, Td) : (s.rh != null ? s.rh : DEFAULT.rh);
      d.cloudBase = clamp(125 * (T - Td), 0, 6000);
      // an AUTHORED visibility: clear alpine air 60 km, a hazy T10 day 4 km, saturated air a sixth of that
      const tb = s.turbidity != null ? s.turbidity : DEFAULT.turbidity;
      d.visibilityKm = 375 / (tb * tb) * (1 - 0.85 * Math.pow(clamp((d.rh - 0.7) / 0.3, 0, 1), 2));
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
    const air = () => { const a = {}; for (const k of AIR_KEYS) if (s[k] != null) a[k] = s[k]; return a; };

    const day = {
      set, advance,
      spec: () => { const o = {}; for (const k of Object.keys(s).sort()) o[k] = s[k]; return JSON.parse(JSON.stringify(o)); },
      air, get hasAir() { return AIR_KEYS.some(k => s[k] != null); },
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
                     'oatC', 'dewC', 'rh', 'cloudBase', 'visibilityKm',
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
