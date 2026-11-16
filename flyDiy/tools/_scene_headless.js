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
const zlib = require('zlib');

const T = __dirname;
const EXCLUDE = new Set(['_cage_crew.js', '_panel_gen.js', '_cage_panel.js',
  '_cage_char.js', '_cage_design.js', '_bay_site.js', '_vessel_gen.js',
  '_vessel_mesh.js', '_cage_energy.js', '_cage_join.js', '_cage_ui.js']);

let CTX = null;

// ---- QUICKSHOT-ONE: the whole aeroplane (opts.whole) ------------------------------------------------------------
// the layers EXCLUDE keeps out that draw what the player sees in and on the cabin
const WHOLE_LAYERS = ['_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js'];
// the construction token the sections' finishes key on (_cage_ui.js consOf / CONS_MAP, the same table)
const CONS_MAP = { tube: 'tubeFabric', wood: 'wood', metal: 'alloy', carbon: 'carbon', alu: 'aluTube', glass: 'glass', soft: 'softShell' };
const consOf = P => CONS_MAP[['carbon', 'tube', 'wood', 'metal', 'alu', 'glass', 'soft'][Math.max(0, Math.min(6, Math.round((P && P.intCons) || 0)))]] || 'tubeFabric';
const SEC_KEYS = { fin: 'fin', tint: 'tint', tile: 'tile', rough: 'rough', nrm: 'nrm', wear: 'wearM', cc: 'cc', field: 'field', metal: 'metal', fieldL: 'fieldL' };
// the editor's five-plus override maps (its secFin, secTint ... - _cage_ui.js finishFromSpec), from a build's finish
function finishMaps(A, finish) {
  const over = {}; for (const k of Object.keys(SEC_KEYS)) over[k] = {};
  let S = finish && finish.sections && typeof finish.sections === 'object' ? finish.sections : {};
  if (A && A.aeroFinishLegacy) S = A.aeroFinishLegacy(S).sections;
  for (const nm in S) { const r = S[nm] || {};
    if (r.fin) over.fin[nm] = r.fin;
    for (const k of Object.keys(SEC_KEYS)) if (k !== 'fin' && typeof r[SEC_KEYS[k]] === 'number') over[k][nm] = r[SEC_KEYS[k]]; }
  return over;
}
// THE SECTION'S PAINT, the editor's rule (_cage_ui.js): a LAYER's section walks AEROSKIN's declared chain
// (aeroSecResolve - secMat), the cage sheet's section takes its own tint or its finish's base (matOf). sRGB hex.
function secPaint(A, over, name, g, P, sheet) {
  if (!A) return null;
  if (sheet) {
    const fin = over.fin[name] || A.aeroFinishFor(name, consOf(P));
    const tint = over.tint[name] != null ? over.tint[name] : null;
    return { hex: tint != null ? tint : (A.AERO_FINISH[fin] || A.AERO_FINISH.fabric).base, fin, metal: over.metal[name] || 0 };
  }
  if (!A.AERO_SEC || !A.AERO_SEC[name]) return null;
  const r = A.aeroSecResolve(name, over, { cons: (g && g.cons) || consOf(P), fin: g && g.fin });
  const tint = r.tint != null ? r.tint : (g && g.tint0 != null) ? g.tint0 : null;
  return { hex: tint != null ? tint : (A.AERO_FINISH[r.fin] || A.AERO_FINISH.fabric).base, fin: r.fin, metal: r.metalK || 0 };
}
function wholeContext(ctx, g) {
  const CS = require(path.join(T, '_canvas_soft.js'));
  // the characters' registry (src/chars/*_char.js) before _cage_page5.js reads the default pilot (GATE CREWLOAD's rule)
  const CH = path.join(T, '..', 'src', 'chars');
  for (const f of fs.readdirSync(CH).filter(f => /_char\.js$/.test(f))) vm.runInContext(fs.readFileSync(path.join(CH, f), 'utf8'), ctx, { filename: f });
  // a canvas that paints: the panel's faces, the livery's atlas (aeroskin.js) run their own painters on it
  const ce = g.document.createElement;
  g.document.createElement = tag => String(tag).toLowerCase() === 'canvas' ? CS.canvas(300, 150) : ce(tag);
  g.requestAnimationFrame = () => 0; g.cancelAnimationFrame = () => {};      // (the characters' idle animation: a still)
  // THE MATERIAL VIEW IS ON (the garage's #mat select at 'material': the layers dress their parts by livery section, not
  // the bench's diagnostic palette - _cage_wing.js wingMat and its siblings read the select)
  const gid = g.document.getElementById, matSel = { value: 'material', checked: true, style: {}, addEventListener() {} };
  g.document.getElementById = id => id === 'mat' ? matSel : gid(id);
  g.GFX = { budget: () => ({ aeroAtlas: 2048 }) };                           // (the livery atlas: a page 512 px, the phone's)
  g.FLYDIY_LAZY = () => Promise.resolve();                                   // (the stickers' geometry: loaded below)
  // the asset door: the characters' meshes off the disk, each fetch counted so a build can wait for them
  const pend = new Set();
  const door = u => { const p = new Promise((res, rej) => fs.readFile(path.join(T, '..', String(u).split('?')[0]), (e, b) => {
    if (e) return rej(e);
    const buf = b[0] === 0x1f && b[1] === 0x8b ? zlib.gunzipSync(b) : b;
    res(new Uint8Array(buf)); }));     // (the page's door hands bytes: decodeChar reads u8.buffer at u8.byteOffset)
    pend.add(p); p.then(() => pend.delete(p), () => pend.delete(p)); return p; };
  g.ASSET_FETCH = door; g.ASSET_FETCH_FRESH = door; g.__wholePending = pend;
  // THE LIVERY: the garage's material module, as the page loads it before the editor's files
  for (const f of ['livery_marks.js', 'aeroskin.js']) {
    const p = path.join(T, '..', 'src', 'viewer', f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  }
  // THE MATERIAL FACTORY'S COLOUR HALF: aeroMaterial / aeroHardMat / aeroGlass answer the colour and the opacity the
  // garage's factory gives (its own rule: the tint, else the finish's base; the hard table's finish by layer + name),
  // without baking the detail sheets (normal / roughness / metal maps: ~8 s of procedural canvases a build, and a flat
  // rasteriser draws none of them)
  const A0 = g.AEROSKIN;
  if (A0) {
    const THREE = g.THREE, lite = (o, kind) => {
      const fin = o.finish != null ? o.finish : null, row = (fin && A0.AERO_FINISH[fin]) || null;
      const m = new THREE.MeshLambertMaterial({ side: o.side != null ? o.side : THREE.DoubleSide,
        transparent: kind === 'glass' || (o.opacity != null && o.opacity < 1), opacity: kind === 'glass' ? Math.min(0.45, o.opacity != null ? o.opacity : 0.45) : (o.opacity != null ? o.opacity : 1) });
      if (o.tintLin != null) m.color.setHex(o.tintLin, THREE.LinearSRGBColorSpace);
      else m.color.setHex(o.tint != null ? o.tint : row ? row.base : kind === 'glass' ? 0x6f8fa8 : 0xb0b0b0);
      m.userData.sec = { name: o.name || null, fin, glass: kind === 'glass' ? 1 : 0, cls: +o.wing || 0, surf: o.surf ? 1 : 0,
                         fieldM: o.fieldM != null ? o.fieldM : 1, decOk: o.decals != null ? +o.decals : 1, metal: +o.metalK || 0 };
      return m;
    };
    A0.aeroMaterial = (THREE_, o) => lite(o || {}, 'mat');
    A0.aeroGlass = (THREE_, o) => lite(o || {}, 'glass');
    A0.aeroGlassCompanion = () => null;
    A0.aeroHardMat = (THREE_, layer, name, tint, o) => {
      if (!A0.aeroHardOn()) return null;
      const fin = A0.aeroHardFinish(layer, name);
      if (fin == null) return null;
      return lite(Object.assign({}, o, { finish: fin, tint, surf: 0, fieldM: 1, decals: (o && o.decals != null) ? o.decals : 0 }), 'mat');
    };
  }
  // the editor's per-section material door (window.CAGE_SECMAT, _cage_ui.js secMat): the layers ask it by section; the
  // answer here is the colour the garage resolves (secPaint), on a plain material that says which section it dresses
  g.CAGE_SECMAT = (name, gg) => {
    const A = g.AEROSKIN, pt = secPaint(A, g.__wholeOver || finishMaps(A, null), name, gg, g.__wholeP, false);
    if (!pt) return null;
    const m = new g.THREE.MeshLambertMaterial({ color: pt.hex, side: g.THREE.DoubleSide, transparent: gg && gg.opacity != null && gg.opacity < 1, opacity: gg && gg.opacity != null ? gg.opacity : 1 });
    m.userData.sec = { name, fin: pt.fin, metal: pt.metal, cls: (gg && +gg.wing) || 0, surf: gg && gg.surf ? 1 : 0, fieldM: gg && gg.fieldM != null ? gg.fieldM : 1,
                       decOk: A.aeroDecOk ? A.aeroDecOk(name) : 1 };
    return m;
  };
}

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
  // RETRACT-LAB (SEAPLANES-LAND 7 Nov, _cage_gear.js RETRACT_LAB): the rigs see every retract row, as the developer's
  // garage does; FLYDIY_RETRACT_LAB=0 asks for the player's garage
  g.FLYDIY_RETRACT_LAB = process.env.FLYDIY_RETRACT_LAB !== '0';
  g.Image = function () { return el(); };
  const ctx = vm.createContext(g);
  vm.runInContext('var window = globalThis; window.window = window;', ctx);
  if (process.env.PC6_COMP) ctx.PC6_COMP = +process.env.PC6_COMP;   // (PC6-OLEO: quickshot --pc6comp, the tailwheel drawn compressed)
  // opts.before(ctx): what the page has in scope before the editor's files (G1985: the characters' registry, which
  // _cage_page5.js reads for the default pilot when it loads)
  if (opts && typeof opts.before === 'function') opts.before(ctx);
  // DC3-2 (G3573): THE FLAT MAP'S TEXTURE (G903, src/viewer/assets.js TEX_FLAT) - the page has it in scope before the
  // editor's files, and the characters bind it for a flat map (a seated passenger's: without it the crew layer's post
  // threw 'TEX_FLAT is not defined' and every layer after it - the gear, the join's measures - never ran). The page's own
  // block, run here as the page runs it
  {
    const A = fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'assets.js'), 'utf8');
    const m = /\(\(\) => \{\s*'use strict';\s*const FLAT = new Map\(\);[\s\S]*?G\.TEX_FLAT = texFlat;\s*\}\)\(\);/.exec(A);
    if (m) vm.runInContext(m[0], ctx, { filename: 'assets.js#TEX_FLAT' });
  }
  // ASSETS-GREEN (8 Nov): THE MATERIAL LIBRARY (src/viewer/matlib.js) - the page loads it before the editor's files, and
  // the seat library's plain material (tools/_seat_gen.js, the flat view's) is made there now (GATE ASSETS MATS)
  vm.runInContext(fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'matlib.js'), 'utf8'), ctx, { filename: 'matlib.js' });
  // QUICKSHOT-ONE (15 Nov, opt-in, opts.whole): WHAT THE PLAYER SEES - the cabin (crew, characters, panel layers: the
  // pilot and occupants in their seats, the dash, its instruments and the controls) and THE LIVERY (aeroskin.js, the
  // garage's own material system, on a software 2-D canvas so its painters run). See wholeContext below.
  if (opts && opts.whole) wholeContext(ctx, g);
  const { MANIFEST } = require(path.join(T, 'build.js'));
  const skip = new Set([...EXCLUDE, ...((opts && opts.exclude) || [])]);
  if (opts && opts.whole) for (const f of WHOLE_LAYERS) skip.delete(f);
  // opts.include: layers EXCLUDE keeps out, loaded all the same (quickshot --parts --crew: the crew layer, the seat and the pilot)
  for (const f of (opts && opts.include) || []) skip.delete(f);
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
  // opts.base: the P the build lands ON (G1985: the editor's own DEFAULTS, CAGE_PARAMS + the page's defaults - the
  // page's applySpec assigns cageFromSpec over the P it holds, so a row cageFromSpec does not return keeps that value)
  const P = opts.base ? Object.assign(JSON.parse(JSON.stringify(opts.base)), CG2.cageFromSpec(spec || null)) : CG2.cageFromSpec(spec || null);
  if (opts.over) Object.assign(P, opts.over);
  if (typeof opts.prebuild === 'function') opts.prebuild(P);
  if (W.__wholePending) { W.__wholeOver = finishMaps(W.AEROSKIN, spec && (spec.finish || (spec.spec && spec.spec.finish))); W.__wholeP = P; }
  const built = CG2.cageSheet(P, { step: opts.step || PAGE.defaultStep || 'crease',
                                   level: opts.level == null ? 2 : opts.level });
  const FS = (CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const scene = new C.THREE.Scene();
  const errors = C.errors.slice();
  const stat = { textContent: '' };
  // CABIN-CRAFT (opt-in, opts.ms): THE SHEET THE PAGE'S LAYERS READ. The editor's build publishes its subdivided sheet
  // as CAGE_UI.MS before the layers run (_cage_ui.js build: `MS = s`), and the light layer hangs the cabin lamps off it
  // (ceilAt / frameAt): headless it was never there, so every headless cabin lamp missed the roof. Opt-in, so no
  // other headless drawing moves.
  if (opts.ms) W.CAGE_UI = Object.assign({}, W.CAGE_UI || {}, { MS: built.mesh, P });
  if (PAGE.post) {
    try { PAGE.post({ scene, spec: built.spec, mesh: built.sheet, P, stat }); }
    catch (e) { errors.push('post: ' + (e && e.stack || e)); }
  }
  scene.updateMatrixWorld(true);
  return { scene, P, spec: built.spec, built, FS, ms: Date.now() - t0, errors,
           stat: stat.textContent, W };
}

// THE WHOLE AEROPLANE (QUICKSHOT-ONE), a context made with { whole: true }: the build as the garage loads it - the
// panel's Instruments column filled from the build (CAGE_PANEL.fromSpec, the editor's load), the characters fetched
// off the disk and the build made again once they have landed (the crew layer draws a character when its mesh is in;
// the page rebuilds on CAGE_UI.build, here the loop waits on the fetches). Resolves to sceneBuild's record plus
// `decals`: the livery's decal list (AEROSKIN.aeroDecalsFor, the flight's own door aeroApplySpecDecals uses) with
// `atlas`, the soft canvas its painters drew the pages on.
async function sceneBuildWhole(spec, opts) {
  opts = Object.assign({ ms: true }, opts || {});
  const W = context({ whole: true }).ctx;
  if (!W.__wholePending) throw new Error('sceneBuildWhole: the context was made without { whole: true }');
  let rebuilds = 0;
  const first = sceneBuild(spec, opts);
  W.CAGE_UI.build = () => { rebuilds++; };
  if (W.CAGE_PANEL && W.CAGE_PANEL.fromSpec) W.CAGE_PANEL.fromSpec((spec && spec.systems) || {});
  let r = sceneBuild(spec, opts), builds = 2;
  for (let round = 0; round < 4 && W.__wholePending.size; round++) {
    await Promise.allSettled([...W.__wholePending]);
    await new Promise(res => setTimeout(res, 20));
    r = sceneBuild(spec, opts); builds++;
  }
  r.rebuilds = rebuilds; r.builds = builds;
  const A = W.AEROSKIN;
  if (A && A.aeroDecalsFor) {
    const D = A.aeroDecalMerge(spec), paint = (spec && spec.paint) || {};
    const reg = (spec && spec.meta && spec.meta.reg) || (spec && spec.reg) || null;
    try { const L = A.aeroDecalsFor(W.THREE, D, { reg, trim: paint.trim, base: paint.base });
          r.decals = { list: L.list, dropped: L.dropped, atlas: A.aeroAtlas(W.THREE).image, rect: A.aeroPageRect, reg: reg || D.reg || 'F-PGAR' }; }
    catch (e) { r.errors.push('decals: ' + (e && e.stack || e)); }
  }
  r.secPaint = (name, g, sheet) => secPaint(A, W.__wholeOver, name, g, r.P, sheet);
  return r;
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

module.exports = { sceneBuild, sceneBuildWhole, context, loadFixture, EXCLUDE, WHOLE_LAYERS, stubCanvas };
