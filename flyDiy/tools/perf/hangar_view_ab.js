#!/usr/bin/env node
// hangar_view_ab.js - HANGAR-VIEW G3630's NUMBERS (A0, 26 Oct: the arms interleaved on ONE warmed profile, so both see the
// same load - the slot overlaps another session's untimed stills). Per arm (?hview=0 = 'off', the control; the default =
// 'view'), the room `--room` (HOME), the user's Cub in the WIP slot:
//   boot      navigation -> the shed up (the boot's capture inside it), the view's stats (its capture ms, MB)
//   garage    --secs of the shed's frames, still camera: dt p50 / p99 / max, the share over 34 ms
//   return    roll out, the flight up, then the way back (#bHangar2): FLYDIY_TRIPS' own ms for world -> garage
//   recapture the return's deferred recapture asked for (FLYDIY_HVIEW.defer: 45 shed frames, then a face a frame) and
//             --secs + 3 of the shed's frames over it: p99 / max / over 34 ms (the off arm: the same frames, nothing asked)
// A discarded warm boot first (the profile's shader cache), then the arms in order (--arms off,view,off,view).
//   node tools/perf/hangar_view_ab.js --url http://localhost:8585/flyDiy/dev.html?gfx=gamer [--room HOME]
//        [--arms off,view,off,view] [--secs 8] [--out <json>] [--udd <short dir, kept until the end>]
// A GPU MEASUREMENT (UNTIMED in A0's slot): the caller holds the box's lock. The profile is deleted at the end.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL0 = opt('url', 'http://localhost:8585/flyDiy/dev.html?gfx=gamer');
const ROOM = opt('room', 'HOME');
const ARMS = opt('arms', 'off,view,off,view').split(',').filter(Boolean);
const SECS = +opt('secs', 8);
const OUT = path.resolve(opt('out', 'screenshots/hangar_view_ab.json'));
const UDD = opt('udd', path.join(require('os').tmpdir(), 'hvab' + Date.now().toString(36)));
const BUILD = opt('build', 'builds/cub_2026-09-20_corrected.json');
const C = require('../flight_core.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('hangar_view_ab: no Chrome'); process.exit(2); }
function doc() {
  let d = C.playerNormalise(C.playerMigrate(C.playerDefault()));
  if (ROOM !== 'HOME') { const r = C.playerAcquire(d, ROOM, ROOM, 'field', 'own'); if (!r.ok) throw new Error(ROOM + ': ' + r.why); d = r.doc; }
  d.here = ROOM; return JSON.stringify(d);
}
// the shed's frames for ms: dt stats off rAF
const FRAMES = ms => `(async()=>{const d=[];let l=performance.now();const t0=l;await new Promise(r=>{const f=()=>{const n=performance.now();d.push(n-l);l=n;if(n-t0<${ms})requestAnimationFrame(f);else r();};requestAnimationFrame(f);});
  d.shift();const s=d.slice().sort((a,b)=>a-b),q=p=>s[Math.min(s.length-1,Math.floor(p*s.length))];return JSON.stringify({n:d.length,p50:+q(0.5).toFixed(1),p99:+q(0.99).toFixed(1),max:+s[s.length-1].toFixed(1),over34:+(d.filter(x=>x>34).length/d.length*100).toFixed(1)});})()`;

async function arm(name, idx, keepProfile) {
  const PORT = 9400 + ((process.pid + idx * 11) % 500);
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run',
    '--user-data-dir=' + UDD, '--disable-gpu-sandbox', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} };
  const R = { arm: name };
  try {
    let tgt = null;
    for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
      if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r))); return d.result.value; };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    const wip = fs.readFileSync(path.resolve(__dirname, '..', '..', BUILD), 'utf8');
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{if(!sessionStorage.getItem("__hv")){sessionStorage.setItem("__hv","1");localStorage.removeItem("flydiy.gfx");localStorage.setItem("flydiy.wip",' + JSON.stringify(wip) + ');localStorage.setItem("flydiy.player",' + JSON.stringify(doc()) + ');localStorage.setItem("flydiy.flManual","0");}}catch(e){}' });
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    const url = URL0 + (name === 'off' ? (URL0.includes('?') ? '&' : '?') + 'hview=0' : '');
    const t0 = Date.now();
    await cmd('Page.navigate', { url });
    let up = false;
    while (!up && Date.now() - t0 < 300000) {
      await sleep(500);
      await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build|^sandbox$/i.test((b.textContent||'').trim())&&b.children.length===0&&b.offsetParent).forEach(x=>x.click());return 1;})()").catch(() => 0);
      up = await ev("!!(window.FLIGHT_PROBE && window.FLYDIY_HVIEW && window.GARAGE_ENV && (!window.BOOT || !BOOT.state || BOOT.state === 'gone'))").catch(() => false);
    }
    if (!up) throw new Error('the garage never came up');
    R.boot_s = +((Date.now() - t0) / 1000).toFixed(1);
    R.hview = JSON.parse(await ev('JSON.stringify(FLYDIY_HVIEW.stats())') || 'null');
    if (keepProfile === 'warm') { R.warm = true; return R; }
    await sleep(2000);
    R.garage = JSON.parse(await ev(FRAMES(SECS * 1000)));
    // out and back: FLYDIY_TRIPS' own ms for the way back
    const nT = await ev('(window.FLYDIY_TRIPS||[]).length');
    await ev("(()=>{const g=document.getElementById('bGo');const l=[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)&&b.offsetParent);const b=g&&g.offsetParent&&/roll out/i.test(g.textContent)?g:l[0];if(b)b.click();return 1;})()");
    let flying = false; const t1 = Date.now();
    while (!flying && Date.now() - t1 < 240000) { await sleep(1000); flying = await ev("(()=>{const L=window.FLYDIY_TRIPS||[];const t=L[L.length-1];return L.length>" + nT + "&&!!(t&&t.done)&&!document.body.classList.contains('garage');})()").catch(() => false); }
    if (!flying) throw new Error('the roll-out never ended');
    await sleep(5000);
    const nB = await ev('(window.FLYDIY_TRIPS||[]).length');
    await ev("(()=>{const b=document.getElementById('bHangar2');if(b)b.click();return !!b;})()");
    let back = null; const t2 = Date.now();
    while (!back && Date.now() - t2 < 120000) { await sleep(500); back = await ev("(()=>{const L=window.FLYDIY_TRIPS||[];const t=L[L.length-1];return L.length>" + nB + "&&t&&t.done?JSON.stringify({kind:t.kind,ms:t.ms}):null;})()").catch(() => null); }
    R.rollin = back ? JSON.parse(back) : { error: 'no way back' };
    await sleep(1500);
    R.deferred = await ev('FLYDIY_HVIEW.defer()');
    R.recapture = JSON.parse(await ev(FRAMES((SECS + 3) * 1000)));
    R.hviewAfter = JSON.parse(await ev('JSON.stringify(FLYDIY_HVIEW.stats())') || 'null');
  } catch (e) { R.error = e.message; }
  finally { kill(); await sleep(1500); }
  console.log(JSON.stringify(R));
  return R;
}

(async () => {
  const out = { url: URL0, room: ROOM, arms: [] };
  out.warm = await arm('view', 0, 'warm');
  let i = 1;
  for (const a of ARMS) out.arms.push(await arm(a, i++));
  // the means per arm
  const by = {};
  for (const r of out.arms) { if (r.error) continue; const b = by[r.arm] = by[r.arm] || { n: 0, boot_s: 0, garage_p99: 0, rollin_ms: 0, recap_p99: 0, recap_max: 0, recap_over34: 0 };
    b.n++; b.boot_s += r.boot_s; b.garage_p99 += r.garage.p99; b.rollin_ms += (r.rollin && r.rollin.ms) || 0; b.recap_p99 += r.recapture.p99; b.recap_max = Math.max(b.recap_max, r.recapture.max); b.recap_over34 += r.recapture.over34; }
  for (const k in by) { const b = by[k]; for (const f of ['boot_s', 'garage_p99', 'rollin_ms', 'recap_p99', 'recap_over34']) b[f] = +(b[f] / b.n).toFixed(1); }
  out.mean = by;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('MEAN ' + JSON.stringify(by));
  try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {}
})();
