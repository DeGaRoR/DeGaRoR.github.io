// tools/_zspine.mjs — CAN THE GRAMMAR DRAW A SPINE, AND DOES IT SURVIVE BREEDING?
//
// Two questions, and the second is the one nobody had measured.
//
// 1. DRAW RATE. `tools/_zrecur.mjs` established that SLICE_LIMITS.maxRecursion 2
//    makes a chain unbuildable (longestRun >= 4 in 0 of 400 draws) and that
//    lifting it to the grammar's full 6 is free but not sufficient — run >= 4
//    reaches only 5%, because a chain needs several independent draws to
//    coincide.
//
// 2. SURVIVAL. `tools/_zseg.mjs` had to filter its own finalists on
//    `runOf(g) >= 4` with the note "breeding dissolves chains". That is the whole
//    problem in one line and it was never quantified. A generator that produces
//    spines into a mutation operator that dissolves them has produced nothing.
//
// WHY THE FACE IS THE DOMINANT TERM. A child always attaches by its own -Z face
// (morphogen.js placeChild, "fixed convention, never revisited"), so a segment
// repeated on the parent's +Z face — index 5 — extends the body along its axis,
// and a segment repeated on ANY OTHER face turns ninety degrees every time and
// spirals into itself. worlds/seeds.js:119 keeps that counter-example
// deliberately: identical genes except parentFace 0, "the chain self-intersects,
// and morphogenesis rejects it at four bodies however high recursiveLimit goes".
// Five of six faces are geometrically doomed before anything else is drawn.
//
// Run: node tools/_zspine.mjs [N=400] [GENS=20] [MUT=2]
import RAPIER from '@dimforge/rapier3d-compat';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { signature } from '../engine/l1/naming.js';
import { assessViability } from '../engine/l1/viability.js';
import { mutate } from '../engine/l1/mutate.js';
import { rngFrom } from '../trunk/rng.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const N = Number(process.argv[2] ?? 400);
const GENS = Number(process.argv[3] ?? 20);
const MUT = Number(process.argv[4] ?? 2);
const SPINE = 4;                       // a "spine" is a run of >= 4 identical segments

const pct = (a, f) => (100 * a.filter(f).length) / Math.max(1, a.length);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

function runOf(g) {
  try { return signature(morphogenesis(g), g).longestRun; } catch { return 0; }
}
function bodiesOf(g) {
  try { return morphogenesis(g).bodyCount; } catch { return 0; }
}

// ── 1. draw rate ────────────────────────────────────────────────────────────
console.log(`\n  SPINE REPORT — ${N} draws, ${GENS} generations x ${MUT} mutations\n`);

const drawn = [];
for (let i = 0; i < N; i++) {
  const g = createRandomGenome(rngFrom('spine', 'draw', i));
  drawn.push({ g, run: runOf(g), bodies: bodiesOf(g) });
}
// Self-edge rate, straight from the genome — the precondition everything else
// multiplies against.
const selfRate = pct(drawn, (d) => d.g.connections.some((c) => c.parentNodeId === c.childNodeId));
const axialSelf = pct(drawn, (d) => d.g.connections.some((c) => c.parentNodeId === c.childNodeId && c.parentFace === 5));

console.log('  DRAW');
console.log(`    has a self-connection          ${selfRate.toFixed(0)}%`);
console.log(`    ... on the AXIAL face (5)      ${axialSelf.toFixed(0)}%   <- the chain-forming case`);
console.log(`    longestRun median / max        ${med(drawn.map((d) => d.run))} / ${Math.max(...drawn.map((d) => d.run))}`);
console.log(`    run >= 4  (a spine)            ${pct(drawn, (d) => d.run >= SPINE).toFixed(1)}%`);
console.log(`    run >= 6                       ${pct(drawn, (d) => d.run >= 6).toFixed(1)}%`);
console.log(`    bodies median                  ${med(drawn.map((d) => d.bodies))}`);

// VIABILITY, AND SEPARATELY FOR SPINES. A spine nobody can simulate is not
// progress, and the general sample carries too few of them to say — the first
// run of this reported "0% of 4", which is not a measurement. Spines are
// sampled to their own quota, and the REJECTION REASON is reported, because
// "unviable" spans oversize, overlapping and inert and the fix differs for each.
const via = [];
for (const d of drawn.slice(0, 80)) {
  try { const v = assessViability(RAPIER, d.g, W1_SLICE); via.push({ ok: v.ok, why: v.reason ?? '—' }); }
  catch (e) { via.push({ ok: false, why: `threw: ${e.message.slice(0, 30)}` }); }
}
console.log(`    viable (n=${via.length})                  ${pct(via, (v) => v.ok).toFixed(0)}%`);

const spineVia = [];
for (const d of drawn.filter((x) => x.run >= SPINE).slice(0, 60)) {
  try { const v = assessViability(RAPIER, d.g, W1_SLICE); spineVia.push({ ok: v.ok, why: v.reason ?? '—' }); }
  catch (e) { spineVia.push({ ok: false, why: `threw: ${e.message.slice(0, 30)}` }); }
}
console.log(`    viable AMONG spines (n=${spineVia.length})      ${spineVia.length ? pct(spineVia, (v) => v.ok).toFixed(0) + '%' : '—'}`);
if (spineVia.length) {
  const why = new Map();
  for (const v of spineVia) if (!v.ok) why.set(v.why, (why.get(v.why) ?? 0) + 1);
  for (const [w, n] of [...why.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`        rejected: ${String(w).padEnd(30)} ${n}`);
  }
  // 'mass' spans two opposite failures and the fix differs, so say which.
  const spineMass = drawn.filter((x) => x.run >= SPINE).slice(0, 60)
    .map((x) => { try { return totalMass(morphogenesis(x.g)); } catch { return NaN; } })
    .filter(Number.isFinite);
  console.log(`        spine mass median ${med(spineMass).toFixed(2)} g`
    + `  (bounds 0.2 .. 40)  under ${pct(spineMass.map((m) => ({ m })), (d) => d.m < 0.2).toFixed(0)}%`
    + `  over ${pct(spineMass.map((m) => ({ m })), (d) => d.m > 40).toFixed(0)}%`);
}

// ── 2. survival under mutation ──────────────────────────────────────────────
//
// Seeded from genomes that HAVE a spine, so this measures decay and not the draw
// rate a second time. Every generation applies MUT mutations, which is what
// breed.js does per offspring (MUTATIONS_PER_OFFSPRING [1,3]).
const seeds = drawn.filter((d) => d.run >= SPINE).map((d) => d.g);
console.log(`\n  SURVIVAL — seeded from ${seeds.length} spined genomes`);
if (!seeds.length) {
  console.log('    no spines drawn; nothing to decay. Lift maxRecursion first.\n');
} else {
  // WHICH OPERATOR KILLS IT. `mutateTimes` returns the genome; `mutate` returns
  // the operator label. Applying ONE mutation at a time and checking the run
  // before and after attributes each loss to the operator that caused it, which
  // is the difference between fixing the defect and guessing at it.
  let pop = seeds.map((g) => JSON.parse(JSON.stringify(g)));
  const blame = new Map();
  const curve = [];
  for (let gen = 1; gen <= GENS; gen++) {
    pop = pop.map((g, i) => {
      let cur = g;
      for (let k = 0; k < MUT; k++) {
        const before = runOf(cur);
        // mutate() CLONES and returns {genome, op}; it does not mutate in place,
        // and its third argument is `opts`, not `limits`. Getting either wrong
        // makes this report 100% survival and zero kills, which is what the
        // first run of this tool did.
        let r;
        try { r = mutate(cur, rngFrom('spine', `m${gen}.${k}`, i), { limits: SLICE_LIMITS }); } catch { continue; }
        if (before >= SPINE && runOf(r.genome) < SPINE) {
          blame.set(r.op, (blame.get(r.op) ?? 0) + 1);
        }
        cur = r.genome;
      }
      return cur;
    });
    const alive = pct(pop.map((g) => ({ run: runOf(g) })), (d) => d.run >= SPINE);
    curve.push([gen, alive]);
  }
  console.log('    gen   still a spine');
  for (const [gen, alive] of curve) {
    if (gen === 1 || gen === 5 || gen === 10 || gen === GENS) {
      console.log(`    ${String(gen).padStart(3)}   ${alive.toFixed(0)}%`);
    }
  }
  const half = curve.find(([, a]) => a < 50);
  console.log(`\n    half-life: ${half ? half[0] + ' generations' : 'beyond ' + GENS + ' generations'}`);
  console.log(`    surviving at ${GENS}: ${curve[curve.length - 1][1].toFixed(0)}%   (A2 target >= 50%)`);

  const ranked = [...blame.entries()].sort((a, b) => b[1] - a[1]);
  const totalKills = ranked.reduce((t, [, n]) => t + n, 0);
  console.log(`\n    WHAT DISSOLVED THEM (${totalKills} spine-killing mutations)`);
  for (const [op, n] of ranked.slice(0, 8)) {
    console.log(`      ${op.padEnd(34)} ${String(n).padStart(4)}  ${((100 * n) / Math.max(1, totalKills)).toFixed(0)}%`);
  }
}
console.log('');
