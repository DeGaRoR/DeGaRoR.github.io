// tools/c2sweep.js — capture rate against starting separation.
//
// The duel produces no captures at the separation 11 §6 asks for. Is that the
// approach phase being unreachable, or is capture unreachable at any distance?
// The answer decides whether C2's checkpoint is blocked on locomotion (a carried
// B3/C1 problem) or on the duel rule (a C2 problem).
//
// Separation is expressed as a MULTIPLE OF THE REACH SUM so it is comparable
// across pairs: 1.0 means their reach envelopes exactly meet.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { genomeHash } from '../engine/l1/genome.js';
import { assessViability } from '../engine/l1/viability.js';
import { S1 } from '../engine/l2/probes.js';
import { createArena, createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { sensorTurnBias } from '../engine/l1/controller.js';
import { rootContact, bearingTo } from '../engine/l2/duel.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

await RAPIER.init();
const STEPS = Math.round(W1_SLICE.duelDuration / FIXED_DT);
const SETTLE = Math.round(2.0 / FIXED_DT);

const pool = [];
for (let i = 0; pool.length < 10 && i < 500; i++) {
  const g = createRandomGenome(rngFrom('c2', 'pool', i));
  const plan = morphogenesis(g);
  if (!assessViability(RAPIER, g, W1_SLICE, { plan }).ok) continue;
  const m = S1(plan);
  pool.push({ genome: g, plan, hash: genomeHash(g), reach: m.reach });
}

const bad = (s) => {
  for (const rb of s.bodies) {
    const p = rb.translation(), v = rb.linvel(), a = rb.angvel();
    if (!Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z + a.x + a.y + a.z)) return true;
    if (Math.hypot(v.x, v.y, v.z) > 1000) return true;
  }
  return false;
};

function fight(x, y, sep) {
  const arena = createArena(RAPIER, W1_SLICE, { bounded: true });
  const a = createSimulation(RAPIER, x.plan, x.genome, W1_SLICE, { arena, origin: [-sep / 2, 0, 0], effort: 0 });
  const b = createSimulation(RAPIER, y.plan, y.genome, W1_SLICE, { arena, origin: [sep / 2, 0, 0], effort: 0 });
  const hA = new Set(a.colliders.map(c => c.handle));
  const hB = new Set(b.colliders.map(c => c.handle));

  for (let s = 0; s < SETTLE; s++) arena.stepAll([a, b]);
  a.resetClock(); b.resetClock();
  a.control.effort = 1; b.control.effort = 1;

  const d0 = dist(a, b);
  let minD = d0, out = 'none', closedBy = 0;
  for (let s = 0; s < STEPS; s++) {
    const ca = a.centreOfMass(), cb = b.centreOfMass();
    a.control.turnBias = sensorTurnBias(a.genome, bearingTo(a, cb), bearingTo(a, cb));
    b.control.turnBias = sensorTurnBias(b.genome, bearingTo(b, ca), bearingTo(b, ca));
    arena.stepAll([a, b]);
    if (bad(a) || bad(b)) { out = 'unstable'; break; }
    const d = dist(a, b);
    if (d < minD) minD = d;
    if (rootContact(arena.world3d, hA, b).hit) { out = 'A'; break; }
    if (rootContact(arena.world3d, hB, a).hit) { out = 'B'; break; }
  }
  closedBy = d0 - minD;
  a.free(); b.free(); arena.free();
  return { out, closedBy, d0 };
}

const dist = (x, y) => {
  const p = x.centreOfMass(), q = y.centreOfMass();
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

console.log('separation is a multiple of (reachA + reachB); 1.0 = envelopes touching\n');
console.log(' mult   duels  capture  stalemate  unstable   median closing (m)');

for (const mult of [0.5, 0.75, 1.0, 1.5, 2.0]) {
  let cap = 0, st = 0, un = 0, n = 0;
  const closes = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const reachSum = pool[i].reach + pool[j].reach;
      const sep = mult * reachSum;
      // Skip pairs that cannot be placed at this separation without a wall.
      const need = sep / 2 + Math.max(pool[i].reach, pool[j].reach) + 0.5;
      if (need > 8) continue;
      n++;
      const r = fight(pool[i], pool[j], sep);
      if (r.out === 'unstable') un++;
      else if (r.out === 'none') { st++; closes.push(r.closedBy); }
      else { cap++; closes.push(r.closedBy); }
    }
  }
  closes.sort((a, b) => a - b);
  const m = closes.length ? closes[Math.floor(closes.length / 2)].toFixed(2) : '-';
  console.log(` ${mult.toFixed(2)}   ${String(n).padStart(5)}  ${String(cap).padStart(7)}  ${String(st).padStart(9)}  ${String(un).padStart(8)}   ${m.padStart(8)}`);
}
