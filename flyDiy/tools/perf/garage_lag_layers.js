// garage_lag_layers.js - a garage_lag report's profiled rep, split by the editor's post chain: each PAGE.post wraps the
// one before it, so a layer's own cost is its inclusive time less the next inner post's. Usage: node garage_lag_layers.js <report.json> [change]
'use strict';
const R = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const want = process.argv[3] || null;
const split = p => {
  const I = new Map(p.syncIncl);
  const posts = p.syncIncl.filter(([k]) => /PAGE\.post /.test(k)).sort((a, b) => b[1] - a[1]);
  const out = {}; for (let i = 0; i < posts.length; i++) { const nm = posts[i][0].split(' ')[1].replace(/\.js:\d+/, '').replace(/^_cage_/, '') + (out[posts[i][0].split(' ')[1].replace(/\.js:\d+/, '').replace(/^_cage_/, '')] != null ? '2' : ''); out[nm] = +(posts[i][1] - (i + 1 < posts.length ? posts[i + 1][1] : 0)).toFixed(0); }
  const post0 = posts.length ? posts[0][1] : 0;
  out['(sheet+mesh, pre-post)'] = +(p.syncMs - post0).toFixed(0);
  return out;
};
const rows = R.rows.filter(r => r.prof && (!want || r.change === want));
const keyOf = r => r.build + ' ' + r.change;
const groups = {}; for (const r of rows) (groups[keyOf(r)] = groups[keyOf(r)] || {})[r.tree] = split(r.prof);
for (const g in groups) {
  const T = Object.keys(groups[g]); const names = new Set(); for (const t of T) for (const k in groups[g][t]) names.add(k);
  console.log('== ' + g + '   ' + T.join(' / '));
  for (const n of names) { const v = T.map(t => groups[g][t][n] != null ? groups[g][t][n] : '-'); if (v.some(x => x !== '-' && x >= 3)) console.log('   ' + n.padEnd(26) + v.map(x => String(x).padStart(6)).join('')); }
  console.log('   ' + 'TOTAL sync'.padEnd(26) + T.map(t => String(rows.find(r => keyOf(r) === g && r.tree === t).prof.syncMs).padStart(6)).join(''));
}
