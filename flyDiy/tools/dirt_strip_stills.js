#!/usr/bin/env node
// dirt_strip_stills.js - THE DIRT STRIP, PICTURED (DIRT-STRIP, 2026-11-09): before / after stills of a soft strip's tyre
// marks and its micro-height, FOR A0's BOX (one headless Chrome on the GPU; terrain_still.js's page driver, verbatim where
// it could be). For each PAGE (e.g. index_before.html = master's, index.html = today's) it boots the game with the user's
// Cub in flydiy.wip, rolls out, holds the aeroplane on the strip (paused, its wheels on terrainH), sets the hour and the
// orbit, lets the streamers land, and writes <view>_<page>.png. The same eye on both pages.
//
//   node tools/dirt_strip_stills.js --strip nv_strip --pages index.html --out D:/Dev/flydiy-notes/evidence/dirt-strip-2026-11-09/before
//   ONE SESSION, MANY STRIPS (the user, 9 Nov 17:05: "all screenshots in a single session with a single loading time"):
//   --strip w7,w8,tw_ski (one boot, the Cub moved from strip to strip), --micro w7:0.7,w8:0.4:0:13 (id:chaos[:puddles[:seed]]),
//   --fc 1 (each view again in DIRT-STRIP's false colour, PAVEMENT.debug(12)), --wet2 0.9 (each view again on wet soil),
//   --deadline <s> (stop shooting after that many seconds, keep what is shot); files <strip>_<view>[_fc|_wet].png
//        [--views along,quarter,top,close,back] [--hour golden] [--size 1600x900] [--port 8547] [--js "<page statements>"]
//
// The views (the strip's own frame: u along from end 0, n across; the orbit is FLIGHT_PROBE.camSet(az, el, dist), the
// camera at target + dist (cos el cos az, sin el, cos el sin az)):
//   along    the Cub 30 m in, 3 m off the centreline; the eye behind it, low, down the strip
//   quarter  the same place, a three-quarter view from 30 m up and back
//   top      straight-ish down from 55 m: the marks' distribution across the width
//   close    the eye at 5 m beside the main wheel: a tyre against its marks
//   back     the Cub at the far end, the eye beyond it looking back up the whole strip (the touchdown zone)
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const PAGES = opt('pages', 'index.html').split(',');
const STRIPS = opt('strip', 'nv_strip').split(','), STRIP = STRIPS[0];
const FC = +opt('fc', 0), WET2 = opt('wet2', null), DEADLINE = +opt('deadline', 0), T0 = Date.now();
const HOUR = opt('hour', 'golden');
const BUILD = opt('build', 'builds/cub_2026-09-20_corrected.json');
const REST = +opt('rest', 1.095);   // the Cub's resting CG over terrainH (G1540)
const JS = opt('js', '');
const SETTLE = +opt('settle', 1500);
// --micro id:chaos[:puddles] - that strip made bumpy (26b_strip_micro) in THIS browser profile only: the shipped record with
// `micro` on the strip, seeded as the working copy the boot reads (world_boot's rig door, flydiy.premises.bootWip)
const MICRO = opt('micro', null), WETV = opt('wet', null);
const MICRO_REC = MICRO ? (() => { const J = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8'));
  for (const one of MICRO.split(',')) { const [id, ch, pu, sd] = one.split(':');
    const r = J.layers.runways.find(q => q.id === id); if (!r) throw new Error('no strip ' + id); r.micro = { chaos: +ch, seed: sd ? +sd : 2 }; if (pu && +pu) r.micro.puddles = +pu; }
  return JSON.stringify(J); })() : null;   // ms the sim runs after the place (the tail settles), then paused again
const strip = id => { const W = require(path.join(__dirname, 'island_node.js')).islandWorld('jolene', { premises: fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8') }); return W.aerodromes.find(a => a.id === id); };
const AS = STRIPS.map(strip);
if (AS.some(a => !a)) { console.error('dirt_strip_stills: no strip ' + STRIPS[AS.findIndex(a => !a)]); process.exit(2); }
let A = AS[0], D, N, P, BEHIND, AHEAD, SIDE, VIEWS;
function frame(a) { A = a; D = [Math.cos(A.hdg), Math.sin(A.hdg)]; N = [-D[1], D[0]];
P = (u, n) => [A.x + D[0] * (u - A.len / 2) + N[0] * n, A.z + D[1] * (u - A.len / 2) + N[1] * n];
const azOf = (dx, dz) => Math.atan2(dz, dx);
// az of the eye's offset from the target: behind = -D
BEHIND = azOf(-D[0], -D[1]); AHEAD = azOf(D[0], D[1]); SIDE = azOf(N[0], N[1]);
VIEWS = {
  along:   { at: P(30, 3), cam: [BEHIND + 0.10, 0.06, 11] },
  quarter: { at: P(30, 3), cam: [BEHIND + 0.75, 0.42, 30] },
  top:     { at: P(Math.min(75, A.len / 2), 4), cam: [BEHIND + 0.05, 1.22, 55] },
  close:   { at: P(40, 2.2), cam: [BEHIND + 1.0, 0.30, 8] },
  back:    { at: P(A.len - 25, -2.5), cam: [AHEAD - 0.08, 0.07, 14] },
  low:     { at: P(30, 3.2), cam: [BEHIND + 0.04, 0.022, 24] },   // grazing, down the strip: a bumpy strip's relief
  approach: { at: P(-110, 0), agl: 24, cam: [BEHIND, 0.10, 9] },  // short final: the pilot's eye on the strip ahead (the Cub held in the air)
  eye:     { at: P(12, 0.6), cam: [BEHIND, 0.06, 4.5] },          // taxiing, just behind and above the cockpit
}; }
frame(AS[0]);
const VIEW_KEYS = opt('views', Object.keys(VIEWS).join(',')).split(',');
const SIZE = opt('size', '1600x900').split('x').map(Number);
const SPORT = +opt('port', 8547);
const OUT = path.resolve(opt('out', path.join(ROOT, 'reports/evidence/DIRT-STRIP')));
const REPO = path.resolve(ROOT, '..');
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const server = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(SPORT), REPO], { stdio: 'ignore' });

const HOLD = (at, agl) => `(async () => {
  const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
  const s = FLIGHT_PROBE.sim(), w = FLIGHT_PROBE.world(), at = ${JSON.stringify(at)};
  const cg = s.cgPos(), gy = w.terrainH(at[0], at[1]) + ${agl};
  await FLIGHT_PROBE.place({ by: [at[0] - cg[0], gy - cg[1], at[1] - cg[2]], zeroV: true });
  // SETTLE (the tail comes down): run ~1.5 s, then pause again
  if (${SETTLE}) { const tg = () => document.getElementById('bPause').click(); tg(); await new Promise(r => setTimeout(r, ${SETTLE})); tg(); }
  return JSON.stringify(s.cgPos().map(v => Math.round(v * 10) / 10)); })()`;
const FRAMES = n => `new Promise(r => { let k = 0; const f = () => { if (++k >= ${n}) r(k); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`;

async function runPage(page) {
  const port = 9660 + (process.pid % 200) + PAGES.indexOf(page);
  const udd = path.join(os.tmpdir(), 'cdp_ds_' + port + '_' + Date.now());
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--window-size=' + SIZE[0] + ',' + SIZE[1], '--hide-scrollbars', '--no-first-run',
    '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { if (process.platform === 'win32') execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} };
  const out = [];
  try {
    let tgt = null;
    for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + port + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') console.log('  page exception: ' + String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).split('\n')[0]);
      // a shader that does not compile is a console.error (three's WebGLProgram), not an exception: its lines, ERROR: first
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') { const t = (m.params.args || []).map(a => String(a.value !== undefined ? a.value : a.description || '')).join(' ');
        if (/Shader Error|ERROR:|VALIDATE_STATUS/.test(t)) { const er = t.split('\n').filter(l => /ERROR:/.test(l)).slice(0, 6).join(' | ').slice(0, 900); console.log('  SHADER ERROR: ' + (er || t.slice(0, 300))); } } };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
      if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r))); return d.result.value; };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    const wip = fs.readFileSync(path.join(ROOT, BUILD), 'utf8');
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{if(!sessionStorage.getItem("__ds")){sessionStorage.setItem("__ds","1");localStorage.removeItem("flydiy.gfx");localStorage.removeItem("flydiy.premises.game.jolene");localStorage.setItem("flydiy.wip",' + JSON.stringify(wip) + ');' + (MICRO_REC ? 'localStorage.setItem("flydiy.premises.bootWip","1");localStorage.setItem("flydiy.premises.game.jolene",' + JSON.stringify(MICRO_REC) + ');' : '') + '}}catch(e){}' });
    await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
    await cmd('Page.navigate', { url: 'http://localhost:' + SPORT + '/flyDiy/' + page });
    await sleep(1500);
    try { await ev("Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('timeout'), 150000))])"); } catch (e) {}
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) { await ev("(()=>{const b=document.getElementById('bGo'); if (b) b.click();})()"); await sleep(6000); flying = await ev("/TAXI|DOWNWIND|FINAL|DEPART|HOLD|PARK/.test(document.body.innerText)"); }
    for (let i = 0; i < 150; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
    await sleep(3000);
    if (WETV !== null) console.log('  wet: ' + await ev(`(()=>{ if (window.PAVEMENT && PAVEMENT.setSoilWet) { PAVEMENT.setSoilWet(${+WETV}); return PAVEMENT.WET.value; } return 'no PAVEMENT.setSoilWet'; })()`));
    if (JS) console.log('  js: ' + await ev('(()=>{' + JS + '})()').catch(e => 'ERR ' + e.message));
    // the UI out of the picture: the world and the aeroplane alone
    await ev("(()=>{['ui','devPanel','hud','rail'].forEach(i=>{const e=document.getElementById(i);if(e)e.style.visibility='hidden';});document.querySelectorAll('.card,.panel,#phase,#hud,.toast,button').forEach(e=>e.style.visibility='hidden');return 1;})()").catch(() => 0);
    const tag = path.basename(page, '.html'), cap = async name => { const png = await cmd('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(OUT, { recursive: true }); const file = path.join(OUT, name); fs.writeFileSync(file, Buffer.from(png.result.data, 'base64')); return file; };
    for (let si = 0; si < AS.length; si++) { frame(AS[si]); let first = true;
    for (const vk of VIEW_KEYS) {
      const V = VIEWS[vk]; if (!V) continue;
      if (DEADLINE && Date.now() - T0 > DEADLINE * 1000) { console.log('  DEADLINE: ' + STRIPS[si] + ' ' + vk + ' and after not shot'); break; }
      const where = await ev(HOLD(V.at, V.agl || REST));
      await ev(`(() => { if (window.DAY_CLOCK && DAY_CLOCK.preset) DAY_CLOCK.preset(${JSON.stringify(HOUR)}); return 1; })()`);
      await ev(`FLIGHT_PROBE.camSet(${V.cam.join(',')})`);
      await ev(FRAMES(!out.length ? 400 : first ? 240 : 120)); first = false;
      await ev(`FLIGHT_PROBE.camSet(${V.cam.join(',')})`); await ev(FRAMES(10));
      const pre = AS.length > 1 ? STRIPS[si] + '_' + vk : vk + '_' + tag;
      const file = await cap(pre + '.png');
      console.log('  ' + vk + ' @' + where + ' -> ' + file);
      out.push({ page, strip: STRIPS[si], view: vk, cam: V.cam, where, file });
      if (FC) { await ev('(()=>{PAVEMENT.debug(12);return 1;})()'); await ev(FRAMES(6)); out.push({ strip: STRIPS[si], view: vk, fc: true, file: await cap(pre + '_fc.png') }); await ev('(()=>{PAVEMENT.debug(0);return 1;})()'); }
      if (WET2 !== null) { const w0 = await ev('PAVEMENT.WET.value'); await ev(`(()=>{PAVEMENT.setSoilWet(${+WET2});return 1;})()`); await ev(FRAMES(6)); out.push({ strip: STRIPS[si], view: vk, wet: +WET2, file: await cap(pre + '_wet.png') }); await ev(`(()=>{PAVEMENT.setSoilWet(${+w0 || 0});return 1;})()`); }
    } }
    try { await cmd('Browser.close'); } catch (e) {}
  } finally { await sleep(500); kill(); try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {} }
  return out;
}

(async () => {
  await sleep(800);
  console.log('dirt_strip_stills: ' + STRIP + ' len ' + A.len + ' wid ' + A.wid + ' hdg ' + A.hdg.toFixed(4) + ' hour ' + HOUR);
  const all = [];
  for (const p of PAGES) { console.log('dirt_strip_stills: ' + p); try { all.push(...await runPage(p)); } catch (e) { console.log('  FAILED: ' + e.message); } }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'stills_' + STRIPS.join('-').slice(0, 60) + '.json'), JSON.stringify(all, null, 1));
  server.kill();
  process.exit(0);
})().catch(e => { console.error(e); server.kill(); process.exit(1); });
