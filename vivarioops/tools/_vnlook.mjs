// tools/_vnlook.mjs — print vernacular + binomial side by side.
//
// 14 §M5 and §M8 are TASTE RULES. No gate can check whether a name is twee or
// whether it would plausibly appear in a field guide, so the only test is
// reading a page of them.
//
//   node tools/_vnlook.mjs [n]

import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { binomial } from '../engine/l1/naming.js';
import { vernacular, slotsOf, lineageFrom } from '../engine/l1/vernacular.js';
import { rampFromTokens } from '../gate/vernacular.js';

const N = Number(process.argv[2] ?? 40);
const palette = rampFromTokens('w1');

const rows = [];
for (let i = 0; rows.length < N && i < N * 3; i++) {
  const g = createRandomGenome(rngFrom('vnlook', i), SLICE_LIMITS);
  let plan;
  try { plan = morphogenesis(g); } catch { continue; }
  rows.push({ plan, genome: g, binomial: binomial(plan, g) });
}

// One shared Atlas: the whole corpus is the lineage, and every name is
// suppressed against the ones already emitted (§7).
const lineage = lineageFrom(rows.map((r) => slotsOf(r.plan, r.genome, { palette, binomial: r.binomial })));
const taken = new Set();
const names = [];
for (const r of rows) {
  const v = vernacular(r.plan, r.genome, { palette, lineage, taken, binomial: r.binomial });
  taken.add(v.name);
  names.push(v);
}

const w = Math.max(...names.map((v) => v.display.length));
for (let i = 0; i < names.length; i++) {
  const v = names[i];
  console.log(`  ${v.display.padEnd(w)}   ${rows[i].binomial.binomial}`);
}
console.log(`\n  ${new Set(names.map((n) => n.name)).size}/${names.length} distinct`
  + ` · heads ${new Set(names.map((n) => n.head)).size}`
  + ` · slots ${JSON.stringify(names.flatMap((n) => n.slots).reduce((a, s) => (a[s] = (a[s] ?? 0) + 1, a), {}))}`);
