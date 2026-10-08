#!/usr/bin/env node
// garage_idle_prof.js - GARAGE-LAPTOP (G2111): WHAT THE GARAGE'S LOOP RUNS WHEN NOTHING CHANGES - in node, no GPU.
// The fitted laptop rung (garage_fps.js) left ~12 ms of the loop's JS outside the render in the garage (the box: ~4 ms):
// the frame ticks with nobody touching anything. The page in node (tools/_page_node.js; ?gfx=<preset>, a build in the WIP
// slot) boots into the garage, warms WARM frames, then a V8 CPU profile (node:inspector, in process: the page's scripts run
// in this isolate's vm context, so their functions carry their files' names) is taken over FRAMES idle frames. Printed: self
// ms by FILE and by FUNCTION (file:line), the inclusive ms of the loop's own top-level calls (the callees of app.js's
// frame function), excluding three.js and the harness. The virtual clock does not change what runs, only when timers
// fire: idle frames are idle in both.
// Usage: node --max-old-space-size=6144 tools/perf/garage_idle_prof.js [--build jodel] [--preset retro] [--warm 90]
//          [--frames 150] [--out file.json] [--top 40]
// Node only: a heavy job - take boxlock.sh take cpu <WHO> first. No --help.
'use strict';
const fs = require('fs'), path = require('path'), inspector = require('inspector');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json' };
const BK = opt('build', 'jodel'), PRESET = opt('preset', 'retro'), WARM = +opt('warm', 90), FRAMES = +opt('frames', 150), TOP = +opt('top', 40);
const OUT = opt('out', null);
const post = (s, m, p) => new Promise((res, rej) => s.post(m, p || {}, (e, r) => e ? rej(e) : res(r)));

(async () => {
  const { openPage } = require('../_page_node.js');
  const hooks = { afterScript(name, P) { if (/gfx_settings\.js/.test(name) && P.win.GFX) P.win.GFX.set('preset', PRESET); } };
  const P = await openPage({ quiet: true, hooks, query: 'gfx=' + PRESET, storage: { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[BK] || BK), 'utf8') } });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  await P.frames(WARM);
  const s = new inspector.Session(); s.connect();
  await post(s, 'Profiler.enable'); await post(s, 'Profiler.setSamplingInterval', { interval: 200 });
  await post(s, 'Profiler.start');
  const t0 = process.hrtime.bigint();
  await P.frames(FRAMES);
  const wall = Number(process.hrtime.bigint() - t0) / 1e6;
  const { profile } = await post(s, 'Profiler.stop');
  s.disconnect();
  // self time per node (samples x interval), then by file / function; inclusive per node for the loop's callees
  const nodes = new Map(profile.nodes.map(n => [n.id, n]));
  const dt = profile.timeDeltas, smp = profile.samples; const selfUs = new Map();
  for (let i = 0; i < smp.length; i++) selfUs.set(smp[i], (selfUs.get(smp[i]) || 0) + (dt[i] || 0));
  const fileOf = n => (n.callFrame.url || '').replace(/^.*[\\/](src|tools|vendor)[\\/]/, '$1/').replace(/\?.*$/, '') || '(' + (n.callFrame.functionName || 'native') + ')';
  const fnOf = n => (n.callFrame.functionName || '(anon)') + ' ' + fileOf(n) + ':' + (n.callFrame.lineNumber + 1);
  const byFile = {}, byFn = {};
  for (const [id, us] of selfUs) { const n = nodes.get(id); if (!n) continue; const f = fileOf(n); byFile[f] = (byFile[f] || 0) + us; const k = fnOf(n); byFn[k] = (byFn[k] || 0) + us; }
  // inclusive: children map
  const kids = new Map(); for (const n of profile.nodes) kids.set(n.id, n.children || []);
  const incl = id => { let t = selfUs.get(id) || 0; for (const c of kids.get(id) || []) t += incl(c); return t; };
  // the loop's frame function (app.js 'loop') and its direct callees, summed over every node that is the loop
  const loopIds = profile.nodes.filter(n => n.callFrame.functionName === 'loop' && /app\.js/.test(n.callFrame.url)).map(n => n.id);
  const callee = {}; let loopUs = 0;
  for (const id of loopIds) { loopUs += incl(id); for (const c of kids.get(id) || []) { const k = fnOf(nodes.get(c)); callee[k] = (callee[k] || 0) + incl(c); } }
  const ms = us => +(us / 1000 / FRAMES).toFixed(3);   // ms a frame
  const sort = M => Object.entries(M).sort((a, b) => b[1] - a[1]);
  const isHarness = k => /_page_node|_fake_gl|_page_dom|node:|\(garbage collector\)|\(program\)|\(idle\)/.test(k);
  console.log('GARAGE IDLE PROFILE ' + BK + ' ' + PRESET + ': ' + FRAMES + ' frames, wall ' + (wall / FRAMES).toFixed(2) + ' ms a frame (node), loop inclusive ' + ms(loopUs) + ' ms a frame');
  console.log('  SELF BY FILE (ms a frame)'); for (const [k, v] of sort(byFile).slice(0, 25)) console.log('    ' + String(ms(v)).padStart(8) + '  ' + k);
  console.log('  SELF BY FUNCTION, page code only (ms a frame)'); for (const [k, v] of sort(byFn).filter(e => !/vendor\/three/.test(e[0]) && !isHarness(e[0])).slice(0, TOP)) console.log('    ' + String(ms(v)).padStart(8) + '  ' + k);
  console.log('  THE LOOP\'S CALLEES, inclusive (ms a frame)'); for (const [k, v] of sort(callee).slice(0, 30)) console.log('    ' + String(ms(v)).padStart(8) + '  ' + k);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ build: BK, preset: PRESET, frames: FRAMES, wallMs: wall / FRAMES, loopMs: ms(loopUs),
    byFile: Object.fromEntries(sort(byFile).map(([k, v]) => [k, ms(v)])), byFn: Object.fromEntries(sort(byFn).slice(0, 200).map(([k, v]) => [k, ms(v)])),
    callee: Object.fromEntries(sort(callee).map(([k, v]) => [k, ms(v)])) }, null, 1));
  process.exit(0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
