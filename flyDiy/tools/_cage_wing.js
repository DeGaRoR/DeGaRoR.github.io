// CAGE WING LAYER (G30, ROADMAP P2) — the GAME's wing on the cage.
//
// P2's ruling is "import from the game, and rework from there": the wing
// shape the game already flies (spec.wings -> genFrame spar stations ->
// genSkin loft, tips, ailerons, flaps, struts, pitot) is the starting
// geometry, IMPORTED VERBATIM — this layer runs the game's own generator
// chain (00_registry + 60..63, loaded as plain scripts, zero top-level
// name collisions, checked) and puts the WING SUBSET of its output on the
// live cage. No wing geometry is re-authored here; the rework happens in
// later chantiers, against this baseline, with the user (the G21§5 rule:
// shape is theirs).
//
// EXTRACTION IS BY BINDING, NOT BY BOX. The game fuses the wing covering
// into its whole-aeroplane `skin` group, but every skin vertex carries its
// node influences (wi/ww), and a wing vertex binds EXCLUSIVELY to spar
// nodes (wingSectionAt builds its weights from wF/wR alone). So: WNODES =
// the def's own spar-station node ids (parts.wf), a skin face is wing iff
// all its vertices bind only to WNODES, and the strut / pitot / aileron /
// flap groups come over wholesale (they are wing parts by construction).
//
// FRAMES. genSkin emits in the game's REST pose (genRestFrame — a
// taildragger sits tail-down). The layer recovers the body frame by
// sampling the same rest transform at basis points and inverting it, then
// maps body -> cage: game x is AFT, cage z is FORWARD, y shared, lateral
// swaps axis. The wing ANCHORS on the cage the way the fin anchors on the
// deck: root leading edge at the cabin-front station, root height on the
// live deck (high wing) or keel band (low wing), read through the gear
// module's airframe contract — then two trim sliders move it from there.
//
// STOL IS RESERVED BY CONSTRUCTION: the imported wing already carries the
// game's flap and aileron bands, hinge lines and spar stations — the P2
// reservation is inherited, not re-implemented.
//
// Load after _gear_gen (airframe contract) and the game core scripts;
// before _cage_ui. Chains PAGE.post.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const GG = window.GEAR_GEN, CG2 = window.CAGE2;
if (typeof resolveSpec !== 'function' || typeof genFrame !== 'function' ||
    typeof genWing !== 'function') {
  console.error('cage wing layer: game core (60..63) not loaded');
  return;
}

// ---- parameters -----------------------------------------------------------
// THE GARAGE'S OWN SURFACE, complete (G31 — the first cut dropped chord
// tip, mid wing, the NACA knobs and the whole control-surfaces group):
// labels and ranges are the garage panel's verbatim (src/viewer/
// garage.js SECTIONS — Wings, Struts & fixation, Control surfaces); the
// NACA digits are two knobs to a builder (@camber/@thick) and one field
// to the generator, exactly as there; 'Chord tip' writes taper the way
// the garage's @chordTip does.
const TIP_KEYS = Object.keys(GEN_TIPS);
const FLAP_KEYS = Object.keys(GEN_FLAPS);
// G189: the lamp bay's edges as loft stations — the join's cageWingCuts,
// the same arithmetic off the same declaration, so the drawn loft and the
// flown loft have the same rows (see the join's note)
const wingCutsOf = P => (typeof CAGE_JOIN_WING_CUTS === 'function')
  ? CAGE_JOIN_WING_CUTS(P)
  : (window.CAGE_JOIN_WING_CUTS ? window.CAGE_JOIN_WING_CUTS(P) : null);
PAGE.defaults = Object.assign({
  // G140: wgSweep is RETIRED — the planform is three stations now (root,
  // crank, tip), each with a chord and a fore/aft offset in metres. The
  // migrator (GEN_MIGRATORS[5]) lifts an old save's angle into the offsets.
  wingOn: 1, wgSpan: 10.0, wgChord: 1.60, wgChordTip: 1.60,
  wgTipX: 0, wgCrankChord: 1.60, wgCrankX: 0,
  wgDihedral: 3.0, wgIncidence: 1.5, wgWashout: 1.5,
  wgCamber: 2, wgThick: 12,
  wgTip: Math.max(0, TIP_KEYS.indexOf('rounded')), wgPos: 0,
  wgCentre: 0, wgBrace: 0, wgCrankAt: 0, wgDihedralOut: 6,
  wgPanels: 3, wgDx: 0, wgDy: 0,
  // G185: a PARASOL wing's cabane height above the deck (wgPos 3)
  wgParaH: 0.45,
  // G86/G87: the lift strut's two trim offsets, in METRES off the site the
  // structure picks (see the strut block below). Zero is the frame's own
  // answer, so a build that never touches them is the one physics asked for.
  wgStrutZ: 0, wgStrutX: 0,
  wgFlapType: Math.max(0, FLAP_KEYS.indexOf('none')),
  wgFlapSpan: 0.50, wgFlapChord: 0.20,
  // G185: ailerons are a switch per plane (a biplane's upper plane may carry
  // none); off writes an aileron span of 0 to the spec
  wgAilOn: 1, wgAilSpan: 0.38, wgAilChord: 0.22,
  wgCons: 0,
  // G185: THE SECOND PLANE — the full key set of the first (port the full
  // surface: never a subset), its own position band, cabane height, nudge
  // and stagger (metres its leading edge sits AFT of the first plane's,
  // the trunk's fore/aft sign). Off by default: a monoplane.
  w2On: 0, w2Pos: 2, w2ParaH: 0.45, w2Stagger: 0.35, w2Dy: 0,
  w2Span: 10.0, w2Chord: 1.60, w2ChordTip: 1.60, w2TipX: 0,
  w2CrankAt: 0, w2CrankChord: 1.60, w2CrankX: 0, w2DihedralOut: 6,
  w2Dihedral: 3.0, w2Incidence: 1.5, w2Washout: 1.5, w2Camber: 2, w2Thick: 12,
  w2Tip: Math.max(0, TIP_KEYS.indexOf('rounded')), w2Centre: 0, w2Panels: 3,
  w2Cons: 0,
  w2FlapType: Math.max(0, FLAP_KEYS.indexOf('none')),
  w2FlapSpan: 0.50, w2FlapChord: 0.20,
  w2AilOn: 1, w2AilSpan: 0.38, w2AilChord: 0.22,
}, PAGE.defaults || {});

// ---- panel ----------------------------------------------------------------
const on = { when: P => +P.wingOn };
const WING_ITEMS = [
  ['wingOn',   'wings',          0, 1, 1],
  // G185: 'parasol' — on cabane struts above the deck, lift struts to the
  // lower longeron (a Pietenpol); its height is wgParaH
  ['wgPos',    'position',       0, 3, 1,
   ['high wing', 'mid wing', 'low wing', 'parasol'], on],
  ['wgSpan',   'span',           6.5, 14, 0.1, { ...on, dim: 'm' }],
  ['wgChord',  'root chord',     1.15, 2.10, 0.05, { ...on, dim: 'm' }],
  ['wgChordTip', 'tip chord',    0.55, 2.10, 0.05, { ...on, dim: 'm' }],
  ['wgTip',    'tips',           0, TIP_KEYS.length - 1, 1,
   TIP_KEYS.map(k => GEN_TIPS[k].name), on],
  ['wgCrankAt', 'crank at',      0, 0.85, 0.05, on],
  // G140: the crank SECTION — its own chord and fore/aft seat, the same
  // two numbers the root and tip carry. On a strutted wing the crank is
  // where the strut lands (the frame's ruling), so this trio IS the
  // C172's wing: constant chord to the strut, taper and offset outboard.
  ['wgCrankChord', 'crank chord', 0.55, 2.10, 0.05,
   { when: P => +P.wingOn && +P.wgCrankAt > 0, dim: 'm' }],
  ['wgCrankX', 'crank aft',      -0.8, 1.5, 0.05,
   { when: P => +P.wingOn && +P.wgCrankAt > 0, dim: 'm' }],
  ['wgDihedralOut', 'dih. outer', 0, 20, 0.5,
   { when: P => +P.wingOn && +P.wgCrankAt > 0 }],
  // G140: sweep retired — the TIP's fore/aft seat is the honest knob (the
  // old angle was tan(this / exposed semispan))
  ['wgTipX',   'tip aft',        -1.5, 2.5, 0.05, { ...on, dim: 'm' }],
  ['wgDihedral', 'dihedral',     0, 6, 0.5, on],
  ['wgIncidence', 'incidence',   -1, 4, 0.1, on],
  ['wgWashout', 'washout',       0, 4, 0.1, on],
  ['wgCamber', 'camber',         0, 6, 1, on],
  ['wgThick',  'thickness',      9, 18, 1, on],
  // G185: 'cutout' — the trailing edge cut back over the cockpit
  ['wgCentre', 'centre section', 0, 3, 1, ['solid', 'glass', 'open', 'cutout'],
   { when: P => +P.wingOn && [0, 3].includes(Math.round(P.wgPos)) }],
  ['wgPanels', 'spar stations',  2, 5, 1, on],
  // THE WING'S OWN CONSTRUCTION (G110): 0 follows the aeroplane's `intCons`,
  // 1..4 pin what THIS surface is built from — the structure grammar and the
  // livery's auto-finish bottom-out both read it (carbon wings on a wooden
  // fuselage is these two rows). AND THE STRUCTURE IS THE MATERIAL'S
  // (G116 mass + price, G117 stiffness + damping — "WYSIWYG is the rule"):
  // the join writes `wing.material` and the lattice builds the wing's
  // members from it, weight, cost, flex and all. See genLattice's note.
  ['wgCons', 'construction', 0, 4, 1,
   ['as the aeroplane', 'composite', 'steel tube', 'plywood', 'aluminium'],
   on],
  ['wgDx',     'fore / aft',       -1.5, 1.8, 0.05, on],
  ['wgDy',     'up / down',         -1.0, 1.0, 0.02, on],
  ['wgParaH',  'height (cabane)',    0.25, 1.20, 0.01,
   { when: P => +P.wingOn && Math.round(P.wgPos) === 3, dim: 'm' }],
  ['struts & fixation', [
    // G185: a biplane has no fuselage lift-strut fan (the truss braces it),
    // so the row steps aside when the second plane is on
    ['wgBrace', 'fixation',      0, 1, 1, ['lift struts', 'cantilever'],
     { when: P => +P.wingOn && !+P.w2On }],
    // G86/G87, user: "sliders ... to control the exact placement fore/aft
    // and lateral", then "constrained to the wing chord ... excluding the
    // leading edge and the control surface ... the fore/aft position of both
    // ends need to be similar". Both are METRES off the site the structure
    // picks, and both are bounded so the drawn fittings stay on the beams
    // they stand for:
    //   fore/aft  moves the foot AND both wing fittings together, so the
    //             strut stays straight. Its usable range is the wing's own
    //             structural chord and is CLAMPED per build — the range here
    //             is the widest chord's, and a narrow wing stops sooner and
    //             says so in the status line.
    //   lateral   moves only the foot, as ARC LENGTH around the section
    //             (never an angle: see _strut_gen.js).
    ['wgStrutZ', 'fore / aft', -0.20, 0.20, 0.01,
     { when: P => +P.wingOn && !Math.round(P.wgBrace), dim: 'm' }],
    ['wgStrutX', 'in / out (foot)',   -0.25, 0.35, 0.01,
     { when: P => +P.wingOn && !Math.round(P.wgBrace), dim: 'm' }],
  ], on],
  ['control surfaces', [
    ['wgFlapType', 'flaps',      0, FLAP_KEYS.length - 1, 1,
     FLAP_KEYS.map(k => GEN_FLAPS[k].name)],
    ['wgFlapSpan', 'flap span',  0.10, 0.60, 0.02,
     { when: P => FLAP_KEYS[Math.round(P.wgFlapType)] !== 'none' }],
    ['wgFlapChord', 'flap chord', 0.10, 0.40, 0.01,
     { when: P => FLAP_KEYS[Math.round(P.wgFlapType)] !== 'none' }],
    ['wgAilOn', 'ailerons', 0, 1, 1],
    ['wgAilSpan', 'ail. span',   0.15, 0.55, 0.01, { when: P => +P.wgAilOn }],
    ['wgAilChord', 'ail. chord', 0.10, 0.35, 0.01, { when: P => +P.wgAilOn }],
  ], 'open', on],
];
// G185: THE SECOND PLANE'S ROWS, GENERATED from the first's — the same
// labels, ranges and steps, the keys re-prefixed, every `when` ANDed with
// the second-plane switch. A row added to the first plane lands on both.
// Dropped: the master switch, the fuselage-strut rows and the fore/aft
// nudge (the second plane's fore/aft IS its stagger); added: its position
// band, its cabane height, its stagger and its aileron switch.
const W2_DROP = new Set(['wingOn', 'wgPos', 'wgBrace', 'wgStrutZ', 'wgStrutX',
                         'wgDx', 'wgParaH']);
const w2Key = k => 'w2' + k.slice(2);
const w2On = P => +P.wingOn && +P.w2On;
const w2When = f => P => w2On(P) && (!f || f(new Proxy(P, {
  // the first plane's `when`s read wg* keys; the second plane's rows answer
  // with their own values under those names
  get: (t, k) => (typeof k === 'string' && /^wg[A-Z]/.test(k)) ? t[w2Key(k)] : t[k] })));
const w2Row = it => {
  if (Array.isArray(it[1])) {                 // a nested group
    const last = it[it.length - 1];
    const opts = (last && typeof last === 'object' && !Array.isArray(last)) ? last : null;
    const rows = it[1].map(w2Row).filter(Boolean);
    return rows.length ? [it[0], rows, ...(it.includes('open') ? ['open'] : []),
                          Object.assign({}, opts || {}, { when: w2When(opts && opts.when) })] : null;
  }
  if (W2_DROP.has(it[0])) return null;
  const out = it.slice();
  out[0] = w2Key(it[0]);
  const last = out[out.length - 1];
  const opts = (last && typeof last === 'object' && !Array.isArray(last)) ? last : null;
  const o2 = Object.assign({}, opts || {}, { when: w2When(opts && opts.when) });
  if (opts) out[out.length - 1] = o2; else out.push(o2);
  return out;
};
const W2_ITEMS = [
  ['w2On', 'second wing', 0, 1, 1, on],
  ['w2Pos', 'position', 0, 2, 1, ['parasol', 'mid wing', 'low wing'], { when: w2On }],
  ['w2ParaH', 'height (cabane)', 0.25, 1.20, 0.01,
   { when: P => w2On(P) && Math.round(P.w2Pos) === 0, dim: 'm' }],
  ['w2Stagger', 'fore / aft (stagger)', -1.00, 1.00, 0.02, { when: w2On, dim: 'm' }],
  ['w2Dy', 'up / down', -1.0, 1.0, 0.02, { when: w2On }],
  ...WING_ITEMS.map(w2Row).filter(Boolean),
];
const host6 = (PAGE.groupsOverride || []).find(g => g[0] === '6 · wings');
if (host6) host6[1].push(...WING_ITEMS, ['second wing', W2_ITEMS, { when: P => +P.wingOn }]);
else (PAGE.groupsOverride || (PAGE.groups = PAGE.groups || []))
  .push(['6 · wings', WING_ITEMS.concat([['second wing', W2_ITEMS, { when: P => +P.wingOn }]])]);

// ---- materials ------------------------------------------------------------
// EVERY PART ITS OWN COLOUR (user, G31/G32): the MAIN wing skin wears the
// fuselage's own grey (SEC.body), and the regions that are their own
// ideas wear their own — tips, centre section, ailerons, flaps, struts,
// pitot. The glass centre takes the glazing treatment (translucent,
// never occluding), riding the view panel's glass alpha.
const D2 = THREE.DoubleSide;
const mk = (c, met, rgh) => new THREE.MeshStandardMaterial({
  color: c, metalness: met, roughness: rgh, side: D2 });
const COLS = {
  // THE CHECK IS DONE (G62.3). G38 put the WAISTBAND'S OWN PINK (#cc12a8) on
  // the wing so wing-vs-body shading could be compared on one colour, and left
  // a note to revert to the body grey when it was over. It was not reverted,
  // and it cost a diagnosis: an 8.4 m magenta wing sitting a metre under the
  // environment probe tinted the WHOLE SHED through scene.environment. Back to
  // SEC.body, which is what the paragraph above says the main skin wears.
  main:  0x8b95a2,
  tip:   0xa85fb0,
  centre: 0x3f8fc0,
  ailR: 0xcc7a1f, ailL: 0xcc7a1f,
  flapR: 0x4f9e4f, flapL: 0x4f9e4f,
  liftstrut: 0x8fa3b8,
  pitot: 0x7d8792,
  glassC: 0x9fc6e0,
};
const MAT = {
  main:  mk(COLS.main, 0.05, 0.55),
  tip:   mk(COLS.tip, 0.05, 0.55),
  centre: mk(COLS.centre, 0.05, 0.55),
  ailR:  mk(COLS.ailR, 0.05, 0.55),
  ailL:  mk(COLS.ailL, 0.05, 0.55),
  flapR: mk(COLS.flapR, 0.05, 0.55),
  flapL: mk(COLS.flapL, 0.05, 0.55),
  liftstrut: mk(COLS.liftstrut, 0.45, 0.35),
  pitot: mk(COLS.pitot, 0.45, 0.42),
};
const glassMat = () => {
  const a = (window.CAGE_VIEW && window.CAGE_VIEW.glassA != null)
    ? window.CAGE_VIEW.glassA : 0.35;
  return new THREE.MeshStandardMaterial({
    color: COLS.glassC, metalness: 0.05, roughness: 0.15, side: D2,
    transparent: true, opacity: a, depthWrite: false });
};
// AEROSKIN ON THE WING (G68.1). The same factory the fuselage uses, so the
// wing cannot drift from the body it is bolted to — which is the whole point
// of there being one factory. It takes the CONSTRUCTION's own finish and its
// structure grammar, with `wing: 1` switching the grammar's members from a
// metric pitch to the wing's real ribs and spars: a rib is an integer station
// and a spar is an integer rail, and the field carries both.
//
// Falls back to the bench's own flat palette when AEROSKIN is not loaded, so
// a standalone _cage*.html page with no src/viewer on it still builds.
// which LIVERY SECTION each wing class draws as (AEROSKIN's AERO_SEC): the
// skin and centre are the wing, the tips and each control-surface pair are
// their own overridable rows, and every one of them FOLLOWS the wing (which
// follows the fuselage) until the builder says otherwise. G31's diagnostic
// tints (purple tip, orange ailerons) do NOT ride into the material view any
// more — that was the G70-owed leak, and the per-part rows are its answer.
const CLSEC = { main: 'wingSkin', centre: 'wingSkin', tip: 'wingTip',
                ailR: 'wingAil', ailL: 'wingAil',
                flapR: 'wingFlap', flapL: 'wingFlap' };
// G185: the second plane's classes map to its own livery sections
const CLSEC2 = { main: 'wingSkin2', centre: 'wingSkin2', tip: 'wingTip2',
                 ailR: 'wingAil2', ailL: 'wingAil2',
                 flapR: 'wingFlap2', flapL: 'wingFlap2' };
function wingMat(cl, plane) {
  const A = (typeof window !== 'undefined' && window.AEROSKIN) || null;
  const P0 = (window.CAGE_UI && window.CAGE_UI.P) || {};
  const on = document.getElementById('mat');
  if (!A || !on || on.value !== 'material') return MAT[cl] || MAT.main;
  // the part's own construction wins over the aeroplane's (wgCons, G110);
  // the ailerons and flaps take the wing's because this one function
  // dresses every class
  const CONS4 = ['carbon', 'tubeFabric', 'wood', 'alloy'];
  const kc = Math.round((plane ? P0.w2Cons : P0.wgCons) || 0);
  const cons = kc > 0 ? CONS4[kc - 1]
    : CONS4[Math.max(0, Math.min(3, Math.round(P0.intCons || 0)))] ||
      'tubeFabric';
  // the editor's per-part livery, when its UI is on the page; the direct
  // factory call below stays as the standalone bench's path
  if (window.CAGE_SECMAT) {
    const m = window.CAGE_SECMAT((plane ? CLSEC2 : CLSEC)[cl] || (plane ? 'wingSkin2' : 'wingSkin'), {
      cons, struct: 1, wing: 1,
      surf: 1, fieldM: 1,        // the wing's field is ALREADY in metres
      side: THREE.DoubleSide });
    if (!m) return null;
    if (!plane) return m;
    // THE SECOND PLANE'S MATERIAL IS ITS OWN OBJECT. AEROSKIN pools on LOOK,
    // and a second plane dressed like the first would come back as the very
    // same material — the join would then bucket both skins together and
    // the game bind them as one (measured: the second skin bound nothing).
    // A clone shares the shader and carries the plane on its userData, which
    // is what the join's bucket key and the game's binding read.
    const m2 = m.clone();
    m2.userData = Object.assign({}, m.userData, { aeroPlane: 2 });
    return m2;
  }
  return A.aeroMaterial(THREE, {
    finish: A.aeroFinishFor('body', cons),
    grm: cons, struct: 1, wing: 1,
    surf: 1, fieldM: 1,          // the wing's field is ALREADY in metres
    side: THREE.DoubleSide,
  });
}

const wireMats = {};
const wireMat = nm => wireMats[nm] ||
  (wireMats[nm] = new THREE.LineBasicMaterial({ color: COLS[nm] || 0x8b95a2 }));

// ---- helpers --------------------------------------------------------------
// invert the game's rest transform: sample it at basis points, solve the
// affine back to the body frame (exact — the transform is affine)
function bodyFrameOf(def) {
  const to = genRestFrame(def).to;
  const o = to([0, 0, 0]);
  const c = [to([1, 0, 0]), to([0, 1, 0]), to([0, 0, 1])]
    .map(p => [p[0] - o[0], p[1] - o[1], p[2] - o[2]]);
  // 3x3 inverse (columns c[0..2])
  const m = [c[0][0], c[1][0], c[2][0],
             c[0][1], c[1][1], c[2][1],
             c[0][2], c[1][2], c[2][2]];
  const det = m[0]*(m[4]*m[8]-m[5]*m[7]) - m[1]*(m[3]*m[8]-m[5]*m[6])
            + m[2]*(m[3]*m[7]-m[4]*m[6]);
  const iv = [
    (m[4]*m[8]-m[5]*m[7])/det, (m[2]*m[7]-m[1]*m[8])/det, (m[1]*m[5]-m[2]*m[4])/det,
    (m[5]*m[6]-m[3]*m[8])/det, (m[0]*m[8]-m[2]*m[6])/det, (m[2]*m[3]-m[0]*m[5])/det,
    (m[3]*m[7]-m[4]*m[6])/det, (m[1]*m[6]-m[0]*m[7])/det, (m[0]*m[4]-m[1]*m[3])/det,
  ];
  return p => {
    const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
    return [iv[0]*d[0] + iv[1]*d[1] + iv[2]*d[2],
            iv[3]*d[0] + iv[4]*d[1] + iv[5]*d[2],
            iv[6]*d[0] + iv[7]*d[1] + iv[8]*d[2]];
  };
}

// a group subset -> THREE geometries by CLASS, keeping primitives whose
// verts pass `keep`. genMesh emits every quad as the tri pair
// [a,b,c],[a,c,d] — detected here so the wireframe draws QUAD edges (the
// page's own ruling: the wireframe shows topology, not triangulation)
// and the classifier sees whole primitives.
// `field(i)` -> the four numbers of THE SURFACE FIELD (G66) for source
// vertex i, or null. The wing's is built in wingField() below; everything
// else passes nothing and takes the shader's triplanar branch.
function pickParts(g, keep, toCage, classOf, field) {
  const nv = g.nv, ok = new Uint8Array(nv);
  for (let i = 0; i < nv; i++) ok[i] = keep(i) ? 1 : 0;
  const out = {};                     // class -> {map,pos,idx,wpos,eseen}
  const bucket = cl => out[cl] || (out[cl] = {
    map: new Int32Array(nv).fill(-1), pos: [], idx: [],
    wpos: [], eseen: new Set(), fld: field ? [] : null });
  const raw = i => [g.pos[i*3], g.pos[i*3+1], g.pos[i*3+2]];
  const vtx = (B2, i) => {
    if (B2.map[i] < 0) {
      const p = toCage(raw(i));
      B2.map[i] = B2.pos.length / 3;
      B2.pos.push(p[0], p[1], p[2]);
      if (B2.fld) {
        const a = field(i) || [0, 0, 0, 0];
        B2.fld.push(a[0], a[1], a[2], a[3]);
      }
    }
    return B2.map[i];
  };
  const edge = (B2, a, b) => {
    const key = a < b ? a + '_' + b : b + '_' + a;
    if (B2.eseen.has(key)) return;
    B2.eseen.add(key);
    const A = toCage(raw(a)), C = toCage(raw(b));
    B2.wpos.push(A[0], A[1], A[2], C[0], C[1], C[2]);
  };
  const idxA = g.idx;
  for (let t = 0; t < idxA.length; ) {
    const a = idxA[t], b = idxA[t+1], c = idxA[t+2];
    // the quad pair: [a,b,c] followed by [a,c,d]
    const isQuad = t + 5 < idxA.length &&
      idxA[t+3] === a && idxA[t+4] === c;
    const vs = isQuad ? [a, b, c, idxA[t+5]] : [a, b, c];
    t += isQuad ? 6 : 3;
    if (vs.some(i => !ok[i])) continue;
    const cen = [0, 0, 0];
    for (const i of vs) {
      const p = raw(i);
      cen[0] += p[0] / vs.length; cen[1] += p[1] / vs.length;
      cen[2] += p[2] / vs.length;
    }
    const B2 = bucket(classOf ? classOf(cen, vs) : 'x');
    if (isQuad) {
      const q = vs.map(i => vtx(B2, i));
      B2.idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
    } else B2.idx.push(vtx(B2, vs[0]), vtx(B2, vs[1]), vtx(B2, vs[2]));
    for (let k = 0; k < vs.length; k++)
      edge(B2, vs[k], vs[(k + 1) % vs.length]);
  }
  const res = {};
  for (const cl in out) {
    const B2 = out[cl];
    if (!B2.idx.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(B2.pos), 3));
    if (B2.fld) geo.setAttribute('aStruct',
      new THREE.BufferAttribute(new Float32Array(B2.fld), 4));
    geo.setIndex(B2.idx);
    geo.computeVertexNormals();
    const wire = new THREE.BufferGeometry();
    wire.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(B2.wpos), 3));
    res[cl] = { geo, wire };
  }
  return res;
}

// ---- the build ------------------------------------------------------------
let group = null;
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};

const prevPost = PAGE.post;
let boomGroup = null;                        // the twin booms (2026-09-04)
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  const { scene, spec, mesh, P, stat } = ctx;
  dispose(group); group = null;
  // G133: no wing, no contract — a stale CAGE_WING would hand the gear
  // layer an underside probe for a wing that is no longer there
  if (!P.wingOn) { window.CAGE_WING = null; return; }
  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);

  // the game spec: defaults + the panel's wing — everything else rides
  // the generator's own defaults (its fuselage is built and discarded;
  // only the wing subset is kept). The NACA digits and the tip chord
  // compose exactly as the garage's own @ knobs do.
  // G59.2: the airframe contract, hoisted — the frame this layer builds
  // needs the BUILT cabin, not the generator's default one (see below).
  const AF = GG && GG.cageAirframe ? GG.cageAirframe(mesh, FS) : null;
  const cam = Math.round(P.wgCamber), thk = Math.round(P.wgThick);
  // G185: the second plane's spec, from its own rows (the join writes the
  // same fields — _join_check holds the mapping)
  const w2SpecOf = () => {
    const c2 = Math.round(P.w2Camber), t2 = Math.round(P.w2Thick);
    return {
      span: P.w2Span, chord: P.w2Chord,
      taper: Math.max(0.2, Math.min(1.0, P.w2ChordTip / Math.max(0.2, P.w2Chord))),
      tipX: +P.w2TipX || 0,
      dihedral: P.w2Dihedral, incidence: P.w2Incidence, washout: P.w2Washout,
      naca: c2 * 1000 + (c2 > 0 ? 400 : 0) + t2,
      panels: Math.round(P.w2Panels),
      position: ['parasol', 'mid', 'low'][Math.round(P.w2Pos)] || 'low',
      cabaneH: Math.round(P.w2Pos) === 0 ? (+P.w2ParaH || 0.45) : null,
      stagger: +P.w2Stagger || 0,
      place: { dx: 0, dy: +P.w2Dy || 0 },
      tip: TIP_KEYS[Math.round(P.w2Tip)] || 'rounded',
      crankAt: P.w2CrankAt > 0 ? P.w2CrankAt : 0,
      crankChord: P.w2CrankAt > 0 ? +P.w2CrankChord : null,
      crankX: P.w2CrankAt > 0 ? (+P.w2CrankX || 0) : null,
      dihedralOut: P.w2CrankAt > 0 ? P.w2DihedralOut : null,
      centre: ['solid', 'glass', 'open', 'cutout'][Math.round(P.w2Centre)] || 'solid',
      controls: {
        flap: { type: FLAP_KEYS[Math.round(P.w2FlapType)] || 'none',
                span: P.w2FlapSpan, chord: P.w2FlapChord },
        aileron: { span: +P.w2AilOn ? P.w2AilSpan : 0, chord: P.w2AilChord },
      },
      ...(Math.round(P.w2Cons) > 0
        ? { material: ['carbon', 'tubeFabric', 'wood', 'alloy'][Math.round(P.w2Cons) - 1] } : {}),
    };
  };
  const gspec = {
    wings: [{
      span: P.wgSpan, chord: P.wgChord,
      taper: Math.max(0.2, Math.min(1.0,
        P.wgChordTip / Math.max(0.2, P.wgChord))),
      // G140: the stations, explicit — tipX 0 is a real value (straight),
      // sweep is never written; the resolved wing derives sweepEff for
      // the polar from what the stations actually do
      tipX: +P.wgTipX || 0,
      dihedral: P.wgDihedral, incidence: P.wgIncidence,
      washout: P.wgWashout,
      naca: cam * 1000 + (cam > 0 ? 400 : 0) + thk,
      panels: Math.round(P.wgPanels),
      position: ['high', 'mid', 'low', 'parasol'][Math.round(P.wgPos)] || 'high',
      cabaneH: Math.round(P.wgPos) === 3 ? (+P.wgParaH || 0.45) : null,
      tip: TIP_KEYS[Math.round(P.wgTip)] || 'rounded',
      crankAt: P.wgCrankAt > 0 ? P.wgCrankAt : 0,
      crankChord: P.wgCrankAt > 0 ? +P.wgCrankChord : null,
      crankX: P.wgCrankAt > 0 ? (+P.wgCrankX || 0) : null,
      dihedralOut: P.wgCrankAt > 0 ? P.wgDihedralOut : null,
      centre: ['solid', 'glass', 'open', 'cutout'][Math.round(P.wgCentre)] || 'solid',
      // G189: the lamp bay's two edges as loft stations, so the cut is the
      // width asked for (the same declaration the bay below resolves)
      cuts: wingCutsOf(P),
    }, ...(+P.w2On ? [w2SpecOf()] : [])],
    bracing: { type: Math.round(P.wgBrace) ? 'cantilever' : 'strut',
               cabane: Math.round(P.bpCabane || 0) ? 'V' : 'N',
               // G185: the biplane's truss, from the brace layer's rows
               ...(+P.w2On ? { interplane: ['N', 'I', 'none'][Math.round(P.bpInter || 0)] || 'N',
                               interplaneAt: +P.bpInterAt || 0.62,
                               wires: ['none', 'both', 'flying'][Math.round(P.bpWires == null ? 1 : P.bpWires)] || 'both' }
                           : {}) },
    controls: {
      flap: { type: FLAP_KEYS[Math.round(P.wgFlapType)] || 'none',
              span: P.wgFlapSpan, chord: P.wgFlapChord },
      aileron: { span: (P.wgAilOn == null || +P.wgAilOn) ? P.wgAilSpan : 0,
                 chord: P.wgAilChord },
    },
  };
  // THE STRUT LANDS ON THE BUILT CABIN (G59.2, user: "the wing struts do
  // not land where they should... the reference for hook points should be
  // the internal structure"). The comment above is the bug: with only the
  // wing rows, the frame drawn here carries the GENERATOR'S DEFAULT cabin
  // (halfW 0.36) while the built one measured 0.59 — so the lift strut's
  // foot hung 0.23 m inboard and 0.19 m above the cabin's own lower
  // longeron, attached to nothing. Measured off the same airframe contract
  // the gear and the join use, so all three agree.
  if (AF) {
    const zc0 = (spec && spec.ring && spec.ring.z != null ? spec.ring.z : 2.0) * FS;
    const zs0 = Math.max(AF.z0 + 0.05, Math.min(AF.z1 - 0.05, zc0 - 0.3));
    const hw0 = AF.halfWAt(zs0);
    const hh0 = AF.surf(zs0, Math.PI)[1] - AF.surf(zs0, 0)[1];
    if (hw0 > 0.05 && hh0 > 0.2) gspec.cabin = { halfW: hw0, h: hh0 };
  }
  let def, pay;
  try {
    const RS = resolveSpec(gspec);        // -> {spec, auto}
    const fr = genFrame(RS.spec);
    def = Object.assign({ spec: RS.spec }, fr);
    // G67.1: the WING, not the whole aeroplane. This asked genSkin for a
    // complete aircraft and threw all of it away but the wing — which is
    // also what kept the old generated skin alive long after the cage had
    // replaced every other part of it.
    pay = genWing(def);
  } catch (e) {
    if (stat) stat.textContent += '  ·  wing: ' + e.message;
    return;
  }
  const N2 = def.nodes, wf = def.parts.wf;
  const WN = new Set();
  for (const side of [wf.L, wf.R]) if (side)
    for (const arr of [side.F, side.R]) if (arr)
      for (const i of arr) WN.add(i);
  if (!WN.size) { if (stat) stat.textContent += '  ·  wing: no spar nodes'; return; }

  const toBody = bodyFrameOf(def);
  // anchors: root LE at the cage's cabin-front station, root height on
  // the deck (high) / keel band (low) — the fin's own anchoring move,
  // read through the gear module's airframe contract
  // def nodes are already body-frame — only the EMITTED skin went through
  // the rest transform, which is what toBody undoes per vertex
  const rootF = wf.R && wf.R.F && wf.R.F.length ? wf.R.F[0] : null;
  const refP = rootF != null ? N2[rootF].p : [0, 0, 0];
  const S2 = spec || {};
  const zCab = (S2.ring && S2.ring.z != null ? S2.ring.z : 2.0) * FS;
  let yAnchor = refP[1];
  if (AF) {
    const zs = Math.max(AF.z0 + 0.05, Math.min(AF.z1 - 0.05, zCab - 0.3));
    const deckY = AF.surf(zs, Math.PI)[1];
    const keelY = AF.surf(zs, 0)[1];
    const pos = Math.round(P.wgPos);
    yAnchor = pos === 2 ? keelY + 0.22 * (deckY - keelY)  // low: belly band
      : pos === 1 ? keelY + 0.55 * (deckY - keelY)        // mid: the waist
      : pos === 3 ? deckY + 0.01 + (+P.wgParaH || 0.45)   // parasol: the cabane
      : deckY + 0.01;                                     // high: the deck
  }
  const dx = P.wgDx || 0, dy = P.wgDy || 0;
  // body (x aft, z lateral) -> cage (z forward, x lateral, y shared)
  const toCage = p0 => {
    const p = toBody(p0);
    return [p[2],
            yAnchor + (p[1] - refP[1]) + dy,
            zCab - (p[0] - refP[0]) + dx];
  };

  // wing verts bind to spar nodes ONLY; a face is wing iff all its verts do
  const G_INFL = typeof GEN_INFL === 'number' ? GEN_INFL : 4;
  const wingVert = g => i => {
    let any = false;
    for (let k = 0; k < G_INFL; k++) {
      const w = g.ww[i * G_INFL + k];
      if (w > 1e-6) {
        if (!WN.has(g.wi[i * G_INFL + k])) return false;
        any = true;
      }
    }
    return any;
  };

  group = new THREE.Group();
  // NAMED for the editor (G76/G77): the part table says which layer a
  // part lives in, and G79's raycast resolves a hit to a part through
  // that. One string, no behaviour.
  group.name = 'cageLayer:wing';
  const WIRE = !!(document.getElementById('wire') &&
                  document.getElementById('wire').checked);
  const ex = Math.max(0, P.explodeD || 0) * FS;
  const add = (parts, cl, mat, offset) => {
    const pr = parts && parts[cl];
    if (!pr) return null;
    const o = WIRE ? new THREE.LineSegments(pr.wire, wireMat(cl === 'x' ? '' : cl))
                   : new THREE.Mesh(pr.geo, mat);
    if (offset) o.position.set(offset[0], offset[1], offset[2]);
    group.add(o);
    return pr;
  };
  const gs = pay.groups;
  let faces = 0;
  // the skin splits into MAIN / CENTRE SECTION / TIPS by station (body
  // |z| against the root station and the tip bow's start)
  const zRoot = def.parts.zRoot || 0;
  const W2 = def.spec.wing || {};
  const tipOn = (W2.tipR || 0) > 1e-6;
  const tipZ = tipOn ? W2.tipZ : Infinity;
  // ---- THE WING'S SURFACE FIELD (G68.1) ----------------------------------
  // The same four numbers the cage carries (G66), read off the wing's own
  // structure rather than a lattice — and the MEANING is preserved exactly,
  // which is what lets one shader draw both:
  //
  //   .x  sL  metres SPANWISE from the root      (ribs are spaced along it)
  //   .y  sC  metres CHORDWISE from the LE       (spars run along it)
  //   .z  st  station: INTEGER AT EVERY RIB      (fraction between)
  //   .w  lv  rail:    0 at the FRONT SPAR, 1 at the REAR SPAR
  //
  // So a rib is an integer station and a spar is an integer rail, exactly as
  // a bulkhead and a longeron are on the fuselage. The leading edge falls at
  // lv ~= -0.3 and the trailing edge at ~1.7, because the spars are at 0.15
  // and 0.65 chord and the coordinate is linear in chord.
  //
  // THE RIB STATIONS ARE THE ONES THE MASS MODEL PAID FOR. `parts.ribZ`
  // (G66) is emitted by 61_gen_frame.js from its own "one rib every 0.4 m"
  // rule — the same rule that bills their mass. garage.js used to carry
  // GEN_RIBS = 13, right for the default Cub's semispan and wrong for every
  // other, and the tapes drifted off the ribs on any other wing.
  //
  // genSkin's PANEL uv is where chord and span come from: u is the chord
  // fraction (0 at the LE) and v is 0.53 + 0.44 * spanFraction — that zone
  // contract is declared in 63_gen_skin.js and has not moved since G5.
  const PT = def.parts || {};
  // DEDUPED, and it matters: genLattice walks the spar panels once per side,
  // so every rib station appears TWICE in the list. Sorted-with-duplicates
  // the walk below counts two stations per rib and the tapes come out at
  // HALF the real pitch — 0.18 m instead of the 0.367 m the mass model
  // billed. Measured on the stock wing: st ran 0..22 where there are 11 ribs.
  const ribZ = (PT.ribZ || []).slice().sort((a, b) => a - b)
    .filter((z, i, A) => i === 0 || z - A[i - 1] > 1e-4);
  const sparF = PT.sparFront != null ? PT.sparFront : 0.15;
  const sparR = PT.sparRear != null ? PT.sparRear : 0.65;
  const sparSpan = Math.max(1e-4, sparR - sparF);
  const wingField = g => {
    if (!g.uv) return null;
    return i => {
      const cf = g.uv[i * 2];                        // chord fraction, 0 = LE
      const az = Math.abs(toBody(
        [g.pos[i*3], g.pos[i*3+1], g.pos[i*3+2]])[2]);
      const chord = PT.chordAt ? PT.chordAt(az) : 1;
      // st: which rib bay, and where inside it. Ribs are NOT evenly spaced
      // across the whole span — 61_gen_frame divides each panel separately —
      // so this walks the real list rather than dividing by a mean pitch.
      let st = 0;
      if (ribZ.length) {
        let k = 0;
        while (k < ribZ.length && ribZ[k] < az) k++;
        const lo = k > 0 ? ribZ[k - 1] : zRoot;
        const hi = k < ribZ.length ? ribZ[k] : ribZ[ribZ.length - 1];
        const d = hi - lo;
        st = k + (d > 1e-6 ? (az - hi) / d : 0);
      }
      return [az - zRoot, cf * chord, st, (cf - sparF) / sparSpan];
    };
  };

  // ---- THE LANDING-LIGHT BAY (G96) ---------------------------------------
  // THE WING IS REALLY CUT, and along its own geometry: the bay is a band of
  // the D-NOSE — forward of the front spar, between two stations — and the
  // faces in it are not drawn as covering at all. What goes in the hole is
  // THE SAME FACES, re-drawn as glass, which is why the lens follows the
  // profile exactly and cannot come adrift when the aerofoil, the taper or
  // the washout moves: it IS the wing's surface, in a different material.
  //
  // The bay is declared by the LIGHT layer (window.CAGE_LIGHT_BAY) because
  // that layer has to put a lamp in the hole this one makes. Two descriptions
  // of one bay would be a lamp behind solid skin.
  // resolved against the panel FIRST — this layer runs before the light
  // layer's own build, so reading the declaration raw gets the defaults
  if (typeof window !== 'undefined' && window.CAGE_BAY_FROM_P && window.CAGE_UI)
    window.CAGE_BAY_FROM_P(window.CAGE_UI.P);
  const BAY = (typeof window !== 'undefined' && window.CAGE_LIGHT_BAY) || null;
  // THE BAY IS CUT WHEN THE LAMP IS FITTED, NOT WHEN IT IS SWITCHED ON (G98,
  // user: "it appears only when I turn some lights on"). A landing light is a
  // hole in the wing whether or not anybody has flicked the switch — gating
  // the geometry on the switch made the wing change shape when you turned the
  // light on, which is a thing no aeroplane does.
  const bayOn = !!(BAY && window.CAGE_UI && +window.CAGE_UI.P.lightOn);
  const semiW = (def.spec.geom && def.spec.geom.semi) || 5;
  const bayZ = semiW * (BAY ? BAY.frac : 0.24);
  const uOf = vs => {
    const g2 = gs.skin;
    if (!g2 || !g2.uv) return 1;
    let u = 0;
    for (const i of vs) u += g2.uv[i * 2] / vs.length;
    return u;                            // chord fraction, 0 at the LE
  };
  // THE CUT SNAPS TO THE WING'S OWN ROWS, and that is the user's instruction
  // ("preferably along existing geometry") arriving as an arithmetic fact
  // rather than a preference. A wing is LOFTED at discrete spanwise stations,
  // so the face centroids form a discrete set; a metre-wide band asked for a
  // cut BETWEEN two rows and got nothing at all — 500 faces passed the chord
  // test, none passed the span test, and the bay came out empty with every
  // number in it correct.
  //
  // So the rows are collected first and the bay takes the nearest ones. The
  // cut then follows edges the loft already has, which is the only way the
  // lens can share the covering's vertices exactly.
  let bayAt = null;
  const bayRows = (() => {
    if (!bayOn || !gs.skin) return null;
    const g2 = gs.skin, idxA = g2.idx, seen = new Map();
    const raw2 = i => [g2.pos[i*3], g2.pos[i*3+1], g2.pos[i*3+2]];
    for (let t = 0; t < idxA.length; ) {
      const a2 = idxA[t], b2 = idxA[t+1], c2 = idxA[t+2];
      const isQ = t + 5 < idxA.length && idxA[t+3] === a2 && idxA[t+4] === c2;
      const vs2 = isQ ? [a2, b2, c2, idxA[t+5]] : [a2, b2, c2];
      t += isQ ? 6 : 3;
      const cen2 = [0, 0, 0];
      for (const i of vs2) { const p2 = raw2(i);
        cen2[0] += p2[0] / vs2.length; cen2[1] += p2[1] / vs2.length;
        cen2[2] += p2[2] / vs2.length; }
      const az2 = Math.abs(toBody(cen2)[2]);
      const k2 = Math.round(az2 * 1e4);
      if (!seen.has(k2)) seen.set(k2, az2);
    }
    const rows = [...seen.values()].sort((x, y) => x - y);
    if (!rows.length) return null;
    // the rows inside the declared band — at least one row, so the bay is
    // never empty. Since G189 the loft cuts a row at each EDGE of the band
    // (`cuts` on the wing spec, from this same declaration), so the face
    // rows between them are the band and nothing outside it: the width is
    // the width asked for, not the nearest whole loft strip.
    let best = rows[0];
    for (const r of rows) if (Math.abs(r - bayZ) < Math.abs(best - bayZ)) best = r;
    const keep = rows.filter(r => Math.abs(r - bayZ) <= BAY.half + 1e-6);
    const use = keep.length ? keep : [best];
    // THE STATION IT ACTUALLY SNAPPED TO, not the one it was asked for. The
    // light layer puts a lamp behind this bay and has to use the row the cut
    // landed on, or the two end up a subdivision apart.
    bayAt = use.reduce((t, r) => t + r, 0) / use.length;
    return new Set(use.map(r => Math.round(r * 1e4)));
  })();
  const skinClass = (cen, vs) => {
    const az = Math.abs(toBody(cen)[2]);
    // the bay first: it is a hole in whatever class it falls in
    // ONE BAY PER SIDE, not one spanning both (G98). The class used to be a
    // single 'lamp' collecting both wings, so its bound was centred on the
    // fuselage and a lamp placed from it landed on the centreline. Splitting
    // by the SIGN of the span coordinate gives each side its own hole, its own
    // lens and its own bound — and makes the two switchable apart, which the
    // single class could never be.
    if (bayRows && vs && bayRows.has(Math.round(az * 1e4)) &&
        uOf(vs) < BAY.chord)
      return toBody(cen)[2] >= 0 ? 'lampR' : 'lampL';
    if (az <= zRoot + 1e-3) return 'centre';
    if (tipOn && az >= tipZ - 1e-3) return 'tip';
    return 'main';
  };
  // THE LENS: the covering's own material family, made glass. Not the cabin
  // glazing — a landing-light lens is a thick clear moulding, not a window,
  // and it has to read as one when the lamp behind it is off.
  // ---- THE BAY'S INTERIOR CAGE (G98) --------------------------------------
  // A landing light does not open into the whole wing: it sits in a little
  // box with an AFT WALL and SIDE WALLS, and without one you look straight
  // through the aeroplane. `bayCage` below builds it — a quad and two ribs,
  // all three taken from the cut's own boundary, so the side walls carry the
  // aerofoil profile by construction and the whole thing follows the wing
  // when the wing changes. A hand-built box could not.
  // FLAGGED aeroskin, or the G38 understudy replaces it with flat grey and the
  // bay reads as a big pale trough instead of the dark box it is — which is
  // exactly how it first came out.
  const bayMat = () => {
    const m = new THREE.MeshStandardMaterial({
      color: 0x15171b, roughness: 0.42, metalness: 0.10,
      side: THREE.DoubleSide });
    m.userData.aeroskin = 1;
    return m;
  };
  // THE BAY'S CAGE IS A QUAD AND TWO PROFILES (G98, the user's own drawing:
  // "Mine is a quad, and 2 plane following the leading edge profile, and
  // done, no need for fancy").
  //
  // The first attempt offset every cut face inward along its own normal and
  // bridged the boundary — a shell. It was wrong twice over: on a band that
  // WRAPS THE LEADING EDGE the upper and lower offsets run at each other and
  // cross, and even where they do not, the result is a curved trough that
  // intersects the lamp. A lamp bay in a real wing is not a moulding. It is
  // the back of the D-nose closed off: a flat rib at each end cut to the
  // aerofoil, and a plate across the back of them.
  //
  // All three come from the cut's OWN BOUNDARY — the edges used once — so the
  // cage follows whatever the aerofoil, the taper and the washout are doing
  // without being told any of it.
  function bayCage(geo) {
    const src = geo.getAttribute('position'), idx = geo.getIndex();
    if (!src || !idx) return null;
    // WELD FIRST. pickParts hands back split vertices, and on split vertices
    // every edge is used once — the boundary test returns the whole mesh.
    const P = [], map = new Map(), wid = new Int32Array(src.count);
    for (let i = 0; i < src.count; i++) {
      const x = src.getX(i), y = src.getY(i), z = src.getZ(i);
      const k = (Math.round(x * 1e4)) + ',' + (Math.round(y * 1e4)) + ',' +
                (Math.round(z * 1e4));
      let id = map.get(k);
      if (id === undefined) { id = P.length; P.push([x, y, z]); map.set(k, id); }
      wid[i] = id;
    }
    const seen = new Map();
    const kk = (a, b) => a < b ? a + '_' + b : b + '_' + a;
    for (let t = 0; t + 2 < idx.count; t += 3) {
      const v = [wid[idx.getX(t)], wid[idx.getX(t + 1)], wid[idx.getX(t + 2)]];
      for (let k = 0; k < 3; k++) {
        const a = v[k], b = v[(k + 1) % 3], key = kk(a, b);
        const e = seen.get(key); if (e) e.n++; else seen.set(key, { a, b, n: 1 });
      }
    }
    const bnd = [];
    for (const e of seen.values()) if (e.n === 1) bnd.push(e);
    if (bnd.length < 4) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of P) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
                         if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    // AN EDGE IS EITHER SPANWISE OR IN A PROFILE, and which it is decides
    // which of the three walls it belongs to. Spanwise edges are the two aft
    // trims (upper and lower); profile edges are the two end ribs.
    const endI = new Set(), endO = new Set(), aftU = new Set(), aftL = new Set();
    for (const e of bnd) {
      const A = P[e.a], B = P[e.b];
      const dx = Math.abs(A[0] - B[0]);
      const dr = Math.hypot(A[1] - B[1], A[2] - B[2]);
      if (dx > dr) {                       // along the span: an aft trim
        const set = (A[1] + B[1]) / 2 > ym ? aftU : aftL;
        set.add(e.a); set.add(e.b);
      } else {                             // across the chord: an end rib
        const set = (A[0] + B[0]) / 2 < xm ? endI : endO;
        set.add(e.a); set.add(e.b);
      }
    }
    const pos = [], out = [];
    const put = q => { pos.push(q[0], q[1], q[2]); return pos.length / 3 - 1; };
    // --- the two ribs: the profile itself, filled ---------------------------
    // THE ORDER COMES FROM THE EDGES, NOT FROM AN ANGLE. The first fill
    // sorted the rib's vertices by their angle about the centroid and fanned
    // them, which assumes the profile is star-shaped about that point and
    // invents the ordering rather than reading it. A loft also repeats its
    // leading-edge SEAM vertex, and two coincident points share an angle, so
    // the fan emitted degenerate slivers. Chaining the boundary instead —
    // each rib is an open polyline, walked end to end, closed across the
    // chord, ear-clipped in its own plane — covers the rib exactly once with
    // no triangle that was not already implied by the cut.
    //
    // This is NOT what cured the moire the user reported; the inset below is.
    // Both were wrong, and fixing the triangulation first is what made that
    // visible.
    const chain = (verts, edges) => {
      const adj = new Map();
      for (const e of edges) {
        if (!verts.has(e.a) || !verts.has(e.b)) continue;
        (adj.get(e.a) || adj.set(e.a, []).get(e.a)).push(e.b);
        (adj.get(e.b) || adj.set(e.b, []).get(e.b)).push(e.a);
      }
      let start = -1;
      for (const [v, nb] of adj) if (nb.length === 1) { start = v; break; }
      if (start < 0) start = adj.keys().next().value;
      if (start === undefined) return [];
      const loop = [start], used = new Set();
      let cur = start, prev = -1;
      for (;;) {
        const nb = adj.get(cur) || [];
        let nx = -1;
        for (const v of nb) {
          const k = cur < v ? cur + '_' + v : v + '_' + cur;
          if (v !== prev && !used.has(k)) { nx = v; used.add(k); break; }
        }
        if (nx < 0 || nx === start) break;
        loop.push(nx); prev = cur; cur = nx;
      }
      return loop;
    };
    // ear clip on the (y, z) projection: an end rib sits on one loft station,
    // so x is all but constant across it and the profile is the shape
    const earClip = loop => {
      const tri = [], n = loop.length;
      if (n < 3) return tri;
      const A2 = i => [P[loop[i]][1], P[loop[i]][2]];
      let area = 0;
      for (let i = 0; i < n; i++) {
        const a = A2(i), b = A2((i + 1) % n);
        area += a[0] * b[1] - b[0] * a[1];
      }
      const idsL = [...Array(n).keys()];
      if (area < 0) idsL.reverse();
      const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) -
                              (a[1] - o[1]) * (b[0] - o[0]);
      const inside = (a, b, c, q) => cr(a, b, q) >= 0 && cr(b, c, q) >= 0 &&
                                     cr(c, a, q) >= 0;
      let guard = n * n + 16;
      while (idsL.length > 3 && guard-- > 0) {
        let cut = false;
        for (let k = 0; k < idsL.length; k++) {
          const i0 = idsL[(k + idsL.length - 1) % idsL.length];
          const i1 = idsL[k], i2 = idsL[(k + 1) % idsL.length];
          const a = A2(i0), b = A2(i1), c = A2(i2);
          if (cr(a, b, c) <= 0) continue;                 // reflex
          let clear = true;
          for (const j of idsL) {
            if (j === i0 || j === i1 || j === i2) continue;
            if (inside(a, b, c, A2(j))) { clear = false; break; }
          }
          if (!clear) continue;
          tri.push([loop[i0], loop[i1], loop[i2]]);
          idsL.splice(k, 1); cut = true; break;
        }
        if (!cut) break;
      }
      if (idsL.length === 3)
        tri.push([loop[idsL[0]], loop[idsL[1]], loop[idsL[2]]]);
      return tri;
    };
    const prof = bnd.filter(e => {
      const A = P[e.a], B = P[e.b];
      return Math.abs(A[0] - B[0]) <=
             Math.hypot(A[1] - B[1], A[2] - B[2]);
    });
    // AND EACH RIB IS SET IN A FEW MILLIMETRES. This is the fix for the
    // stipple the user reported twice — "overlapping faces on the interior
    // sides", then "we still have the moire ... try moving the interior face
    // outwards by a few mm". They were right, and the cause is not the rib's
    // triangulation at all: A RIB FILLS THE CUT'S END PLANE, AND THE WING
    // COVERING THAT CARRIES ON PAST THE CUT HAS FACES IN THAT SAME PLANE.
    // Two coplanar surfaces from two different meshes, and the depth buffer
    // cannot choose between them. No amount of care inside one of them helps;
    // it has to move. 3 mm into the bay — which is also where a rib
    // physically is, behind the skin rather than flush with the cut.
    const RIB_IN = 0.003;
    for (const set of [endI, endO]) {
      if (set.size < 3) continue;
      const loop = chain(set, prof);
      if (loop.length < 3) continue;
      const dx = set === endI ? RIB_IN : -RIB_IN;
      const local = new Map();
      const idOf = w2 => { let v = local.get(w2);
        if (v === undefined) {
          const q = P[w2];
          v = put([q[0] + dx, q[1], q[2]]);
          local.set(w2, v);
        }
        return v; };
      for (const t of earClip(loop))
        out.push(idOf(t[0]), idOf(t[1]), idOf(t[2]));
    }
    // --- the aft wall: one quad per loft row, upper trim to lower trim ------
    const line = set => [...set].map(i => P[i]).sort((a, b) => a[0] - b[0]);
    const U = line(aftU), L = line(aftL);
    if (U.length >= 2 && L.length >= 2) {
      const at = (arr, x) => {            // the trims share the loft's rows,
        let best = arr[0], bd = Infinity; // but never assume it — match by x
        for (const q of arr) { const d = Math.abs(q[0] - x);
                               if (d < bd) { bd = d; best = q; } }
        return best;
      };
      const xs = [...new Set(U.concat(L).map(q => q[0]))].sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i++) {
        const a = put(at(U, xs[i])), b = put(at(U, xs[i + 1]));
        const c = put(at(L, xs[i + 1])), d = put(at(L, xs[i]));
        out.push(a, b, c, a, c, d);
      }
    }
    if (!out.length) return null;
    const G = new THREE.BufferGeometry();
    G.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(pos), 3));
    G.setIndex(out);
    G.computeVertexNormals();
    return G;
  }
  // THE BAY'S OWN SECTION — the two branches of the aerofoil, per station.
  //
  // NOT SAMPLED AT MID-SPAN, and NOT BINNED. Both were tried and both came
  // back empty for the same underlying reason: A BAY IS ONE LOFT CELL. It has
  // two stations and no middle, so a mid-span filter matched nothing; and it
  // carries about a dozen points per station, so binning the chord put one
  // point in most bins and reported an aerofoil with no thickness.
  //
  // What it actually is: at each station, an UPPER branch and a LOWER branch,
  // each a polyline in (chord, height). Interpolate both at the chord you
  // care about and subtract. Exact, no resolution to choose, and it stays
  // right whether the bay spans one loft cell or ten — the consumer takes the
  // thinnest station, which is the room the lamp really has.
  function section(geo) {
    const src = geo.getAttribute('position');
    if (!src || !src.count) return null;
    const sta = new Map();
    for (let i = 0; i < src.count; i++) {
      const k = Math.round(src.getX(i) * 1e3);
      let a2 = sta.get(k);
      if (!a2) sta.set(k, a2 = []);
      a2.push([src.getZ(i), src.getY(i)]);
    }
    const out = [];
    for (const [k, pts] of sta) {
      let ym = 0;
      for (const q of pts) ym += q[1];
      ym /= pts.length;
      const byZ = (p2, q) => p2[0] - q[0];
      const up = pts.filter(q => q[1] >= ym).sort(byZ);
      const dn = pts.filter(q => q[1] < ym).sort(byZ);
      if (up.length < 2 || dn.length < 2) continue;
      // THE STATION CARRIES ITS OWN x, and it has to. A wing has DIHEDRAL, so
      // two stations of the same bay sit at different heights — 38 mm apart
      // on this aeroplane. Comparing them at a shared chord and keeping the
      // thinner reading described a section neither of them has. The consumer
      // interpolates BETWEEN them at the lamp's own station instead.
      out.push({ x: k / 1e3, up, dn });
    }
    return out.length ? out : null;
  }
  // THE LENS IS THE AEROPLANE'S OWN GLASS (the user: "issue with the wing
  // `cut lamps` material ... Can we just use the same glass shader as the
  // rest?"). It was a hand-rolled MeshStandardMaterial — 0.34 alpha, no
  // clearcoat, no glazing dials — on the argument that "a landing-light lens
  // is a thick clear moulding, not a window". That argument is SUPERSEDED,
  // and it was costing two things, not one taste:
  //
  //   1. IT WAS NOT GLASS IN FLIGHT AT ALL. The snapshot records a group's
  //      finish from `userData.aeroFinish`, and a hand-rolled material has
  //      none — so the flown aeroplane rebuilt the lens through
  //      `aeroMaterial` instead of `aeroGlass`. The editor and the game were
  //      drawing two different materials for one part, which is the exact
  //      failure G108 closed everywhere else ("there is one factory, and both
  //      worlds call it").
  //   2. It was DoubleSide, so the far pane of the band showed through the
  //      near one — the same phantom limb the cabin glazing went FrontSide to
  //      cure. The bay's interior cage backs it, so there is nothing to see.
  //
  // One factory, pooled, with the glazing's own clearcoat and dials.
  const lensMatW = () => {
    const A = (typeof window !== 'undefined' && window.AEROSKIN) || null;
    if (A && A.aeroGlass) return A.aeroGlass(THREE, {});
    // the standalone bench has no aeroskin layer; it gets a stand-in that at
    // least reads as glass rather than as pale covering
    const m = new THREE.MeshStandardMaterial({
      color: 0xdfeaf2, roughness: 0.07, metalness: 0.0,
      transparent: true, opacity: 0.34, side: THREE.DoubleSide,
      depthWrite: false });
    m.userData.aeroskin = 1;      // the understudy must not flatten the glass
    m.userData.aeroFinish = 'glass';
    return m;
  };
  // KEPT for the strut block below: a fitting on the wing has to sit on the
  // wing that is DRAWN, exactly as the fuselage fitting sits on the drawn
  // cage. This is that surface, in cage space, before it is dressed.
  let wingGeo = null;
  const skinProbe = [];        // G133: every skin class, for the underside
  if (gs.skin) {
    const parts = pickParts(gs.skin, wingVert(gs.skin), toCage, skinClass,
                            wingField(gs.skin));
    for (const cl of ['main', 'centre', 'tip']) {
      const pr = add(parts, cl, wingMat(cl));
      if (pr) { faces += pr.geo.index.count / 3; skinProbe.push(pr.geo); }
    }
    // THE LENS, over the hole the classifier just made. Same faces, same
    // frame, glass instead of covering — and named so the light layer can
    // find where it ended up rather than recomputing it.
    const bayBox = {};
    const bayProf = {};
    const bx = b => ({ min: [b.min.x, b.min.y, b.min.z],
                       max: [b.max.x, b.max.y, b.max.z] });
    for (const sd of ['R', 'L']) {
      const pr = parts['lamp' + sd];
      if (!pr) continue;
      const o = WIRE
        ? new THREE.LineSegments(pr.wire, wireMat('glassC'))
        : new THREE.Mesh(pr.geo, lensMatW());
      o.name = 'edLens_wing' + sd;
      // ABOVE THE GROUND THE AEROPLANE FLIES OVER. See AERO_CLEAR in app.js:
      // the world's aerodrome decals are transparent, depthWrite:false and
      // carry render orders of their own, and the wing's cut leaves no opaque
      // depth behind this pane to stop them.
      o.renderOrder = 1003;
      group.add(o);
      // THE INTERIOR CAGE (G98, user: "it misses an interior cage ... it is
      // contained in a little cage, with an aft wall and side walls with the
      // profile of the wing"). Without it you see straight through the wing.
      // A quad and two ribs, all three taken from the cut's own boundary —
      // so the side walls carry the aerofoil profile by construction, exactly
      // as the lens does, and the back is a flat plate across them.
      const cg = bayCage(pr.geo);
      if (cg) { const m = new THREE.Mesh(cg, bayMat());
                m.name = 'edBay_wing' + sd; group.add(m); }
      const b = new THREE.Box3().setFromObject(o);
      if (isFinite(b.min.x)) bayBox[sd] = b;
      bayProf[sd] = section(pr.geo);
    }
    if (parts.lampR || parts.lampL) {
      // the bay's OWN extent, measured off the lens that was just built, so
      // the light layer places its lamp from the hole rather than from the
      // request that made it. ONE LENS SPANS BOTH WINGS (the class collects
      // both sides), so the station is carried separately from the box.
      // published PER SIDE and in this group's own (identity) frame, so the
      // light layer measures a real box rather than reconstructing a station
      window.CAGE_WING_BAY = { half: BAY.half, chord: BAY.chord,
        depth: BAY.depth,
        // PLAIN NUMBERS, not a Box3: r128's Box3 has no `toArray`, and the
        // TypeError it throws lands in the post hook where it takes the whole
        // layer down with it.
        R: bayBox.R ? bx(bayBox.R) : null,
        L: bayBox.L ? bx(bayBox.L) : null,
        // AND THE SECTION, not only the box (G98, user: "your lamp sticks out
        // a tad. Have this not happen by default"). It did, and the box is
        // exactly why: the box's height is the aerofoil at the AFT cut, where
        // it is thickest, and the lamp sits well forward of that in the
        // D-nose where there is a good deal less room. A lamp sized from the
        // box is oversized by the taper of the section it is fitted into.
        // So the bay reports its own thickness AS A FUNCTION OF CHORD and the
        // light layer fits the lamp to the station it actually occupies.
        profR: bayProf.R, profL: bayProf.L };
    } else window.CAGE_WING_BAY = null;
    if (parts.main) wingGeo = parts.main.geo;
  }
  // GLASS CENTRE (G32, user): the game emits a 'glass' carry-through into
  // its CANOPY group — the binding filter pulls the wing-bound faces out
  // and they take the glazing treatment (view panel's glass alpha)
  if (gs.canopy) {
    const parts = pickParts(gs.canopy, wingVert(gs.canopy), toCage, null);
    if (parts.x) {
      const o = WIRE ? new THREE.LineSegments(parts.x.wire, wireMat('glassC'))
                     : new THREE.Mesh(parts.x.geo, glassMat());
      group.add(o);
    }
  }
  // ---- THE LIFT STRUTS STAND ON THE STRUCTURE, AND ON THE SKIN (G87) -----
  // User, with both feet circled on a screenshot: "struts need to be properly
  // positioned on the 3d fuselage, probably using the same method as the
  // suspension fittings; a clear metal plate with bolts and screws,
  // constrained to the aircraft skin"; then, on the first cut: "I hope you
  // also ensured that the struts are also well anchored on the wings? ... it
  // also needs to be fixed through attachment with geometry. It should be
  // constrained to remain straight, in that sense that the fore/aft position
  // of both ends need to be similar ... prefer constraining the visuals to
  // the existing physics rather than adding new physics now."
  //
  // WHAT THIS DRAWS AND WHAT IT DOES NOT. It draws BOTH ends of both struts
  // as real fittings, on the surfaces that are really there. It moves NO
  // physics: the strut is 61_gen_frame.js's own beam, from its own strut
  // root to its own spar node, and the two trim sliders are bounded so the
  // drawn ends stay within a fitting's length of the beam's. If a build ever
  // wants a strut somewhere the beam is not, that is a change to the frame
  // and it belongs in the frame — this file will not fake it.
  //
  // NODES ARE ALREADY BODY-FRAME. `toCage` is written for SKIN vertices,
  // which genSkin emits in the REST pose, so it undoes that pose first
  // (`toBody`). A node from `def.nodes` has never been through it, and
  // sending one through toCage tilts it by the whole rest pitch — a
  // taildragger's ~10 degrees, which is half a metre out at the wing
  // station. The first cut of this block did exactly that. `nodeCage` is
  // toCage without the undo, and it is the only correct map for a node.
  const nodeCage = p => [p[2], yAnchor + (p[1] - refP[1]) + dy,
                         zCab - (p[0] - refP[0]) + dx];
  // G185: A FUSELAGE NODE DOES NOT RIDE THE WING'S NUDGE. The map above
  // carries the panel's fore/aft and up/down offsets (dx, dy) because it is
  // the WING's map — but a strut FOOT is a fuselage station, and mapping it
  // through the wing's offsets put the foot 1.2 m ahead of the ring it
  // belongs to on a build nudged 1.2 m aft, past the snap's own window
  // (measured: snap 403 mm on the lift strut, 494 on the cabane). The foot
  // lands where its ring is; the member is drawn from there to the wing's
  // fitting, which is what a real strut does when the wing moves — and the
  // flown frame's own beam runs between the join's MEASURED stations.
  const nodeCageBody = p => [p[2], yAnchor + (p[1] - refP[1]),
                             zCab - (p[0] - refP[0])];
    // THE WING'S OWN SURFACE, for the fittings that land on it. This layer
    // owns the geometry and THREE; the strut module owns the fitting and
    // knows nothing about either. So what crosses between them is ONE RAW
    // RAY — from, direction, first hit, and a normal turned to face where
    // the ray started. Which surface of the wing a fitting belongs on is the
    // strut's question, not this file's, and it asks it by aiming the ray.
    let wingRay = null;
    if (wingGeo && THREE.Raycaster) {
      const probe = new THREE.Mesh(wingGeo, MAT.main);
      probe.updateMatrixWorld(true);
      const rc = new THREE.Raycaster();
      rc.far = 1.2;
      const o = new THREE.Vector3(), d = new THREE.Vector3();
      wingRay = (from, dir) => {
        o.set(from[0], from[1], from[2]);
        d.set(dir[0], dir[1], dir[2]).normalize();
        rc.set(o, d);
        const h = rc.intersectObject(probe, false);
        if (!h.length || !h[0].face) return null;
        const n = h[0].face.normal;
        // FACING THE RAY'S ORIGIN, always. The wing skin is double-sided and
        // its winding is genSkin's business, so the only trustworthy way to
        // orient a normal here is against the direction we came from.
        const sg2 = n.x * d.x + n.y * d.y + n.z * d.z > 0 ? -1 : 1;
        return { p: h[0].point.toArray(),
                 n: [n.x * sg2, n.y * sg2, n.z * sg2] };
      };
    }

  let strutOn = false, strutNote = '';
  const SG = window.STRUT_GEN;
  if (SG && GG && AF && !WIRE && gs.liftstrut) {
    // the external wing beams, grouped BY THEIR ROOT — which is what
    // discovers that both struts of a side share one fuselage fitting
    // (61_gen_frame: B(strutRoot, WF[mid]) and B(strutRoot, WR[mid]))
    // rather than assuming it. A wing whose fan ever roots elsewhere gets
    // its own plate there with no edit here.
    const byRoot = new Map();
    for (const b of (def.beams || []))
      if (b.ext && b.cls === 'wing') {
        if (!byRoot.has(b.a)) byRoot.set(b.a, []);
        byRoot.get(b.a).push(b.b);
      }

    // THE FORE/AFT TRIM MOVES BOTH ENDS, AND IS BOUNDED BY THE WING'S OWN
    // STRUCTURE (user). A strut is straight and unraked: shifting only its
    // foot would skew it, so one number shifts the foot AND both wing
    // fittings by the same amount along the body. And the band it may move
    // in is not a taste — it is the wing's structural chord, "excluding the
    // leading edge and the control surface sections":
    //
    //   forward limit   the front fitting may not go ahead of the nose rib
    //   aft limit       the rear fitting may not go behind the aileron hinge
    //
    // so the range is a few tenths of a chord and it SHRINKS on a narrow
    // wing, which is right: a 1.15 m chord has less room than a 2.10 m one.
    // Outside it the slider clamps and the status line says so, because a
    // control that silently stops is a control that lies.
    const CW = def.spec.wing || {};
    const chord = CW.chord || 1.6;
    const sF = PT.sparFront != null ? PT.sparFront : 0.15;
    const sR = PT.sparRear != null ? PT.sparRear : 0.65;
    const ailC = (def.spec.controls && def.spec.controls.aileron &&
                  def.spec.controls.aileron.chord) || 0.22;
    const band = SG.strutBand(chord, sF, sR, ailC);
    // cage +z is FORWARD and body +x is AFT, so the slider's "fore" is -x
    const want = -(P.wgStrutZ || 0);
    const sx = Math.max(band.lo, Math.min(band.hi, want));
    const clamped = Math.abs(sx - want) > 1e-6;

    if (byRoot.size) {
      const bags = { alloy: GG.Bag(), steel: GG.Bag(), strut: GG.Bag() };
      let sLen = 0, sN = 0, dSnap = 0, dOff = 0, onWing = 0;
      const strutMembers = [];         // G179.2: each member's pin and tip
      for (const [root, tips] of byRoot) {
        const rp = N2[root].p;
        const site = SG.strutSite(AF, nodeCageBody([rp[0] + sx, rp[1], rp[2]]),
                                  0, P.wgStrutX || 0);
        // FRONT FIRST: cage z is forward, so the front spar's fitting is the
        // larger z, and it takes the forward pin.
        const ends = tips
          .map(id => { const q = N2[id].p;
                       return { top: nodeCage([q[0] + sx, q[1], q[2]]),
                                beam: nodeCage(q) }; })
          .sort((a, b) => b.top[2] - a.top[2]);
        const r = SG.strutBuild(bags, AF, site, ends, { wingRay });
        if (r) {
          dSnap = Math.max(dSnap, site.snap.d);
          for (const st2 of r.struts) {
            sLen += st2.len; sN++;
            strutMembers.push({ pin: st2.pin, tip: st2.tip });
            dOff = Math.max(dOff, st2.off);
            if (st2.tip !== st2.node) onWing++;
          }
        }
      }
      if (sN) {
        const sg = new THREE.Group();
        // the part table resolves a hit through the nearest name on the way
        // up (editor.js HIT_NAME), so the group carries it and the three
        // meshes under it do not need one each
        sg.name = 'edFit_liftstrut';
        // G179.2: THE STRUTS ARE A PART OF THE FLOWN AEROPLANE, by identity
        // (G55's rule): the join reads these lines off the group and the
        // game poses every vertex along its own member, pin to tip
        sg.userData.strutMembers = strutMembers;
        // the struts JOIN the livery (phase C): painted trim by default,
        // following the fuselage's colour; the flat Standard stays as the
        // no-editor fallback. surf 0 — a strut has no lattice.
        bags.strut.mesh(sg,
          (window.CAGE_SECMAT && window.CAGE_SECMAT('strut',
            { surf: 0, fieldM: 1, tint0: COLS.liftstrut })) || MAT.liftstrut);
        bags.alloy.mesh(sg, GG.gearMat('alloy'));
        bags.steel.mesh(sg, GG.gearMat('steel'));
        group.add(sg);
        strutOn = true;
        // WHAT THE STATUS LINE SAYS, and why each number is there:
        //   snap   how far the frame's strut root was from the built skin
        //   off    how far the drawn wing fitting is from its BEAM's own end
        //          — the visuals' whole licence, reported every build
        //   fwd    the fore/aft trim actually applied, with ! when clamped
        strutNote = 'strut: snap ' + (dSnap * 1000).toFixed(0) +
          ' mm · ' + (sLen / sN).toFixed(2) + ' m · ' + onWing + '/' + sN +
          ' on wing · off ' + (dOff * 1000).toFixed(0) + ' mm' +
          // ...and it is shown when the trim is NON-ZERO **or** when it was
          // clamped, which are not the same thing: a wing whose band has
          // collapsed clamps a moved slider back to zero, and that is exactly
          // the case the player most needs told about.
          (sx || clamped ? ' · fwd ' + (-sx).toFixed(2) +
                           (clamped ? '!' : '') : '');
      }
    }
  }
  if (stat && strutNote) stat.textContent += '  ·  ' + strutNote;
  const yes = () => true;
  for (const nm of (strutOn ? ['pitot'] : ['liftstrut', 'pitot']))
    if (gs[nm]) {
      // the strut and the pitot are FITTINGS, not skin: no ribs, no spars,
      // no field — they take the shader's triplanar branch
      const parts = pickParts(gs[nm], yes, toCage, null);
      if (parts.x) {
        const o2 = WIRE
          ? new THREE.LineSegments(parts.x.wire, wireMat(nm))
          : new THREE.Mesh(parts.x.geo, MAT[nm]);
        o2.name = 'edFit_' + nm;      // G59.2: named, so it can be measured
        group.add(o2);
      }
    }
  // CONTROL SURFACES EXPLODE (G32, user): unbolt aft and slightly down —
  // assembly-style, scaled like the cage parts
  for (const nm of ['ailR', 'ailL', 'flapR', 'flapL'])
    if (gs[nm]) {
      // AN AILERON IS WING SKIN. It carries the field like the rest of the
      // covering — same ribs, same spar coordinate, same tapes — because it
      // is built out of the same wing and hinged off it. Giving it the
      // AEROSKIN material and NOT the field would leave one material on
      // both shader branches at once, which is the one thing the split
      // cannot express (the same trap cageCut sprang in G66).
      const parts = pickParts(gs[nm], yes, toCage, null, wingField(gs[nm]));
      if (parts.x) {
        const o = WIRE ? new THREE.LineSegments(parts.x.wire, wireMat(nm))
                       : new THREE.Mesh(parts.x.geo, wingMat(nm));
        if (ex > 0) o.position.set(0, -0.18 * ex, -0.65 * ex);
        // G59: NAMED for the join's snapshot, exactly as the engine layer
        // names its prop — these are the surfaces that must deflect on the
        // flown aeroplane. The hinge line is the group's own inboard/
        // outboard extent at its FORWARD edge; the join derives it.
        o.name = 'edSurf_' + nm;
        group.add(o);
      }
    }
  scene.add(group);

  // G133: THE UNDERSIDE, PUBLISHED. The gear layer's low-wing rule needs
  // "the wing's lower skin at plan position (x, z)", and it must be the
  // wing that is DRAWN — the strut fittings' own rule, one block up. One
  // vertical ray cast up from below the aeroplane against fresh probe
  // meshes of the skin classes (fresh so an EXPLODED view still measures
  // the wing at its own place — the dims-pane rule); the answer is the
  // lowest skin point above that position with its normal turned downward,
  // or null off the planform. Cage-space metres, the gear layer's units.
  let underAt = null, overAt = null, leAt = null, teAt = null, wbox = null;
  if (skinProbe.length && THREE.Raycaster) {
    const pg = new THREE.Group();
    // DoubleSide, explicitly: the Raycaster culls by material.side, and an
    // upward ray meets the underside's faces from behind their winding —
    // measured, the main section answered null while the centre answered,
    // purely on which way each class's triangles happened to wind.
    const pm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    for (const g of skinProbe) pg.add(new THREE.Mesh(g, pm));
    pg.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    rc.far = 1000;
    const o = new THREE.Vector3(), d = new THREE.Vector3(0, 1, 0);
    underAt = (x, z) => {
      o.set(x, -60, z);
      rc.set(o, d);
      const h = rc.intersectObject(pg, true);
      if (!h.length || !h[0].face) return null;
      const n = h[0].face.normal;
      const sg2 = n.y > 0 ? -1 : 1;
      return { y: h[0].point.y, n: [n.x * sg2, n.y * sg2, n.z * sg2] };
    };
    // THE UPPER SKIN AND THE LEADING EDGE (2026-09-04, the engine mounts): the
    // same probe, cast DOWN for the top; and `leAt(x)` walks the planform
    // from the front at lateral x until both skins answer — the leading edge
    // at that station, with the wing's top and bottom there. Metres, the
    // engine and cowl layers' units.
    const dDn = new THREE.Vector3(0, -1, 0);
    overAt = (x, z) => {
      o.set(x, 60, z);
      rc.set(o, dDn);
      const h = rc.intersectObject(pg, true);
      return h.length ? { y: h[0].point.y } : null;
    };
    const bb = new THREE.Box3().setFromObject(pg);
    wbox = { min: [bb.min.x, bb.min.y, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z] };
    leAt = x => {
      const N = 48;
      for (let k = 0; k <= N; k++) {
        const z = bb.max.z - (bb.max.z - bb.min.z) * k / N;
        const t = overAt(x, z), u = underAt(x, z);
        if (t && u) return { z, yTop: t.y, yBot: u.y };
      }
      return null;
    };
    // ...and the TRAILING edge, walked from the back (a pusher nacelle's face)
    teAt = x => {
      const N = 48;
      for (let k = 0; k <= N; k++) {
        const z = bb.min.z + (bb.max.z - bb.min.z) * k / N;
        const t = overAt(x, z), u = underAt(x, z);
        if (t && u) return { z, yTop: t.y, yBot: u.y };
      }
      return null;
    };
  }
  // ---- G185: THE SECOND PLANE -------------------------------------------
  // The same extraction, classing, field and dressing as the first plane,
  // over the loft's own `skin2` group and the second plane's spar record —
  // into ITS OWN group (cageLayer:wing2) so a click resolves to its own
  // part, with its own probes published beside the first's. The first
  // plane's block above is untouched (its picture is every monoplane's).
  // Not on this plane, by design: the lamp bay (the light layer chooses a
  // plane at G185.10), the pitot, the fuselage lift struts (a biplane has
  // none; the truss is the brace layer's), the glass carry-through.
  const probesOf = geos => {
    let uA = null, oA = null, lA = null, tA = null, bx = null;
    if (geos.length && THREE.Raycaster) {
      const pg = new THREE.Group();
      const pm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      for (const g of geos) pg.add(new THREE.Mesh(g, pm));
      pg.updateMatrixWorld(true);
      const rc = new THREE.Raycaster();
      rc.far = 1000;
      const o = new THREE.Vector3(), dUp = new THREE.Vector3(0, 1, 0), dDn = new THREE.Vector3(0, -1, 0);
      uA = (x, z) => { o.set(x, -60, z); rc.set(o, dUp);
        const h = rc.intersectObject(pg, true); if (!h.length || !h[0].face) return null;
        const n = h[0].face.normal, sg2 = n.y > 0 ? -1 : 1;
        return { y: h[0].point.y, n: [n.x * sg2, n.y * sg2, n.z * sg2] }; };
      oA = (x, z) => { o.set(x, 60, z); rc.set(o, dDn);
        const h = rc.intersectObject(pg, true); return h.length ? { y: h[0].point.y } : null; };
      const bb = new THREE.Box3().setFromObject(pg);
      bx = { min: [bb.min.x, bb.min.y, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z] };
      lA = x => { for (let k = 0; k <= 48; k++) { const z = bb.max.z - (bb.max.z - bb.min.z) * k / 48;
        const t = oA(x, z), u = uA(x, z); if (t && u) return { z, yTop: t.y, yBot: u.y }; } return null; };
      tA = x => { for (let k = 0; k <= 48; k++) { const z = bb.min.z + (bb.max.z - bb.min.z) * k / 48;
        const t = oA(x, z), u = uA(x, z); if (t && u) return { z, yTop: t.y, yBot: u.y }; } return null; };
    }
    return { underAt: uA, overAt: oA, leAt: lA, teAt: tA, box: bx };
  };
  const rootYOf = PL => {
    const i = PL && PL.wf && PL.wf.R && PL.wf.R.F ? PL.wf.R.F[0] : null;
    return i != null ? nodeCage(N2[i].p)[1] : yAnchor;
  };
  let group2 = null, plane1 = null;
  const PL1 = def.parts.planes && def.parts.planes[1];
  if (+P.w2On && gs.skin2 && PL1 && !WIRE) {
    const W1 = def.spec.wings[1] || {};
    const WN2 = new Set();
    for (const side of [PL1.wf.L, PL1.wf.R]) if (side)
      for (const arr of [side.F, side.R]) if (arr) for (const i of arr) WN2.add(i);
    const vert2 = g => i => {
      let any = false;
      for (let k = 0; k < G_INFL; k++) {
        const w = g.ww[i * G_INFL + k];
        if (w > 1e-6) { if (!WN2.has(g.wi[i * G_INFL + k])) return false; any = true; }
      }
      return any;
    };
    const zRoot2 = PL1.zRoot || 0;
    const tipOn2 = (W1.tipR || 0) > 1e-6, tipZ2 = tipOn2 ? W1.tipZ : Infinity;
    const ribZ2 = (PL1.ribZ || []).slice().sort((a, b) => a - b)
      .filter((z, i, A) => i === 0 || z - A[i - 1] > 1e-4);
    const field2 = g => {
      if (!g.uv) return null;
      return i => {
        const cf = g.uv[i * 2];
        const az = Math.abs(toBody([g.pos[i*3], g.pos[i*3+1], g.pos[i*3+2]])[2]);
        const chord = PL1.chordAt ? PL1.chordAt(az) : 1;
        let st = 0;
        if (ribZ2.length) {
          let k = 0;
          while (k < ribZ2.length && ribZ2[k] < az) k++;
          const lo = k > 0 ? ribZ2[k - 1] : zRoot2;
          const hi = k < ribZ2.length ? ribZ2[k] : ribZ2[ribZ2.length - 1];
          const d = hi - lo;
          st = k + (d > 1e-6 ? (az - hi) / d : 0);
        }
        return [az - zRoot2, cf * chord, st, (cf - sparF) / sparSpan];
      };
    };
    const class2 = cen => {
      const az = Math.abs(toBody(cen)[2]);
      if (az <= zRoot2 + 1e-3) return 'centre';
      if (tipOn2 && az >= tipZ2 - 1e-3) return 'tip';
      return 'main';
    };
    group2 = new THREE.Group();
    group2.name = 'cageLayer:wing2';
    const probe2 = [];
    const parts2 = pickParts(gs.skin2, vert2(gs.skin2), toCage, class2, field2(gs.skin2));
    for (const cl of ['main', 'centre', 'tip']) {
      const pr = parts2 && parts2[cl];
      if (!pr) continue;
      const o = new THREE.Mesh(pr.geo, wingMat(cl, 1));
      group2.add(o); probe2.push(pr.geo); faces += pr.geo.index.count / 3;
    }
    const yes2 = () => () => true;
    for (const nm of ['ailR', 'ailL', 'flapR', 'flapL']) {
      const g2 = gs[nm + '2'];
      if (!g2) continue;
      const pr = pickParts(g2, yes2(), toCage, null, field2(g2));
      if (pr && pr.x) {
        const o = new THREE.Mesh(pr.x.geo, wingMat(nm, 1));
        if (ex > 0) o.position.set(0, -0.18 * ex, -0.65 * ex);
        o.name = 'edSurf_' + nm + '2';
        group2.add(o);
      }
    }
    scene.add(group2);
    plane1 = Object.assign({ k: 1, def, group: group2, semi: PL1.semi, spar: WN2,
                             rootY: rootYOf(PL1), zRoot: zRoot2 }, probesOf(probe2));
  }
  const plane0 = { k: 0, def, group, semi: def.spec.geom && def.spec.geom.semi,
                   spar: WN, rootY: rootYOf(def.parts.planes && def.parts.planes[0]),
                   zRoot, underAt, overAt, leAt, teAt, box: wbox, wingRay };
  const planes = plane1 ? [plane0, plane1] : [plane0];
  let lowest = 0, upper = 0;
  planes.forEach((pl, i) => { if (pl.rootY < planes[lowest].rootY) lowest = i;
                              if (pl.rootY > planes[upper].rootY) upper = i; });

  window.CAGE_WING = { def, semi: def.spec.geom && def.spec.geom.semi,
                       skinFaces: faces, anchor: { zCab, yAnchor }, group,
                       underAt, overAt, leAt, teAt, box: wbox,
                       // G185: what the BRACE layer needs to put a fitting on
                       // this wing and on the body it stands on
                       wingRay, nodeCage, nodeCageBody, AF, FS,
                       // G185: every plane, with the index of the lowest (the
                       // gear's) and the upper (the pylon engine's)
                       planes, lowest, upper };
  // THE TWIN BOOMS (2026-09-04, TWIN-BOOM spec §1.3): two tapering tubes off
  // the wing's TRAILING EDGE at ±boomX, level, `boomLen` long, carrying the
  // fins the fin layer builds twice and the stab the stab layer seats between
  // them. Drawn here because only the wing knows its trailing edge; published
  // as CAGE_BOOMS (scene metres) for the fin, the stab and the join. A pure
  // function of P + the wing, so the fin layer (which runs before the stab)
  // can read the deck it needs. Cut 1's admitted compromises: round tubes,
  // level, rooted on the wing whatever nacelle sits there; the tube's group
  // wears the wing's layer name (a click selects the wing).
  if (boomGroup) { boomGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
                   if (boomGroup.parent) boomGroup.parent.remove(boomGroup); boomGroup = null; }
  window.CAGE_BOOMS = null;
  if (+P.boomTwin && teAt) {
    const x = Math.max(0.3, +P.boomX || 1.2);
    const te = teAt(x) || teAt(-x);
    if (te) {
      const r0 = Math.max(0.02, (+P.boomD || 0.16) / 2);
      const r1 = r0 * Math.max(0.3, Math.min(1, +P.boomTaper || 0.7));
      const len = Math.max(0.8, +P.boomLen || 3.0);
      const y0 = 0.5 * (te.yTop + te.yBot);
      const zRoot = te.z + 0.35 * (te.yTop - te.yBot) + r0, zTip = te.z - len;
      boomGroup = new THREE.Group();
      boomGroup.name = 'cageLayer:wing';
      // the CONSTRUCTION axis: a rod boom is a bare tube (boomTube), a lofted
      // one a skinned oval (body), 1.5 x taller than wide, tapering the same
      const rodB = Math.round(P.boomStyle) === 1;
      let bm = null;
      try {
        if (window.CAGE_SECMAT)
          bm = window.CAGE_SECMAT(rodB ? 'boomTube' : 'body', { surf: 0, fieldM: 1 });
      } catch (e) {}
      if (!bm) bm = new THREE.MeshStandardMaterial({ color: rodB ? 0x9aa0a6 : 0xd9d4c6,
                                                     metalness: rodB ? 0.6 : 0.1, roughness: 0.45 });
      for (const s of [1, -1]) {
        const g = new THREE.CylinderGeometry(r1, r0, zRoot - zTip, 28, 1, false);
        g.rotateX(-Math.PI / 2);                 // the cylinder's axis onto -z
        if (!rodB) g.scale(1, 1.5, 1);           // the lofted oval
        const m = new THREE.Mesh(g, bm);
        m.position.set(s * x, y0, 0.5 * (zRoot + zTip));
        m.name = 'edBoom' + (s > 0 ? 'R' : 'L');
        boomGroup.add(m);
      }
      scene.add(boomGroup);
      const kv = rodB ? 1 : 1.5;                 // the lofted oval's height
      const rAt = z => r0 + (r1 - r0) * Math.max(0, Math.min(1, (zRoot - z) / (zRoot - zTip)));
      window.CAGE_BOOMS = { x, r0, r1, zRoot, zTip, y: y0, len, lofted: !rodB,
                            yTop: z => y0 + kv * rAt(z), yBot: z => y0 - kv * rAt(z), rAt };
    }
  }
  if (stat) {
    const g2 = def.spec.geom || {};
    stat.textContent += '  ·  wing: ' + (g2.S ? g2.S.toFixed(1) + ' m2 · ' : '') +
      'span ' + P.wgSpan.toFixed(1) + ' · ' +
      (gspec.wings[0].position) + '/' + gspec.bracing.type +
      // G185: the second plane, its gap (a READOUT — the cabane height and
      // the low band decide it) and its stagger
      (plane1 ? ' · 2 planes · gap ' +
        ((def.parts.planes[0].wingY0 || 0) - (def.parts.planes[1].wingY0 || 0)).toFixed(2) +
        ' m · stagger ' + (+P.w2Stagger || 0).toFixed(2) + ' m' : '');
  }
};
})();
