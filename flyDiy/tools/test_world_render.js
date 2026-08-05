// Gate: the world renderer's tree field is chunked so that it can be culled,
// and every instance actually lies inside the sphere it will be culled by.
//
// render_world.js had no coverage at all — UISMOKE stubs buildWorldScene out —
// so the chunking rework was landing on syntax checks alone. The invariant this
// gate exists for: three culls an InstancedMesh on its GEOMETRY's bounding
// sphere transformed by the mesh matrix. Because the geometry is SHARED across
// chunks, the sphere is inflated once to a chunk half-diagonal and instances
// are stored chunk-LOCAL. If any instance escapes that sphere, the chunk gets
// culled while that tree is still on screen — and against the sun's shadow
// camera the symptom is trees silently popping out of shadow, which is exactly
// the kind of thing an eyeball test misses.
const path = require('path');
const { makeWorld } = require('./flight_core.js');

let ok = true, why = [];
const chk = (c, m) => { if (!c) { ok = false; why.push(m); } };

// ---- minimal THREE stub: records what the world builder creates ------------
const V3 = class {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new V3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addScaledVector(v, s) { this.x += v.x*s; this.y += v.y*s; this.z += v.z*s; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  subVectors(a, b) { return this.set(a.x-b.x, a.y-b.y, a.z-b.z); }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  crossVectors(a, b) { return this.set(a.y*b.z-a.z*b.y, a.z*b.x-a.x*b.z, a.x*b.y-a.y*b.x); }
  normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; return this.multiplyScalar(1/l); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  applyAxisAngle() { return this; }
  setScalar(s) { return this.set(s, s, s); }
  addVectors(a, b) { return this.set(a.x+b.x, a.y+b.y, a.z+b.z); }
  distanceTo(v) { return Math.hypot(this.x-v.x, this.y-v.y, this.z-v.z); }
  lerp() { return this; } applyQuaternion() { return this; } applyMatrix4() { return this; }
  dot(v) { return this.x*v.x + this.y*v.y + this.z*v.z; } negate() { return this.multiplyScalar(-1); }
  setFromMatrixPosition(m) { return this.set(m.elements[12], m.elements[13], m.elements[14]); }
};
const noop = function () { return this; };
class Geo {
  constructor(tag) { this.tag = tag; this.boundingSphere = null; this.attributes = {}; }
  computeBoundingSphere() { this.boundingSphere = this.boundingSphere ||
    { center: new V3(), radius: 1 }; return this; }
  translate() { return this; } scale() { return this; }
  rotateX() { return this; } rotateY() { return this; } rotateZ() { return this; }
  clone() { const g = new Geo(this.tag); g.attributes = this.attributes; return g; }
  applyMatrix4() { return this; } center() { return this; }
  computeBoundingBox() { this.boundingBox = { min: new V3(), max: new V3() }; return this; }
  setAttribute(n, a) { this.attributes[n] = a; return this; }
  setIndex() { return this; } dispose() {} computeVertexNormals() { return this; }
}
// a real position attribute: the terrain bake walks the plane grid and writes
// heights into it, so this one cannot be faked away
class Attr {
  constructor(n, is = 3) { this.count = n; this.itemSize = is;
    this.array = new Float32Array(n * is); this.needsUpdate = false; }
  setXY(i, x, y) { this.array[i*this.itemSize] = x; this.array[i*this.itemSize+1] = y; }
  getX(i) { return this.array[i*3]; } getY(i) { return this.array[i*3+1]; }
  getZ(i) { return this.array[i*3+2]; }
  setX(i, v) { this.array[i*3] = v; } setY(i, v) { this.array[i*3+1] = v; }
  setZ(i, v) { this.array[i*3+2] = v; }
  setXYZ(i, x, y, z) { this.setX(i,x); this.setY(i,y); this.setZ(i,z); }
}
class Obj3 {
  constructor() { this.position = new V3(); this.rotation = new V3(); this.scale = new V3(1,1,1);
    this.children = []; this.visible = true; this.frustumCulled = true;
    this.quaternion = { setFromUnitVectors() { return this; }, setFromAxisAngle() { return this; },
                        copy() { return this; }, identity() { return this; } };
    this.matrix = new Mat4(); this.matrixWorld = new Mat4(); this.matrixAutoUpdate = true;
    this.renderOrder = 0; this.userData = {};
    this.castShadow = false; this.receiveShadow = false; }
  add(o) { this.children.push(o); return this; }
  remove(o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); return this; }
  traverse(f) { f(this); this.children.forEach(c => c.traverse && c.traverse(f)); }
  lookAt() {} updateMatrixWorld() {} updateProjectionMatrix() {}
  clone() { const o = Object.create(Object.getPrototypeOf(this));
    Object.assign(o, this); o.position = this.position.clone();
    o.rotation = this.rotation.clone(); o.scale = this.scale.clone();
    o.children = []; if (o.isMesh || o.isInstancedMesh) CREATED.push(o); return o; }
}
const CREATED = [];
const PMREM = { n: 0, args: null, disposed: false };
class InstancedMesh extends Obj3 {
  constructor(geometry, material, count) {
    super(); this.isInstancedMesh = true; this.geometry = geometry; this.material = material;
    this.count = count; this.mats = new Array(count).fill(null);
    this.instanceMatrix = { needsUpdate: false }; this.instanceColor = { needsUpdate: false };
    CREATED.push(this);
  }
  setMatrixAt(i, m) { this.mats[i] = [m.elements[12], m.elements[13], m.elements[14]]; }
  setColorAt() {}
  dispose() {}
}
class Mat4 {
  constructor() { this.elements = new Array(16).fill(0); }
  compose(p) { this.elements[12] = p.x; this.elements[13] = p.y; this.elements[14] = p.z; return this; }
  makeRotationY() { return this; } identity() { return this; }
}
class Col {
  constructor(h = 0) { this.h = h; }
  convertSRGBToLinear() { return this; } copy(c) { this.h = c.h; return this; }
  lerp() { return this; } clone() { return new Col(this.h); } getHex() { return this.h; }
  setHSL() { return this; } multiplyScalar() { return this; } setHex(h) { this.h = h; return this; }
  setRGB() { return this; } set(h) { this.h = h; return this; } add() { return this; }
  offsetHSL() { return this; } getHexString() { return '000000'; }
  get r() { return 0.5; } get g() { return 0.5; } get b() { return 0.5; }
}
// A 2D context whose unknown methods are no-ops: the world bakes several
// terrain/minimap textures through canvas and the exact call list is not what
// this gate is about. Values that callers actually read are real.
const REAL = {
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  createPattern: () => ({}),
  measureText: () => ({ width: 10 }),
};
const ctx2d = () => new Proxy({}, {
  get: (t, k) => (k in REAL ? REAL[k] : (k in t ? t[k] : () => {})),
  set: (t, k, v) => { t[k] = v; return true; },
});
global.document = { createElement: () => ({ width: 0, height: 0, getContext: ctx2d }) };
const THREE = {
  Vector3: V3, Matrix4: Mat4, Color: Col, Quaternion: class { setFromAxisAngle() { return this; } },
  Group: Obj3, Mesh: class extends Obj3 { constructor(g, m) { super(); this.isMesh = true;
    this.geometry = g; this.material = m; CREATED.push(this); } },
  InstancedMesh, Points: class extends Obj3 {}, Fog: class {},
  BufferGeometry: class extends Geo {},
  PlaneGeometry: class extends Geo {
    constructor(w = 1, h = 1, ws = 1, hs = 1) {
      super('plane');
      const a = new Attr((ws + 1) * (hs + 1));
      for (let j = 0, i = 0; j <= hs; j++) for (let k = 0; k <= ws; k++, i++)
        a.setXYZ(i, -w/2 + w * k / ws, 0, -h/2 + h * j / hs);
      this.attributes.position = a;
      this.attributes.uv = new Attr((ws + 1) * (hs + 1), 2);
      this.attributes.normal = new Attr((ws + 1) * (hs + 1));
    }
  },
  Scene: class extends Obj3 {},
  OrthographicCamera: class extends Obj3 { constructor() { super(); this.up = new V3(0,1,0); } },
  // W17 impostor bake: the stub renderer below has no setRenderTarget, so
  // render_world falls back to a texture-less atlas. The BAKE itself is GL and
  // cannot be gated headless; what this gate is for is the chunk/instance
  // bookkeeping around it, which is where the cull bugs live.
  WebGLRenderTarget: class { constructor(w, h) { this.texture = { w, h }; } },
  // W18 reflection map. fromScene is GL, but everything AROUND it is ordinary
  // JS that can silently stop happening — a guard that goes false, a bake that
  // never assigns scene.environment — and then the world just quietly has no
  // reflections again. Count the calls and check the assignment.
  PMREMGenerator: class {
    constructor(r) { PMREM.n++; this.r = r; }
    fromScene(sc, sigma, near, far) {
      PMREM.args = { objs: sc.children.length, sigma, near, far };
      return { texture: { isPMREM: true } };
    }
    dispose() { PMREM.disposed = true; }
  },
  MeshBasicMaterial: class { constructor(o) { Object.assign(this, o); } dispose() {} },
  MeshDepthMaterial: class { constructor(o) { Object.assign(this, o); } dispose() {} },
  BoxGeometry: class extends Geo {}, SphereGeometry: class extends Geo {},
  ConeGeometry: class extends Geo { constructor() { super('cone'); } },
  CylinderGeometry: class extends Geo { constructor() { super('trunk'); } },
  IcosahedronGeometry: class extends Geo { constructor() { super('blob'); } },
  TorusGeometry: class extends Geo {},
  Float32BufferAttribute: class { constructor(a, n) { this.array = a; this.itemSize = n;
    this.count = (a.length || a) / n; } },
  MeshLambertMaterial: class { constructor(o) { Object.assign(this, o); } dispose() {} },
  MeshStandardMaterial: class { constructor(o) { Object.assign(this, o); } dispose() {} },
  PointsMaterial: class { constructor(o) { Object.assign(this, o); } dispose() {} },
  ShaderMaterial: class { constructor(o) { Object.assign(this, o); } dispose() {} },
  CanvasTexture: class { constructor() { this.wrapS = this.wrapT = 0; } dispose() {} },
  DirectionalLight: class extends Obj3 { constructor() { super();
    this.shadow = { mapSize: { set() {} }, camera: { left:0, right:0, top:0, bottom:0, near:0, far:0,
      updateProjectionMatrix() {} }, bias: 0, normalBias: 0 }; this.target = new Obj3(); } },
  HemisphereLight: class extends Obj3 {},
  RepeatWrapping: 1000, DoubleSide: 2, BackSide: 1, sRGBEncoding: 3000,
  LinearFilter: 1006, LinearMipmapLinearFilter: 1008, RGBAFormat: 1023,
  RGBADepthPacking: 3201,
};
global.THREE = THREE;

// ---- run the real world builder -------------------------------------------
const fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'render_world.js'), 'utf8');
const scene = new Obj3(); scene.fog = null;
const camera = new Obj3(); camera.far = 6000;
// A renderer stub with the whole draw-state surface the two boot-time bakes
// touch. It renders nothing — but with it present, the impostor atlas loop and
// the environment bake both RUN, so their plain-JS half (tile indexing, state
// save/restore, the guards) is covered instead of being skipped wholesale.
const GLCALLS = { render: 0, viewport: 0, clearDepth: 0 };
const renderer = {
  capabilities: { getMaxAnisotropy: () => 4 },
  autoClear: true,
  getRenderTarget: () => null, setRenderTarget() {},
  getClearAlpha: () => 1, getClearColor: () => null, setClearColor() {},
  clear() {}, clearDepth() { GLCALLS.clearDepth++; },
  setScissorTest() {}, setScissor() {}, setViewport() { GLCALLS.viewport++; },
  render() { GLCALLS.render++; },
};
let WF;
try {
  const factory = new Function('THREE', 'document', src + '\nreturn buildWorldScene;');
  WF = factory(THREE, global.document)(scene, makeWorld(), renderer, camera);
} catch (e) {
  console.log('world build threw:\n' + (e.stack || e).toString().split('\n').slice(0, 5).join('\n'));
  console.log('GATE WORLDRENDER: FAIL');
  process.exit(1);
}
// stream a few chunks in, as flying over the world would
for (let i = 0; i < 60; i++) WF.worldUpdate([0, 120, 0]);

// ---- assertions -----------------------------------------------------------
// only the chunked tree field: render_world marks those geometries, so an
// unrelated cylinder InstancedMesh elsewhere in the world cannot false-positive
const trees = CREATED.filter(o => o.isInstancedMesh &&
                                  o.geometry.userData && o.geometry.userData.chunkTree);
const byTag = t => trees.filter(o => o.geometry.tag === t);
const inst = list => list.reduce((a, m) => a + m.count, 0);
console.log(`tree meshes: ${trees.length} chunks | trunks ${inst(byTag('trunk'))} ` +
            `cones ${inst(byTag('cone'))} blobs ${inst(byTag('blob'))}`);
chk(trees.length > 20, `only ${trees.length} tree chunks — is the field still one world-sized mesh?`);
chk(inst(byTag('trunk')) > 1000, 'no trunk instances');
// trunks exist for every woodland tree; canopies split by species and must match
// every woodland tree gets a trunk and a canopy; the streamed fill layer adds
// canopies only, so canopies must outnumber trunks and neither may collapse
chk(inst(byTag('cone')) + inst(byTag('blob')) > inst(byTag('trunk')),
    'canopies do not outnumber trunks — is the streamed fill layer building?');

// THE invariant: every instance inside the sphere its chunk is culled by.
let escaped = 0, worst = 0, checked = 0, noSphere = 0;
for (const m of trees) {
  const bs = m.geometry.boundingSphere;
  if (!bs) { noSphere++; console.log(`  NO SPHERE: tag=${m.geometry.tag} count=${m.count} ` +
    `pos=${m.position.x.toFixed(0)},${m.position.z.toFixed(0)}`); continue; }
  for (let i = 0; i < m.count; i++) {
    const t = m.mats[i];
    if (!t) continue;
    checked++;
    // instance is chunk-local; the cull sphere is centred on the mesh position
    const dx = t[0] - bs.center.x, dy = t[1] - bs.center.y, dz = t[2] - bs.center.z;
    const d = Math.hypot(dx, dy, dz);
    worst = Math.max(worst, d);
    if (d > bs.radius) { escaped++;
      if (escaped <= 3) console.log(`  ESCAPED: tag=${m.geometry.tag} r=${bs.radius.toFixed(0)} ` +
        `d=${d.toFixed(0)} local=(${t[0].toFixed(0)}, ${t[1].toFixed(0)}, ${t[2].toFixed(0)})`); }
  }
}
console.log(`cull check: ${checked} instances, worst offset ${worst.toFixed(0)} m, ` +
            `sphere radius ${trees[0].geometry.boundingSphere.radius.toFixed(0)} m, escaped ${escaped}`);
chk(noSphere === 0, `${noSphere} tree chunks have no bounding sphere — they cannot be culled correctly`);
chk(escaped === 0, `${escaped} instances fall outside their chunk's cull sphere ` +
                   '(they would vanish, or drop out of shadow, while still on screen)');
chk(worst > 100, `worst offset only ${worst.toFixed(0)} m — instances look world-relative, not chunk-local`);

// ---- W18 reflection map ----------------------------------------------------
console.log(`env: pmrem x${PMREM.n} ${JSON.stringify(PMREM.args)} disposed=${PMREM.disposed} ` +
            `| bake render() x${GLCALLS.render}, viewports x${GLCALLS.viewport}`);
chk(PMREM.n === 1, `PMREMGenerator built ${PMREM.n} times — the reflection map is baked ONCE, at boot`);
chk(!!scene.environment && scene.environment.isPMREM,
    'scene.environment is not the baked cube — every Standard material (water, ' +
    'aircraft skin) silently loses its reflections');
chk(PMREM.args && PMREM.args.objs === 2,
    `env scene has ${PMREM.args && PMREM.args.objs} objects — want sky dome + ground hemisphere`);
chk(PMREM.args && PMREM.args.near > 0 && PMREM.args.far > PMREM.args.near,
    'env cube camera near/far do not bracket the dome');
chk(PMREM.disposed, 'PMREMGenerator not disposed — it holds render targets for the life of the page');
// the impostor atlas bake, whose GL half cannot be gated but whose loop can be
chk(GLCALLS.viewport === GLCALLS.render && GLCALLS.render > 0,
    `impostor bake did ${GLCALLS.render} renders for ${GLCALLS.viewport} viewports — ` +
    'every tile must get its own viewport or views land on top of each other');
chk(GLCALLS.render % 16 === 0,
    `${GLCALLS.render} bake renders is not a whole number of 4x4 view grids`);

// ---- W17 LOD ladder --------------------------------------------------------
// Every canopy tree must exist in BOTH tiers: the 3D mesh the near band draws
// and the impostor quad the mid band draws. Miss one and a whole species
// vanishes at 450 m (or, worse, gets drawn twice everywhere).
const imp = byTag('plane'), solid3D = inst(byTag('cone')) + inst(byTag('blob'));
chk(inst(imp) === solid3D,
    `impostor instances ${inst(imp)} != canopy instances ${solid3D} — a tier is missing trees`);
chk(imp.length > 20, `only ${imp.length} impostor chunks`);
chk(imp.every(m => !m.castShadow),
    'impostors cast shadows — they are camera-facing quads, the shadow would be a flat slab');
// the near tier's shadow-pass cull: the depth material is the ONLY way to reach
// the shadow pass, and without it the whole near chunk is submitted twice
const shad = trees.filter(m => m.castShadow);
chk(shad.length > 0 && shad.every(m => m.customDepthMaterial),
    `${shad.filter(m => !m.customDepthMaterial).length} shadow-casting tree chunks have no ` +
    'depth-material cull — the forest is still drawn twice');
// the trap this cost real time: chunkBounds inflates boundingSphere to a chunk,
// so the impostor bake must read the SHAPE's sphere off the stash. If it ever
// recomputes instead, the inflation is silently undone and culling breaks.
for (const m of [byTag('cone')[0], byTag('blob')[0]]) {
  const sh2 = m.geometry.userData.shape;
  chk(sh2 && sh2.r < 20, `tree shape sphere ${sh2 && sh2.r} m — that is the CHUNK sphere, ` +
      'the impostor bake and the cull sphere are fighting over one field');
}
// the ladder actually switches: after 60 updates at the origin the 3D tier is
// mostly off and the impostor tier reaches much further out
const at = m => Math.hypot(m.position.x, m.position.z);
const solid = trees.filter(m => m.geometry.tag !== 'plane');
const onSolid = solid.filter(m => m.visible), onImp = imp.filter(m => m.visible);
console.log(`LOD @origin: 3D ${onSolid.length}/${solid.length} chunks on ` +
            `(furthest ${Math.max(0, ...onSolid.map(at)).toFixed(0)} m) | ` +
            `impostor ${onImp.length}/${imp.length} on ` +
            `(furthest ${Math.max(0, ...onImp.map(at)).toFixed(0)} m)`);
chk(onSolid.length > 0, 'no 3D tree chunk is visible at the origin');
chk(onSolid.length < solid.length * 0.5,
    'the 3D tier is still submitting most of the world — is lodUpdate wired into worldUpdate?');
chk(Math.max(0, ...onSolid.map(at)) < 2600, 'a 3D tree chunk is on beyond the near band');
chk(Math.max(0, ...onImp.map(at)) > Math.max(0, ...onSolid.map(at)),
    'impostors do not reach further than the 3D tier — the ladder is upside down');

// culling must actually be left on for the tree field
const off = trees.filter(m => m.frustumCulled === false).length;
chk(off === 0, `${off} tree chunks still have frustumCulled = false`);

// the sphere must be big enough to contain a whole chunk, or chunks pop
for (const m of trees.slice(0, 5))
  chk(m.geometry.boundingSphere.radius > 700,
      `cull sphere ${m.geometry.boundingSphere.radius} m is smaller than a chunk`);

console.log(why.join('\n'));
console.log(ok ? 'GATE WORLDRENDER: PASS' : 'GATE WORLDRENDER: FAIL');
process.exit(ok ? 0 : 1);
