#!/usr/bin/env node
// diag_run.js - THE SELF-TEST (src/viewer/diag.js, ?diag) RUN ON THIS BOX (G1997, HW-COVERAGE): the same page a tester opens,
// driven to its report - the reference numbers the tester's report is read against (the calibration's REF row, the variants
// on the box's own GPU at the tester's preset and screen).
// One headed Chrome (the live clock), its own short profile (fresh unless --warm), the page at --size, ?diag[=quick|bench] plus
// --q, the report saved as <out>.json and <out>.txt; Chrome closed through CDP.
// Usage: node tools/perf/diag_run.js --out tools/perf/diag_retro_1080 [--mode full|quick|bench] [--q 'gfx=retro']
//          [--size 1920x1080] [--sport 8573] [--dport 9473] [--udd C:/hwd] [--warm] [--cpu-throttle N]
// A GPU MEASUREMENT: boxlock.sh take gpu <WHO> first, drop it after. Rigs have no --help.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(opt('out', 'diag_run')).replace(/\.json$/, '');
const MODE = opt('mode', 'full'), Q = opt('q', ''), SIZE = opt('size', '1920x1080').split('x').map(Number);
const SPORT = +opt('sport', 8573), DPORT = +opt('dport', 9473), UDD = opt('udd', 'C:/hwd'), THROTTLE = +opt('cpu-throttle', 0) || 0;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
if (!flag('warm')) try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {}
const server = spawn(process.execPath, [path.join(ROOT, 'flyDiy/tools/_serve.js'), String(SPORT), ROOT, '--fallback', 'D:/Dev/DeGaRoR.github.io'], { stdio: 'ignore' });
const ch = spawn(CHROME, ['--remote-debugging-port=' + DPORT, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140), '--window-position=0,0', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + UDD, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
const kill = () => { for (const p of [ch, server]) try { execSync('taskkill /PID ' + p.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
process.on('exit', kill); process.on('SIGINT', () => process.exit(0)); process.on('SIGTERM', () => process.exit(0));
(async () => {
  let tgt = null;
  for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const errs = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 300)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const run = async body => { const r = await cmd('Runtime.evaluate', { expression: '(async()=>{ ' + body + '\n })()', awaitPromise: true, returnByValue: true }); const d = r.result;
    if (!d || d.exceptionDetails) return 'ERR ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)); return d.result.value; };
  // the first launch's stock prefs as a player's: no saved graphics, route, world; the default aeroplane
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|gfx$|premises\\.game|wip$|diag)/.test(k)) localStorage.removeItem(k);}catch(e){}' });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  if (THROTTLE > 1) await cmd('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  const url = 'http://localhost:' + SPORT + '/flyDiy/index.html?diag' + (MODE === 'full' ? '' : '=' + MODE) + (Q ? '&' + Q : '');
  const T0 = Date.now();
  await cmd('Page.navigate', { url });
  console.log('diag_run ' + url);
  let last = '';
  for (let i = 0; i < 2400; i++) {   // 40 min at most
    await sleep(1000);
    // the first launch's chooser over the shed: keep the build it offers
    if (i % 5 === 0) await run(`for (const b of document.querySelectorAll('button, [role=button], div, span')) { if (/^\\s*keep the current build\\s*$/i.test(b.textContent || '') && b.offsetParent) { b.click(); break; } } return 1;`);
    const st = await run('return window.FLYDIY_DIAG ? FLYDIY_DIAG.state + (FLYDIY_DIAG.report ? "|REPORT" : "") : "(no diag yet)";');
    if (st !== last) { console.log('  ' + ((Date.now() - T0) / 1000).toFixed(0) + ' s  ' + String(st).slice(0, 160)); last = st; }
    if (/\|REPORT$|stopped/.test(String(st))) break;
  }
  const rep = await run('return window.FLYDIY_DIAG && FLYDIY_DIAG.report ? JSON.stringify(FLYDIY_DIAG.report) : null;');
  const txt = await run('return window.FLYDIY_DIAG && FLYDIY_DIAG.text ? FLYDIY_DIAG.text() : "";');
  if (rep && rep[0] === '{') { fs.writeFileSync(OUT + '.json', rep); fs.writeFileSync(OUT + '.txt', txt || ''); console.log((txt || '').split('\n').map(l => '  ' + l).join('\n')); console.log('-> ' + OUT + '.json'); }
  else console.log('no report: ' + rep);
  if (errs.length) console.log('page exceptions: ' + errs.slice(0, 4).join(' | '));
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(1500);
  process.exit(0);
})().catch(e => { console.error('diag_run: ' + (e && e.stack || e)); process.exit(1); });
