#!/usr/bin/env node
// GATE TAKEOFF (G193) — the user's ultralight leaves the stand, follows the
// declared pattern without cutting a corner, STOPS on the hold lined up, and
// runs straight to lift-off — in calm air and in wind.
//
//   node tools/_takeoff_check.js            -> "GATE TAKEOFF: PASS|FAIL"
//   node tools/_takeoff_check.js --show     -> the phase log per departure
//   node tools/_takeoff_check.js --selftest -> negative verification
//
// The fixture is the user's own build (tools/fixtures/build_v7_ultralight_
// 2026-09-05.json): a taildragger with two wing-mounted 582s whose thrust
// line sits above the CG, so its ground power is capped (genGroundPowerCap)
// and its tail lifts on power alone — the aeroplane whose log read four
// 'rejected-takeoff' in eight attempts ("as soon as the boom lifts off, the
// autopilot is incapable of maintaining direction"). Two mechanisms, both
// measured before this gate existed: LINEUP handed a moving, up-to-8-m-off
// aeroplane straight into ROLL, and the tailwheel's steering vanished the
// frame the tail unloaded while the rudder gains stayed tuned for it.
//
// WHAT IT ASSERTS, per departure (stand and spawn; calm, two crosswinds, a
// headwind, a quartering wind):
//   TAXI    cross-track under 2.5 m the whole way, never within 2 m of a fence
//           post, never on the strip's flanks outside its length
//   STOP    a real standstill (Vg < 0.3 m/s) before the roll begins
//   ROLL    begins inside 2.5 m and 6 deg; cross-track under 4 m (12 m in
//           wind) to lift-off
//   LIFTOFF inside 4 m (12 m in wind) of the centreline, heading within 6 deg,
//           no rejection
//   TIME    stand to roll under 150 s in calm air; airborne inside 300 s
//   CROSSWIND LIMIT (G193.2) — the plaque's own number, measured by
//           42_crosswind.js on the fixture: a number, the band is the strip's
//           edge lines, every passed rung at or under it and every failed rung
//           above it, and a 1 m band or a 4 m/s cap moves it as declared
//
// NEGATIVE-VERIFIED: --selftest doctors a departure record each way the
// gate can be wrong and requires the matching check to go red.
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./flight_core.js');

const SHOW = process.argv.includes('--show');
const SELF = process.argv.includes('--selftest');
const FIX = path.join(__dirname, 'fixtures', 'build_v7_ultralight_2026-09-05.json');

let fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};

function fixture() {
  const spec = JSON.parse(fs.readFileSync(FIX, 'utf8')).spec;
  return C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
}

// one departure: settle parked, stand or spawn, wind, then fly until safely
// airborne (or the bound); every frame the facts the checks need are sampled
function depart(def, opts) {
  const world = C.makeWorld();
  if (opts.wind && world.setWind) world.setWind({ base: [opts.wind[0], 0, opts.wind[1]], gust: 0 });
  const a = world.aerodromes[0], site = C.siteOf('HOME');
  const sim = C.makeSim(def, world);
  sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  if (opts.stand) { if (sim.stance) sim.stance(); C.placeAtStand(sim, a, site.stand); }
  else C.placeAtAerodrome(sim, a);
  const ap = C.makeTestPilot(sim, def, world);
  ap.setRoute(a, a);
  ap.departFrom(a, a, site);
  const posts = [];
  for (const [x0, x1] of site.fence.runs)
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + 1e-6; x += site.fence.step) posts.push([x, site.fence.z]);
  const R = C.siteRunway(a);
  const rec = { phases: [], maxXT: 0, minPost: 1e9, offStrip: 0, stopped: false, minVgHold: 1e9,
                roll: null, maxSCrRoll: 0, lift: null, outcome: null, tRoll: null, tailUp: null,
                rejected: false, t: 0 };
  let last = null;
  const T = opts.maxS || 300;
  for (let s = 0; s < T * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    const t = s / 60, d = ap.dbg || {}, cg = sim.cgPos();
    const Vg = Math.hypot(...sim.cgVel());
    if (ap.phase !== last) { rec.phases.push({ t: +t.toFixed(1), phase: ap.phase }); last = ap.phase; }
    if (ap.phase === 'TAXI') {
      rec.maxXT = Math.max(rec.maxXT, Math.abs(d.xt || 0));
      for (const p of posts) rec.minPost = Math.min(rec.minPost, Math.hypot(cg[0] - p[0], cg[2] - p[1]));
      // on the strip's flanks: inside the strip's half-width, outside its length
      const along = (cg[0] - R.end0.x) * R.dx + (cg[2] - R.end0.z) * R.dz;
      const cross = Math.abs((cg[0] - R.cx) * R.nx + (cg[2] - R.cz) * R.nz);
      if (cross < R.half && (along < -2 || along > R.len + 2)) rec.offStrip++;
    }
    if (ap.phase === 'HOLD') { rec.minVgHold = Math.min(rec.minVgHold, Vg); if (Vg < 0.3) rec.stopped = true; }
    if (ap.phase === 'ROLL') {
      if (!rec.roll) { rec.roll = { t: +t.toFixed(1), sCr: d.z, e: d.e }; rec.tRoll = t; }
      rec.maxSCrRoll = Math.max(rec.maxSCrRoll, Math.abs(d.z || 0));
      if (d.tailUp && !rec.tailUp) rec.tailUp = { t: +t.toFixed(1), V: +(d.V || 0).toFixed(1) };
    }
    if (ap.report && ap.report.verdicts && ap.report.verdicts.some(v => v.code === 'rejected-takeoff')) rec.rejected = true;
    if ((ap.phase === 'LIFTOFF' || ap.phase === 'CLIMB') && (d.agl || 0) > (def.params.ap.hSafe || 8)) {
      rec.lift = { t: +t.toFixed(1), sCr: +(d.z || 0).toFixed(2), e: +(d.e || 0).toFixed(3), V: +(d.V || 0).toFixed(1) };
      rec.t = t; break;
    }
    if (ap.phase === 'STOPPED') { rec.t = t; break; }
    rec.t = t;
  }
  rec.outcome = ap.report && ap.report.outcome;
  return rec;
}

function judge(name, r, opts) {
  const tag = name + ': ';
  if (opts.stand) {
    check(r.phases.some(p => p.phase === 'TAXI'), tag + 'taxied off the stand');
    check(r.maxXT < 2.5, tag + 'taxi cross-track under 2.5 m', r.maxXT.toFixed(2) + ' m');
    check(r.minPost > 2.0, tag + 'never within 2 m of a fence post', r.minPost.toFixed(1) + ' m');
    check(r.offStrip === 0, tag + 'never on the strip’s flanks outside its length', r.offStrip + ' frames');
  }
  check(r.phases.some(p => p.phase === 'HOLD') && r.stopped,
        tag + 'a real stop before the roll (Vg < 0.3 in HOLD)', 'min Vg ' + (r.minVgHold === 1e9 ? '—' : r.minVgHold.toFixed(2)));
  check(!!r.roll && Math.abs(r.roll.sCr) < 2.5 && Math.abs(r.roll.e) < 0.105,
        tag + 'the roll begins lined up (< 2.5 m, < 6 deg)',
        r.roll ? r.roll.sCr.toFixed(2) + ' m, ' + (r.roll.e * 57.3).toFixed(1) + ' deg' : 'no roll');
  // a direct crosswind is allowed a wider excursion than calm air: the tail
  // is up for the last two seconds of the roll and the tyres carry little.
  // THE WIND BOUND IS THE FIXTURE'S OWN PHYSICS, RE-FROZEN (user ruling,
  // 2026-09-05, HANDOVER G193.1). At 2 m/s across the roll held 6.5 m with
  // the engines' mass at the nacelle flange; G198 hung each 582 at its true
  // centre of mass, 17 cm aft, the fixture's CG moved 3.4 cm aft (0.94 m
  // behind the mains, 0.90 before) and the same roll measures 10.1 m
  // (10.1-10.5 over the three crosswind departures), nose peak 23 deg
  // instead of 18. No pilot gain restores 8 m: the rudder sits at its 0.95
  // stop for a full second through the swing in both mass states, and the
  // tail is lifted by the aeroplane at 14 m/s (the nacelles' thrust line
  // ~0.9 m above the CG), not by the pilot — kP factor 1.4 / 2.0 / 2.6 gave
  // 10.11 / 9.72 / 9.59 m, kD 4.5 gave 10.23 m, a 2.5x pitch gain held 7.7 m
  // and then drifted 15 m at lift-off. 12 m is that swing plus the margin
  // 8 m carried over 6.5; the excursion is the design's crosswind limit, not
  // a pilot defect, and belongs to the builder (mains, fin, thrust line).
  // Calm air keeps 4 m. (Before the roll rotated at Vr at all it was 36 m.)
  const lim = opts.wind ? 12.0 : 4.0;
  check(r.maxSCrRoll < lim, tag + 'cross-track under ' + lim + ' m through the roll', r.maxSCrRoll.toFixed(2) + ' m');
  check(!!r.lift && Math.abs(r.lift.sCr) < lim && Math.abs(r.lift.e) < 0.105,
        tag + 'lifts off inside ' + lim + ' m and 6 deg', r.lift ? r.lift.sCr + ' m, ' + (r.lift.e * 57.3).toFixed(1) + ' deg' : 'never airborne');
  check(!r.rejected, tag + 'no rejected take-off');
  if (opts.stand && !opts.wind) check(r.tRoll != null && r.tRoll < 150, tag + 'stand to roll inside 150 s', (r.tRoll || 0).toFixed(0) + ' s');
  check(r.t < (opts.maxS || 300), tag + 'airborne inside the bound', r.t.toFixed(0) + ' s');
}

const CASES = [
  ['stand · calm', { stand: true }],
  ['stand · 2 m/s cross (+z)', { stand: true, wind: [0, 2] }],
  ['stand · 2 m/s cross (-z)', { stand: true, wind: [0, -2] }],
  ['stand · 3 m/s headwind', { stand: true, wind: [3, 0] }],
  ['stand · 3 m/s quartering', { stand: true, wind: [2.1, 2.1] }],
  ['spawn · calm', { stand: false }],
  ['spawn · 2 m/s cross', { stand: false, wind: [0, 2] }],
];

if (!SELF) {
  const def = fixture();
  for (const [name, opts] of CASES) {
    const r = depart(def, opts);
    judge(name, r, opts);
    if (SHOW) console.log('  ' + name + ': ' + r.phases.map(p => p.phase + '@' + p.t).join(' ') +
      ' | xt ' + r.maxXT.toFixed(2) + ' post ' + r.minPost.toFixed(1) +
      ' | roll ' + (r.roll ? r.roll.sCr.toFixed(2) + 'm ' + (r.roll.e * 57.3).toFixed(1) + 'deg' : '-') +
      ' | lift ' + (r.lift ? r.lift.sCr + 'm ' + (r.lift.e * 57.3).toFixed(1) + 'deg V' + r.lift.V + ' @' + r.lift.t : 'none') +
      ' | tailUp ' + (r.tailUp ? r.tailUp.t + 's V' + r.tailUp.V : 'never') + ' | ' + r.outcome);
  }
  // THE FOLLOWER'S SOURCE lives in ONE module and both pilots carry the same
  // phases: a fix that lands in one pilot and not the other is the fork's
  // known failure, and this is the cheap insurance against it
  const s40 = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', '40_autopilot.js'), 'utf8');
  const s41 = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', '41_test_pilot.js'), 'utf8');
  for (const s of [s40, s41]) {
    check(/case 'STOP':/.test(s) && /case 'HOLD':/.test(s), 'both pilots carry STOP and HOLD');
    check(/pathLocate\(ap\.path/.test(s) && /pathSpeed\(ap\.path/.test(s), 'both pilots follow the path');
    check(/const tailUp = rotateTD/.test(s), 'both pilots schedule the ground steer on the tail state');
  }
  // ---- THE CROSSWIND LIMIT on the plaque (G193.2) -----------------------------
  {
    const R = C.siteRunway(C.makeWorld().aerodromes[0]);
    const t0 = Date.now();
    const xw = C.genCrosswindLimit(def);
    const wall = (Date.now() - t0) / 1000;
    const tag = 'crosswind limit: ';
    check(xw && typeof xw.limit === 'number' && xw.limit >= 1 && xw.limit <= 10,
          tag + 'a measured number between 1 and 10 m/s', xw ? String(xw.limit) : 'none');
    check(Math.abs(xw.band - (R.half - 2.5)) < 1e-6,
          tag + 'the band is the strip\'s own edge lines (half - 2.5 m)', xw.band + ' m');
    check(xw.runs.every(r => r.ok ? r.w <= xw.limit + 1e-9 : r.w > xw.limit - 1e-9),
          tag + 'every passed rung at or under the limit, every failed rung above it',
          xw.runs.map(r => r.w + (r.ok ? ' ok' : ' x')).join(', '));
    check(xw.runs.every(r => r.ok === (r.roll <= xw.band)),
          tag + 'a pass is exactly a roll inside the band (the heading is reported, not judged)');
    check(typeof xw.e === 'number' && xw.e >= 0, tag + 'the lift-off heading rides beside the limit', (xw.e * 57.3).toFixed(1) + ' deg');
    check(xw.roll != null && xw.roll <= xw.band, tag + 'the roll at the limit is inside the band', xw.roll + ' m');
    check(xw.failWhy === 'off the edge line' || xw.failWhy == null,
          tag + 'past the limit it is the edge line that goes, not a rejection', String(xw.failWhy));
    check(wall < 60, tag + 'measured inside a minute of wall clock', wall.toFixed(1) + ' s');
    // declared knobs move it as declared: a 1 m band cannot be held even in
    // calm air; a 4 m/s cap with a 100 m band reports "> cap"
    const tight = C.genCrosswindLimit(def, { band: 1 });
    check(tight.limit != null && tight.limit < 1, tag + 'a 1 m band reads under 1 m/s', String(tight.limit));
    const loose = C.genCrosswindLimit(def, { band: 100, cap: 4 });
    check(loose.limit == null && loose.cap === 4, tag + 'a 100 m band with a 4 m/s cap reads "> 4"', String(loose.limit));
    console.log('  crosswind limit ' + xw.limit + ' m/s (band ' + xw.band + ' m, roll ' + xw.roll +
                ' m at the limit; first failure ' + xw.failW + ' m/s, ' + xw.failRoll + ' m) in ' + wall.toFixed(1) + ' s');
  }
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE TAKEOFF: ' + (fail.length ? 'FAIL' : 'PASS'));
  process.exit(fail.length ? 1 : 0);
}

// ---- negative verification: a doctored record each way ---------------------
{
  const good = { phases: [{ t: 0, phase: 'DEPART' }, { t: 0.1, phase: 'TAXI' }, { t: 40, phase: 'STOP' }, { t: 44, phase: 'HOLD' }, { t: 46, phase: 'ROLL' }, { t: 60, phase: 'LIFTOFF' }],
                 maxXT: 0.8, minPost: 5, offStrip: 0, stopped: true, minVgHold: 0.1,
                 roll: { t: 46, sCr: 0.5, e: 0.02 }, maxSCrRoll: 1.2, lift: { t: 62, sCr: 1.0, e: 0.03, V: 16 },
                 outcome: null, tRoll: 46, tailUp: null, rejected: false, t: 62 };
  const BREAKS = [
    ['an 8 m taxi cross-track', r => { r.maxXT = 8; }],
    ['a fence post brushed', r => { r.minPost = 0.5; }],
    ['no stop before the roll', r => { r.stopped = false; }],
    ['a roll begun 5 m off', r => { r.roll.sCr = 5; }],
    ['a roll that wandered', r => { r.maxSCrRoll = 9; }],
    ['a lift-off 6 m off', r => { r.lift.sCr = 6; }],
    ['a rejected take-off', r => { r.rejected = true; }],
    ['never airborne', r => { r.lift = null; }],
    ['a 200 s crawl to the roll', r => { r.tRoll = 200; }],
  ];
  let bad = 0;
  for (const [what, doctor] of BREAKS) {
    fail = [];
    const r = JSON.parse(JSON.stringify(good)); doctor(r);
    judge('doctored', r, { stand: true });
    const caught = fail.length > 0;
    console.log((caught ? '  caught  ' : '  MISSED  ') + what);
    if (!caught) bad++;
  }
  fail = [];
  judge('sound', JSON.parse(JSON.stringify(good)), { stand: true });
  if (fail.length) { console.log('  the sound record FAILS: ' + fail.join('; ')); bad++; }
  console.log('GATE TAKEOFF selftest: ' + (bad ? 'FAIL' : 'PASS'));
  process.exit(bad ? 1 : 0);
}
