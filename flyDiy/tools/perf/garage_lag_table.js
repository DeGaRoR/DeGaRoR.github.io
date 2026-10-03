// garage_lag_table.js - garage_lag reports side by side: per build and change, each tree's median (max) of `sync`
// (the input handler: the build), and of `busy` (the long tasks until the page is quiet: the tick and its tails).
// Usage: node tools/perf/garage_lag_table.js <report.json>[,<report.json>...] [tree,tree,...] [--md]
'use strict';
const fs = require('fs');
const argv = process.argv.slice(2), md = argv.includes('--md');
const files = argv[0].split(','), want = argv[1] && !argv[1].startsWith('--') ? argv[1].split(',') : null;
const rows = []; for (const f of files) for (const r of JSON.parse(fs.readFileSync(f, 'utf8')).rows) if (!r.missing) rows.push(r);
// trees of the same name across reports pool their reps (an ABBA's two A slots are one column)
const base = t => t.replace(/([A-Z])\d+$/, '$1');   // todayA2 -> todayA (an ABBA's second slot)
const trees = want || [...new Set(rows.map(r => base(r.tree)))];
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const cell = (b, c, t, k) => { const R = rows.filter(r => r.build === b && r.change === c && base(r.tree) === t); if (!R.length) return '-';
  const v = R.flatMap(r => r.reps.map(x => x[k])); return Math.round(med(v)) + ' (' + Math.round(Math.max(...v)) + ')'; };
for (const k of ['sync', 'busy']) for (const b of [...new Set(rows.map(r => r.build))]) {
  const ch = [...new Set(rows.filter(r => r.build === b).map(r => r.change))];
  if (md) { console.log('\n**' + b + ' - ' + k + ' ms, median (max)**\n'); console.log('| change | ' + trees.join(' | ') + ' |'); console.log('|---|' + trees.map(() => '---:').join('|') + '|'); }
  else console.log('\n== ' + b + ' ' + k + ' ms median (max)\n   ' + 'change'.padEnd(10) + trees.map(t => t.padStart(14)).join(''));
  for (const c of ch) { const v = trees.map(t => cell(b, c, t, k)); console.log(md ? '| ' + c + ' | ' + v.join(' | ') + ' |' : '   ' + c.padEnd(10) + v.map(x => x.padStart(14)).join('')); }
}
