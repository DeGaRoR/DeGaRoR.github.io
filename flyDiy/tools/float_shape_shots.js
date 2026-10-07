#!/usr/bin/env node
// float_shape_shots.js - THE FLOAT BENCH'S VIEWS AS FILES (FLOAT-SHAPE, G1930, 2026-10-05)
//
// Opens tools/_float.html under headless Chromium (SwiftShader in a cloud session: a still, never a frame time), sets the
// preset / view / camera, and writes one PNG per (preset, camera, view). With ?ref=1 the bench draws the REFERENCE
// outline (the published-dimension box and the reference lines, 32_hydro FLOAT_REF) over the hull, so a still carries
// its comparison.
//
//   node tools/float_shape_shots.js --out reports/evidence/FLOAT-SHAPE/after [--presets "Wipline 2350,Wipline 2100"]
//        [--cams profile,top,aft,stern,iso] [--views paint,sections] [--size 1400x600] [--ref 0|1] [--tag after]
//        [--root <repo root>]   serve another tree (the BEFORE: a worktree of the base with this bench copied in)
//
// It serves the repo itself (tools/_serve.js on a free port) and finds Playwright where the cloud image keeps it.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
// --root: the repo root served (a baseline worktree's, its 32_hydro under this tree's bench files copied in)
const REPO = path.resolve(opt('root', path.join(__dirname, '..', '..')));
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'FLOAT-SHAPE')));
const PRESETS = opt('presets', 'Wipline 2350').split(',').map(s => s.trim()).filter(Boolean);
const CAMS = opt('cams', 'profile,top,aft,stern,iso').split(',');
const VIEWS = opt('views', 'paint').split(',');
const [W, Hh] = opt('size', '1400x600').split('x').map(Number);
const REF = opt('ref', '1') === '1';
const TAG = opt('tag', '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function findPlaywright() {
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} }
  throw new Error('float_shape_shots: no playwright here');
}
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = await freePort();
  const srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  await sleep(600);
  const { chromium } = findPlaywright();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: Hh + 40 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  const written = [];
  try {
    for (const name of PRESETS) {
      await page.goto(`http://127.0.0.1:${port}/flyDiy/tools/_float.html?preset=${encodeURIComponent(name)}${REF ? '&ref=1' : ''}`);
      await page.waitForFunction(() => window.BENCH, null, { timeout: 120000 });
      for (const view of VIEWS) for (const cam of CAMS) {
        await page.evaluate(([view, cam]) => {
          const $ = id => document.getElementById(id);
          $('view').value = view; window.BENCH.build();
          $('cam').value = cam; window.BENCH.aim();
        }, [view, cam]);
        // the view element (the canvas and the stat line over it: the preset, the catalogue, the reference's verdicts)
        const f = path.join(OUT, `${name.replace(/\s+/g, '')}_${cam}_${view}${TAG ? '_' + TAG : ''}.png`);
        await (await page.$('div#view')).screenshot({ path: f });
        written.push(path.relative(process.cwd(), f));
      }
    }
  } finally {
    await browser.close();
    srv.kill();
  }
  console.log(written.join('\n'));
  if (errs.length) { console.log('PAGE ERRORS:\n' + errs.join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
