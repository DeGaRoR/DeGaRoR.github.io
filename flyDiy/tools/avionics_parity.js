#!/usr/bin/env node
// AVIONICS-GPS phase 2 (G2801-G2809): THE VALIDATED AEROPLANES FLY AS THEY DID.
// One node line per validated save (the shipped set - Cub, Jodel, metal Cessna, Cessna floats, twin floatplane - and the
// Cessna 172 and Rufus): the airframe the solver flies
// (every node's mass and position, every beam, the ledger's mass) hashed three times - the saved spec
// as written, THE GAME'S (tools/_load_build.js: the page's own load chain, GATE JOINPARITY's one load
// path - the aeroplane the game flies) and re-joined through the card bake (tools/_bake_joined.js) -
// plus a 20 s flight on the solver of the game's airframe (the CG path hashed). The fixture was the
// master tree's numbers through G2807 (every validated aeroplane identical); G2808-G2809 (the user,
// 25 Oct: "Wysiwyg, and as billed for all") moved every one on purpose - the before / after is in
// HANDOVER (tools/avionics_bill_table.js reproduces it) - and the fixture is now re-captured on that
// branch: a line that differs is a validated aeroplane that changed since.
//   node tools/avionics_parity.js            compare against tools/fixtures/avionics_parity.json
//   node tools/avionics_parity.js --capture  write the fixture from this tree
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const LB = require(path.join(T, '_load_build.js'));
const FIX = path.join(T, 'fixtures', 'avionics_parity.json');
// THE SHIPPED VALIDATED SET (tools/_load_build.js VALIDATED: the Cub, the Jodel, the metal Cessna, the Cessna floats,
// the twin floatplane - the twin through its own float patch) and the brief's two more (the Cessna 172, Rufus)
const BUILDS = {};
for (const [k, v] of Object.entries(LB.VALIDATED)) BUILDS[k] = { file: v.build, patch: v.patch || null };
BUILDS.cessna172 = { file: 'builds/cessna172_2026-09-20_corrected.json', patch: null };
BUILDS.rufus = { file: 'builds/rufus_2026-10-18_certified.json', patch: null };
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
  const B = BUILDS[key];
  let file = JSON.parse(fs.readFileSync(path.join(T, '..', B.file), 'utf8'));
  if (B.patch) file = B.patch(file);
  const spec = file.spec || file;
  const def = C.buildGen(JSON.parse(JSON.stringify(spec)));
  const game = C.buildGen(JSON.parse(JSON.stringify(LB.loadBuild(B.file, { patch: B.patch || undefined }).spec)));
  const out = { def: defHash(def), game: defHash(game), ledger: ledgerSum(game), fly: flyHash(game) };
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
  const same = a.def === b.def && a.game === b.game && a.fly.hash === b.fly.hash && a.joined === b.joined &&
               a.ledger.empty === b.ledger.empty && a.ledger.cost === b.ledger.cost;
  if (!same) bad++;
  console.log(k.padEnd(7) + (same ? ' SAME ' : ' DIFF ') + 'game ' + a.game + ' (master ' + b.game + ')  saved ' + a.def + ' (master ' + b.def + ')  joined ' + a.joined +
              ' (master ' + b.joined + ')  20 s flight ' + a.fly.hash + ' cg ' + a.fly.cg.join(',') + ' (master ' + (b.fly && b.fly.hash) +
              ')  empty ' + a.ledger.empty.toFixed(3) + ' kg / ' + a.ledger.cost + ' cr (master ' + (b.ledger && b.ledger.empty.toFixed(3)) + ' / ' + (b.ledger && b.ledger.cost) + ')');
}
console.log('AVIONICS PARITY: ' + (bad ? bad + ' aeroplane(s) changed' : 'the ' + Object.keys(R).length + ' validated aeroplanes unchanged'));
process.exit(bad ? 1 : 0);
