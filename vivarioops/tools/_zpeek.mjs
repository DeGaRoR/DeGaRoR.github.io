import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_SLICE } from '../worlds/w1_slice.js';
await RAPIER.init();
const TANK = { ...W1_SLICE, tankBounds:[10,15,10] };
const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function eff(g, scale){
  const gg=structuredClone(g); for(const n of gg.nodes) n.dims=n.dims.map(x=>x*scale);
  let p; try{p=morphogenesis(gg);}catch{return null;}
  const sim=createSimulation(RAPIER,p,gg,TANK,{bounded:true,effort:1,turnBias:0});
  for(let k=0;k<Math.round(2/FIXED_DT);k++)sim.step();
  const c0=sim.centreOfMass(); let prev=c0,path=0,ms=0;
  for(let k=0;k<Math.round(15/FIXED_DT);k++){sim.step();const c=sim.centreOfMass();path+=d(c,prev);prev=c;for(const b of sim.bodies){const v=b.linvel();ms=Math.max(ms,Math.hypot(v.x,v.y,v.z));}}
  const net=d(sim.centreOfMass(),c0); sim.free();
  return {net,path,eff:path>1e-6?net/path:0,ms};
}
console.log('\n  EFFICIENCY (net/path) = is it swimming (0.3+) or thrashing (0.02)?\n');
console.log('  id            scale0.5 eff   scale1.0 eff');
for(const sd of SEEDS){ if(sd.id==='staircase')continue; const g=sd.genome??sd;
  const a=eff(g,0.5), b=eff(g,1); if(!a||!b)continue;
  console.log(`  ${sd.id.padEnd(12)} ${a.eff.toFixed(3).padStart(9)} (${a.ms.toFixed(1)}m/s)  ${b.eff.toFixed(3).padStart(9)} (${b.ms.toFixed(1)}m/s)`);
}
