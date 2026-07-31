// Is the chatter a LIMIT-CYCLE AGAINST THE JOINT STOPS?
// targetAngles drives theta = bias + amplitude*range*sin(...), where `range` is
// the joint's own angular LIMIT. At amplitude near 1 the command is the stop
// itself, so the joint slams into the constraint, the solver bounces it, the
// motor drives it back. Scaling amplitude down moves the command off the stop.
// If chatter collapses, the stops are the cause and no drive mode can fix it.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT, swingTwistAngle, jointAxisAtSpawn } from '../engine/l1/physics.js';
import { computePhases, targetAngles, DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SEC = 10, STEPS = Math.round(SEC/FIXED_DT), W = { ...W1_SLICE, gravity: 0 };
const corpus = [];
for (let i = 0; corpus.length < 15 && i < 120; i++) {
  const g = createRandomGenome(rngFrom(0xC0DE ^ (i*2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 1) corpus.push({ g, p });
}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
console.log('\n amp    chatter/s p50   p90     travel p50   (commanded 0.80/s, stress torque, position drive)');
for (const amp of [1.0, 0.6, 0.3, 0.1]) {
  const rev=[], trav=[];
  for (const { g, p } of corpus) {
    const g2 = { ...g, controller: { ...g.controller, jointGenes: Object.fromEntries(
      Object.entries(g.controller.jointGenes).map(([k,v]) => [k, { ...v, amplitude: v.amplitude*amp }])) } };
    let sim; try { sim = createSimulation(RAPIER,p,g2,W,{drive:DRIVE.POSITION,bounded:false,torqueModel:'stress'}); } catch { continue; }
    const phases = computePhases(p), n = p.jointCount;
    const prevA = new Float64Array(n), dirA = new Int8Array(n), revA = new Int32Array(n);
    const c0 = sim.centreOfMass(); let bad=false;
    try { for (let s=0;s<STEPS;s++){ sim.step();
      for (let i=0;i<n;i++){ const j=p.joints[i];
        // FIXED. This read `j.axisLocal ?? [1,0,0]`; no such field exists, so it
        // always measured about the parent's X axis, not the joint's own.
        const a = swingTwistAngle(sim.bodies[j.parentBody].rotation(), sim.bodies[j.childBody].rotation(), jointAxisAtSpawn(j, p));
        if(!Number.isFinite(a)){bad=true;break;}
        if(s>0){const d=Math.sign(a-prevA[i]); if(d!==0){ if(dirA[i]!==0&&d!==dirA[i])revA[i]++; dirA[i]=d; }}
        prevA[i]=a; }
      if(bad)break; } } catch { bad=true; }
    const c1 = sim.centreOfMass(); sim.free();
    if(bad) continue;
    const d = Math.hypot(c1[0]-c0[0],c1[1]-c0[1],c1[2]-c0[2]);
    if(!Number.isFinite(d)) continue;
    for(let i=0;i<n;i++) rev.push(revA[i]/SEC);
    trav.push(d);
  }
  console.log(` ${String(amp).padEnd(5)}  ${pct(rev,0.5).toFixed(1).padStart(11)}  ${pct(rev,0.9).toFixed(1).padStart(6)}   ${pct(trav,0.5).toFixed(2).padStart(9)} m`);
}
