#!/usr/bin/env node
// Gate: THE BUILD FILE (G63). ROADMAP ruling 4 says save compatibility is
// forever from the slice onward — "every version bump ships its migrator, and
// the battery keeps one old build of each vintage as a loading gate" — and
// until now nothing anywhere exercised `envelope`/`unwrap`, a save→load round
// trip, the editor's own spec conversion, or a cross-format import. Three
// stores and two incompatible files both tagged `flydiy-build` grew in that
// blind spot.
//
// What this gates is the WHOLE ROUND TRIP, through the real code:
//   the shelf        src/viewer/garage.js, run against a DOM + storage stub
//   the editor's I/O tools/_cage_gen.js  cageToSpec / cageFromSpec
//   the join         tools/_cage_join.js cageJoinSpec
//   the normaliser   src/core/60_gen_spec.js genNormaliseSpec
//
// THE G48 LESSON APPLIES THROUGHOUT: an assertion that reads the object the
// code just wrote proves nothing, so the spec assertions read the RESOLVED
// spec, and every canned value is chosen to differ from what the generator
// would derive on its own.
//
// Run: node tools/test_build.js
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const C = require('./flight_core.js');
const CAGE2 = require('./_cage_gen.js');
const { cageJoinSpec } = require('./_cage_join.js');
const { GEN_DEFAULT, GEN_SPEC_V, GEN_TIPS, GEN_FLAPS,
        genNormaliseSpec, resolveSpec } = C;

let fails = 0;
const ok = (cond, label) => {
  console.log((cond ? '  ok     ' : '  FAIL   ') + label);
  if (!cond) fails++;
};
const clone = o => JSON.parse(JSON.stringify(o));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------------------
// The page definition. _cage_page5.js is a bare `window.CAGE_PAGE = {...}`, so
// it needs a window to land in rather than a require.
// ---------------------------------------------------------------------------
const pageBox = { window: {}, console };
vm.createContext(pageBox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '_cage_page5.js'), 'utf8'),
                pageBox, { filename: '_cage_page5.js' });
const CAGE_PAGE = pageBox.window.CAGE_PAGE;
// The game never runs without `window.CAGE_PAGE`, and since G106 the cage
// boundary reads the page's `defaults` (THE DEFAULT AEROPLANE) lazily as the
// layer keys' declared baseline — so the harness publishes the page where
// CAGE2's own scope will find it, or every conversion below would exercise
// the pageless fallback the game never takes. (Layers are not loaded here,
// exactly as before; the baseline is the page's own declaration.)
global.window = { CAGE_PAGE };

// ---------------------------------------------------------------------------
// The shelf, running for real. Minimal DOM + a localStorage that behaves like
// one (string values, a key()/length pair, so slotNames actually enumerates).
// ---------------------------------------------------------------------------
function mkEl() {
  const e = { style: {}, value: '', disabled: false, textContent: '',
              innerHTML: '', children: [], files: null,
              addEventListener(k, f) { (this.on || (this.on = {}))[k] = f; },
              appendChild(c) { this.children.push(c); return c; },
              click() {}, };
  return e;
}
function mkStore() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: i => Array.from(m.keys())[i],
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    _map: m,
  };
}
const els = {};
const store = mkStore();
let applied = null;
const gbox = {
  console,
  document: {
    getElementById: id => (els[id] || (els[id] = mkEl())),
    createElement: () => mkEl(),
    body: mkEl(),
  },
  alert: msg => { throw new Error('unexpected alert: ' + msg); },
  prompt: () => 'named build',
  Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL() {} },
  setTimeout: () => {},
  // the two core globals garage.js reads out of the bundle it is inlined into
  GEN_SPEC_V, genNormaliseSpec,
};
gbox.window = { localStorage: store, CAGE2, CAGE_PAGE: CAGE_PAGE };
vm.createContext(gbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer',
                                          'garage.js'), 'utf8'),
                gbox, { filename: 'garage.js' });
gbox.garageInit({
  defaults: () => clone(GEN_DEFAULT),
  apply(s) { applied = s; },
  resolved: () => null,
  isGen: () => true,
  inGarage: () => true,
});
const SHELF = gbox.window.GARAGE_SPEC;
ok(!!SHELF, 'the shelf published window.GARAGE_SPEC');
ok(typeof SHELF.update === 'function', 'the shelf has an update door');

// ---------------------------------------------------------------------------
// A. NULL PATHS SURVIVE THE ROUND TRIP.
// Not the null COUNT — the G7 discipline is to compare the PATHS, because two
// specs can carry the same number of nulls in different places and only one of
// them is the aeroplane you saved. A field left null is one the generator
// DERIVES, and freezing a derived number into a save is how a build stops
// following its own cabin.
// ---------------------------------------------------------------------------
function nullPaths(o, pre, out) {
  out = out || []; pre = pre || '';
  if (o === null) { out.push(pre); return out; }
  if (typeof o !== 'object') return out;
  if (Array.isArray(o)) { o.forEach((v, i) => nullPaths(v, pre + '[' + i + ']', out)); return out; }
  for (const k of Object.keys(o).sort()) nullPaths(o[k], pre ? pre + '.' + k : k, out);
  return out;
}
{
  const spec0 = clone(GEN_DEFAULT);
  const before = nullPaths(spec0);
  ok(before.length > 20, 'the stock spec carries derived nulls (' + before.length + ')');
  SHELF.set(spec0);
  const env = JSON.parse(SHELF.json());
  ok(env.what === 'flydiy-build', 'the envelope is tagged flydiy-build');
  ok(env.v === GEN_SPEC_V, 'the envelope stamps the spec version');
  ok('plaque' in env && 'log' in env,
     'the envelope carries the plaque and the logbook beside the spec');
  ok(!('plaque' in env.spec) && !('log' in env.spec),
     '...and NOT inside it — a result is not a design decision');
  const after = nullPaths(genNormaliseSpec(env.spec));
  ok(eq(before, after), 'every derived null comes back a null, same paths');
}

// ---------------------------------------------------------------------------
// B. THE EDITOR ROUND TRIP IS AN IDENTITY over the WHOLE parameter set —
// layer keys included. The cage's own params have defaults in CAGE_PARAMS; the
// gear, engine, wing, tail and crew layers declare theirs in the page, and
// `cageToSpec` passes anything it does not recognise straight through. A build
// file has to be able to carry the cockpit.
// ---------------------------------------------------------------------------
{
  const full = Object.assign(CAGE2.cageDefaults(), CAGE_PAGE.defaults || {});
  // values chosen to differ from BOTH the template and the page defaults, so
  // "it round-tripped" cannot be impersonated by "nothing was set"
  full.waistY = -0.137; full.halfW = 0.6135;
  full.gyTrack = 1.771;                       // a gear-layer key
  full.wgSpan = 12.34;                        // a wing-layer key
  full.seatRake = 31.5;                       // a crew-layer key
  const back = CAGE2.cageFromSpec({ cage: CAGE2.cageToSpec(full) });
  const lost = Object.keys(full).filter(k => !(k in CAGE2.CAGE_VIEW_KEYS) &&
                                             back[k] !== full[k]);
  ok(lost.length === 0, 'P -> cageToSpec -> cageFromSpec is identity' +
     (lost.length ? ' (lost ' + lost.slice(0, 6).join(', ') + ')' : ''));
  ok(back.gyTrack === 1.771 && back.wgSpan === 12.34 && back.seatRake === 31.5,
     '...and the layer keys ride through, not just the cage ones');
}

// ---------------------------------------------------------------------------
// C. A STOCK DESIGN IS THE PRESET, EXACTLY.
// `applyPreset` resets to CAGE_PARAMS + the page's defaults and then applies
// the preset's overrides; an IMPORT of the same aeroplane started from
// CAGE_PARAMS alone, so the same design arrived different depending on which
// door it came through — the sailplane row carried a hand-written patch for
// exactly that and the piper cub did not. The shelf bakes the whole parameter
// set, so both doors are one door.
// ---------------------------------------------------------------------------
{
  const DEFAULTS = Object.assign(clone(CAGE2.CAGE_PARAMS), CAGE_PAGE.defaults || {});
  let checked = 0, bad = [], naiveDiffers = false;
  for (const nm in (CAGE_PAGE.presets || {})) {
    const pre = CAGE_PAGE.presets[nm] || {};
    // `_base: 'template'` says the row starts from CAGE_PARAMS instead of
    // from this page's defaults — the flag an imported build's cage needs,
    // because `spec.cage` is deviations from the template. Both consumers
    // honour it (applyPreset in _cage_ui.js, the stock bake in garage.js)
    // and so must the reference computed here, or this gate would assert
    // the leak rather than catch it.
    const tplBase = pre._base === 'template';
    const viaPreset = Object.assign(
      tplBase ? clone(CAGE2.CAGE_PARAMS) : clone(DEFAULTS), pre);
    delete viaPreset._base;
    // the shelf's bake, then the shelf's load
    const preFull = Object.assign(
      tplBase ? CAGE2.cageDefaults()
              : Object.assign(CAGE2.cageDefaults(), CAGE_PAGE.defaults || {}),
      pre);
    delete preFull._base;
    const baked = { cage: CAGE2.cageToSpec(preFull) };
    const viaShelf = CAGE2.cageFromSpec(baked);
    const diff = Object.keys(viaPreset).filter(
      k => !(k in CAGE2.CAGE_VIEW_KEYS) && viaShelf[k] !== viaPreset[k]);
    if (diff.length) bad.push(nm + ': ' + diff.slice(0, 4).join(', '));
    // NEGATIVE VERIFY: the naive bake — the preset's own keys alone, which is
    // what a hand-pasted export file is — must NOT reproduce it, or this
    // assertion is testing nothing.
    const bare = clone(pre); delete bare._base;
    const naive = CAGE2.cageFromSpec({ cage: bare });
    if (Object.keys(viaPreset).some(k => !(k in CAGE2.CAGE_VIEW_KEYS) &&
                                         naive[k] !== viaPreset[k]))
      naiveDiffers = true;
    checked++;
  }
  ok(checked >= 2, 'there are stock designs to check (' + checked + ')');
  ok(bad.length === 0, 'every stock design loads exactly as its preset applied' +
     (bad.length ? ' (' + bad.join(' | ') + ')' : ''));
  ok(naiveDiffers,
     'negative: the un-baked preset keys alone do NOT reproduce it');
  const listed = SHELF.stock();
  ok(listed.length === checked, 'the shelf lists all ' + checked + ' of them');
}

// ---------------------------------------------------------------------------
// C2. A STOCK DESIGN IS THE WHOLE AEROPLANE, not just its shape.
// The cage alone built an aeroplane — the generator fills what is missing —
// but it built the GENERATOR's aeroplane wearing somebody's fuselage: stock
// wing, stock engine, yellow paint. `CAGE_PAGE.builds` carries the sections
// a cage cannot, and this asserts they survive the shelf's bake AND the
// normaliser, on the RESOLVED spec rather than on the object just written.
// ---------------------------------------------------------------------------
{
  const names = Object.keys(CAGE_PAGE.builds || {});
  ok(names.length > 0, 'the page declares at least one full build');
  let bad = [];
  for (const nm of names) {
    const B = CAGE_PAGE.builds[nm];
    ok(!('cage' in B), nm + ': the build declares sections, never a cage');
    if (SHELF.stock().indexOf(nm) < 0) bad.push(nm + ': not listed');
  }
  ok(bad.length === 0, 'every declared build is a listed stock design' +
     (bad.length ? ' (' + bad.join(' | ') + ')' : ''));
  // and the sections actually reach the aeroplane
  for (const nm of names) {
    const B = CAGE_PAGE.builds[nm];
    const baked = Object.assign(
      { cage: CAGE2.cageToSpec(Object.assign(CAGE2.cageDefaults(),
        (CAGE_PAGE.presets[nm] || {})._base === 'template'
          ? {} : (CAGE_PAGE.defaults || {}),
        (() => { const p = clone(CAGE_PAGE.presets[nm] || {});
                 delete p._base; return p; })())) },
      clone(B));
    const R = resolveSpec(genNormaliseSpec(baked)).spec;
    ok(R.engines[0].type === B.engines[0].type,
       nm + ': its engine rides through (' + R.engines[0].type + ')');
    ok(R.wings[0].naca === B.wings[0].naca && R.wings[0].span === B.wings[0].span,
       nm + ': its wing rides through');
    ok(R.paint.base === B.paint.base && R.meta.reg === B.meta.reg,
       nm + ': its paint and registration ride through');
    ok(!!R.finish && !!R.finish.sections,
       nm + ': its finish rides through');
  }
}

// ---------------------------------------------------------------------------
// D. A PARTIAL FILE KEEPS ITS SECTIONS.
// genNormaliseSpec sniffed on `Array.isArray(r.wings)` alone, so a file
// carrying only a cage — which is precisely what the editor's own export used
// to write — took the pre-G3 FLAT branch, and that branch rebuilds the spec
// field by field from the flat names. `controls`, `prop`, `systems` and
// `bracing` were not among them.
// ---------------------------------------------------------------------------
{
  // A PARTIAL SECTIONED FILE — sections, but no `wings`, which is what a
  // hand-edited build or a future partial export looks like. The flat branch
  // ends in genDefaults, so the keys came BACK; what did not come back were
  // the file's own VALUES for them, quietly replaced by the generator's. Every
  // number below therefore differs from the default it would revert to.
  const part = { cage: { waistY: -0.05, halfW: 0.61 },
                 controls: { elevator: { chord: 0.42 } },
                 prop: { blades: 3 }, systems: { starter: false },
                 bracing: { type: 'cantilever' },
                 meta: { name: 'Partial', reg: 'F-PART' } };
  const n = genNormaliseSpec(part);
  ok(n.controls && n.controls.elevator && n.controls.elevator.chord === 0.42,
     'a partial sectioned file keeps the controls IT carried');
  ok(n.prop && n.prop.blades === 3, '...and its propeller');
  ok(n.systems && n.systems.starter === false, '...and its systems');
  ok(n.bracing && n.bracing.type === 'cantilever', '...and its bracing');
  ok(n.meta && n.meta.name === 'Partial' && n.meta.reg === 'F-PART',
     '...and its sectioned name and registration');
  ok(n.cage && n.cage.waistY === -0.05, '...and the cage it actually carried');
  // and a GENUINELY flat pre-G3 spec must still take the flat branch: it
  // carries `tail`, `gear`, `cowl` and `paint` under those very names, which
  // is why the sniff cannot look at them.
  const flat = genNormaliseSpec({ name: 'Old', wing: { span: 9.5, chord: 1.4 },
    cab: { halfW: 0.5 }, gear: { track: 1.5 }, tail: { hSpan: 2.2 },
    engine: 'a65_sensenich74', seating: 'tandem2' });
  ok(Array.isArray(flat.wings) && flat.wings[0].span === 9.5,
     'a pre-G3 flat spec still lifts into sections');
  ok(flat.meta && flat.meta.name === 'Old', '...carrying its name');
}

// ---------------------------------------------------------------------------
// D2. A PARTIAL FILE LOADS AS A WHOLE AEROPLANE.
// Found in the browser, not in this file (G63): a stock design's build file is
// a cage and nothing else, and the shelf held exactly that — so the aeroplane
// built fine (the generator fills the rest) while the SPEC carried no paint,
// no name and no propeller, and the next export through the join therefore had
// nothing to preserve. `update`'s whole point evaporated one load later.
// ---------------------------------------------------------------------------
{
  SHELF.set({ cage: { waistY: -0.05 } });        // the shape alone, as stock is
  const held = SHELF.get();
  ok(!!held.paint && !!held.meta && !!held.prop,
     'a cage-only file loads as a whole spec, not a fragment');
  ok(held.cage && held.cage.waistY === -0.05, '...still carrying its cage');
  ok(nullPaths(held).length > 20,
     '...with the derived fields still null, not frozen');
}

// ---------------------------------------------------------------------------
// E. THE JOIN UPDATES, IT DOES NOT REPLACE.
// This is the one the user could see: the colours came back yellow the moment
// you touched a slider, because `build & fly` handed the join's fresh object
// to `set`. Asserted on the RESOLVED spec — the export is not the aeroplane.
// ---------------------------------------------------------------------------
{
  const mine = clone(GEN_DEFAULT);
  mine.meta = { name: 'Mossy Stonebraker', reg: 'F-MOSS' };
  mine.paint = Object.assign({}, mine.paint,
    { base: 0x2f6f4e, trim: 0xd8c48a, sweep: 0.7 });
  mine.prop = Object.assign({}, mine.prop, { blades: 3 });
  mine.cowl = Object.assign({}, mine.cowl, { intake: 'twin' });
  mine.fuel = Object.assign({}, mine.fuel, { litres: 77 });
  mine.wings[0].place = { dx: 0.13, dy: 0 };
  SHELF.set(mine);

  const T = { TIP_KEYS: Object.keys(GEN_TIPS), FLAP_KEYS: Object.keys(GEN_FLAPS),
              PRESET_NAMES: ['continental A-65'] };
  const P = { wgSpan: 11.2, wgChord: 1.55, wgChordTip: 1.09, wgSweep: 3,
    wgDihedral: 2.5, wgIncidence: 1.6, wgWashout: 1.2, wgCamber: 4, wgThick: 12,
    wgTip: 0, wgPos: 0, wgCentre: 0, wgBrace: 0, wgCrankAt: 0, wgPanels: 3,
    wgFlapType: 0, wgFlapSpan: 0.45, wgFlapChord: 0.22,
    wgAilSpan: 0.36, wgAilChord: 0.22, engPreset: 0 };
  const M = { gearType: 'taildragger', track: 1.62, contactR: 0.21,
              halfW: 0.52, cabH: 1.21, tailArm: 5.1, cage: { waistY: -0.05 } };
  SHELF.update(cageJoinSpec(P, M, T));

  // resolveSpec returns { spec, auto } — the resolved spec is the half that
  // matters here, and reading it rather than the export is the G48 lesson.
  const R = resolveSpec(clone(SHELF.get())).spec;
  ok(R.meta.name === 'Mossy Stonebraker' && R.meta.reg === 'F-MOSS',
     'the name and registration survive a build');
  ok(R.paint.base === 0x2f6f4e && R.paint.trim === 0xd8c48a,
     '...and the paint you chose');
  ok(R.prop.blades === 3 && R.cowl.intake === 'twin' && R.fuel.litres === 77,
     '...and the prop, the cowl and the fuel');
  ok(R.wings[0].place && R.wings[0].place.dx === 0.13,
     '...and the wing placement, which merges INSIDE the wing the join rewrote');
  ok(Math.abs(R.wings[0].span - 11.2) < 1e-9,
     'while the joined rows land: span is the editor\'s');
  ok(R.gear.type === 'taildragger' && Math.abs(R.gear.track - 1.62) < 1e-9,
     '...and the measured gear');
  ok(R.cage && R.cage.waistY === -0.05, '...and the shape rides along');
}

// ---------------------------------------------------------------------------
// F. VIEW KNOBS ARE NOT DESIGN. `explodeD` is how you look at a build, and it
// used to be swept into the saved spec and frozen into the flying mesh.
// ---------------------------------------------------------------------------
{
  const P = Object.assign(CAGE2.cageDefaults(), { explodeD: 0.42, waistY: -0.11 });
  const frag = CAGE2.cageToSpec(P);
  ok(!('explodeD' in frag), 'explodeD never reaches the spec');
  ok(frag.waistY === -0.11, '...while a real deviation still does');
  ok(!('explodeD' in CAGE2.cageFromSpec({ cage: { explodeD: 0.42 } })) ||
     CAGE2.cageFromSpec({ cage: { explodeD: 0.42 } }).explodeD ===
     CAGE2.CAGE_PARAMS.explodeD,
     '...and an older file carrying one cannot set it either');
}

// ---------------------------------------------------------------------------
// G. THE WORKING BUILD IS UNNAMED UNTIL YOU NAME IT. The WIP used to be
// written with the literal name 'working', so a user who saved a build
// actually called `working` had every later unnamed session adopt it.
// ---------------------------------------------------------------------------
{
  SHELF.set(clone(GEN_DEFAULT));
  const wip = JSON.parse(store.getItem('flydiy.wip'));
  ok(wip && !wip.name, 'the unnamed working build saves with no slot name');
  SHELF.save('working');
  const wip2 = JSON.parse(store.getItem('flydiy.wip'));
  ok(wip2.name === 'working', '...and takes the name once you give it one');
  ok(store.getItem('flydiy.build.working') != null, 'the named slot is written');
  ok(SHELF.list().indexOf('working') >= 0, 'and the shelf lists it');
  ok(SHELF.log().built, 'saving stamps the logbook stub with a build date');
}

// ---------------------------------------------------------------------------
// H. THE FINISH BELONGS TO THE AEROPLANE (G105). Two properties, and each of
// them is a way a builder silently loses their paint.
//
// THE MIGRATION IS A NO-OP, BY CONSTRUCTION. `finish` is null by default, so
// every aeroplane saved before it existed normalises to "no overrides" — which
// is what it meant. That is why GEN_SPEC_V does not move for this field, and
// this block is the assertion standing behind that sentence. (The 5 -> 6 bump
// is the ENERGY MODULE's; see tools/_energy_base.js.)
// ---------------------------------------------------------------------------
{
  ok(GEN_DEFAULT.finish === null,
     'the factory finish is null — a spec that says nothing gets the ' +
     'aeroplane its construction implies');
  const old = clone(GEN_DEFAULT);
  delete old.finish;                       // a spec written before the field
  ok(genNormaliseSpec(old).finish === null,
     'a spec from before the field normalises to the factory finish');

  const FIN = { sections: { body: { fin: 'ply', tint: 0xC8B48A, tile: 1.4 },
                            waistband: { rough: 0.8 } },
                wear: 0.35, decals: { regH: 0.42, regTarget: 2 } };
  const kept = genNormaliseSpec(Object.assign(clone(GEN_DEFAULT),
                                              { finish: clone(FIN) })).finish;
  ok(eq(kept, FIN),
     'a finish rides through normalise verbatim — aeroskin.js owns which ' +
     'names and ranges are real, not this level');
  ok(C.clampSpec(Object.assign(clone(GEN_DEFAULT), { finish: 7 })).finish === null,
     'clampSpec nulls a truthy non-object finish, the way it does the cage');
  ok(eq(C.clampSpec(Object.assign(clone(GEN_DEFAULT),
                                  { finish: clone(FIN) })).finish, FIN),
     '...and leaves a real one alone');
}

// ---------------------------------------------------------------------------
// H2. THE JOIN CARRIES IT, and carries a NULL. The finish rides out of the
// editor beside the shape, through `cageJoinSpec`'s measurement bag — and the
// null has to travel, unlike the shape's. `if (M.cage)` is right for a shape
// because there is no such thing as an aeroplane with no shape; the finish's
// null MEANS something ("stripped back to the factory"), so skipping it makes
// that indistinguishable from "not measured" and a painted build could never
// go back to plain.
// ---------------------------------------------------------------------------
{
  const F = { sections: { body: { tint: 0x445566 } } };
  ok(eq(cageJoinSpec(CAGE_PAGE.defaults, { finish: clone(F) }, {}).finish, F),
     'the join writes the finish onto the build');
  ok(cageJoinSpec(CAGE_PAGE.defaults, { finish: null }, {}).finish === null,
     '...and writes the NULL, so paint can be stripped off again');
  ok(!('finish' in cageJoinSpec(CAGE_PAGE.defaults, {}, {})),
     '...and says nothing at all when nothing measured it');
}

// ---------------------------------------------------------------------------
// I. AN OVERRIDE CAN BE TAKEN OFF AGAIN — the bug with teeth.
//
// The finish is written as DEVIATIONS, so "this section has no tint any more"
// is said by the section's ABSENCE. `merge` deep-merges every other plain
// object in the spec, which for this one field would mean a tint could be put
// on and never removed: the build & fly after you cleared it would merge the
// cleared object over the old one and put the tint straight back. So `finish`
// replaces as a whole, and this is the check that says so.
// ---------------------------------------------------------------------------
{
  SHELF.set(Object.assign(clone(GEN_DEFAULT), {
    finish: { sections: { body: { tint: 0x112233 }, joint: { fin: 'ply' } },
              wear: 0.4 } }));
  SHELF.update({ finish: { sections: { body: { tint: 0x445566 } } } });
  const a = SHELF.get().finish;
  ok(a.sections.body.tint === 0x445566, 'a changed tint is the new one');
  ok(!a.sections.joint, '...and a section whose override was cleared is GONE');
  ok(a.wear === undefined, '...and so is a wear that went back to zero');
  SHELF.update({ finish: null });
  ok(SHELF.get().finish === null,
     'and stripping the aeroplane back to the factory finish sticks');
}

// ---------------------------------------------------------------------------
// J. THE LOAD PATH FORGETS FIRST. Read off the source, the way GATE SKINMAT
// reads aeroskin.js, because no node harness boots `_cage_ui.js` (it is the
// one file in that set that needs a document) and this is the single line that
// makes the whole feature true: `applySpec` must call `finishFromSpec`
// UNCONDITIONALLY. Guarded — `if (spec.finish)` — it reads like a safe tidy-up
// and quietly restores the bug, because the previous aeroplane's paint is then
// left sitting under the new one.
// ---------------------------------------------------------------------------
{
  const src = fs.readFileSync(path.join(__dirname, '_cage_ui.js'), 'utf8');
  const at = src.indexOf('function applySpec(');
  const body = at < 0 ? '' : src.slice(at, src.indexOf('\n}', at));
  ok(/finishFromSpec\(spec && spec\.finish\)/.test(body),
     'applySpec applies the finish on every load, guarded only against a ' +
     'null spec');
  ok(!/if\s*\([^)]*spec\.finish[^)]*\)\s*finishFromSpec/.test(body),
     '...and NOT only when the file happens to carry one');
  ok(/finishToSpec,\s*finishFromSpec/.test(src),
     'both halves are published on window.CAGE_UI');
}

// ---------------------------------------------------------------------------
// K. THE VINTAGE SHELF (G106). Ruling 4's second half, finally: "the battery
// keeps one old build of each vintage as a loading gate." tools/fixtures/
// holds one FROZEN save per vintage — real files, not synthesised shapes, so
// a change that breaks an old save breaks here first. The v5 fixture was
// deliberately frozen BEFORE the boundary fix, so it carries the fat
// 518-key `spec.cage` that vintage really wrote: the fat save must load
// forever, and re-save SLIM without the aeroplane changing under it.
// ---------------------------------------------------------------------------
{
  const dir = path.join(__dirname, 'fixtures');
  // build_ prefix only: the shelf now shares the directory with other
  // documents' vintages (player_*.json is the PLAYER container's, gated by
  // GATE PLAYER) — feeding one of those to genNormaliseSpec would "load" it
  // as a default aeroplane and prove nothing.
  const files = fs.readdirSync(dir)
    .filter(f => /^build_.*\.json$/.test(f)).sort();
  ok(files.length >= 2, 'there are vintage fixtures to load (' +
     files.length + ')');
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const bare = raw && raw.what === 'flydiy-build' ? raw.spec : raw;
    let spec = null, threw = null;
    try { spec = genNormaliseSpec(bare); C.resolveSpec(spec); }
    catch (e) { threw = e; }
    ok(!threw && spec && spec.v === GEN_SPEC_V,
       'vintage ' + f + ' loads and lands on v' + GEN_SPEC_V +
       (threw ? ' (' + threw.message + ')' : ''));
    // G140: a fixture may FREEZE its resolved numbers at capture time — the
    // migrated aeroplane must still BE that aeroplane. Area and MAC exact
    // (the station lift preserves the planform); mass within 1.5% (the tail
    // re-derives off xAC); xAC inside the DOCUMENTED honesty window — the
    // legacy formula walked the MAC offset from the centreline while the
    // stations walk from the root, so a migrated swept wing sits up to
    // tan(sweep)*zRoot forward of its frozen number, never aft of it.
    if (!threw && spec && raw && raw.frozen) {
      try {
        const RS2 = C.resolveSpec(JSON.parse(JSON.stringify(spec)));
        const R2 = RS2.spec, fr2 = C.genFrame(R2), Z = raw.frozen;
        const rel = (a, b) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));
        ok(rel(R2.geom.Sw, Z.Sw) < 1e-6 && rel(R2.geom.cBar, Z.cBar) < 1e-6,
           'vintage ' + f + ': area + MAC survive the migration exactly');
        ok(rel(fr2.cg0[3], Z.cg0[3]) < 0.015,
           'vintage ' + f + ': mass within 1.5% (' + fr2.cg0[3].toFixed(1) +
           ' vs frozen ' + Z.cg0[3].toFixed(1) + ')');
        ok(R2.geom.xAC <= Z.xAC + 1e-6 && R2.geom.xAC > Z.xAC - 0.20,
           'vintage ' + f + ': xAC inside the honesty window (' +
           R2.geom.xAC.toFixed(4) + ' vs frozen ' + Z.xAC.toFixed(4) + ')');
        // TAIL CHANTIER 2 P5: a vintage that carries the JOIN's tail rows (a
        // drawn tail — Sh, Sv, the mean chords, the control chords) keeps
        // them through the load: the volume rule stands down (not auto),
        // and the tail that flies is the one that was drawn, to the digit
        if (bare && bare.tail && bare.tail.Sh > 0) {
          ok(Math.abs(R2.tail.Sh - bare.tail.Sh) < 1e-9 && !RS2.auto['tail.Sh'] &&
             Math.abs(R2.tail.Sv - bare.tail.Sv) < 1e-9 && !RS2.auto['tail.Sv'] &&
             Math.abs(R2.tail.hChord - bare.tail.hChord) < 1e-9 &&
             (!bare.controls || !bare.controls.rudder ||
              Math.abs(R2.controls.rudder.chord - bare.controls.rudder.chord) < 1e-9),
             'vintage ' + f + ': the drawn tail it carries flies as drawn (Sh ' +
             R2.tail.Sh.toFixed(3) + ', Sv ' + R2.tail.Sv.toFixed(3) + ', not auto)');
        }
      } catch (e) {
        ok(false, 'vintage ' + f + ': frozen-number comparison threw (' +
           e.message + ')');
      }
    }
    if (!spec || !spec.cage) continue;
    // the fat-vintage theorem: load, re-bake, re-load — same aeroplane,
    // smaller file. Negative half: the shrink must be REAL, or the boundary
    // fix has quietly stopped comparing.
    const P1 = CAGE2.cageFromSpec(spec);
    const slim = CAGE2.cageToSpec(P1) || {};
    const P2 = CAGE2.cageFromSpec({ cage: slim });
    const drift = Object.keys(P1).filter(k =>
      !(k in CAGE2.CAGE_VIEW_KEYS) && !eq(P1[k], P2[k]));
    ok(drift.length === 0, 'the fat ' + f + ' re-saves without the ' +
       'aeroplane changing' + (drift.length ? ' (drifted: ' +
       drift.slice(0, 5).join(', ') + ')' : ''));
    const fat = Object.keys(spec.cage).length,
          thin = Object.keys(slim).length;
    // G140: the shrink theorem is about FAT vintages (the 518-key snapshot
    // era). A fixture frozen slim — the swept v5, saved after the boundary
    // fix — has nothing to shrink; it must simply not grow.
    // G189: "fat" is a VINTAGE, not a key count. The user's ultralight is a
    // v7 file with 121 honest deviations (every one of them off the
    // template), and it re-saves to exactly 121 — so a post-boundary file
    // takes the lean test whatever its size; only the snapshot era shrinks.
    if (fat > 120 && !(spec.v >= 6))
      ok(thin < fat / 3, 'and the re-save is deviations, not a snapshot (' +
         fat + ' keys -> ' + thin + ')');
    else
      ok(thin <= fat + 1, 'and the slim ' + f + ' re-saves lean (' +
         fat + ' keys -> ' + thin + ')');
  }
}

// ---------------------------------------------------------------------------
// L. A BUILD CARRIES ITS DEVIATIONS — NOW TRUE FOR THE LAYERS TOO (G106).
// The boundary's own invariant, measured: baking the default aeroplane writes
// (nearly) nothing, deviating one layer key writes exactly that key, and with
// the page's declaration REMOVED the same bake goes fat again — which is the
// negative proof that the comparison runs against the declaration and not
// against luck.
// ---------------------------------------------------------------------------
{
  const full = () => Object.assign(CAGE2.cageDefaults(), clone(CAGE_PAGE.defaults));
  const baked = CAGE2.cageToSpec(full()) || {};
  const nBase = Object.keys(baked).length;
  ok(nBase < 60, 'the default aeroplane bakes to its cage deviations alone (' +
     nBase + ' keys, all vs CAGE_PARAMS)');
  ok(Object.keys(baked).every(k => k in CAGE2.CAGE_PARAMS),
     '...and every one of them is a declared cage key, no layer snapshot');
  const dev = full(); dev.finThick = 0.123;         // a layer (fin) key
  const baked2 = CAGE2.cageToSpec(dev) || {};
  ok(baked2.finThick === 0.123 &&
     Object.keys(baked2).length === nBase + 1,
     'deviating one layer key writes that key and nothing else');
  const held = global.window; global.window = undefined;   // negative half
  const fat = CAGE2.cageToSpec(full()) || {};
  global.window = held;
  ok(Object.keys(fat).length > 300,
     'negative: with no page declaration in scope the same bake is fat again (' +
     Object.keys(fat).length + ' keys)');
}

// ---------------------------------------------------------------------------
// M. THE MIGRATOR WALK EXISTS BEFORE ITS FIRST ENTRY (G106). GEN_MIGRATORS is
// empty on purpose — the version note forbids a migration that re-does what
// normalisation does — so the WALK is exercised with throwaway entries
// injected here and removed after: the v6 bump (the energy arc's) must land
// in a machine that is already proven to run its steps in order, stamp the
// version, and leave current and future saves alone.
// ---------------------------------------------------------------------------
{
  const MIG = C.GEN_MIGRATORS;
  // G140: the table's first REAL entry — v5->v6, the wing-station lift.
  // The assertion names the exact expected set so a stray entry (or a lost
  // one) is loud, which is what "exists and is empty" used to guarantee.
  // ...and G99's, keyed 6, which lifts {litres, tank} into a vessel in a bay.
  // KEYED BY THE SOURCE VERSION: the walk runs MIGRATORS[i] for i from the
  // spec's v upward, so the lift OUT OF 6 lives under 6. Filed under 7 it ran
  // on nothing at all, which is precisely the stray-or-lost entry this
  // assertion names the exact set to catch.
  // ...and G189's, keyed 7: a rod boom's taper carved out of boomLen, so a
  // v7 rod save keeps its tube (boomLen += taperLen).
  // ...and G267's, keyed 8: the twin boom's diameter and taper lifted into
  // the loft's four sizes.
  ok(MIG && typeof MIG === 'object' && Object.keys(MIG).join(',') === '5,6,7,8' &&
     typeof MIG[5] === 'function' && typeof MIG[6] === 'function' &&
     typeof MIG[7] === 'function' && typeof MIG[8] === 'function',
     'the migrator table carries exactly v5->v6 (the wing stations), ' +
     'v6->v7 (the energy vessels), v7->v8 (the rod taper) and v8->v9 (the boom loft)');
  // the v7->v8 lift itself, on the shape the user's file has: a rod with a
  // 1.46 m taper and a 2.99 m boom keeps its 4.45 m tube; a lofted boom and
  // a twin boom are left alone; absent keys read as the cage defaults
  {
    const up = c => C.genMigrateSpec({ v: 7, cage: c }).cage;
    const r1 = up({ boomStyle: 1, taperOn: 1, taperLen: 1.46, boomLen: 2.99 });
    ok(Math.abs(r1.boomLen - 4.45) < 1e-9, 'v7->v8: a rod save carries its taper into boomLen (2.99 -> ' + r1.boomLen + ')');
    const r2 = up({ boomStyle: 0, taperOn: 1, taperLen: 1.0, boomLen: 3.0 });
    ok(r2.boomLen === 3.0, 'v7->v8: a lofted taper is left alone');
    const r3 = up({ boomStyle: 1, boomTwin: 1, taperOn: 1, taperLen: 1.0, boomLen: 3.0 });
    ok(r3.boomLen === 3.0, 'v7->v8: twin booms are left alone');
    const D = C.GEN_MIGRATE_CAGE_DEFAULTS, r4 = up({ boomStyle: 1, taperOn: 1 });
    ok(Math.abs(r4.boomLen - (D.boomLen + D.taperLen)) < 1e-3,   // the lift rounds to 4 places
       'v7->v8: absent keys read as the cage defaults (' + r4.boomLen + ')');
  }
  // the v8->v9 lift (G267): a twin boom's diameter and taper become the
  // loft's four sizes — the lofted tube was 1.5 x taller than wide, a rod
  // round — and the pair is gone; a save that never set them is untouched
  {
    const up = c => C.genMigrateSpec({ v: 8, cage: c }).cage;
    const r1 = up({ boomTwin: 1, boomD: 0.2, boomTaper: 0.5 });
    ok(Math.abs(r1.boomWf - 0.2) < 1e-9 && Math.abs(r1.boomHf - 0.3) < 1e-9 &&
       Math.abs(r1.boomWa - 0.1) < 1e-9 && Math.abs(r1.boomHa - 0.15) < 1e-9 &&
       !('boomD' in r1) && !('boomTaper' in r1),
       'v8->v9: a lofted twin boom\'s diameter and taper become its four sizes (0.2/0.3 -> 0.1/0.15)');
    const r2 = up({ boomStyle: 1, boomTwin: 1, boomD: 0.2, boomTaper: 1 });
    ok(Math.abs(r2.boomHf - 0.2) < 1e-9 && Math.abs(r2.boomHa - 0.2) < 1e-9,
       'v8->v9: a rod twin boom stays round');
    const r3 = up({ boomTwin: 1, boomLen: 3 });
    ok(!('boomWf' in r3) && r3.boomLen === 3, 'v8->v9: a save without the pair is left alone');
  }
  // G194: the propeller's hand survives the resolve, and absent means +1
  {
    const sp = JSON.parse(JSON.stringify(C.GEN_DEFAULT));
    sp.engines = [{ type: 'rotax582_ivo', mount: 'wing', place: { dx: 0, dy: 0 }, sense: 1 },
                  { type: 'rotax582_ivo', mount: 'wing', place: { dx: 0, dy: 0 }, sense: -1 }];
    const R = C.resolveSpec(sp).spec;
    ok(R.engines.length === 2 && R.engines[0].sense === 1 && R.engines[1].sense === -1,
       'sense: a counter-rotating pair keeps both hands through resolveSpec');
    const sp2 = JSON.parse(JSON.stringify(C.GEN_DEFAULT)); delete sp2.engines[0].sense;
    ok(C.resolveSpec(sp2).spec.engines[0].sense === 1, 'sense: absent reads as +1');
    const sp3 = JSON.parse(JSON.stringify(C.GEN_DEFAULT)); sp3.engines[0].sense = 7;
    ok(C.resolveSpec(sp3).spec.engines[0].sense === 1, 'sense: anything but -1 is +1');
  }
  const ran = [];
  MIG[3] = s => { ran.push(3); if (s.oldName) s.newName = s.oldName; return s; };
  MIG[4] = s => { ran.push(4); return s; };
  const out = genNormaliseSpec({ v: 3, cabin: {}, oldName: 'carried' });
  ok(ran.join(',') === '3,4', 'a v3 spec walks 3 then 4, in order');
  ok(out.v === GEN_SPEC_V, '...and lands stamped v' + GEN_SPEC_V);
  ok(out.newName === 'carried',
     '...and a migrator saw the RAW old shape (its rename took)');
  ran.length = 0;
  genNormaliseSpec({ v: GEN_SPEC_V, cabin: {} });
  ok(ran.length === 0, 'a current spec walks nothing');
  delete MIG[3]; delete MIG[4];
  const v4 = genNormaliseSpec({ v: 4, cabin: {} });
  ok(v4.v === GEN_SPEC_V,
     'an old vintage is stamped current even with an empty table');
  const fut = genNormaliseSpec({ v: 99, cabin: {} });
  ok(fut.v === 99,
     'a FUTURE spec keeps its claim — this build does not lie about ' +
     'understanding it');
}

// ---------------------------------------------------------------------------
// N. THE CERTIFICATE PERSISTS (G107.3). The garage half of plaque
// persistence, through the REAL shelf: the bench's snapshot goes in through
// the `plaque` setter, rides the envelope beside the spec, and comes back
// through `BENCH_RESTORE` — called ONCE per load, LAST, after the loaded
// spec has been applied (the ordering is the whole fix: the load path's own
// dirty storm must be over before the certificate is re-seated).
// ---------------------------------------------------------------------------
{
  const restored = [];
  gbox.window.BENCH_RESTORE = pq => restored.push({
    pq: pq ? clone(pq) : null,
    appliedName: applied && applied.meta && applied.meta.name,
  });
  const G2 = gbox.window.GARAGE_SPEC;
  const cert = { when: '2026-08-31',
    results: { shake: { verdict: 'FLIES A CIRCUIT', ok: true,
                        fills: 'plaque' } },
    sheets: { densAlt: null, flight: { report: { outcome: 'completed' } } } };
  G2.plaque(cert);
  ok(!!G2.plaque() && G2.plaque().results.shake.ok,
     'the plaque setter stores the certificate');
  const env = JSON.parse(G2.json());
  ok(env.plaque && env.plaque.results.shake.verdict === 'FLIES A CIRCUIT'
     && env.plaque.sheets.flight.report.outcome === 'completed',
     'the certificate rides in the envelope, beside the spec, sheets and all');
  G2.save('certified build');
  restored.length = 0;
  G2.load('certified build');
  ok(restored.length === 1 && restored[0].pq
     && restored[0].pq.results.shake.ok === true,
     'loading hands the certificate to the bench, exactly once');
  ok(restored[0].appliedName === 'certified build',
     '...and only AFTER the loaded spec was applied — the storm is over');
  G2.plaque(null);
  G2.save('bare build');
  restored.length = 0;
  G2.load('bare build');
  ok(restored.length === 1 && restored[0].pq === null,
     'a build saved without a certificate loads with none');
}

// ---------------------------------------------------------------------------
// G116 — THE CONSTRUCTION COSTS (the user: "carbon should cost"). The three
// additive fields (`wings[0].material`, `tail.finMaterial`,
// `tail.stabMaterial`) move MASS AND PRICE in the lattice's ledger and
// nothing else — stiffness stays the aeroplane's calibration, and a spec
// that says nothing is byte-identical to one that says the global out loud.
// ---------------------------------------------------------------------------
{
  const led = s => C.genFrame(C.resolveSpec(clone(s)).spec).parts.ledger;
  const base = clone(C.GEN_DEFAULT);
  const L0 = led(base);
  const glob = C.resolveSpec(clone(base)).spec.material;
  // absent == the surface default said out loud (G213: a wing on a tube or
  // wood aeroplane is fabric over wood, never the fuselage's own row)
  const sdef = C.GEN_SURF_DEFAULT[glob];
  const expl = clone(base);
  expl.wings[0].material = sdef;
  ok(eq(led(expl), L0),
     'G116/G213: naming the surface default out loud changes nothing');
  // ...and a LEGACY token is read as what it meant on a wing: 'wood' is
  // fabric over wood, i.e. the default on this aeroplane
  const leg = clone(base);
  leg.wings[0].material = 'wood';
  ok(eq(led(leg), L0),
     'G213: a saved "wood" wing reads as fabric over wood');
  // a carbon wing moves the wing's own mass and cost...
  const cw = clone(base);
  cw.wings[0].material = 'carbon';
  const LC = led(cw);
  ok(LC.wings.mass !== L0.wings.mass && LC.wings.cost !== L0.wings.cost,
     'G116: a carbon wing moves the wing ledger');
  // ...and of the FIXED-GEOMETRY sections, only the wing's: fuselage, tail,
  // bracing and engines are untouched. The GEAR is allowed a small move and
  // that is the system working, not leaking — genFrame's second pass places
  // the mains against the CG the first pass produced, and an 8 kg lighter
  // wing shifts it (measured: 26.28 -> 26.23 kg on the default aeroplane).
  ok(['fuselage', 'tail', 'bracing', 'engines'].every(s2 =>
       !L0[s2] === !LC[s2] && (!L0[s2] ||
         (L0[s2].mass === LC[s2].mass && L0[s2].cost === LC[s2].cost))),
     'G116: the fixed-geometry sections did not move');
  ok(Math.abs(LC.gear.mass - L0.gear.mass) <
       0.1 * Math.abs(LC.wings.mass - L0.wings.mass),
     'G116: the gear re-rig is an order smaller than the wing change');
  // the fin's own material moves the tail section and nothing else
  const cf = clone(base);
  cf.tail = Object.assign({}, cf.tail, { finMaterial: 'carbon' });
  const LF = led(cf);
  ok(LF.tail.mass !== L0.tail.mass && LF.tail.cost !== L0.tail.cost,
     'G116: a carbon fin moves the tail ledger');
  ok(LF.wings.mass === L0.wings.mass && LF.fuselage.mass === L0.fuselage.mass,
     "G116: ...and neither the wing's nor the fuselage's");
  // an unknown material is CLAMPED back to absent, never obeyed
  const bad = clone(base);
  bad.wings[0].material = 'unobtainium';
  ok(eq(led(bad), L0),
     'G116: an unknown material falls back to the aeroplane\'s own');
  // and the DIRECTION is the material table's, not an accident of this
  // aeroplane: the wing's cost moves the way carbon's price sits against
  // the global material's
  ok((LC.wings.cost > L0.wings.cost) ===
     (C.GEN_SURF_MATERIALS.carbon.price > C.GEN_SURF_MATERIALS[sdef].price),
     'G116: the price moves the way the material table says');

  // -------------------------------------------------------------------------
  // G117 — WYSIWYG (the user's rule): the carbon wing FLEXES as carbon. The
  // members' k and c follow the section's material exactly as lin and price
  // do, the fuselage moves only by the aeroplane-level rescale (kScale reads
  // the new total mass), and a spec that says nothing still builds the same
  // aeroplane member for member.
  // -------------------------------------------------------------------------
  const frame = s => C.genFrame(C.resolveSpec(clone(s)).spec);
  const F0 = frame(base), FC = frame(cw);
  // `ext` members are the BRACING (struts and ties, built under their own
  // section): a lift strut is a steel tube whatever the wing it braces, so
  // it keeps the aeroplane's material and is excluded here on purpose
  const kOf = (fr, cls) =>
    fr.beams.filter(b2 => b2.cls === cls && !b2.gear && !b2.ext)
      .map(b2 => b2.k);
  const kw0 = kOf(F0, 'wing'), kwC = kOf(FC, 'wing');
  const kf0 = kOf(F0, 'fus'), kfC = kOf(FC, 'fus');
  ok(kw0.length > 4 && kw0.length === kwC.length && kf0.length === kfC.length,
     'G117: the same members exist either way');
  const rw = kwC[0] / kw0[0], rf = kfC[0] / kf0[0];
  ok(kfC.every((k2, i) => Math.abs(k2 / kf0[i] - rf) < 1e-9),
     'G117: fuselage members move only by the aeroplane-level rescale');
  // ...in exactly TWO groups: the wing's own structure at the material's
  // ratio, and the BRACING FAN (sec('bracing')'s solver truss, wing-class
  // by stiffness family but the aeroplane's material by section — a brace
  // is a steel tube whatever the wing it holds) at the plain rescale. The
  // structure must be the majority, or the wing is mostly not a wing.
  let nMat = 0, nBrace = 0, nOdd = 0;
  kwC.forEach((k2, i) => {
    const r2 = k2 / kw0[i];
    if (Math.abs(r2 - rw) < 1e-9) nMat++;
    else if (Math.abs(r2 - rf) < 1e-9) nBrace++;
    else nOdd++;
  });
  ok(nOdd === 0 && nMat > nBrace,
     'G117: the wing members split into structure (material) and bracing ' +
     '(aeroplane) and nothing else — ' + nMat + '/' + nBrace + '/' + nOdd);
  // G213: the base wing is the SURFACE default's row, not the fuselage's
  const kTab = C.GEN_SURF_MATERIALS.carbon.k.wing / C.GEN_SURF_MATERIALS[sdef].k.wing;
  ok(Math.abs(rw / rf / kTab - 1) < 1e-9,
     "G117: the wing k moves by exactly the material table's own ratio");
  const cRw = FC.beams.find(b2 => b2.cls === 'wing' && !b2.gear).c /
              F0.beams.find(b2 => b2.cls === 'wing' && !b2.gear).c;
  const cTab = C.GEN_SURF_MATERIALS.carbon.c.wing / C.GEN_SURF_MATERIALS[sdef].c.wing;
  ok(Math.abs(cRw / rf / cTab - 1) < 1e-9,
     'G117: the damping follows the same material');
  // absent still equals the global said out loud — MEMBER BY MEMBER, k and
  // c included, which is the whole-fleet byte-identity in one line
  ok(eq(frame(expl).beams, F0.beams),
     'G117: naming the global changes no member at all');
}

// ===========================================================================
// PASSENGERS (2026-08-31, the user: "we need passenger seats and passengers,
// impacting the mass and CG"). Four seats is a new VALUE in an existing table
// and a new loading field beside an existing one, so the whole risk is that
// something moves for an aeroplane nobody asked to change — which is what the
// first two checks are.
// ===========================================================================
{
  const cg = spec => {
    const d = C.buildGen(spec);
    let mx = 0, m = 0;
    for (const n of d.nodes) { mx += n.p[0] * n.m; m += n.m; }
    return { cg: mx / m, mass: m, seating: d.params.gen ? null : null };
  };
  const base = () => clone(GEN_DEFAULT);

  // 1. THE DEFAULT AEROPLANE DOES NOT MOVE. GATE ENERGYBASE freezes fourteen
  //    of them; this is the same claim stated where it can be read.
  const a0 = cg(base());
  const a1 = (() => { const s = base(); s.cabin.pax = 0; return cg(s); })();
  ok(Math.abs(a0.mass - a1.mass) < 1e-9 && Math.abs(a0.cg - a1.cg) < 1e-12,
     'writing pax:0 explicitly is the same aeroplane as not writing it');

  // 2. A SEAT THAT DOES NOT EXIST CANNOT BE FILLED. `pax` is clamped to what
  //    the layout has left after the flight crew, so a spec cannot load five
  //    people into a two-seater and quietly fly a heavier aeroplane.
  const over = base(); over.cabin.seating = 'tandem2'; over.cabin.pilots = 1;
  over.cabin.pax = 9;
  const o = cg(over);
  // NOT EXACT, AND THE REASON IS REAL: genFrame runs twice, and the second
  // pass sizes the structure for the mass the first one found. So 80 kg of
  // passenger arrives as 79.9 kg of aeroplane — the airframe under a heavier
  // load is not the same airframe. The tolerance is that effect, not slop.
  ok(Math.abs(o.mass - a0.mass - 80) < 2,
     'pax 9 in a two-seater loads exactly one passenger, not nine' +
     ' (' + (o.mass - a0.mass).toFixed(1) + ' kg)');

  // 3. AND ONE THAT DOES EXIST MOVES BOTH NUMBERS. 80 kg is the occupant
  //    mass this file has always billed; the CG must move with it or the
  //    whole item is decoration.
  const one = base(); one.cabin.pax = 1;
  const p1 = cg(one);
  ok(Math.abs(p1.mass - a0.mass - 80) < 2,
     'a passenger weighs 80 kg (' + (p1.mass - a0.mass).toFixed(1) + ')');
  ok(Math.abs(p1.cg - a0.cg) > 0.02,
     'a passenger does not move the CG — the seat rows are collapsing onto ' +
     'one frame again, which is what made a full cabin load like a solo one' +
     ' (moved ' + ((p1.cg - a0.cg) * 1000).toFixed(0) + ' mm)');

  // 4. FOUR SEATS EXIST, CARRY FOUR, AND THE SECOND ROW IS BEHIND THE FIRST.
  for (const lay of ['side4', 'tandem4']) {
    const e = base(); e.cabin.seating = lay; e.cabin.pilots = 1; e.cabin.pax = 0;
    const f = base(); f.cabin.seating = lay; f.cabin.pilots = 1; f.cabin.pax = 3;
    const E = cg(e), F2 = cg(f);
    ok(Math.abs(F2.mass - E.mass - 240) < 5,
       lay + ': three passengers weigh 240 kg (' +
       (F2.mass - E.mass).toFixed(1) + ')');
    ok(F2.cg > E.cg + 0.05,
       lay + ': filling the cabin does not move the CG AFT — the back row is ' +
       'being billed onto the front frame');
  }

  // 4b. THE OCCUPANTS SIT WHERE THE SEATS ARE (2026-09-03). With the join's
  //     measured stations on the spec, the CG moves by exactly the lever an
  //     80 kg person carries — and without them nothing moves at all, which
  //     is what keeps every fiche and every older save on its old balance.
  {
    const s0 = base(); s0.cabin.seating = 'tandem2'; s0.cabin.pilots = 2;
    const S0 = cg(s0);
    const s1 = clone(s0);
    // STATED OFF THE BASE'S OWN PILLARS, not off the Cub's: the default cabin
    // is short, so a station copied from the Cub barely differs from the
    // pillar it replaces here and the first cut of this check read 36 mm and
    // called the fix broken. Put each person 0.25 m ahead of the ring the
    // pillar rule would have billed them on (row one on the front pillar, row
    // two on the aft) and the CG must come forward by exactly that lever.
    const cab0 = C.buildGen(clone(s0)).spec.cabin;
    const AHEAD = 0.25;
    s1.cabin.seatsX = [cab0.noseGap - AHEAD, cab0.noseGap + cab0.len - AHEAD];
    const S1 = cg(s1);
    ok(Math.abs(S1.mass - S0.mass) < 2,
       'measured seat stations change where people sit, not how much they weigh' +
       ' (' + (S1.mass - S0.mass).toFixed(1) + ' kg)');
    const fwd = 160 * AHEAD / S1.mass;
    ok(Math.abs((S0.cg - S1.cg) - fwd) < 0.015,
       'billing the people at their seats instead of the cabin pillars moves ' +
       'the CG FORWARD by their lever: expected ' + (fwd * 1000).toFixed(0) +
       ' mm, got ' + ((S0.cg - S1.cg) * 1000).toFixed(0) + ' mm — a pillar is not a chair');
    // the lever, checked as arithmetic: move both seats 0.30 m aft and the
    // CG must follow by 160 kg × 0.30 m over the all-up mass
    // THE CHAIRS GO WITH THE PEOPLE: the frame bills each seat at its own
    // station too, so the lever is 160 kg of occupants plus two seats of the
    // kind the outfit names (3 kg each in a sling). Written out so a reader
    // can check the number on the plaque against this line.
    const s2 = clone(s1); s2.cabin.seatsX = [s1.cabin.seatsX[0] + 0.30,
                                             s1.cabin.seatsX[1] + 0.30];
    const S2 = cg(s2);
    const seatKg = (C.GEN_SEATS[(s2.outfit && s2.outfit.seats) || 'sling'] || {}).kg || 0;
    const want = (160 + 2 * seatKg) * 0.30 / S2.mass;
    ok(Math.abs((S2.cg - S1.cg) - want) < 0.015,
       'the seat lever is arithmetic the builder can check: expected +' +
       (want * 1000).toFixed(0) + ' mm, got +' + ((S2.cg - S1.cg) * 1000).toFixed(0) + ' mm');
    // a malformed station list reads as "derived", never as a crash or a jump
    const s3 = clone(s0); s3.cabin.seatsX = ['x', null];
    const S3 = cg(s3);
    ok(Math.abs(S3.cg - S0.cg) < 1e-6,
       'a malformed seatsX is ignored — the pillar rule stands');
  }

  // 5. THE OLD LAYOUTS RESOLVE EXACTLY AS THEY DID. `seatRows` replaced a
  //    two-element literal, and every existing seating must land on the same
  //    frames it landed on before or every saved aeroplane re-balances.
  for (const [lay, pil] of [['single', 1], ['tandem2', 2], ['side2', 2]]) {
    const s2 = base(); s2.cabin.seating = lay; s2.cabin.pilots = pil;
    const r = cg(s2);
    ok(isFinite(r.cg) && r.mass > 0, lay + ' still builds with ' + pil +
       ' aboard (' + r.mass.toFixed(1) + ' kg, cg ' + r.cg.toFixed(4) + ')');
  }

  // 6. WHO SITS WHERE (G180). The cage draws a row as wide as the cockpit's in
  //    every bay, so the CAPACITY can exceed the seating table (`cabin.seats`)
  //    and the OCCUPANCY names the filled chairs one by one (`cabin.occupied`).
  //    The claims: the capacity is priced and resolved; the same NUMBER of
  //    people in DIFFERENT seats is a different balance (a full back bench
  //    behind an empty co-pilot seat must not read as two people up front);
  //    the loading numbers are read off the list; and null keeps the old rule.
  {
    const six = () => {
      const s = base(); s.cabin.seating = 'side2'; s.cabin.seats = 6;
      // one station per seat, three rows 0.8 m apart, the pilot's row first
      const x0 = C.buildGen(clone(s)).spec.cabin.noseGap;
      s.cabin.seatsX = [x0, x0, x0 + 0.8, x0 + 0.8, x0 + 1.6, x0 + 1.6];
      return s;
    };
    const R6 = C.resolveSpec(six()).spec;
    ok(R6.seats === 6, 'cabin.seats 6 on a side2 resolves to six seats (' + R6.seats + ')');
    const s0 = six(); s0.cabin.pilots = 1; s0.cabin.pax = 0; s0.cabin.occupied = null;
    const S0 = cg(s0);
    const front = six(); front.cabin.occupied = [1, 1, 1, 0, 0, 0];   // pilot + co-pilot + one behind
    const back  = six(); back.cabin.occupied  = [1, 0, 1, 1, 0, 0];   // pilot + the row behind, full
    const SF = cg(front), SB = cg(back);
    ok(Math.abs(SF.mass - S0.mass - 160) < 3 && Math.abs(SB.mass - S0.mass - 160) < 3,
       'two filled seats weigh 160 kg wherever they are (' +
       (SF.mass - S0.mass).toFixed(1) + ' / ' + (SB.mass - S0.mass).toFixed(1) + ')');
    // one 80 kg body moved one row (0.8 m) aft over the all-up mass
    const lever = 80 * 0.8 / SB.mass;
    ok(Math.abs((SB.cg - SF.cg) - lever) < 0.015,
       'the same two passengers in different seats are a different balance: ' +
       'expected +' + (lever * 1000).toFixed(0) + ' mm, got +' +
       ((SB.cg - SF.cg) * 1000).toFixed(0) + ' mm');
    const RB = C.resolveSpec(backSpec()).spec;
    ok(RB.occupants === 3 && RB.crew === 1 && RB.pax === 2,
       'the loading numbers are read off the occupancy list (occupants ' +
       RB.occupants + ', crew ' + RB.crew + ', pax ' + RB.pax + ')');
    const nobody = six(); nobody.cabin.occupied = [0, 0, 0, 0, 0, 0];
    ok(C.resolveSpec(nobody).spec.occupants === 1,
       'the pilot is aboard whatever the list says — a seat 0 in the first place is ignored');
    const over = six(); over.cabin.occupied = [1, 1, 1, 1, 1, 1, 1, 1, 1];
    ok(C.resolveSpec(over).spec.occupants === 6,
       'a list longer than the seats is cut to the seats (' + C.resolveSpec(over).spec.occupants + ')');
    const bad = six(); bad.cabin.pilots = 1; bad.cabin.pax = 0; bad.cabin.occupied = [1, 'yes', 2];
    ok(Math.abs(cg(bad).cg - S0.cg) < 1e-6,
       'a malformed occupancy list reads as "the first N seats", never as a jump');
    // and the old rule is untouched: pilots 1 + pax 2 with NO list fills the
    // first three seats = exactly the `front` loading above
    const old3 = six(); old3.cabin.pilots = 1; old3.cabin.pax = 2; old3.cabin.occupied = null;
    const O3 = cg(old3);
    ok(Math.abs(O3.cg - SF.cg) < 1e-6 && Math.abs(O3.mass - SF.mass) < 1e-6,
       'pilots + pax without a list is the first N seats, exactly as before');
    function backSpec() { const s = six(); s.cabin.occupied = [1, 0, 1, 1, 0, 0]; return s; }
  }
}

// ---------------------------------------------------------------------------
// THE LOGBOOK ACCRUES (G152). G130 gave the log a READER; the rows it read had
// no time in them, so the panel could count flights and could never total
// anything. Hours are what an aeroplane earns, and the one number that makes a
// fleet read as a fleet rather than as a list of files.
//
// The property that needs a gate is what happens to a row saved BEFORE the
// clock existed — and every logbook in existence today is made of those rows.
// BEING PRECISE ABOUT WHAT THIS CAN AND CANNOT PROVE: for a SUM, "not counted"
// and "counted as zero" are the same arithmetic, so no assertion here can tell
// them apart. What it really guards is that a missing clock does not POISON the
// total — `s + undefined` is NaN, and a logbook reading "NaN h" is the
// realistic bug. The distinction would start to matter the day something takes
// a MEAN flight time; the guard in `hoursOf` is written for that day too.
// ---------------------------------------------------------------------------
{
  const L = SHELF.log();
  L.flights.length = 0;
  L.flights.push({ from: 'HOME', to: 'CIRCUIT', sink: 0.82, V: 77, off: 0.1,
                   t: 294, on: '2026-09-01', run: 152 });
  L.flights.push({ from: 'HOME', to: 'M1', outcome: 'gave-up',
                   t: 600, on: '2026-09-01' });
  SHELF.note({ id: 'probe', verdict: 'redraw', ok: true });   // any note redraws
  const meta = (els.lgMeta && els.lgMeta.textContent) || '';
  const html = (els.lgRows && els.lgRows.innerHTML) || '';
  ok(/2 flights/.test(meta), 'the logbook counts its flights (' + meta + ')');
  ok(/0\.25 h/.test(meta),
     'and ACCRUES them: 294 + 600 s is 0.25 h (' + meta + ')');
  // anchored to the ELEMENT, not merely present in the markup: the same
  // duration is also in the row's hover tip, so a loose /4:54/ passed happily
  // with the visible clock deleted (found by negative verification, which is
  // the entire reason it is run)
  ok(/<i>4:54<\/i>/.test(html), "the arrival's own clock is on its row");
  ok(/landing run 152 m/.test(html), 'the landing run rides the row');
  ok(/gave up/.test(html), 'a refused flight is still a row');

  // the one that matters: a pre-G152 row has no clock and must not read as 0
  L.flights.push({ from: 'HOME', to: 'CIRCUIT', sink: 0.7, V: 70, off: 0.2 });
  SHELF.note({ id: 'probe', verdict: 'redraw', ok: true });
  const meta2 = (els.lgMeta && els.lgMeta.textContent) || '';
  ok(/3 flights/.test(meta2),
     'a row from before the clock is still a flight (' + meta2 + ')');
  ok(/0\.25 h/.test(meta2),
     '...and does not poison the total to NaN (' + meta2 + ')');

  // and the new fields have to survive the envelope, or the hours reset on load
  SHELF.save('logtest');
  const env = JSON.parse(store.getItem('flydiy.build.logtest'));
  const r0 = env && env.log && env.log.flights && env.log.flights[0];
  ok(!!r0 && r0.t === 294 && r0.on === '2026-09-01' && r0.run === 152,
     'the clock, the date and the run all ride the save envelope');
}

console.log('');
console.log('GATE BUILD: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
