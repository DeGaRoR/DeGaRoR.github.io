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
// DROP m over that: on a rutted strip the ground under the CG is not the ground under each wheel (a 10 cm rut, a berm), and
// a wheel placed inside a berm springs out and breaks (9 Nov 20:50: a gear leg flew over w5) - drop it, the settle lands it
const DROP = +opt('drop', 0.15);
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
  // THE SPLASH (the user 10 Nov: "if we have water, we need water projections too"): on wet soil the Cub ROLLS through the
  // wettest 15 m along its main wheels' lines (the page's STRIP_MICRO.puddleAt at the page's wetness), 6 m/s, and two frames
  // are frozen as its wheels go through; the eye low, ahead and to the side
  splash:  { splash: true, cam: [AHEAD + 0.75, 0.10, 9] },
  // dry dirt at a low sun, the eye low (A0 / AIRCRAFT-LOOKS 10 Nov: "the dirt is still too shiny ... flat at low angle"):
  // across the sun and toward it - set by --hour golden; the orbit's az turned to the sun in the shot loop
  sunx:    { at: P(40, 2.5), sun: 'across', cam: [0, 0.03, 9] },
  sunt:    { at: P(40, 2.5), sun: 'toward', cam: [0, 0.03, 9] },
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
// one frame read from the default framebuffer right after the game's own FLYDIY_AA.render (LOOK-1's t51 way), as a PNG (base64)
const GRAB = `new Promise((res, rej) => { const R = (window.WORLD && WORLD.renderer) || (window.FLIGHT_PROBE && FLIGHT_PROBE.renderer && FLIGHT_PROBE.renderer()), AA = window.FLYDIY_AA; if (!R || !AA || !AA.render) return rej(new Error('no WORLD.renderer / FLYDIY_AA'));
  const gl = R.getContext(), orig = AA.render; let done = false;
  AA.render = function () { const r = orig.apply(this, arguments); if (done) return r; done = true; AA.render = orig;
    try { const c = R.domElement, w = c.width, h = c.height, px = new Uint8Array(w * h * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const k = document.createElement('canvas'); k.width = w; k.height = h; const x = k.getContext('2d'), im = x.createImageData(w, h), D = im.data;
      for (let y = 0; y < h; y++) { const so = (h - 1 - y) * w * 4, d = y * w * 4; for (let i = 0; i < w * 4; i += 4) { D[d + i] = px[so + i]; D[d + i + 1] = px[so + i + 1]; D[d + i + 2] = px[so + i + 2]; D[d + i + 3] = 255; } }
      x.putImageData(im, 0, 0); res(k.toDataURL('image/png').split(',')[1]); } catch (e) { rej(e); }
    return r; };
  setTimeout(() => { if (!done) { done = true; AA.render = orig; rej(new Error('no FLYDIY_AA frame in 5 s')); } }, 5000); })`;
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
    // (A0 13 Nov, PACE-ON since 11 Nov: the boot cover stays up until every program links, ~96 s and longer under load; a Go
    //  clicked under it never reaches a flight) - wait for the cover to be gone first, and stop if the flight never comes
    for (let i = 0; i < 150; i++) { const bs = await ev("(()=>{const c=document.getElementById('boot');return (window.BOOT&&BOOT.state==='gone')||!c||c.classList.contains('gone')||c.offsetParent===null;})()"); if (bs) break; await sleep(1000); }
    let flying = false;
    // (13 Nov, the blank 03:42 stills: the body text matched /HOLD/ in the shed - the shots were taken under the roll-out
    //  cinematic and its held frame, the page's own pale blue) - flying is the phase plate past GARAGE (HOLDING on the stand, or the pilot's phase), no roll-out shot,
    //  not the shed, no boot cover (the roll-out's own trip screen); a Go every 15 s while not (it skips the cinematic)
    const FLY = "(()=>{const B=document.body.classList,ph=((document.getElementById('phName')||{}).textContent||'').trim();return !B.contains('rollShot')&&!B.contains('mode-ws')&&(!window.BOOT||BOOT.state==='gone')&&!!ph&&!/GARAGE/i.test(ph);})()";
    for (let a = 0, tGo = 0; a < 240 && !flying; a++) { if (a - tGo >= 15 || a === 0) { tGo = a; await ev("(()=>{const b=document.getElementById('bGo'); if (b) b.click();})()"); } await sleep(1000); flying = await ev(FLY); }
    if (!flying) throw new Error('never flying in 240 s (phase ' + await ev("((document.getElementById('phName')||{}).textContent||'').trim()+' '+document.body.className") + ') - not shot');
    console.log('  flying: ' + await ev("((document.getElementById('phName')||{}).textContent||'').trim()"));
    for (let i = 0; i < 150; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
    await sleep(3000);
    // (10 Nov: PAVEMENT.setSoilWet alone was overwritten each frame by SOIL_WET off the day - no water, no splash) SOIL_WET.force holds it
    if (WETV !== null) console.log('  wet: ' + await ev(`(()=>{ if (typeof SOIL_WET !== 'undefined') SOIL_WET.force = ${+WETV}; if (window.PAVEMENT && PAVEMENT.setSoilWet) { PAVEMENT.setSoilWet(${+WETV}); return 'force ' + (typeof SOIL_WET !== 'undefined' ? SOIL_WET.force : 'none') + ', pavement ' + PAVEMENT.WET.value; } return 'no PAVEMENT.setSoilWet'; })()`));
    if (JS) console.log('  js: ' + await ev('(()=>{' + JS + '})()').catch(e => 'ERR ' + e.message));
    // the UI out of the picture: the world and the aeroplane alone
    await ev("(()=>{['ui','devPanel','hud','rail'].forEach(i=>{const e=document.getElementById(i);if(e)e.style.visibility='hidden';});document.querySelectorAll('.card,.panel,#phase,#hud,.toast,button').forEach(e=>e.style.visibility='hidden');return 1;})()").catch(() => 0);
    const tag = path.basename(page, '.html'), cap = async name => {
      // (13 Nov, the 14:15 stills blank on master 23ce68c1f too: the page drew - rAF 58/s, a place within 5 m - but the CDP
      //  screenshot showed only the page's #cfe0ec behind the canvas; LOOK-1's t51 rig read real frames by gl.readPixels right after
      //  FLYDIY_AA.render) - the frame read the same way, its alpha forced opaque; the CDP screenshot only if that grab fails
      let b64 = await ev(GRAB).catch(e => { console.log('  grab failed (' + String(e.message || e).slice(0, 80) + '), the CDP screenshot'); return null; });
      if (!b64) b64 = (await cmd('Page.captureScreenshot', { format: 'png' })).result.data;
      fs.mkdirSync(OUT, { recursive: true }); const file = path.join(OUT, name); const buf = Buffer.from(b64, 'base64'); fs.writeFileSync(file, buf);
      if (buf.length < 20000) console.log('  WARNING ' + name + ' is ' + buf.length + ' bytes - one colour? (a blank frame)');
      return file; };
    for (let si = 0; si < AS.length; si++) { frame(AS[si]); let first = true;
    for (const vk of VIEW_KEYS) {
      const V = VIEWS[vk]; if (!V) continue;
      if (DEADLINE && Date.now() - T0 > DEADLINE * 1000) { console.log('  DEADLINE: ' + STRIPS[si] + ' ' + vk + ' and after not shot'); break; }
      let at = V.at;
      if (V.splash) {   // the wettest 15 m along the main wheels' lines (+-0.89 m, the Cub's half-track), from 30 m in
        const best = JSON.parse(await ev(`(() => { if (typeof STRIP_MICRO === 'undefined' || !window.PAVEMENT) return 'null'; const W = PAVEMENT.WET.value, D = ${JSON.stringify(D)}, N = ${JSON.stringify(N)}, A = ${JSON.stringify({ x: A.x, z: A.z, len: A.len, wid: A.wid })};
          const Pp = (u, n) => [A.x + D[0] * (u - A.len / 2) + N[0] * n, A.z + D[1] * (u - A.len / 2) + N[1] * n]; let b = null;
          for (let n0 = -A.wid / 2 + 1.5; n0 <= A.wid / 2 - 1.5; n0 += 0.1) for (let u0 = 30; u0 < A.len - 50; u0 += 5) { let s = 0;
            for (let du = 0; du < 15; du += 0.25) for (const w of [-0.89, 0.89]) { const q = Pp(u0 + du, n0 + w); s += STRIP_MICRO.puddleAt(q[0], q[1], W) > 0.01 ? 1 : 0; }
            if (!b || s > b[2]) b = [u0, n0, s]; }
          return JSON.stringify(b); })()`));
        if (!best || !(best[2] > 0)) { console.log('  splash: no water on the main wheels lines (is the soil wet? --wet 0.9)'); continue; }
        at = P(best[0] - 8, best[1]); console.log('  splash: ' + best[2] + ' wet samples from u ' + best[0] + ' at n ' + best[1].toFixed(1));
      }
      let where = await ev(HOLD(at, (V.agl || REST) + DROP));
      // (10 Nov 21:15: the first boot's places never took - every view shot at HOME's stand) the CG must be within 5 m of the place
      const off = w => { try { const c = JSON.parse(w); return Math.hypot(c[0] - at[0], c[2] - at[1]); } catch (e) { return Infinity; } };
      if (off(where) > 5) { console.log('  place missed (' + where + '), the Go again and a retry'); await ev("(()=>{const b=document.getElementById('bGo'); if (b) b.click();})()"); await sleep(4000); where = await ev(HOLD(at, (V.agl || REST) + DROP)); }
      if (off(where) > 5) { console.log('  PLACE FAILED for ' + STRIPS[si] + ' ' + vk + ' (' + where + '): not shot'); continue; }
      const dmg = await ev('(() => { const s = FLIGHT_PROBE.sim(), D = s && s.damage ? s.damage() : null; return D ? D.breaks + " breaks, " + D.yields + " yields" : "n/a"; })()').catch(() => 'n/a');
      if (!String(dmg).startsWith('0 breaks') && dmg !== 'n/a') console.log('  DAMAGE after the place on ' + STRIPS[si] + ' ' + vk + ': ' + dmg);
      await ev(`(() => { if (window.DAY_CLOCK && DAY_CLOCK.preset) DAY_CLOCK.preset(${JSON.stringify(HOUR)}); return 1; })()`);
      // (the low-sun views: the orbit's az from the sun's own - across it, or the eye between the Cub and the sun, looking toward it)
      if (V.sun) { const sa = await ev(`(() => { const W = FLIGHT_PROBE.world && FLIGHT_PROBE.world(), dd = (W && W.day) || (window.DAY_CLOCK && DAY_CLOCK.day && DAY_CLOCK.day()), L = dd && dd.sun;   // (07_day: the sun in the world frame) return L ? Math.atan2(L.z !== undefined ? L.z : L[2], L.x !== undefined ? L.x : L[0]) : 'null'; })()`).catch(() => 'null');
        if (typeof sa === 'number') V.cam[0] = V.sun === 'toward' ? sa + Math.PI : sa + Math.PI / 2; else console.log('  ' + vk + ': no sun direction on the page, az ' + V.cam[0]); }
      await ev(`FLIGHT_PROBE.camSet(${V.cam.join(',')})`);
      await ev(FRAMES(!out.length ? 400 : first ? 240 : 120)); first = false;
      if (V.splash) {   // roll: 6 m/s down the strip, run, freeze two frames as the wheels go through
        const tg = "document.getElementById('bPause').click()";
        await ev(`FLIGHT_PROBE.place({ dv: [${D[0] * 6}, 0, ${D[1] * 6}] })`);
        for (const [k, ms] of [[1, 1500], [2, 450]]) { await ev(tg); await sleep(ms); await ev(tg); await ev(`FLIGHT_PROBE.camSet(${V.cam.join(',')})`); await ev(FRAMES(4));
          const fk = await cap((AS.length > 1 ? STRIPS[si] + '_' : '') + 'splash' + k + '_' + tag + '.png'); console.log('  splash ' + k + ' -> ' + fk); out.push({ page, strip: STRIPS[si], view: 'splash' + k, file: fk }); }
        continue; }
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
