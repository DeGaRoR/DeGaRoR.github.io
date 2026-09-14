#!/usr/bin/env node
// island_shot.js - ONE PICTURE OF THE ISLAND FROM A DECLARED SPOT (G407)
//
//   node tools/island_shot.js --url "http://localhost:8430/flyDiy/dev.html?world=jolene" \
//        --at -100,450,100 --out bench/jolene/shot_map.png [--wait 12000]
//
// Headless Chrome on this machine's GPU (tree_perf.js's rig), the game rolled
// out, the fresh profile's chooser dismissed, the aeroplane teleported to
// `--at` (x, AGL, z: the height is added to the ground there) and HELD, the
// streamer given `--wait` ms to settle, one screenshot written. Two runs with
// two URLs are an A/B from the same eye - which is what the picture is for.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8430/flyDiy/dev.html?world=jolene');
const AT = opt('at', '-100,450,100').split(',').map(Number);
const OUT = opt('out', 'bench/jolene/shot.png');
const WAIT = +opt('wait', 12000);
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('island_shot: no Chrome'); process.exit(2); }
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
    // the page's own words: every exception, and (--log) every console line
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split(String.fromCharCode(10)).slice(0, 3).join(' | '));
    if (LOG && m.method === 'Runtime.consoleAPICalled') console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 1200)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && r.result.exceptionDetails.text)); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  await sleep(20000);
  let flying = false;
  for (let a = 0; a < 8 && !flying; a++) {
    await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
    await sleep(6000);
    flying = await ev("/TAXI|DOWNWIND|FINAL/.test(document.body.innerText)");
  }
  if (!flying) throw new Error('the roll-out never happened');
  await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());})()");
  await sleep(3000);
  await ev(`(()=>{const s=FLIGHT_PROBE.sim(),w=FLIGHT_PROBE.world();const cg=s.cgPos();const gy=w.terrainH(${AT[0]},${AT[2]});
    const dx=${AT[0]}-cg[0],dy=(gy+${AT[1]})-cg[1],dz=${AT[2]}-cg[2];
    for(let i=0;i<s.n;i++){s.p[i*3]+=dx;s.p[i*3+1]+=dy;s.p[i*3+2]+=dz;s.v[i*3]=s.v[i*3+1]=s.v[i*3+2]=0;}
    const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return 1;})()`);
  // --cam az,el,dist: the orbit camera set where a picture wants it (G413: the whole island from above)
  const CAM = opt('cam', null);
  if (CAM) { const c = CAM.split(',').map(Number); await ev(`FLIGHT_PROBE.camSet(${c[0]}, ${c[1]}, ${c[2]}), 1`); }
  await sleep(WAIT);
  const shot = await cmd('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
  const info = await ev("JSON.stringify({aero: FLIGHT_PROBE.world().aerodromes.map(a=>a.id), lakes: FLIGHT_PROBE.world().hydro.lakeCount, rivers: FLIGHT_PROBE.world().hydro.rivers.length, bakeMs: FLIGHT_PROBE.world().hydro.bakeMs, hydro: FLIGHT_PROBE.world().island && FLIGHT_PROBE.world().island.hydro})");
  console.log('island_shot: wrote ' + OUT + '  ' + info);
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('island_shot: ' + e.message); ch.kill(); process.exit(1); });
