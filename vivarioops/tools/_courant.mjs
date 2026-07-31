// HYPOTHESIS: the chatter is an EXPLICIT-DAMPING instability, and it predicts
// which creatures twitch.
//
// applyMotors applies d*omega as an external torque with d = maxTorque*
// MOTOR_DAMPING. Integrated explicitly, a damper is stable only while
//     D = d * dt / I  <  2
// Above that the "damping" overshoots the velocity it is meant to remove and
// becomes a DRIVER at the timestep scale. I is the limb's inertia, so light
// limbs on wide joints are the exposed ones.
//
// Note the drag law already solves this problem the right way — it divides by
// (1 + lambda*dt). The motor does not.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT, swingTwistAngle, MUSCLE_STRESS, MOMENT_ARM_FRACTION, MOTOR_DAMPING } from '../engine/l1/physics.js';
import { computePhases, DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SEC = 10, STEPS = Math.round(SEC/FIXED_DT), W = { ...W1_SLICE, gravity: 0 };
const corpus = [];
for (let i = 0; corpus.length < 45 && i < 400; i++) {
  const g = createRandomGenome(rngFrom(0xC0DE ^ (i*2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 1) corpus.push({ g, p });
}
const rows = [];
for (const { g, p } of corpus) {
  let sim; try { sim = createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false}); } catch { continue; }
  // D for each joint, from the CHILD limb's inertia as Rapier reports it
  let Dmax = 0;
  for (const j of p.joints) {
    const A = j.minCrossSectionalArea;
    const maxT = MUSCLE_STRESS * A * Math.sqrt(A) * MOMENT_ARM_FRACTION;
    const pi = sim.bodies[j.childBody].principalInertia();
    const I = Math.min(pi.x, pi.y, pi.z);
    if (I > 0) Dmax = Math.max(Dmax, maxT * MOTOR_DAMPING * FIXED_DT / I);
  }
  const n = p.jointCount;
  const prevA = new Float64Array(n), dirA = new Int8Array(n), revA = new Int32Array(n);
  const c0 = sim.centreOfMass(); let prev = c0, path = 0, bad = false;
  try { for (let s=0;s<STEPS;s++){ sim.step();
    const c = sim.centreOfMass();
    if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
    path += Math.hypot(c[0]-prev[0],c[1]-prev[1],c[2]-prev[2]); prev = c;
    for(let i=0;i<n;i++){ const j=p.joints[i];
      const a = swingTwistAngle(sim.bodies[j.parentBody].rotation(), sim.bodies[j.childBody].rotation(), j.axisLocal ?? [1,0,0]);
      if(!Number.isFinite(a)){bad=true;break;}
      if(s>0){const d=Math.sign(a-prevA[i]); if(d!==0){ if(dirA[i]!==0&&d!==dirA[i])revA[i]++; dirA[i]=d; }}
      prevA[i]=a; }
    if(bad)break; } } catch { bad=true; }
  const c1 = sim.centreOfMass(); sim.free();
  if(bad) continue;
  const net = Math.hypot(c1[0]-c0[0],c1[1]-c0[1],c1[2]-c0[2]);
  let rev = 0; for(let i=0;i<n;i++) rev = Math.max(rev, revA[i]/SEC);
  rows.push({ D: Dmax, rev, comSpeed: path/SEC, net: net/SEC, tort: path/Math.max(net,1e-9) });
}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
const rank=a=>{const i=a.map((v,k)=>[v,k]).sort((x,y)=>x[0]-y[0]);const r=[];i.forEach(([,k],j)=>r[k]=j);return r;};
const spear=(a,b)=>{const ra=rank(a),rb=rank(b),n=a.length,m=(n-1)/2;let u=0,x=0,y=0;
  for(let i=0;i<n;i++){u+=(ra[i]-m)*(rb[i]-m);x+=(ra[i]-m)**2;y+=(rb[i]-m)**2;}return u/Math.sqrt(x*y);};
console.log(`\nn=${rows.length}.  D = maxTorque * MOTOR_DAMPING * dt / I   (explicit damper is stable below 2)\n`);
console.log(`  D distribution:   p10 ${pct(rows.map(r=>r.D),0.1).toFixed(1)}  p50 ${pct(rows.map(r=>r.D),0.5).toFixed(1)}  p90 ${pct(rows.map(r=>r.D),0.9).toFixed(1)}`);
console.log(`  fraction with D < 2: ${(rows.filter(r=>r.D<2).length/rows.length*100).toFixed(0)}%\n`);
console.log(`  rho(D, chatter)     ${spear(rows.map(r=>r.D), rows.map(r=>r.rev)).toFixed(2)}`);
console.log(`  rho(D, COM speed)   ${spear(rows.map(r=>r.D), rows.map(r=>r.comSpeed)).toFixed(2)}`);
console.log(`  rho(D, tortuosity)  ${spear(rows.map(r=>r.D), rows.map(r=>r.tort)).toFixed(2)}\n`);
for (const [lo,hi,label] of [[0,2,'D < 2   (stable damper)'],[2,20,'D 2-20'],[20,1e9,'D > 20  (far unstable)']]) {
  const g = rows.filter(r=>r.D>=lo&&r.D<hi);
  if(!g.length) { console.log(`  ${label.padEnd(24)} n=0`); continue; }
  console.log(`  ${label.padEnd(24)} n=${String(g.length).padStart(2)}   chatter/s ${pct(g.map(r=>r.rev),0.5).toFixed(1).padStart(5)}` +
    `   COM speed ${pct(g.map(r=>r.comSpeed),0.5).toFixed(2).padStart(6)} m/s   net ${pct(g.map(r=>r.net),0.5).toFixed(3)} m/s   tort ${pct(g.map(r=>r.tort),0.5).toFixed(0).padStart(4)}`);
}
