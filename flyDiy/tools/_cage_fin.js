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
// `tailRimN` is ONE row for BOTH tail surfaces on purpose. The fin and the
// stabiliser are one drawing by design (G23) - the stab IS the fin model laid
// flat - so how round their edges are is one property of the tail, not two
// that can disagree. _cage_stab.js reads this same key.
const finDef = Object.assign({ finOn: 1, finProject: 1, finCut: 0,
  finVentralOn: 1, finVentralH: 0.4, finVentralC: 0.6,
  finCutGap: 0.012,
  finSolid: 1, finThick: 0.06, finThickTE: 0.015, tailRimN: 4,
  finFillet: 0.035,
  finCons: 0 }, FIN.FIN_PARAMS);
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
  // G295: the fillet where the fin's root meets the deck — a quarter-round
  // fairing along the root on both faces, this radius (cage units); 0 = none
  ['finFillet',  'root fillet',       0, 0.12, 0.005,
   { when: P => +P.finOn && +P.finProject && +P.finSolid }],
  // G267: THE VENTRAL (the user: "the fins should automatically get a
  // little fin at the bottom of their respective booms, take reference" —
  // the 337's and the P-38's fins run under the boom as well as over it).
  // The fraction of the fin's height that hangs under the boom, 0 = none.
  // G267.1 (the user: "the bottom fins should be optional, and their length
  // and height controllable"): a switch, a height and a root chord (cage
  // units, like every fin row)
  ['finVentralOn', 'ventral fin', 0, 1, 1, ['off', 'on'],
   { when: P => +P.finOn && +P.boomTwin }],
  ['finVentralH', 'ventral height', 0.05, 1.2, 0.01,
   { when: P => +P.finOn && +P.boomTwin && +P.finVentralOn }],
  ['finVentralC', 'ventral chord', 0.1, 2.0, 0.01,
   { when: P => +P.finOn && +P.boomTwin && +P.finVentralOn }],
  // THE FIN'S OWN CONSTRUCTION (G110): 0 follows the aeroplane's `intCons`,
  // 1..4 pin what the tail is built from — grammar, the livery's auto-finish
  // bottom-out, and the STRUCTURE itself (`tail.finMaterial` through the
  // join): mass and price since G116, stiffness and damping since G117 —
  // WYSIWYG, see genLattice's note.
  ['finCons', 'construction',      0, 4, 1,
   ['as the aeroplane', 'carbon', 'steel tube', 'fabric on wood', 'aluminium'],
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
    // HOW ROUND THE EDGE IS, and it was 4 facets with no control at all.
    // The outline's roundness comes from the subsurf, which the game pins at
    // 2; the EDGE's comes from here, and four facets across a 60 mm tranche
    // is what shows (user, 2026-08-31). Applies to the fin and the stab.
    ['tailRimN',   'tail edge sections',  2, 12, 1,
     { when: P => +P.finSolid }],
  ], 'open', { when: P => +P.finOn }],
  // THE MACRO TIER (TAIL CHANTIER 2 P3): the builder's five numbers, in the
  // wing's vocabulary, over the corner fields below (which are the expert
  // tier). Transforms of the drawn sheet about the root line and the hinge;
  // the hinge moves the fiche's guard columns. _fin_gen.js buildFin2 says how.
  ['size', [
    ['finHeight',   'height (× the drawn)',           0.50, 1.80, 0.01],
    ['finChord',    'chord (× the drawn, about the hinge)', 0.50, 1.60, 0.01],
    ['finChordTip', 'tip chord (of the root)',        0.30, 1.50, 0.01],
    ['finSweep',    'sweep (deg, the post rakes)',    -10, 45, 0.5],
    ['finHinge',    'rudder chord (of the root)',     0.08, 0.45, 0.005],
  ], 'open', { when: P => +P.finOn }],
  // the three corners, each free on two axes (+z fwd, +y up, cage units)
  ['corners', [
    ['finTipZ',  'tip fore / aft (sweep)',     -0.60, 0.60, 0.005],
    ['finTipY',  'height (tip up / down)',      -0.80, 0.80, 0.005],
    ['finAftZ',  'top-aft fore / aft', -0.50, 0.30, 0.005],
    ['finAftY',  'top-aft up / down',  -0.90, 0.60, 0.005],
    ['finBaseZ', 'base fore / aft',    -0.50, 0.30, 0.005],
    ['finBaseY', 'base up / down',     -0.15, 0.50, 0.005],
  ], 'open', { when: P => +P.finOn, level: 'expert' }],
  // the horizontal rows and the free points that ride them (the Cub tail is
  // drawn with these: rows down, LE root and shoulder ON their rows)
  ['rows & points', [
    ['finRootFwd',   'root length (forward point)',   -1.20, 2.00, 0.005],
    ['finMidY',      'mid row up / down',        -0.80, 0.40, 0.005],
    ['finUY',        'u row up / down',          -0.40, 0.40, 0.005],
    ['finLEZ',       'LE root fore / aft', -0.80, 0.30, 0.005],
    ['finLEY',       'LE root up / down',  -0.20, 0.40, 0.005],
    ['finShoulderZ', 'shoulder fore / aft (of the tip)', -0.10, 0.50, 0.005],
    ['finShoulderY', 'shoulder up / down (over the mid row)',  -0.10, 0.30, 0.005],
    ['finTopY',      'top pair bulge',   -0.30, 0.30, 0.005],
  ], { when: P => +P.finOn, level: 'expert' }],
  // the trailing edge's offsets off the top-aft -> base chord, per row:
  // negative bulges aft (the Cub's D-shaped rudder), positive pulls
  // FORWARD — at the root that is the classic clearance notch (the
  // elevator's cutout for the rudder, the rudder's for the elevator). The
  // notch's spanwise reach is the u row's position.
  ['trailing edge', [
    ['finTERoot', 'root aft− / notch+', -0.40, 0.40, 0.005],
    ['finTEU',    'u bulge aft',    -0.40, 0.20, 0.005],
    ['finTEMid',  'mid bulge aft',  -0.40, 0.20, 0.005],
  ], { when: P => +P.finOn, level: 'expert' }],
  // ANGULAR PROFILES (the creasing the original plan promised): corner
  // sharpness = semi-sharp vertex weights on the outline corners, 0 round
  // (the sketch identity) .. 3 crisp; plus the dorsal's own bend creases
  ['corner sharpness', [
    ['finSharpTip',      'tip',       0, 3, 0.05],
    ['finSharpAft',      'top-aft',   0, 3, 0.05],
    ['finSharpBase',     'base',      0, 3, 0.05],
    ['finSharpShoulder', 'shoulder',  0, 3, 0.05],
    ['finSharpLE',       'LE root',   0, 3, 0.05],
  ], 'open', { when: P => +P.finOn, level: 'expert' }],
  // only meaningful while the dorsal exists (user, G28 audit)
  ['dorsal creases', [
    ['finCrA', 'section A crease', 0, 3, 0.05],
    ['finCrB', 'section B crease', 0, 3, 0.05],
  ], { when: P => +P.finOn && +P.finDorsal && !+P.boomStyle, level: 'expert' }],
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

// AEROSKIN ON THE TAIL (G68.2). The same factory the fuselage and the wing
// use — one factory, so a tail cannot drift from the aeroplane it is bolted
// to. Falls back to the layer's own section palette when AEROSKIN is not
// loaded or the material mode is off, so the standalone _cage7 bench and the
// section-colour diagnostic both keep working exactly as before.
// `sec` is the LIVERY SECTION this mesh draws as (AEROSKIN's AERO_SEC):
// finSkin/finRud from this page, stabSkin/stabElev when the stab borrows
// finMesh — the CALLER knows which surface it is building, this function
// cannot. Absent means finSkin, which is also what an uncut fin is.
function tailMat(k, sec, boxPlane) {
  const A = (typeof window !== 'undefined' && window.AEROSKIN) || null;
  const sel = typeof document !== 'undefined'
    && document.getElementById('mat');
  if (!A || !sel || sel.value !== 'material')
    return mats()[k] || mats()._plain;
  const P0 = (window.CAGE_UI && window.CAGE_UI.P) || {};
  // the part's own construction wins over the aeroplane's (G110). The stab
  // borrows this function too, so WHICH part is read off the section the
  // caller already hands over — the one fact tailMat has that P does not.
  const pk = sec && sec.indexOf('stab') === 0 ? 'stCons' : 'finCons';
  // G213: the tail's own tokens (fabric over a wooden or tubular structure
  // on a wood or tube aeroplane), 'as the aeroplane' through GEN_SURF_DEFAULT
  const CONS4 = ['carbon', 'steel', 'fabric', 'alloy'];
  const FUS4 = ['carbon', 'tubeFabric', 'wood', 'alloy'];
  // the TAIL's default: the fabric over the fuselage's own structure
  const SD = (typeof GEN_SURF_DEFAULT_TAIL !== 'undefined' && GEN_SURF_DEFAULT_TAIL) ||
    { tubeFabric: 'steel', wood: 'fabric', alloy: 'alloy', carbon: 'carbon' };
  const kc = Math.round(P0[pk] || 0);
  const cons = kc > 0 ? CONS4[kc - 1]
    : SD[FUS4[Math.max(0, Math.min(3, Math.round(P0.intCons || 0)))]] ||
      'fabric';
  // the editor's per-part livery, when its UI is on the page; the direct
  // factory call below stays as the standalone bench's path
  if (typeof window !== 'undefined' && window.CAGE_SECMAT) {
    const m = window.CAGE_SECMAT(sec || 'finSkin', {
      boxDet: 1, boxPlane: boxPlane || 0,
      // THE TAIL IS ITS OWN SURFACE CLASS (G108). It is a flying surface
      // and everything that tested "> 0.5" still reads it as one; what the
      // class buys is that a marking can be aimed at the fuselage AND the
      // fin without landing on the wing, which is the grouping the user
      // asked for: "the fuselage projection and the fin projection should
      // be one".
      cons, struct: 1, wing: 2, ribM: TAIL_RIB,
      surf: 1, fieldM: tailFS(), side: THREE.DoubleSide });
    if (m) return m;
  }
  return A.aeroMaterial(THREE, {
    finish: A.aeroFinishFor('body', cons),
    grm: cons, struct: 1, wing: 2,     // a flying surface, and class 2
    // BOX-MAPPED MICROSURFACE (G113.3): the sheet comes off a craft-space
    // plane instead of the field. The structure and the wash-out keep the
    // field - they are different consumers of the same attribute.
    boxDet: 1, boxPlane: boxPlane || 0,
    // THE TAIL'S RIBS ARE DRAWN IN METRES (G97), not off the field's station
    // index: this mesh is far coarser than the wing's and `fract(station)`
    // wanders with the triangulation on it. TAIL_RIB is already the declared
    // real pitch, so handing it over is one argument.
    ribM: TAIL_RIB,
    surf: 1, fieldM: tailFS(),         // cage units -> metres
    side: THREE.DoubleSide,
  });
}

// ---- THE TAIL'S SURFACE FIELD (G68.2) --------------------------------------
// The same four numbers the cage and the wing carry (G66, G68.1), so one
// shader draws all three:
//
//   .x  sL  metres SPANWISE from the root      (ribs are spaced along it)
//   .y  sC  metres CHORDWISE from the LE       (the spar runs along it)
//   .z  st  station: integer at every rib
//   .w  lv  rail: 0 at the SPAR, 1 at a notional rear spar
//
// CHORD IS ALWAYS z, because the cage is z-forward and the fin is built in
// the cage's own frame; the SPAN is whichever of x/y is the long one. The fin
// stands on y and `finToStab` lays the SAME MODEL flat onto x, so detecting
// it from the mesh's own extents costs two comparisons and means the fin and
// the stab need no separate code at all — which is the whole point of the
// stab being the fin laid flat (G23).
//
// THE RIB PITCH IS DECLARED, NOT DERIVED, and that is a real difference from
// the wing. `61_gen_frame` bills wing ribs on its own 0.4 m rule and now
// exports their stations (G66); it models the tail as a handful of nodes and
// bills no tail ribs at all. Light-aircraft tail ribs run closer than wing
// ribs — 0.20-0.30 m — because the surfaces are small and the loads local.
// 0.26 m until something physical has an opinion.
const TAIL_RIB = 0.26;
// THE TAIL BUILDS IN CAGE UNITS, NOT METRES, and that is the one place this
// differs from the wing: the wing comes over from genSkin in the game's model
// frame, which is already metric, while the fin is built in the cage's own
// frame and the whole build is scaled by CAGE_UNIT x planeScale on the way to
// the scene. So the field stays in cage units — consistent with the cage's
// own (G66) — the material is told the conversion through `fieldM`, and the
// rib pitch is converted the other way to place the ribs 0.26 REAL metres
// apart whatever the aeroplane's scale. Measured before the fix: sC ran to
// 3.91 on a 3.13 m surface, which is the 0.745 planeScale exactly.
const tailFS = () => ((window.CAGE2 && window.CAGE2.CAGE_UNIT) || 1) *
  ((window.CAGE_UI && window.CAGE_UI.P && window.CAGE_UI.P.planeScale) || 1);
function finField(m) {
  const ribL = TAIL_RIB / Math.max(1e-6, tailFS());   // cage units
  const bb = [[1e9, -1e9], [1e9, -1e9], [1e9, -1e9]];
  for (const p of m.V) for (let k = 0; k < 3; k++) {
    if (p[k] < bb[k][0]) bb[k][0] = p[k];
    if (p[k] > bb[k][1]) bb[k][1] = p[k];
  }
  const ext = bb.map(b => b[1] - b[0]);
  const SA = ext[0] > ext[1] ? 0 : 1;            // span axis: x (stab) or y
  const lo = bb[SA][0], hi = bb[SA][1], sp = ext[SA] || 1;
  // a mirrored stab straddles the centreline, so its root is 0; a fin (or a
  // half stab) roots at whichever end sits nearer it
  const root = (lo < -0.1 * sp && hi > 0.1 * sp) ? 0
    : (Math.abs(lo) < Math.abs(hi) ? lo : hi);
  // THE LOCAL CHORD, bucketed by span: a tail surface is tapered and swept,
  // so the leading edge is not at one z. Without this the chord fraction is
  // measured from the foremost point of the WHOLE surface and the leading
  // edge treatment lands in the middle of the tip.
  const NB = 48, zLo = new Float32Array(NB).fill(1e9),
        zHi = new Float32Array(NB).fill(-1e9);
  const bin = a => Math.max(0, Math.min(NB - 1,
    Math.floor(Math.abs(a - root) / sp * NB)));
  for (const p of m.V) {
    const b = bin(p[SA]);
    if (p[2] < zLo[b]) zLo[b] = p[2];
    if (p[2] > zHi[b]) zHi[b] = p[2];
  }
  for (let i = 0; i < NB; i++) if (zLo[i] > zHi[i]) {   // an empty bin
    let j = i; while (j > 0 && zLo[j] > zHi[j]) j--;
    zLo[i] = zLo[j]; zHi[i] = zHi[j];
  }
  // ---- THE ENVELOPE MUST NOT DIP UNDER ITS OWN DATA (G113.3) -------------
  // MEASURED, and it is the user's "the leading edge wash out is completely
  // irregular and screwed up": one vertex in FIVE on the stabiliser came back
  // with a NEGATIVE chord coordinate — ahead of its own leading edge — and
  // 6.7 % on the fin. The wing, whose field is built elsewhere, had none.
  //
  // The cause is the interpolation directly below, and it is not a bug in it:
  // `at()` blends between BIN CENTRES, so a vertex that IS its bin's maximum
  // (which is exactly what a vertex ON the leading edge is) gets an `le`
  // blended with a neighbour that lies further aft — i.e. behind itself. The
  // shader then clamps with `max(sC, 0)` and the wash-out band saturates over
  // a fifth of the panel in a shape that follows the TRIANGULATION rather
  // than the leading edge. That is precisely what "irregular" looks like.
  //
  // ONE DILATION PASS FIXES IT, PROVABLY. After `Z[i] = max` over i-1, i, i+1,
  // every bin straddling a vertex holds a value >= that vertex's own bin
  // maximum, so any convex combination of the two bins `at()` interpolates
  // between is >= the vertex — for every vertex, on any shape. The price is
  // that the leading edge is read up to one bin of LE-variation forward,
  // which on 48 bins is a small uniform bias and is strictly better than a
  // fifth of the surface clamped to zero.
  {
    const Z = zHi.slice();
    for (let i = 0; i < NB; i++)
      zHi[i] = Math.max(Z[i], Z[Math.max(0, i - 1)], Z[Math.min(NB - 1, i + 1)]);
  }
  // INTERPOLATED BETWEEN BINS, not read out of one. Taking the bin's own
  // value makes the leading edge a STAIRCASE — 48 steps across the span —
  // and it shows: the LE treatment came out with a hard jagged boundary
  // running down the fin, which reads as a modelling fault rather than as a
  // shading one. The chord varies smoothly, so the sampling must too.
  const at = (T, a) => {
    const f = Math.max(0, Math.min(NB - 1.001,
      Math.abs(a - root) / sp * NB - 0.5));
    const i = Math.floor(f), t = f - i;
    return T[i] + (T[Math.min(NB - 1, i + 1)] - T[i]) * t;
  };
  return p => {
    const s = Math.abs(p[SA] - root);
    const le = at(zHi, p[SA]);                            // +z is FORWARD
    const c = Math.max(1e-4, le - at(zLo, p[SA]));
    const cf = (le - p[2]) / c;
    return [s, le - p[2], s / ribL, (cf - 0.30) / 0.40];
  };
}

function finMesh(m, bySection, sec) {
  const g = new THREE.Group();
  const byMat = new Map();
  for (const f of m.F) {
    const k = bySection ? f.m : '_plain';
    if (!byMat.has(k)) byMat.set(k, []);
    byMat.get(k).push(f);
  }
  const fld = finField(m);
  // NORMALS ARE BUILT HERE, NOT COMPUTED (2026-08-31). This geometry is
  // NON-INDEXED — three fresh positions per triangle, no welding — and
  // computeVertexNormals on a non-indexed buffer gives every vertex its own
  // triangle's face normal. That is why the fin and the stab were faceted
  // everywhere including the rounded rim, and why there was no flatShading
  // flag to turn off: the flatness was in the data.
  //
  // So: a face that CARRIES normals (`f.n`, one per corner — finThicken puts
  // them on the rim and on nothing else) uses them, and every other face gets
  // its face normal, exactly as before. The flat sheets are untouched, which
  // is the user's own ruling — smooth the tranche, leave the flats alone.
  const triN = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    const L = Math.hypot(x, y, z) || 1;
    return [x / L, y / L, z / L];
  };
  for (const [k, faces] of byMat) {
    const pos = [], fa = [], nor = [];
    for (const f of faces) {
      const p = f.v.map(i => m.V[i]);
      for (let t = 1; t + 1 < p.length; t++) {
        const idx = [0, t, t + 1];
        const fn = f.n ? null : triN(p[0], p[t], p[t + 1]);
        for (const j of idx) {
          const q = p[j];
          pos.push(q[0], q[1], q[2]);
          const a = fld(q); fa.push(a[0], a[1], a[2], a[3]);
          const n = fn || f.n[j];
          nor.push(n[0], n[1], n[2]);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('aStruct',
      new THREE.BufferAttribute(new Float32Array(fa), 4));
    geo.setAttribute('normal',
      new THREE.BufferAttribute(new Float32Array(nor), 3));
    // WHICH PLANE THIS PANEL LIES IN, measured rather than assumed (G113.3).
    // The user: "warning with the V tail configuration, let us be resistant
    // to that" - so nothing here says "a fin is vertical". The panel's own
    // accumulated |normal| decides: lateral-facing is a flank (side view),
    // up-facing is a slab (plan view), and a CANTED panel simply takes
    // whichever of the two it is more of, which is the correct answer for a
    // V-tail without the code ever learning that one exists.
    let nx = 0, ny = 0;
    for (let i = 0; i < nor.length; i += 3) {
      nx += Math.abs(nor[i]); ny += Math.abs(nor[i + 1]);
    }
    g.add(new THREE.Mesh(geo, tailMat(k, sec, nx >= ny ? 0 : 1)));
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
let group2 = null;                  // the second boom's fin (2026-09-04)
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};
const $ = id => document.getElementById(id);

// the saddles' material: the hardware section `rodSaddle` (AEROSKIN's table,
// steel), the hinge layer's own idiom, with a lambert fallback for a bench
let saddleFallback = null;
function saddleMat() {
  if (window.CAGE_SECMAT) {
    const ms = window.CAGE_SECMAT('rodSaddle', { surf: 0, fieldM: 1, tint0: 0x8a9099 });
    if (ms) return ms;
  }
  const A = window.AEROSKIN;
  if (A && A.aeroHardMat) {
    const m = A.aeroHardMat(THREE, 'hinge', 'metal', 0x8a9099, {});
    if (m) return m;
  }
  if (!saddleFallback) saddleFallback = new THREE.MeshLambertMaterial({ color: 0x8a9099 });
  return saddleFallback;
}

const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  const { scene, mesh, P, stat } = ctx;
  dispose(group); group = null;
  dispose(group2); group2 = null;
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
  // TWIN BOOMS (2026-09-04): the fin rides a BOOM, not the fuselage — its
  // deck is the boom's own top line (a straight tube), its keel the tube's
  // belly, its tail cap the boom's tip; built once, drawn at ±boomX
  const TB = window.CAGE_BOOMS;
  const FSd = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const deck0 = TB
    ? { top: z => TB.yTop(z * FSd) / FSd, bot: z => TB.yBot(z * FSd) / FSd,
        z0: TB.zTip / FSd, z1: TB.zRoot / FSd }
    : FIN.finCentreline(mesh, deckSkin);
  // THE FIN MEETS A FITTING, NOT THE TUBE (G307, the fitment study P3; the
  // user's ruling). On a bare tube — the single rod, or rod-style twin
  // booms — the root lands on a bolted SADDLE's plate: the deck is lifted
  // by the saddle's height so buildFin2 and finProjectRoot put the root
  // there, the root rim is kept square (below), and the saddles are drawn
  // under it. A lofted body keeps the root on its skin.
  const RF = window.ROD_FIT;
  const tube = !!(RF && (TB ? !TB.lofted : +P.boomStyle));
  const hS = tube ? RF.SADDLE.hS / FSd : 0;
  const deck = tube && deck0 ? FIN.deckOnFitting(deck0, hS) : deck0;
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
  // G307: on a tube the root rim is a slot-style FLAT edge on the plate
  if (tube && proj && s.finRootLo) {
    const rk = FIN.rootKeys(s);
    const ck = new Set(disp.cutKeys || []);
    for (const k of rk) ck.add(k);
    disp = Object.assign({}, disp, { cutKeys: ck });
  }
  // THE MEASURE'S INPUT (TAIL CHANTIER 2, P0): the cut, UNTHICKENED sheet —
  // one face per patch of skin; the solid below carries both sides
  const sheet = disp;

  // THICKNESS, last: each part becomes its own closed solid — sides at
  // +-t/2, rounded rim on the outline, flat slot faces, thickness tapering
  // aft of the hinge to the TE value
  const solidOn = Math.round(P.finSolid === undefined ? 1 : P.finSolid);
  if (solidOn) {
    let zA = Infinity;
    for (const p of s.V) zA = Math.min(zA, p[2]);
    disp = FIN.finThicken(disp, { thick: P.finThick || 0.06,
      thickTE: P.finThickTE, zHinge: m0.cutZ, zAftEnd: zA,
      rimN: P.tailRimN });
  }

  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const wire = $('wire') && $('wire').checked;
  const bySec = !$('color') || $('color').checked;
  group = new THREE.Group();
  // NAMED for the editor (G76/G77): the part table says which layer a
  // part lives in, and G79's raycast resolves a hit to a part through
  // that. One string, no behaviour.
  group.name = 'cageLayer:fin';
  // the page's own explode slider moves the rudder off its hinge, the same
  // gesture that flies the doors out
  const ex = cutMode ? Math.max(0, P.explodeD || 0) : 0;
  for (const part of cutMode ? ['fin', 'rudder'] : [null]) {
    const sub = part ? { V: disp.V, F: disp.F.filter(f => f.part === part) }
                     : disp;
    // an UNCUT fin is all fin skin; the rudder is its own livery row only
    // once it exists as its own surface
    const obj = wire ? finQuadWire(sub, bySec)
                     : finMesh(sub, bySec, part === 'rudder' ? 'finRud'
                                                             : 'finSkin');
    if (part === 'rudder' && ex) obj.position.z = -ex;   // explode aft
    if (part === 'rudder') obj.name = 'edSurf_rud';       // G59
    else obj.name = 'edFinSkin';                          // G267.2: a part on twin booms
    group.add(obj);
  }
  // THE CONTROL CAGE FOLLOWS THE EXPERT SWITCH (TAIL CHANTIER 2 P2): the
  // cage is what the expert rows (corners, rows, edges, sharpness) move, so
  // turning them on shows it; the display row still shows it on its own
  const EXP = window.CAGE_UI && window.CAGE_UI.EXPERT && window.CAGE_UI.EXPERT.on;
  if (L > 0 && (($('cage') && $('cage').checked) || EXP))
    group.add(finWire(m0, 0x7fe0a8));
  // THE VENTRAL (G267, the user: "the fins should automatically get a little
  // fin at the bottom of their respective booms, take reference" — then
  // "the small fins at the bottom should be positioned full aft"): a small
  // swept plate under each boom's tail, its trailing edge on the tail's own
  // aft-most point, its root on the tube's belly, `finVentral` of the fin's
  // height tall, chord 1.5 x its height at the root and half at the tip,
  // the fin's own thickness and material. A first cut mirrored the whole
  // fin skin under the boom — that dragged the dorsal fillet with it (a 2 m
  // ventral) and sat a metre forward of the tail. Drawn, not measured: the
  // fin layer's measure is the sheet above the boom, and the physics fin is
  // that sheet (TWIN-BOOM-2 §1.4 says what is owed).
  const vOn = !!(TB && +P.finVentralOn);
  if (vOn && !wire) {
    let zAftAll = Infinity;
    for (const v of disp.V) if (v[2] < zAftAll) zAftAll = v[2];
    if (isFinite(zAftAll)) {
      // G271 (the user: "the bottom fin is too rough for now. Give it some
      // trailing edge thinning, a proper thin line bevel, and get it higher
      // up so there is no gap with boom. Ensure they have their own finish
      // section"). It was a flat box hung at one belly height — on an
      // ogival tail the belly climbs to the cap, so the box stood clear of
      // the tube over its aft half. Now it is a SHEET the fin's own
      // thickener finishes: the root row FOLLOWS THE BELLY station by
      // station and is sunk a third of the tube's depth into it (no gap at
      // any cap), the tip is straight `h` below the mid-root belly, the
      // leading edge sweeps back; finThicken gives the plate the fin's
      // thickness forward, tapering from mid-chord to the fin's own TE
      // value, and the rounded rim (the fin's rim rows) all round. Its own
      // section, `finVentral` (AERO_SEC, follows the fin's paint until
      // repainted).
      const h = Math.max(0.05, +P.finVentralH || 0.4), cR = Math.max(0.1, +P.finVentralC || 0.6), cT = 0.35 * cR;
      const t = 0.7 * (+P.finThick || 0.06);
      const tTE = Math.min(t, 0.7 * (+P.finThickTE || 0.012));
      const zc = z => Math.max(deck.z0, Math.min(deck.z1, z));   // the deck's own domain
      const belly = z => deck.bot(zc(z));
      const sink = z => Math.min(0.05, 0.35 * Math.max(0, deck.top(zc(z)) - belly(z)));
      const yRoot = z => belly(z) + sink(z);
      const yTip = belly(zAftAll + 0.5 * cR) - h;
      const NU = 6, NV = 4;                       // chordwise x spanwise quads
      const V = [], F = [];
      for (let j = 0; j <= NV; j++) {
        const v = j / NV, c = cR + (cT - cR) * v;
        for (let i = 0; i <= NU; i++) {
          const u = i / NU, z = zAftAll + u * c;
          V.push([0, (1 - v) * yRoot(z) + v * yTip, z]);
        }
      }
      const at = (i, j) => j * (NU + 1) + i;
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++)
        F.push({ v: [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)], m: 'finVentral', part: 'ventral' });
      let solid = FIN.finThicken({ V, F }, { thick: t, thickTE: tTE,
        zHinge: zAftAll + 0.45 * cR, zAftEnd: zAftAll, rimN: P.tailRimN });
      // the thickener's sides follow the sheet's winding; the plate must
      // face OUT (the rim's normals are built, the sides' computed) — the
      // signed volume says which way this sheet was wound
      let vol = 0;
      for (const f of solid.F) {
        const a = solid.V[f.v[0]];
        for (let k = 1; k + 1 < f.v.length; k++) {
          const b = solid.V[f.v[k]], d = solid.V[f.v[k + 1]];
          vol += a[0] * (b[1] * d[2] - b[2] * d[1]) - a[1] * (b[0] * d[2] - b[2] * d[0]) + a[2] * (b[0] * d[1] - b[1] * d[0]);
        }
      }
      if (vol < 0) solid = { V: solid.V, F: solid.F.map(f => ({ v: f.v.slice().reverse(), m: f.m, part: f.part,
                                                               n: f.n ? f.n.slice().reverse() : f.n })) };
      const vObj = finMesh(solid, bySec, 'finVentral');
      vObj.name = 'edFinVentral';
      group.add(vObj);
    }
  }
  // THE ROOT FILLET (G295, a visual item of the twin-boom review: "no root
  // fillet where the fin meets the boom"). A quarter-round fairing along the
  // fin's root on both faces: from the fin's side a fillet radius up, round
  // to the deck a radius out — on a boom the deck falls away from the crown
  // by the oval's own curve, so the outer foot sits ON the tube, not in the
  // air beside it. Built on the projected root loop (the sheet's own
  // `finRootLo` vertices, which finProjectRoot just laid on the deck),
  // forward of the hinge when the rudder is cut, the fin skin's own section.
  const filR = +P.finFillet || 0;
  if (solidOn && proj && filR > 0 && s.finRootLo && !wire) {
    const ids = new Set();
    for (const [a, b] of s.finRootLo) { ids.add(a); ids.add(b); }
    const zLo = cutMode ? m0.cutZ - 1e-6 : -Infinity;
    const root = [...ids].map(i => s.V[i]).filter(v => v[2] >= zLo && v[2] >= deck.z0)
      .sort((a, b) => a[2] - b[2]);
    const tRoot = +P.finThick || 0.06;
    // the tube's surface a lateral x off its crown, cage units (the boom's
    // half-sizes are scene metres): the oval drops as 1 - sqrt(1 - (x/r)^2)
    const dropAt = (z, x) => {
      if (!TB) return 0;
      const rr = TB.rAt(z * FSd) / FSd, hh = TB.hAt(z * FSd) / FSd;
      const u = Math.min(1, Math.abs(x) / Math.max(1e-6, rr));
      return hh * (1 - Math.sqrt(Math.max(0, 1 - u * u)));
    };
    if (root.length >= 3) {
      const NF = 4, V = [], Fq = [];
      for (const sgn of [1, -1]) {
        const rows = [];
        for (const v of root) {
          const z = v[2], yD = v[1], row = [];
          for (let k = 0; k <= NF; k++) {
            const th = (k / NF) * Math.PI / 2;
            const x = sgn * (0.5 * tRoot + filR - filR * Math.cos(th));
            const y = yD + filR - filR * Math.sin(th) - dropAt(z, x) * (k / NF);
            row.push(V.push([x, y, z]) - 1);
          }
          rows.push(row);
        }
        for (let j = 0; j + 1 < rows.length; j++)
          for (let k = 0; k < NF; k++) {
            const q = [rows[j][k], rows[j + 1][k], rows[j + 1][k + 1], rows[j][k + 1]];
            // outward: the fairing faces away from the corner it fills
            const a = V[q[0]], b = V[q[1]], d = V[q[3]];
            const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
            const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
            Fq.push({ v: (n[0] * sgn + n[1]) >= 0 ? q : q.slice().reverse(), m: 'finSkin', part: 'fin' });
          }
      }
      const fObj = finMesh({ V, F: Fq }, bySec, 'finSkin');
      fObj.name = 'edFinFillet';
      group.add(fObj);
    }
  }
  // THE SADDLES (G307): one at the root's forward end, one at the hinge
  // post — a split collar round the tube with a plate on its crown, the
  // fin's root on the plate. Metric hardware in a child scaled back out of
  // the group's cage units; tagged as hardware (the join's bounds skip it)
  // and as the fin's own part (`partOf`, G300: on twin booms the fin rides
  // the boom's tail and its saddles go with it).
  if (tube && !wire && proj && s.finRootLo && deck0) {
    const ids = new Set();
    for (const [a, b] of s.finRootLo) { ids.add(a); ids.add(b); }
    let zF = -Infinity;
    for (const i of ids) if (s.V[i][2] >= deck0.z0) zF = Math.max(zF, s.V[i][2]);
    const K = window.GEAR_KIT;
    if (K && isFinite(zF)) {
      const bag = K.Bag();
      const stations = [zF - 0.04, m0.cutZ];
      const drawn = [];
      // the gear's saddle (the tailwheel's, drawn first — build order) at
      // the same station is SHARED: the fin bolts its plate onto that collar
      const GS = (window.CAGE_GEAR && window.CAGE_GEAR.saddles) || [];
      for (const zc of stations) {
        let z = Math.max(deck0.z0 + 0.03, zc);
        const near = GS.find(g => Math.abs(g.z - z * FS) < 0.12);
        if (near) z = near.z / FS;
        const yT = deck0.top(z), yB = deck0.bot(z);
        const r = 0.5 * (yT - yB) * FS;
        if (!(r > 0.01)) continue;
        RF.saddle(bag, { ctr: [0, 0.5 * (yT + yB) * FS, z * FS], axis: [0, 0, -1], r, collar: !near,
                         plate: { top: 1, W: Math.max(r * 2 + 0.02, (P.finThick || 0.06) * FS + 0.04), L: 0.09 } });
        drawn.push({ z: z * FS, r, shared: !!near });
      }
      const sad = new THREE.Group();
      sad.name = 'edSaddle_fin';
      sad.scale.setScalar(1 / FS);
      const m = bag.mesh(sad, saddleMat());
      if (m) { m.userData.edHw = 1; m.userData.partOf = 'edFinSkin'; }
      group.add(sad);
      window.CAGE_FIN_SADDLES = drawn;
    }
  } else window.CAGE_FIN_SADDLES = null;
  group.scale.setScalar(FS);
  if (TB) {
    // one fin a boom: the second is the first's clone at −boomX, its rudder
    // named for the join (a second hinge, the same rudder channel)
    group.position.x = TB.x;
    group2 = group.clone();
    group2.position.x = -TB.x;
    group2.traverse(o => {
      if (o.name === 'edSurf_rud') o.name = 'edSurf_rud2';
      else if (o.name === 'edFinSkin') o.name = 'edFinSkin2';         // G267.2
      else if (o.name === 'edFinVentral') o.name = 'edFinVentral2';
      else if (o.name === 'edFinFillet') o.name = 'edFinFillet2';           // G295
      else if (o.name === 'edSaddle_fin') o.name = 'edSaddle_fin2';         // G307
      if (o.userData && o.userData.partOf === 'edFinSkin') o.userData.partOf = 'edFinSkin2';
    });
    scene.add(group2);
  }
  scene.add(group);

  // THE LAYER MEASURES, THE JOIN READS (TAIL CHANTIER 2, P0): areas by
  // part and material, mean chord, the declared hinge — finMeasure says
  // what each field is. Metres (×FS). The headless tail (_tail_headless.js)
  // computes the same object with no page; GATE FIN pins the two.
  window.CAGE_FIN = { spec: S, cage: m0, mesh: s, disp,
                      rails: { zCut: m0.cutZ, rowY: m0.rowY }, deck, proj,
                      measure: FIN.finMeasure(sheet, { FS, zCut: m0.cutZ,
                                                       cut: cutMode,
                                                       hingeLine: m0.hingeLine }),
                      clamped: m0.clamped || [] };   // P3: the clamps that bit
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
window.CAGE_FIN_DRAW = { finMesh, finQuadWire, finWire, mats, SEC, saddleMat };
})();
