#!/usr/bin/env node
// met_perf.js - WHAT A TOWN COSTS, measured the same way every time.
//
// tree_perf.js measures the forest and premises_perf.js measures the editor's
// BENCH; neither can say what the record the game actually boots costs where a
// player flies. This does: headless Chrome on this machine's GPU, the game
// rolled out on Jolene, the aeroplane teleported to a named STATION and held
// there (the sim paused - the world still streams, partitions and renders), the
// streamer let settle, then 120 frames with the world update and the render
// timed apart. The airfield is the control: it is the content that was there
// before Metlakatla, in the same world, on the same run.
//
// Usage:  node tools/met_perf.js [--url http://localhost:8497/flyDiy/dev.html?world=jolene]
//                                [--stations town,harbour,centre,field] [--alt 300]
//                                [--out tools/perf/met_perf.json] [--compare <json>]
// Needs a static server on the repo root and Chrome.
// This is a MEASUREMENT, not a gate: no PASS/FAIL, not in run_gates.js - it
// needs a GPU and a browser, which the gate battery does not assume.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8497/flyDiy/dev.html?world=jolene');
const ALT = +opt('alt', 300);
const OUT = opt('out', path.join(__dirname, 'perf', 'met_perf.json'));
const COMPARE = opt('compare', null);

// the stations, in the game frame. `field` is the CONTROL: the airfield the
// island already had, flown in the same run so the two numbers are comparable.
const STATIONS = {
  town:    { x: -3320, z: -8720, note: 'over the town, the whole grid in frame' },
  harbour: { x: -3950, z: -8800, note: 'over the boat harbour and its moles' },
  centre:  { x: -3350, z: -8680, note: 'low over the ball park and the schools' },
  walden:  { x: -2300, z: -8480, note: 'over Walden Point Road and the lush corridor' },
  field:   { x: -301,  z: 221,   note: 'the airfield - the control' },
};
const WANT = opt('stations', 'town,harbour,centre,walden,field').split(',').filter(s => STATIONS[s]);

const PORT = 9400 + (process.pid % 500);
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => fs.existsSync(p));
if (!CHROME) { console.error('met_perf: no Chrome found'); process.exit(2); }
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT,
  '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run',
  '--user-data-dir=' + path.join(require('os').tmpdir(), 'metperf_' + PORT + '_' + Date.now()),
  '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => {
  http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej);
});

const teleport = (x, z, alt) => `(() => {
  const w = FLIGHT_PROBE.world();
  const gy = w.terrainH(${x}, ${z});
  const s = FLIGHT_PROBE.sim(), cg = s.cgPos();
  const dx = ${x} - cg[0], dy = (gy + ${alt}) - cg[1], dz = ${z} - cg[2];
  for (let i = 0; i < s.n; i++) { s.p[i*3] += dx; s.p[i*3+1] += dy; s.p[i*3+2] += dz; s.v[i*3] = s.v[i*3+1] = s.v[i*3+2] = 0; }
  return JSON.stringify({ at: [${x}, ${z}], ground: +gy.toFixed(1) }); })()`;

// settled: no chunk generated for 60 frames (the streamer says so itself)
const SETTLED = `(() => new Promise(res => {
  const wu = WORLD.worldUpdate; let worst = 0, n = 0, busy = false;
  const st = () => (window.TREE_FILL && TREE_FILL.stat) ? TREE_FILL.stat() : null;
  const g0 = st() ? st().gens : -1;
  WORLD.worldUpdate = cg => { const t0 = performance.now(); wu(cg); worst = Math.max(worst, performance.now() - t0); const S = st(); if (S && (S.busy || S.gens !== g0)) busy = true; };
  const tick = () => { if (++n < 60) requestAnimationFrame(tick); else { WORLD.worldUpdate = wu; res(st() ? !busy : worst < 8); } };
  requestAnimationFrame(tick); }))()`;

const PROFILE = `(() => new Promise(res => {
  const acc = { world: 0, render: 0, frames: [] };
  const wu = WORLD.worldUpdate, rr = WORLD.renderer.render.bind(WORLD.renderer);
  WORLD.worldUpdate = cg => { const t0 = performance.now(); wu(cg); acc.world += performance.now() - t0; };
  WORLD.renderer.render = (a, b) => { const t0 = performance.now(); rr(a, b); acc.render += performance.now() - t0; };
  let n = 0, last = performance.now();
  const tick = () => { const now = performance.now(); acc.frames.push(now - last); last = now;
    if (++n < 121) requestAnimationFrame(tick); else {
      WORLD.worldUpdate = wu; WORLD.renderer.render = rr;
      const f = acc.frames.slice(1).sort((a, b) => a - b);
      const info = WORLD.renderer.info.render;
      const R = (window.WORLD && WORLD.premisesStart) ? WORLD.premisesStart() : null;
      res(JSON.stringify({ median: +f[f.length >> 1].toFixed(1), p90: +f[Math.floor(f.length * 0.9)].toFixed(1),
        world: +(acc.world / 120).toFixed(1), render: +(acc.render / 120).toFixed(1),
        calls: info.calls, tris: info.triangles,
        premisesTris: R && R.stats ? R.stats.tris : null, chunks: R && R.stats ? R.stats.chunks : null,
        houses: R && R.stats ? R.stats.houses : null })); } };
  requestAnimationFrame(tick); }))()`;

(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) {
    await sleep(400);
    try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {}
  }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = m0 => { const m = JSON.parse(m0.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => {
    const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const d = r.result;
    if (!d || d.exceptionDetails) {
      const x = d && d.exceptionDetails;
      const msg = (x && x.exception && x.exception.description) || (x && x.text) || JSON.stringify(r);
      throw new Error('page: ' + String(msg).split(String.fromCharCode(10))[0]);
    }
    return d.result.value;
  };
  // the boot sequence is a POLL, not a script: every step is tried until it takes,
  // and a step that is not there yet must not throw the run away
  const tryEv = async expr => { try { return await ev('(()=>{ try { return ' + expr + '; } catch (e) { return "ERR " + e.message; } })()'); } catch (e) { return 'ERR ' + e.message; } };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.navigate', { url: URL });
  console.log('met_perf:', URL);
  // THE BOOT IS SLOW HERE. Headless falls back to swiftshader on this machine and
  // the roll-out takes minutes, not seconds; a short poll reported "the flight never
  // started" while it was merely still compiling. Every stage says where it is, and
  // writes a PNG, so a stuck run can be looked at instead of guessed about.
  const snap = async name => { try { const r = await cmd('Page.captureScreenshot', {});
    if (r.result && r.result.data) fs.writeFileSync(path.join(require('os').tmpdir(), 'met_perf_' + name + '.png'), Buffer.from(r.result.data, 'base64')); } catch (e) {} };
  const stage = async n => { const b = await tryEv("(document.getElementById('boot')||{}).hidden");
    const g = await tryEv("(()=>{const q=document.getElementById('bGo');return q?(q.disabled?'disabled':'ready'):'none';})()");
    console.log('  ...', n, 'boot hidden', b, 'bGo', g); };
  // the chooser, then the roll-out; a fresh profile shows "keep the current build"
  for (let i = 0; i < 150; i++) {
    await sleep(2000);
    if (i % 15 === 0) await stage('chooser ' + i);
    if (await tryEv("!!document.getElementById('bGo') && !document.getElementById('bGo').disabled")) break;
    await tryEv("(()=>{const b=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&/^Cub-alike$/i.test((e.textContent||'').trim()))[0]; if(b)b.click(); return !!b;})()");
    await tryEv("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click()); return 1;})()");
  }
  await snap('chooser');
  await tryEv("(()=>{const b=document.getElementById('bGo'); if(b) b.click(); return !!b;})()");
  let up = false;
  for (let i = 0; i < 300 && !up; i++) {
    await sleep(2000);
    if (i % 20 === 0) { await stage('rollout ' + i); await tryEv("(()=>{const b=document.getElementById('bGo'); if(b && !b.disabled) b.click(); return 1;})()"); }
    up = (await tryEv("typeof WORLD !== 'undefined' && !!WORLD.premisesStart && typeof FLIGHT_PROBE !== 'undefined' && !!FLIGHT_PROBE.sim()")) === true;
  }
  await snap('rolled');
  const lifted = await tryEv("(()=>{const b=document.getElementById('boot');return !b || b.hidden || /\bgone\b/.test(b.className||'');})()");
  if (lifted !== true) console.error('met_perf: WARNING the boot overlay never lifted - the numbers below are not a measurement');
  if (!up) throw new Error('the flight never started - the chooser or the roll-out did not take (see ' + require('os').tmpdir() + '/met_perf_*.png)');
  await sleep(6000);
  const gpu = await tryEv("(()=>{const g=WORLD.renderer.getContext();const d=g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);})()");
  await tryEv("(()=>{const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return b&&b.textContent;})()");
  await tryEv("(typeof DAY_CLOCK !== 'undefined') ? (DAY_CLOCK.preset('noon'), 'noon') : 'no clock'");

  const rows = [];
  for (const name of WANT) {
    const S = STATIONS[name];
    const where = JSON.parse(await ev(teleport(S.x, S.z, ALT)));
    let settled = false;
    for (let i = 0; i < 40 && !settled; i++) settled = await ev(SETTLED);
    await ev(PROFILE);                                   // a warm pass: lazy programs and targets
    const r = JSON.parse(await ev(PROFILE));
    rows.push(Object.assign({ station: name, note: S.note, settled }, where, r));
    // A FRAME THAT DREW NOTHING IS NOT A MEASUREMENT. The first run of this tool
    // printed 0.4 ms medians with ONE draw call and twelve triangles, because the
    // headless page had never lifted its boot overlay and was not rendering the
    // world at all - a number that looks like a result and is not. Refuse it.
    if (!(r.calls > 50)) {
      throw new Error('station ' + name + ' drew ' + r.calls + ' calls / ' + r.tris + ' triangles: the page is not rendering the world '
        + '(the boot overlay never lifted, or the frame goes through the post-FX blit and not renderer.render). '
        + 'See ' + require('os').tmpdir() + '/met_perf_*.png');
    }
    console.log('  ' + name.padEnd(9) + 'median ' + String(r.median).padStart(6) + ' ms  world ' + String(r.world).padStart(5)
      + '  render ' + String(r.render).padStart(5) + '  calls ' + String(r.calls).padStart(6)
      + '  tris ' + String(r.tris).padStart(9) + '  premises ' + String(r.premisesTris).padStart(8) + ' tris / ' + String(r.chunks).padStart(4) + ' chunks');
  }
  const out = { when: new Date().toISOString(), url: URL, alt: ALT, gpu, rows };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('gpu:', gpu);
  console.log('wrote', OUT);
  if (COMPARE && fs.existsSync(COMPARE)) {
    const B = JSON.parse(fs.readFileSync(COMPARE, 'utf8'));
    for (const r of rows) {
      const b = (B.rows || []).find(q => q.station === r.station);
      if (b) console.log('  %-8s median %+.1f ms  calls %+d  tris %+d', r.station, r.median - b.median, r.calls - b.calls, r.tris - b.tris);
    }
  }
  ch.kill();
  process.exit(0);
})().catch(e => { console.error('met_perf:', e.message); try { ch.kill(); } catch (x) {} process.exit(1); });
