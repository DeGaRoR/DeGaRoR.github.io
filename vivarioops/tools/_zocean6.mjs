// tools/_zocean6.mjs — RUN THE PHASE A CAST IN THE OPEN OCEAN.
//
// The same six creatures the Forage screen releases by default, in the same
// configuration the screen's ocean mode builds: ONE unbounded shared arena,
// `makeChunkedFood` materialising water as mouths reach it, ghosts so the
// creatures compete for food rather than colliding, and one shared depleting
// field. This is the headless twin of what a person watches, so the numbers and
// the screen cannot disagree.
//
// It answers the two questions the numbers keep dodging — do they MOVE, and can
// they ORIENT — and it does the second one honestly: `turn` is measured in a
// SEPARATE solo run at turnBias 0.8, because a steering command is not something
// the forage screen issues (forage.js still hardcodes turnBias 0, which is Phase
// D's line to change).
//
// Run: node tools/_zocean6.mjs [SECONDS=300]
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { binomial } from '../engine/l1/naming.js';
import { createArena, createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { qrot } from '../engine/l1/vecmath.js';
import { makeChunkedFood, mouthsOf, mouthPoints, forageStep, ledger, INGEST_RATE } from '../engine/l2/forage.js';
import { authoredList } from '../worlds/atlas_seed.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const SECONDS = Number(process.argv[2] ?? 300);
const CAST = authoredList().slice(0, 6);

const HABITAT = W1_SLICE.habitatBounds;
const ring = (n, i) => {
  const a = (i / Math.max(1, n)) * Math.PI * 2;
  return [Math.cos(a) * (HABITAT[0] / 4), Math.sin(a) * (HABITAT[1] / 3), 0];
};

/** Heading change per second at a steering command, degrees. Solo, by design. */
function turnRate(plan, genome, bias = 0.8, seconds = 20) {
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, W1_SLICE,
      { bounded: false, wrap: false, effort: 1, turnBias: bias });
  } catch { return NaN; }
  const fwd = () => {
    const q = sim.bodies[0].rotation();
    const f = qrot([q.x, q.y, q.z, q.w], [0, 0, 1]);
    return Math.atan2(f[0], f[2]);
  };
  for (let s = 0; s < Math.round(3 / FIXED_DT); s++) sim.step();
  let prev = fwd(), total = 0;
  for (let s = 0; s < Math.round(seconds / FIXED_DT); s++) {
    try { sim.step(); } catch { break; }
    if (s % 12) continue;
    let d = fwd() - prev;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    total += d; prev = fwd();
  }
  sim.free();
  return (Math.abs(total) / seconds) * (180 / Math.PI);
}

// ── the shared ocean ────────────────────────────────────────────────────────
const arena = createArena(RAPIER, W1_SLICE, { bounded: false });
const food = makeChunkedFood(W1_SLICE);
const members = [];
CAST.forEach((entry, i) => {
  const plan = morphogenesis(entry.genome);
  const sim = createSimulation(RAPIER, plan, entry.genome, W1_SLICE, {
    arena, wrap: false, origin: ring(CAST.length, i),
    creatureCollision: false, collisionGroup: i,
  });
  const mouths = mouthsOf(plan);
  const p = sim.bodies[0].translation();
  members.push({
    entry, plan, sim, mouths, buf: mouths.map(() => [0, 0, 0]),
    eaten: 0, path: 0, prev: null, start: { x: p.x, y: p.y, z: p.z },
    name: entry.commonName || binomial(plan, entry.genome).binomial,
  });
});

const t0 = Date.now();
const steps = Math.round(SECONDS / FIXED_DT);
let nonFinite = 0;
for (let s = 0; s < steps; s++) {
  arena.stepAll(members.map((m) => m.sim));
  // MATERIALISE THE WATER FIRST. The open ocean is generated on demand around
  // where mouths actually are; without this the field stays empty and every
  // creature eats exactly nothing, which is what the first run of this reported.
  // ui/screens/forage.js:1047 makes the same call in the same order.
  for (const m of members) food.ensureAround(mouthPoints(m.sim, m.plan, m.mouths, m.buf));
  for (const m of members) {
    m.eaten += forageStep(m.sim, m.plan, food, m.mouths, FIXED_DT, INGEST_RATE, m.buf);
  }
  if (s % 60) continue;
  for (const m of members) {
    const c = m.sim.bodies[0].translation();
    if (!Number.isFinite(c.x + c.y + c.z)) { nonFinite++; continue; }
    if (m.prev) m.path += Math.hypot(c.x - m.prev.x, c.y - m.prev.y, c.z - m.prev.z);
    m.prev = { x: c.x, y: c.y, z: c.z };
  }
}
const wall = (Date.now() - t0) / 1000;

console.log(`\n  THE OPEN OCEAN — ${members.length} creatures, one shared field, ${SECONDS} s\n`);
console.log('   #  name                              bodies  mass    net cm/s  straight  eaten g  in/out  turn deg/s');
console.log('  ' + '-'.repeat(108));

for (let i = 0; i < members.length; i++) {
  const m = members[i];
  const e = m.sim.bodies[0].translation();
  const net = Math.hypot(e.x - m.start.x, e.y - m.start.y, e.z - m.start.z);
  const mass = totalMass(m.plan);
  const L = ledger(W1_SLICE, mass, m.eaten, m.sim.workOut, SECONDS);
  const tr = turnRate(m.plan, m.entry.genome, 0.8);
  console.log('  ' + String(i + 1).padStart(2) + '  ' + m.name.slice(0, 32).padEnd(34)
    + String(m.plan.bodyCount).padStart(5)
    + mass.toFixed(1).padStart(8)
    + (net / SECONDS).toFixed(4).padStart(10)
    + (m.path > 0 ? net / m.path : 0).toFixed(2).padStart(10)
    + m.eaten.toFixed(2).padStart(9)
    + L.ratio.toFixed(2).padStart(8)
    + (Number.isFinite(tr) ? tr.toFixed(2) : '—').padStart(12));
}

console.log(`\n  ${wall.toFixed(1)} s wall for ${SECONDS} s of ocean = ${(SECONDS / wall).toFixed(0)}x realtime`
  + `   ·  non-finite readings: ${nonFinite}`);
console.log(`  water materialised: ${food.items.length} items\n`);

for (const m of members) m.sim.free();
arena.free();
