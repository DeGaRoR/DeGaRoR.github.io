// IS THE PD SATURATING INTO A RELAY? A bang-bang controller limit-cycles.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SEC=10, STEPS=Math.round(SEC/FIXED_DT), W={...W1_SLICE, gravity:0};
const corpus=[];
for(let i=0;corpus.length<25&&i<200;i++){const g=createRandomGenome(rngFrom(0xC0DE^(i*2654435761)));
  const p=morphogenesis(g); if(p.jointCount>=1)corpus.push({g,p});}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
console.log('\n stiffness damping   saturated   peak|omega|   COM path   net speed   EFFICIENCY  persist');
for (const [ks,kd] of [[1,0.12],[0.1,0.12],[0.01,0.12],[0.1,1.0],[0.01,1.0],[0.003,2.0]]) {
  const sat=[],spin=[],com=[],net=[],eff=[],per=[];
  for(const{g,p}of corpus){
    let sim;try{sim=createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false,stiffness:ks,damping:kd});}catch{continue;}
    const c0=sim.centreOfMass();let prev=c0,path=0,peak=0,bad=false;const marks=[];
    try{for(let s=0;s<STEPS;s++){sim.step();const c=sim.centreOfMass();
      if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
      path+=Math.hypot(c[0]-prev[0],c[1]-prev[1],c[2]-prev[2]);prev=c;
      if(s%120===0)marks.push([...c]);
      for(const rb of sim.bodies){const a=rb.angvel();const q=Math.hypot(a.x,a.y,a.z);if(q>peak)peak=q;}}}catch{bad=true;}
    const c1=sim.centreOfMass();const sa=sim.saturation;sim.free();if(bad)continue;
    const nd=Math.hypot(c1[0]-c0[0],c1[1]-c0[1],c1[2]-c0[2]);
    let cs=0,k=0;
    for(let i=2;i<marks.length;i++){const a=[marks[i-1][0]-marks[i-2][0],marks[i-1][1]-marks[i-2][1],marks[i-1][2]-marks[i-2][2]];
      const b=[marks[i][0]-marks[i-1][0],marks[i][1]-marks[i-1][1],marks[i][2]-marks[i-1][2]];
      const na=Math.hypot(...a),nb=Math.hypot(...b);
      if(na>1e-6&&nb>1e-6){cs+=(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(na*nb);k++;}}
    sat.push(sa);spin.push(peak);com.push(path/SEC);net.push(nd/SEC);eff.push(nd/Math.max(path,1e-9));per.push(k?cs/k:0);
  }
  console.log(` ${String(ks).padEnd(9)} ${String(kd).padEnd(8)} ${(pct(sat,0.5)*100).toFixed(0).padStart(8)}%  ${pct(spin,0.5).toFixed(1).padStart(11)}   ${pct(com,0.5).toFixed(2).padStart(8)}   ${pct(net,0.5).toFixed(3).padStart(9)}   ${pct(eff,0.5).toFixed(3).padStart(10)}  ${pct(per,0.5).toFixed(2).padStart(7)}`);
}
