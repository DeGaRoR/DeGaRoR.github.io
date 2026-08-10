// tools/_zbeacon.mjs — THE TANK, HEADLESS. Does the cast go to the dot?
//
//     node tools/_zbeacon.mjs [seconds] [distance cm]
//
// ── WHY THIS IS NOT `_zgoal` ─────────────────────────────────────────────────
//
// `_zgoal` scores ONE creature alone, in ITS OWN steering plane, in a trial built
// to rank bodies against each other. This is the SCREEN: the cast the player
// actually sees, all in one tank, with the beacon dropped where the player would
// drop it — at placements chosen in WORLD coordinates, spanning the sphere, with
// no regard for which plane any individual can bend in.
//
// That difference is the whole point of running both. A creature that scores well
// in `_zgoal` has been asked a question suited to its mechanism; the same creature
// in here is asked the player's question. If the two disagree, the screen is
// right and the scorer is flattering.
//
// The drive loop is COPIED FROM `ui/screens/vivarium.js` line for line —
// `bearingTo(sim, beacon, plane)` then `sensorTurnBias(genome, b, b)` — for the
// same reason that screen imports its two functions from the engine instead of
// reimplementing them: a demo that drifts from the experiment is worse than no
// demo. If this file and that loop ever disagree, this file is the bug.
//
// Writes nothing.
import RAPIER from '@dimforge/rapier3d-compat';
import { assessViability } from '../engine/l1/viability.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { sensorTurnBias } from '../engine/l1/controller.js';
import { S3, S3_BIAS, SOLO_GRAVITY } from '../engine/l2/probes.js';
import { bearingTo } from '../engine/l2/duel.js';
import { netSpeed } from '../engine/l2/objective.js';
import { GOAL_CAPTURE } from './_zgoal.mjs';
import { SEEDS } from '../worlds/seeds.js';
import { CURATED } from '../worlds/w1_curated.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();

const SECONDS = Number(process.argv[2] ?? 120);
const DIST = Number(process.argv[3] ?? 8);
const SETTLE = 2.0;

/**
 * PLACEMENTS IN WORLD COORDINATES, spanning the sphere. Deliberately NOT built
 * from any creature's steering plane: this is the honest geometry and `_zgoal`
 * is the generous one.
 *
 * ── WHY THIS IS A FIBONACCI SPIRAL AND NOT THE SIX FACE DIRECTIONS ───────────
 *
 * It was `[±1,0,0], [0,1,0], [0,0,1], [0,-0.7,-0.7]` — the axis directions,
 * which look like the neutral choice and are not. The whole eel family steers in
 * its local YZ plane, so its plane normal is ±X, and a target sitting ON the
 * normal projects to nothing inside the plane: `bearingTo` returns ~0 and the
 * creature is issued no turn command at all. Both ±X placements came back at
 * exactly 8.00 — zero closure — FOR EVERY CREATURE IN THE CAST, references and
 * selected alike.
 *
 * That is a real failure mode and it is worth knowing about. It is not worth 40%
 * of the test. A singular direction is a measure-zero set on the sphere; a
 * player's tap lands on it about never, and axis-aligned test points land on it
 * constantly because bodies are built on axes too. Weighting it 2-in-5 measured
 * the coordinate system.
 *
 * A Fibonacci spiral gives directions that are near-uniform on the sphere and
 * generic — no exact alignment with any body axis — which is the geometry a tap
 * actually samples. The singular case is kept as ONE explicit placement at the
 * end rather than removed, so the failure mode stays visible and stays honest.
 */
const PLACEMENTS = (() => {
  const N = 7, out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    out.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  out.push([1, 0, 0]);   // the singular direction, kept on purpose. See above.
  return out;
})();

/**
 * The tank cast. Six creatures: the two reference eels the Vivarium opens with,
 * the two curated specimens, and the two SELECTED ones. Mixed deliberately — a
 * beacon demo in which every creature arrives would be as dishonest as one in
 * which none does, and the split is the finding.
 */
const CAST = [
  // references — the two authored swimmers that carry the library's own gains
  'eel', 'eel-unison', 'snarlback-teal',
  // selected on a SCALED target, from random founders. Aim well, cannot travel.
  'oddfoot-glossy', 'spokebeast-banded',
  // selected on an ABSOLUTE 8 cm target, from authored founders.
  'stumbler-striped', 'stumbler-second',
];

const norm = (v) => { const m = Math.hypot(v[0], v[1], v[2]); return m > 1e-12 ? [v[0] / m, v[1] / m, v[2] / m] : [0, 0, 1]; };

/**
 * One creature, one placement. `blind` runs the identical geometry with the
 * beacon off — the same control subtraction `_zgoal` uses, and for the same
 * reason: a wanderer in a bounded tank hits an 8 cm target by accident often
 * enough to outrank a creature that homes.
 */
function run(plan, genome, plane, dir, blind) {
  const sim = createSimulation(RAPIER, plan, genome,
    { ...W1_SLICE, gravity: SOLO_GRAVITY },
    { bounded: true, wrap: false, effort: 0, turnBias: 0 });
  for (let i = 0; i < Math.round(SETTLE / FIXED_DT); i++) sim.step();
  sim.resetClock();
  sim.control.effort = 1;

  const c0 = sim.centreOfMass();
  const d = norm(dir);
  const beacon = [c0[0] + DIST * d[0], c0[1] + DIST * d[1], c0[2] + DIST * d[2]];

  let dmin = DIST;
  for (let s = 0; s < Math.round(SECONDS / FIXED_DT); s++) {
    if (!blind) {
      // ── the vivarium.js loop, verbatim ──
      const b = bearingTo(sim, beacon, plane);
      sim.control.turnBias = sensorTurnBias(sim.genome, b, b);
    }
    sim.step();
    if ((s & 7) === 0) {
      const c = sim.centreOfMass();
      const dd = Math.hypot(beacon[0] - c[0], beacon[1] - c[1], beacon[2] - c[2]);
      if (dd < dmin) dmin = dd;
    }
  }
  const burst = sim.integrity().spread > 3;
  sim.free();
  return burst ? null : dmin;
}

console.log(`_zbeacon — the tank cast, beacon ${DIST} cm away, ${SECONDS} s, ${PLACEMENTS.length} world-space placements`);
console.log(`arrival = within ${GOAL_CAPTURE} cm.  Beacon-off control run on identical geometry.\n`);
console.log('creature            | ' + PLACEMENTS.map((_, i) => `p${i}`.padStart(6)).join('')
  + '  | arrive  closure   v cm/s   reach');

const library = [...SEEDS, ...CURATED];
let cells = 0, arrived = 0, closSum = 0, scoredCreatures = 0;
for (const id of CAST) {
  const e = library.find((x) => x.id === id);
  if (!e) { console.log(`${id.padEnd(20)}| not in the library`); continue; }
  const v = assessViability(RAPIER, e.genome, W1_SLICE);
  if (!v.ok) { console.log(`${id.padEnd(20)}| inviable`); continue; }
  const ns = netSpeed(RAPIER, { plan: v.plan, genome: e.genome, world: W1_SLICE });
  // The plane the SCREEN uses: `measureTurnPlanes()` calls S3 and caches
  // turnPlaneXYZ. Pinned to the single bias point for the reason in
  // probes.js — the plane has always been measured there and `_zgoal`'s
  // baseline, the selection runs and this all have to be one experiment.
  const s3 = S3(RAPIER, { plan: v.plan, genome: e.genome, world: W1_SLICE, cruiseSpeed: ns.score, biases: [S3_BIAS] });
  const plane = [s3.turnPlaneX, s3.turnPlaneY, s3.turnPlaneZ];

  const out = [];
  let hits = 0, clos = 0, n = 0;
  for (const dir of PLACEMENTS) {
    const live = run(v.plan, e.genome, plane, dir, false);
    const dead = run(v.plan, e.genome, plane, dir, true);
    if (live === null || dead === null) { out.push('  burst'); continue; }
    out.push(live.toFixed(2).padStart(6));
    if (live < GOAL_CAPTURE) hits++;
    clos += ((DIST - live) - (DIST - dead)) / DIST;
    n++; cells++; if (live < GOAL_CAPTURE) arrived++;
  }
  // PER CELL, not per creature. `clos` is a sum over this creature's placements,
  // so the running total has to take the mean here or the summary comes out
  // multiplied by the placement count — which it did, reporting 1.004 for a
  // quantity bounded at 1.0, and a closure above 1.0 is arithmetically impossible.
  closSum += n ? clos / n : 0;
  scoredCreatures += n ? 1 : 0;
  // Reach, printed because it is the thing the tank result turns on: a creature
  // cannot arrive at a mark further away than it can swim, however well it aims.
  console.log(`${id.padEnd(20)}| ${out.join('')}  | ${hits}/${n}    ${(n ? clos / n : 0).toFixed(3).padStart(6)}`
    + `   ${ns.score.toFixed(3).padStart(6)}  ${(ns.score * SECONDS).toFixed(1).padStart(6)}`);
}

console.log(`\n  cells arriving within ${GOAL_CAPTURE} cm : ${arrived}/${cells}`
  + `  (${(100 * arrived / Math.max(1, cells)).toFixed(0)}%)   GATE: >= 50%`);
console.log(`  mean control-subtracted closure : ${(closSum / Math.max(1, scoredCreatures)).toFixed(3)}   GATE: > 0`);
