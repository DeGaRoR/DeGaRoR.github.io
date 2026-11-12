#!/usr/bin/env node
// CAR DRIVE SHOT (CAR, 13 Nov; the user's must-land list: "put the car in the garage, roll out, pick a destination, drive
// there"): the garage car's roll-out in the REAL page, headless Chromium (SwiftShader). Boots `<page>` (the garage), brings
// a car build in through the fleet's Import (#gFile - the user's door), checks it is a car (window.VEHICLE_KIND) with four
// wheel contacts, presses the garage's roll-out (DRIVE.enter: the car measured on the stand - car_sheet_core.js
// carFromGarage - then rolled out and handed to the drive mode), waits for the drive, then fast-forwards it
// (DRIVE_MODE.ahead) and takes a still at each time asked, printing the vehicle's name, its sheet, the rig and the HUD.
// Serve the REPO ROOT first:
//   python3 -m http.server 8765 --bind 127.0.0.1        (from the repository root)
//   node tools/car_drive_shot.js <build.json> <out-prefix> [dev.html|index.html] [t1,t2,...  seconds of driving] [--to <place>]
// Writes <out-prefix>_t<sec>.png and <out-prefix>_log.txt.
'use strict';
const fs = require('fs'), path = require('path');
const pw = require('playwright');
const args = process.argv.slice(2);
const toI = args.indexOf('--to'), TO = toI >= 0 ? args.splice(toI, 2)[1] : null;
const [BUILD, OUT, PAGE0, TIMES] = args;
const PAGE = PAGE0 || 'dev.html';
if (!BUILD || !OUT) { console.error('usage: node tools/car_drive_shot.js <build.json> <out-prefix> [dev.html] [t1,t2,...] [--to <place>]'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await pw.chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
  const page = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const t = m.type() + ': ' + m.text(); if (/drive|car|error|warn|Drive/i.test(t)) logs.push(t.slice(0, 400)); });
  page.on('pageerror', e => logs.push('PAGEERROR ' + e.message.slice(0, 400)));
  page.on('dialog', d => { logs.push('DIALOG ' + d.message()); d.dismiss().catch(() => {}); });
  const t0 = Date.now(), el = () => ((Date.now() - t0) / 1000).toFixed(0) + ' s';
  await page.goto('http://127.0.0.1:8765/flyDiy/' + PAGE, { waitUntil: 'load', timeout: 300000 });
  for (let i = 0; i < 300; i++) {
    const ok = await page.evaluate(() => !!(document.getElementById('gFile') && window.GARAGE_SPEC && window.CAGE_JOIN && window.DRIVE)).catch(() => false);
    if (ok) break; await sleep(2000);
  }
  console.log('garage up', el());
  await page.setInputFiles('#gFile', path.resolve(BUILD));
  let st = null;
  for (let i = 0; i < 120; i++) {
    st = await page.evaluate(() => { const s = GARAGE_SPEC.get(); const G = window.CAGE_GEAR;
      return { kind: window.VEHICLE_KIND ? window.VEHICLE_KIND(s) : null, name: s && s.meta && s.meta.name, contacts: G && G.contacts ? G.contacts.length : 0 }; }).catch(e => ({ err: e.message }));
    if (st.kind === 'car' && st.contacts === 4) break; await sleep(1000);
  }
  console.log('loaded', el(), JSON.stringify(st));
  await sleep(3000);
  await page.evaluate(to => { window.DRIVE.enter(to || undefined); }, TO);
  let on = null;
  for (let i = 0; i < 900; i++) {
    on = await page.evaluate(() => ({ on: !!(window.DRIVE_MODE && DRIVE_MODE.on), busy: !!(window.DRIVE && DRIVE.busy), car: !!(window.DRIVE && DRIVE.car) })).catch(e => ({ err: e.message }));
    if (on.on || (!on.busy && i > 5)) break; await sleep(2000);
  }
  console.log('drive', el(), JSON.stringify(on));
  if (!on.on) { fs.writeFileSync(OUT + '_log.txt', logs.join('\n')); console.log(logs.slice(-15).join('\n')); await b.close(); process.exit(1); }
  const info = await page.evaluate(() => { const V = DRIVE_MODE.vehicleSource, S = V && V.sheet;
    return { name: DRIVE_MODE.name, garageCar: !!V, mass: S && S.estimates.mass_kg, wb: S && S.wheelbase, track: S && S.track, drive: S && S.drive,
             to: DRIVE_MODE.to, from: DRIVE_MODE.from, choices: DRIVE_MODE.choices().map(c => c.label).slice(0, 12), words: DRIVE_MODE.words() }; });
  console.log(JSON.stringify(info));
  const diag = await page.evaluate(() => ({ rig: DRIVE_MODE.rigInfo ? DRIVE_MODE.rigInfo() : null, body: document.body.className,
    cam: window.CAMERA ? [CAMERA.position.x, CAMERA.position.y, CAMERA.position.z].map(v => +v.toFixed(1)) : null }));
  console.log('diag', JSON.stringify(diag));
  const shots = (TIMES || '0,20,60').split(',').map(Number);
  let done = 0;
  for (const t of shots) {
    if (t > done) { const r = await page.evaluate(s => DRIVE_MODE.ahead(s), t - done); done = t; console.log('ahead to', t, JSON.stringify(r)); }
    await sleep(6000);
    await page.screenshot({ path: OUT + '_t' + t + '.png', timeout: 300000 });
    const w = await page.evaluate(() => ({ w: DRIVE_MODE.words(), hud: [...document.querySelectorAll('#pfdRow .rd:not([hidden])')].map(c => c.textContent.trim()).join(' | ') }));
    console.log('shot', t, el(), JSON.stringify(w));
  }
  fs.writeFileSync(OUT + '_log.txt', logs.join('\n'));
  console.log('logs:', logs.length, logs.slice(-6).join('\n'));
  await b.close();
})().catch(e => { console.error('RIG', e); process.exit(1); });
