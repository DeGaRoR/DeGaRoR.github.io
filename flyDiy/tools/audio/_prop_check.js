#!/usr/bin/env node
// THE PROP SECTIONS OF GATE AUDIOENG (SND-PROP, G1623; SOUND-2026-10-04 §8). One place per voice: the prop, the
// turbine and the electric voices are checked here; tools/audio/_engine_check.js (GATE AUDIOENG, registered)
// appends these sections to its own and runs their sabotages with its own.
//
//   node tools/audio/_prop_check.js             these sections, then every sabotage (each must go red)
//   node tools/audio/_prop_check.js --quick     the sections only
//   node tools/audio/_prop_check.js --only=P2   one section (and its sabotages)
//
// §P1 PCONFIG  the eight builds (the six validated + a PT6 + an electric archetype) -> driver, blades, D, gear,
//              the gearbox's teeth; blades and D equal to audio_params' own block (one truth)
// §P2 BPF      an FFT finds the blade-passage frequency (prop rpm/60 x blades) within +-3 % at four rpm across
//              each build's range, in the prop's output, the prop DRIVEN by its engine voice's control output
// §P3 GEARBOX  the 582 (C-box 2.62): the firing and the BPF peaks both present and distinct in the mix, the gear
//              mesh (engine rpm/60 x 21 teeth) in the tonal part; a direct-drive Cub: firing = BPF, no mesh
// §P4 SNARL    a clipped long prop swept through tip Mach: the upper-harmonic share rises monotonically, and the
//              snarl adds nothing below Mh 0.8 and >= 3 dB above 0.85 (against the same voice, snarl off)
// §P5 PHYGIENE every scene of every build: no NaN, no clip (< 0.9), no DC, no subnormal in the output or the
//              voices' states; hostile parameters and a NaN in a filter recover
// §P6 PALLOC   process() of the prop, turbine and electric voices: 0 GCs over 20 000 blocks through every state
// §P7 PLIFE    the prop turns with the engine voice's crank (the solver says 0) and runs down with it; the
//              turbine's Ng from the power (idle 52 %, full 101 %) and its compressor tone; the PT6's beta buzz
//              at taxi only; the electric whine at 6 x pole pairs x rpm; the chop deeper at incidence
// §P8 PCPU     ms per 128-frame block per voice
// §P9 SOURCE   src_engine.js + src_prop.js under a stubbed Web Audio with the real audio.js / audio_params.js and
//              the real solver: one prop per engine, each wired to ITS driver's output 1, turbine / electric rows
//              get their driver, rebuilt on a new def, wired whichever module loads first, a steady frame
//              schedules nothing, AUDIO.update allocation-free with both sources (0 GCs over 10 000 frames)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const R = require('./render.js');
const RP = require('./render_prop.js');
const ROOT = R.ROOT;
const at = p => path.join(ROOT, p);
const PCFG = require(at('src/viewer/audio/prop_config.js'));
const C = require(at('tools/flight_core.js'));

const SR = 48000;
const clone = o => JSON.parse(JSON.stringify(o));
const PROP_TEXT = fs.readFileSync(RP.PROP_WORKLET, 'utf8');
let _B = null;
const BUILDS = () => _B || (_B = RP.PROP_BUILDS.map(RP.loadPropBuild));
const byKey = k => BUILDS().find(b => b.key === k);

// the prop module from TEXT (a sabotage is a string, never a file)
function loadPropText(text, sr) {
  const registry = {};
  class AudioWorkletProcessor { constructor() { this.port = { onmessage: null, postMessage() {} }; } }
  const mod = { exports: {} };
  const fn = vm.runInThisContext('(function (AudioWorkletProcessor, registerProcessor, sampleRate, currentTime, module) {'
    + text + '\n})', { filename: 'prop_worklet.js' });
  fn(AudioWorkletProcessor, (n, c) => { registry[n] = c; }, sr, 0, mod);
  return registry;
}
let _W = null;
function worklets(text) {
  if (!text && _W) return _W;
  const E = R.loadWorklet(SR), reg = loadPropText(text || PROP_TEXT, SR);
  const w = { sr: SR, E, P: reg['flydiy-prop'], T: reg['flydiy-turbine'], X: reg['flydiy-electric'] };
  if (!text) _W = w;
  return w;
}
const mutate = (from, to) => { if (!PROP_TEXT.includes(from)) throw new Error('sabotage anchor gone: ' + from); return PROP_TEXT.replace(from, to); };

// a held prop rpm, the chain already turning there; 2.6 s, the last 2 s analysed
function held(Wk, B, rpmProp, o) {
  o = o || {};
  const eg = B.engines[0], gear = eg.pcfg.prop.gear;
  const ch = RP.makeChain(Wk, B, 0, { seed: 3, state: { running: 1, rpm: eg.pcfg.driver === 'piston' ? rpmProp * gear : rpmProp },
                                       propCfg: o.propCfg, unwired: o.unwired });
  if (o.ecfg) ch.drv.proc._build(Object.assign(clone(ch.ecfg), o.ecfg), 3, 0.5);
  const r = RP.renderChains([ch], o.seconds || 2.6, (t, p) => {
    p.thr = o.thr == null ? 1 : o.thr; p.V = o.V || 0; p.alpha = o.alpha || 0; p.beta = o.beta || 0;
    p.running = 1; p.rpmOver = rpmProp; p.thrustOver = o.T;
  }, Wk.sr);
  r.ch = ch;
  return r;
}
const lastSpec = (y, sr, nfft) => { const len = 2 * sr; return R.spectrum(y, y.length - len, len, sr, nfft || (1 << 17)); };

// ---- §P1 ------------------------------------------------------------------------------------------------------
const P1_EXPECT = {
  cub: ['piston', 2, 1, 0], jodel: ['piston', 2, 1, 0], cessna: ['piston', 2, 1, 0], cessnaMetal: ['piston', 2, 1, 0],
  cessnaFloats: ['piston', 2, 1, 0], twin582: ['piston', 2, 2.62, 21], pt6: ['turbine', 3, 1, 0], electric: ['electric', 2, 1, 0],
};
function secConfig(brk) {
  const rows = [];
  const AP = require(at('src/viewer/audio/audio_params.js'));
  globalThis.POWERPLANTS = C.POWERPLANTS;
  const saved = PCFG.PROP_SOUND_GEARBOX[0].slice();
  if (brk === 'pinion') PCFG.PROP_SOUND_GEARBOX[0][1] = 23;
  try {
    for (const B of BUILDS()) {
      const spec = clone(B.spec);
      if (brk === 'blades' && B.key === 'cub') spec.prop.blades = 3;
      const [drv, bl, gear, pin] = P1_EXPECT[B.key];
      const def = brk === 'blades' && B.key === 'cub' ? C.buildGen(clone(spec)) : B.def;
      const out = AP.audioParamsBlock(); AP.audioResolve(def, out);
      const bad = [];
      for (let i = 0; i < B.nE; i++) {
        const c = PCFG.propSoundConfig(spec, i, C.POWERPLANTS, B.PR), p = c.prop;
        if (c.driver !== drv) bad.push(`driver ${c.driver}`);
        if (p.blades !== bl) bad.push(`blades ${p.blades} (want ${bl})`);
        if (Math.abs(p.gear - gear) > 1e-9) bad.push(`gear ${p.gear}`);
        if (p.pinion !== pin) bad.push(`pinion ${p.pinion} (want ${pin})`);
        if (p.blades !== out.blades[i]) bad.push(`blades ${p.blades} vs the block's ${out.blades[i]}`);
        if (Math.abs(p.D - out.D[i]) > 1e-6) bad.push(`D ${p.D} vs the block's ${out.D[i]}`);
        if (!!c.turbine !== (drv === 'turbine') || !!c.electric !== (drv === 'electric')) bad.push('driver config');
      }
      const c0 = PCFG.propSoundConfig(spec, 0, C.POWERPLANTS, B.PR).prop;
      rows.push([!bad.length, `${B.key}: ${drv}, ${c0.blades} blades, D ${c0.D} m, gear ${c0.gear}, ${c0.pinion || 'no'} gear teeth, `
                 + `= the block` + (bad.length ? ' — ' + bad.join(', ') : '')]);
    }
  } finally { PCFG.PROP_SOUND_GEARBOX[0] = saved; }
  return rows;
}

// ---- §P2 ------------------------------------------------------------------------------------------------------
function secBpf(brk) {
  const rows = [];
  const Wk = worklets();
  const set = brk ? [byKey('cub'), byKey('pt6')] : BUILDS();
  for (const B of set) {
    const pc = B.engines[0].pcfg.prop;
    const worst = { err: 0, prom: 1e9, txt: [] };
    for (const u of brk ? [0.5, 1] : [0.4, 0.6, 0.8, 1.0]) {
      const rp = pc.ratedPropRpm * u, f = rp / 60 * pc.blades;
      const r = held(Wk, B, rp, { propCfg: brk === 'blades' ? { blades: pc.blades + 1 } : null });
      const pk = R.peakIn(lastSpec(r.prop, SR), 0.8 * f, 1.25 * f);
      const err = Math.abs(pk.hz / f - 1);
      worst.err = Math.max(worst.err, err); worst.prom = Math.min(worst.prom, pk.prominence);
      worst.txt.push(`${rp.toFixed(0)}:${f.toFixed(1)}->${pk.hz.toFixed(1)}`);
    }
    rows.push([worst.err <= 0.03 && worst.prom >= 20, `${B.key}: BPF within ${(worst.err * 100).toFixed(2)} % (<= 3), prominence >= `
               + `${worst.prom.toFixed(0)} dB (>= 20) [${worst.txt.join(' ')}]`]);
  }
  return rows;
}

// ---- §P3 ------------------------------------------------------------------------------------------------------
function secGearbox(brk) {
  const rows = [];
  const Wk = worklets();
  {
    const B = byKey('twin582'), rp = B.propRpm(1, true, 0), re = B.engRpm(rp);
    const ecfg = brk === 'gear' ? { gear: 1 } : null;
    const propCfg = brk === 'whine' ? { pinion: 0 } : null;
    const r = held(Wk, B, rp, { ecfg, propCfg });
    const S = lastSpec(r.y, SR), St = lastSpec(r.tonal, SR);
    const fb = rp / 60 * 2, ff = re / 60 * 2, fm = re / 60 * 21;
    const pb = R.peakIn(S, 0.9 * fb, 1.1 * fb), pf = R.peakIn(S, 0.9 * ff, 1.1 * ff), pm = R.peakIn(St, 0.97 * fm, 1.03 * fm);
    const okB = Math.abs(pb.hz / fb - 1) <= 0.03 && pb.prominence >= 20;
    const okF = Math.abs(pf.hz / ff - 1) <= 0.03 && pf.prominence >= 20;
    rows.push([okB && okF && pf.hz / pb.hz > 2, `582 full static: firing ${ff.toFixed(1)} -> ${pf.hz.toFixed(1)} Hz (+${pf.prominence.toFixed(0)} dB), `
               + `BPF ${fb.toFixed(1)} -> ${pb.hz.toFixed(1)} Hz (+${pb.prominence.toFixed(0)} dB): both, distinct (x${(pf.hz / pb.hz).toFixed(2)})`]);
    rows.push([Math.abs(pm.hz / fm - 1) <= 0.01 && pm.prominence >= 20, `582 gear mesh (21 teeth): ${fm.toFixed(0)} -> ${pm.hz.toFixed(0)} Hz (+${pm.prominence.toFixed(0)} dB, >= 20)`]);
  }
  {
    const B = byKey('cub'), rp = B.propRpm(1, true, 0);
    const r = held(Wk, B, rp);
    const S = lastSpec(r.y, SR), St = lastSpec(r.tonal, SR);
    const f = rp / 60 * 2, fm = rp / 60 * 21;
    const pk = R.peakIn(S, 0.9 * f, 1.1 * f), pm = R.peakIn(St, 0.97 * fm, 1.03 * fm);
    // no mesh: nothing at 21 x shaft that is not a harmonic of the BPF (21 is odd: a 2-blade BPF has none there)
    rows.push([Math.abs(pk.hz / f - 1) <= 0.03 && pm.prominence < 12, `the Cub (direct drive): firing = BPF = ${f.toFixed(1)} -> ${pk.hz.toFixed(1)} Hz; `
               + `no gear whine at ${fm.toFixed(0)} Hz (+${pm.prominence.toFixed(0)} dB, < 12)`]);
  }
  return rows;
}

// ---- §P4 ------------------------------------------------------------------------------------------------------
function upperShare(y, f) {
  const S = lastSpec(y, SR, 1 << 16);
  let lo = 0, hi = 0;
  for (let k = 1; k < S.mag.length; k++) {
    const fh = k * S.binHz, e = S.mag[k] * S.mag[k];
    if (fh > 0.5 * f && fh < 1.5 * f) lo += e; else if (fh >= 3.5 * f && fh < 12000) hi += e;
  }
  return 10 * Math.log10(hi / lo);
}
function secSnarl(brk) {
  const rows = [];
  const Wk = brk === 'snarl' ? worklets(mutate('* (3 - 2 * u) * this.snarlK;', '* (3 - 2 * u) * 0;')) : worklets();
  const W0 = worklets();
  const B = byKey('cub'), D = 2.3;
  const pts = [0.7, 0.8, 0.9, 0.95, 1.0];
  const on = [], off = [], txt = [];
  for (const Mh of pts) {
    const rp = Mh * 340.3 * 60 / (Math.PI * D), f = rp / 60 * 2;
    on.push(upperShare(held(Wk, B, rp, { propCfg: { D } }).tonal, f));
    off.push(upperShare(held(W0, B, rp, { propCfg: { D, snarl: 0 } }).tonal, f));
    txt.push(`${Mh}: ${on[on.length - 1].toFixed(1)} (${(on[on.length - 1] - off[off.length - 1] >= 0 ? '+' : '') + (on[on.length - 1] - off[off.length - 1]).toFixed(1)})`);
  }
  let mono = true; for (let k = 1; k < on.length; k++) if (!(on[k] > on[k - 1] + 0.5)) mono = false;
  const sub = Math.max(Math.abs(on[0] - off[0]), Math.abs(on[1] - off[1]));
  const sup = Math.min(on[3] - off[3], on[4] - off[4]);
  rows.push([mono, `upper-harmonic share (>= 3.5 BPF over the fundamental) rises with tip Mach [${txt.join(', ')}] dB`]);
  rows.push([sub <= 0.5 && sup >= 3, `the snarl: ${sub.toFixed(1)} dB below Mh 0.8 (<= 0.5), +${sup.toFixed(1)} dB at Mh 0.95-1.0 (>= 3) over the Gutin-only voice`]);
  return rows;
}

// ---- §P5 ------------------------------------------------------------------------------------------------------
const isSub = x => x !== 0 && Math.abs(x) < 1.1754943508222875e-38;
function hygiene(y, sr) {
  let finite = true, peak = 0, sub = 0, worstMean = 0, sum = 0;
  for (let k = 0; k < y.length; k++) { const v = y[k]; if (!Number.isFinite(v)) finite = false; const a = Math.abs(v); if (a > peak) peak = a; if (isSub(v)) sub++; sum += v; }
  for (let o = 0; o + sr <= y.length; o += sr) { let s = 0; for (let k = o; k < o + sr; k++) s += y[k]; worstMean = Math.max(worstMean, Math.abs(s / sr)); }
  return { finite, peak, sub, worstMean, mean: Math.abs(sum / y.length) };
}
const statesOf = ch => [ch.prop.sec, ch.prop.st, ch.prop.amp].concat(ch.drv.kind === 'piston' ? [] : [ch.drv.proc.st]);
function secHygiene(brk) {
  const rows = [];
  const Wk = worklets();
  const plan = [];
  for (const B of BUILDS()) for (const sc of RP.PSCENES ? ['runup', 'climb'] : []) plan.push([B, sc, null]);
  plan.push([byKey('cub'), 'start', null], [byKey('cub'), 'tipsweep', null], [byKey('cub'), 'takeoff', null],
            [byKey('pt6'), 'start', null], [byKey('pt6'), 'taxi', null], [byKey('electric'), 'start', null],
            [byKey('twin582'), 'runup', { engines: [0, 1] }]);
  const use = brk ? plan.filter(p => p[0].key === 'cub' && p[1] === 'climb') : plan;
  const bad = []; let peakMax = 0, meanMax = 0, winMax = 0, subS = 0, n = 0;
  for (const [B, sc, o] of use) {
    const r = RP.renderPropScene(Wk, B, sc, Object.assign({ seed: 5 }, o || {}));
    const y = r.y;
    if (brk === 'nan') y[1000] = NaN;
    if (brk === 'clip') for (let k = 0; k < y.length; k++) y[k] *= 12;
    if (brk === 'dc') for (let k = 0; k < y.length; k++) y[k] += 0.01;
    const h = hygiene(y, SR), hp = hygiene(r.prop, SR);
    for (const ch of r.chains) for (const a of statesOf(ch)) for (let k = 0; k < a.length; k++) if (isSub(a[k])) subS++;
    n++;
    peakMax = Math.max(peakMax, h.peak); meanMax = Math.max(meanMax, h.mean, hp.mean); winMax = Math.max(winMax, h.worstMean, hp.worstMean);
    if (!h.finite || h.peak >= 0.9 || h.sub || hp.sub || Math.max(h.mean, hp.mean) > 1e-3 || Math.max(h.worstMean, hp.worstMean) > 1e-2)
      bad.push(`${B.key}/${sc}${o ? '(twin)' : ''} (peak ${h.peak.toFixed(3)}, mean ${h.mean.toExponential(1)})`);
  }
  rows.push([bad.length === 0 && subS === 0, `${n} engine+prop renders: finite, peak ${peakMax.toFixed(3)} (< 0.9), DC mean ${meanMax.toExponential(1)} (< 1e-3), `
             + `worst 1-s mean ${winMax.toExponential(1)} (< 1e-2), no subnormal in the output or the voices' states (${subS})` + (bad.length ? ' — BAD: ' + bad.join(', ') : '')]);
  // after a shutdown the voices go to sleep with every state at zero (no tail can drift into the subnormals)
  if (!brk || brk === 'sleep') {
    let asleep = true, sub = 0;
    const Ws = brk === 'sleep' ? worklets(mutate('    if (quiet > 1.0) {\n      y0.fill(0); if (o1)', '    if (quiet > 1e9) {\n      y0.fill(0); if (o1)')) : Wk;
    for (const k of ['cub', 'pt6', 'electric']) {
      const B = byKey(k);
      const ch = RP.makeChain(Ws, B, 0, { state: { running: 1, rpm: 1500 } });
      RP.renderChains([ch], 30, (t, p) => { p.thr = t < 2 ? 0.5 : 0; p.running = t < 2 ? 1 : 0; p.V = 0; }, SR);
      for (const a of statesOf(ch)) for (let q = 0; q < a.length; q++) if (isSub(a[q])) sub++;
      if (!(ch.prop.stats[7] > 0)) asleep = false;
    }
    rows.push([asleep && sub === 0, `30 s after a shutdown (Cub, PT6, electric): the prop ${asleep ? 'asleep' : 'NOT ASLEEP'}, ${sub} subnormals in the states`]);
  }
  // hostile parameters, then a NaN planted in a filter: finite, and the voice comes back
  {
    const B = byKey('cub');
    const ch = RP.makeChain(Wk, B, 0, { state: { running: 1, rpm: 2000 } });
    const q = ch.pp;
    const blk = (n, f) => { const y = []; for (let b = 0; b < n; b++) { f(); ch.drv.proc.process(ch.drv.inputs, ch.drv.outputs, ch.drv.params); ch.prop.process(ch.pin, ch.pout, q); y.push(...ch.pout[0][0]); } return Float32Array.from(y); };
    ch.drv.params.rpm[0] = 2000; ch.drv.params.running[0] = 1; ch.drv.params.load[0] = 1;
    const y1 = blk(200, () => { q.rpm[0] = NaN; q.thrust[0] = Infinity; q.thr[0] = -3; q.c[0] = NaN; q.V[0] = -9; q.alpha[0] = NaN; q.beta[0] = Infinity; q.interior[0] = NaN; });
    ch.prop.sec[3] = NaN;
    const set = () => { q.rpm[0] = 2000; q.thrust[0] = 500; q.thr[0] = 1; q.c[0] = 340; q.V[0] = 0; q.alpha[0] = 0; q.beta[0] = 0; q.interior[0] = 0; };
    const y2 = blk(200, set), y3 = blk(400, set);
    let ok = hygiene(y1, SR).finite && hygiene(y2, SR).finite && hygiene(y3, SR).finite && R.stats(y3.subarray(y3.length / 2)).rms > 1e-3;
    if (brk === 'nanguard') { const y = y3.slice(); y[9] = NaN; ok = hygiene(y, SR).finite; }
    rows.push([ok, 'NaN / Infinity / negative parameters and a NaN in a filter state: finite, and the prop recovers']);
  }
  return rows;
}

// ---- §P6: in a child with --expose-gc -------------------------------------------------------------------------
function allocChild(brk) {
  const { PerformanceObserver, performance } = require('perf_hooks');
  let gcs = 0, tFrom = Infinity, tTo = Infinity;
  const obs = new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.startTime >= tFrom && e.startTime <= tTo) gcs++; });
  obs.observe({ entryTypes: ['gc'] });
  const Wk = worklets(brk === 'alloc' ? mutate('    const B = this.blades, D = this.D, R = 0.5 * D;', '    const B = this.blades, D = this.D, R = 0.5 * D; this.junk = [B, D, R];') : null);
  const BLK = R.BLOCK;
  const mk = (Cls, cfg, st) => ({ proc: new Cls({ processorOptions: Object.assign({ config: cfg, seed: 3 }, st || {}) }), params: RP.paramsOf(Cls),
                                  outs: [[new Float32Array(BLK)], [new Float32Array(BLK), new Float32Array(BLK)]] });
  const cub = byKey('cub'), pt6 = byKey('pt6'), el = byKey('electric');
  const prop = mk(Wk.P, cub.engines[0].pcfg.prop), turb = mk(Wk.T, pt6.engines[0].pcfg.turbine), elec = mk(Wk.X, el.engines[0].pcfg.electric);
  const prop2 = mk(Wk.P, pt6.engines[0].pcfg.prop);
  const ctlE = new Float32Array(BLK), ctlP = new Float32Array(BLK), inp = [[ctlE, ctlP]];
  const none = [[]], zero = [];   // (the inputs preallocated: an array literal per call would be the harness's own garbage)
  const phase = b => {
    const t = b % 6000;
    const run = t >= 400 && t < 4500 ? 1 : 0;
    const rp = t < 400 ? 0.1 * t : t < 4500 ? 900 + 1400 * ((t >> 8) & 1) : Math.max(0, 2300 - (t - 4500) * 3);
    for (let k = 0; k < BLK; k++) { ctlP[k] = rp * 0.001; ctlE[k] = rp * 0.001; }
    const q = prop.params; q.rpm[0] = rp; q.thrust[0] = 300 + 300 * ((t >> 7) & 1); q.thr[0] = run; q.V[0] = (t >> 9) & 7;
    q.alpha[0] = 0.05 * ((t >> 6) & 3); q.beta[0] = 0.02 * ((t >> 8) & 1); q.interior[0] = (t >> 10) & 1;
    for (const d of [turb, elec]) { d.params.rpm[0] = run ? 1900 : 0; d.params.power[0] = (t >> 9) & 1; d.params.running[0] = run; d.params.starter[0] = t < 400 ? 1 : 0; }
    const q2 = prop2.params; q2.rpm[0] = rp; q2.thrust[0] = 50 * ((t >> 8) & 1); q2.thr[0] = 0.1; q2.V[0] = 3;
  };
  const step = b => { phase(b); prop.proc.process(inp, prop.outs, prop.params); prop2.proc.process(none, prop2.outs, prop2.params);
                      turb.proc.process(zero, turb.outs, turb.params); elec.proc.process(zero, elec.outs, elec.params); };
  for (let b = 0; b < 12000; b++) step(b);
  return new Promise(res => setImmediate(() => {
    global.gc(); global.gc();
    const h0 = process.memoryUsage().heapUsed;
    tFrom = performance.now();
    for (let b = 0; b < 20000; b++) step(b);
    tTo = performance.now();
    const h1 = process.memoryUsage().heapUsed;
    setTimeout(() => { obs.disconnect(); res({ gcs, dHeap: h1 - h0 }); }, 50);
  }));
}
function secAlloc(brk) {
  const r = spawnSync(process.execPath, ['--expose-gc', __filename, '--prop-alloc-child', brk || ''], { encoding: 'utf8' });
  let o = null;
  try { o = JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (e) { o = null; }
  if (!o) return [[false, 'the allocation child did not report: ' + (r.stderr || '').slice(0, 300)]];
  return [[o.gcs === 0 && o.dHeap < 64 * 1024, `prop (driven + fallback), turbine, electric process() over 20 000 blocks through every state: `
           + `${o.gcs} GCs, heap ${(o.dHeap / 1024).toFixed(1)} kB (0 GCs, < 64 kB)`]];
}

// ---- §P7 ------------------------------------------------------------------------------------------------------
function envelopeAt(bb, sr, f) {
  // |broadband| low-passed at 400 Hz, decimated by 8: the chop's modulation, read at the BPF
  const n = bb.length, dec = 8, m = Math.floor(n / dec), env = new Float32Array(m);
  let lp = 0; const a = 1 - Math.exp(-2 * Math.PI * 400 / sr);
  for (let k = 0, j = 0; k < n; k++) { lp += a * (Math.abs(bb[k]) - lp); if (k % dec === dec - 1) env[j++] = lp; }
  let mean = 0; for (let j = 0; j < m; j++) mean += env[j]; mean /= m;
  for (let j = 0; j < m; j++) env[j] -= mean;
  const len = Math.floor(1.5 * sr / dec);
  const S = R.spectrum(env, m - len, len, sr / dec, 1 << 15);
  return { pk: R.peakIn(S, 0.9 * f, 1.1 * f), mean };
}
function secLife(brk) {
  const rows = [];
  const Wk = brk === 'chop' ? worklets(mutate('const mod = 1 + ch * (pulse - 0.375) / 0.625;', 'const mod = 1 + 0 * (pulse - 0.375) / 0.625;')) : worklets();
  const at_ = (arr, t) => arr[Math.min(arr.length - 1, Math.floor(t * SR / R.BLOCK))];
  // THE PROP FOLLOWS ITS ENGINE: the Cub's key (crank 0.6-2.1 s, the solver's rpm 0 there), run-down after 16 s
  {
    const B = byKey('cub');
    // the prop's own BPF stat, per block
    const ch = RP.makeChain(Wk, B, 0, { seed: 2, unwired: brk === 'unwired' });
    const S = RP.PSCENES.start, sc = S.scene(B), p = { thr: 0, V: 0, alpha: 0, beta: 0, running: 0, starter: 0 };
    const nb = Math.ceil(S.seconds * SR / R.BLOCK), bpf = new Float32Array(nb), solver = new Float32Array(nb);
    for (let b = 0; b < nb; b++) { sc(b * R.BLOCK / SR, p); RP.stepChain(ch, p); bpf[b] = ch.prop.stats[6]; solver[b] = B.propRpm(p.thr, !!p.running, 0); }
    const crankBpf = at_(bpf, 1.8), crankSolver = at_(solver, 1.8);
    const idleBpf = at_(bpf, 6), downBpf = at_(bpf, 16.4), stopBpf = at_(bpf, 21.5);
    rows.push([crankBpf > 4 && crankSolver === 0, `the Cub's crank: the prop turns with the engine voice (BPF ${crankBpf.toFixed(1)} Hz) while the solver says ${crankSolver} rpm`]);
    rows.push([downBpf > 0.3 * idleBpf && stopBpf < 0.05 * idleBpf, `the run-down: 0.4 s after the key off the BPF is ${(downBpf / idleBpf * 100).toFixed(0)} % of idle (> 30), at 5.5 s ${(stopBpf / idleBpf * 100).toFixed(0)} % (< 5)`]);
  }
  // THE TURBINE: Ng from the power fraction, its spool, the first stage's tone
  {
    const B = byKey('pt6'), tc = Object.assign({}, B.engines[0].pcfg.turbine);
    if (brk === 'ngidle') tc.ngIdle = 0.7;
    const T = new Wk.T({ processorOptions: { config: tc, seed: 1, running: 1, rpm: 1900 } });
    const pr = RP.paramsOf(Wk.T), outs = [[new Float32Array(R.BLOCK)], [new Float32Array(R.BLOCK), new Float32Array(R.BLOCK)]];
    const run = (sec, pw, on) => { const n = Math.ceil(sec * SR / R.BLOCK), y = new Float32Array(n * R.BLOCK);
      for (let b = 0; b < n; b++) { pr.rpm[0] = on ? 1900 : 0; pr.power[0] = pw; pr.running[0] = on; pr.starter[0] = 0; T.process([], outs, pr); y.set(outs[0][0], b * R.BLOCK); } return y; };
    const yI = run(12, 0, 1); const ngIdle = T.stats[0];
    const yF = run(12, 1, 1); const ngFull = T.stats[0];
    run(2, 0, 0); const ngDown = T.stats[0];
    const f1 = ngIdle * 37500 / 60 * 26;
    const pk = R.peakIn(lastSpec(yI, SR), 0.97 * f1, 1.03 * f1);
    void yF;
    rows.push([Math.abs(ngIdle - 0.52) < 0.02 && Math.abs(ngFull - 1.01) < 0.02 && ngDown > 0.3,
               `PT6: Ng ${(ngIdle * 100).toFixed(1)} % at idle (52), ${(ngFull * 100).toFixed(1)} % at full power (101), ${(ngDown * 100).toFixed(0)} % 2 s after shutdown (> 30: the whine down)`]);
    rows.push([Math.abs(pk.hz / f1 - 1) < 0.01 && pk.prominence >= 20, `PT6 idle: the first compressor stage at Ng x 26 = ${f1.toFixed(0)} -> ${pk.hz.toFixed(0)} Hz (+${pk.prominence.toFixed(0)} dB)`]);
  }
  // THE BETA BUZZ: the PT6 at taxi (Np held, no thrust) vs its take-off (full thrust)
  {
    const B = byKey('pt6');
    const rT = RP.renderPropScene(Wk, B, 'taxi', { seconds: 4 }), bzT = rT.chains[0].prop.stats[5];
    const rO = RP.renderPropScene(Wk, B, 'climb', { seconds: 3 }), bzO = rO.chains[0].prop.stats[5];
    rows.push([bzT > 0.5 && bzO === 0, `PT6 beta buzz: ${bzT.toFixed(2)} at taxi (> 0.5), ${bzO.toFixed(2)} in the climb (0)`]);
  }
  // THE ELECTRIC WHINE: 6 x pole pairs x rpm / 60, with the current
  {
    const B = byKey('electric'), ec = Object.assign({}, B.engines[0].pcfg.electric);
    if (brk === 'poles') ec.polePairs += 1;
    const X = new Wk.X({ processorOptions: { config: ec, seed: 1, running: 1, rpm: 2000 } });
    const pr = RP.paramsOf(Wk.X), outs = [[new Float32Array(R.BLOCK)], [new Float32Array(R.BLOCK), new Float32Array(R.BLOCK)]];
    const run = (sec, pw) => { const n = Math.ceil(sec * SR / R.BLOCK), y = new Float32Array(n * R.BLOCK);
      for (let b = 0; b < n; b++) { pr.rpm[0] = 2000; pr.power[0] = pw; pr.running[0] = 1; X.process([], outs, pr); y.set(outs[0][0], b * R.BLOCK); } return y; };
    const yLo = run(2.6, 0.1), yHi = run(2.6, 1);
    const f = 6 * 10 * 2000 / 60;
    const pk = R.peakIn(lastSpec(yHi, SR), 0.97 * f, 1.03 * f);
    const lo = R.stats(yLo.subarray(yLo.length / 2)).rms, hi = R.stats(yHi.subarray(yHi.length / 2)).rms;
    rows.push([Math.abs(pk.hz / f - 1) < 0.01 && pk.prominence >= 20 && hi > 2 * lo,
               `E-811 at 2000 rpm: the torque ripple 6 x 10 pole pairs = ${f.toFixed(0)} -> ${pk.hz.toFixed(0)} Hz (+${pk.prominence.toFixed(0)} dB), x${(hi / lo).toFixed(1)} louder at full current`]);
  }
  // THE CHOP: the broadband's modulation at BPF, the Cub at Vy level (alpha 0.03) vs climbing (alpha 0.2, sideslip 0.08)
  {
    const B = byKey('cub'), rp = 2300, f = rp / 60 * 2;
    const lev = held(Wk, B, rp, { V: B.vy, alpha: 0.03, seconds: 2.0 }), clb = held(Wk, B, rp, { V: B.vy, alpha: 0.2, beta: 0.08, seconds: 2.0 });
    const eL = envelopeAt(lev.bb, SR, f), eC = envelopeAt(clb.bb, SR, f);
    const dL = eL.pk.db - 20 * Math.log10(eL.mean), dC = eC.pk.db - 20 * Math.log10(eC.mean);
    rows.push([eC.pk.prominence >= 15 && dC - dL >= 6, `the chop at BPF (${f.toFixed(1)} Hz) in the broadband's envelope: +${eC.pk.prominence.toFixed(0)} dB climbing, `
               + `${(dC - dL).toFixed(1)} dB deeper than level (>= 6)`]);
  }
  return rows;
}

// ---- §P8 ------------------------------------------------------------------------------------------------------
function secCpu(brk) {
  const rows = [];
  const Wk = worklets();
  const time = (fn, blocks) => { const t0 = process.hrtime.bigint(); for (let b = 0; b < blocks; b++) fn(); return Number(process.hrtime.bigint() - t0) / 1e6 / blocks; };
  for (const k of brk ? ['cub'] : ['cub', 'twin582', 'pt6', 'electric']) {
    const B = byKey(k);
    const ch = RP.makeChain(Wk, B, 0, { state: { running: 1, rpm: 2000 } });
    if (brk === 'cpu') { const p0 = ch.prop.process.bind(ch.prop); ch.prop.process = (a, b, c) => { const t = Date.now() + 2; while (Date.now() < t); return p0(a, b, c); }; }
    const p = { thr: 0.8, V: 30, alpha: 0.1, beta: 0.02, running: 1, starter: 0, interior: 0 };
    for (let b = 0; b < 1500; b++) RP.stepChain(ch, p);
    const n = brk ? 300 : 3000;
    const tProp = time(() => ch.prop.process(ch.pin, ch.pout, ch.pp), n);
    const tDrv = ch.driver === 'piston' ? 0 : time(() => ch.drv.proc.process(ch.drv.inputs, ch.drv.outputs, ch.drv.params), n);
    rows.push([tProp < 0.5 && tDrv < 0.3, `${k}: prop ${tProp.toFixed(3)} ms per 128-frame block (< 0.5)` + (ch.driver !== 'piston' ? `, ${ch.driver} ${tDrv.toFixed(3)} ms (< 0.3)` : '')
               + ` — real time is ${(R.BLOCK / SR * 1000).toFixed(2)} ms`]);
  }
  return rows;
}

// ---- §P9: the sources, under a stubbed Web Audio, the real audio.js and the real solver ---------------------
const SRC_FILES = ['src/viewer/audio/audio_params.js', 'src/viewer/audio/audio.js', 'src/viewer/audio/engine_config.js',
                   'src/viewer/audio/src_engine.js', 'src/viewer/audio/prop_config.js', 'src/viewer/audio/src_prop.js'];
const SRC_TEXT = {}; for (const f of SRC_FILES) SRC_TEXT[f] = fs.readFileSync(at(f), 'utf8');
function makeAudioPage(texts, opt) {
  opt = opt || {};
  const C0 = { sched: 0, schedSrc: {}, nodes: [], modules: {}, resolve: {} };
  const desc = {
    'flydiy-engine': R.loadWorklet(SR).Processor.parameterDescriptors,
    'flydiy-prop': worklets().P.parameterDescriptors, 'flydiy-turbine': worklets().T.parameterDescriptors, 'flydiy-electric': worklets().X.parameterDescriptors,
  };
  // the counting AudioParam: no store (a stub that stored the double would itself allocate)
  const mkParam = (owner) => ({ value: 0, setTargetAtTime() { C0.sched++; owner.sched++; }, setValueAtTime() { C0.sched++; owner.sched++; },
    linearRampToValueAtTime() { C0.sched++; }, cancelScheduledValues() {} });
  const plain = () => { const n = { sched: 0, edges: [], connect(d, o, i) { n.edges.push({ d, o: o | 0, i: i | 0 }); return d; },
    disconnect(d, o) { n.edges = d === undefined ? [] : n.edges.filter(e => !(e.d === d && (o === undefined || e.o === o))); } }; return n; };
  class AWN {
    constructor(ctx, name, opts) {
      const n = plain(); Object.assign(this, n); this.connect = n.connect; this.disconnect = (d, o) => { n.disconnect(d, o); this.edges = n.edges; };
      this.edges = n.edges; const self = this; this.connect = (d, o, i) => { self.edges.push({ d, o: o | 0, i: i | 0 }); return d; };
      this.disconnect = (d, o) => { self.edges = d === undefined ? [] : self.edges.filter(e => !(e.d === d && (o === undefined || e.o === o))); };
      this.name = name; this.opts = opts; this.sched = 0; this.dead = false;
      this.parameters = new Map(); for (const d of desc[name]) this.parameters.set(d.name, mkParam(this));
      C0.nodes.push(this);
    }
  }
  class AC {
    constructor() { this.currentTime = 0; this.sampleRate = 48000; this.destination = plain();
      this.audioWorklet = { addModule: u => { const stem = /([a-z_]+)\.js/.exec(u)[1]; return new Promise(res => { C0.resolve[stem] = res; C0.modules[stem] = u; if (!opt.manual) res(); }); } }; }
    createGain() { const n = plain(); n.gain = mkParam(n); return n; }
    createDynamicsCompressor() { const n = plain(); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = mkParam(n); return n; }
    createBiquadFilter() { const n = plain(); n.frequency = mkParam(n); n.Q = mkParam(n); n.type = ''; return n; }
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); }
  }
  const L = {};
  const win = {
    location: { search: '' }, localStorage: { getItem: () => null, setItem() {} },
    performance: { now: () => 0 }, addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); }, removeEventListener() {},
    document: { hidden: false, hasFocus: () => true, addEventListener() {}, removeEventListener() {} },
    AudioContext: AC, AudioWorkletNode: AWN, POWERPLANTS: C.POWERPLANTS, GEN_SHAFT: C.GEN_SHAFT,
    console: { warn: (...a) => { C0.warn = (C0.warn || []).concat(a.map(String)); }, log() {}, error() {} },
    setTimeout: () => 0, clearTimeout() {}, URLSearchParams,
  };
  win.window = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  for (const f of SRC_FILES) vm.runInContext(texts[f], ctx, { filename: f });
  return { A: win.AUDIO, C: C0, win, gesture: () => { for (const f of (L.pointerdown || []).slice()) f({ type: 'pointerdown' }); } };
}
const flush = () => new Promise(r => setImmediate(r));
function flown(key, steps) {
  const B = byKey(key);
  const def = C.buildGen(clone(B.spec)), sim = C.makeSim(def, null);
  sim.reset(0); sim.ctl.thr = 1;
  for (let i = 0; i < (steps || 30); i++) sim.step(1 / 60);
  return { B, def, sim };
}
const CAMERA = { position: { x: 0, y: 2, z: 10 } }, CAM = { mode: 'chase' };
const live = (C0, name) => C0.nodes.filter(n => n.name === name && !n.dead);
async function secSource(brk) {
  const rows = [];
  const texts = Object.assign({}, SRC_TEXT);
  const sp = 'src/viewer/audio/src_prop.js';
  const swap = (f, a, b) => { if (!texts[f].includes(a)) throw new Error('sabotage anchor gone: ' + a); texts[f] = texts[f].replace(a, b); };
  if (brk === 'wire') swap(sp, '    if (en) en.connect(v.node, 1, 0);', '');
  if (brk === 'sched') swap(sp, '          if (Math.abs(x - lastP[o + j]) <= eps) continue;', '');
  if (brk === 'rebuild') swap(sp, '      if (P.def !== def) build(P);', '      if (def === null) build(P);');
  if (brk === 'hook') swap('src/viewer/audio/src_engine.js', '      pub.engine[i] = node;', '');
  const pg = makeAudioPage(texts, { manual: true });
  pg.gesture();
  // THE PROP MODULE LOADS FIRST, the engine's after: the prop must wire itself to the engine node when it appears
  pg.C.resolve.prop_worklet(); await flush();
  const cub = flown('cub');
  for (let f = 0; f < 3; f++) pg.A.update(cub.sim, CAMERA, 1 / 60, cub.def, CAM, false, null);
  pg.C.resolve.engine_worklet(); await flush();
  for (let f = 0; f < 3; f++) pg.A.update(cub.sim, CAMERA, 1 / 60, cub.def, CAM, false, null);
  const edgesTo = (src, dst) => src.edges.filter(e => e.d === dst);
  {
    const E = live(pg.C, 'flydiy-engine'), Pp = live(pg.C, 'flydiy-prop');
    const w = E.length === 1 && Pp.length === 1 ? edgesTo(E[0], Pp[0]) : [];
    rows.push([E.length === 1 && Pp.length === 1 && w.length === 1 && w[0].o === 1 && w[0].i === 0,
               `the Cub: ${E.length} engine voice, ${Pp.length} prop, the engine's output 1 -> the prop's input 0 (${w.length} edge${w.length === 1 ? '' : 's'}), the prop module loaded first`]);
  }
  // a NEW DEF: the twin 582 -> two engines, two props, each prop wired to ITS engine (the old ones gone)
  const oldProp = live(pg.C, 'flydiy-prop')[0], oldEng = live(pg.C, 'flydiy-engine')[0];
  const twin = flown('twin582');
  for (let f = 0; f < 3; f++) pg.A.update(twin.sim, CAMERA, 1 / 60, twin.def, CAM, false, null);
  {
    const Pp = pg.C.nodes.filter(n => n.name === 'flydiy-prop' && n !== oldProp), E = pg.C.nodes.filter(n => n.name === 'flydiy-engine' && n !== oldEng);
    const ok = Pp.length === 2 && E.length === 2 && [0, 1].every(k => {
      const e = E.find(n => n.opts.processorOptions.config.engineIndex === k), p = Pp[k];
      return e && edgesTo(e, p).length === 1 && edgesTo(e, p)[0].o === 1 && E.every(o => o === e || edgesTo(o, p).length === 0);
    });
    const stale = edgesTo(oldEng, oldProp).length + oldProp.edges.length;
    rows.push([ok && stale === 0, `a new aeroplane (the twin 582): ${E.length} engines, ${Pp.length} props, each prop on its own engine's output 1; the old prop's edges ${stale} (0)`]);
  }
  // the PT6 and the electric: their driver made here, its output 1 into the prop, no piston node
  for (const key of ['pt6', 'electric']) {
    const before = pg.C.nodes.length;
    const fl = flown(key);
    for (let f = 0; f < 3; f++) pg.A.update(fl.sim, CAMERA, 1 / 60, fl.def, CAM, false, null);
    const made = pg.C.nodes.slice(before);
    const drv = made.filter(n => n.name === 'flydiy-' + (key === 'pt6' ? 'turbine' : 'electric')), Pp = made.filter(n => n.name === 'flydiy-prop');
    const pist = made.filter(n => n.name === 'flydiy-engine');
    const w = drv.length === 1 && Pp.length === 1 ? edgesTo(drv[0], Pp[0]) : [];
    rows.push([drv.length === 1 && Pp.length === 1 && pist.length === 0 && w.length === 1 && w[0].o === 1,
               `${key}: ${drv.length} ${key === 'pt6' ? 'turbine' : 'electric'} voice, ${Pp.length} prop, ${pist.length} piston voices, driver output 1 -> prop (${w.length})`]);
  }
  // A STEADY FRAME SCHEDULES NOTHING: the Cub again, the sim frozen, 120 frames after 10 to settle
  {
    for (let f = 0; f < 10; f++) pg.A.update(cub.sim, CAMERA, 1 / 60, cub.def, CAM, false, null);
    const mine = () => pg.C.nodes.filter(n => n.name !== 'flydiy-engine').reduce((s, n) => s + n.sched, 0);
    const s0 = mine();
    for (let f = 0; f < 120; f++) pg.A.update(cub.sim, CAMERA, 1 / 60, cub.def, CAM, false, null);
    const d = mine() - s0;
    rows.push([d === 0, `a steady frame: the prop and driver params scheduled ${d} times over 120 frames (0)`]);
  }
  if (!brk || brk === 'srcalloc') {
    const r = spawnSync(process.execPath, ['--expose-gc', '--max-semi-space-size=64', __filename, '--src-alloc-child', brk || ''], { encoding: 'utf8' });
    let o = null; try { o = JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (e) { o = null; }
    rows.push(o ? [o.gcs === 0 && o.dHeap < 256 * 1024 && o.sched > 100, `AUDIO.update with the engine + prop sources, the twin 582 then the PT6 (rpm and thrust moving): `
                   + `${o.gcs} GCs over 10 000 frames, heap ${(o.dHeap / 1024).toFixed(1)} kB, ${o.sched} schedules, ${(o.ms * 1000).toFixed(1)} us a frame`]
                 : [false, 'the source allocation child did not report: ' + (r.stderr || '').slice(0, 300)]);
  }
  return rows;
}
async function srcAllocChild(brk) {
  const { PerformanceObserver, performance } = require('perf_hooks');
  let gcs = 0, tFrom = Infinity, tTo = Infinity;
  const obs = new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.startTime >= tFrom && e.startTime <= tTo) gcs++; });
  obs.observe({ entryTypes: ['gc'] });
  const texts = Object.assign({}, SRC_TEXT);
  if (brk === 'srcalloc') texts['src/viewer/audio/src_prop.js'] = texts['src/viewer/audio/src_prop.js'].replace('        wire(k);', '        wire(k); v.junk = [k, P];');
  const pg = makeAudioPage(texts);
  pg.gesture(); await flush();
  // a WORKER-SHAPED sim (the snapshot's plain objects, as sim_link.js mirrors them): the inline solver's own
  // wheelContacts() allocates per call (GATE AUDIO reports it; not ours)
  const snapOf = (fl) => {
    const o = fl.sim.out, nE = fl.def.params.nEngines || 1;
    const WC = { mains: [true, true], tw: true, water: false };
    return { out: { V: o.V, Veas: o.Veas, Vg: o.Vg, alpha: o.alpha, beta: 0.01, nz: 1, vs: 0, alt: 10, oatC: 15, rho: 1.225, thrust: o.thrust,
                    wash: 0, starved: false, energyFrac: 1, hydroWet: 0, submerged: false,
                    rpm: Float64Array.from(o.rpm.slice(0, nE)), rpmEng: Float64Array.from(o.rpmEng.slice(0, nE)), thrustPer: Float64Array.from(o.thrustPer.slice(0, nE)) },
             ctl: { thr: 1, eng: null, flap: 0, brake: 0, de: 0, da: 0, dr: 0 },
             eng: Array.from({ length: nE }, () => ({ running: true, crank: 0, key: 'both' })), p: new Float64Array(30), wheelContacts: () => WC };
  };
  const a = flown('twin582'), b = flown('pt6');
  const SA = snapOf(a), SB = snapOf(b);
  const cam = { position: { x: 1, y: 2, z: 3 } };
  const run = (S, def, n, from) => {
    for (let f = 0; f < n; f++) {
      const k = ((f + from) >> 5) & 1;   // every 32 frames the rpm and the thrust move
      S.out.rpm[0] = 2000 + 300 * k; S.out.rpmEng[0] = S.out.rpm[0] * (def === a.def ? 2.62 : 1); S.out.thrustPer[0] = 400 + 200 * k;
      pg.A.update(S, cam, 1 / 60, def, CAM, false, null);
    }
  };
  run(SA, a.def, 2000, 0); run(SB, b.def, 2000, 0); run(SA, a.def, 2000, 0);
  await flush();
  global.gc(); global.gc();
  const s0 = pg.C.sched, h0 = process.memoryUsage().heapUsed;
  tFrom = performance.now();
  run(SA, a.def, 10000, 7);
  tTo = performance.now();
  const h1 = process.memoryUsage().heapUsed;
  await new Promise(r => setTimeout(r, 50));
  obs.disconnect();
  return { gcs, dHeap: h1 - h0, sched: pg.C.sched - s0, ms: (tTo - tFrom) / 10000 };
}

const PROP_SECTIONS = [
  ['§P1 PCONFIG', secConfig, ['blades', 'pinion']],
  ['§P2 BPF', secBpf, ['blades']],
  ['§P3 GEARBOX', secGearbox, ['gear', 'whine']],
  ['§P4 SNARL', secSnarl, ['snarl']],
  ['§P5 PHYGIENE', secHygiene, ['nan', 'clip', 'dc', 'sleep', 'nanguard']],
  ['§P6 PALLOC', secAlloc, ['alloc']],
  ['§P7 PLIFE', secLife, ['unwired', 'ngidle', 'poles', 'chop']],
  ['§P8 PCPU', secCpu, ['cpu']],
  ['§P9 SOURCE', secSource, ['wire', 'sched', 'rebuild', 'hook', 'srcalloc']],
];
module.exports = { PROP_SECTIONS, loadPropText, worklets, held };

async function main() {
  const QUICK = process.argv.includes('--quick');
  const ONLY = ((process.argv.find(a => a.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean);
  const wanted = name => !ONLY.length || ONLY.includes(name.split(' ')[0].slice(1));
  let fails = 0; const t0 = Date.now();
  for (const [name, fn] of PROP_SECTIONS) {
    if (!wanted(name)) continue;
    console.log(name);
    for (const [c, l] of await fn(null)) { console.log((c ? '  ok     ' : '  FAIL   ') + l); if (!c) fails++; }
  }
  if (!QUICK) {
    console.log('NEGATIVE CONTROLS (each sabotage must turn its section red)');
    for (const [name, fn, sab] of PROP_SECTIONS) for (const s of (wanted(name) ? sab : [])) {
      const rows = await fn(s), first = rows.find(r => !r[0]);
      console.log((first ? '  ok     ' : '  FAIL   ') + `${name} / ${s}: red` + (first ? ` — ${first[1].slice(0, 110)}` : ' — STAYED GREEN'));
      if (!first) fails++;
    }
  }
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log(fails ? `PROP SECTIONS: FAIL (${fails})` : 'PROP SECTIONS: PASS');
  process.exitCode = fails ? 1 : 0;
}
if (require.main === module) {
  if (process.argv.includes('--prop-alloc-child')) {
    allocChild(process.argv[process.argv.indexOf('--prop-alloc-child') + 1] || null).then(o => console.log(JSON.stringify(o)));
  } else if (process.argv.includes('--src-alloc-child')) {
    srcAllocChild(process.argv[process.argv.indexOf('--src-alloc-child') + 1] || null).then(o => console.log(JSON.stringify(o)));
  } else main();
}
