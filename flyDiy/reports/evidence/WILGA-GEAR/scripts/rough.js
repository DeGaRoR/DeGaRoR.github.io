process.env.CORE = '/workspace/DeGaRoR.github.io/flyDiy/tools/flight_core.js';
const { host, C } = require('./host.js'); const G = C.GEAR_LEVER, fs = require('fs');
const def = host(0).def, R = def.refs, LV = def.parts.lever;
const A = 0.05, lam = 3.0, k1 = 2 * Math.PI / lam, k2 = 2 * Math.PI / (0.43 * lam);
const W0 = C.makeWorld(0, {});
const W = Object.assign({}, W0, { terrainH: (x, z) => A * Math.sin(k1 * x + 0.7) * Math.cos(0.8 * k1 * z) + 0.5 * A * Math.sin(k2 * (0.6 * x + 0.8 * z)), trees: [], treesNear: (x, z, q) => { q.length = 0; return q; } });
const sim = C.makeSim(def, null); sim.reset(0); for (let f = 0; f < 480; f++) sim.step(1/60);
// put the settled aeroplane over the rough field heading +x, 0.25 m up, 1.5 m/s down, 0.8 Vs forward
const m = ids => [0,1,2].map(k => ids.reduce((a,i)=>a+sim.p[i*3+k],0)/ids.length);
const n0 = m(R.noseFrame), t0 = m(R.tailMid), hd = Math.atan2(n0[2]-t0[2], n0[0]-t0[0]), c = sim.cgPos();
const ca = Math.cos(-hd), sa = Math.sin(-hd);
const sim2 = C.makeSim(def, W); sim2.reset(0);
for (let i = 0; i < sim.n; i++) { const dx = sim.p[i*3]-c[0], dz = sim.p[i*3+2]-c[2]; sim2.p[i*3] = dx*ca - dz*sa; sim2.p[i*3+2] = dx*sa + dz*ca; sim2.p[i*3+1] = sim.p[i*3+1] + 0.25; }
const Vs = def.params.gen.VsFlap || def.params.gen.Vs;
for (let i = 0; i < sim.n; i++) { sim2.v[i*3] = 0.8 * Vs; sim2.v[i*3+1] = -1.5; sim2.v[i*3+2] = 0; }
sim2.ctl.thr = 0;
const rec = [];
for (let f = 0; f < 300; f++) { sim2.step(1/60);
  const nn = (ids => [0,1,2].map(k => ids.reduce((a,i)=>a+sim2.p[i*3+k],0)/ids.length));
  const nf = nn(R.noseFrame), tm = nn(R.tailMid), cg = sim2.cgPos(), o = sim2.oleo();
  rec.push({ t: +(f/60).toFixed(3), cg, pitch: Math.atan2(nf[1]-tm[1], Math.hypot(nf[0]-tm[0], nf[2]-tm[2])), sL: o[0].s, sR: o[1].s, F: [o[0].F, o[1].F],
    axL: [sim2.p[LV.sides[0].axle*3], sim2.p[LV.sides[0].axle*3+1], sim2.p[LV.sides[0].axle*3+2]], axR: [sim2.p[LV.sides[1].axle*3], sim2.p[LV.sides[1].axle*3+1], sim2.p[LV.sides[1].axle*3+2]],
    tw: [sim2.p[R.tw*3], sim2.p[R.tw*3+1], sim2.p[R.tw*3+2]] }); }
fs.writeFileSync(__dirname + '/rough.json', JSON.stringify({ A, lam, Vs, S: LV.sides[0].O.S, rec }));
const pk = rec.reduce((a, r) => Math.max(a, r.sL, r.sR), 0); console.log('Vs', Vs.toFixed(1), 'peak stroke', (pk*1000).toFixed(0), 'mm of', (LV.sides[0].O.S*1000).toFixed(0), 'bad', sim2.stats().bad);
console.log(rec.filter((r, i) => i % 10 === 0).map(r => r.t.toFixed(2) + ':' + (r.sL*1000).toFixed(0) + '/' + (r.sR*1000).toFixed(0)).join(' '));
