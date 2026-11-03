// CABIN-RESHOOT 2 (the user, 3 Nov ~21:00): the twin with its wing's centre section 'open (upper only)' (wgCentre 2),
// and the Jodel; BEFORE / AFTER, day and lamps
const fs = require('fs'), path = require('path'), out = process.argv[2];
const rows = { hdlOn: 1, wallTrimOn: 1, ohConsoleOn: 1 }, lamps = { lightOn: 1, li_flood: 1, li_pax: 1 };
const src = { twin2: ['bugReports/Twin_busher_floats_2.json', { wgCentre: 2 }], jodel: ['builds/jodel_2026-09-20_corrected.json', {}] };
const w = (name, f, add) => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); Object.assign(j.spec.cage, add); fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(j)); };
for (const [k, [f, base]] of Object.entries(src)) {
  w(k + '_before_day', f, base); w(k + '_after_day', f, Object.assign({}, base, rows));
  w(k + '_before_dusk', f, Object.assign({}, base, lamps)); w(k + '_after_dusk', f, Object.assign({}, base, rows, lamps));
}
