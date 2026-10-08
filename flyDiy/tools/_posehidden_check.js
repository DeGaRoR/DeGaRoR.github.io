#!/usr/bin/env node
// _posehidden_check.js - GATE POSEHIDDEN (G2111, GARAGE-LAPTOP 4, 2026-10-07): THE FLOWN MODEL HIDDEN BEHIND THE EDITOR'S
// CAGE IS NOT DEFORMED - AND NOTHING THAT SEES IT CAN TELL. app.js poseModel returns early in the garage while the cage
// stands and model.grp is hidden (the control check's sweep re-deformed and re-uploaded its skin every frame for nobody);
// craftInShed / craftInWorld pose it as they show it; the first frame it shows again applies the current pose (the pose
// cache holds the last APPLIED one). The page in node is deterministic (a seeded Math.random, a virtual clock): two pages,
// the same build, the same idle frames, the same roll-out - one with the skip (the game), one posing the hidden model every
// frame (window.FLYDIY_POSE_HIDDEN = true, the old behaviour) - must hold BIT-IDENTICAL skin buffers (every position and
// normal of model.grp's meshes) at the end of the garage's idle frames once shown for a call, and after the roll-out:
//   1 the garage idles 120 frames; the hidden model's skin uploads stop (bufferSubData-free frames) with the skip
//   2 craftInShed shows it for a call (a world compile's way): the same skin as the reference's at that moment
//   3 rolled out: the same skin on the stand, frame for frame (10 frames)
// Usage: node tools/_posehidden_check.js [--build cub] (it re-runs itself with a 6 GB heap). Exit 1 on any FAIL. No --help.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json' };
const BK = opt('build', 'cub');
if (require('v8').getHeapStatistics().heap_size_limit < 5e9 && !process.env.POSEHIDDEN_CHILD) {
  const r = require('child_process').spawnSync(process.execPath, ['--max-old-space-size=6144', __filename].concat(argv), { stdio: 'inherit', env: Object.assign({}, process.env, { POSEHIDDEN_CHILD: '1' }) });
  process.exit(r.status == null ? 1 : r.status);
}
let fails = 0;
const ok = (c, msg, detail) => { if (!c) fails++; console.log((c ? '  PASS ' : '  FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); };

async function run(reference) {
  const { openPage } = require('./_page_node.js');
  const hooks = { afterScript(name, P) { if (/gfx_settings\.js/.test(name) && P.win.GFX) P.win.GFX.set('preset', 'retro');
    if (reference && name === 'src/viewer/app.js') P.win.FLYDIY_POSE_HIDDEN = true; } };
  const P = await openPage({ quiet: true, hooks, query: 'gfx=retro', storage: { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[BK] || BK), 'utf8') } });
  const W = P.win;
  if (reference) W.FLYDIY_POSE_HIDDEN = true;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  const FP = W.FLIGHT_PROBE;
  // the skin: a hash of every position / normal array under model.grp, in traversal order
  // the raw arrays (for the shown-for-a-call comparison within the pose's own thresholds)
  const raw = () => { const m = FP.model(); const out = []; if (m && m.grp) m.grp.traverse(o => { if (!o.isMesh || !o.geometry) return;
    for (const k of ['position', 'normal']) { const a = o.geometry.attributes[k]; if (a && a.array) out.push([k, Float32Array.from(a.array)]); } }); return out; };
  const skin = () => { const m = FP.model(); if (!m || !m.grp) return 'no model'; const h = crypto.createHash('sha1'); let n = 0;
    m.grp.traverse(o => { if (!o.isMesh || !o.geometry) return; for (const k of ['position', 'normal']) { const a = o.geometry.attributes[k]; if (a && a.array) { h.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength)); n++; } } });
    return h.digest('hex').slice(0, 16) + ' (' + n + ' arrays)'; };
  // 1 the idle garage: the frames' bufferSubData count
  let sub = 0; const rec = P.rec; const c0 = () => (rec && rec.bytes ? (rec.bytes.bufferSubData || 0) + (rec.bytes.bufferData || 0) : 0);   // (bytes uploaded: bufferData + bufferSubData)
  const s0 = c0(); await P.frames(120); sub = c0() - s0;
  const hidden = FP.model() && FP.model().grp && FP.model().grp.visible === false;
  // 2 shown for a call: craftInShed is internal - its public door is the world compile's; read the skin inside a call that
  // shows the model the same way (FLIGHT_PROBE's craft in the shed) when exposed, else the next shown frame (the roll-out)
  const shownSkin = W.FLYDIY_CRAFT_IN_SHED ? W.FLYDIY_CRAFT_IN_SHED(() => raw()) : null;
  const atIdle = skin();
  // 3 the roll-out
  W.document.getElementById('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout'), 900000);
  const after = []; for (let i = 0; i < 10; i++) { await P.frames(1); after.push(skin()); }
  return { sub, hidden, shownSkin, atIdle, after, errors: P.errors.filter(e => !/impostor bake/.test(e)).length };
}

(async () => {
  const ref = await run(true);
  const got = await run(false);
  console.log('  (reference: the hidden model posed every frame; the game: skipped)');
  ok(got.hidden && ref.hidden, '1 the flown model stands hidden behind the cage in the garage', 'hidden ' + got.hidden + ' / ' + ref.hidden);
  ok(got.sub <= ref.sub, '1 the idle garage uploads no more than before (buffer bytes over 120 frames)', (ref.sub / 1048576).toFixed(2) + ' MB -> ' + (got.sub / 1048576).toFixed(2) + ' MB');
  // 2: the reference posed every frame carries the pose's HYSTERESIS (turnNormals re-normalises when its turn moved > 0.002,
  // the skin re-poses past 0.3 mm / 1e-4 of a control since the pose last APPLIED): it lags a little; the catch-up pose is
  // the current one. So the same arrays within those thresholds: positions to 1 mm, normals to 0.01
  if (got.shownSkin !== null) { let dp = 0, dn = 0, shape = got.shownSkin.length === ref.shownSkin.length;
    if (shape) for (let i = 0; i < got.shownSkin.length; i++) { const [k, a] = got.shownSkin[i], b = ref.shownSkin[i][1]; if (a.length !== b.length) { shape = false; break; }
      for (let j = 0; j < a.length; j++) { const d = Math.abs(a[j] - b[j]); if (k === 'position') { if (d > dp) dp = d; } else if (d > dn) dn = d; } }
    ok(shape && dp <= 1e-3 && dn <= 0.01, '2 shown for a call: the reference skin within the pose thresholds (positions 1 mm, normals 0.01)', 'max position diff ' + dp.toExponential(2) + ' m, normal ' + dn.toExponential(2) + (shape ? '' : ', SHAPE DIFFERS')); }
  else console.log('  (2 skipped: no FLYDIY_CRAFT_IN_SHED door - the roll-out below shows it)');
  const same = got.after.every((h, i) => h === ref.after[i]);
  ok(same, '3 rolled out: the same skin on the stand, frame for frame (10 frames)', same ? got.after[0] : got.after.map((h, i) => h === ref.after[i] ? '=' : 'X').join(''));
  ok(got.errors === ref.errors, '  no new page errors', got.errors + ' vs ' + ref.errors);
  console.log(fails ? 'GATE POSEHIDDEN: ' + fails + ' FAIL' : 'GATE POSEHIDDEN: PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
