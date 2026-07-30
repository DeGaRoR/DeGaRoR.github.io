// tools/c1effort.js — c1sat ruled out torque saturation (clamp active 5%), but
// showed joint angular speed pinned near 6 rad/s at EVERY effort. That is an
// actuator BANDWIDTH limit: `effort` multiplies omega, i.e. the COMMAND
// FREQUENCY, and the PD loop cannot follow frequencies above its own passband,
// so the joint moves at its natural rate whatever it is told.
//
// If that is right, then 11 §5's choice of omega as the effort knob is the
// problem, not the accumulator, and an AMPLITUDE knob — same three operating
// points, inside the passband — should restore 11 §12.3's monotonicity.
//
// Tested by scaling the amplitude genes directly, so nothing in the engine
// changes until the measurement says it should.
//
// Run: node tools/c1effort.js [n]

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { runSolo, indexAt, meanSpeed, meanPower } from '../engine/l2/probe.js';
import { S2_DURATION, S2_WINDOW } from '../engine/l2/probes.js';
import { RANGE } from '../engine/l1/genome.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();
const N = Number(process.argv[2] || 20);
const q = (a, f) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length * f)] : 0);
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(4) : String(x));

/** Scale every joint amplitude, clamped into its legal range. */
function withAmplitude(genome, k) {
  const jg = {};
  for (const [id, g] of Object.entries(genome.controller.jointGenes)) {
    jg[id] = { ...g, amplitude: Math.min(RANGE.amplitude[1], Math.max(RANGE.amplitude[0], g.amplitude * k)) };
  }
  return { ...genome, controller: { ...genome.controller, jointGenes: jg } };
}

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 6; i++) {
  const g = createRandomGenome(rngFrom('c1', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok) corpus.push({ genome: g, plan: v.plan });
}

const EFFORTS = [0.6, 1.0, 1.5];

function sweep(label, run) {
  let speedUp = 0, powerUp = 0, powerSuper = 0, n = 0;
  const spread = [], vr = [], pr = [];
  for (const { genome, plan } of corpus) {
    const vs = [], ps = [];
    for (const e of EFFORTS) {
      const r = run(genome, plan, e);
      if (!r || !r.valid) { vs.length = 0; break; }
      const from = indexAt(r.trace, S2_DURATION - S2_WINDOW);
      vs.push(meanSpeed(r.trace, from, r.trace.n));
      ps.push(meanPower(r.trace, from, r.trace.n));
    }
    if (vs.length !== 3) continue;
    n++;
    if (vs[0] <= vs[1] && vs[1] <= vs[2]) speedUp++;
    if (ps[0] <= ps[1] && ps[1] <= ps[2]) powerUp++;
    if (ps[0] > 1e-12 && ps[2] / ps[0] > 2.5) powerSuper++;
    const mean = (vs[0] + vs[1] + vs[2]) / 3;
    spread.push(mean > 1e-9 ? (Math.max(...vs) - Math.min(...vs)) / mean : 0);
    vr.push(vs[2] / Math.max(1e-12, vs[0]));
    pr.push(ps[2] / Math.max(1e-12, ps[0]));
  }
  console.log(`\n${label}   (n = ${n})`);
  console.log(`  speed rises with effort:   ${speedUp}/${n}`);
  console.log(`  power rises with effort:   ${powerUp}/${n}`);
  console.log(`  power rises superlinearly: ${powerSuper}/${n}`);
  console.log(`  speed spread across the three points: p50 ${fmt(q(spread, 0.5))}`);
  console.log(`  speed ratio 1.5/0.6: p50 ${fmt(q(vr, 0.5))}`);
  console.log(`  power ratio 1.5/0.6: p50 ${fmt(q(pr, 0.5))}   (linear in effort = 2.50)`);
}

const base = { world: W1_SLICE, gravity: 0, bounded: false, duration: S2_DURATION };

sweep('A. effort as OMEGA multiplier  (11 §5 as written)',
  (genome, plan, e) => runSolo(RAPIER, { ...base, plan, genome, effort: e }));

sweep('B. effort as AMPLITUDE multiplier',
  (genome, plan, e) => runSolo(RAPIER, { ...base, plan, genome: withAmplitude(genome, e), effort: 1 }));

sweep('C. effort as BOTH',
  (genome, plan, e) => runSolo(RAPIER, { ...base, plan, genome: withAmplitude(genome, e), effort: e }));
