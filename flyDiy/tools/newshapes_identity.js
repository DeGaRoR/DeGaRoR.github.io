#!/usr/bin/env node
// newshapes_identity.js - NEW-SHAPES-1 (G3510-G3519, cloud, 2026-10-26): ARE THE VALIDATED AEROPLANES BIT-IDENTICAL? A
// TOOL, not a gate (the DC3-BUILD tool's method, tools/dc3_identity.js, with the drawing and the keys added). Each
// validated build goes through THE PAGE'S LOAD DOOR of the tree under test (--root, default this tree:
// <root>/tools/_load_build.js, the editor's layers drawing it headless, the join, the energy write-back), then
// <root>/tools/flight_core.js's buildGen:
//   spec   sha1 of the spec the game flies (every cage row the editor states: a new row that leaks shows here first)
//   def    sha1 of the built def (nodes, beams, strips, spec, every field)
//   draw   FNV-1a over every mesh the editor's layers drew (tools/_draw_hash_probe.js: names, materials, matrices,
//          positions, normals, indices)
//   keys   the certificate store's key (genCertKey), the procurement's fingerprint (procureFp)
//   ledger the shakedown's mass / cost ledger + the price, the sheet's speeds, the design check's rows
//   fly20  the game's spawn (reset + stance + 10 s settle + the strip), the pilot flying 20 s from the take-off: sha1 of
//          every node's position and velocity, the phase and the damage record
//   node tools/newshapes_identity.js [--root=<tree>/flyDiy] --out=<file.json>
//   node tools/newshapes_identity.js --cmp=<a.json>,<b.json>
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const ROOT = path.resolve(opt('root', path.join(__dirname, '..')));
const PROBE = path.join(__dirname, '_draw_hash_probe.js');

const BUILDS = {
  cub: 'builds/cub_2026-09-20_corrected.json',
  jodel: 'builds/jodel_2026-09-20_corrected.json',
  metal: 'bugReports/cessnaMetal (1).json',
  floats: 'bugReports/cessnaFloatsWOrks.json',
  twinFloats: 'twinFloats',
  rufus: 'tools/fixtures/repro/rufus_2026-10-18.json',
};
const sha = x => { const seen = new WeakSet(); return crypto.createHash('sha1').update(JSON.stringify(x, (k, v) =>
  (v && typeof v === 'object' && !ArrayBuffer.isView(v)) ? (seen.has(v) ? '~seen' : (seen.add(v), v)) :
  typeof v === 'function' ? 'fn' : (typeof v === 'number' && !isFinite(v)) ? String(v) :
  (v instanceof Float64Array || v instanceof Float32Array || v instanceof Int32Array || v instanceof Uint8Array) ? Array.from(v) : v)).digest('hex').slice(0, 16); };

function fly20(C, def) {
  const world = C.makeWorld();
  const a = world.aerodromes[0];
  const sim = C.makeSim(def, world);
  sim.reset(0); if (typeof sim.stance === 'function') sim.stance();
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  C.placeAtAerodrome(sim, a);
  const ap = C.makePilot(sim, def, world);
  let last = null; const phases = [];
  for (let s = 0; s < 20 * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (ap.phase !== last) { phases.push((s / 60).toFixed(2) + ' ' + ap.phase); last = ap.phase; }
  }
  const cg = sim.cgPos(), v = sim.cgVel();
  const dm = sim.damage ? sim.damage() : null;
  const state = sim.nodes ? sim.nodes.map(n => [n.p, n.v]) : null;
  return { hash: sha({ state, cg, v, phase: ap.phase, dm }), phase: ap.phase, phases, breaks: dm && dm.breaks };
}

function run() {
  process.env.FLYDIY_JOIN_PROBE = PROBE;
  process.env.FLYDIY_JOIN_NOCACHE = '1';
  const LB = require(path.join(ROOT, 'tools', '_load_build.js'));
  const C = require(path.join(ROOT, 'tools', 'flight_core.js'));
  const out = {};
  const only = opt('only', null);
  for (const key of Object.keys(BUILDS)) {
    if (only && !only.split(',').includes(key)) continue;
    const L = BUILDS[key] === 'twinFloats' ? LB.loadBuild(LB.VALIDATED.twinFloats.build, { patch: LB.VALIDATED.twinFloats.patch })
      : LB.loadBuild(BUILDS[key]);
    const spec = L.spec;
    const def = C.buildGen(JSON.parse(JSON.stringify(spec)));
    const sh = C.genShakedown(def, { corners: true });
    let m = 0; for (const n of def.nodes) m += n.m;
    const dc = sh.design ? sh.design.rows.map(r => r.id + '=' + r.value + ':' + r.level) : null;
    const r = { spec: sha(spec), def: sha(def), draw: L.probe, nodes: def.nodes.length, beams: def.beams.length, mass: m,
      certKey: C.genCertKey ? C.genCertKey(def) : null, procureFp: C.procureFp ? C.procureFp(spec) : null,
      ledger: sha(sh.ledger || null), price: sh.cost, empty: sh.empty, design: sha(dc), joinErrors: (L.errors || []).length,
      sheet: sha({ Vs: sh.Vs, VsFlap: sh.VsFlap, VAppr: sh.VAppr, VCruise: sh.VCruise, climb: sh.climbRate, TORun: sh.TORun, SM: sh.staticMargin }) };
    r.fly20 = fly20(C, def);
    out[key] = r;
    console.log(key.padEnd(11) + ' spec ' + r.spec + ' def ' + r.def + ' draw ' + JSON.stringify(r.draw) + ' ' + r.nodes + 'n/' + r.beams + 'b ' +
      m.toFixed(3) + ' kg ledger ' + r.ledger + ' (' + r.price + ') sheet ' + r.sheet + ' design ' + r.design + ' certKey ' + r.certKey +
      ' procure ' + r.procureFp + ' fly20 ' + r.fly20.hash + ' ' + r.fly20.phase + ' breaks ' + r.fly20.breaks + ' joinErr ' + r.joinErrors);
  }
  if (opt('out', null)) fs.writeFileSync(opt('out'), JSON.stringify({ root: ROOT, builds: out }, null, 1) + '\n');
  return out;
}

function cmp(a, b) {
  const A = JSON.parse(fs.readFileSync(a, 'utf8')).builds, B = JSON.parse(fs.readFileSync(b, 'utf8')).builds;
  let bad = 0;
  for (const k of Object.keys(A)) {
    const x = A[k], y = B[k];
    if (!y) { console.log(k + ': missing in ' + b); bad++; continue; }
    const rows = ['spec', 'def', 'ledger', 'price', 'sheet', 'design', 'certKey', 'procureFp', 'mass', 'nodes', 'beams']
      .map(f => [f, x[f], y[f]]);
    rows.push(['draw', JSON.stringify(x.draw), JSON.stringify(y.draw)], ['fly20', x.fly20.hash, y.fly20.hash]);
    const diff = rows.filter(r => r[1] !== r[2]);
    bad += diff.length;
    console.log(k.padEnd(11) + (diff.length ? 'DIFFERS: ' + diff.map(r => r[0] + ' ' + r[1] + ' -> ' + r[2]).join('; ') :
      'IDENTICAL (' + rows.map(r => r[0] + ' ' + r[1]).join(', ') + ')'));
  }
  console.log(bad ? 'IDENTITY: ' + bad + ' DIFFERENCES' : 'IDENTITY: ALL IDENTICAL');
  process.exitCode = bad ? 1 : 0;
}

if (require.main === module) {
  if (opt('cmp', null)) { const [a, b] = opt('cmp').split(','); cmp(a, b); }
  else run();
}
module.exports = { BUILDS, sha, fly20 };
