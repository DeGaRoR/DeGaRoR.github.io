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
    const viaPreset = Object.assign(clone(DEFAULTS), pre);
    // the shelf's bake, then the shelf's load
    const baked = { cage: CAGE2.cageToSpec(Object.assign(CAGE2.cageDefaults(),
                     CAGE_PAGE.defaults || {}, pre)) };
    const viaShelf = CAGE2.cageFromSpec(baked);
    const diff = Object.keys(viaPreset).filter(
      k => !(k in CAGE2.CAGE_VIEW_KEYS) && viaShelf[k] !== viaPreset[k]);
    if (diff.length) bad.push(nm + ': ' + diff.slice(0, 4).join(', '));
    // NEGATIVE VERIFY: the naive bake — the preset's own keys alone, which is
    // what a hand-pasted export file is — must NOT reproduce it, or this
    // assertion is testing nothing.
    const naive = CAGE2.cageFromSpec({ cage: clone(pre) });
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

console.log('');
console.log('GATE BUILD: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
