#!/usr/bin/env node
// GATE FLIGHTQ (WS-088, 28 Nov 2026; the user's register: "Lazair and Chinook are certified despite flying extremely badly.
// Review flight-test criteria and certification validity"). The bench's test flight certified on ARRIVAL alone; the pilot
// now measures the flight as it flies it (43_pilot PILOT_FQ / pilotFqSummary, report.quality) and the bench's judge
// withholds the certificate on a FAIL. The evidence and the bounds: reports/WS-088-FLIGHT-CRITERIA.md.
//   1 THE SUMMARY (pure): a steady flight passes every row; a pitch swing, wing rock, a height not held, an attitude no
//     circuit asks, a speed under the stall, a control held on its stop each fail their own row; no settled leg is said
//     (warn), not judged; nothing airborne is no verdict
//   2 THE JUDGE (bench.js 'flight'): an arrival with a FAIL verdict is NOT certified ("ARRIVED, BUT FLEW BADLY", the rows
//     in the fix); a WARN certifies; a hand-flown arrival keeps "a landing is a landing"; a report from before the measure
//     (no quality) keeps the arrival's rule; no arrival is no certificate, as before
//   3 READ-ONLY: the recorder writes no control (a source scan of fqStep) - the flight is the flight it was
//   4 FLOWN: the pilot's own circuit on the default field - the user's Cub passes every row; the Birdman test copy (the
//     Chinook as first saved, an aeroplane the pilot can barely hold) fails on its pitch, its wings and its speed
//   5 THE RUDDER ROW (genRudderHold, ctl.rudder): a weathercock stability at or under zero holds no sideslip - 0 kt, said
//     in words, no number out of a floored divisor (the Risen V-tail printed "5883796.03 deg"); past the fin's stall the
//     sideslip is printed capped; the Cub's row is what it was
//   node tools/_flightq_check.js [--quick]   (--quick: 1-3 and 5, no flight)   -> "GATE FLIGHTQ: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const quick = process.argv.includes('--quick');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok     ' : '  FAIL   ') + m); if (!c) fails++; return c; };

// ---- 1 THE SUMMARY ---------------------------------------------------------------------------------------------------
console.log('1. the summary (pilotFqSummary)');
const B = C.PILOT_FQ;
const base = () => ({ legT: 120, pDev: 2, bDev: 4, vS2: 0.25 * 0.25 * 120, airT: 300, bankMax: 24, pMax: 12, pMin: -6, vRatio: 1.2, stopT: 0, stopRunMax: 0, stopWhich: '' });
const lvOf = (q, id) => { const r = C.pilotFqSummary(q).rows.find(x => x.id === id); return r ? r.level : null; };
{ const S = C.pilotFqSummary(base());
  ok(S.level === 'pass' && S.rows.length === 6 && S.rows.every(r => r.level === 'pass'), 'a steady circuit passes every row: ' + S.rows.map(r => r.id + ' ' + r.value).join(', ')); }
const cases = [
  ['fq.pitch', q => { q.pDev = B.pitchDev[1] + 1; }, 'a pitch swing past ' + B.pitchDev[1] + ' deg (porpoising)'],
  ['fq.bank', q => { q.bDev = B.bankDev[1] + 1; }, 'wing rock past ' + B.bankDev[1] + ' deg'],
  ['fq.vs', q => { q.vS2 = (B.vsRms[1] + 0.2) ** 2 * q.legT; }, 'a vertical speed scatter past ' + B.vsRms[1] + ' m/s'],
  ['fq.att', q => { q.bankMax = B.bankMax[1] + 5; }, 'a bank of ' + (B.bankMax[1] + 5) + ' deg'],
  ['fq.att', q => { q.pMin = B.pitchDn[1] - 5; }, 'the nose ' + (B.pitchDn[1] - 5) + ' deg down'],
  ['fq.speed', q => { q.vRatio = 0.95; }, '0.95 x the stall speed'],
  ['fq.stops', q => { q.stopT = 0.2 * q.airT; q.stopRunMax = 8; q.stopWhich = 'elevator'; }, 'the elevator on its stop 20 % of the flight'],
];
for (const [id, fn, what] of cases) {
  const q = base(); fn(q); const S = C.pilotFqSummary(q);
  ok(S.level === 'fail' && lvOf(q, id) === 'fail' && S.rows.filter(r => r.level === 'fail').length === 1, what + ': ' + id + ' fails, and only it');
}
{ const q = base(); q.pDev = (B.pitchDev[0] + B.pitchDev[1]) / 2; const S = C.pilotFqSummary(q);
  ok(S.level === 'warn' && lvOf(q, 'fq.pitch') === 'warn', 'between the two bounds: a warning, not a fail (' + q.pDev + ' deg)'); }
{ const q = base(); q.legT = B.legMin - 5; const S = C.pilotFqSummary(q);
  ok(S.level === 'warn' && S.rows.some(r => r.id === 'fq.leg' && r.level === 'warn') && !S.rows.some(r => r.id === 'fq.pitch'), 'no settled leg (' + q.legT + ' s): said, not judged'); }
{ const q = base(); q.airT = 0; ok(C.pilotFqSummary(q).level === null, 'nothing airborne: no verdict'); }

// ---- 2 THE JUDGE -----------------------------------------------------------------------------------------------------
console.log('2. the judge (bench.js flight)');
// (bench.js loaded as _bench_check.js loads it: CommonJS in a fresh context, the certificate's rule from the built core)
const vm = require('vm');
const RULE = C.certMajorOf ? { certMajorOf: C.certMajorOf, certStrip: C.certStrip, certGroupsChanged: C.certGroupsChanged, certChangeLine: C.certChangeLine } : {};
const load = rel => {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8'), m = { exports: {} };
  vm.runInNewContext(src, Object.assign({ module: m, exports: m.exports, console, Math, JSON, parseFloat, isFinite, Number, String, Array, Object,
    Uint8ClampedArray, Infinity, setTimeout, clearTimeout, setInterval, clearInterval, performance, Date, Symbol }, RULE));
  return m.exports;
};
let BE = null; try { BE = load('src/viewer/bench.js'); } catch (e) { BE = null; }
const fl = BE && BE.BENCH_TESTS ? BE.BENCH_TESTS.filter(t => t.id === 'flight')[0] : null;
if (ok(fl && typeof fl.judge === 'function', 'the flight card loaded (' + (BE ? 'bench.js' : 'NOT LOADED') + ')')) {
  const good = C.pilotFqSummary(base()), badQ = (() => { const q = base(); q.pDev = 15; q.vRatio = 0.88; return C.pilotFqSummary(q); })();
  const warnQ = (() => { const q = base(); q.bDev = 12; return C.pilotFqSummary(q); })();
  const rep = Q => ({ verdicts: [], outcome: 'completed', landing: { run: 200, sink: 0.4, pastAim: 10 }, quality: Q });
  const j1 = fl.judge({ report: rep(good), arrived: true, t: 300, manual: false });
  const j2 = fl.judge({ report: rep(badQ), arrived: true, t: 300, manual: false });
  const j3 = fl.judge({ report: rep(warnQ), arrived: true, t: 300, manual: false });
  const j4 = fl.judge({ report: rep(badQ), arrived: true, t: 300, manual: true });
  const j5 = fl.judge({ report: { verdicts: [], outcome: 'completed', landing: { run: 200, sink: 0.4, pastAim: 10 } }, arrived: true, t: 300, manual: false });
  const j6 = fl.judge({ report: rep(good), arrived: false, t: 30, manual: false, outcome: 'rejected-takeoff' });
  ok(j1.ok && j1.verdict === 'FLEW THE CIRCUIT', 'an arrival that flew well certifies: ' + j1.verdict);
  ok(!j2.ok && j2.verdict === 'ARRIVED, BUT FLEW BADLY' && /pitch held/.test(j2.fix) && /speed above the stall/.test(j2.fix) && /flew badly/.test(j2.note),
     'an arrival that flew badly does not: ' + j2.verdict + ' - ' + j2.fix.slice(0, 160));
  ok(j3.ok, 'a warning certifies (' + j3.verdict + ')');
  ok(j4.ok && j4.verdict === 'ARRIVED, BY HAND', 'a hand-flown arrival keeps "a landing is a landing" (' + j4.verdict + ')');
  ok(j5.ok && j5.verdict === 'FLEW THE CIRCUIT', 'a report from before the measure keeps the arrival\'s rule');
  ok(!j6.ok, 'no arrival, no certificate (' + j6.verdict + ')');
}

// ---- 3 READ-ONLY -----------------------------------------------------------------------------------------------------
console.log('3. the recorder only reads');
{ const src = fs.readFileSync(path.join(ROOT, 'src', 'core', '43_pilot.js'), 'utf8');
  const a = src.indexOf('const fqStep = '), b = src.indexOf('const sheetOf = () => {', a), body = a > 0 && b > a ? src.slice(a, b) : '';
  ok(body.length > 200 && !/\b(c|sim\.ctl)\.(de|da|dr|thr|flap|brake|gear)\s*=[^=]/.test(body) && !/\bgo\(/.test(body) && !/\bengage\(/.test(body),
     'fqStep writes no control, changes no phase, engages no mode (' + body.length + ' chars scanned)');
  ok(/fqStep\(dt, onG, agl, vcg, xA, zR\);/.test(src) && /ap\.report\.quality = pilotFqSummary\(FQ\)/.test(src), 'it runs every step and keeps report.quality fresh'); }

// ---- 4 FLOWN ---------------------------------------------------------------------------------------------------------
if (!quick) {
  console.log('4. flown: the pilot\'s own circuit on the default field');
  const LB = require(path.join(T, '_load_build.js'));
  const fly = file => {
    const Bd = LB.loadBuild(path.join(ROOT, file)), def = C.buildGen(Bd.spec), W = C.makeWorld(), sim = C.makeSim(def, W); sim.reset(0);
    for (let i = 0; i < 600; i++) sim.step(1 / 60);
    const ap = C.makePilot(sim, def, W); let stopN = 0;
    for (let s = 0; s < 600 * 60; s++) { ap.update(1 / 60); sim.step(1 / 60); if (sim.stats().bad) break; stopN = ap.phase === 'STOPPED' ? stopN + 1 : 0; if (stopN > 120) break; }
    return ap.report;
  };
  const line = Q => Q ? Q.level + ': ' + Q.rows.map(r => r.id.slice(3) + ' ' + r.value + (r.level !== 'pass' ? ' ' + r.level.toUpperCase() : '')).join(', ') : 'NO QUALITY';
  { const R = fly('builds/cub_2026-09-20_corrected.json'), Q = R.quality;
    ok(R.outcome === 'completed' && Q && Q.level === 'pass' && Q.rows.every(r => r.level === 'pass'), 'the user\'s Cub flies a clean circuit - ' + line(Q)); }
  { const R = fly('tools/fixtures/test_copies/build_v10_birdman_2026-09-18.json'), Q = R.quality, lv = id => (Q && Q.rows.find(r => r.id === id) || {}).level;
    ok(Q && Q.level === 'fail' && lv('fq.pitch') === 'fail' && lv('fq.bank') === 'fail' && lv('fq.speed') === 'fail',
       'the Birdman lands (' + R.outcome + ') but fails its pitch, its wings and its speed - ' + line(Q)); }
}

// ---- 5 THE RUDDER ROW ------------------------------------------------------------------------------------------------
console.log('5. the rudder row (genRudderHold)');
{ const u = C.genRudderHold(-0.001, 0.06, 16), z = C.genRudderHold(0, 0.06, 16), big = C.genRudderHold(0.001, 0.06, 16), n = C.genRudderHold(0.09, 0.03, 16);
  const nums = s => (s.match(/[0-9]+(\.[0-9]+)?/g) || []).map(Number);
  ok(!u.stable && u.xw === 0 && u.level === 'fail' && /no steady sideslip/.test(u.why) && nums(u.why).every(x => x < 1000),
     'the Risen\'s case (Cn_beta -0.001): ' + u.why);
  ok(!z.stable && z.xw === 0 && z.level === 'fail', 'Cn_beta exactly 0: no sideslip held, fail');
  ok(big.stable && big.bMax > 0.6 && /more than 34\.38 deg/.test(big.why) && nums(big.why).every(x => x < 1000), 'a tiny positive Cn_beta: printed capped at the fin\'s stall - ' + big.why);
  ok(n.stable && Math.abs(n.bMax - 1 / 3) < 1e-12 && n.level === 'pass' && /19\.1 deg/.test(n.why), 'an ordinary fin: ' + n.why); }
{ const LB = require(path.join(T, '_load_build.js')), s = LB.loadBuild(path.join(ROOT, 'builds/cub_2026-09-20_corrected.json')).spec;
  const D = C.genShakedown(C.buildGen(s)).design, r = D.rows.find(x => x.id === 'ctl.rudder');
  ok(r && r.value === 13.62 && r.level === 'pass' && r.why === 'full rudder holds 19.68 deg of sideslip at 74.88 km/h', 'the user\'s Cub\'s row is what it was: ' + (r ? r.value + ' kt, ' + r.why : 'NO ROW')); }

console.log('GATE FLIGHTQ: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
