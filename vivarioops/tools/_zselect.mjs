// tools/_zselect.mjs — RUN A SELECTION, ON THE ECONOMY.
//
//   node tools/_zselect.mjs [gens] [pop] [seconds]
//
// The tank's Burst selects on `speed`, `size` or `span`. This selects on the
// thing the Vivarium actually shows you — THE LEDGER RATIO, intake over spend —
// which is the only objective in the project that can answer "is this animal
// paying its way". A creature that swims beautifully and finds no food scores
// worse here than a slow one parked in a rich patch, and that is correct.
//
// ── THREE THINGS THIS DOES THAT `runForage` DOES NOT ───────────────────────
//
// 1. IT CHECKS THAT THE CREATURE IS STILL A CREATURE. `runForage` never looks at
//    `integrity()`, and a body that comes apart is the single most dangerous
//    thing that can happen to a selection run: its fragments sweep at the speed
//    ceiling, unlock food without limit, and report an intake that is pure
//    fiction — HANDOVER-FORAGE records one at 7864 g against 31-49 for its five
//    rivals. Selecting on that breeds exploders and nothing else. Any creature
//    whose bodies spread past BURST_SPREAD scores zero, and the count is
//    reported every generation so a run that is mostly wreckage says so.
//
// 2. IT RECORDS DISPLACEMENT, so the degenerate solution is visible rather than
//    merely absent. The obvious way to win on `ratio` is to not move: work falls
//    to nearly zero while the mouth keeps grazing whatever it is sitting in.
//    That is a real strategy and the field is finite, so it should lose over 300
//    seconds — but "should" is not "does", and a winner that never moved is a
//    result about the objective, not about the animal. Printed, never hidden.
//
// 3. IT SELECTS ON BALANCE, NOT ON RATIO — and this was MEASURED, not assumed.
//
//    The obvious objective is the ledger RATIO, because it is the number the
//    Vivarium prints. It is the wrong one, and the first calibration run said so
//    immediately: the winner of generation 0 scored 45x by moving 1.5 cm and
//    eating 0.43 g in sixty seconds. A ratio is a MARGIN. It is won by not
//    spending, and the cheapest way not to spend is not to move. Drifter — the
//    slow eel — scores 132x on exactly that strategy, eleven times Denis's own
//    Economic swimmer, while eating a fraction of what it eats.
//
//    `balance` is intake MINUS spend: profit, not margin. It cannot be won by
//    sitting still, because a creature that eats nothing has nothing to keep.
//    Both numbers are printed, because the pair is the actual finding: margin
//    tells you how efficient an animal is, balance tells you whether that
//    efficiency was worth anything.
//
//    THE RISK THIS INTRODUCES, stated so it can be checked rather than
//    discovered: balance may select for SIZE, since a bigger animal has more
//    mouths and sweeps more water. engine/l2/objective.js already records that
//    `size` and `span` are bigness objectives wearing other names. Mass and body
//    count are printed every generation, and the correlation with mass is
//    reported at the end. If the winner is merely large, that will be visible.
//
// Hybridisation is `breed()`'s own crossover, which ships at rate 1 — so every
// offspring slot that has two parents IS a hybrid. Nothing here re-implements it.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { seedPopulation, breed } from '../engine/l1/breed.js';
import { deserialise, serialise, genomeHash } from '../engine/l1/genome.js';
import { binomial } from '../engine/l1/naming.js';
import { makeFood, mouthsOf, forageStep, ledger, INGEST_RATE } from '../engine/l2/forage.js';
import { slotsOf, lineageFrom, vernacular } from '../engine/l1/vernacular.js';
import { W1_SLICE } from '../worlds/w1_slice.js';
import { SEEDS } from '../worlds/seeds.js';
import { rampFromTokens } from '../gate/vernacular.js';
import { readFileSync, writeFileSync } from 'node:fs';

await RAPIER.init();

const GENS = Number(process.argv[2] ?? 10);
const POP = Number(process.argv[3] ?? 24);
/**
 * 300 SECONDS, AND SHORTER IS A TRAP. engine/l2/forage.js:98-113 swept this and
 * the numbers are unambiguous:
 *
 *     T        eaten vs MASS     eaten vs body-lengths/s
 *      20 s        0.07               -0.17
 *      60 s        0.33               -0.06
 *     200 s        0.01               +0.37
 *     600 s       -0.01               +0.55
 *
 * Below ~200 s the trial is measuring SIZE and where the creature happened to
 * spawn; it does not reward swimming at all. A first run of this script used 120
 * and its winner was an 18-body animal that had moved 2.6 cm — which is what
 * that regime selects, not a foraging result. Do not lower this to make a run
 * finish sooner; lower the population instead.
 *
 * THE TELL, and it is worth knowing because it is visible without the sweep: at
 * 120 s the winner and Denis's Economic swimmer both ate 4.714 g — the same
 * number to four figures, from two completely different bodies. They spawn at
 * the same place and neither travels far enough to leave it, so both simply
 * empty the identical patch. Any time two unrelated creatures report the same
 * intake, the trial is too short to be about the creatures.
 */
const SECONDS = Number(process.argv[4] ?? 300);

/**
 * WHICH ECONOMY. `balance` is absolute net energy — individual profit, and the
 * question "which animal accumulates the most". `per-gram` divides it by body
 * mass — return on biomass invested, and the question "which BODY PLAN is worth
 * building". They do not pick the same animal and neither is the right one in
 * general, which is exactly why it is an argument.
 *
 * MEASURED, and this is why the switch exists at all: a `balance` run produced a
 * 37 g animal netting 63314 erg — 3.2x Denis's Economic swimmer — whose net
 * energy PER GRAM was 1693, the worst of every creature compared, against the
 * 0.97 g Eel's 17848. Balance-vs-mass over the final generation came out at
 * pearson 0.50. That result is real, not a bug: the metabolic bill already
 * scales as m^0.75 in `ledger`, so a big animal in profit is genuinely in
 * profit. It is simply an answer to a different question than the one a player
 * asking for a good swimmer is asking.
 */
const MODE = (process.argv[5] ?? 'balance').toLowerCase();
if (!['balance', 'per-gram'].includes(MODE)) throw new Error(`unknown objective ${MODE}`);
/** ui/screens/vivarium.js: measured, a normal pose is 0.5-1.5 and cannot reach 3. */
const BURST_SPREAD = 3;
const palette = rampFromTokens('w1');

/**
 * One economic trial. A FRESH FIELD PER CREATURE, same seed, so every animal
 * meets the identical field and the comparison is about the animal.
 */
function trial(genome, seconds = SECONDS) {
  let plan;
  try { plan = morphogenesis(genome); } catch (e) { return { ok: false, why: 'morphogenesis', ratio: 0 }; }
  const food = makeFood(W1_SLICE, { seed: 0xF00D });
  const mouths = mouthsOf(plan);
  const buf = mouths.map(() => [0, 0, 0]);
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, W1_SLICE, { bounded: true, wrap: false, effort: 1, turnBias: 0 });
  } catch (e) { return { ok: false, why: 'sim', ratio: 0 }; }

  const rate = W1_SLICE.INGEST_RATE ?? INGEST_RATE;
  const steps = Math.round(seconds / FIXED_DT);
  const start = sim.centreOfMass();
  let eaten = 0, burst = false;
  for (let st = 0; st < steps; st++) {
    try { sim.step(); } catch { break; }
    eaten += forageStep(sim, plan, food, mouths, FIXED_DT, rate, buf);
    // Once per simulated second: integrity() walks every body, and a burst is a
    // single-step event that nothing is gained by noticing 240 times a second.
    if (st % 240 === 0 && sim.integrity().spread > BURST_SPREAD) { burst = true; break; }
  }
  const end = sim.centreOfMass();
  const work = sim.workOut;
  sim.free();

  if (burst) return { ok: false, why: 'burst', score: -Infinity, ratio: 0, balance: 0 };
  const mass = totalMass(plan);
  const L = ledger(W1_SLICE, mass, eaten, work, seconds);
  const moved = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  return {
    ok: true,
    // THE OBJECTIVE. Per-gram is size-neutral BY CONSTRUCTION rather than by
    // hope — it cannot be won by growing, because growing divides.
    score: MODE === 'per-gram' ? L.balance / mass : L.balance,
    balance: L.balance,
    ratio: Number.isFinite(L.ratio) ? L.ratio : 0,
    eaten, moved, mass, bodies: plan.bodyCount, work, plan,
  };
}

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');

// ── the references ──────────────────────────────────────────────────────────
//
// Measured on EXACTLY the same trial as everything else. A benchmark run under
// different conditions is not a benchmark, and this is the whole reason the
// references go through `trial()` rather than through anything they were
// originally scored with.
//
// Eel and Drifter come out of worlds/seeds.js — they are the shipped animals and
// there is no reason to carry a second copy. `_zrefs.json` holds only what lives
// in a browser's IndexedDB and nowhere else.
const refs = [];
for (const id of ['eel', 'eel-slow']) {
  const s = SEEDS.find((x) => x.id === id);
  if (s) refs.push({ label: s.name, genome: s.genome });
}
try {
  for (const r of JSON.parse(readFileSync(new URL('./_zrefs.json', import.meta.url), 'utf8'))) {
    refs.push({ label: r.label, genome: deserialise(JSON.stringify(r.genome)) });
  }
} catch { console.log('  (no tools/_zrefs.json — running without the Atlas references)\n'); }

console.log(`\n  SELECTION ON THE LEDGER · ${GENS} generations x ${POP} population x ${SECONDS}s trials\n`);

const refScores = [];
for (const r of refs) {
  const t0 = Date.now();
  const s = trial(r.genome);
  refScores.push({ ...r, s });
  console.log(`  ref  ${r.label.padEnd(24)} score ${fmt(s.score, 0).padStart(9)}  balance ${fmt(s.balance, 0).padStart(9)}`
    + `  margin ${fmt(s.ratio).padStart(7)}x  eaten ${fmt(s.eaten, 4).padStart(8)} g`
    + `  moved ${fmt(s.moved, 1).padStart(6)} cm  ${fmt(s.mass).padStart(6)} g /${String(s.bodies ?? 0).padStart(3)}b`
    + `  ${s.ok ? '' : '[' + s.why + ']'}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
const bar = refScores.filter((r) => r.s.ok).reduce((a, b) => (b.s.balance > a ? b.s.balance : a), 0);
const barName = refScores.find((r) => r.s.balance === bar)?.label ?? '—';
console.log(`\n  bar to beat: ${fmt(bar, 0)} erg of net energy (${barName})\n`);

// ── the run ─────────────────────────────────────────────────────────────────
let pop = seedPopulation({
  RAPIER, rng: rngFrom('zselect', 'seed'), world: W1_SLICE, population: POP, authoredSlots: 0,
}).genomes;

let scores = new Array(POP).fill(-Infinity);
let measured = new Array(POP).fill(false);
let results = new Array(POP).fill(null);
let best = null;
const wall0 = Date.now();

for (let gen = 0; gen <= GENS; gen++) {
  let bursts = 0, dead = 0;
  for (let i = 0; i < pop.length; i++) {
    if (measured[i]) continue;
    const s = trial(pop[i]);
    results[i] = s;
    scores[i] = s.ok ? s.score : -Infinity;
    measured[i] = true;
    if (s.why === 'burst') bursts++;
    else if (!s.ok) dead++;
  }

  const order = scores.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const top = order[0];
  const champ = { gen, genome: pop[top[1]], ...results[top[1]] };
  if (!best || champ.score > best.score) best = champ;

  const alive = results.filter((r) => r?.ok).length;
  const median = order[Math.floor(order.length / 2)][0];
  const w = results[top[1]];
  console.log(`  gen ${String(gen).padStart(2)}  best ${fmt(top[0], 0).padStart(9)}`
    + `  median ${fmt(Number.isFinite(median) ? median : 0, 0).padStart(8)}`
    + `  margin ${fmt(w?.ratio).padStart(7)}x  bal ${fmt(w?.balance, 0).padStart(8)}  eaten ${fmt(w?.eaten, 2).padStart(6)} g`
    + `  moved ${fmt(w?.moved, 1).padStart(6)} cm  ${fmt(w?.mass).padStart(6)} g /${String(w?.bodies ?? 0).padStart(3)}b`
    + `  alive ${String(alive).padStart(2)}/${pop.length}  burst ${bursts}  bad ${dead}`
    + `  [${((Date.now() - wall0) / 1000).toFixed(0)}s]`);

  if (gen === GENS) break;

  // HALF THE POOL BREEDS, ranked. breed() keeps every selected genome in its own
  // slot as an elite (byte-identical, same object reference), fills the rest with
  // offspring — crossover at rate 1, so a two-parent slot IS a hybrid — and
  // reserves N17's stranger slots for fresh blood.
  const parents = order.slice(0, Math.max(2, POP >> 1)).map(([, i]) => i);
  const before = pop;
  pop = breed({
    RAPIER, genomes: pop, selected: parents,
    rng: rngFrom('zselect', 'breed', gen), world: W1_SLICE,
  }).genomes;
  // ONLY THE NEW BODIES ARE RESCORED. An elite comes back as the SAME OBJECT
  // REFERENCE, so identity is an exact test for "this creature did not change".
  measured = pop.map((g, i) => g === before[i] && measured[i]);
  scores = pop.map((g, i) => (measured[i] ? scores[i] : 0));
  results = pop.map((g, i) => (measured[i] ? results[i] : null));
}

// ── the verdict ─────────────────────────────────────────────────────────────
const bplan = morphogenesis(best.genome);
const bino = binomial(bplan, best.genome);
const lin = lineageFrom([slotsOf(bplan, best.genome, { palette, binomial: bino })]);
const vn = vernacular(bplan, best.genome, { palette, lineage: lin, binomial: bino });

console.log(`\n  WINNER — found at generation ${best.gen}`);
console.log(`    ${vn.display}`);
console.log(`    ${bino.binomial}`);
console.log(`    balance ${fmt(best.balance, 0)} erg · margin ${fmt(best.ratio)}x · eaten ${fmt(best.eaten, 4)} g`
  + ` · moved ${fmt(best.moved, 1)} cm · ${best.bodies} bodies · ${fmt(best.mass)} g`
  + ` · work ${best.work.toExponential(2)} erg`);
console.log(`\n  against the references — BALANCE is the objective; margin is shown so the`);
console.log(`  trade is visible, because the two do not rank the same animals:\n`);
for (const r of refScores) {
  const x = r.s.ok && r.s.score > 0 ? best.score / r.s.score : Infinity;
  console.log(`    ${r.label.padEnd(24)} score ${fmt(r.s.score, 0).padStart(9)}  ${fmt(x, 2).padStart(6)}x`
    + `   balance ${fmt(r.s.balance, 0).padStart(9)}   margin ${fmt(r.s.ratio).padStart(7)}x`
    + `   ${fmt(r.s.mass).padStart(6)} g`);
}

// IS THE WINNER MERELY LARGE? The risk `balance` introduces, checked rather than
// assumed. A high correlation here means the run found bigness, not foraging.
const fin = results.filter((r) => r?.ok);
if (fin.length > 3) {
  const mm = fin.map((r) => r.mass), bb = fin.map((r) => r.balance);
  const mu = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const ma = mu(mm), ba = mu(bb);
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < fin.length; i++) {
    const da = mm[i] - ma, db = bb[i] - ba;
    sab += da * db; sa += da * da; sb += db * db;
  }
  console.log(`\n  final generation, balance vs mass: pearson ${fmt(sab / Math.sqrt(sa * sb || 1), 2)}`
    + `  (mass ${fmt(Math.min(...mm))}-${fmt(Math.max(...mm))} g over ${fin.length} survivors)`);
}

writeFileSync(new URL(`./_zselect_winner${MODE === 'balance' ? '' : '_' + MODE}.json`, import.meta.url), JSON.stringify({
  hash: genomeHash(best.genome), mode: MODE, gen: best.gen, score: best.score,
  balance: best.balance, ratio: best.ratio, eaten: best.eaten,
  moved: best.moved, bodies: best.bodies, mass: best.mass,
  vernacular: vn.name, binomial: bino.binomial,
  // BOTH FORMS. `genome` is canonical (jointGenes is a MAP); `serialised` is the
  // array form deserialise() wants. A consumer that picks the wrong one throws.
  serialised: serialise(best.genome), genome: best.genome,
}, null, 1));
console.log(`\n  written to tools/_zselect_winner${MODE === 'balance' ? '' : '_' + MODE}.json\n`);
