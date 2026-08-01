// tools/_zwatch.mjs — THROWAWAY. "Watch" Mesoanguillops celer and explain the
// jumps / gaps / convulsions the player sees. Runs the EXACT tank config (small
// bounded tank, 0.5 creature scale, the shipped actuator) and, every physics
// step, measures:
//   jump   — |ΔCoM| in one step (physical is < ~1 cm; a glitch teleports)
//   stretch— per joint, |childPos-parentPos| / its spawn value (>1.5 = a visible
//            GAP opening; the joint constraint is being violated)
//   speed  — max body speed (a spike = a convulsion)
// and logs the worst events so the cause is visible, not guessed.
import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync } from 'node:fs';
import { rngFrom } from '../trunk/rng.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { adaptGait } from '../engine/l2/gait.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

await RAPIER.init();
const scale = Number(process.argv[2] ?? 0.5);      // tank uses 0.5
const T = Number(process.argv[3] ?? 20);
let genome = JSON.parse(readFileSync(new URL('./_celer.json', import.meta.url)));
if (process.argv[5] === 'adapt') {
  const r = adaptGait(RAPIER, { genome, world: W1_SLICE, rng: rngFrom('watch', 'adapt'), candidates: 8, iterations: 4 });
  genome = r.genome;
  console.log('  [gait adapted — the Burst button would do this]');
}
if (scale !== 1) for (const n of genome.nodes) n.dims = n.dims.map((d) => d * scale);
const plan = morphogenesis(genome);
const TANK = { ...W1_SLICE, tankBounds: [10, 15, 10] };   // EXP_TANK_BOUNDS
console.log(`\n  Mesoanguillops celer — ${plan.bodyCount} bodies, ${plan.jointCount} joints, scale ${scale}\n`);

// actuator: 'new' (shipped default) or 'old' (the freq10 build the creature was saved under)
const actuator = (process.argv[4] ?? 'new') === 'old'
  ? { motorFreqHz: 10, budgetScale: 6, stableSpeed: 1e9 }
  : {};
const sim = createSimulation(RAPIER, plan, genome, TANK, { bounded: true, effort: 1, turnBias: 0, ...actuator });
const pos = () => sim.bodies.map((b) => { const p = b.translation(); return [p.x, p.y, p.z]; });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// settle, then record the rest-length of every joint (parent-child centre distance)
for (let k = 0; k < Math.round(2 / FIXED_DT); k++) sim.step();
let P = pos();
const rest = plan.joints.map((j) => Math.max(1e-3, dist(P[j.parentBody], P[j.childBody])));
let prevCom = sim.centreOfMass();

let maxJump = 0, maxStretch = 0, maxSpeed = 0, pathLen = 0;
const com0 = sim.centreOfMass();
const events = [];
const steps = Math.round(T / FIXED_DT);
for (let k = 0; k < steps; k++) {
  sim.step();
  const com = sim.centreOfMass();
  const jump = dist(com, prevCom);
  pathLen += jump;
  prevCom = com;
  P = pos();
  let stretch = 1, sj = -1;
  plan.joints.forEach((j, i) => { const r = dist(P[j.parentBody], P[j.childBody]) / rest[i]; if (r > stretch) { stretch = r; sj = i; } });
  let spd = 0;
  for (const b of sim.bodies) { const v = b.linvel(); spd = Math.max(spd, Math.hypot(v.x, v.y, v.z)); }
  maxJump = Math.max(maxJump, jump); maxStretch = Math.max(maxStretch, stretch); maxSpeed = Math.max(maxSpeed, spd);
  if (jump > 0.1 || stretch > 1.5) events.push({ t: (k * FIXED_DT).toFixed(2), jump: jump.toFixed(3), stretch: stretch.toFixed(2), joint: sj, speed: spd.toFixed(1) });
}
const net = dist(sim.centreOfMass(), com0);
sim.free();

const eff = pathLen > 1e-6 ? net / pathLen : 0;
console.log(`  net travel ${net.toFixed(2)} m over ${T}s   path ${pathLen.toFixed(1)} m   EFFICIENCY ${eff.toFixed(3)} (swim ~0.5-0.9, thrash ~0.02)`);
console.log(`  maxJump ${maxJump.toFixed(3)} m/step   maxStretch ${maxStretch.toFixed(2)}x   maxSpeed ${maxSpeed.toFixed(1)} m/s`);
console.log(`  (physical step at <1 m/s is < 0.01 m; stretch 1.0 = joint intact, >1.5 = visible gap)\n`);
if (events.length) {
  console.log(`  ${events.length} glitch events (jump>0.1m or stretch>1.5x). First 12:`);
  console.log('    t(s)    jump(m)  stretch  joint  speed');
  for (const e of events.slice(0, 12)) console.log(`    ${e.t.padStart(5)}   ${e.jump.padStart(6)}   ${e.stretch.padStart(5)}   ${String(e.joint).padStart(4)}   ${e.speed}`);
} else {
  console.log('  no glitch events — the body stays intact and moves smoothly.');
}
console.log('');
