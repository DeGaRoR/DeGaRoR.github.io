#!/usr/bin/env node
// GATE AUDIOENG — the engine part of GATE AUDIO (SND-ENGINE, G1613;
// SOUND-2026-10-04 §8). Node only, the worklet run under render.js's shim.
//
//   node tools/audio/_engine_check.js            every section, then every
//                                                 sabotage (each must go red)
//   node tools/audio/_engine_check.js --quick    the sections only
//   node tools/audio/_engine_check.js --only=3,6 those sections (and their sabotages)
//
// §1 CONFIG     the five validated builds -> cylinders, layout, stroke, gear,
//               firing per rev, an even firing order; the declared table
//               against the editor's own presets (no drift), the join's row
//               (CAGE_ENG_SOUND) equal to the table on every catalogue preset
// §2 FIRING     an FFT finds the firing frequency (rpm/60 x cyl/2, x cyl on a
//               two-stroke) within +-3 % at six rpm across idle..rated, every
//               validated engine, at 48 kHz and (two of them) at 44.1 kHz
// §3 HYGIENE    every scene of every engine: no NaN/Inf, no clipping (peak
//               < 0.9), no DC, no subnormal anywhere in the pipes or the
//               output; hostile parameters and a NaN in a pipe recover
// §4 ALLOC      process() allocates nothing (no GC, flat heap over 20 000
//               blocks through every state: run, crank, run-down, ticking)
// §5 SEED       a render is a function of its seed
// §6 LIFE       driven by the SOLVER (makeSim, setEngine's crank): the crank
//               at 100-300 rpm while the sim's rpm is 0, the catch's surge,
//               the run-down's inertia, the hot exhaust's ticks, the coughs
//               of starvation, idle rougher than cruise, prop = engine/gear,
//               the blower's whistle on a supercharged row only
// §7 CPU        ms per 128-frame block per voice (bound 1.0 ms)
// §8 INERT      the sound row is physics-inert: resolveSpec, buildGen and 4 s
//               of the solver bit-identical with and without it, on all five
// §9 REVIEW     the user's Engine Lab review (SND-ENGINE-2): the starter low,
//               toneless, 10 dB under the old whine, under the cranking engine,
//               the catch over the cranking; the ticks dry (< 5 ms), broadband,
//               under idle, the tick hook; the coughs 6 dB lower against the
//               running voice; the twin within +1 dB of one
// §P1-§P9      THE PROP, THE TURBINE, THE ELECTRIC MOTOR (SND-PROP, G1623):
//               tools/audio/_prop_check.js's sections, appended below (one
//               place per voice; run alone: node tools/audio/_prop_check.js)
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const R = require('./render.js');
const ROOT = R.ROOT;
const at = p => path.join(ROOT, p);
const CFGM = require(at('src/viewer/audio/engine_config.js'));
const C = require(at('tools/flight_core.js'));

const QUICK = process.argv.includes('--quick');
const ONLY = ((process.argv.find(a => a.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean);
const wanted = name => !ONLY.length || ONLY.includes(name.split(' ')[0].slice(1));
const SR = 48000;
const W48 = R.loadWorklet(SR), W44 = R.loadWorklet(44100);
const BUILDS = R.VALIDATED.map(R.loadBuild);
const clone = o => JSON.parse(JSON.stringify(o));

let fails = 0;
const log = s => console.log(s);

// ---- the sections: each returns [cond, label] rows; `brk` names a sabotage --
const EXPECT = {
  cub:          { cyl: 4, arch: 'flat',   two: 0, gear: 1,    fpr: 2, src: 'table' },
  jodel:        { cyl: 4, arch: 'flat',   two: 0, gear: 1,    fpr: 2, src: 'table' },
  cessna:       { cyl: 4, arch: 'flat',   two: 0, gear: 1,    fpr: 2, src: 'custom.name' },
  cessnaFloats: { cyl: 6, arch: 'flat',   two: 0, gear: 1,    fpr: 3, src: 'table' },
  twin582:      { cyl: 2, arch: 'inline', two: 1, gear: 2.62, fpr: 2, src: 'table' },
};

// the editor's own presets, loaded the way GATE ENGID loads them
let EDITOR = null;
function editor() {
  if (EDITOR) return EDITOR;
  global.window = globalThis;
  const AnyCls = function () {};
  globalThis.THREE = new Proxy({}, { get: () => AnyCls });
  require(at('tools/_eng_gen.js'));
  require(at('tools/_eng_mesh.js'));
  (0, eval)(fs.readFileSync(at('tools/_eng_page.js'), 'utf8'));
  window.COWL_GEN = { P: {} }; window.COWL_ROWS = []; window.CAGE_PAGE = {};
  globalThis.POWERPLANTS = C.POWERPLANTS;
  globalThis.CAGE_JOIN_ENGINES = require(at('tools/_cage_join.js')).CAGE_JOIN_ENGINES;
  (0, eval)(fs.readFileSync(at('tools/_cage_eng.js'), 'utf8'));
  EDITOR = window;
  return EDITOR;
}
const FANTASY = new Set(['flat twin', 'flat six']);

function secConfig(brk) {
  const rows = [];
  const T = CFGM.ENGINE_SOUND_TABLE;
  const saved = clone(T);
  try {
    if (brk === 'drift') T.o540_hartzell.cyl = 4;
    for (const B of BUILDS) {
      const spec = clone(B.spec);
      if (brk === 'parse' && B.key === 'cessna') spec.engines[0].custom.name = 'custom engine';
      for (let i = 0; i < spec.engines.length; i++) {
        const c = CFGM.engineSoundConfig(spec, i, C.POWERPLANTS);
        if (brk === 'firing' && i === 0) c.offsets[1] = (c.offsets[1] + 0.05) % 1;
        const X = EXPECT[B.key];
        rows.push([c.piston && c.cyl === X.cyl && c.arch === X.arch && c.twoStroke === X.two
                   && c.gear === X.gear && c.firingPerRev === X.fpr && c.source === X.src,
                   `${B.key}[${i}]: ${c.cyl} cyl ${c.arch} ${c.twoStroke ? 'two' : 'four'}-stroke, gear ${c.gear}, `
                   + `${c.firingPerRev} firings/rev, from ${c.source}`]);
        // the firing order: a permutation, evenly spaced (360/N or 720/N)
        const perm = c.firingOrder.slice().sort((a, b) => a - b).every((v, k) => v === k + 1);
        const so = c.offsets.slice().sort((a, b) => a - b);
        const even = so.every((v, k) => Math.abs(v - k / c.cyl) < 1e-3);
        rows.push([perm && even && c.offsets.length === c.cyl,
                   `${B.key}[${i}]: firing order ${c.firingOrder.join('-')} even (offsets ${c.offsets.join(', ')})`]);
      }
    }
    // a radial fires every other cylinder; two rows step N/2+2
    const r7 = CFGM.engineSoundFiringOrder('radial', 7, 0).map(c => c + 1).join('-');
    const r14 = CFGM.engineSoundFiringOrder('radial', 14, 0).map(c => c + 1).join('-');
    rows.push([r7 === '1-3-5-7-2-4-6' && r14 === '1-10-5-14-9-4-13-8-3-12-7-2-11-6',
               `radial orders: 7 -> ${r7}; 14 -> ${r14} (the R-1830's)`]);
    rows.push([CFGM.engineSoundConfig({ engines: [{ type: 'emrax268_carbon' }] }, 0, C.POWERPLANTS).piston === false,
               'an electric row has no piston voice']);
    // THE TABLE AGAINST THE EDITOR: every piston preset's cyl / arch / stroke /
    // displacement, and the join's sound row equal to it
    const E = editor();
    const PRESET_NAMES = Object.keys(E.ENG_PAGE.PRESETS).filter(n => n !== 'bare engine');
    let drift = [], joinBad = [], fantasyOwn = 0, n = 0;
    for (const name of PRESET_NAMES) {
      const key = globalThis.CAGE_JOIN_ENGINES[name];
      const P = Object.assign({}, E.CAGE_PAGE.defaults, { engOn: 1, engPreset: PRESET_NAMES.indexOf(name) });
      E.CAGE_ENG_APPLY_PRESET(P, name);
      const s = E.CAGE_ENG_SOUND(P);
      const pre = Object.assign(E.ENG_PAGE.engDefaults(), E.ENG_PAGE.PRESETS[name]);
      if (FANTASY.has(name)) { if (s && s.cyl === pre.cyl) fantasyOwn++; continue; }
      const t = T[key];
      const piston = !['electric', 'turbine'].includes(pre.arch);
      if (!piston) { if (t || s) drift.push(name); continue; }
      n++;
      const dispL = Math.PI / 4 * pre.bore * pre.bore * pre.stroke * pre.cyl * 1000;
      if (!t || t.cyl !== pre.cyl || t.arch !== pre.arch || t.twoStroke !== (pre.twoStroke ? 1 : 0)
          || Math.abs(t.dispL - dispL) > 0.006) drift.push(name);
      if (!s || !t || s.cyl !== t.cyl || s.arch !== t.arch || s.twoStroke !== t.twoStroke
          || Math.abs(s.dispL - t.dispL) > 0.011) joinBad.push(name);
    }
    rows.push([drift.length === 0 && n >= 25, `the declared table matches the editor's ${n} piston presets`
               + (drift.length ? ' — DRIFT: ' + drift.join(', ') : '')]);
    rows.push([joinBad.length === 0, `the join's sound row (CAGE_ENG_SOUND) equals the table on all ${n}`
               + (joinBad.length ? ' — DIFFER: ' + joinBad.join(', ') : '')]);
    rows.push([fantasyOwn === 2, 'the two fantasy presets get their OWN cylinders from the join (the table says A-65)']);
  } finally {
    for (const k of Object.keys(T)) T[k] = saved[k];
  }
  return rows;
}

// one held rpm: a voice already turning there, 0.6 s to fill the pipes, 2 s
// analysed (Hann, zero-padded to 2^17)
function firingAt(W, cfg, rpm, load) {
  const v = R.makeVoice(W, cfg, 3, 0.5, { running: 1, rpm });
  const r = R.renderVoice(v, 2.6, (t, p) => { p.rpm = rpm; p.load = load; p.running = 1; });
  const len = Math.floor(2.0 * W.sr);
  const S = R.spectrum(r.y, r.y.length - len, len, W.sr, 1 << 17);
  return S;
}
function secFiring(brk) {
  const rows = [];
  const set = brk ? BUILDS.filter(B => B.key === 'cub' || B.key === 'twin582') : BUILDS;
  const runs = [];
  for (const B of set) for (const W of (B.key === 'cub' || B.key === 'twin582') && !brk ? [W48, W44] : [W48]) runs.push([B, W]);
  for (const [B, W] of runs) {
    const cfg0 = B.configs[0];
    const cfg = clone(cfg0);
    if (brk === 'cyl') { cfg.cyl += 2; cfg.offsets = Array.from({ length: cfg.cyl }, (_, k) => k / cfg.cyl); }
    if (brk === 'stroke') cfg.twoStroke = cfg.twoStroke ? 0 : 1;
    const steps = brk ? [0, 3, 5] : [0, 1, 2, 3, 4, 5];
    const worst = { err: 0, prom: 1e9, txt: [] };
    for (const k of steps) {
      const rpm = cfg0.idleRpm + (cfg0.ratedRpm - cfg0.idleRpm) * k / 5;
      const f = rpm / 60 * cfg0.firingPerRev;
      const S = firingAt(W, cfg, rpm, k / 5);
      const pk = R.peakIn(S, 0.75 * f, 1.3 * f);
      const err = Math.abs(pk.hz / f - 1);
      worst.err = Math.max(worst.err, err); worst.prom = Math.min(worst.prom, pk.prominence);
      worst.txt.push(`${rpm.toFixed(0)}:${f.toFixed(1)}->${pk.hz.toFixed(1)}`);
    }
    rows.push([worst.err <= 0.03 && worst.prom >= 10,
               `${B.key} @${W.sr / 1000} kHz: firing peak within ${(worst.err * 100).toFixed(2)} % (<= 3), `
               + `prominence >= ${worst.prom.toFixed(0)} dB (>= 10) [${worst.txt.join(' ')}]`]);
  }
  return rows;
}

const isSub = x => x !== 0 && Math.abs(x) < 1.1754943508222875e-38;
function pipesOf(proc) {
  const out = [];
  const net = proc.net;
  const wg = w => { out.push(w.upper.data, w.lower.data); };
  for (const c of net.cylinders) { wg(c.cylinderWaveguide); wg(c.intakeWaveguide); wg(c.exhaustWaveguide); wg(c.extractorWaveguide); }
  wg(net.straightPipe); wg(net.outlet); for (const e of net.muffler.elements) wg(e);
  return out;
}
function hygiene(y, sr) {
  let finite = true, peak = 0, sub = 0, worstMean = 0, sum = 0;
  for (let k = 0; k < y.length; k++) {
    const v = y[k];
    if (!Number.isFinite(v)) finite = false;
    const a = Math.abs(v); if (a > peak) peak = a;
    if (isSub(v)) sub++;
    sum += v;
  }
  for (let o = 0; o + sr <= y.length; o += sr) {
    let s = 0; for (let k = o; k < o + sr; k++) s += y[k];
    worstMean = Math.max(worstMean, Math.abs(s / sr));
  }
  return { finite, peak, sub, worstMean, mean: Math.abs(sum / y.length) };
}
function secHygiene(brk) {
  const rows = [];
  const plan = [];
  for (const B of BUILDS) for (const sc of ['sweep', 'runup', 'start', 'starve', 'hot']) plan.push([B, sc, null]);
  plan.push([BUILDS[4], 'runup', { engines: [0, 1] }]);
  const use = brk ? plan.filter(p => p[0].key === 'cub' && p[1] === 'start') : plan;
  let bad = [], peakMax = 0, meanMax = 0, winMax = 0, n = 0;
  for (const [B, sc, o] of use) {
    const r = R.renderScene(W48, B, sc, Object.assign({ seed: 5 }, o || {}));
    const y = r.y;
    if (brk === 'nan') y[1000] = NaN;
    if (brk === 'clip') for (let k = 0; k < y.length; k++) y[k] *= 12;
    if (brk === 'dc') for (let k = 0; k < y.length; k++) y[k] += 0.01;
    const h = hygiene(y, SR);
    n++;
    peakMax = Math.max(peakMax, h.peak); meanMax = Math.max(meanMax, h.mean); winMax = Math.max(winMax, h.worstMean);
    if (!h.finite || h.peak >= 0.9 || h.sub || h.mean > 1e-3 || h.worstMean > 1e-2)
      bad.push(`${B.key}/${sc}${o ? '(twin)' : ''} (peak ${h.peak.toFixed(3)}, mean ${h.mean.toExponential(1)}, 1-s ${h.worstMean.toExponential(1)})`);
  }
  rows.push([bad.length === 0, `${n} renders: finite, peak ${peakMax.toFixed(3)} (< 0.9), DC: mean ${meanMax.toExponential(1)} `
             + `(< 1e-3), worst 1-s mean ${winMax.toExponential(1)} (< 1e-2), no subnormal output` + (bad.length ? ' — BAD: ' + bad.join(', ') : '')]);
  // SUBNORMALS IN THE PIPES. A running or parked voice never decays to them
  // (the frozen piston term holds a steady state), so the test makes the
  // case that does: every excitation off, an impulse in every pipe, the
  // network left to ring down freely for 20 s with the sleep off — only the
  // bias then stands between the float32 feedback lines and the subnormal
  // range. Scanned every 0.25 s (a free decay passes through the range and
  // flushes to zero within a second or two). Then the ordinary shutdown,
  // with the sleep on.
  {
    const B = BUILDS[0];
    const c = clone(B.configs[0]);
    c.pistonK = 0; c.ignitionK = 0; c.intakeNoiseK = 0;
    const v = R.makeVoice(W48, c, 9, 0, { running: 1, rpm: 1000 });
    v.proc.sleepEnabled = false;
    if (brk === 'denormal') v.proc.net.bias = 0;
    const pipes = pipesOf(v.proc);
    for (const d of pipes) d[0] = 1;
    let sub = 0, cells = 0;
    for (let k = 0; k < 80; k++) {
      const r = R.renderVoice(v, 0.25, (t, p) => { p.rpm = 1000; p.running = 1; p.load = 0; });
      for (const d of pipes) { cells += d.length; for (let q = 0; q < d.length; q++) if (isSub(d[q])) sub++; }
      sub += hygiene(r.y, SR).sub;
    }
    rows.push([sub === 0, `a free ring-down, 20 s, sleep off: ${sub} subnormals in ${(cells / 80) | 0} pipe cells x 80 scans + the output (the bias holds them off)`]);
  }
  if (brk !== 'denormal') {
    const B = BUILDS[0];
    const v = R.makeVoice(W48, B.configs[0], 9, 1, { running: 1, rpm: 700 });
    R.renderVoice(v, 2, (t, p) => { p.rpm = 700; p.running = 1; });
    const r = R.renderVoice(v, 40, (t, p) => { p.rpm = 0; p.running = 0; });
    let sub = 0, cells = 0;
    for (const d of pipesOf(v.proc)) { cells += d.length; for (let k = 0; k < d.length; k++) if (isSub(d[k])) sub++; }
    sub += hygiene(r.y, SR).sub;
    rows.push([sub === 0 && v.proc.asleep, `40 s after a hot shutdown: asleep, ${sub} subnormals in ${cells} pipe cells + the output`]);
  }
  // HOSTILE INPUT: NaN / Infinity / negative parameters, and a NaN planted in
  // a pipe: the output stays finite and the voice comes back
  {
    const B = BUILDS[0];
    const v = R.makeVoice(W48, B.configs[0], 4, 0.5, { running: 1, rpm: 1500 });
    const r1 = R.renderVoice(v, 0.5, (t, p) => { p.rpm = NaN; p.load = Infinity; p.running = 1; p.starve = -3; p.cold = NaN; });
    if (brk !== 'nanguard') v.proc.net.cylinders[0].exhaustWaveguide.upper.data[0] = NaN;
    else v.proc.net.cylinders[0].exhaustWaveguide.upper.data.fill(NaN);
    const r2 = R.renderVoice(v, 0.5, (t, p) => { p.rpm = 1500; p.load = 0.5; p.running = 1; });
    const r3 = R.renderVoice(v, 1.0, (t, p) => { p.rpm = 1500; p.load = 0.5; p.running = 1; });
    const ok = hygiene(r1.y, SR).finite && hygiene(r2.y, SR).finite && hygiene(r3.y, SR).finite
      && R.stats(r3.y.subarray(r3.y.length / 2)).rms > 1e-3;
    if (brk === 'nanguard') {
      // the guard itself cannot be sabotaged from outside: check the
      // detector instead — a render with the NaN left in must read non-finite
      const y = r3.y.slice(); y[7] = NaN;
      rows.push([hygiene(y, SR).finite, 'a NaN left in the output is caught']);
    } else rows.push([ok, 'NaN / Infinity / negative parameters and a NaN in a pipe: finite, and the voice recovers']);
  }
  return rows;
}

// §4: in a child with --expose-gc (the heap must be measurable)
function allocChild(brk) {
  const { PerformanceObserver, performance } = require('perf_hooks');
  let gcs = 0, tFrom = Infinity, tTo = Infinity;
  // entries arrive asynchronously: count by their own start time, inside the window
  const obs = new PerformanceObserver(list => {
    for (const e of list.getEntries()) if (e.startTime >= tFrom && e.startTime <= tTo) gcs++;
  });
  obs.observe({ entryTypes: ['gc'] });
  const B = R.loadBuild(R.VALIDATED[0]);
  const v = R.makeVoice(W48, B.configs[0], 2, 1);
  if (brk === 'alloc') { const p0 = v.proc.process.bind(v.proc); v.proc.process = (a, b, c) => { v.junk = new Array(32).fill(1); return p0(a, b, c); }; }
  const P = v.params;
  const phase = b => {                        // every state the voice has
    const t = b % 6000;
    P.running[0] = t < 400 ? 0 : t < 3500 ? 1 : 0;
    P.starter[0] = t < 400 ? 1 : 0;
    P.rpm[0] = t < 400 ? 0 : t < 3500 ? 700 + 1500 * ((t >> 8) & 1) : 0;
    P.load[0] = (t >> 9) & 1; P.starve[0] = t > 3000 && t < 3500 ? 0.8 : 0; P.cold[0] = 0.3;
  };
  for (let b = 0; b < 12000; b++) { phase(b); v.proc.process(v.inputs, v.outputs, P); }
  return new Promise(res => setImmediate(() => {
    global.gc(); global.gc();
    const h0 = process.memoryUsage().heapUsed;
    tFrom = performance.now();
    for (let b = 0; b < 20000; b++) { phase(b); v.proc.process(v.inputs, v.outputs, P); }
    tTo = performance.now();
    const h1 = process.memoryUsage().heapUsed;
    setTimeout(() => { obs.disconnect(); res({ gcs, dHeap: h1 - h0 }); }, 50);
  }));
}
function secAlloc(brk) {
  const r = spawnSync(process.execPath, ['--expose-gc', __filename, '--alloc-child', brk || ''], { encoding: 'utf8' });
  let o = null;
  try { o = JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (e) { o = null; }
  if (!o) return [[false, 'the allocation child did not report: ' + (r.stderr || '').slice(0, 300)]];
  return [[o.gcs === 0 && o.dHeap < 64 * 1024,
           `process() over 20 000 blocks (run, crank, run-down, ticks): ${o.gcs} GCs, heap ${(o.dHeap / 1024).toFixed(1)} kB (0 GCs, < 64 kB)`]];
}

function secSeed(brk) {
  const B = BUILDS[0];
  const once = (seed, rnd) => {
    const v = R.makeVoice(W48, B.configs[0], seed, 0);
    if (rnd) v.proc.rs[0] = Number(process.hrtime.bigint() & 0xffffffffn) | 1;   // a clock seed
    return R.renderVoice(v, 5, R.SCENES.start.scene(B, B.configs[0])).y;
  };
  const a = once(7), b = once(7, brk === 'seed'), c = once(8);
  const same = Buffer.compare(Buffer.from(a.buffer), Buffer.from(b.buffer)) === 0;
  const diff = Buffer.compare(Buffer.from(a.buffer), Buffer.from(c.buffer)) !== 0;
  return [[same, 'seed 7 twice: bit-identical renders'], [diff, 'seed 8: a different render']];
}

// §6: THE SOLVER DRIVES THE VOICE — the Cub on the ground: key off, the
// starter (setEngine's 1.5 s crank), idle, a run-up, the key off
function solverDrive(B, brk) {
  const sim = C.makeSim(B.def, C.makeWorld()); sim.reset(0);
  const cfg = clone(B.configs[0]);
  if (brk === 'crank') cfg.crankRpm = 600;
  const v = R.makeVoice(W48, cfg, 11, 0.3);
  const dst = new Float32Array(6);
  const FR = 60, bpf = SR / R.BLOCK / FR;        // 6.25 blocks a frame
  const rec = { t: [], simRpm: [], vRpm: [], crank: [], running: [] };
  let acc = 0, runS = 0;
  sim.setEngine(0, { key: 'off' });
  for (let f = 0; f < FR * 17; f++) {
    const t = f / FR;
    if (f === Math.round(0.5 * FR)) sim.setEngine(0, { key: 'both' });
    if (f === Math.round(0.6 * FR)) sim.setEngine(0, { start: true });
    sim.ctl.thr = t > 7 && t < 10 ? 0.6 : 0;
    sim.ctl.brake = 1;                               // held on the brakes for the run-up
    if (f === Math.round(12.5 * FR)) sim.setEngine(0, { key: 'off' });
    sim.step(1 / FR);
    if (sim.eng[0].running) runS += 1 / FR;
    CFGM.engineSoundInputs(sim, 0, dst, 0, runS);
    acc += bpf;
    while (acc >= 1) {
      acc -= 1;
      for (let k = 0; k < 6; k++) v.params[CFGM.ENGINE_SOUND_PARAMS[k]][0] = dst[k];
      if (brk === 'nocatch' && dst[2] > 0.5) v.proc.catching = false;
      v.proc.process(v.inputs, v.outputs, v.params);
      if (brk === 'rundown' && dst[2] < 0.5 && dst[3] < 0.5) v.proc.vRpm = dst[0];
    }
    rec.t.push(t); rec.simRpm.push(dst[0]); rec.vRpm.push(v.outputs[1][0][R.BLOCK - 1] * 1000);
    rec.crank.push(dst[3]); rec.running.push(dst[2]);
  }
  return rec;
}
function secLife(brk) {
  const rows = [];
  const B = BUILDS[0], cfg = B.configs[0];
  const rec = solverDrive(B, brk);
  const idx = rec.t.map((_, k) => k);
  const crankK = idx.filter(k => rec.crank[k] > 0.5 && rec.t[k] > 0.9);
  const crankV = crankK.map(k => rec.vRpm[k]);
  const simCrank = Math.max(...crankK.map(k => rec.simRpm[k]));
  rows.push([crankK.length > 60 && Math.min(...crankV) >= 100 && Math.max(...crankV) <= 300 && simCrank < 0.1 * cfg.idleRpm,
             `the crank (setEngine's 1.5 s, ${(crankK.length / 60).toFixed(2)} s seen): voice ${Math.min(...crankV).toFixed(0)}-`
             + `${Math.max(...crankV).toFixed(0)} rpm (100-300) while the solver reads ${simCrank.toFixed(1)} rpm (a cranking engine is not turning, to the solver)`]);
  const k0 = idx.find(k => rec.running[k] > 0.5);
  const simIdle = rec.simRpm[k0 + 10];
  const win = (a, b) => idx.filter(k => rec.t[k] >= rec.t[k0] + a && rec.t[k] < rec.t[k0] + b);
  const surge = Math.max(...win(0, 2).map(k => rec.vRpm[k]));
  const settled = win(4, 4.5).every(k => Math.abs(rec.vRpm[k] / rec.simRpm[k] - 1) < 0.05);
  rows.push([surge > 1.15 * simIdle && settled,
             `the catch at ${rec.t[k0].toFixed(2)} s: surge to ${surge.toFixed(0)} rpm over the solver's idle ${simIdle.toFixed(0)} (> +15 %), within 5 % of it by 4 s`]);
  const kOff = idx.find(k => rec.t[k] > 12.5 && rec.running[k] < 0.5);
  const v0 = rec.vRpm[kOff - 1];
  const kLow = idx.find(k => k > kOff && rec.vRpm[k] < 0.3 * cfg.idleRpm);
  const kStop = idx.find(k => k > kOff && rec.vRpm[k] < 5);
  const tLow = kLow != null ? rec.t[kLow] - rec.t[kOff] : 99, tStop = kStop != null ? rec.t[kStop] - rec.t[kOff] : 99;
  rows.push([rec.simRpm[kOff + 2] < 0.1 * cfg.idleRpm && tLow > 0.8 && tStop < 4.5,
             `the run-down from ${v0.toFixed(0)} rpm: under 30 % of idle after ${tLow.toFixed(2)} s (> 0.8; the solver: at once), stopped after ${tStop.toFixed(2)} s (< 4.5)`]);

  // the ticks of a hot exhaust, absent from a cold one
  const tickDb = heat => {
    const r = R.renderScene(W48, B, 'hot', { seed: 3, heat: brk === 'ticks' ? 0 : heat });
    const from = Math.floor(10 * SR), len = Math.floor(14 * SR);
    const S = R.spectrum(r.y, from, len, SR, 1 << 20);
    let e = 0; for (let k = Math.floor(2000 / S.binHz); k < 8000 / S.binHz; k++) e += S.mag[k] * S.mag[k];
    return 10 * Math.log10(e + 1e-30);
  };
  const hot = tickDb(1), cold = tickDb(0);
  rows.push([hot - cold > 40, `after-shutdown ticking, 10-24 s, 2-8 kHz: hot ${hot.toFixed(0)} dB vs cold ${cold.toFixed(0)} dB (> 40 dB apart)`]);

  // misfires and jitter, counted at the source (the per-cycle draw)
  const draws = (rpm, load, starve) => {
    const v = R.makeVoice(W48, cfg, 21, 0.5, { running: 1, rpm });
    R.renderVoice(v, 6, (t, p) => { p.rpm = rpm; p.load = load; p.running = 1; p.starve = brk === 'misfire' ? 0 : starve; });
    // the processor's own counters: cycles drawn, misfires, sum and sum of
    // squares of the firing strength's spread (over the cycles that fired)
    const ST = v.proc.stats, n = ST[0], fired = ST[0] - ST[1];
    const m = ST[2] / Math.max(1, fired);
    const sd = Math.sqrt(Math.max(0, ST[3] / Math.max(1, fired) - m * m));
    return { n, miss: ST[1] / Math.max(1, n), sd };
  };
  const cruise = draws(0.9 * cfg.ratedRpm, 0.75, 0), idle = draws(cfg.idleRpm, 0, 0), dry = draws(0.9 * cfg.ratedRpm, 0.75, 1);
  rows.push([dry.miss > 0.3 && cruise.miss < 0.03,
             `misfires: ${(dry.miss * 100).toFixed(0)} % of ${dry.n} cycles starving (> 30), ${(cruise.miss * 100).toFixed(1)} % in cruise (< 3)`]);
  rows.push([idle.sd > 2 * cruise.sd && cruise.sd > 0.01,
             `combustion jitter: sd ${idle.sd.toFixed(3)} at idle vs ${cruise.sd.toFixed(3)} in cruise (idle > 2x)`]);

  // the gearbox split on the control output: prop = engine / gear
  {
    const T = BUILDS[4], c = T.configs[0];
    const v = R.makeVoice(W48, c, 1, 0, { running: 1, rpm: 5000 });
    const r = R.renderVoice(v, 0.3, (t, p) => { p.rpm = 5000; p.load = 0.5; p.running = 1; });
    const e = r.ctlE[r.ctlE.length - 1], pr = brk === 'ctl' ? r.ctlE[r.ctlE.length - 1] : r.ctlP[r.ctlP.length - 1];
    rows.push([Math.abs(e / pr - c.gear) < 1e-3 && Math.abs(e - 5000) < 5,
               `control output: engine ${e.toFixed(0)} rpm, prop ${pr.toFixed(0)} rpm (gear ${c.gear})`]);
  }
  // the blower: a supercharged radial whistles at its compressor's pitch, an
  // NA engine does not
  {
    const whistle = type => {
      const c = CFGM.engineSoundConfig({ engines: [{ type }] }, 0, C.POWERPLANTS);
      if (brk === 'blower') c.blower.kind = 'none';
      const v = R.makeVoice(W48, c, 1, 0, { running: 1, rpm: c.ratedRpm });
      const r = R.renderVoice(v, 3, (t, p) => { p.rpm = c.ratedRpm; p.load = 1; p.running = 1; });
      const S = R.spectrum(r.y, r.y.length - SR, SR, SR, 1 << 16);
      const f = c.blower.hz || 3200;
      const pk = R.peakIn(S, 0.97 * f, 1.03 * f);
      return { pk, c };
    };
    const sup = whistle('m14p_v530'), na = whistle('o540_hartzell');
    rows.push([sup.pk.prominence > 15 && na.pk.prominence < 10,
               `the blower: the M-14P whistles at ${sup.pk.hz.toFixed(0)} Hz (+${sup.pk.prominence.toFixed(0)} dB), the O-540 does not (+${na.pk.prominence.toFixed(0)} dB)`]);
  }
  return rows;
}

function secCpu(brk) {
  const rows = [];
  const res = [];
  for (const B of brk ? BUILDS.slice(0, 1) : BUILDS.filter((b, i) => i !== 1)) {
    const cfg = B.configs[0];
    const v = R.makeVoice(W48, cfg, 1, 0.5, { running: 1, rpm: cfg.ratedRpm * 0.9 });
    if (brk === 'cpu') { const p0 = v.proc.process.bind(v.proc); v.proc.process = (a, b, c) => { const t = Date.now() + 2; while (Date.now() < t); return p0(a, b, c); }; }
    const sc = (t, p) => { p.rpm = cfg.ratedRpm * 0.9; p.load = 0.8; p.running = 1; };
    R.renderVoice(v, 2, sc);
    const blocks = brk ? 300 : 3000;
    const t0 = process.hrtime.bigint();
    R.renderVoice(v, blocks * R.BLOCK / SR, sc);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / blocks;
    res.push(`${B.key} ${cfg.cyl} cyl ${ms.toFixed(3)} ms`);
    rows.push([ms < 1.0, `${B.key}: ${ms.toFixed(3)} ms per 128-frame block (< 1.0; real time is ${(R.BLOCK / SR * 1000).toFixed(2)} ms)`]);
  }
  return rows;
}

// §8: the sound row is physics-inert — the five builds with and without it
// the serialiser: every key but `sound`, typed arrays as numbers, and a
// reference seen before written once (the def holds back-references)
const noSound = () => {
  const seen = new WeakSet();
  return (k, v) => {
    if (k === 'sound') return undefined;
    if (ArrayBuffer.isView(v)) return Array.from(v);
    if (v && typeof v === 'object') { if (seen.has(v)) return '[seen]'; seen.add(v); }
    return v;
  };
};
function physicsOf(spec) {
  const R0 = C.resolveSpec(clone(spec));
  const def = C.buildGen(clone(spec));
  const sim = C.makeSim(def, C.makeWorld()); sim.reset(0);
  sim.ctl.thr = 0.8;
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  const simState = { p: Array.from(sim.p), v: Array.from(sim.v), out: sim.out };
  return JSON.stringify({ R0, nodes: def.nodes, beams: def.beams, strips: def.strips, refs: def.refs,
                          params: def.params, spec: def.spec, parts: def.parts, clusters: def.clusters, simState }, noSound());
}
function secInert(brk) {
  const rows = [];
  for (const B of BUILDS) {
    const before = clone(B.spec);
    for (const e of before.engines) delete e.sound;
    const after = clone(before);
    after.engines.forEach((e, i) => {
      const c = CFGM.engineSoundConfig(before, i, C.POWERPLANTS);
      e.sound = { cyl: c.cyl, arch: c.arch, twoStroke: c.twoStroke, dispL: c.dispL };
      if (brk === 'physics') e.tilt = 1;
    });
    const a = physicsOf(before), b = physicsOf(after);
    // the row survives into the resolved spec (it is carried, not dropped)
    const kept = C.resolveSpec(clone(after)).spec.engines.every(e => e.sound && e.sound.cyl > 0);
    rows.push([a === b && kept, `${B.key}: resolveSpec + buildGen + 4 s of the solver bit-identical with the sound row `
               + `(${(a.length / 1e6).toFixed(1)} MB compared${kept ? ', the row carried through the resolve' : ', ROW DROPPED'})`]);
  }
  return rows;
}

// §9 REVIEW (SND-ENGINE-2, G1615-G1619): the user's Engine Lab review
// (reports/evidence/SND-ENGINE/REVIEW-2026-10-04.md) — the starter, the
// cooling ticks, the clicks and the twin's level, each held against the
// G1613 voice's own numbers (OLD: this section run on 90c8b214's worklet and
// config, where every row below is red)
const OLD = {
  starterDb: 20 * Math.log10(0.02 * Math.sqrt((1 + 0.35 * 0.35 + 0.15 * 0.15) / 2)),   // the whine's RMS, -36.4 dB
  starterHz: { cub: 1076, jodel: 1076, cessna: 926, cessnaFloats: 785, twin582: 670 },  // its centroid
  tickDecayMs: 36.0, tickFlat: 0.250, tickOverIdleDb: 10.1,
  clickDb: { 'cub/starve': 2.3, 'twin582/runup': 4.2, 'twin582/sweep': 2.4 },        // cough peak over the running RMS
  twinDb: 6.0,                                                                         // the twin over one
};
const dbOf = x => 20 * Math.log10(x + 1e-30);
const rmsIn = (y, a, b) => { let s = 0; const i0 = Math.floor(a * SR), i1 = Math.floor(b * SR); for (let k = i0; k < i1; k++) s += y[k] * y[k]; return Math.sqrt(s / Math.max(1, i1 - i0)); };
// Welch: the mean power spectrum of 4096-sample Hann segments, half-overlapped
function welch(y, a, b) {
  const L = 4096, P = new Float64Array(L / 2);
  let n = 0;
  for (let o = Math.floor(a * SR); o + L <= Math.floor(b * SR); o += L / 2, n++) {
    const S = R.spectrum(y, o, L, SR, L);
    for (let k = 0; k < L / 2; k++) P[k] += S.mag[k] * S.mag[k];
  }
  for (let k = 0; k < L / 2; k++) P[k] /= Math.max(1, n);
  return { P, binHz: SR / L };
}
const centroidOf = W => { let n = 0, d = 0; for (let k = 1; k < W.P.length; k++) { n += W.P[k] * k * W.binHz; d += W.P[k]; } return n / d; };
// the strongest bin over the median of its third-octave neighbourhood, dB
function tonalDb(W, f0, f1) {
  let worst = -99;
  for (let k = Math.ceil(f0 / W.binHz); k <= f1 / W.binHz; k++) {
    const lo = Math.max(1, Math.floor(k / 1.122)), hi = Math.min(W.P.length - 1, Math.ceil(k * 1.122));
    const nb = []; for (let q = lo; q <= hi; q++) nb.push(W.P[q]);
    nb.sort((x, z) => x - z);
    worst = Math.max(worst, 10 * Math.log10(W.P[k] / (nb[nb.length >> 1] + 1e-40)));
  }
  return worst;
}
// A-weighted RMS (IEC 61672 A curve on the spectrum), dB
function dbA(y, a, b) {
  const W = welch(y, a, b);
  let pw = 0, pa = 0;
  for (let k = 1; k < W.P.length; k++) {
    const f2 = (k * W.binHz) ** 2;
    const ra = 12194 ** 2 * f2 * f2 / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2)) * 1.2589;
    pw += W.P[k]; pa += W.P[k] * ra * ra;
  }
  return dbOf(rmsIn(y, a, b) * Math.sqrt(pa / (pw + 1e-40)));
}
// a scene rendered from one voice, `patch(proc, cfg)` applied once it is made
function sceneOf(B, sc, patch, seed) {
  const S = R.SCENES[sc], cfg = clone(B.configs[0]);
  if (patch && patch.cfg) patch.cfg(cfg);
  const v = R.makeVoice(W48, cfg, seed || 1, S.heat, S.state ? S.state(B, cfg) : null);
  if (patch && patch.proc) patch.proc(v.proc, cfg);
  return R.renderVoice(v, S.seconds, S.scene(B, cfg)).y;
}
// sabotage helpers: wrap a processor's process() to add something after it
function wrapAfter(proc, add) {
  const p0 = proc.process.bind(proc);
  proc.process = (i, o, P) => { const r = p0(i, o, P); add(o[0][0]); return r; };
}
function secReview(brk) {
  const rows = [];
  const want = k => !brk || brk === k;
  const SUB = { whine: 's', loudstarter: 's', flatcatch: 's', ring: 't', tone: 't', loudtick: 't', hook: 't', crack: 'c', locked: 'w' };
  const part = brk ? SUB[brk] : null;
  // ---- THE STARTER, the five builds: the start scene, the starter isolated
  // (its own noise stream: starterLevel = 0 moves no other draw)
  if (!part || part === 's') {
    const patchS = {
      cfg: c => { if (brk === 'loudstarter') c.starter.level *= 12;
                  if (brk === 'flatcatch') { c.catchK = 0; c.crankLevel = 0.3; } },
      proc: (proc, c) => {
        if (brk !== 'whine') return;
        // the G1613 commutator whine put back on top: 0.02 x the starter's
        // envelope, pinion 14 x 16 segments a crank rpm
        let ph = 0;
        wrapAfter(proc, y => {
          const st = proc.starterLevel > 0 ? 0.02 * proc.starterEnv : 0;
          if (!(st > 1e-5)) return;
          for (let s = 0; s < y.length; s++) {
            ph += proc.vRpm * (c.twoStroke ? 8 : 14) * 16 / 60 / SR; ph -= Math.floor(ph);
            const q = 2 * Math.PI * ph;
            y[s] += st * (Math.sin(q) + 0.35 * Math.sin(2 * q) + 0.15 * Math.sin(3 * q));
          }
        });
      },
    };
    const set = brk ? BUILDS.filter(B => B.key === 'cub' || B.key === 'cessnaFloats') : BUILDS;
    for (const B of set) {
      const full = sceneOf(B, 'start', patchS);
      const eng = sceneOf(B, 'start', { cfg: patchS.cfg, proc: (p, c) => { p.starterLevel = 0; patchS.proc(p, c); } });
      const st = full.map((x, k) => x - eng[k]);
      const Ws = welch(st, 0.9, 2.0);
      const cen = centroidOf(Ws), tone = tonalDb(Ws, 60, 6000), lev = dbOf(rmsIn(st, 0.9, 2.0));
      rows.push([cen < 600 && tone < 12,
                 `${B.key} starter: centroid ${cen.toFixed(0)} Hz (< 600; was ${OLD.starterHz[B.key]}), strongest bin ${tone.toFixed(1)} dB over its third octave (< 12: no tone)`]);
      const aS = dbA(st, 0.9, 2.0), aE = dbA(eng, 0.9, 2.0), aC = dbA(full, 0.9, 2.0), aK = dbA(full, 2.15, 3.15);
      rows.push([lev <= OLD.starterDb - 10 && aE >= aS,
                 `${B.key} starter: ${lev.toFixed(1)} dB RMS (<= ${(OLD.starterDb - 10).toFixed(1)}: 10 under the whine's ${OLD.starterDb.toFixed(1)}); `
                 + `the cranking engine ${aE.toFixed(1)} dB(A) over the starter's ${aS.toFixed(1)} (>= it)`]);
      rows.push([aK >= aC + 4,
                 `${B.key} the catch ${aK.toFixed(1)} dB(A) over the cranking ${aC.toFixed(1)} (>= +4: the first firings louder)`]);
    }
  }
  // ---- THE TICKS: the Cessna's hot shutdown, 8-26 s (the voice asleep: the
  // ticks are all there is)
  if (!part || part === 't') {
    const B = BUILDS[2];
    const patchT = {
      cfg: c => { if (brk === 'loudtick') c.tick.level *= 10; },
      proc: proc => {
        if (brk === 'ring') {            // the burst left to ring 30 ms
          const p0 = proc.process.bind(proc), rr = Math.exp(-1 / (0.03 * SR));
          proc.process = (i, o, P) => { if (proc.tickF[0] > 0) proc.tickF[1] = rr; return p0(i, o, P); };
        }
        if (brk === 'tone') {            // a 4 kHz tone under the burst's envelope
          let ph = 0;
          wrapAfter(proc, y => { const F = proc.tickF; if (!(F[0] > 0)) { ph = 0; return; }
            for (let s = 0; s < y.length; s++) { ph += 4000 / SR; y[s] += 3 * F[0] * Math.sin(2 * Math.PI * ph); } });
        }
      },
    };
    const y = sceneOf(B, 'hot', patchT);
    const a = 8, b = 26;
    // each tick: its peak in a 0.25 ms RMS envelope, the time to -20 dB
    const w = 12, env = [];
    for (let o = a * SR; o + w < b * SR; o += w) { let s = 0; for (let q = o; q < o + w; q++) s += y[q] * y[q]; env.push(Math.sqrt(s / w)); }
    const top = Math.max(...env), dec = [];
    let pk = 0;
    for (let i = 1; i < env.length - 1; i++) if (env[i] > env[i - 1] && env[i] >= env[i + 1] && env[i] > 0.03 * top) {
      let j = i; while (j < env.length && env[j] > env[i] * 0.1) j++;
      dec.push((j - i) * w / SR * 1000); pk = Math.max(pk, env[i]); i = j;
    }
    dec.sort((p, q) => p - q);
    const med = dec.length ? dec[dec.length >> 1] : 99;
    const Wt = welch(y, a, b);
    let lg = 0, ar = 0, n = 0;
    for (let k = Math.ceil(1500 / Wt.binHz); k < 8000 / Wt.binHz; k++) { lg += Math.log(Wt.P[k] + 1e-40); ar += Wt.P[k]; n++; }
    const flat = Math.exp(lg / n) / (ar / n);
    const idle = dbOf(rmsIn(y, 1, 2.8)), over = dbOf(pk) - idle;
    rows.push([dec.length > 20 && med < 5,
               `cessna ticks: ${dec.length}, median ${med.toFixed(2)} ms to -20 dB (< 5; was ${OLD.tickDecayMs}): dry, no ring`]);
    rows.push([flat > 0.35, `cessna ticks: spectral flatness 1.5-8 kHz ${flat.toFixed(3)} (> 0.35; was ${OLD.tickFlat}): broadband, no pitch`]);
    rows.push([over <= -6, `cessna ticks: loudest ${over.toFixed(1)} dB re the idle's RMS (<= -6; was +${OLD.tickOverIdleDb})`]);
    // THE HOOK: post: true sends one message a tick; synth: 0 silences the
    // synthetic one (a recorded tick replaces it)
    {
      let posted = 0;
      const yh = sceneOf(B, 'hot', { proc: proc => {
        proc.port.postMessage = m => { if (m && m.type === 'tick' && m.amp > 0) posted++; };
        proc._onMessage({ type: 'tick', post: brk !== 'hook', synth: brk === 'hook' ? 1 : 0 });
        R._lastProc = proc;
      } });
      const ticks = R._lastProc.stats[4];
      const left = dbOf(rmsIn(yh, 8, 26));
      rows.push([posted === ticks && ticks > 20 && left < -150,
                 `the tick hook: ${posted} messages for ${ticks} ticks; synth 0 leaves ${left.toFixed(0)} dB (< -150)`]);
    }
  }
  // ---- THE CLICKS: the cough isolated (its own noise stream: coughK = 0
  // moves no other draw), its loudest 5 ms against the running RMS
  if (!part || part === 'c') {
    const plan = [['cub', 'starve', 8, 20], ['twin582', 'runup', 0, 2], ['twin582', 'sweep', 0, 3]];
    for (const [k, sc, a, b] of plan) {
      const B = BUILDS.find(x => x.key === k);
      const cfgP = c => { if (brk === 'crack') { c.cough.level *= 4; c.cough.rise = 1e-6; c.cough.hz = 20000; } };
      const full = sceneOf(B, sc, { cfg: cfgP });
      const eng = sceneOf(B, sc, { cfg: cfgP, proc: p => { p.coughK = 0; } });
      const w = Math.floor(0.005 * SR);
      let pk = 0, s2 = 0;
      for (let o = Math.floor(a * SR); o + w < b * SR; o += w >> 1) {
        let s = 0; for (let q = o; q < o + w; q++) { const d = full[q] - eng[q]; s += d * d; }
        pk = Math.max(pk, Math.sqrt(s / w));
      }
      const rel = dbOf(pk) - dbOf(rmsIn(eng, a, b)), old = OLD.clickDb[k + '/' + sc];
      rows.push([rel <= old - 6 && rel > old - 20,
                 `${k}/${sc} clicks: the loudest cough ${rel.toFixed(1)} dB re the running RMS (<= ${(old - 6).toFixed(1)}: 6 under the old ${old >= 0 ? '+' : ''}${old}; > ${(old - 20).toFixed(1)}: still heard)`]);
    }
  }
  // ---- THE TWIN: both 582s summed, each at -10 log10(2) dB (src_engine.js
  // through engineSoundCountGain), within +1 dB of one
  if (!part || part === 'w') {
    const T = BUILDS[4];
    const one = R.renderScene(W48, T, 'runup', { seed: 1 }).y;
    let two;
    if (brk === 'locked') {
      // the G1613 twin: both cranks from angle 0, each at full level
      const S = R.SCENES.runup;
      two = null;
      for (const i of [0, 1]) {
        const v = R.makeVoice(W48, T.configs[i], 1 + i * 7919, S.heat, S.state(T, T.configs[i]));
        v.proc.net.currentRevolution = 0;
        const r = R.renderVoice(v, S.seconds, S.scene(T, T.configs[i])).y;
        if (!two) two = r; else for (let k = 0; k < two.length; k++) two[k] += r[k];
      }
    } else two = R.renderScene(W48, T, 'runup', { seed: 1, engines: [0, 1] }).y;
    const d = dbOf(rmsIn(two, 1, 12)) - dbOf(rmsIn(one, 1, 12));
    const nT = CFGM.engineSoundPistonCount(T.spec, C.POWERPLANTS), nC = CFGM.engineSoundPistonCount(BUILDS[0].spec, C.POWERPLANTS);
    rows.push([d <= 1 && d > -4 && nT === 2 && nC === 1 && Math.abs(CFGM.engineSoundCountGain(nT) - Math.SQRT1_2) < 1e-12,
               `twin582: both summed ${d >= 0 ? '+' : ''}${d.toFixed(1)} dB re one (<= +1; was +${OLD.twinDb}); piston voices: twin ${nT}, Cub ${nC}; each at ${(20 * Math.log10(CFGM.engineSoundCountGain(nT))).toFixed(2)} dB`]);
  }
  return rows;
}

const SECTIONS = [
  ['§1 CONFIG', secConfig, ['drift', 'parse', 'firing']],
  ['§2 FIRING', secFiring, ['cyl', 'stroke']],
  ['§3 HYGIENE', secHygiene, ['nan', 'clip', 'dc', 'denormal', 'nanguard']],
  ['§4 ALLOC', secAlloc, ['alloc']],
  ['§5 SEED', secSeed, ['seed']],
  ['§6 LIFE', secLife, ['crank', 'nocatch', 'rundown', 'ticks', 'misfire', 'ctl', 'blower']],
  ['§7 CPU', secCpu, ['cpu']],
  ['§8 INERT', secInert, ['physics']],
  ['§9 REVIEW', secReview, ['whine', 'loudstarter', 'flatcatch', 'ring', 'tone', 'loudtick', 'hook', 'crack', 'locked']],
].concat(require('./_prop_check.js').PROP_SECTIONS);

async function main() {
  const t0 = Date.now();
  for (const [name, fn] of SECTIONS) {
    if (!wanted(name)) continue;
    log(name);
    const rows = await fn(null);
    for (const [c, l] of rows) { log((c ? '  ok     ' : '  FAIL   ') + l); if (!c) fails++; }
  }
  if (!QUICK) {
    // NEGATIVE CONTROLS: every assertion above, broken on purpose, must go red
    log('NEGATIVE CONTROLS (each sabotage must turn its section red)');
    for (const [name, fn, sabotages] of SECTIONS) for (const s of (wanted(name) ? sabotages : [])) {
      const rows = await fn(s);
      const red = rows.some(r => !r[0]);
      const first = rows.find(r => !r[0]);
      log((red ? '  ok     ' : '  FAIL   ') + `${name} / ${s}: red` + (first ? ` — ${first[1].slice(0, 110)}` : ' — STAYED GREEN'));
      if (!red) fails++;
    }
  }
  log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  log(fails ? `GATE AUDIOENG: FAIL (${fails})` : 'GATE AUDIOENG: PASS');
  process.exitCode = fails ? 1 : 0;
}

if (process.argv.includes('--alloc-child')) {
  const brk = process.argv[process.argv.indexOf('--alloc-child') + 1] || null;
  allocChild(brk).then(o => console.log(JSON.stringify(o)));
} else {
  main();
}
