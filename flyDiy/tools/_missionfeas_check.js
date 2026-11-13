#!/usr/bin/env node
// GATE MISSIONFEAS (MISSION-FEASIBILITY) - THE FEASIBILITY HARNESS, GATED ON THREE DEMO MISSIONS
// (tools/fixtures/missionfeas/demo.json): one feasible, one infeasible on purpose, one broken on purpose - so the harness
// that says "every mission is flyable" is itself held to saying it right.
//
//   node tools/_missionfeas_check.js            -> "GATE MISSIONFEAS: PASS|FAIL" (full tier, ~10-15 min: one mission flown)
//   node tools/_missionfeas_check.js --show     -> every line, passed ones too
//
//   1 THE BROKEN ONE (feas.broken: land at 'w99'): BROKEN, the bad place id named, nothing flown
//   2 THE INFEASIBLE ONE (feas.heavy: 900 kg to w3): INFEASIBLE, no official plane can carry it (73_ contractCanDo's
//     load) and nothing flown
//   3 THE FEASIBLE ONE (feas.ok: 20 kg HOME > w3, then land HOME), FLOWN THE GAME'S WAY:
//     a the roll-out: the career's main-shed stand (standFor), the host's own placement on it (no line-up skip), the CG
//       within 12 m of the stand
//     b the first flight starts on the ground and TAXIS before it ROLLS (DEPART/TAXI ... LINEUP/HOLD ... ROLL), lifts off
//       and lands; the 20 kg aboard (the loading view's proposal, FREIGHT-STRAP's masses in the sim)
//     c the career's stops: w3 delivers the carry (the leg done), HOME completes the mission
//     d the last flight TAXIS IN to the stand (TAXI-HOME) and stops within 15 m of it
//     e FEASIBLE, on an official plane of the pool, time flown > 0 and the sum of its flights
//   4 THE TABLE AND THE JSON: three rows, each verdict as above, the JSON round-trips
//   5 NO SHORTCUT IN THE RIG: mission_feas_lib.js places nothing itself (no placeAtAerodrome / placeAtStand /
//     placeAtLineup / sim.reset / a position written) and never asks the host's line-up skip; the pool reads only the
//     official lists (never 'legacy' test copies)
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const SHOW = process.argv.includes('--show');
let bad = 0;
const ok = (c, what, detail) => { if (!c) bad++; if (!c || SHOW) console.log((c ? '  ok   ' : '  FAIL ') + what + (detail ? '  (' + detail + ')' : '')); return c; };
const F = require(path.join(T, 'mission_feas_lib.js'));
const FX = path.join(T, 'fixtures', 'missionfeas', 'demo.json');
const packRow = { file: path.relative(ROOT, FX).replace(/\\/g, '/'), pack: JSON.parse(fs.readFileSync(FX, 'utf8')) };
const spots = F.spotsPack();
const M = id => packRow.pack.missions.find(m => m.id === id);
const t0 = Date.now();
const rows = [];

// 1 the broken one
{
  const R = F.judgeMission(Object.assign(F.makeEnv(), { spots }), packRow, M('feas.broken'), { tries: 1 });
  rows.push(R);
  ok(R.verdict === 'broken', '1 feas.broken is BROKEN', R.verdict + ': ' + R.why);
  ok(/w99/.test(R.why), '1 the bad place id is named', R.why.slice(0, 200));
  ok(!(R.attempts || []).length, '1 nothing flown');
}
// 2 the infeasible one
{
  const R = F.judgeMission(Object.assign(F.makeEnv(), { spots }), packRow, M('feas.heavy'), { tries: 1 });
  rows.push(R);
  ok(R.verdict === 'infeasible', '2 feas.heavy is INFEASIBLE', R.verdict + ': ' + R.why.slice(0, 200));
  ok(/no official plane can do it/.test(R.why) && /load|kg|payload|heavy/i.test(R.why), '2 the reason is the load', R.why.slice(0, 300));
  ok(!(R.attempts || []).length, '2 nothing flown');
}
// 3 the feasible one, flown
{
  const legs = [];
  const R = F.judgeMission(Object.assign(F.makeEnv(), { spots }), packRow, M('feas.ok'), { tries: 1, log: L => { legs.push(L); if (SHOW) console.log('      ' + F.legLine(L)); } });
  rows.push(R);
  const A = (R.attempts || [])[0] || { legs: [], stops: [] };
  const P = A.placed || {};
  ok(!!P.stand && P.lineup === false, '3a the roll-out on the career stand, no line-up skip', JSON.stringify(P));
  ok(P.stand && P.cg && Math.hypot(P.cg.x - P.stand.x, P.cg.z - P.stand.z) < 12, '3a the CG on the stand', P.cg && P.stand ? Math.hypot(P.cg.x - P.stand.x, P.cg.z - P.stand.z).toFixed(1) + ' m' : '-');
  const L1 = A.legs[0] || { phases: [] }, ph = L1.phases;
  const iT = ph.indexOf('TAXI'), iR = ph.indexOf('ROLL');
  ok(ph.length && ['DEPART', 'TAXI', 'STOP', 'HOLD', 'LINEUP'].includes(ph[0]), '3b the first flight begins on the ground', ph.slice(0, 4).join('>'));
  ok(iT >= 0 && iR > iT, '3b it TAXIS before it ROLLS', ph.join('>'));
  ok(A.legs.length >= 2 && A.legs.every(L => L.airborne && L.landing), '3b every flight lifts off and lands', A.legs.map(L => L.from + '>' + L.to + ' air ' + L.airborne + ' ldg ' + !!L.landing).join('; '));
  ok(L1.load && L1.load.kg === 20 && L1.load.how === 'proposed', '3b the 20 kg aboard the first flight (the loading view\'s proposal)', JSON.stringify(L1.load));
  const S = A.stops || [];
  ok(S[0] && S[0].at === 'w3' && S[0].events.some(e => /^stage/.test(e)), '3c the stop at w3 delivers the carry', JSON.stringify(S[0]));
  ok(S[1] && S[1].at === 'HOME' && A.completed, '3c the stop at HOME completes the mission', JSON.stringify(S[1]));
  const Ln = A.legs[A.legs.length - 1] || { phases: [] };
  const iRo = Ln.phases.lastIndexOf('ROLLOUT'), iTi = Ln.phases.lastIndexOf('TAXI');
  ok(iRo >= 0 && iTi > iRo && Ln.phase === 'STOPPED', '3d the last flight taxis in after its roll-out (TAXI-HOME)', Ln.phases.join('>'));
  ok(Ln.standDist != null && Ln.standDist < 15, '3d ...and stops on the stand', Ln.standDist + ' m');
  ok(R.verdict === 'feasible' && F.planePool().some(p => p.name === R.plane), '3e FEASIBLE on an official plane of the pool', R.verdict + ' / ' + R.plane + ' / ' + R.why);
  const sum = Math.round(A.legs.reduce((a, L) => a + L.t, 0) * 10) / 10;
  ok(R.timeS > 0 && Math.abs(R.timeS - sum) < 0.2, '3e the time flown is the sum of its flights', R.timeS + ' s vs ' + sum);
}
// 4 the table and the JSON
{
  const md = F.mdTable(rows);
  ok(md.split('\n').length === 2 + 3 && /feas\.ok \| contract \| \*\*feasible\*\*/.test(md) && /feas\.heavy \| contract \| \*\*infeasible\*\*/.test(md) && /feas\.broken \| contract \| \*\*broken\*\*/.test(md),
     '4 the table: three rows, each its verdict', md.split('\n').slice(2).map(l => l.slice(0, 80)).join(' / '));
  const back = JSON.parse(JSON.stringify(rows));
  ok(back.length === 3 && back.map(r => r.verdict).join() === rows.map(r => r.verdict).join(), '4 the JSON round-trips');
}
// 5 no shortcut in the rig
{
  const src = fs.readFileSync(path.join(T, 'mission_feas_lib.js'), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).map(l => l.replace(/\/\/.*$/, '')).join('\n');
  const hits = ['placeAtAerodrome(', 'placeAtStand(', 'placeAtLineup(', '.reset(', 'seatOnGround(', 'lineup: true', '.p[', 'sim.p ='].filter(k => src.indexOf(k) >= 0);
  ok(!hits.length, '5 the rig places nothing itself and asks no line-up skip', hits.join(', ') || 'clean');
  ok(/lineup: false/.test(src), '5 the host is asked for no line-up skip, in words');
  const pool = F.planePool(), lists = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'lists', 'plane_lists.json'), 'utf8')).planes;
  ok(pool.length >= 3 && pool.every(p => lists.some(r => r.file === p.file && ['reproduction', 'story', 'original'].includes(r.list))), '5 the pool is official rows only', pool.map(p => p.design + '=' + p.name).join(', '));
}
console.log('  (' + Math.round((Date.now() - t0) / 1000) + ' s)');
console.log('GATE MISSIONFEAS: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
process.exitCode = bad ? 1 : 0;
