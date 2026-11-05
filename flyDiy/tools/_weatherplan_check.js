#!/usr/bin/env node
// ============================================================
// GATE WEATHERPLAN - the career's weather plan (WEATHER-SEASON, 2026-11-03; futureDesigns/WEATHER-DAYS-STUDY-2026-11.md
// §3, §5, §10). A small recurring gate (the user's rule): under a minute, node only, the core as built.
//   1. THE PACK      src/core/07c_weather_days.js is what src/weather/days/<block>/*.json make (tools/weather_days_pack.js)
//   2. THE BLOCKS    the dates -> the block and its day (the edges, the 15 July epoch, outside the season)
//   3. THE DAYS      the authoring rules (the study's --check): 14 a block, the fields, clear dawns, a storm forecast
//                    by the two days before it, its no-VFR window honest, no cloud type changing under cover by day,
//                    an `easy` day easy for 85 % of its daylight, every block >= 60 % easy
//   4. ONE SOURCE    the same instant is the same day (twice, and advanced to vs set at: the page and the worker)
//   5. SMOOTH        the whole season walked every 2 min: no step a consumer would see as a pop; the decks' cover and
//                    the turbidity move in their quanta, the turbidity only overnight
//   6. THE WORLD     the air and the wind follow the plan; a ticked world and a set one agree; the sea walks (seaTau);
//                    a plan lifted gives the declared wind back
//   7. THE FORECAST  today / the outlook / the menu's lines; a storm in the outlook two days ahead; across a block edge
//   8. THE LAYUP     the season's close lands on the next opening at dawn, forward, in the document and its normaliser
//   9. NO PLAN       a day without a plan is the day it always was
//  10. THE SOURCES   pure; in the build; the page's doors (the career sets the plan, the pref keeps the sandbox's weather)
// Run: node tools/_weatherplan_check.js   (contract: one final `GATE WEATHERPLAN: ...`)
// ============================================================
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const C = require('./flight_core.js');
const { DAY, SOLAR, WEATHER_PLAN: P, makeWorld } = C;
let fails = 0, checks = 0;
const ok = m => { checks++; console.log('  ok   ' + m); }, fail = m => { checks++; fails++; console.log('  FAIL ' + m); };
const yes = (c, m) => (c ? ok : fail)(m);
const ROOT = path.join(__dirname, '..');
const T0 = Date.now();
const jdnOf = s => SOLAR.jdn(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10));
const dateOf = j => { const c = SOLAR.civil(j); return c.y + '-' + String(c.m).padStart(2, '0') + '-' + String(c.d).padStart(2, '0'); };
const PLAN = { id: 'season' };
const at = (date, localHours) => DAY.makeDay({ date, localHours, plan: PLAN });
const derived = d => JSON.stringify(['oatC', 'dewC', 'qnhEff', 'cloudCoverEff', 'cloudTypeEff', 'cloudBase', 'visibilityKm', 'mistRho0', 'rain', 'auroraKp',
  'turbidity', 'seaTau', 'airKey'].map(k => d[k]).concat([d.wind, d.cloudUpper, d.storm, d.plan]));

console.log('1. the pack');
{
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'weather_days_pack.js'), '--check'], { encoding: 'utf8' });
  yes(r.status === 0, 'src/core/07c_weather_days.js is the 42 JSONs of src/weather/days (' + String(r.stdout).trim() + ')');
  yes(P.BLOCKS.length === 3 && P.BLOCKS.every(b => b.days.length === 14), 'three blocks of 14 days (' + P.BLOCKS.map(b => b.id + ' ' + b.days.length).join(', ') + ')');
}

console.log('2. the blocks');
{
  const want = [['2026-05-20', 'early', 0], ['2026-07-02', 'early', 1], ['2026-07-03', 'high', 2], ['2026-07-15', 'high', 0],
                ['2026-08-15', 'high', 3], ['2026-08-16', 'late', 0], ['2026-09-30', 'late', 3], ['2026-03-01', 'early', null], ['2026-11-10', 'late', null]];
  for (const [date, b, i] of want) { const r = P.idxOf(jdnOf(date)); yes(r.b.id === b && (i == null || r.i === i), date + ' is ' + b + (i != null ? ' day ' + (i + 1) : '') + ' (got ' + r.b.id + ' ' + (r.i + 1) + ': ' + r.b.days[r.i].id + ')'); }
  const d0 = DAY.makeDay({ date: C.CAREER_DAY0.date, utc: C.CAREER_DAY0.utc, plan: PLAN });
  yes(d0.localDate === '2026-07-15' && d0.plan.block === 'high' && d0.plan.id === 'fair-cumulus', 'the career\'s first day (15 Jul 16:00) is the high block\'s day 1, the game\'s own fair-weather cumulus');
  yes(P.inSeason(jdnOf('2026-05-20')) && P.inSeason(jdnOf('2026-09-30')) && !P.inSeason(jdnOf('2026-10-01')) && !P.inSeason(jdnOf('2026-05-19')), 'the season is 20 May - 30 Sep');
}

console.log('3. the days (the authoring rules)');
{
  const daylight = date => {
    const p = at(date, 12), tr = (p.sunriseUtc / 3600 + p.offsetH + 24) % 24, ts = (p.sunsetUtc / 3600 + p.offsetH + 24) % 24, out = [];
    for (let h = Math.ceil(tr); h <= Math.floor(ts); h += 0.5) out.push([h, at(date, h)]);
    return out;
  };
  const ids = new Set(); let bad = 0;
  const no = m => { bad++; fail(m); };
  for (const b of P.BLOCKS) {
    let easyN = 0, n = 0;
    b.days.forEach((D, k) => {
      const tag = b.id + '/' + (k + 1) + ' ' + D.id, date = dateOf(jdnOf('2026-' + b.day1) + k);
      if (ids.has(D.id)) no(tag + ': the id is used twice'); ids.add(D.id);
      for (const f of ['v', 'id', 'name', 'story', 'fly', 'forecast', 'temp', 'dew', 'qnh', 'wind']) if (D[f] == null) no(tag + ': no `' + f + '`');
      if (!['easy', 'easy-after-wait', 'moderate', 'storm'].includes(D.fly)) no(tag + ': fly `' + D.fly + '`');
      if (!D.fog && D.fly !== 'storm' && !(D.dew[0][1] <= (D.temp.min || 0) - 3.5 + 1e-9)) no(tag + ': a dawn spread under 3.5 C on a day with no declared fog');
      if (D.fly === 'storm') {
        if (!/STORM|GALE/.test(D.forecast) || !(D.noFly && D.noFly.length)) no(tag + ': a storm must say STORM / GALE and carry noFly');
        for (const back of [1, 2]) { const Pd = b.days[(k - back + 14) % 14]; if (!/front|storm|gale/i.test(Pd.forecast)) no(tag + ': ' + Pd.id + ' (' + back + ' day(s) before) does not forecast it'); }
      }
      const hs = daylight(date), cls = hs.map(([h, d]) => [h, P.flyClass(d), d]);
      for (const [h, , d] of cls) if (d.plan.dipLow || d.plan.dipUp) { no(tag + ': a cloud type changes under cover at ' + h + ' h'); break; }
      const e = cls.filter(c => c[1] === 'easy').length, nf = cls.filter(c => c[1] === 'NO').map(c => c[0]);
      easyN += e; n += cls.length;
      if (D.fly === 'easy' && e < 0.85 * cls.length) no(tag + ': authored easy, ' + e + ' of ' + cls.length + ' half-hours easy');
      if (D.fly === 'storm' && !nf.length) no(tag + ': a storm with no no-fly half-hour');
      if (D.noFly) {
        const hh = s => +s.slice(0, 2) + s.slice(3) / 60, W = D.noFly.map(w => [hh(w[0]), hh(w[1])]);
        const out = nf.filter(h => !W.some(([a, z]) => h >= a - 0.5 && h + 0.5 <= z + 0.5));
        if (out.length) no(tag + ': no-fly outside its declared window at ' + out.join(' '));
        const wl = W.reduce((t, [a, z]) => t + (z - a) * 2, 0); if (nf.length < 0.75 * wl) no(tag + ': its window is ' + wl + ' half-hours, ' + nf.length + ' no-fly');
      }
    });
    yes(easyN >= 0.6 * n, b.id + ': ' + Math.round(100 * easyN / n) + ' % of daylight easy (the bar: 60 %)');
  }
  yes(bad === 0, 'all 42 days keep the rules (unique ids, the fields, clear dawns, forecast storms, honest windows, no type change under cover, easy days easy)');
}

console.log('4. one source (the page and the worker)');
{
  const a = DAY.makeDay({ date: '2026-08-20', utc: 20 * 3600, plan: PLAN }), b = DAY.makeDay({ date: '2026-08-20', utc: 20 * 3600, plan: PLAN });
  yes(derived(a) === derived(b), 'the same instant is the same day, to the bit (a storm day at 12:00 local)');
  const c = DAY.makeDay({ date: '2026-08-20', utc: 12 * 3600, plan: PLAN }); c.advance(8 * 3600);
  yes(derived(c) === derived(a), 'a day ADVANCED to an instant is the day SET at it (the tick and the jump, the page and the worker)');
  const v0 = c.version; c.advance(600);
  yes(c.version === v0, 'the plan moves the weather without a version bump (the LUTs and probes re-bake on version only)');
}

console.log('5. smooth (the season, every 2 min)');
{
  const d = DAY.makeDay({ date: '2026-05-20', localHours: 4, plan: PLAN });
  const step = 120, end = jdnOf('2026-10-01') * 86400;
  const worst = {}, nCover = {}, nTurb = {}; let prev = null, turbAtDay = 0, steps = 0;
  const v = () => ({ T: d.oatC, Td: d.dewC, qnh: d.qnhEff / 100, kts: d.wind.kts, cover: d.cloudCover, base: d.cloudBase, mist: d.mistRho0 * 1000,
                     rain: d.rain, kp: d.auroraKp, turb: d.turbidity });
  while (d.jdn * 86400 + d.utc < end) {
    d.advance(step); steps++;
    const cur = v(), ld = d.localDate, lh = d.localSeconds / 3600;
    if (prev) {
      for (const k of Object.keys(cur)) { const s = Math.abs(cur[k] - prev[k]) * 60 / step; if (!worst[k] || s > worst[k].s) worst[k] = { s, at: ld + ' ' + lh.toFixed(1) + 'h ' + d.plan.block + '/' + d.plan.id }; }
      if (cur.cover !== prev.cover) nCover[ld] = (nCover[ld] || 0) + 1;
      if (cur.turb !== prev.turb) { nTurb[ld] = (nTurb[ld] || 0) + 1; if (Math.abs(lh - 2) > 0.05) turbAtDay++; }
    }
    prev = cur;
  }
  const B = { T: 0.15, Td: 0.25, qnh: 0.25, kts: 0.25, cover: 0.04, base: 25, mist: 0.2, rain: 0.02, kp: 0.15 };
  for (const k of Object.keys(B)) yes(worst[k] && worst[k].s <= B[k], k + ': the largest step ' + worst[k].s.toFixed(4) + ' a minute (bar ' + B[k] + ') at ' + worst[k].at);
  const maxCover = Math.max(...Object.values(nCover)), maxTurb = Math.max(0, ...Object.values(nTurb));
  // (the clouds re-threshold and re-fit their map on every cover change: 120 a day is one every 12 min at real time -
  // the GPU threshold of the study's W3 takes this count away)
  yes(maxCover <= 120, 'the low deck\'s cover changes at most ' + maxCover + ' times a day (quantum ' + P.COVER_Q + '; the clouds re-fit per change)');
  yes(maxTurb <= 1 && turbAtDay === 0, 'the turbidity changes at most once a night, at 02:00 (the sky\'s tables re-bake on it): ' + maxTurb + ', ' + turbAtDay + ' at another hour');
  yes(steps > 90000, steps + ' steps walked, 20 May - 30 Sep');
}

console.log('6. the world');
{
  const A = makeWorld(), B = makeWorld();
  A.setDay({ date: '2026-07-24', localHours: 9, plan: PLAN });                       // the ridge day: the wind rises
  const w9 = A.wind(0, 60, 0, 0).slice(), atm9 = A.atmos.oatC;
  yes(Math.abs(atm9 - A.day.oatC) < 1e-9 && A.day.plan.id === 'ridge-day', 'the solver\'s air is the plan\'s (' + atm9.toFixed(2) + ' C, ' + A.day.plan.id + ')');
  for (let i = 0; i < 6 * 60; i++) A.dayTick(60, 0, 0, 0);                          // six hours, a minute at a time
  B.setDay({ date: '2026-07-24', localHours: 15, plan: PLAN });
  const wa = A.wind(0, 60, 0, 0), wb = B.wind(0, 60, 0, 0);
  yes(Math.hypot(wa[0] - w9[0], wa[2] - w9[2]) > 1, 'the wind follows the plan through the day (9:00 ' + Math.hypot(w9[0], w9[2]).toFixed(1) + ' m/s -> 15:00 ' + Math.hypot(wa[0], wa[2]).toFixed(1) + ')');
  yes(Math.abs(wa[0] - wb[0]) < 1e-9 && Math.abs(wa[2] - wb[2]) < 1e-9 && A.day.plan.windKey === B.day.plan.windKey, 'a world ticked there and a world set there blow the same wind (the page and the worker)');
  yes(A.day.seaTau === 900 && A.seaTarget.A > 0, 'the sea walks after the plan\'s wind (seaTau ' + A.day.seaTau + ', target A ' + A.seaTarget.A.toFixed(3) + ')');
  const C2 = makeWorld(); C2.setDay({ wind: { kts: 3, dirDeg: 90, gust: 0, refH: 10 } });
  const decl = C2.wind(0, 60, 0, 0).slice();
  C2.setDay({ plan: PLAN, date: '2026-07-24', localHours: 15 }); const wp = C2.wind(0, 60, 0, 0).slice();
  C2.setDay({ plan: null }); const back = C2.wind(0, 60, 0, 0);
  yes(Math.hypot(wp[0] - decl[0], wp[2] - decl[2]) > 1 && Math.abs(back[0] - decl[0]) < 1e-9 && Math.abs(back[2] - decl[2]) < 1e-9 && C2.day.plan === null,
      'a plan lifted gives the declared wind back, to the bit');
}

console.log('7. the forecast');
{
  const d = at('2026-07-19', 10), t = P.today(d), o = P.outlook(d, 3), L = P.lines(d);
  yes(t && t.id === 'high-cloud' && t.now && typeof t.now.windKt === 'number' && ['easy', 'care', 'NO'].includes(t.now.flyClass), 'today: the crafted day, its words and the reading now (' + t.name + ', ' + t.now.flyClass + ')');
  yes(o.length === 3 && o[1].id === 'the-storm' && o[1].storm && o[0].id === 'overcast-calm', 'the outlook names the storm two days ahead (' + o.map(x => x.name + (x.storm ? ' STORM' : '')).join(' / ') + ')');
  yes(L.length === 4 && /STORM/.test(L[2]), 'the TIME menu\'s lines: today and three days (' + L[2].slice(0, 60) + '...)');
  const e = P.outlook(at('2026-07-02', 12), 2);
  yes(e[0].block === 'high' && e[0].id === 'morning-fog' && e[0].date === '2026-07-03', 'across a block edge the outlook reads the next block (2 Jul -> 3 Jul ' + e[0].name + ')');
  const h = P.hourly(d, 6, 3);
  yes(h.length === 3 && h.every(r => r.localH >= 0 && r.oatC > 0), 'the hours ahead, every 3 h (' + h.map(r => r.localH.toFixed(0) + 'h ' + r.oatC.toFixed(1) + 'C').join(', ') + ')');
}

console.log('8. the layup');
{
  const L1 = C.careerSeasonLand({ date: '2026-10-01', utc: 43200 }), L0 = C.careerSeasonLand({ date: '2026-07-16', utc: 0 });
  yes(!L0.layup && L0.date === '2026-07-16', 'inside the season: untouched');
  const ld = DAY.makeDay({ date: L1.date, utc: L1.utc });
  yes(L1.layup && L1.season === 2027 && ld.localDate === '2027-05-20' && Math.abs(ld.sunEl + 6) < 0.05, 'past the close: the next opening at civil dawn (' + ld.local + ', sun ' + ld.sunEl.toFixed(1) + ' deg)');
  yes(!C.careerSeasonLand({ date: '2026-10-01', utc: 6 * 3600 }).layup, '30 Sep 22:00 local (1 Oct UT) is still the season: the LOCAL date decides');
  const doc = C.careerNew({ id: 't', seed: 't' }), r = C.careerDaySet(doc, { date: '2026-10-03', utc: 0 });
  yes(r.ok && r.layup && r.doc.career.day.date === '2027-05-20' && r.dt > 0, 'a wait past the close lands the document on the next opening, forward (dt ' + Math.round(r.dt / 86400) + ' days)');
  const old = JSON.parse(JSON.stringify(doc)); old.career.day = { date: '2026-11-02', utc: 3600 };
  yes(C.careerNormalise(old).career.day.date === '2027-05-20', 'an old save after the season is lifted to the next opening by the normaliser');
  yes(C.careerSeasonLand(C.careerDay(doc)).layup === false, 'a new career starts inside the season');
}

console.log('9. no plan');
{
  const a = DAY.makeDay({ date: '2026-07-24', localHours: 15 }), b = DAY.makeDay({ date: '2026-07-24', localHours: 15, plan: null });
  yes(a.plan === null && a.rain === 0 && a.auroraKp === 0 && a.fogWhere === null && derived(a) === derived(b), 'a day with no plan is the day it always was (no plan meta, no rain, no aurora)');
  const w = makeWorld();
  yes(w.day.plan === null && w.atmos === C.ATMOS_ISA, 'a world with no plan flies the standard day (the bench\'s and the certificate\'s world)');
}

console.log('10. the sources');
{
  const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const f of ['src/core/07d_weather_plan.js', 'src/core/07c_weather_days.js']) yes(!/new Date\(|Date\.now\(|Math\.random\(|THREE\.|window\.|document\./.test(src(f)), f + ' is pure (no Date, random, THREE, DOM)');
  const build = src('tools/build.js');
  yes(/'07c_weather_days\.js', '07d_weather_plan\.js'/.test(build) && build.indexOf("'07d_weather_plan.js'") > build.indexOf("'07_day.js'"), 'both are in the core, after the day');
  const dc = src('src/viewer/day_clock.js');
  yes(/plan: \{ id: 'season' \} \}\)/.test(dc) && /world\.setDay\(\{ plan: null \}\)/.test(dc), 'the career sets the plan, leaving the career lifts it (day_clock.js)');
  yes(/cloudCover: sp\.cloudCover != null \? sp\.cloudCover/.test(dc), 'the pref keeps the sandbox\'s DECLARED decks, never the plan\'s');
  yes(/window\.FLYDIY_FORECAST = d =>/.test(dc) && /forecast: window\.FLYDIY_FORECAST/.test(src('src/viewer/app.js')), 'the TIME menu\'s forecast door is the plan\'s lines');
  yes(/careerSeasonLand/.test(dc) && /'flydiy:layup'/.test(dc), 'a career wait past the close is the layup jump (and its event, for the story)');
  const cu = src('src/viewer/clouds_ui.js');
  yes(/const career = !!\(CK\.isCareer && CK\.isCareer\(\)\);/.test(cu) && /if \(career\) \{\s*head\('sky'\);/.test(cu) && /if \(!career\) H\.pills\(host, \[\{ label: 'another sky/.test(cu),
      'the clouds panel in the career tells the decks and offers neither their rows nor another sky (clouds_ui.js, the guard TIME-CONTROLS left open)');
}

console.log(checks + ' checks, ' + ((Date.now() - T0) / 1000).toFixed(1) + ' s');
console.log('GATE WEATHERPLAN: ' + (fails ? 'FAIL (' + fails + ' of ' + checks + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
