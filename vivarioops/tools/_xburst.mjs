// tools/_xburst.mjs — THE REPRODUCER for the burst figures quoted in
// ui/screens/tank.js runBurst.
//
// Mirrors that loop exactly, minus the DOM and the repaint yield, to prove
// end-to-end what a gate cannot look at because it lives in a screen:
//
//   1. every pinned creature comes back BYTE-IDENTICAL, and in fact as the same
//      object reference — the promise the whole rewrite rests on;
//   2. the tank measurably improves on the objective that was chosen;
//   3. the run is deterministic in its seed;
//   4. what it costs in trials and wall-clock.
//
// gate/breed.js L1-43 and L1-44 assert the POLICY (ui/tank/sim.js burstSelection
// and burstKeep) and the objective registry. This covers the loop that drives
// them, which is the part that only exists inside mount().
//
//   node --max-old-space-size=2048 tools/_xburst.mjs
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';

const base = 'D:/Dev/DeGaRoR.github.io/vivarioops';
const { seedPopulation, breed, POPULATION } = await import(`file:///${base}/engine/l1/breed.js`);
const { SLICE_LIMITS } = await import(`file:///${base}/engine/l1/factory.js`);
const { adaptGait } = await import(`file:///${base}/engine/l2/gait.js`);
const { OBJECTIVES, scoreBy } = await import(`file:///${base}/engine/l2/objective.js`);
const { BURST, burstSelection, burstKeep } = await import(`file:///${base}/ui/tank/sim.js`);
const { serialise, genomeHash } = await import(`file:///${base}/engine/l1/genome.js`);
const W1 = (await import(`file:///${base}/worlds/w1_slice.js`)).default;

await RAPIER.init();

function runBurst(genomes, pinned, obj, seed) {
  const rounds = obj.adapt ? BURST.physicsRounds : BURST.freeRounds;
  const rng = rngFrom('tank', seed, 'burst', 0);
  let pop = genomes.slice();
  if (pop.length < BURST.pool) {
    pop = pop.concat(seedPopulation({
      RAPIER, rng: rng.fork('expand'), world: W1,
      population: BURST.pool - pop.length, authoredSlots: 0,
    }).genomes);
  }
  const isPinned = new Set(pinned);
  const scores = new Array(pop.length).fill(0);
  let measured = new Array(pop.length).fill(false);
  for (const i of pinned) measured[i] = true;
  let done = 0, trials = 0;

  const scoreSlot = (i) => {
    if (obj.adapt) {
      const a = adaptGait(RAPIER, { genome: pop[i], world: W1, rng: rng.fork(`b${i}:${done}`),
        candidates: BURST.candidates, iterations: BURST.iterations });
      pop[i] = a.genome; scores[i] = a.score; trials += a.evals;
    } else {
      scores[i] = scoreBy(RAPIER, obj, [pop[i]], W1)[0]; trials++;
    }
    measured[i] = true; done++;
  };

  for (let i = 0; i < pop.length; i++) if (!measured[i]) scoreSlot(i);
  for (let round = 0; round < rounds; round++) {
    const selectN = Math.max(2, pop.length >> 1);
    const parents = burstSelection(pinned, scores, selectN);
    const before = pop;
    pop = breed({ RAPIER, genomes: pop, selected: parents, rng: rng.fork(`breed${round}`),
      world: W1, limits: { ...SLICE_LIMITS, crossoverRate: 0 } }).genomes;
    measured = pop.map((g, i) => (g === before[i] && measured[i]) || isPinned.has(i));
    for (let i = 0; i < pop.length; i++) if (!measured[i]) scoreSlot(i);
  }
  const keep = burstKeep(pinned, scores, POPULATION);
  return { genomes: keep.map(i => pop[i]), scores: keep.map(i => scores[i]), trials, keep };
}

for (const obj of OBJECTIVES) {
  for (const pinned of [[0, 2], []]) {
    const seed = 12345;
    const start = seedPopulation({ RAPIER, rng: rngFrom('check', obj.id), world: W1 }).genomes;
    const before = scoreBy(RAPIER, obj, start, W1);
    const t0 = performance.now();
    const out = runBurst(start, pinned, obj, seed);
    const wall = performance.now() - t0;
    const after = scoreBy(RAPIER, obj, out.genomes, W1);

    const pinsHeld = pinned.every(i => serialise(out.genomes[i]) === serialise(start[i]));
    const pinsSameObject = pinned.every(i => out.genomes[i] === start[i]);
    const det = runBurst(start, pinned, obj, seed);
    const same = det.genomes.every((g, i) => serialise(g) === serialise(out.genomes[i]));

    const distinct = new Set(out.genomes.map(genomeHash)).size;
    console.log(
      `${obj.id.padEnd(6)} pins ${(pinned.join('+') || 'none').padEnd(4)} | ` +
      `best ${Math.max(...before).toFixed(4)} -> ${Math.max(...after).toFixed(4)} | ` +
      `mean ${(before.reduce((a, b) => a + b) / 6).toFixed(4)} -> ${(after.reduce((a, b) => a + b) / 6).toFixed(4)} | ` +
      `pins ${pinsHeld ? 'IDENTICAL' : 'CHANGED!!'}${pinsSameObject ? '/same-ref' : ''} | ` +
      `distinct ${distinct}/6 | ${out.trials} trials | ${(wall / 1000).toFixed(1)}s | ${same ? 'deterministic' : 'NON-DETERMINISTIC!!'}`);
  }
}
