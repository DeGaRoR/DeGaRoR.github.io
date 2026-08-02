// Are the joints TRACKING or CHATTERING?
// The controller commands a slow oscillation: omega ~1 rad/s, so a joint should
// reverse direction about 0.3 times per second. If it reverses tens or hundreds
// of times per second it is not following the command, it is ringing — and the
// torque clamp turning a PD into bang-bang is the classic cause.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT, swingTwistAngle } from '../engine/l1/physics.js';
import { computePhases, targetAngles, DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SEC = 10, STEPS = Math.round(SEC / FIXED_DT);
const W = { ...W1_SLICE, gravity: 0 };
const corpus = [];
for (let i = 0; corpus.length < 15 && i < 120; i++) {
  const g = createRandomGenome(rngFrom(0xC0DE ^ (i * 2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 1) corpus.push({ g, p });
}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
for (const [label, o] of [
  // The two `stress+lift` arms are GONE: `opts.lift` no longer exists. The term
  // it enabled was measured wrong (F2 — it reversed the cross-flow force) and was
  // deleted; gate L1-45 now holds the sign. See tools/_zplate.mjs test B.
  ['POSITION scale', {torqueModel:'scale'}],
  ['POSITION stress', {torqueModel:'stress'}],
  ['VELOCITY scale', {torqueModel:'scale', drive:DRIVE.VELOCITY}],
  ['VELOCITY stress', {torqueModel:'stress', drive:DRIVE.VELOCITY}],
]) {
  const achRev=[], cmdRev=[], travels=[];
  for (const { g, p } of corpus) {
    let sim; try { sim = createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false,...o}); } catch { continue; }
    const c0 = sim.centreOfMass();
    const phases = computePhases(p), n = p.jointCount;
    const prevA = new Float64Array(n), prevC = new Float64Array(n);
    const dirA = new Int8Array(n), dirC = new Int8Array(n);
    const revA = new Int32Array(n), revC = new Int32Array(n);
    let bad = false;
    try { for (let s=0; s<STEPS; s++){ sim.step();
      const t = s*FIXED_DT, tgt = targetAngles(p,g,t,phases);
      for (let i=0;i<n;i++){ const j=p.joints[i];
        const a = swingTwistAngle(sim.bodies[j.parentBody].rotation(), sim.bodies[j.childBody].rotation(), j.axisLocal ?? [1,0,0]);
        if(!Number.isFinite(a)){bad=true;break;}
        if(s>0){ const da=Math.sign(a-prevA[i]), dc=Math.sign(tgt[i]-prevC[i]);
          if(da!==0){ if(dirA[i]!==0&&da!==dirA[i])revA[i]++; dirA[i]=da; }
          if(dc!==0){ if(dirC[i]!==0&&dc!==dirC[i])revC[i]++; dirC[i]=dc; } }
        prevA[i]=a; prevC[i]=tgt[i]; }
      if(bad)break; } } catch { bad=true; }
    const c1 = sim.centreOfMass();
    const trav = Math.hypot(c1[0]-c0[0], c1[1]-c0[1], c1[2]-c0[2]);
    sim.free(); if(bad || !Number.isFinite(trav)) continue;
    for(let i=0;i<n;i++){ achRev.push(revA[i]/SEC); cmdRev.push(revC[i]/SEC); }
    travels.push(trav);
  }
  console.log(`${label.padEnd(22)} cmd ${pct(cmdRev,0.5).toFixed(2).padStart(5)}/s   ACHIEVED ${pct(achRev,0.5).toFixed(1).padStart(6)}/s  p90 ${pct(achRev,0.9).toFixed(1).padStart(6)}   travel p50 ${pct(travels,0.5).toFixed(2).padStart(6)} m`);
}
console.log(`\n(a joint tracking its command reverses at the commanded rate; ${(1/(2*FIXED_DT)).toFixed(0)}/s is the Nyquist limit — pure timestep ringing)`);
