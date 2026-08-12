// tools/_zeel.mjs — CAN AN EEL HAPPEN BY ITSELF, AND WHAT IS MISSING IF NOT?
//
//     node tools/_zeel.mjs [draws] [seconds]
//
// ── THE QUESTION, SPLIT INTO THE TWO THINGS AN EEL IS ────────────────────────
//
// An eel is a CHAIN and a WAVE. They are drawn by different parts of the
// generator and they fail for different reasons, so they have to be measured
// apart before anything is concluded about either.
//
//   THE CHAIN is a self-connection on the axial face with a recursiveLimit worth
//   repeating. `tools/_zspine.mjs` already measures it: 12.3% of draws reach a
//   run of 4, 2.7% reach 6, and 27% of those are viable — so about one draw in
//   thirty is a viable four-segment chain. That question is answered and this
//   tool does not re-ask it.
//
//   THE WAVE is the phase advancing down that chain. `computePhases` accumulates
//   `phase[j] = phase[parent] + parent.phaseLag`, and on a spine every segment
//   is the SAME NODE — so every segment carries the same `phaseLag` and the
//   accumulated phase is exactly linear in depth. A drawn chain therefore has a
//   travelling wave BY CONSTRUCTION, with wavenumber `phaseLag` rad/segment.
//
// ── AND HERE IS THE GAP THIS TOOL EXISTS TO MEASURE ─────────────────────────
//
//   the factory draws   phaseLag ~ U(RANGE.phaseDeviation) = [-0.32, 0.32]
//   mutation may reach  phaseLag in RANGE.phaseLag         = [-PI, PI]
//   the authored eel is phaseLag = PI/2                    = 1.5708
//
// The draw can reach a fifth of the eel's wavenumber and no more. Over a
// six-segment chain that is 1.6 rad of total phase against the eel's 7.9 — the
// drawn animal is very nearly in UNISON, and unison is the thrust-cancelling
// case this project has recorded from the beginning.
//
// So the hypothesis is sharp, and it is falsifiable: THE GENERATOR CAN DRAW THE
// BODY BUT NOT THE GAIT, and what is missing is one scalar that mutation can
// reach. If sweeping `phaseLag` on an otherwise untouched drawn chain buys
// speed, an eel is a breeding target rather than a drawing target, and the
// "embryo" is already in every prospecting pool. If it buys nothing, the chain
// is not the thing to breed for and this closes the question the other way.
//
// ── A VOID PRIOR, AND IT IS WHY THIS IS WORTH RE-RUNNING ────────────────────
//
// HANDOFF.md records "more segments should undulate better — was tested and is
// false. More parts and longer chains swim LESS." That measurement predates two
// changes that invalidate it: Phase A1 (physics.js never called `resetForces`,
// so the fluid force at step n was the sum of every force since spawn — "every
// trajectory number older than this commit is invalid") and Phase A3 (the
// positional phase gradient did not exist). It is not evidence any more, in
// either direction.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { cloneGenome, mutate } from '../engine/l1/mutate.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { signature } from '../engine/l1/naming.js';
import { assessViability } from '../engine/l1/viability.js';
import { RANGE } from '../engine/l1/genome.js';
import { netSpeed } from '../engine/l2/objective.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();

const DRAWS = Number(process.argv[2] ?? 400);
const SECONDS = Number(process.argv[3] ?? 20);
/** A "spine" is a run of this many identical segments — `_zspine`'s own threshold. */
const SPINE = 4;
/** The wavenumbers swept, rad per segment. PI/2 is the authored eel's. */
const LAGS = [0, 0.16, 0.32, 0.6, 1.0, Math.PI / 2, 2.2, Math.PI];

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const fmt = (n, d = 4) => (Number.isFinite(n) ? n.toFixed(d) : '—');

const runOf = (g) => { try { return signature(morphogenesis(g), g).longestRun; } catch { return 0; } };

/** The self-connection that forms the chain, if there is one on the axial face. */
const spineEdge = (g) => g.connections.find((c) => c.parentNodeId === c.childNodeId && c.parentFace === 5) ?? null;

/** Cruise speed, cm/s. `netSpeed` is net displacement over a 6 s torus window. */
function speedOf(g) {
  let plan;
  try { plan = morphogenesis(g); } catch { return null; }
  if (plan.jointCount < 1) return null;
  try {
    const r = netSpeed(RAPIER, { plan, genome: g, world: W1_SLICE, seconds: SECONDS });
    return r.valid ? r.score : null;
  } catch { return null; }
}

// ── 1. what the draw actually puts in the chain ──────────────────────────────
console.log(`\n  _zeel — the chain is drawable; is the WAVE?   ${DRAWS} draws, ${SECONDS}s trials\n`);
console.log(`  factory draws phaseLag ~ U[${RANGE.phaseDeviation[0]}, ${RANGE.phaseDeviation[1]}]`
  + `   mutation may reach [${(-Math.PI).toFixed(3)}, ${Math.PI.toFixed(3)}]   the eel is ${(Math.PI / 2).toFixed(4)}`);

const spines = [];
let drawn = 0;
for (let i = 0; i < DRAWS; i++) {
  const g = createRandomGenome(rngFrom('zeel', 'draw', i));
  drawn++;
  const run = runOf(g);
  if (run < SPINE) continue;
  const e = spineEdge(g);
  if (!e) continue;
  const node = g.nodes.find((n) => n.id === e.parentNodeId);
  if (!node) continue;
  spines.push({ g, run, node, lag: node.joint.phaseLag, viable: assessViability(RAPIER, g, W1_SLICE).ok });
}
const viable = spines.filter((s) => s.viable);
console.log(`\n  DRAWN CHAINS  ${spines.length}/${drawn} runs >= ${SPINE} on the axial face`
  + `   ${viable.length} of them viable`);
console.log(`    run          median ${med(spines.map((s) => s.run))}   max ${Math.max(0, ...spines.map((s) => s.run))}`);
console.log(`    |phaseLag|   median ${fmt(med(spines.map((s) => Math.abs(s.lag))), 3)} rad/segment`
  + `   max ${fmt(Math.max(0, ...spines.map((s) => Math.abs(s.lag))), 3)}`);
console.log(`    total phase across the chain, median`
  + ` ${fmt(med(spines.map((s) => Math.abs(s.lag) * (s.run - 1))), 3)} rad`
  + `   (the eel's six-segment chain is ${fmt((Math.PI / 2) * 5, 2)} rad)`);
console.log(`    chains whose |phaseLag| already exceeds 1.0 rad: `
  + `${spines.filter((s) => Math.abs(s.lag) > 1).length}   <- the draw cannot produce these`);

if (!viable.length) { console.log('\n  no viable drawn chain in this sample — widen `draws`.\n'); process.exit(0); }

// ── 2. THE SWEEP. One scalar, everything else untouched. ─────────────────────
//
// The chain is the animal the draw produced; only `phaseLag` on the repeating
// node moves. Every other gene, the geometry and the viability verdict are
// identical across a row, so the row is a controlled experiment on wavenumber
// and nothing else.
const SUBJECTS = Math.min(10, viable.length);
console.log(`\n  PHASE SWEEP on ${SUBJECTS} drawn chains — only the repeating node's phaseLag moves\n`);
console.log('  chain  run  drawn lag |' + LAGS.map((l) => fmt(l, 2).padStart(8)).join('') + '  |   best');

const rows = [];
for (let k = 0; k < SUBJECTS; k++) {
  const s = viable[k];
  const speeds = [];
  for (const lag of LAGS) {
    const g = cloneGenome(s.g);
    const n = g.nodes.find((x) => x.id === s.node.id);
    n.joint.phaseLag = lag;
    speeds.push(speedOf(g));
  }
  const ok = speeds.map((v) => (v == null ? -Infinity : v));
  const bi = ok.indexOf(Math.max(...ok));
  rows.push({ run: s.run, lag: s.lag, speeds, bestLag: LAGS[bi], bestSpeed: ok[bi], drawnSpeed: speedOf(s.g) });
  console.log(`  ${String(k).padStart(5)} ${String(s.run).padStart(4)} ${fmt(s.lag, 3).padStart(10)} |`
    + speeds.map((v) => (v == null ? '     — ' : fmt(v, 4)).padStart(8)).join('')
    + `  |  ${fmt(LAGS[bi], 2).padStart(5)}`);
}

// ── 3. the verdict ───────────────────────────────────────────────────────────
const colMean = LAGS.map((_, i) => mean(rows.map((r) => r.speeds[i]).filter((v) => v != null)));
console.log('\n  mean cruise cm/s by wavenumber');
console.log('    ' + LAGS.map((l) => fmt(l, 2).padStart(8)).join(''));
console.log('    ' + colMean.map((v) => fmt(v, 4).padStart(8)).join(''));

const drawable = LAGS.filter((l) => l <= Math.abs(RANGE.phaseDeviation[1]));
const bestDrawable = Math.max(...colMean.filter((_, i) => LAGS[i] <= Math.abs(RANGE.phaseDeviation[1])));
const bestAny = Math.max(...colMean);
const bestAnyLag = LAGS[colMean.indexOf(bestAny)];
console.log(`\n  best mean INSIDE the draw's reach (lag <= ${RANGE.phaseDeviation[1]}):  ${fmt(bestDrawable)} cm/s`);
console.log(`  best mean ANYWHERE (lag = ${fmt(bestAnyLag, 3)}):                ${fmt(bestAny)} cm/s`);
console.log(`  the gap mutation would have to close:                    ${fmt(bestAny / Math.max(1e-9, bestDrawable), 2)}x`);
console.log(`  chains whose own best lag is OUTSIDE the draw:           `
  + `${rows.filter((r) => Math.abs(r.bestLag) > Math.abs(RANGE.phaseDeviation[1])).length}/${rows.length}`);

// ── 4. REACHABILITY — how many mutations to walk the wavenumber up? ──────────
//
// The `preyGain2` trap, asked in advance instead of after a null result: a gene
// that selection cannot move in the length of a run is not a breeding target
// however much it is worth. Counted over real `mutate` calls, so the operator
// mix and the per-branch draw rate are the shipped ones rather than assumed.
const TARGET = 1.0;
const TRIALS = 60, CAP = 400;
let hits = 0; const steps = [];
for (let t = 0; t < TRIALS; t++) {
  const s = viable[t % viable.length];
  let g = cloneGenome(s.g);
  for (let m = 1; m <= CAP; m++) {
    try { g = mutate(g, rngFrom('zeel', 'walk', t, m)).genome; } catch { break; }
    const n = g.nodes.find((x) => x.id === s.node.id);
    if (!n) break;                            // the node was deleted — lineage over
    if (Math.abs(n.joint.phaseLag) >= TARGET) { hits++; steps.push(m); break; }
  }
}
console.log(`\n  REACHABILITY — mutations needed to walk |phaseLag| to ${TARGET} rad`);
console.log(`    reached in ${hits}/${TRIALS} walks (cap ${CAP} mutations)`
  + `   median ${steps.length ? med(steps) : '—'} mutations`);
console.log(`    at breed()'s 1-3 mutations per offspring that is about`
  + ` ${steps.length ? Math.round(med(steps) / 2) : '—'} generations of a single lineage.`);
console.log('');
