import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as M from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const g = createRandomGenome(rngFrom('decay','corpus',0));
const v = assessViability(RAPIER, g, W1_SLICE);
// UNMODIFIED plan, real creature, 4 bodies 3 joints, effort 0, kicked.
for (const [lbl, origin] of [['origin default', undefined], ['origin [7,3,-5]', [7,3,-5]]]) {
  const sim = M.createSimulation(RAPIER, v.plan, g, W1_SLICE,
    {bounded:false, wrap:true, effort:0, turnBias:0, ...(origin?{origin}:{})});
  for (let s=0;s<Math.round(3/M.FIXED_DT);s++) sim.step();
  sim.resetClock(); sim.control.effort = 0;
  const p0 = sim.bodies[0].translation();
  for (const rb of sim.bodies) rb.setLinvel({x:5,y:0,z:0}, true);
  console.log(`\n${lbl} — real 4-body creature, effort 0, kicked +5 x`);
  console.log(`spawn x = ${p0.x.toFixed(4)}`);
  console.log('step     vx        x       (x - spawn)');
  for (let s=1;s<=80;s++){
    sim.step();
    if (s%8===0){ const w=sim.bodies[0].linvel(), p=sim.bodies[0].translation();
      console.log(`${String(s).padStart(4)} ${w.x.toFixed(4).padStart(9)} ${p.x.toFixed(4).padStart(9)} ${(p.x-p0.x).toFixed(4).padStart(11)}`); }
  }
  sim.free();
}
