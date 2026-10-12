#!/usr/bin/env node
// G2480 HAND-CONTROLS: THE AUTOPILOT IS BIT-IDENTICAL WHEN THE HAND IS NOT FLYING. Flies THE PILOT from a stand / the sea
// lane on the analytic world for N seconds with the core and the cage kits of the tree at ROOT, and prints an FNV hash
// of every node's p and v each 10 s - run it on two trees and diff the lines:
//   node tools/hand_controls_apsame.js [ROOT=..] [secs=180]
'use strict';
const path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const SECS = +(process.argv[3] || 180);
const L = require(path.join(ROOT, 'tools', '_treecrash_lib.js'));
const C = L.core();
const fnv = (...arrs) => { let h = 2166136261; for (const a of arrs) { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0; } return h.toString(16); };
for (const [key, from] of [['cub', 'HOME'], ['jodel', 'HOME'], ['metal', 'HOME'], ['floats', 'SEA'], ['twinFloats', 'SEA']]) {
  const def = L.defOf(key, { elastic: true });
  const world = C.makeWorld();
  const sim = C.makeSim(def, world); sim.reset(0);
  const a = world.aerodromes.find(q => q.id === from);
  const site = C.siteOf ? C.siteOf(a.id) : null;
  if (typeof sim.stance === 'function') sim.stance();
  if (site && site.stand && !def.parts.floats) { C.placeAtStand(sim, a, site.stand); }
  else C.placeAtAerodrome(sim, a);
  const ap = C.makePilot(sim, def, world);
  ap.setRoute(a, a); if (site && site.stand && !def.parts.floats) ap.departFrom(a, a, site);
  const line = [];
  for (let k = 1; k <= SECS * 60; k++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (k % 600 === 0) line.push(fnv(sim.p, sim.v));
  }
  console.log(key.padEnd(11) + ' ' + ap.phase.padEnd(9) + ' ' + line.join(' '));
}
