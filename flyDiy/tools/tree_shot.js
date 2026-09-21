#!/usr/bin/env node
// tree_shot.js - ONE PICTURE OF A MIX ON THE TREE BENCH, HEADLESS (2026-09-20)
//
//   node tools/tree_shot.js [--url http://localhost:8463/flyDiy/tools/_trees.html]
//        [--mixes conifer,deciduous,muskeg,grassland,borders] [--out screenshots/mixes]
//        [--cam yaw,pitch,dist] [--wait 8000]
//
// The bench in headless Chrome on the GPU (the pane lags and crashes under a
// stand - the user's word), the committed tuning (a fresh profile has no
// localStorage), each mix applied and planted, the bench's own stand view or
// --cam, one PNG each plus the stand's tally on stdout. What the user judges.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8463/flyDiy/tools/_trees.html');
const MIXES = opt('mixes', 'conifer,deciduous,muskeg,grassland,borders').split(',');
const OUT = opt('out', 'screenshots/mixes');
const CAM = opt('cam', null) ? opt('cam').split(',').map(Number) : null;
const WAIT = +opt('wait', 8000);   // under 8 s a replant's shrubs can still be black (the maps/AO race - the V1 trap)
const PORT = 9700 + (process.pid % 90);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('tree_shot: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_tshot_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
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
  await cmd('Page.navigate', { url: URL });
  for (let i = 0; i < 60; i++) { await sleep(1000); try { if (await ev("typeof SPECIES !== 'undefined' && SPECIES.length > 0")) break; } catch (e) {} }
  for (const mix of MIXES) {
    // ONE plant, at the eye --cam asks for (the cover grows around the eye): a second plant right
    // after the first drew the pack's trees black (its AO bake still running - the V1 trap)
    const ok = await ev(`(async () => { if (!MIXES[${JSON.stringify(mix)}]) return 'no such mix';
      MODE = 'forest'; scene.fog.near = 220; scene.fog.far = 1400; $('mForest').classList.add('on'); $('mShelf').classList.remove('on'); paintForestPanel(null);
      ${CAM ? `yaw = ${CAM[0]}; pitch = ${CAM[1]}; dist = ${CAM[2]}; target.set(0, 14, 0); place(); FOREST_FRAMED = true;` : 'FOREST_FRAMED = false;'}
      applyMix(${JSON.stringify(mix)}); await showForest();
      for (let i = 0; i < 900; i++) { if ($('msg').textContent === '') break; await new Promise(r => setTimeout(r, 100)); } await texturesReady(); render(); return 'ok'; })()`);
    if (ok !== 'ok') { console.log('  ' + mix + ': ' + ok); continue; }
    await sleep(WAIT);
    // every map on the stage decoded and uploaded before the picture (a fresh file's trees draw black until then)
    for (let i = 0; i < 60; i++) { const late = await ev("(() => { let n = 0; stage.traverse(o => { const m = o.material; if (!m) return; for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t && (!t.image || !(renderer.properties.get(t) || {}).__webglTexture)) n++; }); return n; })()"); if (!late) break; await ev('render(), 1'); await sleep(500); }
    await ev('render(), 1');
    const r = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, mix + '.png'), Buffer.from(r.result.data, 'base64'));
    const tally = await ev("(() => { const rows = [...document.querySelectorAll('#ui tr')].map(t => t.textContent.replace(/\\s+/g, ' ').trim()).filter(t => /^(drawn|ladder|series|understory|prototypes)/.test(t)); return rows.join(' | ') + ' | ' + $('stat').textContent.replace(/\\s+/g, ' '); })()");
    console.log('  ' + mix.padEnd(10) + tally);
  }
  console.log('  wrote ' + OUT + '/');
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('tree_shot: ' + e.message); ch.kill(); process.exit(1); });
