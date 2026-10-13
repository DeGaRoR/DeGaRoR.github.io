#!/usr/bin/env node
// G2364 (DMG-MOUNTRIG): THE STEP'S COST - a validated build parked on the flat world, damage off (the game's default) and
// on (the certificate stamped), ms per frame (60 Hz, the build's own substeps) over `frames` frames after a settle. Run
// on two trees alternately (the shell's loop) so a busy machine loads both alike.
//   node tools/dmg_mountrig_perf.js <build> [frames=1200]  -> one JSON line
'use strict';
process.env.FLYDIY_CERT = '1';
const L = require('./_treecrash_lib.js'), C = L.core();
const k = process.argv[2] || 'metal', FR = +(process.argv[3] || 1200), out = { k };
for (const dmg of [false, true]) {
  const def = L.defOf(k, dmg ? { cert: true } : { elastic: true, cert: false });
  const { W, strip } = L.flatWorld(0), sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 }));
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  const t0 = process.hrtime.bigint(); for (let f = 0; f < FR; f++) sim.step(1 / 60);
  out[dmg ? 'msOn' : 'msOff'] = Number(process.hrtime.bigint() - t0) / 1e6 / FR;
  out.nb = def.beams.length; out.sub = def.params.substeps;
}
console.log(JSON.stringify(out));
