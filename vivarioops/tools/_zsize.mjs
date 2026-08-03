// tools/_zsize.mjs — THROWAWAY: does the tank's SIZE actually change any number
// the game selects on?
//
// `tankBounds` is declared `hashed: true` in contracts/world.js:42, so it is part
// of world identity: change it and every compiled Species record is invalidated
// and `faunaVersion` must be bumped. That is a heavy price for a number that
// mostly decides how much room the player is looking at, and the question is
// whether the price buys anything.
//
// THE REASON TO DOUBT IT: engine/l2/objective.js:62 scores with
// `bounded: false, wrap: true` — the torus. Scoring already happens in a world
// with NO WALLS. The only way tank size can reach it is `wrapExtent`, the torus
// period (physics.js:729), and physics.js:761 says the centre is reconstructed as
// if the tank were unbounded, so a wrap should be invisible to a measurement.
//
// "Should be" is not a measurement. This runs the SAME genomes through the SAME
// objective under four tank sizes and prints the scores side by side. Identical
// columns mean tank size is free for locomotion scoring; anything else means it
// is not, and the hash is right.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { morphogenesis, boundingRadius } from '../engine/l1/morphogen.js';
import { seedPopulation } from '../engine/l1/breed.js';
import { assessViability } from '../engine/l1/viability.js';
import { objectiveById, scoreBy } from '../engine/l2/objective.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const N = Number(process.argv[2] ?? 10);
const SCALES = [1, 2, 4, 8];

// ONE corpus, seeded ONCE in the shipped world, then scored under every size.
// Re-seeding per size would change the genomes themselves — viability rejects
// oversize creatures against tankBounds — and the comparison would be of two
// different populations rather than of one population in two tanks.
const genomes = seedPopulation({
  RAPIER, rng: rngFrom('forage', 'pop'), world: W1_SLICE, population: N, authoredSlots: 2,
}).genomes;

const speed = objectiveById('speed');
const cols = SCALES.map((scale) => {
  const world = { ...W1_SLICE, tankBounds: W1_SLICE.tankBounds.map((b) => b * scale) };
  return scoreBy(RAPIER, speed, genomes, world);
});

console.log(`\n  the SAME ${N} genomes, objective "${speed.label}" (bounded:false, wrap:true), four tank sizes\n`);
console.log('   #   ' + SCALES.map((s) => `${s}x`.padStart(12)).join('') + '     max rel. diff');
console.log('  ' + '-'.repeat(20 + 12 * SCALES.length));
let worst = 0;
for (let i = 0; i < genomes.length; i++) {
  const vals = cols.map((c) => c[i]);
  const base = vals[0];
  const rel = Math.max(...vals.map((v) => (base ? Math.abs(v - base) / Math.abs(base) : Math.abs(v))));
  worst = Math.max(worst, rel);
  console.log('  ' + String(i + 1).padStart(2) + '   '
    + vals.map((v) => v.toExponential(4).padStart(12)).join('')
    + rel.toExponential(1).padStart(18));
}
console.log(`\n  worst relative difference across an 8x range of tank size: ${worst.toExponential(2)}`);
console.log(worst < 1e-12
  ? '  -> BIT-IDENTICAL. Tank size does not reach the locomotion score at all.'
  : '  -> NOT identical. The torus period does reach the score; the hash is earning its keep.');

// ── the OTHER half: viability DOES read tankBounds, and that changes the corpus.
console.log('\n  viability against tank size (same genomes, oversize rules read tankBounds)');
console.log('   scale     tank cm      viable   rejected oversize');
console.log('  ' + '-'.repeat(52));
for (const scale of SCALES) {
  const bounds = W1_SLICE.tankBounds.map((b) => b * scale);
  const world = { ...W1_SLICE, tankBounds: bounds };
  let ok = 0, over = 0;
  for (const g of genomes) {
    let v;
    try { v = assessViability(RAPIER, g, world); } catch { continue; }
    if (v.ok) ok++;
    else if (String(v.reason ?? '').startsWith('oversize')) over++;
  }
  console.log('  ' + `${scale}x`.padStart(6) + `${bounds[0]}x${bounds[1]}x${bounds[2]}`.padStart(14)
    + String(ok).padStart(12) + String(over).padStart(20));
}

const radii = genomes.map((g) => { try { return boundingRadius(morphogenesis(g)); } catch { return NaN; } })
  .filter(Number.isFinite).sort((a, b) => a - b);
console.log(`\n  creature radius over the corpus: min ${radii[0].toFixed(2)} / median `
  + `${radii[radii.length >> 1].toFixed(2)} / max ${radii[radii.length - 1].toFixed(2)} cm`
  + `  (tank half-extent is ${Math.min(...W1_SLICE.tankBounds) / 2} cm at 1x)\n`);
