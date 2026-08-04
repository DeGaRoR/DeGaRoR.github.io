// tools/_zproxy.mjs — IS THE LOCOMOTION OBJECTIVE A SIZE PROXY, OR DOES
// SEGMENTATION SIMPLY SWIM BETTER?
//
// gate/probe.js:454 asserts |pearson(score, bodyCount)| < 0.35. It was 0.03; with
// the A2 spine grammar in the draw it is 0.38 and L2-19 goes red. Two readings,
// and they call for opposite actions:
//
//   (a) THE OBJECTIVE DEGRADED into "bigger is better". Revert or re-tune A2.
//   (b) BODY COUNT BECAME INFORMATIVE. A six-segment chain undulates and a
//       three-body blob does not, so a score that rewards chains correlates with
//       body count WITHOUT rewarding size. The assertion's own intent — B2 §6,
//       "the objective is NOT a size proxy" — is still satisfied.
//
// The discriminator is what ELSE it correlates with. Under (a) score tracks mass
// and volume too, because those are what "bigger" means. Under (b) it tracks
// longestRun and is flat or negative in mass, because a taper makes a chain
// LIGHTER than the blob it beats.
//
// Same corpus construction as the gate — rngFrom('obj', i), 30 draws, bodyCount
// >= 2 — so the numbers are directly comparable to the assertion that failed.
import RAPIER from '@dimforge/rapier3d-compat';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis, totalMass, boundingRadius } from '../engine/l1/morphogen.js';
import { signature } from '../engine/l1/naming.js';
import { netSpeed } from '../engine/l2/objective.js';
import { rngFrom } from '../trunk/rng.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const N = Number(process.argv[2] ?? 30);

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

const corpus = [];
for (let i = 0; i < N; i++) {
  const genome = createRandomGenome(rngFrom('obj', i));
  let plan; try { plan = morphogenesis(genome); } catch { continue; }
  if (plan.bodyCount >= 2) corpus.push({ genome, plan });
}

const rows = [];
for (const c of corpus) {
  const s = netSpeed(RAPIER, { plan: c.plan, genome: c.genome, world: W1_SLICE });
  if (!s.valid) continue;
  let run = 0;
  try { run = signature(c.plan, c.genome).longestRun; } catch { /* 0 */ }
  rows.push({
    score: s.score,
    bodies: c.plan.bodyCount,
    mass: totalMass(c.plan),
    radius: boundingRadius(c.plan),
    run,
    phaseBase: c.genome.controller.phaseBase ?? 0,
  });
}

const col = (k) => rows.map((r) => r[k]);
console.log(`\n  OBJECTIVE CONFOUNDS — ${rows.length} scored creatures\n`);
console.log('    pearson(score, X)');
for (const k of ['bodies', 'mass', 'radius', 'run']) {
  const r = pearson(col('score'), col(k));
  const flag = k === 'bodies' ? (Math.abs(r) < 0.35 ? '' : '   <- the gate bound is 0.35') : '';
  console.log(`      ${k.padEnd(8)} ${r >= 0 ? ' ' : ''}${r.toFixed(3)}${flag}`);
}

// The direct comparison the reading turns on: do spined creatures score better,
// and are they heavier or lighter than the rest?
const spined = rows.filter((r) => r.run >= 4);
const blobs = rows.filter((r) => r.run < 4);
const mean = (a, k) => (a.length ? a.reduce((s, r) => s + r[k], 0) / a.length : NaN);
// IS THE GAIT ITSELF THE VARIABLE? A3 made the whole body commit to ONE phase
// lag, drawn over the full circle. A lag near 0 makes every segment beat in
// phase (a standing wave, no travel); a lag near +/-PI alternates (also no net
// travel); only intermediate lags are a travelling wave. So an UNSELECTED
// coherent gait should be bimodal in quality — and if score is near zero for
// most of the corpus, whatever residual motion remains will correlate with mass,
// because drift does. That would make the mass correlation a statement about the
// corpus, not about the objective.
const band = (lo, hi) => rows.filter((r) => Math.abs(r.phaseBase) >= lo && Math.abs(r.phaseBase) < hi);
console.log('\n    score by |phaseBase| — is there a productive band?');
for (const [lo, hi] of [[0, 0.4], [0.4, 1.2], [1.2, 2.2], [2.2, Math.PI + 0.01]]) {
  const b = band(lo, hi);
  if (!b.length) continue;
  console.log(`      ${lo.toFixed(1)}-${hi.toFixed(1)}  n=${String(b.length).padStart(2)}`
    + `  mean score ${mean(b, 'score').toFixed(4)}`);
}
// The discriminator: among creatures that actually move, does mass still predict?
const sorted = [...rows].sort((a, b) => b.score - a.score);
const top = sorted.slice(0, Math.max(4, Math.floor(rows.length / 2)));
console.log(`\n    pearson(score, mass) over the WHOLE corpus      ${pearson(col('score'), col('mass')).toFixed(3)}`);
console.log(`    pearson(score, mass) over the top half by score  `
  + `${pearson(top.map((r) => r.score), top.map((r) => r.mass)).toFixed(3)}   (n=${top.length})`);
console.log(`    fraction of the corpus scoring < 10% of the best  `
  + `${(100 * rows.filter((r) => r.score < 0.1 * sorted[0].score).length / rows.length).toFixed(0)}%`);

console.log(`\n    spined (run >= 4), n=${spined.length}:  score ${mean(spined, 'score').toFixed(4)}`
  + `  mass ${mean(spined, 'mass').toFixed(1)}  bodies ${mean(spined, 'bodies').toFixed(1)}`);
console.log(`    others,            n=${blobs.length}:  score ${mean(blobs, 'score').toFixed(4)}`
  + `  mass ${mean(blobs, 'mass').toFixed(1)}  bodies ${mean(blobs, 'bodies').toFixed(1)}`);
console.log('');
