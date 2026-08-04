import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as B120 from '../engine/l1/physics.js';
import * as B480 from '../engine/l1/_zphys_480.js';
import * as F120 from '../engine/l1/_zfix_120.js';
import * as F480 from '../engine/l1/_zfix_480.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = 8;
const corpus = [];
for (let i = 0; corpus.length < N && i < N*12; i++) {
  const g = createRandomGenome(rngFrom('decay','corpus',i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({genome:g, plan:v.plan, idx:i});
}
function coast(M,plan,genome){
  const sim=M.createSimulation(RAPIER,plan,genome,W1_SLICE,{bounded:false,wrap:true,effort:0,turnBias:0});
  for(let s=0;s<Math.round(3/M.FIXED_DT);s++)sim.step();
  sim.resetClock(); sim.control.effort=0;
  for(const rb of sim.bodies) rb.setLinvel({x:5,y:0,z:0},true);
  const p=sim.bodies[0].translation(); const s0={x:p.x,y:p.y,z:p.z};
  for(let s=0;s<Math.round(6/M.FIXED_DT);s++)sim.step();
  const q=sim.bodies[0].translation();
  const d=Math.hypot(q.x-s0.x,q.y-s0.y,q.z-s0.z); sim.free(); return d;
}
const med=(a)=>{const b=a.filter(Number.isFinite).slice().sort((x,y)=>x-y);return b.length?b[b.length>>1]:NaN;};
const pct=(a,t)=>a.filter(x=>Math.abs(x-1)<=t).length/a.length;
console.log('PASSIVE COAST — distance ratio, dt 1/480 vs 1/120');
for (const [lbl,A,Bm] of [['baseline',B120,B480],['FIXED   ',F120,F480]]) {
  const r=corpus.map(({plan,genome})=>coast(Bm,plan,genome)/coast(A,plan,genome));
  console.log(`  ${lbl}  median ${med(r).toFixed(3)}   within10% ${(pct(r,0.10)*100).toFixed(0)}%   within20% ${(pct(r,0.20)*100).toFixed(0)}%`);
  console.log(`            per-creature: ${r.map(x=>x.toFixed(2)).join(' ')}`);
}
