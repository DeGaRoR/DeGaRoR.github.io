// Reconcile "0.42 m/s net" with "60 m/s peak". Sampling EVERY STEP, not every
// 12, because a high-frequency oscillation is invisible at coarse sampling.
//   netSpeed   net displacement / duration        — what "locomotion" reports
//   comSpeed   instantaneous speed of the CENTRE OF MASS
//   bodySpeed  instantaneous speed of the fastest BODY
// A swimmer: comSpeed ~ netSpeed, bodySpeed a small multiple.
// A vibrator: comSpeed >> netSpeed.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = 20, SEC = 15, STEPS = Math.round(SEC / FIXED_DT);
const W = { ...W1_SLICE, gravity: 0 };
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 8; i++) {
  const g = createRandomGenome(rngFrom(0xC0DE ^ (i * 2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 1) corpus.push({ g, p });
}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
// The lift arm is GONE: `opts.lift` no longer exists. The term it enabled was
// measured wrong (F2 — it reversed the cross-flow force) and was deleted; gate
// L1-45 now holds the sign. Every "lift ON" figure this tool ever printed —
// including HYDRODYNAMICS.md §28's reconciliation table — describes that term.
{
  const net=[], comMean=[], comMax=[], bodyMax=[], tort=[], keEnd=[];
  for (const { g, p } of corpus) {
    let sim; try { sim = createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false}); } catch { continue; }
    const c0 = sim.centreOfMass();
    let prev = c0, path = 0, cmax = 0, bmax = 0, bad = false;
    try {
      for (let s = 0; s < STEPS; s++) {
        sim.step();
        const c = sim.centreOfMass();
        if (!Number.isFinite(c[0]+c[1]+c[2])) { bad = true; break; }
        const d = Math.hypot(c[0]-prev[0], c[1]-prev[1], c[2]-prev[2]);
        path += d;
        const cs = d / FIXED_DT;                    // COM speed this step
        if (cs > cmax) cmax = cs;
        prev = c;
        for (const rb of sim.bodies) { const v = rb.linvel(); const q = Math.hypot(v.x,v.y,v.z); if (q > bmax) bmax = q; }
      }
    } catch { bad = true; }
    const c1 = sim.centreOfMass();
    let ke = 0;
    for (const rb of sim.bodies) { const v = rb.linvel(); ke += 0.5*rb.mass()*(v.x*v.x+v.y*v.y+v.z*v.z); }
    sim.free();
    if (bad) continue;
    const nd = Math.hypot(c1[0]-c0[0], c1[1]-c0[1], c1[2]-c0[2]);
    net.push(nd / SEC); comMean.push(path / SEC); comMax.push(cmax); bodyMax.push(bmax);
    tort.push(path / Math.max(nd, 1e-9)); keEnd.push(ke);
  }
  console.log(`\n── shipped fluid law ──  n=${net.length}`);
  console.log(`  net speed (displacement/15s)   p50 ${pct(net,0.5).toFixed(3)}  p90 ${pct(net,0.9).toFixed(3)} m/s`);
  console.log(`  COM PATH speed (mean)          p50 ${pct(comMean,0.5).toFixed(2)}  p90 ${pct(comMean,0.9).toFixed(2)} m/s`);
  console.log(`  COM peak instantaneous speed   p50 ${pct(comMax,0.5).toFixed(1)}  p90 ${pct(comMax,0.9).toFixed(1)} m/s`);
  console.log(`  fastest BODY peak speed        p50 ${pct(bodyMax,0.5).toFixed(1)}  p90 ${pct(bodyMax,0.9).toFixed(1)} m/s`);
  console.log(`  tortuosity (path / net)        p50 ${pct(tort,0.5).toFixed(0)}`);
  console.log(`  final kinetic energy           p50 ${pct(keEnd,0.5).toFixed(1)}`);
}
