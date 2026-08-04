// tools/_zcast6.mjs — PICK A FORAGE TEAM OF SIX that demonstrates Phase A.
//
// Not a benchmark. The question this answers is the one numbers keep dodging:
// do the creatures MOVE better, and can they ORIENT themselves? So it selects a
// cast a person can watch in the open ocean, and reports the three things that
// are visible rather than the thirty that are not.
//
// COMPOSITION. Two authored reference animals — the Eel, which the whole library
// is built around, and the Darter — plus four drawn fresh from the POST-A2
// generator and required to carry a spine (longestRun >= 4). Before A2 that draw
// was impossible: over 400 genomes a run of four identical segments occurred
// ZERO times. Half the point of the cast is that four of its six members are
// animals the old generator could not express.
//
// WHAT IS MEASURED, per creature:
//   netSpeed   cm/s of actual displacement, not path length — a creature
//              thrashing in place scores zero, which is the point.
//   turnRate   deg/s of heading change at turnBias 0.8. This is the ORIENTATION
//              question. Before Phase A the corpus median was 0.18 deg/s: a
//              creature turned under three degrees in fifteen seconds and could
//              not aim at anything. No steering code was written in Phase A.
//   in/out     the forage ledger at the recalibrated FOOD_ENERGY. Above 1 the
//              animal is paying its way.
//
// Selection is on the ledger ratio gated by movement, because a creature that
// eats well by sitting in a rich patch is not what this is demonstrating.
//
// Run: node tools/_zcast6.mjs [DRAWS=400] [SECONDS=120]
import RAPIER from '@dimforge/rapier3d-compat';
import { writeFileSync } from 'node:fs';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { signature, binomial } from '../engine/l1/naming.js';
import { serialise } from '../engine/l1/genome.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { qrot } from '../engine/l1/vecmath.js';
import { makeFood, mouthsOf, forageStep, ledger, INGEST_RATE } from '../engine/l2/forage.js';
import { authoredList } from '../worlds/atlas_seed.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const DRAWS = Number(process.argv[2] ?? 400);
const SECONDS = Number(process.argv[3] ?? 120);

const runOf = (g) => { try { return signature(morphogenesis(g), g).longestRun; } catch { return 0; } };

/** Heading change per second at a steering command, in degrees. */
function turnRate(plan, genome, bias = 0.8, seconds = 20) {
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, W1_SLICE,
      { bounded: false, wrap: false, effort: 1, turnBias: bias });
  } catch { return NaN; }
  const fwd = () => {
    const q = sim.bodies[0].rotation();
    const f = qrot([q.x, q.y, q.z, q.w], [0, 0, 1]);
    // Heading in the horizontal plane, which is what "which way is it pointing"
    // means to someone looking at the tank.
    return Math.atan2(f[0], f[2]);
  };
  for (let s = 0; s < Math.round(3 / FIXED_DT); s++) sim.step();
  let prev = fwd(), total = 0;
  const steps = Math.round(seconds / FIXED_DT);
  for (let s = 0; s < steps; s++) {
    try { sim.step(); } catch { break; }
    if (s % 12) continue;
    const h = fwd();
    let d = h - prev;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    total += d; prev = h;
  }
  sim.free();
  return (Math.abs(total) / seconds) * (180 / Math.PI);
}

function forage(plan, genome, seconds = SECONDS, seed = 31337) {
  const food = makeFood(W1_SLICE, { seed });
  const mouths = mouthsOf(plan);
  if (!mouths.length) return null;
  const buf = mouths.map(() => [0, 0, 0]);
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, W1_SLICE,
      { bounded: true, wrap: false, effort: 1, turnBias: 0 });
  } catch { return null; }
  const p0 = sim.bodies[0].translation();
  const start = { x: p0.x, y: p0.y, z: p0.z };
  let eaten = 0, path = 0, prev = null;
  const steps = Math.round(seconds / FIXED_DT);
  for (let s = 0; s < steps; s++) {
    try { sim.step(); } catch { break; }
    eaten += forageStep(sim, plan, food, mouths, FIXED_DT, INGEST_RATE, buf);
    if (s % 30) continue;
    const c = sim.bodies[0].translation();
    if (prev) path += Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z);
    prev = { x: c.x, y: c.y, z: c.z };
  }
  const e = sim.bodies[0].translation();
  const net = Math.hypot(e.x - start.x, e.y - start.y, e.z - start.z);
  const mass = totalMass(plan);
  const L = ledger(W1_SLICE, mass, eaten, sim.workOut, seconds);
  sim.free();
  if (!Number.isFinite(net) || !Number.isFinite(L.ratio)) return null;
  return { eaten, net: net / seconds, path: path / seconds, mass,
    workOut: L.spend - L.basal, ratio: L.ratio, straight: path > 0 ? net / path : 0 };
}

const t0 = Date.now();
const say = (m) => console.log('  ' + ((Date.now() - t0) / 1000).toFixed(0).padStart(4) + 's  ' + m);

// ── draw spined candidates ──────────────────────────────────────────────────
say(`drawing ${DRAWS} genomes, keeping viable spines`);
const cands = [];
for (let i = 0; i < DRAWS; i++) {
  const g = createRandomGenome(rngFrom('cast6', 'draw', i));
  if (runOf(g) < 4) continue;
  let v; try { v = assessViability(RAPIER, g, W1_SLICE); } catch { continue; }
  if (!v.ok) continue;
  cands.push({ genome: g, plan: v.plan });
}
say(`  ${cands.length} viable spined candidates`);

// ── score them ──────────────────────────────────────────────────────────────
say(`scoring ${cands.length} x ${SECONDS}s`);
const scored = [];
for (const c of cands) {
  const f = forage(c.plan, c.genome);
  if (!f) continue;
  // Gated on going somewhere: a creature that eats well without moving is not
  // demonstrating locomotion.
  const score = f.ratio * Math.min(1, f.net / 0.02);
  scored.push({ ...c, ...f, score });
}
scored.sort((a, b) => b.score - a.score);
say(`  best ${scored[0]?.score.toFixed(2)}`);

// ── assemble the six ────────────────────────────────────────────────────────
const lib = authoredList();
const authored = ['Eel', 'Darter']
  .map((n) => lib.find((a) => a.commonName === n))
  .filter(Boolean)
  .map((a) => ({ id: a.id, name: a.commonName, genome: a.genome, plan: morphogenesis(a.genome), authored: true }));

const wild = scored.slice(0, 6 - authored.length).map((s, i) => ({
  id: `spine-${i + 1}`, name: null, genome: s.genome, plan: s.plan, authored: false,
}));

const team = authored.concat(wild);
say('measuring the team');

console.log('\n  THE CAST\n');
console.log('   #  origin    name                              bodies segs   mass   netSpd  turn deg/s  in/out');
console.log('  ' + '-'.repeat(104));

const out = [];
team.forEach((m, i) => {
  const f = forage(m.plan, m.genome, SECONDS);
  const tr = turnRate(m.plan, m.genome, 0.8);
  const nm = m.name || (() => { try { return binomial(m.plan, m.genome).binomial; } catch { return 'unnamed'; } })();
  console.log('  ' + String(i + 1).padStart(2)
    + '  ' + (m.authored ? 'authored' : 'drawn   ')
    + '  ' + nm.slice(0, 32).padEnd(34)
    + String(m.plan.bodyCount).padStart(4)
    + String(runOf(m.genome)).padStart(5)
    + (f ? f.mass.toFixed(1) : '—').padStart(8)
    + (f ? f.net.toFixed(4) : '—').padStart(9)
    + (Number.isFinite(tr) ? tr.toFixed(2) : '—').padStart(12)
    + (f ? f.ratio.toFixed(2) : '—').padStart(9));
  out.push({ id: m.id, name: nm, authored: m.authored,
    bodies: m.plan.bodyCount, segs: runOf(m.genome),
    mass: f?.mass, netSpeed: f?.net, turnDegPerSec: tr, ratio: f?.ratio,
    genome: JSON.parse(serialise(m.genome)) });
});

writeFileSync(new URL('./_zcast6_out.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`\n  ${((Date.now() - t0) / 1000).toFixed(0)}s wall -> tools/_zcast6_out.json\n`);
