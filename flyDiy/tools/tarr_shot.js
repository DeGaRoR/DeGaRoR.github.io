#!/usr/bin/env node
// tarr_shot.js - THE TOWN ON TEXTURE ARRAYS, PHOTOGRAPHED (G571). Opens tools/_tarr.html in a browser, runs
// window.TARR_RUN() and writes, per view, a PNG of three bands - the street as drawn before the bake, the street on
// house_tarr.js's stack, and the difference x4 - with the draw counts and the mean pixel difference printed.
//
//   node tools/tarr_shot.js [--url http://localhost:8125/flyDiy/tools/_tarr.html] [--out screenshots/tarr]
//                           [--chrome <path>] [--gl swiftshader|gpu]
//
// Playwright (a global install is found through NODE_PATH or npm root -g); Chrome or the pinned Chromium.
// A MEASUREMENT, not a gate: GATE TARR holds the shader edits and the merge headless.
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8125/flyDiy/tools/_tarr.html');
const OUT = opt('out', path.join(__dirname, '..', 'screenshots', 'tarr'));
let pw;
try { pw = require('playwright'); } catch (e) {
  const g = require('child_process').execSync('npm root -g').toString().trim();
  pw = require(path.join(g, 'playwright'));
}
(async () => {
  const exe = opt('chrome', ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p)));
  const args = opt('gl', 'swiftshader') === 'gpu' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const logs = [];
  page.on('console', m => { if (/^tarr:/.test(m.text())) console.log(m.text().slice(0, 400)); else if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => typeof window.TARR_RUN === 'function', null, { timeout: 60000 });
  const r = await page.evaluate(() => window.TARR_RUN());
  fs.mkdirSync(OUT, { recursive: true });
  for (const v of r.views) { fs.writeFileSync(path.join(OUT, v.name + '.png'), Buffer.from(v.png.split(',')[1], 'base64')); delete v.png; }
  console.log(JSON.stringify(r, null, 1));
  if (logs.length) console.log('console:\n' + [...new Set(logs)].slice(0, 30).join('\n'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
