#!/usr/bin/env node
// imp_audit.js - THE IMPOSTOR SHEETS AND THE FAR BAND, MEASURED (B1, 2026-09-20)
//
//   node tools/imp_audit.js --url http://localhost:8463/flyDiy/dev.html [--out screenshots/imp_audit]
//        [--agl 110] [--at x,z] [--cam az,el,dist] [--rig alps|sunset] [--bench] [--wait 12000]
//        [--probe "<js>" | --probe-file f.js] [--probe-only]
//
// WHY. The far band is a render nobody sees twice: the sheet is baked at boot
// into a target, sampled through three taps, a mip chain, an alpha curve and
// the rig, and when it comes out dark or thin nothing on the screen says which
// of those did it (TREE-IMPORT.md §6: six faults, every one presenting as "the
// impostor is wrong"). This reads the instruments back instead of looking:
//
//   1. THE SHEETS. Every atlas the game baked (WORLD.treeAtlases, named by
//      subject and series) is read back from its target: per-tile coverage at
//      the series' cut, the mean LINEAR albedo of the covered texels, the alpha
//      histogram (a binary sheet has two bins), and a contact-sheet PNG of the
//      albedo over grey - what the impostor has to work with, before any light.
//   2. THE A/B. The same stand from the same eye drawn three ways - the
//      default ladder, ALL geometry (the near band pushed to 1.2 km), ALL
//      impostors (the near band at 10 m) - a screenshot each and the mean
//      luminance over the forest box. Geometry vs impostor at matched distance
//      is the number the tier gain (WORLD.treeLod.lit) is meant to hold at 1.0;
//      the "dark" is that ratio and the "thin" is the covered-pixel count.
//   3. --bench: the tree bench (tools/_trees.html) in a second page, the same
//      conifer mix, its own sheets read the same way, so the two pipelines are
//      compared texel for texel rather than by eye across two windows.
//
// Headless Chrome on this machine's GPU (tree_perf.js's rig), the game rolled
// out, teleported to the densest stand within 2.5 km (or --at) at --agl and
// HELD (paused), the streamer settled. Output: the PNGs and a JSON in --out
// (gitignored evidence), the JSON again in tools/perf/imp_audit.json, a table
// on stdout. Run it after any change to the bake, the leaf terms or the rig.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = k => argv.includes('--' + k);
const URL = opt('url', 'http://localhost:8463/flyDiy/dev.html');
const OUT = opt('out', 'screenshots/imp_audit');   // the pictures (gitignored evidence, the 2026-09-14 ruling); the JSON also lands in tools/perf/
const AGL = +opt('agl', 110);
const AT = opt('at', null) ? opt('at').split(',').map(Number) : null;
const CAM = opt('cam', null) ? opt('cam').split(',').map(Number) : null;
const RIG = opt('rig', null);
const WAIT = +opt('wait', 12000);
const BENCH = has('bench');
const BOX = (opt('box', '0.05,0.35,0.95,0.75')).split(',').map(Number);   // the forest box, fractions of the frame
const PORT = 9500 + (process.pid % 400);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('imp_audit: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_imp_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const putJSON = url => new Promise((res, rej) => { const q = http.request(url, { method: 'PUT' }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }); q.on('error', rej); q.end(); });

// a minimal PNG reader (8-bit RGB/RGBA, non-interlaced) - boot_perf.js's
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
const toLin = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
// the mean luminance of a box of the frame: encoded (what the eye gets) and linear (what the rig put there)
function boxStats(img, box) {
  const x0 = Math.floor(box[0] * img.w), y0 = Math.floor(box[1] * img.h), x1 = Math.floor(box[2] * img.w), y1 = Math.floor(box[3] * img.h);
  let n = 0, enc = 0, lin = 0, dark = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * img.w + x) * img.bpp;
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const ye = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    enc += ye; lin += 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b); n++;
    if (ye < 40) dark++;
  }
  return { n, enc: +(enc / n).toFixed(2), lin: +(lin / n).toFixed(4), dark: +(dark / n).toFixed(4) };
}

// ---- the page-side probes ------------------------------------------------
const TELEPORT = `(() => {
  const w = (window.FLIGHT_PROBE && FLIGHT_PROBE.world) ? FLIGHT_PROBE.world() : makeWorld();
  const AT = ${JSON.stringify(AT)};
  let best = null, bn = -1;
  if (AT) best = { x: AT[0], z: AT[1] };
  else {
    const T = w.trees.filter(t => Math.hypot(t.x, t.z) < 2500);
    for (let i = 0; i < T.length; i += 7) { const a = T[i]; let n = 0;
      for (const b of T) if (Math.abs(b.x - a.x) < 120 && Math.abs(b.z - a.z) < 120) n++;
      if (n > bn) { bn = n; best = a; } }
  }
  const gy = w.terrainH(best.x, best.z);
  const s = FLIGHT_PROBE.sim(); const cg = s.cgPos();
  const dx = best.x - cg[0], dy = (gy + ${AGL}) - cg[1], dz = best.z - cg[2];
  for (let i = 0; i < s.n; i++) { s.p[i*3] += dx; s.p[i*3+1] += dy; s.p[i*3+2] += dz; s.v[i*3] = s.v[i*3+1] = s.v[i*3+2] = 0; }
  const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
  return JSON.stringify({ stand: [best.x | 0, best.z | 0], neighbours: bn, agl: ${AGL} }); })()`;
const SETTLED = `(() => new Promise(res => {
  const wu = WORLD.worldUpdate; let worst = 0, n = 0, busy = false;
  const st = () => (window.TREE_FILL && TREE_FILL.stat) ? TREE_FILL.stat() : null;
  const g0 = st() ? st().gens : -1;
  WORLD.worldUpdate = cg => { const t0 = performance.now(); wu(cg); worst = Math.max(worst, performance.now() - t0); const S = st(); if (S && (S.busy || S.gens !== g0)) busy = true; };
  const tick = () => { if (++n < 60) requestAnimationFrame(tick); else { WORLD.worldUpdate = wu; res(st() ? !busy : worst < 8); } };
  requestAnimationFrame(tick); }))()`;
const FRAMES = n => `(() => new Promise(res => { let k = 0; const t = () => (++k < ${n}) ? requestAnimationFrame(t) : res(k); requestAnimationFrame(t); }))()`;
// THE SHEETS, READ BACK. For each atlas: per-tile coverage at the series' cut
// (the sheet is a binary mask - alpha 255 where the bake drew, 0 elsewhere -
// so coverage is simply the drawn fraction), the mean linear albedo of the
// drawn texels (bytes are sRGB in the SRGB8 target: decoded here), the alpha
// histogram, and the contact sheet as a PNG (albedo over 50 % grey).
const RAW_SAMPLER = `const rawSampler = tex => new THREE.ShaderMaterial({ uniforms: { map: { value: tex } }, depthTest: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main() { gl_FragColor = texture2D(map, vUv); }' });`;
const SHEETS = `(() => {
  ${RAW_SAMPLER}
  const R = WORLD.renderer, out = [];
  const CUT = { rungs: 0.40, stand: 0.15, snag: 0.10 };
  const lin = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  for (const a of WORLD.treeAtlases()) {
    if (!a.rt) continue;
    const N = a.rt.width, G = 8, T = N / G;
    const px = new Uint8Array(N * N * 4);
    R.readRenderTargetPixels(a.rt, 0, 0, N, N, px);
    const tiles = [], hist = new Array(8).fill(0);
    let cov = 0, rs = 0, gs = 0, bs = 0, ys = 0, nC = 0;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      let n = 0;
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const p = ((j * T + y) * N + (i * T + x)) * 4, al = px[p + 3];
        hist[al >> 5]++;
        if (al >= 255 * (CUT[a.series] || 0.4)) { n++; const r = lin(px[p]), g = lin(px[p + 1]), b = lin(px[p + 2]);
          rs += r; gs += g; bs += b; ys += 0.2126 * r + 0.7152 * g + 0.0722 * b; nC++; }
      }
      tiles.push(+(n / (T * T)).toFixed(3)); cov += n;
    }
    // the contact sheet: rows flipped (readRenderTargetPixels is bottom-up), albedo over grey
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const g2 = cv.getContext('2d'), im = g2.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const s = ((N - 1 - y) * N + x) * 4, d = (y * N + x) * 4, al = px[s + 3] / 255;
      im.data[d] = px[s] * al + 128 * (1 - al); im.data[d + 1] = px[s + 1] * al + 128 * (1 - al); im.data[d + 2] = px[s + 2] * al + 128 * (1 - al); im.data[d + 3] = 255;
    }
    g2.putImageData(im, 0, 0);
    // THE CHAIN, LEVEL BY LEVEL: the sheet drawn onto a target of N >> L texels
    // through its own sampler (trilinear at that scale = mip level L exactly),
    // the alpha read back and tested at the series' cut - the fraction of the
    // sheet the far band still draws when a tree is 2^L times smaller than
    // its tile. A coverage-preserving chain holds ~1.0 of level 0; a box
    // chain thins (TREE-IMPORT.md section 6 trap 5)
    const mipCov = [];
    if (a.tex) {
      const cutB = 255 * (CUT[a.series] || 0.4);
      const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rawSampler(a.tex));   // Basic forces alpha to 1 on an opaque material (r186 OPAQUE)
      const sc = new THREE.Scene(); sc.add(q);
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); cam.position.z = 1;
      const pRT = R.getRenderTarget(), pTM = R.toneMapping, pAC = R.autoClear; R.toneMapping = THREE.NoToneMapping; R.autoClear = true;
      for (let L = 0; L <= 5; L++) {
        const n = N >> L, rt = new THREE.WebGLRenderTarget(n, n, { format: THREE.RGBAFormat, generateMipmaps: false });
        R.setRenderTarget(rt); R.setClearColor(0x000000, 0); R.clear(); R.render(sc, cam);
        const p2 = new Uint8Array(n * n * 4); R.readRenderTargetPixels(rt, 0, 0, n, n, p2);
        let c = 0; for (let i = 3; i < p2.length; i += 4) if (p2[i] >= cutB) c++;
        mipCov.push(+(c / (n * n)).toFixed(4)); rt.dispose();
      }
      R.setRenderTarget(pRT); R.toneMapping = pTM; R.autoClear = pAC; q.geometry.dispose(); q.material.dispose();
    }
    out.push({ key: a.key || '?', series: a.series || '?', N, cy: +a.cy.toFixed(2), diam: +a.diam.toFixed(2), check: a.check || null,
      coverage: +(cov / (N * N)).toFixed(4), tileMin: Math.min(...tiles), tileMax: Math.max(...tiles), tiles, mipCov,
      albedo: nC ? { r: +(rs / nC).toFixed(4), g: +(gs / nC).toFixed(4), b: +(bs / nC).toFixed(4), y: +(ys / nC).toFixed(4) } : null,
      alphaHist: hist, colorSpace: a.rt.texture.colorSpace, mips: !!a.rt.texture.generateMipmaps, png: cv.toDataURL('image/png') });
  }
  return JSON.stringify(out); })()`;
// the bench's sheets: IMP_CACHE key -> { tex (DataTexture, level 0 in tex.image.data, bottom-up), nrm, cy, diam, tile }
const BENCH_SHEETS = `(() => {
  ${RAW_SAMPLER}
  const out = [];
  const lin = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  IMP_CACHE.forEach((a, key) => {
    if (!a || !a.tex || !a.tex.image || !a.tex.image.data) return;
    const N = a.tex.image.width, G = 8, T = N / G, px = a.tex.image.data;
    const series = /snag/.test(key) ? 'snag' : (/forest/.test(key) ? 'stand' : 'rungs');
    const cut = series === 'snag' ? 0.10 : (series === 'stand' ? 0.15 : 0.40);
    const tiles = [], hist = new Array(8).fill(0);
    let cov = 0, rs = 0, gs = 0, bs = 0, ys = 0, nC = 0;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      let n = 0;
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const p = ((j * T + y) * N + (i * T + x)) * 4, al = px[p + 3];
        hist[al >> 5]++;
        if (al >= 255 * cut) { n++; const r = lin(px[p]), g = lin(px[p + 1]), b = lin(px[p + 2]);
          rs += r; gs += g; bs += b; ys += 0.2126 * r + 0.7152 * g + 0.0722 * b; nC++; }
      }
      tiles.push(+(n / (T * T)).toFixed(3)); cov += n;
    }
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const g2 = cv.getContext('2d'), im = g2.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const s = ((N - 1 - y) * N + x) * 4, d = (y * N + x) * 4, al = px[s + 3] / 255;
      im.data[d] = px[s] * al + 128 * (1 - al); im.data[d + 1] = px[s + 1] * al + 128 * (1 - al); im.data[d + 2] = px[s + 2] * al + 128 * (1 - al); im.data[d + 3] = 255;
    }
    g2.putImageData(im, 0, 0);
    const mipCov = [];
    { const cutB = 255 * cut;
      const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rawSampler(a.tex));   // Basic forces alpha to 1 on an opaque material (r186 OPAQUE)
      const sc = new THREE.Scene(); sc.add(q);
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); cam.position.z = 1;
      const pRT = renderer.getRenderTarget(), pTM = renderer.toneMapping, pAC = renderer.autoClear; renderer.toneMapping = THREE.NoToneMapping; renderer.autoClear = true;
      for (let L = 0; L <= 5; L++) {
        const n = N >> L, rt = new THREE.WebGLRenderTarget(n, n, { format: THREE.RGBAFormat, generateMipmaps: false });
        renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
        const p2 = new Uint8Array(n * n * 4); renderer.readRenderTargetPixels(rt, 0, 0, n, n, p2);
        let c = 0; for (let i = 3; i < p2.length; i += 4) if (p2[i] >= cutB) c++;
        mipCov.push(+(c / (n * n)).toFixed(4)); rt.dispose();
      }
      renderer.setRenderTarget(pRT); renderer.toneMapping = pTM; renderer.autoClear = pAC; q.geometry.dispose(); q.material.dispose(); }
    out.push({ key, series, N, cy: +a.cy.toFixed(2), diam: +a.diam.toFixed(2), mips: a.mips, mipCov,
      coverage: +(cov / (N * N)).toFixed(4), tileMin: Math.min(...tiles), tileMax: Math.max(...tiles), tiles,
      albedo: nC ? { r: +(rs / nC).toFixed(4), g: +(gs / nC).toFixed(4), b: +(bs / nC).toFixed(4), y: +(ys / nC).toFixed(4) } : null,
      alphaHist: hist, colorSpace: a.tex.colorSpace, ilit: U_ILIT.value, png: cv.toDataURL('image/png') });
  });
  return JSON.stringify(out); })()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const attach = async t => {
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split(String.fromCharCode(10)).slice(0, 2).join(' | '));
      if (process.env.IMP_DEBUG && m.method === 'Runtime.consoleAPICalled' && /warn|error/.test(m.params.type)) console.error('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 600)); };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text))); return r.result.result.value; };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    const shot = async name => { const r = await cmd('Page.captureScreenshot', { format: 'png' }); const buf = Buffer.from(r.result.data, 'base64');
      fs.writeFileSync(path.join(OUT, name + '.png'), buf); return readPNG(buf); };
    return { ws, cmd, ev, shot };
  };
  const G = await attach(tgt);
  // --pre "<js>": run in the page before any of its scripts (a flag the boot reads, e.g. window.__IMP_TRACE = 1)
  if (opt('pre', null)) await G.cmd('Page.addScriptToEvaluateOnNewDocument', { source: opt('pre') });
  await G.cmd('Page.navigate', { url: URL });
  await sleep(1500);
  try { await G.ev("(() => (window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)))()"); }
  catch (e) { await sleep(18500); }
  await sleep(500);
  let flying = false;
  for (let a = 0; a < 8 && !flying; a++) {
    await G.ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
    await sleep(6000);
    flying = await G.ev("/TAXI|DOWNWIND|FINAL/.test(document.body.innerText)");
  }
  if (process.env.IMP_DEBUG) { await G.shot('debug_rolled'); console.error('  rolled: flying ' + flying + ' | ' + (await G.ev("document.body.innerText.replace(/\s+/g,' ').slice(0,300)"))); }
  if (!flying) throw new Error('the roll-out never happened');
  await G.ev("(()=>{[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0).forEach(x=>x.click());})()");
  // the world stands under the roll-out screen (LOADING S3) - the island takes 10-13 s of it
  for (let i = 0; i < 90; i++) { if (await G.ev("!!(window.WORLD && window.FLIGHT_PROBE && WORLD.treeAtlases)")) break; await sleep(1000);
    if (process.env.IMP_DEBUG && i % 15 === 14) { await G.shot('debug_wait' + i); console.error('  waiting ' + i + ': WORLD ' + (await G.ev("typeof window.WORLD + ' ' + typeof window.FLIGHT_PROBE + ' | ' + document.body.innerText.replace(/\s+/g,' ').slice(0,200)"))); } }
  await G.ev("WORLD.treeSettled()");
  await sleep(3000);
  const gpu = await G.ev("(()=>{const g=WORLD.renderer.getContext();const d=g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);})()");
  const where = JSON.parse(await G.ev(TELEPORT));
  if (RIG) await G.ev("WORLD_RIG.row('" + RIG + "')");
  if (CAM) await G.ev(`FLIGHT_PROBE.camSet(${CAM[0]}, ${CAM[1]}, ${CAM[2]}), 1`);
  await sleep(WAIT);
  let settled = false;
  for (let i = 0; i < 30 && !settled; i++) settled = await G.ev(SETTLED);
  const rig = await G.ev("JSON.stringify(Object.assign({lit: WORLD.treeLod.lit.value, lod: TREE_LOD.get(), imp: TREE_LOD.imp(), leaf: TREE_LEAF.get(), master: TREE_LEAF.master()}, WORLD_RIG.get ? {rig: WORLD_RIG.get()} : {}))");
  console.log(`imp_audit  ${gpu}\n  ${URL}\n  stand ${where.stand} · ${where.neighbours} neighbours · ${AGL} m AGL · settled ${settled}\n  ${rig}`);
  // --probe "<js>" / --probe-file f.js: an experiment run in the page at this point (tree_perf's idiom); --probe-only stops after it
  const PROBE = opt('probe-file', null) ? fs.readFileSync(opt('probe-file'), 'utf8') : opt('probe', null);
  if (PROBE) { console.log('  probe ->' + String.fromCharCode(10) + await G.ev(PROBE)); if (has('probe-only')) { G.ws.close(); ch.kill(); return; } }

  // ---- 2. THE A/B: the same eye, three ladders ----------------------------
  const lod0 = await G.ev("JSON.stringify(TREE_LOD.get())");
  const ab = {};
  for (const [name, set] of [['default', null], ['geometry', '[60, 1200, 1200]'], ['impostor', '[10, 10, 10]']]) {
    if (set) await G.ev('TREE_LOD.set(' + set + ')'); else await G.ev('TREE_LOD.set(' + lod0 + ')');
    await G.ev(FRAMES(40));              // the partition refreshes every 6 frames; the fade window needs both rungs resident
    await sleep(300);
    const img = await G.shot('game_' + name);
    ab[name] = { lod: await G.ev("JSON.stringify(TREE_LOD.get())"), box: boxStats(img, BOX), frame: boxStats(img, [0, 0, 1, 1]) };
  }
  await G.ev('TREE_LOD.set(' + lod0 + ')');
  console.log('\n  A/B over the forest box ' + BOX.join(',') + ' (mean luminance: encoded 0-255 / linear; dark = share under 40):');
  for (const k in ab) console.log(`    ${k.padEnd(9)} lod ${ab[k].lod.padEnd(16)} box ${ab[k].box.enc} / ${ab[k].box.lin} / dark ${ab[k].box.dark}   frame ${ab[k].frame.enc} / ${ab[k].frame.lin}`);
  const ratio = ab.impostor.box.lin / ab.geometry.box.lin;
  console.log(`    impostor / geometry (linear, box) = ${ratio.toFixed(3)}  (1.00 is the tier gain's target; W0c.18 held 0.93 at lit 0.9)`);

  // ---- 1. THE SHEETS ------------------------------------------------------
  const sheets = JSON.parse(await G.ev(SHEETS));
  console.log(`\n  ${sheets.length} atlases baked in the game (target ${sheets[0] && sheets[0].colorSpace}, GPU mips ${sheets[0] && sheets[0].mips}):`);
  console.log('    ' + 'subject'.padEnd(58) + 'series  cover   tile min/max   albedo Y (lin)   rgb            alpha bins 0..7                      chain L1..L5 / L0');
  for (const s of sheets) {
    const fn = (s.key + '_' + s.series).replace(/[^a-z0-9_.-]+/gi, '_') + '.png';
    fs.writeFileSync(path.join(OUT, 'game_sheet_' + fn), Buffer.from(s.png.split(',')[1], 'base64'));
    delete s.png;
    console.log(`    ${s.key.padEnd(58)}${s.series.padEnd(8)}${String(s.coverage).padEnd(8)}${(s.tileMin + '/' + s.tileMax).padEnd(15)}${String(s.albedo ? s.albedo.y : '-').padEnd(17)}${s.albedo ? [s.albedo.r, s.albedo.g, s.albedo.b].join(' ') : '-'}   ${s.alphaHist.join(' ').padEnd(36)} ${(s.mipCov || []).slice(1).map(v => (v / Math.max(1e-6, s.mipCov[0])).toFixed(2)).join(' ')}`);
  }

  // ---- 3. THE BENCH -------------------------------------------------------
  let bench = null;
  if (BENCH) {
    const bURL = URL.replace(/dev\.html.*$/, 'tools/_trees.html');
    const nt = await putJSON('http://127.0.0.1:' + PORT + '/json/new?' + bURL);   // a second page target (PUT since Chrome 90)
    const B = await attach(nt);
    await sleep(3000);
    for (let i = 0; i < 60; i++) { if (await B.ev("typeof SPECIES !== 'undefined' && SPECIES.length > 0 && typeof IMP_CACHE !== 'undefined'")) break; await sleep(1000); }
    await B.ev("applyMix('conifer'), setMode('forest'), 1");
    for (let i = 0; i < 90; i++) { await sleep(2000); if (await B.ev("/^(\\d+ trees|stand: |\\d+ placed)/i.test($('msg').textContent) || $('msg').textContent === ''")) break; }
    await sleep(2000);
    const st = await B.ev("JSON.stringify({msg: $('msg').textContent, stat: $('stat').textContent, sky: $('sky').value, ilit: U_ILIT.value, fields: IMP_FIELDS.length, forest: FOREST})");
    console.log('\n  bench: ' + st);
    const img = await B.shot('bench_forest');
    bench = { state: JSON.parse(st), frame: boxStats(img, [0, 0, 1, 1]), box: boxStats(img, BOX), sheets: JSON.parse(await B.ev(BENCH_SHEETS)) };
    console.log(`  ${bench.sheets.length} atlases in the bench (DataTexture colorSpace ${bench.sheets[0] && bench.sheets[0].colorSpace}, CPU mips):`);
    for (const s of bench.sheets) {
      const fn = (s.key + '_' + s.series).replace(/[^a-z0-9_.-]+/gi, '_') + '.png';
      fs.writeFileSync(path.join(OUT, 'bench_sheet_' + fn), Buffer.from(s.png.split(',')[1], 'base64'));
      delete s.png;
      console.log(`    ${s.key.padEnd(58)}${s.series.padEnd(8)}${String(s.coverage).padEnd(8)}${(s.tileMin + '/' + s.tileMax).padEnd(15)}${String(s.albedo ? s.albedo.y : '-').padEnd(17)}${s.albedo ? [s.albedo.r, s.albedo.g, s.albedo.b].join(' ') : '-'}   ${s.alphaHist.join(' ').padEnd(36)} ${(s.mipCov || []).slice(1).map(v => (v / Math.max(1e-6, s.mipCov[0])).toFixed(2)).join(' ')}`);
    }
    B.ws.close();
  }
  const result = { date: new Date().toISOString(), url: URL, gpu, where, rig: JSON.parse(rig), box: BOX, ab, ratio: +ratio.toFixed(4), sheets, bench };
  fs.writeFileSync(path.join(OUT, 'imp_audit.json'), JSON.stringify(result, null, 1));
  fs.mkdirSync('tools/perf', { recursive: true });
  fs.writeFileSync('tools/perf/imp_audit.json', JSON.stringify(result, null, 1));   // the record beside tree_perf's
  console.log('\n  wrote ' + OUT + '/ and tools/perf/imp_audit.json');
  G.ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('imp_audit: ' + e.message); ch.kill(); process.exit(1); });
