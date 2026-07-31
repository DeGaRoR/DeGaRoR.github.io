// Can anything steer them? C1 added `turnBias` (11 §10) as an EXTERNAL steering
// input — not a sensor, but enough for a pursuit controller to aim a creature.
// If it bends the path, duels are viable without a neural net. If not, nothing
// can aim them at all.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SEC=12, STEPS=Math.round(SEC/FIXED_DT), W={...W1_SLICE, gravity:0};
const MOTOR = process.argv[2] ?? 'solver';
const corpus=[];
for(let i=0;corpus.length<25&&i<200;i++){const g=createRandomGenome(rngFrom(0xC0DE^(i*2654435761)));
  const p=morphogenesis(g); if(p.jointCount>=1)corpus.push({g,p});}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
function run(turn){
  const out=[];
  for(const{g,p}of corpus){
    let sim;try{sim=createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false,motor:MOTOR,turnBias:turn});}catch{continue;}
    if (sim.control) sim.control.turnBias = turn; else throw new Error('no control vector');
    const c0=sim.centreOfMass();let bad=false;
    try{for(let s=0;s<STEPS;s++){sim.step();
      const c=sim.centreOfMass(); if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}}}catch{bad=true;}
    const c1=sim.centreOfMass();sim.free();if(bad)continue;
    out.push([c1[0]-c0[0], c1[1]-c0[1], c1[2]-c0[2]]);
  }
  return out;
}
console.log('\n  control interface:', (await import('../engine/l1/physics.js')).createSimulation ? 'checking setControl…' : '');
const neg = run(-1), zero = run(0), pos = run(+1);
const n = Math.min(neg.length, zero.length, pos.length);
console.log(`  n=${n}, motor='${MOTOR}', ${SEC}s\n`);
// Does turnBias change WHERE they end up? Angle between the +1 and -1 outcomes.
const ang=[], magz=[];
for(let i=0;i<n;i++){
  const a=pos[i], b=neg[i];
  const na=Math.hypot(...a), nb=Math.hypot(...b);
  if(na>1e-4&&nb>1e-4){ ang.push(Math.acos(Math.max(-1,Math.min(1,(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(na*nb))))*180/Math.PI); }
  magz.push(Math.hypot(...zero[i]));
}
console.log(`  displacement with turnBias 0    p50 ${pct(magz,0.5).toFixed(3)} m`);
console.log(`  ANGLE between turn=+1 and turn=-1 outcomes   p50 ${pct(ang,0.5).toFixed(0)} deg   p90 ${pct(ang,0.9).toFixed(0)} deg`);
console.log(`\n  0 deg = turnBias does nothing; 180 deg = full authority over direction`);
