// probe_ladder.js [--save DIR] - the Archaeopteryx study's mass / glide ladder (futureDesigns/archaeopteryx/STUDY.md).
// Births the `archaeopteryx` archetype the way the shed does (designBake + the load door, as tools/ref_match/dump_build.js),
// one step of writes at a time, and prints each step's ledger and plaque. Headless, no gate, ~10 s a step.
// A step's `kWh` pins the pack AFTER the join (the energy layer fills the bay it is given: 2.07 kWh asked came back 7.3).
'use strict';
const path = require('path'), fs = require('fs');
const T = path.resolve(__dirname, '../../tools') + '/';
const BJ = require(T + '_bake_joined.js'), LB = require(T + '_load_build.js'), C = require(T + 'flight_core.js');
const { D } = BJ.loadPanel();
const argv = process.argv.slice(2), SAVE = argv.includes('--save') ? argv[argv.indexOf('--save') + 1] : null;
const A = D.ARCHETYPES.find(x => x.key === 'archaeopteryx');

const BATT = { fuel: { litres: 0 }, energy: { kind: 'battery', cell: 'nmc', kWh: 2.07, vessels: [{ bay: 'nose', capacity: 2.07 }] } };
const WING = { wgSpan: 13.6, wgChord: 1.25, wgChordTip: 0.62 };          // 12.8 m2, AR 14.4 (the type's 13.6 m / 12.8 m2)
const STEPS = [
  ['0 as carded', {}],
  ['1 cantilever', { sel: { wgBrace: 1 } }],
  ['2 + 13.6 m tapered wing', { sel: { wgBrace: 1 }, cage: WING }],
  ['3 + e-PPG 12 kW', { sel: { wgBrace: 1, engModel: 'e-PPG 12 kW' }, cage: WING }],
  ['4 + 2.07 kWh NMC pack', { kWh: 2.07, sel: { wgBrace: 1, engModel: 'e-PPG 12 kW' }, cage: WING, spec: BATT }],
  ['5 + taildragger, screen, bare', { kWh: 2.07, sel: { wgBrace: 1, engModel: 'e-PPG 12 kW', gearLayout: 'tail', canopy: 'screen', scheme: 'bare' },
    cage: WING, spec: BATT }],
  ['6 + wing 6061 tube + Dacron', { kWh: 2.07, sel: { wgBrace: 1, engModel: 'e-PPG 12 kW', gearLayout: 'tail', canopy: 'screen', scheme: 'bare' },
    cage: Object.assign({ wgCons: 5 }, WING), spec: BATT }],
  ['7 + 1.0 m prop (clears)', { kWh: 2.07, sel: { wgBrace: 1, engModel: 'e-PPG 12 kW', gearLayout: 'tail', canopy: 'screen', scheme: 'bare' },
    cage: Object.assign({ wgCons: 5, cw_propD: 1.0, propR: 0.5 }, WING), spec: BATT }],
  // the user's 2005 three-view (STUDY.md §9): the 13.4 m planform (TE straight, the LE's taper as a crank), winglets,
  // 1.5 deg, the tail's macro rows toward the drawing, the wing 0.20 m forward for a ~13 % margin
  ['8 + the three-view geometry', { kWh: 2.07, sel: { wgBrace: 1, engModel: 'e-PPG 12 kW', gearLayout: 'tail', canopy: 'screen', scheme: 'bare', wgTip: 5 },
    cage: { wgSpan: 13.4, wgChord: 1.14, wgCrankAt: 0.48, wgCrankChord: 1.03, wgCrankX: 0.11, wgChordTip: 0.53, wgTipX: 0.55,
            wgDihedral: 1.5, wgCons: 5, cw_propD: 1.0, propR: 0.5, wgDx: 0.2,
            stSpan: 0.98, stChord: 0.72, stChordTip: 0.67, stSweep: 0, finHeight: 1.03, finChord: 1.32, finChordTip: 0.68 },
    spec: BATT }],
  ['x pod 6061 tube + Dacron', { kWh: 2.07, sel: { wgBrace: 1, engModel: 'e-PPG 12 kW', gearLayout: 'tail', canopy: 'screen', scheme: 'bare', intCons: 4 },
    cage: Object.assign({ wgCons: 5, cw_propD: 1.0, propR: 0.5 }, WING), spec: BATT }],
];

for (const [label, X] of STEPS) {
  const over = { cage: Object.assign({}, A.over && A.over.cage, X.cage || {}), spec: Object.assign({}, A.over && A.over.spec, X.spec || {}) };
  const s0 = D.designBake(Object.assign({}, A.sel, X.sel || {}), over);
  const r = LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 });
  const spec = r.spec;
  if (X.kWh && spec.energy) { spec.energy.kWh = X.kWh; spec.energy.vessels.forEach((v, i) => { v.capacity = i ? 0 : X.kWh; v.fit = 'fixed'; }); }
  const def = C.buildGen(JSON.parse(JSON.stringify(spec)));
  const sh = C.genShakedown(def, { slim: true });
  const rows = Object.entries(def.parts.ledger).filter(([, e]) => e.mass > 0).sort((a, b) => b[1].mass - a[1].mass);
  const dr = def.params.gen.drag || {};
  console.log('== ' + label + (r.errors.length ? '   [join: ' + r.errors.join(' | ').slice(0, 140) + ']' : ''));
  console.log('   ' + rows.map(([k, e]) => k + (e.payload ? '*' : '') + ' ' + e.mass.toFixed(1)).join('  '));
  console.log('   EMPTY ' + sh.empty.toFixed(1) + '  gross ' + sh.mass.toFixed(1) + '  span ' + sh.span + ' AR ' + sh.AR.toFixed(1) +
              '  Vs ' + (sh.Vs * 3.6).toFixed(0) + ' km/h  L/D ' + sh.LDbest.toFixed(1) + ' @ ' + (sh.VbestLD * 3.6).toFixed(0) +
              ' km/h  climb ' + sh.climbRate.toFixed(2) + ' m/s  TO ' + sh.TORun + ' m  margin ' + (sh.staticMargin * 100).toFixed(1) + ' %');
  console.log('   ' + sh.engineName + ' | ' + sh.energyKind + ' ' + (sh.energyKg || 0).toFixed(1) + ' kg | body CdA ' +
              (dr.axial || 0).toFixed(3) + ' m2 (gear ' + (dr.gear || 0).toFixed(3) + ', body ' + (dr.body || 0).toFixed(3) +
              ', brace ' + (dr.brace || 0).toFixed(3) + ', junct ' + (dr.junct || 0).toFixed(3) + ', screen ' + (dr.screen || 0).toFixed(3) + ')');
  if (SAVE) fs.writeFileSync(path.join(SAVE, 'step_' + label.split(' ')[0] + '.json'), JSON.stringify({ name: A.name + ' ' + label, spec }));
}
