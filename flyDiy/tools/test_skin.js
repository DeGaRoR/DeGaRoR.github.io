// Gate: spanwise skin binding is sane and follows the sim's wing flex.
const { decodeModel, makeSkinBinding, sparDeltas, applySkinDeform,
        buildPA18, makeSim, makeAutopilot, makeWorld } = require('./flight_core.js');
const { MODEL_PA18 } = require('../src/models/pa18_model.js');

const CFG = { tags: ['WF', 'WR'], zRoot: 1.30, xMax: 1.5 };  // keep in sync with SKIN_CFG
let ok = true, why = [];
const chk = (c, m) => { if (!c) { ok = false; why.push(m); } };

const dec = decodeModel(MODEL_PA18);
const def = buildPA18();
const bind = makeSkinBinding(dec.skin.pos, dec.skin.nv, def, CFG);

// binding structure
chk(bind.zs.length === 3 && Math.abs(bind.zs[2] - 5.0) < 0.01, `stations ${bind.zs}`);
chk(bind.P.st.every(ids => ids.length === 2), 'P stations should average WF+WR');
let nP = 0, nN = 0, badBind = 0;
for (let j = 0; j < bind.bound.length; j++) {
  const i = bind.bound[j], x = dec.skin.pos[i*3], z = dec.skin.pos[i*3+2];
  if (Math.abs(z) < CFG.zRoot - 1e-6 || x > CFG.xMax + 1e-6) badBind++;
  bind.side[j] ? nP++ : nN++;
}
console.log(`bound ${bind.bound.length}/${dec.skin.nv} verts (P ${nP} / N ${nN})`);
chk(badBind === 0, `${badBind} verts bound outside the wing band`);
chk(bind.bound.length > 2000 && bind.bound.length < 12000, 'bound count out of range');
chk(Math.abs(nP - nN) / (nP + nN) < 0.1, 'left/right vertex count asymmetric');

// deltas at rest: only elastic sag, small
const world = makeWorld();
const sim = makeSim(def, world);
sim.reset(0);
for (let s = 0; s < 10*60; s++) sim.step(1/60);
const deltas = { P: new Float32Array(9), N: new Float32Array(9) };
sparDeltas(bind, sim, deltas);
const mag = d => Math.max(...[0,1,2].map(k => Math.hypot(d[k*3], d[k*3+1], d[k*3+2])));
console.log(`rest deltas: P ${(mag(deltas.P)*100).toFixed(1)} cm  N ${(mag(deltas.N)*100).toFixed(1)} cm`);
chk(mag(deltas.P) < 0.12 && mag(deltas.N) < 0.12, 'rest deltas too large (bad rest reference)');

// fly into the climb, deform, verify the skin follows the spar
const ap = makeAutopilot(sim, def);
for (let s = 0; s < 30*60; s++) { ap.update(1/60); sim.step(1/60); }
sparDeltas(bind, sim, deltas);
const climbMag = Math.max(mag(deltas.P), mag(deltas.N));
console.log(`climb (${ap.phase}) deltas: max ${(climbMag*100).toFixed(1)} cm  tipP dy=${(deltas.P[7]*100).toFixed(1)} cm`);
chk(climbMag > 0.002 && climbMag < 0.6, 'climb deltas outside sane range');

const pos = dec.skin.pos.slice();
applySkinDeform(bind, dec.skin.pos, pos, deltas.P, deltas.N, 1);
let nanD = false, fusMoved = 0, tipDy = 0, tipN = 0;
for (let i = 0; i < dec.skin.nv; i++) {
  const dx = pos[i*3]-dec.skin.pos[i*3], dy = pos[i*3+1]-dec.skin.pos[i*3+1],
        dz = pos[i*3+2]-dec.skin.pos[i*3+2];
  if (!isFinite(dx+dy+dz)) nanD = true;
  const z = dec.skin.pos[i*3+2];
  if (Math.abs(z) < 1.0) fusMoved = Math.max(fusMoved, Math.abs(dx)+Math.abs(dy)+Math.abs(dz));
  if (z > 5.2) { tipDy += dy; tipN++; }
}
// expected tip dy: linear extrapolation of stations 2->3 to z = 5.36
const w = (5.36 - 3.4) / (5.0 - 3.4);
const expTip = deltas.P[4] * (1 - w) + deltas.P[7] * w;
console.log(`deform: fuselage moved ${(fusMoved*1000).toFixed(2)} mm | tip dy ${(tipDy/tipN*100).toFixed(2)} cm (expected ~${(expTip*100).toFixed(2)})`);
chk(!nanD, 'NaN in deformed positions');
chk(fusMoved < 1e-6, 'fuselage vertices moved (binding leak)');
chk(Math.abs(tipDy/tipN - expTip) < 0.01, 'tip does not track extrapolated spar delta');

console.log(why.join('\n'));
console.log(ok ? 'GATE SKIN: PASS' : 'GATE SKIN: FAIL');
process.exit(ok ? 0 : 1);
