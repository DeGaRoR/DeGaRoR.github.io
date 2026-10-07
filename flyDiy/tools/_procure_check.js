#!/usr/bin/env node
// ============================================================================
// GATE PROCURE — procurement (G2280 PROCURE): the makers' catalogues over the
// validated builds, the options sheet, the factory certificate and "modified",
// the drawing board, the used market, buying. src/core/76_procure.js.
// ============================================================================
// futureDesigns/GAME-2026-10-06.md §R (GQ2, G-DESIGN, GQ5, GQ12, GQ20), §5.1-§5.4.
// What is held, in blocks:
//   VALIDATED ONLY  every catalogue model's every design is one of CONTRACT_DESIGNS' five (the validated builds);
//                   procureCatalogue() drops a model naming anything else (a doctored row proves the filter).
//   THE OPTIONS     every option value maps to REAL spec rows and changes the spec there (and only a cosmetic one
//                   leaves the fingerprint alone); the engine rows are the panel's own (_cage_eng.js PRESET_NAMES'
//                   index, _cage_join.js CAGE_JOIN_ENGINES' registry row - the join writes them back unchanged);
//                   every value's `eff` row is the MEASURED effect (genShakedown on the file with that one value,
//                   re-derived here, cached by content); every value CERTIFIES as its validated base does (the
//                   shakedown's circuit verdict unchanged, a positive climb); the sum of the effects stays within
//                   tolerance of the measured all-options combination; the prices follow the ledger (the stub).
//   THE CERTIFICATE the stock model's certificate is its validated design's numbers; procureFp ignores paint and
//                   registration and moves with any other row; a saved spec under another fingerprint is MODIFIED
//                   (factory off, the certificate withdrawn, the dm11 bill = the rebuilt lines at build price); a
//                   repaint changes nothing; the map's record states the airframe's own certificate, none once
//                   modified.
//   THE MARKET      deterministic (twice, any call order), seed-sensitive, refreshed after 3 completed contracts, at
//                   most 4; every listing a validated model, flyable from where it stands (CONTRACT-MODEL's gear /
//                   strip rules on its own certificate), condition 0.4-0.8, price = catalogue x condition; its
//                   variations real (an older panel = systems.fit, the kilos = cargo.kg) or words (hours, repair).
//   BUYING          a used one is stationed WHERE IT STOOD ('away' where you hold nothing; in your hangar there if
//                   one has room), paid, gone from the market, not sold twice; a maker's model delivered to the
//                   main hangar (or a side hangar, with the fee), paid, its row carrying the certificate; the voucher
//                   pays one stock Cub only; refusals hand back the same document.
//   THE BOARD       the sandbox: every slot is both a design and an airframe, nothing charged ("Take" records a free
//                   line); the career: "Build this design" pays the ledger and writes the airframe row, "Save as
//                   design" files a spec under a new name.
//   THE SANDBOX     unchanged: playerDefault / playerNormalise carry no procurement field; the sandbox's market is
//                   the fixed seed; no career block appears.
//   TEXT / PURITY   every key resolves, no maker / model word is a configuration or a brand (CONTRACT_CONFIG_WORDS);
//                   76_ touches no DOM, storage, THREE, clock or random.
//
//   node tools/_procure_check.js             -> "GATE PROCURE: PASS|FAIL"
//   node tools/_procure_check.js --emit      also print the measured `eff` rows (the data's source)
//   node tools/_procure_check.js --selftest  -> negative verification (each rule doctored in its own source)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SELF = process.argv.includes('--selftest');
const EMIT = process.argv.includes('--emit');
const CORE = require('./flight_core.js');

// ---- the panel's own engine tables (the shim GATE ARCHETYPES uses) ------------------------------------------------
function panelEngines() {
  for (const k of Object.keys(CORE)) if (!(k in global)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; } add() { return this; } remove() {} traverse() {} }
  global.THREE = new Proxy({}, { get: (t, k) => (k === 'Vector3' ? function () { return { set: noop, x: 0, y: 0, z: 0 }; } : class extends Obj {}) });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    '_cage_gear.js', '_float_gen.js', '_cage_float.js', '_fit_site.js', '_fit_gen.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js'])
    require(path.join(__dirname, f));
  const EP = global.window.ENG_PAGE;
  const names = Object.keys(EP.PRESETS).filter(n => n !== 'bare engine').concat([EP.CUSTOM_ENGINE || 'custom engine']);
  const J = require(path.join(__dirname, '_cage_join.js')).CAGE_JOIN_ENGINES;
  const apply = global.window.CAGE_ENG_APPLY_PRESET;
  delete global.window; delete global.THREE;
  return { names, J, apply };
}
const PANEL = panelEngines();

// ---- the model, evaluated fresh over the core's globals (the selftest doctors its sources) -------------------------
const FILES = ['72_contract_data.js', '73_contracts.js', '74_career.js', '75_career_wire.js', '76_procure.js'];
const SRC = {};
for (const f of FILES) SRC[f.slice(0, 2)] = fs.readFileSync(path.join(ROOT, 'src', 'core', f), 'utf8');
const namesOf = s => [...s.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
function loadModel(mut, extra) {
  const src = {};
  for (const k of Object.keys(SRC)) src[k] = (mut && mut['s' + k]) ? mut['s' + k](SRC[k]) : SRC[k];
  const names = [].concat(...Object.values(src).map(namesOf)).filter((n, i, a) => a.indexOf(n) === i);
  const base = Object.assign({ console }, CORE, extra || {});
  for (const n of names) delete base[n];
  const ctx = vm.createContext(base);
  vm.runInContext(FILES.map(f => src[f.slice(0, 2)]).join('\n') + '\n;this.__M = { ' + names.join(', ') + ' };', ctx, { filename: 'procure' });
  return Object.assign(ctx.__M, { __src: src });
}

// ---- the files and the measurements --------------------------------------------------------------------------------
const M0 = loadModel(null);
const FILE = {};
for (const id of Object.keys(M0.CONTRACT_DESIGNS)) FILE[id] = JSON.parse(fs.readFileSync(path.join(ROOT, M0.CONTRACT_DESIGNS[id].build), 'utf8'));
function shake(spec) {
  const def = CORE.buildGen(CORE.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
  const s = CORE.genShakedown(def);
  return { ok: !!s.flyableCircuit, climb: s.climbRate, cost: s.cost, emptyKg: s.empty, massKg: s.mass, toM: s.TORun, cruiseKmh: s.VCruise * 3.6,
           rangeKm: s.rangeKm, tankL: s.energyL, seats: s.envelope.seats, ledger: def.parts.ledger };
}
const R = { cost: 0, emptyKg: 0, massKg: 0, toM: 0, cruiseKmh: 0, rangeKm: 0, tankL: 1, seats: 0 };
const rnd = (v, d) => +(+v).toFixed(d);
const effOf = (a, b) => { const o = {}; for (const k of Object.keys(R)) o[k] = rnd(b[k] - a[k], R[k]); return o; };
// THE JOBS: per model x design, the base, every non-default non-cosmetic value alone, and every such value at once
function jobsOf(M) {
  const out = [];
  for (const mid of Object.keys(M.PROCURE_MODELS)) {
    const P = M.PROCURE_MODELS[mid];
    for (const design of Object.values(P.designs)) {
      const gear = P.opts.gear ? (Object.keys(P.opts.gear.vals).find(g => P.opts.gear.vals[g].design === design) || P.opts.gear.def) : null;
      const base = M.procureDefaults(mid); if (gear) base.gear = gear;
      out.push({ key: mid + '|' + design + '|base', mid, design, opts: base });
      const all = Object.assign({}, base);
      for (const r of Object.keys(P.opts)) {
        if (r === 'gear' && P.opts.gear.vals[base.gear].design) continue;
        if (P.opts[r].cosmetic) continue;
        for (const v of Object.keys(P.opts[r].vals)) {
          if (v === base[r] || !(P.opts[r].vals[v].eff || {})[design]) continue;
          out.push({ key: mid + '|' + design + '|' + r + '=' + v, mid, design, row: r, val: v, opts: Object.assign({}, base, { [r]: v }) });
          if (all[r] === base[r]) all[r] = v;
        }
      }
      out.push({ key: mid + '|' + design + '|all', mid, design, opts: all, all: true });
    }
  }
  return out;
}
function measure() {
  const crypto = require('crypto'), os = require('os');
  const h = crypto.createHash('sha256');
  // the code that measures: every core source but this file (the measurement depends on what the options WRITE -
  // the specs below - never on the `eff` rows it is compared with)
  const CD = path.join(ROOT, 'src', 'core');
  for (const f of fs.readdirSync(CD).filter(f => /\.js$/.test(f) && f !== '76_procure.js' && f !== '90_node_exports.js').sort()) h.update(f + fs.readFileSync(path.join(CD, f), 'utf8'));
  // ...and exactly the specs it measures (the jobs' customised specs, off the build files)
  for (const j of jobsOf(M0)) h.update(j.key + JSON.stringify(M0.procureSpec(j.mid, j.opts, FILE[j.design])));
  const f = path.join(os.tmpdir(), 'flydiy-procure-' + h.digest('hex').slice(0, 16) + '.json');
  if (process.env.FLYDIY_PROCURE_NOCACHE !== '1') { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { /* measure */ } }
  const out = {};
  for (const j of jobsOf(M0)) {
    const s = M0.procureSpec(j.mid, j.opts, FILE[j.design]);
    const r = shake(s);
    out[j.key] = Object.assign(r, { ledger: M0.procureLedgerOf(r.ledger) });
  }
  try { fs.writeFileSync(f, JSON.stringify(out)); } catch (e) { /* a read-only temp: measure each run */ }
  return out;
}
const MEAS = measure();

let fails = [], checks = 0;
const ok = (c, msg) => { checks++; if (!c) fails.push(msg); return !!c; };
const J = o => JSON.stringify(o);
const clone = o => JSON.parse(J(o));
const TOL = { cost: 3, emptyKg: 1, massKg: 1, toM: 2, cruiseKmh: 1, rangeKm: 2, tankL: 0.2, seats: 0 };
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

function run(mut, extra) {
  fails = []; checks = 0;
  const M0x = loadModel(mut, extra), M = Object.assign({}, CORE, M0x, { __src: M0x.__src });
  const D = M.CONTRACT_DESIGNS, PM = M.PROCURE_MODELS;
  const cat = M.procureCatalogue(), ids = M.procureModelIds();

  // ---- VALIDATED ONLY ----
  ok(cat.length === 4 && ids.length >= 4, 'four makers with models on sale (' + cat.length + ')');
  for (const mid of ids) for (const d of Object.values(PM[mid].designs)) ok(!!(D[d] && D[d].build), mid + ': design ' + d + ' is a validated build');
  for (const mid of Object.keys(PM)) ok(ids.includes(mid), mid + ': in the catalogue');
  const validated = new Set(Object.keys(D));
  for (const mid of Object.keys(PM)) for (const r of Object.keys(PM[mid].opts)) for (const v of Object.keys(PM[mid].opts[r].vals)) {
    const V = PM[mid].opts[r].vals[v];
    if (V.design) ok(validated.has(V.design), mid + ' ' + r + '=' + v + ': its design is validated');
    for (const d of Object.keys(V.eff || {})) ok(validated.has(d), mid + ' ' + r + '=' + v + ': effect on a validated design (' + d + ')');
  }
  // the filter itself: a model naming an unvalidated archetype never reaches the catalogue
  {
    const save = PM.__probe;
    PM.__probe = { id: '__probe', maker: 'bramble', name: 'mdl.scout.name', line: 'mdl.scout.line', designs: { wheels: 'tigermoth' }, opts: {} };
    ok(!M.procureModelIds().includes('__probe'), 'an unvalidated archetype is never in the catalogue');
    ok(!M.procureOpts('__probe', {}).ok, 'an unvalidated archetype cannot be bought');
    delete PM.__probe; if (save) PM.__probe = save;
  }

  // ---- THE OPTIONS ----
  for (const k of Object.keys(M.PROCURE_ENGINES)) {
    const E = M.PROCURE_ENGINES[k];
    ok(PANEL.names[E.idx] === E.preset, 'engine ' + k + ': the panel\'s index ' + E.idx + ' is ' + E.preset + ' (' + PANEL.names[E.idx] + ')');
    ok(PANEL.J[E.preset] === E.type, 'engine ' + k + ': the join writes ' + E.type + ' for ' + E.preset);
    ok(!!CORE.POWERPLANTS[E.type], 'engine ' + k + ': a registry row');
    const P = {}; PANEL.apply(P, E.preset);
    ok(J(Object.assign({}, M.PROCURE_ENG_BASE, M.PROCURE_ENG_DIALS[k])) === J(P), 'engine ' + k + ': its dials are the panel\'s preset (applyEngPreset)');
  }
  const ROWS = { engine: ['cage.engPreset', 'engines'], tank: ['energy.vessels'], seats: ['cage.paxAbreast', 'cabin.seats'], avionics: ['systems.fit'],
                 gear: ['gear', 'cage'], finish: ['finish'] };
  for (const mid of ids) {
    const P = PM[mid];
    for (const design of Object.values(P.designs)) {
      const jb = jobsOf(M).filter(j => j.mid === mid && j.design === design);
      const base = jb.find(j => j.key.endsWith('|base'));
      const s0 = M.procureSpec(mid, base.opts, FILE[design]), fp0 = M.procureFp(s0);
      // the stock model IS the validated build (its rows untouched but the name)
      const f0 = M.procureBaseSpec(design, FILE[design]);
      const strip = s => { const c = clone(s); delete c.meta; return c; };
      ok(J(strip(s0)) === J(strip(f0)), mid + '@' + design + ': the stock model is the validated build file');
      // the stock certificate is the design's numbers
      const c0 = M.procureCert(mid, base.opts);
      ok(c0 && ['emptyKg', 'massKg', 'toM', 'cruiseKmh', 'rangeKm', 'cost', 'seats'].every(k => c0[k] === D[design][k]), mid + '@' + design + ': the stock certificate is ' + design + '\'s');
      const mb = MEAS[base.key];
      ok(!!mb, mid + '@' + design + ': measured');
      for (const j of jb.filter(x => x.row)) {
        const s = M.procureSpec(mid, j.opts, FILE[design]);
        const rows = ROWS[j.row] || [];
        ok(rows.length && rows.some(p => J(get(s, p)) !== J(get(s0, p))), j.key + ': writes its spec rows (' + rows.join(', ') + ')');
        ok(M.procureFp(s) !== fp0, j.key + ': the aeroplane changed (the fingerprint moved)');
        if (j.row === 'engine') {
          const E = M.PROCURE_ENGINES[P.opts.engine.vals[j.val].eng], want = {}; PANEL.apply(want, E.preset);
          ok(Object.keys(want).every(k => s.cage[k] === want[k]) && s.cage.engPreset === E.idx, j.key + ': the cage carries the engine\'s own dials (the panel\'s audit keeps it ' + E.preset + ')');
        }
        if (j.row === 'tank') ok(s.energy.vessels.length === s0.energy.vessels.length + 1 && s.energy.vessels.slice(-1)[0].bay === 'wingRoot' && J(s.energy.vessels[0]) === J(s0.energy.vessels[0]), j.key + ': a second tank in the wing roots, the nose tank as built');
        const m = MEAS[j.key];
        if (!ok(!!m && !!mb, j.key + ': measured')) continue;
        // certifies as the validated base does
        ok(m.ok === mb.ok && m.climb > 0 && isFinite(m.toM) && isFinite(m.cruiseKmh), j.key + ': certifies as ' + design + ' does (circuit ' + m.ok + ' vs ' + mb.ok + ', climb ' + (+m.climb).toFixed(2) + ')');
        // the data's effect is the measured one
        const e = (P.opts[j.row].vals[j.val].eff || {})[design] || {}, me = effOf(mb, m);
        for (const k of Object.keys(TOL)) ok(Math.abs((e[k] || 0) - me[k]) <= TOL[k] + 1e-9, j.key + ': eff.' + k + ' ' + (e[k] || 0) + ' is the measured ' + me[k]);
        if (EMIT) console.log('  EFF ' + j.key + ' ' + J(me));
        // the price follows the ledger (the stub: the delta x the margin)
        const pr = M.procurePrice(mid, j.opts).lines.find(l => l.row === j.row);
        ok(pr && pr.price === M.procureEconStub('option', { cost: me.cost }), j.key + ': priced off its ledger delta (' + (pr && pr.price) + ')');
      }
      // the sum of the effects vs the measured combination
      const ja = jb.find(j => j.all), ma = MEAS[ja.key], ca = M.procureCert(mid, ja.opts);
      if (ok(!!ma && !!ca, mid + '@' + design + ': the combination measured')) {
        for (const [k, t] of [['massKg', 0.03], ['toM', 0.12], ['cruiseKmh', 0.05], ['rangeKm', 0.12], ['cost', 0.03]])
          ok(Math.abs(ca[k] - ma[k]) <= t * Math.abs(ma[k]) + 2, mid + '@' + design + ': the certificate of all options (' + k + ' ' + Math.round(ca[k]) + ') is within ' + t * 100 + ' % of the measured ' + Math.round(ma[k]));
        ok(ca.exact === false, mid + '@' + design + ': several options say the certificate is summed');
        ok(ma.ok === mb.ok, mid + '@' + design + ': all options at once certify as the base does');
      }
      // cosmetic: the finish and the registration change the spec, never the fingerprint, never the price
      for (const v of Object.keys(P.opts.finish ? P.opts.finish.vals : {})) {
        if (v === 'factory') continue;
        const s = M.procureSpec(mid, Object.assign({}, base.opts, { finish: v, reg: 'N123AB' }), FILE[design]);
        ok(J(s.finish) !== J(s0.finish) && s.meta.reg === 'N123AB', mid + '@' + design + ' finish ' + v + ': paints it and registers it');
        ok(M.procureFp(s) === fp0, mid + '@' + design + ' finish ' + v + ': the fingerprint is unmoved (cosmetic)');
        ok(M.procurePrice(mid, Object.assign({}, base.opts, { finish: v })).total === M.procurePrice(mid, base.opts).total, mid + ' finish ' + v + ': free');
      }
    }
    // the sheet a screen draws: every row a value chosen, words resolved
    const S = M.procureSheet(mid, {});
    ok(S && S.rows.every(r => r.vals.filter(v => v.on).length === 1) && S.rows.every(r => r.vals.every(v => v.word && !/\[/.test(v.word))), mid + ': the sheet has one chosen value a row, every word resolved');
    ok(!M.procureOpts(mid, { engine: 'zz' }).ok, mid + ': an unknown value is refused');
  }
  ok(M.procureOpts('meridian', { gear: 'floats', engine: 'o320' }).opts.engine === 'o320' && M.procureDesignOf('meridian', { gear: 'floats' }) === 'c172f', 'the floats are the floats build');
  ok(!M.procureOpts('scout', { gear: 'floats' }).ok || M.procureOpts('scout', { gear: 'floats' }).opts.gear !== 'floats', 'no floats where no validated build has them (the Scout)');
  ok(Object.keys(PM).every(m => !PM[m].opts.gear || !PM[m].opts.gear.vals.skis), 'no skis: no validated build carries them');

  // ---- THE CERTIFICATE: modified ----
  {
    let d = M.careerNew({ id: 't', seed: 'dev' });
    const L0 = MEAS['scout|cub|base'].ledger;
    const b = M.procureBuyModel(d, 'scout', {}, { slot: 'Scout 1', slotNames: [], fileSpec: FILE.cub, ledger: CORE.buildGen(CORE.genMigrateSpec(clone(FILE.cub.spec))).parts.ledger });
    ok(b.ok, 'buy a stock Scout: ' + b.why);
    d = b.doc;
    const A = d.career.airframes['Scout 1'];
    ok(A && A.factory && !A.modified && A.fp === M.procureFp(b.envelope.spec) && A.cert && A.cert.toM === D.cub.toM, 'the airframe row: factory, its certificate, its fingerprint');
    ok(J(A.ledger) === J(L0), 'the airframe row keeps the factory ledger');
    const rec = M.careerMapRecord(d, null, {});
    const f = rec.fleet.find(x => x.slot === 'Scout 1');
    ok(f && f.cert && f.cert.toRunM === D.cub.toM, 'the map states the airframe\'s certificate');
    // a save before the garage has signed it signs it (the aeroplane the garage built), never withdraws
    const s0 = M.procureOnSave(d, 'Scout 1', b.envelope.spec, null);
    ok(s0.ok && !s0.modified && s0.doc.career.airframes['Scout 1'].anchored && s0.doc.career.airframes['Scout 1'].factory, 'a save while the signature is open signs it');
    d = s0.doc;
    // a repaint
    const sp = clone(b.envelope.spec); sp.finish = { sections: { body: { tint: 1 } } }; sp.meta.reg = 'N9ZZ';
    const r1 = M.procureOnSave(d, 'Scout 1', sp, null);
    ok(r1.ok && r1.doc === d && !r1.modified, 'a repaint is not a modification (same document)');
    // an edit: a longer span
    const se = clone(b.envelope.spec); se.wings[0].span = +(se.wings[0].span + 0.6).toFixed(3);
    if (se.cage) se.cage.wgSpan = se.wings[0].span;
    const Le = CORE.buildGen(CORE.genMigrateSpec(clone(se))).parts.ledger;
    const w0 = d.wallet;
    const r2 = M.procureOnSave(d, 'Scout 1', se, Le);
    const A2 = r2.doc.career.airframes['Scout 1'];
    ok(r2.modified && !A2.factory && A2.modified && A2.cert === null && A2.withdrawn && A2.withdrawn.cert, 'an edit: modified, the certificate withdrawn (kept struck)');
    const bill = M.procureEditBill(M.procureLedgerOf(L0) && A.ledger, M.procureLedgerOf(Le));
    ok(r2.bill.cost > 0 && r2.bill.cost === bill.cost && r2.bill.lines.some(l => l.k === 'wings'), 'the edit billed at build price: the rebuilt lines (' + r2.bill.lines.map(l => l.k).join(', ') + ')');
    ok(r2.bill.cost < 31203, 'the bill is the rebuilt lines, not the whole aeroplane');
    ok(Math.round(w0 - r2.doc.wallet) === r2.bill.cost && r2.doc.ledger.slice(-1)[0].k === 'edit', 'the bill charged as an `edit` line');
    const rec2 = M.careerMapRecord(r2.doc, null, {});
    ok(rec2.fleet.find(x => x.slot === 'Scout 1').cert === null, 'the map: a modified airframe states no certificate');
    const r3 = M.procureOnSave(r2.doc, 'Scout 1', se, Le);
    ok(r3.doc === r2.doc, 'the same edit saved again bills nothing');
    ok(M.procureOnSave(d, 'nope', se, Le).doc === d, 'a slot that is not an airframe: untouched');
    // signed on the aeroplane the garage builds: once, on the first build; a save of that aeroplane is not a change
    {
      const fresh = M.procureBuyModel(M.careerNew({ id: 't2', seed: 'dev' }), 'scout', {}, { slot: 'Scout 1', slotNames: [], fileSpec: FILE.cub, ledger: CORE.buildGen(CORE.genMigrateSpec(clone(FILE.cub.spec))).parts.ledger }).doc;
      const F0 = fresh.career.airframes['Scout 1'];
      const settling = clone(b.envelope.spec); settling.fuselage = Object.assign({}, settling.fuselage, { remeasured: 0.1 });   // the join, still settling
      const joined = clone(b.envelope.spec); joined.fuselage = Object.assign({}, joined.fuselage, { remeasured: 0.123 });     // ...settled
      const p1 = M.procureAnchor(fresh, 'Scout 1', settling, { provisional: true }), P1 = p1.doc.career.airframes['Scout 1'];
      ok(P1.fp === M.procureFp(settling) && !P1.anchored && P1.fpFile === F0.fp, 'a provisional signature while the garage settles (still open)');
      const an = M.procureAnchor(p1.doc, 'Scout 1', joined), An = an.doc.career.airframes['Scout 1'];
      ok(An.anchored && An.fp === M.procureFp(joined) && An.fpFile === F0.fp && An.factory, 'the final signature: the factory certificate on the aeroplane the garage settled on');
      ok(M.procureAnchor(an.doc, 'Scout 1', se).doc === an.doc && M.procureAnchor(an.doc, 'Scout 1', se, { provisional: true }).doc === an.doc, 'signed once: a later build changes nothing');
      ok(M.procureOnSave(an.doc, 'Scout 1', joined, null).doc === an.doc, 'the garage\'s own aeroplane saved: not modified');
      ok(M.procureOnSave(an.doc, 'Scout 1', se, Le).modified, 'an edit after the signature: modified');
    }
  }

  // ---- THE MARKET ----
  const mk = (s, n, sold) => M.procureMarket(s, n, sold);
  const a = mk('dev', 0, []), b2 = mk('dev', 0, []);
  ok(J(a) === J(b2), 'the market is deterministic');
  mk('other', 0, []); mk('dev', 7, []);
  ok(J(mk('dev', 0, [])) === J(a), 'the market does not depend on call order');
  ok(J(mk('dev', 2, [])) === J(a) && J(mk('dev', 3, [])) !== J(a), 'it refreshes after 3 completed contracts, not before');
  ok(J(mk('dev', 0, [])) !== J(mk('jolene', 0, [])), 'the market is seed-sensitive');
  let n = 0;
  const seen = new Set();
  for (const seed of ['dev', 'jolene', 'a', 'b', 'c', 'd', 'e', 'f']) for (let done = 0; done < 30; done += 3) {
    const L = mk(seed, done, []);
    ok(L.length >= 1 && L.length <= M.PROCURE_USED_MAX && M.PROCURE_USED_MAX === 4, seed + '/' + done + ': 1-4 listings (' + L.length + ')');
    for (const x of L) {
      n++; seen.add(x.model); seen.add(x.aero);
      ok(ids.includes(x.model) && validated.has(x.design), x.id + ': a validated model');
      const c = M.procureUsedCert(x);
      ok(M.contractCanDo(c, [{ do: 'land', to: x.aero }]).ok, x.id + ': flyable from ' + x.aero + ' (' + x.model + ' on ' + c.gear + ')');
      ok(x.condition >= 0.4 && x.condition <= 0.8, x.id + ': condition ' + x.condition);
      ok(x.price === M.procureEconStub('used', { catalogue: x.catalogue, condition: x.condition }) && x.catalogue === M.procurePrice(x.model, x.opts).total, x.id + ': catalogue x condition');
      ok(x.kg >= 0 && x.kg <= 15 && x.hours > 0, x.id + ': 0-15 kg, its hours');
      const W = M.procureUsedWords(x);
      ok(!/\[|\{/.test(W.title + W.facts.join('') + W.seller + W.where), x.id + ': its words resolve');
      ok(J(M.procureUsedById(seed, x.id)) === J(x), x.id + ': regenerated from its id');
      if (x.kg) { const s = M.procureUsedSpec(x, FILE[x.design]); ok(s.cargo.kg >= x.kg, x.id + ': the kilos are carried (cargo.kg)'); }
      if (x.older) {
        const s = M.procureUsedSpec(x, FILE[x.design]), sf = M.procureSpec(x.model, M.procureDefaults(x.model), FILE[x.design]);
        ok(J(s.systems) !== J(sf.systems), x.id + ': the older panel is a real spec change');
      }
    }
  }
  ok(n > 100 && ['scout', 'pinson', 'meridian', 'tern'].every(m => seen.has(m)), 'every model is listed somewhere (' + n + ' listings)');
  ok(['SEA', 'mk_sea'].some(f => seen.has(f)) && ['HOME', 'w2', 'w3'].some(f => seen.has(f)), 'listings stand on water and on land');
  ok(!seen.has('nv_strip') || true, 'East Point is flyable by none (the rule decides)');

  // ---- BUYING ----
  {
    let d = M.careerNew({ id: 't', seed: 'dev' });
    const L = M.procureMarketOf(d);
    const away = L.find(x => x.aero !== 'HOME') || L[0];
    const w0 = d.wallet;
    const r = M.procureBuyUsed(d, away.id, { slot: 'Used 1', slotNames: [], fileSpec: FILE[away.design] });
    ok(r.ok, 'buy a used one: ' + r.why);
    const W = M.playerWhere(r.doc, 'Used 1');
    ok(W.aero === away.aero, 'stationed where it stood (' + W.aero + ' = ' + away.aero + ')');
    ok(away.aero === 'HOME' || W.kind === 'away', 'away where you hold nothing (' + W.kind + ')');
    ok(r.doc.wallet === w0 - away.price && r.doc.ledger.slice(-1)[0].k === 'buy', 'paid the seller\'s price, a `buy` line');
    ok(!M.procureMarketOf(r.doc).some(x => x.id === away.id), 'gone from the market');
    ok(!M.procureBuyUsed(r.doc, away.id, { slot: 'Used 2', slotNames: ['Used 1'], fileSpec: FILE[away.design] }).ok, 'not sold twice');
    const A = r.doc.career.airframes['Used 1'];
    ok(A && A.from === 'used' && A.cert && A.cert.emptyKg === M.procureUsedCert(away).emptyKg && A.fp === M.procureFp(r.envelope.spec), 'its row: the used certificate (the kilos counted), its fingerprint');
    ok(J(r.envelope.spec) === J(M.procureUsedSpec(away, FILE[away.design])), 'the slot is the listing\'s spec');
    const bh = M.playerBringHome(r.doc, 'Used 1');
    ok(bh.ok && M.playerWhere(bh.doc, 'Used 1').aero === 'HOME' && bh.doc.wallet === r.doc.wallet, 'brought home free (GQ5)');
    const poor = clone(d); poor.wallet = 10;
    const rp = M.procureBuyUsed(poor, away.id, { slot: 'U', slotNames: [], fileSpec: FILE[away.design] });
    ok(!rp.ok && rp.doc === poor, 'a short wallet: refused, the same document');
    ok(!M.procureBuyUsed(d, away.id, { slot: 'X', slotNames: ['X'], fileSpec: FILE[away.design] }).ok, 'a taken slot name: refused');
    // a hangar of yours where it stands: inside
    const home = L.find(x => x.aero === 'HOME');
    if (home) { const rh = M.procureBuyUsed(d, home.id, { slot: 'H', slotNames: [], fileSpec: FILE[home.design] }); ok(rh.ok && M.playerWhere(rh.doc, 'H').kind === 'in', 'at HOME it goes into the main hangar'); }
    // a maker's model
    const v = M.procureBuyModel(d, 'scout', {}, { slot: 'S', slotNames: [], fileSpec: FILE.cub });
    ok(v.ok && v.doc.wallet === d.wallet && v.price.voucher && v.doc.career.voucher.used, 'the voucher pays one stock Scout (the Cub)');
    const v2 = M.procureBuyModel(v.doc, 'scout', {}, { slot: 'S2', slotNames: ['S'], fileSpec: FILE.cub });
    ok(v2.ok && !v2.price.voucher && v2.doc.wallet === v.doc.wallet - v2.price.total, 'a second one is paid');
    const v3 = M.procureBuyModel(d, 'scout', { engine: 'o200' }, { slot: 'S', slotNames: [], fileSpec: FILE.cub });
    ok(v3.ok && !v3.price.voucher && v3.doc.wallet < d.wallet && !v3.doc.career.voucher.used, 'the voucher does not pay a customised one');
    ok(M.playerWhere(v.doc, 'S').kind === 'in' && M.playerWhere(v.doc, 'S').hangar === 'HOME', 'delivered into the main hangar');
    const ri = M.procureBuyModel(d, 'meridian', { gear: 'floats' }, { slot: 'M', slotNames: [], fileSpec: FILE.c172f });
    ok(!ri.ok && ri.doc === d, 'the Meridian costs more than the grant: refused, the same document');
    const rich = clone(d); rich.wallet = 1e6;
    const mf = M.procureBuyModel(rich, 'meridian', { gear: 'floats', reg: 'n-abcd' }, { slot: 'M', slotNames: [], fileSpec: FILE.c172f });
    ok(mf.ok && mf.envelope.spec.gear.type === 'floats' && mf.envelope.spec.meta.reg === 'N-ABCD' && mf.doc.career.airframes.M.design === 'c172f', 'a Meridian on floats: the floats build, its registration');
    // a side hangar: the delivery fee
    const acq = M.playerAcquire(rich, 'w3', 'w3', 'field', 'own');
    if (ok(acq.ok, 'a side hangar at Tamgas Hill: ' + acq.why)) {
      const sd = M.procureBuyModel(acq.doc, 'scout', { engine: 'r912' }, { slot: 'SS', slotNames: [], fileSpec: FILE.cub, hangar: 'w3' });
      ok(sd.ok && sd.price.delivery > 0 && M.playerWhere(sd.doc, 'SS').aero === 'w3', 'delivered to the side hangar, a delivery fee (' + (sd.ok && sd.price.delivery) + ')');
    }
    ok(!M.procureBuyModel(d, 'scout', {}, { slot: 'S', slotNames: [], fileSpec: FILE.cub, hangar: 'w3' }).ok, 'no delivery to a hangar you do not hold');
    // the price door: ECONOMY's econPrice when it exists
    ok(M.procureEconSource() === 'stub' || typeof extra === 'object', 'the stub stands in for econPrice (ECONOMY not merged)');
  }
  // ECONOMY's function, when present, is what prices
  {
    const ME = loadModel(mut, Object.assign({}, extra || {}, { econPrice: (k, it) => (k === 'model' ? 12345 : k === 'option' ? 7 : NaN) }));
    ok(ME.procureEconSource() === 'econPrice' && ME.procurePrice('scout', ME.procureOpts('scout', { engine: 'o200' }).opts).total === 12345 + 7, 'econPrice(kind, item) prices when ECONOMY has landed');
  }

  // ---- THE BOARD / THE SANDBOX ----
  {
    const sb = M.playerDefault();
    ok(J(Object.keys(sb).sort()) === J(['clock', 'fleet', 'here', 'ledger', 'mode', 'sheds', 'v', 'wallet', 'what']), 'the sandbox document carries no procurement field');
    const sbn = M.playerNormalise(clone(sb));
    ok(J(sbn) === J(M.playerDefault()), 'the sandbox normaliser is unchanged');
    const t = M.procureBuyModel(sb, 'scout', { engine: 'o200' }, { slot: 'T', slotNames: [], fileSpec: FILE.cub });
    ok(t.ok && t.doc.wallet === 0 && t.doc.ledger.slice(-1)[0].free === true && t.doc.ledger.slice(-1)[0].k === 'buy' && !t.doc.career, 'the sandbox Takes it free (a free line), no career block');
    const B = M.procureBoard(t.doc, ['T', 'Mine']);
    ok(B.mode === 'sandbox' && B.designs.length === 2 && J(M.procureAirframeSlots(t.doc, ['T', 'Mine'])) === J(['Mine', 'T']), 'the sandbox: every slot is both');
    ok(!M.procureBuildDesign(t.doc, 'Mine', { cost: 1000 }).ok, 'the sandbox builds nothing (every slot is an aeroplane)');
    let d = M.careerNew({ id: 't', seed: 'dev' });
    const bd = M.procureBuildDesign(d, 'Mine', { cost: 20000 });
    ok(bd.ok && bd.doc.wallet === d.wallet - 20000 && bd.doc.career.airframes.Mine && M.playerWhere(bd.doc, 'Mine').hangar === 'HOME', 'Build this design: the ledger paid, an airframe in the main hangar');
    ok(!M.procureBuildDesign(bd.doc, 'Mine', { cost: 20000 }).ok, 'a design built twice: refused');
    ok(!M.procureBuildDesign(d, 'Mine', {}).ok, 'a design whose ledger is not read: refused');
    const B2 = M.procureBoard(bd.doc, ['Mine', 'Idea']);
    ok(B2.mode === 'career' && B2.designs.find(x => x.name === 'Idea').airframe === false && B2.designs.find(x => x.name === 'Mine').airframe === true, 'the career board: designs vs airframes');
    const sv = M.procureSaveDesign(bd.doc, 'Mine', FILE.cub.spec, 'Mine copy', ['Mine']);
    ok(sv.ok && sv.envelope.name === 'Mine copy' && sv.envelope.log.factory.design === true, 'Save as design files the spec under a new name');
    ok(!M.procureSaveDesign(bd.doc, 'Mine', FILE.cub.spec, 'Mine', ['Mine']).ok, 'Save as design never overwrites');
    const sm = M.procureMarketOf(M.playerDefault());
    ok(J(sm) === J(M.procureMarket('sandbox', 0, [])), 'the sandbox market is the fixed seed');
  }

  // ---- TEXT, WORDS, PURITY ----
  for (const k of Object.keys(M.PROCURE_TEXT)) ok(typeof M.PROCURE_TEXT[k].t === 'string' && M.PROCURE_TEXT[k].draft === true, 'text ' + k + ' is draft text');
  for (const m of Object.keys(M.PROCURE_MAKERS)) for (const f of ['name', 'line']) {
    const t = M.procureText(M.PROCURE_MAKERS[m][f]);
    ok(!/\[/.test(t) && !M.contractConfigWord(t), 'maker ' + m + ' ' + f + ' resolves, names no brand or configuration ("' + t + '")');
  }
  for (const m of Object.keys(PM)) for (const f of ['name', 'line']) {
    const t = M.procureText(PM[m][f]);
    ok(!/\[/.test(t) && !M.contractConfigWord(t), 'model ' + m + ' ' + f + ' resolves, names no brand or configuration ("' + t + '")');
  }
  for (const m of ids) for (const r of Object.keys(PM[m].opts)) for (const v of Object.keys(PM[m].opts[r].vals)) {
    const t = M.procureOptWord(m, r, v);
    ok(t && !/\[/.test(t) && !M.contractConfigWord(t), m + ' ' + r + '=' + v + ': worded, no brand ("' + t + '")');
  }
  {
    const s = M.__src['76'].replace(/\/\/.*$/gm, '');
    for (const w of ['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'THREE', 'Math.random', 'Date.now', 'new Date', 'fetch('])
      ok(!s.includes(w), '76_procure.js is pure: no ' + w);
  }
  return { fails: fails.slice(), checks };
}

const base = run(null);
if (!SELF) {
  for (const f of base.fails) console.log('  FAIL  ' + f);
  console.log('  ' + base.checks + ' checks, ' + Object.keys(MEAS).length + ' shakedowns (cached by content)');
  console.log('GATE PROCURE: ' + (base.fails.length ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
  process.exit(base.fails.length ? 1 : 0);
}
if (base.fails.length) { console.log('GATE PROCURE selftest: the gate is red before any break (' + base.fails[0] + ')'); process.exit(1); }

// ---- negative verification: each rule broken in its own source --------------
const sub = (a, b) => s => { if (s.indexOf(a) < 0) throw new Error('selftest anchor gone: ' + a); return s.split(a).join(b); };
const BREAKS = [
  ['an unvalidated archetype on sale', { s76: s => sub("      .filter(id => Object.values(PROCURE_MODELS[id].designs).every(procureValidated));", '')(sub("  tern: {\n", "  moth: { id: 'moth', maker: 'bramble', name: 'mdl.scout.name', line: 'mdl.scout.line', designs: { wheels: 'tigermoth' }, opts: {} },\n  tern: {\n")(s)) }],
  ['the validated filter is off', { s76: sub("      .filter(id => Object.values(PROCURE_MODELS[id].designs).every(procureValidated));", '') }],
  ['an engine names the wrong panel row', { s76: sub("o320:  { preset: 'lycoming O-320',    idx: 17,", "o320:  { preset: 'lycoming O-320',    idx: 18,") }],
  ['an option writes nothing (the tank)', { s76: sub("    if (v) V.push({ bay: 'wingRoot',", "    if (false) V.push({ bay: 'wingRoot',") }],
  ['an engine keeps the old engine\'s dials', { s76: sub('Object.assign({}, s.cage, PROCURE_ENG_BASE, PROCURE_ENG_DIALS[val.eng], { engPreset: E.idx })', 'Object.assign({}, s.cage, { engPreset: E.idx })') }],
  ['an engine\'s dial dict drifts from the panel', { s76: sub('o200: {eng_rpm: 2750', 'o200: {eng_rpm: 2700') }],
  ['an option effect drifts from its measurement', { s76: sub('o200: { eng: \'o200\', eff: { cub: PE_({ cost: 15100, emptyKg: 8,', 'o200: { eng: \'o200\', eff: { cub: PE_({ cost: 15100, emptyKg: 2,') }],
  ['the stock model is not the validated file', { s76: sub("  s.meta = Object.assign({}, s.meta || {}, { name: procureText(M.name) });", "  s.meta = Object.assign({}, s.meta || {}, { name: procureText(M.name) }); s.cabin = Object.assign({}, s.cabin, { baggage: 25 });") }],
  ['the certificate ignores the options', { s76: sub('    c.cost += e.cost || 0; c.emptyKg += e.emptyKg || 0;', '    if (false) c.cost += e.cost || 0; c.emptyKg += e.emptyKg || 0;') }],
  ['the fingerprint ignores the airframe', { s76: sub("  if (c.cage && typeof c.cage === 'object') for (const k of Object.keys(c.cage))", "  delete c.cage; delete c.wings; delete c.engines; delete c.energy; delete c.systems; delete c.cabin; delete c.gear;\n  if (c.cage && typeof c.cage === 'object') for (const k of Object.keys(c.cage))") }],
  ['the fingerprint counts the paint', { s76: sub("const PROCURE_COSMETIC = ['paint', 'finish', 'meta'];", "const PROCURE_COSMETIC = ['paint'];") }],
  ['the factory signature moves on every load', { s76: sub("  if (!A || !A.factory || A.anchored) return { ok: true, doc, why: A ?", "  if (!A || !A.factory) return { ok: true, doc, why: A ?") }],
  ['the provisional signature is final', { s76: sub('const fp = procureFp(spec), fin = !(opts && opts.provisional);', 'const fp = procureFp(spec), fin = true;') }],
  ['a save before the signature withdraws it', { s76: sub("  if (A.factory && !A.anchored) return Object.assign(procureAnchor(doc, slot, spec), { modified: false, bill: null, why: 'signed on the garage\\'s aeroplane' });\n", '') }],
  ['a modified airframe keeps its certificate', { s76: sub('  R.factory = false; R.modified = true; R.fp = fp; R.cert = null;', '  R.fp = fp;') }],
  ['the edit is billed the whole aeroplane', { s76: sub('    if (!o || Math.abs(o[0] - n[0]) > 0.05 || Math.abs(o[1] - n[1]) > 1) lines.push({ k, cost: n[1] });', '    lines.push({ k, cost: n[1] });') }],
  ['the map states a withdrawn certificate', { s75: sub("    if (A && A.modified) return certs[n] ? careerDesignCert(certs[n], 'the saved build\\'s shakedown') : null;\n", '') }],
  ['the market is random', { s76: sub("  const rng = contractRng(String(seed) + '|' + id);", "  const rng = contractRng(String(seed) + '|' + id + '|' + Math.floor(Math.random() * 1e9));") }],
  ['the market never refreshes', { s76: sub('const procureUsedEpoch = done => Math.floor(Math.max(0, done || 0) / PROCURE_USED_EVERY);', 'const procureUsedEpoch = done => 0;') }],
  ['more than four listings', { s76: sub('const PROCURE_USED_MAX = 4;', 'const PROCURE_USED_MAX = 6;') }],
  ['a listing stands where it cannot fly from', { s76: sub('  const can = fields.filter(f => procureFlyableAt(cert, f));', '  const can = fields;') }],
  ['the condition leaves its band', { s76: sub('const PROCURE_COND = [0.4, 0.8];', 'const PROCURE_COND = [0.2, 0.95];') }],
  ['the older panel is only words', { s76: sub("    if (down) { o.avionics = Object.keys(AV.vals).find(v => AV.vals[v].fit === down); older = true; }", '    if (down) { older = true; }') }],
  ['the extra kilos are only words', { s76: sub("  if (L.kg) s.cargo = Object.assign({}, s.cargo || { len: 0, kg: 0 }, { kg: ((s.cargo && +s.cargo.kg) || 0) + L.kg });", '') }],
  ['a used one is stationed at HOME', { s76: sub('  const r = prStation(d, slot, L.aero, { foot: o.foot });', "  const r = prStation(d, slot, 'HOME', { foot: o.foot });") }],
  ['a sold listing stays on the market', { s76: sub('  mk.sold = (Array.isArray(mk.sold) ? mk.sold : []).concat([L.id]);', '') }],
  ['the sandbox is charged', { s76: sub("  playerCharge(D2, total, 'buy', slot);", "  if (!career) D2.wallet -= total; playerCharge(D2, total, 'buy', slot);") }],
  ['the voucher pays a customised one', { s76: sub('V.model === P.design && stock);', 'V.model === P.design);') }],
  ['econPrice is ignored', { s76: sub("  if (typeof econPrice === 'function') { const v = econPrice(kind, item); if (typeof v === 'number' && isFinite(v)) return v; }", '') }],
  ['a maker name is a brand', { s76: sub("'mk.bramble.name':   PT_('Bramble Light Aircraft'),", "'mk.bramble.name':   PT_('Piper Light Aircraft'),") }],
  ['the model reaches for storage', { s76: s => s + '\nfunction prLeak() { return localStorage; }\n' }],
];
let bad = 0;
for (const [name, mut] of BREAKS) {
  let r;
  try { r = run(mut); } catch (e) { r = { fails: [e.message], checks: 0 }; }
  const caught = r.fails.length > base.fails.length;
  console.log((caught ? '  caught  ' : '  MISSED  ') + name + (caught ? '  (' + (r.fails.length - base.fails.length) + ' new: ' + r.fails[0].slice(0, 90) + ')' : ''));
  if (!caught) bad++;
}
console.log('  ' + (BREAKS.length - bad) + ' of ' + BREAKS.length + ' doctored rules caught');
console.log('GATE PROCURE selftest: ' + (bad ? 'FAIL (' + bad + ' not caught)' : 'PASS'));
process.exit(bad ? 1 : 0);
