#!/usr/bin/env node
// postfx_shot.js - PICTURES OF THE POST PASSES, AND THE PROOF THAT OFF IS OFF (POST-FX study, 2026-09-21)
//
//   node tools/postfx_shot.js --url "http://localhost:8477/flyDiy/dev.html?world=jolene" --out screenshots/postfx-2026-09-21
//        --eye -14,2.2,9 --yaw 300 --pitch 8 --shots "off:@@bloom:GFX.set('bloom','strong')@@off2:GFX.set('bloom','off')"
//        [--garage] [--wait 2500] [--boot 60000] [--log] [--pre "<js>"] [--diff off,off2]
//
// frame_perf.js's boot (BOOT.whenReady, the roll-out, the chooser dismissed, the roll-out
// screen waited for), the aeroplane held on the stand (or the shed as booted with --garage),
// the DEVCAM taken at --eye RELATIVE TO THE AEROPLANE'S CG (x aft-ish, y up, z: the world's
// axes), SHOT_MODE on. Each shot: name : a JS line (GFX rows, anything). After every shot
// POST_FX.stats is printed. --diff a,b prints the pixel difference of two shots - the gate on
// "off is the frame of today" (0 differing pixels with the dither held).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8477/flyDiy/dev.html?world=jolene');
const OUT = opt('out', 'screenshots/postfx-2026-09-21');
const EYE = opt('eye', '-14,2.2,9').split(',').map(Number);
const YAW = +opt('yaw', 300), PITCH = +opt('pitch', 8);
const WAIT = +opt('wait', 2500);
const GARAGE = argv.includes('--garage');
const LOG = argv.includes('--log');
const SHOTS = opt('shots', 'off:').split('@@').map(s => { const i = s.indexOf(':'); return { name: s.slice(0, i), js: s.slice(i + 1) }; });
const DIFF = opt('diff', null);
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('postfx_shot: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_pfx_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const killChrome = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });

// a PNG's pixels, for the diff (no dependency: zlib + the filters)
function pngPixels(file) {
  const zlib = require('zlib'); const buf = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8); const d = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || (d[9] !== 6 && d[9] !== 2)) throw new Error('png: not 8-bit RGB/RGBA'); }
    if (type === 'IDAT') idat.push(d); p += 12 + len; }
  const bpp = 4, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * bpp);
  const hdr = buf.readUInt8(8 + 8 + 9); const B = hdr === 2 ? 3 : 4; const st = w * B;
  let q = 0; const prev = Buffer.alloc(st); const cur = Buffer.alloc(st);
  for (let y = 0; y < h; y++) { const f = raw[q++];
    for (let x = 0; x < st; x++) { const a = x >= B ? cur[x - B] : 0, b = prev[x], c = x >= B ? prev[x - B] : 0; let v = raw[q++];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255; }
    for (let x = 0; x < w; x++) { out[(y * w + x) * 4] = cur[x * B]; out[(y * w + x) * 4 + 1] = cur[x * B + 1]; out[(y * w + x) * 4 + 2] = cur[x * B + 2]; out[(y * w + x) * 4 + 3] = B === 4 ? cur[x * B + 3] : 255; }
    cur.copy(prev); }
  void stride;
  return { w, h, px: out };
}
function diff(a, b) {
  const A = pngPixels(a), Bp = pngPixels(b); if (A.w !== Bp.w || A.h !== Bp.h) return { error: 'sizes differ' };
  let n = 0, max = 0, sum = 0;
  for (let i = 0; i < A.w * A.h; i++) { const d = Math.max(Math.abs(A.px[i * 4] - Bp.px[i * 4]), Math.abs(A.px[i * 4 + 1] - Bp.px[i * 4 + 1]), Math.abs(A.px[i * 4 + 2] - Bp.px[i * 4 + 2])); if (d) { n++; sum += d; if (d > max) max = d; } }
  return { pixels: A.w * A.h, differing: n, maxDelta: max, meanDelta: n ? +(sum / n).toFixed(2) : 0 };
}

(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split('\n').slice(0, 3).join(' | '));
    if (LOG && m.method === 'Runtime.consoleAPICalled' && m.params.type !== 'warning') console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 600)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text))); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  const PRE = opt('pre', null);
  if (PRE) await cmd('Page.addScriptToEvaluateOnNewDocument', { source: PRE });
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  await sleep(1500);
  try { await ev("(() => (window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), " + (+opt('boot', 60000) - 1500) + ")))()"); } catch (e) { await sleep(+opt('boot', 60000)); }
  await sleep(500);
  const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
  if (!GARAGE) {
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) {
      await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
      await sleep(6000);
      flying = await ev("/TAXI|DOWNWIND|FINAL/.test(document.body.innerText)");
    }
    if (!flying) throw new Error('the roll-out never happened');
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
    let bs = '';
    for (let i = 0; i < 100; i++) { bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    console.log('postfx_shot: roll-out screen ' + bs);
    await ev("(()=>{const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return 1;})()");
    // THE FREE EYE, relative to the aeroplane
    await ev("(()=>{const r=document.querySelector('#flRail [data-f=camera]');if(r)r.click();return 1;})()"); await sleep(300);
    const got = await ev("(()=>{const p=[...document.querySelectorAll('#flFlyBody .pill')].find(b=>b.textContent.trim()==='free');if(!p)return 0;p.click();return 1;})()");
    if (!got) throw new Error('no free pill on the camera flyout');
    await ev("(()=>{const r=document.querySelector('#flRail [data-f=camera]');if(r)r.click();return 1;})()");
    await ev("(()=>{if(window.SHOT_MODE)SHOT_MODE.enter();return 1;})()");
    const cg = JSON.parse(await ev("JSON.stringify(FLIGHT_PROBE.sim().cgPos())"));
    await ev(`(()=>{const c=DEV_CAM;c.pos.set(${cg[0] + EYE[0]},${cg[1] + EYE[1]},${cg[2] + EYE[2]});c.yaw=${YAW * Math.PI / 180};c.pitch=${PITCH * Math.PI / 180};return 1;})()`);
    for (let i = 0; i < 60 && !(await ev("!!(window.CLOUDS && CLOUDS.baked)")); i++) await sleep(250);
    console.log('postfx_shot: cg ' + cg.map(v => v.toFixed(1)).join(',') + ' eye +' + EYE.join(','));
  } else {
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
  }
  await sleep(1500);
  fs.mkdirSync(OUT, { recursive: true });
  for (const s of SHOTS) {
    if (s.js) await ev('(()=>{' + s.js + ';return 1;})()');
    await sleep(WAIT);
    const shot = await cmd('Page.captureScreenshot', { format: 'png' });
    const file = path.join(OUT, s.name + '.png'); fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    const info = await ev("JSON.stringify(window.POST_FX ? {hooked: POST_FX.hooked, on: POST_FX.KEYS.filter(k => POST_FX.S[k] !== 'off').map(k => k + ':' + POST_FX.S[k]), stats: Object.fromEntries(Object.entries(POST_FX.stats).map(([k, v]) => [k, +(+v).toFixed(3)])), rt: FLYDIY_AA.report(), exposure: (window.FLYDIY_RENDERER || WORLD.renderer).toneMappingExposure} : null)");
    console.log('postfx_shot: ' + file + '  ' + info);
  }
  ws.close(); killChrome();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  if (DIFF) { const [a, b] = DIFF.split(','); console.log('postfx_shot: diff ' + a + ' vs ' + b + ' ' + JSON.stringify(diff(path.join(OUT, a + '.png'), path.join(OUT, b + '.png')))); }
})().catch(e => { console.error('postfx_shot: ' + e.message); killChrome(); process.exit(1); });
