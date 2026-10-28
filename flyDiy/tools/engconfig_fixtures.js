#!/usr/bin/env node
// engconfig_fixtures.js (ENGINE-CONFIGS-2, G3493, 2026-10-22) - THE THREE EXAMPLE LAYOUTS as saved builds, baked the
// way the garage makes them: the archetype card (tools/_cage_design.js ARCHETYPES - the user, 27 Oct: the layout
// starters are cards in the New aeroplane dialog, and the files are those cards), then the page's chain under node
// (tools/_bake_joined.js: the drawing layers, the join, the merge). Each card says why it is balanced as it is; each
// passes the bench's design check at its worst loading corner:
//   pushpull  the Push-pull starter: two IO-360s, the tail on twin booms outboard of the rear disc
//   trimotor  the Trimotor: nose + wing nacelles, three Rotax 912s, a mid strut-braced wing
//   four      the Four-engine starter: four Rotax 912s, inner and outer nacelles, a mid strut-braced wing
//   node tools/engconfig_fixtures.js            rebake and compare with the saved files (exit 1 on a difference)
//   node tools/engconfig_fixtures.js --write    rebake and write tools/fixtures/build_v10_engcfg_*_2026-10-22.json
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const BJ = require('./_bake_joined.js');
const LB = require('./_load_build.js');
const { D } = BJ.loadPanel();
const FIX = {
  pushpull: { card: 'pushPull', name: 'Push-pull (Skymaster layout)' },
  trimotor: { card: 'trimotor', name: 'Trimotor (three Rotax 912)' },
  four:     { card: 'fourEngine', name: 'Four (wing nacelles, four Rotax 912)' },
};
const fileOf = k => path.join(T, 'fixtures', `build_v10_engcfg_${k}_2026-10-22.json`);
function bake(k) {
  const F = FIX[k], a = D.ARCHETYPES.find(q => q.key === F.card);
  const r = BJ.bakeJoined(D.designBake(a.sel, a.over));
  // ...and then what the GAME holds once it has loaded that (tools/_load_build.js: the load door, the join, the
  // energy layer's tank write-back), until it no longer moves: the file is the game's own fixpoint, so opening it in
  // the garage changes nothing (GATE ENGCONFIG 9 checks it)
  let spec = r.spec, errors = r.errors.slice();
  for (let i = 0; i < 4; i++) {
    const g = LB.gameSpecFull({ spec });
    errors = errors.concat(g.errors || []);
    if (JSON.stringify(g.spec) === JSON.stringify(spec)) break;
    spec = g.spec;
  }
  return { what: 'flydiy-build', v: 10, name: F.name, errors, spec };
}
module.exports = { FIX, fileOf, bake };
if (require.main === module) {
  const write = process.argv.includes('--write');
  let bad = 0;
  for (const k of Object.keys(FIX)) {
    const b = bake(k), env = { what: b.what, v: b.v, name: b.name, spec: b.spec };
    const txt = JSON.stringify(env, null, 1) + '\n';
    if (b.errors.length) { bad++; console.log(`${k}: the join says ${b.errors.join('; ')}`); }
    if (write) { fs.writeFileSync(fileOf(k), txt); console.log(`${k}: wrote ${path.relative(path.join(T, '..'), fileOf(k))}`); }
    else {
      const same = fs.existsSync(fileOf(k)) && fs.readFileSync(fileOf(k), 'utf8') === txt;
      if (!same) bad++;
      console.log(`${k}: ${same ? 'the saved file is the bake' : 'DIFFERS from the saved file (run --write after a deliberate change)'}`);
    }
  }
  process.exitCode = bad ? 1 : 0;
}
