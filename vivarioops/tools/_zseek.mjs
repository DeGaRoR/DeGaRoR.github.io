// tools/_zseek.mjs — THROWAWAY. Does the tank's Seek loop actually home?
//
// Exactly what the tank does: each step set turnBias = clamp(bearingTo(sim, ORIGIN))
// and let the creature steer. Compare the mean distance from the home point over
// the run against the SAME creature swimming free (turnBias 0). Homing < free
// means the steering loop is closed — the actuator now carries a turn (C1) toward
// a bearing measured the repaired way (C0.1), which is the whole of C5.
//
//   node tools/_zseek.mjs [nRandom] [seconds]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { bearingTo } from '../engine/l2/duel.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const N = Number(process.argv[2] ?? 6);
const T = Number(process.argv[3] ?? 20);
await RAPIER.init();
const ORIGIN = [0, 0, 0];
const clamp1 = (x) => Math.max(-1, Math.min(1, x));

// mean distance of the CoM from the home point over T seconds, at a fixed bias
// policy: 'free' (turnBias 0) or 'seek' (steer toward origin every step).
function meanDist(plan, genome, mode) {
  const sim = createSimulation(RAPIER, plan, genome, W1_SLICE, { bounded: true, effort: 1, turnBias: 0 });
  for (let k = 0; k < Math.round(2 / FIXED_DT); k++) sim.step();
  let sum = 0, n = 0;
  const steps = Math.round(T / FIXED_DT);
  for (let k = 0; k < steps; k++) {
    if (mode === 'seek') sim.control.turnBias = clamp1(bearingTo(sim, ORIGIN));
    sim.step();
    const c = sim.centreOfMass();
    sum += Math.hypot(c[0], c[1], c[2]); n++;
  }
  sim.free();
  return sum / n;
}

const subs = [];
for (const sd of SEEDS) { if (sd.id === 'staircase') continue; const g = sd.genome ?? sd; try { subs.push({ id: sd.id, genome: g, plan: morphogenesis(g) }); } catch {} }
let n = 0;
for (let i = 0; n < N; i++) { const g = createRandomGenome(rngFrom('seek', i)); let p; try { p = morphogenesis(g); } catch { continue; } if (p.jointCount < 2) continue; subs.push({ id: `r${i}`, genome: g, plan: p }); n++; }

console.log(`\n  _zseek · ${T}s · mean distance from home (m) — lower with Seek = the loop homes\n`);
console.log('  id            free    seek     homes?');
let wins = 0;
for (const s of subs) {
  const free = meanDist(s.plan, s.genome, 'free');
  const seek = meanDist(s.plan, s.genome, 'seek');
  const homes = seek < free * 0.9;   // 10% closer counts as homing
  if (homes) wins++;
  console.log(`  ${s.id.padEnd(12)} ${free.toFixed(2).padStart(6)}  ${seek.toFixed(2).padStart(6)}    ${homes ? 'YES' : 'no'}`);
}
console.log(`\n  ${wins}/${subs.length} creatures stay measurably nearer home under Seek (steering closes the loop)\n`);
