// IS `benefit` A MEASUREMENT OR A COIN FLIP?
//
// The control arm matched the selected arm, so the rising median is the harness.
// Before blaming the harness, check the metric: if `benefit` moves as much when
// the SAME genome is re-measured with a different set of target bearings as it
// does between different genomes, then selection has been ranking noise and no
// harness could have helped.
//
// Signal-to-noise, stated properly:
//   within  = sd of benefit for one genome across bearing offsets
//   between = sd of benefit across genomes
// Selection needs between >> within.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE, sensorTurnBias } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const W={...W1_SLICE,gravity:0}, MOTOR={motor:'solver'};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const nrm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sd=v=>{const m=v.reduce((a,b)=>a+b,0)/v.length;return Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length);};
const AX=8, SK=15;
function axisRun(plan,g,tb){let sim;try{sim=createSimulation(RAPIER,plan,g,W,{drive:DRIVE.POSITION,bounded:false,turnBias:tb,...MOTOR});}catch{return null;}
 const mk=[];let bad=false;
 try{for(let s=0;s<Math.round(AX/FIXED_DT);s++){sim.step();const c=sim.centreOfMass();
  if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;} if(s%60===0)mk.push([...c]);}}catch{bad=true;}
 const c1=sim.centreOfMass();sim.free(); if(bad||mk.length<4)return null;
 const v=[];for(let i=1;i<mk.length;i++){const d=[mk[i][0]-mk[i-1][0],mk[i][1]-mk[i-1][1],mk[i][2]-mk[i-1][2]];
  if(Math.hypot(...d)>1e-5)v.push(nrm(d));}
 let ax=[0,0,0];for(let i=1;i<v.length;i++){const c=cross(v[i-1],v[i]);ax=[ax[0]+c[0],ax[1]+c[1],ax[2]+c[2]];}
 return {axis:nrm(ax),speed:Math.hypot(c1[0]-mk[0][0],c1[1]-mk[0][1],c1[2]-mk[0][2])/AX};}
function profile(plan,g){const p=axisRun(plan,g,1),m=axisRun(plan,g,-1);if(!p||!m)return null;
 const d=[p.axis[0]-m.axis[0],p.axis[1]-m.axis[1],p.axis[2]-m.axis[2]],mag=Math.hypot(...d);
 const axis=mag>1e-6?nrm(d):[0,1,0],sd0=Math.abs(axis[0])<0.9?[1,0,0]:[0,1,0];
 const u=nrm(cross(axis,sd0));return{basis:[u,nrm(cross(axis,u))],authority:mag/2,speed:(p.speed+m.speed)/2};}
function seek(plan,g,pr,ov,bearings){const R=Math.max(1,Math.min(8,pr.speed*SK*0.6));const[U,V]=pr.basis;const sc=[];
 for(const deg of bearings){let sim;try{sim=createSimulation(RAPIER,plan,g,W,{drive:DRIVE.POSITION,bounded:false,...MOTOR});}catch{return null;}
  const c0=sim.centreOfMass(),th=deg*Math.PI/180;
  const t=[0,1,2].map(i=>c0[i]+R*(Math.cos(th)*U[i]+Math.sin(th)*V[i]));
  let best=R,bad=false,prev=c0,va=0,vb=0;
  try{for(let s=0;s<Math.round(SK/FIXED_DT);s++){const c=sim.centreOfMass();
   if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
   const dv=[c[0]-prev[0],c[1]-prev[1],c[2]-prev[2]];
   va=0.98*va+0.02*dot(dv,U);vb=0.98*vb+0.02*dot(dv,V);
   const td=[t[0]-c[0],t[1]-c[1],t[2]-c[2]],ta=dot(td,U),tb=dot(td,V);
   if(Math.hypot(va,vb)>1e-7&&Math.hypot(ta,tb)>1e-4){
     const br=wrap(Math.atan2(tb,ta)-Math.atan2(vb,va))/Math.PI;
     sim.control.turnBias=ov===null?sensorTurnBias(g,br,br):Math.max(-1,Math.min(1,ov*br));}
   prev=c;const d=Math.hypot(t[0]-c[0],t[1]-c[1],t[2]-c[2]);if(d<best)best=d;sim.step();}}catch{bad=true;}
  sim.free();if(bad)return null;sc.push(Math.max(0,(R-best)/R));}
 return sc.reduce((a,b)=>a+b,0)/sc.length;}

const OFFSETS=[0,20,40,60,80];
const pop=[];
for(let i=0;pop.length<10&&i<120;i++){const g=createRandomGenome(rngFrom('noise',i));
 let p;try{p=morphogenesis(g);}catch{continue;} if(p.jointCount>=1)pop.push({g,p});}
console.log('\n  the SAME genome, benefit measured with the bearing set rotated\n');
console.log('  creature   ' + OFFSETS.map(o=>String(o+'deg').padStart(9)).join('') + '      within-sd');
const means=[],withins=[];
for(let i=0;i<pop.length;i++){
  const {g,p}=pop[i]; const pr=profile(p,g); if(!pr||!(pr.speed>1e-4))continue;
  const v=OFFSETS.map(o=>{const b=[0,90,180,270].map(x=>x+o);
    const L=seek(p,g,pr,null,b),D=seek(p,g,pr,0,b); return (L===null||D===null)?NaN:L-D;});
  if(v.some(x=>!Number.isFinite(x)))continue;
  const m=v.reduce((a,b)=>a+b,0)/v.length;
  means.push(m); withins.push(sd(v));
  console.log(`  ${String(i).padEnd(9)}  ` + v.map(x=>x.toFixed(3).padStart(9)).join('') + `      ${sd(v).toFixed(3)}`);
}
const within=withins.reduce((a,b)=>a+b,0)/withins.length, between=sd(means);
console.log(`\n  within-creature  sd (measurement noise)  ${within.toFixed(4)}`);
console.log(`  between-creature sd (the signal)         ${between.toFixed(4)}`);
console.log(`  SIGNAL / NOISE                           ${(between/within).toFixed(2)}`);
console.log('\n  Selection needs this comfortably above 1. Below it, a fitter creature');
console.log('  and a luckier one are indistinguishable and the run ranks noise.\n');
