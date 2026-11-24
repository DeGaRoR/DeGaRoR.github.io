#!/usr/bin/env node
// winch_shot.js - the stills of the glider launch winch (tools/_winch_gen.js) off its page (tools/_winch.html),
// headless (Chromium + SwiftShader, no GPU), about 2 s a picture:
//
//   node tools/winch_shot.js <out-dir> [--views q,side,rear,chute] [--preset 'club twin-drum'] [--wx new|club|tired]
//
// Writes <out-dir>/winch_<view>.png (1600 x 1200).
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
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
  // served over http from flyDiy/ (a file:// page cannot hand its scans to WebGL: they are cross-origin there)
  const ROOT = path.join(__dirname, '..'), TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
  const srv = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const url = 'http://127.0.0.1:' + srv.address().port + '/tools/_winch.html';
  const WXQ = opt('wx', '');
  for (const v of VIEWS) {
    const t0 = Date.now();
    await page.goto(url + '?shot=' + v + (PRESET ? '&preset=' + encodeURIComponent(PRESET) : '') + (WXQ ? '&wx=' + WXQ : '') + (opt('pin', '') ? '&pin=' + encodeURIComponent(opt('pin')) : ''));
    await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
    const file = path.join(OUT, 'winch_' + v + (WXQ ? '_' + WXQ : '') + (opt('tag', '') ? '_' + opt('tag') : '') + '.png');
    await page.locator('#view').screenshot({ path: file });
    console.log(file, Date.now() - t0, 'ms');
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
