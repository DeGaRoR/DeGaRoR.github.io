// tools/_vnprior.mjs — measure the reference constants engine/l1/vernacular.js
// scores against. Same discipline as naming.js's AXES: a reference constant is
// MEASURED over the current generator and re-measurable when the generator moves.
//
//   node tools/_vnprior.mjs [n]
//
// Prints PRIOR (pattern, gait, rank) and REF.extremity, ready to paste. The
// colour prior is deliberately NOT here: it is a function of the world ramp and
// vernacular.js derives it at call time.

import { fileURLToPath } from 'node:url';
import { rngFrom } from '../trunk/rng.js';
import { rampFromTokens } from '../gate/vernacular.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { binomial } from '../engine/l1/naming.js';
import { slotsOf, bodyRadius, VERNACULAR } from '../engine/l1/vernacular.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const N = Number(process.argv[2] ?? 4000);

// The ramp comes from the GATE's reader, not a copy: measuring the prior against
// a different ramp than the suite asserts on is the one way this script could
// quietly stop meaning anything.
const palette = rampFromTokens('w1');
const counts = { pattern: {}, gait: {}, rank: {}, colour: {} };
const extremity = [];
const sizes = [];
let ok = 0;

for (let i = 0; i < N; i++) {
  const g = createRandomGenome(rngFrom('vnprior', i), SLICE_LIMITS);
  let plan;
  try { plan = morphogenesis(g); } catch { continue; }
  const b = binomial(plan, g);
  extremity.push(b.extremity);
  sizes.push(bodyRadius(plan));
  const s = slotsOf(plan, g, { palette, binomial: b });
  ok++;
  for (const slot of ['pattern', 'gait', 'rank', 'colour']) {
    const w = s.words[slot];
    if (w) counts[slot][w] = (counts[slot][w] ?? 0) + 1;
  }
}

const pct = (o) => {
  const t = Object.values(o).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [k, Number((v / t).toFixed(3))]));
};
const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];

console.log(`corpus ${ok}/${N} viable morphogenesis\n`);
for (const slot of ['pattern', 'gait', 'rank']) {
  const p = pct(counts[slot]);
  // Every pool word must appear, or the prior floor decides its score instead of
  // measurement — which is the failure mode this script exists to make visible.
  const poolWords = Object.keys(VERNACULAR[`${slot.toUpperCase()}_EN`]);
  const missing = poolWords.filter((w) => !(w in p));
  console.log(`  ${slot}: ${JSON.stringify(p)}`);
  if (missing.length) console.log(`     UNREACHED: ${missing.join(', ')}`);
}
console.log(`  colour (w1 ramp, for reference only): ${JSON.stringify(pct(counts.colour))}`);
// REF is QUANTILES, not median-and-spread. `dwarf`/`giant` are lineage-relative
// (14 §11.3) and a z-threshold on a clamped [0,1] trait puts both poles outside
// the range the trait can reach — measured: at naming.js's size reference,
// `dwarf` was unreachable and 24% of the corpus came out `giant`.
console.log(`\n  REF.size:      { lo: ${q(sizes, 0.10).toFixed(3)}, hi: ${q(sizes, 0.90).toFixed(3)} }   // p10 / p90`);
console.log(`  REF.extremity: { lo: ${q(extremity, 0.25).toFixed(3)}, hi: ${q(extremity, 0.75).toFixed(3)} }   // p25 / p75`);
console.log(`\n  (root ${ROOT})`);
