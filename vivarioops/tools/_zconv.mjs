// _zconv.mjs — timestep convergence. A converged simulation gives the same
// cruise speed at dt/2. If speed falls with dt, the swimming is numerical.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as M120 from '../engine/l1/physics.js';
import * as M240 from '../engine/l1/_zphys_240.js';
import * as M480 from '../engine/l1/_zphys_480.js';
import * as M960 from '../engine/l1/_zphys_960.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const MODS = [['1/120', M120], ['1/240', M240], ['1/480', M480], ['1/960', M960]];
const SECONDS = 100, N = 6;
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 12; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan, idx: i });
}
function run(M, plan, genome) {
  const sim = M.createSimulation(RAPIER, plan, genome, W1_SLICE,
    { bounded: false, wrap: true, effort: 0, turnBias: 0 });
  for (let s = 0; s < Math.round(3 / M.FIXED_DT); s++) sim.step();
  sim.resetClock(); sim.control.effort = 1;
  const steps = Math.round(SECONDS / M.FIXED_DT);
  const smp = Math.max(1, Math.round(0.25 / M.FIXED_DT));
  let ke = 0, n = 0, spd = 0, sn = 0, prev = null, dist = 0;
  const p0 = sim.bodies[0].translation(); const start = { x: p0.x, y: p0.y, z: p0.z };
  for (let s = 0; s < steps; s++) {
    sim.step();
    if (s % smp === 0) {
      const frac = s / steps;
      const c = sim.bodies[0].translation();
      if (prev) dist += Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z);
      prev = { x: c.x, y: c.y, z: c.z };
      if (frac > 0.5) {
        let e = 0; for (const rb of sim.bodies) { const v = rb.linvel(); e += 0.5 * rb.mass() * (v.x*v.x+v.y*v.y+v.z*v.z); }
        ke += e; n++;
      }
    }
  }
  const end = sim.bodies[0].translation();
  const net = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
  const w = sim.work;
  sim.free();
  return { ke: ke / n, path: dist / SECONDS, net: net / SECONDS, work: w };
}
const f = (x) => (Number.isFinite(x) ? x.toExponential(2).padStart(9) : '      n/a');
for (const { genome, plan, idx } of corpus) {
  console.log(`\ncreature ${idx}, J=${plan.jointCount}`);
  console.log('   dt      cruiseKE   pathSpeed   netSpeed      work');
  let prevKE = null;
  for (const [lbl, M] of MODS) {
    const r = run(M, plan, genome);
    const conv = prevKE ? ` (x${(r.ke / prevKE).toFixed(2)})` : '';
    console.log(` ${lbl.padStart(6)}  ${f(r.ke)}  ${f(r.path)}  ${f(r.net)}  ${f(r.work)}${conv}`);
    prevKE = r.ke;
  }
}
