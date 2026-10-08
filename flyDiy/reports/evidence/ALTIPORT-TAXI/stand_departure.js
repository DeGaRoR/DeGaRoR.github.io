const path = require('path'), fs = require('fs');
const T = process.env.ROOT_T || require('path').join(__dirname, '..', '..', '..', 'tools');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const L = require(path.join(T, '_taxiclear_lib.js'));
const TW = TR.tourWorld(C, IN, fs); const W = TW.W; const I = L.index(TW.shapes);
const id = process.argv[2] || 'tw_ski';
const a = W.aerodromes.find(q => q.id === id), s = C.siteOf(id);
for (const bf of ['builds/cub_2026-09-20_corrected.json', 'builds/jodel_2026-09-20_corrected.json', 'bugReports/cessnaMetal (1).json']) {
  const sp = PT.specOf(path.join(T, '..', bf)).spec, def = C.buildGen(C.genMigrateSpec(sp));
  const F = L.flyOut(C, W, I, def, a, s);
  console.log(id, path.basename(bf), F.air ? 'airborne' : 'NOT airborne', F.t.toFixed(0) + ' s', 'wing', F.minWing.toFixed(2), F.at, 'contacts', F.contacts, F.cWhat || '', F.phases.join('>'));
}
