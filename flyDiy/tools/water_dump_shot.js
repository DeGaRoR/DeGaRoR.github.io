#!/usr/bin/env node
// water_dump_shot.js - THE WATER DUMP, SEEN (WATER TANKS, 15 Nov 2026; the user: "they will have a release mechanism, and
// a particle animation when it releases (water shower)"). float_water_shot.js's rig (headless Chromium on SwiftShader
// through Playwright, the game's own door for a build - flydiy.wip and the roll-out - stills only, UNTIMED): a build with
// water tanks rolled out, placed in the air over its home strip at `--agl` m and `--v` m/s along its heading, the motor at
// cruise, the valve opened BY ITS KEY (Digit0, input.js 'dump'), `--run` s of sim, then paused and shot from the free eye.
//
//   node tools/water_dump_shot.js --build <file.json> --out <dir> [--name tag] [--size 1280x720] [--secs 2400]
//        [--agl 40] [--v 22] [--run 1.5] [--hand 1|0: by hand (default) or the autopilot flying] [--eyes "abeam:14/-6/-1,behind:4/-18/2"]
//        each eye: name:<left m>/<ahead m>/<up m> off the CG in the heading frame; the still looks at a point `--look` m
//        under and behind the CG (the curtain), default "0/-4/-3" (left/ahead/up)
// -> <out>/<name>_<eye>.png and one line WATER_DUMP_SHOT {json}: the water aboard before / after, the flow, the shower's
//    live particles, the page's errors
'use strict';
const fs = require('fs'), path = require('path'), net = require('net');
const { spawn } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const FLY = path.resolve(__dirname, '..'), REPO = path.resolve(FLY, '..');
const BUILD = path.resolve(opt('build', ''));
const OUT = path.resolve(opt('out', path.join(FLY, 'screenshots', 'water_dump')));
const NAME = opt('name', path.basename(BUILD).replace(/\.json$/i, ''));
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const SECS = +opt('secs', 2400), AGL = +opt('agl', 40), V = +opt('v', 22), RUN = +opt('run', 1.5), HAND = opt('hand', '1') !== '0';
const parse3 = s => s.split('/').map(Number);
const EYES = opt('eyes', 'abeam:14/-6/-1,behind:4/-18/2').split(',').map(s => { const [n, v] = s.split(':'); const [l, a, u] = parse3(v); return { n, l, a, u }; });
const LOOK = parse3(opt('look', '0/-4/-3'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now(), log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(1).padStart(7) + ' s]', ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
function pw() { for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} } throw new Error('no playwright'); }

(async () => {
  if (!fs.existsSync(BUILD)) { console.error('water_dump_shot: --build <file.json>'); process.exit(2); }
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
  for (let i = 0; i < 6; i++) { await page.evaluate(() => { [...document.querySelectorAll('button,a,div')].filter(b => /keep the current build|continue anyway/i.test(b.textContent || '') && b.children.length === 0).forEach(b => b.click()); }); await sleep(300); }
  const st0 = await page.evaluate(() => { const s = FLIGHT_PROBE.sim(); return { t: s.t, water: !!s.water, kg: s.water ? s.water.kg : null, outlets: s.water ? s.water.outlets.length : 0, hasDump: 'dump' in s.ctl }; });
  log('rolled out', JSON.stringify(st0));
  // in the air over home: AGL up, V along the heading, the motor at cruise, by hand
  await page.evaluate(o => {
    const FP = FLIGHT_PROBE, s = FP.sim(), Wd = FP.world(); if (o.HAND) FP.setManual(true);
    const [xA] = s.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl, c = s.cgPos();
    const g = Wd.terrainH(c[0], c[2]);
    window.__wdsPlaced = null;
    FP.place({ at: [c[0], g + o.AGL, c[2]], zeroV: true, dv: [fx * o.V, 0, fz * o.V] }).then(cg => { window.__wdsPlaced = cg; });
    return 1; }, { AGL, V, HAND });
  await page.waitForFunction(() => !!window.__wdsPlaced, null, { timeout: left(), polling: 500 });
  await page.evaluate(h => { const s = FLIGHT_PROBE.sim(); if (h) s.ctl.thr = 0.6; const b = document.getElementById('bPause'); if (b && /run|resume|play/i.test(b.textContent)) b.click(); return 1; }, HAND);
  // THE VALVE, BY ITS KEY
  await page.bringToFront();
  // (held across two drawn frames: input.js samples the held keys once a frame, and a SwiftShader frame is seconds - a
  //  press's down and up in one tick fall between two samples)
  // (dispatched on `window`, input.js's listener, as hand_controls_still.js does: a page key goes to the focused element,
  //  and a text field the roll-out left focused is where input.js ignores a key)
  const key = type => page.evaluate(t => window.dispatchEvent(new KeyboardEvent(t, { code: 'Digit0', key: '0', bubbles: true, cancelable: true })), type);
  await key('keydown');
  for (let k = 0; k < 2; k++) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r(1))));
  await key('keyup');
  const tA = await page.evaluate(() => FLIGHT_PROBE.sim().t);
  let flowMax = 0, liveMax = 0, frames = 0;
  while (frames < 2000) {
    const r = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => { const s = FLIGHT_PROBE.sim(), o = s.out || {}, F = window.DUMP_FX && DUMP_FX.fx;
      const I = FLIGHT_PROBE.input && FLIGHT_PROBE.input();
      res({ t: s.t, flow: +o.waterFlow || 0, kg: o.waterKg, dump: s.ctl.dump, hand: I && I.dump ? I.dump() : null, manual: FLIGHT_PROBE.manual ? FLIGHT_PROBE.manual() : null, live: F ? F.live : 0 }); })));
    frames++; flowMax = Math.max(flowMax, r.flow); liveMax = Math.max(liveMax, r.live);
    if (frames % 10 === 0 || frames < 4) log('frame', frames, JSON.stringify(r));
    if (r.t - tA >= RUN) break;
  }
  const st1 = await page.evaluate(() => { const s = FLIGHT_PROBE.sim(), o = s.out || {}, F = window.DUMP_FX && DUMP_FX.fx; return { t: s.t, kg: o.waterKg, flow: o.waterFlow, dump: s.ctl.dump, live: F ? F.live : 0, agl: FLIGHT_PROBE.agl() }; });
  log('dumping', JSON.stringify(st1));
  await page.evaluate(() => { const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); FLIGHT_PROBE.camMode('free'); return 1; });
  const shots = [];
  for (const e of EYES) {
    await page.evaluate(o => { const e = o.e, L = o.L, s = FLIGHT_PROBE.sim(), c = s.cgPos(), [xA] = s.axes(), h = Math.hypot(xA[0], xA[2]), fx = -xA[0] / h, fz = -xA[2] / h, lx = fz, lz = -fx;
      const D = window.DEV_CAM, ex = c[0] + lx * e.l + fx * e.a, ez = c[2] + lz * e.l + fz * e.a, ey = c[1] + e.u;
      const tx = c[0] + lx * L[0] + fx * L[1], tz = c[2] + lz * L[0] + fz * L[1], ty = c[1] + L[2];
      const look = () => { D.pos.set(ex, ey, ez); const dx = tx - ex, dy = ty - ey, dz = tz - ez; D.yaw = Math.atan2(dx, -dz); D.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
      window.__wdsEye = look; look(); return 1; }, { e, L: LOOK });
    for (let k = 0; k < 6; k++) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => { window.__wdsEye && window.__wdsEye(); r(1); })));
    await page.evaluate(() => { document.body.classList.add('shot'); if (window.SHOT_MODE) try { SHOT_MODE.enter(); } catch (e) {} return 1; });
    for (let k = 0; k < 3; k++) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => { window.__wdsEye && window.__wdsEye(); r(1); })));
    const f = path.join(OUT, NAME + '_' + e.n + '.png');
    await page.screenshot({ path: f, timeout: 900000, animations: 'allow' });
    shots.push(f); log('still', path.basename(f));
  }
  console.log('WATER_DUMP_SHOT ' + JSON.stringify({ ok: true, build: BUILD, before: st0, after: st1, flowMax, liveMax, frames, shots, errors: errs.slice(0, 8) }));
  await browser.close(); process.exit(0);
})().catch(e => { console.error('water_dump_shot: ' + (e && e.stack || e)); process.exit(1); });
