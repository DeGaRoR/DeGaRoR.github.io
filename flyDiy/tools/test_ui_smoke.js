// Gate: the built artifact's UI block actually RUNS (not just parses).
// Catches unresolved identifiers, wrong call signatures, bad wiring —
// the class of bug node --check cannot see (e.g. the MODEL_OFF regression).
// Stubs: minimal DOM + THREE. The vendor (three.min.js) and render_world
// blocks are NOT executed — buildWorldScene is stubbed so the gate stays
// focused on core + models + app wiring. Runs setAircraft, the full loop
// path (script/sync/poseModel/hud) for 120 frames, then every button
// handler and an aircraft switch through the selAc dropdown.
const fs = require('fs'), vm = require('vm'), path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const pick = (marker, label) => {
  const b = blocks.find(x => x.includes(marker));
  if (!b) { console.log(`missing ${label} block (no "${marker}")`); console.log('GATE UISMOKE: FAIL'); process.exit(1); }
  return b;
};
const coreBlock = pick('function makeAutopilot', 'core');
const modelsBlock = pick('const MODEL_PA18', 'models');
const appBlock = pick('function setAircraft', 'app');

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
  PerspectiveCamera: class { constructor(){ this.position = vec(); } lookAt(){} updateProjectionMatrix(){} },
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
vm.createContext(sandbox);

const frames = n => { for (let i = 0; i < n && rafCb; i++) { const cb = rafCb; rafCb = null; cb(); } };
try {
  vm.runInContext(coreBlock, sandbox, { filename: 'core.js' });      // physics + codec
  vm.runInContext(modelsBlock, sandbox, { filename: 'models.js' });  // baked payloads
  // render_world is not executed; the app only needs its factory's return shape
  sandbox.buildWorldScene = () => ({ worldUpdate() {} });
  vm.runInContext(appBlock, sandbox, { filename: 'app.js' });        // UI (runs setAircraft)
  if (!handlers['bSkin']) throw new Error('bSkin not wired');
  // drive the loop: HOLDING frames, then press Fly and run 2 s of circuit
  frames(30);
  handlers['bGo'] && handlers['bGo']();
  frames(120);
  // exercise every wired button (Skin cycles all 3 states)
  // bEdit is the editor door the shelf's move left behind (G63): CAGE_UI_BOOT
  // does not exist in this sandbox, so what it proves is the WIRING — that the
  // handler is on the button and returns cleanly with no editor to open.
  for (const id of ['bSkin', 'bSkin', 'bSkin', 'bTel', 'bPause', 'bPause',
                    'bEdit', 'bReset'])
    handlers[id] && handlers[id]({ target: els[id] });
  // aircraft switch through the dropdown: model-less path, then cache reuse
  handlers['selAc']({ target: { value: 'drone' } });
  frames(30);
  handlers['selAc']({ target: { value: 'pa18' } });
  frames(30);
  // the c172 skin exercises the multi-group rig (its steering nose gear spans
  // four payload groups) and the flat-colour opaque interior materials
  handlers['selAc']({ target: { value: 'c172' } });
  frames(60);
  for (const id of ['bSkin', 'bSkin', 'bSkin'])
    handlers[id]({ target: els[id] });
  frames(30);
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
    const flight = ['card', 'rail', 'pfd', 'telp', 'mmp', 'uvp', 'bottom',
                    'selAc', 'bGo', 'credit',
                    // G107.2: the ARRIVAL CARD — the flight's ending is
                    // flight chrome by definition
                    'arrCard', 'bAgain', 'bHangar'];
    const workshop = ['edWrap', 'edView', 'edInfo',
                      'edTree', 'edRows', 'edRail', 'plaque', 'edBench',
                      'edShelf', 'edViewTabs', 'edTabShape', 'edTabFinish',
                      // G107: the view's chrome is ONE bar across the top
                      'edTopBar', 'edActs', 'edSave', 'edRoll'];
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
                     'edShed', 'shedBody', 'edScrim'];
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
