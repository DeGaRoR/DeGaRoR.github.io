// PROP SOUND CONFIG (SND-PROP, G1620-G1629; SOUND-2026-10-04 §3.2-§3.4).
//
// PURE: (spec, engine index, registry?, the solver's prop record?) -> the plain
// configs the voices in prop_worklet.js are built from. No Web Audio, no DOM,
// runs in node; GATE AUDIOENG's prop sections (tools/audio/_prop_check.js) test it.
//
//   propSoundConfig(spec, i, registry, prop) -> {
//     v, engineIndex, type, family ('four' | 'two' | 'electric' | 'turbine'),
//     driver: 'piston' | 'turbine' | 'electric'   which voice turns the prop
//     prop:   { blades, D, Tstatic, gear, pinion, ratedPropRpm, gain, ... }   'flydiy-prop'
//     turbine | electric: the driver's own config when the engine voice is not
//             the piston one ('flydiy-turbine' / 'flydiy-electric')
//   }
//
// WHERE EACH NUMBER COMES FROM
//   blades   spec.engines[i].sound.blades -> spec.prop.blades (the build's prop
//            layer, 60_gen_spec.js clamps 2-6) -> the registry's prop row ->
//            2 (audio_params' own order: the two agree by construction)
//   D, Tstatic  the solver's prop record (def.params.prop) when passed, else
//            the registry row's prop, else 1.8 m / 1000 N
//   gear     the engine row (custom row first, G134's rule); 1 = direct drive
//   pinion   THE GEARBOX'S TEETH, nominal: the Rotax boxes by ratio (C 2.62 =
//            55/21, B 2.58 = 62/24, 912's 2.43 = 51/21, 2.27 = 50/22), any
//            other reduction 21 teeth; direct drive and the turbine 0 (the
//            PT6's planetary box is the turbine voice's, not modelled yet)
//   turbine  Ng 100 % = 37 500 rpm (the PT6A family), idle 52 %, three axial
//            stages + one centrifugal impeller with NOMINAL blade counts
//   electric pole pairs 10 on an aircraft motor (EMRAX / E-811 class, >= 5 kW),
//            7 on an RC outrunner; PWM 12 kHz (aircraft) / 16 kHz (RC)
// Every level below is a STARTING POINT for SND-TUNE (wave 4); the gate holds
// the frequencies (BPF, firing, mesh) exactly, not the levels.
'use strict';

const PROP_SOUND_GEARBOX = [   // [ratio, pinion teeth, wheel teeth] — nominal
  [2.62, 21, 55], [2.58, 24, 62], [2.43, 21, 51], [2.27, 22, 50],
];
const PROP_SOUND_TURBINE = { ngMaxRpm: 37500, ngIdle: 0.52, ngStart: 0.17, stages: [26, 39, 44], impeller: 30 };

function propSoundRow(spec, i, registry) {
  const REG = registry || (typeof POWERPLANTS !== 'undefined' ? POWERPLANTS : null) || {};
  const E = spec && Array.isArray(spec.engines) ? spec.engines[i] : null;
  if (!E) return { E: null, row: null, PR: null };
  const base = REG[E.type] || null;
  const en = base ? base.engine : null;
  const row = E.custom && isFinite(E.custom.powerW) ? Object.assign({}, en || {}, E.custom) : en;
  return { E, row, PR: base ? base.prop : null };
}

function propSoundPinion(gear) {
  if (!(gear > 1.01)) return 0;
  for (const [r, p] of PROP_SOUND_GEARBOX) if (Math.abs(gear - r) < 0.006) return p;
  return 21;
}

function propSoundConfig(spec, engineIndex, registry, prop) {
  const i = engineIndex | 0;
  const { E, row, PR } = propSoundRow(spec, i, registry);
  const r = row || {};
  const fam = r.family || 'four';
  const pr = prop || PR || {};
  const sd = E && E.sound;
  const blades = (sd && sd.blades > 0) ? Math.round(sd.blades)
               : (spec && spec.prop && spec.prop.blades > 0) ? Math.round(spec.prop.blades)
               : (pr.blades > 0 ? Math.round(pr.blades) : 2);
  const D = pr.D > 0 ? +pr.D : 1.8;
  const Tstatic = pr.Tstatic > 0 ? +pr.Tstatic : 1000;
  const gear = r.gear > 0 ? +r.gear : 1;
  const rated = r.rpm > 0 ? +r.rpm : 2500;
  const driver = fam === 'turbine' ? 'turbine' : fam === 'electric' ? 'electric' : 'piston';
  const out = {
    v: 1, engineIndex: i, type: E ? E.type : null, family: fam, driver,
    prop: {
      blades: Math.max(1, Math.min(8, blades)), D, Tstatic, gear,
      pinion: driver === 'piston' ? propSoundPinion(gear) : 0,
      ratedPropRpm: Math.round(rated / gear),
      // the levels (SND-TUNE's): tonal, broadband share, gear whine, thickness share, unsteady floor,
      // blade-to-blade irregularity
      gain: propSoundGain(D, blades, driver),
      broadband: driver === 'electric' ? 0.6 : 0.5,
      whine: 0.03, thickness: 0.25, unsteady: 0.06, irregularity: 0.03, snarl: 1,
    },
    turbine: null, electric: null,
  };
  if (driver === 'turbine') {
    out.turbine = Object.assign({ v: 1, engineIndex: i, ratedPropRpm: Math.round(rated / gear), gain: 0.35, roar: 0.6 },
                                PROP_SOUND_TURBINE, { stages: PROP_SOUND_TURBINE.stages.slice() });
  } else if (driver === 'electric') {
    const big = (r.powerW || 0) >= 5000;
    out.electric = { v: 1, engineIndex: i, gear, polePairs: big ? 10 : 7, pwmHz: big ? 12000 : 16000,
                     gain: 0.012, pwm: 0.25 };
  }
  return out;
}

// THE LEVEL (a law, the harness's calibration: tools/audio/render_prop.js
// --calibrate): a bigger disc is louder at the same tip Mach (the source's
// area), more blades share the load (each tone sits higher, B times the
// frequency, the fundamental lower). Holds a full-power static prop near
// -14 dBFS peak, under the engine voice's -6 (the mix ~ -8).
function propSoundGain(D, blades, driver) {
  const b = Math.max(2, blades | 0);
  const k = 0.1 * Math.pow(Math.max(0.2, D) / 1.9, 0.5) * Math.sqrt(2 / b);
  return Math.round(k * 1e4) / 1e4;
}

// THE SIM -> THE VOICES' PARAMETERS (allocation-free; src_prop.js calls them
// per engine per frame off the parameter block P). Each writes into `dst` at
// `o`, in the processor's descriptor order.
//   prop:   rpm, thrust, thr, c, V, alpha, beta, interior
//   driver: rpm, power, running, starter
const PROP_SOUND_PARAMS = ['rpm', 'thrust', 'thr', 'c', 'V', 'alpha', 'beta', 'interior'];
const PROP_DRIVER_PARAMS = ['rpm', 'power', 'running', 'starter'];
function propSoundInputs(P, i, dst, o) {
  o = o | 0;
  const s = P.s, I = P.I;
  const run = (+P.running[i] || 0) > 0;
  dst[o] = +P.rpm[i] || 0;
  dst[o + 1] = +P.thrustPer[i] || 0;
  dst[o + 2] = run ? Math.max(0, Math.min(1, +P.thr[i] || 0)) : 0;
  dst[o + 3] = +s[I.c] || 340;
  dst[o + 4] = +s[I.V] || 0;
  dst[o + 5] = +s[I.alpha] || 0;
  dst[o + 6] = +s[I.beta] || 0;
  dst[o + 7] = (+s[I.interior] || 0) > 0 ? 1 : 0;
  return dst;
}
function propDriverInputs(P, i, dst, o) {
  o = o | 0;
  const run = (+P.running[i] || 0) > 0;
  dst[o] = +P.rpm[i] || 0;
  dst[o + 1] = run ? Math.max(0, Math.min(1, +P.thr[i] || 0)) : 0;
  dst[o + 2] = run ? 1 : 0;
  dst[o + 3] = (+P.crank[i] || 0) > 0 ? 1 : 0;
  return dst;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PROP_SOUND_GEARBOX, PROP_SOUND_TURBINE, PROP_SOUND_PARAMS, PROP_DRIVER_PARAMS,
                     propSoundConfig, propSoundPinion, propSoundGain, propSoundInputs, propDriverInputs };
} else if (typeof window !== 'undefined') {
  window.PROP_SOUND = { PROP_SOUND_PARAMS, PROP_DRIVER_PARAMS, propSoundConfig, propSoundInputs, propDriverInputs };
}
