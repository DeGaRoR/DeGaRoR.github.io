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
//   SP THE SPACE    (SND-SPACE, G1640-G1646) SP_CABIN, SP_DOPPLER, SP_ABSORB, SP_XFADE, SP_IR, SP_GRAPH, SP_BUDGET (its
//                   measurement in a child process: fresh realms; G1680: taken twice, by default and on TurboFan alone,
//                   --no-maglev), SP_CRAFT - each described at the head of its block.
//   RADIO THE STATIONS AND RADIO JOLENE'S TALK (SND-RADIO, G1675-G1679) RADIO_STATIONS (G1681: + the mix), RADIO_PICKER,
//                   RADIO_TALK, RADIO_BUDGET, RADIO_WIRING; RADIO_CLIPS (SND-RADIO-2, G1683: the recorded voice in the talk;
//                   G1702: the takes of the lazily fetched broadcast); THE LIVING RADIO (SND-RADIO-3, G1700-G1704): RADIO_LINT,
//                   RADIO_HORIZON, RADIO_WX, RADIO_XFADE, VOICE_LICENCE (RADIO_SCRIPTS, VOICE_AWOS, VOICE_MARINE retired with
//                   the AWOS and the marine forecast) - each described at the head of its block.
//   ANI THE ANIMALS' VOICES (SND-ANIMALS, G1705-G1709) ANIMAP, ANIBLOW, ANIELK, ANILAND, ANIGULL, ANIMILL, ANIPLAY, ANIALLOC -
//                   described at the head of their block (the real animals layer through animal_run.js's read-only reader).
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
  // SND-RADIO (G1675-G1679): Radio Jolene's talk, the stations' ruling, the key table (read: the free keys)
  radio: 'src/viewer/audio/radio_talk.js', selection: 'tools/audio/music_selection_v1.json', input: 'src/viewer/input.js',
  // SND-SPACE (G1640-G1646): the space's numbers, the space, the prop's source, the two voices' worklets (the doppler)
  spcfg: 'src/viewer/audio/space_config.js', space: 'src/viewer/audio/space.js', srcprop: 'src/viewer/audio/src_prop.js',
  engw: 'src/viewer/audio/engine_worklet.js', propw: 'src/viewer/audio/prop_worklet.js',
  // SND-AMB-1 (G1650-G1654): the ambience's numbers and its source
  ambmodel: 'src/viewer/audio/ambience_model.js', amb: 'src/viewer/audio/ambience.js',
  // SND-AMB-2 (G1660-G1666): the emitters' numbers, the emitters, the premises renderer's read-only accessor
  emmodel: 'src/viewer/audio/emitters_model.js', em: 'src/viewer/audio/emitters.js', prem: 'src/viewer/render_premises.js',
  // SND-ANIMALS (G1705-G1709): the animals' behaviours and their read-only reader
  anirun: 'src/viewer/animal_run.js',
  // SND-VOICE (G1626-G1629): Radio Jolene's words, their player, the catalogue, the script, GATE MEDIA's list
  voicemodel: 'src/viewer/audio/voice_model.js', voice: 'src/viewer/audio/voice.js', voicecat: 'src/viewer/audio/voice_catalogue.json',
  voicescript: 'tools/audio/voice_script.json', mediachk: 'tools/_media_check.js',
  // SND-RADIO-3 (G1700-G1704): the broadcast as written (radio_gen.js's) and as shipped (the media file the catalogue names)
  radioscript: 'tools/audio/radio_script.json',
};
{ let f = null; try { f = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src/viewer/audio/voice_catalogue.json'), 'utf8')).script.file; } catch (e) {}
  FILES.shipscript = f && fs.existsSync(path.join(__dirname, '..', '..', f)) ? f : 'tools/audio/radio_script.json'; }
const readAll = () => { const S = {}; for (const k in FILES) S[k] = fs.readFileSync(path.join(ROOT, FILES[k]), 'utf8'); return S; };
const shaOf = S => crypto.createHash('sha256').update(Object.keys(FILES).map(k => S[k]).join('\u0000')).digest('hex');
const SRC0 = readAll(), SHA0 = shaOf(SRC0);
const ONLY_SELFTEST = process.argv.includes('--selftest');
// SP_BUDGET's measurement runs in a CHILD process (a fresh heap and fresh realms: a process that already ran other pages
// carries their megamorphic call sites, whose float loads box - not the page's cost). The child flies the Cub only.
const SPB_CHILD = (process.argv.find(a => a.startsWith('--spbudget-child=')) || '').slice(17);

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
  if (opt.ctx) opt.ctx(AudioContextStub.prototype, C);   // G1654: more of the context (the ambience's buffers and filter)
  if (opt.noAC !== true) win.AudioContext = AudioContextStub;
  const ctx = { window: win, document: doc, console: opt.quiet ? { warn() {}, log() {}, error() {}, info() {} } : console,
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
  return { A: win.AUDIO, C, win, doc, store, L, DL, params, vmctx: ctx,
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
const FLOWN = (SPB_CHILD ? BUILDS.slice(0, 1) : BUILDS).map(b => {
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
  // (SND-SPACE's `pitch` - the doppler - is the voice's own param, not one of the model's targets)
  const names = W.Processor.parameterDescriptors.map(d => d.name).filter(n => n !== 'pitch');
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
  const store = o.store || {};
  if (!o.factory && !('flydiy.audio.musicGarage' in store)) store['flydiy.audio.musicGarage'] = '1';   // the shipped default is OFF (2026-10-04): the music checks turn it on
  const pg = makePage(S, { quiet: true, store, dom: () => fakeDom(st), clock: o.clock, badStorage: o.badStorage, ctx: o.ctxHook,
    before: win => { win.FLYDIY_MUSIC = o.cat || SYN; if (o.base != null) win.FLYDIY_ASSET_BASE = o.base; if (o.boot) win.BOOT = o.boot;
      if (o.beforeWin) o.beforeWin(win);   // G1683: the recorded voice's catalogue and fetch
      if (o.speech) { win.speechSynthesis = o.speech.S; win.SpeechSynthesisUtterance = o.speech.U; }   // G1678: the voice's stub
      if (o.credit) { const c = win.document.createElement('p'); c.id = 'credit'; win.document.body.appendChild(c); } },   // (body.html's about line is there before the scripts)
    after: [[S.radio, 'radio_talk.js'], [S.music, 'music.js']].concat(o.extra || []) });   // (the build's order; G1683: voice_model.js, voice.js after)
  const M = pg.win.AUDIO_MUSIC;
  M.seed(o.seed || 7);
  if (o.beforeGesture) o.beforeGesture(pg, M);
  if (!o.noGesture) pg.gesture('pointerdown');
  const b = FLOWN[0], wc = { mains: [true, true], tw: true, water: false };
  const sim = { p: b.sim.p, ctl: { thr: 0.6, flap: 0, eng: null }, eng: b.sim.eng.map(e => ({ running: true, key: 'both', crank: 0 })),
    out: { V: 0, vs: 0, alt: 0, oatC: 15, rpm: [2000], rpmEng: [2000], thrustPer: [0] }, wheelContacts: () => wc };
  const world = Object.assign({ surface: () => 0, terrainH: () => 0 }, o.world || {});
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
  if (!row || row[1] !== 0 || row[2] !== 'bool') F.push('the settings have no "music in the garage" (off by default: the user, 2026-10-04)');
  { const fb = { state: 'landing' }, fp = musicPage(S, { factory: true, boot: fb }); fp.F.run(2); fb.state = 'gone'; fp.F.garage = true; fp.F.run(4);
    if (fp.M.context !== 'none' || fp.F.streaming() !== 0 || fp.F.starts.length) F.push('a fresh player hears music (' + fp.M.context + ', ' + fp.F.starts.length + ' starts): the shipped default is music OFF'); }
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

// ==== SND-RADIO (G1675-G1679): THE STATIONS AND RADIO JOLENE'S TALK ==================================================
//   RADIO_STATIONS  the six keys = music_selection_v1.json's (its order), the shipped tracks' stations = the selection's;
//                   validate refuses an unknown station; stationLists (own per context, else lo-fi's; empty; off); the
//                   player: a switch crossfades into the new station's track, every start is the station's (or lo-fi's
//                   on a fallback), each station's bag survives visits elsewhere (no repeat inside its rounds), a
//                   station with no track plays lo-fi, 'off' streams nothing, the station persisted and read back, a
//                   throwing localStorage survived.
//   RADIO_PICKER    the sound rows: 'station' (six + off, the empty station's line says it plays lo-fi; choosing sets
//                   it), 'Radio Jolene talk', 'talk every' (persisted), 'voice' (the system's English voices; persisted);
//                   the keys ] / [ step the station, never with a modifier, in a text field, or when the input
//                   profile binds the key; input.js's defaults bind neither.
//   (RADIO_SCRIPTS, the AWOS and marine forecast's words, is RETIRED with them - G1701; RADIO_WX holds the weather in words.)
//   RADIO_TALK      the player with a stub speechSynthesis that counts utterances: nothing spoken before the gesture
//                   (frames run, the station set); after it the tune-in break (ID + weather) with the first track UNDER
//                   it at 16 % of its level, rising to its level over 1.5 s when the voice stops; a break every N
//                   tracks (2, then 3) in the garage, in the silence's place; none with the talk off or on another
//                   station; none while a duck holds (the next track gets its silence), a duck cancels one, a suspend
//                   cancels one, the watchdog ends a voice that never reports its end; George by default, rate / pitch
//                   0.95, the volume master x music x 1.25; a chosen voice used.
//   RADIO_BUDGET    a steady garage frame under a talk: nothing scheduled, the update 0 GC / no growth over 100 000.
//   RADIO_WIRING    the build lists radio_talk.js before music.js; the catalogue's stations are the ruling's.
const RSYN = [
  ['l0', 'lofi', ['welcome', 'garage', 'cruise'], 61], ['l1', 'lofi', ['welcome', 'garage'], 55], ['l2', 'lofi', ['garage', 'cruise'], 58],
  ['r0', 'roots', ['welcome', 'garage', 'cruise'], 64], ['r1', 'roots', ['garage'], 57], ['r2', 'roots', ['garage', 'cruise'], 62],
  ['j0', 'jazz', ['garage'], 50], ['j1', 'jazz', ['garage'], 52],
].map(([id, station, contexts, durationS], i) => ({ id, station, file: 'media/audio/music/' + id + '.' + (0x20000000 + i * 0x1111111).toString(16).slice(0, 8) + '.mp3',
  title: 'Song ' + id, artist: 'Player ' + i, licence: 'CC0', source: 'https://example.org/' + id, contexts, durationS, lufs: -16 - i * 0.5 }));
const RSYN_DUR = {}; for (const t of RSYN) RSYN_DUR[t.file] = t.durationS;
const FT_M = 0.3048, KT_MS = 0.514444, SM_M = 1609.344;
function loadRadio(text) { const c = { module: { exports: {} } }; vm.runInNewContext(text, c, { filename: 'radio_talk.js' }); return c.module.exports; }
// a world shaped as the game's (07_day.js's getters, 09_climate.js's calls, the premises' aerodromes)
function radioWorld(o) {
  const conv = o.conv != null ? o.conv : 19.32, th = ((o.dir || 0) - conv) * Math.PI / 180, spd = (o.kt || 0) * KT_MS;
  return {
    day: { oatC: o.t, dewC: o.td, cloudBase: o.baseM, cloudCoverEff: o.cover, cloudUpper: o.upper || [], qnhEff: o.qnh, utc: o.utc, localSeconds: o.local,
      tzLabel: 'AKDT', rh: o.rh, geo: { convergenceDeg: conv }, storm: o.storm || null, stormSpec: o.stormSpec || null },
    climate: { surfaceWind: () => ({ base: [0 - Math.sin(th) * spd, 0, Math.cos(th) * spd] }), spec: { gust: o.gust || 0 }, haze: () => ({ surfaceVisM: o.visM }) },
    seaTarget: { A: 0.018 * spd },
    aerodromes: [
      { id: 'w2', name: 'Jolene AFB 02/20', kind: 'strip', look: 'worn', landHdg: null },
      { id: 'HOME', name: 'Jolene AFB 13/31', kind: 'strip', look: 'worn', landHdg: null },
      { id: 'w3', name: 'Tamgas Hill Strip', kind: 'strip', look: 'gravel', landHdg: 2.88 },
      { id: 'SEA', name: 'Annette Dock', kind: 'water', look: 'none', landHdg: null }],
  };
}
const RW_DAY = { t: 15, td: 4.66, baseM: 1293, cover: 0.2, qnh: 101325, utc: 0, local: 57600, rh: 0.5, kt: 8, dir: 250, gust: 0.15, visM: 60000 };
function speechStub(voices) {
  const S = { utter: [], all: [], speaks: 0, cancels: 0,
    voices: voices || [{ name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB' }, { name: 'Samantha', lang: 'en-US' }, { name: 'Amelie', lang: 'fr-FR' }],
    getVoices() { return this.voices; }, speak(u) { this.speaks++; this.utter.push(u); this.all.push(u); },
    cancel() { this.cancels++; const q = this.utter.splice(0); for (const u of q) if (u.onerror) u.onerror({ error: 'canceled' }); },
    endAll() { const q = this.utter.splice(0); for (const u of q) if (u.onend) u.onend({}); } };
  class U { constructor(t) { this.text = t; } }
  return { S, U };
}
// a radio page: RSYN, the speech stub, the game's world on AUDIO.world, a station
// G1702: the shipped broadcast, with the radio catalogue's tracks given the back-announces of a Radio Jolene track
function radioTestScript(S) {
  const A = JSON.parse(S.shipscript), roots = Object.keys(A.pools.ba).filter(id => A.pools.ba[id].length >= 3);
  RSYN.forEach((t, i) => { A.pools.ba[t.id] = A.pools.ba[roots[i % roots.length]].slice(); });
  return A;
}
function radioPage(S, o) {
  o = o || {};
  const sp = o.speech || speechStub();
  const pg = musicPage(S, Object.assign({ cat: RSYN, durs: RSYN_DUR, speech: sp, world: radioWorld(RW_DAY) }, o,
    { beforeGesture: (p, M) => { if (!o.noScript && p.win.RADIO_TALK) p.win.RADIO_TALK.setScript(radioTestScript(S)); if (o.station) M.setStation(o.station, true); if (o.every) M.setTalkEvery(o.every); if (o.talk === false) M.setTalk(false); if (o.beforeGesture) o.beforeGesture(p, M); } }));
  pg.sp = sp.S;
  return pg;
}
const stationOfId = id => (RSYN.find(t => t.id === id) || {}).station;

function checkRadioStations(S) {
  const F = [];
  const sel = JSON.parse(S.selection), RT = loadRadio(S.radio);
  const pg0 = radioPage(S, {}), M = pg0.M;
  if (M.STATION_KEYS.join() !== Object.keys(sel.stations).join()) F.push('the stations are ' + M.STATION_KEYS.join() + ' (want the ruling\'s ' + Object.keys(sel.stations).join() + ')');
  const ship = JSON.parse(S.catalogue);
  for (const t of ship) { const it = sel.items.find(x => 'fma' + x.id === t.id); if (it && it.station !== M.stationOf(t)) F.push('the shipped ' + t.id + ' is on ' + M.stationOf(t) + ', the selection says ' + it.station); }
  if (!M.validate([Object.assign({}, RSYN[0], { station: 'disco' })]).length) F.push('validate accepts an unknown station');
  if (M.validate([Object.assign({}, RSYN[0], { station: undefined })]).length) F.push('validate refuses a track with no station (lo-fi)');
  if (M.validate(RSYN).length) F.push('the radio catalogue is invalid: ' + M.validate(RSYN)[0]);
  // stationLists: jazz has the garage (and the welcome / photo borrow it), the cruise falls to lo-fi's; blues has nothing
  const ix = id => RSYN.findIndex(t => t.id === id), ids = l => l.map(i => RSYN[i].id).join();
  const J = M.stationLists(RSYN, 'jazz');
  if (ids(J.lists[1]) !== 'j0,j1' || ids(J.lists[0]) !== 'j0,j1' || ids(J.lists[2]) !== 'l0,l2' || J.fell.join() !== '0,0,1,0' || J.empty) F.push('jazz\'s lists are ' + J.lists.map(ids).join(' | ') + ' fell ' + J.fell + ' (want j0,j1 | j0,j1 | l0,l2 | j0,j1, the cruise fallen to lo-fi)');
  const B = M.stationLists(RSYN, 'blues');
  if (!B.empty || ids(B.lists[1]) !== 'l0,l1,l2' || B.fell.join() !== '1,1,1,1') F.push('blues (no track) is ' + B.lists.map(ids).join(' | ') + ' (want lo-fi\'s, said empty)');
  const O = M.stationLists(RSYN, 'off');
  if (O.lists.some(l => l.length)) F.push('the radio off has tracks');
  // G1681 THE MIX: the seventh station, virtual - per context the union of the six stations' lists, each track once
  if (M.STATION_KEYS[M.STATION_KEYS.length - 1] !== 'mix' || (M.STATIONS.find(r => r[0] === 'mix') || [])[1] !== 'Random') F.push('the mix is not the last station, labelled Random');
  if (!M.validate([Object.assign({}, RSYN[0], { station: 'mix' })]).length) F.push('validate accepts a track tagged mix (the mix has no tracks of its own)');
  const mixCover = (cat, label) => {
    const X = M.stationLists(cat, 'mix'), six = M.STATION_KEYS.filter(k => k !== 'mix');
    X.lists.forEach((l, c) => {
      const want = new Set(); for (const k of six) for (const i of M.stationLists(cat, k).lists[c]) want.add(i);
      if (new Set(l).size !== l.length) F.push(label + ': the mix lists a track twice in context ' + c);
      if (l.length !== want.size || l.some(i => !want.has(i))) F.push(label + ': the mix\'s context ' + c + ' holds ' + l.length + ' tracks, the six stations ' + want.size);
    });
    return X;
  };
  mixCover(RSYN, 'the radio catalogue');
  const shipMix = mixCover(ship, 'the shipped catalogue');
  const garageAll = ship.map((t, i) => (t.contexts.indexOf('garage') >= 0 ? i : -1)).filter(i => i >= 0);
  if (shipMix.lists[1].length !== garageAll.length) F.push('the shipped mix\'s garage bag holds ' + shipMix.lists[1].length + ' of the ' + garageAll.length + ' garage tracks');
  for (const k of M.STATION_KEYS.filter(k => k !== 'mix')) if (M.stationLists(ship, k).lists[1].some(i => shipMix.lists[1].indexOf(i) < 0)) F.push('the shipped mix misses a ' + k + ' track');
  {   // the player on the mix: two whole rounds of the garage, every track once a round, the six stations' all heard
    const pm = radioPage(S, { station: 'mix', seed: 9 }), n = pm.M.stationLists(RSYN, 'mix').lists[1].length;
    pm.F.run(1.5 * 3600, 1);
    const ids = pm.F.starts.map(x => x.id);
    if (!n) F.push('the mix has no garage tracks');
    else if (ids.length < 2 * n) F.push('the mix started ' + ids.length + ' tracks in 1.5 hours (want two rounds of ' + n + ')');
    for (let r = 0; n && r + n <= Math.min(ids.length, 2 * n); r += n) if (new Set(ids.slice(r, r + n)).size !== n) { F.push('the mix repeated inside a round: ' + ids.slice(0, 2 * n).join()); break; }
    const heard = new Set(ids.map(stationOfId));
    for (const k of ['lofi', 'roots', 'jazz']) if (!heard.has(k)) F.push('the mix never played ' + k);
    if (pm.sp.speaks) F.push('the mix talked (' + pm.sp.speaks + ' utterances): the talk is the roots station\'s');
  }
  // THE PLAYER: roots (talk off) one track, lo-fi, roots, jazz, roots ... the roots starts across the visits = whole rounds
  const pg = radioPage(S, { station: 'roots', talk: false, seed: 11 }), X = pg.F, P = pg.M;
  X.run(3);
  for (let v = 0; v < 15; v++) { P.setStation(v % 2 ? 'jazz' : 'lofi'); X.run(6); P.setStation('roots'); X.run(6); }
  const seq = X.starts.filter(s => stationOfId(s.id) === 'roots').map(s => s.id);
  if (seq.length < 15) F.push('the roots station started ' + seq.length + ' tracks over sixteen visits');
  for (let r = 0; r + 3 <= seq.length; r += 3) if (new Set(seq.slice(r, r + 3)).size !== 3) { F.push('the roots bag repeated inside a round across the visits: ' + seq.join()); break; }
  const wrong = X.starts.filter(s => s.t > 0.5 && !['roots', 'jazz', 'lofi'].includes(stationOfId(s.id)));
  if (wrong.length) F.push('a start off the station: ' + wrong[0].id);
  // every start after a switch belongs to the station switched to (crossfaded: two decks for the 4 s, then one)
  const pj = radioPage(S, { station: 'jazz', talk: false }), XJ = pj.F;
  XJ.run(400, 0.25);
  if (XJ.starts.some(s => stationOfId(s.id) !== 'jazz')) F.push('the jazz station played ' + XJ.starts.filter(s => stationOfId(s.id) !== 'jazz').map(s => s.id).join());
  pj.M.setStation('lofi'); XJ.run(1);
  if (XJ.streaming() !== 2) F.push('a station switch streams ' + XJ.streaming() + ' elements a second in (want 2: the crossfade)');
  XJ.run(5);
  if (XJ.streaming() !== 1 || stationOfId(XJ.starts[XJ.starts.length - 1].id) !== 'lofi') F.push('after the switch\'s crossfade ' + XJ.streaming() + ' stream, the last start ' + XJ.starts[XJ.starts.length - 1].id);
  // a station with no track: lo-fi
  const pb = radioPage(S, { station: 'blues' }); pb.F.run(200, 0.25);
  if (!pb.F.starts.length || pb.F.starts.some(s => stationOfId(s.id) !== 'lofi')) F.push('the empty blues station played ' + pb.F.starts.map(s => s.id).join() + ' (want lo-fi)');
  // the radio off: nothing streams; back on: music
  pb.M.setStation('off'); pb.F.run(6);
  if (pb.F.streaming() !== 0 || pb.M.context !== 'none') F.push('the radio off streams ' + pb.F.streaming() + ' in context ' + pb.M.context);
  pb.M.setStation('lofi'); pb.F.run(2);
  if (pb.F.streaming() < 1) F.push('the radio back on plays nothing');
  // persisted and read back; a throwing localStorage survived
  const store = {}, pp = radioPage(S, { store }); pp.M.setStation('jazz');
  if (store['flydiy.audio.station'] !== 'jazz') F.push('the station is not persisted under flydiy.audio.station (' + store['flydiy.audio.station'] + ')');
  const pr = radioPage(S, { store });
  if (pr.M.station !== 'jazz') F.push('a new page reads the station ' + pr.M.station + ' (want the stored jazz)');
  try { const pz = radioPage(S, { badStorage: true }); pz.M.setStation('roots'); pz.F.run(2); if (pz.M.station !== 'roots') F.push('a throwing localStorage lost the station'); }
  catch (e) { F.push('a throwing localStorage threw: ' + e.message); }
  return F;
}

const txt0 = (sel, v) => (sel.children.find(c => c.value === v) || {}).textContent || '';
function checkRadioPicker(S) {
  const F = [];
  const store = {}, pg = radioPage(S, { store }), M = pg.M;
  const rows = {}, sels = {};
  const kit = { row: (b, l) => { const r = pg.doc.createElement('div'); rows[l] = r; return r; }, range: (b, l, a, z, st, get, set, fmt) => { rows[l] = { get, set, fmt, a, z }; },
    toggle: (b, l, get, set) => { rows[l] = { get, set }; }, note() {} };
  pg.A.mount(pg.doc.body, kit);
  for (const l of ['station', 'Radio Jolene talk', 'talk every', 'voice', 'skip track']) if (!rows[l]) F.push('the sound menu has no "' + l + '" row');
  const selOf = l => rows[l] && rows[l].children && rows[l].children.find(c => c.tag === 'select');
  const st = selOf('station');
  if (!st) return F.concat(['the station row has no select']);
  const opts = st.children.map(c => c.value);
  if (opts.join() !== M.STATION_KEYS.concat(['off']).join() || opts.indexOf('mix') < 0) F.push('the station choices are ' + opts.join() + ' (want the seven - the mix among them - and off)');
  if (!/^Random/.test(txt0(st, 'mix'))) F.push('the mix reads "' + txt0(st, 'mix') + '" in the picker (want Random)');
  const txt = v => txt0(st, v);
  if (!/no tracks yet/.test(txt('blues')) || !/Lo-fi/.test(txt('blues'))) F.push('the empty blues station reads "' + txt('blues') + '" (want it to say it plays lo-fi)');
  if (/no tracks yet/.test(txt('jazz')) || /no tracks yet/.test(txt('lofi'))) F.push('a station with tracks says it has none');
  if (st.value !== M.station) F.push('the picker shows ' + st.value + ', the station is ' + M.station);
  st.value = 'roots'; st.onchange();
  if (M.station !== 'roots') F.push('choosing roots in the picker left the station on ' + M.station);
  const ev = rows['talk every'];
  if (ev && ev.set) { ev.set(3); if (M.talkEvery !== 3 || store['flydiy.audio.radioEvery'] !== '3') F.push('talk every 3 reads ' + M.talkEvery + ', stored ' + store['flydiy.audio.radioEvery']); if (ev.fmt(1) !== '1 track') F.push('talk every reads "' + ev.fmt(1) + '"'); }
  const tk = rows['Radio Jolene talk'];
  if (tk && tk.set) { if (!tk.get()) F.push('the talk is off by default'); tk.set(false); if (M.talk || store['flydiy.audio.radioTalk'] !== '0') F.push('the talk toggle did not switch it off (persisted)'); tk.set(true); }
  const vs = selOf('voice');
  if (!vs) F.push('the voice row has no select');
  else {
    const names = vs.children.map(c => c.value);
    if (!names.includes('Microsoft George - English (United Kingdom)') || !names.includes('Samantha') || names.includes('Amelie') || names[0] !== '') F.push('the voices offered are ' + names.join(' / ') + ' (want automatic, then the English ones)');
    vs.value = 'Samantha'; vs.onchange();
    if (M.voice !== 'Samantha' || store['flydiy.audio.radioVoice'] !== 'Samantha') F.push('choosing a voice did not keep it');
  }
  // THE KEYS
  const key = (code, extra) => { for (const fn of (pg.L.keydown || []).slice()) fn(Object.assign({ code, type: 'keydown' }, extra || {})); };
  M.setStation('lofi', true);
  key('BracketRight');
  if (M.station !== 'dubambient') F.push('] from lo-fi went to ' + M.station + ' (want the next, dubambient)');
  key('BracketLeft'); key('BracketLeft');
  if (M.station !== 'jazz') F.push('[ [ from dubambient went to ' + M.station + ' (want jazz)');
  key('BracketLeft');
  if (M.station !== 'mix') F.push('[ from jazz went to ' + M.station + ' (want it to wrap to the mix, the seventh)');
  key('BracketLeft');
  if (M.station !== 'classical') F.push('[ from the mix went to ' + M.station + ' (want classical)');
  key('BracketRight'); key('BracketRight');
  if (M.station !== 'jazz') F.push('] ] from classical went to ' + M.station + ' (want the mix, then jazz)');
  key('BracketLeft');
  if (store['flydiy.audio.station'] !== 'mix') F.push('the mix is not persisted like the others (' + store['flydiy.audio.station'] + ')');
  M.setStation('classical', true);
  key('BracketRight', { ctrlKey: true });
  if (M.station !== 'classical') F.push('ctrl + ] moved the station');
  key('BracketRight', { target: { closest: q => (/input/.test(q) ? {} : null) } });
  if (M.station !== 'classical') F.push('] in a text field moved the station');
  pg.win.FLYDIY_INPUT = { profile: () => ({ bindings: { viewNext: [{ type: 'key', code: 'BracketRight' }] } }) };
  key('BracketRight');
  if (M.station !== 'classical') F.push('] moved the station although the input profile binds it');
  delete pg.win.FLYDIY_INPUT;
  if (/'Bracket(Left|Right)'/.test(S.input.slice(S.input.indexOf('const ACTIONS = ['), S.input.indexOf('const BY_ID')))) F.push('input.js\'s default ACTIONS bind a bracket key: the station keys are not free');
  return F;
}

const deckNow = pg => { const a = pg.M._ps[5]; return a >= 0 ? { k: a, lvl: pg.M._lvlAt(a, pg.A.ctx.currentTime), t: pg.M._dk[a * 10 + 1] } : null; };
const trimOfIdx = (pg, t) => pg.M.trimOf(pg.M.catalogue[t]);
function checkRadioTalk(S) {
  const F = [];
  // NOTHING BEFORE THE GESTURE: the station set, frames run, a station switched - no utterance, no speaker
  const p0 = radioPage(S, { station: 'roots', noGesture: true, beforeGesture: (p, M) => { M.setStation('jazz', true); M.setStation('roots', true); } });
  p0.F.run(5);
  if (p0.sp.speaks || p0.A.ctx) F.push('before the gesture: ' + p0.sp.speaks + ' utterances, a context ' + !!p0.A.ctx);
  p0.gesture('pointerdown'); p0.F.run(0.5);
  if (!p0.sp.speaks) F.push('after the gesture the roots station did not open with its ID');
  // THE TUNE-IN BREAK AND THE BED
  const pg = radioPage(S, { station: 'roots' }), X = pg.F, M = pg.M, sp = pg.sp;
  X.run(2);
  const ut = sp.all.map(u => u.text);
  {   // G1702: an ID and the weather in words - the script's takes, read by the fallback voice here (no AUDIO_VOICE on this page)
    const A = JSON.parse(S.shipscript), ids = new Set(), wxs = Object.keys(A.items).filter(k => /^wx\./.test(k)).map(k => A.items[k].text);
    for (const p in A.pools.id) for (const k of A.pools.id[p]) ids.add(A.items[k].text);
    if (ut.length !== 2 || !ids.has(ut[0]) || !ut[1] || /\d/.test(ut[1]) || !wxs.some(w => ut[1].indexOf(w) === 0)) F.push('the tune-in spoke ' + ut.length + ': ' + ut.map(t => t.slice(0, 40)).join(' | ') + ' (want a station ID, then the weather in words)');
  }
  const u0 = sp.all[0] || {};
  if (!u0.voice || u0.voice.name !== 'Microsoft George - English (United Kingdom)' || u0.rate !== 0.95 || u0.pitch !== 0.95) F.push('the voice is ' + (u0.voice && u0.voice.name) + ' at rate ' + u0.rate + ', pitch ' + u0.pitch + ' (want George, 0.95, 0.95)');
  if (!near(u0.volume, Math.min(1, 0.8 * 0.6 * 1.25), 1e-9)) F.push('the voice volume is ' + u0.volume + ' (want master x music x 1.25 = 0.6)');
  const d0 = deckNow(pg);
  if (!d0 || !M.talking) return F.concat(['no track under the tune-in (or no talk): ' + JSON.stringify(d0)]);
  const tr0 = trimOfIdx(pg, d0.t);
  if (!near(d0.lvl, 0.16 * tr0, 0.02)) F.push('under the voice the track sits at ' + (d0.lvl / tr0 * 100).toFixed(1) + ' % of its level (want 16 %)');
  X.run(4);
  if (!near(deckNow(pg).lvl, 0.16 * tr0, 0.02)) F.push('6 s into the talk the bed moved: ' + (deckNow(pg).lvl / tr0 * 100).toFixed(1) + ' %');
  sp.endAll();
  const tEnd = pg.A.ctx.currentTime;
  X.step(0.1, 7);
  const mid = deckNow(pg).lvl / tr0;
  X.step(0.1, 9);
  const after = deckNow(pg).lvl / tr0;
  if (M.talking) F.push('the voice ended but the talk did not');
  if (!(mid > 0.3 && mid < 0.99)) F.push('0.7 s after the voice the track is at ' + (mid * 100).toFixed(0) + ' % (want rising)');
  if (!near(after, 1, 0.02)) F.push('1.6 s after the voice the track is at ' + (after * 100).toFixed(1) + ' % of its level (want 100: the 1.5 s rise)');
  if (!near(pg.M._lvlAt(deckNow(pg).k, tEnd + 1.5), tr0, 0.02)) F.push('the rise is not 1.5 s long');
  // EVERY N TRACKS, in the garage's silence: a log of starts and breaks over two hours, the voice ending 3 s in
  const every = (n, sec) => {
    const p = radioPage(S, { station: 'roots', every: n, seed: 5 }), L = [];
    let talks = p.M._C.talks, tAt = -1;
    p.F.each = () => { if (p.M._C.talks !== talks) { talks = p.M._C.talks; L.push('T'); tAt = p.F.t; } if (p.sp.utter.length && p.F.t - tAt > 3) p.sp.endAll(); };
    p.A.onEvent('music', () => L.push('s'));
    p.F.run(sec, 0.25);
    return { L: L.join(''), p };
  };
  for (const n of [2, 3]) {
    const { L } = every(n, 3 * 3600), parts = L.split('T').slice(1);
    if (parts.length < 6) F.push('talk every ' + n + ': only ' + parts.length + ' breaks in three hours (' + L + ')');
    const bad = parts.slice(0, -1).filter(x => x.length !== n);
    if (bad.length) F.push('talk every ' + n + ': the tracks between breaks ' + parts.map(x => x.length).join(',') + ' (want ' + n + ')');
  }
  {   // the break takes the silence's place: the next track starts with the break, not 30-120 s later
    const p = radioPage(S, { station: 'roots', every: 2, seed: 3 }), T = [];
    let talks = p.M._C.talks;
    p.F.each = () => { if (p.M._C.talks !== talks) { talks = p.M._C.talks; T.push({ t: p.F.t, n: p.F.starts.length }); } if (p.sp.utter.length) p.sp.endAll(); };
    p.F.run(1800, 0.25);
    const late = T.filter(x => !p.F.starts.slice(x.n - 1).some(s => Math.abs(s.t - x.t) < 0.3));
    if (T.length < 3 || late.length) F.push('a garage break did not start its track with it (' + late.length + ' of ' + T.length + ')');
  }
  // NONE with the talk off, NONE on another station
  for (const [why, o] of [['the talk off', { station: 'roots', talk: false }], ['lo-fi', { station: 'lofi' }], ['jazz', { station: 'jazz' }], ['the mix', { station: 'mix' }]]) {
    const p = radioPage(S, o); p.F.run(1800, 0.25);
    if (p.sp.speaks) F.push(why + ': ' + p.sp.speaks + ' utterances in half an hour');
  }
  // A DUCK: a break never under it; a duck event cancels one
  {
    const p = radioPage(S, { station: 'roots' });
    p.F.run(2);
    const c0 = p.sp.cancels;
    p.A.emit('engine', 'start');
    p.F.run(0.2);
    if (p.M.talking || p.sp.cancels === c0 || p.M._C.talkCuts !== 1) F.push('an engine start did not cancel the talk (talking ' + p.M.talking + ', cancels ' + (p.sp.cancels - c0) + ')');
    const d = deckNow(p);
    if (d && p.M._dk[d.k * 10 + 8] !== trimOfIdx(p, d.t)) F.push('the cancelled talk left the track at its bed');
    // ... and while a duck holds, the break owed at a track's end waits: the silence instead
    p.F.run(10);
    p.M.setTalkEvery(1);
    const n0 = p.sp.speaks;
    let ducked = false;
    // (G1703: the stall comes before the talk-up's window opens, and holds through the transition)
    p.F.each = () => { const a = p.M._ps[5]; if (!ducked && a >= 0) { const rem = p.M._dk[a * 10 + 3] - p.M._dk[a * 10 + 2]; if (rem < 7.5 && rem > 6.5) { ducked = true; p.A.emit('stall'); } } };
    const s0 = p.F.starts.length;
    for (let i = 0; i < 400 && !ducked; i++) p.F.run(0.25, 0.25);
    p.F.run(12, 0.25);
    if (!ducked) F.push('the duck test never reached a track\'s end');
    else if (p.sp.speaks !== n0) F.push('a break was spoken under a duck (' + (p.sp.speaks - n0) + ' utterances)');
    else if (p.F.starts.length === s0) F.push('the ducked transition did not move on to the next track');
  }
  // A SUSPEND cancels a talk
  {
    const p = radioPage(S, { station: 'roots' });
    p.F.run(2);
    p.doc.hidden = true; p.docEvent('visibilitychange'); p.runTimers(); p.F.run(0.2);
    if (p.M.talking || !p.sp.cancels) F.push('a hidden tab left the voice talking');
  }
  // THE WATCHDOG: a voice that never reports its end
  {
    const p = radioPage(S, { station: 'roots' });
    p.F.run(2);
    const left = p.M._ps[8];
    if (!(left > 10 && left < 200)) F.push('the watchdog was armed for ' + left + ' s');
    p.F.run(left + 2);   // (the watchdog's end, then the 1.5 s rise)
    const d = deckNow(p);
    if (p.M.talking || (d && !near(d.lvl, trimOfIdx(p, d.t), 0.02))) F.push('the watchdog did not end a silent voice (talking ' + p.M.talking + ')');
  }
  // A CHOSEN VOICE
  {
    const p = radioPage(S, { station: 'roots', store: { 'flydiy.audio.radioVoice': 'Samantha' } });
    p.F.run(1);
    if (!p.sp.all.length || !p.sp.all[0].voice || p.sp.all[0].voice.name !== 'Samantha') F.push('the chosen voice Samantha was not used');
  }
  return F;
}

function checkRadioBudget(S) {
  const F = [];
  let tick = 0;
  const pg = radioPage(S, { station: 'roots', durs: new Proxy({}, { get: () => 1e5 }), clock: () => ++tick }), M = pg.M, A = pg.A;
  pg.F.run(1);
  if (!M.talking) return ['no talk to measure under'];
  M._ps[8] = 1e9;   // (the watchdog held: the frame UNDER a talk is measured, not its end)
  const go = () => A.update(pg.sim, pg.camera, 1 / 60, pg.b.def, pg.cam, true, pg.world);
  for (let i = 0; i < 3000; i++) go();
  const s0 = pg.C.sched, e0 = pg.params.reduce((n, p) => n + p.ev.length, 0);
  for (let i = 0; i < 3000; i++) go();
  if (pg.C.sched !== s0 || pg.params.reduce((n, p) => n + p.ev.length, 0) !== e0) F.push('a steady frame under a talk scheduled AudioParam changes');
  const P = A.params, up = M.source.update, one = () => up(P, 1 / 60, A);
  for (let i = 0; i < 20000; i++) one();
  let gcs = 0;
  const obs = new PerformanceObserver(list => { gcs += list.getEntries().length; });
  obs.observe({ entryTypes: ['gc'] });
  global.gc(); global.gc();
  const g0 = gcs, h0 = process.memoryUsage().heapUsed;
  for (let i = 0; i < 100000; i++) one();
  const dB = process.memoryUsage().heapUsed - h0, gIn = gcs - g0;
  obs.disconnect();
  MUSIC_REPORT.push('the radio\'s update() under a talk: heap ' + (dB >= 0 ? '+' : '') + dB + ' B over 100 000 frames, ' + gIn + ' GC');
  if (gIn > 0) F.push('a GC ran inside the radio\'s measured window: something allocates');
  if (dB > 16384) F.push('the frame under a talk grew the heap ' + dB + ' B over 100 000 frames');
  if (!M.talking) F.push('the talk ended inside the measurement');
  return F;
}

function checkRadioWiring(S) {
  const F = [];
  const s0 = S.build.indexOf("    scripts: ['storage.js'"), s1 = S.build.indexOf("'dev_panel.js']", s0);
  const list = s0 >= 0 && s1 > s0 ? S.build.slice(s0, s1) : '';
  const ir = list.indexOf("'audio/radio_talk.js'"), im = list.indexOf("'audio/music.js'");
  if (!(ir >= 0 && im > ir)) F.push('build.js MANIFEST.viewer.scripts does not list audio/radio_talk.js before audio/music.js');
  const sel = JSON.parse(S.selection);
  for (const t of JSON.parse(S.catalogue)) if (t.station && !(t.station in sel.stations)) F.push('the catalogue\'s ' + t.id + ' is on ' + t.station + ', not a station of the ruling');
  if (/AudioContext|create[A-Z]\w*\(|\.connect\(/.test(S.radio.replace(/\/\/.*$/gm, ''))) F.push('radio_talk.js touches Web Audio (the clips are AUDIO_VOICE\'s into music.js\'s radioIn, the rest speechSynthesis; the bed is the music deck\'s gain)');
  return F;
}


// ==== SND-RADIO-2 (G1680-G1684): THE RECORDED VOICE IN THE TALK ======================================================
//   RADIO_CLIPS  the break on a page with voice_model.js + voice.js and a voice catalogue holding every key the talk can
//                name: ALL CLIPS -> no utterance, one sequence of buffer sources (the tune-in's ID then its AWOS, the
//                talker's plan one clip group), every segment's clips the keys the voice script renders (twelve breaks
//                on a Jolene-shaped world: no key outside clipLines / VOCAB / the tracks'), the track under them at 16 %
//                and rising over 1.5 s once the last clip ends; PER SEGMENT FALLBACK -> a catalogue without one AWOS word
//                plays the ID's clips and speaks the AWOS only after them, one without the ID's line speaks the ID and
//                plays the AWOS's clips after the utterance ends; THE ROUTE -> the clips' gain into radioIn (x clipK =
//                1.25 x 10^((-16 - -20) / 20)), radioIn into the music's duck, the duck into the music bus; THE DUCKS AND
//                THE SUSPEND -> an engine start stops every source of a playing break (and ducks the bus they pass), a
//                hidden tab stops them; the watchdog armed for the clips' own length; frames under a clip talk allocate
//                nothing (100 000, 0 GC).
// a radio page with the recorded voice: the broadcast script fetched LAZILY through ASSET_FETCH (as the game does), the
// takes played on stub buffer sources (o.drop: a test on the keys AUDIO_VOICE is handed - those missing)
function radioClipPage(S, o) {
  o = o || {};
  const script = radioTestScript(S), V = { srcs: [], gains: [], fetches: 0, scriptFetches: 0 };
  const bytes = Buffer.from(JSON.stringify(script));
  const pg = radioPage(S, Object.assign({}, o, { noScript: true,
    extra: [[S.voicemodel, 'voice_model.js'], [S.voice, 'voice.js']],
    beforeWin: win => { win.FLYDIY_VOICE = { voice: { name: 'norman', render: { lufs: -20 } }, script: { file: 'media/audio/voice/radio_script.00000000.json' } };
      win.ASSET_FETCH = u => { V.fetches++; if (/\.json$/.test(u)) { V.scriptFetches++; return Promise.resolve(new Uint8Array(bytes)); } return Promise.resolve(new Uint8Array(Math.round(0.4 * 48000))); }; },
    beforeGesture: (p, M) => { if (o.drop) { const AV = p.vmctx.AUDIO_VOICE, sc = AV.setClips; AV.setClips = c => { const f = {}; for (const k in c) if (!o.drop(k)) f[k] = c[k]; sc(f); }; } if (o.beforeGesture) o.beforeGesture(p, M); },
    ctxHook: P => {
      const g0 = P.createGain;
      P.createGain = function () { const g = g0.call(this); g.to = []; g.connect = d => { g.to.push(d); return d; }; V.gains.push(g); return g; };
      P.decodeAudioData = (ab, ok) => { const d = new Float32Array(ab.byteLength).fill(0.1); const b = { length: d.length, numberOfChannels: 1, sampleRate: 48000, duration: d.length / 48000, getChannelData: () => d }; ok(b); return Promise.resolve(b); };
      P.createBufferSource = function () { const x = { to: null, stopped: 0, onended: null, connect(d) { x.to = d; }, start(t, off, dur) { V.srcs.push({ x, t, off, dur }); }, stop() { x.stopped = 1; } }; return x; };
    } }));
  return Object.assign(pg, { V, script });
}
const tick = () => new Promise(r => setImmediate(r));
const ticks = async n => { for (let i = 0; i < (n || 4); i++) await tick(); };
const endClips = V => { const l = V.srcs[V.srcs.length - 1]; if (l && l.x.onended) l.x.onended(); };
const planOf = M => (M.talker && M.talker.last ? M.talker.last.groups.map(g => (g.clips ? 'clips' : 'speech') + ':' + g.kinds.join('+')).join(' | ') : 'none');
async function checkRadioClips(S) {
  const F = [];
  // THE LAZY SCRIPT AND THE LATE TUNE-IN: the gesture on Radio Jolene fetches the broadcast once; the first track starts
  // at its level, and when the script is in, the owed tune-in talks over it (the track brought down to the bed)
  const pg = radioClipPage(S, { station: 'roots' }), M = pg.M, V = pg.V;
  pg.F.run(0.3);
  const d00 = deckNow(pg);
  await ticks(); pg.F.run(1.7);
  if (V.scriptFetches !== 1) F.push('the broadcast script was fetched ' + V.scriptFetches + ' times on tuning in (want once)');
  const T = M.talker;
  if (!T || !T.last) return F.concat(['the roots tune-in did not reach the talker (talker ' + !!T + ')']);
  if (!d00) F.push('no track while the script was loading');
  const plan = planOf(M);
  if (plan !== 'clips:id+wx') F.push('the tune-in with every take present played ' + plan + ' (want one clip group: id+wx)');
  if (pg.sp.speaks) F.push('the tune-in with every take present spoke ' + pg.sp.speaks + ' utterances (want 0)');
  const segs = M._lastSegs ? M._lastSegs() : null;
  const want = segs ? segs.reduce((n, x) => n + x.clips.filter(k => typeof k === 'string').length, 0) : -1;
  if (V.srcs.length !== want) F.push('the tune-in started ' + V.srcs.length + ' buffer sources (want one per take: ' + want + ')');
  const t0 = V.srcs.length ? V.srcs[0].t : 0, gapFree = V.srcs.every((x, i) => !i || x.t >= V.srcs[i - 1].t + V.srcs[i - 1].dur - 1e-9);
  if (!gapFree) F.push('the takes overlap: not one sequence');
  const d0 = deckNow(pg);
  if (!d0 || !near(d0.lvl, 0.16 * trimOfIdx(pg, d0.t), 0.02)) F.push('under the late tune-in the track is at ' + (d0 ? (d0.lvl / trimOfIdx(pg, d0.t) * 100).toFixed(1) : '-') + ' % (want 16)');
  const wd = M._ps[8], len = V.srcs.length ? V.srcs[V.srcs.length - 1].t + V.srcs[V.srcs.length - 1].dur - t0 : 0;
  if (!(wd > len && wd < len + 20)) F.push('the watchdog is armed for ' + wd.toFixed(1) + ' s (want the takes\' ' + len.toFixed(1) + ' s + the slack)');
  // THE ROUTE: the reading's gain -> radioIn -> the duck -> the music bus; radioIn at clipK
  const rin = M.radioIn, gv = V.gains.find(g => g.to.length && g.to[0] === rin && g !== rin);
  const duck = rin && rin.to[0], bus = pg.A.bus('music');
  if (!gv) F.push('the takes do not pass radioIn');
  if (!rin || !duck || !duck.to || duck.to[0] !== bus || V.gains.filter(g => g.to.indexOf(bus) >= 0).length !== 1) F.push('radioIn does not feed the music\'s duck (the one gain into the music bus)');
  if (rin && !near(rin.gain.value, 1.25 * Math.pow(10, 4 / 20), 1e-9)) F.push('radioIn is x' + (rin && rin.gain.value) + ' (want VOICE_K x the 4 dB from the takes\' -20 LUFS to the tracks\' -16)');
  // the end of the last take: the talk ends, the track rises over 1.5 s
  endClips(V); const tEnd = pg.A.ctx.currentTime;
  pg.F.step(0.1, 16);
  if (M.talking) F.push('the last take ended but the talk did not');
  const d1 = deckNow(pg);
  const mid = d1 ? M._lvlAt(d1.k, tEnd + 0.75) / trimOfIdx(pg, d1.t) : 0;
  if (!d1 || !near(d1.lvl, trimOfIdx(pg, d1.t), 0.02) || !near(M._lvlAt(d1.k, tEnd + 1.5), trimOfIdx(pg, d1.t), 0.02) || !(mid > 0.3 && mid < 0.99)) F.push('after the takes the track does not rise over 1.5 s to its level (mid-rise ' + (mid * 100).toFixed(0) + ' %)');
  // NOT ON ANOTHER STATION: lo-fi fetches no script; tuning Radio Jolene then does
  {
    const p = radioClipPage(S, { station: 'lofi' });
    p.F.run(2); await ticks();
    if (p.V.scriptFetches) F.push('on lo-fi the broadcast script was fetched (' + p.V.scriptFetches + ')');
    p.M.setStation('roots'); await ticks(); p.F.run(0.5);
    if (p.V.scriptFetches !== 1) F.push('tuning Radio Jolene fetched the script ' + p.V.scriptFetches + ' times (want once)');
  }
  // A REGULAR BREAK: the program's next break, its back-announce in takes by the track's id
  {
    const p = radioClipPage(S, { station: 'roots', every: 1 });
    let seen = 0;
    for (let i = 0; i < 400 && p.M._C.talks < 2; i++) { p.F.run(1); await ticks(2); if (p.V.srcs.length > seen) { seen = p.V.srcs.length; endClips(p.V); } }
    const pl = planOf(p.M), segs2 = p.M._lastSegs ? p.M._lastSegs() : [];
    const back = segs2.find(x => x.kind === 'back'), tr = back && p.M.catalogue.find(t => (p.script.pools.ba[t.id] || []).indexOf(back.items[0]) >= 0);
    if (p.M._C.talks < 2 || !/^clips:/.test(pl) || pl.indexOf('|') >= 0 || p.sp.speaks) F.push('the second break played ' + pl + ' with ' + p.sp.speaks + ' utterances (want all of it in takes)');
    if (!back || !tr) F.push('the back-announce is not one of the track\'s own takes: ' + JSON.stringify(back && back.items));
  }
  // PER SEGMENT: the weather's takes missing -> the ID's takes, then the weather spoken (after them, not over them)
  {
    const p = radioClipPage(S, { station: 'roots', drop: k => /^wx\./.test(k) });
    p.F.run(0.3); await ticks(); p.F.run(0.3);
    const pl = planOf(p.M);
    if (pl !== 'clips:id | speech:wx') F.push('without the weather\'s takes the tune-in played ' + pl + ' (want the ID\'s takes, the weather spoken)');
    if (p.sp.speaks) F.push('the weather was spoken over the ID\'s takes (' + p.sp.speaks + ' utterances before the takes ended)');
    const nid = p.V.srcs.length;
    endClips(p.V); await ticks(); p.F.run(0.2);
    if (p.sp.speaks !== 1 || /\d/.test((p.sp.all[0] || {}).text || '1')) F.push('after the ID\'s takes the weather was not spoken in words (' + p.sp.speaks + ')');
    if (p.V.srcs.length !== nid) F.push('the weather with its takes missing still played takes');
    if (!p.M.talking) F.push('the talk ended before the spoken weather');
    p.sp.endAll(); p.F.run(0.2);
    if (p.M.talking) F.push('the spoken weather ended but the talk did not');
  }
  // ... and the IDs' takes missing -> the ID spoken, the weather's takes after the utterance
  {
    const p = radioClipPage(S, { station: 'roots', drop: k => /^id\./.test(k) });
    p.F.run(0.3); await ticks();
    if (p.sp.speaks !== 1 || p.V.srcs.length) F.push('without the IDs\' takes: ' + p.sp.speaks + ' utterances, ' + p.V.srcs.length + ' takes before the ID ended (want 1, 0)');
    p.sp.endAll(); await ticks(); p.F.run(0.2);
    if (!p.V.srcs.length || p.sp.speaks !== 1) F.push('after the spoken ID the weather\'s takes did not play (' + p.V.srcs.length + ' sources)');
  }
  // THE DUCKS: an engine start stops the reading (its sources) and ducks the bus the takes pass
  {
    const p = radioClipPage(S, { station: 'roots' });
    p.F.run(0.3); await ticks(); p.F.run(0.2); await ticks();
    const n = p.V.srcs.length;
    p.A.emit('engine', 'start'); p.F.run(0.2);
    if (!n || p.V.srcs.some(x => !x.x.stopped) || p.M.talking) F.push('an engine start did not stop the takes (' + p.V.srcs.filter(x => !x.x.stopped).length + ' of ' + n + ' still playing)');
    const dk = p.M.radioIn && p.M.radioIn.to[0];
    if (!dk || !(dk.gain.value < 0.5)) F.push('the duck the takes pass is not down under the engine start (' + (dk && dk.gain.value) + ')');
  }
  // THE SUSPEND: a hidden tab stops them
  {
    const p = radioClipPage(S, { station: 'roots' });
    p.F.run(0.3); await ticks(); p.F.run(0.2); await ticks();
    p.doc.hidden = true; p.docEvent('visibilitychange'); p.runTimers(); p.F.run(0.2);
    if (!p.V.srcs.length || p.V.srcs.some(x => !x.x.stopped) || p.M.talking) F.push('a hidden tab left the takes playing');
  }
  // NOTHING BEFORE THE GESTURE
  {
    const p = radioClipPage(S, { station: 'roots', noGesture: true });
    p.F.run(3); await ticks();
    if (p.V.fetches || p.V.srcs.length) F.push('before the gesture: ' + p.V.fetches + ' fetches, ' + p.V.srcs.length + ' sources');
  }
  // THE FRAME under a talk of takes: nothing allocated
  {
    const p = radioClipPage(S, { station: 'roots' });
    p.F.run(0.3); await ticks(); p.F.run(0.2); await ticks();
    if (!p.M.talking) F.push('no talk of takes to measure under');
    p.M._ps[8] = 1e9;
    const P = p.A.params, up = p.M.source.update, one = () => up(P, 1 / 60, p.A);
    for (let i = 0; i < 20000; i++) one();
    let gcs = 0;
    const obs = new PerformanceObserver(list => { gcs += list.getEntries().length; });
    obs.observe({ entryTypes: ['gc'] });
    global.gc(); global.gc();
    const g0 = gcs, h0 = process.memoryUsage().heapUsed;
    for (let i = 0; i < 100000; i++) one();
    const dB = process.memoryUsage().heapUsed - h0, gIn = gcs - g0;
    obs.disconnect();
    MUSIC_REPORT.push('the radio\'s update() under a talk of TAKES: heap ' + (dB >= 0 ? '+' : '') + dB + ' B over 100 000 frames, ' + gIn + ' GC');
    if (gIn > 0 || dB > 16384) F.push('the frame under a talk of takes allocates: ' + dB + ' B over 100 000 frames, ' + gIn + ' GC');
  }
  return F;
}

// ==== SND-RADIO-3 (G1700-G1704): THE LIVING RADIO ===================================================================
//   RADIO_LINT     THE WRITING RULES on every take the broadcast plays (the shipped script, media/audio/voice/
//                  radio_script.<h8>.json) and every line the generator wrote (tools/audio/radio_script.json): no digit, no
//                  acronym in capitals, no colon, semicolon, dash, bracket or quote, no instrument word (zulu, niner,
//                  altimeter, knots ...), never two digit words in a row (a spelled number), every sentence 4 to 22 words
//                  (an initial - Matthew C. Wright - ends none), a closing stop; the spoken titles carry no store-listing
//                  words; the rendered text IS the written text.
//   RADIO_HORIZON  two hours of broadcast simulated on the SHIPPED catalogue's Radio Jolene tracks (their lengths, the
//                  shuffle bag's rule, a break every TALK_EVERY tracks, the 4 s crossfades) under four game weathers and
//                  three seeds: no take heard twice; every thread's steps heard in order; no break the same shape as the
//                  one before; the cursor persisted - a second session (a fresh page reading the stored cursor) continues
//                  with the next break, never the first; the repeat-free horizon and the repeat rate over six hours
//                  reported.
//   RADIO_WX       the weather in words on game-shaped worlds (readGame -> conditions -> the chosen takes): clear / fair /
//                  cloudy / grey / low / mist / fog / rain by the game's cover, base, visibility and front; the wind band
//                  by the game's wind; fog and gale advice on those days; the soft strips after a front; eagles only on a
//                  calm day; a lead tagged for another part of the day never chosen; two or three sentences, no digit.
//   VOICE_LICENCE  every voice the broadcast uses has a licence record (MIT engine, the model's licence, the dataset, its
//                  licence and URL, a from-scratch lineage), the dataset public domain / CC0 / CC BY 4.0 - never NC / ND /
//                  SA -, a credit line for CC BY; CREDITS.md's VOICE block names each with its licence and credit; the
//                  host is the user's pick (norman).
//   RADIO_XFADE    on Radio Jolene with the talk on: song to song in the garage FADES (equal-power, XFADE_S, no silence);
//                  a break starts TALK_UP_S before the track's end - the voice starts over the outro (the outgoing track
//                  still sounding), the outgoing track fades out (equal-power) over what is left of it, the next one
//                  comes in under the voice at the bed and rises after it; the talk off keeps the garage's silences.
//   (VOICE_CAT is rewritten below: every track of every station back-announced, Radio Jolene's several times.)
const SHIP = S => { try { return JSON.parse(S.shipscript); } catch (e) { return null; } };
const GEN = S => { try { return JSON.parse(S.radioscript); } catch (e) { return null; } };
const RAD_BANNED = /\b(zulu|niner|altimeter|knots?|statute|metar|awos|okta|hectopascals?)\b/i;
const RAD_DIGITW = '(?:zero|one|two|three|four|five|six|seven|eight|nine|niner)';
function radioLint(text) {
  const F = [];
  if (/\d/.test(text)) F.push('a digit');
  if (/[:;()\[\]{}"“”‘—–\-\/\\*_#@&%]/.test(text)) F.push('a colon, semicolon, dash, bracket, quote or symbol');
  if (/\b[A-Z]{2,}\b/.test(text)) F.push('an acronym in capitals');
  if (RAD_BANNED.test(text)) F.push('an instrument word');
  if (new RegExp('\\b' + RAD_DIGITW + '[ ,]+' + RAD_DIGITW + '\\b', 'i').test(text)) F.push('two digit words in a row');
  const body = text.replace(/\b([A-Z])\.\s+(?=[A-Z])/g, '$1 ');
  for (const s of body.split(/(?<=[.!?])\s+/)) { const w = s.trim().split(/\s+/).filter(Boolean).length; if (w < 4 || w > 22) F.push('a sentence of ' + w + ' words'); }
  if (!/[.!?]$/.test(String(text).trim())) F.push('no closing stop');
  return F;
}
function checkRadioLint(S) {
  const F = [], A = SHIP(S), B = GEN(S);
  if (!A) return ['the shipped broadcast script does not parse (' + FILES.shipscript + ')'];
  if (!B) return ['tools/audio/radio_script.json does not parse'];
  let n = 0;
  for (const [label, sc] of [['shipped', A], ['written', B]]) for (const k in sc.items) {
    n++;
    for (const p of radioLint(sc.items[k].text)) F.push(label + ' ' + k + ': ' + p + ' - "' + sc.items[k].text.slice(0, 70) + '"');
  }
  for (const k in A.items) if (!B.items[k] || B.items[k].text !== A.items[k].text) F.push('the shipped take ' + k + ' is not the written line (re-render: prep_voice.js)');
  for (const k in B.items) if (!A.items[k]) F.push('the written line ' + k + ' has no shipped take');
  const VS = JSON.parse(S.voicescript);
  for (const id in VS.titles || {}) if (/royalty free|["“”]|\s-\s/i.test(VS.titles[id]) || radioLint(VS.titles[id] + ' is the title.').some(p => !/sentence/.test(p))) F.push('the spoken title of ' + id + ' reads "' + VS.titles[id] + '"');
  if (n < 400) F.push('only ' + n + ' takes linted');
  return F.slice(0, 12);
}

// a broadcast simulated on the shipped catalogue's Radio Jolene tracks (o.cat: another list) - [{ t, segs, shape }]
const RWX = {   // four game days (radioWorld's shape), the weather the horizon is measured under
  fair: { t: 12, td: 6, baseM: 1100, cover: 0.25, qnh: 101325, utc: 0, local: 15 * 3600, rh: 0.6, kt: 7, dir: 250, gust: 0.1, visM: 40000 },
  night: { t: 6, td: 2, baseM: 1500, cover: 0, qnh: 101325, utc: 0, local: 23 * 3600, rh: 0.6, kt: 1, dir: 0, gust: 0, visM: 40000 },
  fog: { t: 8, td: 7.5, baseM: 80, cover: 1, qnh: 101325, utc: 0, local: 8 * 3600, rh: 0.98, kt: 6, dir: 120, gust: 0, visM: 600 },
  gale: { t: 9, td: 7, baseM: 400, cover: 1, qnh: 99000, utc: 0, local: 13 * 3600, rh: 0.95, kt: 40, dir: 160, gust: 0.3, visM: 6000, storm: { phase: 'passage', inS: 0, I: 1, windK: 2 } },
};
function radioSim(RT, script, cat, wx, hours, seed, cursor) {
  RT.setScript(script);
  let a = seed || 7; const r = () => (a = (a * 16807) % 2147483647) / 2147483647;
  const c = cursor || { v: '', k: 0, n: 0, h: {} }, out = [];
  let t = 0, bag = [], last = null, since = 0;
  const next = () => {
    if (!bag.length) { bag = cat.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } if (bag.length > 1 && bag[0] === last) { const j = 1 + Math.floor(r() * (bag.length - 1)); [bag[0], bag[j]] = [bag[j], bag[0]]; } }
    return (last = bag.shift());
  };
  if (!cursor) out.push({ t: 0, segs: RT.breakScript(c, wx, [], { tuneIn: true }), tune: 1 });
  let tr = next();
  while (t < hours * 3600) {
    t += tr.durationS - 4; since++;
    const prev = tr; tr = next();
    if (since >= 2) { since = 0; const k = c.k; out.push({ t, k, segs: RT.breakScript(c, wx, [{ id: prev.id, title: prev.title, artist: prev.artist }]) }); }
  }
  return { out, c };
}
const keysOf = b => { const o = []; for (const s of b.segs) for (const k of s.items || []) o.push(k); return o; };
function checkRadioHorizon(S, report) {
  const F = [], A = SHIP(S);
  if (!A) return ['no shipped broadcast script'];
  const roots = JSON.parse(S.catalogue).filter(t => t.station === 'roots');
  if (roots.length < 2) return ['the catalogue has ' + roots.length + ' Radio Jolene tracks'];
  const RT = loadRadio(S.radio);
  let horizon = Infinity, rate6 = 0, runs = 0;
  for (const wname in RWX) for (const seed of [7, 11, 23]) {
    const wx = RT.readGame(radioWorld(RWX[wname]));
    const { out } = radioSim(RT, A, roots, wx, 6, seed);
    const seen = new Map(); let first = null, tot = 0, rep = 0;
    for (const b of out) for (const k of keysOf(b)) { tot++; if (seen.has(k)) { rep++; if (!first) first = { t: b.t, k, was: seen.get(k) }; } seen.set(k, b.t); }
    runs++; rate6 += rep / Math.max(1, tot);
    const fh = first ? first.t : Infinity;
    if (fh < horizon) horizon = fh;
    if (fh < 2 * 3600) F.push(wname + ' (seed ' + seed + '): ' + first.k + ' heard again at ' + (first.t / 3600).toFixed(2) + ' h (first at ' + (first.was / 3600).toFixed(2) + ' h)');
    // THE THREADS: each thread's steps first heard in their order, every step heard within the first lap
    const at = {};
    for (const b of out) for (const s of b.segs) if (s.th && at[s.key] == null) at[s.key] = b.t;
    for (const th in A.threads) {
      const ts = A.threads[th].map(id => at[id]);
      if (ts.some(x => x == null)) { F.push('the thread ' + th + ' was not told whole in six hours (' + wname + ')'); continue; }
      for (let i = 1; i < ts.length; i++) if (!(ts[i] > ts[i - 1])) { F.push('the thread ' + th + ': step ' + (i + 1) + ' before step ' + i + ' (' + wname + ', seed ' + seed + ')'); break; }
    }
  }
  // no break the same shape as the one before (the program's order: the weather, the ID, the kinds of segment)
  const shape = b => b.map(t => (t[0] === '@' ? t : (A.segments[t] || {}).cat)).join(' ');
  for (let i = 1; i < A.program.length; i++) if (shape(A.program[i]) === shape(A.program[i - 1])) F.push('breaks ' + i + ' and ' + (i + 1) + ' have the same shape: ' + shape(A.program[i]));
  // every program token is a slot or a segment of the script
  for (const b of A.program) for (const t of b) if (t[0] !== '@' && !A.segments[t]) F.push('the program names ' + t + ', no segment');
  // THE CURSOR PERSISTED: a page's breaks write it; a fresh page reading the same storage continues with the next break
  {
    const store = {}, env = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } };
    const R1 = loadRadio(S.radio); R1.setScript(A);
    const wx = R1.readGame(radioWorld(RWX.fair));
    const c1 = R1.cursor(env);
    let lastK = -1;
    const tr = i => { const t = roots[i % roots.length]; return [{ id: t.id, title: t.title, artist: t.artist }]; };
    for (let i = 0; i < 5; i++) { lastK = c1.k; R1.breakScript(c1, wx, tr(i)); R1.saveCursor(c1, env); }
    const R2 = loadRadio(S.radio); R2.setScript(A);
    const c2 = R2.cursor(env);
    if (c2.k !== (lastK + 1) % A.program.length) F.push('a new session starts at break ' + (c2.k + 1) + ' (want ' + ((lastK + 1) % A.program.length + 1) + ': the broadcast continues)');
    const segs = R2.breakScript(c2, wx, tr(5));
    const heard = new Set(Object.keys(c1.h));
    const again = keysOf({ segs }).filter(k => /^(id|wx|ba)\./.test(k) && heard.has(k));
    if (again.length) F.push('the second session repeats the first one\'s takes: ' + again.join(', '));
    const bad = { localStorage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } };
    const R3 = loadRadio(S.radio); R3.setScript(A);
    try { const c3 = R3.cursor(bad); R3.breakScript(c3, wx, []); R3.saveCursor(c3, bad); if (c3.k !== 1) F.push('a throwing storage: the cursor at ' + c3.k); } catch (e) { F.push('a throwing storage throws: ' + e.message); }
  }
  if (report) report.push('RADIO_HORIZON: repeat-free for ' + (horizon === Infinity ? 'more than 6' : (horizon / 3600).toFixed(2)) + ' h (the worst of ' + runs + ' runs: four weathers x three seeds, ' + roots.length + ' Radio Jolene tracks, a break every 2), repeat rate over six hours ' + (rate6 / runs * 100).toFixed(0) + ' %');
  return F;
}

// the weather in words: the chosen takes' pools, for a game day
function checkRadioWx(S) {
  const F = [], A = SHIP(S);
  if (!A) return ['no shipped broadcast script'];
  const RT = loadRadio(S.radio); RT.setScript(A);
  const P = A.pools.wx, poolOf = {};
  for (const sky in P.lead) for (const k of P.lead[sky]) poolOf[k] = 'lead.' + sky;
  for (const b in P.wind) for (const k of P.wind[b]) poolOf[k] = 'wind.' + b;
  for (const k of P.gusty) poolOf[k] = 'gusty';
  for (const h in P.advice) for (const k of P.advice[h]) poolOf[k] = 'advice.' + h;
  for (const o in P.outlook) for (const k of P.outlook[o]) poolOf[k] = 'outlook.' + o;
  for (const f in P.feel) for (const k of P.feel[f]) poolOf[k] = 'feel.' + f;
  const base = { t: 10, td: 4, baseM: 1200, cover: 0.2, qnh: 101325, utc: 0, local: 14 * 3600, rh: 0.6, kt: 8, dir: 250, gust: 0.1, visM: 40000 };
  // [why, the day, the sky, the wind band, pools that must be heard in 8 weather segments, pools never heard]
  const cases = [
    ['a clear calm afternoon', { cover: 0, kt: 2 }, 'clear', 'calm', ['advice.eagles'], ['advice.fogPilot', 'advice.windBoat']],
    ['a fair breeze', { cover: 0.3, kt: 14 }, 'fair', 'breezy', [], ['advice.eagles']],
    ['broken cloud', { cover: 0.7, baseM: 900 }, 'cloudy', 'light', [], []],
    ['overcast', { cover: 1, baseM: 900 }, 'grey', 'light', [], []],
    ['a low deck', { cover: 1, baseM: 150 }, 'low', 'light', [], ['advice.eagles']],
    ['haze', { visM: 3000 }, 'mist', 'light', [], ['advice.fogPilot']],
    ['fog', { visM: 500, cover: 1, baseM: 60, kt: 3 }, 'fog', 'calm', ['advice.fogPilot', 'advice.fogBoat'], ['advice.eagles']],
    ['a gale in the front', { kt: 40, gust: 0.3, cover: 1, baseM: 400, visM: 6000, storm: { phase: 'passage', inS: 0, windK: 2 } }, 'rain', 'gale', ['advice.windBoat', 'advice.windPilot', 'advice.softStrip', 'gusty|outlook.easing'], ['advice.eagles']],
    ['a front on the way', { kt: 12, storm: { phase: 'pre', inS: 3 * 3600, windK: 1 } }, 'fair', 'breezy', ['outlook.front'], []],
    ['a frosty morning', { t: -2, td: -5, local: 8 * 3600, kt: 2, cover: 0 }, 'clear', 'calm', ['advice.frost', 'feel.cold'], []],
    ['a mild night', { t: 18, td: 10, local: 23 * 3600, kt: 6, cover: 0.3 }, 'fair', 'light', ['feel.mild'], ['advice.eagles']],
  ];
  for (const [why, o, sky, band, must, never] of cases) {
    const day = Object.assign({}, base, o), wx = RT.readGame(radioWorld(day)), c = { v: '', k: 0, n: 0, h: {} };
    const k = RT.conditions(wx);
    if (k.sky !== sky || k.wind !== band) { F.push(why + ': conditions read ' + k.sky + ' / ' + k.wind + ' (want ' + sky + ' / ' + band + ')'); continue; }
    const heard = new Set(), tag = k.tag;
    for (let i = 0; i < 8; i++) {
      const segs = RT.breakScript(c, wx, [], { tuneIn: true }), w = segs.find(x => x.kind === 'wx');
      if (!w) { F.push(why + ': no weather segment'); break; }
      if (w.items.length < 2 || w.items.length > 3) F.push(why + ': a weather segment of ' + w.items.length + ' sentences');
      if (/\d/.test(w.text) || RAD_BANNED.test(w.text)) F.push(why + ': numbers in the weather: ' + w.text);
      const lead = poolOf[w.items[0]];
      if (lead !== 'lead.' + sky) F.push(why + ': the weather opens with ' + w.items[0] + ' (' + lead + ', want lead.' + sky + ')');
      const part = A.items[w.items[0]] && A.items[w.items[0]].part;
      if (part && part !== tag) F.push(why + ': a lead for the ' + part + ' chosen in the ' + k.part);
      for (const x of w.items) { heard.add(poolOf[x]); const p = poolOf[x] || ''; if (/^wind\./.test(p) && p !== 'wind.' + band) F.push(why + ': the wind said ' + p + ' (want wind.' + band + ')'); if (/^lead\./.test(p) && x !== w.items[0]) F.push(why + ': two leads'); }
    }
    for (const m of must) if (!m.split('|').some(x => heard.has(x))) F.push(why + ': in eight weather segments never ' + m);
    for (const m of never) if (heard.has(m)) F.push(why + ': ' + m + ' on such a day');
  }
  return F;
}

// THE VOICES' LICENCES
const USER_VOICE = { name: 'norman', id: 'en_US-norman-medium' };   // the user, 2026-10-04: "norman voice is the best"
function checkVoiceLicence(S) {
  const F = [];
  let cat; try { cat = JSON.parse(S.voicecat); } catch (e) { return ['voice_catalogue.json does not parse: ' + e.message]; }
  const V = cat.voices || {}, A = SHIP(S), B = GEN(S);
  if (!A || !B) return ['no broadcast script'];
  if (!cat.voice || cat.voice.name !== USER_VOICE.name || cat.voice.id !== USER_VOICE.id) F.push('the host is ' + (cat.voice && cat.voice.id) + ', not the user\'s pick ' + USER_VOICE.id);
  const used = new Set(); for (const k in A.items) { const vv = B.voices[A.items[k].v]; if (!vv) F.push(k + ': the voice ' + A.items[k].v + ' is not declared'); else used.add(vv.model); }
  for (const m of used) {
    const v = V[m];
    if (!v) { F.push('the broadcast uses ' + m + ', and the catalogue has no licence record for it'); continue; }
    for (const k of ['id', 'engine', 'modelLicence', 'dataset', 'datasetLicence', 'datasetUrl', 'lineage']) if (!(typeof v[k] === 'string' && v[k].trim())) F.push(m + ': the record has no ' + k);
    const dl = String(v.datasetLicence || '');
    if (/\bNC\b|\bND\b|\bSA\b|non-?commercial|share-?alike|no-?deriv/i.test(dl) || !/^(public domain|CC0|CC BY 4\.0)$/i.test(dl)) F.push(m + ': the dataset licence "' + dl + '" is not public domain / CC0 / CC BY 4.0');
    if (/^CC BY/i.test(dl) && !(v.credit && v.credit.length > 10)) F.push(m + ': a CC BY dataset and no credit line');
    if (!/\bMIT\b/.test(String(v.engine)) || /GPL/.test(String(v.engine).replace(/espeak/ig, ''))) F.push(m + ': the engine is not the MIT Piper');
    if (!/^MIT/.test(String(v.modelLicence))) F.push(m + ': the model licence is ' + v.modelLicence);
    if (!/scratch/i.test(String(v.lineage))) F.push(m + ': the lineage does not reach a voice trained from scratch: ' + v.lineage);
  }
  const b = S.credits.indexOf('<!-- VOICE:BEGIN'), e = S.credits.indexOf('<!-- VOICE:END -->');
  const block = b >= 0 && e > b ? S.credits.slice(b, e) : '';
  for (const m of used) { const v = V[m]; if (v && (!block.includes('**' + v.id + '**') || !block.includes(v.datasetLicence) || (v.credit && !block.includes(v.credit)))) F.push('CREDITS.md\'s VOICE block does not credit ' + v.id + ' with its dataset licence' + (v.credit ? ' and credit' : '')); }
  return F;
}

// SONG TO SONG AND THE TALK-UP (a radio page: the deck levels read back off the scheduled curves)
const TALK_UP_WANT = 6;   // the talk-up (G1703): the break starts 6 s before a track's end
function checkRadioXfade(S) {
  const F = [];
  const lvl = (p, k) => p.M._lvlAt(k, p.A.ctx.currentTime);
  // SONG TO SONG in the garage on Radio Jolene: a fade, no silence (talk on, no break owed: talk every 6)
  {
    const p = radioPage(S, { station: 'roots', every: 6 });
    let maxGap = 0, gap = 0, xf = null;
    p.F.run(2); p.sp.endAll(); p.F.run(2);
    p.F.each = () => {
      const s0 = p.M._dk[0], s1 = p.M._dk[10], playing = (s0 === 2 || s0 === 3) + (s1 === 2 || s1 === 3);
      gap = playing ? 0 : gap + 0.1; if (gap > maxGap) maxGap = gap;
      if (!xf && s0 === 3 && s1 === 2) xf = { t: p.F.t, k: 1 }; else if (!xf && s1 === 3 && s0 === 2) xf = { t: p.F.t, k: 0 };
      if (xf && !xf.mid && p.F.t >= xf.t + 2) { const kin = xf.k, kout = 1 - kin, ti = trimOfIdx(p, p.M._dk[kin * 10 + 1]), to = trimOfIdx(p, p.M._dk[kout * 10 + 1]);
        xf.mid = { a: lvl(p, kout) / to, b: lvl(p, kin) / ti }; }
    };
    p.F.run(240, 0.1);
    if (maxGap > 0.25) F.push('on Radio Jolene the garage went silent ' + maxGap.toFixed(1) + ' s between songs (want a fade)');
    if (!xf || !xf.mid) F.push('no crossfade song to song on Radio Jolene in the garage');
    else if (!near(xf.mid.a * xf.mid.a + xf.mid.b * xf.mid.b, 1, 0.06) || !(xf.mid.a > 0.3 && xf.mid.b > 0.3)) F.push('the song-to-song fade is not equal-power: ' + xf.mid.a.toFixed(2) + ' / ' + xf.mid.b.toFixed(2) + ' halfway');
  }
  // THE TALK-UP: talk every 1 - the break starts TALK_UP_S before the end, over the outro
  {
    const p = radioPage(S, { station: 'roots', every: 1 });
    p.F.run(1); p.sp.endAll(); p.F.run(2);   // (past the tune-in)
    const talks0 = p.M._C.talks;
    let at = null;
    p.F.each = () => {
      if (at || p.M._C.talks === talks0) return;
      const a = p.M._ps[5], kin = a, kout = 1 - a;
      at = { t: p.F.t, out: p.M._dk[kout * 10 + 0], outLvl: lvl(p, kout) / trimOfIdx(p, p.M._dk[kout * 10 + 1]), outStop: p.M._dk[kout * 10 + 4],
        inLvl: lvl(p, kin), kin, kout, inTrim: trimOfIdx(p, p.M._dk[kin * 10 + 1]), ctx0: p.A.ctx.currentTime };
      at.fd = p.M._dk[kout * 10 + 6];
      // (the fades' curves read now, while the decks still hold them)
      at.half = p.M._lvlAt(kout, at.ctx0 + at.fd / 2) / trimOfIdx(p, p.M._dk[kout * 10 + 1]);
      at.bed2 = p.M._lvlAt(kin, at.ctx0 + 2) / at.inTrim;
    };
    p.F.run(200, 0.05);
    if (!at) return F.concat(['no break reached in the talk-up test']);
    if (at.out !== 3) F.push('at the break the old track is not fading (state ' + at.out + ')');
    if (!(at.outLvl > 0.5)) F.push('the voice started after the outro (the old track at ' + (at.outLvl * 100).toFixed(0) + ' % - want the talk over it)');
    if (!(at.fd > TALK_UP_WANT - 0.6 && at.fd <= TALK_UP_WANT + 0.05)) F.push('the old track fades over ' + at.fd.toFixed(2) + ' s (want what is left of it: the talk-up, ' + TALK_UP_WANT + ' s)');
    if (!near(at.half, Math.cos(Math.PI / 4), 0.08)) F.push('the outro fade is not equal-power (' + (at.half * 100).toFixed(0) + ' % halfway, want 71)');
    if (!near(at.bed2, 0.16, 0.02)) F.push('under the voice the next track is at ' + (at.bed2 * 100).toFixed(0) + ' % (want the 16 % bed)');
  }
  // THE TALK OFF: the garage keeps its silences on Radio Jolene too
  {
    const p = radioPage(S, { station: 'roots', talk: false });
    let maxGap = 0, gap = 0;
    p.F.each = () => { const s0 = p.M._dk[0], s1 = p.M._dk[10], playing = (s0 === 2 || s0 === 3) + (s1 === 2 || s1 === 3); gap = playing ? 0 : gap + 0.25; if (gap > maxGap) maxGap = gap; };
    p.F.run(400, 0.25);
    if (maxGap < 20) F.push('with the talk off the garage had no silence on Radio Jolene (longest ' + maxGap.toFixed(0) + ' s)');
  }
  return F;
}

// VOICE_CAT (G1701): the catalogue points at the shipped broadcast; every take a content-hashed media/audio/voice file that
// EXISTS, with its text and a dur > 0; no orphan in media/audio/voice; EVERY TRACK OF EVERY STATION BACK-ANNOUNCED - Radio
// Jolene's at least three times, in whole takes that say the track's spoken title (voice_script.json 'titles') and its
// artist; the catalogue's totals true; the voice under 12 MB (reported) - and never over 14.
const who3 = (B, v) => (B.voices[v] && B.voices[v].name) || v;
function checkVoiceCat(S, report) {
  const F = [];
  let cat; try { cat = JSON.parse(S.voicecat); } catch (e) { return ['voice_catalogue.json does not parse: ' + e.message]; }
  const A = SHIP(S);
  if (!cat.script || !/^media\/audio\/voice\/radio_script\.[0-9a-f]{8}\.json$/.test(cat.script.file || '')) return ['the catalogue names no content-hashed broadcast script: ' + JSON.stringify(cat.script)];
  if (!A) return ['the broadcast script ' + cat.script.file + ' does not parse'];
  if (cat.clips) F.push('the inlined catalogue still carries clips (the takes are the lazily fetched script\'s)');
  const dir = path.join(ROOT, 'media', 'audio', 'voice');
  const onDisk = new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []), named = new Set([cat.script.file.split('/').pop()]);
  let bytes = fs.existsSync(path.join(ROOT, cat.script.file)) ? fs.statSync(path.join(ROOT, cat.script.file)).size : 0, secs = 0;
  for (const k in A.items) {
    const c = A.items[k];
    if (!/^media\/audio\/voice\/[a-z0-9_]+\.[0-9a-f]{8}\.mp3$/.test(c.file || '')) { F.push(k + ': the file ' + c.file + ' is not media/audio/voice/<stem>.<h8>.mp3'); continue; }
    const f = c.file.split('/').pop();
    if (!named.has(f)) { named.add(f); if (onDisk.has(f)) bytes += fs.statSync(path.join(dir, f)).size; }
    if (!onDisk.has(f)) F.push(k + ': ' + c.file + ' does not resolve');
    if (!(c.dur > 0.5 && c.dur < 40)) F.push(k + ': dur ' + c.dur);
    if (!(typeof c.text === 'string' && c.text.trim())) F.push(k + ': no text');
    secs += c.dur || 0;
  }
  for (const f of onDisk) if (!named.has(f)) F.push('an orphan in media/audio/voice: ' + f);
  if (cat.script.items !== Object.keys(A.items).length || Math.abs(cat.script.bytes - bytes) > 1 || Math.abs(cat.script.seconds - secs) > 0.5) F.push('the catalogue\'s totals (' + cat.script.items + ' takes, ' + cat.script.bytes + ' B, ' + cat.script.seconds + ' s) are not the script\'s (' + Object.keys(A.items).length + ', ' + bytes + ', ' + secs.toFixed(1) + ')');
  // every track of every station back-announced
  const VS = JSON.parse(S.voicescript), say = t => String(t || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (const t of JSON.parse(S.catalogue)) {
    const keys = (A.pools.ba || {})[t.id] || [], need = (t.station || 'lofi') === 'roots' ? 3 : 1;
    if (keys.length < need) { F.push('the track ' + t.id + ' (' + (t.station || 'lofi') + ') has ' + keys.length + ' back-announce(s) (want ' + need + ')'); continue; }
    const ti = VS.titles && VS.titles[t.id], ar = VS.artists && VS.artists[t.artist];
    if (!ti || !ar) { F.push('voice_script.json says no spoken title / artist for ' + t.id); continue; }
    for (const k of keys) { const x = A.items[k]; if (!x || x.track !== t.id || say(x.text).indexOf(say(ti)) < 0 || say(x.text).indexOf(say(ar)) < 0) F.push('the back-announce ' + k + ' does not credit "' + ti + '" by ' + ar); }
    if (new Set(keys.map(k => A.items[k] && A.items[k].text)).size !== keys.length) F.push(t.id + ': two back-announces say the same');
  }
  // THE PHONE LINE: a caller's take (a LibriTTS resident) is rendered through it, the host's and the studio guests' never
  const B = GEN(S);
  if (B) for (const k in A.items) { const vv = B.voices[A.items[k].v] || {}; if (!!A.items[k].phone !== (vv.model === 'libritts')) F.push(k + ': ' + who3(B, A.items[k].v) + (A.items[k].phone ? ' on the phone line' : ' not on the phone line')); }
  if (report) report.push('VOICE_CAT: ' + Object.keys(A.items).length + ' takes, ' + (secs / 60).toFixed(1) + ' min, ' + (bytes / 1048576).toFixed(2) + ' MB of voice (aim 12 MB)');
  if (bytes > 14 * 1048576) F.push('the voice weighs ' + (bytes / 1048576).toFixed(2) + ' MB (aim 12, never over 14)');
  return F;
}

// ==== SND-SPACE (G1640-G1646) ======================================================================================
//   SP_CABIN    cabinTransfer on the six builds: the class by construction (the Cub fabric, the Jodel wood, the three
//               Cessnas metal, the open twin-582), the insulation in its band (open 0-3, fabric 6-12, metal 15-25), the
//               ORDER open < fabric < metal in insulation AND in high-frequency loss, the realised chain's octave mean
//               = -insulation (0.1 dB), the metal's boom 80-150 Hz standing over its 500 Hz, exits open -> the open
//               cockpit; the headset: passive 13-20 dB mean with more cut high than low, ANR cuts the low end more.
//   SP_DOPPLER  dopplerFactor = c / (c - v_r) at a fixed listener (and the moving listener's (c - v_l) / c); a pass at
//               60 m/s solved through the ring (retardedSolve) against the closed-form retarded geometry: the factor
//               within 1 % all along, the delay = the distance at emission / c; RENDERED: the engine and the prop
//               worklets at pitch 1.212 / 0.85 move their firing / BPF peak by that factor within 1 %.
//   SP_ABSORB   airAbsorptionHz falls monotonically with distance (20 kHz near, < 1.5 kHz at 1 km, < 700 Hz at 5 km),
//               the realised low-pass's 4 kHz loss grows with distance; the page's absorption follows the distance.
//   SP_XFADE    CORE's viewpoint cross-fade: 150 ms, ext^2 + int^2 = 1 at every point, endpoints exact, a reversal
//               mid-fade starts from where the fade stood (still equal power, shorter).
//   SP_IR       the shed's IR for two shells (the club 30 x 25 x 7, the field 14 x 18 x 3.6): RT60 measured
//               (Schroeder T20, 500 Hz and 1 kHz) within 20 % of Sabine; L/R decorrelated; unit energy; the page makes
//               it in an idle callback (never in update()), regenerates when the shell changes, the wet sends open only
//               in the shed.
//   SP_GRAPH    the page (the real audio.js + the three sources + space.js on stub Web Audio, the real builds): every
//               source enters its group (engine -> 'engine', the prop's output 1 -> a splitter -> 'propT' / 'propB',
//               the airframe's 3 outputs: 0 the group, 1 and 2 the interior); NO placeholder low-pass left; the cabin's
//               filters are cabinTransfer's; the headset's are its curve; the ambience ducked inside; the directivity
//               (tonal nil on the nose axis, ~1 at 104 deg; exhaust aft over front); the panner in the camera's frame;
//               the doppler on every voice's pitch; the lag = distance / c and the sources' schedules carry it; a cut
//               snaps it and the sources cancel.
//   SP_BUDGET   AUDIO.update with the three sources + space.js, the camera MOVING past the aeroplane at 60 m/s (so the
//               space schedules every frame): 0 GC in 10 000 frames, < 0.3 ms; a steady frame schedules nothing.
//   SP_CRAFT    addCraft through a node baker (the real worklets under render.js's shim): 5 rpm points, seamless loops;
//               the tiers (2 full <= 500 m, the engine only <= 5 km up to 8 baked, beyond silent); the blend weights at
//               equal power; playbackRate = rpm / point x the doppler.
const SPC_FILES = ['spcfg', 'space'];
function loadSpaceCfg(text) { const c = { module: { exports: {} } }; vm.runInNewContext(text, c, { filename: 'space_config.js' }); return c.module.exports; }
const SPC_CACHE = {};
const spcOf = S => SPC_CACHE.t === S.spcfg ? SPC_CACHE.M : (SPC_CACHE.t = S.spcfg, SPC_CACHE.M = loadSpaceCfg(S.spcfg));
const SPC_BUILDS = () => FLOWN.map(b => ({ name: b.name, spec: b.spec, def: b.def }));

function checkSpCabin(S) {
  const F = [], SC = spcOf(S);
  const want = ['fabric', 'wood', 'metal', 'metal', 'metal', 'open'];
  const T = SPC_BUILDS().map(b => SC.cabinTransfer(b.def.spec));
  T.forEach((t, i) => { if (t.cls !== want[i]) F.push(FLOWN[i].name + ': the cabin class ' + t.cls + ' (want ' + want[i] + ', ' + t.source + ')'); });
  const band = { open: [0, 3], fabric: [6, 12], wood: [6, 12], metal: [15, 25] };
  T.forEach((t, i) => { const b = band[t.cls]; if (b && !(t.insulationDb >= b[0] && t.insulationDb <= b[1])) F.push(FLOWN[i].name + ': insulation ' + t.insulationDb + ' dB outside ' + b.join('-')); });
  const op = T[5], fa = T[0], me = T[2];
  if (!(op.insulationDb < fa.insulationDb && fa.insulationDb < me.insulationDb)) F.push('the insulation does not order open < fabric < metal: ' + [op.insulationDb, fa.insulationDb, me.insulationDb].join(' / '));
  if (!(op.hfLossDb > fa.hfLossDb && fa.hfLossDb > me.hfLossDb)) F.push('the high-frequency loss does not order open < fabric < metal: ' + [op.hfLossDb, fa.hfLossDb, me.hfLossDb].map(x => x.toFixed(1)).join(' / '));
  if (!(me.hfLossDb < -10)) F.push('the metal cabin\'s high-frequency loss is weak (' + me.hfLossDb.toFixed(1) + ' dB, 4 kHz against 500 Hz)');
  if (!(fa.hfLossDb > -7)) F.push('the fabric cabin\'s high-frequency loss is not weak (' + fa.hfLossDb.toFixed(1) + ' dB)');
  for (const t of T) {
    const m = SC.meanDb(t, SC.INSUL_F);
    if (Math.abs(m + t.insulationDb) > 0.1) F.push(t.cls + ': the realised chain\'s octave mean ' + m.toFixed(2) + ' dB, not -' + t.insulationDb);
  }
  if (!(me.boomHz >= 80 && me.boomHz <= 150)) F.push('the metal cabin\'s boom at ' + me.boomHz + ' Hz (want 80-150)');
  else if (!(SC.chainDb(me, me.boomHz) - SC.chainDb(me, 500) > 3)) F.push('the metal cabin does not boom: ' + SC.chainDb(me, me.boomHz).toFixed(1) + ' dB at its mode vs ' + SC.chainDb(me, 500).toFixed(1) + ' at 500 Hz');
  if (fa.boomHz !== 0) F.push('the fabric cabin booms (' + fa.boomHz + ' Hz)');
  const ex = SC.cabinTransfer(FLOWN[2].def.spec, { exits: 1 });
  if (Math.abs(ex.insulationDb - op.insulationDb) > 1e-9 || ex.ambienceDb !== SC.CABIN_CLASSES.open.ambDb) F.push('the Cessna with its exits open is not the open cockpit (' + ex.insulationDb + ' dB)');
  if (!(me.ambienceK < fa.ambienceK && fa.ambienceK < op.ambienceK)) F.push('the ambience duck does not order with the insulation');
  // the headset
  const hp = SC.headsetMeanDb('passive'), ha = SC.headsetMeanDb('anr'), h0 = SC.headsetMeanDb(0);
  const lo = k => SC.chainDb(SC.headsetCurve(k), 80), hi = k => SC.chainDb(SC.headsetCurve(k), 4000);
  if (Math.abs(h0) > 1e-9) F.push('the headset off is not flat (' + h0 + ' dB)');
  if (!(hp <= -13 && hp >= -20)) F.push('the passive headset\'s mean ' + hp.toFixed(1) + ' dB (want 13-20 dB of cut)');
  if (!(hi('passive') < lo('passive') - 6)) F.push('the passive headset does not cut the high end more (' + lo('passive').toFixed(1) + ' / ' + hi('passive').toFixed(1) + ' dB at 80 Hz / 4 kHz)');
  if (!(lo('anr') < lo('passive') - 4)) F.push('the ANR headset does not take the low end (' + lo('anr').toFixed(1) + ' vs passive ' + lo('passive').toFixed(1) + ' dB at 80 Hz)');
  if (!(ha <= hp)) F.push('the ANR headset cuts less than the passive one (' + ha.toFixed(1) + ' vs ' + hp.toFixed(1) + ')');
  return F;
}

// the closed form of a straight pass: x(t) = (v t, 0, 0) past a listener at (0, 0, D); the emission time te solves
// t - te = |x(te) - L| / c (bisection), the radial speed then: v x . n
function passTruth(t, v, D, c) {
  let lo = t - 100, hi = t;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2, x = v * m, r = Math.hypot(x, D); if (t - m > r / c) lo = m; else hi = m; }
  const te = (lo + hi) / 2, x = v * te, r = Math.hypot(x, D), vr = v * (-x) / r;   // toward the listener: + approaching
  return { te, tau: t - te, k: c / (c - vr), r };
}
function checkSpDoppler(S) {
  const F = [], SC = spcOf(S), c = 343;
  for (const v of [-80, -30, 0, 25, 60, 120]) {
    const k = SC.dopplerFactor(c, v, 0), w = c / (c - v);
    if (Math.abs(k / w - 1) > 1e-9) F.push('dopplerFactor(' + v + ' m/s toward) = ' + k + ' (want c/(c-v) = ' + w + ')');
  }
  if (Math.abs(SC.dopplerFactor(c, 0, -30) - (c + 30) / c) > 1e-9) F.push('a listener moving toward a still source is not (c + v)/c');
  // the pass: 60 m/s, the listener 40 m off the track, frames at 60 Hz, from -900 m to +900 m
  const R = SC.ringMake(2048), PB = new Float64Array(4), AT = new Float64Array(5), RS = new Float64Array(8);
  const v = 60, D = 40, dt = 1 / 60;
  let worst = 0, worstT = 0, worstTau = 0, n = 0;
  for (let i = 0; i <= 1800; i++) {
    const t = -15 + i * dt;
    PB[0] = t; PB[1] = v * t; PB[2] = 0; PB[3] = 0;
    SC.ringPush(R, PB);
    if (t < -11) continue;   // the ring's velocity has settled, the retarded instant inside the ring
    AT[0] = t; AT[1] = 0; AT[2] = 0; AT[3] = D; AT[4] = c;
    SC.retardedSolve(R, AT, RS);
    const id = 1 / RS[7], nx = -RS[1] * id, ny = -RS[2] * id, nz = (D - RS[3]) * id;
    const k = SC.dopplerFactor(c, RS[4] * nx + RS[5] * ny + RS[6] * nz, 0);
    const tr = passTruth(t, v, D, c);
    const e = Math.abs(k / tr.k - 1);
    if (e > worst) { worst = e; worstT = t; }
    const et = Math.abs(RS[0] - tr.tau); if (et > worstTau) worstTau = et;
    n++;
  }
  if (!(worst < 0.01)) F.push('the pass\'s doppler off the closed form by ' + (worst * 100).toFixed(2) + ' % at t ' + worstT.toFixed(2) + ' s (want < 1 %)');
  if (!(worstTau < 2e-3)) F.push('the pass\'s propagation delay off by ' + (worstTau * 1000).toFixed(2) + ' ms (want < 2 ms)');
  // RENDERED: the voices' own pitch param
  const E = loadEngW(S), Pw = loadPropW(S), b = FLOWN[0];
  const ecfg = ECFG_.engineSoundConfig(b.spec, 0, POWERPLANTS);
  const pk = (k, which) => {
    let y;
    if (which === 'engine') {
      const v = RND.makeVoice(E, ecfg, 3, 0, { running: true, rpm: 2100 });
      v.params.rpm[0] = 2100; v.params.load[0] = 0.8; v.params.running[0] = 1; v.params.pitch[0] = k;
      const nb = Math.ceil(2.5 * 48000 / 128); y = new Float32Array(nb * 128);
      for (let i = 0; i < nb; i++) { v.proc.process(v.inputs, v.outputs, v.params); y.set(v.outputs[0][0], i * 128); }
    } else {
      const pr = new Pw.P({ processorOptions: { config: { blades: 2, D: 1.9, Tstatic: 1500, gear: 1, gain: 0.12 }, seed: 5 } });
      const pp = {}; for (const d of Pw.P.parameterDescriptors) pp[d.name] = new Float32Array([d.defaultValue]);
      pp.rpm[0] = 2100; pp.thrust[0] = 1200; pp.thr[0] = 0.8; pp.c[0] = 340; pp.pitch[0] = k;
      const out = [[new Float32Array(128)], [new Float32Array(128), new Float32Array(128)]];
      const nb = Math.ceil(2.5 * 48000 / 128); y = new Float32Array(nb * 128);
      for (let i = 0; i < nb; i++) { pr.process([[]], out, pp); y.set(out[1][0], i * 128); }   // the tonal part
    }
    const Sp = RND.spectrum(y, y.length - 65536, 65536, 48000, 262144);
    const f0 = which === 'engine' ? 2100 / 60 * 2 : 2100 / 60 * 2;   // a flat-4's firing = the 2-blade BPF = 70 Hz
    return RND.peakIn(Sp, f0 * k * 0.93, f0 * k * 1.07).hz;
  };
  for (const which of ['engine', 'prop']) {
    const base = pk(1, which);
    for (const k of [1.212, 0.85]) {
      const f = pk(k, which), r = f / base;
      if (!(Math.abs(r / k - 1) < 0.01)) F.push('the ' + which + ' worklet at pitch ' + k + ': its peak moved x' + r.toFixed(4) + ' (' + base.toFixed(2) + ' -> ' + f.toFixed(2) + ' Hz; want within 1 %)');
      SP_REPORT.push(which + ' at pitch ' + k + ': ' + base.toFixed(2) + ' -> ' + f.toFixed(2) + ' Hz (x' + r.toFixed(4) + ')');
    }
  }
  SP_REPORT.push('the 60 m/s pass: the ring\'s doppler within ' + (worst * 100).toFixed(3) + ' % of c/(c - v_r(te)), the delay within ' + (worstTau * 1000).toFixed(2) + ' ms');
  return F;
}
const SP_REPORT = [];
const ECFG_ = require(path.join(ROOT, 'src', 'viewer', 'audio', 'engine_config.js'));
function loadW(text, file) {
  const reg = {}, mod = { exports: {} };
  class AWP { constructor() { this.port = { onmessage: null, postMessage() {} }; } }
  vm.runInThisContext('(function (AudioWorkletProcessor, registerProcessor, sampleRate, currentTime, module) {' + text + '\n})', { filename: file })(AWP, (n, c) => { reg[n] = c; }, 48000, 0, mod);
  return reg;
}
const WCACHE = {};
const loadEngW = S => (WCACHE.e === S.engw ? WCACHE.E : (WCACHE.e = S.engw, WCACHE.E = { Processor: loadW(S.engw, 'engine_worklet.js')['flydiy-engine'], sr: 48000 }));
const loadPropW = S => { if (WCACHE.p !== S.propw) { const r = loadW(S.propw, 'prop_worklet.js'); WCACHE.p = S.propw; WCACHE.P = { P: r['flydiy-prop'], T: r['flydiy-turbine'], X: r['flydiy-electric'] }; } return WCACHE.P; };

function checkSpAbsorb(S) {
  const F = [], SC = spcOf(S);
  let prev = Infinity, prevLoss = 0;
  for (const d of [1, 5, 20, 60, 150, 400, 1000, 2500, 5000, 10000]) {
    const f = SC.airAbsorptionHz(d);
    if (!(f <= prev)) F.push('the absorption corner rises with distance: ' + f.toFixed(0) + ' Hz at ' + d + ' m after ' + prev.toFixed(0));
    if (d >= 60 && !(f < prev)) F.push('the absorption corner flat at ' + d + ' m (' + f.toFixed(0) + ' Hz)');
    const loss = -SC.biquadDb('lowpass', f, -3.01, 0, 4000, 48000);
    if (d >= 60 && !(loss > prevLoss)) F.push('the realised 4 kHz loss does not grow with distance at ' + d + ' m (' + loss.toFixed(1) + ' dB)');
    prev = f; prevLoss = loss;
  }
  if (!(SC.airAbsorptionHz(5) >= 15000)) F.push('the air near the aeroplane already filters (' + SC.airAbsorptionHz(5).toFixed(0) + ' Hz at 5 m)');
  if (!(SC.airAbsorptionHz(1000) < 1500 && SC.airAbsorptionHz(5000) < 700)) F.push('the far air is not dull enough (' + SC.airAbsorptionHz(1000).toFixed(0) + ' Hz at 1 km, ' + SC.airAbsorptionHz(5000).toFixed(0) + ' at 5 km)');
  // the page: the absorption follows the camera's distance
  const pg = spacePage(S, { record: true });
  const fr = [];
  for (const d of [20, 400, 3000]) { pg.place(0, 30, d); for (let i = 0; i < 4; i++) pg.frame(); fr.push(pg.A.space.frame[pg.A.space.GAF * pg.A.space.LW + 7]); }
  if (!(fr[0] > fr[1] && fr[1] > fr[2])) F.push('the page\'s absorption does not fall with distance: ' + fr.map(x => x.toFixed(0)).join(' / ') + ' Hz at 20 / 400 / 3000 m');
  return F;
}

function checkSpXfade(S) {
  const F = [], pg = livePage(S), A = pg.A;
  const pe = A.bus('aircraft.ext').gain, pi = A.bus('aircraft.int').gain;
  const go = (mode, t) => { pg.cam.mode = mode; if (t != null) A.ctx.currentTime = t; A.update(pg.sim, pg.camera, 1 / 60, pg.def, pg.cam, false, pg.world); };
  go('chase', 1);
  const curveOf = p => p.ev.filter(e => e.k === 'C').pop();
  go('cockpit', 2);
  const ce = curveOf(pe), ci = curveOf(pi);
  if (!ce || !ci) return ['the viewpoint did not cross-fade with curves (ext ' + !!ce + ', int ' + !!ci + ')'];
  if (Math.abs(ce.d - 0.15) > 1e-9 || Math.abs(ci.d - 0.15) > 1e-9) F.push('the cross-fade lasts ' + ce.d + ' s (want 0.15)');
  let worst = 0;
  for (let i = 0; i < ce.c.length; i++) worst = Math.max(worst, Math.abs(ce.c[i] * ce.c[i] + ci.c[i] * ci.c[i] - 1));
  if (worst > 1e-3) F.push('the cross-fade is not equal power: ext^2 + int^2 off 1 by ' + worst.toFixed(4));
  if (ce.c[0] !== 1 || ci.c[0] !== 0 || ce.c[ce.c.length - 1] !== 0 || ci.c[ci.c.length - 1] !== 1) F.push('the cross-fade\'s endpoints are not exact: ext ' + ce.c[0] + ' -> ' + ce.c[ce.c.length - 1] + ', int ' + ci.c[0] + ' -> ' + ci.c[ci.c.length - 1]);
  // a reversal half way: from the share reached (0.5), back to the exterior over 75 ms, still equal power
  go('chase', 2.075);
  const re = curveOf(pe), ri = curveOf(pi);
  if (!re || re === ce) F.push('a reversal mid-fade scheduled no new curve');
  else {
    if (Math.abs(re.d - 0.075) > 1e-6) F.push('the reversal lasts ' + re.d.toFixed(4) + ' s (want 0.075: from half way)');
    if (Math.abs(ri.c[0] - Math.sin(Math.PI / 4)) > 1e-3) F.push('the reversal does not start from where the fade stood (int ' + ri.c[0].toFixed(3) + ', want 0.707)');
    let w2 = 0; for (let i = 0; i < re.c.length; i++) w2 = Math.max(w2, Math.abs(re.c[i] * re.c[i] + ri.c[i] * ri.c[i] - 1));
    if (w2 > 1e-3) F.push('the reversal is not equal power (' + w2.toFixed(4) + ')');
  }
  return F;
}

function checkSpIr(S) {
  const F = [], SC = spcOf(S);
  for (const [dims, shell] of [[{ HW: 15, HD: 12.5, EAVE: 7 }, 'club'], [{ HW: 7, HD: 9, EAVE: 3.6 }, 'field']]) {
    const room = SC.hangarAcoustics(dims, shell), ir = SC.hangarIR(room, 48000);
    for (const [band, bi] of [[500, 2], [1000, 3]]) {
      const m = SC.measureRT60(ir.L, 48000, band), want = room.rt60[bi];
      SP_REPORT.push(shell + ' ' + (2 * dims.HW) + ' x ' + (2 * dims.HD) + ' x ' + dims.EAVE + ' m: RT60 ' + band + ' Hz measured ' + m.toFixed(2) + ' s, Sabine ' + want.toFixed(2) + ' s');
      if (!(Math.abs(m / want - 1) < 0.2)) F.push(shell + ': the IR\'s RT60 at ' + band + ' Hz is ' + m.toFixed(2) + ' s, Sabine says ' + want.toFixed(2) + ' (want within 20 %)');
    }
    let eL = 0, eR = 0, x = 0;
    for (let i = 0; i < ir.length; i++) { eL += ir.L[i] * ir.L[i]; eR += ir.R[i] * ir.R[i]; x += ir.L[i] * ir.R[i]; }
    if (Math.abs(eL - 1) > 1e-3 || Math.abs(eR - 1) > 1e-3) F.push(shell + ': the IR\'s energy ' + eL.toFixed(3) + ' / ' + eR.toFixed(3) + ' (want 1)');
    if (!(Math.abs(x) < 0.2)) F.push(shell + ': L and R are correlated (' + x.toFixed(3) + ')');
  }
  const big = SC.hangarAcoustics({ HW: 15, HD: 12.5, EAVE: 7 }, 'club'), small = SC.hangarAcoustics({ HW: 7, HD: 9, EAVE: 3.6 }, 'field');
  if (!(big.rt60Mid > small.rt60Mid)) F.push('the big shed rings no longer than the small one (' + big.rt60Mid.toFixed(2) + ' vs ' + small.rt60Mid.toFixed(2) + ' s)');
  // the page: the IR off the frame, regenerated on a new shell, the wet only in the shed
  const pg = spacePage(S, { record: true, shed: { dims: { HW: 15, HD: 12.5, EAVE: 7 }, shell: 'club' } }), sp = pg.A.space;
  pg.frame(true);
  const G = sp.graph();
  if (G.conv.buffer) F.push('the IR was made inside update() (want: an idle callback)');
  if (pg.idle.length !== 1) F.push('entering the shed queued ' + pg.idle.length + ' IR jobs (want 1)');
  pg.runIdle();
  if (!G.conv.buffer || sp.stats.irMade !== 1) F.push('the idle callback made no IR (' + sp.stats.irMade + ')');
  for (let i = 0; i < 3; i++) pg.frame(true);
  if (!(G.revA.gain.value > 0.1 && G.revMus.gain.value > 0)) F.push('the wet sends are shut in the shed (' + G.revA.gain.value + ')');
  pg.shed.shell = 'field'; pg.shed.dims = { HW: 7, HD: 9, EAVE: 3.6 };
  for (let i = 0; i < 70; i++) pg.frame(true);
  pg.runIdle();
  if (sp.stats.irMade !== 2 || !G.room || G.room.shell !== 'field') F.push('a new shell did not regenerate the IR (made ' + sp.stats.irMade + ', room ' + (G.room && G.room.shell) + ')');
  for (let i = 0; i < 3; i++) pg.frame(false);
  if (G.revA.gain.value !== 0 || G.revAmb.gain.value !== 0) F.push('the wet sends stay open out of the shed (' + G.revA.gain.value + ')');
  return F;
}

// THE PAGE: stub Web Audio that records the graph, the real files, the real builds
function spacePage(S, opt) {
  const o = opt || {};
  const engD = loadEngW(S).Processor.parameterDescriptors, prD = loadPropW(S), afD = loadVoice(S.worklet).Processor.parameterDescriptors;
  const DESC = { 'flydiy-engine': engD, 'flydiy-prop': prD.P.parameterDescriptors, 'flydiy-turbine': prD.T.parameterDescriptors,
                 'flydiy-electric': prD.X.parameterDescriptors, 'flydiy-airframe': afD };
  const idle = [];
  const shed = o.shed || { dims: { HW: 15, HD: 12.5, EAVE: 7 }, shell: 'club' };
  const win = { location: { search: '' }, localStorage: { getItem: k => (o.store && k in o.store ? o.store[k] : null), setItem() {} },
    performance: { now: (() => { let k = 0; return () => ++k; })() }, addEventListener() {}, removeEventListener() {},
    document: { hidden: false, hasFocus: () => true, addEventListener() {}, removeEventListener() {} },
    requestIdleCallback: fn => { idle.push(fn); return idle.length; },
    GARAGE_ENV: { dims: () => shed.dims, shell: () => shed.shell } };
  const ctx = { window: win, document: win.document, console: { warn() {}, log() {}, error() {} }, URLSearchParams,
    POWERPLANTS, GEN_SHAFT: FC.GEN_SHAFT, setTimeout: () => 0, clearTimeout() {}, __DESC: DESC, __REC: !!o.record };
  vm.createContext(ctx);
  const run = (t, f) => vm.runInContext(t, ctx, { filename: f });
  run(SPACE_STUB, 'stub_webaudio.js');
  const C = ctx.__C, AC = ctx.AudioContext;
  win.AudioContext = AC;
  run(S.params, 'audio_params.js'); win.AUDIO_PARAMS = ctx.AUDIO_PARAMS;
  run(S.audio, 'audio.js');
  run(ENG_CFG_TEXT, 'engine_config.js'); run(S.engine, 'src_engine.js');
  run(PROP_CFG_TEXT, 'prop_config.js'); run(S.srcprop, 'src_prop.js');
  run(S.model, 'airframe_model.js'); run(S.samples, 'samples.js'); run(S.srcaf, 'src_airframe.js');
  if (!o.noSpace) { run(S.spcfg, 'space_config.js'); run(S.space, 'space.js'); }
  const A = win.AUDIO;
  A.unlock();
  const b = o.build || FLOWN[0];
  const wc = { mains: [true, true], tw: true, water: false };
  const sim = stubSim(b, wc), def = b.def;
  sim.p = Float64Array.from(sim.p);   // its own copy: the tests move it
  // the camera: a THREE-like object (position + matrixWorld columns right / up / back)
  const camera = { position: { x: 0, y: 0, z: 0 }, matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } };
  const cam = { mode: 'chase' };
  // the aeroplane's reference: the nose frame's centre and its axes (from the solver's own nodes)
  const avg = list => { const p = [0, 0, 0]; for (const j of list) for (let k = 0; k < 3; k++) p[k] += sim.p[j * 3 + k] / list.length; return p; };
  const nose = avg(def.refs.noseFrame), tail = avg(def.refs.tailMid);
  const fwd = nose.map((x, k) => x - tail[k]); const fl = Math.hypot(...fwd); for (let k = 0; k < 3; k++) fwd[k] /= fl;
  const org = avg(def.refs.origin || def.refs.noseFrame);
  const TT = new Float64Array(1), WORLD = { surface: () => 0 };   // (the test's own frame allocates nothing either)
  const pg = { A, C, win, sim, def, camera, cam, idle, shed, nose, tail, fwd, org, get t() { return TT[0]; },
    // the camera at (ahead along the nose, up, aside) metres from the airframe's reference, looking at it
    place(ahead, up, aside) {
      const side = [fwd[2], 0, -fwd[0]]; const sl = Math.hypot(...side) || 1;
      for (let k = 0; k < 3; k++) side[k] /= sl;
      const p = [0, 1, 2].map(k => org[k] + fwd[k] * ahead + side[k] * aside + (k === 1 ? up : 0));
      camera.position.x = p[0]; camera.position.y = p[1]; camera.position.z = p[2];
      // look at the reference: back = from the target to the eye
      const bk = p.map((x, k) => x - org[k]); const bl = Math.hypot(...bk) || 1; for (let k = 0; k < 3; k++) bk[k] /= bl;
      const upW = [0, 1, 0], rt = [upW[1] * bk[2] - upW[2] * bk[1], upW[2] * bk[0] - upW[0] * bk[2], upW[0] * bk[1] - upW[1] * bk[0]];
      const rl = Math.hypot(...rt) || 1; for (let k = 0; k < 3; k++) rt[k] /= rl;
      const u = [bk[1] * rt[2] - bk[2] * rt[1], bk[2] * rt[0] - bk[0] * rt[2], bk[0] * rt[1] - bk[1] * rt[0]];
      const e = camera.matrixWorld.elements;
      e[0] = rt[0]; e[1] = rt[1]; e[2] = rt[2]; e[4] = u[0]; e[5] = u[1]; e[6] = u[2]; e[8] = bk[0]; e[9] = bk[1]; e[10] = bk[2];
    },
    frame(garage) { TT[0] += 1 / 60; A.ctx.currentTime = TT[0]; A.update(sim, camera, 1 / 60, def, cam, garage === true, WORLD); },
    runIdle() { const a = idle.splice(0); for (const f of a) f(); },
    aw: name => C.aw.filter(n => n.name === name),
  };
  return pg;
}
// the stub Web Audio of the space's page, as TEXT run inside the page's realm (see spacePage)
const SPACE_STUB = `
var __C = { sched: 0, cancel: 0, nodes: [], aw: [], posted: 0 };
(function () {
  var C = __C, REC = __REC;
  function mkParam(v) {
    var p = { value: v, n: 0, ev: REC ? [] : null };
    if (REC) {
      p.setTargetAtTime = function (x, t, tau) { this.value = x; this.n++; C.sched++; this.ev.push({ k: 'T', v: x, t: t, tau: tau }); };
      p.setValueAtTime = function (x, t) { this.value = x; this.n++; this.ev.push({ k: 'V', v: x, t: t }); };
      p.setValueCurveAtTime = function (c, t, d) { this.value = c[c.length - 1]; C.sched++; this.ev.push({ k: 'C', c: Float32Array.from(c), t: t, d: d }); };
      p.cancelScheduledValues = function (t) { C.cancel++; this.ev.push({ k: 'X', t: t }); };
    } else {
      p.setTargetAtTime = function () { this.n++; C.sched++; };
      p.setValueAtTime = function () { this.n++; };
      p.setValueCurveAtTime = function () { C.sched++; };
      p.cancelScheduledValues = function () { C.cancel++; };
    }
    p.linearRampToValueAtTime = function (x) { this.value = x; C.sched++; };
    return p;
  }
  function node(kind, extra) {
    var n = { kind: kind, edges: [],
      connect: function (d, oo, ii) { this.edges.push({ d: d, o: oo | 0, i: ii | 0 }); return d; },
      disconnect: function (d, oo) { this.edges = d === undefined ? [] : this.edges.filter(function (e) { return !(e.d === d && (oo === undefined || e.o === oo)); }); } };
    for (var k in extra || {}) n[k] = extra[k];
    C.nodes.push(n); return n;
  }
  function syncP(v) { return { then: function (f) { return syncP(f ? f(v) : v); }, catch: function () { return this; } }; }
  function AC() { this.currentTime = 0; this.sampleRate = 48000; this.destination = node('dest'); this.listener = {};
    this.audioWorklet = { addModule: function () { return syncP(true); } }; }
  AC.prototype.createGain = function () { return node('gain', { gain: mkParam(1) }); };
  AC.prototype.createDynamicsCompressor = function () { return node('comp', { threshold: mkParam(0), knee: mkParam(0), ratio: mkParam(0), attack: mkParam(0), release: mkParam(0) }); };
  AC.prototype.createBiquadFilter = function () { return node('biquad', { type: 'lowpass', frequency: mkParam(350), Q: mkParam(1), gain: mkParam(0) }); };
  AC.prototype.createStereoPanner = function () { return node('stereo', { pan: mkParam(0) }); };
  AC.prototype.createPanner = function () { return node('panner', { positionX: mkParam(0), positionY: mkParam(0), positionZ: mkParam(0), panningModel: 'equalpower' }); };
  AC.prototype.createConvolver = function () { return node('convolver', { buffer: null, normalize: true }); };
  AC.prototype.createChannelSplitter = function (n) { return node('splitter', { n: n }); };
  AC.prototype.createChannelMerger = function (n) { return node('merger', { n: n }); };
  AC.prototype.createBuffer = function (ch, len, sr) { var d = []; for (var k = 0; k < ch; k++) d.push(new Float32Array(len));
    return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: function (k) { return d[k]; }, copyToChannel: function (a, k) { d[k].set(a); } }; };
  AC.prototype.createBufferSource = function () { return node('source', { buffer: null, loop: false, playbackRate: mkParam(1), start: function () { this.started = true; }, stop: function () { this.stopped = true; } }); };
  AC.prototype.resume = function () { return Promise.resolve(); };
  AC.prototype.suspend = function () { return Promise.resolve(); };
  AC.prototype.close = function () { return Promise.resolve(); };
  function AWN(c, name, opts) {
    var n = node('aw:' + name);
    for (var k in n) this[k] = n[k];
    C.nodes[C.nodes.length - 1] = this;
    this.name = name; this.opts = opts; this.parameters = new Map();
    var D = __DESC[name] || [];
    for (var i = 0; i < D.length; i++) this.parameters.set(D[i].name, mkParam(D[i].defaultValue));
    var self = this;
    this.port = { postMessage: function (m) { C.posted++; (self.msgs = self.msgs || []).push(m); } };
    C.aw.push(this);
  }
  this.AudioContext = AC; this.AudioWorkletNode = AWN;
})();
`;
const ENG_CFG_TEXT = fs.readFileSync(path.join(ROOT, 'src/viewer/audio/engine_config.js'), 'utf8');
const PROP_CFG_TEXT = fs.readFileSync(path.join(ROOT, 'src/viewer/audio/prop_config.js'), 'utf8');

function checkSpGraph(S) {
  const F = [], pg = spacePage(S, { record: true }), A = pg.A, sp = A.space;
  if (!sp) return ['space.js did not register AUDIO.space'];
  pg.place(60, 2, 0);
  for (let i = 0; i < 6; i++) pg.frame();
  const G = sp.graph(), eng = pg.aw('flydiy-engine'), prop = pg.aw('flydiy-prop'), af = pg.aw('flydiy-airframe');
  if (eng.length !== 1 || prop.length !== 1 || af.length !== 1) return ['the page made ' + eng.length + ' engine / ' + prop.length + ' prop / ' + af.length + ' airframe nodes (want 1 / 1 / 1)'];
  const g0 = G.groups[0], gA = G.groups[sp.GAF];
  if (!g0 || !gA) return ['the groups were not made (engine ' + !!g0 + ', airframe ' + !!gA + ')'];
  const to = (n, d, oo) => n.edges.some(e => e.d === d && (oo === undefined || e.o === oo));
  if (!to(eng[0], g0.ins[0], 0)) F.push('the engine\'s output 0 does not enter its group\'s exhaust input');
  if (to(eng[0], A.bus('aircraft.ext')) || to(eng[0], A.bus('aircraft.int'))) F.push('the engine still feeds the buses directly');
  const spl = prop[0].edges.find(e => e.o === 1 && e.d.kind === 'splitter');
  if (!spl) F.push('the prop\'s output 1 does not reach a splitter');
  else if (!to(spl.d, g0.ins[1], 0) || !to(spl.d, g0.ins[2], 1)) F.push('the splitter does not feed propT (tonal, channel 0) and propB (broadband, channel 1)');
  if (prop[0].edges.some(e => e.o === 0)) F.push('the prop\'s mono output 0 is still wired (it would double the prop)');
  if (af[0].opts.numberOfOutputs !== 3 || String(af[0].opts.outputChannelCount) !== '1,2,1') F.push('the airframe node is not made with 3 outputs [1, 2, 1] (' + af[0].opts.numberOfOutputs + ', ' + af[0].opts.outputChannelCount + ')');
  if (!to(af[0], gA.ins[3], 0) || !to(af[0], G.intIn, 1) || !to(af[0], G.intIn, 2)) F.push('the airframe\'s outputs: 0 -> its group ' + to(af[0], gA.ins[3], 0) + ', 1 -> interior ' + to(af[0], G.intIn, 1) + ', 2 -> interior ' + to(af[0], G.intIn, 2));
  // no placeholder low-pass anywhere (the 1.4 kHz the sources had); the cabin filters are cabinTransfer's
  const ph = pg.C.nodes.filter(n => n.kind === 'biquad' && n.type === 'lowpass' && Math.abs(n.frequency.value - 1400) < 1);
  if (ph.length) F.push(ph.length + ' placeholder 1.4 kHz low-pass(es) left in the graph');
  const cab = sp.cabin(), want = SPCFG_PAGE(S).cabinTransfer(pg.def.spec);
  if (!cab || cab.cls !== want.cls) F.push('the page\'s cabin is ' + (cab && cab.cls) + ' (want ' + want.cls + ')');
  const sh = want.filters.find(f => f.type === 'highshelf'), lp = want.filters.find(f => f.type === 'lowpass');
  if (Math.abs(G.shelf.gain.value - sh.gain) > 1e-6 || Math.abs(G.lp.frequency.value - lp.f) > 1e-6 || Math.abs(G.cabGain.gain.value - Math.pow(10, want.gainDb / 20)) > 1e-6)
    F.push('the cabin\'s nodes are not cabinTransfer\'s (shelf ' + G.shelf.gain.value + ' / ' + sh.gain + ', lp ' + G.lp.frequency.value + ' / ' + lp.f + ', gain ' + G.cabGain.gain.value + ')');
  if (!to(G.cabGain, G.intIn) || !to(G.hsGain, A.bus('aircraft.int'))) F.push('the cabin does not reach the interior through the headset');
  if (!to(g0.side, G.cabIn) || !to(gA.side, G.cabIn)) F.push('the groups do not feed the cabin');
  if (!to(g0.pan, A.bus('aircraft.ext')) || !to(g0.lpf, g0.pan) || !to(g0.sum, g0.lpf)) F.push('the exterior chain is not sum -> absorption -> panner -> aircraft.ext');
  // the directivity: the camera on the nose axis ahead -> the tonal at its floor; 14 deg behind the disc plane -> ~1;
  // the exhaust aft over ahead
  const dirAt = (ahead, aside) => { pg.place(ahead, 0, aside); for (let i = 0; i < 6; i++) pg.frame(); return [0, 1, 2].map(k => g0.dirs[k].gain.value); };
  const front = dirAt(200, 0.01), plane = dirAt(-200 * Math.tan(14 * Math.PI / 180), 200), aft = dirAt(-200, 0.01);
  if (!(front[1] < 0.06)) F.push('the prop\'s tonal on the nose axis is ' + front[1].toFixed(3) + ' (want nil, the floor)');
  if (!(plane[1] > 0.97)) F.push('the prop\'s tonal 14 deg behind the disc plane is ' + plane[1].toFixed(3) + ' (want ~1)');
  if (!(aft[0] > front[0] + 0.3)) F.push('the exhaust is not aft-biased: ahead ' + front[0].toFixed(2) + ', aft ' + aft[0].toFixed(2));
  if (!(plane[2] > front[2])) F.push('the broadband is not stronger in the disc plane (' + plane[2].toFixed(2) + ' vs ' + front[2].toFixed(2) + ' on the axis)');
  // the panner in the camera's frame: the aeroplane straight ahead of the eye -> (0, 0, -d)
  pg.place(300, 0, 0); for (let i = 0; i < 8; i++) pg.frame();
  const px = gA.pan.positionX.value, py = gA.pan.positionY.value, pz = gA.pan.positionZ.value;
  if (!(Math.abs(px) < 1 && Math.abs(py) < 1 && pz < -290 && pz > -310)) F.push('the panner is not in the camera\'s frame: (' + [px, py, pz].map(x => x.toFixed(1)).join(', ') + ') for the aeroplane 300 m ahead of the eye');
  // the lag: distance / c, carried by the sources' schedules
  const lag = A.lagS[0], dist = sp.frame[sp.GAF * sp.LW + 9], c = pg.sim.out ? 20.0468 * Math.sqrt(9 + 273.15) : 343;
  if (!(Math.abs(lag - dist / c) < 0.02)) F.push('the lag ' + lag.toFixed(3) + ' s is not the distance / c (' + (dist / c).toFixed(3) + ')');
  pg.sim.out.rpmEng = pg.sim.out.rpmEng.map(x => x * 0.7); pg.sim.out.rpm = pg.sim.out.rpm.map(x => x * 0.7);
  pg.frame();
  const er = eng[0].parameters.get('rpm').ev.filter(e => e.k === 'T').pop();
  if (!er || Math.abs(er.t - (pg.t + lag)) > 0.03) F.push('the engine\'s rpm is not scheduled at now + the lag (' + (er ? (er.t - pg.t).toFixed(3) : 'none') + ' s ahead, lag ' + lag.toFixed(3) + ')');
  // the doppler: the camera moving toward the aeroplane at 50 m/s -> pitch (c + 50) / c on every voice
  for (let i = 0; i < 40; i++) { pg.place(300 - 50 * (i / 60), 0, 0); pg.frame(); }
  const kW = (c + 50) / c;
  for (const [nm, n] of [['engine', eng[0]], ['prop', prop[0]], ['airframe', af[0]]]) {
    const pv = n.parameters.get('pitch').value;
    if (!(Math.abs(pv / kW - 1) < 0.01)) F.push('the ' + nm + '\'s pitch ' + pv.toFixed(4) + ' (want the doppler ' + kW.toFixed(4) + ' for an eye closing at 50 m/s)');
  }
  // a cut (the cockpit): the lag snaps to 0, 'space-cut' fires, the sources cancel what they scheduled ahead
  const c0 = pg.C.cancel;
  pg.cam.mode = 'cockpit'; pg.place(-1, 1, 0); pg.frame();
  if (A.lagS[0] !== 0) F.push('the cockpit kept a lag of ' + A.lagS[0].toFixed(3) + ' s');
  if (!(pg.C.cancel > c0 + 6)) F.push('a cut did not make the sources cancel their schedules (' + (pg.C.cancel - c0) + ' cancels)');
  // the headset and the ambience inside
  A.set('headset', 1); pg.frame();
  const hc = SPCFG_PAGE(S).headsetCurve('passive');
  if (Math.abs(G.hsHi.gain.value - hc.filters[0].gain) > 1e-6 || Math.abs(G.hsGain.gain.value - Math.pow(10, hc.gainDb / 20)) > 1e-6) F.push('the headset\'s nodes are not its passive curve');
  if (Math.abs(A.bus('aircraft').gain.value - A.get('aircraft')) > 1e-9) F.push('the flat -15 dB headset still applies over the space\'s curve');
  const ak = A.bus('ambience').gain.value / A.get('environment'), wantK = want.ambienceK * SPCFG_PAGE(S).headsetK('passive');
  if (!(Math.abs(ak - wantK) < 1e-6)) F.push('the ambience inside is x' + ak.toFixed(4) + ' (want the insulation duck x the headset: ' + wantK.toFixed(4) + ')');
  A.set('headsetAnr', 1); pg.frame();
  if (Math.abs(G.hsLo.gain.value - SPCFG_PAGE(S).headsetCurve('anr').filters[1].gain) > 1e-6) F.push('the ANR setting did not set the low-shelf');
  // without space.js the sources keep the old routing (no placeholder, both buses)
  const p0 = spacePage(S, { noSpace: true }); p0.place(60, 2, 0); for (let i = 0; i < 3; i++) p0.frame();
  const e0 = p0.aw('flydiy-engine')[0];
  if (!e0 || !to(e0, p0.A.bus('aircraft.ext'), 0) || !to(e0, p0.A.bus('aircraft.int'), 0)) F.push('without space.js the engine is not on both buses');
  return F;
}
const SPCFG_PAGE = S => spcOf(S);

// the measurement itself (the child runs it): the aeroplane flies past the still eye at 60 m/s along its nose (typed
// writes only: the test allocates nothing of its own), back to the start every 800 m (a teleport: the ring forgets it)
function spBudgetMeasure(S) {
  const pg = spacePage(S, { record: false });
  pg.place(0, 20, 60);
  const p = pg.sim.p, p0 = Float64Array.from(p), fw = Float64Array.from(pg.fwd), X = new Float64Array(1);
  const go = () => {
    X[0] += 1; if (X[0] > 400) X[0] = -400;
    const dx = fw[0] * X[0], dy = fw[1] * X[0], dz = fw[2] * X[0];
    for (let j = 0; j < p.length; j += 3) { p[j] = p0[j] + dx; p[j + 1] = p0[j + 1] + dy; p[j + 2] = p0[j + 2] + dz; }
    pg.frame();
  };
  X[0] = -400;
  for (let i = 0; i < 20000; i++) go();
  let gcs = 0;
  const obs = new PerformanceObserver(list => { gcs += list.getEntries().length; });
  obs.observe({ entryTypes: ['gc'] });
  global.gc(); global.gc();
  const gcs0 = gcs, h0 = process.memoryUsage().heapUsed, s0 = pg.C.sched;
  const t0 = performance.now();
  for (let i = 0; i < 10000; i++) go();
  const ms = (performance.now() - t0) / 10000;
  const dB = process.memoryUsage().heapUsed - h0, gIn = gcs - gcs0;
  obs.disconnect();
  const sch = (pg.C.sched - s0) / 10000;
  for (let i = 0; i < 200; i++) pg.frame();
  const s1 = pg.C.sched;
  for (let i = 0; i < 2000; i++) pg.frame();
  return { dB, gIn, ms, sch, steady: pg.C.sched - s1 };
}
const SPB_KEYS = ['params', 'audio', 'engine', 'srcprop', 'model', 'samples', 'srcaf', 'spcfg', 'space', 'worklet', 'engw', 'propw'];
let SPB_N = 0;
function checkSpBudget(S, report) {
  const F = [], os = require('os');
  // ONE fresh child per sample; a sample that fails its timing / GC bounds is taken AGAIN once (2026-10-04, the Sound
  // Coordinator: under a parallel battery the self-test's pristine re-run went red on a CPU-starved sample, never on its
  // own) - a real regression fails both samples, a starved one does not; the better sample is the one judged and reported
  // G1680: each sample is taken TWICE - as node runs by default, and with TurboFan alone (--no-maglev: a Node without
  // Maglev, the coordinator's box). A frame that leans on the optimiser's inlining (a double handed to or returned by a
  // call) boxes it there: SPACE_CONFIG.dopplerFactor grew the heap 90 B a frame on that tier while the default read 0.59.
  const sample = flags => {
    const tmp = path.join(os.tmpdir(), 'flydiy_spbudget_' + process.pid + '_' + (SPB_N++) + '.json');
    const sub = {}; for (const k of SPB_KEYS) sub[k] = S[k];
    fs.writeFileSync(tmp, JSON.stringify(sub));
    try {
      const out = execFileSync(process.execPath, ['--expose-gc', '--max-semi-space-size=64', ...(flags || []), __filename, '--spbudget-child=' + tmp], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return JSON.parse(out.trim().split('\n').pop());
    } catch (e) { return { err: String(e && (e.stderr || e.message) || e).split('\n').slice(0, 3).join(' | ') }; }
    finally { try { fs.unlinkSync(tmp); } catch (e) {} }
  };
  const noisy = q => !q || q.err || q.gIn > 0 || !(q.ms < 0.3);
  for (const [tier, flags] of [['', []], [' (TurboFan alone, --no-maglev)', ['--no-maglev']]]) {
    let r = sample(flags), retried = false;
    if (noisy(r)) { const r2 = sample(flags); retried = true; if (!noisy(r2) || (r.err && !r2.err) || (!r2.err && !r.err && r2.ms < r.ms)) r = r2; }
    if (r.err && flags.length && /bad option|unknown|not allowed/i.test(r.err)) { if (report) report.push('SP_BUDGET' + tier + ': this node has no such tier - not measured'); continue; }
    if (r.err) { F.push('the budget child' + tier + ' failed: ' + r.err); continue; }
    if (retried && report) report.push('SP_BUDGET' + tier + ': the first sample failed its timing / GC bound and was re-measured once');
    if (report) report.push('update() with the three sources + space.js, the aeroplane passing the eye at 60 m/s (a fresh process' + tier + '): heap ' + (r.dB >= 0 ? '+' : '') + r.dB + ' B over 10 000 frames (' + (r.dB / 10000).toFixed(2) + ' B a frame), ' + r.gIn + ' GC, ' + (r.ms * 1000).toFixed(1) + ' us a frame (with the test\'s own node shift), ' + r.sch.toFixed(1) + ' params scheduled a frame');
    if (r.gIn > 0) F.push('a GC ran inside the moving window' + tier + ' (' + r.gIn + '): the space allocates');
    if (r.dB > 16384) F.push('the moving frames grew the heap ' + r.dB + ' B over 10 000 frames (' + (r.dB / 10000).toFixed(1) + ' B a frame)' + tier);
    if (!(r.ms < 0.3)) F.push('update() with space.js costs ' + r.ms.toFixed(3) + ' ms a frame' + tier + ' (budget 0.3)');
    if (!(r.sch > 3)) F.push('the moving frames scheduled ' + r.sch.toFixed(2) + ' params a frame (the space is not following the aeroplane)');
    if (r.steady !== 0) F.push('a steady frame scheduled ' + r.steady + ' params over 2000 frames (want 0)');
  }
  return F;
}

// the node baker: the same engine and prop worklets under the shim (render.js / render_prop.js), one render per point
function nodeBaker(S) {
  return job => {
    const E = loadEngW(S), Pw = loadPropW(S), eng = [], broad = [];
    const gear = job.engine.gear > 0 ? job.engine.gear : 1;
    for (const rpm of job.points) {
      const v = RND.makeVoice(E, job.engine, 11, 0, { running: true, rpm });
      const load = Math.max(0.1, Math.min(1, (rpm - job.engine.idleRpm) / Math.max(1, job.engine.ratedRpm - job.engine.idleRpm)));
      v.params.rpm[0] = rpm; v.params.load[0] = load; v.params.running[0] = 1;
      const pr = new Pw.P({ processorOptions: { config: job.prop, seed: 12 } });
      const pp = {}; for (const d of Pw.P.parameterDescriptors) pp[d.name] = new Float32Array([d.defaultValue]);
      pp.rpm[0] = rpm / gear; pp.thrust[0] = load * (job.prop.Tstatic || 1000); pp.thr[0] = load; pp.V[0] = 30;
      const pout = [[new Float32Array(128)], [new Float32Array(128), new Float32Array(128)]], pin = [[v.outputs[1][0], v.outputs[1][1]]];
      const nb = Math.ceil(job.seconds * job.sr / 128), yE = new Float32Array(nb * 128), yB = new Float32Array(nb * 128);
      for (let b = 0; b < nb; b++) {
        v.proc.process(v.inputs, v.outputs, v.params); pr.process(pin, pout, pp);
        for (let k = 0; k < 128; k++) { yE[b * 128 + k] = v.outputs[0][0][k] + pout[1][0][k]; yB[b * 128 + k] = pout[1][1][k]; }
      }
      eng.push(yE); broad.push(yB);
    }
    return { eng, broad, sr: job.sr };
  };
}
async function checkSpCraft(S) {
  const F = [], SC = spcOf(S);
  // the tiers, pure
  const d = new Float64Array([4500, 120, 6000, 480, 300, 900, 1500, 2000, 2500, 3000, 3500, 4000, 4200, 4900]), n = d.length;
  const ord = new Int32Array(n), tier = new Uint8Array(n);
  SC.craftTiers(d, n, ord, tier);
  const nF = Array.from(tier).filter(t => t === SC.TIER_FULL).length, nE = Array.from(tier).filter(t => t === SC.TIER_ENGINE).length;
  if (tier[1] !== SC.TIER_FULL || tier[4] !== SC.TIER_FULL) F.push('the two nearest within 500 m are not full (' + tier[1] + ', ' + tier[4] + ')');
  if (tier[3] !== SC.TIER_ENGINE) F.push('the third craft within 500 m is not demoted to the engine tier (cap 2 full): ' + tier[3]);
  if (tier[2] !== SC.TIER_SILENT) F.push('a craft at 6 km is audible (' + tier[2] + ')');
  if (nF !== 2 || nE !== 8) F.push('the caps: ' + nF + ' full + ' + nE + ' engine-only (want 2 + 8)');
  if (tier[13] !== SC.TIER_SILENT || tier[12] !== SC.TIER_SILENT) F.push('the farthest within 5 km took a voice past the cap');
  // the blend at equal power, the rate
  const pts = SC.bakePoints(700, 2500, 5), BL = new Float64Array(5);
  if (pts.length !== 5 || pts[0] !== 700 || Math.abs(pts[4] - 2500) > 1e-9) F.push('the bake points ' + pts.map(x => x.toFixed(0)).join(' '));
  const mid = (pts[1] + pts[2]) / 2;
  SC.loopBlend(pts, mid, BL);
  if (BL[0] !== 1 || BL[1] !== 2 || Math.abs(BL[3] - mid / pts[1]) > 1e-12 || Math.abs(BL[4] - mid / pts[2]) > 1e-12) F.push('the blend between points 1 and 2 reads ' + Array.from(BL).map(x => x.toFixed(3)).join(' '));
  // through the page: a craft baked by the node baker, then flown past the camera
  const pg = spacePage(S, { record: true }), sp = pg.A.space, b = FLOWN[0];
  sp.setBaker(nodeBaker(S));
  const cfgE = ECFG_.engineSoundConfig(b.spec, 0, POWERPLANTS);
  const PRC = require(path.join(ROOT, 'src', 'viewer', 'audio', 'prop_config.js'));
  const cfgP = PRC.propSoundConfig(b.spec, 0, POWERPLANTS, b.def.params.prop).prop;
  const cr = sp.addCraft('ai1', { engineCfg: cfgE, propCfg: cfgP }, { sr: 48000 });
  await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
  if (!cr || cr.state !== 'ready') return F.concat(['the craft did not bake (' + (cr && cr.state) + (cr && cr.why ? ': ' + cr.why : '') + ')']);
  if (cr.loops.eng.length !== 5 || cr.loops.broad.length !== 5) F.push('the craft baked ' + cr.loops.eng.length + ' engine loops (want 5)');
  // seamless: the wrap's step against the loop's own sample-to-sample steps
  for (let k = 0; k < cr.loops.eng.length; k++) {
    const y = cr.loops.eng[k]; let st = 0; for (let i = 1; i < y.length; i++) st += Math.abs(y[i] - y[i - 1]);
    const mean = st / (y.length - 1), wrap = Math.abs(y[0] - y[y.length - 1]);
    if (!(wrap < 6 * mean + 1e-6)) F.push('loop ' + k + ' has a seam: the wrap steps ' + wrap.toExponential(2) + ' against a mean step of ' + mean.toExponential(2));
  }
  pg.place(60, 2, 0); pg.frame();
  const L = [pg.camera.position.x, pg.camera.position.y, pg.camera.position.z];
  const put = (dx, rpm) => { cr.st[0] = L[0] + dx; cr.st[1] = L[1]; cr.st[2] = L[2] + 1; cr.st[3] = 1; cr.st[4] = 0; cr.st[5] = 0; cr.st[6] = rpm; cr.st[7] = 0.8; };
  put(-3000, 2200); for (let i = 0; i < 10; i++) pg.frame();
  if (cr.tier !== SC.TIER_ENGINE || !cr.voice || cr.voice.layers.length !== 1) F.push('a craft at 3 km is not on the engine-only tier (' + cr.tier + ', ' + (cr.voice ? cr.voice.layers.length : 0) + ' layers)');
  put(-200, 2200); for (let i = 0; i < 10; i++) pg.frame();
  if (cr.tier !== SC.TIER_FULL || !cr.voice || cr.voice.layers.length !== 2) F.push('a craft at 200 m is not full (' + cr.tier + ')');
  // flying toward the eye at 60 m/s: the rate = rpm / point x c / (c - 60) on the bracket's sources
  for (let i = 0; i < 90; i++) { put(-200 + 60 * i / 60, 2200); pg.frame(); }
  SC.loopBlend(cr.points, cr.rpmS[0], BL);
  const c = 20.0468 * Math.sqrt(9 + 273.15), kD = c / (c - 60);
  const src = cr.voice.layers[0].srcs[BL[0] | 0], want = BL[3] * kD;
  if (!(Math.abs(src.playbackRate.value / want - 1) < 0.01)) F.push('the craft\'s loop rate ' + src.playbackRate.value.toFixed(4) + ' (want rpm / point x the doppler = ' + want.toFixed(4) + ')');
  const gs = cr.voice.layers[0].gains.map(g => g.gain.value);
  const p2 = gs.reduce((a, g) => a + g * g, 0);
  if (!(Math.abs(p2 - 1) < 0.02)) F.push('the craft\'s blend is not equal power (sum of squares ' + p2.toFixed(3) + ': ' + gs.map(g => g.toFixed(2)).join(' ') + ')');
  put(-8000, 2200); for (let i = 0; i < 5; i++) pg.frame();
  if (cr.tier !== SC.TIER_SILENT || cr.voice) F.push('a craft at 8 km still has a voice (tier ' + cr.tier + ')');
  sp.removeCraft('ai1');
  if (sp.crafts().length) F.push('removeCraft left ' + sp.crafts().length);
  SP_REPORT.push('a baked craft (the Cub\'s A-65): 5 loops of ' + (cr.loops.eng[0].length / 48000).toFixed(2) + ' s at ' + cr.points.map(x => x.toFixed(0)).join(' / ') + ' rpm; tiers 3 km engine-only, 200 m full, 8 km silent');
  return F;
}

// ---- SND-AMB-1 (G1650-G1654): THE AMBIENCE ------------------------------------------------------------------------
// a synthetic island in the island's own shape (rasters 10 m a cell): the sea east of x = 900 (a sandy beach before it),
// a forest (x < -300, z < 0, canopy 18 m), a lake (r 200 m at -800, 800), a village zone (residential, 200..600 x
// -1200..-800, built cover), a strip at (300, 900), a meadow everywhere else. Every sampler answers an integer (a double
// answered by a stub would be the STUB's box: the checks measure the model's own allocation).
const AMB_LAKE = [-800, 800, 200];
function ambWorld(o) {
  o = o || {};
  const N = 300, cell = 10, x0 = -1500, z0 = -1500;
  const cover = new Uint8Array(N * N), canopy = new Uint8Array(N * N), coast = new Uint8Array(N * N), lake = new Uint8Array(N * N);
  const u8 = sd => Math.max(0, Math.min(255, Math.round(128 + sd / 4)));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell, k = j * N + i;
    const dl = Math.hypot(x - AMB_LAKE[0], z - AMB_LAKE[1]) - AMB_LAKE[2];
    let c = 30;
    if (x > 900) c = 80; else if (dl < 0) c = 80; else if (x < -300 && z < 0) { c = 10; canopy[k] = 18; }
    else if (x >= 200 && x <= 600 && z >= -1200 && z <= -800) c = 50;
    cover[k] = c; coast[k] = u8(900 - x); lake[k] = u8(-dl);
  }
  const island = { grid: { w: N, h: N, cell, x0, z0 }, cover, canopy, coast, lake };
  // (integer arithmetic: the callers pass whole metres; Math.hypot is a builtin call that answers a fresh heap number)
  const inLake = (x, z) => (x - AMB_LAKE[0]) * (x - AMB_LAKE[0]) + (z - AMB_LAKE[1]) * (z - AMB_LAKE[1]) < AMB_LAKE[2] * AMB_LAKE[2];
  const W = {
    island,
    terrainH: (x, z) => (x > 900 ? -5 : inLake(x, z) ? 10 : 20),
    waterH: (x, z) => (x > 900 ? 0 : inLake(x, z) ? 15 : -1e9),
    surface: (x, z) => (x > 850 && x <= 900 ? 7 : x < -300 && z < 0 ? 3 : 0),
    hydro: { distW: (x, z) => { const dl = Math.round(Math.sqrt((x - AMB_LAKE[0]) * (x - AMB_LAKE[0]) + (z - AMB_LAKE[1]) * (z - AMB_LAKE[1]))) - AMB_LAKE[2];
                                const ds = 900 - x, d = dl < ds ? dl : ds; return d > 0 ? d : 0; } },
    premises: { rec: { layers: { zones: [{ kind: 'residential', poly: [[200, -1200], [600, -1200], [600, -800], [200, -800]] },
                                        { kind: 'forest', poly: [[-1500, -1500], [-300, -1500], [-300, 0]] }] } },
                overlay: { frame: { toWorld: (x, z) => [x, z] } } },
    aerodromes: [{ x: 300, z: 900, hdg: 0, len: 600, wid: 30, kind: 'strip' }, { x: 1200, z: 0, hdg: 0, len: 1500, wid: 200, kind: 'water' }],
    settlements: [],
    climate: { sample: (x, y, z, t, out) => { out[0] = W.windMs; out[1] = 0; out[2] = 0; return out; } },
    day: { sunEl: 45, storm: null },
    windMs: o.wind != null ? o.wind : 3,
  };
  if (o.sun != null) W.day.sunEl = o.sun;
  return W;
}
const ambModelOf = S => { const c = { module: { exports: {} } }; vm.runInNewContext(S.ambmodel, c, { filename: 'ambience_model.js' }); return c.module.exports; };
// the model alone at (x, z), h m above the ground / water, for `sec` seconds -> st
function ambAt(M, W, x, z, h, o) {
  o = o || {};
  const AP = loadParams(SRC0.params), P = AP.audioParamsBlock(), st = M.ambienceState();
  const g = Math.max(W.terrainH(x, z), W.waterH(x, z));
  P.s[P.I.listenerX] = x; P.s[P.I.listenerY] = o.y != null ? o.y : g + h; P.s[P.I.listenerZ] = z; P.s[P.I.inGarage] = o.garage ? 1 : 0;
  if (o.rain != null) st.clk[11] = o.rain;
  for (let i = 0; i < 60 * (o.sec || 1.2); i++) M.ambienceStep(st, P, W, 1 / 60);
  return st;
}
const AMB_GROUND = ['amb.forest.day', 'amb.forest.night', 'amb.meadow', 'amb.shore.surf', 'amb.shore.rocks', 'amb.lake.near', 'amb.lake.shore', 'amb.lake.lap', 'amb.sea.open',
                    'amb.stream', 'amb.harbour', 'amb.village', 'amb.airfield', 'amb.frogs.night'];
const AMB_WINDS = ['amb.wind.light', 'amb.wind.clear', 'amb.wind.mountain', 'amb.wind.storm'];
// the expectations: [place, x, z, h, opts, [[bed, '>=' | '<=', value], ...]] on the TARGETS (st.t) after one round
const AMB_PLACES = [
  ['forest interior', -900, -800, 1.7, {}, [['amb.forest.day', '>=', 0.8], ['amb.meadow', '<=', 0.15], ['amb.shore.surf', '<=', 0.01], ['amb.village', '<=', 0.01], ['amb.airfield', '<=', 0.01], ['amb.lake.lap', '<=', 0.01], ['amb.forest.night', '<=', 0.02]]],
  ['beach', 875, 0, 1.7, {}, [['amb.shore.surf', '>=', 0.6], ['amb.shore.rocks', '<=', 0.05], ['amb.forest.day', '<=', 0.05]]],
  ['village street', 400, -1000, 1.7, {}, [['amb.village', '>=', 0.9], ['amb.shore.surf', '<=', 0.01], ['amb.forest.day', '<=', 0.05]]],
  ['lake shore', AMB_LAKE[0] + AMB_LAKE[2] + 5, AMB_LAKE[1], 1.7, {}, [['amb.lake.lap', '>=', 0.8], ['amb.lake.shore', '>=', 0.6], ['amb.lake.near', '>=', 0.2], ['amb.stream', '<=', 0.01]]],
  ['60 m from the lake', AMB_LAKE[0] + AMB_LAKE[2] + 60, AMB_LAKE[1], 1.7, {}, [['amb.lake.near', '<=', 0.02], ['amb.lake.shore', '<=', 0.02], ['amb.lake.lap', '>=', 0.02]]],
  ['500 m AGL', 0, 500, 500, {}].concat([AMB_GROUND.map(k => [k, '<=', 0.005]).concat([['winds', '>=', 0.3]])]),
  ['the garage, dry', 0, 500, 1.7, { garage: 1 }, [['amb.hangar', '>=', 0.99], ['amb.rain.roof', '<=', 0.001], ['amb.forest.day', '<=', 0.25], ['amb.meadow', '<=', 0.25], ['amb.shore.surf', '<=', 0.001], ['amb.village', '<=', 0.001], ['amb.airfield', '<=', 0.001]]],
  ['the garage, raining', 0, 500, 1.7, { garage: 1, rain: 1 }, [['amb.hangar', '>=', 0.99], ['amb.rain.roof', '>=', 0.99]]],
  ['out of the garage', 0, 500, 1.7, { rain: 1 }, [['amb.hangar', '<=', 0.001], ['amb.rain.roof', '<=', 0.001]]],
  ['the strip', 300, 900, 1.7, {}, [['amb.airfield', '>=', 0.9]]],
  ['the water lane (no fence)', 1200, 0, 1.7, {}, [['amb.airfield', '<=', 0.01]]],
  ['under the sea', 1300, 0, 0, { y: -3 }, [['amb.shore.rocks', '>=', 0.99], ['amb.wind.light', '<=', 0.001], ['amb.lake.lap', '<=', 0.001], ['amb.sea.open', '<=', 0.001]]],
  ['out at sea', 1500, 0, 1.7, {}, [['amb.sea.open', '>=', 0.3], ['amb.lake.lap', '<=', 0.3], ['amb.forest.day', '<=', 0.01]]],
  ['the forest at night', -900, -800, 1.7, { sun: -12 }, [['amb.forest.night', '>=', 0.8], ['amb.forest.day', '<=', 0.02]]],
  ['the lake shore at night', AMB_LAKE[0] + AMB_LAKE[2] + 5, AMB_LAKE[1], 1.7, { sun: -12 }, [['amb.frogs.night', '>=', 0.5]]],
  ['the lake shore by day', AMB_LAKE[0] + AMB_LAKE[2] + 5, AMB_LAKE[1], 1.7, {}, [['amb.frogs.night', '<=', 0.02], ['amb.loons', '<=', 0.02]]],
  ['the lake at dusk', AMB_LAKE[0] + AMB_LAKE[2] + 5, AMB_LAKE[1], 1.7, { sun: -3 }, [['amb.loons', '>=', 0.8]]],
  ['the meadow, calm', 0, 500, 1.7, { wind: 1 }, [['top wind', '=', 'amb.wind.light']]],
  ['the meadow, 7 m/s', 0, 500, 1.7, { wind: 7 }, [['top wind', '=', 'amb.wind.clear']]],
  ['the meadow, 16 m/s', 0, 500, 1.7, { wind: 16 }, [['top wind', '=', 'amb.wind.storm'], ['amb.wind.storm', '>=', 0.8]]],
  ['the open ground at night', 0, 500, 1.7, { sun: -12, wind: 1 }, [['amb.wind.mountain', '>=', 0.3]]],
  ['the forest floor, 7 m/s (sheltered)', -900, -800, 1.7, { wind: 7 }, [['top wind', '=', 'amb.wind.light']]],
];
function ambPlace(M, W, row) {
  const [, x, z, h, o] = row;
  if (o.sun != null) W.day.sunEl = o.sun; else W.day.sunEl = 45;
  W.windMs = o.wind != null ? o.wind : 3;
  return ambAt(M, W, x, z, h, o);
}
function ambExpect(M, st, exp, label) {
  const F = [], T = k => st.t[M.BEDS.findIndex(b => b[0] === k)];
  for (const [k, op, v] of exp) {
    if (k === 'winds') { const s = AMB_WINDS.reduce((a, w) => a + T(w), 0); if (!(s >= v)) F.push(label + ': the winds sum ' + s.toFixed(3) + ' (want >= ' + v + ')'); continue; }
    if (k === 'top wind') { const top = AMB_WINDS.slice().sort((a, b) => T(b) - T(a))[0]; if (top !== v) F.push(label + ': the loudest wind is ' + top + ' (want ' + v + ')'); continue; }
    const t = T(k);
    if (!(op === '>=' ? t >= v : t <= v)) F.push(label + ': ' + k + ' ' + t.toFixed(3) + ' (want ' + op + ' ' + v + ')');
  }
  return F;
}
function checkAmbPlaces(S) {
  const M = ambModelOf(S), W = ambWorld();
  let F = [];
  for (const row of AMB_PLACES) F = F.concat(ambExpect(M, ambPlace(M, W, row), row[5], row[0]));
  return F;
}
// THE REAL ISLAND: Jolene composed (media/world/jolene + the premises fixture), the evidence's canned places
let JOLENE = null;
function checkAmbJolene(S) {
  if (!JOLENE) JOLENE = require(path.join(ROOT, 'tools', 'audio', 'ambience_render.js')).loadJolene();
  const AR = require(path.join(ROOT, 'tools', 'audio', 'ambience_render.js'));
  AR.setClock(JOLENE, 16);
  const M = ambModelOf(S), P = AR.PLACES;
  const want = {
    'forest interior': [['amb.forest.day', '>=', 0.8], ['amb.shore.surf', '<=', 0.01], ['amb.village', '<=', 0.01]],
    'beach': [['amb.shore.surf', '>=', 0.5]],
    'village street': [['amb.village', '>=', 0.9], ['amb.forest.day', '<=', 0.1]],
    'lake shore': [['amb.lake.lap', '>=', 0.8], ['amb.lake.shore', '>=', 0.3]],
    'stand at Jolene AFB': [['amb.airfield', '>=', 0.9], ['amb.village', '<=', 0.05]],
    '500 m AGL': AMB_GROUND.map(k => [k, '<=', 0.005]).concat([['winds', '>=', 0.3]]),
    'garage': [['amb.hangar', '>=', 0.99], ['amb.airfield', '<=', 0.001]],
  };
  let F = [];
  for (const [name, x, z, h, garage] of P) {
    if (!want[name]) { F.push('no expectation for the evidence\'s place "' + name + '"'); continue; }
    F = F.concat(ambExpect(M, ambAt(M, JOLENE, x, z, h, { garage }), want[name], 'Jolene ' + name));
  }
  return F;
}
// THE SMOOTHING: a random walk with teleports - no weight moves more than AM_RATE a second, ever
function checkAmbSmooth(S) {
  const F = [], M = ambModelOf(S), W = ambWorld();
  const AP = loadParams(SRC0.params), P = AP.audioParamsBlock(), st = M.ambienceState();
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  let x = 0, z = 0, h = 2, worst = 0, rounds = 0, tLast = 0;
  const prev = new Float32Array(M.NB);
  const spots = AMB_PLACES.slice(0, 6);
  for (let f = 0; f < 60 * 600; f++) {
    if (f % 1200 === 0) { const s = spots[Math.floor(rnd() * spots.length)]; x = s[1]; z = s[2]; h = s[3]; W.windMs = rnd() * 18; W.day.sunEl = rnd() * 60 - 15; P.s[P.I.inGarage] = rnd() < 0.15 ? 1 : 0; }
    x += (rnd() - 0.5) * 6; z += (rnd() - 0.5) * 6;
    P.s[P.I.listenerX] = x; P.s[P.I.listenerZ] = z; P.s[P.I.listenerY] = Math.max(W.terrainH(x, z), W.waterH(x, z)) + h;
    prev.set(st.w);
    if (M.ambienceStep(st, P, W, 1 / 60)) {
      const t = f / 60, dtR = t - tLast; tLast = t; rounds++;
      if (rounds > 1) for (let b = 0; b < M.NB; b++) { const r = Math.abs(st.w[b] - prev[b]) / dtR; if (r > worst) worst = r; }
    } else for (let b = 0; b < M.NB; b++) if (st.w[b] !== prev[b]) { F.push('a weight moved between rounds'); return F; }
  }
  if (!(worst <= M.AM_RATE + 1e-4)) F.push('a weight moved ' + worst.toFixed(3) + ' a second (the cap ' + M.AM_RATE + ')');
  if (!(worst > 0.5 * M.AM_RATE)) F.push('the walk never moved a weight near its cap (' + worst.toFixed(3) + '): the check proves nothing');
  if (rounds < 600 * 1.5 || rounds > 600 * 2.2) F.push(rounds + ' rounds in 600 s (want ~2 a second: the world is read every ~0.5 s, not every frame)');
  // a teleport from the forest to the beach: the surf fades in over seconds, the forest out
  W.windMs = 3; W.day.sunEl = 45; P.s[P.I.inGarage] = 0;
  const st2 = ambAt(M, W, -900, -800, 1.7, { sec: 30 }), b = M.B.shoreSurf, fd = M.B.forestDay;
  if (!(st2.w[fd] >= 0.8)) F.push('30 s in the forest: forest.day at ' + st2.w[fd].toFixed(2));
  P.s[P.I.listenerX] = 875; P.s[P.I.listenerZ] = 0; P.s[P.I.listenerY] = 21.7; P.s[P.I.inGarage] = 0; W.windMs = 3; W.day.sunEl = 45;
  for (let i = 0; i < 60; i++) M.ambienceStep(st2, P, W, 1 / 60);
  if (!(st2.w[b] <= M.AM_RATE * 1.05 + 1e-3 && st2.w[fd] >= 0.45)) F.push('one second after a teleport the surf is at ' + st2.w[b].toFixed(2) + ', the forest at ' + st2.w[fd].toFixed(2) + ' (a jump)');
  for (let i = 0; i < 60 * 15; i++) M.ambienceStep(st2, P, W, 1 / 60);
  if (!(st2.w[b] >= 0.55 && st2.w[fd] <= 0.05)) F.push('15 s after the teleport the surf is at ' + st2.w[b].toFixed(2) + ', the forest at ' + st2.w[fd].toFixed(2));
  return F;
}
// THE HEIGHT: the ground's beds fade with AGL and are gone at 150 m; the winds stay
function checkAmbAgl(S) {
  const F = [], M = ambModelOf(S), W = ambWorld();
  // the forest's edge by the lake: forest, meadow, lake, frogs all in play
  const x = -700, z = -40, hs = [2, 40, 80, 120, 150, 300];
  W.day.sunEl = 2;
  const sum = hs.map(h => { const st = ambAt(M, W, x, z, h); return [AMB_GROUND.reduce((a, k) => a + st.t[M.BEDS.findIndex(b => b[0] === k)], 0), AMB_WINDS.reduce((a, k) => a + st.t[M.BEDS.findIndex(b => b[0] === k)], 0)]; });
  W.day.sunEl = 45;
  if (!(sum[0][0] > 0.8)) F.push('the ground beds at 2 m sum ' + sum[0][0].toFixed(2) + ' (nothing to fade)');
  for (let i = 1; i < hs.length; i++) if (!(sum[i][0] <= sum[i - 1][0] + 1e-6)) F.push('the ground beds louder at ' + hs[i] + ' m (' + sum[i][0].toFixed(3) + ') than at ' + hs[i - 1] + ' m');
  if (!(sum[2][0] < 0.85 * sum[0][0])) F.push('at 80 m the ground beds still sum ' + sum[2][0].toFixed(2) + ' of ' + sum[0][0].toFixed(2));
  if (!(sum[4][0] <= 0.005 && sum[5][0] <= 0.005)) F.push('the ground beds at 150 / 300 m: ' + sum[4][0].toFixed(3) + ' / ' + sum[5][0].toFixed(3) + ' (want silent)');
  if (!(sum[5][1] >= 0.3)) F.push('the winds at 300 m sum ' + sum[5][1].toFixed(2) + ' (they do not fade)');
  return F;
}
// THE LEVELS: every amb.* file of the catalogue is a bed, with the catalogue's own LUFS; the loons sit low
function checkAmbLufs(S) {
  const F = [], M = ambModelOf(S);
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/viewer/audio/sfx_catalogue.json'), 'utf8')).filter(e => /^amb\./.test(e.key));
  const keys = new Set(M.BEDS.map(b => b[0]));
  for (const e of cat) {
    const b = M.BEDS.find(r => r[0] === e.key);
    if (!b) { F.push('the catalogue ships ' + e.key + ' and no bed plays it'); continue; }
    if (Math.abs(b[2] - e.lufs) > 0.05) F.push(e.key + ': the bed trims by ' + b[2] + ' LUFS, the catalogue says ' + e.lufs);
    keys.delete(e.key);
  }
  for (const k of keys) F.push('the bed ' + k + ' has no file in the catalogue (ask the coordinator)');
  const st = M.ambienceState();
  M.BEDS.forEach((b, i) => { const want = Math.pow(10, (b[1] + (M.AM_LUFS - b[2])) / 20); if (Math.abs(st.lv[i] - want) > 1e-9) F.push(b[0] + ': level ' + st.lv[i] + ' (want ' + want + ')'); });
  const lo = st.lv[M.B.loons];
  if (!(lo <= Math.pow(10, -15 / 20))) F.push('the loons at ' + (20 * Math.log10(lo)).toFixed(1) + ' dB (the user: "really background", want <= -15 dB)');
  return F;
}
// the page, the real audio.js, the ambience scripts after it, a context that decodes and plays; opts: tier, search, fetch
function ambPage(S, o) {
  o = o || {};
  const R = { fetch: 0, decode: 0, sources: [], biquads: [] };
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/viewer/audio/sfx_catalogue.json'), 'utf8'));
  const media = {}; for (const e of cat) (media[e.key] = media[e.key] || []).push(e.file);
  const PCM = new Float32Array(48000 * 32); for (let i = 0; i < PCM.length; i++) PCM[i] = Math.sin(i * 0.05) * 0.3 + 0.01;
  const mkBuf = (n, sr, d) => { const a = d || new Float32Array(n); return { length: n, numberOfChannels: 1, sampleRate: sr, duration: n / sr, getChannelData: () => a }; };
  const pg = makePage(S, Object.assign({ quiet: true, search: o.search || '',
    before: w => { w.FLYDIY_AUDIO_MEDIA = media; w.FLYDIY_ASSET_BASE = ''; w.ASSET_FETCH = u => { R.fetch++; return Promise.resolve(new Uint8Array(64)); };
                   w.GFX = { get: () => ({ preset: o.tier || 'gamer' }) }; },
    after: [[S.samples, 'samples.js'], [S.ambmodel, 'ambience_model.js'], [S.amb, 'ambience.js']],
    ctx: (proto, C) => {
      // (params that keep no automation list: makePage's own record every event - an allocation that is the stub's)
      const prm = v => ({ value: v, setTargetAtTime(x) { this.value = x; C.sched++; }, setValueAtTime(x) { this.value = x; },
                          cancelScheduledValues() {}, linearRampToValueAtTime(x) { this.value = x; C.sched++; } });
      proto.createGain = function () { C.nodes++; return { gain: prm(1), connect(n) { this.to = n; }, disconnect() {} }; };
      proto.createBiquadFilter = function () { C.nodes++; const b = { type: '', frequency: prm(20000), Q: prm(1), connect(n) { this.to = n; }, disconnect() {} }; R.biquads.push(b); return b; };
      proto.createBuffer = (ch, n, sr) => mkBuf(n, sr);
      proto.createBufferSource = function () { C.nodes++; const s = { buffer: null, loop: false, playbackRate: prm(1), connect(n) { this.to = n; }, disconnect() {}, start() { this.on = 1; }, stop() { this.on = 0; } }; R.sources.push(s); return s; };
      proto.decodeAudioData = function (ab, ok) { R.decode++; const b = mkBuf(PCM.length, 48000, PCM); if (ok) ok(b); return Promise.resolve(b); };
    } }, o.page || {}));
  if (!(o.page && o.page.noGesture)) pg.gesture('pointerdown');
  const fb = FLOWN[5];
  pg.sim = stubSim(fb, { mains: [true, true], tw: false, water: false }); pg.def = fb.def;
  pg.camera = { position: { x: 0, y: 22, z: 500 } }; pg.cam = { mode: 'chase' };
  pg.R = R;
  pg.world = ambWorld();
  pg.go = () => pg.A.update(pg.sim, pg.camera, 1 / 60, pg.def, pg.cam, !!pg.garage, pg.world);
  pg.settle = async n => { for (let i = 0; i < n; i++) { pg.go(); if (i % 4 === 0) await null; } for (let i = 0; i < 8; i++) await null; };
  pg.at = (x, z, h) => { const W = pg.world; pg.camera.position.x = x; pg.camera.position.z = z; pg.camera.position.y = Math.max(W.terrainH(x, z), W.waterH(x, z)) + h; };
  return pg;
}
// NOTHING BEFORE THE GESTURE: frames before it fetch and decode nothing; ?audio=0 has no ambience at all
async function checkAmbGesture(S) {
  const F = [];
  const pg = ambPage(S);
  if (!pg.win.AMBIENCE) return ['the ambience source did not register (window.AMBIENCE absent)'];
  if (pg.R.fetch || pg.R.decode) F.push('the gesture fetched ' + pg.R.fetch + ' / decoded ' + pg.R.decode + ' before any frame');
  pg.at(-900, -800, 1.7);
  await pg.settle(240);
  if (pg.R.fetch === 0) F.push('nothing fetched in 4 s in the forest after the gesture');
  const pre = makePage(S, { quiet: true, before: w => { w.ASSET_FETCH = () => { F.push('a fetch before the gesture'); return Promise.resolve(new Uint8Array(1)); }; w.FLYDIY_AUDIO_MEDIA = { 'amb.forest.day': ['f.mp3'] }; },
                            after: [[S.samples, 'samples.js'], [S.ambmodel, 'ambience_model.js'], [S.amb, 'ambience.js']] });
  const b = FLOWN[5], sim = stubSim(b, { mains: [true, true], tw: false, water: false }), W = ambWorld(), cam = { position: { x: -900, y: 21.7, z: -800 } };
  for (let i = 0; i < 600; i++) pre.A.update(sim, cam, 1 / 60, b.def, { mode: 'chase' }, false, W);
  for (let i = 0; i < 8; i++) await null;
  if (pre.C.ctx !== 0) F.push('a context before the gesture (' + pre.C.ctx + ')');
  const off = makePage(S, { quiet: true, search: '?audio=0', after: [[S.samples, 'samples.js'], [S.ambmodel, 'ambience_model.js'], [S.amb, 'ambience.js']] });
  if (off.win.AMBIENCE) F.push('?audio=0 built the ambience');
  return F;
}
// THE BUDGET: a 3-minute random walk with teleports, gamer and potato: decoded bytes under the tier's budget and at most N
// beds decoded at once, every frame; beds are loaded AND released; the potato's loops are at half rate
async function checkAmbBudget(S, report) {
  const F = [];
  for (const [tier, budget, N, sr] of [['gamer', 24 * 1048576, 6, 48000], ['potato', 8 * 1048576, 3, 24000]]) {
    const pg = ambPage(S, { tier });
    const SM = pg.win.AUDIO_SAMPLES, AMB = pg.win.AMBIENCE, M = pg.win.AMBIENCE_MODEL;
    let seed = 3; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    let maxB = 0, maxN = 0, drops = 0, lastB = 0, x = 0, z = 0, h = 2;
    const spots = AMB_PLACES.slice(0, 5).concat([AMB_PLACES[9]]);
    // the RELEASE itself, observed: a playing bed (2) that goes straight back to nothing (0) without the eviction's fade
    // (4) can only have been freed by the RELEASE_S timer (2026-10-04: with the lake's beds over the slot cap, eviction
    // alone could empty the ground's beds, so "nothing left at 500 m" no longer proved the release)
    const prevR = new Int8Array(M.NB); let timerReleases = 0;
    const track = () => { for (let b = 0; b < M.NB; b++) { const r = AMB.resident(b); if (prevR[b] === 2 && r === 0) timerReleases++; prevR[b] = r; } };
    for (let f = 0; f < 60 * 180; f++) {
      if (f % 900 === 0) { const s = spots[Math.floor(rnd() * spots.length)]; x = s[1]; z = s[2]; h = s[3]; pg.world.day.sunEl = rnd() < 0.3 ? -12 : 40; pg.world.windMs = rnd() * 16; pg.garage = rnd() < 0.1; }
      x += (rnd() - 0.5) * 4; z += (rnd() - 0.5) * 4;
      pg.at(x, z, h); pg.go(); track();
      if (f % 3 === 0) await null;
      const by = SM.classBytes('amb');
      let n = 0; for (let b = 0; b < M.NB; b++) { const r = AMB.resident(b); if (r === 1 || r === 2 || r === 4) n++; }
      if (by > maxB) maxB = by; if (n > maxN) maxN = n; if (by < lastB) drops++; lastB = by;
      if (by > budget) { F.push(tier + ': ' + (by / 1048576).toFixed(1) + ' MB decoded (the budget ' + budget / 1048576 + ')'); break; }
      if (n > N) { F.push(tier + ': ' + n + ' beds decoded at once (N ' + N + ')'); break; }
    }
    const loops = pg.R.sources.filter(s => s.buffer && s.loop);
    if (loops.length < 6) F.push(tier + ': only ' + loops.length + ' loops played over the walk');
    if (drops < 3) F.push(tier + ': the decoded bytes went down ' + drops + ' times (nothing released)');
    if (loops.some(s => s.buffer.sampleRate !== sr)) F.push(tier + ': a loop at ' + loops.find(s => s.buffer.sampleRate !== sr).buffer.sampleRate + ' Hz (want ' + sr + ')');
    if (maxN < N) F.push(tier + ': the walk never filled the ' + N + ' slots (' + maxN + '): the cap is untested');
    // then 20 s on the lake shore at night (its beds in), and 40 s at 500 m in a light air: nothing new is wanted there
    // (the light wind is in already), so only the release frees the ground's silent beds - past RELEASE_S they must go
    pg.garage = false; pg.world.windMs = 2; pg.world.day.sunEl = -12;
    for (let f = 0; f < 60 * 20; f++) { pg.at(AMB_LAKE[0] + AMB_LAKE[2] + 5, AMB_LAKE[1], 1.7); pg.go(); track(); if (f % 3 === 0) await null; }
    // (by DAY at 500 m: only the light wind is wanted, so the slot cap cannot evict the ground's beds for the release -
    // with the lake's beds now over the cap at the shore, a night here let eviction hide a broken release; 2026-10-04)
    // then a CLIMB from the shore to 500 m (25 m/s, no teleport: a cut fades every bed out and the timer never acts),
    // and 30 s held there: the ground's beds fall silent with the height while nothing new is wanted, so only the
    // RELEASE_S timer can free them
    for (let f = 0; f < 60 * 20; f++) { pg.at(AMB_LAKE[0] + AMB_LAKE[2] + 5, AMB_LAKE[1], 1.7 + f * (500 / 1200)); pg.go(); track(); if (f % 3 === 0) await null; }
    for (let f = 0; f < 60 * 30; f++) { pg.at(AMB_LAKE[0] + AMB_LAKE[2] + 5, AMB_LAKE[1], 501.7); pg.go(); track(); if (f % 3 === 0) await null; }
    if (!timerReleases) F.push(tier + ': no bed was released by the RELEASE_S timer (only evictions freed slots)');
    let left = 0; for (let b = 0; b < M.NB; b++) { const r = AMB.resident(b); if ((r === 1 || r === 2 || r === 4) && !/^amb\.wind\./.test(M.BEDS[b][0])) left++; }
    if (left) F.push(tier + ': after the climb and 30 s at 500 m, ' + left + ' ground beds are still decoded (' + (SM.classBytes('amb') / 1048576).toFixed(1) + ' MB)');
    if (report) report.push('the ambience on ' + tier + ': peak ' + (maxB / 1048576).toFixed(1) + ' / ' + budget / 1048576 + ' MB decoded, ' + maxN + ' / ' + N + ' beds at once, ' + pg.R.fetch + ' fetches, ' + loops.length + ' loops, ' + drops + ' releases over 3 min');
  }
  return F;
}
// ALLOCATION AND SCHEDULING: AUDIO.update with the ambience over 10 000 frames of a walk (warmed over every place) -
// no heap growth, no GC; a listener standing still schedules nothing once its weights have settled
async function checkAmbAlloc(S, report) {
  const F = [];
  let tick = 0;
  const pg = ambPage(S, { page: { clock: () => ++tick } });
  const W = pg.world;
  // a slow loop through the forest, the lake, the meadow, the village, the beach and back: every probe branch
  const route = [[-900, -800], [-600, 600], [0, 500], [400, -1000], [880, 0], [300, 900], [-900, -800]];
  const pos = new Float64Array(2);
  const where = f => { const L = route.length - 1, u = (f % 20000) / 20000 * L, k = Math.floor(u), a = u - k; pos[0] = route[k][0] + (route[k + 1][0] - route[k][0]) * a; pos[1] = route[k][1] + (route[k + 1][1] - route[k][1]) * a; };
  const cp = pg.camera.position;
  const step = f => { where(f); cp.x = pos[0]; cp.z = pos[1]; cp.y = 30; pg.go(); };
  for (let f = 0; f < 80000; f++) { step(f); if (f % 8 === 0) await null; }
  // then a walk to and fro across the forest's edge (its beds resident after 30 s there: no load starts in the window -
  // a load is an event, its promise allocates, and the window measures the frame)
  const edge = f => { const u = (f % 1200) / 1200, a = u < 0.5 ? 2 * u : 2 - 2 * u; cp.x = -700; cp.z = -260 + 420 * a; cp.y = 30; pg.go(); };
  for (let f = 0; f < 60 * 30; f++) { edge(f); if (f % 8 === 0) await null; }
  // UP TO THREE WINDOWS, the best counts: a window in which V8 meets a branch for the first time deoptimises and reads
  // the interpreter's boxes until it re-optimises (measured: one such deopt ~ 80 000 frames in); an allocation of the
  // code's own reads in every window
  const ld0 = pg.R.fetch, sch0 = pg.C.sched;
  // the allowance: 48 B a gain scheduled - its two doubles, boxed by a call TurboFan does not inline (the stub's JS param
  // here, the AudioParam's native method in the page); the frame's own code allocates nothing
  let dB = 1e9, gcs = 1e9, schW = 0, allow = 0;
  for (let w = 0; w < 3 && (gcs > 0 || dB > allow); w++) {
    global.gc(); global.gc(); await new Promise(r => setTimeout(r, 5));   // (the forced collections are reported late: before the observer)
    let g = 0; const obs = new PerformanceObserver(l => { g += l.getEntries().length; }); obs.observe({ entryTypes: ['gc'] });
    const s0 = pg.C.sched, h0 = process.memoryUsage().heapUsed;
    for (let f = 0; f < 10000; f++) edge(f);
    const d = process.memoryUsage().heapUsed - h0, sc = pg.C.sched - s0;
    await new Promise(r => setTimeout(r, 5)); obs.disconnect();
    if (w === 0 || g < gcs || (g === gcs && d - 48 * sc < dB - 48 * schW)) { gcs = g; dB = d; schW = sc; allow = 8192 + 48 * sc; }
  }
  if (gcs > 0 || dB > allow) F.push('AUDIO.update with the ambience allocates: ' + dB + ' B, ' + gcs + ' GC over 10 000 moving frames (allowed ' + Math.round(allow) + ' B: 48 B for each of ' + schW + ' gains scheduled)');
  if (pg.R.fetch !== ld0) F.push('the window started ' + (pg.R.fetch - ld0) + ' loads (it measures frames, not loads)');
  if (!(schW > 20)) F.push('the moving window scheduled only ' + schW + ' gains (the walk proves nothing)');
  // standing still: settle 40 s, then 3000 frames schedule nothing
  for (let f = 0; f < 60 * 40; f++) { pg.go(); if (f % 8 === 0) await null; }
  const s0 = pg.C.sched;
  for (let f = 0; f < 3000; f++) pg.go();
  const sch = pg.C.sched - s0;
  if (sch !== 0) F.push('a listener standing still scheduled ' + sch + ' AudioParam changes over 3000 frames (want 0)');
  if (report) report.push('the ambience in AUDIO.update: ' + (dB / 10000).toFixed(2) + ' B a moving frame (~' + Math.round(schW) + ' gains scheduled in the window), ' + gcs + ' GC; ' + sch + ' params scheduled standing still');
  return F;
}
// THE MUFFLE: outside / closed cockpit / open cockpit / SND-SPACE's insulation / the garage's door / under water
async function checkAmbMuffle(S) {
  const F = [];
  const pg = ambPage(S);
  await pg.settle(60);
  const lp = pg.R.biquads[0];
  if (!lp || !lp.to || !lp.to.gain) return ['the ambience made no lowpass -> duck chain'];
  const duck = lp.to.gain;
  const db = v => 20 * Math.log10(v);
  const expect = (label, k, hz) => { if (Math.abs(db(duck.value) - k) > 0.05 || Math.abs(lp.frequency.value - hz) > 1) F.push(label + ': ' + db(duck.value).toFixed(1) + ' dB, ' + lp.frequency.value + ' Hz (want ' + k + ' dB, ' + hz + ' Hz)'); };
  pg.at(0, 500, 2); await pg.settle(10); expect('outside', 0, 20000);
  pg.A.params.s[pg.A.params.I.open] = 0;   // (the page's def is the twin 582: an open cockpit by its build)
  pg.cam.mode = 'cockpit'; await pg.settle(10); expect('a closed cockpit', -12, 900);
  pg.A.params.s[pg.A.params.I.open] = 1; await pg.settle(10); expect('an open cockpit', -2, 9000);
  pg.A.params.s[pg.A.params.I.open] = 0;
  pg.A.emit('cabin', { outDb: -20, outLpHz: 600 }); await pg.settle(10); expect('SND-SPACE\'s insulation', -20, 600);
  pg.A.emit('cabin', null); await pg.settle(10); expect('the insulation handed back', -12, 900);
  pg.cam.mode = 'chase'; pg.garage = true; await pg.settle(10); expect('the garage', -6, 2500);
  pg.garage = false; pg.camera.position.x = 1300; pg.camera.position.z = 0; pg.camera.position.y = -3; await pg.settle(40); expect('under water', -3, 350);
  return F;
}
// THE LOADER's class: its own budget, its loop shape (maxS, decim), release, a refusal that can be retried
function checkAmbSamples(S) {
  const F = [];
  const c = { module: { exports: {} }, console: { info() {}, warn() {}, log() {} } };
  vm.runInNewContext(S.samples, c, { filename: 'samples.js' });
  const SM = c.module.exports;
  const mkBuf = (n, sr, f) => { const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = f ? f(i) : 0; return { length: n, numberOfChannels: 1, sampleRate: sr, duration: n / sr, getChannelData: () => d }; };
  const ctx = { currentTime: 0, decodeAudioData: (ab, ok) => { const b = mkBuf(48000 * 32, 48000, i => Math.sin(i * 0.01) * 0.5); ok(b); return Promise.resolve(b); },
    createBuffer: (ch, n, sr) => mkBuf(n, sr), createBufferSource: () => ({ playbackRate: {}, connect() {}, start() {}, stop() {}, disconnect() {} }),
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }) };
  const man = { 'amb.forest.day': ['a'], 'amb.meadow': ['b'], 'amb.stream': ['c'], 'gnd.grass': ['g'] };
  const I = SM.create({ manifest: man, base: '', fetch: () => Promise.resolve(new Uint8Array(8)), budget: 64 * 1048576 });
  I.attach(ctx);
  I.setClass('amb', { budget: 6 * 1048576, maxS: 20, decim: 1 });
  return Promise.all([I.load('amb.forest.day'), I.load('gnd.grass')]).then(([a, g]) => {
    const want = 20 * 48000;
    if (!a || a.length !== want || a.sampleRate !== 48000) F.push('the class loop is ' + (a && a.length) + ' samples at ' + (a && a.sampleRate) + ' Hz (want ' + want + ' at 48000: maxS 20 s)');
    if (I.classBytes('amb') !== want * 4) F.push('the class counts ' + I.classBytes('amb') + ' B (want ' + want * 4 + ': only the baked loop stays)');
    if (!(I.bytes > 0) || I.bytes === I.classBytes('amb')) F.push('the grains and the class share one counter (' + I.bytes + ' / ' + I.classBytes('amb') + ')');
    return I.load('amb.meadow').then(m => {
      if (m !== null || I.state('amb.meadow') !== 'budget') F.push('a second 3.7 MB loop beside the first under a 6 MB class budget read ' + I.state('amb.meadow') + ' (want refused)');
      return I.load('amb.meadow');
    }).then(() => {
      // the forest's 3.7 MB resident of 6 -> the meadow (3.7) refused; the forest released -> it fits
      I.release('amb.meadow');
      if (I.state('amb.meadow') !== 'idle') F.push('a refused key released reads ' + I.state('amb.meadow') + ' (want idle)');
      if (!I.release('amb.forest.day') || I.classBytes('amb') !== 0 || I.state('amb.forest.day') !== 'idle') F.push('release left ' + I.classBytes('amb') + ' B, state ' + I.state('amb.forest.day'));
      return I.load('amb.meadow');
    }).then(m => {
      if (!m) F.push('after a release the meadow still did not fit (' + I.state('amb.meadow') + ')');
      // the potato's shape: half rate
      I.setClass('amb', { budget: 6 * 1048576, maxS: 20, decim: 2 });
      I.release('amb.meadow');
      const p = I.load('amb.stream');
      I.release('amb.stream');   // released while it loads: the result is dropped
      return p.then(r => { if (r !== null || I.classBytes('amb') !== 0) F.push('a release during the load kept ' + I.classBytes('amb') + ' B'); return I.load('amb.stream'); });
    }).then(s => {
      if (!s || s.sampleRate !== 24000 || s.length !== 20 * 24000) F.push('the half-rate loop is ' + (s && s.length) + ' at ' + (s && s.sampleRate) + ' Hz (want 480000 at 24000)');
      // the decimation keeps a low tone and kills a tone above the new Nyquist
      const lo = I.bakeLoop(mkBuf(48000 * 4, 48000, i => Math.sin(2 * Math.PI * 1000 * i / 48000)), { decim: 2 });
      const hi = I.bakeLoop(mkBuf(48000 * 4, 48000, i => Math.sin(2 * Math.PI * 18000 * i / 48000)), { decim: 2 });
      const rms = b => { const d = b.getChannelData(0); let s2 = 0; for (let i = 2000; i < d.length - 2000; i++) s2 += d[i] * d[i]; return Math.sqrt(s2 / (d.length - 4000)); };
      if (!(rms(lo) > 0.6 && rms(hi) < 0.08)) F.push('the half-band decimation: a 1 kHz tone at ' + rms(lo).toFixed(3) + ' rms, 18 kHz at ' + rms(hi).toFixed(3) + ' (want ~0.707 and ~0)');
      const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/viewer/audio/sfx_catalogue.json'), 'utf8')).filter(e => /^amb\./.test(e.key));
      for (const e of cat) if (!SM.KEYS[e.key] || SM.KEYS[e.key].kind !== 'loop') F.push('the bed ' + e.key + ' is not a declared loop');
      return F;
    });
  });
}
// THE WIRING: the build lists the two files after samples.js; AUDIO publishes the world; the ambience is on its bus
function checkAmbWiring(S) {
  const F = [];
  const i0 = S.build.indexOf("'audio/samples.js'"), i1 = S.build.indexOf("'audio/ambience_model.js'"), i2 = S.build.indexOf("'audio/ambience.js'"), i3 = S.build.indexOf("'world_boot.js', 'app.js'");
  if (!(i0 >= 0 && i1 > i0 && i2 > i1 && i3 > i2)) F.push('the build does not list audio/ambience_model.js, audio/ambience.js after samples.js and before app.js');
  const pg = ambPage(S);
  pg.go();
  if (pg.A.world !== pg.world) F.push('AUDIO.update did not publish the world (AUDIO.world)');
  if (!/addSource\('ambience'/.test(S.amb) || !/bus\('ambience'\)/.test(S.amb)) F.push('the source is not the ambience bus\'s');
  return F;
}

// ---- SND-AMB-2 (G1660-G1666): THE POSITIONAL EMITTERS ---------------------------------------------------------------
// The model on the AMB synthetic island (its forest, beach, lake, village zone, meadow) with every key marked ready; the
// page (the real audio.js + samples.js + the ambience + the emitters) on a context with panners. THE MOVERS: a provider
// writing rows like render_premises' soundObjects - a car on a straight road, a tram's two cabins on a jig-back, boats.
// (a model loaded from TEXT in one realm with the ambience's: the mutations are strings)
function emModelOf(S) {
  const c = { module: { exports: {} }, console };
  vm.createContext(c);
  vm.runInContext(S.ambmodel.replace(/if \(typeof module[^\n]*\n?$/, ''), c, { filename: 'ambience_model.js' });
  c.module = { exports: {} };
  vm.runInContext(S.emmodel, c, { filename: 'emitters_model.js' });
  return { M: c.module.exports, AM: c.AMBIENCE_MODEL };
}
// the movers (a provider): opts { car: [x0, z0, vx, vz, period] | null, tram: { a: [x, y, z], b: [x, y, z], v, dwell } | null,
// boats: [[x, z], ...] }; t is the provider's own clock (advanced by the caller); rows like soundObjects'
function emMovers(o) {
  // (allocation-free like soundObjects: EMITALLOC measures the page with it)
  const T = new Float64Array(1), C = new Float64Array(5), TR = new Float64Array(10), B = new Float64Array(2 * (o.boats || []).length);
  if (o.car) C.set(o.car);
  if (o.tram) { const { a, b, v, dwell } = o.tram; TR.set([a[0], a[1], a[2], b[0], b[1], b[2], v, dwell]); }
  (o.boats || []).forEach((q, i) => { B[2 * i] = q[0]; B[2 * i + 1] = q[1]; });
  const hasCar = !!o.car, hasTram = !!o.tram;
  const prov = { T, objects(out) {
    let n = 0; const t = T[0];
    if (hasCar) { const u = C[4] > 0 ? t % C[4] : t, q = n * 6; out[q] = 2; out[q + 1] = C[0] + C[2] * u; out[q + 2] = 20; out[q + 3] = C[1] + C[3] * u; out[q + 4] = Math.sqrt(C[2] * C[2] + C[3] * C[3]); out[q + 5] = 5; n++; }
    if (hasTram) {
      const ex = TR[3] - TR[0], ey = TR[4] - TR[1], ez = TR[5] - TR[2], D = Math.sqrt(ex * ex + ey * ey + ez * ez), v = TR[6], dw = TR[7];
      const run = D / v, cyc = 2 * (run + dw), u = t % cyc;
      // cabin 0: dwell at a, run a -> b, dwell at b, run back; cabin 1 the opposite
      let s0 = 0, mv = 0; if (u < dw) { s0 = 0; } else if (u < dw + run) { s0 = (u - dw) / run; mv = 1; } else if (u < 2 * dw + run) { s0 = 1; } else { s0 = 1 - (u - 2 * dw - run) / run; mv = 1; }
      for (let k = 0; k < 2; k++) { const sk = k ? 1 - s0 : s0, q = n * 6; out[q] = 1; out[q + 1] = TR[0] + ex * sk; out[q + 2] = TR[1] + ey * sk; out[q + 3] = TR[2] + ez * sk; out[q + 4] = mv ? v : 0; out[q + 5] = mv; n++; }
    }
    for (let k = 0; k < B.length; k += 2) { const q = n * 6; out[q] = 3; out[q + 1] = B[k]; out[q + 2] = 0; out[q + 3] = B[k + 1]; out[q + 4] = 0; out[q + 5] = 1; n++; }
    return n;
  } };
  return prov;
}
// a run of the model: { x, z, h (or path(t) -> [x, z, h]), sun, sec, tier, prov, world, gens, ready } -> st (+ st.log, maxV)
function emRun(MM, o) {
  const { M, AM } = MM;
  const W = o.world || ambWorld(), AP = loadParams(SRC0.params), P = AP.audioParamsBlock();
  if (o.sun != null) W.day.sunEl = o.sun;
  const amb = AM.ambienceState(), st = M.emittersState(o.tier || 'full');
  if (o.ready !== false) st.ready.fill(1);
  st.log = []; M.seed(st, o.seed || 7);
  let maxV = 0, overCap = 0;
  const dt = 1 / 60, N = Math.round((o.sec || 600) / dt);
  for (let i = 0; i < N; i++) {
    const t = i * dt;
    const q = o.path ? o.path(t, W) : [o.x, o.z, o.h];
    const g = Math.max(W.terrainH(q[0], q[1]), W.waterH(q[0], q[1]));
    P.s[P.I.listenerX] = q[0]; P.s[P.I.listenerY] = g + q[2]; P.s[P.I.listenerZ] = q[1]; P.s[P.I.inGarage] = o.garage ? 1 : 0;
    if (o.prov) o.prov.T[0] = t;
    AM.ambienceStep(amb, P, W, dt);
    M.emittersStep(st, P, amb, W, o.prov || null, dt, o.gens || null);
    let n = 0; for (let k = 0; k < M.NV; k++) n += st.vOn[k];
    if (n > maxV) maxV = n; if (n > st.cap) overCap++;
    st.vNew.fill(0);
    if (o.each) o.each(st, t, P);
  }
  st.maxV = maxV; st.overCap = overCap; st.W = W; st.amb = amb;
  return st;
}
const emCount = (st, name) => st.log.filter(r => r[1] === name).length;
// THE HABITATS AND THE HOURS: who calls where, and where they are placed
const EM_PLACES = [
  // [name, x, z, h, sun, [[sound, '>=' | '<=', count over 10 min], ...]]
  ['forest by day', -900, -800, 1.7, 40, [['crow', '>=', 8], ['owl', '<=', 0], ['gull', '<=', 0], ['dog', '<=', 0], ['loon', '<=', 0]]],
  ['forest at night', -900, -800, 1.7, -15, [['owl', '>=', 3], ['crow', '<=', 0], ['eagle', '<=', 0], ['gull', '<=', 0]]],
  ['beach by day', 880, 0, 1.7, 40, [['gull', '>=', 8], ['owl', '<=', 0], ['dog', '<=', 0]]],
  ['beach at night', 880, 0, 1.7, -15, [['gull', '<=', 0], ['crow', '<=', 0]]],
  // (near the zone's east edge: half the ring round the listener is outside the village - the dog must not bark there)
  ['village by day', 560, -1000, 1.7, 40, [['dog', '>=', 1], ['dog', '<=', 4], ['door', '>=', 1], ['gull', '<=', 0], ['owl', '<=', 0]]],
  ['village at night', 400, -1000, 1.7, -15, [['dog', '<=', 0], ['door', '<=', 0], ['crow', '<=', 0]]],
  ['meadow, no tree near', 0, 500, 1.7, 40, [['crow', '<=', 0], ['owl', '<=', 0], ['gull', '<=', 0], ['dog', '<=', 0]]],
  ['lake at dusk', AMB_LAKE[0] + AMB_LAKE[2] + 5, AMB_LAKE[1], 1.7, -3, [['loon', '>=', 3], ['gull', '<=', 0]]],
  ['lake at noon', AMB_LAKE[0] + AMB_LAKE[2] + 5, AMB_LAKE[1], 1.7, 50, [['loon', '<=', 0]]],
  ['the garage', -900, -800, 1.7, 40, [['crow', '<=', 0], ['eagle', '<=', 0]], { garage: 1 }],
];
function checkEmHabitat(S) {
  const MM = emModelOf(S), F = [];
  for (const [name, x, z, h, sun, exp, opt] of EM_PLACES) {
    const st = emRun(MM, Object.assign({ x, z, h, sun, sec: 600 }, opt || {}));
    for (const [snd, op, v] of exp) { const n = emCount(st, snd); if (!(op === '>=' ? n >= v : n <= v)) F.push(name + ': ' + snd + ' called ' + n + ' times in 10 min (want ' + op + ' ' + v + ')'); }
    // WHERE: a crow or an owl in a tree (canopy >= 4 m under it) or, a crow, on a roof in the village; a gull over water;
    // a loon on the lake; the dog and the door inside the village zone
    const W = st.W, I = W.island, can = (px, pz) => { const g = I.grid, i = Math.floor((px - g.x0) / g.cell), j = Math.floor((pz - g.z0) / g.cell); const k = j * g.w + i; return I.cover[k] === 10 ? I.canopy[k] : -1; };
    for (const r of st.log) {
      const [, snd, px, py, pz] = r, gnd = W.terrainH(px, pz), wat = W.waterH(px, pz);
      if ((snd === 'owl' || snd === 'crow') && !(can(px, pz) >= 4 || (snd === 'crow' && px >= 200 && px <= 600 && pz >= -1200 && pz <= -800))) { F.push(name + ': a ' + snd + ' called from (' + px + ', ' + pz + ') - no tree there'); break; }
      if (snd === 'gull' && !(wat > gnd)) { F.push(name + ': a gull called over dry land (' + px + ', ' + pz + ')'); break; }
      if (snd === 'loon' && !(Math.hypot(px - AMB_LAKE[0], pz - AMB_LAKE[1]) < AMB_LAKE[2])) { F.push(name + ': a loon called off the lake (' + px + ', ' + pz + ')'); break; }
      if ((snd === 'dog' || snd === 'door') && !(px >= 200 && px <= 600 && pz >= -1200 && pz <= -800)) { F.push(name + ': the ' + snd + ' outside the village (' + px + ', ' + pz + ')'); break; }
      if (snd !== 'eagle' && py - Math.max(gnd, wat) > 45) { F.push(name + ': a ' + snd + ' ' + (py - Math.max(gnd, wat)).toFixed(0) + ' m up'); break; }
    }
  }
  // 300 placings of the dog 40 m inside the village's edge (a third of its ring is outside): every one inside the zone
  {
    const st = emRun(MM, { x: 560, z: -1000, h: 1.7, sun: 40, sec: 2 }), r = MM.M.SPECIES.findIndex(x => x[0] === MM.M.S.dog);
    let out = 0, none = 0;
    for (let k = 0; k < 300; k++) { if (!MM.M.place(st, r, st.amb, st.W)) { none++; continue; } const p = st.pos; if (!(p[0] >= 200 && p[0] <= 600 && p[2] >= -1200 && p[2] <= -800)) out++; }
    if (out) F.push('the dog placed outside the village ' + out + ' times in 300');
    if (none > 150) F.push('the dog found no yard ' + none + ' times in 300 (40 m inside the village)');
  }
  return F;
}
// THE RATES, THE GAPS, THE CAP, THE JITTER, THE DOG: a 2 h random walk with teleports among the places, at every hour
function checkEmRate(S, report) {
  const MM = emModelOf(S), M = MM.M, F = [];
  const spots = [[-900, -800], [880, 0], [400, -1000], [AMB_LAKE[0] + AMB_LAKE[2] + 5, AMB_LAKE[1]], [-400, -200], [880, -600], [400, -1000], [400, -1000]];
  for (const tier of ['full', 'light']) {
    let seed = tier === 'full' ? 11 : 5; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    let cx = 0, cz = 0, nx = 0, sun = 40, villageS = 0;
    const W = ambWorld();
    // (gamer 2 h, the village a third of it: the dog's rate wants village time; potato 40 min: its cap)
    const st = emRun(MM, { tier, sec: tier === 'full' ? 3600 * 2 : 2400, world: W, seed: tier === 'full' ? 3 : 9,
      path: t => { const k = Math.floor(t / 120); if (k !== nx) { nx = k; const s = spots[Math.floor(rnd() * spots.length)]; cx = s[0]; cz = s[1]; sun = rnd() < 0.3 ? -14 : rnd() < 0.2 ? -3 : 35; W.day.sunEl = sun; }
                   return [cx + 15 * Math.sin(t / 9), cz + 15 * Math.cos(t / 11), 1.7]; },
      each: (s, t) => { if (cx === 400 && sun > 1) villageS += 1 / 60; } });
    if (st.overCap) F.push(tier + ': ' + st.overCap + ' frames with more than ' + st.cap + ' one-shots sounding');
    // the gaps: the bursts of one sound (its calls at one time) at least the sound's gap apart
    for (let r = 0; r < M.NSP; r++) {
      const sd = M.SPECIES[r][0], name = M.SOUNDS[sd][0], gap = M.SPECIES[r][2];
      const ts = [...new Set(st.log.filter(x => x[1] === name).map(x => x[0]))];
      for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] < gap - 1e-6) { F.push(tier + ': two ' + name + ' calls ' + (ts[i] - ts[i - 1]).toFixed(2) + ' s apart (its gap ' + gap + ' s)'); break; }
    }
    // the dog: at most one a declared gap (150 s) in the village by day, and it does bark
    const dogs = emCount(st, 'dog'), dogGap = M.SPECIES.find(x => x[0] === M.S.dog)[2];
    if (!(dogs >= 1) && tier === 'full') F.push(tier + ': no dog in ' + Math.round(villageS) + ' s of village by day (the walk proves nothing)');
    if (dogs > villageS / dogGap + 1) F.push(tier + ': ' + dogs + ' barks in ' + Math.round(villageS) + ' s of village by day (the declared rate: <= one a ' + dogGap + ' s)');
    if (dogs > villageS / 150 + 1) F.push(tier + ': the dog is not rare: ' + dogs + ' barks in ' + Math.round(villageS) + ' s (the user: "here and there", <= one a 150 s)');
    if (tier === 'full' && report) report.push('the emitters over 2 h of walk (gamer): ' + M.SOUNDS.filter(x => !x[2]).map(x => x[0] + ' ' + emCount(st, x[0])).join(', ') + '; at most ' + st.maxV + ' at once; the dog ' + dogs + ' in ' + Math.round(villageS) + ' s of village by day');
  }
  // THE CAP, forced: ten calls at once -> exactly `cap` sound, the rest refused
  for (const [tier, cap] of [['full', 6], ['light', 3]]) {
    const st = M.emittersState(tier); st.ready.fill(1);
    let ok = 0; for (let k = 0; k < 10; k++) if (M.fire(st, M.S.gull, -1, 1) >= 0) ok++;
    if (ok !== cap || st.refused[0] !== 10 - cap) F.push(tier + ': 10 calls at once -> ' + ok + ' sound, ' + st.refused[0] + ' refused (want ' + cap + ' and ' + (10 - cap) + ')');
  }
  // THE JITTER: +-1.5 semitones, +-2 dB around the sound's level, spread over the range
  const st = M.emittersState('full'); st.ready.fill(1); M.seed(st, 99);
  const rs = [], gs = [];
  for (let k = 0; k < 400; k++) { const v = M.fire(st, M.S.crow, -1, 1); rs.push(12 * Math.log2(st.vR[v])); gs.push(20 * Math.log10(st.vG[v]) - M.SOUNDS[M.S.crow][3]); st.vOn[v] = 0; }
  const mn = a => Math.min(...a), mx = a => Math.max(...a);
  if (!(mn(rs) >= -1.5 - 1e-9 && mx(rs) <= 1.5 + 1e-9 && mx(rs) - mn(rs) > 2.5)) F.push('the pitch jitter spans ' + mn(rs).toFixed(2) + '..' + mx(rs).toFixed(2) + ' st (want within +-1.5, spread > 2.5)');
  if (!(mn(gs) >= -2 - 1e-9 && mx(gs) <= 2 + 1e-9 && mx(gs) - mn(gs) > 3.3)) F.push('the gain jitter spans ' + mn(gs).toFixed(2) + '..' + mx(gs).toFixed(2) + ' dB (want within +-2, spread > 3.3)');
  return F;
}
// THE CEILING: silent above 150 m AGL - no call, no loop, no pass, wherever, whatever is near; a ground call below
function checkEmAgl(S) {
  const MM = emModelOf(S), M = MM.M, F = [];
  const tram = { a: [-880, 5, -800], b: [-880, 600, 600], v: 6, dwell: 10 };
  for (const h of [150, 220, 400]) for (const [nm, x, z, sun] of [['forest', -900, -800, 40], ['beach', 880, 0, 40], ['village', 400, -1000, 40], ['forest at night', -900, -800, -15]]) {
    const prov = emMovers({ car: [x - 200, z + 10, 12, 0, 40], tram: { a: [x + 20, 5, z], b: [x + 20, 300, z + 1500], v: 6, dwell: 8 }, boats: [[x + 30, z + 30]] });
    const st = emRun(MM, { x, z, h, sun, sec: 300, prov });
    let loops = 0; for (let k = 0; k < M.NL; k++) loops += st.lOn[k];
    if (st.log.length || loops) F.push(nm + ' at ' + h + ' m AGL: ' + st.log.length + ' calls (' + [...new Set(st.log.map(r => r[1]))].join(', ') + '), ' + loops + ' loops on');
  }
  const low = emRun(MM, { x: -900, z: -800, h: 100, sun: 40, sec: 600 }), gnd = emRun(MM, { x: -900, z: -800, h: 1.7, sun: 40, sec: 600 });
  if (!(emCount(gnd, 'crow') > emCount(low, 'crow') && emCount(low, 'crow') >= 0)) F.push('the fade: ' + emCount(gnd, 'crow') + ' crows on the ground vs ' + emCount(low, 'crow') + ' at 100 m (want fewer up there)');
  if (!(low.clk[2] > 0 && low.clk[2] < 1)) F.push('at 100 m AGL the height factor is ' + low.clk[2] + ' (want between 0 and 1: the fade from 60 m)');
  return F;
}
// THE OBJECTS: the pass bound to the car, the tram's bell / hum / creak, the mill by its generator, the boats
function checkEmObjects(S) {
  const MM = emModelOf(S), M = MM.M, F = [];
  // (a) a car along z = 15 at 12 m/s, passing the listener at (0, 0): ONE pass, bound to it, started 2.4-3.6 s before
  {
    const prov = emMovers({ car: [-150, 15, 12, 0, 0] });
    const st = emRun(MM, { x: 0, z: 0, h: 1.7, sun: 40, sec: 24, prov, world: ambWorld(), each: (s, t) => {
      for (let k = 0; k < M.NV; k++) if (s.vOn[k] && s.vS[k] === M.S.pickup) { const cx = -150 + 12 * t; if (Math.abs(s.vX[k] - cx) > 2.5) { s.badFollow = (s.badFollow || 0) + 1; } }
    } });
    const ps = st.log.filter(r => r[1] === 'pickup');
    if (ps.length !== 1) F.push('a car passing 15 m away: ' + ps.length + ' passes (want 1)');
    // (the window is the design's, written here: the recording's pass peaks ~3 s in - not read back from the model)
    else { const tc = 150 / 12 - ps[0][0]; if (!(tc >= 2.25 && tc <= 3.75)) F.push('the pass started ' + tc.toFixed(2) + ' s before the closest approach (want 2.4..3.6)'); }
    if (st.badFollow) F.push('the pass did not ride the car (' + st.badFollow + ' frames more than 2.5 m off it)');
    const far = emRun(MM, { x: 0, z: 0, h: 1.7, sun: 40, sec: 24, prov: emMovers({ car: [-150, 90, 12, 0, 0] }) });
    if (emCount(far, 'pickup')) F.push('a car passing 90 m away called a pass');
  }
  // (b) the tram: a cabin leaving a station 30 m away -> the bell; its hum on while near, louder running; the creak
  {
    const prov = emMovers({ tram: { a: [30, 5, 0], b: [30, 500, 1800], v: 6, dwell: 12 } });
    let gRun = 0, gDock = 1, on = 0;
    const st = emRun(MM, { x: 0, z: 0, h: 1.7, sun: 40, sec: 200, prov, each: (s, t) => {
      for (let k = 0; k < M.NL; k++) if (s.lOn[k] && s.lS[k] === M.S.tramhum) { on++; const u = t % (2 * (Math.hypot(495, 1800) / 6 + 12)); if (u > 13 && u < 40) gRun = Math.max(gRun, s.lG[k]); if (u < 11.5 && t > 1) gDock = Math.min(gDock, s.lG[k]); }
    } });
    const bells = st.log.filter(r => r[1] === 'bell');
    if (!bells.length || Math.abs(bells[0][0] - 12) > 0.3) F.push('the tram leaving the station 30 m away rang ' + bells.length + ' bells' + (bells.length ? ', the first at ' + bells[0][0] + ' s' : '') + ' (want one at its departure, 12 s)');
    if (!on) F.push('no tram hum near a running cabin');
    if (!(gRun > 0.8 && gDock < 0.3)) F.push('the tram hum: ' + gRun.toFixed(2) + ' running, ' + gDock.toFixed(2) + ' docked (want > 0.8 and < 0.3)');
    if (!emCount(st, 'creak')) F.push('no cabin creak in 200 s of a running cabin near');
    // out of reach: the hum goes, the creak stops
    let late = 0; const st2 = emRun(MM, { x: 0, z: 0, h: 1.7, sun: 40, sec: 200, prov, each: (s, t) => { if (t > 150) for (let k = 0; k < M.NL; k++) if (s.lOn[k] && s.lS[k] === M.S.tramhum && s.lG[k] > 0.01) late++; } });
    if (late) F.push('the tram hum still on ' + (late / 60).toFixed(1) + ' s while both cabins are out of reach');
    if (st2.log.some(r => r[1] === 'creak' && r[0] > 150)) F.push('a creak from a cabin out of reach');
  }
  // (c) the mill: a record whose site's generator preset says P.mill -> a loop within reach, by day; none at night / far
  {
    const W = ambWorld();
    W.premises.rec.layers.sites = [{ id: 'mine', at: { x: 0, z: 300, yaw: 0 }, items: [{ id: 'm', key: 'house/kennecott mill', x: 10, z: 0 }, { id: 'c', key: 'house/mine cottage', x: 60, z: 0 }] }];
    const gens = { HOUSE_GEN: { PRESETS: { 'kennecott mill': { mill: 1 }, 'mine cottage': {} } } };
    const loopOf = st => { let g = 0; for (let k = 0; k < M.NL; k++) if (st.lOn[k] && st.lS[k] === M.S.mill) g = Math.max(g, st.lG[k]); return g; };
    const day = emRun(MM, { x: 0, z: 100, h: 1.7, sun: 30, sec: 5, world: W, gens });
    if (!(loopOf(day) > 0.9)) F.push('the mill 200 m away by day: its loop at ' + loopOf(day).toFixed(2) + ' (want on)');
    if (day.anc.length !== 3) F.push('the mill: ' + day.anc.length / 3 + ' anchors from the record (want 1: the mill, not the cottage)');
    else if (Math.abs(day.anc[0] - 10) > 0.01 || Math.abs(day.anc[2] - 300) > 0.01) F.push('the mill anchored at (' + day.anc[0] + ', ' + day.anc[2] + ') (want its item: (10, 300))');
    const night = emRun(MM, { x: 0, z: 100, h: 1.7, sun: -20, sec: 5, world: W, gens });
    let nOn = 0; for (let k = 0; k < M.NL; k++) if (night.lOn[k] && night.lS[k] === M.S.mill) nOn++;
    if (nOn || night.want[M.S.mill]) F.push('the mill at night: its loop ' + (nOn ? 'on' : 'off') + ', its sound ' + (night.want[M.S.mill] ? 'wanted' : 'not wanted') + ' (want neither: nothing made at night)');
    const far = emRun(MM, { x: 0, z: -400, h: 1.7, sun: 30, sec: 5, world: W, gens });
    if (loopOf(far) > 0.01) F.push('the mill 700 m away: its loop on');
    const none = emRun(MM, { x: 0, z: 100, h: 1.7, sun: 30, sec: 5, world: W, gens: { HOUSE_GEN: { PRESETS: {} } } });
    if (none.anc.length) F.push('a preset without P.mill made a mill (the generator declares, not the record\'s key)');
  }
  // (d) the boats: by day an outboard now and then near them; at night none; far none
  {
    const boatOn = st => st.log.filter(r => r[1] === 'boat:on').length;
    const prov = () => emMovers({ boats: [[900, 40], [905, 52]] });
    const d = emRun(MM, { x: 880, z: 0, h: 1.7, sun: 30, sec: 900, prov: prov() });
    if (!(boatOn(d) >= 2 && boatOn(d) <= 900 / M.BOAT.gap + 1)) F.push('boats 50 m away by day: ' + boatOn(d) + ' outboard episodes in 15 min (want 2..' + Math.floor(900 / M.BOAT.gap + 1) + ')');
    const n = emRun(MM, { x: 880, z: 0, h: 1.7, sun: -20, sec: 600, prov: prov() });
    if (boatOn(n)) F.push('an outboard at night (' + boatOn(n) + ')');
    const f = emRun(MM, { x: 880, z: -600, h: 1.7, sun: 30, sec: 400, prov: prov() });
    if (boatOn(f)) F.push('an outboard from boats 640 m away');
  }
  return F;
}
// the page: the real audio.js, samples.js, the ambience and the emitters; a context with panners and buffers
function emPage(S, o) {
  o = o || {};
  const R = { fetch: 0, decode: 0, sources: [], panners: [], buffers: 0 };
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/viewer/audio/sfx_catalogue.json'), 'utf8'));
  const media = {}; for (const e of cat) (media[e.key] = media[e.key] || []).push(e.file);
  const dur = {}; for (const e of cat) dur[e.file] = e.durationS;
  const mkBuf = (n, sr, d) => { const a = d || new Float32Array(n); return { length: n, numberOfChannels: 1, sampleRate: sr, duration: n / sr, getChannelData: () => a, copyToChannel(y) { a.set(y); } }; };
  const prov = o.movers || null;
  const pg = makePage(S, Object.assign({ quiet: true, search: o.search || '',
    before: w => { w.FLYDIY_AUDIO_MEDIA = media; w.FLYDIY_ASSET_BASE = ''; w.ASSET_FETCH = u => { R.fetch++; return Promise.resolve(new Uint8Array(Math.max(1, Math.round((dur[u] || 1) * 100)))); };
                   w.GFX = { get: () => ({ preset: o.tier || 'gamer' }) };
                   if (prov) w.WORLD = { premises: { soundObjects: out => prov.objects(out) } };
                   if (o.before) o.before(w); },
    after: [[S.samples, 'samples.js'], [S.spcfg, 'space_config.js'], [S.ambmodel, 'ambience_model.js'], [S.amb, 'ambience.js'], [S.emmodel, 'emitters_model.js'], [S.em, 'emitters.js']],
    ctx: (proto, C) => {
      const prm = v => ({ value: v, setTargetAtTime(x) { this.value = x; C.sched++; }, setValueAtTime(x) { this.value = x; C.sched++; },
                          cancelScheduledValues() {}, linearRampToValueAtTime(x) { this.value = x; C.sched++; } });
      proto.createGain = function () { C.nodes++; return { gain: prm(1), connect(n) { this.to = n; }, disconnect() {} }; };
      proto.createBiquadFilter = function () { C.nodes++; return { type: '', frequency: prm(20000), Q: prm(1), connect(n) { this.to = n; }, disconnect() {} }; };
      proto.createPanner = function () { C.nodes++; const p = { positionX: prm(0), positionY: prm(0), positionZ: prm(0), connect(n) { this.to = n; }, disconnect() {} }; R.panners.push(p); return p; };
      proto.createBuffer = (ch, n, sr) => { R.buffers++; return mkBuf(n, sr); };
      proto.createBufferSource = function () { C.nodes++; const s = { buffer: null, loop: false, playbackRate: prm(1), connect(n) { this.to = n; }, disconnect() {}, start(t) { this.on = 1; this.t0 = t; }, stop() { this.on = 0; } }; R.sources.push(s); return s; };
      // (the decoded length is the catalogue's: the fetch encoded the file's seconds in its byte count)
      proto.decodeAudioData = function (ab, ok) { R.decode++; const b = mkBuf(Math.round(ab.byteLength / 100 * 48000), 48000); if (ok) ok(b); return Promise.resolve(b); };
    } }, o.page || {}));
  if (!(o.page && o.page.noGesture)) pg.gesture('pointerdown');
  const fb = FLOWN[5];
  pg.sim = stubSim(fb, { mains: [true, true], tw: false, water: false }); pg.def = fb.def;
  pg.camera = { position: { x: 0, y: 22, z: 500 }, matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } }; pg.cam = { mode: 'chase' };
  pg.R = R; pg.prov = prov;
  pg.world = o.world || ambWorld();
  if (o.sun != null) pg.world.day.sunEl = o.sun;
  let clk = 0;
  pg.go = () => { clk += 1 / 60; if (prov) prov.T[0] = clk; pg.A.update(pg.sim, pg.camera, 1 / 60, pg.def, pg.cam, !!pg.garage, pg.world); };
  pg.settle = async n => { for (let i = 0; i < n; i++) { pg.go(); if (i % 4 === 0) { await null; pg.runTimers(); } } for (let i = 0; i < 8; i++) await null; };
  pg.at = (x, z, h) => { const W = pg.world; pg.camera.position.x = x; pg.camera.position.z = z; pg.camera.position.y = Math.max(W.terrainH(x, z), W.waterH(x, z)) + h; };
  return pg;
}
// NOTHING BEFORE THE GESTURE, nothing before a frame, nothing near nothing; ?audio=0 builds no emitters
async function checkEmGesture(S) {
  const F = [];
  const pg = emPage(S);
  if (!pg.win.EMITTERS) return ['the emitters did not register (window.EMITTERS absent)'];
  if (pg.R.fetch || pg.R.decode || pg.R.buffers) F.push('the gesture fetched ' + pg.R.fetch + ' / decoded ' + pg.R.decode + ' / made ' + pg.R.buffers + ' buffers before any frame');
  const urls = []; const f0 = pg.win.ASSET_FETCH; pg.win.ASSET_FETCH = u => { urls.push(u); return f0(u); };
  // nothing near: 500 m over the forest - no emitter key fetched, no source, no buffer made
  pg.at(-900, -800, 500); await pg.settle(600);
  const emKeys = /bird_|dog_|mech_door|vehicle_|animal_|mill_|tram_|boat_/;
  if (urls.some(u => emKeys.test(u)) || pg.R.sources.some(s => s.buffer && !s.loop && s.buffer.length < 48000 * 3)) F.push('500 m up, nothing near: the emitters fetched ' + urls.filter(u => emKeys.test(u)).length + ' files');
  if (pg.win.EMITTERS.procBytes()) F.push('500 m up: a procedural buffer was made (' + pg.win.EMITTERS.procBytes() + ' B)');
  // down in the forest by day: the crow's key is fetched after the frames began
  pg.at(-900, -800, 1.7); await pg.settle(300);
  if (!urls.some(u => /bird_crow/.test(u))) F.push('4 s in the forest by day and the crow was not fetched');
  const pre = makePage(S, { quiet: true, before: w => { w.ASSET_FETCH = () => { F.push('a fetch before the gesture'); return Promise.resolve(new Uint8Array(1)); }; w.FLYDIY_AUDIO_MEDIA = { 'bird.crow': ['c.mp3'] }; },
    after: [[S.samples, 'samples.js'], [S.ambmodel, 'ambience_model.js'], [S.amb, 'ambience.js'], [S.emmodel, 'emitters_model.js'], [S.em, 'emitters.js']] });
  const b = FLOWN[5], sim = stubSim(b, { mains: [true, true], tw: false, water: false }), W = ambWorld(), cam = { position: { x: -900, y: 21.7, z: -800 } };
  for (let i = 0; i < 600; i++) pre.A.update(sim, cam, 1 / 60, b.def, { mode: 'chase' }, false, W);
  for (let i = 0; i < 8; i++) await null;
  if (pre.C.ctx !== 0) F.push('a context before the gesture (' + pre.C.ctx + ')');
  const off = makePage(S, { quiet: true, search: '?audio=0', after: [[S.samples, 'samples.js'], [S.ambmodel, 'ambience_model.js'], [S.amb, 'ambience.js'], [S.emmodel, 'emitters_model.js'], [S.em, 'emitters.js']] });
  if (off.win.EMITTERS) F.push('?audio=0 built the emitters');
  return F;
}
// THE PAGE PLAYS WHAT THE MODEL SAYS: a call starts a buffer source at its place (the panner in the camera's frame), the
// pass rides its car with the doppler (up approaching, down receding), a loop plays the procedural buffer, the muffle
async function checkEmPlay(S) {
  const F = [];
  const prov = emMovers({ car: [-200, 15, 14, 0, 0], tram: { a: [40, 5, 0], b: [40, 600, 2000], v: 6, dwell: 6 } });
  const pg = emPage(S, { movers: prov, sun: 40 });
  pg.at(0, 0, 1.7);
  const E = pg.win.EMITTERS, M = E.model;
  // the camera turned: looking down +x (right +z, back -x): a source ahead on +x sits at -Z in the camera's frame
  pg.camera.matrixWorld.elements = [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1];
  const rates = [];
  for (let i = 0; i < 60 * 24; i++) { pg.go(); if (i % 4 === 0) { await null; pg.runTimers(); }
    const st = E.state; for (let k = 0; k < M.NV; k++) if (st.vOn[k] && st.vS[k] === M.S.pickup && st.vF[k] >= 0) { const s = pg.R.sources.filter(x => x.buffer && !x.loop).pop(); rates.push([i / 60, s ? s.playbackRate.value / st.vR[k] : 1, st.vX[k]]); } }
  if (!rates.length) F.push('the car passed and no pass played');
  else {
    const before = rates.filter(r => r[2] < -20), after = rates.filter(r => r[2] > 20);
    if (!before.length || !after.length) F.push('the pass did not span the car\'s approach and its leaving (' + before.length + ' / ' + after.length + ' frames)');
    else if (!(Math.max(...before.map(r => r[1])) > 1.01 && Math.min(...after.map(r => r[1])) < 0.99)) F.push('no doppler on the pass: x' + Math.max(...before.map(r => r[1])).toFixed(3) + ' approaching, x' + Math.min(...after.map(r => r[1])).toFixed(3) + ' leaving (want > 1.01 and < 0.99)');
  }
  // the tram's hum: a looping source on its RECORDED loop (G1667: tram.hum, the coordinator's CC0 file; it was procedural),
  // its bell a recorded one-shot
  const loops = pg.R.sources.filter(s => s.loop && s.buffer);
  if (!loops.length) F.push('no loop played by the tram running 40 m away');
  if (E.resident(M.S.tramhum) !== 2) F.push('the tram hum (recorded) is not loaded (resident ' + E.resident(M.S.tramhum) + ')');
  // a static call placed in the camera's frame: the bell (made: the tram is near) straight ahead (+x, 50 m) -> the
  // panner at (0, 0, -50)
  const st = E.state;
  if (E.resident(M.S.bell) !== 2) F.push('the tram\'s bell was not made (resident ' + E.resident(M.S.bell) + ')');
  for (let k = 0; k < M.NV; k++) st.vT1[k] = 0;
  pg.go();
  st.pos[0] = 50; st.pos[1] = st.L[1]; st.pos[2] = 0;
  const v = M.fire(st, M.S.bell, -1, 1); pg.go();
  const pan = pg.R.panners[v];
  if (!(pan && Math.abs(pan.positionX.value) < 0.5 && Math.abs(pan.positionZ.value + 50) < 0.5)) F.push('a call 50 m ahead placed at (' + (pan ? [pan.positionX.value, pan.positionY.value, pan.positionZ.value].map(q => q.toFixed(1)).join(', ') : '-') + ') in the camera\'s frame (want (0, 0, -50))');
  // the muffle: a closed cockpit ducks the emitters (-12 dB, 900 Hz)
  pg.A.params.s[pg.A.params.I.open] = 0; pg.cam.mode = 'cockpit'; await pg.settle(4);
  const duck = pg.R.panners.length ? pg.R.panners[0].to.to.to : null;   // panner -> emIn -> emLP -> emDuck
  if (!(duck && duck.gain && Math.abs(20 * Math.log10(duck.gain.value) + 12) < 0.1)) F.push('a closed cockpit: the emitters at ' + (duck && duck.gain ? (20 * Math.log10(duck.gain.value)).toFixed(1) : '?') + ' dB (want -12)');
  return F;
}
// THE BUDGET: the emitters' decoded one-shots under the tier's class budget; released when long unwanted
async function checkEmBudget(S, report) {
  const F = [];
  for (const [tier, budget] of [['gamer', 8 * 1048576], ['potato', 3 * 1048576]]) {
    // decoded one-shots at their catalogue length (a crow is 0.39 s, a gull 6 s): the budget is real
    const pg = emPage(S, { tier, sun: 40 });
    const SM = pg.win.AUDIO_SAMPLES, E = pg.win.EMITTERS;
    let maxB = 0, drops = 0, lastB = 0, over = 0;
    const spots = [[-900, -800, 40], [880, 0, 40], [400, -1000, 40], [-900, -800, -15], [AMB_LAKE[0] + AMB_LAKE[2] + 5, AMB_LAKE[1], -3], [0, 500, 40]];
    for (let f = 0; f < 60 * 450; f++) {
      if (f % (60 * 75) === 0) { const s = spots[(f / (60 * 75)) % spots.length]; pg.at(s[0], s[1], 1.7); pg.world.day.sunEl = s[2]; }
      pg.go();
      if (f % 4 === 0) { await null; pg.runTimers(); }
      const by = SM.classBytes('emit');
      if (by > maxB) maxB = by; if (by < lastB) drops++; lastB = by;
      if (by > budget) over++;
    }
    if (over) F.push(tier + ': ' + (maxB / 1048576).toFixed(2) + ' MB decoded in the emitters\' class (the budget ' + budget / 1048576 + ' MB)');
    if (!(maxB > 0)) F.push(tier + ': nothing decoded over 10 min of walk (the budget is untested)');
    if (drops < 1) F.push(tier + ': the emitters\' bytes never went down (nothing released in 7.5 min)');
    if (SM.classBytes('amb') && SM.classOf('dog') === SM.classOf('amb.forest.day')) F.push(tier + ': the dog shares the beds\' class');
    // nothing wanted (500 m up) for 70 s: every key released after its 60 s (G1705: the room's releases do not stand in)
    pg.at(-900, -800, 500);
    for (let f = 0; f < 60 * 70; f++) { pg.go(); if (f % 4 === 0) { await null; pg.runTimers(); } }
    if (SM.classBytes('emit')) F.push(tier + ': 70 s with nothing wanted and ' + (SM.classBytes('emit') / 1048576).toFixed(2) + ' MB still decoded (want all released after 60 s)');
    if (report) report.push('the emitters on ' + tier + ': peak ' + (maxB / 1048576).toFixed(2) + ' / ' + budget / 1048576 + ' MB decoded (one-shots), ' + drops + ' releases in 7.5 min, procedural ' + (E.procBytes() / 1024).toFixed(0) + ' KB');
  }
  return F;
}
// ALLOCATION: AUDIO.update with the emitters - a walk past a running tram and a passing car, calls firing - measured
// against its TWIN, the same page and walk without the emitters (the page's own frame - the ambience, the stubs - is
// not the emitters'): the difference within the scheduled params' boxes (48 B each) and the calls' own cost (4 KB each:
// a call is an EVENT - its buffer source and the stub's record of it, its placing in the world through the world's
// samplers and the random, code that runs a few times a minute and so boxes); then, nothing near, nothing scheduled
async function emAllocPage(S, withEm) {
  let tick = 0;
  const prov = emMovers({ car: [-300, 20, 14, 0, 45], tram: { a: [-700, 5, -260], b: [-700, 500, 1500], v: 6, dwell: 8 } });
  const pg = emPage(withEm ? S : Object.assign({}, S, { em: '' }), { movers: prov, sun: 40, page: { clock: () => ++tick } });
  const cp = pg.camera.position;
  pg.edge = f => { const u = (f % 1200) / 1200, a = u < 0.5 ? 2 * u : 2 - 2 * u; cp.x = -720; cp.z = -260 + 300 * a; cp.y = 21.7; pg.go(); };
  for (let f = 0; f < 60 * 120; f++) { pg.edge(f); if (f % 8 === 0) { await null; pg.runTimers(); } }
  return pg;
}
async function emAllocMeasure(pg) {
  let best = null;
  for (let w = 0; w < 3; w++) {
    global.gc(); global.gc(); await new Promise(r => setTimeout(r, 5));
    let g = 0; const obs = new PerformanceObserver(l => { g += l.getEntries().length; }); obs.observe({ entryTypes: ['gc'] });
    const s0 = pg.C.sched, n0 = pg.R.sources.length, h0 = process.memoryUsage().heapUsed;
    for (let f = 0; f < 10000; f++) pg.edge(f);
    const d = process.memoryUsage().heapUsed - h0, sc = pg.C.sched - s0, cl = pg.R.sources.length - n0;
    await new Promise(r => setTimeout(r, 5)); obs.disconnect();
    const m = { d, g, sc, cl, net: d - 48 * sc - 4096 * cl };
    if (!best || m.g < best.g || (m.g === best.g && m.net < best.net)) best = m;
  }
  return best;
}
async function checkEmAlloc(S, report) {
  const F = [];
  const pg = await emAllocPage(S, true), A = await emAllocMeasure(pg);
  const B = await emAllocMeasure(await emAllocPage(S, false));
  // the emitters' own: what the page with them allocates over its twin, less their params' boxes and their calls' nodes
  const own = A.d - B.d - 48 * Math.max(0, A.sc - B.sc) - 4096 * A.cl;
  if (A.g > B.g || own > 16384) F.push('the emitters allocate in AUDIO.update: ' + ((A.d - B.d) / 10000).toFixed(1) + ' B a frame over the page without them (' + A.d + ' vs ' + B.d + ' B, ' + A.g + ' vs ' + B.g + ' GC; ' + (A.sc - B.sc) + ' params and ' + A.cl + ' calls of theirs allow ' + (48 * Math.max(0, A.sc - B.sc) + 4096 * A.cl) + ' B + 16 KB)');
  if (!(A.sc - B.sc >= 20 && A.cl >= 3)) F.push('the window scheduled ' + (A.sc - B.sc) + ' params of the emitters\' and started ' + A.cl + ' calls (want >= 20 and >= 3: else the walk proves nothing)');
  // nothing near (500 m up), settled: 3000 frames move nothing and start nothing of the emitters'
  const cp = pg.camera.position;
  cp.y = 600; for (let f = 0; f < 60 * 20; f++) { pg.go(); if (f % 8 === 0) { await null; pg.runTimers(); } }
  const E = pg.win.EMITTERS, st = E.state;
  let on = 0; for (let k = 0; k < st.lOn.length; k++) on += st.lOn[k];
  const s0 = pg.R.panners.map(p => p.positionX.value + p.positionZ.value), n0 = pg.R.sources.length;
  for (let f = 0; f < 3000; f++) pg.go();
  const moved = pg.R.panners.filter((p, i) => p.positionX.value + p.positionZ.value !== s0[i]).length;
  if (on || moved || pg.R.sources.length !== n0) F.push('nothing near: ' + on + ' loops on, ' + moved + ' panners moved, ' + (pg.R.sources.length - n0) + ' sources started over 3000 frames (want none)');
  // a STILL listener in the forest by day, calls sounding (static: placed once) and a mill's loop 150 m off (its generator's
  // P.mill): the emitters schedule only at a call's start (its place, its gain: <= 6 params a call) - never a sounding
  // call's panner again, nor a still loop's
  {
    const W = ambWorld();
    W.premises.rec.layers.sites = [{ id: 'mine', at: { x: -900, z: -650, yaw: 0 }, items: [{ id: 'm', key: 'house/kennecott mill', x: 0, z: 0 }] }];
    const q = emPage(S, { sun: 40, world: W, before: w => { w.HOUSE_GEN = { PRESETS: { 'kennecott mill': { mill: 1 } } }; } });
    q.at(-900, -800, 1.7);
    await q.settle(60 * 40);
    const s0 = q.C.sched, n0 = q.R.sources.length;
    let on = 0;
    for (let f = 0; f < 60 * 60; f++) { q.go(); if (f % 8 === 0) { await null; q.runTimers(); } const st = q.win.EMITTERS.state; for (let k = 0; k < st.vOn.length; k++) on += st.vOn[k]; }
    const sc = q.C.sched - s0, calls = q.R.sources.length - n0;
    let mill = 0; const st = q.win.EMITTERS.state; for (let k = 0; k < st.lOn.length; k++) if (st.lOn[k] && st.lS[k] === q.win.EMITTERS.model.S.mill) mill++;
    if (!mill) F.push('a still listener 150 m from a mill: its loop is not on (the check proves nothing)');
    if (!(calls >= 2 && on > 60)) F.push('a minute in the forest by day: ' + calls + ' calls (want some: the check proves nothing)');
    else if (sc > 6 * calls + 4) F.push('a still listener: ' + sc + ' params scheduled for ' + calls + ' static calls in a minute (want <= ' + (6 * calls + 4) + ': placed once, at their start)');
  }
  if (report) report.push('the emitters in AUDIO.update: ' + ((A.d - B.d) / 10000).toFixed(2) + ' B a frame over the page without them (' + (A.sc - B.sc) + ' params, ' + A.cl + ' calls in the window; their own after those: ' + (own / 10000).toFixed(2) + ' B a frame), ' + A.g + ' GC');
  return F;
}
// THE WIRING: the build order; the source on the ambience bus; the premises renderer publishes its read-only accessor
function checkEmWiring(S) {
  const F = [];
  const i1 = S.build.indexOf("'audio/ambience.js'"), i2 = S.build.indexOf("'audio/emitters_model.js'"), i3 = S.build.indexOf("'audio/emitters.js'"), i4 = S.build.indexOf("'world_boot.js', 'app.js'");
  if (!(i1 >= 0 && i2 > i1 && i3 > i2 && i4 > i3)) F.push('the build does not list audio/emitters_model.js, audio/emitters.js after the ambience and before app.js');
  if (!/addSource\('emitters'/.test(S.em) || !/bus\('ambience'\)/.test(S.em)) F.push('the emitters are not the ambience bus\'s source');
  if (!/\n    soundObjects,/.test(S.prem) || !/function soundObjects\(out\)/.test(S.prem)) F.push('render_premises does not publish soundObjects (the movers\' read-only accessor)');
  // every shipped emitter key is declared a one-shot and is one of the model's sounds; every recorded sound has its file but the loon
  const c = { module: { exports: {} }, console: { info() {}, warn() {}, log() {} } };
  vm.runInNewContext(S.samples, c, { filename: 'samples.js' });
  const SM = c.module.exports, { M } = emModelOf(S);
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/viewer/audio/sfx_catalogue.json'), 'utf8'));
  for (const sd of M.SOUNDS) if (sd[1]) {
    // a one-shot sound must be a declared one-shot, a recorded LOOP (the tram's hum, the idling boat: G1667) a declared loop
    const want = sd[2] === 1 ? 'loop' : 'oneshot';
    if (!SM.KEYS[sd[1]] || SM.KEYS[sd[1]].kind !== want) F.push(sd[1] + ' is not a declared ' + (want === 'loop' ? 'loop' : 'one-shot') + ' in samples.js');
    if (!cat.some(e => e.key === sd[1])) F.push(sd[1] + ' has no file in the catalogue');   // (the loon ships since G1667)
  }
  return F;
}
// THE LOADER's one-shot class: kept decoded (no loop baked), under its budget, assigned keys
function checkEmSamples(S) {
  const F = [];
  const c = { module: { exports: {} }, console: { info() {}, warn() {}, log() {} } };
  vm.runInNewContext(S.samples, c, { filename: 'samples.js' });
  const SM = c.module.exports;
  const mkBuf = (n, sr) => { const d = new Float32Array(n); return { length: n, numberOfChannels: 1, sampleRate: sr, duration: n / sr, getChannelData: () => d }; };
  const ctx = { currentTime: 0, decodeAudioData: (ab, ok) => { const b = mkBuf(48000 * 6, 48000); ok(b); return Promise.resolve(b); }, createBuffer: (ch, n, sr) => mkBuf(n, sr) };
  const I = SM.create({ manifest: { dog: ['d'], 'bird.gull': ['g'], 'mech.creak': ['c'] }, base: '', fetch: () => Promise.resolve(new Uint8Array(8)) });
  I.attach(ctx);
  I.setClass('emit', { budget: 2 * 1048576 }); I.assign('dog', 'emit'); I.assign('bird.gull', 'emit');
  return I.load('dog').then(b => {
    if (!b || b.length !== 48000 * 6) F.push('the dog in the one-shot class came back ' + (b && b.length) + ' samples (want its 6 s decoded as is)');
    if (I.classBytes('emit') !== 48000 * 6 * 4) F.push('the one-shot class counts ' + I.classBytes('emit') + ' B (want ' + 48000 * 6 * 4 + ')');
    return I.load('bird.gull');
  }).then(g => {
    if (g !== null || I.state('bird.gull') !== 'budget') F.push('a second 1.1 MB shot under a 2 MB class read ' + I.state('bird.gull') + ' (want refused)');
    I.release('dog');
    if (I.classBytes('emit') !== 0) F.push('the dog released left ' + I.classBytes('emit') + ' B');
    return I.load('mech.creak');
  }).then(() => {
    if (I.classBytes('emit') !== 0 || !(I.bytes > 0)) F.push('the airframe\'s creak (unassigned) counted in the emitters\' class');
    return F;
  });
}

// ---- SND-ANIMALS (G1705-G1709): THE ANIMALS' VOICES ------------------------------------------------------------------
// The rigged animals of G498, live, through animal_run.js's read-only reader (sound(out, since): per individual its species,
// its head / blowhole, velocity, state, the BLOW and CALL events since the last read, its herd) into the emitters' model.
// The REAL behaviours run where the check is about what the animals do (the dive cycle's surfacings, the clip machine's
// call opportunities, a flock's track): tools/audio/animal_world.js loads the page's animals layer on three and the
// shipped payload (GATE ANIMALS' own context). The rates are measured on SYNTHETIC herds (rows written like the reader's,
// CALL events at the clip machine's measured rate), over hours, which the real layer would take minutes to run.
//   ANIMAP    every species the table ships (tools/animals_table.py) is in the reader's vocabulary and maps to an ANIMALS row
//             whose sound is a catalogue key, a declared one-shot and the emitters' own (OWN); the varied thrush a forest
//             species; render_premises publishes the reader (animalSounds, animalClock) and the emitters' provider reads it
//   ANIBLOW   a pod of five orcas and a whale circling off a floatplane on the water (the real dive cycle, 10 min): every
//             surfacing within reach blows EXACTLY once, at its blowhole, in the frame the plume is fired; no blow that is
//             not a surfacing, none submerged; beyond 600 m no orca; a whale at ~1.1 km on calm water blows, in 15 m/s of
//             wind it does not (the calm)
//   ANIELK    a herd of six (synthetic, 1 h a run): at dusk 20-60 bugles, never two of the herd within its 40 s gap, the
//             mean gap >= 60 s; at noon fewer than half of dusk's; 1300 m away heard, 1700 m not; two herds both call; the
//             REAL herd (15 min at dusk): every bugle in the frame of a call opportunity, at that elk's head
//   ANILAND   the bear: heard at 100 m, rarely (gaps >= 60 s), never at 200 m; 30 low passes (20 m AGL, over it) startle it
//             4-24 times (40 %), 30 passes at 120 m none; the doe: bleats at 100 m (gaps >= 45 s), none at 200 m
//   ANIGULL   the REAL placed flock circling overhead: 10-60 calls in 10 min, >= 6 s apart; each call rides a bird of the
//             flock (within 2 m of one every frame it sounds); none at night; the ambient flocks call as they cross
//   ANIMILL   the page near the Kennecott mill: the loop slot plays the RECORDED mill.stamp, baked uncut (its 6.4 s
//             period: onset to onset, no crossfade), no procedural buffer made; without the file the procedural rumble
//   ANIPLAY   the page with a pod and a flock (a synthetic provider through window.WORLD.premises.animalSounds): nothing of
//             the animals fetched while they are 3 km off; near, the orca's breath plays at 0.82 x (+-0.5 st), placed at
//             its blowhole in the camera's frame; 20 blows never repeat a variant at once; a gull's call rides its bird
//             (its panner moves) with the doppler on its rate
//   ANIALLOC  the reader over the island's whole cast (34 + 2 ambient flocks): 10 000 reads allocate nothing (0 GC, < 2 KB);
//             the model's animals over 10 000 frames of recorded rows against its twin without them: within the calls'
//             allowance, 0 GC more; its cost per frame reported
const AW_ = require(path.join(ROOT, 'tools', 'audio', 'animal_world.js'));
const ANI_CACHE = {};
async function aniLayer(S) { if (ANI_CACHE.t !== S.anirun) { ANI_CACHE.t = S.anirun; ANI_CACHE.L = await AW_.load({ runText: S.anirun }); } return ANI_CACHE.L; }
const aniSpeciesOf = S => { const m = /SPECIES: \[([^\]]*)\]/.exec(S.anirun); return m ? m[1].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean) : []; };
const aniWater = W => (x, z) => { const w = W.waterH(x, z); return w > -1e8 ? w : -Infinity; };
// a synthetic provider: rows like the reader's. list: [{ sp, herd, x, y, z, vx, vy, vz, state, rate (CALL /s), blowEvery (s),
// up (s surfaced after a blow), len, move(a, t) }]
function aniSynth(list, seed) {
  let s = (seed >>> 0) || 1; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const T = new Float64Array(1), ev = new Float64Array(list.length).fill(-1), up = new Float64Array(list.length).fill(-1e9);
  return { list, T,
    tick(dt) { T[0] += dt; for (let i = 0; i < list.length; i++) { const a = list[i];
      if (a.move) a.move(a, T[0]);
      if (a.rate > 0 && rnd() < a.rate * dt) ev[i] = T[0];
      if (a.blowEvery > 0 && Math.floor(T[0] / a.blowEvery) !== Math.floor((T[0] - dt) / a.blowEvery)) { ev[i] = T[0]; up[i] = T[0]; }
      if (a.blowEvery > 0) a.state = T[0] - up[i] < (a.up || 3) ? 2 : 3; } },
    sound(out) { let n = 0; for (let i = 0; i < list.length && (n + 1) * 12 <= out.length; i++) { const a = list[i], q = n * 12;
      out[q] = a.sp; out[q + 1] = a.x; out[q + 2] = a.y; out[q + 3] = a.z; out[q + 4] = a.vx || 0; out[q + 5] = a.vy || 0; out[q + 6] = a.vz || 0;
      out[q + 7] = a.state || 0; out[q + 8] = ev[i]; out[q + 9] = a.herd; out[q + 10] = 1; out[q + 11] = a.len || 2; n++; } return n; },
    clock: () => T[0] };
}
// the model with an animal provider: o { R (tick / sound / clock), species, sec, dt, path(t) -> [x, y | null (1.7 m up), z],
// sun, wind, world, seed, each(st, t, n0) } -> st (+ st.log)
function aniRun(MM, o) {
  const { M, AM } = MM;
  const W = o.world || ambWorld({ wind: o.wind });
  if (o.wind != null) W.windMs = o.wind;
  W.day.sunEl = o.sun != null ? o.sun : 40;
  const AP = loadParams(SRC0.params), P = AP.audioParamsBlock();
  const amb = AM.ambienceState(), st = M.emittersState(o.tier || 'full');
  st.ready.fill(1); st.log = []; M.seed(st, o.seed || 7);
  const R = o.R, sp = o.species;
  const prov = { animals: out => R.sound(out), animalClock: () => R.clock(), animalSpecies: () => sp };
  const dt = o.dt || 0.1, N = Math.round(o.sec / dt);
  let maxV = 0;
  for (let i = 0; i < N; i++) {
    const t = (i + 1) * dt;
    R.tick(dt);
    const q = o.path(t);
    const g = Math.max(W.terrainH(q[0], q[2]), W.waterH(q[0], q[2]));
    P.s[P.I.listenerX] = q[0]; P.s[P.I.listenerY] = q[1] != null ? q[1] : g + 1.7; P.s[P.I.listenerZ] = q[2];
    AM.ambienceStep(amb, P, W, dt);
    const n0 = st.log.length;
    M.emittersStep(st, P, amb, W, prov, dt, null);
    let nv = 0; for (let k = 0; k < M.NV; k++) nv += st.vOn[k]; if (nv > maxV) maxV = nv;
    st.vNew.fill(0);
    if (o.each) o.each(st, t, n0, P);
  }
  st.maxV = maxV; st.W = W;
  return st;
}
const aniCalls = (st, name) => st.log.filter(r => r[1] === name);
const gapsOf = rs => { const g = []; for (let i = 1; i < rs.length; i++) g.push(rs[i][0] - rs[i - 1][0]); return g; };
const SPN = ['bear', 'elk', 'doe', 'orca', 'whale', 'bird'];
const spc = name => SPN.indexOf(name);

function checkAniMap(S) {
  const F = [], { M } = emModelOf(S), sp = aniSpeciesOf(S);
  const py = fs.readFileSync(path.join(ROOT, 'tools', 'animals_table.py'), 'utf8');
  const rows = [...py.matchAll(/dict\(key='([a-z]+)', label='[^']+', kind='([a-z]+)',/g)].map(m => m[1]);
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/viewer/audio/sfx_catalogue.json'), 'utf8'));
  const c = { module: { exports: {} }, console: { info() {}, warn() {}, log() {} } };
  vm.runInNewContext(S.samples, c, { filename: 'samples.js' });
  const SM = c.module.exports;
  if (!rows.length) F.push('no rows read from tools/animals_table.py');
  for (const k of rows) {
    if (sp.indexOf(k) < 0) F.push('the animal ' + k + ' is not in the reader\'s vocabulary (ANIMAL_RUN.SOUND.SPECIES: ' + sp.join(', ') + ')');
    const r = M.ANIMALS.find(a => a[0] === k);
    if (!r) { F.push('the animal ' + k + ' has no row in the emitters\' ANIMALS table'); continue; }
    const sd = M.S[r[1]], key = sd != null ? M.SOUNDS[sd][1] : null;
    if (!key) { F.push(k + ': its sound ' + r[1] + ' has no sample key'); continue; }
    if (!cat.some(e => e.key === key)) F.push(k + ': ' + key + ' has no file in the catalogue');
    if (!SM.KEYS[key] || SM.KEYS[key].kind !== 'oneshot') F.push(k + ': ' + key + ' is not a declared one-shot in samples.js');
    if (!new RegExp("'" + key.replace(/\./g, '\\.') + "': 1").test(S.em)) F.push(k + ': ' + key + ' is not the emitters\' own (OWN)');
  }
  for (const r of M.ANIMALS) if (rows.indexOf(r[0]) < 0) F.push('the ANIMALS row ' + r[0] + ' names no shipped animal');
  // the wiring: render_premises publishes the reader, the emitters' provider reads it (the page's only path)
  if (!/\n    animalSounds: out => \(ANIM \? ANIM\.sound\(out\) : 0\),/.test(S.prem) || !/\n    animalClock: \(\) =>/.test(S.prem)) F.push('render_premises does not publish animalSounds / animalClock (the animals\' read-only reader)');
  if (!/R && R\.animalSounds \? R\.animalSounds\(out\) : 0/.test(S.em)) F.push('the emitters\' provider does not read render_premises\' animalSounds');
  if (!/sound, clock: \(\) => T,/.test(S.anirun)) F.push('animal_run.js does not return its reader (sound) and its clock');
  const th = M.SPECIES.find(r => M.SOUNDS[r[0]][0] === 'thrush');
  if (!th || th[7] !== 'thrush' || th[3] !== 'tree') F.push('the varied thrush is not a forest species in a tree');
  return F;
}

async function checkAniBlow(S) {
  const F = [], MM = emModelOf(S), L = await aniLayer(S), sp = L.AR.SOUND.SPECIES;
  const run = (spots, lx, wind, sec, each) => { const W = ambWorld({ wind }); const R = L.make({ ground: W.terrainH, waterH: aniWater(W) }); R.sync(spots);
    return { R, st: aniRun(MM, { R, world: W, wind, sec, species: sp, path: () => [lx, null, 0], each: each ? each(R) : null }) }; };
  const blowNames = { orca: 'orcablow', whale: 'whaleblow' }, REACH = { orca: 600, whale: 1500 };
  // (a) calm: the pod 100-500 m off, the whale ~1.1 km
  {
    const prev = new Int8Array(64).fill(3), surf = { orca: 0, whale: 0 }, ok = { orca: 0, whale: 0 }, bad = [];
    let plumeMiss = 0, b0 = 0, calls = 0;
    const { st } = run([{ id: 'pod', key: 'orca', x: 1300, z: 0, n: 5, r: 150 }, { id: 'wh', key: 'whale', x: 2100, z: 0, n: 1, r: 100 }], 1000, 2, 600, R => (st, t, n0, P) => {
      const A = st.ani, n = st.nAni[0], lx = P.s[P.I.listenerX], ly = P.s[P.I.listenerY], lz = P.s[P.I.listenerZ];
      let evs = 0; for (let r = 0; r < n; r++) if (A[r * 12 + 8] > st.ac[9]) evs++;   // this frame's blows: after last frame's clock
      if (R.stats.blows - b0 !== evs) plumeMiss++;
      b0 = R.stats.blows;
      const logs = st.log.slice(n0).filter(x => x[1] === 'orcablow' || x[1] === 'whaleblow');
      calls += logs.length;
      // AT THE BLOWHOLE (independent of the reader): a third of the animal's length ahead of its pivot, at the surface
      for (const x of logs) {
        const key = x[1] === 'orcablow' ? 'orca' : 'whale', len = L.AN.reg(key).length;
        let best = 1e9, ok = false;
        for (const b of R.list()) if (b.key === key) { const dh = Math.hypot(b.x - x[2], b.z - x[4]); if (Math.abs(dh - 0.33 * len * b.size) < 0.6) ok = true; best = Math.min(best, Math.abs(dh - 0.33 * len * b.size)); }
        if (!ok || Math.abs(x[3] - 0.2) > 0.15) bad.push('a ' + x[1] + ' not at a blowhole (off by ' + best.toFixed(2) + ' m, y ' + x[3] + ')');
      }
      const used = new Set();
      for (let r = 0; r < n; r++) {
        const o = r * 12, name = sp[A[o]];
        if (name !== 'orca' && name !== 'whale') continue;
        const s = A[o + 7];
        const mine = logs.filter(x => x[1] === blowNames[name] && Math.abs(x[2] - A[o + 1]) < 0.15 && Math.abs(x[4] - A[o + 3]) < 0.15);
        mine.forEach(x => used.add(x));
        if (mine.length && s !== 2) bad.push(name + ' blew while ' + (s === 3 ? 'submerged' : 'state ' + s) + ' at ' + t.toFixed(1) + ' s');
        if (s === 2 && prev[r] !== 2) {
          surf[name]++;
          const d = Math.hypot(A[o + 1] - lx, A[o + 2] - ly, A[o + 3] - lz);
          if (d < REACH[name] * 0.97) { if (mine.length === 1) ok[name]++; else bad.push(name + ' surfaced ' + d.toFixed(0) + ' m off at ' + t.toFixed(1) + ' s and blew ' + mine.length + ' times'); }
          else if (d > REACH[name] && mine.length) bad.push(name + ' blew ' + d.toFixed(0) + ' m off (its reach ' + REACH[name] + ' m)');
        } else if (mine.length) bad.push(name + ' blew at ' + t.toFixed(1) + ' s without surfacing (a second blow, or none of its own)');
        prev[r] = s;
      }
      for (const x of logs) if (!used.has(x)) bad.push('a ' + x[1] + ' at ' + t.toFixed(1) + ' s not at any blowhole');
    });
    if (bad.length) F.push('calm, the pod off a floatplane: ' + bad.length + ' bad blows - ' + bad.slice(0, 3).join('; '));
    if (!(ok.orca >= 20)) F.push('calm: ' + ok.orca + ' orca surfacings within reach blew once (of ' + surf.orca + '; want >= 20)');
    if (!(ok.whale >= 4)) F.push('calm: ' + ok.whale + ' whale surfacings at ~1.1 km blew (of ' + surf.whale + '; want >= 4: its 1.5 km reach on calm water)');
    if (plumeMiss) F.push(plumeMiss + ' frames where the reader\'s blows were not the plume\'s (the blow is the frame the plume fires)');
    if (calls !== ok.orca + ok.whale && !bad.length) F.push(calls + ' blows for ' + (ok.orca + ok.whale) + ' surfacings in reach');
  }
  // (b) the pod 700-1100 m off: no orca blow; (c) 15 m/s of wind: the whale at ~1.1 km is not heard
  {
    const { st } = run([{ id: 'pod', key: 'orca', x: 1900, z: 0, n: 5, r: 150 }], 1000, 2, 300);
    const n = aniCalls(st, 'orcablow').length;
    if (n) F.push('the pod 700-1100 m off blew ' + n + ' times (the orca\'s reach is 600 m)');
    const w = run([{ id: 'wh', key: 'whale', x: 2100, z: 0, n: 1, r: 100 }], 1000, 15, 400);
    const nw = aniCalls(w.st, 'whaleblow').length;
    if (nw) F.push('15 m/s of wind: the whale ~1.1 km off blew ' + nw + ' times (want none: the calm shortens the reach to 600 m)');
  }
  return F;
}

// six elk, CALL opportunities at the clip machine's rate (measured: one every ~11.6 s an elk)
const ELK_RATE = 1 / 11.6;
const elkHerd = (herd, cx, cz, seed) => Array.from({ length: 6 }, (_, i) => ({ sp: spc('elk'), herd, x: cx + 40 * Math.cos(i * 1.7 + seed), y: 21.5, z: cz + 40 * Math.sin(i * 1.7 + seed), rate: ELK_RATE, len: 2.6 }));
function checkAniElk(S) {
  const F = [], MM = emModelOf(S), sp = aniSpeciesOf(S);
  // (5 Hz: the clocks are rates x dt, the herd's gap is 40 s - the synthetic runs need no more)
  const runE = (sun, d, sec, herds, seed) => { const syn = aniSynth(herds || elkHerd(1, 0, 500, 0), seed || 5); return aniRun(MM, { R: syn, sun, sec, dt: 0.2, species: sp, seed: seed || 5, path: () => [0, null, 500 - d] }); };
  const SEC = 2400, dusk = aniCalls(runE(-3, 600, SEC), 'elk'), noon = aniCalls(runE(40, 600, SEC), 'elk');
  if (!(dusk.length >= 12 && dusk.length <= SEC / 60)) F.push('40 min at dusk, 600 m from the herd: ' + dusk.length + ' bugles (want 12..' + SEC / 60 + ': a mean gap of a minute or more)');
  const g = gapsOf(dusk);
  if (g.some(x => x < 40 - 1e-6)) F.push('two bugles of one herd ' + Math.min(...g).toFixed(1) + ' s apart (its gap 40 s: never two at once)');
  if (dusk.length && SEC / dusk.length < 60) F.push('the herd\'s mean gap at dusk ' + (SEC / dusk.length).toFixed(0) + ' s (want >= 60)');
  if (!(noon.length * 2 < dusk.length)) F.push('noon ' + noon.length + ' bugles vs dusk ' + dusk.length + ' (want most at dawn and dusk: noon under half)');
  const far = aniCalls(runE(-3, 1300, 1200), 'elk').length, out = aniCalls(runE(-3, 1700, 1200), 'elk').length;
  if (!(far >= 3)) F.push('1300 m from the herd at dusk: ' + far + ' bugles in 20 min (want >= 3: the 1.5 km reach)');
  if (out) F.push('1700 m from the herd: ' + out + ' bugles heard (its reach is 1.5 km)');
  const two = runE(-3, 300, 1200, elkHerd(1, 0, 500, 0).concat(elkHerd(2, 300, 500, 1)));
  const hs = new Set(aniCalls(two, 'elk').map(r => r[2] > 150 ? 2 : 1));
  if (hs.size !== 2) F.push('two herds at dusk: only ' + [...hs].join(',') + ' called (each herd its own clock)');
  return F;
}
async function checkAniElkReal(S) {
  const F = [], MM = emModelOf(S), L = await aniLayer(S), sp = L.AR.SOUND.SPECIES;
  const W = ambWorld(), R = L.make({ ground: W.terrainH, waterH: aniWater(W) });
  R.sync([{ id: 'herd', key: 'elk', x: 0, z: 500, n: 6, r: 120 }]);
  let bad = 0, n = 0;
  aniRun(MM, { R, world: W, sun: -3, sec: 600, species: sp, path: () => [0, null, 200], each: (st, t, n0) => {
    for (const x of st.log.slice(n0)) {
      if (x[1] !== 'elk') continue;
      n++;
      const A = st.ani; let hit = false;
      for (let r = 0; r < st.nAni[0]; r++) { const o = r * 12; if (A[o + 8] > st.ac[9] && sp[A[o]] === 'elk' && Math.abs(A[o + 1] - x[2]) < 0.15 && Math.abs(A[o + 3] - x[4]) < 0.15) hit = true; }
      if (!hit) bad++;
    }
  } });
  if (!(n >= 2)) F.push('the real herd at dusk, 300 m: ' + n + ' bugles in 10 min (want >= 2)');
  if (bad) F.push(bad + ' bugles of the real herd not in a call opportunity\'s frame at that elk\'s head');
  return F;
}

function checkAniLand(S) {
  const F = [], MM = emModelOf(S), sp = aniSpeciesOf(S);
  const bear = () => aniSynth([{ sp: spc('bear'), herd: 3, x: -100, y: 21.2, z: 600, rate: 0.1, len: 2.2 }], 9);
  // on the ground 100 m off / 200 m off, by day
  const g100 = aniCalls(aniRun(MM, { R: bear(), sec: 1800, dt: 0.2, species: sp, path: () => [-100, null, 500] }), 'bear');
  const g200 = aniCalls(aniRun(MM, { R: bear(), sec: 1200, dt: 0.2, species: sp, path: () => [-100, null, 400] }), 'bear');
  if (!(g100.length >= 2)) F.push('30 min on the ground 100 m from the bear: ' + g100.length + ' growls (want >= 2: near, it is heard)');
  if (gapsOf(g100).some(x => x < 60 - 1e-6) || g100.length > 1800 / 60) F.push('the bear is not rare: ' + g100.length + ' growls in 30 min, gaps ' + gapsOf(g100).map(x => x.toFixed(0)).join(','));
  if (g200.length) F.push('200 m from the bear: ' + g200.length + ' growls (want none: only near, 150 m)');
  // THE PASSES: over the bear every 240 s at 40 m/s (100 s a pass, from 2 km to 2 km), low (20 m AGL) or high (120 m)
  // (a startle is the model's own: the herd's startle clock moved - a growl of the bear's ordinary clock may fall in a pass)
  const passes = h => { let near = 0, last = -1e9;
    const st = aniRun(MM, { R: bear(), sec: 7200, dt: 0.2, species: sp, seed: 13, path: t => { const u = t % 240; return [-100 + (u < 100 ? -2000 + 40 * u : 2000), 21 + h, 600]; },
      each: s => { let m = -1e9; for (let k = 0; k < s.hStart.length; k++) if (s.hStart[k] > m) m = s.hStart[k]; if (m > last) { if (m > -1e8) near++; last = m; } } });
    return { all: aniCalls(st, 'bear').length, near }; };
  const lo = passes(20), hi = passes(120);
  if (!(lo.near >= 4 && lo.near <= 24)) F.push('30 low passes over the bear (20 m AGL): ' + lo.near + ' startles (want 4..24: 40 % of them, rare)');
  if (hi.near) F.push('30 passes at 120 m AGL: ' + hi.near + ' startles (want none: only near and low)');
  if (!(hi.all < lo.all)) F.push('the bear growled ' + hi.all + ' times under high passes vs ' + lo.all + ' under low ones (want more when near and low)');
  // the doe: bleats at 100 m, none at 200 m
  const doe = () => aniSynth(Array.from({ length: 5 }, (_, i) => ({ sp: spc('doe'), herd: 4, x: 200 + 15 * i, y: 21, z: 600, rate: 0.1, len: 1.6 })), 4);
  const d100 = aniCalls(aniRun(MM, { R: doe(), sec: 1800, dt: 0.2, species: sp, path: () => [230, null, 500] }), 'doe');
  const d200 = aniCalls(aniRun(MM, { R: doe(), sec: 1200, dt: 0.2, species: sp, path: () => [230, null, 400] }), 'doe');
  if (!(d100.length >= 3)) F.push('30 min 100 m from the does by day: ' + d100.length + ' bleats (want >= 3)');
  if (gapsOf(d100).some(x => x < 45 - 1e-6)) F.push('two bleats of one herd ' + Math.min(...gapsOf(d100)).toFixed(1) + ' s apart (its gap 45 s)');
  if (d200.length) F.push('200 m from the does: ' + d200.length + ' bleats (want none: 150 m)');
  return F;
}

async function checkAniGull(S) {
  const F = [], MM = emModelOf(S), L = await aniLayer(S), sp = L.AR.SOUND.SPECIES;
  const flock = (sun, sec, each, o) => { const W = ambWorld(); const eye = { x: 0, y: 30, z: 300 };
    const R = L.make({ ground: W.terrainH, waterH: aniWater(W), eye: o && o.ambient ? () => eye : null });
    if (o && o.ambient) R.ambient(2, 'bird'); else R.sync([{ id: 'fl', key: 'bird', x: 0, z: 300, n: 7, r: 100, dy: 40 }]);
    return aniRun(MM, { R, world: W, sun, sec, species: sp, path: () => [0, null, 300], each: each ? each(R) : null }); };
  let far = 0, frames = 0;
  const day = flock(40, 600, R => st => {
    let birds = null;
    for (let k = 0; k < st.vOn.length; k++) {
      if (!st.vOn[k] || st.vS[k] !== MM.M.S.gull || st.vT0[k] > st.clk[0]) continue;
      frames++;
      if (!birds) birds = R.list();
      let best = 1e9; for (const b of birds) best = Math.min(best, Math.hypot(b.x - st.vX[k], b.y - st.vY[k], b.z - st.vZ[k]));
      if (best > 2) far++;
    }
  });
  const c = aniCalls(day, 'gull');
  if (!(c.length >= 10 && c.length <= 60)) F.push('10 min under the circling flock: ' + c.length + ' gull calls (want 10..60: a rate per flock)');
  if (gapsOf(c).some(x => x < 6 - 1e-6)) F.push('two calls of one flock ' + Math.min(...gapsOf(c)).toFixed(2) + ' s apart (its gap 6 s)');
  if (!frames) F.push('no gull call sounded long enough to follow');
  else if (far) F.push('a gull call did not ride its flock: ' + far + ' of ' + frames + ' frames more than 2 m from every bird');
  const night = aniCalls(flock(-15, 150), 'gull').length;
  if (night) F.push('the flock at night: ' + night + ' calls (want none)');
  let ambCalls = 0;
  flock(40, 600, R => (st, t, n0) => { for (let i = n0; i < st.log.length; i++) { const x = st.log[i]; if (x[1] === 'gull' && R.list().some(b => b.id === 'ambient' && Math.hypot(b.x - x[2], b.z - x[4]) < 0.5)) ambCalls++; } }, { ambient: true });
  if (!(ambCalls >= 1)) F.push('10 min of ambient flocks crossing: ' + ambCalls + ' calls from them (want >= 1)');
  return F;
}

// the page near the mill: its recording in the loop slot, baked uncut; without the file, the procedural rumble
async function checkAniMill(S) {
  const F = [];
  const mill = async drop => {
    const W = ambWorld();
    W.premises.rec.layers.sites = [{ id: 'mine', at: { x: -100, z: 600, yaw: 0 }, items: [{ id: 'm', key: 'house/kennecott mill', x: 0, z: 0 }] }];
    const pg = emPage(S, { sun: 40, world: W, before: w => { w.HOUSE_GEN = { PRESETS: { 'kennecott mill': { mill: 1 } } }; if (drop) delete w.FLYDIY_AUDIO_MEDIA['mill.stamp']; } });
    pg.at(-100, 450, 1.7);
    await pg.settle(60 * 6);
    const E = pg.win.EMITTERS, M = E.model, st = E.state;
    let on = 0, slot = -1; for (let k = 0; k < M.NL; k++) if (st.lOn[k] && st.lS[k] === M.S.mill) { on++; slot = k; }
    // the loop slot's own source: the panners are made voices first, then loops (NV + slot)
    const pan = slot >= 0 ? pg.R.panners[M.NV + slot] : null;
    const src = pan ? pg.R.sources.filter(s => s.loop && s.buffer && s.on && s.to && s.to.to && s.to.to.to === pan).pop() : null;
    return { on, src, proc: E.procBytes(), res: E.resident(M.S.mill), M };
  };
  const a = await mill(false);
  if (!a.on || !a.src) F.push('150 m from the mill by day: its loop ' + (a.on ? 'on' : 'off') + ', ' + (a.src ? 'a source' : 'no looping source'));
  else {
    if (a.M.SOUNDS[a.M.S.mill][1] !== 'mill.stamp') F.push('the mill\'s sound is ' + a.M.SOUNDS[a.M.S.mill][1] + ' (want the recording mill.stamp)');
    if (a.proc) F.push('the mill made a procedural buffer (' + a.proc + ' B) although its recording ships');
    const d = a.src.buffer.duration;
    if (!(d > 6.2 && d < 6.45)) F.push('the mill\'s loop is ' + d.toFixed(2) + ' s (want the recording\'s 6.4 s uncut: onset to onset, no crossfade)');
  }
  const b = await mill(true);
  if (!b.on || !b.src || !(b.proc > 0)) F.push('without mill.stamp the mill is ' + (b.on ? 'on' : 'off') + ' with ' + b.proc + ' B procedural (want its synthesised rumble as the fallback)');
  return F;
}

// the page with a synthetic pod and flock (window.WORLD.premises.animalSounds), on the sea off ambWorld's shore
async function checkAniPlay(S) {
  const F = [];
  const off = new Float64Array(1);   // the cast's offset in x (3 km: far)
  const orca = { sp: spc('orca'), herd: 21, x: 1000, y: 0.2, z: -200, blowEvery: 8, up: 3, len: 8 };
  const birds = [0, 1, 2].map(i => ({ sp: spc('bird'), herd: 22, x: 850 + 2 * i, y: 40, z: -50 - 2 * i, vx: 11, len: 1, state: 4,
    move: (a, t) => { a.x = 850 + 2 * i + off[0] + 11 * (t % 30); } }));
  const syn = aniSynth([orca].concat(birds), 3);
  const urls = [];
  const pg = emPage(S, { sun: 40, before: w => {
    const f0 = w.ASSET_FETCH; w.ASSET_FETCH = u => { urls.push(u); return f0(u); };
    w.ANIMAL_RUN = { SOUND: { SPECIES: SPN } };
    w.WORLD = { premises: { soundObjects: () => 0, animalSounds: out => syn.sound(out), animalClock: () => syn.clock() } };
  } });
  const step = async n => { for (let i = 0; i < n; i++) { syn.tick(1 / 60); orca.x = 1000 + off[0]; pg.go(); if (i % 4 === 0) { await null; pg.runTimers(); } } };
  pg.at(1000, 0, 1.7);
  off[0] = 3000; await step(60 * 12);
  if (urls.some(u => /animal_/.test(u))) F.push('the pod 3 km off: ' + urls.filter(u => /animal_/.test(u)).length + ' animal files fetched (want none: by proximity)');
  off[0] = 0; const n0 = pg.R.sources.length;
  await step(60 * 190);
  if (!urls.some(u => /animal_orca/.test(u))) F.push('the pod 200 m off: the orca\'s breath was not fetched');
  const E = pg.win.EMITTERS, M = E.model;
  const isOrca = s => s.buffer && !s.loop && [2.11, 2.2].some(d => Math.abs(s.buffer.duration - d) < 0.01);
  const blows = pg.R.sources.slice(n0).filter(isOrca);
  if (!(blows.length >= 18)) F.push(blows.length + ' orca blows played in 190 s of surfacings every 8 s (want >= 18)');
  const lo = 0.82 * Math.pow(2, -0.5 / 12) - 1e-6, hi = 0.82 * Math.pow(2, 0.5 / 12) + 1e-6;
  const badRate = blows.filter(s => !(s.playbackRate.value >= lo && s.playbackRate.value <= hi));
  if (badRate.length) F.push(badRate.length + ' orca blows at a rate outside 0.82 x +-0.5 st (e.g. ' + badRate[0].playbackRate.value.toFixed(3) + ')');
  let rep = 0; for (let i = 1; i < blows.length; i++) if (blows[i].buffer === blows[i - 1].buffer) rep++;
  if (rep) F.push(rep + ' blows repeated the variant just played (want none: no immediate repeat)');
  // the blowhole in the camera's frame: (0, 0.2 - eye, -200) with the identity camera
  const pan = blows.length ? blows[blows.length - 1].to.to.to : null;
  if (!(pan && Math.abs(pan.positionX.value) < 1 && Math.abs(pan.positionZ.value + 200) < 1)) F.push('the blow placed at (' + (pan ? [pan.positionX.value, pan.positionY.value, pan.positionZ.value].map(v => v.toFixed(1)).join(', ') : '-') + ') in the camera\'s frame (want its blowhole at (0, -1.5, -200))');
  // a gull's call rides its bird: its panner moves while it sounds, its rate carries the doppler (its bird at 11 m/s)
  {
    const st = E.state, lastX = new Float64Array(M.NV).fill(NaN); let moved = 0, dop = 0, gullFrames = 0;
    for (let i = 0; i < 60 * 60; i++) {
      await step(1);
      for (let k = 0; k < M.NV; k++) {
        if (!(st.vOn[k] && st.vS[k] === M.S.gull && st.vAF[k] > 0 && st.vT0[k] <= st.clk[0])) { lastX[k] = NaN; continue; }
        gullFrames++;
        const p = pg.R.panners[k];
        if (lastX[k] === lastX[k] && Math.abs(p.positionX.value - lastX[k]) > 0.02) moved++;
        lastX[k] = p.positionX.value;
        const src = pg.R.sources.filter(s => s.to && s.to.to && s.to.to.to === p).pop();
        if (src && Math.abs(src.playbackRate.value / st.vR[k] - 1) > 0.002) dop++;
      }
    }
    if (!gullFrames) F.push('no gull call from the flock passing 50 m off in a minute');
    else {
      if (!moved) F.push('a gull call\'s panner never moved while it sounded (it must ride its bird)');
      if (!dop) F.push('no doppler on a gull call (its bird flies at 11 m/s)');
    }
  }
  return F;
}

async function checkAniAlloc(S, report) {
  const F = [], L = await aniLayer(S), MM = emModelOf(S), M = MM.M;
  // the island's cast (tools/fixtures/island_jolene.json's eight hotspots) on ambWorld, and two ambient flocks
  const W = ambWorld(), eye = { x: 0, y: 30, z: 0 };
  const R = L.make({ ground: W.terrainH, waterH: aniWater(W), eye: () => eye });
  R.sync([{ id: 'a1', key: 'elk', x: 0, z: 500, n: 4, r: 120 }, { id: 'a2', key: 'bear', x: -100, z: 600, n: 1, r: 70 }, { id: 'a3', key: 'doe', x: 200, z: 600, n: 5, r: 110 },
          { id: 'a4', key: 'orca', x: 1300, z: 0, n: 5, r: 150 }, { id: 'a5', key: 'whale', x: 2100, z: 0, n: 1, r: 100 }, { id: 'a6', key: 'bird', x: 0, z: 300, n: 7, r: 100, dy: 45 },
          { id: 'a7', key: 'elk', x: 300, z: 500, n: 6, r: 150 }, { id: 'a8', key: 'doe', x: 200, z: 300, n: 7, r: 130 }]);
  R.ambient(2, 'bird');
  for (let i = 0; i < 600; i++) R.tick(1 / 30);
  const out = new Float64Array(M.MAXANI * M.AROW);
  let n = 0;
  for (let i = 0; i < 20000; i++) n = R.sound(out);   // warm
  // (the heap's own noise is a few KB a window whatever runs: the reads are measured against a twin loop doing nothing,
  // over 30 000 reads - one boxed double a read would be 480 KB)
  const NR = 30000, noop = () => 0;
  const win = async f => { let best = null;
    for (let w = 0; w < 2; w++) {
      global.gc(); global.gc(); await new Promise(r => setTimeout(r, 5));
      let g = 0; const obs = new PerformanceObserver(l => { g += l.getEntries().length; }); obs.observe({ entryTypes: ['gc'] });
      const h0 = process.memoryUsage().heapUsed, t0 = performance.now();
      for (let i = 0; i < NR; i++) n = f(out);
      const ms = (performance.now() - t0) / NR, d = process.memoryUsage().heapUsed - h0;
      await new Promise(r => setTimeout(r, 5)); obs.disconnect();
      if (!best || g < best.g || (g === best.g && d < best.d)) best = { g, d, ms };
    }
    return best; };
  for (let i = 0; i < 20000; i++) noop(out);
  const B0 = await win(noop), best = await win(R.sound);
  if (!(n >= 36)) F.push('the reader wrote ' + n + ' rows for the island\'s cast (want >= 36)');
  best.d -= Math.max(0, B0.d);
  if (best.g > B0.g || best.d > NR * 0.5) F.push('the reader allocates: ' + (best.d / NR).toFixed(2) + ' B a read over a loop doing nothing (' + best.g + ' vs ' + B0.g + ' GC; want none)');
  // THE MODEL: recorded rows replayed (600 frames of the cast, events and all) against its twin with no animals
  const FR = 600, rec = new Float64Array(FR * M.MAXANI * M.AROW), cnt = new Int32Array(FR), clk = new Float64Array(FR);
  for (let f = 0; f < FR; f++) { R.tick(1 / 60); eye.x = 0; cnt[f] = R.sound(out); clk[f] = R.clock(); for (let k = 0; k < cnt[f] * M.AROW; k++) rec[f * M.MAXANI * M.AROW + k] = out[k]; }
  const meas = async (withAni, windows) => {
    const { AM } = MM, Wm = ambWorld(), AP = loadParams(SRC0.params), P = AP.audioParamsBlock(), amb = AM.ambienceState(), st = M.emittersState('full');
    st.ready.fill(1); M.seed(st, 3); Wm.day.sunEl = -3;
    const F_ = new Int32Array(1), base = new Float64Array(1);
    const prov = { animalSpecies: () => L.AR.SOUND.SPECIES, animalClock: () => base[0] + clk[F_[0] % FR],
      animals(o) { if (!withAni) return 0; const f = F_[0] % FR, q = f * M.MAXANI * M.AROW, m = cnt[f]; for (let k = 0; k < m * M.AROW; k++) o[k] = rec[q + k]; return m; } };
    P.s[P.I.listenerX] = 100; P.s[P.I.listenerY] = 21.7; P.s[P.I.listenerZ] = 450;
    const go = () => { F_[0]++; if (F_[0] % FR === 0) base[0] += clk[FR - 1]; AM.ambienceStep(amb, P, Wm, 1 / 60); M.emittersStep(st, P, amb, Wm, prov, 1 / 60, null); st.vNew.fill(0); };
    for (let i = 0; i < 20000; i++) go();   // (warm: V8's optimising tier, where a double local is not a heap box)
    let res = null;
    for (let w = 0; w < windows; w++) {
      global.gc(); global.gc(); await new Promise(r => setTimeout(r, 5));
      let g = 0; const obs = new PerformanceObserver(l => { g += l.getEntries().length; }); obs.observe({ entryTypes: ['gc'] });
      const n0 = st.n.reduce((a, b) => a + b, 0), h0 = process.memoryUsage().heapUsed, t0 = performance.now();
      for (let i = 0; i < 20000; i++) go();
      const ms = (performance.now() - t0) / 20000, d = process.memoryUsage().heapUsed - h0, calls = st.n.reduce((a, b) => a + b, 0) - n0;
      await new Promise(r => setTimeout(r, 5)); obs.disconnect();
      const m = { g, d, ms, calls };
      if (!res || m.g < res.g || (m.g === res.g && m.d - 4096 * m.calls < res.d - 4096 * res.calls)) res = m;
    }
    return res;
  };
  // (the first model measured in a realm allocates more - V8's tiers settling: measured 465 vs 320 KB for the same twin -
  // so a twin is measured first and thrown away)
  await meas(false, 0);
  const A = await meas(true, 2), B = await meas(false, 2);
  const own = A.d - B.d - 4096 * A.calls;
  if (A.g > B.g || own > 16384) F.push('the model\'s animals allocate: ' + ((A.d - B.d) / 20000).toFixed(1) + ' B a frame over its twin (' + A.g + ' vs ' + B.g + ' GC; ' + A.calls + ' calls allow ' + 4096 * A.calls + ' B + 16 KB)');
  if (!(A.calls >= 1)) F.push('the replayed cast made no call in 20 000 frames (the check proves nothing)');
  if (report) report.push('the animals: the reader ' + (best.ms * 1000).toFixed(1) + ' us for ' + n + ' rows, ' + (best.d / NR).toFixed(2) + ' B a read over a loop doing nothing; the model with them ' + (A.ms * 1000).toFixed(1) + ' us a frame vs ' + (B.ms * 1000).toFixed(1) + ' us without (+' + ((A.ms - B.ms) * 1000).toFixed(1) + ' us), ' + ((A.d - B.d) / 20000).toFixed(2) + ' B a frame over the twin, ' + A.calls + ' calls');
  return F;
}

// ==== SND-VOICE (G1626-G1629) ======================================================================================
//   VOICE_CAT    (G1701: with the SND-RADIO-3 block above) the shipped broadcast's takes, every track back-announced.
//   (VOICE_AWOS and VOICE_MARINE are RETIRED with the AWOS and marine assemblers they tested - G1701.)
//   VOICE_PLAY   the player on a stub context: nothing fetched without a context; play schedules each clip at the end of
//                the one before plus the rest, sample-exact, from its codec-pad offset, for its catalogue dur; a failed
//                clip closes up (its rests stay); stop() stops every source; the decoded bytes back under the budget
//                once a reading ends; keyOf finds a line by its text.
//   VOICE_WIRING the build lists voice_model.js then voice.js and inlines voice_catalogue.json as FLYDIY_VOICE; GATE MEDIA
//                reads voice_catalogue.json.
function loadVoiceModel(text) { const c = { module: { exports: {} } }; vm.runInNewContext(text, c, { filename: 'voice_model.js' }); return c.module.exports; }
async function checkVoicePlay(S) {
  const F = [];
  const c = { module: { exports: {} }, console: { info() {}, warn() {}, log() {} } };
  vm.runInNewContext(S.voice, c, { filename: 'voice.js' });
  const V = c.module.exports, M = loadVoiceModel(S.voicemodel), SR = 48000, PAD = 2400;
  const cat = { clips: { a: { file: 'a.mp3', text: "You're listening to Radio Jolene.", dur: 0.4 }, b: { file: 'b.mp3', text: 'b', dur: 0.3 },
    c: { file: 'c.mp3', text: 'c', dur: 0.2 }, d: { file: 'd.mp3', text: 'd', dur: 0.5 } } };
  let fetches = 0;
  const fetch = u => { fetches++; const k = u.replace(/^B\//, '').slice(0, 1); return k === 'c' ? Promise.reject(new Error('404')) : Promise.resolve(new Uint8Array(Math.round((cat.clips[k].dur + 0.1) * SR))); };
  const starts = [], stops = [];
  const mkBuf = n => { const d = new Float32Array(PAD + n); for (let i = PAD; i < d.length; i++) d[i] = 0.3 * Math.sin(i * 0.05) + 0.01; return { length: d.length, numberOfChannels: 1, sampleRate: SR, duration: d.length / SR, getChannelData: () => d }; };
  const ctx = { currentTime: 1, destination: {}, decodeAudioData: (ab, ok) => { const b = mkBuf(ab.byteLength); ok(b); return Promise.resolve(b); },
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }),
    createBufferSource: () => { const s = { connect() {}, start(t, off, dur) { starts.push({ s, t, off, dur }); }, stop() { stops.push(s); } }; return s; } };
  // no context: nothing fetched, nothing played
  const N = V.create({ catalogue: cat, fetch, base: 'B/', model: M, ctx: null });
  const n0 = await N.play(['a', 0.1, 'b']); await N.preload(['a', 'b']);
  if (n0 !== null || fetches) F.push('without a context: play -> ' + n0 + ', ' + fetches + ' fetches (want null, 0)');
  const P = V.create({ catalogue: cat, fetch, base: 'B/', model: M, ctx, budget: 200 * 1024 });
  if (P.keyOf("you're listening to radio jolene") !== 'a') F.push('keyOf does not find a line by its text');
  if (P.missing(['a', 0.1, 'x']).join() !== 'x') F.push('missing() reads ' + P.missing(['a', 0.1, 'x']));
  const h = await P.play(['a', 0.1, 'b', 0.2, 'c', 0.05, 'd']);
  const want = [['a', 1.05, 0.4], ['b', 1.55, 0.3], ['d', 2.1, 0.5]], off = PAD / SR - 0.005;
  if (!h || starts.length !== 3) F.push('play scheduled ' + starts.length + ' sources (want 3: a, b, d - c failed)');
  else starts.forEach((s, i) => { const [k, t, dur] = want[i]; if (Math.abs(s.t - t) > 1e-9 || Math.abs(s.off - off) > 1e-9 || Math.abs(s.dur - dur) > 1e-9) F.push(k + ' starts at ' + s.t.toFixed(6) + ' from ' + s.off.toFixed(6) + ' for ' + s.dur + ' (want ' + t + ' from ' + off.toFixed(6) + ' (the codec pad) for ' + dur + ')'); });
  if (h && Math.abs(h.end - 2.6) > 1e-9) F.push('the reading ends at ' + h.end + ' (want 2.6)');
  if (P.state('c') !== 'failed') F.push('the failed clip reads ' + P.state('c'));
  const playing = P.bytes;
  if (h) { const last = starts[starts.length - 1].s; if (last.onended) last.onended(); }
  if (!(P.bytes <= 200 * 1024 && playing > 200 * 1024)) F.push('decoded bytes ' + playing + ' while playing, ' + P.bytes + ' after (want back under the 204 800 budget)');
  starts.length = 0;
  const h2 = await P.play(['a', 0.1, 'd']); if (h2) h2.stop();
  if (!h2 || stops.length !== 2) F.push('stop() stopped ' + stops.length + ' of 2 sources');
  return F;
}
function checkVoiceWiring(S) {
  const F = [];
  const s0 = S.build.indexOf("    scripts: ['storage.js'"), s1 = S.build.indexOf("'dev_panel.js']", s0);
  const list = s0 >= 0 && s1 > s0 ? S.build.slice(s0, s1) : '';
  const ia = list.indexOf("'audio/audio.js'"), im = list.indexOf("'audio/voice_model.js'"), iv = list.indexOf("'audio/voice.js'"), iw = list.indexOf("'app.js'");
  if (!(ia >= 0 && im > ia && iv > im && iw > iv)) F.push('build.js MANIFEST.viewer.scripts does not list audio/voice_model.js then audio/voice.js after audio.js, before app.js');
  if (S.build.indexOf("window.FLYDIY_VOICE=${fs.existsSync(path.join(VIEW_DIR, 'audio', 'voice_catalogue.json'))") < 0) F.push('build.js does not inline voice_catalogue.json as window.FLYDIY_VOICE');
  if (!/const sound = \[[^\]]*'voice_catalogue\.json'/.test(S.mediachk)) F.push('GATE MEDIA does not read voice_catalogue.json');
  return F;
}

const CHECKS = { NUMBERS: checkNumbers, CONTACTS: checkContacts, BUDGET: checkBudget, GESTURE: checkGesture,
                 SILENCE: checkSilence, SETTINGS: checkSettings, SOURCES: checkSources, WIRING: checkWiring,
                 MUSIC_CAT: checkMusicCatalogue, MUSIC_CTX: checkMusicContexts, MUSIC_SHUFFLE: checkMusicShuffle,
                 MUSIC_GAPS: checkMusicGaps, MUSIC_XFADE: checkMusicXfade, MUSIC_DUCK: checkMusicDuck,
                 MUSIC_BUDGET: checkMusicBudget, MUSIC_CREDITS: checkMusicCredits, MUSIC_WIRING: checkMusicWiring,
                 RADIO_STATIONS: checkRadioStations, RADIO_PICKER: checkRadioPicker,
                 RADIO_TALK: checkRadioTalk, RADIO_BUDGET: checkRadioBudget, RADIO_WIRING: checkRadioWiring, RADIO_CLIPS: checkRadioClips,
                 RADIO_LINT: checkRadioLint, RADIO_HORIZON: checkRadioHorizon, RADIO_WX: checkRadioWx, RADIO_XFADE: checkRadioXfade, VOICE_LICENCE: checkVoiceLicence,
                 AFMODEL: checkAfModel, AFVOICE: checkAfVoice, AFALLOC: checkAfAlloc, AFFLOWN: checkAfFlown, AFSOURCE: checkAfSource,
                 SAMPLES: checkSamples, INERT: checkInert,
                 SP_CABIN: checkSpCabin, SP_DOPPLER: checkSpDoppler, SP_ABSORB: checkSpAbsorb, SP_XFADE: checkSpXfade,
                 SP_IR: checkSpIr, SP_GRAPH: checkSpGraph, SP_BUDGET: checkSpBudget, SP_CRAFT: checkSpCraft,
                 AMBPLACES: checkAmbPlaces, AMBJOLENE: checkAmbJolene, AMBSMOOTH: checkAmbSmooth, AMBAGL: checkAmbAgl, AMBLUFS: checkAmbLufs,
                 AMBGESTURE: checkAmbGesture, AMBBUDGET: checkAmbBudget, AMBALLOC: checkAmbAlloc, AMBMUFFLE: checkAmbMuffle,
                 AMBSAMPLES: checkAmbSamples, AMBWIRING: checkAmbWiring,
                 EMITHABITAT: checkEmHabitat, EMITRATE: checkEmRate, EMITAGL: checkEmAgl, EMITOBJECTS: checkEmObjects,
                 EMITGESTURE: checkEmGesture, EMITPLAY: checkEmPlay, EMITBUDGET: checkEmBudget, EMITALLOC: checkEmAlloc,
                 EMITWIRING: checkEmWiring, EMITSAMPLES: checkEmSamples,
                 ANIMAP: checkAniMap, ANIBLOW: checkAniBlow, ANIELK: async S => checkAniElk(S).concat(await checkAniElkReal(S)),
                 ANILAND: checkAniLand, ANIGULL: checkAniGull, ANIMILL: checkAniMill, ANIPLAY: checkAniPlay, ANIALLOC: checkAniAlloc,
                 VOICE_CAT: checkVoiceCat, VOICE_PLAY: checkVoicePlay, VOICE_WIRING: checkVoiceWiring };
const REPORTS = { RADIO_HORIZON: 1, VOICE_CAT: 1, BUDGET: 1, AFVOICE: 1, AFALLOC: 1, AFFLOWN: 1, AFSOURCE: 1, SP_BUDGET: 1, AMBBUDGET: 1, AMBALLOC: 1, EMITRATE: 1, EMITBUDGET: 1, EMITALLOC: 1, ANIALLOC: 1 };

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
  ['the headset in the open', 'audio', 'const hs = interior && set.headset && !sp ? HEADSET_K : 1;', 'const hs = set.headset && !sp ? HEADSET_K : 1;', 'SETTINGS'],
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
  ['the horn outside', 'worklet', 'io += dS * 0.12 * sp *', 'ext += dS * 0.12 * sp *', 'AFVOICE'],
  ['the closed cabin as loud as the open', 'worklet', '(1 - op) * 2.2 * z[Z_CABW]', '(1 - op) * 22 * z[Z_CABW]', 'AFVOICE'],
  ['the NaN unguarded', 'worklet', "if (!(yE === yE) || !(yI === yI) || !(yR === yR) || !(yO === yO)) { nanHit = 1; yE = 0; yI = 0; yR = 0; yO = 0; }", '', 'AFVOICE'],
  ['process() allocates', 'worklet', '    this.stats[3]++;\n', '    this.stats[3]++; this.lastBlock = [n];\n', 'AFALLOC'],
  ['a DC offset out', 'worklet', '      oE[j] = yE;\n', '      oE[j] = yE + 0.01;\n', 'AFFLOWN'],
  ['the wind blows the ceiling', 'model', 'Vref: 50, windExt: 0.08,', 'Vref: 50, windExt: 8,', 'AFFLOWN'],
  ['the floats\' splash lost', 'model', "if (wet && !(s[SI.pwet] > 0) && Math.min(s[SI.off0], s[SI.off1]) >= A.tdOffS)", "if (false)", 'AFFLOWN'],
  ['the source schedules every frame', 'srcaf', '        if (v === last[i]) continue;\n', '', 'AFSOURCE'],
  ['the source drops the events', 'srcaf', "          node.port.postMessage({ t: 'ev', e, s, a: E[o + 2], b: E[o + 3], k: rec, d: lag });", '', 'AFSOURCE'],
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
  ['the level untrimmed', 'music', 'fadeTo(k, trims[t] * PS[S_BED], fade);', 'fadeTo(k, PS[S_BED], fade);', 'MUSIC_XFADE'],
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
  ['CREDITS.md stale', 'credits', 'The music that ships (', 'The music shipped (', 'MUSIC_CREDITS'],
  ['the about line not extended', 'music', '\n  mountCreditLink();\n', '\n', 'MUSIC_CREDITS'],
  ['the screen forgets the engine synth', 'music', "line: 'engine-sound-generator by Antonio-R1 (MIT, © 2021-2022 Antonio-R1), the AudioWorklet our engine voice is ported from',", "line: 'the engine synthesiser',", 'MUSIC_CREDITS'],
  ['the build loses music.js', 'build', "'audio/radio_talk.js', 'audio/music.js',", "'audio/radio_talk.js',", 'MUSIC_WIRING'],
  ['the build forgets the catalogue', 'build', ';window.FLYDIY_MUSIC=${MUSIC}', '', 'MUSIC_WIRING'],
  ['sw.js cuts no range', 'build', 'if (range) { e.respondWith(ranged(req, range)); return; }', '', 'MUSIC_WIRING'],
  ['the engine emits no start', 'engine', "if (vals3) A.emit('engine', 'start'); ", '', 'MUSIC_WIRING'],
  ['no garage setting', 'audio', "    ['musicGarage', 0, 'bool',", "    ['musicGarageX', 0, 'bool',", 'MUSIC_WIRING'],
  ['the skip row gone', 'music', "btn('skip track', 'skip', () => skip());", '', 'MUSIC_WIRING'],
  // SND-SPACE (G1640-G1646)
  ['the metal cabin as fabric', 'spcfg', "alloy: 'metal'", "alloy: 'fabric'", 'SP_CABIN'],
  ['the open cockpit ignored', 'spcfg', "if (cab.glazing === 'none') return { cls: 'open'", "if (false) return { cls: 'open'", 'SP_CABIN'],
  ['the insulation unsolved', 'spcfg', 'ch.gainDb = -insul - meanDb(ch, INSUL_F);', 'ch.gainDb = -insul;', 'SP_CABIN'],
  ['the metal\'s high end let through', 'spcfg', 'metal:      { insul: 20, shelfHz: 1000, shelfDb: -12, lpHz: 3200,', 'metal:      { insul: 20, shelfHz: 6000, shelfDb: -2, lpHz: 18000,', 'SP_CABIN'],
  ['no cabin boom', 'spcfg', 'if (boomDb > 0.05) filters.push(', 'if (false) filters.push(', 'SP_CABIN'],
  ['the exits ignored', 'spcfg', 'let ex = +o.exits || 0;', 'let ex = 0;', 'SP_CABIN'],
  ['a flat headset', 'spcfg', "{ type: 'highshelf', f: 1500, Q: 0, gain: -10 }", "{ type: 'highshelf', f: 1500, Q: 0, gain: 0 }", 'SP_CABIN'],
  ['ANR without its low end', 'spcfg', "gain: kind === 'anr' ? -7 : 0", 'gain: 0', 'SP_CABIN'],
  ['the doppler inverted', 'spcfg', 'let k = (cc - vl) / (cc - vs);', 'let k = (cc - vs) / (cc - vl);', 'SP_DOPPLER'],
  ['the doppler not retarded', 'spcfg', 'out[0] = t - tau; ringAtSlot(R, out);', 'out[0] = t; ringAtSlot(R, out);', 'SP_DOPPLER'],
  ['the engine deaf to its pitch', 'engw', 'let r2 = rev + spP*rpmInst/(60.0*cycleRevs);', 'let r2 = rev + spS*rpmInst/(60.0*cycleRevs);', 'SP_DOPPLER'],
  ['the prop deaf to its pitch', 'propw', 'const isrP = pch / (60 * sr);', 'const isrP = 1 / (60 * sr);', 'SP_DOPPLER'],
  ['the air never filters', 'spcfg', 'const f = Math.sqrt(3 / (ABS_K * dd));', 'const f = 20000 + 0 * dd;', 'SP_ABSORB'],
  ['the page forgets the air', 'space', 'SC.absorbAt(SD, 2); fAbs = SD[3];', 'fAbs = 20000;', 'SP_ABSORB'],
  ['a linear viewpoint fade', 'audio', 'XC_E[i] = Math.cos(a); XC_I[i] = Math.sin(a);', 'XC_E[i] = 1 - a / (Math.PI / 2); XC_I[i] = a / (Math.PI / 2);', 'SP_XFADE'],
  ['a 50 ms viewpoint', 'audio', 'const XFADE_S = 0.15,', 'const XFADE_S = 0.05,', 'SP_XFADE'],
  ['a reversal from the end', 'audio', 'x = XF[2] + (XF[0] - XF[2]) * u;', 'x = XF[0];', 'SP_XFADE'],
  ['the IR deaf to Sabine', 'spcfg', 'const dec = Math.exp(-6.907755 / (room.rt60[b] * fs));', 'const dec = Math.exp(-6.907755 / (1.0 * fs));', 'SP_IR'],
  ['a mono IR', 'spcfg', 'for (let ch = 0; ch < 2; ch++) {\n      const y = out[ch];', 'for (let ch = 0; ch < 2; ch++) {\n      const y = out[ch]; s = 0x2f6e2b1;', 'SP_IR'],
  ['the IR made on the frame', 'space', 'if (W.requestIdleCallback) W.requestIdleCallback(run, { timeout: 2000 }); else setTimeout(run, 0);', 'run();', 'SP_IR'],
  ['the IR never regenerated', 'space', 'if (key === G.irKey || key === G.irPending) return;', 'if (G.irKey || key === G.irPending) return;', 'SP_IR'],
  ['the shed\'s room everywhere', 'space', 'const v = on && G.irKey ? WETS[k] : 0;', 'const v = G.irKey ? WETS[k] : 0;', 'SP_IR'],
  ['the placeholder low-pass back', 'engine', "      if (sp) node.connect(sp, 0); else { node.connect(outExt, 0); node.connect(outInt, 0); }", "      if (sp) node.connect(sp, 0); else { node.connect(outExt, 0); node.connect(outInt, 0); }\n      { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; node.connect(lp, 0); }", 'SP_GRAPH'],
  ['the prop\'s parts not apart', 'srcprop', 'node.connect(sp, 1); sp.connect(sT, 0); sp.connect(sB, 1); splits.push(sp);', 'node.connect(sT, 0); splits.push(sp);', 'SP_GRAPH'],
  ['the interior layers through the cabin', 'srcaf', '        if (SPC) node.connect(int, 2);', '        if (SPC) node.connect(api.space.graph().cabIn, 2);', 'SP_GRAPH'],
  ['an omnidirectional prop', 'spcfg', 'if (kind === DIR_TONAL) { const g = s2 * (1 - TONAL_A * c) / TONAL_NORM; F[i + 1] = g > TONAL_FLOOR ? g : TONAL_FLOOR; return; }', 'if (kind === DIR_TONAL) { F[i + 1] = 1; return; }', 'SP_GRAPH'],
  ['the exhaust forward', 'spcfg', 'if (kind === DIR_EXHAUST) { F[i + 1] = 0.55 + 0.45 * (1 - c) * 0.5; return; }', 'if (kind === DIR_EXHAUST) { F[i + 1] = 0.55 + 0.45 * (1 + c) * 0.5; return; }', 'SP_GRAPH'],
  ['the panner in world coordinates', 'space', 'X3[0] = rx * L[3] + ry * L[4] + rz * L[5]; X3[1] = rx * L[6] + ry * L[7] + rz * L[8]; X3[2] = rx * L[9] + ry * L[10] + rz * L[11];', 'X3[0] = rx; X3[1] = ry; X3[2] = rz;', 'SP_GRAPH'],
  ['no lag published', 'space', '    if (A.lagS) A.lagS[0] = lag;\n', '\n', 'SP_GRAPH'],
  ['the engine ignores the lag', 'engine', 'const t = ctx.currentTime + (A.lagS ? A.lagS[0] : 0);', 'const t = ctx.currentTime;', 'SP_GRAPH'],
  ['no doppler on the voices', 'space', '      X3[3] = kDop; pitchGroup(gi);', '      X3[3] = 1; pitchGroup(gi);', 'SP_GRAPH'],
  ['a cut unheard', 'space', "      A.emit('space-cut');\n", '\n', 'SP_GRAPH'],
  ['the headset\'s curve unused', 'space', 'st(G.hsHi.gain, h.filters[0].gain);', 'st(G.hsHi.gain, 0);', 'SP_GRAPH'],
  ['the ambience not ducked inside', 'space', 'const k = cab ? cab.ambienceK : 1, hk = headsetKind();', 'const k = 1, hk = headsetKind();', 'SP_GRAPH'],
  ['the cabin\'s gain unset', 'space', 'st(G.cabGain.gain, Math.pow(10, cab.gainDb / 20));', '', 'SP_GRAPH'],
  ['the space allocates a frame', 'space', '    stats.frames++;\n', '    stats.frames++; stats.lastP = [P.s[0]];\n', 'SP_BUDGET'],
  ['the space schedules every frame', 'space', 'if (Math.abs(fAbs - last[o + 7]) > 0.015 * fAbs) {', 'if (true) {', 'SP_BUDGET'],
  ['three full voices', 'spcfg', 'CAP_FULL = 2, CAP_BAKED = 8;', 'CAP_FULL = 3, CAP_BAKED = 8;', 'SP_CRAFT'],
  ['audible past 5 km', 'spcfg', 'if (!(d <= TIER_ENGINE_M) || used >= cb + cf) break;', 'if (used >= cb + cf) break;', 'SP_CRAFT'],
  ['a seam in the loop', 'spcfg', 'out[j] = y[start + f + j] * go + y[start + i] * gi;', 'out[j] = y[start + f + j];', 'SP_CRAFT'],
  ['the craft deaf to the doppler', 'space', 'const rate = (k === i0 ? BL[3] : BL[4]) * kDop;', 'const rate = (k === i0 ? BL[3] : BL[4]);', 'SP_CRAFT'],
  ['a linear loop blend', 'space', 'const g = k === i0 ? (i1 === i0 ? 1 : Math.cos(Math.PI / 2 * u)) : k === i1 ? Math.sin(Math.PI / 2 * u) : 0;', 'const g = k === i0 ? (i1 === i0 ? 1 : 1 - u) : k === i1 ? u : 0;', 'SP_CRAFT'],
  // SND-AMB-1 (G1650-G1654)
  ['the ground beds never fade with height', 'ambmodel', 'const g = 1 - rv[R.g];', 'const g = 1;', 'AMBAGL'],
  ['a weight jumps', 'ambmodel', 'if (step > lim) step = lim; else if (step < -lim) step = -lim;', '', 'AMBSMOOTH'],
  ['the world read every frame', 'ambmodel', 'if (clk[1] < AM_PHASES || clk[0] < AM_ROUND_S) return 0;', 'if (clk[1] < AM_PHASES) return 0;', 'AMBSMOOTH'],
  ['the garage without its hangar', 'ambmodel', 'T[B.hangar] = 1;', 'T[B.hangar] = 0;', 'AMBPLACES'],
  ['the door wide open', 'ambmodel', 'T[B.forestDay] = 0.22 * day;', 'T[B.forestDay] = 0.9 * day;', 'AMBPLACES'],
  ['the forest the same at night', 'ambmodel', 'T[B.forestDay] = g * day * forest * rustle;', 'T[B.forestDay] = g * forest * rustle;', 'AMBPLACES'],
  ['the lake edge heard far inland', 'ambmodel', '1 - rv[R.nearOut]', '1 - 0.2 * rv[R.nearOut]', 'AMBPLACES'],
  ['the village zones unread', 'ambmodel', 'if (zk[i] === 1) { if (v > vil) vil = v; }', 'if (zk[i] === 1) { }', 'AMBPLACES'],
  ['a water lane fenced', 'ambmodel', ".filter(a => a.kind !== 'water')", '.filter(a => true)', 'AMBPLACES'],
  ['rocks on the sand', 'ambmodel', 'else if (sf === S_SAND) rocky = 0;', 'else if (sf === S_SAND) rocky = 1;', 'AMBPLACES'],
  ['the forest floor unsheltered', 'ambmodel', '0.65 * (fo > 1 ? 1 : fo)', '0 * (fo > 1 ? 1 : fo)', 'AMBPLACES'],
  ['frogs by day', 'ambmodel', 'T[B.frogsNight] = g * night * nearStill;', 'T[B.frogsNight] = g * day * nearStill;', 'AMBPLACES'],
  ['under water hears the wind', 'ambmodel', 'if (f[F.under] > 0) { T[B.shoreRocks] = 1; return T; }', 'if (f[F.under] > 0) { T[B.shoreRocks] = 1; }', 'AMBPLACES'],
  ['no storm in a gale', 'ambmodel', "['storm', 11, 17, 'windB', 1]", "['storm', 31, 37, 'windB', 1]", 'AMBPLACES'],
  ['the canopy\'s reclass inverted', 'ambmodel', 'I.canopy[k] < RECLASS ? WC_SHRUB : c', 'I.canopy[k] >= RECLASS ? WC_SHRUB : c', 'AMBJOLENE'],
  ['the loons up front', 'ambmodel', "['amb.loons', -17, -23, 0]", "['amb.loons', -6, -23, 0]", 'AMBLUFS'],
  ['the catalogue trim ignored', 'ambmodel', 'lv[b] = Math.pow(10, (BEDS[b][1] + (AM_LUFS - BEDS[b][2])) / 20);', 'lv[b] = Math.pow(10, BEDS[b][1] / 20);', 'AMBLUFS'],
  ['a stale LUFS', 'ambmodel', "['amb.lake.near', -10, -34.4, 0]", "['amb.lake.near', -10, -23, 0]", 'AMBLUFS'],
  ['the model allocates a frame', 'ambmodel', '    ambienceTargets(st);\n    if (clk[1] < AM_PHASES', '    ambienceTargets(st); st.last = [clk[0]];\n    if (clk[1] < AM_PHASES', 'AMBALLOC'],
  ['past the N cap', 'amb', '    if (n >= N) {', '    if (n >= N + 3) {', 'AMBBUDGET'],
  ['a silent bed never released', 'amb', '        if (tmr[b] >= RELEASE_S) { drop(b); n--; }', '', 'AMBBUDGET'],
  ['the potato decodes at full rate', 'amb', 'light: { budget: 8 * MB, n: 3, maxS: 20, decim: 2 },', 'light: { budget: 8 * MB, n: 3, maxS: 20, decim: 1 },', 'AMBBUDGET'],
  ['every bed fetched at the gesture', 'amb', '      applyTier(tierOf());', '      applyTier(tierOf()); for (let b = 0; b < NB; b++) if (has[b]) SM.load(BEDS[b][0]);', 'AMBGESTURE'],
  ['a gain scheduled every frame', 'amb', '      if (g === lastG[b]) continue;\n', '', 'AMBALLOC'],
  ['the cabin unmuffled', 'amb', 'else { k = CABIN[0]; lp = CABIN[1]; }', 'else { k = CLEAR[0]; lp = CLEAR[1]; }', 'AMBMUFFLE'],
  ['SND-SPACE unheard', 'amb', "offCabin = A.onEvent('cabin', onCabin);", 'offCabin = null;', 'AMBMUFFLE'],
  ['the class budget ignored', 'samples', 'if (C.bytes + size > C.budget) {', 'if (false) {', 'AMBSAMPLES'],
  ['release keeps the bytes', 'samples', 'if (C) C.bytes = Math.max(0, C.bytes - r.size);', 'if (C) C.bytes = C.bytes;', 'AMBSAMPLES'],
  ['no decimation', 'samples', 'const src = dec > 1 ? decimate(b.getChannelData(c), dec) : b.getChannelData(c)', 'const src = b.getChannelData(c)', 'AMBSAMPLES'],
  ['the decimation unfiltered', 'samples', 'acc += HB[i] * x[k];', 'acc += (i === 7 ? 1 : 0) * x[k];', 'AMBSAMPLES'],
  ['a released load kept', 'samples', '        if (recs[key] !== r || r.gen !== gen) return null;   // released while it loaded\n', '', 'AMBSAMPLES'],
  ['the decoded source kept', 'samples', 'r.bufs = [lb]; r.loopBuf = lb; r.size = size;', 'r.bufs = bufs; r.loopBuf = lb; r.size = size; C.bytes += sizeOf(bufs[0]);', 'AMBSAMPLES'],
  // SND-RADIO (G1675-G1679)
  ['the stations out of the ruling\'s order', 'music', "const STATIONS = [['jazz', 'Jazz'], ['lofi', 'Lo-fi / Hip-hop'],", "const STATIONS = [['lofi', 'Lo-fi / Hip-hop'], ['jazz', 'Jazz'],", 'RADIO_STATIONS'],
  ['an unknown station validates', 'music', "if (t.station != null && REAL_KEYS.indexOf(t.station) < 0)", "if (false)", 'RADIO_STATIONS'],
  ['one bag for every visit', 'music', 'bags = bagsBy[station] || (bagsBy[station] = lists.map(makeBag));', 'bags = lists.map(makeBag);', 'RADIO_STATIONS'],
  ['no lo-fi fallback', 'music', 'lists: own.map((l, c) => (l.length ? l : lo[c].slice()))', 'lists: own', 'RADIO_STATIONS'],
  ['the station not persisted', 'music', "station = s; prefPut('station', s);", 'station = s;', 'RADIO_STATIONS'],
  ['the radio off still plays', 'music', "const want = station === 'off' ? C_NONE : contextOf(", 'const want = contextOf(', 'RADIO_STATIONS'],
  ['a switch keeps the old track', 'music', '    PS[S_GAP] = -1;\n    if (a >= 0) fadeOut(a, XFADE_S);\n    if (!nextWithTalk(c))', '    PS[S_GAP] = -1;\n    if (!nextWithTalk(c))', 'RADIO_STATIONS'],
  ['no station row', 'music', "      pick('station', STATION_KEYS.concat(['off'])", "      if (0) pick('station', STATION_KEYS.concat(['off'])", 'RADIO_PICKER'],
  ['the empty station unsaid', 'music', " ? ' — no tracks yet, plays ' + labelOf(ST_DEFAULT) : '');", " ? '' : '');", 'RADIO_PICKER'],
  ['the keys over a binding', 'music', "if (keyBound(e.code)) return;", '', 'RADIO_PICKER'],
  ['the keys with a modifier', 'music', 'if (!e || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;', 'if (!e || e.repeat) return;', 'RADIO_PICKER'],
  ['the talk frequency not persisted', 'music', "prefPut('radioEvery', talkEvery);", '', 'RADIO_PICKER'],
  ['a voice at load', 'music', '\n  mountCreditLink();\n', '\n  mountCreditLink(); if (G.RADIO_TALK) G.RADIO_TALK.makeSpeaker(G).speak([{ text: LINES_ID }], {}, null);\n', 'RADIO_TALK', t => t.replace("  const PFX = 'flydiy.audio.';", "  const PFX = 'flydiy.audio.', LINES_ID = 'Radio Jolene';")],
  ['no bed under the voice', 'music', 'const BED_K = 0.16,', 'const BED_K = 1,', 'RADIO_TALK'],
  ['the bed never rises', 'music', 'fadeTo(a, trims[DK[a * K_N + K_TRACK]], BED_UP_S);', 'void 0;', 'RADIO_TALK'],
  ['the bed rises over 5 s', 'music', 'BED_UP_S = 1.5,', 'BED_UP_S = 5,', 'RADIO_TALK'],
  ['a break every track', 'music', 'PS[S_COUNT] >= talkEvery', 'PS[S_COUNT] >= 1', 'RADIO_TALK'],
  ['a break under a duck', 'music', "speaker.available() && !(PS[S_DUCK] > 0) &&", 'speaker.available() &&', 'RADIO_TALK'],
  ['a duck talks on', 'music', '    cancelTalk();   // a talk break never under an engine start or a stall warning\n', '', 'RADIO_TALK'],
  ['a hidden tab talks on', 'music', "au.onEvent('suspend', () => { cancelTalk(); for", "au.onEvent('suspend', () => { for", 'RADIO_TALK'],
  ['no watchdog', 'music', 'if (PS[S_TALK] <= 0) { if (speaker) speaker.cancel(true); endTalk(); } }', '}', 'RADIO_TALK'],
  ['every station talks', 'music', 'return station === ST_TALK && talkOn &&', 'return talkOn &&', 'RADIO_TALK', t => t.replace('if (station === ST_TALK) PS[S_COUNT]++;', 'PS[S_COUNT]++;')],
  ['the voice at full volume', 'music', 'Math.min(1, A.get(\'master\') * A.get(\'music\') * VOICE_K)', '1', 'RADIO_TALK'],
  ['the chosen voice ignored', 'radio', 'v.find(x => name && x.name === name) || ', '', 'RADIO_TALK'],
  ['the frame under a talk allocates', 'music', '    if (PS[S_TALK] > 0) { PS[S_TALK] -= dt;', '    if (PS[S_TALK] > 0) { C.lastTalk = [dt]; PS[S_TALK] -= dt;', 'RADIO_BUDGET'],
  ['the build loses radio_talk.js', 'build', "'audio/radio_talk.js', 'audio/music.js',", "'audio/music.js', 'audio/radio_talk.js',", 'RADIO_WIRING'],
  ['the talk through Web Audio', 'radio', '  function makeSpeaker(env) {\n', '  function makeSpeaker(env) {\n    const ac = E => new E.AudioContext();\n', 'RADIO_WIRING'],
  ['the build loses the ambience', 'build', "'audio/ambience_model.js', 'audio/ambience.js',", "'audio/ambience_model.js',", 'AMBWIRING'],
  ['AUDIO keeps the world to itself', 'audio', '    api.world = world || null;\n', '', 'AMBWIRING'],
  // SND-AMB-2 (G1660-G1666): each break of the emitters, red on its check
  ['owls by day', 'emmodel', '    w[3] = night * forest * ak;', '    w[3] = day * forest * ak;', 'EMITHABITAT'],
  ['gulls inland', 'emmodel', "q = (ac - 60) / 240; const shore = 1 - (q < 0 ? 0 : q > 1 ? 1 : q);", "q = (ac - 60) / 24000; const shore = 1 - (q < 0 ? 0 : q > 1 ? 1 : q);", 'EMITHABITAT'],
  ['a crow anywhere (no tree asked)', 'emmodel', '        if (cn >= 4) { p[0] = x;', '        if (cn >= 4 || pl === 1) { p[0] = x;', 'EMITHABITAT'],
  ['the dog out of the village', 'emmodel', "        if (inVillage(amb, x, z) || (f[F.built] > 0.1 && isBuilt(world, x, z))) {", "        if (true) {", 'EMITHABITAT'],
  ['the gap ignored', 'emmodel', '      if (wv <= 0.001 || t - st.last[sd] < SPT[o + 2]) continue;', '      if (wv <= 0.001) continue;', 'EMITRATE'],
  ['the dog not rare', 'emmodel', "    [S.dog, 300, 150, 'yard', 30, 120, 1, 'village'],", "    [S.dog, 30, 15, 'yard', 30, 120, 1, 'village'],", 'EMITRATE'],
  ['the cap ignored', 'emmodel', '    if (n >= st.cap || slot < 0) { st.refused[0]++; return -1; }', '    if (slot < 0) { st.refused[0]++; return -1; }', 'EMITRATE'],
  ['no pitch jitter', 'emmodel', "  SOUNDS.forEach((s, i) => { JIT[i] = s[6] != null ? s[6] : 1.5;", "  SOUNDS.forEach((s, i) => { JIT[i] = s[6] != null ? s[6] : 0.1;", 'EMITRATE'],
  ['no ceiling', 'emmodel', '  const CEIL_LO = 60, CEIL = 150;', '  const CEIL_LO = 600, CEIL = 1500;', 'EMITAGL'],
  ['the movers above the ceiling', 'emmodel', '    if (ak > 0 && prov && prov.objects) { nn = prov.objects(o) | 0;', '    if (prov && prov.objects) { nn = prov.objects(o) | 0;', 'EMITAGL'],
  ['the pass not bound to its car', 'emmodel', '    const v = fire(st, S.pickup, r, 1);', '    const v = fire(st, S.pickup, -1, 1);', 'EMITOBJECTS'],
  ['the pass too early', 'emmodel', 'const PASS = { reach: 140, tLo: 2.4, tHi: 3.6,', 'const PASS = { reach: 140, tLo: 6, tHi: 9,', 'EMITOBJECTS'],
  ['no station bell', 'emmodel', '          fire(st, S.bell, -1, 1);', '', 'EMITOBJECTS'],
  ['the mill at night', 'emmodel', '      if (ak <= 0 || st.clk[6] <= 0) continue;', '      if (ak <= 0) continue;', 'EMITOBJECTS'],
  ['the mill by the record\'s key', 'emmodel', '      else if (ns === \'house\' && HG && HG.PRESETS && HG.PRESETS[preset] && HG.PRESETS[preset].mill) sound = S.mill;', '      else if (/mill/.test(preset)) sound = S.mill;', 'EMITOBJECTS'],
  ['an outboard at night', 'emmodel', '    const bw = st.clk[7] > 0.2 ? ak : 0;   // by day', '    const bw = ak;', 'EMITOBJECTS'],
  ['the tram hum flat', 'emmodel', 'st.lG[li] = ak * (0.12 + 0.88 * vk);', 'st.lG[li] = ak;', 'EMITOBJECTS'],
  ['every key fetched at connect', 'em', '      applyTier(tierOf());', '      applyTier(tierOf()); for (const k in OWN) if (SM.has(k)) SM.load(k);', 'EMITGESTURE'],
  ['a procedural buffer made at once', 'em', '      if (r === 0 && want && loading < 0) begin(s);', '      if (r === 0 && (want || SYNTH[s]) && loading < 0) begin(s);', 'EMITGESTURE'],
  ['no doppler on the pass', 'em', '      const rate = st.vR[i] * k;', '      const rate = st.vR[i];', 'EMITPLAY'],
  ['the panner in the world\'s frame', 'em', '    const px = rx * Lf[0] + ry * Lf[1] + rz * Lf[2], py = rx * Lf[3] + ry * Lf[4] + rz * Lf[5], pz = rx * Lf[6] + ry * Lf[7] + rz * Lf[8];', '    const px = rx, py = ry, pz = rz;', 'EMITPLAY'],
  ['the cockpit unmuffled', 'em', '      else { k = CABIN[0]; lp = CABIN[1]; }', '      else { k = CLEAR[0]; lp = CLEAR[1]; }', 'EMITPLAY'],
  ['never released', 'em', '      if (r === 2 && !want && t - resT[s] > RELEASE_S && !playing(s)) { drop(s); continue; }', '', 'EMITBUDGET'],
  ['the one-shot class over its budget', 'samples', '        if (C.bytes + add > C.budget) {', '        if (false) {', 'EMITBUDGET'],
  ['the emitters allocate a frame', 'emmodel', '    clk[3] = d;\n    movers(st, prov);', '    clk[3] = d; st.trail = [d, t];\n    movers(st, prov);', 'EMITALLOC'],
  ['a panner moved every frame', 'em', '    if (Math.abs(px - last[o]) + Math.abs(py - last[o + 1]) + Math.abs(pz - last[o + 2]) > 0.05 + 0.002 * d) {', '    if (true) {', 'EMITALLOC'],
  ['the build loses the emitters', 'build', "              'audio/emitters_model.js', 'audio/emitters.js',", "              'audio/emitters_model.js',", 'EMITWIRING'],
  ['the movers unpublished', 'prem', '\n    soundObjects,', '\n    soundObjectsX: null,', 'EMITWIRING'],
  ['the pickup undeclared', 'samples', "    ['dog', 'a dog barking, far off'], ['mech.door', 'a door shutting'], ['vehicle.pickup', 'a pickup passing on gravel'],", "    ['dog', 'a dog barking, far off'], ['mech.door', 'a door shutting'],", 'EMITWIRING'],
  ['the one-shot baked into a loop', 'samples', "      if (KEYS[key] && KEYS[key].kind === 'oneshot') {\n        const add", "      if (false) {\n        const add", 'EMITSAMPLES'],
  ['an assignment ignored', 'samples', "    const clsOf = key => { const a = assigned[key]; if (a) return classes[a] || null;", "    const clsOf = key => { const a = null; if (a) return classes[a] || null;", 'EMITSAMPLES'],
  // SND-ANIMALS (G1705-G1709)
  ['the doe has no sound', 'emmodel', "    ['doe', 'doe', 'call', 150, 120, 45, 'day'],\n", '', 'ANIMAP'],
  ['the reader forgets the doe', 'anirun', "SPECIES: ['bear', 'elk', 'doe', 'orca', 'whale', 'bird']", "SPECIES: ['bear', 'elk', 'orca', 'whale', 'bird']", 'ANIMAP'],
  ['the elk not the emitters\' own', 'em', "'animal.elk': 1, ", '', 'ANIMAP'],
  ['the animals unpublished', 'prem', "    animalSounds: out => (ANIM ? ANIM.sound(out) : 0),", "    animalSoundsX: null,", 'ANIMAP'],
  ['a blow every surfaced frame', 'anirun', "    if (up && !one.wasUp) {\n      if (S.blow > 0) one.blowT = T;", "    if (up && S.blow > 0) one.blowT = T;\n    if (up && !one.wasUp) {", 'ANIBLOW'],
  ['the blow as it dives', 'anirun', "    if (up && !one.wasUp) {\n      if (S.blow > 0) one.blowT = T;", "    if (!up && one.wasUp) one.blowT = T;\n    if (up && !one.wasUp) {", 'ANIBLOW'],
  ['the blow at the pivot', 'anirun', "      x += d.x / hl * len * 0.33; z += d.z / hl * len * 0.33;", "", 'ANIBLOW'],
  ['the blows beyond reach', 'emmodel', "        if (d > rch) continue;\n", '', 'ANIBLOW'],
  ['the blows deaf to the wind', 'emmodel', "ac[1] = 1 - 0.6 * (q < 0 ? 0 : q > 1 ? 1 : q);", "ac[1] = 1 - 0 * (q < 0 ? 0 : q > 1 ? 1 : q);", 'ANIBLOW'],
  ['the elk at every hour', 'emmodel', "    aw[4] = 0.15 + 0.15 * night + 0.7 * twe;", "    aw[4] = 1;", 'ANIELK'],
  ['the elk not rare', 'emmodel', "    ['elk', 'elk', 'call', 1500, 40, 40, 'twilight'],", "    ['elk', 'elk', 'call', 1500, 4, 4, 'twilight'],", 'ANIELK'],
  ['the elk heard too far', 'emmodel', "    ['elk', 'elk', 'call', 1500, 40, 40, 'twilight'],", "    ['elk', 'elk', 'call', 2500, 40, 40, 'twilight'],", 'ANIELK'],
  ['a bugle without an opportunity', 'emmodel', "      if (how === 1) { st.hArm[k] = 1; continue; }", "      if (how === 1 && sd !== S.elk) { st.hArm[k] = 1; continue; }", 'ANIELK'],
  ['the bear heard far', 'emmodel', "    ['bear', 'bear', 'call', 150, 240, 60, 'near'],", "    ['bear', 'bear', 'call', 400, 240, 60, 'near'],", 'ANILAND'],
  ['the bear never startles', 'emmodel', "const STARTLE = { d: 60, agl: 40, p: 0.4, gap: 180 };", "const STARTLE = { d: 60, agl: 40, p: 0, gap: 180 };", 'ANILAND'],
  ['the bear startles high', 'emmodel', "        if (d < STARTLE.d && agl < STARTLE.agl) {", "        if (d < 3 * STARTLE.d) {", 'ANILAND'],
  ['the doe heard far', 'emmodel', "    ['doe', 'doe', 'call', 150, 120, 45, 'day'],", "    ['doe', 'doe', 'call', 400, 120, 45, 'day'],", 'ANILAND'],
  ['the gulls left behind', 'emmodel', "      if (!st.vOn[i] || st.vAF[i] <= 0) continue;", "      if (true) continue;", 'ANIGULL'],
  ['the gulls chatter', 'emmodel', "    ['bird', 'gull', 'flock', 450, 16, 6, 'gull'],", "    ['bird', 'gull', 'flock', 450, 1.6, 0.6, 'gull'],", 'ANIGULL'],
  ['the gulls at night', 'emmodel', "    ['bird', 'gull', 'flock', 450, 16, 6, 'gull'],", "    ['bird', 'gull', 'flock', 450, 16, 6, 'any'],", 'ANIGULL'],
  ['the mill procedural again', 'emmodel', "['mill', 'mill.stamp', 1, -4, 30, 0]", "['mill', null, 1, -4, 30, 0]", 'ANIMILL'],
  ['the stamp loop crossfaded', 'samples', "      const X = cut ? 0 : Math.max(1,", "      const X = false ? 0 : Math.max(1,", 'ANIMILL'],
  ['no fallback for the mill', 'em', "      if (!SYNTH[s]) { loading = -1; res[s] = 3; return; }", "      if (true) { loading = -1; res[s] = 3; return; }", 'ANIMILL'],
  ['the orca at the porpoise\'s pitch', 'emmodel', "['orcablow', 'animal.orca.blow', 0, -3, 20, 2.2, 0.5, 0.82]", "['orcablow', 'animal.orca.blow', 0, -3, 20, 2.2, 0.5, 1]", 'ANIPLAY'],
  ['variants repeat', 'em', "SM.pick(SOUNDS[s][1], true);", "SM.pick(SOUNDS[s][1], false);", 'ANIPLAY'],
  ['the animals fetched from afar', 'emmodel', "      if (d < rch * 1.15 && aa > 0) { st.want[sd] = 1; st.wantT[sd] = t; }", "      if (aa > 0) { st.want[sd] = 1; st.wantT[sd] = t; }", 'ANIPLAY'],
  ['the reader allocates', 'anirun', "    RD.out = out; RD.n = 0;", "    RD.trail = [out.length, RD.n]; RD.out = out; RD.n = 0;", 'ANIALLOC'],
  ['the model\'s animals allocate', 'emmodel', "    if (!n) return;\n    // THE HERDS", "    if (!n) return;\n    st.aTrail = [n, t];\n    // THE HERDS", 'ANIALLOC'],
  // SND-VOICE (G1626-G1629)
  ['a new track never announced', 'catalogue', '"id": "fma238392"', '"id": "fma238392x"', 'VOICE_CAT'],
  ['a gap after every clip', 'voice', 'src.start(t0 + a.t, r.off, a.dur);', 'src.start(t0 + a.t + 0.01 * srcs.length, r.off, a.dur);', 'VOICE_PLAY'],
  ['the codec pad played', 'voice', 'if (Math.abs(x[i]) > PAD_FLOOR) return Math.max(0, i / sr - LEAD_S);', 'if (Math.abs(x[i]) > PAD_FLOOR) return 0;', 'VOICE_PLAY'],
  ['a fetch before the gesture', 'voice', '      if (!c || !ctx) return Promise.resolve(null);', '      if (!c) return Promise.resolve(null);', 'VOICE_PLAY'],
  ['the budget never enforced', 'voice', 'for (const [k, r] of idle) { if (bytes <= budget) break; bytes -= r.size; recs.delete(k); }', '', 'VOICE_PLAY'],
  ['stop() forgets a source', 'voice', 'for (const x of srcs) { try { x.stop(); } catch (e) {} }', 'for (const x of srcs.slice(1)) { try { x.stop(); } catch (e) {} }', 'VOICE_PLAY'],
  ['the build drops the player', 'build', "'audio/voice_model.js', 'audio/voice.js',", "'audio/voice_model.js',", 'VOICE_WIRING'],
  ['the catalogue not inlined', 'build', 'window.FLYDIY_VOICE=${', 'window.FLYDIY_VOICES=${', 'VOICE_WIRING'],
  ['GATE MEDIA blind to the voice', 'mediachk', "'music_catalogue.json', 'voice_catalogue.json']", "'music_catalogue.json']", 'VOICE_WIRING'],
  // G1680-G1684 (SND-RADIO-2): the user's voice, the mix, the recorded voice in the talk, the space's frame
  ['no mix station', 'music', "['classical', 'Classical'], ['mix', 'Random']];", "['classical', 'Classical']];", 'RADIO_STATIONS'],
  ['the mix misses a station', 'music', 'for (const k of REAL_KEYS) stationLists(cat, k)', 'for (const k of REAL_KEYS.slice(1)) stationLists(cat, k)', 'RADIO_STATIONS'],
  ['the mix lists a track twice', 'music', 'for (let i = 0; i < m.length; i++) if (m[i]) l.push(i);', 'for (let i = 0; i < m.length; i++) if (m[i]) l.push(i, i);', 'RADIO_STATIONS'],
  ['a track tagged mix', 'music', "if (t.station != null && REAL_KEYS.indexOf(t.station) < 0)", "if (t.station != null && STATION_KEYS.indexOf(t.station) < 0)", 'RADIO_STATIONS'],
  ['the mix talks', 'music', "return station === ST_TALK && talkOn", "return (station === ST_TALK || station === ST_MIX) && talkOn", 'RADIO_TALK',
    t => t.replace("if (station === ST_TALK) PS[S_COUNT]++;", "if (station === ST_TALK || station === ST_MIX) PS[S_COUNT]++;").replace("PS[S_TUNE] = s === ST_TALK ? 1 : 0;", "PS[S_TUNE] = s === ST_TALK || s === ST_MIX ? 1 : 0;")],
  ['] skips the mix', 'music', 'return setStation(STATION_KEYS[i < 0 ? STATION_KEYS.indexOf(ST_DEFAULT) : (i + d + n) % n]);', 'return setStation(REAL_KEYS[i < 0 ? REAL_KEYS.indexOf(ST_DEFAULT) : (Math.min(i, REAL_KEYS.length - 1) + d + REAL_KEYS.length) % REAL_KEYS.length]);', 'RADIO_PICKER'],
  ['the talk never plays clips', 'music', 'speaker = RT ? (RT.makeTalker ? RT.makeTalker(G, voiceApi) : RT.makeSpeaker(G)) : null;', 'speaker = RT ? RT.makeSpeaker(G) : null;', 'RADIO_CLIPS'],
  ['all or nothing (no per-segment fallback)', 'radio', 'const c = resolves(x), g = groups[groups.length - 1];', 'const c = segs.every(resolves), g = groups[groups.length - 1];', 'RADIO_CLIPS'],
  ['a segment played with a clip missing', 'radio', 'return !!(v && x.clips && x.clips.length && !v.missing(x.clips).length); };', 'return !!(v && x.clips && x.clips.length); };', 'RADIO_CLIPS'],
  ['the speech over the clips', 'radio', "if (!g.clips) { say(g); return; }", "if (!g.clips) { say(g); if (i < groups.length) next(); return; }", 'RADIO_CLIPS'],
  ['the clips past the ducks', 'music', 'radioIn.connect(duck);', "radioIn.connect(au.bus('music'));", 'RADIO_CLIPS'],
  ['the clips at the speech\'s level', 'music', 'return VOICE_K * Math.pow(10, (LUFS_TARGET - l) / 20); };', 'return VOICE_K; };', 'RADIO_CLIPS'],
  // SND-RADIO-3 (G1700-G1704): THE LIVING RADIO
  ['a digit in a take', 'shipscript', 'Ninety years on this island', '90 years on this island', 'RADIO_LINT'],
  ['a colon in a take', 'shipscript', 'Mark your calendars, folks.', 'Mark your calendars: folks.', 'RADIO_LINT'],
  ['an acronym in a take', 'shipscript', 'four wheelers', 'ATVs', 'RADIO_LINT'],
  ['a spelled number in a take', 'shipscript', 'Doors open at the hall at ten.', 'Doors open at the hall at one zero.', 'RADIO_LINT'],
  ['a sentence run long', 'shipscript', 'at ten. The boat races', 'at ten and the boat races', 'RADIO_LINT'],
  ['a take that is not the written line', 'radioscript', 'Doors open at the hall at ten.', 'Doors open at the hall at eleven.', 'RADIO_LINT'],
  ['a store-listing title', 'voicescript', '"fma278388": "A Cloudy Life"', '"fma278388": "Calming Royalty Free Guitar A Cloudy Life"', 'RADIO_LINT'],
  ['the pools forget what was heard', 'radio', '    if (best) c.h[best] = c.n;\n', '\n', 'RADIO_HORIZON'],
  ['the program never advances', 'radio', 'c.k = (c.k + 1) % SCRIPT.program.length;', 'c.k = c.k % SCRIPT.program.length;', 'RADIO_HORIZON'],
  ['the program read out of order', 'radio', 'c.k = (c.k + 1) % SCRIPT.program.length;', 'c.k = (c.k + 7) % SCRIPT.program.length;', 'RADIO_HORIZON'],
  ['the cursor never saved', 'radio', '    try { if (E.localStorage) E.localStorage.setItem(CURSOR_KEY, JSON.stringify(c)); } catch (e) {}', '', 'RADIO_HORIZON'],
  ['a new session restarts the broadcast', 'radio', "    if (!c || typeof c !== 'object' || typeof c.k !== 'number'", "    c = null; if (!c || typeof c !== 'object' || typeof c.k !== 'number'", 'RADIO_HORIZON'],
  ['fog read as mist', 'radio', 'FOG_M = 1000,', 'FOG_M = 100,', 'RADIO_WX'],
  ['a gale read as a windy day', 'radio', "[34, 'windy'], [Infinity, 'gale']", "[60, 'windy'], [Infinity, 'gale']", 'RADIO_WX'],
  ['a low deck read as grey', 'radio', 'LOW_M = 300,', 'LOW_M = 30,', 'RADIO_WX'],
  ['no advice in the fog', 'radio', "if (sky === 'fog') hazards.push('fogPilot', 'fogBoat');", '', 'RADIO_WX'],
  ['eagles in a gale', 'radio', "if (day && (wind === 'calm' || wind === 'light') &&", 'if (day &&', 'RADIO_WX'],
  ['a lead for any part of the day', 'radio', 'return !p || p === k.tag; });', 'return true; });', 'RADIO_WX'],
  ['the weather one sentence', 'radio', '    const e1 = stalest(extras); if (e1) { const x = pick(c, e1); if (x) out.push(x); }\n', '\n', 'RADIO_WX'],
  ['the front never passes', 'radio', "const rain = !!(s && s.phase === 'passage');", 'const rain = false;', 'RADIO_WX'],
  ['a share-alike caller voice', 'voicecat', '"datasetLicence": "CC BY 4.0"', '"datasetLicence": "CC BY-NC-SA 4.0"', 'VOICE_LICENCE'],
  ['the CC BY credit dropped', 'voicecat', '"credit": "LibriTTS corpus', '"credit_": "LibriTTS corpus', 'VOICE_LICENCE'],
  ['a guest fine-tuned from lessac', 'voicecat', 'fine-tuned (600 epochs) from en_US-kristin-medium, itself trained from scratch on public-domain LibriVox', 'fine-tuned from en_US-lessac-medium (Blizzard 2013)', 'VOICE_LICENCE'],
  ['CREDITS forgets the officer\'s voice', 'credits', '**en_US-kristin-medium**', '**en_US-kristin2-medium**', 'VOICE_LICENCE'],
  ['john hosts', 'voicecat', ' "voice": {\n  "name": "norman",\n  "id": "en_US-norman-medium"', ' "voice": {\n  "name": "john",\n  "id": "en_US-john-medium"', 'VOICE_LICENCE'],
  ['a take that does not resolve', 'shipscript', '"file":"media/audio/voice/id_generic_1.', '"file":"media/audio/voice/id_generic_1x.', 'VOICE_CAT'],
  ['the host on the phone line', 'shipscript', '"v":"carl","cat":"call"', '"v":"norman","cat":"call"', 'VOICE_CAT'],
  ['the spoken title not the one said', 'voicescript', '"fma237449": "Ships"', '"fma237449": "Tall Ships"', 'VOICE_CAT'],
  ['no talk-up', 'music', 'const TALK_UP_S = 6, TUNE_LATE_S = 10;', 'const TALK_UP_S = 0, TUNE_LATE_S = 10;', 'RADIO_XFADE'],
  ['Radio Jolene keeps the garage\'s silences', 'music', '  const gapped = c => GAPPED[c] === 1 && !(station === ST_TALK && talkOn);', '  const gapped = c => GAPPED[c] === 1;', 'RADIO_XFADE'],
  ['the outro cut', 'music', 'const d = rem > xf ? rem : xf; fadeOut(a, d);', 'const d = rem > xf ? rem : xf; fadeOut(a, 0.1);', 'RADIO_XFADE'],
  ['the talk off never silent', 'music', '  const gapped = c => GAPPED[c] === 1 && !(station === ST_TALK && talkOn);', '  const gapped = c => GAPPED[c] === 1 && station !== ST_TALK;', 'RADIO_XFADE'],
  ['the script fetched off Radio Jolene', 'music', '    if (!ctx || station !== ST_TALK || !RT || !RT.load || RT.ready()) return;', '    if (!ctx || !RT || !RT.load || RT.ready()) return;', 'RADIO_CLIPS'],
  ['no late tune-in', 'music', '    RT.load(G).then(ok => { if (ok) lateTuneIn(); });', '    RT.load(G);', 'RADIO_CLIPS'],
  ['the takes not handed to the player', 'radio', '      if (ok && V && V.setClips) V.setClips(SCRIPT.items);', '', 'RADIO_CLIPS'],
  ['a cancelled break reads on', 'radio', '      if (h) { try { h.stop(); } catch (e) {} }\n      sp.cancel(true);', '      sp.cancel(true);', 'RADIO_CLIPS'],
  ['the watchdog on the text', 'music', '(speaker.seconds ? speaker.seconds(segs, RT.RATE) : RT.estSeconds(segs, RT.RATE))', '(RT.estSeconds(segs, RT.RATE) * 3)', 'RADIO_CLIPS'],
  ['a back-announce with no track id', 'music', '{ id: cat[t].id, title: cat[t].title, artist: cat[t].artist }', '{ title: cat[t].title, artist: cat[t].artist }', 'RADIO_CLIPS'],
  ['the frame boxes the doppler', 'space', 'SC.dopplerAt(SD, 4); kDop = SD[7];', 'kDop = dopBoxed(SD[4], SD[5], SD[6]);', 'SP_BUDGET',
    t => t.replace('  // ---- THE FRAME ----', '  function dopBoxed(c, vs, vl) { const k = SC.dopplerFactor(c, vs, vl); X3[3] = k; return k + 0; }\n  // ---- THE FRAME ----')],
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

if (SPB_CHILD) {
  const sub = JSON.parse(fs.readFileSync(SPB_CHILD, 'utf8'));
  console.log(JSON.stringify(spBudgetMeasure(Object.assign({}, SRC0, sub))));
  return;
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
  for (const r of report.concat(MUSIC_REPORT, SP_REPORT)) console.log('  info ' + r);
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
    if (process.env.AUDIO_TRACE) console.log('  .. ' + name + ' (' + check + ')');   // (a debugging aid: which mutation is running)
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
