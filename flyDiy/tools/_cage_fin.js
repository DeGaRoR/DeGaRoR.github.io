// CAGE FIN LAYER — the user's 2D fin sketch, on the aeroplane (cage7, G22).
//
// _fin_gen.js is the module (fit-checked against tools/_fin_ref.obj by
// _fin_check.js); this is the half that makes it part of the aeroplane. It
// reads the DECK off the mesh the editor has just built — the centreline of
// the skin materials, the same filter the gear's airframe contract uses — so
// the root strands sit on the fuselage the editor actually shows, follow it
// when the boom is edited, and the sketch's rounded artifact through the
// tail cannot form: the fin's root boundary is projected onto the deck after
// subdivision, wherever the fuselage exists (G21: a line between two points
// on a curved body goes inside it — so the root is SAMPLED along the deck).
//
// The fin is subdivided by the page's own subsurf selector, with the same
// crease-aware Catmull-Clark as the fuselage; the sheet stays 2D (METHOD
// RULING: settle the outline flat, thickness later, the rudder cut comes
// post-subsurf later still).
//
// Load after _fin_gen (and _gear_gen for the skin-material set) and before
// _cage_ui; chains PAGE.post.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const FIN = window.FIN_GEN, CG2 = window.CAGE2, GG = window.GEAR_GEN;
if (!FIN) { console.error('cage fin layer: _fin_gen.js not loaded'); return; }

// ---- parameters -----------------------------------------------------------
const finDef = Object.assign({ finOn: 1, finProject: 1, finCut: 0,
  finCutGap: 0.012,
  finSolid: 1, finThick: 0.06, finThickTE: 0.015 }, FIN.FIN_PARAMS);
PAGE.defaults = Object.assign(finDef, PAGE.defaults || {});

// binary choices are DROP-DOWNS, sliders stay for the continuous numbers
// (user ruling); the cut parts ride the page's own explode slider
const GROUP = ['8 · tail — fin (2D)', [
  ['finOn',      'fin layer',         0, 1, 1, ['off', 'on']],
  // dorsal + keel extension are CLAMPED OFF in rod mode (G26.4: a bare
  // tube has no deck to fair onto) — the rows follow the clamp (G28)
  ['finDorsal',  'leading edge (dorsal)', 0, 1, 1, ['removed', 'present'],
   { when: P => +P.finOn && !+P.boomStyle }],
  ['finRootGuard', 'root loops',      0, 1, 1, ['single + crease',
                                                'guard pair'],
   { when: P => +P.finOn }],
  ['finKeel',    'keel extension',    0, 1, 1, ['off', 'on'],
   { when: P => +P.finOn && !+P.boomStyle }],
  ['finProject', 'root',              0, 1, 1, ['free', 'on the skin'],
   { when: P => +P.finOn }],
  // THE CUT — the hinge slices between the doubleLoopV guards; the horn
  // line IS the mid row (max-creased under horn mode so it stays exactly
  // horizontal and the cut follows the mesh — move it with "mid row y")
  ['cut', [
    ['finCut',        'fin / rudder',   0, 2, 1,
     ['uncut', 'hinge only', 'horn balance']],
    ['finCutGap',     'slot width',     0, 0.05, 0.001,
     { when: P => +P.finCut > 0 }],
  ], 'open', { when: P => +P.finOn }],
  // THICKNESS — post-subsurf, per part: flat sides at +-t/2, the rim
  // rounded everywhere on the outline (slot faces stay flat), thickness
  // thinning aft of the hinge to the TE value
  ['thickness', [
    ['finSolid',   'volume',         0, 1, 1, ['2D sheet', 'solid']],
    ['finThick',   'base thickness', 0.01, 0.15, 0.002,
     { when: P => +P.finSolid }],
    ['finThickTE', 'TE thickness',   0.004, 0.06, 0.002,
     { when: P => +P.finSolid }],
  ], 'open', { when: P => +P.finOn }],
  // the three corners, each free on two axes (+z fwd, +y up, cage units)
  ['corners', [
    ['finTipZ',  'tip fore-aft',     -0.60, 0.60, 0.005],
    ['finTipY',  'tip up-down',      -0.80, 0.80, 0.005],
    ['finAftZ',  'top-aft fore-aft', -0.50, 0.30, 0.005],
    ['finAftY',  'top-aft up-down',  -0.90, 0.60, 0.005],
    ['finBaseZ', 'base fore-aft',    -0.50, 0.30, 0.005],
    ['finBaseY', 'base up-down',     -0.15, 0.50, 0.005],
  ], 'open', { when: P => +P.finOn }],
  // the horizontal rows and the free points that ride them (the Cub tail is
  // drawn with these: rows down, LE root and shoulder ON their rows)
  ['rows & points', [
    ['finRootFwd',   'root fwd point',   -1.20, 2.00, 0.005],
    ['finMidY',      'mid row y',        -0.80, 0.40, 0.005],
    ['finUY',        'u row y',          -0.40, 0.40, 0.005],
    ['finLEZ',       'LE root fore-aft', -0.80, 0.30, 0.005],
    ['finLEY',       'LE root up-down',  -0.20, 0.40, 0.005],
    ['finShoulderZ', 'shoulder fwd of tip', -0.10, 0.50, 0.005],
    ['finShoulderY', 'shoulder above mid',  -0.10, 0.30, 0.005],
    ['finTopY',      'top pair bulge',   -0.30, 0.30, 0.005],
  ], { when: P => +P.finOn }],
  // the trailing edge's offsets off the top-aft -> base chord, per row:
  // negative bulges aft (the Cub's D-shaped rudder), positive pulls
  // FORWARD — at the root that is the classic clearance notch (the
  // elevator's cutout for the rudder, the rudder's for the elevator). The
  // notch's spanwise reach is the u row's position.
  ['trailing edge', [
    ['finTERoot', 'root aft− / notch+', -0.40, 0.40, 0.005],
    ['finTEU',    'u bulge aft',    -0.40, 0.20, 0.005],
    ['finTEMid',  'mid bulge aft',  -0.40, 0.20, 0.005],
  ], { when: P => +P.finOn }],
  // ANGULAR PROFILES (the creasing the original plan promised): corner
  // sharpness = semi-sharp vertex weights on the outline corners, 0 round
  // (the sketch identity) .. 3 crisp; plus the dorsal's own bend creases
  ['corner sharpness', [
    ['finSharpTip',      'tip',       0, 3, 0.05],
    ['finSharpAft',      'top-aft',   0, 3, 0.05],
    ['finSharpBase',     'base',      0, 3, 0.05],
    ['finSharpShoulder', 'shoulder',  0, 3, 0.05],
    ['finSharpLE',       'LE root',   0, 3, 0.05],
  ], 'open', { when: P => +P.finOn }],
  // only meaningful while the dorsal exists (user, G28 audit)
  ['dorsal creases', [
    ['finCrA', 'section A crease', 0, 3, 0.05],
    ['finCrB', 'section B crease', 0, 3, 0.05],
  ], { when: P => +P.finOn && +P.finDorsal && !+P.boomStyle }],
], 'open'];
(PAGE.groupsOverride || (PAGE.groups = PAGE.groups || [])).push(GROUP);

// THE CUB TAIL RIDES THE CUB PRESET: the user's dorsal-less reference cage
// is a settings dict (FIN_CUB, checked against tools/_fin_cub_ref.obj), so
// selecting the piper cub brings its tail with it. FIN_PARAMS goes under
// it so the preset is SELF-CONTAINED: the page's defaults now carry the
// angular jodel fin, and a preset key left unset would inherit it (the
// sailplane-preset lesson, G19).
if (PAGE.presets && PAGE.presets['piper cub'])
  Object.assign(PAGE.presets['piper cub'],
    FIN.FIN_PARAMS, FIN.FIN_CUB, { finCut: 2 });

// ---- the skin filter ------------------------------------------------------
// the gear module's own set when it is loaded (one description of "skin");
// a copy only as the fallback for a page without the gear
const SKIN = (GG && GG.CAGE_MATS) || new Set(['body', 'pillarWindow',
  'pillarCabin', 'pillarPassenger', 'pillarTail', 'pillarFront', 'windshield',
  'skyWindows', 'pilotWindow', 'pasengerWindow', 'ceilingLoop', 'floorLoop',
  'waistband', 'boomTube', 'taper', 'pillarTaper', 'taperPanel']);
// A FIN ROOTS ON STRUCTURE, NOT GLASS: the deck sweep skips the glazing —
// the sailplane's bubble canopy dome ('windshield') crosses the centreline
// at a few sparse verts and sawtoothed the deck (measured: a 1.07-unit
// cliff in 20 mm), which the dorsal then rode. The gap the open cockpit
// leaves in the polyline bridges linearly, which is what a fairing over a
// cutout would do anyway.
const GLASS = new Set(['windshield', 'skyWindows', 'pilotWindow',
                       'pasengerWindow']);
const deckSkin = m => SKIN.has(m) && !GLASS.has(m);

// ---- materials: the sketch's own annotations, as section colours ----------
const SEC = {
  all: 0x8b95a2, doubleLoopV: 0x4ab8ff, doubleLoopH: 0x39c46a,
  optionalKeelExtension: 0xb98ae0, topFwd: 0xffc95a, topAft: 0xff8a5a,
  leadingA: 0xe05a91, leadingB: 0xc4394f,
};
let MATS = null;
function mats() {
  if (MATS) return MATS;
  MATS = { _plain: new THREE.MeshStandardMaterial({ color: 0x9aa4b0,
    metalness: 0.25, roughness: 0.55, side: THREE.DoubleSide }) };
  for (const k in SEC) MATS[k] = new THREE.MeshStandardMaterial({
    color: SEC[k], metalness: 0.25, roughness: 0.55, side: THREE.DoubleSide });
  return MATS;
}

function finMesh(m, bySection) {
  const g = new THREE.Group();
  const byMat = new Map();
  for (const f of m.F) {
    const k = bySection ? f.m : '_plain';
    if (!byMat.has(k)) byMat.set(k, []);
    byMat.get(k).push(f);
  }
  for (const [k, faces] of byMat) {
    const pos = [];
    for (const f of faces) {
      const p = f.v.map(i => m.V[i]);
      for (let t = 1; t + 1 < p.length; t++)
        pos.push(...p[0], ...p[t], ...p[t + 1]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, mats()[k] || mats()._plain));
  }
  return g;
}

function finWire(m, color) {
  const seen = new Set(), pos = [];
  for (const f of m.F) for (let i = 0; i < f.v.length; i++) {
    const a = f.v[i], b = f.v[(i + 1) % f.v.length];
    const k = a < b ? a + '_' + b : b + '_' + a;
    if (seen.has(k)) continue;
    seen.add(k);
    pos.push(...m.V[a], ...m.V[b]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(pos), 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color, transparent: true, opacity: 0.85 }));
}

// the displayed-surface wireframe, the page's quadWire convention: one
// LineSegments per section, section-coloured (or flat grey without sections)
function finQuadWire(m, bySection) {
  const g = new THREE.Group();
  const byMat = new Map();
  for (const f of m.F) {
    const k = bySection ? f.m : '_plain';
    if (!byMat.has(k)) byMat.set(k, []);
    byMat.get(k).push(f);
  }
  for (const [k, faces] of byMat) {
    const seen = new Set(), pos = [];
    for (const f of faces) for (let i = 0; i < f.v.length; i++) {
      const a = f.v[i], b = f.v[(i + 1) % f.v.length];
      if (a === b) continue;
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (seen.has(key)) continue;
      seen.add(key);
      pos.push(...m.V[a], ...m.V[b]);
    }
    if (!pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: SEC[k] !== undefined ? SEC[k] : 0x9aa4b0 })));
  }
  return g;
}

// ---- build ----------------------------------------------------------------
let group = null;
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};
const $ = id => document.getElementById(id);

const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  const { scene, mesh, P, stat } = ctx;
  dispose(group); group = null;
  if (!P.finOn) return;

  const cutMode = Math.round(P.finCut || 0);
  // ROD BOOM (G26.4, harmless clamp): the keel extension wraps the
  // fuselage KEEL under the tail — on a bare tube it wraps the
  // cylinder and reads as a canoe — and the DORSAL is a fairing onto a
  // fuselage deck that a bare tube does not have (short booms sent it
  // diving past the tightening, user report). Rod mode builds without
  // both — as the real tube-boom aeroplanes fly — and the user's
  // finKeel/finDorsal choices return with the loft.
  const S = FIN.finSpec(P.boomStyle
    ? { ...P, finKeel: 0, finDorsal: 0 } : P);
  S.cutPrep = cutMode;              // crease the rails the cut runs along
  const deck = FIN.finCentreline(mesh, deckSkin);
  S.deck = deck;                     // null-safe: no deck = the sketch as-is
  const m0 = FIN.buildFin2(S);

  const L = $('lvl') ? +$('lvl').value : 2;
  let s = m0;
  for (let i = 0; i < L; i++) s = CG2.cageSubdivide(s);
  let proj = null;
  if (deck && Math.round(P.finProject))
    proj = FIN.finProjectRoot(s, m0.deckTop, deck.z0);

  // THE CUT, along the mesh: the hinge slot is the drawn guard band, the
  // horn line is the mid row's own loop — no clipped polygons anywhere
  let disp = s;
  if (cutMode)
    disp = FIN.finCutMesh(s, { mode: cutMode, zCut: m0.cutZ,
      gap: P.finCutGap || 0 });

  // THICKNESS, last: each part becomes its own closed solid — sides at
  // +-t/2, rounded rim on the outline, flat slot faces, thickness tapering
  // aft of the hinge to the TE value
  const solidOn = Math.round(P.finSolid === undefined ? 1 : P.finSolid);
  if (solidOn) {
    let zA = Infinity;
    for (const p of s.V) zA = Math.min(zA, p[2]);
    disp = FIN.finThicken(disp, { thick: P.finThick || 0.06,
      thickTE: P.finThickTE, zHinge: m0.cutZ, zAftEnd: zA });
  }

  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const wire = $('wire') && $('wire').checked;
  const bySec = !$('color') || $('color').checked;
  group = new THREE.Group();
  // the page's own explode slider moves the rudder off its hinge, the same
  // gesture that flies the doors out
  const ex = cutMode ? Math.max(0, P.explodeD || 0) : 0;
  for (const part of cutMode ? ['fin', 'rudder'] : [null]) {
    const sub = part ? { V: disp.V, F: disp.F.filter(f => f.part === part) }
                     : disp;
    const obj = wire ? finQuadWire(sub, bySec) : finMesh(sub, bySec);
    if (part === 'rudder' && ex) obj.position.z = -ex;   // explode aft
    group.add(obj);
  }
  if ($('cage') && $('cage').checked && L > 0)
    group.add(finWire(m0, 0x7fe0a8));
  group.scale.setScalar(FS);
  scene.add(group);

  window.CAGE_FIN = { spec: S, cage: m0, mesh: s, disp,
                      rails: { zCut: m0.cutZ, rowY: m0.rowY }, deck, proj };
  if (stat) {
    let t = `  ·  fin: ${m0.V.length} v → L${L} ${s.V.length} v` +
      (proj ? ` · root on skin (${(proj.max * FS * 1000).toFixed(1)} mm cured)`
            : '');
    if (cutMode) {
      const nf = disp.F.filter(f => f.part === 'fin').length;
      t += ` · cut: fin ${nf} q / rudder ${disp.F.length - nf} q`;
    }
    if (solidOn) t += ` · solid ${(P.finThick * FS * 1000).toFixed(0)} mm`;
    stat.textContent += t;
  }
};

// shared with the stabilizer layer (_cage_stab.js): one set of builders,
// one palette
window.CAGE_FIN_DRAW = { finMesh, finQuadWire, finWire, mats, SEC };
})();
