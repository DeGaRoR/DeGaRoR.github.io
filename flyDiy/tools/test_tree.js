const { buildCub, makeSim, makeWorld } = require('./flight_core.js');
const world = makeWorld();
const def = buildCub();
const sim = makeSim(def, world);
sim.reset(0);
// teleport in front of a tree on open terrain, drive into it
const T = world.trees.find(t => t.h > 4 && t.h < 40);
const dy = world.terrainH(T.x + 25, T.z) - 0;
for (let i = 0; i < sim.n; i++) {
  sim.p[i*3] += T.x + 25; sim.p[i*3+1] += world.terrainH(sim.p[i*3], T.z);
  sim.p[i*3+2] += T.z;
}
sim.ctl.thr = 0.7;
for (let s = 0; s < 12*60; s++) sim.step(1/60);
const st = sim.stats(), cg = sim.cgPos();
const travelled = (T.x + 25) - cg[0];
console.log(`tree at 25 m: travelled=${travelled.toFixed(1)} m  V=${sim.out.V.toFixed(1)}  strain=${(st.smax*100).toFixed(0)}%  NaN=${st.bad}`);
const pass = !st.bad && sim.out.V < 12 && travelled < 60;
console.log(pass ? 'GATE TREE: PASS' : 'GATE TREE: FAIL');
process.exitCode = pass ? 0 : 1;
