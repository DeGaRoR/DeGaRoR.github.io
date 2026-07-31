// tools/_capability.mjs — THE SELECTABLE PARAMETER SET, AND WHETHER IT SORTS.
//
// ── WHERE THE INCENTIVE COMES FROM ──────────────────────────────────────────
//
// A creature has no motivation. It cannot want the light. What it has is
// `engine/l2/duel.js senseOpponent`:
//
//     bearing  = bearingTo(sim, target)            // -1..+1, sensed
//     turnBias = preyGain*bearing + threatGain*bearing
//
// `preyGain` and `threatGain` are GENES, range [-1, 1], and genome.js says of
// them: "sign is EVOLVED, not declared (P2)". So every creature already runs a
// closed loop from "where is the target" to "which way do I bend". A creature
// with preyGain +0.8 turns toward; one with -0.8 turns away; one with 0.0
// ignores it entirely. All three are legal, all three are expressible today, and
// nothing in the code prefers any of them.
//
// The incentive is not in the creature. It is in the TRIAL. Put a target at a
// random bearing, run 30 s, score the fraction of the distance closed, breed the
// top scorers. The lineages whose gain has the right sign and useful magnitude
// close distance; the rest do not; after enough generations the population
// chases. That is the whole of Sims' light-following, and the only piece of it
// this project lacks is the trial.
//
// Which makes ONE question decisive, and it is the question this tool answers:
// DOES THE SCORE DISCRIMINATE? If every creature scores the same, selection has
// nothing to grip and no number of generations helps. If it spreads, the
// experiment is ready to run.
//
// ── WHAT IS WORTH SELECTING ON ──────────────────────────────────────────────
//
// Reported per creature, grouped by whether the number can currently be trusted.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE, sensorTurnBias } from '../engine/l1/controller.js';
import { SEEDS } from '../worlds/seeds.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const W = { ...W1_SLICE, gravity: 0 };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.max(0, Math.round((s.length - 1) * q))] : NaN; };
const MOTOR = { motor: 'solver' };

/** Straight-line swimming: speed, path speed, efficiency, energy. */
function locomote(plan, genome, SEC = 15) {
  let sim;
  try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, ...MOTOR }); }
  catch { return null; }
  const N = Math.round(SEC / FIXED_DT);
  const c0 = sim.centreOfMass(); let prev = c0, path = 0, bad = false;
  try {
    for (let s = 0; s < N; s++) {
      sim.step();
      const c = sim.centreOfMass();
      if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
      path += Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]); prev = c;
    }
  } catch { bad = true; }
  const c1 = sim.centreOfMass(); const mass = sim.bodies.reduce((m, b) => m + b.mass(), 0); sim.free();
  if (bad) return null;
  const net = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);
  return { netSpeed: net / SEC, comSpeed: path / SEC, efficiency: net / Math.max(path, 1e-9), mass };
}

/**
 * TURN AUTHORITY, measured the way S3 intends — bias both ways, half the
 * difference, so an intrinsic curl cancels — but in 3-D rather than in yaw.
 *
 * S3 as shipped reads `headingOf`, which is `atan2(f[0], f[2])`: a compass
 * bearing. A chain bends about its limbs' local X and therefore turns in PITCH,
 * where a compass bearing is identically zero. `turnRate` is the field N21
 * clamps every L3 steering decision by, so this is not a cosmetic difference.
 */
function turning(plan, genome, SEC = 10) {
  const run = (turnBias) => {
    let sim;
    try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, turnBias, ...MOTOR }); }
    catch { return null; }
    const N = Math.round(SEC / FIXED_DT);
    const marks = []; let bad = false;
    try {
      for (let s = 0; s < N; s++) {
        sim.step();
        const c = sim.centreOfMass();
        if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
        if (s % 60 === 0) marks.push([...c]);
      }
    } catch { bad = true; }
    sim.free();
    if (bad || marks.length < 4) return null;
    const v = [];
    for (let i = 1; i < marks.length; i++) {
      const d = [marks[i][0] - marks[i - 1][0], marks[i][1] - marks[i - 1][1], marks[i][2] - marks[i - 1][2]];
      const n = Math.hypot(...d);
      if (n > 1e-5) v.push(d.map((x) => x / n));
    }
    // SIGNED turn about the mean rotation axis, so the two runs can cancel
    let ax = [0, 0, 0], tot = 0, k = 0;
    for (let i = 1; i < v.length; i++) {
      const a = v[i - 1], b = v[i];
      const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      tot += Math.asin(Math.min(1, Math.hypot(...c))); k++;
      ax[0] += c[0]; ax[1] += c[1]; ax[2] += c[2];
    }
    if (!k) return null;
    const an = Math.hypot(...ax);
    return { rate: tot / k * (2), axis: an > 1e-9 ? ax.map((x) => x / an) : [0, 0, 0] };
  };
  const p = run(+1), m = run(-1), z = run(0);
  if (!p || !m || !z) return null;
  // authority = how much the response CHANGES with the input, not its size
  const dot = p.axis[0] * m.axis[0] + p.axis[1] * m.axis[1] + p.axis[2] * m.axis[2];
  return {
    turnRate3d: Math.abs(p.rate - m.rate) / 2,
    intrinsic: z.rate,
    axisAgreement: dot,            // -1 = opposite turns (real steering), +1 = same
  };
}

/**
 * SEEK SCORE — the objective a light-following experiment would select on.
 *
 * The creature's OWN preyGain/threatGain drive the loop, exactly as
 * senseOpponent does in a duel. Nothing hand-written steers it. `plane` chooses
 * where the bearing is measured: 'yaw' is what duel.js does today, 'bend' is the
 * plane a chain actually turns in.
 *
 * Score is the mean fraction of the initial distance closed, over targets spread
 * around the creature, so a creature that only swims straight scores whatever
 * one lucky bearing gives it and no more.
 */
function seek(plan, genome, { plane = 'yaw', R = 6, SEC = 30, bearings = [0, 60, 120, 180, 240, 300] } = {}) {
  const [A, B] = plane === 'yaw' ? [0, 2] : [2, 1];
  const scores = [];
  for (const deg of bearings) {
    let sim;
    try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, ...MOTOR }); }
    catch { return null; }
    const c0 = sim.centreOfMass();
    const th = deg * Math.PI / 180;
    const target = [...c0];
    target[A] += R * Math.cos(th); target[B] += R * Math.sin(th);
    let best = R, bad = false, prev = c0, va = 0, vb = 0;
    try {
      for (let s = 0; s < Math.round(SEC / FIXED_DT); s++) {
        const c = sim.centreOfMass();
        if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
        va = 0.98 * va + 0.02 * (c[A] - prev[A]); vb = 0.98 * vb + 0.02 * (c[B] - prev[B]);
        const ta = target[A] - c[A], tb = target[B] - c[B];
        if (Math.hypot(va, vb) > 1e-7 && Math.hypot(ta, tb) > 1e-4) {
          // normalised bearing off the direction of travel, in [-1, 1] — the
          // same convention bearingTo produces, fed to the same gene reader
          const bearing = wrap(Math.atan2(tb, ta) - Math.atan2(vb, va)) / Math.PI;
          sim.control.turnBias = sensorTurnBias(genome, bearing, bearing);
        }
        prev = c;
        const d = Math.hypot(target[0] - c[0], target[1] - c[1], target[2] - c[2]);
        if (d < best) best = d;
        sim.step();
      }
    } catch { bad = true; }
    sim.free();
    if (bad) return null;
    scores.push(Math.max(0, (R - best) / R));
  }
  return { seek: scores.reduce((a, b) => a + b, 0) / scores.length, perBearing: scores };
}

// ── run ─────────────────────────────────────────────────────────────────────

const corpus = [];
for (const s of SEEDS) {
  try { corpus.push({ tag: s.id, g: s.genome, p: morphogenesis(s.genome) }); } catch { /* skip */ }
}
const NRAND = Number(process.argv[2] ?? 24);
for (let i = 0; corpus.length < SEEDS.length + NRAND && i < NRAND * 10; i++) {
  const g = createRandomGenome(rngFrom(0x5EE1 ^ (i * 2654435761)));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.jointCount >= 1) corpus.push({ tag: `rand${i}`, g, p });
}

const rows = [];
for (const { tag, g, p } of corpus) {
  const loc = locomote(p, g);
  if (!loc) continue;
  const tn = turning(p, g);
  const yaw = seek(p, g, { plane: 'yaw' });
  const bend = seek(p, g, { plane: 'bend' });
  rows.push({
    tag, authored: !tag.startsWith('rand'),
    ...loc,
    turnRate3d: tn ? tn.turnRate3d : NaN,
    axisAgreement: tn ? tn.axisAgreement : NaN,
    preyGain: g.controller.preyGain, threatGain: g.controller.threatGain,
    netGain: g.controller.preyGain + g.controller.threatGain,
    seekYaw: yaw ? yaw.seek : NaN,
    seekBend: bend ? bend.seek : NaN,
  });
}

console.log(`\nn = ${rows.length}  (${rows.filter(r => r.authored).length} authored, ${rows.filter(r => !r.authored).length} random)  motor='solver'\n`);
console.log('  CAPABILITY CARD — authored specimens');
console.log('  id            netSpd   effic   turn3d  axisAgr   gain    seek(yaw)  seek(bend)');
for (const r of rows.filter((x) => x.authored)) {
  console.log(`  ${r.tag.padEnd(12)}  ${r.netSpeed.toFixed(3).padStart(6)}  ${r.efficiency.toFixed(3).padStart(6)}  ${r.turnRate3d.toFixed(3).padStart(6)}  ${r.axisAgreement.toFixed(2).padStart(7)}  ${r.netGain.toFixed(2).padStart(5)}   ${r.seekYaw.toFixed(3).padStart(8)}  ${r.seekBend.toFixed(3).padStart(9)}`);
}

const spread = (label, f) => {
  const v = rows.map(f).filter(Number.isFinite);
  if (!v.length) return;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  console.log(`  ${label.padEnd(22)} p10 ${pct(v,0.1).toFixed(3).padStart(7)}  p50 ${pct(v,0.5).toFixed(3).padStart(7)}  p90 ${pct(v,0.9).toFixed(3).padStart(7)}  max ${Math.max(...v).toFixed(3).padStart(7)}   CV ${(mean > 1e-9 ? sd / mean : NaN).toFixed(2)}`);
};
console.log('\n  DOES IT DISCRIMINATE? spread over the whole corpus');
console.log('  (CV = spread / mean. Below ~0.2 there is little for selection to grip.)');
spread('netSpeed', (r) => r.netSpeed);
spread('efficiency', (r) => r.efficiency);
spread('turnRate3d', (r) => r.turnRate3d);
spread('SEEK SCORE (yaw)', (r) => r.seekYaw);
spread('SEEK SCORE (bend)', (r) => r.seekBend);

// Does the gene move the score? Spearman between netGain and seek.
const rank = (v) => { const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(v.length); idx.forEach(([, i], k) => { r[i] = k; }); return r; };
const spearman = (a, b) => {
  const ra = rank(a), rb = rank(b), n = a.length;
  const ma = (n - 1) / 2;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - ma); da += (ra[i] - ma) ** 2; db += (rb[i] - ma) ** 2; }
  return num / Math.sqrt(da * db);
};
const ok = rows.filter((r) => Number.isFinite(r.seekBend) && Number.isFinite(r.seekYaw));
console.log('\n  IS THE SCORE A FUNCTION OF THE GENE? (Spearman over the corpus)');
console.log(`    netGain  vs seek(yaw)     ${spearman(ok.map(r => r.netGain), ok.map(r => r.seekYaw)).toFixed(2)}`);
console.log(`    netGain  vs seek(bend)    ${spearman(ok.map(r => r.netGain), ok.map(r => r.seekBend)).toFixed(2)}`);
console.log(`    netSpeed vs seek(bend)    ${spearman(ok.map(r => r.netSpeed), ok.map(r => r.seekBend)).toFixed(2)}`);
console.log(`    efficiency vs seek(bend)  ${spearman(ok.map(r => r.efficiency), ok.map(r => r.seekBend)).toFixed(2)}`);
console.log('');
