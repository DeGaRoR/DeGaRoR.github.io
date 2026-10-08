#!/usr/bin/env node
// potato_census.js - WHAT A POTATO FRAME ASKS OF THE CARD, PHASE BY PHASE (POTATO-DEEP, G1520).
//
// The box's RTX 3080 is ~10x a GTX 660, so its milliseconds do not transfer; what does: the triangles and draws a frame,
// the programs and what each one draws, the render-target passes, the resolution, the bytes held on the GPU - and the
// SHARE of the GPU frame each part of the scene takes (hidden one at a time, the frame timed with
// EXT_disjoint_timer_query: the 3080's share is the card's share to first order, where the cost is fill and vertices).
// One headed Chrome (the live clock), its own short profile, the page at the user's 1920 x 911, ?gfx=<preset>:
//   garage  the shed after the boot (the hangar scene)
//   stand   the roll-out done, the flight paused, the chase camera
//   taxi    "Fly the circuit" pressed, ~TAXI s of the pilot's taxi, paused
//   low     the climb-out, paused once AGL > LOWAGL m (a low pass over the field)
// At each: FRAMES frames timed (rAF to rAF + the GPU), renderer.info over one frame (every render() of it), the draws and
// triangles by OWNER (the scene's top-level child, by name) and by PROGRAM, the render targets drawn, the VRAM held
// (tools/perf/potato_vram_hook.js, from document start), a screenshot, and with --split the GPU ms of each owner (hidden,
// re-timed, restored).
// Usage: node tools/perf/potato_census.js --out <json> [--q 'gfx=potato'] [--size 1920x911] [--page index.html]
//          [--views garage,stand,taxi,low] [--split] [--frames 60] [--shots <dir>] [--build default|<file.json>]
//          [--taxi 25] [--lowagl 60] [--sport 8571] [--dport 9471] [--udd C:/pdc]
// A GPU MEASUREMENT: take tools/perf/boxlock.sh take gpu <WHO> first, drop it after. Rigs have no --help.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(opt('out', 'potato_census.json'));
const Q = opt('q', opt('gfxpref', null) ? '' : 'gfx=potato'),   // G1532b.1: a seeded --gfxpref boots WITHOUT ?gfx= (it would override the pref)
      PAGE = opt('page', 'index.html'), SIZE = opt('size', '1920x911').split('x').map(Number);
const VIEWS = opt('views', 'garage,stand,taxi,low').split(','), SPLIT = flag('split'), FRAMES = +opt('frames', 60);
const SHOTS = opt('shots', null), BUILD = opt('build', 'default'), TAXI = +opt('taxi', 25), LOWAGL = +opt('lowagl', 60);
const SPORT = +opt('sport', 8571), DPORT = +opt('dport', 9471), UDD = opt('udd', 'C:/pdc');
const EVAL = opt('eval', null);
// --orbits 'name:az,el,dist;...' (G1527): at the stand (paused) the chase orbit set to each, the streams given ORBIT_WAIT s, a still
// each (<shots>/orbit_<name>.jpg) - the distant runway from 300 m to 2 km; az/el in degrees, dist in m
const ORBITS = (opt('orbits', '') || '').split(';').filter(Boolean).map(s => { const [n, v] = s.split(':'); const [a, e, d] = v.split(',').map(Number); return { n, a, e, d }; });
const ORBIT_WAIT = +opt('orbit-wait', 6);
// --detail (G1530): at the stand, after the orbits, two EYE-HEIGHT views by the free camera (FLIGHT_PROBE.devFree): 8 m off HOME's
// runway edge looking 25 m along it, and 6 m off the nearest road's edge (world.premises.overlay.pavedAt) looking 25 m along it
const DETAIL = flag('detail');
// --eval-stand <file> (G1531): a page body (an async function's, `return` its result) run at the paused stand BEFORE its census -
// a live switch and its diagnosis; the result lands in the JSON (evalStand) and on stdout
const EVAL_STAND = opt('eval-stand', null) ? fs.readFileSync(path.resolve(opt('eval-stand', null)), 'utf8') : null;
const EDGES = `
  const wd = FLIGHT_PROBE.world(), A = wd.aerodromes.find(a => a.id === 'HOME') || wd.aerodromes[0], H = (x, z) => wd.terrainH(x, z);
  const look = (e, t) => { const f = [t[0] - e[0], t[1] - e[1], t[2] - e[2]], l = Math.hypot(f[0], f[1], f[2]); return [Math.atan2(f[0] / l, -f[2] / l), Math.asin(f[1] / l)]; };
  const out = {};
  { const dir = [Math.cos(A.hdg), Math.sin(A.hdg)], perp = [-dir[1], dir[0]], s0 = A.len * 0.15;
    const ex = A.x + dir[0] * s0 + perp[0] * A.wid / 2, ez = A.z + dir[1] * s0 + perp[1] * A.wid / 2;
    const eye = [ex + perp[0] * 8, H(ex + perp[0] * 8, ez + perp[1] * 8) + 1.8, ez + perp[1] * 8], tx = ex + dir[0] * 25, tz = ez + dir[1] * 25;
    out.rwyEdge = { eye, yp: look(eye, [tx, H(tx, tz), tz]) }; }
  const PO = wd.premises && wd.premises.overlay;
  if (PO && PO.pavedAt) { let best = null;
    for (let r = 60; r <= 900 && !best; r += 20) for (let k = 0; k < 64 && !best; k++) { const a = k / 64 * 2 * Math.PI, x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r;
      const q = PO.pavedAt(x, z); if (q && q.kind === 'road' && q.d > 0.2 && q.d < 1.2) best = [x, z]; }
    if (best) { const dd = (x, z) => { const q = PO.pavedAt(x, z); return q && q.kind === 'road' ? q.d : -1; };
      const gx = dd(best[0] + 2, best[1]) - dd(best[0] - 2, best[1]), gz = dd(best[0], best[1] + 2) - dd(best[0], best[1] - 2), gl = Math.hypot(gx, gz) || 1;
      const o = [-gx / gl, -gz / gl], t = [-o[1], o[0]];
      const eye = [best[0] + o[0] * 6, H(best[0] + o[0] * 6, best[1] + o[1] * 6) + 1.8, best[1] + o[1] * 6], tx = best[0] + t[0] * 25, tz = best[1] + t[1] * 25;
      out.roadEdge = { eye, yp: look(eye, [tx, H(tx, tz), tz]), at: best }; } }
  return out;`;
// --ab <file.json>: { "<name>": { "on": "<js>", "off": "<js>", "views": "stand,taxi" }, ... } - at each listed view (default every
// world view) each toggle is switched on, the frame re-counted (draws, triangles) and re-timed, then switched off again
const AB = opt('ab', null) ? JSON.parse(fs.readFileSync(path.resolve(opt('ab', null)), 'utf8')) : null;   // an extra page expression run after the boot, before the garage census (an A/B toggle)
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
if (!flag('warm')) try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {}
const server = spawn(process.execPath, [path.join(ROOT, 'flyDiy/tools/_serve.js'), String(SPORT), ROOT, '--fallback', 'D:/Dev/DeGaRoR.github.io'], { stdio: 'ignore' });
const ch = spawn(CHROME, ['--remote-debugging-port=' + DPORT, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140), '--window-position=0,0', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + UDD, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
let cmdRef = null;
const kill = () => { for (const p of [ch, server]) try { execSync('taskkill /PID ' + p.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
process.on('exit', kill); process.on('SIGINT', () => process.exit(0)); process.on('SIGTERM', () => process.exit(0));

// the census of one view, in the page (returns JSON)
const CENSUS = (frames, split) => `
  const R = FLIGHT_PROBE.renderer(), gl = R.getContext(), X = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  // (a capped frame clock draws on some rAFs only: the GPU is summed over the window and divided by the frames DRAWN - the
  // AA pass's render() calls that presented, counted by a wrapper)
  const AAo = window.FLYDIY_AA; let drawn = 0; const aar = AAo && AAo.render;
  if (aar && !AAo.__pc) { AAo.__pc = true; AAo.render = function () { const v = aar.apply(this, arguments); if (v !== 'held') window.__PC_DRAWN = (window.__PC_DRAWN || 0) + 1; return v; }; }
  const timeFrames = N => new Promise(r => {
    const ft = [], gpu = [], open = []; let i = 0, last = performance.now(), q = null; const d0 = window.__PC_DRAWN || 0;
    const f = now => {
      if (X && q) { gl.endQuery(X.TIME_ELAPSED_EXT); open.push(q); q = null; }
      for (let k = open.length - 1; k >= 0; k--) { const o = open[k];
        if (gl.getQueryParameter(o, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(X.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(o, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(o); open.splice(k, 1); } }
      if (i) ft.push(now - last); last = now;
      if (++i > N) { const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
        const nd = (window.__PC_DRAWN || 0) - d0, wall = ft.reduce((a, b) => a + b, 0), gsum = gpu.reduce((a, b) => a + b, 0);
        return r({ rafMs: med(ft), drawn: nd, fps: +(1000 * nd / Math.max(1, wall)).toFixed(1), gpuMs: nd ? +(gsum * (ft.length / Math.max(1, gpu.length)) / nd).toFixed(3) : null, gpuN: gpu.length }); }
      if (X) { q = gl.createQuery(); gl.beginQuery(X.TIME_ELAPSED_EXT, q); }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  // one frame's every render(): info held, every draw attributed (owner = the scene's top-level child, program, target)
  const byOwner = {}, byProg = {}, byTarget = {}, rootOf = o => { let p = o, n = o; while (p.parent && p.parent.parent) { p = p.parent; } return p; };
  const keyOf = o => { const r = rootOf(o); return (r.name || (r.isMesh || r.isInstancedMesh ? (r.type + ':' + ((r.material && (r.material.name || r.material.type)) || '')) : r.type)) || '?'; };
  const rbd = R.renderBufferDirect; let curTarget = 'canvas';
  const rt0 = R.setRenderTarget;
  R.setRenderTarget = function (t) { curTarget = t ? ((t.texture && (t.texture.name || '')) || '') + ' ' + t.width + 'x' + t.height + (t.samples ? ' s' + t.samples : '') + (t.isWebGLCubeRenderTarget ? ' cube' : '') : 'canvas'; return rt0.apply(this, arguments); };
  R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    try {
      let n = geometry.index ? geometry.index.count : (geometry.attributes.position ? geometry.attributes.position.count : 0);
      if (group) n = Math.min(n, group.count); n = Math.min(n, geometry.drawRange.count === Infinity ? n : geometry.drawRange.count);
      let inst = object.isInstancedMesh ? object.count : (geometry.isInstancedBufferGeometry ? geometry.instanceCount : 1);
      if (inst === Infinity || inst == null) inst = 1;
      const tris = material.wireframe ? 0 : (object.isMesh ? n / 3 * inst : 0);
      const k = keyOf(object), pk = (material.name || material.type) + (material.defines && material.defines.USE_SPLAT ? '+splat' : '');
      const add = (M, key) => { const e = M[key] || (M[key] = { draws: 0, ktris: 0 }); e.draws++; e.ktris += tris / 1000; };
      add(byOwner, k); add(byProg, pk); add(byTarget, curTarget);
    } catch (e) {}
    return rbd.apply(this, arguments);
  };
  R.info.autoReset = false;
  for (let tries = 0; tries < 8; tries++) {   // the first rAF that DRAWS (a capped clock skips some)
    R.info.reset(); for (const M of [byOwner, byProg, byTarget]) for (const k in M) delete M[k];
    const d0 = window.__PC_DRAWN || 0; await nextFrame(); if ((window.__PC_DRAWN || 0) > d0 && R.info.render.calls > 0) break; }
  const info = { calls: R.info.render.calls, ktris: +(R.info.render.triangles / 1000).toFixed(1), points: R.info.render.points, lines: R.info.render.lines, programs: R.info.programs.length, textures: R.info.memory.textures, geometries: R.info.memory.geometries };
  R.info.autoReset = true; R.renderBufferDirect = rbd; R.setRenderTarget = rt0;
  const rnd = M => Object.fromEntries(Object.entries(M).sort((a, b) => b[1].ktris - a[1].ktris).map(([k, v]) => [k, { draws: v.draws, ktris: +v.ktris.toFixed(1) }]));
  const timed = await timeFrames(${frames});
  const sz = new THREE.Vector2(); R.getDrawingBufferSize(sz);
  const AA = window.FLYDIY_AA;
  const out = { timed, info, byOwner: rnd(byOwner), byProg: rnd(byProg), byTarget: rnd(byTarget), canvas: [sz.x, sz.y], scale: AA && AA.scale ? AA.scale() : null,
    vram: window.__VRAM ? __VRAM.sum(40) : null, gfx: window.GFX ? GFX.get() : null, budget: window.GFX && GFX.budget ? GFX.budget() : null,
    agl: FLIGHT_PROBE.agl ? FLIGHT_PROBE.agl() : null, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(0) : null };
  // THE BIG ALLOCATIONS NAMED: every texture a material of either scene holds (its maps and its uniforms), and the renderer's
  // targets, mapped GL object -> the three texture's name / the material's / the object's top-level owner
  if (out.vram) {
    const names = new Map();
    const tag = (t, who) => { if (!t || !t.isTexture) return; const p = R.properties.get(t); const g = p && p.__webglTexture; if (g && !names.has(g)) names.set(g, (t.name ? t.name + ' @ ' : '') + who); };
    const walk = sc => { if (!sc) return; sc.traverse(o => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) { const who = keyOf(o) + ' / ' + (m.name || m.type);
        for (const k in m) { const v = m[k]; if (v && v.isTexture) tag(v, who + '.' + k); }
        if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture) tag(v, who + '.' + k); else if (Array.isArray(v)) v.forEach(x => tag(x, who + '.' + k)); }
        if (m.userData && m.userData.shader && m.userData.shader.uniforms) for (const k in m.userData.shader.uniforms) { const v = m.userData.shader.uniforms[k].value; if (v && v.isTexture) tag(v, who + '.' + k); } } }); };
    walk(window.WORLD && WORLD.scene); walk(FLIGHT_PROBE.hangarScene && FLIGHT_PROBE.hangarScene());
    if (window.WORLD && WORLD.scene && WORLD.scene.environment) tag(WORLD.scene.environment, 'world.environment');
    for (const t of out.vram.top) { t.name = names.get(t.o) || null; delete t.o; }
    // every texture and target by OWNER (the name's part after '@' or before the first '/'), the rest by its shape
    const own = {}; const MB = x => +(x / 1048576).toFixed(1);
    for (const a of out.vram.all) { if (a.kind === 'buffer') continue; const n = names.get(a.o); const k = n ? (n.split(' @ ').pop().split(' / ')[0]) : ('? ' + a.kind + ' ' + a.w + 'x' + a.h + (a.d > 1 ? 'x' + a.d : '')); own[k] = (own[k] || 0) + a.bytes; }
    { const nm = {}; for (const a of out.vram.all) { const n = names.get(a.o); if (!n || a.kind === 'buffer') continue; const k = n.replace(/#\d+/g, '') + ' ' + a.w + 'x' + a.h + (a.d > 1 ? 'x' + a.d : ''); nm[k] = (nm[k] || 0) + a.bytes; }
      out.vram.texByNameMB = Object.fromEntries(Object.entries(nm).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => [k, MB(v)])); }
    out.vram.texByOwnerMB = Object.fromEntries(Object.entries(own).sort((a, b) => b[1] - a[1]).filter(e => e[1] > 524288).map(([k, v]) => [k, MB(v)]));
    delete out.vram.all;
    // the geometry's bytes by owner (the attributes' and indices' sizes, uploaded whether or not the CPU copy was released)
    const geo = {}, seen = new Set();
    const gwalk = sc => { if (sc) sc.traverse(o => { const g = o.geometry; if (!g || seen.has(g)) return; seen.add(g); let b = 0;
      for (const k in g.attributes) { const a = g.attributes[k], arr = a.array || (a.data && a.data.array); b += a.count * a.itemSize * (arr && arr.BYTES_PER_ELEMENT || 4); }
      if (g.index) b += g.index.count * (g.index.array && g.index.array.BYTES_PER_ELEMENT || 4);
      if (o.isInstancedMesh && o.instanceMatrix) b += o.instanceMatrix.count * 64;
      const k = keyOf(o); geo[k] = (geo[k] || 0) + b; }); };
    gwalk(window.WORLD && WORLD.scene); gwalk(FLIGHT_PROBE.hangarScene && FLIGHT_PROBE.hangarScene());
    out.vram.geoByOwnerMB = Object.fromEntries(Object.entries(geo).sort((a, b) => b[1] - a[1]).filter(e => e[1] > 524288).map(([k, v]) => [k, MB(v)]));
  }
  if (${split ? 'true' : 'false'}) {
    // THE OWNERS' GPU SHARE: each top-level child hidden in turn (grouped by key), the frame re-timed
    const sc = window.__INWORLD ? (window.WORLD && WORLD.scene) : (FLIGHT_PROBE.hangarScene && FLIGHT_PROBE.hangarScene());
    const roots = new Map();
    const top = sc ? sc.children : [];
    // (a top-level group of many children - the shed is ONE group holding the room, the props, the lamps, the crew - is split
    // one level down, its children keyed by their own name or their first named descendant)
    const nameIn = o => { let n = o.name; if (!n) o.traverse(x => { if (!n && x.name) n = x.name; }); return n || keyOf(o); };
    for (const c of top) {
      if (c.children && c.children.length > 6 && !c.isMesh) { for (const d of c.children) { const k = (c.name || c.type) + '/' + nameIn(d).replace(/[#_]?\d+$/, ''); if (!roots.has(k)) roots.set(k, []); roots.get(k).push(d); } continue; }
      const k = c.name || keyOf(c); if (!roots.has(k)) roots.set(k, []); roots.get(k).push(c); }
    const base = await timeFrames(40); out.split = { base: base.gpuMs, owners: {} };
    for (const [k, list] of roots) {
      if (!list.some(o => o.visible)) continue;
      const was = list.map(o => o.visible); list.forEach(o => { o.visible = false; });
      const t = await timeFrames(30); list.forEach((o, i) => { o.visible = was[i]; });
      out.split.owners[k] = { n: list.length, gpuMs: t.gpuMs, saved: t.gpuMs != null && base.gpuMs != null ? +(base.gpuMs - t.gpuMs).toFixed(3) : null };
    }
    out.split.after = (await timeFrames(40)).gpuMs;
  }
  return out;`;

(async () => {
  let tgt = null;
  for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const errs = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 300)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  cmdRef = cmd;
  const run = async body => { const r = await cmd('Runtime.evaluate', { expression: '(async()=>{ ' + body + '\n })()', awaitPromise: true, returnByValue: true }); const d = r.result;
    if (!d || d.exceptionDetails) return 'ERR ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)); return d.result.value; };
  const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return Date.now() - t0; await sleep(500); } throw new Error('timed out: ' + what); };
  const pre = [fs.readFileSync(path.join(__dirname, 'potato_vram_hook.js'), 'utf8'),
    'try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|gfx$|premises\\.game)/.test(k)) localStorage.removeItem(k);}catch(e){}'];
  // --gfxpref '<json>' (G1531): a saved graphics choice seeded before the page (after the clear) - e.g. potato's rows on a lean ground
  if (opt('gfxpref', null)) pre.push('try{localStorage.setItem("flydiy.gfx",' + JSON.stringify(opt('gfxpref', null)) + ')}catch(e){}');
  if (BUILD === 'default') pre.push('try{localStorage.removeItem("flydiy.wip")}catch(e){}');
  else pre.push('try{localStorage.setItem("flydiy.wip",' + JSON.stringify(fs.readFileSync(path.resolve(ROOT, 'flyDiy', BUILD), 'utf8')) + ')}catch(e){}');
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: pre.join('\n') });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  const url = 'http://localhost:' + SPORT + '/flyDiy/' + PAGE + (Q ? '?' + Q : '');
  const T0 = Date.now();
  await cmd('Page.navigate', { url });
  console.log('nav ' + url);
  const res = { url, size: SIZE, q: Q, views: {}, errs, t: {} };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  const shot = async name => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 88 }); fs.writeFileSync(path.join(SHOTS, name + '.jpg'), Buffer.from(r.result.data, 'base64')); };
  // one frame's count and a timed window, no attribution (the A/B's reading)
  const QUICK = `const R = FLIGHT_PROBE.renderer(), gl = R.getContext(), X = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
    for (let i = 0; i < 20; i++) await nextFrame();
    R.info.autoReset = false; let calls = 0, tris = 0;
    for (let t = 0; t < 8; t++) { R.info.reset(); const d0 = window.__PC_DRAWN || 0; await nextFrame(); if ((window.__PC_DRAWN || 0) > d0 && R.info.render.calls > 0) { calls = R.info.render.calls; tris = R.info.render.triangles; break; } }
    R.info.autoReset = true;
    const g = await new Promise(r => { const gpu = [], open = []; let i = 0, q = null; const d0 = window.__PC_DRAWN || 0;
      const f = () => { if (X && q) { gl.endQuery(X.TIME_ELAPSED_EXT); open.push(q); q = null; }
        for (let k = open.length - 1; k >= 0; k--) { const o = open[k]; if (gl.getQueryParameter(o, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(X.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(o, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(o); open.splice(k, 1); } }
        if (++i > 60) { const nd = (window.__PC_DRAWN || 0) - d0, gs = gpu.reduce((a, b) => a + b, 0); return r(nd ? +(gs * (60 / Math.max(1, gpu.length)) / nd).toFixed(3) : null); }
        if (X) { q = gl.createQuery(); gl.beginQuery(X.TIME_ELAPSED_EXT, q); } requestAnimationFrame(f); };
      requestAnimationFrame(f); });
    return { calls, ktris: +(tris / 1000).toFixed(1), gpuMs: g, vramMB: window.__VRAM ? __VRAM.sum(0).totalMB : null };`;
  const census = async (view, split) => { await run('window.__INWORLD = ' + (view !== 'garage') + '; return 1;'); const c = await run(CENSUS(FRAMES, split)); res.views[view] = c; save();
    if (AB && typeof c === 'object') { c.ab = { base: await run(QUICK) };
      for (const [name, t] of Object.entries(AB)) { if (t.views && !t.views.split(',').includes(view)) continue;
        const on = await run(t.on + ';\n return 1;'); const m = await run(QUICK); const off = await run(t.off + ';\n return 1;'); const back = await run(QUICK);
        c.ab[name] = { on: m, back, err: [on, off].filter(x => typeof x === 'string').join(' ') || undefined };
        console.log('  ab ' + view + ' ' + name + ': ' + JSON.stringify(m) + '  (back ' + JSON.stringify(back) + ')' + (c.ab[name].err ? ' ' + c.ab[name].err : '')); }
      console.log('  ab ' + view + ' base: ' + JSON.stringify(c.ab.base)); save(); }
    if (typeof c === 'string') console.log(view + ': ' + c.slice(0, 400));
    else console.log(view + ': ' + c.timed.fps + ' fps drawn, GPU ' + c.timed.gpuMs + ' ms, calls ' + c.info.calls + ', ktris ' + c.info.ktris + ', programs ' + c.info.programs + ', VRAM ' + (c.vram && c.vram.totalMB) + ' MB, canvas ' + c.canvas + ' scale ' + c.scale); };
  res.t.garage = await until(`window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE`, 900000, 'the garage boot');
  console.log('garage up in ' + ((Date.now() - T0) / 1000).toFixed(1) + ' s');
  res.boot = await run('return window.BOOT && BOOT.log ? BOOT.log.filter(e => e.k === "step").map(e => [e.id, e.ms]) : null;');
  // the first launch's chooser over the shed: keep the build it offers (the still shows the room, not the cards)
  await run(`for (const b of document.querySelectorAll('button, [role=button], div, span')) { if (/^\s*keep the current build\s*$/i.test(b.textContent || '') && b.offsetParent) { b.click(); break; } } return 1;`);
  if (EVAL) console.log('eval: ' + JSON.stringify(await run(EVAL)).slice(0, 300));
  await sleep(8000);
  if (VIEWS.includes('garage')) { await census('garage', SPLIT); await shot('garage'); }
  if (VIEWS.some(v => v !== 'garage')) {
    const t1 = Date.now();
    await run(`document.getElementById('bGo').click(); return 1;`);
    await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
    res.t.rollout = Date.now() - t1; console.log('roll-out ' + (res.t.rollout / 1000).toFixed(1) + ' s');
    await run('if (FLIGHT_PROBE.camSettle) FLIGHT_PROBE.camSettle(); return 1;');
    await sleep(6000);
    if (VIEWS.includes('stand')) {
      if (!(await run('return !!window.FLYDIY_HELD;'))) await run(`document.getElementById('bPause').click(); return 1;`);
      await sleep(4000);
      if (EVAL_STAND) { const r = await run(EVAL_STAND); res.evalStand = r; save(); console.log('evalStand ' + JSON.stringify(r).slice(0, 3000)); await shot('stand_evalStand'); }
      await census('stand', SPLIT); await shot('stand');
      for (const O of ORBITS) {
        await run(`FLIGHT_PROBE.camSet(${O.a * Math.PI / 180}, ${O.e * Math.PI / 180}, ${O.d}); return 1;`);
        await sleep(ORBIT_WAIT * 1000); await shot('orbit_' + O.n); console.log('orbit ' + O.n); }
      if (DETAIL) { const E = await run(EDGES); res.edges = E; console.log('edges ' + JSON.stringify(E).slice(0, 300));
        for (const k of ['rwyEdge', 'roadEdge']) { const v = E && E[k]; if (!v) { console.log('no ' + k); continue; }
          await run(`return FLIGHT_PROBE.devFree(${v.eye[0]}, ${v.eye[1]}, ${v.eye[2]}, ${v.yp[0]}, ${v.yp[1]});`); await sleep(ORBIT_WAIT * 1000); await shot('edge_' + k); console.log('edge ' + k); }
        await run(`FLIGHT_PROBE.camMode('chase'); return 1;`); await sleep(2000); }
      await run(`if (window.FLYDIY_HELD) document.getElementById('bPause').click(); return 1;`);
    }
    if (VIEWS.includes('taxi') || VIEWS.includes('low')) {
      await run(`document.getElementById('bGo').click(); return 1;`);   // Fly the circuit: the pilot taxis
      await sleep(TAXI * 1000);
      if (VIEWS.includes('taxi')) { await run(`if (!window.FLYDIY_HELD) document.getElementById('bPause').click(); return 1;`); await sleep(3000); await census('taxi', SPLIT); await shot('taxi');
        await run(`if (window.FLYDIY_HELD) document.getElementById('bPause').click(); return 1;`); }
      if (VIEWS.includes('low')) {
        try { await until(`FLIGHT_PROBE.agl() > ${LOWAGL}`, 400000, 'the climb-out'); } catch (e) { console.log(e.message); }
        await run(`if (!window.FLYDIY_HELD) document.getElementById('bPause').click(); return 1;`); await sleep(3000); await census('low', SPLIT); await shot('low');
      }
    }
  }
  res.wall = Date.now() - T0; save();
  console.log('POTATO_CENSUS ' + JSON.stringify(Object.fromEntries(Object.entries(res.views).map(([k, c]) => [k, typeof c === 'string' ? c.slice(0, 80) : { gpu: c.timed.gpuMs, fps: c.timed.fps, calls: c.info.calls, ktris: c.info.ktris, vramMB: c.vram && c.vram.totalMB }]))));
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(500);
  process.exit(0);
})().catch(e => { console.log('FATAL ' + e.stack); process.exit(1); });
