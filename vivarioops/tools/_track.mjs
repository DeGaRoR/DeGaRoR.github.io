// Do the joints actually GO where they are told?
// Thrust scales with the square of achieved limb sweep, so a motor that cannot
// track its target is a direct multiplier on cruise speed. Compares the
// peak-to-peak angle each joint ACHIEVES against the peak-to-peak it is
// COMMANDED, over 20 s, and sweeps motorScale to see whether torque is the cap.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT, swingTwistAngle, jointAxisAtSpawn } from '../engine/l1/physics.js';
import { computePhases, targetAngles, DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = Number(process.argv[2] ?? 25), SEC = 20, STEPS = Math.round(SEC / FIXED_DT);
const W = { ...W1_SLICE, gravity: 0 };
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 8; i++) {
  const g = createRandomGenome(rngFrom(0x7AC ^ (i * 2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 1) corpus.push({ g, p });
}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};

console.log(`\nn=${corpus.length}, ${SEC}s.  MOTOR_SCALE default 1.0, maxTorque = motorScale * minCrossSectionalArea\n`);
console.log(' motorScale   achieved/commanded sweep      travel p50');
console.log('              p10     p50     p90');
for (const ms of [0.25, 1, 4, 16, 64]) {
  const ratios = [], travel = [];
  for (const { g, p } of corpus) {
    let sim; try { sim = createSimulation(RAPIER, p, g, W, { drive: DRIVE.POSITION, bounded: false, motorScale: ms }); }
    catch { continue; }
    const phases = computePhases(p);
    const n = p.jointCount;
    const aMin = new Float64Array(n).fill(Infinity), aMax = new Float64Array(n).fill(-Infinity);
    const cMin = new Float64Array(n).fill(Infinity), cMax = new Float64Array(n).fill(-Infinity);
    const c0 = sim.centreOfMass(); let bad = false;
    try {
      for (let s = 0; s < STEPS; s++) {
        sim.step();
        if (s * FIXED_DT < 2) continue;               // let the transient settle
        const tgt = targetAngles(p, g, s * FIXED_DT, phases);
        for (let i = 0; i < n; i++) {
          const j = p.joints[i];
          // FIXED. This read `j.axisLocal ?? [1,0,0]`; no such field exists, so it
          // always measured about the parent's X axis, not the joint's own.
          const a = swingTwistAngle(sim.bodies[j.parentBody].rotation(), sim.bodies[j.childBody].rotation(), jointAxisAtSpawn(j, p));
          if (!Number.isFinite(a)) { bad = true; break; }
          if (a < aMin[i]) aMin[i] = a; if (a > aMax[i]) aMax[i] = a;
          if (tgt[i] < cMin[i]) cMin[i] = tgt[i]; if (tgt[i] > cMax[i]) cMax[i] = tgt[i];
        }
        if (bad) break;
      }
    } catch { bad = true; }
    const c1 = sim.centreOfMass(); sim.free();
    if (bad) continue;
    const d = Math.hypot(c1[0]-c0[0], c1[1]-c0[1], c1[2]-c0[2]);
    if (Number.isFinite(d) && d < 500) travel.push(d);
    for (let i = 0; i < n; i++) {
      const com = cMax[i] - cMin[i], ach = aMax[i] - aMin[i];
      if (com > 1e-3 && Number.isFinite(ach)) ratios.push(ach / com);
    }
  }
  console.log(`  ${String(ms).padStart(6)}      ${pct(ratios,0.1).toFixed(3)}   ${pct(ratios,0.5).toFixed(3)}   ${pct(ratios,0.9).toFixed(3)}      ${pct(travel,0.5).toFixed(3)}`);
}
