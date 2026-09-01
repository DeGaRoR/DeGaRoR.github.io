// Gate: spanwise skin binding is sane and follows the sim's wing flex.
const { decodeModel, makeSkinBinding, sparDeltas, applySkinDeform,
        buildPA18, buildGen, defBodyProject, makeSim, makeAutopilot,
        makeWorld } = require('./flight_core.js');
const { MODEL_PA18 } = require('../src/models/pa18_model.js');

const CFG = { tags: ['WF', 'WR'], zRoot: 1.30, xMax: 1.5 };  // keep in sync with SKIN_CFG
let ok = true, why = [];
const chk = (c, m) => { if (!c) { ok = false; why.push(m); } };

// geometry bytes external since G149: the payload names its bin, fs reads it
const fs = require('fs'), path = require('path');
const bin = MODEL_PA18.bin ? new Uint8Array(fs.readFileSync(
  path.join(__dirname, '..', ...MODEL_PA18.bin.split('/')))) : undefined;
const dec = decodeModel(MODEL_PA18, bin);
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

// ---------------------------------------------------------------------------
// THE GEN BUILD'S REST FRAME (the at-rest bent wing). rest lives in the BODY
// frame — the frame sparDeltas measures in; at zero load, before a single
// step, the deltas must be EXACTLY zero. A rest kept in raw design axes
// leaves (R_beta - I)(p - cg), beta = the design pose's nose->tail pitch:
// that read as an aft-sheared wing, a crease at the centre-section boundary
// and kinked struts on the stand, and no flight gate could see it because
// they all settle first and subtract the baseline.
// ---------------------------------------------------------------------------
const GCFG = { tags: ['WF', 'WR'], zRoot: 0, xMax: 1e9 };  // station side only
const gdef = buildGen();
const gbind = makeSkinBinding(new Float32Array(0), 0, gdef, GCFG);
const gz = gbind.zs.length;
const gd = { P: new Float32Array(gz * 3), N: new Float32Array(gz * 3) };
const gsim = makeSim(gdef, world);
gsim.reset(0);                              // solver NOT stepped: zero load
sparDeltas(gbind, gsim, gd);
const gmax = Math.max(...[...gd.P, ...gd.N].map(Math.abs));
console.log(`gen rest deltas at reset(0): max ${(gmax*1000).toFixed(4)} mm over ${gz} stations`);
chk(gmax < 1e-6, 'gen deltas non-zero at zero load (rest reference out of body frame)');

// the strut anchor nodes get the same zero (app.js's two-end strut binding
// shares this rest law — the parked strut must not skew)
const gTo = defBodyProject(gdef);
const [gxA, gyU] = gsim.axes(), gcg = gsim.cgPos();
const gzL = [gxA[1]*gyU[2]-gxA[2]*gyU[1], gxA[2]*gyU[0]-gxA[0]*gyU[2],
             gxA[0]*gyU[1]-gxA[1]*gyU[0]];
let smax = 0, snodes = 0;
for (const sd of ['R', 'L']) {
  const fw = gdef.parts && gdef.parts.wf && gdef.parts.wf[sd];
  if (!fw || fw.strutRoot == null) continue;
  for (const ni of [fw.strutRoot, fw.strutF, fw.strutR]) {
    if (ni == null) continue;
    snodes++;
    const dx = gsim.p[ni*3]-gcg[0], dy = gsim.p[ni*3+1]-gcg[1],
          dz = gsim.p[ni*3+2]-gcg[2];
    const live = [dx*gxA[0]+dy*gxA[1]+dz*gxA[2],
                  dx*gyU[0]+dy*gyU[1]+dz*gyU[2],
                  dx*gzL[0]+dy*gzL[1]+dz*gzL[2]];
    const r = gTo(gdef.nodes[ni].p);
    smax = Math.max(smax, Math.abs(live[0]-r[0]), Math.abs(live[1]-r[1]),
                    Math.abs(live[2]-r[2]));
  }
}
console.log(`gen strut anchors at reset(0): ${snodes} nodes, max ${(smax*1000).toFixed(4)} mm`);
chk(snodes >= 6, 'default gen build has no strut anchors to check');
chk(smax < 1e-6, 'strut anchor rest out of body frame');

// NEGATIVE CONTROL: a rest reference pitched 1 deg out of the body frame MUST
// be seen — this is the disease the zero assertions above are the net for
const bad = { P: { st: gbind.P.st, rest: gbind.P.rest.slice() },
              N: { st: gbind.N.st, rest: gbind.N.rest.slice() } };
const cb = Math.cos(Math.PI/180), sbn = Math.sin(Math.PI/180);
for (const S of ['P', 'N']) for (let k = 0; k < gz; k++) {
  const x = bad[S].rest[k*3], y = bad[S].rest[k*3+1];
  bad[S].rest[k*3] = x*cb - y*sbn; bad[S].rest[k*3+1] = x*sbn + y*cb;
}
sparDeltas(bad, gsim, gd);
const bmax = Math.max(...[...gd.P, ...gd.N].map(Math.abs));
console.log(`negative control (rest pitched 1 deg): max ${(bmax*1000).toFixed(2)} mm`);
chk(bmax > 0.003, 'instrument blind to a rest reference out of the body frame');

// PARKED AND SETTLED: droop (y) is real sag and stays legal; in-plane (x, z)
// must stay small — nothing pulls a standing aeroplane's wing aft. The bound
// is not zero because bodyAxes reads a FLEXIBLE fuselage: the tail sinks on
// its wheel, the frame pitches with it, and the wing above the CG picks up a
// few real millimetres of apparent fore-aft — bounded, not denied.
for (let s = 0; s < 10*60; s++) gsim.step(1/60);
sparDeltas(gbind, gsim, gd);
let inPlane = 0, droop = 0;
for (const S of ['P', 'N']) for (let k = 0; k < gz; k++) {
  inPlane = Math.max(inPlane, Math.abs(gd[S][k*3]), Math.abs(gd[S][k*3+2]));
  droop = Math.max(droop, Math.abs(gd[S][k*3+1]));
}
console.log(`gen parked 10 s: in-plane max ${(inPlane*1000).toFixed(2)} mm, droop max ${(droop*1000).toFixed(2)} mm`);
chk(inPlane < 0.015, 'parked wing displaced in-plane (aft/spanwise shear at rest)');

// a cantilever build satisfies the same zero (no strut to blame)
const cdef = buildGen({ bracing: { type: 'cantilever' } });
const cbind = makeSkinBinding(new Float32Array(0), 0, cdef, GCFG);
const cz = cbind.zs.length;
const cd = { P: new Float32Array(cz * 3), N: new Float32Array(cz * 3) };
const csim = makeSim(cdef, world);
csim.reset(0);
sparDeltas(cbind, csim, cd);
const cmax = Math.max(...[...cd.P, ...cd.N].map(Math.abs));
console.log(`cantilever rest deltas at reset(0): max ${(cmax*1000).toFixed(4)} mm`);
chk(cmax < 1e-6, 'cantilever gen deltas non-zero at zero load');

console.log(why.join('\n'));
console.log(ok ? 'GATE SKIN: PASS' : 'GATE SKIN: FAIL');
process.exit(ok ? 0 : 1);
