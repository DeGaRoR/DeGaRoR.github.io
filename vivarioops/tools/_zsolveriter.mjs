// _zsolver.mjs — is the non-convergence in the JOINT SOLVER? If raising
// SOLVER_ITERATIONS at dt=1/120 moves speed toward the fine-dt answer, then the
// defect is solver convergence and the fluid is not involved at all.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as I8   from '../engine/l1/physics.js';
import * as I16  from '../engine/l1/_zit_16.js';
import * as I32  from '../engine/l1/_zit_32.js';
import * as I64  from '../engine/l1/_zit_64.js';
import * as I128 from '../engine/l1/_zit_128.js';
import * as F480 from '../engine/l1/_zphys_480.js';   // 8 iters, dt=1/480
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = 8, SECS = 60;
const corpus = [];
for (let i=0; corpus.length<N && i<N*12; i++) {
  const g = createRandomGenome(rngFrom('decay','corpus',i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({genome:g, plan:v.plan, idx:i});
}
function swim(M, plan, genome) {
  const sim = M.createSimulation(RAPIER, plan, genome, W1_SLICE, {bounded:false,wrap:true,effort:0,turnBias:0});
  for (let s=0;s<Math.round(3/M.FIXED_DT);s++) sim.step();
  sim.resetClock(); sim.control.effort = 1;
  const steps = Math.round(SECS/M.FIXED_DT), smp = Math.max(1, Math.round(0.25/M.FIXED_DT));
  let prev=null, dist=0;
  for (let s=0;s<steps;s++){ sim.step();
    if (s%smp===0){ const c=sim.bodies[0].translation();
      if(prev) dist+=Math.hypot(c.x-prev.x,c.y-prev.y,c.z-prev.z);
      prev={x:c.x,y:c.y,z:c.z}; } }
  sim.free(); return dist/SECS;
}
const ARMS = [['dt=1/120  it=8  (shipped)',I8],['dt=1/120  it=16',I16],['dt=1/120  it=32',I32],
              ['dt=1/120  it=64',I64],['dt=1/120  it=128',I128],['dt=1/480  it=8  (reference)',F480]];
const res = ARMS.map(([lbl,M]) => [lbl, corpus.map(({plan,genome})=>swim(M,plan,genome))]);
const med=(a)=>a.slice().sort((x,y)=>x-y)[a.length>>1];
const ref = med(res[res.length-1][1]);
console.log('arm                            median speed   ratio to fine-dt reference');
for (const [lbl,v] of res) console.log(`${lbl.padEnd(30)} ${med(v).toFixed(4).padStart(8)}        ${(med(v)/ref).toFixed(3)}`);
console.log('\nper-creature (it=8 / it=128 / dt1/480):');
corpus.forEach((c,i)=>console.log(`  #${String(c.idx).padStart(2)}  ${res[0][1][i].toFixed(4)}  ${res[4][1][i].toFixed(4)}  ${res[5][1][i].toFixed(4)}`));
