// tools/_zoutcome.mjs — THROWAWAY. The end-to-end outcome of C0+C1+C3, one run.
// Same random corpus measured three ways, plus the live burst, plus the C0.1
// orientation floor. Answers "what did the last updates buy".
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { seedPopulation, breed, POPULATION } from '../engine/l1/breed.js';
import { morphogenesis, boundingRadius } from '../engine/l1/morphogen.js';
import { netSpeed } from '../engine/l2/objective.js';
import { adaptGait } from '../engine/l2/gait.js';
import { runSolo, turn3d } from '../engine/l2/probe.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const N = Number(process.argv[2] ?? 12);
await RAPIER.init();
const DEG = 180 / Math.PI;
const SHIPPED = { motorFreqHz: null, budgetScale: 1, boundTorque: true };  // pre-C1 actuator
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const above = (a, t) => a.filter((x) => x >= t).length;

function ls(genome, simOpts = {}) {
  let plan; try { plan = morphogenesis(genome); } catch { return 0; }
  if (plan.bodyCount < 2) return 0;
  const r = netSpeed(RAPIER, { plan, genome, world: W1_SLICE, simOpts });
  const L = 2 * boundingRadius(plan);
  return (r.valid && L > 1e-9) ? r.score / L : 0;
}

// ── the corpus: same 12 random creatures, measured under two actuators ────────
const corpus = [];
for (let i = 0; corpus.length < N; i++) {
  const g = createRandomGenome(rngFrom('outcome', i));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.bodyCount < 2) continue;
  corpus.push(g);
}
const shippedBirth = corpus.map((g) => ls(g, SHIPPED));
const defaultBirth = corpus.map((g) => ls(g));

// ── the burst: from a fresh gen-0 population, like the tank's Burst button ─────
const BURST_POP = 12, BURST_GENS = 2, BURST_CAND = 4, BURST_ITER = 2;
const rng = rngFrom('tank', 777, 'burst', 0);
const seed0 = seedPopulation({ RAPIER, rng: rng.fork('seed0'), world: W1_SLICE, population: POPULATION });
const seedBirth = seed0.genomes.map((g) => ls(g));
let pop = seed0.genomes.slice();
if (pop.length < BURST_POP) pop = pop.concat(seedPopulation({ RAPIER, rng: rng.fork('expand'), world: W1_SLICE, population: BURST_POP - pop.length, authoredSlots: 0 }).genomes);
let scores = [];
for (let gen = 0; gen <= BURST_GENS; gen++) {
  const adapted = []; scores = [];
  for (let i = 0; i < pop.length; i++) {
    const a = adaptGait(RAPIER, { genome: pop[i], world: W1_SLICE, rng: rng.fork(`g${gen}b${i}`), candidates: BURST_CAND, iterations: BURST_ITER });
    adapted.push(a.genome); scores.push(a.score);
  }
  pop = adapted;
  if (gen === BURST_GENS) break;
  const order = scores.map((s, i) => ({ s, i })).sort((x, y) => y.s - x.s);
  pop = breed({ RAPIER, genomes: pop, selected: order.slice(0, Math.max(2, pop.length >> 1)).map((x) => x.i), rng: rng.fork(`breed${gen}`), world: W1_SLICE, population: BURST_POP }).genomes;
}
const kept = scores.map((s, i) => ({ s, i })).sort((x, y) => y.s - x.s).slice(0, POPULATION).map((x) => pop[x.i]);
const burstOut = kept.map((g) => ls(g));

// ── C0.1 orientation floor on the eel (was ~5.46 deg/s, target <1) ────────────
const eel = SEEDS.find((s) => s.id === 'eel');
const eg = eel.genome ?? eel;
const r0 = runSolo(RAPIER, { plan: morphogenesis(eg), genome: eg, world: W1_SLICE, gravity: 0, bounded: false, duration: 16, turnBias: 0 });
const t3 = turn3d(r0.trace, 0, r0.trace.n);

console.log(`\n  ═══ OUTCOME of C0 + C1 + C3 ═══  (${N} random creatures, L/s = body-lengths/sec)\n`);
console.log('  LOCOMOTION (median L/s · creatures above 0.02)');
console.log(`    shipped actuator, no gait   : ${median(shippedBirth).toFixed(4)}   ${above(shippedBirth, 0.02)}/${N}`);
console.log(`    C1 actuator,      no gait   : ${median(defaultBirth).toFixed(4)}   ${above(defaultBirth, 0.02)}/${N}`);
console.log(`    C1 + C3 burst (best 6 kept) : ${median(burstOut).toFixed(4)}   ${above(burstOut, 0.02)}/${kept.length}   [seed birth ${median(seedBirth).toFixed(4)}]`);
console.log(`\n  ORIENTATION (C0.1 · eel straight-line turn floor, deg/s)`);
console.log(`    coherent heading rate       : ${(t3.rate * DEG).toFixed(2)}   (was ~5.46; the excluded wobble is ${(t3.wobbleRate * DEG).toFixed(0)})`);
console.log(`\n  plan targets: C1 L/s >= 0.008 · C3 burst median >= 0.035, >= 6/12 · orientation floor < 1 deg/s\n`);
