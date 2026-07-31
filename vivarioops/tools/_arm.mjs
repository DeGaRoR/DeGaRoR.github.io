// Sweep the moment-arm fraction: travel, sustained body speed, and how many
// creatures survive. The full joint radius (1.0) assumes a rim insertion;
// vertebrate tendons sit at 0.1-0.3.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = Number(process.argv[2] ?? 40), STEPS = Math.round(15 / FIXED_DT);
const W = { ...W1_SLICE, gravity: 0 };
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 8; i++) {
  const g = createRandomGenome(rngFrom(0xC0DE ^ (i * 2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 1) corpus.push({ g, p });
}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
const rank=a=>{const i=a.map((v,k)=>[v,k]).sort((x,y)=>x[0]-y[0]);const r=[];i.forEach(([,k],j)=>r[k]=j);return r;};
const spear=(a,b)=>{const ra=rank(a),rb=rank(b),n=a.length,m=(n-1)/2;let u=0,x=0,y=0;
  for(let i=0;i<n;i++){u+=(ra[i]-m)*(rb[i]-m);x+=(ra[i]-m)**2;y+=(rb[i]-m)**2;}return u/Math.sqrt(x*y);};
const shape = corpus.map(({p})=>{let area=0,asp=1;
  for(const b of p.bodies){const[x,y,z]=b.dims;area+=2*(x*y+y*z+z*x);asp=Math.max(asp,Math.max(x,y,z)/Math.min(x,y,z));}return{area,asp};});
console.log('\n  arm    n_ok  div   travel p50   body speed p50   max speed   rho(area) rho(asp)');
for (const arm of [1.0, 0.5, 0.2, 0.1, 0.05]) {
  const travel=[], sp=[], sh=[]; let div=0, mx=0;
  corpus.forEach(({g,p},idx)=>{
    let sim; try{sim=createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false,torqueModel:'stress',momentArm:arm});}catch{div++;return;}
    const c0=sim.centreOfMass(); let bad=false; const samples=[];
    try{for(let s=0;s<STEPS;s++){sim.step();
      if(s%12===0){let m=0;for(const rb of sim.bodies){const v=rb.linvel();const q=Math.hypot(v.x,v.y,v.z);
        if(!Number.isFinite(q)||q>1000){bad=true;break;} if(q>m)m=q;}
        if(bad)break; samples.push(m); if(m>mx)mx=m;}}}catch{bad=true;}
    const c1=sim.centreOfMass(); sim.free();
    if(bad){div++;return;}
    const d=Math.hypot(c1[0]-c0[0],c1[1]-c0[1],c1[2]-c0[2]);
    if(!Number.isFinite(d)){div++;return;}
    travel.push(d); sp.push(pct(samples,0.5)); sh.push(shape[idx]);
  });
  console.log(`  ${String(arm).padEnd(5)}  ${String(travel.length).padStart(4)}  ${String(div).padStart(3)}   ${pct(travel,0.5).toFixed(2).padStart(9)}   ${pct(sp,0.5).toFixed(2).padStart(13)}   ${mx.toFixed(0).padStart(9)}   ${spear(travel,sh.map(s=>s.area)).toFixed(2).padStart(7)}  ${spear(travel,sh.map(s=>s.asp)).toFixed(2).padStart(7)}`);
}
