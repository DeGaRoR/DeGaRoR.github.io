// tools/_zchampions.mjs — PICK THE CAMPAIGN'S CHAMPIONS.
//                                          ⚠ WRITES worlds/w1_bred.js WHOLESALE
//
//     node tools/_zchampions.mjs [N] [ark.json ...]
//
// ── WHY THIS DOES NOT RE-SCORE ANYTHING ─────────────────────────────────────
//
// Every `_zbreed` run already ends by re-scoring each line's champion on the
// CANONICAL trial — 6 directions x 90 s at the tank's own 8 cm beacon — and
// stores the result in `ark.verdict`. Sixteen runs x 3 lines is 48 animals
// already measured under one fixed exam, which is exactly the comparison a
// champion list needs. `_zpromote.mjs` re-scored 115 animals for eighteen
// minutes to get numbers that were already on disk.
//
// ── DE-DUPLICATION BY BINOMIAL, NOT BY HASH, AND THAT IS THE WHOLE POINT ─────
//
// The first run of this selection returned FIVE `Macroprotea torticorpata` in
// eight slots — 7.87, 7.89, 7.89, 7.89, 7.92 cm, arriving 6/6, dwelling 0.60 to
// 0.67. Different hashes, so a hash filter admitted them all; siblings from one
// line, so the shelf was one animal wearing five labels. The binomial is derived
// from topology and proportion (`naming.js`), so it is the cheapest thing in the
// tree that says "this is the same KIND of creature" — and a shelf of one kind
// is useless for §4.7's outcross, which exists to find an animal strong where a
// stalled line is weak.
//
// ── THE AXES, IN THE STATED PRIORITY ORDER ──────────────────────────────────
//
// Seeking first, because it is the one that demonstrates perception AND
// orientation together; then arriving, then holding station, then the body plan,
// then speed. Each axis takes the best animal not already represented.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { deserialise, serialise, genomeHash } from '../engine/l1/genome.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { signature, binomial } from '../engine/l1/naming.js';

const ARGV = process.argv.slice(2);
const N = Number(ARGV.find((a) => /^\d+$/.test(a)) ?? 8);
const FILES = ARGV.filter((a) => a.endsWith('.json'));
if (!FILES.length) {
  for (const f of readdirSync('tools')) {
    if (/^_zbreed_ark_\d+\.json$/.test(f)) FILES.push(`tools/${f}`);
  }
}
const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');

// ── gather every canonically-scored champion ────────────────────────────────
const byHash = new Map();
for (const file of FILES) {
  let ark;
  try { ark = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
  for (const v of ark.verdict ?? []) {
    if (byHash.has(v.hash)) continue;
    byHash.set(v.hash, { ...v, seed: ark.seed ?? '?', file });
  }
}
const cand = [];
for (const v of byHash.values()) {
  // ONLY BRED ANIMALS ARE CHAMPIONS. `births === 0` is a founding draw or one of
  // N17's random strangers — real, kept in the ark, and not the programme's
  // output. design/15-BREEDING.md section 5.5.
  if (!(v.births > 0)) continue;
  let g, plan;
  try { g = deserialise(v.serialised); plan = morphogenesis(g); } catch { continue; }
  cand.push({
    ...v, genome: g, plan,
    run: signature(plan, g).longestRun,
    bodies: plan.bodyCount, mass: totalMass(plan),
  });
}
console.log(`\n  _zchampions — ${byHash.size} canonically-scored champions across ${FILES.length} arks`);
console.log(`  ${cand.length} of them were BRED; ${new Set(cand.map((c) => c.binomial)).size} distinct binomials\n`);

// ── THE FORAGE CHAMPIONS — a different objective, so a different headline ────
//
// `tools/_ztaxevo.mjs` selected on GRAMS EATEN over 300 s, not on beacon
// closure, and its winners are bred (4-11 births) with `origin.founder: null`.
// They belong on the shelf for the same reason the beacon champions do — they
// are the programme's output — but quoting a beacon number on them would be
// quoting a measurement nobody took. Their headline is grams.
function forageChampions() {
  const out = [];
  for (const f of readdirSync('tools').filter((x) => /^_ztaxevo_seed\d+\.json$/.test(x))) {
    let j;
    try { j = JSON.parse(readFileSync(`tools/${f}`, 'utf8')); } catch { continue; }
    // The two arms produced identical winners in every seed — the taxis gene
    // never entered a selected set — so taking `free` takes the animal, not a
    // side of an experiment that had no sides.
    const w = j.winners?.free;
    if (!w?.serialised) continue;
    let g, plan;
    try { g = deserialise(w.serialised); plan = morphogenesis(g); } catch { continue; }
    const births = g.origin?.generations ?? 0;
    if (!(births > 0)) continue;
    out.push({
      genome: g, plan, births, seed: j.seed, gen: w.gen, arm: 'free', line: 0,
      hash: genomeHash(g), eaten: w.eaten,
      run: signature(plan, g).longestRun, bodies: plan.bodyCount, mass: totalMass(plan),
      receptors: (plan.receptors ?? []).length,
      binomial: binomial(plan, g).binomial,
    });
  }
  out.sort((a, b) => b.eaten - a.eaten);
  const picked = [];
  // One on grams, one on the BODY PLAN — a long segment chain is the thing this
  // project has spent a session failing to breed, and the forage run produced one.
  const best = out[0];
  if (best) picked.push({ ...best, niche: 'forager', blurb: 'the most food taken in 300 s' });
  const chain = out.filter((x) => x !== best).sort((a, b) => b.run - a.run)[0];
  if (chain && chain.run >= 4) {
    picked.push({ ...chain, niche: 'segmented forager', blurb: 'the longest bred segment chain that also feeds' });
  }
  return picked;
}

const AXES = [
  ['seeker', 'closes the most ground under its own steering', (r) => r.closedCm],
  ['arriver', 'reaches the mark in the most of six directions', (r) => r.arrived * 100 + r.closedCm],
  ['station-keeper', 'holds position on the mark the longest', (r) => r.dwell],
  ['spined', 'the longest coherent segment chain', (r) => r.run],
  ['sprinter', 'the fastest cruise', (r) => r.speed],
  ['out-of-plane', 'best at targets square to its own bend plane', (r) => r.out],
  ['in-plane', 'best at targets inside its own bend plane', (r) => r.inPlane],
];

const picked = [], takenKind = new Set(), takenHash = new Set();
for (const [niche, blurb, key] of AXES) {
  if (picked.length >= N) break;
  const pool = cand.filter((r) => !takenHash.has(r.hash) && !takenKind.has(r.binomial) && Number.isFinite(key(r)));
  if (!pool.length) continue;
  const win = pool.reduce((a, b) => (key(b) > key(a) ? b : a));
  if (!(key(win) > 0)) continue;              // an axis nothing scores on is not a niche
  takenHash.add(win.hash); takenKind.add(win.binomial);
  picked.push({ ...win, niche, blurb });
}
// Fill any remaining slots by score, still one animal per kind.
for (const r of [...cand].sort((a, b) => b.closedCm - a.closedCm)) {
  if (picked.length >= N) break;
  if (takenHash.has(r.hash) || takenKind.has(r.binomial)) continue;
  takenHash.add(r.hash); takenKind.add(r.binomial);
  picked.push({ ...r, niche: 'runner-up', blurb: 'next by score, and a different kind' });
}

console.log('  niche            closedCm  arrive  dwell   cruise  inPl/out    run  births  name');
for (const p of picked) {
  console.log(`  ${p.niche.padEnd(16)} ${fmt(p.closedCm).padStart(7)} ${fmt(p.arrived).padStart(7)}`
    + ` ${fmt(p.dwell, 3).padStart(6)} ${fmt(p.speed, 4).padStart(8)}`
    + ` ${fmt(p.inPlane, 1).padStart(5)}/${fmt(p.out, 1).padStart(4)} ${String(p.run).padStart(4)}`
    + ` ${String(p.births).padStart(6)}   ${p.binomial}`);
}

// ── emit ────────────────────────────────────────────────────────────────────
for (const fc of forageChampions()) {
  if (takenHash.has(fc.hash) || takenKind.has(fc.binomial)) continue;
  takenHash.add(fc.hash); takenKind.add(fc.binomial);
  picked.push(fc);
  console.log(`  ${fc.niche.padEnd(16)} ${'—'.padStart(7)} ${'—'.padStart(7)} ${'—'.padStart(6)}`
    + ` ${'—'.padStart(8)} ${'—'.padStart(5)}/${'—'.padStart(4)} ${String(fc.run).padStart(4)}`
    + ` ${String(fc.births).padStart(6)}   ${fc.binomial}   (${fc.eaten.toFixed(2)} g eaten)`);
}

const idOf = (p) => `champ-${p.niche.replace(/[^a-z]/g, '')}-${p.hash.slice(0, 6)}`;
const body = picked.map((p) => {
  if (p.eaten != null) {
    const n = `CHAMPION (${p.niche}) — ${p.blurb}. BRED, ${p.births} births deep, no authored `
      + `ancestor. Selected on GRAMS EATEN over a 300 s forage trial (tools/_ztaxevo.mjs), `
      + `seed ${p.seed}, generation ${p.gen}: ${fmt(p.eaten)} g. ${p.bodies} bodies, `
      + `${fmt(p.mass)} g, longest segment run ${p.run}, ${p.receptors} receptors.`;
    return `  {
    id: ${JSON.stringify(idOf(p))},
    name: ${JSON.stringify(`Champion — ${p.niche}`)},
    niche: ${JSON.stringify(p.niche)},
    binomial: ${JSON.stringify(p.binomial)},
    bred: true,
    births: ${p.births},
    headline: ${JSON.stringify(`forage ${p.eaten.toFixed(1)} g / 300 s · chain ${p.run}`)},
    note: ${JSON.stringify(n)},
    genome: curate(${JSON.stringify(deserialise(serialise(p.genome)))}, ${JSON.stringify(idOf(p))}),
  },`;
  }
  const note = `CHAMPION (${p.niche}) — ${p.blurb}. BRED, ${p.births} births deep, no authored `
    + `ancestor. Campaign seed ${p.seed}, ${p.arm} arm, line ${p.line}, generation ${p.gen}. `
    + `Canonical trial (6 directions x 90 s at the tank's own 8 cm beacon): closes `
    + `${fmt(p.closedCm)} cm, arrives in ${Math.round(p.arrived * 6)} of 6, holds station for `
    + `${(p.dwell * 100).toFixed(0)}% of the trial, cruise ${fmt(p.speed, 4)} cm/s. In-plane `
    + `${fmt(p.inPlane)} against out-of-plane ${fmt(p.out)}. ${p.bodies} bodies, ${fmt(p.mass)} g, `
    + `longest segment run ${p.run}.`;
  return `  {
    id: ${JSON.stringify(idOf(p))},
    name: ${JSON.stringify(`Champion — ${p.niche}`)},
    niche: ${JSON.stringify(p.niche)},
    binomial: ${JSON.stringify(p.binomial)},
    bred: true,
    births: ${p.births},
    canonCm: ${Number(p.closedCm.toFixed(4))},
    arrived: ${Number(p.arrived.toFixed(4))},
    dwell: ${Number(p.dwell.toFixed(4))},
    note: ${JSON.stringify(note)},
    genome: curate(${JSON.stringify(deserialise(serialise(p.genome)))}, ${JSON.stringify(idOf(p))}),
  },`;
}).join('\n');

const out = `// worlds/w1_bred.js — MACHINE OUTPUT. Regenerate, do not edit.
//
//     node tools/_zchampions.mjs ${N} tools/_zbreed_ark_*.json
//
// ── THE CAMPAIGN'S CHAMPIONS ────────────────────────────────────────────────
//
// A fourth provenance beside \`w1_curated.js\` (found, and selected) and
// \`w1_reef.js\` (the owner's own hand-steered breeding): the output of the
// offline programme in \`design/15-BREEDING.md\`. Random founders, NO AUTHORED
// ANCESTOR anywhere — every one carries \`origin.founder: null\` before promotion
// — selected on \`closedCm\` across four methods and sixteen seeds.
//
// EVERY ENTRY WAS BRED. \`origin.generations > 0\` on all of them, checked before
// selection, because most of an ark is founding draws and N17 strangers and
// section 5.5 records what it cost to confuse the two once.
//
// ONE ANIMAL PER BINOMIAL, AND PER NICHE. The first cut of this list was five
// siblings of one species in eight slots. A shelf is only worth having if its
// entries are COMPLEMENTARY, because that is what section 4.7's outcross reaches
// into it for.
//
// Entries: ${picked.length}
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
console.log(`\n  written: worlds/w1_bred.js — ${picked.length} champions`
  + `   (~${(picked.length * 0.206).toFixed(1)} s of portrait rendering on a cold boot)\n`);
