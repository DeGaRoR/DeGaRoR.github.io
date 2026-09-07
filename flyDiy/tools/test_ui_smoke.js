// Gate: the built artifact's UI block actually RUNS (not just parses).
// Catches unresolved identifiers, wrong call signatures, bad wiring —
// the class of bug node --check cannot see (e.g. the MODEL_OFF regression).
// Stubs: minimal DOM + THREE. The vendor (three.min.js) and render_world
// blocks are NOT executed — buildWorldScene is stubbed so the gate stays
// focused on core + models + app wiring. Runs setAircraft, the full loop
// path (script/sync/poseModel/hud) for 120 frames, then every button
// handler and the aircraft-change door (selAc, the garage build — the fleet
// keys it used to switch through retired with the fiches, 2026-09-05).
const fs = require('fs'), vm = require('vm'), path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const pick = (marker, label) => {
  const b = blocks.find(x => x.includes(marker));
  if (!b) { console.log(`missing ${label} block (no "${marker}")`); console.log('GATE UISMOKE: FAIL'); process.exit(1); }
  return b;
};
const coreBlock = pick('function makeAutopilot', 'core');
// Model and prop payloads are <script src> refs since the multi-file artifact
// (2026-09-01), not inline blocks. The gate still tests the ARTIFACT: it first
// asserts the artifact references every published payload, then executes
// exactly those files — the same set the served page would fetch. (Before
// this, `pick('const MODEL_PA18')` quietly executed ONE payload: each rode in
// its own <script> block and only pa18's was ever found.)
const { MANIFEST } = require('./build.js');
const payloadFiles = MANIFEST.models.map(f => ['src/models', f])
  .concat(MANIFEST.props.map(f => ['src/props', f]));
for (const [sub, f] of payloadFiles)
  if (!html.includes(`src="${sub}/${f}?v=`)) {
    console.log(`artifact does not reference ${sub}/${f} — the publish list and the page disagree`);
    console.log('GATE UISMOKE: FAIL'); process.exit(1);
  }
const modelsBlock = payloadFiles.map(([sub, f]) =>
  fs.readFileSync(path.join(__dirname, '..', sub, f), 'utf8')).join('\n');
const appBlock = pick('function setAircraft', 'app');

// ---- THE PANELS ARE PLACEABLE AND THEIR CONTROLS STILL PRESS (2026-09-04) --
// Chrome 148 retargets pointerup and the click after it to whatever element
// holds POINTER CAPTURE. flPlace used to capture on pointerdown, so every
// press on a ribbon button, the PFD's fold or the map's canvas became a click
// on the panel and the flight's left bar went dead with no error. The rule:
// the pointerdown handler takes no capture; the drag does, once the 4 px
// threshold has made it a drag. Pinned on the artifact's own text.
{
  const i0 = appBlock.indexOf('function flPlace(');
  const i1 = appBlock.indexOf('THE CROSSHAIR', i0);
  if (i0 < 0 || i1 < 0) throw new Error('flPlace is not where the rail expects it');
  const fp = appBlock.slice(i0, i1);
  const down = fp.slice(fp.indexOf('const down = kind =>'), fp.indexOf('if (handle) handle.addEventListener'));
  const move = fp.slice(fp.indexOf("addEventListener('pointermove'"), fp.indexOf("const up = e =>"));
  if (!down.length || !move.length) throw new Error('flPlace lost its down/move shape');
  if (/setPointerCapture\(e\.pointerId\)/.test(down))
    throw new Error('flPlace captures the pointer on pointerdown — the click after it lands on the panel, not the button');
  if (!/setPointerCapture|grab\(e\)/.test(move))
    throw new Error('flPlace never captures the pointer once dragging — a fast drag drops the panel');
}
// ...AND `hidden` HIDES THE TRACE. `#ui #telp` (two ids) sets display:flex,
// so the hide rule must carry two ids too, or the trace shows with `hidden`
// set — which is what "the trace cannot be hidden any more" was.
if (!html.includes('#ui #telp[hidden]'))
  throw new Error('flight.css: #telp[hidden] needs #ui in front of it, or #ui #telp{display:flex} wins');
// ...AND THE CONTROLS PANEL CLOSES (G200): #ctlPanel is a third top-level
// host with its own sheet, and its hide rule has to be in the artifact
if (!html.includes('#ctlPanel[hidden]'))
  throw new Error('controls.css: #ctlPanel[hidden] is missing — the mapping panel could not be closed');

// ---- THREE stub: chainable no-ops with just enough shape ----
function mkObj() {
  const o = {
    position: vec(), rotation: vec(), scale: vec(), children: [],
    // control surfaces turn as rigid meshes (G4.4), so a mesh needs one
    quaternion: { setFromAxisAngle() { return this; } },
    matrix: { copy: () => {}, },
    visible: true, frustumCulled: true, matrixAutoUpdate: true,
    add(c) { this.children.push(c); return this; },
    remove() {}, traverse(f) { f(o); this.children.forEach(c => f(c)); },
    lookAt() {},
  };
  return o;
}
function vec(x = 0, y = 0, z = 0) {
  return { x, y, z,
    set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; },
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; },
    crossVectors(a, b) {
      this.x = a.y*b.z - a.z*b.y; this.y = a.z*b.x - a.x*b.z; this.z = a.x*b.y - a.y*b.x;
      return this; } };
}
class BufferAttribute {
  constructor(arr, sz) { this.array = arr; this.itemSize = sz; this.needsUpdate = false; }
}
class BufferGeometry {
  constructor() { this.attributes = {}; }
  setAttribute(n, a) { this.attributes[n] = a; return this; }
  setIndex(a) { this.index = a; return this; }
  computeVertexNormals() {}
  rotateX() { return this; } translate() { return this; } dispose() {}
  setPosition() {}
  get parameters() { return {}; }
}
const geoLike = () => new BufferGeometry();
const THREE = {
  WebGLRenderer: class { constructor(){ this.shadowMap = {}; }
                         setPixelRatio() {} setSize() {} render() {} },
  Scene: class { constructor(){ this.children=[]; } add(){} remove(){} },
  Color: class { constructor(){} setHex(){return this;} lerp(){return this;} get r(){return 0;} get g(){return 0;} get b(){return 0;} },
  Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
  // G79: the editor's click-to-select throws a ray into the build. Here there
  // is no build and no camera worth the name, so the ray hits nothing — which
  // is the honest stub: it proves the wiring is constructed and reached, and
  // claims nothing about what a ray would find.
  Raycaster: class { setFromCamera() {} intersectObject() { return []; } },
  Fog: class {},
  // A CAMERA HAS AN `up`. It never did here, and nothing asked until the
  // flight rebaseline gave the flight a camera: `level horizon`, off, rolls
  // the eye with the aeroplane, and that is written onto camera.up.
  PerspectiveCamera: class { constructor(){ this.position = vec(); this.up = vec(0, 1, 0);
    this.fov = 46; } lookAt(){} updateProjectionMatrix(){} },
  Vector3: function(...a) { return vec(...a); },
  Matrix4: class { makeBasis(){ return this; } setPosition(){ return this; }
                   makeScale(){ return this; } copy(){ return this; } },
  PlaneGeometry: class extends BufferGeometry {
    constructor(w, h, sx = 1, sy = 1) {
      super();
      const n = (sx + 1) * (sy + 1), pos = new Float32Array(n * 3);
      this.attributes.position = Object.assign(new BufferAttribute(pos, 3), {
        count: n, getX: i => 0, getZ: i => 0, setY: () => {} });
    }
    setAttribute(n, a) { this.attributes[n] = a; return this; }
  },
  ConeGeometry: class extends BufferGeometry {},
  BoxGeometry: class extends BufferGeometry {},
  CylinderGeometry: class extends BufferGeometry {},
  Float32BufferAttribute: BufferAttribute,
  BufferAttribute,
  BufferGeometry,
  Mesh: class { constructor(g, m){ Object.assign(this, mkObj()); this.geometry = g || geoLike(); this.material = m; } },
  Group: class { constructor(){ Object.assign(this, mkObj()); } },
  LineSegments: class { constructor(g){ Object.assign(this, mkObj()); this.geometry = g; } },
  Points: class { constructor(g){ Object.assign(this, mkObj()); this.geometry = g; } },
  InstancedMesh: class { constructor(){ Object.assign(this, mkObj());
    this.instanceMatrix = { needsUpdate: false }; this.instanceColor = null; }
    setMatrixAt() {} setColorAt() {} },
  MeshLambertMaterial: class {}, MeshBasicMaterial: class {},
  // W18: the skin is PBR now. The stub takes the parameter object so the
  // roughness/metalness table is at least executed on the real material names.
  MeshStandardMaterial: class { constructor(o) { Object.assign(this, o); } },
  LineBasicMaterial: class {}, PointsMaterial: class {},
  HemisphereLight: class { constructor(){ Object.assign(this, mkObj()); } },
  // the studio's key light casts, so it carries a shadow camera the viewer
  // sizes to an aeroplane rather than to a world
  DirectionalLight: class { constructor(){ Object.assign(this, mkObj());
    this.castShadow = false;
    this.shadow = { mapSize: { set() {} }, camera: {} }; } },
  // the studio floor is a shadow catcher, and its dome is what the environment
  // is baked from. PMREMGenerator is deliberately ABSENT: app.js guards on it,
  // so leaving it out exercises the no-environment path headlessly.
  ShadowMaterial: class { constructor(o) { Object.assign(this, o || {}); } },
  SphereGeometry: class extends BufferGeometry {},
  BackSide: 1,
  // onLoad fires synchronously so the skin's texture-decode gate is exercised:
  // if it ever stops firing, the aircraft stays a wireframe forever
  TextureLoader: class { load(url, onLoad) { const t = { anisotropy: 0 };
    if (onLoad) onLoad(t); return t; } },
  // the garage's CG/NP labels are canvas sprites (G3.5b)
  CanvasTexture: class { constructor(c) { this.image = c; this.encoding = 0; }
    dispose() {} },
  SpriteMaterial: class { constructor(o) { Object.assign(this, o || {}); }
    dispose() {} },
  Sprite: class { constructor(m) { this.material = m; this.scale = { set() {} };
    this.position = { set() {} }; this.renderOrder = 0; } },
  DoubleSide: 2,
  sRGBEncoding: 0, ACESFilmicToneMapping: 0, PCFSoftShadowMap: 0,
};

// ---- DOM stub ----
const handlers = {};
function el(id) {
  return {
    id,
    // A REAL `style` (the third fold). It was `{}`, which is fine for
    // `style.display = 'none'` and not for the custom properties the workshop
    // lays itself out with — the panel reports its width and body carries it
    // as `--ws-right`, and a stub with no setProperty cannot see that happen.
    style: (() => {
      const v = {};
      return { setProperty: (k, x) => { v[k] = x; },
               getPropertyValue: k => v[k] || '',
               removeProperty: k => { delete v[k]; } };
    })(),
    textContent: '', innerHTML: '', title: '', className: '',
    // A REAL classList (G86). It was three no-ops and a `false`, which was
    // fine while nothing the gate cared about was expressed as a class — and
    // then the WORKSHOP/FLIGHT mode became exactly that. A stub that always
    // answers "no" cannot tell a mode switch from a mode that never happened.
    classList: (() => {
      const set = new Set();
      return {
        add: (...c) => c.forEach(x => set.add(x)),
        remove: (...c) => c.forEach(x => set.delete(x)),
        contains: c => set.has(c),
        toggle: (c, on) => {
          const want = on === undefined ? !set.has(c) : !!on;
          if (want) set.add(c); else set.delete(c);
          return want;
        },
        get length() { return set.size; },
        toString: () => [...set].join(' '),
      };
    })(),
    addEventListener() {}, setPointerCapture() {}, appendChild() {},
    // A DOCUMENT HAS A TREE, AND A CONTROL HAS A VALUE (the flight
    // rebaseline). The flight layer builds its rail and its flyouts by
    // walking one and reading the other — a stub that answers neither does
    // not test a narrower app, it tests a different one. Same argument the
    // `body`, `style` and `classList` folds above each make in turn; each of
    // them was added the first time the real UI needed the real thing.
    // querySelector answers with an ELEMENT, not with null: the rail writes
    // its label into the span it just put into its own innerHTML, and a stub
    // that says "no such child" of markup it was handed a moment ago is
    // modelling a document that forgets.
    querySelector: () => el(id + ' >'), querySelectorAll: () => [],
    closest: () => null,
    children: [], childNodes: [], firstChild: null,
    parentElement: null, nextSibling: null,
    removeChild() {}, insertBefore() {}, remove() {},
    dataset: {}, options: [], selectedIndex: -1, checked: false,
    hidden: false, disabled: false, type: '', value: '',
    offsetWidth: 0, offsetHeight: 0,
    getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0,
                                    width: 0, height: 0 }),
    getContext: () => new Proxy({}, { get: () => () => {} }),
    width: 460, height: 180,
    set onclick(f) { handlers[id] = f; }, get onclick() { return handlers[id]; },
    set onchange(f) { handlers[id] = f; }, get onchange() { return handlers[id]; },
  };
}
const els = {};
let ceN = 0;
let rafCb = null, rafCount = 0;
const sandbox = {
  console, window: { innerWidth: 390, innerHeight: 800, devicePixelRatio: 2,
                     addEventListener() {} },
  // A DOCUMENT HAS A BODY. It never did here, and app.js never asked — until
  // G77.1 put the editor's width classes on it, because the CANVAS has to move
  // with the panel and the canvas is not inside #ui. A stub that is missing a
  // thing every real document has does not test a narrower app, it tests a
  // different one.
  document: { getElementById: id => (els[id] = els[id] || el(id)),
              createElement: () => el('_ce' + (++ceN)),
              querySelector: () => null, querySelectorAll: () => [],
              get body() { return (els.__body = els.__body || el('body')); } },
  requestAnimationFrame: cb => { rafCb = cb; rafCount++; },
  // timers fire immediately: the point of this gate is to EXECUTE the deferred
  // path (the boot-splash teardown), not to model the event loop
  setTimeout: cb => { cb(); return 0; },
  clearTimeout() {},
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  THREE, Buffer,
  // The RENDER block (garage.js) is deliberately not executed here, so
  // `garageInit` would be undefined and app.js would skip the whole GARAGE
  // BRIDGE. Stubbing it captures the api object instead, which both keeps the
  // bridge on the executed path and lets this gate drive the load test the way
  // the panel does. If the bridge's shape ever changes, this notices.
  garageInit: api => { sandbox.garageApi = api; },
  // ...and the ENGINEERING BENCH bridge the same way (G64). src/viewer/bench.js
  // is not in the executed block either, so capturing the api is what keeps
  // app.js's benchInit call on the executed path AND lets this gate drive a
  // live test the way the bench does. If the bridge's shape changes, this
  // notices.
  benchInit: api => { sandbox.benchApi = api; },
  // ...and THE EDITOR PANEL bridge (G77), for the same reason: src/viewer/
  // editor.js is in the RENDER block, which is not executed here, so without
  // this stub app.js would skip the whole editorInit call and the bridge would
  // never be on the executed path at all.
  editorInit: api => { sandbox.editorApi = api; },
};
sandbox.window.document = sandbox.document;
// THE GEOMETRY IS EXTERNAL (2026-09-01): payloads name .bin files under
// media/geo/ and the app fetches them through window.ASSET_FETCH. The
// browser's lives in src/viewer/assets.js (RENDER block, not executed here);
// this harness answers the same contract with fs, so the aircraft switches
// below exercise the real decode+skin path against the same bytes the page
// would fetch.
sandbox.window.ASSET_FETCH = url => {
  try {
    return Promise.resolve(new Uint8Array(fs.readFileSync(
      path.join(__dirname, '..', ...url.split('?')[0].split('/')))));
  } catch (e) { return Promise.reject(e); }
};
vm.createContext(sandbox);

const frames = n => { for (let i = 0; i < n && rafCb; i++) { const cb = rafCb; rafCb = null; cb(); } };
(async () => {
try {
  vm.runInContext(coreBlock, sandbox, { filename: 'core.js' });      // physics + codec
  vm.runInContext(modelsBlock, sandbox, { filename: 'models.js' });  // baked payloads
  // MANUAL CONTROLS (G200): src/viewer/input.js rides in the RENDER block,
  // which is not executed here — so it is run from its own source, or app.js
  // would make no instance and the manual branch of script() would never be
  // on the smoked path. There is no navigator and no localStorage in this
  // sandbox, and the model has to live with both absent.
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'input.js'), 'utf8'),
                  sandbox, { filename: 'input.js' });
  // THE PLAQUE'S SHEET AND THE STICKERS (G208) ride the RENDER block too:
  // app.js's drawPlaque builds its rows through window.PLAQUE, and the decal
  // list app.js applies asks window.AERO_EXTRA_DECALS for the certification
  // strip — so both run from their own source, or the plaque would throw
  // before its first row.
  for (const f of ['plaque.js', 'stickers.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', f), 'utf8'),
                    sandbox, { filename: f });
  // render_world is not executed; the app only needs its factory's return shape
  sandbox.buildWorldScene = () => ({ worldUpdate() {} });
  vm.runInContext(appBlock, sandbox, { filename: 'app.js' });        // UI (runs setAircraft)
  if (!handlers['bSkin']) throw new Error('bSkin not wired');
  // drive the loop: HOLDING frames, then press Fly and run 2 s of circuit
  frames(30);
  handlers['bGo'] && handlers['bGo']();
  frames(120);
  // ---- THE PILOT IS YOU (G200) ----
  // Hand the aeroplane over, hold a key, read the elevator, hand it back.
  // The probe is the door the capture rig uses; the same three handles here.
  {
    const P = sandbox.window.FLIGHT_PROBE;
    if (!P || typeof P.setManual !== 'function') throw new Error('FLIGHT_PROBE has no setManual (G200)');
    P.setManual(true);
    if (!P.manual()) throw new Error('setManual(true) did not take');
    P.input().press('ArrowDown', true);
    frames(60);
    if (!(P.sim().ctl.de > 0.5))
      throw new Error('a held ArrowDown did not reach sim.ctl.de under manual (' + P.sim().ctl.de + ')');
    P.input().press('ArrowDown', false);
    frames(30);
    P.setManual(false);
    frames(60);
    if (P.manual()) throw new Error('setManual(false) did not take');
    if (typeof P.ap().phase !== 'string') throw new Error('the AP came back with no phase');
    console.log('manual controls: a key flew it, the AP took it back in ' + P.ap().phase);
  }
  // exercise every wired button (Skin cycles all 3 states)
  // bEdit is the editor door the shelf's move left behind (G63): CAGE_UI_BOOT
  // does not exist in this sandbox, so what it proves is the WIRING — that the
  // handler is on the button and returns cleanly with no editor to open.
  // #bTel went with the bottom bar (the trace is a rail flyout now); #bSkin
  // is still wired and still owns the covering cycle — it simply lives in
  // #flStore and is pressed by the `camera` flyout's pills.
  for (const id of ['bSkin', 'bSkin', 'bSkin', 'bPause', 'bPause',
                    'bEdit', 'bReset'])
    handlers[id] && handlers[id]({ target: els[id] });
  // ---- THE GARAGE (G3.2): selecting the generated build stops the solver ----
  // The observable is the phase rail. script() is what writes HOLDING there,
  // and in the garage script() must not run at all — so if the `!inGarage`
  // guard in the loop is ever lost, this reads HOLDING instead of GARAGE.
  // Physics off while building is the whole point of the phase; a silent
  // regression would mean a slider drag throws away your aeroplane again.
  handlers['selAc']({ target: { value: 'gen' } });
  if (els['phName'].textContent !== 'GARAGE')
    throw new Error(`selecting the garage build did not enter it (${els['phName'].textContent})`);
  frames(240);
  if (els['phName'].textContent !== 'GARAGE')
    throw new Error('the solver stepped in the garage: the loop guard is gone');
  // ---- THE LOAD TEST (BUILD -> LOAD TEST -> FLY) ----
  // The rig is the one thing that moves while the aeroplane is on the stand, so
  // it needs the opposite assertion to the one above: frames must now CHANGE
  // the aeroplane. Driven through the same GARAGE_SPEC surface the panel uses.
  {
    const G = sandbox.garageApi;
    if (!G) throw new Error('the garage bridge was never called');
    if (!G.loadTest) throw new Error('garage bridge has no loadTest');
    if (G.tested()) throw new Error('a freshly built aeroplane must start untested');
    G.loadTest();
    if (els['phName'].textContent !== 'LOAD TEST')
      throw new Error(`load test did not take the rail (${els['phName'].textContent})`);
    let st = G.loadTestState();
    if (!st) throw new Error('load test produced no state');
    for (let i = 0; i < 60 && !G.loadTestState().done; i++) frames(60);
    st = G.loadTestState();
    if (!st.done) throw new Error('load test never finished');
    if (!(st.ultPct > 0)) throw new Error(`no deflection at ultimate (${st.ultPct})`);
    if (!(st.limitPct > 0) || !(st.ultPct > st.limitPct))
      throw new Error(`deflection did not grow with load (${st.limitPct} -> ${st.ultPct})`);
    if (!G.tested()) throw new Error('a finished load test must mark the build tested');
    if (G.markTested) throw new Error('the panel must not write model state');
    console.log(`load test: ${st.verdict} — limit ${st.limitPct.toFixed(2)}% ` +
                `ultimate ${st.ultPct.toFixed(2)}% of semispan`);
    G.endLoadTest();
    if (els['phName'].textContent !== 'GARAGE')
      throw new Error('leaving the load test did not return to the garage');
  }

  // ---- THE ENGINEERING BENCH (G64) ----
  // The bench drives the same rig through its own bridge, so what is asserted
  // here is the BRIDGE: the four calls a live test makes, plus the two the
  // instant test makes, plus the plaque switch that decides whether a build
  // has a certificate at all. The plaque is the one with a real trap in it —
  // it used to post itself on entering the garage, and a regression that
  // brought that back would hand every untested aeroplane a certificate.
  {
    const B = sandbox.benchApi;
    if (!B) throw new Error('the bench bridge was never called');
    for (const k of ['shake', 'densAlt', 'plaque', 'showPhysical', 'loadTest',
                     'loadTestState', 'endLoadTest'])
      if (typeof B[k] !== 'function') throw new Error(`bench bridge has no ${k}`);
    // the plaque is EARNED: off until a test says otherwise, and off again
    // the moment the bench withdraws it
    B.plaque(false);
    if (els['plaque'].classList.contains('on'))
      throw new Error('an untested build must not carry a plaque');
    const sh = B.shake();
    if (!sh || !isFinite(sh.mass))
      throw new Error('the bench check measured nothing');
    B.plaque(true);
    if (!els['pqVerdict'].textContent)
      throw new Error('the plaque posted no verdict');
    console.log(`bench check: ${sh.flyableCircuit ? 'FLIES A CIRCUIT' :
      'WILL NOT FLY A CIRCUIT'} — ${sh.mass.toFixed(0)} kg, climb ` +
      `${sh.climbRate.toFixed(2)} m/s, take-off ${sh.TORun.toFixed(0)} m`);
    // THE DENSITY-ALTITUDE TEST (G72) and the plaque section it earns. The
    // section must NOT be on the plaque before its own test has run — it is a
    // measurement of this aeroplane, and the plaque's whole rule is that a
    // certificate you get for free is not one.
    B.plaque(true);
    if (/thin air/i.test(els['pqRows'].innerHTML))
      throw new Error('the thin-air rows appeared before the test that fills them');
    const da = B.densAlt();
    if (!da || !da.cases || da.cases.length < 2)
      throw new Error('the density-altitude test measured nothing');
    const hot = da.cases.filter(c => c.id === 'hot')[0];
    if (!(hot.densAlt > 1000) || !(hot.TORun > 0) || !isFinite(hot.climbRate))
      throw new Error(`the hot-and-high case is not a measurement ` +
                      `(DA ${hot.densAlt}, run ${hot.TORun}, climb ${hot.climbRate})`);
    if (!(hot.TORun > da.cases.filter(c => c.id === 'isa')[0].TORun))
      throw new Error('thin air did not lengthen the take-off run');
    B.plaque(true);
    if (!/thin air/i.test(els['pqRows'].innerHTML))
      throw new Error('the plaque did not grow its thin-air section');
    console.log(`bench density altitude: DA ${hot.densAlt.toFixed(0)} m — ` +
      `${hot.TORun.toFixed(0)} m take-off, ${hot.climbRate.toFixed(2)} m/s climb on ` +
      `${(hot.power * 100).toFixed(0)}% power, service ceiling ` +
      `${da.serviceCeiling == null ? '> ' + da.ceilingCap : da.serviceCeiling.toFixed(0)} m`);
    // THE CROSSWIND LIMIT (G193.2) rides the test flight's report and the
    // plaque prints it in the test-flight section — with the roll and the
    // lift-off heading beside it, and the row's own bound. Restored the way
    // a saved certificate comes back, so the round trip is the thing tested.
    B.restoreSheets({ flight: { t: 300, report: {
      outcome: 'completed', verdicts: [],
      landing: { run: 152, sink: 0.8, V: 20, offCentre: 0.1, pastAim: 10 },
      xwind: { limit: 2, cap: 10, band: 12.5, roll: 10.11, e: 0.227, runs: [] } } } });
    B.plaque(true);
    {
      const h = els['pqRows'].innerHTML;
      if (!/crosswind limit/.test(h))
        throw new Error('the plaque did not print the crosswind limit');
      if (!/2\.0 m\/s/.test(h) || !/roll 10\.1 m/.test(h) || !/13\u00b0 off/.test(h))
        throw new Error('the crosswind row does not carry its limit, roll and heading: ' +
                        (h.match(/crosswind limit[^<]*<[^>]*>[^<]*/) || [''])[0]);
      if (!/\u2265 4 m\/s/.test(h))
        throw new Error('the crosswind row does not print its bound');
    }
    B.restoreSheets({ flight: { t: 300, report: {
      outcome: 'completed', verdicts: [],
      landing: { run: 152, sink: 0.8, V: 20, offCentre: 0.1, pastAim: 10 },
      xwind: { limit: null, cap: 10, band: 12.5, roll: 3.2, e: 0.02, runs: [] } } } });
    B.plaque(true);
    if (!/&gt; 10 m\/s|> 10 m\/s/.test(els['pqRows'].innerHTML))
      throw new Error('a limit above the cap does not print as "> cap"');
    console.log('bench crosswind limit: the plaque row reads 2.0 m/s · roll 10.1 m · 13° off, and "> 10 m/s" above the cap');
    // the live test, through the bench's own calls
    B.showPhysical(true);
    B.loadTest();
    for (let i = 0; i < 60 && !B.loadTestState().done; i++) frames(60);
    const ls = B.loadTestState();
    if (!ls.done) throw new Error('the bench never finished the wing loading');
    if (!(ls.ultPct > ls.limitPct) || !(ls.limitPct > 0))
      throw new Error(`bench wing loading did not grow with load ` +
                      `(${ls.limitPct} -> ${ls.ultPct})`);
    console.log(`bench wing loading: ${ls.verdict} — limit ` +
      `${ls.limitPct.toFixed(2)}% ultimate ${ls.ultPct.toFixed(2)}% of semispan`);
    B.endLoadTest();
    B.showPhysical(false);
    B.plaque(false);
    if (els['plaque'].classList.contains('on'))
      throw new Error('withdrawing the plaque left it on screen');
  }

  // ---- ONE ROOM (G65) ----
  // `build & fly` is retired: the export is a STEP inside rolling out and
  // inside running a test, not a third button between them. If it ever comes
  // back as a button, the intermediate stop comes back with it.
  if (handlers['edFly'])
    throw new Error('build & fly came back — the middle step is back with it');
  if (typeof sandbox.window.BUILD_SYNC !== 'function')
    throw new Error('rolling out has no way to commit the editor');
  // ROLL OUT READS THE CERTIFICATE and is NEVER locked. The label is the whole
  // mechanism: a locked button would be the game refusing to let you build a
  // bad aeroplane, which is the one thing the roadmap says it must not do.
  {
    const say = () => els['bGo'].textContent;
    sandbox.window.BENCH_STATE = () => ({ any: false, passed: false });
    sandbox.window.BENCH_CHANGED();
    if (say() !== 'Roll out untested')
      throw new Error(`untested build did not say so ("${say()}")`);
    if (els['bGo'].disabled)
      throw new Error('roll out must never be locked');
    sandbox.window.BENCH_STATE = () => ({ any: true, passed: true });
    sandbox.window.BENCH_CHANGED();
    if (say() !== 'Roll out & fly')
      throw new Error(`a passed build still read untested ("${say()}")`);
    console.log('roll out reads the certificate, and is never locked');
  }

  // ---- TWO INTERFACES (G86) ----
  // The mode is the whole chantier, so the mode is what is asserted: the
  // garage must be in WORKSHOP and rolling out must put it back in FLIGHT.
  // Before G86 this was a dozen rules each hiding one thing, and the one
  // nobody wrote was `#card` — which is why the old aircraft card was
  // rendering underneath the new name chip.
  {
    const cls = sandbox.document.body.classList;
    if (!cls.contains('mode-ws'))
      throw new Error(`the garage is not in workshop mode (${cls})`);
    if (cls.contains('mode-fly'))
      throw new Error('the garage is in both modes at once');
    console.log('mode: workshop in the garage');
  }

  // ---- THE EDITOR PANEL (G77) ----
  // The bridge, and the one thing it is for: the panel says how wide it has
  // become and the game's HUD moves over. If the width call ever stops
  // arriving, the bottom bar's right-hand end goes back under an opaque
  // 640 px panel and nothing on screen says why.
  {
    const E = sandbox.editorApi;
    if (!E) throw new Error('the editor panel bridge was never called');
    for (const k of ['panelWidth', 'isGen', 'inGarage'])
      if (typeof E[k] !== 'function') throw new Error(`editor bridge has no ${k}`);
    // the width the panel reports has to arrive as the inset the render is
    // laid out against — that chain is what keeps the aeroplane centred in
    // what you can actually see (G77.1), and it is one call long
    const b = sandbox.document.body;
    E.panelWidth(92);
    if (b.style.getPropertyValue('--ws-right') !== '92px')
      throw new Error(`the panel's width did not reach the render's inset ` +
        `(${b.style.getPropertyValue('--ws-right')})`);
    E.panelWidth(640);
    if (b.style.getPropertyValue('--ws-right') !== '640px')
      throw new Error('the inset did not follow the panel back');
    console.log('editor panel bridge wired; width reaches the inset');
  }

  // ...and ROLL OUT commits it: physics back on, autopilot flying the circuit
  handlers['bGo']();
  frames(240);
  if (els['phName'].textContent === 'GARAGE')
    throw new Error('roll out did not leave the garage');
  {
    const cls = sandbox.document.body.classList;
    if (!cls.contains('mode-fly') || cls.contains('mode-ws'))
      throw new Error(`roll out did not switch the interface (${cls})`);
  }
  console.log(`garage -> roll out -> ${els['phName'].textContent}, mode: flight`);

  // ---- THE SEAM (G86), asserted on the built artifact's own markup --------
  // The two interfaces are two CONTAINERS, and the value of that is entirely
  // in nothing straddling them. Checked here rather than in a gate of its own
  // because this is where the UI is already exercised, and checked against the
  // ARTIFACT rather than against src/ because the artifact is what ships.
  {
    const body = html.slice(html.indexOf('<canvas id="c">'));
    const iUI = body.indexOf('<div id="ui">');
    const iWS = body.indexOf('<section id="wsUI"');
    if (iUI < 0 || iWS < 0) throw new Error('the two interface layers are not both there');
    if (iWS < iUI) throw new Error('#wsUI is not after #ui — the seam is inside out');
    // THE FLIGHT LAYER, REBASELINED (the flight-interface handoff). Four
    // surfaces and nothing in two of them: the top bar (#flTop — the brief
    // #flPlate, its folded line #flLine, the notice #flNotice and the verbs
    // #flActs), the look rail (#flRail + #flFly), the PFD (#pfd, with the
    // phase rail #rail inside it) and the summoned panels (#mmp, #telp,
    // #arrCard). #flStore holds the selects the plate is a view over, which
    // is the whole reason this redesign added no second source of truth.
    const flight = ['flStore', 'selAc', 'flTop', 'flPlate', 'flSlots',
                    'flLine', 'flNotice', 'flActs', 'bGo', 'bHangar2',
                    'flRail', 'flFly', 'pfd', 'rail', 'phName', 'phNext', 'track',
                    'telp', 'mmp',
                    // the ARRIVAL CARD — the flight's ending is flight chrome
                    // by definition, and its two buttons belong to the FLIGHT
                    // (the ways out of the SCREEN are the top row's verbs)
                    'arrCard', 'bLog', 'bWhy'];
    const workshop = ['edWrap', 'edView', 'edInfo',
                      'edTree', 'edRows', 'edRail', 'plaque', 'edBench',
                      'edShelf', 'edViewTabs', 'edTabShape', 'edTabFinish',
                      // 2026-08-31: the THIRD view (the design tiles), and
                      // the chrome re-cut around the FILE RIBBON — the shelf
                      // rides #edTopBar now, the look rail sits in #edBotBar,
                      // ROLL OUT is its own floating action, and the ribbon
                      // carries the build's name (#fbName) and the birth
                      // flow's door (#gNew).
                      'edTabDesign', 'edTopBar', 'edBotBar', 'edActs',
                      'edRoll', 'fbName', 'gNew',
                      // THE ABOUT LINE. `#credit` rode the flight bar until
                      // the flight rebaseline; it is a credit, not a HUD
                      // element, and CC-BY's requirement is VISIBLE
                      // attribution — so it lives in the information panel,
                      // which is on screen for as long as you are building.
                      // It is asserted on BOTH sides on purpose: that it is
                      // still in the artifact at all is the licence term.
                      'credit'];
    // ...AND WHAT WAS RETIRED STAYS RETIRED. Each of these was a SECOND door
    // to a room that already had one, which is the failure this screen keeps
    // having: `edVerbs` put the two actions in the opposite corner from the
    // rail, `edRunBench` scrolled to and pressed a button already on screen in
    // the information panel, and `edPropFoot` held two controls that act on
    // the selection at the far end of a scroll from the name of it. An id that
    // comes back is a door that came back.
    const retired = ['edVerbs', 'edRunBench', 'edPropFoot',
                     // G108: the shed is a tree ROOT, so its sheet, the sheet's
                     // body and the scrim that dimmed the view behind it all
                     // go. UI-MODEL section 2.4 reserves one sheet for the
                     // FLEET RACK and that chantier writes its own.
                     'edShed', 'shedBody', 'edScrim',
                     // 2026-08-31: SAVE lives on the file ribbon (#gSave, the
                     // shelf's one handler); a second save verb was a second
                     // thing that could disagree about what save means.
                     'edSave',
                     // G135: #edStand borrowed the game's aircraft select to
                     // ask WHICH AEROPLANE. The seven hand fiches are gate
                     // subjects and the select holds one hidden option now,
                     // so the section was dressing an empty box. The FLEET
                     // RACK answers that question next, over YOUR builds.
                     'edStand', 'shAc',
                     // THE FLIGHT REBASELINE'S OWN RETIREMENTS. `card` was the
                     // aircraft card and `brand` the game's name printed over
                     // its own render; `bottom` was one wrapping row of eight
                     // controls; `bTel` opened a panel the rail now summons;
                     // `hint` was permanent chrome for a sentence you read
                     // once (it is #flHint, shown on the first flight only);
                     // `grid` and `legend`'s twelve cells became three PFD
                     // readouts, six instrument toggles and two rows in `air`;
                     // `bAgain`/`bHangar` were the old card's ways out of the
                     // SCREEN, and the top row's verbs are that now.
                     'card', 'brand', 'bottom', 'bTel', 'hint', 'grid',
                     'bAgain', 'bHangar'];
    for (const id of flight) {
      const at = body.indexOf(`id="${id}"`);
      if (at < 0) throw new Error(`flight chrome missing: ${id}`);
      if (at > iWS) throw new Error(`${id} is FLIGHT chrome sitting inside the workshop layer`);
    }
    for (const id of workshop) {
      const at = body.indexOf(`id="${id}"`);
      if (at < 0) throw new Error(`workshop chrome missing: ${id}`);
      if (at < iWS) throw new Error(`${id} is WORKSHOP chrome sitting outside its layer`);
    }
    // ---- AND THE LAYER'S TAGS BALANCE ---------------------------------
    // A missing `</div>` does not throw, does not warn, and does not show up
    // in any gate that reads ids: the browser simply nests everything after it
    // inside the element that never closed. Measured, the hard way — one lost
    // close tag on #flFly put the map and the trace inside a hidden flyout,
    // and every id assertion above still passed. The parser is deliberately
    // crude (this is generated markup, not the web) and its only job is to say
    // that what opens, closes, in order.
    {
      const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link',
                            'path', 'option', 'source', 'use']);
      const layer = body.slice(iUI, iWS).replace(/<!--[\s\S]*?-->/g, '');
      const stack = [];
      const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*?(\/?)>/g;
      let m;
      while ((m = re.exec(layer))) {
        const tag = m[2].toLowerCase();
        if (VOID.has(tag) || m[3]) continue;
        if (m[1]) {
          if (!stack.length || stack[stack.length - 1] !== tag)
            throw new Error(`#ui markup: </${tag}> closes ` +
              `${stack.length ? '<' + stack[stack.length - 1] + '>' : 'nothing'}`);
          stack.pop();
        } else stack.push(tag);
      }
      if (stack.length)
        throw new Error(`#ui markup: ${stack.length} unclosed tag(s), ` +
          `outermost <${stack[0]}> — everything after it is nested inside it`);
    }

    for (const id of retired)
      if (body.indexOf(`id="${id}"`) >= 0)
        throw new Error(`retired chrome is back: ${id} (G107 removed it — ` +
          'if it is wanted again, say why here rather than deleting this line)');
    // THE INTERIOR VIEW IS A CONTRACT BETWEEN TWO FILES, and neither half is
    // any use alone: the crew layer publishes where the pilot's eyes are, and
    // the camera reads it. Delete the publish and the preset silently frames
    // nothing; delete the read and the marker is computed for no one. Both
    // sides are asserted against the artifact, which is where they have to
    // meet.
    for (const [what, needle] of [
      ['the crew layer publishes the eye point', 'window.CAGE_CREW_EYE = {'],
      ['the camera reads it', 'const E = window.CAGE_CREW_EYE;'],
      ['the preset is gated on a pilot', "!window.CAGE_CREW_EYE"],
    ]) if (html.indexOf(needle) < 0)
      throw new Error(`the interior view is half-wired: ${what} — not found`);
    // THE COWL GETS OUT OF THE WAY is a contract across three files, and the
    // interesting failures are all in the parts that are NOT the ghost itself:
    // the layer has to read the dial, the rail has to keep offering it (or the
    // builder cannot take it back), and the join has to reset it (or a ghosted
    // cowl flies transparent). Asserted against the artifact, which is where
    // the three have to meet.
    //
    // EVERY NEEDLE IS CODE, NOT PROSE. The block's own comments name `cowl α`
    // and VIEW_STATE, so a check on those words would pass on the explanation
    // rather than the mechanism — the trap this arc fell into three times.
    for (const [what, needle] of [
      ['the ghost has a stated value', 'const COWL_GHOST = 0.15;'],
      ['it fires only on the engine, only in the livery view',
        "view === 'finish' && sel === 'engine'"],
      ['the cowl layer reads the dial', 'window.CAGE_VIEW.cowlA != null'],
      ['the rail still offers the dial', "'structure α', 'cowl α'] }"],
      ['the join resets it for flight', "_vView('cowlA')"],
      ['the slider is moved with the value', "showAlpha('cowl α', V.cowlA);"],
      ['a builder who moves it keeps it',
        'if (V.cowlA === COWL_GHOST) V.cowlA = cowlWas;'],
    ]) if (html.indexOf(needle) < 0)
      throw new Error(`the cowl ghost is half-wired: ${what} — not found`);
    console.log(`the seam holds: ${flight.length} flight ids, ` +
      `${workshop.length} workshop ids, ${retired.length} retired`);
  }

  if (rafCount < 100) throw new Error(`loop stalled (raf x${rafCount})`);
  console.log(`ran app block: raf x${rafCount}, handlers wired: ${Object.keys(handlers).sort().join(' ')}`);
  console.log('GATE UISMOKE: PASS');
} catch (e) {
  console.log(e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : String(e));
  console.log('GATE UISMOKE: FAIL');
  process.exit(1);
}
})();
