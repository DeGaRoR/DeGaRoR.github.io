// STOL-PILOT: the legs table - node reports/evidence/STOL-PILOT/table.js <base.json> <branch.json>  (legs.js outputs; markdown)
const [b, n] = process.argv.slice(2).map(f => require(require('path').resolve(f)));
const fld = { HOME: 'HOME 1100 m', A4: 'A4 340 m', mineL: 'HOME->mine 250 m', mine: 'mine 250 m', w8: 'w8 392 m soft' };
const cell = r => !r ? '-' : r.err ? 'ERR' : r.outcome !== 'completed' ? r.outcome + (r.to ? ' (lift ' + r.to.run + ')' : '') :
  'lift ' + r.to.run + ' / roll **' + r.ldg.run + '** / td ' + r.ldg.V + ' m/s ' + r.ldg.sink + ' sink' + (r.ga ? ' / GA ' + r.ga : '') + (r.appr && r.appr.stol ? ' [STOL]' : '');
const keys = [...new Set([...Object.keys(b), ...Object.keys(n)])].sort();
console.log('| build / field / pilot | base (merged, no law) | this branch | same? |');
console.log('|---|---|---|---|');
for (const k of keys) {
  const [bd, f, p] = k.split('/');
  const same = JSON.stringify(b[k]) === JSON.stringify(n[k]);
  console.log('| ' + bd + ' / ' + (fld[f] || f) + ' / ' + p + ' | ' + cell(b[k]) + ' | ' + cell(n[k]) + ' | ' + (b[k] && n[k] ? (same ? 'identical' : 'moved') : '') + ' |');
}
