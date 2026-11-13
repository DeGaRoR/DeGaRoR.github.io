// run.js <tree> <file> [secs]: placed on SEA, 'start' as the tour does, the first yield's moment logged
const path = require('path'), fs = require('fs');
const T = path.join(path.resolve(process.argv[2]), 'flyDiy', 'tools');
const say = s => process.stdout.write(s + '\n');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js')), IN = require(path.join(T, 'island_node.js')), TR = require(path.join(T, '_tour_lib.js'));
const TW = TR.tourWorld(C, IN, fs), W = TW.W, A = id => W.aerodromes.find(q => q.id === id);
const f = process.argv[3], secs = +(process.argv[4] || 40);
const def = TR.defOf(C, PT, f);
const H = TR.gameHost(C, W, def, A(process.argv[5] || 'SEA'), A(process.argv[6] || 'mk_sea'), process.env.LINEUP ? { lineup: true } : {});
H.queueCmd({ cmd: 'start' });
const D0 = JSON.parse(JSON.stringify(H.sim.damage()));
let t = 0, last = '', reported = false;
for (let k = 0; k < secs * 60; k++) {
  H.step(); t += 1 / 60;
  const s = H.sim, v = s.cgVel(), V = Math.hypot(v[0], v[2]), ax = s.axes(), pitch = Math.asin(Math.max(-1, Math.min(1, -ax[0][1]))) * 57.3;
  const cg = s.cgPos(), wh = W.waterH ? W.waterH(cg[0], cg[2]) : 0, D = s.damage();
  const line = H.ap.phase;
  if ((k % 60) === 0 || line !== last) say('t ' + t.toFixed(1) + ' ' + line + ' V ' + V.toFixed(1) + ' pitch ' + pitch.toFixed(1) + ' h ' + (cg[1] - wh).toFixed(2) + ' vy ' + v[1].toFixed(2) + ' g ' + D.gPeak.toFixed(2) + ' thr ' + (s.ctl ? (+s.ctl.thr).toFixed(2) : '?') + ' yields ' + (D.yields - D0.yields));
  last = line;
  if (!reported && D.yields > D0.yields) { reported = true; say('FIRST YIELD t ' + t.toFixed(2) + ' ' + JSON.stringify(D.firstYield)); }
  if (D.over) { say('OVER ' + D.reason); break; }
}
