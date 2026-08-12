// tools/_zduelchamp.mjs — IS THE C2 BLOCKER CLEARED?
//
//     node tools/_zduelchamp.mjs [random-N]
//
// ── THE QUESTION, AND WHY IT IS ANSWERABLE TODAY ────────────────────────────
//
// `HANDOFF.md` stopped C2 with a diagnosis, not a shrug:
//
//     "C2 needs pursuit, pursuit needs orientation, and orientation is the open
//      problem (turnRate median 0.0032 rad/s, ~0.2 deg/s — a creature cannot aim
//      at anything inside a 15 s duel). LOCOMOTION IS NO LONGER THE BLOCKER;
//      AIMING IS."
//
// Measured then: 0 captures over 9 resident duels, median closing 0.00 m, the
// whole matchup matrix zero.
//
// AIMING IS NOW THE ONE THING THIS PROJECT HAS ACTUALLY BRED FOR. And the duel's
// sensor is not a cousin of the beacon loop's — it is the SAME TWO LINES:
// `senseOpponent` is `bearingTo` then `sensorTurnBias`, which is exactly what
// `_zgoal.mjs` scores and what `_zbreed.mjs` selected on for 22 generations
// across sixteen runs. A creature bred to close on a beacon is, mechanically, a
// creature bred to close on an opponent's centre of mass.
//
// So this is a one-line experiment with a large consequence: run the SHIPPED
// duel harness over the champions instead of over a random pool. If captures
// happen, C2's blocker is cleared and D1 is unblocked behind it. If they do not,
// the blocker was never only aiming and the next session knows that instead of
// assuming it.
//
// The random pool is run as the CONTROL, on the same harness in the same
// process, because "the champions capture" means nothing without "and the corpus
// does not".
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { genomeHash } from '../engine/l1/genome.js';
import { assessViability } from '../engine/l1/viability.js';
import { S1 } from '../engine/l2/probes.js';
import { netSpeed } from '../engine/l2/objective.js';
import { duelPair, OUTCOME } from '../engine/l2/duel.js';
import { worldHash } from '../contracts/world.js';
import { W1_SLICE, W1_RESIDENT_HASHES_PLACEHOLDER } from '../worlds/w1_slice.js';
import { BRED } from '../worlds/w1_bred.js';

await RAPIER.init();
const WH = worldHash(W1_SLICE, W1_RESIDENT_HASHES_PLACEHOLDER);
const N_RANDOM = Number(process.argv[2] ?? 8);

const contender = (genome, label) => {
  let plan;
  try { plan = morphogenesis(genome); } catch { return null; }
  if (!assessViability(RAPIER, genome, W1_SLICE, { plan }).ok) return null;
  const m = S1(plan);
  // CRUISE IS NOW PART OF BEING A CONTENDER. `duelSetup` bounds the separation by
  // what the pair can cross in the window, and without this it falls back to the
  // old size-only arithmetic — which is the arithmetic that made every duel
  // impossible. Measured on the same `netSpeed` the rest of the project uses.
  const ns = netSpeed(RAPIER, { plan, genome, world: W1_SLICE });
  if (!ns.valid || !(ns.score > 1e-9)) return null;
  return { genome, plan, hash: genomeHash(genome), reach: m.reach, mass: m.massBase,
           cruise: ns.score, label };
};

function roundRobin(pool, name) {
  let duels = 0, caps = 0, stale = 0, invalid = 0, clamped = 0, unreachable = 0;
  const times = [], closings = [];
  const t0 = Date.now();
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const r = duelPair(RAPIER, { a: pool[i], b: pool[j], world: W1_SLICE, worldHash: WH });
      for (const d of r.duels) {
        duels++;
        if (!d.valid) invalid++;
        else if (d.outcome === OUTCOME.NONE) stale++;
        else { caps++; times.push(d.timeToOutcome); }
        if (d.clamped) clamped++;
        if (d.unreachable) unreachable++;
        // The number HANDOFF quoted as flat zero. Whatever the harness calls it,
        // report it if it is there rather than inventing a substitute.
        const c = d.closing ?? d.medianClosing ?? d.closedDistance;
        if (Number.isFinite(c)) closings.push(c);
      }
    }
  }
  times.sort((a, b) => a - b);
  closings.sort((a, b) => a - b);
  console.log(`\n  ${name}  — ${pool.length} contenders, ${duels} duels in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`    CAPTURES ${caps}/${duels} (${(100 * caps / Math.max(1, duels)).toFixed(0)}%)`
    + `   stalemate ${stale}   invalid ${invalid}   clamped ${clamped}`
    + `   CANNOT MEET ${unreachable}`);
  if (times.length) {
    console.log(`    time to capture  median ${times[times.length >> 1].toFixed(2)}s`
      + `   fastest ${times[0].toFixed(2)}s`);
  }
  if (closings.length) console.log(`    closing median ${closings[closings.length >> 1].toFixed(3)}`);
  return { caps, duels };
}

console.log('\n  _zduelchamp — does the C2 blocker survive creatures that can aim?');
console.log(`  duel duration ${W1_SLICE.duelDuration}s   world ${W1_SLICE.id ?? 'w1'}`);

const champs = BRED.map((b) => contender(b.genome, b.niche ?? b.id)).filter(Boolean);
console.log(`\n  champions: ${champs.length}/${BRED.length} are duel-legal`
  + `   reach ${champs.map((c) => c.reach.toFixed(1)).join(' ')}`);

const rand = [];
for (let i = 0; rand.length < N_RANDOM && i < 600; i++) {
  const c = contender(createRandomGenome(rngFrom('zduel', 'pool', i)), `rand${rand.length}`);
  if (c) rand.push(c);
}

const R = roundRobin(rand, 'RANDOM CORPUS (control)');
const C = roundRobin(champs, 'CAMPAIGN CHAMPIONS');

console.log('\n  ── VERDICT ──');
const rr = R.duels ? R.caps / R.duels : 0;
const cr = C.duels ? C.caps / C.duels : 0;
console.log(`  capture rate   random ${(100 * rr).toFixed(0)}%   champions ${(100 * cr).toFixed(0)}%`);
if (cr > 0 && cr > rr) {
  console.log('  C2\'s stated blocker was AIMING, and these creatures aim. Captures happen.');
  console.log('  The duel layer is testable again; D1 sits behind it.');
} else if (cr === 0 && rr === 0) {
  console.log('  NO CAPTURES IN EITHER ARM. The blocker was not only aiming — something');
  console.log('  else in the duel setup (separation, duration, contact rule) binds first,');
  console.log('  and that is a result about the harness rather than about the animals.');
} else {
  console.log('  Champions do not beat the corpus here. Report as measured; do not tune.');
}
console.log('');
