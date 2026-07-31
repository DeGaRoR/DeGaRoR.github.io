// tools/_zdrift.mjs — NEUTRAL DRIFT. No selection, no viability, no physics.
//
// Every lineage takes one mutation per generation and survives unconditionally.
// If the operators are unbiased the mean body count is a random walk that stays
// put; a trend means the mutation tree has a preferred direction, and selection
// is then competing against it rather than deciding it.
//
// Two numbers, and they answer different questions:
//   - NET DRIFT per mutation, measured on a fresh corpus. This is the gate.
//   - the 30-generation WALK, which is what the drift compounds into. It
//     decelerates near the floor (a body cannot have fewer than one box), so the
//     walk is always shallower than 30x the per-mutation figure. Do not read one
//     off the other.
//
// §2.1 gate: |net drift| < 0.01 bodies/mutation. TARGET IS ZERO, NOT POSITIVE —
// a retry loop on the add operators inverts the ratchet to +0.16 and inflates
// every lineage to the body cap, which is the same defect facing the other way.
//
//   node tools/_zdrift.mjs [lineages] [generations]
import { fileURLToPath } from 'node:url';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { mutate } from '../engine/l1/mutate.js';
import { morphogenesis } from '../engine/l1/morphogen.js';

const LINEAGES = Number(process.argv[2] ?? 300);
const GENS = Number(process.argv[3] ?? 30);

const bodyCount = (g) => { try { return morphogenesis(g).bodyCount; } catch { return null; } };

export function measureDrift(lineages = 300, gens = 30, limits = SLICE_LIMITS, ns = 'drift') {
  let pop = [];
  for (let i = 0; i < lineages; i++) pop.push(createRandomGenome(rngFrom(ns, 'seed', i), limits));

  const trace = [];
  let mutations = 0, netDelta = 0;
  const meanBodies = (p) => {
    const c = p.map(bodyCount).filter(x => x !== null);
    return c.reduce((s, x) => s + x, 0) / c.length;
  };
  trace.push(meanBodies(pop));

  for (let gen = 0; gen < gens; gen++) {
    pop = pop.map((g, i) => {
      const before = bodyCount(g);
      const child = mutate(g, rngFrom(ns, gen, i), { limits }).genome;
      const after = bodyCount(child);
      if (before !== null && after !== null) { mutations++; netDelta += after - before; }
      return child;
    });
    trace.push(meanBodies(pop));
  }
  return { trace, netPerMutation: netDelta / mutations, mutations };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = measureDrift(LINEAGES, GENS);
  console.log(`\n  _zdrift · ${LINEAGES} lineages · ${GENS} generations · 1 mutation/generation\n`);
  const marks = [0, 5, 10, 15, 20, 25, GENS].filter(g => g <= GENS);
  console.log('  gen      ' + marks.map(g => String(g).padStart(7)).join(''));
  console.log('  bodies   ' + marks.map(g => r.trace[g].toFixed(2).padStart(7)).join(''));
  console.log(`\n  gen 0 -> gen ${GENS}     ${r.trace[0].toFixed(2)} -> ${r.trace[GENS].toFixed(2)}`);
  console.log(`  NET DRIFT          ${r.netPerMutation.toFixed(4).padStart(8)} bodies/mutation `
    + `over ${r.mutations} mutations      gate: |drift| < 0.01\n`);
}
