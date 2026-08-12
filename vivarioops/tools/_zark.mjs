// tools/_zark.mjs — THE ARK, AND WHETHER THE SCORE STILL MEANS WHAT IT MEANT.
//                                            ⚠ WRITES BACK INTO THE ARK FILE
//
//     node tools/_zark.mjs [arkfile] [--stamp]
//
//     node tools/_zark.mjs tools/_zbreed_ark_1.json --stamp   # establish the baseline
//     node tools/_zark.mjs tools/_zbreed_ark_1.json           # re-check after a bump
//
// ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
//
// Animal breeding cannot tell genetic gain from a change in the measuring
// environment unless it keeps something fixed to measure against — a control
// population, a genetic base, straws from bulls that are no longer alive. This
// project has never had one, and it has bumped `GENOME_V` five times, `BRIDGE_V`
// eight times, and rewritten the actuator twice. Every score quoted across one
// of those boundaries has been quoted on faith.
//
// The ark is that fixed thing. It holds the genome of every animal a breeding
// run ever selected, and this tool re-scores the whole set on the CURRENT build
// and answers one question:
//
//     does the new score rank these animals the way the old score did?
//
// Spearman >= 0.9 and the history stands, on a rebased scale. Below 0.9 it does
// NOT, and every figure taken before the change has to be re-derived or retired.
// That is a verdict about the instrument, and it is the only honest way to carry
// a breeding programme across a schema change.
//
// ── WHY THE CANONICAL TRIAL AND NOT THE RUN'S OWN ────────────────────────────
//
// A breeding run's task distance RATCHETS, so two ark entries minted five
// generations apart were scored against different exams. Those numbers rank
// within a generation and nowhere else. The baseline this tool stamps is the
// canonical trial — the full direction set, 90 s, at the 8 cm the tank actually
// places its beacon — taken once, on every entry, under one set of conditions.
// `_zgoal`'s own rule: the cheap trial ranks, the canonical trial reports.
//
// ── WRITES ───────────────────────────────────────────────────────────────────
//
// `--stamp` writes `baseline` back into the ark file: the canonical score of
// every entry plus the build it was taken on. Without it nothing is written and
// the tool only reports.
import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync, writeFileSync } from 'node:fs';
import { deserialise, genomeHash } from '../engine/l1/genome.js';
import { GENOME_V, BRIDGE_V } from '../contracts/versions.js';
import { binomial } from '../engine/l1/naming.js';
import W1_SLICE from '../worlds/w1_slice.js';
import { goalScore, prepare, DIRECTIONS } from './_zgoal.mjs';

await RAPIER.init();

const FILE = process.argv[2] ?? 'tools/_zbreed_ark_1.json';
const STAMP = process.argv.includes('--stamp');

/** The canonical trial. Pinned here so a baseline and a re-check cannot drift. */
const CANON = { seconds: 90, distance: 8, dirs: DIRECTIONS };

const build = {
  genomeV: GENOME_V, bridgeV: BRIDGE_V,
  faunaVersion: W1_SLICE.faunaVersion,
  seconds: CANON.seconds, distance: CANON.distance, dirs: CANON.dirs.length,
};

const ark = JSON.parse(readFileSync(FILE, 'utf8'));
const entries = Object.values(ark.arks ?? {}).flat();
if (!entries.length) { console.log(`  ${FILE} holds no ark entries.`); process.exit(1); }

// DEDUPLICATED BY HASH. A champion that survives several generations is written
// once per generation it was champion in, and re-scoring it five times would
// weight it five times in the correlation.
const seen = new Map();
for (const e of entries) if (!seen.has(e.hash)) seen.set(e.hash, e);
const uniq = [...seen.values()];

console.log(`\n  THE ARK · ${FILE}`);
console.log(`  ${uniq.length} distinct animals (${entries.length} records)`);
console.log(`  minted under GENOME_V ${ark.genomeVersion ?? '?'}   scoring under GENOME_V ${GENOME_V},`
  + ` BRIDGE_V ${BRIDGE_V}, faunaVersion ${W1_SLICE.faunaVersion}`);
console.log(`  canonical trial: ${CANON.dirs.length} directions x ${CANON.seconds} s at ${CANON.distance} cm\n`);

const rows = [];
let broke = 0, notSubject = 0, rehashed = 0;
process.stdout.write('  re-scoring ');
for (const e of uniq) {
  let g;
  // `deserialise` runs the migration chain, so an entry minted under an older
  // GENOME_V arrives current. A migration that is NOT bit-identical moves the
  // hash, and that is itself a finding — it means stored records keyed on the
  // old hash no longer find their animal.
  try { g = deserialise(e.serialised); } catch { broke++; process.stdout.write('!'); continue; }
  if (genomeHash(g) !== e.hash) rehashed++;
  const prep = prepare(RAPIER, g, W1_SLICE);
  if (!prep || !(prep.speed > 1e-6)) { notSubject++; process.stdout.write('x'); continue; }
  const r = goalScore(RAPIER, {
    plan: prep.plan, genome: g, world: W1_SLICE, plane: prep.plane,
    speed: prep.speed, seconds: CANON.seconds, dirs: CANON.dirs, distance: CANON.distance,
  });
  if (!r.valid) { notSubject++; process.stdout.write('x'); continue; }
  rows.push({
    hash: e.hash, gen: e.gen, line: e.line,
    runCm: e.closedCm, speed: prep.speed,
    canonCm: r.closure * CANON.distance,
    arrived: r.arrived, dwell: r.dwell,
    inPlane: r.bands.inPlane.closure * CANON.distance,
    out: r.bands.out.closure * CANON.distance,
    binomial: binomial(prep.plan, g).binomial,
  });
  process.stdout.write('.');
}
console.log('\n');

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
function spearman(a, b) {
  const rank = (xs) => {
    const idx = xs.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const out = new Array(xs.length);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const r = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) out[idx[k][1]] = r;
      i = j + 1;
    }
    return out;
  };
  return pearson(rank(a), rank(b));
}
function pearson(a, b) {
  const ma = mean(a), mb = mean(b);
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; }
  return sa > 0 && sb > 0 ? sab / Math.sqrt(sa * sb) : 0;
}
function ols(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const b = sxx > 0 ? sxy / sxx : 0;
  return { a: my - b * mx, b };
}

console.log(`  scored ${rows.length}/${uniq.length}   would not deserialise ${broke}   no longer a subject ${notSubject}`);
if (rehashed) console.log(`  ⚠ ${rehashed} genomes CHANGED HASH under migration — stored records keyed on the old hash are orphaned`);

const prior = ark.baseline;
if (!prior) {
  console.log('\n  NO BASELINE IN THIS FILE. Run with --stamp to establish one; there is nothing');
  console.log('  to compare against yet. Do this BEFORE the next schema bump, not after.\n');
} else {
  // Compare only animals present in both, matched by hash.
  const old = new Map(prior.rows.map((r) => [r.hash, r]));
  const pairs = rows.filter((r) => old.has(r.hash)).map((r) => ({ ...r, was: old.get(r.hash).canonCm }));
  console.log(`\n  ── AGAINST THE BASELINE ──`);
  console.log(`  baseline taken on GENOME_V ${prior.build.genomeV}, BRIDGE_V ${prior.build.bridgeV},`
    + ` faunaVersion ${prior.build.faunaVersion}`);
  console.log(`  ${pairs.length} animals present in both`);
  if (pairs.length < 5) {
    console.log('  too few to judge. The verdict below is not available at this n.\n');
  } else {
    const rho = spearman(pairs.map((p) => p.was), pairs.map((p) => p.canonCm));
    const rp = pearson(pairs.map((p) => p.was), pairs.map((p) => p.canonCm));
    const { a, b } = ols(pairs.map((p) => p.was), pairs.map((p) => p.canonCm));
    console.log(`  Spearman  ${rho.toFixed(3)}     Pearson  ${rp.toFixed(3)}`);
    console.log(`  rebase:   new = ${a.toFixed(3)} + ${b.toFixed(3)} x old`);
    // PRE-DECLARED, in design/15-BREEDING.md section 6, before any bump this
    // would be run against.
    console.log(rho >= 0.9
      ? `\n  ✓ THE METRIC STILL RANKS THESE ANIMALS. The score history stands, rebased by the line above.`
      : `\n  ✗ THE METRIC HAS CHANGED MEANING (Spearman ${rho.toFixed(3)} < 0.90). Every figure taken\n`
        + `    before this build must be re-derived on the current one or retired. Do not\n`
        + `    plot the two histories on one axis.`);
    const moved = [...pairs].sort((p, q) => Math.abs(q.canonCm - q.was) - Math.abs(p.canonCm - p.was)).slice(0, 5);
    console.log('\n  moved most:');
    for (const m of moved) {
      console.log(`    ${m.was.toFixed(3).padStart(8)} -> ${m.canonCm.toFixed(3).padStart(8)}   ${m.binomial}`);
    }
  }
}

rows.sort((a, b) => b.canonCm - a.canonCm);
console.log('\n  the ark, best first on the canonical trial:');
console.log('    canonCm    v cm/s   arrive    dwell   inPlane      out   gen  line   name');
for (const r of rows.slice(0, 15)) {
  console.log(`    ${r.canonCm.toFixed(3).padStart(7)} ${r.speed.toFixed(4).padStart(9)}`
    + ` ${r.arrived.toFixed(2).padStart(8)} ${r.dwell.toFixed(3).padStart(8)}`
    + ` ${r.inPlane.toFixed(2).padStart(9)} ${r.out.toFixed(2).padStart(8)}`
    + ` ${String(r.gen).padStart(5)} ${String(r.line).padStart(5)}   ${r.binomial}`);
}
if (rows.length > 15) console.log(`    ... and ${rows.length - 15} more`);

if (STAMP) {
  ark.baseline = { build, rows: rows.map((r) => ({ hash: r.hash, canonCm: r.canonCm, speed: r.speed })) };
  writeFileSync(FILE, JSON.stringify(ark, null, 1));
  console.log(`\n  stamped: baseline for ${rows.length} animals written into ${FILE}`);
  console.log('  Re-run this tool WITHOUT --stamp after the next schema change.\n');
} else {
  console.log('\n  (nothing written — pass --stamp to record this as the baseline)\n');
}
