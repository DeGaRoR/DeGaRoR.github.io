// tools/_zherit.mjs — IS ANY OF THIS HERITABLE?  ⚠ WRITES ONE FILE (see below)
//
//     node tools/_zherit.mjs [parents] [kidsPerParent] [seconds] [distance] [mode]
//
//     mode: clonal      mutate(parent) — what every selection tool here does
//           recombinant breed() with two selected parents — what the TANK does
//
// ── WHY THIS RUNS BEFORE ANY MORE SELECTION RUNS ─────────────────────────────
//
// Eight selection experiments in this project have chosen an objective, run it,
// and reported whether the number went up. Not one of them measured the quantity
// that decides whether the number CAN go up.
//
//     R = b . S            response = parent-offspring regression x selection differential
//
// `S` is free — it is whatever the truncation threshold is — and every tool here
// has been tuning it. `b` is a property of the trait and the mutation operator
// TOGETHER, it is the entire ceiling on what selection can do in one generation,
// and its value in this codebase is unknown. A trait with b = 0 cannot be bred
// for at any population size, for any number of generations, with any objective
// weighting. Running selection on it is not a slow method; it is not a method.
//
// ── b IS THE WHOLE HERITABILITY IN CLONAL MODE, NOT HALF OF IT ───────────────
//
// In a sexual diploid population the single-parent offspring regression is h^2/2
// and the midparent regression is h^2. NEITHER APPLIES to `clonal`. `_zgoalevo`,
// `_zgoalch2` and `_evolve_seek` all reproduce clonally — `mutate(parent)`, one
// parent, no recombination — so the offspring's expected value given the parent
// is the parent's own value degraded by mutation, and the regression slope of
// offspring on parent is directly the multiplier on the selection differential.
// There is no factor of two to argue about, which is worth saying because
// getting it wrong in either direction is a 2x error in every prediction.
//
// `recombinant` mode is the OTHER operator, and it is the one that matters for
// the game: `SLICE_LIMITS.crossoverRate` is 1, so every offspring slot in
// `breed()` that has two selected parents IS a hybrid. There the regression is
// taken on the MIDPARENT, which is the standard construction for a two-parent
// cross, and it answers a question the clonal number cannot: does mixing two
// animals produce children that resemble the pair, or does it scramble them?
// A tank whose crossover slope is near zero would mean the player's central act
// — choosing which two creatures should have children together — does nothing.
//
// ── ONE ZYGOTE PER CHILD, AND DEAD CHILDREN ARE DATA ─────────────────────────
//
// `VIABILITY.maxAttempts` is 12 in the tank. Re-rolling a dead child means every
// parent gets the same number of offspring regardless of how fragile its
// developmental neighbourhood is, which erases the exact quantity a breeding
// programme most wants to see. Here a dead child is a dead child, and the
// per-parent survival rate is reported as a trait of the parent in its own right.
//
// ── WRITES ───────────────────────────────────────────────────────────────────
//
//   tools/_zherit_out.json — every parent and child row, so a later analysis can
//   re-slice this without paying for the simulation again.
import RAPIER from '@dimforge/rapier3d-compat';
import { writeFileSync } from 'node:fs';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { mutate } from '../engine/l1/mutate.js';
import { breed, KIND } from '../engine/l1/breed.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { assessViability } from '../engine/l1/viability.js';
import W1_SLICE from '../worlds/w1_slice.js';
import { goalScore, prepare, DIRECTIONS_FAST, GOAL_MIN_DIST } from './_zgoal.mjs';

await RAPIER.init();

const PARENTS = Number(process.argv[2] ?? 40);
const KIDS = Number(process.argv[3] ?? 4);
const SECONDS = Number(process.argv[4] ?? 40);
/**
 * ONE TASK FOR EVERYONE, AND IT IS FIXED IN CENTIMETRES.
 *
 * `goalScore`'s default scales the target to each creature's own cruise speed,
 * which makes two creatures comparable as BODIES and makes them incomparable as
 * candidates: they are being set different exams. HANDOVER-STEERING records what
 * that cost — winners that aim beautifully and cannot travel.
 *
 * The default is `GOAL_MIN_DIST` (4.5 cm, three capture radii) rather than the
 * tank's 8 cm, because a random-founder corpus cruises at 0.005-0.022 cm/s and
 * covers under 1 cm in this window. At 8 cm every creature scores its own noise
 * and the regression measures nothing. THAT IS ITSELF A FINDING and it is the
 * argument for a task that tracks the population — see the report at the end.
 */
const DISTANCE = Number(process.argv[5] ?? GOAL_MIN_DIST);
const MODE = (process.argv[6] ?? 'clonal').toLowerCase();
if (!['clonal', 'recombinant'].includes(MODE)) throw new Error(`unknown mode ${MODE}`);

/**
 * A RECOMBINANT FAMILY, THROUGH THE SHIPPED PATH.
 *
 * `breed()` cannot be asked for offspring at population 2: `strangerCount(2)`
 * is 1 and the elite cap is therefore 1, so a two-slot tank holds one elite and
 * one stranger and produces no children at all. At six — the tank's own size —
 * two selected parents give two elites, one stranger and three offspring, and
 * every one of those three is a recombinant because `crossoverRate` is 1.
 *
 * `viabilityAttempts: 1` for the reason at the top of this file: one zygote per
 * reproductive event wherever selection is being measured.
 */
function recombinants(a, b, key, want) {
  const out = [];
  for (let call = 0; out.length < want && call < 6; call++) {
    const genomes = [a, b, a, b, a, b];
    let r;
    try {
      r = breed({
        RAPIER, genomes, selected: [0, 1], rng: rngFrom('zherit', 'cross', key, call),
        world: W1_SLICE, limits: SLICE_LIMITS, viabilityAttempts: 1,
      });
    } catch { break; }
    for (let i = 0; i < r.genomes.length && out.length < want; i++) {
      if (r.provenance[i]?.kind !== KIND.OFFSPRING) continue;
      out.push({ genome: r.genomes[i], crossed: !!r.provenance[i].crossed, fellBack: !!r.provenance[i].fellBack });
    }
  }
  return out;
}

/** Traits regressed. Order is the print order. */
const TRAITS = [
  ['speed', 'cruise cm/s'],
  ['closure', 'live - blind'],
  ['live', 'raw closure'],
  ['arrived', 'fraction of dirs'],
  ['straightness', 'blind net/path'],
  ['loopClosure', 'blind, 0 = circle'],
  ['planarity', '1 = flat path'],
  ['gain', '|preyG + threatG|'],
  ['mass', 'g'],
  ['bodies', 'count'],
];

/**
 * One evaluation, shared by parents and children so every trait in a row comes
 * from the same simulation. Returns null for a NON-SUBJECT — inviable, no
 * measurable cruise, no steering plane, or it came apart. A non-subject is not a
 * zero: "cannot be simulated" and "can be simulated and does not steer" are
 * different facts and averaging them together is how `_zgoalevo`'s founders
 * screen came to exist.
 */
function evaluate(genome) {
  const prep = prepare(RAPIER, genome, W1_SLICE);
  if (!prep || !(prep.speed > 1e-6)) return null;
  const r = goalScore(RAPIER, {
    plan: prep.plan, genome, world: W1_SLICE, plane: prep.plane,
    speed: prep.speed, seconds: SECONDS, dirs: DIRECTIONS_FAST, distance: DISTANCE,
  });
  if (!r.valid) return null;
  return {
    speed: prep.speed,
    closure: r.closure,
    live: r.live,
    blind: r.blind,
    arrived: r.arrived,
    straightness: r.shape.straightness,
    loopClosure: r.shape.loopClosure,
    planarity: r.shape.planarity,
    excursion: r.shape.excursion,
    gain: Math.abs((genome.controller.preyGain ?? 0) + (genome.controller.threatGain ?? 0)),
    mass: totalMass(prep.plan),
    bodies: prep.plan.bodyCount,
  };
}

// ── the parents: random draws only ───────────────────────────────────────────
//
// NO AUTHORED STOCK, and that is a constraint on the whole programme rather than
// a property of this tool. A number measured on eel descendants would describe
// the eel's neighbourhood in genome space, which is the one place this project
// already knows selection works.
const rows = [];
let drawn = 0, inviable = 0, notSubject = 0;
process.stdout.write('  drawing parents');
for (let i = 0; rows.length < PARENTS && i < PARENTS * 60; i++) {
  const g = createRandomGenome(rngFrom('zherit', 'init', i));
  drawn++;
  let plan;
  try { plan = morphogenesis(g); } catch { inviable++; continue; }
  if (plan.jointCount < 1) { inviable++; continue; }
  if (!assessViability(RAPIER, g, W1_SLICE).ok) { inviable++; continue; }
  const p = evaluate(g);
  if (!p) { notSubject++; continue; }
  rows.push({ i, genome: g, parent: p, kids: [], born: 0, died: 0 });
  process.stdout.write('.');
}
console.log('');
if (rows.length < 8) { console.log(`  only ${rows.length} parents — nothing to regress.`); process.exit(0); }

console.log(`\n_zherit — ${MODE === 'clonal'
  ? 'parent-offspring regression, clonal (mutation-only) reproduction'
  : 'MIDPARENT-offspring regression, through breed() with two selected parents'}`);
console.log(`  ${rows.length} parents, ${KIDS} children per family   ${SECONDS} s trials`
  + `   target ${DISTANCE.toFixed(2)} cm ABSOLUTE`);
console.log(`  draws ${drawn}: ${inviable} inviable, ${notSubject} viable-but-not-a-subject, ${rows.length} kept`);
console.log(`  one zygote per child; a dead child stays dead\n`);

/** Traits of a family's reference point: the parent, or the midparent. */
const midparent = (a, b) => Object.fromEntries(TRAITS.map(([t]) => [t, (a[t] + b[t]) / 2])
  .concat([['excursion', (a.excursion + b.excursion) / 2]]));

// ── the children ─────────────────────────────────────────────────────────────
const families = [];
process.stdout.write('  breeding');
if (MODE === 'clonal') {
  for (const row of rows) {
    const f = { parent: row.parent, kids: [], born: 0, died: 0, crossed: 0, fellBack: 0 };
    for (let k = 0; k < KIDS; k++) {
      f.born++;
      let child;
      try { child = mutate(row.genome, rngFrom('zherit', 'kid', row.i, k)).genome; } catch { f.died++; continue; }
      const c = evaluate(child);
      if (!c) { f.died++; continue; }
      f.kids.push(c);
    }
    families.push(f);
    process.stdout.write(f.kids.length ? '.' : 'x');
  }
} else {
  // PAIRED IN DRAW ORDER, which is arbitrary and therefore unbiased. Pairing by
  // rank would confound the slope with assortative mating: mating like to like
  // inflates the between-family variance and the regression with it.
  for (let p = 0; p + 1 < rows.length; p += 2) {
    const A = rows[p], B = rows[p + 1];
    const f = { parent: midparent(A.parent, B.parent), kids: [], born: 0, died: 0, crossed: 0, fellBack: 0 };
    for (const kid of recombinants(A.genome, B.genome, `${A.i}:${B.i}`, KIDS)) {
      f.born++;
      if (kid.crossed) f.crossed++;
      // A FALLBACK CHILD IS PARENT A UNCHANGED, not a child. Counting it would
      // report the parent's own trait as an offspring value and drive the slope
      // toward 1 for reasons that have nothing to do with inheritance.
      if (kid.fellBack) { f.died++; continue; }
      const c = evaluate(kid.genome);
      if (!c) { f.died++; continue; }
      f.kids.push(c);
    }
    families.push(f);
    process.stdout.write(f.kids.length ? '.' : 'x');
  }
}
console.log('\n');

// ── statistics ───────────────────────────────────────────────────────────────
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
function regress(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return { b: sxx > 0 ? sxy / sxx : 0, r: sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0, n: x.length };
}

/**
 * Standard error of a regression slope, and it is printed because the whole
 * decision this tool exists to inform is "is b distinguishable from zero". A
 * slope of 0.18 at n = 40 with se 0.16 is not a finding, and quoting it as one is
 * how a trait gets selected on for five sessions.
 */
function slopeSE(x, y, b) {
  const mx = mean(x), my = mean(y);
  let sxx = 0, sse = 0;
  for (let i = 0; i < x.length; i++) sxx += (x[i] - mx) ** 2;
  for (let i = 0; i < x.length; i++) sse += (y[i] - (my + b * (x[i] - mx))) ** 2;
  return x.length > 2 && sxx > 0 ? Math.sqrt(sse / (x.length - 2) / sxx) : Infinity;
}

const withKids = families.filter((f) => f.kids.length > 0);
console.log(`  families with at least one surviving child: ${withKids.length}/${families.length}`);
const survival = mean(families.map((f) => (f.born ? (f.born - f.died) / f.born : 0)));
console.log(`  child survival, one zygote per child: ${(100 * survival).toFixed(0)}%`
  + `   (families with none: ${families.filter((f) => !f.kids.length).length})`);
if (MODE === 'recombinant') {
  const born = families.reduce((a, f) => a + f.born, 0);
  console.log(`  crossover actually fired on ${families.reduce((a, f) => a + f.crossed, 0)}/${born} zygotes`
    + `   (SLICE_LIMITS.crossoverRate = ${SLICE_LIMITS.crossoverRate})`);
}
console.log('');

const REF = MODE === 'clonal' ? 'parent' : 'midpar';
console.log(`  trait            ${REF} p50    child p50   ${REF} sd     b      se      r      b/se   verdict`);
const table = {};
for (const [t, note] of TRAITS) {
  const x = withKids.map((r) => r.parent[t]);
  const y = withKids.map((r) => mean(r.kids.map((k) => k[t])));
  const { b, r } = regress(x, y);
  const se = slopeSE(x, y, b);
  const z = se > 0 && Number.isFinite(se) ? b / se : 0;
  const med = (a) => { const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
  table[t] = { b, se, r, n: x.length, parentSd: sd(x), parentMed: med(x), childMed: med(y) };
  // PRE-DECLARED, so the reading is not chosen after seeing the numbers. |b/se|
  // under 2 is a slope that has not been shown to differ from zero at this n;
  // b under 0.1 is a slope so shallow that the response per generation is under
  // a tenth of the selection differential whatever its significance.
  const verdict = !(Math.abs(z) >= 2) ? 'NOT MEASURABLE'
    : Math.abs(b) < 0.1 ? 'real but shallow'
    : Math.abs(b) < 0.3 ? 'usable' : 'STRONG';
  console.log(`  ${t.padEnd(14)} ${table[t].parentMed.toFixed(4).padStart(10)} ${table[t].childMed.toFixed(4).padStart(12)}`
    + ` ${table[t].parentSd.toFixed(4).padStart(11)} ${b.toFixed(3).padStart(7)} ${se.toFixed(3).padStart(7)}`
    + ` ${r.toFixed(3).padStart(6)} ${z.toFixed(1).padStart(7)}   ${verdict}   ${note}`);
}

// ── does R = b.S actually hold here? ─────────────────────────────────────────
//
// The regression is fitted on the whole set; this asks the question selection
// actually poses, which is what happens when you keep the TOP THIRD. Predicted
// response is b times the selection differential; realised response is the mean
// of those families' children against the mean of all children. If the two
// disagree the linear model is the wrong one for this trait and no amount of
// generations will make the prediction come true.
console.log('\n  TRUNCATION AT THE TOP THIRD — does R = b.S hold?');
console.log('  trait            S (differential)   R predicted   R realised   ratio');
const KEEP = Math.max(2, Math.round(withKids.length / 3));
for (const [t] of TRAITS) {
  const sorted = [...withKids].sort((a, b2) => b2.parent[t] - a.parent[t]);
  const sel = sorted.slice(0, KEEP);
  const S = mean(sel.map((r) => r.parent[t])) - mean(withKids.map((r) => r.parent[t]));
  const allKids = mean(withKids.flatMap((r) => r.kids.map((k) => k[t])));
  const selKids = mean(sel.flatMap((r) => r.kids.map((k) => k[t])));
  const pred = table[t].b * S, real = selKids - allKids;
  console.log(`  ${t.padEnd(14)} ${S.toFixed(4).padStart(16)} ${pred.toFixed(4).padStart(13)} ${real.toFixed(4).padStart(12)}`
    + ` ${(Math.abs(pred) > 1e-9 ? (real / pred).toFixed(2) : '—').padStart(7)}`);
}

// ── THE QUANTITY THAT ACTUALLY LIMITS THIS SYSTEM ────────────────────────────
//
// If `b` comes out near 1 — and a single mutation touches one of ~15 operator
// branches, so most children inherit most traits untouched — then the breeder's
// equation stops being the useful model. R = b.S with b = 1 says the population
// simply BECOMES its best founder in one generation, and after that the founding
// variance is spent and every further step has to be paid for by NEW mutation.
//
// That is the mutation-limited regime, and it has a different set of numbers:
//
//   V_m          the variance a single mutation adds to the trait
//   sigma_f/sigma_m   founding spread against mutational spread. This is roughly
//                how many generations of pure selection the founding draw is
//                worth before progress depends on new mutations alone
//   p+           the fraction of mutations that IMPROVE the trait
//   E[d | +]     how big an improvement is when one lands
//
// Sustained response per generation in this regime is about N . p+ . E[d|+] —
// the supply of beneficial mutations — and NOT b.S. Every plateau this project
// has recorded (`_zselect`: 60 generations, +5%, converged to one species) is
// what that formula predicts once the founder variance is gone.
console.log(`\n  ${MODE === 'clonal' ? 'MUTATIONAL' : 'RECOMBINATIONAL'} SUPPLY — what one reproductive`
  + ` event does, against the founding draw`);
console.log('  trait            sigma_f    sigma_m   f/m      p+     E[d|+]    E[d|-]   neutral');
for (const [t] of TRAITS) {
  const deltas = [];
  for (const r of withKids) for (const k of r.kids) deltas.push(k[t] - r.parent[t]);
  if (!deltas.length) continue;
  const sf = sd(withKids.map((r) => r.parent[t]));
  const sm = sd(deltas);
  const up = deltas.filter((d) => d > 1e-12), dn = deltas.filter((d) => d < -1e-12);
  const flat = deltas.length - up.length - dn.length;
  console.log(`  ${t.padEnd(14)} ${sf.toFixed(4).padStart(9)} ${sm.toFixed(4).padStart(10)}`
    + ` ${(sm > 1e-12 ? (sf / sm).toFixed(1) : '—').padStart(6)}`
    + ` ${(up.length / deltas.length).toFixed(2).padStart(7)} ${mean(up).toFixed(4).padStart(9)}`
    + ` ${mean(dn).toFixed(4).padStart(9)} ${(flat / deltas.length).toFixed(2).padStart(8)}`);
}

// ── trait correlations, which is what an index needs ─────────────────────────
//
// A selection index weights traits by their genetic covariances. Nothing here
// can estimate a genetic covariance matrix at n = 40, and pretending otherwise
// would be the "ungrounded coefficient" this project's standing rule 5 forbids.
// What IS estimable is the phenotypic correlation among the parents, which is
// enough to answer the only question the protocol needs answered: does selecting
// on one of these drag another one down?
console.log('\n  PHENOTYPIC CORRELATION AMONG PARENTS — what does selecting on one cost the others?');
const keys = TRAITS.map(([t]) => t);
console.log('                 ' + keys.map((k) => k.slice(0, 6).padStart(7)).join(''));
for (const a of keys) {
  const line = keys.map((b2) => (a === b2 ? '     — '
    : regress(rows.map((r) => r.parent[a]), rows.map((r) => r.parent[b2])).r.toFixed(2).padStart(7))).join('');
  console.log(`  ${a.padEnd(14)}` + line);
}

// ── the range question, which is what the task distance decides ──────────────
const reach = rows.map((r) => r.parent.excursion);
const sortedReach = [...reach].sort((a, b2) => a - b2);
const q = (p) => sortedReach[Math.min(sortedReach.length - 1, Math.floor(p * sortedReach.length))];
console.log(`\n  HOW FAR THE UNSTEERED CORPUS ACTUALLY GETS in ${SECONDS} s (blind excursion, cm)`);
console.log(`    p10 ${q(0.1).toFixed(2)}   p50 ${q(0.5).toFixed(2)}   p75 ${q(0.75).toFixed(2)}   p90 ${q(0.9).toFixed(2)}   max ${q(1).toFixed(2)}`);
console.log(`    task set here: ${DISTANCE.toFixed(2)} cm.  The tank's beacon task is 8 cm.`);
console.log(`    fraction of parents whose blind excursion reaches the task at all: `
  + `${(100 * reach.filter((v) => v >= DISTANCE).length / reach.length).toFixed(0)}%`);

const OUT = new URL(`./_zherit_out_${MODE}.json`, import.meta.url);
writeFileSync(OUT, JSON.stringify({
  mode: MODE, parents: rows.length, kids: KIDS, seconds: SECONDS, distance: DISTANCE,
  drawn, inviable, notSubject, survival, table,
  families: families.map((f) => ({ parent: f.parent, kids: f.kids, born: f.born, died: f.died, crossed: f.crossed })),
}, null, 1));
console.log(`\n  written: tools/_zherit_out_${MODE}.json\n`);
