// tools/_zburst.mjs — THROWAWAY. Verify the tank's burst ORCHESTRATION headlessly:
// the exact expand -> adapt -> breed -> keep sequence runBurst() runs, so the UI
// completion path is proven without waiting out a throttled background tab.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { seedPopulation, breed, POPULATION } from '../engine/l1/breed.js';
import { validateGenome } from '../engine/l1/genome.js';
import { morphogenesis, boundingRadius } from '../engine/l1/morphogen.js';
import { netSpeed } from '../engine/l2/objective.js';
import { adaptGait } from '../engine/l2/gait.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const BURST_POP = 12, BURST_GENS = 2, BURST_CAND = 4, BURST_ITER = 2;
await RAPIER.init();

const ls = (g) => {
  let plan; try { plan = morphogenesis(g); } catch { return 0; }
  if (plan.bodyCount < 2) return 0;
  const r = netSpeed(RAPIER, { plan, genome: g, world: W1_SLICE });
  const L = 2 * boundingRadius(plan);
  return (r.valid && L > 1e-9) ? r.score / L : 0;
};
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

// Start from a fresh generation-0 population, like a tank at boot.
const rng = rngFrom('tank', 12345, 'burst', 0);
const seed = seedPopulation({ RAPIER, rng: rng.fork('seed0'), world: W1_SLICE, population: POPULATION });
const before = seed.genomes.map(ls);

const t0 = Date.now();
let pop = seed.genomes.slice();
if (pop.length < BURST_POP) {
  const extra = seedPopulation({ RAPIER, rng: rng.fork('expand'), world: W1_SLICE, population: BURST_POP - pop.length, authoredSlots: 0 });
  pop = pop.concat(extra.genomes);
}
let scores = [];
for (let gen = 0; gen <= BURST_GENS; gen++) {
  const adapted = []; scores = [];
  for (let i = 0; i < pop.length; i++) {
    const a = adaptGait(RAPIER, { genome: pop[i], world: W1_SLICE, rng: rng.fork(`g${gen}b${i}`), candidates: BURST_CAND, iterations: BURST_ITER });
    adapted.push(a.genome); scores.push(a.score);
  }
  pop = adapted;
  if (gen === BURST_GENS) break;
  const order = scores.map((s, i) => ({ s, i })).sort((x, y) => y.s - x.s);
  const survivors = order.slice(0, Math.max(2, pop.length >> 1)).map((x) => x.i);
  pop = breed({ RAPIER, genomes: pop, selected: survivors, rng: rng.fork(`breed${gen}`), world: W1_SLICE, population: BURST_POP }).genomes;
}
const ranked = scores.map((s, i) => ({ s, i })).sort((x, y) => y.s - x.s);
const kept = ranked.slice(0, POPULATION).map((x) => pop[x.i]);
const elapsed = Date.now() - t0;

const after = kept.map(ls);
const allValid = kept.every((g) => validateGenome(g).ok);
const evals = BURST_POP * (BURST_GENS + 1) * (1 + BURST_CAND * BURST_ITER);

console.log(`\n  _zburst · POP ${BURST_POP} · GENS ${BURST_GENS} · (1+${BURST_CAND})x${BURST_ITER} · ${evals} evals\n`);
console.log(`  kept ${kept.length}/${POPULATION} genomes, all valid: ${allValid}`);
console.log(`  birth   L/s median ${median(before).toFixed(4)}  (${before.map(x=>x.toFixed(3)).join(' ')})`);
console.log(`  bursted L/s median ${median(after).toFixed(4)}  (${after.map(x=>x.toFixed(3)).join(' ')})`);
console.log(`  wall time ${(elapsed/1000).toFixed(1)}s  (~${Math.round(elapsed/evals)}ms/eval)\n`);
