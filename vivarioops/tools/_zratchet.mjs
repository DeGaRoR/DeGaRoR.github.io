// tools/_zratchet.mjs — WHAT EACH MUTATION OPERATOR DOES TO THE BODY COUNT.
//
// The ratchet is that neutral mutation shrinks creatures. This tool says which
// operator is responsible, by applying exactly one mutation to each of N factory
// genomes and measuring the change in EXPRESSED bodies — not in nodes. The
// distinction is the whole finding: `addNode` always adds a node and usually
// adds no body, because the node's only inbound edge is drawn with
// `terminalOnly` true half the time, and a terminalOnly edge from a host sitting
// at depth 0 with recursiveLimit >= 1 never fires. The genome grows, the animal
// does not.
//
// §2.1 gate: `addNode` grows the body >= 45% of the time.
//
//   node tools/_zratchet.mjs [N]
import { fileURLToPath } from 'node:url';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { mutate } from '../engine/l1/mutate.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { PRESETS } from './_zdiv.mjs';

const N = Number(process.argv[2] ?? 3000);
const PRESET = process.argv[3] ?? 'current';

const bodyCount = (g) => { try { return morphogenesis(g).bodyCount; } catch { return null; } };

export function measureRatchet(n = 3000, limits = SLICE_LIMITS, ns = 'ratchet') {
  const byOp = new Map();
  let total = 0, sumDelta = 0, sumSq = 0;

  for (let i = 0; i < n; i++) {
    const parent = createRandomGenome(rngFrom(ns, 'p', i), limits);
    const before = bodyCount(parent);
    if (before === null) continue;
    const { genome: child, op } = mutate(parent, rngFrom(ns, 'm', i), { limits });
    const after = bodyCount(child);
    if (after === null) continue;

    const key = op.split(':')[0];
    if (!byOp.has(key)) byOp.set(key, { n: 0, sum: 0, grew: 0, shrank: 0, flat: 0 });
    const r = byOp.get(key);
    const d = after - before;
    r.n++; r.sum += d;
    if (d > 0) r.grew++; else if (d < 0) r.shrank++; else r.flat++;
    total++; sumDelta += d; sumSq += d * d;
  }

  // THE GATE IS |drift| < 0.01 AND THE GATE NEEDS A SAMPLE SIZE TO MEAN
  // ANYTHING. Per-mutation delta has a standard deviation around 1.5 bodies, so
  // at n = 3000 the standard error on the mean is ~0.027 — nearly three times
  // the threshold being tested. Any figure quoted at that n is consistent with
  // drifts from -0.05 to +0.05 and tuning against it fits noise. Resolving 0.01
  // at 2 sigma needs n on the order of 90 000.
  const mean = sumDelta / total;
  const sd = Math.sqrt(sumSq / total - mean * mean);
  return { byOp, total, netPerMutation: mean, sd, se: sd / Math.sqrt(total) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const limits = PRESETS[PRESET];
  const measured = measureRatchet(N, limits);
  const { byOp, total, netPerMutation } = measured;
  console.log(`\n  _zratchet · ${total} single mutations · preset ${PRESET}\n`);
  console.log(`  ${'operator'.padEnd(24)} ${'n'.padStart(6)} ${'mean d bodies'.padStart(14)} `
    + `${'grew'.padStart(7)} ${'flat'.padStart(7)} ${'shrank'.padStart(7)} ${'share of drift'.padStart(15)}`);
  for (const [op, r] of [...byOp.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${op.padEnd(24)} ${String(r.n).padStart(6)} ${(r.sum / r.n).toFixed(3).padStart(14)} `
      + `${(100 * r.grew / r.n).toFixed(1).padStart(6)}% ${(100 * r.flat / r.n).toFixed(1).padStart(6)}% `
      + `${(100 * r.shrank / r.n).toFixed(1).padStart(6)}% ${(r.sum / total).toFixed(4).padStart(15)}`);
  }

  // THE DRIFT IS A SUM OF PAIRS. Every structural operator has an inverse, and
  // an operator's mean delta is only meaningful against its partner's: addNode
  // at +0.37 looked harmless on the shipped tree and was not, because removeNode
  // sat at -1.25 opposite it. Read the pairs, not the column.
  const m = (k) => byOp.get(k) ?? { n: 0, sum: 0 };
  console.log('');
  for (const [a, b] of [['addNode', 'removeNode'], ['addConnection', 'removeConnection']]) {
    console.log(`  pair ${a} / ${b}`.padEnd(46)
      + `net ${((m(a).sum + m(b).sum) / total).toFixed(4).padStart(8)} bodies/mutation`);
  }
  const add = m('addNode');
  const { sd, se } = measured;
  console.log(`\n  net drift            ${netPerMutation.toFixed(4).padStart(8)}  +/- ${(2 * se).toFixed(4)} (2 s.e., sd ${sd.toFixed(2)})`);
  console.log(`                                 gate: |drift| < 0.01 — NOT RESOLVABLE below n ~ 90 000`);
  console.log(`  addNode grows        ${(100 * add.grew / add.n).toFixed(1).padStart(7)}%  +/- ${(200 * Math.sqrt(0.25 / add.n)).toFixed(1)}      gate: >= 45%\n`);
}
