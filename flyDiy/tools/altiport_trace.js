#!/usr/bin/env node
// altiport_trace.js (G2520 ALTIPORT-ARRIVAL) - one leg of the game's flight (tools/_tour_lib.js gameHost: the 8 kt day
// ticked, the game's placement and pilot, damage on) traced every 2 s: the phase, the height over the To's strip (its
// highest ground), the distance to the aim, the leg's planned heights, the pilot's verdicts as they are said.
//   node tools/altiport_trace.js [--build <file.json>] [--from HOME] [--to tw_ski] [--calm] [--every 2] [--tmax 900] [--fine]
//   PILOT_CORE=<flight_core.js> flies another core (a before / after on one rig)
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(process.env.PILOT_CORE ? path.resolve(process.env.PILOT_CORE) : path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const build = opt('build', 'builds/jodel_2026-09-20_corrected.json');
const def = TR.defOf(C, PT, path.resolve(build));
const TW = TR.tourWorld(C, IN, fs);
const W = TW.W, A = id => W.aerodromes.find(q => q.id === id);
const a = A(opt('from', 'HOME')), b = A(opt('to', 'tw_ski'));
const H = TR.gameHost(C, W, def, a, b, { day: argv.includes('--calm') ? null : undefined });
const sim = H.sim;
// the To's strip: its ground along the centreline (lowest / highest)
let gLo = Infinity, gHi = -Infinity;
for (let k = 0; k <= 20; k++) { const s = -b.len / 2 + b.len * k / 20; const g = W.terrainH(b.x + Math.cos(b.hdg) * s, b.z + Math.sin(b.hdg) * s); gLo = Math.min(gLo, g); gHi = Math.max(gHi, g); }
console.log('altiport_trace: ' + path.basename(build) + ' ' + a.id + ' > ' + b.id + ' (elev ' + b.elev + ', strip ground ' + gLo.toFixed(1) + '..' + gHi.toFixed(1) + ' m), the game\'s flight' + (argv.includes('--calm') ? ' (calm)' : '') + '; core ' + (process.env.PILOT_CORE || 'tools/flight_core.js'));
H.queueCmd({ cmd: 'start' });
const every = +opt('every', 2), tMax = +opt('tmax', 900);
let lastPh = null, nV = 0, t = 0, ap = H.ap;
for (let k = 0; k < tMax * 60; k++) {
  H.step(); ap = H.ap; t += 1 / 60;
  const cg = sim.cgPos();
  const vs = ap.report.verdicts;
  while (nV < vs.length) { const v = vs[nV++]; console.log('  ' + t.toFixed(1).padStart(6) + ' s  SAY ' + v.code + (v.note ? ': ' + v.note : '')); }
  const ph = ap.phase;
  if (ph !== lastPh || (k % Math.round(every * 60)) === 0) {
    const d = Math.hypot(cg[0] - b.x, cg[2] - b.z) - b.len / 2;
    const L = ap.legs && ap.legs[ap.legI];
    console.log('  ' + t.toFixed(1).padStart(6) + ' s  ' + (ph !== lastPh ? '>' : ' ') + ph.padEnd(9) + ' h ' + cg[1].toFixed(0).padStart(4) + ' MSL  ' + (cg[1] - gHi).toFixed(0).padStart(5) + ' over the strip  ground ' + W.terrainH(cg[0], cg[2]).toFixed(0).padStart(4) +
      '  thr ' + d.toFixed(0).padStart(6) + ' m' + (L ? '  leg ' + L.name + (L.hPlan != null ? ' hPlan ' + L.hPlan : '') + (L.vpSum ? ' vp ' + JSON.stringify(L.vpSum) : '') : '') + (ap.climbHold ? '  HOLD to ' + Math.round(ap.climbHold.h) : ''));
    lastPh = ph;
  }
  // --fine: the landing roll every 0.25 s (FLARE / ROLLOUT): the nose against the strip's axis, the ground speed, the
  // offset off the centreline, the wind across, the rudder, the brakes, the wheels down
  if (argv.includes('--fine') && (ph === 'FLARE' || ph === 'ROLLOUT') && (k % 15) === 0) {
    const xA = sim.axes()[0], nose = Math.atan2(-xA[2], -xA[0]), v = sim.cgVel(), Vg = Math.hypot(v[0], v[2]);
    let e = nose - b.hdg; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
    const e2 = Math.abs(e) > Math.PI / 2 ? e - Math.sign(e) * Math.PI : e;
    const off = -(cg[0] - b.x) * Math.sin(b.hdg) + (cg[2] - b.z) * Math.cos(b.hdg);
    const c = sim.ctl || {}, o = sim.out || {};
    const cross = -(o.windX || 0) * Math.sin(b.hdg) + (o.windZ || 0) * Math.cos(b.hdg);
    console.log('  ' + t.toFixed(2).padStart(7) + ' s  ' + ph.padEnd(8) + ' nose ' + (e2 * 57.3).toFixed(1).padStart(6) + ' deg  Vg ' + Vg.toFixed(1).padStart(5) + '  off ' + off.toFixed(1).padStart(6) + ' m  wind across ' + cross.toFixed(1) +
      '  dr ' + (+c.dr || 0).toFixed(2) + ' de ' + (+c.de || 0).toFixed(2) + ' thr ' + (+c.thr || 0).toFixed(2) + ' brake ' + (+c.brake || 0).toFixed(2) + ' brakeD ' + (+c.brakeD || 0).toFixed(2) + ' wheels ' + (sim.wheelsOnGround ? sim.wheelsOnGround() : '?') + ' lat ' + (ap.mode ? ap.mode.lat : '?'));
  }
  const D = sim.damage ? sim.damage() : null;
  if ((D && D.over) || (ph === 'STOPPED' && t > 30)) break;
}
const LD = ap.report.landing, D = sim.damage ? sim.damage() : null;
console.log('END ' + ap.phase + ' t ' + t.toFixed(0) + ' s  landing ' + JSON.stringify(LD || null) + '  damage ' + (D ? JSON.stringify({ yields: D.yields, breaks: D.breaks, over: !!D.over, reason: D.reason || null }) : '-'));
