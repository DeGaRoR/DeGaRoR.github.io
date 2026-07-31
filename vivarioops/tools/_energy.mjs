// Do we already penalise frenetic movement? `work` is accumulated as
// sum |tau . domega| dt. Cost of transport (CoT = work / (mass * distance)) is
// the standard biological measure — dimensionless, comparable across sizes, and
// what real animals are optimised for. Salmon ~0.5, human swimmer ~10.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SEC=15, STEPS=Math.round(SEC/FIXED_DT), W={...W1_SLICE, gravity:0};
const corpus=[];
for(let i=0;corpus.length<50&&i<400;i++){const g=createRandomGenome(rngFrom(0xC0DE^(i*2654435761)));
  const p=morphogenesis(g); if(p.jointCount>=1)corpus.push({g,p});}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
const rank=a=>{const i=a.map((v,k)=>[v,k]).sort((x,y)=>x[0]-y[0]);const r=[];i.forEach(([,k],j)=>r[k]=j);return r;};
const spear=(a,b)=>{const ra=rank(a),rb=rank(b),n=a.length,m=(n-1)/2;let u=0,x=0,y=0;
  for(let i=0;i<n;i++){u+=(ra[i]-m)*(rb[i]-m);x+=(ra[i]-m)**2;y+=(rb[i]-m)**2;}return u/Math.sqrt(x*y);};
const rows=[];
for(const{g,p}of corpus){
  let sim;try{sim=createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false});}catch{continue;}
  let mass=0; for(const rb of sim.bodies) mass+=rb.mass();
  const c0=sim.centreOfMass();let prev=c0,path=0,bad=false;
  try{for(let s=0;s<STEPS;s++){sim.step();const c=sim.centreOfMass();
    if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
    path+=Math.hypot(c[0]-prev[0],c[1]-prev[1],c[2]-prev[2]);prev=c;}}catch{bad=true;}
  const c1=sim.centreOfMass();const work=sim.work;sim.free();if(bad)continue;
  const net=Math.hypot(c1[0]-c0[0],c1[1]-c0[1],c1[2]-c0[2]);
  if(!Number.isFinite(work)||!Number.isFinite(net))continue;
  rows.push({work, mass, net, path, eff:net/Math.max(path,1e-9),
             cot: work/Math.max(mass*net,1e-9), power: work/SEC});
}
console.log(`\nn=${rows.length}, ${SEC}s\n`);
const q=f=>rows.map(f);
console.log(`  work (J)             p10 ${pct(q(r=>r.work),0.1).toFixed(0)}  p50 ${pct(q(r=>r.work),0.5).toFixed(0)}  p90 ${pct(q(r=>r.work),0.9).toFixed(0)}`);
console.log(`  power (J/s)          p10 ${pct(q(r=>r.power),0.1).toFixed(1)}  p50 ${pct(q(r=>r.power),0.5).toFixed(1)}  p90 ${pct(q(r=>r.power),0.9).toFixed(1)}`);
console.log(`  COST OF TRANSPORT    p10 ${pct(q(r=>r.cot),0.1).toFixed(0)}  p50 ${pct(q(r=>r.cot),0.5).toFixed(0)}  p90 ${pct(q(r=>r.cot),0.9).toFixed(0)}   (salmon ~0.5, human swimmer ~10)`);
console.log(`\n  rho(efficiency, cost of transport)  ${spear(q(r=>r.eff), q(r=>r.cot)).toFixed(2)}   (negative = frenzy already costs more)`);
console.log(`  rho(COM path, work)                 ${spear(q(r=>r.path), q(r=>r.work)).toFixed(2)}`);
console.log(`  rho(net distance, work)             ${spear(q(r=>r.net), q(r=>r.work)).toFixed(2)}`);
const good=rows.filter(r=>r.eff>0.05), bad2=rows.filter(r=>r.eff<0.02);
console.log(`\n  efficient (eff>0.05) n=${good.length}: CoT p50 ${good.length?pct(good.map(r=>r.cot),0.5).toFixed(0):'-'}   power p50 ${good.length?pct(good.map(r=>r.power),0.5).toFixed(1):'-'} J/s`);
console.log(`  frenetic  (eff<0.02) n=${bad2.length}: CoT p50 ${bad2.length?pct(bad2.map(r=>r.cot),0.5).toFixed(0):'-'}   power p50 ${bad2.length?pct(bad2.map(r=>r.power),0.5).toFixed(1):'-'} J/s`);
