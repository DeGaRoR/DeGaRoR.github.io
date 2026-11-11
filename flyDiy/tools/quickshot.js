// QUICKSHOT - a FAST picture of a build, no browser and no GPU: the editor's own layers built headless
// (_scene_headless.sceneBuild - the same PAGE.post chain the cage bench runs) plus the cage sheet, rasterised in
// node (orthographic, z-buffer, flat shading, the meshes' own material colours) and written as PNG. Seconds, where
// the bench in a headless browser takes minutes - for a cloud session, a review or anyone the cage 8 bench is too
// slow for. Guide: tools/QUICKSHOT.md.
//
//   node tools/quickshot.js <build.json | --key <archetype>> <out-prefix> [options]
//     --views side,top,front,q   which pictures (default side,top); q = a three-quarter from ahead, starboard, above;
//                                bottom = from below, qb = a three-quarter from ahead, starboard, below (RETRACT G4),
//                                qr = a three-quarter from BEHIND, starboard, above
//     --flat                     flat facets (the default: smooth shading, the meshes' own vertex normals)
//     --nowells / --noedges      the retractable gear's wells: drawn whole, uncut / the reserved boxes' edges not drawn
//     --focus gear               frame the picture on the gear (and the wing's wells), not the whole aeroplane
//     --frames '{"qb":[u0,u1,w0,w1],...}'   the views' frames given (each picture prints the frame it used)
//     --over '{"row":value}'     panel rows over the build (try a slider without saving a file)
//     --crop z0,z1,y0,y1         the side view's window, metres (z forward, y up)
//     --around x,y,z,r           any view framed on a point (layer metres), r either way of it
//     --wire                     the lofts' grids drawn over the picture (the hub's blend: rows and rays)
//     --w 1400                   picture width, px
//     --marks fittings|corners|reg   rings on the placed fittings / a quad window's corners / the registration
//     --gear 0..1                a retractable gear's position (RETRACT G1: 1 down, 0 up) - the editor's own preview row
//                                (gearPos): the gear layer folds each unit by its chain, as the flown aeroplane does; the
//                                build must retract (--over '{"gearRetract":1}' on a low-wing tricycle; the fold:
//                                gearFold / gearFoldNose / the custom rows, gearRetFrac)
//   A build is a saved file ({spec} or a bare spec); --key births an archetype card the way the shed does
//   (designBake + the load door, the cowl fitted once) and draws that.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const KEY = opt('key', null);
const FILE = KEY ? null : pos[0], OUT = KEY ? pos[0] : pos[1];
if (!OUT || (!FILE && !KEY)) { console.error('usage: node tools/quickshot.js <build.json | --key <archetype>> <out-prefix> [--views side,top,front,q] [--over JSON] [--crop z0,z1,y0,y1] [--w px] [--marks ...]'); process.exit(2); }
const ROOT = path.resolve(__dirname, '..');
const over = JSON.parse(opt('over', '{}'));
const GEARPOS = opt('gear', null);                    // RETRACT-1 / G1: the gear's preview position (the gearPos row)
if (GEARPOS != null) over.gearPos = Math.max(0, Math.min(1, +GEARPOS));
const VIEWS = opt('views', 'side,top').split(',');
const WPX = +opt('w', 1400);
const MARKS = opt('marks', '');
const FLAT = argv.includes('--flat');                 // GR: the old flat facets (the default shades smoothly)
const SH = require(path.join(ROOT, 'tools', '_scene_headless.js'));
let spec;
if (KEY) {
  const BJ = require(path.join(ROOT, 'tools', '_bake_joined.js')), LB = require(path.join(ROOT, 'tools', '_load_build.js'));
  const { D } = BJ.loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === KEY);
  if (!a) { console.error('no archetype ' + KEY + ' - one of: ' + D.ARCHETYPES.map(x => x.key).join(' ')); process.exit(2); }
  const s0 = D.designBake(a.sel, a.over);
  const r = LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 });
  if (r.errors.length) console.log('join errors: ' + r.errors.length + ' ' + r.errors[0]);
  spec = r.spec;
} else {
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  spec = raw.spec || raw;
}
const t0 = Date.now();
const S = SH.sceneBuild(spec, { over, garage: spec });
if (S.errors.length) console.log('layer errors: ' + S.errors.length + ' ' + S.errors[0].split('\n')[0]);
const THREE = SH.context().THREE;

// ---- the triangles, world metres, with a colour --------------------------------------------------------------
const SKIP_SHEET = new Set(['tube', 'cloth', 'dash', 'dashFace', 'bulkhead', 'fireProof', 'firewall', 'fireSeal',
  'shoulder', 'toele', 'plywood', 'floorBoard', 'seat', 'bulkTrim', 'baggage', 'headliner', 'cabWall']);
const GLASS = new Set(['windshield', 'pilotWindow', 'pasengerWindow', 'skyWindows', 'drawnPane']);
const tris = [];   // [ax,ay,az, bx,by,bz, cx,cy,cz, r,g,b]
const P = S.P, FS = S.FS;
// RETRACT G4: the wells cut into the drawn sheet as the editor cuts its fuselage (_knife_gen knifeWells, the gear
// layer's CAGE_GEAR.cuts); --nowells draws the sheet whole
// HULL-B55: --fit prints the gear layer's own fit verdict (foldFit: the rows it reddens and why; CAGE_ROW_BAD)
if (argv.includes('--fit')) { const B = S.W.CAGE_ROW_BAD ? S.W.CAGE_ROW_BAD() : null, F = S.W.CAGE_GEAR && S.W.CAGE_GEAR.fit;
  console.log('fit: ' + (F ? (B ? 'RED ' + JSON.stringify([...new Set(Object.values(B))]) + (S.W.CAGE_GEAR.mechInfo && S.W.CAGE_GEAR.mechInfo.L && S.W.CAGE_GEAR.mechInfo.L.kneeGeo ? ' knee ' + JSON.stringify(S.W.CAGE_GEAR.mechInfo.L.kneeGeo) : '') : 'fits') : 'no fit record') + (F && F.cutsWing ? ' | wing cuts ' + JSON.stringify(F.cutsWing).slice(0, 300) : '')); }
const CUTS = !argv.includes('--nowells') && S.W.CAGE_GEAR && ((S.W.CAGE_GEAR.cuts || []).concat(S.W.CAGE_GEAR.cutsSide || []));
const sheet = CUTS && CUTS.length ? require(path.join(ROOT, 'tools', '_knife_gen.js')).knifeWells(S.built.sheet, CUTS) : S.built.sheet;
if (CUTS && CUTS.length) console.log('wells cut: ' + CUTS.map(c => c.units.join('+') + ' ' + c.mode + (c.frame ? ' side ' + (c.side > 0 ? '+x' : '-x') : '') + ' (' + c.outline.length + ' pts, ' + (c.frame ? 'floor ' : 'ceiling ') + (c.ceil * FS).toFixed(3) + ' m)').join(', '));
const skin = P.base != null ? P.base : 0xe8a33a;
const hex = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
// the REGISTRATION's footprint (the decal is a texture layer this renderer does not draw): the faces whose field
// along the body (sL, m) and round the section from the waist (sC, m) fall inside the marking, painted white
const DEC = Object.assign({ regL: 2.10, regC: 0.28, regH: 0.30, regW: 0.96 }, (spec.finish && spec.finish.decals) || {});
const inReg = f => { if (!sheet.A || f.v.some(i => !sheet.A[i])) return false;
  let sl = 0, sc = 0; for (const i of f.v) { sl += sheet.A[i][0]; sc += sheet.A[i][1]; } sl = sl / f.v.length * FS; sc = sc / f.v.length * FS;
  return Math.abs(sl - DEC.regL) < DEC.regW / 2 && Math.abs(sc - DEC.regC) < DEC.regH / 2; };
for (const f of sheet.F) {
  if (SKIP_SHEET.has(f.m) || f.v.length < 3) continue;
  const col = MARKS.includes('reg') && inReg(f) ? [245, 245, 245] : GLASS.has(f.m) ? (f.m === 'drawnPane' ? [70, 170, 230] : [60, 110, 160])
    : f.m === 'joint' || f.m === 'paneEdge' || f.m === 'doorSeal' || f.m === 'reveal' ? [40, 40, 44]
    : f.m === 'wheelWell' ? [96, 100, 92]
    : /pillar/.test(f.m) ? [210, 140, 50] : [232, 163, 58];
  const off = f.cutOff || [0, 0, 0];
  for (let t = 1; t + 1 < f.v.length; t++) {
    const a = sheet.V[f.v[0]], b = sheet.V[f.v[t]], c = sheet.V[f.v[t + 1]];
    const tr = [a[0] * FS, a[1] * FS, a[2] * FS, b[0] * FS, b[1] * FS, b[2] * FS, c[0] * FS, c[1] * FS, c[2] * FS, ...col];
    // GR: the sheet's own vertex normals (the subdivided surface's), for the smooth shading
    if (sheet.N && !FLAT) { const na = sheet.N[f.v[0]], nb = sheet.N[f.v[t]], nc = sheet.N[f.v[t + 1]]; if (na && nb && nc) tr.n = [...na, ...nb, ...nc]; }
    tris.push(tr);
  }
}
let nLayer = 0;
// RETRACT-1 / G1: --gear is the editor's own preview row (gearPos): the gear layer poses the units itself
if (GEARPOS != null) {
  const SW = S.W.CAGE_GEAR && S.W.CAGE_GEAR.swing;
  if (!SW) console.log('--gear: this build has no retractable gear (gearRetract 0, floats, no nose wheel or not a low wing) - drawn as it is');
  else console.log('--gear ' + over.gearPos + ': ' + Object.keys(SW).map(k => k + ' ' + SW[k].turns.length + ' turn(s), lift ' + SW[k].lift.toFixed(2) + ' m').join(', '));
}
// RETRACT G5: the wing's skin cut as the editor cuts it (_knife_gen knifeWellsGeo, the gear layer's CAGE_GEAR.cutsM)
const CUTSW = !argv.includes('--nowells') && S.W.CAGE_GEAR && S.W.CAGE_GEAR.cutsM;
if (CUTSW) {
  const KGw = require(path.join(ROOT, 'tools', '_knife_gen.js')), skins = [];
  S.scene.traverse(o => { if (o.isMesh && o.userData && o.userData.wingSkin) skins.push(o); });
  let nw = 0;
  for (const o of skins) {
    const AFg = S.W.CAGE_GEAR.AF, inBody = AFg ? (x, z) => z > AFg.z0 && z < AFg.z1 && Math.abs(x) < AFg.halfWAt(z) - 0.005 : null;
    const mine = CUTSW.filter(c => (c.plane || 0) === (o.userData.wingPlane || 0));     // (P2: each plane its own cuts)
    if (!mine.length) continue;
    const r = KGw.knifeWellsGeo(THREE, o.geometry, mine, (o.userData.wingPlane || 0) ? null : S.W.CAGE_GEAR.pierceTopM || null, inBody);
    if (!r.skin) continue;
    o.geometry = r.skin;
    if (r.well) { const wm = new THREE.Mesh(r.well, new THREE.MeshLambertMaterial({ color: 0x60645c })); wm.name = 'edWellWing'; o.add(wm); nw++; }
  }
  console.log('wing wells cut: ' + CUTSW.map(c => c.units.join('+') + ' ' + c.mode).join(', ') + ' (' + nw + ' skin mesh(es) with a well)');
}
// GR: the nacelles' skin cut as the editor cuts it (knifeWellsMesh, the gear layer's CAGE_GEAR.cutsNacM)
const CUTSN = !argv.includes('--nowells') && S.W.CAGE_GEAR && S.W.CAGE_GEAR.cutsNacM;
if (CUTSN) {
  const KGn = require(path.join(ROOT, 'tools', '_knife_gen.js')), nm = [];
  S.scene.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(S.scene.matrixWorld).invert();
  S.scene.traverse(o => { if (o.isMesh && o.userData && o.userData.nacSkin) nm.push(o); });
  let nn = 0;
  for (const o of nm) {
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const r = KGn.knifeWellsMesh(THREE, o.geometry, rel, CUTSN, o.userData.nacSkin !== 'skin');   // (twins and shells: the hole only)
    if (!r.skin) continue;
    o.geometry = r.skin;
    if (r.well) { const wm = new THREE.Mesh(r.well, new THREE.MeshLambertMaterial({ color: 0x60645c })); wm.name = 'edWellNac'; o.add(wm); nn++; }
  }
  console.log('nacelle wells cut: ' + CUTSN.map(c => c.units.join('+') + ' ' + c.mode).join(', ') + ' (' + nn + ' nacelle mesh(es) with a well)');
}
S.scene.updateMatrixWorld(true);
const v = new THREE.Vector3();
const segs = [];   // RETRACT G3: the gear's reserved wells (edWellGhost's edges), drawn over the picture
const WIRE = argv.includes('--wire'), wires = [];   // --wire: the lofts' grids (userData.grid), depth-tested
S.scene.traverse(o => {
  if (o.isLineSegments && o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
    let inWell = false; for (let q = o; q; q = q.parent) if (q.name === 'edWellGhost') inWell = true;
    if (!inWell || argv.includes('--noedges')) return;
    const pa = o.geometry.attributes.position, m = o.material, col = m && m.color ? [m.color.r * 255, m.color.g * 255, m.color.b * 255].map(Math.round) : [255, 160, 60];
    for (let i = 0; i + 1 < pa.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld), b = new THREE.Vector3().fromBufferAttribute(pa, i + 1).applyMatrix4(o.matrixWorld);
      segs.push({ a: [a.x, a.y, a.z], b: [b.x, b.y, b.z], col });
    }
    return;
  }
  if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
  // --wire: a mesh that keeps its loft's grid (userData.grid, rows of points - the hub's blend) draws it, its rows and
  // its rays, the quads' own edges (depth-tested: only what is seen)
  if (WIRE && o.userData && Array.isArray(o.userData.grid)) {
    const Gd = o.userData.grid, Wm = p => { const q = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(o.matrixWorld); return [q.x, q.y, q.z]; };
    for (let i = 0; i < Gd.length; i++) for (let k = 0; k < Gd[i].length; k++) {
      const k2 = (k + 1) % Gd[i].length;
      wires.push({ a: Wm(Gd[i][k]), b: Wm(Gd[i][k2]) });
      if (i + 1 < Gd.length) wires.push({ a: Wm(Gd[i][k]), b: Wm(Gd[i + 1][k]) });
    }
  }
  if (o.visible === false || /^edVessel_|^edFuel_|^edCrew/.test(o.name || '')) return;
  let hidden = false; for (let q = o; q; q = q.parent) if (q.visible === false) hidden = true;
  if (hidden) return;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  let col = m && m.color ? [m.color.r * 255, m.color.g * 255, m.color.b * 255].map(Math.round) : [180, 180, 180];
  if (/^edAcc_/.test(o.name || '') || (o.parent && /access/.test(o.parent.name || ''))) col = [220, 40, 40];
  // (the hub's blend wears the body's paint in the editor - its livery section follows the fuselage's; here the sheet's
  // own colour, as the rod it grows out of is drawn)
  if (o.name === 'rodHubSocket') col = hex(skin);
  if (m && m.transparent && m.opacity < 0.3) return;
  const pos = o.geometry.attributes.position, idx = o.geometry.index;
  const n = idx ? idx.count : pos.count;
  const W = i => { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld); return [v.x, v.y, v.z]; };
  let gear = false; for (let q = o; q; q = q.parent) if (q.name === 'cageLayer:gear' || q.name === 'edWellWing' || q.name === 'edWellNac') gear = true;
  const nor = !FLAT && o.geometry.attributes.normal, nm3 = nor ? new THREE.Matrix3().getNormalMatrix(o.matrixWorld) : null, vn = new THREE.Vector3();
  const N3 = i => { vn.fromBufferAttribute(nor, idx ? idx.getX(i) : i).applyMatrix3(nm3).normalize(); return [vn.x, vn.y, vn.z]; };
  // (P2: vertex colours multiply the material's, as three.js does - a door's grime)
  const vc = m && m.vertexColors && o.geometry.attributes.color, C3 = i => { const j = idx ? idx.getX(i) : i; return [vc.getX(j), vc.getY(j), vc.getZ(j)]; };
  for (let i = 0; i + 2 < n; i += 3) { const a = W(i), b = W(i + 1), c = W(i + 2); const t = [...a, ...b, ...c, ...col]; if (gear) t.gear = 1;
    if (nor) t.n = [...N3(i), ...N3(i + 1), ...N3(i + 2)];
    if (vc) t.c = [...C3(i), ...C3(i + 1), ...C3(i + 2)];
    tris.push(t); nLayer++; }
});
console.log('tris: sheet ' + (tris.length - nLayer) + ', layers ' + nLayer + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s build)');

// ---- the marks: fittings placed, quad corners ---------------------------------------------------------------
const marks = [];
if (MARKS.includes('fittings') && S.W.CAGE_ACCESS)
  for (const q of S.W.CAGE_ACCESS.placed) if (/step|doorHandle|fuelCap|grabHandle/.test(q.key) && q.side !== 'port') marks.push({ p: q.p, col: [255, 255, 255], r: 5 });
if (MARKS.includes('corners'))
  for (const w of (S.spec.windows || [])) if (w.shape === 'quad' && w.corners) for (const c of w.corners) marks.push({ p: [P.halfW * FS * 1.2, c[1] * FS, c[0] * FS], col: [255, 230, 60], r: 5 });

// ---- the raster ---------------------------------------------------------------------------------------------
function view(name) {
  // u right, w up on the picture; d = toward the camera (larger = nearer)
  const V = {
    side: { u: p => -p[2], w: p => p[1], d: p => p[0] },                 // from starboard, the nose to the left
    top: { u: p => -p[2], w: p => -p[0], d: p => p[1] },                  // from above, the nose to the left
    front: { u: p => -p[0], w: p => p[1], d: p => p[2] },                // head-on, starboard on the left
    bottom: { u: p => -p[2], w: p => p[0], d: p => -p[1] },              // RETRACT G4: from below, the nose to the left
    q: {}, qb: {}, qr: {},                                                 // set below
  }[name];
  if (name === 'qb') {  // RETRACT G4: a three-quarter from ahead, starboard, BELOW (the wells): yaw 37 deg, pitch -28 deg
    const cy = Math.cos(0.65), sy = Math.sin(0.65), cp = Math.cos(-0.49), sp = Math.sin(-0.49);
    V.u = p => -p[2] * cy + p[0] * sy;
    const dd = p => p[0] * cy + p[2] * sy;
    V.w = p => p[1] * cp - dd(p) * sp;
    V.d = p => dd(p) * cp + p[1] * sp;
  }
  if (name === 'q' || name === 'qr') {   // a three-quarter from ahead (q) / from BEHIND (qr), starboard, above: yaw 37 deg, pitch 22 deg
    const yaw = name === 'qr' ? -0.65 : 0.65;          // (the camera at +x, -z: aft and starboard)
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(0.38), sp = Math.sin(0.38);
    V.u = p => -p[2] * cy + p[0] * sy;
    const dd = p => p[0] * cy + p[2] * sy;
    V.w = p => p[1] * cp - dd(p) * sp;
    V.d = p => dd(p) * cp + p[1] * sp;
  }
  let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
  // RETRACT GR: --focus gear frames the picture on the gear layer's parts (and the wing's wells), with a margin
  const FOCUS = opt('focus', null) === 'gear' && tris.some(t => t.gear);
  for (const t of tris) if (!FOCUS || t.gear) for (let k = 0; k < 9; k += 3) { const p = [t[k], t[k + 1], t[k + 2]]; const u = V.u(p), w = V.w(p); u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
  const crop = opt('crop', null);
  if (crop && name === 'side') { const [z0, z1, y0, y1] = crop.split(',').map(Number); u0 = -z1; u1 = -z0; w0 = y0; w1 = y1; }
  // --around x,y,z,r: ANY view framed on a point (the layer's metres: x starboard, y up, z forward), r either way of it
  const AR = opt('around', null);
  if (AR) { const [ax, ay, az, ar] = AR.split(',').map(Number), pu = V.u([ax, ay, az]), pw = V.w([ax, ay, az]);
            u0 = pu - ar; u1 = pu + ar; w0 = pw - 0.62 * ar; w1 = pw + 0.62 * ar; }
  if (FOCUS) { const m = 0.18 * Math.max(u1 - u0, w1 - w0); u0 -= m; u1 += m; w0 -= m; w1 += m; }
  // --frames '{"qb":[u0,u1,w0,w1]}': a frame given (a series of pictures in one frame); every frame used is printed
  const FR = opt('frames', null) ? JSON.parse(opt('frames', '{}'))[name] : null;
  if (FR) { [u0, u1, w0, w1] = FR; }
  console.log('frame ' + name + ': ' + JSON.stringify([u0, u1, w0, w1].map(x => +x.toFixed(4))));
  const pad = 0.04 * (u1 - u0);
  u0 -= pad; u1 += pad; w0 -= pad; w1 += pad;
  const sc = WPX / (u1 - u0), H = Math.ceil((w1 - w0) * sc), Wd = WPX;
  const img = new Uint8Array(Wd * H * 3), zb = new Float32Array(Wd * H).fill(-Infinity);
  for (let i = 0; i < Wd * H; i++) { img[i * 3] = 22; img[i * 3 + 1] = 26; img[i * 3 + 2] = 32; }
  const L = [0.35, 0.8, 0.45], Ll = Math.hypot(...L);
  const vd = [V.d([1, 0, 0]) - V.d([0, 0, 0]), V.d([0, 1, 0]) - V.d([0, 0, 0]), V.d([0, 0, 1]) - V.d([0, 0, 0])];   // toward the camera
  for (const t of tris) {
    const A = [t[0], t[1], t[2]], B = [t[3], t[4], t[5]], C = [t[6], t[7], t[8]];
    const ax = (V.u(A) - u0) * sc, ay = (w1 - V.w(A)) * sc, az = V.d(A);
    const bx = (V.u(B) - u0) * sc, by = (w1 - V.w(B)) * sc, bz = V.d(B);
    const cx = (V.u(C) - u0) * sc, cy = (w1 - V.w(C)) * sc, cz = V.d(C);
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-9) continue;
    // flat shade: the world normal against a fixed light, both faces lit
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const nl = Math.hypot(nx, ny, nz) || 1;
    const lam = 0.35 + 0.65 * Math.abs((nx * L[0] + ny * L[1] + nz * L[2]) / (nl * Ll));
    let r = Math.min(255, t[9] * lam), g = Math.min(255, t[10] * lam), b = Math.min(255, t[11] * lam);
    // GR (the user: "all this flat shading doesn't help"): SMOOTH SHADING - the vertex normals interpolated per pixel
    // (oriented to the face's side), a Lambert term and a soft highlight; --flat draws the old flat facets
    const tn = t.n, sgf = tn ? Math.sign(nx * (tn[0] + tn[3] + tn[6]) + ny * (tn[1] + tn[4] + tn[7]) + nz * (tn[2] + tn[5] + tn[8])) || 1 : 1;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(Wd - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0_ = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
      const w1_ = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
      const w2_ = 1 - w0_ - w1_;
      if (w0_ < -1e-6 || w1_ < -1e-6 || w2_ < -1e-6) continue;
      const z = w0_ * az + w1_ * bz + w2_ * cz, i = y * Wd + x;
      if (z <= zb[i]) continue;
      zb[i] = z;
      if (tn) {
        let qx = w0_ * tn[0] + w1_ * tn[3] + w2_ * tn[6], qy = w0_ * tn[1] + w1_ * tn[4] + w2_ * tn[7], qz = w0_ * tn[2] + w1_ * tn[5] + w2_ * tn[8];
        const ql = Math.hypot(qx, qy, qz) || 1; qx *= sgf / ql; qy *= sgf / ql; qz *= sgf / ql;
        const dl = Math.abs((qx * L[0] + qy * L[1] + qz * L[2]) / Ll);
        // the highlight: the light's half vector with the view (d toward the camera)
        const hx = L[0] / Ll + vd[0], hy = L[1] / Ll + vd[1], hz = L[2] / Ll + vd[2], hl = Math.hypot(hx, hy, hz) || 1;
        const sp = Math.pow(Math.abs((qx * hx + qy * hy + qz * hz) / hl), 24) * 0.18;
        let lm = 0.32 + 0.68 * dl;
        const tc = t.c, vr = tc ? w0_ * tc[0] + w1_ * tc[3] + w2_ * tc[6] : 1, vg = tc ? w0_ * tc[1] + w1_ * tc[4] + w2_ * tc[7] : 1, vb = tc ? w0_ * tc[2] + w1_ * tc[5] + w2_ * tc[8] : 1;
        img[i * 3] = Math.min(255, t[9] * vr * lm + 255 * sp * vr); img[i * 3 + 1] = Math.min(255, t[10] * vg * lm + 255 * sp * vg); img[i * 3 + 2] = Math.min(255, t[11] * vb * lm + 255 * sp * vb);
      } else { img[i * 3] = r; img[i * 3 + 1] = g; img[i * 3 + 2] = b; }
    }
  }
  // an edge darkening where the depth jumps (a silhouette line)
  const out = new Uint8Array(img);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < Wd - 1; x++) {
    const i = y * Wd + x, z = zb[i];
    if (!isFinite(z)) continue;
    const jump = Math.max(...[i - 1, i + 1, i - Wd, i + Wd].map(j => isFinite(zb[j]) ? Math.abs(zb[j] - z) : 1));
    if (jump > 0.04) for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.round(img[i * 3 + k] * 0.35);
  }
  for (const m of marks) {
    const x = Math.round((V.u(m.p) - u0) * sc), y = Math.round((w1 - V.w(m.p)) * sc);
    for (let dy = -m.r; dy <= m.r; dy++) for (let dx = -m.r; dx <= m.r; dx++) {
      const rr = Math.hypot(dx, dy); if (rr > m.r || rr < m.r - 2) continue;
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= Wd || Y >= H) continue;
      const i = Y * Wd + X; out[i * 3] = m.col[0]; out[i * 3 + 1] = m.col[1]; out[i * 3 + 2] = m.col[2];
    }
  }
  for (const s of wires) {  // --wire: the grid's edges, 1 px, where they are seen (the depth buffer, a hair's bias)
    const ax = (V.u(s.a) - u0) * sc, ay = (w1 - V.w(s.a)) * sc, az = V.d(s.a), bx = (V.u(s.b) - u0) * sc, by = (w1 - V.w(s.b)) * sc, bz = V.d(s.b);
    const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))) + 1;
    for (let k = 0; k <= n; k++) { const t = k / n, x = Math.round(ax + (bx - ax) * t), y = Math.round(ay + (by - ay) * t), z = az + (bz - az) * t;
      if (x < 0 || y < 0 || x >= Wd || y >= H) continue;
      const i = y * Wd + x; if (z < zb[i] - 0.004) continue;
      out[i * 3] = 20; out[i * 3 + 1] = 20; out[i * 3 + 2] = 24; }
  }
  for (const s of segs) {   // RETRACT G3: the wells' edges, 2 px, over everything
    const ax = (V.u(s.a) - u0) * sc, ay = (w1 - V.w(s.a)) * sc, bx = (V.u(s.b) - u0) * sc, by = (w1 - V.w(s.b)) * sc;
    const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))) + 1;
    for (let k = 0; k <= n; k++) { const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= Wd || Y >= H) continue;
        const i = Y * Wd + X; out[i * 3] = s.col[0]; out[i * 3 + 1] = s.col[1]; out[i * 3 + 2] = s.col[2]; } }
  }
  writePNG(OUT + '_' + name + '.png', out, Wd, H);
  console.log('wrote ' + OUT + '_' + name + '.png ' + Wd + 'x' + H + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
}
function writePNG(file, rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
for (const n of VIEWS) view(n);
