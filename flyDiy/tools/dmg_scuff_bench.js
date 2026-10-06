#!/usr/bin/env node
// dmg_scuff_bench.js (G2006, DMG-SCUFF) - THE DAMAGE BENCH, HEADLESS: tools/_dmg_scuff.html on SwiftShader (the cloud's
// software GL - a picture and a relative cost, never a frame time), for each build:
//   1. the page with ?noscuff and without: every shader source compiled before arming, hashed - the same (the module's
//      presence changes no program: in the game, damage off wraps nothing);
//   2. DS.arm(): the wrapped copies compiled asleep and awake (the links counted - the roll-out's, in the game); then a
//      crash window from asleep (the records rewritten, the block woken, the branch opened, frames drawn): ZERO links;
//   3. DS.measure(layer) for crush / scrape / torn / glass on its preset: the changed pixels (FAIL under 0.5 %);
//   4. DS.cost(): the frame's median with the block absent, present ASLEEP (the game's intact aeroplane: the plain
//      source), awake + intact (the uniform branch only), awake + every vertex fully damaged (the fragment-cost estimate);
//   5. stills: each preset before (unarmed) and after (the test patterns), + close-ups.
// Run: node tools/dmg_scuff_bench.js [--out reports/evidence/DMG-SCUFF/scuffbench] [--builds cub,metal] [--size 960x540]
'use strict';
const fs = require('fs'), path = require('path'), net = require('net');
const { spawn } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = path.resolve(__dirname, '..'), REPO = path.resolve(ROOT, '..');
const OUT = path.resolve(ROOT, opt('out', 'reports/evidence/DMG-SCUFF/scuffbench'));
const [W, H] = opt('size', '960x540').split('x').map(Number);
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json', jodel: 'builds/jodel_2026-09-20_corrected.json' };
const which = opt('builds', 'cub,metal').split(',');
const VIEWS = opt('views', 'overview,under,nose,belly,wing,pane').split(',');
function findPlaywright() {
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', '/opt/node22/lib/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} }
  throw new Error('no playwright');
}
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = await freePort();
  const srv = spawn(process.execPath, [path.join(ROOT, 'tools', '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const { chromium } = findPlaywright();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = { when: new Date().toISOString(), size: [W, H], builds: {} };
  const open = async (q, spec) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 300)));
    await page.goto('http://127.0.0.1:' + port + '/flyDiy/tools/_dmg_scuff.html' + (q || ''));
    await page.waitForFunction(() => window.DS && window.WX_BENCH, null, { timeout: 600000 });
    await page.evaluate(s => window.DS.load(s), spec);
    return { page, errs };
  };
  const save = (name, url) => { fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64')); return name; };
  try {
    for (const k of which) {
      const j = JSON.parse(fs.readFileSync(path.join(ROOT, BUILDS[k]), 'utf8')), spec = j.spec || j;
      const R = report.builds[k] = { build: BUILDS[k] };
      // 1. the reference: the same build with the module removed, the programs compiled for each preset
      const ref = await open('?noscuff', spec);
      R.noscuff = await ref.page.evaluate(V => { for (const v of V) { DS.look(v); WX_BENCH.shoot(); } return DS.sources(); }, VIEWS);
      R.noscuffErrors = ref.errs; await ref.page.close();
      const { page, errs } = await open('', spec);
      R.loaded = await page.evaluate(V => { for (const v of V) { DS.look(v); WX_BENCH.shoot(); } return DS.sources(); }, VIEWS);
      R.sameAsNoscuff = R.loaded.hash === R.noscuff.hash && R.loaded.n === R.noscuff.n;
      // 5a. the stills before
      const dump = () => fs.writeFileSync(path.join(OUT, 'bench.json'), JSON.stringify(report, null, 1));
      dump();
      R.stills = [];
      const views = VIEWS;
      for (const v of views) R.stills.push(save(k + '_' + v + '_before.jpg', await page.evaluate(([v, w, h]) => { DS.look(v); return DS.still(w, h); }, [v, W, H])));
      // 2. arming (the programs) and the crash window (no program)
      R.arm = await page.evaluate(() => DS.arm()); dump(); console.log('arm', JSON.stringify(R.arm).slice(0, 600));
      R.crashLinks = await page.evaluate(() => DS.crashWindow());
      // 5b. after
      for (const v of views) R.stills.push(save(k + '_' + v + '_after.jpg', await page.evaluate(([v, w, h]) => { DS.look(v); return DS.still(w, h); }, [v, W, H])));
      // 3. the layers
      R.measure = await page.evaluate(() => ['crush', 'scrape', 'torn', 'glass'].map(l => DS.measure(l))); dump(); console.log('measure', JSON.stringify(R.measure).slice(0, 600));
      // 4. the cost
      R.cost = await page.evaluate(() => DS.cost('nose', 9)); dump(); console.log('cost', JSON.stringify(R.cost).slice(0, 600));
      R.sourcesEnd = await page.evaluate(() => DS.sources());
      R.errors = errs;
      console.log(k, JSON.stringify({ same: R.sameAsNoscuff, arm: R.arm, crashLinks: R.crashLinks, measure: R.measure.map(m => m.layer + ' ' + m.pct.toFixed(2) + '% ' + m.view), cost: R.cost, errors: errs.length }));
      await page.close();
    }
  } finally {
    fs.writeFileSync(path.join(OUT, 'bench.json'), JSON.stringify(report, null, 1));
    await browser.close(); srv.kill();
  }
})().catch(e => { console.error(e); process.exit(1); });
