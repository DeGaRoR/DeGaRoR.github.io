#!/usr/bin/env node
// soft_still.js - A STILL OF THE GAME FROM A CLOUD SESSION (SOFT-GPU, G1460, 2026-10-04)
//
// Every cloud session has a browser and no graphics card: headless Chromium on SwiftShader (ANGLE's CPU Vulkan).
// Until G1460 the game's UI drew there but its WORLD did not, so every picture of the world was A0's to take on the
// box. This rig boots the real page on SwiftShader (the 'software' rung, gfx_settings.js SOFT), takes it through the
// garage, the roll-out and the stand, points the camera and writes ONE still - so a cloud session ships its own
// evidence. Slow by nature (a software GL: minutes to boot, seconds a frame); NEVER read a frame time off it.
//
//   node tools/soft_still.js --out reports/evidence/<SESSION>/stand.jpg
//        [--page index.html|dev.html]      the page (default index.html; dev.html = the parts, no build needed)
//        [--place garage|stand]            where the still is taken (default stand: rolled out, the world drawn)
//        [--build default|stock|<file.json>]  the aeroplane (default: the fresh profile's, the Cub)
//        [--day noon|morning|afternoon|golden|sunset|dawn|dusk|night|YYYY-MM-DDTHH:MM]   (DAY_CLOCK ?day=)
//        [--cam chase|orbit|wing|cockpit]  the stand's camera mode (default: the page's own)
//        [--orbit az,el,dist]              a fixed orbit view (deg, deg, m) - FLIGHT_PROBE.camSet
//        [--q 'k=v&k2=v2']                 more URL parameters (e.g. world=jolene, cloud=0.4)
//        [--gfx potato|retro|...]          a preset (default: none - the software rung picks itself)
//        [--size 960x540] [--quality 80] [--secs 900] [--port 0 (auto)] [--json out.json] [--keep-hud]
//        [--aero-check]                    also take the frame with the aeroplane hidden and report the difference
//   -> the JPEG, and one line `SOFT_STILL {json}`: the timings (boot, roll-out, reveal), the renderer string, the
//      gfx tier the page chose, renderer.info at the still (draw calls, triangles), the picture's coverage (the
//      share of pixels that are not the clear colour, the lower half's spread), and every page error.
//
// It serves the repo itself (tools/_serve.js on a free port) and finds Playwright where the cloud image keeps it
// (require('playwright'), then /opt/node-tools/node_modules/playwright). GATE SOFTGPU (tools/_softgpu_check.js)
// is this rig with asserts.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const REPO = path.resolve(__dirname, '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function findPlaywright() {
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) { try { return require(p); } catch (e) {} }
  throw new Error('soft_still: no playwright here (npm i -g playwright, or the cloud image\'s /opt/node-tools)');
}
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

// the build slot, written before the page's first script (live_driver.js / rollout_shots.js's preScript)
function preScript(o) {
  // a frame counter of the page's own: every rAF tick is one turn of the game's loop (seconds apart on SwiftShader)
  const L = ['window.__softFrames=0;(function t(){window.__softFrames++;requestAnimationFrame(t)})();',
    // (no backdrop blur in the rig: the plates' blur(16px) is the compositor's, never the picture's, and costs it most)
    'document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent="*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";document.head.appendChild(s);});',
    'try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|gfx$|rollanim$|rollreal$|welcome)/.test(k)) localStorage.removeItem(k);}catch(e){}'];
  if (o.build === 'default') L.push('try{localStorage.removeItem("flydiy.wip")}catch(e){}');
  else if (o.build === 'stock') L.push(require('./_stock_pin.js').pinScript());
  else L.push('try{localStorage.setItem("flydiy.wip",' + JSON.stringify(fs.readFileSync(path.resolve(o.build), 'utf8')) + ')}catch(e){}');
  return L.join('\n');
}

// the picture's numbers, computed in a blank page from the PNG (no image library in node): the clear colour's share,
// the most common colour's share, the lower half's luma spread, and a JPEG of it
async function analyse(browser, png, quality, clear) {
  const p = await browser.newPage();
  try {
    return await p.evaluate(async ([b64, q, clr]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height;
      const hist = new Map(); let clearN = 0, lo = [], s = 0, s2 = 0, m = 0;
      for (let i = 0; i < n; i++) {
        const r = d[4 * i], gg = d[4 * i + 1], bb = d[4 * i + 2];
        const k = (r >> 3) << 10 | (gg >> 3) << 5 | (bb >> 3); hist.set(k, (hist.get(k) || 0) + 1);
        if (clr && Math.abs(r - clr[0]) <= 3 && Math.abs(gg - clr[1]) <= 3 && Math.abs(bb - clr[2]) <= 3) clearN++;
        if (i >= n / 2) { const y = 0.2126 * r + 0.7152 * gg + 0.0722 * bb; s += y; s2 += y * y; m++; }
      }
      let top = 0; for (const v of hist.values()) if (v > top) top = v;
      const mean = s / m, sd = Math.sqrt(Math.max(0, s2 / m - mean * mean));
      return { w: c.width, h: c.height, clearShare: clearN / n, topShare: top / n, colours: hist.size, lowerMean: +mean.toFixed(1), lowerSd: +sd.toFixed(1),
               jpeg: c.toDataURL('image/jpeg', q / 100).split(',')[1] };
    }, [png.toString('base64'), quality, clear]);
  } finally { await p.close(); }
}
// the mean absolute difference of two PNGs (0-255), and its share of pixels over 12
async function diff(browser, a, b) {
  const p = await browser.newPage();
  try {
    return await p.evaluate(async ([A, B]) => {
      const px = async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
      const x = await px(A), y = await px(B); let s = 0, over = 0; const n = x.length / 4;
      for (let i = 0; i < n; i++) { const e = (Math.abs(x[4 * i] - y[4 * i]) + Math.abs(x[4 * i + 1] - y[4 * i + 1]) + Math.abs(x[4 * i + 2] - y[4 * i + 2])) / 3; s += e; if (e > 12) over++; }
      return { mean: +(s / n).toFixed(2), share: +(over / n).toFixed(4) };
    }, [a.toString('base64'), b.toString('base64')]);
  } finally { await p.close(); }
}

async function still(o) {
  const t0 = Date.now(), T = () => +((Date.now() - t0) / 1000).toFixed(1);
  const log = o.quiet ? () => {} : (...a) => console.log('[' + T() + 's]', ...a);
  const R = { page: o.page, place: o.place, errors: [], warnings: [], t: {} };
  const port = o.port || await freePort();
  const server = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  let browser = null;
  try {
    for (let i = 0; ; i++) {
      const root = await new Promise(res => { const rq = http.get('http://127.0.0.1:' + port + '/flyDiy/version.json', r => { r.resume(); res(r.headers['x-serve-root'] ? decodeURIComponent(r.headers['x-serve-root']) : '?'); }); rq.on('error', () => res(null)); });
      if (root) { if (path.resolve(root) !== REPO) throw new Error('port ' + port + ' serves ' + root); break; }
      if (i > 60) throw new Error('soft_still: the static server never answered on ' + port); await sleep(250);
    }
    const { chromium } = findPlaywright();
    // SwiftShader for WebGL, Chrome's SOFTWARE compositor and 2D canvas for the rest: through SwiftShader the page's own
    // compositing (the HUD plates' backdrop blur over a canvas that changes every frame) held the GPU process for minutes a
    // frame at the stand, ahead of the game's WebGL (G1460's measurement: every scene object hidden, still 200-400 s frames)
    browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--disable-gpu-compositing', '--disable-accelerated-2d-canvas'] });
    const [W, H] = o.size;
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(o.secs * 1000);
    await page.addInitScript(preScript(o));
    page.on('pageerror', e => { R.errors.push(String(e.message || e).slice(0, 300)); log('PAGEERR', String(e.message).slice(0, 200)); });
    page.on('console', m => { const t = m.text(); if (m.type() === 'error') { R.errors.push(t.slice(0, 300)); log('CONSOLE.ERROR', t.slice(0, 200)); }
      else if (m.type() === 'warning' && !/willReadFrequently|KHR_parallel_shader_compile|GPU stall due to ReadPixels/.test(t)) { R.warnings.push(t.slice(0, 300)); log('warn', t.slice(0, 160)); } });
    const q = ['day=' + encodeURIComponent(o.day)].concat(o.gfx ? ['gfx=' + o.gfx] : []).concat(o.q ? [o.q] : []).filter(s => !/=$/.test(s)).join('&');
    const url = 'http://127.0.0.1:' + port + '/flyDiy/' + o.page + (q ? '?' + q : '');
    log('nav', url);
    await page.goto(url, { waitUntil: 'load', timeout: o.secs * 1000 });
    const left = () => o.secs - T();
    const until = async (what, fn, every = 2000) => {
      for (;;) {
        let v = null; try { v = await page.evaluate(fn); } catch (e) { v = null; }
        if (v) return v;
        if (left() <= 0) throw new Error('soft_still: timed out waiting for ' + what + ' (' + o.secs + ' s)');
        await sleep(every);
      }
    };
    // THE GARAGE: the boot chain ran to its end (BOOT 'gone' and the roll-out button) - on the software rung the
    // overlay waits for the whole chain (SOFT's longer watchdogs), so 'gone' is the garage drawn
    // (the chain's own count too: a watchdog that lifted the overlay early leaves steps still to run behind it)
    await until('the garage', () => window.BOOT && BOOT.state === 'gone' && BOOT.set === 'garage' && BOOT.stepI >= (BOOT.steps || []).length && !BOOT.current
      && /Roll out/.test((document.getElementById('bGo') || {}).textContent || ''));
    R.t.garage = T();
    Object.assign(R, await page.evaluate(() => ({ bootDone: BOOT.stepI >= BOOT.steps.length, bootSteps: BOOT.steps.length,
      hardTimeout: (BOOT.log || []).some(e => e && e.k === 'fail') })));
    R.gpu = await page.evaluate(() => { try { const g = window.FLYDIY_RENDERER.getContext(); const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } catch (e) { return null; } });
    R.soft = await page.evaluate(() => window.GFX && GFX.soft ? GFX.soft() : null);
    R.gfx = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('flydiy.gfx') || 'null'); } catch (e) { return null; } });
    log('garage', R.gpu, 'tier', R.soft && R.soft.tier);
    // the chain's last steps settle; then the chooser away (a fresh profile's), exactly as the shot itself would
    await page.evaluate(() => { for (const x of document.querySelectorAll('.dfClose')) try { x.click(); } catch (e) {} });
    if (o.place === 'stand') {
      await page.evaluate(() => document.getElementById('bGo').click());
      log('roll out');
      // THE STAND: the roll-out screen's chain ran (a trip done), the screen gone and the stand's verbs up
      await until('the stand', () => { const t = (window.FLYDIY_TRIPS || []).slice(-1)[0]; const a = document.getElementById('flActs');
        return !!(t && t.done && window.BOOT && BOOT.state === 'gone' && a && getComputedStyle(a).display !== 'none'); });
      R.t.stand = T();
      R.trip = await page.evaluate(() => { const t = (window.FLYDIY_TRIPS || []).slice(-1)[0]; return t ? { kind: t.kind, anim: t.anim, ms: t.ms } : null; });
      log('stand', JSON.stringify(R.trip));
    }
    // THE VIEW: a camera mode, a fixed orbit, the eye settled (the reveal's ease skipped), the HUD hidden (the
    // picture is the subject; --keep-hud keeps it)
    await page.evaluate(([cam, orbit, hud]) => {
      const P = window.FLIGHT_PROBE; if (!P) return;
      if (cam && P.camMode) P.camMode(cam);
      if (orbit && P.camSet) P.camSet(orbit[0] * Math.PI / 180, orbit[1] * Math.PI / 180, orbit[2]);
      else if (P.camSettle) P.camSettle();
      if (!hud) { const s = document.createElement('style'); s.id = 'softStillHud'; s.textContent = 'body > *:not(canvas):not(#c):not(#view):not(#stage) { visibility: hidden !important } canvas { visibility: visible !important }'; document.head.appendChild(s); }
    }, [o.cam, o.orbit, o.keepHud]);
    // a few real frames on the new view (each is seconds on SwiftShader): counted on rAF (preScript's __softFrames)
    const frames = async n => { const f0 = await page.evaluate(() => window.__softFrames || 0); await until(n + ' frames', new Function('return (window.__softFrames || 0) >= ' + (f0 + n)), 500); };
    await frames(o.frames);
    R.t.view = T();
    // the whole frame's draw calls (every pass: the shadow maps, the scene, the resolve) - info resets per render() call,
    // so it is held for one frame
    Object.assign(R, await page.evaluate(() => new Promise(res => { const r = window.FLYDIY_RENDERER; if (!r) return res({});
      r.info.autoReset = false; r.info.reset();
      requestAnimationFrame(() => requestAnimationFrame(() => { const c = r.info.render.calls, t = r.info.render.triangles; r.info.autoReset = true; res({ sceneCalls: c, sceneTris: t }); })); })));
    const shot = async () => (await page.screenshot({ type: 'png', timeout: o.secs * 1000 }));
    const png = await shot();
    R.t.still = T();
    R.info = await page.evaluate(() => { const r = window.FLYDIY_RENDERER; const i = r && r.info; return i ? { calls: i.render.calls, triangles: i.render.triangles, programs: (i.programs || []).length, textures: i.memory.textures, geometries: i.memory.geometries } : null; });
    R.clear = await page.evaluate(() => { try { const c = new THREE.Color(); window.FLYDIY_RENDERER.getClearColor(c); c.convertLinearToSRGB(); return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]; } catch (e) { return null; } });
    const A = await analyse(browser, png, o.quality, R.clear);
    fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
    fs.writeFileSync(o.out, Buffer.from(A.jpeg, 'base64'));
    delete A.jpeg; R.picture = A; R.out = o.out;
    log('still', o.out, JSON.stringify(A), JSON.stringify(R.info));
    if (o.aeroCheck) {
      // the same frame with the aeroplane hidden: what differs is the aeroplane (and its shadow) - drawn or not
      const had = await page.evaluate(() => { const c = window.FLIGHT_PROBE && FLIGHT_PROBE.craft && FLIGHT_PROBE.craft(); if (!c) return false; c.visible = false; return true; });
      if (had) {
        await frames(2);
        const png2 = await shot();
        await page.evaluate(() => { FLIGHT_PROBE.craft().visible = true; });
        R.aero = await diff(browser, png, png2);
        log('aero', JSON.stringify(R.aero));
      } else R.aero = null;
    }
    R.t.total = T();
    return R;
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { server.kill(); } catch (e) {}
  }
}

function parse() {
  const size = opt('size', '960x540').split('x').map(Number);
  const orbit = opt('orbit', null);
  return {
    page: opt('page', 'index.html'), place: opt('place', 'stand'), build: opt('build', 'default'), day: opt('day', 'afternoon'),
    cam: opt('cam', null), orbit: orbit ? orbit.split(',').map(Number) : null, q: opt('q', ''), gfx: opt('gfx', null),
    size, quality: +opt('quality', 80), secs: +opt('secs', 3600), port: +opt('port', 0), frames: +opt('frames', 3),
    out: opt('out', path.join(REPO, 'flyDiy', 'reports', 'evidence', 'soft_still.jpg')), keepHud: flag('keep-hud'), aeroCheck: flag('aero-check'),
    json: opt('json', null), quiet: flag('quiet'),
  };
}

if (require.main === module) {
  const o = parse();
  still(o).then(R => {
    console.log('SOFT_STILL ' + JSON.stringify(R));
    if (o.json) fs.writeFileSync(o.json, JSON.stringify(R, null, 1));
    process.exit(0);
  }, e => { console.log('SOFT_STILL_FAIL ' + (e && e.message)); process.exit(1); });
}
module.exports = { still, parse };
