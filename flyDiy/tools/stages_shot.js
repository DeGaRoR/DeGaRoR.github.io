#!/usr/bin/env node
// stages_shot.js - THE STAGES' STILLS FOR A0's GPU BOX (G2300-G2309 STAGES; GAME-2026-10-06.md §11).
//
// The cloud cannot render the world (SwiftShader fails on world renders), so STAGES lists the stills it wants and
// this tool takes them on a machine with a GPU, through cloud_shot.js's rig (headless Chrome on the GPU, the roll-out,
// the free DEVCAM eye, SHOT_MODE). NOT RUN by the STAGES session.
//
//   node tools/stages_shot.js                    -> the shot list (JSON lines): every pair, its URL, its eye
//   node tools/stages_shot.js --run --base http://localhost:8480/flyDiy/index.html [--out screenshots/stages]
//                                                -> one cloud_shot.js boot per stage value, the shots of that value
//
// THE SHOTS. For every unlock that changes the world (76_stages.js STAGE_REVEALS, world: true) - the field's second
// hangar, the mill and the ore shed, the dock, the lodge, the altiport, East Point, the club's house - a PAIR from the
// one eye: BEFORE (the track one below: the plot empty, or the construction look) and AFTER (the unlock's value: the
// construction look, or the finished building), every other track at its max. Plus the REVEAL itself: the roll-out
// after a stage advanced opens on the new building (app.js flRevealStart -> stageRevealTake) - the eye the reveal
// places (STAGE_SHOT: 70 m back, 0.32 rad up, az 0.8) - one per unlock, with its caption on screen.
// THE SANDBOX CHECK: the sandbox's still at each eye (no ?career) must match the AFTER of the max value pixel for
// pixel in what the record draws (GATE STAGES holds the record byte for byte; this is the picture of it).
//
// The URL: ?career=1 (CAREER-WIRE's dev career) and ?stages=<track>:<n>,... (world_boot.js: those values over the
// document's for this load; nothing written). The eye: the reveal's target (stageReveal over the WHOLE record, the
// centre of what changes at the unlock) + STAGE_SHOT, the ground under it from the composed island.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const PG = C.PREMISES_GEN;
const txt = fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8');
const whole = PG.normalise(JSON.parse(txt));
const MAX = C.stageMaxes();
const W = IN.islandWorld('jolene', { premises: txt });   // the sandbox's ground under the eyes (a stage's own ground differs only on its plot)

const deg = r => +(r * 180 / Math.PI).toFixed(2);
const shots = [];
for (const u of Object.keys(C.STAGE_REVEALS)) {
  const R0 = C.STAGE_REVEALS[u]; if (!R0.world) continue;
  const R = C.stageReveal(whole, null, u); if (!R) continue;
  const [track, n] = u.split(':'), v = +n;
  const gy = W.terrainH(R.x, R.z), ty = gy + 6;
  const h = R.dist * Math.cos(R.el);
  const eye = [+(R.x + h * Math.sin(R.az)).toFixed(1), +(ty + R.dist * Math.sin(R.el)).toFixed(1), +(R.z + h * Math.cos(R.az)).toFixed(1)];
  const dx = R.x - eye[0], dz = R.z - eye[2];
  const yaw = deg(Math.atan2(dx, -dz)), pitch = deg(Math.atan2(ty - eye[1], Math.hypot(dx, dz)));   // cloud_shot: 0 = -z, 90 = +x; up positive
  const at = s => Object.keys(MAX).map(k => k + ':' + (k === track ? s : MAX[k])).join(',');
  shots.push({ name: u.replace(':', '_') + '_before', stages: at(v - 1), eye, yaw, pitch, caption: null, ids: R.ids });
  shots.push({ name: u.replace(':', '_') + '_after', stages: at(v), eye, yaw, pitch, caption: R.caption, ids: R.ids });
  shots.push({ name: u.replace(':', '_') + '_sandbox', stages: null, eye, yaw, pitch, caption: null, ids: R.ids });
}

if (!argv.includes('--run')) {
  for (const s of shots) console.log(JSON.stringify(s));
  console.log('// ' + shots.length + ' stills over ' + new Set(shots.map(s => s.stages)).size + ' boots; --run --base <the page> takes them (A0\'s GPU box)');
  process.exit(0);
}
// --run: one cloud_shot.js boot per stage value (the career's tracks are read at load), its shots in one go
const BASE = opt('base', 'http://localhost:8480/flyDiy/index.html'), OUT = opt('out', 'screenshots/stages');
const byBoot = new Map();
for (const s of shots) { const k = s.stages || 'sandbox'; if (!byBoot.has(k)) byBoot.set(k, []); byBoot.get(k).push(s); }
for (const [k, list] of byBoot) {
  const url = BASE + '?world=jolene' + (k === 'sandbox' ? '' : '&career=1&stages=' + k);
  const spec = list.map(s => s.name + ':' + s.eye.join(',') + ':' + s.yaw + ':' + s.pitch + ':').join('@@');
  const at = list[0].eye.join(',');
  console.log('stages_shot: ' + url + ' - ' + list.length + ' shots');
  const r = cp.spawnSync(process.execPath, [path.join(T, 'cloud_shot.js'), '--url', url, '--at', at, '--out', OUT, '--shots', spec], { stdio: 'inherit' });
  if (r.status) console.log('stages_shot: cloud_shot.js exited ' + r.status + ' on ' + k);
}
