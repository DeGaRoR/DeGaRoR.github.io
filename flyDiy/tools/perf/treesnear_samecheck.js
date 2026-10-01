#!/usr/bin/env node
// treesnear_samecheck.js - THE SAME TREES ON BOTH SIDES (G1114.1, A0's proof for the partition lever)
//   node tools/perf/treesnear_samecheck.js <before lodbench.json> <after lodbench.json>
// Reads treesnear_lodbench.js's checkpoint dumps (every dealt tree of every rung mesh, `<geo>|<mat>|x|y|z`).
//  - FORCED (a refresh at the checkpoint's own eye, both sides): the two lists must be IDENTICAL - the same deal rule.
//  - NATURAL (as each side's cadence left it): any tree in one list and not the other must stand within one refresh
//    step of a band edge (its 3-D distance from the eye within `step` m of a window boundary, edge +- half the window), the step being
//    the larger side's lodMove (0.6 x window, 10 m at most) plus a frame's travel. Prints per checkpoint and a verdict.
'use strict';
const fs = require('fs');
const [A, B] = process.argv.slice(2);
if (!A || !B) { console.error('usage: treesnear_samecheck.js before.json after.json'); process.exit(2); }
const a = JSON.parse(fs.readFileSync(A, 'utf8')), b = JSON.parse(fs.readFileSync(B, 'utf8'));
if (!a.checks || !b.checks || a.checks.length !== b.checks.length) { console.error('checkpoint lists differ or are missing'); process.exit(2); }
const diff = (x, y) => { const sy = new Set(y), sx = new Set(x); return { onlyA: x.filter(k => !sy.has(k)), onlyB: y.filter(k => !sx.has(k)) }; };
let bad = 0;
for (let i = 0; i < a.checks.length; i++) {
  const ca = a.checks[i], cb = b.checks[i];
  const f = diff(ca.forced, cb.forced), nd = diff(ca.natural, cb.natural);
  const fade = Math.max(ca.fade, cb.fade), hw = fade / 2, step = Math.min(10, fade * 0.6) + a.stepM + 1;   // + 1 m: the instance's y carries the trunk's sink, the partition reads the ground
  const edges = [...new Set(ca.bands)];
  // a natural difference is excused when the tree stands within `step` of a window's edge (edge +- hw)
  const far = [];
  for (const k of nd.onlyA.concat(nd.onlyB)) {
    const p = k.split('|'), x = +p[p.length - 3], y = +p[p.length - 2], z = +p[p.length - 1], e = ca.eye;
    const d = Math.hypot(x - e[0], y - e[1], z - e[2]);
    if (!edges.some(E => Math.abs(d - (E - hw)) <= step || Math.abs(d - (E + hw)) <= step)) far.push(k);
  }
  const ok = f.onlyA.length === 0 && f.onlyB.length === 0 && far.length === 0;
  if (!ok) bad++;
  console.log(`  ${String(ca.m).padStart(5)} m: forced ${ca.forced.length} / ${cb.forced.length} ${ok ? 'IDENTICAL' : 'DIFFER (' + f.onlyA.length + ' only before, ' + f.onlyB.length + ' only after)'}` +
    ` · natural ${ca.natural.length} / ${cb.natural.length}, ${nd.onlyA.length + nd.onlyB.length} differ` + (far.length ? `, ${far.length} NOT near an edge` : ''));
}
console.log(`SAMECHECK: ${bad ? 'FAIL - ' + bad + ' checkpoints: different trees at the same eye, or a natural difference away from every edge' : 'PASS - every forced checkpoint identical, every natural difference within a refresh step of an edge'}`);
process.exit(bad ? 1 : 0);
