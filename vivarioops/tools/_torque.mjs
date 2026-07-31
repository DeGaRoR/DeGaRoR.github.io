// Does realistic actuator power solve locomotion — and does it make BODY PLAN
// MATTER? The second question is the important one: if thrust is uniformly too
// weak, no morphology can distinguish itself, so the near-zero correlation
// between shape and travel may be a symptom of weak muscle rather than a
// separate defect.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = Number(process.argv[2] ?? 40), SEC = 15, STEPS = Math.round(SEC / FIXED_DT);
const W0 = { ...W1_SLICE, gravity: 0 };
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
  for(const b of p.bodies){const[x,y,z]=b.dims;area+=2*(x*y+y*z+z*x);asp=Math.max(asp,Math.max(x,y,z)/Math.min(x,y,z));}
  return {area,asp,n:p.bodyCount};});

function run(opts, bounded=false) {
  const travel=[], sh=[], peaks=[]; let div=0;
  corpus.forEach(({g,p},idx)=>{
    let sim; try{sim=createSimulation(RAPIER,p,g,bounded?W1_SLICE:W0,{drive:DRIVE.POSITION,bounded,...opts});}catch{return;}
    const c0=sim.centreOfMass(); let bad=false,peak=0;
    try{for(let s=0;s<STEPS;s++){sim.step();
      if(s%24===0){const c=sim.centreOfMass();if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
        for(const rb of sim.bodies){const v=rb.linvel();const sp=Math.hypot(v.x,v.y,v.z);if(sp>peak)peak=sp;}}}}
    catch{bad=true;}
    const c1=sim.centreOfMass(); sim.free();
    if(bad){div++;return;}
    const d=Math.hypot(c1[0]-c0[0],c1[1]-c0[1],c1[2]-c0[2]);
    if(!Number.isFinite(d)||d>1e4){div++;return;}
    travel.push(d); sh.push(shape[idx]); peaks.push(peak);
  });
  return {travel,sh,peaks,div};
}
function row(label,r){
  console.log(`${label.padEnd(26)} n=${String(r.travel.length).padStart(2)} div=${r.div}` +
    `  travel p50 ${pct(r.travel,0.5).toFixed(2).padStart(6)} p90 ${pct(r.travel,0.9).toFixed(2).padStart(6)}` +
    `  peak p95 ${pct(r.peaks,0.95).toFixed(1).padStart(7)}` +
    `  rho(area) ${spear(r.travel,r.sh.map(s=>s.area)).toFixed(2).padStart(5)}` +
    ` rho(asp) ${spear(r.travel,r.sh.map(s=>s.asp)).toFixed(2).padStart(5)}` +
    ` rho(n) ${spear(r.travel,r.sh.map(s=>s.n)).toFixed(2).padStart(5)}`);
}
console.log(`\ncorpus ${corpus.length}, ${SEC}s, gravity 0, unbounded\n`);
row('scale 1.0 (shipped)', run({motorScale:1}));
row('scale 16',            run({motorScale:16}));
row('scale 50 (~derived)', run({motorScale:50}));
row('STRESS sigma*A^1.5',  run({torqueModel:'stress'}));
console.log('\nin the duel tank (bounded, gravity on):');
row('scale 1.0 (shipped)', run({motorScale:1}, true));
row('STRESS sigma*A^1.5',  run({torqueModel:'stress'}, true));
