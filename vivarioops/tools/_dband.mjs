// tools/_dband.mjs — one-off. Picks SLICE_LIMITS.density by measurement.
// Uses the REAL engine physics and the REAL drag law: this decision must not
// depend on the fluid-law change that follows it.
//
//   node tools/_dband.mjs [N] [seconds]

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();
const N = Number(process.argv[2] ?? 80);
const SECONDS = Number(process.argv[3] ?? 60);
const STEPS = Math.round(SECONDS / FIXED_DT);

const plans = [];
for (let i = 0; plans.length < N && i < N * 6; i++) {
  const g = createRandomGenome(rngFrom(0xB0A7 ^ (i * 2654435761)));
  const p = morphogenesis(g);
  if (p.bodyCount >= 2) plans.push({ g, p });
}

function measure(lo, hi) {
  let pinned = 0, ok = 0, worstVert = 0, vsum = [];
  for (const { g, p } of plans) {
    const plan = { ...p, bodies: p.bodies.map(b => ({ ...b, density: Math.min(hi, Math.max(lo, b.density)) })) };
    let sim;
    try {
      sim = createSimulation(RAPIER, plan, g, W1_SLICE, { drive: DRIVE.POSITION, bounded: true });
    } catch { continue; }
    const y0 = sim.centreOfMass()[1];
    let bad = false, hit = false, maxDy = 0;
    try {
      for (let s = 0; s < STEPS; s++) {
        // Probe BEFORE the step: a wasm panic names the place that noticed, not
        // the place that broke (HANDOFF, B3). The engine has no finite() probe,
        // so it is done here.
        for (const rb of sim.bodies) {
          const t = rb.translation(), v = rb.linvel(), a = rb.angvel();
          if (!Number.isFinite(t.x + t.y + t.z + v.x + v.y + v.z + a.x + a.y + a.z)) { bad = true; break; }
        }
        if (bad) break;
        sim.step();
        if (s % 24 === 0) {
          const c = sim.centreOfMass();
          if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
          maxDy = Math.max(maxDy, Math.abs(c[1] - y0));
          if (c[1] < W1_SLICE.floor.y + 1 || c[1] > W1_SLICE.surface.y - 1) hit = true;
        }
      }
    } catch { bad = true; }
    sim.free();
    if (bad) continue;
    ok++; if (hit) pinned++;
    vsum.push(maxDy);
    worstVert = Math.max(worstVert, maxDy);
  }
  vsum.sort((a, b) => a - b);
  const p90 = vsum.length ? vsum[Math.floor((vsum.length - 1) * 0.9)] : NaN;
  return { ok, pinned, p90, worstVert };
}

console.log(`\n${plans.length} creatures, ${SECONDS} s, real engine drag law`);
console.log(`half-tank height ${W1_SLICE.tankBounds[1] / 2} m\n`);
console.log('band                 n    pinned   |dy| p90    |dy| worst');
for (const [lo, hi] of [
  [0.15, 1.8], [0.97, 1.03], [0.99, 1.01], [0.995, 1.005], [1, 1],
]) {
  const r = measure(lo, hi);
  console.log(`[${lo}, ${hi}]`.padEnd(20) +
    `${String(r.ok).padStart(3)}   ${String(r.pinned).padStart(3)}/${r.ok}` +
    `   ${r.p90.toFixed(3).padStart(9)}   ${r.worstVert.toFixed(3).padStart(9)}`);
}
console.log('');
