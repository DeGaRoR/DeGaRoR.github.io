#!/usr/bin/env node
// ui_style_shot.js - THE TANK AND INSTRUMENTS PANELS, DESKTOP AND PHONE (G3738, UI-STYLE, 2026-10-25)
//
//   node tools/ui_style_shot.js --out screenshots/ui-style/before [--build builds/x.json] [--only desktop|phone]
//
// The frames_shot rig (headless Chrome over CDP, this machine's GPU) with its own static server on
// this tree. Two passes: the desktop at 1600x900 and the phone profile at 375x812 @2 (mobile
// emulation, touch, ?profile=phone, the Edit tab up). Each pass selects the part in the tree
// (EDITOR_SELECT), and shoots the inspector at three FIXED scrolls - the top, half way, the end - so
// a before and an after at the same build land on the same frames:
//   <out>_<desktop|phone>_<energy|energyFinish|instruments>_<top|mid|end>.png
// The tank panel's finish view (the tint wells) is the Finish tab; the instruments' bill fold is
// opened first, so its line items are in the picture. Prints each panel's off-system inline styles
// (style="" on anything under the panel, minus a CG mark's `left`) as a count per shot.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = opt('out', 'screenshots/ui-style/shot');
const BUILD = opt('build', null);
const ONLY = opt('only', null);
const REPO = path.resolve(__dirname, '..', '..');
// a worktree is served over the main checkout's gitignored data (assets/, bench/), never through a junction
const WT = /[\\/]\.claude[\\/]worktrees[\\/].*$/;
const MAIN = opt('main', WT.test(REPO) ? REPO.replace(WT, '') : REPO);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('ui_style_shot: no Chrome'); process.exit(2); }
const UA = 'Mozilla/5.0 (Linux; Android 13; SM-G780G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

async function pass(mode, port) {
  const phone = mode === 'phone';
  const W = phone ? 375 : 1600, H = phone ? 812 : 900;
  const dbg = await freePort();
  const udd = path.join(require('os').tmpdir(), 'cdp_uistyle_' + dbg + '_' + Date.now());
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + dbg, '--window-size=' + W + ',' + H, '--hide-scrollbars',
    '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', 'about:blank'], { stdio: 'ignore' });
  try {
    let tgt = null;
    for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + dbg + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split('\n')[0]); };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + expr.slice(0, 80)); return r.result.result.value; };
    const shot = async name => { const s = await cmd('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
      const f = OUT + '_' + mode + '_' + name + '.png'; fs.writeFileSync(f, Buffer.from(s.result.data, 'base64')); console.log('ui_style_shot: wrote ' + f); };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
    if (phone) { await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await cmd('Emulation.setUserAgentOverride', { userAgent: UA }); }
    const base = 'http://127.0.0.1:' + port + '/flyDiy/';
    await cmd('Page.navigate', { url: base + 'version.json' });
    for (let i = 0; i < 40; i++) { await sleep(300); if (await ev('/version/.test(location.pathname)').catch(() => false)) break; }
    await ev('(()=>{try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(welcome|phTab)/.test(k)) localStorage.removeItem(k);' +
      (BUILD ? 'localStorage.setItem("flydiy.wip",' + JSON.stringify(fs.readFileSync(BUILD, 'utf8')) + ');' : '') + '}catch(e){};return 1})()');
    await cmd('Page.navigate', { url: base + 'dev.html?world=none' + (phone ? '&profile=phone' : '') });
    let up = false;
    for (let i = 0; i < 120 && !up; i++) { await sleep(1000); up = await ev("!!(window.CAGE_UI && window.CAGE_ENERGY && window.CAGE_PANEL && window.EDITOR_SELECT)").catch(() => false); }
    if (!up) throw new Error('the garage never came up');
    for (let i = 0; i < 180; i++) {
      await sleep(1000);
      const bootUp = await ev('(()=>{const b=document.getElementById("boot");return !!(b&&!b.hidden&&getComputedStyle(b).display!=="none");})()').catch(() => true);
      if (!bootUp && i > 2) break;
    }
    await sleep(3000);
    const KEEP = "(()=>{const n=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0);n.forEach(x=>x.click());return n.length;})()";
    for (let i = 0; i < 4; i++) { await ev(KEEP); await sleep(400); }
    // the scroller the inspector lives in: #edRows on the desktop, #edProps on the phone
    const SC = "(()=>{let e=document.getElementById('edRows');while(e&&!(e.scrollHeight>e.clientHeight+2&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)))e=e.parentElement;return e;})()";
    const inline = "(()=>{const r=document.getElementById('edRows');if(!r)return -1;return [...r.querySelectorAll('[data-panel=energy] [style], .edRoot [style]')].filter(e=>!(e.parentElement&&e.parentElement.classList.contains('cgBar')&&/^left:/.test(e.getAttribute('style').trim()))&&!/^display:\\s*(none|block);?$/.test(e.getAttribute('style').trim())).map(e=>e.tagName+':'+e.getAttribute('style')).length;})()";
    const three = async name => {
      for (const [k, f] of [['top', 0], ['mid', 0.5], ['end', 1]]) {
        await ev('(()=>{const s=' + SC + ';if(s)s.scrollTop=Math.round((s.scrollHeight-s.clientHeight)*' + f + ');return 1})()');
        await sleep(500);
        await shot(name + '_' + k);
      }
      console.log('ui_style_shot: ' + mode + ' ' + name + ' inline styles under the panel: ' + await ev(inline));
    };
    const props = async () => { if (phone) { await ev("(()=>{const b=document.querySelector('#phTabs button[data-t=props]');if(b)b.click();return 1})()"); await sleep(600); } };
    const tab = async tid => { await ev("(()=>{const b=document.getElementById('" + tid + "');if(b)b.click();return !!b})()"); await sleep(900); };
    // THE TANKS: structure, then finish
    await ev("(()=>{window.EDITOR_SELECT('energy');return 1})()"); await sleep(1500); await props();
    await tab('edTabShape');
    await three('energy');
    await tab('edTabFinish');
    await three('energyFinish');
    await tab('edTabShape');
    // THE INSTRUMENTS, every fold open (the bill starts shut)
    await ev("(()=>{window.EDITOR_SELECT('instruments');return 1})()"); await sleep(1500); await props();
    await ev("(()=>{for(const d of document.querySelectorAll('#edRows .edRoot details'))d.open=true;return 1})()"); await sleep(500);
    await three('instruments');
    ws.close();
  } finally {
    try { ch.kill(); } catch (e) {}
    await sleep(500);
    try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  }
}

(async () => {
  const port = await freePort();
  const server = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(port), REPO].concat(MAIN !== REPO ? ['--fallback', MAIN] : []), { stdio: 'ignore' });
  try {
    for (let i = 0; ; i++) {
      const ok = await new Promise(res => { const rq = http.get('http://127.0.0.1:' + port + '/flyDiy/version.json', r => { r.resume(); res(true); }); rq.on('error', () => res(false)); });
      if (ok) break; if (i > 60) throw new Error('no static server'); await sleep(250);
    }
    for (const m of ['desktop', 'phone']) if (!ONLY || ONLY === m) await pass(m, port);
  } finally { try { server.kill(); } catch (e) {} }
  process.exit(0);
})().catch(e => { console.error('ui_style_shot: ' + (e && e.message || e)); process.exit(1); });
