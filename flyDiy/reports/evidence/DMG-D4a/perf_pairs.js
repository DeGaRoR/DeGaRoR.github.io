// alternating base / now child processes (treecrash_evidence.js --perf-child): sim.step(1/60), the layer ON, nothing touching
const { spawnSync } = require('child_process'); const path = require('path');
const [base, mine, pairs] = [process.argv[2], process.argv[3], +(process.argv[4] || 12)];
const ev = path.join(path.dirname(mine), 'treecrash_evidence.js');
const one = (core, k, mode) => { const r = spawnSync(process.execPath, [ev, '--perf-child', core, k, mode], { encoding: 'utf8' }); const l = (r.stdout || '').split('\n').find(x => x.startsWith('PERF ')); return l ? JSON.parse(l.slice(5)).med : NaN; };
const med = a => { const v = a.slice().sort((x, y) => x - y); return v[v.length >> 1]; };
const out = {};
for (const [k, mode] of [['cub', 'ground'], ['cub', 'air'], ['metal', 'ground'], ['metal', 'air']].filter(c => !process.argv[5] || process.argv[5] === c.join(':'))) {
  const b = [], m = [], d = [];
  for (let i = 0; i < pairs; i++) { let x, y; if (i % 2) { y = one(mine, k, mode); x = one(base, k, mode); } else { x = one(base, k, mode); y = one(mine, k, mode); } b.push(x); m.push(y); d.push(y / x - 1); }
  out[k + ':' + mode] = { base: med(b), now: med(m), pooled: med(m) / med(b) - 1, pairsMed: med(d), neg: d.filter(x => x < 0).length };
  console.log(k, mode, 'base', med(b).toFixed(3), 'now', med(m).toFixed(3), 'ms;', ((med(m) / med(b) - 1) * 100).toFixed(1) + ' %; the pairs\' median', (med(d) * 100).toFixed(1) + ' %,', d.filter(x => x < 0).length + '/' + pairs, 'negative');
}
console.log('PERFJSON ' + JSON.stringify(out));
