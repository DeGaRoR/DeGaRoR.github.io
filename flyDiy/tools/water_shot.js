#!/usr/bin/env node
// water_shot.js - THE WATER'S CAMERA AND ITS MEASURES (H6, G460.1)
//
//   node tools/water_shot.js --url "http://localhost:8480/flyDiy/dev.html?world=jolene" \
//        --out screenshots/water --gate
//   node tools/water_shot.js ... --perf          the GPU cost of the water's own draws, three ways
//   node tools/water_shot.js ... --shots "name:x,y,z:yaw:pitch:js@@..."   free shots, as cloud_shot.js
//
// cloud_shot.js's rig (headless Chrome on this machine's GPU, the roll-out, the free DEVCAM eye,
// SHOT_MODE), the aeroplane held over the east coast of Jolene at (3000, 40, 0), and a SEA STATE
// set by the rig (A 0.35 m, L 14 m, 7 m/s of wind; the day's own wind is what the game would use).
// The default set is the MEASURED one: every shot is a PNG in --out and a JSON line, and --gate
// turns the measures into a verdict (exit 1 on a miss):
//   down (300 m, pitch -75) darker than graze (12 m, pitch -4, toward the sun) - Fresnel;
//   glitter (300 m, pitch -45, toward the sun): a bright band across the frame (row max/median > 1.15) and
//   the water under it brighter than glitter_away's - the sun's lobe, with a direction;
//   rough (the roughness debug view from 300 m): every water pixel in [0.05, 1] - no NaN, the law;
//   shore (the alpha debug view across the coast at 40 m): a ramp of >= 3 px from the line to half opacity, no step over 160 of 255;
//   lake (an inland lake from 80 m) not the sea's colour (its own preset row).
// The overlay's "compiling the world" step never completes under this rig: CONTINUE ANYWAY is
// clicked. The measures read the frame through a minimal PNG decoder (boot_perf.js's).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8480/flyDiy/dev.html?world=jolene');
const AT = opt('at', '3000,40,0').split(',').map(Number);
const OUT = opt('out', 'screenshots/water');
const WAIT = +opt('wait', 3500);
const GATE = argv.includes('--gate'), PERF = argv.includes('--perf');
const SEA = "FLIGHT_PROBE.world().setSea({A:0.35,L:14,dir:0.4});WATER.setWind(7,0.4)";
const CA = "[...document.querySelectorAll('button')].filter(b=>/continue anyway/i.test(b.textContent)).forEach(b=>b.click())";
// the sun's azimuth decides where the streak lies: the graze shot looks at the sun
const DEFAULT = [
  { name: 'down',  eye: [3000, 300, 0], yaw: 90, pitch: -75, js: SEA, measure: 'lum' },
  { name: 'graze', eye: [2600, 12, 0], yaw: 'sun', pitch: -4, js: '', measure: 'glit' },
  { name: 'glitter', eye: [3000, 300, 0], yaw: 'sun', pitch: -45, js: '', measure: 'glit' },
  { name: 'glitter_away', eye: [3000, 300, 0], yaw: 'antisun', pitch: -45, js: '', measure: 'glit' },
  { name: 'rough', eye: [3000, 300, 0], yaw: 90, pitch: -75, js: 'WATER.set({dbg:2})', measure: 'range' },
  { name: 'shore', eye: [2640, 40, 0], yaw: 270, pitch: -35, js: 'WATER.set({dbg:6})', measure: 'ramp' },
  { name: 'lake',  eye: [-604, 120, -1150], yaw: 0, pitch: -40, js: 'WATER.set({dbg:0})', measure: 'lum' },
  { name: 'low',   eye: [2980, 4, -30], yaw: 70, pitch: -8, js: '', measure: null },
];
const SHOTS = opt('shots', null) ? opt('shots').split('@@').map(s => { const p = s.split(':'); return { name: p[0], eye: (p[1] || '0,400,0').split(',').map(Number), yaw: +(p[2] || 0), pitch: +(p[3] || 30), js: p.slice(4).join(':'), measure: null }; }) : DEFAULT;
const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('water_shot: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_shot_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const killChrome = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) { try { ch.kill(); } catch (e2) {} } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });

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
const px = (P, x, y) => { const i = (y * P.w + x) * P.bpp; return [P.data[i], P.data[i + 1], P.data[i + 2]]; };
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// the measures, each on a region of the frame (fractions of width/height)
function meanLum(P, x0, y0, x1, y1) { let s = 0, n = 0; for (let y = Math.floor(y0 * P.h); y < y1 * P.h; y += 2) for (let x = Math.floor(x0 * P.w); x < x1 * P.w; x += 2) { s += lum(px(P, x, y)); n++; } return s / n; }
function streak(P) {   // the columns' mean luminance over the lower 55 %: the sun's column against the median column
  const cols = []; for (let x = 0; x < P.w; x += 4) { let s = 0, n = 0; for (let y = Math.floor(0.45 * P.h); y < P.h; y += 3) { s += lum(px(P, x, y)); n++; } cols.push(s / n); }
  const sorted = cols.slice().sort((a, b) => a - b); return { max: Math.max(...cols), median: sorted[sorted.length >> 1], ratio: Math.max(...cols) / Math.max(1, sorted[sorted.length >> 1]) };
}
function rows(P) {     // the rows' mean luminance: the sun's lobe is a bright band across the frame (max row against the median row)
  const r = []; for (let y = 0; y < P.h; y += 4) { let s = 0, n = 0; for (let x = 0; x < P.w; x += 3) { s += lum(px(P, x, y)); n++; } r.push(s / n); }
  const sorted = r.slice().sort((a, b) => a - b); return { max: +Math.max(...r).toFixed(1), median: +sorted[sorted.length >> 1].toFixed(1), ratio: +(Math.max(...r) / Math.max(1, sorted[sorted.length >> 1])).toFixed(2) };
}
function range(P) {    // the debug view's grey over the lower 80 % (the water): min / max of the red channel
  let mn = 255, mx = 0; for (let y = Math.floor(0.2 * P.h); y < P.h; y += 2) for (let x = 0; x < P.w; x += 2) { const c = px(P, x, y); if (c[0] < mn) mn = c[0]; if (c[0] > mx) mx = c[0]; } return { min: mn, max: mx };
}
function ramp(P) {     // along the middle rows, over the WATER's pixels (the alpha view is pure grey; the land keeps its colour):
                       // the widest run rising from < 30 to > 220, and the largest step between neighbouring water pixels
  const grey = c => Math.abs(c[0] - c[1]) < 6 && Math.abs(c[1] - c[2]) < 6;
  let best = 0, step = 0;
  for (const yf of [0.4, 0.45, 0.5, 0.55, 0.6, 0.65]) { const y = Math.floor(yf * P.h); let start = -1, prev = null;
    for (let x = 0; x < P.w; x++) { const c = px(P, x, y); if (!grey(c)) { prev = null; start = -1; continue; }
      // (G460.5: the shallows' ramp is 40 m wide - the run is from under 30 to over 110, the frame's half)
      if (prev !== null) { step = Math.max(step, Math.abs(c[0] - prev)); if (prev < 30 && c[0] >= 30) start = x; if (start >= 0 && c[0] > 110) { best = Math.max(best, x - start); start = -1; } }
      prev = c[0]; } }
  return { width: best, step };
}

(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split(String.fromCharCode(10)).slice(0, 3).join(' | ')); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text))); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  await sleep(+opt('boot', 60000));
  let flying = false;
  for (let a = 0; a < 14 && !flying; a++) {
    await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
    await sleep(5000);
    flying = await ev("/TAXI|DOWNWIND|FINAL|TAKEOFF|CLIMB/.test(document.body.innerText)");   // (a floatplane rolls out afloat, its first phase TAKEOFF)
  }
  if (!flying) throw new Error('the roll-out never happened');
  const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
  for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
  await ev(`(()=>{const s=FLIGHT_PROBE.sim(),w=FLIGHT_PROBE.world();const cg=s.cgPos();const gy=w.terrainH(${AT[0]},${AT[2]});
    const dx=${AT[0]}-cg[0],dy=(gy+${AT[1]})-cg[1],dz=${AT[2]}-cg[2];
    for(let i=0;i<s.n;i++){s.p[i*3]+=dx;s.p[i*3+1]+=dy;s.p[i*3+2]+=dz;s.v[i*3]=s.v[i*3+1]=s.v[i*3+2]=0;}
    const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return 1;})()`);
  await ev("(()=>{const r=document.querySelector('#flRail [data-f=camera]');if(r)r.click();return 1;})()");
  await sleep(300);
  const got = await ev("(()=>{const p=[...document.querySelectorAll('#flFlyBody .pill')].find(b=>b.textContent.trim()==='free');if(!p)return 0;p.click();return 1;})()");
  if (!got) throw new Error('no free pill on the camera flyout');
  await ev("(()=>{const r=document.querySelector('#flRail [data-f=camera]');if(r)r.click();return 1;})()");
  await ev("(()=>{if(window.SHOT_MODE)SHOT_MODE.enter();return 1;})()");
  await ev('(()=>{' + CA + ';return 1;})()');
  await sleep(500);
  fs.mkdirSync(OUT, { recursive: true });
  // the sun's azimuth (DEV_CAM's yaw: 0 = -z, 90 = +x)
  const sunYaw = await ev("(()=>{const s=ATMO.U.sun.value;return Math.atan2(s.x,-s.z)*180/Math.PI;})()");
  const results = {};
  let fails = 0;
  const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
  if (PERF) {
    // THE COST: the water's own draws on the GPU (WATER.stats.gpuMs, the queries round the far
    // plane and the patch), a 60-frame mean, three ways - full, simple, and the water hidden
    // (the frame's own time then, for the whole-frame delta)
    await ev('(()=>{' + SEA + ';return 1;})()');
    const FRAME = `(() => new Promise(res => { let n = 0, g = 0, gn = 0, last = performance.now(), ft = []; const tick = () => { const now = performance.now(); ft.push(now - last); last = now;
      if (WATER.stats.draws) { g += WATER.stats.gpuMs; gn++; } if (++n < 61) requestAnimationFrame(tick); else { ft.sort((a, b) => a - b); res(JSON.stringify({ gpuMs: gn ? +(g / gn).toFixed(3) : null, frameMs: +ft[ft.length >> 1].toFixed(2) })); } }; requestAnimationFrame(tick); }))()`;
    // --ab: the water's own ms by SWITCH at the 300 m eye (a median of 90 frames each) - which band costs what
    const MED = (js) => `(() => new Promise(res => { ${js}; setTimeout(() => { const v = []; let n = 0; const tick = () => { if (WATER.stats.draws) v.push(WATER.stats.gpuMs); if (++n < 90) requestAnimationFrame(tick); else { v.sort((a, b) => a - b); res(v.length ? +v[v.length >> 1].toFixed(3) : null); } }; requestAnimationFrame(tick); }, 700); }))()`;
    if (argv.includes('--ab')) {
      await ev(`(()=>{const c=DEV_CAM;c.pos.set(3000,300,0);c.yaw=${90 * Math.PI / 180};c.pitch=${-75 * Math.PI / 180};WATER.set({timer:true,tier:'full'});return 1;})()`);
      const AB = [['full', "WATER.set({tier:'full'})"], ['nofoam', 'WATER.set({foam:false})'], ['nodetail', 'WATER.set({detail:false})'], ['nosigma', 'WATER.set({sigma:false})'], ['nodisp', 'WATER.set({displace:false})'], ['simple', "WATER.set({tier:'simple'})"]];
      for (const [n, js] of AB) { const ms = await ev(MED(js)); await ev("(()=>{WATER.set({tier:'full'});return 1;})()"); results[n] = ms; console.log(`water_shot --ab ${n.padEnd(9)} ${ms} ms`); }
    }
    for (const [name, eye, pitch] of (argv.includes('--ab') ? [] : [['sea300', [3000, 300, 0], -75], ['sea12', [2600, 12, 0], -4], ['coast120', [2800, 120, 0], -12]])) {
      await ev(`(()=>{const c=DEV_CAM;c.pos.set(${eye[0]},${eye[1]},${eye[2]});c.yaw=${90 * Math.PI / 180};c.pitch=${pitch * Math.PI / 180};return 1;})()`);
      const row = {};
      for (const tier of ['full', 'simple']) {
        await ev(`(()=>{WATER.set({tier:'${tier}',timer:true,on:true});return 1;})()`); await sleep(800);
        await ev(FRAME); row[tier] = JSON.parse(await ev(FRAME));
      }
      await ev("(()=>{WATER.set({on:false,timer:false});return 1;})()"); await sleep(600);
      await ev(FRAME); row.hidden = JSON.parse(await ev(FRAME));
      await ev("(()=>{WATER.set({on:true,tier:'full'});return 1;})()");
      results[name] = row;
      console.log(`water_shot --perf ${name.padEnd(9)} full ${row.full.gpuMs} ms GPU (frame ${row.full.frameMs}) · simple ${row.simple.gpuMs} ms (frame ${row.simple.frameMs}) · hidden frame ${row.hidden.frameMs}`);
      if (GATE) verdict(row.full.gpuMs != null && row.full.gpuMs <= 1.0, `${name}: the water's draws ${row.full.gpuMs} ms <= 1.0 ms (full tier)`);
    }
  } else {
    for (const s of SHOTS) {
      await ev(KEEP);
      if (s.js) await ev('(()=>{' + s.js + ';return 1;})()');
      const yaw = s.yaw === 'sun' ? sunYaw : s.yaw === 'antisun' ? sunYaw + 180 : s.yaw;
      await ev(`(()=>{const c=DEV_CAM;c.pos.set(${s.eye[0]},${s.eye[1]},${s.eye[2]});c.yaw=${yaw * Math.PI / 180};c.pitch=${s.pitch * Math.PI / 180};return 1;})()`);
      await sleep(WAIT);
      const shot = await cmd('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT, s.name + '.png');
      fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
      const P = readPNG(Buffer.from(shot.result.data, 'base64'));
      const m = s.measure === 'lum' ? { lum: +meanLum(P, 0.1, 0.45, 0.9, 0.95).toFixed(1) }
              : s.measure === 'glit' ? Object.assign({ lum: +meanLum(P, 0.05, 0.65, 0.95, 0.98).toFixed(1) }, rows(P)) : s.measure === 'streak' ? streak(P) : s.measure === 'range' ? range(P) : s.measure === 'ramp' ? ramp(P) : {};
      results[s.name] = m;
      console.log('water_shot: ' + file + '  ' + JSON.stringify(m));
    }
    if (GATE) {
      const R = results;
      if (R.down && R.graze) verdict(R.down.lum < meanLumOf('graze'), `down (${R.down.lum}) darker than graze - Fresnel`);
      // the sun's lobe: a bright band across the frame toward the sun (max row / median row), and the water under it
      // brighter than the same water looking away. Three's GGX at F0 0.02 makes a glint of the sky's own order at
      // 45 deg (the physics: the sun's 7e-5 sr over a 0.1 sr lobe times F), so the second bound is a modest one.
      if (R.glitter) verdict(R.glitter.ratio > 1.15, `the sun's lobe toward the sun (300 m, pitch -45): brightest row / median row ${R.glitter.ratio} > 1.15`);
      if (R.glitter && R.glitter_away) verdict(R.glitter.lum > 1.05 * R.glitter_away.lum, `the water under the lobe ${R.glitter.lum} brighter than away from the sun ${R.glitter_away.lum}`);
      if (R.rough) verdict(R.rough.min >= 12 && R.rough.max <= 255, `roughness view in [0.05, 1]: ${(R.rough.min / 255).toFixed(2)} .. ${(R.rough.max / 255).toFixed(2)} (no NaN)`);
      if (R.shore) verdict(R.shore.width >= 3 && R.shore.step <= 160, `the shore's alpha ramps over ${R.shore.width} px, largest step ${R.shore.step}`);
      if (R.lake && R.down) verdict(Math.abs(R.lake.lum - R.down.lum) > 3, `the lake (${R.lake.lum}) is not the sea (${R.down.lum})`);
    }
    function meanLumOf(k) { const f = path.join(OUT, k + '.png'); return meanLum(readPNG(fs.readFileSync(f)), 0.1, 0.55, 0.9, 0.95); }
  }
  fs.writeFileSync(path.join(OUT, PERF ? 'perf.json' : 'measures.json'), JSON.stringify({ date: new Date().toISOString(), url: URL, results }, null, 1));
  if (GATE) console.log('WATER SHOT: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  ws.close(); killChrome();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('water_shot: ' + e.message); killChrome(); process.exit(1); });
