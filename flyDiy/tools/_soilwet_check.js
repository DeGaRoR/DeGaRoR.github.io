#!/usr/bin/env node
// ============================================================
// GATE SOILWET - the soil's wetness (DIRT-DUST, 2026-11-09; src/core/07e_soil_wet.js; the design
// D:/Dev/flydiy-notes/DIRT-DUST-DESIGN-2026-11-09.md). Node only, the core as built, a few seconds.
//   1. THE BUILD     in the core after the plan it integrates; exported
//   2. ONE SOURCE    the same instant is the same answer: twice, after the caches are cleared, and walked hour by hour
//                    (the incremental cache) against set directly; the result object is the one reused object (DIRT-STRIP
//                    reads it a frame: no allocation)
//   3. THE SEASON    every storm day makes mud by its afternoon; three dry days make dust; after rain sand dries first and
//                    turf last; the morning after a storm is damper than its afternoon
//   4. SMOOTH        the high block walked every 5 min: no step a frame would see
//   5. NO PLAN       the sandbox's day: dry unless it rains; force holds any instant
//   6. THE COST      a frame's call (cached) and an hour's window
// Run: node tools/_soilwet_check.js   (contract: one final `GATE SOILWET: ...`)
// ============================================================
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./flight_core.js');
const { DAY, SOLAR, WEATHER_PLAN, SOIL_WET: W } = C;
let fails = 0, checks = 0;
const ok = m => { checks++; console.log('  ok   ' + m); }, fail = m => { checks++; fails++; console.log('  FAIL ' + m); };
const yes = (c, m) => (c ? ok : fail)(m);
const ROOT = path.join(__dirname, '..'), src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const T0 = Date.now();
const PLAN = { id: 'season' };
const dateOf = j => { const c = SOLAR.civil(j); return c.y + '-' + String(c.m).padStart(2, '0') + '-' + String(c.d).padStart(2, '0'); };
const jdnOf = s => SOLAR.jdn(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10));
const dayAt = (date, localHours) => DAY.makeDay({ date, localHours, plan: PLAN });
const snap = R => JSON.stringify([R.wet, R.cls, R.rainNow, R.hoursDry, R.mud, R.src]);

console.log('1. the build');
{
  const b = src('tools/build.js');
  yes(!!W && typeof W.at === 'function', 'SOIL_WET is in the core and exported');
  yes(b.indexOf("'07e_soil_wet.js'") > b.indexOf("'07d_weather_plan.js'") && b.indexOf("'07e_soil_wet.js'") < b.indexOf("'08_cloud_field.js'"), 'after the plan it integrates (tools/build.js MANIFEST)');
  const s = src('src/core/07e_soil_wet.js');
  yes(!/Date\.now|new Date|Math\.random|THREE|document/.test(s.replace(/\/\/.*$/gm, '')), 'pure: no clock, no random, no THREE, no DOM');
}
if (!W) { console.log('GATE SOILWET: FAIL (no SOIL_WET)'); process.exit(1); }

console.log('2. one source');
{
  const d = dayAt('2026-07-22', 16.5), a = snap(W.at(d));
  yes(snap(W.at(d)) === a, 'the same instant twice');
  W._clear(); yes(snap(W.at(d)) === a, 'the same after the caches are cleared');
  yes(W.at(d) === W.at(d), 'one result object, reused (no allocation a frame)');
  // walked an hour at a time vs set directly (the cache's incremental branch)
  const w = dayAt('2026-07-20', 6); let worst = 0;
  for (let h = 0; h < 60; h++) {
    const u = w.utc + 3600; w.set({ utc: u >= 86400 ? u - 86400 : u, date: u >= 86400 ? dateOf(w.jdn + 1) : w.date });
    const r1 = snap(W.at(w)), f = DAY.makeDay({ date: w.date, utc: w.utc, plan: PLAN }); W._clear(); const r2 = snap(W.at(f));
    if (r1 !== r2) worst++;
  }
  yes(worst === 0, 'walked 60 h an hour at a time = each instant set directly (' + worst + ' differ)');
  const R = W.at(d);
  yes(['wet', 'rainNow', 'hoursDry', 'mud', 'src'].every(k => k in R) && W.KEYS.every(k => R.cls[k] >= 0 && R.cls[k] <= 1), 'the fields DIRT-STRIP and the dust read: wet, cls{dirt,sand,gravel,grass} in 0..1, rainNow, hoursDry, mud');
}

console.log('3. the season');
{
  const blocks = WEATHER_PLAN.BLOCKS;
  let storms = 0, mudOk = 0, dryDays = 0, dustOk = 0, sandFirst = 0, sandN = 0, morn = 0, mornN = 0;
  for (const B of blocks) {
    const y = 2026, j1 = jdnOf(y + '-' + B.day1);
    for (let i = 0; i < 14; i++) {
      const j = j1 + i, date = dateOf(j), D = B.days[i];
      const rainPeak = D.rain ? Math.max(...D.rain.map(r => r[1])) : 0;
      if (rainPeak >= 0.9) {
        storms++;
        const r = W.at(dayAt(date, 17)); if (r.cls.dirt >= 0.75 && r.mud > 0.5) mudOk++;
        // the next day: sand drier than dirt by noon, turf the wettest; the next morning damper than its afternoon
        const n = W.at(dayAt(dateOf(j + 1), 12)); sandN++; if (n.cls.sand < n.cls.dirt && n.cls.grass >= n.cls.dirt) sandFirst++;
        // the first day after it with no rain at all: its evening, then the next dawn - damper by the morning (the subsoil
        // re-wets the top overnight, as a soaked strip is damp again at dawn)
        let k = i + 1; while (k < 13 && B.days[k] && B.days[k].rain) k++;
        if (k < 13) { const e = W.at(dayAt(dateOf(j1 + k), 20)).cls.dirt, m = W.at(dayAt(dateOf(j1 + k + 1), 5)).cls.dirt; mornN++; if (m > e) morn++; }
      }
      // a day with no rain in the 72 h before its 15:00
      const r15 = W.at(dayAt(date, 15));
      if (r15.hoursDry >= 72) { dryDays++; if (r15.cls.dirt < 0.06) dustOk++; }
    }
  }
  yes(storms >= 3 && mudOk === storms, 'every storm day (rain >= 0.9) is mud by 17:00 (' + mudOk + ' of ' + storms + ')');
  yes(dryDays >= 10 && dustOk === dryDays, 'three dry days make dust: dirt under 0.06 at 15:00 (' + dustOk + ' of ' + dryDays + ' such days)');
  yes(sandN && sandFirst === sandN, 'the day after a storm, sand is the driest and turf the wettest at noon (' + sandFirst + ' of ' + sandN + ')');
  yes(mornN >= 2 && morn === mornN, 'the first dry day after a storm: the next dawn is damper than its evening (the subsoil re-wets the top overnight) (' + morn + ' of ' + mornN + ')');
}

console.log('4. smooth');
{
  const d = dayAt('2026-07-15', 4); let worst = 0, prev = W.at(d).cls.dirt, at = '';
  for (let k = 0; k < 14 * 24 * 12; k++) {
    let u = d.utc + 300, date = d.date; if (u >= 86400) { u -= 86400; date = dateOf(d.jdn + 1); }
    d.set({ date, utc: u });
    const v = W.at(d).cls.dirt, s = Math.abs(v - prev); if (s > worst) { worst = s; at = d.local; } prev = v;
  }
  yes(worst < 0.04, 'the high block every 5 min: the largest step ' + worst.toFixed(4) + ' (at ' + at + ') < 0.04');
}

console.log('5. no plan');
{
  const d = DAY.makeDay({ date: '2026-07-01', localHours: 14, rh: 0.5 });
  const r = W.at(d);
  yes(r.src === 'sandbox' && r.wet < 0.1, 'the sandbox\'s dry day: dry (' + r.wet.toFixed(3) + ')');
  W.force = 0.7; const f = W.at(d); yes(f.src === 'force' && Math.abs(f.wet - 0.7) < 1e-9 && W.KEYS.every(k => f.cls[k] === 0.7), 'force holds the instant at its value');
  W.force = null; yes(W.at(d).src === 'sandbox', 'force null hands it back');
  yes(W.at(null).src === 'sandbox' && W.at(null).wet <= 0.1, 'no day: dry');
}

console.log('6. the cost');
{
  const d = dayAt('2026-07-25', 13); W._clear();
  let t = process.hrtime.bigint(); W.at(d); const win = Number(process.hrtime.bigint() - t) / 1e6;
  t = process.hrtime.bigint(); for (let i = 0; i < 20000; i++) W.at(d); const per = Number(process.hrtime.bigint() - t) / 1e6 / 20000;
  console.log('       a new hour\'s two windows ' + win.toFixed(2) + ' ms (cold), a frame\'s call ' + (per * 1000).toFixed(2) + ' us');
  yes(per < 0.01, 'a frame\'s call under 10 us (' + (per * 1000).toFixed(2) + ' us)');
  yes(win < 60, 'a cold hour under 60 ms (' + win.toFixed(1) + ' ms; an hour boundary warm is one window: the cache)');
}

console.log(checks + ' checks, ' + ((Date.now() - T0) / 1000).toFixed(1) + ' s');
console.log('GATE SOILWET: ' + (fails ? 'FAIL (' + fails + ' of ' + checks + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
