// tools/_zsense.mjs — THE PERCEPTION RETRY. Does the receptor pay, now that
//                     creatures can move?
//
//     node tools/_zsense.mjs [seconds] [nRandom]
//
// ── WHY PHASE 2's GATE IS WORTH RE-ASKING, AND WHY THE FIRST ANSWER IS SUSPECT ─
//
// `design/PLAN-TO-INTELLIGENCE.md` Phase 2 shipped receptor-mediated kinesis and
// its gate FAILED: mean control-subtracted **-0.087 g, 3 of 16 helped**. It has
// not been re-run since. Two things about that run are now known to be wrong.
//
//   1. THE CORPUS COULD NOT MOVE. Median blind excursion of a random draw is
//      0.6 cm in 40 s (15-BREEDING section 2.4). The wire modulates `effort` —
//      how hard to swim — so an animal that does not travel cannot express it,
//      whatever its receptors read. That gate measured mobility as much as
//      sensing, which is the same confound that broke the seek objective.
//
//   2. THE ORGAN IS A TWO-PART GENE AND BOTH PARTS START NEUTRAL. Measured here
//      before anything else: **0 receptors in 200 random draws**, and
//      `chemoGain` is 0 on every one of the eight campaign champions — 22
//      generations of selection put four receptors on exactly one of them, and
//      that one still has gain 0, so they are inert. A creature needs a SITE and
//      a NON-ZERO GAIN together before the wire does anything at all.
//
// ── SO THIS ASKS THE SECOND QUESTION FIRST, THE `_zgoalch2` WAY ──────────────
//
// "Can a random walk discover this organ?" and "given the organ, does it pay?"
// are different questions, and the second is the one that decides whether the
// receptor path is worth building on. It needs the organ PRESENT, so:
//
//   ⚠ THIS TOOL ADDS A RECEPTOR SITE AND SETS `chemoGain` DIRECTLY. That is an
//   instrument setting variables the game leaves at their neutral values, which
//   is exactly what `tools/_zgoalch2.mjs` did for `preyGain2` and is allowed on
//   the same terms: it is declared, it is confined to this tool, and the factory
//   still draws zero. Nothing about the game changes.
//
// ── THE TWO POOLS ARE THE EXPERIMENT ────────────────────────────────────────
//
// MOBILE (the campaign champions, cruise 0.03-0.48 cm/s) against IMMOBILE (a
// random draw, cruise ~0.02). If the receptor pays for the mobile pool and not
// the immobile one, Phase 2's failure was the confound and the path is alive. If
// it pays for neither, the wire does not work and no amount of mobility fixes
// it. Both are results; only one of them is an excuse.
//
// The control arm is `chemoGain = 0`, which `runForage` documents as
// bit-identical to the pre-Phase-2 open-loop trial. Same genome, same field,
// same seed — the only difference is the gene.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { cloneGenome } from '../engine/l1/mutate.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { assessViability } from '../engine/l1/viability.js';
import { makeSite } from '../engine/l1/genome.js';
import { makeFood, runForage } from '../engine/l2/forage.js';
import { netSpeed } from '../engine/l2/objective.js';
import W1_SLICE from '../worlds/w1_slice.js';
import { BRED } from '../worlds/w1_bred.js';

await RAPIER.init();

const SECONDS = Number(process.argv[2] ?? 300);   // Phase 2's gate: trials >= 200 s
const N_RANDOM = Number(process.argv[3] ?? 10);
/** The gains swept. 0 is the control and is bit-identical to open loop. */
const GAINS = [-0.9, -0.5, 0.5, 0.9];
/** `taxis` wires the receptor DIFFERENTIAL to turnBias; `kinesis` is the shipped effort wire. */
const MODE = (process.env.ZS_MODE ?? 'kinesis').toLowerCase();
if (!['kinesis', 'taxis'].includes(MODE)) throw new Error(`unknown mode ${MODE}`);
/**
 * The kinesis gain the taxis arm HOLDS while its steering gain varies. Non-zero
 * because `chemoGain` is what gates the whole sensing block in `runForage` — the
 * receptors are not read at all at zero — and SMALL because the previous run
 * measured kinesis at -1.74 g on this pool, so a large hold would bury any
 * steering effect under a known-harmful one.
 */
const KINESIS_HOLD = 0.1;

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : '—');

/**
 * Give a genome a receptor if it has none, on the leading face of its root node
 * at the face centre — the same place `defaultMouth` puts a mouth, so the organ
 * sits where the animal actually meets the water rather than somewhere chosen to
 * flatter it.
 */
function withReceptor(genome) {
  const g = cloneGenome(genome);
  // ── TAXIS NEEDS RECEPTORS ON BOTH SIDES, AND THE SIDE COMES FROM THE BODY ───
  //
  // `morphogen.js` assigns `receptor.side` from the BODY the site sits on — its
  // mirror provenance, or failing that its x against the root — not from where on
  // that body the site is. So a single site on the root gives every receptor the
  // same side and the differential is identically zero. One site on EVERY node is
  // what puts receptors on bodies at different x, and it is the `_zgoalch2` lesson
  // restated: founders must have the anatomy or the experiment measures nothing.
  //
  // Kinesis needs no such thing — it averages — so it keeps the single root site
  // and stays comparable with the run before this one.
  if (MODE === 'taxis') {
    for (const n of g.nodes) if (!n.sites.length) n.sites.push(makeSite({ face: 5, at: [0, 0] }));
    return g;
  }
  let total = 0;
  for (const n of g.nodes) total += n.sites.length;
  if (total === 0) {
    const root = g.nodes.find((n) => n.id === g.rootNodeId) ?? g.nodes[0];
    root.sites.push(makeSite({ face: 5, at: [0, 0] }));
  }
  return g;
}

/** Receptors on both sides, or the differential is structurally zero. */
function twoSided(plan) {
  let l = 0, r = 0;
  for (const rec of plan.receptors ?? []) { if (rec.side < 0) l++; else r++; }
  return l > 0 && r > 0;
}

function subject(genome, label) {
  const g = withReceptor(genome);
  let plan;
  try { plan = morphogenesis(g); } catch { return null; }
  if (!(plan.receptors ?? []).length) return null;
  if (MODE === 'taxis' && !twoSided(plan)) return null;   // no differential to read
  if (!assessViability(RAPIER, g, W1_SLICE).ok) return null;
  const ns = netSpeed(RAPIER, { plan, genome: g, world: W1_SLICE });
  if (!ns.valid) return null;
  return { genome: g, plan, label, cruise: ns.score, receptors: plan.receptors.length };
}

/** One trial. A FRESH FIELD PER TRIAL, same seed, so every arm meets the same water. */
function trial(s, gain) {
  const g = cloneGenome(s.genome);
  // THE TAXIS ARM VARIES ONE GENE, NOT TWO. `chemoGain` gates the sensing block,
  // so it is held at a fixed small value in both taxis arms and the steering gain
  // is the only thing that moves; its control holds both at zero. Otherwise the
  // arms would differ by two things and the result would belong to neither.
  const taxis = MODE === 'taxis';
  g.controller.chemoGain = taxis ? (gain === 0 ? 0 : KINESIS_HOLD) : gain;
  const food = makeFood(W1_SLICE, { seed: 0xF00D });
  try {
    const r = runForage(RAPIER, {
      plan: s.plan, genome: g, world: W1_SLICE, food, seconds: SECONDS,
      tropoGain: taxis ? gain : 0,
    });
    return r.valid ? r : null;
  } catch { return null; }
}

function run(pool, name) {
  console.log(`\n  ── ${name} ──  ${pool.length} subjects, cruise median `
    + `${f(pool.map((p) => p.cruise).sort((a, b) => a - b)[pool.length >> 1] ?? 0, 4)} cm/s`);
  console.log('  subject           cruise   blind g |' + GAINS.map((x) => f(x, 1).padStart(9)).join('') + '  |    best');
  const deltas = [], bestOf = [], signed = [];
  for (const s of pool) {
    const base = trial(s, 0);
    if (!base) { console.log(`  ${s.label.padEnd(16)}  — control invalid`); continue; }
    const row = GAINS.map((gn) => { const r = trial(s, gn); return r ? r.eaten - base.eaten : null; });
    const ok = row.filter((v) => v != null);
    if (!ok.length) continue;
    const best = Math.max(...ok);
    bestOf.push(best);
    // ── THE STATISTIC THAT MATCHES WHAT SELECTION DOES ─────────────────────────
    //
    // The mean over BOTH signs is ~0 by construction whenever the sign is the
    // strategy, and here it plainly is: `spined` reads -13.8 at gain -0.9 and
    // +6.1 at +0.9. Averaging a large win against a large loss measures the
    // sweep's symmetry, not the mechanism.
    //
    // But "best of four" is a MAXIMUM over four tries, and this session already
    // retired one gate for exactly that bias (15-BREEDING section 5.4: a diverse
    // arm wins a max while losing everywhere else). So the reported figure is the
    // mean of the BETTER-SIGNED PAIR — a max over two directions, which is the
    // one choice evolution actually makes, since `chemoGain`'s sign is evolved
    // and not declared. Still optimistic; far less so, and it is stated.
    const neg = row.filter((v, i) => v != null && GAINS[i] < 0);
    const pos = row.filter((v, i) => v != null && GAINS[i] > 0);
    signed.push(Math.max(neg.length ? mean(neg) : -Infinity, pos.length ? mean(pos) : -Infinity));
    // The GATE's statistic is the control-subtracted score at the gene's own
    // value, not at its best — a creature does not get to try four gains. The
    // mean over the swept gains is the honest per-creature figure; `best` is
    // reported beside it because it bounds what selection could ever find.
    deltas.push(mean(ok));
    console.log(`  ${s.label.padEnd(16)} ${f(s.cruise, 4).padStart(7)} ${f(base.eaten, 3).padStart(8)} |`
      + row.map((v) => (v == null ? '     — ' : f(v, 3)).padStart(9)).join('')
      + `  | ${f(best, 3).padStart(7)}`);
  }
  const helped = deltas.filter((d) => d > 0).length;
  const signedHelped = signed.filter((d) => d > 0).length;
  console.log(`  mean over BOTH signs ${f(mean(deltas))} g   helped ${helped}/${deltas.length}`);
  console.log(`  mean at the BETTER SIGN ${f(mean(signed))} g   helped ${signedHelped}/${signed.length}`
    + `   (max-of-sweep ${f(mean(bestOf))} g)`);
  return { deltas, helped, bestOf, signed, signedHelped };
}

console.log(`\n  _zsense — the perception retry, mode ${MODE.toUpperCase()}.`
  + `  ${SECONDS} s trials, gains ${JSON.stringify(GAINS)}`);
if (MODE === 'taxis') {
  console.log('  TAXIS: the receptor DIFFERENTIAL (right - left)/(right + left) drives turnBias.');
  console.log(`  chemoGain held at ${KINESIS_HOLD} in both arms, so only the steering gain varies.`);
  console.log('  Subjects need receptors on BOTH sides or there is no differential to read.');
}
console.log('  ⚠ receptor sites and chemoGain are SET BY THIS TOOL; the factory still draws zero.');
console.log("  Phase 2's gate: mean control-subtracted > 0, sign test, trials >= 200 s.");

const mobile = BRED.map((b) => subject(b.genome, b.niche ?? b.id)).filter(Boolean);
const immobile = [];
for (let i = 0; immobile.length < N_RANDOM && i < 500; i++) {
  const s = subject(createRandomGenome(rngFrom('zsense', 'pool', i)), `rand${immobile.length}`);
  if (s) immobile.push(s);
}

const M = run(mobile, 'MOBILE — the campaign champions');
const I = run(immobile, 'IMMOBILE — a random draw, Phase 2\'s original conditions');

console.log('\n  ── VERDICT ──');
const mm = mean(M.signed), ii = mean(I.signed);
console.log(`  at the better sign — the choice selection makes:`);
console.log(`  mobile   ${f(mm)} g   helped ${M.signedHelped}/${M.signed.length}`);
console.log(`  immobile ${f(ii)} g   helped ${I.signedHelped}/${I.signed.length}`);
console.log(`  (both signs averaged: mobile ${f(mean(M.deltas))}  immobile ${f(mean(I.deltas))})`);
console.log(`  Phase 2 recorded -0.087 g and 3/16 helped, on a corpus like the immobile pool.`);
if (mm > 0 && mm > ii) {
  console.log('\n  THE RECEPTOR PAYS FOR ANIMALS THAT CAN MOVE and did not for ones that cannot.');
  console.log('  Phase 2\'s failure was the confound. The receptor path is alive and the next');
  console.log('  step is to make the gene REACHABLE — it needs a site and a gain together,');
  console.log('  and the draw supplies neither.');
} else if (mm <= 0 && ii <= 0) {
  console.log('\n  THE RECEPTOR PAYS FOR NEITHER POOL. Mobility was not the confound and the');
  console.log('  kinesis wire does not work as built. That is a result about the WIRE —');
  console.log('  and note it modulates `effort` only, never `turnBias`, a limitation');
  console.log('  forage.js justifies as "Phase 3, gated on orientation". Orientation is');
  console.log('  no longer broken, so tropotaxis is the experiment this unblocks.');
} else {
  console.log('\n  Mixed. Report as measured; do not tune.');
}
console.log('');
