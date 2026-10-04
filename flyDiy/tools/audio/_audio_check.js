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
  const C = { ctx: 0, nodes: 0, sched: 0, suspend: 0, resume: 0, close: 0, listen: 0 };
  const L = {}, DL = {}, timers = [];
  const store = opt.store || {};
  const param = v => ({ value: v, setTargetAtTime(x) { this.value = x; C.sched++; }, cancelScheduledValues() {},
    setValueAtTime(x) { this.value = x; }, linearRampToValueAtTime(x) { this.value = x; C.sched++; } });
  const node = () => ({ connect() {}, disconnect() {} });
  class AudioContextStub {
    constructor() { C.ctx++; this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; this.audioWorklet = { addModule: u => { C.module = u; return Promise.resolve(); } }; }
    createGain() { C.nodes++; return Object.assign(node(), { gain: param(1) }); }
    createDynamicsCompressor() { C.nodes++; return Object.assign(node(), { threshold: param(0), knee: param(0), ratio: param(0), attack: param(0), release: param(0) }); }
    resume() { C.resume++; return Promise.resolve(); }
    suspend() { C.suspend++; return Promise.resolve(); }
    close() { C.close++; return Promise.resolve(); }
  }
  const on = (M) => ({ add(t, fn) { (M[t] = M[t] || []).push(fn); C.listen++; }, rm(t, fn) { const a = M[t]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } } });
  const wl = on(L), dl = on(DL);
  const doc = { hidden: false, hasFocus: () => true, addEventListener: dl.add, removeEventListener: dl.rm };
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
  vm.runInNewContext(S.audio, ctx, { filename: 'audio.js' });
  const fire = (M, t, ev) => { for (const fn of (M[t] || []).slice()) fn(ev || { type: t }); };
  return { A: win.AUDIO, C, win, doc, store, L, DL,
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
  if (!/\{ k: 'audio', label: 'sound'/.test(S.editor) || !/t\.k === 'audio' && window\.AUDIO\) window\.AUDIO\.mount\(/.test(S.editor)) F.push('the shed rail has no `audio` item mounting AUDIO');
  return F;
}

const CHECKS = { NUMBERS: checkNumbers, CONTACTS: checkContacts, BUDGET: checkBudget, GESTURE: checkGesture,
                 SILENCE: checkSilence, SETTINGS: checkSettings, SOURCES: checkSources, WIRING: checkWiring };

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
];

function runChecks(S, report) {
  const res = {};
  for (const k in CHECKS) {
    try { res[k] = CHECKS[k](S, k === 'BUDGET' ? report : null); }
    catch (e) { res[k] = ['threw: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)]; }
  }
  return res;
}

let fails = 0, pristine = null;
const say = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails++; };
if (!ONLY_SELFTEST) {
  const report = [];
  const res = pristine = runChecks(SRC0, report);
  for (const k in res) {
    say(!res[k].length, k + (res[k].length ? ': ' + res[k].length + ' failure(s)' : ''));
    for (const f of res[k]) console.log('         ' + f);
  }
  for (const r of report) console.log('  info ' + r);
  for (const b of FLOWN) {
    const AP = loadParams(SRC0.params), o = AP.audioParamsBlock();
    AP.audioParams(b.sim, { mode: 'chase' }, b.def, o, null, 1 / 60);
    console.log('  info ' + b.name.padEnd(24) + ' ' + Array.from({ length: o.nE }, (_, i) =>
      'prop ' + o.rpm[i].toFixed(0) + ' / engine ' + o.rpmEng[i].toFixed(0) + ' rpm, firing ' + o.fireHz[i].toFixed(1) + ' Hz (' + o.cyl[i] + ' cyl' + (o.twoStroke[i] ? ', 2-stroke' : '') + '), BPF ' + o.bpfHz[i].toFixed(1) + ' Hz (' + o.blades[i] + ' blades), tip M ' + o.tipM[i].toFixed(3)).join(' | '));
  }
}
// D: the selftest
{
  let caught = 0;
  const base = pristine || runChecks(SRC0, null);   // a mutation proves a check only when that check is green on the pristine text
  for (const [name, file, find, repl, check, also] of MUT) {
    if (base[check].length) { say(false, 'SELF-TEST "' + name + '": ' + check + ' is already red on the pristine sources - nothing to prove'); continue; }
    const n = SRC0[file].split(find).length - 1;
    if (n !== 1) { say(false, 'SELF-TEST "' + name + '": the anchor is found ' + n + ' times in ' + FILES[file] + ' (want 1)'); continue; }
    const S = Object.assign({}, SRC0);
    S[file] = SRC0[file].replace(find, () => repl);
    if (also) S[file] = also(S[file]);
    let red;
    try { red = CHECKS[check](S, null); } catch (e) { red = ['threw: ' + e.message]; }
    if (red.length) caught++;
    if (ONLY_SELFTEST || !red.length) say(red.length > 0, 'SELF-TEST "' + name + '" turns ' + check + ' red' + (red.length ? ': ' + red[0] : ' - MISSED'));
  }
  // restored: the files on disk byte-identical to the start, and the pristine text green again
  const SRC1 = readAll();
  say(shaOf(SRC1) === SHA0, 'SELF-TEST the sources are byte-identical after ' + MUT.length + ' mutations (' + SHA0.slice(0, 12) + ')');
  // ...and those bytes are the ones every check passed on before the first mutation (re-measuring the heap here would
  // measure the 26 mutated contexts' garbage, not the sources)
  const bad = Object.keys(base).filter(k => base[k].length);
  say(!bad.length, 'SELF-TEST the restored sources are the ones checked green' + (bad.length ? ' - red: ' + bad.join(', ') : ''));
  say(caught === MUT.length, 'SELF-TEST ' + caught + ' / ' + MUT.length + ' mutations caught');
}
console.log(`GATE AUDIO: ${fails ? 'FAIL (' + fails + ')' : 'PASS'}`);
process.exitCode = fails ? 1 : 0;
