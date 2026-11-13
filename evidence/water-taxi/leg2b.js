// leg2.js <tree> <file>: the tour SEA > mk_sea > SEA, the SECOND leg's ground (water) phases logged every 3 s until airborne
const path = require('path'), fs = require('fs');
const T = path.join(path.resolve(process.argv[2]), 'flyDiy', 'tools');
const say = s => process.stdout.write(s + '\n');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js')), IN = require(path.join(T, 'island_node.js')), TR = require(path.join(T, '_tour_lib.js'));
const SH = require(path.join(path.resolve(process.argv[2]), 'flyDiy', 'src', 'viewer', 'sim_host.js'));
const TW = TR.tourWorld(C, IN, fs), W = TW.W, A = id => W.aerodromes.find(q => q.id === id);
let leg = 1, t = 0, k = 0, done = false;
const o = SH.makeSimHost;
SH.makeSimHost = function () { const H = o.apply(this, arguments); const s0 = H.step.bind(H);
  H.step = function () { const r = s0(); t += 1 / 60; k++;
    if (leg === 2 && !done && (k % 180) === 0) { const s = H.sim, ax = s.axes()[0], nl = Math.hypot(ax[0], ax[2]) || 1, nose = Math.atan2(-ax[2] / nl, -ax[0] / nl) * 57.3;
      const v = s.cgVel(), cg = s.cgPos(), a = A('mk_sea'); const dx = cg[0] - a.x, dz = cg[2] - a.z, al = dx * Math.cos(a.hdg) + dz * Math.sin(a.hdg), ac = -dx * Math.sin(a.hdg) + dz * Math.cos(a.hdg);
      const c = s.ctl || {}; const w = W.wind ? W.wind(cg[0], cg[1], cg[2], t) : [0, 0, 0];
      say('t ' + t.toFixed(0) + ' ' + H.ap.phase.padEnd(8) + ' V ' + Math.hypot(v[0], v[2]).toFixed(1) + ' nose ' + nose.toFixed(0) + ' (lane ' + (a.hdg * 57.3).toFixed(0) + ') along ' + al.toFixed(0) + ' across ' + ac.toFixed(0) + ' thr ' + (+c.thr || 0).toFixed(2) + ' dr ' + (+c.dr || 0).toFixed(2) + ' wr ' + JSON.stringify(c.wr) + ' brk ' + (+c.brake || 0).toFixed(2) + ' wind ' + Math.hypot(w[0], w[2]).toFixed(1) + '@' + (Math.atan2(w[2], w[0]) * 57.3).toFixed(0));
      if (H.ap.phase === 'CLIMB') done = true; }
    return r; };
  return H; };
const def = TR.defOf(C, PT, process.argv[3]);
TR.flyTour(C, W, def, ['SEA', 'mk_sea', 'SEA'], { game: {}, tMax: 1500, log: L2 => { say('LEG ' + L2.from + '>' + L2.to + ' landedOn ' + L2.landedOn + ' warn ' + JSON.stringify(L2.warnings) + ' faults ' + JSON.stringify(L2.faults.map(f => f.k))); leg++; t = 0; } });
