// tools/_zcompare.mjs — the winner against the references, every column.
//
//   node tools/_zcompare.mjs
//
// WHY THIS IS SEPARATE FROM THE RUN. _zselect.mjs reports balance because that
// is what it selected on, and a selection run that grades its own winner on its
// own objective tells you nothing you did not already know. The question here is
// the one the objective cannot answer: IS THE WINNER GOOD, OR IS IT BIG?
//
// balance-vs-mass came out at pearson 0.50 over the final generation and the
// winner sits at 37.4 g against a 3.5-38.8 g corpus — near the ceiling. So the
// per-gram columns are the point of this table, not decoration.

import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync } from 'node:fs';
import { morphogenesis, totalMass, boundingRadius } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { deserialise } from '../engine/l1/genome.js';
import { binomial } from '../engine/l1/naming.js';
import { makeFood, mouthsOf, forageStep, ledger, INGEST_RATE } from '../engine/l2/forage.js';
import { W1_SLICE } from '../worlds/w1_slice.js';
import { SEEDS } from '../worlds/seeds.js';

await RAPIER.init();
const SECONDS = Number(process.argv[2] ?? 300);
const BURST_SPREAD = 3;

function trial(genome, seconds = SECONDS) {
  const plan = morphogenesis(genome);
  const food = makeFood(W1_SLICE, { seed: 0xF00D });
  const mouths = mouthsOf(plan);
  const buf = mouths.map(() => [0, 0, 0]);
  const sim = createSimulation(RAPIER, plan, genome, W1_SLICE, { bounded: true, wrap: false, effort: 1, turnBias: 0 });
  const rate = W1_SLICE.INGEST_RATE ?? INGEST_RATE;
  const start = sim.centreOfMass();
  let eaten = 0, burst = false;
  // MOUTH PATH LENGTH — how far the mouth itself travelled, which is not the same
  // as how far the ANIMAL travelled. `mouthsOf` puts the single mouth at
  // dims[axis]*0.5 from the root body's centre, so a large root swings its mouth
  // through a long arc on every stroke while staying in one place. If intake
  // tracks this rather than mass, the size advantage is LEVER ARM, and
  // INGEST_RATE's "a big animal gets no bonus for being big" governs the rate but
  // not the swept volume.
  let path = 0;
  let prev = null;
  for (let st = 0, n = Math.round(seconds / FIXED_DT); st < n; st++) {
    try { sim.step(); } catch { break; }
    eaten += forageStep(sim, plan, food, mouths, FIXED_DT, rate, buf);
    if (st % 24 === 0) {
      const m = buf[0];
      if (m) {
        if (prev) path += Math.hypot(m[0] - prev[0], m[1] - prev[1], m[2] - prev[2]);
        prev = [m[0], m[1], m[2]];
      }
    }
    if (st % 240 === 0 && sim.integrity().spread > BURST_SPREAD) { burst = true; break; }
  }
  const end = sim.centreOfMass();
  const work = sim.workOut;
  sim.free();
  const mass = totalMass(plan);
  const L = ledger(W1_SLICE, mass, eaten, work, seconds);
  return {
    burst, mass, bodies: plan.bodyCount, mouths: mouths.length,
    radius: boundingRadius(plan), eaten, work,
    balance: L.balance, ratio: L.ratio,
    moved: Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]),
    path,
    binomial: binomial(plan, genome).binomial,
  };
}

const cast = [];
for (const id of ['eel', 'eel-slow']) {
  const s = SEEDS.find((x) => x.id === id);
  if (s) cast.push({ label: s.name, genome: s.genome });
}
for (const r of JSON.parse(readFileSync(new URL('./_zrefs.json', import.meta.url), 'utf8'))) {
  cast.push({ label: r.label, genome: deserialise(JSON.stringify(r.genome)) });
}
// The winner file carries BOTH forms. `genome` is the canonical in-memory shape
// — `controller.jointGenes` is a MAP there, keyed by nodeId (genome.js:207, and
// 10 §A5 correction 5 forbids referencing nodes by array index) — so it is used
// as-is. `serialised` is the array form and is what `deserialise` wants. Feeding
// one to the other throws, which is how this was found.
for (const file of ['_zselect_winner.json', '_zselect_winner_per-gram.json']) {
  let win;
  try { win = JSON.parse(readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')); } catch { continue; }
  cast.push({
    label: `>> ${win.vernacular}`,
    genome: win.serialised ? deserialise(win.serialised) : win.genome,
  });
}

const f = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');
console.log(`\n  ${SECONDS}s trials, identical food field (seed 0xF00D), same arena.\n`);
console.log('  creature                  balance   margin    eaten   moved    mass  b/m   bal/g   eat/g  mouthpath  eat/path');
console.log('  ' + '-'.repeat(94));
for (const c of cast) {
  const r = trial(c.genome);
  console.log(`  ${c.label.padEnd(24)}${f(r.balance, 0).padStart(9)}${f(r.ratio).padStart(8)}x`
    + `${f(r.eaten).padStart(9)}${f(r.moved, 1).padStart(8)}${f(r.mass).padStart(8)}`
    + `${String(r.bodies).padStart(4)}${f(r.balance / r.mass, 0).padStart(8)}`
    + `${f(r.eaten / r.mass, 2).padStart(8)}${f(r.path, 0).padStart(11)}${f(1000 * r.eaten / (r.path || 1), 2).padStart(10)}`
    + (r.burst ? '  [BURST]' : ''));
}
console.log('\n  bal/g and eat/g are the columns that answer "good, or merely big".\n');
