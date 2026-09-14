#!/usr/bin/env node
// boot_perf.js - THE BOOT'S BENCHMARK (LOADING chantier, 2026-09-14)
//
// What the boot costs, measured the same way every time: headless Chrome on
// this machine's GPU, a CDP sampling profile from before the navigation to
// SECS seconds after it, the network log, the long tasks, the page's own
// milestones (window.BOOT.log once the loading screen exists; window.__M
// hooks on the readiness globals regardless), and screenshots at the moment
// the overlay drops and 2 / 5 s later - with a STILLNESS score (mean absolute
// pixel difference between the +0.2 s and the +5 s frame): the number that
// says "nothing changes after the drop", which is the whole point of S1.
//
// Usage:  node tools/boot_perf.js [--url http://localhost:8361/flyDiy/dev.html]
//                                 [--world jolene] [--cold] [--secs 40] [--tag name]
//                                 [--out tools/perf/boot_perf.json] [--compare <json>]
//                                 [--shots]  (write the screenshots to screenshots/boot/)
// --cold = a fresh Chrome profile (no GPU shader cache: every program compiles
// from source); default = the rig's own persistent profile (the second run is
// the user's daily boot). Needs a static server on the repo root and Chrome.
// A MEASUREMENT, not a gate: no PASS/FAIL, not in run_gates.js.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const zlib = require('zlib');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const WORLD = opt('world', null);
let URL = opt('url', 'http://localhost:8361/flyDiy/dev.html');
if (WORLD) URL += (URL.includes('?') ? '&' : '?') + 'world=' + WORLD;
const SECS = +opt('secs', 40);
const TAG = opt('tag', (flag('cold') ? 'cold' : 'warm') + (WORLD ? '_' + WORLD : ''));
const OUT = opt('out', path.join(__dirname, 'perf', 'boot_perf_' + TAG + '.json'));
const COMPARE = opt('compare', null);
const SHOTDIR = flag('shots') ? path.join(__dirname, '..', 'screenshots', 'boot') : os.tmpdir();
const ORIGIN = URL.replace(/^(https?:\/\/[^/]+).*$/, '$1');

const PORT = 9400 + (process.pid % 500);
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => fs.existsSync(p));
if (!CHROME) { console.error('boot_perf: no Chrome found'); process.exit(2); }
const UDD = flag('cold') ? path.join(os.tmpdir(), 'cdp_boot_' + PORT + '_' + Date.now())
                         : path.join(os.tmpdir(), 'flydiy_boot_perf_profile');
const args = ['--headless=new', '--remote-debugging-port=' + PORT,
  '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run',
  '--user-data-dir=' + UDD, '--disable-gpu-sandbox', 'about:blank'];
const ch = spawn(CHROME, args, { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => {
  http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej);
});

// Injected before any page script: the milestone recorder. Hooks the
// readiness globals the boot defines (so a page without BOOT still reports),
// the first rAF, the long tasks, the paints, and #boot's `gone` class.
const INJECT = `(() => {
  const M = window.__M = { ev: [], props: [], chars: [], longTasks: [], paints: [], fetches: [] };
  const now = () => +performance.now().toFixed(0);
  const mark = (k, extra) => M.ev.push(Object.assign({ k, t: now() }, extra || {}));
  const hook = (name, wrap) => { let v; Object.defineProperty(window, name, { configurable: true, enumerable: true,
    get: () => v, set: nv => { if (v === undefined) mark('def:' + name); v = wrap ? wrap(nv) : nv; } }); };
  hook('WORLD'); hook('treeReady'); hook('TREE_FILL'); hook('CAGE_UI');
  hook('PROP_LANDED', f => (k, g) => { M.props.push({ k, t: now() }); return f(k, g); });
  hook('CHAR_TEX_LANDED', f => (k) => { M.chars.push({ k, t: now() }); return f(k); });
  hook('ASSET_FETCH', f => url => { const t = now(); const p = f(url);
    p.then(b => M.fetches.push({ url: String(url).replace(/^.*media\\//, ''), t0: t, t1: now(), n: b ? b.length : 0 }), () => {}); return p; });
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) M.longTasks.push({ t: +e.startTime.toFixed(0), d: +e.duration.toFixed(0) }); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) M.paints.push({ k: e.name, t: +e.startTime.toFixed(0) }); }).observe({ type: 'paint', buffered: true }); } catch (e) {}
  let firstRaf = false; const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { if (!firstRaf) { firstRaf = true; mark('firstRAF'); } return cb(ts); });
  const mo = new MutationObserver(() => { const b = document.getElementById('boot');
    if (b && b.classList.contains('gone') && !M.bootGone) { M.bootGone = now(); mark('bootGone'); } });
  document.addEventListener('DOMContentLoaded', () => { mark('DOMContentLoaded'); mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] }); });
  window.addEventListener('load', () => mark('load'));
})();`;

// a minimal PNG reader (8-bit RGB/RGBA, non-interlaced): enough for the
// stillness score without a dependency
function readPNG(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; }
    else if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp;
  const out = Buffer.alloc(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y > 0 ? out[dst - stride + x] : 0, c = (x >= bpp && y > 0) ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      out[dst + x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}
const stillness = (A, B) => { if (!A || !B || A.w !== B.w || A.h !== B.h) return null;
  let s = 0; for (let i = 0; i < A.data.length; i++) s += Math.abs(A.data[i] - B.data[i]); return +(s / A.data.length).toFixed(2); };

(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400);
    try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const net = new Map(); const netOrder = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data);
    if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); return; }
    if (m.method === 'Network.requestWillBeSent') { const p = m.params; net.set(p.requestId, { url: p.request.url, t0: p.timestamp, type: p.type }); netOrder.push(p.requestId); }
    else if (m.method === 'Network.loadingFinished') { const r = net.get(m.params.requestId); if (r) { r.t1 = m.params.timestamp; r.bytes = m.params.encodedDataLength; } }
    else if (m.method === 'Network.loadingFailed') { const r = net.get(m.params.requestId); if (r) { r.t1 = m.params.timestamp; r.failed = m.params.errorText; } }
  };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const d = r.result; if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? d.exceptionDetails.text : JSON.stringify(r))); return d.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Network.enable', { maxTotalBufferSize: 200000000 });
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: INJECT });
  // a same-origin page first, so the profiler survives the navigation (a
  // cross-origin hop would swap the renderer process)
  await cmd('Page.navigate', { url: ORIGIN + '/__boot_perf_warm__' }); await sleep(800);
  await cmd('Profiler.enable'); await cmd('Profiler.setSamplingInterval', { interval: 500 });
  await cmd('Profiler.start');
  const navT = Date.now();
  await cmd('Page.navigate', { url: URL });
  const shotAt = [0.2, 2, 5]; const taken = new Map(); let bootGoneWall = null;
  const snap = async name => {
    const r = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 0.25 } });
    const buf = Buffer.from(r.result.data, 'base64');
    if (flag('shots')) {
      fs.mkdirSync(SHOTDIR, { recursive: true }); fs.writeFileSync(path.join(SHOTDIR, `boot_${TAG}_${name}.png`), buf);
      // ...and the full frame as a JPEG, for the eye (the PNG quarter is for the score)
      const j = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      fs.writeFileSync(path.join(SHOTDIR, `boot_${TAG}_${name}.jpg`), Buffer.from(j.result.data, 'base64'));
    }
    return readPNG(buf);
  };
  const samples = [];
  // until SECS, and past that until the overlay has been gone 5.5 s (the
  // +5 s shot) - the sample that sees the drop can itself be held back by a
  // post-drop block; hard cap SECS + 30
  const due = () => Date.now() - navT < SECS * 1000 || (bootGoneWall && Date.now() - bootGoneWall < 5500 && Date.now() - navT < (SECS + 30) * 1000);
  while (due()) {
    await sleep(250);
    let s = null; try { s = await ev(`(() => { const M = window.__M || {}; const st = (window.TREE_FILL && TREE_FILL.stat) ? TREE_FILL.stat() : null;
      const B = window.BOOT || null;
      return JSON.stringify({ t: +performance.now().toFixed(0), bootGone: M.bootGone || 0, tree: (typeof window.treeReady === 'function') ? treeReady() : null,
        fill: st ? { live: st.live, queued: st.queued } : null, props: (M.props||[]).length, chars: (M.chars||[]).length,
        boot: B ? { state: B.state, phase: B.current && B.current.id, pending: B.pending ? B.pending() : null } : null }); })()`); } catch (e) { continue; }
    if (!s) continue; s = JSON.parse(s); samples.push(s);
    if (s.bootGone && !bootGoneWall) bootGoneWall = Date.now();
    if (bootGoneWall) for (const k of shotAt) if (!taken.has(k) && Date.now() - bootGoneWall >= k * 1000) taken.set(k, await snap('plus' + k + 's'));
    if (flag('shots') && !s.bootGone && s.boot && s.boot.phase && !taken.has('ph:' + s.boot.phase)) { taken.set('ph:' + s.boot.phase, 1); await snap('loading_' + s.boot.phase); }
  }
  const still = { drop_vs_2s: stillness(taken.get(0.2), taken.get(2)), drop_vs_5s: stillness(taken.get(0.2), taken.get(5)), s2_vs_5s: stillness(taken.get(2), taken.get(5)) };
  let gpu = null; try { gpu = JSON.parse(await ev(`(() => { const r = WORLD.renderer, g = r.getContext(), i = r.info; const d = g.getExtension('WEBGL_debug_renderer_info');
    return JSON.stringify({ programs: i.programs.length, geometries: i.memory.geometries, textures: i.memory.textures,
      parallel: !!g.getExtension('KHR_parallel_shader_compile'), gl: d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER) }); })()`)); } catch (e) { gpu = String(e); }
  const prof = (await cmd('Profiler.stop')).result.profile;
  const M = JSON.parse(await ev('JSON.stringify(window.__M)'));
  let bootLog = null; try { bootLog = JSON.parse(await ev('JSON.stringify(window.BOOT ? BOOT.log : null)')); } catch (e) {}
  // self time by file and function; inclusive time for the boot's named steps
  const nodes = new Map(prof.nodes.map(n => [n.id, n]));
  const selfByNode = new Map();
  for (let i = 0; i < prof.samples.length; i++) selfByNode.set(prof.samples[i], (selfByNode.get(prof.samples[i]) || 0) + (prof.timeDeltas[i] || 0));
  const byFile = new Map(), byFn = new Map(); let total = 0;
  const base = u => u ? u.replace(/\?.*$/, '').replace(/^.*\//, '') : '(native)';
  for (const [nid, us] of selfByNode) { const n = nodes.get(nid); const cf = n.callFrame; total += us;
    const f = base(cf.url) || '(program)'; const fn = f + ' ' + (cf.functionName || '(anon)') + ':' + (cf.lineNumber + 1);
    byFile.set(f, (byFile.get(f) || 0) + us); byFn.set(fn, (byFn.get(fn) || 0) + us); }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, +(v / 1000).toFixed(0)]);
  const parent = new Map(); for (const n of prof.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
  const KEYS = ['buildWorldScene', 'makeWorld', 'genHangarBuild', 'buildGen', 'CAGE_UI_BOOT', 'bakeImpostorAtlasNow', 'plantWoodland', 'bakeHangarEnv', 'renderSky', 'openEditor', 'setAircraft', 'seedEditor', 'buildModel', 'makeIsland', 'bakeGroundShadow', 'syncBuild', 'fromScene', 'fillStep', 'compileAsync', 'compile', 'makeSim', 'getHangar', 'enterGarage', 'treeBuild', 'coverageMips', 'decodeModel', 'fillPropMesh', 'genShakedown', 'bakeGround', 'apply', 'render', 'colorAt', 'terrainH', 'surface', 'h0a', 'forestHere', 'walk', 'treeSettle'];
  const incl = new Map();
  for (const [nid, us] of selfByNode) { let p = nid; const seen = new Set();
    while (p !== undefined) { const n = nodes.get(p); const fn = n.callFrame.functionName; const key = fn + ' @' + base(n.callFrame.url);
      if (KEYS.includes(fn) && !seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) || 0) + us); } p = parent.get(p); } }
  const reqs = netOrder.map(r => net.get(r)).filter(r => r && r.t1);
  const t0n = Math.min(...reqs.map(r => r.t0));
  const netRows = reqs.map(r => ({ url: r.url.replace(ORIGIN + '/flyDiy/', ''), t0: +((r.t0 - t0n) * 1000).toFixed(0), t1: +((r.t1 - t0n) * 1000).toFixed(0), kb: +((r.bytes || 0) / 1024).toFixed(0), type: r.type, failed: r.failed }));
  const bytesByDir = new Map(); for (const r of netRows) { const d = r.url.replace(/\?.*$/, '').split('/').slice(0, 2).join('/'); bytesByDir.set(d, (bytesByDir.get(d) || 0) + r.kb); }
  const byType = {}; for (const r of netRows) byType[r.type] = (byType[r.type] || 0) + r.kb;
  const longSum = M.longTasks.reduce((a, e) => a + e.d, 0);
  const longTop = M.longTasks.slice().sort((a, b) => b.d - a.d).slice(0, 8);
  const out = { url: URL, tag: TAG, cold: flag('cold'), secs: SECS, date: new Date().toISOString().slice(0, 10), gpu,
    milestones: M.ev, bootGone: M.bootGone || null, bootLog, paints: M.paints, propsLanded: M.props.length, charsLanded: M.chars.length,
    fetches: M.fetches.length, longTaskTotalMs: longSum, longTasks: longTop, profileTotalMs: +(total / 1000).toFixed(0), stillness: still,
    byFile: top(byFile, 25), byFn: top(byFn, 40), inclusive: [...incl].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / 1000).toFixed(0)]),
    netTotalKB: netRows.reduce((a, r) => a + r.kb, 0), netRequests: netRows.length, netFailed: netRows.filter(r => r.failed).length,
    netByType: byType, bytesByDir: [...bytesByDir].sort((a, b) => b[1] - a[1]).slice(0, 12), samples };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`boot_perf ${TAG}  ${URL}\n  gpu ${gpu && gpu.gl}  programs ${gpu && gpu.programs}  parallel-compile ${gpu && gpu.parallel}`);
  console.log('  milestones: ' + M.ev.map(e => e.k + '@' + e.t).join('  '));
  if (bootLog) {
    // the steps with their ms, the marks, and the landings folded per key
    const marks = bootLog.filter(e => e.k !== 'landed').map(e => e.k + (e.id ? ':' + e.id : '') + '@' + e.t + (e.ms !== undefined ? ' (' + e.ms + ' ms)' : ''));
    const perKey = {}; for (const e of bootLog) if (e.k === 'landed') { const q = perKey[e.key] || (perKey[e.key] = { n: 0, failed: 0, last: 0 }); q.n++; if (!e.ok) q.failed++; q.last = e.t; }
    console.log('  BOOT.log:   ' + marks.join('  '));
    console.log('  landings:   ' + Object.entries(perKey).map(([k, q]) => k + ' ' + q.n + (q.failed ? ' (' + q.failed + ' failed)' : '') + ' by ' + q.last).join('  '));
  }
  console.log(`  overlay gone ${M.bootGone} ms   long tasks ${longSum} ms in ${M.longTasks.length}: ` + longTop.map(t => t.d + '@' + t.t).join(' '));
  console.log(`  stillness (mean |dpx|, 0 = nothing changed after the drop): drop->2s ${still.drop_vs_2s}  drop->5s ${still.drop_vs_5s}  2s->5s ${still.s2_vs_5s}`);
  console.log(`  network ${(out.netTotalKB / 1024).toFixed(1)} MB / ${out.netRequests} req (failed ${out.netFailed})  ` + Object.entries(byType).map(([k, v]) => k + ' ' + (v / 1024).toFixed(1) + ' MB').join(', '));
  console.log('  props landed ' + M.props.length + '  chars ' + M.chars.length + '  ASSET_FETCH ' + M.fetches.length);
  console.log('  inclusive ms: ' + out.inclusive.slice(0, 16).map(([k, v]) => pad(k.split(' @')[0], 18) + v).join('\n                '));
  console.log('  self by file ms: ' + out.byFile.slice(0, 10).map(([k, v]) => k + ' ' + v).join(', '));
  if (COMPARE && fs.existsSync(COMPARE)) { const c = JSON.parse(fs.readFileSync(COMPARE, 'utf8'));
    console.log(`  vs ${path.basename(COMPARE)}: overlay gone ${c.bootGone} -> ${M.bootGone} ms; long tasks ${c.longTaskTotalMs} -> ${longSum} ms; network ${(c.netTotalKB / 1024).toFixed(1)} -> ${(out.netTotalKB / 1024).toFixed(1)} MB; programs ${c.gpu && c.gpu.programs} -> ${gpu && gpu.programs}`); }
  console.log('  wrote ' + path.relative(process.cwd(), OUT));
  ws.close(); ch.kill();
})().catch(e => { console.error(e); ch.kill(); process.exit(1); });
