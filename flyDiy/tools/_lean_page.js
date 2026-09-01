// LEAN PAGE — the tilted-pillar study bench (2026-09-01). See _lean.html
// for the question; futureDesigns/LEAN-PILLAR-STUDY-2026-09-01.md for the
// study and the original post-pass argument.
//
// THE LEAN LANDED (same day): cageResolve applies the shear to the pillar
// ring pairs when spec.lean is set (P rows leanPaxDeg / leanCabDeg /
// leanPivot), clamped on roof-level SHIFT to half the shorter neighbouring
// bay. This page now drives that REAL path — the sliders write the P rows
// and the generator does the leaning — so what the bench shows is what the
// game ships, including the clamp. leanZones below survives only to feed
// the readout and the ghost's band limits, always computed off the
// UNLEANED spec (the nominal geometry the deltas are measured against).
'use strict';

const G = window.CAGE2;

// ---------------------------------------------------------------------------
// presets — small patches over the one default aeroplane
// ---------------------------------------------------------------------------
const PRESETS = {
  p_tpl:   {},
  p_pax2:  { paxCount: 2 },
  p_taper: { taperOn: 1, taperLen: 0.8, taperW: 0.82 },
  p_round: { topRound: 1, botRound: 1 },
};
let presetKey = 'p_tpl';

const $ = id => document.getElementById(id);

function currentSpec(leanRows) {
  const P = Object.assign(G.cageDefaults(), PRESETS[presetKey], leanRows);
  return G.cageSpec(P);
}

// ---------------------------------------------------------------------------
// the lean pass
// ---------------------------------------------------------------------------
function leanZones(spec, o) {
  if (spec.config && spec.config.mirror) return [];       // pod: out of scope
  const R = G.cageResolve(spec);
  const names = R.rings.map(r => r.name);
  const mk = (name, deg) => {
    const i = names.indexOf(name);
    if (!deg || i < 1 || i + 2 >= R.rings.length) return null;
    const lv = R.rings[i].lv;
    const pivY = o.pivot === 'mid' ? (lv.roof.y + lv.keel.y) / 2
      : (lv[o.pivot] || lv.floor).y;
    // mirror the resolver's clamp so the readout reports the SHIPPED lean
    let k = Math.tan(deg * Math.PI / 180), clamped = false;
    const span = Math.min(
      Math.abs(R.rings[i - 1].lv.waist.z - lv.waist.z),
      Math.abs(R.rings[i + 1].lv.waist.z - R.rings[i + 2].lv.waist.z));
    const shift = Math.abs(k * (lv.roof.y - pivY));
    if (shift > 0.5 * span) { k *= 0.5 * span / shift; clamped = true; }
    return { i0: i, i1: i + 1, k, clamped, pivY, lv, name };
  };
  return [mk('pilPaxA', o.degA), mk('pilCabA', o.degC)].filter(Boolean);
}

// ---------------------------------------------------------------------------
// the fold probe — "did the surface grow a crease it did not order?"
// Sharpest dihedral across SMOOTH edges (creased families excluded via the
// mesh's own E map, rim beads and reveals skipped) among faces near the
// pillars. Compared leaned vs 0° at the same subsurf level.
// ---------------------------------------------------------------------------
function foldProbe(s, zLo, zHi) {
  const nrm = f => {
    const [a, b, c] = [s.V[f.v[0]], s.V[f.v[1]], s.V[f.v[2]]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
               u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  };
  const ekey = (a, b) => a < b ? a + '_' + b : b + '_' + a;
  const em = new Map(), fn = [];
  s.F.forEach((f, fi) => {
    if (f.m === 'joint' || f.reveal || f.v.length < 3) { fn.push(null); return; }
    let cz = 0;
    for (const vi of f.v) cz += s.V[vi][2];
    cz /= f.v.length;
    if (cz < zLo || cz > zHi) { fn.push(null); return; }
    fn.push(nrm(f));
    for (let k = 0; k < f.v.length; k++) {
      const key = ekey(f.v[k], f.v[(k + 1) % f.v.length]);
      let l = em.get(key);
      if (!l) em.set(key, l = []);
      l.push(fi);
    }
  });
  let max = 0;
  for (const [key, fis] of em) {
    if (fis.length !== 2) continue;
    if (s.E && s.E.get(key) > 0) continue;                // creased by design
    const [n1, n2] = [fn[fis[0]], fn[fis[1]]];
    if (!n1 || !n2) continue;
    const d = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2];
    const ang = Math.acos(Math.min(1, Math.max(-1, d))) * 180 / Math.PI;
    if (ang > max) max = ang;
  }
  return max;
}

// ---------------------------------------------------------------------------
// build — the game page's own pipeline (see _cage_ui.js build()), with the
// lean pass in the one slot the eventual implementation would occupy
// ---------------------------------------------------------------------------
function buildMesh(spec, L) {
  const m = G.buildCage2(spec, 'crease');
  let s = m;
  for (let i = 0; i < L; i++) s = G.cageSubdivide(s);
  if (G.cageGlassSill) s = G.cageGlassSill(s, spec);
  if (G.cageCut) s = G.cageCut(s, spec);
  if (G.cageCanopy) s = G.cageCanopy(s, spec);
  if (G.cageRims) s = G.cageRims(s, spec);
  return { m, s };
}

// ---------------------------------------------------------------------------
// viewer
// ---------------------------------------------------------------------------
const PAL = {
  body: 0x8f9aa8, waistband: 0xd8433f, ceilingLoop: 0xc9a54a,
  floorLoop: 0x4a7fca, skyWindows: 0x9fd7ff, pasengerWindow: 0x7fc4ff,
  pilotWindow: 0x86ccff, windshield: 0xa8e0ff, taper: 0xb5a06a,
  pillarPassenger: 0xe0762f, pillarCabin: 0xe0a12f, pillarTail: 0x7a6f63,
  pillarTaper: 0xb0855a, pillarWindow: 0xcf8f4a, pillarFront: 0x9a8f80,
  joint: 0x2e343c,
};
const GLASS = new Set(['skyWindows', 'pasengerWindow', 'pilotWindow',
                       'windshield']);
const hashCol = nm => {
  let h = 0;
  for (let i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) >>> 0;
  return 0x404040 + (h & 0x3f3f3f);
};

let renderer, scene, camera, centre = new THREE.Vector3(0, 0, 1), fitR = 7;
let meshObj = null, wireObj = null, cageObj = null, ghostObj = null;
let baseCache = null;                    // { key, s } — the 0° displayed mesh

function disposeObj(o) {
  if (!o) return;
  scene.remove(o);
  o.traverse ? o.traverse(x => {
    if (x.geometry) x.geometry.dispose();
    if (x.material) (Array.isArray(x.material) ? x.material : [x.material])
      .forEach(mt => mt.dispose());
  }) : null;
}

function geoFrom(s) {
  // one indexed geometry over the welded V — smooth normals across material
  // borders, exactly what judging a bump needs — with one group per material
  const pos = new Float32Array(s.V.length * 3);
  s.V.forEach((p, i) => { pos.set(p, i * 3); });
  const byMat = new Map();
  for (const f of s.F) {
    if (f.v.length < 3) continue;
    let l = byMat.get(f.m);
    if (!l) byMat.set(f.m, l = []);
    for (let k = 1; k + 1 < f.v.length; k++)
      l.push(f.v[0], f.v[k], f.v[k + 1]);
  }
  const idx = [], groups = [], mats = [];
  for (const [nm, tris] of byMat) {
    groups.push({ start: idx.length, count: tris.length, nm });
    for (const t of tris) idx.push(t);
    mats.push(nm);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  for (let i = 0; i < groups.length; i++)
    g.addGroup(groups[i].start, groups[i].count, i);
  g.computeVertexNormals();
  return { g, mats };
}

function threeMesh(s, mode) {
  if (mode === 'facets') {
    const { g, mats } = geoFrom(s);
    const ng = g.toNonIndexed();
    // toNonIndexed keeps groups; flat normals per facet
    ng.computeVertexNormals();
    g.dispose();
    return new THREE.Mesh(ng, mats.map(nm => new THREE.MeshPhongMaterial({
      color: PAL[nm] != null ? PAL[nm] : hashCol(nm),
      flatShading: true, shininess: 30, side: THREE.DoubleSide })));
  }
  const { g, mats } = geoFrom(s);
  if (mode === 'normals')
    return new THREE.Mesh(g, mats.map(() =>
      new THREE.MeshNormalMaterial({ side: THREE.DoubleSide })));
  return new THREE.Mesh(g, mats.map(nm => new THREE.MeshPhongMaterial({
    color: PAL[nm] != null ? PAL[nm] : hashCol(nm),
    shininess: 70, specular: 0x2f3a44, side: THREE.DoubleSide,
    transparent: GLASS.has(nm), opacity: GLASS.has(nm) ? 0.55 : 1 })));
}

function quadWire(s, color, opacity) {
  const seen = new Set(), pos = [];
  for (const f of s.F) {
    for (let k = 0; k < f.v.length; k++) {
      const a = f.v[k], b = f.v[(k + 1) % f.v.length];
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (seen.has(key)) continue;
      seen.add(key);
      pos.push(...s.V[a], ...s.V[b]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(pos), 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({
    color, transparent: opacity < 1, opacity }));
}

// ---------------------------------------------------------------------------
// the readout
// ---------------------------------------------------------------------------
const cm = v => (v * 100).toFixed(1) + ' cm';

function readout(zones, foldBase, foldLean) {
  const el = $('read');
  if (!zones.length) {
    el.innerHTML = 'both pillars vertical &mdash; move a slider';
    return;
  }
  const rows = [];
  for (const z of zones) {
    const label = z.name === 'pilPaxA' ? 'aft pillar' : 'cabin pillar';
    const dTop = z.k * (z.lv.ceil.y - z.pivY);       // + = aft
    const dFlr = z.k * (z.lv.floor.y - z.pivY);
    rows.push('<b>' + label + '</b> &mdash; at the ceiling ' +
      (dTop >= 0 ? cm(dTop) + ' aft' : cm(-dTop) + ' fore') +
      ', at the floor ' +
      (dFlr >= 0 ? cm(dFlr) + ' aft' : cm(-dFlr) + ' fore') +
      (z.clamped ? ' <span style="color:#ffbe5a">(clamped &rarr; ' +
        (Math.atan(z.k) * 180 / Math.PI).toFixed(1) + '&deg;)</span>' : ''));
  }
  const zA = zones.find(z => z.name === 'pilPaxA');
  if (zA) rows.push('cabin gains ' + cm(zA.k * (zA.lv.ceil.y - zA.pivY)) +
    ' of shelf at shoulder height; the aft window edge slants ' +
    (Math.atan(zA.k) * 180 / Math.PI).toFixed(1) + '&deg;');
  rows.push('fold probe (sharpest smooth-edge crease near the pillars): ' +
    '0&deg; &rarr; <b>' + foldBase.toFixed(2) + '&deg;</b> · leaned &rarr; <b>' +
    foldLean.toFixed(2) + '&deg;</b>' +
    (foldLean - foldBase > 3
      ? ' &mdash; <span style="color:#ff7a6b">the lean added a crease</span>'
      : ' &mdash; no new crease'));
  el.innerHTML = rows.join('<br>');
}

// ---------------------------------------------------------------------------
// build + render
// ---------------------------------------------------------------------------
function build() {
  const o = { degA: +$('degA').value, degC: +$('degC').value,
              pivot: $('pivot').value };
  $('degAv').textContent = o.degA + '°';
  $('degCv').textContent = o.degC + '°';
  // spec0 = unleaned (readout, ghost, probe band, baseline); spec = the
  // REAL path, lean rows in P — cageResolve does the leaning
  const spec0 = currentSpec(null);
  const spec = currentSpec({ leanPaxDeg: o.degA, leanCabDeg: o.degC,
                             leanPivot: o.pivot });
  const zones = leanZones(spec0, o);
  const L = +$('lvl').value;
  const mode = $('mode').value;

  // baseline (0°) — cached per preset + level, reused for ghost and probe
  const bKey = presetKey + '|' + L;
  if (!baseCache || baseCache.key !== bKey)
    baseCache = { key: bKey, s: buildMesh(spec0, L).s };

  const { m, s } = buildMesh(spec, L);

  // probe band: from a little aft of the aft pillar to past the cabin pillar
  const R = G.cageResolve(spec0);
  const rz = nm => {
    const r = R.rings.find(x => x.name === nm);
    return r ? r.lv.waist.z : null;
  };
  const zPax = rz('pilPaxA'), zCab = rz('pilCabB');
  const zLo = (zPax != null ? zPax : 0) - 1.0;
  const zHi = (zCab != null ? zCab : (zPax || 0)) + 0.6;
  const foldBase = foldProbe(baseCache.s, zLo, zHi);
  const foldLean = zones.length ? foldProbe(s, zLo, zHi) : foldBase;

  disposeObj(meshObj);
  meshObj = threeMesh(s, mode);
  scene.add(meshObj);

  disposeObj(wireObj); wireObj = null;
  if ($('wire').checked) {
    wireObj = quadWire(s, 0x39424e, 0.6);
    scene.add(wireObj);
  }
  disposeObj(cageObj); cageObj = null;
  if ($('cage').checked && L > 0) {
    cageObj = quadWire(m, 0xffbe5a, 0.85);
    scene.add(cageObj);
  }
  disposeObj(ghostObj); ghostObj = null;
  if ($('ghost').checked && zones.length) {
    // band-limit the ghost to the leaned stations: outside them baseline
    // and leaned surfaces are COPLANAR and a full ghost z-fights (seen as
    // zigzag shading on the round preset's flank)
    const bands = zones.map(z => [z.lv.waist.z - 1.15, z.lv.waist.z + 1.15]);
    const bs = baseCache.s;
    const keep = bs.F.filter(f => {
      let cz = 0;
      for (const vi of f.v) cz += bs.V[vi][2];
      cz /= f.v.length;
      return bands.some(b => cz >= b[0] && cz <= b[1]);
    });
    const { g } = geoFrom({ V: bs.V, F: keep });
    ghostObj = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: 0x5db3ff, transparent: true, opacity: 0.13,
      depthWrite: false, side: THREE.DoubleSide }));
    scene.add(ghostObj);
  }

  // fit once per preset (keep the camera through slider drags)
  const box = new THREE.Box3().setFromObject(meshObj);
  box.getCenter(centre);
  fitR = box.getSize(new THREE.Vector3()).length() * 0.62;

  $('stat').textContent =
    'cage ' + m.V.length + ' v / ' + m.F.length + ' q  →  L' + L + ': ' +
    s.V.length + ' v / ' + s.F.length + ' q';
  readout(zones, foldBase, foldLean);
  lastS = s;
}

let lastS = null;

// ---------------------------------------------------------------------------
// OBJ export (quads, usemtl per section — same shape as the other benches)
// ---------------------------------------------------------------------------
function exportOBJ() {
  if (!lastS) return;
  const s = lastS;
  const L = ['# flyDiy lean bench export'];
  for (const p of s.V)
    L.push('v ' + p[0].toFixed(6) + ' ' + p[1].toFixed(6) + ' '
      + p[2].toFixed(6));
  let cur = null;
  for (const f of s.F) {
    if (f.m !== cur) { cur = f.m; L.push('usemtl ' + cur); }
    L.push('f ' + f.v.map(i => i + 1).join(' '));
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([L.join('\n')], { type: 'text/plain' }));
  a.download = 'lean_' + $('degA').value + 'deg.obj';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------------------------------------------------------------------
// scene + orbit
// ---------------------------------------------------------------------------
let theta = 0.7, phi = 1.15, dist = 0;

function init() {
  const cv = $('c');
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12151a);
  camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);

  scene.add(new THREE.HemisphereLight(0xbfd4e6, 0x22262b, 0.85));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.75);
  d1.position.set(3, 4, 2);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0x88aaff, 0.3);
  d2.position.set(-4, 2, -3);
  scene.add(d2);

  const view = $('view');
  const resize = () => {
    const w = view.clientWidth, h = view.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(view);
  resize();

  let drag = null;
  cv.addEventListener('mousedown', e => {
    drag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    theta -= (e.clientX - drag.x) * 0.006;
    phi = Math.max(0.05, Math.min(Math.PI - 0.05,
      phi - (e.clientY - drag.y) * 0.006));
    drag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', () => { drag = null; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    dist *= Math.pow(1.1, e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  for (const id of ['degA', 'degC']) $(id).addEventListener('input', build);
  for (const id of ['pivot', 'lvl', 'mode'])
    $(id).addEventListener('change', build);
  for (const id of ['wire', 'cage', 'ghost'])
    $(id).addEventListener('change', build);
  $('objBtn').addEventListener('click', exportOBJ);
  for (const key in PRESETS) $(key).addEventListener('click', () => {
    presetKey = key;
    baseCache = null;
    for (const k2 in PRESETS)
      $(k2).classList.toggle('on', k2 === key);
    build();
  });

  build();
  dist = fitR * 2.1;
  const loop = () => {
    camera.position.set(
      centre.x + dist * Math.sin(phi) * Math.sin(theta),
      centre.y + dist * Math.cos(phi),
      centre.z + dist * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(centre);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  loop();
}

init();
