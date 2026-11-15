// QUICKSHOT - a FAST picture of a build, no browser and no GPU: the editor's own layers built headless
// (_scene_headless - the same PAGE.post chain the garage runs) plus the cage sheet, rasterised in node (orthographic,
// z-buffer, smooth shading) and written as PNG. Seconds, where the bench in a headless browser takes minutes - for a
// cloud session, a review or anyone the cage 8 bench is too slow for. Guide: tools/QUICKSHOT.md.
//
// QUICKSHOT-ONE (15 Nov, the user: "Quickshot was missing rendering of pilot, dash positions and controls, and texture
// preview ... Unify it, not 3 modes"): ONE picture, everything the player sees, by default -
//   the pilot and the seated occupants in their seats, the dash (its place, the instruments painted, the controls: stick
//   or yoke, throttle, pedals, as the crew and panel layers place them), the interior seen through translucent glass;
//   THE LIVERY as the garage paints it: each section's colour by the garage's own resolution (AEROSKIN aeroSecResolve
//   over the build's finish, the finish's base under no tint) and the decals - the kit patterns, the stickers, the text
//   pieces, the registration - painted by aeroskin.js's own painters on a software canvas (_canvas_soft.js) and laid on
//   the surfaces by a port of its shader's decal loop (field / side / plan boxes, sides, mirrors, the surface classes).
// --parts is the old part-colour view (the sheet orange, the layers' own colours, no cabin, no livery): fitting uses it.
// --sheet [img] HOSTS THE PROJECTION: the plane's reference block (ref.views / marks, the drafting table's) drawn per view
// through dt_core's own toPx with our render over the drawing, the red veil, the score table and the dimensions diff
// (tools/drafting/dt_sheet.js - table.js check --png calls this same code).
//
//   node tools/quickshot.js <build.json | --key <archetype>> <out-prefix> [options]
//     --views side,top,front,q   which pictures (default side,top); q = a three-quarter from ahead, starboard, above;
//                                bottom = from below, qb = a three-quarter from ahead, starboard, below (RETRACT G4);
//                                qr = from behind, starboard, above; qp = from ahead, port, above;
//                                qrb = from behind, starboard, below (the Archaeopteryx study)
//     --parts                    the part-colour view (the old quickshot: no cabin, no livery; ~3 s)
//     --sheet [img]              the projection on the drawing (the build's own ref block, or --ref file); writes
//                                <out>_sheet.png (side / top / front stacked, the score table under them)
//     --ref ref.json             a reference block from its own file (a card under --key has none)
//     --measure out.json         the table's key measurements of what quickshot drew, as JSON (GATE QSPARITY)
//     --door                     the build through the game's load door (_load_build.js: the join's clamps), not the file
//     --flat                     flat facets (the default: smooth shading, the meshes' own vertex normals)
//     --nowells / --noedges      the retractable gear's wells: drawn whole, uncut / the reserved boxes' edges not drawn
//     --focus gear               frame the picture on the gear (and the wing's wells), not the whole aeroplane
//     --frames '{"qb":[u0,u1,w0,w1],...}'   the views' frames given (each picture prints the frame it used)
//     --over '{"row":value}'     panel rows over the build (try a slider without saving a file)
//     --crop z0,z1,y0,y1         the side view's window, metres (z forward, y up)
//     --around x,y,z,r           any view framed on a point (layer metres), r either way of it
//     --wire                     the lofts' grids drawn over the picture (the hub's blend: rows and rays)
//     --half                     the cutaway: the body's starboard half left out, so what runs inside the cabin shows
//     --w 1400                   picture width, px
//     --marks fittings|corners|reg   rings on the placed fittings / a quad window's corners / the registration's box
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
const FLAGS = new Set(['parts', 'sheet', 'door', 'flat', 'nowells', 'noedges', 'wire', 'half', 'fit']);
// positionals: not an option, not an option's value (a flag takes no value; --sheet's image is its own optional value)
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !FLAGS.has(argv[i - 1].slice(2))) &&
  !(i > 0 && argv[i - 1] === '--sheet' && /\.(png)$/i.test(a)));
const KEY = opt('key', null);
const FILE = KEY ? null : pos[0], OUT = KEY ? pos[0] : pos[1];
if (!OUT || (!FILE && !KEY)) { console.error('usage: node tools/quickshot.js <build.json | --key <archetype>> <out-prefix> [--views side,top,front,q] [--parts] [--sheet [img]] [--over JSON] [--crop z0,z1,y0,y1] [--w px] [--marks ...]'); process.exit(2); }
const ROOT = path.resolve(__dirname, '..');
const over = JSON.parse(opt('over', '{}'));
const GEARPOS = opt('gear', null);                    // RETRACT-1 / G1: the gear's preview position (the gearPos row)
if (GEARPOS != null) over.gearPos = Math.max(0, Math.min(1, +GEARPOS));
const PARTS = argv.includes('--parts');
const SHEET = argv.includes('--sheet');
const SHEET_IMG = (() => { const i = argv.indexOf('--sheet'); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') && /\.png$/i.test(argv[i + 1]) ? argv[i + 1] : null; })();
const MEASURE = opt('measure', null);
const VIEWS = SHEET && !argv.includes('--views') ? [] : opt('views', 'side,top').split(',').filter(v => v && v !== 'none');
const WPX = +opt('w', 1400);
const MARKS = opt('marks', '');
const FLAT = argv.includes('--flat');                 // GR: the old flat facets (the default shades smoothly)
const SH = require(path.join(ROOT, 'tools', '_scene_headless.js'));
let spec, doc = null;
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
  doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  spec = argv.includes('--door') ? require(path.join(ROOT, 'tools', '_load_build.js')).loadBuild(path.resolve(FILE)).spec : (doc.spec || doc);
  if (argv.includes('--door')) console.log('the load door: the join\'s spec (its clamps), not the file\'s');
}
const REF = opt('ref', null) ? JSON.parse(fs.readFileSync(opt('ref'), 'utf8')) : (doc && doc.ref) || null;
if ((SHEET || MEASURE) && !(REF && REF.views)) { console.error('--sheet / --measure need a reference block (the plane file\'s ref, or --ref ref.json)'); process.exit(2); }

(async function main() {
const t0 = Date.now();
if (!PARTS) SH.context({ whole: true });
// --level n: the sheet's subdivision (the garage draws 2, the drafting table measures its draft at 0)
const LEVEL = opt('level', null) != null ? { level: +opt('level') } : {};
const S = PARTS ? SH.sceneBuild(spec, Object.assign({ over, garage: spec }, LEVEL)) : await SH.sceneBuildWhole(spec, Object.assign({ over, garage: spec }, LEVEL));
if (S.errors.length) console.log('layer errors: ' + S.errors.length + ' ' + S.errors[0].split('\n')[0]);
const THREE = SH.context().THREE;
const A = !PARTS && S.W.AEROSKIN;

// ---- the triangles, world metres, with a colour --------------------------------------------------------------
// a triangle: [ax,ay,az, bx,by,bz, cx,cy,cz, r,g,b] + optional .n (vertex normals), .c (vertex colours), .gear,
// .al (opacity < 1: glass, drawn after the solids, blended), .uv + .tex (a painted map, sampled), .dk (the livery's
// decal record: { cls, ok }) with .f (the surface field, metres: 3 x (along, around)) when the surface has one
const SKIP_SHEET = PARTS ? new Set(['tube', 'cloth', 'dash', 'dashFace', 'bulkhead', 'fireProof', 'firewall', 'fireSeal',
  'shoulder', 'toele', 'plywood', 'floorBoard', 'seat', 'bulkTrim', 'baggage', 'headliner', 'cabWall']) : new Set(['tube', 'cloth']);
const GLASS = new Set(['windshield', 'pilotWindow', 'pasengerWindow', 'skyWindows', 'drawnPane']);
const GLASS_RE = /window|windshield|pane$|^drawnPane|skylight|bubble|canopy|glass/i;   // (dt_build's own)
const tris = [];
const P = S.P, FS = S.FS;
// RETRACT G4: the wells cut into the drawn sheet as the editor cuts its fuselage (_knife_gen knifeWells, the gear
// layer's CAGE_GEAR.cuts); --nowells draws the sheet whole
// HULL-B55: --fit prints the gear layer's own fit verdict (foldFit: the rows it reddens and why; CAGE_ROW_BAD)
if (argv.includes('--fit')) { const B = S.W.CAGE_ROW_BAD ? S.W.CAGE_ROW_BAD() : null, F = S.W.CAGE_GEAR && S.W.CAGE_GEAR.fit;
  console.log('fit: ' + (F ? (B ? 'RED ' + JSON.stringify([...new Set(Object.values(B))]) + (S.W.CAGE_GEAR.mechInfo && S.W.CAGE_GEAR.mechInfo.L && S.W.CAGE_GEAR.mechInfo.L.kneeGeo ? ' knee ' + JSON.stringify(S.W.CAGE_GEAR.mechInfo.L.kneeGeo) : '') : 'fits') : 'no fit record') + (F && F.cutsWing ? ' | wing cuts ' + JSON.stringify(F.cutsWing).slice(0, 300) : '')); }
const CUTS = !argv.includes('--nowells') && S.W.CAGE_GEAR && ((S.W.CAGE_GEAR.cuts || []).concat(S.W.CAGE_GEAR.cutsSide || []));
const sheet = CUTS && CUTS.length ? require(path.join(ROOT, 'tools', '_knife_gen.js')).knifeWells(S.built.sheet, CUTS) : S.built.sheet;
if (CUTS && CUTS.length) console.log('wells cut: ' + CUTS.map(c => c.units.join('+') + ' ' + c.mode + (c.frame ? ' side ' + (c.side > 0 ? '+x' : '-x') : '') + ' (' + c.outline.length + ' pts, ' + (c.frame ? 'floor ' : 'ceiling ') + (c.ceil * FS).toFixed(3) + ' m)').join(', '));
const hex = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const skin = P.base != null ? P.base : 0xe8a33a;
// the REGISTRATION's footprint (--marks reg): the faces whose field along the body (sL, m) and round the section from
// the waist (sC, m) fall inside the marking, painted white
const DEC = Object.assign({ regL: 2.10, regC: 0.28, regH: 0.30, regW: 0.96 }, (spec.finish && spec.finish.decals) || {});
const inReg = f => { if (!sheet.A || f.v.some(i => !sheet.A[i])) return false;
  let sl = 0, sc = 0; for (const i of f.v) { sl += sheet.A[i][0]; sc += sheet.A[i][1]; } sl = sl / f.v.length * FS; sc = sc / f.v.length * FS;
  return Math.abs(sl - DEC.regL) < DEC.regW / 2 && Math.abs(sc - DEC.regC) < DEC.regH / 2; };
// --half: THE CUTAWAY - the body's starboard half (+x, the side the side view looks from) left out, so what runs inside
// the cabin shows (the hanging nacelle's mast down to the keel)
const HALF = argv.includes('--half');
// the sheet's paint (the whole view): each section by the garage's own rule (_scene_headless secPaint = _cage_ui matOf)
const sheetCol = {}, sheetPaint = m => {
  if (sheetCol[m]) return sheetCol[m];
  const glass = GLASS.has(m) || GLASS_RE.test(m);
  if (glass) { const G = A && A.aeroGlassSpec ? A.aeroGlassSpec(spec) : {}; return (sheetCol[m] = { col: hex(G.tint != null ? G.tint : 0x6f8fa8), al: 0.32, glass: 1 }); }
  const pt = S.secPaint ? S.secPaint(m, null, true) : null;
  return (sheetCol[m] = { col: hex(pt ? pt.hex : 0xb8bcc2), al: 1, ok: A && A.aeroDecOk ? A.aeroDecOk(m) : 1 });
};
for (const f of sheet.F) {
  if (SKIP_SHEET.has(f.m) || f.v.length < 3) continue;
  if (HALF && f.v.reduce((a, i) => a + sheet.V[i][0], 0) / f.v.length > 1e-4) continue;
  let col, al = 1, ok = 0;
  if (MARKS.includes('reg') && inReg(f)) col = [245, 245, 245];
  else if (PARTS) col = GLASS.has(f.m) ? (f.m === 'drawnPane' ? [70, 170, 230] : [60, 110, 160])
    : f.m === 'joint' || f.m === 'paneEdge' || f.m === 'doorSeal' || f.m === 'reveal' ? [40, 40, 44]
    : f.m === 'wheelWell' ? [96, 100, 92]
    : /pillar/.test(f.m) ? [210, 140, 50] : [232, 163, 58];
  else if (f.m === 'wheelWell') col = [96, 100, 92];
  else { const sp = sheetPaint(f.m); col = sp.col; al = sp.al; ok = sp.ok || 0; }
  for (let t = 1; t + 1 < f.v.length; t++) {
    const a = sheet.V[f.v[0]], b = sheet.V[f.v[t]], c = sheet.V[f.v[t + 1]];
    const tr = [a[0] * FS, a[1] * FS, a[2] * FS, b[0] * FS, b[1] * FS, b[2] * FS, c[0] * FS, c[1] * FS, c[2] * FS, ...col];
    // GR: the sheet's own vertex normals (the subdivided surface's), for the smooth shading
    if (sheet.N && !FLAT) { const na = sheet.N[f.v[0]], nb = sheet.N[f.v[t]], nc = sheet.N[f.v[t + 1]]; if (na && nb && nc) tr.n = [...na, ...nb, ...nc]; }
    if (al < 1) tr.al = al;
    // LINER-BACK (the editor's matOf sides): a lined skin face shows its front only, the liner on it its back only -
    // drawn both ways, the two coincide and fight (the whole view draws the cabin's linings)
    if (!PARTS && (f.back || f.backed)) tr.cull = f.back ? -1 : 1;
    if (ok > 0.25) { tr.dk = { cls: 0, ok };
      const qa = sheet.A && sheet.A[f.v[0]], qb = sheet.A && sheet.A[f.v[t]], qc = sheet.A && sheet.A[f.v[t + 1]];
      if (qa && qb && qc) tr.f = [qa[0] * FS, qa[1] * FS, qb[0] * FS, qb[1] * FS, qc[0] * FS, qc[1] * FS]; }
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
const texOf = new Map();   // a painted map (a soft canvas: the panel's dial faces) -> { W, H, px, ch }
const TEX = mp => { const im = mp && mp.image; if (!im || !im.data || !im.width) return null;
  if (!texOf.has(im)) texOf.set(im, { W: im.width, H: im.height, px: im.data, ch: 4, flipY: mp.flipY !== false, off: mp.offset ? [mp.offset.x, mp.offset.y] : [0, 0], rep: mp.repeat ? [mp.repeat.x, mp.repeat.y] : [1, 1] });
  return texOf.get(im); };
const colOf = m => !m || !m.color ? [180, 180, 180] : PARTS ? [m.color.r * 255, m.color.g * 255, m.color.b * 255].map(Math.round) : hex(m.color.getHex());
let nSkinned = 0, nTex = 0;
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
  // ...and a mesh that keeps its own quads' edges (userData.wireGeo, a segment list: the wing layer's skin parts)
  if (WIRE && o.userData && o.userData.wireGeo && o.userData.wireGeo.attributes && o.userData.wireGeo.attributes.position) {
    const pa = o.userData.wireGeo.attributes.position, q = new THREE.Vector3(), Wm = i => { q.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); return [q.x, q.y, q.z]; };
    for (let i = 0; i + 1 < pa.count; i += 2) wires.push({ a: Wm(i), b: Wm(i + 1) });
  }
  if (WIRE && o.userData && Array.isArray(o.userData.grid)) {
    const Gd = o.userData.grid, Wm = p => { const q = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(o.matrixWorld); return [q.x, q.y, q.z]; };
    for (let i = 0; i < Gd.length; i++) for (let k = 0; k < Gd[i].length; k++) {
      const k2 = (k + 1) % Gd[i].length;
      wires.push({ a: Wm(Gd[i][k]), b: Wm(Gd[i][k2]) });
      if (i + 1 < Gd.length) wires.push({ a: Wm(Gd[i][k]), b: Wm(Gd[i + 1][k]) });
    }
  }
  // (the vessels and the fuel are inside, the tank tools' job; edCrewPick is the crew's invisible pick box)
  if (o.visible === false || /^edVessel_|^edFuel_|^edCrew/.test(o.name || '')) return;
  let hidden = false; for (let q = o; q; q = q.parent) if (q.visible === false) hidden = true;
  if (hidden) return;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (m && m.visible === false) return;
  let col = colOf(m);
  if (PARTS && (/^edAcc_/.test(o.name || '') || (o.parent && /access/.test(o.parent.name || '')))) col = [220, 40, 40];
  // (the hub's blend wears the body's paint in the editor - its livery section follows the fuselage's; here the sheet's
  // own colour, as the rod it grows out of is drawn)
  if (PARTS && (o.name === 'rodHubSocket' || o.name === 'hangMast')) col = hex(skin);   // (and the hanging nacelle's mast: the body's paint)
  let al = 1;
  if (m && m.transparent && m.opacity < 0.3) { if (PARTS || m.type === 'MeshBasicMaterial') return; al = Math.max(0.2, m.opacity); }
  else if (m && m.transparent && m.opacity < 1) { if (!PARTS && m.type === 'MeshBasicMaterial') return; if (!PARTS) al = m.opacity; }
  if (!PARTS && m && m.type === 'MeshBasicMaterial' && m.transparent) return;   // (the AO patches, the glows: painted shadows)
  const sec = !PARTS && m && m.userData && m.userData.sec;
  if (sec && sec.glass) al = Math.min(al, 0.32);
  const tex = !PARTS && m && TEX(m.map), uvA = tex && o.geometry.attributes.uv;
  if (uvA) nTex++;
  const pos = o.geometry.attributes.position, idx = o.geometry.index;
  const n = idx ? idx.count : pos.count;
  // a SKINNED mesh (a character): each vertex where its bones put it (three's own applyBoneTransform), then the world
  const skinned = !!(o.isSkinnedMesh && o.skeleton);
  if (skinned) { o.skeleton.update(); nSkinned++; }
  const copies = o.isInstancedMesh ? o.count : 1, IM = new THREE.Matrix4(), MW = new THREE.Matrix4();
  let gear = false; for (let q = o; q; q = q.parent) if (q.name === 'cageLayer:gear' || q.name === 'edWellWing' || q.name === 'edWellNac') gear = true;
  const nor = !FLAT && !skinned && o.geometry.attributes.normal, vn = new THREE.Vector3();
  // (P2: vertex colours multiply the material's, as three.js does - a door's grime)
  const vc = m && m.vertexColors && o.geometry.attributes.color, C3 = i => { const j = idx ? idx.getX(i) : i; return [vc.getX(j), vc.getY(j), vc.getZ(j)]; };
  const fld = sec && sec.surf && o.geometry.attributes.aStruct, F2 = i => { const j = idx ? idx.getX(i) : i; return [fld.getX(j) * sec.fieldM, fld.getY(j) * sec.fieldM]; };
  const UV = i => { const j = idx ? idx.getX(i) : i; return [uvA.getX(j), uvA.getY(j)]; };
  for (let c = 0; c < copies; c++) {
    if (o.isInstancedMesh) { o.getMatrixAt(c, IM); MW.multiplyMatrices(o.matrixWorld, IM); } else MW.copy(o.matrixWorld);
    const nm3 = nor ? new THREE.Matrix3().getNormalMatrix(MW) : null;
    const W = i => { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i); if (skinned) o.applyBoneTransform(idx ? idx.getX(i) : i, v); v.applyMatrix4(MW); return [v.x, v.y, v.z]; };
    const N3 = i => { vn.fromBufferAttribute(nor, idx ? idx.getX(i) : i).applyMatrix3(nm3).normalize(); return [vn.x, vn.y, vn.z]; };
    for (let i = 0; i + 2 < n; i += 3) { const a = W(i), b = W(i + 1), cc = W(i + 2); const t = [...a, ...b, ...cc, ...col]; if (gear) t.gear = 1;
      if (nor) t.n = [...N3(i), ...N3(i + 1), ...N3(i + 2)];
      if (vc) t.c = [...C3(i), ...C3(i + 1), ...C3(i + 2)];
      if (al < 1) t.al = al;
      if (uvA) { t.uv = [...UV(i), ...UV(i + 1), ...UV(i + 2)]; t.tex = tex; }
      if (sec && sec.decOk > 0.25) { t.dk = { cls: sec.cls || 0, ok: sec.decOk }; if (fld) t.f = [...F2(i), ...F2(i + 1), ...F2(i + 2)]; }
      tris.push(t); nLayer++; }
  }
});
console.log('tris: sheet ' + (tris.length - nLayer) + ', layers ' + nLayer + (PARTS ? '' : ' (' + nSkinned + ' skinned meshes - the occupants, ' + nTex + ' painted maps)') + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s build' + (S.builds ? ', ' + S.builds + ' builds' : '') + ')');

// ---- THE LIVERY'S DECALS: aeroskin.js's list, its atlas, its shader's loop in JS -----------------------------------
const DECALS = !PARTS && S.decals ? S.decals : null;
const decs = [];
if (DECALS) {
  const AT = DECALS.atlas, MODE = { field: 0, side: 1, plan: 2 };
  for (const d of DECALS.list.slice(0, 15)) {
    const on = d.on || { body: 1 };
    decs.push({ sL: d.sL || 0, sC: d.sC || 0, hw: Math.max(1e-4, (d.w || 0.5) * 0.5), hh: Math.max(1e-4, (d.h || 0.3) * 0.5),
      rect: d.rect || DECALS.rect(d.page || 0), cr: Math.cos(d.rot || 0), sr: Math.sin(d.rot || 0), op: d.opacity != null ? d.opacity : 1,
      noMir: d.noMirror ? 1 : 0, mode: MODE[d.mode] || 0, on: [on.body ? 1 : 0, on.wing ? 1 : 0, on.tail ? 1 : 0, (on.stab != null ? on.stab : on.tail) ? 1 : 0],
      sdf: d.sdf === 2 ? 2 : d.sdf ? 1 : 0, one: d.one === true ? 1 : Math.max(0, Math.min(2, Math.round(+d.one || 0))) });
  }
  console.log('livery: ' + decs.length + ' decal(s) (' + decs.map(d => ['field', 'side', 'plan'][d.mode] + (d.sdf === 1 ? ' letters' : '')).join(', ') + ')' +
    (DECALS.dropped ? ', ' + DECALS.dropped + ' dropped by the budget' : '') + '; the registration ' + DECALS.reg + ' in the stand-in face (no font rasteriser in node)');
  decs.atlas = AT;
}
// the shader's decal loop (aeroskin.js, AEROSKIN_SURF 1 and 0 branches): base colour (0..255) -> the painted colour.
// k: the craft-space position (x lateral, y aft, z up: the bench's frame, the aeroplane at the scene's origin), nk its
// face normal, fl the surface field (metres) or null, cls the surface class (0 body, 1 wing, 2 fin, 3 stab), ok aeroDecOk
const INSET = 0.004;
function decalMix(rgb, k, nk, fl, cls, ok) {
  const AT = decs.atlas, sideF = k[0] < 0 ? -1 : 1;
  for (const d of decs) {
    const onMe = d.on[cls < 0.5 ? 0 : cls < 1.5 ? 1 : cls < 2.5 ? 2 : 3];
    if (!onMe) continue;
    const mir = d.noMir ? 1 : sideF;
    let dd;
    if (d.mode === 0) { if (!fl) continue; dd = [(fl[0] - d.sL) * mir, fl[1] - d.sC]; }
    else if (d.mode === 1) { const nx = nk[0], smir = d.noMir ? 1 : (Math.abs(nx) > 0.25 ? Math.sign(nx) : sideF); dd = [(k[1] - d.sL) * smir, k[2] - d.sC]; }
    else { const pmir = d.noMir ? 1 : (nk[2] < 0 ? -1 : 1); dd = [(k[0] - d.sL) * pmir, k[1] - d.sC]; }
    const x = dd[0] * d.cr - dd[1] * d.sr, y = dd[0] * d.sr + dd[1] * d.cr, qx = x / d.hw * 0.5 + 0.5, qy = y / d.hh * 0.5 + 0.5;
    if (qx < 0 || qx > 1 || qy < 0 || qy > 1) continue;
    if (d.one) { const sg = d.one > 1.5 ? -1 : 1; if (!(k[0] * sg >= -0.02 && nk[0] * sg >= 0)) continue; }
    if (d.sdf === 1 && ok <= 0.75) continue;   // (letters decline a paint-only surface: a float)
    const u = d.rect[0] + d.rect[2] * (qx * (1 - 2 * INSET) + INSET), vv = d.rect[1] + d.rect[3] * (qy * (1 - 2 * INSET) + INSET);
    const X = Math.min(AT.width - 1, Math.max(0, Math.floor(u * AT.width))), Y = Math.min(AT.height - 1, Math.max(0, Math.floor((1 - vv) * AT.height)));
    const o = (Y * AT.width + X) * 4, ta = AT.data[o + 3] / 255;
    const cov = d.sdf ? (ta >= 0.5 ? 1 : 0) : ta, a = cov * d.op;
    if (a <= 0) continue;
    rgb[0] += (AT.data[o] - rgb[0]) * a; rgb[1] += (AT.data[o + 1] - rgb[1]) * a; rgb[2] += (AT.data[o + 2] - rgb[2]) * a;
  }
  return rgb;
}

// ---- the marks: fittings placed, quad corners ---------------------------------------------------------------
const marks = [];
if (MARKS.includes('fittings') && S.W.CAGE_ACCESS)
  for (const q of S.W.CAGE_ACCESS.placed) if (/step|doorHandle|fuelCap|grabHandle/.test(q.key) && q.side !== 'port') marks.push({ p: q.p, col: [255, 255, 255], r: 5 });
if (MARKS.includes('corners'))
  for (const w of (S.spec.windows || [])) if (w.shape === 'quad' && w.corners) for (const c of w.corners) marks.push({ p: [P.halfW * FS * 1.2, c[1] * FS, c[0] * FS], col: [255, 230, 60], r: 5 });

// ---- the raster: tris through a projection (world -> [x px, y px, depth: larger = nearer]) into W x H -------------------
function raster(project, Wd, H, bg) {
  const img = new Uint8Array(Wd * H * 3), zb = new Float32Array(Wd * H).fill(-Infinity);
  for (let i = 0; i < Wd * H; i++) { img[i * 3] = bg[0]; img[i * 3 + 1] = bg[1]; img[i * 3 + 2] = bg[2]; }
  const L = [0.35, 0.8, 0.45], Ll = Math.hypot(...L);
  const o0 = project([0, 0, 0]), vd = [project([1, 0, 0])[2] - o0[2], project([0, 1, 0])[2] - o0[2], project([0, 0, 1])[2] - o0[2]];   // toward the camera
  { const l = Math.hypot(...vd) || 1; vd[0] /= l; vd[1] /= l; vd[2] /= l; }
  // the projection's handedness (a mirrored drawing turns it): which screen winding is a face's FRONT (three's CCW)
  const hand = (() => { const e = [project([1, 0, 0]), project([0, 1, 0]), project([0, 0, 1])].map(p => [p[0] - o0[0], -(p[1] - o0[1]), p[2] - o0[2]]);
    return Math.sign(e[0][0] * (e[1][1] * e[2][2] - e[1][2] * e[2][1]) - e[0][1] * (e[1][0] * e[2][2] - e[1][2] * e[2][0]) + e[0][2] * (e[1][0] * e[2][1] - e[1][1] * e[2][0])) || 1; })();
  const pass = (glass) => { for (const t of tris) {
    if (!!t.al !== glass) continue;
    const A = [t[0], t[1], t[2]], B = [t[3], t[4], t[5]], Cc = [t[6], t[7], t[8]];
    const pa = project(A), pb = project(B), pc = project(Cc);
    const ax = pa[0], ay = pa[1], az = pa[2], bx = pb[0], by = pb[1], bz = pb[2], cx = pc[0], cy = pc[1], cz = pc[2];
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-9) continue;
    if (t.cull && Math.sign(-((bx - ax) * (cy - ay) - (by - ay) * (cx - ax))) * hand !== t.cull) continue;   // (front: CCW, y up)
    // flat shade: the world normal against a fixed light, both faces lit
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const nl = Math.hypot(nx, ny, nz) || 1;
    const lam = 0.35 + 0.65 * Math.abs((nx * L[0] + ny * L[1] + nz * L[2]) / (nl * Ll));
    // GR (the user: "all this flat shading doesn't help"): SMOOTH SHADING - the vertex normals interpolated per pixel
    // (oriented to the face's side), a Lambert term and a soft highlight; --flat draws the old flat facets
    const tn = t.n, sgf = tn ? Math.sign(nx * (tn[0] + tn[3] + tn[6]) + ny * (tn[1] + tn[4] + tn[7]) + nz * (tn[2] + tn[5] + tn[8])) || 1 : 1;
    // the livery's decals: craft space (x lateral, y aft, z up) and the face's craft normal
    const DK = decs.length && t.dk ? t.dk : null, nk = DK ? [nx / nl, -nz / nl, ny / nl] : null;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(Wd - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    const tx = t.tex, uv = t.uv, tc = t.c, fl = t.f;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0_ = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
      const w1_ = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
      const w2_ = 1 - w0_ - w1_;
      if (w0_ < -1e-6 || w1_ < -1e-6 || w2_ < -1e-6) continue;
      const z = w0_ * az + w1_ * bz + w2_ * cz, i = y * Wd + x;
      if (z <= zb[i]) continue;
      if (!glass) zb[i] = z;
      // the albedo: the material's colour, a painted map, the vertex colours, the livery's decals
      let r = t[9], g = t[10], b = t[11];
      if (tx) { const U = w0_ * uv[0] + w1_ * uv[2] + w2_ * uv[4], V = w0_ * uv[1] + w1_ * uv[3] + w2_ * uv[5];
        const uu = U * tx.rep[0] + tx.off[0], vv = V * tx.rep[1] + tx.off[1];
        const X = Math.min(tx.W - 1, Math.max(0, Math.floor((uu - Math.floor(uu)) * tx.W))), Y = Math.min(tx.H - 1, Math.max(0, Math.floor((tx.flipY ? 1 - (vv - Math.floor(vv)) : vv - Math.floor(vv)) * tx.H)));
        // (three's map: the texel times the material's colour; a texel the painter left clear keeps the colour)
        const o = (Y * tx.W + X) * tx.ch, ta = tx.ch === 4 ? tx.px[o + 3] / 255 : 1;
        r *= 1 - ta + ta * tx.px[o] / 255; g *= 1 - ta + ta * tx.px[o + 1] / 255; b *= 1 - ta + ta * tx.px[o + 2] / 255; }
      if (tc) { r *= w0_ * tc[0] + w1_ * tc[3] + w2_ * tc[6]; g *= w0_ * tc[1] + w1_ * tc[4] + w2_ * tc[7]; b *= w0_ * tc[2] + w1_ * tc[5] + w2_ * tc[8]; }
      if (DK) {
        const kx = w0_ * A[0] + w1_ * B[0] + w2_ * Cc[0], ky = -(w0_ * A[2] + w1_ * B[2] + w2_ * Cc[2]), kz = w0_ * A[1] + w1_ * B[1] + w2_ * Cc[1];
        const f2 = fl ? [w0_ * fl[0] + w1_ * fl[2] + w2_ * fl[4], w0_ * fl[1] + w1_ * fl[3] + w2_ * fl[5]] : null;
        const c3 = decalMix([r, g, b], [kx, ky, kz], nk, f2, DK.cls, DK.ok); r = c3[0]; g = c3[1]; b = c3[2];
      }
      let R, G, Bc;
      if (tn) {
        let qx = w0_ * tn[0] + w1_ * tn[3] + w2_ * tn[6], qy = w0_ * tn[1] + w1_ * tn[4] + w2_ * tn[7], qz = w0_ * tn[2] + w1_ * tn[5] + w2_ * tn[8];
        const ql = Math.hypot(qx, qy, qz) || 1; qx *= sgf / ql; qy *= sgf / ql; qz *= sgf / ql;
        const dl = Math.abs((qx * L[0] + qy * L[1] + qz * L[2]) / Ll);
        // the highlight: the light's half vector with the view (d toward the camera)
        const hx = L[0] / Ll + vd[0], hy = L[1] / Ll + vd[1], hz = L[2] / Ll + vd[2], hl = Math.hypot(hx, hy, hz) || 1;
        const sp = Math.pow(Math.abs((qx * hx + qy * hy + qz * hz) / hl), 24) * 0.18;
        const lm = 0.32 + 0.68 * dl;
        R = r * lm + 255 * sp * r / 255; G = g * lm + 255 * sp * g / 255; Bc = b * lm + 255 * sp * b / 255;
        if (PARTS && !tc) { R = r * lm + 255 * sp; G = g * lm + 255 * sp; Bc = b * lm + 255 * sp; }
        if (PARTS && tc) { const vr = w0_ * tc[0] + w1_ * tc[3] + w2_ * tc[6], vg = w0_ * tc[1] + w1_ * tc[4] + w2_ * tc[7], vb = w0_ * tc[2] + w1_ * tc[5] + w2_ * tc[8];
          R = r * lm + 255 * sp * vr; G = g * lm + 255 * sp * vg; Bc = b * lm + 255 * sp * vb; }
      } else { R = r * lam; G = g * lam; Bc = b * lam; }
      R = Math.min(255, R); G = Math.min(255, G); Bc = Math.min(255, Bc);
      if (glass) { const a = t.al; img[i * 3] = img[i * 3] * (1 - a) + R * a; img[i * 3 + 1] = img[i * 3 + 1] * (1 - a) + G * a; img[i * 3 + 2] = img[i * 3 + 2] * (1 - a) + Bc * a; }
      else { img[i * 3] = R; img[i * 3 + 1] = G; img[i * 3 + 2] = Bc; }
    }
  } };
  pass(false); pass(true);
  // an edge darkening where the depth jumps (a silhouette line)
  const out = new Uint8Array(img);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < Wd - 1; x++) {
    const i = y * Wd + x, z = zb[i];
    if (!isFinite(z)) continue;
    const jump = Math.max(...[i - 1, i + 1, i - Wd, i + Wd].map(j => isFinite(zb[j]) ? Math.abs(zb[j] - z) : 1));
    if (jump > 0.04) for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.round(img[i * 3 + k] * 0.35);
  }
  for (const m of marks) {
    const pm = project(m.p), x = Math.round(pm[0]), y = Math.round(pm[1]);
    for (let dy = -m.r; dy <= m.r; dy++) for (let dx = -m.r; dx <= m.r; dx++) {
      const rr = Math.hypot(dx, dy); if (rr > m.r || rr < m.r - 2) continue;
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= Wd || Y >= H) continue;
      const i = Y * Wd + X; out[i * 3] = m.col[0]; out[i * 3 + 1] = m.col[1]; out[i * 3 + 2] = m.col[2];
    }
  }
  for (const s of wires) {  // --wire: the grid's edges, 1 px, where they are seen (the depth buffer, a hair's bias)
    const pa = project(s.a), pb = project(s.b), ax = pa[0], ay = pa[1], az = pa[2], bx = pb[0], by = pb[1], bz = pb[2];
    const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))) + 1;
    for (let k = 0; k <= n; k++) { const t = k / n, x = Math.round(ax + (bx - ax) * t), y = Math.round(ay + (by - ay) * t), z = az + (bz - az) * t;
      if (x < 0 || y < 0 || x >= Wd || y >= H) continue;
      const i = y * Wd + x; if (z < zb[i] - 0.004) continue;
      out[i * 3] = 20; out[i * 3 + 1] = 20; out[i * 3 + 2] = 24; }
  }
  for (const s of segs) {   // RETRACT G3: the wells' edges, 2 px, over everything
    const pa = project(s.a), pb = project(s.b), ax = pa[0], ay = pa[1], bx = pb[0], by = pb[1];
    const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))) + 1;
    for (let k = 0; k <= n; k++) { const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= Wd || Y >= H) continue;
        const i = Y * Wd + X; out[i * 3] = s.col[0]; out[i * 3 + 1] = s.col[1]; out[i * 3 + 2] = s.col[2]; } }
  }
  return { rgb: out, zb };
}

function view(name) {
  // u right, w up on the picture; d = toward the camera (larger = nearer)
  const V = {
    side: { u: p => -p[2], w: p => p[1], d: p => p[0] },                 // from starboard, the nose to the left
    top: { u: p => -p[2], w: p => -p[0], d: p => p[1] },                  // from above, the nose to the left
    front: { u: p => -p[0], w: p => p[1], d: p => p[2] },                // head-on, starboard on the left
    bottom: { u: p => -p[2], w: p => p[0], d: p => -p[1] },              // RETRACT G4: from below, the nose to the left
    q: {}, qb: {}, qr: {}, qp: {}, qrb: {},                                         // set below
  }[name];
  if (!V) { console.log('no view ' + name); return; }
  // (11 Nov, FIT-PROCEDURE: "do some 3/4 views of the latest model") qr = a three-quarter from BEHIND, starboard,
  // above; qp = from ahead, PORT, above - the q view's yaw turned round
  if (name === 'qr' || name === 'qp') {
    const yaw = name === 'qr' ? -0.65 : Math.PI - 0.65, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(0.38), sp = Math.sin(0.38);
    V.u = p => -p[2] * cy + p[0] * sy;
    const dd = p => p[0] * cy + p[2] * sy;
    V.w = p => p[1] * cp - dd(p) * sp;
    V.d = p => dd(p) * cp + p[1] * sp;
  }
  if (name === 'qb') {  // RETRACT G4: a three-quarter from ahead, starboard, BELOW (the wells): yaw 37 deg, pitch -28 deg
    const cy = Math.cos(0.65), sy = Math.sin(0.65), cp = Math.cos(-0.49), sp = Math.sin(-0.49);
    V.u = p => -p[2] * cy + p[0] * sy;
    const dd = p => p[0] * cy + p[2] * sy;
    V.w = p => p[1] * cp - dd(p) * sp;
    V.d = p => dd(p) * cp + p[1] * sp;
  }
  if (name === 'qrb') {  // a three-quarter from BEHIND, starboard, BELOW (the hub's underside): yaw -37 deg, pitch -22 deg
    const cy = Math.cos(-0.65), sy = Math.sin(-0.65), cp = Math.cos(-0.38), sp = Math.sin(-0.38);
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
  const r = raster(p => [(V.u(p) - u0) * sc, (w1 - V.w(p)) * sc, V.d(p)], Wd, H, [22, 26, 32]);
  writePNG(OUT + '_' + name + '.png', r.rgb, Wd, H);
  console.log('wrote ' + OUT + '_' + name + '.png ' + Wd + 'x' + H + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
}
function writePNG(file, rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
for (const n of VIEWS) view(n);

// ---- THE PROJECTION ON THE DRAWING (--sheet) and the table's measurements of what was drawn (--measure) ------------
if (SHEET || MEASURE) {
  const DB = require(path.join(ROOT, 'tools', 'drafting', 'dt_build.js')), C = require(path.join(ROOT, 'tools', 'drafting', 'dt_core.js'));
  // the table's reading of THIS scene (dt_build.collect: its part tags, its frame - the spinner's tip, the thrust line)
  const B = DB.collect(S.W, S.scene, sheet, FS);
  const T = C.compare(REF, C.measure(B, { stations: C.stations(REF), probes: C.probes(REF) }), C.windows(B), B);
  console.log('the table\'s key measurements of this picture: ' + T.pass + ' / ' + T.n + ' inside tolerance (frame: tip z ' + B.frame.tipZ.toFixed(3) + ', thrust line y ' + B.frame.hubY.toFixed(3) + ')');
  if (MEASURE) fs.writeFileSync(MEASURE, JSON.stringify({ frame: B.frame, pass: T.pass, n: T.n, rows: T.rows.map(r => ({ id: r.id, ours: r.ours, ref: r.ref, tol: r.tol, ok: r.ok })),
    ours: C.measure(B, { stations: C.stations(REF), probes: C.probes(REF) }) }, null, 1));
  if (SHEET) {
    const DS = require(path.join(ROOT, 'tools', 'drafting', 'dt_sheet.js')), PNG = require(path.join(ROOT, 'tools', 'drafting', 'dt_png.js'));
    const img = SHEET_IMG ? PNG.decode(fs.readFileSync(SHEET_IMG)) : null;
    if (!img) console.log('--sheet: no drawing given (--sheet <img.png>): our render and outline on white paper, no veil');
    // our render per view, through dt_core's own mapping: world -> table frame (the collect's frame) -> the view's box px
    const renders = {}, fr = B.frame;
    for (const vw of C.VIEWS) {
      const Vr = REF.views[vw]; if (!Vr || !Vr.box) continue;
      const pj = DS.viewProjector(Vr, vw), Wd = Math.round(Vr.box[2] - Vr.box[0]), H = Math.round(Vr.box[3] - Vr.box[1]);
      const r = raster(p => pj(fr.tipZ - p[2], p[1] - fr.hubY, p[0]), Wd, H, [255, 255, 255]);
      const mask = new Uint8Array(Wd * H); for (let i = 0; i < Wd * H; i++) mask[i] = isFinite(r.zb[i]) ? 1 : 0;
      renders[vw] = { rgb: r.rgb, mask };
    }
    const out = DS.compose({ ref: REF, B, sheet: img, renders, T, dims: DS.dims(REF, B), title: ((doc && doc.name) || KEY || path.basename(FILE || '')).toUpperCase() + ' - QUICKSHOT --SHEET' });
    fs.writeFileSync(OUT + '_sheet.png', PNG.encode(out.W, out.H, out.rgba));
    for (const d of DS.dims(REF, B)) console.log('  ' + d.k.padEnd(7) + ' ours ' + d.ours.toFixed(3) + (d.ref != null ? '  figure ' + d.ref.toFixed(3) + '  ' + (d.diff >= 0 ? '+' : '') + d.diff.toFixed(3) + ' m (' + (d.pct >= 0 ? '+' : '') + d.pct.toFixed(1) + ' %)' : ''));
    console.log('wrote ' + OUT + '_sheet.png ' + out.W + 'x' + out.H + ' (veil m2: ' + Object.keys(out.views).map(k => k + ' ' + out.views[k].veilM2).join(', ') + ') (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  }
}
process.exit(0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
