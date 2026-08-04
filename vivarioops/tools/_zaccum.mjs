// tools/_zaccum.mjs — DO RAPIER FORCES ACCUMULATE ACROSS STEPS?
//
// THE QUESTION. engine/l1/physics.js applies every environmental force with
// `rb.addForce(...)` / `rb.addTorque(...)` — buoyancy at :1200, the fluid law at
// :1397-1398, the PD motor torque at :1726-1727. In Rapier those two calls are
// PERSISTENT: the force is re-applied at every subsequent timestep until
// `resetForces()` / `resetTorques()` is called. That is why those methods exist
// alongside the one-shot `applyImpulse` / `applyTorqueImpulse`, and both families
// are present in the pinned build (vendor/dimforge-rapier3d-compat-0.19.3).
//
// `resetForces` and `resetTorques` appear NOWHERE in this repo. So the force
// Rapier applies at step n may be the sum of every per-step force computed since
// spawn.
//
// THE TEST. Put a body in a constant force field and watch how velocity grows.
// A constant force is the whole trick: it removes every other explanation, because
// the force COMPUTED is identical on every step and only the force APPLIED can
// differ.
//
//   correct  — v(n) = (F/m)*n*dt          linear     -> v(10)/v(1) = 10
//   accruing — v(n) = (F/m)*dt*n(n+1)/2   quadratic  -> v(10)/v(1) = 55
//
// There is no ambiguous middle, and no tuning knob that moves the answer.
//
// HOW THE CONSTANT FORCE IS OBTAINED. physics.js:1199-1200 applies
// `(mediumDensity - density) * volume * gravity` on +Y, once per body per step,
// before the face quadrature. W1 pins SLICE_LIMITS.density to [1,1] against
// mediumDensity 1.0 so that term is identically zero — which is why nobody has
// ever seen it. Raise mediumDensity and it becomes a constant, known, non-zero
// force pointing straight up.
//
// The drag term is NOT constant (it is quadratic in v) and would contaminate the
// arithmetic, so the test runs at speeds where drag is negligible against
// buoyancy, and reports both the raw ratio and a drag-free control run with
// mediumDensity set so that drag is compared directly.
//
// Run: node tools/_zaccum.mjs
import RAPIER from '@dimforge/rapier3d-compat';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { authoredList } from '../worlds/atlas_seed.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const N = 10;

// A single cube: one body, no joints, nothing to slosh. The simplest thing the
// engine will build. `_zsolo`/`_zsolo5` carved a plan literal and were rightly
// distrusted for it, so this goes through morphogenesis on a real genome and
// takes the ROOT BODY's velocity — the plan is well-formed by construction.
const EEL = authoredList().find((a) => a.commonName === 'Eel').genome;

// MASS-WEIGHTED VELOCITY, NOT THE ROOT BODY'S. The first cut of this tool read
// sim.bodies[0].linvel() and measured an acceleration 5.6x the analytic buoyancy,
// because at effort 0 the motors still hold their bias and yank the root around.
// Those joint forces are INTERNAL: they cancel in the mass-weighted sum and cannot
// move the centre of mass. So this responds to external force and nothing else,
// which is exactly the quantity the test is about.
function comVelocityY(sim) {
  let num = 0, den = 0;
  for (const rb of sim.bodies) {
    const m = rb.mass();
    num += m * rb.linvel().y;
    den += m;
  }
  return den > 0 ? num / den : NaN;
}

function run(mediumDensity, label) {
  // Everything else in the world is untouched. Only the medium is denser, which
  // makes the buoyancy term non-zero without altering a single line of engine code.
  const world = { ...W1_SLICE, mediumDensity };
  const plan = morphogenesis(EEL);
  const sim = createSimulation(RAPIER, plan, EEL, world, {
    bounded: false, wrap: false, effort: 0, turnBias: 0,
  });
  const vs = [];
  for (let i = 0; i < N; i++) {
    sim.step();
    vs.push(comVelocityY(sim));
  }
  sim.free();

  console.log(`\n  ${label}   (mediumDensity ${mediumDensity}, mass ${totalMass(plan).toFixed(3)} g)`);
  console.log('    step    v_y (cm/s)      v(n)/v(1)    linear says   accruing says');
  console.log('    ' + '-'.repeat(70));
  for (let i = 0; i < N; i++) {
    const n = i + 1;
    const ratio = vs[0] !== 0 ? vs[i] / vs[0] : NaN;
    console.log('    ' + String(n).padStart(4)
      + vs[i].toExponential(4).padStart(16)
      + ratio.toFixed(2).padStart(13)
      + String(n).padStart(15)
      + String((n * (n + 1)) / 2).padStart(16));
  }
  return vs[0] !== 0 ? vs[N - 1] / vs[0] : NaN;
}

console.log('\n  Does the applied force accumulate across steps?');
console.log(`  ${N} steps at dt = ${FIXED_DT.toFixed(6)} s, effort 0, buoyancy only.`);

// Two arms. Drag is quadratic in v, so it bends the ramp DOWNWARD as the body
// speeds up — which biases the ratio toward the linear answer and would be the
// one way to fake this result. The weak arm keeps speeds ~25x lower, so drag is
// ~600x smaller against the same discrimination. If both arms read ~10, drag is
// not what is producing the 10.
const r = run(1.5, 'BUOYANCY RAMP — strong');
const rWeak = run(1.02, 'BUOYANCY RAMP — weak (drag negligible)');

const LINEAR = N;                       // 10
const ACCRUE = (N * (N + 1)) / 2;       // 55

console.log('\n  ' + '='.repeat(70));
console.log(`  v(${N})/v(1) = ${Number.isFinite(r) ? r.toFixed(3) : 'NaN'} (strong), `
  + `${Number.isFinite(rWeak) ? rWeak.toFixed(3) : 'NaN'} (weak)`);
console.log(`    ${LINEAR}  would mean forces are cleared each step — the plan's Finding 1 is WRONG`);
console.log(`    ${ACCRUE}  would mean forces accumulate — the plan's Finding 1 is CONFIRMED`);
const verdict = !Number.isFinite(r) ? 'INCONCLUSIVE — non-finite'
  : Math.abs(r - ACCRUE) < Math.abs(r - LINEAR) ? 'ACCUMULATING'
  : 'CLEARED EACH STEP';
console.log(`\n  VERDICT: ${verdict}`);
console.log('  ' + '='.repeat(70) + '\n');
