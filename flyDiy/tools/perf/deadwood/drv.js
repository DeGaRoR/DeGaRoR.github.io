// drv.js - DEADWOOD-BRIGHT capture driver: boots dev.html in headless Chrome (imp_audit's rig), rolls out,
// then runs a step module: module.exports = async ({ ev, shot, sleep, log, out }) => {...}
// usage: node drv.js <url> <steps.js> <outdir>
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const [URL, STEPS, OUT] = process.argv.slice(2);
const PORT = 9500 + (process.pid % 400);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const udd = path.join(require('os').tmpdir(), 'cdp_dw_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split('\n').slice(0, 2).join(' | '));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') console.error('page error: ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 300)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text))); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const shot = async (name, clip) => { const r = await cmd('Page.captureScreenshot', Object.assign({ format: 'png' }, clip ? { clip: Object.assign({ scale: 1 }, clip) } : {}));
    const buf = Buffer.from(r.result.data, 'base64'); fs.writeFileSync(path.join(OUT, name + '.png'), buf); return buf; };
  const saveData = (name, dataUrl) => fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
  await cmd('Page.navigate', { url: URL });
  await sleep(1500);
  try { await ev("(() => (window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)))()"); } catch (e) { await sleep(18500); }
  await sleep(500);
  let flying = false;
  for (let a = 0; a < 8 && !flying; a++) {
    await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
    await sleep(6000);
    flying = await ev("/TAXI|DOWNWIND|FINAL/.test(document.body.innerText)");
  }
  if (!flying) throw new Error('the roll-out never happened');
  await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());})()");
  for (let i = 0; i < 90; i++) { if (await ev("!!(window.WORLD && window.FLIGHT_PROBE && WORLD.treeAtlases)")) break; await sleep(1000); }
  await ev("WORLD.treeSettled()");
  await sleep(3000);
  const log = (...a) => console.log(...a);
  await require(path.resolve(STEPS))({ ev, shot, sleep, log, out: OUT, saveData, cmd });
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('drv: ' + e.stack); ch.kill(); process.exit(1); });
