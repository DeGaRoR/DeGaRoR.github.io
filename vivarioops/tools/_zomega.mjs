// _zomega.mjs — the fluid force is sampled ONCE PER STEP from the LOCAL velocity
// v + omega x r. On a fast-flapping limb that local velocity turns over within a
// step. If the dt-sensitivity is fluid SAMPLING, it must scale with gait speed:
// slow the CPG and the fine/coarse ratio must move toward 1.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as C from '../engine/l1/physics.js';
import * as F from '../engine/l1/_zphys_480.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = 5, SECS = 25;
const base = [];
for (let i=0; base.length<N && i<N*12; i++) {
  const g = createRandomGenome(rngFrom('decay','corpus',i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) base.push({genome:g, plan:v.plan, idx:i});
}
function swim(M, plan, genome, secs) {
  const sim = M.createSimulation(RAPIER, plan, genome, W1_SLICE, {bounded:false,wrap:true,effort:0,turnBias:0});
  for (let s=0;s<Math.round(3/M.FIXED_DT);s++) sim.step();
  sim.resetClock(); sim.control.effort = 1;
  const steps = Math.round(secs/M.FIXED_DT), smp = Math.max(1, Math.round(0.25/M.FIXED_DT));
  let prev=null, dist=0, wmax=0;
  for (let s=0;s<steps;s++){ sim.step();
    for (const rb of sim.bodies){ const a=rb.angvel(); const m=Math.hypot(a.x,a.y,a.z); if(m>wmax) wmax=m; }
    if (s%smp===0){ const c=sim.bodies[0].translation();
      if(prev) dist+=Math.hypot(c.x-prev.x,c.y-prev.y,c.z-prev.z);
      prev={x:c.x,y:c.y,z:c.z}; } }
  sim.free(); return { speed: dist/secs, wmax };
}
const med=(a)=>a.slice().sort((x,y)=>x-y)[a.length>>1];
console.log('omega scale   median |omega|max   median speed(1/120)   ratio fine/coarse');
for (const k of [1, 0.25]) {
  const rs = [], ws = [], ss = [];
  for (const {genome, plan} of base) {
    const g2 = JSON.parse(JSON.stringify(genome));
    g2.controller.omega = genome.controller.omega * k;
    // keep the same number of gait cycles so the comparison is like-for-like
    const secs = SECS / k;
    const a = swim(C, plan, g2, secs), b = swim(F, plan, g2, secs);
    rs.push(b.speed/a.speed); ws.push(a.wmax); ss.push(a.speed);
  }
  console.log(`${String(k).padStart(9)}     ${med(ws).toFixed(3).padStart(9)}          ${med(ss).toFixed(4).padStart(8)}            ${med(rs).toFixed(3)}`);
}
