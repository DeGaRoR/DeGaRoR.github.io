// tools/_ztwist.mjs — A/B the twist-limit band on the authored corpus.
//
// WHAT IT ANSWERS. `RANGE.twistLimit` narrows a twist joint's half-range from
// pi/2 to 0.35 rad, and morphogen.js clamps to it at expression. Two questions
// follow and only measurement settles them: does the roll actually go away (it
// is a HARD limit, so it must, but the peak is what says by how much), and what
// does it cost in locomotion, since a twist joint's commanded half-swing is
// `amplitude * angleLimits[0]` and that just fell by up to 4.5x.
//
// THE "BEFORE" ARM RESTORES THE OLD BEHAVIOUR AT RUNTIME by widening
// RANGE.twistLimit back to RANGE.angleLimit. `limitRangeFor` then returns the
// bend band for twist and morphogen's clamp becomes a no-op, so the arm is the
// pre-change engine exactly. Same process, same genomes, same seeds, same
// world — the ONLY difference between the arms is the band.
//
// ROLL IS MEASURED THROUGH `sim.relativeAngle`, which is swingTwistAngle about
// the joint's OWN axis in the parent's frame. physics.js:212 records what
// happens to anything that measures it about the parent body's X instead: every
// number is about an arbitrary axis. Do not reimplement this here.
//
// Run: node tools/_ztwist.mjs [SECONDS=20]
import RAPIER from '@dimforge/rapier3d-compat';
import { RANGE, deserialise } from '../engine/l1/genome.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { W1_SLICE } from '../worlds/w1_slice.js';
import { W1_RESIDENT_GENOMES } from '../worlds/w1_residents.js';
import { W1_SPINE_GENOMES } from '../worlds/w1_spines.js';
import { W1_PLAYER_GENOMES } from '../worlds/w1_player.js';

await RAPIER.init();
const SECONDS = Number(process.argv[2] ?? 20);

const NARROW = RANGE.twistLimit.slice();
const WIDE = RANGE.angleLimit.slice();

const DEG = (x) => (x * 180 / Math.PI).toFixed(1);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const median = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0);

function corpus() {
  const out = [];
  for (const src of [W1_RESIDENT_GENOMES, W1_SPINE_GENOMES, W1_PLAYER_GENOMES]) {
    for (const [id, g] of Object.entries(src)) {
      // `deserialise` TAKES AN OBJECT AS WELL AS TEXT, and does three things a
      // bare `migrate` does not: it migrates, it rebuilds `controller.jointGenes`
      // from the stored ARRAY into the map keyed by nodeId that the controller
      // reads, and it validates. Branching on `typeof g === 'string'` and calling
      // migrate for the objects skipped the rebuild, which is the
      // `undefined.freqMult` this tool hit first time out. Every other tool in
      // here calls deserialise unconditionally; so does this one now.
      out.push({ id, genome: deserialise(g) });
    }
  }
  return out;
}

function trial(genome) {
  const plan = morphogenesis(genome);
  const sim = createSimulation(RAPIER, plan, genome, W1_SLICE,
    { bounded: true, wrap: false, effort: 1, turnBias: 0 });
  const twistIdx = plan.joints.map((j, i) => (j.type === 'twist' ? i : -1)).filter((i) => i >= 0);
  const peak = new Float64Array(plan.jointCount);
  const start = sim.centreOfMass();
  const steps = Math.round(SECONDS / FIXED_DT);
  // Sampled at 10 Hz rather than every step: the limit is a hard stop, so the
  // peak is a plateau and not a spike, and 120 Hz sampling costs 12x for nothing.
  for (let s = 0; s < steps; s++) {
    sim.step();
    if (s % 12) continue;
    for (const i of twistIdx) {
      const a = Math.abs(sim.relativeAngle(i));
      if (a > peak[i]) peak[i] = a;
    }
  }
  const end = sim.centreOfMass();
  const disp = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  sim.free();
  return {
    disp,
    twistCount: twistIdx.length,
    jointCount: plan.jointCount,
    rolls: twistIdx.map((i) => peak[i]),
    limits: twistIdx.map((i) => plan.joints[i].angleLimits[0]),
  };
}

function arm(label) {
  const rows = [];
  for (const { id, genome } of corpus()) {
    try { rows.push({ id, ...trial(genome) }); }
    catch (e) { rows.push({ id, err: String(e.message).slice(0, 70) }); }
  }
  const ok = rows.filter((r) => !r.err);
  for (const r of rows.filter((r) => r.err)) console.log(`  !! ${r.id}: ${r.err}`);
  const rolls = ok.flatMap((r) => r.rolls);
  const limits = ok.flatMap((r) => r.limits);
  const disps = ok.map((r) => r.disp);
  console.log(`\n--- ${label} ---`);
  console.log(`  creatures             ${ok.length}/${rows.length}`);
  console.log(`  twist / all joints    ${ok.reduce((s, r) => s + r.twistCount, 0)} / ${ok.reduce((s, r) => s + r.jointCount, 0)}`);
  console.log(`  twist limit           mean ${DEG(mean(limits))} deg    max ${DEG(Math.max(...limits))} deg`);
  console.log(`  peak axial roll       mean ${DEG(mean(rolls))} deg    max ${DEG(Math.max(...rolls))} deg`);
  console.log(`  twist joints > 45 deg ${rolls.filter((a) => a > Math.PI / 4).length} / ${rolls.length}`);
  console.log(`  displacement          mean ${mean(disps).toFixed(3)} m   median ${median(disps).toFixed(3)} m`);
  return ok;
}

RANGE.twistLimit = WIDE;
const before = arm(`BEFORE  twist band [0, ${WIDE[1].toFixed(3)}] (= angleLimit)`);
RANGE.twistLimit = NARROW;
const after = arm(`AFTER   twist band [0, ${NARROW[1].toFixed(3)}] (= twistLimit)`);

// SWEEP. The band is a judgement call about anatomy, but its COST is not, and
// the cost is what decides whether 0.35 is the right place to make the call.
// Every arm re-runs the same ten creatures from spawn, so these are comparable
// to each other and to BEFORE.
if (process.argv.includes('--sweep')) {
  const base = before.map((b) => b.disp);
  console.log('\n--- band sweep: displacement vs BEFORE ---');
  for (const hi of [0.20, 0.35, 0.50, 0.70, 1.00]) {
    RANGE.twistLimit = [0, hi];
    const rows = arm(`band [0, ${hi.toFixed(2)}]  (${DEG(hi)} deg)`);
    const d = rows.map((r, i) => (base[i] > 1e-6 ? (r.disp - base[i]) / base[i] * 100 : NaN))
      .filter(Number.isFinite);
    console.log(`  >> vs BEFORE: median ${median(d).toFixed(1)}%  mean ${mean(d).toFixed(1)}%  better in ${d.filter((x) => x > 0).length}/${d.length}`);
  }
  RANGE.twistLimit = NARROW;
}

console.log('\n--- displacement per creature, m over ' + SECONDS + ' s ---');
const deltas = [];
for (const b of before) {
  const a = after.find((r) => r.id === b.id);
  if (!a) continue;
  const pct = b.disp > 1e-6 ? (a.disp - b.disp) / b.disp * 100 : NaN;
  if (Number.isFinite(pct)) deltas.push(pct);
  console.log(`  ${b.id.padEnd(24)} ${b.disp.toFixed(3)} -> ${a.disp.toFixed(3)}  ${Number.isFinite(pct) ? (pct >= 0 ? '+' : '') + pct.toFixed(0) + '%' : '   n/a'}   ${b.twistCount}/${b.jointCount} twist`);
}
console.log(`\n  median change ${median(deltas).toFixed(1)}%   mean ${mean(deltas).toFixed(1)}%   better in ${deltas.filter((d) => d > 0).length}/${deltas.length}`);
