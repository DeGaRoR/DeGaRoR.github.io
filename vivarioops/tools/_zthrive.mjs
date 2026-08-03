// tools/_zthrive.mjs — AN HOUR IN OPEN WATER, ranked by the energy multiplier.
//
// WHY THIS EXISTS. The Forage screen runs BOUNDED, because the cast shares one
// arena and physics.js:711 permits wrapping only while creatures do not interact.
// tools/_zwall.mjs measured what that costs: 4 of 6 creatures on the glass within
// 104 s, 29% of a ten-minute trial spent against it, speed and wall gap decaying
// together. So the screen is substantially measuring WHO GOT TRAPPED NEAR FOOD,
// and the ability to leave a corner is a different trait from the ability to feed.
//
// THE FIX COSTS NOTHING HERE, because this trial gives each creature its OWN
// simulation and its OWN fresh field — which `foodEaten` already requires for a
// different reason ("or the trial order decides the result: the second creature
// would forage a field the first had already stripped"). One creature per sim is
// exactly the condition the torus needs. So the test the screen cannot run today,
// the harness can run right now, with no new physics:
//
//     bounded: false, wrap: true
//
// Open water with no boundary at all. The creature may swim in a straight line
// forever and keeps meeting food, because the field is generated over the wrap
// extent and the wrap keeps the body inside it — so the field is PERIODIC by
// construction and its density is exactly the tank's. Depletion still means
// something: the field is finite, and stripping it is a real outcome.
//
// WHAT IT MEASURES. Not speed. The MULTIPLIER — energy in over energy out —
// which needs no control subtraction to be meaningful because it is not a proxy
// for anything: below 1 the creature is spending more than it eats.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { morphogenesis, totalMass, boundingRadius } from '../engine/l1/morphogen.js';
import { seedPopulation } from '../engine/l1/breed.js';
import { authoredList } from '../worlds/atlas_seed.js';
import { binomial } from '../engine/l1/naming.js';
import { makeFood, runForage } from '../engine/l2/forage.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const T = Number(process.argv[2] ?? 3600);          // one hour by default
const N = Number(process.argv[3] ?? 8);
const OPEN = !process.argv.includes('walls');           // pass "walls" for the A/B arm

// `atlas` runs THE PLAYER'S OWN CAST — the same authored creatures the Forage
// screen casts from — so a headless result can be laid beside a screen run of the
// same animals. A seeded population would compare two different questions.
const ATLAS = process.argv.includes('atlas');
const entries = ATLAS
  ? authoredList().slice(0, N).map((a) => ({ genome: a.genome, label: a.commonName }))
  : seedPopulation({ RAPIER, rng: rngFrom('forage', 'pop'), world: W1_SLICE, population: N, authoredSlots: 2 })
    .genomes.map((g) => ({ genome: g, label: null }));
const genomes = entries.map((e) => e.genome);

// THE SAME FIELD FOR EVERY CREATURE, and a fresh copy each. Same seed, so the
// comparison is about the animals; fresh, so trial order decides nothing.
const FIELD_SEED = 20260803;

/**
 * THRESHOLDS ARE A CHOICE, NOT A MEASUREMENT, and they are stated here rather
 * than buried so that nobody later quotes "3 thrived" as a fact about the world.
 * Below 1 the creature spends more than it takes in and would die; 1 is break-even
 * exactly; the 2x line for "thrives" is an editorial judgement about how much
 * surplus is needed to grow and reproduce, and it is the number to revisit first
 * when birth and death land at D1.
 */
const verdict = (r) => (!Number.isFinite(r) ? 'no spend' : r < 1 ? 'DIES' : r < 2 ? 'survives' : 'THRIVES');

const rows = [];
const t0 = Date.now();
for (let i = 0; i < genomes.length; i++) {
  const g = genomes[i];
  let plan;
  try { plan = morphogenesis(g); } catch (e) { rows.push({ i, err: e.message }); continue; }
  const food = makeFood(W1_SLICE);   // the world's own field — see the seed note in forage.js
  const r = runForage(RAPIER, {
    plan, genome: g, world: W1_SLICE, food, seconds: T,
    simOpts: OPEN ? { bounded: false, wrap: true } : { bounded: true, wrap: false },
  });
  rows.push({
    i, name: entries[i].label || binomial(plan, g).binomial, mass: totalMass(plan), radius: boundingRadius(plan),
    ...r, grazed: 100 * (1 - food.remaining() / food.initialTotal),
  });
  process.stdout.write(`\r  ${i + 1}/${genomes.length} ...`);
}
const wall = (Date.now() - t0) / 1000;

console.log(`\r  ${N} creatures, ${OPEN ? 'OPEN WATER (torus: bounded:false, wrap:true)' : 'WALLED TANK'}, `
  + `${T}s each — ${wall.toFixed(0)}s wall, ${(T * N / wall).toFixed(0)}x realtime\n`);
console.log('   #  name                          mass g    eaten g   grazed   intake erg    spend erg   multiplier   verdict');
console.log('  ' + '-'.repeat(120));

for (const r of rows) {
  if (r.err) { console.log(`  ${String(r.i + 1).padStart(2)}  FAILED ${r.err}`); continue; }
  console.log('  ' + String(r.i + 1).padStart(2) + '  ' + String(r.name).slice(0, 28).padEnd(30)
    + r.mass.toFixed(2).padStart(7)
    + r.eaten.toFixed(3).padStart(11)
    // SATURATION MARKER. A creature that strips the whole field has its multiplier
    // bounded by the food that EXISTED, not by what it could do — the number is a
    // floor, not a measurement, and must not be ranked against unsaturated ones.
    + `${r.grazed.toFixed(0)}%${r.grazed >= 95 ? '!' : ' '}`.padStart(9)
    + r.intake.toExponential(2).padStart(13)
    + r.spend.toExponential(2).padStart(13)
    + (Number.isFinite(r.ratio) ? r.ratio.toFixed(2) : '-').padStart(13)
    + '   ' + verdict(r.ratio));
}

const ok = rows.filter((r) => !r.err && Number.isFinite(r.ratio));
const sorted = [...ok].sort((a, b) => a.ratio - b.ratio);
const med = sorted.length ? sorted[sorted.length >> 1].ratio : NaN;
console.log(`\n  multiplier: min ${sorted[0]?.ratio.toFixed(2)} / median ${med.toFixed(2)} / max `
  + `${sorted[sorted.length - 1]?.ratio.toFixed(2)}   spread ${(sorted[sorted.length - 1].ratio / sorted[0].ratio).toFixed(1)}x`);
console.log(`  ${ok.filter((r) => r.ratio >= 2).length} thrive · ${ok.filter((r) => r.ratio >= 1 && r.ratio < 2).length} survive`
  + ` · ${ok.filter((r) => r.ratio < 1).length} die`);
console.log(`  field grazed: median ${[...ok].sort((a, b) => a.grazed - b.grazed)[ok.length >> 1].grazed.toFixed(1)}%`
  + ` (each creature got its own copy of the same field)\n`);
const sat = ok.filter((r) => r.grazed >= 95);
if (sat.length) {
  console.log(`\n  ! ${sat.length} creature(s) STRIPPED THE FIELD (>=95% grazed). Their multiplier is a FLOOR,`);
  console.log('    bounded by the food that existed rather than by the animal. An hour needs a field');
  console.log('    sized for an hour — raise `total` in makeFood, or shorten the trial.');
}

// ── IS THE MULTIPLIER JUST MEASURING SIZE? ──────────────────────────────────
// The seek objective taught this the expensive way: raw seek score correlated 0.90
// with netSpeed, so it bred fast swimmers and left the sensor gain drifting. Basal
// cost scales with mass, so a multiplier could be a mass selector wearing a better
// name. This is the check that would catch it, and it costs nothing.
function corr(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}
const clean = ok.filter((r) => r.grazed < 95);
const lg = (v) => Math.log(Math.max(v, 1e-12));
console.log(`\n  multiplier vs mass:   r = ${corr(clean.map((r) => lg(r.mass)), clean.map((r) => lg(r.ratio))).toFixed(3)}`
  + `   (log-log, n = ${clean.length}, saturated excluded)`);
console.log(`  multiplier vs eaten:  r = ${corr(clean.map((r) => lg(r.eaten)), clean.map((r) => lg(r.ratio))).toFixed(3)}`);
console.log('  A strong NEGATIVE mass correlation would mean this ranks small creatures rather');
console.log('  than good foragers — the same trap the seek objective fell into.');

console.log('\n  SPREAD is what matters, not the level. A selector that ranks everyone the same');
console.log('  selects nothing, however meaningful its units are.\n');
