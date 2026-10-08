// agg.js <dir> - the per-sheet levels of the runs in <dir> (*_imp.json), their geometric mean, the cores before / after
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const runs = fs.readdirSync(dir).filter(f => /_imp\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(dir, f))));
const keys = [...new Set(runs.flatMap(r => Object.keys(r.levels)))].sort();
const out = {};
console.log('sheet'.padEnd(58) + runs.map(r => r.tag.padEnd(13)).join('') + 'mean');
for (const k of keys) {
  const ks = runs.map(r => r.levels[k]).filter(x => x > 0);
  const g = Math.exp(ks.reduce((a, b) => a + Math.log(b), 0) / ks.length);
  out[k] = +g.toFixed(3);
  console.log(k.padEnd(58) + runs.map(r => String(r.levels[k] || '-').padEnd(13)).join('') + out[k]);
}
console.log('\ncore (front-lit / side) today -> trunk fix -> fixed:');
for (const r of runs) for (const x of r.rows) console.log(`  ${r.tag.padEnd(12)} ${x.key.padEnd(56)} ${x.side.padEnd(5)} ${x.today} -> ${x.trunk} -> ${x.fixed}`);
fs.writeFileSync(path.join(dir, 'levels.json'), JSON.stringify(out, null, 1));
