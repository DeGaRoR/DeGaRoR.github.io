#!/usr/bin/env node
// ground_shot.js - ROCK-STUDY R1's stills: ground_bench.html (the game's splat on Mount Ardent) with the dial off and on,
// from the same eyes, on headless Chromium + SwiftShader. Writes <out>/<view>_rocks{0,1}.png and results.json (the program
// linked, its sampler count, the fragment text's length, ms a frame - SwiftShader's, read as ratios only, the eyes).
//   node flyDiy/tools/rock_study/ground_shot.js [--views face,near,high,far] [--out flyDiy/reports/evidence/ROCK-STUDY/r1]
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const REPO = path.join(__dirname, '..', '..', '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(REPO, 'flyDiy', 'reports', 'evidence', 'ROCK-STUDY', 'r1'))), VIEWS = opt('views', 'face,near,high,far').split(',');
const W = +opt('w', 1280), H = +opt('h', 720), FR = +opt('frames', 4);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.wasm': 'application/wasm' };
const srv = http.createServer((q, r) => { const p = path.join(REPO, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port; fs.mkdirSync(OUT, { recursive: true });
  const RES = { cases: {} };
  for (const rk of (opt('rocks', '0,1')).split(',').map(Number)) {
    const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: W, height: H } }), logs = [];
    page.on('console', m => logs.push(m.type() + ': ' + m.text())); page.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await page.goto(`http://localhost:${port}/flyDiy/tools/rock_study/ground_bench.html?rocks=${rk}&${opt('qs', '')}&view=${VIEWS[0]}&w=${W}&h=${H}`);
    await page.waitForFunction('window.GB', null, { timeout: 900000, polling: 500 });
    const info = await page.evaluate('({ ring0: GB.ring, error: GB.error, buildMs: GB.buildMs, firstMs: GB.firstMs, fsLen: GB.fsLen, samplers: GB.samplers, linked: GB.linked, layers: GB.layers, trOn: GB.trOn, eyes: GB.eyes, errs: GB.errs })');
    if (info.error) { console.log(info.error, logs.join('\n')); process.exit(1); }
    { const bad = logs.find(l => /Shader Error|not compiled|CONTEXT_LOST/.test(l)); if (bad) { console.log('rocks=' + rk + ' FAILED: ' + bad.slice(0, 6000)); process.exit(1); } }
    info.ms = {}; console.log('rocks=' + rk + ' ready', JSON.stringify({ buildMs: info.buildMs, firstMs: info.firstMs, linked: info.linked, samplers: info.samplers, trOn: info.trOn, fsLen: info.fsLen, errs: info.errs }));
    for (const v of VIEWS) { info.ring = info.ring || {}; info.ring[v] = await page.evaluate(`GB.viewRing('${v}')`); info.ms[v] = (await page.evaluate(`GB.measure(${FR})`)).median;
      const url = await page.evaluate('document.querySelector("canvas").toDataURL("image/png")'); fs.writeFileSync(path.join(OUT, `${v}_rocks${rk}${opt('tag', '')}.png`), Buffer.from(url.split(',')[1], 'base64')); }
    info.logs = logs.filter(l => !/^debug|^verbose/.test(l)).slice(0, 30);
    RES.cases['rocks' + rk] = info; console.log('rocks=' + rk, JSON.stringify(Object.assign({}, info, { eyes: undefined, layers: info.layers.length + ' layers' })));
    await page.close(); await browser.close();
  }
  { const f = path.join(OUT, 'results.json'), old = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { cases: {} }; Object.assign(old.cases, RES.cases); fs.writeFileSync(f, JSON.stringify(old, null, 1)); }
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
