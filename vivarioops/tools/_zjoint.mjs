// tools/_zjoint.mjs — IS THE JOINT LIMIT THE THING THAT IS TOO SMALL?
//
//     node tools/_zjoint.mjs [draws] [seconds]
//
// ── WHY THE QUESTION IS NOT WHAT IT LOOKS LIKE ──────────────────────────────
//
// `RANGE.angleLimit` is [0, PI/2] — a revolute joint may be drawn anywhere up to
// +-90 degrees, which is already generous against a vertebrate. So "the limit is
// too tight" cannot be answered by reading the cap. What a joint actually SWINGS
// is a product of two independently drawn genes:
//
//     commanded angle = bias + amplitude * angleLimits[0] * sin(phase)
//                       amplitude    ~ U[0, 1]
//                       angleLimits  ~ U[0, PI/2]
//
// so the stroke half-amplitude is the product of two uniforms. Its expectation
// is a QUARTER of the cap even though either gene alone averages a half, and the
// authored eel sits at 0.8 * 0.9 = 0.72 rad against that. A cap can be generous
// and the corpus still be under-driven, and those are different defects with
// different fixes.
//
// ── AND THE LIMIT IS SHARED WITH STEERING ───────────────────────────────────
//
// `setLimits(-angleLimits[0], +angleLimits[0])` clamps the joint physically, and
// `targetAngles` adds the turn command to the SAME scalar. HANDOVER-STEERING
// records what that costs: at `turnBias = +-1` the command asks for a full range
// of offset on top of a gait already using p50 0.69 of it, the joint pins, the
// stroke rectifies and thrust collapses — which is why `S3` read `eel-fast` at
// 1.25 deg/s when its real capability is 8.88. So the limit is a BUDGET shared
// between the gait and the steering, and a sweep has to say which one is short.
//
// ── THE SWEEP ───────────────────────────────────────────────────────────────
//
// Every joint's `angleLimits[0]` is set to one absolute value, everything else
// untouched — the same controlled shape `_zeel.mjs` uses for `phaseLag`. Points
// ABOVE PI/2 need `RANGE.angleLimit` widened, because `morphogen.js` clamps at
// expression (`qClamp(a, limitRangeFor(type))`); the tool widens it in memory
// for the duration and says so. That is a measurement instrument setting a
// variable the game leaves alone, which is what `_zgoalch2.mjs` did for
// `preyGain2` and is allowed as long as it is declared.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { cloneGenome } from '../engine/l1/mutate.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { assessViability } from '../engine/l1/viability.js';
import { RANGE } from '../engine/l1/genome.js';
import { netSpeed } from '../engine/l2/objective.js';
import { goalScore, prepare, DIRECTIONS_FAST } from './_zgoal.mjs';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();

const DRAWS = Number(process.argv[2] ?? 300);
const SECONDS = Number(process.argv[3] ?? 20);
const CAP = RANGE.angleLimit[1];                       // PI/2 as shipped
/** Absolute joint limits swept, radians. The last three are OUTSIDE the cap. */
const LIMITS = [0.2, 0.4, 0.6, 0.9, 1.2, CAP, 2.0, 2.6, Math.PI];

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const fmt = (n, d = 4) => (Number.isFinite(n) ? n.toFixed(d) : '—');
const deg = (r) => `${(r * 180 / Math.PI).toFixed(0)}d`;

/** Every driven joint to one absolute limit. Twist joints keep their own band. */
function withLimit(g, lim) {
  const c = cloneGenome(g);
  for (const n of c.nodes) {
    if (n.joint.type === 'twist') continue;            // a different band, and a different organ
    n.joint.angleLimits = n.joint.angleLimits.map((_, k) => (k === 0 ? lim : n.joint.angleLimits[k]));
  }
  return c;
}

function cruise(g) {
  let plan;
  try { plan = morphogenesis(g); } catch { return null; }
  if (plan.jointCount < 1) return null;
  try {
    const r = netSpeed(RAPIER, { plan, genome: g, world: W1_SLICE, seconds: SECONDS });
    return r.valid ? r.score : null;
  } catch { return null; }
}

// ── 1. what the corpus actually swings ──────────────────────────────────────
console.log(`\n  _zjoint — is the joint limit the binding constraint?   ${DRAWS} draws, ${SECONDS}s\n`);
console.log(`  RANGE.angleLimit = [0, ${fmt(CAP, 3)}] (${deg(CAP)})   amplitude = [0, 1]`);
console.log('  commanded stroke = amplitude x angleLimits[0], so it is a PRODUCT of two uniforms\n');

const subjects = [];
const strokes = [];
for (let i = 0; i < DRAWS && subjects.length < 12; i++) {
  const g = createRandomGenome(rngFrom('zjoint', 'draw', i));
  let plan;
  try { plan = morphogenesis(g); } catch { continue; }
  if (plan.jointCount < 2) continue;
  for (const j of plan.joints) {
    const amp = g.controller.jointGenes[j.nodeId]?.amplitude ?? 0;
    strokes.push(amp * j.angleLimits[0]);
  }
  if (!assessViability(RAPIER, g, W1_SLICE).ok) continue;
  if (!(cruise(g) > 0)) continue;
  subjects.push(g);
}
console.log(`  DRAWN STROKE half-amplitude, rad, over ${strokes.length} joints`);
console.log(`    p10 ${fmt(med(strokes.slice().sort((a, b) => a - b).slice(0, Math.max(1, strokes.length / 10))), 3)}`
  + `   median ${fmt(med(strokes), 3)} (${deg(med(strokes))})`
  + `   mean ${fmt(mean(strokes), 3)}   max ${fmt(Math.max(...strokes), 3)}`);
console.log(`    the authored eel is 0.8 x 0.9 = 0.720 rad (41d)`);
console.log(`    fraction of joints under half the eel's stroke: `
  + `${(100 * strokes.filter((s) => s < 0.36).length / strokes.length).toFixed(0)}%`);

if (subjects.length < 4) { console.log('\n  too few subjects.\n'); process.exit(0); }

// ── 2. the sweep ────────────────────────────────────────────────────────────
//
// ⚠ THE CAP IS WIDENED IN MEMORY for the points above PI/2. `morphogen.js`
// clamps `angleLimits` at expression, so without this the last three columns
// would silently be duplicates of the CAP column — a null result manufactured by
// the instrument. Declared here and restored below.
const savedCap = RANGE.angleLimit[1];
RANGE.angleLimit[1] = Math.PI;
console.log(`\n  ⚠ RANGE.angleLimit widened in memory to ${fmt(Math.PI, 3)} for the sweep`
  + ` (shipped value ${fmt(savedCap, 3)} restored after).`);

console.log(`\n  CRUISE cm/s BY JOINT LIMIT — every driven joint set to one value\n`);
console.log('  subj |' + LIMITS.map((l) => fmt(l, 2).padStart(8)).join('') + '  |  best');
const rows = [];
for (let k = 0; k < subjects.length; k++) {
  const speeds = LIMITS.map((l) => cruise(withLimit(subjects[k], l)));
  const ok = speeds.map((v) => (v == null ? -Infinity : v));
  const bi = ok.indexOf(Math.max(...ok));
  rows.push({ speeds, bestLimit: LIMITS[bi] });
  console.log(`  ${String(k).padStart(4)} |`
    + speeds.map((v) => (v == null ? '     — ' : fmt(v, 4)).padStart(8)).join('')
    + `  | ${fmt(LIMITS[bi], 2).padStart(5)}`);
}

const col = LIMITS.map((_, i) => mean(rows.map((r) => r.speeds[i]).filter((v) => v != null)));
console.log('\n  mean |' + col.map((v) => fmt(v, 4).padStart(8)).join(''));
const inCap = Math.max(...col.filter((_, i) => LIMITS[i] <= savedCap));
const anyBest = Math.max(...col);
const anyLim = LIMITS[col.indexOf(anyBest)];
console.log(`\n  best mean INSIDE the shipped cap (<= ${fmt(savedCap, 3)}):  ${fmt(inCap)} cm/s`);
console.log(`  best mean ANYWHERE (limit ${fmt(anyLim, 2)} = ${deg(anyLim)}):        ${fmt(anyBest)} cm/s`);
console.log(`  raising the cap would be worth:                    ${fmt(anyBest / Math.max(1e-9, inCap), 2)}x`);
console.log(`  subjects whose own optimum is OUTSIDE the cap:     `
  + `${rows.filter((r) => r.bestLimit > savedCap).length}/${rows.length}`);

// ── 3. does it change STEERING, which shares the same budget? ───────────────
//
// Cruise is the gait alone at `turnBias 0`. The claim the limit is a shared
// budget is a claim about what happens when a turn command is added, so the two
// most interesting columns are re-run on the goal trial. Two points only: this
// costs a full trial each and the sweep above is what locates them.
const A = LIMITS.indexOf(savedCap), B = col.indexOf(anyBest);
if (A >= 0 && B >= 0 && A !== B) {
  console.log(`\n  GOAL TRIAL at the cap (${fmt(LIMITS[A], 2)}) vs the sweep's best (${fmt(LIMITS[B], 2)})`);
  console.log('  subj    closedCm @cap   closedCm @best   delta');
  const d = [];
  for (let k = 0; k < Math.min(6, subjects.length); k++) {
    const at = (lim) => {
      const g = withLimit(subjects[k], lim);
      const prep = prepare(RAPIER, g, W1_SLICE);
      if (!prep || !(prep.speed > 1e-6)) return null;
      const r = goalScore(RAPIER, {
        plan: prep.plan, genome: g, world: W1_SLICE, plane: prep.plane,
        speed: prep.speed, seconds: 40, dirs: DIRECTIONS_FAST, distance: 4.5,
      });
      return r.valid ? r.closure * 4.5 : null;
    };
    const a = at(LIMITS[A]), b = at(LIMITS[B]);
    if (a == null || b == null) { console.log(`  ${String(k).padStart(4)}          —              —`); continue; }
    d.push(b - a);
    console.log(`  ${String(k).padStart(4)} ${fmt(a, 3).padStart(14)} ${fmt(b, 3).padStart(16)} ${fmt(b - a, 3).padStart(8)}`);
  }
  if (d.length) console.log(`  mean delta ${fmt(mean(d), 3)} cm   (${d.filter((x) => x > 0).length}/${d.length} improved)`);
}

RANGE.angleLimit[1] = savedCap;
console.log(`\n  RANGE.angleLimit restored to [0, ${fmt(savedCap, 3)}].\n`);
