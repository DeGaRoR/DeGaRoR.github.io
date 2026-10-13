#!/usr/bin/env node
// tanks_float_dry.js - G1385 TANKS-FLOAT: NOTHING RUNS IN DRY AIR. One flight core (this tree's, or another checkout's
// via --core <path to tools/flight_core.js>) flies the user's Cub and the metal Cessna through three dry cases and
// prints a sha1 of every node's position (float64 bits) at the end of each:
//   strip  - 5 s at rest on HOME's stand (placeAtAerodrome), engine as built;
//   air    - 15 s at 30 m/s (throttle 0.6), 600 m over HOME;
//   sea    - 15 s at 30 m/s, 600 m over the SEA lane (over water, but no frame can reach it).
//   water  - (the floats) 20 s on the SEA lane at throttle 0.3: the float pass alone, master's to the bit.
// Plus whether the wet body was built (it must not be) and the mean sim.step(1/60) wall time over the air case.
// Run it on master's core, the base's and this branch's: the hashes must agree to the bit.
// Usage: node tools/tanks_float_dry.js [--core path/to/flight_core.js] [--builds cub,metal,floats] [--json]
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const C = require(path.resolve(opt('core', path.join(__dirname, 'flight_core.js'))));
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json',
                 jodel: 'builds/jodel_2026-09-20_corrected.json', floats: 'bugReports/cessnaFloatsWOrks.json' };
const WANT = opt('builds', 'cub,metal,floats').split(',');
const world = C.makeWorld();
const hashP = p => crypto.createHash('sha1').update(Buffer.from(new Float64Array(p).buffer)).digest('hex').slice(0, 16);
const out = {};
for (const b of WANT) {
  // G1985 (JOIN-PARITY): as the game flies it (tools/_load_build.js)
  const def = C.buildGen(require('./_load_build.js').loadBuild(path.join(ROOT, BUILDS[b] || b)).spec);
  const res = {};
  const fly = (apId, lift, secs, timed, thr) => {
    const sim = C.makeSim(def, world); sim.reset(0);
    C.placeAtAerodrome(sim, world.aerodromes.find(a => a.id === apId));
    if (thr != null) sim.ctl.thr = thr;
    if (lift) {
      const [xA] = sim.axes(), hl = Math.hypot(xA[0], xA[2]), n = def.nodes.length;
      for (let i = 0; i < n; i++) { sim.p[i * 3 + 1] += lift; sim.v[i * 3] = -30 * xA[0] / hl; sim.v[i * 3 + 1] = 0; sim.v[i * 3 + 2] = -30 * xA[2] / hl; }
      sim.ctl.thr = 0.6;
    }
    let t = 0, clear = Infinity;
    for (let s = 0; s < secs * 60; s++) {
      const t0 = process.hrtime.bigint(); sim.step(1 / 60); t += Number(process.hrtime.bigint() - t0);
      if (lift) { const c = sim.cgPos(), w = world.waterH(c[0], c[2]), g = world.terrainH(c[0], c[2]);
                  clear = Math.min(clear, c[1] - Math.max(w > -1e8 ? w : -Infinity, g)); }
    }
    return { hash: hashP(sim.p), built: sim.wetBody == null ? 'never' : 'BUILT', ms: t / 1e6 / (secs * 60), clear };
  };
  if (b === 'floats') {   // a float build carries no wet body: on the water too it must be master's to the bit
    res.water = fly('SEA', 0, 20, false, 0.3);
    res.air = fly('HOME', 600, 15);
  } else {
    res.strip = fly('HOME', 0, 5);
    res.air = fly('HOME', 600, 15);
    res.sea = fly('SEA', 600, 15);
  }
  out[b] = res;
  if (!argv.includes('--json'))
    for (const k of Object.keys(res)) console.log(`${b.padEnd(6)} ${k.padEnd(6)} ${res[k].hash}  wet body ${res[k].built}  step ${res[k].ms.toFixed(2)} ms${res[k].clear < Infinity ? '  lowest ' + res[k].clear.toFixed(0) + ' m over the surface' : ''}`);
}
if (argv.includes('--json')) console.log(JSON.stringify(out));
