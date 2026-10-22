#!/usr/bin/env node
// G2361 (DMG-MOUNTRIG): THE AEROPLANE'S MASS PROPERTIES, per build - what the rig's re-shape must not move. For the
// validated builds as the game flies them (tools/_load_build.js) and every archetype (GEN_PRESETS): the mass, the CG,
// the inertia tensor about the CG (kg m2: Ixx roll, Iyy yaw, Izz pitch - the def's x aft, y up, z right), the
// substeps, the ledger's empty mass and price, the node and member counts, the nose engine's rig (its nodes and members).
// One JSON line per build; run it on two trees and compare (tools/dmg_mountrig_props.js --diff a.json b.json).
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
if (argv[0] === '--diff') {
  const A = JSON.parse(fs.readFileSync(argv[1], 'utf8')), B = JSON.parse(fs.readFileSync(argv[2], 'utf8'));
  const e = (x, y) => (x === y ? '=' : (y - x).toExponential(2));
  const r = (x, y) => (x === y ? '=' : ((y - x) / Math.abs(x) * 100).toFixed(4) + '%');
  console.log('build'.padEnd(26) + ' mass        CG x / y / z (m)            Ixx / Iyy / Izz / Ixy                       substeps   ledger kg / price   nodes beams');
  for (const k of Object.keys(A)) { const a = A[k], b = B[k]; if (!b) continue;
    if (a.err || b.err) { console.log(k.padEnd(26) + ' ' + (a.err || '') + ' | ' + (b.err || '')); continue; }
    console.log(k.padEnd(26) + ' ' + e(a.M, b.M).padEnd(11) + ' ' + a.cg.map((x, i) => e(x, b.cg[i])).join(' / ').padEnd(27) + ' ' + a.I.map((x, i) => r(x, b.I[i])).join(' / ').padEnd(43)
      + ' ' + (a.sub + '->' + b.sub).padEnd(10) + ' ' + (e(a.ledM, b.ledM) + ' / ' + e(a.ledC, b.ledC)).padEnd(19) + ' ' + a.n + '->' + b.n + ' ' + a.nb + '->' + b.nb + (b.rig ? '  rig: ' + b.rig : ''));
  }
  process.exit(0);
}
const L = require('./_treecrash_lib.js'), C = L.core();
const out = {};
function props(def) {
  const N = def.nodes; let M = 0; const c = [0, 0, 0];
  for (const n of N) { M += n.m; for (let j = 0; j < 3; j++) c[j] += n.m * n.p[j]; }
  for (let j = 0; j < 3; j++) c[j] /= M;
  const I = [0, 0, 0, 0];
  for (const n of N) { const x = n.p[0] - c[0], y = n.p[1] - c[1], z = n.p[2] - c[2];
    I[0] += n.m * (y * y + z * z); I[1] += n.m * (x * x + z * z); I[2] += n.m * (x * x + y * y); I[3] += n.m * x * y; }
  let ledM = 0, ledC = 0; const led = (def.parts && def.parts.ledger) || {};
  for (const k in led) { if (!led[k].payload) ledM += led[k].mass; ledC += led[k].cost; }
  const ring = N.filter(n => /^MNT[TB][LR]$/.test(n.tag)).length;
  return { M, cg: c, I, sub: def.params.substeps + (def.params.substepsTrue ? '/' + def.params.substepsTrue : ''), ledM, ledC, n: N.length, nb: def.beams.length,
    rig: ring ? ring + ' cups' : '' };
}
const only = argv.filter(a => !a.startsWith('--'));
for (const k of Object.keys(L.BUILDS)) { if (only.length && !only.includes(k)) continue;
  try { out[k] = props(L.defOf(k)); } catch (e) { out[k] = { err: String(e.message) }; } }
if (!only.length || only.includes('presets'))
  for (const k of Object.keys(C.GEN_PRESETS)) { try { out['preset:' + k] = props(C.buildGen(JSON.parse(JSON.stringify(C.GEN_PRESETS[k])))); } catch (e) { out['preset:' + k] = { err: String(e.message) }; } }
console.log(JSON.stringify(out));
