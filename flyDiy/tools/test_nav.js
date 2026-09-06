#!/usr/bin/env node
// GATE NAV (G202.1) — the navigator (38_nav.js) and the units, pure and fast:
// leg geometry and its signs, the flight plan's sequencing by turn
// anticipation, direct-to, the readouts (DTK/TRK/BRG/DIS/XTK/CDI/ETE), VNAV,
// and PILOT_UNITS. No sim flown.
//
//   node tools/test_nav.js            -> "GATE NAV: PASS|FAIL"
//   node tools/test_nav.js --selftest -> negative verification of the checks
'use strict';
const C = require('./flight_core.js');
const { navMake, navLegGeom, navDeg, navRad, navDiff, PILOT_UNITS } = C;

const fails = [];
const check = (ok, label, extra) => {
  console.log((ok ? '  ok     ' : '  FAIL   ') + label + (ok || !extra ? '' : ' — ' + extra));
  if (!ok) fails.push(label);
  return ok;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

function checkGeom(g) {
  check(near(g.dtk, 0, 1e-9), 'geom: a leg along +x has DTK 0', String(g.dtk));
  check(near(g.s, 300, 1e-9) && near(g.rem, 700, 1e-9), 'geom: along-track and remaining add to the length');
  check(near(g.xt, 50, 1e-9), 'geom: +z off a +x course is RIGHT of course (+xt)', String(g.xt));
}
function checkSeq(rec) {
  check(rec.seqAt > 0 && rec.seqAt < 200, 'plan: the corner is sequenced BEFORE the fix (turn anticipation)', rec.seqAt + ' m short');
  check(rec.toAfter === 'C', 'plan: the active waypoint moves on to the next', String(rec.toAfter));
  check(rec.dtkAfter != null && near(rec.dtkAfter, 90, 1e-6), 'plan: the new DTK is the next leg\'s (90 deg = +z)', String(rec.dtkAfter));
  check(rec.arrived === true, 'plan: the last waypoint is held and flagged arrived, never dropped');
}
function checkReadouts(R) {
  check(R.cdi < 0 && near(R.cdi, -0.5, 1e-9), 'readouts: 150 m right of course reads CDI -0.5 (fly left)', String(R.cdi));
  check(near(R.brg, navDeg(Math.atan2(-150, 700)), 1e-6), 'readouts: BRG points at the waypoint', String(R.brg));
  check(near(R.dis, Math.hypot(700, 150), 1e-6), 'readouts: DIS is the distance to the waypoint', String(R.dis));
  check(near(R.trk, 0, 1e-9) && near(R.gs, 30, 1e-9), 'readouts: TRK and GS come from the velocity');
  check(R.ete != null && near(R.ete, R.dis / 30, 1e-6), 'readouts: ETE = DIS / GS', String(R.ete));
}
function checkVnav(vs) { check(vs != null && vs < 0 && near(vs, -100 / (Math.hypot(700, 150) / 30), 1e-6), 'vnav: the VS that reaches the target at the fix', String(vs)); }
function checkUnits(U) {
  check(near(U.kt(10), 19.438, 0.01), 'units: 10 m/s = 19.44 kt');
  check(near(U.fpm(1), 196.85, 0.01), 'units: 1 m/s = 196.85 fpm');
  check(near(U.ft(100), 328.08, 0.01), 'units: 100 m = 328.1 ft');
  check(near(U.deg(Math.PI / 2), 90, 1e-9) && near(navDiff(350, 10), 20, 1e-9), 'units: degrees wrap and difference');
}

if (process.argv.includes('--selftest')) {
  const probes = [
    ['xt sign flipped', checkGeom, { dtk: 0, s: 300, rem: 700, xt: -50 }],
    ['sequenced only at the fix', checkSeq, { seqAt: 0, toAfter: 'C', dtkAfter: 90, arrived: true }],
    ['last waypoint dropped', checkSeq, { seqAt: 100, toAfter: 'C', dtkAfter: 90, arrived: false }],
    ['cdi sign flipped', checkReadouts, { cdi: 0.5, brg: navDeg(Math.atan2(-150, 700)), dis: Math.hypot(700, 150), trk: 0, gs: 30, ete: Math.hypot(700, 150) / 30 }],
    ['vnav climbs to a lower target', checkVnav, 2.0],
    ['knots wrong', checkUnits, Object.assign({}, PILOT_UNITS, { kt: v => v * 2 })],
  ];
  let caught = 0;
  for (const [nm, fn, arg] of probes) {
    const before = fails.length;
    const silent = console.log; console.log = () => {};
    try { fn(arg); } finally { console.log = silent; }
    const ok = fails.length > before; fails.length = before;
    console.log(`  selftest ${nm.padEnd(32)} ${ok ? 'CAUGHT' : 'MISSED'}`);
    if (ok) caught++;
  }
  console.log('GATE NAV: ' + (caught === probes.length ? 'PASS' : 'FAIL (selftest)'));
  process.exit(caught === probes.length ? 0 : 1);
}

console.log('-- leg geometry --');
checkGeom(navLegGeom([0, 0], [1000, 0], 300, 50));

console.log('-- flight plan, sequencing by anticipation --');
{
  const N = navMake({ waypoints: [{ id: 'A', x: 0, z: 0 }, { id: 'B', x: 1000, z: 0 }, { id: 'C', x: 1000, z: 1000 }] });
  N.plan(['A', 'B', 'C']);
  const rec = { seqAt: null, toAfter: null, dtkAfter: null, arrived: false };
  // fly along +x at 30 m/s with a 100 m turn radius: the corner at B is a
  // 90 deg turn, anticipated 100 m before it
  for (let x = 0; x <= 1000; x += 5) {
    const R = N.update(x, 0, 30, 0, 100);
    if (R.to === 'C' && rec.seqAt == null) { rec.seqAt = 1000 - x; rec.dtkAfter = R.dtk; }
  }
  rec.toAfter = N.last.to;
  for (let z = 0; z <= 1100; z += 10) N.update(1000, z, 0, 30, 100);
  rec.arrived = N.last.arrived;
  checkSeq(rec);
}

console.log('-- direct-to and the readouts --');
{
  const N = navMake({ waypoints: [{ id: 'M', x: 700, z: -150 }] });
  N.directTo('M', 0, 0);
  // the course runs from (0,0) to (700,-150); stand 150 m to the RIGHT of it
  const g = navLegGeom([0, 0], [700, -150], 0, 0);
  const px = 0 + 150 * (-g.uz), pz = 0 + 150 * g.ux;    // right of course = +xt
  const R = N.update(px, pz, 30, 0, 0);
  // the readouts here are checked against the aeroplane at the ORIGIN for
  // brg/dis (the doctored probe uses those), so recompute from the origin
  const R0 = navMake({ waypoints: [{ id: 'M', x: 700, z: -150 }] }).directTo('M', 0, 0).update(0, 0, 30, 0, 0);
  checkReadouts({ cdi: R.cdi, brg: R0.brg, dis: R0.dis, trk: R0.trk, gs: R0.gs, ete: R0.ete });
  console.log('-- vnav --');
  const N2 = navMake({ waypoints: [{ id: 'M', x: 700, z: -150 }] }).directTo('M', 0, 0);
  N2.update(0, 0, 30, 0, 0);
  checkVnav(N2.vnav(200, 100));
}

console.log('-- units --');
checkUnits(PILOT_UNITS);

if (fails.length) console.log('FAILED CHECKS: ' + fails.join(', '));
console.log('GATE NAV: ' + (fails.length ? 'FAIL' : 'PASS'));
process.exit(fails.length ? 1 : 0);
