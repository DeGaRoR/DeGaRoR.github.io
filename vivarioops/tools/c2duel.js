// tools/c2duel.js — does a duel actually happen? Measurement before assertion.
//
// Not a gate. This is the script that decides what the C2 assertions can honestly
// claim: whether captures ever occur, how often the separation clamps, how often
// guard 2 fires, and whether a pair is symmetric read from both ends.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { genomeHash } from '../engine/l1/genome.js';
import { assessViability } from '../engine/l1/viability.js';
import { S1 } from '../engine/l2/probes.js';
import { runDuel, duelPair, OUTCOME } from '../engine/l2/duel.js';
import { worldHash } from '../contracts/world.js';
import { W1_SLICE, W1_RESIDENT_HASHES_PLACEHOLDER } from '../worlds/w1_slice.js';

await RAPIER.init();
const WH = worldHash(W1_SLICE, W1_RESIDENT_HASHES_PLACEHOLDER);

const N = Number(process.argv[2] ?? 8);
const pool = [];
for (let i = 0; pool.length < N && i < 400; i++) {
  const g = createRandomGenome(rngFrom('c2', 'pool', i));
  const plan = morphogenesis(g);
  if (!assessViability(RAPIER, g, W1_SLICE, { plan }).ok) continue;
  const m = S1(plan);
  pool.push({ genome: g, plan, hash: genomeHash(g), reach: m.reach, mass: m.massBase });
}
console.log(`pool ${pool.length} viable · reach ${pool.map(p => p.reach.toFixed(1)).join(' ')}`);

let duels = 0, caps = 0, stale = 0, invalid = 0, flagged = 0, clamped = 0, ignored = 0;
const times = [];
const t0 = Date.now();

for (let i = 0; i < pool.length; i++) {
  for (let j = i + 1; j < pool.length; j++) {
    const r = duelPair(RAPIER, { a: pool[i], b: pool[j], world: W1_SLICE, worldHash: WH });
    for (const d of r.duels) {
      duels++;
      if (!d.valid) invalid++;
      else if (d.outcome === OUTCOME.NONE) stale++;
      else { caps++; times.push(d.timeToOutcome); }
      if (d.flagged) flagged++;
      if (d.clamped) clamped++;
      ignored += d.ignoredContacts;
    }
  }
}

times.sort((a, b) => a - b);
const ms = Date.now() - t0;
console.log(`\n${duels} duels in ${(ms / 1000).toFixed(1)}s (${(ms / duels).toFixed(0)} ms each)`);
console.log(`  captures ${caps} (${(100 * caps / duels).toFixed(0)}%) · stalemate ${stale} · invalid ${invalid}`);
console.log(`  flagged <0.5s ${flagged} · separation clamped ${clamped} · guard-2 ignored contacts ${ignored}`);
if (times.length) {
  console.log(`  timeToOutcome median ${times[Math.floor(times.length / 2)].toFixed(2)}s · min ${times[0].toFixed(2)}s`);
}

// K4 at the RECORD level: the same pair read from opposite ends.
const [x, y] = pool;
const fwd = runDuel(RAPIER, { a: x, b: y, world: W1_SLICE, worldHash: WH, repeat: 0 });
const rev = runDuel(RAPIER, { a: y, b: x, world: W1_SLICE, worldHash: WH, repeat: 0 });
const flip = { A: 'B', B: 'A', none: 'none' };
console.log(`\nK4 record level:`);
console.log(`  forward: ${fwd.outcome} @ ${fwd.timeToOutcome.toFixed(3)}s  sep ${fwd.separation.toFixed(2)}`);
console.log(`  reverse: ${rev.outcome} @ ${rev.timeToOutcome.toFixed(3)}s  sep ${rev.separation.toFixed(2)}`);
console.log(`  outcome mirrors: ${flip[rev.outcome] === fwd.outcome} · time identical: ${fwd.timeToOutcome === rev.timeToOutcome}`);
console.log(`  workA/workB swap: ${fwd.workA === rev.workB && fwd.workB === rev.workA}`);
