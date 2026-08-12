// tools/_zcampsum.mjs — READ THE CAMPAIGN. One row per run, ranked.
//
// The comparison is across METHODS, so the columns are the ones that mean the
// same thing in all of them: the population median (Gate 3's statistic, the one
// §5.4 shows is not fooled by a converged arm), the response over the founder,
// and how many of the ark's animals were actually BRED (§5.5).
import { readFileSync, readdirSync } from 'node:fs';
import { deserialise } from '../engine/l1/genome.js';
const f = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : '—');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const METHOD = { 10: 'seekfirst', 11: 'forage', 12: 'dwell', 13: 'seek', 14: 'spine' };
const rows = [];
for (const file of readdirSync('tools').filter((x) => /^_zbreed_ark_1[0-4]\d\.json$/.test(x))) {
  const ark = JSON.parse(readFileSync(`tools/${file}`, 'utf8'));
  const seed = ark.seed;
  const H = ark.history.filter((r) => r.arm === 'score');
  if (!H.length) continue;
  const gmax = Math.max(...H.map((r) => r.gen));
  const last = H.filter((r) => r.gen === gmax);
  const resp = [0, 1, 2].map((L) => {
    const h = H.filter((r) => r.line === L).sort((a, b) => a.gen - b.gen);
    return h.length ? Math.max(...h.map((r) => r.bestCm)) / (Math.abs(h[0].bestCm) || 1e-9) : 0;
  });
  const uniq = new Map();
  for (const e of Object.values(ark.arks).flat()) if (!uniq.has(e.hash)) uniq.set(e.hash, e);
  let bred = 0, bestBredCm = -Infinity;
  for (const e of uniq.values()) {
    let g; try { g = deserialise(e.serialised); } catch { continue; }
    if ((g.origin?.generations ?? 0) > 0) { bred++; if (e.closedCm > bestBredCm) bestBredCm = e.closedCm; }
  }
  rows.push({
    seed, method: METHOD[String(seed).slice(0, 2)] ?? '?', gen: gmax,
    med: mean(last.map((r) => r.medCm)), best: mean(last.map((r) => r.bestCm)),
    task: last[0]?.dist ?? 0, norm: mean(last.map((r) => r.medCm)) / (last[0]?.dist || 1),
    resp: mean(resp), spines: mean(last.map((r) => r.spines)), bred, bestBredCm,
    arrived: mean(last.map((r) => r.arrived ?? 0)), dwell: mean(last.map((r) => r.dwell ?? 0)),
  });
}
rows.sort((a, b) => b.norm - a.norm);
console.log('\n  seed  method     gen   medCm  ÷task   bestCm  respons  task  spn  bred  bestBred  arrive  dwell');
for (const r of rows) {
  console.log(`  ${String(r.seed).padStart(4)}  ${r.method.padEnd(10)} ${String(r.gen).padStart(3)}`
    + ` ${f(r.med).padStart(7)} ${f(r.norm).padStart(6)} ${f(r.best).padStart(8)} ${f(r.resp, 2).padStart(7)}x`
    + ` ${f(r.task, 2).padStart(5)} ${f(r.spines, 1).padStart(4)} ${String(r.bred).padStart(5)}`
    + ` ${f(r.bestBredCm).padStart(9)} ${f(r.arrived, 2).padStart(7)} ${f(r.dwell, 3).padStart(6)}`);
}
console.log('\n  by method, mean ÷task median:');
for (const m of ['seekfirst', 'forage', 'dwell', 'seek', 'spine']) {
  const g = rows.filter((r) => r.method === m);
  if (!g.length) continue;
  console.log(`    ${m.padEnd(10)} ${f(mean(g.map((r) => r.norm))).padStart(7)}`
    + `   response ${f(mean(g.map((r) => r.resp)), 2)}x   bred ${f(mean(g.map((r) => r.bred)), 1)}`
    + `   spines ${f(mean(g.map((r) => r.spines)), 1)}   n=${g.length}`);
}
console.log('');
