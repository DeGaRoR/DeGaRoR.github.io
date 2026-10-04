// ENGINE SOUND CONFIG (SND-ENGINE, G1610-G1619; SOUND-2026-10-04 §3.1).
//
// PURE: (spec, engine index) -> the plain-object config the piston voice
// (engine_worklet.js, 'flydiy-engine') is built from. No Web Audio, no DOM,
// runs in node; GATE AUDIO (tools/audio/_engine_check.js) tests it.
//
// WHAT THE AEROPLANE SAYS AND WHERE IT IS READ:
//   rpm, gear, family, aspiration   the registry row (POWERPLANTS[type].engine)
//                                   or the build's custom row (engines[i].custom)
//   cylinders, layout, stroke       engines[i].sound — {cyl, arch, twoStroke,
//                                   dispL}, written by the editor's join
//                                   (tools/_cage_join.js, from the dials the
//                                   engine page shows; PHYSICS-INERT, declared:
//                                   nothing in the resolve or the solver reads it)
//                                   ...else a custom row's own name ("custom
//                                   Flat (boxer) 4-cyl 5.9 L", the join's format)
//                                   ...else ENGINE_SOUND_TABLE below, keyed by
//                                   the POWERPLANTS row (a build saved before the
//                                   join wrote the row)
//                                   ...else a flat four of 2.8 L, said so in
//                                   `source`
// Every number below the table is a STARTING POINT for the user's ear (SND-TUNE,
// wave 4), not a measurement — the firing frequency is the one thing the gate
// holds exactly.
'use strict';

// THE DECLARED FALLBACK (keyed by POWERPLANTS row). Generated from the
// editor's own presets (tools/_eng_page.js PRESETS through
// tools/_cage_join.js CAGE_JOIN_ENGINES: cyl, arch, twoStroke, and the
// displacement pi/4 bore^2 stroke cyl); GATE AUDIO's §config re-derives it
// from those two files and fails on any drift. Electric and turbine rows are
// absent on purpose: they have no piston voice (SND-PROP's wave).
const ENGINE_SOUND_TABLE = {
  a65_sensenich74:   { cyl: 4,  arch: 'flat',   twoStroke: 0, dispL: 2.80 },
  o200_eprops:       { cyl: 4,  arch: 'flat',   twoStroke: 0, dispL: 3.29 },
  io360_mccauley:    { cyl: 4,  arch: 'flat',   twoStroke: 0, dispL: 5.92 },
  jabiru2200_std:    { cyl: 4,  arch: 'flat',   twoStroke: 0, dispL: 2.21 },
  vw2180_wood:       { cyl: 4,  arch: 'flat',   twoStroke: 0, dispL: 2.18 },
  rotax912_warp:     { cyl: 4,  arch: 'flat',   twoStroke: 0, dispL: 1.21 },
  rotax277_pusher:   { cyl: 1,  arch: 'inline', twoStroke: 1, dispL: 0.28 },
  rotax582_ivo:      { cyl: 2,  arch: 'inline', twoStroke: 1, dispL: 0.58 },
  verner7u_wood:     { cyl: 7,  arch: 'radial', twoStroke: 0, dispL: 2.25 },
  rotec3600_std:     { cyl: 9,  arch: 'radial', twoStroke: 0, dispL: 3.61 },
  r985_hs2b20:       { cyl: 9,  arch: 'radial', twoStroke: 0, dispL: 16.17 },
  r1830_hs23e50:     { cyl: 14, arch: 'radial', twoStroke: 0, dispL: 29.98 },
  mikron3_wood:      { cyl: 4,  arch: 'inline', twoStroke: 0, dispL: 2.44 },
  gipsymajor1_wood:  { cyl: 4,  arch: 'inline', twoStroke: 0, dispL: 6.12 },
  hirth508_wood:     { cyl: 8,  arch: 'vee',    twoStroke: 0, dispL: 7.97 },
  argus10c_wood:     { cyl: 8,  arch: 'vee',    twoStroke: 0, dispL: 12.67 },
  o320_mccauley:     { cyl: 4,  arch: 'flat',   twoStroke: 0, dispL: 5.24 },
  o540_hartzell:     { cyl: 6,  arch: 'flat',   twoStroke: 0, dispL: 8.87 },
  io550_hartzell3:   { cyl: 6,  arch: 'flat',   twoStroke: 0, dispL: 9.05 },
  io720_hartzell3:   { cyl: 8,  arch: 'flat',   twoStroke: 0, dispL: 11.83 },
  rotax915_carbon:   { cyl: 4,  arch: 'flat',   twoStroke: 0, dispL: 1.35 },
  ranger440_wood:    { cyl: 6,  arch: 'inline', twoStroke: 0, dispL: 7.23 },
  w670_hs2b:         { cyl: 7,  arch: 'radial', twoStroke: 0, dispL: 10.94 },
  r755_hs2b:         { cyl: 7,  arch: 'radial', twoStroke: 0, dispL: 12.42 },
  m14p_v530:         { cyl: 9,  arch: 'radial', twoStroke: 0, dispL: 10.13 },
  r1340_hs12d40:     { cyl: 9,  arch: 'radial', twoStroke: 0, dispL: 22.02 },
  rotax503_wood:     { cyl: 2,  arch: 'inline', twoStroke: 1, dispL: 0.59 },
};
const ENGINE_SOUND_DEFAULT = { cyl: 4, arch: 'flat', twoStroke: 0, dispL: 2.8 };
const ENGINE_SOUND_ARCHS = ['flat', 'inline', 'vee', 'radial'];

// the custom row's name, as _cage_eng.js CAGE_ENG_FACTS writes it:
// "custom <archName> <n>-cyl <litres> L" (archName from _eng_gen.js ENG_ARCH)
const ENGINE_SOUND_ARCH_WORDS = [['flat', 'flat'], ['boxer', 'flat'], ['inline', 'inline'],
                                 ['radial', 'radial'], ['v', 'vee']];
function engineSoundParseName(name) {
  if (typeof name !== 'string') return null;
  const m = /(\d+)\s*-\s*cyl/i.exec(name);
  if (!m) return null;
  const lower = name.toLowerCase();
  let arch = null;
  for (const [w, a] of ENGINE_SOUND_ARCH_WORDS)
    if (new RegExp('(^|[^a-z])' + w + '([^a-z]|$)').test(lower)) { arch = a; break; }
  const L = /(\d+(?:\.\d+)?)\s*L\b/.exec(name);
  return { cyl: +m[1], arch: arch || 'flat', dispL: L ? +L[1] : null };
}

// a sound row is honest only inside the arrangements the voice knows
function engineSoundRowOk(s) {
  return !!(s && typeof s === 'object' && ENGINE_SOUND_ARCHS.includes(s.arch)
    && Number.isInteger(+s.cyl) && +s.cyl >= 1 && +s.cyl <= 28);
}

// THE FIRING ORDER, as a list of 0-based cylinder numbers in the order they
// fire. Every layout here fires EVENLY — 720/N degrees on a four-stroke,
// 360/N on a two-stroke — so the firing frequency is rpm/60 x N/2 (or x N);
// what the order changes is WHICH pipe each pulse goes down, and that is the
// character (a boxer's two-and-two bank pattern, a radial's every-other).
function engineSoundFiringOrder(arch, N, twoStroke) {
  const seq = a => a.map(c => c - 1);
  if (N === 1) return [0];
  if (twoStroke) return Array.from({ length: N }, (_, i) => i);   // 1-2(-3): one per 360/N
  if (arch === 'radial') {
    // single row (odd N): every other cylinder, 1-3-5-...-2-4-...; two rows
    // (even N): the R-1830's 1-10-5-14-..., i.e. +N/2+2 around the circle
    const step = N % 2 ? 2 : N / 2 + 2;
    const out = [];
    for (let k = 0, c = 0; k < N; k++, c = (c + step) % N) out.push(c);
    return out;
  }
  if (arch === 'flat') {
    if (N === 2) return [0, 1];
    if (N === 4) return seq([1, 3, 2, 4]);                 // Continental / Lycoming
    if (N === 6) return seq([1, 4, 5, 2, 3, 6]);           // O-540 / IO-550
    if (N === 8) return seq([1, 5, 8, 3, 6, 4, 7, 2]);     // IO-720
  }
  if (arch === 'inline') {
    if (N === 2) return [0, 1];
    if (N === 4) return seq([1, 3, 4, 2]);
    if (N === 6) return seq([1, 5, 3, 6, 2, 4]);
  }
  if (arch === 'vee' && N === 8) return seq([1, 5, 4, 8, 6, 3, 7, 2]);
  if (arch === 'vee' && N === 12) return seq([1, 12, 5, 8, 3, 10, 6, 7, 2, 11, 4, 9]);
  // anything else: odd cylinders then even, still evenly spaced
  const out = [];
  for (let c = 0; c < N; c += 2) out.push(c);
  for (let c = 1; c < N; c += 2) out.push(c);
  return out;
}

const r4 = x => Math.round(x * 1e4) / 1e4;

// the registry row of engine `i`, a custom row winning (G134's rule)
function engineSoundRow(spec, i, registry) {
  const REG = registry || (typeof POWERPLANTS !== 'undefined' ? POWERPLANTS : null);
  const E = spec && Array.isArray(spec.engines) ? spec.engines[i] : null;
  if (!E) return { E: null, row: null };
  const base = REG && REG[E.type] ? REG[E.type].engine : null;
  const row = E.custom && isFinite(E.custom.powerW) ? Object.assign({}, base || {}, E.custom) : base;
  return { E, row };
}

// THE CONFIG. `registry` defaults to the bundle's POWERPLANTS.
function engineSoundConfig(spec, engineIndex, registry) {
  const i = engineIndex | 0;
  const { E, row } = engineSoundRow(spec, i, registry);
  const fam = row && row.family;
  if (!E || !row || fam === 'electric' || fam === 'turbine') {
    return { v: 1, piston: false, engineIndex: i, type: E ? E.type : null,
             family: fam || null, ratedRpm: row && row.rpm || 0,
             gear: row && row.gear > 0 ? row.gear : 1 };
  }
  // the cylinders: the join's row, the custom name, the table, the default
  let src = 'default', S = ENGINE_SOUND_DEFAULT;
  const tab = ENGINE_SOUND_TABLE[E.type] || null;
  const parsed = E.custom ? engineSoundParseName(E.custom.name) : null;
  if (engineSoundRowOk(E.sound)) { S = E.sound; src = 'spec.sound'; }
  else if (parsed) { S = parsed; src = 'custom.name'; }
  else if (tab) { S = tab; src = 'table'; }
  const N = Math.round(+S.cyl);
  const arch = S.arch;
  // the stroke: the row the sound came from, else the family (a custom
  // two-stroke says so through its family, never through its name)
  const twoStroke = (src === 'spec.sound' || src === 'table') ? !!+S.twoStroke
    : (fam === 'two');
  const dispL = +S.dispL > 0 ? +S.dispL
    : (parsed && parsed.dispL > 0 ? parsed.dispL : (tab ? tab.dispL : ENGINE_SOUND_DEFAULT.dispL));
  const ratedRpm = row.rpm > 0 ? row.rpm : 2500;
  const idleK = (typeof GEN_SHAFT !== 'undefined' && GEN_SHAFT.idleK > 0) ? GEN_SHAFT.idleK : 0.28;
  const gear = row.gear > 0 ? row.gear : 1;

  // the firing order -> each cylinder's crank offset in the cycle: the k-th
  // to fire reaches the ignition phase k/N of a cycle after the first
  const order = engineSoundFiringOrder(arch, N, twoStroke);
  const offsets = new Array(N).fill(0);
  order.forEach((c, k) => { offsets[c] = r4(((1 - k / N) % 1 + 1) % 1); });

  // THE PIPES, from the displacement. Per-cylinder volume sets the bore (the
  // chamber waveguide) and the scale of every runner (bigger engine, longer
  // pipes, lower resonances); the whole engine's displacement sets the
  // collector and the tail pipe. 0.7 L a cylinder (the A-65) is scale 1.
  const Vc = dispL / N;                          // litres a cylinder
  const s = Math.cbrt(Vc / 0.7);                 // runner scale
  const S2 = Math.cbrt(dispL / 2.8);             // whole-engine scale
  const bore = Math.cbrt(4 * Vc * 1e-3 / Math.PI);   // m, bore ~ stroke
  const intakeLen = [], exhaustLen = [], extractorLen = [];
  for (let c = 0; c < N; c++) {
    let ex, xt, inl = 0.40 * s;
    if (twoStroke) {
      // a tuned pipe: a short header into one expansion chamber and silencer
      ex = 0.28 * s; xt = 0.85 * s; inl = 0.22 * s;
    } else if (arch === 'radial') {
      // short stacks into a collector ring that leaves at the bottom: the
      // path round the ring is the cylinder's angle from the outlet
      const rows = N > 9 ? 2 : 1, perRow = Math.ceil(N / rows);
      const th = 2 * Math.PI * (c % perRow) / perRow;            // 0 = top
      const ring = 0.38 * S2 * Math.abs(Math.PI - th);
      ex = 0.22 * s; xt = 0.12 + ring + (rows > 1 && c >= perRow ? 0.15 * S2 : 0);
    } else if (arch === 'flat') {
      // two banks (odd / even cylinder), front to rear: each bank one long
      // and one short header, crossed — the two-and-two pattern of a boxer
      const bank = c % 2 ? -1 : 1, rowN = Math.max(1, Math.ceil(N / 2) - 1);
      const pos = Math.floor(c / 2) / rowN - 0.5;
      ex = 0.55 * s * (1 + 0.14 * pos * bank); xt = 0.30 * S2;
    } else if (arch === 'vee') {
      const half = N / 2, bank = c < half ? 1 : -1, pos = (c % half) / Math.max(1, half - 1) - 0.5;
      ex = 0.50 * s * (1 + 0.12 * pos); xt = 0.35 * S2 * (bank > 0 ? 1 : 1.08);
    } else {
      // an in-line bank into a collector at its rear end
      const pos = N > 1 ? c / (N - 1) - 0.5 : 0;
      ex = 0.50 * s * (1 - 0.16 * pos); xt = 0.30 * S2;
    }
    intakeLen.push(r4(inl)); exhaustLen.push(r4(ex)); extractorLen.push(r4(xt));
  }
  const radial = arch === 'radial';
  const blower = row.aspiration === 'super' ? { kind: 'super', hz: 3200, level: 0.012 }
    : row.aspiration === 'turbo' ? { kind: 'turbo', hz: 6000, level: 0.018 }
    : { kind: 'none', hz: 0, level: 0 };
  const cfg = {
    v: 1, piston: true, engineIndex: i, type: E.type, name: row.name || E.type,
    source: src, family: twoStroke ? 'two' : 'four', arch, cyl: N, twoStroke: twoStroke ? 1 : 0,
    dispL: r4(dispL), ratedRpm, idleRpm: Math.round(idleK * ratedRpm), gear,
    // what the gate checks: firing pulses per crank revolution
    firingPerRev: twoStroke ? N : N / 2,
    firingOrder: order.map(c => c + 1), offsets,
    cylinderLen: r4(bore), intakeLen, exhaustLen, extractorLen,
    // upstream's reflection factors (Antonio-R1's sounds_worklet.htm)
    intakeOpenRefl: 0.01, intakeClosedRefl: 0.95,
    exhaustOpenRefl: 0.01, exhaustClosedRefl: 0.95,
    straightPipeLen: r4((twoStroke ? 0.25 : radial ? 0.60 : 0.45) * S2), straightPipeRefl: 0.01,
    // THE MUFFLER, by family until the build says (ROADMAP Phase 2 item 3):
    // an aero four-stroke's is a light can inside the heat muff, a radial's
    // collector is nearly open, a two-stroke's silencer box is the real one
    mufflerLens: (twoStroke ? [0.10, 0.15, 0.21, 0.28] : [0.06, 0.09, 0.12, 0.16]).map(x => r4(x * S2)),
    mufflerAction: twoStroke ? 0.35 : radial ? 0.08 : 0.12,
    outletLen: 0.04, outletRefl: 0.01,
    ignitionTime: twoStroke ? 0.05 : 0.03, pistonK: 1.5, ignitionK: 5.0,
    intakeNoiseK: twoStroke ? 0.6 : 0.35, intakeNoiseHz: 11000,
    blockLpHz: 125, crankFluct: 0.01, crankFluctHz: 75,
    mix: { intake: twoStroke ? 0.35 : 0.25, block: 0.15, exhaust: 0.65 },
    gain: 0.1,
    jitter: { idle: twoStroke ? 0.45 : 0.32, cruise: 0.05, cold: 0.25,
              misIdle: twoStroke ? 0.04 : 0.01 },
    // a big engine cranks slower (SND-ENGINE-2: the O-540's growl "a little
    // down pitch"; nothing under 6 L moves)
    crankRpm: Math.round(twoStroke ? 290
      : Math.max(120, Math.min(280, 300 - 12 * dispL - 2.5 * Math.pow(Math.max(0, dispL - 6), 2)))),
    // THE START (SND-ENGINE-2, the user's review: the whine "R2D2", "too
    // present", the engine "too weak when starting"): the starter is a low
    // growl (band centre `hz` at crankRpm, lower for a bigger motor) some
    // 25 dB(A) under the old whine; the cranking engine (crankLevel, each
    // compression's chuff down the pipe at crankPuff) carries the sound over
    // it, and the catch's first firings bark ~6 dB(A) over the cranking
    // (catchK). GATE AUDIOENG §9 holds all three.
    starter: { ratio: twoStroke ? 8 : 14,
               hz: Math.round(Math.max(180, Math.min(420, 330 * Math.pow(2.8 / dispL, 0.3)))),
               level: twoStroke ? 0.0015 : 0.003 },
    crankLevel: 0.13, crankPuff: 1.0, catchK: 2.0,
    // the misfire's cough in the pipe: a low-passed thump with a 4 ms rise,
    // ~8 dB under the old white-noise crack (SND-ENGINE-2: "clicks too loud
    // vs the engine", "could be better blended")
    cough: { level: 1.2, hz: 900, rise: 0.004 },
    blower,
    // the cooling ticks: dry noise clicks (SND-ENGINE-2: no modes, no bells)
    tick: { rate: 4, level: 0.03 },
    heatTau: 120,
  };
  cfg.gain = engineSoundGain(cfg);
  return cfg;
}

// THE LEVEL (the harness's calibration, a law not a table): the voice's
// full-power RMS grows with the cylinder count and falls with the pipes'
// length; this holds every validated engine's full-power peak near -6 dBFS
// so the bus has headroom. Measured by tools/audio/render.js --calibrate.
// A two-stroke sits 3 dB lower (SND-ENGINE-2: the 582 "a tad annoying, too
// loud" — its every-revolution firing and bright intake read louder than the
// RMS says).
function engineSoundGain(cfg) {
  return r4(0.25 * Math.pow(cfg.dispL / 2.8, 0.15) / Math.sqrt(Math.max(1, cfg.cyl) / 4)
            * (cfg.twoStroke ? 0.708 : 1));
}

// SEVERAL ENGINES (SND-ENGINE-2): each voice at -10 log10(N) dB, so N engines
// sum (incoherently: their cranks are not phase-locked) to the level of one —
// a twin is not 3 dB louder than a single. N = the aeroplane's piston voices.
function engineSoundCountGain(n) {
  return 1 / Math.sqrt(Math.max(1, n | 0));
}
function engineSoundPistonCount(spec, registry) {
  let n = 0;
  const N = spec && Array.isArray(spec.engines) ? spec.engines.length : 0;
  for (let i = 0; i < N; i++) {
    const { E, row } = engineSoundRow(spec, i, registry);
    if (E && row && row.family !== 'electric' && row.family !== 'turbine') n++;
  }
  return n;
}

// THE SIM -> THE VOICE'S PARAMETERS (allocation-free; SND-CORE's
// audio_params calls it per engine per frame). Writes six numbers into
// `dst` at `o`: rpm, load, running, starter, starve, cold — the processor's
// AudioParams, in its descriptor order. Prop rpm is NOT a parameter: the
// voice's control output carries it (engine rpm / cfg.gear), so the prop
// turns with the cranking, the surge and the run-down the engine voice makes.
//   rpm      out.rpmEng[i] (the solver's engine speed, through the gearbox)
//   load     the engine's own throttle (ctl.thr x its lever) x out.powerK
//   running  eng[i].running; starter: eng[i].crank > 0
//   starve   the last STARVE_S seconds of fuel (fuel.enduranceS), and 1 once
//            out.starved — the burn stops the engine there; the voice coughs
//            on the way
//   cold     1 at the first catch, gone after COLD_S of running — the voice
//            keeps no clock of its own across a session, so the caller holds
//            the warm-up: pass `runS` (seconds this engine has run)
const ENGINE_SOUND_STARVE_S = 20, ENGINE_SOUND_COLD_S = 240;
function engineSoundInputs(sim, i, dst, o, runS) {
  o = o | 0;
  const out = sim && sim.out, eng = sim && sim.eng && sim.eng[i];
  const ctl = sim && sim.ctl, fuel = sim && sim.fuel;
  const rpm = out && out.rpmEng && out.rpmEng[i] > 0 ? out.rpmEng[i] : 0;
  const running = eng ? !!eng.running : !!(out && rpm > 0);
  let thr = ctl ? +ctl.thr || 0 : 0;
  const lev = ctl && ctl.eng && ctl.eng[i];
  if (lev) thr *= lev.on ? +lev.thr : 0;
  thr = thr < 0 ? 0 : thr > 1 ? 1 : thr;
  const pk = out && out.powerK >= 0 ? Math.min(1.2, out.powerK) : 1;
  let starve = 0;
  if (out && out.starved) starve = 1;
  else if (fuel && fuel.kind !== 'battery' && isFinite(fuel.enduranceS))
    starve = Math.max(0, Math.min(1, 1 - fuel.enduranceS / ENGINE_SOUND_STARVE_S));
  const run = runS > 0 ? runS : 0;
  dst[o] = rpm;
  dst[o + 1] = running ? Math.min(1, thr * pk) : 0;
  dst[o + 2] = running ? 1 : 0;
  dst[o + 3] = eng && eng.crank > 0 ? 1 : 0;
  dst[o + 4] = starve;
  dst[o + 5] = running ? Math.max(0, 1 - run / ENGINE_SOUND_COLD_S) : 0;
  return dst;
}
const ENGINE_SOUND_PARAMS = ['rpm', 'load', 'running', 'starter', 'starve', 'cold'];

// the two shaft speeds of a config at an engine rpm — the gearbox split the
// prop voice (SND-PROP) needs; the worklet's control output is the live one
function engineSoundShafts(cfg, engineRpm) {
  const g = cfg && cfg.gear > 0 ? cfg.gear : 1;
  return { engineRpm, propRpm: engineRpm / g,
           firingHz: cfg && cfg.piston ? engineRpm / 60 * cfg.firingPerRev : 0 };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ENGINE_SOUND_TABLE, ENGINE_SOUND_DEFAULT, ENGINE_SOUND_ARCHS,
                     ENGINE_SOUND_PARAMS, ENGINE_SOUND_STARVE_S, ENGINE_SOUND_COLD_S,
                     engineSoundConfig, engineSoundInputs, engineSoundShafts,
                     engineSoundFiringOrder, engineSoundParseName, engineSoundRowOk,
                     engineSoundGain, engineSoundCountGain, engineSoundPistonCount };
} else if (typeof window !== 'undefined') {
  window.ENGINE_SOUND = { ENGINE_SOUND_TABLE, ENGINE_SOUND_PARAMS, engineSoundConfig,
                          engineSoundInputs, engineSoundShafts, engineSoundCountGain,
                          engineSoundPistonCount };
}
