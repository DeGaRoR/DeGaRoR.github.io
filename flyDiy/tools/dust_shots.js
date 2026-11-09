#!/usr/bin/env node
// dust_shots.js - THE STRIP'S DUST IN THE PAGE: its look and its cost (DIRT-DUST, 2026-11-09) - FOR A0's BOX
// (Written without a GPU run: stol_shots.js's rig, verbatim where it could be. The design:
// D:/Dev/flydiy-notes/DIRT-DUST-DESIGN-2026-11-09.md.)
//
//   node tools/_serve.js 8450 &
//   node tools/dust_shots.js --url http://localhost:8450/flyDiy/dev.html --out screenshots/dust-2026-11-09/home \
//        [--build cub] [--dust 1|0] [--gfx gamer|laptop] [--cls dirt] [--soil 0.02] [--stills 1|0] [--airmax 90000] [--log]
//
// One boot = one run: the build (a VALIDATED key of tools/_load_build.js, or a file) through the garage's new-aeroplane
// door, the roll-out, and the PILOT'S OWN TAKE-OFF (FLIGHT_PROBE.ap()'s phases), and then 25 s of the climb-out with the
// eye turned back on the strip (the cloud hanging, drifting).
//   THE COST: the frame rate uncapped (GFX.set('fps', 'off')); every requestAnimationFrame's interval recorded from 5 s
//   before the roll to 25 s after the lift-off, with the dust's own numbers each frame (DUST_FX.fx: its ms - gather,
//   sources, step and the draw's upload -, the live puffs and grit, the screen cover). Printed: median / p90 / p99 / max
//   of the frame, the count over 50 / 100 ms, and the dust's ms. --dust 0 is the A/B's other arm (?dust=0: no batch is
//   made at all). The SAME box, minutes apart, the same --gfx: an absolute number from another session proves nothing.
//   --gfx laptop: the preset the phone loads (?gfx=laptop: the dust's 'phone' tier).
//   THE SURFACE: --cls dirt forces the dust's class under the wheels and the blast (the rig's own override of
//   DUST_FX.fx.env.cls - HOME is concrete and raises none: the cost of a dry dirt strip's dust measured on HOME's long
//   runway). --soil 0.02: SOIL_WET.force (bone dry). Both are printed in the JSON; neither is the game's default.
//   THE STILLS (--stills 1): the chase at the roll's start, beside the run at 60 % of Vr, the lift-off, and the climb's
//   eye turned back at 8 s and 20 s (the cloud behind). Each PNG beside the run's JSON.
//   --runup <strip id> (e.g. nv_strip, East Point): THE HONEST PICTURE on a real loose strip instead of the take-off -
//   after the roll-out the Cub is put on the strip (dirt_strip_stills.js's way: FLIGHT_PROBE.place by the strip's record
//   off island_node - a translation, so it keeps HOME's heading: a run-up does not care), the hour golden
//   (DAY_CLOCK.preset), hand flying on, the parking brake (P) and full throttle (Home) as the keys a player presses: 14 s
//   of run-up shot backlit (the eye on the sun's far side) and from the side, then idle (End) and the cloud left hanging
//   at +10 s. --cls none --soil none there: the strip's own class, the weather's own soil (or --soil 0.02 for a dry day).
// What A0 sends back: the PNGs and <out>_<arm>.json for each arm (dust on / off, gamer / laptop).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const LB = require(path.join(__dirname, '_load_build.js'));
const fileFor = x => (x && LB.VALIDATED[x]) ? LB.VALIDATED[x].build : x;
const BUILD = fileFor(opt('build', 'cub'));
const DUST_ON = opt('dust', '1') !== '0';
const GFX = opt('gfx', null);
const CLS = opt('cls', 'dirt');               // 'none' = the game's own surface
const SOIL = opt('soil', '0.02');             // 'none' = the game's own weather
const STILLS = opt('stills', '1') !== '0';
const AIR_MAX = +opt('airmax', 90000);
const OUT = opt('out', 'D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-09/dust/dust');   // (pictures never go in git: the notes' evidence folder)
const RUNUP = opt('runup', null);
const HOUR = opt('hour', 'golden');
const q = [DUST_ON ? null : 'dust=0', GFX ? 'gfx=' + GFX : null].filter(Boolean).join('&');
const URL0 = opt('url', 'http://localhost:8450/flyDiy/dev.html');
const URL = q ? URL0 + (URL0.includes('?') ? '&' : '?') + q : URL0;
const ARM = (DUST_ON ? 'dust' : 'nodust') + '_' + (GFX || 'default') + (RUNUP ? '_runup_' + RUNUP : '');
const PORT = 9400 + (process.pid % 500);
const CHROME = [opt('chrome', null), 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => p && fs.existsSync(p));
if (!CHROME) { console.error('dust_shots: no Chrome'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const say = s => console.log('dust_shots: ' + s);

// the in-page sampler: every rAF's interval and the dust's numbers, from start() to stop()
const SAMPLER = `(() => { if (window.__dustS) return 1;
  const S = window.__dustS = { on: false, t: [], ms: [], puffs: [], grit: [], cover: [], last: 0 };
  const tick = now => { requestAnimationFrame(tick); if (S.on && S.last) { S.t.push(now - S.last);
    const F = window.DUST_FX && DUST_FX.fx; S.ms.push(F ? F.ms : 0); S.puffs.push(F ? F.sys.P.live : 0); S.grit.push(F ? F.sys.G.live : 0); S.cover.push(F ? F.draw.cover : 0); }
    S.last = now; };
  requestAnimationFrame(tick); return 1; })()`;

// ---- THE RUN-UP ON A REAL STRIP (--runup) ---------------------------------------------------------------------------------
const key = async (cmd, code, k, vk, holdMs) => { await cmd('Input.dispatchKeyEvent', { type: 'rawKeyDown', code, key: k, windowsVirtualKeyCode: vk });
  if (holdMs) await sleep(holdMs); await cmd('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: vk }); };
async function runup(ev, cmd, shot, rec) {
  const W = require(path.join(__dirname, 'island_node.js')).islandWorld('jolene', { premises: fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8') });
  const A = W.aerodromes.find(a => a.id === RUNUP);
  if (!A) throw new Error('no strip ' + RUNUP);
  const D = [Math.cos(A.hdg), Math.sin(A.hdg)], u = Math.min(40, A.len * 0.3), at = [A.x + D[0] * (u - A.len / 2), A.z + D[1] * (u - A.len / 2)];
  rec.runup = { strip: RUNUP, at, hdg: A.hdg, len: A.len };
  const where = await ev(`(async () => {
    const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
    const s = FLIGHT_PROBE.sim(), w = FLIGHT_PROBE.world(), at = ${JSON.stringify(at)};
    const cg = s.cgPos(), gy = w.terrainH(at[0], at[1]) + 1.2;
    await FLIGHT_PROBE.place({ by: [at[0] - cg[0], gy - cg[1], at[1] - cg[2]], zeroV: true });
    if (window.DAY_CLOCK && DAY_CLOCK.preset) DAY_CLOCK.preset(${JSON.stringify(HOUR)});
    const t = document.getElementById('bPause'); if (t) t.click();
    await new Promise(r => setTimeout(r, 2500));
    FLIGHT_PROBE.setManual(true, 'rig');
    return JSON.stringify(s.cgPos().map(v => Math.round(v)));
  })()`);
  say(ARM + ' on ' + RUNUP + ' at ' + where);
  // the eyes: backlit (the eye on the sun's far side of the aeroplane) and from the side, low
  const sunAz = await ev("(()=>{const d=window.DAY_CLOCK&&DAY_CLOCK.day&&DAY_CLOCK.day();const v=d&&d.sun;return v?Math.atan2(-v[2],-v[0]):0})()");
  await key(cmd, 'KeyP', 'p', 80, 60);                 // the parking brake
  await key(cmd, 'Home', 'Home', 36, 60);              // full throttle
  await ev('(window.__dustS.on=true,window.__dustS.t.length=0,1)');
  await sleep(4000); await ev('FLIGHT_PROBE.camSet(' + sunAz + ',0.10,22),1'); await sleep(800); await shot('runup_backlit');
  await sleep(3000); await ev('FLIGHT_PROBE.camSet(' + (sunAz + Math.PI / 2) + ',0.08,26),1'); await sleep(800); await shot('runup_side');
  await sleep(4000); await ev('FLIGHT_PROBE.camSet(' + (sunAz + 0.5) + ',0.16,40),1'); await sleep(800); await shot('runup_wide');
  rec.thr = await ev("(()=>{const s=FLIGHT_PROBE.sim();return s&&s.ctl?{thr:s.ctl.thr,brake:s.ctl.brake,wash:s.out&&s.out.wash}:null})()");
  await key(cmd, 'End', 'End', 35, 60);                // idle
  await sleep(10000); await ev('FLIGHT_PROBE.camSet(' + sunAz + ',0.12,45),1'); await sleep(800); await shot('runup_after10');
  await ev('(window.__dustS.on=false,1)');
  say(ARM + ' run-up ' + JSON.stringify(rec.thr));
  const S = await ev('(()=>{const S=window.__dustS;return {t:S.t,ms:S.ms,puffs:S.puffs}})()');
  const b = S.t.slice().sort((x, y) => x - y); rec.frame = { n: b.length, median: b[b.length >> 1], p99: b[Math.floor(b.length * 0.99)] };
  rec.puffsMax = Math.max(0, ...S.puffs);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT + '_' + ARM + '.json', JSON.stringify(rec, null, 1));
  say('wrote ' + OUT + '_' + ARM + '.json');
}

(async () => {
  const raw = JSON.parse(fs.readFileSync(path.isAbsolute(BUILD) ? BUILD : path.join(ROOT, BUILD), 'utf8'));
  const spec = raw.spec || raw;
  const udd = path.join(require('os').tmpdir(), 'cdp_dust_' + PORT + '_' + Date.now());
  const T0 = Date.now();
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
    '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync',
    '--no-proxy-server', '--no-sandbox', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) { try { ch.kill(); } catch (e2) {} } };
  const rec = { arm: ARM, url: URL, build: BUILD, cls: CLS, soil: SOIL, at: new Date().toISOString() };
  try {
    let tgt = null;
    for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    const LOG = argv.includes('--log');
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).split('\n').slice(0, 3).join(' | '));
      if (LOG && m.method === 'Runtime.consoleAPICalled') console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 600)); };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text))); return r.result.result.value; };
    const shot = async v => { if (!STILLS) return; const s = await cmd('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      const f = OUT + '_' + ARM + '_' + v + '.png'; fs.writeFileSync(f, Buffer.from(s.result.data, 'base64')); say('wrote ' + f); };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.clear();}catch(e){}' });
    await cmd('Page.navigate', { url: URL });
    const ready = '(window.BOOT && BOOT.state === "gone" && window.GARAGE_SPEC && window.FLIGHT_PROBE && !(window.CAGE_CREW_PENDING && CAGE_CREW_PENDING()))';
    let up = false;
    for (let i = 0; i < 900 && !up; i++) { await sleep(2000); up = await ev(ready).catch(() => false); }
    if (!up) throw new Error('the page never finished booting');
    say(ARM + ' booted in ' + Math.round((Date.now() - T0) / 1000) + ' s');
    await sleep(3000);
    await ev('(()=>{window.GARAGE_SPEC.set(' + JSON.stringify(spec) + ');return 1})()');
    { let last = null, same = 0;
      for (let i = 0; i < 300; i++) { await sleep(2000); const sx = await ev(ready + ' ? JSON.stringify(GARAGE_SPEC.get()) : null').catch(() => null);
        if (!sx) continue; if (sx === last) { if (++same >= 2) break; } else { last = sx; same = 0; } } }
    await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());return 1})()");
    // THE ROLL-OUT
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) {
      await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
      await sleep(6000);
      flying = await ev("(()=>{try{const ap=FLIGHT_PROBE.ap();return !!(ap&&ap.phase)}catch(e){return false}})()");
    }
    if (!flying) throw new Error('the roll-out never happened');
    // the rig's dials: the frame uncapped, the surface and the soil (printed: neither is the game's default)
    rec.rig = await ev(`(()=>{const o={};
      try{ if(window.GFX&&GFX.set){GFX.set('fps','off');o.fps='off';} }catch(e){o.fps='err '+e.message}
      try{ ${SOIL === 'none' ? '' : 'if(window.SOIL_WET){SOIL_WET.force=' + (+SOIL) + ';o.soil=SOIL_WET.force;}'} }catch(e){o.soil='err'}
      try{ const F=window.DUST_FX&&DUST_FX.make&&DUST_FX.make(); o.dust=!!F; o.tier=F?F.sys.tierName:null;
           ${CLS === 'none' ? '' : 'if(F){const ci=window.DUST.CLASSES.indexOf(' + JSON.stringify(CLS) + ');F.env.cls=()=>ci;o.cls=' + JSON.stringify(CLS) + ';}'} }catch(e){o.dust='err '+e.message}
      return o})()`);
    say(ARM + ' rig ' + JSON.stringify(rec.rig));
    await ev(SAMPLER);
    if (RUNUP) { await runup(ev, cmd, shot, rec); ws.close(); return; }
    // THE TAKE-OFF, sampled: the frame record from 5 s before the roll to 25 s after the lift-off
    const t0 = Date.now(); let last = null, liftT = 0, rollT = 0, sMid = false, shots = new Set();
    await ev('(window.__dustS.on=true,window.__dustS.t.length=0,1)');
    rec.trace = [];
    while (Date.now() - t0 < AIR_MAX) {
      const s = await ev("(()=>{const ap=FLIGHT_PROBE.ap(),sim=FLIGHT_PROBE.sim();return {ph:ap.phase,ias:sim&&sim.out?(sim.out.ias!=null?sim.out.ias:sim.out.V):null}})()");
      if (s.ph !== last) { rec.trace.push([((Date.now() - t0) / 1000).toFixed(1), s.ph, s.ias]); last = s.ph; say(ARM + ' ' + s.ph + ' ias=' + s.ias); }
      if (s.ph === 'ROLL' && !rollT) { rollT = Date.now(); if (!shots.has('roll')) { shots.add('roll'); await ev('FLIGHT_PROBE.camSet(0.9,0.12,16),1'); await sleep(1500); await shot('roll'); } }
      if (rollT && !liftT && !sMid && s.ias > 12) { sMid = true; await ev('FLIGHT_PROBE.camSet(' + (Math.PI / 2) + ',0.08,26),1'); await sleep(600); await shot('run'); }
      if (s.ph === 'LIFTOFF' && !liftT) { liftT = Date.now(); await ev('FLIGHT_PROBE.camSet(1.2,0.1,24),1'); await shot('liftoff'); }
      if (liftT && Date.now() - liftT > 8000 && !shots.has('back8')) { shots.add('back8'); await ev('FLIGHT_PROBE.camSet(' + (Math.PI - 0.25) + ',0.12,45),1'); await sleep(800); await shot('back8'); }
      if (liftT && Date.now() - liftT > 20000 && !shots.has('back20')) { shots.add('back20'); await ev('FLIGHT_PROBE.camSet(' + (Math.PI - 0.15) + ',0.1,90),1'); await sleep(800); await shot('back20'); }
      if (liftT && Date.now() - liftT > 25000) break;
      await sleep(100);
    }
    await ev('(window.__dustS.on=false,1)');
    // THE NUMBERS
    const S = await ev('(()=>{const S=window.__dustS;return {t:S.t,ms:S.ms,puffs:S.puffs,grit:S.grit,cover:S.cover}})()');
    const st = a => { const b = a.slice().sort((x, y) => x - y), n = b.length; const p = k => b[Math.min(n - 1, Math.floor(n * k))];
      return n ? { n, median: +p(0.5).toFixed(2), p90: +p(0.9).toFixed(2), p99: +p(0.99).toFixed(2), max: +b[n - 1].toFixed(2) } : { n: 0 }; };
    rec.frame = st(S.t); rec.frame.over50 = S.t.filter(x => x > 50).length; rec.frame.over100 = S.t.filter(x => x > 100).length;
    rec.dustMs = st(S.ms); rec.puffs = st(S.puffs); rec.grit = st(S.grit); rec.cover = st(S.cover);
    rec.liftSeen = !!liftT;
    say(ARM + ' FRAME ms ' + JSON.stringify(rec.frame) + ' | dust ms ' + JSON.stringify(rec.dustMs) + ' | puffs ' + JSON.stringify(rec.puffs) + ' | cover ' + JSON.stringify(rec.cover));
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT + '_' + ARM + '.json', JSON.stringify(rec, null, 1));
    say('wrote ' + OUT + '_' + ARM + '.json');
    ws.close();
  } finally {
    kill();
    try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error('dust_shots: ' + e.message); process.exit(1); });
