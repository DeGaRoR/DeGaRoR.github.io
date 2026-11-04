// ============================================================
// THE WEATHER PLAN (WEATHER-SEASON, 2026-11-03) - the career's weather as a pure function of the instant.
// futureDesigns/WEATHER-DAYS-STUDY-2026-11.md §3 (the model), §5 (the loop), §9-§10 (the user's calls: three seasonal
// blocks of 14 days, the career's first day 15 July, the season 20 May-30 Sep with a winter layup).
//
// THERE IS STILL ONE DAY. This file holds no state and makes no second weather: 07_day.js recompute() calls
// WEATHER_PLAN.at(jdn, utc, geo) when its spec names `plan`, and lays the answer OVER its declared fields as the
// EFFECTIVE spec (the swing and the front already work that way). So the page and the physics worker - each with its
// own DAY on the same spec - compute the same numbers with no message, advance() moves the weather without a version
// bump, and every consumer (the solver's air, the climate's wind, the sky, the clouds, the mist, the sea, the radio,
// the contracts, the forecast) reads ONE source.
//
//   THE BLOCKS     early 20 May-2 Jul (day 1 on 20 May), high 3 Jul-15 Aug (day 1 on 15 Jul: the career's first day is
//                  the game's own fair-weather cumulus), late 16 Aug-30 Sep (day 1 on 16 Aug). A local date picks its
//                  block by its month and day; its day is (date - the block's day 1) mod 14. Outside the season (the
//                  sandbox's dates) the nearest block plays.
//   THE WEATHER DAY owns 04:00 -> 28:00 local (its dawn, its afternoon, its evening and the night that follows).
//   THE TRACKS     [[hour, value...], ...] on the weather day's hours; the day before and after are laid on the same
//                  timeline (-24 / +24 h) and eased with a smoothstep, so a midnight AND a block's edge are one
//                  interpolation - continuous by construction. A SETTING named once is a key at 15:00 (it blends into
//                  its neighbours overnight); an EVENT (fog, rain, aurora, a temperature offset) a day does not name is
//                  zero at both its ends (it never leaks into a neighbour).
//   TEMPERATURE    Parton & Logan (1981) between the date's normals + the day's anomalies: the minimum at sunrise +
//                  0.5 h, the peak ~15:00, an exponential night falling to the NEXT dawn's minimum.
//   QUANTISED for the consumers that re-bake on a change (study §7 risks): the decks' cover in COVER_Q steps (clouds.js
//   re-fits its map per cover), the turbidity in TURB_Q steps and moved only overnight (atmo.js re-bakes its LUTs on it),
//   the wind's spec to 0.1 kt / 1 deg / 0.01 (the climate re-resolves on `windKey`). Temperature, pressure and dew are not.
//   THE TURBIDITY IS A STEP AT 02:00 LOCAL, once a night: atmo.js re-bakes its sky tables (a JS bake) on every change, so
//   the day's aerosol holds from 02:00 to the next 02:00 and changes in the darkest hour, where a step cannot be seen.
// Pure: no Date, no THREE, no DOM, no random. GATE WEATHERPLAN.
// ============================================================
var WEATHER_PLAN = (function () {
  'use strict';
  const DAYS = typeof WEATHER_DAYS !== 'undefined' ? WEATHER_DAYS : { early: [], high: [], late: [] };
  const BLOCKS = Object.freeze([
    Object.freeze({ id: 'early', from: '05-20', to: '07-02', day1: '05-20', days: DAYS.early }),
    Object.freeze({ id: 'high',  from: '07-03', to: '08-15', day1: '07-15', days: DAYS.high }),
    Object.freeze({ id: 'late',  from: '08-16', to: '09-30', day1: '08-16', days: DAYS.late }),
  ]);
  // THE SEASON (the user's call, 3 Nov): the career's date stays inside it; 74_career.js lands a wait past its close on
  // the next year's opening (the winter layup)
  const SEASON = Object.freeze({ open: '05-20', close: '09-30' });
  const WDAY_H0 = 4;
  // Ketchikan-like monthly mean daily high / low (C), read at mid-month and interpolated continuously
  const NORM = { 5: [14.5, 6.5], 6: [17, 9.5], 7: [18.5, 11.5], 8: [18.5, 11.5], 9: [15.5, 9], 10: [11, 5.5] };
  const PL = { a: 1.6, b: 2.2, c: 0.5 };
  const COVER_Q = 0.02, TURB_Q = 0.05, TURB_STEP_H = 26;   // 26 = 02:00 the next morning, on the weather day's clock
  const EXP = x => CORE_MATH.pow(Math.E, x);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = x => { const q = clamp(x, 0, 1); return q * q * (3 - 2 * q); };
  const mod = (a, n) => ((a % n) + n) % n;
  const pad2 = n => String(n).padStart(2, '0');
  const jdnOfMD = (y, md) => SOLAR.jdn(y, +md.slice(0, 2), +md.slice(3, 5));
  const mdOf = j => { const c = SOLAR.civil(j); return pad2(c.m) + '-' + pad2(c.d); };
  const dateOf = j => { const c = SOLAR.civil(j); return c.y + '-' + pad2(c.m) + '-' + pad2(c.d); };

  // ---- the blocks ------------------------------------------------------------------------------------------------
  function blockOf(j) { const k = mdOf(j); return BLOCKS.find(b => k >= b.from && k <= b.to) || (k < BLOCKS[0].from ? BLOCKS[0] : BLOCKS[2]); }
  function idxOf(j) { const b = blockOf(j); return { b, i: mod(j - jdnOfMD(SOLAR.civil(j).y, b.day1), b.days.length || 1) }; }
  const planAt = j => { const r = idxOf(j); return r.b.days[r.i] || {}; };
  const inSeason = j => { const k = mdOf(j); return k >= SEASON.open && k <= SEASON.close; };

  // ---- the almanac of a LOCAL date: sunrise / sunset as local hours, and the offset (06_solar + 07_day's tz rule) ---
  const almC = new Map();
  function alm(j, geo) {
    const key = j + '|' + geo.lat + '|' + geo.lon;
    let r = almC.get(key);
    if (r) return r;
    const tz = geo.tz, std = tz ? tz.std : 0;
    const off = std + (tz && tz.dst === 'us' && DAY.usDst(j, 43200 - std * 3600, std) ? 1 : 0);
    const ev = SOLAR.events({ jdn: j, lat: geo.lat, lon: geo.lon });
    // a local date's hours are the UT seconds of its own civil date plus the offset; the poles (no rise) take 6 / 18
    r = { off, tr: ev.rise != null ? ev.rise / 3600 + off : 6, ts: ev.set != null ? ev.set / 3600 + off : 18 };
    if (almC.size > 400) almC.clear();
    almC.set(key, r);
    return r;
  }
  function normals(jf) {
    const j = Math.floor(jf), c = SOLAR.civil(j), mid = SOLAR.jdn(c.y, c.m, 15);
    const m0 = j >= mid ? c.m : c.m - 1, m1 = m0 + 1;
    const a = NORM[m0] || (m0 < 5 ? NORM[5] : NORM[10]), b = NORM[m1] || (m1 < 5 ? NORM[5] : NORM[10]);
    const ja = SOLAR.jdn(c.y, Math.max(1, m0), 15), jb = SOLAR.jdn(c.y + (m1 > 12 ? 1 : 0), ((m1 - 1) % 12) + 1, 15);
    const f = clamp((jf - ja) / (jb - ja), 0, 1);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  // ---- the tracks -------------------------------------------------------------------------------------------------
  const ABSENT = { 'fog.hold': [[4, 0], [27, 0]], 'column.mixH': [[15, 50]], 'column.inversion.dT': [[15, 0]],
    'rich.breeze': [[15, 0]], 'rich.terrain': [[15, 0]], 'rich.thermals': [[15, 0]], 'rich.aloftK': [[15, 1]], 'rich.veerDeg': [[15, 0]],
    low: [[4, 0, '*'], [27, 0, '*']], up: [[4, 0, '*'], [27, 0, '*']], rain: [[4, 0], [27, 0]], tAdd: [[4, 0], [27, 0]], aurora: [[4, 0], [27, 0]] };
  const turbOf = D => (D && typeof D.turbidity === 'number' ? D.turbidity : 2.8);
  const FIELDS = ['dew', 'qnh', 'wind', 'low', 'up', 'rain', 'tAdd', 'aurora', 'fog.hold', 'column.mixH', 'column.inversion.dT',
                  'rich.breeze', 'rich.terrain', 'rich.thermals', 'rich.aloftK', 'rich.veerDeg'];
  const keysC = new Map();
  // every track of a weather day, its neighbours' keys shifted onto its timeline - built once per weather day
  function keysOf(wj) {
    let K = keysC.get(wj);
    if (K) return K;
    K = {};
    for (const field of FIELDS) {
      const out = [];
      for (const dj of [-1, 0, 1]) {
        const D = planAt(wj + dj), tr = field.split('.').reduce((o, k) => (o == null ? undefined : o[k]), D);
        let arr = Array.isArray(tr) && tr.length ? tr : (tr != null && !Array.isArray(tr) ? [[15, tr]] : null);
        if (!arr) arr = ABSENT[field] || null;
        if (!arr) continue;
        for (const k of arr) out.push({ h: k[0] + 24 * dj, k });
      }
      K[field] = out.sort((a, b) => a.h - b.h);
    }
    if (keysC.size > 64) keysC.clear();
    keysC.set(wj, K);
    return K;
  }
  function between(ks, h) {
    if (!ks || !ks.length) return null;
    if (h <= ks[0].h) return { a: ks[0], b: ks[0], s: 0 };
    for (let i = 0; i + 1 < ks.length; i++) if (h <= ks[i + 1].h) { const a = ks[i], b = ks[i + 1]; return { a, b, s: smooth((h - a.h) / (b.h - a.h)) }; }
    const z = ks[ks.length - 1]; return { a: z, b: z, s: 0 };
  }
  function scalar(K, field, h, dflt) {
    const p = between(K[field], h);
    if (!p) return dflt;
    return p.a.k[1] + (p.b.k[1] - p.a.k[1]) * p.s;
  }
  // a deck: its cover, and a TYPE that only changes through (near) zero cover (the old type fades out to the midpoint,
  // the new one in from it; GATE WEATHERPLAN refuses such a dip under cover by day)
  function deck(K, field, h) {
    const p = between(K[field], h);
    if (!p) return null;
    let A = p.a.k, B = p.b.k;
    if (A[2] === '*') A = [A[0], A[1], B[2], B[3]];
    if (B[2] === '*') B = [B[0], B[1], A[2], A[3]];
    if (A[2] === '*') return { cover: 0, type: 'cuh', base: null, dip: false };
    const base = A[3] != null ? A[3] + ((B[3] != null ? B[3] : A[3]) - A[3]) * p.s : null;
    if (A[2] === B[2]) return { cover: A[1] + (B[1] - A[1]) * p.s, type: A[2], base, dip: false };
    const u = p.a === p.b ? 0 : (h - p.a.h) / (p.b.h - p.a.h);
    return u < 0.5 ? { cover: A[1] * (1 - smooth(u * 2)), type: A[2], base, dip: true } : { cover: B[1] * smooth(u * 2 - 1), type: B[2], base, dip: true };
  }
  // the synoptic wind as a VECTOR (a reversal passes through calm rather than swinging round at strength)
  function windOf(K, h) {
    const p = between(K.wind, h);
    if (!p) return { kts: 0, dirDeg: 0, gust: 0 };
    const A = p.a.k, B = p.b.k, D2R = Math.PI / 180;
    const ax = A[1] * CORE_MATH.sin(A[2] * D2R), az = A[1] * CORE_MATH.cos(A[2] * D2R);
    const bx = B[1] * CORE_MATH.sin(B[2] * D2R), bz = B[1] * CORE_MATH.cos(B[2] * D2R);
    const x = ax + (bx - ax) * p.s, z = az + (bz - az) * p.s, kts = Math.hypot(x, z);
    return { kts, dirDeg: kts > 0.05 ? mod(Math.atan2(x, z) / D2R, 360) : A[2], gust: A[3] + (B[3] - A[3]) * p.s };
  }

  // ---- the temperature (Parton & Logan) -------------------------------------------------------------------------
  function tExt(j) { const D = planAt(j), n = normals(j), t = D.temp || {}; return { tmin: n[1] + (t.min || 0), tmax: n[0] + (t.max || 0) }; }
  function tDay(j, h, geo) { const A = alm(j, geo), E = tExt(j), Y = A.ts - A.tr; return E.tmin + (E.tmax - E.tmin) * CORE_MATH.sin(Math.PI * (h - A.tr - PL.c) / (Y + 2 * PL.a)); }
  function temperature(j, h, geo) {
    const A = alm(j, geo);
    if (h >= A.tr + PL.c && h <= A.ts) return tDay(j, h, geo);
    const j0 = h > A.ts ? j : j - 1, A0 = alm(j0, geo), A1 = alm(j0 + 1, geo);
    const Tset = tDay(j0, A0.ts, geo), Tn = tExt(j0 + 1).tmin;
    const N = (24 - A0.ts) + A1.tr + PL.c, n = h > A0.ts ? h - A0.ts : h + 24 - A0.ts, e = EXP(-PL.b);
    return Tn + (Tset - Tn) * (EXP(-PL.b * n / N) - e) / (1 - e);
  }
  const q = (v, s) => +(Math.round(v / s) * s).toFixed(6);   // a step, and no 7.800000000000001 in a spec that is saved and compared

  // ---- THE EVALUATOR: (jdn, utc) of a UT instant -> the effective spec fields 07_day lays over its declared ones -----
  function at(jdnU, utc, geo) {
    const G = geo || DAY.GEO_DEFAULT;
    const off = alm(jdnU, G).off;
    let lsec = utc + off * 3600, j = jdnU;
    while (lsec < 0) { lsec += 86400; j--; }
    while (lsec >= 86400) { lsec -= 86400; j++; }
    const h = lsec / 3600;
    const wj = h < WDAY_H0 ? j - 1 : j, wh = h < WDAY_H0 ? h + 24 : h;
    const D = planAt(wj), K = keysOf(wj), ix = idxOf(wj), nLow = normals(j + h / 24)[1];
    const oatC = temperature(j, h, G) + scalar(K, 'tAdd', wh, 0);
    const dewC = Math.min(oatC, nLow + scalar(K, 'dew', wh, -4));
    const w = windOf(K, wh), rich = {};
    for (const k of ['breeze', 'terrain', 'thermals', 'aloftK', 'veerDeg']) rich[k] = q(scalar(K, 'rich.' + k, wh, k === 'aloftK' ? 1 : 0), 0.02);
    const wind = Object.assign({ kts: q(w.kts, 0.1), dirDeg: mod(Math.round(w.dirDeg), 360), gust: q(w.gust, 0.01), refH: 10 }, rich);
    const low = deck(K, 'low', wh) || { cover: 0, type: 'cuh', dip: false }, up = deck(K, 'up', wh);
    const invT = scalar(K, 'column.inversion.dT', wh, 0);
    // the front: 07_day's own storm (its transient: the gusts, the boost, the cb at passage - §3.7), declared at the
    // weather day's local hour, given to the day as UT seconds relative to THIS UT date (pure in utc)
    let storm = null;
    for (const dj of [-1, 0, 1]) {
      const S = planAt(wj + dj).storm;
      if (!S) continue;
      const atAbs = (wj + dj) * 86400 + (S.at - off) * 3600;
      storm = Object.assign({}, S, { at: atAbs - jdnU * 86400, pre: S.pre * 3600, dur: S.dur * 3600, post: S.post * 3600 });
    }
    const spec = {
      oatC, qnhPa: 100 * scalar(K, 'qnh', wh, 1013.25), dewC, diurnalC: 0,
      wind, seaTau: 900,
      cloudCover: clamp(q(low.cover, COVER_Q), 0, 1), cloudType: low.type,
      cloudUpper: up && up.cover > COVER_Q / 2 ? [{ cover: clamp(q(up.cover, COVER_Q), 0, 1), type: up.type, base: up.base != null ? Math.round(up.base / 20) * 20 : undefined }] : [],
      turbidity: q(wh < TURB_STEP_H ? turbOf(D) : turbOf(planAt(wj + 1)), TURB_Q),
      // the column (05_atmos K2): always the mixed branch under a plan, its depth sinking to 50 m on a day that names
      // none, so no day boundary switches makeAtmos between its branches
      lapse: 'mixed', mixH: Math.round(scalar(K, 'column.mixH', wh, 50)), inversion: invT > 0.01 ? { dT: q(invT, 0.05), thick: 200 } : null,
      storm,
    };
    const meta = {
      block: ix.b.id, idx: ix.i, id: D.id || null, name: D.name || null, fly: D.fly || null, weatherDate: dateOf(wj), localH: h,
      rain: clamp(scalar(K, 'rain', wh, 0), 0, 1), kp: clamp(scalar(K, 'aurora', wh, 0), 0, 9),
      fogHold: clamp(scalar(K, 'fog.hold', wh, 0), 0, 1), fogWhere: D.fog ? D.fog.where : null,
      windKey: wind.kts.toFixed(1) + '|' + wind.dirDeg + '|' + wind.gust.toFixed(2) + '|' + rich.breeze + '|' + rich.terrain + '|' + rich.thermals + '|' + rich.aloftK + '|' + rich.veerDeg,
      dipLow: low.dip && low.cover > 0.05, dipUp: !!(up && up.dip && up.cover > 0.05),
    };
    return { spec, meta };
  }

  // ---- THE CLASSIFIER (study §4.2): a VFR pilot's reading of a DAY's hour at sea level -> 'easy' | 'care' | 'NO' ---------
  // reads only a DAY's derived fields, so it judges the live day and a scratch day alike
  function surfaceVisKm(day) {
    const R = 12 * CORE_MATH.pow(clamp(day.rain || 0, 0, 1), 1.5);
    return 3.912 / (3.912 / day.visibilityKm + (day.mistRho0 || 0) * 1000 + (R > 0 ? 0.25 * CORE_MATH.pow(R, 0.63) : 0));
  }
  function flyClass(day) {
    const w = day.wind || {}, st = day.storm;
    const kts = (w.kts != null ? +w.kts : w.mps != null ? +w.mps / 0.514444 : 0) * (st ? st.windK : 1);
    const gust = st ? Math.min(1.5, (w.gust || 0) * st.gustK + 0.25 * (st.gustK - 1)) : (w.gust || 0);
    const gk = kts * (1 + gust), cover = day.cloudCoverEff != null ? day.cloudCoverEff : day.cloudCover;
    const base = cover >= 0.5 ? day.cloudBase : 9999, vis = surfaceVisKm(day), rain = day.rain || 0;
    if (kts <= 12 && gk <= 20 && base >= 600 && vis >= 8 && rain < 0.2) return 'easy';
    if (kts <= 20 && gk <= 30 && base >= 300 && vis >= 3 && rain < 0.5) return 'care';
    return 'NO';
  }

  // ---- THE FORECAST (study §5.4, §6.3): what the TIME menu, the radio and the pilots read. A scratch day on the same
  // geo with the plan, at each hour - the live day is never touched. The block of each hour is its own date's.
  const probe = (day, abs) => { const j = Math.floor(abs / 86400); return DAY.makeDay({ date: dateOf(j), utc: abs - j * 86400, plan: { id: 'season' } }, day.geo); };
  const absOf = day => day.jdn * 86400 + day.utc;
  function reading(d) {
    const w = d.wind || {}, st = d.storm;
    const kts = (w.kts || 0) * (st ? st.windK : 1), gust = st ? Math.min(1.5, (w.gust || 0) * st.gustK + 0.25 * (st.gustK - 1)) : (w.gust || 0);
    return { localH: d.localSeconds / 3600, oatC: d.oatC, dewC: d.dewC, qnhHpa: d.qnhEff / 100,
             windFromDeg: mod((w.dirDeg || 0) + (st ? st.veer : 0), 360), windKt: kts, gustKt: kts * (1 + gust),
             cover: d.cloudCoverEff, type: d.cloudTypeEff, baseM: d.cloudBase, visKm: surfaceVisKm(d), rain: d.rain || 0,
             kp: d.auroraKp || 0, flyClass: flyClass(d) };
  }
  // the day's card: which crafted day it is, its words, and the reading now
  function today(day) {
    const p = day.plan;
    if (!p) return null;
    const D = idxOf(SOLAR.jdn(+p.weatherDate.slice(0, 4), +p.weatherDate.slice(5, 7), +p.weatherDate.slice(8, 10))), R = D.b.days[D.i] || {};
    return { block: D.b.id, idx: D.i, id: R.id, name: R.name, story: R.story, fly: R.fly, forecast: R.forecast,
             noFly: R.noFly || [], waitUntil: R.waitUntil || null, weatherDate: p.weatherDate, now: reading(day) };
  }
  // the hours ahead (every `stepH`), each a reading
  function hourly(day, hours, stepH) {
    const A = absOf(day), n = hours != null ? hours : 24, s = stepH || 1, out = [];
    for (let k = 0; k <= n; k += s) out.push(reading(probe(day, A + k * 3600)));
    return out;
  }
  // the next n weather days after today's: their date, their name, their class and their forecast's first sentence
  function outlook(day, n) {
    const p = day.plan, out = [];
    if (!p) return out;
    const wj = SOLAR.jdn(+p.weatherDate.slice(0, 4), +p.weatherDate.slice(5, 7), +p.weatherDate.slice(8, 10));
    for (let k = 1; k <= (n || 3); k++) {
      const r = idxOf(wj + k), D = r.b.days[r.i] || {};
      out.push({ date: dateOf(wj + k), block: r.b.id, id: D.id, name: D.name, fly: D.fly, storm: D.fly === 'storm',
                 oneLine: String(D.forecast || '').split(/(?<=\.)\s/)[0] });
    }
    return out;
  }
  // the TIME menu's lines (day_ui.js menu ctx.forecast): today's name and forecast, then the outlook
  function lines(day) {
    const t = today(day);
    if (!t) return [];
    const L = [t.name + ' - ' + t.forecast];
    for (const o of outlook(day, 3)) L.push(o.date.slice(5) + ' ' + o.name + (o.storm ? ' (STORM)' : '') + ': ' + o.oneLine);
    return L;
  }
  return { BLOCKS, SEASON, NORM, COVER_Q, TURB_Q, WDAY_H0, blockOf, idxOf, planAt, inSeason, at, normals, flyClass, surfaceVisKm,
           today, hourly, outlook, lines, reading };
})();
if (typeof module !== 'undefined' && module.exports && !module.exports.makeWorld) module.exports = WEATHER_PLAN;
