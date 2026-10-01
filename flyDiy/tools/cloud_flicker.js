#!/usr/bin/env node
// cloud_flicker.js - THE CLOUD FLICKER, MEASURED (B11-EYES, 2026-10-01). The user: "the clouds do flicker, particularly
// in interior view ... they seem to regenerate slightly different every frame"; "the RIM of the clouds in particular".
// A headed Chrome of its own (own --user-data-dir, no background throttling: a hidden window still draws), the game
// rolled out on Jolene, then tools/cloud_rig_page.js holds the camera at EXACT poses frame by frame (it wraps
// FLYDIY_AA.render) and compares frames rendered from the same pose, on the cloud march's own alpha: EDGES (0.05-0.6),
// CORES (>= 0.6) and the rest (grass, water, the prop - anything else that animates). Cases:
//   A  paused, one pose, 6 frames                     - per-frame noise
//   B  paused, the eye moved by mm / cm (no rotation)  - clouds km away must not move: any rim change is the renderer's
//   C  paused, a 0.5 deg bump and back                 - history: the march reads the PREVIOUS frame's depth
//   D  running, the camera held at one pose            - the drift / the clock
// each in the chase view and in the cockpit; then B in the cockpit with the suspect dials (jitter 0, nearest upsample,
// full res). Writes <out>/cloud_flicker.json and the x8 diff PNGs (+ a frame JPEG per view).
// Usage: node tools/cloud_flicker.js --url http://localhost:8611/flyDiy/index.html [--out <dir>] [--size 1600x900] [--ab]
//   --ab: case D only (running, the eye held, the aeroplane within 25 m hidden), CLOUDS.S.driftWrap 0 then 1 (G1050)
// It takes NO lock: run it inside `boxlock.sh take gpu <who>` / `drop gpu <who>`.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8611/flyDiy/index.html');
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'cloud_flicker')));
const SIZE = opt('size', '1600x900').split('x').map(Number);
const UDD = path.resolve(opt('udd', path.join(os.tmpdir(), 'flydiy_cloudflicker_profile')));
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const DPORT = 9800 + (process.pid % 150);
  const ch = spawn(CHROME, ['--remote-debugging-port=' + DPORT, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140), '--window-position=0,0',
    '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + UDD, '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', kill); process.on('SIGINT', () => process.exit(130));
  let tgt = null;
  for (let i = 0; i < 50 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(), exc = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') exc.push((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text || '').split('\n')[0]); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr, to) => {
    const p = cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const r = await Promise.race([p, sleep(to || 60000).then(() => ({ result: { result: { value: '__timeout' } } }))]);
    const d = r.result; if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)));
    return d.result.value;
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  await cmd('Page.navigate', { url: URL });
  await sleep(3000);
  const log = s => console.log('[' + new Date().toTimeString().slice(0, 8) + '] ' + s);
  // ---- the boot and the roll-out (master 79dc5b1d's flow: the shed, "Roll out untested", "Fly the circuit")
  for (let i = 0; i < 240; i++) { const s = await ev("window.BOOT ? BOOT.state : 'none'"); if (s === 'gone') break; await sleep(1000); }
  log('boot: ' + await ev("window.BOOT ? BOOT.state : 'none'"));
  await sleep(1500);
  await ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent).forEach(x=>x.click());return 1;})()");
  await ev("(()=>{const l=[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)&&b.offsetParent);if(l[0])l[0].click();return l.length;})()");
  for (let i = 0; i < 120; i++) {
    const st = await ev("JSON.stringify({t: window.FLIGHT_PROBE ? FLIGHT_PROBE.sim().t : -1, bs: window.BOOT ? BOOT.state : 'none', fly: !![...document.querySelectorAll('button')].find(b=>b.offsetParent&&/fly the circuit/i.test(b.textContent))})");
    const s = JSON.parse(st);
    if (s.fly) await ev("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.offsetParent&&/fly the circuit/i.test(b.textContent));if(b)b.click();return 1;})()");
    if (s.t > 3 && s.bs === 'gone') break;
    await sleep(1000);
  }
  log('flying: ' + await ev("JSON.stringify({t: FLIGHT_PROBE.sim().t, ph: FLIGHT_PROBE.ap().phase})"));
  await sleep(4000);   // the clouds' cover fit and the first shadow bake
  const rig = fs.readFileSync(path.join(__dirname, 'cloud_rig_page.js'), 'utf8');
  log(await ev(rig));
  const R = { url: URL, size: SIZE, when: new Date().toISOString(), info: JSON.parse(await ev('JSON.stringify(CR.cloudInfo())')), views: {} };
  const write = async (name, expr) => { const u = await ev(expr, 120000); const b = Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'); fs.writeFileSync(path.join(OUT, name), b); return name; };
  const P = (tag, pitch, yaw, t) => ({ tag, pitch: pitch || 0, yaw: yaw || 0, t: t || [0, 0, 0] });
  const run = async (poses, n, keep, hideR) => ev('CR.run(' + JSON.stringify(poses) + ', ' + n + ', ' + (keep ? 'true' : 'false') + ', ' + (hideR || 0) + ')', 70000);
  const pairs = async list => JSON.parse(await ev('JSON.stringify(' + JSON.stringify(list) + '.map(([i, j]) => (CR.st.caps[i] && CR.st.caps[j]) ? CR.pair(i, j) : { missing: [i, j], caps: CR.st.caps.length }))', 120000));
  const pause = on => ev("(()=>{const p=document.getElementById('bPause'); if (p && (" + (on ? '/pause/i' : '/run/i') + ").test(p.textContent)) p.click(); return p ? p.textContent : null;})()");
  const view = k => ev("(FLIGHT_PROBE.camMode('" + k + "'), FLIGHT_PROBE.camModeNow())");
  const save = () => fs.writeFileSync(path.join(OUT, 'cloud_flicker.json'), JSON.stringify(R, null, 1));

  // --ab (G1050): case D only - running, the eye held, the aeroplane near it hidden - with the drift's wrap OFF then ON
  // (CLOUDS.S.driftWrap), in the chase view and the cockpit; the diff image of each run's largest clock step
  if (argv.includes('--ab')) {
    R.ab = {};
    for (const v of ['chase', 'cockpit']) {
      log('view ' + v + ': ' + await view(v)); await sleep(2500);
      await pause(false); await sleep(1000);
      for (const wrap of [0, 1]) {
        await ev('(CLOUDS.S.driftWrap = ' + wrap + ', 1)'); await sleep(800);
        await run([P('P0')], 9, false, 25);
        const simT = JSON.parse(await ev('JSON.stringify(CR.st.caps.map(c => +c.simT.toFixed(4)))'));
        const ps = []; for (let k = 1; k < simT.length - 1; k++) ps.push([k, k + 1]);
        const res = await pairs(ps);
        res.forEach((p, i) => { p.dSimT = +(simT[ps[i][1]] - simT[ps[i][0]]).toFixed(4); });
        let best = 0; ps.forEach((q, i) => { if (res[i].dSimT > res[best].dSimT) best = i; });
        R.ab[v + '_wrap' + wrap] = { simT, pairs: res };
        await write(v + '_D_wrap' + wrap + '_diff_x8.png', 'CR.diffURL(CR.st.caps[' + ps[best][0] + '], CR.st.caps[' + ps[best][1] + '])');
        if (wrap) await write(v + '_D_frame_hidden.jpg', 'CR.frameURL(CR.st.caps[' + ps[best][0] + '])');
        log(v + ' wrap ' + wrap + ' done'); save();
      }
    }
    await ev('(CLOUDS.S.driftWrap = 1, 1)');
    R.exceptions = exc.slice(0, 10); save();
    log('wrote ' + OUT);
    try { await cmd('Browser.close'); } catch (e) {}
    await sleep(1500);
    process.exit(0);
  }
  for (const v of ['chase', 'cockpit']) {
    log('view ' + v + ': ' + await view(v)); await sleep(2500);
    const V = R.views[v] = {};
    await pause(true); await sleep(800);
    // A: one pose, six frames
    await run([P('P0')], 6);
    V.A = await pairs([[1, 2], [2, 3], [3, 4], [4, 5]]);
    await write(v + '_frame.jpg', 'CR.frameURL(CR.st.caps[2])');
    await write(v + '_A_diff_x8.png', 'CR.diffURL(CR.st.caps[2], CR.st.caps[3])');
    log(v + ' A done');
    // B: the eye moved by mm / cm, no rotation (camera-local x right, y up, z back)
    await run([P('P0'), P('x+5mm', 0, 0, [0.005, 0, 0]), P('P0'), P('y+2cm', 0, 0, [0, 0.02, 0]), P('P0'), P('z-2cm', 0, 0, [0, 0, -0.02]), P('P0'), P('x+2cm', 0, 0, [0.02, 0, 0])], 16, true);
    V.B = await pairs([[8, 10], [8, 9], [10, 11], [12, 13], [14, 15]]);
    await write(v + '_B_P0_vs_x2cm_diff_x8.png', 'CR.diffURL(CR.st.caps[14], CR.st.caps[15])');
    log(v + ' B done');
    // C: a 0.5 deg pitch bump and back: P0 after P0 against P0 right after the bump
    await run([P('P0'), P('P0'), P('bump+0.5deg', 0.5), P('P0'), P('P0'), P('bump-0.5deg', -0.5)], 12, true);
    // caps 0..11 = P0 P0 b+ P0 P0 b- P0 P0 b+ P0 P0 b-: 4 and 7 follow a P0; 3 and 9 follow b+, 6 follows b-
    V.C = await pairs([[4, 7], [7, 9], [4, 6], [9, 10]]);
    V.C_note = 'pairs: P0/P0 both after a P0 (the reference) | P0 after P0 vs P0 right after +0.5 deg | P0 after P0 vs P0 right after -0.5 deg | P0 right after the bump vs the next P0';
    await write(v + '_C_P0_vs_P0_after_bump_diff_x8.png', 'CR.diffURL(CR.st.caps[7], CR.st.caps[9])');
    log(v + ' C done');
    // D: running, the camera held at one pose
    await pause(false); await sleep(1500);
    await run([P('P0')], 7);
    V.D = await pairs([[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]);
    V.D_simT = JSON.parse(await ev('JSON.stringify(CR.st.caps.map(c => +c.simT.toFixed(3)))'));
    await write(v + '_D_diff_x8.png', 'CR.diffURL(CR.st.caps[2], CR.st.caps[3])');
    log(v + ' D done'); save();
  }
  // the suspect dials, cockpit, paused, case B's +2 cm pair (the view the user names)
  await pause(true); await sleep(800);
  const dials = { base: {}, jitter0: { jitter: 0 }, nearest: { upsample: 0 }, full: { mode: 'full' }, jitter0_full: { jitter: 0, mode: 'full' } };
  R.dials = {};
  const S0 = JSON.parse(await ev('JSON.stringify({jitter: CLOUDS.S.jitter, upsample: CLOUDS.S.upsample, mode: CLOUDS.S.mode})'));
  for (const [k, d] of Object.entries(dials)) {
    await ev('Object.assign(CLOUDS.S, ' + JSON.stringify(Object.assign({}, S0, d)) + '), 1'); await sleep(1500);
    await run([P('P0'), P('x+2cm', 0, 0, [0.02, 0, 0]), P('P0'), P('P0')], 8, true);
    R.dials[k] = await pairs([[4, 5], [6, 7]]);
    if (!R.dials[k][0].missing) await write('cockpit_dial_' + k + '_P0_vs_x2cm_diff_x8.png', 'CR.diffURL(CR.st.caps[4], CR.st.caps[5])');
    log('dial ' + k + ' done'); save();
  }
  await ev('Object.assign(CLOUDS.S, ' + JSON.stringify(S0) + '), 1');
  R.exceptions = exc.slice(0, 10);
  fs.writeFileSync(path.join(OUT, 'cloud_flicker.json'), JSON.stringify(R, null, 1));
  log('wrote ' + OUT);
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(1500);
  process.exit(0);
})().catch(e => { console.error('cloud_flicker: ' + (e && e.stack || e)); process.exit(1); });
