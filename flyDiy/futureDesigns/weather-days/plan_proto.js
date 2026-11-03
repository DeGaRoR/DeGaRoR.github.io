// ============================================================
// WEATHER-DAYS STUDY PROTOTYPE (2026-11, futureDesigns/WEATHER-DAYS-STUDY-2026-11.md §3-§5).
// NOT GAME CODE: nothing in src/ or tools/build.js reads this. It is the study's
// evidence: the deterministic function (plan, instant) -> the day's spec, run
// through the game's OWN almanac and air (tools/flight_core.js: DAY, SOLAR,
// makeAtmos), so every number the study prints is the number 07_day.js and
// 05_atmos.js would derive from that spec.
//
//   node futureDesigns/weather-days/plan_proto.js [--block=early|high|late]          a block's 14 days, hourly
//   node futureDesigns/weather-days/plan_proto.js --fly [--block=…]                    flyable half-hours per day (§4.2)
//   node futureDesigns/weather-days/plan_proto.js --smooth [--from=MM-DD --to=MM-DD]   walked minute by minute
//   node futureDesigns/weather-days/plan_proto.js --season                              the block table, the season walk
//   node futureDesigns/weather-days/plan_proto.js --check                               the blocks' rules (§10.4)
// THREE SEASONAL BLOCKS (the user's call, 3 Nov: option B, study §9.3 / §10): early 20 May - 2 Jul, high 3 Jul -
// 15 Aug, late 16 Aug - 30 Sep, each 14 days looping inside its own dates. A date picks its block by its month and day;
// the day before and after it may be another block's, so a block's edge is as smooth as any midnight (§3.2).
// ============================================================
'use strict';
const fs = require('fs'), path = require('path');
const C = require(path.join(__dirname, '../../tools/flight_core.js'));
const { DAY, SOLAR, makeAtmos } = C;

// ---- THE PLAN: three blocks of 14 days, each read in file order -----------------------------------------------
const readBlock = id => { const dir = path.join(__dirname, 'days', id);
  return fs.readdirSync(dir).filter(f => /\.json$/.test(f)).sort().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); };
// from / to: the block's dates (MM-DD, inclusive); epoch: the MM-DD that is the block's day 1 every year. The high block's
// epoch is 15 July, the career's first day (74_career CAREER_DAY0, 15 Jul 16:00 AKDT), so a career opens on its day 1,
// the game's own fair-weather cumulus. Outside the season (the sandbox's dates) the nearest block plays.
const BLOCKS = [
  { id: 'early', from: '05-20', to: '07-02', epoch: '05-20' },
  { id: 'high',  from: '07-03', to: '08-15', epoch: '07-15' },
  { id: 'late',  from: '08-16', to: '09-30', epoch: '08-16' },
].map(b => Object.assign(b, { days: readBlock(b.id) }));
const DAYS = BLOCKS[1].days, L = DAYS.length;            // the high block (the study's §4 days)
const EPOCH = '2026-07-15';
// THE WEATHER DAY OWNS 04:00 -> 28:00 LOCAL (a pilot's day: its dawn, its afternoon, its evening and the night that follows)
const WDAY_H0 = 4;
// THE SEASON'S NORMALS: Ketchikan-like monthly mean daily high / low (C), rounded; read at mid-month and interpolated
const NORM = { 5: [14.5, 6.5], 6: [17, 9.5], 7: [18.5, 11.5], 8: [18.5, 11.5], 9: [15.5, 9], 10: [11, 5.5] };
const GEO = DAY.GEO_DEFAULT;
const jdnOf = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return SOLAR.jdn(+m[1], +m[2], +m[3]); };
const dateOf = j => { const c = SOLAR.civil(j); return c.y + '-' + String(c.m).padStart(2, '0') + '-' + String(c.d).padStart(2, '0'); };
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = x => { const q = clamp(x, 0, 1); return q * q * (3 - 2 * q); };
const J0 = jdnOf(EPOCH);
const md = j => { const c = SOLAR.civil(j); return String(c.m).padStart(2, '0') + '-' + String(c.d).padStart(2, '0'); };
function blockOf(j) { const k = md(j); return BLOCKS.find(b => k >= b.from && k <= b.to) || (k < BLOCKS[0].from ? BLOCKS[0] : BLOCKS[2]); }
function idxOf(j) { const b = blockOf(j), y = SOLAR.civil(j).y, e = jdnOf(y + '-' + b.epoch); return { b, i: mod(j - e, b.days.length) }; }
const planAt = j => { const r = idxOf(j); return r.b.days[r.i]; };
// the date of a block's day k in 2026 (its first: the epoch + k)
const blockDate = (b, k) => dateOf(jdnOf('2026-' + b.epoch) + k);

function normals(jf) {                                  // [high, low] at a local date (fractional: continuous through midnight)
  const j = Math.floor(jf), c = SOLAR.civil(j), mid = SOLAR.jdn(c.y, c.m, 15);
  const m0 = j >= mid ? c.m : c.m - 1, m1 = m0 + 1;
  const a = NORM[m0] || NORM[5], b = NORM[m1] || NORM[10];
  const ja = SOLAR.jdn(c.y, m0, 15), jb = SOLAR.jdn(c.y, m1, 15), f = (jf - ja) / (jb - ja);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
// the almanac of a local date: sunrise / sunset as local hours (07_day's own)
const almCache = new Map();
function alm(j) {
  if (almCache.has(j)) return almCache.get(j);
  const d = DAY.makeDay({ date: dateOf(j), utc: 20 * 3600 }, GEO);
  const loc = u => ((u / 3600 + d.offsetH) % 24 + 24) % 24;
  const r = { tr: loc(d.sunriseUtc), ts: loc(d.sunsetUtc), off: d.offsetH };
  almCache.set(j, r); return r;
}
// ---- THE TRACKS: keyframes on one continuous timeline (the day before, the day, the day after) ----------------
// a track is [[hour, v, ...], ...] on its weather day's hours (4..28); the neighbours' keyframes are shifted by -24 / +24,
// so the evening of one day and the morning of the next are ONE interpolation: continuous across days by construction.
// A DAY THAT DOES NOT NAME A TRACK IS NOT SILENT: a missing deck is no cloud ('*' takes its neighbour's type, so the
// fade is a plain cover ramp), a missing rain or aurora is zero - else a neighbour's last keyframe would hold for days.
// EVENTS (fog, rain, aurora) are ZERO through a day that does not name them - keyed at both its ends, so a neighbour's
// fog or rain stays within an hour of the boundary and never leaks across the day; the SETTINGS (rich terms, the column)
// are one key at 15:00 and blend into their neighbours overnight.
const ABSENT = { 'fog.hold': [[4, 0], [27, 0]], 'column.mixH': [[15, 50]], 'column.inversion.dT': [[15, 0]],
  'rich.breeze': [[15, 0]], 'rich.terrain': [[15, 0]], 'rich.thermals': [[15, 0]], 'rich.aloftK': [[15, 1]], 'rich.veerDeg': [[15, 0]], low: [[4, 0, '*'], [27, 0, '*']], up: [[4, 0, '*'], [27, 0, '*']], rain: [[4, 0], [27, 0]], tAdd: [[4, 0], [27, 0]], aurora: [[4, 0], [27, 0]] };
function keys(wj, field) {
  const out = [];
  for (const dj of [-1, 0, 1]) {
    const D = planAt(wj + dj), tr = field.split('.').reduce((o, k) => (o == null ? undefined : o[k]), D);
    let arr = Array.isArray(tr) && tr.length ? tr : (tr != null && !Array.isArray(tr) ? [[15, tr]] : null);
    if (!arr) arr = ABSENT[field] || null;
    if (!arr) continue;
    for (const k of arr) out.push({ h: k[0] + 24 * dj, k });
  }
  return out.sort((a, b) => a.h - b.h);
}
function between(ks, h) {                                    // the bracketing pair and the eased fraction
  if (!ks.length) return null;
  if (h <= ks[0].h) return { a: ks[0], b: ks[0], s: 0 };
  for (let i = 0; i + 1 < ks.length; i++) if (h <= ks[i + 1].h) {
    const a = ks[i], b = ks[i + 1]; return { a, b, s: smooth((h - a.h) / (b.h - a.h)) };
  }
  const z = ks[ks.length - 1]; return { a: z, b: z, s: 0 };
}
function scalar(wj, h, field, idx, dflt) {
  const p = between(keys(wj, field), h);
  if (!p) return dflt;
  const va = idx != null ? p.a.k[idx] : p.a.k[1], vb = idx != null ? p.b.k[idx] : p.b.k[1];
  return va + (vb - va) * p.s;
}
// a cloud deck: cover, and a TYPE that only changes through (near) zero cover - two different types across a pair
// fade the old one out to the midpoint and the new one in from it (a dip the validator reports when it is in daylight)
function deck(wj, h, field) {
  const ks = keys(wj, field);
  if (!ks.length) return null;
  const p = between(ks, h);
  let A = p.a.k, B = p.b.k;
  if (A[2] === '*') A = [A[0], A[1], B[2], B[3]]; if (B[2] === '*') B = [B[0], B[1], A[2], A[3]];
  if (A[2] === '*') return { cover: 0, type: 'cuh', base: null, dip: false };
  const base = A[3] != null ? A[3] + (((B[3] != null ? B[3] : A[3]) - A[3]) * p.s) : null;
  if (A[2] === B[2]) return { cover: A[1] + (B[1] - A[1]) * p.s, type: A[2], base, dip: false };
  const u = p.a === p.b ? 0 : (h - p.a.h) / (p.b.h - p.a.h);
  return u < 0.5 ? { cover: A[1] * (1 - smooth(u * 2)), type: A[2], base, dip: true }
                 : { cover: B[1] * smooth(u * 2 - 1), type: B[2], base, dip: true };
}
function wind(wj, h) {                                       // the synoptic wind as a VECTOR (a reversal passes through calm)
  const p = between(keys(wj, 'wind'), h), A = p.a.k, B = p.b.k;
  const vec = k => { const t = k[2] * Math.PI / 180; return [k[1] * Math.sin(t), k[1] * Math.cos(t)]; };
  const va = vec(A), vb = vec(B), x = va[0] + (vb[0] - va[0]) * p.s, z = va[1] + (vb[1] - va[1]) * p.s;
  const kts = Math.hypot(x, z);
  return { kts, dirDeg: kts > 0.05 ? mod(Math.atan2(x, z) * 180 / Math.PI, 360) : A[2], gust: A[3] + (B[3] - A[3]) * p.s };
}
// ---- THE TEMPERATURE: Parton & Logan (1981), the day's min near dawn and its max mid-afternoon -----------------
// day:   T = Tmin + (Tmax - Tmin) sin(pi m / (Y + 2a)),  m hours since sunrise + c, Y the day length
// night: an exponential fall from the sunset temperature to the NEXT morning's minimum (b = 2.2), so the night
//        meets the next day's dawn exactly: continuous across days whatever the two days declare.
const PL = { a: 1.6, b: 2.2, c: 0.5 };
function tExt(j) { const D = planAt(j), n = normals(j), t = D.temp || {}; return { tmin: n[1] + (t.min || 0), tmax: n[0] + (t.max || 0) }; }
function tDay(j, h) {
  const A = alm(j), E = tExt(j), Y = A.ts - A.tr;
  return E.tmin + (E.tmax - E.tmin) * Math.sin(Math.PI * (h - A.tr - PL.c) / (Y + 2 * PL.a));
}
function temperature(j, h) {                                 // calendar local date j, local hour h in [0, 24)
  const A = alm(j);
  if (h >= A.tr + PL.c && h <= A.ts) return tDay(j, h);
  const j0 = h > A.ts ? j : j - 1, A0 = alm(j0), A1 = alm(j0 + 1);
  const Tset = tDay(j0, A0.ts), Tn = tExt(j0 + 1).tmin;
  const N = (24 - A0.ts) + A1.tr + PL.c, n = h > A0.ts ? h - A0.ts : h + 24 - A0.ts;
  const e = Math.exp(-PL.b);
  return Tn + (Tset - Tn) * (Math.exp(-PL.b * n / N) - e) / (1 - e);
}
// ---- THE EVALUATOR: (plan, instant) -> the day's spec (07_day.js's own fields) -------------------------------
// abs: UT seconds on the julian-day-number epoch (07b_clock.js dayAbs). Returns { spec, meta }.
function weatherAt(abs) {
  const jU = Math.floor(abs / 86400), utc = abs - jU * 86400;
  const off = alm(jU).off;                                   // the date's offset (AKDT all season)
  let lsec = utc + off * 3600, j = jU; if (lsec < 0) { lsec += 86400; j--; } else if (lsec >= 86400) { lsec -= 86400; j++; }
  const h = lsec / 3600;
  const wj = h < WDAY_H0 ? j - 1 : j, wh = h < WDAY_H0 ? h + 24 : h;   // the weather day and its hour (4..28)
  const D = planAt(wj), nLow = normals(j + h / 24)[1];
  // the curve, plus a declared offset track (a cold front's drop, which no diurnal curve makes): smooth by construction
  const oatC = temperature(j, h) + scalar(wj, wh, 'tAdd', null, 0);
  const dewC = Math.min(oatC, nLow + scalar(wj, wh, 'dew', null, -2));
  const qnhPa = 100 * scalar(wj, wh, 'qnh', null, 1013.25);
  // EVERY per-day number is a track blended across the day boundary - a scalar is a one-key track at 15:00 - so the
  // breeze, the terrain's hand, the thermals and the column walk from one day's value to the next overnight
  const w = wind(wj, wh), rich = {};
  for (const k of ['breeze', 'terrain', 'thermals', 'aloftK', 'veerDeg']) rich[k] = scalar(wj, wh, 'rich.' + k, null, k === 'aloftK' ? 1 : 0);
  const low = deck(wj, wh, 'low') || { cover: 0, type: 'cuh' };
  const up = deck(wj, wh, 'up');
  const spec = {
    oatC, qnhPa, dewC, diurnalC: null,                       // the plan carries the temperature itself: no second swing
    wind: Object.assign({ kts: w.kts, dirDeg: w.dirDeg, gust: w.gust, refH: 10 }, rich),
    cloudCover: low.cover, cloudType: low.type,
    cloudUpper: up && up.cover > 0.003 ? [{ cover: up.cover, type: up.type, base: up.base }] : null,
    turbidity: scalar(wj, wh, 'turbidity', null, 2.8),
    seaTau: 900,                                             // a plan's wind moves: the sea must walk after it (§3.6, F11)
  };
  // THE COLUMN (05_atmos K2): always the mixed branch under a plan, its depth a track that sinks to 50 m (where the
  // dry adiabat and the standard lapse differ by 0.2 K) on a day that names none - so a thermal day's deep layer and
  // its lid grow and collapse smoothly, and no day boundary switches makeAtmos between its two branches
  spec.lapse = 'mixed'; spec.mixH = scalar(wj, wh, 'column.mixH', null, 50);
  const invT = scalar(wj, wh, 'column.inversion.dT', null, 0);
  spec.inversion = invT > 0.01 ? { dT: invT, thick: 200 } : null;
  // the front: 07_day's own storm, declared at the weather day's local hour -> UT seconds on that UT date
  let storm = null;
  for (const dj of [-1, 0, 1]) {
    const S = planAt(wj + dj).storm; if (!S) continue;
    const atAbs = (wj + dj) * 86400 + (S.at - off) * 3600;
    const at = atAbs - jU * 86400;                           // relative to this UT date (may be < 0 or > 86400: pure in utc)
    storm = Object.assign({}, S, { at, pre: S.pre * 3600, dur: S.dur * 3600, post: S.post * 3600 });
  }
  spec.storm = storm;
  const meta = { planIdx: idxOf(wj).i, block: idxOf(wj).b.id, id: D.id, name: D.name, fly: D.fly, wdate: dateOf(wj), localH: h,
                 rain: scalar(wj, wh, 'rain', null, 0), kp: scalar(wj, wh, 'aurora', null, 0), fogHold: scalar(wj, wh, 'fog.hold', null, 0), fogWhere: D.fog ? D.fog.where : null,
                 dipLow: low.dip, dipUp: up ? up.dip : false };
  return { spec, meta, date: dateOf(jU), utc };
}

// ---- WHAT THE GAME DERIVES FROM IT (07_day + 05_atmos, the real ones) -----------------------------------------
function derive(abs) {
  const W = weatherAt(abs);
  const d = DAY.makeDay(Object.assign({ date: W.date, utc: W.utc }, W.spec), GEO);
  const air = makeAtmos(d.air());
  const st = d.storm;
  const kts = W.spec.wind.kts * (st ? st.windK : 1);
  const gust = st ? Math.min(1.5, W.spec.wind.gust * st.gustK + 0.25 * (st.gustK - 1)) : W.spec.wind.gust;
  const dir = mod(W.spec.wind.dirDeg + (st ? st.veer : 0), 360);
  // visibility at the surface: the column (07_day visibilityKm), the ground mist's layer (mistRho0, /m) and the rain
  // (Atlas: sigma ~ 0.25 R^0.63 /km, R = 12 rain^1.5 mm/h) as summed extinctions - Koschmieder's 3.912
  // TWO PROPOSED TERMS on 07_day's mistRho0 (§3.4, not in the game today): RADIATION fog needs CALM air (it is gone by
  // ~10 kt: the wind mixes it), and an ADVECTION fog (`fog: { where: 'sea', hold }`, hold a 0..1 track) is a declared
  // layer of saturated marine air - it neither needs the island's own humidity nor burns off with the lagged sun; the
  // day decides when it rolls in and out. TODAY the game draws d.mistRho0 (the radiation law alone).
  const fogHold = W.meta.fogHold, calm = 1 - smooth((kts - 3) / 7);
  const rhK = Math.pow(clamp((d.rh - 0.7) / 0.3, 0, 1), 2);
  const mistPlan = 0.0025 * Math.max(rhK * (1 - d.mistBurn) * calm, fogHold);
  const R = 12 * Math.pow(W.meta.rain, 1.5);
  const sig = 3.912 / d.visibilityKm + mistPlan * 1000 + (R > 0 ? 0.25 * Math.pow(R, 0.63) : 0);
  const cover = d.cloudCoverEff;
  const dark = smooth((-6 - d.sunEl) / 9);                   // 0 at civil dusk, 1 at -15 deg
  const moonWash = d.moonUp ? 0.5 * d.moonPhase : 0;
  const auroraVis = clamp((W.meta.kp - 2) / 4, 0, 1) * dark * (1 - moonWash) * (1 - Math.pow(cover, 1.5));
  return { W, d, air, kts, gust, dir, visKm: 3.912 / sig, cover, auroraVis, mistPlan };
}
// ---- THE CLASSIFIER (§4.2): a VFR pilot's reading of the hour at sea level --------------------------------------
function flyClass(x) {
  const gk = x.kts * (1 + x.gust), base = x.cover >= 0.5 ? x.d.cloudBase : 9999;
  if (x.kts <= 12 && gk <= 20 && base >= 600 && x.visKm >= 8 && x.W.meta.rain < 0.2) return 'easy';
  if (x.kts <= 20 && gk <= 30 && base >= 300 && x.visKm >= 3 && x.W.meta.rain < 0.5) return 'care';
  return 'NO';
}
const absLocal = (date, h) => { const j = jdnOf(date); return j * 86400 + (h - alm(j).off) * 3600; };
const f1 = v => (v == null ? '-' : v.toFixed(1)), f0 = v => (v == null ? '-' : Math.round(v).toString());
function row(abs) {
  const x = derive(abs), d = x.d;
  return [String(Math.floor(x.W.meta.localH)).padStart(2, '0') + ':' + String(Math.round(x.W.meta.localH % 1 * 60)).padStart(2, '0'),
    f1(d.oatC), f1(d.dewC), f0(d.qnhEff / 100), String(f0(x.dir)).padStart(3, '0') + '/' + f0(x.kts) + (x.gust * x.kts >= 4 ? 'G' + f0(x.kts * (1 + x.gust)) : ''),
    x.cover.toFixed(2) + ' ' + (d.cloudTypeEff || '') + (x.W.spec.cloudUpper ? '+' + x.W.spec.cloudUpper[0].type + ' ' + x.W.spec.cloudUpper[0].cover.toFixed(2) : ''),
    f0(d.cloudBase), x.visKm >= 99 ? '99+' : f1(x.visKm), (d.mistRho0 * 1000).toFixed(2) + ' / ' + (x.mistPlan * 1000).toFixed(2), x.W.meta.rain.toFixed(2),
    f0(x.air.densityAlt(0)), x.air.sigma(0).toFixed(3),
    d.sunEl.toFixed(0), (d.moonPhase * 100).toFixed(0) + (d.moonUp ? 'up' : ''), f1(x.W.meta.kp), x.auroraVis.toFixed(2), flyClass(x)].join(' | ');
}
const HEAD = 'local | T C | Td C | QNH | wind | low deck + upper | base m | vis km | mist /km today / planned | rain | DA m (s.l.) | sigma | sun | moon % | Kp | aurora | fly';
const HOURS = [5, 8, 11, 14, 17, 20, 23, 26];

const argv = process.argv.slice(2), arg = argv.find(a => !/^--(block|from|to|step)=/.test(a)) || '';
const opt = k => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const pickBlocks = () => { const b = opt('block'); return b ? BLOCKS.filter(x => x.id === b) : BLOCKS; };
// a day's daylight half-hours, classified
function flyDay(date) {
  const j = jdnOf(date), A = alm(j), cnt = { easy: 0, care: 0, NO: 0 }, care = [], nofly = [];
  for (let h = Math.ceil(A.tr); h <= Math.floor(A.ts); h += 0.5) { const c = flyClass(derive(absLocal(date, h))); cnt[c]++; if (c === 'care') care.push(h); if (c === 'NO') nofly.push(h); }
  return { cnt, care, nofly };
}
const span = hs => { if (!hs.length) return ''; const out = []; let a = hs[0], b = hs[0];
  for (const h of hs.slice(1)) { if (h === b + 0.5) b = h; else { out.push([a, b]); a = b = h; } } out.push([a, b]);
  const t = h => String(Math.floor(h)).padStart(2, '0') + ':' + (h % 1 ? '30' : '00');
  return out.map(([x, y]) => t(x) + '-' + t(y + 0.5)).join(', '); };
if (require.main !== module) { /* a library */ }
else if (arg === '--season') {
  // THE BLOCK TABLE: the dates, the normals at both ends, and what each block's 14 days hold
  console.log('| block | dates | days in 2026 | normals (low/high °C) | easy · moderate · storm days | fog mornings | aurora nights (Kp ≥ 4) |');
  console.log('|---|---|---|---|---|---|---|');
  for (const b of BLOCKS) {
    const y0 = jdnOf('2026-' + b.from), y1 = jdnOf('2026-' + b.to), n0 = normals(y0), n1 = normals(y1);
    const k = { easy: 0, moderate: 0, storm: 0 };
    for (const D of b.days) k[D.fly === 'storm' ? 'storm' : D.fly === 'moderate' ? 'moderate' : 'easy']++;
    const fog = b.days.filter(D => D.fog).length, aur = b.days.filter(D => (D.aurora || []).some(a => a[1] >= 4)).length;
    console.log('| ' + b.id + ' | ' + b.from + ' → ' + b.to + ' | ' + (y1 - y0 + 1) + ' | ' + n0[1].toFixed(1) + '/' + n0[0].toFixed(1) + ' → ' + n1[1].toFixed(1) + '/' + n1[0].toFixed(1)
      + ' | ' + k.easy + ' · ' + k.moderate + ' · ' + k.storm + ' | ' + fog + ' | ' + aur + ' |');
  }
  // every aurora night of the season, its darkness and its moon
  console.log('\nevery aurora night (Kp >= 4 at the night\'s peak) in the 2026 season, at its local 00:30:');
  for (let j = jdnOf('2026-05-20'); j <= jdnOf('2026-09-30'); j++) {
    const D = planAt(j), pk = Math.max(0, ...(D.aurora || []).map(a => a[1]));
    if (pk < 4) continue;
    const x = derive(absLocal(dateOf(j + 1), 0.5));
    console.log('  ' + dateOf(j) + ' ' + idxOf(j).b.id.padEnd(5) + ' ' + D.id.padEnd(20) + ' Kp ' + pk + '  sun ' + x.d.sunEl.toFixed(1) + '  moon ' + (x.d.moonPhase * 100).toFixed(0) + '%' + (x.d.moonUp ? ' up  ' : ' down') + '  cover ' + x.cover.toFixed(2) + '  aurora ' + x.auroraVis.toFixed(2));
  }
} else if (arg === '--smooth') {
  // walk the dates minute by minute (--step minutes); the biggest step per minute of each quantity, over the whole walk
  // and within a day of each block edge (a pop would show as a big step)
  const from = jdnOf('2026-' + (opt('from') || '05-20')), to = jdnOf('2026-' + (opt('to') || '09-30')), step = +(opt('step') || 1);
  const edges = BLOCKS.slice(1).map(b => jdnOf('2026-' + b.from));
  const a0 = from * 86400 + (4 - alm(from).off) * 3600, N = Math.floor((to - from + 1) * 1440 / step), worst = {}, worstE = {};
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const abs = a0 + i * 60 * step, x = derive(abs), cur = { T: x.d.oatC, Td: x.d.dewC, qnh: x.d.qnhEff / 100, kts: x.kts,
      cover: x.cover, base: x.d.cloudBase, vis: Math.min(x.visKm, 100), kp: x.W.meta.kp, rain: x.W.meta.rain, mist: x.mistPlan * 1000 };
    const at = x.W.date + ' ' + f1(x.W.meta.localH) + 'h ' + x.W.meta.block + '/' + x.W.meta.id, jd = Math.floor(abs / 86400);
    const nearEdge = edges.some(e => Math.abs(jd - e) <= 1);
    if (prev) for (const k of Object.keys(cur)) {
      const s = Math.abs(cur[k] - prev[k]) / step;
      if (!worst[k] || s > worst[k].s) worst[k] = { s, at };
      if (nearEdge && (!worstE[k] || s > worstE[k].s)) worstE[k] = { s, at };
    }
    prev = cur;
  }
  console.log('| quantity | largest step per minute, the season | where | within a day of a block edge | where |');
  console.log('|---|---|---|---|---|');
  for (const k of Object.keys(worst)) console.log('| ' + k + ' | ' + worst[k].s.toFixed(4) + ' | ' + worst[k].at + ' | ' + (worstE[k] ? worstE[k].s.toFixed(4) : '-') + ' | ' + (worstE[k] ? worstE[k].at : '') + ' |');
} else if (arg === '--fly') {
  const tot = { easy: 0, care: 0, NO: 0 };
  for (const b of pickBlocks()) {
    const bt = { easy: 0, care: 0, NO: 0 };
    console.log('\n**' + b.id + '** (' + b.from + ' → ' + b.to + ', dates of 2026)\n');
    console.log('| # | day | date | authored | easy | care | no-fly | no-fly hours | care hours |'); console.log('|---|---|---|---|---|---|---|---|---|');
    b.days.forEach((D, k) => {
      const date = blockDate(b, k), r = flyDay(date);
      for (const c of Object.keys(bt)) bt[c] += r.cnt[c];
      console.log('| ' + (k + 1) + ' | ' + D.id + ' | ' + date + ' | ' + D.fly + ' | ' + r.cnt.easy + ' | ' + r.cnt.care + ' | ' + r.cnt.NO + ' | ' + span(r.nofly) + ' | ' + span(r.care) + ' |');
    });
    const n = bt.easy + bt.care + bt.NO;
    console.log('| | **' + b.id + '** | | | **' + bt.easy + ' (' + Math.round(100 * bt.easy / n) + ' %)** | **' + bt.care + ' (' + Math.round(100 * bt.care / n) + ' %)** | **' + bt.NO + ' (' + Math.round(100 * bt.NO / n) + ' %)** | | |');
    for (const c of Object.keys(tot)) tot[c] += bt[c];
  }
  const n = tot.easy + tot.care + tot.NO;
  console.log('\nall blocks: easy ' + tot.easy + ' (' + Math.round(100 * tot.easy / n) + ' %), care ' + tot.care + ' (' + Math.round(100 * tot.care / n) + ' %), no-fly ' + tot.NO + ' (' + Math.round(100 * tot.NO / n) + ' %) of ' + n + ' daylight half-hours');
} else if (arg === '--check') {
  // THE BLOCKS' RULES (§10.4): what GATE WEATHERPLAN would hold on the data. Exit 1 on any failure.
  let bad = 0; const no = m => { console.log('  FAIL ' + m); bad++; }, okm = m => console.log('  ok   ' + m);
  const ids = new Set();
  for (const b of BLOCKS) {
    if (b.days.length !== 14) no(b.id + ': ' + b.days.length + ' days, not 14');
    b.days.forEach((D, k) => {
      const tag = b.id + '/' + (k + 1) + ' ' + D.id;
      if (ids.has(D.id)) no(tag + ': the id is used twice'); ids.add(D.id);
      for (const f of ['v', 'id', 'name', 'story', 'fly', 'forecast', 'temp', 'dew', 'qnh', 'wind']) if (D[f] == null) no(tag + ': no `' + f + '`');
      if (!['easy', 'easy-after-wait', 'moderate', 'storm'].includes(D.fly)) no(tag + ': fly `' + D.fly + '`');
      // a fair day's dawn stays clear: its dew point at dawn is >= 3.5 C under its minimum (§3.4) - fog and storm days excepted
      if (!D.fog && D.fly !== 'storm' && !(D.dew[0][1] <= (D.temp.min || 0) - 3.5 + 1e-9)) no(tag + ': dawn spread ' + ((D.temp.min || 0) - D.dew[0][1]).toFixed(1) + ' C < 3.5 on a day with no declared fog');
      // a storm is forecast: it says so, it has a no-fly window, and the two days before it say it is coming
      if (D.fly === 'storm') {
        if (!/STORM|GALE/.test(D.forecast) || !(D.noFly && D.noFly.length)) no(tag + ': a storm day must say STORM/GALE and carry noFly');
        for (const back of [1, 2]) { const P = b.days[mod(k - back, 14)]; if (!/front|storm|gale/i.test(P.forecast)) no(tag + ': day ' + (mod(k - back, 14) + 1) + ' (' + P.id + ') does not forecast it'); }
      }
      // no cloud type changes under cover in daylight
      const date = blockDate(b, k), A = alm(jdnOf(date));
      for (let h = Math.ceil(A.tr); h <= Math.floor(A.ts); h += 0.5) { const x = weatherAt(absLocal(date, h)); if ((x.meta.dipLow && x.spec.cloudCover > 0.05) || (x.meta.dipUp && x.spec.cloudUpper && x.spec.cloudUpper[0].cover > 0.05)) { no(tag + ': a cloud type changes under cover at ' + h + ' h'); break; } }
    });
    // the authored class against the classifier: an `easy` day is easy for >= 85 % of its daylight, a storm day has no-fly hours
    let easyN = 0, n = 0;
    b.days.forEach((D, k) => { const r = flyDay(blockDate(b, k)), t = r.cnt.easy + r.cnt.care + r.cnt.NO; easyN += r.cnt.easy; n += t;
      if (D.fly === 'easy' && r.cnt.easy < 0.85 * t) no(b.id + '/' + (k + 1) + ' ' + D.id + ': authored easy, ' + r.cnt.easy + ' of ' + t + ' easy');
      if (D.fly === 'storm' && r.cnt.NO === 0) no(b.id + '/' + (k + 1) + ' ' + D.id + ': a storm with no no-fly hour');
      // a declared no-VFR window holds every no-fly daylight half-hour of the day (to the half-hour), and is mostly no-fly
      if (D.noFly) { const hh = s => { const m = /^(\d\d):(\d\d)$/.exec(s); return +m[1] + m[2] / 60; };
        const W = D.noFly.map(w => [hh(w[0]), hh(w[1])]), inW = h => W.some(([a, z]) => h >= a - 0.5 && h + 0.5 <= z + 0.5);
        const out = r.nofly.filter(h => !inW(h)); if (out.length) no(b.id + '/' + (k + 1) + ' ' + D.id + ': no-fly outside its declared window at ' + span(out));
        const wl = W.reduce((t, [a, z]) => t + (z - a) * 2, 0); if (r.nofly.length < 0.75 * wl) no(b.id + '/' + (k + 1) + ' ' + D.id + ': its window is ' + wl + ' half-hours, only ' + r.nofly.length + ' are no-fly'); } });
    (easyN >= 0.6 * n ? okm : no)(b.id + ': ' + Math.round(100 * easyN / n) + ' % of daylight easy (the bar: 60 %)');
  }
  console.log('PLAN CHECK: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS')); process.exit(bad ? 1 : 0);
} else {
  for (const b of pickBlocks()) b.days.forEach((D, k) => {
    const date = blockDate(b, k);
    console.log('\n#### ' + b.id + ' ' + (k + 1) + '. ' + D.name + ' (' + D.id + ', ' + date + ', ' + D.fly + ')\n');
    console.log('| ' + HEAD + ' |'); console.log('|' + HEAD.split('|').map(() => '---').join('|') + '|');
    for (const h of HOURS) console.log('| ' + row(absLocal(h < 24 ? date : dateOf(jdnOf(date) + 1), h % 24)) + ' |');
  });
}
module.exports = { weatherAt, derive, DAYS, BLOCKS, EPOCH, planAt, idxOf };
