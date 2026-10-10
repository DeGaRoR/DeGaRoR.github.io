// cowl_fit_shots.js — BEFORE / AFTER THE COWL FIT, in the garage (G2860)
//
//   node tools/cowl_fit_shots.js --url http://127.0.0.1:8693/flyDiy/dev.html \
//        --out screenshots/cowlfit --cards stearman,beaver,rv,... [--wait 12000]
//
// garage_shot.js's rig (headless Chrome on this machine's GPU, CDP). Per card,
// twice, through the birth flow's own two calls (design_flow.js birthApply:
// CAGE_COWL_FIT_NEXT, then GARAGE_SPEC.set):
//   before   the card baked with the COWL FIT switched off (window.COWL_FIT
//            set aside for the bake) — the old birth, the styled door and all
//   after    the card as the constructor bakes it now
// and two pictures each: `side` and `q34` (three-quarter front, closer).
//
// THE OVERLAY RULE (the user, 7 Oct): a frame is shot only once BOOT.state is
// 'gone' + 2 s and no loading overlay is on screen; a frame that sees one is
// thrown away and the run says so. A branch-only symbol (window.COWL_FIT) is
// read off the page before the first frame: no stale server's tree.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://127.0.0.1:8693/flyDiy/dev.html');
const OUT = opt('out', 'screenshots/cowlfit');
const CARDS = opt('cards', 'stearman,beaver,rv,pittsAlike,tigermoth,ul1,savannah,da62').split(',');
const WAIT = +opt('wait', 12000);
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('cowl_fit_shots: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_cowlfit_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1600,1000', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const written = [];
(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split('\n').slice(0, 3).join(' | ')); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && r.result.exceptionDetails.text)); return r.result.result.value; };
  // no overlay: BOOT gone, and nothing with a loading look covering the canvas
  const clear = () => ev("(()=>{if(window.BOOT&&BOOT.state&&BOOT.state!=='gone')return false;const b=document.getElementById('boot');if(b&&b.offsetParent&&getComputedStyle(b).visibility!=='hidden'&&+getComputedStyle(b).opacity>0.05)return false;return true})()");
  const shot = async name => {
    if (!(await clear())) { console.error('cowl_fit_shots: OVERLAY on screen, frame discarded: ' + name); return; }
    const s = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(path.resolve(OUT + '_x')), { recursive: true });
    const f = OUT + '_' + name + '.png'; fs.writeFileSync(f, Buffer.from(s.result.data, 'base64'));
    written.push(path.resolve(f)); console.log('cowl_fit_shots: wrote ' + f);
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  let up = false;
  for (let i = 0; i < 90 && !up; i++) { await sleep(1000); up = await ev("!!(window.CAGE_UI && window.CAGE_DESIGN && window.GARAGE_SPEC && window.FLIGHT_PROBE)").catch(() => false); }
  if (!up) throw new Error('the garage never came up');
  for (let i = 0; i < 60; i++) { if (await clear()) break; await sleep(1000); }
  // THE EDITOR IS LAZY (CAGE_UI_LAZY): COWL_FIT loads with it — open it once
  await ev("(async()=>{if(window.openEditor)try{openEditor()}catch(e){}return 1})()");
  for (let i = 0; i < 30; i++) { if (await ev("!!window.COWL_FIT")) break; await sleep(1000); }
  if (!(await ev("!!window.COWL_FIT"))) throw new Error('this page has no COWL_FIT: a stale tree or the editor never loaded');
  await sleep(2000);
  const VIEWS = { side: [Math.PI / 2, 0.06, 9], q34: [0.62, 0.16, 6.5] };
  for (const key of CARDS) {
    for (const state of ['before', 'after']) {
      const got = await ev("(()=>{const D=window.CAGE_DESIGN,a=D.ARCHETYPES.find(x=>x.key==='" + key + "');if(!a)return null;" +
        "const F=window.COWL_FIT;" + (state === 'before' ? "window.COWL_FIT=null;" : "") +
        "let s;try{s=D.designBake(a.sel,a.over);}finally{window.COWL_FIT=F;}" +
        "if(window.CAGE_COWL_FIT_NEXT)window.CAGE_COWL_FIT_NEXT();window.GARAGE_SPEC.set(s);" +
        "return {name:a.name,fit:s.cage&&s.cage.fitNose,cowl:s.cowl&&{halfW:s.cowl.halfW,top:s.cowl.top,bot:s.cowl.bot}}})()");
      if (!got) { console.error('cowl_fit_shots: no card ' + key); break; }
      console.log('cowl_fit_shots: ' + key + ' ' + state + ' ' + JSON.stringify(got));
      await sleep(WAIT);
      await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()");
      await ev("(()=>{const e=document.getElementById('edWrap');if(e)e.style.visibility='hidden';for(const b of document.querySelectorAll('button')){if(/^‹(Properties|Parts)$/.test(b.textContent.trim()))b.click();}return 1})()");
      for (let i = 0; i < 30; i++) { if (await clear()) break; await sleep(1000); }
      await sleep(2000);                                   // the rule: overlay gone + 2 s
      const stat = await ev("JSON.stringify(window.CAGE_COWL?{len:+window.CAGE_COWL.len.toFixed(3),mode:window.CAGE_COWL.mode}:null)");
      console.log('cowl_fit_shots: ' + key + ' ' + state + ' cowl ' + stat);
      for (const v in VIEWS) {
        const p = VIEWS[v];
        await ev("FLIGHT_PROBE.camSet(" + p.join(',') + "), 1"); await sleep(1800);
        await shot(key + '_' + state + '_' + v);
      }
      await ev("(()=>{const e=document.getElementById('edWrap');if(e)e.style.visibility='';return 1})()");
    }
  }
  fs.writeFileSync(OUT + '_index.txt', written.join('\n') + '\n');
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  console.log('cowl_fit_shots: ' + written.length + ' stills, index ' + OUT + '_index.txt');
})().catch(e => { console.error('cowl_fit_shots: ' + e.message); ch.kill(); process.exit(1); });
