// garage_shot.js - PICTURES OF A STOCK DESIGN IN THE SHED, AND ONE IN THE AIR (G445.2)
//
//   node tools/garage_shot.js --url http://localhost:8450/flyDiy/dev.html --stock "cessna 172" \
//        --out screenshots/c172 [--views q,s,f,t,x,fleet,air] [--wait 15000] [--log]
//
// island_shot.js's rig (headless Chrome on this machine's GPU, the page's own
// buttons pressed through CDP), pointed at the garage: the page booted, the
// shelf opened, the named STOCK DESIGN loaded, the editor's panels hidden,
// and one PNG per view - the editor's own quarter/side/front/top presets
// (`CAGE_UI.setView`), `x` = the top view with SEE INSIDE on (the tanks,
// the seats, the bulkhead), `fleet` = the shelf with the row on it, `air` =
// the roll-out and a chase shot 25 s later. Written because the Browser
// pane lost its WebGL context and the user asked for pictures.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8450/flyDiy/dev.html');
const STOCK = opt('stock', 'cessna 172');
const OUT = opt('out', 'screenshots/shot');
const VIEWS = opt('views', 'q,s,f,t,x,fleet,air').split(',');
const WAIT = +opt('wait', 15000);
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('garage_shot: no Chrome'); process.exit(2); }
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
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split(String.fromCharCode(10)).slice(0, 3).join(' | '));
    if (LOG && m.method === 'Runtime.consoleAPICalled') console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 1200)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && r.result.exceptionDetails.text)); return r.result.result.value; };
  const shot = async name => { const s = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const f = OUT + '_' + name + '.png'; fs.writeFileSync(f, Buffer.from(s.result.data, 'base64')); console.log('garage_shot: wrote ' + f); };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  // the boot: the editor up, the shelf reachable
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(1000); up = await ev("!!(document.getElementById('gLoad') && window.CAGE_UI && window.CAGE_ENERGY)"); }
  if (!up) throw new Error('the garage never came up');
  await sleep(3000);
  // the shelf, and the stock row
  const openFleet = "(async()=>{const u=[...document.querySelectorAll('button')].find(b=>/^(unsaved|" + STOCK.replace(/\s+/g, '') + ")$/i.test(b.textContent.trim()))||[...document.querySelectorAll('button')].find(b=>/unsaved/i.test(b.textContent));if(u)u.click();await new Promise(r=>setTimeout(r,500));document.getElementById('gLoad').click();await new Promise(r=>setTimeout(r,800));const f=document.getElementById('gFleet');return f?[...f.querySelectorAll('.gfStock button')].map(b=>b.textContent.trim()):null})()";
  const rows = await ev(openFleet);
  if (!rows) throw new Error('the shelf did not open');
  console.log('garage_shot: stock rows ' + JSON.stringify(rows));
  if (VIEWS.includes('fleet')) { await sleep(800); await shot('fleet'); }
  const loaded = await ev("(()=>{const f=document.getElementById('gFleet');const b=[...f.querySelectorAll('.gfStock button')].find(x=>x.textContent.trim().toLowerCase().startsWith('" + STOCK.toLowerCase() + "'));if(!b)return false;b.click();return true;})()");
  if (!loaded) throw new Error('no stock row ' + STOCK);
  await sleep(WAIT);
  // the fresh profile's chooser ("NEW AEROPLANE") sits over the shed: keep what was loaded
  await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()");
  await sleep(1500);
  // the panels away, the aeroplane alone
  await ev("(()=>{for(const id of ['edWrap']){const e=document.getElementById(id);if(e)e.style.visibility='hidden';}for(const b of document.querySelectorAll('button')){if(/^‹(Properties|Parts)$/.test(b.textContent.trim()))b.click();}return 1})()");
  await sleep(1500);
  const info = await ev("JSON.stringify((()=>{const s=window.GARAGE_SPEC&&(window.GARAGE_SPEC.get?window.GARAGE_SPEC.get():null);const R=window.CAGE_ENERGY.results();return {name:s&&s.meta&&s.meta.name,reg:s&&s.meta&&s.meta.reg,engX:s&&s.engines[0].x,tanks:R.map(r=>({on:r.on,ok:r.ok,why:r.why,along:r.along,fOut:r.fOut,spanM:r.spanM,ribs:(r.sides||[]).map(x=>x.ribs&&x.ribs.length),missed:(r.sides||[]).map(x=>x.ribsMissed),x:(r.sides||[]).map(x=>[x.x0,x.x1].map(v=>+v.toFixed(2)))}))}})())");
  console.log('garage_shot: loaded ' + info);
  // the game's garage orbit (app.js az/el/dist, FLIGHT_PROBE.camSet): quarter, side, front, top
  const PRESETS = { q: [0.85, 0.22, 11], s: [Math.PI / 2, 0.05, 12], f: [0, 0.08, 11], t: [0.6, 1.25, 12] };
  const cam = async (a, e, d) => { await ev("FLIGHT_PROBE.camSet(" + a + "," + e + "," + d + "), 1"); await sleep(1500); };
  for (const v of VIEWS) {
    if (v === 'fleet' || v === 'air') continue;
    if (v === 'x') {
      // THE TANKS: the wing's skin meshes hidden for the picture (the shell,
      // the fuel and the spars stay), the see-inside switch on for the cabin
      await ev("(()=>{const c=document.getElementById('xray');if(c&&!c.checked){c.click();}return 1})()");
      await ev("(()=>{const W=window.CAGE_WING;window.__hidWing=[];if(W&&W.group)W.group.traverse(o=>{if(o.isMesh&&!/edSurf|edFit|edLens/.test(o.name||'')&&o.visible){o.visible=false;window.__hidWing.push(o);}});return window.__hidWing.length})()");
      await cam(0.55, 0.95, 9); await shot('tanks_top');
      await cam(2.35, 0.10, 6); await shot('tanks_quarter');
      await cam(1.35, 0.55, 5.5); await shot('tanks_close');
      await ev("(()=>{(window.__hidWing||[]).forEach(o=>o.visible=true);const c=document.getElementById('xray');if(c&&c.checked){c.click();}return 1})()");
      await sleep(800);
      continue;
    }
    const p = PRESETS[v]; if (!p) continue;
    await cam(p[0], p[1], p[2]); await shot(v);
  }
  if (VIEWS.includes('air')) {
    await ev("(()=>{for(const id of ['edWrap']){const e=document.getElementById(id);if(e)e.style.visibility='';}return 1})()");
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) {
      await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
      await sleep(6000);
      flying = await ev("/TAXI|ROLL|CLIMB|DOWNWIND|FINAL/.test(document.body.innerText)");
    }
    if (!flying) throw new Error('the roll-out never happened');
    await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());})()");
    await sleep(+opt('airwait', 30000));
    await ev("FLIGHT_PROBE.camSet(0.9, 0.18, 14), 1"); await sleep(1500);
    await shot('air');
  }
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('garage_shot: ' + e.message); ch.kill(); process.exit(1); });
