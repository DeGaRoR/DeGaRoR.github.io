// AFT-BULKHEAD-SHOTS: the sets. usage: node mk_sets.js <flyDiy dir> <out dir>  -> <out>/<build>_<SET>.json
const fs = require('fs'), path = require('path');
const [root, out] = process.argv.slice(2);
const SRC = { cub: 'builds/cub_2026-09-20_corrected.json', twin: 'builds/candidates/Twin_busher_floats_4b.json',
  jodel: 'builds/jodel_2026-09-20_corrected.json', mosquito: 'builds/candidates/mosquito.json', c172: 'builds/cessna172_2026-09-20_corrected.json' };
const FULL = { bhStep: 1, bhBevel: 0.05, bhTwoTone: 1, bhNet: 1, bhLamp: 3, lightOn: 1, li_pax: 1 };
const FLAT = { bhBevel: 0.05, bhTwoTone: 1, bhNet: 1, bhLamp: 2, lightOn: 1, li_pax: 1 };
const TA = { bhBevel: 0.05, bhTwoTone: 1, bhLamp: 2, lightOn: 1, li_pax: 1 }, TB = { ...TA, bhNet: 1 };
const R = (base, n, f = 1) => ({ ...base, bhRelief: n, bhFast: f });
const SETS = {
  cub: { BEFORE: {}, FULL, FLAT, SLING: { bhSling: 1 }, RELIEF1: R(FLAT, 1), RELIEF2: R(FLAT, 2), RELIEF3: R(FLAT, 3), FULLPAX0: { ...FULL, li_pax: 0 } },
  twin: { BEFORE: {}, TWINA: TA, TWINB: TB, RELIEF1: R(TB, 1), RELIEF2: R(TB, 2), RELIEF3: R(TB, 3), RIVETS: R(TB, 3, 2), TWINAPAX0: { ...TA, li_pax: 0 } },
  jodel: { BEFORE: {}, FULL, RELIEF1: R(FLAT, 1), RELIEF2: R(FLAT, 2), RELIEF3: R(FLAT, 3), FULLPAX0: { ...FULL, li_pax: 0 } },
  mosquito: { BEFORE: {}, FULL },
  c172: { FULL, BEFORE: {} },
};
fs.mkdirSync(out, { recursive: true });
for (const [b, sets] of Object.entries(SETS)) for (const [s, rows] of Object.entries(sets)) {
  const j = JSON.parse(fs.readFileSync(path.join(root, SRC[b]), 'utf8'));
  if (j.what !== 'flydiy-build') { j.what0 = j.what; j.what = 'flydiy-build'; }
  if (s !== 'BEFORE') Object.assign(j.spec.cage, { intOn: 1, intBulk: 1 }, rows);
  fs.writeFileSync(path.join(out, b + '_' + s + '.json'), JSON.stringify(j));
  console.log(b + '_' + s, JSON.stringify(rows));
}
