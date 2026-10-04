#!/usr/bin/env node
// THE OFFLINE ENGINE + PROP RENDER (SND-PROP, G1622; SOUND-2026-10-04 §8). A sibling of render.js (SND-ENGINE's),
// built on its shim, FFT, WAV and spectrogram writers.
//
// Each engine is a CHAIN as the page wires it: the driver voice ('flydiy-engine' from engine_worklet.js, or
// 'flydiy-turbine' / 'flydiy-electric' from prop_worklet.js), its control output (engine rpm, prop rpm) handed
// BY REFERENCE as the prop node's input 0, and 'flydiy-prop'. The scenes set what the solver would publish:
// prop rpm through its own law (00_registry.js genShaftRpm -> genEngineRpm, V-dependent, constant-speed on the
// PT6), thrust through its own law (30_solver.js: thr x max(0, Tstatic - kV2 V^2), sea level), V, alpha, beta.
//
//   node tools/audio/render_prop.js               renders + encodes the evidence (reports/evidence/SND-PROP/)
//   node tools/audio/render_prop.js --only=cub    one build
//   node tools/audio/render_prop.js --wav         keep WAVs instead of Opus
//   node tools/audio/render_prop.js --bench       ms per 128-frame block, per voice
//   node tools/audio/render_prop.js --calibrate   full-power static peak / RMS: engine, prop, the mix
//
// Also a library: the prop sections of GATE AUDIOENG (tools/audio/_prop_check.js) render through it.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const R = require('./render.js');

const ROOT = R.ROOT;
const at = p => path.join(ROOT, p);
const PROP_WORKLET = at('src/viewer/audio/prop_worklet.js');
const PCFG = require(at('src/viewer/audio/prop_config.js'));
const ECFG = require(at('src/viewer/audio/engine_config.js'));
const OUT_DIR = at('reports/evidence/SND-PROP');
const BLOCK = R.BLOCK;

// THE BUILDS: the six validated (GATE AUDIO's list) + a PT6 and an electric archetype
const clone = o => JSON.parse(JSON.stringify(o));
const PROP_BUILDS = [
  { key: 'cub', file: 'builds/cub_2026-09-20_corrected.json', label: "the user's Cub (A-65, direct drive, 2 blades 1.91 m)", vr: 22, vy: 28 },
  { key: 'jodel', file: 'builds/jodel_2026-09-20_corrected.json', label: 'the Jodel D112 (A-65, cruise-pitch prop 1.83 m)', vr: 24, vy: 30 },
  { key: 'cessna', file: 'builds/cessna172_2026-09-20_corrected.json', label: 'the Cessna 172 (custom flat four 5.9 L, 1.905 m alu)', vr: 28, vy: 37 },
  { key: 'cessnaMetal', file: 'tools/fixtures/build_v10_cessnaMetal_2026-09-26.json', label: 'the metal Cessna (O-540, 2.06 m)', vr: 30, vy: 40 },
  { key: 'cessnaFloats', file: 'tools/fixtures/build_v10_c172_wipline2350_2026-09-20.json', label: 'the Cessna on Wipline floats (O-540)', vr: 30, vy: 38 },
  { key: 'twin582', file: 'tools/fixtures/build_v7_ultralight_2026-09-05.json', label: 'the twin-582 (two Rotax 582, C-box 2.62)', vr: 20, vy: 25 },
  // THE PT6 ARCHETYPE: the metal Cessna's airframe on a PT6A-114A and its Hartzell three-blade (the Caravan's)
  { key: 'pt6', file: 'tools/fixtures/build_v10_cessnaMetal_2026-09-26.json', label: 'a PT6A-114A archetype (the Caravan engine, 3 blades 2.69 m)',
    vr: 33, vy: 45, mutate: s => { s.engines[0].type = 'pt6a114a_hartzell3'; delete s.engines[0].custom; delete s.engines[0].sound; s.prop.blades = 3; s.prop.D = 2.69; } },
  // THE ELECTRIC ARCHETYPE: the twin-boom fixture, a Pipistrel E-811 on 2 blades
  { key: 'electric', file: 'tools/fixtures/build_v8_twin-boom_2026-09-11.json', label: 'an electric archetype (Pipistrel E-811, the twin-boom fixture)', vr: 24, vy: 30 },
];

let FC = null;
const flightCore = () => FC || (FC = require(at('tools/flight_core.js')));
function loadPropBuild(entry) {
  const raw = JSON.parse(fs.readFileSync(at(entry.file), 'utf8'));
  const spec = clone(raw.spec || raw);
  if (entry.mutate) entry.mutate(spec);
  const C = flightCore();
  const def = C.buildGen(clone(spec));
  const nE = Math.max(1, def.params.nEngines || (spec.engines || []).length);
  const PP = C.POWERPLANTS[def.params.powerplant] || {};
  const EN = def.params.engine || PP.engine, PR = def.params.prop || PP.prop;
  const engines = [];
  for (let i = 0; i < nE; i++) {
    engines.push({ ecfg: ECFG.engineSoundConfig(spec, i, C.POWERPLANTS), pcfg: PCFG.propSoundConfig(spec, i, C.POWERPLANTS, PR) });
  }
  // the solver's laws, sea level
  const propRpm = (thr, running, V) => C.genShaftRpm(EN, PR, thr, V || 0, 1, 1, running);
  const engRpm = rp => C.genEngineRpm(EN, rp);
  const thrustAt = (thr, running, V) => running ? thr * Math.max(0, PR.Tstatic - PR.kV2 * V * V) : 0;
  return Object.assign({}, entry, { spec, def, nE, EN, PR, engines, propRpm, engRpm, thrustAt });
}

// ---- the worklets ------------------------------------------------------------
function loadAll(sr) {
  const E = R.loadWorklet(sr);
  const Pm = R.loadWorklet(sr, PROP_WORKLET);
  return { sr, E, P: Pm.registry['flydiy-prop'], T: Pm.registry['flydiy-turbine'], X: Pm.registry['flydiy-electric'], lib: Pm.lib };
}
const paramsOf = (Cls) => {
  const p = {};
  for (const d of Cls.parameterDescriptors) p[d.name] = new Float32Array([d.defaultValue]);
  return p;
};
// one engine's chain: driver + prop, the driver's control output IS the prop's input (the same arrays)
function makeChain(Wk, B, i, opts) {
  const o = opts || {};
  const eg = B.engines[i];
  const pc = Object.assign({}, eg.pcfg.prop, o.propCfg || {});
  let drv;
  const st = o.state || null;
  if (eg.pcfg.driver === 'piston') {
    drv = R.makeVoice(Wk.E, eg.ecfg, (o.seed || 1) + i * 7919, o.heat != null ? o.heat : 0.5, st);
    drv.kind = 'piston';
  } else {
    const Cls = eg.pcfg.driver === 'turbine' ? Wk.T : Wk.X;
    const proc = new Cls({ processorOptions: Object.assign({ config: eg.pcfg[eg.pcfg.driver], seed: (o.seed || 1) + i }, st || {}) });
    drv = { proc, params: paramsOf(Cls), outputs: [[new Float32Array(BLOCK)], [new Float32Array(BLOCK), new Float32Array(BLOCK)]],
            inputs: [], kind: eg.pcfg.driver };
  }
  const prop = new Wk.P({ processorOptions: { config: pc, seed: (o.seed || 1) + 101 * (i + 1) } });
  const pp = paramsOf(Wk.P);
  const pout = [[new Float32Array(BLOCK)], [new Float32Array(BLOCK), new Float32Array(BLOCK)]];
  const pin = o.unwired ? [[]] : [[drv.outputs[1][0], drv.outputs[1][1]]];
  return { B, i, drv, prop, pp, pout, pin, pcfg: pc, ecfg: eg.ecfg, driver: eg.pcfg.driver, cfgAll: eg.pcfg };
}

// the scene's state per block: p = { thr, V, alpha, beta, running, starter, interior, rpmOver?, thrustOver?, cold, starve }
function stepChain(ch, p) {
  const B = ch.B, run = p.running ? 1 : 0;
  const rp = p.rpmOver != null ? p.rpmOver : B.propRpm(p.thr, !!run, p.V);
  const re = p.rpmOver != null ? p.rpmOver * ch.pcfg.gear : B.engRpm(rp);
  const T = p.thrustOver != null ? p.thrustOver : B.thrustAt(p.thr, !!run, p.V);
  const d = ch.drv.params;
  if (ch.drv.kind === 'piston') {
    d.rpm[0] = re; d.load[0] = run ? p.thr : 0; d.running[0] = run; d.starter[0] = p.starter ? 1 : 0;
    d.starve[0] = p.starve || 0; d.cold[0] = p.cold || 0;
  } else {
    d.rpm[0] = rp; d.power[0] = run ? p.thr : 0; d.running[0] = run; d.starter[0] = p.starter ? 1 : 0;
  }
  ch.drv.proc.process(ch.drv.inputs, ch.drv.outputs, d);
  const q = ch.pp;
  q.rpm[0] = rp; q.thrust[0] = T; q.thr[0] = run ? p.thr : 0; q.c[0] = 340.3; q.V[0] = p.V || 0;
  q.alpha[0] = p.alpha || 0; q.beta[0] = p.beta || 0; q.interior[0] = p.interior || 0;
  ch.prop.process(ch.pin, ch.pout, q);
}

// render chains together for `seconds` under `scene(t, p)`: the mix, each part, and the control at block rate
function renderChains(chains, seconds, scene, sr) {
  const n = Math.ceil(seconds * sr / BLOCK) * BLOCK;
  const mix = new Float32Array(n), eng = new Float32Array(n), prop = new Float32Array(n);
  const tonal = new Float32Array(n), bb = new Float32Array(n);
  const nb = n / BLOCK;
  const ctlE = new Float32Array(nb), ctlP = new Float32Array(nb), Mh = new Float32Array(nb), snarl = new Float32Array(nb);
  const p = { thr: 0, V: 0, alpha: 0, beta: 0, running: 1, starter: 0, interior: 0 };
  for (let b = 0, o = 0; o < n; b++, o += BLOCK) {
    scene(o / sr, p);
    for (const ch of chains) {
      stepChain(ch, p);
      const de = ch.drv.outputs[0][0], dp = ch.pout[0][0], t0 = ch.pout[1][0], t1 = ch.pout[1][1];
      for (let k = 0; k < BLOCK; k++) {
        eng[o + k] += de[k]; prop[o + k] += dp[k]; mix[o + k] += de[k] + dp[k];
        tonal[o + k] += t0[k]; bb[o + k] += t1[k];
      }
    }
    const c0 = chains[0];
    ctlE[b] = c0.drv.outputs[1][0][BLOCK - 1] * 1000; ctlP[b] = c0.drv.outputs[1][1][BLOCK - 1] * 1000;
    Mh[b] = c0.prop.stats[1]; snarl[b] = c0.prop.stats[3];
  }
  return { y: mix, eng, prop, tonal, bb, ctlE, ctlP, Mh, snarl, sr };
}

// ---- the scenes ----------------------------------------------------------------
const ramp = (t, t0, t1, a, b) => t <= t0 ? a : t >= t1 ? b : a + (b - a) * (t - t0) / (t1 - t0);
const PSCENES = {
  // the static run-up: idle -> full -> idle, brakes on
  runup: { seconds: 13, state: () => ({ running: 1 }), scene: () => (t, p) => {
    p.thr = t < 6 ? ramp(t, 2, 4, 0, 1) : ramp(t, 8, 10, 1, 0);
    p.V = 0; p.alpha = 0; p.beta = 0; p.running = 1; p.starter = 0;
  } },
  // the take-off roll: full power, V rising to the rotation speed, the rotation (alpha), the initial climb
  takeoff: { seconds: 20, state: () => ({ running: 1 }), scene: (B) => (t, p) => {
    p.thr = ramp(t, 0.5, 2.5, 0.1, 1); p.running = 1; p.starter = 0;
    p.V = t < 2.5 ? 0 : t < 14 ? B.vr * Math.pow((t - 2.5) / 11.5, 0.8) : B.vr + (B.vy - B.vr) * Math.min(1, (t - 14) / 5);
    p.alpha = t < 14 ? 0.02 : ramp(t, 14, 15, 0.02, 0.14); p.beta = 0;
  } },
  // the climb: full power at Vy, alpha high, a climbing turn's sideslip coming and going (the "whop")
  climb: { seconds: 14, state: () => ({ running: 1 }), scene: (B) => (t, p) => {
    p.thr = 1; p.running = 1; p.starter = 0; p.V = B.vy;
    p.alpha = t < 3 ? 0.06 : ramp(t, 3, 5, 0.06, 0.2);
    p.beta = t < 7 ? 0 : 0.1 * Math.sin(Math.PI * (t - 7) / 3.5) * (t < 14 ? 1 : 0);
  } },
  // THE TIP-MACH SWEEP: a clipped long prop (2.3 m) on the Cub's engine pushed from 1800 to 3150 rpm static,
  // helical tip Mach ~0.64 -> ~1.12: the snarl, physically driven
  tipsweep: { seconds: 14, state: () => ({ running: 1, rpm: 1800 }), propCfg: { D: 2.3 },
    scene: () => (t, p) => {
      p.running = 1; p.starter = 0; p.V = 0; p.alpha = 0; p.beta = 0; p.thr = 1;
      p.rpmOver = t < 1 ? 1800 : t < 12 ? 1800 + 1350 * (t - 1) / 11 : 3150;
    } },
  // the key: silence, the starter, the catch / light-off, idle, a burst, the key off, the run-down (the prop
  // follows the driver's own spool)
  start: { seconds: 22, scene: () => (t, p) => {
    const crank = t >= 0.6 && t < 2.1, run = t >= 2.1 && t < 16;
    p.thr = run ? (t < 8 ? 0 : t < 11 ? ramp(t, 8, 8.8, 0, 0.6) : ramp(t, 11, 11.8, 0.6, 0)) : 0;
    p.running = run ? 1 : 0; p.starter = crank ? 1 : 0; p.V = 0; p.alpha = 0; p.beta = 0;
    p.cold = run ? 0.8 : 0;
  } },
  // the taxi: a whisker of throttle, walking pace: on the PT6 the governor holds Np, the blades flat (beta):
  // the low buzz; on a fixed-pitch prop just a slow idle
  taxi: { seconds: 12, state: () => ({ running: 1 }), scene: () => (t, p) => {
    p.thr = t < 6 ? 0.06 : ramp(t, 6, 7, 0.06, 0.15); p.running = 1; p.starter = 0;
    p.V = ramp(t, 0, 4, 0, 5); p.alpha = 0; p.beta = 0;
  } },
};

function renderPropScene(Wk, B, sceneKey, opts) {
  const o = opts || {};
  const S = PSCENES[sceneKey];
  const engines = o.engines || [0];
  const st = S.state ? S.state(B) : null;
  const chains = engines.map(i => {
    const state = st ? Object.assign({}, st) : null;
    if (state && state.running && state.rpm == null) {
      // a voice already turning at the scene's first rpm
      const p = { thr: 0, V: 0, alpha: 0, beta: 0, running: 1 };
      S.scene(B)(0, p);
      const rp = p.rpmOver != null ? p.rpmOver : B.propRpm(p.thr, true, p.V);
      state.rpm = B.engines[i].pcfg.driver === 'piston' ? (p.rpmOver != null ? rp * B.engines[i].pcfg.prop.gear : B.engRpm(rp)) : rp;
    }
    return makeChain(Wk, B, i, { seed: o.seed || 1, state, propCfg: Object.assign({}, S.propCfg || {}, o.propCfg || {}), unwired: o.unwired });
  });
  const r = renderChains(chains, o.seconds || S.seconds, S.scene(B), Wk.sr);
  r.chains = chains;
  return r;
}

// ---- the evidence ----------------------------------------------------------------
const PLAN = {
  cub: ['runup', 'takeoff', 'climb', 'start', 'tipsweep'],
  jodel: ['runup', 'takeoff', 'climb'],
  cessna: ['runup', 'takeoff', 'climb'],
  cessnaMetal: ['runup', 'takeoff', 'climb'],
  cessnaFloats: ['runup', 'takeoff', 'climb'],
  twin582: ['runup', 'takeoff', 'climb', 'runup_twin'],
  pt6: ['start', 'taxi', 'runup', 'takeoff', 'climb'],
  electric: ['start', 'taxi', 'runup', 'takeoff', 'climb'],
};

function ffmpegOk() { try { execFileSync('ffmpeg', ['-hide_banner', '-version'], { stdio: 'ignore' }); return true; } catch (e) { return false; } }

function main() {
  const argv = process.argv.slice(2);
  const only = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  const keepWav = argv.includes('--wav') || !ffmpegOk();
  const sr = 48000;
  const Wk = loadAll(sr);
  const builds = PROP_BUILDS.filter(b => !only.length || only.includes(b.key)).map(loadPropBuild);

  if (argv.includes('--calibrate')) {
    for (const B of builds) {
      const r = renderPropScene(Wk, B, 'runup', { seconds: 7 });
      const seg = a => R.stats(a.subarray(Math.floor(4.5 * sr), Math.floor(6 * sr)));
      const e = seg(r.eng), p = seg(r.prop), m = seg(r.y);
      console.log(`${B.key.padEnd(13)} full static  engine pk ${e.peak.toFixed(3)} rms ${e.rms.toFixed(4)}  prop pk ${p.peak.toFixed(3)} rms ${p.rms.toFixed(4)}  mix pk ${m.peak.toFixed(3)}  Mh ${r.Mh[Math.floor(5.5 * sr / BLOCK)].toFixed(3)}`);
    }
    return;
  }
  if (argv.includes('--bench')) {
    for (const B of builds) {
      const ch = makeChain(Wk, B, 0, { state: { running: 1, rpm: 2000 } });
      const p = { thr: 0.8, V: 30, alpha: 0.1, beta: 0.02, running: 1, starter: 0, interior: 0 };
      const time = (fn, blocks) => { const t0 = process.hrtime.bigint(); for (let b = 0; b < blocks; b++) fn(); return Number(process.hrtime.bigint() - t0) / 1e6 / blocks; };
      for (let b = 0; b < 2000; b++) stepChain(ch, p);
      const tAll = time(() => stepChain(ch, p), 4000);
      const tDrv = time(() => ch.drv.proc.process(ch.drv.inputs, ch.drv.outputs, ch.drv.params), 4000);
      console.log(`${B.key.padEnd(13)} ${ch.driver.padEnd(8)} driver ${tDrv.toFixed(4)} ms, prop ${(tAll - tDrv).toFixed(4)} ms per 128-frame block (${((tAll - tDrv) / (BLOCK / sr * 1000) * 100).toFixed(1)} % of real time)`);
    }
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'snd-prop-'));
  const made = [];
  for (const B of builds) {
    for (const tag of PLAN[B.key] || []) {
      const twin = tag === 'runup_twin';
      const scene = twin ? 'runup' : tag;
      const r = renderPropScene(Wk, B, scene, { seed: 1, engines: twin ? [0, 1] : [0] });
      const name = `${B.key}_${tag}`;
      const s = R.stats(r.y);
      const ch = r.chains[0];
      const at_ = (arr, t) => arr[Math.min(arr.length - 1, Math.floor(t * sr / BLOCK))];
      const traces = [t => at_(r.ctlP, t) / 60 * ch.pcfg.blades];
      if (ch.driver === 'piston' && ch.pcfg.gear > 1.01) traces.push(t => at_(r.ctlE, t) / 60 * ch.ecfg.firingPerRev);
      fs.writeFileSync(path.join(OUT_DIR, name + '.png'), R.spectrogramPng(r.y, sr, { traces }));
      const wav = path.join(keepWav ? OUT_DIR : tmp, name + '.wav');
      if (keepWav) {
        const half = new Float32Array(r.y.length >> 1);
        for (let k = 0; k < half.length; k++) half[k] = 0.5 * (r.y[2 * k] + r.y[2 * k + 1]);
        fs.writeFileSync(wav, R.wavBytes(half, sr / 2));
      } else {
        fs.writeFileSync(wav, R.wavBytes(r.y, sr));
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
          '-c:a', 'libopus', '-b:a', '48k', '-application', 'audio', path.join(OUT_DIR, name + '.ogg')]);
        fs.unlinkSync(wav);
      }
      let mhMax = 0; for (const v of r.Mh) if (v > mhMax) mhMax = v;
      made.push({ name, peak: s.peak, rms: s.rms, mhMax });
      console.log(`${name.padEnd(24)} ${(r.y.length / sr).toFixed(1)}s  peak ${s.peak.toFixed(3)}  rms ${s.rms.toFixed(4)}  max Mh ${mhMax.toFixed(2)}`);
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return made;
}

module.exports = { PROP_BUILDS, PSCENES, PROP_WORKLET, loadPropBuild, loadAll, makeChain, stepChain, renderChains,
                   renderPropScene, paramsOf, ramp };
if (require.main === module) main();
