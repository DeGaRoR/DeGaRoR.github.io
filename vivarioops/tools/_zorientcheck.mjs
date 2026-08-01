// tools/_zorientcheck.mjs — THROWAWAY. Verify the C0.1 turn3d repair against the
// REAL engine path (runSolo -> turn3d, and S3). Prints:
//   floor = turn3d.rate at turnBias 0 (should be well under 1 deg/s; was ~5.46)
//   wobble = turn3d.wobbleRate at bias 0 (the old number, should stay large)
//   S3.turnRate3d = the coherent steering response, differenced across +/-bias
//   S3.steeringAuthority, turnPlane
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { runSolo, turn3d } from '../engine/l2/probe.js';
import { S3 } from '../engine/l2/probes.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

await RAPIER.init();
const DEG = 180 / Math.PI;

console.log('\n  _zorientcheck · C0.1 repair on the real engine path\n');
console.log('  id            floor(0)  wobble(0) | S3.turnRate3d  S3.auth   turnPlane');
for (const sd of SEEDS) {
  if (sd.id === 'staircase') continue;
  const g = sd.genome ?? sd;
  let plan; try { plan = morphogenesis(g); } catch { continue; }
  // Straight-line floor: no steering input.
  const r0 = runSolo(RAPIER, { plan, genome: g, world: W1_SLICE, gravity: 0, bounded: false, duration: 16, turnBias: 0 });
  const t0 = turn3d(r0.trace, 0, r0.trace.n);
  const s3 = S3(RAPIER, { plan, genome: g, world: W1_SLICE, gravity: 0, bounded: false, cruiseSpeed: 0.2 });
  const tp = [s3.turnPlaneX, s3.turnPlaneY, s3.turnPlaneZ].map(v => v.toFixed(2)).join(',');
  console.log(
    `  ${sd.id.padEnd(12)} ${(t0.rate*DEG).toFixed(2).padStart(8)} ${(t0.wobbleRate*DEG).toFixed(1).padStart(9)} |`
    + ` ${(s3.turnRate3d*DEG).toFixed(2).padStart(12)} ${s3.steeringAuthority.toFixed(2).padStart(8)}   ${tp}`);
}
console.log('\n  target: floor(0) ~0.4-0.8 deg/s (was ~5.46); wobble(0) large; response ordering sane\n');
