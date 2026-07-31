// tools/_evobreed.mjs — THE SAME EXPERIMENT, THROUGH THE SHIPPED PATH.
//
//     node tools/_evobreed.mjs <selected|control> <seed> [pop] [gens]
//
// §141: the six-seed result was produced by a harness that reimplemented N17 and
// N18. With `breed()` generalised (§142) the same run can go through the code
// the game actually uses. If the conclusion survives that, it is a statement
// about the game; if it does not, the harness was measuring itself.
//
// THE TWO PATHS ARE NOT THE SAME ALGORITHM and this is not a numerical
// comparison. Four differences, all of them the shipped path being richer:
//
//   1. `mutateTimes` applies 1-3 mutations per offspring; the harness applied 1.
//   2. `seedPopulation` draws VIABLE strangers — `assessViability` in the real
//      world with gravity — where the harness only required a joint.
//   3. N18 elites keep their SLOT; the harness moved them to the front.
//   4. `selected` is "indices in the order tapped", a player gesture. An
//      auto-breeder puts a fitness ranking there, and the round-robin parent
//      draw then favours whatever comes first (§144).
//
// So the question is whether the FINDING replicates — selected beats its own
// control — not whether the numbers match.
import { writeFileSync, mkdirSync } from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import { seedPopulation, breed, strangerCount } from '../engine/l1/breed.js';
import W1_SLICE from '../worlds/w1_slice.js';
import { evaluate, genomeHash, rngFrom, p50, NB } from './_evolib.mjs';
await RAPIER.init();

const ARM = process.argv[2], SEED = process.argv[3];
const POP = Number(process.argv[4] ?? 20), GENS = Number(process.argv[5] ?? 6);
if ((ARM !== 'selected' && ARM !== 'control') || !SEED) {
  console.error('usage: node tools/_evobreed.mjs <selected|control> <seed> [pop] [gens]');
  process.exit(1);
}
const byFitness = ARM === 'selected';
const BUDGET = Number(process.env.BUDGET ?? 420);
const ELITE = Math.max(2, Math.round(POP * 0.3));
const tag = `breed-${ARM}-${SEED}`;

const seeded = seedPopulation({
  RAPIER, rng: rngFrom('breedrun', SEED, 'seed'), world: W1_SLICE, population: POP,
});
let pop = seeded.genomes;

const t0 = Date.now();
const elapsed = () => (Date.now() - t0) / 1000;
const history = [];
console.log(`\n  ${tag}   pop ${POP}, elites ${ELITE}, strangers ${strangerCount(POP)}/gen (N17), ${GENS} gens, ${NB} bearings`);
console.log('  gen   benefit p50   benefit p90     best   distinct   |gain| p50   viable');
for (let gen = 0; gen < GENS; gen++) {
  const scored = [];
  pop.forEach((g, i) => { const r = evaluate(g); if (r) scored.push({ i, g, ...r }); });
  if (scored.length < ELITE + 1) { console.log(`  ${gen}: too few viable (${scored.length})`); break; }
  const bens = scored.map((s) => s.benefit).sort((a, b) => a - b);
  const row = {
    gen, p50: p50(bens), p90: bens[Math.floor(bens.length * 0.9)], best: bens[bens.length - 1],
    viable: scored.length, distinct: new Set(pop.map(genomeHash)).size,
    gain: p50(scored.map((s) => Math.abs(s.gain))),
  };
  history.push(row);
  console.log(`  ${String(gen).padStart(3)}   ${row.p50.toFixed(4).padStart(10)}   ${row.p90.toFixed(4).padStart(10)}  ${row.best.toFixed(4).padStart(7)}    ${String(row.distinct).padStart(2)}/${POP}      ${row.gain.toFixed(3).padStart(6)}   ${String(row.viable).padStart(3)}/${POP}`);
  if (gen === GENS - 1) break;
  if (elapsed() > BUDGET) { console.log(`  -- budget ${BUDGET}s reached after gen ${gen}; checkpointing`); break; }

  const rng = rngFrom('breedrun', SEED, 'gen', gen);
  // The ONLY difference between the arms: how the survivors are chosen. Both
  // then go through the same `breed()` call.
  const ranked = byFitness
    ? [...scored].sort((a, b) => b.benefit - a.benefit)
    : (() => { const s = [...scored]; for (let k = s.length - 1; k > 0; k--) { const j = rng.int(k + 1); [s[k], s[j]] = [s[j], s[k]]; } return s; })();
  const selected = ranked.slice(0, ELITE).map((s) => s.i);
  pop = breed({ RAPIER, genomes: pop, selected, rng: rng.fork('breed'), world: W1_SLICE }).genomes;
}

const wall = elapsed();
mkdirSync('runs', { recursive: true });
writeFileSync(`runs/${tag}.json`, JSON.stringify({
  arm: ARM, seed: `B${SEED}`, path: 'breed()', pop: POP, gens: GENS,
  gensCompleted: history.length, bearings: NB, elite: ELITE,
  immigrants: strangerCount(POP), wallSeconds: wall, history,
}, null, 2));
console.log(`\n  wrote runs/${tag}.json   ${wall.toFixed(0)} s wall\n`);
