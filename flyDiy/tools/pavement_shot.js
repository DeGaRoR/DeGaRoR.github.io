#!/usr/bin/env node
// pavement_shot.js - PICTURES OF THE PAVEMENT BENCH (tools/_pavement.html) from
// headless Chrome on this machine's GPU (island_bench_shot's rig). The pane's
// GPU process dies under a heavy shader compile and stays dead for the app's
// life, so the bench is judged from here: the shader's compile status is
// printed, the pictures land under screenshots/pavement/.
//
//   node tools/pavement_shot.js [--view aerial] [--cls concrete] [--rcls asphalt] [--set k=v,k=v]
//        [--dbg n] [--marks 0] [--scatter 0] [--out screenshots/pavement/x.png] [--port 8484]
//        [--wait 40000] [--sheet] [--gate] [--log] [--js "<statements>"]
//
// --sheet  shoots every view for the strip class (and the road view for the road class)
// --gate   the measurable rules: link OK, the rough view inside [0.02, 1], the alpha ramp at the
//          shoulder's end wider than 3 px, and the TILING SCORE - the normalised autocorrelation
//          of the top-down luma along the strip at the base tile's period, hex on (< 0.35) against
//          hex off (the control, > the hex-on score)
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = k => argv.includes('--' + k);
const PORTS = opt('port', '8484');
const ROOT = path.join(__dirname, '..');
const VIEW = opt('view', 'aerial'), CLS = opt('cls', 'concrete'), RCLS = opt('rcls', 'asphalt');
const OUT = opt('out', `screenshots/pavement/${CLS}_${VIEW}.png`);
const WAIT = +opt('wait', 40000);
const SET = opt('set', '');
const URL = opt('url', `http://localhost:${PORTS}/flyDiy/tools/_pavement.html?cls=${CLS}&rcls=${RCLS}&view=${VIEW}`);
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('pavement_shot: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_pav_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1600,1000', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };

// ---- a PNG reader (8-bit RGB/RGBA, non-interlaced) for the gate's measures ----
function readPNG(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; }
    else if (type === 'IDAT') idat.push(buf.slice(p + 8, p + 8 + len));
    p += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * bpp);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], row = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255; }
    cur.copy(out, y * stride); prev = cur; }
  return { w, h, bpp, data: out };
}

(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  const LOG = has('log');
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split(String.fromCharCode(10)).slice(0, 3).join(' | '));
    if (m.method === 'Runtime.consoleAPICalled' && (LOG || m.params.type === 'error' || /Shader Error|Program Info Log|Context Lost|SHADER ERROR/.test(String(m.params.args[0] && m.params.args[0].value))))
      console.log('page ' + m.params.type + ': ' + m.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 3000)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails.text)); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  const t0 = Date.now();
  let m = '';
  for (let i = 0; i < WAIT / 500; i++) { await sleep(500); try { m = await ev("document.getElementById('msg').textContent"); } catch (e) { continue; } if (/^library:/.test(m) || /failed/.test(m)) break; }
  console.log(`bench: "${m}" after ${Date.now() - t0} ms`);
  if (/failed/.test(m)) { verdict(false, 'the shader compiled: ' + m); }
  if (SET) for (const kv of SET.split(',')) { const [k, v] = kv.split('='); await ev(`BENCH.set(${JSON.stringify(k)}, ${+v})`); }
  if (has('marks')) await ev(`BENCH.marks(${+opt('marks', 1)})`);
  if (has('scatter')) await ev(`BENCH.scatter(${+opt('scatter', 1)})`);
  if (has('dbg')) await ev(`BENCH.dbg(${+opt('dbg', 0)})`);
  if (has('js')) await ev(opt('js', '1'));
  const shoot = async (file, view) => {
    if (view && !(has('js') && /BENCH.look/.test(opt('js', '')))) await ev(`BENCH.view(${JSON.stringify(view)})`);   // a --js that placed the eye keeps it
    await sleep(900);
    const err = await ev('BENCH.err()');
    if (err) verdict(false, 'shader: ' + String(err).slice(0, 300));
    const r = await cmd('Page.captureScreenshot', { format: 'png' });
    const abs = path.resolve(ROOT, file); fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.from(r.result.data, 'base64'));
    const stat = await ev("document.getElementById('stat').textContent");
    let probe = ''; try { probe = await ev('BENCH.probe ? BENCH.probe() : ""'); } catch (e) { probe = 'probe: ' + e.message; }
    console.log(`shot ${file}  [${stat}]  ${probe}`);
    return abs;
  };
  if (has('sheet')) {
    for (const v of ['cockpit', 'threshold', 'aerial', 'topdown', 'shoulder']) await shoot(`screenshots/pavement/${CLS}_${v}.png`, v);
    await shoot(`screenshots/pavement/${RCLS}_road.png`, 'road');
    await shoot(`screenshots/pavement/${CLS}_${RCLS}_junction.png`, 'junction');
  } else if (has('gate')) {
    // 1. the rough view: every pavement pixel inside [0.02, 1] (nothing black = a mirror, nothing over 1)
    await ev('BENCH.scatter(0)'); await ev('BENCH.dbg(2)');
    let f = await shoot('screenshots/pavement/_gate_rough.png', 'topdown');
    let img = readPNG(fs.readFileSync(f)); let lo = 0, n = 0;
    for (let y = 300; y < 700; y += 2) for (let x = 400; x < 1200; x += 2) { const v = img.data[(y * img.w + x) * img.bpp]; n++; if (v < 5) lo++; }
    verdict(lo / n < 0.002, `rough view: ${lo} of ${n} pavement pixels below 0.02 (mirror-black)`);
    // 2. the alpha ramp past the band: a ramp, not a step (dEdge/alpha view, blue = alpha), read down
    //    a top-down column across the strip - inside the mesh, where the fade lives (0.25 m/px: a 6 m
    //    fade is 24 px, so no step between neighbours may exceed ~1/4 of the range)
    await ev('BENCH.dbg(6)');
    f = await shoot('screenshots/pavement/_gate_alpha.png', 'topdown');
    img = readPNG(fs.readFileSync(f));
    let maxStep = 0, ramp = 0; { const x = 300; let prev = -1; for (let y = 1; y < img.h; y++) { const a = img.data[(y * img.w + x) * img.bpp + 2], b = img.data[((y - 1) * img.w + x) * img.bpp + 2];
      if (a > 8 && b > 8 && a < 250 && b < 250) { maxStep = Math.max(maxStep, Math.abs(a - b)); ramp++; } } }
    verdict(maxStep < 64 && ramp >= 6, `alpha ramp: ${ramp} px of ramp down a column, the largest step ${maxStep}/255 (a hard edge would be 255)`);
    // 3. the tiling score: top-down, markings off, hex on vs hex off
    await ev('BENCH.dbg(0)'); await ev('BENCH.marks(0)');
    const score = async () => {
      const ff = await shoot('screenshots/pavement/_gate_tile.png', 'topdown');
      const im = readPNG(fs.readFileSync(ff));
      // the strip runs along x in the topdown view; metres per pixel from the bench (dist 260, fov 50 over 1000 px)
      const mpp = await ev('(2 * 260 * Math.tan(25 * Math.PI / 180)) / BENCH.renderer.domElement.height');
      const tileM = await ev("BENCH.PAVEMENT.mats[0].uniforms.uTile.value.x");
      const lag = Math.max(2, Math.round(tileM / mpp));
      // the luma along the strip, HIGH-PASSED (a box of 2 lags taken out: the macro variation and the
      // lanes correlate at every small lag; only the tile's own repeat makes a BUMP at its period), the
      // bump = r(lag) - the mean of r(lag/2) and r(3 lag/2) - a periodic signal peaks at its period,
      // a stochastic one decays through it
      const y0 = Math.round(im.h / 2), W = im.w;
      const acf = (L, k) => { const mean = L.reduce((a, b) => a + b, 0) / L.length; let num = 0, den = 0;
        for (let x = 0; x < L.length - k; x++) num += (L[x] - mean) * (L[x + k] - mean); for (let x = 0; x < L.length; x++) den += (L[x] - mean) * (L[x] - mean); return den > 0 ? num / den : 0; };
      let best = -1;
      for (let dy = -60; dy <= 60; dy += 15) { const y = y0 + dy; const L = [];
        for (let x = 0; x < W; x++) { const o = (y * W + x) * im.bpp; L.push(0.2126 * im.data[o] + 0.7152 * im.data[o + 1] + 0.0722 * im.data[o + 2]); }
        const box = 2 * lag, H = [];
        for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let k = -box; k <= box; k++) { const xx = x + k; if (xx >= 0 && xx < W) { s += L[xx]; n++; } } H.push(L[x] - s / n); }
        const bump = acf(H, lag) - 0.5 * (acf(H, Math.max(1, Math.round(lag / 2))) + acf(H, Math.round(lag * 1.5)));
        best = Math.max(best, bump); }
      return { r: best, lag, mpp };
    };
    const on = await score();
    await ev('BENCH.set("hexOn", 0)');
    const off = await score();
    await ev('BENCH.set("hexOn", 1)'); await ev('BENCH.marks(1)');
    verdict(on.r < 0.12, `tiling score hex on: the bump at the tile's period ${on.r.toFixed(3)} (lag ${on.lag} px, ${on.mpp.toFixed(2)} m/px)`);
    verdict(off.r > on.r + 0.05, `tiling score hex off (the control): ${off.r.toFixed(3)} > hex on ${on.r.toFixed(3)} + 0.05`);
    // 4. THE FAR TIER: the strip's mean albedo (the unlit view) seen from 200 m and from 3000 m must be
    //    one luminance - per class, within 12 % (the detail is gone by 900 m, so the far picture is the
    //    far tier alone)
    await ev('BENCH.marks(0)');
    for (const c of ['concrete', 'asphalt', 'gravel', 'dirt', 'sand', 'grass']) {
      await ev(`BENCH.cls(${JSON.stringify(c)}, 'dirt')`); await ev('BENCH.dbg(12)');
      const lum = async (d, name) => { await ev(`BENCH.look(-250, 20, 0, 0, 1.52, ${d})`); await sleep(700);
        const rr = await cmd('Page.captureScreenshot', { format: 'png' }); const im = readPNG(Buffer.from(rr.result.data, 'base64'));
        // the strip runs along x through the frame's centre; sample the middle rows across half its width
        // the strip's own pixels: metres per pixel from the eye's height, the strip 45 m across and
        // 1400 m long about the target (-250, 0) - the inner 40 % across and 70 % along, nothing else
        const R = await ev('(r => [r.left, r.top, r.width, r.height])(BENCH.renderer.domElement.getBoundingClientRect())');
        const mpp = 2 * d * Math.tan(25 * Math.PI / 180) / R[3], cx = R[0] + R[2] / 2, cy = R[1] + R[3] / 2;
        // the SAME stretch of runway at both distances: 120 m either side of the target, 9 m either side of the centreline
        const hw = Math.max(1, Math.floor(9 / mpp)), hl = Math.max(4, Math.floor(120 / mpp)); let s = 0, n = 0;
        for (let y = Math.round(cy) - hw; y <= Math.round(cy) + hw; y += 1) for (let x = Math.max(0, Math.round(cx - hl)); x < Math.min(im.w, cx + hl); x += 2) { const o = (y * im.w + x) * im.bpp; s += 0.2126 * im.data[o] + 0.7152 * im.data[o + 1] + 0.0722 * im.data[o + 2]; n++; }
        return s / n; };
      const near = await lum(200), far = await lum(3000);
      verdict(Math.abs(far - near) / Math.max(near, 1) < 0.12, `far tier ${c}: albedo from 200 m ${near.toFixed(1)} vs 3000 m ${far.toFixed(1)} (${(100 * (far - near) / near).toFixed(0)} %)`);
    }
    await ev('BENCH.dbg(0)'); await ev('BENCH.marks(1)');
    console.log('GATE PAVEMENT-GPU: ' + (fails ? 'FAIL' : 'PASS'));
  } else {
    await shoot(OUT, VIEW);
  }
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('pavement_shot: ' + e.message); ch.kill(); process.exit(1); });
