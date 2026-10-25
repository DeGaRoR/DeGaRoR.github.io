#!/usr/bin/env node
// avionics_bill_table.js - THE VALIDATED AEROPLANES' BILL, ONE TREE AGAINST ANOTHER (G2808-G2809, AVIONICS-GPS)
//
// The user, 25 Oct: "Wysiwyg, and as billed for all" - every validated aeroplane's empty mass moved on purpose. This
// prints what moved, per aeroplane and per ledger section, loaded the game's way (each tree's own tools/_load_build.js,
// no join cache): the empty mass, the price, the CG's x (model frame), the furnishing + outfit, the electrics and the
// radios, and what the join wrote (outfit: the seats' kind, the drawn surfaces in m2, the control stations; the lamp
// census; the dash's no-room list).
//   node tools/avionics_bill_table.js <base flyDiy root>          this tree against <base> (e.g. a master worktree)
//   node tools/avionics_bill_table.js --one [<flyDiy root>]        one tree's numbers, as JSON
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
process.env.FLYDIY_JOIN_NOCACHE = '1';
function measure(root) {
  const T = path.join(root, 'tools');
  const C = require(path.join(T, 'flight_core.js'));
  const LB = require(path.join(T, '_load_build.js'));
  const B = {};
  for (const [k, v] of Object.entries(LB.VALIDATED)) B[k] = { file: v.build, patch: v.patch };
  B.cessna172 = { file: 'builds/cessna172_2026-09-20_corrected.json' };
  B.rufus = { file: 'builds/rufus_2026-10-18_certified.json' };
  const out = {};
  for (const [k, b] of Object.entries(B)) {
    const s = LB.loadBuild(b.file, { patch: b.patch || undefined }).spec;
    const def = C.buildGen(JSON.parse(JSON.stringify(s)));
    const L = def.parts.ledger || {};
    let empty = 0, cost = 0; const sec = {};
    for (const q in L) { if (!L[q].payload) empty += L[q].mass; cost += L[q].cost || 0; sec[q] = [+L[q].mass.toFixed(3), Math.round(L[q].cost || 0)]; }
    let mx = 0, mm = 0; for (const n of def.nodes) { mx += n.p[0] * n.m; mm += n.m; }
    out[k] = { empty: +empty.toFixed(3), cost: Math.round(cost), cgx: +(mx / mm).toFixed(4), sec,
               outfit: s.outfit || null, lights: (s.systems && s.systems.lights) || null, noRoom: (s.systems && s.systems.noRoom) || [] };
  }
  return out;
}
if (process.argv[2] === '--one') {
  process.stdout.write(JSON.stringify(measure(path.resolve(process.argv[3] || path.join(__dirname, '..')))) + '\n');
  process.exit(0);
}
const baseRoot = process.argv[2];
if (!baseRoot) { console.error('usage: node tools/avionics_bill_table.js <base flyDiy root> | --one [<root>]'); process.exit(2); }
// each tree in its own process: the two flight cores and load chains must not share a module cache
const run = root => JSON.parse(execFileSync(process.execPath, [__filename, '--one', path.resolve(root)],
  { cwd: path.resolve(root), encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n').filter(l => l.startsWith('{')).pop());
const A = run(baseRoot), B = run(path.join(__dirname, '..'));
const g = (o, s) => (o.sec[s] ? o.sec[s][0] : 0), f = x => x.toFixed(2), sg = x => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(2);
console.log('| aeroplane | empty kg | price cr | CG x (m, model) | furnishing + outfit kg | electrics kg | radios kg |');
console.log('|---|---|---|---|---|---|---|');
for (const k of Object.keys(B)) {
  const a = A[k], b = B[k];
  if (!a) { console.log('| ' + k + ' | (not in the base tree) |'); continue; }
  console.log('| ' + k + ' | ' + f(a.empty) + ' -> ' + f(b.empty) + ' (' + sg(b.empty - a.empty) + ') | ' + a.cost + ' -> ' + b.cost +
              ' | ' + a.cgx.toFixed(4) + ' -> ' + b.cgx.toFixed(4) + ' | ' + f(g(a, 'outfit') + g(a, 'furnish')) + ' -> ' +
              f(g(b, 'outfit') + g(b, 'furnish')) + ' | ' + f(g(a, 'elec')) + ' -> ' + f(g(b, 'elec')) + ' | ' +
              f(g(a, 'avionics')) + ' -> ' + f(g(b, 'avionics')) + ' |');
}
for (const k of Object.keys(B))
  console.log(k + ': outfit ' + JSON.stringify(B[k].outfit) + ' lamps ' + JSON.stringify(B[k].lights) + ' no room ' + JSON.stringify(B[k].noRoom));
