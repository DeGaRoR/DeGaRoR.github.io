#!/usr/bin/env node
// rollreal_shots.js - THE ROLL-OUT SHOT ON FILM (G1115, ROLLOUT-REAL): a headed Chrome plays the real roll-out (the shed's
// check, the cut, the roll, the hand-over to the flight) and CDP's screencast keeps every composited frame it sends, with
// its time since the click. For the user's eyes (the evidence frames) and for looking at a change before it is measured.
// UNTIMED: a screencast costs the page a copy a frame - never read a frame time off this rig (rollout_perf is the measure).
//
//   node tools/rollreal_shots.js --port 8561 --udd C:/t/rrs --out tools/perf/rollreal_raw/after [--root <repo>]
//        [--page index.html|dev.html] [--build default|<file.json>] [--q 'rollreal=0'] [--secs 16] [--size 1600x900]
//        [--fallback D:/Dev/DeGaRoR.github.io] [--every 1] [--cam chase|orbit|wing]
//   -> <out>/f_<ms>.jpg (q92, the page's size) and <out>/index.json { frames: [[file, ms]], trip, plan, errors }
// No --port / --udd defaults on purpose: a shared box (rollout_perf's port-hijack trap) - both are required.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PORT = +opt('port', 0), UDD = opt('udd', null), OUT = opt('out', null);
if (!PORT || !UDD || !OUT) { console.error('rollreal_shots: --port, --udd and --out are required'); process.exit(2); }
const REPO = path.resolve(opt('root', path.join(__dirname, '..', '..')));
const FALLBACK = opt('fallback', 'D:/Dev/DeGaRoR.github.io');
const PAGE = opt('page', 'index.html'), BUILD = opt('build', 'default'), SECS = +opt('secs', 16), EVERY = +opt('every', 1);
const SIZE = opt('size', '1600x900').split('x').map(Number), CAM = opt('cam', null);
const Q = opt('q', '');
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
  .find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
function preScript() {
  const L = [];
  if (BUILD === 'default') L.push('try{localStorage.removeItem("flydiy.wip")}catch(e){}');
  else if (BUILD === 'stock') L.push(require('./_stock_pin.js').pinScript());
  else L.push('try{localStorage.setItem("flydiy.wip",' + JSON.stringify(fs.readFileSync(path.resolve(BUILD), 'utf8')) + ')}catch(e){}');
  L.push('try{localStorage.removeItem("flydiy.gfx");for(const k of Object.keys(localStorage))if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|rollanim$|rollreal$)/.test(k))localStorage.removeItem(k)}catch(e){}');
  L.push('try{localStorage.setItem("flydiy.route",' + JSON.stringify(JSON.stringify({ from: 'HOME', dest: 'CIRCUIT' })) + ')}catch(e){}');
  return L.join('\n');
}
(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(PORT), REPO, '--fallback', FALLBACK], { stdio: 'ignore' });
  let sExit = null; server.on('exit', c => { sExit = c; });
  // the server that answers is ours (_serve.js names its root)
  for (let i = 0; ; i++) {
    if (sExit !== null) throw new Error('the static server exited: port ' + PORT + ' is taken');
    const root = await new Promise(res => { const rq = http.get('http://127.0.0.1:' + PORT + '/flyDiy/version.json', r => { r.resume(); res(r.headers['x-serve-root'] ? decodeURIComponent(r.headers['x-serve-root']) : '?'); }); rq.on('error', () => res(null)); });
    if (root) { if (path.resolve(root).toLowerCase() !== REPO.toLowerCase()) throw new Error('port ' + PORT + ' serves ' + root); break; }
    if (i > 40) throw new Error('no server'); await sleep(250);
  }
  const DPORT = 9800 + (process.pid % 150);
  const ch = spawn(CHROME, ['--remote-debugging-port=' + DPORT, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140), '--window-position=0,0',
    '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + path.resolve(UDD), '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { for (const p of [ch, server]) try { execSync('taskkill /PID ' + p.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', kill);
  let tgt = null;
  for (let i = 0; i < 50 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(), errors = [], frames = [];
  let tClick = 0, rec = false;
  fs.mkdirSync(OUT, { recursive: true });
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text || '').split('\n')[0]);
    if (m.method === 'Page.screencastFrame') {
      ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId: m.params.sessionId } }));
      if (rec) { const ms = Math.round(m.params.metadata.timestamp * 1000 - tClick); const f = 'f_' + String(Math.max(0, ms)).padStart(6, '0') + '.jpg';
        fs.writeFileSync(path.join(OUT, f), Buffer.from(m.params.data, 'base64')); frames.push([f, ms]); }
    }
  };
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
    if (!d || d.exceptionDetails) throw new Error('page: ' + JSON.stringify(d && d.exceptionDetails && (d.exceptionDetails.exception || d.exceptionDetails.text)));
    return d.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: preScript() });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  const url = 'http://localhost:' + PORT + '/flyDiy/' + PAGE + (Q ? '?' + Q : '');
  await cmd('Page.navigate', { url });
  await sleep(2000);
  console.log('rollreal_shots: ' + url + ' - ' + await ev("Promise.race([window.BOOT && BOOT.whenReady ? BOOT.whenReady().then(() => 'ready') : 'no BOOT', new Promise(r => setTimeout(() => r('timeout'), 300000))])"));
  for (let i = 0; i < 8; i++) { const n = await ev("(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()"); await sleep(400); if (!n && i > 3) break; }
  if (CAM) await ev("(()=>{ try { const c = window.FLIGHT_PROBE && FLIGHT_PROBE.cam; if (c) c.mode = '" + CAM + "'; } catch (e) {} return 1; })()");
  await sleep(4000);                     // the shed settled (its see-through programs at +1.5 s)
  await cmd('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: SIZE[0], maxHeight: SIZE[1], everyNthFrame: EVERY });
  await sleep(600);
  tClick = Date.now(); rec = true;
  // ONE press: the bar's #bGo (the editor's #edRoll says 'Roll out' too - a second press skips the shot)
  await ev("(()=>{const g=document.getElementById('bGo');const l=[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)&&b.offsetParent);const b=g&&g.offsetParent&&/roll out/i.test(g.textContent)?g:l[0];if(b)b.click();return l.length;})()");
  await sleep(SECS * 1000);
  rec = false;
  await cmd('Page.stopScreencast');
  const trip = await ev("JSON.stringify((window.FLYDIY_TRIPS || []).slice(-1)[0] || null)");
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ url, frames, trip: JSON.parse(trip), errors }, null, 1));
  console.log('  ' + frames.length + ' frames over ' + SECS + ' s -> ' + OUT + '\n  trip ' + trip + '\n  errors ' + JSON.stringify(errors.slice(0, 5)));
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(1500);
  process.exit(0);
})().catch(e => { console.error('rollreal_shots: ' + (e && e.stack)); process.exit(1); });
