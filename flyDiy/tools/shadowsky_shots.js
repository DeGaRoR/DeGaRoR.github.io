#!/usr/bin/env node
// shadowsky_shots.js - FIXED VIEWS FOR A BEFORE / AFTER (A2-SHADOW-SKY G650, playtest 2026-09-26)
//
// rollout_perf's --shot catches the live roll-out at a time, wherever the pilot has taxied; a look fix needs the SAME
// eye twice. This rig rolls out (headless Chrome on this machine's GPU, the legacy rig clock - frame_perf's path),
// then for each VIEW holds the aeroplane at a place, pauses, sets the orbit and the hour, lets the streamers land,
// runs an optional page expression, and writes a PNG - one per view per page, so two pages (--pages index_before.html,
// index.html) give pairs. Views are a JSON list:
//   { "name": "stand", "at": "stand" | [x, z, agl], "cam": [az, el, dist], "hour": "noon" | ..., "js": "<expr>",
//     "settle": <frames>, "orbit": [daz, frames] (turn the orbit by daz rad over that many frames, the capture in the
//     middle of the turn: the clouds' sync) }
// Usage: node tools/shadowsky_shots.js --views <file.json | inline json> [--pages index_before.html,index.html]
//          [--size 1600x900] [--port 8541] [--fallback D:/Dev/DeGaRoR.github.io] [--out tools/perf/shadowsky] [--q 'depth=log']
// A MEASUREMENT, not a gate (a GPU and a browser). Announce it: the GPU is shared (tools/perf/GPU_BENCH.lock).
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const VIEWS = (v => JSON.parse(fs.existsSync(v) ? fs.readFileSync(v, 'utf8') : v))(opt('views', '[{"name":"stand","at":"stand","cam":[-2.5,0.22,14]}]'));
const PAGES = opt('pages', 'index.html').split(',');
const SIZE = opt('size', '1600x900').split('x').map(Number);
const SPORT = +opt('port', 8541);
const OUT = opt('out', path.join(__dirname, 'perf', 'shadowsky'));
const Q = opt('q', '');
const FALLBACK = opt('fallback', null);
const REPO = path.resolve(__dirname, '..', '..');
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });

const srvArgs = [path.join(__dirname, '_serve.js'), String(SPORT), REPO]; if (FALLBACK) srvArgs.push('--fallback', FALLBACK);
const server = spawn(process.execPath, srvArgs, { stdio: 'ignore' });

// the hold: the aeroplane moved to a place (or left where the roll-out put it) and paused
const HOLD = at => `(async () => {
  const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
  const s = FLIGHT_PROBE.sim(), w = FLIGHT_PROBE.world();
  let at = ${JSON.stringify(at)};
  if (at && at.shore) {   // the first water 1.5-6 km out in sixteen headings (frame_perf's sea), held at agl over it, a few hundred metres off the land
    let best = null;
    for (let r = 1500; r <= 6000 && !best; r += 250) for (let k = 0; k < 16 && !best; k++) { const a = k / 16 * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (w.terrainH(x, z) <= 0 && w.terrainH(x * 1.1, z * 1.1) <= 0) best = [x * 1.05, z * 1.05]; }
    at = [(best || [3000, 0])[0], (best || [3000, 0])[1], at.shore];
  }
  if (Array.isArray(at)) { const cg = s.cgPos(), gy = Math.max(w.terrainH(at[0], at[1]), w.waterH ? (w.waterH(at[0], at[1]) || -1e9) : -1e9) + at[2];
    const dx = at[0] - cg[0], dy = gy - cg[1], dz = at[1] - cg[2];
    await FLIGHT_PROBE.place({ by: [dx, dy, dz], zeroV: true }); }   // G1096: on the sim that flies (under the worker the page's sim is a view)
  return JSON.stringify(s.cgPos().map(v => Math.round(v))); })()`;
const FRAMES = n => `new Promise(r => { let k = 0; const f = () => { if (++k >= ${n}) r(k); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`;

async function runPage(page) {
  const port = 9600 + (process.pid % 300) + PAGES.indexOf(page);
  const udd = path.join(os.tmpdir(), 'cdp_ss_' + port + '_' + Date.now());
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--window-size=' + SIZE[0] + ',' + SIZE[1], '--hide-scrollbars', '--no-first-run',
    '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { if (process.platform === 'win32') execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} };
  try {
    let tgt = null;
    for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + port + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
      if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r))); return d.result.value; };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.removeItem("flydiy.wip");localStorage.removeItem("flydiy.gfx");localStorage.removeItem("flydiy.premises.game.jolene")}catch(e){}' });
    await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
    const url = 'http://localhost:' + SPORT + '/flyDiy/' + page + (Q ? '?' + Q : '');
    await cmd('Page.navigate', { url });
    await sleep(1500);
    try { await ev("Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('timeout'), 150000))])"); } catch (e) { await sleep(18500); }
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) { await ev("(()=>{const b=document.getElementById('bGo'); if (b) b.click();})()"); await sleep(6000); flying = await ev("/TAXI|DOWNWIND|FINAL|DEPART/.test(document.body.innerText) && !!window.FLIGHT_PROBE"); }
    for (let i = 0; i < 150; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
    await sleep(3000);
    const tag = path.basename(page, '.html') + (Q ? '_' + Q.replace(/\W+/g, '') : '');
    for (const V of VIEWS) {
      const where = await ev(HOLD(V.at || 'stand'));
      if (V.hour) await ev(`(() => { if (window.DAY_CLOCK && DAY_CLOCK.preset) DAY_CLOCK.preset(${JSON.stringify(V.hour)}); return 1; })()`);
      if (V.cam) await ev(`FLIGHT_PROBE.camSet(${V.cam.join(',')})`);
      if (V.js) await ev(V.js);
      await ev(FRAMES(V.settle || 240));
      if (V.cam) await ev(`FLIGHT_PROBE.camSet(${V.cam.join(',')})`);
      if (V.orbit) {   // a turn under way: the capture comes with the orbit moving (camSet every frame, the target a step ahead)
        const [daz, n] = V.orbit;
        await ev(`new Promise(r => { let k = 0; const a0 = ${V.cam[0]}, e = ${V.cam[1]}, d = ${V.cam[2]}; const f = () => { FLIGHT_PROBE.camSet(a0 + ${daz} * k / ${n}, e, d); if (++k >= ${n}) r(k); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
      } else await ev(FRAMES(8));
      const png = await cmd('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(OUT, { recursive: true });
      const file = path.join(OUT, V.name + '_' + tag + '.png');
      fs.writeFileSync(file, Buffer.from(png.result.data, 'base64'));
      const info = V.report ? await ev(V.report) : '';
      console.log('  ' + V.name + ' @' + where + ' -> ' + path.relative(process.cwd(), file) + (info ? '  ' + info : ''));
    }
    try { await cmd('Browser.close'); } catch (e) {}
  } finally { await sleep(500); kill(); }
}

(async () => {
  await sleep(800);
  for (const p of PAGES) { console.log('shadowsky_shots: ' + p); await runPage(p); }
  server.kill();
  process.exit(0);
})().catch(e => { console.error(e); server.kill(); process.exit(1); });
