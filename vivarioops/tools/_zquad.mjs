// tools/_zquad.mjs — THROWAWAY: hot-loop cost of the face quadrature (C6.4).
// Times the shipped sim on a real corpus so 24 -> 96 samples can be priced
// before it is accepted. Run before and after the change.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { SEEDS } from '../worlds/seeds.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const W = { ...W1_SLICE, gravity: 0 };
const subs = [];
for (const sd of SEEDS) { const g = sd.genome ?? sd; try { subs.push({ g, p: morphogenesis(g) }); } catch {} }
for (let i = 0, n = 0; n < 12; i++) {
  const g = createRandomGenome(rngFrom('quad', i));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.bodyCount < 3) continue;
  subs.push({ g, p }); n++;
}
const SEC = 6, STEPS = Math.round(SEC / FIXED_DT);
let bodies = 0; for (const s of subs) bodies += s.p.bodyCount;
// warm
for (const { g, p } of subs.slice(0, 3)) { const s = createSimulation(RAPIER, p, g, W, { bounded: false }); for (let k = 0; k < 200; k++) s.step(); s.free(); }
const t0 = process.hrtime.bigint();
for (const { g, p } of subs) { const s = createSimulation(RAPIER, p, g, W, { bounded: false }); for (let k = 0; k < STEPS; k++) s.step(); s.free(); }
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
console.log(`  ${subs.length} creatures, ${bodies} bodies, ${SEC}s each`);
console.log(`  total ${ms.toFixed(0)} ms   ${(ms / subs.length).toFixed(1)} ms per ${SEC}s trial   ${(ms / (subs.length * STEPS)).toFixed(4)} ms/step`);
