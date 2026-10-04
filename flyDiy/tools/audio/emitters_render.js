#!/usr/bin/env node
// THE EMITTERS' TIMELINE (G1665, SND-AMB-2; SOUND-2026-10-04 §6.3 / §8 evidence).
//
// A walk, a taxi and a low pass across JOLENE - the island the game ships (media/world/jolene + the premises fixture
// tools/fixtures/island_jolene.json, composed by the real world module: the same world SND-AMB-1's evidence flies):
// Metlakatla's streets beside a road with traffic, the harbour's shore, the Skyline tram's valley station, a forest, the
// Jumbo mine's Kennecott mill, Jolene AFB's runway (a taxi, a low pass at 60 m, a climb to 300 m), the forest at night,
// a lake at dusk. Segments are joined by cuts (the eye jumps; the space's own rule).
//
// THE PAGE'S CODE PLAYS IT: samples.js, ambience_model.js, ambience.js (its features: the emitters read them, as in the
// page), emitters_model.js and emitters.js in a vm under a RECORDING AudioContext (every buffer source, its start, its
// playbackRate, every gain / low-pass / panner automation); the shipped MP3s fetched off the disk (120 ms latency
// simulated) and decoded by ffmpeg; the procedural sounds made by the model's own synth. The MOVERS are simulated by
// their own laws, from the record: the proto traffic on every road the record gives traffic (render_premises'
// moveTraffic: 35-55 km/h, on the right a quarter of the road's width off its centre, turning at the ends) and the tram
// on the record's cable link (tram_run.js's jig-back, TRAM_RUN.make, between the two stations' items). The house piers'
// BOATS are HOUSE_GEN's build output (not in the record, not built in node): none here - GATE AUDIO EMITOBJECTS drives
// the boats on a synthetic provider. The mill: the record's site items whose HOUSE_GEN preset says `mill: 1` (the
// presets read off tools/_house_gen.js's text: the generator is a page script).
//
// The mix is rendered from what the source SCHEDULED, emitters only (the beds are SND-AMB-1's evidence): each call
// through its gain, its absorption low-pass, the panner's inverse distance and equal-power pan in the camera's frame
// (the eye looks along the path), its playbackRate (the doppler on a pass).
//
//   node tools/audio/emitters_render.js        -> reports/evidence/SND-AMB-2/: timeline.png, places.png, walk.opus,
//                                                 summary.json (README is hand-written)
//   node tools/audio/emitters_render.js --wav  -> a WAV beside the Opus
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const at = p => path.join(ROOT, p);
const OUT = at('reports/evidence/SND-AMB-2');
const SR = 48000, FPS = 60;
const AR = require('./ambience_render.js');
const PG = require(at('src/core/27_premises.js'));
const TRAM_RUN = require(at('src/viewer/tram_run.js'));

// ---- THE WORLD'S OBJECTS, from the record ------------------------------------------------------------------------------
function itemWorld(W, siteId, itemId) {
  const rec = W.premises.rec, F = W.premises.overlay.frame, s = rec.layers.sites.find(x => x.id === siteId);
  const it = s.items.find(x => x.id === itemId);
  const p = PG.siteFrame(s).toLocal(it.x, it.z), w = F.toWorld(p[0], p[1]);
  return [w[0], W.terrainH(w[0], w[1]), w[1]];
}
// the proto traffic (render_premises' syncTraffic + moveTraffic, the same law): every road the record gives traffic
function makeTraffic(W) {
  const rec = W.premises.rec, F = W.premises.overlay.frame, roads = [];
  for (const rd of rec.layers.roads) {
    if (!(rd.traffic > 0) || rd.pts.length < 2) continue;
    const pr = PG.polyRoad(rd.pts, rd.w), L = pr.length, n = Math.max(1, Math.round(rd.traffic * L / 1000));
    const rnd = PG.mulberry32(PG.fnv(String(rd.id)) ^ 0x7a4f), cars = [];
    for (let i = 0; i < n; i++) { rnd(); const dir = i % 2 ? -1 : 1, v0 = (35 + rnd() * 20) / 3.6; cars.push({ s: (i + 0.5) * L / n, dir, v: v0, v0 }); }
    roads.push({ id: rd.id, pr, L, w: rd.w, cars });
  }
  return {
    roads,
    step(dt) { for (const t of roads) for (const c of t.cars) { c.s += c.dir * c.v * dt; if (c.s > t.L) { c.s = 2 * t.L - c.s; c.dir = -1; } else if (c.s < 0) { c.s = -c.s; c.dir = 1; } } },
    rows(out, n0, near) {
      let n = n0;
      for (const t of roads) for (const c of t.cars) {
        const a = t.pr.at(c.s), tx = a.tg[0] * c.dir, tz = a.tg[1] * c.dir, off = Math.max(0.9, Math.min(1.6, t.w / 4));
        const w = F.toWorld(a.p[0] - tz * off, a.p[1] + tx * off);
        if (near && Math.hypot(w[0] - near[0], w[1] - near[2]) > 1500) continue;   // (the far ones: rows the model skips anyway)
        const q = n * 6; out[q] = 2; out[q + 1] = w[0]; out[q + 2] = W.terrainH(w[0], w[1]); out[q + 3] = w[1]; out[q + 4] = c.v; out[q + 5] = 4.5; n++;
        if (n >= out.length / 6) return n;
      }
      return n;
    },
  };
}
// the tram on the record's cable link: TRAM_RUN's jig-back between the two stations' items (two lines 4 m apart, the
// haul rope 14 m over each dock); the cabins' origins are what render_premises' soundObjects reads (c.position)
function makeTram(W) {
  const link = (W.premises.rec.layers.links || []).find(l => l.kind === 'cable');
  if (!link) return null;
  const a = itemWorld(W, link.from.site, link.from.item), b = itemWorld(W, link.to.site, link.to.item);
  const dz = 2;
  const tram = { ropes: [{ kind: 'track', line: 0, a: [a[0], a[1] + 14, a[2] - dz], b: [b[0], b[1] + 14, b[2] - dz] },
                         { kind: 'track', line: 1, a: [a[0], a[1] + 14, a[2] + dz], b: [b[0], b[1] + 14, b[2] + dz] }],
                 docks: [{ p: [a[0], a[1], a[2] - dz], yaw: 0 }, { p: [b[0], b[1], b[2] + dz], yaw: 0 }],
                 slots: { base: [[a[0], a[1], a[2] - dz], [a[0], a[1], a[2] + dz]], top: [[b[0], b[1], b[2] - dz], [b[0], b[1], b[2] + dz]] } };
  const run = TRAM_RUN.make(tram, null, { v: 6, accel: 0.6, dwell: 12 });
  return { run, a, b, link: link.id,
    rows(out, n0) { const ps = run.poses(); let n = n0;
      for (const p of ps) { const q = n * 6; out[q] = 1; out[q + 1] = p.origin[0]; out[q + 2] = p.origin[1]; out[q + 3] = p.origin[2]; out[q + 4] = run.v; out[q + 5] = run.phase === 'move' ? 1 : 0; n++; }
      return n; } };
}
// the house generator's mill presets, read off its text (the generator is a page script: THREE, its kit)
function housePresetsMill() {
  const txt = fs.readFileSync(at('tools/_house_gen.js'), 'utf8'), P = {};
  const re = /\n\s*'([^']+)': \{\s*\n?\s*mill: 1\b/g; let m;
  while ((m = re.exec(txt))) P[m[1]] = { mill: 1 };
  return { PRESETS: P };
}

// ---- THE PATH: segments joined by cuts ------------------------------------------------------------------------------------
// [name, local hours, seconds, (t, W) -> [x, z, h AGL, heading x, heading z]]
function segments(W, tram) {
  const F = W.premises.overlay.frame, rec = W.premises.rec;
  const road = rec.layers.roads.find(r => r.id === 'mk_sc40'), pr = PG.polyRoad(road.pts, road.w);
  const along = (s, off) => { const a = pr.at(s), w = F.toWorld(a.p[0] - a.tg[1] * off, a.p[1] + a.tg[0] * off), d = F.toWorld(a.p[0] + a.tg[0], a.p[1] + a.tg[1]); return [w[0], w[1], d[0] - w[0], d[1] - w[1]]; };
  const line = (x0, z0, x1, z1, T) => t => { const u = Math.min(1, t / T); return [x0 + (x1 - x0) * u, z0 + (z1 - z0) * u, x1 - x0, z1 - z0]; };
  const mill = itemWorld(W, 'mn_s_mine', 'mill');
  const st = tram.a;
  return [
    ['Metlakatla street, a road with traffic', 15, 90, t => { const q = along(180 + 1.4 * t, 9); return [q[0], q[1], 1.7, q[2], q[3]]; }],
    ['the harbour shore', 15, 50, t => { const q = line(-3560, -8960, -3480, -8930, 50)(t); return [q[0], q[1], 1.7, q[2], q[3]]; }],
    ['the tram valley station', 15, 70, t => [st[0] - 25 + 0.5 * t, st[2] - 18, 1.7, 1, 0.1]],
    ['a forest walk', 15, 90, t => { const q = line(1840, -4640, 1930, -4580, 90)(t); return [q[0], q[1], 1.7, q[2], q[3]]; }],
    ['to the Kennecott mill', 15, 45, t => { const q = line(mill[0] - 260, mill[2] + 40, mill[0] - 90, mill[2] + 20, 45)(t); return [q[0], q[1], 1.7, q[2], q[3]]; }],
    ['Jolene AFB: taxi, low pass, climb', 15, 60, t => {
      const x = -154 + 0.287 * (t < 20 ? 8 * t : 160 + 45 * (t - 20)), z = 712 - 0.958 * (t < 20 ? 8 * t : 160 + 45 * (t - 20));
      const h = t < 20 ? 1.7 : t < 30 ? 1.7 + (t - 20) * 5.8 : t < 42 ? 60 : Math.min(300, 60 + (t - 42) * 14);
      return [x, z, h, 0.287, -0.958]; }],
    ['the forest at night', 23.5, 180, t => { const q = line(1840, -4640, 1940, -4540, 180)(t); return [q[0], q[1], 1.7, q[2], q[3]]; }],
    ['a lake at dusk (the loon: no recording)', 22.6, 25, t => [1771, -7701, 1.7, 1, 0]],
  ];
}

// ---- THE HARNESS: the page's sources on a recording context ---------------------------------------------------------
function harness(W, tier, decode) {
  const clock = { t: 0 }, pending = [], rec = { sources: [], fetches: 0, decodes: 0 };
  const param = v => ({ value: v, v0: v, ev: [], setTargetAtTime(x, t, tau) { this.value = x; this.ev.push([+t, x, tau]); },
                        setValueAtTime(x, t) { this.value = x; this.ev.push([+t, x, 0]); }, cancelScheduledValues() {}, linearRampToValueAtTime(x, t) { this.value = x; this.ev.push([+t, x, 0]); } });
  const node = () => ({ connect(n) { this.to = n; }, disconnect() {} });
  const buf = (n, sr, d) => { const a = d || new Float32Array(n); return { numberOfChannels: 1, length: n, sampleRate: sr, duration: n / sr, getChannelData: () => a, copyToChannel(y) { a.set(y); } }; };
  const ctx = {
    get currentTime() { return clock.t; }, sampleRate: SR, destination: {},
    createGain() { return Object.assign(node(), { gain: param(1) }); },
    createBiquadFilter() { return Object.assign(node(), { type: 'lowpass', frequency: param(20000), Q: param(1) }); },
    createPanner() { return Object.assign(node(), { positionX: param(0), positionY: param(0), positionZ: param(0), refDistance: 1, panningModel: 'equalpower' }); },
    createBuffer: (ch, n, sr) => buf(n, sr),
    createBufferSource() { const s = Object.assign(node(), { buffer: null, loop: false, playbackRate: param(1), start(when, off) { this.t0 = when != null ? when : clock.t; this.off = off || 0; }, stop(when) { this.t1 = when != null ? when : clock.t; } }); rec.sources.push(s); return s; },
    decodeAudioData(ab, ok, err) {
      rec.decodes++;
      const p = Promise.resolve().then(() => { const d = decode(new Uint8Array(ab)); return buf(d.length, SR, d); });
      p.then(ok, err || (() => {})); return p;
    },
  };
  const win = { console: { info() {}, warn() {}, log() {} }, Math, Promise, Float64Array, Float32Array, Int8Array, Int16Array, Uint8Array, Uint32Array, Int32Array, Array, Object, Number, Error, Set, Map, JSON, String, RegExp };
  win.window = win;
  win.FLYDIY_AUDIO_MEDIA = AR.catalogueManifest(); win.FLYDIY_ASSET_BASE = '';
  const later = v => new Promise(res => pending.push([clock.t + 0.12, res, v]));
  win.ASSET_FETCH = url => { rec.fetches++; return later(new Uint8Array(fs.readFileSync(at(url)))); };
  win.GFX = { get: () => ({ preset: tier }) };
  win.setTimeout = fn => { pending.push([clock.t, fn, null, 1]); return 1; };
  const srcs = {};
  win.AUDIO = { enabled: true, world: W, cabin: null, camera: null, get: () => 0,
    addSource(n, s) { srcs[n] = s; }, bus: () => node(), onEvent: () => () => {}, emit() {} };
  for (const f of ['samples.js', 'ambience_model.js', 'ambience.js', 'emitters_model.js', 'emitters.js'])
    vm.runInNewContext(fs.readFileSync(at('src/viewer/audio/' + f), 'utf8'), win, { filename: f });
  const AP = require(at('src/viewer/audio/audio_params.js')), P = AP.audioParamsBlock();
  let connected = false;
  async function frame(dt) {
    if (!connected) { for (const k in srcs) srcs[k].connect(ctx, win.AUDIO); connected = true; }
    clock.t += dt;
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i][0] <= clock.t) { const [, res, v, isT] = pending[i]; pending.splice(i, 1); if (isT) res(); else res(v); }
    for (let i = 0; i < 6; i++) await null;
    for (const k in srcs) srcs[k].update(P, dt, win.AUDIO);
  }
  return { ctx, win, P, I: P.I, rec, clock, frame, E: () => win.EMITTERS };
}

// ---- THE RUN -----------------------------------------------------------------------------------------------------------
async function run() {
  const W = AR.loadJolene();
  const traffic = makeTraffic(W), tram = makeTram(W), gens = { HOUSE_GEN: housePresetsMill() };
  // the page's HOUSE_GEN (the mill's declaration) and the movers' provider, as the page has them
  const SEG = segments(W, tram);
  const H = harness(W, 'gamer', null);
  H.win.HOUSE_GEN = gens.HOUSE_GEN;
  const eye = new Float64Array(3);
  H.win.WORLD = { premises: { soundObjects: out => { let n = tram ? tram.rows(out, 0) : 0; return traffic.rows(out, n, eye); } } };
  const cam = { matrixWorld: { elements: new Float64Array(16) } };
  H.win.AUDIO.camera = cam;
  const decodeCache = {};
  const ff = b => { const k = b.length + ':' + b[100] + ':' + b[b.length - 50]; if (!decodeCache[k]) decodeCache[k] = AR.decodeMp3 ? AR.decodeMp3(b) : decodeMp3(b); return decodeCache[k]; };
  // (re-bind the harness's decode now that it exists)
  H.ctx.decodeAudioData = function (ab, ok, err) { H.rec.decodes++; const p = Promise.resolve().then(() => { const d = ff(new Uint8Array(ab)); return { numberOfChannels: 1, length: d.length, sampleRate: SR, duration: d.length / SR, getChannelData: () => d }; }); p.then(ok, err || (() => {})); return p; };
  const E = H.E(), st = E.state;
  st.log = [];
  const rows = [], marks = [], dt = 1 / FPS;
  let T = 0, tramT = 0;
  // the tram: started so that a cabin leaves the valley a few seconds into the station's segment
  const tramAt = SEG.slice(0, 2).reduce((s, x) => s + x[2], 0) + 8;
  for (let si = 0; si < SEG.length; si++) {
    const [name, hours, dur, path] = SEG[si];
    AR.setClock(W, hours);
    // each place its own seed (its draw does not depend on the other places' lengths): one draw, not a choice
    E.model.seed(st, 1000 + si);
    marks.push({ name, t0: T, t1: T + dur, hours });
    const N = Math.round(dur * FPS);
    for (let f = 0; f < N; f++) {
      const t = f * dt, q = path(t, W);
      const g = Math.max(W.terrainH(q[0], q[1]), W.waterH(q[0], q[1]));
      eye[0] = q[0]; eye[1] = g + q[2]; eye[2] = q[1];
      H.P.s[H.I.listenerX] = q[0]; H.P.s[H.I.listenerY] = g + q[2]; H.P.s[H.I.listenerZ] = q[1];
      // the eye looks along the path (THREE: right, up, back columns)
      const hl = Math.hypot(q[3], q[4]) || 1, fx = q[3] / hl, fz = q[4] / hl, e = cam.matrixWorld.elements;
      e[0] = -fz; e[1] = 0; e[2] = fx; e[4] = 0; e[5] = 1; e[6] = 0; e[8] = -fx; e[9] = 0; e[10] = -fz;
      traffic.step(dt);
      if (tram) { const tt = T + t; if (tt >= tramAt - 12) { tram.run.tick(dt); } tramT = tt; }
      await H.frame(dt);
      if (f % 15 === 0) {
        const lp = []; for (let k = 0; k < E.model.NL; k++) if (st.lOn[k]) lp.push([E.model.SOUNDS[st.lS[k]][0], +st.lG[k].toFixed(3)]);
        let nv = 0; for (let k = 0; k < E.model.NV; k++) nv += st.vOn[k];
        rows.push({ t: +(T + t).toFixed(3), x: +q[0].toFixed(1), z: +q[1].toFixed(1), agl: +q[2].toFixed(1), ak: +st.clk[2].toFixed(3), voices: nv, loops: lp,
          near: st.clk[5], bytes: H.win.AUDIO_SAMPLES.classBytes('emit'), proc: E.procBytes() });
      }
    }
    T += dur;
  }
  // the log's time is the model's own clock (the same as T: one frame clock)
  return { H, st, rows, marks, total: T, W, tram, traffic };
}
function decodeMp3(bytes) {
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1'], { input: Buffer.from(bytes), maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
}

// ---- THE MIX: what the emitters scheduled (gain, low-pass, panner, playbackRate), stereo ---------------------------------
// an AudioParam's value along time, from its events (setValueAtTime / setTargetAtTime), read at increasing t
function cursor(p) {
  const ev = p.ev, n = ev.length; let i = 0, v = p.v0, tv = 0, tg = 0, tau = 0;
  const val = T => (tau > 0 ? tg + (v - tg) * Math.exp(-(T - tv) / tau) : v);
  return t => {
    while (i < n && ev[i][0] <= t) { const te = ev[i][0]; v = val(te); tv = te; if (ev[i][2] > 0) { tg = ev[i][1]; tau = ev[i][2]; } else { v = ev[i][1]; tau = 0; } i++; }
    return val(t);
  };
}
function mixdown(H, total) {
  const n = Math.ceil(total * SR) + 1, L = new Float32Array(n), R = new Float32Array(n), BLK = 128;
  for (const s of H.rec.sources) {
    if (!s.buffer || !s.to || !s.to.gain || !s.to.to || !s.to.to.to || !s.to.to.to.positionX) continue;   // gain -> lp -> panner: an emitter's
    const pan = s.to.to.to, ref = pan.refDistance || 10;
    for (const p of [s.to.gain, s.to.to.frequency, s.playbackRate, pan.positionX, pan.positionY, pan.positionZ]) p.ev.sort((a, b) => a[0] - b[0]);
    const g = cursor(s.to.gain), lp = cursor(s.to.to.frequency), rp = cursor(s.playbackRate), cx = cursor(pan.positionX), cy = cursor(pan.positionY), cz = cursor(pan.positionZ);
    const d = s.buffer.getChannelData(0), Lb = d.length, rate0 = s.buffer.sampleRate / SR;
    const i0 = Math.max(0, Math.round(s.t0 * SR)), i1 = Math.min(n, s.t1 != null ? Math.round(s.t1 * SR) : n);
    let pos = (s.off || 0) * s.buffer.sampleRate, y1 = 0;
    for (let b = i0; b < i1; b += BLK) {
      const t = b / SR;
      const gv = g(t), fc = lp(t), rt = rp(t), px = cx(t), py = cy(t), pz = cz(t);
      const dist = Math.hypot(px, py, pz), dg = dist > ref ? ref / (ref + (dist - ref)) : 1;
      const az = dist > 1e-3 ? Math.max(-1, Math.min(1, px / Math.max(1e-3, Math.hypot(px, pz)))) : 0;
      const gl = Math.cos((az + 1) * Math.PI / 4) * gv * dg, gr = Math.sin((az + 1) * Math.PI / 4) * gv * dg;
      const a = 1 - Math.exp(-2 * Math.PI * Math.min(fc, 20000) / SR);
      for (let i = b; i < Math.min(i1, b + BLK); i++) {
        const j = Math.floor(pos);
        if (!s.loop && j + 1 >= Lb) { b = i1; break; }
        const fr = pos - j, x = d[j % Lb] + (d[(j + 1) % Lb] - d[j % Lb]) * fr;
        y1 += (x - y1) * a;
        L[i] += gl * y1; R[i] += gr * y1;
        pos += rate0 * rt; if (s.loop && pos >= Lb) pos -= Lb;
      }
    }
  }
  return [L, R];
}

// ---- THE CHARTS --------------------------------------------------------------------------------------------------------
const LANES = ['crow', 'eagle', 'gull', 'owl', 'loon', 'dog', 'door', 'pickup', 'creak', 'bell', 'tramhum', 'mill', 'boat'];
function timeline(res) {
  const { canvas, C } = AR;
  const { rows, marks, total, st } = res;
  const top = 80, laneH = 24, left = 150, plotW = 1250, right = 30, aglH = 70, vH = 60, gap = 34;
  const H = top + LANES.length * laneH + gap + aglH + gap + vH + 60, Wd = left + plotW + right;
  const cv = canvas(Wd, H, C.surface);
  const X = t => left + plotW * t / total;
  cv.text(left, 16, 'JOLENE - THE EMITTERS: WHO CALLED, WHEN (A WALK, A TAXI, A LOW PASS)', C.ink, 2);
  cv.text(left, 42, 'EACH LANE ONE SOUND: A TICK A CALL (ITS HEIGHT: NEARER IS TALLER), A BAR A LOOP (ITS HEIGHT: ITS GAIN). CUTS BETWEEN THE PLACES.', C.ink2, 1);
  marks.forEach((m, i) => { if (i % 2 === 0) cv.rect(X(m.t0), top - 6, X(m.t1), top + LANES.length * laneH, C.band);
    const words = m.name.split(' '); let line = '', ly = top - 26 + (i % 2) * 10; cv.text(X(m.t0) + 2, ly, m.name.slice(0, Math.floor((X(m.t1) - X(m.t0)) / 6)), C.ink2, 1); });
  LANES.forEach((nm, k) => {
    const y0 = top + k * laneH, y1 = y0 + laneH - 4;
    cv.rect(left, y1, left + plotW, y1 + 1, C.grid);
    cv.text(left - 10 - cv.tw(nm), y0 + 8, nm, C.ink, 1);
    for (const r of st.log) if (r[1] === nm) { const hgt = Math.max(3, (laneH - 6) * Math.max(0.15, 1 - r[5] / 300)); cv.rect(X(r[0]) - 1, y1 - hgt, X(r[0]) + 2, y1, C.series); }
    for (let i = 1; i < rows.length; i++) { const lp = rows[i].loops.find(q => q[0] === nm); if (lp && lp[1] > 0.005) cv.rect(X(rows[i - 1].t), y1 - (laneH - 6) * Math.min(1, lp[1]), X(rows[i].t) + 1, y1, C.series2, 0.8); }
  });
  let y0 = top + LANES.length * laneH + gap;
  cv.text(left, y0 - 14, 'HEIGHT ABOVE THE GROUND (M) - THE EMITTERS FADE FROM 60 M AND ARE SILENT FROM 150 M', C.ink, 1);
  for (const v of [0, 150, 300]) { const yy = y0 + aglH - aglH * v / 320; cv.rect(left, yy, left + plotW, yy + 1, C.grid); cv.text(left - 8 - cv.tw(String(v)), yy - 3, v, C.ink2, 1); }
  for (let i = 1; i < rows.length; i++) if (rows[i].t - rows[i - 1].t < 1) cv.line(X(rows[i - 1].t), y0 + aglH - aglH * rows[i - 1].agl / 320, X(rows[i].t), y0 + aglH - aglH * rows[i].agl / 320, C.series, 2);
  y0 += aglH + gap;
  cv.text(left, y0 - 14, 'ONE-SHOTS SOUNDING AT ONCE (THE CAP: 6 ON GAMER)', C.ink, 1);
  for (const v of [0, 3, 6]) { const yy = y0 + vH - vH * v / 6.5; cv.rect(left, yy, left + plotW, yy + 1, C.grid); cv.text(left - 8 - cv.tw(String(v)), yy - 3, v, C.ink2, 1); }
  for (let i = 1; i < rows.length; i++) { const ya = y0 + vH - vH * rows[i - 1].voices / 6.5; cv.rect(X(rows[i - 1].t), ya - 1, X(rows[i].t) + 1, ya + 1, C.series); }
  const ya = H - 40;
  for (let t = 0; t <= total; t += 30) { cv.rect(X(t), ya - 4, X(t) + 1, ya, C.ink2); cv.text(X(t) - cv.tw(String(t)) / 2, ya + 4, t, C.ink2, 1); }
  return require('./render.js').pngBytes(cv.w, cv.h, cv.px);
}
// WHERE: one panel a place, 400 m square round the listener's path, north up; the path, the calls (a dot each), the
// movers' loops (a ring at their place when they came on)
function places(res) {
  const { canvas, C, hex } = AR;
  const { rows, marks, st } = res;
  const PW = 300, cols = 4, rowsN = Math.ceil(marks.length / cols), pad = 16, top = 60;
  const Wd = cols * (PW + pad) + pad, H = top + rowsN * (PW + 40 + pad);
  const cv = canvas(Wd, H, C.surface);
  cv.text(pad, 16, 'JOLENE - WHERE THEY CALLED FROM (EACH PANEL 400 M ACROSS, NORTH UP, THE PATH IN GREY)', C.ink, 2);
  const COL = { crow: hex('#0b0b0b'), eagle: hex('#8a5a00'), gull: hex('#2a78d6'), owl: hex('#6b3fa0'), loon: hex('#0f8a7a'), dog: hex('#d23c3c'),
                door: hex('#d27b3c'), pickup: hex('#eb6834'), creak: hex('#7a7a7a'), bell: hex('#c9a400'), tramhum: hex('#2aa36b'), mill: hex('#9b2f8f'), boat: hex('#1f4fa8') };
  marks.forEach((m, k) => {
    const ox = pad + (k % cols) * (PW + pad), oy = top + Math.floor(k / cols) * (PW + 40 + pad);
    const rs = rows.filter(r => r.t >= m.t0 && r.t < m.t1);
    const cx = rs.reduce((a, r) => a + r.x, 0) / rs.length, cz = rs.reduce((a, r) => a + r.z, 0) / rs.length;
    const P = (x, z) => [ox + PW / 2 + (x - cx) * PW / 400, oy + 20 + PW / 2 + (z - cz) * PW / 400];
    cv.rect(ox, oy + 20, ox + PW, oy + 20 + PW, C.band);
    cv.text(ox, oy + 4, m.name.slice(0, 48), C.ink, 1);
    const inP = q => q[0] >= ox && q[0] <= ox + PW && q[1] >= oy + 20 && q[1] <= oy + 20 + PW;
    for (let i = 1; i < rs.length; i++) { const a = P(rs[i - 1].x, rs[i - 1].z), b = P(rs[i].x, rs[i].z); if (inP(a) && inP(b)) cv.line(a[0], a[1], b[0], b[1], C.ink2, 2); }
    const legend = new Set();
    for (const r of st.log) {
      if (r[0] < m.t0 || r[0] >= m.t1) continue;
      const nm = r[1].replace(':on', ''), p = P(r[2], r[4]), c = COL[nm] || C.ink;
      if (p[0] < ox || p[0] > ox + PW || p[1] < oy + 20 || p[1] > oy + 20 + PW) { legend.add(nm + '>'); continue; }
      if (/:on$/.test(r[1])) { for (let a = 0; a < 24; a++) cv.rect(p[0] + 6 * Math.cos(a / 24 * 2 * Math.PI) - 1, p[1] + 6 * Math.sin(a / 24 * 2 * Math.PI) - 1, p[0] + 6 * Math.cos(a / 24 * 2 * Math.PI) + 1, p[1] + 6 * Math.sin(a / 24 * 2 * Math.PI) + 1, c); }
      else cv.rect(p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3, c);
      legend.add(nm);
    }
    let lx = ox; for (const nm of legend) { const c = COL[nm.replace('>', '')] || C.ink; cv.rect(lx, oy + PW + 26, lx + 6, oy + PW + 32, c); lx = cv.text(lx + 9, oy + PW + 25, nm, C.ink2, 1) + 8; }
  });
  return require('./render.js').pngBytes(cv.w, cv.h, cv.px);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  const res = await run();
  console.log('ran ' + res.total + ' s in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s; ' + res.st.log.length + ' log rows, ' + res.H.rec.fetches + ' fetches');
  fs.writeFileSync(path.join(OUT, 'timeline.png'), timeline(res));
  fs.writeFileSync(path.join(OUT, 'places.png'), places(res));
  const [L, R] = mixdown(res.H, res.total);
  let pk = 0, ss = 0; for (let i = 0; i < L.length; i++) { pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); ss += L[i] * L[i] + R[i] * R[i]; }
  const k = pk > 0.89 ? 0.89 / pk : 1;   // the mix normalised under -1 dBFS only if it would clip (it does not: said in the summary)
  const raw = Buffer.alloc(L.length * 8); for (let i = 0; i < L.length; i++) { raw.writeFloatLE(L[i] * k, 8 * i); raw.writeFloatLE(R[i] * k, 8 * i + 4); }
  const f32 = path.join(OUT, 'walk.f32');
  fs.writeFileSync(f32, raw);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', f32, '-c:a', 'libopus', '-b:a', '40k', '-application', 'audio', path.join(OUT, 'walk.opus')]);
  if (process.argv.includes('--wav')) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', f32, path.join(OUT, 'walk.wav')]);
  fs.unlinkSync(f32);
  const M = res.H.E().model, st = res.st;
  const bySeg = res.marks.map(m => {
    const lg = st.log.filter(r => r[0] >= m.t0 && r[0] < m.t1), c = {};
    for (const r of lg) c[r[1]] = (c[r[1]] || 0) + 1;
    return { name: m.name, from: m.t0, to: m.t1, localHours: m.hours, calls: c,
             nearest: Object.fromEntries(Object.keys(c).map(nm => [nm, Math.min(...lg.filter(r => r[1] === nm).map(r => r[5]))])) };
  });
  const sum = {
    world: 'jolene (media/world/jolene + tools/fixtures/island_jolene.json premises), the real world module',
    movers: { traffic: res.traffic.roads.length + ' roads with traffic, ' + res.traffic.roads.reduce((a, r) => a + r.cars.length, 0) + ' cars (the record\'s traffic, moveTraffic\'s law)',
              tram: res.tram ? 'the record\'s cable link ' + res.tram.link + ' (TRAM_RUN.make, v 6 m/s, dwell 12 s)' : 'none', boats: 'none (the house piers\' boats are HOUSE_GEN\'s build output; not built in node)',
              mill: 'the record\'s site items whose HOUSE_GEN preset says mill: 1 -> ' + (st.anc.length / 3) + ' anchor(s)' },
    tier: 'gamer (cap ' + st.cap + ', loops ' + st.loops + ', budget ' + st.budget / 1048576 + ' MB)',
    mix: { seconds: res.total, peak: +pk.toFixed(3), normalised: k !== 1, rmsDb: +(10 * Math.log10(ss / (2 * L.length))).toFixed(1), note: 'the emitters alone (the beds: SND-AMB-1\'s evidence)' },
    loader: { fetches: res.H.rec.fetches, decodes: res.H.rec.decodes, peakDecodedMB: +(Math.max(...res.rows.map(r => r.bytes)) / 1048576).toFixed(2),
              procKB: Math.round(Math.max(...res.rows.map(r => r.proc)) / 1024), maxVoices: Math.max(...res.rows.map(r => r.voices)) },
    segments: bySeg,
    log: st.log,
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(sum, null, 1));
  console.log('walk.opus: ' + res.total + ' s, peak ' + pk.toFixed(3) + ', rms ' + sum.mix.rmsDb + ' dB; loader ' + JSON.stringify(sum.loader));
  for (const s of bySeg) console.log('  ' + s.name.padEnd(44) + JSON.stringify(s.calls) + ' nearest ' + JSON.stringify(s.nearest));
}

module.exports = { makeTraffic, makeTram, housePresetsMill, segments, harness, run };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
