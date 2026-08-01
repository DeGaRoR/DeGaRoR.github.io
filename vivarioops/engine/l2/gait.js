// engine/l2/gait.js — THE GAIT INNER LOOP (B3 C3).
//
// PURITY (01 §4, N1-N3): no clock, no Math.random, no DOM, no imports from
// /trunk/, /ui/, /render/. Rapier and the rng arrive injected.
//
// NOT A PROBE, like objective.js and for the same reason: what a body is judged
// ON is selection, not identity, so it carries no BRIDGE_V obligation.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
//
// Measured (RECONCILIATION §3, and the review's own experiment): searching the
// GAIT on the shipped actuator buys almost nothing — 1.6x — because the plant
// randomises whatever gait you find. After C1 normalised the actuator the SAME
// nineteen evaluations are worth 4.5x, and the rule that did it is one line:
//
//   A BODY IS JUDGED BY ITS ADAPTED GAIT, NEVER ITS BIRTH GAIT.
//
// A random morphology is almost never handed a controller that makes it swim, so
// scoring it at birth measures the draw, not the body. Freeze the morphology,
// hill-climb the controller a few steps, and 0/12 random creatures above 0.02
// body-lengths/second becomes 7/12. That is the inner loop. The outer loop —
// mutating morphology and inheriting the controller by homology — is autoBurst,
// which calls this through `adaptFn`.

import { cloneGenome, jitter } from '../l1/mutate.js';
import { RANGE, FREQ_MULTS } from '../l1/genome.js';
import { scorePopulation, TRIAL_SECONDS } from './objective.js';

/** Inner-loop defaults: (1+8) x 3 = 25 evaluations, inside the plan's 32x4 cap. */
export const GAIT_CANDIDATES = 8;
export const GAIT_ITERATIONS = 3;

/**
 * ONE gait mutation, on a private clone. Touches ONLY controller genes — omega,
 * a joint's amplitude / bias / freqMult, or a node's phaseLag — so the morphology
 * is frozen: morphogenesis re-derives the SAME body, and the search moves through
 * gait space alone. Exactly one gene changes per call, like mutate() (A9), so a
 * hill-climb step is legible.
 */
export function perturbGait(genome, rng) {
  const g = cloneGenome(genome);
  const ops = [];

  ops.push(() => { g.controller.omega = jitter(rng, g.controller.omega, RANGE.omega); });

  const jointKeys = Object.keys(g.controller.jointGenes);
  if (jointKeys.length) {
    const jg = g.controller.jointGenes[jointKeys[rng.int(jointKeys.length)]];
    ops.push(() => { jg.amplitude = jitter(rng, jg.amplitude, RANGE.amplitude); });
    ops.push(() => { jg.bias = jitter(rng, jg.bias, RANGE.bias); });
    ops.push(() => {
      // freqMult is categorical — resample to a DIFFERENT value in FREQ_MULTS.
      const others = FREQ_MULTS.filter(x => x !== jg.freqMult);
      if (others.length) jg.freqMult = others[rng.int(others.length)];
    });
  }

  const jointed = g.nodes.filter(n => n.joint && Number.isFinite(n.joint.phaseLag));
  if (jointed.length) {
    const n = jointed[rng.int(jointed.length)];
    ops.push(() => { n.joint.phaseLag = jitter(rng, n.joint.phaseLag, RANGE.phaseLag); });
  }

  ops[rng.int(ops.length)]();
  return g;
}

/**
 * (1+lambda) HILL CLIMB over the gait, morphology frozen. Returns the best-adapted
 * genome and its net-speed score on the torus.
 *
 * A dumb hill climb is deliberate: the review proved the MECHANISM with (1+6)x3,
 * and a heavier optimiser has to beat that to earn its cost (C3.4). Each iteration
 * draws `candidates` perturbations of the current best and keeps any that beats
 * it — so the score is monotone non-decreasing, and a body can only be helped by
 * being adapted, never harmed.
 *
 * @returns {{ genome, score, evals }}
 */
export function adaptGait(RAPIER, {
  genome, world, rng,
  candidates = GAIT_CANDIDATES,
  iterations = GAIT_ITERATIONS,
  seconds = TRIAL_SECONDS,
  simOpts = {},
}) {
  let best = genome;
  let bestScore = scorePopulation(RAPIER, [genome], world, seconds, simOpts)[0];
  let evals = 1;

  for (let it = 0; it < iterations; it++) {
    const cands = [];
    for (let c = 0; c < candidates; c++) cands.push(perturbGait(best, rng.fork(`gait:${it}:${c}`)));
    const scores = scorePopulation(RAPIER, cands, world, seconds, simOpts);
    evals += cands.length;
    for (let c = 0; c < cands.length; c++) {
      if (scores[c] > bestScore) { bestScore = scores[c]; best = cands[c]; }
    }
  }

  return { genome: best, score: bestScore, evals };
}

/**
 * Adapt a whole population, Lamarckian: each body keeps the controller it learned.
 * Signature matches what autoBurst's `adaptFn` expects — it replaces the burst's
 * birth-gait scoring so selection AND breeding carry the adapted controller.
 *
 * @returns {{ genomes, scores, evals }}
 */
export function adaptPopulation(RAPIER, genomes, world, {
  rng, candidates = GAIT_CANDIDATES, iterations = GAIT_ITERATIONS, seconds = TRIAL_SECONDS, simOpts = {},
}) {
  const out = genomes.map((genome, i) =>
    adaptGait(RAPIER, { genome, world, rng: rng.fork(`body:${i}`), candidates, iterations, seconds, simOpts }));
  return {
    genomes: out.map(o => o.genome),
    scores: out.map(o => o.score),
    evals: out.reduce((a, o) => a + o.evals, 0),
  };
}
