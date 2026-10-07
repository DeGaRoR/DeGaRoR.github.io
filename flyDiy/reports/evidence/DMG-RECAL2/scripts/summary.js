// G2383/G2387 (DMG-RECAL2): the landings' table (before / after) and each landing's trace trimmed to the touch
// (-4 .. +14 s from the first float contact, every frame) as CSV, from water_landing.js's JSON
// Run from flyDiy/: node reports/evidence/DMG-RECAL2/scripts/summary.js <dir of JSON> <out dir>
const fs = require('fs'), path = require('path');
const [inDir, outDir] = process.argv.slice(2);
const files = fs.readdirSync(inDir).filter(f => /^(before|after)_.*\.json$/.test(f)).sort();
const lines = [], f2 = x => (x == null ? '-' : (+x).toFixed(2));
lines.push('run | outcome | float contact phases | the first touch: t s, V m/s (ground), sink m/s, pitch deg, bank deg, throttle, peak W | the heels at the touch (deg) | the spreaders\' peak (over the certified yield)');
for (const f of files) {
  const o = JSON.parse(fs.readFileSync(path.join(inDir, f), 'utf8')), r = o.runs && o.runs[0];
  lines.push(f.replace('.json', '') + ' | ' + (o.outcome || 'no landing') + ' | ' + o.contacts + ' | ' + (r ? [r.t0, f2(r.V), f2(r.sink), f2(r.pitch), f2(r.bank), f2(r.thr), f2(r.peakW)].join(' ') : '-') + ' | ' + (o.heelAtTouch ? o.heelAtTouch.join(' / ') : '-') + ' | ' + f2(o.peakSpreader)
    + (o.verdicts && o.verdicts.length ? ' | ' + o.verdicts.map(v => v.t + ' ' + v.code).join(', ') : ''));
  const c = o.cols, iw = c.indexOf('wet'), r0 = o.rows.find(x => x[iw] > 0);
  if (!r0) continue;
  const t0 = r0[0], rows = o.rows.filter(x => x[0] >= t0 - 4 && x[0] <= t0 + 14);
  fs.writeFileSync(path.join(outDir, f.replace('.json', '.csv')), c.join(',') + '\n' + rows.map(x => x.join(',')).join('\n') + '\n');
}
fs.writeFileSync(path.join(outDir, 'landings.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
