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
const { readGeo } = require('./_media_lib.js');   // G930: the geo bins are gzip on disk

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script(?: type="text\/x-flydiy")?>([\s\S]*?)<\/script>/g)].map(m => m[1]);   // G434.3: the inlined scripts are inert (text/x-flydiy) until the island loader promotes them
const pick = (marker, label) => {
  const b = blocks.find(x => x.includes(marker));
  if (!b) { console.log(`missing ${label} block (no "${marker}")`); console.log('GATE UISMOKE: FAIL'); process.exit(1); }
  return b;
};
const coreBlock = pick('function makePilot(', 'core');
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
const worldBootBlock = pick('FLYDIY_WORLD_COMPOSE = function', 'world boot');   // G999: the world's composition, ahead of app.js (which calls it when the promote did not)
// THE LOADING SCREEN (LOADING S1): boot.js is its own inline block, ahead of
// the vendor. It is executed here so the boot's step chain runs the way the
// browser runs it minus the waiting - this harness's setTimeout fires at
// once, so BOOT.run unrolls synchronously inside app.js's eval - and so
// the teardown is asserted on the real object, not a shim.
const bootBlock = pick('window.BOOT = B', 'boot');
// G2104 (MOBILE-GARAGE 1): `--phone` - the same smoke on the phone profile (UISMOKE-PHONE in run_gates). profile.js runs
// first, on ?profile=phone, ahead of the graphics menu and app.js, exactly as the page orders them; the boot must then
// be the garage's alone, and the gate ends after the phone's own checks (the flight half has no world to fly in)
const PHONE = process.argv.includes('--phone');
const profileBlock = pick('W.PROFILE = {', 'profile');
if (html.indexOf('window.BOOT = B') > html.indexOf('function makePilot('))
  throw new Error('boot.js must precede the core in index.html (the overlay speaks before the vendor parses)');
if (html.indexOf('id="boot"') < 0 || html.indexOf('id="boot"') > html.indexOf('<canvas id="c">'))
  throw new Error('#boot must be the first thing in <body>, ahead of the canvas');
// THE WELCOME'S MODE (G2213, WELCOME-MODES): the artifact's welcome.js block, run as the rigs run it (a driven browser, on
// localhost): no screen, nothing held - the island loader does not wait on FLYDIY_WELCOME - and FLYDIY_MODE 'sandbox'
// (implicitly: the page this gate smokes IS the sandbox). ?mode=sandbox on a real host is the same skip; the menu itself
// is GATE GFX's (welcome.js in a vm over a small DOM) and the stills' (tools/welcome_modes_shot.js)
{
  const welcomeBlock = pick('W.WELCOME = {', 'welcome');
  // a returning player's record (this harness has no WebGL2: the record says the gate was passed), so only the mode decides
  const seen = JSON.stringify({ gpu: '', preset: 'potato', tried: true });
  const run = (search, hostname, navigator) => {
    const box = { navigator, location: { search, hostname }, localStorage: { getItem: k => (k === 'flydiy.welcome' ? seen : null), setItem() {} },
      document: { createElement: () => { throw new Error('the welcome built a screen'); }, getElementById: () => null }, addEventListener() {} };
    box.window = box; vm.createContext(box); vm.runInContext(welcomeBlock, box, { filename: 'welcome.js' }); return box;
  };
  const rig = run('', 'localhost', { webdriver: true, userAgent: 'Mozilla/5.0 HeadlessChrome/141' });
  const pages = run('?mode=sandbox', 'degaror.github.io', { userAgent: 'Mozilla/5.0 Chrome/141' });
  if (rig.FLYDIY_MODE !== 'sandbox' || rig.FLYDIY_WELCOME || pages.FLYDIY_MODE !== 'sandbox' || pages.FLYDIY_WELCOME)
    throw new Error('the welcome block: a rig on localhost / ?mode=sandbox must skip every screen as the sandbox (' + rig.FLYDIY_MODE + ', ' + pages.FLYDIY_MODE + ')');
  console.log("the welcome: a rig on localhost and ?mode=sandbox skip every screen, FLYDIY_MODE 'sandbox', nothing held");
  // G2320 (CAREER-WIRE): ?career=1 IS THE DEV CAREER - the career mode for the page's game code (a rig, localhost, a real
  // host), the menu's New career row still "coming" (READY.career false; ?mode=career still boots the sandbox); a near
  // miss (?career=10, ?career=0) is the sandbox
  const nav = { userAgent: 'Mozilla/5.0 Chrome/141' };
  for (const [q, host, n, want] of [['?career=1', 'localhost', { webdriver: true, userAgent: 'HeadlessChrome/141' }, 'career'], ['?career=1', 'degaror.github.io', nav, 'career'],
                                     ['?audio=0&career=1&map=1', 'degaror.github.io', nav, 'career'], ['?career=10', 'localhost', nav, 'sandbox'], ['?career=0', 'localhost', nav, 'sandbox'],
                                     ['?mode=career', 'degaror.github.io', nav, 'sandbox'], ['', 'localhost', nav, 'sandbox']]) {
    const b = run(q, host, n);
    if (b.FLYDIY_MODE !== want || b.FLYDIY_WELCOME) throw new Error('the welcome: ' + q + ' on ' + host + ' -> FLYDIY_MODE ' + b.FLYDIY_MODE + ', expected ' + want + ' with no screen');
    if (b.WELCOME.READY.career !== false) throw new Error("the welcome: the menu's New career row is no longer \"coming\" (READY.career)");
  }
  console.log("the career flag: ?career=1 -> FLYDIY_MODE 'career' (a rig, localhost, a real host; no screen); ?career=10 / ?career=0 / ?mode=career -> the sandbox; the menu's New career row still \"coming\"");
}
// G2320 (CAREER-WIRE): NO CAREER CODE RUNS WITHOUT THE FLAG - in app.js, every call into the career's page half outside that
// half is guarded by CAREER_DEV (the half itself defines functions and the window.FLYDIY_CAREER door, under the flag)
{
  const app = pick('function setAircraft', 'app');
  const i0 = app.indexOf("G2320 (CAREER-WIRE): THE DEV CAREER'S PAGE HALF"), i1 = app.indexOf('window.FLYDIY_PLAYER = {', i0);
  if (i0 < 0 || i1 < 0) throw new Error("app.js: the dev career's page half is not where this gate reads it");
  const outside = (app.slice(0, i0) + app.slice(i1)).split('\n').filter(l => /\bcareer[A-Z]\w*\(/.test(l.replace(/\/\/.*$/, '')));
  const loose = outside.filter(l => !/CAREER_DEV/.test(l));
  if (loose.length) throw new Error('app.js calls the career outside the CAREER_DEV guard: ' + loose.map(l => l.trim().slice(0, 90)).join(' | '));
  if (!/const CAREER_DEV = \(\(\) => \{ try \{ return \/\[\?&\]career=1\(&\|\$\)\/\.test\(window\.location\.search/.test(app)) throw new Error('app.js: CAREER_DEV is not ?career=1 alone');
  if (!/const PLAYER_KEY = CAREER_DEV \? careerKey\('dev'\) : 'flydiy\.player';/.test(app)) throw new Error("app.js: the dev career's key is not flydiy.career.dev, or the sandbox's not flydiy.player");
  if (!/\nif \(CAREER_DEV\) window\.FLYDIY_CAREER = |  if \(CAREER_DEV\) window\.FLYDIY_CAREER = /.test(app)) throw new Error('app.js: window.FLYDIY_CAREER is not behind the flag');
  console.log('the career flag in app.js: ' + outside.length + ' calls into the career outside its page half, every one behind CAREER_DEV (?career=1 alone; flydiy.career.dev, the sandbox keeps flydiy.player)');
}
// G2260 (ECONOMY): THE WALLET ONLY IN A CAREER - in app.js every call into the economy outside its page half is guarded by
// CAREER_DEV (the half defines the functions and window.FLYDIY_ECON, under the flag); garage.js's save asks the page
// first, and the page's answer without the flag is '' (the sandbox saves exactly as before)
{
  const app = pick('function setAircraft', 'app'), gar = pick('function garageInit', 'garage');
  const i0 = app.indexOf("G2260 (ECONOMY): THE CAREER WALLET'S PAGE HALF"), i1 = app.indexOf('window.FLYDIY_PLAYER = {', i0);
  if (i0 < 0 || i1 < 0) throw new Error("app.js: the economy's page half is not where this gate reads it");
  const outside = (app.slice(0, i0) + app.slice(i1)).split('\n').filter(l => /\becon[A-Z]\w*\(/.test(l.replace(/\/\/.*$/, '')));
  const loose = outside.filter(l => !/CAREER_DEV/.test(l));
  if (loose.length) throw new Error('app.js calls the economy outside the CAREER_DEV guard: ' + loose.map(l => l.trim().slice(0, 90)).join(' | '));
  if (!/  if \(CAREER_DEV\) window\.FLYDIY_ECON = /.test(app)) throw new Error('app.js: window.FLYDIY_ECON is not behind the flag');
  if (!/canSave: \(name, isNew\) => \(CAREER_DEV \? econSaveWhy\(name, isNew\) : ''\)/.test(app)) throw new Error("app.js: the save's price door answers the sandbox");
  if (!/if \(api\.canSave\) \{ const why = api\.canSave\(name, !lsGet\(SLOT \+ name\)\); if \(why\) return void alert\(why\); \}/.test(gar)) throw new Error('garage.js: the save does not ask the page first');
  console.log('the wallet in app.js: ' + outside.length + ' calls into the economy outside its page half, every one behind CAREER_DEV; the save asks first (the sandbox: never)');
}
// THE MAP SCREEN'S ROWS (G2253, MAP-MENU; tools/_map_smoke.js): the sandbox shows no MAP entry without ?map=1, nothing of
// the screen loads before the entry is pressed, the screen's tabs / rows / cards over the contracts fixture, NOHOVER and R1
// on the new UI; --phone the phone's card and the sheet's gestures
try { for (const l of require('./_map_smoke.js')(html, PHONE)) console.log('map: ' + l); }
catch (e) { console.log(e && e.message || String(e)); console.log('GATE ' + (PHONE ? 'UISMOKE-PHONE' : 'UISMOKE') + ': FAIL'); process.exit(1); }

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
    quaternion: { setFromAxisAngle() { return this; }, copy() { return this; },
                  multiply() { return this; } },
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
    // the free camera (DEVCAM, the test mode's eye - G760 walks it) moves by these
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; },
    addScaledVector(v, k) { this.x += v.x * k; this.y += v.y * k; this.z += v.z * k; return this; },
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
    this.fov = 46; } lookAt(){} updateProjectionMatrix(){}
    getWorldDirection(v) { return v.set(0, 0, -1); } },   // the free camera seeds its pose from it (G760's test mode)
  Vector3: function(...a) { return vec(...a); },
  // A QUATERNION, because the cockpit's controls turn about two axes at once
  // (G240) and app.js composes them at module scope. As honest as the rest of
  // this stub: it constructs and chains, and claims nothing about the maths.
  Quaternion: class { constructor(){ this.x = 0; this.y = 0; this.z = 0; this.w = 1; }
                      setFromAxisAngle(){ return this; } multiply(){ return this; }
                      copy(){ return this; } setFromRotationMatrix(){ return this; }
                      setFromUnitVectors(){ return this; } invert(){ return this; } },
  Matrix4: class { makeBasis(){ return this; } setPosition(){ return this; }
                   makeScale(){ return this; } copy(){ return this; } },
  // the HEADCAM (the panel arc, session 4b) keeps a normal matrix at module
  // scope to walk the head's look into the world; it constructs, no more
  Matrix3: class { setFromMatrix4(){ return this; } getNormalMatrix(){ return this; } },
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
    this.instanceMatrix = { needsUpdate: false, clearUpdateRanges() {}, addUpdateRange() {} }; this.instanceColor = null; }
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
  CanvasTexture: class { constructor(c) { this.image = c; this.colorSpace = ''; }
    dispose() {} },
  SpriteMaterial: class { constructor(o) { Object.assign(this, o || {}); }
    dispose() {} },
  Sprite: class { constructor(m) { this.material = m; this.scale = { set() {} };
    this.position = { set() {} }; this.renderOrder = 0; } },
  DoubleSide: 2,
  SRGBColorSpace: 'srgb', LinearSRGBColorSpace: 'srgb-linear', NoColorSpace: '',
  ACESFilmicToneMapping: 0, PCFShadowMap: 0,
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
              // the DEVCAM (W0c) and the HEADCAM (the panel arc) listen for
              // pointerlockerror on the document, as a real one allows
              addEventListener() {},
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
    return Promise.resolve(readGeo(url.split('?')[0]));   // gunzips the .gz.bin transport, as assets.js does
  } catch (e) { return Promise.reject(e); }
};
vm.createContext(sandbox);

const frames = n => { for (let i = 0; i < n && rafCb; i++) { const cb = rafCb; rafCb = null; cb(); } };
// ---- G2104: THE PHONE PROFILE'S OWN CHECKS (UISMOKE-PHONE) -------------------------------------------------------------
// The boot above ran the garage alone; here: nothing of the world or the flight was made, the roll-out is refused, the
// picture is the lightest preset, and phone.css is the phone's alone, selector by selector (the desktop's pixels cannot
// move through it). phone.js needs a laid-out document (the knob reads the scale's box) - tools/phone_still.js --checks
// drives it with real touch events in a real browser.
function phoneChecks() {
  const W = sandbox.window, G = sandbox.garageApi;
  if (W.FLYDIY_SIMW) throw new Error('the phone garage made the sim worker');
  const gp = W.GFX && W.GFX.get && W.GFX.get().preset;
  if (gp !== 'laptop') throw new Error('the phone garage draws on ' + gp + ', expected laptop (profile.js preset)');
  if (!G || !G.inGarage()) throw new Error('the phone garage is not in the garage after its boot');
  // the shed's Roll out is the game's own #bGo (editor.js's #edRoll presses it), and the garage bridge's rollOut
  if (typeof handlers['bGo'] !== 'function' || typeof G.rollOut !== 'function') throw new Error('#bGo / garageApi.rollOut are not wired');
  handlers['bGo'](); frames(5); G.rollOut();
  frames(10);
  if (!G.inGarage()) throw new Error('Roll out left the phone garage (profile.js fly none: there is no world)');
  if (W.FLYDIY_TRIPS && W.FLYDIY_TRIPS.some(t => t && t.kind === 'rollout')) throw new Error('a roll-out trip ran on the phone');
  console.log('the phone garage: no sim worker, preset laptop, roll-out refused (still in the garage after ' + 10 + ' frames)');
  // phone.css: every rule under html.phone, or a default that HIDES one of the phone's own elements
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'phone.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  if (!html.includes('html.phone #phTabs button.on')) throw new Error('index.html does not carry phone.css');
  const OWN = /^(#phTabs|#phBubble(\.fine|\[hidden\])?|\.phKnob|\.phStep)$/;
  const bad = [], seen = [];
  // a selector list split at its top-level commas (the ones inside :is( ) belong to their selector)
  const topCommas = t => { const out = []; let d = 0, b0 = 0;
    for (let k = 0; k < t.length; k++) { const c = t[k]; if (c === '(') d++; else if (c === ')') d--; else if (c === ',' && !d) { out.push(t.slice(b0, k)); b0 = k + 1; } }
    out.push(t.slice(b0)); return out.map(x => x.trim()).filter(Boolean); };
  const walk = (src, inMedia) => {
    let i = 0;
    while (i < src.length) {
      const o = src.indexOf('{', i); if (o < 0) break;
      const sel = src.slice(i, o).trim();
      let d = 1, j = o + 1; while (j < src.length && d) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; }
      const body = src.slice(o + 1, j - 1);
      if (/^@media/.test(sel)) walk(body, true);
      else for (const one of topCommas(sel)) {
        seen.push(one);
        const okHide = OWN.test(one) && /display\s*:\s*none/.test(body);
        const okBubble = /^#phBubble/.test(one);   // the bubble exists only on the phone (phone.js makes it)
        if (!(/^html\.phone(\b|[ .:#\[])/.test(one) || okHide || okBubble)) bad.push(one);
      }
      i = j;
    }
  };
  walk(css, false);
  if (bad.length) throw new Error('phone.css: rules that are not the phone\'s alone (they would reach the desktop): ' + bad.join(' | '));
  console.log('phone.css: ' + seen.length + ' selectors, every one under html.phone (or hiding a phone-only element)');
}
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
  // THE GRAPHICS MENU (G760): gfx_settings.js rides the RENDER block too; it runs from its own source so the
  // rail walk below reaches the real menu in its folds. Its frame readout asks the window for a frame and an
  // interval, which this sandbox answers with nothing (the loop's own rAF is the global one, untouched). The
  // flight recorder is not executed (its hooks would ride the loop); its two rows stand in for it, no attach.
  sandbox.window.requestAnimationFrame = () => 0;
  sandbox.setInterval = () => 0; sandbox.clearInterval = () => {};
  sandbox.window.FLYDIY_WORLDS = [{ id: 'none', name: 'the analytic world' }, { id: 'jolene', name: 'Jolene' }];
  sandbox.window.FLYDIY_WORLD = 'none';
  sandbox.window.FLIGHT_REC = {
    mount(b, H) { this.mountMeter(b, H); this.mountLog(b, H); },
    mountMeter(b, H) { H.row(b, 'fps meter'); H.pills(b, [{ label: 'off' }, { label: 'on' }], () => false, () => {}); },
    mountLog(b, H) { H.row(b, 'flight log'); H.note(b, ''); H.pills(b, [{ label: 'save log' }, { label: 'previous session' }], () => false, () => {}); } };
  // G2104: the profile, before the graphics menu (its preset) and app.js (its boot) - the desktop's on the plain run
  sandbox.window.location = { search: PHONE ? '?profile=phone' : '' };
  vm.runInContext(profileBlock, sandbox, { filename: 'profile.js' });
  delete sandbox.window.location;
  if ((sandbox.window.PROFILE && sandbox.window.PROFILE.name) !== (PHONE ? 'phone' : 'desktop'))
    throw new Error('profile.js: the page is on ' + (sandbox.window.PROFILE && sandbox.window.PROFILE.name) + ', expected ' + (PHONE ? 'phone' : 'desktop'));
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'gfx_settings.js'), 'utf8'),
                  sandbox, { filename: 'gfx_settings.js' });
  // THE SOUND (G1600): audio_params.js and audio.js ride the RENDER block too - run from their own source, so the rail's
  // SOUND item mounts the real menu and the loop's AUDIO.update runs (no gesture, no AudioContext here: it returns at once)
  for (const f of ['audio/audio_params.js', 'audio/audio.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', f), 'utf8'), sandbox, { filename: f });
  vm.runInContext(bootBlock, sandbox, { filename: 'boot.js' });      // the loading screen's brain
  vm.runInContext(worldBootBlock, sandbox, { filename: 'world_boot.js' });   // G999: FLYDIY_WORLD_COMPOSE (app.js runs it)
  vm.runInContext(appBlock, sandbox, { filename: 'app.js' });        // UI (runs setAircraft)
  if (!handlers['bSkin']) throw new Error('bSkin not wired');
  // drive the loop: HOLDING frames, then press Fly and run 2 s of circuit
  frames(30);
  // ...and the loading screen has lifted: every step ran (the log names them
  // in order), nothing was left pending, three quiet frames tore it down
  {
    const B = sandbox.window.BOOT;
    if (!B || B.state !== 'gone') throw new Error('the loading screen never lifted (state ' + (B && B.state) + ', pending ' + (B && B.pending().join(', ')) + ')');
    const steps = B.log.filter(e => e.k === 'step').map(e => e.id);
    // B9 (G1020): the sync in its three (snapshot, C4a's bake - a no-op without the module -, spec) and THE WORLD in the
    // one loading (the roll-out screen's steps, then the aeroplane's programs in its light, the world drawn once)
    const want = PHONE   // G2100: the phone garage boots the garage alone (profile.js boot 'garage': the study's §1.2 table)
      ? ['treeBins', 'aircraft', 'garage', 'editor', 'seed', 'snapshot', 'spec', 'restore', 'compile', 'firstFrame', 'recheck']
      : ['treeBins', 'aircraft', 'garage', 'editor', 'seed', 'world', 'town', 'parking', 'trees', 'ring', 'settle', 'parked',
      'snapshot', 'bake', 'spec', 'restore', 'images', 'upload', 'worldCompile', 'compile', 'firstFrame', 'frames', 'craft', 'recheck'];   // compile: LOADING S2 (sync here: the stub renderer has no compileAsync); parked: G411 (a no-op without the world pack); treeBins: S3 (the world scene builds under the roll-out screen); seed: G995 (the editor's seed in its own tasks - a no-op here, openEditor seeds inline without the screen)
    if (steps.join(',') !== want.join(',')) throw new Error('boot steps ran as ' + steps.join(',') + ', expected ' + want.join(','));
    if (B.log.some(e => e.k === 'error')) throw new Error('a boot step threw: ' + JSON.stringify(B.log.filter(e => e.k === 'error')));
    if (B.log.some(e => e.k === 'fail')) throw new Error('the loading screen gave up: ' + JSON.stringify(B.log.filter(e => e.k === 'fail')));
    if (!els['boot'].classList.contains('gone')) throw new Error('#boot did not get .gone');
    console.log('the loading screen: ' + steps.length + ' steps in order, lifted on frame ' + B.log.find(e => e.k === 'ready').t);
  }
  // G2320 (CAREER-WIRE): the sandbox booted (no ?career=1): no career door, no career plate
  if (sandbox.window.FLYDIY_CAREER !== undefined || els.crPlate || els.crKg) throw new Error('the sandbox booted with the career (FLYDIY_CAREER / #crPlate) without ?career=1');
  console.log('the sandbox without the flag: no FLYDIY_CAREER, no career plate');
  // G2260 (ECONOMY): ...and no wallet: no FLYDIY_ECON, no wallet line in the garage
  if (sandbox.window.FLYDIY_ECON !== undefined || els.ecWallet || els.ecSum) throw new Error('the sandbox booted with the wallet (FLYDIY_ECON / #ecWallet) without ?career=1');
  console.log('the sandbox without the flag: no FLYDIY_ECON, no wallet line');
  if (PHONE) { phoneChecks(); console.log('GATE UISMOKE-PHONE: PASS'); process.exit(0); }
  // ---- G1065 (POLISH-1): THE FLY BUTTON DRAWS THE EYE ONCE THE SETUP IS TOUCHED ----
  // The user: "when the player changes any option on the roll-out setup screen during the load, the Fly button must draw
  // attention - a gentle pulsing animation (prefers-reduced-motion: a static highlight instead). No pulse while
  // untouched (it auto-starts then)." The look is one function of (touched, ready) - app.js setupLook, driven here on the
  // real #bootFly through FLYDIY_SETUP.look - and the pulse and its reduced-motion ring are the artifact's own CSS.
  {
    const S = sandbox.window.FLYDIY_SETUP;
    if (!S || typeof S.look !== 'function') throw new Error('FLYDIY_SETUP.look is missing (G1065)');
    const [u0, u1, t0, t1] = [[false, false], [false, true], [true, false], [true, true]].map(([t, r]) => S.look(t, r));
    if (!u0 || u0.pulse || u1.pulse) throw new Error('the Fly button pulses on an untouched setup screen (it auto-starts then): ' + JSON.stringify([u0, u1]));
    if (!t0.pulse || !t1.pulse) throw new Error('a touched setup screen: the Fly button does not pulse: ' + JSON.stringify([t0, t1]));
    if (t0.on || !t0.disabled || !t1.on || t1.disabled) throw new Error('Fly is lit and pressable only when the load is done: ' + JSON.stringify([t0, t1]));
    S.look(false, false);
    if (!/#bootFly\.pulse \{ animation:bootFlyPulse [0-9.]+s ease-in-out infinite; \}/.test(html) || !/@keyframes bootFlyPulse \{/.test(html))
      throw new Error('style.css: #bootFly.pulse has no pulse animation');
    if (!/@media \(prefers-reduced-motion: reduce\) \{\s*#bootFly\.pulse \{ animation:none; box-shadow:[^}]+\}/.test(html))
      throw new Error('style.css: no static highlight for #bootFly.pulse under prefers-reduced-motion');
    console.log('the Fly button: no pulse untouched; touched, it pulses (an outline while it loads, lit when ready); reduced motion: a still ring');
  }
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
  // ---- THE HONEST READINGS (G700, the Jolene playtest) ----
  // AGL: the wheels over the ground under them, 0 standing (the PFD read cg - ap.refAlt: -2..-4 m on the
  // runway, -235 m at the altiport); lifted 40 m it reads 40. IAS: an ASI's floor - below ~35 km/h the readout is the ground speed (G1016).
  // FLY ON: after a stop at the destination the next leg flies from where the aeroplane stands (it was a
  // fullReset back onto the departure stand).
  {
    const P = sandbox.window.FLIGHT_PROBE;
    if (typeof P.agl !== 'function') throw new Error('FLIGHT_PROBE has no agl (G700)');
    const sim = P.sim(), n = sim.n;
    const a0 = P.agl();
    if (!(a0 >= 0 && a0 < 0.05)) throw new Error(`AGL on the ground reads ${a0.toFixed(2)} m (want 0)`);
    for (let i = 0; i < n; i++) sim.p[i * 3 + 1] += 40;
    const a1 = P.agl();
    for (let i = 0; i < n; i++) sim.p[i * 3 + 1] -= 40;
    if (!(Math.abs(a1 - 40 - a0) < 0.05)) throw new Error(`AGL 40 m up reads ${a1.toFixed(2)} m`);
    const raw = ((sim.out.Veas ?? sim.out.V) || 0) * 3.6;
    const shown = els['r-ias'].textContent;
    // G1016: under the ASI's floor the readout is the GROUND speed (labelled gs): the taxi read 0 while it rolled
    const gsK = ((sim.out.Vg) || 0) * 3.6;
    if (raw < 25 && Math.abs(+shown - gsK) > 1) throw new Error(`under the ASI's floor the readout shows ${shown}, not the ground speed ${gsK.toFixed(1)} km/h (G1016)`);
    // FLY ON: an arrival (the pilot STOPPED where it said), the aeroplane 100 m from the stand
    const apOld = P.ap();
    for (let i = 0; i < n; i++) sim.p[i * 3] -= 100;
    for (let i = 0; i < n * 3; i++) sim.v[i] = 0;
    const cg0 = sim.cgPos().slice();
    apOld.phase = 'STOPPED';
    handlers['bGo']();
    const cg1 = P.sim().cgPos();
    if (P.ap() === apOld) throw new Error('fly on did not hand the aeroplane to a fresh pilot');
    if (P.ap().phase === 'STOPPED') throw new Error('fly on left the pilot STOPPED');
    if (Math.hypot(cg1[0] - cg0[0], cg1[2] - cg0[2]) > 0.5)
      throw new Error(`fly on moved the aeroplane ${Math.hypot(cg1[0] - cg0[0], cg1[2] - cg0[2]).toFixed(1)} m (a reset, not a leg)`);
    frames(30);
    console.log(`honest readings: AGL ${a0.toFixed(2)} m standing, ${a1.toFixed(2)} m lifted 40 (the pilot's own datum read ` +
      `${apOld.dbg && apOld.dbg.agl != null ? apOld.dbg.agl.toFixed(2) : '-'}); IAS "${shown}" at ${raw.toFixed(1)} km/h; ` +
      `fly on: a new leg in place (${P.ap().phase}), not a reset`);
  }
  // ---- G1945 DEST-TO: ONE "TO" ----
  // The user: "we could gradually drop the FROM-TO in favour of a simple 'To', which can be updated in flight or on the
  // ground. The plane reacts like its autopilot's destination has been updated." The From picker is gone (#selFrom is
  // never asked for); a To picked while the pilot taxis is the route at once (setDest 'kept': the same pilot, the
  // aeroplane not moved); on a leg of the arrival it re-plans ('replan'); STOPPED, it is the next leg from where the
  // aeroplane stands (the From derived: the field under it) - a new pilot, no reset.
  {
    const P = sandbox.window.FLIGHT_PROBE, R = sandbox.window.FLYDIY_ROUTE;
    if (!R || typeof R.to !== 'function' || typeof R.where !== 'function') throw new Error('FLYDIY_ROUTE.to / .where are missing (G1945)');
    if ('selFrom' in els) throw new Error('#selFrom was asked for: the From picker is retired (G1945)');
    const W = P.world(), other = W.aerodromes.find(a => a.kind !== 'meadow' && a.kind !== 'water' && !a.water && a.id !== 'HOME');
    if (!other) throw new Error('no second land strip in the smoke world');
    const sim = P.sim(), ap0 = P.ap(), cg0 = sim.cgPos().slice();
    if (ap0.phase === 'STOPPED') throw new Error('the pilot is STOPPED before the To test');
    const how1 = R.to(other.id);
    if (how1 !== 'kept' || P.ap() !== ap0 || !ap0.route.to || ap0.route.to.id !== other.id)
      throw new Error(`a To picked while ${ap0.phase}: ${how1}, route.to ${ap0.route.to && ap0.route.to.id} (want kept, ${other.id}, the same pilot)`);
    const ph0 = ap0.phase;
    ap0.phase = 'ENROUTE';
    const how2 = R.to('CIRCUIT');
    ap0.phase = ph0;
    if (how2 !== 'replan' || ap0.route.to.id !== ap0.route.from.id) throw new Error(`a To picked on a leg of the arrival: ${how2} (want replan, back to ${ap0.route.from.id})`);
    const cg1 = sim.cgPos();
    if (Math.hypot(cg1[0] - cg0[0], cg1[2] - cg0[2]) > 0.5) throw new Error('a To change moved the aeroplane (a reset, not a destination)');
    ap0.phase = 'STOPPED';
    const where = R.where();
    const how3 = R.to(other.id);
    const ap1 = P.ap(), cg2 = P.sim().cgPos();
    if (how3 !== 'leg' || ap1 === ap0 || ap1.phase === 'STOPPED' || !ap1.route.from || ap1.route.from.id !== (where && where.id))
      throw new Error(`STOPPED, a new To: ${how3}, from ${ap1.route.from && ap1.route.from.id} (want leg, a new pilot, the From derived: ${where && where.id})`);
    if (Math.hypot(cg2[0] - cg0[0], cg2[2] - cg0[2]) > 0.5) throw new Error('the next leg moved the aeroplane (a reset, not a leg)');
    if (R.get().from !== where.id || R.get().to !== other.id || R.get().base !== 'HOME') throw new Error('FLYDIY_ROUTE: ' + JSON.stringify(R.get()));
    R.to('CIRCUIT');
    frames(30);
    console.log(`one To: taxiing ${how1}, on a leg ${how2}, stopped ${how3} from ${where.kind} ${where.id} (the From derived), the aeroplane never moved`);
  }
  // ---- G2230 PREM-S2: THE GARAGE'S BASE LINE + SELECT, AND THE FLEET POPUP'S PLACE BADGE ----
  // The bases are derived from the hangars held (38b_dest.js flightBasesOf, ruling gp1): the sandbox's one hangar is
  // today's line ("Home base · the WWII hangar"); a second hangar held makes it a select, and picking one moves the
  // garage there (playerGoTo). The fleet popup (garage.js, run from its own source on a shelf with three saved
  // aeroplanes and THIS page's doors - app.js's garageInit api) shows where each stands ("in HOME", "out at <field>",
  // "away at <field>"), greys an aeroplane standing at another base and asks "fly from there?", and its house button
  // brings one home (free).
  {
    const PL = sandbox.window.FLYDIY_PLAYER, R = sandbox.window.FLYDIY_ROUTE, GA = sandbox.garageApi, P = sandbox.window.FLIGHT_PROBE;
    if (!PL || typeof PL.set !== 'function' || typeof PL.place !== 'function') throw new Error('FLYDIY_PLAYER is missing (G2230)');
    if (!GA || typeof GA.place !== 'function' || typeof GA.slotsChanged !== 'function' || typeof GA.flyFrom !== 'function' || typeof GA.bringHome !== 'function')
      throw new Error('the garage bridge lacks the fleet ledger doors (place / slotsChanged / flyFrom / bringHome)');
    const d0 = PL.doc();
    if (d0.mode !== 'sandbox' || d0.here !== 'HOME' || Object.keys(d0.sheds).join() !== 'HOME') throw new Error('the page\'s player is not today\'s sandbox: ' + JSON.stringify(d0).slice(0, 200));
    for (const w of ['garage', 'rollout']) {
      const row = R.baseRow(w);
      if (!row || row.kind !== 'line' || row.text !== 'Home base · the WWII hangar') throw new Error(`the sandbox's ${w} base row is not today's line: ${JSON.stringify(row && { kind: row.kind, text: row.text })}`);
    }
    const W = P.world(), other = W.aerodromes.find(a => a.kind !== 'meadow' && a.kind !== 'water' && !a.water && a.id !== 'HOME');
    const doc = JSON.parse(JSON.stringify(d0));
    doc.sheds[other.id] = { shell: 'field', kits: ['park'], base: other.id, tenure: 'own', dims: { HW: 8.5, HD: 9, EAVE: 3.6 }, since: 1 };
    doc.fleet = { Cub: { hangar: 'HOME', aero: 'HOME' }, Jodel: { hangar: null, aero: other.id, outSince: 0 }, Twin: { hangar: null, aero: 'nowhere', outSince: 0 } };
    PL.set(doc);
    const rowG = R.baseRow('garage'), rowR = R.baseRow('rollout');
    for (const row of [rowG, rowR])
      if (!row || row.kind !== 'select' || row.options.join() !== 'HOME,' + other.id || !/^Home base · the WWII hangar$/.test(row.labels[0]))
        throw new Error(`two hangars held: the base row is not a select of both: ${JSON.stringify(row && { kind: row.kind, options: row.options, labels: row.labels })}`);
    rowG.sel.onchange({ target: { value: other.id } });
    if (PL.doc().here !== other.id || R.get().base !== other.id) throw new Error(`picking ${other.id} on the base select did not move the garage there (here ${PL.doc().here}, base ${R.get().base})`);
    rowG.sel.onchange({ target: { value: 'HOME' } });
    if (PL.doc().here !== 'HOME') throw new Error('the base select did not come back to HOME');
    // the place badge, as the page computes it
    const pc = PL.place('Cub'), pj = PL.place('Jodel'), pt = PL.place('Twin');
    if (pc.text !== 'in HOME' || !pc.here || pj.text !== 'out at ' + other.id || pj.here || !/^away at /.test(pt.text) || pt.here)
      throw new Error(`the place badge: ${pc.text} / ${pj.text} / ${pt.text}`);
    // THE POPUP, garage.js from its own source, its doors this page's
    const kids = [];
    const mk = (tag) => {
      const e = { tag, children: [], style: {}, className: '', textContent: '', innerHTML: '', title: '', hidden: false, disabled: false, value: '', on: {}, _q: {},
        addEventListener(k, f) { this.on[k] = f; }, appendChild(c) { this.children.push(c); kids.push(c); return c; },
        querySelector(sel) { return this._q[sel] || (this._q[sel] = mk('q')); }, querySelectorAll: () => [], remove() {}, click() { if (this.on.click) this.on.click({ target: this }); },
        setAttribute() {} };
      return e;
    };
    const els2 = {}, store = new Map();
    const LS = { get length() { return store.size; }, key: i => Array.from(store.keys())[i], getItem: k => (store.has(k) ? store.get(k) : null),
                 setItem: (k, v) => { store.set(k, String(v)); }, removeItem: k => { store.delete(k); } };
    for (const n of ['Cub', 'Jodel', 'Twin']) LS.setItem('flydiy.build.' + n, JSON.stringify({ what: 'flydiy-build', name: n, spec: { meta: { name: n } } }));
    let asked = null, flew = null;
    const gb = { console, document: { getElementById: id => (els2[id] || (els2[id] = mk('#' + id))), createElement: t => mk(t), body: mk('body') },
                 alert: () => {}, prompt: () => null, confirm: q => { asked = q; return true; },
                 setTimeout: f => { f(); return 0; }, clearTimeout() {}, genNormaliseSpec: x => x, genSpecMerge: (a2, b2) => Object.assign({}, a2, b2) };
    gb.window = { localStorage: LS };
    vm.createContext(gb);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'garage.js'), 'utf8'), gb, { filename: 'garage.js' });
    gb.garageInit({ defaults: () => ({}), apply() {}, resolved: () => null, isGen: () => true, inGarage: () => true,
                    place: n => GA.place(n), flyFrom: n => { flew = n; return GA.flyFrom(n); }, bringHome: n => GA.bringHome(n), wear: n => 0 });
    els2.gLoad.on.click();
    const rowsOf = () => kids.filter(k => typeof k.className === 'string' && /\bgfRow\b/.test(k.className) && k.children.some(c => c.className === 'gfLoad'));
    const byName = () => { const o = {}; for (const r of rowsOf()) { const b = r.children.find(c => c.className === 'gfLoad'); const nm = b.children.find(c => c.tag === 'b'); if (nm) o[nm.textContent] = r; } return o; };
    let rows = byName();
    const badge = r => { const b = r.children.find(c => c.className === 'gfLoad'); const i = b && b.children.find(c => /\bgfPlace\b/.test(c.className)); return i ? i.textContent : null; };
    if (!rows.Cub || !rows.Jodel || !rows.Twin) throw new Error('the fleet popup did not list the three saved aeroplanes: ' + Object.keys(rows).join(','));
    if (badge(rows.Cub) !== 'in HOME' || badge(rows.Jodel) !== 'out at ' + other.id || !/^away at /.test(badge(rows.Twin) || ''))
      throw new Error(`the popup's place badges: ${badge(rows.Cub)} / ${badge(rows.Jodel)} / ${badge(rows.Twin)}`);
    if (/gfAway/.test(rows.Cub.className) || !/gfAway/.test(rows.Jodel.className) || !/gfAway/.test(rows.Twin.className))
      throw new Error(`the popup greys the wrong rows: Cub "${rows.Cub.className}", Jodel "${rows.Jodel.className}", Twin "${rows.Twin.className}"`);
    const home = r => r.children.find(c => c.className === 'gfHome');
    if (home(rows.Cub) || !home(rows.Jodel) || !home(rows.Twin)) throw new Error('"bring it home" is offered on the wrong rows');
    // bring the Twin home from the popup: the page's ledger moves it to HOME (inside if a slot and the floor allow, else outside)
    home(rows.Twin).on.click();
    const pt2 = PL.place('Twin');
    if (pt2.aero !== 'HOME' || !pt2.here) throw new Error('bring it home from the popup left the Twin ' + pt2.text);
    rows = byName();
    if (badge(rows.Twin) !== pt2.text) throw new Error('the popup did not redraw the Twin\'s place: ' + badge(rows.Twin));
    // "fly from there?" on the greyed Jodel: asked, and the garage moves to its base (a hangar is held there)
    rows.Jodel.children.find(c => c.className === 'gfLoad').on.click();
    if (!asked || !/fly from there\?/.test(asked) || flew !== 'Jodel' || PL.doc().here !== other.id)
      throw new Error(`"fly from there?": asked ${JSON.stringify(asked)}, flew ${flew}, the garage at ${PL.doc().here}`);
    // the build on the stand here is unsaved (no slot): its roll-out is the garage's base - now that field
    if (PL.rollFrom() !== other.id) throw new Error('the roll-out of the unsaved build on the stand is not the garage\'s base (' + other.id + '): ' + PL.rollFrom());
    PL.set(d0);
    if (PL.rollFrom() !== 'HOME') throw new Error('back in the sandbox, the roll-out is not HOME: ' + PL.rollFrom());
    if (R.baseRow('garage').kind !== 'line') throw new Error('back to one hangar, the base row is not a line again');
    console.log(`PREM-S2: the sandbox's base line "${rowR.labels[0]}"; two hangars -> a select (${rowG.options.join(', ')}), picking moves the garage; ` +
      `the popup: ${badge(rows.Cub)} / out at ${other.id} (greyed) / away -> brought home (${pt2.text}); "fly from there?" moved the garage to ${other.id}`);
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
    // THE CROSSWIND LIMIT (G193.2) rode the test flight's report; since A9 it
    // is the crosswind CARD's own sheet (`xwind`) and the plaque prints it in
    // its own section, IN A CROSSWIND — with the roll and the lift-off
    // heading beside it, the row's own bound, and the first rung that failed.
    // Restored the way a saved certificate comes back, so the round trip is
    // the thing tested.
    B.restoreSheets({ flight: { t: 300, report: {
      outcome: 'completed', verdicts: [],
      landing: { run: 152, sink: 0.8, V: 20, offCentre: 0.1, pastAim: 10 } } },
      xwind: { result: { limit: 2, cap: 10, band: 12.5, roll: 10.11, e: 0.227, failW: 4, failWhy: 'off the edge line', runs: [] }, runs: [] } });
    B.plaque(true);
    {
      const h = els['pqRows'].innerHTML;
      if (!/crosswind limit/.test(h))
        throw new Error('the plaque did not print the crosswind limit');
      if (!/in a crosswind/i.test(h) || !/first rung failed/.test(h) || !/4\.0 m\/s · off the edge line/.test(h))
        throw new Error('the crosswind has no section of its own, or the failed rung is not on it');
      if (!/2\.0 m\/s/.test(h) || !/roll 10\.1 m/.test(h) || !/13\u00b0 off/.test(h))
        throw new Error('the crosswind row does not carry its limit, roll and heading: ' +
                        (h.match(/crosswind limit[^<]*<[^>]*>[^<]*/) || [''])[0]);
      if (!/\u2265 4 m\/s/.test(h))
        throw new Error('the crosswind row does not print its bound');
    }
    B.restoreSheets({ xwind: { result: { limit: null, cap: 10, band: 12.5, roll: 3.2, e: 0.02, failW: null, failWhy: null, runs: [] }, runs: [] } });
    B.plaque(true);
    if (!/&gt; 10 m\/s|> 10 m\/s/.test(els['pqRows'].innerHTML))
      throw new Error('a limit above the cap does not print as "> cap"');
    console.log('bench crosswind limit: the plaque row reads 2.0 m/s · roll 10.1 m · 13° off, and "> 10 m/s" above the cap');
    // G2273 (ACCEPT): PROVED IN FLIGHT - off the plaque until the build's logbook holds a valid leg; its rows when it
    // does (the real accept_rec.js over a signed record the core measured off a steady 5-min leg); WITHDRAWN under
    // another fingerprint (the bench's stickers' rule)
    {
      vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'accept_rec.js'), 'utf8'), sandbox, { filename: 'accept_rec.js' });
      const W = sandbox.window, keepG = W.GARAGE_SPEC, keepFp = W.BENCH_FP;
      const smp = [];
      for (let i = 0; i <= 300; i++) smp.push({ t: 200 + i, alt: 300, tas: 35.25, gs: 35.25, vs: 0, bank: 0, E: 32.4 - 10.887 * i / 3600, kind: 'fuel', thr: 0.75, box: true });
      const meas = sandbox.acceptLegMeasure(smp, { E0: 32.4, kind: 'fuel', kgL: 0.72, thr: 0.75, alt: 300 });
      const rec = sandbox.acceptSign(meas, { fp: 'abcd1234', when: '2026-10-07', thr: 0.75, alt: 300, legMin: 5, load: { occupants: 1, payloadKg: 122, massKg: 476 } });
      const LOG = { built: null, tests: [], flights: [], accept: [] };
      W.GARAGE_SPEC = Object.assign({}, keepG || {}, { log: () => LOG });
      W.BENCH_FP = () => 'abcd1234';
      try {
        B.plaque(true);
        if (/proved in flight/i.test(els['pqRows'].innerHTML)) throw new Error('the proved-in-flight section is on the plaque with no leg flown');
        LOG.accept.push(rec);
        B.plaque(true);
        const h = els['pqRows'].innerHTML;
        if (!meas.valid || !/proved in flight/i.test(h) || !/126\.9 km\/h TAS|127 km\/h TAS/.test(h) || !/endurance flown/.test(h) || !/range flown/.test(h) || !/burn flown/.test(h))
          throw new Error('the plaque did not print the acceptance leg: ' + (h.match(/proved in flight[\s\S]{0,300}/i) || [''])[0]);
        W.BENCH_FP = () => 'ffff0000';
        B.plaque(true);
        if (!/withdrawn/.test(els['pqRows'].innerHTML) || /range flown/.test(els['pqRows'].innerHTML))
          throw new Error('a leg flown on another build is not withdrawn from the plaque');
      } finally { W.GARAGE_SPEC = keepG; W.BENCH_FP = keepFp; B.plaque(true); }
      console.log('accept: the plaque has no proved-in-flight rows without a leg, prints the leg (127 km/h TAS, ' + meas.enduranceMin + ' min, ' + meas.rangeKm + ' km), and withdraws it under another fingerprint');
    }
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

  // ---- SKIP TO LINE-UP (G771): offered while taxiing, lands on the hold, then stands down --------
  {
    const P = sandbox.window.FLIGHT_PROBE, b = els['bSkip'];
    if (!b || b.hidden) throw new Error('#bSkip is not offered on a taxi start (G771)');
    if (b.disabled) throw new Error('#bSkip is disabled while the aeroplane taxis (phase ' + P.ap().phase + ')');
    const c0 = P.sim().cgPos();
    handlers['bSkip']();
    frames(6);
    const ph = P.ap().phase, cg = P.sim().cgPos();
    if (!['STOP', 'HOLD', 'ROLL'].includes(ph)) throw new Error('the skip handed the pilot ' + ph + ', not the hold');
    if (Math.abs(cg[2]) > 1.5 || cg[0] > -40) throw new Error('the skip did not land on the HOME hold (cg ' + cg.map(v => v.toFixed(1)).join(', ') + ')');
    if (P.sim().wheelsOnGround() < 2) throw new Error('the skip left the aeroplane off its wheels');
    if (!b.disabled) throw new Error('#bSkip still offered at the hold');
    console.log('skip to line-up: ' + Math.hypot(cg[0] - c0[0], cg[2] - c0[2]).toFixed(0) + ' m from the taxi to the hold, pilot in ' + ph + ', the button stands down');
  }

  // ---- THE RAILS (G760, the Jolene playtest §3): five items, folds, DEV behind a toggle, nothing lost --------
  // Walked through the rail's own census (FLYDIY_RAIL.census: the item built with every fold open, nothing saved):
  // every item builds without a section throwing, holds the sections it declares, and reaches the controls the
  // fourteen old items reached; every old item's name still opens its new home; every row the graphics menu
  // mounted as one flat list is reached through the rail; the test mode without physics holds the solver.
  {
    const R = sandbox.window.FLYDIY_RAIL, G = sandbox.window.GFX;
    if (!R) throw new Error('FLYDIY_RAIL is not published (G760)');
    if (!G || !G.GROUPS) throw new Error('the graphics menu did not run, or has no GROUPS');
    const items = R.items();
    const main = items.filter(i => !i.dev);
    if (items.map(i => i.k).join() !== 'fly,view,sky,graphics,audio,dev') throw new Error('the rail is ' + items.map(i => i.k).join() + ', not FLY / VIEW / SKY & WORLD / GRAPHICS / SOUND / DEV');   // (SOUND: G1600)
    if (main.length < 4 || main.length > 6) throw new Error(main.length + ' main rail items (the user: "not much more than 4-6")');
    if (R.dev() !== false) throw new Error('DEV is on the rail by default (it is behind its toggle)');
    // every old item (the fourteen of FL_RAIL before G760, the WORLD flyout) and every new section has a home
    const OLD = ['camera', 'instruments', 'map', 'trace', 'air', 'start', 'patterns', 'engines', 'controls',
                 'night', 'clouds', 'weather', 'graphics', 'ground', 'world'];
    const NEW = ['route', 'screen', 'scenery', 'log', 'overlays'];
    for (const k of OLD.concat(NEW))
      if (!R.home(k) && !items.some(i => i.k === k)) throw new Error('the old rail item / section `' + k + '` has no home');
    // what each item must reach (a row or a pill each) - one or more per old item, and the moved rows
    const WANT = {
      fly: ['from', 'to', 'taxi out', 'taxi graph', 'glide slopes', 'engine', 'lever', 'thrust', 'sync levers', 'the pilot', 'map the controls…'],
      view: ['field of view', 'level horizon', 'lead the turn', 'free', 'small', 'show', 'large', 'north up', 'the three', 'frame rate', 'fps meter', 'screenshot'],
      sky: ['outside air', 'density altitude', 'wind', 'gusts', 'time of day', 'world'],
      graphics: ['preset'].concat(G.OPTIONS.map(o => o.label)),
      audio: ['sound', 'master', 'engine', 'airframe', 'environment', 'music', 'interface', 'mute when unfocused', 'headset', 'music in flight'],   // G1600 (audio.js); G1722: the engine apart, 'aircraft' is the airframe
      dev: ['physics', 'enter the test mode', 'the WORLD rail', 'flight log', 'save log', 'previous session', 'the F8 panel'],
    };
    // the covering's pills show while #bSkin does (applySkinVis hides it with no model on the stand - this stub's case)
    const skinShown = els['bSkin'] && els['bSkin'].style.display !== 'none';
    if (skinShown) WANT.dev.push('the covering', 'covered', 'frame', 'overlay');
    const reached = { rows: [], pills: [] };
    for (const it of items) {
      const c = R.census(it.k);
      if (c.errors.length) throw new Error('the ' + it.k + ' rail: a section threw: ' + c.errors.join('; '));
      const secs = it.k === 'graphics' ? G.GROUPS.map(g => 'gfx.' + g.k) : it.secs;
      if (c.sections.join() !== secs.join()) throw new Error('the ' + it.k + ' rail built sections ' + c.sections.join() + ', declared ' + secs.join());
      const have = new Set(c.rows.concat(c.pills));
      const miss = WANT[it.k].filter(x => !have.has(x));
      if (miss.length) throw new Error('the ' + it.k + ' rail does not reach: ' + miss.join(', '));
      reached.rows.push(...c.rows); reached.pills.push(...c.pills);
      console.log('rail ' + it.k + (it.dev ? ' (behind the dev toggle)' : '') + ': ' + c.sections.join(' / ') + ' - ' + c.rows.length + ' rows, ' + c.pills.length + ' pills' +
                  (it.k === 'dev' && !skinShown ? ' (the covering hidden with #bSkin: no model on the stand here)' : ''));
    }
    if (R.current() !== null) throw new Error('the census left a flyout open (' + R.current() + ')');
    if (R.dev() !== false) throw new Error('the census of DEV put DEV on the rail (a census saves nothing)');
    // NO GRAPHICS ROW LOST: the menu as the one flat list it was, counted, against the rows the rail reaches
    {
      const flat = { rows: [], pills: [] };
      const stubEl = () => ({ appendChild() {}, classList: { add() {} }, textContent: '', isConnected: false });
      G.mount(stubEl(), { row: (h, l) => { flat.rows.push(l); return stubEl(); },
                          pills: (h, list) => { for (const o of list) flat.pills.push(o.label); return stubEl(); }, note: () => stubEl() });
      const lostR = flat.rows.filter(r => !reached.rows.includes(r)), lostP = flat.pills.filter(p => !reached.pills.includes(p));
      if (lostR.length || lostP.length) throw new Error('graphics rows lost on the way to the rail: ' + lostR.concat(lostP).join(', '));
      console.log('graphics: ' + flat.rows.length + ' rows and ' + flat.pills.length + ' pills flat, every one reached through the rail (' + G.GROUPS.length + ' folds + the map, the meter, the log)');
    }
    // AN OLD NAME OPENS ITS NEW HOME, its fold open (the day panel's door to the clouds, the refreshes)
    for (const [old, home] of [['clouds', 'sky'], ['camera', 'view'], ['engines', 'fly'], ['air', 'sky'], ['world', 'dev']]) {
      R.open(old);
      const sec = old === 'air' ? 'weather' : old;
      if (R.current() !== home || !R.shown().includes(sec)) throw new Error('open(' + old + ') opened ' + R.current() + ' with ' + R.shown().join(',') + ', not ' + home + ' > ' + sec);
      R.open(null);
    }
    if (R.dev() !== true) throw new Error('opening a DEV section by name did not show DEV');
    R.dev(false);
    // THE TEST MODE WITHOUT PHYSICS: held, the aeroplane still, DEV on the rail; left, the flight back
    {
      const P = sandbox.window.FLIGHT_PROBE, SC = sandbox.window.SCENERY;
      if (!SC) throw new Error('window.SCENERY is gone');
      R.open('scenery');
      if (R.current() !== 'dev' || !R.shown().includes('scenery')) throw new Error('the test mode section did not open');
      // the free camera keeps its own clock (performance.now), which this sandbox never had: lent for the test mode
      // only, so no other path of this gate starts timing itself
      const hadPerf = 'performance' in sandbox;
      if (!hadPerf) sandbox.performance = { now: () => Date.now() };
      SC.enter();
      if (!SC.on) throw new Error('SCENERY.enter() did not take');
      const c0 = P.sim().cgPos().slice();
      frames(60);
      const c1 = P.sim().cgPos();
      if (Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]) > 1e-9) throw new Error('the solver stepped in the test mode');
      const c = R.census('dev');
      if (!c.pills.includes('leave the test mode')) throw new Error('the test mode offers no way out on DEV');
      SC.leave();
      if (SC.on) throw new Error('SCENERY.leave() did not take');
      frames(10);
      if (!hadPerf) delete sandbox.performance;
      R.open(null); R.dev(false);
      console.log('the test mode: entered from DEV, the solver held 60 frames, its way out offered, left');
    }
    // THE SHED'S RAIL mirrors it where it mounts the same panels: the clouds a fold of `night`, the graphics
    // in the same folds (editor.js is not executed here - its table is read, as GATE VIEW reads it)
    {
      const ed = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'editor.js'), 'utf8');
      const at = ed.indexOf('const RAIL = ['), st = ed.indexOf('[', at);
      let d = 0, en = -1; for (let i = st; i < ed.length; i++) { if (ed[i] === '[') d++; else if (ed[i] === ']' && !--d) { en = i + 1; break; } }
      const ER = vm.runInNewContext('(' + ed.slice(st, en) + ')');
      if (ER.some(t => t.k === 'clouds')) throw new Error('the shed rail still has a clouds item (a fold of night since G760)');
      if (!/ED_HOME = \{ clouds: 'night' \}/.test(ed) || !/section: \(h, key, title, sub\) => edSection\(h, key, title, sub\)/.test(ed))
        throw new Error('the shed rail does not route clouds to night, or mounts the graphics without its folds');
      console.log('the shed rail: ' + ER.length + ' items (' + ER.map(t => t.k).join(' ') + '), the clouds a fold of night, the graphics in folds');
    }
    // THE KEYS ARE WHERE THEY WERE: F8 the developer panel, F9 the WORLD rail
    for (const [f, key] of [['dev_panel.js', 'F8'], ['world_rail.js', 'F9']])
      if (fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', f), 'utf8').indexOf("e.code !== '" + key + "'") < 0)
        throw new Error(f + ' lost its ' + key + ' key');
  }

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

  // ---- G1090: THE TOP BAR HOLDS ONE SIZE (the user, 2026-09-29: "the top bar with the readings keeps
  // resizing because of the explanation text of what the pilot is doing. It shouldn't resize. Size the box,
  // and have the text flow in its own dedicated area"). A stub DOM has no layout, so the proof is the CSS
  // CONTRACT, read off the artifact's own sheets: the plate (#pfd) has a declared width at each breakpoint and
  // size and clips; every row in it has a declared height; every readout a declared width, tabular figures
  // and a clip; the pilot's status line its own area (contained, two lines clamped), the plan line one clipped
  // line; and no text-driven state (held, an empty line) takes a line out of the flow - `display:none` on
  // one was a resize. Then the plate's box is COMPUTED from the contract for every text the pilot can put in
  // it (every phase label of both rails, the divergence card, the hand-flown line, the longest status and
  // plan lines, the widest numbers and unit labels) and must come out one size per layout. The rig
  // tools/hud_fit_shot.js measures the same in Chromium (440 x 143 desktop, 376 x 132 at 400 px wide).
  {
    const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    // the rules, one level of @media: [{ media, sels: [...], decl: {prop: value} }]
    const rules = [];
    const eat = (txt, media) => {
      let i = 0;
      while (i < txt.length) {
        const o = txt.indexOf('{', i); if (o < 0) break;
        const head = txt.slice(i, o).trim();
        if (head.startsWith('@')) {
          let d = 1, j = o + 1; while (j < txt.length && d) { if (txt[j] === '{') d++; else if (txt[j] === '}') d--; j++; }
          if (/^@media/.test(head)) eat(txt.slice(o + 1, j - 1), head);
          i = j; continue;
        }
        const c = txt.indexOf('}', o);
        const decl = {};
        for (const d of txt.slice(o + 1, c).split(';')) { const k = d.indexOf(':'); if (k > 0) decl[d.slice(0, k).trim()] = d.slice(k + 1).trim(); }
        rules.push({ media, sels: head.split(',').map(x => x.trim().replace(/\s+/g, ' ')), decl });
        i = c + 1;
      }
    };
    eat(css, null);
    // the declarations a selector is written with (exactly), merged in sheet order; `media`: null = the base sheet,
    // 'phone' = the (max-width:760px) block
    const D = (sel, media) => {
      const out = {};
      for (const r of rules) if (r.sels.indexOf(sel) >= 0 && (media === 'phone' ? /max-width:\s*760px/.test(r.media || '') : !r.media)) Object.assign(out, r.decl);
      return out;
    };
    const px = v => { const m = /^(-?[\d.]+)px$/.exec(String(v || '').split(/\s+/)[0]); return m ? +m[1] : NaN; };
    const need = (what, ok) => { if (!ok) throw new Error('G1090 the top bar can resize: ' + what); };
    const fontPx = f => { const m = /(\d+(?:\.\d+)?)px\/(\d+(?:\.\d+)?)px/.exec(f || ''); return m ? [+m[1], +m[2]] : null; };
    // 1. the markup: the pilot's area is its own box, after the rail, holding the status and the plan lines
    const pb = html.slice(html.indexOf('<div id="pfd"'), html.indexOf('<div id="flActs"'));
    need('#phWhy is missing from the plate', /<div id="phWhy"><i id="phNext"><\/i><i id="phPlan"><\/i><\/div>/.test(pb));
    const railM = /<div id="rail"[\s\S]*?<\/button>\s*<\/div>/.exec(pb);
    need('the rail markup', !!railM);
    need('#phNext rides the rail again (its text would widen it)', railM[0].indexOf('phNext') < 0 && railM[0].indexOf('phPlan') < 0);
    need('#phWhy must follow #rail (the held rule is `#rail.held + #phWhy`)', pb.indexOf('id="phWhy"') > pb.indexOf('id="rail"'));
    // 2. the plate: a declared width per layout, a clip, border-box
    const P = D('#ui #pfd'), PS = D('#ui #pfd.small'), PP = Object.assign({}, D('#ui #pfd', 'phone'), D('#ui #pfd, #ui #pfd.small', 'phone'));
    const PPs = rules.filter(r => /max-width:\s*760px/.test(r.media || '') && r.sels.indexOf('#ui #pfd.small') >= 0).reduce((o, r) => Object.assign(o, r.decl), {});
    need('#ui #pfd has no declared width (' + P.width + ')', px(P.width) > 0);
    need('#ui #pfd does not clip', P.overflow === 'hidden');
    need('#ui #pfd is not border-box', P['box-sizing'] === 'border-box');
    need('#ui #pfd.small has no declared width (' + PS.width + ')', px(PS.width) > 0);
    need('on a phone the plate is not the screen\'s width', PP.width === 'auto' && PP['justify-self'] === 'stretch' && PP['min-width'] === '0');
    need('on a phone the small plate keeps a desktop width', PPs.width === 'auto');
    // 3. the readouts: fixed cells, tabular figures, clipped value and unit lines of fixed height
    const RD = D('#ui .rd'), RB = D('#ui .rd b'), RI = D('#ui .rd i');
    need('a readout has no fixed width', px(RD.width) > 0 && RD.flex === 'none' && RD.overflow === 'hidden');
    need('the readout figures are not tabular', /tabular-nums/.test(RB['font-variant-numeric'] || ''));
    need('a readout value can wrap or has no fixed height', RB['white-space'] === 'nowrap' && RB.overflow === 'hidden' && px(RB.height) > 0);
    need('a unit line can wrap or has no fixed height', RI['white-space'] === 'nowrap' && RI.overflow === 'hidden' && px(RI.height) > 0 && RI.display === 'block');
    for (const k of ['nrg', 'netto', 'thr']) need('the ' + k + ' cell has no width of its own', px(D('#ui .rd[data-i="' + k + '"]').width) > px(RD.width));
    const RDp = D('#ui .rd', 'phone'), RBp = D('#ui .rd b', 'phone');
    need('the phone readout has no fixed width / height', px(RDp.width) > 0 && px(RBp.height) > 0);
    const RDs = D('#ui #pfd.small .rd'), RBs = D('#ui #pfd.small .rd b'), RIs = D('#ui #pfd.small .rd i');
    need('the small readout has no fixed width / height', px(RDs.width) > 0 && px(RBs.height) > 0 && px(RIs.height) > 0);
    // 4. the rail: one line of fixed height; the phase name shrinks and clips, never pushes
    const RL = D('#rail'), PN = D('#phName');
    need('the rail has no fixed height or can wrap', px(RL.height) > 0 && RL['flex-wrap'] === 'nowrap' && RL['box-sizing'] === 'border-box');
    need('the rail\'s phase name can size a dragged plate (the rail needs contain:inline-size)', /inline-size/.test(RL.contain || ''));
    need('the phase name can push the rail', PN['min-width'] === '0' && PN.overflow === 'hidden' && PN['text-overflow'] === 'ellipsis' && PN['white-space'] === 'nowrap');
    need('the small rail has no fixed height', px(D('#ui #pfd.small #rail').height) > 0);
    // 5. the pilot's area: fixed, contained; the status clamps at two lines, the plan clips at one
    const WY = D('#phWhy'), NX = D('#phNext'), PL = D('#phPlan');
    need('#phWhy has no fixed height / clip / containment', px(WY.height) > 0 && WY.overflow === 'hidden' && /inline-size/.test(WY.contain || ''));
    need('#phNext does not clamp at two lines', NX['-webkit-line-clamp'] === '2' && NX.overflow === 'hidden' && px(NX.height) > 0);
    const fN = fontPx(NX.font), fP = fontPx(PL.font);
    need('#phNext\'s two lines do not fill its height exactly', fN && Math.abs(2 * fN[1] - px(NX.height)) < 0.01);
    need('#phPlan is not one clipped line', PL['white-space'] === 'nowrap' && PL.overflow === 'hidden' && PL['text-overflow'] === 'ellipsis' && fP && Math.abs(fP[1] - px(PL.height)) < 0.01);
    need('#phWhy does not hold its two lines + the plan line', px(WY.height) >= px(NX.height) + px(PL.height) + (px(PL['margin-top']) || 0));
    // 6. no text-driven state takes a line out: only the small PFD (the player's choice) may hide the area
    for (const r of rules) for (const sl of r.sels) {
      if (!/#phNext|#phPlan|#phWhy|#phName|#rail\b|\.rd b|\.rd i/.test(sl)) continue;
      if (r.decl.display === 'none' && !/\.small|\[hidden\]/.test(sl)) throw new Error('G1090 the top bar can resize: `' + sl + '` sets display:none on a text-driven state (use visibility)');
      if (/:empty/.test(sl)) throw new Error('G1090 the top bar can resize: `' + sl + '` styles a line by its emptiness');
    }
    need('the held status line must hide by visibility', D('#rail.held + #phWhy #phNext').visibility === 'hidden');
    // 7. the app writes no size onto the plate (flLayout moves the map and the trace, never the PFD)
    for (const id of ['pfd', 'pfdRow', 'rail', 'phWhy', 'phNext', 'phPlan', 'phName'])
      if (els[id] && els[id].style && (els[id].style.width || els[id].style.height || els[id].style.getPropertyValue('width')))
        throw new Error('G1090 the app sized #' + id + ' by hand (' + els[id].style.width + ' x ' + els[id].style.height + ')');
    // 8. THE BOX, COMPUTED FROM THE CONTRACT for every text the pilot can produce. Each text is written to the
    // element the app writes it to; that element's box is the contract's (a declared height, a clip, a width
    // inside the plate's), so the plate's box is the same sum whatever the text - asserted per text rather than
    // once, so a future rule that makes ONE of these elements content-sized fails here with the text that moved it.
    const phaseLabels = new Set(['HOLDING', 'GARAGE', 'LOAD TEST', 'SIM DIVERGED — RESET']);
    for (const m of coreBlock.matchAll(/^\s*(?:[A-Z]+: \['[^']*', '[^']*'\],?\s*)+$/gm)) for (const q of m[0].matchAll(/\['([^']*)'/g)) phaseLabels.add(q[1]);
    for (const m of appBlock.matchAll(/\['([A-Z]+)','([A-Z \-]+)'\]/g)) phaseLabels.add(m[2]);
    need('the phase labels were not found (' + phaseLabels.size + ')', phaseLabels.size >= 25);
    const longNext = 'holding short, engine at idle, waiting for the runway to be clear and the checks to be done — run-up 1150/1200 rpm · oil 71/60 °C ✓ · mags ok/ok ✓  [HDG ALT SPD]';
    const texts = [...[...phaseLabels].map(t => ['phName', t]), ['phNext', ''], ['phNext', 'by hand'], ['phNext', longNext], ['phNext', 'x'.repeat(400)],
      ['phPlan', ''], ['phPlan', 'to hold 350 m'], ['phPlan', 'to downwind abeam the threshold 1.2 km · target 305 m (287 agl) · descending −12.3 m/s (limit −5.0)'],
      ['r-ias', '999'], ['r-alt', '9999'], ['r-alt', '-12'], ['r-vs', '-12.3'], ['r-vs', '+12.3'], ['r-nrg', 'EMPTY'], ['r-nrg', '120.5'],
      ['ias-unit', 'km/h gs'], ['ias-unit', 'km/h ias'], ['r-nrgU', 'kWh charge · 1.2 h'], ['r-nrgU', 'L fuel · 45 min']];
    // the contract's box per layout: [width, height], every term a declared number (the text is not an input)
    const boxOf = (lay, id, t) => {
      const small = lay.endsWith('small'), phone = lay.startsWith('phone');
      const pad = small ? [8, 7] : phone ? [9, 9] : [11, 10];
      const w = phone ? 'screen' : px(small ? PS.width : P.width);
      const bH = small ? px(RBs.height) : phone ? px(RBp.height) : px(RB.height), iH = small ? px(RIs.height) : px(RI.height);
      const railH = small ? px(D('#ui #pfd.small #rail').height) : px(RL.height), railM = small ? 8 : px(RL['margin-top']);
      const why = small ? 0 : px(WY.height) + px(WY['margin-top']);
      // where the text lands, and that its box is the contract's (an id nobody styles would be content-sized)
      const host = id === 'phName' ? PN : id === 'phNext' ? NX : id === 'phPlan' ? PL : /^r-|unit/.test(id) ? (id === 'r-nrgU' || id === 'ias-unit' ? RI : RB) : null;
      need('#' + id + ' has no contract (' + JSON.stringify(t).slice(0, 40) + ')', !!host);
      return w + ' x ' + (pad[0] + pad[1] + 2 + bH + iH + railM + railH + why);
    };
    const lays = ['desktop', 'desktop small', 'phone', 'phone small'], seen = {};
    for (const lay of lays) { seen[lay] = new Set(); for (const [id, t] of texts) seen[lay].add(boxOf(lay, id, t)); }
    for (const lay of lays) need(lay + ' plate takes ' + seen[lay].size + ' sizes over ' + texts.length + ' texts: ' + [...seen[lay]].join(' | '), seen[lay].size === 1);
    console.log('G1090 the top bar holds one size over ' + texts.length + ' texts (' + phaseLabels.size + ' phase labels): ' +
      lays.map(l => l + ' ' + [...seen[l]][0]).join(', ') + '; the pilot\'s area ' + px(WY.height) + ' px, two lines clamped + the plan line');
  }

  if (rafCount < 100) throw new Error(`loop stalled (raf x${rafCount})`);
  console.log(`ran app block: raf x${rafCount}, handlers wired: ${Object.keys(handlers).sort().join(' ')}`);
  console.log('GATE UISMOKE: PASS');
} catch (e) {
  console.log(e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : String(e));
  console.log('GATE ' + (PHONE ? 'UISMOKE-PHONE' : 'UISMOKE') + ': FAIL');
  process.exit(1);
}
})();
