#!/usr/bin/env node
// SND-SPACE's evidence (G1645, SOUND-2026-10-04 §4 / §5): the space rendered offline in node, from the SAME files the page
// loads - the engine and prop worklets (under render.js's shim, wired as render_prop.js's chains: the engine's control
// output into the prop), space_config.js's numbers (the cabin transfer, the headset, the directivity, the absorption,
// the retarded geometry and its doppler, the shed's IR) - and the Web Audio spec's own node formulas written out here
// (the BiquadFilterNode's coefficients via space_config.biquadCoefs, the PannerNode's equal-power law and inverse distance,
// a ConvolverNode as an FFT convolution), so what is heard is what space.js asks the browser for.
//
//   node tools/audio/space_render.js            -> reports/evidence/SND-SPACE/*.ogg + *.png + summary.json
//   node tools/audio/space_render.js --only=cub_flyby,cessna_runup   (scene prefixes)   --wav (keep WAVs beside)
//
// SCENES
//   <b>_runup_outside / _inside   the same static run-up (idle, full throttle, idle; 10 s), heard 15 m off the nose
//                                 at 45 deg (the exterior chain: directivity, distance, absorption, equal-power pan) and
//                                 from the cabin (the build's cabin transfer: fabric for the Cub, metal for the Cessna)
//   cessna_runup_inside_headset   the same with the passive headset (ruling s7: offered, default off)
//   <b>_flyby                     a pass at 60 m/s, 40 m off a fixed listener, cruise power, -1200 m .. +1200 m: the
//                                 doppler (on the voices' pitch), the propagation (heard where it WAS), the absorption
//                                 (dull far away, bright close), the directivity (the tonal's lobe behind the disc)
//   cub_hangar_club / _field      the run-up 8 m in front of the eye inside the shed, dry + the generated IR's wet
//                                 (the club shed 30 x 25 x 7 m, the field shed 14 x 18 x 3.6 m), stereo
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = require('./render.js');
const RP = require('./render_prop.js');
const SC = require(path.join(R.ROOT, 'src', 'viewer', 'audio', 'space_config.js'));
const OUT_DIR = path.join(R.ROOT, 'reports', 'evidence', 'SND-SPACE');
const SR = 48000, BLOCK = R.BLOCK, C = 343;
const WET_AIRCRAFT = 0.25;   // space.js's shed send

// ---- the Web Audio nodes, offline -----------------------------------------------------------------------------
// a BiquadFilterNode (direct form I), coefficients settable per block
function biquad(type, f, Q, gain) {
  const s = { x1: 0, x2: 0, y1: 0, y2: 0, k: SC.biquadCoefs(type, f, Q, gain || 0, SR), type, Q, gain: gain || 0 };
  s.set = (ff) => { s.k = SC.biquadCoefs(s.type, ff, s.Q, s.gain, SR); };
  s.run = (x, y, n) => {
    const k = s.k; let { x1, x2, y1, y2 } = s;
    for (let i = 0; i < n; i++) { const v = k.b0 * x[i] + k.b1 * x1 + k.b2 * x2 - k.a1 * y1 - k.a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
    s.x1 = x1; s.x2 = x2; s.y1 = y1; s.y2 = y2;
  };
  return s;
}
function chainOf(ch) { return { filters: ch.filters.map(q => biquad(q.type, q.f, q.Q, q.gain)), g: Math.pow(10, ch.gainDb / 20) }; }
function runChain(cn, x, y, n) { let a = x; for (const f of cn.filters) { f.run(a, y, n); a = y; } for (let i = 0; i < n; i++) y[i] = a[i] * cn.g; }
// the PannerNode: inverse distance (ref, rolloff 1) and the equal-power law on the azimuth in the listener's frame
// (x right, z back: the spec's azimuth from the source's projection), mono in -> L, R gains
function pannerGains(px, py, pz, ref, out) {
  const d = Math.sqrt(px * px + py * py + pz * pz);
  const dg = ref / (ref + Math.max(d, ref) - ref);
  let az = 0;
  if (d > 1e-6) { az = Math.atan2(px, -pz) * 180 / Math.PI; }   // 0 ahead, +90 right
  if (az < -90) az = -180 - az; else if (az > 90) az = 180 - az;
  const x = (az + 90) / 180;
  out[0] = dg * Math.cos(x * Math.PI / 2); out[1] = dg * Math.sin(x * Math.PI / 2); out[2] = d;
}
// a ConvolverNode: one FFT convolution (the IR's length + the signal's)
function convolve(x, h) {
  let N = 1; while (N < x.length + h.length) N <<= 1;
  const ar = new Float64Array(N), ai = new Float64Array(N), br = new Float64Array(N), bi = new Float64Array(N);
  ar.set(x); br.set(h);
  R.fft(ar, ai); R.fft(br, bi);
  for (let k = 0; k < N; k++) { const r = ar[k] * br[k] - ai[k] * bi[k], i = ar[k] * bi[k] + ai[k] * br[k]; ar[k] = r; ai[k] = -i; }
  R.fft(ar, ai);   // the inverse through the forward transform of the conjugate
  const y = new Float32Array(x.length);
  for (let k = 0; k < x.length; k++) y[k] = ar[k] / N;
  return y;
}

// ---- the aeroplane: render_prop's chain, one engine --------------------------------------------------------------
let WK = null;
const builds = {};
function buildOf(key) {
  if (!builds[key]) builds[key] = RP.loadPropBuild(RP.PROP_BUILDS.find(b => b.key === key));
  return builds[key];
}
function chainFor(key, opts) {
  WK = WK || RP.loadAll(SR);
  const B = buildOf(key);
  const idle = B.engines[0].ecfg.idleRpm;
  return RP.makeChain(WK, B, 0, Object.assign({ seed: 5, heat: 0.4, state: { running: true, rpm: idle } }, opts || {}));
}
// the run-up's lever over 10 s
const runupThr = t => t < 2 ? 0.08 : t < 4 ? 0.08 + 0.92 * (t - 2) / 2 : t < 8 ? 1 : t < 9 ? 1 - 0.92 * (t - 8) : 0.08;

// render `seconds` of a chain with `scene(t, p, out)` per block: p = the chain's state (thr, V, ...), out.pitch the doppler;
// returns the three parts per sample (the engine, the prop's tonal, its broadband)
function renderParts(ch, seconds, scene) {
  const nb = Math.ceil(seconds * SR / BLOCK), n = nb * BLOCK;
  const e = new Float32Array(n), t = new Float32Array(n), b = new Float32Array(n), pitch = new Float32Array(nb);
  const p = { thr: 0.08, V: 0, alpha: 0, beta: 0, running: 1, starter: 0, interior: 0 }, o = { pitch: 1 };
  for (let k = 0; k < nb; k++) {
    scene(k * BLOCK / SR, p, o, k);
    ch.drv.params.pitch[0] = o.pitch; ch.pp.pitch[0] = o.pitch; pitch[k] = o.pitch;
    RP.stepChain(ch, p);
    e.set(ch.drv.outputs[0][0], k * BLOCK); t.set(ch.pout[1][0], k * BLOCK); b.set(ch.pout[1][1], k * BLOCK);
  }
  return { e, t, b, n, nb, pitch };
}

// ---- the scenes -------------------------------------------------------------------------------------------------
function runupOutside(key) {
  const ch = chainFor(key), P = renderParts(ch, 10, (t, p) => { p.thr = runupThr(t); p.V = 0; p.interior = 0; });
  const B = buildOf(key), ref = Math.max(6, Math.min(20, B.def.params.viewDist || 12));
  // the eye 15 m off the nose at 45 deg (ahead-left), level; the aeroplane's nose = -z of the eye's frame rotated
  const ang = 45 * Math.PI / 180, d = 15;
  const cosT = Math.cos(ang);   // the nose against the direction to the eye
  const gE = SC.directivity(SC.DIR_EXHAUST, cosT), gT = SC.directivity(SC.DIR_TONAL, cosT), gB = SC.directivity(SC.DIR_BROAD, cosT);
  const lp = biquad('lowpass', SC.airAbsorptionHz(d), -3.01, 0);
  const pg = new Float64Array(3);
  pannerGains(d * Math.sin(ang), 0, -d * Math.cos(ang), ref, pg);   // the aeroplane ahead-right of the eye
  const mono = new Float32Array(P.n);
  for (let i = 0; i < P.n; i++) mono[i] = gE * P.e[i] + gT * P.t[i] + gB * P.b[i];
  const y = new Float32Array(P.n); lp.run(mono, y, P.n);
  const L = new Float32Array(P.n), Rr = new Float32Array(P.n);
  for (let i = 0; i < P.n; i++) { L[i] = y[i] * pg[0]; Rr[i] = y[i] * pg[1]; }
  return { L, R: Rr, note: { dirExhaust: gE, dirTonal: gT, dirBroad: gB, distGain: Math.hypot(pg[0], pg[1]), absorbHz: SC.airAbsorptionHz(d) }, ch, P };
}
function runupInside(key, headset) {
  const ch = chainFor(key), P = renderParts(ch, 10, (t, p) => { p.thr = runupThr(t); p.V = 0; p.interior = 1; });
  const B = buildOf(key), cab = SC.cabinTransfer(B.spec);
  const cn = chainOf(cab), mono = new Float32Array(P.n), y = new Float32Array(P.n);
  for (let i = 0; i < P.n; i++) mono[i] = P.e[i] + P.t[i] + P.b[i];
  runChain(cn, mono, y, P.n);
  let z = y;
  if (headset) { const hc = chainOf(SC.headsetCurve(headset)); z = new Float32Array(P.n); runChain(hc, y, z, P.n); }
  return { L: z, R: z, note: { cabin: cab.cls, source: cab.source, insulationDb: cab.insulationDb, hfLossDb: +cab.hfLossDb.toFixed(1), boomHz: Math.round(cab.boomHz), headset: headset || null }, P };
}
function flyby(key) {
  const B = buildOf(key), ch = chainFor(key, { state: { running: true, rpm: B.engRpm(B.propRpm(0.75, true, 60)) } });
  const ref = Math.max(6, Math.min(20, B.def.params.viewDist || 12));
  const v = 60, D = 40, x0 = -1200, T = 2400 / v;   // 40 s
  // the listener at the origin facing +z... the track along x at z = -D (ahead of the eye), the nose toward +x
  const ring = SC.ringMake(4096), PB = new Float64Array(4), AT = new Float64Array(5), RS = new Float64Array(8), pg = new Float64Array(3);
  const nbAll = Math.ceil(T * SR / BLOCK);
  const geo = new Float64Array(nbAll * 8);   // per block: L, R gains, the absorption Hz, the directivities x3, the doppler, the delay
  let kS = 1;
  // the frames at 60 Hz fill the ring; the blocks read the retarded state (as the page: the frame's values, smoothed)
  // pre-fill the ring with the aeroplane's past (it was already flying)
  for (let f = -900; f <= 0; f++) { const t = f / 60; PB[0] = t; PB[1] = x0 + v * t; PB[2] = 0; PB[3] = -D; SC.ringPush(ring, PB); }
  const P = renderParts(ch, T, (t, p, o, k) => {
    const tf = Math.floor(t * 60) / 60;   // the newest frame
    PB[0] = tf; PB[1] = x0 + v * tf; PB[2] = 0; PB[3] = -D; SC.ringPush(ring, PB);
    AT[0] = t; AT[1] = 0; AT[2] = 0; AT[3] = 0; AT[4] = C;
    SC.retardedSolve(ring, AT, RS);
    const d = RS[7], id = 1 / Math.max(1e-3, d);
    const nx = -RS[1] * id, ny = -RS[2] * id, nz = -RS[3] * id;   // from the source to the listener
    const cosT = nx;   // the nose is +x
    const kD = SC.dopplerFactor(C, RS[4] * nx + RS[5] * ny + RS[6] * nz, 0);
    kS += (kD - kS) * (1 - Math.exp(-BLOCK / SR / 0.04));   // the page's tau 40 ms
    o.pitch = kS;
    p.thr = 0.75; p.V = v; p.alpha = 0.05; p.interior = 0;
    pannerGains(RS[1], RS[2], RS[3], ref, pg);
    const q = k * 8;
    geo[q] = pg[0]; geo[q + 1] = pg[1]; geo[q + 2] = SC.airAbsorptionHz(d);
    geo[q + 3] = SC.directivity(SC.DIR_EXHAUST, cosT); geo[q + 4] = SC.directivity(SC.DIR_TONAL, cosT); geo[q + 5] = SC.directivity(SC.DIR_BROAD, cosT);
    geo[q + 6] = kS; geo[q + 7] = RS[0];
  });
  const lp = biquad('lowpass', 20000, -3.01, 0), L = new Float32Array(P.n), Rr = new Float32Array(P.n);
  const xb = new Float32Array(BLOCK), yb = new Float32Array(BLOCK), gs = new Float64Array(8);
  for (let k = 0; k < P.nb; k++) {
    const q = k * 8, o = k * BLOCK;
    lp.set(geo[q + 2]);
    for (let i = 0; i < BLOCK; i++) xb[i] = geo[q + 3] * P.e[o + i] + geo[q + 4] * P.t[o + i] + geo[q + 5] * P.b[o + i];
    lp.run(xb, yb, BLOCK);
    // the gains ramp across the block (the page's setTargetAtTime: no zipper)
    const q0 = k > 0 ? q - 8 : q;
    for (let i = 0; i < BLOCK; i++) { const u = i / BLOCK; L[o + i] = yb[i] * (geo[q0] + (geo[q] - geo[q0]) * u); Rr[o + i] = yb[i] * (geo[q0 + 1] + (geo[q + 1] - geo[q0 + 1]) * u); }
  }
  const fire0 = B.engRpm(B.propRpm(0.75, true, v)) / 60 * 2;   // a flat-4's firing = the 2-blade BPF here
  return { L, R: Rr, geo, nb: P.nb, fire0, P, note: { v, D, from: x0, seconds: T, cruiseRpm: Math.round(fire0 * 30), approachK: +geo[Math.floor(SR / BLOCK) * 8 + 6].toFixed(4), recedeK: +geo[(P.nb - 1) * 8 + 6].toFixed(4) } };
}
function hangar(key, shell, dims) {
  const ch = chainFor(key), P = renderParts(ch, 10, (t, p) => { p.thr = runupThr(t); p.V = 0; p.interior = 0; });
  const mono = new Float32Array(P.n);
  for (let i = 0; i < P.n; i++) mono[i] = P.e[i] + P.t[i] + P.b[i];   // the room mode: no directivity, 8 m ahead (< ref: unity)
  const room = SC.hangarAcoustics(dims, shell), ir = SC.hangarIR(room, SR);
  const wL = convolve(mono, ir.L), wR = convolve(mono, ir.R);
  const g = Math.SQRT1_2;   // the panner straight ahead: equal power, -3 dB a side
  const L = new Float32Array(P.n), Rr = new Float32Array(P.n);
  for (let i = 0; i < P.n; i++) { L[i] = g * mono[i] + WET_AIRCRAFT * wL[i]; Rr[i] = g * mono[i] + WET_AIRCRAFT * wR[i]; }
  return { L, R: Rr, note: { shell, dims, V: Math.round(room.V), rt60: room.rt60.map(x => +x.toFixed(2)), rt60Measured1k: +SC.measureRT60(ir.L, SR, 1000).toFixed(2), irSeconds: +(ir.length / SR).toFixed(2), wet: WET_AIRCRAFT }, P };
}

// ---- the files ---------------------------------------------------------------------------------------------------
const rmsDb = (y, a, b) => { let s = 0; for (let k = a; k < b; k++) s += y[k] * y[k]; return 20 * Math.log10(Math.sqrt(s / Math.max(1, b - a)) + 1e-12); };
function bandDb(y, a, len, f0, f1) {
  const S = R.spectrum(y, a, len, SR, len); let s = 0;
  for (let k = Math.floor(f0 / S.binHz); k <= Math.ceil(f1 / S.binHz) && k < S.mag.length; k++) s += S.mag[k] * S.mag[k];
  return 10 * Math.log10(s + 1e-24);
}
function ffmpegOk() { try { execFileSync('ffmpeg', ['-hide_banner', '-version'], { stdio: 'ignore' }); return true; } catch (e) { return false; } }
function writeStereo(name, L, Rr, opts) {
  const o = opts || {}, n = L.length;
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(Rr[i]));
  const buf = Buffer.alloc(n * 8);
  for (let i = 0; i < n; i++) { buf.writeFloatLE(L[i], i * 8); buf.writeFloatLE(Rr[i], i * 8 + 4); }
  const ogg = path.join(OUT_DIR, name + '.ogg');
  if (ffmpegOk()) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'pipe:0',
      '-c:a', 'libopus', '-b:a', '64k', ogg], { input: buf });
  }
  if (process.argv.includes('--wav')) {
    const tmp = path.join(OUT_DIR, name + '.wav');
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'pipe:0', '-c:a', 'pcm_s16le', tmp], { input: buf });
  }
  const mono = new Float32Array(n); for (let i = 0; i < n; i++) mono[i] = 0.5 * (L[i] + Rr[i]);
  fs.writeFileSync(path.join(OUT_DIR, name + '.png'), R.spectrogramPng(mono, SR, o.spec || {}));
  return { peak: +pk.toFixed(3), mono };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  const want = n => !only.length || only.some(o => n.startsWith(o));
  const sum = { made: [], scenes: {} };
  const t0 = Date.now();
  for (const key of ['cub', 'cessna']) {
    if (want(key + '_runup')) {
      const ou = runupOutside(key), wo = writeStereo(key + '_runup_outside', ou.L, ou.R);
      const iu = runupInside(key), wi = writeStereo(key + '_runup_inside', iu.L, iu.R);
      // the full-power hold (4.5..7.5 s): the levels and the high band, inside against outside
      const a = Math.round(4.5 * SR), b = Math.round(7.5 * SR), len = 65536;
      const dry = new Float32Array(ou.P.n); for (let i = 0; i < ou.P.n; i++) dry[i] = ou.P.e[i] + ou.P.t[i] + ou.P.b[i];
      sum.scenes[key + '_runup'] = {
        outside: Object.assign({ peak: wo.peak, rmsFullDb: +rmsDb(wo.mono, a, b).toFixed(1) }, ou.note),
        inside: Object.assign({ peak: wi.peak, rmsFullDb: +rmsDb(wi.mono, a, b).toFixed(1) }, iu.note),
        dryRmsFullDb: +rmsDb(dry, a, b).toFixed(1),
        insideMinusDryDb: +(rmsDb(wi.mono, a, b) - rmsDb(dry, a, b)).toFixed(1),
        insideMinusDry_2to8kHz_dB: +(bandDb(wi.mono, a, len, 2000, 8000) - bandDb(dry, a, len, 2000, 8000)).toFixed(1),
        insideMinusDry_63to250Hz_dB: +(bandDb(wi.mono, a, len, 63, 250) - bandDb(dry, a, len, 63, 250)).toFixed(1),
      };
      sum.made.push(key + '_runup_outside', key + '_runup_inside');
      if (key === 'cessna') {
        const hu = runupInside(key, 'passive'), wh = writeStereo(key + '_runup_inside_headset', hu.L, hu.R);
        sum.scenes[key + '_runup'].insideHeadset = Object.assign({ peak: wh.peak, rmsFullDb: +rmsDb(wh.mono, a, b).toFixed(1) }, hu.note);
        sum.made.push(key + '_runup_inside_headset');
      }
      console.log(key + ' run-up: inside ' + sum.scenes[key + '_runup'].insideMinusDryDb + ' dB against the dry voice (' + iu.note.cabin + ', ' + iu.note.insulationDb + ' dB insulation)');
    }
    if (want(key + '_flyby')) {
      const fb = flyby(key);
      const nb = fb.nb, pitchAt = t => { const k = Math.min(nb - 1, Math.max(0, Math.floor(t * SR / BLOCK))); return fb.geo[k * 8 + 6]; };
      const w = writeStereo(key + '_flyby', fb.L, fb.R, { spec: { width: 640, traces: [t => fb.fire0 * pitchAt(t)] } });
      // the measured firing peak far before and far after the pass against fire0 x c / (c -+ v cos) (1.5 s windows)
      const meas = (t) => { const a = Math.round(t * SR); const S = R.spectrum(w.mono, a, 65536, SR, 262144); const k = pitchAt(t + 0.68); return { want: fb.fire0 * k, got: R.peakIn(S, fb.fire0 * k * 0.95, fb.fire0 * k * 1.05).hz }; };
      const ap = meas(3), rc = meas(fb.note.seconds - 5);
      sum.scenes[key + '_flyby'] = Object.assign({ peak: w.peak, approach: { wantHz: +ap.want.toFixed(2), gotHz: +ap.got.toFixed(2) }, recede: { wantHz: +rc.want.toFixed(2), gotHz: +rc.got.toFixed(2) },
        levelDb: { far: +rmsDb(w.mono, SR, 3 * SR).toFixed(1), closest: +rmsDb(w.mono, Math.round(19 * SR), Math.round(21 * SR)).toFixed(1) },
        delayAtStartS: +fb.geo[7].toFixed(3), delayClosestS: +fb.geo[Math.floor(20.1 * SR / BLOCK) * 8 + 7].toFixed(3),
        absorbHz: { far: Math.round(fb.geo[2]), closest: Math.round(fb.geo[Math.floor(20.1 * SR / BLOCK) * 8 + 2]) } }, fb.note);
      sum.made.push(key + '_flyby');
      console.log(key + ' fly-by: doppler ' + fb.note.approachK + ' -> ' + fb.note.recedeK + ', firing ' + ap.got.toFixed(1) + ' -> ' + rc.got.toFixed(1) + ' Hz');
    }
  }
  for (const [shell, dims] of [['club', { HW: 15, HD: 12.5, EAVE: 7 }], ['field', { HW: 7, HD: 9, EAVE: 3.6 }]]) {
    const nm = 'cub_hangar_' + shell;
    if (!want(nm)) continue;
    const h = hangar('cub', shell, dims), w = writeStereo(nm, h.L, h.R);
    sum.scenes[nm] = Object.assign({ peak: w.peak }, h.note);
    sum.made.push(nm);
    console.log(nm + ': RT60 ' + h.note.rt60.join('/') + ' s (1 kHz measured ' + h.note.rt60Measured1k + ')');
  }
  sum.seconds = (Date.now() - t0) / 1000;
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(sum, null, 1));
  console.log('made ' + sum.made.length + ' renders in ' + sum.seconds.toFixed(1) + ' s -> ' + path.relative(R.ROOT, OUT_DIR));
}

module.exports = { biquad, chainOf, runChain, pannerGains, convolve, runupOutside, runupInside, flyby, hangar };
if (require.main === module) main();
