// Gate: baked PA-18 payload decodes correctly and lands on the sim's wheels.
const { decodeModel } = require('./model_codec.js');
const { MODEL_PA18 } = require('./pa18_model.js');
const { buildCub, makeSim, makeWorld } = require('./flight_core.js');

const dec = decodeModel(MODEL_PA18);
let ok = true, why = [];
const chk = (c, msg) => { if (!c) { ok = false; why.push(msg); } };

// structure
for (const g of ['skin', 'glass', 'prop']) {
  const d = dec[g];
  chk(d && d.pos.length === d.nv * 3 && d.idx.length === d.nt * 3, `${g}: count mismatch`);
  let mx = 0, bad = false;
  for (let i = 0; i < d.idx.length; i++) mx = Math.max(mx, d.idx[i]);
  for (let i = 0; i < d.pos.length; i++) if (!isFinite(d.pos[i])) bad = true;
  chk(mx < d.nv, `${g}: index out of range (${mx} >= ${d.nv})`);
  chk(!bad, `${g}: NaN in positions`);
}
// dimensions: PA-18 span 10.71 m, length ~6.9 m
const s = dec.skin;
let bb = [1e9,1e9,1e9,-1e9,-1e9,-1e9];
for (let i = 0; i < s.nv; i++) {
  for (let a = 0; a < 3; a++) {
    bb[a] = Math.min(bb[a], s.pos[i*3+a]); bb[3+a] = Math.max(bb[3+a], s.pos[i*3+a]);
  }
}
const span = bb[5]-bb[2], len = bb[3]-bb[0];
console.log(`skin ${s.nv} verts ${s.nt} tris | span ${span.toFixed(2)} len ${len.toFixed(2)} ymin ${bb[1].toFixed(3)}`);
chk(Math.abs(span - 10.71) < 0.05, `span ${span.toFixed(2)} != 10.71`);
chk(Math.abs(len - 6.92) < 0.06, `length ${len.toFixed(2)} != 6.92`);
chk(dec.prop.nt > 50 && dec.glass.nt > 50, 'prop/glass suspiciously empty');

// wheel calibration: model wheels (skin ymin + O.y, body frame) must sit within
// 5 cm of the sim's main-gear contact height at rest
const world = makeWorld();
const def = buildCub();
const sim = makeSim(def, world);
sim.reset(0);
for (let k = 0; k < 10*60; k++) sim.step(1/60);
const cg = sim.cgPos(), [xA, yU] = sim.axes();
const iAx = def.nodes.findIndex(n => n.tag === 'AXLEL');
const d = [sim.p[iAx*3]-cg[0], sim.p[iAx*3+1]-cg[1], sim.p[iAx*3+2]-cg[2]];
const bodyY = d[0]*yU[0] + d[1]*yU[1] + d[2]*yU[2];
const simContact = bodyY - def.nodes[iAx].r;      // wheel bottom, body frame
const OY = -0.070;
const modelBottom = bb[1] + OY;
console.log(`gear: sim contact y=${simContact.toFixed(3)} | model wheel bottom y=${modelBottom.toFixed(3)} | delta ${((modelBottom-simContact)*100).toFixed(1)} cm`);
chk(Math.abs(modelBottom - simContact) < 0.05, 'model wheels off the sim contact plane');

console.log(why.join('\n'));
console.log(ok ? 'MODEL GATE: GREEN' : 'MODEL GATE: RED');
process.exit(ok ? 0 : 1);
