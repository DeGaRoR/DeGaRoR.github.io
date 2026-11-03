#!/usr/bin/env node
// dc3_identity.js - DC3-BUILD (G3501-G3509, cloud, 2026-10-23): ARE THE VALIDATED AEROPLANES BIT-IDENTICAL? A TOOL, not a
// gate. Every DC-3 change in src/core is gated on the build's size / mass, so a build inside today's envelope must take
// today's path to the bit. This proves it the game's way: each validated build through THE PAGE'S LOAD DOOR
// (tools/_load_build.js), then buildGen, then
//   def    sha1 of the built def (nodes, beams, strips, spec, every field) - the generator's whole output
//   sheet  the shakedown's mass / cost ledger and its speeds (genShakedown)
//   cert   sha1 of genCertify(def) without its timings (the bench's per-member limits) - with --cert only (slow)
//   fly20  the game's spawn (reset + stance + 10 s settle + the strip), the pilot flying 20 s from the take-off: sha1 of
//          every node's position and velocity at the end, the pilot's phase and the damage record
//   node tools/dc3_identity.js --out=<file.json> [--cert]     write the fingerprints
//   node tools/dc3_identity.js --cmp=<a.json>,<b.json>          compare two runs (before = master, after = this branch)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const flag = k => argv.includes('--' + k);

const BUILDS = {
  cub: 'builds/cub_2026-09-20_corrected.json',
  jodel: 'builds/jodel_2026-09-20_corrected.json',
  metal: 'bugReports/cessnaMetal (1).json',
  floats: 'bugReports/cessnaFloatsWOrks.json',
  twinFloats: 'twinFloats',
  rufus: 'tools/fixtures/repro/rufus_2026-10-18.json',
};
// a shared or circular object is written once (the floats' def links back to itself); the walk's order is fixed, so the
// hash still is
const sha = x => { const seen = new WeakSet(); return crypto.createHash('sha1').update(JSON.stringify(x, (k, v) =>
  (v && typeof v === 'object' && !ArrayBuffer.isView(v)) ? (seen.has(v) ? '~seen' : (seen.add(v), v)) :
  typeof v === 'function' ? 'fn' : (typeof v === 'number' && !isFinite(v)) ? String(v) :
  (v instanceof Float64Array || v instanceof Float32Array || v instanceof Int32Array || v instanceof Uint8Array) ? Array.from(v) : v)).digest('hex').slice(0, 16); };

function loadSpec(LB, key) {
  if (BUILDS[key] === 'twinFloats') { const V = LB.VALIDATED.twinFloats; return LB.loadBuild(V.build, V.patch).spec; }
  return LB.loadBuild(BUILDS[key]).spec;
}

function fly20(C, def) {
  const world = C.makeWorld();
  const a = world.aerodromes[0];
  const sim = C.makeSim(def, world);
  sim.reset(0); if (typeof sim.stance === 'function') sim.stance();
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  C.placeAtAerodrome(sim, a);
  const ap = C.makePilot(sim, def, world);
  const phases = []; let last = null;
  for (let s = 0; s < 20 * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (ap.phase !== last) { phases.push((s / 60).toFixed(2) + ' ' + ap.phase); last = ap.phase; }
  }
  const cg = sim.cgPos(), v = sim.cgVel();
  const dm = sim.damage ? sim.damage() : null;
  const state = sim.nodes ? sim.nodes.map(n => [n.p, n.v]) : null;
  return { hash: sha({ state, cg, v, phase: ap.phase, dm }), cg: cg.map(x => +x.toFixed(4)), v: v.map(x => +x.toFixed(4)),
    phase: ap.phase, phases, breaks: dm && dm.breaks };
}

function run() {
  const LB = require('./_load_build.js');
  const C = require('./flight_core.js');
  const out = {};
  const only = opt('only', null);
  for (const key of Object.keys(BUILDS)) {
    if (only && !only.split(',').includes(key)) continue;
    const spec = loadSpec(LB, key);
    const def = C.buildGen(JSON.parse(JSON.stringify(spec)));
    const sh = C.genShakedown(def);
    let m = 0; for (const n of def.nodes) m += n.m;
    const r = { def: sha(def), nodes: def.nodes.length, beams: def.beams.length, mass: m,
      ledger: sha(sh.ledger || null), price: sh.cost, empty: sh.empty,
      sheet: sha({ Vs: sh.Vs, VsFlap: sh.VsFlap, VAppr: sh.VAppr, VCruise: sh.VCruise, climb: sh.climbRate, TORun: sh.TORun, SM: sh.staticMargin }) };
    // (the certificate without its wall-clock timings, `ms`: the rest is the bench's numbers)
    if (flag('cert')) { const c = Object.assign({}, C.genCertify(def)); delete c.ms; r.cert = sha(c); }
    r.fly20 = fly20(C, def);
    out[key] = r;
    console.log(key.padEnd(11) + ' def ' + r.def + '  ' + r.nodes + 'n/' + r.beams + 'b  ' + m.toFixed(3) + ' kg  ledger ' + r.ledger +
      ' (' + r.price + ')  sheet ' + r.sheet + (r.cert ? '  cert ' + r.cert : '') + '  fly20 ' + r.fly20.hash + ' ' + r.fly20.phase + ' breaks ' + r.fly20.breaks);
  }
  if (opt('out', null)) fs.writeFileSync(opt('out'), JSON.stringify(out, null, 1) + '\n');
  return out;
}

function cmp(a, b) {
  const A = JSON.parse(fs.readFileSync(a, 'utf8')), B = JSON.parse(fs.readFileSync(b, 'utf8'));
  let bad = 0;
  for (const k of Object.keys(A)) {
    const x = A[k], y = B[k];
    if (!y) { console.log(k + ': missing in ' + b); bad++; continue; }
    const rows = ['def', 'ledger', 'sheet', 'cert'].filter(f => x[f] != null && y[f] != null).map(f => [f, x[f], y[f]]);
    rows.push(['mass', x.mass, y.mass], ['fly20', x.fly20.hash, y.fly20.hash]);
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
