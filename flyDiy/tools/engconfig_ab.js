#!/usr/bin/env node
// engconfig_ab.js (ENGINE-CONFIGS-2, G3492, 2026-10-22) - ONE LINE PER VALIDATED AEROPLANE: its thrust and its flight,
// digested, so a change that must not move them is shown not to by running this once on master and once on the branch
// and comparing the lines (the user, 22 Oct: "the validated aircraft must be byte-identical in thrust and flight").
//
//   node tools/engconfig_ab.js cub|jodel|metal|floats|rufus      (one JSON line)
//
// The aeroplane is the one the GAME flies (tools/_load_build.js: the page's load door, the join, the merge); then
//   spec    the joined spec's digest
//   def     the built def (nodes, beams, params, refs, strips)
//   thrust  the static thrust (Tstatic x nEngines, N) and a digest of out.thrust and out.thrustPer every frame
//   flight  the autopilot from the runway for 90 s (the take-off and the climb-out): a digest of every node's position
//           once a second and the bytes of the final state; alt / V / phase at the end, to read
// Digests are sha1 of the raw Float64 bytes (no rounding): equal lines are the same bits.
'use strict';
const path = require('path'), crypto = require('crypto');
const T = __dirname;
const LB = require('./_load_build.js');
const C = require('./flight_core.js');
const FILES = {
  cub: LB.VALIDATED.cub.build, jodel: LB.VALIDATED.jodel.build, metal: LB.VALIDATED.metal.build, floats: LB.VALIDATED.floats.build,
  rufus: 'tools/fixtures/repro/rufus_2026-10-18_certified.json',
};
const key = process.argv[2];
if (!FILES[key]) { console.error('usage: node tools/engconfig_ab.js ' + Object.keys(FILES).join('|')); process.exit(2); }
const sha = () => crypto.createHash('sha1');
const hJ = o => sha().update(JSON.stringify(o, (k, v) => typeof v === 'number' && !isFinite(v) ? String(v) : v)).digest('hex').slice(0, 16);
const r = LB.loadBuild(FILES[key]);
const spec = r.spec, def = C.buildGen(JSON.parse(JSON.stringify(spec)));
const PR = def.params.prop || C.POWERPLANTS[def.params.powerplant].prop;
const W = C.makeWorld(), sim = C.makeSim(def, W); sim.reset(0);
const ap = C.makePilot(sim, def, W);
const hT = sha(), hF = sha(), o = sim.out, one = new Float64Array(1);
for (let f = 0; f < 60 * 90; f++) {
  ap.update(1 / 60); sim.step(1 / 60);
  one[0] = o.thrust; hT.update(Buffer.from(one.buffer));
  hT.update(Buffer.from(Float64Array.from(o.thrustPer).buffer));
  if (f % 60 === 59) hF.update(Buffer.from(sim.p.buffer, sim.p.byteOffset, sim.p.byteLength));
}
console.log(JSON.stringify({
  build: key, spec: hJ(spec), def: hJ({ nodes: def.nodes, beams: def.beams, params: def.params, refs: def.refs, strips: def.strips }),
  thrust: { static: +(PR.Tstatic * (def.params.nEngines || 1)).toFixed(3), run: hT.digest('hex').slice(0, 16) },
  flight: { p: hF.digest('hex').slice(0, 16), alt: +o.alt.toFixed(3), V: +o.V.toFixed(3), phase: ap.phase },
}));
