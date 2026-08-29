#!/usr/bin/env node
// _join_check.js — the JOIN verdict (G45). Feeds canned panel params and
// canned measurements through cageJoinSpec, asserts the declared table's
// field mappings, then runs the REAL pipeline (resolveSpec + genFrame)
// on the result and requires a finite CG — the join must always hand the
// game a spec it can build. Run: node tools/_join_check.js
'use strict';
const C = require('./flight_core.js');
const { GEN_TIPS, GEN_FLAPS, POWERPLANTS, resolveSpec, genFrame } = C;
const { cageJoinSpec, CAGE_JOIN_ENGINES } = require('./_cage_join.js');

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
  wgSpan: 11.2, wgChord: 1.55, wgChordTip: 1.09, wgSweep: 3,
  wgDihedral: 2.5, wgIncidence: 1.6, wgWashout: 1.2,
  wgCamber: 4, wgThick: 12,
  wgTip: T.TIP_KEYS.indexOf('rounded'), wgPos: 0, wgCentre: 1,
  wgBrace: 0, wgCrankAt: 0, wgDihedralOut: 6, wgPanels: 3,
  wgFlapType: T.FLAP_KEYS.indexOf('slotted') >= 0
    ? T.FLAP_KEYS.indexOf('slotted') : 0,
  wgFlapSpan: 0.45, wgFlapChord: 0.22, wgAilSpan: 0.36, wgAilChord: 0.22,
  engPreset: T.PRESET_NAMES.indexOf('rotax 912 (flat)'),
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
ok(s.bracing.type === 'strut', 'bracing maps');
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

console.log(fails ? '\nJOIN: FAIL (' + fails + ')' : '\nJOIN: OK');
process.exit(fails ? 1 : 0);
