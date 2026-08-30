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
    typeof genSkin !== 'function') {
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
PAGE.defaults = Object.assign({
  wingOn: 1, wgSpan: 10.0, wgChord: 1.60, wgChordTip: 1.60, wgSweep: 0,
  wgDihedral: 3.0, wgIncidence: 1.5, wgWashout: 1.5,
  wgCamber: 2, wgThick: 12,
  wgTip: Math.max(0, TIP_KEYS.indexOf('rounded')), wgPos: 0,
  wgCentre: 0, wgBrace: 0, wgCrankAt: 0, wgDihedralOut: 6,
  wgPanels: 3, wgDx: 0, wgDy: 0,
  wgFlapType: Math.max(0, FLAP_KEYS.indexOf('none')),
  wgFlapSpan: 0.50, wgFlapChord: 0.20,
  wgAilSpan: 0.38, wgAilChord: 0.22,
}, PAGE.defaults || {});

// ---- panel ----------------------------------------------------------------
const on = { when: P => +P.wingOn };
const WING_ITEMS = [
  ['wingOn',   'wings',          0, 1, 1],
  ['wgPos',    'position',       0, 2, 1,
   ['high wing', 'mid wing', 'low wing'], on],
  ['wgSpan',   'span',           6.5, 14, 0.1, { ...on, dim: 'm' }],
  ['wgChord',  'chord root',     1.15, 2.10, 0.05, { ...on, dim: 'm' }],
  ['wgChordTip', 'chord tip',    0.55, 2.10, 0.05, { ...on, dim: 'm' }],
  ['wgTip',    'tips',           0, TIP_KEYS.length - 1, 1,
   TIP_KEYS.map(k => GEN_TIPS[k].name), on],
  ['wgCrankAt', 'crank at',      0, 0.85, 0.05, on],
  ['wgDihedralOut', 'dih. outer', 0, 20, 0.5,
   { when: P => +P.wingOn && +P.wgCrankAt > 0 }],
  ['wgSweep',  'sweep',          -15, 30, 1, on],
  ['wgDihedral', 'dihedral',     0, 6, 0.5, on],
  ['wgIncidence', 'incidence',   -1, 4, 0.1, on],
  ['wgWashout', 'washout',       0, 4, 0.1, on],
  ['wgCamber', 'camber',         0, 6, 1, on],
  ['wgThick',  'thickness',      9, 18, 1, on],
  ['wgCentre', 'centre section', 0, 2, 1, ['solid', 'glass', 'open'],
   { when: P => +P.wingOn && +P.wgPos === 0 }],
  ['wgPanels', 'spar stations',  2, 5, 1, on],
  ['wgDx',     'fore/aft',       -1.5, 1.8, 0.05, on],
  ['wgDy',     'height',         -1.0, 1.0, 0.02, on],
  ['struts & fixation', [
    ['wgBrace', 'fixation',      0, 1, 1, ['lift struts', 'cantilever']],
  ], on],
  ['control surfaces', [
    ['wgFlapType', 'flaps',      0, FLAP_KEYS.length - 1, 1,
     FLAP_KEYS.map(k => GEN_FLAPS[k].name)],
    ['wgFlapSpan', 'flap span',  0.10, 0.60, 0.02,
     { when: P => FLAP_KEYS[Math.round(P.wgFlapType)] !== 'none' }],
    ['wgFlapChord', 'flap chord', 0.10, 0.40, 0.01,
     { when: P => FLAP_KEYS[Math.round(P.wgFlapType)] !== 'none' }],
    ['wgAilSpan', 'ail. span',   0.15, 0.55, 0.01],
    ['wgAilChord', 'ail. chord', 0.10, 0.35, 0.01],
  ], 'open', on],
];
const host6 = (PAGE.groupsOverride || []).find(g => g[0] === '6 · wings');
if (host6) host6[1].push(...WING_ITEMS);
else (PAGE.groupsOverride || (PAGE.groups = PAGE.groups || []))
  .push(['6 · wings', WING_ITEMS]);

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
function wingMat(cl) {
  const A = (typeof window !== 'undefined' && window.AEROSKIN) || null;
  const P0 = (window.CAGE_UI && window.CAGE_UI.P) || {};
  const on = document.getElementById('mat');
  if (!A || !on || on.value !== 'material') return MAT[cl] || MAT.main;
  const cons = ['carbon', 'tubeFabric', 'wood', 'alloy'][
    Math.max(0, Math.min(3, Math.round(P0.intCons || 0)))] || 'tubeFabric';
  const FS = ((window.CAGE2 && window.CAGE2.CAGE_UNIT) || 1) *
             (P0.planeScale || 1);
  return A.aeroMaterial(THREE, {
    finish: A.aeroFinishFor('body', cons),
    grm: cons, struct: 1, wing: 1,
    surf: 1, fieldM: 1,          // the wing's field is ALREADY in metres
    side: THREE.DoubleSide,
    // the TIP takes the trim colour it always had - G31's "every part its own
    // colour" survives as a tint over the finish rather than as a flat paint
    tint: cl === 'tip' ? COLS.tip : undefined,
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
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  const { scene, spec, mesh, P, stat } = ctx;
  dispose(group); group = null;
  if (!P.wingOn) return;
  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);

  // the game spec: defaults + the panel's wing — everything else rides
  // the generator's own defaults (its fuselage is built and discarded;
  // only the wing subset is kept). The NACA digits and the tip chord
  // compose exactly as the garage's own @ knobs do.
  // G59.2: the airframe contract, hoisted — the frame this layer builds
  // needs the BUILT cabin, not the generator's default one (see below).
  const AF = GG && GG.cageAirframe ? GG.cageAirframe(mesh, FS) : null;
  const cam = Math.round(P.wgCamber), thk = Math.round(P.wgThick);
  const gspec = {
    wings: [{
      span: P.wgSpan, chord: P.wgChord,
      taper: Math.max(0.2, Math.min(1.0,
        P.wgChordTip / Math.max(0.2, P.wgChord))),
      sweep: P.wgSweep, dihedral: P.wgDihedral, incidence: P.wgIncidence,
      washout: P.wgWashout,
      naca: cam * 1000 + (cam > 0 ? 400 : 0) + thk,
      panels: Math.round(P.wgPanels),
      position: ['high', 'mid', 'low'][Math.round(P.wgPos)] || 'high',
      tip: TIP_KEYS[Math.round(P.wgTip)] || 'rounded',
      crankAt: P.wgCrankAt > 0 ? P.wgCrankAt : 0,
      dihedralOut: P.wgCrankAt > 0 ? P.wgDihedralOut : null,
      centre: ['solid', 'glass', 'open'][Math.round(P.wgCentre)] || 'solid',
    }],
    bracing: { type: Math.round(P.wgBrace) ? 'cantilever' : 'strut' },
    controls: {
      flap: { type: FLAP_KEYS[Math.round(P.wgFlapType)] || 'none',
              span: P.wgFlapSpan, chord: P.wgFlapChord },
      aileron: { span: P.wgAilSpan, chord: P.wgAilChord },
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
    pay = genSkin(def);
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

  const skinClass = cen => {
    const az = Math.abs(toBody(cen)[2]);
    if (az <= zRoot + 1e-3) return 'centre';
    if (tipOn && az >= tipZ - 1e-3) return 'tip';
    return 'main';
  };
  if (gs.skin) {
    const parts = pickParts(gs.skin, wingVert(gs.skin), toCage, skinClass,
                            wingField(gs.skin));
    for (const cl of ['main', 'centre', 'tip']) {
      const pr = add(parts, cl, wingMat(cl));
      if (pr) faces += pr.geo.index.count / 3;
    }
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
  const yes = () => true;
  for (const nm of ['liftstrut', 'pitot'])
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

  window.CAGE_WING = { def, semi: def.spec.geom && def.spec.geom.semi,
                       skinFaces: faces, anchor: { zCab, yAnchor }, group };
  if (stat) {
    const g2 = def.spec.geom || {};
    stat.textContent += '  ·  wing: ' + (g2.S ? g2.S.toFixed(1) + ' m2 · ' : '') +
      'span ' + P.wgSpan.toFixed(1) + ' · ' +
      (gspec.wings[0].position) + '/' + gspec.bracing.type;
  }
};
})();
