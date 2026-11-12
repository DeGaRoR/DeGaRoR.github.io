#!/usr/bin/env node
// DRIVE SHOT (TOW-LAUNCH phase 1): the drive mode in the REAL page, headless Chromium (SwiftShader - a cloud box's software
// WebGL: the island boots in ~9 min, a still takes ~1 min). Boots `<page>?drive=1&town=1` (the town ON: Cedar Harbour's
// streets), waits for the car, then fast-forwards the drive (DRIVE_MODE.ahead) and takes a still at each time asked,
// printing the HUD's cells and the status line beside it. Serve the REPO ROOT first:
//   python3 -m http.server 8765 --bind 127.0.0.1        (from the repository root)
//   node tools/drive_shot.js <out-prefix> [dev.html|index.html] [t1,t2,...  seconds of driving]
// Writes <out-prefix>_t<sec>.png and <out-prefix>_log.txt. Under SwiftShader the HUD's text lags the 3D frame by a
// still (its 0.1 s cadence at seconds a frame); on a GPU it does not. GATE DRIVE-TRIP's PAGE row source-checks the wiring.
'use strict';
const fs = require('fs'), pw = require('playwright');
const OUT = process.argv[2], PAGE = process.argv[3] || 'dev.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await pw.chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
  const page = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const t = m.type() + ': ' + m.text(); if (/drive|error|warn|Drive/i.test(t)) logs.push(t.slice(0, 400)); });
  page.on('pageerror', e => logs.push('PAGEERROR ' + e.message.slice(0, 400)));
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:8765/flyDiy/' + PAGE + '?drive=1&town=1', { waitUntil: 'load', timeout: 300000 });
  let st = null;
  for (let i = 0; i < 900; i++) {
    st = await page.evaluate(() => ({ boot: window.BOOT && BOOT.state, on: !!(window.DRIVE_MODE && DRIVE_MODE.on), busy: !!(window.DRIVE && DRIVE.busy) })).catch(e => ({ err: e.message }));
    if (st.on) break;
    await sleep(2000);
  }
  console.log('after', ((Date.now() - t0) / 1000).toFixed(0), 's:', JSON.stringify(st));
  fs.writeFileSync(OUT + '_log.txt', logs.join('\n'));
  if (!st.on) { console.log(logs.slice(-15).join('\n')); await b.close(); return; }
  const info = await page.evaluate(() => ({ graphMs: DRIVE_MODE.graphMs, planMs: DRIVE_MODE.planMs, to: DRIVE_MODE.to, from: DRIVE_MODE.from, choices: DRIVE_MODE.choices().map(c => c.label), words: DRIVE_MODE.words(), trip: document.getElementById('flRouteB') && document.getElementById('flRouteB').textContent }));
  console.log(JSON.stringify(info));
  const shots = (process.argv[4] || '0,20,60,240,500,700,900').split(',').map(Number);
  let done = 0;
  for (const t of shots) {
    if (t > done) { const r = await page.evaluate(s => DRIVE_MODE.ahead(s), t - done); done = t; console.log('ahead to', t, JSON.stringify(r)); }
    await sleep(6000);   // the camera eases, the world streams round the eye
    await page.screenshot({ path: OUT + '_t' + t + '.png', timeout: 300000 });
    const w = await page.evaluate(() => ({ w: DRIVE_MODE.words(), ms: DRIVE_MODE.ms, hud: [...document.querySelectorAll('#pfdRow .rd:not([hidden])')].map(c => c.textContent.trim()).join(' | ') }));
    console.log('shot', t, JSON.stringify(w));
  }
  fs.writeFileSync(OUT + '_log.txt', logs.join('\n'));
  console.log('logs:', logs.length, logs.slice(-6).join('\n'));
  await b.close();
})().catch(e => { console.error('RIG', e); process.exit(1); });
