// tools/_zwobble.mjs — IS turnRate3d A HEADING CHANGE OR A PER-STROKE WOBBLE?
//
// It is a wobble, and this tool exists so the mistake cannot be made a third
// time. `turn3d` in probe.js accumulates the swept angle of the CENTRE OF MASS
// VELOCITY DIRECTION. A swimming creature's centre of mass oscillates every
// stroke, so its velocity direction reverses every stroke, and the accumulated
// sweep is dominated by that oscillation rather than by any change of heading.
//
// MEASURED, 20 s per creature: the velocity direction sweeps 2000-13000 degrees
// — five to thirty-seven full rotations — while the body itself rotates 2.5 to
// 39 degrees NET. Two to three orders of magnitude apart.
//
// This is the same defect class as session 2's tortuosity of 119, which was
// dismissed as "a per-stroke wobble" and turned out to be the defining symptom,
// and the same class as the 20 Hz sampling that aliased a 12-22 Hz centre-of-mass
// oscillation. The lesson that keeps not sticking: A DERIVED METRIC BUILT ON THE
// VELOCITY DIRECTION OF AN OSCILLATING BODY MEASURES THE OSCILLATION.
//
// Everything downstream of turn3d inherits it: turnRate3d, and steeringAuthority,
// which differences `axis3d` from the same source.
//
// The honest heading rate is the last column: the net rotation of the root
// body's forward axis, per second.
//
//   node tools/_zwobble.mjs [nRandom] [seconds]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const N = Number(process.argv[2] ?? 8);
const T = Number(process.argv[3] ?? 20);
await RAPIER.init();

const subs = [];
for (const sd of SEEDS) {
  if (sd.id === 'staircase') continue;
  const g = sd.genome ?? sd;
  try { subs.push({ id: sd.id, genome: g, plan: morphogenesis(g) }); } catch { /* skip */ }
}
let n = 0;
for (let i = 0; n < N; i++) {
  const g = createRandomGenome(rngFrom('turn', i));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.bodyCount < 3) continue;
  subs.push({ id: `r${i}`, genome: g, plan: p }); n++;
}

const rotv = (q, v) => {
  const t = [2 * (q.y * v[2] - q.z * v[1]), 2 * (q.z * v[0] - q.x * v[2]), 2 * (q.x * v[1] - q.y * v[0])];
  return [v[0] + q.w * t[0] + (q.y * t[2] - q.z * t[1]),
          v[1] + q.w * t[1] + (q.z * t[0] - q.x * t[2]),
          v[2] + q.w * t[2] + (q.x * t[1] - q.y * t[0])];
};

console.log(`\n  _zwobble · ${T} s at full turn bias\n`);
console.log('  id           velDirSwept   bodyRotated   netTravel     HEADING RATE');
console.log('               (deg total)   (deg net)        (m)          (deg/s)');
for (const s of subs) {
  const sim = createSimulation(RAPIER, s.plan, s.genome, { ...W1_SLICE, gravity: 0 },
    { bounded: false, wrap: true, effort: 1, turnBias: 1 });
  for (let k = 0; k < Math.round(2 / FIXED_DT); k++) sim.step();
  const q0 = sim.bodies[0].rotation(), c0 = sim.centreOfMass();
  let velSwept = 0, prev = null, last = c0;
  for (let k = 0; k < Math.round(T / FIXED_DT); k++) {
    sim.step();
    if (k % 12 === 0) {
      const c = sim.centreOfMass();
      const dv = [c[0] - last[0], c[1] - last[1], c[2] - last[2]];
      const nn = Math.hypot(...dv);
      if (nn > 1e-6) {
        const u = dv.map(v => v / nn);
        if (prev) velSwept += Math.acos(Math.max(-1, Math.min(1, u[0] * prev[0] + u[1] * prev[1] + u[2] * prev[2])));
        prev = u;
      }
      last = c;
    }
  }
  const q1 = sim.bodies[0].rotation(), c1 = sim.centreOfMass();
  const f0 = rotv(q0, [0, 0, 1]), f1 = rotv(q1, [0, 0, 1]);
  const netRot = Math.acos(Math.max(-1, Math.min(1, f0[0] * f1[0] + f0[1] * f1[1] + f0[2] * f1[2]))) * 180 / Math.PI;
  const travel = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);
  sim.free();
  console.log(`  ${s.id.padEnd(12)} ${(velSwept * 180 / Math.PI).toFixed(0).padStart(11)} `
    + `${netRot.toFixed(1).padStart(13)} ${travel.toFixed(3).padStart(11)} ${(netRot / T).toFixed(2).padStart(16)}`);
}
console.log('\n  A creature needs ~135 deg to face a target placed behind it.\n');
