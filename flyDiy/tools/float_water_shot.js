#!/usr/bin/env node
// float_water_shot.js - A FLOATPLANE ON THE WATER, STILLS, WITHOUT A GRAPHICS CARD (FLOATS-CLASSIC, 2026-11-03)
//
// water_look_shots.js's 'float' scenario (G2090) for a Linux cloud box: headless Chromium on SwiftShader through
// Playwright (the image's), the game's own door for a build (flydiy.wip, the roll-out), the aeroplane at its water
// home (a float build rolls out on the SEA lane), the free eye (DEV_CAM) set abeam, stills only. UNTIMED: SwiftShader
// draws a frame in seconds - never read a frame time off this.
//
//   node tools/float_water_shot.js --build <file.json> --out <dir> [--name tag] [--size 1280x720] [--secs 2400]
//        [--eyes "abeam:22/-8/3.5,bow:9/7/2.2"]   each eye: name:<left m>/<ahead m>/<up m> off the CG, in the aeroplane's
//                                                  heading frame (left of the nose, ahead of the CG, over the CG); the
//                                                  still looks at the CG
//        [--run 0]                                  seconds of the sim run before the stills (0: as it sits after the
//                                                  roll-out, paused)
// -> <out>/<name>_<eye>.png and one line FLOAT_WATER_SHOT {json}
'use strict';
const fs = require('fs'), path = require('path'), net = require('net');
const { spawn } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const FLY = path.resolve(__dirname, '..'), REPO = path.resolve(FLY, '..');
const BUILD = path.resolve(opt('build', ''));
const OUT = path.resolve(opt('out', path.join(FLY, 'screenshots', 'float_water')));
const NAME = opt('name', path.basename(BUILD).replace(/\.json$/i, ''));
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const SECS = +opt('secs', 2400), RUN = +opt('run', 0);
const EYES = opt('eyes', 'abeam:22/-8/3.5,bow:9/7/2.2').split(',').map(s => { const [n, v] = s.split(':'); const [l, a, u] = v.split('/').map(Number); return { n, l, a, u }; });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now(), log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(1).padStart(7) + ' s]', ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
function pw() { for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} } throw new Error('no playwright'); }

(async () => {
  if (!fs.existsSync(BUILD)) { console.error('float_water_shot: --build <file.json>'); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const port = await freePort();
  const srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  process.on('exit', () => { try { srv.kill(); } catch (e) {} });
  await sleep(800);
  const browser = await pw().chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e).split('\n')[0]));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  // THE GAME'S DOOR: the build is the work in progress, the route the circuit from home (a float build's home is water)
  const txt = fs.readFileSync(BUILD, 'utf8');
  await page.addInitScript(t => {
    try { localStorage.setItem('flydiy.wip', t); localStorage.removeItem('flydiy.gfx');
      for (const k of Object.keys(localStorage)) if (/^flydiy\.(fl([A-Z]|$)|route$|world$)/.test(k)) localStorage.removeItem(k);
      localStorage.setItem('flydiy.route', JSON.stringify({ from: 'HOME', dest: 'CIRCUIT' })); localStorage.setItem('flydiy.flManual', '0'); } catch (e) {}
  }, txt);
  const url = 'http://localhost:' + port + '/flyDiy/index.html?gfx=laptop&intro=0';
  log('page', url, '-', path.basename(BUILD));
  await page.goto(url, { timeout: SECS * 1000 });
  const left = () => SECS * 1000 - (Date.now() - T0);
  await page.waitForFunction(() => !!(window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE), null, { timeout: left(), polling: 2000 });
  log('booted');
  const n0 = await page.evaluate(() => (window.FLYDIY_TRIPS || []).length);
  await page.evaluate(() => { const g = document.getElementById('bGo'); const l = [...document.querySelectorAll('button')].filter(b => /roll out/i.test(b.textContent) && b.offsetParent);
    const b = g && g.offsetParent && /roll out/i.test(g.textContent) ? g : l[0]; if (b) b.click(); return !!b; });
  await page.waitForFunction(n => { const L = window.FLYDIY_TRIPS || []; const t = L[L.length - 1]; return L.length > n && t && t.done && window.BOOT && BOOT.state === 'gone'; }, n0, { timeout: left(), polling: 2000 });
  for (let i = 0; i < 6; i++) { await page.evaluate(() => { [...document.querySelectorAll('button,a,div')].filter(b => /keep the current build|continue anyway/i.test(b.textContent || '') && b.children.length === 0 && b.offsetParent).forEach(x => x.click()); }); await sleep(500); }
  const st = await page.evaluate(() => { const s = FLIGHT_PROBE.sim(), c = s.cgPos(), W2 = FLIGHT_PROBE.world(); return { t: s.t, cg: c, wl: W2.waterH ? W2.waterH(c[0], c[2]) : null, phase: FLIGHT_PROBE.ap && FLIGHT_PROBE.ap() ? FLIGHT_PROBE.ap().phase : null }; });
  log('rolled out', JSON.stringify(st));
  if (RUN > 0) await sleep(RUN * 1000);
  // hold it where it sits: pause, the free eye
  await page.evaluate(() => { const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); FLIGHT_PROBE.camMode('free'); return 1; });
  const shots = [];
  for (const e of EYES) {
    await page.evaluate(e => { const s = FLIGHT_PROBE.sim(), c = s.cgPos(), [xA] = s.axes(), h = Math.hypot(xA[0], xA[2]), fx = -xA[0] / h, fz = -xA[2] / h, lx = fz, lz = -fx;
      const D = window.DEV_CAM, ex = c[0] + lx * e.l + fx * e.a, ez = c[2] + lz * e.l + fz * e.a, wl = FLIGHT_PROBE.world().waterH(c[0], c[2]), ey = Math.max(wl + 0.6, c[1] + e.u);
      const look = () => { D.pos.set(ex, ey, ez); const dx = c[0] - ex, dy = c[1] - ey, dz = c[2] - ez; D.yaw = Math.atan2(dx, -dz); D.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
      window.__fwsEye = look; look(); return 1; }, e);
    // a few drawn frames with the eye re-set each frame (the free camera may ease)
    for (let k = 0; k < 6; k++) { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => { window.__fwsEye && window.__fwsEye(); r(1); }))); }
    await page.evaluate(() => { document.body.classList.add('shot'); if (window.SHOT_MODE) try { SHOT_MODE.enter(); } catch (e) {} return 1; });
    for (let k = 0; k < 3; k++) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => { window.__fwsEye && window.__fwsEye(); r(1); })));
    const f = path.join(OUT, NAME + '_' + e.n + '.png');
    // the page, not the canvas element: an element still waits for the element to be "stable" across frames, and a
    // SwiftShader frame is seconds (the first run timed out at 30 s on it)
    await page.screenshot({ path: f, timeout: 900000, animations: 'allow' });
    shots.push(f); log('still', path.basename(f));
  }
  console.log('FLOAT_WATER_SHOT ' + JSON.stringify({ ok: true, build: BUILD, state: st, shots, errors: errs.slice(0, 5) }));
  await browser.close(); process.exit(0);
})().catch(e => { console.error('float_water_shot: ' + (e && e.stack || e)); process.exit(1); });
