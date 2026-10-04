#!/usr/bin/env node
// mobile_garage_swift.js - MOBILE-GARAGE (G1511): FULL vs GARAGE-ONLY IN A REAL BROWSER, on the cloud's SwiftShader - a STUDY
// rig, nothing shipped. Headless Chromium (Playwright, as tools/soft_still.js finds it) on SwiftShader, dev.html, a build in
// flydiy.wip; the page picks the 'software' rung itself where SOFT-GPU (G1460) is in the tree.
//   --mode full    the game's own boot
//   --mode garage  the PROTOTYPE garage-only entry: src/viewer/app.js is served through page.route with the world's boot
//                  steps taken out (the same GARAGE_ONLY replacements as tools/perf/mobile_garage_node.js; every one must
//                  match once) and ?world=none (the island never fetched)
// It records: the boot's wall time and BOOT.log (page clock); the JS heap per boot step (CDP Runtime.getHeapUsage every
// 2 s: V8 used + ArrayBuffer backing stores); the bytes on the wire by kind (CDP Network.loadingFinished encodedDataLength
// - tools/_serve.js sends no Content-Encoding, so these are the bytes BEFORE GitHub Pages' gzip/brotli); renderer.info at
// the end; one still of the garage (proof the garage-only boot draws its shed); the drag handler ms of --rows (the handler
// only: a SwiftShader frame is seconds - NEVER read a frame time off this rig).
// Usage: node tools/perf/mobile_garage_swift.js --mode full|garage [--build cub|metal] [--rows wgSpan,stSpan] [--secs 2400]
//          [--size 412x915] [--out reports/evidence/MOBILE-GARAGE/swift_<mode>_<build>.json] [--shot <file.jpg>]
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), net = require('net');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..'), REPO = path.resolve(ROOT, '..');
const MODE = opt('mode', 'garage'), BK = opt('build', 'cub'), SECS = +opt('secs', 2400), ROWS = opt('rows', 'wgSpan,stSpan').split(',');
const [VW, VH] = opt('size', '412x915').split('x').map(Number);
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json' };
const OUT = path.resolve(opt('out', path.join(ROOT, 'reports/evidence/MOBILE-GARAGE', 'swift_' + MODE + '_' + BK + '.json')));
const SHOT = opt('shot', OUT.replace(/\.json$/, '.jpg'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MiB = x => +(x / 1048576).toFixed(1);
const GARAGE_ONLY = [
  ["if (typeof treeWarm === 'function') treeWarm().catch(() => {});", ''],
  ["for (const id of ['world', 'town', 'parking', 'trees', 'ring', 'settle']) bootTripStep(id);", ''],
  ['if (window.PARKED && window.PARKED.captureAll) window.PARKED.captureAll();', ''],
  ['setTimeout(worldPrelinkSettled, 0); ', ''],
  ["bootTripStep('bake');", ''],
  ["for (const id of ['images', 'upload', 'worldCompile']) bootTripStep(id);", ''],
  ["bootTripStep('frames');", ''],
  ["bootTripStep('craft');", ''],
  ['if (SIMW) SIMW.prewarm(); }', '}'],
  // the boot's last step re-plans the aircraft's keyed steps and runs what moved - with bake and craft taken out above,
  // it ran the FLOWN BAKE there (seen on SwiftShader: recheck 140 -> 340 s); a garage-only boot re-plans nothing
  ["const plan = tripPlan('craft'); if (!plan.length) return;", 'return;'],
];
const findPlaywright = () => { for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', '/opt/node22/lib/node_modules/playwright']) { try { return require(p); } catch (e) {} } throw new Error('no playwright'); };
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const kind = u => /\/media\/tex\//.test(u) ? 'tex' : /\/media\/geo\//.test(u) ? 'geo' : /\/media\/world\/|world_packs|\/island/.test(u) ? 'world' : /\/media\/parked/.test(u) ? 'parked'
  : /\/media\/audio/.test(u) ? 'audio' : /\.js(\?|$)/.test(u) ? 'script' : /\.(json)(\?|$)/.test(u) ? 'json' : /\.html(\?|$)/.test(u) ? 'html' : /\/media\//.test(u) ? 'media-other' : 'other';

(async () => {
  const t0 = Date.now(), T = () => +((Date.now() - t0) / 1000).toFixed(1);
  const port = await freePort();
  const server = spawn(process.execPath, [path.join(ROOT, 'tools', '_serve.js'), String(port), REPO], { stdio: 'ignore' });
  await sleep(800);
  const { chromium } = findPlaywright();
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing', '--disable-accelerated-2d-canvas'] });
  const R = { at: new Date().toISOString(), mode: MODE, build: BK, size: [VW, VH], steps: [], net: {}, netN: 0, errors: [] };
  const save = () => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(R, null, 1)); };
  try {
    const page = await browser.newPage({ viewport: { width: VW, height: VH } });
    page.setDefaultTimeout(SECS * 1000);
    const wip = fs.readFileSync(path.join(ROOT, BUILDS[BK] || BK), 'utf8');
    await page.addInitScript('try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(route$|world$|gfx$|welcome)/.test(k)) localStorage.removeItem(k); localStorage.setItem("flydiy.wip",' + JSON.stringify(wip) + ')}catch(e){};' +
      'document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent="*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";document.head.appendChild(s);});');
    page.on('pageerror', e => R.errors.push(String(e.message || e).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') R.errors.push(m.text().slice(0, 200)); });
    if (MODE === 'garage') await page.route('**/src/viewer/app.js*', async route => {
      const res = await route.fetch(); let code = await res.text();
      for (const [a, b] of GARAGE_ONLY) { const n = code.split(a).length - 1; if (n !== 1) { R.stale = a; console.error('stale prototype: ' + a + ' x' + n); } code = code.replace(a, b); }
      await route.fulfill({ response: res, body: code });
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable'); const urls = new Map();
    cdp.on('Network.responseReceived', e => urls.set(e.requestId, e.response.url));
    cdp.on('Network.loadingFinished', e => { const u = urls.get(e.requestId) || ''; const k = kind(u); R.net[k] = (R.net[k] || 0) + e.encodedDataLength; R.netN++; });
    const url = 'http://127.0.0.1:' + port + '/flyDiy/dev.html' + (MODE === 'garage' ? '?world=none' : '');
    console.log('[' + T() + 's] ' + MODE + ' ' + BK + ' ' + url);
    await page.goto(url, { waitUntil: 'load', timeout: SECS * 1000 });
    let last = null;
    for (;;) {
      let v = null; try { v = await page.evaluate(() => window.BOOT ? [BOOT.state, BOOT.current ? (BOOT.current.id || BOOT.current.label) : null, BOOT.stepI, (BOOT.steps || []).length] : null); } catch (e) {}
      const h = (await cdp.send('Runtime.getHeapUsage').catch(() => ({}))) || {};
      const lab = v ? (v[1] || 'BOOT ' + v[0]) : 'page';
      if (!last || last.step !== lab) { last = { step: lab, t: T(), heap: MiB(h.usedSize || 0), ab: MiB(h.backingStorageSize || 0), peak: 0 }; R.steps.push(last); console.log('[' + T() + 's] ' + lab); }
      last.heap = MiB(h.usedSize || 0); last.ab = MiB(h.backingStorageSize || 0); last.peak = Math.max(last.peak, last.heap + last.ab);
      if (v && v[0] === 'gone' && !v[1] && v[2] >= v[3]) break;
      if (T() > SECS) { R.timeout = true; break; }
      await sleep(2000);
    }
    R.bootSec = T(); R.netTotal = Object.values(R.net).reduce((a, x) => a + x, 0);
    try { R.bootLog = await page.evaluate(() => (BOOT.log || []).map(e => [e.k, e.t, e.id || e.label || ''])); } catch (e) {}
    try { R.gfx = await page.evaluate(() => ({ soft: window.GFX && GFX.soft ? GFX.soft() : null, preset: window.GFX && GFX.get ? (GFX.get().preset || null) : null })); } catch (e) {}
    await sleep(5000);
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); await sleep(1000);
    const h = (await cdp.send('Runtime.getHeapUsage').catch(() => ({}))) || {}; R.afterGC = { heap: MiB(h.usedSize || 0), ab: MiB(h.backingStorageSize || 0) };
    R.peak = Math.max(...R.steps.map(s => s.peak));
    try { R.info = await page.evaluate(() => { const r = window.FLYDIY_RENDERER; return r ? { programs: r.info.programs ? r.info.programs.length : null, geometries: r.info.memory.geometries, textures: r.info.memory.textures, calls: r.info.render.calls, triangles: r.info.render.triangles } : null; }); } catch (e) {}
    console.log('[' + T() + 's] boot ' + R.bootSec + ' s; wire ' + MiB(R.netTotal) + ' MB in ' + R.netN + ' requests ' + JSON.stringify(Object.fromEntries(Object.entries(R.net).map(([k, v]) => [k, MiB(v)]))) +
      '; heap peak ' + R.peak + ' MB, after GC ' + R.afterGC.heap + ' + ' + R.afterGC.ab + ' MB; errors ' + R.errors.length);
    save();
    try { await page.screenshot({ path: SHOT, type: 'jpeg', quality: 80, timeout: 600000 }); R.shot = path.relative(ROOT, SHOT); } catch (e) { R.shotError = String(e).slice(0, 200); }
    // the drag handler ms (in-page dispatch, garage_release.js's procedure, handler only)
    R.drag = [];
    for (const k of ROWS) {
      const r = await page.evaluate(async k => {
        const el = document.getElementById('p_' + k); if (!el || el.type !== 'range') return { key: k, missing: true };
        const PE = window.PointerEvent || Event; const lo = +el.min, hi = +el.max, x0 = +el.value, d = Math.max(+el.step || 0.001, (hi - lo) * 0.012);
        const tk = [], rl = [];
        for (let r = 0; r <= 2; r++) { el.dispatchEvent(new PE('pointerdown'));
          for (let i = 1; i <= 4; i++) { el.value = String(Math.min(hi, Math.max(lo, x0 + d * i * (r % 2 ? -1 : 1)))); const a = performance.now(); el.dispatchEvent(new Event('input')); if (r) tk.push(performance.now() - a); await new Promise(z => setTimeout(z, 30)); }
          const a = performance.now(); el.dispatchEvent(new Event('change')); window.dispatchEvent(new PE('pointerup')); if (r) rl.push(performance.now() - a); await new Promise(z => setTimeout(z, 1500)); }
        const md = a => a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];
        return { key: k, tick: +md(tk).toFixed(1), release: +md(rl).toFixed(1) };
      }, k).catch(e => ({ key: k, error: String(e).slice(0, 120) }));
      R.drag.push(r); console.log('[' + T() + 's] drag ' + JSON.stringify(r)); save();
    }
    save();
  } finally { await browser.close().catch(() => {}); server.kill(); console.log('-> ' + path.relative(ROOT, OUT)); }
})().catch(e => { console.error('mobile_garage_swift: ' + (e && e.stack || e)); process.exit(1); });
