import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { seedPopulation, breed, strangerCount, KIND } from '../engine/l1/breed.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const W = W1_SLICE;
console.log('\n  breed() at sizes other than 6\n');
console.log('  pop   elites cap   strangers   kinds in next gen              N18 elites unchanged?');
for (const pop of [6, 12, 20, 50]) {
  const seed = seedPopulation({ RAPIER, rng: rngFrom('gen', pop), world: W, population: pop });
  const selected = [...Array(Math.min(pop, Math.round(pop * 0.3))).keys()];
  const out = breed({ RAPIER, genomes: seed.genomes, selected, rng: rngFrom('breed', pop), world: W });
  const k = { elite: 0, offspring: 0, stranger: 0 };
  out.provenance.forEach(p => { k[p.kind]++; });
  const same = out.provenance.every((p, i) => p.kind !== KIND.ELITE || out.genomes[i] === seed.genomes[i]);
  console.log(`  ${String(pop).padStart(3)}   ${String(pop - strangerCount(pop)).padStart(10)}   ${String(strangerCount(pop)).padStart(9)}   elite ${String(k.elite).padStart(2)}, offspring ${String(k.offspring).padStart(2)}, stranger ${String(k.stranger).padStart(2)}      ${same ? 'yes' : 'NO'}   len ${out.genomes.length}`);
}
console.log('');
