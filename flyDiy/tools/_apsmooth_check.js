#!/usr/bin/env node
// GATE APSMOOTH (G3306, AP-ADAPT) - DOES A CERTIFIED BUILD LOOK STABLE WHEN THE AUTOPILOT FLIES IT? The user, 18 Oct, on
// their certified Rufus B and on the Mosquito: "it can't keep it straight as soon as the tail lifts up when rolling, and it
// struggles a lot maintaining altitude ... a plane looks dysfunctional and unstable because the autopilot can't fly them
// smoothly". Every number here is THE GAME'S FLIGHT (tools/_tour_lib.js gameHost: the worker's host, the game's day - the
// 8 kt breeze and its gusts -, damage off as the game flies) and the user's own path where it matters (roll out, SKIP TO
// LINE-UP: sim_host lineup), over the validated set (the user's Cub, the Jodel, the metal Cessna) + Rufus B + the Mosquito.
//
// THE ROWS AND THEIR THRESHOLDS (written here; the first measurement, 19 Oct, in brackets - t66 3b1cebb04 + G3304/G3305):
//   ROLL       every build x {expert, club, student}, the line-up path: the worst heading off the roll's from the TAIL
//              coming up to the lift-off <= 6 deg (2.7 Rufus student; master swung it 15.3 in the page, the user's
//              symptom). A tricycle has no tail-up: its whole roll is read (<= 6).
//   AIR        the same flights, the 15 s after the lift-off: the EXPERT <= 10 deg (6-10). The persons (club, student) are
//              printed, KNOWN (15-19: the persona air weave, the Pilot coordinator's next item) - not judged until it lands.
//   LEVEL      every build, expert, one leg on the game's day (HOME > w3; the Jodel HOME > w2, the user: not on short strips):
//              the leg COMPLETED; the height against the pilot's own plan (ap.intent.h) on the cruise legs, the plan
//              steady, rms <= 5 m (1.2-3.7; the Mosquito 15.7 before G3304/G3305, 1.7 after); no go-around (the Jodel and
//              the metal Cessna at w2 go round on t66 - G2460's stabilised gate on a final that gains 3 m/s, the Pilot
//              coordinator's: KNOWN there).
//   HANDS      the same legs: aileron / rudder / elevator reversals a minute on the level legs <= 15 (0.6-10.3; PILOTACT's
//              G630 count, 0.03 rad of hysteresis).
//   TOUCH      the same legs: the touchdown speed over the sheet's stall <= 1.35 (the plaque's honest float ceiling;
//              1.03-1.34 measured).
// ~6-10 min at 4 jobs. `--only rufus,cub` narrows the builds; `--jobs N`.
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BUILDS = [
  { k: 'cub', f: 'builds/cub_2026-09-20_corrected.json', order: 'HOME,w3', trike: false },
  { k: 'jodel', f: 'builds/jodel_2026-09-20_corrected.json', order: 'HOME,w2', trike: false, known: 'go-around at w2: G2460 (Pilot)' },
  { k: 'c172', f: 'tools/fixtures/build_v10_cessnaMetal_2026-09-26.json', order: 'HOME,w3', trike: true },
  { k: 'rufus', f: 'tools/fixtures/repro/rufus_2026-10-18_certified.json', order: 'HOME,w3', trike: false },
  { k: 'mosquito', f: 'tools/fixtures/repro/mosquito_3.json', order: 'HOME,w3', trike: false },
].filter(b => !opt('only') || opt('only').split(',').includes(b.k));
const PERSONS = ['expert', 'club', 'student'];
const LIM = { roll: 6, airExpert: 10, hRms: 5, rev: 15, VoverVs: 1.35 };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'apsmooth_'));
const jobs = [];
for (const b of BUILDS) for (const p of PERSONS) jobs.push({ kind: 'roll', b, p, out: path.join(TMP, 'roll_' + b.k + '_' + p + '.json'),
  args: [path.join(T, 'ap_lineup_probe.js'), '--build', b.f, '--ways', 'lineup', '--after', '15', '--profile', p, '--json', path.join(TMP, 'roll_' + b.k + '_' + p + '.json')] });
for (const b of BUILDS) jobs.push({ kind: 'level', b, out: path.join(TMP, 'level_' + b.k + '.json'),
  args: [path.join(T, 'ap_smooth_probe.js'), '--build', b.f, '--order', b.order, '--damage', '0', '--max', '1200', '--json', path.join(TMP, 'level_' + b.k + '.json')] });
const N = +opt('jobs', 4);
let next = 0, running = 0;
const done = new Promise(res => {
  const kick = () => {
    while (running < N && next < jobs.length) {
      const j = jobs[next++]; running++;
      const ch = spawn(process.execPath, j.args, { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
      let err = ''; ch.stderr.on('data', d => { err += d; });
      ch.on('exit', code => { j.code = code; j.err = err.slice(-400); running--; if (next >= jobs.length && running === 0) res(); else kick(); });
    }
  };
  kick();
});
done.then(() => {
  const fails = [], r1 = v => v == null ? '-' : (+v).toFixed(1);
  console.log('APSMOOTH - the game\'s flight, the game\'s day; thresholds: roll <= ' + LIM.roll + ' deg (tail-up to lift-off), air (expert) <= ' + LIM.airExpert +
    ' deg, level h rms <= ' + LIM.hRms + ' m, hands <= ' + LIM.rev + ' /min, touch <= ' + LIM.VoverVs + ' Vs');
  for (const b of BUILDS) {
    for (const p of PERSONS) {
      const j = jobs.find(q => q.kind === 'roll' && q.b === b && q.p === p);
      let L = null; try { L = JSON.parse(fs.readFileSync(j.out, 'utf8')).lineup.L; } catch (e) {}
      if (!L) { fails.push(b.k + ' ' + p + ' roll: no result (' + j.code + ') ' + (j.err || '').replace(/\s+/g, ' ')); continue; }
      const roll = b.trike ? L.hdgMaxRoll : L.hdgMaxTailUp, air = L.hdgMaxAfterLift;
      const okR = roll != null && roll <= LIM.roll, okA = p !== 'expert' || (air != null && air <= LIM.airExpert);
      console.log('  ' + (okR && okA ? 'ok  ' : 'FAIL') + ' ' + (b.k + ' ' + p).padEnd(18) + ' roll ' + r1(roll).padStart(5) + ' deg' + (b.trike ? ' (whole roll)' : ' (tail-up -> lift-off)') +
        ' | air 15 s ' + r1(air).padStart(5) + ' deg' + (p === 'expert' ? '' : ' (KNOWN: the persona air weave)'));
      if (!okR) fails.push(b.k + ' ' + p + ' roll ' + r1(roll) + ' > ' + LIM.roll);
      if (!okA) fails.push(b.k + ' expert air ' + r1(air) + ' > ' + LIM.airExpert);
    }
    const j = jobs.find(q => q.kind === 'level' && q.b === b);
    let R = null; try { R = JSON.parse(fs.readFileSync(j.out, 'utf8')); } catch (e) {}
    if (!R) { fails.push(b.k + ' level: no result (' + j.code + ') ' + (j.err || '').replace(/\s+/g, ' ')); continue; }
    const lv = R.active && R.active.level || {}, rev = Math.max(lv.da || 0, lv.dr || 0, lv.de || 0);
    const ga = (R.verdicts || []).filter(v => v === 'go-around').length, vv = R.land ? R.land.VoverVs : null;
    const bad = [];
    if (!R.stopped) bad.push('not completed');
    if (!(R.level.hRms <= LIM.hRms)) bad.push('h rms ' + R.level.hRms);
    if (rev > LIM.rev) bad.push('hands ' + rev + '/min');
    if (vv != null && vv > LIM.VoverVs) bad.push('touch ' + vv + ' Vs');
    const gaBad = ga > 0 && !b.known;
    if (gaBad) bad.push(ga + ' go-around');
    console.log('  ' + (bad.length ? 'FAIL' : 'ok  ') + ' ' + (b.k + ' level').padEnd(18) + ' ' + b.order + ': ' + (R.stopped ? 'completed' : 'NOT completed') + ', h rms ' + R.level.hRms + ' m (peak ' + R.level.hPeak +
      '), hands da/dr/de ' + (lv.da || 0) + '/' + (lv.dr || 0) + '/' + (lv.de || 0) + ' /min, touch ' + (vv != null ? vv + ' Vs' : '-') + ', go-arounds ' + ga + (ga && b.known ? ' (KNOWN: ' + b.known + ')' : ''));
    for (const x of bad) fails.push(b.k + ' level: ' + x);
  }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  if (fails.length) { console.log('  failures:\n    ' + fails.join('\n    ')); console.log('GATE APSMOOTH: FAIL'); process.exit(1); }
  console.log('GATE APSMOOTH: PASS');
});
