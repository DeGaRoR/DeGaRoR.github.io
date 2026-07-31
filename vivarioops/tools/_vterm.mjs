// Does the implemented drag law produce the CORRECT terminal velocity?
// A cube pushed by a constant force settles where thrust = drag. For a cube
// translating along a face normal only that face is exposed, so
//     F0 = 0.5 * rho * A * v^2,  rho = mediumDensity*dragScale*dragCoefficient
// and v_term = sqrt(2*F0/(rho*A)). Any suppression of drag shows up as a
// measured terminal velocity ABOVE the analytic one.
import RAPIER from '@dimforge/rapier3d-compat';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const L = 0.5, dens = 1.0;
const plan = {
  bodyCount: 1, jointCount: 0, joints: [],
  bodies: [{ dims: [L, L, L], density: dens, position: [0, 0, 0], rotation: [0, 0, 0, 1], parent: -1 }],
};
const genome = { controller: { omega: 1.0, jointGenes: { n0: { amplitude: 1.0, bias: 0.5, freqMult: 1 } } } };
const rho = W1_SLICE.mediumDensity * W1_SLICE.dragScale * W1_SLICE.dragCoefficient;
const A = L * L, mass = dens * L * L * L;

console.log(`cube ${L} m, mass ${mass} kg, rho_eff ${rho}, A ${A}`);
console.log('  F0(N)   v_analytic   v_measured    ratio');
for (const F0 of [0.1, 1, 10, 100, 500]) {
  const vAn = Math.sqrt(2 * F0 / (rho * A));
  const sim = createSimulation(RAPIER, plan, genome, { ...W1_SLICE, gravity: 0 },
    { bounded: false, motorScale: 0 });
  const rb = sim.bodies[0];
  rb.setEnabledRotations(false, false, false, true);   // pure translation: no tumbling
  for (let s = 0; s < 60 / FIXED_DT; s++) {            // 60 s, well past settling
    rb.addForce({ x: F0, y: 0, z: 0 }, true);
    sim.step();
  }
  const v = rb.linvel();
  const vm = Math.hypot(v.x, v.y, v.z);
  console.log(`  ${String(F0).padStart(5)}   ${vAn.toFixed(3).padStart(10)}   ${vm.toFixed(3).padStart(10)}   ${(vm / vAn).toFixed(3).padStart(6)}`);
  sim.free();
}
