// tools/_zwild2.mjs — grow swimmers from the random draw, on a criterion that is
// entirely calibration-free.
//
// ── THE SCORE ───────────────────────────────────────────────────────────────
//
//   score = eaten  x  min(1, coarse / C0)  x  (0.5 + 0.5 * net / coarse)
//
// THREE MEASURED QUANTITIES, NONE OF THEM CALIBRATED.
//
//   eaten   grams. The energy MULTIPLIER was abandoned because it ranked a lump
//           that moved six millimetres in fifteen minutes above every swimmer in
//           the library: `spend = work + basal`, work is zero for anything that
//           does not actuate, and food is ~570x cheaper to acquire than existing
//           is to pay for. Grams are grams and survive any retune of FOOD_ENERGY.
//
//   coarse  path length over PATH_SAMPLES points. Sampling coarsely is the whole
//           point: at the trail's own 4 Hz, path length is 91% wiggle
//           (tools/_ztrail.mjs) and a creature trembling in place out-scores one
//           that swims. Ten samples over the trial is a ruler long enough that
//           oscillation cancels and short enough that a curved route still counts
//           — which a straight-line measure would throw away.
//
//   net     start to finish. Rewards holding a heading, which coarse path alone
//           does not: a creature circling a patch and one crossing the tank can
//           have identical path length.
//
// THE MOUTH IS SAMPLED, NOT THE CENTRE OF MASS. This closes an exploit that the
// COM version was open to: the mouth sits offset from the COM, so a creature
// spinning on a long lever arm sweeps its mouth through a great deal of water
// while its centre barely moves. Scoring the thing that actually eats removes the
// gap between what is measured and what matters — and it is the same series the
// on-screen trail draws, so the number and the picture agree.
//
// SHAPE OF THE COMBINATION. The gate is a PRODUCT, not a cutoff: a rock scores
// zero because a factor is zero, not because a rule excluded it, and two
// creatures either side of a threshold are not ranked infinitely apart. The
// directionality term is bounded to [0.5, 1.0] on purpose — it MODULATES, never
// dominates, so a straight swimmer that eats nothing cannot out-rank a forager.
//
// ── EVOLUTION: THREE SEPARATE LINES ─────────────────────────────────────────
//
// Earlier runs collapsed to one lineage and returned three near-identical
// winners. Selecting the top N of one population cannot prevent that — the top N
// of a converged population ARE siblings. So the three founders evolve in three
// INDEPENDENT populations that never exchange genes, and the verdict takes the
// best of each. Diversity by construction rather than by hoping.
import RAPIER from '@dimforge/rapier3d-compat';
import { writeFileSync } from 'node:fs';
import { rngFrom } from '../trunk/rng.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { seedPopulation, breed } from '../engine/l1/breed.js';
import { authoredList } from '../worlds/atlas_seed.js';
import { binomial } from '../engine/l1/naming.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { makeFood, mouthsOf, mouthPoints, forageStep, INGEST_RATE } from '../engine/l2/forage.js';
import { signature } from '../engine/l1/naming.js';
import { SLICE_LIMITS } from '../engine/l1/factory.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const SCALE = Number(process.argv[2] ?? 1);
const PATH_SAMPLES = 10;
/** Movement gate, cm per second of trial. The Eel does ~0.037 coarse cm/s. */
const C0_PER_SECOND = 0.012;

const P1_ROUNDS = Math.max(2, Math.round(24 * SCALE));
const P1_DRAW = Math.max(3, Math.round(14 * SCALE));
const P3_LINES = 3;
const P3_GENS = Math.max(2, Math.round(20 * SCALE));
const P3_POP = 10;

function condition(k) {
  const a = (k / 5) * Math.PI * 2;
  const r = Math.min(W1_SLICE.tankBounds[0], W1_SLICE.tankBounds[2]) / 4;
  return { seed: 31337 + k * 7919, origin: [Math.cos(a) * r, 0, Math.sin(a) * r] };
}

let trials = 0, simSeconds = 0, last = null;
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function scoreOne(genome, seconds, k) {
  let plan;
  try { plan = morphogenesis(genome); } catch { return 0; }
  const mouths = mouthsOf(plan);
  if (!mouths.length) return 0;
  const buf = mouths.map(() => [0, 0, 0]);
  const { seed, origin } = condition(k);
  const food = makeFood(W1_SLICE, { seed });
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, W1_SLICE, {
      bounded: false, wrap: true, effort: 1, turnBias: 0, origin,
    });
  } catch { return 0; }

  const steps = Math.round(seconds / FIXED_DT);
  const every = Math.max(1, Math.floor(steps / (PATH_SAMPLES - 1)));
  const track = [];
  let eaten = 0;
  for (let st = 0; st < steps; st++) {
    try { sim.step(); } catch { break; }
    eaten += forageStep(sim, plan, food, mouths, FIXED_DT, INGEST_RATE, buf);
    if (st % every === 0) {
      const p = mouthPoints(sim, plan, mouths, buf)[0];
      if (p && Number.isFinite(p[0] + p[1] + p[2])) track.push([p[0], p[1], p[2]]);
    }
  }
  sim.free();
  trials++; simSeconds += seconds;

  if (track.length < 2 || !Number.isFinite(eaten)) { last = null; return 0; }
  let coarse = 0;
  for (let i = 1; i < track.length; i++) coarse += d3(track[i], track[i - 1]);
  const net = d3(track[track.length - 1], track[0]);
  const straight = coarse > 0 ? net / coarse : 0;
  const gate = Math.min(1, coarse / (C0_PER_SECOND * seconds));
  const score = eaten * gate * (0.5 + 0.5 * straight);
  last = { eaten, coarse, net, straight, gate, score };
  return Number.isFinite(score) ? score : 0;
}

/** PAIRED: every member of a slate meets the identical condition(s). */
const slateScore = (gs, seconds, conds) =>
  gs.map((g) => conds.reduce((s, k) => s + scoreOne(g, seconds, k), 0) / conds.length);

const t0 = Date.now();
const say = (m) => console.log(`  ${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s  ${m}`);

// ── FOUNDERS ────────────────────────────────────────────────────────────────
//
// `eel` mode starts from the authored CHAINS instead of prospecting the random
// draw, and it exists because of a measurement: over 600 random genomes, ZERO had
// a segment run of 4 or more, against 6-7 for every authored creature. The
// generator does not produce chains at all — median longest run is 1 — so the
// random draw cannot reach the region of morphospace an undulating swimmer lives
// in. Mutating a chain is not an alternative route there; it is the only one.
//
// The question this mode asks is therefore narrower and sharper than phase 1's:
// does the chain SURVIVE mutation, or does breeding dissolve it back into the
// bushy shapes the generator prefers?
const EEL_MODE = process.argv.includes('eel');
let founders;
if (EEL_MODE) {
  const pickA = (n) => authoredList().find((a2) => a2.commonName === n);
  founders = ['Eel', 'Darter', 'Paddletail'].map((n) => ({ genome: pickA(n).genome, p2: NaN, from: n }));
  say(`phases 1-2 SKIPPED — founders are the authored chains: ${founders.map((f) => f.from).join(', ')}`);
}

// ── 1. prospect ─────────────────────────────────────────────────────────────
if (!EEL_MODE) say(`phase 1 — ${P1_ROUNDS} rounds x ${P1_DRAW} random, 60 s paired (nothing authored)`);
const survivors = [];
for (let round = 0; EEL_MODE ? false : round < P1_ROUNDS; round++) {
  const pool = seedPopulation({
    RAPIER, rng: rngFrom('wild2', 'draw', round), world: W1_SLICE,
    population: P1_DRAW, authoredSlots: 0,
  }).genomes;
  const s = slateScore(pool, 60, [round % 5]);
  let b = 0;
  for (let i = 1; i < s.length; i++) if (s[i] > s[b]) b = i;
  survivors.push({ genome: pool[b], p1: s[b] });
}
if (!EEL_MODE) say(`  ${survivors.length} survivors, ${Math.min(...survivors.map((x) => x.p1)).toFixed(2)}`
  + `..${Math.max(...survivors.map((x) => x.p1)).toFixed(2)}`);

// ── 2. pit ──────────────────────────────────────────────────────────────────
if (!EEL_MODE) {
  say(`phase 2 — the ${survivors.length}, 300 s paired over 3 conditions`);
  const p2 = slateScore(survivors.map((x) => x.genome), 300, [0, 1, 2]);
  survivors.forEach((x, i) => { x.p2 = p2[i]; });
  survivors.sort((a, b) => b.p2 - a.p2);
  founders = survivors.slice(0, P3_LINES);
  say(`  founders ${founders.map((f) => f.p2.toFixed(2)).join(', ')}`);
}

// ── 3. evolve, three independent lines ──────────────────────────────────────
say(`phase 3 — ${P3_LINES} separate lines x ${P3_GENS} generations, pop ${P3_POP}, 90 s paired`);
const champions = [];
for (let line = 0; line < founders.length; line++) {
  let pop = [founders[line].genome].concat(seedPopulation({
    RAPIER, rng: rngFrom('wild2', 'fill', line), world: W1_SLICE,
    population: P3_POP - 1, authoredSlots: 0,
  }).genomes);
  let best = { s: -1, g: pop[0] };
  for (let gen = 0; gen < P3_GENS; gen++) {
    const s = slateScore(pop, 90, [(gen + line) % 5]);
    const order = s.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    if (order[0][0] > best.s) best = { s: order[0][0], g: pop[order[0][1]] };
    if (gen === P3_GENS - 1) break;
    pop = breed({
      RAPIER, genomes: pop, selected: order.slice(0, P3_POP >> 1).map(([, i]) => i),
      rng: rngFrom('wild2', 'breed', line, gen), world: W1_SLICE, limits: SLICE_LIMITS,
    }).genomes;
  }
  champions.push(best);
  say(`  line ${line + 1} best ${best.s.toFixed(2)}`);
}

// ── 4. verdict ──────────────────────────────────────────────────────────────
say('phase 4 — verdict, 900 s paired over 5 conditions');
const authored = authoredList();
const pick = (n) => authored.find((a) => a.commonName === n);
const slate = [
  ...champions.map((c, i) => ({ name: `WILD ${i + 1}`, genome: c.g, wild: true })),
  ...['Eel', 'Darter', 'Flapper', 'Drifter', 'Paddletail'].map((n) => ({ name: n, genome: pick(n)?.genome })),
].filter((x) => x.genome);
const fin = slateScore(slate.map((x) => x.genome), 900, [0, 1, 2, 3, 4]);
slate.forEach((x, i) => { x.score = fin[i]; });
slate.sort((a, b) => b.score - a.score);

console.log('\n  FINAL - score = eaten x gate(coarse) x (0.5 + 0.5*net/coarse), 900 s, 5 conditions\n');
console.log('   rank  creature      score   eaten g   coarse   net   straight  mass g  bodies  name');
console.log('  ' + '-'.repeat(104));
for (const [i, x] of slate.entries()) {
  const plan = morphogenesis(x.genome);
  scoreOne(x.genome, 900, 0);
  const a = last ?? { eaten: 0, coarse: 0, net: 0, straight: 0 };
  console.log('  ' + String(i + 1).padStart(5) + '  ' + x.name.padEnd(12)
    + x.score.toFixed(2).padStart(9) + a.eaten.toFixed(2).padStart(10)
    + a.coarse.toFixed(1).padStart(9) + a.net.toFixed(1).padStart(7)
    + a.straight.toFixed(2).padStart(10) + totalMass(plan).toFixed(2).padStart(8)
    + String(plan.bodyCount).padStart(8)
    + String(signature(plan, x.genome).longestRun).padStart(5)
    + '  ' + (x.wild ? binomial(plan, x.genome).binomial : ''));
}

const bw = slate.find((x) => x.wild), ba = slate.find((x) => !x.wild);
console.log(`\n  best wild ${bw.score.toFixed(2)} vs best authored ${ba.score.toFixed(2)}`
  + `  ->  ${(bw.score / ba.score).toFixed(2)}x`);
console.log(`  ${trials} trials, ${(simSeconds / 3600).toFixed(1)} creature-hours, `
  + `${((Date.now() - t0) / 1000).toFixed(0)}s wall\n`);

writeFileSync(new URL('./_zwild2_out.json', import.meta.url), JSON.stringify(
  slate.filter((x) => x.wild).map((x, i) => ({
    i, name: `WILD ${i + 1}`, score: x.score,
    binomial: binomial(morphogenesis(x.genome), x.genome).binomial,
    mass: totalMass(morphogenesis(x.genome)), genome: x.genome,
  }))));
console.log('  genomes -> tools/_zwild2_out.json\n');
