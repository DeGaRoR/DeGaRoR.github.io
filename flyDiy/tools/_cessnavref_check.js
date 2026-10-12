#!/usr/bin/env node
// GATE CESSNAVREF (G2500, CESSNA-VREF) - THE METAL CESSNA INTO TAMGAS HILL, AS THE GAME FLIES IT.
//
// The finding (the game on the GPU, the 8 kt day, damage on; the user's metal Cessna bugReports/cessnaMetal (1).json):
// 'vref-raised: the elevator cannot hold 28.9 m/s at this power', a touchdown at 30.5-31.1 m/s on Tamgas Hill's 520 m
// and the aeroplane stopped 51 m (train 40) / 100 m (pilot-42) PAST THE END. Node reproduces both to the metre in the
// game's flight (tools/_tour_lib.js gameHost: the worker's host and placement, DAY_CLOCK's day ticked, the page's pilot
// with the shakedown; the load door's aeroplane through tools/_load_build.js; HANDOVER G2500).
//
//   node tools/_cessnavref_check.js [--show]          -> "GATE CESSNAVREF: PASS|FAIL" (full tier; 2 shards, ~10 min each)
//
// 1 (shard 0) THE METAL CESSNA AS THE GAME LOADS IT, HOME > Tamgas Hill, damage ON, the game's day:
//   - the case is the finding's: the load door's build lands flapless (genTrim's trim budget) and the elevator ran out
//     on the final ('vref-raised' said) - else this gate no longer tests what it says
//   - THE BAR: stopped ON the strip (the touch past the threshold, the stop short of the far end, on the centreline's
//     box), or the strip REFUSED with its reason said ('strip-too-short') and the aeroplane landed and stopped on the
//     strip it diverted to; either way no member yielded or broken, no dent, no prop strike, no ground loop
// 2 (shard 1) THE CONTROL: the C172 file build (builds/cessna172_2026-09-20_corrected.json, the load door's) on the
//   same leg - its elevator holds Vref (no 'vref-raised'), and it lands and stops on Tamgas Hill as it did
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const SHD = require(path.join(T, '_shard.js'));
const SHOW = process.argv.includes('--show');
let bad = 0;
const check = (ok, what, detail) => {
  if (!ok) bad++;
  if (!ok || SHOW) console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  (' + detail + ')' : ''));
  return ok;
};
const ROOT = path.join(T, '..');
const JOBS = [
  { id: 'metal', key: path.join(ROOT, 'bugReports', 'cessnaMetal (1).json'), name: 'the metal Cessna (the load door\'s)', finding: true },
  { id: 'c172', key: path.join(ROOT, 'builds', 'cessna172_2026-09-20_corrected.json'), name: 'the C172 file build (the control)', finding: false },
];
for (const J of JOBS) {
  if (!SHD.take()) continue;
  const t0 = Date.now();
  const def = TR.defOf(C, PT, J.key);
  const TW = TR.tourWorld(C, IN, fs);
  const R = TR.flyTour(C, TW.W, def, ['HOME', 'w3'], { game: {} });
  const L = R.legs[0];
  const V = L.verdicts.join(' | '), ld = L.arr.landing || {};
  const said = c => L.verdicts.some(v => v.startsWith(c));
  const g = def.params.gen;
  console.log('  ' + J.name + ': ' + TR.fmtLeg(L).trim());
  console.log('    verdicts: ' + V);
  console.log('    the build: Vs ' + g.Vs.toFixed(2) + ', Vs0 ' + g.VsFlap.toFixed(2) + ', landing flap ' + (def.params.flaps ? def.params.flaps.ldg : '-') +
              (g.landsFlapless ? ' (genTrim: lands flapless)' : '') + (g.apprTrimFail != null ? ', approach trim ' + g.apprTrimFail.toFixed(3) + ' over the 0.18 budget' : '') +
              '; mass ' + (R.game && R.game.mass) + ' kg, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s wall');
  if (J.finding) {
    check(!!g.landsFlapless && said('vref-raised'), J.id + ': the finding\'s case - the load door\'s build lands flapless and the elevator ran out on the final',
          'landsFlapless ' + !!g.landsFlapless + ', vref-raised ' + said('vref-raised'));
  } else check(!said('vref-raised'), J.id + ': the elevator holds Vref (no vref-raised)');
  const D = L.damage || {};
  check(!D.yields && !D.breaks && !D.dented && !L.faults.some(f => f.k === 'prop-strike' || f.k === 'crash'), J.id + ': undamaged', JSON.stringify(D));
  check(!L.groundLoop, J.id + ': no ground loop');
  const refused = said('strip-too-short');
  if (refused) {
    check(L.landedOn && L.landedOn !== 'w3' && ld.onStrip === true && L.faults.every(f => f.k === 'diverted'),
          J.id + ': Tamgas Hill refused, said - landed and stopped on the strip diverted to', 'landed on ' + L.landedOn + ', ' + JSON.stringify(ld) + ', faults ' + L.faults.map(f => f.k).join(','));
  } else {
    check(L.ok && L.landedOn === 'w3' && ld.onStrip === true && ld.stopLeft >= 0, J.id + ': stopped ON Tamgas Hill',
          'touched ' + ld.tdIn + ' m in at ' + ld.V + ' m/s, sink ' + ld.sink + ', ' + ld.stopLeft + ' m of strip left; faults ' + (L.faults.map(f => f.k + ': ' + f.note).join('; ') || 'none'));
  }
}
// (the runner reads `GATE CESSNAVREF: PASS` bare - run_gates printGate; the shard's account on its own line)
if (SHD.tag) console.log('CESSNAVREF' + SHD.tag + ': ' + bad + ' failed');
console.log('GATE CESSNAVREF: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
process.exit(bad ? 1 : 0);
