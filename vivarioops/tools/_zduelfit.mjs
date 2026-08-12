// tools/_zduelfit.mjs — HOW LONG MUST A DUEL BE FOR A DUEL TO BE POSSIBLE?
//
// `_zduelchamp` measured 0 captures in 84 duels for both the champions and the
// random corpus, with the separation clamped in every one. This computes the
// quantity that decides it: the time a PAIR needs to close its own touching
// range at its own measured cruise.
//
//     required = reachSum / (cruiseA + cruiseB)
//
// `reachSum` is the floor on separation — below it the pair starts in contact and
// the duel measures the spawn rather than the creatures. So a window shorter than
// `required` cannot produce a capture by any amount of aiming.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { assessViability } from '../engine/l1/viability.js';
import { S1 } from '../engine/l2/probes.js';
import { netSpeed } from '../engine/l2/objective.js';
import W1_SLICE from '../worlds/w1_slice.js';
import { BRED } from '../worlds/w1_bred.js';
await RAPIER.init();

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
function measure(genome) {
  let plan; try { plan = morphogenesis(genome); } catch { return null; }
  if (!assessViability(RAPIER, genome, W1_SLICE, { plan }).ok) return null;
  const ns = netSpeed(RAPIER, { plan, genome, world: W1_SLICE });
  if (!ns.valid || !(ns.score > 1e-9)) return null;
  return { reach: S1(plan).reach, v: ns.score };
}
function report(pool, label) {
  const need = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      need.push((pool[i].reach + pool[j].reach) / (pool[i].v + pool[j].v));
    }
  }
  console.log(`\n  ${label} — ${pool.length} contenders, ${need.length} pairs`);
  console.log(`    cruise      p25 ${q(pool.map((p) => p.v), 0.25).toFixed(4)}`
    + `  median ${q(pool.map((p) => p.v), 0.5).toFixed(4)}  p75 ${q(pool.map((p) => p.v), 0.75).toFixed(4)} cm/s`);
  console.log(`    reach sum   median ${(2 * q(pool.map((p) => p.reach), 0.5)).toFixed(1)} cm`);
  console.log(`    SECONDS NEEDED to close touching range:`);
  console.log(`      p25 ${q(need, 0.25).toFixed(0)}   median ${q(need, 0.5).toFixed(0)}`
    + `   p75 ${q(need, 0.75).toFixed(0)}   p90 ${q(need, 0.9).toFixed(0)}`);
  for (const t of [15, 30, 60, 90, 120, 180]) {
    console.log(`      at ${String(t).padStart(3)} s: ${(100 * need.filter((x) => x <= t).length / need.length).toFixed(0)}% of pairs can meet`);
  }
  return need;
}
const champs = BRED.map((b) => measure(b.genome)).filter(Boolean);
const rand = [];
for (let i = 0; rand.length < 12 && i < 400; i++) {
  const m = measure(createRandomGenome(rngFrom('zduelfit', i)));
  if (m) rand.push(m);
}
console.log(`\n  _zduelfit — shipped duelDuration is ${W1_SLICE.duelDuration} s`);
report(rand, 'RANDOM CORPUS');
report(champs, 'CHAMPIONS');
console.log('');
