#!/usr/bin/env node
// GATE SEAPLANE (H4, G393) — the pilot on the water. The user's ultralight on
// floats, the SEA lane (20_world.js, a water aerodrome), THE PILOT
// (43_pilot.js) flying it as it flies a meadow: no site, no taxi graph.
//
//   node tools/_seaplane_check.js            -> "GATE SEAPLANE: PASS|FAIL"
//   node tools/_seaplane_check.js --show     -> the phase log
//
// WHAT IT ASSERTS:
//   CIRCUIT  calm air: off the water inside 25 s, a full circuit, the touch
//            back on the lane's water (deep, inside its width), a roll-out
//            to STOPPED inside 400 s, never more than 30 m off the lane's
//            centreline on the water, finite
//   CROSSWIND 5 m/s across the lane: the take-off run holds the lane — under
//            30 m off the centreline and under 30 deg of heading swing —
//            and lifts off inside 25 s (the water rudder below the step,
//            the air rudder on it; without H4 it left 186 m off at 51 deg)
//   TAXI     the same wind, throttle held at idle: the pilot's rudder law on
//            the water rudder keeps the heading within 20 deg and the
//            track within 10 m over 60 s
// Full tier: three flights of the pilot, ~6 min.
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./flight_core.js');
const SHOW = process.argv.includes('--show');
// --only=circuit,crosswind,taxi runs a subset (each flight is minutes)
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '--only=circuit,crosswind,taxi').slice(7).split(',');
const FIX = path.join(__dirname, 'fixtures', 'build_v7_ultralight_2026-09-05.json');
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const f = (v, n = 2) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : String(v);

const spec = JSON.parse(fs.readFileSync(FIX, 'utf8')).spec;
spec.gear.type = 'floats';
const def = C.buildGen(C.genMigrateSpec(spec));

function fly(o) {
  const world = C.makeWorld();
  if (o.wind) world.setWind({ base: o.wind, gust: 0 });
  if (process.env.SEA_TRAINS) world.setSea({ A: world.sea.A, L: world.sea.L, dir: world.sea.dir, n: +process.env.SEA_TRAINS });   // an A/B on the sea's train count (G460.3)
  const sea = world.aerodromes.find(a => a.id === 'SEA');
  const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  const ap = C.makePilot(sim, def, world); ap.setRoute(sea, sea);
  const R = { lift: null, touch: null, stopped: null, maxXWater: 0, maxHdgRun: 0, maxXRun: 0, finite: true, phases: [], touchDepth: null, touchX: null, touchZ: null, hdgTaxi: 0, xTaxi: 0, hdgRef: null, skips: 0, airborne: false };
  let T = 0, last = '', wasWet = true, dryFrom = null;
  for (let s = 0; s < (o.maxS || 400) * 60; s++) {
    ap.update(1 / 60);
    if (o.idle) sim.ctl.thr = 0.12;
    sim.step(1 / 60); T += 1 / 60;
    const cg = sim.cgPos(), v = sim.cgVel(); const [xA] = sim.axes();
    if (!Number.isFinite(cg[0]) || !Number.isFinite(v[0])) { R.finite = false; break; }
    const wet = sim.hydro.floats.reduce((a, x) => a + x.wet, 0) > 0;
    const hdg = Math.atan2(-xA[0], -xA[2]) * 180 / Math.PI;
    if (ap.phase !== last) { R.phases.push(`${f(T, 1)} ${ap.phase}`); if (SHOW) console.log(`   t ${f(T, 1)} -> ${ap.phase} V ${f(Math.hypot(v[0], v[2]))} x ${f(cg[0], 1)} z ${f(cg[2], 0)} hdg ${f(hdg, 1)}`); last = ap.phase; }
    if (wet) { R.maxXWater = Math.max(R.maxXWater, Math.abs(cg[0])); }
    // G451: THE SWING IS MEASURED FROM THE ROLL'S OWN HEADING. The pilot may
    // taxi a U-turn before it opens the throttle (a pure crosswind ties the
    // lane's two directions and the tie fell the other way once the water
    // rudder grew): a |hdg| of 179.9 read on the taxi was the U-turn, not
    // the run. From the first ROLL frame, relative and wrapped.
    // G451.2: THE RUN IS JUDGED UNTIL THE AEROPLANE IS AIRBORNE FOR REAL —
    // dry for two whole seconds — not until the first dry frame. The
    // ultralight skipped off the ventilated step at 15 m/s (0.99 Vs) in the
    // crosswind, ballooned under the Vr pull, fell back crabbed at 12.5 m/s
    // and water-looped 140 deg, and the instrument had stopped looking one
    // frame before (the red-gates session's finding on e433d31c). Every
    // wet frame of the ROLL / LIFTOFF counts now, and a wet-dry-wet cycle
    // before the aeroplane is away is a SKIP, reported and bounded.
    if (wet && !R.airborne) {
      if (ap.phase === 'ROLL' || ap.phase === 'LIFTOFF') {
        if (R.hdgRef == null) R.hdgRef = hdg;
        const d = ((hdg - R.hdgRef + 540) % 360) - 180;
        R.maxHdgRun = Math.max(R.maxHdgRun, Math.abs(d));
      }
      R.maxXRun = Math.max(R.maxXRun, Math.abs(cg[0]));
    }
    if (!wet && wasWet && T > 2 && !R.airborne) dryFrom = T;
    if (wet && !wasWet && dryFrom != null && !R.airborne) { R.skips++; dryFrom = null; }
    if (!wet && dryFrom != null && !R.airborne && T - dryFrom >= 2) { R.airborne = true; R.lift = dryFrom; }
    if (wet && !wasWet && R.airborne && R.touch == null) { R.touch = T; R.touchX = cg[0]; R.touchZ = cg[2]; R.touchDepth = world.waterH(cg[0], cg[2]) - world.terrainH(cg[0], cg[2]); }
    if (o.idle) { R.hdgTaxi = Math.max(R.hdgTaxi, Math.abs(hdg)); R.xTaxi = Math.max(R.xTaxi, Math.abs(cg[0])); }
    wasWet = wet;
    if (ap.phase === 'STOPPED') { R.stopped = T; break; }
    if (o.untilPhase && ap.phase === o.untilPhase) break;
  }
  return R;
}

if (ONLY.includes('circuit')) {
console.log('CIRCUIT (calm, the pilot, SEA -> SEA)');
  const R = fly({});
  console.log(`   lift-off ${f(R.lift, 1)} s; touch ${f(R.touch, 1)} s at (${f(R.touchX, 0)}, ${f(R.touchZ, 0)}), water ${f(R.touchDepth, 1)} m deep; stopped ${f(R.stopped, 1)} s; max |x| on the water ${f(R.maxXWater, 1)} m; phases: ${R.phases.map(p => p.split(' ')[1]).join(' ')}`);
  verdict(R.finite, 'the circuit stays finite');
  verdict(R.lift != null && R.lift < 25, `off the water inside 25 s (${f(R.lift, 1)})`);
  verdict(R.touch != null && R.touchDepth > 10 && Math.abs(R.touchX) < 100, `the touch is on the lane's deep water (${f(R.touchDepth, 1)} m, ${f(R.touchX, 0)} m off the centreline)`);
  verdict(R.stopped != null && R.stopped < 400, `rolled out to STOPPED (${f(R.stopped, 1)} s)`);
  verdict(R.maxXWater < 30, `never more than ${f(R.maxXWater, 1)} m off the centreline on the water (bound 30)`);
}
if (ONLY.includes('crosswind')) {
console.log('\nCROSSWIND TAKE-OFF (5 m/s across the lane)');
  const R = fly({ wind: [5, 0, 0], untilPhase: 'CLIMB', maxS: 120 });
  console.log(`   lift-off ${f(R.lift, 1)} s (airborne = dry 2 s; ${R.skips} skip${R.skips === 1 ? '' : 's'} before it); the run: max |x| ${f(R.maxXRun, 1)} m, max heading swing ${f(R.maxHdgRun, 1)} deg from the roll's ${f(R.hdgRef, 0)}; phases: ${R.phases.map(p => p.split(' ')[1]).join(' ')}`);
  verdict(R.finite && R.lift != null && R.lift < 25, `off the water inside 25 s (${f(R.lift, 1)})`);
  // the ultralight hops once on the step at 13 m/s (0.4 s dry, the nose-high
  // trim the ventilated step leaves it with — the owed hump-trim item) and
  // touches once after the unstick; the loop is what the heading and lane
  // bounds above catch, on every wet frame now
  verdict(R.skips <= 2, `${R.skips} skip${R.skips === 1 ? '' : 's'} before the aeroplane is away (bound 2)`);
  verdict(R.maxXRun < 30, `the run holds the lane: ${f(R.maxXRun, 1)} m off (bound 30)`);
  verdict(R.maxHdgRun < 30, `the heading swings ${f(R.maxHdgRun, 1)} deg at most (bound 30)`);
}
if (ONLY.includes('taxi')) {
console.log('\nTAXI (5 m/s across, throttle held at idle, 60 s)');
  const R = fly({ wind: [5, 0, 0], idle: true, maxS: 60 });
  console.log(`   max |hdg| ${f(R.hdgTaxi, 1)} deg, max |x| ${f(R.xTaxi, 1)} m`);
  verdict(R.finite && R.hdgTaxi < 20, `the water rudder holds the heading within ${f(R.hdgTaxi, 1)} deg (bound 20)`);
  verdict(R.xTaxi < 10, `the track within ${f(R.xTaxi, 1)} m (bound 10)`);
}
console.log(fails ? `\nGATE SEAPLANE: FAIL (${fails})` : '\nGATE SEAPLANE: PASS');
process.exit(fails ? 1 : 0);
