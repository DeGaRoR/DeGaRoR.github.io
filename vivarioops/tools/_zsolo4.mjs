import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import * as B from '../engine/l1/physics.js';
import * as F from '../engine/l1/_zfix_120.js';
import * as B4 from '../engine/l1/_zphys_480.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const g = createRandomGenome(rngFrom('decay','corpus',0));
const v = assessViability(RAPIER, g, W1_SLICE);
const solo = { ...v.plan, bodies:[v.plan.bodies[0]], joints:[], jointCount:0, dofCount:0 };
function trace(M, label, kick, n) {
  const sim = M.createSimulation(RAPIER, solo, g, W1_SLICE, {bounded:false, wrap:true, effort:0, turnBias:0});
  const rb = sim.bodies[0];
  rb.setLinvel({x:kick,y:0,z:0}, true); rb.setAngvel({x:0,y:0,z:0}, true);
  const out = [];
  for (let s=0; s<n; s++) { sim.step(); out.push(rb.linvel().x); }
  sim.free();
  console.log(`${label}  vx per step: ` + out.map(x=>x.toFixed(3)).join(' '));
}
console.log('EVERY STEP, kick 5 cm/s:\n');
trace(B,  'baseline dt=1/120 ', 5, 14);
trace(F,  'FIXED    dt=1/120 ', 5, 14);
trace(B4, 'baseline dt=1/480 ', 5, 14);
console.log('\nEVERY STEP, kick 1 cm/s:\n');
trace(B,  'baseline dt=1/120 ', 1, 14);
trace(F,  'FIXED    dt=1/120 ', 1, 14);
