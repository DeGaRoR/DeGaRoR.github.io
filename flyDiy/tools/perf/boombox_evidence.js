// boombox_evidence.js - THE SHED'S RADIO, PHOTOGRAPHED (G1713, SND-BOOMBOX; for the Coordinator's box: cloud sessions
// cannot render the game)
//
//   node tools/perf/boombox_evidence.js [--url http://localhost:8450/flyDiy/dev.html] [--out reports/evidence/SND-BOOMBOX]
//        [--wait 15000] [--log] [--swgl]
//
// garage_shot.js's rig (headless Chrome on this machine's GPU, CDP), pointed at the garage. Everything is pressed the
// way a player presses it - real mouse events through Input.dispatchMouseEvent - so the pictures prove the path, not a
// shortcut. Nothing in the page is called except READS (BOOMBOX.isOpen / hovered, AUDIO_MUSIC.station) to know when to
// shoot. The run, in order:
//   1_garage.png        the shed as it boots: the boombox on the floor by the aeroplane
//   2_quickbar.png      the quick bar, cropped: inside / ref / SOUND / RADIO / time
//   3_hover.png         the pointer over the radio: the pointer cursor's halo on the floor (found by sweeping the mouse
//                       over the render until BOOMBOX.hovered says so - the same throttled hover the player gets)
//   4_panel.png         one click on it: the radio's panel beside it
//   5_panel_playing.png a station pressed in the panel (Lo-fi): music in the garage on, the station lit, now playing
//   6_quickbar_on.png   the quick bar again: the radio button lit, its title the station
//   7_after_esc.png     Esc: the panel gone
//   8_audio0_panel.png  the page again with ?audio=0: the same click, the panel says the sound is off, nothing else
// and summary.json: what was read at each step (the hover cell, the station, the titles of the two quick buttons).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL0 = opt('url', 'http://localhost:8450/flyDiy/dev.html');
const OUT = opt('out', path.join('reports', 'evidence', 'SND-BOOMBOX'));
const WAIT = +opt('wait', 15000);
const LOG = argv.includes('--log');
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('boombox_evidence: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_bb_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--autoplay-policy=no-user-gesture-required']
  // (root, a container: Chrome's sandbox refuses it; --swgl: no GPU here - ANGLE on SwiftShader, slow but it draws)
  .concat(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [])
  .concat(argv.includes('--swgl') ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []).concat(['about:blank']), { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const summary = { url: URL0, steps: [] };
(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split('\n').slice(0, 3).join(' | '));
    if (LOG && m.method === 'Runtime.consoleAPICalled') console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 600)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && r.result.exceptionDetails.text)); return r.result.result.value; };
  fs.mkdirSync(OUT, { recursive: true });
  const shot = async (name, clip) => {
    const s = await cmd('Page.captureScreenshot', Object.assign({ format: 'png' }, clip ? { clip: Object.assign({ scale: 1 }, clip) } : {}));
    const f = path.join(OUT, name + '.png'); fs.writeFileSync(f, Buffer.from(s.result.data, 'base64')); console.log('boombox_evidence: wrote ' + f);
  };
  const mouse = (type, x, y, extra) => cmd('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'none', buttons: 0, pointerType: 'mouse' }, extra || {}));
  const click = async (x, y) => {
    await mouse('mouseMoved', x, y);
    await mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 });
    await sleep(60);
    await mouse('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 });
  };
  const key = async k => { await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: k === 'Escape' ? 27 : 0 });
    await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: k === 'Escape' ? 27 : 0 }); };
  const step = (k, v) => { summary.steps.push(Object.assign({ step: k }, v || {})); console.log('boombox_evidence: ' + k + ' ' + JSON.stringify(v || {})); };
  const boot = async url => {
    await cmd('Page.navigate', { url });
    // the workshop up: the loading screen gone, #edView shown, the editor's pick and the quick bar there (SwiftShader: minutes)
    let up = false;
    for (let i = 0; i < 600 && !up; i++) { await sleep(1000); up = await ev("!!(window.BOOMBOX && window.EDITOR_PICK && document.querySelector('#edQuick .edQuickBtn') && (!window.BOOT || BOOT.state === 'gone') && !document.getElementById('edView').hidden)"); }
    if (!up) throw new Error('the garage never came up (the boot screen, #edView, EDITOR_PICK or the quick bar)');
    await sleep(WAIT);   // the props land, the boot screen lifts
    // a fresh profile opens the archetype picker over the render (design_flow.js): its own "keep the current build"
    const keep = await ev("(()=>{const b=document.querySelector('.dfClose');if(!b||!b.offsetParent)return null;const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
    if (keep) { await click(Math.round(keep.x), Math.round(keep.y)); await sleep(1500); step('the archetype picker closed (keep the current build)'); }
  };
  // the render's free estate (#edView's box: inset by both panels), the quick bar's box
  const rect = sel => ev("(()=>{const e=document.querySelector(" + JSON.stringify(sel) + ");if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height}})()");
  // sweep the mouse over the lower two thirds of the render until the radio says it is hovered (the page's own 110 ms
  // hover throttle: 130 ms a cell), then centre on it
  const findRadio = async () => {
    const v = await rect('#edView');
    const x0 = v.x + 60, x1 = v.x + v.width - 60, y0 = v.y + v.height * 0.3, y1 = v.y + v.height - 40;
    for (const stepPx of [90, 45]) {
      for (let y = y0; y <= y1; y += stepPx) for (let x = x0; x <= x1; x += stepPx) {
        await mouse('mouseMoved', Math.round(x), Math.round(y));
        await sleep(130);
        if (await ev('BOOMBOX.hovered')) {
          // the cell's neighbourhood: the middle of the run of hovered points along x
          let a = x, b = x;
          for (let d = 8; d < 120; d += 8) { await mouse('mouseMoved', Math.round(x - d), Math.round(y)); await sleep(130); if (await ev('BOOMBOX.hovered')) a = x - d; else break; }
          for (let d = 8; d < 120; d += 8) { await mouse('mouseMoved', Math.round(x + d), Math.round(y)); await sleep(130); if (await ev('BOOMBOX.hovered')) b = x + d; else break; }
          const cx = Math.round((a + b) / 2), cy = Math.round(y);
          await mouse('mouseMoved', cx, cy); await sleep(200);
          return { x: cx, y: cy };
        }
      }
    }
    return null;
  };
  const quickTitles = () => ev("Object.fromEntries([...document.querySelectorAll('#edQuick .edQuickBtn')].map(b=>[b.dataset.q,(b.classList.contains('on')?'[on] ':'')+(b.disabled?'[disabled] ':'')+b.title]))");

  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  // ---- the page, sound on ----
  await boot(URL0);
  await shot('1_garage');
  const qb = await rect('#edQuick');
  const qclip = qb ? { x: Math.max(0, qb.x - 12), y: Math.max(0, qb.y - 8), width: qb.width + 24, height: qb.height + 16 } : null;
  step('quick bar', { box: qb, buttons: await quickTitles() });
  if (qclip) await shot('2_quickbar', qclip);
  const at = await findRadio();
  step('hover', { at, hovered: await ev('BOOMBOX.hovered'), cursor: await ev("document.getElementById('c').style.cursor") });
  if (!at) { step('FAILED: no hover found over the render'); throw new Error('the radio was never hovered'); }
  await shot('3_hover');
  await click(at.x, at.y); await sleep(600);
  step('click', { open: await ev('BOOMBOX.isOpen'), panel: await rect('#bbPanel') });
  await shot('4_panel');
  // a station, pressed in the panel: Lo-fi
  const lofi = await ev("(()=>{const b=document.querySelector('#bbPanel [data-st=lofi]');if(!b)return null;const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
  if (lofi) { await click(Math.round(lofi.x), Math.round(lofi.y)); await sleep(3500); }
  step('station', { station: await ev('AUDIO_MUSIC.station'), garageMusic: await ev("AUDIO.get('musicGarage')"), audio: await ev('AUDIO.state'),
    nowPlaying: await ev("(()=>{const n=AUDIO_MUSIC.nowPlaying();return n?n.title+' — '+n.artist:null})()"), lit: await ev("[...document.querySelectorAll('#bbPanel [data-st].on')].map(b=>b.dataset.st)") });
  await shot('5_panel_playing');
  step('quick bar, playing', { buttons: await quickTitles() });
  if (qclip) await shot('6_quickbar_on', qclip);
  await key('Escape'); await sleep(400);
  step('esc', { open: await ev('BOOMBOX.isOpen') });
  await shot('7_after_esc');
  // ---- the page with ?audio=0 ----
  await boot(URL0 + (URL0.indexOf('?') < 0 ? '?' : '&') + 'audio=0');
  step('audio=0 quick bar', { buttons: await quickTitles() });
  const at0 = await findRadio();
  if (at0) {
    await click(at0.x, at0.y); await sleep(600);
    step('audio=0 click', { open: await ev('BOOMBOX.isOpen'), text: await ev("(document.getElementById('bbPanel')||{}).textContent||null"),
      inputs: await ev("document.querySelectorAll('#bbPanel input').length") });
    await shot('8_audio0_panel');
  } else step('audio=0: the radio was never hovered');
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('boombox_evidence: wrote ' + path.join(OUT, 'summary.json'));
  ws.close(); ch.kill();
  process.exit(0);
})().catch(e => {
  console.error('boombox_evidence: ' + (e && e.message));
  try { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(Object.assign(summary, { error: String(e && e.message) }), null, 2)); } catch (x) {}
  ch.kill(); process.exit(1);
});
