#!/usr/bin/env node
// dc3_build.js - DC3-BUILD (G3501-G3509, cloud, 2026-10-23): THE FULL-SIZE DC-3, THROUGH THE GARAGE'S OWN PATH. A TOOL, not
// a gate. The user (23 Oct): "On the DC3, we'll go full size ... Don't consider anything game-related on the DC3 yet."
//
// The aeroplane is born as the game births one (DC3-STUDY's recipe, tools/dc3_probe.js dc3Raw): the user's metal Cessna's
// file as the base (so every row the editor owns is present), the DC-3's rows written into its cage at planeScale 1.6
// (full size), the Cub's tailwheel, then THE PAGE'S OWN LOAD DOOR (tools/_load_build.js: the editor's layers draw it
// headless, the join measures it, the energy layer fits the tanks) -> buildGen. Nothing is patched in memory: what flies
// is what the widened envelope (G3503) and the structure rules (G3501, G3504, G3505) make of the drawing.
//
//   node tools/dc3_build.js --build      (re)write tools/fixtures/dc3_2026-10.json through the load chain
//   node tools/dc3_build.js              the fixture's sheet, design check, cost, and the pilot's flight (take-off,
//                                        circuit, landing) against the real DC-3 [--no-fly] [--no-cert] [--maxS=600]
//                                        [--json=<file>]
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const LB = require('./_load_build.js');
const PR = require('./dc3_probe.js');
const FIX = path.join(T, 'fixtures', 'dc3_2026-10.json');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const flag = k => argv.includes('--' + k);

// ---- THE DRAWING: the study's full-size rows (dc3Raw(1.0)) and what the widened envelope lets the editor draw -------
// Every number below is a cage row (cage units x planeScale 1.6 = metres) or a gear row (metres, unscaled), as a player
// would dial it. The join then measures: span 29.0, root chord 4.40, taper 0.45 (Sw ~92 m2), the leading edge 5.1 m aft
// of the windscreen base, the tail post ~17.8 m, the cabin box 2.4 x 2.6 x 9.0 m, the DC-3's 8.1 m stab and 3 m fin,
// the 5.64 m track on 0.57 m tyres, two R-1830s 3.05 m off the centreline.
const DC3_ROWS = {
  // the fuselage: cockpit 2.4 m, three cabin bays 9.0 m, a 3.5 m cone; a 2.5 m wide, 2.6 m deep section
  // (G3577, the user 26 Oct: "the cabin shouldn't be longer than the space where pilots sit ... the rest is passengers and
  //  freight"): the cockpit 1.76 m (the pilots' own), four bays of 2.26 m in its place - the same 10.8 m, the first bay the
  //  navigator's / the forward hold's
  // (G3578, the user 27 Oct: "a short cabin, the length of the pilot bays ... as many passengers sections as they were seat
  //  rows"): the cockpit the pilots' bay alone (1.60 m), EIGHT bays of 0.96 m - one row of 2 + 1 each (the DC-3's 36 in
  //  pitch), the first the forward hold, 21 seated behind it (the DC-3's 21) - and the cone 0.72 m longer: the same 19.2 m
  pilotLen: 1.0, paxCount: 8, paxLen: 0.6, boomLen: 2.65, paxAbreast: 4,
  halfW: 0.78, roofHalfW: 0.68, roofY: 0.85, keelY: -0.8,
  // the wing: 29 m, 4.4 m root, 1.98 m tip (taper 0.45, the envelope's floor and the DC-3's own), 4.6 m aft of the
  // cockpit ring (the fore / aft row, negative is aft): a scan's pick, static margin 0.09 and no design-check row
  wgSpan: 29, wgChord: 4.4, wgChordTip: 1.98, wgDx: -4.6,
  // the nacelles 3.05 m out: the prop tips clear the cabin by 0.15 m
  engNacAt: 0.21,
  // the mains under the nacelles: 5.64 m track, 1.14 m tyres, a 1.2 m oleo; the fitting 0.2 m aft of the datum puts
  // the axle 5.5 m aft of the windscreen base - an 11.6 deg deck on three points (the DC-3's ~11.5) and the CG 34 deg
  // behind the axle
  s1X: 2.82, s1R: 0.57, s1Drop: 1.2, s1Z: -0.2,
  // the DC-3's tail: stab 8.2 x 2.25 m, fin chord 2.9 m (x the drawn, the stab and fin layers' size rows)
  stSpan: 1.41, stChord: 1.02, finChord: 1.34,
  // the DC-3's split flaps (G3506's row, the flap table's fifth: 'split')
  wgFlapType: 4,
  // G3570 (DC3-2): the cabin floor 0.40 m over the sill the door gives - the real cabin's 1.98 m (6 ft 6 in) of
  // headroom under this section's roof; the doors, the seats and the people stand on it (the user: "pilots and
  // passengers are buried")
  floorUp: 0.40,
  // G3575 (DC3-2): the full-swivel tailwheel (the gear page's third steering type) - the real DC-3's unlocks for the
  // taxi and swivels free; the toe brake pivots the aeroplane round it
  s2Steer: 2,
  // G3577 (DC3-2, the user 26 Oct): THE PILOTS AT THEIR CONTROLS - the seat backs 3.75 m along (the yokes 0.70 m ahead, the
  // hands 0.2 m off them, the feet on the pedals); the yokes off the panel 0.42 m, the throttles 0.40 m aft
  seatZ: 1.32, yokeGap: 0.42, thrZ: -0.4,
  // THE AERO NOSE collapsed - the aerodynamic front, its tip collapse at 0.9 (the DC-3's blunt round nose), on three loops
  // (G3578, the user's: the round worked in three rings, not one)
  noseFinish: 1, noseTip: 0.9, cowlLoops: 3,
  // THE NACELLES FAIRED - the cowl's 'nacelle tail cone' termination behind each engine, 2.4 m
  cw_aftMode: 1, cw_tailLen: 2.4,
  // THE TAILWHEEL at its size (0.40 m: the DC-3's 16 in tyre), the swivel's drop and the spring's taken down by the wheel's
  // growth (the deck stays 11.4 deg), its trail to the wheel
  s2R: 0.2, s2_twLegDrop: 0.03, s2_twSpringDrop: -0.025, s2_twTrail: 0.14,
  // THE LINE: the passenger frame (the last bay's aft ring) on the DC-3's upswept curve - the belly rising behind the wing,
  // the roof falling to the fin, the plan tapering - and the run to it curved (held at the cabin, steepest at its end), the
  // boom frame on the same curve: the old straight tube to z -7 and its two-piece cone (a kink at the boom frame) gone
  frPaxTopY: 0.75, frPaxBotY: -0.64, frPaxWaistY: 0.13, frPaxWaistW: 0.63, frPaxTopW: 0.55, frPaxBotW: 0.53,
  frPaxProfile: 1, frPaxEase: 0, frPaxBias: -0.6,
  aftRoofY: 0.64, aftKeelY: -0.48, frBoomWaistY: 0.12, frBoomWaistW: 0.49, frBoomTopW: 0.42, frBoomBotW: 0.4,
};
// G3579 (DC3-2, 27-28 Oct): THE DC-3 v1 - FITTED TO THE USER'S REFERENCE MODEL (tools/ref_match/refs/dc3.json: Sketchfab 'Dc3'
// by manilov.ap, CC-BY-4.0, scaled to the published 28.96 m span, length anchored at 19.66 m; tools/REF_MATCH.md's procedure)
// and steered by the user round by round. Laid over DC3_ROWS in every build (dc3FullRaw): the flown DC-3 is these rows. Flown
// (G3579 v1): the circuit and a first-time landing, the drops to 4.6 m/s and the HOME trip with 0 contacts and 0 breaks.
const DC3_FIT = {
  // STEP 1 (the side view's proportions and the wing) - the wing the DC-3's own planform: a constant-chord centre section
  // (4.63 m, flat) to the crank, the outer panel's LE swept to a straight TE, 1.40 m at the tip, 7.5 deg outboard (plan
  // 1 - IoU 0.065, LE / TE within 9 cm); the nose's windscreen run shortened and the body lengthened aft by as much (the tail
  // post 19.20 m aft of the nose, to 1 cm); the aft body lower and the tail ring smaller; THE USER'S STEERING (27 Oct): the
  // section ROUND top and bottom (topRound / botRound 1, roofY / keelY brought in around it), the width the reference's
  // (halfW 0.68, the frames' widths with it: 1.088 m, exact), five FRONT RINGS (cowlLoops 5: the nose bends), the main
  // wheels 1.25 m forward at the model's station (extended down and back as the user's drawing), the tailwheel 2.45 m
  // forward under the tailplane (16.96 m, the model's)
  wgChord: 4.63, wgCrankAt: 0.19, wgCrankChord: 4.63, wgCrankX: 0, wgChordTip: 1.4, wgTipX: 2.85, wgDihedral: 0,
  wgDihedralOut: 7.5, wgDx: -2.95, wgDy: -0.45, boomLen: 2.46, aftRoofY: 0.59, aftKeelY: -0.58, tailRoofY: 0.18,
  tailKeelY: -0.07, tailHalfW: 0.08, noseW: 0.75, wsRun: 0.45, topRound: 1, botRound: 1, cowlLoops: 5, roofY: 0.79,
  keelY: -0.72, halfW: 0.68, roofHalfW: 0.59, frPaxTopW: 0.48, frPaxWaistW: 0.55, frPaxBotW: 0.46, frBoomTopW: 0.37,
  frBoomWaistW: 0.43, frBoomBotW: 0.35, noseDroop: 0.1, s1Z: 1.05, s1Drop: 1.5, s2Z: 2.57, s2Drop: 0.8,
};
// the tail (the user: "for the stabs, try the chinook starting point and round only the elevator's ends. For the fin and
// rudder, start from the curved, cub-like one, and straighten only the rudder, not the fin leading edge"): the fin fitted
// from the Piper Cub preset with the rudder held straight (its TE rows 0, its corners crisp) and the LE round (fit_tail.js
// --hold; 1 - IoU 0.22, the top 3.546 m against 3.548), the dorsal on; the tailplane the Chinook's corners and edges with
// the elevator's two ends round, sized and placed by hand (LE / TE / span within 7 mm)
const DC3_FIT_TAIL = {
  finOn: 1, finProject: 1, finCut: 2, finVentralOn: 1, finVentralH: 0.4, finVentralC: 0.6, finCutGap: 0.01,
  finSolid: 1, finThick: 0.06, finThickTE: 0.015, finFillet: 0.035, finCons: 0, finDorsal: 0, finRootGuard: 1,
  finKeel: 1, finCrA: 0, finCrB: 0, finTipZ: -0.565, finTipY: -0.79, finAftZ: 0.275, finAftY: -0.9, finBaseZ: 0.24,
  finBaseY: 0.5, finMidY: -0.565, finUY: -0.015, finRootFwd: 0.25, finLEZ: 0.285, finLEY: -0.055, finShoulderZ: 0.37,
  finShoulderY: 0, finTopY: 0.085, finTERoot: 0, finTEU: 0, finTEMid: 0, finSharpTip: 1, finSharpAft: 3,
  finSharpBase: 3, finSharpShoulder: 0, finSharpLE: 0, finHeight: 1.64, finChord: 1.6, finChordTip: 1.5,
  finSweep: -9, finHinge: 0.085,
  stZ: 0.39, stY: 0.18, stTipZ: -0.2, stTipY: -0.3, stAftZ: 0, stAftY: -0.3, stBaseZ: 0, stBaseY: 0, stMidY: -0.2,
  stUY: 0, stRootFwd: 0, stLEZ: -0.1, stLEY: 0, stShoulderZ: 0.305521, stShoulderY: 0, stTopY: 0, stTERoot: 0,
  stTEU: 0, stTEMid: 0, stSharpAft: 0, stSharpBase: 0, stSharpTip: 3, stSharpShoulder: 3, stSharpLE: 3, stSpan: 1.36,
  stChord: 1.09,
};
Object.assign(DC3_FIT, DC3_FIT_TAIL);
// THE USER'S LAST BATCH (28 Oct): "the cabin is far too long ... only span half of the current length, and you'll compensate by
// adding an extra passenger section" - the cockpit 1.0 -> 0.5 (0.80 m), a ninth bay (the first one aft of the cockpit stands
// empty: a bay's seats cannot be switched off - QUESTION 9's cargo bay), the cone 0.21 shorter: the tail post where it was; the
// pilots back at their controls (seatZ 1.32 -> 0.50: with half the cockpit they sat in the nose, ahead of the yokes, and the
// design check's worst corner read pitch.sm -0.27); "disable the option skylight, and ... 'bubble canopy' as an on/off slider"
// (the row the editor now calls 'glass ceiling'); "accurate prop positioning" - the whole nacelle 1.0 m forward (engBlockZ: the
// spinner's front 2.45 m aft of the nose, the reference's), 0.43 m inboard (engNacAt 0.18: 2.61 m out, the reference's 2.62),
// the axis on the reference's (engY -0.03: -0.97 under the body's centre), the nacelle's tail cone to the reference's end -
// and with the engines' mass forward the static margin 0.18 (the worst loading corner passes); "your tailwheel should be
// bigger and drop further" - the reference's 0.52 m wheel (s2R 0.26), its centre 1.13 m under the body's (s2_twLegDrop 0.42:
// a 10 deg deck, the model's); "is there any option for the nose to be more softly rounded?" - the new row noseDome (nose
// roundness, cone -> dome: _cage_gen.js) at 0.3 (the reference's nose within 3-6 cm over its first 0.75 m; 1 is 25 cm too blunt), the tip collapsed and uncreased, the joint band off: one smooth tip
Object.assign(DC3_FIT, {
  pilotLen: 0.5, paxCount: 9, boomLen: 2.25, seatZ: 0.5, bubble: 0, skylight: 0,
  engNacAt: 0.18, engBlockZ: 1.0, cw_noseOff: 0.12, cw_tailLen: 3.35, engY: -0.03,
  s2R: 0.26, s2_twLegDrop: 0.42,
  noseDome: 0.3, noseTip: 0.98, crNoseCap: 0, crFrontCap: 0, noseJointOn: 0,
  // the outer dihedral 7.5 -> 6.5 deg: at 7.5 the Dutch roll diverged (yaw.dutch damping -0.021, the design check's fix: less
  // dihedral); 6.5 passes every row - the reference's chord-line slope 7.5, its headline dihedral 5.95
  wgDihedralOut: 6.5,
});
function dc3FullRaw(over) {
  const j = PR.dc3Raw(1.0);
  Object.assign(j.spec.cage, DC3_ROWS, DC3_FIT, over || {});   // G3579: v1 - the reference fit over the study's rows
  // the DC-3's 822 US gal in two centre-section tanks (the widened 2 000 L a vessel)
  j.spec.energy.vessels = [{ bay: 'wingRoot', capacity: 1555 }, { bay: 'wingRoot', capacity: 1555 }];
  j.spec.fuel.litres = 3110;
  j.name = 'DC-3 (full size)';
  j.what = 'DC3-BUILD G3501-G3509 - a full-size DC-3 through the garage\'s own path (tools/dc3_build.js)';
  return j;
}

function buildFixture(over) {
  const j = dc3FullRaw(over);
  const r = LB.gameSpecFull(j);
  return { env: { what: j.what, v: j.v, name: j.name, spec: r.spec }, errors: r.errors || [] };
}

// the real DC-3 beside the flown one (the study's REAL column, sources in DC3-STUDY §1)
function compare(s, R) {
  const f = (v, d) => v == null || !isFinite(v) ? '-' : (+v).toFixed(d == null ? 0 : d);
  const kt = v => v / 0.514444, RL = PR.REAL;
  const rows = [
    ['span m', RL.span, s.span, 1], ['wing area m2', RL.Sw, s.Sw, 1], ['MTOW / flown kg', RL.mtow, s.mass, 0],
    ['Vs clean kt', RL.VsKt, kt(s.Vs), 0], ['Vs flaps kt', RL.VsoKt, kt(s.VsFlap), 0], ['climb m/s (sheet)', RL.climbMs, s.climbRate, 1],
    ['cruise kt (sheet)', RL.cruiseKt + '-' + RL.maxCruiseKt, kt(s.VCruise), 0], ['take-off roll m (sheet)', '271-518', s.TORun, 0],
  ];
  if (R) rows.push(
    ['take-off roll m (flown)', '271-518', R.lift && R.lift.d, 0], ['lift-off kt (flown)', '~70-75', R.lift && kt(R.lift.V), 0],
    ['climb m/s (flown, max)', RL.climbMs, R.maxVs, 1], ['landing roll m (flown)', RL.ldgRollM, R.ldgRoll, 0],
    ['landing over 15 m (flown)', RL.ldgOver15M, R.ldgOver15, 0]);
  console.log('\n  vs the real DC-3:');
  for (const [k, real, v, d] of rows) console.log('    ' + k.padEnd(26) + String(real).padStart(10) + '  ' + f(v, d).padStart(8));
}

if (require.main === module) {
  const C = require('./flight_core.js');
  if (flag('build') || !fs.existsSync(FIX)) {
    const r = buildFixture();
    fs.writeFileSync(FIX, JSON.stringify(r.env, null, 1) + '\n');
    console.log('wrote ' + path.relative(ROOT, FIX) + ' (join errors: ' + r.errors.length + ')');
    for (const e of r.errors) console.log('  ERRS ' + e);
    if (flag('build')) process.exit(r.errors.length ? 1 : 0);
  }
  const L = LB.loadBuild(path.relative(ROOT, FIX));
  console.log('loaded ' + path.relative(ROOT, FIX) + ' through the load chain: join errors ' + (L.errors || []).length);
  for (const e of L.errors || []) console.log('  ERRS ' + e);
  const def = C.buildGen(JSON.parse(JSON.stringify(L.spec)));
  const s = PR.sheet(C, def, 'DC-3 FULL SIZE - tools/fixtures/dc3_2026-10.json');
  printSheetFull(s);
  s.cost = (() => { const a = []; for (let i = 0; i < 3; i++) a.push(stepCostOf(C, def)); a.sort((x, y) => x.msPerFrame - y.msPerFrame); return a[1]; })();
  console.log(`  solver ${s.cost.msPerFrame.toFixed(2)} ms / 60 Hz frame (node, airborne, median of 3), substeps ${s.cost.substeps}`);
  if (flag('no-cert')) def.cert = null;
  if (!flag('no-fly')) {
    if (flag('no-cert')) def._certS = 0, def.cert = undefined;
    s.flight = PR.fly(C, def, +opt('maxS', 600));
    console.log('');
    printFlight(s.flight);
  }
  compare(s, s.flight);
  if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify(s, null, 1));
}
function stepCostOf(C, def) {
  const sim = C.makeSim(def, null);
  sim.reset(0);
  for (let i = 0; i < 60; i++) sim.step(1 / 60);
  const n = 600, t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) sim.step(1 / 60);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / n;
  const st = sim.stats ? sim.stats() : {};
  return { msPerFrame: ms, substeps: def.params && def.params.substeps };
}
function printSheetFull(s) {
  // the probe's printer, then the lattice's extent
  const pr = require('./dc3_probe.js');
  if (pr.printSheet) pr.printSheet(s); else console.log(JSON.stringify(s));
}
function printFlight(R) { const pr = require('./dc3_probe.js'); if (pr.printFlight) pr.printFlight(R); else console.log(JSON.stringify(R)); }
module.exports = { DC3_ROWS, DC3_FIT, dc3FullRaw, buildFixture, FIX };
