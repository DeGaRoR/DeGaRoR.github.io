// G2640: the overlay stills, every build, into <out>/<prefix>_<key>.png (run from a flyDiy root)
const path = require('path'), fs = require('fs');
const [outDir, prefix] = process.argv.slice(2);
const SH = require(path.resolve('tools/_geoparity_shot.js'));
const floats = s => { s.gear.type = 'floats'; s.cage = Object.assign({}, s.cage, { gearFloats: 1 }); };
const B = [
  ['cub', 'builds/cub_2026-09-20_corrected.json'], ['jodel', 'builds/jodel_2026-09-20_corrected.json'],
  ['cessna', 'bugReports/cessnaMetal (1).json'], ['twinFloats', 'tools/fixtures/build_v7_ultralight_2026-09-05.json', floats],
  ['mosquito2', 'tools/fixtures/repro/mosquito_2.json'], ['mosquito3', 'tools/fixtures/repro/mosquito_3.json'],
  ['cub_finSwept25', 'builds/cub_2026-09-20_corrected.json', s => { s.cage.finSweep = 25; }],
];
for (const [k, f, p] of B) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8')); const s = j.spec || j; if (p) p(s);
  const r = SH.shoot(s, path.join(outDir, prefix + '_' + k + '.png'));
  const w = r.worst, g = x => x ? `${x.mx.toFixed(3)}/${x.mh.toFixed(3)}` : '-';
  console.log(prefix, k.padEnd(15), 'mean dx/dh  wing', g(w.wing), 'stab', g(w.stab), 'fin', g(w.fin));
}
