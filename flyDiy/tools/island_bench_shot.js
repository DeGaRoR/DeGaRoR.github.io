#!/usr/bin/env node
// island_bench_shot.js - ONE PICTURE OF THE ISLAND BENCH (tools/_island.html)
// from a declared eye, in headless Chrome on this machine's GPU (island_shot's
// rig). For the splat chantier: the pane's GPU process dies under a heavy
// shader compile and stays dead for the app's life, so the bench is judged
// from here as well - and the shader's compile status is printed, which the
// pane never shows in full.
//
//   node tools/island_bench_shot.js --paint splat --at -2662,4626 --dist 90 --pitch 0.75 --yaw 0.6 \
//        --out bench/shot_splat.png [--port 8460] [--wait 25000] [--trees 0] [--log] [--js "<statements>"]
//
// --at is the target (x, z) in the game frame (the height is the ground's).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PORTS = opt('port', '8460');
const URL = opt('url', `http://localhost:${PORTS}/flyDiy/tools/_island.html?asset=flyDiy/bench/terrain/jolene5_e2&grid=flyDiy/bench/jolene/dem`);
const AT = opt('at', '-2662,4626').split(',').map(Number);
const DIST = +opt('dist', 90), PITCH = +opt('pitch', 0.75), YAW = +opt('yaw', 0.6);
const PAINT = opt('paint', 'splat'), TREES = +opt('trees', 0);
const OUT = opt('out', 'bench/shot_bench.png');
const WAIT = +opt('wait', 25000);
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('island_bench_shot: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_bench_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1600,1000', '--hide-scrollbars',
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
    if (m.method === 'Runtime.consoleAPICalled' && (LOG || m.params.type === 'error' || /Shader Error|Program Info Log|Context Lost/.test(String(m.params.args[0] && m.params.args[0].value))))
      console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 2000)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && r.result.exceptionDetails.text)); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  const t0 = Date.now();
  let msg = '';
  for (let i = 0; i < WAIT / 500; i++) { await sleep(500); try { msg = await ev("document.getElementById('msg').textContent"); } catch (e) { continue; } if (/^library:/.test(msg) || /failed/.test(msg)) break; }
  console.log(`bench: "${msg}" after ${Date.now() - t0} ms`);
  if (/failed/.test(msg)) throw new Error(msg);
  await ev(`(()=>{const p=document.getElementById('paint');p.value='${PAINT}';p.onchange();
    const tb=document.getElementById('trees'); if ((tb.classList.contains('on')?1:0)!==${TREES}) tb.click();
    target.set(${AT[0]}, Math.max(0,H(${AT[0]},${AT[1]})), ${AT[1]}); dist=${DIST}; pitch=${PITCH}; yaw=${YAW}; place(); build(); return 1;})()`);
  // --js "<statements>": run in the page before the frame (an A/B without an edit)
  const JS = opt('js', null);
  if (JS) await ev(`(()=>{ ${JS}; return 1; })()`);
  await sleep(1500);
  const tc = Date.now();
  await ev("(()=>{renderer.render(scene,camera); return 1;})()");
  const st = await ev(`(()=>{const gl=renderer.getContext();const p=renderer.properties.get(MAT).currentProgram;
    return JSON.stringify({lost: gl.isContextLost(), linked: p ? gl.getProgramParameter(p.program, gl.LINK_STATUS) : null, err: gl.getError()});})()`);
  console.log(`first frame ${Date.now() - tc} ms (the compile), program ${st}`);
  await sleep(1500);
  await ev("(()=>{renderer.render(scene,camera); return 1;})()");
  const shot = await cmd('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
  console.log('wrote ' + OUT);
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('island_bench_shot: ' + e.message); ch.kill(); process.exit(1); });
