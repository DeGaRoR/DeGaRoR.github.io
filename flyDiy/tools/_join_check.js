#!/usr/bin/env node
// _join_check.js — the JOIN verdict (G45). Feeds canned panel params and
// canned measurements through cageJoinSpec, asserts the declared table's
// field mappings, then runs the REAL pipeline (resolveSpec + genFrame)
// on the result and requires a finite CG — the join must always hand the
// game a spec it can build. Run: node tools/_join_check.js
'use strict';
const C = require('./flight_core.js');
const { GEN_TIPS, GEN_FLAPS, POWERPLANTS, resolveSpec, genFrame,
        GEN_PROP_MATS, GEN_SUSPENSION } = C;
const { cageJoinSpec, CAGE_JOIN_ENGINES, CAGE_JOIN_PROP_MATS } =
  require('./_cage_join.js');

let fails = 0;
const ok = (cond, label) => {
  console.log((cond ? '  ok     ' : '  FAIL   ') + label);
  if (!cond) fails++;
};

const T = {
  TIP_KEYS: Object.keys(GEN_TIPS),
  FLAP_KEYS: Object.keys(GEN_FLAPS),
  PRESET_NAMES: ['continental A-65', 'continental O-200', 'lycoming IO-360',
    'jabiru 2200', 'VW 2180', 'flat twin', 'flat six', 'rotax 912 (flat)',
    'rotax 277', 'rotax 582', 'P&W R-1830', 'RC 2212 outrunner',
    'RC 6374 outrunner', 'e-PPG 12 kW', 'FES sustainer', 'EMRAX 228'],
};
const P = {
  // G140: the stations, at NON-default values (tipX 0.24 is the old sweep
  // 3's own walk; crank fields ride the crank switch below)
  wgSpan: 11.2, wgChord: 1.55, wgChordTip: 1.09, wgTipX: 0.24,
  wgDihedral: 2.5, wgIncidence: 1.6, wgWashout: 1.2,
  wgCamber: 4, wgThick: 12,
  wgTip: T.TIP_KEYS.indexOf('rounded'), wgPos: 0, wgCentre: 1,
  wgBrace: 0, wgCrankAt: 0, wgCrankChord: 1.30, wgCrankX: 0.1,
  wgDihedralOut: 6, wgPanels: 3,
  wgFlapType: T.FLAP_KEYS.indexOf('slotted') >= 0
    ? T.FLAP_KEYS.indexOf('slotted') : 0,
  wgFlapSpan: 0.45, wgFlapChord: 0.22, wgAilSpan: 0.36, wgAilChord: 0.22,
  engPreset: T.PRESET_NAMES.indexOf('rotax 912 (flat)'),
  // G121.1: the fairing switch, at a NON-default state (1 = spat; the spec
  // default is 'none', so "it landed" cannot be impersonated by the default)
  s1Fair: 1,
  s2Fair: 2,                       // G121.2: the third wheel's, likewise
  // G133: the fairing's physics-bearing instruments, all at NON-default
  // states (defaults: tail 1 / legFair 0 / glassfibre). s2LegFair stays 0:
  // the trouser state (s2Fair 2) already fairs that leg.
  s1FairTail: 1.30, s2FairTail: 0.85, s1LegFair: 1, fairCons: 1,
  // G132: the drawn suspension and the drawn blade, every one at a
  // NON-default state for the same reason (defaults: bungee / 2 / wood /
  // the engine registry's own D)
  s1_shockKind: 2,                 // oleo
  cw_bladeN: 3, cw_propD: 2.10, cw_material: 3,   // 3-blade carbon, 2.10 m
};
// Every measured value here is chosen to DIFFER from what resolveSpec
// would derive on its own (side2 vs the default tandem2, 0.52 vs the
// side2 seat's 0.53, wheelR 0.21 vs the default 0.20...) — the resolved-
// spec assertions below cannot tell "the measurement landed" from "the
// default happens to match" otherwise. That is exactly how the G48 alias
// bug hid: the export carried the rows, the check read the EXPORT, and
// resolveSpec quietly rebuilt every one of them from the defaults.
const M = {
  gearType: 'taildragger', track: 1.62, contactR: 0.21,
  twX: 4.8, twY: 0.05, twR: 0.11,
  halfW: 0.52, cabH: 1.21, tailArm: 5.1,
  tailW: 0.14, tailBot: 0.31, tailTop: 0.52, cowlDeck: 0.66,
  noseGap: 0.93, cabLen: 1.24, postGap: 0.42, wingXLE: 0.55, gearX: 0.82,
  gearY: -0.31, shape: 'boom',
  hSpan: 2.4, hChord: 0.8, hX: 5.0, vHeight: 1.1, vChord: 0.9, vX: 5.2,
  stabH: 0.15,
  profile: [{ t: 0, w: 0.45, yb: -0.05, yt: 1.15 },
            { t: 0.5, w: 0.22, yb: 0.28, yt: 0.66 },
            { t: 1, w: 0.14, yb: 0.31, yt: 0.52 }],
  seating: 'side2', pilots: 2,
  cage: { waistY: -0.05 },
};

const s = cageJoinSpec(P, M, T);
ok(s.wings[0].span === 11.2, 'span passes verbatim');
ok(Math.abs(s.wings[0].taper - 1.09 / 1.55) < 1e-9, 'chord tip -> taper');
ok(s.wings[0].naca === 4412, 'camber 4 / thick 12 -> NACA 4412');
ok(s.wings[0].position === 'high' && s.wings[0].centre === 'glass',
   'position + centre map by name');
ok(s.wings[0].tip === 'rounded', 'tip maps by name');
// G140: the stations pass, sweep is never written, and crank fields stay
// null while the crank is off (a claim about a station that does not exist)
ok(s.wings[0].tipX === 0.24 && s.wings[0].sweep === undefined,
   'tip seat passes; sweep never written (G140)');
ok(s.wings[0].crankChord === null && s.wings[0].crankX === null,
   'crank fields null while the crank is off');
{
  const Pc = Object.assign({}, P, { wgCrankAt: 0.45 });
  const sc = cageJoinSpec(Pc, M, T);
  ok(sc.wings[0].crankChord === 1.30 && sc.wings[0].crankX === 0.1,
     'crank chord + seat pass when the crank is on');
}
ok(s.bracing.type === 'strut', 'bracing maps');
ok(s.gear.fairing === 'spat', 'fairing switch -> gear.fairing (G121.1)');
ok(s.gear.twFairing === 'full',
   'third-wheel switch -> gear.twFairing (G121.2)');
ok(s.gear.legFair === 'fair' && s.gear.twLegFair === 'none',
   'leg-fairing switches -> gear.legFair / twLegFair (G133)');
ok(s.gear.fairTail === 1.30 && s.gear.twFairTail === 0.85,
   'droplet sliders -> gear.fairTail / twFairTail (G133)');
ok(s.gear.fairMat === 'carbon', 'fairing build row -> gear.fairMat (G133)');
ok(s.gear.suspension === 'oleo',
   'drawn shock -> gear.suspension (G132)');
ok(s.prop && s.prop.D === 2.10 && s.prop.blades === 3 &&
   s.prop.material === 'carbon',
   'drawn blade -> prop D / blades / material (G132)');
ok(s.prop.pitch === undefined,
   'pitch stays the design tile\'s alone — the join claims no twist');
// the map is TOTAL and lands only on real physics rows — a hole would fall
// through clampSpec's unknown->wood fallback and fly a silent birch blade
ok(Array.isArray(CAGE_JOIN_PROP_MATS) && CAGE_JOIN_PROP_MATS.length === 8 &&
   CAGE_JOIN_PROP_MATS.every(k => GEN_PROP_MATS[k]),
   'prop material map total over the 8 finishes, every entry a real row');
ok(['spring', 'bungee', 'oleo'].every(k => GEN_SUSPENSION[k]),
   'every drawn shock kind is a real GEN_SUSPENSION row');
ok(s.controls.flap.type !== undefined && s.controls.aileron.span === 0.36,
   'control surfaces pass');
ok(s.engines[0].type === 'rotax912_warp', 'preset -> registry key');
ok(POWERPLANTS[s.engines[0].type] != null, 'registry row exists');
for (const k in CAGE_JOIN_ENGINES)
  ok(POWERPLANTS[CAGE_JOIN_ENGINES[k]] != null, 'registry row for "' + k + '"');
ok(s.gear.type === 'taildragger' && s.gear.track === 1.62 &&
   s.gear.wheelR === 0.21, 'gear measurements pass (wheelR, not contactR)');
ok(s.gear.twX === 4.8 && s.gear.twY === 0.05 && s.gear.twR === 0.11,
   'measured third wheel passes (G51)');
ok(s.cabin.halfW === 0.52 && s.cabin.h === 1.21, 'cabin envelope passes');
ok(s.fuselage.tailArm === 5.1, 'tail arm passes');
ok(s.fuselage.tailW === 0.14 && s.fuselage.tailBot === 0.31 &&
   s.fuselage.tailTop === 0.52, 'tail-end section passes (G49)');
ok(s.fuselage.cowlDeck === 0.66, 'cowl deck passes (G49)');
ok(s.cabin.noseGap === 0.93 && s.cabin.len === 1.24 &&
   s.fuselage.postGap === 0.42, 'pillar proportions pass (G52)');
ok(s.wings[0].xLE === 0.55, 'wing station passes (G52)');
ok(s.gear.x === 0.82, 'mains station passes (G52)');
ok(s.gear.y === -0.31, 'ride height passes (G53)');
ok(s.fuselage.shape === 'boom', 'shape family passes (G54)');
ok(Array.isArray(s.fuselage.profile) && s.fuselage.profile.length === 3,
   'boom profile passes (G54.1)');
ok(s.tail.hSpan === 2.4 && s.tail.hX === 5.0 && s.tail.vHeight === 1.1 &&
   s.tail.vX === 5.2 && s.tail.stabH === 0.15,
   'tail surfaces pass (G54.3)');
ok(s.cabin.seating === 'side2' && s.cabin.pilots === 2,
   'seating + pilots pass (sectioned)');
ok(s.cage && s.cage.waistY === -0.05, 'spec.cage rides along');

// the pipeline must BUILD what the join hands it — and the MEASURED rows
// must SURVIVE it. Asserting the export alone is how the G48 bug stayed
// green: genAlias overwrites the flat cab/fuse/seating/pilots aliases
// from the sections at the end of resolveSpec, so a row can be present
// in the export and gone from the aeroplane. Every measured row is
// therefore asserted on the RESOLVED spec, plus its `auto` flag — a row
// that arrived must NOT be marked as derived.
try {
  const RS = resolveSpec(JSON.parse(JSON.stringify(s)));
  const R = RS.spec;
  const fr = genFrame(R);
  const cg = fr.cg0;
  ok(cg.every(v => Number.isFinite(v)) && cg[3] > 50,
     'resolveSpec + genFrame -> finite CG, mass ' + cg[3].toFixed(0) + ' kg');
  ok(R.engine === 'rotax912_warp', 'engine survives normalisation');
  ok(R.cabin.halfW === 0.52 && !RS.auto['cab.halfW'],
     'RESOLVED cab halfW = measured 0.52, not auto');
  ok(R.cabin.h === 1.21 && !RS.auto['cab.h'],
     'RESOLVED cab h = measured 1.21, not auto');
  ok(R.fuselage.tailArm === 5.1 && !RS.auto['fuse.tailArm'],
     'RESOLVED tail arm = measured 5.1, not auto');
  ok(R.fuselage.tailW === 0.14 && R.fuselage.tailBot === 0.31 &&
     R.fuselage.tailTop === 0.52,
     'RESOLVED tail-end section = measured (tailY 0)');
  ok(R.fuselage.cowlDeck === 0.66 && !RS.auto['fuse.cowlDeck'],
     'RESOLVED cowl deck = measured 0.66, not auto');
  ok(R.cabin.noseGap === 0.93 && R.cabin.len === 1.24 && !RS.auto['cab.len'],
     'RESOLVED pillar proportions = measured, len not auto');
  // G121.1: the switch survives clampSpec and reaches the drag model's own
  // field — asserted on the RESOLVED spec, and at all three states, because
  // a mapping table with a hole is exactly the kind of thing that hides.
  ok(R.gear.fairing === 'spat', 'RESOLVED fairing = spat, through the clamp');
  ok(R.gear.twFairing === 'full',
     'RESOLVED third-wheel fairing = full, through the clamp');
  for (const [v, want] of [[0, 'none'], [2, 'full']]) {
    const Pv = Object.assign({}, P, { s1Fair: v });
    const Rv = resolveSpec(JSON.parse(JSON.stringify(
      cageJoinSpec(Pv, M, T)))).spec;
    ok(Rv.gear.fairing === want,
       'RESOLVED fairing state ' + v + ' -> ' + want);
  }
  // G133: the fairing instruments survive the clamp — and the clamp is a
  // real clamp (an out-of-range droplet lands on the bound, not verbatim)
  ok(R.gear.legFair === 'fair' && R.gear.twLegFair === 'none' &&
     R.gear.fairTail === 1.30 && R.gear.twFairTail === 0.85 &&
     R.gear.fairMat === 'carbon',
     'RESOLVED fairing instruments = drawn, through the clamp');
  {
    const Pv = Object.assign({}, P, { s1FairTail: 9, fairCons: 7 });
    const Rv = resolveSpec(JSON.parse(JSON.stringify(
      cageJoinSpec(Pv, M, T)))).spec;
    ok(Rv.gear.fairTail === 1.60 && Rv.gear.fairMat === 'glass',
       'RESOLVED out-of-range droplet clamps to 1.60, unknown layup -> glass');
  }
  // G132: the drawn suspension survives the clamp, at every state
  ok(R.gear.suspension === 'oleo',
     'RESOLVED suspension = drawn oleo, through the clamp');
  for (const [v, want] of [[0, 'spring'], [1, 'bungee']]) {
    const Pv = Object.assign({}, P, { s1_shockKind: v });
    const Rv = resolveSpec(JSON.parse(JSON.stringify(
      cageJoinSpec(Pv, M, T)))).spec;
    ok(Rv.gear.suspension === want,
       'RESOLVED suspension state ' + v + ' -> ' + want);
  }
  // G133: the leg KIND outranks the (link-only) shock row — an oleo leg
  // flies an oleo and a beam leg flies spring steel, whatever the hidden
  // shock row holds
  for (const [leg, want] of [[0, 'spring'], [2, 'oleo']]) {
    const Pv = Object.assign({}, P, { s1Leg: leg, s1_shockKind: 1 });
    const Rv = resolveSpec(JSON.parse(JSON.stringify(
      cageJoinSpec(Pv, M, T)))).spec;
    ok(Rv.gear.suspension === want,
       'RESOLVED suspension from leg kind ' + leg + ' -> ' + want);
  }
  // G132: the drawn blade reaches the THRUST MODEL — D sticks through the
  // null-means-derive door (put only fills null), and the derived name
  // carries the family, which is the one string a plaque will print
  ok(R.prop.D === 2.10 && R.prop.blades === 3 && R.prop.material === 'carbon',
     'RESOLVED prop = drawn 3-blade carbon 2.10 m');
  ok(typeof R.prop.name === 'string' && /carbon/i.test(R.prop.name) &&
     /2.10/.test(R.prop.name),
     'RESOLVED prop name derived from the drawn blade: ' + R.prop.name);
  ok(R.fuselage.postGap === 0.42, 'RESOLVED post gap = measured 0.42');
  ok(R.wings[0].xLE === 0.55 && !RS.auto['wing.xLE'],
     'RESOLVED wing LE station = measured 0.55, not auto');
  ok(R.gear.x === 0.82, 'RESOLVED mains station = measured 0.82');
  ok(R.cabin.seating === 'side2' && R.crew === 2,
     'RESOLVED seating side2, crew 2');
  ok(R.gear.track === 1.62 && R.gear.wheelR === 0.21,
     'RESOLVED gear track + wheelR = measured');
  ok(R.gear.y === -0.31 && !RS.auto['gear.y'],
     'RESOLVED ride height = measured -0.31, not auto (G53)');
  ok(R.fuselage.shape === 'boom', 'RESOLVED shape family = measured boom');
  ok(Array.isArray(R.fuselage.profile) && R.fuselage.profile.length === 3 &&
     Math.abs(R.fuselage.profile[1].yb - 0.28) < 1e-9,
     'RESOLVED boom profile = measured rows, clamped envelope');
  ok(R.tail.hSpan === 2.4 && R.tail.hX === 5.0 && !RS.auto['tail.hX'] &&
     R.tail.vHeight === 1.1 && R.tail.vX === 5.2 && R.tail.stabH === 0.15,
     'RESOLVED tail surfaces = measured, stations not auto');
  // the frame must actually FOLLOW the profile: the mid-boom station's floor
  // sits at the measured 0.28, not on the family curve
  {
    const fr2 = genFrame(R);
    const bx = R.fuse.boxRear, ta = R.fuse.tailArm;
    let bestI = -1, bestD = 1e9;
    fr2.nodes.forEach((n, i) => {
      if (!n.tag || n.tag.indexOf('S') !== 0 || n.tag.indexOf('B') < 0) return;
      const t = (n.p[0] - bx) / Math.max(1e-6, ta - bx);
      if (t > 0.05 && Math.abs(t - 0.5) < bestD) { bestD = Math.abs(t - 0.5); bestI = i; }
    });
    const tB = (fr2.nodes[bestI].p[0] - bx) / (ta - bx);
    const want = 0.28 * ((tB <= 0.5 ? tB / 0.5 : (1 - (tB - 0.5) / 0.5))) +
      (tB <= 0.5 ? -0.05 * (1 - tB / 0.5) : 0.31 * ((tB - 0.5) / 0.5));
    ok(Math.abs(fr2.nodes[bestI].p[1] - want) < 0.02,
       'FRAME mid-boom floor follows the measured profile (' +
       fr2.nodes[bestI].p[1].toFixed(3) + ' vs ' + want.toFixed(3) + ')');
  }
  ok(R.gear.twX === 4.8 && R.gear.twY === 0.05 && R.gear.twR === 0.11,
     'RESOLVED tailwheel station/height/radius = measured');
  ok(Math.abs(R.gear.contactR -
      0.21 * Math.cos((R.gear.camber || 0) * Math.PI / 180)) < 1e-9,
     'RESOLVED contactR derives from the measured wheelR');
} catch (e) {
  ok(false, 'pipeline threw: ' + e.message);
}

// a bare-minimum export (no measurements) must still build
try {
  const s2 = cageJoinSpec(P, null, T);
  const fr2 = genFrame(resolveSpec(JSON.parse(JSON.stringify(s2))).spec);
  ok(fr2.cg0.every(Number.isFinite), 'measurement-less export still builds');
} catch (e) {
  ok(false, 'measurement-less export threw: ' + e.message);
}

// THE COVERING IS JOINED (2026-09-04): skinOn 0 -> fuselage.covering 'open',
// absent otherwise; resolved, an open frame is LIGHTER (no cloth on the
// fuselage bays) and DRAGGIER (the truss in the wind) than the same build
// covered — and the covered build's own numbers are the ones it always had
// (the delta rule, as the gear's).
try {
  ok(s.fuselage.covering === undefined, 'default skinOn writes no covering');
  const sO = cageJoinSpec(Object.assign({}, P, { skinOn: 0 }), M, T);
  ok(sO.fuselage.covering === 'open', 'skinOn 0 -> fuselage.covering open');
  const RO = resolveSpec(JSON.parse(JSON.stringify(sO))).spec;
  ok(RO.fuselage.covering === 'open', 'RESOLVED covering = open');
  const dS = C.buildGen(JSON.parse(JSON.stringify(s)));
  const dO = C.buildGen(JSON.parse(JSON.stringify(sO)));
  const mS = dS.nodes.reduce((t, n) => t + n.m, 0);
  const mO = dO.nodes.reduce((t, n) => t + n.m, 0);
  ok(mO < mS - 2, 'an open frame is lighter than the covered one (' +
     mS.toFixed(1) + ' -> ' + mO.toFixed(1) + ' kg)');
  ok(dO.params.fusCdA[0] > dS.params.fusCdA[0] + 0.05,
     'an open frame is draggier (fusCdA ' + dS.params.fusCdA[0].toFixed(3) +
     ' -> ' + dO.params.fusCdA[0].toFixed(3) + ' m2)');
  const sB = JSON.parse(JSON.stringify(s)); sB.fuselage.covering = 'bogus';
  const RC = resolveSpec(sB).spec;
  ok(RC.fuselage.covering === 'skin', 'a nonsense covering clamps to skin');
} catch (e) {
  ok(false, 'covering join threw: ' + e.message);
}

// THE MOUNTS ARE JOINED (2026-09-04): engMount 1/2/3 -> engines[].mount, the
// drawn units' stations ride in as x/y/z, a pair is two entries; resolved,
// the frame hangs the engine where the join said and a pair pulls twice.
try {
  ok(s.engines.length === 1 && s.engines[0].mount === 'nose' &&
     s.engines[0].x === undefined, 'default mount: nose, no station written');
  const MU = Object.assign({}, M, { engUnits: [{ x: 3.1, y: 0.62, z: 0 }] });
  const sP = cageJoinSpec(Object.assign({}, P, { engMount: 1 }), MU, T);
  ok(sP.engines[0].mount === 'pusher' && sP.engines[0].x === 3.1 &&
     sP.engines[0].y === 0.62, 'engMount 1 -> pusher at the drawn station');
  const RP = resolveSpec(JSON.parse(JSON.stringify(sP))).spec;
  ok(RP.engAt && RP.engAt[0].mount === 'pusher' && RP.engAt[0].x === 3.1,
     'RESOLVED engAt = the drawn pusher station');
  const dP = C.buildGen(JSON.parse(JSON.stringify(sP)));
  const eN = dP.refs.engine.map(i => dP.nodes[i]);
  ok(eN.length === 2 && eN.every(n => Math.abs(n.p[0] - 3.1) < 1e-9 && n.m > 20),
     'pusher frame: two mount nodes at x 3.1 carrying the engine (' +
     eN.map(n => n.m.toFixed(1)).join('/') + ' kg)');
  ok(dP.params.nEngines === 1, 'a pusher is one engine');
  const MW = Object.assign({}, M, { engUnits: [{ x: 0.9, y: 1.4, z: 2.1 }, { x: 0.9, y: 1.4, z: -2.1 }] });
  const sW = cageJoinSpec(Object.assign({}, P, { engMount: 3 }), MW, T);
  ok(sW.engines.length === 2 && sW.engines.every(e => e.mount === 'wing' && e.z === 2.1),
     'engMount 3 -> a wing pair, |z| 2.1');
  const dW = C.buildGen(JSON.parse(JSON.stringify(sW)));
  const wN = dW.refs.engine.map(i => dW.nodes[i]);
  ok(dW.params.nEngines === 2 && wN.length === 2 &&
     Math.abs(wN[0].p[2] + wN[1].p[2]) < 1e-9 && Math.abs(Math.abs(wN[0].p[2]) - 2.1) < 1e-9,
     'wing pair: nEngines 2, mirrored nacelle nodes at |z| 2.1');
  const sT = cageJoinSpec(Object.assign({}, P, { engMount: 2, engPylonH: 0.4 }), M, T);
  ok(sT.engines[0].mount === 'wingTop' && sT.engines[0].pylon === 0.4 &&
     sT.engines[0].x === undefined, 'engMount 2 -> over the wing, pylon 0.4, station derived');
  const RT = resolveSpec(JSON.parse(JSON.stringify(sT))).spec;
  ok(RT.engAt[0].mount === 'wingTop' && RT.engAt[0].y > RT.cab.h + 0.4 - 1e-9,
     'RESOLVED over-the-wing engine sits a pylon above the deck (' +
     RT.engAt[0].y.toFixed(2) + ' m)');
  const dT = C.buildGen(JSON.parse(JSON.stringify(sT)));
  ok(dT.refs.engine.length === 2 && dT.nodes[dT.refs.engine[0]].p[1] > RT.cab.h,
     'over-the-wing frame: mount nodes above the cabin');
} catch (e) {
  ok(false, 'mount join threw: ' + e.message);
}

// THE TWIN BOOMS ARE JOINED (2026-09-04, cut 1): the booms' half-track and
// length write tail.type twinBoom; a measured fin counts twice in Sv; the
// frame still builds (the centreline post stands in — the stated approximation)
try {
  const sT = cageJoinSpec(P, Object.assign({}, M, { boomX: 1.25, boomLen: 3.2, vHeight: 0.9, vChord: 0.8 }), T);
  ok(sT.tail.type === 'twinBoom' && sT.tail.boomX === 1.25, 'boomX -> tail.type twinBoom');
  const RT2 = resolveSpec(JSON.parse(JSON.stringify(sT))).spec;
  ok(Math.abs(RT2.tail.Sv - 2 * 0.9 * 0.8) < 1e-9, 'RESOLVED Sv = two measured fins (' + RT2.tail.Sv.toFixed(3) + ')');
  const frT = genFrame(RT2);
  ok(frT.cg0.every(Number.isFinite), 'a twin-boom spec builds');
  ok(frT.parts.BOOMS && frT.parts.FIN2 != null &&
     Math.abs(frT.nodes[frT.parts.HTR].p[2] - 1.25) < 1e-9 &&
     Math.abs(frT.nodes[frT.parts.FIN2].p[2] + 1.25) < 1e-9,
     'the frame has two booms: the stab nodes at ±boomX, a fin node a boom');
} catch (e) { ok(false, 'twin-boom join threw: ' + e.message); }

// THE GLAZING IS JOINED (2026-09-04): glazeOn 0 -> cabin.glazing 'none' and
// a lighter frame (no glass); absent = glass, a nonsense value clamps
try {
  ok(s.cabin.glazing === undefined, 'default glazing writes nothing');
  const sG = cageJoinSpec(Object.assign({}, P, { glazeOn: 0 }), M, T);
  ok(sG.cabin.glazing === 'none', 'glazeOn 0 -> cabin.glazing none');
  const dG = C.buildGen(JSON.parse(JSON.stringify(sG)));
  const dS0 = C.buildGen(JSON.parse(JSON.stringify(s)));
  const mG = dG.nodes.reduce((t, n) => t + n.m, 0), mS0 = dS0.nodes.reduce((t, n) => t + n.m, 0);
  ok(mG < mS0 - 1, 'an open cockpit is lighter (' + mS0.toFixed(1) + ' -> ' + mG.toFixed(1) + ' kg)');
  const sB2 = JSON.parse(JSON.stringify(s)); sB2.cabin.glazing = 'bogus';
  ok(resolveSpec(sB2).spec.cabin.glazing === 'glass', 'a nonsense glazing clamps to glass');
} catch (e) { ok(false, 'glazing join threw: ' + e.message); }

// THE V-TAIL IS JOINED (2026-09-04): the stab layer's cant >= 20 deg writes
// tail.type 'v' + vAngle; the panels' measured projection survives resolve
// (a built V keeps its span, the AR rule does not re-size it) and the frame
// builds with no FIN node; a flat stab writes no type at all.
try {
  ok(s.tail.type === undefined, 'a flat stab writes no tail.type');
  const sV = cageJoinSpec(P, Object.assign({}, M, { tailCant: 35 }), T);
  ok(sV.tail.type === 'v' && sV.tail.vAngle === 35,
     'cant 35 -> tail.type v, vAngle 35');
  const RSV = resolveSpec(JSON.parse(JSON.stringify(sV)));
  const RV = RSV.spec;
  ok(RV.tail.type === 'v' && Math.abs(RV.tail.vG - 35 * Math.PI / 180) < 1e-9,
     'RESOLVED type v, vG = 35 deg');
  ok(Math.abs(RV.tail.hSpan - 2.4) < 1e-9 && !RSV.auto['tail.hSpan'],
     'RESOLVED V-tail keeps the measured projection 2.4 (' +
     RV.tail.hSpan.toFixed(3) + ')');
  ok(Math.abs(RV.tail.Svt - (2.4 / Math.cos(RV.tail.vG)) * 0.8) < 1e-9,
     'RESOLVED V panel area = (span / cos) x chord');
  const frV = genFrame(RV);
  ok(frV.cg0.every(Number.isFinite) && !frV.nodes.some(n => n.tag === 'FIN'),
     'V-tail frame builds, and has no FIN node');
  const sC = cageJoinSpec(P, Object.assign({}, M, { tailCant: 10 }), T);
  ok(sC.tail.type === undefined, 'a 10 deg dihedral stab is not a V');
} catch (e) {
  ok(false, 'V-tail join threw: ' + e.message);
}

// G134: the CUSTOM ENGINE row — facts in, clamped, priced, flown. And its
// ABSENCE is load-bearing: no engineFacts = the registry preset flies, which
// is the identity ruling's untouched-preset half.
try {
  const M3 = Object.assign({}, M, { engineFacts: {
    name: 'modified Rotax 912 UL', mass: 62, powerW: 66000, rpm: 5600,
    torque: 113, aspiration: 'na', family: 'four', cooling: 'liquid' } });
  const s3 = cageJoinSpec(P, M3, T);
  ok(s3.engines[0].custom && s3.engines[0].custom.powerW === 66000,
     'engineFacts land as engines[0].custom');
  ok(s3.engines[0].type === (CAGE_JOIN_ENGINES[T.PRESET_NAMES[
       Math.round(P.engPreset)]] || 'a65_sensenich74'),
     'the preset key survives as the fallback row');
  const RS3 = resolveSpec(JSON.parse(JSON.stringify(s3)));
  const R3 = RS3.spec;
  ok(R3.pplant && R3.pplant.engine.mass === 62 &&
     R3.pplant.engine.name === 'modified Rotax 912 UL',
     'RESOLVED pplant flies the custom facts under the honest name');
  ok(R3.pplant.price > 0, 'an unpriced custom row takes the market curve');
  const fr3 = genFrame(R3);
  ok(fr3.cg0.every(Number.isFinite) && fr3.cg0[3] > 50,
     'a custom-engined spec builds to a finite CG');
  const s4 = cageJoinSpec(P, M, T);         // same M, no engineFacts
  ok(!s4.engines[0].custom,
     'no facts -> no custom row (the registry preset flies)');
} catch (e) {
  ok(false, 'custom engine block threw: ' + e.message);
}

// THE VERDICT CONTRACT (G67.1): this checker joins the battery, and the
// runner requires BOTH signals — the line and the exit code.
if (fails) console.log('\n  ' + fails + ' check(s) failed');
console.log('GATE JOIN: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
