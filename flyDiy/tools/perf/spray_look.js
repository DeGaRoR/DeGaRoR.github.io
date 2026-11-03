#!/usr/bin/env node
// spray_look.js - THE CHINE SHEETS, BEFORE / AFTER (WATER-STEADY G2837): the floatplane run up to planing speed on open
// water, frozen, and the side spray shot from four eyes - for the user, who judged the old arches "a first draft".
//
//   node tools/perf/spray_look.js --before http://localhost:8584/flyDiy/dev.html?world=jolene&gfx=gamer
//        --after http://localhost:8583/flyDiy/dev.html?world=jolene&gfx=gamer [--build bugReports/cessnaFloats.json]
//        [--speed 14] [--out screenshots/spray_look] [--wait 2500]
// One headless boot a side: the Cessna on floats rolled out - the game puts a float build on the SEA lane and its pilot runs the
// take-off from the lane's spawn (rollout_perf's G790 notes) - a 5 m/s sea; the run left to the pilot until the hull makes --speed
// m/s (the sheets exist only under dynamic pressure), then PAUSED - the sheets and the droplets hold where they are - and four eyes
// around (19 Oct: the first cut paused, moved the aircraft and went MANUAL at idle - it never moved: 0.5 m/s after 30 s)
// it: side, rear quarter, front quarter (low), close side. Stills only after the overlay is gone + 2 s; HUD hidden.
// A LOOK for a booked UNTIMED GPU slot (the caller takes the lock). Writes <out>/<view>_<side>.png, look.json, index.html.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WP = require('./water_places.js');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SIDES = [['before', opt('before', null)], ['after', opt('after', null)]].filter(s => s[1]);
const BUILD = opt('build', 'bugReports/cessnaFloats.json');
const SPEED = +opt('speed', 14), WAIT = +opt('wait', 2500), FRAMES = +opt('frames', 0);   // (G2837b) --frames N: N frames of the spray MOVING (the GIF's)
const OUT = path.resolve(opt('out', 'screenshots/spray_look'));
const VIEWS = [['side', 22, 0, 2.5], ['rear', 28, -1, 5], ['front', 30, 1, 2], ['close', 10, 0, 1.5]];   // [name, distance, fore(+)/aft(-)/abeam(0), eye height over the water]
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('spray_look: no Chrome'); process.exit(2); }
if (!SIDES.length) { console.error('spray_look: --before and/or --after URL'); process.exit(2); }

async function runSide(name, url, idx) {
  const PORT = 9400 + ((process.pid + idx * 11) % 500);
  const udd = path.join(require('os').tmpdir(), 'cdp_spray_' + PORT + '_' + Date.now());
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run',
    '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} };
  const rec = { side: name, url, shots: {} };
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
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("flydiy.wip",' + JSON.stringify(wip) + ');localStorage.removeItem("flydiy.gfx");'
      + 'for(const k of Object.keys(localStorage))if(/^flydiy\.(fl([A-Z]|$)|route$|world$)/.test(k))localStorage.removeItem(k);localStorage.setItem("flydiy.flManualRig","0")}catch(e){}' });   // (the pilot flies: no manual left over)
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await cmd('Page.navigate', { url });
    await sleep(1500);
    try { await ev("(() => Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('boot timeout'), 150000))]))()"); } catch (e) { await sleep(18500); }
    const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) {
      await ev("(()=>{const g=document.getElementById('bGo'); if (g) { g.click(); return; } [...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
      await sleep(6000);
      flying = await ev("!!window.FLIGHT_PROBE && (/TAXI|DOWNWIND|FINAL|DEPART|TAKEOFF/.test(document.body.innerText) || (window.BOOT && BOOT.state === 'loading'))");
    }
    if (!flying) throw new Error('the roll-out never happened');
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
    for (let i = 0; i < 300; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/continue anyway/i.test(b.textContent)).forEach(b=>b.click());return 1;})()");
    await sleep(2000);
    const PAUSE = "(()=>{const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent)){b.click();return 'paused';}return 'was paused';})()";
    const RESUME = "(()=>{const b=document.getElementById('bPause');if(b&&!/pause/i.test(b.textContent)){b.click();return 'resumed';}return 'was running';})()";
    rec.places = await ev(WP.FIND);
    await ev("(()=>{FLIGHT_PROBE.world().setSea({A:0.09,L:10,dir:0.4});WATER.setWind(5,0.4);return 1;})()");
    // the pilot's own take-off run from the SEA lane: never paused, never manual
    await ev(RESUME);
    await ev('(()=>{if(FLIGHT_PROBE.manual&&FLIGHT_PROBE.manual())FLIGHT_PROBE.setManual(false);return 1;})()');
    const t0 = Date.now(); let V = 0;
    while (Date.now() - t0 < 75000) {
      V = await ev('(()=>{const v=FLIGHT_PROBE.sim().cgVel?FLIGHT_PROBE.sim().cgVel():[0,0,0];return Math.hypot(v[0],v[2]);})()');
      if (V >= SPEED) break;
      await sleep(250);
    }
    await ev(PAUSE);
    rec.speed = +V.toFixed(1); rec.runS = +((Date.now() - t0) / 1000).toFixed(1);
    const st = JSON.parse(await ev(`(()=>{const s=FLIGHT_PROBE.sim(),c=s.cgPos(),v=s.cgVel?s.cgVel():[1,0,0];const h=Math.hypot(v[0],v[2])||1;
      return JSON.stringify({c,fx:v[0]/h,fz:v[2]/h,lvl:__WP.level(c[0],c[2])});})()`));
    rec.state = st;
    console.log(`  ${name}: ${rec.speed} m/s after ${rec.runS} s at ${st.c.map(x => x.toFixed(0)).join(',')}`);
    await ev("(()=>{const R=window.FLYDIY_RAIL,f=document.getElementById('flFly');if(R)R.open(f&&!f.hidden?null:'camera');return 1;})()");
    await sleep(300);
    if (!await ev("(()=>{const p=[...document.querySelectorAll('#flFlyBody .pill')].find(b=>b.textContent.trim()==='free');if(!p)return 0;p.click();return 1;})()")) throw new Error('no free pill');
    await ev("(()=>{const R=window.FLYDIY_RAIL,f=document.getElementById('flFly');if(R)R.open(f&&!f.hidden?null:'camera');return 1;})()");
    await ev('(()=>{if(window.SHOT_MODE)SHOT_MODE.enter();return 1;})()');
    for (const [v, dist, fore, up] of VIEWS) {
      // the eye: abeam (to the right of the run) or toward the bow / the tail, on a 25 deg bearing off the beam when not abeam
      const rx = -st.fz, rz = st.fx;   // right of the heading
      const a = fore === 0 ? 0 : fore * 55 * Math.PI / 180, dx = Math.cos(a) * rx + Math.sin(a) * st.fx, dz = Math.cos(a) * rz + Math.sin(a) * st.fz;
      const ex = st.c[0] + dx * dist, ez = st.c[2] + dz * dist, ey = st.lvl + up;
      const tx = st.c[0] - ex, tz = st.c[2] - ez, ty = (st.lvl + 0.8) - ey, yaw = Math.atan2(tx, -tz), pitch = Math.atan2(ty, Math.hypot(tx, tz));
      await ev(`(()=>{const c=DEV_CAM;c.pos.set(${ex},${ey},${ez});c.yaw=${yaw};c.pitch=${pitch};return 1;})()`);
      await sleep(WAIT);
      const shot = await cmd('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT, v + '_' + name + '.png');
      fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
      rec.shots[v] = { file: path.basename(file), eye: [ex, ey, ez].map(t => +t.toFixed(1)) };
      console.log(`  ${name} ${v.padEnd(5)} -> ${file}`);
    }
    // (G2837b) THE SPRAY MOVING: the eye follows the aircraft abeam (16 m out, 2.2 m up, a page-side loop every animation frame), the
    // run resumed, FRAMES shots ~120 ms apart - the frames of the user's GIF
    if (FRAMES > 0) {
      await ev(`(()=>{ const s0 = FLIGHT_PROBE.sim(); window.__sprayFol = true; const f = () => { if (!window.__sprayFol) return; const c = s0.cgPos(), v = s0.cgVel ? s0.cgVel() : [1, 0, 0], h = Math.hypot(v[0], v[2]) || 1;
        const fx = v[0] / h, fz = v[2] / h, rx = -fz, rz = fx, ex = c[0] + rx * 16 - fx * 2, ez = c[2] + rz * 16 - fz * 2, ey = ${st.lvl} + 2.2;
        const tx = c[0] - ex, tz = c[2] - ez, ty = (${st.lvl} + 0.8) - ey; DEV_CAM.pos.set(ex, ey, ez); DEV_CAM.yaw = Math.atan2(tx, -tz); DEV_CAM.pitch = Math.atan2(ty, Math.hypot(tx, tz));
        requestAnimationFrame(f); }; f(); return 1; })()`);
      await ev(RESUME); await sleep(600);
      rec.frames = [];
      for (let j = 0; j < FRAMES; j++) { const sh = await cmd('Page.captureScreenshot', { format: 'png' }); const fr = path.join(OUT, 'frames_' + name + '_' + String(j).padStart(2, '0') + '.png');
        fs.writeFileSync(fr, Buffer.from(sh.result.data, 'base64')); rec.frames.push(path.basename(fr)); await sleep(120); }
      await ev(PAUSE); await ev('(()=>{window.__sprayFol=false;return 1;})()');
      console.log(`  ${name} frames: ${FRAMES} -> ${OUT}`);
    }
    ws.close();
  } catch (e) { rec.error = String(e.message || e); console.error('  ' + name + ': ' + rec.error); }
  kill();
  return rec;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const recs = [];
  for (const [name, url] of SIDES) { console.log('spray_look: ' + name); recs.push(await runSide(name, url, recs.length)); }
  fs.writeFileSync(path.join(OUT, 'look.json'), JSON.stringify({ date: new Date().toISOString(), build: BUILD, speed: SPEED, sides: recs }, null, 1));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = VIEWS.map(([v]) => `<section><h2>${esc(v)}</h2><div class="g">` + recs.map(r => { const s = r.shots[v];
    return `<figure>${s ? `<img src="${esc(s.file)}" alt="${esc(v + ' ' + r.side)}">` : '<div class="miss">not shot</div>'}<figcaption>${esc(r.side)} (${r.speed || '?'} m/s)</figcaption></figure>`; }).join('') + '</div></section>').join('\n');
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Side spray</title>
<style>:root{--bg:#f6f6f4;--fg:#1b1b1b;--mut:#666}@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#e8e8e8;--mut:#9a9a9a}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}h1{font-size:20px}h2{font-size:16px;margin:24px 0 6px}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px}figure{margin:0}img{width:100%;height:auto;display:block;border-radius:4px}figcaption{font-size:13px;color:var(--mut);padding:4px 0}.miss{aspect-ratio:16/9;display:grid;place-items:center;border:1px dashed var(--mut)}</style>
<h1>The side spray - before and after</h1><p style="color:var(--mut)">The floatplane at planing speed on open water, frozen; the same four eyes on each side.</p>
${rows}`);
  console.log('spray_look -> ' + path.join(OUT, 'index.html'));
})().catch(e => { console.error('spray_look: ' + e.message); process.exit(1); });
