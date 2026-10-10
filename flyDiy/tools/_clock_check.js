#!/usr/bin/env node
// ============================================================================
// GATE CLOCK — THE SIM CLOCK AS GAME STATE (G2650 SIM-CLOCK, GAME-2026-10-06.md
// §R.3, GQ17 amended): one clock (07_day.js DAY), acted on.
// ============================================================================
// What is held, in blocks:
//   ADVANCE        day.advance() / world.dayTick() never bump `version` (the
//                  re-bakes' trigger: atmo.js's probe, render_world's applyDay)
//                  - an hour of 60 Hz ticks and a week at 600x, midnight
//                  crossed; one set() bumps it exactly once.
//   MIDNIGHT       the date is honest: crossing midnight (UT and local) moves
//                  the date on, never frozen, never wrapped; forty days of
//                  ticks land forty days on, and the moon's phase on the day is
//                  06_solar's at that instant (it follows the calendar).
//   WAIT           dayWaitUntil(day, target) over every named hour and clock
//                  times, from three seasons and six hours of the day: always
//                  forward, within ~a day and a half, ON the solved hour (the
//                  sun at the preset's elevation; the local clock at hh:mm), the
//                  FIRST such instant (today's while ahead, else the next day's).
//   FULL MOON      dayNextFullMoon lands at a dusk with the moon >= 97 % lit,
//                  the full moon it names is 06_solar's maximum (lower 6 h each
//                  side) and the next one (within a lunation).
//   MOON AT        dayMoonAt(day, date, hour) is 06_solar's moon at that LOCAL
//                  date and hour (the DST offset of the instant itself): the
//                  illumination bit-equal, `up` its elevation's sign, the words
//                  by the declared thresholds.
//   CAREER         its day only moves forward (careerDaySet refuses the past,
//                  the document untouched); the document round-trips (a
//                  normaliser fixpoint through JSON); a v1 career lifts to the
//                  day its flown clock implies (CAREER_DAY0 + clock, cv 2); the
//                  sandbox's player document is unchanged (no `day`).
//   WHEN           every `when` word validates ({before:'dusk'}, {after:'dusk'},
//                  {before:'dawn'}, {arrive:[h0,h1]}), a deadline / junk does
//                  not; each is judged by contractSubOnStop on stop.hour (the
//                  wrap through midnight, the stop's own dusk / dawn, an
//                  unknown hour refusing nothing), and said in words.
//   THE JUMP       viewer/day_clock.js in a vm over a real world: a preset, a
//                  wait, an hour set, the next full moon are each ONE
//                  world.setDay and ONE version bump, counted (`jumps`,
//                  `lastJump.why`, the 'flydiy:dayjump' event); the tick is
//                  never one. In the career: a jump back refused, a preset
//                  WAITS forward, the rate held at real time, no "next full
//                  moon", every save handing the instant to the document; a
//                  wait refused off the ground (the page's guard).
//   ONE SOLVER     the presets' solver is the core's (dayPresetUtc): the
//                  clock's presetUtc equals it on every preset and date.
//
//   node tools/_clock_check.js             -> "GATE CLOCK: PASS|FAIL"
//   node tools/_clock_check.js --selftest  -> each rule broken in its own source must turn a check red
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const CORE = require('./flight_core.js');
const SELF = process.argv.includes('--selftest');
const SRC = {
  clock: fs.readFileSync(path.join(ROOT, 'src', 'core', '07b_clock.js'), 'utf8'),
  c73: fs.readFileSync(path.join(ROOT, 'src', 'core', '73_contracts.js'), 'utf8'),
  c74: fs.readFileSync(path.join(ROOT, 'src', 'core', '74_career.js'), 'utf8'),
  dc: fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'day_clock.js'), 'utf8'),
};
const namesOf = s => [...s.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);

// the clock's pure half, 73_ and 74_ evaluated FRESH over the core's globals (minus their own names), so the
// selftest doctors exactly the rule under test; day_clock.js over that, with a small window / storage
function loadModel(mut) {
  const src = {};
  for (const k of Object.keys(SRC)) src[k] = (mut && mut[k]) ? mut[k](SRC[k]) : SRC[k];
  const names = [].concat(namesOf(src.clock), namesOf(src.c73), namesOf(src.c74)).filter((n, i, a) => a.indexOf(n) === i);
  const base = Object.assign({ console }, CORE);
  for (const n of names) delete base[n];
  const ctx = vm.createContext(base);
  vm.runInContext(src.clock + '\n' + src.c73 + '\n' + src.c74 + '\n;this.__M = { ' + names.join(', ') + ' };', ctx, { filename: 'clock' });
  const M = ctx.__M;
  // day_clock.js: a page of its own (window, storage, an event), the model's core in scope
  M.page = () => {
    const store = new Map(), events = [];
    const win = { location: { search: '' }, addEventListener() {}, dispatchEvent: e => { events.push(e); return true; } };
    const pctx = vm.createContext(Object.assign({}, base, M, {
      window: win, localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
      CustomEvent: function (type, o) { this.type = type; this.detail = o && o.detail; }, performance: { now: () => 0 },
    }));
    vm.runInContext(src.dc + '\n;this.__DC = DAY_CLOCK;', pctx, { filename: 'day_clock.js' });
    return { DC: pctx.__DC, store, events };
  };
  return M;
}

function run(mut) {
  const M = loadModel(mut);
  const fails = []; let checks = 0;
  const ok = (c, msg) => { checks++; if (!c) fails.push(msg); return !!c; };
  const J = JSON.stringify, clone = o => JSON.parse(J(o));
  const abs = d => M.dayAbs(d);
  const at = (date, localHours) => { const d = CORE.DAY.makeDay({ date }); d.set({ localHours }); return d; };

  // ==== ADVANCE never bumps the version; set bumps it once ====================================================
  {
    const d = CORE.DAY.makeDay({ date: '2026-06-21', utc: 23 * 3600 });
    const v0 = d.version;
    for (let i = 0; i < 3600 * 60; i++) d.advance(1 / 60);
    ok(d.version === v0, 'an hour of 60 Hz ticks bumped the day\'s version (' + v0 + ' -> ' + d.version + ')');
    d.set({ rate: 600 });
    const v1 = d.version;
    ok(v1 === v0 + 1, 'one set() bumps the version exactly once');
    for (let i = 0; i < 7 * 24 * 6; i++) d.advance(1);      // a week at 600x, one-second steps
    ok(d.version === v1, 'a week at 600x (midnight crossed seven times) bumped the version');
    const W = CORE.makeWorld(0), wv = W.day.version;
    for (let i = 0; i < 600; i++) W.dayTick(1 / 60, i / 60, 0, 0);
    ok(W.day.version === wv, 'world.dayTick (the viewer\'s and the worker\'s tick) bumped the day\'s version');
  }
  // ==== MIDNIGHT: the date is honest =======================================================================
  {
    const d = CORE.DAY.makeDay({ date: '2026-06-21', utc: 86400 - 30 });
    d.advance(60);
    ok(d.date === '2026-06-22' && Math.abs(d.utc - 30) < 1e-6, 'UT midnight crossed: the date moved on (' + d.date + ' ' + d.utc + ')');
    const L = at('2026-06-21', 23.99);
    const ld0 = L.localDate; L.advance(120);
    ok(ld0 === '2026-06-21' && L.localDate === '2026-06-22', 'local midnight crossed: the local date moved on (' + ld0 + ' -> ' + L.localDate + ')');
    const F = CORE.DAY.makeDay({ date: '2026-06-21', utc: 3600, rate: 600 }), a0 = abs(F);
    for (let i = 0; i < 40 * 144; i++) F.advance(1);          // forty days at 600x (144 s of play a day)
    ok(F.date === '2026-07-31' && Math.abs(abs(F) - a0 - 40 * 86400) < 1e-3, 'forty days of ticks land forty days on (' + F.date + ')');
    const m = CORE.SOLAR.moon({ jdn: F.jdn, utc: F.utc, lat: F.geo.lat, lon: F.geo.lon });
    ok(F.moonPhase === m.phase && Math.abs(F.moonPhase - CORE.DAY.makeDay({ date: '2026-06-21', utc: 3600 }).moonPhase) > 0.05,
      'the moon follows the calendar: the day\'s phase is 06_solar\'s at the instant (and not the first day\'s)');
  }
  // ==== WAIT ===============================================================================================
  const EL = { dawn: -6, morning: 25, afternoon: 33.4, golden: 8, sunset: -0.833, dusk: -6 };
  {
    let n = 0;
    for (const date of ['2026-03-20', '2026-06-21', '2026-12-21'])
      for (const h of [0.5, 4, 9.25, 13, 18.5, 22.9]) {
        const d = at(date, h), A = abs(d);
        for (const t of M.DAY_WAIT_TARGETS) {
          const r = M.dayWaitUntil(d, t);
          const tag = t + ' from ' + date + ' ' + h + ' h';
          if (!ok(r && r.abs >= A + M.DAY_WAIT_MIN_S && r.abs < A + 1.6 * 86400, tag + ': a wait goes forward, within a day and a half (' + (r && (r.waitS / 3600).toFixed(2)) + ' h)')) continue;
          const p = M.dayProbe(d, r.abs);
          // (a winter sun that never climbs to 25 / 33.4 deg: the preset's own fallback, half-way to noon - checked by `first` below)
          const peak = CORE.SOLAR.sun({ jdn: p.jdn, utc: p.noonUtc, lat: p.geo.lat, lon: p.geo.lon }).el;
          if (EL[t] != null && peak > EL[t] + 0.5) ok(Math.abs(p.sunEl - EL[t]) < 0.05, tag + ': lands on the solved hour (the sun at ' + EL[t] + ', got ' + p.sunEl.toFixed(3) + ')');
          if (t === 'noon') ok(Math.abs(p.utc - p.noonUtc) < 1 || Math.abs(p.utc + 86400 - p.noonUtc) < 1 || Math.abs(p.utc - 86400 - p.noonUtc) < 1, tag + ': lands on the solar noon');
          // the FIRST: no instant of the same name between now and the landing
          const prev = M.dayWaitUntil(M.dayProbe(d, A), t);
          ok(prev && prev.abs === r.abs, tag + ': deterministic');
          const firstCheck = [-1, 0, 1, 2].map(k => (Math.floor(A / 86400) + k) * 86400 + M.dayPresetUtc(CORE.DAY.makeDay({ date: M.dayFromAbs((Math.floor(A / 86400) + k) * 86400).date, utc: 43200 }), t))
            .filter(x => x >= A + M.DAY_WAIT_MIN_S).sort((a, b) => a - b)[0];
          ok(Math.abs(firstCheck - r.abs) < 1e-6, tag + ': the first such hour ahead (today\'s while ahead, else the next day\'s)');
          n++;
        }
        for (const hh of ['06:30', '00:00', '23:45', 13.5]) {
          const r = M.dayWaitUntil(d, hh), p = r && M.dayProbe(d, r.abs);
          const want = typeof hh === 'number' ? hh * 3600 : (+hh.slice(0, 2)) * 3600 + (+hh.slice(3)) * 60;
          ok(r && r.waitS >= M.DAY_WAIT_MIN_S && r.waitS <= 86400 + 3600 && Math.abs(p.localSeconds - want) < 1e-3,
            hh + ' from ' + date + ' ' + h + ' h: lands on the local clock time, ahead (' + (p && p.local) + ')');
        }
      }
    // the hour has passed today: tomorrow's
    const d = at('2026-06-21', 23.2), r = M.dayWaitUntil(d, 'dusk'), p = M.dayProbe(d, r.abs);
    ok(p.localDate === '2026-06-22' && r.waitS > 20 * 3600, 'dusk passed (23:12): the wait lands on the next day\'s dusk (' + p.local + ')');
    const e = at('2026-06-21', 10), r2 = M.dayWaitUntil(e, 'dusk'), p2 = M.dayProbe(e, r2.abs);
    ok(p2.localDate === '2026-06-21' && r2.waitS < 14 * 3600, 'dusk ahead (10:00): today\'s dusk (' + p2.local + ')');
    ok(M.dayWaitUntil(e, 'teatime') === null && M.dayWaitUntil(e, '25:00') === null, 'an unknown target is no wait');
    // a DST night: the clock time is the local clock's (2026-11-01 02:00 AKDT -> 01:00 AKST)
    const dst = at('2026-10-31', 22), r3 = M.dayWaitUntil(dst, '06:00'), p3 = M.dayProbe(dst, r3.abs);
    ok(p3.localSeconds === 6 * 3600 && p3.localDate === '2026-11-01' && Math.abs(r3.waitS - 9 * 3600) < 1, 'across the DST change, 06:00 is the local clock\'s 06:00 (' + p3.local + ', ' + (r3.waitS / 3600) + ' h)');
  }
  // ==== FULL MOON ============================================================================================
  for (const date of ['2026-06-21', '2026-01-10', '2026-09-26', '2027-02-14']) {
    const d = at(date, 16), r = M.dayNextFullMoon(d), A = abs(d);
    if (!ok(r, 'next full moon from ' + date + ': found')) continue;
    const p = M.dayProbe(d, r.abs), f = x => M.dayMoonIllumAbs(d, x);
    ok(r.abs > A && r.illum >= 0.97 && Math.abs(p.sunEl + 6) < 0.05, 'next full moon from ' + date + ': lands at a dusk (' + p.local + ', sun ' + p.sunEl.toFixed(2) + ') with the moon ' + (r.illum * 100).toFixed(1) + ' % lit');
    ok(f(r.full.abs) >= f(r.full.abs - 6 * 3600) && f(r.full.abs) >= f(r.full.abs + 6 * 3600) && r.full.illum > 0.99, 'next full moon from ' + date + ': the moon\'s maximum (06_solar)');
    ok(J({ date: r.date, utc: r.utc }) === J(M.dayFromAbs(r.abs)), 'next full moon from ' + date + ': its date / utc are its instant');
    ok(r.full.abs - A < 29.6 * 86400 && Math.abs(r.abs - r.full.abs) < 1.1 * 86400, 'next full moon from ' + date + ': the NEXT one, within a lunation, and the dusk nearest it');
  }
  // ==== MOON AT =============================================================================================
  {
    const d = at('2026-06-21', 16);
    for (const [date, hour] of [['2026-06-21', 23], ['2026-06-29', 23.5], ['2026-07-06', 2], ['2026-12-24', 18], ['2026-11-01', 1.5], ['2026-03-08', 3.25]]) {
      const m = M.dayMoonAt(d, date, hour), p = M.dayProbe(d, m.abs);
      const s = CORE.SOLAR.moon({ jdn: Math.floor(m.abs / 86400), utc: m.abs - Math.floor(m.abs / 86400) * 86400, lat: d.geo.lat, lon: d.geo.lon });
      ok(p.localDate === date && Math.abs(p.localSeconds - hour * 3600) < 1e-3, 'dayMoonAt ' + date + ' ' + hour + ' h: the instant is that local date and hour (' + p.local + ')');
      ok(m.illum === s.phase && m.up === (s.el >= 0) && m.waxing === s.waxing, 'dayMoonAt ' + date + ' ' + hour + ' h: 06_solar\'s moon (illum, up, waxing)');
      const w = m.illum >= 0.95 ? 'full' : m.illum >= 0.65 ? 'gibbous' : m.illum >= 0.35 ? 'half' : m.illum >= 0.05 ? 'crescent' : 'new';
      ok(m.phase === w, 'dayMoonAt ' + date + ' ' + hour + ' h: ' + m.phase + ' for ' + m.illum.toFixed(3));
    }
    const fm = M.dayNextFullMoon(d), F = M.dayProbe(d, fm.abs);
    ok(M.dayMoonAt(d, F.localDate, F.localSeconds / 3600).phase === 'full', 'the next full moon\'s dusk is a full moon by dayMoonAt');
    for (const [x, w] of [[1, 'full'], [0.95, 'full'], [0.9499, 'gibbous'], [0.65, 'gibbous'], [0.6499, 'half'], [0.35, 'half'], [0.3499, 'crescent'], [0.05, 'crescent'], [0.0499, 'new'], [0, 'new']])
      ok(M.dayMoonWord(x) === w, 'the moon at ' + x + ' lit is "' + w + '" (got "' + M.dayMoonWord(x) + '")');
    const now = M.dayMoonAt(d, null, null);
    ok(now.illum === d.moonPhase, 'dayMoonAt(day, null, null) is the day\'s own moon');
  }
  // ==== CAREER =====================================================================================================
  {
    const c0 = M.careerNew({ id: 't', seed: 't' });
    ok(c0.career.cv === 2 && J(c0.career.day) === J({ date: M.CAREER_DAY0.date, utc: M.CAREER_DAY0.utc }), 'a new career starts on the game\'s day (' + J(c0.career.day) + ')');
    const g = CORE.DAY.makeDay({ date: '2026-06-21' }); g.set({ localHours: 16 });
    ok(g.date === M.CAREER_DAY0.date && g.utc === M.CAREER_DAY0.utc, 'CAREER_DAY0 is GAME_DAY\'s 16:00 local (the same picture)');
    const rt = M.careerNormalise(JSON.parse(J(c0)));
    ok(J(rt) === J(c0) && J(M.careerNormalise(JSON.parse(J(rt)))) === J(rt), 'the career document round-trips (a normaliser fixpoint)');
    const fwd = M.careerDaySet(c0, { date: '2026-06-22', utc: 3600 });
    ok(fwd.ok && fwd.dt === 3600 && fwd.doc.career.day.utc === 3600 && c0.career.day.utc === 0, 'the career\'s day moves forward (a new document, the old untouched)');
    const before = J(fwd.doc), back = M.careerDaySet(fwd.doc, { date: '2026-06-22', utc: 1800 });
    ok(!back.ok && back.doc === fwd.doc && J(back.doc) === before && /forward/.test(back.why), 'the career\'s day never goes back (refused, the document untouched)');
    const back2 = M.careerDaySet(fwd.doc, { date: '2026-06-21', utc: 80000 });
    ok(!back2.ok, 'the career\'s day never goes back across a date');
    ok(M.careerDaySet(fwd.doc, { date: '2026-06-22', utc: 3600 }).ok && M.careerDaySet(fwd.doc, { date: '2026-06-22', utc: 3600 }).dt === 0, 'the same instant: ok, no move');
    ok(M.careerDaySet(fwd.doc, { date: '2026-06-23', utc: -3600 }).doc.career.day.date === '2026-06-22', 'an instant is normalised onto its UT date');
    ok(!M.careerDaySet(fwd.doc, { date: 'tuesday', utc: 0 }).ok && !M.careerDaySet(CORE.playerDefault(), { date: '2026-06-23', utc: 0 }).ok, 'junk, and a sandbox document, are refused');
    // v1 -> v2: the day the flown clock implies
    const v1 = clone(c0); delete v1.career.day; v1.career.cv = 1; v1.clock = 7 * 3600 + 25;
    const v2 = M.careerNormalise(v1);
    ok(v2.career.cv === 2 && v2.career.day.date === '2026-06-22' && v2.career.day.utc === 7 * 3600 + 25, 'a v1 career lifts to CAREER_DAY0 + its flown clock (' + J(v2.career.day) + ', cv ' + v2.career.cv + ')');
    const v1b = clone(c0); delete v1b.career.day; v1b.career.cv = 1; v1b.clock = 30 * 3600;
    ok(J(M.careerNormalise(v1b).career.day) === J({ date: '2026-06-23', utc: 6 * 3600 }), 'a v1 career\'s implied day crosses midnight honestly');
    ok(J(M.careerDay(v1b)) === J({ date: '2026-06-23', utc: 6 * 3600 }), 'careerDay reads the implied day of an un-normalised v1 document');
    ok(CORE.playerNormalise(JSON.parse(J(fwd.doc))).career.day.utc === 3600, 'the player normaliser keeps the career\'s day');
    const sb = CORE.playerDefault();
    ok(!('day' in sb) && !('career' in sb) && sb.v === CORE.PLAYER_V && CORE.PLAYER_V === 2, 'the sandbox\'s player document is unchanged (no day: the pref keeps it; PLAYER_V 2)');
  }
  // ==== WHEN ======================================================================================================
  {
    const A = M.contractAuthored(), base = clone(A['minedock.02']);
    const withWhen = w => { const r = clone(base); r.stages[0].subs[0].when = w; return r; };
    for (const w of [{ before: 'dusk' }, { after: 'dusk' }, { before: 'dawn' }, { arrive: [6, 8] }, { arrive: [22, 2] }, { arrive: [0, 24] }])
      ok(M.contractValidate(withWhen(w)).length === 0, J(w) + ' validates' + (M.contractValidate(withWhen(w)).length ? ': ' + M.contractValidate(withWhen(w)).join('; ') : ''));
    for (const w of [{ by: 'friday' }, { before: 'noon' }, { after: 'dawn' }, { arrive: [8, 8] }, { arrive: [25, 3] }, { arrive: [6] }, { arrive: '06-08' }, { before: 'dusk', arrive: [6, 8] }, 'dusk', []])
      ok(M.contractValidate(withWhen(w)).length > 0, J(w) + ' is refused (no deadline, one window, local hours)');
    const words = { 'before dusk': { before: 'dusk' }, 'after dusk': { after: 'dusk' }, 'before dawn': { before: 'dawn' }, 'arrive 06:00-08:00': { arrive: [6, 8] }, 'arrive 22:30-01:15': { arrive: [22.5, 1.25] } };
    for (const k of Object.keys(words)) ok(M.contractWhenWords(words[k]) === k, J(words[k]) + ' says "' + k + '" (got "' + M.contractWhenWords(words[k]) + '")');
    ok(M.contractWhenWords({ by: 'friday' }) === '' && M.contractWhenWords(null) === '', 'no words for no window');
    // judged by contractSubOnStop on stop.hour
    const sub = w => ({ do: 'land', to: 'w3', when: w });
    const judge = (w, hour, extra) => M.contractSubOnStop({ id: 'x', kind: 'job', stages: [] }, sub(w), {}, Object.assign({ aero: 'w3', hour }, extra || {}), null, null).st;
    const D = M.CONTRACT_DUSK_H, N = M.CONTRACT_DAWN_H;
    const table = [
      [{ before: 'dusk' }, [[14, 'done'], [D - 0.01, 'done'], [D, 'no'], [23, 'no'], [null, 'done']]],
      [{ after: 'dusk' }, [[14, 'no'], [D, 'done'], [23.5, 'done'], [1, 'done'], [N - 0.01, 'done'], [N, 'no'], [null, 'done']]],
      [{ before: 'dawn' }, [[0, 'done'], [N - 0.01, 'done'], [N, 'no'], [23, 'no'], [14, 'no']]],
      [{ arrive: [6, 8] }, [[6, 'done'], [7.99, 'done'], [8, 'no'], [5.9, 'no'], [20, 'no']]],
      [{ arrive: [22, 2] }, [[22, 'done'], [23.5, 'done'], [1.5, 'done'], [2, 'no'], [12, 'no']]],
    ];
    for (const [w, rows] of table) for (const [h, want] of rows)
      ok(judge(w, h) === want, J(w) + ' at ' + h + ' h: ' + want + ' (got ' + judge(w, h) + ')');
    ok(judge({ after: 'dusk' }, 21) === 'done' && judge({ after: 'dusk' }, 21, { duskH: 22.5 }) === 'no' && judge({ before: 'dusk' }, 21, { duskH: 22.5 }) === 'done'
      && judge({ before: 'dawn' }, 4, { dawnH: 3.1 }) === 'no', 'the stop\'s own dusk / dawn (the almanac\'s) are used when it carries them');
    const r = M.contractSubOnStop({ id: 'x', kind: 'job', stages: [] }, sub({ arrive: [6, 8] }), {}, { aero: 'w3', hour: 9.5 }, null, null);
    ok(r.st === 'no' && /outside 06:00-08:00 \(9\.5 h\)/.test(r.why), 'a missed window says why ("' + r.why + '")');
    // the wire carries the day's dusk / dawn only when handed them (the record's shape otherwise unchanged)
    const W0 = CORE.careerStopRecord({ how: 'stopped', aero: 'w3', hour: 12 }), W1 = CORE.careerStopRecord({ how: 'stopped', aero: 'w3', hour: 12, duskH: 22.48, dawnH: 3.129 });
    ok(!('duskH' in W0) && W1.duskH === 22.48 && W1.dawnH === 3.13, 'the stop record carries dusk / dawn only when handed them');
    const dd = M.dayDuskDawnH(at('2026-06-21', 12));
    ok(Math.abs(dd.duskH - M.dayProbe(at('2026-06-21', 12), M.dayWaitUntil(at('2026-06-21', 12), 'dusk').abs).localSeconds / 3600) < 1e-6 && dd.dawnH > 2 && dd.dawnH < 4.5,
      'dayDuskDawnH is the almanac\'s dusk / dawn as local hours (' + dd.dawnH.toFixed(2) + ' / ' + dd.duskH.toFixed(2) + ')');
  }
  // ==== THE JUMP (day_clock.js) ==================================================================================
  {
    const mkWorld = () => {
      const W = CORE.makeWorld(0), calls = [];
      const set0 = W.setDay;
      W.setDay = o => { calls.push(clone(o)); return set0(o); };
      return { W, calls };
    };
    // the sandbox
    {
      const { W, calls } = mkWorld(), P = M.page(), DC = P.DC;
      DC.bind(W);
      const timeCalls = () => calls.filter(o => o.date != null || o.utc != null || o.localHours != null).length;
      const t0 = timeCalls(), v0 = W.day.version, j0 = DC.jumps;
      for (let i = 0; i < 600; i++) DC.tick(1 / 60);
      ok(timeCalls() === t0 && W.day.version === v0 && DC.jumps === j0, 'the clock\'s tick is never a jump (no setDay, no version bump)');
      const steps = [['preset', () => DC.preset('dusk'), 'preset:dusk'], ['wait', () => DC.wait('dawn'), 'wait:dawn'], ['wait hh:mm', () => DC.wait('06:30'), 'wait:06:30'],
                     ['the hour', () => DC.set({ localHours: 9 }), 'set'], ['the date', () => DC.set({ date: '2026-08-01' }), 'set'], ['next full moon', () => DC.nextFullMoon(), 'fullmoon']];
      for (const [name, f, why] of steps) {
        const c = timeCalls(), v = W.day.version, j = DC.jumps, e = P.events.length;
        const r = f();
        ok(r && r.ok && timeCalls() === c + 1 && W.day.version === v + 1 && DC.jumps === j + 1 && DC.lastJump.why === why && P.events.length === e + 1 && P.events[e].type === 'flydiy:dayjump',
          name + ': ONE jump (one setDay, one version bump, counted "' + why + '", the event) - got ' + (timeCalls() - c) + ' / ' + (W.day.version - v) + ' / ' + (DC.jumps - j) + ' / ' + (DC.lastJump && DC.lastJump.why));
      }
      const fm = DC.lastJump;
      ok(W.day.moonPhase >= 0.97 && fm.dtS > 0 && Math.abs(W.day.sunEl + 6) < 0.05, 'the sandbox\'s next full moon lands on one (' + (W.day.moonPhase * 100).toFixed(1) + ' %)');
      const back = DC.set({ date: '2026-06-01' });
      ok(back && back.ok && DC.lastJump.dtS < 0, 'the sandbox may set the clock back');
      const wx = timeCalls(), vj = DC.jumps; DC.set({ cloudCover: 0.4 });
      ok(timeCalls() === wx && DC.jumps === vj && W.day.cloudCover === 0.4, 'the weather is a set, not a jump');
      ok(DC.rate(0) === 0 && DC.rate(60) === 60 && DC.rate(1) === 1, 'the sandbox keeps every rate');
      DC.waitGuard(() => 'in flight');
      const vf = W.day.version, rr = DC.wait('dusk');
      ok(rr && !rr.ok && rr.why === 'in flight' && W.day.version === vf, 'a wait off the ground is refused (the page\'s guard), nothing moved');
      DC.waitGuard(null);
      for (const p of M.DAY_WAIT_TARGETS) ok(DC.presetUtc(p) === M.dayPresetUtc(W.day, p), 'one solver: the clock\'s ' + p + ' is the core\'s dayPresetUtc');
      const pref = JSON.parse(P.store.get('flydiy.day.v3'));
      ok(pref && pref.date === W.day.date, 'the sandbox saves its instant in its pref (flydiy.day.v3)');
    }
    // the career
    {
      const { W, calls } = mkWorld(), P = M.page(), DC = P.DC;
      P.store.set('flydiy.day.v3', J({ date: '2026-01-05', utc: 3600, rate: 0 }));
      DC.bind(W);
      let doc = M.careerNew({ id: 't', seed: 't' }); doc = M.careerDaySet(doc, { date: '2026-06-23', utc: 7200 }).doc;
      const puts = [];
      DC.career({ get: () => M.careerDay(doc), put: o => { puts.push(o); const r = M.careerDaySet(doc, o); if (r.ok) doc = r.doc; } });
      ok(DC.isCareer() && W.day.date === '2026-06-23' && W.day.utc === 7200 && W.day.rate === 1, 'the career\'s clock is its document\'s (not the pref\'s), in real time');
      const a0 = abs(W.day);
      const r1 = DC.set({ date: '2026-06-22' });
      ok(r1 && !r1.ok && abs(W.day) === a0, 'the career\'s clock is never set back');
      const r2 = DC.preset('noon');
      ok(r2 && r2.ok && DC.lastJump.why === 'wait:noon' && DC.lastJump.dtS > 0 && abs(W.day) > a0, 'in the career a preset WAITS for the hour, forward');
      ok(DC.rate(0) === 1 && DC.rate(600) === 1, 'the career\'s rate stays real time (no frozen clock, no fast-forward)');
      ok(!DC.nextFullMoon().ok, 'the career reaches a full moon only by waiting');
      const r3 = DC.wait('dusk'), p3 = W.day;
      ok(r3.ok && Math.abs(p3.sunEl + 6) < 0.05, 'a career wait lands on the solved hour');
      ok(puts.length > 0 && J(M.careerDay(doc)) === J({ date: W.day.date, utc: Math.round(W.day.utc) }), 'each save hands the instant to the career document');
      const pref = JSON.parse(P.store.get('flydiy.day.v3'));
      ok(pref.date === '2026-01-05' && pref.utc === 3600 && pref.rate === 0, 'the career leaves the sandbox\'s pref instant alone');
      for (let i = 0; i < 1800 * 60; i++) DC.tick(1 / 60);
      ok(J(M.careerDay(doc)) === J({ date: W.day.date, utc: Math.round(W.day.utc) }) || abs(W.day) - abs(M.careerDay(doc)) <= 30.5, 'the flown time reaches the document (the clock\'s 30 s save)');
    }
  }
  return { fails, checks };
}

const base = run(null);
if (!SELF) {
  for (const f of base.fails) console.log('  - ' + f);
  console.log(base.checks + ' checks');
  console.log('GATE CLOCK: ' + (base.fails.length ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
  process.exit(base.fails.length ? 1 : 0);
}
// ---- negative verification: each rule broken in its own source --------------
const sub = (a, b) => s => { if (s.indexOf(a) < 0) throw new Error('selftest anchor gone: ' + a); return s.split(a).join(b); };
const BREAKS = [
  ['a wait lands on the past hour (no roll to the next day)', { clock: sub('.find(x => x >= A + DAY_WAIT_MIN_S)', '.find(x => x >= A - 86400)') }],
  ['a wait skips today\'s hour', { clock: sub('dayPresetAbsAround(day, target, A, 1, 2)', 'dayPresetAbsAround(day, target, A, 0, 2).slice(1)') }],
  ['a clock-time wait ignores DST', { clock: sub('if (off !== 0 && Math.abs(off) <= 3600', 'if (false && off !== 0') }],
  ['the full moon lands at the full instant, not dusk', { clock: sub('const o = dayFromAbs(land), F = dayFromAbs(full);', 'const o = dayFromAbs(full), F = dayFromAbs(full);') }],
  ['dayMoonAt ignores the offset of the instant', { clock: sub("  abs = j * 86400 + h * 3600 - dayOffsetAt(day, abs) * 3600;\n", '') }],
  ['the moon words drift', { clock: sub("[0.95, 'full']", "[0.85, 'full']") }],
  ['the career goes back', { c74: sub('  if (dt < 0) return crNo(', '  if (false) return crNo(') }],
  ['a v1 career is not lifted', { c74: sub('  if (!careerDayOk(c.day)) c.day = careerDayNorm(dayFromAbs(dayAbs(CAREER_DAY0) + Math.max(0, +d.clock || 0)));', '  if (!careerDayOk(c.day)) c.day = careerDayNorm(CAREER_DAY0);') }],
  ['after dusk does not wrap midnight', { c73: sub("return (h >= dusk || h < dawn) ? '' : 'before dusk' + at;", "return h >= dusk ? '' : 'before dusk' + at;") }],
  ['an arrive window does not wrap', { c73: sub('const inside = a < b ? (h >= a && h < b) : (h >= a || h < b);', 'const inside = h >= a && h < b;') }],
  ['the validator takes any window', { c73: sub("  if (w.before === 'dusk' || w.after === 'dusk' || w.before === 'dawn') return '';", "  return '';") }],
  ['the stop\'s own dusk is ignored', { c73: sub("const dusk = typeof stop.duskH === 'number' && isFinite(stop.duskH) ? stop.duskH : CONTRACT_DUSK_H;", 'const dusk = CONTRACT_DUSK_H;') }],
  ['a jump is not counted', { dc: sub('    jumps++;\n', '') }],
  ['the career may jump back', { dc: sub('    if (careerHook && dt < 0) return', '    if (false) return') }],
  ['the career keeps the sandbox\'s rates', { dc: sub("!(careerHook && +r !== 1)", 'true') }],
  ['a set of the hour bypasses the jump', { dc: sub("        return jump(t, 'set');", "        world.setDay(t); save(); return { ok: true };") }],
  ['the career\'s instant overwrites the sandbox pref', { dc: sub('date: keep ? keep.date : day.date', 'date: day.date') }],
];
let bad = 0;
for (const [name, mut] of BREAKS) {
  let r;
  try { r = run(mut); } catch (e) { r = { fails: ['threw: ' + e.message], checks: 0 }; }
  const caught = r.fails.length > 0;
  console.log((caught ? '  caught  ' : '  MISSED  ') + name + (caught ? ' (' + r.fails[0].slice(0, 90) + ')' : ''));
  if (!caught) bad++;
}
console.log('GATE CLOCK selftest: ' + (bad ? 'FAIL (' + bad + ' missed of ' + BREAKS.length + ')' : 'PASS (' + BREAKS.length + ' breaks caught)'));
process.exit(bad || base.fails.length ? 1 : 0);
