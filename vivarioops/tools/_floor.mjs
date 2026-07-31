import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const W={...W1_SLICE,gravity:0};
console.log('\n  random corpus: does it move enough to score on a 6 m target in 30 s?\n');
console.log('  id      preyG threatG   net m/s   travel in 30s   reaches 6m?');
let n=0, reach=0;
for (let i=0;i<14;i++){
  const g=createRandomGenome(rngFrom(0x57EE ^ (i*2654435761)));
  let p; try{p=morphogenesis(g);}catch{continue;}
  if(p.jointCount<1)continue;
  let sim; try{sim=createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false,motor:'solver'});}catch{continue;}
  const c0=sim.centreOfMass(); let bad=false;
  try{for(let s=0;s<Math.round(30/FIXED_DT);s++){sim.step();
    const c=sim.centreOfMass(); if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}}}catch{bad=true;}
  const c1=sim.centreOfMass(); sim.free(); if(bad)continue;
  const d=Math.hypot(c1[0]-c0[0],c1[1]-c0[1],c1[2]-c0[2]);
  n++; if(d>=6)reach++;
  console.log(`  rand${String(i).padEnd(3)} ${g.controller.preyGain.toFixed(2).padStart(6)} ${g.controller.threatGain.toFixed(2).padStart(7)}   ${(d/30).toFixed(4).padStart(7)}   ${d.toFixed(2).padStart(11)} m   ${d>=6?'yes':'NO'}`);
}
console.log(`\n  ${reach}/${n} random creatures can travel 6 m in 30 s at all.`);
console.log('  A creature that cannot reach the target scores 0 whatever its sensor does,');
console.log('  so the objective cannot rank it — and it cannot rank its offspring either.\n');
