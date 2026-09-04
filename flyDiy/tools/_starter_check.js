#!/usr/bin/env node
// GATE STARTER — an "applies once" starter fires on a ROW CHANGE, never on a
// LOAD.
//
//   node tools/_starter_check.js            -> "GATE STARTER: PASS|FAIL"
//   node tools/_starter_check.js --selftest -> negative verification
//
// Two layers carry a starter that writes a coherent set of rows ONCE and then
// leaves every one of them to the builder: the engine preset ("preset (applies
// once)", _cage_eng.js) and the cowl drawn for an engine architecture
// (_cage_cowl.js). Both decided "once" by comparing against the PREVIOUS
// BUILD's value — and a loaded build replaces P wholesale, so a file naming a
// different preset than the aeroplane you had open re-fired the starter, and
// the preset overwrote the seven engine rows the file had actually saved
// (2026-09-03, the user's jodel: mount gap 1.52 -> 0.85, firewall spread 2.07
// -> 1.50, the exhaust style and both outlet offsets). Order-dependent, too:
// loading the same file twice was fine, because the second load changed
// nothing. The aeroplane you got depended on what you had open before.
//
// The rule this pins: `PAGE.load` is how a door that REPLACES P (applySpec,
// applyPreset, the reset button) tells every starter "recorded, not edited".
// Each starter is a pure step the gate can drive without a scene — the first
// look records, a row change fires, a load followed by a look records again.
//
// NEGATIVE-VERIFIED (G3.2): --selftest replays the load WITHOUT `PAGE.load`
// (the bug as it was) and strips `loaded()` from a copy of the door source;
// each must go red, or the check is inert.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;

// ---------------------------------------------------------------------------
// THE PANEL, HEADLESS — the same shim GATE PARTS uses: a `window`, a THREE
// stand-in, and the layers in bundle order minus _cage_ui.js.
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
const PAGE = W.CAGE_PAGE;
const G = require(path.join(T, '_cage_gen.js'));

const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};

// THE DEFAULT AEROPLANE, as the editor boots it: the template plus every
// layer's declared defaults (functions are not values)
const fresh = () => {
  const P = G.cageDefaults();
  for (const k in (PAGE.defaults || {}))
    if (typeof PAGE.defaults[k] !== 'function') P[k] = PAGE.defaults[k];
  return P;
};

// ---------------------------------------------------------------------------
// 1 THE CONTRACT EXISTS
// ---------------------------------------------------------------------------
const ENG = W.CAGE_ENG_STARTER, COWL = W.CAGE_COWL_STARTER;
check(typeof ENG === 'function', 'the engine preset starter is not published');
check(typeof COWL === 'function', 'the cowl-for-architecture starter is not published');
check(typeof PAGE.load === 'function', 'no layer registered PAGE.load');

// two settings of each discriminating row that the starter tells apart
const archOf = P => { try { return W.CAGE_ENG_SPEC(P).arch; } catch (e) { return null; } };
const ARCHES = (() => {
  const P = fresh(), out = [];
  for (let i = 0; i < 8; i++) {
    P.eng_arch = i;
    const a = archOf(P);
    if (a && !out.some(o => o.arch === a)) out.push({ i, arch: a });
  }
  return out;
})();
check(ARCHES.length >= 2, 'fewer than two engine architectures to switch between',
  ARCHES.map(o => o.arch).join(','));

// ---------------------------------------------------------------------------
// 2 THE STARTERS — the same five looks at each
// ---------------------------------------------------------------------------
// S       the starter
// set     writes the discriminating row to setting 0 or 1
// load    whether the door says PAGE.load before handing over the loaded P
//         (false replays the bug; --selftest requires that to go red)
function drive(name, S, set, load) {
  let ok = true;
  const P = fresh(); set(P, 0);
  ok = check(S(P) === null, name + ': the first look must record, not fire') && ok;
  set(P, 1);
  ok = check(S(P) !== null, name + ': a row change must fire') && ok;
  ok = check(S(P) === null, name + ': a second look at the same value must not fire') && ok;
  // THE BUG. A loaded build replaces P with one that names the OTHER setting.
  const Q = fresh(); set(Q, 0);
  if (load) PAGE.load();
  ok = check(S(Q) === null,
    name + ': a LOAD must not fire the starter (it overwrote the rows the file saved)') && ok;
  // ...and the starter is not dead afterwards
  set(Q, 1);
  ok = check(S(Q) !== null, name + ': a row change after a load must still fire') && ok;
  return ok;
}
const setPreset = (P, s) => { P.engPreset = s ? 1 : 0; };
const setArch = (P, s) => { P.eng_arch = ARCHES[s ? 1 : 0].i; };
function driveAll(load) {
  let ok = drive('engine preset', ENG, setPreset, load);
  if (ARCHES.length >= 2) ok = drive('cowl for architecture', COWL, setArch, load) && ok;
  return ok;
}
driveAll(true);

// ---------------------------------------------------------------------------
// 3 THE DOORS — every place _cage_ui.js replaces P says `loaded()` first.
// A source check, like GATE BUILD's applySpec -> finishFromSpec line: the
// file needs a document to run, and this is the single line each door must
// carry.
// ---------------------------------------------------------------------------
const DOORS = ['function applySpec(', 'function applyPreset(',
               "$('resetBtn').onclick"];
function checkDoors(src) {
  let ok = true;
  for (const d of DOORS) {
    const at = src.indexOf(d);
    if (!check(at >= 0, 'door not found in _cage_ui.js', d)) { ok = false; continue; }
    const body = src.slice(at, at + 1400);
    const b = body.indexOf('build();'), l = body.indexOf('loaded();');
    ok = check(l >= 0 && b >= 0 && l < b,
      'a door that replaces P builds without saying `loaded()` first', d) && ok;
  }
  return ok;
}
const UISRC = fs.readFileSync(path.join(T, '_cage_ui.js'), 'utf8');
checkDoors(UISRC);

// ---------------------------------------------------------------------------
// NEGATIVE VERIFICATION
// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  const cases = [
    ['a load that does not say PAGE.load (the bug as it was)',
     () => driveAll(false)],
    ['a door that builds without loaded()',
     () => checkDoors(UISRC.replace(/loaded\(\);/g, ''))],
  ];
  let bad = 0;
  for (const [name, run] of cases) {
    const before = fail.length;
    const ok = run();
    const caught = fail.length > before || ok === false;
    fail.length = before;
    console.log(`  selftest ${caught ? 'caught  ' : 'MISSED  '}${name}`);
    if (!caught) bad++;
  }
  check(bad === 0, `${bad} rule(s) cannot be broken — those checks are inert`);
}

// ---------------------------------------------------------------------------
console.log(`  2 starters, ${ARCHES.length} architectures, ${DOORS.length} doors`);
if (fail.length) {
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE STARTER: FAIL');
  process.exit(1);
}
console.log('GATE STARTER: PASS');
