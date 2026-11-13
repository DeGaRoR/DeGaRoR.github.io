#!/usr/bin/env node
// GATE COMMUNITYFLY (COMMUNITY-AIRPORT, 13 Nov 2026) - THE PILOT USES THE COMMUNITY FIELD AT EVERY STAGE.
//
// GATE COMMUNITY holds the strip's rows per stage off the composed world; this flies them. For each stage of the
// `community` track the island's record is composed AT that stage (tools/community_fly.js stagedText: 27_premises
// stageView - the length, width, surface and bumps the wheels stand on) and the pilot flies the game's way
// (tools/_tour_lib.js gameHost / flyTour: the game's day, placement and pilot, the damage ON):
//   w6 (Old Community Runway) > w7, then w7 > w7 (out of the strip, the circuit, back onto it)
//   a  THE ARRIVAL: the leg into w7 is ok - stopped on w7, no fault (no member yielded or broken, no prop strike, no
//      ground loop, no off-strip, no crash)
//   b  THE DEPARTURE AND BACK: out of w7 - the lift-off inside the strip of the stage (where the roll began + the run <
//      its length) - and landed and stopped on it again, no fault
// (w6 is no return leg: the user's Cub and the metal Cessna both go round at w6 and divert, at every stage of w7 -
// w6's, not this field's; measured 13 Nov, HANDOVER COMMUNITY-AIRPORT)
// Jobs: the user's Cub and the metal Cessna x stages 0, 1, 2 (`--shard=i/3`). A build the pilot does not put on a stage's
// strip - declined before it goes, or gone round on its final and diverted elsewhere, whole (43: its own judgement of the
// strip) - is printed KNOWN and passes only on the shortest strip (stage 0) and with no damage.
//
//   node tools/_communityfly_check.js [--show]     -> "GATE COMMUNITYFLY: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(process.env.PILOT_CORE ? path.resolve(process.env.PILOT_CORE) : path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const SHD = require(path.join(T, '_shard.js'));
const CF = require(path.join(T, 'community_fly.js'));
const SHOW = process.argv.includes('--show');
let bad = 0;
const check = (ok, what, detail) => {
  if (!ok) bad++;
  if (!ok || SHOW) console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  (' + detail + ')' : ''));
  return ok;
};
const ORDER = ['w6', 'w7', 'w7'];
const JOBS = [];
for (const b of ['cub', 'c172']) for (const n of [0, 1, 2]) JOBS.push({ b, n });

console.log('GATE COMMUNITYFLY' + SHD.tag);
for (const J of JOBS) {
  if (!SHD.take()) continue;
  const t0 = Date.now();
  const tmp = path.join(require('os').tmpdir(), 'communityfly_' + J.n + '_' + process.pid + '.json');
  fs.writeFileSync(tmp, CF.stagedText(J.n));
  let R, a7;
  try {
    const TW = TR.tourWorld(C, IN, fs, { fixture: tmp });
    a7 = TW.W.aerodromes.find(a => a.id === 'w7');
    R = TR.flyTour(C, TW.W, TR.defOf(C, PT, TR.BUILDS[J.b].key), ORDER, { game: {}, tMax: 1500 });
  } finally { fs.unlinkSync(tmp); }
  const id = '[stage ' + J.n + ', w7 ' + a7.len + ' x ' + a7.wid + ' m ' + a7.look + '] ' + TR.BUILDS[J.b].name;
  console.log('  ' + id + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
  for (const L of R.legs) console.log('  ' + TR.fmtLeg(L).trim());
  const into = R.legs[0], out = R.legs[1];
  const refused = into && (into.declined || (into.landedOn && into.landedOn !== 'w7' && (into.faults || []).every(f => f.k === 'diverted')));
  if (refused) {
    check(J.n === 0, id + ' a: the pilot put it elsewhere (' + (into.declined || 'diverted to ' + into.landedOn) + '), whole - only the shortest strip (stage 0) may be refused', 'refused');
    console.log('  KNOWN ' + id + ': the pilot does not use the ' + a7.len + ' m strip with this build (' + (into.declined || 'gone round, diverted to ' + into.landedOn) + ')');
    continue;
  }
  const fIn = into ? into.faults || [] : [{ k: 'no leg' }];
  check(!!into && into.ok && into.landedOn === 'w7' && into.arr && into.arr.stopS != null && !fIn.length, id + ' a: into w7 - stopped on it, no fault',
    into ? (into.landedOn ? 'on ' + into.landedOn : 'not landed') + (fIn.length ? '; ' + fIn.map(f => f.k + ': ' + f.note).join('; ') : '') + (into.arr && into.arr.landing ? '; td ' + into.arr.landing.sink + ' m/s, run ' + into.arr.landing.run + ' m' : '') : 'none');
  if (!out) { check(false, id + ' b: out of w7 and back', 'no second leg'); continue; }
  const dp = out.dep || {};
  const inStrip = dp.toDist != null && dp.rollFromEnd != null && dp.rollFromEnd + dp.toDist < a7.len;
  const fOut = out.faults || [];
  check(inStrip && out.ok && out.landedOn === 'w7' && !fOut.length, id + ' b: out of w7 (lifted off inside the strip) and back onto it, no fault',
    'roll ' + dp.rollFromEnd + ' m in, lift-off ' + dp.toDist + ' m (of ' + a7.len + ')' + (out.landedOn ? ', landed on ' + out.landedOn : '') + (fOut.length ? '; ' + fOut.map(f => f.k + ': ' + f.note).join('; ') : ''));
}
console.log('GATE COMMUNITYFLY' + SHD.tag + ': ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
process.exit(bad ? 1 : 0);
