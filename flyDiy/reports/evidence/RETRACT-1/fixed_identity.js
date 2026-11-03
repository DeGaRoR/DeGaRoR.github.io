// the same circuits on two cores: argv[2] the flyDiy root; prints a hash per build and profile
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const R = process.argv[2], T = path.join(R, 'tools');
const C = require(path.join(T, 'flight_core.js')), LB = require(path.join(T, '_load_build.js'));
const files = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  metal: 'tools/fixtures/build_v10_cessnaMetal_2026-09-26.json', floats: 'builds/pa18_floats_2026-10-23.json' };
const out = [];
for (const k of Object.keys(files)) for (const prof of [undefined, 'club', 'student']) {
  const raw = JSON.parse(fs.readFileSync(path.join(R, files[k]), 'utf8'));
  const s = LB.gameSpec(raw); const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(s) : s);
  def.params = Object.assign({}, def.params, { damage: true });
  const W = C.makeWorld(), sim = C.makeSim(def, W); sim.reset(0);
  for (let i = 0; i < 300; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, W, prof ? { profile: prof } : undefined);
  for (let i = 0; i < 150 * 60; i++) { ap.update(1 / 60); sim.step(1 / 60); }
  const h = crypto.createHash('sha1').update(Buffer.from(new Float64Array(sim.p).buffer)).update(JSON.stringify(sim.ctl)).update(ap.phase).digest('hex').slice(0, 12);
  out.push(k + '/' + (prof || 'expert') + ' ' + ap.phase + ' ' + h);
}
console.log(out.join('\n'));
