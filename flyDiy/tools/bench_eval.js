#!/usr/bin/env node
// bench_eval.js - RUN ONE EXPRESSION IN A BENCH PAGE, HEADLESS (2026-09-20)
//
//   node tools/bench_eval.js --url http://localhost:8463/flyDiy/tools/_trees.html --file probe.js
//   node tools/bench_eval.js --url ... --js "SPECIES.length"
//        [--ready "typeof SPECIES !== 'undefined' && SPECIES.length > 0"] [--shot out.png]
//
// Headless Chrome on the GPU (the pane lags and crashes under a stand), the page
// booted, `--ready` polled true, the expression evaluated (a promise is awaited)
// and its value printed; --shot saves a screenshot afterwards. The probe is
// data the page runs - write it as an IIFE returning a JSON string.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8463/flyDiy/tools/_trees.html');
const JS = opt('file', null) ? fs.readFileSync(opt('file'), 'utf8') : opt('js', '1');
const READY = opt('ready', "typeof SPECIES !== 'undefined' && SPECIES.length > 0");
const SHOT = opt('shot', null);
const PORT = 9600 + (process.pid % 90);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('bench_eval: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_eval_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split(String.fromCharCode(10)).slice(0, 2).join(' | ')); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text))); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  if (opt('pre', null)) await cmd('Page.addScriptToEvaluateOnNewDocument', { source: opt('pre') });   // --pre: run before the page's scripts
  await cmd('Page.navigate', { url: URL });
  for (let i = 0; i < 90; i++) { await sleep(1000); try { if (await ev(READY)) break; } catch (e) {} }
  const v = await ev(JS);
  console.log(typeof v === 'string' ? v : JSON.stringify(v));
  if (SHOT) { await sleep(500); const r = await cmd('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(path.dirname(SHOT), { recursive: true }); fs.writeFileSync(SHOT, Buffer.from(r.result.data, 'base64')); console.error('  wrote ' + SHOT); }
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('bench_eval: ' + e.message); ch.kill(); process.exit(1); });
