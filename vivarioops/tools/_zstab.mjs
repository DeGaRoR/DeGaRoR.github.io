// tools/_zstab.mjs — THROWAWAY. Broad stability of stiffer budget-derived gains.
// For each candidate kStiff, run a random corpus 30s and count how many blow up
// (max body speed > 10 m/s = tearing regime). The fix must be stable corpus-wide,
// not just on the one reported creature.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const N = Number(process.argv[2] ?? 24);
const T = Number(process.argv[3] ?? 30);
await RAPIER.init();

const subs = [];
for (const sd of SEEDS) { if (sd.id === 'staircase') continue; const g = sd.genome ?? sd; try { subs.push(morphogenesis(g) && { g, p: morphogenesis(g) }); } catch {} }
let n = 0;
for (let i = 0; n < N; i++) { const g = createRandomGenome(rngFrom('stab', i)); let p; try { p = morphogenesis(g); } catch { continue; } if (p.bodyCount < 2) continue; subs.push({ g, p }); n++; }

function maxSpeed(p, g, opts) {
  const sim = createSimulation(RAPIER, p, g, W1_SLICE, { bounded: true, effort: 1, turnBias: 0, ...opts });
  let ms = 0;
  const steps = Math.round(T / FIXED_DT);
  for (let k = 0; k < steps; k++) {
    sim.step();
    for (const rb of sim.bodies) { const v = rb.linvel(); const s = Math.hypot(v.x, v.y, v.z); if (s > ms) ms = s; }
    if (ms > 60) break;
  }
  sim.free();
  return ms;
}

const ARMS = [
  ['NEW DEFAULT ({})', {}],
  ['NEW DEFAULT, no cap', { stableSpeed: 1e9 }],
  ['old freq10, no cap', { motorFreqHz: 10, budgetScale: 6, stableSpeed: 1e9 }],
];
console.log(`\n  _zstab · ${subs.length} creatures · ${T}s\n`);
console.log('  arm                     tearing(>15)  thrashing(>3)  worst m/s');
for (const [label, opts] of ARMS) {
  let tear = 0, thrash = 0, worst = 0;
  for (const s of subs) { const ms = maxSpeed(s.p, s.g, opts); if (ms > 15) tear++; if (ms > 3) thrash++; worst = Math.max(worst, ms); }
  console.log(`  ${label.padEnd(22)}  ${String(tear).padStart(6)}/${subs.length}      ${String(thrash).padStart(4)}/${subs.length}      ${worst.toFixed(1)}`);
}
console.log('');
