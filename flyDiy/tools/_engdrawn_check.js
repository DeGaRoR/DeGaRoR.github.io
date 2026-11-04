#!/usr/bin/env node
// GATE ENGDRAWN (G3912) — THE OVER-THE-WING ENGINE IS DRAWN WHERE IT FLIES, on every wing centre a cabin wears.
//
// The user (4 Nov, "Draw the 'Over the wing' engine on high-wing cabins"): the Cessna with the Engine mount tile's
// 'Over the wing' flew a pylon engine and drew none - its wing centre is REMOVED (wgCentre 7: the roots bolt to the
// cabin roof's sides, 11 saved builds), the cowl layer asked the wing for its leading edge ON THE CENTRELINE
// (CAGE_WING.leAt(0)), got null, and the engine layer filed "1 of 1 not drawn - no wing to sit on" into the join's
// errors, where no gate looked. The pylon now stands on the roof between the roots (_cage_cowl.js engineFaces).
//
//   node tools/_engdrawn_check.js            -> "GATE ENGDRAWN: PASS|FAIL"
//
// For the user's Cessna-on-floats build (bugReports/cessnaFloatsWOrks.json) with the tile's 'Over the wing' writes,
// on each wing centre the saved builds use (solid 0, glass 2, cutout 3, removed 7), through THE GAME'S LOAD CHAIN
// (_load_build.js gameSpecFull: the editor's layers, the join):
//   DRAWN    the join files no "not drawn" error
//   PLACED   the flown engine's station is the drawn one: spec.engines[0] carries the join's measured x / y (the
//            frame hangs it there) - an engine flown at the rule's station and drawn elsewhere is red
// (~1 min: four builds in the page chain's child, sequential)
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const LB = require('./_load_build.js');
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const f = (v, n = 3) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : String(v);

const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'bugReports', 'cessnaFloatsWOrks.json'), 'utf8'));
// the Engine mount tile's 'Over the wing' (_cage_design.js engMount wingTop + NOSE_AERO); the pylon at the row's
// maximum so the Cessna's 2.06 m propeller clears the cabin (the propeller check is the layer's own, said in notes)
const WINGTOP = { engMount: 2, wgPos: 0, cowlOn: 0, cw_aftMode: 1, cw_tailLen: 1.0, aeroAftOn: 1, engPylonH: 1.0,
                  noseFinish: 1, noseLen: 0.95, cowlLoops: 4, noseTip: 0.98, noseDroop: 0.10, cowlEase: 0.62, cowlBulge: 1.06 };
const CENTRES = [[0, 'solid'], [2, 'glass'], [3, 'cutout'], [7, 'removed']];
for (const [wc, name] of CENTRES) {
  const j = JSON.parse(JSON.stringify(base));
  const sp = j.spec || j;
  sp.cage = Object.assign({}, sp.cage, WINGTOP, { wgCentre: wc });
  const r = LB.gameSpecFull(j);
  const errs = (r.errors || []).filter(e => /^engine:/.test(e));
  const e0 = (r.spec.engines || [])[0] || {};
  console.log(`   wing centre ${name} (${wc}): engines ${(r.spec.engines || []).length}, mount ${e0.mount}, x ${f(e0.x)} y ${f(e0.y)}; engine errors: ${errs.length ? errs.join(' | ') : 'none'}`);
  verdict(!errs.some(e => /not drawn/.test(e)), `${name}: the over-the-wing engine is drawn`);
  verdict(e0.mount === 'wingTop' && Number.isFinite(+e0.x) && Number.isFinite(+e0.y), `${name}: it flies where it is drawn (the join measured x ${f(e0.x)}, y ${f(e0.y)})`);
}
console.log(fails ? `\nGATE ENGDRAWN: FAIL (${fails})` : '\nGATE ENGDRAWN: PASS');
process.exit(fails ? 1 : 0);
