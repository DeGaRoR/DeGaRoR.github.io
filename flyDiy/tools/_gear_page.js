// GEAR — THE PARAMETER MODEL, shared. Lifted VERBATIM out of _gear.html so
// the bench and the cage editor's gear layer read ONE set of defaults, one
// per-station key expansion and one preset table. Nothing here draws or knows
// about THREE: the geometry is _gear_gen.js and the panel is each page's own.
//
// Extracted mechanically rather than retyped. The labels and ranges below are
// the bench's own, and a hand copy of them is exactly the second home this
// move exists to remove — a first attempt at this file was typed out and had
// drifted in six rows before it was compared.
'use strict';
(() => {
// ---- parameters -----------------------------------------------------------
// Stations are a FLAT set (st1..st4) so the panel, presets and the JSON
// export all work the way the cage pages do. x = 0 is a single
// centreline wheel; x > 0 is a mirrored pair.
const DEF = {
  // the stub airframe (a stand-in for the cage's contract)
  afLen: 6.20, afHalfW: 0.42, afHeight: 0.46, afKeelY: -0.42, afKeelRise: 0.55,
  mass: 620, cgZ: 1.25, cgY: 0.05, propR: 0.89, propZ: 3.85,
  // station 1 — the mains
  s1On: 1, s1Z: 0.62, s1X: 0.86, s1Leg: 1, s1R: 0.22, s1Drop: 0.62,
  s1Brake: 1, s1Steer: 0, s1Fair: 0,
  // ...the fairing's own instruments (G133): every default reproduces the
  // pre-G133 shell exactly, so an old save wears the same spat
  s1FairSkirt: 0, s1FairTail: 1, s1FairRake: 0, s1FairW: 1, s1LegFair: 0,
  // station 2 — the tail (or nose) wheel
  s2On: 1, s2Z: -3.05, s2X: 0, s2Leg: 3, s2R: 0.10, s2Drop: 0.20,
  s2Brake: 0, s2Steer: 1, s2Fair: 0,
  s2FairSkirt: 0, s2FairTail: 1, s2FairRake: 0, s2FairW: 1, s2LegFair: 0,
  // THE WHEEL'S OWN FORE/AFT (2026-09-04, the user: "tune the point of
  // attachment and where the wheels fall independently"). s<i>Z sites the
  // FITTING on the body; this moves the AXLE alone, on every leg family, so
  // a leg rakes without its root moving. 0 = each family's own law as before.
  s1AxZ: 0, s2AxZ: 0,
  // one build material for all of them — a set of spats is laid up as one job
  fairCons: 0,
  // the wheel
  whProfile: 0, whTread: 0, whRibs: 3, whRim: 0, whBolts: 6, whCap: 1,
  whValve: 1, whBrake: 0,
  whBulge: 1,        // sidewall inflation x (G33: the balloon look, on
                     // top of the carcass profile; 1 = as drawn before)
  // (a) bending beam
  beamAng: 62, beamW: 0.075, beamT: 0.020, beamTaper: 0.72, beamBow: 1.06,
  beamRake: 0.10,
  // (b) swinging link
  linkAng: 58, linkArmW: 0.042, linkSwing: -42,
  linkVee: 1, linkSpread: 0.46, linkX: 0, linkPanel: 1, linkPanelT: 0.004,
  shockKind: 1, shockAt: 0.72, shockZ: 0.34, shockAng: 30,
  bungeeSpan: 0.26,
  // (c) telescopic oleo
  oleoAng: 40, oleoDia: 0.058, oleoCyl: 0.55, oleoScissor: 0.052,
  oleoBrace: 1, oleoBraceZ: 0.42,
  // the tailwheel assembly
  twR: 0.10, twSpringLen: 0.52, twSpringDrop: 0.30, twSpringW: 0.052,
  twSpringT: 0.009, twLeaves: 3, twRake: 18, twTrail: 0.052,
  twLegDrop: 0.10, twSteer: 0, twSteerVis: 1, twHornY: 0.46, twHornZ: -0.30,
};
// EVERY LEG OPTION EXISTS PER STATION. The flat keys above are the base
// values; each station gets its own copy (s1_beamW, s2_beamW, ...) so the
// two are independent. The leg builders still read the plain names — a
// station composes its own view of P before building.
const LEG_ROWS = {
  0: [
    ['beamAng', 'attach angle', 0, 90, 1],
    ['beamW', 'blade width', 0.03, 0.16, 0.002],
    ['beamT', 'blade thick', 0.008, 0.05, 0.001],
    ['beamTaper', 'tip taper', 0.35, 1, 0.01],
    ['beamBow', 'bow out', 0.6, 1.6, 0.01],
    ['beamRake', 'axle rake', -0.8, 0.8, 0.01],
  ],
  1: [
    ['linkAng', 'pivot angle', 0, 90, 1],
    ['linkSwing', 'wheel angle', -75, 75, 1],
    ['linkArmW', 'tube dia', 0.02, 0.10, 0.002],
    ['linkVee', 'V-strut', 0, 1, 1],
    ['linkSpread', 'V base', 0.10, 1.00, 0.01],
    ['linkX', 'crossed struts (Cub X)', 0, 1, 1],
    ['linkPanel', 'V panel', 0, 1, 1],
    ['shockKind', 'shock', 0, 2, 1, ['coil-over', 'bungee', 'rubber stack']],
    ['shockAt', 'shock on arm', 0.15, 0.95, 0.01],
    ['shockZ', 'shock top z', -0.6, 1.0, 0.01],
    ['shockAng', 'shock top ang', 0, 90, 1],
    ['bungeeSpan', 'bungee wrap', 0.10, 0.70, 0.01],
  ],
  2: [
    ['oleoAng', 'attach angle', 0, 90, 1],
    ['oleoDia', 'cylinder dia', 0.03, 0.14, 0.002],
    ['oleoCyl', 'cylinder frac', 0.30, 0.80, 0.01],
    ['oleoScissor', 'scissor throw', 0.02, 0.12, 0.002],
    ['oleoBrace', 'drag brace', 0, 1, 1],
    ['oleoBraceZ', 'brace top z', -0.8, 0.8, 0.02],
  ],
  3: [
    ['twSpringLen', 'spring length', 0.20, 1.00, 0.01],
    ['twSpringDrop', 'spring drop', 0.05, 0.70, 0.005],
    ['twSpringW', 'spring width', 0.02, 0.10, 0.002],
    ['twSpringT', 'leaf thick', 0.004, 0.020, 0.001],
    ['twLeaves', 'leaves', 1, 4, 1],
    ['twRake', 'castor rake', 0, 50, 0.5],
    ['twTrail', 'castor trail', 0.01, 0.14, 0.002],
    ['twLegDrop', 'swivel drop', 0.03, 0.30, 0.005],
    ['twSteer', 'steer angle', -40, 40, 1],
    ['twSteerVis', 'springs+chains', 0, 1, 1],
    ['twHornY', 'rudder horn y', 0, 1.2, 0.01],
    ['twHornZ', 'rudder horn z', -1.2, 0.6, 0.01],
  ],
};
const LEG_KEYS = [];
for (const rows of Object.values(LEG_ROWS))
  for (const r of rows) if (LEG_KEYS.indexOf(r[0]) < 0) LEG_KEYS.push(r[0]);
for (let i = 1; i <= 2; i++)
  for (const k of LEG_KEYS) DEF['s' + i + '_' + k] = DEF[k];

const LEGS = ['beam', 'link', 'oleo', 'tailwheel'];
const STEERS = ['fixed', 'linked', 'castor'];

// THE WHEEL ROWS, shared (G33 — the cage panel had lost this group
// entirely; the port-the-full-surface rule again). Lifted verbatim from
// the bench's own group + the new sidewall bulge.
const WHEEL_ROWS = [
  ['whProfile', 'carcass', 0, 2, 1, ['standard', 'tundra balloon', 'slim']],
  ['whTread', 'tread', 0, 2, 1, ['ribbed', 'smooth', 'blocked']],
  ['whBulge', 'sidewall bulge ×', 0.85, 1.40, 0.01],
  ['whRibs', 'ribs', 1, 5, 1],
  ['whRim', 'rim', 0, 2, 1, ['cast disc', 'spoked', 'lightened']],
  ['whBolts', 'rim bolts', 3, 10, 1],
  ['whCap', 'hub cap', 0, 2, 1, ['none', 'domed', 'flat']],
  ['whValve', 'valve stem', 0, 1, 1],
  ['whBrake', 'brake type', 0, 1, 1, ['disc', 'drum']],
];

const PRESETS = {
  // stations sited on the REAL fuselage and tuned here until the CG
  // angle sat in its 15-18 window (it reads 15.7)
  taildragger: {
    s1On: 1, s1Z: 2.55, s1X: 0.86, s1Leg: 1, s1R: 0.22, s1Drop: 0.62,
    s1Brake: 1, s1Steer: 0, shockKind: 1, linkSwing: -42,
    s2On: 1, s2Z: -3.95, s2X: 0, s2Leg: 3, s2R: 0.10, s2Steer: 1,
    cgZ: 1.25, cgY: 0.05, propZ: 3.85,
  },
  // nose load reads 11.1% here, inside its 8-15 window
  tricycle: {
    s1On: 1, s1Z: 1.10, s1X: 0.90, s1Leg: 0, s1R: 0.20, s1Drop: 0.60,
    s1Brake: 1, s1Steer: 0,
    s2On: 1, s2Z: 3.70, s2X: 0, s2Leg: 2, s2R: 0.16, s2Drop: 0.60,
    s2Brake: 0, s2Steer: 1,
    cgZ: 1.45, cgY: 0.05, propZ: 3.95,
  },
  // a mixed pair, to keep the layers honestly independent: a blade on
  // the mains and a castoring oleo up front
  free: {
    s1On: 1, s1Z: 1.30, s1X: 0.86, s1Leg: 0, s1R: 0.20, s1Drop: 0.58,
    s2On: 1, s2Z: 3.60, s2X: 0, s2Leg: 2, s2R: 0.15, s2Drop: 0.58,
    s2Steer: 1, cgZ: 1.60, cgY: 0.05, propZ: 3.95,
  },
};
const gearDefaults = () => JSON.parse(JSON.stringify(DEF));

// A station's own view of P: the globals, with its leg options laid over.
// Takes P as an argument rather than closing over it — the one change from
// the bench's `legP`, because the cage editor's layer has a P of its own.
const gearLegP = (P, i) => {
  const o = Object.assign({}, P);
  for (const k of LEG_KEYS) o[k] = P['s' + i + '_' + k];
  return o;
};

// The live station list, in the shape _gear_gen.js's leg builders expect.
const gearStations = P => {
  const out = [];
  for (let i = 1; i <= 2; i++) {
    if (!P['s' + i + 'On']) continue;
    // G188: row 2 IS the third wheel — its identity, not its lateral offset.
    // Every classifier used to read "single" off `x <= 0.01`, so a tailwheel
    // row carrying a 0.1 offset was a pair of mains to the gear layer AND to
    // the join, which averaged the mains' station with it (2.4 m off).
    out.push({ id: i, single: i === 2, z: P['s' + i + 'Z'], x: P['s' + i + 'X'],
               leg: Math.round(P['s' + i + 'Leg']), R: P['s' + i + 'R'],
               drop: P['s' + i + 'Drop'], brake: P['s' + i + 'Brake'],
               axZ: +P['s' + i + 'AxZ'] || 0,
               fair: Math.round(P['s' + i + 'Fair'] || 0),
               fairSkirt: +P['s' + i + 'FairSkirt'] || 0,
               fairTail: +P['s' + i + 'FairTail'] || 1,
               fairRake: +P['s' + i + 'FairRake'] || 0,
               fairW: +P['s' + i + 'FairW'] || 1,
               legFair: Math.round(P['s' + i + 'LegFair'] || 0),
               steer: Math.round(P['s' + i + 'Steer']), P: gearLegP(P, i) });
  }
  return out;
};

window.GEAR_PAGE = { DEF, LEG_ROWS, LEG_KEYS, LEGS, STEERS, WHEEL_ROWS,
                     PRESETS, gearDefaults, gearLegP, gearStations };
})();
