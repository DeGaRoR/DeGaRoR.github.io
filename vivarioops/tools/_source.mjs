// WHERE DOES THE OSCILLATION COME FROM? Controls, in order of how much they
// rule out. If it persists with the motors OFF it is not the actuator at all.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT, swingTwistAngle } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SEC = 8, STEPS = Math.round(SEC/FIXED_DT), W = { ...W1_SLICE, gravity: 0 };
const corpus = [];
for (let i = 0; corpus.length < 20 && i < 200; i++) {
  const g = createRandomGenome(rngFrom(0xC0DE ^ (i*2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 1) corpus.push({ g, p });
}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
function measure(o, gz) {
  const rev=[], com=[], atLimit=[];
  for (const { g, p } of corpus) {
    const gg = gz ? { ...g, controller: { ...g.controller, jointGenes: Object.fromEntries(
      Object.entries(g.controller.jointGenes).map(([k,v])=>[k,{...v, amplitude:0, bias:0}])) } } : g;
    let sim; try { sim = createSimulation(RAPIER,p,gg,W,{drive:DRIVE.POSITION,bounded:false,...o}); } catch { continue; }
    const n = p.jointCount;
    const prevA=new Float64Array(n), dirA=new Int8Array(n), revA=new Int32Array(n), lim=new Int32Array(n);
    let prev = sim.centreOfMass(), path=0, bad=false, samples=0;
    try { for (let s=0;s<STEPS;s++){ sim.step();
      const c = sim.centreOfMass();
      if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
      path += Math.hypot(c[0]-prev[0],c[1]-prev[1],c[2]-prev[2]); prev=c;
      for(let i=0;i<n;i++){ const j=p.joints[i];
        const a = swingTwistAngle(sim.bodies[j.parentBody].rotation(), sim.bodies[j.childBody].rotation(), j.axisLocal ?? [1,0,0]);
        if(!Number.isFinite(a)){bad=true;break;}
        if(s>0){const d=Math.sign(a-prevA[i]); if(d!==0){ if(dirA[i]!==0&&d!==dirA[i])revA[i]++; dirA[i]=d;}}
        if (Math.abs(a) > 0.95*j.angleLimits[0]) lim[i]++;
        prevA[i]=a; }
      samples++; if(bad)break; } } catch { bad=true; }
    sim.free(); if(bad) continue;
    for(let i=0;i<n;i++){ rev.push(revA[i]/SEC); atLimit.push(lim[i]/Math.max(samples,1)); }
    com.push(path/SEC);
  }
  return { rev, com, atLimit };
}
console.log('\n condition                        chatter/s p50    COM path speed    time at joint limit');
for (const [label,o,gz] of [
  ['baseline (stress motors)',            {}, false],
  ['motors OFF (motorScale 0)',           {motorScale:0}, false],
  ['motors on, target FLAT (amp=bias=0)', {}, true],
  ['old motors (scale)',                  {torqueModel:'scale'}, false],
  ['weak motors (scale, x0.1)',           {torqueModel:'scale', motorScale:0.1}, false],
  ['no fluid at all',                     {fluid:'none'}, false],
]) {
  const r = measure(o, gz);
  if(!r.rev.length){ console.log(` ${label.padEnd(34)} (no survivors)`); continue; }
  console.log(` ${label.padEnd(34)} ${pct(r.rev,0.5).toFixed(1).padStart(8)}   ${pct(r.com,0.5).toFixed(2).padStart(14)} m/s   ${(pct(r.atLimit,0.5)*100).toFixed(0).padStart(15)}%`);
}
