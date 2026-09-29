#!/usr/bin/env node
// _sheyes_night.js - SHADOW-EYES (G1080) THE NUMBERS FOR THE SOFT TRAILING SHADOW, against a live_driver page
// (tools/live_driver.js <root> default dev.html <cmdPort>, env Q='shadoweyes=1' GFX='{"clouds":"off"}'), under the GPU lock.
//
//   node tools/_sheyes_night.js <cmdPort> <outDir>
//
// The user's live A/B (2026-09-29): only config 4 (the far sun map every frame) changed the soft trailing shadow, most at
// speed. Three readings, each a number:
//   A. MOVERS: the far map's casters that move with the aeroplane (tools/_sheyes_movers.js), at the taxi.
//   B. IS THE AEROPLANE IN THE FAR MAP? Paused (the world held), the far map drawn EVERY frame, screenshots with the
//      aeroplane in the far map's pass (config 0) and hidden from it alone (config 9), and a control pair 0/0: a
//      difference above the control's is the aeroplane's far-map shadow. The pixels are decoded here (PNG, no package).
//   C. PACING: taxiing, configs 1 and 4 alternated (8 s each): the rendered intervals (mean, uneven share - consecutive
//      intervals differing by 8 ms or more), and the shadow pass's CPU time per frame (renderer.shadowMap.render wrapped).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const PORT = +(process.argv[2] || 8672), OUT = process.argv[3] || '.';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = (p, body) => new Promise((res, rej) => { const q = http.request({ host: '127.0.0.1', port: PORT, path: p, method: 'POST' }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(b)); }); q.on('error', rej); q.end(body); });
const get = p => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(b)); }).on('error', rej));
const E = js => post('/eval', js);
const log = s => { console.log(s); fs.appendFileSync(path.join(OUT, 'night.log'), s + '\n'); };
// ---- a small PNG decoder (8-bit RGB / RGBA, not interlaced: what CDP's captureScreenshot writes) ----
function png(file) {
  const b = fs.readFileSync(file); let o = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (o < b.length) { const n = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (t === 'IDAT') idat.push(d); o += 12 + n; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), st = w * bpp, px = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)], src = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)), row = px.subarray(y * st, (y + 1) * st), up = y ? px.subarray((y - 1) * st, y * st) : null;
    for (let x = 0; x < st; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, u = up ? up[x] : 0, c = (up && x >= bpp) ? up[x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) { const p = a + u - c, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? u : c); }
      row[x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}
function diff(f1, f2) {
  const A = png(f1), B = png(f2); let n = 0, sum = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 60; y < A.h; y++) for (let x = 0; x < A.w; x++) {   // (the label's strip at the top left out)
    const i = (y * A.w + x) * A.bpp, j = (y * B.w + x) * B.bpp;
    const d = Math.abs(A.px[i] - B.px[j]) + Math.abs(A.px[i + 1] - B.px[j + 1]) + Math.abs(A.px[i + 2] - B.px[j + 2]);
    if (d > 12) { n++; sum += d; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { px: n, meanD: n ? +(sum / n).toFixed(1) : 0, box: n ? [x0, y0, x1, y1] : null };
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (let i = 0; i < 150; i++) { if (await E('window.BOOT && BOOT.state') === 'gone') break; await sleep(2000); }
  await E("(document.getElementById('bGo').click(), 1)");
  for (let i = 0; i < 150; i++) { const s = await E("(()=>{const T=window.FLYDIY_TRIPS;const t=T&&T[T.length-1];return (t&&t.kind+':'+t.done)+' '+BOOT.state})()"); if (/rollout:true.*gone/.test(s)) break; await sleep(2000); }
  await sleep(3000);
  await E("(document.getElementById('bGo').click(), SHEYES(0))");
  for (let i = 0; i < 60; i++) { const v = +(await E('FLIGHT_PROBE.sim().out.V || 0')); if (v > 3) break; await sleep(1000); }
  log('taxi: ' + await E("FLIGHT_PROBE.ap().phase + ' V ' + (FLIGHT_PROBE.sim().out.V||0).toFixed(1)"));
  // ---- A ----
  log('A movers: ' + await E(fs.readFileSync(path.join(__dirname, '_sheyes_movers.js'), 'utf8')));
  // ---- C (taxiing, before the pause) ----
  await E(`(()=>{ const R=FLIGHT_PROBE.renderer(), SM=R.shadowMap; if(!SM.__t){ const r=SM.render; SM.__t={ms:[],far:0}; SM.render=function(){ const t=performance.now(); const x=r.apply(this,arguments); SM.__t.ms.push(performance.now()-t); return x; }; } return 1; })()`);
  const pace = [];
  for (const c of [1, 4, 1, 4, 1, 4]) {
    await E(`(SHEYES(${c}), FLIGHT_PROBE.renderer().shadowMap.__t.ms.length = 0, 1)`);
    await sleep(8000);
    const r = JSON.parse(await E(`(()=>{ const h=FLYDIY_PACE.recent().slice(-120); let odd=0; for(let i=1;i<h.length;i++) if(Math.abs(h[i]-h[i-1])>8) odd++; const ms=FLIGHT_PROBE.renderer().shadowMap.__t.ms; const s=ms.slice().sort((a,b)=>a-b);
      return JSON.stringify({ cfg:${c}, n:h.length, meanMs:+(h.reduce((a,b)=>a+b,0)/h.length).toFixed(2), uneven:+(100*odd/Math.max(1,h.length-1)).toFixed(1), shadowCpuMean:+(ms.reduce((a,b)=>a+b,0)/Math.max(1,ms.length)).toFixed(2), shadowCpuP90:+(s[Math.floor(0.9*s.length)]||0).toFixed(2), V:+(FLIGHT_PROBE.sim().out.V||0).toFixed(1), phase:FLIGHT_PROBE.ap().phase }); })()`));
    pace.push(r); log('C pace ' + JSON.stringify(r));
  }
  // ---- D: THE LATE SHADOW, live (G1080): the free camera left behind while the aeroplane taxis on, config 1 (as it was)
  // then 5 (the fix): the craft cascade's aim to the drawn aeroplane (m) and its half-width (m), sampled every 100 ms
  for (const c of [1, 5]) {
    await E(`(SHEYES(${c}), FLIGHT_PROBE.camMode('free'), 1)`);
    const r = await E(`(async()=>{ const SN=SHADOW_NEAR, out=[]; for(let i=0;i<60;i++){ await new Promise(z=>setTimeout(z,100)); const P=SN.drawnPoint(), t=SN.C1.tgt; if(P) out.push([Math.hypot(P[0]-t.x,P[2]-t.z), SN.C1.H]); }
      const off=out.map(q=>q[0]), H=out.map(q=>q[1]); return JSON.stringify({ cfg:${c}, aimOffMax:+Math.max(...off).toFixed(1), aimOffLast:+off[off.length-1].toFixed(1), Hmax:+Math.max(...H).toFixed(2), Hmin:+Math.min(...H).toFixed(2), missed:out.filter(q=>q[0]>q[1]).length, n:out.length }); })()`);
    log('D late shadow ' + r);
    await E("(FLIGHT_PROBE.camMode('chase'), 1)");
    await sleep(3000);
  }
  // ---- B (paused) ----
  await E("(SHEYES(0), document.getElementById('bPause').click(), 1)");
  await sleep(1500);
  log('B paused, frames drawn in 1 s: ' + await E("(async()=>{ const R=FLIGHT_PROBE.renderer(), f0=R.info.render.frame; await new Promise(z=>setTimeout(z,1000)); return R.info.render.frame - f0; })()"));
  const shots = [];
  for (const [k, c] of [['a0', 0], ['b0', 0], ['c9', 9], ['d0', 0], ['e9', 9]]) {
    await E(`(SHEYES(${c}), window.SHADOW_RATE.every = 1, 1)`);
    await sleep(1200);
    const f = path.join(OUT, 'far_' + k + '.png');
    await get('/shot?f=' + encodeURIComponent(f));
    shots.push(f);
  }
  const d = { control_a0_b0: diff(shots[0], shots[1]), craftFar_b0_c9: diff(shots[1], shots[2]), control_c9_e9: diff(shots[2], shots[4]), craftFar_d0_e9: diff(shots[3], shots[4]) };
  log('B pixels ' + JSON.stringify(d));
  await E("(SHEYES(0), document.getElementById('bPause').click(), 1)");
  fs.writeFileSync(path.join(OUT, 'night.json'), JSON.stringify({ pace, pixels: d }, null, 1));
  log('done');
})().catch(e => { log('ERR ' + (e && e.stack || e)); process.exit(1); });
