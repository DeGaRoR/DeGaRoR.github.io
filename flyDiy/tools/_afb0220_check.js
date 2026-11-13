#!/usr/bin/env node
// GATE AFB0220 (AFB-0220, 13 Nov 2026) - JOLENE AFB 02/20 GONE WILD, AND THE GLIDER WINCH STANDING ON 13/31.
//
// The user (13 Nov, via A0): 02/20, the crosswind runway, becomes an unmaintained, degraded strip "divided into several
// runways" - a NARROW CENTRAL BAND of the old concrete (clean landings, the Aero Club's spot landing, the plane-vs-car drag
// race), one SIDE very BUMPY but landable, the OTHER SIDE full of MUD, ROCKS and FALLEN TREES "with proper interaction and
// collision (crash into them in many different ways: wingtip, gear, prop)", the FOREST TAKING OVER further out (the tree
// system only: no mesh tree); and the glider winch installed for good on the main runway, 13/31, with its launch line.
// The layout is tools/afb0220_author.py's (the numbers, in 02/20's frame); the debris 26c_wild.js's; the winch the WINCH
// session's model placed by render_premises.js. Rows:
//   AUTHOR    the fixture and the ship manifest are what afb0220_author.py writes (a hand edit of an afb_ entry, w2 or
//             w2r is the editor's: run --absorb's path or the script, not both)
//   TABLE     26c_wild.js's kinds against the tree pack: every collection, subject, bounding box, size and bury as the pack
//             says (a re-bake of the pack that moves one moves the hit cylinders, and this says so); the poles' height
//   COMPOSE   the record composes clean (issues() none), 30 debris + 1 winch records, the trunk set 'wild' registered on
//             the island's world (the page, the worker and the gates compose it alike); the analytic world has none
//   BAND      THE CENTRAL BAND: 02/20 18 m wide, its 1 758 m, straight; paved across |v| <= 8.5 m at every 10 m; NOTHING TO
//             HIT within |v| < 11 m over its whole length (every 'wild' cylinder with its radius, every placed prop's
//             footprint); the trees kept off it (the world's treeAeroBlocked, the woodland's and the fill's one rule)
//   ROUGH     02R/20L: firm mud (SURFACE 11, the strip vocabulary's 'mud': wheels yes, skis no), the DIRT-STRIP relief on
//             (the composed ground along its centreline rough, the ruts and lumps chaos 0.65 gives), 7.5 m off the concrete
//   MUD       the NW side soft mud (SURFACE 12) from 10 m off the centreline, the gap with its track at road r4's end
//   FOREST    the four cover polygons composed as the fill's vegetation (the tree system plants them), trees let in there
//   WINCH     on 13/31: off the pavement, its fairleads within 25 m of the centreline (winch_mode's search), its cable side
//             facing the launch point 1 100 m SE (inside the runway), nothing of 02/20's within 70 m of 13/31's centreline
//   PBR       the winch built as the page builds it: every mesh a MeshStandardMaterial out of MATLIB.shared, the club's
//             weathering hooked on
//   LINE      winch_mode.winchStart with the page's slide: a glider lined up at 31's threshold (2.3 km from the winch) is
//             moved to the launch point and launched on 1 100 m of cable to the STANDING winch (none built)
//   HIT-*     THE COLLISIONS, in the flat world (_treecrash_lib's), each shape the table's: a LOG across at taxi pace (the
//             prop strikes, no crash) and at 6 m/s (a crash), a STUMP (the prop), a TRUNK under the right wheel (a gear
//             member), a BOULDER PILE (a crash), a FALLEN SPRUCE under the Jodel's low wing (a wing member), a POLE at the
//             Cub's wingtip (a wing member, no prop strike), a LANDING ROLL at 20 m/s into a fallen spruce (a crash), THE
//             WINCH's drawn mesh rasterised as the page's hitAdd does (an obstacle contact, a crash)
//   DETERMINISM the 'wild' cylinders the same bits on a second composition
// node tools/_afb0220_check.js [--only=BAND,HIT-LOG,...]   (one final `GATE AFB0220: PASS|FAIL`)
'use strict';
process.env.FLYDIY_CERT = '1';   // (the damage layer as the game flies it: _treecrash_lib's certificate)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const ONLY = ((process.argv.find(a => a.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean);
const want = id => !ONLY.length || ONLY.some(o => id === o || (o.endsWith('*') && id.startsWith(o.slice(0, -1))));
let fails = 0;
const row = (id, ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + id.padEnd(12) + ' ' + msg); if (!ok) fails++; };
const f = (x, n = 1) => (x == null || !isFinite(x)) ? '-' : (+x).toFixed(n);
const LIB = require('./_treecrash_lib.js');
const C = LIB.core();
const WD = C.WILD_DEBRIS;
const FIX = path.join(__dirname, 'fixtures', 'island_jolene.json');
const TXT = fs.readFileSync(FIX, 'utf8'), REC = JSON.parse(TXT);
const OBJ = REC.layers.objects;

// ---- AUTHOR ----
if (want('AUTHOR')) {
  let out = '', ok = false;
  try { out = cp.execFileSync('python3', [path.join(__dirname, 'afb0220_author.py'), '--check'], { encoding: 'utf8' }); ok = true; } catch (e) { out = (e.stdout || '') + (e.message || ''); }
  row('AUTHOR', ok && /are what this script writes/.test(out), out.trim().split('\n').pop());
}

// ---- TABLE ----
if (want('TABLE')) {
  const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'trees_pack.json'), 'utf8')), bad = [];
  for (const k of WD.ORDER) {
    const K = WD.KINDS[k], c = pack.collections.find(x => x.name === K.col), s = c && c.subjects[K.sub];
    if (!c || !s) { bad.push(k + ': no ' + K.col + '[' + K.sub + ']'); continue; }
    if (s.bb.some((v, i) => Math.abs(v - K.bb[i]) > 1e-3)) bad.push(k + ': bb ' + s.bb + ' vs ' + K.bb);
    if (Math.abs((c.place && c.place.size || 1) - K.size) > 1e-6) bad.push(k + ': size ' + (c.place && c.place.size) + ' vs ' + K.size);
    if (K.bury !== undefined && Math.abs((c.place.bury || 0) - K.bury) > 1e-3) bad.push(k + ': bury ' + c.place.bury + ' vs ' + K.bury);
  }
  const yard = fs.readFileSync(path.join(ROOT, 'src', 'pier', 'pier_yard.js'), 'utf8');
  for (const k of Object.keys(WD.POLES)) { const m = yard.match(new RegExp('"key":"' + k + '"[^}]*?"dim":\\[([^\\]]*)\\]')); const h = m ? +m[1].split(',')[1] : NaN; if (!(Math.abs(h - WD.POLES[k].h) < 0.01)) bad.push(k + ': height ' + h + ' vs ' + WD.POLES[k].h); }
  row('TABLE', !bad.length, WD.ORDER.length + ' debris kinds held to trees_pack.json (collection, subject, bb, size, bury) and ' + Object.keys(WD.POLES).length + ' poles to pier_yard.js' + (bad.length ? ': ' + bad.join('; ') : ''));
}

// ---- the island world (once) ----
const IN = require('./island_node.js');
let W = null;
const needW = ['COMPOSE', 'BAND', 'ROUGH', 'MUD', 'FOREST', 'WINCH', 'LINE', 'DETERMINISM'].some(want);
if (needW) W = IN.islandWorld('jolene', { premises: TXT });
const A2 = W && W.aerodromes.find(a => a.id === 'w2'), AR = W && W.aerodromes.find(a => a.id === 'w2r'), AH = W && W.aerodromes.find(a => a.id === 'HOME');
const FR = a => { const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg); return { ux, uz, P: (u, v) => [a.x + u * ux - v * uz, a.z + u * uz + v * ux], UV: (x, z) => [(x - a.x) * ux + (z - a.z) * uz, -(x - a.x) * uz + (z - a.z) * ux] }; };
const debrisObs = OBJ.filter(o => o.kind === 'debris'), afbProps = OBJ.filter(o => o.kind === 'prop' && /^afb_p/.test(o.id)), winchOb = OBJ.find(o => o.kind === 'winch');

if (want('COMPOSE')) {
  const iss = C.PREMISES_GEN.issues(REC), mine = iss.filter(s => /afb_|w2r|runway w2\b|debris|winch/.test(s));
  const PM = W.premises, recs = PM && PM.overlay && PM.overlay.records;
  const set = W.treeHits.get('wild'), n = set ? set.length / 5 : 0;
  const AW = C.makeWorld(0, {});
  const nd = debrisObs.length, np = OBJ.filter(o => o.kind === 'prop' && o.trunk).length;
  let want0 = 0; for (const o of OBJ) if ((o.kind === 'debris' && WD.KINDS[o.key]) || (o.kind === 'prop' && o.trunk && WD.POLES[o.key])) want0 += WD.localHits(o.key, WD.scaleOf(o)).length;
  row('COMPOSE', !iss.length && nd === 30 && winchOb && n === want0 && n > 0 && !(AW.treeHits && AW.treeHits.has('wild')),
    'issues() ' + iss.length + (mine.length ? ' (' + mine.slice(0, 3).join('; ') + ')' : '') + '; ' + nd + ' debris + ' + np + ' poles as trunks, the winch ' + (winchOb ? winchOb.id : 'MISSING') +
    '; the trunk set \'wild\' on the island\'s world: ' + n + ' cylinders (the records\' ' + want0 + '); the analytic world ' + (AW.treeHits && AW.treeHits.has('wild') ? 'HAS ONE' : 'none'));
}

// prop footprints (half the diagonal of the prop's dims, from its pack's source)
function propDims(key) {
  for (const dir of ['pier', 'scenery', 'props', 'camp', 'loads', 'infra']) {
    const d = path.join(ROOT, 'src', dir); if (!fs.existsSync(d)) continue;
    for (const fl of fs.readdirSync(d)) { if (!/\.js$/.test(fl) || /lods/.test(fl)) continue;
      const m = fs.readFileSync(path.join(d, fl), 'utf8').match(new RegExp('"key":"' + key + '"[^}]*?"dim":\\[([^\\]]*)\\]')); if (m) return m[1].split(',').map(Number); }
  }
  return null;
}
const DIM = new Map(); const dimOf = k => { if (!DIM.has(k)) DIM.set(k, propDims(k)); return DIM.get(k); };

if (want('BAND')) {
  const F = FR(A2), half = A2.wid / 2;
  let paved = 0, cells = 0, worst = Infinity, worstWhat = '', blocked = 0, bcells = 0, slope = 0;
  for (let u = -A2.len / 2 + 2; u <= A2.len / 2 - 2; u += 10) {
    for (const v of [-8.5, -4, 0, 4, 8.5]) { const p = F.P(u, v); cells++; if (W.surface(p[0], p[1]) === 5) paved++; }
    for (const v of [-11, 0, 11]) { const p = F.P(u, v); bcells++; if (W.treeAeroBlocked(p[0], p[1])) blocked++; }
    if (u + 10 <= A2.len / 2 - 2) { const a = F.P(u, 0), b = F.P(u + 10, 0); slope = Math.max(slope, Math.abs(W.terrainH(b[0], b[1]) - W.terrainH(a[0], a[1])) / 10); }
  }
  const S = W.treeHits.get('wild');
  for (let i = 0; i < S.length; i += 5) { const uv = F.UV(S[i], S[i + 1]); if (Math.abs(uv[0]) > A2.len / 2 + 20) continue; const d = Math.abs(uv[1]) - S[i + 3]; if (d < worst) { worst = d; worstWhat = 'a wild cylinder at u ' + f(uv[0], 0); } }
  for (const o of afbProps) { const d = dimOf(o.key), r = d ? Math.hypot(d[0], d[2]) / 2 : 1; const uv = F.UV(o.x, o.z); const g = Math.abs(uv[1]) - r; if (g < worst) { worst = g; worstWhat = o.key + ' at u ' + f(uv[0], 0); } }
  row('BAND', A2.wid === 18 && Math.abs(A2.len - 1757.8) < 0.01 && paved === cells && worst >= 11 && blocked === bcells && slope < 0.02,
    '02/20 ' + A2.wid + ' x ' + f(A2.len) + ' m: paved ' + paved + ' of ' + cells + ' points across |v| <= 8.5; the nearest thing to hit ' + f(worst, 2) + ' m off the centreline (' + worstWhat + '), the line at 11; trees kept off ' + blocked + ' of ' + bcells + ' points (|v| <= 11); the steepest 10 m ' + f(slope * 100, 2) + ' %');
}

if (want('ROUGH')) {
  const F = FR(AR), S2 = C.stripSurface(AR), Fw = FR(A2);
  let n = 0, s1 = 0, s2 = 0, mud = 0, pts = 0;
  for (let u = -AR.len / 2 + 8; u <= AR.len / 2 - 8; u += 0.5) {
    const p = F.P(u, 1.1), q = F.P(u - 3, 1.1), r = F.P(u + 3, 1.1);
    const d = W.terrainH(p[0], p[1]) - (W.terrainH(q[0], q[1]) + W.terrainH(r[0], r[1])) / 2; n++; s1 += d; s2 += d * d;
    if (((u * 2) | 0) % 20 === 0) { pts++; if (W.surface(p[0], p[1]) === 11) mud++; }
  }
  const sd = Math.sqrt(Math.max(0, s2 / n - (s1 / n) ** 2)), off = Math.abs(Fw.UV(AR.x, AR.z)[1]) - AR.wid / 2 - A2.wid / 2;
  const wheels = C.stripAllows('wheels', AR).ok, skis = C.stripAllows('skis', AR).ok;
  row('ROUGH', AR.surface === 11 && S2.cls === 'mud' && wheels && !skis && sd > 0.015 && mud === pts && off >= 7,
    '02R/20L ' + AR.len + ' x ' + AR.wid + ' m, surface ' + AR.surface + ' (' + S2.word + ', ' + S2.cls + '): wheels ' + (wheels ? 'yes' : 'NO') + ', skis ' + (skis ? 'YES' : 'no') + '; mud under ' + mud + ' of ' + pts +
    ' points; the ground along its wheel lane rough to ' + f(sd * 100, 1) + ' cm (sd off its 6 m mean); its edge ' + f(off, 1) + ' m off the concrete');
}

if (want('MUD')) {
  const F = FR(A2); let n = 0, m = 0, trk = 0;
  for (let u = -850; u <= 730; u += 20) { if (u > -590 && u < -505) continue; for (const v of [17, 25, 38]) { const p = F.P(u, v); n++; if (W.surface(p[0], p[1]) === 12) m++; } }
  for (const v of [12, 18, 24]) { const p = F.P(-547, v); if (W.surface(p[0], p[1]) === 6) trk++; }
  const soft = C.GROUND_SOFT && C.GROUND_SOFT[12];
  row('MUD', m === n && trk === 3 && !!soft, 'soft mud (12) under ' + m + ' of ' + n + ' points of the NW side (v 17 / 25 / 38, u -850 .. 730 less road r4\'s gap); the track at the gap gravel at ' + trk + ' of 3; the soft layer ' + (soft ? 'k ' + soft.k + ', ' + soft.zMax * 100 + ' cm deep' : 'MISSING (SNOW-MUD)'));
}

if (want('FOREST')) {
  const PO = W.premises && W.premises.overlay, polys = (PO && PO.vegPolys) || [];
  const ids = ['afb_wood0', 'afb_wood1', 'afb_scrub0', 'afb_scrub1'];
  const got = ids.filter(id => polys.some(v => String(v.id || '').indexOf(id) === 0));
  const F = FR(A2); let open = 0, tot = 0;
  for (let u = -800; u <= 650; u += 50) for (const v of [80, 110, -80, -110]) { const p = F.P(u, v); tot++; if (!W.treeAeroBlocked(p[0], p[1])) open++; }
  const mixes = ids.map(id => REC.layers.areas.find(a => a.id === id)).filter(Boolean).map(a => a.props.cover.veg);
  const trees = mixes.every(M => M && M.mode === 'new' && Object.keys(M.species).some(k => /spruce|fir|cedar|sapling/.test(k)));
  row('FOREST', got.length === 4 && open === tot && trees, got.length + ' of 4 cover polygons composed as the fill\'s vegetation (' + got.join(', ') + '); trees let in at ' + open + ' of ' + tot + ' points 80-110 m either side; every mix plants trees (the tree system: no mesh tree placed)');
}

if (want('WINCH')) {
  const F = FR(AH), W0 = winchOb, uv = F.UV(W0.x, W0.z);
  // the house frame: local (x, z) -> world (x c + z s, -x s + z c), c = cos yaw, s = sin yaw; the fairleads at (+-0.47, -2.80)
  const c = Math.cos(W0.yaw), s = Math.sin(W0.yaw), loc = (lx, lz) => [W0.x + lx * c + lz * s, W0.z - lx * s + lz * c];
  const fl = [-0.47, 0.47].map(x => F.UV(...loc(x, -2.80))), faceS = (() => { const a = loc(0, -1), b = loc(0, 0); return ((a[0] - b[0]) * F.ux + (a[1] - b[1]) * F.uz); })();
  // its footprint's nearest point to the centreline (the box: x -1.45 .. 1.18, z -2.97 .. 4.25)
  let near = Infinity; for (const lx of [-1.45, 1.18]) for (const lz of [-2.97, 4.25]) near = Math.min(near, Math.abs(F.UV(...loc(lx, lz))[1]));
  const sL = uv[0] + W0.cable, inRwy = Math.abs(sL) < AH.len / 2 - 50;
  const F2 = FR(A2); let close = Infinity, closeId = '';
  for (const o of OBJ) { if (!/^afb_[dp]/.test(o.id)) continue; const q = F.UV(o.x, o.z), u2 = F2.UV(o.x, o.z); if (Math.abs(u2[1]) > 200) continue; const d = Math.abs(q[1]); if (d < close) { close = d; closeId = o.id; } }
  row('WINCH', near > AH.wid / 2 && fl.every(q => Math.abs(q[1]) < 25) && faceS > 0.99 && inRwy && W0.cable === 1100 && close >= 70,
    'at 13/31 s ' + f(uv[0], 0) + ' v ' + f(uv[1], 1) + ': its nearest edge ' + f(near, 2) + ' m off the centreline (the pavement ' + AH.wid / 2 + '), the fairleads ' + fl.map(q => f(Math.abs(q[1]), 2)).join(' / ') + ' m (< 25), its cable side facing ' + (faceS > 0 ? 'SE' : 'NW') + ' (' + f(faceS, 3) +
    '); the launch line ' + W0.cable + ' m: the launch point s ' + f(sL, 0) + (inRwy ? ' (on the runway)' : ' OFF THE RUNWAY') + '; 02/20\'s nearest piece ' + f(close, 0) + ' m from 13/31\'s centreline (' + closeId + ')');
}

// ---- the winch built as the page builds it (PBR, LINE) ----
let WG = null;
function winchKit() {
  if (WG) return WG;
  const THREE = global.THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
  global.window = global.window || globalThis; window.THREE = THREE;
  const TW = require(path.join(ROOT, 'src/vehicle/tow.js')), WI = require(path.join(ROOT, 'src/vehicle/winch.js'));
  Object.assign(globalThis, TW, WI); globalThis.machineSheet = C.machineSheet;
  globalThis.AEROWX = require(path.join(ROOT, 'src', 'viewer', 'aeroweather.js'));
  globalThis.MATLIB = window.MATLIB = require(path.join(ROOT, 'src', 'viewer', 'matlib.js'));
  for (const fl of ['_gear_kit.js', '_gear_gen.js', '_winch_gen.js', '_winch_weather.js']) require(path.join(__dirname, fl));
  require(path.join(ROOT, 'src', 'viewer', 'winch_mode.js'));
  const keep = {}; for (const k of ['THREE', 'MATLIB', 'WINCH_GEN', 'WINCH_WX', 'WINCH_MODE', 'GEAR_GEN', 'GEAR_KIT']) if (window[k]) keep[k] = window[k];
  return (WG = { THREE, WI, keep });
}
// as render_premises.js buildWinches stands it: built, on the composed ground, turned, weathered
function standWinch(scene) {
  const { THREE } = winchKit(), o = winchOb;
  const g = window.WINCH_GEN.build({ wx: 1, cableLen: 0, chute: 0 });
  g.position.set(o.x, W ? W.terrainH(o.x, o.z) : 0, o.z); g.rotation.y = o.yaw; g.userData.launchL = o.cable;
  if (scene) scene.add(g); g.updateMatrixWorld(true);
  window.WINCH_WX.apply(g, { macro: window.WINCH_WX.PRESETS.club });
  return g;
}
if (want('PBR')) {
  const g = standWinch(null); let meshes = 0, pbr = 0, lib = 0, hooked = 0; const bad = new Set();
  g.traverse(o => { if (!o.isMesh) return; meshes++; const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) { if (m.isMeshStandardMaterial) pbr++; else bad.add(m.type); if (window.MATLIB.rowOf(m) >= 0) lib++; if (m.onBeforeCompile && /winch/.test(String(m.customProgramCacheKey && m.customProgramCacheKey()))) hooked++; } });
  row('PBR', meshes > 150 && pbr === meshes && lib === meshes && hooked > 0.8 * meshes,
    meshes + ' meshes: ' + pbr + ' MeshStandardMaterial (PBR)' + (bad.size ? ', NOT: ' + [...bad].join(' ') : '') + ', ' + lib + ' out of MATLIB.shared (the game\'s shared materials: the house scans, the aircraft weathering), the club\'s weathering hooked on ' + hooked);
}
const lineDone = new Promise(resolve => {
  if (!want('LINE')) return resolve();
  const { THREE, WI } = winchKit(), DS = require('./_cage_design.js');
  { const T = __dirname, src = fs.readFileSync(path.join(__dirname, 'arch_fly.js'), 'utf8');
    eval(src.slice(src.indexOf('function loadPanel()'), src.indexOf('loadPanel();')).replace(/__dirname/g, JSON.stringify(__dirname)).replace('function loadPanel()', 'global.loadPanel = function ()')); global.loadPanel(); }
  global.window = global.window || globalThis; Object.assign(window, WG.keep); global.THREE = WG.THREE;   // (the panel's loader may set a window and a THREE of its own)
  const A = DS.ARCHETYPES.find(x => x.key === 'motorglider'), def = C.buildGen(DS.designBake(A.sel, A.over));
  const scene = new THREE.Scene(), perm = standWinch(scene);
  // lined up at 31's threshold (the SE end, 60 m in), facing NW - toward the winch
  const ux = Math.cos(AH.hdg), uz = Math.sin(AH.hdg), dx = -ux, dz = -uz;
  let pose = { x: AH.x + ux * (AH.len / 2 - 60), z: AH.z + uz * (AH.len / 2 - 60), hdg: Math.atan2(dz, dx) };
  const sim = C.makeSim(def, W); sim.reset(0);
  const place = () => { sim.reset(0); C.placeAtLineup(sim, AH, pose, W, def.refs); };
  place(); for (let i = 0; i < 60; i++) sim.step(1 / 60);
  let xA = sim.axes()[0];
  if (-xA[0] * dx - xA[2] * dz < 0) { pose.hdg += Math.PI; place(); for (let i = 0; i < 60; i++) sim.step(1 / 60); }
  sim.setEngine(0, { key: 'off' });
  const c0 = sim.cgPos().slice(); let slid = 0;
  const slide = (ddx, ddz) => { pose = Object.assign({}, pose, { x: pose.x + ddx, z: pose.z + ddz }); place(); sim.setEngine(0, { key: 'off' }); slid = Math.hypot(ddx, ddz); return true; };
  const WMd = window.WINCH_MODE, n0 = scene.children.length;
  WMd.winchStart({ THREE, scene, world: W, sim, def, hands: true, slide }).then(to => {
    const T = WMd.tow, c1 = sim.cgPos(), moved = Math.hypot(c1[0] - c0[0], c1[2] - c0[2]), L0 = T.L;
    // ...and the launch flown from there as the page steps it (towPre, the step, towPost; the driver called 3 s on; the
    // winch's hands): released at the top
    let rel = null, relH = 0, relX = 0;
    for (let fr = 0; fr < 60 * 120; fr++) {
      if (!T.go && T.t > 3) T.start();
      WMd.towPre(); sim.step(1 / 60); WMd.towPost(1 / 60);
      if (!T.line.on && rel === null) { rel = T.line.released; const cg = sim.cgPos(); relH = cg[1] - W.terrainH(cg[0], cg[2]); relX = Math.hypot(cg[0] - perm.position.x, cg[2] - perm.position.z); break; }
    }
    const ok = T.model === perm && !T.own && scene.children.length - n0 === 1 && Math.abs(L0 - 1100) < 5 && Math.abs(moved - slid) < 3 && slid > 1000 && /top of the launch/.test(rel || '') && relH > 200 && LIB.finite(sim);
    row('LINE', ok, to + ' - the glider moved ' + f(moved, 0) + ' m up 13/31 from 31\'s threshold to the launch point, the cable ' + f(L0, 0) + ' m to the STANDING winch (' + (T.model === perm ? 'reused' : 'NOT REUSED') + ', ' + (scene.children.length - n0 - 1) + ' other object built: the cable); launched: ' + (rel ? rel + ' at ' + f(relH, 0) + ' m, ' + f(relX, 0) + ' m short of the winch' : 'NEVER RELEASED'));
    WMd.towStop(); resolve();
  }, e => { row('LINE', false, 'THREW: ' + e.message); resolve(); });
});

// ---- THE COLLISIONS (the flat world) ----
// one run: a build taxiing (or rolling) into a piece placed `D` m ahead, `off` m to the side (+ = left of the heading:
// _treecrash_lib's convention), its local +x turned `rot` deg from the heading; o.hold: a speed held on the throttle
function hit(key, o) {
  const def = LIB.defOf(key, {}), elev = 300, { W: Wf, TH, strip } = LIB.flatWorld(elev);
  const sim = C.makeSim(def, Wf); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev }));
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  for (let i = 0; i < 120; i++) sim.step(1 / 60);
  if (o.V) for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = o.V * fx; sim.v[i * 3 + 2] = o.V * fz; }
  const c0 = sim.cgPos().slice(), px = c0[0] + fx * o.D - fz * (o.off || 0), pz = c0[2] + fz * o.D + fx * (o.off || 0);
  const yawH = Math.atan2(-fz, fx), yaw = yawH + (o.rot || 0) * Math.PI / 180;
  if (o.piece) TH.set('wild', WD.hitsOf([{ key: o.piece, x: px, z: pz, yaw, s: o.s || 1 }], () => elev));
  if (o.shape) Wf.obstacles.add({ x: px, z: pz, yaw, y0: elev, shape: o.shape, tag: 'prop' });
  sim.ctl.thr = 0; let obst = 0;
  for (let fr = 0; fr < (o.secs || 6) * 60; fr++) {
    if (o.hold) { const v = sim.cgVel(), V = v[0] * fx + v[2] * fz; sim.ctl.thr = Math.max(0, Math.min(1, 0.15 + 0.4 * (o.hold - V))); }
    sim.step(1 / 60); if (sim.out && sim.out.obst) obst = Math.max(obst, sim.out.obst);
  }
  const D = sim.damage(), fin = LIB.finite(sim);
  const cls = D.broken.map(i => sim.beams[i].cls);
  return { hits: sim.trunkHits(), obst, crashed: D.crashed, reason: D.reason || '', prop: D.propStrike, breaks: D.breaks, members: D.members, cls, finite: fin, g: D.gPeak || 0 };
}
const say = r => r.hits + ' trunk contacts' + (r.obst ? ', ' + r.obst + ' obstacle nodes' : '') + '; ' + (r.crashed ? 'CRASHED: ' + r.reason : 'not a crash') + (r.prop ? '; the prop struck' : '') + '; ' + r.breaks + ' broken, ' + r.members + ' members marked; ' + f(r.g, 1) + ' g';
const anyCls = (r, re) => r.cls.some(c => re.test(String(c)));
const HITS = [
  ['HIT-LOG', () => hit('cub', { piece: 'log', D: 10, V: 3, hold: 3, rot: 90, secs: 6 }), r => r.hits > 0 && r.prop && !r.crashed, 'the Cub at taxi pace (3 m/s) into a log lying across: '],
  ['HIT-LOGFAST', () => hit('cub', { piece: 'log', D: 10, V: 6, rot: 90, secs: 5 }), r => r.hits > 0 && r.crashed, 'the Cub at 6 m/s into the log: '],
  ['HIT-STUMP', () => hit('cub', { piece: 'stump', D: 8, V: 3, hold: 3, secs: 6 }), r => r.hits > 0 && r.prop, 'the Cub at 3 m/s into a stump on its line: '],
  ['HIT-WHEEL', () => hit('cub', { piece: 'trunk', D: 8, V: 5, hold: 5, rot: 90, s: 1, secs: 6, off: 3 }), r => r.hits > 0 && (anyCls(r, /gear|leg|axle|wheel/i) || /gear/.test(r.reason)), 'the Cub at 5 m/s, a fallen trunk under its right wheel: '],
  ['HIT-ROCKS', () => hit('cub', { piece: 'rocks_pile', D: 8, V: 4, hold: 4, secs: 6 }), r => r.hits > 0 && r.crashed, 'the Cub at 4 m/s into a boulder pile: '],
  ['HIT-LOWWING', () => hit('jodel', { piece: 'fallen_spruce', D: 8, V: 5, hold: 5, rot: 90, secs: 6, off: 2 }), r => r.hits > 0 && (anyCls(r, /wing|spar|rib/i) || /wing/.test(r.reason)), 'the Jodel (low wing) at 5 m/s, a fallen spruce under its wing: '],
  ['HIT-POLE', () => hit('cub', { piece: 'pole_b', D: 8, V: 5, hold: 5, secs: 6, off: 4.5 }), r => r.hits > 0 && !r.prop && (anyCls(r, /wing|spar|rib|strut/i) || /wing/.test(r.reason)), 'the Cub at 5 m/s, an old pole 4.5 m out (its wing): '],
  ['HIT-LANDING', () => hit('cub', { piece: 'fallen_spruce', D: 25, V: 20, rot: -90, secs: 5, off: -6 }), r => r.hits > 0 && r.crashed, 'the Cub on its landing roll (20 m/s) into a fallen spruce across the way: '],
  ['HIT-WINCH', () => {
    const g = standWinch(null), inv = new WG.THREE.Matrix4().copy(g.matrixWorld).invert(), pos = [];
    g.traverse(o => { if (!o.isMesh || !o.geometry) return; o.updateMatrixWorld(true); const M = new WG.THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), P = o.geometry.attributes.position, I = o.geometry.index, v = new WG.THREE.Vector3();
      const n = I ? I.count : P.count; for (let k = 0; k < n; k++) { v.fromBufferAttribute(P, I ? I.getX(k) : k).applyMatrix4(M); pos.push(v.x, v.y, v.z); } });
    const shape = C.OBSTACLES.rasterise(pos, null, 0.5);
    return hit('cub', { shape, D: 12, V: 5, hold: 5, rot: 0, secs: 6 });
  }, r => r.obst > 0 && r.crashed, 'the Cub at 5 m/s into the winch (its drawn mesh as the page rasterises it): '],
];
const timings = [];
for (const [id, fn, ok, what] of HITS) {
  if (!want(id)) continue;
  if (id === 'HIT-WINCH') winchKit();
  const t0 = Date.now(); let r = null;
  try { r = fn(); } catch (e) { row(id, false, what + 'THREW ' + e.message); continue; }
  timings.push(id + ' ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  row(id, r.finite && ok(r), what + say(r));
}

lineDone.then(() => {
  if (want('DETERMINISM')) {
    const W2 = IN.islandWorld('jolene', { premises: TXT }), a = W.treeHits.get('wild'), b = W2.treeHits.get('wild');
    const same = a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
    row('DETERMINISM', !!same, 'the \'wild\' cylinders of a second composition: ' + (same ? 'the same ' + a.length / 5 + ', bit for bit' : 'DIFFER'));
  }
  if (timings.length) console.log('     (the collision rows: ' + timings.join(', ') + ')');
  console.log('GATE AFB0220: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
});
