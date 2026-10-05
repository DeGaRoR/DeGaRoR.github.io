#!/usr/bin/env node
// GATE SOFTGPU - THE GAME DRAWS ITS WORLD ON A SOFTWARE GPU (G1460, SOFT-GPU, 2026-10-04).
//
//   node tools/_softgpu_check.js                 -> "GATE SOFTGPU: PASS|FAIL|SKIP", exit 1 on FAIL
//   --page=index.html|dev.html (default index.html)   --secs=S (the whole run's budget, default 2400)
//   --out=<jpg> (the still; default the scratch dir's)  --json=<file>
//
// Every cloud session has a headless Chromium on SwiftShader and no graphics card; until G1460 the game drew its UI
// there and not its world. This boots the REAL page there through tools/soft_still.js - the garage, Roll out, the
// stand - and asserts on what a player would see (tier 'full': it is slow, ~10-20 min on a 4-core cloud box):
//   1 the page knew it was on a software renderer: GFX.soft() names the tier 'software' and the renderer string is
//     a software one, the preset the rung chose is potato (no ?gfx= given);
//   2 the garage boot ran its whole chain (BOOT 'gone' with every step run, no hard timeout lifting it early) and the
//     roll-out reached the stand (a trip done, the stand's verbs up);
//   3 ONE DRAWN FRAME OF THE WORLD: the still is not the clear colour (under 50 % of its pixels the renderer's clear
//     colour) nor one flat colour (the most common 5-bit colour under 60 %), its lower half - the ground under the
//     horizon - has texture (luma spread > 4), and the frame drew the world (the scene pass's draw calls > 20);
//   4 THE AEROPLANE IS IN IT: the same frame with the craft hidden differs from it (> 0.3 % of the pixels by more
//     than 12/255) - the aeroplane and its shadow drawn, not the sky behind an empty stand;
//   5 no page error (an uncaught exception, a console error).
// SKIP (exit 0) only when there is no Playwright / Chromium on the machine (the box's own gates have no use for it).
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fails++; };

(async () => {
  let SS;
  try { SS = require('./soft_still.js'); require.resolve('playwright', { paths: [process.cwd(), '/opt/node-tools/node_modules'] }); }
  catch (e) {
    let have = false; try { require('/opt/node-tools/node_modules/playwright'); have = true; } catch (x) {}
    if (!have) { console.log('  no Playwright here - the gate is a cloud session\'s (headless Chromium + SwiftShader)'); console.log('GATE SOFTGPU: SKIP'); process.exit(0); }
  }
  const out = arg('out', path.join(os.tmpdir(), 'softgpu_stand.jpg'));
  const o = Object.assign(SS.parse.call(null), {
    page: arg('page', 'index.html'), place: 'stand', build: 'default', day: 'afternoon', size: [960, 540], quality: 80,
    secs: +arg('secs', 2400), out, aeroCheck: true, quiet: false, frames: 3, gfx: null, q: '', cam: null, orbit: null, keepHud: false,
  });
  let R;
  try { R = await SS.still(o); }
  catch (e) { ok(false, 'the run: ' + (e && e.message)); console.log('GATE SOFTGPU: FAIL'); process.exit(1); }
  if (arg('json', null)) fs.writeFileSync(arg('json', null), JSON.stringify(R, null, 1));
  const P = R.picture || {}, I = R.info || {};
  console.log('  SOFTGPU ' + JSON.stringify({ t: R.t, gpu: R.gpu, soft: R.soft, info: I, picture: P, aero: R.aero, trip: R.trip }));
  // 1
  ok(!!R.soft && R.soft.tier === 'software' && /SwiftShader|llvmpipe|softpipe|Software/i.test(R.gpu || ''), 'the software rung is on: ' + (R.soft && R.soft.tier) + ' on ' + R.gpu);
  ok(!!R.soft && R.soft.preset === 'potato', 'the rung chose potato with no ?gfx= (' + (R.soft && R.soft.preset) + ')');
  // 2
  ok(R.t && R.t.garage > 0 && R.bootDone === true && !R.hardTimeout, 'the garage boot ran its whole chain (' + R.bootSteps + ' steps, ' + (R.t && R.t.garage) + ' s' + (R.hardTimeout ? ', HARD TIMEOUT' : '') + ')');
  ok(R.t && R.t.stand > 0 && R.trip && R.trip.kind, 'the roll-out reached the stand (' + (R.t && R.t.stand) + ' s, trip ' + JSON.stringify(R.trip) + ')');
  // 3
  ok(P.clearShare < 0.5, 'the still is not the clear colour (' + (100 * P.clearShare).toFixed(1) + ' % of the pixels are)');
  ok(P.topShare < 0.6, 'nor one flat colour (the most common is ' + (100 * P.topShare).toFixed(1) + ' %, ' + P.colours + ' colours)');
  ok(P.lowerSd > 4, 'the ground under the horizon has texture (the lower half\'s luma spread ' + P.lowerSd + ')');
  ok(R.sceneCalls > 20, 'the frame drew the world (' + R.sceneCalls + ' draw calls in the scene pass, ' + R.sceneTris + ' triangles)');
  // 4
  ok(!!R.aero && R.aero.share > 0.003, 'the aeroplane is in it: hidden, ' + (R.aero ? (100 * R.aero.share).toFixed(2) + ' % of the pixels change (mean ' + R.aero.mean + ')' : 'no craft handle'));
  // 5
  ok(!R.errors.length, 'no page error' + (R.errors.length ? ': ' + R.errors.slice(0, 3).join(' | ') : ''));
  console.log('  the still: ' + out + ' (' + R.t.total + ' s in all)');
  console.log(fails ? 'GATE SOFTGPU: FAIL' : 'GATE SOFTGPU: PASS');
  process.exit(fails ? 1 : 0);
})();
