// tools/_ztaxevo.mjs — CAN SELECTION DISCOVER TROPOTAXIS?   ⚠ WRITES ONE FILE
//
//     node tools/_ztaxevo.mjs [generations] [population] [seed] [seconds]
//
// ── THE QUESTION, AND WHY IT COULD NOT BE ASKED BEFORE GENOME_V 9 ────────────
//
// `tropoGain` steers on the left/right receptor contrast, and it is measured to
// pay: +2.211 g on the bred champions at the better sign, 6 of 8 helped, against
// -0.344 g for the kinesis wire it sits beside (`tools/_zsense.mjs`). But paying
// and being FINDABLE are different things, and `preyGain2` is the standing
// example of a gene that was worth having and unreachable: sigma 0.10 from zero,
// drawn once per ~23 mutations, about 36 generations before it could bend a
// trajectory. An A/B shorter than that measures nothing whichever way it comes
// out.
//
// GENOME_V 9 fixed the reachability, and this is the experiment that fix was
// for. Measured after it: 81% of draws carry a receptor (was 0%), 56% carry them
// on BOTH SIDES — which is what a differential needs — and a walk moves
// `tropoGain` off zero in a median of 15 mutations, about 8 generations. So a
// 20-generation run can now discover the gene from neutral, and that is what is
// being tested. NOT "given the gene, does selection keep it" — the harder and
// more honest question.
//
// ── WHY THE OBJECTIVE IS GRAMS AND NOT `closedCm` ───────────────────────────
//
// `tools/_zbreed.mjs` selects on beacon closure, and beacon closure is driven by
// `bearingTo` — the omniscient compass. `tropoGain` acts ONLY inside
// `runForage`, on receptors with a finite 6 cm reach. Selecting on `closedCm`
// therefore could not move this gene at all, however long it ran. The objective
// has to be the one the sense actually feeds: food taken from a patchy field.
//
// 300 s, and shorter is a trap `engine/l2/forage.js` already swept: below ~200 s
// intake correlates with MASS and not with swimming, so the trial measures where
// the creature spawned.
//
// ── THE ARMS ────────────────────────────────────────────────────────────────
//
//   free    mutation may reach `tropoGain`, exactly as in the game
//   locked  `tropoGain` forced to 0 after every reproduction
//
// Both arms start from the SAME founders at `tropoGain` 0 — the factory's own
// neutral value — and share the random stream. ⚠ THE ARM IS NOT IN THE RNG KEY:
// `_zgoalch2` shipped with it in, its two arms drew different mutations from
// generation 1, and a +0.16 drift was read as signal.
//
// The lock is applied AFTER `breed()` returns, so `mutate` itself draws
// identically in both arms and the streams stay aligned.
//
// ── WRITES ───────────────────────────────────────────────────────────────────
//
//   tools/_ztaxevo_seed<seed>.json — per-generation history and each arm's winner.
import RAPIER from '@dimforge/rapier3d-compat';
import { writeFileSync } from 'node:fs';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { assessViability } from '../engine/l1/viability.js';
import { serialise, genomeHash } from '../engine/l1/genome.js';
import { breed } from '../engine/l1/breed.js';
import { binomial } from '../engine/l1/naming.js';
import { makeFood, runForage } from '../engine/l2/forage.js';
import { netSpeed } from '../engine/l2/objective.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();

const GENS = Number(process.argv[2] ?? 20);
const POP = Number(process.argv[3] ?? 10);
const SEED = Number(process.argv[4] ?? 0);
const SECONDS = Number(process.argv[5] ?? 300);

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const f = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : '—');

/** Receptors on both sides, or the contrast is identically zero and the gene is inert. */
function twoSided(plan) {
  let l = 0, r = 0;
  for (const rec of plan.receptors ?? []) { if (rec.side < 0) l++; else r++; }
  return l > 0 && r > 0;
}

/**
 * One economic trial. A FRESH FIELD PER CREATURE at the same seed, so every
 * animal meets the identical water and the comparison is about the animal.
 *
 * INTEGRITY IS CHECKED. `runForage` does not, and a body that comes apart sweeps
 * its fragments at the speed ceiling and reports fictional intake — HANDOVER-
 * FORAGE records one at 7864 g against 31-49 for its rivals. Selecting on that
 * breeds exploders and nothing else.
 */
function trial(genome) {
  let plan;
  try { plan = morphogenesis(genome); } catch { return null; }
  if (!plan.jointCount) return null;
  const food = makeFood(W1_SLICE, { seed: 0xF00D });
  let r;
  try { r = runForage(RAPIER, { plan, genome, world: W1_SLICE, food, seconds: SECONDS }); }
  catch { return null; }
  if (!r.valid) return null;
  return {
    eaten: r.eaten, balance: r.balance,
    tropo: Math.abs(genome.controller.tropoGain ?? 0),
    chemo: Math.abs(genome.controller.chemoGain ?? 0),
    receptors: (plan.receptors ?? []).length,
    twoSided: twoSided(plan),
    mass: totalMass(plan), bodies: plan.bodyCount,
  };
}

/** THE LOCK: the locked arm's entire intervention, applied after reproduction. */
const lock = (g) => { g.controller.tropoGain = 0; return g; };

// ── founders: random, viable, mobile, and CARRYING THE ANATOMY ───────────────
//
// Screened on receptors-on-both-sides for the reason `_zgoalch2` records: a gene
// whose actuator weights are structurally zero cannot be selected on however
// long the run, and admitting such founders would guarantee a null result that
// says nothing about the gene. 56% of draws qualify since GENOME_V 9, so the
// screen is cheap; before it, it would have admitted nobody at all.
const founders = [];
let drawn = 0, noAnatomy = 0;
process.stdout.write('  founding ');
for (let i = 0; founders.length < POP && i < POP * 300; i++) {
  const g = createRandomGenome(rngFrom('taxevo', 'init', SEED, i));
  drawn++;
  let plan;
  try { plan = morphogenesis(g); } catch { continue; }
  if (plan.jointCount < 1) continue;
  if (!twoSided(plan)) { noAnatomy++; continue; }
  if (!assessViability(RAPIER, g, W1_SLICE).ok) continue;
  const ns = netSpeed(RAPIER, { plan, genome: g, world: W1_SLICE });
  if (!ns.valid || !(ns.score > 1e-4)) continue;
  founders.push(g);
  process.stdout.write('.');
}
console.log('');
if (founders.length < 4) { console.log(`  only ${founders.length} founders — nothing to select on.`); process.exit(1); }

console.log(`\n  _ztaxevo — can selection DISCOVER tropotaxis?`);
console.log(`  seed ${SEED}   population ${POP}   ${GENS} generations   ${SECONDS} s forage trials`);
console.log(`  ${drawn} draws: ${noAnatomy} lacked receptors on both sides, ${founders.length} founded`);
console.log(`  every founder starts at tropoGain 0 — the factory's own value. This asks`);
console.log(`  whether selection FINDS the gene, not whether it keeps one handed to it.`);
console.log(`  arms: FREE (mutation may reach it) vs LOCKED (forced to 0 after every birth)\n`);

const history = [];
const winners = {};

for (const arm of ['free', 'locked']) {
  let pop = founders.map((g) => (arm === 'locked' ? lock(structuredClone(g)) : structuredClone(g)));
  let rows = new Array(POP).fill(null);
  let best = null;
  console.log(`  ── ${arm.toUpperCase()} ──`);
  console.log('  gen   eaten p50   eaten best    |tropo| p50   |tropo| max   live gene   subjects');

  for (let gen = 0; gen <= GENS; gen++) {
    for (let i = 0; i < POP; i++) if (!rows[i]) rows[i] = trial(pop[i]) ?? { dead: true };
    const scored = rows.map((r, i) => ({ ...r, i })).filter((r) => !r.dead);
    if (scored.length < 2) { console.log(`  ${gen}  too few subjects — stopping`); break; }

    scored.sort((a, b) => b.eaten - a.eaten);
    const live = scored.filter((r) => r.tropo > 0).length;
    const row = {
      arm, gen,
      eatenP50: q(scored.map((r) => r.eaten), 0.5), eatenBest: scored[0].eaten,
      tropoP50: q(scored.map((r) => r.tropo), 0.5), tropoMax: Math.max(...scored.map((r) => r.tropo)),
      chemoP50: q(scored.map((r) => r.chemo), 0.5),
      live, subjects: scored.length,
    };
    history.push(row);
    console.log(`  ${String(gen).padStart(3)}   ${f(row.eatenP50).padStart(9)}   ${f(row.eatenBest).padStart(10)}`
      + `   ${f(row.tropoP50).padStart(12)}   ${f(row.tropoMax).padStart(11)}`
      + `   ${String(live).padStart(9)}   ${String(row.subjects).padStart(8)}`);

    if (!best || scored[0].eaten > best.eaten) {
      best = { ...scored[0], gen, serialised: serialise(pop[scored[0].i]), genome: pop[scored[0].i] };
    }
    if (gen === GENS) break;

    // HALF THE POOL BREEDS, ranked. `breed()` keeps every selected genome as an
    // untouched elite in its own slot, fills the rest with offspring, and
    // reserves N17's stranger slots. One zygote per reproductive event.
    const selected = scored.slice(0, Math.max(2, POP >> 1)).map((r) => r.i);
    const before = pop;
    const out = breed({
      RAPIER, genomes: pop, selected, rng: rngFrom('taxevo', 'breed', SEED, gen),
      world: W1_SLICE, limits: SLICE_LIMITS, viabilityAttempts: 1,
    });
    pop = arm === 'locked' ? out.genomes.map(lock) : out.genomes;
    // An elite comes back as the SAME OBJECT REFERENCE, so identity is an exact
    // test for "this creature did not change" — except in the locked arm, where
    // `lock` copies nothing but may have zeroed a gene, so a locked elite is
    // still the same object and its row still stands.
    rows = pop.map((g, i) => (g === before[i] ? rows[i] : null));
  }
  winners[arm] = best;
  console.log('');
}

// ── the verdict ─────────────────────────────────────────────────────────────
const last = (arm) => history.filter((h) => h.arm === arm).slice(-1)[0];
const F = last('free'), L = last('locked');
console.log('  ── VERDICT ──');
if (F && L) {
  console.log(`  eaten p50    free ${f(F.eatenP50)} g   locked ${f(L.eatenP50)} g`
    + `   delta ${f(F.eatenP50 - L.eatenP50)} g`);
  console.log(`  eaten best   free ${f(F.eatenBest)} g   locked ${f(L.eatenBest)} g`);
  console.log(`  |tropoGain|  free p50 ${f(F.tropoP50)} max ${f(F.tropoMax)}`
    + `   — ${F.live}/${F.subjects} carry a live gene   (locked is 0 by construction)`);
  const f0 = history.find((h) => h.arm === 'free');
  console.log(`  the free arm started at |tropo| p50 ${f(f0.tropoP50)}, ${f0.live}/${f0.subjects} live`);
  if (F.live > 0 && F.eatenP50 > L.eatenP50) {
    console.log('\n  SELECTION FOUND THE GENE AND IT PAID. The reachability fix works end to end:');
    console.log('  drawn anatomy -> mutation reaches the gain -> selection keeps it -> more food.');
  } else if (F.live > 0) {
    console.log('\n  The gene was FOUND but did not pay here. Reachability works; the objective');
    console.log('  did not reward it. Report as measured.');
  } else {
    console.log('\n  THE GENE WAS NEVER REACHED in this run. That is a reachability result and it');
    console.log('  contradicts the 15-mutation median — check the branch weights before the gene.');
  }
}

if (winners.free?.genome) {
  const plan = morphogenesis(winners.free.genome);
  console.log(`\n  free winner — gen ${winners.free.gen}, ${f(winners.free.eaten)} g,`
    + ` tropoGain ${f(winners.free.tropo)}, ${winners.free.receptors} receptors`);
  console.log(`    ${binomial(plan, winners.free.genome).binomial}   ${genomeHash(winners.free.genome)}`);
}

writeFileSync(new URL(`./_ztaxevo_seed${SEED}.json`, import.meta.url), JSON.stringify({
  seed: SEED, pop: POP, gens: GENS, seconds: SECONDS, history,
  winners: Object.fromEntries(Object.entries(winners).map(([k, v]) => [k, v && {
    gen: v.gen, eaten: v.eaten, tropo: v.tropo, receptors: v.receptors, serialised: v.serialised,
  }])),
}, null, 1));
console.log(`\n  written: tools/_ztaxevo_seed${SEED}.json\n`);
