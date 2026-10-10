// _load_build.js (G1985, JOIN-PARITY) - THE ONE LOAD PATH: a saved build becomes, under node, the spec the GAME flies.
//
// The game never flies a saved file as written. Its load door (garage.js loadSpec, the boot's seed the same way)
// normalises the spec, seeds the editor from it (_cage_ui.js applySpec: cageFromSpec, PAGE.load, the energy and panel
// layers' fromSpec, a build of every drawing layer), runs the JOIN over what the editor drew (app.js BUILD_SYNC ->
// CAGE_JOIN.export -> GARAGE_SPEC.update, genSpecMerge), and the energy layer then writes back the tanks it fitted
// (CAGE_ENERGY.commit, 120 ms later). Every one of those steps can change the aeroplane: the join measures the drawn
// engine's flange into engines[0].x (G445.1), the glazed area into cabin.glazedM2, the cabin, the fuselage profile,
// the tail's areas; the energy layer shapes a tank that has no box of its own to its bay and the crew's feet.
// Node's loaders ran buildGen on the file and skipped all of it: the user's metal Cessna flew in node with its engine
// 65 cm aft of the game's, the Cub with a 45 L tank the game had shaped to 27 L (DMG-D4b, the coordinator's finding).
//
// This runs THE PAGE'S OWN CODE for every one of those steps - the same tools/_cage_*.js layers the game draws with
// (tools/_scene_headless.js, the real three.js), the same join, the same merge, the same write-back, the pilots'
// characters loaded from media/ exactly as the page fetches them - in a CHILD PROCESS per build (the layers keep state
// across builds, G1106.2: one build, one process, as one page load). The only thing written here rather than shared is
// the ORDER the page calls them in; GATE JOINPARITY holds that order against the page's own (a capture of the real
// page's spec, tools/join_parity_page.js) to the def's last bit.
//
//   const LB = require('./_load_build.js');
//   LB.loadBuild('builds/cub_2026-09-20_corrected.json')   // { spec, name, file, key, cached, errors }
//   LB.gameSpec(rawSpecOrEnvelope)                          // the spec alone
//   LB.VALIDATED                                            // the user's validated builds (the gates' BUILDS)
//
// CACHED by content: the key hashes the input spec and every file the chain reads (the core, the editor's layers,
// three.js, the characters' manifests and geometry, this file and the headless harness), so a hit is the answer the
// chain would compute now, and any edit to any of them recomputes. tools/.joincache/ (gitignored). FLYDIY_JOIN_NOCACHE=1
// recomputes every time.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const T = __dirname;
const ROOT = path.join(T, '..');
const CACHE_DIR = path.join(T, '.joincache');

// THE VALIDATED AEROPLANES (the user's; tools/master_bench.js BUILDS, tools/_treecrash_lib.js BUILDS): one table.
const VALIDATED = {
  cub: { label: 'Cub', build: 'builds/cub_2026-09-20_corrected.json' },
  jodel: { label: 'Jodel', build: 'builds/jodel_2026-09-20_corrected.json' },
  metal: { label: 'metal Cessna', build: 'bugReports/cessnaMetal (1).json' },
  floats: { label: 'Cessna floats', build: 'bugReports/cessnaFloatsWOrks.json' },
  twinFloats: { label: 'twin floatplane', build: 'tools/fixtures/build_v7_ultralight_2026-09-05.json',
    patch: j => { j.spec.gear.type = 'floats'; j.spec.cage = Object.assign({}, j.spec.cage, { gearFloats: 1 }); return j; } },
};

// ---- the inputs' fingerprint ----------------------------------------------------------------------------------------
let CHAIN_SIG = null;
function chainFiles() {
  const { MANIFEST } = require(path.join(T, 'build.js'));
  const out = [path.join(T, 'flight_core.js'), path.join(ROOT, 'vendor', 'three.min.js'), __filename,
    path.join(T, '_scene_headless.js'), path.join(T, 'build.js')];
  for (const f of MANIFEST.editor) out.push(path.join(T, f));
  const CH = path.join(ROOT, 'src', 'chars');
  for (const f of charFiles()) out.push(path.join(CH, f));
  return out;
}
function charFiles() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'chars', 'chars_index.json'), 'utf8')); }
  catch (e) { return []; }
}
function chainSig() {
  if (CHAIN_SIG) return CHAIN_SIG;
  const h = crypto.createHash('sha1');
  for (const f of chainFiles()) { h.update(f.slice(ROOT.length)); try { h.update(fs.readFileSync(f)); } catch (e) { h.update('missing'); } }
  return (CHAIN_SIG = h.digest('hex'));
}

// ---- the parent side: sync, cached, one child per computation -------------------------------------------------------
function rawOf(x, patch) {
  let j = x;
  if (typeof x === 'string') j = JSON.parse(fs.readFileSync(path.isAbsolute(x) ? x : path.join(ROOT, x), 'utf8'));
  else j = JSON.parse(JSON.stringify(x));
  if (patch) j = patch(j);
  return j;
}
function gameSpecFull(rawIn) {
  const raw = (rawIn && rawIn.spec && typeof rawIn.spec === 'object') ? rawIn.spec : rawIn;
  const key = crypto.createHash('sha1').update(chainSig()).update(JSON.stringify(raw)).update(process.env.FLYDIY_JOIN_PROBE || '').digest('hex');
  const cf = path.join(CACHE_DIR, key + '.json');
  if (process.env.FLYDIY_JOIN_NOCACHE !== '1') {
    try { const c = JSON.parse(fs.readFileSync(cf, 'utf8')); return Object.assign(c, { key, cached: true }); } catch (e) {}
  }
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, ['--max-old-space-size=4096', __filename, '--child'],
    { input: JSON.stringify(raw), encoding: 'utf8', maxBuffer: 1 << 28, cwd: ROOT });
  let out = null;
  try { out = JSON.parse(r.stdout.slice(r.stdout.indexOf('\u0001') + 1)); } catch (e) {}
  if (!out || !out.spec) throw new Error('_load_build: the page chain failed (exit ' + r.status + '): ' +
    String(r.stderr || '').split('\n').slice(-8).join(' | ') + ' ' + String(r.stdout || '').slice(0, 400));
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(cf + '.tmp' + process.pid, JSON.stringify(out)); fs.renameSync(cf + '.tmp' + process.pid, cf); } catch (e) {}
  return Object.assign(out, { key, cached: false });
}
// the spec the game flies for a saved build (an envelope or a bare spec)
function gameSpec(raw) { return gameSpecFull(raw).spec; }
// a build FILE (repo-relative or absolute; `patch` edits the parsed envelope first, the twin's float conversion)
function loadBuild(file, opts) {
  const j = rawOf(file, opts && opts.patch);
  const r = gameSpecFull(j);
  return { spec: r.spec, name: j.name || (typeof file === 'string' ? path.basename(file) : null), file: typeof file === 'string' ? file : null,
           key: r.key, cached: r.cached, errors: r.errors, notes: r.notes, steps: r.steps, probe: r.probe };
}
// one of VALIDATED by key
function loadValidated(key) {
  const B = VALIDATED[key];
  if (!B) throw new Error('_load_build: no validated build ' + key);
  return Object.assign(loadBuild(B.build, { patch: B.patch }), { label: B.label });
}

module.exports = { VALIDATED, loadBuild, loadValidated, gameSpec, gameSpecFull, chainSig, chainFiles };

// ---- the child: the page's load door, step by step ------------------------------------------------------------------
if (require.main === module && process.argv.includes('--child')) (async () => {
  const vm = require('vm'), zlib = require('zlib');
  const raw = JSON.parse(fs.readFileSync(0, 'utf8'));
  const SH = require(path.join(T, '_scene_headless.js'));
  // the layers the game draws and the harness leaves out by default: the tanks (and the bay and vessel kits they
  // stand on), the crew (whose feet a nose tank meets) and its characters, the instrument panel (its fit is a row)
  for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js',
                   '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
  const C = require(path.join(T, 'flight_core.js'));
  // THE CHARACTERS' REGISTRY IS IN SCOPE BEFORE THE EDITOR'S FILES, as on the page (MANIFEST.chars ahead of the
  // editor): _cage_page5.js names the default pilot off it when it loads (WHO_DEFAULT, Ch20's index - 0 without it)
  const X = SH.context({ before: ctx => { for (const f of charFiles()) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'chars', f), 'utf8'), ctx, { filename: f }); } });
  const W = X.ctx;
  SH.stubCanvas();
  const steps = [];
  const quiet = console.error, qwarn = console.warn;
  console.error = () => {}; console.warn = () => {};        // the panel's atlas and the char textures want a canvas
  // THE CHARACTERS, as the page fetches them (assets.js ASSET_FETCH: the bytes, gunzipped) - loaded BEFORE the build,
  // which is the state the page's crew settles in (a crew still waiting on one is G1985's pending crew, whose shape
  // the energy layer no longer keeps)
  W.requestAnimationFrame = () => 0; W.cancelAnimationFrame = () => {};   // the idle clip's ticker: no frames here
  W.ASSET_FETCH = W.ASSET_FETCH_FRESH = url => {
    try {
      let b = fs.readFileSync(path.join(ROOT, url));
      if (/\.gz\.bin$/.test(url)) b = zlib.gunzipSync(b);
      return Promise.resolve(new Uint8Array(b.buffer, b.byteOffset, b.byteLength));
    } catch (e) { return Promise.reject(e); }
  };
  const REG = vm.runInContext('typeof CHAR_REG !== "undefined" ? CHAR_REG : null', W);
  if (REG && W.CAGE_CHAR) await Promise.all(REG.order.map(k => W.CAGE_CHAR.load(k)));
  steps.push('chars ' + (REG ? REG.order.filter(k => W.CAGE_CHAR && W.CAGE_CHAR.ready(k)).length + '/' + REG.order.length : 'none'));

  // 1. garage.js loadSpec: `whole` (genNormaliseSpec), then rebuild - the aeroplane the editor's layers read
  //    (GARAGE_SPEC.resolved() is the built aeroplane's resolved spec, app.js)
  const clone = o => JSON.parse(JSON.stringify(o));
  let spec = C.genNormaliseSpec(clone(raw));
  let built = { key: null, spec: null };
  const resolvedNow = () => {
    const k = JSON.stringify(spec);
    if (built.key !== k) built = { key: k, spec: C.buildGen(clone(spec)).spec };
    return built.spec;
  };
  const STORE = {
    get: () => clone(spec),
    resolved: resolvedNow,
    // the join's door and the energy layer's (GARAGE_SPEC.update: genSpecMerge, then a rebuild)
    update: j => { spec = C.genSpecMerge(spec, clone(j)); steps.push('update ' + Object.keys(j).join(',')); },
  };
  W.CAGE_IN_GAME = true;
  // 2. _cage_ui.js applySpec: P from the spec, PAGE.load (a load is not a row change), the energy and panel layers
  //    seeded from the spec, one build of every layer
  const PAGE = W.CAGE_PAGE || (W.CAGE_PAGE = {});
  if (PAGE.load) try { PAGE.load(); } catch (e) {}
  if (W.CAGE_ENERGY && W.CAGE_ENERGY.fromSpec) W.CAGE_ENERGY.fromSpec(spec.energy);
  if (W.CAGE_PANEL && W.CAGE_PANEL.fromSpec) W.CAGE_PANEL.fromSpec(spec.systems);
  // THE FLOWN AEROPLANE'S CG, model frame (app.js publishes it as FLYDIY_CG_MODEL whenever it builds the aeroplane,
  // and the energy layer's balance job whenever it answers): the float layer stands its step 12 deg aft of it
  const cgModel = () => { const d = C.buildGen(clone(spec)); let cx = 0, cy = 0, mm = 0;
    for (const n of d.nodes) { cx += n.p[0] * n.m; cy += n.p[1] * n.m; mm += n.m; } return [cx / mm, cy / mm]; };
  W.FLYDIY_CG_MODEL = cgModel();
  const THREE = W.THREE;
  // _cage_ui.js build()'s rows written before the sheet: the aft section's copy of the front (mirror), the layers'
  // own coercions (PAGE.coerce), the hinge finish row (-1 = a build from before the row: the finish's own pick)
  const PREBUILD = P => {
    if (P.mirror && W.CAGE2.CAGE_AFT_SUB)
      for (const [ak, fk, thr] of W.CAGE2.CAGE_AFT_SUB) if (P[ak] != null && P[ak] < thr && P[fk] != null) P[ak] = P[fk];
    for (const f of (W.CAGE_PAGE.coerce || [])) try { f(P); } catch (e) {}
    if (P.hgFinish != null) {
      const ch = ((spec.finish || {}).sections || {}).ctlHinge;
      let hf = Math.round(+P.hgFinish);
      if (!(hf >= 0)) hf = ch == null ? 0 : ch === 'steelTube' ? 1 : 2;
      if (hf === 2 && ch == null) hf = 0;
      P.hgFinish = hf;
    }
  };
  let r = null, J = null;
  const buildAndJoin = () => {
    r = SH.sceneBuild(spec, { garage: STORE.get(), resolved: STORE.resolved, inGame: true, prebuild: PREBUILD });
    W.GARAGE_SPEC = STORE;                                // the energy layer's commit (a timer) writes through it
    // THE PAGE'S MOUNT HIERARCHY (tools/_bake_joined.js): the join's edMount() walks to the group whose grandparent
    // is the scene - two identity groups over the layers give it the page's answer
    const outer = new THREE.Group(), inner = new THREE.Group();
    for (const ch of r.scene.children.slice()) inner.add(ch);
    outer.add(inner); r.scene.add(outer); r.scene.updateMatrixWorld(true);
    // the editor's own measurement of its built sheet (_cage_ui.js build: CAGE2.cageGlazedM2, G1985)
    W.CAGE_UI = { P: r.P, glazedM2: W.CAGE2.cageGlazedM2(r.built.mesh, r.FS) };
    // 3. app.js BUILD_SYNC: the join's export, merged by GARAGE_SPEC.update
    W.CAGE_UI_LAZY = true;
    if (!W.CAGE_JOIN) vm.runInContext(fs.readFileSync(path.join(T, '_cage_join.js'), 'utf8'), W, { filename: '_cage_join.js' });
    J = W.CAGE_JOIN.export();
    STORE.update(J);
  };
  // ...with no datum from an aeroplane before this one (garage.js loadSpec clears it too, G1985): the float layer
  // takes the build's own row on the first round
  W.CAGE_DATUM = null;
  buildAndJoin();
  // 3b. THE SECOND ROUND (garage.js loadSpec, G1985): the aeroplane rebuilt from the join (app.js publishes its CG),
  // the editor built again - on its own wing (the engine layer hangs a wing mount's nacelles off the wing layer's last
  // wing: the chain draws the engine first) and its own datum (the float layer's step) - and the sync
  W.FLYDIY_CG_MODEL = cgModel();
  steps.push('build 2');
  buildAndJoin();
  // 3c. THE CG HANDSHAKE (G396, _cage_energy.js balanceApply): the balance job answers the CG of the aeroplane the
  // sync committed; a floatplane whose CG moved more than 2 cm from the one its step was stood on builds again (the
  // step follows the CG, the CG the step), and the next commit carries it
  for (let it = 0; it < 8 && +r.P.gearFloats > 0; it++) {
    const prev = W.FLYDIY_CG_MODEL, now = cgModel(), d = Math.hypot(now[0] - prev[0], now[1] - prev[1]);
    if (!(d > 0.02)) break;
    W.FLYDIY_CG_MODEL = now;
    steps.push('build ' + (it + 3) + ' (the CG moved ' + (100 * d).toFixed(1) + ' cm)');
    buildAndJoin();
  }
  // 4. the energy layer's write-back (commitLater, 120 ms after a layout that placed a tank for itself)
  await new Promise(res => setTimeout(res, 400));
  console.error = quiet; console.warn = qwarn;
  const out = { spec, errors: W.CAGE_JOIN.errors(), notes: W.CAGE_JOIN.notes(), sceneErrors: r.errors, steps };
  // (a diagnostic: FLYDIY_JOIN_PROBE=<file> runs that function body in the page context after the last build)
  if (process.env.FLYDIY_JOIN_PROBE) { W.__scene = r.scene; try { out.probe = vm.runInContext('(function(){' + fs.readFileSync(process.env.FLYDIY_JOIN_PROBE, 'utf8') + '})()', W); } catch (e) { out.probe = 'ERR ' + e.message; } }
  process.stdout.write('\u0001' + JSON.stringify(out));
  process.exit(0);
})().catch(e => { process.stderr.write(String(e && e.stack || e)); process.exit(1); });
