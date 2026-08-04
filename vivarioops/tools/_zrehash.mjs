// tools/_zrehash.mjs — recompute the frozen residents' genome hashes after a
// GENOME_V bump.
//
// A3 bumped GENOME_V 2 -> 3 and added `controller.phaseBase` / `phaseSlope`.
// `canonical()` emits them, so every genome hash moves — including the three
// residents in worlds/w1_residents.js, whose hashes are precomputed there so
// `worldHash()` needs no morphogenesis. L2-10 asserts the stored hash matches
// the genome and correctly went red.
//
// THE CREATURES DO NOT CHANGE. The migration sets both coefficients to 0, and
// morphogen.js `resolvePhaseLags` returns early on that, so the resolved phase
// lags — and therefore every trajectory — are bit-identical to v2. Only the
// serialised form gained two fields. So this reprints the hashes rather than
// re-running tools/c2residents.js, which would BREED NEW RESIDENTS and change
// the animals themselves.
//
// The stored genomes are deliberately left at "version":2 so that every load
// exercises the 2 -> 3 migration rather than merely trusting it.
//
// `faunaVersion` in worlds/w1_slice.js must be bumped in the same commit — the
// header of w1_residents.js says so, and a resident change that did not move
// worldHash would leave stale records looking valid, which is what K5 exists to
// catch.
//
// Run: node tools/_zrehash.mjs
import { W1_RESIDENT_GENOMES, W1_RESIDENT_IDS, W1_RESIDENT_HASHES } from '../worlds/w1_residents.js';
import { deserialise, genomeHash, migrate, validateGenome } from '../engine/l1/genome.js';
import { GENOME_V } from '../contracts/versions.js';

console.log(`\n  GENOME_V is now ${GENOME_V}\n`);
console.log('  id       stored hash        recomputed         version  valid');
console.log('  ' + '-'.repeat(70));

const out = [];
for (let i = 0; i < W1_RESIDENT_IDS.length; i++) {
  const id = W1_RESIDENT_IDS[i];
  const raw = W1_RESIDENT_GENOMES[id];
  // Through the real load path: parse -> migrate -> hydrate -> validate.
  const g = deserialise(JSON.stringify(raw));
  const h = genomeHash(g);
  const errs = validateGenome(g);
  out.push(h);
  console.log('  ' + id.padEnd(9) + W1_RESIDENT_HASHES[i].padEnd(19) + h.padEnd(19)
    + String(g.version).padStart(5) + '    ' + (errs.length ? `INVALID: ${errs[0]}` : 'ok'));
}

// The neutrality claim, checked rather than asserted: migrating must add exactly
// the two coefficients, both zero, and change nothing else.
const before = W1_RESIDENT_GENOMES[W1_RESIDENT_IDS[0]];
const after = migrate(JSON.parse(JSON.stringify(before)), GENOME_V);
const added = Object.keys(after.controller).filter((k) => !(k in before.controller));
console.log(`\n  migration adds to controller: [${added.join(', ')}]`
  + `  values: [${added.map((k) => after.controller[k]).join(', ')}]`);

console.log('\n  paste into worlds/w1_residents.js W1_RESIDENT_HASHES:\n');
console.log('export const W1_RESIDENT_HASHES = [\n'
  + out.map((h) => `  "${h}",`).join('\n') + '\n];\n');
