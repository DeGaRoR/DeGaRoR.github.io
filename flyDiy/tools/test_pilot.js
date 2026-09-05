#!/usr/bin/env node
// Gate: THE TEST PILOT (G107). 41_test_pilot.js's own battery, and it is
// NEGATIVE-FIRST by design: the whole point of the second autopilot is that an
// aeroplane which cannot fly comes back SAYING SO in bounded time, so the
// load-bearing cases here are the two builds that must fail correctly —
// measured builds, not synthetic reports:
//
//   HEAVY   a 12 kW e-PPG motor + 400 kg cargo + 60 kg baggage — never
//           accelerates. Must reject on the strip within seconds, never get
//           airborne, stop with the brakes on.
//           IT WAS rotax277 + 400 kg UNTIL G158, and the point of this case is
//           the word SECONDS: the pilot's reject detector waits for the
//           acceleration to flatten, so a build that creeps takes a long time
//           to condemn. When GEN_RULES.propV0K stopped capping every propeller
//           at 42 % efficiency, 21 kW under 400 kg became a creeper — the
//           reject came at 66 s against a 60 s bound, and adding the 60 kg of
//           baggage (`cargo.kg` is clamped at 400, so it was the only door
//           left) only bought 8 s. The bound was not the thing that had gone
//           wrong; the FIXTURE had stopped being hopeless. A 12 kW paramotor
//           engine under 460 kg of payload is hopeless in a way no propeller
//           calibration will rescue, and it is condemned at 8 s.
//   HOVER   rotax582 + 360 kg  — lifts off into ground effect and can climb
//           no further (the donor autopilot hangs in LIFTOFF for ever on this
//           build — measured, 400 s and counting). Must put it back down.
//           260 kg UNTIL G158: the 582's propeller row is one of the ones the
//           registry derives from GEN_RULES.propV0K, so when that constant
//           stopped capping every propeller at 42 % efficiency this build
//           gained 41 % of its static thrust and simply flew away — measured,
//           it was at 125 m and still climbing at the 150 s bound. A negative
//           fixture that has quietly become a positive one gates nothing, so
//           the cargo was re-solved for the SAME BEHAVIOUR rather than the
//           check being relaxed: at 360 kg it reaches 9.0 m, says wont-climb,
//           and is back down and stopped at 72 s.
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
const { makeSim, makeTestPilot, makeWorld, buildGen, GEN_DEFAULT } = require('./flight_core.js');

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
  // G193: since every taildragger rotates at Vr, this build lifts its nose
  // at 15 m/s, decelerates in ground effect and is condemned ON THE STRIP as
  // 'not accelerating' — a rejected take-off with the reason on the record,
  // which is the same bounded refusal by another door; both verdicts pass
  check(has(r, 'wont-climb') || has(r, 'rejected-takeoff'),
        'hover: the wont-climb (or rejected-takeoff) verdict is on the record');
  check(r.phase === 'STOPPED' && r.t < 150,
        'hover: down and stopped inside 150 s — the donor hangs here forever',
        r.phase + ' at ' + r.t.toFixed(0) + ' s');
}
// THE TEST CARD (G107.1): asked-vs-flown, measured on the settled cruise leg.
function checkCardHeld(r) {
  const cd = r.report.card;
  check(!r.nan && r.report.outcome === 'completed',
        'card: the carded circuit completes', String(r.report.outcome));
  check(!!cd && cd.alt === 70 && cd.V === 25,
        'card: the ask is on the report, unclamped',
        cd ? cd.alt + ' m / ' + cd.V + ' m/s' : 'no card');
  check(!!cd && cd.altFlown != null && Math.abs(cd.altFlown - 70) <= 12,
        'card: held the asked altitude (' + (cd ? cd.altFlown : '—') +
        ' m of 70)');
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
  // SHORT OF THE ASK BY A REAL MARGIN, which is the claim — "it flies what it
  // CAN". This read `VFlown < 40`, a literal that only meant anything while
  // the aeroplane could not reach 40; with an honest propeller it reaches
  // 40.2 and the check went red on the aeroplane getting better. The ask is
  // on `cd.V`, so compare against that and the fixture cannot rot again.
  check(!!cd && cd.VFlown != null && cd.V - cd.VFlown > 2,
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
     (r => { r.report.card = { alt: 70, V: 25, altFlown: 31, VFlown: 24.8 };
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

console.log('-- HEAVY: 12 kW e-PPG + 400 kg cargo + 60 kg baggage --');
const heavy = fly({ engines: [{ type: 'eppg_direct_130' }],
                    cabin: { baggage: 60 },
                    cargo: { len: 1.2, kg: 400 } }, 90);
for (const v of heavy.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
checkHeavy(heavy);

// STANCE (G170, the user: "quite a few of my builds break their tailwheel
// simply on spawning, it just flips"). The game spawns through sim.stance()
// — pitched onto its three points before the first step — where a gate
// spawns level and lets the tail fall. A build whose tail-wheel node sits
// 6 cm below the tail-post foot (what the join hands the frame from a short
// drawn spring) took that fall through the plane of its anchors: leg strain
// 0.37, the leg's direction 70 deg off rest. Measured here the game's way:
// the leg keeps its direction and its strain stays under a fifth.
console.log('-- STANCE: a 6 cm tail-wheel leg, spawned the way the game spawns --');
{
  const world = makeWorld();
  const base = buildGen();
  const tpbY = base.nodes.find(n => n.tag === 'TPB').p[1];
  const spec = JSON.parse(JSON.stringify(GEN_DEFAULT));
  spec.gear.twY = tpbY - 0.06;
  const def = buildGen(spec);
  const sim = makeSim(def, world);
  const run = (withStance) => {
    sim.reset(0);
    const th = withStance ? sim.stance() : 0;
    const iTW = def.refs.tw, iTPB = def.nodes.findIndex(n => n.tag === 'TPB');
    const P = i => [sim.p[i*3], sim.p[i*3+1], sim.p[i*3+2]];
    const r0 = P(iTW).map((v, k) => v - P(iTPB)[k]);
    let minDot = 1, strain = 0;
    const leg = sim.beams.find(b => (b.a === iTW || b.b === iTW) && b.vis === 'leg');
    for (let s = 0; s < 8 * 60; s++) {
      sim.ctl.brake = 0.6; sim.step(1 / 60);
      const r = P(iTW).map((v, k) => v - P(iTPB)[k]);
      const d = (r[0]*r0[0] + r[1]*r0[1] + r[2]*r0[2]) /
                ((Math.hypot(...r0) * Math.hypot(...r)) || 1);
      minDot = Math.min(minDot, d);
      if (leg) strain = Math.max(strain, Math.abs(leg.strain || 0));
    }
    return { th, minDot, strain, nan: sim.stats().bad };
  };
  const a = run(true), b = run(false);
  console.log('   stance ' + (a.th * 57.3).toFixed(1) + ' deg | with: dot ' +
              a.minDot.toFixed(2) + ' strain ' + a.strain.toFixed(3) +
              ' | level drop: dot ' + b.minDot.toFixed(2) + ' strain ' + b.strain.toFixed(3));
  check(!a.nan && Math.abs(a.th) > 0.05, 'stance: the airframe was pitched onto its third wheel',
        (a.th * 57.3).toFixed(1) + ' deg');
  check(a.minDot > 0.7, 'stance: the short leg keeps its direction', 'dot ' + a.minDot.toFixed(2));
  check(a.strain < 0.2, 'stance: the short leg stays under a fifth of strain', a.strain.toFixed(3));
  // NEGATIVE CONTROL: the level drop on the same build is the failure the
  // stance exists for — if it ever stops being one, the check above is moot
  check(b.strain > a.strain, 'stance: the level drop is worse than the stance on the same build',
        b.strain.toFixed(3) + ' vs ' + a.strain.toFixed(3));
}

console.log('-- HOVER: rotax582 + 360 kg cargo --');
const hover = fly({ engines: [{ type: 'rotax582_ivo' }],
                    cargo: { len: 1.2, kg: 360 } }, 150);
for (const v of hover.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
checkHover(hover);

console.log('-- CARD: the stock build, asked for 70 m and 25 m/s --');
// 70 m, not 60 (G158). This is the one place the recalibration changed what
// the aeroplane can be ASKED for rather than what it does. The stock build's
// circuit geometry is derived from its own VCruise and climb gradient, and an
// honest propeller gave it both — so the pattern grew, and at 60 m it now
// crosses rising ground on final. The pilot went around for terrain twice
// (244 s, 502 s) and then said `gave-up — out of patience, not out of sky`,
// which is the terrain guard working, not failing. It held the card perfectly
// throughout: 58 m of the 60 asked, 25.0 m/s of the 25. At 70 m the same
// circuit completes at 289 s with no go-around at all, so the ask moved to a
// height this site supports and the time bound stayed where it was.
const card = fly(null, 340, { alt: 70, V: 25 });
for (const v of card.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
checkCardHeld(card);

console.log('-- FAST: the stock build, asked for 45 m/s it does not have --');
const fast = fly(null, 340, { V: 45 });
for (const v of fast.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
checkCardFast(fast);

if (fails.length) console.log('FAILED CHECKS: ' + fails.join(', '));
console.log('GATE PILOT: ' + (fails.length ? 'FAIL' : 'PASS'));
process.exit(fails.length ? 1 : 0);
