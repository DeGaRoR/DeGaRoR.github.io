#!/usr/bin/env node
// shot.js - ROCK-STUDY stills + costs, headless Chromium on SwiftShader (no GPU needed). Run from anywhere:
//   node flyDiy/tools/rock_study/shot.js [--only base_face,a_face] [--frames 8] [--out flyDiy/reports/evidence/ROCK-STUDY]
// Serves the repository root, opens bench.html once per case (a case = a query string + a view), saves <case>.png,
// and writes results.json: ms a frame (median of --frames, gl.finish), draws, triangles, texture fetches per ground pixel
// (?count=1 render of the same case), the fragment program's size. SwiftShader's ms are RELATIVE (a CPU rasteriser):
// read them as ratios against BASE, not as a phone's frame time. --only mesh,kit for the mesh way alone.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const REPO = path.join(__dirname, '..', '..', '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(REPO, 'flyDiy', 'reports', 'evidence', 'ROCK-STUDY')));
const FRAMES = +opt('frames', 6), ONLY = opt('only', '') ? opt('only', '').split(',') : null;
const W = +opt('w', 1280), H = +opt('h', 720);
// --timing: no stills, no count - the ground's cost alone (shadows off, the same eye), --frames each, interleaved
// rounds (every case once per round, --rounds rounds) so a slow spell of the machine lands on every case alike
const TIMING = argv.includes('--timing'), ROUNDS = +opt('rounds', 3);
const CASES = [
  // [name, query, views] - the views each case is shot from (face 230 m, near 105 m, high ~800 m out and 520 m up, slope 70 m)
  ['base', '', 'face,near,high,slope'],
  ['a_detail', 'rock=detail', 'face,near,high'],
  ['b_biplanar', 'tri=bi', 'face,near'],
  ['b_oneplane', 'tri=one', 'near'],
  ['b_nohex', 'hex=0', 'near'],
  ['c_expo', 'expo=1', 'face,high'],
  ['c_strata', 'strata=1', 'face,near'],
  ['c_expo_strata', 'expo=1&strata=1', 'face,near,high'],
  ['d_scatter', 'scatter=1', 'face,near,slope,high'],
  ['e_skirt', 'skirt=1.25', 'face,near'],
  ['e_skirt_plain', 'skirt=1.25&plain=1', 'near'],
  ['base_plain', 'plain=1', 'near'],
  ['e_skirt25', 'skirt=2.5', 'face,near,high'],
  ['best', 'rock=detail&tri=bi&expo=1&strata=1&scatter=1', 'face,near,high,slope'],
  ['best_skirt', 'rock=detail&tri=bi&expo=1&scatter=1&skirt=2.5', 'face,near,high'],
  // THE MESH WAY (the user's direction, 13 Nov): the procedural rock kit on the faces and the slopes
  ['mesh', 'mesh=1', 'face,near,high,slope'],
  ['mesh_eco', 'mesh=1&eco=1', 'face,near'],
  ['mesh_cliff', 'mesh=cliff', 'face'],
  ['mesh_scatter', 'mesh=scatter', 'face'],
  ['mesh_plain', 'mesh=1&plain=1', 'near,top'],
  ['kit', 'kit=1', 'face'],
];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.bin': 'application/octet-stream' };
const srv = http.createServer((q, r) => { const p = path.join(REPO, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  if (TIMING) {
    const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const tv = opt('tviews', 'face,near').split(','), T = {};
    const pages = [];
    for (const [name, qs] of CASES) for (const view of tv) { const key = name + '_' + view; if (ONLY && !ONLY.includes(key) && !ONLY.includes(name)) continue;
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      await page.goto(`http://localhost:${port}/flyDiy/tools/rock_study/bench.html?${qs}&view=${view}&w=${W}&h=${H}&shadows=0`);
      await page.waitForFunction('window.BENCH', null, { timeout: 600000, polling: 500 });
      await page.evaluate('window.BENCH.measure(2)');   // (warm: the program linked, the arrays' mips made)
      pages.push([key, page]); T[key] = []; }
    for (let r = 0; r < ROUNDS; r++) for (const [key, page] of pages) { const m = await page.evaluate(`window.BENCH.measure(${FRAMES})`); T[key].push(m.median); }
    const out = {}; for (const k in T) { const a = T[k].slice().sort((x, y) => x - y); out[k] = { median: a[a.length >> 1], all: T[k] }; console.log(k.padEnd(24), a.map(v => v.toFixed(0)).join(' / ')); }
    fs.writeFileSync(path.join(OUT, 'timing.json'), JSON.stringify(out, null, 1));
    await browser.close(); srv.close(); return;
  }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--enable-privileged-webgl-extensions'] });
  const resFile = path.join(OUT, 'results.json');
  const results = fs.existsSync(resFile) ? JSON.parse(fs.readFileSync(resFile, 'utf8')) : {};
  for (const [name, qs, vs] of CASES) for (const view of vs.split(',')) {
    const key = name + '_' + view; if (ONLY && !ONLY.includes(key) && !ONLY.includes(name)) continue;
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('console', m => { if (m.type() === 'error') console.log('  [page]', m.text().slice(0, 300)); });
    const url = `http://localhost:${port}/flyDiy/tools/rock_study/bench.html?${qs}&view=${view}&w=${W}&h=${H}`;
    const t0 = Date.now();
    await page.goto(url);
    await page.waitForFunction('window.BENCH', null, { timeout: 600000, polling: 500 });
    const ok = await page.evaluate('window.BENCH.ready'); if (!ok) { console.log(key, 'FAILED', await page.evaluate('window.BENCH.error')); await page.close(); continue; }
    await page.evaluate('document.getElementById("msg").style.display="none"');
    await page.evaluate('window.BENCH.render()');
    await page.screenshot({ path: path.join(OUT, key + '.png') });
    const ms = await page.evaluate(`window.BENCH.measure(${FRAMES})`);
    const info = await page.evaluate('window.BENCH.info()');
    const frag = await page.evaluate('window.BENCH.fragSource()');
    await page.close();
    // the fetch count: the same case with ?count=1
    const p2 = await browser.newPage({ viewport: { width: W, height: H } });
    await p2.goto(url + '&count=1&shadows=0'); await p2.waitForFunction('window.BENCH', null, { timeout: 600000, polling: 500 });
    const cnt = await p2.evaluate('window.BENCH.counts()'); await p2.close();
    results[key] = { qs, view, ms, calls: info.calls, tris: info.tris, stat: info.stat, frag, count: cnt, loadMs: info.loadMs, faceSlope: info.faceSlope };
    console.log(`${key.padEnd(22)} ${ms.median.toFixed(0).padStart(6)} ms  ${String(info.calls).padStart(3)} draws ${(info.tris / 1000).toFixed(0).padStart(6)} k tris  ${cnt.fetchesPerPx.toFixed(1).padStart(5)} fetch/px (max ${cnt.maxFetches})  [${((Date.now() - t0) / 1000).toFixed(0)} s]`);
    fs.writeFileSync(resFile, JSON.stringify(results, null, 1));
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
