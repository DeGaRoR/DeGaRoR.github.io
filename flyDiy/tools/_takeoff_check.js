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
  // G199.5 set `spec.fuselage.boom = 'rod'` here by hand: the file predates
  // the field and the game flies it with the row set. TAIL CHANTIER 2 P6
  // put that where it belongs — GEN_MIGRATORS[7] reads the cage's own
  // `boomStyle` into `fuselage.boom` for EVERY pre-G199.5 save, not just
  // this gate's copy of one — so the hand-patch is gone and this gate now
  // proves the migration as well as the aeroplane.
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
  const ap = C.makePilot(sim, def, world);
  ap.setRoute(a, a);
  ap.departFrom(a, a, site);
  const posts = [];
  for (const [x0, x1] of site.fence.runs)
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + 1e-6; x += site.fence.step) posts.push([x, site.fence.z]);
  const R = C.siteRunway(a);
  // G199.5: THE STAB'S ROLL AGAINST THE MAINS' AXLE LINE, in the aeroplane's
  // own frame — the boom's twist under the tailwheel's steering loads (the
  // user: "the stabs are moving with the tail wheel ... even when simply
  // taxiing"). This fixture at full rudder on the lofted default lattice:
  // 3.1 deg; with rodBoomK 4: 1.3; with the pawnee rows (G199.3): 80. The
  // bound below was a regression guard on today's number, not a target.
  // TAIL CHANTIER 2 P6 (2026-09-08) MADE IT A TARGET, and it is met: the
  // compensator is DERIVED from the drawn tube now (GEN_RULES.rodBoomK
  // 'computed' = GJ_tube / GJ_lattice, 1.56 on this fixture) instead of
  // landing off, and the tail — which since P4 has a truss of its own to
  // flex, so this number is boom AND tail — rolls 1.84 deg where it read
  // 3.82 with the switch off. The bound is 2.5 deg: under the 3.09 the
  // user complained about, with room for the fleet's spread, and it will
  // catch the boom quietly going soft again.
  const iH = def.nodes.findIndex(n => n.tag === 'HTL'), iH2 = def.nodes.findIndex(n => n.tag === 'HTR');
  const [iL, iR] = def.refs.mains;
  const stabRoll = () => {
    if (iH < 0 || iH2 < 0) return 0;
    const [, yU, zR] = sim.axes(), p = sim.p;
    const ang = (i, j) => Math.atan2(
      (p[j*3]-p[i*3])*yU[0] + (p[j*3+1]-p[i*3+1])*yU[1] + (p[j*3+2]-p[i*3+2])*yU[2],
      (p[j*3]-p[i*3])*zR[0] + (p[j*3+1]-p[i*3+1])*zR[1] + (p[j*3+2]-p[i*3+2])*zR[2]) * 180 / Math.PI;
    let d = ang(iH, iH2) - ang(iL, iR); d = ((d + 540) % 360) - 180; return d;
  };
  const rec = { phases: [], maxXT: 0, minPost: 1e9, offStrip: 0, stopped: false, minVgHold: 1e9,
                roll: null, maxSCrRoll: 0, maxStabRoll: 0, lift: null, outcome: null, tRoll: null, tailUp: null,
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
      rec.maxStabRoll = Math.max(rec.maxStabRoll, Math.abs(stabRoll()));
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
    check(r.maxStabRoll < 2.5, tag + 'the stab rolls under 2.5 deg against the mains through the taxi (G199.5, P6)',
          r.maxStabRoll.toFixed(2) + ' deg');
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

// G1937 (PILOT-ONE): THE TAKE-OFF TECHNIQUE, per build. The user (5 Oct): the take-off "pulls on the stick much too
// fast, and hops before taking off, rather than building speed and taking off clean" - then, the same day, "the
// remark only applies to floatplanes and water take off. The normal take off is OK". Every build is held to the
// same technique: EXACTLY ONE lift-off (a hop / a skip is a second one), no contact after it, no lift-off before
// Vr (0.95 of the build's Vs at least), the lift-off at 1.0-1.35 Vs on wheels (1.0-1.6 on the water: the hull
// lets go late), the rotation at a bounded pitch rate, and the run against a reference where one exists.
// THE REFERENCES (POH-style; RECALLED from the published handbooks, not re-read here - check before quoting):
//   C172 (C172S POH, 2550 lb, sea level, ISA, paved): Vr 55 KIAS (28.3 m/s); ground roll 960 ft (293 m),
//        to 50 ft 1685 ft (514 m). The user's C172 is 1135 kg (2500 lb) on grass.
//   J-3 Cub (65 hp, the owner's handbook): lift-off ~35-40 mph (16-18 m/s); ground run ~370 ft (113 m).
//   Jodel D11-class (INFERRED from the class, no handbook): lift-off ~80-85 km/h (22-24 m/s), ground roll ~200 m.
//   C172 on Wipline floats (INFERRED from the floatplane supplements' ~1200-1500 ft water runs): ~370-460 m.
//   The ultralight and the twin on floats are the user's own designs: no reference, the technique checks only.
// The band on a reference is [0.6, 1.4] x: the sim's grass, the build as corrected, the recalled numbers.
const TECH_REF = {
  cub:   { run: 113, src: 'J-3 Cub handbook (recalled)' },
  c172:  { run: 293, d15: 514, src: 'C172S POH (recalled)' },
  jodel: { run: 200, src: 'Jodel D11 class (INFERRED)' },
  wip:   { run: 410, src: 'C172 floatplane supplements (INFERRED)' },
};
const TECH_BUILDS = ['cub', 'jodel', 'c172', 'wip', 'ultraf', 'twinf', 'c172f'];
function techFlights() {
  const PT = require('./pilot_one_trace.js');
  return TECH_BUILDS.map(b => PT.trace(b));
}
function judgeTech(R) {
  const f = (v, n = 1) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : '-';
  const tag = 'technique ' + R.name + ': ';
  console.log('  ' + R.name.padEnd(7) + (R.float ? 'water ' : 'wheels') + ' Vs ' + f(R.Vs) + ' Vr ' + f(R.Vr) + ' Vlof ' + f(R.Vlof) +
              ' (' + f(R.Vlof / R.Vs, 2) + ' Vs)  lifts ' + R.lifts + ' (first at ' + f(R.hopV) + ')  touch-after ' + R.touchAfter +
              '  qMax ' + f(R.qMax) + ' deg/s  run ' + f(R.dist, 0) + ' m  to 15 m ' + f(R.d15, 0) + ' m' + (R.out ? '  ' + R.out + ' ' + R.verdicts : ''));
  if (R.name === 'c172f') {
    // the user's C172 with floats for wheels: 1135 kg on 2198 N static (T/W 0.20) cannot climb over the hump; the
    // pilot must SAY so (G1937), not plough the lane for minutes
    check(R.out === 'ABORT' && /rejected-takeoff/.test(R.verdicts), tag + 'stuck on the hump: rejected, said', R.out + ' ' + R.verdicts);
    return;
  }
  check(R.Vlof != null, tag + 'airborne', R.out || 'never');
  if (R.Vlof == null) return;
  check(R.lifts === 1, tag + 'exactly one lift-off (no hop, no skip)', R.lifts + ' (the first at ' + f(R.hopV) + ' m/s)');
  check(R.touchAfter === 0, tag + 'no contact after the lift-off', String(R.touchAfter));
  check(R.hopV >= 0.95 * R.Vs, tag + 'no lift-off before Vr (0.95 Vs)', f(R.hopV) + ' of ' + f(0.95 * R.Vs));
  const hi = R.float ? 1.6 : 1.35;
  check(R.Vlof / R.Vs >= 1.0 && R.Vlof / R.Vs <= hi, tag + 'the lift-off at 1.0-' + hi + ' Vs', f(R.Vlof / R.Vs, 2));
  check(Math.abs(R.qMax) <= 12, tag + 'the pitch rate bounded (12 deg/s) from the roll to 2 hSafe', f(R.qMax));
  const ref = TECH_REF[R.name];
  if (ref && ref.run) check(R.dist >= 0.6 * ref.run && R.dist <= 1.4 * ref.run, tag + 'the run ' + f(R.dist, 0) + ' m in [0.6, 1.4] x ' + ref.run + ' m (' + ref.src + ')');
  if (ref && ref.d15) check(R.d15 >= 0.6 * ref.d15 && R.d15 <= 1.4 * ref.d15, tag + 'to 15 m ' + f(R.d15, 0) + ' m in [0.6, 1.4] x ' + ref.d15 + ' m (' + ref.src + ')');
}
// G1938: THE TURN-AROUND - on the strip's own surface the whole way (a site may lay its lane beside the strip on the
// same surface), within the ends, turned on the spot (said 'pivot'), the roll begun inside 60 s and airborne
function judgeTurn(T) {
  const tag = 'turn-around (cub, East Point): ';
  console.log('  roll at ' + (T.tRoll != null ? T.tRoll.toFixed(1) : 'never') + ' s; max |cross| ' + T.maxX.toFixed(1) + ' m, past an end ' +
              T.beyond.toFixed(1) + ' m, off the surface ' + T.offSurf.toFixed(1) + ' s; ' + T.end + (T.lift ? ' (airborne)' : '') + '; ' + T.verdicts);
  check(T.offSurf === 0 && T.beyond <= 0, tag + 'never off the strip', T.offSurf.toFixed(1) + ' s, ' + T.beyond.toFixed(1) + ' m past an end');
  check(/pivot/.test(T.verdicts), tag + 'turned on the spot (the pivot)', T.verdicts);
  check(T.tRoll != null && T.tRoll < 60, tag + 'the roll begun inside 60 s', T.tRoll != null ? T.tRoll.toFixed(1) + ' s' : 'never');
  check(T.lift, tag + 'airborne off the strip', T.end);
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
  // G1940 (PILOT-ONE): THE FORK IS GONE - the classic (40) and the test pilot (41) retired; the insurance is now
  // that ONE pilot exists: no other core file defines a pilot factory (a fork that comes back fails here)
  const s43 = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', '43_pilot.js'), 'utf8');
  {
    const dir = path.join(__dirname, '..', 'src', 'core');
    const forks = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== '43_pilot.js')
      .filter(f => /function\s+make(Auto|Test)?[Pp]ilot\s*\(/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    check(!forks.length, 'one pilot: no core file but 43_pilot.js defines a pilot factory', forks.join(', '));
  }
  // G1570: the servos are ONE module now (39b_servos.js): the tail-state
  // schedule is written once there, and every pilot must fly that module's
  // ground steer rather than a copy of it
  const sSV = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', '39b_servos.js'), 'utf8');
  check(/tailUp = rotateTD/.test(sSV), 'the servo module schedules the ground steer on the tail state');
  for (const s of [s43]) {
    check(/case 'STOP':/.test(s) && /case 'HOLD':/.test(s), 'both pilots carry STOP and HOLD');
    check(/pathLocate\(ap\.path/.test(s) && /pathSpeed\(ap\.path/.test(s), 'both pilots follow the path');
    check(/makeServos\(sim, def/.test(s) && /SV\.groundSteer\(thRest/.test(s) && !/const tailUp = rotateTD/.test(s),
          'every pilot flies the servo module\'s ground steer, and none carries its own copy');
  }
  // ---- THE CROSSWIND LIMIT on the plaque (G193.2) -----------------------------
  {
    const xwWorld = C.makeWorld(), memo = new Map();   // one world, and the rungs shared by the three ladders
    const R = C.siteRunway(xwWorld.aerodromes[0]);
    // THE COST IS CPU TIME, NOT WALL CLOCK: the minute bounds the WORK (the
    // page runs the same probe after the circuit lands), and wall clock also
    // measured the machine - 67 s with four gates on four cores, 47 s alone,
    // the same work. The probe is synchronous, so this process's own CPU time
    // is its cost whatever else runs; the wall is still printed beside it
    const t0 = Date.now(), c0 = process.cpuUsage();
    const xw = C.genCrosswindLimit(def, { world: xwWorld, memo });
    const wall = (Date.now() - t0) / 1000;
    const cu = process.cpuUsage(c0), cpu = (cu.user + cu.system) / 1e6;
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
    check(cpu < 60, tag + 'measured inside a minute of CPU time', cpu.toFixed(1) + ' s CPU, ' + wall.toFixed(1) + ' s wall');
    // declared knobs move it as declared: a 1 m band cannot be held even in
    // calm air; a 4 m/s cap with a 100 m band reports "> cap"
    // A TIGHTER BAND READS A SMALLER LIMIT — the knob, not a magic number
    // (2026-09-08). This asked for "a 1 m band reads under 1 m/s", which was
    // true while the pilot took a crosswind roll with its wings level: it
    // wandered a metre in almost any wind. With into-wind aileron
    // (43_pilot.js groundSteer, TAIL CHANTIER 2 P5's own consequence) the
    // roll holds 2.6 m at 2 m/s across where it held 18, so a 1 m band is
    // now holdable at 1 m/s — the aeroplane got better and the row was
    // reading the old pilot. What it means to test is that the declared
    // band moves the answer, and it still does.
    const tight = C.genCrosswindLimit(def, { band: 1, world: xwWorld, memo });
    check(tight.limit != null && tight.limit < xw.limit,
          tag + 'a 1 m band reads a lower limit than the strip\'s own',
          tight.limit + ' < ' + xw.limit);
    const loose = C.genCrosswindLimit(def, { band: 100, cap: 4, world: xwWorld, memo });
    check(loose.limit == null && loose.cap === 4, tag + 'a 100 m band with a 4 m/s cap reads "> 4"', String(loose.limit));
    console.log('  crosswind limit ' + xw.limit + ' m/s (band ' + xw.band + ' m, roll ' + xw.roll +
                ' m at the limit; first failure ' + xw.failW + ' m/s, ' + xw.failRoll + ' m) in ' + cpu.toFixed(1) + ' s CPU, ' + wall.toFixed(1) + ' s wall');
  }
  // ---- THE TECHNIQUE, PER BUILD (G1937, PILOT-ONE) -------------------------------
  console.log('THE TECHNIQUE (pilot_one_trace: Vr, Vlof, the lift-offs, the pitch rate, the run)');
  for (const r of techFlights()) judgeTech(r);
  // ---- THE TURN-AROUND AT THE END OF A ONE-WAY STRIP (G1938) ----------------------
  console.log('THE TURN-AROUND (pilot_one_turnaround: the Cub at East Point, 150 x 12 m, stopped 20 m from the closed end)');
  judgeTurn(require('./pilot_one_turnaround.js').turnaround('cub'));
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE TAKEOFF: ' + (fail.length ? 'FAIL' : 'PASS'));
  process.exit(fail.length ? 1 : 0);
}

// ---- negative verification: a doctored record each way ---------------------
{
  const good = { phases: [{ t: 0, phase: 'DEPART' }, { t: 0.1, phase: 'TAXI' }, { t: 40, phase: 'STOP' }, { t: 44, phase: 'HOLD' }, { t: 46, phase: 'ROLL' }, { t: 60, phase: 'LIFTOFF' }],
                 maxXT: 0.8, minPost: 5, offStrip: 0, stopped: true, minVgHold: 0.1, maxStabRoll: 0.8,
                 roll: { t: 46, sCr: 0.5, e: 0.02 }, maxSCrRoll: 1.2, lift: { t: 62, sCr: 1.0, e: 0.03, V: 16 },
                 outcome: null, tRoll: 46, tailUp: null, rejected: false, t: 62 };
  const BREAKS = [
    ['an 8 m taxi cross-track', r => { r.maxXT = 8; }],
    ['a fence post brushed', r => { r.minPost = 0.5; }],
    ['no stop before the roll', r => { r.stopped = false; }],
    ['a roll begun 5 m off', r => { r.roll.sCr = 5; }],
    ['a roll that wandered', r => { r.maxSCrRoll = 9; }],
    ['a stab rolling 5 deg with the tailwheel', r => { r.maxStabRoll = 5; }],
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
  // G1937: the technique judge, doctored each way it can be wrong
  const goodT = { name: 'cub', float: false, Vs: 16, Vr: 16.2, Vlof: 17.2, lifts: 1, hopV: 17.2, touchAfter: 0, qMax: 6, dist: 106, d15: 216, out: null, verdicts: '' };
  const BREAKS_T = [
    ['a hop (two lift-offs)', r => { r.lifts = 2; }],
    ['a touch after the lift-off', r => { r.touchAfter = 1; }],
    ['a lift-off before Vr', r => { r.hopV = 12; }],
    ['a lift-off at 1.6 Vs on wheels', r => { r.Vlof = 25.6; }],
    ['a 30 deg/s rotation', r => { r.qMax = 30; }],
    ['a 300 m run for a Cub', r => { r.dist = 300; }],
    ['never airborne', r => { r.Vlof = null; }],
  ];
  for (const [what, doctor] of BREAKS_T) {
    fail = [];
    const r = JSON.parse(JSON.stringify(goodT)); doctor(r);
    judgeTech(r);
    const caught = fail.length > 0;
    console.log((caught ? '  caught  ' : '  MISSED  ') + what);
    if (!caught) bad++;
  }
  fail = []; judgeTech(JSON.parse(JSON.stringify(goodT)));
  if (fail.length) { console.log('  the sound technique record FAILS: ' + fail.join('; ')); bad++; }
  const goodTA = { tRoll: 21.5, maxX: 2.7, beyond: -18.7, offSurf: 0, end: 'LIFTOFF', lift: true, verdicts: 'pivot,committed-takeoff' };
  for (const [what, doctor] of [['a turn off the strip', r => { r.offSurf = 3; }], ['no pivot', r => { r.verdicts = 'committed-takeoff'; }],
                                ['a 120 s turn-around', r => { r.tRoll = 120; }], ['never airborne after it', r => { r.lift = false; }]]) {
    fail = [];
    const r = JSON.parse(JSON.stringify(goodTA)); doctor(r);
    judgeTurn(r);
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
