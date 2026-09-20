#!/usr/bin/env node
// cloud_shot.js - PICTURES OF THE SKY FROM A FREE EYE (A6, 2026-09-20)
//
//   node tools/cloud_shot.js --url "http://localhost:8431/flyDiy/dev.html?world=none&cloud=0.45,cu" \
//        --at 0,150,0 --out screenshots/clouds-2026-09-20 \
//        --shots "up:0,300,0:0:35:@@far:0,300,0:90:5:CLOUDS.S.steps=96"
//
// island_shot.js's rig (headless Chrome on this machine's GPU, the game
// rolled out, the chooser dismissed, the aeroplane teleported to --at and
// held), then the DEVCAM taken (the CAMERA rail's `free` pill, SHOT_MODE on
// so the UI is out of the frame) and ONE BOOT serves MANY SHOTS: each shot
// (shots separated by @@) is name : eye x,y,z (world, absolute) : yaw deg (0 = -z, 90 = +x) : pitch
// deg (up positive) : a JS line evaluated before it (CLOUDS.S dials, the
// clock, anything). The page's exceptions are printed; --log prints its
// console. After every shot CLOUDS.stats and the layer are printed, so the
// picture carries its numbers (the GPU timer's ms, the cover, the base).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8431/flyDiy/dev.html?world=none');
const AT = opt('at', '0,150,0').split(',').map(Number);
const OUT = opt('out', 'screenshots/clouds-2026-09-20');
const WAIT = +opt('wait', 4000);
const SHOTS = opt('shots', 'up:0,400,0:0:35:').split('@@').map(s => { const p = s.split(':'); return { name: p[0], eye: (p[1] || '0,400,0').split(',').map(Number), yaw: +(p[2] || 0), pitch: +(p[3] || 30), js: p.slice(4).join(':') }; });
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('cloud_shot: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_shot_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  const LOG = argv.includes('--log');
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split(String.fromCharCode(10)).slice(0, 3).join(' | '));
    if (LOG && m.method === 'Runtime.consoleAPICalled') console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 1200)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text))); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  await sleep(+opt('boot', 20000));
  let flying = false;
  for (let a = 0; a < 14 && !flying; a++) {
    await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
    await sleep(5000);
    flying = await ev("/TAXI|DOWNWIND|FINAL/.test(document.body.innerText)");
  }
  if (!flying) throw new Error('the roll-out never happened');
  // the fresh profile's chooser (NEW AEROPLANE / keep the current build) can appear after the roll-out: poll it away
  const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
  for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
  await ev(`(()=>{const s=FLIGHT_PROBE.sim(),w=FLIGHT_PROBE.world();const cg=s.cgPos();const gy=w.terrainH(${AT[0]},${AT[2]});
    const dx=${AT[0]}-cg[0],dy=(gy+${AT[1]})-cg[1],dz=${AT[2]}-cg[2];
    for(let i=0;i<s.n;i++){s.p[i*3]+=dx;s.p[i*3+1]+=dy;s.p[i*3+2]+=dz;s.v[i*3]=s.v[i*3+1]=s.v[i*3+2]=0;}
    const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return 1;})()`);
  // THE FREE EYE: the CAMERA rail's `free` pill, the flyout closed, the UI out of the frame
  await ev("(()=>{const r=document.querySelector('#flRail [data-f=camera]');if(r)r.click();return 1;})()");
  await sleep(300);
  const got = await ev("(()=>{const p=[...document.querySelectorAll('#flFlyBody .pill')].find(b=>b.textContent.trim()==='free');if(!p)return 0;p.click();return 1;})()");
  if (!got) throw new Error('no free pill on the camera flyout');
  // --ui <slot>: the flyout of that rail slot left open and the UI in the frame (a picture of the rows), else SHOT_MODE hides it
  const UI = opt('ui', null);
  await ev("(()=>{const r=document.querySelector('#flRail [data-f=camera]');if(r)r.click();return 1;})()");
  if (UI) await ev(`(()=>{const s=document.querySelector('#flSlots .flSlot[data-s="${UI}"]');if(s)s.click();return 1;})()`);
  else await ev("(()=>{if(window.SHOT_MODE)SHOT_MODE.enter();return 1;})()");
  await sleep(500);
  fs.mkdirSync(OUT, { recursive: true });
  for (let i = 0; i < 60 && !(await ev("!!(window.CLOUDS && CLOUDS.baked)")); i++) await sleep(250);   // the noise bakes a few slices a frame
  for (const s of SHOTS) {
    await ev(KEEP);
    if (s.js) await ev('(()=>{' + s.js + ';return 1;})()');
    await ev(`(()=>{const c=DEV_CAM;c.pos.set(${s.eye[0]},${s.eye[1]},${s.eye[2]});c.yaw=${s.yaw * Math.PI / 180};c.pitch=${s.pitch * Math.PI / 180};return 1;})()`);
    await sleep(WAIT);
    const shot = await cmd('Page.captureScreenshot', { format: 'png' });
    const file = path.join(OUT, s.name + '.png');
    fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    const info = await ev("JSON.stringify({stats: CLOUDS.stats, layer: CLOUDS.layer, mode: CLOUDS.S.mode, day: (DAY_CLOCK && DAY_CLOCK.day()) ? {cover: DAY_CLOCK.day().cloudCover, type: DAY_CLOCK.day().cloudType, base: Math.round(DAY_CLOCK.day().cloudBase), sunEl: +(Math.asin(DAY_CLOCK.day().sun[1])*57.3).toFixed(1)} : null})");
    console.log('cloud_shot: ' + file + '  ' + info);
    if (argv.includes('--probe')) console.log('  probe ' + await ev("JSON.stringify(CLOUDS.probe())"));
  }
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('cloud_shot: ' + e.message); ch.kill(); process.exit(1); });
