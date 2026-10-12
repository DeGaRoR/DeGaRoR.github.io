#!/usr/bin/env node
// G2080 ENGINE-TORQUE: THE SEAPLANE CROSSWIND, SWEPT. GATE SEAPLANE's crosswind case (the user's twin 582 on floats,
// placed on the SEA lane, THE PILOT's take-off run with the wind straight across) flown at several wind speeds around
// the gate's 5 m/s, on any core - so a pass or a fail at exactly 5.0 can be told from the case's own margin.
//
//   node tools/engine_torque_seasweep.js                         this tree's core, 4.6 4.8 5.0 5.2 5.4 m/s
//   node tools/engine_torque_seasweep.js --core=<flight_core.js> --winds=4,5,6 --off   (--off: PAR.propFx all 0)
//
// One line per wind: the largest heading swing from the roll's own heading while wet (the gate's measure, bound 30),
// the furthest off the lane (bound 30 m), and when it left the water (dry 2 s; bound 25 s).
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const CORE = path.resolve(arg('core', path.join(__dirname, 'flight_core.js')));
const FIX = path.join(__dirname, 'fixtures', 'build_v7_ultralight_2026-09-05.json');

function one(wx, off) {
  const C = require(CORE);
  if (off && C.PAR.propFx) C.PAR.propFx = { torque: 0, gyro: 0, pfactor: 0, swirl: 0 };
  const spec = JSON.parse(fs.readFileSync(FIX, 'utf8')).spec;
  spec.gear.type = 'floats';
  const def = C.buildGen(C.genMigrateSpec(spec));
  const world = C.makeWorld(); world.setWind({ base: [wx, 0, 0], gust: 0 });
  const sea = world.aerodromes.find(a => a.id === 'SEA');
  const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  const ap = C.makePilot(sim, def, world); ap.setRoute(sea, sea);
  let T = 0, ref = null, swing = 0, xMax = 0, dryFrom = null, lift = null, wasWet = true, roll = 0;
  for (let s = 0; s < 120 * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60); T += 1 / 60;
    const [xA] = sim.axes(), cg = sim.cgPos(), hdg = Math.atan2(-xA[0], -xA[2]) * 180 / Math.PI;
    const wet = sim.hydro.floats.reduce((a, x) => a + x.wet, 0) > 0;
    if (wet && lift == null) {
      if (ap.phase === 'ROLL' || ap.phase === 'LIFTOFF') { if (ref == null) ref = hdg; swing = Math.max(swing, Math.abs(((hdg - ref + 540) % 360) - 180)); }
      xMax = Math.max(xMax, Math.abs(cg[0])); roll = Math.max(roll, Math.abs(sim.out.roll) * 57.2958);
    }
    if (!wet && wasWet && T > 2 && lift == null) dryFrom = T;
    if (wet && !wasWet && lift == null) dryFrom = null;
    if (!wet && dryFrom != null && lift == null && T - dryFrom >= 2) lift = dryFrom;
    wasWet = wet;
    if (ap.phase === 'CLIMB' || ap.phase === 'STOPPED') break;
  }
  const ok = lift != null && lift < 25 && swing < 30 && xMax < 30;
  return { wx, ok, swing: +swing.toFixed(1), xMax: +xMax.toFixed(1), lift: lift == null ? null : +lift.toFixed(1), heelMax: +roll.toFixed(1), end: ap.phase };
}

if (arg('one')) { process.stdout.write(JSON.stringify(one(+arg('one'), process.argv.includes('--off')))); process.exit(0); }
const winds = arg('winds', '4.6,4.8,5.0,5.2,5.4').split(',').map(Number);
const res = [];
let n = 0;
for (const wx of winds) {
  const args = [__filename, '--one=' + wx, '--core=' + CORE].concat(process.argv.includes('--off') ? ['--off'] : []);
  const ch = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'inherit'] });
  let b = ''; ch.stdout.on('data', d => b += d);
  ch.on('close', () => {
    try { res.push(JSON.parse(b)); } catch (e) { res.push({ wx, error: true }); }
    if (++n === winds.length) {
      console.log(`SEAPLANE crosswind sweep on ${path.relative(process.cwd(), CORE)}${process.argv.includes('--off') ? ' (propFx off)' : ''}`);
      for (const r of res.sort((a, b) => a.wx - b.wx)) console.log(r.error ? `  ${r.wx} m/s: error` :
        `  ${r.wx.toFixed(1)} m/s  ${r.ok ? 'PASS' : 'FAIL'}  swing ${r.swing} deg  off ${r.xMax} m  lift-off ${r.lift == null ? '-' : r.lift + ' s'}  heel ${r.heelMax} deg  (${r.end})`);
      console.log(`  ${res.filter(r => r.ok).length} of ${res.length} pass`);
    }
  });
}
