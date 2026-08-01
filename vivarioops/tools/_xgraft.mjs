// tools/_xgraft.mjs — THE REPRODUCER for the graftRate table recorded at
// factory.js SLICE_LIMITS.allowGrafting and pinned at gate/l1.js L1-4.
//
// Written to answer the one question that stood between crossover and the A2
// flip: does recombination starve the viability filter? gate/breed.js L1-30
// asserts `fellBack === 0`, mutation viability was already 57% against a 60%
// target, and the B2 §2.2 obligation says this is the exact quantity that gets
// squeezed again. Guessing would have been a coin flip on a standing assertion.
//
// Sweeps graftRate and reports, per rate: how often the graft actually fired and
// how many nodes it moved, the viability rate over every attempt the ladder made,
// the fraction of births that fell back to parent A, and the tier-2 share (the
// ladder giving up on the graft and crossing scalars alone).
//
// AS COMMITTED IT REPRODUCES THE QUOTED TABLE: two selected, random parents.
// Change `selected` to [0, 1, 2] for the three-parent case — the numbers move by
// less than a point, which is itself worth knowing.
//
//   node --max-old-space-size=2048 tools/_xgraft.mjs

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { SLICE_LIMITS } from '../engine/l1/factory.js';
import { breed, seedPopulation, KIND } from '../engine/l1/breed.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();

const GENERATIONS = 8;
const SEEDS = 6;
const RATES = [0, 0.25, 0.5, 0.75, 1];

const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(0)}%` : '  -');

console.log(`crossover ladder · ${SEEDS} lineages x ${GENERATIONS} generations, selected [0,1]\n`);
console.log('graftRate  births  fellBack  grafted  graftNodes  tier2  viability  att/birth  nodes/creature');

for (const graftRate of RATES) {
  const limits = { ...SLICE_LIMITS, allowGrafting: true, crossoverRate: 1, graftRate };
  let births = 0, fell = 0, t1 = 0, t2 = 0, attempts = 0, ok = 0, rejected = 0;
  let grafted = 0, graftNodes = 0, bodies = 0;

  for (let s = 0; s < SEEDS; s++) {
    // authoredSlots 0: slots 0-1 would otherwise both be library eels, so
    // "selected [0,1]" would breed two near-identical 2-node parents and the
    // graft would have nothing interesting to move. Random parents at 3-7 nodes
    // are the harder corpus and the one the tank reaches after a few breeds.
    const seed = seedPopulation({ RAPIER, rng: rngFrom('x', 'seed', s), world: W1_SLICE, limits, authoredSlots: 0 });
    let gen = seed.genomes;
    for (let k = 0; k < GENERATIONS; k++) {
      const r = breed({
        RAPIER, genomes: gen, selected: [0, 1],
        rng: rngFrom('x', 'breed', s, k, graftRate), world: W1_SLICE, limits,
      });
      for (const p of r.provenance) {
        if (p.kind !== KIND.OFFSPRING) continue;
        births++;
        attempts += p.attempts;
        if (p.fellBack) fell++;
        if (p.tier === 1) t1++;
        if (p.tier === 2) t2++;
        if (p.grafted > 0) { grafted++; graftNodes += p.grafted; }
      }
      for (const x of r.genomes) bodies += x.nodes.length;
      ok += r.tally.viable;
      rejected += r.tally.attempts - r.tally.viable;
      gen = r.genomes;
    }
  }

  const total = ok + rejected;
  console.log(
    `${graftRate.toFixed(2).padStart(9)}  ${String(births).padStart(6)}  ` +
    `${pct(fell, births).padStart(8)}  ${pct(grafted, births).padStart(7)}  ` +
    `${(graftNodes / Math.max(1, grafted)).toFixed(1).padStart(10)}  ${pct(t2, births).padStart(5)}  ` +
    `${pct(ok, total).padStart(9)}  ${(attempts / births).toFixed(2).padStart(9)}  ` +
    `${(bodies / (SEEDS * GENERATIONS * 6)).toFixed(2).padStart(14)}`);
}
