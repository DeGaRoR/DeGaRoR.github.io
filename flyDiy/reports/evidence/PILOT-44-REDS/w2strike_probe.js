// scratch: the metal Cessna HOME > w2 in the game's flight - when and where the propeller strikes, the water under it
'use strict';
const fs = require('fs'), path = require('path');
const T = path.join(process.env.FD || path.join(__dirname, '..', '..', '..'), 'tools');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const def = TR.defOf(C, PT, TR.BUILDS.c172.key);
const TW = TR.tourWorld(C, IN, fs), W = TW.W, A = id => W.aerodromes.find(q => q.id === id);
const a = A(process.argv[2] || 'HOME'), b = A(process.argv[3] || 'w2');
const H = TR.gameHost(C, W, def, a, b, {});
const sim = H.sim, step0 = sim.step;
let seen = false, ph0 = null;
sim.step = dt => {
  step0(dt);
  const D = sim.damage(), cg = sim.cgPos(), ph = H.ap.phase;
  if (ph !== ph0) { ph0 = ph; if (/FLARE|ROLLOUT|STOPPED/.test(ph)) console.log('  phase ' + ph + ' t ' + sim.t.toFixed(1) + ' cg ' + cg.map(v => v.toFixed(1)).join(',') + ' water ' + (W.waterH(cg[0], cg[2]) - W.terrainH(cg[0], cg[2])).toFixed(2)); }
  if (D.propStrike && !seen) {
    seen = true;
    const v = sim.cgVel();
    let lo = Infinity, lx = 0, lz = 0; for (let i = 0; i < sim.n; i++) if (sim.p[i * 3 + 1] < lo) { lo = sim.p[i * 3 + 1]; lx = sim.p[i * 3]; lz = sim.p[i * 3 + 2]; }
    console.log('PROP STRIKE ' + JSON.stringify(D.propAt) + ' phase ' + ph + ' cg ' + cg.map(q => q.toFixed(1)).join(',') + ' V ' + Math.hypot(v[0], v[2]).toFixed(1) + ' lowest node at (' + lx.toFixed(1) + ', ' + lz.toFixed(1) + ') water there ' + (W.waterH(lx, lz) - W.terrainH(lx, lz)).toFixed(2) + ' m, under the CG ' + (W.waterH(cg[0], cg[2]) - W.terrainH(cg[0], cg[2])).toFixed(2) + ' m; the surface ' + (W.surfaceAt ? W.surfaceAt(cg[0], cg[2]) : '?'));
  }
};
const L = TR.flyLeg(C, W, sim, def, a, b, { first: true, host: H, tMax: 1500 });
console.log(TR.fmtLeg(L));
console.log('verdicts ' + L.verdicts.join(' | '));
