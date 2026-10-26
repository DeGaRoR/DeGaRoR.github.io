#!/usr/bin/env node
// cowl_res_stills.js - THE NOSE FROM THE PILOT'S EYE, BEFORE AND AFTER (G3712, COWL-RES)
//
//   node tools/cowl_res_stills.js --out <dir> [--builds a.json,b.json] [--modes before,after] [--wait 9000] [--log]
//
// garage_shot.js's rig (headless Chrome on this machine's GPU, CDP), on THIS tree served by tools/_serve.js (the
// main checkout as the fallback for the gitignored data), dev.html (the loose sources: no build needed). Per build
// and per mode the build is loaded through the shelf's own door (GARAGE_SPEC.set), the editor's INTERIOR pill is
// pressed (the pilot's own eye point, G107) and two PNGs are taken: `ahead` (the eye as it enters) and `left` (the
// same drag of the head every time: left and a little down, along the cowl's top arch). BEFORE and AFTER are the same
// page, the same camera and the same build: `before` builds with the eye pass held off (CAGE_UI.eyeRefine = false:
// the deck and the cowl drawn exactly as master draws them), `after` with it on. A JSON beside the PNGs says what the
// page drew (the fuselage's vertex count, whether the deck was split, the cowl's sample count).
// A GPU TOOL: hold the box's gpu lock in an A0 slot.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', 'cowl_res_stills'));
const BUILDS = opt('builds', 'builds/cessna172_2026-09-20_corrected.json,builds/cessna172_2026-09-20.json,builds/cub_2026-09-20_corrected.json').split(',');
const MODES = opt('modes', 'before,after').split(',');
const WAIT = +opt('wait', 9000);
const LOG = argv.includes('--log');
const NOHIDE = argv.includes('--nohide');
const LOOKS = [['left', 0.75, -0.45], ['right', -0.75, -0.45], ['down', 0, -0.6]];   // rad: yaw (+ = left), pitch             // the page as it is (a rig check)
const ROOT = path.join(__dirname, '..', '..');            // the repo root: the page is /flyDiy/dev.html
const MAIN = 'D:/Dev/DeGaRoR.github.io';
const PORT = 8700 + (process.pid % 200), DBG = 9700 + (process.pid % 200);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('cowl_res_stills: no Chrome'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(PORT), ROOT, '--fallback', MAIN], { stdio: 'ignore' });
const udd = path.join(os.tmpdir(), 'cowlres_' + DBG + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DBG, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
console.log('cowl_res_stills: serve PID ' + srv.pid + ' port ' + PORT + ', chrome PID ' + ch.pid);
const done = code => { try { ch.kill(); } catch (e) {} try { srv.kill(); } catch (e) {}
  setTimeout(() => { try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} process.exit(code); }, 1500); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DBG + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const errs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') { const t = (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split('\n').slice(0, 3).join(' | '); errs.push(t); console.error('page exception: ' + t); }
    if (LOG && m.method === 'Runtime.consoleAPICalled') console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 600)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text))); return r.result.result.value; };
  const shot = async name => { const s = await cmd('Page.captureScreenshot', { format: 'png' });
    const f = path.join(OUT, name + '.png'); fs.writeFileSync(f, Buffer.from(s.result.data, 'base64')); console.log('cowl_res_stills: wrote ' + f); };
  const mouse = (type, x, y) => cmd('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  // ?world=none: the island's first layout is not what this looks at (panel_shot's way)
  await cmd('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/flyDiy/dev.html?world=none' });
  // THE GARAGE BOOT FIRST (panel_shot): the #boot overlay ("before you fly", the loader) stands over the shed until the
  // editor's own build is done - a still taken under it is the loading screen, not the aeroplane
  const BOOTUP = '(()=>{const b=document.getElementById("boot");return !!(b&&!b.hidden&&getComputedStyle(b).display!=="none");})()';
  const READY = "!!(window.CAGE_UI && window.GARAGE_SPEC && window.GARAGE_SPEC.set && document.querySelector('#edRail [data-f=\"camera\"]'))";
  const settle = async (n, what) => { for (let i = 0; i < n; i++) { await sleep(1000);
    const up = await ev(BOOTUP).catch(() => true), ok = await ev(READY).catch(() => false);
    if (!up && ok && i > 3) return true; } throw new Error(what + ': the boot overlay never went (' + n + ' s)'); };
  await settle(180, 'the garage');
  await sleep(3000);
  await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()");
  if (NOHIDE) { await shot('boot'); console.log('cowl_res_stills: canvases ' + await ev("JSON.stringify([...document.querySelectorAll('canvas')].map(c=>[c.id,c.className,c.clientWidth,c.clientHeight,getComputedStyle(c).display,getComputedStyle(c).visibility]))")); }
  // the pills live in the rail's camera flyout (editor.js buildCamera): the rail's camera opens it, the pill is pressed
  // once it has filled, and the rail's camera closes it again (panel_shot's way)
  const RAILCAM = "(()=>{const r=document.querySelector('#edRail [data-f=\"camera\"]');if(r)r.click();return !!r})()";
  const pill = async k => {
    await ev(RAILCAM); await sleep(500);
    let got = 0;
    for (let i = 0; i < 20 && !got; i++) {
      got = await ev("(()=>{const p=[...document.querySelectorAll('#edFlyBody .pill')].find(b=>b.textContent.trim()==='" + k + "');if(!p)return 0;if(p.disabled)return -1;p.click();return 1})()");
      if (!got) await sleep(300);
    }
    await sleep(300); await ev(RAILCAM);
    return got === 1;
  };
  const info = [];
  for (const b of BUILDS) {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', b), 'utf8'));
    const spec = raw.spec || raw, tag = path.basename(b, '.json');
    for (const mode of MODES) {
      await pill('3/4 front');
      await ev("(()=>{window.CAGE_UI.eyeRefine = " + (mode === 'after') + "; window.GARAGE_SPEC.set(" + JSON.stringify(spec) + "); return 1})()");
      await sleep(WAIT);
      await settle(120, tag + ' ' + mode);
      await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()");
      // the aeroplane alone: everything that is not the canvas's own line hidden (garage_shot --clean)
      const HIDE = "(()=>{document.querySelectorAll('body *').forEach(el=>{el.style.visibility='';});const c=[...document.querySelectorAll('canvas')].sort((x,y)=>y.clientWidth*y.clientHeight-x.clientWidth*x.clientHeight)[0];const keep=new Set();let e=c;while(e){keep.add(e);e=e.parentElement;}document.querySelectorAll('body *').forEach(el=>{if(!keep.has(el)&&!el.contains(c))el.style.visibility='hidden';});return 1})()";
      if (!NOHIDE) await ev(HIDE);
      const drew = await ev("JSON.stringify((()=>{try{let fus=null;const S=window.CAGE_SCENE;const walk=o=>{if(o.userData&&o.userData.bodyZones){fus=o;}(o.children||[]).forEach(walk);};if(S)walk(S);const g=fus&&fus.geometry;return {fuselageVerts:g?g.attributes.position.count:null,deckSplit:!!(fus&&fus.userData.eye),eyeAppended:fus&&fus.userData.eye?fus.userData.eye.parent.length:0,cowl:window.CAGE_COWL?{len:window.CAGE_COWL.len,aps:window.CAGE_COWL.aps}:null,eyeRefine:window.CAGE_UI.eyeRefine};}catch(e){return {err:String(e)};}})())");
      const ok = await pill('interior');
      if (!ok) { console.log('cowl_res_stills: ' + tag + ' ' + mode + ': no interior view (no pilot?)'); continue; }
      await sleep(3500);
      if (!NOHIDE) await ev(HIDE);                      // the flyout the pill may have opened
      // THE EYE ASSERTED (the stills-rig rule): the camera within 0.5 m of the crew layer's eye marker, else no picture
      const eye = JSON.parse(await ev("JSON.stringify((()=>{const E=window.CAGE_CREW_EYE,F=window.FLIGHT_PROBE,c=F&&F.camera&&F.camera();if(!E||!c)return {ok:false,why:!E?'no crew eye':'no camera'};const p=c.position;const d=Math.hypot(p.x-E.p[0],p.y-E.p[1],p.z-E.p[2]);return {ok:d<0.5,d:+d.toFixed(3),boot:" + BOOTUP + "};})())"));
      console.log('cowl_res_stills: ' + tag + ' ' + mode + ' eye ' + JSON.stringify(eye));
      if (!eye.ok || eye.boot) { console.log('cowl_res_stills: ' + tag + ' ' + mode + ': NOT at the pilot\'s eye - no picture'); continue; }
      await shot(tag + '_' + mode + '_ahead');
      // the head turned the same way every time (HEAD_CAM, panel_shot's handle; the mouse drag did not move it):
      // over each shoulder of the nose and down - from the seat the deck and the cowl sit under the glareshield line
      for (const [nm, yaw, pitch] of LOOKS) {
        await ev("(()=>{if(window.HEAD_CAM){HEAD_CAM.yaw=" + yaw + ";HEAD_CAM.pitch=" + pitch + ";}return 1})()");
        await sleep(2000);
        await shot(tag + '_' + mode + '_' + nm);
      }
      await ev("(()=>{if(window.HEAD_CAM){HEAD_CAM.yaw=0;HEAD_CAM.pitch=0;}return 1})()");
      const row = Object.assign({ build: tag, mode }, JSON.parse(drew));
      info.push(row); console.log('cowl_res_stills: ' + JSON.stringify(row));
    }
  }
  fs.writeFileSync(path.join(OUT, 'cowl_res_stills.json'), JSON.stringify({ info, errors: errs }, null, 1));
  ws.close();
  done(0);
})().catch(e => { console.error('cowl_res_stills: ' + e.message); done(1); });
