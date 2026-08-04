// tools/_zseg.mjs — SEGMENTED SWIMMERS: generate, breed, select.
//
// In one sentence: keep the Eel's BODY PLAN — one node connected to itself,
// repeated — and randomise everything else, then breed and select the best.
//
// WHY NOT CHANGE THE GENERATOR. The random draw cannot make a segmented animal:
// over 600 genomes, a run of 4+ identical segments occurred ZERO times, because
// SLICE_LIMITS caps recursion at 2. Lifting that cap turned four gate assertions
// red — real work, and not what was asked for. This gets segmented swimmers today
// without touching the engine.
//
// IS IT CHEATING? Less than the library is. What is fixed is the TOPOLOGY — "a
// segment, repeated" — which is one integer and one self-edge. Every dimension,
// joint type, angle limit, phase lag, frequency, amplitude, bias, taper and colour
// is drawn at random and then selected on. Authoring the alphabet, not the words.
import RAPIER from '@dimforge/rapier3d-compat';
import { writeFileSync } from 'node:fs';
import { rngFrom } from '../trunk/rng.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { breed } from '../engine/l1/breed.js';
import { assessViability } from '../engine/l1/viability.js';
import { authoredList } from '../worlds/atlas_seed.js';
import { binomial, signature } from '../engine/l1/naming.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { makeFood, mouthsOf, mouthPoints, forageStep, INGEST_RATE } from '../engine/l2/forage.js';
import { SLICE_LIMITS } from '../engine/l1/factory.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const SCALE = Number(process.argv[2] ?? 1);
const DRAWS = Math.round(240 * SCALE);
const GENS = Math.max(2, Math.round(18 * SCALE));
const POP = 10;

const EEL = authoredList().find((a) => a.commonName === 'Eel').genome;
const U = (r, lo, hi) => lo + r() * (hi - lo);
const I = (r, lo, hi) => Math.min(hi, lo + Math.floor(r() * (hi - lo + 1)));

/** The Eel's topology, every number redrawn. recursiveLimit is what makes a chain. */
function segmented(r) {
  const g = JSON.parse(JSON.stringify(EEL));
  const n = g.nodes[0];
  n.dims = [U(r, 0.25, 1.9), U(r, 0.25, 1.9), U(r, 0.25, 1.9)];
  n.recursiveLimit = I(r, 4, 6);
  n.joint = {
    type: r() < 0.5 ? 'revolute' : 'twist',
    angleLimits: [U(r, 0.1, 1.5), U(r, 0.1, 1.5), U(r, 0.1, 1.5)],
    phaseLag: U(r, -Math.PI, Math.PI),
  };
  n.colorGenes = { hueShift: U(r, -0.15, 0.15), valueShift: U(r, -0.3, 0.3), patternPhase: r() };
  const c = g.connections[0];
  c.position = [U(r, -1, 1), U(r, -1, 1)];
  c.orientation = [U(r, -0.8, 0.8), U(r, -0.8, 0.8), U(r, -0.8, 0.8)];
  c.scale = [U(r, 0.55, 1.9), U(r, 0.55, 1.9), U(r, 0.55, 1.9)];
  c.reflectX = r() < 0.3; c.reflectY = r() < 0.3; c.reflectZ = r() < 0.3;
  g.material = {
    hue: r(), hueVariance: U(r, 0, 0.3), patternScale: U(r, 3, 9),
    patternContrast: r(), stripeAnisotropy: r(), iridescence: r(),
  };
  g.controller.omega = U(r, 0.6, 6);
  for (const k of Object.keys(g.controller.jointGenes)) {
    g.controller.jointGenes[k] = {
      nodeId: k, amplitude: U(r, 0.1, 1), bias: U(r, -0.4, 0.4),
      freqMult: [0.5, 1, 2][I(r, 0, 2)],
    };
  }
  g.seed = Math.floor(r() * 4294967295);
  return g;
}

// Score: grams eaten, gated on going somewhere, bonus for holding a heading.
const PATH = 10, C0 = 0.012;
let last = null;
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function score(genome, seconds, k) {
  let plan;
  try { plan = morphogenesis(genome); } catch { return 0; }
  const mouths = mouthsOf(plan);
  if (!mouths.length) return 0;
  const buf = mouths.map(() => [0, 0, 0]);
  const ang = (k / 5) * Math.PI * 2, rr = W1_SLICE.tankBounds[0] / 4;
  const food = makeFood(W1_SLICE, { seed: 31337 + k * 7919 });
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, W1_SLICE, {
      bounded: false, wrap: true, effort: 1, turnBias: 0,
      origin: [Math.cos(ang) * rr, 0, Math.sin(ang) * rr],
    });
  } catch { return 0; }
  const steps = Math.round(seconds / FIXED_DT);
  const every = Math.max(1, Math.floor(steps / (PATH - 1)));
  const track = [];
  let eaten = 0;
  for (let st = 0; st < steps; st++) {
    try { sim.step(); } catch { break; }
    eaten += forageStep(sim, plan, food, mouths, FIXED_DT, INGEST_RATE, buf);
    if (st % every === 0) {
      const p = mouthPoints(sim, plan, mouths, buf)[0];
      if (p && Number.isFinite(p[0] + p[1] + p[2])) track.push([p[0], p[1], p[2]]);
    }
  }
  sim.free();
  if (track.length < 2 || !Number.isFinite(eaten)) { last = null; return 0; }
  let coarse = 0;
  for (let i = 1; i < track.length; i++) coarse += d3(track[i], track[i - 1]);
  const net = d3(track[track.length - 1], track[0]);
  const straight = coarse > 0 ? net / coarse : 0;
  const s = eaten * Math.min(1, coarse / (C0 * seconds)) * (0.5 + 0.5 * straight);
  last = { eaten, coarse, net, straight };
  return Number.isFinite(s) ? s : 0;
}
const slate = (gs, sec, ks) => gs.map((g) => ks.reduce((t, k) => t + score(g, sec, k), 0) / ks.length);
const runOf = (g) => { try { return signature(morphogenesis(g), g).longestRun; } catch { return 0; } };

const t0 = Date.now();
const say = (m) => console.log('  ' + ((Date.now() - t0) / 1000).toFixed(0).padStart(4) + 's  ' + m);

say('drawing ' + DRAWS + ' segmented candidates');
const rngObj = rngFrom('seg', 'draw');
const rng = () => rngObj.f32();
const cands = [];
for (let i = 0; i < DRAWS * 3 && cands.length < DRAWS; i++) {
  const g = segmented(rng);
  try { if (!assessViability(RAPIER, g, W1_SLICE).ok) continue; } catch { continue; }
  if (runOf(g) < 4) continue;
  cands.push(g);
}
say('  ' + cands.length + ' viable segmented candidates');

const s1 = slate(cands, 60, [0]);
const ranked = s1.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
let pop = ranked.slice(0, POP).map((x) => cands[x[1]]);
say('  best of draw ' + ranked[0][0].toFixed(2));

say('breeding ' + GENS + ' generations, pop ' + POP);
for (let gen = 0; gen < GENS; gen++) {
  const s = slate(pop, 90, [gen % 5]);
  const ord = s.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  if (gen % 6 === 0) say('  gen ' + gen + ' best ' + ord[0][0].toFixed(2));
  if (gen === GENS - 1) { pop = ord.map((x) => pop[x[1]]); break; }
  pop = breed({
    RAPIER, genomes: pop, selected: ord.slice(0, POP >> 1).map((x) => x[1]),
    rng: rngFrom('seg', 'breed', gen), world: W1_SLICE, limits: SLICE_LIMITS,
  }).genomes;
}

say('verdict, 900 s paired over 5 conditions');
// Only creatures that KEPT the spine are eligible — breeding dissolves chains, and
// shipping a blob under the name SEG would defeat the whole exercise.
const kept = pop.filter((g) => runOf(g) >= 4).slice(0, 3);
const finalists = kept.map((g, i) => ({ name: 'SEG ' + (i + 1), genome: g, seg: true }))
  .concat(['Eel', 'Darter', 'Flapper'].map((n) => ({
    name: n, genome: authoredList().find((a) => a.commonName === n).genome,
  })));
const fin = slate(finalists.map((x) => x.genome), 900, [0, 1, 2, 3, 4]);
finalists.forEach((x, i) => { x.score = fin[i]; });
finalists.sort((a, b) => b.score - a.score);

console.log('\n   rank  creature     score   eaten g  coarse   net  straight  bodies  segs  name');
console.log('  ' + '-'.repeat(96));
for (let i = 0; i < finalists.length; i++) {
  const x = finalists[i];
  const plan = morphogenesis(x.genome);
  score(x.genome, 900, 0);
  const a = last || { eaten: 0, coarse: 0, net: 0, straight: 0 };
  console.log('  ' + String(i + 1).padStart(5) + '  ' + x.name.padEnd(11)
    + x.score.toFixed(2).padStart(8) + a.eaten.toFixed(2).padStart(10)
    + a.coarse.toFixed(1).padStart(8) + a.net.toFixed(1).padStart(6)
    + a.straight.toFixed(2).padStart(10) + String(plan.bodyCount).padStart(8)
    + String(runOf(x.genome)).padStart(6)
    + '  ' + (x.seg ? binomial(plan, x.genome).binomial : ''));
}
writeFileSync(new URL('./_zseg_out.json', import.meta.url), JSON.stringify(
  finalists.filter((x) => x.seg).map((x, i) => ({
    i, binomial: binomial(morphogenesis(x.genome), x.genome).binomial,
    mass: totalMass(morphogenesis(x.genome)), score: x.score, genome: x.genome,
  }))));
console.log('\n  ' + ((Date.now() - t0) / 1000).toFixed(0) + 's wall -> tools/_zseg_out.json\n');
