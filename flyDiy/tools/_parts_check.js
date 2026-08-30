#!/usr/bin/env node
// GATE PARTS — the declared assembly (G76) against what the editor and the
// generator actually do.
//
//   node tools/_parts_check.js            -> "GATE PARTS: PASS|FAIL"
//   node tools/_parts_check.js --selftest -> negative verification
//
// tools/_cage_parts.js says which parameter belongs to which part of the
// aeroplane and which mesh sections that part is made of. Nothing derives it,
// so nothing keeps it true except this gate. The failure it exists to catch is
// mundane and total: a slider is added to a layer, nobody adds it to the table,
// and it silently disappears from the editor — the panel would show every row
// it was told about and no row it was not, and there is no screen on which the
// absence is visible.
//
// WHAT IT GUARDS, and why each one is here rather than left to the eye:
//
//   PARAMS     every key the panel renders is claimed by EXACTLY ONE part, and
//              every key the table claims is really rendered. Both directions:
//              an orphan is a lost slider, a phantom is a typo that will never
//              show up as anything at all.
//   SECTIONS   every material name a REAL BUILD emits is claimed by exactly one
//              part. The list is read off builds across the shape set (the
//              GATE SKINMAT discipline), not copied from SEC, because the
//              sections that exist depend on what you built.
//   PLACEMENT  P8 §5's strip re-presents rows the part already owns. A `place`
//              key that is not in the part's own groups would render a row
//              twice, or render one that belongs to a different part.
//   SHAPE      parents resolve, no cycles, one root, keys unique, every `when`
//              is callable against the real parameter set.
//   EXISTENCE  every `when` actually discriminates on some buildable
//              aeroplane. A `when` that is true for every shape in the set is
//              not an existence rule, it is a mistake that hides nothing.
//
// NEGATIVE-VERIFIED (G3.2): --selftest breaks each rule in turn and requires
// the corresponding check to fail. A check on an observable that cannot change
// is indistinguishable from a check that works.
'use strict';
const path = require('path');

const ROOT = path.join(__dirname, '..');
const T = __dirname;

// ---------------------------------------------------------------------------
// THE PANEL, HEADLESS. The row tables are plain data hanging off
// window.CAGE_PAGE, and every layer pushes its own group into them at load —
// so the whole editor's row list is reachable in node behind a `window` shim
// and a THREE stand-in, with no DOM at all. That matters: the alternative is
// parsing the sources, and a parser would go stale the first time a layer
// composed its rows instead of writing them out.
// ---------------------------------------------------------------------------
function loadPanel() {
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj {
    constructor() {
      this.children = []; this.position = { set: noop };
      this.rotation = {}; this.scale = { set: noop, setScalar: noop };
    }
    add() { return this; } remove() {} traverse() {}
  }
  global.THREE = new Proxy({}, { get: (t, k) => {
    if (k === 'Vector3')
      return function () { return { set: noop, x: 0, y: 0, z: 0 }; };
    return class extends Obj {};
  } });
  global.window = { THREE: global.THREE };
  // the game bundle's editor list, in order (tools/build.js MANIFEST.editor),
  // minus _cage_ui.js which is the only one that needs a document
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js',
    '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    '_cage_gear.js', '_fit_site.js', '_fit_gen.js',
    '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js',
    '_strut_gen.js', '_cage_wing.js', '_fin_gen.js', '_cage_fin.js',
    '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  return global.window;
}

const W = loadPanel();
const PARTS = require(path.join(T, '_cage_parts.js'));
const G = require(path.join(T, '_cage_gen.js'));

const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};

// ---------------------------------------------------------------------------
// the panel's own key list, walked exactly the way _cage_ui.js's renderItems
// walks it (a nested [name, [items]] is a subgroup, anything else is a row)
// ---------------------------------------------------------------------------
function panelKeys(groups) {
  const keys = [];
  const walk = items => {
    for (const it of items) {
      if (Array.isArray(it[1])) { walk(it[1]); continue; }
      keys.push(it[0]);
    }
  };
  for (const g of groups) walk(g[1]);
  return keys;
}
const RENDERED = panelKeys(W.CAGE_PAGE.groupsOverride);
// the panel renders some keys TWICE on purpose — the engine page shows
// `eng_rpm` under both `electric` and `engine geometry`, because it means the
// same thing to both and a builder should not have to know which powertrain
// folder to look in. The table claims a KEY, so both rows follow one part.
const RENDERED_SET = new Set(RENDERED);
check(RENDERED_SET.size > 300, 'too few rows to be a real coverage test',
  `${RENDERED_SET.size}`);

// ---------------------------------------------------------------------------
// 1 SHAPE
// ---------------------------------------------------------------------------
function checkShape(P) {
  const seen = new Set(), roots = [];
  let ok = true;
  for (const p of P.CAGE_PARTS) {
    if (seen.has(p.key)) ok = check(false, 'duplicate part key', p.key);
    seen.add(p.key);
    if (p.root) roots.push(p.key);
  }
  ok = check(roots.length === 1, 'there must be exactly one root part',
    roots.join(',')) && ok;
  for (const p of P.CAGE_PARTS) {
    if (p.parent === null || p.parent === undefined) continue;
    ok = check(seen.has(p.parent), 'part points at a parent that does not exist',
      `${p.key} -> ${p.parent}`) && ok;
  }
  // no cycles: every part reaches a null parent in fewer steps than there are
  // parts
  for (const p of P.CAGE_PARTS) {
    let cur = p, n = 0;
    while (cur && cur.parent != null && n <= P.CAGE_PARTS.length) {
      cur = P.partByKey[cur.parent]; n++;
    }
    ok = check(n <= P.CAGE_PARTS.length, 'cycle in the part tree', p.key) && ok;
  }
  // an assembly with no children is a part that forgot to say so
  for (const p of P.CAGE_PARTS) {
    if (p.parent !== null || p.root) continue;
    const kids = P.CAGE_PARTS.filter(c => c.parent === p.key).length;
    ok = check(kids > 0, 'assembly with no parts under it', p.key) && ok;
  }
  // every `when` survives being called on the real parameter set
  for (const p of P.CAGE_PARTS) {
    if (!p.when) continue;
    try { p.when(G.CAGE_PARAMS); }
    catch (e) { ok = check(false, 'part `when` threw', `${p.key}: ${e.message}`); }
  }
  return ok;
}
checkShape(PARTS);

// ---------------------------------------------------------------------------
// 2 PARAMS — both directions
// ---------------------------------------------------------------------------
function checkParams(P) {
  const claimedBy = new Map();
  let ok = true;
  for (const p of P.CAGE_PARTS)
    for (const k of P.cagePartParams(p)) {
      if (claimedBy.has(k))
        ok = check(false, 'parameter claimed by two parts',
          `${k}: ${claimedBy.get(k)} and ${p.key}`) && ok;
      else claimedBy.set(k, p.key);
    }
  const orphans = [...RENDERED_SET].filter(k => !claimedBy.has(k));
  ok = check(orphans.length === 0,
    'rows the editor renders that no part claims (they would vanish from the ' +
    'part tree)', orphans.join(' ')) && ok;
  const phantoms = [...claimedBy.keys()].filter(k => !RENDERED_SET.has(k));
  ok = check(phantoms.length === 0,
    'parts claiming rows the editor does not render', phantoms.join(' ')) && ok;
  return ok;
}
checkParams(PARTS);

// ---------------------------------------------------------------------------
// 3 SECTIONS — read off real builds, never copied
// ---------------------------------------------------------------------------
// The shapes are chosen so that every branch of the generator that INVENTS a
// section is exercised: the boom's two styles, the taper with and without its
// panels, the mirrored pod, the four interior constructions, the skylight and
// the passenger bays. A section that only exists on a rod boom would otherwise
// never be tested, and those are exactly the ones a table forgets.
const SHAPES = [
  ['stock', {}],
  ['rod', { boomStyle: 1 }],
  ['taper', { taperOn: 1 }],
  ['rod + taper panels', { boomStyle: 1, taperOn: 1, taperPanels: 1 }],
  ['pod', { mirror: 1, canopy: 3 }],
  ['no skin', { skinOn: 0 }],
  ['passengers', { paxCount: 3, doorPax: 1 }],
  ['skylight', { skylight: 1, skyExt: 3 }],
  ['composite', { intOn: 1, intCons: 0, intDash: 1, intFire: 1, intBulk: 1 }],
  ['steel tube', { intOn: 1, intCons: 1, intDash: 1, intFire: 1, intBulk: 1 }],
  ['plywood', { intOn: 1, intCons: 2, intDash: 1, intFire: 1, intBulk: 1 }],
  ['aluminium', { intOn: 1, intCons: 3, intDash: 1, intFire: 1, intBulk: 1 }],
];
// THE BUILD IS THE EDITOR'S BUILD, subdivision included. _cage_ui.js
// SUBDIVIDES FIRST and runs the crease passes on the refined mesh, and that
// ordering decides what exists: the dashboard traces the DISPLAYED windscreen
// seam, so at level 0 there is no dash in the mesh at all. A gate that built at
// level 0 would report a section the editor shows on every screen as one no
// build emits. Level 1 is enough — the section list does not change again at 2,
// which is the editor's default — and it is four times cheaper.
//
// The base is the PAGE'S OWN AEROPLANE (the jodel of _cage_page5.js), not the
// bare template: it is what the editor opens on, and several sections (the
// taper panels among them) exist on it and not on the template.
const PAGE_BASE = Object.assign({}, G.CAGE_PARAMS,
                                (W.CAGE_PAGE && W.CAGE_PAGE.defaults) || {});
function emittedSections() {
  const all = new Set();
  for (const [, over] of SHAPES) {
    const P = Object.assign({}, PAGE_BASE, over);
    const spec = G.cageSpec(P);
    let s = G.cageSubdivide(G.buildCage2(spec, 'crease'));
    if (G.cageGlassSill) s = G.cageGlassSill(s, spec);
    if (G.cageCut) s = G.cageCut(s, spec);
    if (G.cageCanopy) s = G.cageCanopy(s, spec);
    s = G.cageRims(s, spec);
    if (G.cageInterior) s = G.cageInterior(s, spec);
    for (const f of s.F) all.add(f.m);
  }
  return all;
}
const EMITTED = emittedSections();
check(EMITTED.size > 20, 'too few sections to be a real coverage test',
  `${EMITTED.size}`);

function checkSections(P) {
  let ok = true;
  const claimedBy = new Map();
  for (const p of P.CAGE_PARTS)
    for (const s of (p.sections || [])) {
      if (claimedBy.has(s))
        ok = check(false, 'section claimed by two parts',
          `${s}: ${claimedBy.get(s)} and ${p.key}`) && ok;
      else claimedBy.set(s, p.key);
    }
  const unowned = [...EMITTED].filter(s => !claimedBy.has(s));
  ok = check(unowned.length === 0,
    'sections real builds emit that no part owns (clicking them in the view ' +
    'would select nothing)', unowned.join(' ')) && ok;
  // ...and NOTHING is claimed that no build emits. The shape set is chosen so
  // every section in SEC is reachable, so a ghost is a name that has gone
  // stale rather than a combination the sweep happens to miss.
  const ghosts = [...claimedBy.keys()].filter(s => !EMITTED.has(s));
  ok = check(ghosts.length === 0, 'parts owning sections no build emits',
    ghosts.join(' ')) && ok;
  return ok;
}
checkSections(PARTS);

// ---------------------------------------------------------------------------
// 4 PLACEMENT — the strip re-presents, it never introduces
// ---------------------------------------------------------------------------
function checkPlacement(P) {
  let ok = true;
  for (const p of P.CAGE_PARTS) {
    if (!p.place) continue;
    const own = new Set(P.cagePartParams(p));
    for (const slot of ['fore', 'up', 'len', 'wide']) {
      const k = p.place[slot];
      if (!k) continue;
      ok = check(own.has(k),
        'placement names a row the part does not own',
        `${p.key}.${slot} = ${k}`) && ok;
    }
    ok = check(typeof p.place.at === 'string' && p.place.at.length > 0,
      'placement with no anchor named', p.key) && ok;
  }
  return ok;
}
checkPlacement(PARTS);

// ---------------------------------------------------------------------------
// 5 EXISTENCE — a `when` that never changes is not a `when`
// ---------------------------------------------------------------------------
function checkExistence(P) {
  let ok = true;
  // the discriminator sweep: every parameter any `when` reads, at both ends of
  // its range. Built by asking each `when` which keys it touches, through a
  // Proxy — no list to keep in step with the table.
  const probe = when => {
    const touched = new Set();
    const spy = new Proxy(Object.assign({}, G.CAGE_PARAMS), {
      get: (t, k) => { if (typeof k === 'string') touched.add(k); return t[k]; },
    });
    try { when(spy); } catch (e) {}
    return [...touched];
  };
  for (const p of P.CAGE_PARTS) {
    if (!p.when) continue;
    const keys = probe(p.when);
    ok = check(keys.length > 0, 'part `when` reads no parameter', p.key) && ok;
    let sawTrue = false, sawFalse = false;
    // off = every key it reads at 0; on = every key at its default (or 1)
    const off = Object.assign({}, G.CAGE_PARAMS);
    const on = Object.assign({}, G.CAGE_PARAMS);
    for (const k of keys) { off[k] = 0; on[k] = (+G.CAGE_PARAMS[k] || 1) || 1; }
    try { sawFalse = !p.when(off); } catch (e) {}
    try { sawTrue = !!p.when(on); } catch (e) {}
    ok = check(sawTrue && sawFalse,
      'part `when` does not discriminate (always on, or always off)',
      `${p.key} on=${sawTrue} off=${sawFalse}`) && ok;
  }
  return ok;
}
checkExistence(PARTS);

// ---------------------------------------------------------------------------
// 6 THE WALK — what the inspector shows for the root is what the table holds
// ---------------------------------------------------------------------------
{
  const all = PARTS.cagePartsUnder('craft');
  const reachable = new Set(all.map(p => p.key));
  const missing = PARTS.CAGE_PARTS
    .filter(p => !p.root && !reachable.has(p.key)).map(p => p.key);
  check(missing.length === 0,
    'parts unreachable from the root (they would never appear in the tree)',
    missing.join(' '));
  const rootKeys = new Set();
  for (const p of all) for (const k of PARTS.cagePartParams(p)) rootKeys.add(k);
  check(rootKeys.size === new Set([...RENDERED_SET]).size,
    'selecting the root does not show every row the editor renders',
    `${rootKeys.size} vs ${RENDERED_SET.size}`);
}

// ---------------------------------------------------------------------------
// NEGATIVE VERIFICATION
// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  const clone = () => {
    const c = JSON.parse(JSON.stringify(
      PARTS.CAGE_PARTS.map(p => Object.assign({}, p, { when: undefined }))));
    // JSON drops the functions; put the real ones back
    c.forEach((p, i) => {
      if (PARTS.CAGE_PARTS[i].when) p.when = PARTS.CAGE_PARTS[i].when;
      if (PARTS.CAGE_PARTS[i].count) p.count = PARTS.CAGE_PARTS[i].count;
    });
    const byKey = {};
    for (const p of c) byKey[p.key] = p;
    return { CAGE_PARTS: c, partByKey: byKey,
             cagePartParams: PARTS.cagePartParams,
             cagePartsUnder: PARTS.cagePartsUnder };
  };
  const cases = [
    ['orphan row', fn => { const P = clone();
      P.partByKey.nose.groups[0][1] =
        P.partByKey.nose.groups[0][1].filter(k => k !== 'noseLen');
      return fn(P, checkParams); }],
    ['duplicate claim', fn => { const P = clone();
      P.partByKey.cabin.groups[0][1].push('noseLen');
      return fn(P, checkParams); }],
    ['phantom row', fn => { const P = clone();
      P.partByKey.nose.groups[0][1].push('noSuchParam');
      return fn(P, checkParams); }],
    ['unowned section', fn => { const P = clone();
      P.partByKey.windscreen.sections = [];
      return fn(P, checkSections); }],
    ['section claimed twice', fn => { const P = clone();
      P.partByKey.cabin.sections = ['windshield'];
      return fn(P, checkSections); }],
    ['placement off the part', fn => { const P = clone();
      P.partByKey.nose.place.len = 'boomLen';
      return fn(P, checkPlacement); }],
    ['placement with no anchor', fn => { const P = clone();
      delete P.partByKey.nose.place.at;
      return fn(P, checkPlacement); }],
    ['dangling parent', fn => { const P = clone();
      P.partByKey.nose.parent = 'nowhere';
      return fn(P, checkShape); }],
    ['a `when` that never discriminates', fn => { const P = clone();
      P.partByKey.taper.when = Q => +Q.taperOn >= 0;
      return fn(P, checkExistence); }],
  ];
  let bad = 0;
  for (const [name, run] of cases) {
    const before = fail.length;
    const ok = run((P, f) => f(P));
    const caught = fail.length > before || ok === false;
    // the broken copy's complaints are not the real table's
    fail.length = before;
    console.log(`  selftest ${caught ? 'caught  ' : 'MISSED  '}${name}`);
    if (!caught) bad++;
  }
  check(bad === 0, `${bad} rule(s) cannot be broken — those checks are inert`);
}

// ---------------------------------------------------------------------------
const nParts = PARTS.CAGE_PARTS.filter(p => !p.root && p.parent !== null).length;
const nAsm = PARTS.CAGE_PARTS.filter(p => p.parent === null && !p.root).length;
console.log(`  ${nAsm} assemblies, ${nParts} parts, ${RENDERED_SET.size} rows, ` +
            `${EMITTED.size} sections over ${SHAPES.length} shapes`);
if (fail.length) {
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE PARTS: FAIL');
  process.exit(1);
}
console.log('GATE PARTS: PASS');
