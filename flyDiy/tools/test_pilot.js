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
const fs = require('fs'), path = require('path');
const { makeSim, makePilot, makeWorld, buildGen, GEN_DEFAULT, siteOf, placeAtStand,
        genMigrateSpec, navMake, navRad, navDeg, navDiff } = require('./flight_core.js');

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
// G202: `opts` — { wind: [wx, wz], depart: true (plan from the pose), stand:
// true (start on the stand), def (a built def instead of a spec), again:
// true (a second leg on the SAME sim from the stopped pose) }. The record
// grows the facts the new checks read: the lift-off run, the flap at the
// flare, the status on the roll, the landing direction, the phase list.
function fly(spec, maxS, card, opts) {
  opts = opts || {};
  const world = makeWorld();
  if (opts.wind && world.setWind) world.setWind({ base: [opts.wind[0], 0, opts.wind[1]], gust: 0 });
  const def = opts.def || (spec ? buildGen(spec) : buildGen());
  const sim = makeSim(def, world);
  sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const a = world.aerodromes[0], site = siteOf('HOME');
  if (opts.stand) { if (sim.stance) sim.stance(); placeAtStand(sim, a, site.stand); }
  const mk = () => makePilot(sim, def, world);
  let ap = mk();
  if (opts.stand || opts.depart) { ap.setRoute(a, a); ap.departFrom(a, a, site); }
  if (card) ap.setCard(card);              // SI here — the UI converts, not us
  const leg = (ap) => {
    const rec = { aglMax: 0, tEnd: maxS, nan: false, liftRun: null, flapAtFlare: null,
                  statusRoll: null, landDir: null, phases: [],
                  // the roll's own instruments (TRIKE-XWIND, 2026-09-11)
                  rollMaxE: 0, rollMaxBank: 0, rollDrFlips: 0, liftXT: null };
    let last = null, sRoll = null, drSign = 0;
    for (let s = 0; s < maxS * 60; s++) {
      ap.update(1 / 60); sim.step(1 / 60);
      if (ap.phase !== last) { rec.phases.push(ap.phase); last = ap.phase; }
      if (ap.phase === 'ROLL') {
        if (sRoll == null) sRoll = ap.dbg.s;
        rec.rollMaxE = Math.max(rec.rollMaxE, Math.abs(ap.dbg.e || 0) * 57.3);
        if (sim.wheelsOnGround() > 0) rec.rollMaxBank = Math.max(rec.rollMaxBank, Math.abs(ap.dbg.ph || 0) * 57.3);
        // a REVERSAL is the rudder crossing zero with authority on both sides
        const dr = sim.ctl.dr, sg = dr > 0.2 ? 1 : dr < -0.2 ? -1 : 0;
        if (sg && drSign && sg !== drSign) rec.rollDrFlips++;
        if (sg) drSign = sg;
        // five metres into the roll: the status is written at the end of a
        // phase's own frame, so the first ROLL frame still carries the hold's
        if (!rec.statusRoll && Math.abs(ap.dbg.s - sRoll) > 5) rec.statusRoll = JSON.parse(JSON.stringify(ap.status || null));
      }
      if (ap.phase === 'LIFTOFF' && rec.liftRun == null && sRoll != null) { rec.liftRun = Math.abs(ap.dbg.s - sRoll); rec.liftXT = ap.dbg.z; }
      if (ap.phase === 'FLARE' && rec.flapAtFlare == null) { rec.flapAtFlare = sim.ctl.flap; rec.landDir = [ap.frame.ux, ap.frame.uz]; }
      if (sim.stats().bad) { rec.nan = true; rec.tEnd = s / 60; break; }
      rec.aglMax = Math.max(rec.aglMax, ap.dbg.agl || 0);
      if (ap.phase === 'STOPPED' && ap.t > 5) { rec.tEnd = s / 60; break; }
    }
    return Object.assign(rec, { report: ap.report, phase: ap.phase, t: rec.tEnd, gaN: ap.gaN || 0 });
  };
  const r = leg(ap);
  r.def = def;
  if (opts.again && r.report.outcome === 'completed') {
    const ap2 = mk();
    ap2.departFrom(a, a);                  // from the stopped pose, no site: the strip's own pattern
    r.again = leg(ap2);
  }
  return r;
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
// G202: THE PILOT's own checks (43_pilot.js)
// AGAIN — the flight everyone failed: land, turn around on the strip, take
// off again. The second leg must taxi (a U-turn or a backtrack), complete,
// and never be a rejected take-off from a run that does not fit.
function checkAgain(r) {
  const s = r.again;
  check(!!s && !s.nan, 'again: a second leg was flown from the stopped pose');
  check(!!s && s.phases.includes('TAXI') && s.phases.includes('HOLD'),
        'again: it taxied to a hold before rolling', s ? s.phases.join(' ') : 'none');
  check(!!s && s.report.outcome === 'completed' && s.phase === 'STOPPED' && s.t < 450,
        'again: the second circuit completes inside 450 s', s ? s.report.outcome + ' at ' + s.t.toFixed(0) + ' s' : '—');
  check(!!s && !has(s, 'rejected-takeoff') && !has(s, 'taxi-lost'),
        'again: no rejection and no lost taxi on the turn-around');
}
// WIND — 3 m/s along the strip: the circuit lands INTO it (the old pilots
// flew out and back and landed downwind on every windy day)
function checkWind(r, wind) {
  check(!r.nan && r.report.outcome === 'completed', 'wind: the windy circuit completes', String(r.report.outcome));
  const dot = r.landDir ? r.landDir[0] * wind[0] + r.landDir[1] * wind[1] : 1;
  check(r.landDir != null && dot < 0, 'wind: the landing is INTO the wind', r.landDir ? 'u.w = ' + dot.toFixed(1) : 'no landing');
  const L = r.report.landing;
  check(!!L && Math.abs(L.pastAim) < 200, 'wind: touched within 200 m of the aim' + (L ? ' (' + L.pastAim + ' m)' : ''));
}
// TRIKE — a nosewheel build ROTATES at Vr: airborne inside 1.5x the sheet's
// run (the old ROLL held a fixed elevator until the wing floated it off)
function checkTrike(r) {
  const A = r.def.params.ap;
  check(!r.nan && r.report.outcome === 'completed', 'trike: the tricycle completes its circuit', String(r.report.outcome));
  check(r.liftRun != null && r.liftRun < 1.5 * A.TORun,
        'trike: lifts off inside 1.5x the sheet run (' + (r.liftRun == null ? '—' : r.liftRun.toFixed(0)) + ' of ' + A.TORun + ' m)');
  const L = r.report.landing;
  check(!!L && L.sink > 0 && L.sink < 3, 'trike: a landing, not an arrival (' + (L ? L.sink + ' m/s' : '—') + ')');
}
// TRIKE-XWIND (2026-09-11) — the user's pusher (tricycle, rod boom, Rotax
// 582 on a pod) across 2 m/s of wind. Before: the nosewheel-steering loop
// ran FIXED gains down the strip and crossed the rate estimate's lag at
// 12 m/s — a 1.25 Hz weave, pursuit error 20 deg, the rudder on its stop 27
// times, 4 m either side of the centreline in CALM air; and the crosswind
// bank bias, clamped on the trike's VTailUp of 99, sat at its 1.6x cap and
// rolled the aeroplane 13 deg onto one main before rotation, 9.5 m off the
// centreline at liftoff and 28 m by CLIMB in the game's "wind 4 + gusts".
// After (genAP VSteer + the trike steer schedule + the three-wheel bias
// cap): 9 deg, 2.8 deg of bank, 3.4 m. The bounds sit outside today's
// numbers and far inside the disease.
function checkTrikeXwind(r) {
  check(!r.nan && r.report.outcome === 'completed', 'trike-xwind: the pusher completes its circuit across the wind', String(r.report.outcome));
  check(r.rollMaxE < 12, 'trike-xwind: the roll holds its pursuit line (' + r.rollMaxE.toFixed(1) + ' deg, bound 12)');
  check(r.rollDrFlips < 4, 'trike-xwind: no rudder limit cycle on the roll (' + r.rollDrFlips + ' reversals past 0.2, bound 4)');
  check(r.rollMaxBank < 5, 'trike-xwind: wings level on three wheels (' + r.rollMaxBank.toFixed(1) + ' deg of bank on the ground, bound 5)');
  check(r.liftXT != null && Math.abs(r.liftXT) < 5, 'trike-xwind: lifts off near the centreline (' + (r.liftXT == null ? '—' : r.liftXT.toFixed(1)) + ' m, bound 5)');
  const A = r.def.params.ap;
  check(r.liftRun != null && r.liftRun < 1.6 * A.TORun,
        'trike-xwind: rotates, not floats (' + (r.liftRun == null ? '—' : r.liftRun.toFixed(0)) + ' of ' + A.TORun + ' m sheet, bound 1.6x)');
}
// FLAPS + STATUS — a flapped build (the user's ultralight) has its flaps
// DOWN at the flare, and the pilot says what it is doing on the roll
function checkFlapsStatus(r, ldg) {
  check(!r.nan && r.report.outcome === 'completed', 'flaps: the flapped build completes from the stand', String(r.report.outcome));
  // THE FLARE FLIES WHAT THE BUILD LANDS ON (TAIL CHANTIER 2 P5, 2026-09-08).
  // The trim solver decides the landing configuration: an aeroplane whose
  // flapped approach eats the elevator budget LANDS FLAPLESS (genTrim sets
  // params.flaps.ldg 0), which is the one change a builder would make. So
  // the row asks for the schedule the BUILD declares — flaps down at the
  // flare when it lands on flaps, and nothing hanging out when it does not.
  // Under the vortex flip this fixture lands flapless; the RULING OWED on
  // that (DEBT-REGISTER §1) is about the trim, not about the servo.
  const want = ldg == null ? 1 : ldg;
  check(r.flapAtFlare != null && Math.abs(r.flapAtFlare - want) < 0.1,
        'flaps: the flare flies the build\'s own landing flap (' +
        (r.flapAtFlare == null ? '—' : r.flapAtFlare.toFixed(2)) + ' of ' + want.toFixed(2) +
        (want > 0 ? '' : ' — this build lands FLAPLESS') + ')');
  const st = r.statusRoll;
  check(!!st && !!st.goal && Array.isArray(st.conds) && st.conds.some(c => c.what === 'airspeed') && st.conds.some(c => c.what === 'runway left'),
        'status: the roll says its goal and its conditions (airspeed, runway left)', st ? JSON.stringify(st.conds.map(c => c.what)) : 'no status');
  check(!!st && st.afcs && typeof st.afcs.lat === 'string' && typeof st.afcs.vert === 'string' && typeof st.afcs.thr === 'string',
        'status: the AFCS modes are annunciated');
}
// BOX (G202.1) — the modes as a device: engaged mid-circuit over the pilot,
// HDG + ALT + SPD held, VS held, an axis released to the hand untouched,
// NAV direct-to a meadow converging, and the pilot resuming to a landing
// when the box is disengaged.
function checkBox(r) {
  check(!r.nan, 'box: no NaN');
  check(r.phaseBox === 'BOX' && /^AP box/.test(r.statusBox || ''), 'box: the phase and the status say the box is flying', r.phaseBox + ' / ' + r.statusBox);
  check(r.altErr < 8, 'box: ALT holds the selected altitude (' + (r.altErr == null ? '—' : r.altErr.toFixed(1)) + ' m off)');
  check(r.hdgErr < 3, 'box: HDG holds the selected heading (' + (r.hdgErr == null ? '—' : r.hdgErr.toFixed(1)) + ' deg off)');
  check(r.iasErr < 2, 'box: SPD holds the selected airspeed (' + (r.iasErr == null ? '—' : r.iasErr.toFixed(1)) + ' m/s off)');
  check(r.vsErr < 0.4, 'box: VS holds the selected vertical speed (' + (r.vsErr == null ? '—' : r.vsErr.toFixed(2)) + ' m/s off)');
  check(r.handDa === 0.05, 'box: an axis released to the hand is left untouched (da ' + r.handDa + ')');
  check(r.altHold2 < 15, 'box: ALT still holds while the hand rolls (' + (r.altHold2 == null ? '—' : r.altHold2.toFixed(1)) + ' m)');
  check(r.xtk < 60, 'box: NAV direct-to converges on the course (xtk ' + (r.xtk == null ? '—' : r.xtk.toFixed(0)) + ' m)');
  check(r.disDrop > 1500, 'box: NAV closes on the waypoint (' + (r.disDrop == null ? '—' : r.disDrop.toFixed(0)) + ' m nearer)');
  check(r.outcome === 'completed' && r.phase === 'STOPPED', 'box: the pilot resumes on disengage and lands', r.outcome + ' / ' + r.phase + ' at ' + (r.t || 0).toFixed(0) + ' s');
}
function flyBox() {
  const world = makeWorld();
  const def = buildGen();
  const sim = makeSim(def, world); sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = makePilot(sim, def, world);
  const nav = navMake({ waypoints: world.aerodromes });
  ap.setNav(nav);
  const rec = { nan: false };
  const step = (n, hand) => { for (let i = 0; i < n; i++) { if (hand) hand(); ap.update(1 / 60); sim.step(1 / 60); if (sim.stats().bad) { rec.nan = true; return false; } } return true; };
  let n = 0; while (ap.phase !== 'DOWNWIND' && n++ < 60 * 200) step(1);
  step(60 * 8);
  const m0 = ap.instruments();
  const alt1 = m0.alt + 40, hdg1 = navRad(m0.trk), Vc = def.params.ap.VCruise;
  ap.engage({ lat: 'HDG', vert: 'ALT', thr: 'SPD' }, { hdg: hdg1, alt: alt1, ias: Vc });
  step(60 * 60);
  let m = ap.instruments();
  rec.altErr = Math.abs(m.alt - alt1); rec.hdgErr = Math.abs(navDiff(m.hdg, navDeg(hdg1))); rec.iasErr = Math.abs(m.ias - Vc);
  rec.phaseBox = ap.phase; rec.statusBox = ap.status.goal;
  ap.engage({ vert: 'VS' }, { vs: -1.5 });
  step(60 * 20); m = ap.instruments(); rec.vsErr = Math.abs(m.vs + 1.5);
  ap.engage({ lat: null, vert: 'ALT' }, { alt: m.alt });
  step(60 * 5, () => { sim.ctl.da = 0.05; sim.ctl.dr = 0; });
  rec.handDa = sim.ctl.da; m = ap.instruments(); rec.altHold2 = Math.abs(m.alt - ap.box.sel.alt);
  nav.directTo('M1', m.x, m.z);
  ap.engage({ lat: 'NAV', vert: 'ALT' }, { alt: m.alt + 60 });
  const dis0 = nav.update(m.x, m.z, 0, 0, 0).dis;
  step(60 * 90); const R = nav.last; rec.xtk = R ? Math.abs(R.xtk) : 1e9; rec.disDrop = R ? dis0 - R.dis : -1;
  ap.disengage();
  n = 0; while (ap.phase !== 'STOPPED' && n++ < 60 * 600 && !rec.nan) step(1);
  rec.outcome = ap.report.outcome; rec.phase = ap.phase; rec.t = ap.t; rec.verdicts = ap.report.verdicts;
  return rec;
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
    // G202
    ['again never turned around', checkAgain,
     (r => { r.again = Object.assign(goodish(), { phases: ['DEPART', 'HOLD', 'ROLL', 'ABORT', 'STOPPED'] }); return r; })(goodish())],
    ['again rejected the second take-off', checkAgain,
     (r => { r.again = Object.assign(goodish(), { phases: ['TAXI', 'HOLD', 'ROLL'] });
             r.again.report.verdicts.push({ t: 1, code: 'rejected-takeoff', note: '' }); return r; })(goodish())],
    ['windy landing was downwind', r => checkWind(r, [-3, 0]),
     (r => { r.landDir = [-1, 0]; return r; })(goodish())],
    ['trike floated off late', checkTrike,
     (r => { r.def = { params: { ap: { TORun: 150 } } }; r.liftRun = 400; return r; })(goodish())],
    ['trike-xwind weaved down the strip', checkTrikeXwind,
     (r => { r.def = { params: { ap: { TORun: 150 } } }; r.rollMaxE = 19; r.rollDrFlips = 27; r.rollMaxBank = 1; r.liftXT = 1; r.liftRun = 200; return r; })(goodish())],
    ['trike-xwind rolled onto one main', checkTrikeXwind,
     (r => { r.def = { params: { ap: { TORun: 150 } } }; r.rollMaxE = 3; r.rollDrFlips = 0; r.rollMaxBank = 13; r.liftXT = 9.5; r.liftRun = 200; return r; })(goodish())],
    ['flaps stayed up at the flare', checkFlapsStatus,
     (r => { r.flapAtFlare = 0; r.statusRoll = { goal: 'x', conds: [{ what: 'airspeed' }, { what: 'runway left' }], afcs: { lat: 'RWY', vert: 'DE', thr: 'SET' } }; return r; })(goodish())],
    ['status said nothing on the roll', checkFlapsStatus,
     (r => { r.flapAtFlare = 1; r.statusRoll = { goal: '', conds: [], afcs: null }; return r; })(goodish())],
    // G202.1
    ['box let the altitude drift', checkBox,
     { nan: false, phaseBox: 'BOX', statusBox: 'AP box: HDG ALT SPD', altErr: 30, hdgErr: 1, iasErr: 1, vsErr: 0.1, handDa: 0.05, altHold2: 3, xtk: 10, disDrop: 2500, outcome: 'completed', phase: 'STOPPED', t: 500 }],
    ['box wrote the hand\'s aileron', checkBox,
     { nan: false, phaseBox: 'BOX', statusBox: 'AP box: HDG ALT SPD', altErr: 2, hdgErr: 1, iasErr: 1, vsErr: 0.1, handDa: 0, altHold2: 3, xtk: 10, disDrop: 2500, outcome: 'completed', phase: 'STOPPED', t: 500 }],
    ['nav never converged', checkBox,
     { nan: false, phaseBox: 'BOX', statusBox: 'AP box: HDG ALT SPD', altErr: 2, hdgErr: 1, iasErr: 1, vsErr: 0.1, handDa: 0.05, altHold2: 3, xtk: 300, disDrop: 2500, outcome: 'completed', phase: 'STOPPED', t: 500 }],
    ['pilot never resumed', checkBox,
     { nan: false, phaseBox: 'BOX', statusBox: 'AP box: HDG ALT SPD', altErr: 2, hdgErr: 1, iasErr: 1, vsErr: 0.1, handDa: 0.05, altHold2: 3, xtk: 10, disDrop: 2500, outcome: null, phase: 'BOX', t: 900 }],
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

// ---- G202: THE PILOT's own cases ------------------------------------------
console.log('-- AGAIN: the stock build lands, turns around on the strip, takes off again --');
const again = fly(null, 450, null, { again: true });
if (again.again) {
  for (const v of again.again.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
  console.log('   second leg: ' + again.again.phases.join(' ') + ' | ' + again.again.report.outcome + ' at ' + again.again.t.toFixed(0) + ' s');
}
checkAgain(again);

console.log('-- WIND: 3 m/s along the strip, planned from the spawn — lands into it --');
const windy = fly(null, 560, null, { wind: [-3, 0], depart: true });
for (const v of windy.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
console.log('   landed along ' + JSON.stringify(windy.landDir) + ' in ' + windy.t.toFixed(0) + ' s');
checkWind(windy, [-3, 0]);

console.log('-- TRIKE: the stock build on a nosewheel --');
const trike = fly({ gear: { type: 'tricycle' } }, 340);
for (const v of trike.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
console.log('   lift-off run ' + (trike.liftRun == null ? '—' : trike.liftRun.toFixed(0)) + ' m of a ' + trike.def.params.ap.TORun + ' m sheet');
checkTrike(trike);

console.log("-- TRIKE-XWIND: the user's pusher across 2 m/s --");
{
  const FIX = path.join(__dirname, 'fixtures', 'build_v8_pusher_2026-09-11.json');
  const spec = JSON.parse(fs.readFileSync(FIX, 'utf8')).spec;
  const def = buildGen(genMigrateSpec(JSON.parse(JSON.stringify(spec))));
  const px = fly(null, 400, null, { def, wind: [0, 2] });
  for (const v of px.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
  console.log('   roll: pursuit ' + px.rollMaxE.toFixed(1) + ' deg, ' + px.rollDrFlips + ' rudder reversals, bank ' + px.rollMaxBank.toFixed(1) +
              ' deg on the ground, lift-off ' + (px.liftXT == null ? '—' : px.liftXT.toFixed(1)) + ' m off the centreline after ' +
              (px.liftRun == null ? '—' : px.liftRun.toFixed(0)) + ' m of a ' + def.params.ap.TORun + ' m sheet');
  checkTrikeXwind(px);
}

console.log('-- FLAPS + STATUS: the ultralight fixture from the stand --');
{
  const FIX = path.join(__dirname, 'fixtures', 'build_v7_ultralight_2026-09-05.json');
  const spec = JSON.parse(fs.readFileSync(FIX, 'utf8')).spec;
  const def = buildGen(genMigrateSpec(JSON.parse(JSON.stringify(spec))));
  const ul = fly(null, 400, null, { def, stand: true });
  for (const v of ul.report.verdicts) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
  console.log('   flap at the flare ' + (ul.flapAtFlare == null ? '—' : ul.flapAtFlare.toFixed(2)) + ' | roll status: ' +
              (ul.statusRoll ? ul.statusRoll.goal + ' [' + ul.statusRoll.afcs.lat + ' ' + ul.statusRoll.afcs.vert + ' ' + ul.statusRoll.afcs.thr + ']' : 'none'));
  checkFlapsStatus(ul, def.params.flaps.ldg);
}

console.log('-- BOX: the modes as a device, over the pilot and over a hand --');
{
  const bx = flyBox();
  for (const v of bx.verdicts || []) console.log('   ' + v.t + 's ' + v.code + ' — ' + v.note);
  console.log('   alt ' + bx.altErr.toFixed(1) + ' m, hdg ' + bx.hdgErr.toFixed(1) + ' deg, ias ' + bx.iasErr.toFixed(1) + ' m/s, vs ' + bx.vsErr.toFixed(2) + ' m/s | hand da ' + bx.handDa + ', alt ' + bx.altHold2.toFixed(1) + ' m | nav xtk ' + bx.xtk.toFixed(0) + ' m, ' + bx.disDrop.toFixed(0) + ' m nearer | ' + bx.outcome + ' at ' + bx.t.toFixed(0) + ' s');
  checkBox(bx);
}

if (fails.length) console.log('FAILED CHECKS: ' + fails.join(', '));
console.log('GATE PILOT: ' + (fails.length ? 'FAIL' : 'PASS'));
process.exit(fails.length ? 1 : 0);
