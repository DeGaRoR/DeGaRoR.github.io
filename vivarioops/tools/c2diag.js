// tools/c2diag.js — WHY does no duel ever capture? Measure, do not tune.
//
// Three candidate causes and a test for each:
//   1. the pair never gets close       -> closing rate over the duel
//   2. they touch but never the root   -> min distance vs reach sum
//   3. the run dies first              -> invalid reason breakdown

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { genomeHash } from '../engine/l1/genome.js';
import { assessViability } from '../engine/l1/viability.js';
import { S1 } from '../engine/l2/probes.js';
import { runDuel, duelSetup, OUTCOME } from '../engine/l2/duel.js';
import { worldHash } from '../contracts/world.js';
import { W1_SLICE, W1_RESIDENT_HASHES_PLACEHOLDER } from '../worlds/w1_slice.js';

await RAPIER.init();
const WH = worldHash(W1_SLICE, W1_RESIDENT_HASHES_PLACEHOLDER);

const pool = [];
for (let i = 0; pool.length < 8 && i < 400; i++) {
  const g = createRandomGenome(rngFrom('c2', 'pool', i));
  const plan = morphogenesis(g);
  if (!assessViability(RAPIER, g, W1_SLICE, { plan }).ok) continue;
  const m = S1(plan);
  pool.push({ genome: g, plan, hash: genomeHash(g), reach: m.reach, mass: m.massBase });
}

// ── 1. what does the geometry even allow? ───────────────────────────────────
console.log('SEPARATION as specified vs as achievable');
console.log('  tank', W1_SLICE.tankBounds.join(' x '), 'm · engagementK', W1_SLICE.engagementK);
const reaches = pool.map(p => p.reach).sort((a, b) => a - b);
console.log(`  reach: min ${reaches[0].toFixed(2)} median ${reaches[4].toFixed(2)} max ${reaches[reaches.length - 1].toFixed(2)}`);
let wantedAll = [], gotAll = [];
for (let i = 0; i < pool.length; i++) {
  for (let j = i + 1; j < pool.length; j++) {
    for (let r = 0; r < 3; r++) {
      const s = duelSetup({
        aHash: pool[i].hash, bHash: pool[j].hash,
        reachA: pool[i].reach, reachB: pool[j].reach,
        repeat: r, world: W1_SLICE, worldHashStr: WH,
      });
      wantedAll.push(s.wanted); gotAll.push(s.separation);
    }
  }
}
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`  11 §6 asks for median ${med(wantedAll).toFixed(1)} m · the tank allows median ${med(gotAll).toFixed(1)} m`);
console.log(`  03 §4 engagementRadius = 4 x (reachA+reachB) = ${(4 * 2 * med(reaches)).toFixed(0)} m in a ${W1_SLICE.tankBounds[0]} m tank\n`);

// ── 2. does anything close? ─────────────────────────────────────────────────
console.log('CLOSING over 15 s, at the separation the tank allows');
let closed = 0, n = 0;
const gaps = [];
for (let i = 0; i < pool.length; i++) {
  for (let j = i + 1; j < pool.length; j++) {
    const d = runDuel(RAPIER, { a: pool[i], b: pool[j], world: W1_SLICE, worldHash: WH, repeat: 0 });
    n++;
    if (!d.valid) continue;
    const reachSum = pool[i].reach + pool[j].reach;
    gaps.push(d.minDistance - reachSum);
    if (d.minDistance < d.separation) closed++;
  }
}
gaps.sort((a, b) => a - b);
console.log(`  ${closed}/${n} pairs ended nearer than they began`);
console.log(`  minDistance - (reachA+reachB): median ${med(gaps).toFixed(2)} m · best ${gaps[0].toFixed(2)} m`);
console.log('  (negative means the reach envelopes overlapped: contact was geometrically possible)\n');

// ── 3. what does a duel at TOUCHING range do? ───────────────────────────────
// If captures never happen even when they start in contact, the problem is the
// root-contact rule, not the approach.
console.log('CONTROL: the same pairs started at 1.2 x reach sum, not at k x reach sum');
const near = { ...W1_SLICE, tankBounds: W1_SLICE.tankBounds };
let capsNear = 0, nNear = 0, invalidNear = 0;
for (let i = 0; i < pool.length; i++) {
  for (let j = i + 1; j < pool.length; j++) {
    // Shrink the request by shrinking the reported reach; the harness clamps to
    // the tank anyway, so this is the only lever that is not a code change.
    const a = { ...pool[i], reach: pool[i].reach * 0.15 };
    const b = { ...pool[j], reach: pool[j].reach * 0.15 };
    const d = runDuel(RAPIER, { a, b, world: near, worldHash: WH, repeat: 0 });
    nNear++;
    if (!d.valid) { invalidNear++; continue; }
    if (d.outcome !== OUTCOME.NONE) capsNear++;
  }
}
console.log(`  captures ${capsNear}/${nNear} · invalid ${invalidNear}`);
console.log('  if this is also 0, capture is not reachable and the rule is what to look at\n');

// ── 4. invalid breakdown ────────────────────────────────────────────────────
console.log('INVALID reasons at the specified separation');
const reasons = new Map();
for (let i = 0; i < pool.length; i++) {
  for (let j = i + 1; j < pool.length; j++) {
    for (let r = 0; r < 3; r++) {
      const d = runDuel(RAPIER, { a: pool[i], b: pool[j], world: W1_SLICE, worldHash: WH, repeat: r });
      const key = d.valid ? 'valid' : d.reason;
      reasons.set(key, (reasons.get(key) || 0) + 1);
    }
  }
}
console.log('  ' + [...reasons].map(([k, v]) => `${k} ${v}`).join(' · '));
