#!/usr/bin/env node
// GATE DRAG (PERF STUDY chantier 2, 2026-09-15) — the recreation cards'
// PARASITE DRAG AREA against their types, held in bands, and the build-up's
// own directions. The perf study (G396.5, futureDesigns/PERF-STUDY-2026-09-15
// .md §4.2) found the body drag did not discriminate construction: one
// number (0.75 x frontal) fitted on the Cub, paid by an alloy cantilever
// and a fabric strutted box alike. genFusCdA is a wetted build-up now
// (GEN_DRAG, GEN_MATERIALS.cdWet), and this is its ratchet:
//   - each card, as the game flies it (the joined bake), is swept in level
//     flight over 1.5-3.0 Vs and its drag fitted D = a q + b / q; `a` (the
//     CdS, m2) must sit inside the declared band around the figure the
//     type's 75 % cruise implies (perf_study.js REAL, +-10 %)
//   - the build-up's DIRECTIONS on the stock aeroplane: an alloy body is
//     cleaner than a fabric one on the same geometry, a round section than
//     a box, exposed cylinders cost more than a pressure cowl, a bubble
//     less than a flat screen, and the gear only ever adds
//   node tools/_drag_check.js             -> the battery (~2 min)
//   node tools/_drag_check.js --selftest  -> negative verification
//   node tools/_drag_check.js --table     -> the table, no verdict
'use strict';
const path = require('path');
const T = __dirname;
const BJ = require(path.join(T, '_bake_joined.js'));
const { D, C } = BJ.loadPanel();
const PR = require(path.join(T, '_perf_probe.js'));

// THE TABLE: the type's parasite drag area (m2) from 75 % power at V75 with
// a propeller efficiency of 0.75 (the study's own derivation), and the band.
// The Cub's 0.75 is the anchor the free constant was solved on; the clean
// cards check the literature rows. The Beaver-alike and the Caravan-alike
// are reported until their cowls and floats are measured; the biplanes and
// the open frames have no published figure.
const TABLE = {
  cub:   { real: 0.75, band: 0.15, src: 'J-3: 65 hp x 0.75 at 120 km/h' },
  jodel: { real: 0.45, band: 0.25, src: 'D.119: 100 hp x 0.75 at 175 km/h' },
  c172:  { real: 0.47, band: 0.25, src: '172R: 160 hp x 0.75 at 218 km/h' },
  // the RV-alike: MEASURED 0.38 with the build-up — its axial 0.24 (body
  // 0.09 on 13.6 m2 of alloy, cooling 0.02, a bubble, a bare-root low wing's
  // junctions, spats and faired legs 0.06) against a type's ~0.12, and the
  // WING ROW 0.135 (genPolar's 0.0055 + 0.018 t + matCd0: 0.0089 on a smooth
  // alloy 2412 where the section runs 0.0065-0.0070) against ~0.08. The wing
  // row is its own measurement (GEN_SURF_MATERIALS.cd0, the plan's declared
  // residual); the band says so and ratchets when it lands.
  rv:    { real: 0.20, band: 1.0, src: 'RV-7: 180 hp x 0.75 at 310 km/h; the wing row\'s residual is declared' },
  beaver:  { real: 0.80, band: 0.35, src: 'DHC-2: 450 hp x 0.75 at 222 km/h', report: false },
  caravan: { real: 0.57, band: 0.35, src: '208: 675 shp x 0.75 at 324 km/h', report: false },
};

const args = process.argv.slice(2);
const fails = [];
const ok = (cond, label, extra) => {
  console.log((cond ? '  ok     ' : '  FAIL   ') + label + (cond || !extra ? '' : ' — ' + extra));
  if (!cond) fails.push(label);
  return cond;
};
const f = (v, d = 3) => v == null || !isFinite(v) ? '—' : (+v).toFixed(d);

function measureSpec(spec) {
  const def = C.buildGen(spec);
  const sim = C.makeSim(def, null); sim.reset(0);
  const W = sim.totalM * 9.81;
  const Vs = def.params.gen.VsMeas || def.params.gen.Vs || 15;
  const rows = PR.sweepAt(def, sim, W, Vs);
  const fit = PR.parasiteFit(rows, Vs, sim.probeAir().rho);
  return { CdS: fit && fit.CdS, drag: def.params.gen.drag, fusCdA: def.params.fusCdA[0], def };
}
function measureCard(key) {
  const bj = BJ.bakeCard(key);
  if (!bj) return null;
  return Object.assign({ key, joinErrs: bj.errors }, measureSpec(bj.spec));
}

// the checks as named functions over plain numbers, so --selftest can doctor
const CHECKS = {
  inBand: (m, R) => m.CdS != null && Math.abs(m.CdS / R.real - 1) <= R.band,
  alloyCleaner: (fab, al) => al.drag.body < fab.drag.body,
  roundCleaner: (box, rnd) => rnd.drag.body < box.drag.body,
  headsCost: (bare, cowled) => bare.drag.heads > cowled.drag.heads,
  bubbleCleaner: (flat, bub) => bub.drag.screen < flat.drag.screen,
  gearAdds: m => m.drag.gear >= 0,
  sumHolds: m => Math.abs((m.drag.body + m.drag.cool + m.drag.heads + m.drag.screen + m.drag.junct + m.drag.exh + m.drag.gear + m.drag.brace) - m.drag.axial) < 1e-6,
};

// the stock aeroplane and its variants (spec-level, no join: the directions)
const stock = () => JSON.parse(JSON.stringify(C.GEN_DEFAULT));
function variants() {
  const fab = measureSpec(stock());
  const alS = stock(); alS.fuselage.material = 'alloy';
  const al = measureSpec(alS);
  const boxS = stock(); boxS.fuselage.crownTop = 0; boxS.fuselage.crownSide = 0;
  const rndS = stock(); rndS.fuselage.crownTop = 1; rndS.fuselage.crownSide = 0.6;
  const box = measureSpec(boxS), rnd = measureSpec(rndS);
  const narrowS = stock(); narrowS.cowl = Object.assign({}, narrowS.cowl, { halfW: 0.16 });   // the cylinders in the wind
  const narrow = measureSpec(narrowS);
  const bubS = stock(); bubS.cabin.canopy = Object.assign({}, bubS.cabin.canopy, { style: 'bubble' });
  const bub = measureSpec(bubS);
  return { fab, al, box, rnd, bub, narrow };
}

if (args.includes('--selftest')) {
  const m = measureCard('cub'), R = TABLE.cub;
  const v = variants();
  const cases = [
    ['inBand (CdS doubled)', () => !CHECKS.inBand(Object.assign({}, m, { CdS: 2 * R.real }), R)],
    ['inBand (no fit)', () => !CHECKS.inBand(Object.assign({}, m, { CdS: null }), R)],
    ['alloyCleaner (swapped)', () => !CHECKS.alloyCleaner(v.al, v.fab)],
    ['roundCleaner (swapped)', () => !CHECKS.roundCleaner(v.rnd, v.box)],
    ['bubbleCleaner (swapped)', () => !CHECKS.bubbleCleaner(v.bub, v.fab)],
    ['gearAdds (a negative gear)', () => !CHECKS.gearAdds({ drag: { gear: -0.01 } })],
    ['sumHolds (a piece dropped)', () => !CHECKS.sumHolds({ drag: Object.assign({}, m.drag, { exh: m.drag.exh + 0.01 }) })],
  ];
  let pass = true;
  for (const [nm, fn] of cases) {
    const c = fn(); pass = pass && c;
    console.log('  selftest ' + nm.padEnd(38) + ' ' + (c ? 'CAUGHT' : 'MISSED'));
  }
  console.log('GATE DRAG: ' + (pass ? 'PASS' : 'FAIL (selftest)'));
  process.exit(pass ? 0 : 1);
}

console.log('| card | CdS ours / real | band | body | cool+heads | screen | junct | exh | gear | brace | swet m2 | f | FF |');
for (const key of Object.keys(TABLE)) {
  const R = TABLE[key];
  let m;
  try { m = measureCard(key); } catch (e) { ok(false, key + ' builds', e.message); continue; }
  if (!m) { ok(false, key + ' is an archetype'); continue; }
  const d = m.drag || {};
  console.log('| ' + key.padEnd(8) + ' | ' + f(m.CdS, 2) + ' / ' + R.real + ' (' + (m.CdS != null ? ((m.CdS / R.real - 1) * 100).toFixed(0) : '—') + ' %) | +-' +
              (R.band * 100).toFixed(0) + ' % | ' + f(d.body) + ' | ' + f((d.cool || 0) + (d.heads || 0)) + ' | ' + f(d.screen) + ' | ' + f(d.junct) + ' | ' +
              f(d.exh) + ' | ' + f(d.gear) + ' | ' + f(d.brace) + ' | ' + f(d.swet, 1) + ' | ' + f(d.f, 1) + ' | ' + f(d.FF, 2) + ' |');
  if (args.includes('--table')) continue;
  if (R.report === false) { console.log('         ' + key + ': reported, not held (' + R.src + ')'); continue; }
  ok(CHECKS.inBand(m, R), key + ': CdS ' + f(m.CdS, 3) + ' m2 within ' + (R.band * 100).toFixed(0) + ' % of ' + R.real + ' (' + R.src + ')',
     m.CdS != null ? ((m.CdS / R.real - 1) * 100).toFixed(0) + ' %' : 'no fit');
  ok(CHECKS.gearAdds(m), key + ': the gear only adds');
  ok(CHECKS.sumHolds(m), key + ': the build-up sums to the axial row');
}
if (!args.includes('--table')) {
  const v = variants();
  ok(CHECKS.alloyCleaner(v.fab, v.al), 'the stock body in alloy is cleaner than in fabric (' + f(v.fab.drag.body) + ' -> ' + f(v.al.drag.body) + ' m2)');
  ok(CHECKS.roundCleaner(v.box, v.rnd), 'a round section is cleaner than a box (' + f(v.box.drag.body) + ' -> ' + f(v.rnd.drag.body) + ' m2)');
  ok(v.narrow.drag.heads > v.fab.drag.heads && v.narrow.drag.heads > 0.02,
     'cylinders outside a narrow cowl cost what a cowled engine does not (' + f(v.fab.drag.heads) + ' -> ' + f(v.narrow.drag.heads) + ' m2)');
  ok(CHECKS.bubbleCleaner(v.fab, v.bub), 'a bubble is cleaner than a flat screen (' + f(v.fab.drag.screen) + ' -> ' + f(v.bub.drag.screen) + ' m2)');
  // (the fiche's 0.574 axial was fitted on the default cabin with its gear
  // inside it; the anchor is the Cub-alike's own CdS against the type, in
  // the table above — the stock's axial is reported)
  console.log('         the stock aeroplane\'s axial row: ' + f(v.fab.fusCdA) + ' m2 (the fiche read 0.574 with the gear inside it)');
  console.log('GATE DRAG: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
}
