#!/usr/bin/env node
// GATE WS087 - A RESTARTED FLIGHT FLIES, AND OFFERS THE AUTOPILOT (the user's register, WS-087: "Restarting a flight does
// not offer autopilot ... the missing autopilot option can leave the player unable to proceed").
//
//   node tools/_ws087_check.js              -> "GATE WS087: PASS|FAIL"
//   node tools/_ws087_check.js --selftest   -> the old restart (#bReset: fullReset alone, held for a #bGo the fl2 screen
//                                              does not show) must turn the rows red
//
// THE PAGE (tools/_page_node.js, the default page: the fl2 screen, the physics worker): boot, Roll out (#bGo), the
// roll-out trip done, 300 frames of the flight; then the PAUSE MENU's "Restart the flight" (FLYDIY_MENU.act('restart'),
// the player's own door), 30 frames, and:
//   1 the restart is a new flight that has STARTED: the autopilot toggle #bAP shown (G3325: in sight once a flight has
//     started), the pause menu's Restart offered again (gmFlying)
//   2 the autopilot flies it: FLYDIY_AP.autopilot() (every flight starts on the autopilot, G3120)
//   3 it proceeds: within 2400 frames the aeroplane has left its stand - the CG 5 m from where the restart put it
// ~3.5 GB, a child process (as GATE APHONEST).
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

async function child() {
  const out = arg('out'), fault = arg('fault', '');
  const { openPage } = require('./_page_node.js');
  const R = { fault, errors: [] };
  const P = await openPage({ quiet: true, storage: {} });
  const W = P.win, $ = id => W.document.getElementById(id);
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  $('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => (W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout')), 900000);
  const FP = W.FLIGHT_PROBE;
  const RD = FP.renderer(); RD.render = function () {}; if (RD.shadowMap) RD.shadowMap.render = function () {};
  const until = async (cond, maxFrames) => { for (let i = 0; i < maxFrames && !cond(); i++) await P.frames(1); return !!cond(); };
  await P.frames(300);
  R.fl2 = W.document.body.classList.contains('fl2');
  R.before = { ap: !$('bAP').hidden, phase: FP.ap().phase };
  // THE RESTART: the pause menu's own row (the fault: the old way, fullReset alone through the hidden #bReset)
  if (fault === 'old') $('bReset').click(); else W.FLYDIY_MENU.act('restart');
  await P.frames(30);
  const cg0 = FP.sim().cgPos().slice();
  R.after = { apShown: !$('bAP').hidden, autopilot: !!(W.FLYDIY_AP && W.FLYDIY_AP.autopilot()), phase: FP.ap().phase };
  R.moved = await until(() => { const c = FP.sim().cgPos(); return Math.hypot(c[0] - cg0[0], c[2] - cg0[2]) > 5; }, 2400);
  { const c = FP.sim().cgPos(); R.dist = Math.round(Math.hypot(c[0] - cg0[0], c[2] - cg0[2]) * 10) / 10; R.phase = FP.ap().phase; }
  // the node page draws nothing, so the impostor bakes' read-backs log 'sheet EMPTY' (filtered as GATE APHONEST does)
  R.errors = (P.errors || []).filter(e => !/impostor bake/.test(e)).slice(0, 5).map(e => String(e).slice(0, 200));
  fs.writeFileSync(out, JSON.stringify(R));
  P.close();
}

function judge(R) {
  const F = [], ok = (c, l, i) => { console.log((c ? '  ok   ' : '  FAIL ') + l + (i ? '  (' + i + ')' : '')); if (!c) F.push(l); };
  ok(R.fl2, '0 the page flies the fl2 screen (no #bGo: the restart must start the flight itself)');
  ok(R.before && R.before.ap, '0 the first flight offers the autopilot (the toggle in sight)', R.before && R.before.phase);
  ok(R.after && R.after.apShown, '1 after the pause menu\'s Restart the autopilot toggle is in sight (the flight started)', R.after && R.after.phase);
  ok(R.after && R.after.autopilot, '2 the autopilot flies the restarted flight');
  ok(R.moved, '3 the restarted flight proceeds: the aeroplane leaves its stand (5 m)', R.dist + ' m, ' + R.phase);
  ok(!R.errors.length, '  no page error', R.errors.join(' | '));
  return F;
}

function run(fault) {
  const out = path.join(os.tmpdir(), 'ws087_' + process.pid + (fault ? '_' + fault : '') + '.json');
  const a = [__filename, '--child=1', '--out=' + out]; if (fault) a.push('--fault=' + fault);
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000'].concat(a), { stdio: ['ignore', 'inherit', 'inherit'], timeout: 3600 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) return null;
  const R = JSON.parse(fs.readFileSync(out, 'utf8')); try { fs.unlinkSync(out); } catch (e) {}
  return R;
}

if (argv.includes('--child=1')) { child().catch(e => { console.error(e); process.exit(1); }); }
else if (argv.includes('--selftest')) {
  console.log('WS087 SELFTEST: the old restart (fullReset alone) must go red');
  const R = run('old'); const F = R ? judge(R) : ['the page'];
  const caught = F.some(f => /^1 /.test(f));
  console.log('GATE WS087 SELFTEST: ' + (caught ? 'PASS (the old restart caught)' : 'FAIL (the old restart passed)'));
  process.exit(caught ? 0 : 1);
} else {
  console.log('WS087: a restarted flight flies and offers the autopilot (the pause menu\'s Restart, the fl2 screen)');
  const R = run(''); const F = R ? judge(R) : ['the page did not run'];
  if (!R) console.log('  FAIL the page did not run');
  console.log('GATE WS087: ' + (F.length ? 'FAIL (' + F.length + ')' : 'PASS'));
  process.exit(F.length ? 1 : 0);
}
