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
};

// ---- parameters -----------------------------------------------------------
const DEFAULTS = Object.assign(
  JSON.parse(JSON.stringify(G.CAGE_PARAMS)), PAGE.defaults || {});
const P = JSON.parse(JSON.stringify(DEFAULTS));

const MACROS = [
  ['mLen',   'length x',   0.4, 2.0, 0.01, 1],
  ['mWidth', 'width x',    0.4, 2.0, 0.01, 1],
  ['mHeight','cabin ht x', 0.4, 2.0, 0.01, 1],
  ['mBelly', 'belly x',    0.4, 2.0, 0.01, 1],
  ['mWaist', 'waist +y',  -0.4, 0.4, 0.005, 0],
  ['mRake',  'rake x',     0.4, 2.0, 0.01, 1],
  ['mTail',  'tail x',     0.3, 2.5, 0.01, 1],
  ['mAft',   'aft x',      0.4, 2.0, 0.01, 1],
  ['mNose',  'nose x',     0.4, 2.5, 0.01, 1],
];
const M = {};
for (const [k, , , , , d] of MACROS) M[k] = d;

function deriveP() {
  const q = JSON.parse(JSON.stringify(P));
  const w0 = q.waistY;
  const up = (v, s) => w0 + (v - w0) * s;
  for (const k of ['paxLen', 'pilotLen', 'boomLen', 'tailLen', 'wsRun',
                   'wsTopOff', 'wsBaseBow', 'noseLen']) q[k] *= M.mLen;
  q.halfW *= M.mWidth; q.roofHalfW *= M.mWidth; q.ringPullIn *= M.mWidth;
  q.roofY = up(q.roofY, M.mHeight);
  q.keelY = up(q.keelY, M.mBelly); q.floorY = up(q.floorY, M.mBelly);
  q.aftRoofY = up(q.aftRoofY, M.mAft); q.aftKeelY = up(q.aftKeelY, M.mAft);
  q.tailHalfW *= M.mTail;
  q.tailRoofY = up(q.tailRoofY, M.mTail);
  q.tailKeelY = up(q.tailKeelY, M.mTail);
  for (const k of ['wsRun', 'wsTopOff', 'wsBaseBow', 'wsCeilBow'])
    q[k] *= M.mRake;
  q.noseLen *= M.mNose;
  q.waistY += M.mWaist;
  for (const k of ['roofY', 'keelY', 'floorY', 'aftRoofY', 'aftKeelY',
                   'tailRoofY', 'tailKeelY']) q[k] += M.mWaist;
  return q;
}

const GROUPS = [
  ['layout', [
    ['paxCount',  'pax bays',      0, 4, 1],
    ['paxLen',    'pax len',       0.4, 3.0, 0.01],
    ['pilotLen',  'pilot len',     0.3, 2.0, 0.01],
    ['boomLen',   'boom len',      1.0, 6.0, 0.01],
    ['tailLen',   'tail len',      0.05, 0.6, 0.005],
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
  ['window joints', [
    ['rimW',      'rim size',     0.00, 0.04, 0.001],
    ['rimWin',    'window rims',  0, 1, 1],
    ['rimWs',     'w/s rim',      0, 1, 1],
    ['rimDoor',   'door rim',     0, 1, 1],
    ['doorOn',    'pilot door',   0, 1, 1],
    ['doorPax',   'pax doors',    0, 1, 1],
    ['doorDeep',  'door to belly',0, 1, 1],
    ['doorSill',  'door sill',    0, 0.6, 0.005],
  ]],
].concat(PAGE.groups || []);

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
let meshObj = null, cageObj = null, refObj = null;
let centre = new THREE.Vector3(), fitR = 3;

const matCache = {};
const matOf = name => {
  const neutral = !$('color').checked;
  const key = (neutral ? 'n:' : 'c:') + name + ($('wire').checked ? ':w' : '');
  if (!matCache[key]) {
    matCache[key] = new THREE.MeshLambertMaterial({
      color: new THREE.Color(neutral ? '#b9c6d4' : (SEC[name] || '#5a6470')),
      wireframe: $('wire').checked,
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

// ---- build ----------------------------------------------------------------
function build() {
  const stepSel = $('step').value;
  const step = stepSel === 'crease' ? 'crease' : +stepSel;
  const spec = G.cageSpec(deriveP());
  const m = G.buildCage2(spec, step);
  M0 = m;
  let s = m;
  const L = +$('lvl').value;
  for (let i = 0; i < L; i++) s = G.cageSubdivide(s);
  // rim joints sweep the boundary of the mesh AT THIS level — they stick
  // to the displayed surface exactly, at any subsurf setting
  if (step === 'crease') s = G.cageRims(s, spec);
  MS = s;

  disposeObj(meshObj);
  for (const k in matCache) delete matCache[k];
  meshObj = ($('curv') && $('curv').checked) ? curvatureMesh(s) : meshFrom(s);
  scene.add(meshObj);

  disposeObj(cageObj); cageObj = null;
  if ($('cage').checked && L > 0) {
    cageObj = new THREE.Group();
    cageObj.add(edgeLines(m, 0xffbe5a, 0.85));
    scene.add(cageObj);
  }

  // fit
  const box = new THREE.Box3().setFromObject(meshObj);
  box.getCenter(centre);
  fitR = box.getSize(new THREE.Vector3()).length() * 0.62;

  $('stat').textContent =
    `cage ${m.V.length} v / ${m.F.length} q  →  L${L}: ` +
    `${s.V.length} v / ${s.F.length} q`;
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
  camera.position.set(
    centre.x + R * Math.sin(yaw) * Math.cos(pitch),
    centre.y + R * Math.sin(pitch),
    centre.z + R * Math.cos(yaw) * Math.cos(pitch));
  camera.lookAt(centre);
  renderer.render(scene, camera);
}

// ---- ghost reference ------------------------------------------------------
let REF = null, REF_STEP = -1;
function loadRef() {
  const sel = $('step').value;
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
const mkRow = (parent, k, label, lo, hi, st, val, oninput) => {
  const d = document.createElement('div'); d.className = 'r';
  d.innerHTML = `<span class="k">${label}</span>
    <input type="range" id="p_${k}" min="${lo}" max="${hi}" step="${st}"
      value="${val}">
    <span class="v" id="v_${k}">${(+val).toFixed(3)}</span>`;
  parent.appendChild(d);
  d.querySelector('input').oninput = e => {
    $('v_' + k).textContent = (+e.target.value).toFixed(3);
    oninput(+e.target.value);
  };
};
const LSKEY = 'cageCfg:' + location.pathname;
const savedCfgs = () => {
  try { return JSON.parse(localStorage.getItem(LSKEY) || '{}'); }
  catch (e) { return {}; }
};
{
  const d = document.createElement('div'); d.className = 'r';
  d.innerHTML = `<span class="k">preset</span><select id="presetSel"
    style="flex:1"></select>
    <button id="saveCfg" title="save current sliders as a named config">save</button>
    <button id="logCfg" title="log non-default params to console + clipboard">log</button>`;
  ui.appendChild(d);
  d.querySelector('select').onchange = e => applyPreset(e.target.value);
  d.querySelector('#saveCfg').onclick = () => {
    const name = prompt('config name');
    if (!name) return;
    const all = savedCfgs();
    all[name] = { P: { ...P }, M: { ...M } };
    localStorage.setItem(LSKEY, JSON.stringify(all));
    fillPresetSel();
  };
  d.querySelector('#logCfg').onclick = () => {
    const diff = {};
    for (const k in P) if (P[k] !== G.CAGE_PARAMS[k]) diff[k] = P[k];
    for (const [k, , , , , d0] of MACROS) if (M[k] !== d0) diff[k] = M[k];
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
{
  const h = document.createElement('h2'); h.textContent = 'macro';
  ui.appendChild(h);
  for (const [k, label, lo, hi, st] of MACROS)
    mkRow(ui, k, label, lo, hi, st, M[k], v => { M[k] = v; build(); });
}
for (const [gname, items] of GROUPS) {
  const det = document.createElement('details');
  const sum = document.createElement('summary');
  sum.textContent = gname;
  det.appendChild(sum);
  ui.appendChild(det);
  for (const [k, label, lo, hi, st] of items)
    mkRow(det, k, label, lo, hi, st, P[k], v => { P[k] = v; build(); });
}
const lg = document.createElement('div');
lg.innerHTML = '<h2>sections</h2>' + Object.keys(SEC).map(k =>
  `<div class="leg"><span class="sw" style="background:${SEC[k]}"></span>${k}</div>`
).join('');
ui.appendChild(lg);

function syncSliders() {
  for (const [k] of MACROS) {
    const el = $('p_' + k);
    if (el) { el.value = M[k]; $('v_' + k).textContent = (+M[k]).toFixed(3); }
  }
  for (const [, items] of GROUPS) for (const [k] of items) {
    const el = $('p_' + k);
    if (el) { el.value = P[k]; $('v_' + k).textContent = (+P[k]).toFixed(3); }
  }
}
function applyPreset(name) {
  if (name.startsWith('* ')) {
    const cfg = savedCfgs()[name.slice(2)];
    if (cfg) { Object.assign(P, cfg.P); Object.assign(M, cfg.M); }
  } else {
    const pre = (PAGE.presets || {})[name] || {};
    for (const k in DEFAULTS) P[k] = DEFAULTS[k];
    for (const [k, , , , , d0] of MACROS) M[k] = d0;
    for (const k in pre) {
      if (k in M) M[k] = pre[k]; else P[k] = pre[k];
    }
  }
  syncSliders(); build();
}
$('resetBtn').onclick = () => {
  for (const k in DEFAULTS) P[k] = DEFAULTS[k];
  for (const [k, , , , , d0] of MACROS) M[k] = d0;
  syncSliders(); build();
};
$('objBtn').onclick = () => {
  const step = $('step').value;
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
$('step').onchange = () => { loadRef(); build(); };
$('refOn').onchange = loadRef;
$('refA').oninput = loadRef;
const viewEl = $('view');
viewEl.addEventListener('mousedown', e => {
  drag = [e.clientX, e.clientY, yaw, pitch];
});
addEventListener('mouseup', () => drag = null);
addEventListener('mousemove', e => { if (!drag) return;
  yaw = drag[2] + (e.clientX - drag[0]) * 0.008;
  pitch = Math.max(-1.35, Math.min(1.35, drag[3] + (e.clientY - drag[1]) * 0.006));
  draw(); });
viewEl.addEventListener('wheel', e => {
  e.preventDefault();
  ZOOM = Math.max(0.2, Math.min(15, ZOOM * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  draw();
}, { passive: false });
viewEl.addEventListener('dblclick', () => { ZOOM = 1; draw(); });
addEventListener('resize', () => MS && draw());

if (PAGE.defaultStep) $('step').value = PAGE.defaultStep;
window.CAGE_UI = { P, M, build, draw, applyPreset,
  setView: (y, p) => { yaw = y; pitch = p; },
  get M0() { return M0; }, get MS() { return MS; } };
build();
})();
