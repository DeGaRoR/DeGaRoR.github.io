// tools/_evo.mjs — ONE ARM-REPLICATE, CHECKPOINTED.
//
//     node tools/_evo.mjs <selected|control> <seed> [pop] [gens]
//
// Writes runs/<arm>-<seed>.json and prints the generation table. Read the
// accumulated result with tools/_evosum.mjs.
//
// WHY CHUNKED. The two-arm run at population 30 was killed mid-flight and lost
// everything, because nothing was written until the end. Each invocation here is
// one complete, independently meaningful unit — a single arm at a single seed —
// and it lands on disk before the process exits. A replication that takes ten
// invocations can be interrupted nine times and still be nine tenths done.
//
// SIZING. Measured cost is 1.46 s per evaluation at 12 bearings. A run does
// POP evaluations in generation 0 and (immigrants + offspring) per generation
// after, with elites free from the hash cache. Population 40 over 8 generations
// is 40 + 28x7 = 236 evaluations, about 345 s. That is the largest size with
// comfortable margin inside a ten-minute budget; the wall time is printed so the
// next chunk can be sized from fact rather than from this comment.
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  evaluate, createRandomGenome, mutate, morphogenesis, genomeHash, rngFrom, p50, NB,
} from './_evolib.mjs';

const ARM = process.argv[2];
const SEED = process.argv[3];
const POP = Number(process.argv[4] ?? 40);
const GENS = Number(process.argv[5] ?? 8);
if (ARM !== 'selected' && ARM !== 'control' || !SEED) {
  console.error('usage: node tools/_evo.mjs <selected|control> <seed> [pop] [gens]');
  process.exit(1);
}
const byFitness = ARM === 'selected';
const ELITE = Math.max(2, Math.round(POP * 0.3));
const IMM = Math.max(1, Math.round(POP / 6));
const tag = `${ARM}-${SEED}`;

let pop = [];
for (let i = 0; pop.length < POP && i < POP * 15; i++) {
  const g = createRandomGenome(rngFrom('run', SEED, 'init', i));
  try { if (morphogenesis(g).jointCount >= 1) pop.push(g); } catch { /* skip */ }
}

// WALL-CLOCK GUARD. The population-40 chunk was killed at 560 s with nothing on
// disk — the same failure the checkpointing was meant to prevent, one level up.
// A run that runs out of time now STOPS AT A GENERATION BOUNDARY and writes what
// it has: a five-generation result is a partial result, an killed process is not
// a result at all.
const BUDGET = Number(process.env.BUDGET ?? 420);
const t0 = Date.now();
const elapsed = () => (Date.now() - t0) / 1000;
const history = [];
console.log(`\n  ${tag}   pop ${POP}, elites ${ELITE}, immigrants ${IMM}/gen, ${GENS} gens, ${NB} bearings`);
console.log('  gen   benefit p50   benefit p90     best   distinct   |gain| p50   auth p50');
for (let gen = 0; gen < GENS; gen++) {
  const scored = [];
  for (const g of pop) { const r = evaluate(g); if (r) scored.push({ g, ...r }); }
  if (scored.length < ELITE + 1) { console.log(`  ${gen}: too few viable (${scored.length})`); break; }
  const bens = scored.map((s) => s.benefit).sort((a, b) => a - b);
  const row = {
    gen,
    p50: p50(bens),
    p90: bens[Math.floor(bens.length * 0.9)],
    best: bens[bens.length - 1],
    viable: scored.length,
    distinct: new Set(pop.map(genomeHash)).size,
    gain: p50(scored.map((s) => Math.abs(s.gain))),
    auth: p50(scored.map((s) => s.authority)),
  };
  history.push(row);
  console.log(`  ${String(gen).padStart(3)}   ${row.p50.toFixed(4).padStart(10)}   ${row.p90.toFixed(4).padStart(10)}  ${row.best.toFixed(4).padStart(7)}    ${String(row.distinct).padStart(2)}/${POP}      ${row.gain.toFixed(3).padStart(6)}     ${row.auth.toFixed(3).padStart(6)}`);
  if (gen === GENS - 1) break;
  if (elapsed() > BUDGET) {
    console.log(`  -- budget ${BUDGET}s reached after gen ${gen}; stopping and checkpointing`);
    break;
  }

  const rng = rngFrom('run', SEED, 'gen', gen);
  // N18 — elites survive UNCHANGED, same object. In the control they are chosen
  // at random, which is the ONLY difference between the two arms.
  const ranked = byFitness
    ? [...scored].sort((a, b) => b.benefit - a.benefit)
    : (() => { const s = [...scored]; for (let i = s.length - 1; i > 0; i--) { const j = rng.int(i + 1); [s[i], s[j]] = [s[j], s[i]]; } return s; })();
  const elites = ranked.slice(0, ELITE).map((s) => s.g);
  const next = elites.slice();
  // N17 — immigration: fresh genomes unrelated to anything selected.
  for (let i = 0; next.length < ELITE + IMM && i < IMM * 15; i++) {
    const g = createRandomGenome(rngFrom('run', SEED, 'imm', gen, i));
    try { if (morphogenesis(g).jointCount >= 1) next.push(g); } catch { /* skip */ }
  }
  let k = 0;
  while (next.length < POP && k < POP * 25) {
    const child = mutate(elites[k % elites.length], rngFrom('run', SEED, 'off', gen, k)).genome;
    try { if (morphogenesis(child).jointCount >= 1) next.push(child); } catch { /* skip */ }
    k++;
  }
  pop = next;
}

const wall = (Date.now() - t0) / 1000;
mkdirSync('runs', { recursive: true });
writeFileSync(`runs/${tag}.json`, JSON.stringify({
  arm: ARM, seed: SEED, pop: POP, gens: GENS, gensCompleted: history.length, bearings: NB,
  elite: ELITE, immigrants: IMM, wallSeconds: wall, history,
}, null, 2));
console.log(`\n  wrote runs/${tag}.json   ${wall.toFixed(0)} s wall\n`);
