#!/usr/bin/env node
// dirt_strip_stills.js - THE DIRT STRIP, PICTURED (DIRT-STRIP, 2026-11-09): before / after stills of a soft strip's tyre
// marks and its micro-height, FOR A0's BOX (one headless Chrome on the GPU; terrain_still.js's page driver, verbatim where
// it could be). For each PAGE (e.g. index_before.html = master's, index.html = today's) it boots the game with the user's
// Cub in flydiy.wip, rolls out, holds the aeroplane on the strip (paused, its wheels on terrainH), sets the hour and the
// orbit, lets the streamers land, and writes <view>_<page>.png. The same eye on both pages.
//
//   node tools/dirt_strip_stills.js --strip nv_strip --pages index.html --out D:/Dev/flydiy-notes/evidence/dirt-strip-2026-11-09/before
//        [--views along,quarter,top,close,back] [--hour golden] [--size 1600x900] [--port 8547] [--js "<page statements>"]
//
// The views (the strip's own frame: u along from end 0, n across; the orbit is FLIGHT_PROBE.camSet(az, el, dist), the
// camera at target + dist (cos el cos az, sin el, cos el sin az)):
//   along    the Cub 30 m in, 3 m off the centreline; the eye behind it, low, down the strip
//   quarter  the same place, a three-quarter view from 30 m up and back
//   top      straight-ish down from 55 m: the marks' distribution across the width
//   close    the eye at 5 m beside the main wheel: a tyre against its marks
//   back     the Cub at the far end, the eye beyond it looking back up the whole strip (the touchdown zone)
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const PAGES = opt('pages', 'index.html').split(',');
const STRIP = opt('strip', 'nv_strip');
const HOUR = opt('hour', 'golden');
const BUILD = opt('build', 'builds/cub_2026-09-20_corrected.json');
const REST = +opt('rest', 1.095);   // the Cub's resting CG over terrainH (G1540)
const JS = opt('js', '');
const SETTLE = +opt('settle', 1500);   // ms the sim runs after the place (the tail settles), then paused again
const strip = id => { const W = require(path.join(__dirname, 'island_node.js')).islandWorld('jolene', { premises: fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8') }); return W.aerodromes.find(a => a.id === id); };
const A = strip(STRIP);
if (!A) { console.error('dirt_strip_stills: no strip ' + STRIP); process.exit(2); }
const D = [Math.cos(A.hdg), Math.sin(A.hdg)], N = [-D[1], D[0]];
const P = (u, n) => [A.x + D[0] * (u - A.len / 2) + N[0] * n, A.z + D[1] * (u - A.len / 2) + N[1] * n];
const azOf = (dx, dz) => Math.atan2(dz, dx);
// az of the eye's offset from the target: behind = -D
const BEHIND = azOf(-D[0], -D[1]), AHEAD = azOf(D[0], D[1]), SIDE = azOf(N[0], N[1]);
const VIEWS = {
  along:   { at: P(30, 3), cam: [BEHIND + 0.10, 0.06, 11] },
  quarter: { at: P(30, 3), cam: [BEHIND + 0.75, 0.42, 30] },
  top:     { at: P(Math.min(75, A.len / 2), 4), cam: [BEHIND + 0.05, 1.22, 55] },
  close:   { at: P(40, 2.2), cam: [BEHIND + 1.0, 0.30, 8] },
  back:    { at: P(A.len - 25, -2.5), cam: [AHEAD - 0.08, 0.07, 14] },
};
const VIEW_KEYS = opt('views', Object.keys(VIEWS).join(',')).split(',');
const SIZE = opt('size', '1600x900').split('x').map(Number);
const SPORT = +opt('port', 8547);
const OUT = path.resolve(opt('out', path.join(ROOT, 'reports/evidence/DIRT-STRIP')));
const REPO = path.resolve(ROOT, '..');
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const server = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(SPORT), REPO], { stdio: 'ignore' });

const HOLD = (at, agl) => `(async () => {
  const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
  const s = FLIGHT_PROBE.sim(), w = FLIGHT_PROBE.world(), at = ${JSON.stringify(at)};
  const cg = s.cgPos(), gy = w.terrainH(at[0], at[1]) + ${agl};
  await FLIGHT_PROBE.place({ by: [at[0] - cg[0], gy - cg[1], at[1] - cg[2]], zeroV: true });
  // SETTLE (the tail comes down): run ~1.5 s, then pause again
  if (${SETTLE}) { const tg = () => document.getElementById('bPause').click(); tg(); await new Promise(r => setTimeout(r, ${SETTLE})); tg(); }
  return JSON.stringify(s.cgPos().map(v => Math.round(v * 10) / 10)); })()`;
const FRAMES = n => `new Promise(r => { let k = 0; const f = () => { if (++k >= ${n}) r(k); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`;

async function runPage(page) {
  const port = 9660 + (process.pid % 200) + PAGES.indexOf(page);
  const udd = path.join(os.tmpdir(), 'cdp_ds_' + port + '_' + Date.now());
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--window-size=' + SIZE[0] + ',' + SIZE[1], '--hide-scrollbars', '--no-first-run',
    '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { if (process.platform === 'win32') execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} };
  const out = [];
  try {
    let tgt = null;
    for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + port + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') console.log('  page exception: ' + String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).split('\n')[0]); };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
      if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r))); return d.result.value; };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    const wip = fs.readFileSync(path.join(ROOT, BUILD), 'utf8');
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{if(!sessionStorage.getItem("__ds")){sessionStorage.setItem("__ds","1");localStorage.removeItem("flydiy.gfx");localStorage.removeItem("flydiy.premises.game.jolene");localStorage.setItem("flydiy.wip",' + JSON.stringify(wip) + ');}}catch(e){}' });
    await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
    await cmd('Page.navigate', { url: 'http://localhost:' + SPORT + '/flyDiy/' + page });
    await sleep(1500);
    try { await ev("Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('timeout'), 150000))])"); } catch (e) {}
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) { await ev("(()=>{const b=document.getElementById('bGo'); if (b) b.click();})()"); await sleep(6000); flying = await ev("/TAXI|DOWNWIND|FINAL|DEPART|HOLD|PARK/.test(document.body.innerText)"); }
    for (let i = 0; i < 150; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
    await sleep(3000);
    if (JS) console.log('  js: ' + await ev('(()=>{' + JS + '})()').catch(e => 'ERR ' + e.message));
    // the UI out of the picture: the world and the aeroplane alone
    await ev("(()=>{['ui','devPanel','hud','rail'].forEach(i=>{const e=document.getElementById(i);if(e)e.style.visibility='hidden';});document.querySelectorAll('.card,.panel,#phase,#hud,.toast,button').forEach(e=>e.style.visibility='hidden');return 1;})()").catch(() => 0);
    const tag = path.basename(page, '.html');
    for (const vk of VIEW_KEYS) {
      const V = VIEWS[vk]; if (!V) continue;
      const where = await ev(HOLD(V.at, REST));
      await ev(`(() => { if (window.DAY_CLOCK && DAY_CLOCK.preset) DAY_CLOCK.preset(${JSON.stringify(HOUR)}); return 1; })()`);
      await ev(`FLIGHT_PROBE.camSet(${V.cam.join(',')})`);
      await ev(FRAMES(out.length ? 120 : 400));
      await ev(`FLIGHT_PROBE.camSet(${V.cam.join(',')})`); await ev(FRAMES(10));
      const png = await cmd('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(OUT, { recursive: true });
      const file = path.join(OUT, vk + '_' + tag + '.png');
      fs.writeFileSync(file, Buffer.from(png.result.data, 'base64'));
      console.log('  ' + vk + ' @' + where + ' -> ' + file);
      out.push({ page, view: vk, cam: V.cam, where, file });
    }
    try { await cmd('Browser.close'); } catch (e) {}
  } finally { await sleep(500); kill(); try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} }
  return out;
}

(async () => {
  await sleep(800);
  console.log('dirt_strip_stills: ' + STRIP + ' len ' + A.len + ' wid ' + A.wid + ' hdg ' + A.hdg.toFixed(4) + ' hour ' + HOUR);
  const all = [];
  for (const p of PAGES) { console.log('dirt_strip_stills: ' + p); try { all.push(...await runPage(p)); } catch (e) { console.log('  FAILED: ' + e.message); } }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'stills_' + STRIP + '.json'), JSON.stringify(all, null, 1));
  server.kill();
  process.exit(0);
})().catch(e => { console.error(e); server.kill(); process.exit(1); });
