#!/usr/bin/env node
// winch_shot.js - the stills of the glider launch winch (tools/_winch_gen.js) off its page (tools/_winch.html),
// headless (Chromium + SwiftShader, no GPU), about 2 s a picture:
//
//   node tools/winch_shot.js <out-dir> [--views q,side,rear,chute] [--preset 'club twin-drum']
//
// Writes <out-dir>/winch_<view>.png (1600 x 1200).
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--views' && argv[argv.indexOf(a) - 1] !== '--preset') || '.');
const VIEWS = opt('views', 'q,side,rear,chute').split(',');
const PRESET = opt('preset', '');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());   // no network for the stills
  const url = 'file://' + path.join(__dirname, '_winch.html');
  for (const v of VIEWS) {
    const t0 = Date.now();
    await page.goto(url + '?shot=' + v + (PRESET ? '&preset=' + encodeURIComponent(PRESET) : ''));
    await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
    const file = path.join(OUT, 'winch_' + v + '.png');
    await page.locator('#view').screenshot({ path: file });
    console.log(file, Date.now() - t0, 'ms');
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
