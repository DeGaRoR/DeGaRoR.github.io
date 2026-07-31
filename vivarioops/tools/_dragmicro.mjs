// Measure the drag FORCE the law actually applies, at a known velocity, in one
// step. v_new = v - (F_drag/m)*dt  =>  F_drag = m*(v - v_new)/dt.
// Analytic for an axis-aligned cube translating along +x: 0.5*rho*A*v^2.
import RAPIER from '@dimforge/rapier3d-compat';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const L = 0.5, dens = 1.0;
const plan = { bodyCount: 1, jointCount: 0, joints: [],
  bodies: [{ dims: [L,L,L], density: dens, position: [0,0,0], rotation: [0,0,0,1], parent: -1 }] };
const genome = { controller: { omega: 1.0, jointGenes: {} } };
const rho = W1_SLICE.mediumDensity * W1_SLICE.dragScale * W1_SLICE.dragCoefficient;
const A = L*L;
console.log(`rho_eff ${rho}  A ${A}  analytic F = ${(0.5*rho*A).toFixed(4)} * v^2`);
console.log('     v     F_analytic    F_measured     ratio');
for (const v of [0.1, 0.5, 1, 2, 5, 10, 30]) {
  const sim = createSimulation(RAPIER, plan, genome, { ...W1_SLICE, gravity: 0 }, { bounded: false, motorScale: 0 });
  const rb = sim.bodies[0];
  const m = rb.mass();
  rb.setLinvel({ x: v, y: 0, z: 0 }, true);
  rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  sim.step();
  const v2 = rb.linvel();
  const F = m * (v - v2.x) / FIXED_DT;
  const Fa = 0.5 * rho * A * v * v;
  console.log(`${String(v).padStart(6)}   ${Fa.toFixed(4).padStart(10)}   ${F.toFixed(4).padStart(11)}   ${(F/Fa).toFixed(3).padStart(7)}   (mass ${m.toFixed(4)})`);
  sim.free();
}
