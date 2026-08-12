// tools/_zpromote.mjs — PROMOTE THE ARKS INTO THE SHIPPED LIBRARY.
//                                          ⚠ WRITES worlds/w1_bred.js WHOLESALE
//
//     node tools/_zpromote.mjs [ark.json ...]
//
// ── WHY A GENERATOR AND NOT A HAND-EDIT ─────────────────────────────────────
//
// `w1_curated.js` and `w1_reef.js` are hand-annotated shelves: a few specimens
// each, every one carrying a paragraph about what it is evidence of. That is the
// right shape for six creatures and the wrong shape for eighty. These come out
// of `tools/_zbreed.mjs`'s arks, there are dozens, they will be regenerated
// every time a run lands, and each one's provenance is a row of numbers rather
// than a judgement. So the file is MACHINE OUTPUT and says so, and re-running
// this tool replaces it wholesale rather than merging into it.
//
// ── WHAT GETS IN, AND THE LINE IS `origin.generations` ──────────────────────
//
// Every ark holds two kinds of animal and they are not equal evidence:
//
//   BRED    `origin.generations > 0` — it went through breed()'s live-birth
//           line. These are the programme's own output and ALL of them are
//           promoted, however modest their score.
//
//   FOUND   `origin.generations === 0` — a founding draw or one of N17's random
//           strangers. At population 12 the stranger slot supplies 120 fresh
//           random genomes per arm over 20 generations, so most of an ark is
//           these. Promoting them all would fill the library with random draws
//           wearing a breeding programme's name. They are admitted ONLY on
//           merit — see `INTERESTING` — and each is labelled `found` so nothing
//           downstream can mistake one for a bred result.
//
// That distinction cost a correction once already (design/15-BREEDING.md §5.5:
// the run that was supposed to validate the method had a never-bred animal at
// the top of its ark and it was reported as bred). Encoding it here is what
// stops the same mistake being made silently by a file rather than by a person.
//
// ── COST, STATED ────────────────────────────────────────────────────────────
//
// `seedAtlas` renders one portrait per library entry at ~206 ms, once, on a cold
// store. Every entry promoted here adds that to a first load. The boot panel now
// covers the whole of it with a progress bar, but the seconds are real.
import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync, writeFileSync } from 'node:fs';
import { deserialise, serialise, genomeHash } from '../engine/l1/genome.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { signature, binomial } from '../engine/l1/naming.js';
import W1_SLICE from '../worlds/w1_slice.js';
import { goalScore, prepare, DIRECTIONS } from './_zgoal.mjs';

await RAPIER.init();

const ARGV = process.argv.slice(2);
/**
 * `--bred-only`  drop FOUND animals before they are scored, which is most of the
 *                cost as well as most of the shelf.
 * `--top N`      keep only the N best by canonical score.
 *
 * The library is a shelf a player picks breeding stock from, not an archive. The
 * arks are the archive and they keep everything; promoting eighty animals made
 * the Atlas a list rather than a selection, and cost 12 s of portrait rendering
 * on every cold boot. A few, chosen, is what this is for.
 */
const BRED_ONLY = ARGV.includes('--bred-only');
const TOP = (() => { const i = ARGV.indexOf('--top'); return i >= 0 ? Number(ARGV[i + 1]) : Infinity; })();
const FILES = ARGV.filter((a) => a.endsWith('.json'));
if (!FILES.length) FILES.push('tools/_zbreed_ark_1.json', 'tools/_zbreed_ark_3.json', 'tools/_zbreed_ark_7.json');

/** The canonical trial — the same one `_zark.mjs` stamps a baseline with. */
const CANON = { seconds: 90, distance: 8, dirs: DIRECTIONS };

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');

// ── gather, de-duplicate, classify ──────────────────────────────────────────
const seen = new Map();
for (const f of FILES) {
  let ark;
  try { ark = JSON.parse(readFileSync(f, 'utf8')); } catch { console.log(`  (skipped ${f} — not readable)`); continue; }
  const seed = ark.seed ?? '?';
  for (const [arm, entries] of Object.entries(ark.arks ?? {})) {
    for (const e of entries) {
      // FIRST SIGHTING WINS, and the arks are read oldest-first, so an animal
      // that appears in two runs keeps the earlier provenance rather than a
      // later re-discovery of the same genome.
      if (seen.has(e.hash)) continue;
      seen.set(e.hash, { ...e, seed, arm });
    }
  }
}
console.log(`\n  _zpromote — ${seen.size} distinct animals across ${FILES.length} arks\n`);

const cand = [];
for (const e of seen.values()) {
  let g;
  try { g = deserialise(e.serialised); } catch { continue; }
  const births = g.origin?.generations ?? 0;
  let plan;
  try { plan = morphogenesis(g); } catch { continue; }
  cand.push({ ...e, genome: g, births, plan });
}

// ── score every candidate on the canonical trial ────────────────────────────
//
// The ark's own `closedCm` was taken at whatever task distance that generation
// was using, so it ranks within a generation and nowhere else. A library entry's
// note is a claim, and a claim needs the canonical number.
process.stdout.write('  scoring ');
const scored = [];
for (const c of cand) {
  if (BRED_ONLY && c.births === 0) continue;
  const prep = prepare(RAPIER, c.genome, W1_SLICE);
  if (!prep || !(prep.speed > 1e-6)) { process.stdout.write('x'); continue; }
  const r = goalScore(RAPIER, {
    plan: prep.plan, genome: c.genome, world: W1_SLICE, plane: prep.plane,
    speed: prep.speed, seconds: CANON.seconds, dirs: CANON.dirs, distance: CANON.distance,
  });
  if (!r.valid) { process.stdout.write('x'); continue; }
  const sig = signature(c.plan, c.genome);
  scored.push({
    ...c,
    canonCm: r.closure * CANON.distance, arrived: r.arrived, dwell: r.dwell,
    inPlane: r.bands.inPlane.closure * CANON.distance, out: r.bands.out.closure * CANON.distance,
    speed: prep.speed, bodies: c.plan.bodyCount, mass: totalMass(c.plan),
    run: sig.longestRun, binomial: binomial(c.plan, c.genome).binomial,
  });
  process.stdout.write('.');
}
console.log('');

const bred = scored.filter((s) => s.births > 0);
const found = scored.filter((s) => s.births === 0);
const medBred = (() => {
  const v = bred.map((b) => b.canonCm).sort((a, b) => a - b);
  return v.length ? v[v.length >> 1] : 0;
})();

/**
 * WHICH `found` ANIMALS EARN A PLACE. A random draw is admitted only if it is
 * genuinely worth looking at, and "worth looking at" is three explicit tests
 * rather than a score threshold — because the three say different things:
 *
 *   it arrives             — reaches the mark in at least one of six directions
 *   it beats the bred median — the draw out-performed the programme's own output
 *   it is a long chain     — a run of 5+ segments, which is the body plan
 *                            `_zeel.mjs` shows the draw makes and breeding loses
 */
const INTERESTING = (s) => s.arrived > 0 || s.canonCm >= medBred || s.run >= 5;
const keptFound = BRED_ONLY ? [] : found.filter(INTERESTING);

console.log(`  BRED   ${bred.length} animals — all promoted (median canonCm ${fmt(medBred)})`);
console.log(`  FOUND  ${found.length} animals — ${keptFound.length} promoted on merit,`
  + ` ${found.length - keptFound.length} left in the ark`);

let keep = [...bred, ...keptFound].sort((a, b) => b.canonCm - a.canonCm).slice(0, TOP);

// ── --champions N : PICK BY NICHE, NOT BY ONE COLUMN ────────────────────────
//
// The top N of one score are usually the same animal N times: §5.3 records a run
// whose three lines returned literally one creature. A shelf a player picks
// breeding stock from wants COMPLEMENTARY animals, because §4.7's outcross is
// only worth anything when the ark holds something strong where the stalled line
// is weak. So each champion is taken as the leader of a different axis, in
// priority order, skipping any already chosen.
//
// The order is the stated one: seeking first (it is the axis that demonstrates
// perception AND orientation), then arriving, then staying, then the body plan,
// then speed, then food. Whatever is left over is filled by score.
const CHAMPS = (() => { const i = ARGV.indexOf('--champions'); return i >= 0 ? Number(ARGV[i + 1]) : 0; })();
if (CHAMPS > 0) {
  const AXES = [
    ['seeker',       'closes the most ground under its own steering', (r) => r.canonCm],
    ['arriver',      'reaches the mark in the most directions',       (r) => r.arrived],
    ['station',      'holds position on the mark the longest',        (r) => r.dwell],
    ['spined',       'the longest coherent segment chain',            (r) => r.run],
    ['sprinter',     'the fastest cruise',                            (r) => r.speed],
    ['out-of-plane', 'best at targets square to its own bend plane',  (r) => r.out],
    ['forager',      'the most food taken on the way',                (r) => r.eatenHint ?? 0],
  ];
  const pool = [...bred, ...keptFound];
  const picked = [], seenHash = new Set();
  for (const [niche, blurb, key] of AXES) {
    if (picked.length >= CHAMPS) break;
    const cands = pool.filter((r) => !seenHash.has(r.hash) && Number.isFinite(key(r)));
    if (!cands.length) continue;
    const win = cands.reduce((a, b) => (key(b) > key(a) ? b : a));
    if (!(key(win) > 0)) continue;          // an axis nothing scores on is not a niche
    seenHash.add(win.hash);
    picked.push({ ...win, niche, blurb });
  }
  for (const r of pool.sort((a, b) => b.canonCm - a.canonCm)) {
    if (picked.length >= CHAMPS) break;
    if (seenHash.has(r.hash)) continue;
    seenHash.add(r.hash);
    picked.push({ ...r, niche: 'runner-up', blurb: 'next by score' });
  }
  keep = picked;
}

// ── emit ────────────────────────────────────────────────────────────────────
//
// `curate()` here mirrors w1_curated.js's: rewrite `origin.founder` to the
// entry's own id, so the Vivarium's Ancestry row reports "reference" for every
// descendant, exactly as it does for the authored eels. The TRUE ancestry —
// which run, which arm, which line, how many births deep — is written into the
// note, because that is the fact promotion would otherwise destroy.
const idOf = (s) => `bred-${s.hash.slice(0, 8)}`;
const ids = new Set();
const lines = [];
for (const s of keep) {
  const id = idOf(s);
  if (ids.has(id)) continue;
  ids.add(id);
  const kind = s.births > 0 ? `BRED, ${s.births} births deep` : 'FOUND — a random draw, never bred';
  const champ = s.niche ? `CHAMPION (${s.niche}) — ${s.blurb}. ` : '';
  const note = `${champ}${kind}. Run seed ${s.seed}, ${s.arm} arm, line ${s.line}, generation ${s.gen}. `
    + `Canonical trial (6 directions x 90 s at 8 cm): closes ${fmt(s.canonCm)} cm, `
    + `arrives in ${Math.round(s.arrived * 6)} of 6, dwell ${fmt(s.dwell, 3)}, cruise ${fmt(s.speed, 4)} cm/s. `
    + `${s.bodies} bodies, ${fmt(s.mass)} g, longest segment run ${s.run}.`;
  lines.push({ id, s, note });
}

const body = lines.map(({ id, s, note }) => `  {
    id: ${JSON.stringify(id)},
    name: ${JSON.stringify(s.niche ? `Champion — ${s.niche}` : null)},
    niche: ${JSON.stringify(s.niche ?? null)},
    binomial: ${JSON.stringify(s.binomial)},
    bred: ${s.births > 0},
    births: ${s.births},
    canonCm: ${Number(s.canonCm.toFixed(4))},
    arrived: ${Number(s.arrived.toFixed(4))},
    note: ${JSON.stringify(note)},
    genome: curate(${JSON.stringify(deserialise(serialise(s.genome)))}, ${JSON.stringify(id)}),
  },`).join('\n');

const out = `// worlds/w1_bred.js — MACHINE OUTPUT. Regenerate, do not edit.
//
//     node tools/_zpromote.mjs tools/_zbreed_ark_*.json
//
// ── A FOURTH KIND OF PROVENANCE ─────────────────────────────────────────────
//
// \`w1_curated.js\` holds two (FOUND in a live Atlas, and SELECTED by an
// objective) and \`w1_reef.js\` holds a third (the owner's own hand-steered
// breeding). These are the output of the OFFLINE breeding programme in
// \`design/15-BREEDING.md\`: \`tools/_zbreed.mjs\`, random founders, no authored
// stock anywhere in the ancestry, selected on \`closedCm\` against a paired
// random-selection null arm.
//
// Every entry carries \`bred\` and \`births\`. \`bred: false\` means
// \`origin.generations === 0\` — a founding draw or one of N17's random
// strangers that was admitted on merit, NOT something the programme bred. That
// distinction is load-bearing: design/15-BREEDING.md §5.5 records a run whose
// top-scoring animal was never bred and was reported as though it had been.
//
// The three hand-written shelves stay hand-written. This one is generated, and
// re-running the tool replaces it wholesale.
//
// Generated from: ${FILES.join(', ')}
// Entries: ${lines.length} (${lines.filter((l) => l.s.births > 0).length} bred, ${lines.filter((l) => l.s.births === 0).length} found)
import { migrate } from '../engine/l1/genome.js';

/** As w1_curated.js: the entry becomes its own founder once it is a reference. */
function curate(raw, id) {
  const g = migrate(JSON.parse(JSON.stringify(raw)));
  return { ...g, origin: { founder: id, generations: 0 } };
}

export const BRED = [
${body}
];

export const bredById = (id) => BRED.find((c) => c.id === id) ?? null;

export default BRED;
`;

writeFileSync('worlds/w1_bred.js', out);
console.log(`\n  written: worlds/w1_bred.js — ${lines.length} entries`
  + ` (${lines.filter((l) => l.s.births > 0).length} bred, ${lines.filter((l) => l.s.births === 0).length} found)`);
console.log(`  cold-boot cost: about ${(lines.length * 0.206).toFixed(1)} s of portrait rendering, once.\n`);
console.log('  top of the shelf:');
for (const { id, s } of lines.slice(0, 12)) {
  console.log(`    ${id}  ${fmt(s.canonCm).padStart(6)} cm  arrive ${s.arrived.toFixed(2)}`
    + `  dwell ${fmt(s.dwell, 3)}  v ${fmt(s.speed, 4)}  run ${String(s.run).padStart(2)}`
    + `  ${s.births ? `${s.births}b` : 'found'}   ${s.binomial}`);
}
console.log('');
