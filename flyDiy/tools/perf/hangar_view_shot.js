#!/usr/bin/env node
// hangar_view_shot.js - HANGAR-VIEW G3630's PROOF (A0, 25 Oct): from inside each garage looking out of its door, and the
// WORLD camera at the same eye, side by side - with the view (the default) and without it (?hview=0: today's room).
//
//   node tools/perf/hangar_view_shot.js [--url http://localhost:8585/flyDiy/dev.html?gfx=gamer] [--rooms w1,HOME]
//        [--variants view,off] [--n 1024] [--out screenshots/hangar_view] [--wait 3000] [--boot-cap 240000]
// One headless boot (the box's GPU) per room and variant: a player document holding the room (flight_core's own rules:
// playerAcquire, never written by hand) with `here` = that room, so the boot builds the world round ITS stand and the
// view is that room's. In the shed: the editor's panels hidden, the orbit turned until its eye looks out of the door
// (the eye at +x of its target: the door is at the room's -x), three framings (door: level; low: the slab and the strip;
// side: off the axis, the parallax) -> <room>_<framing>_<variant>.png, and FLYDIY_HVIEW's stats (the capture's ms, its
// MB, the key). Then 'view' only: rolled out, the free camera put at the shed's eye and target in the world
// (FLYDIY_HVIEW.eye's worldEye / worldTarget, the same field of view) -> <room>_<framing>_world.png. Writes shots.json and
// index.html (each framing: inside with the view | the world camera | inside without). A LOOK, not a timing: GPU untimed,
// the box's lock taken by the caller. Every Chrome profile in the temp dir, deleted after its run.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL0 = opt('url', 'http://localhost:8585/flyDiy/dev.html?gfx=gamer');
const ROOMS = opt('rooms', 'w1,HOME').split(',').filter(Boolean);
const VARIANTS = opt('variants', 'view,off').split(',').filter(Boolean);
const NVIEW = opt('n', null);
const OUT = path.resolve(opt('out', 'screenshots/hangar_view'));
const WAIT = +opt('wait', 3000), BOOT_CAP = +opt('boot-cap', 240000);
const FRAMINGS = { door: { el: 0.06, dist: 9, daz: 0 }, low: { el: -0.02, dist: 13, daz: 0 }, side: { el: 0.08, dist: 9, daz: 0.55 } };
const C = require('../flight_core.js');
const BUY = { w1: ['w1', 'w1', 'field'], 'HOME.2': ['HOME', 'HOME.2', 'club'], w3: ['w3', 'w3', 'field'], mk_sea: ['mk_sea', 'mk_sea', 'field'] };
function docFor(room) {
  let d = C.playerNormalise(C.playerMigrate(C.playerDefault()));
  if (room !== 'HOME') { const b = BUY[room]; if (!b) throw new Error('no offer for ' + room); const r = C.playerAcquire(d, b[0], b[1], b[2], 'own'); if (!r.ok) throw new Error(room + ': ' + r.why); d = r.doc; }
  d.here = room;
  return JSON.stringify(d);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('hangar_view_shot: no Chrome'); process.exit(2); }

async function run(room, variant, idx, rec) {
  const PORT = 9400 + ((process.pid + idx * 7) % 500);
  const udd = path.join(require('os').tmpdir(), 'cdp_hview_' + PORT + '_' + Date.now());
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run',
    '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} };
  const R = rec[room] = rec[room] || {};
  try {
    let tgt = null;
    for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map(), errs = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') errs.push(String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).split('\n')[0]);
      if (m.method === 'Runtime.consoleAPICalled' && /hangar view/.test(JSON.stringify(m.params.args))) errs.push('console: ' + m.params.args.map(a => a.value).join(' ')); };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
      if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r))); return d.result.value; };
    const shot = async name => { const s = await cmd('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(s.result.data, 'base64')); console.log('  wrote ' + name + '.png'); };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{if(!sessionStorage.getItem("__hv")){sessionStorage.setItem("__hv","1");localStorage.removeItem("flydiy.gfx");localStorage.setItem("flydiy.player",' + JSON.stringify(docFor(room)) + ');localStorage.setItem("flydiy.flManual","0");}}catch(e){}' });
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    let url = URL0 + (variant === 'off' ? (URL0.includes('?') ? '&' : '?') + 'hview=0' : '');
    if (NVIEW && variant === 'view') url += (url.includes('?') ? '&' : '?') + 'hviewn=' + (+NVIEW);   // the view's face size (app.js hviewSize)
    await cmd('Page.navigate', { url });
    await sleep(1500);
    // the boot: gone, the prompts kept as they are (the current build, the sandbox)
    let up = false; const t0 = Date.now();
    while (!up && Date.now() - t0 < BOOT_CAP) {
      await sleep(2000);
      await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build|^sandbox$/i.test((b.textContent||'').trim())&&b.children.length===0&&b.offsetParent).forEach(x=>x.click());return 1;})()");
      up = await ev("!!(window.FLIGHT_PROBE && window.FLYDIY_HVIEW && window.GARAGE_ENV && (!window.BOOT || !BOOT.state || BOOT.state === 'gone'))");
    }
    if (!up) throw new Error('the garage never came up');
    await sleep(2500);   // the overlay gone + 2 s before anything is shot (no loading screens)
    const st = JSON.parse(await ev('JSON.stringify(FLYDIY_HVIEW.stats())') || 'null');
    R[variant] = { url, here: await ev('FLYDIY_PLAYER && FLYDIY_PLAYER.doc ? FLYDIY_PLAYER.doc().here : null'), hview: st, errs };
    console.log(room + ' ' + variant + ': ' + JSON.stringify(st));
    // the panels away: the canvas and its ancestors only
    await ev("(()=>{const c=document.querySelector('canvas');const keep=new Set();let e=c;while(e){keep.add(e);e=e.parentElement;}document.querySelectorAll('body *').forEach(el=>{if(!keep.has(el)&&!el.contains(c))el.style.visibility='hidden';});return 1;})()");
    // the orbit's azimuth that puts its eye at +x of its target (looking out of the door, at the room's -x)
    const az0 = JSON.parse(await ev(`(async()=>{let best=null;for(let i=0;i<32;i++){const a=i/32*Math.PI*2;FLIGHT_PROBE.camSet(a,0.06,9);FLIGHT_PROBE.camSettle&&FLIGHT_PROBE.camSettle();
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const E=FLYDIY_HVIEW.eye()||{eye:FLIGHT_PROBE.camGet().eye,target:FLIGHT_PROBE.camGet().target};
      const dx=E.eye[0]-E.target[0],dz=E.eye[2]-E.target[2],k=dx/Math.hypot(dx,dz);if(!best||k>best.k)best={a,k};}return JSON.stringify(best);})()`));
    R.az0 = az0;
    R.eyes = R.eyes || {};
    for (const [fr, F] of Object.entries(FRAMINGS)) {
      await ev('(()=>{FLIGHT_PROBE.camSet(' + (az0.a + F.daz) + ',' + F.el + ',' + F.dist + ');FLIGHT_PROBE.camSettle&&FLIGHT_PROBE.camSettle();return 1;})()');
      await sleep(WAIT);
      if (variant === 'view') R.eyes[fr] = JSON.parse(await ev('JSON.stringify(FLYDIY_HVIEW.eye())') || 'null');
      await shot(room + '_' + fr + '_' + variant);
    }
    // the world camera at the same eyes ('view' only: the roll-out, the free eye, the shed's field of view)
    if (variant === 'view' && R.eyes.door && R.eyes.door.worldEye) {
      await ev("(()=>{const b=document.getElementById('edRoll')||[...document.querySelectorAll('button')].find(b=>/roll out/i.test(b.textContent));if(b)b.click();return 1;})()");
      let out = false;
      for (let i = 0; i < 150 && !out; i++) { await sleep(2000); out = await ev("!!(window.FLYDIY_PREM_EYE && !document.body.classList.contains('garage') && (!window.BOOT || !BOOT.state || BOOT.state === 'gone'))"); }
      if (!out) throw new Error('the roll-out never ended');
      await sleep(2500);
      await ev("(()=>{const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();if(window.SHOT_MODE)SHOT_MODE.enter();return 1;})()");
      for (const fr of Object.keys(FRAMINGS)) {
        const E = R.eyes[fr]; if (!E || !E.worldEye) continue;
        await ev('(()=>{FLYDIY_HVIEW.flyFov(' + E.fov + ');return FLYDIY_PREM_EYE(' + JSON.stringify(E.worldEye) + ',' + JSON.stringify(E.worldTarget) + ');})()');
        await sleep(WAIT + 1500);
        await shot(room + '_' + fr + '_world');
      }
    }
    R[variant].errs = errs.slice(0, 8);
  } catch (e) { console.log(room + ' ' + variant + ': ' + e.message); R[variant] = Object.assign(R[variant] || {}, { error: e.message }); }
  finally { kill(); }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const rec = {}; let idx = 0;
  for (const room of ROOMS) for (const v of VARIANTS) await run(room, v, idx++, rec);
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(rec, null, 1));
  const cell = (f, cap) => fs.existsSync(path.join(OUT, f)) ? `<figure><img src="${f}" loading="lazy"><figcaption>${cap}</figcaption></figure>` : `<figure><div class="none">not shot</div><figcaption>${cap}</figcaption></figure>`;
  let html = '<!doctype html><meta charset="utf-8"><title>Hangar view</title><style>body{font:14px system-ui;background:#111;color:#ddd;margin:16px}h2{margin:24px 0 8px}' +
    '.row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}img{width:100%;display:block}figure{margin:0}figcaption{padding:4px 0;color:#aaa}.none{aspect-ratio:16/9;background:#222}</style>' +
    '<h1>The view out of the garage door (HANGAR-VIEW G3630)</h1><p>Each row: inside the garage with the world\'s view | the world camera at the same eye | inside, today\'s room (?hview=0).</p>';
  for (const room of ROOMS) for (const fr of Object.keys(FRAMINGS))
    html += `<h2>${room} - ${fr}</h2><div class="row">${cell(`${room}_${fr}_view.png`, 'inside, the view')}${cell(`${room}_${fr}_world.png`, 'the world camera, same eye')}${cell(`${room}_${fr}_off.png`, 'inside, today')}</div>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log('hangar_view_shot: ' + OUT);
})();
