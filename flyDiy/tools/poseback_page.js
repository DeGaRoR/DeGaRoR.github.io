#!/usr/bin/env node
// poseback_page.js - THE DRAWN AEROPLANE THROUGH A TAKE-OFF ON A REAL PAGE AT A FEW FRAMES A SECOND (POSE-BACK, G1531)
//
// The user (4 Oct, a GTX 660 at ~2 fps): "As soon as it took off, it happened that it went a little backward over a
// frame". A cloud session has no GPU: headless Chromium draws WebGL on SwiftShader (the CPU), which is itself a page at
// a few frames a second - the user's condition, for free. This boots the page, rolls out, skips to the line-up, flies
// the circuit and records, ONCE PER rAF FRAME AT THE WORLD'S DRAW (a hook on the renderer's render(), eye_judder.js's
// way: the positions the frame draws - the worker's mirrored view, or the inline swap), the drawn CG, the newest state
// the page holds (FLYDIY_SIMW's snapshot under the worker), the frame's rAF timestamp, the wheels on the ground. Then
// per frame the drawn CG's move along the motion, and the frames that went BACKWARD (< -0.5 mm).
//
//   node tools/poseback_page.js --out <file.json> [--q 'poseback=0'] [--page dev.html] [--size 480x270]
//        [--throttle N]   CDP Emulation.setCPUThrottlingRate (the page's main thread N x slower)
//        [--secs 2400]    the whole budget   [--after 6]   sim seconds recorded past the wheels leaving the ground
//   -> the JSON (rows + summary) and one line `POSEBACK_PAGE {summary}`.
// SLOW BY NATURE (a software GL): never read a frame time off it as the game's; it is the frame TIMING the drawn clock
// meets that this records. It needs the page's software rung (SOFT-GPU, G1460: train 31) to draw the world at all.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const REPO = path.resolve(__dirname, '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.resolve(opt('out', 'poseback_page.json')), Q = opt('q', ''), PAGE = opt('page', 'dev.html');
const SIZE = opt('size', '480x270').split('x').map(Number), THROTTLE = +opt('throttle', 0), SECS = +opt('secs', 2400), AFTER = +opt('after', 6);
function findPlaywright() {
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} }
  throw new Error('poseback_page: no playwright here');
}
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
// before the page's first script: a fresh profile's prefs, and the recorder (armed by __PB.on)
const PRE = `try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|gfx$|rollanim$|rollreal$|welcome|wip$)/.test(k)) localStorage.removeItem(k);}catch(e){}
document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent="*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";document.head.appendChild(s);});
window.__PB = { on: false, fresh: false, ts: 0, rows: [], frames: 0 };
(function(){ const raf0 = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf0(ts => { __PB.ts = ts; __PB.fresh = true; __PB.frames++; return cb(ts); }); })();
window.__PBhook = () => {
  if (window.__PBhooked || !window.FLIGHT_PROBE || !FLIGHT_PROBE.renderer) return false;
  const R = FLIGHT_PROBE.renderer(), orig = R.render, E = __PB;
  R.render = function (scene, cam) {
    if (E.on && E.fresh && cam === FLIGHT_PROBE.camera() && window.WORLD && scene === WORLD.scene) {
      E.fresh = false;
      const s = FLIGHT_PROBE.sim(), c = s.cgPos(), v = s.cgVel ? s.cgVel() : [0, 0, 0];
      const W = window.FLYDIY_SIMW, st = W && W.state ? W.state() : null, PS = window.FLYDIY_PACE ? FLYDIY_PACE.state() : null;
      const PO = window.FLYDIY_POSE ? FLYDIY_POSE.state() : null;
      E.rows.push([E.ts, performance.now(), c[0], c[1], c[2], v[0], v[1], v[2], s.t, s.wheelsOnGround(), st && st.lastStep != null ? st.lastStep : null,
                   PS ? PS.steps : null, PS ? (PS.simw ? 1 : 0) : null, PO ? PO.alpha : null, (FLIGHT_PROBE.ap() || {}).phase || '']);
    }
    return orig.apply(this, arguments);
  };
  window.__PBhooked = true; return true;
};`;

(async () => {
  const t0 = Date.now(), T = () => +((Date.now() - t0) / 1000).toFixed(1), log = (...a) => console.log('[' + T() + 's]', ...a);
  const port = await freePort();
  const server = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  let browser = null; const R = { q: Q, throttle: THROTTLE, errors: [], t: {} };
  try {
    for (let i = 0; ; i++) {
      const up = await new Promise(res => { const rq = http.get('http://127.0.0.1:' + port + '/flyDiy/version.json', r => { r.resume(); res(true); }); rq.on('error', () => res(false)); });
      if (up) break; if (i > 80) throw new Error('no static server'); await sleep(250);
    }
    const { chromium } = findPlaywright();
    browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing', '--disable-accelerated-2d-canvas'] });
    const page = await browser.newPage({ viewport: { width: SIZE[0], height: SIZE[1] } });
    page.setDefaultTimeout(SECS * 1000);
    await page.addInitScript(PRE);
    page.on('pageerror', e => { R.errors.push(String(e.message || e).slice(0, 300)); log('PAGEERR', String(e.message).slice(0, 200)); });
    if (THROTTLE > 1) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE }); }
    const url = 'http://127.0.0.1:' + port + '/flyDiy/' + PAGE + (Q ? '?' + Q : '');
    log('nav', url);
    await page.goto(url, { waitUntil: 'load', timeout: SECS * 1000 });
    const until = async (what, fn, every = 2000) => {
      for (;;) { let v = null; try { v = await page.evaluate(fn); } catch (e) { v = null; }
        if (v) return v; if (T() > SECS) throw new Error('timed out waiting for ' + what); await sleep(every); }
    };
    await until('the garage', () => window.BOOT && BOOT.state === 'gone' && BOOT.set === 'garage' && /Roll out/.test((document.getElementById('bGo') || {}).textContent || ''));
    R.t.garage = T(); log('garage');
    await page.evaluate(() => { for (const x of document.querySelectorAll('.dfClose')) try { x.click(); } catch (e) {} });
    await page.evaluate(() => document.getElementById('bGo').click());
    const stand = () => { const t = (window.FLYDIY_TRIPS || []).slice(-1)[0]; const a = document.getElementById('flActs');
      return !!(t && t.done && window.BOOT && BOOT.state === 'gone' && a && getComputedStyle(a).display !== 'none'); };
    await until('the stand', stand);
    R.t.stand = T(); log('stand');
    await until('the skip', () => { const b = document.getElementById('bSkip'); return b && !b.hidden && !b.disabled; });
    await page.evaluate(() => document.getElementById('bSkip').click());
    await sleep(3000);
    await until('lined up', stand);
    R.t.lineup = T(); log('lined up');
    await page.evaluate(() => { window.__PBhook(); FLIGHT_PROBE.camMode && FLIGHT_PROBE.camMode('chase'); __PB.on = true; document.getElementById('bGo').click(); });
    R.simw = await page.evaluate(() => !!(window.FLYDIY_SIMW && FLYDIY_PACE.state().simw));
    log('go (simw ' + R.simw + ')');
    // until the wheels have been off the ground for AFTER sim seconds
    let lastN = 0;
    await until('the take-off + ' + AFTER + ' s', () => {
      const r = __PB.rows; let off = -1;
      for (let i = 0; i < r.length; i++) if (r[i][9] === 0 && (i === 0 || r[i - 1][9] > 0)) off = r[i][8];
      return off >= 0 && r.length && r[r.length - 1][8] > off + 0;
    }, 3000).catch(e => log(String(e.message)));
    const tOff = await page.evaluate(() => { const r = __PB.rows; for (let i = 1; i < r.length; i++) if (r[i][9] === 0 && r[i - 1][9] > 0) return r[i][8]; return null; });
    if (tOff != null) await until('after', new Function('const r = __PB.rows; return r.length && r[r.length - 1][8] > ' + (tOff + AFTER) + ';'), 3000).catch(e => log(String(e.message)));
    R.rows = await page.evaluate(() => __PB.rows);
    R.t.end = T();
  } catch (e) { R.fatal = String(e && e.message || e); log('FATAL', R.fatal); }
  finally { if (browser) await browser.close().catch(() => {}); try { server.kill(); } catch (e) {} }
  // the verdict's readings: the drawn CG's move along the motion (the horizontal velocity) frame to frame
  const rows = R.rows || [], back = [];
  let tOff = null, worst = 0;
  for (let k = 1; k < rows.length; k++) {
    const a = rows[k - 1], b = rows[k];
    if (tOff == null && b[9] === 0 && a[9] > 0) tOff = b[8];
    const vh = Math.hypot(b[5], b[7]); if (vh < 0.5) continue;
    const ds = ((b[2] - a[2]) * b[5] + (b[4] - a[4]) * b[7]) / vh;
    b.push(ds * 1000);
    if (ds < -0.0005) { back.push({ k, simT: b[8], ds_mm: +(ds * 1000).toFixed(1), dtMs: +(b[0] - a[0]).toFixed(1), v: +vh.toFixed(1) }); if (ds < worst) worst = ds; }
  }
  const dts = rows.slice(1).map((r, i) => r[0] - rows[i][0]).sort((x, y) => x - y);
  R.summary = { q: Q, simw: R.simw, frames: rows.length, takeoff: tOff, frameMsP50: dts.length ? +dts[dts.length >> 1].toFixed(0) : null,
                frameMsMin: dts.length ? +dts[0].toFixed(0) : null, frameMsMax: dts.length ? +dts[dts.length - 1].toFixed(0) : null,
                backward: back.length, worstBackMm: +(-worst * 1000).toFixed(1), back: back.slice(0, 12), fatal: R.fatal || null, errors: R.errors.length, t: R.t };
  R.cols = ['ts', 'now', 'cgx', 'cgy', 'cgz', 'vx', 'vy', 'vz', 'simT', 'wheels', 'lastStep', 'steps', 'simw', 'alpha', 'phase', 'ds_mm'];
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(R));
  console.log('POSEBACK_PAGE ' + JSON.stringify(R.summary));
  process.exit(R.fatal ? 1 : 0);
})();
