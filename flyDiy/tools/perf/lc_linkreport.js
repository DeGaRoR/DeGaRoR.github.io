#!/usr/bin/env node
// lc_linkreport.js - LOAD-COMPILE (G1085): a rollout_perf run's link timeline (progtime_hook / progtime_eval) read out.
//   node tools/perf/lc_linkreport.js run.json [--top 25]
// Prints the boot's steps (start, ms), per step the links it issued (count, summed and worst link ms, over 1 s), the
// slowest links (issued at, ms, step, three's name, the material wearing it, the key's head), and the links still
// pending when each step began (what a step that waits on programs is waiting for).
'use strict';
const fs = require('fs');
const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
const top = +(argv[argv.indexOf('--top') + 1] || 25) || 25;
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const ev = typeof j.eval === 'string' ? JSON.parse(j.eval) : j.eval;
const steps = (j.bootLog || []).filter(b => b.k === 'step');
console.log(file + '  garage ' + j.tGarage + ' s, roll-out ' + j.tReveal + ' s');
console.log('steps: ' + steps.map(s => s.id + ' ' + (s.ms / 1000).toFixed(1)).join(' · '));
if (!ev || !ev.rows) { console.log('(no link timeline)'); process.exit(0); }
const rows = ev.rows;   // [t0, ms, mark, name, key, keyLen, mat]
console.log('links: ' + rows.length + ', never seen linked: ' + rows.filter(r => r[1] < 0).length);
const by = {};
for (const r of rows) { const b = by[r[2]] || (by[r[2]] = { n: 0, sum: 0, worst: 0, over1: 0, first: r[0], last: r[0] });
  b.n++; b.last = Math.max(b.last, r[0]); if (r[1] > 0) { b.sum += r[1]; b.worst = Math.max(b.worst, r[1]); if (r[1] > 1000) b.over1++; } }
console.log('by step (issued in):');
for (const [k, b] of Object.entries(by)) console.log('  ' + k.padEnd(26) + String(b.n).padStart(4) + ' links, sum ' + (b.sum / 1000).toFixed(1).padStart(6) + ' s, worst ' + (b.worst / 1000).toFixed(2).padStart(6) + ' s, over 1 s: ' + b.over1);
console.log('slowest links:');
for (const r of rows.slice().sort((a, b) => b[1] - a[1]).slice(0, top))
  console.log('  ' + String(r[1]).padStart(6) + ' ms  @' + String(r[0]).padStart(6) + '  ' + r[2].padEnd(22) + ' ' + (r[3] || '?').slice(0, 26).padEnd(26) + ' ' + String(r[6] || '').slice(0, 40).padEnd(40) + ' key ' + r[4]);
// pending at each mark: issued before it, linked after it began
const marks = ev.marks || [];
console.log('links pending when a step began (and the longest wait among them from that moment):');
for (const [t, m] of marks) {
  const pend = rows.filter(r => r[0] < t && (r[1] < 0 || r[0] + r[1] > t));
  if (!pend.length) continue;
  const w = Math.max(...pend.map(r => r[1] < 0 ? 0 : r[0] + r[1] - t));
  console.log('  ' + m.padEnd(26) + ' @' + String(t).padStart(6) + '  ' + String(pend.length).padStart(4) + ' pending, the last ready ' + (w / 1000).toFixed(1) + ' s later');
}
