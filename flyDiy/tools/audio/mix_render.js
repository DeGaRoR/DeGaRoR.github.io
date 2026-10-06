#!/usr/bin/env node
// THE PAGE'S MIX, MEASURED OFFLINE (SND-MIX, G1720-G1721; SOUND-2026-10-04 §2.2 / §4 / §8).
//
// The user's laptop test on train 36 (2026-10-06): "the engine sound is much too faint compared to all other noises".
// This renders the WHOLE mix the page plays - every bus, at the page's own settings - and measures each bus's integrated
// loudness (ITU-R BS.1770-4 / EBU R128 LUFS, K-weighted, gated) and sample peak, and the master after the soft limiter,
// for a build in a state, heard from the cockpit (interior: the canopy closed, headset off) and from the chase camera
// (exterior). Everything is the SAME FILES the page loads, run in node:
//   THE ENGINE + PROP   engine_worklet.js + prop_worklet.js under render.js's shim, chained as the page chains them (the
//                       engine's control output IS the prop's input), fed the solver's own laws (render_prop.js: the
//                       prop rpm at the lever and V, the engine rpm, the thrust); the prop's output 1 split tonal /
//                       broadband as src_prop.js splits it into space.js's propT / propB inputs
//   THE AIRFRAME        airframe_worklet.js (its three outputs, space.js's wiring) driven by airframe_model.js from a
//                       parameter block audio_params.js fills off the real solver (the build placed at the state's V,
//                       height, sink, on the stand's paved row)
//   THE SPACE           space.js's graph written out with space_config.js's laws: OUTSIDE each kind's directivity off the
//                       nose, the air's absorption low-pass, the PannerNode's inverse distance (ref = the build's view
//                       distance) and equal-power pan from where the chase camera stands (app.js: 0.62 x viewDist behind,
//                       0.15 rad up); INSIDE the group's side panner (centre) -> the build's cabin transfer
//                       (cabinTransfer: boom, shelf, low-pass, insulation) -> the interior mix (+ the airframe's
//                       structure-borne and interior-only outputs, no cabin between) -> the headset (off) -> the
//                       viewpoint fader
//   THE AMBIENCE        ambience.js + emitters.js + samples.js on JOLENE (the real world module), in a vm under
//                       emitters_render.js's recording context, the shipped MP3s decoded by ffmpeg; mixed from what
//                       they SCHEDULED (each source through its whole chain: its gain, the absorption low-pass, the
//                       panner, then outIn / outLP / outDuck or emIn / emLP / emDuck - the cockpit's muffle)
//   THE MUSIC           a Radio Jolene track decoded (stereo), at its catalogue trim (music.js trimOf), the duck open,
//                       the music bus at the setting; THE VOICE a Norman take at music.js clipK through the same bus
//   THE BUSES           audio.js's own settings and gains, READ from audio.js (loaded in a vm: its SETTINGS defaults,
//                       its MIX trims when it has them), master -> fade -> the limiter (the DynamicsCompressorNode's
//                       law: threshold -1 dB, knee 0, ratio 20, attack 2 ms, release 120 ms, the spec's makeup gain)
//   Left out (said in the README): the doppler (the camera rides with the aeroplane: 0), the propagation lag (a time
//   shift), the shed's room (no state here is in the garage), the ui bus (no click).
//
//   node tools/audio/mix_render.js                      -> reports/evidence/SND-MIX/mix.json (+ the table on stdout)
//   node tools/audio/mix_render.js --out=x.json         the table elsewhere (the BEFORE run on the old tree)
//   node tools/audio/mix_render.js --renders=after      + jodel_{cockpit,chase}_{idle,climb,cruise}_after.ogg
//   node tools/audio/mix_render.js --only=jodel         one build
// Also a library: GATE AUDIO's MIX block measures through measureState().
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');
const R = require('./render.js'), RP = require('./render_prop.js'), AFR = require('./airframe_render.js'), SPR = require('./space_render.js');
const ROOT = R.ROOT, at = p => path.join(ROOT, p);
const SC = require(at('src/viewer/audio/space_config.js'));
const OUT_DIR = at('reports/evidence/SND-MIX');
const SR = 48000, BLOCK = R.BLOCK;
const dB = x => 20 * Math.log10(Math.max(1e-12, x));

// ---- THE PAGE'S SETTINGS: audio.js itself, in a vm (no window: no listener, no context; its defaults) -------------
function pageAudio() {
  const ctx = { console: { log() {}, info() {}, warn() {} }, Math, Float64Array, Float32Array, URLSearchParams, Object, Array, Number, String, Promise, Date };
  vm.runInNewContext(fs.readFileSync(at('src/viewer/audio/audio.js'), 'utf8') + '\n;this.__A = AUDIO;', ctx, { filename: 'audio.js' });
  return ctx.__A;
}
// music.js in a vm (its trimOf, clipK, constants; the catalogue handed in; no AUDIO: no source registered)
function pageMusic() {
  const cat = JSON.parse(fs.readFileSync(at('src/viewer/audio/music_catalogue.json'), 'utf8'));
  const voice = JSON.parse(fs.readFileSync(at('src/viewer/audio/voice_catalogue.json'), 'utf8'));
  const win = { console: { log() {}, info() {}, warn() {} }, Math, Float64Array, Float32Array, Int16Array, Uint8Array, Uint32Array, Int32Array, Array, Object, Number, String, JSON, Date, Promise, RegExp, Set, Map, Error };
  win.window = win; win.FLYDIY_MUSIC = cat; win.FLYDIY_VOICE = voice; win.FLYDIY_ASSET_BASE = '';
  vm.runInNewContext(fs.readFileSync(at('src/viewer/audio/music.js'), 'utf8'), win, { filename: 'music.js' });
  return { M: win.AUDIO_MUSIC, cat, voice };
}

// ---- LOUDNESS: ITU-R BS.1770-4 (K-weighting at 48 kHz, 400 ms blocks, 75 % overlap, -70 LUFS absolute and -10 LU
// relative gates) -----------------------------------------------------------------------------------------------------
function kWeight(x) {
  const y = new Float64Array(x.length);
  const s1 = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585];
  const s2 = [1, -2, 1, -1.99004745483398, 0.99007225036621];
  for (const c of [s1, s2]) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const src = c === s1 ? x : y;
    for (let i = 0; i < x.length; i++) { const v = c[0] * src[i] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = src[i]; y2 = y1; y1 = v; y[i] = v; }
  }
  return y;
}
function lufs(chans) {
  const K = chans.map(kWeight), n = K[0].length, B = Math.round(0.4 * SR), H = Math.round(0.1 * SR);
  const z = [];
  for (let a = 0; a + B <= n; a += H) {
    let s = 0;
    for (const k of K) { let q = 0; for (let i = a; i < a + B; i++) q += k[i] * k[i]; s += q / B; }
    z.push(s);
  }
  const L = s => -0.691 + 10 * Math.log10(Math.max(1e-30, s));
  const g1 = z.filter(s => L(s) > -70);
  if (!g1.length) return -Infinity;
  const rel = L(g1.reduce((a, b) => a + b, 0) / g1.length) - 10;
  const g2 = g1.filter(s => L(s) > rel);
  return g2.length ? L(g2.reduce((a, b) => a + b, 0) / g2.length) : -Infinity;
}
const peakDb = chans => { let p = 0; for (const c of chans) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > p) p = v; } return dB(p); };

// ---- THE LIMITER: the DynamicsCompressorNode audio.js builds (threshold -1, knee 0, ratio 20, attack 2 ms, release
// 120 ms) - a peak detector on the louder channel, the spec's static curve, its makeup gain (1 / curve(1))^0.6 ----------
function limiter(L, Rr, o) {
  const T = o && o.threshold != null ? o.threshold : -1, RATIO = 20, att = 0.002, rel = 0.12;
  const curveDb = x => (x <= T ? x : T + (x - T) / RATIO);
  const makeup = Math.pow(10, (-curveDb(0) / 20) * 0.6);
  const aA = Math.exp(-1 / (att * SR)), aR = Math.exp(-1 / (rel * SR));
  let env = 0, grMax = 0, grSum = 0, grN1 = 0;
  const yL = new Float32Array(L.length), yR = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) {
    const v = Math.max(Math.abs(L[i]), Math.abs(Rr[i]));
    env = v > env ? aA * env + (1 - aA) * v : aR * env + (1 - aR) * v;
    const lv = dB(env), gr = lv - curveDb(lv);
    if (gr > grMax) grMax = gr; grSum += gr; if (gr > 1) grN1++;
    const g = Math.pow(10, -gr / 20) * makeup;
    yL[i] = L[i] * g; yR[i] = Rr[i] * g;
  }
  return { L: yL, R: yR, grMaxDb: grMax, grMeanDb: grSum / L.length, grOver1dBShare: grN1 / L.length, makeupDb: dB(makeup) };
}

// ---- THE STATES -------------------------------------------------------------------------------------------------
const C = () => require(at('tools/flight_core.js'));
const BUILDS = ['jodel', 'cub'];
const builds = {};
function buildOf(key) {
  if (builds[key]) return builds[key];
  const B = RP.loadPropBuild(RP.PROP_BUILDS.find(b => b.key === key));
  const ms = C().machineSheet(B.def);
  B.Vy = ms.Vy; B.Vc = ms.Vcruise;
  // the taxi's lever: the engine at ~1500 rpm rolling at 5 m/s (the solver's law, bisected)
  let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (B.engRpm(B.propRpm(m, true, 5)) < 1500) lo = m; else hi = m; }
  B.thrTaxi = (lo + hi) / 2;
  return (builds[key] = B);
}
// place: { h above the ground, V, vs, pitch }; amb: where the listener is on Jolene for the ambience [x, z, h AGL]
const STATES = {
  idle:   { label: 'idle on the stand', thr: () => 0, V: () => 0, h: 0, vs: 0, pitch: 0, place: 'stand' },
  taxi:   { label: 'taxi (~1500 rpm, 5 m/s)', thr: B => B.thrTaxi, V: () => 5, h: 0, vs: 0, pitch: 0, place: 'stand' },
  climb:  { label: 'climb (full power, Vy)', thr: () => 1, V: B => B.Vy, h: 120, vs: 3, pitch: 0.12, place: 'forest' },
  cruise: { label: 'cruise (75 %, Vc)', thr: () => 0.75, V: B => B.Vc, h: 300, vs: 0, pitch: 0.03, place: 'sea' },
};
// Jolene: the stand at Jolene AFB (ambience_render's path start), the forest along that path, the harbour's open water
const PLACES = { stand: { d: 0 }, forest: { d: 2000 }, sea: { d: 3900 } };

// the parameter block off the real solver: the build placed at the state (flat paved ground, row 5, or the state's AGL)
function paramBlock(B, st, interior) {
  const CC = C(), AP = require(at('src/viewer/audio/audio_params.js'));
  const world = AFR.landWorld(5);
  const sim = CC.makeSim(B.def, world); sim.reset(0);
  const V = st.V(B);
  AFR.place(sim, B.def, { h: st.h > 0 ? st.h : -0.005, V, vs: st.vs, pitch: st.pitch });
  const P = AP.audioParamsBlock(), cam = { mode: interior ? 'cockpit' : 'chase', inGarage: false, held: false, p: new Float64Array(3) };
  for (let k = 0; k < 4; k++) AP.audioParams(sim, cam, B.def, P, world, 1 / 30);
  // the block as the moving aeroplane has it (placed, not stepped: the solver's speeds are the state's)
  const I = P.I; P.s[I.V] = V; P.s[I.Vg] = V; P.s[I.vs] = st.vs; P.s[I.interior] = interior ? 1 : 0;
  return P;
}

// ---- THE AIRCRAFT BUSES: engine, prop, airframe - each through the page's space, stereo ----------------------------
let WK = null, AW = null;
function aircraftBuses(B, st, interior, seconds) {
  WK = WK || RP.loadAll(SR); AW = AW || AFR.loadAirframe(SR);
  const P = paramBlock(B, st, interior), I = P.I;
  const thr = st.thr(B), V = st.V(B);
  const ch = RP.makeChain(WK, B, 0, { seed: 1, heat: 0.5, state: { running: true, rpm: B.engRpm(B.propRpm(thr, true, V)) } });
  // the airframe: three outputs as space.js wires it (0 ext mono, 1 interior stereo, 2 interior-only mono)
  const AFM = require(at('src/viewer/audio/airframe_model.js'));
  const proc = new AW.Processor({ processorOptions: { seed: 7 } });
  const ap = {}; for (const d of AW.Processor.parameterDescriptors) ap[d.name] = new Float32Array([d.defaultValue]);
  const aout = [[new Float32Array(BLOCK)], [new Float32Array(BLOCK), new Float32Array(BLOCK)], [new Float32Array(BLOCK)]];
  const afst = AFM.airframeState(), names = AFM.AF_PARAMS, Q = AFM.AF_Q;
  const cur = new Float64Array(names.length).fill(0), kTau = 1 - Math.exp(-(BLOCK / SR) / 0.03);
  // the geometry: the chase camera behind and above (app.js: distT = 0.62 viewDist, elT 0.15 rad)
  const D = B.def.params.viewDist || 12, ref = Math.max(6, Math.min(20, D)), dist = 0.62 * D, el = 0.15;
  const cosT = -Math.cos(el);   // the nose against the direction from the aeroplane to the eye (behind)
  const gDir = [SC.directivity(SC.DIR_EXHAUST, cosT), SC.directivity(SC.DIR_TONAL, cosT), SC.directivity(SC.DIR_BROAD, cosT), SC.directivity(SC.DIR_OMNI, cosT)];
  const pg = new Float64Array(3); SPR.pannerGains(0, -dist * Math.sin(el), -dist * Math.cos(el), ref, pg);   // ahead of the eye, a little below
  const absHz = SC.airAbsorptionHz(dist);
  const cab = SC.cabinTransfer(B.spec), side = Math.SQRT1_2;   // the StereoPanner at the centre on a mono input
  const kTon = SC.CABIN_TONAL_DB ? Math.pow(10, SC.CABIN_TONAL_DB / 20) : 1;   // (G1721: absent on the old tree)
  const nb = Math.ceil(seconds * SR / BLOCK), n = nb * BLOCK;
  const out = {}; for (const k of ['engine', 'prop', 'airframe']) out[k] = [new Float32Array(n), new Float32Array(n)];
  // per bus its own filter instances (the chains are linear: a bus through its own copy is its share of the sum)
  const mk = () => ({ lp: SPR.biquad('lowpass', absHz, -3.01, 0), cab: SPR.chainOf(cab) });
  const F = { engine: mk(), prop: mk(), airframe: mk() };
  const xb = new Float32Array(BLOCK), yb = new Float32Array(BLOCK);
  const p = { thr, V, alpha: P.s[I.alpha], beta: 0, running: 1, starter: 0, interior: interior ? 1 : 0 };
  for (let b = 0; b < nb; b++) {
    RP.stepChain(ch, p);
    const tg = AFM.airframeStep(P, afst, BLOCK / SR); afst.evN[0] = 0;
    for (let i = 0; i < names.length; i++) { cur[i] = Q[names[i]] === 0 ? tg[i] : cur[i] + (tg[i] - cur[i]) * kTau; ap[names[i]][0] = cur[i]; }
    proc.process([], aout, ap);
    const o = b * BLOCK;
    const e = ch.drv.outputs[0][0], pt = ch.pout[1][0], pb = ch.pout[1][1];
    const parts = {
      engine: [[e, 0]], prop: [[pt, 1], [pb, 2]], airframe: [[aout[0][0], 3]],
    };
    for (const bus of ['engine', 'prop', 'airframe']) {
      const f = F[bus], [Lb, Rb] = out[bus], kBus = 1;   // (the volumes and the trims: measureState's bus gains)
      if (!interior) {   // OUTSIDE: directivity by kind -> the group sum -> absorption -> panner -> aircraft.ext
        xb.fill(0); for (const [y, k] of parts[bus]) for (let i = 0; i < BLOCK; i++) xb[i] += gDir[k] * y[i] * kBus;
        f.lp.run(xb, yb, BLOCK);
        for (let i = 0; i < BLOCK; i++) { Lb[o + i] = yb[i] * pg[0]; Rb[o + i] = yb[i] * pg[1]; }
      } else {           // INSIDE: the side panner -> the cabin -> the interior mix (+ the airframe's own interior outputs)
        xb.fill(0); for (const [y, k] of parts[bus]) { const kk = kBus * (k === 1 ? kTon : 1); for (let i = 0; i < BLOCK; i++) xb[i] += y[i] * kk; }
        SPR.runChain(f.cab, xb, yb, BLOCK);
        for (let i = 0; i < BLOCK; i++) { Lb[o + i] = yb[i] * side; Rb[o + i] = yb[i] * side; }
        if (bus === 'airframe') {
          const s0 = aout[1][0], s1 = aout[1][1], io = aout[2][0];
          for (let i = 0; i < BLOCK; i++) { Lb[o + i] += (s0[i] + io[i]) * kBus; Rb[o + i] += (s1[i] + io[i]) * kBus; }
        }
      }
    }
  }
  return { out, P, cab: { cls: cab.cls, insulationDb: cab.insulationDb, ambienceDb: cab.ambienceDb }, geo: { dist, ref, cosT, absHz } };
}

// the page's mix trims (audio.js MIX, dB; absent on a tree without them = 0 dB) and settings
let PA = null;
function mixTrims() {
  PA = PA || pageAudio();
  const M = PA.MIX || {}, k = x => Math.pow(10, (+x || 0) / 20);
  return { engine: k(M.engine), interior: k(M.interior), airframe: k(M.airframe), ambience: k(M.ambience), ambienceRun: k(M.ambienceRun), music: k(M.music),
           raw: Object.assign({ cabinTonalDb: SC.CABIN_TONAL_DB || 0 }, M) };
}
function settings() {
  PA = PA || pageAudio();
  const g = k => { const v = PA.get(k); return v == null ? null : +v; };
  return { master: g('master'), aircraft: g('aircraft'), engine: g('engine'), environment: g('environment'), music: g('music'), musicFlight: g('musicFlight') };
}

// ---- THE AMBIENCE AND THE EMITTERS on Jolene (one harness a place, run until the beds are in, the last seconds mixed) --
let ERM = null, WJ = null;
const decodeCache = {};
function decodeMono(b) {
  const k = b.length + ':' + b[100] + ':' + b[b.length - 50];
  if (!decodeCache[k]) {
    const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1'], { input: Buffer.from(b), maxBuffer: 1 << 28 });
    decodeCache[k] = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
  }
  return decodeCache[k];
}
const ambCache = {};
async function ambienceBuses(place, h, interior, open, seconds) {
  const key = place + ':' + h + ':' + interior + ':' + open + ':' + seconds;
  if (ambCache[key]) return ambCache[key];
  ERM = ERM || require('./emitters_render.js');
  const AR = require('./ambience_render.js');
  WJ = WJ || AR.loadJolene();
  AR.setClock(WJ, 16);   // the game's day: 16:00 local
  const Hh = ERM.harness(WJ, 'gamer', null);
  Hh.ctx.decodeAudioData = function (ab, ok, err) { const p = Promise.resolve().then(() => { const d = decodeMono(new Uint8Array(ab)); return { numberOfChannels: 1, length: d.length, sampleRate: SR, duration: d.length / SR, getChannelData: () => d }; }); p.then(ok, err || (() => {})); return p; };
  Hh.win.WORLD = { premises: { soundObjects: () => 0 } };
  const cam = { matrixWorld: { elements: new Float64Array(16) } }; Hh.win.AUDIO.camera = cam;
  const pos = AR.pose(0, WJ);   // the path's geometry: AR.pose maps t; we place by distance along it
  const Ap = [-154, 712], Bp = [1072, -3375], LEN = Math.hypot(Bp[0] - Ap[0], Bp[1] - Ap[1]);
  const d = PLACES[place].d, x = Ap[0] + (Bp[0] - Ap[0]) * d / LEN, z = Ap[1] + (Bp[1] - Ap[1]) * d / LEN;
  const g = Math.max(WJ.terrainH(x, z), WJ.waterH(x, z));
  const fx = (Bp[0] - Ap[0]) / LEN, fz = (Bp[1] - Ap[1]) / LEN, e = cam.matrixWorld.elements;
  e[0] = -fz; e[1] = 0; e[2] = fx; e[4] = 0; e[5] = 1; e[6] = 0; e[8] = -fx; e[9] = 0; e[10] = -fz;
  const S = Hh.P.s, I = Hh.I;
  S[I.listenerX] = x; S[I.listenerY] = g + Math.max(1.7, h); S[I.listenerZ] = z; S[I.agl] = Math.max(1.7, h);
  S[I.interior] = interior ? 1 : 0; S[I.open] = open ? 1 : 0;
  // the beds settle (fetch, decode, the weights' seconds-long smoothing), then the beds are mixed over `seconds` and the
  // emitters - sparse calls - over EMIT_S (their gated loudness is the calls' level when they sound)
  const warm = 20, dt = 1 / 60, EMIT_S = 40;
  for (let f = 0; f < (warm + Math.max(seconds, EMIT_S)) * 60; f++) await Hh.frame(dt);
  void pos;
  const t0 = warm, t1 = warm + seconds;
  const r = { ambience: mixChains(Hh, t0, t1, s => !isEmitter(s)), emitters: mixChains(Hh, t0, warm + EMIT_S, isEmitter), where: { place, x: +x.toFixed(0), z: +z.toFixed(0), agl: Math.max(1.7, h) },
    emitterCalls: Hh.rec.sources.filter(s => isEmitter(s) && s.t0 >= t0 - 2 && s.t0 < warm + EMIT_S).length, emitS: EMIT_S };
  ambCache[key] = r;
  return r;
}
// a source's chain: its .to links to the bus stub (which has no .to)
const chainOf = s => { const c = []; let nd = s.to; while (nd) { c.push(nd); nd = nd.to; } return c; };
const isEmitter = s => chainOf(s).some(nd => nd.positionX);
const cursorOf = p => { p.ev.sort((a, b) => a[0] - b[0]); return ERM.cursor ? ERM.cursor(p) : null; };
function cursor(p) {
  const ev = p.ev.slice().sort((a, b) => a[0] - b[0]), n = ev.length; let i = 0, v = p.v0, tv = 0, tg = 0, tau = 0;
  const val = T => (tau > 0 ? tg + (v - tg) * Math.exp(-(T - tv) / tau) : v);
  return t => { while (i < n && ev[i][0] <= t) { const te = ev[i][0]; v = val(te); tv = te; if (ev[i][2] > 0) { tg = ev[i][1]; tau = ev[i][2]; } else { v = ev[i][1]; tau = 0; } i++; } return val(t); };
}
void cursorOf;
// mix the sources `pick` keeps over [t0, t1): each through its whole chain (gains, low-passes as one-poles, the panner's
// inverse distance and equal-power pan); a mono source on no panner reaches the stereo bus on both sides at 1 (up-mix)
function mixChains(Hh, t0, t1, pick) {
  const n = Math.round((t1 - t0) * SR), L = new Float32Array(n), Rr = new Float32Array(n), BLK = 128;
  for (const s of Hh.rec.sources) {
    if (!s.buffer || !pick(s)) continue;
    const c = chainOf(s); if (!c.length) continue;
    const gains = c.filter(nd => nd.gain).map(nd => cursor(nd.gain)), lps = c.filter(nd => nd.frequency).map(nd => cursor(nd.frequency));
    const pan = c.find(nd => nd.positionX), cx = pan && cursor(pan.positionX), cy = pan && cursor(pan.positionY), cz = pan && cursor(pan.positionZ), ref = pan ? pan.refDistance || 10 : 1;
    const rp = cursor(s.playbackRate), d = s.buffer.getChannelData(0), Lb = d.length, rate0 = s.buffer.sampleRate / SR;
    const sStart = s.t0 != null ? s.t0 : 0, sStop = s.t1 != null ? s.t1 : Infinity;
    if (sStop <= t0 || sStart >= t1) continue;
    let pos = (s.off || 0) * s.buffer.sampleRate;
    const st = lps.map(() => 0);
    // advance to t0 (a looped bed: its phase; a one-shot: how far it got)
    const skip = Math.max(0, t0 - sStart);
    if (skip > 0) { pos += skip * SR * rate0; if (s.loop) pos %= Lb; else if (pos >= Lb) continue; }
    const i0 = Math.max(0, Math.round((sStart - t0) * SR)), i1 = Math.min(n, Math.round((sStop - t0) * SR));
    for (let b = i0; b < i1; b += BLK) {
      const t = t0 + b / SR;
      let gv = 1; for (const g of gains) gv *= g(t);
      const as = lps.map(f => 1 - Math.exp(-2 * Math.PI * Math.min(f(t), 20000) / SR));
      let gl = gv, gr = gv;
      if (pan) {
        const px = cx(t), py = cy(t), pz = cz(t), dist = Math.hypot(px, py, pz), dg = dist > ref ? ref / (ref + (dist - ref)) : 1;
        const az = dist > 1e-3 ? Math.max(-1, Math.min(1, px / Math.max(1e-3, Math.hypot(px, pz)))) : 0;
        gl = Math.cos((az + 1) * Math.PI / 4) * gv * dg; gr = Math.sin((az + 1) * Math.PI / 4) * gv * dg;
      }
      const rt = rp(t);
      for (let i = b; i < Math.min(i1, b + BLK); i++) {
        const j = Math.floor(pos);
        if (!s.loop && j + 1 >= Lb) { b = i1; break; }
        const fr = pos - j; let x = d[j % Lb] + (d[(j + 1) % Lb] - d[j % Lb]) * fr;
        for (let k = 0; k < as.length; k++) { st[k] += (x - st[k]) * as[k]; x = st[k]; }
        L[i] += gl * x; Rr[i] += gr * x;
        pos += rate0 * rt; if (s.loop && pos >= Lb) pos -= Lb;
      }
    }
  }
  return [L, Rr];
}

// ---- THE MUSIC AND THE VOICE --------------------------------------------------------------------------------------
let MU = null;
function decodeStereo(file, from, seconds) {
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', String(from), '-t', String(seconds), '-i', at(file), '-f', 'f32le', '-ac', '2', '-ar', String(SR), 'pipe:1'], { maxBuffer: 1 << 28 });
  const a = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length)), n = a.length / 2;
  const L = new Float32Array(n), Rr = new Float32Array(n); for (let i = 0; i < n; i++) { L[i] = a[2 * i]; Rr[i] = a[2 * i + 1]; }
  return [L, Rr];
}
function musicBuses(seconds) {
  MU = MU || pageMusic();
  const { M, cat, voice } = MU;
  // a Radio Jolene track (the start station), 40 % of its way in; trim to the catalogue's -16 LUFS
  const t = cat.find(x => (x.station || 'lofi') === 'roots' && typeof x.lufs === 'number') || cat[0];
  const [L, Rr] = decodeStereo(t.file, Math.max(0, (t.durationS || 120) * 0.4), seconds);
  const k = M.trimOf(t); for (let i = 0; i < L.length; i++) { L[i] *= k; Rr[i] *= k; }
  // the voice: one of Norman's takes at clipK (radioIn), mono up-mixed to both sides
  const vf = fs.readdirSync(at('media/audio/voice')).filter(f => /^(id|talk|show|song|weather)/.test(f)).sort()[0] || fs.readdirSync(at('media/audio/voice'))[0];
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', at('media/audio/voice/' + vf), '-t', String(seconds), '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1'], { maxBuffer: 1 << 28 });
  const vm1 = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
  const ck = M.clipK(), vn = Math.round(seconds * SR);
  const VL = new Float32Array(vn), VR = new Float32Array(vn); for (let i = 0; i < Math.min(vn, vm1.length); i++) { VL[i] = VR[i] = vm1[i] * ck; }
  void voice;
  return { music: [L.subarray(0, vn), Rr.subarray(0, vn)], voice: [VL, VR], track: { id: t.id, title: t.title, lufs: t.lufs, trim: +k.toFixed(3) }, voiceFile: vf, clipK: +ck.toFixed(3) };
}

// ---- ONE STATE, ONE PERSPECTIVE ------------------------------------------------------------------------------------
// o: { music (music in flight on), seconds }
async function measureState(key, stateKey, interior, o) {
  const opt = o || {}, seconds = opt.seconds || 8, warm = 1.5;
  const B = buildOf(key), st = STATES[stateKey];
  const A = aircraftBuses(B, st, interior, seconds + warm);
  const cut = c => c.map(y => y.subarray(Math.round(warm * SR), Math.round((warm + seconds) * SR)));
  const buses = { engine: cut(A.out.engine), prop: cut(A.out.prop), airframe: cut(A.out.airframe) };
  const open = A.P.s[A.P.I.open] > 0;
  const amb = await ambienceBuses(st.place, st.h, interior, open, seconds);
  buses.ambience = amb.ambience; buses.emitters = amb.emitters;
  const S = settings(), T = mixTrims();
  const flying = 1;   // every state here is out of the shed and past the loading screen
  const mus = musicBuses(seconds);
  const musicOn = !!opt.music;
  // the bus gains audio.js schedules (applyGains): the viewpoint fader 1 on the side heard, the headset off
  const kAir = S.aircraft != null && S.engine == null ? S.aircraft : 1;   // (the old tree: 'aircraft' scaled every aircraft source)
  const kEng = S.engine != null ? S.engine : 1, kFrame = S.engine != null ? S.aircraft : 1;
  const cabK = interior ? SC.cabinTransfer(B.spec).ambienceK : 1;
  const kAmb = S.environment * cabK * T.ambience * T.ambienceRun;   // (every state here has its engine running)
  const kMus = S.music * (flying && !musicOn ? 0 : 1) * T.music;
  const kIn = interior ? T.interior : 1;   // the viewpoint fader's interior side (MIX.interior)
  const G = { engine: kAir * kEng * T.engine * kIn, prop: kAir * kEng * T.engine * kIn, airframe: kAir * kFrame * T.airframe * kIn, ambience: kAmb, emitters: kAmb, music: kMus, voice: kMus };
  buses.music = mus.music; buses.voice = mus.voice;
  const n = buses.engine[0].length;
  const masterIn = [new Float32Array(n), new Float32Array(n)];
  const row = { build: key, state: stateKey, persp: interior ? 'cockpit' : 'chase', place: amb.where, buses: {} };
  for (const k of Object.keys(G)) {
    if (k === 'voice') continue;   // the voice is a separate measurement (it speaks between songs, over a bed)
    const g = G[k] * S.master, y = buses[k].map(c => { const z = new Float32Array(n); for (let i = 0; i < Math.min(n, c.length); i++) z[i] = c[i] * g; return z; });
    if (k === 'emitters') { const yl = buses[k].map(c => c.map(v => v * g)); row.buses[k] = { lufs: +lufs(yl).toFixed(1), peak: +peakDb(yl).toFixed(1), calls: amb.emitterCalls, seconds: amb.emitS }; }
    else row.buses[k] = { lufs: +lufs(y).toFixed(1), peak: +peakDb(y).toFixed(1) };
    for (let i = 0; i < n; i++) { masterIn[0][i] += y[0][i]; masterIn[1][i] += y[1][i]; }
  }
  { const g = G.voice * S.master, y = buses.voice.map(c => { const z = new Float32Array(n); for (let i = 0; i < Math.min(n, c.length); i++) z[i] = c[i] * g; return z; }); row.buses.voice = { lufs: +lufs(y).toFixed(1), peak: +peakDb(y).toFixed(1) }; }
  // engine + prop together: the aeroplane's power plant
  { const y = [0, 1].map(c => { const z = new Float32Array(n); const g = G.engine * S.master; for (let i = 0; i < n; i++) z[i] = (buses.engine[c][i] + buses.prop[c][i]) * g; return z; });
    row.buses.enginePlusProp = { lufs: +lufs(y).toFixed(1), peak: +peakDb(y).toFixed(1) }; }
  const lim = limiter(masterIn[0], masterIn[1]);
  row.buses.master = { lufs: +lufs([lim.L, lim.R]).toFixed(1), peak: +peakDb([lim.L, lim.R]).toFixed(1) };
  row.limiter = { grMaxDb: +lim.grMaxDb.toFixed(2), grMeanDb: +lim.grMeanDb.toFixed(3), grOver1dBShare: +lim.grOver1dBShare.toFixed(4), makeupDb: +lim.makeupDb.toFixed(2) };
  row.music = musicOn ? mus.track : null; row.settings = S; row.trims = T.raw; row.cabin = A.cab; row.emitterCalls = amb.emitterCalls;
  row.rpm = Math.round(B.engRpm(B.propRpm(st.thr(B), true, st.V(B)))); row.V = +st.V(B).toFixed(1);
  row._master = lim;
  return row;
}

// THE PHASE LOTTERY (G1721): engine + prop through the build's cabin, the crank's starting angle drawn by `seeds` seeds (the
// page draws it per session), the prop's tonal at `tonalDb` in the cabin: the e+p loudness and its distance from the power sum
function lottery(key, stateKey, tonalDb, seeds) {
  WK = WK || RP.loadAll(SR);
  const B = buildOf(key), st = STATES[stateKey], thr = st.thr(B), V = st.V(B), kT = Math.pow(10, (tonalDb || 0) / 20);
  const cab = SC.cabinTransfer(B.spec), rows = [];
  for (let seed = 1; seed <= (seeds || 12); seed++) {
    const ch = RP.makeChain(WK, B, 0, { seed, heat: 0.5, state: { running: true, rpm: B.engRpm(B.propRpm(thr, true, V)) } });
    const cs = SPR.chainOf(cab), ce = SPR.chainOf(cab), cp = SPR.chainOf(cab);
    const nb = Math.ceil(6 * SR / BLOCK), skip = Math.ceil(1 * SR / BLOCK), n = (nb - skip) * BLOCK;
    const yS = new Float32Array(n), yE = new Float32Array(n), yP = new Float32Array(n), xs = new Float32Array(BLOCK), xe = new Float32Array(BLOCK), xp = new Float32Array(BLOCK), tb = new Float32Array(BLOCK);
    const p = { thr, V, alpha: 0.05, beta: 0, running: 1, starter: 0, interior: 1 };
    for (let b = 0; b < nb; b++) {
      RP.stepChain(ch, p);
      const e = ch.drv.outputs[0][0], t = ch.pout[1][0], q = ch.pout[1][1];
      for (let i = 0; i < BLOCK; i++) { xe[i] = e[i]; xp[i] = kT * t[i] + q[i]; xs[i] = xe[i] + xp[i]; }
      if (b < skip) { SPR.runChain(cs, xs, tb, BLOCK); SPR.runChain(ce, xe, tb, BLOCK); SPR.runChain(cp, xp, tb, BLOCK); continue; }
      const o = (b - skip) * BLOCK;
      SPR.runChain(cs, xs, tb, BLOCK); yS.set(tb, o); SPR.runChain(ce, xe, tb, BLOCK); yE.set(tb, o); SPR.runChain(cp, xp, tb, BLOCK); yP.set(tb, o);
    }
    const lS = lufs([yS]), lE = lufs([yE]), lP = lufs([yP]), pw = 10 * Math.log10(Math.pow(10, lE / 10) + Math.pow(10, lP / 10));
    rows.push({ seed, ep: +lS.toFixed(1), vsPowerSum: +(lS - pw).toFixed(1) });
  }
  const v = rows.map(r => r.vsPowerSum), e = rows.map(r => r.ep);
  return { build: key, state: stateKey, tonalDb: tonalDb || 0, rows, worst: Math.min(...v), best: Math.max(...v), spreadDb: +(Math.max(...e) - Math.min(...e)).toFixed(1) };
}

// THE LAPTOP'S FRAME RATE (G1724): a throttle ramp idle -> full -> idle over 6 s whose parameters arrive every `dt` s (the
// page's frame), each scheduled as setTargetAtTime(tau) - the old 30 ms, or the frame's tau (audio.js: 0.6 x dt). The
// stepping is the lever's as the voice receives it (its peak slope over the commanded ramp's; the 10 ms envelope's jumps
// are kept in the json, but the firing's own ripple at idle swamps them); the three renders are the ears' evidence
function lowFps(key, dt, tau) {
  WK = WK || RP.loadAll(SR);
  const B = buildOf(key), ch = RP.makeChain(WK, B, 0, { seed: 1, heat: 0.5, state: { running: true, rpm: B.engRpm(B.propRpm(0, true, 0)) } });
  const T = 6, nb = Math.ceil(T * SR / BLOCK), y = new Float32Array(nb * BLOCK);
  const thrAt = t => (t < 0.5 ? 0 : t < 3 ? (t - 0.5) / 2.5 : t < 3.5 ? 1 : t < 5.5 ? 1 - (t - 3.5) / 2 : 0);
  const p = { thr: 0, V: 0, alpha: 0, beta: 0, running: 1, starter: 0, interior: 0, rpmOver: null, thrustOver: null };
  let tgtThr = 0, cur = 0, next = 0, prev = 0, maxSlope = 0;
  const a = 1 - Math.exp(-(BLOCK / SR) / tau);
  for (let b = 0; b < nb; b++) {
    const t = b * BLOCK / SR;
    if (t >= next) { tgtThr = thrAt(t); next += dt; }   // a frame: the new targets
    cur += (tgtThr - cur) * a;                           // setTargetAtTime, block by block (k-rate)
    const sl = Math.abs(cur - prev) / (BLOCK / SR); if (sl > maxSlope) maxSlope = sl; prev = cur;
    p.thr = cur;
    RP.stepChain(ch, p);
    const e = ch.drv.outputs[0][0], q = ch.pout[0][0];
    for (let i = 0; i < BLOCK; i++) y[b * BLOCK + i] = e[i] + q[i];
  }
  const W = Math.round(0.01 * SR), env = [];
  for (let o = 0; o + W <= y.length; o += W) { let q = 0; for (let i = o; i < o + W; i++) q += y[i] * y[i]; env.push(10 * Math.log10(q / W + 1e-12)); }
  // the envelope's jumps, smoothed over 3 windows (the engine's own firing ripple is not a step)
  const sm = env.map((v, i) => (env[Math.max(0, i - 1)] + v + env[Math.min(env.length - 1, i + 1)]) / 3);
  let maxJ = 0, n1 = 0; for (let i = 1; i < sm.length; i++) { const j = Math.abs(sm[i] - sm[i - 1]); if (j > maxJ) maxJ = j; if (j > 1) n1++; }
  // THE STAIRCASE: the lever's peak slope as the voice receives it, over the commanded ramp's (0.4 / s up, 0.5 / s down):
  // 1 is a glide, 10 is a 30 ms jump every frame
  return { build: key, dt, tau, slopeOverRamp: +(maxSlope / 0.5).toFixed(2), maxStepDb: +maxJ.toFixed(2), stepsOver1dB: n1, y };
}

function writeOgg(file, L, Rr) {
  const n = L.length, buf = Buffer.alloc(n * 8);
  for (let i = 0; i < n; i++) { buf.writeFloatLE(L[i], i * 8); buf.writeFloatLE(Rr[i], i * 8 + 4); }
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '96k', file], { input: buf });
}

async function main() {
  const arg = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').slice(k.length + 3);
  const only = arg('only').split(',').filter(Boolean);
  const out = arg('out') || path.join(OUT_DIR, 'mix.json');
  const tag = arg('renders');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rows = [];
  for (const key of BUILDS) {
    if (only.length && !only.includes(key)) continue;   // (--only=none: no states, e.g. with --lowfps)
    for (const s of Object.keys(STATES)) for (const inn of [1, 0]) {
      const music = s === 'cruise';   // the radio in cruise, music in flight on
      const r = await measureState(key, s, inn, { music });
      if (tag && key === 'jodel' && s !== 'taxi') writeOgg(path.join(OUT_DIR, 'jodel_' + (inn ? 'cockpit' : 'chase') + '_' + s + '_' + tag + '.ogg'), r._master.L, r._master.R);
      delete r._master;
      rows.push(r);
      const b = r.buses, f = x => (x && isFinite(x.lufs) ? x.lufs.toFixed(1).padStart(6) : '     -');
      console.log((key + ' ' + s + ' ' + r.persp).padEnd(22) + ' eng' + f(b.engine) + ' prop' + f(b.prop) + ' e+p' + f(b.enginePlusProp) + ' air' + f(b.airframe) +
        ' amb' + f(b.ambience) + ' emit' + f(b.emitters) + ' mus' + f(b.music) + ' voice' + f(b.voice) + ' | master' + f(b.master) + ' pk ' + b.master.peak + ' GRmax ' + r.limiter.grMaxDb);
    }
  }
  const lot = [];
  if (process.argv.includes('--lottery')) for (const key of BUILDS) for (const s of ['climb', 'cruise']) for (const td of [0, SC.CABIN_TONAL_DB || 0]) {
    if ((only.length && !only.includes(key)) || (td === 0 && lot.some(r => r.build === key && r.state === s && r.tonalDb === 0))) continue;
    const r = lottery(key, s, td, 12); lot.push(r);
    console.log('lottery ' + key + ' ' + s + ' tonal ' + td + ' dB: e+p vs the power sum ' + r.worst + ' .. +' + r.best + ' dB, the e+p spread over 12 angles ' + r.spreadDb + ' dB');
  }
  const lf = [];
  if (process.argv.includes('--lowfps')) for (const [dt, tau, tag] of [[1 / 60, 0.03, '60fps'], [0.33, 0.03, '3fps_tau30ms'], [0.33, 0.198, '3fps_frametau']]) {
    const r = lowFps('jodel', dt, tau);
    if (tag !== '60fps' || true) writeOgg(path.join(OUT_DIR, 'jodel_ramp_' + tag + '.ogg'), r.y, r.y);
    delete r.y; r.tag = tag; lf.push(r);
    console.log('lowfps ' + tag + ': the lever\'s peak slope ' + r.slopeOverRamp + ' x the ramp\'s');
  }
  if (!rows.length && lf.length) { fs.writeFileSync(path.join(OUT_DIR, 'lowfps.json'), JSON.stringify(lf, null, 1) + '\n'); return; }
  fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString().slice(0, 10), sr: SR, rows, lottery: lot.length ? lot : undefined }, null, 1) + '\n');
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { measureState, lottery, lufs, limiter, kWeight, STATES, BUILDS, pageAudio, mixTrims };
