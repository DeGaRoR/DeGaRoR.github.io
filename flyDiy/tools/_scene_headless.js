// SCENE HEADLESS — the editor's DRAWING layers with no page (GATE CLIP, P0).
//
// The cage page builds one sheet (CAGE2.cageSheet) and hands it down the
// PAGE.post chain; every layer draws its group into `scene`. That chain is
// the only description of "what the aeroplane wears", and until now it ran
// only under a document. This module runs it under node: the real
// vendor/three.min.js (r186, the same the page draws with — a stub would
// answer a different question about geometry), the core's exports as
// globals (the layers reach GEN_*, genTravel, makeSkinBinding... bare), and
// a six-line document that answers `getElementById` with null, which every
// drawing layer already guards for (the bench pages without that control).
//
//   sceneBuild(spec, opts) -> { scene, P, spec, built, FS, ms, errors }
//     spec   a saved build ({cage:{...}} or a bare cage object) or null for
//            the page's default aeroplane; opts.over is laid on top of P
//     opts   { over, level (2), step ('crease'), garage (window.GARAGE_SPEC
//              value, e.g. an IFR wing-tank spec), layers (exclusion set),
//              resolved (() => the built spec, the game's GARAGE_SPEC.resolved),
//              inGame (CAGE_IN_GAME for the build: the layers read the game's spec) }
//
// The context is built ONCE per process and reused: the layers keep their
// own module state (group disposal, caches keyed on the airframe object)
// exactly as they do across builds in the page, so a second sceneBuild is
// a second slider drag, not a second page load. The layer list is
// build.js's MANIFEST.editor minus what needs a document or a person
// (crew, panel, characters, energy, the design rows, the UI) — a layer
// added to the game picks itself up here.
//
// TRAP (measured): GEN_INFL is not among the core's node exports, and
// _cage_wing.js falls back to 4 without it, which picks NO skin headless.
// It is set from the wing source's own constant here until the export lands.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const T = __dirname;
const EXCLUDE = new Set(['_cage_crew.js', '_panel_gen.js', '_cage_panel.js',
  '_cage_char.js', '_cage_design.js', '_bay_site.js', '_vessel_gen.js',
  '_vessel_mesh.js', '_cage_energy.js', '_cage_join.js', '_cage_ui.js']);

let CTX = null;

function makeContext(opts) {
  const THREE = require(path.join(T, '..', 'vendor', 'three.min.js'));
  const CORE = require(path.join(T, 'flight_core.js'));
  const g = {};
  for (const k of Object.keys(CORE)) g[k] = CORE[k];
  if (g.GEN_INFL === undefined) {
    const src = fs.readFileSync(path.join(T, '..', 'src', 'core', '63_gen_wing.js'), 'utf8');
    const m = /const GEN_INFL\s*=\s*([\d.]+)/.exec(src);
    g.GEN_INFL = m ? +m[1] : 8;
  }
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {}, setAttribute() {}, textContent: '',
    value: '', checked: false, querySelector: () => null, querySelectorAll: () => [] });
  g.document = { getElementById: () => null, querySelector: () => null,
    querySelectorAll: () => [], createElement: el, body: el(), head: el() };
  g.THREE = THREE;
  g.console = console;
  g.performance = { now: () => Number(process.hrtime.bigint()) / 1e6 };
  g.setTimeout = setTimeout; g.clearTimeout = clearTimeout;
  g.navigator = { userAgent: 'node' };
  g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  g.Image = function () { return el(); };
  const ctx = vm.createContext(g);
  vm.runInContext('var window = globalThis; window.window = window;', ctx);
  const { MANIFEST } = require(path.join(T, 'build.js'));
  const skip = new Set([...EXCLUDE, ...((opts && opts.exclude) || [])]);
  const loaded = [], errors = [];
  for (const f of MANIFEST.editor) {
    if (skip.has(f)) continue;
    const code = fs.readFileSync(path.join(T, f), 'utf8');
    try { vm.runInContext(code, ctx, { filename: f }); loaded.push(f); }
    catch (e) { errors.push(f + ': ' + (e && e.message)); }
  }
  return { ctx, loaded, errors, THREE };
}

function context(opts) {
  if (!CTX) CTX = makeContext(opts);
  return CTX;
}

function sceneBuild(spec, opts) {
  opts = opts || {};
  const C = context(opts);
  const W = C.ctx;
  const CG2 = W.CAGE2;
  const PAGE = W.CAGE_PAGE || (W.CAGE_PAGE = {});
  // opts.resolved: the game's GARAGE_SPEC.resolved() (the built spec the energy
  // layer's bay rule reads in the game, G1106); opts.inGame sets CAGE_IN_GAME for the build
  W.GARAGE_SPEC = opts.garage ? Object.assign({ get: () => opts.garage }, opts.resolved ? { resolved: opts.resolved, update() {} } : {}) : undefined;
  W.CAGE_IN_GAME = !!opts.inGame;
  const t0 = Date.now();
  const P = CG2.cageFromSpec(spec || null);
  if (opts.over) Object.assign(P, opts.over);
  const built = CG2.cageSheet(P, { step: opts.step || PAGE.defaultStep || 'crease',
                                   level: opts.level == null ? 2 : opts.level });
  const FS = (CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const scene = new C.THREE.Scene();
  const errors = C.errors.slice();
  const stat = { textContent: '' };
  if (PAGE.post) {
    try { PAGE.post({ scene, spec: built.spec, mesh: built.sheet, P, stat }); }
    catch (e) { errors.push('post: ' + (e && e.stack || e)); }
  }
  scene.updateMatrixWorld(true);
  return { scene, P, spec: built.spec, built, FS, ms: Date.now() - t0, errors,
           stat: stat.textContent, W };
}

// a saved build file -> its cage object (the _save_check.js pattern)
function loadFixture(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const spec = j.spec || j;
  return { spec, cage: spec.cage || spec };
}

// A CANVAS THAT ANSWERS (G1109, opt-in): the crew and panel layers paint
// textures (the panel's AO and faces atlas) and the chain STOPS at the first
// canvas without a getContext - the Jodel-alike's energy layer never ran, and
// its tanks were never asked. A 2-D context that accepts every call and
// hands back empty pixels; geometry is all a headless measurement reads.
// Only the tools that load the crew call it (tank_refit, GATE TANKMOUNT), so
// every other gate keeps the harness it was measured with.
function stubCanvas(opts) {
  const W = context(opts).ctx;
  if (W.__canvasStub) return;
  const any = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? (() => 0) : k === 'length' ? 0 : any,
                                          apply: () => any, set: () => true });
  const img = (...a) => { const w = (a.length > 2 ? a[2] : a[0]) || 1, h = (a.length > 2 ? a[3] : a[1]) || 1;
                          return { data: new Uint8ClampedArray(4 * w * h), width: w, height: h }; };
  const mk = () => {
    const cv = { width: 1, height: 1, style: {}, toDataURL: () => '', addEventListener() {} };
    cv.getContext = () => new Proxy({ canvas: cv }, {
      get: (t, k) => k in t ? t[k] : (k === 'getImageData' || k === 'createImageData') ? img
        : k === 'measureText' ? (() => ({ width: 10 })) : any,
      set: (t, k, v) => { t[k] = v; return true; } });
    return cv;
  };
  const ce = W.document.createElement;
  W.document.createElement = tag => String(tag).toLowerCase() === 'canvas' ? mk() : ce(tag);
  W.__canvasStub = 1;
}

module.exports = { sceneBuild, context, loadFixture, EXCLUDE, stubCanvas };
