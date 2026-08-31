#!/usr/bin/env node
// Gate: THE TEST PILOT (G107). 41_test_pilot.js's own battery, and it is
// NEGATIVE-FIRST by design: the whole point of the second autopilot is that an
// aeroplane which cannot fly comes back SAYING SO in bounded time, so the
// load-bearing cases here are the two builds that must fail correctly —
// measured builds, not synthetic reports:
//
//   HEAVY   rotax277 + 400 kg  — never accelerates. Must reject on the strip
//           within seconds, never get airborne, stop with the brakes on.
//   HOVER   rotax582 + 260 kg  — lifts off into ground effect and can climb
//           no further (the donor autopilot hangs in LIFTOFF for ever on this
//           build — measured, 400 s and counting). Must put it back down.
//   GOOD    the stock garage build — must fly the whole circuit CLEAN and
//           bring back the landing run, which is the plaque's new number.
//
// Every case is also a TERMINATION test: the pilot must reach STOPPED inside
// the case's own time bound, because "it keeps going forever" is the failure
// class this file exists to end.
//
// node tools/test_pilot.js            -> the battery
// node tools/test_pilot.js --selftest -> negative verification of the checks
//    themselves, on doctored reports: a check that cannot fail gates nothing.
'use strict';
const { makeSim, makeTestPilot, makeWorld, buildGen } = require('./flight_core.js');

const fails = [];
const check = (ok, label, extra) => {
  console.log((ok ? '  ok     ' : '  FAIL   ') + label + (ok || !extra ? '' : ' — ' + extra));
  if (!ok) fails.push(label);
  return ok;
};

// ---------------------------------------------------------------------------
// the runner: settle parked, then fly until STOPPED or the case's bound.
// Returns the pilot's report plus the termination facts the checks need.
// ---------------------------------------------------------------------------
function fly(spec, maxS, card) {
  const world = makeWorld();
  const def = spec ? buildGen(spec) : buildGen();
  const sim = makeSim(def, world);
  sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = makeTestPilot(sim, def, world);
  if (card) ap.setCard(card);              // SI here — the UI converts, not us
  let aglMax = 0, tEnd = maxS, nan = false;
  for (let s = 0; s < maxS * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (sim.stats().bad) { nan = true; tEnd = s / 60; break; }
    aglMax = Math.max(aglMax, ap.dbg.agl || 0);
    if (ap.phase === 'STOPPED' && ap.t > 5) { tEnd = s / 60; break; }
  }
  return { report: ap.report, phase: ap.phase, t: tEnd, aglMax, nan,
           gaN: ap.gaN || 0 };
}

const has = (r, code) => r.report.verdicts.some(v => v.code === code);

// ---------------------------------------------------------------------------
// the checks, as named functions over a flight result — so --selftest can
// aim them at doctored reports and prove each one can go red.
// ---------------------------------------------------------------------------
function checkGood(r) {
  check(!r.nan, 'good: no NaN');
  check(r.phase === 'STOPPED' && r.t < 340, 'good: full stop inside 340 s',
        r.phase + ' at ' + r.t.toFixed(0) + ' s');
  check(r.report.outcome === 'completed', 'good: outcome is completed',
        String(r.report.outcome));
  check(!has(r, 'rejected-takeoff') && !has(r, 'gave-up'),
        'good: no rejection and no giving up on a sound aeroplane');
  const L = r.report.landing;
  check(!!L && L.run > 30 && L.run < 800,
        'good: the landing run came back (' + (L ? L.run + ' m' : 'none') + ')');
  check(!!L && Math.abs(L.pastAim) < 200,
        'good: touched within 200 m of the aim' +
        (L ? ' (' + L.pastAim + ' m)' : ''));
  check(!!L && L.sink > 0 && L.sink < 3,
        'good: a landing, not an arrival (' + (L ? L.sink + ' m/s' : '—') + ')');
}
function checkHeavy(r) {
  check(!r.nan, 'heavy: no NaN');
  check(r.report.outcome === 'rejected-takeoff',
        'heavy: the takeoff is REJECTED', String(r.report.outcome));
  check(r.phase === 'STOPPED' && r.t < 60,
        'heavy: rejected and stopped inside 60 s',
        r.phase + ' at ' + r.t.toFixed(0) + ' s');
  check(r.aglMax < 2, 'heavy: never airborne (agl max ' +
        r.aglMax.toFixed(1) + ' m)');
  check(has(r, 'rejected-takeoff'),
        'heavy: the verdict says why, on the record');
}
function checkHover(r) {
  check(!r.nan, 'hover: no NaN');
  check(r.report.outcome === 'rejected-takeoff',
        'hover: put back down = a rejected takeoff', String(r.report.outcome));
  check(has(r, 'wont-climb'),
        'hover: the wont-climb verdict is on the record');
  check(r.phase === 'STOPPED' && r.t < 150,
        'hover: down and stopped inside 150 s — the donor hangs here forever',
        r.phase + ' at ' + r.t.toFixed(0) + ' s');
}
// THE TEST CARD (G107.1): asked-vs-flown, measured on the settled cruise leg.
function checkCardHeld(r) {
  const cd = r.report.card;
  check(!r.nan && r.report.outcome === 'completed',
        'card: the carded circuit completes', String(r.report.outcome));
  check(!!cd && cd.alt === 60 && cd.V === 25,
        'card: the ask is on the report, unclamped',
        cd ? cd.alt + ' m / ' + cd.V + ' m/s' : 'no card');
  check(!!cd && cd.altFlown != null && Math.abs(cd.altFlown - 60) <= 12,
        'card: held the asked altitude (' + (cd ? cd.altFlown : '—') +
        ' m of 60)');
  check(!!cd && cd.VFlown != null && Math.abs(cd.VFlown - 25) <= 2,
        'card: held the asked speed (' + (cd ? cd.VFlown : '—') +
        ' m/s of 25)');
}
function checkCardFast(r) {
  const cd = r.report.card;
  check(!r.nan && r.report.outcome === 'completed',
        'fast: the pilot still completes, flying what it CAN', String(r.report.outcome));
  check(has(r, 'cant-hold-speed'),
        'fast: an impossible speed ask is SAID, not silently missed');
  check(!!cd && cd.VFlown != null && cd.VFlown < 40,
        'fast: the flown speed is the aeroplane\'s truth (' +
        (cd ? cd.VFlown : '—') + ' m/s of 45 asked)');
}

// ---------------------------------------------------------------------------
// --selftest: doctor each report the way the failure would and require the
// checks to catch it. No sims flown; this verifies the CHECKS.
// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  const goodish = () => ({ nan: false, phase: 'STOPPED', t: 290, aglMax: 120,
    gaN: 0, report: { outcome: 'completed', verdicts: [],
      landing: { run: 250, sink: 0.9, V: 22, offCentre: 0.2, pastAim: 10 } } });
  const probes = [
    ['good misses its landing run', checkGood,
     (r => { r.report.landing = null; return r; })(goodish())],
    ['good never stops', checkGood,
     (r => { r.phase = 'CRUISE'; r.t = 340; return r; })(goodish())],
    ['good quietly carried a rejection', checkGood,
     (r => { r.report.verdicts.push({ t: 1, code: 'rejected-takeoff', note: '' });
             return r; })(goodish())],
    ['heavy got airborne', checkHeavy,
     (r => { r.aglMax = 40; r.report.outcome = 'rejected-takeoff';
             r.report.verdicts.push({ t: 1, code: 'rejected-takeoff', note: '' });
             r.t = 30; return r; })(goodish())],
    ['heavy completed instead of rejecting', checkHeavy,
     (r => { r.t = 30; r.aglMax = 0.5; return r; })(goodish())],
    ['hover has no wont-climb verdict', checkHover,
     (r => { r.report.outcome = 'rejected-takeoff'; r.t = 90; return r; })(goodish())],
    ['card shortfall goes unnoticed', checkCardHeld,
     (r => { r.report.card = { alt: 60, V: 25, altFlown: 31, VFlown: 24.8 };
             return r; })(goodish())],
    ['impossible speed ask goes unsaid', checkCardFast,
     (r => { r.report.card = { alt: null, V: 45, altFlown: 110, VFlown: 29 };
             return r; })(goodish())],
  ];
  let caught = 0;
  for (const [nm, fn, r] of probes) {
    const before = fails.length;
    fn(r);
    const ok = fails.length > before;
    fails.length = before;                       // probes must not fail the run
    console.log(`  selftest ${nm.padEnd(42)} ${ok ? 'CAUGHT' : 'MISSED'}`);
    if (ok) caught++;
  }
  const pass = caught === probes.length;
  console.log('GATE PILOT: ' + (pass ? 'PASS' : 'FAIL (selftest: ' +
    (probes.length - caught) + ' probe(s) went unnoticed)'));
  process.exit(pass ? 0 : 1);
}

// ---------------------------------------------------------------------------
// the battery
// ---------------------------------------------------------------------------
console.log('-- GOOD: the stock garage build --');
const good = fly(null, 340);
for (const v of good.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
checkGood(good);

console.log('-- HEAVY: rotax277 + 400 kg cargo --');
const heavy = fly({ engines: [{ type: 'rotax277_pusher' }],
                    cargo: { len: 1.2, kg: 400 } }, 90);
for (const v of heavy.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
checkHeavy(heavy);

console.log('-- HOVER: rotax582 + 260 kg cargo --');
const hover = fly({ engines: [{ type: 'rotax582_ivo' }],
                    cargo: { len: 1.2, kg: 260 } }, 150);
for (const v of hover.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
checkHover(hover);

console.log('-- CARD: the stock build, asked for 60 m and 25 m/s --');
const card = fly(null, 340, { alt: 60, V: 25 });
for (const v of card.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
checkCardHeld(card);

console.log('-- FAST: the stock build, asked for 45 m/s it does not have --');
const fast = fly(null, 340, { V: 45 });
for (const v of fast.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
checkCardFast(fast);

if (fails.length) console.log('FAILED CHECKS: ' + fails.join(', '));
console.log('GATE PILOT: ' + (fails.length ? 'FAIL' : 'PASS'));
process.exit(fails.length ? 1 : 0);
