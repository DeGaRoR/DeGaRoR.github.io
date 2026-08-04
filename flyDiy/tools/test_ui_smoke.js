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
  LineBasicMaterial: class {}, PointsMaterial: class {},
  HemisphereLight: class { constructor(){ Object.assign(this, mkObj()); } },
  DirectionalLight: class { constructor(){ Object.assign(this, mkObj()); } },
  TextureLoader: class { load() { return { anisotropy: 0 }; } },
  DoubleSide: 2,
  sRGBEncoding: 0, ACESFilmicToneMapping: 0, PCFSoftShadowMap: 0,
};

// ---- DOM stub ----
const handlers = {};
function el(id) {
  return {
    id, style: {}, textContent: '', innerHTML: '', title: '', className: '',
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
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
  document: { getElementById: id => (els[id] = els[id] || el(id)),
              createElement: () => el('_ce' + (++ceN)) },
  requestAnimationFrame: cb => { rafCb = cb; rafCount++; },
  // timers fire immediately: the point of this gate is to EXECUTE the deferred
  // path (the boot-splash teardown), not to model the event loop
  setTimeout: cb => { cb(); return 0; },
  clearTimeout() {},
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  THREE, Buffer,
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
  for (const id of ['bSkin', 'bSkin', 'bSkin', 'bTel', 'bPause', 'bPause', 'bReset'])
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
  if (rafCount < 100) throw new Error(`loop stalled (raf x${rafCount})`);
  console.log(`ran app block: raf x${rafCount}, handlers wired: ${Object.keys(handlers).sort().join(' ')}`);
  console.log('GATE UISMOKE: PASS');
} catch (e) {
  console.log(e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : String(e));
  console.log('GATE UISMOKE: FAIL');
  process.exit(1);
}
