#!/usr/bin/env node
// premises_perf.js - THE PREMISES' BENCHMARK (the bench's v7, in tree_perf's style)
//
// What a composed premises costs, measured the same way every time: headless
// Chrome on this machine's GPU, the bench page with a fixture loaded, the build
// queue drained with its time counted per house, the tree payload waited for,
// then a fixed set of camera STATIONS derived from the record itself (the map
// overview always; the strip, the harbour, the mine, the village row when the
// record has them), 120 frames each, the frame timed round the page's own
// draw (compose is not in the frame - the bench renders on dirty, so the
// profile drives one draw per frame), the renderer's calls and triangles read
// after each frame.
//
// Usage:  node tools/premises_perf.js [--fixture premises_v1_showcase.json]
//                                     [--url http://localhost:8401/flyDiy/tools/_premises.html]
//                                     [--out tools/perf/premises_perf.json] [--compare <json>]
//                                     [--frames 120] [--rig alps|sunset]
// Needs the bench's static server up on the repo root (node tools/_serve.js 8401) and Chrome.
// Prints a table; writes the JSON; with --compare prints the delta per station.
// This is a MEASUREMENT, not a gate: no PASS/FAIL, not in run_gates.js - it
// needs a GPU and a browser, which the gate battery does not assume.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const FIXTURE = opt('fixture', 'premises_v1_showcase.json');
const URL = opt('url', 'http://localhost:8401/flyDiy/tools/_premises.html');
const OUT = opt('out', path.join(__dirname, 'perf', 'premises_perf.json'));
const COMPARE = opt('compare', null);
const FRAMES = +opt('frames', 120);
const RIG = opt('rig', null);

const PORT = 9400 + (process.pid % 500);
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => fs.existsSync(p));
if (!CHROME) { console.error('premises_perf: no Chrome found'); process.exit(2); }
const profileDir = path.join(require('os').tmpdir(), 'cdp_' + PORT + '_' + Date.now());
const args = ['--headless=new', '--remote-debugging-port=' + PORT,
  '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run',
  '--user-data-dir=' + profileDir,   // a FRESH profile every run (tree_perf's W0c.30 lesson)
  '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'];
const ch = spawn(CHROME, args, { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => {
  http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej);
});

// ---- the probes, run in the page ----------------------------------------
// the fixture loaded and the build queue drained, each house timed
const LOAD = fx => `(async () => {
  const P = window.PREMISES_PAGE, ed = P.ed;
  const txt = await fetch('/flyDiy/tools/fixtures/${fx}').then(r => r.text());
  const t0 = performance.now(); ed.load(txt); const loadMs = performance.now() - t0;
  const rb = P.R.stats.ms;
  let built = 0, buildMs = 0, worst = 0;
  while (P.R.stats.queued) { const t = performance.now(); const n = P.R.step(1); const dt = performance.now() - t; built += n; buildMs += dt; worst = Math.max(worst, dt); if (!n) break; }
  P.draw();
  const s = P.R.stats, O = P.R.overlay;
  return JSON.stringify({ loadMs: +loadMs.toFixed(0), composeMs: +rb.toFixed(0), built, buildMs: +buildMs.toFixed(0), worstBuildMs: +worst.toFixed(0),
    houses: s.houses, houseTris: s.houseTris, lights: s.lights, objects: s.objects, trees: s.trees, treeTris: s.treeTris, groundTris: s.tris, chunks: s.chunks,
    plots: O.records.plots.length, items: O.records.items.length, parks: (O.records.parks || []).length, links: O.records.links.length,
    issues: O.records.issues.length, red: ed.checks().filter(c => !c.ok).map(c => c.label), world: O.frame.worldId, extent: O.extent,
    has: { strip: O.runways.length > 0, harbour: ed.record().layers.zones.some(z => z.kind === 'harbour'), mine: ed.record().layers.sites.length > 0, village: O.records.plots.length > 0 },
    strip: O.runways[0] ? { c: O.runways[0].c, hdg: O.runways[0].hdg, len: O.runways[0].len } : null,
    harbour: (() => { const z = ed.record().layers.zones.find(z => z.kind === 'harbour'); return z ? window.PREMISES_GEN.polyBBox(z.poly) : null; })(),
    mine: (() => { const s = ed.record().layers.sites[0]; return s ? [s.at.x, s.at.z] : null; })(),
    village: (() => { const p = O.records.plots.filter(p => p.kind === 'residential'); if (!p.length) return null; const m = p[p.length >> 1]; return [m.front[0], m.front[1]]; })() });
})()`;
// a station: the camera placed from the record (premises coords), the yaw and pitch fixed
const STATION = (kind, at) => `(() => {
  const P = window.PREMISES_PAGE, O = P.R.overlay;
  const st = ${JSON.stringify(at)};
  if ('${kind}' === 'map') { P.cameras.set('map'); P.cameras.frame(st.bb); }
  else { P.cameras.set('orbit'); P.cameras.frame(st.bb); P.cameras.look(st.yaw, st.pitch); }
  P.draw();
  const c = P.camera();
  return JSON.stringify({ cam: [c.position.x, c.position.y, c.position.z].map(v => +v.toFixed(0)), above: +(c.position.y - O.terrainAt(c.position.x, c.position.z)).toFixed(0) });
})()`;
// the profile: N frames, each one draw, the renderer's counts after the last
const PROFILE = n => `(() => new Promise(res => {
  const P = window.PREMISES_PAGE;
  const frames = []; let k = 0;
  const tick = () => { const t0 = performance.now(); P.draw(); frames.push(performance.now() - t0);
    if (++k < ${n}) requestAnimationFrame(tick); else {
      const f = frames.slice(2).sort((a, b) => a - b), info = P.renderer.info.render;
      res(JSON.stringify({ median: +f[f.length >> 1].toFixed(2), p90: +f[Math.floor(f.length * 0.9)].toFixed(2), worst: +f[f.length - 1].toFixed(2), calls: info.calls, tris: info.triangles })); } };
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
    if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)));
    return d.result.value;
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL + (URL.indexOf('?') >= 0 ? '&' : '?') + 'fresh=1' });
  // the page up: its handle on the window
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(500); try { up = await ev("!!(window.PREMISES_PAGE && PREMISES_PAGE.R)"); } catch (e) {} }
  if (!up) throw new Error('the bench page never came up at ' + URL);
  const gpu = await ev("(()=>{const g=PREMISES_PAGE.renderer.getContext();const d=g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);})()");
  if (RIG) await ev("(window.WORLD_RIG && WORLD_RIG.row) ? WORLD_RIG.row('" + RIG + "') : null");
  const load = JSON.parse(await ev(LOAD(FIXTURE)));
  if (load.red.length) console.log('  (the panel is red on this record: ' + load.red.join('; ') + ')');
  // the tree payload: the cone world is not the forest (tree_perf's W0c.30 refusal)
  let trees = false;
  for (let i = 0; i < 60 && !trees; i++) { trees = await ev("typeof treeReady === 'function' && treeReady()"); if (!trees) await sleep(500); }
  if (!trees) throw new Error('the tree payload never arrived - the world is drawing cones');
  // the trees rebuilt on the payload (the page marks the record dirty when the maps land), the queue drained again
  await ev("(() => { const P = PREMISES_PAGE; P.ed.dirty(); while (P.R.stats.queued) P.R.step(2); P.draw(); return P.R.stats.trees; })()");
  await sleep(1500);
  // the stations from the record
  const ex = load.extent;
  const stations = [{ kind: 'map', name: 'map', at: { bb: ex } }];
  if (load.has.strip) { const s = load.strip, d = [Math.cos(s.hdg), Math.sin(s.hdg)]; stations.push({ kind: 'orbit', name: 'strip', at: { bb: { x0: s.c[0] - s.len * 0.55, x1: s.c[0] + s.len * 0.55, z0: s.c[1] - 70, z1: s.c[1] + 70 }, yaw: Math.atan2(-d[0], -d[1]) + Math.PI, pitch: 0.22 } }); }
  if (load.has.harbour) { const b = load.harbour; stations.push({ kind: 'orbit', name: 'harbour', at: { bb: { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 }, yaw: Math.PI, pitch: 0.35 } }); }
  if (load.has.mine) { const m = load.mine; stations.push({ kind: 'orbit', name: 'mine', at: { bb: { x0: m[0] - 70, x1: m[0] + 70, z0: m[1] - 40, z1: m[1] + 90 }, yaw: Math.PI, pitch: 0.4 } }); }
  if (load.has.village) { const v = load.village; stations.push({ kind: 'orbit', name: 'village', at: { bb: { x0: v[0] - 60, x1: v[0] + 60, z0: v[1] - 40, z1: v[1] + 40 }, yaw: Math.PI / 2, pitch: 0.3 } }); }
  const rows = [];
  for (const st of stations) {
    const where = JSON.parse(await ev(STATION(st.kind, st.at)));
    await ev(PROFILE(20));   // the first frames at a station compile what the view needs; only the second pass is recorded
    const r = JSON.parse(await ev(PROFILE(FRAMES)));
    rows.push(Object.assign({ station: st.name }, r, { cam: where.cam, above: where.above }));
  }
  ws.close(); ch.kill();

  const result = { date: new Date().toISOString(), gpu, fixture: FIXTURE, world: load.world, frames: FRAMES,
    build: { loadMs: load.loadMs, composeMs: load.composeMs, built: load.built, buildMs: load.buildMs, perBuildMs: +(load.buildMs / Math.max(1, load.built)).toFixed(1), worstBuildMs: load.worstBuildMs },
    counts: { houses: load.houses, houseTris: load.houseTris, lights: load.lights, objects: load.objects, trees: load.trees, treeTris: load.treeTris, groundTris: load.groundTris, chunks: load.chunks, plots: load.plots, items: load.items, parks: load.parks, links: load.links, issues: load.issues },
    rows };
  const pad = (v, n) => String(v).padStart(n);
  console.log(`premises_perf  ${gpu}\n  ${FIXTURE} on ${load.world} · compose ${load.composeMs} ms · ${load.built} builds in ${load.buildMs} ms (${result.build.perBuildMs} ms each, worst ${load.worstBuildMs}) · ${load.houses} houses ${(load.houseTris / 1e6).toFixed(2)} Mtris · ${load.lights} lights · ${load.trees} trees ${(load.treeTris / 1e6).toFixed(1)} Mtris · ground ${(load.groundTris / 1e6).toFixed(2)} Mtris in ${load.chunks} chunks`);
  console.log('  station    median    p90  worst   calls    Mtris   camera');
  for (const r of rows)
    console.log(`  ${r.station.padEnd(8)} ${pad(r.median, 8)} ${pad(r.p90, 6)} ${pad(r.worst, 6)} ${pad(r.calls, 7)} ${pad((r.tris / 1e6).toFixed(2), 8)}   ${r.cam.join(',')} (+${r.above} m)`);
  if (COMPARE && fs.existsSync(COMPARE)) {
    const prev = JSON.parse(fs.readFileSync(COMPARE, 'utf8'));
    console.log('  vs ' + COMPARE + ' (' + prev.date.slice(0, 10) + ', ' + prev.fixture + ')');
    for (const r of rows) {
      const p = prev.rows.find(x => x.station === r.station);
      if (p) console.log(`  ${r.station.padEnd(8)} median ${p.median} -> ${r.median} ms (${(r.median - p.median >= 0 ? '+' : '')}${(r.median - p.median).toFixed(2)}) · calls ${p.calls} -> ${r.calls}`);
    }
    if (prev.build) console.log(`  build ${prev.build.perBuildMs} -> ${result.build.perBuildMs} ms per house`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
  console.log('  wrote ' + path.relative(process.cwd(), OUT));
  await sleep(1500);   // Chrome lets go of its profile
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('premises_perf:', e.message || e); ch.kill(); process.exit(1); });
