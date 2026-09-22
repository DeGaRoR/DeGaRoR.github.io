// GATE DAY — the day and the sun (SKY S1/S2, 2026-09-14).
// Pure model, no renderer: the one day object the world carries, and the
// almanac it derives — held against USNO's published rise / transit / set
// and the moon's illuminated fraction at four sites, and against the
// identities a sun must satisfy (noon altitude = 90 - lat + dec, the frame).
//
//   src/core/06_solar.js, 07_day.js, 20_world.js  ->  tools/flight_core.js  ->  here
//
// THE ASSERTION THAT MATTERS MOST is section 3: a change to any VISUAL term
// of the day (date, hour, humidity, turbidity...) leaves `world.atmos` the
// SAME OBJECT — one temperature model, never two — and the solver's air is
// exactly what setWeather always gave it.
//
// Run: node tools/test_day.js   (contract: one final `GATE DAY: ...`)

const fs = require('fs'), path = require('path');
const { SOLAR, DAY, makeWorld, ATMOS_ISA } = require('./flight_core.js');

let fails = 0;
const fail = (m) => { console.log('  FAIL ' + m); fails++; };
const ok = (m) => console.log('  ok   ' + m);
const yes = (c, m) => (c ? ok : fail)(m);
const nearDeg = (a, b, tol, m) => { let e = Math.abs(a - b); e = Math.min(e, Math.abs(e - 360)); (e <= tol ? ok : fail)(`${m}: ${a.toFixed(3)} vs ${b} (|d| ${e.toFixed(3)} deg, tol ${tol})`); };
const hm = s => { s = ((s % 86400) + 86400) % 86400; return String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.round((s % 3600) / 60)).padStart(2, '0'); };
const minOf = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const nearMin = (utcSec, t, tol, m) => {
  const a = ((utcSec / 60) % 1440 + 1440) % 1440, b = minOf(t);
  let e = Math.abs(a - b); e = Math.min(e, 1440 - e);
  (e <= tol ? ok : fail)(`${m}: ${hm(utcSec)} vs ${t} (${e.toFixed(1)} min)`);
};

// ---- 1. the almanac against USNO (aa.usno.navy.mil/api/rstt/oneday, UT) ------
// Jolene's origin is 28_island.js's ISLAND_GEO (rasterio, EPSG:3338 -> 4326).
console.log('1. rise / transit / set against USNO, four sites');
const JOL = { lat: 55.04327, lon: -131.57222 };
const REF = [
  // site, date, USNO {rise, noon, set} in UT on that civil day (the set may be the previous evening's, at the solstice a minute apart)
  { name: 'Jolene Jun 21', ...JOL, y: 2026, m: 6, d: 21, rise: '12:07', noon: '20:48', set: '05:29', setTol: 2 },
  { name: 'Jolene Dec 21', ...JOL, y: 2026, m: 12, d: 21, rise: '17:10', noon: '20:45', set: '00:19', setTol: 2 },
  { name: 'equator equinox', lat: 0, lon: 0, y: 2026, m: 3, d: 20, rise: '06:04', noon: '12:07', set: '18:11', setTol: 1 },
  { name: '35 S 150 E Dec 21', lat: -35, lon: 150, y: 2026, m: 12, d: 21, rise: '18:43', noon: '01:58', set: '09:13', setTol: 1 },
];
for (const r of REF) {
  const e = SOLAR.events({ jdn: SOLAR.jdn(r.y, r.m, r.d), lat: r.lat, lon: r.lon });
  nearMin(e.noon, r.noon, 1, r.name + ' transit');
  nearMin(e.rise, r.rise, 1, r.name + ' sunrise');
  nearMin(e.set, r.set, r.setTol, r.name + ' sunset');
  // and the identity at transit: altitude = 90 - |lat - dec|, azimuth due south (north in the south)
  const n = SOLAR.sun({ jdn: SOLAR.jdn(r.y, r.m, r.d), utc: e.noon, lat: r.lat, lon: r.lon });
  nearDeg(n.el0, 90 - Math.abs(r.lat - n.dec), 0.02, r.name + ' noon altitude = 90 - |lat - dec|');
  nearDeg(n.az, r.lat > n.dec ? 180 : 0, 0.5, r.name + ' noon azimuth');
}
{ // lower culmination on the solstice at Jolene: never a true night in June
  const e = SOLAR.events({ jdn: SOLAR.jdn(2026, 6, 21), ...JOL });
  const mid = SOLAR.sun({ jdn: SOLAR.jdn(2026, 6, 21), utc: e.noon + 43200, ...JOL });
  nearDeg(mid.el0, JOL.lat + 23.44 - 90, 0.1, 'Jolene Jun 21 solar midnight = lat + dec - 90');
  yes(mid.el > -12, 'June at 55 N never leaves nautical twilight (' + mid.el.toFixed(1) + ' deg)');
}

// ---- 2. the moon: USNO fracillum on the same days, and the 2026 eclipses ------
console.log('2. the moon');
for (const [y, m, d, pct] of [[2026, 6, 21, 46], [2026, 12, 21, 90], [2026, 3, 20, 3]]) {
  const mo = SOLAR.moon({ jdn: SOLAR.jdn(y, m, d), utc: 43200, ...JOL });
  const p = mo.phase * 100;
  (Math.abs(p - pct) <= 5 ? ok : fail)(`moon ${y}-${m}-${d} 12Z illuminated ${p.toFixed(0)}% vs USNO ${pct}%`);
}
for (const [y, m, d, u, exp] of [[2026, 2, 17, 12 * 3600 + 12 * 60, 'new'], [2026, 8, 12, 17 * 3600 + 46 * 60, 'new'],
                                 [2026, 3, 3, 11 * 3600 + 38 * 60, 'full'], [2026, 8, 28, 4 * 3600 + 18 * 60, 'full']]) {
  const mo = SOLAR.moon({ jdn: SOLAR.jdn(y, m, d), utc: u, lat: 0, lon: 0 });
  const p = mo.phase;
  yes(exp === 'new' ? p < 0.01 : p > 0.99, `${exp} moon at the ${y}-${m}-${d} eclipse: ${(p * 100).toFixed(1)}%`);
}

// ---- 3. the day object: one temperature model ---------------------------------
console.log('3. the day on the world');
const W = makeWorld(0);
yes(W.day && W.geo && typeof W.setDay === 'function', 'the world carries day, geo, setDay');
yes(W.day.date === '2026-06-21' && W.day.utc === 18 * 3600, 'boots on the FIXED default (2026-06-21 18:00Z), never the wall clock: ' + W.day.local);
yes(W.day.local === '2026-06-21 10:00:00 AKDT', 'local time with the US daylight rule: ' + W.day.local);
{
  W.setWeather({ oatC: 35, qnhPa: 100800 });
  const A = W.atmos, s0 = A.sigma(1000);
  W.setDay({ date: '2026-12-21', utc: 3600, rh: 0.95, turbidity: 8, ozone: 250, cloudCover: 0.9 });
  yes(W.atmos === A, 'moving date, hour, humidity, turbidity, ozone, cloud leaves atmos THE SAME OBJECT');
  yes(W.atmos.sigma(1000) === s0, 'and its numbers bit-identical');
  yes(W.day.local.endsWith('AKST'), 'December is standard time: ' + W.day.local);
  W.setDay({ oatC: 20 });
  yes(W.atmos !== A && Math.abs(W.atmos.oatC - 20) < 1e-9, 'an AIR field rebuilds the air (oatC 20)');
  W.setWeather(null);
  yes(W.atmos === ATMOS_ISA, 'setWeather(null) restores ISA');
  const w = W.wind(0, 100, 0); yes(w[0] === 0 && w[1] === 0 && w[2] === 0, 'and the exact zero wind');
  yes(W.day.hasAir === false, 'the day holds no air fields afterwards');
}
{ // the water: cloud base by the dewpoint spread, Magnus consistency
  W.setDay({ oatC: 20, dewC: 12 });
  yes(Math.abs(W.day.cloudBase - 1000) < 1e-6, 'cloud base = 125 m per degree of spread (20/12 -> 1000 m): ' + W.day.cloudBase);
  W.setDay({ dewC: null, rh: 1 });
  yes(Math.abs(W.day.dewC - 20) < 0.01 && W.day.cloudBase < 2, 'saturated air: dewpoint = temperature, base on the ground');
  W.setDay({ rh: 0.5 });
  const Td = W.day.dewC; W.setDay({ rh: null, dewC: Td });
  yes(Math.abs(W.day.rh - 0.5) < 1e-6, 'Magnus round-trips rh <-> dewpoint');
  W.setDay({ rh: 0.3, turbidity: 2.5 }); const v1 = W.day.visibilityKm;
  W.setDay({ turbidity: 6 }); const v2 = W.day.visibilityKm;
  W.setDay({ rh: 0.95 }); const v3 = W.day.visibilityKm;
  yes(v1 > v2 && v2 > v3, `visibility falls with turbidity and humidity: ${v1.toFixed(0)} > ${v2.toFixed(0)} > ${v3.toFixed(1)} km`);
  W.setWeather(null);
}
{ // THE MIST BURNS OFF (FOG-MIST F3c) - the layer's density, not the column's
  // The term is the LAGGED sun (the ground runs two hours behind it, which is why fog thins at
  // all), so every assertion here is driven by moving the CLOCK, never by poking an elevation.
  const at = (h, o) => { W.setDay(Object.assign({ date: '2026-06-21', localHours: h }, o || {})); return W.day; };
  const wet = { rh: 0.98, turbidity: 2.5, cloudCover: 0 };
  let prev = Infinity, mono = true, sawFull = false, sawGone = false;
  for (let h = 0; h <= 23; h++) {
    const d = at(h, wet);
    if (d.sunElLag <= 5 && Math.abs(d.mistBurn) > 1e-12) mono = false;      // nothing burns before the ground warms
    if (d.mistBurn > 0.999) sawGone = true;
    if (d.mistBurn < 1e-12) sawFull = true;
    if (!Number.isFinite(d.mistRho0)) mono = false;
  }
  yes(mono, 'the burn is exactly zero until the LAGGED sun clears 5 deg, and the density is finite all day');
  yes(sawFull && sawGone, 'a midsummer day both holds the fog (before dawn) and takes it all (by afternoon)');
  // monotone through the morning: a later hour never has MORE fog than an earlier one while the
  // lagged sun is climbing
  { let ok = true, last = -1;
    for (let h = 4; h <= 12; h++) { const d = at(h, wet); if (d.sunElLag > 5) { if (last >= 0 && d.mistRho0 > last + 1e-15) ok = false; last = d.mistRho0; } }
    yes(ok, 'through the morning the layer only ever thins'); }
  // an overcast holds it in: same hour, same humidity, cover 1 keeps the full density
  { const clear = at(14, wet).mistRho0, cloud = at(14, { rh: 0.98, turbidity: 2.5, cloudCover: 1 }).mistRho0;
    yes(cloud > clear && Math.abs(cloud - 0.0025 * Math.pow((0.98 - 0.7) / 0.3, 2)) < 1e-9,
        `an overcast holds the fog in: ${cloud.toExponential(2)} against ${clear.toExponential(2)} in the clear`); }
  // BOTH POLES ON A SOLSTICE - the case a lagged elevation makes trivial and an hours-count does not
  for (const [lat, what] of [[89, 'the polar day'], [-89, 'the polar night']]) {
    const G2 = Object.assign({}, W.geo, { lat });
    const d = DAY.makeDay({ date: '2026-06-21', localHours: 12, rh: 0.98, turbidity: 2.5, cloudCover: 0 }, G2);
    yes(Number.isFinite(d.mistRho0) && d.mistRho0 >= 0 && Number.isFinite(d.mistBurn),
        `${what}: a finite density with no sunrise to divide by (rho0 ${d.mistRho0.toExponential(2)}, burn ${d.mistBurn.toFixed(2)}, lagged sun ${d.sunElLag.toFixed(1)} deg)`);
  }
  W.setWeather(null); W.setDay({ date: '2026-09-14', utc: 12 * 3600, rh: 0.5, cloudCover: 0.2 });
}
{ // round trip and the clock
  W.setDay({ date: '2026-09-14', utc: 5 * 3600, rate: 60, turbidity: 3, rh: 0.6, oatC: 12 });
  const s = W.day.spec();
  const D2 = DAY.makeDay(s, W.geo);
  yes(JSON.stringify(D2.spec()) === JSON.stringify(s), 'makeDay(spec).spec() round-trips');
  yes(D2.sunEl === W.day.sunEl && D2.local === W.day.local, 'and derives the same sun and clock');
  const v0 = W.day.version, u0 = W.day.utc;
  for (let i = 0; i < 3600; i++) W.day.advance(1 / 60);
  yes(W.day.version === v0, 'advance() never bumps the version');
  yes(Math.abs(W.day.utc - (u0 + 3600)) < 1e-6, '3600 frames at 60x = one hour exactly: ' + (W.day.utc - u0).toFixed(6));
  W.setDay({ utc: 86300, rate: 1 }); W.day.advance(200);
  yes(W.day.date === '2026-09-15' && Math.abs(W.day.utc - 100) < 1e-9, 'the date rolls at midnight: ' + W.day.local);
  W.setDay({ rate: 0 }); const u1 = W.day.utc; W.day.advance(100); yes(W.day.utc === u1, 'rate 0 is frozen');
  W.setDay({ localHours: 12 }); yes(Math.abs(W.day.localSeconds - 43200) < 1e-6, 'localHours sets the local clock: ' + W.day.local);
  W.setWeather(null); W.setDay({ date: '2026-06-21', utc: 18 * 3600, rate: 1 });
}

// ---- 4. the frame: the sun's vector in the game's own axes -------------------
console.log('4. the frame');
{
  // the analytic world: -z is TRUE north, so at noon the sun stands at +z (south) and at 06:00 solar toward +x (east)
  W.setDay({ date: '2026-06-21', utc: W.day.noonUtc });
  let v = W.day.sun;
  yes(v[2] > 0.4 && Math.abs(v[0]) < 0.01 && v[1] > 0.8, 'analytic world, noon: the sun is SOUTH (+z) and high: ' + v.map(x => x.toFixed(3)));
  yes(Math.abs(W.day.rigAzim) < 0.01, 'the rig azimuth (0 = +z) reads 0 at noon: ' + W.day.rigAzim.toFixed(3));
  W.setDay({ utc: W.day.noonUtc - 6 * 3600 });
  v = W.day.sun;
  yes(v[0] > 0.7, 'six hours before noon the sun is EAST (+x): ' + v.map(x => x.toFixed(3)));
  yes(Math.abs(Math.hypot(v[0], v[1], v[2]) - 1) < 1e-9, 'unit vector');
  // the island: the grid's north leans 19.32 deg EAST of true north, so grid south leans west of
  // true south — and the true-south noon sun stands 19.32 deg EAST of +z in grid terms (x > 0)
  const g = Object.assign({}, W.geo, { convergenceDeg: 19.32 });
  const I = DAY.makeDay({ date: '2026-06-21', utc: W.day.noonUtc }, g);
  nearDeg(I.sunAzGrid, 180 - 19.32, 0.01, 'island grid azimuth at noon = 180 - convergence');
  yes(I.sun[0] > 0.1 && I.sun[2] > 0.4 && Math.abs(Math.atan2(I.sun[0], I.sun[2]) * 180 / Math.PI - 19.32) < 0.01,
      'island noon: the sun stands 19.32 deg east of +z in grid terms: ' + I.sun.map(x => x.toFixed(3)));
  nearDeg(I.rigAzim, 19.32, 0.01, 'and the rig azimuth reads +convergence');
  // the illumination ladder is monotone through a day
  const cls = [];
  for (let u = 0; u < 86400; u += 900) { I.set({ utc: u }); cls.push(I.illumClass); }
  const order = { night: 0, astro: 1, nautical: 2, civil: 3, day: 4 };
  let dips = 0; for (let i = 1; i < cls.length; i++) if (order[cls[i]] !== order[cls[i - 1]]) dips++;
  yes(dips <= 4 && cls.includes('day') && cls.includes('nautical') && !cls.includes('night'), 'the twilight ladder climbs and falls once on Jun 21 at 55 N (' + [...new Set(cls)].join(' ') + ')');
  I.set({ date: '2026-12-21', utc: 3 * 3600 }); yes(I.illumClass === 'night' && I.isNight, 'a December night is night');
  const gold = I.utcFor(8, false); yes(gold != null && Math.abs(SOLAR.sun({ jdn: I.jdn, utc: gold, lat: g.lat, lon: g.lon }).el - 8) < 0.01, 'utcFor(8 deg, descending) finds the golden hour: ' + hm(gold));
}

// ---- 5. the sources: pure, and never the wall clock --------------------------
console.log('5. the sources');
for (const f of ['06_solar.js', '07_day.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', f), 'utf8');
  yes(!/new Date\(|Date\.now\(|THREE\.|window\.|document\./.test(src), f + ' has no Date, no THREE, no DOM');
}

// ---- verdict ------------------------------------------------------------------
W.setWeather(null); W.setDay({ date: '2026-06-21', utc: 18 * 3600, rate: 1 });
console.log(`four sites to the minute; the day boots ${W.day.local}, sun ${W.day.sunEl.toFixed(1)} deg at ${W.day.sunAz.toFixed(1)}`);
console.log(`GATE DAY: ${fails ? 'FAIL (' + fails + ' check' + (fails > 1 ? 's' : '') + ')' : 'PASS'}`);
process.exit(fails ? 1 : 0);
