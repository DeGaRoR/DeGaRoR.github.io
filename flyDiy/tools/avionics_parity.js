#!/usr/bin/env node
// AVIONICS-GPS phase 2 (G2801-G2809): THE VALIDATED AEROPLANES FLY AS THEY DID.
// One node line per validated save (Cub, Jodel, Cessna 172, Rufus): the airframe the solver flies
// (every node's mass and position, every beam, the ledger's mass) hashed twice, from the saved spec
// as the game flies it and re-joined through the editor's chain (tools/_bake_joined.js), plus a
// 20 s hands-off flight from the strip on the solver (the CG path hashed). The fixture is the
// master tree's numbers (captured with --capture on origin/master before any G280x change);
// a line that differs is a validated aeroplane that changed in flight.
//   node tools/avionics_parity.js            compare against tools/fixtures/avionics_parity.json
//   node tools/avionics_parity.js --capture  write the fixture from this tree
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const FIX = path.join(T, 'fixtures', 'avionics_parity.json');
const BUILDS = {
  cub: 'builds/cub_2026-09-20_corrected.json',
  jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json',
  rufus: 'builds/rufus_2026-10-18_certified.json',
};
const h = () => crypto.createHash('sha256');
function defHash(def) {
  const H = h();
  const f = new Float64Array(7);
  for (const n of def.nodes) { f[0] = n.m; f[1] = n.p[0]; f[2] = n.p[1]; f[3] = n.p[2]; f[4] = n.mFuel || 0; f[5] = n.r || 0; f[6] = 0;
                               H.update(Buffer.from(f.buffer)); }
  for (const b of def.beams) H.update(b.a + ',' + b.b + ',' + (+b.k || 0) + ',' + (+b.c || 0) + ';');
  return H.digest('hex').slice(0, 16);
}
function ledgerSum(def) {
  const L = (def.parts && def.parts.ledger) || {};
  let empty = 0, cost = 0;
  for (const k in L) { if (!L[k].payload) empty += L[k].mass; cost += L[k].cost || 0; }
  return { empty: +empty.toFixed(6), cost: Math.round(cost) };
}
// 20 s on the solver from rest in the air, controls fixed: the CG path, hashed
function flyHash(def) {
  const sim = C.makeSim(def);
  if (sim.reset) sim.reset(0);
  const H = h(), cg = new Float64Array(3);
  const n = sim.n, v = sim.v;
  for (let i = 0; i < n; i++) { v[i * 3] = -30; v[i * 3 + 1] += 0; }
  for (let i = 0; i < n; i++) sim.p[i * 3 + 1] += 300;
  if (sim.ctl) { sim.ctl.thr = 0.7; }
  for (let s = 0; s < 20 * 60; s++) {
    sim.step(1 / 60);
    if (s % 30 === 0) { const c = sim.cgPos(); cg[0] = c[0]; cg[1] = c[1]; cg[2] = c[2]; H.update(Buffer.from(cg.buffer)); }
  }
  const c = sim.cgPos();
  return { hash: H.digest('hex').slice(0, 16), cg: c.map(x => +x.toFixed(4)) };
}
function measure(key) {
  const file = JSON.parse(fs.readFileSync(path.join(T, '..', BUILDS[key]), 'utf8'));
  const spec = file.spec || file;
  const def = C.buildGen(JSON.parse(JSON.stringify(spec)));
  const out = { def: defHash(def), ledger: ledgerSum(def), fly: flyHash(def) };
  try {
    const BJ = require(path.join(T, '_bake_joined.js'));
    BJ.loadPanel();
    const J = BJ.bakeJoined(spec);
    const defJ = C.buildGen(JSON.parse(JSON.stringify(J.spec)));
    out.joined = defHash(defJ);
    out.joinedLedger = ledgerSum(defJ);
  } catch (e) { out.joined = 'ERR ' + e.message; }
  return out;
}
const R = {};
for (const k of Object.keys(BUILDS)) R[k] = measure(k);
if (process.argv.includes('--capture')) {
  fs.mkdirSync(path.dirname(FIX), { recursive: true });
  fs.writeFileSync(FIX, JSON.stringify(R, null, 1) + '\n');
  for (const k in R) console.log(k.padEnd(7) + ' captured ' + JSON.stringify(R[k]));
  process.exit(0);
}
const REF = JSON.parse(fs.readFileSync(FIX, 'utf8'));
let bad = 0;
for (const k in R) {
  const a = R[k], b = REF[k] || {};
  const same = a.def === b.def && a.fly.hash === b.fly.hash && a.joined === b.joined &&
               a.ledger.empty === b.ledger.empty && a.ledger.cost === b.ledger.cost;
  if (!same) bad++;
  console.log(k.padEnd(7) + (same ? ' SAME ' : ' DIFF ') + 'airframe ' + a.def + ' (master ' + b.def + ')  joined ' + a.joined +
              ' (master ' + b.joined + ')  20 s flight ' + a.fly.hash + ' cg ' + a.fly.cg.join(',') + ' (master ' + (b.fly && b.fly.hash) +
              ')  empty ' + a.ledger.empty.toFixed(3) + ' kg / ' + a.ledger.cost + ' cr (master ' + (b.ledger && b.ledger.empty.toFixed(3)) + ' / ' + (b.ledger && b.ledger.cost) + ')');
}
console.log('AVIONICS PARITY: ' + (bad ? bad + ' aeroplane(s) changed' : 'the four validated aeroplanes unchanged'));
process.exit(bad ? 1 : 0);
