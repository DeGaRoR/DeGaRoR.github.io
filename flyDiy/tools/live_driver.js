#!/usr/bin/env node
// live_driver.js - A HEADED GAME KEPT ALIVE, DRIVEN FROM THE SHELL (A6-SHADOW, 2026-09-27)
//
// The rigs (rollout_perf, frame_perf, shadowsky_shots) each boot, measure and quit. A look investigation wants the
// OPPOSITE: one page up for minutes while toggles are flipped in it (a material's receiveShadow, a map's layers,
// PAVEMENT.debug, a uniform) and shots taken between. This keeps a headed Chrome (the live clock) on its own SHORT
// profile (C:/a6s: a long path passes MAX_PATH and assets fail silently; its own localStorage, not the shared warm
// profile's flydiy.* prefs, which it clears anyway) and answers on 127.0.0.1:<cmdPort>:
//   POST /eval  <js expression>        -> its value (awaited)        curl -s --data-binary @- http://127.0.0.1:8562/eval
//   POST /run   <js body with return>  -> its value (awaited)
//   GET  /shot?f=<abs png path>        -> a screenshot
//   GET  /reload, /quit
// Usage: node tools/live_driver.js <repo root> <build json | stock | default> [page=dev.html] [cmdPort=8562]
//        (env GFX='{"shadows":"full","clouds":"off"}' pre-sets graphics rows; Q='depth=log' adds URL parameters)
// Then: BOOT.whenReady(), click "keep the current build", "roll out", wait BOOT.state 'gone', #bGo to taxi.
// A GPU MEASUREMENT when it runs: take tools/perf/boxlock.sh take gpu <WHO> first, drop it after.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = process.argv[2], BUILD = process.argv[3] || 'stock', PAGE = process.argv[4] || 'dev.html', CPORT = +(process.argv[5] || 8562);
// (C4a: env SPORT / DPORT / UDD override the ports and the profile, so two sessions' drivers never meet)
const SPORT = +(process.env.SPORT || 8561), DPORT = +(process.env.DPORT || 9461), UDD = process.env.UDD || 'C:/a6s';
const SIZE = [1600, 900];
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const server = spawn(process.execPath, [path.join(ROOT, 'flyDiy/tools/_serve.js'), String(SPORT), ROOT, '--fallback', 'D:/Dev/DeGaRoR.github.io'], { stdio: 'ignore' });
const ch = spawn(CHROME, ['--remote-debugging-port=' + DPORT, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140), '--window-position=0,0', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + UDD, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  // (G1818: env CHROME_FLAGS adds flags - '--enable-logging --v=0' writes the GPU process's own log to <UDD>/chrome_debug.log)
  ...(process.env.CHROME_FLAGS ? process.env.CHROME_FLAGS.split(' ').filter(Boolean) : []), 'about:blank'], { stdio: 'ignore' });
const kill = () => { for (const p of [ch, server]) try { execSync('taskkill /PID ' + p.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
process.on('exit', kill); process.on('SIGINT', () => process.exit(0)); process.on('SIGTERM', () => process.exit(0));
(async () => {
  let tgt = null;
  for (let i = 0; i < 50 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.log('EXC ' + JSON.stringify(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 300));
    // (G1818: env LOGCON=1 - the page's warnings and errors and the browser's own log - WebGL's GL errors, a lost context - printed)
    if (process.env.LOGCON && m.method === 'Log.entryAdded' && /warning|error/.test(m.params.entry.level)) console.log('LOG ' + m.params.entry.level + ' ' + String(m.params.entry.text).slice(0, 400));
    if (process.env.LOGCON && m.method === 'Runtime.consoleAPICalled' && /warning|error/.test(m.params.type)) console.log('CON ' + m.params.type + ' ' + m.params.args.map(a => a.value != null ? a.value : a.description).join(' ').slice(0, 400)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
    if (!d || d.exceptionDetails) return 'ERR ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)); return d.result.value; };
  // (C2c, G842: env KEEP_PREM=1 keeps the editor's saved premises across /reload - the save -> reload proof; clear it by hand)
  const pre = ['try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|gfx$' + (process.env.KEEP_PREM ? '' : '|premises\\.game') + ')/.test(k)) localStorage.removeItem(k);}catch(e){}'];
  if (BUILD === 'stock') pre.push(require(path.join(ROOT, 'flyDiy/tools/_stock_pin.js')).pinScript());
  else if (BUILD === 'default') pre.push('try{localStorage.removeItem("flydiy.wip")}catch(e){}');
  else pre.push('try{localStorage.setItem("flydiy.wip",' + JSON.stringify(fs.readFileSync(path.resolve(ROOT, 'flyDiy', BUILD), 'utf8')) + ')}catch(e){}');
  if (process.env.GFX) pre.push('try{localStorage.setItem("flydiy.gfx",JSON.stringify(' + process.env.GFX + '))}catch(e){}');
  await cmd('Page.enable'); await cmd('Runtime.enable');
  if (process.env.LOGCON) await cmd('Log.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: pre.join('\n') });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  const url = 'http://localhost:' + SPORT + '/flyDiy/' + PAGE + (process.env.Q ? '?' + process.env.Q : '');
  await cmd('Page.navigate', { url });
  console.log('nav ' + url);
  http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    try {
      if (u.pathname === '/eval') { let b = ''; for await (const c of req) b += c; const v = await ev('(async()=>{ return (' + b + '\n); })()'); res.end(typeof v === 'string' ? v : JSON.stringify(v)); }
      else if (u.pathname === '/run') { let b = ''; for await (const c of req) b += c; const v = await ev('(async()=>{ ' + b + '\n })()'); res.end(typeof v === 'string' ? v : JSON.stringify(v)); }
      else if (u.pathname === '/shot') { const r = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(u.searchParams.get('f'), Buffer.from(r.result.data, 'base64')); res.end('ok'); }
      // (C4b) a CPU profile round a stretch of the page's life: /prof?op=start, then /prof?op=stop&f=<abs .cpuprofile path>
      else if (u.pathname === '/prof') { if (u.searchParams.get('op') === 'start') { await cmd('Profiler.enable'); await cmd('Profiler.setSamplingInterval', { interval: 250 }); await cmd('Profiler.start'); res.end('ok'); }
        else { const r = await cmd('Profiler.stop'); fs.writeFileSync(u.searchParams.get('f'), JSON.stringify(r.result.profile)); res.end('ok'); } }
      else if (u.pathname === '/reload') { await cmd('Page.navigate', { url }); res.end('ok'); }
      else if (u.pathname === '/quit') { res.end('bye'); setTimeout(() => process.exit(0), 100); }
      else res.end('?');
    } catch (e) { res.end('ERR ' + e.message); }
  }).listen(CPORT, '127.0.0.1');
  console.log('cmd on ' + CPORT);
})().catch(e => { console.log('FATAL ' + e.stack); process.exit(1); });
