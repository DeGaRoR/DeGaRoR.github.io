// rollout_sound_evidence.js - THE ROLL-OUT SHOT, RECORDED ON THE REAL PAGE (G1717, SND-ROLLOUT; for the Coordinator's box:
// cloud sessions cannot render the game)
//
//   node tools/_serve.js 8450 ..        (from flyDiy/, in another terminal)
//   node tools/perf/rollout_sound_evidence.js [--url http://localhost:8450/flyDiy/dev.html] [--out reports/evidence/SND-ROLLOUT/page]
//        [--builds cub,jodel,cessna,twin582] [--solo] [--after 4000] [--swgl] [--log]
//
// boombox_evidence.js's rig (headless Chrome on this machine's GPU, CDP; --swgl: SwiftShader). For each build: the page
// booted, the build put in the shed (GARAGE_SPEC.set - the door a new aeroplane enters by; there is no .apply), the sound unlocked by a REAL click on the
// render (the gesture), the page's own mix TAPPED - AUDIO.bus('master') into a MediaStreamDestination and a MediaRecorder
// (the master bus after the volumes: what the speakers get, before the soft limiter) - then "Roll out" pressed with a real
// mouse click: the sync screen, THE SHOT (start, check, roll), the cut to the stand, and --after ms of the stand (the
// handover: the engine must idle on across the cut, no dip, no second catch). --solo plays the shot alone in the shed
// (window.FLYDIY_ROLLANIM: no world, every field put back after - the engine must wind down, no catch, no starter left).
// Written per build: <build>_page.webm (+ .ogg when ffmpeg is here), <build>_page.json - the shot's own fields every frame
// (phase, sim.eng key / crank / running, sim.out.rpm / rpmEng, ctl.thr, the space's shotPose, AUDIO.params' engine rpm /
// running / crank as the voices read them) and the times (the click, the shot's start, its end, the reveal).
// Reading the page is all the script does besides the clicks: the shot is the app's own.
'use strict';
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const URL0 = opt('url', 'http://localhost:8450/flyDiy/dev.html');
const OUT = path.resolve(ROOT, opt('out', path.join('reports', 'evidence', 'SND-ROLLOUT', 'page')));
const AFTER = +opt('after', 4000);
const SOLO = argv.includes('--solo'), LOG = argv.includes('--log');
const FILES = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json', twin582: 'tools/fixtures/build_v7_ultralight_2026-09-05.json' };
const BUILDS = opt('builds', 'cub,jodel,cessna,twin582').split(',').filter(k => FILES[k]);
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('rollout_sound_evidence: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_rs_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox']
  .concat(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [])
  .concat(argv.includes('--swgl') ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []).concat(['about:blank']), { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });

// IN THE PAGE, before its scripts: the sound stays up in a headless window (mute when unfocused: off), and the shot's
// fields are logged each frame - ROLLANIM.play wrapped once rollanim.js publishes it (the app holds the same object)
const HOOK = `(() => {
  try { localStorage.setItem('flydiy.audio.muteUnfocused', '0'); localStorage.setItem('flydiy.audio', '1'); } catch (e) {}
  const L = window.__RSND = { rows: [], marks: {}, t0: 0 };
  const now = () => performance.now();
  let ra = null;
  Object.defineProperty(window, 'ROLLANIM', { configurable: true, get() { return ra; }, set(v) {
    ra = v; if (!v || v.__wrapped) return; v.__wrapped = 1;
    const play = v.play;
    v.play = function (o) {
      L.marks.play = now(); L.handover = !!(o && o.handover); L.havePose = !!(o && o.audioPose);
      const od = o.onDone; o.onDone = h => { L.marks.done = now(); L.skipped = h && h.skipped; if (od) od(h); };
      const h = play.call(this, o); L.plan = h && h.plan ? { start: h.plan.start.T, check: h.plan.check.T, roll: h.plan.T.T, total: h.plan.Ttotal,
        engines: h.plan.start.engines.map(e => ({ kind: e.kind, method: e.method, tGo: e.tGo, tCatch: e.tCatch })) } : null;
      const sim = o.sim, pose = o.audioPose;
      const tickLog = () => {
        if (L.marks.stop) return;
        const P = window.AUDIO && AUDIO.params, n = sim && sim.eng ? sim.eng.length : 0, r = { t: +(now() - L.marks.play).toFixed(1), ph: h.done ? 'done' : h.phase,
          thr: sim.ctl.thr, eng: [], pose: pose ? Array.from(pose).map(x => +x.toFixed(3)) : null, garage: !!(window.FLYDIY_HOLDS && FLYDIY_HOLDS().inGarage) };
        for (let i = 0; i < n; i++) r.eng.push({ key: sim.eng[i].key, crank: +(+sim.eng[i].crank).toFixed(3), run: !!sim.eng[i].running,
          rpm: +((sim.out.rpm || [])[i] || 0).toFixed(1), rpmEng: +((sim.out.rpmEng || [])[i] || 0).toFixed(1),
          heard: P ? { rpmEng: +P.rpmEng[i].toFixed(1), running: P.running[i], crank: +P.crank[i].toFixed(3), thr: +P.thr[i].toFixed(3) } : null });
        L.rows.push(r);
        requestAnimationFrame(tickLog);
      };
      requestAnimationFrame(tickLog);
      return h;
    };
  } });
})();`;

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
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text))); return r.result.result.value; };
  const mouse = (type, x, y, extra) => cmd('Input.dispatchMouseEvent', Object.assign({ type, x, y, button: 'none', buttons: 0, pointerType: 'mouse' }, extra || {}));
  const click = async (x, y) => { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 }); await sleep(60); await mouse('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 }); };
  const centre = sel => ev("(()=>{const e=document.querySelector(" + JSON.stringify(sel) + ");if(!e||!e.offsetParent)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()");
  const until = async (expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(expr)) return true; } catch (e) {} await sleep(250); } return false; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  fs.mkdirSync(OUT, { recursive: true });
  const summary = { url: URL0, solo: SOLO, builds: {} };
  for (const key of BUILDS) {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, FILES[key]), 'utf8')), spec = raw.spec || raw;
    console.log('rollout_sound_evidence: ' + key + ' - booting');
    await cmd('Page.navigate', { url: URL0 });
    if (!await until("!!(window.GARAGE_SPEC && window.AUDIO && (!window.BOOT || BOOT.state === 'gone') && window.FLYDIY_HOLDS && FLYDIY_HOLDS().inGarage)", 600000)) throw new Error('the garage never came up');
    await sleep(4000);
    const keep = await centre('.dfClose'); if (keep) { await click(keep.x, keep.y); await sleep(1500); }
    // the build, through the editor's own door; then the shed settles
    await ev('GARAGE_SPEC.set(' + JSON.stringify(spec) + '), true');
    await sleep(8000);
    // THE GESTURE: a real click on the render (the sound's unlock), then the page's mix tapped
    const v = await ev("(()=>{const e=document.getElementById('edView')||document.getElementById('c');const r=e.getBoundingClientRect();return {x:Math.round(r.left+r.width*0.5),y:Math.round(r.top+r.height*0.15)}})()");
    await click(v.x, v.y); await sleep(300);
    await mouse('mouseMoved', 5, 5);
    if (!await until("window.AUDIO && AUDIO.state === 'running' && !!AUDIO.ctx", 20000)) throw new Error('the sound never unlocked (AUDIO.state ' + await ev('window.AUDIO && AUDIO.state') + ')');
    await ev(`(() => { const c = AUDIO.ctx, d = c.createMediaStreamDestination(); AUDIO.bus('master').connect(d);
      const rec = new MediaRecorder(d.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 }), parts = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
      window.__RSND.rec = rec; window.__RSND.parts = parts; window.__RSND.dest = d; rec.start(250); window.__RSND.marks.rec = performance.now(); return true; })()`);
    await sleep(1500);   // a beat of the shed before the press (its ambience: the baseline)
    // THE PRESS: Roll out (a real click), or the shot alone
    if (SOLO) await ev('window.__RSND.marks.click = performance.now(), window.FLYDIY_ROLLANIM(), true');
    else {
      const b = await centre('#bGo') || await ev("(()=>{const l=[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)&&b.offsetParent);if(!l.length)return null;const r=l[0].getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()");
      if (!b) throw new Error('no Roll out button');
      await ev('window.__RSND.marks.click = performance.now(), window.__RSND.trips0 = (window.FLYDIY_TRIPS || []).length, true'); await click(b.x, b.y);
    }
    // the shot started, or the page's own trip log says why not (app.js rollAnim: trip.anim = 'none' / 'cannot' / 'threw' /
    // 'timeout' / 'refused: ...'): fail fast with the reason, never a blind 5-minute wait (the box's first run, 2026-10-07)
    const why = "(()=>{const T=window.FLYDIY_TRIPS||[],n=window.__RSND.trips0||0,t=T.slice(n).find(x=>x&&x.anim);return t?JSON.stringify({kind:t.kind,anim:t.anim,done:t.done,steps:(t.steps||[]).map(s=>s.id+(s.ran?'':'(skip)'))}):''})()";
    if (!SOLO && !await until('!!window.__RSND.marks.play || !!' + why, 120000)) throw new Error('the shot never started, and no roll-out trip was logged in 120 s (the click missed Roll out?)');
    if (!await ev('!!window.__RSND.marks.play')) throw new Error('the page did not play the shot: ' + await ev(why));
    if (!await until('!!window.__RSND.marks.done', 60000)) throw new Error('the shot never ended');
    if (!SOLO) await until("!FLYDIY_HOLDS().inGarage", 300000);
    await sleep(AFTER);
    const b64 = await ev(`new Promise(res => { const L = window.__RSND; L.marks.stop = performance.now(); L.rec.onstop = async () => {
      const blob = new Blob(L.parts, { type: 'audio/webm' }), buf = new Uint8Array(await blob.arrayBuffer()); let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); res(btoa(s)); }; L.rec.stop(); })`);
    const log = await ev('(() => { const L = window.__RSND; return { marks: L.marks, plan: L.plan, handover: L.handover, havePose: L.havePose, skipped: L.skipped, rows: L.rows }; })()');
    const webm = path.join(OUT, key + (SOLO ? '_solo' : '') + '_page.webm');
    fs.writeFileSync(webm, Buffer.from(b64, 'base64'));
    try { execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', webm, '-c:a', 'libopus', '-b:a', '64k', webm.replace(/\.webm$/, '.ogg')]); } catch (e) {}
    fs.writeFileSync(path.join(OUT, key + (SOLO ? '_solo' : '') + '_page.json'), JSON.stringify(log, null, 0));
    const m = log.marks, rel = t => t ? +((t - m.rec) / 1000).toFixed(2) : null;
    summary.builds[key] = { plan: log.plan, handover: log.handover, pose: log.havePose, skipped: log.skipped || null,
      recording: { click: rel(m.click), shot: rel(m.play), shotEnd: rel(m.done), stop: rel(m.stop) }, frames: log.rows.length };
    console.log('rollout_sound_evidence: ' + key + ' ' + JSON.stringify(summary.builds[key]));
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
  ws.close(); ch.kill();
  process.exit(0);
})().catch(e => { console.error('rollout_sound_evidence: ' + (e && e.stack || e)); try { ch.kill(); } catch (x) {} process.exit(1); });
