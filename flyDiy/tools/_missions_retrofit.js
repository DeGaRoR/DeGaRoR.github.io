#!/usr/bin/env node
// ============================================================================
// THE RETROFIT (MISSIONS-P0) — writes src/missions/builtin.json: every authored
// contract of 72_contract_data.js read into the mission model (73b_missions.js
// missionPackFromContracts), the tutorial listed read-only. Run once at the
// retrofit; after that the pack is authored (tools/mission_editor.html) and GATE
// MISSIONS holds its retrofitted missions to 72_'s records.
//   node tools/_missions_retrofit.js            write the pack
//   node tools/_missions_retrofit.js --check    exit 1 when the file differs from a fresh retrofit
// ============================================================================
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { loadMissions } = require('./_missions_lib.js');
// THE DROPS (the retrofit's rulings, HANDOVER MISSIONS-P0): none - every authored contract is offered in today's careers
// or held out by a rule that will lift (the aerobatic box, the stretcher), so dropping one changes a running career
const DROPPED = [];

// one mission per line, the rest indented: the pack diffs by mission
function packText(p) {
  const J = o => JSON.stringify(o);
  const lines = ['{', '  "what": ' + J(p.what) + ',', '  "v": ' + J(p.v) + ',', '  "id": ' + J(p.id) + ',', '  "title": ' + J(p.title) + ','];
  lines.push('  "campaigns": [');
  p.campaigns.forEach((c, i) => {
    const { chapters, ...head } = c;
    lines.push('    ' + J(head).slice(0, -1) + ', "chapters": [');
    chapters.forEach((h, j) => lines.push('      ' + J(h) + (j < chapters.length - 1 ? ',' : '')));
    lines.push('    ]}' + (i < p.campaigns.length - 1 ? ',' : ''));
  });
  lines.push('  ],', '  "missions": [');
  p.missions.forEach((m, i) => lines.push('    ' + J(m) + (i < p.missions.length - 1 ? ',' : '')));
  lines.push('  ],');
  for (const k of ['sites', 'text', 'legacy']) lines.push('  ' + J(k) + ': ' + J(p[k]) + (k !== 'legacy' ? ',' : ''));
  lines.push('}');
  return lines.join('\n') + '\n';
}

const M = loadMissions();
const pack = M.missionPackFromContracts({ dropped: DROPPED });
const why = M.missionPackValidate(pack, {});
if (why.length) { console.error('the retrofit does not validate:\n  ' + why.join('\n  ')); process.exit(1); }
const out = path.join(ROOT, 'src', 'missions', 'builtin.json'), txt = packText(pack);
JSON.parse(txt);
if (process.argv.includes('--check')) {
  const same = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === txt;
  console.log(same ? 'builtin.json = a fresh retrofit' : 'builtin.json differs from a fresh retrofit');
  process.exit(same ? 0 : 1);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, txt);
console.log('wrote ' + path.relative(ROOT, out) + ': ' + pack.missions.length + ' missions (' + pack.legacy.retrofitted.length + ' retrofitted, ' +
  DROPPED.length + ' dropped, ' + pack.missions.filter(m => m.tutorial).length + ' tutorial listings), ' + pack.campaigns.length + ' campaigns');
