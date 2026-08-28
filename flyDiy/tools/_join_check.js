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
const M = {
  gearType: 'taildragger', track: 1.62, contactR: 0.21,
  halfW: 0.52, cabH: 1.21, tailArm: 5.1,
  seating: 'tandem2', pilots: 1,
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
   s.gear.contactR === 0.21, 'gear measurements pass');
ok(s.cab.halfW === 0.52 && s.cab.h === 1.21, 'cabin envelope passes');
ok(s.fuse.tailArm === 5.1, 'tail arm passes');
ok(s.seating === 'tandem2' && s.pilots === 1, 'seating + pilots pass');
ok(s.cage && s.cage.waistY === -0.05, 'spec.cage rides along');

// the pipeline must BUILD what the join hands it
try {
  const RS = resolveSpec(JSON.parse(JSON.stringify(s)));
  const fr = genFrame(RS.spec);
  const cg = fr.cg0;
  ok(cg.every(v => Number.isFinite(v)) && cg[3] > 50,
     'resolveSpec + genFrame -> finite CG, mass ' + cg[3].toFixed(0) + ' kg');
  ok(RS.spec.engine === 'rotax912_warp', 'engine survives normalisation');
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
