// THE JOINED BAKE (PERF STUDY chantier 1, 2026-09-15) — a card as the game
// would fly it, headless.
//
// `designBake` (tools/_cage_design.js) composes a card's BIRTH spec: the
// choices the tiles made (wing, engine, mount, construction, fairings, the
// airfoil...). What it cannot carry is what the join MEASURES off the drawn
// cage — the cabin box and its seats, the fuselage profile, the gear
// stations, the tail's areas — and so every headless consumer (the perf
// study, GATE ARCHETYPES) flew every card on GEN_DEFAULT's cabin: a Cub's
// 0.72 m tandem under the Caravan-alike's wing. The fuselage weighed the same
// on every card for that reason as much as for the gauge.
//
// This runs the page's own chain under node — the drawing layers in the
// headless scene (tools/_scene_headless.js, the real three.js) and then
// tools/_cage_join.js's `measure()` over that scene, exactly the export the
// editor's `syncBuild` runs — and merges the fragment the way the garage
// does (GARAGE_SPEC.update: merge). The result is the aeroplane the game
// flies for that card.
//
//   const BJ = require('./_bake_joined.js');
//   BJ.loadPanel();                       // the design rows need the panel's
//                                         //   layers as globals (once)
//   const r = BJ.bakeCard('c172');        // { key, spec0, spec, J, errors, notes, ms }
//   const r2 = BJ.bakeJoined(spec0);      // the same for any birth spec
//
// ~3 s a card (the scene context is built once per process). The join's own
// ERRS (what it could not measure) ride out as `errors`; a consumer that
// flies the spec should print them — the bench files each as a failed test.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const T = __dirname;

// the panel as perf_study.js and GATE ARCHETYPES load it: the layers as
// globals over a THREE stub, so designBake can compose the cage
let PANEL = null;
function loadPanel() {
  if (PANEL) return PANEL;
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
    '_cage_gear.js', '_cage_float.js', '_fit_site.js', '_fit_gen.js',
    '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js',
    '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js',
    '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  global.window.CAGE_JOIN_ENGINES = require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES;
  PANEL = { W: global.window, D: require(path.join(T, '_cage_design.js')), C: CORE };
  return PANEL;
}

// the garage's merge (src/viewer/garage.js `merge`, verbatim in its rules):
// objects deep; `wings` element-wise (the join writes nearly every wing key
// but not `place`); every other array, the finish and the cage replace as
// a whole (each is one measurement of one thing, written as deviations)
const isPlain = o => o && typeof o === 'object' && !Array.isArray(o);
function merge(base, over) {
  if (!isPlain(over)) return over;
  const out = isPlain(base) ? Object.assign({}, base) : {};
  for (const k in over) {
    if (Array.isArray(over[k]))
      out[k] = (k === 'wings' && Array.isArray(base && base[k]))
        ? over[k].map((w, i) => merge(base[k][i], w)) : over[k];
    else if (k === 'finish' || k === 'cage') out[k] = over[k];
    else if (isPlain(over[k])) out[k] = merge(base && base[k], over[k]);
    else out[k] = over[k];
  }
  return out;
}

let JOIN_IN = null;         // the scene context the join was loaded into
function joinIn(W) {
  if (JOIN_IN === W) return;
  // the join reads the live page: the panel's P (stubbed per build below),
  // the gear/wing/airframe contracts the layers publish, the scene's meshes
  W.CAGE_UI_LAZY = true;
  vm.runInContext(fs.readFileSync(path.join(T, '_cage_join.js'), 'utf8'), W, { filename: '_cage_join.js' });
  JOIN_IN = W;
}

function bakeJoined(spec0) {
  const SH = require(path.join(T, '_scene_headless.js'));
  const t0 = Date.now();
  const spec = JSON.parse(JSON.stringify(spec0));
  const r = SH.sceneBuild(spec, { garage: spec });
  const W = r.W;
  // THE PAGE'S MOUNT HIERARCHY (measured, 2026-09-15): the join's edMount()
  // walks up from the wing group to the group whose GRANDPARENT is the
  // scene — the editor's inner (pitch) mount, the frame every layer-bounds
  // measurement is taken in. The headless scene hangs the layers off the
  // Scene itself, so the walk stopped at the wing group and the tail was
  // measured in the WING's frame: the Jodel-alike's stab read 1.96 m aft
  // of the firewall (its wing station) instead of 4.6, the neutral point
  // came forward and the card pitched up to 42 deg off the runway. Two
  // identity groups over the layers give the walk the page's answer.
  {
    const THREE = W.THREE;
    const outer = new THREE.Group(), inner = new THREE.Group();
    for (const ch of r.scene.children.slice()) inner.add(ch);
    outer.add(inner); r.scene.add(outer);
    r.scene.updateMatrixWorld(true);
  }
  W.CAGE_UI = { P: r.P };
  joinIn(W);
  const J = W.CAGE_JOIN.export();
  const errors = W.CAGE_JOIN.errors(), notes = W.CAGE_JOIN.notes();
  // the fragment over the birth spec, as GARAGE_SPEC.update merges it
  const joined = merge(spec, JSON.parse(JSON.stringify(J)));
  return { spec0, spec: joined, J, errors, notes, sceneErrors: r.errors, ms: Date.now() - t0 };
}

function bakeCard(key) {
  const { D } = loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === key);
  if (!a) return null;
  const spec0 = D.designBake(a.sel, a.over);
  return Object.assign({ key, name: a.name }, bakeJoined(spec0));
}

module.exports = { loadPanel, bakeJoined, bakeCard, merge };
