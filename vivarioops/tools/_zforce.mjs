// _zforce.mjs — the decisive one. Log the fluid force ACTUALLY APPLIED against
// the velocity it was computed from, per step, on the REAL unmodified plan.
// A dissipative law has F.v <= 0 at EVERY step. Anything else is the bug.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as M from '../engine/l1/_zphlog.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const g = createRandomGenome(rngFrom('decay','corpus',0));
const v = assessViability(RAPIER, g, W1_SLICE);
const sim = M.createSimulation(RAPIER, v.plan, g, W1_SLICE, {bounded:false, wrap:true, effort:0, turnBias:0});
for (let s=0;s<Math.round(3/M.FIXED_DT);s++) sim.step();
sim.resetClock(); sim.control.effort = 0;
for (const rb of sim.bodies) rb.setLinvel({x:5,y:0,z:0}, true);
M.FLOG.on = true; M.FLOG.body = 0; M.FLOG.rows.length = 0;
for (let s=0;s<40;s++) sim.step();
console.log('body 0, real plan, kicked +5 x, effort 0');
console.log('step     vx        Fx      F.v (power)   |omega|    sc');
let bad = 0;
M.FLOG.rows.forEach((r,i)=>{
  const P = r.fx*r.vx + r.fy*r.vy + r.fz*r.vz + r.tx*r.wx + r.ty*r.wy + r.tz*r.wz;
  if (P > 0) bad++;
  if (i % 2 === 0) console.log(`${String(i).padStart(4)} ${r.vx.toFixed(4).padStart(9)} ${r.fx.toFixed(3).padStart(9)} ${P.toExponential(2).padStart(12)}  ${Math.hypot(r.wx,r.wy,r.wz).toFixed(4).padStart(8)}  ${r.sc.toFixed(3)}`);
});
console.log(`\nsteps with POSITIVE fluid power (energy injected): ${bad} / ${M.FLOG.rows.length}`);
