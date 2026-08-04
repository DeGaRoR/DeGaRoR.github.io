const { buildCub, makeSim, makeWorld } = require('./flight_core.js');
const world = makeWorld();
const def = buildCub();
const sim = makeSim(def, world);
sim.reset(0);
// teleport in front of a tree on open terrain, drive into it.
// W7: the warped terrain made the old "first tree in the height band"
// pick fragile — the Cub veered off a sloped run-up and missed the
// trunk. Require a fat trunk on locally flat ground with a level
// 25 m approach line.
const T = world.trees.find(t => {
  if (!(t.h > 4 && t.h < 40 && t.s > 1.2)) return false;
  const h0 = world.terrainH(t.x, t.z);
  const hA = world.terrainH(t.x + 25, t.z);
  const hS = world.terrainH(t.x, t.z + 12);
  return Math.abs(hA - h0) < 1.0 && Math.abs(hS - h0) < 1.0;
});
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
