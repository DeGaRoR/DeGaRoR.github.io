// tools/_zsettle.mjs — HOW LONG must a forage trial run before the energy
// multiplier can be selected on?
//
// THE QUESTION BEHIND IT is auto-breeding inside Forage: a burst needs to score a
// pool of creatures, and every second of trial is multiplied by the pool size and
// the number of rounds. Too short and the objective is noise wearing a number; too
// long and a burst takes a coffee break. This measures where the compromise is.
//
// ── WHAT "STABILISED" HAS TO MEAN, AND IT IS NOT WHAT IT LOOKS LIKE ──────────
//
// A flat trajectory is NOT enough. Selection does not consume the ratio, it
// consumes the ORDER: `burstSelection` keeps the top half, so what has to settle
// is the RANKING, and a ranking can be stable while every value is still moving.
//
// And a curve that looks converged in one run is worth nothing if a re-run with a
// different field ranks the same creatures differently. So three things are
// measured, and the slowest of them is the answer:
//
//   1. VALUE      |ratio(T) - ratio(final)| / ratio(final), median over the corpus.
//   2. ORDER      Spearman rank correlation of ranking(T) against ranking(final).
//   3. RELIABILITY between-REPEAT spread at T, over independent field seeds and
//                 spawn points. This is the one that decides whether the number
//                 can be trusted, and it is invisible in a single run.
//
// ── HOW THE TRIALS ARE RUN ──────────────────────────────────────────────────
//
// One creature per simulation, its own fresh copy of the field — which is what
// `foodEaten` already requires ("or the trial order decides the result: the second
// creature would forage a field the first had already stripped"), and it is also
// what an auto-breed inside Forage would have to do. So no shared arena and no
// collision question arises here at all.
//
// Open water (`bounded: false, wrap: true`): tools/_zwall.mjs measured the walled
// tank as putting 4 of 6 creatures on the glass within 104 s, which would make
// this a measurement of cornering rather than of foraging.
//
// The corpus is deliberately MIXED — authored creatures plus seeded ones — because
// the authored few are hand-made and similar, and a settling time calibrated on
// them alone would not survive contact with the population a burst actually scores.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { seedPopulation } from '../engine/l1/breed.js';
import { authoredList } from '../worlds/atlas_seed.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import {
  makeFood, mouthsOf, mouthPoints, forageStep, ledger, INGEST_RATE,
} from '../engine/l2/forage.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const T_MAX = Number(process.argv[2] ?? 2400);
const REPEATS = Number(process.argv[3] ?? 3);
const N_SEEDED = Number(process.argv[4] ?? 6);

/** Where the ratio is read. Dense early, where it is still moving. */
const MARKS = [15, 30, 60, 120, 240, 400, 600, 900, 1200, 1800, T_MAX].filter((t) => t <= T_MAX);

const authored = authoredList().slice(0, 6).map((e) => ({
  name: e.commonName ?? '(authored)', genome: e.genome, kind: 'authored',
}));
const seeded = seedPopulation({
  RAPIER, rng: rngFrom('settle', 'corpus'), world: W1_SLICE,
  population: N_SEEDED, authoredSlots: 0,
}).genomes.map((g, i) => ({ name: `seeded ${i + 1}`, genome: g, kind: 'seeded' }));
const corpus = authored.concat(seeded);

/** One trial. Returns the ratio at every mark. */
function trial(entry, repeat) {
  let plan;
  try { plan = morphogenesis(entry.genome); } catch { return null; }
  const mass = totalMass(plan);
  const mouths = mouthsOf(plan);
  if (!mouths.length) return null;
  const buf = mouths.map(() => [0, 0, 0]);
  // A DIFFERENT FIELD AND A DIFFERENT SPAWN PER REPEAT. Same field every time
  // would measure the trajectory's smoothness, not its reliability.
  const food = makeFood(W1_SLICE, { seed: 9001 + repeat * 7919 });
  const a = (repeat / Math.max(1, REPEATS)) * Math.PI * 2;
  const r = Math.min(W1_SLICE.tankBounds[0], W1_SLICE.tankBounds[2]) / 4;
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, entry.genome, W1_SLICE, {
      bounded: false, wrap: true, effort: 1, turnBias: 0,
      origin: [Math.cos(a) * r, 0, Math.sin(a) * r],
    });
  } catch { return null; }

  const out = [];
  let eaten = 0, mark = 0;
  const steps = Math.round(T_MAX / FIXED_DT);
  for (let st = 0; st < steps; st++) {
    try { sim.step(); } catch { break; }
    eaten += forageStep(sim, plan, food, mouths, FIXED_DT, INGEST_RATE, buf);
    const t = (st + 1) * FIXED_DT;
    while (mark < MARKS.length && t >= MARKS[mark]) {
      out.push(ledger(W1_SLICE, mass, eaten, sim.work, MARKS[mark]).ratio);
      mark++;
    }
  }
  while (out.length < MARKS.length) out.push(out[out.length - 1] ?? 0);
  sim.free();
  return out;
}

const median = (a) => {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};

/** Spearman: Pearson on ranks. Ties are rare here and broken by index. */
function spearman(xs, ys) {
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    idx.forEach(([, i], k) => { r[i] = k; });
    return r;
  };
  const a = rank(xs), b = rank(ys), n = xs.length;
  const ma = (n - 1) / 2;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - ma); da += (a[i] - ma) ** 2; db += (b[i] - ma) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : NaN;
}

// ── run ─────────────────────────────────────────────────────────────────────
const t0 = Date.now();
// results[creature][repeat][mark]
const results = corpus.map((e) => {
  const reps = [];
  for (let r = 0; r < REPEATS; r++) {
    const v = trial(e, r);
    if (v) reps.push(v);
  }
  process.stdout.write(`\r  ${reps.length ? '.' : 'x'}`);
  return reps;
});
const wall = (Date.now() - t0) / 1000;
const live = corpus.map((e, i) => ({ e, reps: results[i] })).filter((x) => x.reps.length >= 2);

console.log(`\r  ${live.length} creatures (${live.filter((x) => x.e.kind === 'authored').length} authored, `
  + `${live.filter((x) => x.e.kind === 'seeded').length} seeded) x ${REPEATS} repeats x ${T_MAX}s`);
console.log(`  ${wall.toFixed(0)}s wall total — ${(wall / (live.length * REPEATS)).toFixed(1)}s per trial\n`);

// Per-creature ratio at the final mark, averaged over repeats: the reference.
const finalOf = (x) => median(x.reps.map((r) => r[MARKS.length - 1]));
const finals = live.map(finalOf);

console.log('     T     value err   rank vs final   repeat spread   trial cost   verdict');
console.log('  ' + '-'.repeat(84));
for (let m = 0; m < MARKS.length; m++) {
  const at = live.map((x) => median(x.reps.map((r) => r[m])));
  const relErr = median(at.map((v, i) => (finals[i] > 0 ? Math.abs(v - finals[i]) / finals[i] : NaN)));
  const rho = spearman(at, finals);
  // Between-repeat spread at this mark: the reliability number.
  const cv = median(live.map((x) => {
    const v = x.reps.map((r) => r[m]).filter(Number.isFinite);
    if (v.length < 2) return NaN;
    const mu = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (v.length - 1));
    return mu > 0 ? sd / mu : NaN;
  }));
  const cost = (wall / (live.length * REPEATS)) * (MARKS[m] / T_MAX);
  const ok = rho >= 0.9 && cv <= 0.25;
  console.log('  ' + String(MARKS[m]).padStart(5) + 's'
    + (relErr * 100).toFixed(0).padStart(10) + '%'
    + rho.toFixed(3).padStart(15)
    + (cv * 100).toFixed(0).padStart(15) + '%'
    + cost.toFixed(2).padStart(12) + 's'
    + '   ' + (ok ? 'USABLE' : ''));
}

console.log('\n  value err   median |ratio(T) - ratio(final)| / ratio(final)');
console.log('  rank        Spearman of ranking(T) vs ranking(final) — what selection actually consumes');
console.log('  spread      median between-repeat coefficient of variation — the RELIABILITY number');
console.log('  USABLE      rank >= 0.90 AND repeat spread <= 25%\n');
