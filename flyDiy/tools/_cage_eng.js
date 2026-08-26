// CAGE ENGINE LAYER (G29) — the dressed engine (G24/G25's _eng_mesh.js) on
// the nose of the aeroplane.
//
// THE GENUINE FIREWALL: the bench's generic plate (fwOn) is never built
// here — the cage's own firewall is the plate. The engine is positioned so
// its firewall STATION (zFw = zAft - mountGap·caseR, the bench's own
// formula) lands exactly on the cage's engine face, and the mount truss's
// backing pads and bolts therefore land ON that face — the same move the
// cowl layer makes with the stub fuselage: the stand-in exists so the
// module can be developed alone, and integration is the moment it goes
// away. fwOn 0 also stands down the plate furniture (battery, ECU, ruler)
// — bay furniture placement on the real firewall is its own chantier.
//
// THE PROP AND THE NOSE CONE ARE CHILDREN OF THE ENGINE (user ruling),
// not of the cowl: the geometry is still the cowl tool's (spinner profile,
// blade generator, the same cw_ parameter rows), but it is REBASED from
// the cowl's frame onto the crank — the cone base moves from
// coneBaseZ (cowl end + noseOff) onto the flange face, and the aperture
// axis offsets bake out because the crank IS the axis here. The engine
// group itself sits on the cowl's aperture axis, so the same two offset
// sliders move shaft, spinner, blades and engine together — NO AUTO COWL
// FITTING (user ruling): the builder aligns the cowl around the engine by
// hand, with the cowl's own controls.
//
// POLYCOUNT: the bench's global density governor (`quality`) rides the
// page's polycount group as `engDetail`; the per-element side counts stay
// bench-only (user ruling).
//
// Load after _eng_gen/_eng_mesh/_eng_page and after _cage_cowl (it uses
// the cowl layer's noseFace export and runs after it in the post chain);
// before _cage_ui.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const EM = window.ENG_MESH, EP = window.ENG_PAGE,
      CW = window.COWL_GEN, CG2 = window.CAGE2;
if (!EM || !EP || !CW) {
  console.error('cage engine layer: _eng_mesh/_eng_page/_cowl_gen not loaded');
  return;
}

// ---- parameters -----------------------------------------------------------
// presets are the shared table's, minus the bench-only 'bare engine' row
const PRESET_NAMES = Object.keys(EP.PRESETS).filter(n => n !== 'bare engine');
PAGE.defaults = Object.assign(
  { engOn: 1, engPreset: 0, engDetail: 0.8, propOn: 1 },
  PAGE.defaults || {});

// ---- panel ----------------------------------------------------------------
// the spinner + propeller rows are the cowl TOOL's own (cw_ keys), re-homed
// under the engine because that is whose children they are now
const rowNames = r => r.k === 'material' && CW.MATERIALS
  ? CW.MATERIALS.map(mm => mm.name) : r.names;
// the cone roots on the FLANGE now, so its offset row says so
const LBL = { noseOff: 'base fwd of flange' };
const grpItems = id => ((window.COWL_ROWS || []).find(g => g.id === id) ||
  { rows: [] }).rows
  .filter(r => CW.P[r.k] !== undefined)
  .map(r => ['cw_' + r.k, LBL[r.k] || r.label, r.lo,
             r.k === 'material' && CW.MATERIALS ? CW.MATERIALS.length - 1
                                                : r.hi,
             r.step, rowNames(r)]);
const SPINPROP_KEYS = ['g_spin', 'g_prop'].flatMap(id =>
  ((window.COWL_ROWS || []).find(g => g.id === id) || { rows: [] })
    .rows.map(r => r.k));

const ENG_ITEMS = [
  ['engOn',     'engine',        0, 1, 1],
  ['engPreset', 'engine preset', 0, Math.max(1, PRESET_NAMES.length - 1), 1,
   PRESET_NAMES, { when: P => +P.engOn }],
  ['propOn',    'propeller',     0, 1, 1, { when: P => +P.engOn }],
  ['nose cone & shaft', grpItems('g_spin'), { when: P => +P.engOn }],
  ['propeller', grpItems('g_prop'),
   { when: P => +P.engOn && +P.propOn }],
];
// join the page's own "2 · engine" folder when it has one (the curated
// tree); a page without it gets a group of its own
const host = (PAGE.groupsOverride || []).find(g => g[0] === '2 · engine');
if (host) host[1].push(...ENG_ITEMS);
else (PAGE.groupsOverride || (PAGE.groups = PAGE.groups || []))
  .push(['2c · engine', ENG_ITEMS]);
// the global density governor joins the polycount folder
const poly = (PAGE.groupsOverride || []).find(g => g[0] === 'polycount');
if (poly) poly[1].push(['engDetail', 'engine detail', 0.3, 2, 0.02,
                        { when: P => +P.engOn }]);

// ---- materials ------------------------------------------------------------
// the shared bench palette (_eng_page.js) as THREE materials
const matCache = {};
const matOf = name => {
  if (!matCache[name]) {
    const [met, rgh] = EP.PROPS[name] || [0.55, 0.5];
    matCache[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(EP.COL[name] || EP.NEUTRAL),
      metalness: met, roughness: rgh, side: THREE.DoubleSide });
  }
  return matCache[name];
};
const steelMat = new THREE.MeshStandardMaterial({
  color: 0x6d737a, metalness: 0.90, roughness: 0.35,
  side: THREE.DoubleSide });
const propM = new THREE.MeshStandardMaterial({
  color: 0xc79a63, metalness: 0.0, roughness: 0.62,
  side: THREE.DoubleSide });
const propMat = () => {
  const M = CW.MATERIALS[Math.max(0, Math.min(CW.MATERIALS.length - 1,
    Math.round(CW.P.material)))];
  propM.color.setHex(M.col); propM.metalness = M.met; propM.roughness = M.rgh;
  return propM;
};
function meshFrom(m) {
  const pos = new Float32Array(m.V.length * 3);
  m.V.forEach((p, i) => { pos[i*3] = p[0]; pos[i*3+1] = p[1]; pos[i*3+2] = p[2]; });
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

// ---- the build ------------------------------------------------------------
let group = null;
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};

const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  const { scene, mesh, P, stat } = ctx;
  dispose(group); group = null;
  if (!P.engOn) return;
  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const nf = window.CAGE_NOSE && window.CAGE_NOSE.noseFace;
  const face = nf ? nf(mesh, FS) : null;
  if (!face) {
    if (stat) stat.textContent += '  ·  engine: no engine face on this body';
    return;
  }

  const spec = Object.assign(EP.engDefaults(),
    EP.PRESETS[PRESET_NAMES[Math.round(P.engPreset)] ] || {}, {
      quality: Math.max(0.3, P.engDetail || 0.8),
      fwOn: 0,                 // the genuine firewall is the cage's own
      mount: 1,
    });
  let M;
  try { M = EM.engMeshBuild(spec); }
  catch (e) {
    if (stat) stat.textContent += '  ·  engine: ' + e.message;
    return;
  }
  const R = M.resolved;
  // the bench's own firewall-station formula (piston and electric both):
  // that station goes ON the cage's engine face
  const Pm = Object.assign({}, EM.ENGM_DEFAULT, R.P);
  const cR = R.place.caseR != null ? R.place.caseR : R.place.canR;
  const zFw = R.place.zAft - Pm.mountGap * cR;

  group = new THREE.Group();
  group.add(meshFrom(M));

  // spinner + shaft + blades — rebased from the cowl frame to the crank.
  // The values are pushed into CW.P HERE because the cowl layer now skips
  // these rows, and with the cowl off its post never runs at all.
  for (const k of SPINPROP_KEYS)
    if (P['cw_' + k] !== undefined && CW.P[k] !== undefined)
      CW.P[k] = P['cw_' + k];
  // rebase: subtracting coneBaseZ (= cowl end + noseOff) would cancel the
  // builder's own offset dial — so the cone base lands at flange + noseOff
  // and the row reads "base fwd of flange"
  const ax = CW.axisXY(), cb = CW.coneBaseZ();
  const nOff = CW.P.noseOff || 0;
  const ng = new THREE.Group();
  CW.buildNose(ng, { prop: propMat(), steel: steelMat });
  ng.position.set(-ax.x, -ax.y, -cb + nOff);   // cone base -> flange + dial
  group.add(ng);
  let pg = null;
  if (P.propOn) {
    pg = new THREE.Group();
    pg.position.set(0, 0, CW.bladePlaneZ() - cb + nOff);
    const info = CW.propGeometry();
    const pm = propMat();
    for (let k = 0; k < Math.round(CW.P.bladeN); k++) {
      const b = new THREE.Group();
      b.add(new THREE.Mesh(info.geom, pm));
      b.add(new THREE.Mesh(info.root, pm));
      b.add(new THREE.Mesh(info.tip, pm));
      b.rotation.z = k / Math.round(CW.P.bladeN) * Math.PI * 2;
      pg.add(b);
    }
    group.add(pg);
  }

  // ON THE THRUSTLINE, BOLTED TO THE GENUINE FIREWALL: the crank rides the
  // cowl's aperture axis (the same two offsets steer everything), and the
  // engine's firewall station lands on the face plane
  group.position.set(ax.x, face.yc + ax.y, face.z - zFw);
  // the assembly explodes with the airframe (G28's staging, now the
  // engine's: cone past the engine, blades past the cone)
  const ex = Math.max(0, P.explodeD || 0) * FS;
  if (ex > 0) {
    ng.position.z += ex * 1.5;
    if (pg) pg.position.z += ex * 2.0;
  }
  scene.add(group);

  window.CAGE_ENG = { name: PRESET_NAMES[Math.round(P.engPreset)],
                      resolved: R, zFw, quads: M.stats && M.stats.quads };
  if (stat) {
    const head = R.arch === 'electric'
      ? (R.powerW / 1000).toFixed(1) + ' kW cont'
      : R.litres.toFixed(2) + ' L · ' + (R.powerW / 1000).toFixed(0) + ' kW';
    stat.textContent += '  ·  engine: ' + R.archName +
      (R.cyl ? ' ' + R.cyl : '') + ' · ' + head + ' · ' +
      R.mass.toFixed(0) + ' kg';
  }
};
})();
