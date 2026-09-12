#!/usr/bin/env node
// tree_perf.js - THE FOREST'S BENCHMARK (W0c.17)
//
// What the trees cost, measured the same way every time: headless Chrome on
// this machine's GPU, the game rolled out, the aircraft teleported to the
// densest stand within 2.5 km at 110 m AGL (the seed makes it the same
// stand every run), the rig row fixed, the streamer let SETTLE - the frame
// is only sampled once no chunk has been generated for 60 frames, because a
// gen() inside the frame is 30-60 ms and every earlier density table this
// project wrote was taken while the streamer was still working - and then
// 120 frames per tier, wrapped so the world update and the render are timed
// apart.
//
// Usage:  node tools/tree_perf.js [--rig alps|sunset] [--ng 128] [--tiers full,msaa,off]
//                                 [--url http://localhost:8358/flyDiy/index.html]
//                                 [--out tools/perf/tree_perf.json] [--compare <json>]
//                                 [--probe "<js>"]   (an ablation, evaluated in the page first)
// Needs the dev server up (any static server on the repo root) and Chrome.
// Prints a table; writes the JSON; with --compare prints the delta per row.
// This is a MEASUREMENT, not a gate: it does not print PASS/FAIL and is not
// in run_gates.js - it needs a GPU and a browser, which the gate battery
// does not assume. The numbers it writes are the ones TREE-IMPORT.md quotes.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const RIG = opt('rig', 'alps');
const NG = +opt('ng', 0);
const TIERS = opt('tiers', 'full,msaa,off').split(',');
const URL = opt('url', 'http://localhost:8358/flyDiy/index.html');
const OUT = opt('out', path.join(__dirname, 'perf', 'tree_perf.json'));
const COMPARE = opt('compare', null);
const PROBE = opt('probe', null);          // JS evaluated in the page before the settle: an ablation

const PORT = 9400 + (process.pid % 500);
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => fs.existsSync(p));
if (!CHROME) { console.error('tree_perf: no Chrome found'); process.exit(2); }
const args = ['--headless=new', '--remote-debugging-port=' + PORT,
  '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run',
  '--user-data-dir=' + path.join(require('os').tmpdir(), 'cdp_' + PORT),
  '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'];
const ch = spawn(CHROME, args, { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => {
  http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej);
});

// ---- the probes, run in the page --------------------------------------
const TELEPORT = `(() => {
  const w = makeWorld(); const T = w.trees.filter(t => Math.hypot(t.x, t.z) < 2500);
  let best = null, bn = -1;
  for (let i = 0; i < T.length; i += 7) { const a = T[i]; let n = 0;
    for (const b of T) if (Math.abs(b.x - a.x) < 120 && Math.abs(b.z - a.z) < 120) n++;
    if (n > bn) { bn = n; best = a; } }
  const gy = w.terrainH(best.x, best.z);
  const s = FLIGHT_PROBE.sim(); const cg = s.cgPos();
  const dx = best.x - cg[0], dy = (gy + 110) - cg[1], dz = best.z - cg[2];
  for (let i = 0; i < s.n; i++) { s.p[i*3] += dx; s.p[i*3+1] += dy; s.p[i*3+2] += dz; s.v[i*3] = s.v[i*3+1] = s.v[i*3+2] = 0; }
  return JSON.stringify({ stand: [best.x | 0, best.z | 0], neighbours: bn }); })()`;
// settled = no chunk generated for 60 frames: the world update's worst
// frame stays under 8 ms for the whole window
const SETTLED = `(() => new Promise(res => {
  const wu = WORLD.worldUpdate; let worst = 0, n = 0;
  WORLD.worldUpdate = cg => { const t0 = performance.now(); wu(cg); worst = Math.max(worst, performance.now() - t0); };
  const tick = () => { if (++n < 60) requestAnimationFrame(tick); else { WORLD.worldUpdate = wu; res(worst < 8); } };
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
      let live = 0, imps = 0;
      WORLD.scene.traverse(o => { if (!o.isInstancedMesh || !o.visible || !o.count) return;
        if (o.geometry.type === 'PlaneGeometry') imps += o.count; else if (o.userData.ser !== undefined) live += o.count; });
      res(JSON.stringify({ median: +f[f.length >> 1].toFixed(1), p90: +f[Math.floor(f.length * 0.9)].toFixed(1),
        world: +(acc.world / 120).toFixed(1), render: +(acc.render / 120).toFixed(1),
        calls: info.calls, tris: info.triangles, near: live, impostors: imps })); } };
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
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => {
    const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const d = r.result;
    if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? d.exceptionDetails.text : JSON.stringify(r)));
    return d.result.value;
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  await sleep(20000);
  for (let attempt = 0; attempt < 8; attempt++) {
    await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
    await sleep(6000);
    if (await ev("/TAXI|DOWNWIND|FINAL/.test(document.body.innerText)")) break;
  }
  await sleep(8000);
  const gpu = await ev("(()=>{const g=WORLD.renderer.getContext();const d=g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);})()");
  const where = JSON.parse(await ev(TELEPORT));
  await ev("WORLD_RIG.row('" + RIG + "')");
  if (NG) await ev("TREE_FILL.set(" + NG + ")");
  if (PROBE) console.log('  probe ->', await ev(PROBE));
  const ng = await ev("TREE_FILL.get()");
  // settle: until sixty quiet frames in a row, at most two minutes
  let settled = false;
  for (let i = 0; i < 60 && !settled; i++) settled = await ev(SETTLED);
  const rows = [];
  for (const tier of TIERS) {
    await ev("FLYDIY_AA.setTier('" + tier + "')"); await sleep(1500);
    await ev(SETTLED);
    // twice: the first pass at a tier pays its target allocation and every
    // program the tier compiles lazily; only the second is recorded
    await ev(PROFILE);
    const r = JSON.parse(await ev(PROFILE));
    rows.push(Object.assign({ tier }, r));
  }
  await ev("FLYDIY_AA.setTier('full')");
  ws.close(); ch.kill();

  const result = { date: new Date().toISOString(), gpu, rig: RIG, ng, stand: where.stand, settled,
                   lod: JSON.parse(await Promise.resolve('[0]')), rows };
  delete result.lod;
  const pad = (v, n) => String(v).padStart(n);
  console.log(`tree_perf  ${gpu}\n  rig ${RIG} · fill NG ${ng} (${(1024 / ng).toFixed(1)} m) · stand at ${where.stand} · settled ${settled}`);
  console.log('  tier   median   p90  world render   calls    Mtris    near   impostors');
  for (const r of rows)
    console.log(`  ${r.tier.padEnd(5)} ${pad(r.median, 7)} ${pad(r.p90, 5)} ${pad(r.world, 6)} ${pad(r.render, 6)} ${pad(r.calls, 7)} ${pad((r.tris / 1e6).toFixed(1), 8)} ${pad(r.near, 7)} ${pad(r.impostors, 11)}`);
  if (COMPARE && fs.existsSync(COMPARE)) {
    const prev = JSON.parse(fs.readFileSync(COMPARE, 'utf8'));
    console.log('  vs ' + COMPARE + ' (' + prev.date.slice(0, 10) + ', NG ' + prev.ng + ', ' + prev.rig + ')');
    for (const r of rows) {
      const p = prev.rows.find(x => x.tier === r.tier);
      if (p) console.log(`  ${r.tier.padEnd(5)} median ${p.median} -> ${r.median} ms (${(r.median - p.median >= 0 ? '+' : '')}${(r.median - p.median).toFixed(1)})`);
    }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
  console.log('  wrote ' + path.relative(process.cwd(), OUT));
  process.exit(0);
})().catch(e => { console.error('tree_perf:', e.message || e); ch.kill(); process.exit(1); });
