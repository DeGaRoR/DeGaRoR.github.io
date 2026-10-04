#!/usr/bin/env node
// THE ANIMALS' VOICES IN THE GAME - THE BOX'S RIG (G1709, SND-ANIMALS). For the Coordinator, on the box: a cloud session
// cannot render the world, so this is the evidence it could not take. UNRUN BY ITS AUTHOR (written in the cloud, against
// island_shot.js's rig, FLIGHT_PROBE, DAY_CLOCK and AUDIO as they are in the tree).
//
//   node tools/audio/animals_box.js [--url "http://localhost:8430/flyDiy/dev.html?world=jolene"] [--only=orca,elk]
//        [--out reports/evidence/SND-ANIMALS/box] [--boot 20000]
//
// Headless Chrome (island_shot.js's: this machine's Chrome, the GPU), the game rolled out on Jolene, ONE gesture (a real
// pointer press through CDP: the audio context is made on the first gesture), then the five scenes of
// tools/audio/animals_render.js - the same paths, computed here from the same record (the orca pod, the elk meadow at
// dusk, the low passes beside the bear, the dock's gull flock, the walk to the Kennecott mill). For each scene:
//   - the day's clock set (DAY_CLOCK.set({ localHours }));
//   - the AEROPLANE carried along the path: FLIGHT_PROBE.place({ at, zeroV }) every 100 ms (never paused: a paused game
//     stops the premises' tick - the animals - and silences the audio), the chase camera behind it;
//   - the page's master bus RECORDED (AUDIO.bus('master') -> a MediaStreamDestination -> MediaRecorder, Opus in WebM):
//     the whole mix as the player hears it (the engine too: set --quiet-engine to turn the aircraft bus down);
//   - the emitters' calls logged (EMITTERS.state.log: [t, sound, x, y, z, d]) and the animals' census every second
//     (WORLD.premises.animals(): species, state, depth, distance).
// Out: <out>/<scene>.webm, <out>/box.json (calls, census, the page's AUDIO state), printed per scene.
// What to listen for: reports/evidence/SND-ANIMALS/README.md (the same scenes; the pod's surfacings here are the page's
// own, not timed to the pass: three passes give two or three chances).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const URL = opt('url', 'http://localhost:8430/flyDiy/dev.html?world=jolene');
const OUT = path.join(ROOT, opt('out', 'reports/evidence/SND-ANIMALS/box'));
const ONLY = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('animals_box: no Chrome'); process.exit(2); }

// the scenes: animals_render.js's paths on the same record (node's Jolene: the heights above the same ground)
const AR = require('./ambience_render.js');
const AN = require('./animals_render.js');
const W = AR.loadJolene(), SPOTS = AN.spotsOf(W);
const DUR = { orca: 120, elk: 180, bear: 120, gulls: 90, mill: 45 };
const SCENES = AN.scenes(W, SPOTS).map(([key, name, hours, , , pathOf]) => {
  // the pod: three passes (the page's pod surfaces on its own clock), 40 s each
  const p = key === 'orca' ? (t => pathOf(t % 40)) : pathOf;
  return { key, name, hours, dur: DUR[key], path: t => { const q = p(t); const g = Math.max(W.terrainH(q[0], q[1]), W.waterH(q[0], q[1])); return [q[0], g + q[2], q[1]]; } };
}).filter(s => !ONLY.length || ONLY.includes(s.key));

const udd = path.join(require('os').tmpdir(), 'cdp_animals_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1280,720', '--hide-scrollbars', '--no-first-run',
  '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split('\n').slice(0, 3).join(' | ')); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception || r.result.exceptionDetails.text))); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.navigate', { url: URL });
  await sleep(+opt('boot', 20000));
  // the roll-out (island_shot.js's: the button, then the phase word and the sim)
  let flying = false;
  for (let a = 0; a < 8 && !flying; a++) {
    await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
    await sleep(6000);
    flying = await ev("/TAXI|DOWNWIND|FINAL/.test(document.body.innerText) && typeof FLIGHT_PROBE !== 'undefined' && !!FLIGHT_PROBE.sim()");
  }
  if (!flying) throw new Error('the roll-out never happened');
  for (let i = 0; i < 100; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'").catch(() => 'none'); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
  // THE GESTURE: a real press (the context is made on it), then the audio settings this rig needs
  for (const type of ['mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x: 640, y: 360, button: 'left', clickCount: 1 });
  await sleep(1500);
  const aud = await ev(`(()=>{ if (!window.AUDIO || !AUDIO.enabled) return 'no audio';
    try { AUDIO.set('muteUnfocused', 0); if (${argv.includes('--quiet-engine')}) AUDIO.set('aircraft', 0.15); } catch (e) {}
    if (FLIGHT_PROBE.camMode) FLIGHT_PROBE.camMode('chase');
    return JSON.stringify({ state: AUDIO.state, ctx: !!AUDIO.ctx, emitters: !!window.EMITTERS, anim: !!(window.WORLD && WORLD.premises && WORLD.premises.animalSounds) }); })()`);
  console.log('animals_box: audio ' + aud);
  fs.mkdirSync(OUT, { recursive: true });
  const out = { url: URL, audio: aud, scenes: [] };
  for (const S of SCENES) {
    console.log('scene ' + S.key + ': ' + S.name + ' (' + S.dur + ' s, ' + S.hours + ' h)');
    await ev(`(()=>{ DAY_CLOCK.set({ localHours: ${S.hours} }); if (window.EMITTERS) EMITTERS.state.log = []; return 1; })()`);
    const p0 = S.path(0);
    await ev(`FLIGHT_PROBE.place({ at: [${p0[0]}, ${p0[1]}, ${p0[2]}], zeroV: true }).then(() => 1)`);
    await sleep(2500);   // the streamer settles round the new place
    await ev(`(()=>{ const c = AUDIO.ctx, d = c.createMediaStreamDestination(); AUDIO.bus('master').connect(d);
      const r = new MediaRecorder(d.stream, { mimeType: 'audio/webm;codecs=opus' }); window.__animRec = { r, d, chunks: [], census: [], t0: performance.now() };
      r.ondataavailable = e => { if (e.data && e.data.size) __animRec.chunks.push(e.data); }; r.start(1000);
      if (window.EMITTERS) EMITTERS.state.log = []; return 1; })()`);
    const t0 = Date.now();
    let lastCensus = -1;
    while ((Date.now() - t0) / 1000 < S.dur) {
      const t = (Date.now() - t0) / 1000, q = S.path(t);
      await ev(`FLIGHT_PROBE.place({ at: [${q[0].toFixed(2)}, ${q[1].toFixed(2)}, ${q[2].toFixed(2)}], zeroV: true }).then(() => 1)`);
      if (Math.floor(t) !== lastCensus) {
        lastCensus = Math.floor(t);
        await ev(`(()=>{ const R = WORLD.premises, a = R && R.animals ? R.animals() : [], e = [${q[0]}, ${q[1]}, ${q[2]}];
          __animRec.census.push({ t: ${lastCensus}, near: a.map(o => ({ key: o.key, id: o.id, state: o.state, depth: +(o.depth || 0).toFixed(1), d: Math.round(Math.hypot(o.x - e[0], o.y - e[1], o.z - e[2])) })).filter(o => o.d < 1600) }); return 1; })()`);
      }
      await sleep(100);
    }
    const rec = await ev(`new Promise(res => { const A = __animRec; A.r.onstop = async () => {
        const b = new Blob(A.chunks, { type: 'audio/webm' }), u8 = new Uint8Array(await b.arrayBuffer());
        let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        try { AUDIO.bus('master').disconnect(A.d); } catch (e) {}
        res(JSON.stringify({ b64: btoa(s), census: A.census, log: window.EMITTERS ? EMITTERS.state.log : [] })); };
      A.r.stop(); })`);
    const R = JSON.parse(rec);
    fs.writeFileSync(path.join(OUT, S.key + '.webm'), Buffer.from(R.b64, 'base64'));
    const calls = {}; for (const c of R.log) calls[c[1]] = (calls[c[1]] || 0) + 1;
    console.log('  ' + S.key + '.webm ' + Math.round(R.b64.length * 0.75 / 1024) + ' KB; calls ' + JSON.stringify(calls));
    out.scenes.push({ key: S.key, name: S.name, hours: S.hours, seconds: S.dur, calls: R.log, census: R.census });
  }
  fs.writeFileSync(path.join(OUT, 'box.json'), JSON.stringify(out, null, 1));
  console.log('animals_box: wrote ' + OUT);
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('animals_box: ' + e.message); ch.kill(); process.exit(1); });
