// GATE SKIN — the generated build's REST FRAME (G145). The PA-18 payload's
// flex-binding half of this gate retired with the hand-written fleet
// (2026-09-05); the cage visual takes the same binding (makeSkinBinding /
// sparDeltas) against the live def, and this is the law it must obey.
const { makeSkinBinding, sparDeltas, buildGen, defBodyProject, makeSim,
        makeWorld } = require('./flight_core.js');
let ok = true, why = [];
const chk = (c, m) => { if (!c) { ok = false; why.push(m); } };
const world = makeWorld();

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
const [gxA, gyU] = gsim.axes(), gcg = gsim.bodyOrigin();   // G179: structural origin
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
