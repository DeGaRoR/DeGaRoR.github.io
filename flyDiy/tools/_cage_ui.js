// CAGE UI — the shared demonstrator runtime for _cage2/_cage3 (and later
// pages). Throwaway, gitignored with the _cage* family, never in MANIFEST.
//
// Rendering is THREE.JS (the project's pinned vendor/three.min.js, r128)
// with a real z-buffer — the earlier hand-rolled canvas painter caused a
// stream of sort/culling artefacts that were pure renderer, not geometry
// (user verdict: "I'm fed up diagnosing renderer issues"). Pages must load
// ../vendor/three.min.js before this file.
//
// A page defines window.CAGE_PAGE = {
//   defaults:   param overrides applied on top of CAGE_PARAMS,
//   groups:     extra advanced slider groups (appended to the base set),
//   defaultStep:'crease' | '2' | ...,
//   presets:    { name: {param overrides} } shown in a preset menu,
// } then loads _cage_gen.js and this file. The page's HTML skeleton must
// carry the header controls and the #view/#ui layout (see _cage2.html).
'use strict';
(() => {
const G = window.CAGE2;
const PAGE = window.CAGE_PAGE || {};
const $ = id => document.getElementById(id);

const SEC = {
  body:            '#8b95a2',
  windshield:      '#cc2f47',
  pillarWindow:    '#cc8314',
  pilotWindow:     '#1b67cc',
  pillarCabin:     '#12cc10',
  pasengerWindow:  '#5ecc12',
  pillarPassenger: '#2b28cc',
  pillarTail:      '#cc2b80',
  pillarFront:     '#8a5ecc',
  skyWindows:      '#cc5a12',
  ceilingLoop:     '#3a3a3a',
  floorLoop:       '#1c1c1c',
  waistband:       '#cc12a8',
  joint:           '#d8dde4',
  bulkhead:        '#8a7a5f',
  firewall:        '#8a4a2f',
  dash:            '#333a45',
  tube:            '#93a0ad',
  plywood:         '#b5854e',
  woodFrame:       '#8a6134',
  cloth:           '#cfc6b2',
  composite:       '#3a3f46',
  aluminium:       '#c3c9d0',
  toele:           '#aab3bd',
};

// ---- parameters -----------------------------------------------------------
const DEFAULTS = Object.assign(
  JSON.parse(JSON.stringify(G.CAGE_PARAMS)), PAGE.defaults || {});
const P = JSON.parse(JSON.stringify(DEFAULTS));

// MACROS RETIRED (user ruling 2026-08-17): multipliers over base params
// were two ways to state one fact — save-format ambiguity. Everything
// goes through sections now.

const BASE_GROUPS = [
  ['layout', [
    ['paxCount',  'pax bays',      0, 4, 1],
    ['paxLen',    'pax len',       0.4, 3.0, 0.01],
    ['pilotLen',  'pilot len',     0.3, 2.0, 0.01],
    ['boomLen',   'boom len',      1.0, 6.0, 0.01],
    ['tailLen',   'tail len',      0.05, 0.6, 0.005],
    ['pillarW',   'pillar width',  0.00, 0.30, 0.005],
    ['cabPillarW','cabin pillar',  0.02, 0.30, 0.005],
    ['paxPillarW','pax pillar',    0.02, 0.30, 0.005],
  ]],
  ['section', [
    ['halfW',     'half width',    0.20, 1.00, 0.005],
    ['roofHalfW', 'roof half-W',   0.15, 0.90, 0.005],
    ['roofY',     'roof y',        0.40, 1.60, 0.005],
    ['keelY',     'keel y',       -1.60, -0.30, 0.005],
    ['floorY',    'floor y',      -1.20, 0.00, 0.005],
    ['ceilInset', 'ceil inset x',  0.20, 3.00, 0.01],
    ['waistY',    'waist y',      -0.40, 0.50, 0.005],
    ['bandH',     'band height',   0.01, 0.30, 0.002],
    ['ringPullIn','sill pull-in',  0.00, 0.15, 0.002],
  ]],
  ['aft + tail', [
    ['aftRoofY',  'aft roof y',    0.20, 1.20, 0.005],
    ['aftKeelY',  'aft keel y',   -1.20, -0.10, 0.005],
    ['tailHalfW', 'tail half-W',   0.02, 0.40, 0.002],
    ['tailRoofY', 'tail roof y',   0.10, 1.00, 0.005],
    ['tailKeelY', 'tail keel y',  -0.50, 0.30, 0.005],
  ]],
  ['windshield', [
    ['wsRun',     'w/s run',       0.20, 2.00, 0.01],
    ['wsTopOff',  'w/s top off',   0.00, 0.50, 0.005],
    ['wsBaseBow', 'base bow',      0.00, 1.20, 0.01],
    ['wsCeilBow', 'ceil bow',      0.00, 0.60, 0.005],
    ['apilW',     'A-pillar w x',  0.20, 3.00, 0.01],
    ['apilPerp',  'A-pillar perp', 0, 1, 0.05],
  ]],
  ['nose', [
    ['noseLen',   'nose len',      0.20, 2.50, 0.01],
    ['noseW',     'nose w x',      0.50, 1.50, 0.01],
    ['pfW',       'front pillar x',0.30, 3.00, 0.01],
  ]],
  ['creases', [
    ['crPillar',  'pillars',       0, 3, 0.05],
    ['crSill',    'sill',          0, 3, 0.05],
    ['crBand',    'waistband',     0, 3, 0.05],
    ['crCeil',    'ceil rail',     0, 3, 0.05],
    ['crFrame',   'w/s frame',     0, 3, 0.05],
    ['crCap',     'caps',          0, 3, 0.05],
  ]],
  ['glazing', [
    ['skylight',  'skylight',      0, 1, 1],
    ['skyExt',    'sky extent',    0, 5, 1],
    ['winSillPilot', 'pilot win sill', 0, 0.9, 0.01],
    ['winSillPax',   'pax win sill',   0, 0.9, 0.01],
  ]],
  ['cutting', [
    ['cutParts',  'cut parts',     0, 1, 1],
  ]],
  ['interior', [
    ['intOn',     'interior on',   0, 1, 1],
    ['intCons',   'construction',  0, 3, 1, ['composite', 'steel tube',
                                             'plywood', 'aluminium']],
    ['intBulk',   'aft bulkhead',  0, 1, 1],
    ['intFire',   'firewall',      0, 1, 1],
    ['intPillars','pillar bodies', 0, 1, 1],
    ['shellT',    'shell thickness', 0.01, 0.10, 0.002],
    ['intDash',   'dashboard',     0, 1, 1],
    ['dashBack',  'dash setback',  0.01, 0.30, 0.005],
    ['dashLip',   'dash lip height', 0.01, 0.10, 0.002],
    ['dashDepth', 'dash depth',    0.05, 0.80, 0.01],
    ['dashCrease','dash crease',   0, 3, 0.05],
  ]],
  ['window joints', [
    ['rimW',      'rim size',     0.00, 0.04, 0.001],
    ['rimSides',  'rim sides',    4, 10, 1],
    ['rimArc',    'corner sections', 1, 6, 1],
    ['rimWin',    'window rims',  0, 1, 1],
    ['rimWs',     'w/s rim',      0, 1, 1],
    ['rimDoor',   'door rim',     0, 1, 1],
    ['doorOn',    'pilot door',   0, 1, 1],
    ['doorPax',   'pax doors',    0, 1, 1],
    ['doorDeep',  'door to belly',0, 1, 1],
    ['doorSill',  'door sill',    0, 0.25, 0.002],
    ['doorSillPax','pax door sill',0, 0.25, 0.002],
  ]],
];
// a page may REPLACE the whole panel (the curated tree preview) or just
// append extra groups to the base set
const GROUPS = PAGE.groupsOverride
  ? PAGE.groupsOverride
  : BASE_GROUPS.concat(PAGE.groups || []);
// items may nest one level: ['sub name', [items...], 'open'?]
const flatItems = items => items.flatMap(it =>
  Array.isArray(it[1]) ? flatItems(it[1]) : [it]);

// ---- three.js scene -------------------------------------------------------
let yaw = -0.85, pitch = 0.30, drag = null, ZOOM = 1;
let M0 = null, MS = null;
const cv = $('c');
const renderer = new THREE.WebGLRenderer({
  canvas: cv, antialias: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x12151a);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
scene.add(new THREE.HemisphereLight(0xdfe8f2, 0x33383f, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(-3, 4, -5);
scene.add(sun);
const sun2 = new THREE.DirectionalLight(0xcfd8ff, 0.25);
sun2.position.set(4, -1, 3);
scene.add(sun2);
let meshObj = null, cageObj = null, refObj = null, loopsObj = null;
let centre = new THREE.Vector3(), fitR = 3, centreOv = null;

const matCache = {};
// view transparency: THREE CONCEPTUAL FAMILIES (user 2026-08-19), each
// with its own alpha — fuselage (the exterior cage skin), interior SKIN
// (the sheet linings: plywood/toele/cloth/composite shell) and interior
// STRUCTURE (frames, posts, tubes, dash, bulkhead, firewall). Glass
// keeps its own alpha on top.
const VIEW = { glassA: 0.35, bodyA: 1, skinA: 1, structA: 1, loops: 1 };
const GLASSM = new Set(['windshield', 'pilotWindow', 'pasengerWindow',
                        'skyWindows']);
const INTSKIN = new Set(['plywood', 'cloth', 'composite', 'toele']);
const INTSTRUCT = new Set(['bulkhead', 'firewall', 'dash', 'tube',
                           'woodFrame', 'aluminium']);
const alphaOf = name =>
  GLASSM.has(name) ? Math.min(VIEW.glassA, VIEW.bodyA)
    : INTSKIN.has(name) ? VIEW.skinA
    : INTSTRUCT.has(name) ? VIEW.structA
    : VIEW.bodyA;
const colOf = name => new THREE.Color(
  !$('color').checked ? '#b9c6d4' : (SEC[name] || '#5a6470'));
const matOf = name => {
  const a = alphaOf(name);
  const neutral = !$('color').checked;
  const key = (neutral ? 'n:' : 'c:') + name + ':' + a;
  if (!matCache[key]) {
    matCache[key] = new THREE.MeshLambertMaterial({
      color: colOf(name),
      // glass is FRONT-SIDE only: with DoubleSide transparency the FAR
      // side of a curved pane rendered through the near one — its limb
      // read as a phantom circle on the bubble (user report). Interiors
      // + cutaway keep backfaces on everything else.
      side: GLASSM.has(name) ? THREE.FrontSide : THREE.DoubleSide,
      transparent: a < 1,
      opacity: a,
      depthWrite: a >= 1,          // translucent surfaces never occlude
    });
  }
  return matCache[key];
};

function meshFrom(m) {
  // indexed geometry with per-material groups: welded verts give the same
  // smooth normals the game viewer computes
  const pos = new Float32Array(m.V.length * 3);
  m.V.forEach((v, i) => { pos[i*3] = v[0]; pos[i*3+1] = v[1]; pos[i*3+2] = v[2]; });
  const byMat = new Map();
  m.F.forEach(f => {
    if (!byMat.has(f.m)) byMat.set(f.m, []);
    const t = byMat.get(f.m);
    t.push(f.v[0], f.v[1], f.v[2], f.v[0], f.v[2], f.v[3]);
  });
  const idx = [], mats = [], groups = [];
  for (const [name, tris] of byMat) {
    groups.push([idx.length, tris.length, mats.length]);
    for (const i of tris) idx.push(i);
    mats.push(name);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  for (const [start, count, mi] of groups) g.addGroup(start, count, mi);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mats.map(matOf));
}

// QUAD WIREFRAME (user 2026-08-19: "not triangulated, only quad topo").
// material.wireframe draws the TRIANGULATION the renderer needs — this
// walks the real face cycles instead, one LineSegments per material so
// the section colours and the family alphas still apply.
function quadWire(m) {
  const g = new THREE.Group();
  const byMat = new Map();
  for (const f of m.F) {
    if (!byMat.has(f.m)) byMat.set(f.m, []);
    byMat.get(f.m).push(f);
  }
  for (const [name, faces] of byMat) {
    const seen = new Set(), pos = [];
    for (const f of faces) {
      const vs = f.v;
      for (let k = 0; k < vs.length; k++) {
        const a = vs[k], b = vs[(k + 1) % vs.length];
        if (a === b) continue;                  // self-edge convention
        const key = a < b ? a + '_' + b : b + '_' + a;
        if (seen.has(key)) continue;
        seen.add(key);
        const A = m.V[a], B = m.V[b];
        pos.push(A[0], A[1], A[2], B[0], B[1], B[2]);
      }
    }
    if (!pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(pos), 3));
    const a = alphaOf(name);
    g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: colOf(name), transparent: a < 1, opacity: a })));
  }
  return g;
}

function curvatureMesh(m) {
  // non-indexed, per-face heat colour by max dihedral to neighbours
  const N = m.F.map(f => {
    const p = f.v.map(i => m.V[i]);
    const u = [p[1][0]-p[0][0], p[1][1]-p[0][1], p[1][2]-p[0][2]];
    const w = [p[3][0]-p[0][0], p[3][1]-p[0][1], p[3][2]-p[0][2]];
    const n = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return [n[0]/l, n[1]/l, n[2]/l];
  });
  const EF = new Map();
  m.F.forEach((f, fi) => {
    for (let k = 0; k < 4; k++) {
      const a = f.v[k], b = f.v[(k+1)%4], key = a < b ? a+'_'+b : b+'_'+a;
      if (!EF.has(key)) EF.set(key, []);
      EF.get(key).push(fi);
    }
  });
  const dih = new Float32Array(m.F.length);
  for (const l of EF.values()) if (l.length === 2) {
    const d = Math.max(-1, Math.min(1,
      N[l[0]][0]*N[l[1]][0] + N[l[0]][1]*N[l[1]][1] + N[l[0]][2]*N[l[1]][2]));
    const a = Math.acos(d) * 180 / Math.PI;
    if (a > dih[l[0]]) dih[l[0]] = a;
    if (a > dih[l[1]]) dih[l[1]] = a;
  }
  const pos = [], col = [];
  m.F.forEach((f, fi) => {
    const a = Math.min(1, dih[fi] / 16);
    const r = 0.16 + 0.84 * Math.min(1, a * 2);
    const gg = 0.47 + 0.4 * (1 - a) - 0.35 * Math.max(0, a * 2 - 1);
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const v = m.V[f.v[i]];
      pos.push(v[0], v[1], v[2]);
      col.push(r, Math.max(0.08, gg), 0.12);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
}

function edgeLines(m, color, opacity) {
  const seen = new Set(), pos = [];
  for (const f of m.F || []) {
    const vs = f.v || f;
    for (let k = 0; k < vs.length; k++) {
      const a = vs[k], b = vs[(k+1)%vs.length];
      const key = a < b ? a+'_'+b : b+'_'+a;
      if (seen.has(key)) continue;
      seen.add(key);
      const A = m.V[a], B = m.V[b];
      pos.push(A[0], A[1], A[2], B[0], B[1], B[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({
    color, transparent: opacity < 1, opacity }));
}

function disposeObj(o) {
  if (!o) return;
  o.traverse ? o.traverse(c => { if (c.geometry) c.geometry.dispose(); }) : 0;
  scene.remove(o);
}

// ---- the measurement pane + box -------------------------------------------
// The plane's own size, read off the DISPLAYED geometry's bounding box
// (so canopies, cut parts and the nose cap all count) in the world units
// CAGE_UNIT defines. Metres and feet-inches, because an aeroplane is
// quoted in both. The box is a display option; the pane is always on.
let dimsEl = null, dimsBox = null;
// AS-BUILT measure: a cut part flying out on `explode` must not change
// the aeroplane's dimensions, so every vertex is measured back at its
// own part's place (the faces carry their translation as cutOff).
// EXTERIOR ONLY — seals and interior linings ride an exploded door
// without recording the move, and they are inside the skin anyway, so
// they can never be what sets a dimension.
function measureBox(m, FS) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const seen = new Set();
  for (const f of m.F) {
    if (f.m === 'joint' || INTSKIN.has(f.m) || INTSTRUCT.has(f.m)) continue;
    const o = f.cutOff || [0, 0, 0];
    for (const vi of f.v) {
      const key = vi + ':' + (f.cutOff ? 1 : 0);
      if (seen.has(key)) continue;
      seen.add(key);
      const v = m.V[vi];
      for (let c = 0; c < 3; c++) {
        const p = (v[c] - o[c]) * FS;
        if (p < lo[c]) lo[c] = p;
        if (p > hi[c]) hi[c] = p;
      }
    }
  }
  if (lo[0] > hi[0]) return null;
  return new THREE.Box3(new THREE.Vector3(lo[0], lo[1], lo[2]),
                        new THREE.Vector3(hi[0], hi[1], hi[2]));
}
function fmtLen(m) {
  const ti = Math.round(m / 0.0254);           // total inches
  const ft = Math.floor(ti / 12), inch = ti % 12;
  return { m: m.toFixed(2) + ' m', imp: ft + '′ ' + inch + '″',
           inch: ti + '″' };
}
function updateDims(box, FS) {
  if (!dimsEl || !box) return;
  const sz = box.getSize(new THREE.Vector3());
  const row = (label, v) => {
    const f = fmtLen(v);
    return '<div style="display:flex;gap:9px;align-items:baseline">' +
      '<span style="width:46px;color:#7d8996">' + label + '</span>' +
      '<b style="width:58px;font-weight:500">' + f.m + '</b>' +
      '<span style="width:56px;color:#5db3ff">' + f.imp + '</span>' +
      '<span style="color:#4a525c">' + f.inch + '</span></div>';
  };
  const sc = (P.planeScale != null ? P.planeScale : 1);
  dimsEl.innerHTML =
    '<div style="color:#7d8996;letter-spacing:.14em;font-size:9px;' +
    'margin-bottom:4px">DIMENSIONS</div>' +
    row('length', sz.z) + row('width', sz.x) + row('height', sz.y) +
    '<div style="color:#4a525c;margin-top:4px;font-size:10px">1 cage unit = ' +
    (G.CAGE_UNIT || 1).toFixed(3) + ' m  ·  scale ×' + sc.toFixed(3) +
    '</div>';
  disposeObj(dimsBox); dimsBox = null;
  if ($('dimsBox') && $('dimsBox').checked) {
    dimsBox = new THREE.Box3Helper(box.clone(), 0x5db3ff);
    dimsBox.material.transparent = true;
    dimsBox.material.opacity = 0.55;
    scene.add(dimsBox);
  }
}

// ---- build ----------------------------------------------------------------
function build() {
  // FOREVER-SPLIT (user ruling): with the pod on, any aft param still
  // at its sentinel takes a ONE-SHOT copy of the front's current value
  // — from then on the halves are independent, and moving a nose
  // slider never drags the aft deck again. Sliding an aft param back
  // below its threshold re-copies once: the "match the front now"
  // gesture.
  if (P.mirror && G.CAGE_AFT_SUB) {
    let ch = false;
    for (const [ak, fk, thr] of G.CAGE_AFT_SUB)
      if (P[ak] != null && P[ak] < thr && P[fk] != null) {
        P[ak] = P[fk]; ch = true;
      }
    if (ch) syncSliders();
  }
  const stepSel = $('step') ? $('step').value : (PAGE.defaultStep || 'crease');
  const step = stepSel === 'crease' ? 'crease' : +stepSel;
  const spec = G.cageSpec({ ...P });
  const m = G.buildCage2(spec, step);
  M0 = m;
  let s = m;
  const L = +$('lvl').value;
  for (let i = 0; i < L; i++) s = G.cageSubdivide(s);
  // rim joints sweep the boundary of the mesh AT THIS level — they stick
  // to the displayed surface exactly, at any subsurf setting
  // glass sill first: rows under the pilot/pax glass reassign to glass
  // so the cut and the joints see the extended windows
  if (step === 'crease' && G.cageGlassSill) s = G.cageGlassSill(s, spec);
  // G14: cut doors/windows into separate parts BEFORE the rims, so the
  // joints are traced on (and travel with) the moved panels
  if (step === 'crease' && G.cageCut) s = G.cageCut(s, spec);
  // the bubble canopy: a post-subdivision component on the displayed
  // seam — before the rims so it gets its frame seal
  if (step === 'crease' && G.cageCanopy) s = G.cageCanopy(s, spec);
  if (step === 'crease') s = G.cageRims(s, spec);
  // interior elements are disjoint post-passes too (G13)
  if (step === 'crease' && G.cageInterior) s = G.cageInterior(s, spec);
  MS = s;

  disposeObj(meshObj);
  for (const k in matCache) delete matCache[k];
  meshObj = ($('curv') && $('curv').checked) ? curvatureMesh(s)
    : ($('wire') && $('wire').checked) ? quadWire(s) : meshFrom(s);
  // THE UNIT (see CAGE_UNIT in _cage_gen.js): metres = cage x CAGE_UNIT
  // x planeScale. The cage scales; crew scenery is already metric and
  // never does. Pages without the param build at the unit exactly.
  const FS = (G.CAGE_UNIT || 1) * (P.planeScale || 1);
  meshObj.scale.setScalar(FS);
  scene.add(meshObj);

  disposeObj(cageObj); cageObj = null;
  if ($('cage').checked && L > 0) {
    cageObj = new THREE.Group();
    cageObj.add(edgeLines(m, 0xffbe5a, 0.85));
    cageObj.scale.setScalar(FS);
    scene.add(cageObj);
  }

  // canopy CONTROL LOOPS overlay (user ask: the loops must be visible,
  // hideable in the view panel) — drawn always-on-top in loop colours
  disposeObj(loopsObj); loopsObj = null;
  if (VIEW.loops && s.canArcs && s.canArcs.length) {
    loopsObj = new THREE.Group();
    const cols = [0xffd24a, 0x4af0ff, 0xff7ad9];
    s.canArcs.forEach((arc, i) => {
      const pos = [];
      for (const p of arc) pos.push(p[0], p[1], p[2]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(pos), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({
        color: cols[i % cols.length], depthTest: false,
        transparent: true, opacity: 0.9 }));
      l.renderOrder = 5;
      loopsObj.add(l);
    });
    loopsObj.scale.setScalar(FS);
    scene.add(loopsObj);
  }

  // fit
  const box = new THREE.Box3().setFromObject(meshObj);
  box.getCenter(centre);
  fitR = box.getSize(new THREE.Vector3()).length() * 0.62;
  updateDims(measureBox(s, FS), FS);

  $('stat').textContent =
    `cage ${m.V.length} v / ${m.F.length} q  →  L${L}: ` +
    `${s.V.length} v / ${s.F.length} q`;
  // page post hook (cage5 crew layer): extra scene content rebuilt after
  // every cage build — additive, pages without it are unaffected
  if (PAGE.post) try { PAGE.post({ scene, spec, mesh: s, P, stat: $('stat') }); }
  catch (e) { console.error('page post hook:', e); }
  draw();
}

function draw() {
  const r = cv.parentElement.getBoundingClientRect();
  const dp = devicePixelRatio || 1;
  renderer.setSize(r.width * dp, r.height * dp, false);
  cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  const R = fitR / ZOOM;
  const C = centreOv || centre;
  camera.position.set(
    C.x + R * Math.sin(yaw) * Math.cos(pitch),
    C.y + R * Math.sin(pitch),
    C.z + R * Math.cos(yaw) * Math.cos(pitch));
  camera.lookAt(C);
  renderer.render(scene, camera);
}

// ---- ghost reference ------------------------------------------------------
let REF = null, REF_STEP = -1;
function loadRef() {
  if (!$('refOn')) return;               // page has no ghost-ref controls
  const sel = $('step') ? $('step').value : 'crease';
  const step = sel === 'crease' ? 1 : +sel;
  disposeObj(refObj); refObj = null;
  if (!$('refOn').checked) { draw(); return; }
  const attach = () => {
    disposeObj(refObj);
    refObj = edgeLines(REF, 0xff7850, 0.1 + 0.45 * +$('refA').value);
    scene.add(refObj);
    draw();
  };
  if (REF_STEP === step && REF) { attach(); return; }
  fetch('_cage_ref_' + step + '.obj')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(txt => {
      const V = [], F = [];
      for (const line of txt.split('\n')) {
        if (line.startsWith('v ')) {
          const p = line.trim().split(/\s+/);
          V.push([+p[1], +p[2], +p[3]]);
        } else if (line.startsWith('f ')) {
          F.push({ v: line.trim().split(/\s+/).slice(1)
            .map(t => parseInt(t.split('/')[0], 10) - 1) });
        }
      }
      REF = { V, F }; REF_STEP = step;
      attach();
    })
    .catch(e => { $('stat').textContent = 'ref failed: ' + e.message; });
}

// ---- ui -------------------------------------------------------------------
const ui = $('ui');
// a row is a slider, or — when `names` is given — a named select whose
// option values are the indices (the param stays numeric underneath)
const mkRow = (parent, k, label, lo, hi, st, val, oninput, names) => {
  const d = document.createElement('div'); d.className = 'r';
  if (names) {
    d.innerHTML = `<span class="k">${label}</span>
      <select id="p_${k}" style="flex:1">` +
      names.map((n, i) =>
        `<option value="${i}"${+val === i ? ' selected' : ''}>${n}</option>`)
        .join('') + `</select>`;
    parent.appendChild(d);
    d.querySelector('select').onchange = e => oninput(+e.target.value);
    return;
  }
  const rel = k === 'planeScale';
  d.innerHTML = `<span class="k">${label}</span>
    <input type="range" id="p_${k}" min="${lo}" max="${hi}" step="${st}"
      value="${rel ? relSize() : val}">
    <span class="v" id="v_${k}">${(rel ? relSize() : +val).toFixed(3)}</span>`;
  parent.appendChild(d);
  d.querySelector('input').oninput = e => {
    $('v_' + k).textContent = (+e.target.value).toFixed(3);
    oninput(rel ? (sizeRef || 1) * +e.target.value : +e.target.value);
  };
};
// THE SIZE SLIDER READS ×1 FOR THE DESIGN YOU LOADED (user 2026-08-19:
// "the new plane scale should say 1"). `planeScale` stays the ONE stored
// size number — a config export carries it and nothing else — but the
// slider is shown RELATIVE to the size the current design was loaded at,
// so every preset opens at 1.000 and the slider means "bigger/smaller
// than this design". `sizeRef` re-anchors on every whole-set load
// (preset, saved config, JSON import, reset); dragging never moves it.
// Baking the factor into the length PARAMS instead was measured and
// rejected — see HANDOVER G19g.
let sizeRef = null;
const relSize = () => sizeRef ? (P.planeScale || 1) / sizeRef
                              : (P.planeScale || 1);
const anchorSize = () => { sizeRef = P.planeScale || 1; };

const LSKEY = 'cageCfg:' + location.pathname;
const savedCfgs = () => {
  try { return JSON.parse(localStorage.getItem(LSKEY) || '{}'); }
  catch (e) { return {}; }
};
{
  // 'wrap' so the buttons fold to a second line instead of overflowing
  // the pane (user bug: json/imp were clipped invisible)
  const d = document.createElement('div'); d.className = 'r wrap';
  d.innerHTML = `<span class="k">preset</span><select id="presetSel"
    style="flex:1"></select>
    <button id="saveCfg" title="save current sliders as a named config">save</button>
    <button id="logCfg" title="log non-default params to console + clipboard">log</button>
    <button id="expCfg" title="download config as JSON (also copied)">json</button>
    <button id="impCfg" title="paste a config JSON">imp</button>`;
  ui.appendChild(d);
  d.querySelector('select').onchange = e => applyPreset(e.target.value);
  d.querySelector('#saveCfg').onclick = () => {
    const name = prompt('config name');
    if (!name) return;
    const all = savedCfgs();
    all[name] = { P: { ...P } };
    localStorage.setItem(LSKEY, JSON.stringify(all));
    fillPresetSel();
  };
  // JSON export/import: diffed against CAGE_PARAMS (not page defaults),
  // so a config file is self-contained and portable between pages —
  // the user's trusted alternative to localStorage
  d.querySelector('#expCfg').onclick = () => {
    const diff = { P: {} };
    for (const k in P) if (P[k] !== G.CAGE_PARAMS[k]) diff.P[k] = P[k];
    const txt = JSON.stringify(diff, null, 1);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt],
      { type: 'application/json' }));
    a.download = 'cage_config.json';
    a.click();
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    $('stat').textContent = 'config downloaded + copied to clipboard';
  };
  d.querySelector('#impCfg').onclick = () => {
    const txt = prompt('paste config JSON ({P:{...}, M:{...}})');
    if (!txt) return;
    try {
      const cfg = JSON.parse(txt);
      if (cfg.P) Object.assign(P, cfg.P);   // cfg.M (old macros) is ignored
      anchorSize();
      syncSliders(); build();
      $('stat').textContent = 'config imported';
    } catch (e) { $('stat').textContent = 'import failed: ' + e.message; }
  };
  d.querySelector('#logCfg').onclick = () => {
    const diff = {};
    for (const k in P) if (P[k] !== G.CAGE_PARAMS[k]) diff[k] = P[k];
    const txt = JSON.stringify(diff, null, 1);
    console.log('cage params (non-default):', txt);
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    $('stat').textContent = 'params logged to console + clipboard';
  };
}
function fillPresetSel() {
  const sel = $('presetSel');
  if (!sel) return;
  const builtin = Object.keys(PAGE.presets || {});
  const saved = Object.keys(savedCfgs());
  sel.innerHTML = builtin.map(k => `<option>${k}</option>`).join('') +
    saved.map(k => `<option>* ${k}</option>`).join('');
}
fillPresetSel();
// ---- view panel (viewer state, never spec — user ruling) ------------------
// explode, transparency, cutaway and camera presets are MAIN options: how
// you look at the build, not what the build is. explodeD technically still
// lives in P until the game swap moves it out of the spec.
{
  const det = document.createElement('details');
  det.open = true; det.dataset.g = 'view';
  const sum = document.createElement('summary');
  sum.textContent = 'view';
  det.appendChild(sum);
  ui.appendChild(det);
  mkRow(det, 'explodeD', 'explode', 0, 1, 0.005, P.explodeD,
        v => { P.explodeD = v; build(); });
  const mkA = (label, key0) => {
    const dd = document.createElement('div'); dd.className = 'r';
    dd.innerHTML = `<span class="k">${label}</span>
      <input type="range" min="0.05" max="1" step="0.05"
        value="${VIEW[key0]}">
      <span class="v">${VIEW[key0].toFixed(2)}</span>`;
    det.appendChild(dd);
    dd.querySelector('input').oninput = e => {
      VIEW[key0] = +e.target.value;
      dd.querySelector('.v').textContent = (+e.target.value).toFixed(2);
      build();
    };
  };
  mkA('glass α', 'glassA');
  mkA('fuselage α', 'bodyA');
  mkA('int skin α', 'skinA');
  mkA('structure α', 'structA');
  const d = document.createElement('div'); d.className = 'r';
  d.innerHTML = `<span class="k">cutaway</span>
    <label style="flex:none"><input type="checkbox" id="cutaway"></label>`;
  det.appendChild(d);
  d.querySelector('#cutaway').onchange = e => {
    renderer.clippingPlanes = e.target.checked
      ? [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)] : [];
    draw();
  };
  const dl = document.createElement('div'); dl.className = 'r';
  dl.innerHTML = `<span class="k">canopy loops</span>
    <label style="flex:none"><input type="checkbox" id="canLoopsV"
      checked></label>`;
  det.appendChild(dl);
  dl.querySelector('#canLoopsV').onchange = e => {
    VIEW.loops = e.target.checked ? 1 : 0; build();
  };
  // the measuring box round the aeroplane (the pane below the view is
  // always on — the box is the display option)
  const db = document.createElement('div'); db.className = 'r';
  db.innerHTML = `<span class="k">dims box</span>
    <label style="flex:none"><input type="checkbox" id="dimsBox"></label>`;
  det.appendChild(db);
  db.querySelector('#dimsBox').onchange = build;
  dimsEl = document.createElement('div');
  dimsEl.id = 'dims';
  dimsEl.style.cssText = 'position:absolute;left:10px;bottom:10px;z-index:2;' +
    'background:rgba(18,21,26,.84);border:1px solid #242a33;border-radius:5px;' +
    'padding:7px 10px;color:#dfe6ee;pointer-events:none;' +
    'font:11px/1.55 ui-monospace,Menlo,Consolas,monospace';
  $('view').appendChild(dimsEl);
  const vb = document.createElement('div'); vb.className = 'r';
  vb.innerHTML = `<span class="k">camera</span>
    <button data-v="q">3/4</button><button data-v="s">side</button>
    <button data-v="f">front</button><button data-v="t">top</button>
    <button data-v="i">inside</button><button data-v="r">refit</button>`;
  det.appendChild(vb);
  vb.querySelectorAll('button').forEach(b => b.onclick = () => {
    const v = b.dataset.v;
    if (v === 'i') {
      // eye roughly at the pilot seat, looking forward at the panel area
      yaw = Math.PI; pitch = 0.02;
      centreOv = new THREE.Vector3(0, 0.15, 3.0);
      ZOOM = fitR / 1.1;
    } else if (v === 'r') { centreOv = null; ZOOM = 1; }
    else {
      centreOv = null;
      if (v === 'q') { yaw = -0.85; pitch = 0.30; }
      if (v === 's') { yaw = Math.PI / 2; pitch = 0; }
      if (v === 'f') { yaw = 0; pitch = 0.02; }
      if (v === 't') { yaw = -0.85; pitch = 1.30; }
    }
    draw();
  });
}

// ---- parameter groups (one nesting level supported) -----------------------
const renderItems = (parent, items, path) => {
  for (const it of items) {
    if (Array.isArray(it[1])) {
      const sub = document.createElement('details');
      sub.dataset.g = path + '/' + it[0];
      const ss = document.createElement('summary');
      ss.textContent = it[0];
      sub.appendChild(ss);
      if (it[2] === 'open') sub.open = true;
      parent.appendChild(sub);
      renderItems(sub, it[1], path + '/' + it[0]);
      continue;
    }
    const [k, label, lo, hi, st, names] = it;
    mkRow(parent, k, label, lo, hi, st, P[k], v => { P[k] = v; build(); },
          names);
  }
};
for (const [gname, items, open] of GROUPS) {
  const det = document.createElement('details');
  det.dataset.g = gname;
  const sum = document.createElement('summary');
  sum.textContent = gname;
  det.appendChild(sum);
  if (open === 'open' || gname === 'interior') det.open = true;
  ui.appendChild(det);
  renderItems(det, items, gname);
}
const lg = document.createElement('div');
lg.innerHTML = '<h2>sections</h2>' + Object.keys(SEC).map(k =>
  `<div class="leg"><span class="sw" style="background:${SEC[k]}"></span>${k}</div>`
).join('');
ui.appendChild(lg);

function syncSliders() {
  for (const [, items] of GROUPS) for (const [k] of flatItems(items)) {
    const el = $('p_' + k);
    if (el) {
      const v = k === 'planeScale' ? relSize() : P[k];
      el.value = v;
      const vs = $('v_' + k);
      if (vs) vs.textContent = (+v).toFixed(3);
    }
  }
  const ex = $('p_explodeD');
  if (ex) { ex.value = P.explodeD;
    const vs = $('v_explodeD');
    if (vs) vs.textContent = (+P.explodeD).toFixed(3); }
}
function applyPreset(name) {
  if (name.startsWith('* ')) {
    const cfg = savedCfgs()[name.slice(2)];
    if (cfg) Object.assign(P, cfg.P);      // cfg.M (old macros) is ignored
  } else {
    const pre = (PAGE.presets || {})[name] || {};
    for (const k in DEFAULTS) P[k] = DEFAULTS[k];
    for (const k in pre) P[k] = pre[k];
  }
  anchorSize();                            // this design is now ×1
  syncSliders(); build();
}
$('resetBtn').onclick = () => {
  for (const k in DEFAULTS) P[k] = DEFAULTS[k];
  anchorSize();
  syncSliders(); build();
};
$('objBtn').onclick = () => {
  const step = $('step') ? $('step').value : 'crease';
  const lines = ['# cage export, step ' + step, 'o cage_' + step];
  for (const v of M0.V)
    lines.push('v ' + v.map(c => c.toFixed(6)).join(' '));
  const byMat = {};
  M0.F.forEach(f => { (byMat[f.m] = byMat[f.m] || []).push(f.v); });
  for (const m in byMat) {
    lines.push('usemtl ' + m);
    for (const f of byMat[m]) lines.push('f ' + f.map(i => i + 1).join(' '));
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'],
    { type: 'text/plain' }));
  a.download = 'cage_' + step + '.obj';
  a.click();
};
for (const id of ['lvl', 'cage', 'curv'])
  if ($(id)) $(id).onchange = build;
for (const id of ['wire', 'color'])
  if ($(id)) $(id).onchange = () => {
    // material flags only — rebuild materials, keep geometry
    if (meshObj && meshObj.material && meshObj.material.map) {}
    build();
  };
if ($('step')) $('step').onchange = () => { loadRef(); build(); };
if ($('refOn')) $('refOn').onchange = loadRef;
if ($('refA')) $('refA').oninput = loadRef;
const viewEl = $('view');
// left drag = orbit; MIDDLE or RIGHT drag = PAN (user ask) — the pan
// moves the look-at centre in the camera's screen plane, scaled to the
// world size per pixel at the target distance; dblclick refits both
let panD = null;
viewEl.addEventListener('mousedown', e => {
  if (e.button === 1 || e.button === 2) {
    panD = [e.clientX, e.clientY, (centreOv || centre).clone()];
    e.preventDefault();
  } else drag = [e.clientX, e.clientY, yaw, pitch];
});
viewEl.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mouseup', () => { drag = null; panD = null; });
addEventListener('mousemove', e => {
  if (panD) {
    const r = cv.getBoundingClientRect();
    const wpp = 2 * (fitR / ZOOM) *
      Math.tan(camera.fov * Math.PI / 360) / Math.max(1, r.height);
    const e0 = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const e1 = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
    centreOv = panD[2].clone()
      .addScaledVector(e0, -(e.clientX - panD[0]) * wpp)
      .addScaledVector(e1, (e.clientY - panD[1]) * wpp);
    draw();
    return;
  }
  if (!drag) return;
  yaw = drag[2] + (e.clientX - drag[0]) * 0.008;
  pitch = Math.max(-1.35, Math.min(1.35, drag[3] + (e.clientY - drag[1]) * 0.006));
  draw(); });
viewEl.addEventListener('wheel', e => {
  e.preventDefault();
  ZOOM = Math.max(0.2, Math.min(15, ZOOM * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  draw();
}, { passive: false });
viewEl.addEventListener('dblclick', () => {
  ZOOM = 1; centreOv = null; draw();
});
addEventListener('resize', () => MS && draw());
// the side pane is resizable (CSS resize on the aside) — the canvas must
// follow the #view box live, not only on window resize
if (typeof ResizeObserver !== 'undefined')
  new ResizeObserver(() => MS && draw()).observe(viewEl);

if (PAGE.defaultStep && $('step')) $('step').value = PAGE.defaultStep;
anchorSize();                              // the page opens at its ×1
syncSliders();
window.CAGE_UI = { P, build, draw, applyPreset, syncSliders,
  setView: (y, p, z, c) => { yaw = y; pitch = p; if (z) ZOOM = z;
    centreOv = c ? new THREE.Vector3(c[0], c[1], c[2]) : null; },
  get M0() { return M0; }, get MS() { return MS; } };
build();
})();
