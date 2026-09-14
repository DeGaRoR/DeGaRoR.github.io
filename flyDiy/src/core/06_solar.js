// ============================================================
// THE SUN AND THE MOON — where they are, from when and where you stand.
// (SKY S2, 2026-09-14.) Pure: no THREE, no DOM, no Date. Degrees in, degrees
// out; the one vector it hands back is in the GAME FRAME.
//
// THE SUN is the NOAA Solar Calculator's algorithm (Meeus, "Astronomical
// Algorithms", as NOAA's spreadsheet lays it out): mean longitude and
// anomaly of the sun, the equation of centre, the apparent longitude with
// the nutation term, the obliquity, the declination, the equation of time,
// the hour angle, then altitude with NOAA's refraction and azimuth from
// north. Published accuracy ±1' for 1800–2100; delta-T ignored, as NOAA's
// own page ignores it, so the two agree. GATE DAY holds it to 0.1° and to
// the minute against USNO's rise / transit / set.
//
// THE MOON is Paul Schlyter's low-precision series ("How to compute
// planetary positions": the twelve longitude, five latitude, two distance
// perturbations), then topocentric parallax — up to a degree, so it is
// kept. Good to a few arcminutes; published as "about a degree". Its phase
// is the illuminated fraction from the elongation. A flight sim needs the
// moon in the right part of the sky with the right face lit, not an
// eclipse.
//
// THE FRAME. The game is x east, y up, z SOUTH (north is -z: 28_island.js).
// A compass azimuth A (clockwise from TRUE north) and altitude h become
//     [ cos h sin A',  sin h,  -cos h cos A' ]      A' = A - convergence
// where the convergence is how far the world's grid north stands east of
// true north (the island frame is Alaska Albers, 19.3° at Jolene; the
// analytic world declares 0). Without it the noon sun lights from 19° off.
// ============================================================
var SOLAR = (function () {
  'use strict';
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const sin = x => Math.sin(x * D2R), cos = x => Math.cos(x * D2R), tan = x => Math.tan(x * D2R);
  const mod = (a, n) => ((a % n) + n) % n;

  // Julian day number of a civil date (Fliegel & Van Flandern), and back.
  function jdn(y, m, d) {
    const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }
  function civil(j) {
    const a = j + 32044, b = Math.floor((4 * a + 3) / 146097), c = a - Math.floor(146097 * b / 4);
    const d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4), m = Math.floor((5 * e + 2) / 153);
    return { y: 100 * b + d - 4800 + Math.floor(m / 10), m: m + 3 - 12 * Math.floor(m / 10), d: e - Math.floor((153 * m + 2) / 5) + 1 };
  }
  // the Julian DATE of a civil day at `utc` seconds after 0h UT
  const jd = (dayJdn, utc) => dayJdn - 0.5 + utc / 86400;

  // ---- the sun, geocentric: declination, equation of time, apparent longitude ----
  function sunGeo(JD) {
    const JC = (JD - 2451545) / 36525;
    const L0 = mod(280.46646 + JC * (36000.76983 + 0.0003032 * JC), 360);
    const M = 357.52911 + JC * (35999.05029 - 0.0001537 * JC);
    const e = 0.016708634 - JC * (0.000042037 + 0.0000001267 * JC);
    const C = sin(M) * (1.914602 - JC * (0.004817 + 0.000014 * JC)) + sin(2 * M) * (0.019993 - 0.000101 * JC) + 0.000289 * sin(3 * M);
    const trueLon = L0 + C;
    const Om = 125.04 - 1934.136 * JC;
    const lam = trueLon - 0.00569 - 0.00478 * sin(Om);
    const eps0 = 23 + (26 + (21.448 - JC * (46.815 + JC * (0.00059 - 0.001813 * JC))) / 60) / 60;
    const eps = eps0 + 0.00256 * cos(Om);
    const dec = Math.asin(sin(eps) * sin(lam)) * R2D;
    const y = tan(eps / 2) * tan(eps / 2);
    const eot = 4 * R2D * (y * sin(2 * L0) - 2 * e * sin(M) + 4 * e * y * sin(M) * cos(2 * L0) - 0.5 * y * y * sin(4 * L0) - 1.25 * e * e * sin(2 * M));
    return { dec, eot, lam, eps };           // deg, minutes, deg, deg
  }

  // NOAA's refraction on the geometric altitude (degrees)
  function refraction(h) {
    if (h > 85) return 0;
    const t = tan(h);
    let r;
    if (h > 5) r = 58.1 / t - 0.07 / (t * t * t) + 0.000086 / (t * t * t * t * t);
    else if (h > -0.575) r = 1735 + h * (-518.2 + h * (103.4 + h * (-12.79 + 0.711 * h)));
    else r = -20.774 / t;
    return r / 3600;
  }

  // altitude/azimuth from an hour angle H (deg, + west), declination, latitude
  function altAz(H, dec, lat) {
    const cz = sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H);
    const z = Math.acos(Math.max(-1, Math.min(1, cz))) * R2D;
    const h0 = 90 - z;
    let az;
    const sz = sin(z);
    if (sz < 1e-9) az = 180;
    else {
      const ca = Math.max(-1, Math.min(1, (sin(lat) * cz - sin(dec)) / (cos(lat) * sz)));
      const a = Math.acos(ca) * R2D;
      az = H > 0 ? mod(a + 180, 360) : mod(540 - a, 360);
    }
    return { h0, az };
  }

  // sun({ jdn, utc, lat, lon }) -> { el, el0, az, dec, eot, H }   lon east-positive
  function sun(o) {
    const JD = jd(o.jdn, o.utc);
    const g = sunGeo(JD);
    const tst = mod(o.utc / 60 + g.eot + 4 * o.lon, 1440);
    const H = tst / 4 - 180;                                    // NOAA: tst in [0, 1440) -> H in [-180, 180), + west
    const aa = altAz(H, g.dec, o.lat);
    return { el: aa.h0 + refraction(aa.h0), el0: aa.h0, az: aa.az, dec: g.dec, eot: g.eot, H, lam: g.lam };
  }

  // ---- rise, transit, set (UT seconds on the civil day; null when none) ----
  // NOAA's own formulation: solar noon = 720 - 4 lon - EoT; the hour angle of
  // the -0.833° (refracted limb) horizon from the declination; iterated once
  // at the event's own time so an equinox day (0.4°/day of declination) does
  // not carry noon's declination to the horizon.
  function events(o, h0) {
    const H0 = h0 == null ? -0.833 : h0;
    const noonAt = (utcGuess) => { const g = sunGeo(jd(o.jdn, utcGuess)); return (720 - 4 * o.lon - g.eot) * 60; };
    let noon = noonAt(43200); noon = noonAt(noon);
    const haAt = (utc) => {
      const g = sunGeo(jd(o.jdn, utc));
      const c = (sin(H0) - sin(o.lat) * sin(g.dec)) / (cos(o.lat) * cos(g.dec));
      return Math.abs(c) > 1 ? null : Math.acos(c) * R2D;          // deg
    };
    let ha = haAt(noon);
    if (ha == null) return { noon, rise: null, set: null, up: sin(o.lat) * sin(sunGeo(jd(o.jdn, noon)).dec) > sin(H0) };
    let rise = noon - ha * 240, set = noon + ha * 240;
    const hr = haAt(rise), hs = haAt(set);
    if (hr != null) rise = noon - hr * 240;
    if (hs != null) set = noon + hs * 240;
    return { noon, rise, set, up: true };
  }

  // ---- the moon (Schlyter), topocentric altitude/azimuth and phase ----
  function moon(o) {
    const JD = jd(o.jdn, o.utc);
    const d = JD - 2451543.5;
    const N = 125.1228 - 0.0529538083 * d, i = 5.1454, w = 318.0634 + 0.1643573223 * d;
    const a = 60.2666, e = 0.054900, M = mod(115.3654 + 13.0649929509 * d, 360);
    const ws = 282.9404 + 4.70935e-5 * d, Ms = mod(356.0470 + 0.9856002585 * d, 360), Ls = ws + Ms;
    let E = M + R2D * e * sin(M) * (1 + e * cos(M));
    for (let k = 0; k < 3; k++) E = E - (E - R2D * e * sin(E) - M) / (1 - e * cos(E));
    const xv = a * (cos(E) - e), yv = a * Math.sqrt(1 - e * e) * sin(E);
    const v = Math.atan2(yv, xv) * R2D, r = Math.hypot(xv, yv);
    const vw = v + w;
    const xe = r * (cos(N) * cos(vw) - sin(N) * sin(vw) * cos(i));
    const ye = r * (sin(N) * cos(vw) + cos(N) * sin(vw) * cos(i));
    const ze = r * sin(vw) * sin(i);
    let lon = Math.atan2(ye, xe) * R2D, lat = Math.atan2(ze, Math.hypot(xe, ye)) * R2D;
    const Lm = N + w + M, D = Lm - Ls, F = Lm - N;
    lon += -1.274 * sin(M - 2 * D) + 0.658 * sin(2 * D) - 0.186 * sin(Ms) - 0.059 * sin(2 * M - 2 * D)
         - 0.057 * sin(M - 2 * D + Ms) + 0.053 * sin(M + 2 * D) + 0.046 * sin(2 * D - Ms) + 0.041 * sin(M - Ms)
         - 0.035 * sin(D) - 0.031 * sin(M + Ms) - 0.015 * sin(2 * F - 2 * D) + 0.011 * sin(M - 4 * D);
    lat += -0.173 * sin(F - 2 * D) - 0.055 * sin(M - F - 2 * D) - 0.046 * sin(M + F - 2 * D) + 0.033 * sin(F + 2 * D) + 0.017 * sin(2 * M + F);
    const rr = r - 0.58 * cos(M - 2 * D) - 0.46 * cos(2 * D);
    // ecliptic -> equatorial
    const ecl = 23.4393 - 3.563e-7 * d;
    const xh = rr * cos(lon) * cos(lat), yh = rr * sin(lon) * cos(lat), zh = rr * sin(lat);
    const xq = xh, yq = yh * cos(ecl) - zh * sin(ecl), zq = yh * sin(ecl) + zh * cos(ecl);
    const RA = mod(Math.atan2(yq, xq) * R2D, 360), Dec = Math.atan2(zq, Math.hypot(xq, yq)) * R2D;
    // sidereal time, hour angle, then the same alt/az as the sun (no refraction: it is not the point)
    const GMST0 = mod(Ls + 180, 360);                       // deg
    const LST = mod(GMST0 + o.utc / 240 + o.lon, 360);      // utc s -> deg: 360/86400 = 1/240
    const H = mod(LST - RA + 180, 360) - 180;
    const aa = altAz(H, Dec, o.lat);
    const mpar = Math.asin(1 / rr) * R2D;                   // parallax, Earth radii -> deg
    const el = aa.h0 - mpar * cos(aa.h0);
    // phase: elongation from the sun's ecliptic longitude
    const sunLam = sunGeo(JD).lam;
    const cosPsi = cos(lat) * cos(lon - sunLam);
    const phase = (1 - cosPsi) / 2;                          // illuminated fraction 0..1
    const waxing = sin(lon - sunLam) > 0;
    return { el, az: aa.az, phase, waxing, lon: mod(lon, 360), lat, dist: rr };
  }

  // ---- the game-frame vector of a sky direction ----
  function toFrame(el, az, convergence) {
    const A = az - (convergence || 0);
    return [cos(el) * sin(A), sin(el), -cos(el) * cos(A)];
  }
  // and the rig's own azimuth (render_world.js: atan2(SUN.x, SUN.z), 0 = +z = south)
  const rigAzim = (az, convergence) => mod(180 - (az - (convergence || 0)) + 180, 360) - 180;

  return { jdn, civil, jd, sun, sunGeo, moon, events, refraction, altAz, toFrame, rigAzim };
})();
if (typeof module !== 'undefined' && module.exports && !module.exports.makeWorld) module.exports = SOLAR;
