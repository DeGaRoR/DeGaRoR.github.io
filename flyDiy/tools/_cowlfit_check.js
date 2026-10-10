#!/usr/bin/env node
// GATE COWLFIT — the user's cowl fitting procedure (G2860, _cowl_fit.js), on
// every archetype card the constructor builds.
//
//   node tools/_cowlfit_check.js             -> "GATE COWLFIT: PASS|FAIL"
//   node tools/_cowlfit_check.js --report    every card's fit, rows and notes
//   node tools/_cowlfit_check.js --selftest  doctored fits, each caught
//
// For every card with a cowl and an engine:
//   1 STOCK IS AUTHORED   a stock card (the user's Cub, Jodel, 172, Chinook)
//                         bakes exactly the stock rows — never refitted
//   2 DETERMINISTIC       the fit twice is the same fit, byte for byte
//   3 ENCLOSES            no point of the drawn engine (core + heads; the
//                         exhaust and the mount hardware excluded — a pipe
//                         goes through a cowl on purpose) stands more than
//                         5 mm outside the skin, up to the nose ring
//   4 MEETS THE FIREWALL  the cowl's aft ring against the fuselage slice the
//                         fit read: mean <= 20 mm, max <= 50 mm by bearing —
//                         unless the fit DECLARED a grown firewall (an
//                         engine bigger than its body: a radial on a slim
//                         nose), which is then printed, never silent
//   5 BAKED               designBake carries the fit: fitNose free, every
//                         fitted row on the cage, the flown cowl section
//   6 THE FLOWN COWL      covers what the drawn one covers (60_gen_spec 4c's
//                         own verdict: no side / top / bottom out)
//   7 THE BIRTH DOOR      the styled birth door (CAGE_COWL_FIT_NEXT) stands
//                         down on a fitted birth: the first build keeps the
//                         rows (headless page, two cards)
//
// The context is GATE ARCHETYPES's own (designBake with no page), so the
// spec judged here is the spec that gate flies.
'use strict';
const path = require('path');
const T = __dirname;
const ARGS = new Set(process.argv.slice(2));
const REPORT = ARGS.has('--report'), SELFTEST = ARGS.has('--selftest');

function loadPanel() {
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj {
    constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; }
    add() { return this; } remove() {} traverse() {}
  }
  global.THREE = new Proxy({}, { get: (t, k) => {
    if (k === 'Vector3') return function () { return { set: noop, x: 0, y: 0, z: 0 }; };
    return class extends Obj {};
  } });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js',
    '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    '_cage_gear.js', '_float_gen.js', '_cage_float.js', '_fit_site.js', '_fit_gen.js',
    '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js', '_cowl_fit.js',
    '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js',
    '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  global.window.CAGE_JOIN_ENGINES = require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES;
  return global.window;
}
const W = loadPanel();
const D = require(path.join(T, '_cage_design.js'));
const F = W.COWL_FIT;

let fails = 0, checks = 0;
const check = (ok, msg, extra) => {
  checks++; if (!ok) fails++;
  console.log((ok ? '  ok   ' : '  FAIL ') + msg + (extra ? '  ' + extra : ''));
  return ok;
};
const FIRE_MEAN = 0.020, FIRE_MAX = 0.050, OUT_TOL = 0.005;

// the verdicts as functions over data, so --selftest can doctor them
function encloses(chk) { return chk && chk.outside === 0; }
function meets(chk, grown) {
  if (!chk || chk.synthetic || chk.fireMean == null) return true;    // no body to meet
  return grown || (chk.fireMean <= FIRE_MEAN && chk.fireMax <= FIRE_MAX);
}
const isGrown = fit => fit.report.notes.some(n => /^firewall section grown/.test(n));

function cards() {
  return D.ARCHETYPES.map(a => ({ a, full: D.designFull(a.sel, a.over).full }))
    .filter(c => +c.full.cowlOn && +c.full.engOn);
}

if (!SELFTEST) {
  console.log('GATE COWLFIT — the user\'s cowl fitting procedure on every card');
  let fitted = 0;
  for (const { a, full } of cards()) {
    const name = a.key;
    if (a.over && a.over.stock) {
      // 1 STOCK IS AUTHORED: the baked cage's cowl rows are the stock row's
      const spec = D.designBake(a.sel, a.over);
      const stock = D.designFull(a.sel, a.over).full;
      const diff = Object.keys(stock).filter(k => /^cw_|^fitNose$/.test(k) &&
        spec.cage[k] !== undefined && +spec.cage[k] !== +stock[k]);
      check(diff.length === 0, name + ': stock card, never refitted', diff.slice(0, 4).join(', '));
      continue;
    }
    fitted++;
    let m, fit, fit2;
    try { m = F.cowlFitMeasure(full); fit = F.cowlFit(full, { measured: m }); fit2 = F.cowlFit(full); }
    catch (e) { check(false, name + ': the fit runs', e.message); continue; }
    if (!fit) { check(false, name + ': the fit finds an engine face'); continue; }
    // 2
    check(JSON.stringify(fit.vals) === JSON.stringify(fit2.vals) &&
          JSON.stringify(fit.physics) === JSON.stringify(fit2.physics), name + ': deterministic');
    // 3 + 4, on the rows as the panel keeps them
    const chk = F.cowlFitCheck(Object.assign({}, full, fit.vals), { measured: m, tol: OUT_TOL });
    check(encloses(chk), name + ': the cowl encloses the engine (' + chk.kind + ', ' + chk.arch + ')',
          chk.outside ? chk.outside + '/' + chk.n + ' out, worst ' + chk.worst + ' m at ' + JSON.stringify(chk.worstAt) : chk.n + ' points');
    const grown = isGrown(fit);
    check(meets(chk, grown), name + ': meets the firewall frame',
          chk.fireMean == null ? '(synthetic face: no body)' :
          'mean ' + (chk.fireMean * 1000).toFixed(0) + ' mm, max ' + (chk.fireMax * 1000).toFixed(0) + ' mm' +
          (grown ? ' — DECLARED step: ' + fit.report.notes.find(n => /^firewall/.test(n)) : ''));
    // 5 BAKED
    const spec = D.designBake(a.sel, a.over);
    const miss = Object.keys(fit.vals).filter(k => spec.cage[k] !== undefined ? +spec.cage[k] !== +fit.vals[k]
                                                                              : +full[k] !== +fit.vals[k]);
    check(miss.length === 0 && Math.round(+(spec.cage.fitNose != null ? spec.cage.fitNose : full.fitNose)) === 0,
          name + ': designBake carries the fit', miss.slice(0, 4).join(', '));
    check(spec.cowl && spec.cowl.halfW >= fit.physics.halfW - 1e-9 && spec.cowl.top >= fit.physics.top - 1e-9 &&
          spec.cowl.bot >= fit.physics.bot - 1e-9, name + ': the flown cowl is the fitted section',
          JSON.stringify(spec.cowl && { halfW: spec.cowl.halfW, top: spec.cowl.top, bot: spec.cowl.bot }));
    // 6 THE FLOWN COWL covers what the drawn one covers
    let S = null;
    try { S = resolveSpec(JSON.parse(JSON.stringify(spec))).spec; } catch (e) {}
    const cv = S && S.cowl && S.cowl.covers;
    check(!!cv && cv.sides && cv.above && cv.below, name + ': the flight model agrees nothing is out',
          cv ? JSON.stringify(cv) : 'no verdict');
    if (REPORT) {
      const v = fit.vals, k = n => v['cw_' + n];
      console.log(`         aft ${k('aftW')}x${k('aftH')} top ${k('deckH')} bottom ${k('keelH')} waist ${k('waist')} ` +
        `diamond ${k('sqAftTop')}/${k('sqAftBot')} length ${k('cowlLen')}+${k('lidLen')} taper ${k('taperW')}/${k('taperH')} ` +
        `rise ${k('lidRise')}/${k('faceRise')} noseOff ${k('noseOff')} cheeks ${k('lobeN')}` +
        (k('lobeN') ? ` ${k('lobeAmp')} m at ${k('lobeT')}, ${k('lobeAz')} deg` : ''));
      for (const n of fit.report.notes) console.log('         note: ' + n);
    }
  }
  check(fitted >= 15, 'at least fifteen cards are fitted', String(fitted));

  // 7 THE BIRTH DOOR, on the headless page (the scene layers' own post)
  try {
    const SH = require('./_scene_headless.js');
    const ctx = SH.context().ctx;
    for (const key of ['stearman', 'rv']) {
      const a = D.ARCHETYPES.find(x => x.key === key);
      const spec = D.designBake(a.sel, a.over);
      if (ctx.CAGE_COWL_FIT_NEXT) ctx.CAGE_COWL_FIT_NEXT();
      const r = SH.sceneBuild(spec, {});
      const changed = Object.keys(spec.cage).filter(k => /^cw_/.test(k) && +r.P[k] !== +spec.cage[k]);
      check(changed.length === 0 && !r.errors.length, key + ': the first build after birth keeps the fitted rows',
            changed.slice(0, 4).join(', ') + (r.errors.length ? ' errors: ' + r.errors[0] : ''));
    }
  } catch (e) { check(false, 'the birth door, headless', e.message); }
}

// ---- negative verification: each doctored fit must be caught ---------------
if (SELFTEST) {
  console.log('GATE COWLFIT --selftest — doctored fits');
  const c = cards().find(x => x.a.key === 'ttail') || cards().find(x => !(x.a.over && x.a.over.stock));
  const m = F.cowlFitMeasure(c.full), fit = F.cowlFit(c.full, { measured: m });
  const P0 = Object.assign({}, c.full, fit.vals);
  const caught = (label, ok) => check(ok, 'caught: ' + label);
  caught('a barrel too narrow lets the heads out',
    !encloses(F.cowlFitCheck(Object.assign({}, P0, { cw_taperW: 0.6, cw_lobeN: 0 }), { measured: m })));
  caught('a cowl too short leaves the engine\'s front out',
    !encloses(F.cowlFitCheck(Object.assign({}, P0, { cw_cowlLen: 0.2 }), { measured: m })));
  caught('a firewall 15 % too wide is a step at the joint',
    !meets(F.cowlFitCheck(Object.assign({}, P0, { cw_aftW: P0.cw_aftW * 1.15 }), { measured: m }), false));
  caught('a waist at the top line is a step at the joint',
    !meets(F.cowlFitCheck(Object.assign({}, P0, { cw_waist: 0.8, cw_sqAftTop: 1, cw_sqAftBot: 0 }), { measured: m }), false));
  caught('the undoctored fit passes both',
    (() => { const k = F.cowlFitCheck(P0, { measured: m }); return encloses(k) && meets(k, isGrown(fit)); })());
}

if (fails) console.log('\n  ' + fails + ' of ' + checks + ' check(s) failed');
console.log('GATE COWLFIT: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
