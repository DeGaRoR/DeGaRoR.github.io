#!/usr/bin/env node
// GATE QSCUT - QUICKSHOT'S CUT VIEWS DRAW THE CABIN (16 Nov 2026, the user: "Unified quick render should also allow for
// cut views with the pilot and the controls shown. We needed that a lot.")
//
//   node tools/_qscut_check.js      -> "GATE QSCUT: PASS|FAIL"   (~15 s, one quickshot child, node only)
//
// quickshot.js --cut side on THE Piper Cub (builds/cub_2026-09-20_corrected.json, the plane list's row) must:
//   whole     draw the crew layer's cabin items whole (never clipped): the pilot (edCrew), the seats (edSeat), the
//             controls (edCtl: the stick, the pedals, the throttle), the instrument panel (edPanel) - each > 0 meshes
//   dash      keep the sheet's dash (the 'dash' / 'dashFace' sections) whole: > 0 triangles
//   cut       clip the rest on the plane: fewer triangles kept than went in, and a section line (> 0 edges)
//   picture   write the side picture (a PNG)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const T = __dirname, ROOT = path.resolve(T, '..');
const PLANE = path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
console.log('GATE QSCUT - quickshot --cut side draws the Cub\'s pilot, seats, controls and dash whole');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qscut_'));
const p = cp.spawn(process.execPath, ['--max-old-space-size=2048', path.join(T, 'quickshot.js'), PLANE, path.join(tmp, 'cub'), '--cut', 'side', '--w', '320'],
  { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; p.stdout.on('data', d => { log += d; }); p.stderr.on('data', d => { log += d; });
const kill = setTimeout(() => p.kill(), 120000);
p.on('close', code => {
  clearTimeout(kill);
  ok(code === 0, 'quickshot exits 0 (' + code + ')' + (code ? '\n' + log.split('\n').slice(-8).join('\n') : ''));
  const cl = /cut side: (\d+) whole tris .*?, (\d+) kept of (\d+) clipped, (\d+) section edges/.exec(log);
  const wm = /cut whole meshes: (\{[^}]*\}), the sheet's dash (\d+) tris/.exec(log);
  ok(!!cl && !!wm, 'the cut is reported' + (cl ? ': ' + cl[0] : ''));
  const W = wm ? JSON.parse(wm[1]) : {};
  for (const [k, what] of [['edCrew', 'the pilot'], ['edSeat', 'the seats'], ['edCtl', 'the controls'], ['edPanel', 'the panel']])
    ok((W[k] || 0) > 0, what + ' (' + k + ') drawn whole: ' + (W[k] || 0) + ' meshes');
  ok(wm && +wm[2] > 0, 'the sheet\'s dash drawn whole: ' + (wm ? wm[2] : 0) + ' tris');
  ok(cl && +cl[2] < +cl[3], 'the rest clipped on the plane: ' + (cl ? cl[2] + ' kept of ' + cl[3] : '-'));
  ok(cl && +cl[4] > 0, 'the section line: ' + (cl ? cl[4] : 0) + ' edges');
  const png = path.join(tmp, 'cub_side.png');
  const b = fs.existsSync(png) ? fs.readFileSync(png) : null;
  ok(!!b && b.length > 1000 && b.readUInt32BE(0) === 0x89504e47, 'the side picture written (' + (b ? b.length : 0) + ' bytes)');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  console.log('GATE QSCUT: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
});
