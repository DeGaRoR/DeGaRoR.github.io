#!/usr/bin/env node
// GATE AUDIO (G1604, SOUND-2026-10-04 §8) - the sound's skeleton, in node (no Web Audio, no browser):
//   A  THE NUMBERS  audio_params.js on the validated builds - the user's Cub, the Jodel, the Cessna (its custom 4-cyl),
//                   the metal Cessna (O-540), the Cessna on Wipline floats, the twin-582 ultralight - each built
//                   (buildGen), flown 0.5 s at full throttle by the real solver, then read: rpm / rpmEng are the
//                   solver's to the float, rpmEng = rpm x gear (the registry's law), firing = rpmEng/60 x cyl/2
//                   (x cyl on a two-stroke), BPF = rpm/60 x blades, tip Mach = pi D rpm/60 / c(oatC), the per-engine
//                   lever (ctl.thr x ctl.eng[i]), the key, the per-aeroplane constants against a declared table.
//                   The contacts (mains / tail / water, the surface code under each, read at 30 Hz), the listener
//                   (the camera mode, interior = the cockpit eye outside the shed), on a stub sim.
//   B  THE BUDGET   AUDIO.update over 10 000 frames on a worker-shaped sim (the snapshot's objects, as sim_link.js
//                   mirrors them) with two sources: no heap growth (no GC during the window, measured with
//                   --max-semi-space-size large), mean under 0.3 ms, and no AudioParam scheduled in a steady frame.
//                   The INLINE solver's own wheelContacts() allocation is reported (not ours: 30 Hz, the solver's).
//   C  THE GESTURE  nothing constructed before the first pointerdown / keydown (a stub AudioContext counts), one
//                   context after it, the listeners gone; ?audio=0 and flydiy.audio = '0' construct NOTHING (no
//                   listener, no block, no context, before or after a gesture); ?audio=1 outranks the pref; no Web
//                   Audio -> 'unsupported', no throw. THE SILENCE: hidden / pause / unfocused (the setting) fade to 0
//                   over 0.2 s, then suspend; back -> resume. THE SETTINGS: persisted under flydiy.audio.*, read back,
//                   a throwing localStorage is survived. THE GAINS: perspective cross-fade, headset, music in flight.
//                   THE SOURCES: connect after the gesture, update per frame, a throwing one switched off, same name
//                   replaces; 'ready' and 'perspective' events.
//   W  THE WIRING   the build lists audio_params.js, audio.js before app.js, MANIFEST.audio.modules publishes
//                   FLYDIY_AUDIO_SRC; app.js calls AUDIO.update ONCE, in loop() after the render; both rails carry
//                   the `audio` item.
//   D  THE SELFTEST every check above is run again on MUTATED source text (in memory: nothing on disk is touched)
//                   and must go red; then the files on disk are re-read and must be byte-identical to the start.
//   node tools/audio/_audio_check.js             -> the checks + the selftest -> "GATE AUDIO: PASS|FAIL"
//   node tools/audio/_audio_check.js --selftest  -> the selftest alone, each mutation's caught checks listed
//   node tools/audio/_audio_check.js --only=AFMODEL,SAMPLES  -> those checks (and their mutations) only: a debugging aid, never a PASS
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { execFileSync } = require('child_process');

// the allocation probe wants gc() and a young generation that will not scavenge inside the measured window
if (typeof global.gc !== 'function') {
  try {
    execFileSync(process.execPath, ['--expose-gc', '--max-semi-space-size=64', __filename, ...process.argv.slice(2)], { stdio: 'inherit' });
    process.exit(0);
  } catch (e) { process.exit(e.status || 1); }
}
const { performance, PerformanceObserver } = require('perf_hooks');

const ROOT = path.join(__dirname, '..', '..');
const FILES = {
  params: 'src/viewer/audio/audio_params.js', audio: 'src/viewer/audio/audio.js',
  app: 'src/viewer/app.js', editor: 'src/viewer/editor.js', build: 'tools/build.js',
  // SND-AIRFRAME (G1630-G1635): the model, the voice, the source, the sample slots
  model: 'src/viewer/audio/airframe_model.js', worklet: 'src/viewer/audio/airframe_worklet.js',
  srcaf: 'src/viewer/audio/src_airframe.js', samples: 'src/viewer/audio/samples.js',
  // G1674 (SND-MUSIC): the player, the engine's events, the catalogue, the credits
  music: 'src/viewer/audio/music.js', engine: 'src/viewer/audio/src_engine.js',
  catalogue: 'src/viewer/audio/music_catalogue.json', credits: 'CREDITS.md',
};
const readAll = () => { const S = {}; for (const k in FILES) S[k] = fs.readFileSync(path.join(ROOT, FILES[k]), 'utf8'); return S; };
const shaOf = S => crypto.createHash('sha256').update(Object.keys(FILES).map(k => S[k]).join('\u0000')).digest('hex');
const SRC0 = readAll(), SHA0 = shaOf(SRC0);
const ONLY_SELFTEST = process.argv.includes('--selftest');

const FC = require(path.join(ROOT, 'tools', 'flight_core.js'));
const { buildGen, makeSim, POWERPLANTS } = FC;

// ---- loading the two files from TEXT (so a mutation is a string, never a file) --------------------------------
function loadParams(text) {
  const ctx = { module: { exports: {} }, POWERPLANTS };
  vm.runInNewContext(text, ctx, { filename: 'audio_params.js' });
  return ctx.module.exports;
}
// a page for audio.js: window, document, localStorage, the listeners, a counting AudioContext and manual timers
function makePage(S, opt) {
  opt = opt || {};
  const C = { ctx: 0, nodes: 0, sched: 0, suspend: 0, resume: 0, close: 0, listen: 0, curves: 0, media: 0 };
  const L = {}, DL = {}, timers = [];
  const store = opt.store || {};
  // an AudioParam that keeps its automation (G1674: the music's fades are read back off it with at(t))
  const params = [];
  const param = v => { const p = { value: v, v0: v, ev: [],
    setTargetAtTime(x, t, tau) { this.value = x; C.sched++; this.ev.push({ k: 'T', v: x, t: +t || 0, tau }); },
    cancelScheduledValues(t) { const a = this.ev, tt = +t || 0, keep = [];
      for (const e of a) { if (e.t >= tt) continue; if (e.k === 'C' && e.t + e.d > tt) { keep.push({ k: 'V', v: this.at(tt), t: e.t }); continue; } keep.push(e); }
      this.ev = keep; },
    setValueAtTime(x, t) { this.value = x; C.sv = (C.sv || 0) + 1; this.ev.push({ k: 'V', v: x, t: +t || 0 }); },
    linearRampToValueAtTime(x, t) { this.value = x; C.sched++; this.ev.push({ k: 'L', v: x, t: +t || 0 }); },
    setValueCurveAtTime(c, t, d) { C.sched++; C.curves++; this.value = c[c.length - 1]; this.ev.push({ k: 'C', c: Float32Array.from(c), t: +t || 0, d }); },
    // the value at time T (the events in order, each from the value the last one left)
    at(T) { let v = this.v0, tv = 0; const a = this.ev.slice().sort((x, y) => x.t - y.t);
      const run = (e, tEnd) => { const dt = Math.max(0, tEnd - e.t);
        if (e.k === 'V') return e.v;
        if (e.k === 'T') return e.v + (v - e.v) * Math.exp(-dt / e.tau);
        if (e.k === 'L') return e.v;
        const x = Math.min(1, dt / e.d) * (e.c.length - 1), i = Math.floor(x); return i >= e.c.length - 1 ? e.c[e.c.length - 1] : e.c[i] + (e.c[i + 1] - e.c[i]) * (x - i); };
      for (let i = 0; i < a.length; i++) { const e = a[i]; if (e.t > T) break; const nx = i + 1 < a.length && a[i + 1].t <= T ? a[i + 1].t : T;
        if (e.k === 'L') { const f = (T - tv) / Math.max(1e-9, e.t - tv); v = e.t <= T ? e.v : v + (e.v - v) * f; } else v = run(e, nx); tv = e.t; }
      return v; } };
    params.push(p); return p; };
  const node = () => ({ connect() {}, disconnect() {} });
  // (opt.airframe: a SYNCHRONOUS thenable, so a source's module().then(...) has run before the check's next line)
  const syncP = v => ({ then(f) { return syncP(f ? f(v) : v); }, catch() { return this; } });
  class AudioContextStub {
    constructor() { C.ctx++; this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; this.audioWorklet = { addModule: u => { C.module = u; (C.modules = C.modules || []).push(u); return opt.airframe ? syncP() : Promise.resolve(); } }; }
    createGain() { C.nodes++; return Object.assign(node(), { gain: param(1) }); }
    createDynamicsCompressor() { C.nodes++; return Object.assign(node(), { threshold: param(0), knee: param(0), ratio: param(0), attack: param(0), release: param(0) }); }
    createMediaElementSource(el) { C.media++; if (el._src) throw new Error('an element connected twice'); el._src = true; return node(); }
    resume() { C.resume++; return Promise.resolve(); }
    suspend() { C.suspend++; return Promise.resolve(); }
    close() { C.close++; return Promise.resolve(); }
  }
  const on = (M) => ({ add(t, fn) { (M[t] = M[t] || []).push(fn); C.listen++; }, rm(t, fn) { const a = M[t]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } } });
  const wl = on(L), dl = on(DL);
  const doc = { hidden: false, hasFocus: () => true, addEventListener: dl.add, removeEventListener: dl.rm };
  if (opt.dom) Object.assign(doc, opt.dom(C));   // G1674: the music's elements and its DOM
  const win = {
    location: { search: opt.search || '' },
    localStorage: opt.badStorage ? { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }
                                 : { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    performance: { now: opt.clock || (() => performance.now()) },
    addEventListener: wl.add, removeEventListener: wl.rm, document: doc,
    AUDIO_PARAMS: loadParams(S.params),
  };
  if (opt.noAC !== true) win.AudioContext = AudioContextStub;
  const ctx = { window: win, document: doc, console: opt.quiet ? { warn() {}, log() {}, error() {} } : console,
    URLSearchParams, setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: id => { if (timers[id - 1]) timers[id - 1].fn = null; } };
  if (opt.airframe) {
    // the worklet node (SND-AIRFRAME): its params count what is scheduled, its port counts the events
    C.posted = []; C.nodesAW = 0;
    ctx.AudioWorkletNode = class { constructor(c, name, o) { C.nodesAW++; C.awName = name; C.awOpts = o; const ps = new Map();
      for (const n of opt.paramNames || []) ps.set(n, param(0));
      this.parameters = { get: n => { if (!ps.has(n)) ps.set(n, param(0)); return ps.get(n); } };
      this.port = { postMessage: m => C.posted.push(m) }; this.connects = []; }
      connect(d, i) { this.connects.push(i); } disconnect() {} };
  }
  vm.createContext(ctx);
  if (opt.before) opt.before(win);
  vm.runInContext(S.audio, ctx, { filename: 'audio.js' });
  for (const [txt, fn] of opt.after || []) vm.runInContext(txt, ctx, { filename: fn });
  if (opt.airframe) {
    vm.runInContext(S.model, ctx, { filename: 'airframe_model.js' });
    vm.runInContext(S.samples, ctx, { filename: 'samples.js' });
    vm.runInContext(S.srcaf, ctx, { filename: 'src_airframe.js' });
  }
  const fire = (M, t, ev) => { for (const fn of (M[t] || []).slice()) fn(ev || { type: t }); };
  return { A: win.AUDIO, C, win, doc, store, L, DL, params,
    gesture: (t) => fire(L, t || 'pointerdown'),
    winEvent: t => fire(L, t), docEvent: t => fire(DL, t),
    runTimers: () => { const a = timers.splice(0); for (const x of a) if (x.fn) x.fn(); },
    listeners: () => Object.keys(L).reduce((n, k) => n + L[k].length, 0) + Object.keys(DL).reduce((n, k) => n + DL[k].length, 0) };
}

// ---- THE BUILDS (A): built once, flown 0.5 s at full throttle by the real solver --------------------------------
// the declared facts each build's audio constants must come to (cyl / stroke / gear / engines). The metal Cessna's
// O-540 is a SIX: 4 is the declared fallback until SND-ENGINE's spec.engines[i].sound join says 6 (a join present
// outranks this table - the expectation follows it).
const BUILDS = [
  { name: 'cub (the user\'s)', file: 'builds/cub_2026-09-20_corrected.json', nE: 1, cyl: 4, two: 0, gear: 1 },
  { name: 'jodel', file: 'builds/jodel_2026-09-20_corrected.json', nE: 1, cyl: 4, two: 0, gear: 1 },
  { name: 'cessna (custom flat-4)', file: 'builds/cessna172_2026-09-20_corrected.json', nE: 1, cyl: 4, two: 0, gear: 1 },
  { name: 'cessna metal (O-540)', file: 'tools/fixtures/build_v10_cessnaMetal_2026-09-26.json', nE: 1, cyl: 4, two: 0, gear: 1 },
  { name: 'cessna on floats', file: 'tools/fixtures/build_v10_c172_wipline2350_2026-09-20.json', nE: 1, cyl: 4, two: 0, gear: 1, floats: true },
  { name: 'twin 582', file: 'tools/fixtures/build_v7_ultralight_2026-09-05.json', nE: 2, cyl: 2, two: 1, gear: 2.62 },
];
const FLOWN = BUILDS.map(b => {
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, b.file), 'utf8')).spec;
  const def = buildGen(spec), sim = makeSim(def, null);
  sim.reset(0); sim.ctl.thr = 1;
  for (let i = 0; i < 30; i++) sim.step(1 / 60);
  return Object.assign({}, b, { spec, def, sim });
});

// ---- the checks: each (S) -> [failure strings] ----------------------------------------------------------------
const near = (a, b, rel) => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * rel);
const f32 = Math.fround;

function checkNumbers(S) {
  const F = [], AP = loadParams(S.params);
  for (const b of FLOWN) {
    const out = AP.audioParamsBlock(), sim = b.sim, def = b.def, o = sim.out;
    AP.audioParams(sim, { mode: 'chase' }, def, out, null, 1 / 60);
    const P = def.params, PP = POWERPLANTS[P.powerplant] || {}, EN = P.engine || PP.engine || {}, PR = P.prop || PP.prop || {};
    const sd = def.spec.engines && def.spec.engines[0] && def.spec.engines[0].sound;
    const want = { nE: b.nE, cyl: sd && sd.cyl > 0 ? sd.cyl : b.cyl, two: sd && sd.twoStroke != null ? +!!sd.twoStroke : b.two, gear: b.gear };
    const tag = b.name + ': ';
    if (out.nE !== want.nE || out.s[out.I.nEng] !== want.nE) F.push(tag + 'engines ' + out.nE + ' (want ' + want.nE + ')');
    if (!!sim.hydro !== !!b.floats) F.push(tag + 'floats ' + !!sim.hydro + ' (the fixture changed?)');
    const c = 20.0468 * Math.sqrt(o.oatC + 273.15);
    if (!near(out.s[out.I.c], c, 1e-5)) F.push(tag + 'speed of sound ' + out.s[out.I.c] + ' (want ' + c + ')');
    for (let i = 0; i < out.nE; i++) {
      const rp = o.rpm[i], re = o.rpmEng[i], e = tag + 'engine ' + i + ' ';
      if (out.rpm[i] !== f32(rp)) F.push(e + 'prop rpm ' + out.rpm[i] + ' is not the solver\'s ' + rp);
      if (out.rpmEng[i] !== f32(re)) F.push(e + 'engine rpm ' + out.rpmEng[i] + ' is not the solver\'s ' + re);
      if (!near(re, rp * (EN.gear > 0 ? EN.gear : 1), 1e-9)) F.push(e + 'rpmEng ' + re + ' != rpm x gear');
      if (out.cyl[i] !== want.cyl || out.twoStroke[i] !== want.two) F.push(e + 'cyl ' + out.cyl[i] + ' two ' + out.twoStroke[i] + ' (want ' + want.cyl + ' / ' + want.two + ')');
      if (!near(out.gear[i], want.gear, 1e-6)) F.push(e + 'gear ' + out.gear[i] + ' (want ' + want.gear + ')');
      const blades = def.spec.prop && def.spec.prop.blades > 0 ? def.spec.prop.blades : 2;
      if (out.blades[i] !== blades) F.push(e + 'blades ' + out.blades[i] + ' (want ' + blades + ')');
      if (!near(out.D[i], PR.D, 1e-6)) F.push(e + 'D ' + out.D[i] + ' (want ' + PR.D + ')');
      const fire = re / 60 * (want.two ? want.cyl : want.cyl / 2), bpf = rp / 60 * blades, tipM = Math.PI * PR.D * rp / 60 / c;
      if (!near(out.fireHz[i], fire, 1e-5)) F.push(e + 'firing ' + out.fireHz[i] + ' Hz (want ' + fire + ')');
      if (!near(out.bpfHz[i], bpf, 1e-5)) F.push(e + 'BPF ' + out.bpfHz[i] + ' Hz (want ' + bpf + ')');
      if (!near(out.tipM[i], tipM, 1e-5)) F.push(e + 'tip Mach ' + out.tipM[i] + ' (want ' + tipM + ')');
      const tipMh = Math.hypot(Math.PI * PR.D * rp / 60, o.V) / c;
      if (!near(out.tipMh[i], tipMh, 1e-5)) F.push(e + 'helical tip Mach ' + out.tipMh[i] + ' (want ' + tipMh + ')');
      // an aeroplane's numbers, static at full throttle
      if (!(out.fireHz[i] > 20 && out.fireHz[i] < 400)) F.push(e + 'firing ' + out.fireHz[i] + ' Hz outside 20-400');
      if (!(out.bpfHz[i] > 30 && out.bpfHz[i] < 200)) F.push(e + 'BPF ' + out.bpfHz[i] + ' Hz outside 30-200');
      if (!(out.tipM[i] > 0.4 && out.tipM[i] < 0.95)) F.push(e + 'tip Mach ' + out.tipM[i] + ' outside 0.4-0.95');
      if (out.thr[i] !== 1 || out.running[i] !== 1 || out.key[i] !== AP.AP_KEY.both) F.push(e + 'lever/running/key ' + out.thr[i] + '/' + out.running[i] + '/' + out.key[i]);
      if (!near(out.thrustPer[i], o.thrustPer[i], 1e-6)) F.push(e + 'thrust ' + out.thrustPer[i] + ' (want ' + o.thrustPer[i] + ')');
    }
    for (let i = out.nE; i < AP.AP_MAX_ENG; i++) if (out.rpm[i] || out.cyl[i] || out.fireHz[i]) F.push(tag + 'slot ' + i + ' past the engines is not zero');
    // the per-engine lever and the key, on the real sim (restored after)
    const ctl = sim.ctl, eng0 = ctl.eng, thr0 = ctl.thr;
    ctl.thr = 0.8; ctl.eng = [{ on: 1, thr: 0.5 }, { on: 0, thr: 1 }].slice(0, out.nE);
    const k0 = sim.eng[0].key, r0 = sim.eng[0].running;
    sim.eng[0].key = 'off'; sim.eng[0].running = false;
    AP.audioParams(sim, { mode: 'chase' }, def, out, null, 1 / 60);
    if (!near(out.thr[0], 0.4, 1e-6)) F.push(tag + 'lever 0.8 x 0.5 read ' + out.thr[0]);
    if (out.nE > 1 && out.thr[1] !== 0) F.push(tag + 'a switched-off engine\'s lever read ' + out.thr[1]);
    if (out.key[0] !== AP.AP_KEY.off || out.running[0] !== 0) F.push(tag + 'the key off read key ' + out.key[0] + ' running ' + out.running[0]);
    ctl.thr = thr0; ctl.eng = eng0; sim.eng[0].key = k0; sim.eng[0].running = r0;
  }
  // THE STALL ALPHA (G1630): the build's measured clean stall at flap 0; toward the measured landing-flap stall over
  // the landing notch (the polar's dAStall x flap where the landing setting is flapless); in out.alpha's own frame -
  // the solver's alpha with the probe's flow at gen.aStall reads it back (a fresh sim: the probe moves the state)
  for (const b of FLOWN) {
    const out = AP.audioParamsBlock(), sim = b.sim, def = b.def, G = def.params.gen || {}, FL = def.params.flaps;
    const f0 = sim.ctl.flap;
    sim.ctl.flap = 0; AP.audioParams(sim, { mode: 'chase' }, def, out, null, 1 / 60);
    const a0 = out.s[out.I.aStall];
    if (!(G.aStall > 0) || !near(a0, G.aStall, 1e-6)) F.push(b.name + ': the stall alpha at flap 0 reads ' + a0 + ' (want gen.aStall ' + G.aStall + ')');
    sim.ctl.flap = 1; AP.audioParams(sim, { mode: 'chase' }, def, out, null, 1 / 60);
    const want1 = FL && FL.ldg > 0 ? G.aStallLdg : G.aStall - ((FL && FL.dAStall) || 0);
    if (!near(out.s[out.I.aStall], want1, 1e-6)) F.push(b.name + ': the stall alpha at full flap reads ' + out.s[out.I.aStall] + ' (want ' + want1 + ')');
    sim.ctl.flap = f0;
    const ps = makeSim(def, null); ps.reset(0); ps.probe([-30 * Math.cos(G.aStall), -30 * Math.sin(G.aStall), 0]);
    if (!(Math.abs(ps.out.alpha - a0) < 0.01)) F.push(b.name + ': the solver\'s alpha at the probe\'s stall flow is ' + ps.out.alpha.toFixed(4) + ', the block\'s stall ' + a0.toFixed(4) + ' (not one frame)');
  }
  // a custom engine's name carries its count; a join outranks everything
  const AP2 = AP, fake = (engines, family) => ({ params: { powerplant: 'a65_sensenich74', nEngines: 1, engine: { family, gear: 1, name: '' } }, spec: { engines, prop: { blades: 3 } }, refs: {} });
  const o2 = AP2.audioParamsBlock();
  AP2.audioResolve(fake([{ custom: { name: 'custom Radial 7-cyl 2.3 L' } }], 'four'), o2);
  if (o2.cyl[0] !== 7) F.push('a custom "7-cyl" engine read cyl ' + o2.cyl[0]);
  if (o2.blades[0] !== 3) F.push('spec.prop.blades 3 read ' + o2.blades[0]);
  AP2.audioResolve(fake([{ sound: { cyl: 6, twoStroke: 0, blades: 4 } }], 'two'), o2);
  if (o2.cyl[0] !== 6 || o2.twoStroke[0] !== 0 || o2.blades[0] !== 4) F.push('the sound join {6, 4-stroke, 4 blades} read ' + o2.cyl[0] + '/' + o2.twoStroke[0] + '/' + o2.blades[0]);
  AP2.audioResolve(fake([{}], 'electric'), o2);
  if (o2.cyl[0] !== 0) F.push('an electric engine has a firing pulse (cyl ' + o2.cyl[0] + ')');
  return F;
}

// a stub sim the shape the worker's snapshot gives: plain objects, accessors that allocate nothing
function stubSim(b, wc) {
  const s = b.sim, o = s.out;
  return { t: 12.5, p: s.p, ctl: { thr: 1, de: 0.1, da: -0.05, dr: 0.02, brake: 0.3, flap: 1, eng: null },
    out: { V: 31, Veas: 30, Vg: 29, alpha: 0.08, beta: -0.02, nz: 1.3, vs: -2.1, alt: 400, oatC: 9, rho: 1.18,
           thrust: o.thrust, wash: o.wash, starved: false, energyFrac: 0.7, hydroWet: 0, submerged: false,
           rpm: o.rpm.slice(), rpmEng: o.rpmEng.slice(), thrustPer: o.thrustPer.slice() },
    eng: s.eng.map(e => ({ running: e.running, key: e.key, crank: e.crank })),
    wheelContacts: () => wc };
}

function checkContacts(S) {
  const F = [], AP = loadParams(S.params), b = FLOWN[5], out = AP.audioParamsBlock();
  let calls = 0;
  const wc = { mains: [true, false], tw: true, water: false };
  const sim = stubSim(b, null); sim.wheelContacts = () => { calls++; return wc; };
  const world = { surface: (x, z) => 6 };   // gravel everywhere
  const cam = { mode: 'cockpit', inGarage: false, held: false, x: 1, y: 2, z: 3 };
  AP.audioParams(sim, cam, b.def, out, world, 1 / 60);
  const s = out.s, I = out.I;
  if (s[I.onGround] !== 2 || s[I.main0] !== 1 || s[I.main1] !== 0 || s[I.tail] !== 1) F.push('contacts {L, -, tail} read ' + [s[I.onGround], s[I.main0], s[I.main1], s[I.tail]]);
  if (s[I.surf0] !== 6 || s[I.surf1] !== -1 || s[I.surfT] !== 6) F.push('surfaces read ' + [s[I.surf0], s[I.surf1], s[I.surfT]] + ' (want 6, -1, 6)');
  if (s[I.interior] !== 1 || s[I.camMode] !== AP.AP_CAM.cockpit) F.push('the cockpit eye is not interior');
  if (s[I.listenerX] !== 1 || s[I.listenerZ] !== 3) F.push('the listener position is not the camera\'s');
  if (!near(s[I.V], 31, 1e-6) || !near(s[I.nz], 1.3, 1e-6) || !near(s[I.flap], 1, 0) || !near(s[I.brake], 0.3, 1e-6)) F.push('V / nz / flap / brake not read');
  // 30 Hz: a second frame 16 ms later reads no contacts; 34 ms later it does
  AP.audioParams(sim, cam, b.def, out, world, 1 / 60);
  if (calls !== 1) F.push('contacts read ' + calls + ' times in 33 ms (want 1: 30 Hz)');
  AP.audioParams(sim, cam, b.def, out, world, 1 / 60);
  if (calls !== 2) F.push('contacts not read again after 33 ms (' + calls + ')');
  // on the water: the floats' contacts, code 4
  const wcw = { mains: [true, true], tw: true, water: true };
  sim.wheelContacts = () => wcw;
  AP.audioParams(sim, cam, b.def, out, world, 0.05);
  if (s[I.water] !== 1 || s[I.surf0] !== 4 || s[I.surf1] !== 4 || s[I.onGround] !== 3) F.push('on the water read water ' + s[I.water] + ' surf ' + s[I.surf0] + ' onGround ' + s[I.onGround]);
  // the shed's cockpit pref is not the cockpit eye; the camera modes code
  AP.audioParams(sim, { mode: 'cockpit', inGarage: true }, b.def, out, world, 0.05);
  if (s[I.interior] !== 0 || s[I.inGarage] !== 1) F.push('in the shed the cockpit pref read interior ' + s[I.interior]);
  AP.audioParams(sim, { mode: 'tower' }, b.def, out, world, 0.05);
  if (s[I.camMode] !== AP.AP_CAM.tower || s[I.interior] !== 0) F.push('the tower view read mode ' + s[I.camMode] + ' interior ' + s[I.interior]);
  // G1672 the height above ground at 2 Hz: the altitude less the higher of terrain and water; no world -> the altitude
  const wa = { surface: () => 0, terrainH: () => 100, waterH: () => 150 }, sa = stubSim(b, wc);
  AP.audioParams(sa, cam, b.def, out, wa, 0.6);
  if (!near(s[I.agl], 400 - 150, 1e-4)) F.push('agl over water read ' + s[I.agl] + ' (want 250)');
  wa.waterH = () => -1e9; sa.out.alt = 520; AP.audioParams(sa, cam, b.def, out, wa, 0.1);
  if (!near(s[I.agl], 250, 1e-4)) F.push('agl was re-read 0.1 s later (want 2 Hz): ' + s[I.agl]);
  AP.audioParams(sa, cam, b.def, out, wa, 0.45);
  if (!near(s[I.agl], 420, 1e-4)) F.push('agl over land read ' + s[I.agl] + ' (want 420)');
  AP.audioParams(sa, cam, b.def, out, null, 0.6);
  if (!near(s[I.agl], 520, 1e-4)) F.push('agl with no world read ' + s[I.agl] + ' (want the altitude 520)');
  // a new aeroplane re-resolves; no def's constants leak into the next
  AP.audioParams(sim, cam, FLOWN[0].def, out, world, 0.05);
  if (out.nE !== 1 || out.cyl[1] !== 0 || out.gear[0] !== 1) F.push('a new def did not re-resolve (nE ' + out.nE + ', slot 1 cyl ' + out.cyl[1] + ')');
  return F;
}

// one live page after a gesture, two sources, the twin on the worker-shaped sim
function livePage(S, opt) {
  const pg = makePage(S, Object.assign({ quiet: true }, opt));
  pg.gesture('pointerdown');
  const b = FLOWN[5], wc = { mains: [true, true], tw: false, water: false };
  pg.sim = stubSim(b, wc); pg.def = b.def;
  pg.world = { surface: () => 0 };
  pg.camera = { position: { x: 0, y: 2, z: 0 } };
  pg.cam = { mode: 'chase' };
  return pg;
}

// two sources that read the block and allocate nothing themselves (a counter in a typed slot)
function probes(A) {
  const acc = new Float64Array(2);
  A.addSource('probe', { connect() {}, update(P) { acc[0] += P.fireHz[0] + P.s[P.I.V]; } });
  A.addSource('probe2', { connect() {}, update() { acc[1]++; } });
  return acc;
}
function checkBudget(S, report) {
  const F = [];
  // THE HEAP: a page whose clock is a counter (node's own performance.now() boxes its result: ~50 B a call, not ours),
  // nothing else in the loop; the young generation is 64 MB, so 10 000 frames of a few bytes would still be seen
  {
    let tick = 0;
    const pa = livePage(S, { clock: () => ++tick }), A = pa.A;
    if (!A || !A.update) return ['no AUDIO'];
    const acc = probes(A);
    const go = () => A.update(pa.sim, pa.camera, 1 / 60, pa.def, pa.cam, false, pa.world);
    for (let i = 0; i < 20000; i++) go();
    const sched0 = pa.C.sched;
    let gcs = 0;
    const obs = new PerformanceObserver(list => { gcs += list.getEntries().length; });
    obs.observe({ entryTypes: ['gc'] });
    global.gc(); global.gc();
    const gcs0 = gcs, h0 = process.memoryUsage().heapUsed;
    for (let i = 0; i < 10000; i++) go();
    const dB = process.memoryUsage().heapUsed - h0, gIn = gcs - gcs0;
    obs.disconnect();
    if (report) report.push('update(): heap ' + (dB >= 0 ? '+' : '') + dB + ' B over 10 000 frames (' + (dB / 10000).toFixed(2) + ' B a frame), ' + gIn + ' GC in the window');
    if (gIn > 0) F.push('a GC ran inside the measured window (' + gIn + '): something allocates');
    if (dB > 8192) F.push('update() grew the heap ' + dB + ' B over 10 000 frames (' + (dB / 10000).toFixed(1) + ' B a frame; budget 0)');
    if (pa.C.sched !== sched0) F.push('a steady frame scheduled ' + (pa.C.sched - sched0) + ' AudioParam changes over 10 000 frames (want 0)');
    if (!(acc[0] > 0) || acc[1] < 30000) F.push('the sources were not handed the block every frame (' + acc[1] + ')');
    if (A.stats.calls < 30000) F.push('AUDIO.stats.calls ' + A.stats.calls);
  }
  // THE TIME, on the real clock
  const pg = livePage(S), A = pg.A;
  probes(A);
  const go = () => A.update(pg.sim, pg.camera, 1 / 60, pg.def, pg.cam, false, pg.world);
  // a short sample first: a frame far over budget is said without 13 000 of them
  const ts = performance.now();
  for (let i = 0; i < 200; i++) go();
  const ms0 = (performance.now() - ts) / 200;
  if (ms0 > 0.3) return ['update() costs ' + ms0.toFixed(2) + ' ms a frame over its first 200 (budget 0.3)'];
  for (let i = 0; i < 2800; i++) go();
  const t0 = performance.now();
  let mx = 0;
  for (let i = 0; i < 10000; i++) { const a = performance.now(); go(); const d = performance.now() - a; if (d > mx) mx = d; }
  const ms = (performance.now() - t0) / 10000;
  if (report) report.push('update(): ' + (ms * 1000).toFixed(2) + ' us mean, ' + (mx * 1000).toFixed(0) + ' us worst over 10 000 frames (node, two sources; budget 300 us)');
  if (!(ms < 0.3)) F.push('update() costs ' + ms.toFixed(3) + ' ms a frame (budget 0.3)');
  if (!(A.stats.ms > 0)) F.push('AUDIO.stats.ms reads ' + A.stats.ms);
  // the inline solver, for the record: its wheelContacts() builds an object per call (read at 30 Hz)
  if (report) {
    const AP = loadParams(S.params), out = AP.audioParamsBlock(), b = FLOWN[0];
    for (let i = 0; i < 2000; i++) AP.audioParams(b.sim, pg.cam, b.def, out, null, 1 / 60);
    global.gc(); global.gc();
    const g0 = process.memoryUsage().heapUsed;
    for (let i = 0; i < 6000; i++) AP.audioParams(b.sim, pg.cam, b.def, out, null, 1 / 60);
    report.push('the INLINE solver (the Cub): ' + ((process.memoryUsage().heapUsed - g0) / 6000).toFixed(1) + ' B a frame - its wheelContacts() object at 30 Hz, not AUDIO\'s (the worker, on by default: 0)');
  }
  return F;
}

function checkGesture(S) {
  const F = [];
  // enabled: nothing before the gesture
  const pg = makePage(S, { quiet: true });
  const A = pg.A;
  if (!A || A.enabled !== true) return ['AUDIO not enabled on a plain page'];
  if (pg.C.ctx !== 0 || pg.C.nodes !== 0) F.push('constructed at load: ' + pg.C.ctx + ' contexts, ' + pg.C.nodes + ' nodes');
  if (A.params) F.push('the parameter block exists before a gesture');
  const b = FLOWN[0];
  for (let i = 0; i < 100; i++) A.update(b.sim, { position: { x: 0, y: 0, z: 0 } }, 1 / 60, b.def, { mode: 'chase' }, false, null);
  if (pg.C.ctx !== 0) F.push('update() before a gesture made a context');
  if (!(pg.L.pointerdown && pg.L.pointerdown.length === 1 && pg.L.keydown && pg.L.keydown.length === 1)) F.push('not listening for the first pointerdown and keydown');
  let ready = 0, connected = 0;
  A.onEvent('ready', () => ready++);
  A.addSource('early', { connect(ctx, au) { connected++; if (!au.bus('aircraft.ext')) F.push('a source connected before its bus'); } });
  if (connected) F.push('a source connected before the gesture');
  pg.gesture('pointerdown');
  if (pg.C.ctx !== 1) F.push('the gesture made ' + pg.C.ctx + ' contexts (want 1)');
  if (pg.C.nodes !== 9) F.push('the bus graph is ' + pg.C.nodes + ' nodes (want 9: 7 buses, the fade, the limiter)');
  if (ready !== 1 || connected !== 1) F.push('ready ' + ready + ' / connected ' + connected + ' after the gesture (want 1 / 1)');
  if (!A.params || !A.params.block) F.push('no parameter block after the gesture');
  pg.gesture('keydown'); pg.gesture('pointerdown');
  if (pg.C.ctx !== 1) F.push('a second gesture made another context');
  if ((pg.L.pointerdown || []).length || (pg.L.keydown || []).length) F.push('the gesture listeners are still there');
  for (const n of ['master', 'aircraft', 'aircraft.ext', 'aircraft.int', 'ambience', 'music', 'ui']) if (!A.bus(n)) F.push('no bus ' + n);
  // a key first works as well
  const pk = makePage(S, { quiet: true }); pk.gesture('keydown');
  if (pk.C.ctx !== 1) F.push('a keydown first made ' + pk.C.ctx + ' contexts');
  // ?audio=0 and the pref: NOTHING
  for (const [why, o] of [['?audio=0', { search: '?audio=0' }], ['flydiy.audio = 0', { store: { 'flydiy.audio': '0' } }]]) {
    const p0 = makePage(S, Object.assign({ quiet: true }, o));
    if (!p0.A || p0.A.enabled !== false) { F.push(why + ': AUDIO is enabled'); continue; }
    if (p0.listeners() !== 0 || p0.C.listen !== 0) F.push(why + ': ' + p0.C.listen + ' listeners registered');
    p0.gesture('pointerdown'); p0.gesture('keydown');
    p0.A.update(b.sim, { position: { x: 0, y: 0, z: 0 } }, 1 / 60, b.def, { mode: 'chase' }, false, null);
    p0.A.addSource('x', { connect() { F.push(why + ': a source connected'); } });
    if (p0.C.ctx !== 0 || p0.C.nodes !== 0 || p0.A.params) F.push(why + ': constructed ' + p0.C.ctx + ' contexts, ' + p0.C.nodes + ' nodes' + (p0.A.params ? ', a block' : ''));
  }
  const p1 = makePage(S, { quiet: true, search: '?audio=1', store: { 'flydiy.audio': '0' } });
  if (!p1.A || p1.A.enabled !== true) F.push('?audio=1 does not outrank the pref');
  const pn = makePage(S, { quiet: true, noAC: true });
  try { pn.gesture('pointerdown'); if (pn.A.state !== 'unsupported') F.push('no Web Audio read state ' + pn.A.state); }
  catch (e) { F.push('no Web Audio threw: ' + e.message); }
  return F;
}

function checkSilence(S) {
  const F = [], pg = livePage(S), A = pg.A;
  const go = () => A.update(pg.sim, pg.camera, 1 / 60, pg.def, pg.cam, false, pg.world);
  go();
  const susp = pg.C.suspend;
  // hidden
  pg.doc.hidden = true; pg.docEvent('visibilitychange');
  pg.runTimers();
  if (pg.C.suspend !== susp + 1 || A.state !== 'suspended') F.push('a hidden tab did not fade and suspend (state ' + A.state + ')');
  pg.doc.hidden = false; pg.docEvent('visibilitychange');
  if (A.state !== 'running' || pg.C.resume < 1) F.push('back from hidden did not resume (state ' + A.state + ')');
  // the pause (FLYDIY_HELD), read in update
  pg.win.FLYDIY_HELD = true; go(); pg.runTimers();
  if (A.state !== 'suspended') F.push('the pause did not silence (state ' + A.state + ')');
  pg.win.FLYDIY_HELD = false; go();
  if (A.state !== 'running') F.push('unpaused did not resume');
  // unfocused: on with the setting, nothing without it
  pg.winEvent('blur'); pg.runTimers();
  if (A.state !== 'suspended') F.push('an unfocused window (mute when unfocused on) did not silence');
  pg.winEvent('focus');
  A.set('muteUnfocused', 0);
  pg.winEvent('blur'); pg.runTimers();
  if (A.state !== 'running') F.push('mute when unfocused OFF still silenced an unfocused window');
  pg.winEvent('focus');
  // a flip back inside the 0.2 s cancels the suspend
  pg.doc.hidden = true; pg.docEvent('visibilitychange'); pg.doc.hidden = false; pg.docEvent('visibilitychange');
  const s2 = pg.C.suspend; pg.runTimers();
  if (pg.C.suspend !== s2) F.push('a suspend fired after the tab came back inside the fade');
  return F;
}

function checkSettings(S) {
  const F = [];
  const store = {};
  const pg = makePage(S, { quiet: true, store });
  const A = pg.A;
  for (const r of A.SETTINGS) if (A.get(r[0]) !== r[1]) F.push('default ' + r[0] + ' = ' + A.get(r[0]) + ' (want ' + r[1] + ')');
  if (A.get('muteUnfocused') !== 1 || A.get('headset') !== 0 || A.get('musicFlight') !== 0) F.push('the declared defaults moved (mute when unfocused on, headset off, music in flight off)');
  A.set('music', 0.3); A.set('headset', 1); A.set('master', 7);
  if (store['flydiy.audio.music'] !== '0.3' || store['flydiy.audio.headset'] !== '1') F.push('not persisted: ' + JSON.stringify(store));
  if (A.get('master') !== 1) F.push('a volume of 7 was not clamped to 1');
  const p2 = makePage(S, { quiet: true, store: Object.assign({}, store, { 'flydiy.audio.ui': 'x', 'flydiy.audio.environment': 'garbage' }) });
  if (p2.A.get('music') !== 0.3 || p2.A.get('headset') !== 1) F.push('the stored settings were not read back');
  if (p2.A.get('environment') !== 0.8) F.push('a garbage value did not fall back to the default');
  try { const pb = makePage(S, { quiet: true, badStorage: true }); pb.A.set('music', 0.2); if (pb.A.get('music') !== 0.2) F.push('a refusing localStorage lost the live value'); pb.gesture(); }
  catch (e) { F.push('a refusing localStorage threw: ' + e.message); }
  // the gains: the perspective cross-fade, the headset, music in flight
  const pl = livePage(S, { store: { 'flydiy.audio.headset': '1' } }), B = pl.A;
  const g = n => B.bus(n).gain.value;
  const go = (mode, garage) => { pl.cam.mode = mode; B.update(pl.sim, pl.camera, 1 / 60, pl.def, pl.cam, !!garage, pl.world); };
  let persp = 0; B.onEvent('perspective', () => persp++);
  go('chase');
  if (g('aircraft.ext') !== 1 || g('aircraft.int') !== 0) F.push('exterior: ext ' + g('aircraft.ext') + ' int ' + g('aircraft.int'));
  if (g('music') !== 0) F.push('music plays in flight with music in flight off (' + g('music') + ')');
  if (!near(g('aircraft'), 1, 1e-9)) F.push('the headset cut the exterior aircraft (' + g('aircraft') + ')');
  go('cockpit');
  if (g('aircraft.ext') !== 0 || g('aircraft.int') !== 1) F.push('interior: ext ' + g('aircraft.ext') + ' int ' + g('aircraft.int'));
  if (!near(g('aircraft'), Math.pow(10, -0.75), 1e-6)) F.push('the headset in the cockpit is not -15 dB (' + g('aircraft') + ')');
  if (persp !== 1) F.push('the perspective event fired ' + persp + ' times (want 1)');
  go('cockpit', true);
  if (!near(g('music'), 0.6, 1e-9)) F.push('music in the shed ' + g('music') + ' (want its volume 0.6)');
  B.set('musicFlight', 1); go('chase');
  if (!near(g('music'), 0.6, 1e-9)) F.push('music in flight ON is still silent (' + g('music') + ')');
  return F;
}

function checkSources(S) {
  const F = [], pg = livePage(S), A = pg.A;
  const go = () => A.update(pg.sim, pg.camera, 1 / 60, pg.def, pg.cam, false, pg.world);
  let bad = 0, good = 0, disc = 0, late = 0;
  A.addSource('bad', { connect() {}, update() { bad++; throw new Error('boom'); } });
  A.addSource('good', { connect() {}, update(P) { if (P.rpm.length === 4) good++; }, disconnect() { disc++; } });
  for (let i = 0; i < 5; i++) go();
  if (bad !== 1) F.push('a throwing source was called ' + bad + ' times (want 1: switched off)');
  if (good !== 5) F.push('a good source beside it was called ' + good + ' times (want 5)');
  A.addSource('good', { connect() { late++; }, update() {} });
  if (disc !== 1 || late !== 1) F.push('the same name did not replace (disconnect ' + disc + ', connect ' + late + ')');
  // the menu's switch: off closes the context (and stores flydiy.audio = 0), on - a click, so a gesture - makes a new
  // one with every source connected again
  let conn = 0;
  A.addSource('cycle', { connect() { conn++; }, update() {} });
  A.enable(false);
  if (pg.C.close !== 1 || A.state !== 'off' || A.bus('master') || pg.store['flydiy.audio'] !== '0') F.push('sound off did not close (close ' + pg.C.close + ', state ' + A.state + ')');
  go();
  A.enable(true);
  if (pg.C.ctx !== 2 || A.state !== 'running' || conn !== 2 || !A.bus('aircraft.ext') || pg.store['flydiy.audio'] !== '1') F.push('sound back on: ' + pg.C.ctx + ' contexts, state ' + A.state + ', the source connected ' + conn + ' times');
  A.module('engine_worklet');
  if (pg.C.module !== 'src/viewer/audio/engine_worklet.js') F.push('AUDIO.module did not add the served module (' + pg.C.module + ')');
  return F;
}

function checkWiring(S) {
  const F = [];
  const s0 = S.build.indexOf("    scripts: ['storage.js'"), s1 = S.build.indexOf("'dev_panel.js']", s0);
  const list = s0 >= 0 && s1 > s0 ? S.build.slice(s0, s1) : '';
  const ip = list.indexOf("'audio/audio_params.js'"), ia = list.indexOf("'audio/audio.js'"), iw = list.indexOf("'app.js'");
  if (!(ip >= 0 && ia > ip && iw > ia)) F.push('build.js MANIFEST.viewer.scripts does not list audio/audio_params.js, audio/audio.js before app.js');
  if (!/audio: \{ modules: \[/.test(S.build) || !/window\.FLYDIY_AUDIO_SRC=\$\{JSON\.stringify\(AUDIO_SRC\)\}/.test(S.build)) F.push('build.js does not publish MANIFEST.audio.modules as FLYDIY_AUDIO_SRC');
  const calls = S.app.split('AUDIO.update(').length - 1;
  if (calls !== 1) F.push('app.js calls AUDIO.update ' + calls + ' times (want 1)');
  const lp = S.app.indexOf('  function loop(ts) {'), le = S.app.indexOf('\n  }\n', lp);
  const at = S.app.indexOf('AUDIO.update(', lp), rr = S.app.indexOf('renderer.render(inGarage', lp), pe = S.app.indexOf('PACE.end(', lp);
  if (!(lp > 0 && at > rr && rr > lp && at < pe && pe < le)) F.push('app.js: AUDIO.update is not in loop() between the render and PACE.end');
  if (!/\{ k: 'audio', label: 'sound'[^\n]*secs: \['sound'\]/.test(S.app) || !/\n\s+sound: b => \(window\.AUDIO \? window\.AUDIO\.mount\(/.test(S.app)) F.push('the flight rail has no `audio` item mounting AUDIO');
  // SND-AIRFRAME: the model, the slots and the source after audio.js, before app.js; the worklet a served module
  const im = list.indexOf("'audio/airframe_model.js'"), isa = list.indexOf("'audio/samples.js'"), isr = list.indexOf("'audio/src_airframe.js'");
  if (!(im > ia && isa > ia && isr > im && isr > isa && iw > isr)) F.push('build.js MANIFEST.viewer.scripts does not list audio/airframe_model.js, audio/samples.js, audio/src_airframe.js after audio.js and before app.js');
  if (!/audio: \{ modules: \[[^\]]*'airframe_worklet\.js'/.test(S.build)) F.push('build.js MANIFEST.audio.modules does not serve airframe_worklet.js');
  if (!/\{ k: 'audio', label: 'sound'/.test(S.editor) || !/t\.k === 'audio' && window\.AUDIO\) window\.AUDIO\.mount\(/.test(S.editor)) F.push('the shed rail has no `audio` item mounting AUDIO');
  return F;
}

// ==== SND-AIRFRAME (G1630-G1635) ==================================================================================
//   AFMODEL   airframe_model.js on synthetic blocks: the wind's level rises with V and its band brightens; an open
//             cockpit is >= 10 dB over a closed cabin; a touchdown fires ONCE per wheel per rising edge (not while
//             rolling, not on a 50 ms hop), its severity orders with the sink; the chirp only on paved after the wheel
//             spun down; the stall warning 0 below its band, rising through it, silent without airflow, never on a
//             'none' aeroplane, the buzzer's latch; the declared kinds of the validated builds.
//   AFVOICE   airframe_worklet.js rendered offline: the wind's RMS monotonic in V and its spectral centroid rising;
//             the seven land rows' spectra pairwise distinct; a touchdown's energy orders with its severity; the
//             stall warning is INTERIOR-ONLY and only for kind != 0; hostile params (NaN, Inf, huge) stay finite.
//   AFALLOC   the model allocates nothing on 20 000 continuously moving frames (an event frame < 1 KB: it posts a message
//             anyway); process() allocates nothing over 20 000 blocks with every layer on and voices ringing; its cost.
//   AFFLOWN   the REAL SOLVER (recorded once: makeSim flying the evidence scenes, the block per frame) replayed through
//             the model and the voice: the Cub's firm landing touches each main once at its contact, the Cessna chirps
//             on paved, the floats splash (no tyre events on water), the Cessna's reed comes on only past its band,
//             no NaN / guard hit / DC on any render.
//   AFSOURCE  src_airframe.js inside AUDIO (a stub page): one 'flydiy-airframe' node, both outputs wired, the param
//             names the worklet's; a steady frame schedules nothing and allocates nothing; a landing posts its events once.
//   SAMPLES   samples.js on a stub context: nothing fetched before load(); two asks one fetch; a failure stays failed;
//             the budget refuses; the baked loop has no seam; a one-shot's jitter in bounds; an absent key -> null.
//   INERT     spec.systems.stallWarn (the declared field) leaves buildGen + 2 s of the solver bit-identical (and a
//             control: a field the physics reads does move it).
const AFR = require(path.join(ROOT, 'tools', 'audio', 'airframe_render.js'));
const RND = require(path.join(ROOT, 'tools', 'audio', 'render.js'));
function loadModel(text) { const c = { module: { exports: {} } }; vm.runInNewContext(text, c, { filename: 'airframe_model.js' }); return c.module.exports; }
function loadVoice(text, sr) {
  const reg = {}, mod = { exports: {} };
  class AWP { constructor() { this.port = { onmessage: null, postMessage() {} }; } }
  vm.runInThisContext('(function (AudioWorkletProcessor, registerProcessor, sampleRate, currentTime, module) {' + text + '\n})',
    { filename: 'airframe_worklet.js' })(AWP, (n, c) => { reg[n] = c; }, sr || 48000, 0, mod);
  return { Processor: reg['flydiy-airframe'], sr: sr || 48000, lib: mod.exports };
}
const AF_CACHE = {};
const voiceOf = S => AF_CACHE.w === S.worklet ? AF_CACHE.W : (AF_CACHE.w = S.worklet, AF_CACHE.W = loadVoice(S.worklet));
const modelOf = S => AF_CACHE.m === S.model ? AF_CACHE.M : (AF_CACHE.m = S.model, AF_CACHE.M = loadModel(S.model));
// a synthetic block for a def: every scalar 0 but nz 1 and the surfaces -1
// (ONE params realm for every synthetic block: blocks from many vm realms make the model's typed-array loads megamorphic,
// and a megamorphic float load boxes - the page has one block in one realm)
let AP_SYN = null;
function synthP(def) {
  const P = (AP_SYN || (AP_SYN = loadParams(SRC0.params))).audioParamsBlock();
  P.def = def; P.s.fill(0); const I = P.I;
  P.s[I.nz] = 1; P.s[I.surf0] = P.s[I.surf1] = P.s[I.surfT] = -1;
  const G = def.params.gen || {};
  P.s[I.aStall] = G.aStall || 0;
  return P;
}
const dbOf = x => 20 * Math.log10(x + 1e-12);
// render `sec` s of the voice at fixed targets (an object of param -> value), events [t, e, s, a, b]; returns {ext, int, proc}
function renderAt(W, targets, sec, events) {
  const v = AFR.makeAirframe(W, 11);
  for (const k in targets) v.params[k][0] = targets[k];
  const nb = Math.ceil(sec * W.sr / 128), ext = new Float32Array(nb * 128), int = new Float32Array(nb * 128);
  const evs = (events || []).slice();
  for (let b = 0; b < nb; b++) {
    while (evs.length && evs[0][0] <= b * 128 / W.sr) { const e = evs.shift(); v.proc.message({ t: 'ev', e: e[1], s: e[2], a: e[3], b: e[4], k: 0 }); }
    v.proc.process(v.inputs, v.outputs, v.params);
    ext.set(v.outputs[0][0], b * 128); int.set(v.outputs[1][0], b * 128);
  }
  return { ext, int, proc: v.proc };
}
const rmsOf = (y, a, b) => { let s = 0; for (let k = a; k < b; k++) s += y[k] * y[k]; return Math.sqrt(s / Math.max(1, b - a)); };
function centroid(y, sr) {
  const S = RND.spectrum(y, y.length - 16384, 16384, sr, 16384);
  let num = 0, den = 0; for (let k = 1; k < S.mag.length; k++) { const p = S.mag[k] * S.mag[k]; num += p * k * S.binHz; den += p; }
  return num / den;
}
function octaves(y, sr) {   // ten octave bands 31.5 Hz .. 16 kHz, dB, normalised to their mean
  const S = RND.spectrum(y, y.length - 32768, 32768, sr, 32768), out = [];
  for (let b = 0; b < 10; b++) { const lo = 22 * Math.pow(2, b), hi = lo * 2; let e = 0;
    for (let k = Math.floor(lo / S.binHz); k < Math.min(S.mag.length, Math.ceil(hi / S.binHz)); k++) e += S.mag[k] * S.mag[k];
    out.push(10 * Math.log10(e + 1e-20)); }
  const m = out.reduce((a, b) => a + b, 0) / out.length; return out.map(x => x - m);
}
// the model's targets for one frame of synthetic flight
function targetsFor(M, P, frames, dt) { const st = M.airframeState(); let tg; for (let i = 0; i < (frames || 4); i++) tg = M.airframeStep(P, st, dt || 1 / 60); const o = {}; M.AF_PARAMS.forEach((k, i) => { o[k] = tg[i]; }); return o; }

const CUB = () => FLOWN[0], CESSNA = () => FLOWN[2], FLOATS = () => FLOWN[4], UL = () => FLOWN[5];

function checkAfModel(S) {
  const F = [], M = modelOf(S), I = AF_I;
  // THE WIND: level and band rise with V; open > closed
  const P = synthP(CESSNA().def);
  let pl = -1, pf = -1;
  for (const V of [15, 25, 35, 50, 70, 90]) {
    P.s[I.V] = V; const t = targetsFor(M, P);
    if (!(t.windL > pl * 1.2) || !(t.windF > pf)) F.push('the wind at ' + V + ' m/s: level ' + t.windL.toFixed(4) + ' after ' + pl.toFixed(4) + ', band ' + t.windF + ' Hz after ' + pf + ' (both must rise)');
    pl = t.windL; pf = t.windF;
  }
  P.s[I.V] = 50; const shut = targetsFor(M, P).windI; P.s[I.open] = 1; const op = targetsFor(M, P).windI; P.s[I.open] = 0;
  if (!(op > shut)) F.push('an open cockpit\'s wind target ' + op + ' is not over a closed cabin\'s ' + shut);
  // THE TOUCHDOWN: once per wheel per rising edge, debounced, severity from the sink
  const run = (seq, def) => {   // seq: [[frames, {main0, main1, tail, vs, Vg, surf, water}], ...] at 1/60 s; returns the events
    const st = M.airframeState(), Q = synthP(def || CUB().def), ev = [];
    for (const [n, o] of seq) for (let f = 0; f < n; f++) {
      for (const k of ['main0', 'main1', 'tail', 'water']) Q.s[I[k]] = o[k] ? 1 : 0;
      Q.s[I.vs] = o.vs || 0; Q.s[I.Vg] = Q.s[I.V] = o.Vg || 0;
      Q.s[I.surf0] = o.main0 ? (o.surf != null ? o.surf : 0) : -1; Q.s[I.surf1] = o.main1 ? (o.surf != null ? o.surf : 0) : -1; Q.s[I.surfT] = o.tail ? (o.surf != null ? o.surf : 0) : -1;
      M.airframeStep(Q, st, 1 / 60);
      for (let k = 0; k < st.evN[0]; k++) ev.push(Array.from(st.ev.subarray(k * 4, k * 4 + 4)));
      st.evN[0] = 0;
    }
    return ev;
  };
  const air = (vs, Vg, surf) => ({ vs, Vg, surf }), gnd = (vs, Vg, surf, tail) => ({ main0: 1, main1: 1, tail: tail ? 1 : 0, vs, Vg, surf });
  let ev = run([[30, air(-2, 20)], [120, gnd(-2, 20)]]);
  const td = ev.filter(e => e[0] === M.AF_EV.TD);
  if (td.length !== 2 || td[0][2] === td[1][2]) F.push('a two-main arrival + 2 s rolling gave ' + td.length + ' touchdowns (want 2: once per main): ' + JSON.stringify(td));
  ev = run([[30, air(-1, 20)], [30, gnd(-1, 20)], [3, air(0, 20)], [30, gnd(0, 20)]]);
  if (ev.filter(e => e[0] === M.AF_EV.TD).length !== 2) F.push('a 50 ms hop re-fired the touchdown (' + ev.filter(e => e[0] === M.AF_EV.TD).length + ' events, want 2)');
  ev = run([[30, air(-1, 20)], [30, gnd(-1, 20)], [30, air(0, 20)], [30, gnd(-0.5, 20)]]);
  if (ev.filter(e => e[0] === M.AF_EV.TD).length !== 4) F.push('a bounce (0.5 s off) did not touch down again (' + ev.filter(e => e[0] === M.AF_EV.TD).length + ', want 4)');
  const sevAt = vs => { const e = run([[40, air(vs, 20)], [5, gnd(vs, 20)]]).find(x => x[0] === M.AF_EV.TD); return e ? e[1] : -1; };
  const s1 = sevAt(-0.5), s2 = sevAt(-1.5), s3 = sevAt(-3);
  if (!(s1 > 0 && s2 > s1 + 0.1 && s3 > s2 + 0.1)) F.push('the touchdown severity does not order with the sink: ' + [s1, s2, s3].map(x => x.toFixed(2)) + ' at 0.5 / 1.5 / 3 m/s');
  if (run([[2, gnd(0, 0)], [60, gnd(0, 0)]]).length) F.push('an aeroplane spawned on its wheels made an event');
  // the chirp: paved after >= 1 s in the air above 12 m/s; never on grass; not after a short hop
  const chirps = seq => run(seq, CESSNA().def).filter(e => e[0] === M.AF_EV.CHIRP).length;
  if (chirps([[90, air(-1.5, 27, 5)], [10, gnd(-1.5, 27, 5)]]) !== 1) F.push('no single chirp on a paved arrival at 27 m/s');
  if (chirps([[90, air(-1.5, 27, 0)], [10, gnd(-1.5, 27, 0)]]) !== 0) F.push('a chirp on grass');
  if (chirps([[90, air(-1.5, 27, 5)], [30, gnd(-1, 27, 5)], [20, air(0, 27, 5)], [10, gnd(-1, 27, 5)]]) !== 1) F.push('a chirp after a 0.33 s hop (the wheel still spinning)');
  // the water: a splash on the floats' first touch, no tyre event
  ev = run([[60, Object.assign(air(-1.5, 24), { surf: 4 })], [30, { main0: 1, main1: 1, water: 1, vs: -1.5, Vg: 24, surf: 4 }]], FLOATS().def);
  if (ev.filter(e => e[0] === M.AF_EV.SPLASH).length !== 1 || ev.some(e => e[0] === M.AF_EV.TD || e[0] === M.AF_EV.CHIRP)) F.push('the floats\' touch: ' + JSON.stringify(ev) + ' (want one splash, no tyre event)');
  // THE STALL: the band, the airflow, the kinds
  const stallAt = (def, a, V, extra) => { const Q = synthP(def); Q.s[I.V] = V; Q.s[I.alpha] = a; if (extra) extra(Q); return targetsFor(M, Q).stall; };
  const cd = CESSNA().def, aS = synthP(cd).s[I.aStall], wA = M.AF_TUNE.warnA;
  if (!(aS > 0.2)) F.push('the Cessna\'s stall alpha in the block ' + aS);
  if (stallAt(cd, aS - wA - 0.01, 30) !== 0) F.push('the reed sounds below its band (alpha = stall - ' + (wA + 0.01).toFixed(3) + ')');
  const mid = stallAt(cd, aS - wA / 2, 30), top = stallAt(cd, aS, 30);
  if (!(mid > 0.2 && mid < 0.8 && top === 1)) F.push('the reed through its band: ' + mid + ' half way, ' + top + ' at the stall (want ~0.5, 1)');
  const vsC = cd.params.gen.VsFlap || cd.params.gen.VsMeas;
  if (stallAt(cd, aS, 0.5 * vsC) !== 0) F.push('the reed sounds with too little airflow (V = half the stall speed, ' + (0.5 * vsC).toFixed(1) + ' m/s)');
  for (const b of [CUB(), UL(), FLOWN[1]]) if (stallAt(b.def, aS + 0.1, 25) !== 0 || stallAt(b.def, (b.def.params.gen.aStall || 0.25) + 0.05, 25) !== 0) F.push(b.name + ' (kind none) warns');
  const kinds = { 'cub (the user\'s)': 0, jodel: 0, 'cessna (custom flat-4)': 1, 'cessna metal (O-540)': 1, 'cessna on floats': 1, 'twin 582': 0 };
  for (const b of FLOWN) { const k = M.stallKind(b.def.spec).kind; if (k !== kinds[b.name]) F.push(b.name + ': stall kind ' + k + ' (want ' + kinds[b.name] + ')'); }
  if (M.stallKind(Object.assign({}, CESSNA().def.spec, { systems: { stallWarn: 'none' } })).kind !== 0) F.push('spec.systems.stallWarn does not outrank the table');
  // the buzzer latches: on past 15 % of the band, held at 10 %, off under 5 %
  const bz = JSON.parse(JSON.stringify({ systems: { stallWarn: 'buzzer' } }));
  const bdef = Object.assign({}, cd, { spec: Object.assign({}, cd.spec, bz) });
  { const st = M.airframeState(), Q = synthP(bdef); Q.s[I.V] = 30; const seq = [0.1, 0.2, 0.1, 0.03], got = [];
    for (const m of seq) { Q.s[I.alpha] = aS - wA + m * wA; for (let i = 0; i < 3; i++) M.airframeStep(Q, st, 1 / 60); got.push(st.tg[M.T.stall]); }
    if (got.join() !== '0,1,1,0') F.push('the buzzer\'s latch read ' + got.join() + ' at 10 / 20 / 10 / 3 % of the band (want 0,1,1,0)'); }
  return F;
}

function checkAfVoice(S, report) {
  const F = [], W = voiceOf(S), M = modelOf(S), I = AF_I;
  const names = W.Processor.parameterDescriptors.map(d => d.name);
  if (names.join() !== M.AF_PARAMS.join()) F.push('the worklet\'s params ' + names.join() + ' are not the model\'s ' + M.AF_PARAMS.join());
  // THE WIND: rendered RMS monotonic in V, the centroid rising
  const P = synthP(CESSNA().def);
  let pr = 0, pc = 0; const line = [];
  for (const V of [15, 30, 50, 70, 90]) {
    P.s[I.V] = V; const t = targetsFor(M, P);
    const r = renderAt(W, t, 1.0), e = rmsOf(r.ext, 12000, r.ext.length), c = centroid(r.ext, W.sr);
    line.push(V + ' m/s ' + dbOf(e).toFixed(1) + ' dB ' + Math.round(c) + ' Hz');
    if (!(dbOf(e) > dbOf(pr) + 2) || !(c > pc)) F.push('the rendered wind at ' + V + ' m/s: ' + dbOf(e).toFixed(1) + ' dB, centroid ' + Math.round(c) + ' Hz (after ' + dbOf(pr).toFixed(1) + ' dB, ' + Math.round(pc) + ' Hz: both must rise)');
    pr = e; pc = c;
  }
  if (report) report.push('wind (ext): ' + line.join(' | '));
  // the cabin: an open cockpit's interior wind >= 10 dB over a closed cabin's, rendered at 50 m/s (the targets the model gives each)
  { P.s[I.V] = 50; P.s[I.open] = 0; const tc = targetsFor(M, P); P.s[I.open] = 1; const to = targetsFor(M, P); P.s[I.open] = 0;
    const rc = renderAt(W, tc, 1.0), ro = renderAt(W, to, 1.0);
    const d = dbOf(rmsOf(ro.int, 12000, ro.int.length)) - dbOf(rmsOf(rc.int, 12000, rc.int.length));
    if (!(d >= 10)) F.push('inside, an open cockpit\'s wind is only ' + d.toFixed(1) + ' dB over a closed cabin\'s at 50 m/s (want >= 10)');
    if (report) report.push('the cabin at 50 m/s: open cockpit +' + d.toFixed(1) + ' dB over a closed cabin (interior wind)'); }
  // THE SURFACES: seven land rows, 15 m/s on both mains, pairwise distinct octave spectra (rms difference >= 2 dB)
  const rows = [0, 1, 2, 3, 5, 6, 7], spec = {}, lv = [];
  for (const row of rows) {
    const Q = synthP(CUB().def); Q.s[I.Vg] = Q.s[I.V] = 15; Q.s[I.main0] = Q.s[I.main1] = 1; Q.s[I.surf0] = Q.s[I.surf1] = row;
    const t = targetsFor(M, Q); t.windL = t.windI = 0;
    const r = renderAt(W, t, 1.5); spec[row] = octaves(r.ext, W.sr); lv.push(row + ' ' + dbOf(rmsOf(r.ext, 24000, r.ext.length)).toFixed(1));
  }
  let minD = 1e9, minP = '';
  for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) {
    const d = Math.sqrt(spec[rows[a]].reduce((s, x, k) => s + (x - spec[rows[b]][k]) ** 2, 0) / 10);
    if (d < minD) { minD = d; minP = rows[a] + '/' + rows[b]; }
  }
  if (!(minD >= 2)) F.push('two surface rows sound alike: rows ' + minP + ' differ by ' + minD.toFixed(2) + ' dB rms over the octaves (want >= 2)');
  if (report) report.push('ground at 15 m/s (row dB): ' + lv.join(', ') + '; the closest pair ' + minP + ' at ' + minD.toFixed(1) + ' dB');
  // THE TOUCHDOWN: the energy of the event orders with its severity (the model's own sev from 0.5 / 1.5 / 3 m/s)
  const en = [0.2, 0.5, 0.9].map(s => { const r = renderAt(W, {}, 0.4, [[0.01, 1, s, 0, 0]]); return dbOf(rmsOf(r.ext, 0, r.ext.length)); });
  if (!(en[1] > en[0] + 2 && en[2] > en[1] + 2)) F.push('the touchdown\'s energy does not order with severity: ' + en.map(x => x.toFixed(1)) + ' dB');
  if (report) report.push('touchdown energy at severity 0.2 / 0.5 / 0.9: ' + en.map(x => x.toFixed(1)).join(' / ') + ' dB');
  // THE STALL: interior only, only for a kind
  for (const k of [1, 2]) {
    const r = renderAt(W, { stall: 1, stallK: k }, 0.5);
    const ei = rmsOf(r.int, 4800, r.int.length), ee = rmsOf(r.ext, 0, r.ext.length);
    if (!(ei > 0.01) || !(ee < 1e-6)) F.push('stall kind ' + k + ': interior ' + dbOf(ei).toFixed(1) + ' dB, exterior ' + dbOf(ee).toFixed(1) + ' dB (want sounding inside, nothing outside)');
  }
  { const r = renderAt(W, { stall: 1, stallK: 0 }, 0.3); if (rmsOf(r.int, 0, r.int.length) > 1e-6) F.push('stall kind 0 (none) sounds'); }
  // HOSTILE: NaN / Inf / huge targets -> finite output, no throw
  try {
    for (const t of [{ windL: NaN, windF: NaN, gndL: Infinity, gndV: 1e9 }, { windL: 1e6, windF: 1e7, windI: 1e6, gndS: 99 }, { watL: -5, stall: 9, stallK: 1, creak: 50 }]) {
      const r = renderAt(W, t, 0.2);
      for (let k = 0; k < r.ext.length; k++) if (!Number.isFinite(r.ext[k]) || !Number.isFinite(r.int[k]) || Math.abs(r.ext[k]) > 0.99 || Math.abs(r.int[k]) > 0.99) { F.push('hostile params ' + JSON.stringify(t) + ' gave ' + r.ext[k] + ' / ' + r.int[k]); break; }
    }
  } catch (e) { F.push('hostile params threw: ' + e.message); }
  return F;
}

// THE ALLOCATION PROBES (their own check: a semantic mutation does not re-run them)
function checkAfAlloc(S, report) {
  const F = [], W = voiceOf(S), I = AF_I;
  // ALLOCATION, on a fresh instance of the model (its feedback its own: one block, as on the page): 20 000 frames of a
  // CONTINUOUSLY moving block (V, alpha, flap, nz all changing) allocate nothing; an EVENT frame (a contact's edge,
  // which posts a message anyway) stays under 1 KB
  { const M2 = loadModel(S.model), st = M2.airframeState(), Q = synthP(CESSNA().def);
    let ev = 0, toggle = false;
    const go = i => { Q.s[I.V] = 20 + (i % 300) * 0.1; Q.s[I.alpha] = (i % 200) * 0.002; Q.s[I.Vg] = 25; Q.s[I.vs] = -1;
      Q.s[I.flap] = (i % 500) / 500; Q.s[I.nz] = 1 + 0.3 * ((i >> 4) & 1);
      const on = toggle ? (i >> 6) & 1 : 0;
      Q.s[I.main0] = Q.s[I.main1] = on; Q.s[I.surf0] = Q.s[I.surf1] = on ? 5 : -1;
      M2.airframeStep(Q, st, 1 / 60); ev += st.evN[0]; st.evN[0] = 0; };
    const measure = () => {
      let gcs = 0; const obs = new PerformanceObserver(l => { gcs += l.getEntries().length; }); obs.observe({ entryTypes: ['gc'] });
      global.gc(); global.gc(); const g0 = gcs, h0 = process.memoryUsage().heapUsed; ev = 0;
      for (let i = 0; i < 20000; i++) go(i);
      const dB = process.memoryUsage().heapUsed - h0, gIn = gcs - g0; obs.disconnect(); return [dB, gIn];
    };
    toggle = true; for (let i = 0; i < 12000; i++) go(i); toggle = false; for (let i = 0; i < 12000; i++) go(i);
    const [dB, gIn] = measure();
    if (gIn > 0 || dB > 8192) F.push('airframeStep allocates on continuous frames: ' + dB + ' B, ' + gIn + ' GC over 20 000');
    toggle = true;
    const [dE, gE] = measure();
    if (!(ev > 100) || gE > 0 || dE / ev > 1024) F.push('an event frame allocates ' + (dE / Math.max(1, ev)).toFixed(0) + ' B an event (' + ev + ' events, ' + gE + ' GC; bound 1 KB)'); }
  // THE BUDGET: process() with every layer on, no GC over 20 000 blocks; the cost
  { const v = AFR.makeAirframe(W, 5), p = v.params;
    const all = { windL: 0.02, windI: 0.015, windF: 1650, windT: 0.3, gndL: 0.04, gndS: 6, gndV: 15, tailR: 0.5, brk: 0.5, watL: 0.05, watV: 15, watSlap: 1, watDrag: 0.5, stall: 0.7, stallK: 1, creak: 1, flapM: 1 };
    for (const k in all) p[k][0] = all[k];
    for (let i = 0; i < 8000; i++) { if (i % 500 === 0) v.proc.message({ t: 'ev', e: 1 + (i / 500) % 5, s: 0.6, a: 0, b: 5 }); v.proc.process(v.inputs, v.outputs, p); }
    v.proc.message({ t: 'ev', e: 3, s: 0.8, a: 0, b: 5 });   // voices ring through the window
    let gcs = 0; const obs = new PerformanceObserver(l => { gcs += l.getEntries().length; }); obs.observe({ entryTypes: ['gc'] });
    global.gc(); global.gc(); const g0 = gcs, h0 = process.memoryUsage().heapUsed, t0 = performance.now();
    for (let i = 0; i < 20000; i++) v.proc.process(v.inputs, v.outputs, p);
    const ms = (performance.now() - t0) / 20000, dB = process.memoryUsage().heapUsed - h0, gIn = gcs - g0; obs.disconnect();
    if (gIn > 0 || dB > 16384) F.push('process() allocates: ' + dB + ' B, ' + gIn + ' GC over 20 000 blocks');
    if (report) report.push('airframe process(): every layer on ' + (ms * 1000).toFixed(1) + ' us per 128-frame block (' + (ms / (128 / 48) * 100).toFixed(2) + ' % of real time), heap ' + (dB / 20000).toFixed(2) + ' B a block, ' + gIn + ' GC');
    if (!(ms < 0.5)) F.push('process() costs ' + ms.toFixed(3) + ' ms a block with every layer (budget 0.5)'); }
  return F;
}

// THE FLOWN RECORDS: the real solver through the evidence scenes, the block per frame (scalars + the def), made once
const AF_REC = {};
function recordScene(name, seconds) {
  if (AF_REC[name]) return AF_REC[name];
  const frames = [];
  const r = AFR.runScene(name, { seconds, engine: false, onFrame: ({ P }) => frames.push(Float32Array.from(P.s)) });
  return (AF_REC[name] = { frames, def: r.def, I: loadParams(SRC0.params).I, log: r.log });
}
function replay(S, rec) {
  const M = modelOf(S), W = voiceOf(S), st = M.airframeState(), v = AFR.makeAirframe(W, 9);
  const P = { def: rec.def, I: rec.I, s: null }, names = M.AF_PARAMS, cur = new Float64Array(names.length);
  for (let i = 0; i < names.length; i++) cur[i] = v.params[names[i]][0];
  const k = 1 - Math.exp(-(128 / 48000) / 0.03), nB = AFR.FRAME_BLOCKS;
  const ext = new Float32Array(rec.frames.length * nB * 128), int = new Float32Array(ext.length), ev = [], stall = [];
  rec.frames.forEach((fs, f) => {
    P.s = fs;
    const tg = M.airframeStep(P, st, AFR.FRAME_DT);
    for (let j = 0; j < st.evN[0]; j++) { const e = Array.from(st.ev.subarray(j * 4, j * 4 + 4)); ev.push({ f, t: f * AFR.FRAME_DT, e }); v.proc.message({ t: 'ev', e: e[0], s: e[1], a: e[2], b: e[3], k: 0 }); }
    st.evN[0] = 0; stall.push(tg[M.T.stall]);
    for (let b = 0; b < nB; b++) {
      for (let i = 0; i < names.length; i++) { cur[i] = M.AF_Q[names[i]] === 0 ? tg[i] : cur[i] + (tg[i] - cur[i]) * k; v.params[names[i]][0] = cur[i]; }
      v.proc.process(v.inputs, v.outputs, v.params);
      ext.set(v.outputs[0][0], (f * nB + b) * 128); int.set(v.outputs[1][0], (f * nB + b) * 128);
    }
  });
  return { ext, int, ev, stall, stats: Array.from(v.proc.stats), M };
}
function checkAfFlown(S, report) {
  const F = [], I = AF_I;
  const health = (name, r) => {
    for (const [side, y] of [['ext', r.ext], ['int', r.int]]) {
      const s = RND.stats(y);
      if (!(s.peak < 0.98) || !Number.isFinite(s.rms) || Math.abs(s.mean) > 1e-3) F.push(name + ' ' + side + ': peak ' + s.peak.toFixed(3) + ', rms ' + s.rms + ', mean ' + s.mean.toExponential(1) + ' (want < 0.98, finite, |DC| < 1e-3)');
      if (report) report.push(name + ' ' + side + ': peak ' + s.peak.toFixed(3) + ', ' + dbOf(s.rms).toFixed(1) + ' dB rms, DC ' + s.mean.toExponential(1));
    }
    if (r.stats[1] || r.stats[2]) F.push(name + ': ' + r.stats[1] + ' NaN resets, ' + r.stats[2] + ' samples at the guard');
  };
  // the Cub's firm landing: each main once, at its contact, severity from the sink
  { const rec = recordScene('cub_firm_landing', 3), r = replay(S, rec), td = r.ev.filter(x => x.e[0] === r.M.AF_EV.TD);
    const first = w => rec.frames.findIndex(fs => fs[I[w]] > 0);
    const m0 = td.filter(x => x.e[2] === 0), m1 = td.filter(x => x.e[2] === 1);
    if (m0.length !== 1 || m1.length !== 1) F.push('the Cub\'s firm landing: ' + m0.length + ' / ' + m1.length + ' touchdowns on the mains (want 1 / 1): ' + JSON.stringify(td.map(x => x.e)));
    else {
      if (m0[0].f !== first('main0') || m1[0].f !== first('main1')) F.push('the Cub\'s touchdowns at frames ' + m0[0].f + ' / ' + m1[0].f + ', the contacts at ' + first('main0') + ' / ' + first('main1'));
      const vs = rec.frames[first('main0') - 1][I.vs];
      if (!(m0[0].e[1] > 0.35 && m0[0].e[1] < 1)) F.push('the Cub\'s firm touchdown severity ' + m0[0].e[1].toFixed(2) + ' at a ' + vs.toFixed(2) + ' m/s sink');
      if (report) report.push('the Cub\'s firm landing (the real solver): mains touch at ' + (m0[0].f * AFR.FRAME_DT).toFixed(2) + ' s, severity ' + m0[0].e[1].toFixed(2) + ' (sink ' + vs.toFixed(2) + ' m/s)');
    }
    health('cub_firm_landing', r); }
  // the Cessna on paved: a chirp, on a main, at speed
  { const rec = recordScene('cessna_paved_landing', 3), r = replay(S, rec), ch = r.ev.filter(x => x.e[0] === r.M.AF_EV.CHIRP);
    if (ch.length < 1 || ch.some(x => x.e[2] > 1)) F.push('the Cessna\'s paved landing chirped ' + ch.length + ' times (want >= 1, on a main)');
    health('cessna_paved_landing', r); }
  // the floats: a splash, no tyre
  { const rec = recordScene('floats_water_landing', 3), r = replay(S, rec);
    if (!r.ev.some(x => x.e[0] === r.M.AF_EV.SPLASH) || r.ev.some(x => x.e[0] === r.M.AF_EV.TD || x.e[0] === r.M.AF_EV.CHIRP)) F.push('the floats\' landing: ' + JSON.stringify(r.ev.map(x => x.e)) + ' (want a splash, no tyre event)');
    health('floats_water_landing', r); }
  // the Cessna's stall: the reed comes on only past its band
  { const rec = recordScene('cessna_stall', 13), r = replay(S, rec);
    const on = r.stall.findIndex(x => x > 0);
    if (on < 0) F.push('the Cessna pulled to the stall: the reed never sounded');
    else {
      const a = rec.frames[on][I.alpha], aS = rec.frames[on][I.aStall], wA = r.M.AF_TUNE.warnA;
      if (a < aS - wA - 1e-4) F.push('the reed came on at alpha ' + a.toFixed(3) + ', below its band (' + (aS - wA).toFixed(3) + ')');
      for (let f = 0; f < on; f++) if (rec.frames[f][I.alpha] > aS - wA + 0.2 * wA && rec.frames[f][I.V] > 15) { F.push('the reed silent at alpha ' + rec.frames[f][I.alpha].toFixed(3) + ' (inside its band) at frame ' + f); break; }
      if (report) report.push('the Cessna\'s stall (the real solver): the reed on at ' + (on * AFR.FRAME_DT).toFixed(2) + ' s, alpha ' + a.toFixed(3) + ' rad, stall ' + aS.toFixed(3) + ' (band from ' + (aS - wA).toFixed(3) + ')');
    }
    health('cessna_stall', r); }
  return F;
}

// the source inside AUDIO, on a stub page
function checkAfSource(S, report) {
  const F = [], M = modelOf(S);
  let tick = 0;   // (a counter clock: node's own performance.now() boxes its result, ~16 B a call - not ours; BUDGET does the same)
  const pg = makePage(S, { quiet: true, airframe: true, paramNames: M.AF_PARAMS, clock: () => ++tick });
  pg.gesture('pointerdown');
  const A = pg.A;
  if (pg.C.nodesAW !== 1 || pg.C.awName !== 'flydiy-airframe') return ['the airframe source made ' + pg.C.nodesAW + ' worklet nodes (' + pg.C.awName + ')'];
  if (!(pg.C.modules || []).some(u => /airframe_worklet\.js$/.test(u))) F.push('the airframe worklet module was not added (' + (pg.C.modules || []).join() + ')');
  const o = pg.C.awOpts || {};
  if (o.numberOfOutputs !== 2 || String(o.outputChannelCount) !== '1,1') F.push('the node\'s outputs ' + o.numberOfOutputs + ' x ' + o.outputChannelCount + ' (want 2 mono)');
  const b = FLOWN[2];
  // a steady frame: a cruise on the worker-shaped stub (nothing moves)
  const sim = stubSim(b, { mains: [false, false], tw: false, water: false });
  const camera = { position: { x: 0, y: 500, z: 0 } }, camPref = { mode: 'cockpit' }, world = { surface: () => 5 };
  const go = () => A.update(sim, camera, 1 / 60, b.def, camPref, false, world);   // (no literal per call: the test allocates nothing itself)
  for (let i = 0; i < 300; i++) go();
  const sch0 = pg.C.sched + (pg.C.sv || 0), post0 = pg.C.posted.length;
  for (let i = 0; i < 20000; i++) go();
  let gcs = 0; const obs = new PerformanceObserver(l => { gcs += l.getEntries().length; }); obs.observe({ entryTypes: ['gc'] });
  global.gc(); global.gc(); const g0 = gcs, h0 = process.memoryUsage().heapUsed;
  for (let i = 0; i < 10000; i++) go();
  const dB = process.memoryUsage().heapUsed - h0, gIn = gcs - g0; obs.disconnect();
  const sch = pg.C.sched + (pg.C.sv || 0) - sch0;
  if (sch !== 0) F.push('a steady frame scheduled ' + sch + ' AudioParam changes over 30 000 frames (want 0)');
  if (pg.C.posted.length !== post0) F.push('a steady cruise posted ' + (pg.C.posted.length - post0) + ' events');
  if (gIn > 0 || dB > 8192) F.push('AUDIO.update with the airframe source allocates: ' + dB + ' B, ' + gIn + ' GC over 10 000 steady frames');
  if (report) report.push('the airframe source in AUDIO.update: ' + (dB / 10000).toFixed(2) + ' B a steady frame, ' + gIn + ' GC, ' + sch + ' params scheduled');
  // a landing: the stub's contacts go from none to both mains on paved at 27 m/s after 1.5 s: the events, once
  sim.out.vs = -1.5; sim.out.Vg = 27;
  for (let i = 0; i < 90; i++) go();
  const p1 = pg.C.posted.length;
  sim.wheelContacts = () => ({ mains: [true, true], tw: false, water: false });
  for (let i = 0; i < 120; i++) go();
  const evs = pg.C.posted.slice(p1).map(m => m.e);
  const n = e => evs.filter(x => x === e).length;
  if (n(1) !== 2 || n(2) !== 1) F.push('a paved arrival posted ' + JSON.stringify(evs) + ' (want two touchdowns and one chirp)');
  if (pg.C.posted.slice(p1).some(m => m.t !== 'ev' || !(m.s >= 0 && m.s <= 1))) F.push('an event message out of shape: ' + JSON.stringify(pg.C.posted.slice(p1)[0]));
  // the stall: AUDIO.emit('stall') at the warning's onset and every 2 s while it sounds (SND-MUSIC's duck), never before
  let stalls = 0; A.onEvent('stall', () => stalls++);
  sim.wheelContacts = () => ({ mains: [false, false], tw: false, water: false });
  sim.out.vs = 0; sim.out.V = 30; sim.out.alpha = 0.05;
  for (let i = 0; i < 120; i++) go();
  if (stalls !== 0) F.push('AUDIO.emit(\'stall\') with no warning (' + stalls + ')');
  sim.out.alpha = 0.6;
  for (let i = 0; i < 180; i++) go();   // 3 s of warning: the onset and one re-arm
  if (stalls !== 2) F.push('3 s of stall warning emitted \'stall\' ' + stalls + ' times (want 2: the onset, then every 2 s)');
  return F;
}

// the sample slots on a stub context
function checkSamples(S) {
  const F = [];
  const c = { module: { exports: {} }, console: { info() {}, warn() {}, log() {} } };
  vm.runInNewContext(S.samples, c, { filename: 'samples.js' });
  const SM = c.module.exports;
  let fetches = 0, rnd = 0.5;
  const mkBuf = (n, sr, f) => { const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = f(i); return { length: n, numberOfChannels: 1, sampleRate: sr, duration: n / sr, getChannelData: () => d }; };
  const sine = (n, pad) => mkBuf(n, 48000, i => (i < pad || i >= n - pad) ? 0 : Math.sin(2 * Math.PI * 437.3 * i / 48000));
  const made = [];
  const ctx = { currentTime: 0, decodeAudioData: (ab, ok) => { const b = sine(ab.byteLength, 300); ok(b); return Promise.resolve(b); },
    createBuffer: (ch, n, sr) => mkBuf(n, sr, () => 0),
    createBufferSource: () => { const s = { playbackRate: { value: 1 }, connect() {}, disconnect() {}, start() {}, stop() {} }; made.push(s); return s; },
    createGain: () => { const g = { gain: { value: 1 }, connect() {}, disconnect() {} }; made.push(g); return g; } };
  const files = { 'gnd.grass': ['a.mp3'], 'gnd.thump': ['t1.mp3', 't2.mp3'], 'mech.lever': ['bad.mp3'], 'gnd.gravel': ['big.mp3'] };
  const sizes = { 'a.mp3': 96000, 't1.mp3': 4800, 't2.mp3': 4800, 'bad.mp3': 10, 'big.mp3': 2000000 };
  const I = SM.create({ manifest: files, base: 'B/', budget: 1.5 * 1024 * 1024, random: () => rnd,
    fetch: u => { fetches++; const k = u.slice(2); return k === 'bad.mp3' ? Promise.reject(new Error('404')) : Promise.resolve(new Uint8Array(sizes[k])); } });
  I.attach(ctx);
  if (fetches !== 0) F.push('attach fetched ' + fetches + ' files (want 0: lazy)');
  if (I.state('gnd.asphalt') !== 'absent' || I.state('gnd.grass') !== 'idle') F.push('the states before a load: ' + I.state('gnd.asphalt') + ' / ' + I.state('gnd.grass'));
  const pA = I.load('gnd.asphalt'), p1 = I.load('gnd.grass'), p2 = I.load('gnd.grass'), pT = I.load('gnd.thump'), pL = I.load('mech.lever'), pG = I.load('gnd.gravel');
  return Promise.all([pA, p1, p2, pT, pL, pG]).then(([a, g1, g2, t, l, gv]) => {
    if (a !== null) F.push('an absent key resolved to ' + a);
    if (fetches !== 5) F.push(fetches + ' fetches for grass x2, thump (2 files), lever, gravel (want 5: two asks, one fetch)');
    if (!g1 || g1 !== g2) F.push('two asks of one key did not share one load');
    if (l !== null || I.state('mech.lever') !== 'failed') F.push('a failed fetch read ' + I.state('mech.lever'));
    return I.load('mech.lever').then(l2 => {
      if (l2 !== null || fetches !== 5) F.push('a failed key was fetched again (' + fetches + ')');
      if (gv !== null || I.state('gnd.gravel') !== 'budget') F.push('a 7.6 MB decode under a 1.5 MB budget read ' + I.state('gnd.gravel'));
      if (!(I.bytes > 0 && I.bytes <= I.budget)) F.push('decoded bytes ' + I.bytes + ' outside the budget');
      // the baked loop: the pads trimmed, the seam continuous
      const L = I.bakeLoop(sine(96000, 300)), d = L.getChannelData(0);
      let maxStep = 0; for (let i = 1; i < d.length; i++) maxStep = Math.max(maxStep, Math.abs(d[i] - d[i - 1]));
      const seam = Math.abs(d[0] - d[d.length - 1]);
      if (!(seam <= 1.5 * maxStep + 1e-3)) F.push('the baked loop\'s seam jumps ' + seam.toFixed(3) + ' (the largest step inside it ' + maxStep.toFixed(3) + ')');
      if (Math.abs(d[0]) < 1e-6 && Math.abs(d[d.length - 1]) < 1e-6) F.push('the codec pad was not trimmed (the loop starts and ends on silence)');
      // one-shots: the jitter in bounds at both extremes; an unloaded key plays nothing
      const rates = [];
      for (const r of [0, 1]) { rnd = r; made.length = 0; I.oneShot('gnd.thump', [[{}, 1], [{}, 0.5]], 0.5, { semi: 2, db: 3 }); rates.push(made[0].playbackRate.value, made[1].gain.value / 0.5); }
      const [r0, g0, r1, g1x] = rates;
      if (!(near(r0, Math.pow(2, -2 / 12), 1e-9) && near(r1, Math.pow(2, 2 / 12), 1e-9) && near(g0, Math.pow(10, -3 / 20), 1e-9) && near(g1x, Math.pow(10, 3 / 20), 1e-9))) F.push('the one-shot jitter read rates ' + r0 + ' / ' + r1 + ', gains ' + g0 + ' / ' + g1x);
      if (I.oneShot('gnd.asphalt', [[{}, 1]], 1) !== false) F.push('an absent key played');
      const lp = I.loop('gnd.grass', {});
      if (!lp || !lp.src.loop || lp.gain.value !== 0) F.push('the loop player did not start silent and looping');
      // the declared keys: every one a loop or a one-shot with its layer
      for (const k in SM.KEYS) if (!/^(loop|oneshot)$/.test(SM.KEYS[k].kind) || !SM.KEYS[k].layer) F.push('the key ' + k + ' is not declared whole');
      for (const k of ['gnd.gravel', 'gnd.grass', 'gnd.asphalt', 'gnd.thump', 'gnd.squeal', 'water.splash', 'mech.switch', 'mech.lever', 'mech.creak', 'mech.rattle']) if (!SM.KEYS[k]) F.push('the brief\'s key ' + k + ' is not declared');
      return F;
    });
  });
}

// the declared field is physics-inert
function checkInert() {
  const F = [];
  const fly = spec => { const d = buildGen(JSON.parse(JSON.stringify(spec))), s = makeSim(d, null); s.reset(0); s.ctl.thr = 1; for (let i = 0; i < 120; i++) s.step(1 / 60);
    return JSON.stringify(d.params) + '|' + Array.from(s.p).join(','); };
  const base = CESSNA().spec, a = fly(base);
  const withF = JSON.parse(JSON.stringify(base)); withF.systems = Object.assign({}, withF.systems, { stallWarn: 'buzzer' });
  if (fly(withF) !== a) F.push('spec.systems.stallWarn moved the physics (buildGen params or 2 s of node positions)');
  const ctl = JSON.parse(JSON.stringify(base)); ctl.cabin = Object.assign({}, ctl.cabin, { baggage: (ctl.cabin.baggage || 0) + 30 });
  if (fly(ctl) === a) F.push('the control (30 kg more baggage) did not move the physics: the comparison sees nothing');
  return F;
}

const AF_I = loadParams(SRC0.params).I;


// ---- G1674 THE MUSIC (SND-MUSIC): music.js under the real audio.js, with fake <audio> elements on a manual clock ----
const MC = require(path.join(ROOT, 'tools', 'audio', 'music_credits.js'));
const FIX_DIR = path.join(ROOT, 'tools', 'audio', 'fixtures');
const FIX_CAT = JSON.parse(fs.readFileSync(path.join(FIX_DIR, 'test_catalogue.json'), 'utf8'));
const FIX_RE = /^tools\/audio\/fixtures\/[A-Za-z0-9_-]+\.[0-9a-f]{8}\.wav$/;
// the player's own catalogue for the runs: welcome+garage x4, garage+cruise, cruise, photo; levels on both sides of -16
const SYN = [
  ['w0', ['welcome', 'garage'], 61, -18], ['w1', ['welcome', 'garage'], 47, -19], ['w2', ['welcome', 'garage'], 70, -13],
  ['w3', ['welcome', 'garage'], 52, -14.5], ['g4', ['garage', 'cruise'], 58, -17], ['c5', ['cruise'], 66, -15], ['p6', ['photo'], 44, -16],
].map(([id, contexts, durationS, lufs], i) => ({ id, file: 'media/audio/music/' + id + '.' + (0x10000000 + i * 0x1111111).toString(16).slice(0, 8) + '.mp3',
  title: 'Track ' + id, artist: 'Artist ' + i, album: i % 2 ? 'Album' : '', licence: i === 2 ? 'CC-BY 4.0' : 'CC0', source: 'https://example.org/' + id,
  contexts, durationS, lufs }));
const SYN_DUR = {};
for (const t of SYN) SYN_DUR[t.file] = t.durationS;

// a DOM small enough for music.js: nodes with ids, children, style, dataset; <audio> elements with a clock
function fakeDom(state) {
  const all = [];
  function mk(tag) {
    const n = { tag, id: '', children: [], style: {}, dataset: {}, attrs: {}, textContent: '', parent: null, onclick: null,
      appendChild(c) { c.parent = this; this.children.push(c); if (c.id) all.push(c); return c; },
      remove() { if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); this.parent = null; } },
      setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; if (k === 'src') this._s = ''; } };
    return n;
  }
  function audio() {
    state.made++;
    const L = {}, el = mk('audio');
    Object.assign(el, { _s: '', preload: '', crossOrigin: null, currentTime: 0, duration: NaN, paused: true, _src: false, L,
      addEventListener(t, fn) { (L[t] = L[t] || []).push(fn); }, removeEventListener(t, fn) { const a = L[t]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
      fire(t) { const a = L[t]; if (a) for (let i = 0; i < a.length; i++) a[i]({ type: t }); },
      play() { if (!this._s) return Promise.reject(new Error('no src')); this.paused = false; state.plays++; return Promise.resolve(); },
      pause() { this.paused = true; }, load() { if (!this._s) { this.currentTime = 0; this.duration = NaN; this.paused = true; } } });
    Object.defineProperty(el, 'src', { get() { return this._s; }, set(v) { this._s = String(v); state.srcs.push(this._s); this.currentTime = 0; this.paused = true;
      this.duration = state.durOf(this._s); this.fire('loadedmetadata'); } });
    state.els.push(el);
    return el;
  }
  const body = mk('body');
  const find = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const r = find(c, id); if (r) return r; } return null; };
  return { body, createElement: t => (t === 'audio' ? audio() : mk(t)), createTextNode: t => ({ tag: '#text', textContent: t, children: [] }),
    getElementById: id => find(body, id) };
}

// one page: audio.js + music.js, the gesture made, a flight state the frames read
function musicPage(S, o) {
  o = o || {};
  const st = { made: 0, plays: 0, srcs: [], els: [], durOf: u => (o.durs || SYN_DUR)[u] || 60 };
  const pg = makePage(S, { quiet: true, store: o.store || {}, dom: () => fakeDom(st), clock: o.clock,
    before: win => { win.FLYDIY_MUSIC = o.cat || SYN; if (o.base != null) win.FLYDIY_ASSET_BASE = o.base; if (o.boot) win.BOOT = o.boot;
      if (o.credit) { const c = win.document.createElement('p'); c.id = 'credit'; win.document.body.appendChild(c); } },   // (body.html's about line is there before the scripts)
    after: [[S.music, 'music.js']] });
  const M = pg.win.AUDIO_MUSIC;
  M.seed(o.seed || 7);
  pg.gesture('pointerdown');
  const b = FLOWN[0], wc = { mains: [true, true], tw: true, water: false };
  const sim = { p: b.sim.p, ctl: { thr: 0.6, flap: 0, eng: null }, eng: b.sim.eng.map(e => ({ running: true, key: 'both', crank: 0 })),
    out: { V: 0, vs: 0, alt: 0, oatC: 15, rpm: [2000], rpmEng: [2000], thrustPer: [0] }, wheelContacts: () => wc };
  const world = { surface: () => 0, terrainH: () => 0 };
  const F = { garage: !o.boot, starts: [], t: 0 };
  pg.A.onEvent('music', tr => F.starts.push({ id: M.catalogue[tr].id, tr, t: F.t, ctx: M.context }));
  const camera = { position: { x: 0, y: 2, z: 0 } }, cam = { mode: 'chase' };
  F.air = (on, V, alt, vs, flap) => { wc.mains[0] = wc.mains[1] = !on; wc.tw = !on; sim.out.V = V; sim.out.alt = alt; sim.out.vs = vs || 0; sim.ctl.flap = flap || 0; };
  F.streaming = () => st.els.filter(e => e._s).length;
  F.step = (dt, n) => {
    for (let i = 0; i < (n || 1); i++) {
      F.t += dt;
      if (pg.A.ctx) pg.A.ctx.currentTime += dt;
      for (const el of st.els) if (!el.paused && el._s) {
        el.currentTime += dt; el.fire('timeupdate');
        if (el.currentTime >= el.duration) { el.paused = true; el.fire('ended'); }
      }
      pg.A.update(sim, camera, dt, b.def, cam, F.garage, world);
      if (F.each) F.each();
    }
  };
  F.run = (sec, dt) => F.step(dt || 0.1, Math.round(sec / (dt || 0.1)));
  return Object.assign(pg, { M, st, F, sim, wc, b, world, camera, cam });
}

function checkMusicCatalogue(S) {
  const F = [], pg = musicPage(S, { cat: [] }), M = pg.M;
  const ship = JSON.parse(S.catalogue);
  const v0 = M.validate(ship);
  if (v0.length) F.push('the shipped catalogue is invalid: ' + v0[0]);
  const v1 = M.validate(FIX_CAT, { fileRe: FIX_RE });
  if (v1.length) F.push('the test catalogue is invalid: ' + v1[0]);
  if (M.validate(SYN).length) F.push('the run catalogue is invalid: ' + M.validate(SYN)[0]);
  // what validate must refuse
  const bad = [['an NC licence', { licence: 'CC-BY-NC 4.0' }], ['an unhashed file', { file: 'media/audio/music/song.mp3' }], ['a file outside media/audio/music', { file: 'media/geo/x.12345678.mp3' }],
    ['an unknown context', { contexts: ['garage', 'disco'] }], ['no duration', { durationS: 0 }], ['no artist', { artist: '' }], ['a silly lufs', { lufs: 3 }]];
  for (const [why, patch] of bad) if (!M.validate([Object.assign({}, SYN[0], patch)]).length) F.push('validate accepts ' + why);
  if (!M.validate([SYN[0], Object.assign({}, SYN[1], { id: SYN[0].id })]).length) F.push('validate accepts a repeated id');
  // the test tracks: content-versioned names, the durations the files hold, small
  let bytes = 0;
  for (const t of FIX_CAT) {
    const p = path.join(ROOT, t.file);
    if (!fs.existsSync(p)) { F.push('the test track ' + t.file + ' is missing'); continue; }
    const buf = fs.readFileSync(p); bytes += buf.length;
    const h8 = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
    if (t.file.indexOf('.' + h8 + '.') < 0) F.push(t.file + ' is not named by its bytes (' + h8 + ')');
    const sr = buf.readUInt32LE(24), ch = buf.readUInt16LE(22), bits = buf.readUInt16LE(34), data = buf.readUInt32LE(40);
    const dur = data / (sr * ch * bits / 8);
    if (Math.abs(dur - t.durationS) > 0.01) F.push(t.file + ' lasts ' + dur + ' s, the catalogue says ' + t.durationS);
  }
  if (bytes > 100 * 1024) F.push('the test tracks weigh ' + bytes + ' B (budget 100 KB)');
  // the level trim: -16 LUFS is 1, -19 is +3 dB
  if (!near(M.trimOf({ lufs: -16 }), 1, 1e-9) || !near(M.trimOf({ lufs: -19 }), Math.pow(10, 3 / 20), 1e-9)) F.push('the lufs trim is not LUFS_TARGET - lufs');
  // the URL: the asset base + the content-versioned path (sw.js's /media/ rule)
  const pb = musicPage(S, { base: '../', boot: { state: 'landing' } });
  pb.F.run(1);
  const u = pb.st.srcs[0] || '';
  if (!/^\.\.\/media\/audio\/music\/[a-z0-9]+\.[0-9a-f]{8}\.mp3$/.test(u)) F.push('a track resolves to ' + u + ' (want FLYDIY_ASSET_BASE + media/audio/music/<stem>.<h8>.mp3)');
  return F;
}

function checkMusicContexts(S) {
  const F = [], boot = { state: 'landing' }, pg = musicPage(S, { boot }), M = pg.M, A = pg.A, X = pg.F;
  const bus = () => A.bus('music').gain.value;
  // WELCOME: the loading screen, after the gesture
  X.run(1);
  if (M.context !== 'welcome') F.push('the loading screen is ' + M.context + ' (want welcome)');
  if (X.streaming() !== 1 || X.starts.length !== 1) F.push('the welcome streams ' + X.streaming() + ' elements after ' + X.starts.length + ' starts (want 1 / 1)');
  if (!near(bus(), 0.6, 1e-9)) F.push('the music bus under the loading screen is ' + bus() + ' (want its volume: the welcome is not the air)');
  const wTrack = X.starts.length ? X.starts[0].id : '';
  if (wTrack && SYN.find(t => t.id === wTrack).contexts.indexOf('welcome') < 0) F.push('the welcome played ' + wTrack + ', not a welcome track');
  // -> GARAGE: the welcome's track is a garage track too: it plays on
  boot.state = 'gone'; X.garage = true;
  X.run(1);
  if (M.context !== 'garage') F.push('the shed is ' + M.context);
  if (X.starts.length !== 1 || !M.nowPlaying() || M.nowPlaying().id !== wTrack) F.push('the welcome track did not carry into the shed (' + X.starts.length + ' starts)');
  // -> FLIGHT, music in flight OFF (the default): the track fades out over 4 s and its element is emptied
  X.garage = false; X.air(false, 0, 0);
  X.run(1);
  if (M.context !== 'none') F.push('in flight with music in flight off: ' + M.context);
  X.run(3.5);
  if (X.streaming() !== 0) F.push(X.streaming() + ' elements still stream 4.5 s into a flight with music in flight off');
  if (bus() !== 0) F.push('the music bus in flight (setting off) is ' + bus());
  const s0 = X.starts.length;
  X.air(true, 55, 900, 0, 0); X.run(40);
  if (X.starts.length !== s0 || M.context !== 'none') F.push('a cruise with music in flight OFF played (' + M.context + ')');
  // music in flight ON: only in a cruise - not on the ground, not before the dwell, not on the approach
  A.set('musicFlight', 1);
  X.air(false, 20, 0); X.run(3);
  if (M.context !== 'none') F.push('on the ground with music in flight on: ' + M.context);
  X.air(true, 55, 600, 0, 0); X.run(15);
  if (M.context !== 'none') F.push('15 s into the climb-out (dwell 20 s) the context is already ' + M.context);
  X.run(7);
  if (M.context !== 'cruise' || X.streaming() < 1) F.push('22 s high and level with music in flight on: ' + M.context + ', ' + X.streaming() + ' streaming');
  const cs = X.starts.filter(s => s.ctx === 'cruise');
  if (!cs.length || cs.some(s => SYN.find(t => t.id === s.id).contexts.indexOf('cruise') < 0)) F.push('the cruise played ' + cs.map(s => s.id) + ' (want cruise tracks)');
  X.air(true, 50, 600, 0, 0.4); X.run(0.5);
  if (M.context !== 'none') F.push('flaps out: still ' + M.context);
  X.air(true, 55, 600, 0, 0); X.run(25);
  if (M.context !== 'cruise') F.push('flaps up again, 25 s level: ' + M.context);
  X.air(true, 50, 380, -4, 0); X.run(1);
  if (M.context !== 'none') F.push('descending at 4 m/s at 380 m (the approach): still ' + M.context);
  X.air(true, 50, 900, 0, 0); X.run(25);
  X.air(true, 50, 100, 0, 0); X.run(1);
  if (M.context !== 'none') F.push('100 m above the ground: still ' + M.context);
  // the garage setting: off -> silence in the shed; back on -> the track resumes where it was left
  X.garage = true; X.run(12);
  const left = M.nowPlaying(), leftEl = pg.st.els.find(e => e._s && !e.paused), leftAt = leftEl ? leftEl.currentTime : 0;
  A.set('musicGarage', 0); X.run(6);
  if (M.context !== 'none' || X.streaming() !== 0) F.push('music in the garage OFF: ' + M.context + ', ' + X.streaming() + ' streaming');
  A.set('musicGarage', 1); X.run(1);
  if (M.context !== 'garage' || X.streaming() !== 1) F.push('music in the garage back ON: ' + M.context + ', ' + X.streaming() + ' streaming');
  const back = M.nowPlaying(), backEl = pg.st.els.find(e => e._s && !e.paused);
  if (!left || !back || back.id !== left.id || !backEl || !(backEl.currentTime > leftAt)) F.push('back in the shed the music did not resume ' + (left && left.id) + ' near ' + leftAt.toFixed(1) + ' s (it plays ' + (back && back.id) + ' at ' + (backEl ? backEl.currentTime.toFixed(1) : '-') + ' s)');
  // the photo hook
  A.emit('photo', true); X.run(1);
  if (M.context !== 'photo' || (M.nowPlaying() && M.nowPlaying().id !== 'p6')) F.push('the photo hook: ' + M.context + ' / ' + (M.nowPlaying() && M.nowPlaying().id));
  A.emit('photo', false); X.run(1);
  if (M.context !== 'garage') F.push('the photo mode left: ' + M.context);
  // the suspend: the playing element pauses, and plays again on the way back
  X.run(5);
  const playing = () => pg.st.els.filter(e => e._s && !e.paused).length;
  if (playing() < 1) F.push('nothing playing in the shed before the suspend test');
  pg.doc.hidden = true; pg.docEvent('visibilitychange'); pg.runTimers();
  if (playing() !== 0) F.push('a hidden tab leaves ' + playing() + ' elements playing');
  pg.doc.hidden = false; pg.docEvent('visibilitychange');
  if (playing() < 1) F.push('back from hidden, the music did not play again');
  // sound off / on: the elements emptied, two NEW ones on the new context (an element connects once, ever)
  const made = pg.st.made;
  A.enable(false);
  if (X.streaming() !== 0) F.push('sound off leaves ' + X.streaming() + ' elements streaming');
  try { A.enable(true); X.run(2); } catch (e) { F.push('sound back on threw: ' + e.message); }
  if (pg.st.made !== made + 2) F.push('sound back on made ' + (pg.st.made - made) + ' elements (want 2 new)');
  return F;
}

function checkMusicShuffle(S) {
  const F = [], pg = musicPage(S, {}), M = pg.M;
  // the bag alone: every track once per round, a round never opens on the last one played, over 60 rounds
  for (const n of [2, 5, 7]) {
    const bag = M.makeBag(Array.from({ length: n }, (_, i) => i)), seq = [];
    for (let i = 0; i < n * 60; i++) seq.push(M.bagNext(bag, null));
    for (let r = 0; r < 60; r++) {
      const round = seq.slice(r * n, r * n + n);
      if (new Set(round).size !== n) { F.push('a bag of ' + n + ' repeated inside a round: ' + round); break; }
      if (r && seq[r * n] === seq[r * n - 1]) { F.push('a bag of ' + n + ' opened round ' + r + ' on the track that closed the last'); break; }
    }
  }
  // the failed tracks are skipped, and an all-failed bag answers -1 (no loop)
  const bag = M.makeBag([0, 1, 2]), dead = new Uint8Array([0, 1, 0]);
  for (let i = 0; i < 9; i++) if (M.bagNext(bag, dead) === 1) { F.push('a failed track was dealt'); break; }
  if (M.bagNext(M.makeBag([0, 1]), new Uint8Array([1, 1])) !== -1) F.push('an all-failed bag did not answer -1');
  // the player: 24 crossfaded starts in the welcome (4 tracks): no repeat inside each round of 4
  const pw = musicPage(S, { boot: { state: 'landing' } }), X = pw.F;
  X.run(24 * 70, 0.25);
  const ids = X.starts.map(s => s.id);
  if (ids.length < 20) F.push('the welcome started only ' + ids.length + ' tracks in 28 min');
  for (let r = 0; r + 4 <= ids.length; r += 4) if (new Set(ids.slice(r, r + 4)).size !== 4) { F.push('the welcome repeated inside a round: ' + ids.slice(r, r + 4)); break; }
  for (let i = 1; i < ids.length; i++) if (ids[i] === ids[i - 1]) { F.push('the same track twice in a row: ' + ids[i]); break; }
  return F;
}

function checkMusicGaps(S) {
  const F = [], pg = musicPage(S, { seed: 11 }), X = pg.F;
  X.run(60 * 60, 0.1);   // an hour in the shed
  const g = [];
  for (let i = 1; i < X.starts.length; i++) {
    const prev = SYN.find(t => t.id === X.starts[i - 1].id);
    g.push(X.starts[i].t - X.starts[i - 1].t - prev.durationS);
  }
  if (g.length < 12) F.push('an hour in the shed started only ' + X.starts.length + ' tracks');
  const lo = Math.min(...g), hi = Math.max(...g);
  if (!(lo >= 30 - 0.3 && hi <= 120 + 0.3)) F.push('the silences between tracks run ' + lo.toFixed(1) + '..' + hi.toFixed(1) + ' s (want 30..120)');
  if (!(hi - lo > 30)) F.push('the silences are all alike (' + lo.toFixed(1) + '..' + hi.toFixed(1) + ' s): not random');
  // one element at a time, two only for the preload just before the next start; in a silence nothing streams but
  // that preload's last 3 s
  let run = 0, worst = 0, idle = 0, worstIdle = 0, more = 0;
  X.each = () => {
    const n = X.streaming(), playing = pg.st.els.filter(e => e._s && !e.paused).length;
    if (n > 1) { run += 0.1; if (run > worst) worst = run; } else run = 0;
    if (!playing && n > 0) { idle += 0.1; if (idle > worstIdle) worstIdle = idle; } else idle = 0;
    if (n > 2) more++;
  };
  X.run(20 * 60, 0.1);
  if (more) F.push('more than two elements streamed (' + more + ' frames)');
  if (worst > 3 + 0.25) F.push('two elements streamed together for ' + worst.toFixed(1) + ' s in the shed (want only the 3 s preload)');
  if (worstIdle > 3 + 0.25) F.push('an element streamed ' + worstIdle.toFixed(1) + ' s of a silence (want only the last 3 s: preload none until needed)');
  return F;
}

function checkMusicXfade(S) {
  const F = [], pg = musicPage(S, { boot: { state: 'landing' } }), M = pg.M, X = pg.F;
  let worst = 0, run = 0;
  X.each = () => { if (X.streaming() > 1) { run += 0.05; if (run > worst) worst = run; } else run = 0; };
  X.run(200, 0.05);
  if (X.starts.length < 3) return ['no crossfade happened in the welcome (' + X.starts.length + ' starts)'];
  if (worst > 4 + 3 + 0.3) F.push('two elements streamed together for ' + worst.toFixed(1) + ' s (want the 4 s crossfade + 3 s preload at most)');
  // the last crossfade: both decks' curves start together, last 4 s, and their power sum stays 1 (each over its trim)
  const D = M._decks(), cv = D.map(d => d.gain.gain.ev.filter(e => e.k === 'C').pop());
  if (!cv[0] || !cv[1]) return F.concat(['the crossfade is not on setValueCurveAtTime']);
  const [ci, co] = cv[0].c[cv[0].c.length - 1] > 0 ? [cv[0], cv[1]] : [cv[1], cv[0]];
  if (Math.abs(ci.t - co.t) > 1e-9 || Math.abs(ci.d - 4) > 1e-9 || Math.abs(co.d - 4) > 1e-9) F.push('the two fades: ' + ci.t + '+' + ci.d + ' s / ' + co.t + '+' + co.d + ' s (want one 4 s window)');
  const ti = ci.c[ci.c.length - 1], to = co.c[0];
  let dev = 0;
  for (let i = 0; i <= 40; i++) {
    const x = i / 40 * (ci.c.length - 1), j = Math.min(ci.c.length - 2, Math.floor(x)), f = x - j;
    const a = (ci.c[j] + (ci.c[j + 1] - ci.c[j]) * f) / ti, b = (co.c[j] + (co.c[j + 1] - co.c[j]) * f) / to;
    dev = Math.max(dev, Math.abs(a * a + b * b - 1));
  }
  if (dev > 0.02) F.push('the crossfade power sum strays ' + (dev * 100).toFixed(1) + ' % from 1 (equal-power: < 2 %)');
  if (co.c[co.c.length - 1] !== 0 || ci.c[0] !== 0) F.push('the crossfade does not run from silence to silence');
  // the levels: each track at its trim (lufs -> -16 LUFS)
  const np = M.nowPlaying();
  if (np && !near(ti, M.trimOf(np), 1e-6)) F.push('the track plays at ' + ti + ', its trim is ' + M.trimOf(np));
  // skip: a crossfade now, the old track gone after it
  X.each = null;
  const n0 = X.starts.length, was = M.nowPlaying();
  M.skip(); X.run(0.5, 0.05);
  if (X.starts.length !== n0 + 1 || M.nowPlaying() === was) F.push('skip did not start the next track');
  X.run(5, 0.05);
  if (X.streaming() !== 1) F.push(X.streaming() + ' elements stream 5 s after a skip (want 1: the skipped track faded out)');
  return F;
}

function checkMusicDuck(S) {
  const F = [], pg = musicPage(S, {}), M = pg.M, A = pg.A, X = pg.F;
  X.run(2);
  const D = M._decks();
  if (!D.length) return ['no decks'];
  // the duck node: the decks' gains feed it - found as the GainNode on the bus path whose automation the event moves
  const t0 = A.ctx.currentTime;
  A.emit('engine', 'start');
  X.run(1);
  const duckP = findDuck(pg);
  if (!duckP) return ['the engine event scheduled nothing on the music (no duck)'];
  const db = v => 20 * Math.log10(Math.max(1e-9, v));
  const g1 = duckP.at(t0 + 1);
  if (Math.abs(db(g1) - (-10)) > 0.5) F.push('1 s into an engine start the music sits at ' + db(g1).toFixed(1) + ' dB (want -10)');
  X.run(4);
  A.emit('engine', 'catch');   // a second event re-arms the hold
  X.run(5);
  if (Math.abs(db(duckP.at(A.ctx.currentTime)) - (-10)) > 0.5) F.push('5 s after the catch the duck was released already (' + db(duckP.at(A.ctx.currentTime)).toFixed(1) + ' dB)');
  X.run(5);
  const g2 = duckP.at(A.ctx.currentTime);
  if (Math.abs(db(g2)) > 0.5) F.push('11 s after the last event the music is still at ' + db(g2).toFixed(1) + ' dB (want 0: released)');
  if (M._C.ducks !== 2) F.push('ducks counted ' + M._C.ducks + ' (want 2)');
  return F;
}
// the GainNode the music's duck lives on: the gain param, neither a deck's nor a bus's nor the fade's, that the engine
// event moved (found by what moved, not by its value: a wrong depth must read as a wrong depth)
function findDuck(pg) {
  const D = pg.M._decks(), skip = new Set(D.map(d => d.gain.gain));
  for (const n of ['master', 'aircraft', 'aircraft.ext', 'aircraft.int', 'ambience', 'music', 'ui']) skip.add(pg.A.bus(n).gain);
  for (const p of pg.params) if (!skip.has(p) && p.ev.some(e => e.k === 'T' && e.v < 1)) return p;
  return null;
}

function checkMusicBudget(S) {
  const F = [];
  if (/decodeAudioData/.test(S.music)) F.push('music.js mentions decodeAudioData (the music is streamed, never decoded whole)');
  if (/new\s+Audio\s*\(/.test(S.music)) F.push('music.js makes an Audio() outside the two decks');
  let tick = 0;   // (a counter clock: node's performance.now() boxes its own result, ~33 B a call - not the music's)
  const pg = musicPage(S, { durs: new Proxy({}, { get: () => 1e5 }), clock: () => ++tick }), M = pg.M, A = pg.A, X = pg.F;
  if (pg.st.made !== 2 || pg.C.media !== 2) F.push('the context made ' + pg.st.made + ' <audio> elements, ' + pg.C.media + ' media sources (want 2 / 2)');
  if (pg.st.els.some(e => e.preload !== 'none')) F.push('an element was born with preload ' + pg.st.els.map(e => e.preload) + ' (want none until asked)');
  X.run(2);
  if (X.streaming() !== 1 || pg.st.els.filter(e => !e._s).some(e => e.preload !== 'none')) F.push('in the shed ' + X.streaming() + ' elements stream (want 1), the idle one preload ' + pg.st.els.map(e => e.preload));
  // THE FRAME: a steady shed with a track playing (its clock held: the harness's own writes would be measured).
  // Through AUDIO.update: nothing scheduled. The music's own update, 100 000 times on that block: no GC, and a heap
  // that does not grow (a real per-frame allocation is >= 16 B a call = 1.6 MB; the page-wide frame is BUDGET's)
  const sim = pg.sim, b = pg.b;
  const go = () => A.update(sim, pg.camera, 1 / 60, b.def, pg.cam, true, pg.world);
  for (let i = 0; i < 5000; i++) go();
  const s0 = pg.C.sched, e0 = pg.params.reduce((n, p) => n + p.ev.length, 0);
  for (let i = 0; i < 5000; i++) go();
  if (pg.C.sched !== s0 || pg.params.reduce((n, p) => n + p.ev.length, 0) !== e0) F.push('a steady music frame scheduled AudioParam changes');
  const P = A.params, up = M.source.update, one = () => up(P, 1 / 60, A);
  for (let i = 0; i < 20000; i++) one();
  let gcs = 0;
  const obs = new PerformanceObserver(list => { gcs += list.getEntries().length; });
  obs.observe({ entryTypes: ['gc'] });
  global.gc(); global.gc();
  const g0 = gcs, h0 = process.memoryUsage().heapUsed, t0 = performance.now();
  for (let i = 0; i < 100000; i++) one();
  const us = (performance.now() - t0) * 10, dB = process.memoryUsage().heapUsed - h0, gIn = gcs - g0;
  obs.disconnect();
  MUSIC_REPORT.push('the music\'s update(): heap ' + (dB >= 0 ? '+' : '') + dB + ' B over 100 000 frames in the shed with a track playing (' + (dB / 1e5).toFixed(3) + ' B a frame), ' + gIn + ' GC, ' + (us / 1000).toFixed(3) + ' us a frame');
  if (gIn > 0) F.push('a GC ran inside the music\'s measured window: something allocates');
  if (dB > 16384) F.push('the music\'s frame grew the heap ' + dB + ' B over 100 000 frames (budget 0)');
  if (M.context !== 'garage' || X.streaming() !== 1) F.push('the steady shed lost its track (' + M.context + ')');
  return F;
}
const MUSIC_REPORT = [];

function checkMusicCredits(S) {
  const F = [], pg = musicPage(S, { credit: true }), M = pg.M;
  const ids = r => r.map(x => x.id).join(',');
  for (const [why, cat] of [['the run catalogue', SYN], ['the test catalogue', FIX_CAT], ['the shipped catalogue', JSON.parse(S.catalogue)]])
    if (ids(M.creditRows(cat)) !== ids(cat)) F.push('the credits of ' + why + ' are ' + ids(M.creditRows(cat)) + ' (want ' + ids(cat) + ')');
  if (M.creditLine(Object.assign({}, SYN[2], { credit: 'X by Y - CC-BY 4.0. www.y' })) !== 'X by Y - CC-BY 4.0. www.y') F.push('a CC-BY track\'s own credit line is not used');
  // the screen: one row per catalogue track, then the sound's origins
  const btn = pg.doc.getElementById('musicCreditsBtn');
  if (!btn) F.push('the about line #credit has no music & sound credits button');
  else btn.onclick({ preventDefault() {} });
  const box = pg.doc.getElementById('musicCredits');
  if (!box) return F.concat(['the credits screen did not open']);
  const lis = [], texts = [];
  (function walk(n) { if (n.tag === 'li') lis.push(n.dataset.track); if (n.textContent) texts.push(n.textContent); for (const c of n.children || []) walk(c); })(box);
  if (lis.join(',') !== ids(SYN)) F.push('the credits screen lists ' + lis.join(',') + ' (want the catalogue ' + ids(SYN) + ')');
  for (const r of M.SOUND_CREDITS) if (!texts.some(t => t.indexOf(r.key) >= 0)) F.push('the credits screen does not name ' + r.key);
  // CREDITS.md: its music block IS the shipped catalogue's, and its Sound section names every origin
  const ship = JSON.parse(S.catalogue), blk = MC.readBlock(S.credits);
  if (blk !== MC.musicBlock(ship, M.creditLine)) F.push('CREDITS.md\'s music list is not the catalogue\'s (run node tools/audio/music_credits.js)');
  const sec = S.credits.slice(S.credits.indexOf('\n## Sound'));
  for (const r of M.SOUND_CREDITS) if (sec.indexOf(r.key) < 0) F.push('CREDITS.md\'s Sound section does not name ' + r.key);
  // ...and a catalogue with tracks writes one line per track, the screen's own
  const b2 = MC.musicBlock(SYN, M.creditLine);
  for (const t of SYN) if (b2.indexOf(M.creditLine(t)) < 0) F.push('the generated CREDITS block misses ' + t.id);
  return F;
}

function checkMusicWiring(S) {
  const F = [];
  const s0 = S.build.indexOf("    scripts: ['storage.js'"), s1 = S.build.indexOf("'dev_panel.js']", s0);
  const list = s0 >= 0 && s1 > s0 ? S.build.slice(s0, s1) : '';
  const ia = list.indexOf("'audio/audio.js'"), im = list.indexOf("'audio/music.js'"), iw = list.indexOf("'app.js'");
  if (!(ia >= 0 && im > ia && iw > im)) F.push('build.js MANIFEST.viewer.scripts does not list audio/music.js after audio/audio.js, before app.js');
  if (S.build.indexOf("path.join(VIEW_DIR, 'audio', 'music_catalogue.json')") < 0 || S.build.indexOf('window.FLYDIY_MUSIC=${MUSIC}') < 0) F.push('build.js does not inline music_catalogue.json as window.FLYDIY_MUSIC');
  if (S.build.indexOf("if (range) { e.respondWith(ranged(req, range)); return; }") < 0 || S.build.indexOf("status: 206") < 0) F.push('sw.js answers no Range request (an <audio> element\'s) from the media cache');
  if (S.engine.indexOf("A.emit('engine', 'start')") < 0 || S.engine.indexOf("A.emit('engine', 'catch')") < 0) F.push('src_engine.js emits no engine start / catch for the music to duck under');
  const pg = makePage(S, { quiet: true }), row = pg.A.SETTINGS.find(r => r[0] === 'musicGarage');
  if (!row || row[1] !== 1 || row[2] !== 'bool') F.push('the settings have no "music in the garage" (on)');
  if (typeof pg.A.addRows !== 'function') F.push('AUDIO.addRows is missing (the skip track row)');
  // the menu: the skip row and the credits row are drawn under the settings
  const st = { made: 0, plays: 0, srcs: [], els: [], durOf: () => 60 };
  const pm = makePage(S, { quiet: true, dom: () => fakeDom(st), before: w => { w.FLYDIY_MUSIC = SYN; }, after: [[S.music, 'music.js']] });
  const labels = [];
  const kit = { row: (b, l) => { labels.push(l); return pm.doc.createElement('div'); }, range() {}, toggle: (b, l) => labels.push(l), note() {} };
  pm.A.mount(pm.doc.body, kit);
  for (const l of ['music in the garage', 'skip track', 'music credits']) if (labels.indexOf(l) < 0) F.push('the sound menu has no "' + l + '" row');
  return F;
}

const CHECKS = { NUMBERS: checkNumbers, CONTACTS: checkContacts, BUDGET: checkBudget, GESTURE: checkGesture,
                 SILENCE: checkSilence, SETTINGS: checkSettings, SOURCES: checkSources, WIRING: checkWiring,
                 MUSIC_CAT: checkMusicCatalogue, MUSIC_CTX: checkMusicContexts, MUSIC_SHUFFLE: checkMusicShuffle,
                 MUSIC_GAPS: checkMusicGaps, MUSIC_XFADE: checkMusicXfade, MUSIC_DUCK: checkMusicDuck,
                 MUSIC_BUDGET: checkMusicBudget, MUSIC_CREDITS: checkMusicCredits, MUSIC_WIRING: checkMusicWiring,
                 AFMODEL: checkAfModel, AFVOICE: checkAfVoice, AFALLOC: checkAfAlloc, AFFLOWN: checkAfFlown, AFSOURCE: checkAfSource,
                 SAMPLES: checkSamples, INERT: checkInert };
const REPORTS = { BUDGET: 1, AFVOICE: 1, AFALLOC: 1, AFFLOWN: 1, AFSOURCE: 1 };

// ---- THE MUTATIONS (D): [name, file, find, replace, the check that must go red] ---------------------------------
const MUT = [
  ['four-stroke firing at rpm/60 x cyl', 'params', 'out.cyl[i] / 2', 'out.cyl[i]', 'NUMBERS'],
  ['BPF off a blade too many', 'params', 'rp / 60 * out.blades[i]', 'rp / 60 * (out.blades[i] + 1)', 'NUMBERS'],
  ['the speed of sound mis-constant', 'params', '20.0468 * Math.sqrt', '20.5 * Math.sqrt', 'NUMBERS'],
  ['engine rpm = prop rpm', 'params', 'out.rpm[i] = rp; out.rpmEng[i] = re;', 'out.rpm[i] = rp; out.rpmEng[i] = rp;', 'NUMBERS'],
  ['a switched-off engine pulls', 'params', '(le.on ? +le.thr : 0)', '(le.on ? +le.thr : 1)', 'NUMBERS'],
  ['the two-stroke fallback lost', 'params', "out.twoStroke[i] = sd && sd.twoStroke != null ? (sd.twoStroke ? 1 : 0) : (fam === 'two' ? 1 : 0);", 'out.twoStroke[i] = 0;', 'NUMBERS'],
  ['the custom count unread', 'params', '/(\\d+)-cyl\\b/', '/(\\d+)-cylinder\\b/', 'NUMBERS'],
  ['the contacts every frame', 'params', 'if (clk[0] >= 1 / AP_CONTACT_HZ) {', 'if (true) {', 'CONTACTS'],
  ['the shed\'s cockpit is interior', 'params', "!ig && md === 'cockpit'", "md === 'cockpit'", 'CONTACTS'],
  ['the floats\' water code lost', 'params', 'm0 ? (wat ? AP_SURF_WATER', 'm0 ? (wat ? 0', 'CONTACTS'],
  ['update() allocates', 'audio', 'const ms = now() - t0;', 'const ms = now() - t0; stats.last = [ms];', 'BUDGET'],
  ['update() over budget', 'audio', 'const ms = now() - t0;', 'const tb = W.performance.now(); while (W.performance.now() - tb < 0.5) {} const ms = now() - t0;', 'BUDGET'],
  ['a gain scheduled every frame', 'audio', 'if (tgt[i] === v) return;', '', 'BUDGET'],
  ['a context before the gesture', 'audio', '\n  arm();\n', '\n  arm(); unlock();\n', 'GESTURE'],
  ['?audio=0 builds', 'audio', 'if (OFF) {', 'if (false) {', 'GESTURE'],
  ['the gesture listeners kept', 'audio', '  if (ctx || api.state === \'off\') { disarm(); return; }\n    disarm();', '  if (ctx || api.state === \'off\') { return; }', 'GESTURE'],
  ['a hidden tab plays', 'audio', 'const want = hidden || held ||', 'const want = held ||', 'SILENCE'],
  ['the suspend never comes', 'audio', 'suspendTimer = setTimeout(doSuspend,', 'suspendTimer = setTimeout(() => {},', 'SILENCE'],
  ['the settings not persisted', 'audio', "prefSet(PREF + '.' + k, set[k]);", '', 'SETTINGS'],
  ['the headset in the open', 'audio', 'const hs = interior && set.headset ? HEADSET_K : 1;', 'const hs = set.headset ? HEADSET_K : 1;', 'SETTINGS'],
  ['music in flight by default', 'audio', "set.music * (flying && !set.musicFlight ? 0 : 1)", 'set.music', 'SETTINGS'],
  ['a throwing source kept', 'audio', "catch (e) { r.live = false; console.warn('flyDiy audio: the source '", "catch (e) { console.warn('flyDiy audio: the source '", 'SOURCES'],
  ['sound off keeps the context', 'audio', 'ctx = null; api.ctx = null; silent = false;', 'api.ctx = null; silent = false;', 'SOURCES'],
  ['the loop\'s call gone', 'app', '    if (window.AUDIO) AUDIO.update(sim, camera, fdt, def, cam, inGarage, world);', '', 'WIRING'],
  ['the call before the render', 'app', '    if (window.AUDIO) AUDIO.update(sim, camera, fdt, def, cam, inGarage, world);', '', 'WIRING', s => s.replace('    if (aa) aa.render(inGarage', '    if (window.AUDIO) AUDIO.update(sim, camera, fdt, def, cam, inGarage, world);\n    if (aa) aa.render(inGarage')],
  ['the build loses audio.js', 'build', "'audio/audio_params.js', 'audio/audio.js',", "'audio/audio_params.js',", 'WIRING'],
  ['the shed rail loses the item', 'editor', "if (t.k === 'audio' && window.AUDIO)", "if (t.k === 'audioX' && window.AUDIO)", 'WIRING'],
  // SND-AIRFRAME (G1630-G1635)
  ['the stall alpha deaf to the flaps', 'params', 'st[0] + (st[1] - st[0]) * Math.min(1, fl / st[2])', 'st[0]', 'NUMBERS'],
  ['the build loses the airframe source', 'build', "'audio/airframe_model.js', 'audio/samples.js', 'audio/src_airframe.js',", "'audio/airframe_model.js', 'audio/samples.js',", 'WIRING'],
  ['the airframe worklet not served', 'build', "'prop_worklet.js', 'airframe_worklet.js']", "'prop_worklet.js']", 'WIRING'],
  ['the wind flat in V', 'model', 'const w25 = V > 2 ? vn * vn * Math.sqrt(vn) : 0;', 'const w25 = V > 2 ? 0.5 : 0;', 'AFMODEL'],
  ['the wind\'s band fixed', 'model', 'tg[T.windF] = V > 2 ? 250 + 28 *', 'tg[T.windF] = V > 2 ? 250 + 0 *', 'AFMODEL'],
  ['a touchdown every frame on the wheels', 'model', 'if (!on || was || off < A.tdOffS) continue;', 'if (!on) continue;', 'AFMODEL'],
  ['the touchdown deaf to the sink', 'model', 'const sev = Math.min(1, Math.max(0, -s[SI.vsMin] / A.tdVs));', 'const sev = 0.5;', 'AFMODEL'],
  ['the chirp on grass', 'model', 'sk === AF_SURF_PAVED && off >= A.chirpOffS', 'sk >= 0 && off >= A.chirpOffS', 'AFMODEL'],
  ['the reed below its band', 'model', 'const m = (alpha - (aS - A.warnA)) / A.warnA;', 'const m = (alpha - (aS - 3 * A.warnA)) / A.warnA;', 'AFMODEL'],
  ['the Cub gets a horn', 'model', "return { kind: AF_STALL.none, source: (mat || 'unknown')", "return { kind: AF_STALL.reed, source: (mat || 'unknown')", 'AFMODEL'],
  ['the reed without airflow', 'model', 'if (kind === AF_STALL.reed) sw = Math.min(1, Math.max(0, m)) * airflow;', 'if (kind === AF_STALL.reed) sw = Math.min(1, Math.max(0, m));', 'AFMODEL'],
  ['the model allocates a frame', 'model', '    s[SI.first] = 0;\n', '    s[SI.first] = 0; st.lastFrame = [s[SI.t]];\n', 'AFALLOC'],
  ['the worklet\'s params renamed', 'worklet', "'stallK', 'creak', 'flapM', 'open', 'duck'];", "'stallK', 'creak', 'flapM', 'open', 'duk'];", 'AFVOICE'],
  ['gravel sounds like scree', 'worklet', '[0.65, 0.20, 3200, 0.8, 28, 3500, 4, 0],', '[0.95, 0.30, 1500, 0.8, 12, 1900, 9, 0],', 'AFVOICE'],
  ['the touchdown deaf to its severity', 'worklet', 'this.voice(VK_LOW, 1, 1.1, k * (0.08 + 0.35 * s), 0.05 + 0.09 * s, 90 + 150 * s, 0, 1, 0, 0.9);\n      this.voice(VK_BAND, 1, 0.3, k * (0.05 + 0.15 * s)', 'this.voice(VK_LOW, 1, 1.1, k * 0.25, 0.1, 160, 0, 1, 0, 0.9);\n      this.voice(VK_BAND, 1, 0.3, k * 0.12', 'AFVOICE'],
  ['the horn outside', 'worklet', 'inn += dS * 0.12 * sp *', 'ext += dS * 0.12 * sp *', 'AFVOICE'],
  ['the closed cabin as loud as the open', 'worklet', '(1 - op) * 2.2 * z[Z_CABW]', '(1 - op) * 22 * z[Z_CABW]', 'AFVOICE'],
  ['the NaN unguarded', 'worklet', "if (!(yE === yE) || !(yI === yI)) { nanHit = 1; yE = 0; yI = 0; }", '', 'AFVOICE'],
  ['process() allocates', 'worklet', '    this.stats[3]++;\n', '    this.stats[3]++; this.lastBlock = [n];\n', 'AFALLOC'],
  ['a DC offset out', 'worklet', '      oE[j] = yE;\n', '      oE[j] = yE + 0.01;\n', 'AFFLOWN'],
  ['the wind blows the ceiling', 'model', 'Vref: 50, windExt: 0.08,', 'Vref: 50, windExt: 8,', 'AFFLOWN'],
  ['the floats\' splash lost', 'model', "if (wet && !(s[SI.pwet] > 0) && Math.min(s[SI.off0], s[SI.off1]) >= A.tdOffS)", "if (false)", 'AFFLOWN'],
  ['the source schedules every frame', 'srcaf', '        if (v === last[i]) continue;\n', '', 'AFSOURCE'],
  ['the source drops the events', 'srcaf', "          node.port.postMessage({ t: 'ev', e, s, a: E[o + 2], b: E[o + 3], k: rec });", '', 'AFSOURCE'],
  ['the targets unquantised', 'model', 'if (q > 0) tg[i] = Math.round(tg[i] / q) * q;', 'tg[i] = tg[i] + 1e-6 * Math.random();', 'AFSOURCE'],
  ['the stall never told', 'srcaf', "stallClk[1] = 1; api.emit('stall', 1); }", 'stallClk[1] = 1; }', 'AFSOURCE'],
  ['the slots fetch at attach', 'samples', 'attach(c) { ctx = c; return api; },', 'attach(c) { ctx = c; for (const k in KEYS) load(k); return api; },', 'SAMPLES'],
  ['two asks, two fetches', 'samples', '      if (r.promise) return r.promise;\n', '', 'SAMPLES'],
  ['the budget ignored', 'samples', 'if (bytes + add > budget) {', 'if (false) {', 'SAMPLES'],
  ['the loop seam un-faded', 'samples', 'dst[i] = src[a + i] * Math.sin(0.5 * Math.PI * t) + src[a + M + i] * Math.cos(0.5 * Math.PI * t);', 'dst[i] = src[a + i];', 'SAMPLES'],
  ['a failed key retried', 'samples', "}, e => { r.state = 'failed';", "}, e => { r.state = 'idle'; r.promise = null;", 'SAMPLES'],
  // G1674 THE MUSIC
  ['agl every frame and from the ground only', 'params', 'if (clk[1] >= 1 / AP_AGL_HZ) {', 'if (true) {', 'CONTACTS'],
  ['agl ignores the water', 'params', 'if (w > g) g = w;', '', 'CONTACTS'],
  ['an NC track validates', 'music', "const LICENCE_RE = /^(CC0( 1\\.0)?|CC-BY [34]\\.0|Public domain)$/i;", "const LICENCE_RE = /^(CC0( 1\\.0)?|CC-BY(-NC)? [34]\\.0|Public domain)$/i;", 'MUSIC_CAT'],
  ['an unhashed file validates', 'music', '[A-Za-z0-9_-]+\\.[0-9a-f]{8}\\.(mp3', '[A-Za-z0-9_.-]+\\.(mp3', 'MUSIC_CAT'],
  ['the asset base ignored', 'music', ": base + t.file));", ": t.file));", 'MUSIC_CAT'],
  ['the welcome is the air', 'audio', 'fl = inGarage || wl ? 0 : 1;', 'fl = inGarage ? 0 : 1;', 'MUSIC_CTX'],
  ['music in flight ignores its setting', 'music', 'return musicFlight && cruise ? C_CRUISE : C_NONE;', 'return cruise ? C_CRUISE : C_NONE;', 'MUSIC_CTX'],
  ['the cruise needs no dwell', 'music', 'if (st[1] >= CRUISE.dwellS) st[0] = 1;', 'st[0] = 1;', 'MUSIC_CTX'],
  ['the approach is a cruise', 'music', 'const approach = flap > CRUISE.flapMax || (vs < CRUISE.approachVs && agl < CRUISE.approachAgl);', 'const approach = flap > CRUISE.flapMax;', 'MUSIC_CTX'],
  ['the garage setting ignored', 'music', 'return musicGarage ? (welcome ? C_WELCOME : C_GARAGE) : C_NONE;', 'return welcome ? C_WELCOME : C_GARAGE;', 'MUSIC_CTX'],
  ['leaving a context keeps the track', 'music', '      fadeOut(a, XFADE_S);\n    }\n    hideNow();', '    }\n    hideNow();', 'MUSIC_CTX'],
  ['a faded element keeps streaming', 'music', 'if (DK[o + K_STOP] <= 0) release(k); }', '}', 'MUSIC_CTX'],
  ['the suspend leaves it playing', 'music', 'DK[k * K_N + K_PAUSED] = 1; try { decks[k].el.pause(); } catch (e) {}', 'DK[k * K_N + K_PAUSED] = 1;', 'MUSIC_CTX'],
  ['no resume', 'music', '{ RESUME_T[prev] = at; RESUME_P[prev] = pos; }', '{}', 'MUSIC_CTX'],
  ['the photo hook unheard', 'music', "au.onEvent('photo', on => setPhoto(on)),", '', 'MUSIC_CTX'],
  ['the bag deals at random', 'music', 'const t = b.ix[b.i++];', 'const t = b.ix[Math.floor(rand() * b.n)]; b.i++;', 'MUSIC_SHUFFLE'],
  ['a round opens on the last track', 'music', 'if (b.n > 1 && a[0] === b.last) {', 'if (false) {', 'MUSIC_SHUFFLE'],
  ['a failed track dealt', 'music', 'if (bad && bad[t]) continue;', '', 'MUSIC_SHUFFLE'],
  ['no silences in the garage', 'music', 'const GAPPED = [0, 1, 0, 0];', 'const GAPPED = [0, 0, 0, 0];', 'MUSIC_GAPS'],
  ['the silences too long', 'music', 'GAP_MAX_S = 120,', 'GAP_MAX_S = 300,', 'MUSIC_GAPS'],
  ['the silence a fixed one', 'music', 'PS[S_GAP] = GAP_MIN_S + rand() * (GAP_MAX_S - GAP_MIN_S);', 'PS[S_GAP] = GAP_MIN_S + 20;', 'MUSIC_GAPS'],
  ['the preload a whole gap early', 'music', 'if (PS[S_GAP] <= LEAD_S) preloadNext(c);', 'preloadNext(c);', 'MUSIC_GAPS'],
  ['a linear crossfade', 'music', 'CURVE_IN[i] = Math.sin(x); CURVE_OUT[i] = Math.cos(x);', 'CURVE_IN[i] = x / (Math.PI / 2); CURVE_OUT[i] = 1 - x / (Math.PI / 2);', 'MUSIC_XFADE'],
  ['a 2 s crossfade', 'music', 'const XFADE_S = 4,', 'const XFADE_S = 2,', 'MUSIC_XFADE'],
  ['the level untrimmed', 'music', 'fadeTo(k, trims[t], fade);', 'fadeTo(k, 1, fade);', 'MUSIC_XFADE'],
  ['skip keeps the old track', 'music', '    if (a >= 0) fadeOut(a, XFADE_S);\n    PS[S_GAP] = -1;', '    PS[S_GAP] = -1;', 'MUSIC_XFADE'],
  ['no duck', 'music', 'p.setTargetAtTime(DUCK_K, t, DUCK_IN_TAU);', '', 'MUSIC_DUCK'],
  ['the duck -3 dB', 'music', 'DUCK_K = Math.pow(10, -10 / 20)', 'DUCK_K = Math.pow(10, -3 / 20)', 'MUSIC_DUCK'],
  ['the duck never released', 'music', 'if (PS[S_DUCK] <= 0) unDuck(); }', '}', 'MUSIC_DUCK'],
  ['the hold not re-armed', 'music', '    PS[S_DUCK] = DUCK_HOLD_S;\n    if (!fresh) return;', '    if (!fresh) return;\n    PS[S_DUCK] = DUCK_HOLD_S;', 'MUSIC_DUCK'],
  ['the engine event unheard', 'music', "au.onEvent('engine', onDuck), ", '', 'MUSIC_DUCK'],
  ['a track decoded whole', 'music', 'function release(k) {', 'function release(k) { if (k < 0) ctx.decodeAudioData(null);', 'MUSIC_BUDGET'],
  ['a third element', 'music', '    for (let k = 0; k < 2; k++) {\n      const el = D.createElement', '    D.createElement(\'audio\');\n    for (let k = 0; k < 2; k++) {\n      const el = D.createElement', 'MUSIC_BUDGET'],
  ['born preloading', 'music', "el.preload = 'none';\n      el.crossOrigin", "el.preload = 'auto';\n      el.crossOrigin", 'MUSIC_BUDGET'],
  ['the music frame allocates', 'music', '    if (au.state === \'suspended\') return;', '    C.last = [dt];\n    if (au.state === \'suspended\') return;', 'MUSIC_BUDGET'],
  ['a steady music frame schedules', 'music', '      } else if (a < 0) startNext(c, 0);', '      } else if (a < 0) startNext(c, 0); else duck.gain.setTargetAtTime(1, 0, 1);', 'MUSIC_BUDGET'],
  ['the credits miss a track', 'music', "return (Array.isArray(cat) ? cat : []).map(", "return (Array.isArray(cat) ? cat : []).slice(1).map(", 'MUSIC_CREDITS'],
  ['CREDITS.md stale', 'credits', 'No track ships yet.', 'Nothing ships yet.', 'MUSIC_CREDITS'],
  ['the about line not extended', 'music', '\n  mountCreditLink();\n', '\n', 'MUSIC_CREDITS'],
  ['the screen forgets the engine synth', 'music', "line: 'engine-sound-generator by Antonio-R1 (MIT, © 2021-2022 Antonio-R1), the AudioWorklet our engine voice is ported from',", "line: 'the engine synthesiser',", 'MUSIC_CREDITS'],
  ['the build loses music.js', 'build', "              'audio/music.js',\n", '', 'MUSIC_WIRING'],
  ['the build forgets the catalogue', 'build', ';window.FLYDIY_MUSIC=${MUSIC}', '', 'MUSIC_WIRING'],
  ['sw.js cuts no range', 'build', 'if (range) { e.respondWith(ranged(req, range)); return; }', '', 'MUSIC_WIRING'],
  ['the engine emits no start', 'engine', "if (vals3) A.emit('engine', 'start'); ", '', 'MUSIC_WIRING'],
  ['no garage setting', 'audio', "    ['musicGarage', 1, 'bool',", "    ['musicGarageX', 1, 'bool',", 'MUSIC_WIRING'],
  ['the skip row gone', 'music', "btn('skip track', 'skip', () => skip());", '', 'MUSIC_WIRING'],
];

// a check returns its failures, or a promise of them (SAMPLES: the loader is promise-based)
const TIMES = {};
async function runCheck(k, S, report) {
  const t0 = performance.now();
  try { return await CHECKS[k](S, REPORTS[k] ? report : null); }
  catch (e) { return ['threw: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)]; }
  finally { TIMES[k] = (TIMES[k] || 0) + performance.now() - t0; }
}
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
async function runChecks(S, report) {
  const res = {};
  for (const k in CHECKS) res[k] = ONLY.length && !ONLY.includes(k) ? null : await runCheck(k, S, report);
  return res;
}

let fails = 0, pristine = null;
const say = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails++; };
(async () => {
if (!ONLY_SELFTEST) {
  const report = [];
  const res = pristine = await runChecks(SRC0, report);
  for (const k in res) {
    if (res[k] === null) { console.log('  skip ' + k); continue; }
    say(!res[k].length, k + (res[k].length ? ': ' + res[k].length + ' failure(s)' : ''));
    for (const f of res[k]) console.log('         ' + f);
  }
  for (const r of report.concat(MUSIC_REPORT)) console.log('  info ' + r);
  for (const b of FLOWN) {
    const AP = loadParams(SRC0.params), o = AP.audioParamsBlock();
    AP.audioParams(b.sim, { mode: 'chase' }, b.def, o, null, 1 / 60);
    console.log('  info ' + b.name.padEnd(24) + ' ' + Array.from({ length: o.nE }, (_, i) =>
      'prop ' + o.rpm[i].toFixed(0) + ' / engine ' + o.rpmEng[i].toFixed(0) + ' rpm, firing ' + o.fireHz[i].toFixed(1) + ' Hz (' + o.cyl[i] + ' cyl' + (o.twoStroke[i] ? ', 2-stroke' : '') + '), BPF ' + o.bpfHz[i].toFixed(1) + ' Hz (' + o.blades[i] + ' blades), tip M ' + o.tipM[i].toFixed(3)).join(' | '));
  }
}
// D: the selftest
{
  let caught = 0, skipped = 0;
  const base = pristine || await runChecks(SRC0, null);   // a mutation proves a check only when that check is green on the pristine text
  for (const [name, file, find, repl, check, also] of MUT) {
    if (ONLY.length && !ONLY.includes(check)) { skipped++; continue; }
    if (base[check].length) { say(false, 'SELF-TEST "' + name + '": ' + check + ' is already red on the pristine sources - nothing to prove'); continue; }
    const n = SRC0[file].split(find).length - 1;
    if (n !== 1) { say(false, 'SELF-TEST "' + name + '": the anchor is found ' + n + ' times in ' + FILES[file] + ' (want 1)'); continue; }
    const S = Object.assign({}, SRC0);
    S[file] = SRC0[file].replace(find, () => repl);
    if (also) S[file] = also(S[file]);
    const red = await runCheck(check, S, null);
    if (red.length) caught++;
    if (ONLY_SELFTEST || !red.length) say(red.length > 0, 'SELF-TEST "' + name + '" turns ' + check + ' red' + (red.length ? ': ' + red[0] : ' - MISSED'));
  }
  // restored: the files on disk byte-identical to the start, and the pristine text green again
  const SRC1 = readAll();
  say(shaOf(SRC1) === SHA0, 'SELF-TEST the sources are byte-identical after ' + MUT.length + ' mutations (' + SHA0.slice(0, 12) + ')');
  // ...and those bytes are the ones every check passed on before the first mutation (re-measuring the heap here would
  // measure the 26 mutated contexts' garbage, not the sources)
  const bad = Object.keys(base).filter(k => base[k] && base[k].length);
  say(!bad.length, 'SELF-TEST the restored sources are the ones checked green' + (bad.length ? ' - red: ' + bad.join(', ') : ''));
  say(caught + skipped === MUT.length, 'SELF-TEST ' + caught + ' / ' + (MUT.length - skipped) + ' mutations caught' + (skipped ? ' (' + skipped + ' skipped by --only)' : ''));
  if (process.argv.includes('--times')) console.log('  time ' + Object.keys(TIMES).map(k => k + ' ' + (TIMES[k] / 1000).toFixed(1) + ' s').join(', '));
}
console.log(`GATE AUDIO: ${fails ? 'FAIL (' + fails + ')' : ONLY.length ? 'PARTIAL (--only=' + ONLY.join() + ': not a pass)' : 'PASS'}`);
process.exitCode = fails ? 1 : 0;
})();
