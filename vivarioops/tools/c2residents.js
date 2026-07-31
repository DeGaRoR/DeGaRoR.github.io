// tools/c2residents.js — choose and freeze W1's three residents.
//
// 30 §5 C2: "Three frozen residents, bred in the tank during this session and
// hard-coded for now."
//
// They are chosen by MEASURED capability, not at random and not by eye. Three
// residents that all swim alike make a matchup matrix that says nothing, so the
// selection maximises spread across the axes C1 can actually measure: cruise
// speed, mass and turn rate. Run with `node tools/c2residents.js > out.js`.

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { genomeHash, serialise } from '../engine/l1/genome.js';
import { assessViability } from '../engine/l1/viability.js';
import { compileSolo } from '../engine/l2/compile.js';
import { worldHash } from '../contracts/world.js';
import { W1_SLICE, W1_RESIDENT_HASHES_PLACEHOLDER } from '../worlds/w1_slice.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { UNSTABLE_SPEED, runDuel } from '../engine/l2/duel.js';

await RAPIER.init();
const WH = worldHash(W1_SLICE, W1_RESIDENT_HASHES_PLACEHOLDER);
const CANDIDATES = Number(process.argv[2] ?? 40);

const compiled = [];
for (let i = 0; compiled.length < CANDIDATES && i < 600; i++) {
  const genome = createRandomGenome(rngFrom('w1', 'resident', i));
  const plan = morphogenesis(genome);
  if (!assessViability(RAPIER, genome, W1_SLICE, { plan }).ok) continue;
  const r = compileSolo(RAPIER, { genome, world: W1_SLICE, worldHash: WH, plan, provenance: 'shipped', checkViability: false });
  if (!r.valid) continue;
  compiled.push({ i, genome, plan, sp: r.species });
}

process.stderr.write(`compiled ${compiled.length} candidates\n`);

// ── a resident must be able to FINISH A FIGHT, against SOMEONE ELSE ─────────
//
// runDuel aborts as `unstable` the moment any body exceeds UNSTABLE_SPEED and
// returns zero work and no outcome. Selecting for spread picks the FASTEST
// candidate, which is exactly the one that trips it — and the failure is an
// INTERACTION in the shared arena, a collision, so a solo run cannot see it
// (tested: a solo overspeed filter dropped nothing while a third of the duels
// still aborted). Nor is it enough to rank triples and walk down: the offending
// candidate has the highest spread, so it appears in every high-ranking triple
// and the top forty all failed on the same pairing.
//
// So the test is per CANDIDATE, against a few opponents drawn across the speed
// range. O(n*k) instead of O(n^3), and it removes the cause rather than
// searching around it.
{
  const before = compiled.length;
  const byCruise = [...compiled].sort((a, b) => a.sp.cruiseSpeed - b.sp.cruiseSpeed);
  // REFEREES COME FROM THE QUARTILES, NEVER THE EXTREMES. Using the fastest
  // candidate as a referee dropped 38 of 40 — it destabilises everyone it meets,
  // so it convicted the whole field instead of itself. A typical opponent is the
  // fair test, and the pathological candidate then fails against all three.
  const q = (f) => byCruise[Math.min(byCruise.length - 1, Math.floor(byCruise.length * f))];
  const refs = [q(0.25), q(0.5), q(0.75)];
  const asDuellist = (c) => ({ genome: c.genome, plan: c.plan, hash: genomeHash(c.genome), reach: c.sp.reach });
  for (let k = compiled.length - 1; k >= 0; k--) {
    let bad = false;
    for (const ref of refs) {
      if (ref === compiled[k]) continue;
      for (let r = 0; r < W1_SLICE.duelRepeats && !bad; r++) {
        const res = runDuel(RAPIER, { a: asDuellist(compiled[k]), b: asDuellist(ref), world: W1_SLICE, worldHash: WH, repeat: r });
        if (!res.valid) bad = true;
      }
      if (bad) break;
    }
    if (bad) compiled.splice(k, 1);
  }
  process.stderr.write(`duel-stable filter: dropped ${before - compiled.length}, ${compiled.length} remain\n`);
}


// ── liveness floor, RELATIVE to the candidate set ───────────────────────────
//
// Maximising spread selects EXTREMES, and under the amended §A8 the extremes
// include corpses: the first run of this tool after the per-face law picked a
// creature cruising at 0.087 m/s alongside one at 25.9, and the duel gate went
// red because neither of the pair did any mechanical work. A matchup matrix
// between two creatures that cannot move says exactly as little as one between
// three that swim alike — the failure this tool already existed to prevent,
// arriving from the opposite end.
//
// The floor is a FRACTION OF THE CANDIDATE MEDIAN, not an absolute speed, so it
// carries no tuned constant across a physics change and it will still mean
// something when the lift term lands and every speed moves.
{
  const speeds = compiled.map(c => c.sp.cruiseSpeed).sort((a, b) => a - b);
  const medSpeed = speeds[Math.floor(speeds.length / 2)];
  const floor = 0.1 * medSpeed;
  const before = compiled.length;
  for (let k = compiled.length - 1; k >= 0; k--) {
    if (compiled[k].sp.cruiseSpeed < floor) compiled.splice(k, 1);
  }
  process.stderr.write(`liveness floor ${floor.toFixed(4)} m/s (0.1 x median ${medSpeed.toFixed(4)}): `
    + `dropped ${before - compiled.length}, ${compiled.length} remain\n`);
}

// Normalise each axis over the candidate set, then take the triple with the
// greatest minimum pairwise distance — the three most unlike each other.
const AXES = ['cruiseSpeed', 'massBase', 'turnRate', 'torsoExposure'];
const lo = {}, hi = {};
for (const a of AXES) {
  const vs = compiled.map(c => c.sp[a]);
  lo[a] = Math.min(...vs); hi[a] = Math.max(...vs);
}
const vec = (c) => AXES.map(a => (hi[a] - lo[a] > 1e-12 ? (c.sp[a] - lo[a]) / (hi[a] - lo[a]) : 0));
const d = (p, q) => Math.hypot(...p.map((x, k) => x - q[k]));

// Rank EVERY triple by spread, then walk down until one whose three duels can
// actually be fought. Picking the single best triple is what shipped a pair
// that aborted as `unstable`: the fastest candidate maximises spread and is
// also the likeliest to trip UNSTABLE_SPEED, and the failure is an INTERACTION
// in the shared arena — a collision — so no solo test can see it. The duels
// themselves are the only honest filter, and they are cheap enough at this size.
const triples = [];
for (let a = 0; a < compiled.length; a++) {
  for (let b = a + 1; b < compiled.length; b++) {
    for (let c = b + 1; c < compiled.length; c++) {
      const [va, vb, vc] = [vec(compiled[a]), vec(compiled[b]), vec(compiled[c])];
      triples.push({ score: Math.min(d(va, vb), d(vb, vc), d(va, vc)), pick: [compiled[a], compiled[b], compiled[c]] });
    }
  }
}
triples.sort((x, y) => y.score - x.score);

const withReach = (c) => ({ genome: c.genome, plan: c.plan, hash: genomeHash(c.genome), reach: c.sp.reach });
let best = null;
const MAX_TRIES = 40;
for (let tI = 0; tI < Math.min(MAX_TRIES, triples.length); tI++) {
  const cand = triples[tI].pick.map(withReach);
  let ok = true;
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    for (let r = 0; r < W1_SLICE.duelRepeats && ok; r++) {
      const res = runDuel(RAPIER, { a: cand[i], b: cand[j], world: W1_SLICE, worldHash: WH, repeat: r });
      if (!res.valid) { ok = false; process.stderr.write(`  triple ${tI}: ${i}v${j} r${r} ${res.reason}\n`); }
    }
    if (!ok) break;
  }
  if (ok) { best = triples[tI]; process.stderr.write(`accepted triple ${tI} of ${triples.length}\n`); break; }
}
if (!best) throw new Error(`no triple among the top ${MAX_TRIES} could fight all three duels`);

const chosen = best.pick;
process.stderr.write(`spread score ${best.score.toFixed(3)}\n`);
for (const c of chosen) {
  process.stderr.write(`  seed ${c.i}  ${c.sp.name}  cruise ${c.sp.cruiseSpeed.toFixed(3)} mass ${c.sp.massBase.toFixed(2)} turn ${c.sp.turnRate.toFixed(4)} bodies ${c.sp.bodyCount}\n`);
}

// ── emit ────────────────────────────────────────────────────────────────────
const ids = ['res_a', 'res_b', 'res_c'];
const lines = [];
lines.push(`// worlds/w1_residents.js — W1's three frozen residents. GENERATED at C2 by`);
lines.push(`// tools/c2residents.js; do not hand-edit. Regenerating changes every genome`);
lines.push(`// hash, which changes worldHash, which invalidates every compiled record —`);
lines.push(`// so \`faunaVersion\` in w1_slice.js must be bumped in the same commit.`);
lines.push(`//`);
lines.push(`// 30 §5 C2: "Three frozen residents, bred in the tank during this session and`);
lines.push(`// hard-coded for now." Chosen for MEASURED spread across cruise speed, mass,`);
lines.push(`// turn rate and torso exposure over ${compiled.length} viable candidates, not at random:`);
lines.push(`// three residents that all swim alike produce a matchup matrix that says`);
lines.push(`// nothing. Minimum pairwise distance in normalised capability space: ${best.score.toFixed(3)}.`);
lines.push(``);
lines.push(`export const W1_RESIDENT_GENOMES = {`);
chosen.forEach((c, k) => {
  lines.push(`  // ${ids[k]} — ${c.sp.name}: ${c.sp.bodyCount} bodies, ${c.sp.massBase.toFixed(2)} kg,`);
  lines.push(`  // cruise ${c.sp.cruiseSpeed.toFixed(3)} m/s, turn ${c.sp.turnRate.toFixed(4)} rad/s, reach ${c.sp.reach.toFixed(2)} m`);
  lines.push(`  ${ids[k]}: ${serialise(c.genome)},`);
});
lines.push(`};`);
lines.push(``);
lines.push(`/** Ordered exactly as W1_SLICE.residents. Order IS the fauna id (03 §3). */`);
lines.push(`export const W1_RESIDENT_IDS = ${JSON.stringify(ids)};`);
lines.push(``);
lines.push(`/** Genome hashes, precomputed so worldHash() needs no morphogenesis. */`);
lines.push(`export const W1_RESIDENT_HASHES = ${JSON.stringify(chosen.map(c => genomeHash(c.genome)), null, 2)};`);
lines.push(``);
lines.push(`export default W1_RESIDENT_GENOMES;`);

console.log(lines.join('\n'));
