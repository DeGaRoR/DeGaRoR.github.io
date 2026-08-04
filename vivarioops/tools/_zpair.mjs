// tools/_zpair.mjs — does PAIRING the trials beat running them independently?
//
// tools/_zsplit.mjs left one thing unresolved. Rank fidelity plateaus around
// rho 0.93-0.98 and the residual is between-run variance: the field a creature
// met and where it spawned. Duration barely touches it (42% -> 27% spread over
// forty minutes) and repeats made things worse, so the remaining lever is to stop
// the variance being DIFFERENTIAL — give every candidate in a round the identical
// field and the identical spawn point, so the round's luck is common-mode and
// cancels out of the comparison.
//
// ── THE DESIGN, and why it is exactly controlled ────────────────────────────
//
// Every creature is run against every CONDITION — a (field seed, spawn point)
// pair. That single set of trials then yields both schemes, with no re-simulation
// and no cost difference whatsoever:
//
//   PAIRED   round r = every creature on condition r. All candidates in a round
//            share the field and the spawn.
//   UNPAIRED round r = creature c on condition (r + c) mod C. Same conditions,
//            same count, same compute — only the ASSIGNMENT differs.
//
// So the two arms are not two experiments. They are two groupings of one
// experiment, which removes every confound except the thing being tested.
//
// The REFERENCE is the mean over ALL conditions at the longest mark: the
// field-averaged ordering, which is what both schemes are trying to estimate. It
// is not ground truth — it is the best estimate this dataset contains.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { seedPopulation } from '../engine/l1/breed.js';
import { authoredList } from '../worlds/atlas_seed.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import {
  makeFood, mouthsOf, forageStep, ledger, INGEST_RATE,
} from '../engine/l2/forage.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const T_MAX = Number(process.argv[2] ?? 600);
const CONDS = Number(process.argv[3] ?? 6);
const N_SEEDED = Number(process.argv[4] ?? 6);
const MARKS = [30, 60, 100, 150, 225, 300, 450, T_MAX].filter((t) => t <= T_MAX);

const corpus = authoredList().slice(0, 6)
  .map((e) => ({ name: e.commonName ?? '(authored)', genome: e.genome }))
  .concat(seedPopulation({
    RAPIER, rng: rngFrom('pair', 'corpus'), world: W1_SLICE,
    population: N_SEEDED, authoredSlots: 0,
  }).genomes.map((g, i) => ({ name: `seeded ${i + 1}`, genome: g })));

/** A condition is a field seed AND a spawn point. Both must be shared to pair. */
const condition = (k) => {
  const a = (k / CONDS) * Math.PI * 2;
  const r = Math.min(W1_SLICE.tankBounds[0], W1_SLICE.tankBounds[2]) / 4;
  return { seed: 7700 + k * 7919, origin: [Math.cos(a) * r, 0, Math.sin(a) * r] };
};

function trial(entry, k) {
  let plan;
  try { plan = morphogenesis(entry.genome); } catch { return null; }
  const mouths = mouthsOf(plan);
  if (!mouths.length) return null;
  const mass = totalMass(plan);
  const buf = mouths.map(() => [0, 0, 0]);
  const { seed, origin } = condition(k);
  const food = makeFood(W1_SLICE, { seed });
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, entry.genome, W1_SLICE, {
      bounded: false, wrap: true, effort: 1, turnBias: 0, origin,
    });
  } catch { return null; }
  const out = [];
  let eaten = 0, mark = 0;
  for (let st = 0; st < Math.round(T_MAX / FIXED_DT); st++) {
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

function spearman(xs, ys) {
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    idx.forEach(([, i], k) => { r[i] = k; });
    return r;
  };
  const a = rank(xs), b = rank(ys), n = xs.length, m = (n - 1) / 2;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - m) * (b[i] - m); da += (a[i] - m) ** 2; db += (b[i] - m) ** 2; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : NaN;
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

const t0 = Date.now();
const data = [];                                   // data[creature][condition][mark]
for (const e of corpus) {
  const row = [];
  for (let k = 0; k < CONDS; k++) { const v = trial(e, k); if (v) row.push(v); }
  if (row.length === CONDS) data.push(row);
  process.stdout.write('\r  ' + '.'.repeat(data.length));
}
const wall = (Date.now() - t0) / 1000;
const N = data.length, iMax = MARKS.length - 1;
const reference = data.map((row) => mean(row.map((v) => v[iMax])));

console.log(`\r  ${N} creatures x ${CONDS} conditions x ${T_MAX}s — ${wall.toFixed(0)}s wall`);
console.log(`  reference = mean over all ${CONDS} conditions at ${T_MAX}s`);
console.log('  PAIRED and UNPAIRED read the SAME trials, grouped differently, at identical cost\n');
console.log('       T   trials/creature      PAIRED      UNPAIRED      delta');
console.log('  ' + '-'.repeat(66));

const gains = [];
for (let m = 0; m < MARKS.length; m++) {
  for (let R = 1; R <= CONDS - 1; R++) {
    // PAIRED: everybody on conditions 0..R-1.
    const paired = data.map((row) => mean(row.slice(0, R).map((v) => v[m])));
    // UNPAIRED: creature c on conditions (0+c)..(R-1+c), wrapped. Same count.
    const unpaired = data.map((row, c) => mean(
      Array.from({ length: R }, (_, j) => row[(j + c) % CONDS][m])));
    const rp = spearman(paired, reference);
    const ru = spearman(unpaired, reference);
    gains.push({ T: MARKS[m], R, rp, ru, d: rp - ru });
    if (R > 2 && R < CONDS - 1) continue;          // keep the table readable
    console.log('  ' + `${MARKS[m]}s`.padStart(6) + String(R).padStart(17)
      + rp.toFixed(3).padStart(12) + ru.toFixed(3).padStart(14)
      + (rp - ru >= 0 ? '+' : '') + (rp - ru).toFixed(3).padStart(10));
  }
}

const better = gains.filter((g) => g.d > 0.001).length;
const worse = gains.filter((g) => g.d < -0.001).length;
console.log(`\n  paired better in ${better} of ${gains.length} cells, worse in ${worse}`);
console.log(`  mean delta ${mean(gains.map((g) => g.d)).toFixed(4)}`);
const at1 = gains.filter((g) => g.R === 1);
console.log(`  at R = 1 (one trial per creature, the burst case): mean delta `
  + `${mean(at1.map((g) => g.d)).toFixed(4)}`);
console.log('\n  delta > 0 means pairing recovers ordering that independent trials lose.');
console.log('  Cost is identical by construction, so any positive delta is free.\n');
