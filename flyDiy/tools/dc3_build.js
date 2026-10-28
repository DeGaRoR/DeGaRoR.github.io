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
  pilotLen: 1.5, paxCount: 3, paxLen: 1.75, boomLen: 2.2,
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
};
function dc3FullRaw(over) {
  const j = PR.dc3Raw(1.0);
  Object.assign(j.spec.cage, DC3_ROWS, over || {});
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
module.exports = { DC3_ROWS, dc3FullRaw, buildFixture, FIX };
