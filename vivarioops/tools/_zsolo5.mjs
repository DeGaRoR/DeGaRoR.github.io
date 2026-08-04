import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as M from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const g = createRandomGenome(rngFrom('decay','corpus',0));
const v = assessViability(RAPIER, g, W1_SLICE);
const solo = { ...v.plan, bodies:[v.plan.bodies[0]], joints:[], jointCount:0, dofCount:0 };
const sim = M.createSimulation(RAPIER, solo, g, W1_SLICE, {bounded:false, wrap:true, effort:0, turnBias:0});
const rb = sim.bodies[0];
rb.setLinvel({x:5,y:0,z:0}, true); rb.setAngvel({x:0,y:0,z:0}, true);
console.log('step   vx        vy        vz      |omega|     x         y         z');
for (let s=1; s<=40; s++) {
  sim.step();
  const w = rb.linvel(), a = rb.angvel(), p = rb.translation();
  if (s % 2 === 0)
    console.log(`${String(s).padStart(4)} ${w.x.toFixed(4).padStart(9)} ${w.y.toFixed(4).padStart(9)} ${w.z.toFixed(4).padStart(9)} ${Math.hypot(a.x,a.y,a.z).toFixed(5).padStart(9)} ${p.x.toFixed(4).padStart(9)} ${p.y.toFixed(4).padStart(9)} ${p.z.toFixed(4).padStart(9)}`);
}
