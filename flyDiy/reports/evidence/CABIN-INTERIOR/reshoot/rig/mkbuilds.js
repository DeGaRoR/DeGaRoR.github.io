const fs = require('fs'), path = require('path');
const out = process.argv[2];
const src = { twin: 'bugReports/Twin_busher_floats_2.json', cub: 'builds/cub_2026-09-20_corrected.json', c172: 'builds/cessna172_2026-09-20_corrected.json' };
const rows = { hdlOn: 1, wallTrimOn: 1, ohConsoleOn: 1 }, lamps = { lightOn: 1, li_flood: 1, li_pax: 1 };
const w = (name, f, add) => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); Object.assign(j.spec.cage, add); fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(j)); };
for (const [k, f] of Object.entries(src)) {
  w(k + '_before', f, {}); w(k + '_after', f, rows);
  w(k + '_before_lamps', f, lamps); w(k + '_after_lamps', f, Object.assign({}, rows, lamps));
}
// the canopy and glass cases, all with the three rows on
const cases = {
  can1_twin: [src.twin, { canopy: 1 }],                       // canopy 1 'convertible' (no saved build carries it: the twin with the row moved)
  can2_twin: [src.twin, { canopy: 2 }],                       // canopy 2 'open'
  can3_mosquito: ['builds/candidates/mosquito.json', {}],     // canopy 3 'bubble' as saved
  open_tigermoth: ['builds/candidates/tigermoth_2026-10.json', {}],  // open cockpit (cpOpen 1, canopy 0) as saved
  open_camel: ['builds/candidates/camel_2026-10.json', {}],
  open_stearman: ['builds/candidates/stearman_2026-10.json', {}],
  sky_c172: [src.c172, { skylight: 1 }],                      // skylight on, skyExt 1 as saved
  sky5_c172: [src.c172, { skylight: 1, skyExt: 5 }],          // skylight on, the widest extent
  sky_twin: [src.twin, { skylight: 1 }],                      // skylight on the twin (skyExt 5 as saved)
};
for (const [k, [f, add]] of Object.entries(cases)) w(k, f, Object.assign({}, rows, add));
