// dep.js <tree> <file> <from> <to> <secs>: the departure logged - phase, speed, heading vs the lane, rudder, water-rudder, wind
const path = require('path'), fs = require('fs');
const T = path.join(path.resolve(process.argv[2]), 'flyDiy', 'tools');
const say = s => process.stdout.write(s + '\n');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js')), IN = require(path.join(T, 'island_node.js')), TR = require(path.join(T, '_tour_lib.js'));
const TW = TR.tourWorld(C, IN, fs), W = TW.W, A = id => W.aerodromes.find(q => q.id === id);
const a = A(process.argv[4]), b = A(process.argv[5]), secs = +process.argv[6];
const H = TR.gameHost(C, W, TR.defOf(C, PT, process.argv[3]), a, b, {});
H.queueCmd({ cmd: 'start' });
say('lane ' + a.id + ' hdg ' + (a.hdg * 57.3).toFixed(0) + ' len ' + a.len + ' wid ' + a.wid + ' kind ' + a.kind + ' water ' + !!a.water);
let last = '';
for (let k = 0, t = 0; k < secs * 60; k++) {
  H.step(); t += 1 / 60;
  const s = H.sim, ax = s.axes()[0], nl = Math.hypot(ax[0], ax[2]) || 1, nose = Math.atan2(-ax[2] / nl, -ax[0] / nl);
  const v = s.cgVel(), V = Math.hypot(v[0], v[2]), cg = s.cgPos();
  let e = (nose - a.hdg) * 57.3; while (e > 180) e -= 360; while (e < -180) e += 360;
  const ph = H.ap.phase, c = s.ctl || {};
  if ((k % 120) === 0 || ph !== last) say('t ' + t.toFixed(1) + ' ' + ph.padEnd(8) + ' V ' + V.toFixed(1) + ' hdgErr ' + e.toFixed(0) + ' rud ' + (+c.rud || +c.yaw || 0).toFixed(2) + ' thr ' + (+c.thr || 0).toFixed(2) + ' pos ' + cg[0].toFixed(0) + ',' + cg[2].toFixed(0) + ' wr ' + JSON.stringify(c.wrud ?? c.waterRudder ?? null));
  last = ph;
}
