// SEA-AMPHIB: the item-2 table from fly.js's JSONs.  node reports/evidence/SEA-AMPHIB/table.js <dir with *.json>
'use strict';
const fs = require('fs'), path = require('path');
const D = process.argv[2];
const rows = [];
for (const f of fs.readdirSync(D).filter(q => q.endsWith('.json')).sort()) {
  let r; try { r = JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')); } catch (e) { continue; }
  if (!r.legs) continue;
  for (const L of r.legs) {
    const pm = L.propMin ? L.propMin.v + (L.propMin.ph ? ' ' + L.propMin.ph : '') : '-';
    const why = L.ok ? '' : (L.verdicts.find(v => /capsiz/.test(v)) || L.faults.join('; ')).slice(0, 110);
    rows.push('| ' + [f.replace(/\.json$/, ''), path.basename(r.build).replace(/\.json$/, ''), r.wind + ' kt', L.leg, (L.ok ? 'PASS' : 'FAIL') + (why ? ': ' + why : ''),
      L.sink == null ? '-' : L.sink, L.run == null ? '-' : L.run, pm, L.rollS.join(' / '), L.pitchS.join(' / '), L.tipMin ? L.tipMin.v : '-', L.capsize == null ? '-' : L.capsize, L.gear ? L.gear.join('-') : '-', L.hash].join(' | ') + ' |');
  }
  if (r.refused && r.refused.length) rows.push('| ' + f.replace(/\.json$/, '') + ' | route | | | REFUSES: ' + r.refused.join('; ') + ' | | | | | | | | | |');
}
console.log('| run | build | wind | leg | result | sink m/s | run m | prop min m (phase) | roll on surface min / max | pitch on surface min / max | tip min m | capsize margin deg | gear | hash |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
