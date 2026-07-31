// tools/_zauto.mjs — IS THE AUTO-BURST WORTH RUNNING? (B2 §9 step 6)
//
// Three questions, in the order B2 §10 insists on, and the third is the one that
// has sunk results in this project before.
//
//   1. WHAT DOES IT COST? Wall time per trial and per burst.
//   2. IS THE OBJECTIVE RELIABLE? A score that does not agree with itself cannot
//      rank anything. Split-half here is WITHIN-TRIAL — the first half of the
//      window against the second — because the objective is deterministic given
//      a genome, so re-running it would correlate at exactly 1.00 and measure
//      nothing. That is the same defect as _diversity.mjs's id signature: a
//      statistic that cannot fail.
//   3. IS IT A CONFOUND? "Correlate every new metric against a confound before
//      believing it." The seek score was 0.90 correlated with net speed; the
//      solver speed metric was 0.60 correlated with spherical-joint fraction.
//      Body count and mass are the candidates here — chantier 1 moved mean
//      bodies from 3.91 to 9.78, so an objective that mostly measures size would
//      now be measuring chantier 1.
//   4. AND THE NULL ARM. "A 28x selection result was reproduced by random
//      survivors." The burst is run twice, identically, once selecting on the
//      score and once selecting at random. Only the DIFFERENCE is a result.
//
//   node tools/_zauto.mjs [corpus] [replicates]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom, makeRng } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { runSolo } from '../engine/l2/probe.js';
import { netSpeed, autoBurst, scorePopulation, TRIAL_SECONDS } from '../engine/l2/objective.js';
import { seedPopulation, POPULATION } from '../engine/l1/breed.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const CORPUS = Number(process.argv[2] ?? 120);
const REPLICATES = Number(process.argv[3] ?? 6);
await RAPIER.init();

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb += db * db; }
  return sa > 0 && sb > 0 ? sab / Math.sqrt(sa * sb) : 0;
}

// Spearman as well as Pearson: the score distribution has a long tail (p50
// 0.010, max 1.39) and a single fast creature can carry a Pearson on its own.
function spearman(a, b) {
  const rank = (xs) => {
    const idx = xs.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v);
    const r = new Array(xs.length);
    idx.forEach((e, k) => { r[e.i] = k; });
    return r;
  };
  return pearson(rank(a), rank(b));
}

// ── 1 + 2 + 3 · the objective itself ────────────────────────────────────────
const genomes = [], plans = [];
for (let i = 0; i < CORPUS; i++) {
  const g = createRandomGenome(rngFrom('obj', i));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.bodyCount < 2) continue;
  genomes.push(g); plans.push(p);
}

const t0 = Date.now();
const score = [], firstHalf = [], secondHalf = [], bodies = [], mass = [];
for (let i = 0; i < genomes.length; i++) {
  const r = netSpeed(RAPIER, { plan: plans[i], genome: genomes[i], world: W1_SLICE });
  score.push(r.valid ? r.score : 0);
  bodies.push(plans[i].bodyCount);
  mass.push(totalMass(plans[i]));

  // Split-half within the same run, so the two halves share every condition
  // except the interval they cover.
  const s = runSolo(RAPIER, {
    plan: plans[i], genome: genomes[i], world: W1_SLICE,
    duration: TRIAL_SECONDS, effort: 1, turnBias: 0, bounded: false, wrap: true,
  });
  const tr = s.trace, n = tr.n, mid = Math.floor(n / 2);
  const seg = (a, b) => {
    if (b <= a) return 0;
    const d = Math.hypot(tr.com[b * 3] - tr.com[a * 3],
                         tr.com[b * 3 + 1] - tr.com[a * 3 + 1],
                         tr.com[b * 3 + 2] - tr.com[a * 3 + 2]);
    const dt = tr.t[b] - tr.t[a];
    return dt > 0 && Number.isFinite(d) ? d / dt : 0;
  };
  firstHalf.push(seg(0, mid));
  secondHalf.push(seg(mid, n - 1));
}
const wall = (Date.now() - t0) / 1000;

const sorted = score.slice().sort((a, b) => a - b);
const pct = (q) => sorted[Math.floor(sorted.length * q)];

console.log(`\n  _zauto · ${genomes.length} creatures x ${TRIAL_SECONDS} s, on the torus\n`);
console.log(`  COST         ${wall.toFixed(1)} s wall for ${genomes.length * 2} trials `
  + `(${(1000 * wall / (genomes.length * 2)).toFixed(0)} ms each)`);
console.log(`  SCORE        p50 ${pct(0.5).toFixed(4)}  p90 ${pct(0.9).toFixed(4)}  max ${pct(0.999).toFixed(3)} m/s`);
console.log(`\n  RELIABILITY  split-half (first 3 s vs last 3 s)`);
console.log(`               pearson  ${pearson(firstHalf, secondHalf).toFixed(2)}`
  + `    spearman ${spearman(firstHalf, secondHalf).toFixed(2)}      design: r = 0.78`);
console.log(`\n  CONFOUNDS    correlate the score against what it must NOT be measuring`);
console.log(`               body count   pearson ${pearson(score, bodies).toFixed(2)}   spearman ${spearman(score, bodies).toFixed(2)}`);
console.log(`               total mass   pearson ${pearson(score, mass).toFixed(2)}   spearman ${spearman(score, mass).toFixed(2)}`);

// ── 4 · the null arm ────────────────────────────────────────────────────────
console.log(`\n  NULL ARM     ${REPLICATES} replicate bursts, identical seeds, score vs random survivors\n`);
const rows = [];
for (let rep = 0; rep < REPLICATES; rep++) {
  const seedPop = seedPopulation({ RAPIER, rng: makeRng(3000 + rep), world: W1_SLICE });
  const before = scorePopulation(RAPIER, seedPop.genomes, W1_SLICE);
  const beforeBest = Math.max(...before);

  const out = {};
  for (const selection of ['score', 'random']) {
    const r = autoBurst({
      RAPIER, genomes: seedPop.genomes, rng: makeRng(9000 + rep),
      world: W1_SLICE, selection,
    });
    out[selection] = { best: Math.max(...r.scores), trials: r.trials };
  }
  rows.push({ rep, beforeBest, ...out });
}
console.log(`  ${'rep'.padStart(4)} ${'before'.padStart(10)} ${'score-sel'.padStart(11)} ${'random-sel'.padStart(11)}   gain vs null`);
let improved = 0;
for (const r of rows) {
  const gain = r.score.best - r.random.best;
  if (r.score.best > r.random.best) improved++;
  console.log(`  ${String(r.rep).padStart(4)} ${r.beforeBest.toFixed(4).padStart(10)} `
    + `${r.score.best.toFixed(4).padStart(11)} ${r.random.best.toFixed(4).padStart(11)}   ${gain >= 0 ? '+' : ''}${gain.toFixed(4)}`);
}
const meanS = rows.reduce((a, r) => a + r.score.best, 0) / rows.length;
const meanR = rows.reduce((a, r) => a + r.random.best, 0) / rows.length;
const meanB = rows.reduce((a, r) => a + r.beforeBest, 0) / rows.length;
console.log(`\n  mean best    before ${meanB.toFixed(4)}   score-selected ${meanS.toFixed(4)}   random-selected ${meanR.toFixed(4)}`);
console.log(`  selection beats the null arm in ${improved}/${rows.length} replicates`);
console.log(`  trials per burst: ${rows[0].score.trials}\n`);
