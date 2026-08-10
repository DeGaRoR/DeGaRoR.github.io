// tools/_zgoalch2.mjs — DOES THE SECOND STEERING CHANNEL BUY ANYTHING?
//                                                    ⚠ WRITES ONE FILE (below)
//
//     node tools/_zgoalch2.mjs [population] [generations] [seed] [seconds] [distance]
//
// ── THE QUESTION, AND WHY `_zgoalevo`'s NULL ARM CANNOT ANSWER IT ────────────
//
// GENOME_V 7 added `preyGain2`/`threatGain2` and a second actuator channel. It is
// built, it is orthogonal to the first (90.0 deg on `staircase`, which is two
// hinges at exactly right angles, so that is the analytic answer; 97.5 deg on
// `spokebeast-banded`), and it is inert by construction on a single-plane body.
//
// What is NOT established is that it helps. Hand-setting both gains to 0.8 moved
// `spokebeast-banded` from 0.497 closure to 0.480 — slightly WORSE. That is not
// evidence against the channel; 0.8 is a number a person picked. The first
// channel's shipped value was 0.200 and selection found 0.484-1.275.
//
// `_zgoalevo`'s arms are SELECTION vs RANDOM SURVIVAL, which asks "does selection
// work". This asks a different question and needs a different control:
//
//     free   — mutation may reach preyGain2/threatGain2, as it can in the game
//     locked — both forced to 0 after every mutation, so channel B never speaks
//
// Both arms start from the SAME founders and are otherwise identical, so the only
// difference between them is whether the second output exists. Anything else —
// a null arm, a fresh draw — would confound the channel with the founding luck.
//
// ── FOUNDERS MUST HAVE THE ANATOMY, OR THE EXPERIMENT MEASURES NOTHING ───────
//
// Channel B's actuator weights are the projection of each joint's hinge axis onto
// the body's SECOND principal bend axis. A chain of parallel hinges has no such
// axis, the weights are all zero, and the gene is unreachable no matter what
// selection does to it — every eel in the library scores this way. So founders
// are screened on `max|axis2| >= AXIS2_MIN` before the run starts.
//
// THAT SCREEN IS A REAL LIMIT ON THE CLAIM and is stated in the output: this
// measures the channel's value TO BODIES THAT CAN USE IT, not to the corpus. The
// share of the corpus that can is a separate number and is printed too.
//
// ── WRITES ───────────────────────────────────────────────────────────────────
//
//   tools/_zgoalch2_seed<seed>.json — per-generation history and each arm's
//   winner. Gitignored with the other selection outputs.
import RAPIER from '@dimforge/rapier3d-compat';
import { writeFileSync } from 'node:fs';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { mutate } from '../engine/l1/mutate.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { assessViability } from '../engine/l1/viability.js';
import { turnAxis2 } from '../engine/l1/controller.js';
import { jointAxisAtSpawn } from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';
import { goalScore, prepare, DIRECTIONS_FAST } from './_zgoal.mjs';

await RAPIER.init();

const POP = Number(process.argv[2] ?? 12);
const GENS = Number(process.argv[3] ?? 5);
const SEED = Number(process.argv[4] ?? 0);
const SECONDS = Number(process.argv[5] ?? 40);
const DISTANCE = Number(process.argv[6] ?? 0);
const ELITE = Math.max(2, Math.round(POP * 0.3));

/**
 * How much second-axis anatomy a founder needs. 0.3 is a body whose hinges are
 * meaningfully off a single plane — `snarlback-teal` reads 0.113 and is excluded,
 * `protea` 0.451 and `spokebeast-banded` 0.953 are included. Not tuned: it is
 * the round number that separates "a rounding error off planar" from "actually
 * bends two ways", and the corpus share it admits is reported so the choice is
 * visible rather than buried.
 */
const AXIS2_MIN = 0.3;

const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const p50 = (v) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };

/** Max |projection onto the second bend axis| — 0 means channel B cannot act. */
function axis2Strength(genome) {
  let plan;
  try { plan = morphogenesis(genome); } catch { return 0; }
  if (!plan.jointCount) return 0;
  const ax = plan.joints.map((j) => jointAxisAtSpawn(j, plan));
  const w = turnAxis2(plan, ax);
  let m = 0;
  for (const v of w) m = Math.max(m, Math.abs(v));
  return m;
}

/** Both second-channel gains to zero. The `locked` arm's entire intervention. */
const lockCh2 = (g) => {
  g.controller.preyGain2 = 0;
  g.controller.threatGain2 = 0;
  return g;
};

function evaluate(genome) {
  const prep = prepare(RAPIER, genome, W1_SLICE);
  if (!prep || !(prep.speed > 1e-4)) return null;
  const r = goalScore(RAPIER, {
    plan: prep.plan, genome, world: W1_SLICE,
    plane: prep.plane, speed: prep.speed, seconds: SECONDS,
    dirs: DIRECTIONS_FAST, distance: DISTANCE,
  });
  if (!r.valid) return null;
  return {
    fitness: r.closure, bands: r.bands, speed: prep.speed,
    gain1: Math.abs((genome.controller.preyGain ?? 0) + (genome.controller.threatGain ?? 0)),
    gain2: Math.abs((genome.controller.preyGain2 ?? 0) + (genome.controller.threatGain2 ?? 0)),
    axis2: axis2Strength(genome),
  };
}

// ── founders: viable, mobile, and with a second bend axis to command ─────────
const founders = [];
/**
 * Kept only to prove a founder is a SUBJECT — viable, mobile, scorable — before
 * it is admitted. Its scores are no longer reused as generation 0, because the
 * two arms' generation 0 populations now differ by the treatment.
 */
const foundersScored = [];
let drawn = 0, planar = 0;
for (let i = 0; founders.length < POP && i < POP * 200; i++) {
  const g = createRandomGenome(rngFrom('goalch2', 'init', SEED, i));
  let plan;
  try { plan = morphogenesis(g); } catch { continue; }
  if (plan.jointCount < 2) continue;
  if (!assessViability(RAPIER, g, W1_SLICE).ok) continue;
  drawn++;
  if (axis2Strength(g) < AXIS2_MIN) { planar++; continue; }
  const r = evaluate(g);
  if (!r) continue;
  founders.push(g);
  foundersScored.push({ g, ...r });
}
if (founders.length < 3) {
  console.log(`_zgoalch2 seed ${SEED}: only ${founders.length} founders with a second bend axis — nothing to test.`);
  process.exit(0);
}

console.log('_zgoalch2 — is the SECOND steering channel worth anything under selection?');
console.log(`  seed ${SEED}   population ${POP}   elites ${ELITE}   ${GENS} generations   ${SECONDS} s`);
console.log(`  target ${DISTANCE > 0 ? `${DISTANCE} cm ABSOLUTE` : 'scaled to each creature'}`);
console.log(`  founders screened on max|axis2| >= ${AXIS2_MIN}: ${planar}/${drawn} viable draws were too planar to use it`);
console.log('  arms: FREE (mutation may reach preyGain2/threatGain2) vs LOCKED (both pinned to 0)');
console.log('  same founders, same everything else — the only difference is whether channel B exists\n');

function breedFrom(survivors, gen, arm) {
  const next = survivors.slice();
  let k = 0;
  while (next.length < POP && k < POP * 20) {
    const parent = survivors[k % survivors.length];
    // ⚠ THE ARM IS NOT IN THIS KEY, AND IT WAS. First run keyed the stream on
    // `arm`, so the two arms drew DIFFERENT mutations from generation 1 and were
    // two independent runs rather than a controlled comparison. It produced a
    // +0.16 closure gap in favour of the free arm whose winner carried
    // `threatGain2 = 0.036` — a gain 34x smaller than its own first channel, so
    // the channel could not have caused the gap. That was drift, read as signal.
    let child = mutate(parent, rngFrom('goalch2', SEED, gen, k)).genome;
    if (arm === 'locked') child = lockCh2(child);
    try { if (morphogenesis(child).jointCount >= 1) next.push(child); } catch { /* dead child */ }
    k++;
  }
  return next;
}

const history = { seed: SEED, pop: POP, gens: GENS, seconds: SECONDS, distance: DISTANCE, axis2Min: AXIS2_MIN, arms: {} };
const winners = {};

for (const arm of ['free', 'locked']) {
  // ── THE TREATMENT: THE FREE ARM'S FOUNDERS ACTUALLY HAVE THE CHANNEL ───────
  //
  // First run started BOTH arms at gain2 = 0, because that is what the factory
  // does (neutral at insertion, standing rule 4). It made the experiment
  // unanswerable in the length it was run. `jitter` from 0 has sigma 0.10, the
  // operator is drawn about every 23 mutations, so a random walk needs ~25 hits
  // — roughly 575 mutations, or 36 GENERATIONS at population 16 — before the
  // gain is large enough to change a trajectory. Eight generations could not
  // have shown an effect whether or not one exists, and the median creature in
  // the free arm finished at exactly 0.000 as that predicts.
  //
  // "Can a random walk from zero discover this gene?" and "given the gene, does
  // selection keep it?" are different questions. The second is the one worth
  // answering first, and it needs the channel present at generation 0. So the
  // free arm's founders are drawn across the gene's full legal range and the
  // locked arm's are pinned to zero. THAT DIFFERENCE IS THE TREATMENT — free
  // means the second output exists, locked means it does not.
  //
  // This departs from neutral-at-insertion DELIBERATELY AND ONLY IN THIS TOOL.
  // The factory still draws 0; nothing about the game changes. A measurement
  // instrument may set a variable the game leaves at its neutral value — that is
  // what an experiment is — as long as it says so, which is what this note is.
  let pop = founders.map((g, i) => {
    const c = structuredClone(g);
    if (arm === 'locked') return lockCh2(c);
    const r = rngFrom('goalch2', 'ch2seed', SEED, i);
    c.controller.preyGain2 = r.range(-1, 1);
    c.controller.threatGain2 = r.range(-1, 1);
    return c;
  });
  const rows = [];
  console.log(`  ── ${arm.toUpperCase()} ──`);
  console.log('  gen   closure p50   closure best   out-of-plane p50   |gain2| p50   speed p50   subjects');
  for (let gen = 0; gen < GENS; gen++) {
    // Generation 0 is NO LONGER shared between the arms — the free arm's founders
    // carry drawn `gain2` and the locked arm's do not, and that difference is the
    // treatment. Both are scored from their own population.
    const scored = [];
    for (const g of pop) { const r = evaluate(g); if (r) scored.push({ g, ...r }); }
    if (scored.length < 2) { console.log(`  ${gen}  too few subjects (${scored.length})`); break; }
    scored.sort((a, b) => b.fitness - a.fitness);
    const row = {
      gen,
      closureP50: p50(scored.map((s) => s.fitness)),
      closureBest: scored[0].fitness,
      outP50: p50(scored.map((s) => s.bands.out.closure)),
      gain2P50: p50(scored.map((s) => s.gain2)),
      speedP50: p50(scored.map((s) => s.speed)),
      subjects: scored.length,
    };
    rows.push(row);
    console.log(`  ${String(gen).padStart(3)}   ${row.closureP50.toFixed(4).padStart(10)}   ${row.closureBest.toFixed(4).padStart(11)}`
      + `   ${row.outP50.toFixed(4).padStart(16)}   ${row.gain2P50.toFixed(3).padStart(10)}`
      + `   ${row.speedP50.toFixed(4).padStart(9)}   ${String(row.subjects).padStart(8)}`);
    winners[arm] = { genome: scored[0].g, fitness: scored[0].fitness, gen };
    if (gen === GENS - 1) break;
    pop = breedFrom(scored.slice(0, Math.min(ELITE, scored.length)).map((s) => s.g), gen, arm);
  }
  history.arms[arm] = rows;
  console.log('');
}

const last = (a) => (a && a.length ? a[a.length - 1] : null);
const f = last(history.arms.free), l = last(history.arms.locked), f0 = history.arms.free?.[0];
console.log('  ── VERDICT ──');
if (f && l && f0) {
  console.log(`  closure p50      free ${f.closureP50.toFixed(4)}   locked ${l.closureP50.toFixed(4)}`
    + `   delta ${(f.closureP50 - l.closureP50 >= 0 ? '+' : '') + (f.closureP50 - l.closureP50).toFixed(4)}`);
  console.log(`  out-of-plane p50 free ${f.outP50.toFixed(4)}   locked ${l.outP50.toFixed(4)}`
    + `   delta ${(f.outP50 - l.outP50 >= 0 ? '+' : '') + (f.outP50 - l.outP50).toFixed(4)}`);
  console.log(`  |gain2| p50      gen0 ${f0.gain2P50.toFixed(3)} -> ${f.gain2P50.toFixed(3)} in the free arm`);
  console.log('  A free arm that does not beat the locked arm means the second output is not');
  console.log('  yet worth its schema. That is a reportable result, not a tuning prompt.');
}

writeFileSync(new URL(`./_zgoalch2_seed${SEED}.json`, import.meta.url), JSON.stringify({ ...history, winners }, null, 1));
console.log(`\n  written: tools/_zgoalch2_seed${SEED}.json`);
