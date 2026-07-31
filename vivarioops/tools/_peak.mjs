// Is the 71 m/s median peak a SUSTAINED cruise or a TRANSIENT spike?
// Reports, per creature: the peak instantaneous body speed, the median
// instantaneous body speed, their ratio, and when the peak occurs. A spike
// shows peak >> median and an early or isolated time; a real cruise shows the
// two close together.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = Number(process.argv[2] ?? 30), SEC = 15, STEPS = Math.round(SEC / FIXED_DT);
const model = process.argv[3] ?? 'stress';
const W = { ...W1_SLICE, gravity: 0 };
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 8; i++) {
  const g = createRandomGenome(rngFrom(0xC0DE ^ (i * 2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 1) corpus.push({ g, p });
}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
const peaks=[], meds=[], ratios=[], tPeak=[], comPeak=[], comMed=[];
for (const { g, p } of corpus) {
  let sim; try { sim = createSimulation(RAPIER, p, g, W, { drive: DRIVE.POSITION, bounded: false, torqueModel: model }); } catch { continue; }
  const samples=[], comSamples=[]; let peak=0, at=0, comP=0;
  let bad=false;
  try { for (let s=0;s<STEPS;s++){ sim.step();
    if (s%6===0){ let mx=0;
      for (const rb of sim.bodies){ const v=rb.linvel(); const sp=Math.hypot(v.x,v.y,v.z);
        if(!Number.isFinite(sp)){bad=true;break;} if(sp>mx)mx=sp; }
      if(bad)break;
      samples.push(mx); if(mx>peak){peak=mx;at=s*FIXED_DT;}
      const cv=sim.centreOfMassVelocity?.();
      } } } catch { bad=true; }
  // centre-of-mass speed: recompute from positions, sampled coarsely
  sim.free();
  if(bad||!samples.length) continue;
  const med=pct(samples,0.5);
  peaks.push(peak); meds.push(med); ratios.push(peak/Math.max(med,1e-9)); tPeak.push(at);
}
console.log(`\ntorqueModel='${model}', n=${peaks.length}, ${SEC}s, gravity 0, unbounded\n`);
console.log(`  peak body speed        p50 ${pct(peaks,0.5).toFixed(1)}  p90 ${pct(peaks,0.9).toFixed(1)}  max ${Math.max(...peaks).toFixed(1)}`);
console.log(`  MEDIAN body speed      p50 ${pct(meds,0.5).toFixed(2)}  p90 ${pct(meds,0.9).toFixed(2)}`);
console.log(`  peak / median          p50 ${pct(ratios,0.5).toFixed(1)}  p90 ${pct(ratios,0.9).toFixed(1)}`);
console.log(`  time of peak (s)       p50 ${pct(tPeak,0.5).toFixed(1)}  p10 ${pct(tPeak,0.1).toFixed(1)}`);
console.log(`\n  a spike shows peak/median >> 1; a real cruise shows it near 1`);
