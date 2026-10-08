#!/usr/bin/env node
// moonlight_shots.js - G2600 MOONLIGHT: THE NIGHT'S FIXED FRAMES, BEFORE | AFTER, WITH THE NUMBERS
//
// shadowsky_shots.js's rig (headless Chrome on this machine's GPU, a page per build, the roll-out, then a held
// aeroplane per view) with what a night needs: each view sets the DAY (a date, a UT hour, the cloud, the clock
// frozen), places the aeroplane at HOME (the stand, 300 m over the field, or on a 150 m final), aims the orbit
// (at the runway, toward the sea with the moon ahead or behind - the hour searched on the night so the moon
// stands over the sea or behind the eye), waits for the light's ease and the probe, and writes a PNG and a row:
//   the frame's mean luminance (linear, Rec.709 of the decoded sRGB) and mean code over the 3D view (the rails out),
//   the sky band's and the ground band's, and the page's light: the key (sun | moon), its intensity and its
//   elevation, the hemisphere, the exposure on the renderer, the moon's phase and height, the cloud cover;
//   and THE RESOLVE TARGET'S RADIANCE (fp16) read back over the ground band: its mean, its least non-zero value
//   and how many distinct values it holds - the precision a night is drawn in under the linear compositing.
//
//   node tools/moonlight_shots.js [--pages index_before.html,index.html] [--q gfx=gamer] [--views a,b]
//          [--out reports/evidence/MOONLIGHT] [--size 1600x900] [--port 8547] [--fallback D:/Dev/DeGaRoR.github.io]
//
// A GPU RUN: tools/perf/boxlock.sh take gpu MOONLIGHT first (A0's window), drop after. Stills only after the
// loading overlay is gone (+3 s); every still is looked at before it is reported.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os'), zlib = require('zlib');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const PAGES = opt('pages', 'index_before.html,index.html').split(',');
const SIZE = opt('size', '1600x900').split('x').map(Number);
const SPORT = +opt('port', 8547);
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'MOONLIGHT')));
const Q = opt('q', '');
const FALLBACK = opt('fallback', 'D:/Dev/DeGaRoR.github.io');
const ONLY = (opt('views', '') || '').split(',').filter(Boolean);
// --variants '[{"eye":0},{"eye":1.5}]': each NIGHT view shot once per set of light_rig NIGHT dials (pages that have them;
// the day views once, with the first set) - the file name carries the set (e.g. _eye1.5)
const VARIANTS = JSON.parse(opt('variants', '[null]'));
// --crossing (G2620): instead of the views, the evening's sun stepped through the pre-exposure's switch (-6.0 .. -7.0 deg in
// 0.05 steps, three frames a step, a still a step over the sea toward the sun) - the switch frame and its neighbours compared
const CROSS = argv.includes('--crossing');
const vtag = o => (o ? '_' + Object.keys(o).map(k => k + o[k]).join('_') : '');
const REPO = path.resolve(__dirname, '..', '..');
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });

// ---- the nights (Jolene, 55 N; 06_solar): found off the almanac, 2026 ----
const FULL = { date: '2026-09-26', utc: 8.5 * 3600 };    // 00:30 AKDT: the moon 99.8 % lit, 36 deg up in the south, the sun at -36
const HALF = { date: '2026-10-03', utc: 10 * 3600 };     // 02:00 AKDT: 52 % lit, 33 deg up in the east
const NEW_ = { date: '2026-10-10', utc: 8.5 * 3600 };    // 00:30 AKDT: 0.2 % lit, the moon at -44
const NOON = { date: '2026-09-26', utc: 20.75 * 3600 };  // 12:45 AKDT, the same date: the day the night must not move
const CLEAR = { cloudCover: 0 }, OVERCAST = { cloudCover: 1, cloudType: 'st' };
// views: at 'stand' | 'over' (300 m over HOME's field) | 'final' (150 m on a 2 km final to HOME's threshold);
//        aim 'runway' (along the strip toward its far end / threshold) | 'seaMoon' | 'seaNoMoon' (toward the nearest sea, the
//        hour moved on the night so the moon is ahead / behind) ; dist the orbit's distance, el its elevation (rad)
const OVERCAST_P = { cloudCover: 0.9, cloudType: 'st', cloudUpper: null };   // the panel's own overcast (clouds_ui.js)
const VIEWS = [
  { name: 'noon_over',     day: Object.assign({}, NOON, CLEAR), at: 'over', aim: 'seaMoon', el: 0.05, dist: 30, settle: 14 },
  { name: 'noon_over_b',   day: Object.assign({}, NOON, CLEAR), at: 'over', aim: 'seaMoon', el: 0.05, dist: 30, settle: 2 },   // the control: noon_over again, nothing moved
  { name: 'noon_stand',    day: Object.assign({}, NOON, CLEAR), at: 'stand', aim: 'runway', el: 0.10, dist: 16 },
  { name: 'noonx_over',    day: Object.assign({}, NOON, CLEAR), at: 'over', aim: 'seaMoon', el: 0.05, dist: 30, settle: 10, js: 'window.LIGHT_EASE && (LIGHT_EASE.on = false)' },   // the ease off: the light at once, no step history (a page-vs-page proof)
  { name: 'noonx_over_b',  day: Object.assign({}, NOON, CLEAR), at: 'over', aim: 'seaMoon', el: 0.05, dist: 30, settle: 2, js: 'window.LIGHT_EASE && (LIGHT_EASE.on = false)' },
  { name: 'noonx_stand',   day: Object.assign({}, NOON, CLEAR), at: 'stand', aim: 'runway', el: 0.10, dist: 16, settle: 6, js: 'window.LIGHT_EASE && (LIGHT_EASE.on = false)' },
  { name: 'dusk_1700',     day: Object.assign({ date: '2026-09-26', utc: 3600 }, CLEAR), at: 'over', aim: 'sun', el: 0.05, dist: 30, settle: 14 },   // 17:00 AKDT on the 25th, the sun at 12.8 deg
  { name: 'sunset',        day: Object.assign({ date: '2026-09-26', utc: 3600 }, CLEAR), preset: 'sunset', at: 'over', aim: 'sun', el: 0.05, dist: 30, settle: 14 },
  { name: 'full_stand',    day: Object.assign({}, FULL, CLEAR), at: 'stand', aim: 'runway', el: 0.10, dist: 16, settle: 14 },
  { name: 'full_sea_moon_ahead', day: Object.assign({}, FULL, CLEAR), at: 'over', aim: 'seaMoon', el: 0.05, dist: 30 },
  { name: 'full_moon_behind', day: Object.assign({}, FULL, CLEAR), at: 'over', aim: 'awayMoon', el: 0.05, dist: 30 },
  { name: 'full_moon_up',  day: Object.assign({}, FULL, CLEAR), at: 'over', aim: 'moon', el: -0.45, dist: 30 },
  { name: 'full_final',    day: Object.assign({}, FULL, CLEAR), at: 'final', aim: 'runway', el: 0.14, dist: 24 },
  { name: 'half_stand',    day: Object.assign({}, HALF, CLEAR), at: 'stand', aim: 'runway', el: 0.10, dist: 16 },
  { name: 'half_over',     day: Object.assign({}, HALF, CLEAR), at: 'over', aim: 'moon', el: 0.05, dist: 30 },
  { name: 'new_stand',     day: Object.assign({}, NEW_, CLEAR), at: 'stand', aim: 'runway', el: 0.10, dist: 16 },
  { name: 'new_over',      day: Object.assign({}, NEW_, CLEAR), at: 'over', aim: 'seaMoon', el: 0.05, dist: 30 },
  { name: 'overcast_stand', day: Object.assign({}, FULL, OVERCAST_P), at: 'stand', aim: 'runway', el: 0.10, dist: 16, settle: 25 },
  { name: 'overcast_over', day: Object.assign({}, FULL, OVERCAST_P), at: 'over', aim: 'seaMoon', el: 0.05, dist: 30 },
  // G2620 (PRE-EXPOSURE): every light kind lit - the premises' lamps and panes and the runway lights from the stand, the
  // aeroplane's nav / beacon / landing lights forced on (the cockpit's own switches), the panel at night from the cockpit
  { name: 'lit_apron',     day: Object.assign({}, FULL, CLEAR), at: 'stand', aim: 'lamps', el: 0.12, dist: 22, settle: 10 },
  { name: 'lights_on',     day: Object.assign({}, NEW_, CLEAR), at: 'stand', aim: 'runway', el: 0.18, dist: 14, settle: 6,
    js: "(typeof CK !== 'undefined' && CK.sw) && ['sw_nav', 'sw_beacon', 'sw_land', 'sw_taxi'].forEach(k => { if (k in CK.sw) { CK.sw[k] = 1; if (CK.handSw) CK.handSw[k] = true; } })" },
  { name: 'cockpit_night', day: Object.assign({}, NEW_, CLEAR), at: 'over', aim: 'runway', el: 0.05, dist: 30, settle: 6, cam: 'cockpit',
    js: "(typeof CK !== 'undefined' && CK.sw) && ['sw_instr', 'sw_flood', 'sw_nav'].forEach(k => { if (k in CK.sw) { CK.sw[k] = 1; if (CK.handSw) CK.handSw[k] = true; } })" },
].filter(v => !ONLY.length || ONLY.includes(v.name));

// ---- in the page ----
// HOME's strip, the nearest sea's heading from it (72 headings, the first water 600 m - 8 km out), the night's hour
// with the moon over that heading (or behind it), the aeroplane placed and the orbit aimed. Returns the plan.
const SETUP = V => `(async () => {
  const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
  const s = FLIGHT_PROBE.sim(), w = FLIGHT_PROBE.world();
  ${V.js || ''};
  // the stand is where the roll-out put the aeroplane: kept at the first view, put back for every 'stand' view
  if (!window.__moonStand) window.__moonStand = s.cgPos().slice();
  const A = (w.aerodromes || []).find(a => a.id === 'HOME') || (w.aerodromes || [])[0];
  const strip = A && A.strips ? (A.strips.find(q => !q.flyIn) || A.strips[0]) : A;
  const hd = strip && strip.hdg != null ? strip.hdg : 0;
  const cx = strip ? strip.x : 0, cz = strip ? strip.z : 0, dx = strip && strip.dx != null ? strip.dx : Math.cos(hd), dz = strip && strip.dz != null ? strip.dz : Math.sin(hd), len = strip && strip.len ? strip.len : 600;
  // the landing direction (a premises strip names it: landHdg; the generator's lands toward -dx)
  const lh = strip && strip.landHdg != null ? [Math.cos(strip.landHdg), Math.sin(strip.landHdg)] : [-dx, -dz];
  const wet = (x, z) => { const h = w.terrainH(x, z), wh = w.waterH ? w.waterH(x, z) : null; return (wh != null && isFinite(wh) && wh > h) || h <= 0; };
  let sea = null;
  for (let r = 600; r <= 8000 && !sea; r += 200) for (let k = 0; k < 72 && !sea; k++) { const a = k / 72 * Math.PI * 2; if (wet(cx + Math.cos(a) * r, cz + Math.sin(a) * r) && wet(cx + Math.cos(a) * (r + 400), cz + Math.sin(a) * (r + 400))) sea = [Math.cos(a), Math.sin(a), r]; }
  if (!sea) sea = [dx, dz, 0];
  const day = Object.assign({ rate: 0 }, ${JSON.stringify(V.day)});
  const aim = ${JSON.stringify(V.aim)};
  if (aim === 'seaMoon' || aim === 'seaNoMoon') {   // the hour on this night (+-6 h) whose moon is over the sea (or behind the eye), the moon > 15 deg
    const want = aim === 'seaMoon' ? 1 : -1; let best = null;
    for (let m = -360; m <= 360; m += 10) { let u = day.utc + m * 60;
      DAY_CLOCK.set({ date: day.date, utc: ((u % 86400) + 86400) % 86400 });
      const d = DAY_CLOCK.day(), mv = d.moon; if (d.sunEl > -12 || d.moonEl < 15) continue;
      const h = Math.hypot(mv[0], mv[2]) || 1, c = (mv[0] * sea[0] + mv[2] * sea[1]) / h * want;
      if (!best || c > best.c) best = { c, utc: ((u % 86400) + 86400) % 86400 }; }
    if (best && best.c > 0.5) day.utc = best.utc;
  }
  DAY_CLOCK.set(day);
  if (${JSON.stringify(V.preset || null)}) DAY_CLOCK.preset(${JSON.stringify(V.preset || null)});   // a named hour solved on that date (the clock's own)
  let px = cx, pz = cz, agl = 0, look = [dx, dz];
  if (${JSON.stringify(V.at)} === 'stand') { const st = window.__moonStand, cg = s.cgPos(); if (Math.hypot(st[0] - cg[0], st[1] - cg[1], st[2] - cg[2]) > 0.5) await FLIGHT_PROBE.place({ by: [st[0] - cg[0], st[1] - cg[1], st[2] - cg[2]], zeroV: true }); agl = null; look = [dx, dz]; }
  else if (${JSON.stringify(V.at)} === 'over') { agl = 300; look = [sea[0], sea[1]]; }
  else if (${JSON.stringify(V.at)} === 'final') { const tx = cx - lh[0] * len / 2, tz = cz - lh[1] * len / 2; px = tx - lh[0] * 1200; pz = tz - lh[1] * 1200; agl = 150; look = [lh[0], lh[1]]; }
  if (aim === 'lamps') { const L = window.WORLD && WORLD.premises && WORLD.premises.lamps, pub = (L && L.pub || []).filter(e => e.wp), cg = s.cgPos();
    if (pub.length) { pub.sort((a, b) => Math.hypot(a.wp[0] - cg[0], a.wp[2] - cg[2]) - Math.hypot(b.wp[0] - cg[0], b.wp[2] - cg[2]));
      const q = pub.slice(0, 6), mx = q.reduce((a, e) => a + e.wp[0], 0) / q.length - cg[0], mz = q.reduce((a, e) => a + e.wp[2], 0) / q.length - cg[2], l = Math.hypot(mx, mz) || 1; look = [mx / l, mz / l]; } }
  if (aim === 'sun') { const sv = DAY_CLOCK.day().sun, h = Math.hypot(sv[0], sv[2]) || 1; look = [sv[0] / h, sv[2] / h]; }
  if (aim === 'moon' || aim === 'awayMoon') { const mv = DAY_CLOCK.day().moon, h = Math.hypot(mv[0], mv[2]) || 1, k = aim === 'moon' ? 1 : -1; look = [mv[0] / h * k, mv[2] / h * k]; }
  if (aim === 'runway' && ${JSON.stringify(V.at)} === 'stand') { const cg = s.cgPos(); look = [cx - cg[0] + dx * len * 0.3, cz - cg[2] + dz * len * 0.3]; const l = Math.hypot(look[0], look[1]) || 1; look = [look[0] / l, look[1] / l]; }
  if (agl != null) { const cg = s.cgPos(), gy = Math.max(w.terrainH(px, pz), w.waterH ? (w.waterH(px, pz) || -1e9) : -1e9) + agl;
    await FLIGHT_PROBE.place({ by: [px - cg[0], gy - cg[1], pz - cg[2]], zeroV: true }); }
  const az = Math.atan2(-look[1], -look[0]);   // app.js placeCamera: the eye at target + dist (cos el cos az, sin el, cos el sin az), looking back at it
  FLIGHT_PROBE.camSet(az, ${V.el}, ${V.dist});
  const d = DAY_CLOCK.day();
  return { local: d.local, sunEl: +d.sunEl.toFixed(1), moonEl: +d.moonEl.toFixed(1), phase: +d.moonPhase.toFixed(3), sea: sea.map(v => +v.toFixed(2)), az: +az.toFixed(3) };
})()`;
const FRAMES = n => `new Promise(r => { let k = 0; const f = () => { if (++k >= ${n}) r(k); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`;
// the light as the page holds it, and the resolve target's fp16 radiance over the ground band
const REPORT = `(() => {
  const W = window, w = window.WORLD || {}, R = FLIGHT_PROBE.renderer(), L = W.SKY_LIGHT && W.SKY_LIGHT.last, d = DAY_CLOCK.day();
  const o = { key: L ? (L.isMoon ? 'moon' : 'sun') : '?', keyI: w.sun ? +w.sun.intensity.toExponential(3) : null, keyY: w.SUN ? +w.SUN.y.toFixed(3) : null,
    keyDirMoon: !!(w.KEY_SKY), hemiI: w.hemi ? +w.hemi.intensity.toExponential(3) : null, exposure: +R.toneMappingExposure.toExponential(3),
    moonPhase: +d.moonPhase.toFixed(3), moonEl: +d.moonEl.toFixed(1), sunEl: +d.sunEl.toFixed(1), cover: d.cloudCoverEff,
    night: W.LIGHT_RIG && W.LIGHT_RIG.nightU ? Array.from(W.LIGHT_RIG.nightU.uNightEye.value.toArray ? W.LIGHT_RIG.nightU.uNightEye.value.toArray() : W.LIGHT_RIG.nightU.uNightEye.value).map(v => +v.toFixed(3)) : null,
    linear: W.FLYDIY_AA && W.FLYDIY_AA.linear ? W.FLYDIY_AA.linear() : null,
    pre: W.LIGHT_RIG && W.LIGHT_RIG.preState ? W.LIGHT_RIG.preState() : null,   // G2620
    // the exposure's chain: the schedule's, the declared base, the ease, the eye, the rig row
    exSched: W.LIGHT_RIG ? +W.LIGHT_RIG.exposureFor(d.sunEl).toExponential(3) : null, exBase: W.GFX && W.GFX.exposureBase ? W.GFX.exposureBase() : null, eyeK: W.GFX && W.GFX.eye ? W.GFX.eye() : null,
    ease: W.LIGHT_EASE ? { on: W.LIGHT_EASE.on, init: W.LIGHT_EASE.init, ex: W.LIGHT_EASE.ex, tEx: W.LIGHT_EASE.tEx, setEx: W.LIGHT_EASE.setEx, applies: W.LIGHT_EASE.applies, writes: W.LIGHT_EASE.writes } : null,
    rig: w.rig && w.rig.get ? (r => ({ manual: r.manual, exposure: r.exposure, env: r.env }))(w.rig.get()) : null, inGarage: !!(W.FLYDIY_IN_GARAGE) };
  try {
    const rt = W.FLYDIY_AA && W.FLYDIY_AA.target && W.FLYDIY_AA.target();
    if (rt) {
      const ww = 96, hh = 48, x0 = Math.floor(rt.width / 2 - ww / 2), y0 = Math.floor(rt.height * 0.18);   // a ground band low in the frame
      const buf = new Uint16Array(ww * hh * 4); R.readRenderTargetPixels(rt, x0, y0, ww, hh, buf);
      const h2f = h => { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; return e === 0 ? s * f * Math.pow(2, -24) : e === 31 ? (f ? NaN : s * Infinity) : s * (1 + f / 1024) * Math.pow(2, e - 15); };
      let sum = 0, n = 0, minNZ = Infinity, sub = 0, zero = 0; const vals = new Set();
      for (let i = 0; i < ww * hh; i++) { const r = h2f(buf[i * 4]), g = h2f(buf[i * 4 + 1]), b = h2f(buf[i * 4 + 2]); const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sum += Y; n++; vals.add(buf[i * 4 + 1]); if (g > 0 && g < minNZ) minNZ = g; if (g > 0 && g < 6.1e-5) sub++; if (g === 0) zero++; }
      o.rt = { type: rt.texture.type, samples: rt.samples, meanY: +(sum / n).toExponential(3), minG: minNZ === Infinity ? 0 : +minNZ.toExponential(3), distinctG: vals.size, subnormalShare: +(sub / n).toFixed(3), zeroShare: +(zero / n).toFixed(3) };
    }
  } catch (e) { o.rtErr = String(e).slice(0, 120); }
  return JSON.stringify(o);
})()`;

// ---- the PNG's numbers (an 8-bit RGB/RGBA PNG, not interlaced: CDP's) ----
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
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const LIN = Array.from({ length: 256 }, (_, i) => lin(i));
function stats(file) {
  const P = png(file), { w, h, bpp, px } = P;
  // the 3D view without the rails: the middle 60 % across, 8-92 % down; bands: the top fifth (sky) and the bottom fifth (ground)
  const box = (y0, y1) => { let s = 0, c = 0, n = 0; for (let y = Math.floor(h * y0); y < Math.floor(h * y1); y++) for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x++) {
    const i = (y * w + x) * bpp; s += 0.2126 * LIN[px[i]] + 0.7152 * LIN[px[i + 1]] + 0.0722 * LIN[px[i + 2]]; c += (px[i] + px[i + 1] + px[i + 2]) / 3; n++; } return [s / n, c / n]; };
  const [mY, mC] = box(0.08, 0.92), [sY, sC] = box(0.08, 0.26), [gY, gC] = box(0.74, 0.92);
  return { meanY: +mY.toFixed(5), meanCode: +mC.toFixed(1), skyY: +sY.toFixed(5), skyCode: +sC.toFixed(1), groundY: +gY.toFixed(5), groundCode: +gC.toFixed(1) };
}
function diff(f1, f2) {
  const A = png(f1), B = png(f2); let n = 0, mx = 0;
  for (let i = 0; i < A.px.length && i < B.px.length; i++) { const d = Math.abs(A.px[i] - B.px[i]); if (d) n++; if (d > mx) mx = d; }
  return { differing: n, maxDelta: mx };
}

async function runPage(page) {
  const port = 9300 + (process.pid % 300) + PAGES.indexOf(page);
  const udd = path.join(os.tmpdir(), 'cdp_moon_' + port + '_' + Date.now());
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--window-size=' + SIZE[0] + ',' + SIZE[1], '--hide-scrollbars', '--no-first-run',
    '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  const rows = [];
  try {
    let tgt = null;
    for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + port + '/json')).find(t => t.type === 'page'); } catch (e) {} }
    if (!tgt) throw new Error('no page target');
    const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    let id = 0; const waits = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
    const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
      if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r))); return d.result.value; };
    await cmd('Page.enable'); await cmd('Runtime.enable');
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{for(const k of Object.keys(localStorage)) if(/^flydiy\\./.test(k)) localStorage.removeItem(k)}catch(e){}' });
    await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
    const url = 'http://localhost:' + SPORT + '/flyDiy/' + page + (Q ? '?' + Q : '');
    await cmd('Page.navigate', { url });
    await sleep(1500);
    try { await ev("Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('timeout'), 150000))])"); } catch (e) { await sleep(18500); }
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) { await ev("(()=>{const b=document.getElementById('bGo'); if (b) b.click();})()"); await sleep(6000); flying = await ev("/TAXI|DOWNWIND|FINAL|DEPART/.test(document.body.innerText) && !!window.FLIGHT_PROBE"); }
    for (let i = 0; i < 150; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
    await sleep(3000);   // the overlay gone + 3 s
    const tag = path.basename(page, '.html') + (Q ? '_' + Q.replace(/\W+/g, '') : '');
    fs.mkdirSync(OUT, { recursive: true });
    const hasNight = await ev('!!(window.LIGHT_RIG && window.LIGHT_RIG.setNight)');
    if (CROSS) {
      await ev(SETUP({ name: 'cross', day: Object.assign({ date: '2026-09-26', utc: 3600 }, CLEAR), at: 'over', aim: 'sun', el: 0.05, dist: 30 }));
      await ev(FRAMES(90)); await sleep(8000);
      let prev = null;
      for (let k = 0, e = -6.0; e >= -7.0001; k++, e -= 0.05) {
        const info = JSON.parse(await ev(`(() => { const d = DAY_CLOCK.day(), u = d.utcFor(${e.toFixed(3)}, false); if (u != null) DAY_CLOCK.set({ utc: u });
          const W = window; return JSON.stringify({ el: +DAY_CLOCK.day().sunEl.toFixed(3), pre: W.LIGHT_RIG && W.LIGHT_RIG.preState ? W.LIGHT_RIG.preState() : null,
            exR: +FLIGHT_PROBE.renderer().toneMappingExposure.toExponential(4), base: W.GFX && W.GFX.exposureBase ? +W.GFX.exposureBase().toExponential(4) : null }); })()`));
        await ev(FRAMES(3));
        const shot = await cmd('Page.captureScreenshot', { format: 'png' });
        const file = path.join(OUT, 'cross_' + String(k).padStart(2, '0') + '_' + tag + '.png');
        fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
        const st = stats(file), d = prev ? +(st.meanCode - prev.meanCode).toFixed(2) : 0;
        rows.push({ view: 'cross', k, page: tag, info, still: st, dMean: d, file: path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/') });
        console.log('cross ' + String(k).padStart(2) + ' el ' + info.el + ' P ' + (info.pre ? info.pre.P + ' (switches ' + info.pre.switches + ')' : '-') + ' ex ' + info.exR + ' base ' + info.base + ' mean code ' + st.meanCode + ' d ' + d);
        prev = st;
      }
      const sw = rows.findIndex((r, i) => i > 0 && r.info.pre && rows[i - 1].info.pre && r.info.pre.P !== rows[i - 1].info.pre.P);
      if (sw > 0) { const ds = rows.map(r => Math.abs(r.dMean)), near = ds.filter((_, i) => i !== sw && Math.abs(i - sw) <= 4);
        console.log('SWITCH at step ' + sw + ' (el ' + rows[sw].info.el + '): |d mean| ' + ds[sw] + ' vs the 8 steps round it ' + JSON.stringify(near) + ' (max ' + Math.max(...near) + ')'); }
      else console.log('no switch seen (a page without the pre-exposure, or the sun did not cross)');
      try { await cmd('Browser.close'); } catch (e) {}
      return rows;
    }
    for (const V of VIEWS) for (const [vi, VAR] of VARIANTS.entries()) {
      if (vi > 0 && (/^(noon|dusk|sunset)/.test(V.name) || !hasNight)) continue;
      if (hasNight) await ev('(LIGHT_RIG.setNight(Object.assign(LIGHT_RIG.nightDefaults(), ' + JSON.stringify(VAR || {}) + ')), window.WORLD && WORLD.relight && WORLD.relight(), 1)');
      const vt = hasNight && !/^(noon|dusk|sunset)/.test(V.name) ? vtag(VAR) : '';
      const plan = await ev(SETUP(V));
      if (V.cam) await ev("(FLIGHT_PROBE.camMode(" + JSON.stringify(V.cam) + "), 1)");
      await ev(FRAMES(90)); await sleep((V.settle || 8) * 1000);     // the light's ease (LIGHT-SMOOTH tau 1.2 s), the probe's re-bake, the clouds' fit
      if (!V.cam) await ev(SETUP(V));              // again: the aeroplane and the orbit where they were asked (a fit or a probe moved nothing, but be sure)
      await ev(FRAMES(120)); await sleep(1500);
      // the rig pauses the sim, so the cockpit's glow never runs on its own (G436.5): lit now, at this frame's P
      await ev("((typeof CK !== 'undefined' && CK.glow) && CK.glow(0), 1)"); await ev(FRAMES(4));
      const png1 = await cmd('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT, V.name + '_' + tag + vt + '.png');
      fs.writeFileSync(file, Buffer.from(png1.result.data, 'base64'));
      const page = JSON.parse(await ev(REPORT)), st = stats(file);
      if (V.cam) await ev("(FLIGHT_PROBE.camMode('chase'), 1)");
      const row = { view: V.name, page: tag, dials: hasNight ? VAR : null, plan, still: st, light: page, file: path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/') };
      rows.push(row);
      console.log((V.name + vt).padEnd(30) + ' ' + tag.padEnd(22) + ' meanY ' + st.meanY.toFixed(4) + ' code ' + st.meanCode.toFixed(0) + ' sky ' + st.skyCode.toFixed(0) + ' gnd ' + st.groundCode.toFixed(0)
        + ' | ex sched ' + page.exSched + ' base ' + page.exBase + ' ease ' + JSON.stringify(page.ease) + ' rig ' + JSON.stringify(page.rig)
        + ' | ' + page.key + ' I ' + page.keyI + ' keyY ' + page.keyY + ' hemi ' + page.hemiI + ' ex ' + page.exposure + (page.rt ? ' | rt meanY ' + page.rt.meanY + ' minG ' + page.rt.minG + ' distinct ' + page.rt.distinctG + ' sub ' + page.rt.subnormalShare : '') + ' | ' + plan.local);
    }
    try { await cmd('Browser.close'); } catch (e) {}
  } finally { await sleep(500); kill(); }
  return rows;
}

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(SPORT), REPO, '--fallback', FALLBACK], { stdio: 'ignore' });
  await sleep(800);
  const all = [];
  try {
    for (const p of PAGES) { console.log('moonlight_shots: ' + p + (Q ? ' ?' + Q : '')); all.push(...await runPage(p)); }
  } finally { try { execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} }
  // the day's proof: each daytime view, page against page (the first two pages)
  const t = (n, p) => path.join(OUT, n + '_' + path.basename(p, '.html') + (Q ? '_' + Q.replace(/\W+/g, '') : '') + '.png');
  if (PAGES.length >= 2) for (const V of VIEWS.filter(v => /^(noon|dusk|sunset)/.test(v.name))) {
    if (fs.existsSync(t(V.name, PAGES[0])) && fs.existsSync(t(V.name, PAGES[1]))) { const d = diff(t(V.name, PAGES[0]), t(V.name, PAGES[1])); console.log('DAY PROOF ' + V.name + ' (page vs page): ' + JSON.stringify(d)); all.push({ view: V.name, dayProof: d }); }
  }
  for (const p of PAGES) for (const n of ['noon_over', 'noonx_over']) if (fs.existsSync(t(n, p)) && fs.existsSync(t(n + '_b', p))) {   // the noise floor: one page, one place, twice, nothing moved
    const d = diff(t(n, p), t(n + '_b', p)); console.log('CONTROL ' + n + ' twice in ' + p + ': ' + JSON.stringify(d)); all.push({ view: n, control: p, d });
  }
  const jf = path.join(OUT, 'moonlight_' + (Q ? Q.replace(/\W+/g, '') : 'default') + '.json');
  fs.writeFileSync(jf, JSON.stringify(all, null, 1));
  console.log('-> ' + path.relative(process.cwd(), jf));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
