// ============================================================
// THE SIM CLOCK'S PURE HALF (G2650 SIM-CLOCK, 2026-10-08).
//
// The user (7 Oct): "some contracts could require that you get there at a
// certain time of the day, and you could wait it out. We'll need a real sim
// clock that we can act on, and this will gradually replace our day
// settings." futureDesigns/GAME-2026-10-06.md §R.3 (GQ17 amended).
//
// THERE IS STILL ONE CLOCK: the DAY (07_day.js) - its date and its UT second,
// advanced only by the viewer's tick, `version` bumped only by set(). This
// file holds NO state and makes no second clock: it is arithmetic ON a day.
//   dayPresetUtc(day, name)      the presets' solver (dawn .. night), on the
//                                day's own almanac and its own UT date - moved
//                                here from viewer/day_clock.js verbatim, so the
//                                sandbox's presets and the career's waits are
//                                one solver
//   dayWaitUntil(day, target)    "wait until dawn / noon / dusk / 06:30": the
//                                FIRST such instant after now - today's when it
//                                is still ahead, else the next day's. A wait
//                                only ever goes forward. -> { date, utc, ... }
//   dayNextFullMoon(day)         the next full moon (06_solar's moon phase at
//                                its maximum), landed at the dusk nearest it
//   dayMoonAt(day, date, hour)   the moon at a LOCAL date and hour: { phase:
//                                'full'|'gibbous'|'half'|'crescent'|'new',
//                                illum 0-1, up } (NIGHT-OPS' job lines)
//   dayDuskDawnH(day)            the day's civil dusk / dawn as LOCAL hours
//   dayAbs / dayFromAbs          an instant as one number (jdn x 86400 + utc)
//                                and back: what "forward" is measured on
// A JUMP (a wait, a set) is ONE DAY.set({ date, utc }) by the viewer
// (DAY_CLOCK.jump, the only door). Nothing here touches a day; a scratch day
// (DAY.makeDay on the same geo) answers "what is the almanac on that date".
// No Date, no THREE, no DOM, no random.
// ============================================================
const DAY_WAIT_TARGETS = ['dawn', 'morning', 'noon', 'afternoon', 'golden', 'sunset', 'dusk', 'night'];
const DAY_WAIT_MIN_S = 30;                 // a wait lands at least this far ahead (else: the next one)
const DAY_MOON_WORDS = [[0.95, 'full'], [0.65, 'gibbous'], [0.35, 'half'], [0.05, 'crescent'], [-1, 'new']];

const dkPad = n => String(n).padStart(2, '0');
function dayJdnOf(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
  if (!m) throw new Error('clock: date must be YYYY-MM-DD, got ' + date);
  return SOLAR.jdn(+m[1], +m[2], +m[3]);
}
function dayDateOf(jdn) { const c = SOLAR.civil(jdn); return c.y + '-' + dkPad(c.m) + '-' + dkPad(c.d); }
// an instant as one number: the UT seconds since the epoch of the julian day numbers
function dayAbs(o) {
  if (!o) return NaN;
  const j = typeof o.jdn === 'number' ? o.jdn : dayJdnOf(o.date);
  return j * 86400 + (+o.utc || 0);
}
function dayFromAbs(abs) {
  const j = Math.floor(abs / 86400);
  return { date: dayDateOf(j), utc: abs - j * 86400 };
}
// a scratch day at an instant, on the day's own geo: the almanac of another date, never the live day
function dayProbe(day, abs) {
  const o = dayFromAbs(abs);
  return DAY.makeDay({ date: o.date, utc: o.utc }, day.geo);
}

// THE PRESETS' SOLVER (moved from viewer/day_clock.js, G2650): the UT second on the day's own UT date for a named
// hour; every fallback is a real hour on that date (the poles: no sunrise, no dusk - the solar noon +- a fraction)
function dayPresetUtc(day, name) {
  const noon = day.noonUtc, rise = day.sunriseUtc, set = day.sunsetUtc;
  const at = (el, rising, fb) => { const u = day.utcFor(el, rising); return u != null ? u : fb; };
  switch (name) {
    case 'noon': return noon;
    case 'night': return noon - 43200 >= 0 ? noon - 43200 : noon + 43200;
    case 'morning': return at(25, true, rise != null ? (rise + noon) / 2 : noon - 10800);
    case 'afternoon': return at(33.4, false, set != null ? (set + noon) / 2 : noon + 7200);   // the alps row's hour, the anchor the lights were judged in
    case 'golden': return at(8, false, set != null ? (set + noon) / 2 : noon + 10800);
    case 'sunset': return at(-0.833, false, set != null ? set : noon + 21600);
    case 'dawn': return at(-6, true, rise != null ? rise - 1800 : noon - 43200);
    case 'dusk': return at(-6, false, set != null ? set + 1800 : noon + 43200);
  }
  return noon;
}
// the named hour's instants around `abs` (the UT dates before and after), ascending
function dayPresetAbsAround(day, name, abs, before, after) {
  const J = Math.floor(abs / 86400), out = [];
  for (let j = J - before; j <= J + after; j++) {
    const p = DAY.makeDay({ date: dayDateOf(j), utc: 43200 }, day.geo);
    out.push(j * 86400 + dayPresetUtc(p, name));
  }
  return out.sort((a, b) => a - b);
}
// "HH:MM" | number (local hours) | { localHours } -> local hours, or null
function dayTargetHours(t) {
  if (typeof t === 'number' && isFinite(t)) return ((t % 24) + 24) % 24;
  if (t && typeof t === 'object' && typeof t.localHours === 'number' && isFinite(t.localHours)) return ((t.localHours % 24) + 24) % 24;
  const m = typeof t === 'string' ? /^(\d{1,2}):(\d{2})$/.exec(t) : null;
  if (m && +m[1] < 24 && +m[2] < 60) return +m[1] + (+m[2]) / 60;
  return null;
}

// WAIT IT OUT (G2650): the first instant after now when the target happens - a named hour (the presets' own
// solver, on that date's almanac) or a local clock time - today's when it is still ahead (by DAY_WAIT_MIN_S),
// else the next day's. Always forward, never more than ~a day and a half. -> { date, utc, abs, waitS, target }
// or null for a target it does not know.
function dayWaitUntil(day, target) {
  const A = dayAbs(day);
  let abs = null;
  if (DAY_WAIT_TARGETS.includes(target)) {
    abs = dayPresetAbsAround(day, target, A, 1, 2).find(x => x >= A + DAY_WAIT_MIN_S);
  } else {
    const h = dayTargetHours(target);
    if (h == null) return null;
    const want = h * 3600;
    let dt = ((want - day.localSeconds) % 86400 + 86400) % 86400;
    if (dt < DAY_WAIT_MIN_S) dt += 86400;
    abs = A + dt;
    // a daylight-saving change between now and then moves the local clock by an hour: land on the clock time
    const p = dayProbe(day, abs);
    let off = want - p.localSeconds;
    if (off > 43200) off -= 86400; else if (off < -43200) off += 86400;
    if (off !== 0 && Math.abs(off) <= 3600 && abs + off >= A + DAY_WAIT_MIN_S) abs += off;
  }
  if (abs == null || !isFinite(abs)) return null;
  const o = dayFromAbs(abs);
  return { date: o.date, utc: o.utc, abs, waitS: abs - A, target };
}

// the moon's illuminated fraction at an instant (06_solar, the day's place)
function dayMoonIllumAbs(day, abs) {
  const j = Math.floor(abs / 86400);
  return SOLAR.moon({ jdn: j, utc: abs - j * 86400, lat: day.geo.lat, lon: day.geo.lon }).phase;
}
// THE NEXT FULL MOON (G2650, the sandbox's "next full moon"; the career only waits): the moon's phase at its next
// maximum after now (3 h steps over a lunation and a half, then a golden-section search to a minute), landed at the
// civil dusk nearest it that is still ahead - a full moon rises about sunset, so dusk is when it is there to be seen.
// -> { date, utc, abs, full: { date, utc, abs, illum }, illum (at the landing) } or null (none found: never, by
// construction; a guard).
function dayNextFullMoon(day) {
  const A = dayAbs(day), H = 3 * 3600, f = t => dayMoonIllumAbs(day, t);
  let prev = f(A), cur = f(A + H), at = null;
  for (let k = 2; k < 8 * 45 && at == null; k++) {
    const nxt = f(A + k * H);
    if (cur >= prev && cur >= nxt && cur > 0.9) at = A + (k - 1) * H;
    prev = cur; cur = nxt;
  }
  if (at == null) return null;
  let lo = at - H, hi = at + H;
  const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 40 && hi - lo > 60; i++) {
    const m1 = hi - g * (hi - lo), m2 = lo + g * (hi - lo);
    if (f(m1) >= f(m2)) hi = m2; else lo = m1;
  }
  const full = Math.round((lo + hi) / 2);
  const dusks = dayPresetAbsAround(day, 'dusk', full, 2, 2).filter(x => x >= A + DAY_WAIT_MIN_S);
  if (!dusks.length) return null;
  const land = dusks.reduce((b, x) => (Math.abs(x - full) < Math.abs(b - full) ? x : b), dusks[0]);
  const o = dayFromAbs(land), F = dayFromAbs(full);
  return { date: o.date, utc: o.utc, abs: land, full: { date: F.date, utc: F.utc, abs: full, illum: f(full) }, illum: f(land) };
}

// the local-time offset (hours) of the day's geo at an instant (07_day's own tz rule)
function dayOffsetAt(day, abs) {
  const tz = day.geo && day.geo.tz;
  if (!tz) return 0;
  const j = Math.floor(abs / 86400);
  return tz.std + (tz.dst === 'us' && DAY.usDst(j, abs - j * 86400, tz.std) ? 1 : 0);
}
// a LOCAL date + hour -> the instant (the offset taken where it lands: a DST morning is its own hour)
function dayLocalAbs(day, date, hour) {
  const j = date ? dayJdnOf(date) : dayJdnOf(day.localDate);
  const h = hour != null ? +hour : day.localSeconds / 3600;
  let abs = j * 86400 + h * 3600 - day.offsetH * 3600;
  abs = j * 86400 + h * 3600 - dayOffsetAt(day, abs) * 3600;
  return abs;
}
const dayMoonWord = illum => DAY_MOON_WORDS.find(w => illum >= w[0])[1];
// THE MOON AT A LOCAL DATE AND HOUR (G2650, for NIGHT-OPS' job lines: "full moon, up" / "no moon"): 06_solar's
// moon at that instant, on the day's geo. date null: the day's local date; hour null: the day's local hour.
function dayMoonAt(day, date, hour) {
  const abs = dayLocalAbs(day, date, hour), j = Math.floor(abs / 86400);
  const m = SOLAR.moon({ jdn: j, utc: abs - j * 86400, lat: day.geo.lat, lon: day.geo.lon });
  return { phase: dayMoonWord(m.phase), illum: m.phase, up: m.el >= 0, waxing: m.waxing, el: m.el, abs };
}
// the day's civil dawn and dusk as LOCAL hours (the sun 6 deg under, the presets' own) - what a contract's
// "after dusk" / "before dawn" would be judged on by the almanac (73_contracts.js takes them on a stop record)
function dayDuskDawnH(day) {
  const loc = u => ((((u + day.offsetH * 3600) % 86400) + 86400) % 86400) / 3600;
  return { dawnH: loc(dayPresetUtc(day, 'dawn')), duskH: loc(dayPresetUtc(day, 'dusk')) };
}
