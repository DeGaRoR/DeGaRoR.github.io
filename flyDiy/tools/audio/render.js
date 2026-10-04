#!/usr/bin/env node
// THE OFFLINE ENGINE RENDER (SND-ENGINE, G1612; SOUND-2026-10-04 §8).
//
// Runs src/viewer/audio/engine_worklet.js in node under a tiny
// AudioWorkletProcessor / registerProcessor / sampleRate shim — the same file
// the browser loads, not a copy — and renders the five validated engines
// through the scenes a pilot hears: an rpm sweep, a static run-up (idle ->
// full -> idle), start -> run -> shutdown, plus a starvation, a hot shutdown
// (the ticking) and the twin. The rpm the voice is given is the solver's own
// law at the given throttle (00_registry.js genShaftRpm -> genEngineRpm,
// against the build's buildGen engine and prop), the crank the solver's 1.5 s.
//
//   node tools/audio/render.js                 renders + encodes the evidence
//   node tools/audio/render.js --only=cub      one build
//   node tools/audio/render.js --wav           keep WAVs (<= 1 MB each) instead of Opus
//   node tools/audio/render.js --bench         ms per 128-frame block, per voice
//   node tools/audio/render.js --calibrate     full-power peak/RMS per voice
//   --out=reports/evidence/SND-ENGINE-2 --names=cub_start,cessna_hot   another folder, those renders only
//
// Also a library: GATE AUDIO (tools/audio/_engine_check.js) renders through it.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const at = p => path.join(ROOT, p);
const WORKLET = at('src/viewer/audio/engine_worklet.js');
const CONFIG = require(at('src/viewer/audio/engine_config.js'));
const OUT_DIR = at('reports/evidence/SND-ENGINE');
const BLOCK = 128;

// THE FIVE VALIDATED BUILDS (SOUND §8; A0's list, G1178 for the two floatplanes)
const VALIDATED = [
  { key: 'cub', file: 'builds/cub_2026-09-20_corrected.json',
    label: "the user's Cub (Continental A-65, direct drive)" },
  { key: 'jodel', file: 'builds/jodel_2026-09-20_corrected.json',
    label: 'the Jodel D112 (Continental A-65, cruise-pitch prop)' },
  { key: 'cessna', file: 'builds/cessna172_2026-09-20_corrected.json',
    label: 'the Cessna 172 (custom flat four, 5.9 L: O-320/O-360 class)' },
  { key: 'cessnaFloats', file: 'bugReports/cessnaFloatsWOrks.json',
    label: 'the Cessna on floats (Lycoming O-540, flat six)' },
  { key: 'twin582', file: 'tools/fixtures/build_v7_ultralight_2026-09-05.json',
    label: 'the twin-582 floatplane (two Rotax 582, two-stroke twins, 2.62 reduction)' },
];

// ---- the shim --------------------------------------------------------------
// The worklet scope has three globals the processor uses: the base class,
// registerProcessor and sampleRate. The file's text is wrapped in a function
// taking those three as arguments and compiled once per load, so a second
// rate is a second load (cheap), never a mutated global. (Not a vm context:
// a contextified global puts every global lookup — Math, the file's own
// top-level functions — behind an interceptor, and measured the voice 10x
// slower than the browser will run it.)
function loadWorklet(sr, file) {
  const code = fs.readFileSync(file || WORKLET, 'utf8');
  const registry = {};
  class AudioWorkletProcessor {
    constructor() { this.port = { onmessage: null, postMessage() {} }; }
  }
  const mod = { exports: {} };
  const wrapped = vm.runInThisContext(
    '(function (AudioWorkletProcessor, registerProcessor, sampleRate, currentTime, module) {'
    + code + '\n})', { filename: file || WORKLET });
  wrapped(AudioWorkletProcessor, (name, cls) => { registry[name] = cls; }, sr, 0, mod);
  return { Processor: registry['flydiy-engine'], lib: mod.exports, registry, sr };
}

// one voice: the processor, its k-rate parameter arrays and its two outputs,
// all allocated once
function makeVoice(W, config, seed, heat, state) {
  const proc = new W.Processor({ processorOptions: Object.assign({ config, seed, heat }, state || {}) });
  const params = {};
  for (const d of W.Processor.parameterDescriptors) params[d.name] = new Float32Array([d.defaultValue]);
  const outputs = [[new Float32Array(BLOCK)], [new Float32Array(BLOCK), new Float32Array(BLOCK)]];
  return { proc, params, outputs, inputs: [], config, sr: W.sr };
}

// render `seconds` with `scene(t, p)` setting the parameters at each block
// (p: {rpm, load, running, starter, starve, cold}); returns the mono voice and
// the control channels (engine and prop rpm) at block rate
function renderVoice(voice, seconds, scene) {
  const n = Math.ceil(seconds * voice.sr / BLOCK) * BLOCK;
  const y = new Float32Array(n);
  const ctlE = new Float32Array(n / BLOCK), ctlP = new Float32Array(n / BLOCK);
  const p = { rpm: 0, load: 0, running: 0, starter: 0, starve: 0, cold: 0 };
  for (let b = 0, o = 0; o < n; b++, o += BLOCK) {
    scene(o / voice.sr, p);
    voice.params.rpm[0] = p.rpm; voice.params.load[0] = p.load;
    voice.params.running[0] = p.running; voice.params.starter[0] = p.starter;
    voice.params.starve[0] = p.starve; voice.params.cold[0] = p.cold;
    voice.proc.process(voice.inputs, voice.outputs, voice.params);
    y.set(voice.outputs[0][0], o);
    ctlE[b] = voice.outputs[1][0][BLOCK - 1] * 1000;
    ctlP[b] = voice.outputs[1][1][BLOCK - 1] * 1000;
  }
  return { y, ctlE, ctlP, sr: voice.sr };
}

// ---- the aeroplane: its engines' configs and the solver's rpm law ----------
let FC = null;
const flightCore = () => FC || (FC = require(at('tools/flight_core.js')));
function loadBuild(entry) {
  const raw = JSON.parse(fs.readFileSync(at(entry.file), 'utf8'));
  const spec = raw.spec || raw;
  const C = flightCore();
  const def = C.buildGen(JSON.parse(JSON.stringify(spec)));
  const nE = Math.max(1, (spec.engines || []).length);
  const configs = [];
  for (let i = 0; i < nE; i++) configs.push(CONFIG.engineSoundConfig(spec, i, C.POWERPLANTS));
  const EN = def.params.engine, PR = def.params.prop;
  // the solver's own law (30_solver.js:1022-1026): prop shaft, then the tacho
  const rpmAt = (thr, running, V) => C.genEngineRpm(EN, C.genShaftRpm(EN, PR, thr, V || 0, 1, 1, running));
  return Object.assign({}, entry, { spec, def, configs, EN, PR, rpmAt });
}

// ---- the scenes ------------------------------------------------------------
const ramp = (t, t0, t1, a, b) => t <= t0 ? a : t >= t1 ? b : a + (b - a) * (t - t0) / (t1 - t0);
const SCENES = {
  // an rpm sweep: idle -> rated -> idle, the load following (in flight, the
  // prop unloading with speed lets the engine reach its rated rpm)
  sweep: { seconds: 14, heat: 0.6, state: (B, cfg) => ({ running: 1, rpm: cfg.idleRpm }), scene: (B, cfg) => (t, p) => {
    const lo = cfg.idleRpm, hi = cfg.ratedRpm;
    const u = t < 7 ? ramp(t, 0.5, 6.5, 0, 1) : ramp(t, 7.5, 13.5, 1, 0);
    p.rpm = lo + (hi - lo) * u; p.load = u; p.running = 1; p.starter = 0; p.starve = 0; p.cold = 0;
  } },
  // the static run-up on the ground: the throttle, through the solver's law
  runup: { seconds: 13, heat: 0.6, state: (B) => ({ running: 1, rpm: B.rpmAt(0, true, 0) }), scene: (B) => (t, p) => {
    const thr = t < 6 ? ramp(t, 2, 4, 0, 1) : ramp(t, 8, 10, 1, 0);
    p.rpm = B.rpmAt(thr, true, 0); p.load = thr; p.running = 1; p.starter = 0; p.starve = 0; p.cold = 0;
  } },
  // the key: 0.6 s of silence, the 1.5 s crank (setEngine's), the catch, a
  // cold idle, a brief run-up, idle, the key off, the run-down
  start: { seconds: 16, heat: 0, scene: (B) => (t, p) => {
    const crank = t >= 0.6 && t < 2.1, run = t >= 2.1 && t < 12.5;
    const thr = run ? (t < 6.5 ? 0 : t < 9.5 ? ramp(t, 6.5, 7.3, 0, 0.55) : ramp(t, 9.5, 10.3, 0.55, 0)) : 0;
    p.rpm = B.rpmAt(thr, run, 0); p.load = run ? thr : 0; p.running = run ? 1 : 0;
    p.starter = crank ? 1 : 0; p.starve = 0; p.cold = run ? Math.max(0, 1 - (t - 2.1) / 240) : 0;
  } },
  // fuel starvation in cruise (45 m/s): the last 20 s of endurance -> the
  // coughs -> out.starved stops the engine -> the prop windmills it
  starve: { seconds: 25, heat: 1, state: (B) => ({ running: 1, rpm: B.rpmAt(0.75, true, 45) }), scene: (B) => (t, p) => {
    const endur = Math.max(0, 20 - t);          // fuel.enduranceS: the last 20 s, dry at t = 20
    const starved = endur <= 0;
    const thr = 0.75;
    p.rpm = B.rpmAt(thr, !starved, 45); p.load = starved ? 0 : thr; p.running = starved ? 0 : 1;
    p.starter = 0; p.starve = starved ? 1 : Math.max(0, 1 - endur / CONFIG.ENGINE_SOUND_STARVE_S); p.cold = 0;
  } },
  // a hot engine shut down after a flight: idle, key off, then the exhaust
  // ticking as it cools
  hot: { seconds: 26, heat: 1, state: (B) => ({ running: 1, rpm: B.rpmAt(0, true, 0) }), scene: (B) => (t, p) => {
    const run = t < 3;
    p.rpm = B.rpmAt(0, run, 0); p.load = 0; p.running = run ? 1 : 0; p.starter = 0; p.starve = 0; p.cold = 0;
  } },
};

function renderScene(W, B, sceneKey, opts) {
  const o = opts || {};
  const S = SCENES[sceneKey];
  const engines = o.engines || [0];
  let mix = null, ctl = null;
  // several engines summed: each at -10 log10(N) dB, as src_engine.js builds them (SND-ENGINE-2)
  const kN = CONFIG.engineSoundCountGain(engines.length);
  for (const i of engines) {
    const cfg = kN < 1 ? Object.assign({}, B.configs[i], { gain: B.configs[i].gain * kN }) : B.configs[i];
    const voice = makeVoice(W, cfg, (o.seed || 1) + i * 7919, o.heat != null ? o.heat : S.heat,
                            S.state ? S.state(B, cfg) : null);
    const r = renderVoice(voice, o.seconds || S.seconds, S.scene(B, cfg));
    if (!mix) { mix = r.y; ctl = r; } else for (let k = 0; k < mix.length; k++) mix[k] += r.y[k];
  }
  return { y: mix, ctlE: ctl.ctlE, ctlP: ctl.ctlP, sr: W.sr };
}

// ---- the analysis ----------------------------------------------------------
// in-place radix-2 FFT on (re, im), length a power of two
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
// the magnitude spectrum of y[from, from+len), Hann-windowed, zero-padded
// to `nfft`; returns {mag, binHz}
function spectrum(y, from, len, sr, nfft) {
  let N = 1; while (N < (nfft || len)) N <<= 1;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let k = 0; k < len; k++) re[k] = y[from + k] * (0.5 - 0.5 * Math.cos(2 * Math.PI * k / (len - 1)));
  fft(re, im);
  const mag = new Float64Array(N / 2);
  for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
  return { mag, binHz: sr / N };
}
// the strongest peak inside [fLo, fHi], parabolic-interpolated on the dB
// magnitude; prominence against the band's median
function peakIn(S, fLo, fHi) {
  const k0 = Math.max(1, Math.floor(fLo / S.binHz)), k1 = Math.min(S.mag.length - 2, Math.ceil(fHi / S.binHz));
  let kb = k0;
  for (let k = k0; k <= k1; k++) if (S.mag[k] > S.mag[kb]) kb = k;
  const db = k => 20 * Math.log10(S.mag[k] + 1e-20);
  const a = db(kb - 1), b = db(kb), c = db(kb + 1);
  const den = a - 2 * b + c;
  const d = den !== 0 ? 0.5 * (a - c) / den : 0;
  const band = [];
  for (let k = k0; k <= k1; k++) band.push(S.mag[k]);
  band.sort((x, y) => x - y);
  const med = band[band.length >> 1] || 1e-20;
  return { hz: (kb + d) * S.binHz, db: b, prominence: b - 20 * Math.log10(med + 1e-20) };
}

// ---- WAV and PNG -----------------------------------------------------------
function wavBytes(y, sr) {
  const n = y.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let k = 0; k < n; k++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(y[k] * 32767))), 44 + 2 * k);
  return buf;
}
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function pngBytes(w, h, rgb) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + 3 * w));
  for (let y = 0; y < h; y++) { raw[y * (1 + 3 * w)] = 0; rgb.copy(raw, y * (1 + 3 * w) + 1, y * 3 * w, (y + 1) * 3 * w); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// a log-frequency spectrogram (20 Hz .. 8 kHz), 80 dB of range, with the
// expected firing frequency traced in white dots when `firing(t)` is given
// (and any `traces: [f(t)]`, SND-PROP's BPF beside it)
function spectrogramPng(y, sr, opts) {
  const o = opts || {};
  const W = o.width || 512, H = o.height || 200, win = 4096, fLo = 20, fHi = 8000;
  const hop = Math.max(1, Math.floor((y.length - win) / W));
  const cols = [];
  let top = -1e9;
  for (let x = 0; x < W; x++) {
    const from = Math.min(y.length - win, x * hop);
    const S = spectrum(y, from, win, sr, win);
    const col = new Float32Array(H);
    for (let r = 0; r < H; r++) {
      const f = fLo * Math.pow(fHi / fLo, 1 - r / (H - 1));
      const k = f / S.binHz, k0 = Math.floor(k), fr = k - k0;
      const m = S.mag[k0] * (1 - fr) + S.mag[Math.min(S.mag.length - 1, k0 + 1)] * fr;
      col[r] = 20 * Math.log10(m + 1e-12);
      if (col[r] > top) top = col[r];
    }
    cols.push(col);
  }
  const rgb = Buffer.alloc(W * H * 3);
  const ramp3 = v => {        // black -> purple -> orange -> pale yellow
    const st = [[0, 0, 4], [87, 16, 110], [188, 55, 84], [249, 142, 9], [252, 255, 164]];
    const u = Math.max(0, Math.min(0.9999, v)) * (st.length - 1), i = Math.floor(u), f = u - i;
    return st[i].map((c, j) => Math.round(c + (st[i + 1][j] - c) * f));
  };
  for (let x = 0; x < W; x++) for (let r = 0; r < H; r++) {
    // 2 dB steps: a 40-colour image, which deflates to a fraction of a smooth one
    const c = ramp3(Math.round((cols[x][r] - (top - 80)) / 2) / 40);
    const p = (r * W + x) * 3; rgb[p] = c[0]; rgb[p + 1] = c[1]; rgb[p + 2] = c[2];
  }
  // the expected frequencies, dotted: `firing` in white, then `traces` (SND-PROP: the BPF, the firing) in
  // white and cyan, offset so two traces on the same number stay readable
  const tr = (o.firing ? [o.firing] : []).concat(o.traces || []);
  tr.forEach((fn, j) => { for (let x = j; x < W; x += 3 + j) {
    const f = fn((Math.min(y.length - win, x * hop) + win / 2) / sr);
    if (!(f > fLo && f < fHi)) continue;
    const r = Math.round((1 - Math.log(f / fLo) / Math.log(fHi / fLo)) * (H - 1));
    const p = (r * W + x) * 3; rgb[p] = j ? 0 : 255; rgb[p + 1] = rgb[p + 2] = 255;
  } });
  // octave ticks on the left edge (31.25 Hz .. 8 kHz)
  for (let f = 31.25; f <= fHi; f *= 2) {
    const r = Math.round((1 - Math.log(f / fLo) / Math.log(fHi / fLo)) * (H - 1));
    for (let x = 0; x < 8; x++) { const p = (r * W + x) * 3; rgb[p] = rgb[p + 1] = rgb[p + 2] = 200; }
  }
  return pngBytes(W, H, rgb);
}

const stats = y => {
  let pk = 0, ss = 0, sum = 0;
  for (let k = 0; k < y.length; k++) { const a = Math.abs(y[k]); if (a > pk) pk = a; ss += y[k] * y[k]; sum += y[k]; }
  return { peak: pk, rms: Math.sqrt(ss / y.length), mean: sum / y.length };
};

// ---- the evidence ----------------------------------------------------------
const PLAN = [
  ['sweep', {}], ['runup', {}], ['start', {}],
];
const EXTRA = { cub: [['starve', {}]], cessna: [['hot', {}]], twin582: [['runup', { engines: [0, 1], tag: 'runup_twin' }]] };

function ffmpegOk() {
  try { execFileSync('ffmpeg', ['-hide_banner', '-version'], { stdio: 'ignore' }); return true; } catch (e) { return false; }
}

function main() {
  const argv = process.argv.slice(2);
  const only = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  const keepWav = argv.includes('--wav') || !ffmpegOk();
  const sr = 48000;
  const W = loadWorklet(sr);
  const names = (argv.find(a => a.startsWith('--names=')) || '').slice(8).split(',').filter(Boolean);
  const outDir = argv.find(a => a.startsWith('--out=')) ? at(argv.find(a => a.startsWith('--out=')).slice(6)) : OUT_DIR;
  const builds = VALIDATED.filter(v => !only.length || only.includes(v.key)).map(loadBuild);

  if (argv.includes('--calibrate')) {
    for (const B of builds) {
      const cfg = B.configs[0];
      const v = makeVoice(W, cfg, 1, 0.5);
      const r = renderVoice(v, 4, (t, p) => { p.rpm = cfg.ratedRpm; p.load = 1; p.running = 1; });
      const s = stats(r.y.subarray(r.y.length / 2));
      console.log(`${B.key.padEnd(13)} gain ${cfg.gain}  full-power peak ${s.peak.toFixed(3)} rms ${s.rms.toFixed(4)}`);
    }
    return;
  }
  if (argv.includes('--bench')) {
    for (const B of builds) {
      const cfg = B.configs[0];
      const v = makeVoice(W, cfg, 1, 0.5);
      renderVoice(v, 3, (t, p) => { p.rpm = cfg.ratedRpm * 0.9; p.load = 0.8; p.running = 1; });
      const t0 = process.hrtime.bigint();
      const blocks = 4000;
      renderVoice(v, blocks * BLOCK / sr, (t, p) => { p.rpm = cfg.ratedRpm * 0.9; p.load = 0.8; p.running = 1; });
      const ms = Number(process.hrtime.bigint() - t0) / 1e6 / blocks;
      console.log(`${B.key.padEnd(13)} ${cfg.cyl} cyl  ${ms.toFixed(4)} ms per 128-frame block (${(ms / (BLOCK / sr * 1000) * 100).toFixed(1)} % of real time at ${sr} Hz)`);
    }
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'snd-engine-'));
  const made = [];
  for (const B of builds) {
    const plan = PLAN.concat(EXTRA[B.key] || []);
    for (const [scene, o] of plan) {
      // the Jodel flies the Cub's A-65, and at V = 0 the solver's rpm law does
      // not see the prop: its own seed at least makes it its own engine
      const name = `${B.key}_${o.tag || scene}`;
      if (names.length && !names.includes(name)) continue;
      const r = renderScene(W, B, scene, Object.assign({ seed: B.key === 'jodel' ? 2 : 1 }, o));
      const s = stats(r.y);
      const cfg = B.configs[0];
      // the expected firing frequency, traced on the spectrogram from the
      // voice's own rpm (its control output)
      const firing = t => {
        const b = Math.min(r.ctlE.length - 1, Math.floor(t * sr / BLOCK));
        return r.ctlE[b] / 60 * cfg.firingPerRev;
      };
      fs.writeFileSync(path.join(outDir, name + '.png'), spectrogramPng(r.y, sr, { firing }));
      const wav = path.join(keepWav ? outDir : tmp, name + '.wav');
      if (keepWav) {
        // <= 1 MB: 22.05 kHz 16-bit mono would still be 44 kB/s; decimate by 2
        const half = new Float32Array(r.y.length >> 1);
        for (let k = 0; k < half.length; k++) half[k] = 0.5 * (r.y[2 * k] + r.y[2 * k + 1]);
        fs.writeFileSync(wav, wavBytes(half, sr / 2));
      } else {
        fs.writeFileSync(wav, wavBytes(r.y, sr));
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
          '-c:a', 'libopus', '-b:a', '48k', '-application', 'audio',
          path.join(outDir, name + '.ogg')]);
        fs.unlinkSync(wav);
      }
      made.push({ name, scene, peak: s.peak, rms: s.rms });
      console.log(`${name.padEnd(24)} ${r.y.length / sr}s  peak ${s.peak.toFixed(3)}  rms ${s.rms.toFixed(4)}`);
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return made;
}

module.exports = { VALIDATED, SCENES, BLOCK, loadWorklet, makeVoice, renderVoice, loadBuild,
                   renderScene, fft, spectrum, peakIn, wavBytes, pngBytes, spectrogramPng,
                   stats, WORKLET, ROOT };
if (require.main === module) main();
