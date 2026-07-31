// tools/_evosum.mjs — read every checkpointed run and pair the arms.
//
// Reads runs/*.json. Each file is one arm at one seed, written by tools/_evo.mjs
// at the end of its chunk. This does no simulation and takes no time, so it can
// be run after every chunk to see whether the picture has changed.
//
// The only comparison that means anything is SELECTED against CONTROL AT THE
// SAME SEED: the two arms share their generation-0 population by construction
// (same seed, same init loop), so a paired difference removes the corpus.
import { readdirSync, readFileSync, existsSync } from 'node:fs';

if (!existsSync('runs')) { console.log('\n  no runs/ directory yet\n'); process.exit(0); }
const files = readdirSync('runs').filter((f) => f.endsWith('.json'));
if (!files.length) { console.log('\n  no runs yet\n'); process.exit(0); }

const runs = files.map((f) => ({ file: f, ...JSON.parse(readFileSync(`runs/${f}`, 'utf8')) }));
const bySeed = new Map();
for (const r of runs) {
  if (!bySeed.has(r.seed)) bySeed.set(r.seed, {});
  bySeed.get(r.seed)[r.arm] = r;
}

console.log(`\n  ${runs.length} checkpointed runs over ${bySeed.size} seeds\n`);
console.log('  seed   arm        pop  gens  bearings   median 0 -> last     best      |gain| first -> last   wall');
for (const [seed, pair] of [...bySeed.entries()].sort()) {
  for (const arm of ['selected', 'control']) {
    const r = pair[arm];
    if (!r) { console.log(`  ${seed.padEnd(6)} ${arm.padEnd(10)} —  (not run)`); continue; }
    const a = r.history[0], b = r.history[r.history.length - 1];
    console.log(`  ${seed.padEnd(6)} ${arm.padEnd(10)} ${String(r.pop).padStart(3)}  ${String(r.history.length).padStart(4)}  ${String(r.bearings).padStart(8)}   ${a.p50.toFixed(4)} -> ${b.p50.toFixed(4)}   ${b.best.toFixed(4)}      ${a.gain.toFixed(2)} -> ${b.gain.toFixed(2)}       ${r.wallSeconds.toFixed(0)}s`);
  }
}

// ── the paired comparison ───────────────────────────────────────────────────
const paired = [...bySeed.entries()].filter(([, p]) => p.selected && p.control);
if (!paired.length) {
  console.log('\n  no complete pairs yet — a selected run without its control says nothing.\n');
  process.exit(0);
}
console.log(`\n  PAIRED, ${paired.length} seed${paired.length > 1 ? 's' : ''}\n`);
// RATIOS ARE NOT REPORTED. The control's final median passes through zero — it
// went 0.0027 at S1 and -0.0148 at S2 — so a ratio is unbounded and changes sign
// on noise. The paired DIFFERENCE is bounded, has the units of the metric, and
// is what a sign test consumes. §114 quoted an 86x that was purely a small
// denominator; this stops that being possible.
console.log('  seed    selected final   control final    difference   selected wins?');
const diffs = [];
let wins = 0;
for (const [seed, p] of paired) {
  const s = p.selected.history[p.selected.history.length - 1].p50;
  const c = p.control.history[p.control.history.length - 1].p50;
  const d = s - c;
  diffs.push(d);
  if (d > 0) wins++;
  console.log(`  ${seed.padEnd(6)}  ${s.toFixed(4).padStart(13)}   ${c.toFixed(4).padStart(13)}   ${(d >= 0 ? '+' : '') + d.toFixed(4).padStart(9)}   ${d > 0 ? 'yes' : 'NO'}`);
}
const md = diffs.reduce((a, b) => a + b, 0) / diffs.length;
const sdd = Math.sqrt(diffs.reduce((a, b) => a + (b - md) ** 2, 0) / Math.max(diffs.length - 1, 1));
console.log(`\n  selected beats its own control in ${wins}/${paired.length} seeds`);
console.log(`  mean paired difference  ${md >= 0 ? '+' : ''}${md.toFixed(4)}   sd ${sdd.toFixed(4)}   (units of benefit)`);
// Two-sided sign test, exact.
const n = paired.length, k = wins;
const C = (a, b) => { let r = 1; for (let i = 0; i < b; i++) r = r * (a - i) / (i + 1); return r; };
let tail = 0;
for (let i = 0; i <= n; i++) if (Math.abs(i - n / 2) >= Math.abs(k - n / 2)) tail += C(n, i);
console.log(`  sign test, ${k}/${n}: two-sided p = ${(tail / 2 ** n).toFixed(3)}`);

// Also worth its own line: does the sensor gain converge under selection and not
// under the control? That is the mechanism, and it is independent of the median.
console.log('\n  |sensor gain| first -> last, the mechanism check');
for (const [seed, p] of paired) {
  const sg = p.selected.history, cg = p.control.history;
  console.log(`  ${seed.padEnd(6)}  selected ${sg[0].gain.toFixed(2)} -> ${sg[sg.length-1].gain.toFixed(2)}      control ${cg[0].gain.toFixed(2)} -> ${cg[cg.length-1].gain.toFixed(2)}`);
}
// The footer said "5 paired seeds for p < 0.05", which is wrong: a two-sided
// exact sign test at 5/5 gives 2/2^5 = 0.0625. Six unanimous seeds gives 0.031.
// Wrong arithmetic printed by a tool outlives any correction made in prose.
const need = (() => { for (let n = paired.length; n <= 12; n++) if (2 / 2 ** n < 0.05) return n; return null; })();
console.log(`\n  ${paired.length} paired seeds. Unanimous, p reaches < 0.05 at n = ${need ?? '?'} (2/2^n).\n`);

// Best individual: the statistic that has held 5/5 in BOTH directions.
console.log('  best individual, gen 0 -> final');
for (const [seed, p] of paired) {
  const S = p.selected.history, C = p.control.history;
  const s0 = S[0].best, s1 = S[S.length - 1].best, c1 = C[C.length - 1].best;
  console.log(`  ${seed.padEnd(6)}  selected ${s0.toFixed(4)} -> ${s1.toFixed(4)}  (${s0 > 1e-9 ? ((s1 / s0 - 1) * 100).toFixed(0).padStart(4) : '   —'}%)     control -> ${c1.toFixed(4)}  (${s0 > 1e-9 ? ((c1 / s0 - 1) * 100).toFixed(0).padStart(4) : '   —'}%)`);
}
console.log('');
