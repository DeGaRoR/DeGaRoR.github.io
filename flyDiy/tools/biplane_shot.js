#!/usr/bin/env node
// biplane_shot.js - THE BIPLANE IN THE SHED AND ON THE FIELD, HEADLESS (the biplane audit, 2026-09-21)
//
//   node tools/biplane_shot.js --url "http://localhost:8471/flyDiy/dev.html?world=none" //        [--build builds/x.json] [--set w2On=1,wgPos=3,w2Pos=2] [--select wingPanel2] [--panel] //        [--views q,s,f,t,c,b,n,w] [--js "<expr>"] [--air [--airwait 40000] [--airjs "<expr>"]] //        [--out screenshots/biplane/shot] [--wait 4000] [--log]
//
// frames_shot.js's rig (headless Chrome over CDP on this machine's GPU - the
// Browser pane has no WebGL) with the frames' selection replaced by a part
// selection (--select), a CENSUS of the scene's layers printed after the
// rows are set (every cageLayer:* / edFit_* / edSurf_* group with its mesh
// and face count, and the status line - the brace layer's 'N plates on
// skin', 'k/8 on wing', the cabane's snap), three closer presets (b = from
// below, n = near quarter, w = over the wing) and --air: the roll-out
// button pressed, --airwait ms of taxi, --airjs evaluated (the flown def's
// planes, yRoot, the lift split), three shots in the air. The audit's
// sweep: every wgPos x w2Pos pair with --js reading CAGE_WING.planes and
// the joined spec's wings.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8471/flyDiy/dev.html?world=none');
const BUILD = opt('build', null);
const OUT = opt('out', 'screenshots/biplane/shot');
const WAIT = +opt('wait', 4000);
const SETS = (opt('set', '') || '').split(',').filter(Boolean).map(s => s.split('='));
const HOVER = opt('hover', null);
const VIEWS = (opt('views', 'q') || '').split(',').filter(Boolean);
const PANEL = argv.includes('--panel');
const INFO = argv.includes('--info');
const EXPERT = argv.includes('--expert');
const JS = opt('js', null);            // an expression evaluated after the selection, its value printed
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('biplane_shot: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_frames_' + PORT + '_' + Date.now());
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
    if (!r.result || r.result.exceptionDetails) { const d = r.result && r.result.exceptionDetails; throw new Error('page: ' + (d ? (d.exception && d.exception.description || d.text) : JSON.stringify(r.error)).split(String.fromCharCode(10))[0] + ' in ' + expr.slice(0, 80)); } return r.result.result.value; };
  const shot = async name => { const s = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const f = OUT + '_' + name + '.png'; fs.writeFileSync(f, Buffer.from(s.result.data, 'base64')); console.log('biplane_shot: wrote ' + f); };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  if (BUILD) {
    const txt = fs.readFileSync(BUILD, 'utf8');
    await cmd('Page.navigate', { url: URL.replace(/\/flyDiy\/.*$/, '/flyDiy/version.json') });
    for (let i = 0; i < 40; i++) { await sleep(500); if (await ev('/version/.test(location.pathname)').catch(() => false)) break; }
    await ev('(()=>{localStorage.setItem("flydiy.wip", ' + JSON.stringify(txt) + '); return 1;})()');
  }
  if (EXPERT) await ev('(()=>{try{localStorage.setItem("cageExpert","1")}catch(e){};return 1})()').catch(() => 0);
  await cmd('Page.navigate', { url: URL });
  let up = false;
  for (let i = 0; i < 90 && !up; i++) { await sleep(1000); up = await ev("!!(document.getElementById('gLoad') && window.CAGE_UI && window.CAGE_ENERGY && window.EDITOR_SELECT)").catch(() => false); }
  if (!up) throw new Error('the garage never came up');
  // ...and the boot overlay down (the shaders compiled, the skin decoded)
  for (let i = 0; i < 180; i++) {
    await sleep(1000);
    const bootUp = await ev('(()=>{const b=document.getElementById("boot");return !!(b&&!b.hidden&&getComputedStyle(b).display!=="none");})()').catch(() => true);
    if (!bootUp && i > 2) break;
  }
  await sleep(3000);
  const KEEP = "(()=>{const n=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0);n.forEach(x=>x.click());return n.length;})()";
  for (let i = 0; i < 4; i++) { await ev(KEEP); await sleep(500); }
  // the rows under test
  if (SETS.length) {
    const js = SETS.map(([k, v]) => 'P[' + JSON.stringify(k) + ']=' + (v === 'null' ? 'null' : JSON.stringify(+v)) + ';').join('');
    await ev('(()=>{const P=window.CAGE_UI.P;' + js + 'window.CAGE_UI.build();return 1})()');
    await sleep(WAIT);
  }
  // the Fuselage selected: the FRAMES groups are its first
  const SEL = opt('select', null);
  if (SEL) { await ev("(()=>{window.EDITOR_SELECT(" + JSON.stringify(SEL) + ");return 1})()"); await sleep(1200); }
  const CENSUS = "(()=>{const sc=(window.FLIGHT_PROBE&&FLIGHT_PROBE.hangarScene&&FLIGHT_PROBE.hangarScene())||null;const out={stat:(document.getElementById('edStat')||{}).textContent,stat2:(document.getElementById('stat')||{}).textContent};if(!sc)return JSON.stringify(out);const L=[];sc.traverse(o=>{if(/^cageLayer|^edFit_|^edSurf_/.test(o.name||'')){let m=0,f=0;o.traverse(c=>{if(c.isMesh){m++;f+=c.geometry.index?c.geometry.index.count/3:(c.geometry.attributes.position?c.geometry.attributes.position.count/3:0);}});L.push(o.name+' meshes '+m+' faces '+Math.round(f));}});out.layers=L;return JSON.stringify(out);})()";
  console.log('biplane_shot: census ' + await ev(CENSUS));
  if (JS) console.log('biplane_shot: js -> ' + await ev(JS));
  if (INFO) {
    const info = await ev("JSON.stringify(window.CAGE_UI.frames)");
    console.log('biplane_shot: frames ' + info);
  }
  if (!PANEL) await ev("(()=>{for(const id of ['edWrap']){const e=document.getElementById(id);if(e)e.style.visibility='hidden';}return 1})()");
  else await ev("(()=>{for(const b of document.querySelectorAll('button')){if(/^‹Parts$/.test(b.textContent.trim()))b.click();}return 1})()").catch(() => 0);
  await sleep(800);
  const PRESETS = { q: [0.85, 0.22, 11], s: [Math.PI / 2, 0.05, 12], f: [0, 0.08, 11], t: [0.6, 1.25, 12], c: [1.1, 0.18, 7.5], b: [0.85, -0.35, 11], n: [0.35, 0.25, 6], w: [1.2, 0.35, 7] };
  const cam = async (a, e, d) => { await ev("FLIGHT_PROBE.camSet(" + a + "," + e + "," + d + "), 1"); await sleep(1200); };
  if (HOVER) {
    // the row-hover path itself, on the row's element (the editor's delegated
    // listener maps the key to its frame), with the handle as the fallback
    const ok = await ev("(()=>{const r=document.querySelector('#edRows .r[data-k=" + JSON.stringify(HOVER) + "]');if(r){r.dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));r.scrollIntoView({block:'center'});return 'row';}const C2=window.CAGE2,FK=C2&&C2.CAGE_FRAME_KEYS;let fk=null;for(const f in FK)for(const q in FK[f])if(FK[f][q]===" + JSON.stringify(HOVER) + ")fk=f;if(!fk&&/^frPax/.test(" + JSON.stringify(HOVER) + "))fk='pax';window.EDITOR_FRAME_HILITE(fk);return 'handle:'+fk})()");
    console.log('biplane_shot: hover ' + HOVER + ' via ' + ok);
    await sleep(600);
  }
  for (const v of VIEWS) { const p = PRESETS[v]; if (!p) continue; await cam(p[0], p[1], p[2]); await shot(v); }
  if (argv.includes('--air')) {
    await ev("(()=>{for(const id of ['edWrap']){const e=document.getElementById(id);if(e)e.style.visibility='';}return 1})()");
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) {
      await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
      await sleep(6000);
      flying = await ev("/TAXI|ROLL|CLIMB|DOWNWIND|FINAL/.test(document.body.innerText)");
    }
    if (!flying) throw new Error('the roll-out never happened');
    await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());})()");
    const AIRWAIT = +opt('airwait', 30000);
    await sleep(AIRWAIT);
    const AJS = opt('airjs', null);
    if (AJS) console.log('biplane_shot: airjs -> ' + await ev(AJS));
    for (const [nm, a, e, d] of [['air', 0.9, 0.18, 14], ['airf', 0.05, 0.1, 12], ['airs', Math.PI / 2, 0.05, 12]]) {
      await ev("FLIGHT_PROBE.camSet(" + a + "," + e + "," + d + "), 1"); await sleep(1500); await shot(nm);
    }
  }
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('biplane_shot: ' + (e && e.message || e)); try { ch.kill(); } catch (x) {} process.exit(1); });
