#!/usr/bin/env node
// engconfig_fixtures.js (ENGINE-CONFIGS-2, G3493, 2026-10-22) - THE THREE EXAMPLE LAYOUTS as saved builds, baked the
// way the garage makes them: the design tiles over the C172-alike card's choices (without its stock 172 cage, so the
// tiles' own airframe), then the page's chain under node (tools/_bake_joined.js: the drawing layers, the join, the
// merge). Each is balanced to pass the bench's design check at its worst loading corner:
//   pushpull  the Engines row's Push-pull (the Skymaster's layout): two IO-360s, the tail on twin booms outboard of the
//             rear disc; the wing 0.45 m aft and the stab 1.40 x span / 1.25 x chord (the pusher's 144 kg behind the
//             cabin: the card's own wing station left a static margin of -0.16 as drawn)
//   trimotor  Three (nose + wings): three Rotax 912s, a MID strut-braced wing (on the card's high wing the nacelles'
//             thrust line stands 1.5 m up and full power tips the aeroplane over its nosewheel; on a low wing the
//             nacelle discs clear the grass by 2 cm; a cantilever mid wing let go at its root on the bench's 5.7 g),
//             the round section, the wing 0.15 m aft
//   four      Four (wings): four Rotax 912s, inner and outer nacelles, the mid strut-braced wing, 0.2 m aft
//   node tools/engconfig_fixtures.js            rebake and compare with the saved files (exit 1 on a difference)
//   node tools/engconfig_fixtures.js --write    rebake and write tools/fixtures/build_v10_engcfg_*_2026-10-22.json
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const BJ = require('./_bake_joined.js');
const LB = require('./_load_build.js');
const { D } = BJ.loadPanel();
const C172 = D.ARCHETYPES.find(a => a.key === 'c172');
const FIX = {
  pushpull: { name: 'Push-pull (Skymaster layout)', sel: { engCount: 'pushPull', engModel: 'lycoming IO-360' },
              cage: { wgDx: -0.45, stSpan: 1.4, stChord: 1.25 } },
  trimotor: { name: 'Trimotor (three Rotax 912)', sel: { engCount: 3, engModel: 'rotax 912 (flat)', finArch: 'straight', section: 3, wgPos: 1, wgBrace: 0 },
              cage: { wgDx: -0.15 } },
  four:     { name: 'Four (wing nacelles, four Rotax 912)', sel: { engCount: 4, engModel: 'rotax 912 (flat)', finArch: 'straight', wgPos: 1, wgBrace: 0 },
              cage: { wgDx: -0.2 } },
};
const fileOf = k => path.join(T, 'fixtures', `build_v10_engcfg_${k}_2026-10-22.json`);
function bake(k) {
  const F = FIX[k];
  const sel = Object.assign({}, C172.sel, F.sel);
  const over = { cage: Object.assign({}, C172.over && C172.over.cage, F.cage), spec: C172.over && C172.over.spec };
  const r = BJ.bakeJoined(D.designBake(sel, over));
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
