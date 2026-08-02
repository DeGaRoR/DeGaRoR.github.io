// Gate: control surfaces deflect with correct geometry and aero-consistent signs.
//   +de = pitch up   -> elevator TE up
//   +da = right roll -> aileronG (+z, left) TE down, aileronD TE up
//   +dr = nose left  -> rudder TE toward +z; fin (fwd of hinge) immobile
const { decodeModel, makeHingeBinding, applyHinges, makeSkinBinding,
        applySkinDeform, makeLinkage, buildPA18 } = require('./flight_core.js');
const { MODEL_PA18 } = require('../src/models/pa18_model.js');

let ok = true, why = [];
const chk = (c, m) => { if (!c) { ok = false; why.push(m); } };

const dec = decodeModel(MODEL_PA18);
chk(MODEL_PA18.v >= 2 && dec.skin.sid, 'payload not v2 / sid missing');
const S = MODEL_PA18.surfaces;
chk(S.length === 7, `expected 7 surfaces, got ${S.length}`);
const hb = makeHingeBinding(dec.skin, S);
hb.per.forEach((g, i) => chk(g.idx.length > 30, `${S[i].name}: only ${g.idx.length} verts`));

const base = dec.skin.pos, pos = base.slice();
const ctl = { de: 0.30, da: 0.20, dr: 0.25 };
applyHinges(hb, S, base, pos, ctl);

// helpers: mean displacement over a vertex predicate
const mean = (pred, comp) => {
  let s = 0, n = 0;
  for (let i = 0; i < dec.skin.nv; i++)
    if (pred(i)) { s += pos[i*3+comp] - base[i*3+comp]; n++; }
  return n ? s / n : NaN;
};
const sidOf = i => dec.skin.sid[i];
const X = i => base[i*3], Y = i => base[i*3+1], Z = i => base[i*3+2];

// elevator: TE (x > 3.25) up for +de; magnitude ~ arm * sin(de)
const eDy = mean(i => sidOf(i) === 3 && X(i) > 3.25, 1);
const eArm = 3.32 - 2.834;
console.log(`elevator TE dy ${(eDy*100).toFixed(1)} cm (expect ~+${(eArm*Math.sin(ctl.de)*100).toFixed(1)})`);
chk(eDy > 0.5 * eArm * Math.sin(ctl.de) && eDy < 1.1 * eArm * Math.sin(ctl.de), 'elevator TE wrong');

// ailerons: antisymmetric, G down / D up for +da
const gDy = mean(i => sidOf(i) === 1 && X(i) > -0.45, 1);
const dDy = mean(i => sidOf(i) === 2 && X(i) > -0.45, 1);
console.log(`aileron TE dy: G ${(gDy*100).toFixed(1)} cm  D ${(dDy*100).toFixed(1)} cm`);
chk(gDy < -0.01 && dDy > 0.01, 'aileron signs wrong (+da: G down, D up)');
chk(Math.abs(gDy + dDy) < 0.005, 'ailerons not antisymmetric');

// rudder: TE (x > 3.3, below fin) toward +z for +dr; fin immobile
const rDz = mean(i => sidOf(i) === 4 && X(i) > 3.3 && Y(i) < 0.8, 2);
let finMax = 0;
for (let i = 0; i < dec.skin.nv; i++)
  if (sidOf(i) === 4 && X(i) < 2.75)
    finMax = Math.max(finMax, Math.abs(pos[i*3]-base[i*3]) + Math.abs(pos[i*3+1]-base[i*3+1]) + Math.abs(pos[i*3+2]-base[i*3+2]));
console.log(`rudder TE dz ${(rDz*100).toFixed(1)} cm | fin max move ${(finMax*1000).toFixed(2)} mm`);
chk(rDz > 0.05, 'rudder TE should move to +z for +dr');
chk(finMax < 0.002, 'fin moved (ramp leak)');

// non-surface verts untouched; no NaN
let leak = 0, nan = false;
for (let i = 0; i < dec.skin.nv; i++) {
  const d = Math.abs(pos[i*3]-base[i*3]) + Math.abs(pos[i*3+1]-base[i*3+1]) + Math.abs(pos[i*3+2]-base[i*3+2]);
  if (!isFinite(d)) nan = true;
  if (!sidOf(i) && d > 0) leak++;
}
chk(!nan, 'NaN'); chk(leak === 0, `${leak} non-surface verts moved`);

// composition: flex on top of hinged ailerons (synthetic tip-up delta)
const bind = makeSkinBinding(base, dec.skin.nv, buildPA18(),
                             { tags: ['WF', 'WR'], zRoot: 1.30, xMax: 1.5 });
const dP = new Float32Array(9), dN = new Float32Array(9);
dP[7] = dN[7] = 0.10;                       // +10 cm at outer station, y
applySkinDeform(bind, base, pos, dP, dN, 1, hb.hinged);
const gDy2 = mean(i => sidOf(i) === 1 && X(i) > -0.45, 1);
console.log(`aileronG TE dy after flex ${(gDy2*100).toFixed(1)} cm (hinge ${(gDy*100).toFixed(1)} + flex)`);
chk(gDy2 > gDy + 0.02, 'flex did not compose on top of hinge');
const eDy2 = mean(i => sidOf(i) === 3 && X(i) > 3.25, 1);
chk(Math.abs(eDy2 - eDy) < 1e-6, 'flex leaked onto the elevator');

// tailwheel: steers with rudder at k=0.5; +dr -> aft of pivot toward +z
const twDz = mean(i => sidOf(i) === 5 && X(i) > 3.16, 2);
console.log(`tailwheel aft dz ${(twDz*100).toFixed(1)} cm (k=0.5)`);
chk(twDz > 0.005, 'tailwheel should steer with rudder (+z for +dr)');
chk(twDz < rDz, 'tailwheel throw should be smaller than rudder (k=0.5)');

// flaps: symmetric TE-down for +flap; ctl.flap is a 0..1 fraction, k = full throw
const posF = base.slice();
applyHinges(hb, S, base, posF, { flap: 1 });
const meanIn = (arr, pred, comp) => {
  let s = 0, n = 0;
  for (let i = 0; i < dec.skin.nv; i++)
    if (pred(i)) { s += arr[i*3+comp] - base[i*3+comp]; n++; }
  return n ? s / n : NaN;
};
const fG = meanIn(posF, i => sidOf(i) === 6 && X(i) > -0.45, 1);
const fD = meanIn(posF, i => sidOf(i) === 7 && X(i) > -0.45, 1);
const fArm = -0.40 - S[5].p[0];                 // TE band mid minus hinge x
const fExp = -fArm * Math.sin(S[5].k);          // TE down = -y
console.log(`flap TE dy: G ${(fG*100).toFixed(1)} cm  D ${(fD*100).toFixed(1)} cm (expect ~${(fExp*100).toFixed(1)}, k=${S[5].k})`);
chk(fG < 0.5 * fExp && fG > 1.1 * fExp, 'flapG magnitude/sign off (+flap: TE down)');
chk(Math.abs(fG - fD) < 0.005, 'flaps not symmetric (contrast: ailerons are antisymmetric)');
chk(Math.abs(meanIn(posF, i => sidOf(i) === 3 && X(i) > 3.25, 1)) < 1e-6, 'flap leaked onto elevator');

// linkage: DC tracking, step speed, dither attenuation at the 3.7 Hz limit cycle
const link = makeLinkage(0.15);
let y = 0;
for (let s = 0; s < 5*60; s++) y = link.step({ de: 0.2, da: 0, dr: 0 }, 1/60).de;
chk(Math.abs(y - 0.2) < 0.002, `linkage DC gain off (${y.toFixed(3)})`);
const l2 = makeLinkage(0.15);
let t90 = null;
for (let s = 0; s < 5*60; s++) {
  const v = l2.step({ da: 0.3 }, 1/60).da;
  if (t90 === null && v > 0.27) t90 = s/60;
}
console.log(`linkage: step 90% in ${t90 === null ? '>5' : t90.toFixed(2)} s`);
chk(t90 !== null && t90 < 0.7, 'linkage too sluggish for maneuvers');
const l3 = makeLinkage(0.15);
let aMax = 0;
for (let s = 0; s < 10*60; s++) {
  const dither = 0.08 * Math.sign(Math.sin(2*Math.PI*3.7*s/60));   // +-4.6 deg square
  const v = l3.step({ da: dither }, 1/60).da;
  if (s > 120) aMax = Math.max(aMax, Math.abs(v));
}
console.log(`linkage: 3.7 Hz dither +-${(0.08*57.3).toFixed(1)} deg -> +-${(aMax*57.3).toFixed(2)} deg (${(0.08/aMax).toFixed(1)}x)`);
chk(aMax < 0.08/5, 'linkage should attenuate the limit cycle at least 5x');
const l4 = makeLinkage(0.15);
let yf = 0;
for (let s = 0; s < 5*60; s++) yf = l4.step({ flap: 0.5 }, 1/60).flap;
chk(yf !== undefined && Math.abs(yf - 0.5) < 0.005,
    `linkage flap channel ${yf === undefined ? 'missing' : 'off (' + yf.toFixed(3) + ')'}`);

console.log(why.join('\n'));
console.log(ok ? 'GATE CTRL: PASS' : 'GATE CTRL: FAIL');
process.exit(ok ? 0 : 1);
