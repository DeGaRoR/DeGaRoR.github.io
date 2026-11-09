// drag.js <tree>: the drag build-up and mass of the roster
const root = process.argv[2]; process.chdir(root);
const LB = require(root + '/tools/_load_build.js'), C = require(root + '/tools/flight_core.js');
const F = { cub: 'builds/cub_2026-09-20_corrected.json', c172: 'builds/cessna172_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  chinook: 'builds/chinook_2026-09-21_corrected.json', pa18f: 'builds/pa18_floats_2026-10-23.json', dc3: 'builds/candidates/dc3_2026-10.json',
  stearman: 'builds/candidates/stearman_2026-10.json', tiger: 'builds/candidates/tigermoth_2026-10.json', camel: 'builds/candidates/camel_2026-10.json',
  ss: 'builds/candidates/carbon_cub_ss.json' };
for (const [k, f] of Object.entries(F)) {
  const r = LB.loadBuild(f); const S = r.spec, d = C.buildGen(S); const P = d.params || {}, gn = P.gen || {}, g = Object.assign({}, gn.drag || {}, { gear: gn.gearDCdA, brace: gn.braceDCdA, tb: gn.tailBraceDCdA });
  const e = (S.engines && S.engines[0]) || {}; const PP = S.pplant || {};
  const fx = v => v == null ? '-' : (+v).toFixed(3);
  console.log(k.padEnd(9), 'body', fx(g.body), 'cool', fx(g.cool), 'heads', fx(g.heads), 'scr', fx(g.screen), 'jn', fx(g.junct), 'exh', fx(g.exh), 'gear', fx(g.gear), 'brace', fx(g.brace),
    'tb', fx(g.tb), 'kg', Math.round(gn.mass||0), '| layout', ((S.pplant||C.POWERPLANTS[e.type]||{}).engine||{}).layout, 'cowlOn', S.cage && S.cage.cowlOn, 'cowl.on', S.cowl && S.cowl.on, 'mat', S.material, 'int', S.cage && S.cage.intCons);
}
