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
  halfW: 0.52, cabH: 1.21, tailArm: 5.1,
  tailW: 0.14, tailBot: 0.31, tailTop: 0.52, cowlDeck: 0.66,
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
ok(s.cabin.halfW === 0.52 && s.cabin.h === 1.21, 'cabin envelope passes');
ok(s.fuselage.tailArm === 5.1, 'tail arm passes');
ok(s.fuselage.tailW === 0.14 && s.fuselage.tailBot === 0.31 &&
   s.fuselage.tailTop === 0.52, 'tail-end section passes (G49)');
ok(s.fuselage.cowlDeck === 0.66, 'cowl deck passes (G49)');
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
  ok(R.cabin.seating === 'side2' && R.crew === 2,
     'RESOLVED seating side2, crew 2');
  ok(R.gear.track === 1.62 && R.gear.wheelR === 0.21,
     'RESOLVED gear track + wheelR = measured');
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
