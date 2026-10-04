#!/usr/bin/env node
// THE OFFLINE AIRFRAME RENDER (SND-AIRFRAME, G1634; SOUND-2026-10-04 §8).
//
// The airframe voice (src/viewer/audio/airframe_worklet.js, the file the browser loads) run in node under
// render.js's worklet shim, DRIVEN BY THE REAL SOLVER: each scene flies a validated build with makeSim on a stub
// world (flat ground of one GROUND_SURF row, or a lake), and every 16 ms frame goes the way the page's does -
// audio_params.js fills the block from the sim, airframe_model.js turns it into the layer targets and the events,
// the targets reach the worklet's k-rate params as setTargetAtTime(tau 30 ms) would (a one-pole per block), the
// events as its port messages. SND-ENGINE's voice rides along (rpm / load / running from the same block) for
// the MIX renders, through src_engine's placeholder cabin low-pass on the interior side.
//
//   node tools/audio/airframe_render.js                renders + encodes the evidence (reports/evidence/SND-AIRFRAME/)
//   node tools/audio/airframe_render.js --only=cub_taxi_grass,cessna_stall
//   node tools/audio/airframe_render.js --wav          keep WAVs instead of Opus
//   node tools/audio/airframe_render.js --bench        ms per 128-frame block: idle, cruise wind, a take-off roll, everything
//
// Also a library: GATE AUDIO (tools/audio/_audio_check.js) drives the model and the worklet through it.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const R = require('./render.js');

const ROOT = R.ROOT;
const at = p => path.join(ROOT, p);
const AIRFRAME = at('src/viewer/audio/airframe_worklet.js');
const OUT_DIR = at('reports/evidence/SND-AIRFRAME');
const BLOCK = R.BLOCK, SR = 48000, FRAME_BLOCKS = 6, FRAME_DT = FRAME_BLOCKS * BLOCK / SR;   // 16 ms frames
let FC = null;
const core = () => FC || (FC = require(at('tools/flight_core.js')));
const AP = () => require(at('src/viewer/audio/audio_params.js'));
const AFM = () => require(at('src/viewer/audio/airframe_model.js'));

// ---- the worklet --------------------------------------------------------------------------------------------
function loadAirframe(sr, file) {
  const L = R.loadWorklet(sr || SR, file || AIRFRAME);
  return { Processor: L.registry['flydiy-airframe'], lib: L.lib, sr: L.sr };
}
function makeAirframe(AW, seed) {
  const proc = new AW.Processor({ processorOptions: { seed: seed || 7 } });
  const params = {};
  for (const d of AW.Processor.parameterDescriptors) params[d.name] = new Float32Array([d.defaultValue]);
  return { proc, params, names: AW.Processor.parameterDescriptors.map(d => d.name), inputs: [],
           outputs: [[new Float32Array(BLOCK)], [new Float32Array(BLOCK)]], sr: AW.sr };
}

// ---- the worlds -----------------------------------------------------------------------------------------------
// flat ground of one surface row (x < split: row a, beyond: row b), or a lake (bed 20 m down)
function landWorld(row, split, row2) {
  return { terrainH: () => 0, surface: (x) => (split != null && x < split ? row2 : row), waterH: () => -1e9,
           treesNear: () => [], trees: [] };
}
function lakeWorld() {
  return { terrainH: () => -20, surface: () => 4, waterH: () => 0, treesNear: () => [], trees: [] };
}

// ---- placing the aeroplane: the lowest contact `h` above the surface, V forward (-x), vs, pitched up by `pitch` ----
function place(sim, def, o) {
  const p = sim.p, v = sim.v, n = sim.n;
  let cx = 0, cy = 0, M = 0;
  for (let i = 0; i < n; i++) { cx += p[i * 3] * sim.m[i]; cy += p[i * 3 + 1] * sim.m[i]; M += sim.m[i]; }
  cx /= M; cy /= M;
  const th = o.pitch || 0, c = Math.cos(th), s = Math.sin(th);
  for (let i = 0; i < n; i++) {
    const dx = p[i * 3] - cx, dy = p[i * 3 + 1] - cy;
    p[i * 3] = cx + dx * c + dy * s; p[i * 3 + 1] = cy - dx * s + dy * c;
  }
  const ids = def.refs.mains.concat(def.refs.tw != null && def.refs.tw >= 0 ? [def.refs.tw] : []);
  let low = Infinity;
  for (const i of ids) low = Math.min(low, p[i * 3 + 1] - (sim.r ? sim.r[i] : 0));
  const dy = (o.ground || 0) + o.h - low;
  for (let i = 0; i < n; i++) { p[i * 3 + 1] += dy; v[i * 3] = -(o.V || 0); v[i * 3 + 1] = o.vs || 0; v[i * 3 + 2] = 0; }
}

// ---- the scenes -------------------------------------------------------------------------------------------------
const B = {
  cub: 'builds/cub_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json',
  floats: 'tools/fixtures/build_v10_c172_wipline2350_2026-09-20.json',
};
const ramp = (t, t0, t1, a, b) => t <= t0 ? a : t >= t1 ? b : a + (b - a) * (t - t0) / (t1 - t0);
const SCENES = {
  // the Cub taxis across grass, a stretch of gravel, back on grass; brakes at the end
  cub_taxi_grass: { build: 'cub', seconds: 22, cam: 'cockpit', world: () => landWorld(0, -25, 6),
    label: "the user's Cub taxiing: grass, then a gravel stretch (x < -25 m), braked to a stop",
    init: (sim) => { sim.ctl.thr = 0; },
    frame: (sim, t) => { sim.ctl.thr = t < 1 ? 0 : t < 17 ? 0.5 : 0; sim.ctl.de = 0.3; sim.ctl.brake = t > 17 ? 0.8 : 0; } },
  // the Cub's take-off roll on grass, tail up, lift-off, the climb
  cub_takeoff: { build: 'cub', seconds: 20, cam: 'chase', world: () => landWorld(0),
    label: "the user's Cub taking off from grass: full throttle, tail up, lift-off ~11 s, climbing",
    init: (sim) => { sim.ctl.thr = 0; },
    frame: (sim, t) => { sim.ctl.thr = ramp(t, 0.5, 2, 0, 1); sim.ctl.de = t < 4 ? -0.15 : t < 9 ? 0 : 0.3; } },
  // a firm three-point arrival on grass: 2.4 m/s sink, idle, held off, the roll-out braked
  cub_firm_landing: { build: 'cub', seconds: 12, cam: 'chase', world: () => landWorld(0),
    label: "the user's Cub arriving firm on grass: 2.4 m/s sink at 1.15 Vs, three-point, braked roll-out",
    init: (sim, def) => { place(sim, def, { h: 1.2, V: 18.5, vs: -2.4, pitch: 0.16 }); sim.ctl.thr = 0; },
    frame: (sim, t) => { sim.ctl.thr = 0; sim.ctl.de = 0.35; sim.ctl.brake = t > 4 ? 0.6 : 0; } },
  // the Cessna on a paved runway: the mains first at speed (the chirp), the nose down, brakes to a walk (the squeal)
  cessna_paved_landing: { build: 'cessna', seconds: 18, cam: 'cockpit', world: () => landWorld(5),
    label: 'the Cessna 172 landing on paved: mains first at 27 m/s (the chirp), the nose down, braked to a walk (the squeal)',
    init: (sim, def) => { place(sim, def, { h: 1.0, V: 27, vs: -1.6, pitch: 0.12 }); sim.ctl.thr = 0; },
    frame: (sim, t) => { sim.ctl.thr = 0; sim.ctl.de = t < 2 ? 0.25 : 0; sim.ctl.brake = t > 4 ? 0.7 : 0; } },
  // the Cessna slowed toward the stall at altitude: flaps down (the motor), idle, back pressure - the reed moans in
  cessna_stall: { build: 'cessna', seconds: 24, cam: 'cockpit', world: () => landWorld(5),
    label: 'the Cessna 172 at 600 m: flaps to 30 % (the motor), idle, a slow pull into the stall - the reed horn moans in, the buffet',
    init: (sim, def) => { place(sim, def, { h: 600, V: 36, vs: 0, pitch: 0.03 }); sim.ctl.thr = 0.35; },
    frame: (sim, t) => { sim.ctl.thr = t < 3 ? 0.35 : 0; sim.ctl.flap = ramp(t, 1, 3, 0, 0.3); sim.ctl.de = ramp(t, 4, 20, 0.05, 0.85); } },
  // the Cessna on Wipline floats: idle taxi, power up, the hump, on the step, power back
  floats_step_taxi: { build: 'floats', seconds: 26, cam: 'chase', world: () => lakeWorld(),
    label: 'the Cessna on Wipline floats: idle taxi, full power, over the hump onto the step, power back, off the step',
    init: (sim, def) => { place(sim, def, { h: -0.22, V: 0, vs: 0, ground: 0 }); sim.ctl.thr = 0; },   // at its draft: afloat from the first frame
    frame: (sim, t) => { sim.ctl.thr = t < 4 ? 0.15 : t < 18 ? 1 : 0.1; sim.ctl.de = t < 12 ? 0.3 : -0.05; } },
  // the floats landing on the lake
  floats_water_landing: { build: 'floats', seconds: 16, cam: 'chase', world: () => lakeWorld(),
    label: 'the Cessna on floats landing on the lake: 1.3 m/s sink at 25 m/s, the splash, the run-off on the step, settling',
    init: (sim, def) => { place(sim, def, { h: 1.2, V: 25, vs: -1.3, pitch: 0.08, ground: 0 }); sim.ctl.thr = 0; },
    frame: (sim, t) => { sim.ctl.thr = 0; sim.ctl.de = 0.15; } },
};

// ---- the driver ----------------------------------------------------------------------------------------------------
const builds = {};
function buildOf(key) {
  if (builds[key]) return builds[key];
  const C = core();
  const spec = JSON.parse(fs.readFileSync(at(B[key]), 'utf8')).spec;
  const def = C.buildGen(JSON.parse(JSON.stringify(spec)));
  return (builds[key] = { key, spec, def });
}

// run a scene: the solver, the block, the model, the worklet (and the engine for the mix). opts: {seconds, engine,
// seed, onFrame(f), mutate: {model} }. Returns the outputs, the per-frame log and the events.
function runScene(name, opts) {
  const o = opts || {};
  const S = typeof name === 'string' ? SCENES[name] : name;
  const C = core(), A = AP(), M = o.model || AFM();
  const bd = buildOf(S.build), def = bd.def, world = S.world();
  const sim = C.makeSim(def, world);
  sim.reset(0);
  if (S.init) S.init(sim, def);
  const AW = o.AW || loadAirframe(SR), voice = makeAirframe(AW, o.seed || 7);
  const P = A.audioParamsBlock(), st = M.airframeState();
  const cam = { mode: S.cam, inGarage: false, held: false, p: new Float64Array(3) };
  const seconds = o.seconds || S.seconds, nF = Math.ceil(seconds / FRAME_DT), N = nF * FRAME_BLOCKS * BLOCK;
  const ext = new Float32Array(N), int = new Float32Array(N);
  let eng = null, engMixE = null, engMixI = null;
  if (o.engine !== false) {
    const EC = require(at('src/viewer/audio/engine_config.js'));
    const EW = R.loadWorklet(SR);
    const cfg = EC.engineSoundConfig(bd.spec, 0, C.POWERPLANTS);
    eng = R.makeVoice(EW, cfg, 1, 0.6, { running: 1, rpm: cfg.idleRpm });
    engMixE = new Float32Array(N); engMixI = new Float32Array(N);
  }
  const names = voice.names, cur = new Float64Array(names.length), Q = M.AF_Q;
  for (let i = 0; i < names.length; i++) cur[i] = voice.params[names[i]][0];
  const kTau = 1 - Math.exp(-(BLOCK / SR) / 0.03);
  const log = [], events = [];
  let cabLP = 0;
  const cCab = 1 - Math.exp(-2 * Math.PI * 1400 / SR);
  for (let f = 0; f < nF; f++) {
    const t = f * FRAME_DT;
    if (S.frame) S.frame(sim, t, def);
    sim.step(FRAME_DT);
    A.audioParams(sim, cam, def, P, world, FRAME_DT);
    const tg = M.airframeStep(P, st, FRAME_DT);
    for (let k = 0; k < st.evN[0]; k++) {
      const e = st.ev.slice(k * M.EV_W, k * M.EV_W + 4);
      events.push({ t: +(t + FRAME_DT).toFixed(3), type: M.AF_EV_NAMES[e[0]], e: e[0], sev: +e[1].toFixed(3), a: e[2], b: e[3],
                    vs: +P.s[P.I.vs].toFixed(2), Vg: +P.s[P.I.Vg].toFixed(2) });
      voice.proc.message({ t: 'ev', e: e[0], s: e[1], a: e[2], b: e[3], k: 0 });
    }
    st.evN[0] = 0;
    const I = P.I, s = P.s;
    log.push({ t, V: s[I.V], Vg: s[I.Vg], vs: s[I.vs], alpha: s[I.alpha], aStall: s[I.aStall], nz: s[I.nz],
               main0: s[I.main0], main1: s[I.main1], tail: s[I.tail], water: s[I.water], surf0: s[I.surf0], flap: s[I.flap],
               tg: Array.from(tg) });
    if (o.onFrame) o.onFrame({ f, t, P, st, tg, sim });
    for (let b = 0; b < FRAME_BLOCKS; b++) {
      for (let i = 0; i < names.length; i++) {
        const q = Q[names[i]];
        cur[i] = q === 0 ? tg[i] : cur[i] + (tg[i] - cur[i]) * kTau;
        voice.params[names[i]][0] = cur[i];
      }
      voice.proc.process(voice.inputs, voice.outputs, voice.params);
      const off = (f * FRAME_BLOCKS + b) * BLOCK;
      ext.set(voice.outputs[0][0], off); int.set(voice.outputs[1][0], off);
      if (eng) {
        const ep = eng.params;
        ep.rpm[0] = P.rpmEng[0]; ep.load[0] = P.running[0] > 0 ? P.thr[0] : 0; ep.running[0] = P.running[0];
        ep.starter[0] = P.crank[0] > 0 ? 1 : 0; ep.starve[0] = 0; ep.cold[0] = 0;
        eng.proc.process(eng.inputs, eng.outputs, ep);
        const y = eng.outputs[0][0];
        for (let k = 0; k < BLOCK; k++) {
          cabLP += (y[k] - cabLP) * cCab;
          engMixE[off + k] = y[k] + ext[off + k];
          engMixI[off + k] = cabLP + int[off + k];
        }
      }
    }
  }
  return { name: typeof name === 'string' ? name : 'scene', S, def, ext, int, mixE: engMixE, mixI: engMixI, log, events,
           stats: Array.from(voice.proc.stats), sr: SR, kind: st.kindSource };
}

// ---- the evidence ---------------------------------------------------------------------------------------------------
function ffmpegOk() { try { execFileSync('ffmpeg', ['-hide_banner', '-version'], { stdio: 'ignore' }); return true; } catch (e) { return false; } }
function encode(y, file, keepWav, tmp) {
  const wav = path.join(keepWav ? OUT_DIR : tmp, path.basename(file) + '.wav');
  fs.writeFileSync(wav, R.wavBytes(y, SR));
  if (keepWav) return;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-c:a', 'libopus', '-b:a', '40k',
                          '-application', 'audio', file + '.ogg']);
  fs.unlinkSync(wav);
}
const db = x => (20 * Math.log10(x + 1e-9)).toFixed(1);

function main() {
  const argv = process.argv.slice(2);
  const only = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  if (argv.includes('--bench')) return bench();
  const keepWav = argv.includes('--wav') || !ffmpegOk();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'snd-airframe-'));
  const summary = {};
  for (const name of Object.keys(SCENES)) {
    if (only.length && !only.includes(name)) continue;
    const r = runScene(name);
    const base = path.join(OUT_DIR, name);
    encode(r.ext, base + '_ext', keepWav, tmp);
    encode(r.int, base + '_int', keepWav, tmp);
    const mix = r.S.cam === 'cockpit' ? r.mixI : r.mixE;
    encode(mix, base + '_mix_' + (r.S.cam === 'cockpit' ? 'int' : 'ext'), keepWav, tmp);
    fs.writeFileSync(base + '_ext.png', R.spectrogramPng(r.ext, SR, { width: 512, height: 160 }));
    fs.writeFileSync(base + '_int.png', R.spectrogramPng(r.int, SR, { width: 512, height: 160 }));
    const se = R.stats(r.ext), si = R.stats(r.int);
    // the moments worth a line: contacts, the horn's onset, the step
    const notes = [];
    let pc = -1, horn = 0, step = -1;
    for (const L of r.log) {
      const c = (L.main0 ? 'L' : '-') + (L.main1 ? 'R' : '-') + (L.tail ? 'T' : '-');
      if (c !== pc) { notes.push(`${L.t.toFixed(2)} s contacts ${c} (Vg ${L.Vg.toFixed(1)} m/s, vs ${L.vs.toFixed(2)})`); pc = c; }
      const sw = L.tg[AFM().T.stall];
      if (!horn && sw > 0) { horn = 1; notes.push(`${L.t.toFixed(2)} s stall warning on: alpha ${L.alpha.toFixed(3)} rad vs stall ${L.aStall.toFixed(3)} (V ${L.V.toFixed(1)} m/s)`); }
      const ws = L.tg[AFM().T.watStep];
      if (ws !== step && L.water) { notes.push(`${L.t.toFixed(2)} s ${ws ? 'ON the step' : 'off the step (displacement)'} at ${L.Vg.toFixed(1)} m/s`); step = ws; }
    }
    summary[name] = { label: r.S.label, seconds: r.S.seconds, kind: r.kind, cam: r.S.cam,
      ext: { peak: +se.peak.toFixed(3), rmsDb: db(se.rms) }, int: { peak: +si.peak.toFixed(3), rmsDb: db(si.rms) },
      events: r.events, notes, guarded: r.stats[2], nan: r.stats[1] };
    console.log(`${name.padEnd(22)} ${r.S.seconds}s  ext peak ${se.peak.toFixed(3)} rms ${db(se.rms)} dB  int peak ${si.peak.toFixed(3)} rms ${db(si.rms)} dB  events ${r.events.length}  guarded ${r.stats[2]}`);
    for (const e of r.events) console.log(`    ${e.t.toFixed(2)} s ${e.type.padEnd(9)} sev ${e.sev.toFixed(2)} wheel ${e.a} row ${e.b}  (vs ${e.vs}, Vg ${e.Vg})`);
    for (const n of notes) console.log('    ' + n);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
  return summary;
}

// the cost per 128-frame block, per state
function bench() {
  const AW = loadAirframe(SR), v = makeAirframe(AW, 3);
  const states = {
    idle: {},
    cruiseWind: { windL: 0.02, windI: 0.015, windF: 1650, windT: 0.1 },
    takeoffRoll: { windL: 0.005, windI: 0.004, windF: 700, gndL: 0.04, gndS: 0, gndV: 15, tailR: 0.3 },
    floatsStep: { windL: 0.006, windI: 0.005, windF: 800, watL: 0.05, watV: 15, watStep: 1, watSlap: 1 },
    everything: { windL: 0.02, windI: 0.015, windF: 1650, windT: 0.3, gndL: 0.04, gndS: 6, gndV: 15, tailR: 0.5, brk: 0.5,
                  watL: 0.05, watV: 15, watSlap: 1, watDrag: 0.5, stall: 0.7, stallK: 1, creak: 1, flapM: 1 },
  };
  for (const k in states) {
    for (const n of v.names) v.params[n][0] = n === 'windF' ? 250 : 0;
    for (const n in states[k]) v.params[n][0] = states[k][n];
    for (let i = 0; i < 3000; i++) v.proc.process(v.inputs, v.outputs, v.params);
    const blocks = 20000, t0 = process.hrtime.bigint();
    for (let i = 0; i < blocks; i++) { if (k === 'everything' && i % 400 === 0) v.proc.message({ t: 'ev', e: 1 + (i / 400) % 5, s: 0.6, a: 0, b: 5 }); v.proc.process(v.inputs, v.outputs, v.params); }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / blocks;
    console.log(`${k.padEnd(12)} ${ms.toFixed(4)} ms per 128-frame block (${(ms / (BLOCK / SR * 1000) * 100).toFixed(2)} % of real time at ${SR} Hz)`);
  }
}

module.exports = { SCENES, B, SR, FRAME_DT, FRAME_BLOCKS, AIRFRAME, OUT_DIR, loadAirframe, makeAirframe, landWorld, lakeWorld,
                   place, buildOf, runScene, bench };
if (require.main === module) main();
