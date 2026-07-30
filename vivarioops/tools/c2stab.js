// tools/c2stab.js — where does the duel's ~33% instability come from?
//
// Four conditions, same creatures, same 15 s:
//   A  alone, private arena, centred        (what L1-22 already measures)
//   B  alone, private arena, placed off-centre as a duel places it
//   C  alone in a SHARED arena              (isolates the arena refactor)
//   D  two in a shared arena                (isolates the opponent)
//
// If A and B differ, placement is the cause. If B and C differ, the refactor is.
// If C and D differ, creature-creature contact is.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { genomeHash } from '../engine/l1/genome.js';
import { assessViability } from '../engine/l1/viability.js';
import { S1 } from '../engine/l2/probes.js';
import { createArena, createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

await RAPIER.init();
const STEPS = Math.round(W1_SLICE.duelDuration / FIXED_DT);

const pool = [];
for (let i = 0; pool.length < 10 && i < 400; i++) {
  const g = createRandomGenome(rngFrom('c2', 'pool', i));
  const plan = morphogenesis(g);
  if (!assessViability(RAPIER, g, W1_SLICE, { plan }).ok) continue;
  pool.push({ genome: g, plan, hash: genomeHash(g), reach: S1(plan).reach });
}

const bad = (sim) => {
  for (const rb of sim.bodies) {
    const p = rb.translation(), v = rb.linvel(), a = rb.angvel();
    if (!Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z + a.x + a.y + a.z)) return true;
    if (Math.hypot(v.x, v.y, v.z) > 1000) return true;
  }
  return false;
};

function alone(c, origin, shared) {
  const arena = shared ? createArena(RAPIER, W1_SLICE, { bounded: true }) : null;
  const sim = createSimulation(RAPIER, c.plan, c.genome, W1_SLICE, { arena, origin });
  let died = -1;
  for (let s = 0; s < STEPS; s++) {
    if (shared) arena.stepAll([sim]); else sim.step();
    if (bad(sim)) { died = s; break; }
  }
  sim.free(); if (arena) arena.free();
  return died;
}

function pair(x, y, sep) {
  const arena = createArena(RAPIER, W1_SLICE, { bounded: true });
  const a = createSimulation(RAPIER, x.plan, x.genome, W1_SLICE, { arena, origin: [-sep / 2, 0, 0] });
  const b = createSimulation(RAPIER, y.plan, y.genome, W1_SLICE, { arena, origin: [sep / 2, 0, 0] });
  let died = -1;
  for (let s = 0; s < STEPS; s++) {
    arena.stepAll([a, b]);
    if (bad(a) || bad(b)) { died = s; break; }
  }
  a.free(); b.free(); arena.free();
  return died;
}

const off = (c) => [-(8 - c.reach - 0.5) / 2, 0, 0];

let A = 0, B = 0, C = 0, D = 0, nPair = 0;
for (const c of pool) {
  if (alone(c, [0, 0, 0], false) >= 0) A++;
  if (alone(c, off(c), false) >= 0) B++;
  if (alone(c, off(c), true) >= 0) C++;
}
for (let i = 0; i < pool.length; i++) {
  for (let j = i + 1; j < pool.length; j++) {
    nPair++;
    const sep = Math.min(pool[i].reach + pool[j].reach, 16 - 2 * Math.max(pool[i].reach, pool[j].reach) - 1);
    if (pair(pool[i], pool[j], sep) >= 0) D++;
  }
}

console.log(`\nover ${pool.length} creatures / ${nPair} pairs, ${W1_SLICE.duelDuration}s each`);
console.log(`  A alone, private, centred     : ${A}/${pool.length} unstable`);
console.log(`  B alone, private, off-centre  : ${B}/${pool.length} unstable`);
console.log(`  C alone, SHARED arena         : ${C}/${pool.length} unstable`);
console.log(`  D two,   SHARED arena         : ${D}/${nPair} unstable`);
