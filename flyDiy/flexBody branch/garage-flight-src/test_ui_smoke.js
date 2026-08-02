// Gate: the built artifact's UI block actually RUNS (not just parses).
// Catches unresolved identifiers, wrong call signatures, bad wiring —
// the class of bug node --check cannot see (e.g. the MODEL_OFF regression).
// Stubs: minimal DOM + THREE. Runs setAircraft, the full loop path
// (script/sync/poseModel/hud) for 120 frames, then every button handler.
const fs = require('fs'), vm = require('vm');

const html = fs.readFileSync('./garage-flight.html', 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (blocks.length < 3) { console.log('expected 3 inline blocks'); process.exit(1); }

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
  WebGLRenderer: class { setPixelRatio() {} setSize() {} render() {} },
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
};

// ---- DOM stub ----
const handlers = {};
function el(id) {
  return {
    id, style: {}, textContent: '', innerHTML: '',
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, setPointerCapture() {},
    getContext: () => new Proxy({}, { get: () => () => {} }),
    width: 460, height: 180,
    set onclick(f) { handlers[id] = f; }, get onclick() { return handlers[id]; },
  };
}
const els = {};
let rafCb = null, rafCount = 0;
const sandbox = {
  console, window: { innerWidth: 390, innerHeight: 800, devicePixelRatio: 2,
                     addEventListener() {} },
  document: { getElementById: id => (els[id] = els[id] || el(id)) },
  requestAnimationFrame: cb => { rafCb = cb; rafCount++; },
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  THREE, Buffer,
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);

try {
  vm.runInContext(blocks[0], sandbox, { filename: 'core.js' });      // flight_core
  vm.runInContext(blocks[1], sandbox, { filename: 'models.js' });    // codec + payload
  vm.runInContext(blocks[2], sandbox, { filename: 'app.js' });       // UI (runs setAircraft)
  // drive the loop: HOLDING frames, then press Fly and run 2 s of circuit
  for (let i = 0; i < 30 && rafCb; i++) { const cb = rafCb; rafCb = null; cb(); }
  handlers['bGo'] && handlers['bGo']();
  for (let i = 0; i < 120 && rafCb; i++) { const cb = rafCb; rafCb = null; cb(); }
  // exercise every wired button (Skin cycles all 3 states)
  for (const id of ['bSkin', 'bSkin', 'bSkin', 'bTel', 'bPause', 'bPause',
                    'bDrone', 'bCub', 'bReset'])
    handlers[id] && handlers[id]({ target: els[id] });
  for (let i = 0; i < 30 && rafCb; i++) { const cb = rafCb; rafCb = null; cb(); }
  if (rafCount < 100) throw new Error(`loop stalled (raf x${rafCount})`);
  console.log(`ran app block: raf x${rafCount}, buttons wired: ${Object.keys(handlers).sort().join(' ')}`);
  console.log('UI SMOKE GATE: GREEN');
} catch (e) {
  console.log(e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : String(e));
  console.log('UI SMOKE GATE: RED');
  process.exit(1);
}
