// HONEST PURSUIT: sweep the target's BEARING, in the bend plane.
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import { GENOME_V } from '../contracts/versions.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const W={...W1_SLICE,gravity:0}, wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function chain(segs,omega=4,lag=Math.PI/2){return{version:GENOME_V,seed:0,rootNodeId:'seg',
 nodes:[{id:'seg',dims:[0.5,0.35,1.2],density:1,recursiveLimit:segs,
  joint:{type:'revolute',angleLimits:[0.9,0.9,0.9],phaseLag:lag},colorGenes:{hueShift:0,valueShift:0,patternPhase:0}}],
 connections:[{id:'c_self',parentNodeId:'seg',childNodeId:'seg',parentFace:5,position:[0,0],orientation:[0,0,0],
  scale:[0.95,0.95,0.95],reflectX:false,reflectY:false,reflectZ:false,terminalOnly:false}],
 material:{hue:.5,hueVariance:.08,patternScale:3,patternContrast:.4,stripeAnisotropy:.7,iridescence:.15},
 controller:{omega,preyGain:0,threatGain:0,jointGenes:{seg:{amplitude:0.8,bias:0,freqMult:1}}},
 social:{trophic:.4,boldness:.5,cohesion:.3,separation:.5,alignment:.4,separationRadius:1.5}};}
function pursue(g,opts,bearingDeg,R=6,SEC=60,kp=2/Math.PI){
 const plan=morphogenesis(g); let sim;
 try{sim=createSimulation(RAPIER,plan,g,W,{drive:DRIVE.POSITION,bounded:false,...opts});}catch(e){return{err:e.message};}
 const c0=sim.centreOfMass(), th=bearingDeg*Math.PI/180;
 // bend plane is (z,y): z is the swim axis, y is lateral IN THAT PLANE
 const target=[c0[0], c0[1]+R*Math.sin(th), c0[2]+R*Math.cos(th)];
 let best=R,bad=false,prev=c0,va=0,vb=0;
 try{for(let s=0;s<Math.round(SEC/FIXED_DT);s++){
  const c=sim.centreOfMass(); if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
  va=0.98*va+0.02*(c[2]-prev[2]); vb=0.98*vb+0.02*(c[1]-prev[1]);
  const ta=target[2]-c[2], tb=target[1]-c[1];
  if(Math.hypot(va,vb)>1e-7&&Math.hypot(ta,tb)>1e-4)
    sim.control.turnBias=Math.max(-1,Math.min(1,kp*wrap(Math.atan2(tb,ta)-Math.atan2(vb,va))));
  prev=c; const d=Math.hypot(target[0]-c[0],target[1]-c[1],target[2]-c[2]); if(d<best)best=d;
  sim.step();}}catch{bad=true;}
 sim.free(); return bad?{err:'diverged'}:{best};
}
const BEAR=[0,30,60,90,135,180];
console.log('\n  closest approach (m) to a 6 m target, by target bearing in the BEND plane\n');
console.log('  body / actuator            ' + BEAR.map(b=>String(b+'deg').padStart(9)).join(''));
for (const [lbl,segs,opts] of [
  ['7-seg  solver',6,{motor:'solver'}],
  ['7-seg  solver 10Hz',6,{motor:'solver',motorFreqHz:10}],
  ['13-seg solver (illegal)',12,{motor:'solver'}],
  ['13-seg solver 10Hz',12,{motor:'solver',motorFreqHz:10}],
]) {
  const g=chain(segs);
  const row=BEAR.map(b=>{const r=pursue(g,opts,b); return r.err?'  '+r.err:r.best.toFixed(2).padStart(9);});
  console.log(`  ${lbl.padEnd(25)}` + row.join(''));
}
console.log('\n  0 deg = target dead ahead. Anything that only reaches the 0 deg column');
console.log('  is swimming straight, not steering.\n');
