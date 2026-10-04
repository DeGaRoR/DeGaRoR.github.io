#!/usr/bin/env node
// THE AMBIENCE'S FLIGHT LOG (G1653, SND-AMB-1; SOUND-2026-10-04 §6 / §8 evidence).
//
// A straight path across JOLENE - the island the game ships (media/world/jolene through tools/island_node.js, the
// premises fixture tools/fixtures/island_jolene.json composed on it: the real world module, not the analytic world) -
// from the stand at Jolene AFB, over the heath and the forest, through the village to the shore, onto the harbour's
// water, then a climb to 300 m over the bay. The game's day (2026-06-21, 16:00 local, the 8 kt breeze from 250 deg:
// DAY_CLOCK's GAME_DAY), and the same path at night (23:45) for the weights.
//
// THE REAL SOURCE PLAYS IT: src/viewer/audio/ambience.js and samples.js run in a vm under a RECORDING AudioContext
// (every setTargetAtTime, every buffer source, its start offset and its stop), the beds fetched off the disk (the
// catalogue's files, with a 120 ms fetch latency simulated on the frame clock) and decoded by ffmpeg at 48 kHz - the
// loader's own bakeLoop shapes them (the 'amb' class: the full tier, 20 s loops). The mix is then rendered from what the
// source SCHEDULED (the gains' exponential approach, tau and all): what you hear is what the page would play.
//
//   node tools/audio/ambience_render.js           -> reports/evidence/SND-AMB-1/: flight_day.opus, flight_day.png,
//                                                    flight_night.png, places.png, summary.json (README is hand-written)
//   node tools/audio/ambience_render.js --wav     -> a WAV beside the Opus
//   module: { loadJolene, runPath, PLACES, placeWeights, harness } - GATE AUDIO's AMBJOLENE reads placeWeights
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const at = p => path.join(ROOT, p);
const OUT = at('reports/evidence/SND-AMB-1');
const SR = 48000, FPS = 60;

let WORLD = null;
function loadJolene() {
  if (WORLD) return WORLD;
  const { islandWorld } = require(at('tools/island_node.js'));
  WORLD = islandWorld('jolene', { premises: fs.readFileSync(at('tools/fixtures/island_jolene.json'), 'utf8') });
  if (!WORLD) throw new Error('ambience_render: no Jolene in src/core/world_packs.json');
  return WORLD;
}
const GAME_WIND = { kts: 8, dirDeg: 250, gust: 0.15, refH: 10, breeze: 1 };   // day_clock.js GAME_WIND
function setClock(W, localHours) { W.setDay({ date: '2026-06-21', localHours, wind: GAME_WIND }); }

// ---- THE PATH: the stand -> (0.287, -0.958) across the island -> 300 m over the bay ------------------------------------
const A = [-154, 712], B = [1072, -3375];
const LEN = Math.hypot(B[0] - A[0], B[1] - A[1]);
// [t (s), distance along (m), height above the ground or water (m)], linear between; the labels for the chart
const KEYS = [[0, 0, 1.7], [12, 0, 1.7], [16, 60, 6], [66, 3000, 6], [96, 3450, 4], [108, 3470, 1.7], [118, 3480, 1.7],
              [128, 3600, 4], [146, 3780, 3], [154, 3860, 3], [184, 4250, 300], [200, 4270, 300]];
const SEGS = [[0, 12, 'the stand'], [16, 62, 'heath'], [66, 96, 'forest'], [96, 128, 'village street'], [128, 146, 'shore'],
              [146, 156, 'harbour'], [156, 184, 'climb'], [184, 200, '300 m']];
const DUR = KEYS[KEYS.length - 1][0];
function pose(t, W) {
  let k = 0; while (k < KEYS.length - 2 && KEYS[k + 1][0] <= t) k++;
  const a = KEYS[k], b = KEYS[k + 1], u = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
  const d = a[1] + (b[1] - a[1]) * u, h = a[2] + (b[2] - a[2]) * u;
  const x = A[0] + (B[0] - A[0]) * d / LEN, z = A[1] + (B[1] - A[1]) * d / LEN;
  const g = Math.max(W.terrainH(x, z), W.waterH(x, z));
  return { x, z, y: g + h, d, h };
}

// ---- THE HARNESS: the page's source on a recording context -------------------------------------------------------------
function decodeMp3(bytes) {
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1'],
    { input: Buffer.from(bytes), maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
}
function audioBuffer(ch, n, sr, data) {
  const d = data || new Float32Array(n);
  return { numberOfChannels: ch, length: n, sampleRate: sr, duration: n / sr, getChannelData: () => d };
}
// opts: { world, tier ('gamer' | 'potato' ...), latencyS, decode(bytes) -> Float32Array, fetch(url) -> Uint8Array,
//         manifest, sources (receives every buffer source) }
function harness(opts) {
  const o = opts || {};
  const clock = { t: 0 }, pending = [], rec = { sources: [], params: [], fetches: 0, decodes: 0 };
  const param = v => { const p = { value: v, v0: v, ev: [], setTargetAtTime(x, t, tau) { this.value = x; this.ev.push([+t, x, tau]); rec.sched = (rec.sched || 0) + 1; },
                                   setValueAtTime(x, t) { this.value = x; this.ev.push([+t, x, 0]); } }; rec.params.push(p); return p; };
  const node = () => ({ connect(n) { this.to = n; }, disconnect() {} });
  const ctx = {
    get currentTime() { return clock.t; }, sampleRate: SR, destination: {},
    createGain() { return Object.assign(node(), { gain: param(1) }); },
    createBiquadFilter() { return Object.assign(node(), { type: 'lowpass', frequency: param(20000), Q: param(1) }); },
    createBuffer: (ch, n, sr) => audioBuffer(ch, n, sr),
    createBufferSource() {
      const s = Object.assign(node(), { buffer: null, loop: false, playbackRate: param(1),
        start(when, off) { this.t0 = clock.t; this.off = off || 0; }, stop() { this.t1 = clock.t; } });
      rec.sources.push(s); return s;
    },
    decodeAudioData(ab, ok, err) {
      rec.decodes++;
      const p = new Promise((res, rej) => { try { res(audioBuffer(1, 0, SR, null)); } catch (e) { rej(e); } }).then(() => {
        const d = (o.decode || decodeMp3)(new Uint8Array(ab));
        return audioBuffer(1, d.length, SR, d);
      });
      p.then(ok, err || (() => {}));
      return p;
    },
  };
  const later = v => new Promise(res => pending.push([clock.t + (o.latencyS != null ? o.latencyS : 0.12), res, v]));
  const win = { console: { info() {}, warn() {}, log() {} }, Math, Promise, Float64Array, Float32Array, Int8Array, Uint8Array, Int32Array, Array, Object, Number, Error };
  win.window = win;
  win.FLYDIY_AUDIO_MEDIA = o.manifest || catalogueManifest();
  win.FLYDIY_ASSET_BASE = '';
  win.ASSET_FETCH = url => { rec.fetches++; return later(o.fetch ? o.fetch(url) : new Uint8Array(fs.readFileSync(at(url)))); };
  win.GFX = { get: () => ({ preset: o.tier || 'gamer' }) };
  let src = null;
  win.AUDIO = { enabled: true, world: o.world || null, cabin: null,
    addSource(n, s) { src = s; }, bus: () => node(), onEvent: () => () => {}, emit() {} };
  for (const f of ['samples.js', 'ambience_model.js', 'ambience.js'])
    vm.runInNewContext(fs.readFileSync(at('src/viewer/audio/' + f), 'utf8'), win, { filename: f });
  const AP = require(at('src/viewer/audio/audio_params.js')), P = AP.audioParamsBlock();
  let connected = false;
  async function frame(dt) {
    if (!connected) { src.connect(ctx, win.AUDIO); connected = true; }
    clock.t += dt;
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i][0] <= clock.t) { const [, res, v] = pending[i]; pending.splice(i, 1); res(v); }
    for (let i = 0; i < 6; i++) await null;   // the microtasks a resolved fetch -> decode -> loop chain needs
    src.update(P, dt, win.AUDIO);
  }
  return { ctx, win, P, I: P.I, rec, clock, frame, AMB: () => win.AMBIENCE, SM: () => win.AUDIO_SAMPLES, connect() { src.connect(ctx, win.AUDIO); connected = true; } };
}
function catalogueManifest() {
  const cat = JSON.parse(fs.readFileSync(at('src/viewer/audio/sfx_catalogue.json'), 'utf8'));
  const m = {}; for (const e of cat) (m[e.key] = m[e.key] || []).push(e.file);
  return m;
}

// ---- THE RUN ----------------------------------------------------------------------------------------------------------
async function runPath(localHours, withAudio) {
  const W = loadJolene();
  setClock(W, localHours);
  const decoded = {};
  const H = harness({ world: W, tier: 'gamer', decode: withAudio ? undefined : (b => (decoded.n = (decoded.n || 0) + 1, new Float32Array(SR * 32))) });
  const M = require(at('src/viewer/audio/ambience_model.js'));
  const rows = [];
  const dt = 1 / FPS;
  let lastRound = -1;
  for (let f = 0; f <= DUR * FPS; f++) {
    const t = f * dt, p = pose(t, W);
    H.P.s[H.I.listenerX] = p.x; H.P.s[H.I.listenerY] = p.y; H.P.s[H.I.listenerZ] = p.z;
    await H.frame(dt);
    const st = H.AMB().state;
    if (st.clk[3] !== lastRound) {
      lastRound = st.clk[3];
      let res = 0; for (let b = 0; b < M.NB; b++) { const r = H.AMB().resident(b); if (r === 1 || r === 2 || r === 4) res++; }
      rows.push({ t: +t.toFixed(3), d: +p.d.toFixed(1), h: +p.h.toFixed(1), x: +p.x.toFixed(1), z: +p.z.toFixed(1),
        w: Array.from(st.w, v => +v.toFixed(4)), tg: Array.from(st.t, v => +v.toFixed(4)),
        f: Object.fromEntries(M.FN.map((k, i) => [k, +st.f[i].toFixed(2)])), resident: res,
        bytes: H.SM().classBytes('amb'), playing: M.BEDS.map((b, i) => H.AMB().resident(i)) });
    }
  }
  return { rows, H, M };
}

// the mix from what the source scheduled: each buffer source from its start to its stop, its gain node's events
function mixdown(H) {
  const n = Math.ceil(DUR * SR) + 1, y = new Float32Array(n);
  for (const s of H.rec.sources) {
    if (!s.buffer || !s.to || !s.to.gain) continue;
    const d = s.buffer.getChannelData(0), L = d.length, rate = s.buffer.sampleRate / SR;
    const ev = s.to.gain.ev.slice().sort((a, b) => a[0] - b[0]);
    // the gain node feeds outIn / roomIn -> (the outside's lowpass and duck stay open on this exterior path: checked)
    const i0 = Math.round(s.t0 * SR), i1 = Math.min(n, s.t1 != null ? Math.round(s.t1 * SR) : n);
    let g = s.to.gain.v0, tgt = g, k = 0, a = 0;
    let pos = s.off * s.buffer.sampleRate;
    for (let i = i0; i < i1; i++) {
      const t = i / SR;
      while (k < ev.length && ev[k][0] <= t) { tgt = ev[k][1]; a = ev[k][2] > 0 ? 1 - Math.exp(-1 / (SR * ev[k][2])) : 1; k++; }
      g += (tgt - g) * a;
      const j = Math.floor(pos), fr = pos - j, s0 = d[j % L], s1 = d[(j + 1) % L];
      y[i] += g * (s0 + (s1 - s0) * fr);
      pos += rate; if (pos >= L) pos -= L;
    }
  }
  return y;
}

// ---- THE CHART: small multiples, one lane a bed (identity by its label, one hue), AGL and the loader below ------------
const FONT = (() => {   // 5x7, uppercase + digits + a little punctuation
  const G = {
    A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
    D: '11100100101000110001100011001011100', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
    G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
    J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
    M: '10001110111010110101100011000110001', N: '10001100011100110101100111000110001', O: '01110100011000110001100011000101110',
    P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
    S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
    V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
    Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
    0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111',
    3: '11111000100010000010000011000101110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
    6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110',
    9: '01110100011000101111000010001001100', '.': '00000000000000000000000000110001100', '-': '00000000000000011111000000000000000',
    ':': '00000011000110000000011000110000000', '/': '00000000010001000100010001000000000', ' ': '00000000000000000000000000000000000',
    '(': '00010001000100001000010000010000010', ')': '01000001000001000010000100010001000', '%': '11000110010001000100010001001100011',
    ',': '00000000000000000000001100010001000', '=': '00000000001111100000111110000000000', '+': '00000001000010011111001000010000000',
  };
  return G;
})();
function canvas(w, h, bg) {
  const px = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { px[3 * i] = bg[0]; px[3 * i + 1] = bg[1]; px[3 * i + 2] = bg[2]; }
  const set = (x, y, c, a) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return; const i = 3 * (y * w + x), k = a == null ? 1 : a;
    px[i] = px[i] + (c[0] - px[i]) * k; px[i + 1] = px[i + 1] + (c[1] - px[i + 1]) * k; px[i + 2] = px[i + 2] + (c[2] - px[i + 2]) * k; };
  const rect = (x0, y0, x1, y1, c, a) => { for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) set(x, y, c, a); };
  const text = (x, y, s, c, sc) => { const k = sc || 1; let cx = x;
    for (const ch of String(s).toUpperCase()) { const g = FONT[ch] || FONT[' '];
      for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r * 5 + q] === '1') rect(cx + q * k, y + r * k, cx + (q + 1) * k, y + (r + 1) * k, c);
      cx += 6 * k; } return cx; };
  const tw = (s, sc) => String(s).length * 6 * (sc || 1);
  const line = (x0, y0, x1, y1, c, wd) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); const r = (wd || 2) / 2;
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; rect(x - r, y - r, x + r, y + r, c); } };
  return { w, h, px, set, rect, text, tw, line };
}
const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const C = { surface: hex('#fcfcfb'), ink: hex('#0b0b0b'), ink2: hex('#52514e'), grid: hex('#e4e3df'), band: hex('#f1f0ec'),
            series: hex('#2a78d6'), series2: hex('#eb6834') };
function chart(rows, M, title) {
  const NB = M.NB, laneH = 26, top = 70, left = 190, right = 30, plotW = 1100;
  const aglH = 90, resH = 90, gap = 34;
  const H = top + NB * laneH + gap + aglH + gap + resH + 60, Wd = left + plotW + right;
  const cv = canvas(Wd, H, C.surface);
  const X = t => left + plotW * t / DUR;
  cv.text(left, 18, title, C.ink, 2);
  cv.text(left, 44, 'EACH LANE: THE SMOOTHED WEIGHT OF ONE BED, 0..1 (FILLED), AND ITS TARGET (DOTS). TIME IN SECONDS.', C.ink2, 1);
  // the segments: alternate bands + their names
  SEGS.forEach(([a, b, nm], i) => {
    if (i % 2 === 0) cv.rect(X(a), top - 6, X(b), top + NB * laneH, C.band);
    cv.text(X(a) + 2, top - 16 + (i % 2) * 0, nm, C.ink2, 1);
  });
  for (let b = 0; b < NB; b++) {
    const y0 = top + b * laneH, y1 = y0 + laneH - 4;
    cv.rect(left, y1, left + plotW, y1 + 1, C.grid);
    const lab = M.BEDS[b][0].slice(4);
    cv.text(left - 10 - cv.tw(lab), y0 + 8, lab, C.ink, 1);
    for (let i = 1; i < rows.length; i++) {
      const r0 = rows[i - 1], r1 = rows[i];
      const xa = X(r0.t), xb = X(r1.t), wv = r1.w[b];
      if (wv > 0.002) cv.rect(xa, y1 - wv * (laneH - 6), xb + 1, y1, C.series, 0.85);
      if (r1.tg[b] > 0.002) cv.rect(xb - 1, y1 - r1.tg[b] * (laneH - 6) - 1, xb + 1, y1 - r1.tg[b] * (laneH - 6) + 1, C.ink2);
    }
  }
  // AGL
  let y0 = top + NB * laneH + gap;
  cv.text(left, y0 - 14, 'HEIGHT ABOVE THE GROUND OR THE WATER (M)', C.ink, 1);
  const hMax = 320;
  for (const v of [0, 150, 300]) { const yy = y0 + aglH - aglH * v / hMax; cv.rect(left, yy, left + plotW, yy + 1, C.grid); cv.text(left - 8 - cv.tw(String(v)), yy - 3, v, C.ink2, 1); }
  for (let i = 1; i < rows.length; i++) cv.line(X(rows[i - 1].t), y0 + aglH - aglH * rows[i - 1].f.agl / hMax, X(rows[i].t), y0 + aglH - aglH * rows[i].f.agl / hMax, C.series, 2);
  cv.text(left + plotW - cv.tw('150 M: THE GROUND BEDS ARE GONE') - 4, y0 + aglH - aglH * 150 / hMax - 12, '150 M: THE GROUND BEDS ARE GONE', C.ink2, 1);
  // the loader: resident beds (N cap 6) and decoded MB (budget 24)
  y0 += aglH + gap;
  cv.text(left, y0 - 14, 'BEDS DECODED AT ONCE (RESIDENT OR LOADING)', C.ink, 1);
  for (const v of [0, 3, 6]) { const yy = y0 + resH - resH * v / 7; cv.rect(left, yy, left + plotW, yy + 1, C.grid); cv.text(left - 8 - cv.tw(String(v)), yy - 3, v, C.ink2, 1); }
  for (let i = 1; i < rows.length; i++) {
    const ya = y0 + resH - resH * rows[i - 1].resident / 7, yb = y0 + resH - resH * rows[i].resident / 7;
    cv.line(X(rows[i - 1].t), ya, X(rows[i].t), ya, C.series, 2); cv.line(X(rows[i].t), ya, X(rows[i].t), yb, C.series, 2);
  }
  const mbMax = Math.max(...rows.map(r => r.bytes)) / 1048576;
  cv.text(left + plotW - cv.tw('N CAP 6 (GAMER) - DECODED PEAK ' + mbMax.toFixed(1) + ' MB OF 24') - 4, y0 - 14, 'N CAP 6 (GAMER) - DECODED PEAK ' + mbMax.toFixed(1) + ' MB OF 24', C.ink2, 1);
  // the time axis
  const ya = H - 40;
  for (let t = 0; t <= DUR; t += 20) { cv.rect(X(t), ya - 4, X(t) + 1, ya, C.ink2); cv.text(X(t) - cv.tw(String(t)) / 2, ya + 4, t, C.ink2, 1); }
  return require(at('tools/audio/render.js')).pngBytes(cv.w, cv.h, cv.px);
}

// ---- THE CANNED PLACES on Jolene (the model directly: a steady state at each) -----------------------------------------
const PLACES = [
  // [name, x, z, height above ground / water, garage]
  ['forest interior', 1840, -4640, 1.7], ['beach', 2480, 180, 1.7], ['village street', -3400, -8700, 1.7],
  ['lake shore', 1771, -7701, 1.7], ['stand at Jolene AFB', -154, 712, 1.7], ['500 m AGL', -301, 221, 500], ['garage', -154, 712, 1.7, 1],
];
function placeWeights(W, localHours) {
  const M = require(at('src/viewer/audio/ambience_model.js')), AP = require(at('src/viewer/audio/audio_params.js'));
  if (localHours != null) setClock(W, localHours);
  return PLACES.map(([name, x, z, h, garage]) => {
    const P = AP.audioParamsBlock(), st = M.ambienceState();
    const g = Math.max(W.terrainH(x, z), W.waterH(x, z));
    P.s[P.I.listenerX] = x; P.s[P.I.listenerY] = g + h; P.s[P.I.listenerZ] = z; P.s[P.I.inGarage] = garage ? 1 : 0;
    for (let i = 0; i < FPS * 40; i++) M.ambienceStep(st, P, W, 1 / FPS);
    const w = {}; M.BEDS.forEach((b, i) => { if (st.w[i] > 0.005) w[b[0]] = +st.w[i].toFixed(3); });
    return { name, x, z, h, garage: !!garage, w, f: Object.fromEntries(M.FN.map((k, i) => [k, +st.f[i].toFixed(1)])) };
  });
}
function placesPng(places, M) {
  const NB = M.NB, cw = 120, rh = 22, left = 170, top = 100;
  const Wd = left + places.length * cw + 20, H = top + NB * rh + 30;
  const cv = canvas(Wd, H, C.surface);
  cv.text(left, 16, 'JOLENE: THE STEADY WEIGHTS AT THE CANNED PLACES (16:00)', C.ink, 2);
  places.forEach((p, j) => { const x = left + j * cw; const words = p.name.split(' ');
    words.forEach((wd, k) => cv.text(x + 4, top - 8 - (words.length - k) * 10, wd, C.ink, 1)); });
  for (let b = 0; b < NB; b++) {
    const y = top + b * rh, lab = M.BEDS[b][0].slice(4);
    cv.text(left - 10 - cv.tw(lab), y + 7, lab, C.ink, 1);
    cv.rect(left, y + rh - 2, left + places.length * cw, y + rh - 1, C.grid);
    places.forEach((p, j) => { const v = p.w[M.BEDS[b][0]] || 0; const x = left + j * cw;
      if (v > 0) { cv.rect(x + 4, y + 4, x + 4 + (cw - 50) * v, y + rh - 5, C.series, 0.85); cv.text(x + 8 + (cw - 50), y + 7, v.toFixed(2), C.ink2, 1); } });
  }
  return require(at('tools/audio/render.js')).pngBytes(cv.w, cv.h, cv.px);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  const W = loadJolene();
  console.log('jolene composed in ' + (Date.now() - t0) + ' ms');
  const day = await runPath(16, true);
  const M = day.M;
  fs.writeFileSync(path.join(OUT, 'flight_day.png'), chart(day.rows, M, 'JOLENE, 2026-06-21 16:00 - THE AMBIENCE FLIGHT LOG'));
  const y = mixdown(day.H);
  let pk = 0, ss = 0; for (const v of y) { pk = Math.max(pk, Math.abs(v)); ss += v * v; }
  const R = require(at('tools/audio/render.js'));
  const wav = path.join(OUT, 'flight_day.wav');
  fs.writeFileSync(wav, R.wavBytes(y, SR));
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-c:a', 'libopus', '-b:a', '48k', '-application', 'audio', path.join(OUT, 'flight_day.opus')]);
  if (!process.argv.includes('--wav')) fs.unlinkSync(wav);
  const night = await runPath(23.75, false);
  fs.writeFileSync(path.join(OUT, 'flight_night.png'), chart(night.rows, M, 'JOLENE, 2026-06-21 23:45 - THE SAME PATH AT NIGHT (WEIGHTS)'));
  const places = placeWeights(W, 16), placesN = placeWeights(W, 23.75);
  fs.writeFileSync(path.join(OUT, 'places.png'), placesPng(places, M));
  const lp = day.H.rec.params.filter(p => p.ev.length && p.ev.some(e => e[1] > 1000 && e[1] < 20000));
  const sum = {
    world: 'jolene (media/world/jolene + tools/fixtures/island_jolene.json premises), the real world module',
    day: { date: '2026-06-21', localHours: 16, wind: GAME_WIND }, path: { from: A, to: B, lengthM: +LEN.toFixed(0), keys: KEYS, segments: SEGS },
    beds: M.BEDS.map(b => ({ key: b[0], levelDb: b[1], lufs: b[2], room: !!b[3] })),
    mix: { peak: +pk.toFixed(3), rmsDb: +(10 * Math.log10(ss / y.length)).toFixed(1), seconds: DUR },
    loader: { fetches: day.H.rec.fetches, decodes: day.H.rec.decodes, peakResident: Math.max(...day.rows.map(r => r.resident)),
              peakDecodedMB: +(Math.max(...day.rows.map(r => r.bytes)) / 1048576).toFixed(2), muffleMoved: lp.length },
    segments: SEGS.map(([a, b, nm]) => { const rs = day.rows.filter(r => r.t >= a && r.t <= b), last = rs[rs.length - 1] || day.rows[0];
      return { name: nm, from: a, to: b, at_end: Object.fromEntries(M.BEDS.map((bd, i) => [bd[0], last.w[i]]).filter(e => e[1] > 0.02)) }; }),
    nightSegments: SEGS.map(([a, b, nm]) => { const rs = night.rows.filter(r => r.t >= a && r.t <= b), last = rs[rs.length - 1] || night.rows[0];
      return { name: nm, at_end: Object.fromEntries(M.BEDS.map((bd, i) => [bd[0], last.w[i]]).filter(e => e[1] > 0.02)) }; }),
    places, placesNight: placesN,
    rows: day.rows.map(r => ({ t: r.t, d: r.d, h: r.h, agl: r.f.agl, resident: r.resident, mb: +(r.bytes / 1048576).toFixed(2), w: r.w })),
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(sum, null, 1));
  console.log('flight_day.opus: ' + DUR + ' s, peak ' + pk.toFixed(3) + ', rms ' + sum.mix.rmsDb + ' dB; loader ' + JSON.stringify(sum.loader));
  for (const s of sum.segments) console.log('  ' + s.name.padEnd(16) + JSON.stringify(s.at_end));
  console.log('night:'); for (const s of sum.nightSegments) console.log('  ' + s.name.padEnd(16) + JSON.stringify(s.at_end));
  for (const p of places) console.log('  ' + p.name.padEnd(20) + JSON.stringify(p.w));
}

module.exports = { loadJolene, setClock, runPath, PLACES, placeWeights, harness, catalogueManifest, pose, KEYS, SEGS, DUR };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
