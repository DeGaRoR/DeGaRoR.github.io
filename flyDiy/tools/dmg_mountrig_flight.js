#!/usr/bin/env node
// G2364 (DMG-MOUNTRIG): THE FLIGHT DOES NOT MOVE - the validated builds as the game flies them, the damage layer OFF (the
// game's default), through what a pilot sees: parked 10 s (the settle), a FAR 23.473 landing (TREECRASH's hardLanding at
// the build's own limit sink, onto the water for a floatplane), a whole circuit with the pilot (TREECRASH's circuit), and
// a take-off run to the lift-off (the pilot's own, from the circuit). Each run's MD5 of the state (p, v) and its numbers;
// run on two trees and diff them (--diff a.json b.json). Bit-identical cannot be expected where the rig changed (new nodes
// and members): the deltas are the evidence.
'use strict';
const fs = require('fs'), crypto = require('crypto');
const argv = process.argv.slice(2);
if (argv[0] === '--diff') {
  const A = JSON.parse(fs.readFileSync(argv[1], 'utf8')), B = JSON.parse(fs.readFileSync(argv[2], 'utf8'));
  for (const k of Object.keys(A)) { const a = A[k], b = B[k]; if (!b) continue; console.log('== ' + k);
    for (const run of Object.keys(a)) { const ra = a[run], rb = b[run]; const keys = Object.keys(ra).filter(x => x !== 'hash');
      console.log('  ' + run.padEnd(9) + ' md5 ' + ra.hash + ' -> ' + rb.hash + (ra.hash === rb.hash ? ' (bit-identical)' : '') + '  '
        + keys.map(x => x + ' ' + (typeof ra[x] === 'number' ? ra[x].toFixed(4) + ' -> ' + rb[x].toFixed(4) + ' (' + (rb[x] - ra[x] >= 0 ? '+' : '') + (rb[x] - ra[x]).toExponential(2) + ')' : ra[x] + ' -> ' + rb[x])).join(', ')); } }
  process.exit(0);
}
const L = require('./_treecrash_lib.js'), C = L.core();
const md5 = sim => crypto.createHash('md5').update(Buffer.from(sim.p.buffer)).update(Buffer.from(sim.v.buffer)).digest('hex').slice(0, 12);
const out = {}, only = argv.filter(a => !a.startsWith('--'));
for (const k of Object.keys(L.BUILDS)) { if (only.length && !only.includes(k)) continue;
  const o = { elastic: true }, R = out[k] = {};
  { const def = L.defOf(k, o), probe = C.makeSim(def, null); let sim;
    if (probe.hydro) { const W = C.makeWorld(); sim = C.makeSim(def, W); sim.reset(0); C.placeAtAerodrome(sim, W.aerodromes.find(a => a.id === 'SEA')); }
    else { const { W, strip } = L.flatWorld(0); sim = C.makeSim(def, W); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 })); }
    for (let f = 0; f < 600; f++) sim.step(1 / 60);
    const c = sim.cgPos(); R.parked = { hash: md5(sim), cgY: c[1], pitchDeg: Math.asin(sim.axes()[0][1]) * 180 / Math.PI }; }
  { const h = L.hardLanding(k, Object.assign({ sink: L.far473(k) }, o)); R.land473 = { hash: md5(L.lastRun.sim), gMax: h.gMax }; }
  { const c = L.circuit(k, o), sim = L.lastRun.sim; R.circuit = { hash: md5(sim), outcome: String(c.outcome), t: c.t, nzMax: c.nzMax, phases: c.phases.length }; }
}
console.log(JSON.stringify(out));
