// tools/_zcast.mjs — THROWAWAY: does a SHARED tank of foragers actually work?
// The new risk is not the food model (measured) but the arena: six creatures in
// one world, stepped with stepAll, competing for one depleting field.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { createArena, createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { seedPopulation } from '../engine/l1/breed.js';
import { makeFood, mouthsOf, forageStep, ledger, INGEST_RATE } from '../engine/l2/forage.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const T = Number(process.argv[2] ?? 300), N = 6;
const genomes = seedPopulation({ RAPIER, rng: rngFrom('forage','pop'), world: W1_SLICE, population: N, authoredSlots: 2 }).genomes;
const arena = createArena(RAPIER, W1_SLICE, { bounded: true });
const food = makeFood(W1_SLICE);
const R = Math.min(W1_SLICE.tankBounds[0], W1_SLICE.tankBounds[2]) / 3;
const cast = [];
genomes.forEach((g, i) => {
  const a = (i / N) * Math.PI * 2;
  let plan, sim;
  try {
    plan = morphogenesis(g);
    sim = createSimulation(RAPIER, plan, g, W1_SLICE, { arena, wrap: false, origin: [Math.cos(a)*R, 0, Math.sin(a)*R] });
  } catch (e) { console.log(`  creature ${i+1}: FAILED ${e.message}`); return; }
  const mouths = mouthsOf(plan);
  cast.push({ i, plan, sim, mouths, buf: mouths.map(()=>[0,0,0]), eaten: 0, mass: totalMass(plan) });
});

const t0 = Date.now();
const sims = cast.map(c => c.sim);
let bad = 0;
for (let s = 0; s < Math.round(T/FIXED_DT); s++) {
  arena.stepAll(sims);
  for (const c of cast) c.eaten += forageStep(c.sim, c.plan, food, c.mouths, FIXED_DT, INGEST_RATE, c.buf);
  if (s % 600 === 0) for (const c of cast) { const p = c.sim.centreOfMass(); if (!Number.isFinite(p[0]+p[1]+p[2])) bad++; }
}
const ms = Date.now() - t0;
console.log(`\n  ${cast.length} creatures, shared arena, ${T}s sim in ${(ms/1000).toFixed(1)}s wall (${(T/(ms/1000)).toFixed(0)}x realtime)`);
console.log(`  non-finite checks failed: ${bad}`);
console.log(`  food ${food.eatenCount()}/${food.items.length} items emptied · ${food.remaining().toFixed(1)} g left of ${food.initialTotal}\n`);
console.log('   #   eaten g   in/out    verdict');
console.log('  ' + '-'.repeat(44));
for (const c of cast) {
  const L = ledger(W1_SLICE, c.mass, c.eaten, c.sim.work, T);
  console.log(`  ${String(c.i+1).padStart(2)}${c.eaten.toFixed(3).padStart(10)}${(Number.isFinite(L.ratio)?L.ratio.toFixed(2):'-').padStart(9)}    ${L.ratio>=1?'SURPLUS':'deficit'}`);
}
for (const c of cast) c.sim.free();
arena.free();
