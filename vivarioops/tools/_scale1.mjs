// THROWAWAY (scale audit, step 1) — what size ARE the creatures, actually?
//
// Reports the raw engine numbers the UI prints as "m" and "kg", for the authored
// library, the frozen residents and a random factory corpus. No physics change.
import { morphogenesis, totalMass, totalVolume, boundingRadius } from '../engine/l1/morphogen.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { S1 } from '../engine/l2/probes.js';
import { makeRng } from '../trunk/rng.js';
import { deserialise } from '../engine/l1/genome.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_RESIDENT_GENOMES, W1_RESIDENT_IDS } from '../worlds/w1_residents.js';

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f = (x, n = 3) => x.toFixed(n).padStart(9);

function row(label, plan) {
  const s1 = S1(plan);
  return { label, mass: totalMass(plan), vol: totalVolume(plan), r: boundingRadius(plan), L: s1.longestAxis, bodies: plan.bodyCount };
}

const rows = [];
for (const s of SEEDS) { try { rows.push(row(s.id, morphogenesis(s.genome))); } catch {} }
for (const id of W1_RESIDENT_IDS) { try { rows.push(row(id, morphogenesis(deserialise(W1_RESIDENT_GENOMES[id])))); } catch {} }

console.log('\n  AUTHORED LIBRARY + RESIDENTS — raw engine units\n');
console.log('  name          bodies      mass    volume    bndR   longestAxis');
for (const r of rows) console.log(`  ${r.label.padEnd(12)} ${String(r.bodies).padStart(5)} ${f(r.mass)} ${f(r.vol)} ${f(r.r)} ${f(r.L)}`);

// Random corpus
const rng = makeRng(0xC0FFEE);
const corp = [];
for (let i = 0; i < 400; i++) {
  try {
    const g = createRandomGenome(rng, SLICE_LIMITS);
    const p = morphogenesis(g);
    if (p.bodyCount < 2) continue;
    corp.push(row(`r${i}`, p));
  } catch {}
}
console.log(`\n  RANDOM FACTORY CORPUS (n=${corp.length})\n`);
console.log('  quantity        p05       p25       p50       p75       p95');
for (const [k, get] of [['mass', r => r.mass], ['volume', r => r.vol], ['bndRadius', r => r.r], ['longestAxis', r => r.L]]) {
  const a = corp.map(get);
  console.log(`  ${k.padEnd(12)} ${f(pct(a, .05))} ${f(pct(a, .25))} ${f(pct(a, .50))} ${f(pct(a, .75))} ${f(pct(a, .95))}`);
}

// The unit reading table.
console.log(`
  WHAT ONE ENGINE UNIT WOULD MEAN
  A creature of volume V engine-units^3 at density 1.0 (water) has:
     unit = 1 m   ->  real mass = 1000*V kg      (UI prints V "kg"   -> 1000x too light)
     unit = 1 dm  ->  real mass = V kg           (UI prints V "kg"   -> EXACT)
     unit = 1 cm  ->  real mass = V grams        (UI prints V "kg"   -> label off by 1000)
  because mass = density x volume with water = 1 IS the g/cm^3 convention.
`);
const med = pct(corp.map(r => r.L), .5), medM = pct(corp.map(r => r.mass), .5);
for (const [name, u] of [['metre', 1], ['decimetre', 0.1], ['centimetre', 0.01]]) {
  const Lm = med * u, kg = medM * (u * 100) ** 3 / 1000;   // V_cm3 * 1 g/cm3
  console.log(`  1 unit = 1 ${name.padEnd(11)} median creature: ${(Lm * 100).toFixed(1).padStart(8)} cm long, ${kg < 0.01 ? (kg * 1000).toFixed(2) + ' g' : kg.toFixed(2) + ' kg'}`);
}
console.log();
