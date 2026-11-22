#!/usr/bin/env node
// _tutorfly_check.js - GATE TUTORFLY (STORY-REVAMP, 22 Nov 2026): THE TUTORIAL PLAYED START TO END ON NODE, ITS FLIGHTS FLOWN
// (tools/story_run.js). The user (13 Nov): "reasonably tested so that when I start playing I have fun and I'm not just
// fixing bugs".
//   node tools/_tutorfly_check.js          -> "GATE TUTORFLY: PASS|FAIL" (full tier: four flights + the job's two, ~40 sim-min)
//   node tools/_tutorfly_check.js --dry    the walk alone, every flight replaced by the stop it must end in (seconds; what
//                                          the core tier runs: GATE TUTORWALK)
//   1 the walk: T0 -> T7 in order, each beat moved by the page's own event, its effects applied; the end is the
//     checkpoint (its day, its wallet, its seed), the same state as "New career, no tutorial"
//   2 the builds: T3's 5 rows and T7's 4 rows all open on their start file, all met on their target; the target's design
//     check does not fail the airworthiness tier; the Cub signed before the job (the job needs a certificate)
//   3 THE FLIGHTS (not --dry): the starter from the cabin strip to the field; the upgraded Cub to its owner's strip; the
//     one job with its load, through the career's stops; the Cub on floats off the water and back onto it - each one
//     taxied, flown and STOPPED on the strip the beat asks for
//   4 the hand-over: after the checkpoint, the story pack in use - the board is the pack's, nothing drawn
'use strict';
const path = require('path');
const DRY = process.argv.includes('--dry'), SHOW = process.argv.includes('--show');
let bad = 0, n = 0;
const ok = (c, what, detail) => { n++; if (!c) bad++; if (!c || SHOW || true) console.log((c ? '  ok   ' : '  FAIL ') + what + (detail !== undefined ? '  (' + detail + ')' : '')); return c; };
const ID = DRY ? 'TUTORWALK' : 'TUTORFLY';
const os = require('os'), fs = require('fs');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'flydiy-storyrun-'));
let R;
try { R = require(path.join(__dirname, 'story_run.js')).run({ dry: DRY, quiet: true, out }); }
catch (e) { R = { ok: false, why: 'story_run threw: ' + (e && e.stack || e), beats: [], flights: [], builds: [], end: null }; }
ok(R.ok, '0 the run ended well', R.why || (R.beats.length + ' beats'));
// 1
ok(R.beats.map(b => b.beat).join() === 'T0,T1,T2,T3,T4,T5,T6,T7', '1 the eight beats, in order', R.beats.map(b => b.beat).join());
const fx = id => ((R.beats.find(b => b.beat === id) || {}).effects || []).join();
ok(fx('T1') === 'hangar,clientPlane' && fx('T4') === 'giftPlane' && fx('T7') === 'open,checkpoint', '1 the effects: T1 the hangar and the client\'s Cub, T4 the gift, T7 the island open on the checkpoint', [fx('T1'), fx('T4'), fx('T7')].join(' | '));
const E = R.end || {};
ok(E.open && E.day && E.day.date === '2026-07-17' && E.wallet === 12000 && E.seed === 'jolene', '1 the end is the checkpoint: 17 July, 12 000, the one seed', JSON.stringify({ day: E.day, wallet: E.wallet, seed: E.seed }));
ok(E.sameAsSkip === true, '1 ...the same state as "New career, no tutorial"');
ok((E.fleet || []).length === 1 && (E.jobDone || []).join() === 'field.02' && E.tech === 1, '1 ...one aeroplane (the starter), the one job done, the machine shop at segment 1', JSON.stringify([E.fleet, E.jobDone, E.tech]));
// 2
const b3 = R.builds.find(b => b.beat === 'T3') || {}, b7 = R.builds.find(b => b.beat === 'T7') || {};
ok(b3.rows === 5 && b3.openOnStart === 5 && b3.metOnTarget === 5 && b7.rows === 4 && b7.openOnStart === 4 && b7.metOnTarget === 4, '2 the builds\' rows: 5 and 4, all open on the start file, all met on the target');
ok(b3.design && b3.design.safe !== 'fail' && b7.design && b7.design.safe !== 'fail', '2 neither target fails the airworthiness tier of its design check', JSON.stringify([b3.design, b7.design]));
ok(b3.cert && b3.cert.safe && b3.cert.comm, '2 the upgraded Cub is signed before the job: both certificates', JSON.stringify(b3.cert));
// 3
const F = id => R.flights.find(f => f.name === id) || {};
ok(R.flights.length === 4 && R.flights.every(f => f.ok), '3 four flights, every one ended well', R.flights.map(f => f.name + ':' + (f.ok ? 'ok' : f.why)).join(' | '));
ok(F('T1_move').from === R.places.cabin && F('T1_move').to === R.places.home && F('T4_delivery').from === R.places.home && F('T4_delivery').to === R.places.client && F('T7_floats').to === R.places.water,
   '3 from and to are the story\'s places: the cabin strip, the field, the owner\'s strip, the seaplane base', JSON.stringify(R.places));
if (!DRY) {
  for (const id of ['T1_move', 'T4_delivery', 'T7_floats']) {
    const f = F(id), names = (f.steps || []).map(s => s.name);
    ok((f.steps || []).length === 6 && f.steps.every(s => s.ok) && /^taxi/.test(names[2]) && /^land and stop/.test(names[5]) && f.t > 60, '3 ' + id + ': boarded, started, TAXIED, took off, flew, landed and stopped (' + f.t + ' s flown)', names.join(' > '));
  }
  const j = F('T6_job');
  ok(j.verdict === 'feasible' && (j.legs || []).length >= 2 && j.t > 120, '3 the one job flown with its load: feasible, ' + (j.legs || []).length + ' flights, ' + j.t + ' s', (j.legs || []).join(' || ').slice(0, 300));
  ok(R.totalFlownS > 600, '3 the tutorial\'s time in the air and on the taxiways', R.totalFlownS + ' s');
}
// 4
ok(R.pack && R.pack.id === 'story' && R.pack.held === 0 && (R.adopted || []).length === 2, '4 the tutorial is played with the story pack in use and adopted at the career\'s birth (the page since the switch-over)', JSON.stringify([R.pack, R.adopted]));
ok(E.board && E.board.n > 0 && E.board.drawn === 0 && E.board.projectsOpen >= 1 && E.pack === 'story', '4 after the tutorial: the board is the pack\'s, nothing drawn, projects open', JSON.stringify(E.board));
ok(E.kits && !E.kits.includes('metal') && !E.kits.includes('wood') && E.kits.includes('bench'), '4 ...and the hangar still as the start left it: no metal shop, no wood shop (the checkpoint does not hand them back)', (E.kits || []).join());
console.log(n + ' checks, ' + bad + ' failed');
console.log('GATE ' + ID + ': ' + (bad ? 'FAIL' : 'PASS'));
process.exit(bad ? 1 : 0);
