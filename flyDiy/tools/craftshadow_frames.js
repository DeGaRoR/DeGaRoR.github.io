#!/usr/bin/env node
// craftshadow_frames.js - CRAFT-SHADOW (G1410): N CONSECUTIVE GAME FRAMES OF THE PARKED AEROPLANE, drawn by hand in headless
// Chrome on SwiftShader (deterministic software GL - the same inputs give the same pixels), so a frame-to-frame difference
// is the page's own doing. The game is rolled out to HOME's stand (?simw=0: the solver inline, stepped by the page's
// loop), then the page's requestAnimationFrame is HELD: each step calls the loop's queued callbacks once (one game frame,
// G586's rig clock: one solver step a call) and reads the canvas in the same task. The post stack is off (the graphics
// row POST_OFF) so a pixel is the scene's.
//   node tools/craftshadow_frames.js --out <dir> [--hour golden|noon] [--frames 8] [--every 15] [--cam az,el,dist]
//        [--size 800x450] [--js '<expr run before the strip>'] [--taxi 1] [--tag before]
// --every k: k game frames between two captures (k / 60 s of game time at the rig clock); the strip is frames
// <tag>_<hour>_<i>.png, and <tag>_<hour>.json the per-capture inputs (the near light's sun, the cascade aim, drawn or not).
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const OUT = opt('out', path.join(__dirname, 'perf', 'craftshadow')), HOUR = opt('hour', 'golden'), N = +opt('frames', 8), EVERY = +opt('every', 15);
const CAM = opt('cam', '2.6,0.32,13').split(',').map(Number), SIZE = opt('size', '800x450').split('x').map(Number), TAG = opt('tag', 'run');
const PAGE = opt('page', 'index.html'), PORT = +opt('port', 8731), JS = opt('js', ''), TAXI = opt('taxi', '0') === '1';
let pw; try { pw = require('playwright'); } catch (e) { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(PORT), path.join(__dirname, '..', '..')], { stdio: 'ignore' });
  await sleep(800);
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
  const browser = await pw.chromium.launch({ executablePath: exe, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
  const page = await browser.newPage({ viewport: { width: SIZE[0], height: SIZE[1] } });
  const t0 = Date.now(), el = () => Math.round((Date.now() - t0) / 1000) + ' s';
  page.on('pageerror', e => console.log('pageerror:', e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 200)); });
  await page.addInitScript(() => {
    try { localStorage.setItem('flydiy.gfx', JSON.stringify({ pv: 6, preset: 'custom', shadows: 'full', bloom: 'off', look: 'off', lens: 'off', rays: 'off', ao: 'off', eye: 'off', compositing: 'linear', fps: 30, scale: 1, aa: 'off' })); } catch (e) {}
    // THE HOLD: once the roll-out's trip is done, the page's frames are queued and drawn only by window.__step
    // every callback goes through __rafQ from the first script on; a pump on the real rAF runs the queue until the hold
    const raf = window.requestAnimationFrame.bind(window);
    window.__rafQ = []; window.__ts = 0; window.__held = false; let id = 1;
    const done = () => { const T = window.FLYDIY_TRIPS, t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && window.BOOT && window.BOOT.state === 'gone'); };
    const dead = new Set();
    window.__reqs = {}; window.__cancels = [];
    window.requestAnimationFrame = cb => { const nm = cb.name || '?'; if (!window.__reqs[nm]) window.__reqs[nm] = { n: 0, st: new Error().stack.slice(0, 600) }; window.__reqs[nm].n++; cb.__id = id; window.__rafQ.push(cb); return id++; };
    window.cancelAnimationFrame = k => { dead.add(k); if (window.__cancels.length < 50) window.__cancels.push(k + ' ' + new Error().stack.split('\n')[2]); };
    window.__runs = {}; window.__errs = [];
    const run = (q, ts) => { for (const cb of q) { if (dead.has(cb.__id)) { dead.delete(cb.__id); continue; } const nm = cb.name || '?'; window.__runs[nm] = (window.__runs[nm] || 0) + 1;
      try { cb(ts); } catch (e) { window.__errs.push(nm + ': ' + (e && e.stack || e).toString().slice(0, 400)); if (window.__errs.length > 20) window.__errs.shift(); } } };
    const pump = ts => {
      if (!window.__held && window.__wantHold && done()) { window.__held = true; window.__ts = ts; }
      if (!window.__held) { const q = window.__rafQ; window.__rafQ = []; run(q, ts); }
      raf(pump);
    };
    raf(pump);
    window.__step = n => { for (let i = 0; i < n; i++) { const q = window.__rafQ; window.__rafQ = []; window.__ts += 1000 / 60; run(q, window.__ts); } return window.__rafQ.length; };
  });
  const ev = async (x, t) => { try { return await page.evaluate(x); } catch (e) { return 'ERR ' + e.message.split('\n')[0]; } };
  await page.goto('http://127.0.0.1:' + PORT + '/flyDiy/' + PAGE + '?simw=0', { waitUntil: 'load', timeout: 300000 });
  // the garage's boot is done when its first frame has run the page's loop (the overlay hides earlier: a roll-out pressed
  // before that deadlocks - the trip's first light waits on frames from a loop that is not started yet)
  for (let i = 0; i < 600; i++) { await sleep(2000); if (await ev("!!(window.BOOT && BOOT.state === 'gone' && document.getElementById('bGo') && window.__reqs && window.__reqs.loop && BOOT.log.some(e => e.k === 'step' && e.id === 'firstFrame'))") === true) break; }
  await sleep(5000);
  console.log('garage', el());
  await ev("(window.__wantHold = true, document.getElementById('bGo').click(), 1)");
  for (let i = 0; i < 600; i++) { await sleep(2000); if (await ev('window.__held') === true) break; if (i % 30 === 0) console.log('  rollout', el(), await ev("(()=>{const T=window.FLYDIY_TRIPS,t=T&&T[T.length-1];return t?t.kind+':'+t.done+' '+BOOT.state:'-'})()")); }
  console.log('held', el());
  if (opt('serve') && !flag('after')) {   // keep the page: POST /eval <expr> -> its value; GET /quit
    const http = require('http');
    await new Promise(res => http.createServer(async (q, r) => { let b = ''; q.on('data', d => b += d); q.on('end', async () => {
      if (q.url === '/quit') { r.end('bye'); res(); return; }
      const v = await ev(b); r.end(typeof v === 'string' ? v : JSON.stringify(v)); }); }).listen(+opt('serve')));
    await browser.close(); srv.kill(); process.exit(0);
  }
  // the view: the hour, the camera, the light's ease and the probe fade cut (a still, not a transition)
  // parked, engine off (the user's case): the hand on the controls (the AP would taxi on), the key off; unless --taxi
  if (!TAXI) console.log('parked', await ev(`(() => { const FP = FLIGHT_PROBE, sim = FP.sim(); FP.setManual(true); (sim.eng || []).forEach((e, i) => sim.setEngine(i, { key: 'off' })); return JSON.stringify(sim.eng.map(e => e.key + ':' + e.running)); })()`));
  // --at pin: the aeroplane put on FRAMECOST's taxi pin (open taxiway, 420 m from the stand), as the line-up skip places it
  if (opt('at') === 'pin') console.log('placed', await ev(`(() => { const FP = FLIGHT_PROBE, sim = FP.sim(), ap = FP.ap(), def = FP.def(), world = FP.world(), from = ap && ap.route && ap.route.from;
    const pose = { x: 263.5, z: 727.6, hdg: 0.716 }; sim.reset(0); if (typeof sim.stance === 'function') sim.stance(); window.placeAtLineup(sim, from, pose, world, def.refs); return JSON.stringify(sim.cgPos()); })()`));
  console.log(await ev(`(() => { const CK = DAY_CLOCK; if (${/^[0-9.]+$/.test(HOUR) ? 1 : 0}) CK.set({ localHours: ${+HOUR || 0} }); else CK.preset(${JSON.stringify(HOUR)}); if (window.LIGHT_EASE) LIGHT_EASE.on = false; FLIGHT_PROBE.camMode && FLIGHT_PROBE.camMode('orbit'); FLIGHT_PROBE.camSet(${CAM.join(',')}); return CK.label(); })()`));
  if (TAXI) await ev("(document.getElementById('bGo') && document.getElementById('bGo').click(), 1)");
  if (JS) console.log('js', await ev(JS));
  for (let i = 0; i < +opt('settle', 12); i++) { await ev('(FLIGHT_PROBE.camSet(' + CAM.join(',') + '), window.__step(5))'); }
  console.log('settled', el(), await ev('DAY_CLOCK.label()'));
  const rows = [];
  for (let i = 0; i < N; i++) {
    const r = await ev(`(() => { window.__step(${EVERY} - 1); FLIGHT_PROBE.camSet(${CAM.join(',')});
      const SN = SHADOW_NEAR, L = SN.AIM.L; let drawn = 0; const um = L.shadow.updateMatrices; L.shadow.updateMatrices = function () { drawn++; return um.apply(this, arguments); };
      window.__step(1); L.shadow.updateMatrices = um;
      const png = FLIGHT_PROBE.renderer().domElement.toDataURL('image/png');
      const s = [L.position.x - L.target.position.x, L.position.y - L.target.position.y, L.position.z - L.target.position.z], n = Math.hypot(...s);
      const M1 = THREE.ShaderLib.standard.uniforms.uNearM1.value.elements;
      return JSON.stringify({ png, sun: s.map(v => v / n), tgt: [SN.C1.tgt.x, SN.C1.tgt.y, SN.C1.tgt.z], H: SN.C1.H, m1: Array.from(M1).slice(0, 4), drawn, label: DAY_CLOCK.label(), cg: FLIGHT_PROBE.sim().cgPos(), cache: SN.CACHE ? Object.assign({}, SN.CACHE.stat) : null }); })()`);
    let o; try { o = JSON.parse(r); } catch (e) { console.log('frame', i, r.slice(0, 300)); continue; }
    fs.writeFileSync(path.join(OUT, `${TAG}_${HOUR}_${i}.png`), Buffer.from(o.png.split(',')[1], 'base64'));
    delete o.png; rows.push(o); console.log('frame', i, el(), JSON.stringify(o).slice(0, 400));
  }
  fs.writeFileSync(path.join(OUT, `${TAG}_${HOUR}.json`), JSON.stringify(rows, null, 1));
  if (opt('serve') && flag('after')) {   // --serve P --after: the strip first, then the page kept for more
    const http = require('http');
    console.log('serving');
    await new Promise(res => http.createServer(async (q, r) => { let b = ''; q.on('data', d => b += d); q.on('end', async () => {
      if (q.url === '/quit') { r.end('bye'); res(); return; }
      const v = await ev(b); r.end(typeof v === 'string' ? v : JSON.stringify(v)); }); }).listen(+opt('serve')));
  }
  await browser.close(); srv.kill();
})().catch(e => { console.error('craftshadow_frames:', e.stack); process.exit(1); });
