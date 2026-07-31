// Does the reference's lift term close the remaining gap to C2?
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = Number(process.argv[2] ?? 40), STEPS = Math.round(15 / FIXED_DT);
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
const shape=corpus.map(({p})=>{let area=0,asp=1;
  for(const b of p.bodies){const[x,y,z]=b.dims;area+=2*(x*y+y*z+z*x);asp=Math.max(asp,Math.max(x,y,z)/Math.min(x,y,z));}return{area,asp};});
function run(o, bounded) {
  const W = bounded ? W1_SLICE : { ...W1_SLICE, gravity: 0 };
  const travel=[], sh=[], spd=[]; let div=0, mx=0;
  corpus.forEach(({g,p},idx)=>{
    let sim; try{sim=createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded,...o});}catch{div++;return;}
    const c0=sim.centreOfMass(); let bad=false; const smp=[];
    try{for(let s=0;s<STEPS;s++){sim.step();
      if(s%12===0){let m=0;for(const rb of sim.bodies){const v=rb.linvel();const q=Math.hypot(v.x,v.y,v.z);
        if(!Number.isFinite(q)||q>1000){bad=true;break;}if(q>m)m=q;}
        if(bad)break;smp.push(m);if(m>mx)mx=m;}}}catch{bad=true;}
    const c1=sim.centreOfMass(); sim.free();
    if(bad){div++;return;}
    const d=Math.hypot(c1[0]-c0[0],c1[1]-c0[1],c1[2]-c0[2]);
    if(!Number.isFinite(d)){div++;return;}
    travel.push(d);sh.push(shape[idx]);spd.push(pct(smp,0.5));
  });
  return {travel,sh,spd,div,mx};
}
function row(l,r){console.log(`${l.padEnd(30)} div=${String(r.div).padStart(2)}  travel p50 ${pct(r.travel,0.5).toFixed(2).padStart(6)} p90 ${pct(r.travel,0.9).toFixed(2).padStart(6)}` +
  `  body spd p50 ${pct(r.spd,0.5).toFixed(1).padStart(5)}  max ${r.mx.toFixed(0).padStart(5)}` +
  `  rho(area) ${spear(r.travel,r.sh.map(s=>s.area)).toFixed(2).padStart(5)} rho(asp) ${spear(r.travel,r.sh.map(s=>s.asp)).toFixed(2).padStart(5)}`);}
console.log(`\nn=${corpus.length}, 15 s, derived torque (stress, arm 0.2)\n`);
row('no lift, gravity 0',      run({lift:false}, false));
row('LIFT,    gravity 0',      run({lift:true},  false));
console.log('');
row('no lift, duel tank',      run({lift:false}, true));
row('LIFT,    duel tank',      run({lift:true},  true));
