#!/usr/bin/env node
// bench_shot.js (G3514, NEW-SHAPES-1) - PICTURES OF A BUILD ON THE CAGE BENCH (tools/_cage8.html), headless.
// The bench page (the editor's own layers, its own orbit), the build put in through the bench's own load door
// (CAGE_UI.applySpec - what its "import" button calls), the side panel hidden, one PNG per view off the bench's own
// camera (CAGE_UI.setView: yaw, pitch, zoom). Runs on a box with no GPU: Chromium with SwiftShader (slow: ~1-3 min a
// build to come up, ~10 s a view).
//   (serve the repo root first: python3 -m http.server 8450, from the repo root)
//   node tools/bench_shot.js --file tools/fixtures/stearman_2026-10.json --out screenshots/newshapes/stearman
//        [--url http://localhost:8450/flyDiy/tools/_cage8.html] [--views q,s,top,r,c] [--w 1600 --h 1000]
//        [--set '{"cpOpen":0}']   rows written over the file's cage before the load (a before / after)  [--log]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8450/flyDiy/tools/_cage8.html');
const FILE = opt('file', null), OUT = opt('out', 'screenshots/bench');
const W = +opt('w', 1600), H = +opt('h', 1000);
// yaw (0 = from the nose; the cage's +z is the nose), pitch, zoom
const VIEW = {
  q:   [0.75, 0.35, 0.55],         // the quarter, from ahead and above
  s:   [Math.PI / 2, 0.02, 0.55],  // the side
  f:   [0.0, 0.10, 0.6],           // the front
  top: [Math.PI / 2, 1.30, 0.55],  // from above: the openings in plan
  r:   [2.45, 0.40, 0.55],         // the rear quarter
  c:   [0.95, 0.55, 1.3],          // the cockpits, close
};
const VIEWS = opt('views', 'q,s,top,r,c').split(',');
(async () => {
  const pw = require('playwright');
  const T0 = Date.now(), say = m => console.log('bench_shot ' + ((Date.now() - T0) / 1000).toFixed(1) + ' s: ' + m);
  const br = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await br.newPage({ viewport: { width: W, height: H } });
  pg.on('pageerror', e => console.error('page error: ' + String(e.message).split('\n')[0]));
  if (argv.includes('--log')) pg.on('console', m => console.log('page ' + m.type() + ': ' + m.text().slice(0, 300)));
  // ('load' waits on every texture the page streams: the bench's own readiness is the signal)
  await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 240000 });
  say('page loaded');
  await pg.waitForFunction(() => window.CAGE_UI && window.CAGE_UI.applySpec, null, { timeout: 300000, polling: 1000 });
  say('the bench is up');
  await pg.waitForTimeout(3000);
  if (FILE) {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const spec = j.spec || j;
    const set = JSON.parse(opt('set', '{}'));
    if (Object.keys(set).length) spec.cage = Object.assign({}, spec.cage, set);
    await pg.evaluate(s => { window.CAGE_UI.applySpec(s, 'bench_shot'); }, spec);
    say('the build applied');
    await pg.waitForTimeout(+opt('wait', 8000));
  }
  // the aeroplane alone: the side panel away, the canvas fills the page
  await pg.evaluate(() => { const a = document.getElementById('ui'); if (a) a.style.display = 'none';
    window.dispatchEvent(new Event('resize')); });
  await pg.waitForTimeout(1500);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  for (const v of VIEWS) {
    const p = VIEW[v]; if (!p) continue;
    const f = OUT + '_' + v + '.png';
    // THE CANVAS ITSELF: one render with the bench's own renderer and camera, read back in the same task (the drawing
    // buffer is still whole before it is composited) - a page screenshot waits on a composited frame, and on
    // SwiftShader with the bench drawing continuously that frame never came inside three minutes
    const url = await pg.evaluate(a => {
      const U = window.CAGE_UI; U.setView(a[0], a[1], a[2]); if (U.draw) U.draw();
      const r = U.renderer, sc = U.scene, cam = U.camera;
      if (r && sc && cam) r.render(sc, cam);
      return (r ? r.domElement : document.querySelector('canvas')).toDataURL('image/png');
    }, p);
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    say('wrote ' + f);
  }
  const stat = await pg.evaluate(() => (document.getElementById('stat') || {}).textContent || '');
  say('the bench says ' + stat.slice(0, 300));
  await br.close();
})().catch(e => { console.error('bench_shot: ' + e.message); process.exit(1); });
