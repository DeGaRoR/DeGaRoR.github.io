// _skis_bytes.js (SKIS, 13 Nov) - the no-ski witnesses for GATE SKIS: a build without skis, its def, its shakedown
// sheet and 300 flown steps (a settle from the level drop, HOME, the game's three-point stance), digested. Run by the
// gate in a child process per build (the load chain keeps state across builds), and in a BASE worktree with --bless to
// write tools/fixtures/skis/base.json (the core before the skis: "absent is as today", to the bit).
//   node tools/_skis_bytes.js <build.json> [--floats]      -> one JSON line { def, sh, sim, nodes }
'use strict';
const path = require('path'), crypto = require('crypto');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js')), LB = require(path.join(T, '_load_build.js'));
const dig = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
// (a float's def carries its own back-references: each object written once, its later visits a marker - deterministic)
const safe = o => { const seen = new WeakSet(); return JSON.stringify(o, (k, x) => {
  if (x && typeof x === 'object') { if (seen.has(x)) return '~'; seen.add(x); if (ArrayBuffer.isView(x)) return Array.from(x); }
  return typeof x === 'function' ? undefined : x; }); };
const file = process.argv[2];
const v = Object.values(LB.VALIDATED).find(x => x.build === file);
const spec = v ? LB.loadValidated(Object.keys(LB.VALIDATED).find(k => LB.VALIDATED[k] === v)).spec : LB.loadBuild(file).spec;
const def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
const sh = C.genShakedown(def, { corners: false, slim: true });
const sim = C.makeSim(def, C.makeWorld()); sim.reset(0); if (sim.stance) sim.stance();
for (let k = 0; k < 300; k++) sim.step(1 / 60);
const round = a => Array.from(a, x => +x.toPrecision(15));
console.log(JSON.stringify({ def: dig(safe(def)), sh: dig(safe(sh)), sim: dig(JSON.stringify(round(sim.p))), nodes: def.nodes.length,
                             ski: !!(def.parts && def.parts.ski) || !!(spec.gear && 'ski' in spec.gear) }));
