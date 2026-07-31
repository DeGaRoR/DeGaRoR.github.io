// Does turnBias work when the body is actually BILATERAL?
// turnSides() gives mirrored joint instances +turnBias and non-mirrored -bias.
// That is a differential deflection and it presupposes a left and a right. A
// random tangle usually has neither, which would explain 3% monotonicity.
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import { GENOME_V } from '../contracts/versions.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SEC=12, STEPS=Math.round(SEC/FIXED_DT), W={...W1_SLICE, gravity:0};
const MOTOR='solver';

function serpent({ segs=3, lag=Math.PI/2, amp=0.9, omega=2.0, finReflect=true } = {}) {
  const nodes=[{ id:'seg', dims:[1.2,0.5,0.35], density:1, recursiveLimit:segs,
    joint:{type:'revolute', angleLimits:[0.9,0.9,0.9], phaseLag:lag},
    colorGenes:{hueShift:.5,valueShift:0,patternPhase:0} },
    { id:'fin', dims:[0.5,0.25,1.1], density:1, recursiveLimit:1,
    joint:{type:'revolute', angleLimits:[0.8,0.8,0.8], phaseLag:0},
    colorGenes:{hueShift:.6,valueShift:0,patternPhase:0} }];
  const connections=[{ id:'c_self', parentNodeId:'seg', childNodeId:'seg', parentFace:0,
    position:[0,0], orientation:[0,0,0], scale:[0.9,0.9,0.9],
    reflectX:false, reflectY:false, reflectZ:false, terminalOnly:false },
    // PAIRED LATERAL FINS: reflectZ makes a genuine left and right.
    { id:'c_fin', parentNodeId:'seg', childNodeId:'fin', parentFace:4,
    position:[0,0], orientation:[0,0,0], scale:[1,1,1],
    reflectX:false, reflectY:false, reflectZ:finReflect, terminalOnly:false }];
  return { version:GENOME_V, seed:0, rootNodeId:'seg', nodes, connections,
    material:{hueShift:.5,valueShift:0,patternPhase:0},
    controller:{ omega, preyGain:0, threatGain:0,
      jointGenes:{ seg:{amplitude:amp,bias:0,freqMult:1}, fin:{amplitude:amp,bias:0,freqMult:1} } },
    social:{} };
}
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function heading(g,p,turn){
  let sim;try{sim=createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false,motor:MOTOR,turnBias:turn});}catch{return null;}
  const c0=sim.centreOfMass();let bad=false;
  try{for(let s=0;s<STEPS;s++){sim.step();const c=sim.centreOfMass();
    if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}}}catch{bad=true;}
  const c1=sim.centreOfMass();sim.free();if(bad)return null;
  const dx=c1[0]-c0[0],dz=c1[2]-c0[2];
  if(Math.hypot(dx,dz)<1e-4)return null;
  return {ang:Math.atan2(dz,dx), dist:Math.hypot(dx,c1[1]-c0[1],dz)};
}
const BIAS=[-1,-0.5,0,0.5,1];
console.log(`\nmotor='${MOTOR}', ${SEC}s\n`);
console.log('  design                          bodies   turn response by turnBias (deg, relative to 0)      monotone?');
for (const [label,o] of [
  ['bilateral fins (reflectZ)',   {}],
  ['bilateral, lag pi/3',         { lag: Math.PI/3 }],
  ['bilateral, omega 3',          { omega: 3 }],
  ['NO reflection (asymmetric)',  { finReflect: false }],
]) {
  const g=serpent(o); let p; try{p=morphogenesis(g);}catch(e){console.log(`  ${label} ERR ${e.message}`);continue;}
  const hs=BIAS.map(b=>heading(g,p,b));
  if(hs.some(h=>!h)){console.log(`  ${label.padEnd(30)} ${String(p.bodyCount).padStart(5)}   (insufficient travel to read a heading)`);continue;}
  const rel=hs.map(h=>wrap(h.ang-hs[2].ang)*180/Math.PI);
  let up=true,down=true;
  for(let i=1;i<rel.length;i++){if(rel[i]<rel[i-1])up=false;if(rel[i]>rel[i-1])down=false;}
  console.log(`  ${label.padEnd(30)} ${String(p.bodyCount).padStart(5)}   ${rel.map(v=>v.toFixed(0).padStart(6)).join(' ')}      ${(up||down)?'YES':'no'}`);
}
