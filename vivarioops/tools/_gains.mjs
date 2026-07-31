// GAIN CONDITIONING. The solver motor is configured
//
//     configureMotorPosition(target, stiffness = budget*kStiff, damping = budget*kDamp)
//
// with budget = MUSCLE_STRESS * A^1.5 * momentArm, kStiff = 1.0, kDamp = 0.12.
//
// Those two multipliers were tuned for the PD, where they scaled a torque CLAMP
// and were therefore dimensionless fractions. In the solver they are the spring
// and damper COEFFICIENTS: k in N.m/rad and c in N.m.s/rad. Whether that is a
// sane second-order system is not a matter of taste, it is
//
//     omega_n = sqrt(k / I)        rad/s     joint natural frequency
//     zeta    = c / (2 sqrt(k I))            damping ratio
//
// against the child limb's actual inertia I. The reference specifies these two
// numbers DIRECTLY (SpringFrequency 10 Hz, DampingRatio 0.9) and derives k and c
// from them. We derive them from nothing. This measures what we actually got.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, MUSCLE_STRESS, MOMENT_ARM_FRACTION,
         MOTOR_STIFFNESS, MOTOR_DAMPING, FIXED_DT } from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const N = Number(process.argv[2] ?? 60);
const W = { ...W1_SLICE, gravity: 0 };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.max(0, Math.round((s.length - 1) * q))] : NaN; };

const rows = [];
let bodies = 0, joints = 0;
for (let i = 0; rows.length < N * 4 && i < N * 8; i++) {
  const g = createRandomGenome(rngFrom(0xC0DE ^ (i * 2654435761)));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.jointCount < 1) continue;
  let sim; try { sim = createSimulation(RAPIER, p, g, W, { bounded: false, motor: 'solver' }); } catch { continue; }
  bodies += p.bodyCount; joints += p.jointCount;
  for (const j of p.joints) {
    if (j.type === 'rigid') continue;
    const A = j.minCrossSectionalArea;
    const budget = MUSCLE_STRESS * A * Math.sqrt(A) * (MOMENT_ARM_FRACTION);
    const k = budget * MOTOR_STIFFNESS;
    const c = budget * MOTOR_DAMPING;
    const rb = sim.bodies[j.childBody];
    const I3 = rb.principalInertia();
    const I = Math.min(I3.x, I3.y, I3.z);
    const m = rb.mass();
    rows.push({
      A, budget, k, c, I, m,
      wn: Math.sqrt(k / I),
      zeta: c / (2 * Math.sqrt(k * I)),
    });
  }
  sim.free();
}

const q = (f) => rows.map(f);
const line = (label, arr, fmt = (x) => x.toExponential(2)) =>
  console.log(`  ${label.padEnd(26)} p05 ${fmt(pct(arr,0.05)).padStart(10)}  p50 ${fmt(pct(arr,0.5)).padStart(10)}  p95 ${fmt(pct(arr,0.95)).padStart(10)}`);

console.log(`\nn = ${rows.length} joints over the viable corpus`);
console.log(`MUSCLE_STRESS ${MUSCLE_STRESS}  momentArm ${MOMENT_ARM_FRACTION}  kStiff ${MOTOR_STIFFNESS}  kDamp ${MOTOR_DAMPING}  dt ${FIXED_DT.toFixed(5)}\n`);
line('joint cross-section A m^2', q(r => r.A));
line('child limb mass kg', q(r => r.m));
line('child min inertia I', q(r => r.I));
line('torque budget N.m', q(r => r.budget));
console.log('');
line('SPRING k = budget*1.0', q(r => r.k));
line('DAMPER c = budget*0.12', q(r => r.c));
console.log('');
line('omega_n = sqrt(k/I) rad/s', q(r => r.wn), (x) => x.toFixed(0));
line('  ... in Hz', q(r => r.wn / (2 * Math.PI)), (x) => x.toFixed(0));
line('omega_n * dt (stability)', q(r => r.wn * FIXED_DT), (x) => x.toFixed(2));
line('ZETA damping ratio', q(r => r.zeta), (x) => x.toFixed(1));
console.log(`\n  reference: SpringFrequency 10 Hz (omega_n 62.8 rad/s), DampingRatio 0.9`);
console.log(`  Nyquist at 120 Hz physics step = 60 Hz. A joint above that cannot be resolved.\n`);

// What k and c WOULD be under the reference's parametrisation.
const FREQ_HZ = 10, ZETA = 0.9;
const wn = 2 * Math.PI * FREQ_HZ;
const kRef = rows.map(r => r.I * wn * wn);
const cRef = rows.map(r => 2 * ZETA * r.I * wn);
console.log(`  If parametrised the reference's way (10 Hz, zeta 0.9):`);
line('    k = I*wn^2', kRef);
line('    c = 2*zeta*I*wn', cRef);
const ratio = rows.map((r, n) => r.k / kRef[n]);
line('    our k / reference k', ratio, (x) => x.toExponential(1));
console.log('');
