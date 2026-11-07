#!/usr/bin/env node
// look1_temporal.js - LOOK-1, IS THE FRAME TEMPORALLY STABLE? (2026-11-05, the study's F5, on the real GPU). The user: "the
// constant flickering. The clouds are one of the main culprits ... these ones redraw as soon as the camera moves."
//
// Headless Chrome on this machine's GPU (night_shots.js's rig), the game rolled out and paused, the camera on the free eye
// driven frame by frame from inside FLYDIY_AA.render, every frame's canvas read back. HUD-free: the canvas only. Measures:
//   F5.1 THE FLICKER INDEX: the same scene at 6 sub-pixel offsets (Halton 2,3) + a repeat of the first: the per-pixel spread
//        over the offsets, its share above 4 codes (the study's flicker.py, same numbers, the sky band = the top 45 %).
//   F5.2 THE SECOND DIFFERENCE: |f(t+1) - 2 f(t) + f(t-1)| per pixel over a constant motion, which a smooth motion leaves near
//        0 and a crawl does not: mean, rms, the share above 4 codes, p99; by the sky band / below, and by the clouds' march
//        alpha: the rims (0.05-0.6), the cores (>= 0.6), no cloud. Motions: hold (the noise floor), pan 0.25 px a frame, turn
//        2 px a frame, fly 2 m a frame forward (100 kt at 30 fps).
//   F5.3 --blue: the forest at sun -2, -4, -6, -8 deg and the full moon: as is, the probe off, the hemisphere 0; the trees' and
//        the ground's luma (the trees are the pixels the probe moves: the ground's Lambert opts out of it).
//   --moon: the user's night hero (the hillside's gold specks, Cabin Lake, night_shots' photo_moon): as is / the moon's light 50 % toward
//        neutral / neutral / off, the light changed every frame; JPEGs and the left slope's numbers. Use --size 3200x900 --q gfx=ultra.
//   --stills: composed frames for the eye: the forest by day (noon, golden) and the hero's spot at night, default bands and real trees to 1000 m (--tag names the side, ?l1tree=0 the before)
//   --clip: the frames of a short turn as JPEGs (<out>/clip_<view>/), the same path every run: the before / after pair.
//   --timed: no read-back: 150 frames per view, the median frame and the clouds' pass off their GPU timer. A TIMED slot.
//
//   --cap <s> (default 600): the HARD CAP: at this age the rig exits, closing its own Chrome and server (a run hung for 76 min on 5 Nov
//        holding the GPU lock: a page call that never answered). A single page call over 150 s is a failure too.
//   --eyes <a.json,b.json>: the views' eyes from earlier runs' JSONs: the same pictures before and after
//   node tools/look1_temporal.js --out <dir> [--tag before] [--views cu_1500,canopy_cu] [--q k=v&k2=v2] [--size 1600x900]
//        [--aa msaa4] [--eval '<js>'] [--clip] [--blue] [--timed] [--port 8552] [--fallback D:/Dev/DeGaRoR.github.io]
//
// A GPU RUN: boxlock.sh take gpu <who> "UNTIMED ..." first (A0's slot), drop after. Writes <out>/<tag>.json.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const CAP = +opt('cap', 600);
const SIZE = opt('size', '1600x900').split('x').map(Number), SPORT = +opt('port', 8552), Q = opt('q', ''), TAG = opt('tag', 'run');
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'look1_temporal'))), FALLBACK = opt('fallback', 'D:/Dev/DeGaRoR.github.io');
const EYES = (() => { const f = opt('eyes', null); if (!f) return {}; const o = {}; for (const one of f.split(',')) { const v = JSON.parse(fs.readFileSync(one, 'utf8')).views; for (const k in v) if (v[k].eye) o[k] = { x: v[k].eye.x, y: v[k].eye.y, z: v[k].eye.z, yaw: v[k].eye.yaw, pitch: v[k].eye.pitch }; } return o; })();
const ONLY = opt('views', '').split(',').filter(Boolean), AA = opt('aa', null), EVAL = opt('eval', null);
const REPO = path.resolve(__dirname, '..', '..');
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const CU = { date: '2026-06-22', utc: 0.5 * 3600, rate: 0, cloudCover: 0.45, cloudType: 'cu' }, CLEAR = Object.assign({}, CU, { cloudCover: 0 });
const MOON_DAY = { date: '2027-09-14', utc: 11.5 * 3600, rate: 0, cloudCover: 0, wind: { kts: 4, dirDeg: 44, gust: 0, refH: 10 } };   // the hero's day (night_shots MOON_AHEAD + CLEAR + CALM)
// where: 'air' (agl over the stand's spot, or under the deck's base by `under`), 'tree' (d metres from a tree 300-3000 m out, h over the ground)
const VIEWS = [
  { name: 'cu_1500', day: CU, where: 'air', agl: 460, pitch: 5, fly: true },       // the study's pan: a broken cumulus deck from ~1500 ft
  { name: 'cu_rims', day: CU, where: 'air', under: 150, pitch: 12, fly: true },    // just under the deck: the rims inside the jitter's 1.5-8 km
  { name: 'canopy_cu', day: CU, where: 'tree', d: 80, h: 2, pitch: 7 },            // the user's canopy edge against the clouds behind
  { name: 'canopy', day: CLEAR, where: 'tree', d: 80, h: 2, pitch: 7 },            // the same, a clear sky: the canopy alone
  { name: 'stand', day: CLEAR, where: 'tree', d: 350, h: 40, pitch: 1 },           // the forest at range: the impostors
  { name: 'plane_cu', day: CU, where: 'orbit', r: 14, h: 0.9, pitch: 13, onlyClip: true },   // round the aeroplane on the stand, the clouds behind it: the history's trap (--clip)
];

// ---- the page's half ---------------------------------------------------------------------------------------------------
const PAGE_RIG = `window.LT = (() => {
  const R = WORLD.renderer, gl = R.getContext(), AA = window.FLYDIY_AA, orig = AA.__ltOrig || AA.render; AA.__ltOrig = orig;
  let job = null;
  const luma = (px, w, h, L) => { for (let i = 0, n = w * h; i < n; i++) { const o = i * 4; L[i] = 0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]; } return L; };
  function alpha() { const rt = CLOUDS.rt && CLOUDS.rt(); if (!rt || !CLOUDS.active) return null; const w = rt.width, h = rt.height, b = new Uint16Array(w * h * 4); R.readRenderTargetPixels(rt, 0, 0, w, h, b);
    const a = new Float32Array(w * h); for (let i = 0; i < w * h; i++) a[i] = THREE.DataUtils.fromHalfFloat(b[i * 4 + 3]); return { w, h, a }; }
  AA.render = function (scene, cam) {
    if (job && job.before) job.before();
    const r = orig.apply(this, arguments);
    if (job) { const c = R.domElement, w = c.width, h = c.height;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const px = job.px && job.px.length === w * h * 4 ? job.px : (job.px = new Uint8Array(w * h * 4));
      if (job.noRead !== true) gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      job.step(cam, px, w, h); }
    return r;
  };
  const forward = c => { const e = c.matrixWorld.elements; return [-e[8], -e[9], -e[10]]; };
  const go = P => FLIGHT_PROBE.devFree(P.x, P.y, P.z, P.yaw, P.pitch);
  // walk(poses, onFrame): the poses one frame each, onFrame(i, px, w, h, cam); the eye checked against what was asked
  function walk(poses, onFrame, extra) {
    return new Promise(res => {
      let i = -2, miss = 0, missP = 0; go(poses[0]);
      job = Object.assign({ step(cam, px, w, h) {
        i++; if (i < 0) return;                       // the frame in flight when the job began: its eye is the old one
        const P = poses[i], f = forward(cam);
        const dy = Math.atan2(f[0], -f[2]) - P.yaw; miss = Math.max(miss, Math.abs(Math.atan2(Math.sin(dy), Math.cos(dy)))); missP = Math.max(missP, Math.hypot(cam.position.x - P.x, cam.position.y - P.y, cam.position.z - P.z));
        onFrame(i, px, w, h, cam);
        if (i + 1 >= poses.length) { job = null; res({ frames: poses.length, yawMiss: miss, posMiss: missP }); return; }
        go(poses[i + 1]);
      } }, extra || {});
      setTimeout(() => { if (job) { job = null; res({ frames: i + 1, timedOut: true, yawMiss: miss, posMiss: missP }); } }, 110000);
    });
  }
  const png = (w, h, fill, q) => { const c = new OffscreenCanvas(w, h), x = c.getContext('2d'), d = x.createImageData(w, h); fill(d.data);
    x.putImageData(d, 0, 0); return c.convertToBlob(q ? { type: 'image/jpeg', quality: q } : { type: 'image/png' }).then(b => b.arrayBuffer()).then(a => { let s = ''; const u = new Uint8Array(a); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); }); };
  const flipRGB = (px, w, h) => dst => { for (let y = 0; y < h; y++) { const s = (h - 1 - y) * w * 4, t = y * w * 4; for (let x = 0; x < w * 4; x += 4) { dst[t + x] = px[s + x]; dst[t + x + 1] = px[s + x + 1]; dst[t + x + 2] = px[s + x + 2]; dst[t + x + 3] = 255; } } };
  const heatFill = (v, w, h, k) => dst => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = Math.min(255, v[(h - 1 - y) * w + x] * k), t = (y * w + x) * 4; dst[t] = a; dst[t + 1] = a * 0.6; dst[t + 2] = a * 0.15; dst[t + 3] = 255; } };
  const bins = () => ({ n: 0, sum: 0, sq: 0, over4: 0, hist: new Uint32Array(256) });
  const add = (b, d) => { b.n++; b.sum += d; b.sq += d * d; if (d > 4) b.over4++; b.hist[Math.min(255, d | 0)]++; };
  const fin = b => { if (!b.n) return null; let c = 0, p = 0; const t = 0.99 * b.n; for (; p < 256; p++) { c += b.hist[p]; if (c >= t) break; } return { share: +(b.n / 1).toFixed(0), mean: +(b.sum / b.n).toFixed(3), rms: +Math.sqrt(b.sq / b.n).toFixed(3), over4: +(100 * b.over4 / b.n).toFixed(3), p99: p }; };
  // THE SECOND DIFFERENCE over poses (the first WARM frames only feed the history, the frame's and any temporal pass's)
  async function d2(poses, WARM, heatKey) {
    let L0 = null, L1 = null, L2 = null, heat = null, nf = 0, last = null;
    const B = { all: bins(), sky: bins(), low: bins(), rim: bins(), core: bins(), clear: bins(), crown: bins() };
    const r = await walk(poses, (i, px, w, h) => {
      if (!L0) { L0 = new Float32Array(w * h); L1 = new Float32Array(w * h); L2 = new Float32Array(w * h); heat = new Float32Array(w * h); }
      const t = L2; L2 = L1; L1 = L0; L0 = t; luma(px, w, h, L0);
      if (i < WARM + 2) return;
      const A = alpha(), skyY = (h * 0.55) | 0; nf++;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = y * w + x, d = Math.abs(L0[q] - 2 * L1[q] + L2[q]); heat[q] += d;
        add(B.all, d); add(y >= skyY ? B.sky : B.low, d); if (y >= h * 0.38 && y < h * 0.88) add(B.crown, d);   // crown: 12-62 % down the frame: the canopy's rows, the meadow's grass out
        if (A) { const a = A.a[Math.min(A.h - 1, (y * A.h / h) | 0) * A.w + Math.min(A.w - 1, (x * A.w / w) | 0)]; add(a >= 0.6 ? B.core : a >= 0.05 ? B.rim : B.clear, d); } }
      last = [px.slice(), w, h];
    });
    const out = Object.assign(r, { measured: nf }); for (const k in B) out[k] = fin(B[k]);
    if (last) { for (let i = 0; i < heat.length; i++) heat[i] /= Math.max(1, nf); out.heat = await png(last[1], last[2], heatFill(heat, last[1], last[2], 16)); out.last = await png(last[1], last[2], flipRGB(last[0], last[1], last[2]), 0.92); }
    return out;
  }
  // THE FLICKER INDEX: each offset drawn twice, the second kept
  async function spread(base, offs, pxA) {
    const poses = []; for (const o of offs) { const P = Object.assign({}, base, { yaw: base.yaw + o[0] * pxA, pitch: base.pitch + o[1] * pxA }); poses.push(P, P); }
    const N = offs.length - 1; let M = null, S = null, F0 = null, Lr = null, W = 0, H = 0, n = 0, one = null;
    const r = await walk(poses, (i, px, w, h) => { if (i % 2 === 0) return; W = w; H = h;
      if (!M) { M = new Float32Array(w * h); S = new Float32Array(w * h); F0 = new Float32Array(w * h); Lr = new Float32Array(w * h); }
      const k = (i - 1) / 2; luma(px, w, h, Lr);
      if (k === 0) { F0.set(Lr); one = px.slice(); }
      if (k < N) { n++; for (let q = 0; q < w * h; q++) { const d = Lr[q] - M[q]; M[q] += d / n; S[q] += d * (Lr[q] - M[q]); } } });
    let a = 0, sk = 0, lo = 0, nfl = 0, sum = 0; const sky = (H * 0.55) | 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = y * W + x, sd = Math.sqrt(S[q] / n); S[q] = sd; sum += sd; if (sd > 4) { a++; if (y >= sky) sk++; else lo++; } if (Math.abs(Lr[q] - F0[q]) > 4) nfl++; }
    return Object.assign(r, { flicker_all: +(100 * a / (W * H)).toFixed(2), flicker_sky: +(100 * sk / (W * (H - sky))).toFixed(2), flicker_low: +(100 * lo / (W * sky)).toFixed(2), mean_spread: +(sum / (W * H)).toFixed(3), noise_floor: +(100 * nfl / (W * H)).toFixed(3),
      heat: await png(W, H, heatFill(S, W, H, 8)), one: await png(W, H, flipRGB(one, W, H), 0.92) });
  }
  // CLIP: the frames as JPEGs, held in the page, handed over one at a time
  const clipped = [];
  async function clip(poses, WARM) { clipped.length = 0; const q = [];
    const r = await walk(poses, (i, px, w, h) => { if (i >= WARM) { const c = px.slice(); q.push(png(w, h, flipRGB(c, w, h), 0.93)); } });
    for (const p of q) clipped.push(await p); return Object.assign(r, { n: clipped.length }); }
  // BLUE: one frame's pixels kept (the lower band), a light change applied on every frame so the rig's re-lights cannot undo it
  async function grab(n, before) { let kept = null; const P = { x: camera().position.x, y: camera().position.y, z: camera().position.z, yaw: st.yaw, pitch: st.pitch }, poses = []; for (let i = 0; i < n; i++) poses.push(P);
    await walk(poses, (i, px, w, h) => { if (i === n - 1) kept = [px.slice(), w, h]; }, { before }); return kept; }
  const camera = () => (typeof FLIGHT_PROBE.camera === 'function' ? FLIGHT_PROBE.camera() : FLIGHT_PROBE.camera);
  const st = { yaw: 0, pitch: 0 };
  const srgb2lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  async function blue(pitchYaw) { st.yaw = pitchYaw.yaw; st.pitch = pitchYaw.pitch; const W = WORLD.scene; let hemi = []; W.traverse(l => { if (l.isHemisphereLight) hemi.push(l); });
    const asis = await grab(4), env0 = W.environment;
    W.environment = null; const noenv = await grab(8); W.environment = env0;
    const hi0 = hemi.map(l => l.intensity); const nohemi = await grab(8, () => { for (const l of hemi) l.intensity = 0; }); hemi.forEach((l, i) => { l.intensity = hi0[i]; });
    const keys = []; W.traverse(l => { if (l.isDirectionalLight && l.intensity > 0) keys.push(l); });
    const lights = { hemiI: hemi.map(l => +l.intensity.toExponential(3)), hemiC: hemi.map(l => l.color.toArray().map(v => +v.toFixed(4))), hemiG: hemi.map(l => l.groundColor.toArray().map(v => +v.toFixed(4))), keyI: keys.map(l => +l.intensity.toExponential(3)), keyDeg: +(Math.asin(Math.min(1, SKY_LIGHT.isMoon ? DAY_CLOCK.day().moon[1] : DAY_CLOCK.day().sun[1])) * 180 / Math.PI).toFixed(1), isMoon: SKY_LIGHT.isMoon };
    const g0 = hemi.map(l => l.groundColor.clone()); const nognd = await grab(8, () => { for (const l of hemi) l.groundColor.setRGB(0, 0, 0); }); hemi.forEach((l, i) => l.groundColor.copy(g0[i]));
    const nokey0 = keys.map(l => l.intensity); const nokey = await grab(8, () => { for (const l of keys) l.intensity = 0; }); keys.forEach((l, i) => { l.intensity = nokey0[i]; });
    await grab(4);
    const [a, w, h] = asis, [b] = noenv, [c] = nohemi, [e] = nognd, [f] = nokey; const stat = { as: [0, 0], noenv: [0, 0], nohemi: [0, 0], nognd: [0, 0], nokey: [0, 0] }; let nT = 0, nG = 0; const top = (h * 0.5) | 0;
    const Y = (p, o) => 0.2126 * srgb2lin(p[o]) + 0.7152 * srgb2lin(p[o + 1]) + 0.0722 * srgb2lin(p[o + 2]);
    for (let y = 0; y < top; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; const d = Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2]), k = d >= 4 ? 0 : 1; if (k) nG++; else nT++;
      stat.as[k] += Y(a, o); stat.noenv[k] += Y(b, o); stat.nohemi[k] += Y(c, o); stat.nognd[k] += Y(e, o); stat.nokey[k] += Y(f, o); }
    const R_ = {}; for (const k in stat) { R_[k] = { trees: +(stat[k][0] / Math.max(1, nT)).toFixed(5), ground: +(stat[k][1] / Math.max(1, nG)).toFixed(5) }; R_[k].ratio = +(R_[k].trees / Math.max(1e-6, R_[k].ground)).toFixed(3); }
    return Object.assign(R_, { lights, treePixels: +(100 * nT / (nT + nG)).toFixed(1), jpgAs: await png(w, h, flipRGB(a, w, h), 0.92), jpgNoenv: await png(w, h, flipRGB(b, w, h), 0.92), jpgNohemi: await png(w, h, flipRGB(c, w, h), 0.92) });
  }
  async function moon(pose, variants) { st.yaw = pose.yaw; st.pitch = pose.pitch; const keys = []; WORLD.scene.traverse(l => { if (l.isDirectionalLight && l.intensity > 0) keys.push(l); }); const out = { keys: keys.map(l => ({ i: +l.intensity.toExponential(3), c: l.color.toArray().map(v => +v.toFixed(3)) })) }, c0 = keys.map(l => l.color.clone()), i0 = keys.map(l => l.intensity);
    for (const V of variants) { const shot = await grab(8, () => keys.forEach((l, i) => { if (V.off) { l.intensity = 0; return; } l.intensity = i0[i]; l.color.setRGB(c0[i].r + (V.neutral[0] - c0[i].r) * V.k, c0[i].g + (V.neutral[1] - c0[i].g) * V.k, c0[i].b + (V.neutral[2] - c0[i].b) * V.k); }));
      keys.forEach((l, i) => { l.intensity = i0[i]; l.color.copy(c0[i]); }); const [px, w, h] = shot; const xa = 0, xb = (w * 0.33) | 0, ya = (h * 0.45) | 0, yb = (h * 0.95) | 0; let n = 0, sL = 0, sq = 0, gold = 0, sR = 0, sB = 0;
      for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { const o = (y * w + x) * 4, r = px[o], g = px[o + 1], b = px[o + 2], L = 0.2126 * r + 0.7152 * g + 0.0722 * b; n++; sL += L; sq += L * L; sR += r; sB += b; if (r > 70 && r > b * 1.4) gold++; }
      const m = sL / n; out[V.tag] = { meanLuma: +m.toFixed(2), lumaSD: +Math.sqrt(Math.max(0, sq / n - m * m)).toFixed(2), rOverB: +(sR / Math.max(1, sB)).toFixed(3), goldPct: +(100 * gold / n).toFixed(3), jpg: await png(w, h, flipRGB(px, w, h), 0.94) }; }
    await grab(4); return out; }
  async function still(pose) { st.yaw = pose.yaw; st.pitch = pose.pitch; const [px, w, h] = await grab(6); return png(w, h, flipRGB(px, w, h), 0.94); }
  return { d2, spread, clip, clipped, blue, moon, still, go, camera };
})(); 'LT ok'`;

// ---- the driver ----------------------------------------------------------------------------------------------------------
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(SPORT), REPO, '--fallback', FALLBACK], { stdio: 'ignore' });
  const port = 9300 + (process.pid % 300), udd = path.join(os.tmpdir(), 'cdp_look1_' + port + '_' + Date.now());
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--window-size=' + SIZE[0] + ',' + SIZE[1], '--hide-scrollbars', '--no-first-run',
    '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} try { srv.kill(); } catch (e) {} };
  process.on('exit', kill); process.on('SIGINT', () => process.exit(130));
  setTimeout(() => { console.error('look1_temporal: HARD CAP ' + CAP + ' s reached, exiting'); process.exit(3); }, CAP * 1000);
  const log = s => console.log('[' + new Date().toTimeString().slice(0, 8) + '] ' + s);
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + port + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0, conN = 0; const waits = new Map(), errs = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') { errs.push(String(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text).slice(0, 300)); if (conN++ < 20) log('EXC ' + errs[errs.length - 1]); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') { const t = m.params.args.map(q => q.value != null ? q.value : q.description).join(' ').slice(0, 300); errs.push(t); if (conN++ < 20) log('ERR ' + t); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await Promise.race([cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(150000).then(() => { throw new Error('a page call took over 150 s: ' + expr.slice(0, 80)); })]); const d = r.result;
    if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r))); return d.result.value; };
  const J = async expr => JSON.parse(await ev('Promise.resolve(' + expr + ').then(JSON.stringify)'));
  const FRAMES = n => `new Promise(r => { let k = ${n}; const f = () => { if (--k <= 0) r(1); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`;
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{for(const k of Object.keys(localStorage)) if(/^flydiy\\./.test(k)) localStorage.removeItem(k)}catch(e){}' });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: 'http://localhost:' + SPORT + '/flyDiy/index.html' + (Q ? '?' + Q : '') });
  await sleep(1500);
  try { await ev("Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('timeout'), 150000))])"); } catch (e) { await sleep(18500); }
  let flying = false;
  for (let a = 0; a < 8 && !flying; a++) { await ev("(()=>{const b=document.getElementById('bGo'); if (b) b.click();})()"); await sleep(6000); flying = await ev("/TAXI|TAKEOFF|ROLL|DOWNWIND|FINAL|DEPART/.test(document.body.innerText) && !!window.FLIGHT_PROBE"); }
  for (let i = 0; i < 150; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
  await sleep(3000);
  await ev("(()=>{const b=document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); return 1;})()");
  if (AA) await ev(`(GFX.set('aa', '${AA}'), 1)`);
  if (EVAL) await ev('(() => { ' + EVAL + '; return 1; })()');
  log(await ev(PAGE_RIG));
  const R = { tag: TAG, when: new Date().toISOString(), size: SIZE, q: Q, aa: AA, eval: EVAL, gfx: await J("(() => { const g = window.FLYDIY_RENDERER.getContext(), d = g.getExtension('WEBGL_debug_renderer_info'); return { gpu: d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : null, preset: window.GFX && GFX.preset ? (typeof GFX.preset === 'function' ? GFX.preset() : GFX.preset) : null, aa: window.GFX && GFX.get ? GFX.get('aa') : null, scale: window.GFX && GFX.get ? GFX.get('scale') : null, clouds: CLOUDS.S.mode, steps: CLOUDS.S.steps, shimmer: CLOUDS.S.shimmer, canvas: [WORLD.renderer.domElement.width, WORLD.renderer.domElement.height], programs: WORLD.renderer.info.programs.length }; })()"), views: {} };
  log('gfx ' + JSON.stringify(R.gfx));
  if (!/NVIDIA|AMD|Radeon|Intel/i.test(R.gfx.gpu || '') || /SwiftShader/i.test(R.gfx.gpu || '')) throw new Error('not on a real GPU: ' + R.gfx.gpu);
  const pxA = await ev('LT.camera().fov * Math.PI / 180 / window.innerHeight');
  const save = () => fs.writeFileSync(path.join(OUT, TAG + '.json'), JSON.stringify(R, null, 1));
  const wr = (name, b64) => fs.writeFileSync(path.join(OUT, TAG + '_' + name), Buffer.from(b64, 'base64'));
  // a view: the day, then the eye, the deck read after the day is on
  const place = async V => {
    await ev(`(DAY_CLOCK.set(${JSON.stringify(V.day)}), 1)`);
    await ev(FRAMES(30)); await sleep(1500);
    const p = await J(`(() => { const cg = FLIGHT_PROBE.camGet().target, W = FLIGHT_PROBE.world(), d = DAY_CLOCK.day(); const L = d.sun, ln = Math.hypot(L[0], L[2]) || 1; const side = [-L[2] / ln, L[0] / ln];
      const air = () => { const g = W.terrainH ? W.terrainH(cg[0], cg[2]) : 0, base = CLOUDS.layer ? CLOUDS.layer.base : 1500; return { x: cg[0], z: cg[2], y: ${V.under != null ? 'base - ' + (V.under || 0) : '(g + ' + (V.agl || 0) + ')'}, yaw: Math.atan2(side[0], -side[1]), base, g }; };
      if (${V.where === 'air'}) return air();
      if (${V.where === 'orbit'}) { const g = W.terrainH ? W.terrainH(cg[0], cg[2]) : cg[1]; return { x: cg[0] - side[0] * ${V.r || 0}, z: cg[2] - side[1] * ${V.r || 0}, y: g + ${V.h || 0}, yaw: Math.atan2(side[0], -side[1]), c: [cg[0], cg[2]] }; }
      for (const key of ['realistic', 'cedar', 'spruce', 'hemlock']) { let t = []; try { t = TREE_LOD.find(key, cg[0], cg[2], 300, 3000, 40); } catch (e) {} for (const tr of t) { const ex = tr.x + side[0] * ${V.d || 0}, ez = tr.z + side[1] * ${V.d || 0}, gy = W.terrainH ? W.terrainH(ex, ez) : tr.y;
        if (gy < 2) continue; return { x: ex, z: ez, y: gy + ${V.h || 0}, yaw: Math.atan2(tr.x - ex, -(tr.z - ez)), tree: { key, x: tr.x, z: tr.z, y: tr.y } }; } }
      return null; })()`);
    if (!p) return null;
    p.pitch = (V.pitch || 0) * Math.PI / 180;
    if (EYES[V.name]) Object.assign(p, EYES[V.name]);   // the same eye as the run it is compared with: a tree the stream deals differently is another view
    await ev(`(LT.go(${JSON.stringify({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch })}), 1)`);
    await ev(FRAMES(90)); await sleep(5000);   // the stream, the clouds' fit, the probe
    await ev(FRAMES(30));
    return p;
  };
  const rows = (p, n, dYaw, dFwd) => { const out = []; for (let i = 0; i < n; i++) { const y = p.yaw + i * dYaw; out.push({ x: p.x + Math.sin(p.yaw) * dFwd * i, y: p.y, z: p.z - Math.cos(p.yaw) * dFwd * i, yaw: y, pitch: p.pitch }); } return out; };
  const offs = []; for (let i = 1; i <= 6; i++) offs.push([halton(i, 2) - 0.5, halton(i, 3) - 0.5]); offs.push(offs[0]);
  const list = VIEWS.filter(v => ONLY.length ? ONLY.includes(v.name) : !v.onlyClip);

  if (flag('timed')) {
    for (const V of list) { const p = await place(V); if (!p) { log('no spot ' + V.name); continue; }
      const window_ = () => J(`new Promise(res => { const T = []; let last = 0, n = 0; const f = ts => { if (last) T.push(ts - last); last = ts; if (++n <= 150) requestAnimationFrame(f); else { T.sort((a, b) => a - b); res({ medianMs: +T[T.length >> 1].toFixed(2), p95Ms: +T[(T.length * 0.95) | 0].toFixed(2), cloudsGpuMs: +(CLOUDS.stats.gpuMs || 0).toFixed(2), histGpuMs: +(CLOUDS.stats.histMs || 0).toFixed(2), cloudsCpuMs: +(CLOUDS.stats.ms || 0).toFixed(2), programs: WORLD.renderer.info.programs.length }); } }; requestAnimationFrame(f); })`);
      // the history on, off, on again in one page: the pass's cost against itself, minutes apart at most
      const t = {}; for (const [k, on] of [['on', 1], ['off', 0], ['on2', 1]]) { await ev(`(CLOUDS.S.temporal = ${on}, 1)`); await ev(FRAMES(20)); t[k] = await window_(); }
      R.views[V.name] = { timed: t }; log(V.name + ' ' + JSON.stringify(t)); save(); }
  } else if (flag('blue')) {
    const V = VIEWS.find(v => v.name === 'stand'), rowsB = {};
    const p = await place(Object.assign({}, V, { day: { date: '2026-12-24', utc: 1 * 3600, rate: 0, cloudCover: 0 } }));
    for (const el of [-2, -4, -6, -8, 'moon']) {
      const day = el === 'moon' ? { date: '2026-12-24', utc: 3 * 3600, rate: 0, cloudCover: 0 } : await J(`(() => { let lo = 0, hi = 3 * 3600; for (let i = 0; i < 18; i++) { const m = 0.5 * (lo + hi); DAY_CLOCK.set({ date: '2026-12-24', utc: m, rate: 0, cloudCover: 0 }); const s = Math.asin(DAY_CLOCK.day().sun[1]) * 180 / Math.PI; if (s > ${el}) lo = m; else hi = m; } return { date: '2026-12-24', utc: 0.5 * (lo + hi), rate: 0, cloudCover: 0 }; })()`);
      await ev(`(DAY_CLOCK.set(${JSON.stringify(day)}), 1)`); await ev(FRAMES(90)); await sleep(8000); await ev(FRAMES(60));
      const b = await J(`LT.blue(${JSON.stringify({ yaw: p.yaw, pitch: p.pitch })}).then(r => Object.assign(r, { sunDeg: Math.asin(DAY_CLOCK.day().sun[1]) * 180 / Math.PI, exposure: WORLD.renderer.toneMappingExposure }))`);
      for (const k of ['As', 'Noenv', 'Nohemi']) { wr('blue_' + el + '_' + k + '.jpg', b['jpg' + k]); delete b['jpg' + k]; }
      rowsB[el] = b; R.blue = rowsB; log('blue ' + el + ' ' + JSON.stringify(b)); save();
    }
  } else if (flag('matrix')) {   // bench parity: the AA tier x the leaf sharpen x the impostor's alpha gain, at the canopy (near models) and the stand (impostors): a still + the crawl
    const COMBOS = JSON.parse(process.env.LT_COMBOS || '[["msaa",0.9,1],["off",0.9,1],["msaa4",0.9,1],["full",0.9,1],["msaa",0.4,1],["msaa",0,1],["msaa",0.9,0.5],["full",0.4,0.5]]');
    R.matrix = {};
    for (const vn of (ONLY.length ? ONLY : ['canopy_cu', 'stand'])) { const V = VIEWS.find(v => v.name === vn); const p = await place(V); if (!p) continue; const pose = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch };
      for (const [aa, sharp, gain] of COMBOS) { const tag = vn + '_' + aa + '_s' + sharp + '_g' + gain;
        await ev(`(GFX.set('aa', '${aa}'), TREE_LEAF.sharp(${sharp}), TREE_LOD.imp({ gain: ${gain} }), 1)`); await ev(FRAMES(30)); await sleep(1200);
        const sp = await J(`LT.spread(${JSON.stringify(pose)}, ${JSON.stringify(offs)}, ${pxA})`); wr('mx_' + tag + '.jpg', sp.one); delete sp.one; delete sp.heat;
        const d = await J(`LT.d2(${JSON.stringify(rows(p, 40, 0.25 * pxA, 0))}, 8)`); delete d.heat; delete d.last;
        R.matrix[tag] = { spread: sp, pan: { crown: d.crown, low: d.low, all: d.all }, samples: await ev('(FLYDIY_AA.target && FLYDIY_AA.target() ? FLYDIY_AA.target().samples : -1)') };
        log(tag + ' flicker ' + sp.flicker_all + ' pan crown ' + (d.crown && d.crown.over4) + ' low ' + d.low.over4 + ' samples ' + R.matrix[tag].samples); save(); }
      await ev(`(GFX.set('aa', 'msaa'), TREE_LEAF.sharp(0.9), TREE_LOD.imp({ gain: 1 }), 1)`); }
  } else if (flag('stills')) {
    const G = { date: '2026-06-22', utc: 4.6 * 3600, rate: 0, cloudCover: 0, cloudType: 'cu' };
    const shots = [['stand_noon', 'stand', CLEAR], ['stand_golden', 'stand', G], ['canopy_noon', 'canopy', CLEAR], ['canopy_golden', 'canopy', G]];
    R.stills = {};
    for (const [tag, vn, day] of shots) { const V = VIEWS.find(v => v.name === vn); const p = await place(Object.assign({}, V, { day })); if (!p) { log('no spot ' + tag); continue; }
      const b64 = await ev(`LT.still(${JSON.stringify({ yaw: p.yaw, pitch: p.pitch })})`); wr('still_' + tag + '.jpg', b64); R.stills[tag] = { eye: p, sunDeg: await ev('Math.asin(DAY_CLOCK.day().sun[1]) * 180 / Math.PI') }; log('still ' + tag); save(); }
    await ev(`(DAY_CLOCK.set(${JSON.stringify(MOON_DAY)}), window.AURORA && AURORA.on && AURORA.on({ azDeg: 253 }), FLYDIY_HVIEW.flyFov(24), 1)`);
    const b0 = 253 / 57.29578, hx = 2445 - Math.sin(b0) * 15, hz = -17532 + Math.cos(b0) * 15, hy = 105.34;
    const hero = { x: hx, y: hy, z: hz, yaw: b0, pitch: -0.02 };
    await ev(`(LT.go(${JSON.stringify(hero)}), 1)`); await ev(FRAMES(90)); await sleep(9000); await ev(FRAMES(30));
    wr('still_hero_default.jpg', await ev(`LT.still(${JSON.stringify({ yaw: hero.yaw, pitch: hero.pitch })})`)); log('still hero default');
    await ev(`(GFX.set('bands', 'far'), TREE_LOD.set([150, 1000, 1000]), TREE_LOD.fade && TREE_LOD.fade(60), 1)`); await ev(FRAMES(90)); await sleep(22000); await ev(FRAMES(30));
    wr('still_hero_real1000.jpg', await ev(`LT.still(${JSON.stringify({ yaw: hero.yaw, pitch: hero.pitch })})`)); log('still hero real1000');
    save();
  } else if (flag('moon')) {
    await ev(`(GFX.set('bands', 'far'), TREE_LOD.set([150, 1000, 1000]), TREE_LOD.fade && TREE_LOD.fade(60), 1)`);
    await ev(`(DAY_CLOCK.set(${JSON.stringify(MOON_DAY)}), window.AURORA && AURORA.on && AURORA.on({ azDeg: 253 }), FLYDIY_HVIEW.flyFov(24), 1)`);
    const b = 253 / 57.29578, px = 2445 - Math.sin(b) * 15, pz = -17532 + Math.cos(b) * 15;
    const y = await ev(`(FLIGHT_PROBE.world().terrainH ? Math.max(FLIGHT_PROBE.world().terrainH(${px}, ${pz}), 0) : 0)`);
    const pose = { x: px, y: await ev(`(() => { const w = FLIGHT_PROBE.world(); return w.waterH ? w.waterH(${px}, ${pz}) : ${y}; })()`) + 2.2, z: pz, yaw: b, pitch: -0.02 };
    log('eye ' + JSON.stringify(pose)); await ev(`(LT.go(${JSON.stringify(pose)}), 1)`);
    await ev(FRAMES(120)); await sleep(30000); await ev(FRAMES(60));   // the real trees to 1000 m stream in, the probe, the aurora
    const n = [0.80, 0.86, 1.0];   // the neutral: the moon's light white, a hair blue (as the eye reads a moonlit scene)
    const m = await J(`LT.moon(${JSON.stringify(pose)}, ${JSON.stringify([{ tag: 'asis', neutral: n, k: 0 }, { tag: 'half', neutral: n, k: 0.5 }, { tag: 'neutral', neutral: n, k: 1 }, { tag: 'off', off: 1 }])}).then(r => Object.assign(r, { fov: LT.camera().fov, moonDeg: Math.asin(DAY_CLOCK.day().moon[1]) * 180 / Math.PI, sunDeg: Math.asin(DAY_CLOCK.day().sun[1]) * 180 / Math.PI, moonPhase: DAY_CLOCK.day().moonPhase, exposure: WORLD.renderer.toneMappingExposure }))`);
    for (const k of ['asis', 'half', 'neutral', 'off']) { wr('moon_' + k + '.jpg', m[k].jpg); delete m[k].jpg; }
    R.moon = m; log('moon ' + JSON.stringify(m)); save();
  } else {
    for (const V of list) {
      const p = await place(V); if (!p) { log('no spot ' + V.name); continue; }
      const VR = R.views[V.name] = { eye: p }; log(V.name + ' eye ' + JSON.stringify(p) + ' base ' + await ev('CLOUDS.layer ? CLOUDS.layer.base : -1'));
      // the orbit: the eye round the aeroplane at 0.6 deg a frame (18 deg/s at 30 fps), looking at it
      const orbitRows = () => { const out = [], R0 = V.r; for (let i = 0; i < 158; i++) { const y = p.yaw + i * 0.6 * Math.PI / 180; out.push({ x: p.c[0] - Math.sin(y) * R0, y: p.y, z: p.c[1] + Math.cos(y) * R0, yaw: y, pitch: p.pitch }); } return out; };
      if (flag('clip')) { const c = await J(`LT.clip(${JSON.stringify(V.where === 'orbit' ? orbitRows() : rows(p, 158, 1.5 * pxA, 0))}, 8)`); const dir = path.join(OUT, 'clip_' + TAG + '_' + V.name); fs.mkdirSync(dir, { recursive: true });
        for (let i = 0; i < c.n; i++) fs.writeFileSync(path.join(dir, 'f' + String(i).padStart(4, '0') + '.jpg'), Buffer.from(await ev('LT.clipped[' + i + ']'), 'base64'));
        VR.clip = c; log(V.name + ' clip ' + JSON.stringify(c)); save(); continue; }
      const s = await J(`LT.spread(${JSON.stringify({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch })}, ${JSON.stringify(offs)}, ${pxA})`);
      wr(V.name + '_spread_heat.png', s.heat); wr(V.name + '_one.jpg', s.one); delete s.heat; delete s.one; VR.spread = s; log(V.name + ' spread ' + JSON.stringify(s));
      const MOT = { hold: [0, 0], pan: [0.25 * pxA, 0], turn: [2 * pxA, 0] }; if (V.fly) MOT.fly = [0, 2];
      for (const m in MOT) { const d = await J(`LT.d2(${JSON.stringify(rows(p, 70, MOT[m][0], MOT[m][1]))}, 8)`); wr(V.name + '_' + m + '_d2heat.png', d.heat); if (m === 'turn') wr(V.name + '_' + m + '_last.jpg', d.last); delete d.heat; delete d.last; VR[m] = d;
        log(V.name + ' ' + m + ' all ' + JSON.stringify(d.all) + ' sky ' + JSON.stringify(d.sky) + ' low ' + JSON.stringify(d.low) + ' rim ' + JSON.stringify(d.rim) + ' crown ' + JSON.stringify(d.crown) + ' miss ' + d.yawMiss + '/' + d.posMiss); }
      save();
    }
  }
  R.errors = errs.slice(0, 20); R.programs = await ev('WORLD.renderer.info.programs.length'); save();
  log('wrote ' + path.join(OUT, TAG + '.json') + ', page errors ' + errs.length);
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(800); process.exit(0);
})().catch(e => { console.error('look1_temporal FAILED: ' + (e && e.stack || e)); process.exit(1); });
