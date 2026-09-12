// CAGE STAB LAYER — the horizontal tail (stabilizer + elevator), on the
// aeroplane (cage7, G23 prototype).
//
// THE STAB RIDES THE FIN MODEL (user ruling): same sheet, same subsurf, same
// mesh-aligned cut, same thickness — built by _fin_gen.js with the DORSAL
// FORCED OUT (a tailplane has none) and the keel tab off, then laid flat by
// finToStab and mirrored. The references bracket the parameter space: the
// Cub's rounded tailplane IS the FIN_CUB shape (so the DEFAULTS are the Cub
// values verbatim), the 172's tapered one is the corner sliders with the
// bulges at zero. The elevator is the fin's 'hinge only' cut: the slot is
// the drawn guard band, the hinge columns are the arteries, creased.
//
// THE ROOT IS A FLAT LINE, NOT THE DECK: a stab root runs straight along
// the fuselage side, so instead of the centreline polylines the sheet gets
// a constant "deck" at the fiche's own root level — the rebase to the live
// tailpost still works (it only needs the deck's aft end), and the root
// projection pins the strand dead straight.
//
// Load after _cage_fin (shares its draw helpers) and before _cage_ui;
// chains PAGE.post.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const FIN = window.FIN_GEN, CG2 = window.CAGE2, GG = window.GEAR_GEN;
if (!FIN) { console.error('cage stab layer: _fin_gen.js not loaded'); return; }

// ---- parameters -----------------------------------------------------------
// st* mirrors the fin's grammar; defaults are the CUB TAIL, mapped straight
// from FIN_CUB so they cannot drift from the checked reference values.
// THE MAP LIVES IN _fin_gen.js (TAIL CHANTIER 2, P0): one home, read by
// this layer, the headless tail and the sweep alike
const ST2FIN = FIN.ST2FIN;
const stDef = { stOn: 1, stCut: 1, stCutGap: 0.012,
  stSolid: 1, stThick: 0.05, stThickTE: 0.012,
  stX: 0.05, stY: 0.25, stZ: 0, stCons: 0, stOver: 0,
  // THE ROOT'S SEAT + THE CANT (2026-09-04, the user's "V tail and T tail
  // variants"): stMount 0 = the boom keel (G26.5, as always), 1 = the boom
  // DECK (a V-tail's panels meet on top of the boom), 2 = the FIN TIP (a
  // T-tail rides the fin, whatever its height); stY stays the offset from
  // that seat. stCant tips each panel up about its root line — 0 is a flat
  // tailplane, 30-40 a V-tail; the join reads >= 20 as tail.type 'v'.
  stMount: 0, stCant: 0 };
for (const [sk, fk] of Object.entries(ST2FIN))
  stDef[sk] = FIN.FIN_CUB[fk] !== undefined ? FIN.FIN_CUB[fk]
                                            : FIN.FIN_PARAMS[fk];
// snapshot BEFORE the defaults merge mutates stDef into the full set
const stOwn = Object.assign({}, stDef);
PAGE.defaults = Object.assign(stDef, PAGE.defaults || {});
// the piper cub keeps ITS tailplane (the Cub-mapped values) even though
// the page defaults now carry the jodel one — presets stay self-contained
if (PAGE.presets && PAGE.presets['piper cub'])
  Object.assign(PAGE.presets['piper cub'], stOwn);

const GROUP = ['8b · tail — stab & elevator', [
  ['stOn',    'stab layer',      0, 1, 1, ['off', 'on']],
  ['stRootGuard', 'root loops',  0, 1, 1, ['single + crease', 'guard pair'],
   { when: P => +P.stOn }],
  // THE STAB'S OWN CONSTRUCTION (G110) — see finCons; tailMat reads which
  // of the two off the section it is dressing. Mass/price follow since
  // G116, stiffness/damping since G117 (`tail.stabMaterial`; a V-tail
  // takes this one — it IS the stab).
  ['stCons', 'construction',     0, 4, 1,
   ['as the aeroplane', 'carbon', 'steel tube', 'fabric on wood', 'aluminium'],
   { when: P => +P.stOn }],
  ['position', [
    ['stMount', 'root sits', 0, 3, 1,
     ['on the boom keel', 'on the boom deck', 'on the fin tip',
      'between the booms']],
    ['stX', 'in / out (root half-track)', 0, 0.30, 0.005],
    ['stY', 'up / down (from the seat)', -0.20, 0.80, 0.005],
    ['stZ', 'fore / aft',       -0.60, 0.60, 0.005],
    ['stCant', 'cant (V-tail) °', 0, 55, 0.5],
  ], 'open', { when: P => +P.stOn }],
  ['cut', [
    ['stCut',    'stab / elevator', 0, 2, 1,
     ['uncut', 'hinge only', 'horn balance']],
    ['stCutGap', 'slot width',      0, 0.05, 0.001,
     { when: P => +P.stCut > 0 }],
  ], 'open', { when: P => +P.stOn }],
  ['thickness', [
    ['stSolid',   'volume',         0, 1, 1, ['2D sheet', 'solid']],
    ['stThick',   'base thickness', 0.01, 0.15, 0.002,
     { when: P => +P.stSolid }],
    ['stThickTE', 'TE thickness',   0.004, 0.06, 0.002,
     { when: P => +P.stSolid }],
  ], 'open', { when: P => +P.stOn }],
  // THE MACRO TIER (P3), the fin's words laid flat: span for height
  ['size', [
    // G271: between twin booms the span is NOT the builder's — the panel
    // runs from fin to fin (its tips on the booms' centre planes) and the
    // one number left is how far it overhangs past them (metres, a side)
    ['stSpan',     'span (× the drawn)',                0.50, 1.80, 0.01,
     { when: P => !+P.boomTwin }],
    ['stOver',     'overhang past the booms', 0, 1.0, 0.01,
     { when: P => !!+P.boomTwin, dim: 'len' }],
    ['stChord',    'chord (× the drawn, about the hinge)', 0.50, 1.60, 0.01],
    ['stChordTip', 'tip chord (of the root)',           0.30, 1.50, 0.01],
    ['stSweep',    'sweep (deg, the hinge rakes)',      -10, 45, 0.5],
    ['stHinge',    'elevator chord (of the root)',      0.08, 0.45, 0.005],
  ], 'open', { when: P => +P.stOn }],
  ['corners', [
    ['stTipZ',  'tip fore / aft (sweep)',     -0.60, 0.60, 0.005],
    ['stTipY',  'span (tip in / out)',     -0.80, 0.80, 0.005],
    ['stAftZ',  'tip-aft fore / aft', -0.50, 0.30, 0.005],
    ['stAftY',  'tip-aft in / out', -0.90, 0.60, 0.005],
    ['stBaseZ', 'root-aft fore / aft', -0.50, 0.30, 0.005],
    ['stBaseY', 'root-aft in / out', -0.15, 0.50, 0.005],
  ], 'open', { when: P => +P.stOn, level: 'expert' }],
  ['rows & points', [
    ['stRootFwd',   'root length (forward point)',   -1.20, 2.00, 0.005],
    ['stMidY',      'mid row in / out',          -0.80, 0.40, 0.005],
    ['stUY',        'u row in / out',            -0.40, 0.40, 0.005],
    ['stLEZ',       'LE root fore / aft', -0.80, 0.30, 0.005],
    ['stLEY',       'LE root in / out',    -0.20, 0.40, 0.005],
    ['stShoulderZ', 'shoulder fore / aft (of the tip)', -0.10, 0.50, 0.005],
    ['stShoulderY', 'shoulder in / out (over the mid row)',   -0.10, 0.30, 0.005],
    ['stTopY',      'tip pair bulge',   -0.30, 0.30, 0.005],
  ], { when: P => +P.stOn, level: 'expert' }],
  // positive root offset = the classic rudder-clearance notch: the
  // elevator's inboard TE eases forward so the rudder can swing; its
  // spanwise reach is the u row's position
  ['trailing edge', [
    ['stTERoot', 'root aft− / notch+', -0.40, 0.40, 0.005],
    ['stTEU',    'u bulge aft',    -0.40, 0.20, 0.005],
    ['stTEMid',  'mid bulge aft',  -0.40, 0.20, 0.005],
  ], { when: P => +P.stOn, level: 'expert' }],
  ['corner sharpness', [
    ['stSharpTip',      'tip',      0, 3, 0.05],
    ['stSharpAft',      'tip-aft',  0, 3, 0.05],
    ['stSharpBase',     'root-aft', 0, 3, 0.05],
    ['stSharpShoulder', 'shoulder', 0, 3, 0.05],
    ['stSharpLE',       'LE root',  0, 3, 0.05],
  ], { when: P => +P.stOn, level: 'expert' }],
], 'open'];
(PAGE.groupsOverride || (PAGE.groups = PAGE.groups || [])).push(GROUP);

// ---- the skin filter (as the fin layer's) ---------------------------------
const SKIN = (GG && GG.CAGE_MATS) || new Set(['body', 'pillarWindow',
  'pillarCabin', 'pillarPassenger', 'pillarTail', 'pillarFront', 'windshield',
  'skyWindows', 'pilotWindow', 'pasengerWindow', 'ceilingLoop', 'floorLoop',
  'waistband', 'boomTube', 'taper', 'pillarTaper', 'taperPanel']);
// as the fin layer: the deck sweep skips the glazing (the bubble canopy
// dome sawtoothed it — a surface roots on structure, not glass)
const GLASS = new Set(['windshield', 'skyWindows', 'pilotWindow',
                       'pasengerWindow']);
const deckSkin = m => SKIN.has(m) && !GLASS.has(m);

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
  const DRAW = window.CAGE_FIN_DRAW;
  dispose(group); group = null;
  if (!Math.round(P.stOn === undefined ? 1 : P.stOn) || !DRAW) return;

  // spec: the fin grammar under the st* values, dorsal and keel forced out
  const finP = {};
  for (const [sk, fk] of Object.entries(ST2FIN)) finP[fk] = P[sk];
  const cutMode = Math.round(P.stCut || 0);
  const S = FIN.finSpec(finP);
  S.dorsal = 0;
  S.keelExt = 0;
  S.cutPrep = cutMode;
  // the flat root: a constant line at the fiche's own root level, with the
  // LIVE tail cap as the rebase anchor (from the same centreline sweep the
  // fin uses)
  // twin booms (2026-09-04): the stab's deck is the boom's line, its tail
  // cap the boom tip — the stab spans from boom to boom (stX 0, one panel)
  const TB = window.CAGE_BOOMS;
  const FSd = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const deck = TB
    ? { top: z => TB.yTop(z * FSd) / FSd, bot: z => TB.yBot(z * FSd) / FSd,
        z0: TB.zTip / FSd, z1: TB.zRoot / FSd }
    : FIN.finCentreline(mesh, deckSkin);
  const rootLine = FIN.FIN_DEFAULT.lo.H;
  S.deck = {
    top: () => rootLine,
    bot: () => FIN.FIN_DEFAULT.yKeel - FIN.FIN_DEFAULT.offKeel,
    z0: deck ? deck.z0 : FIN.FIN_DEFAULT.zCap,
    z1: 1e9,
  };
  const m0 = FIN.buildFin2(S);
  // G26.5 (user): the stab ANCHORS AT THE BOTTOM OF THE BOOM/ROD — its
  // height rides the aft body instead of an absolute y. yRef = the
  // UNDERSIDE of the live centreline sweep at the hinge station (the
  // boom keel on a loft, the tube's belly on a rod — so it follows the
  // rod height AND diameter); stY is the offset from there. No deck =
  // 0 = the historic absolute placement.
  const dzS = deck ? deck.z0 - FIN.FIN_DEFAULT.zCap : 0;
  let yRef = deck ? deck.bot(FIN.FIN_DEFAULT.zH1 + dzS) : 0;
  // THE SEAT (2026-09-04): deck = the top of the same centreline sweep at
  // the hinge station; fin tip = the built fin's highest vertex (the fin
  // layer runs first — build.js MANIFEST order — so CAGE_FIN is this frame's)
  // plus half the stab's own thickness, so its underside rests ON the tip;
  // and the stab slides aft to the tip's own station (a swept fin's tip is
  // behind its root, and the stab is the fin model's stations). No fin
  // built = the deck seat; no deck = the historic absolute placement.
  const mount = Math.round(P.stMount || 0);
  const cantDeg = Math.max(0, +P.stCant || 0);
  const cant = cantDeg * Math.PI / 180;
  let zSeat = 0;
  if (mount >= 1 && deck) yRef = deck.top(FIN.FIN_DEFAULT.zH1 + dzS);
  // THE STAB MEETS A FITTING, NOT THE TUBE (G307, the fitment study P3): on
  // a single bare rod the stab is CARRIED — a saddle on the tube at its
  // hinge station, a plate on the crown, and where the builder's stY holds
  // the stab above the plate a pedestal block up to its underside; a stab
  // asked for below the plate is lifted onto it. Rod-style twin booms seat
  // the stab between the fins (G271) and keep their own rule.
  const RF = window.ROD_FIT;
  const rod = !!(RF && !TB && +P.boomStyle && deck && mount <= 1);
  let rodSeat = null;
  if (rod) {
    const zH = FIN.FIN_DEFAULT.zH1 + dzS;
    const yT = deck.top(zH), yB = deck.bot(zH);
    const plateTop = yT + RF.SADDLE.hS / FSd;              // cage units
    const half = 0.5 * (P.stThick || 0.05);
    const under = yRef + (P.stY || 0) - half;              // the stab's underside
    if (under < plateTop) yRef += plateTop - under;        // lifted onto the plate
    rodSeat = { z: zH, yT, yB, plateTop, r: 0.5 * (yT - yB) };
  }
  if (mount === 3 && deck)                       // the boom's own centre
    yRef = 0.5 * (deck.top(FIN.FIN_DEFAULT.zH1 + dzS) + deck.bot(FIN.FIN_DEFAULT.zH1 + dzS));
  if (mount === 2) {
    const FN = window.CAGE_FIN;
    if (FN && FN.disp && FN.disp.V.length && +P.finOn) {
      let top = -Infinity;
      for (const p of FN.disp.V) top = Math.max(top, p[1]);
      let zs = 0, n = 0;
      for (const p of FN.disp.V) if (p[1] > top - 0.06) { zs += p[2]; n++; }
      const zTip = n ? zs / n : 0;
      yRef = top + 0.5 * (P.stThick || 0.05);
      // the stab's own root line sits at the fin fiche's stations; the
      // tip station is measured off the fiche the same way
      let zr = 0, nr = 0;
      for (const p of FIN.buildFin2(S).V)
        if (Math.abs(p[1] - rootLine) < 0.02) { zr += p[2]; nr++; }
      zSeat = zTip - (nr ? zr / nr : 0);
    }
  }

  const L = $('lvl') ? +$('lvl').value : 2;
  let s = m0;
  for (let i = 0; i < L; i++) s = CG2.cageSubdivide(s);
  // THE PANEL REACHES THE FINS (G271, the user: "the stabiliser wing in the
  // middle of the booms does not touch the fins on each side, so it's
  // really just floating there. It needs to fit properly"). Between twin
  // booms the drawn span was whatever the fin's height rows said, and the
  // tips stopped short of the booms or ran past them. The built sheet is
  // stretched along its span (about the root line, chords untouched) so the
  // tip lands on the boom's centre plane — inside the fin standing there
  // and inside the tube — plus the builder's overhang. Before the cut and
  // the thickening, so the measure, the join and the physics read the
  // panel that is drawn.
  if (TB && TB.x > 0) {
    let H = -Infinity;
    for (const p of s.V) H = Math.max(H, p[1] - rootLine);
    const want = (TB.x + Math.max(0, +P.stOver || 0)) / FSd - (P.stX || 0);
    if (H > 1e-6 && want > 0.05) {
      const k = want / H;
      s = Object.assign({}, s, { V: s.V.map(p => [p[0], rootLine + (p[1] - rootLine) * k, p[2]]) });
    }
  }
  // the root, dead straight WHERE THE FUSELAGE IS — aft of the cap the
  // strand is the elevator's inboard edge, and baseY may pull its TE end
  // outboard (the centre-apart clearance), so it must keep its shape
  FIN.finProjectRoot(s, m0.deckTop, S.deck.z0);
  let disp = s;
  if (cutMode)
    disp = FIN.finCutMesh(s, { mode: cutMode, zCut: m0.cutZ,
      gap: P.stCutGap || 0 });
  // THE MEASURE'S INPUT (TAIL CHANTIER 2, P0): the cut, UNTHICKENED sheet,
  // one panel, in FIN space before the lay — the solid carries both sides
  const sheet = disp;
  const solidOn = Math.round(P.stSolid === undefined ? 1 : P.stSolid);
  if (solidOn) {
    let zA = Infinity;
    for (const p of s.V) zA = Math.min(zA, p[2]);
    // `tailRimN` is the FIN's row, read here on purpose: the stab is the fin
    // model laid flat (G23), so one knob decides how round the tail's edges
    // are. Declared in _cage_fin.js, claimed there by the part table.
    disp = FIN.finThicken(disp, { thick: P.stThick || 0.05,
      thickTE: P.stThickTE, zHinge: m0.cutZ, zAftEnd: zA,
      rimN: P.tailRimN });
  }

  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const wire = $('wire') && $('wire').checked;
  const bySec = !$('color') || $('color').checked;
  group = new THREE.Group();
  // NAMED for the editor (G76/G77): the part table says which layer a
  // part lives in, and G79's raycast resolves a hit to a part through
  // that. One string, no behaviour.
  group.name = 'cageLayer:stab';
  const ex = cutMode ? Math.max(0, P.explodeD || 0) : 0;
  const lay = { rootX: P.stX || 0, stabY: yRef + (P.stY || 0),
                sRef: rootLine, zOff: zSeat + (P.stZ || 0), cant };
  for (const side of [1, -1]) {
    const half = FIN.finToStab(disp, Object.assign({ side }, lay));
    for (const part of cutMode ? ['fin', 'rudder'] : [null]) {
      const sub = part
        ? { V: half.V, F: half.F.filter(f => f.part === part) } : half;
      // the stab is the fin model laid flat, so it borrows finMesh — but it
      // is its OWN livery section pair, and only the caller knows that
      const obj = wire ? DRAW.finQuadWire(sub, bySec)
                       : DRAW.finMesh(sub, bySec,
                           part === 'rudder' ? 'stabElev' : 'stabSkin');
      if (part === 'rudder' && ex) obj.position.z = -ex;  // elevator, aft
      if (part === 'rudder')                               // G59
        obj.name = 'edSurf_elev' + (side > 0 ? 'R' : 'L');
      else obj.name = 'edStabSkin' + (side > 0 ? 'R' : 'L');   // G267.2: a part on twin booms
      group.add(obj);
    }
  }
  // G307: the saddle and the pedestal under a rod-mounted stab (metric
  // hardware in a child scaled back out of the group's cage units; tagged as
  // hardware so the join's bounds skip it)
  if (rodSeat && !wire && window.GEAR_KIT) {
    const K = window.GEAR_KIT, bag = K.Bag();
    const GS = (window.CAGE_GEAR && window.CAGE_GEAR.saddles) || [];
    const FSn = (window.CAGE_FIN_SADDLES) || [];
    const zS = rodSeat.z * FS;
    const shared = GS.find(g => Math.abs(g.z - zS) < 0.12) || FSn.find(g => Math.abs(g.z - zS) < 0.12);
    const zUse = shared ? shared.z : zS;
    const Wp = 2 * (P.stX || 0) * FS + 0.06, Lp = 0.09;
    const rec = RF.saddle(bag, { ctr: [0, 0.5 * (rodSeat.yT + rodSeat.yB) * FS, zUse], axis: [0, 0, -1],
                                 r: rodSeat.r * FS, collar: !shared, plate: { top: 1, W: Wp, L: Lp } });
    const under = (yRef + (P.stY || 0) - 0.5 * (P.stThick || 0.05)) * FS;
    const gap = rec && rec.top ? under - rec.top[1] : 0;
    if (gap > 0.005) RF.pedestal(bag, { base: rec.top, axis: [0, 0, -1], h: gap + 0.001, W: Wp * 0.8, L: Lp * 0.8 });
    const sad = new THREE.Group();
    sad.name = 'edSaddle_stab';
    sad.scale.setScalar(1 / FS);
    const m = bag.mesh(sad, DRAW.saddleMat ? DRAW.saddleMat() : new THREE.MeshLambertMaterial({ color: 0x8a9099 }));
    if (m) m.userData.edHw = 1;
    group.add(sad);
  }
  group.scale.setScalar(FS);
  scene.add(group);

  // THE LAY, published with the cage (2026-09-03). `cage` is in FIN space —
  // the stab is the fin model laid flat (G23) — so a caller holding a named
  // fin vertex cannot place it without the same `finToStab` opts this build
  // used. The editor's hover pin is the caller; `side` is its own (both).
  // `cant` (degrees) and `mount` ride along for the join: >= 20 deg of cant
  // is a V-tail (tail.type 'v', the physics' own ruddervator mix)
  // THE LAYER MEASURES, THE JOIN READS (TAIL CHANTIER 2, P0): ONE panel's
  // areas (the join doubles), its mean chord, the declared hinge — plus the
  // root half-track in METRES (stX is a cage-unit row applied before the
  // group's scale — the sweep once added it to metres unscaled) and the
  // cant/mount the join keys on. _tail_headless.js computes the same
  // object with no page; GATE FIN pins the two.
  window.CAGE_STAB = { spec: S, cage: m0, mesh: s, disp, lay,
    cant: cantDeg, mount,
    measure: Object.assign(
      FIN.finMeasure(sheet, { FS, zCut: m0.cutZ, cut: cutMode, hingeLine: m0.hingeLine }),
      { rootX: (P.stX || 0) * FS, cant: cantDeg, mount }),
    clamped: m0.clamped || [] };                     // P3: the clamps that bit
  if (stat) {
    let t = `  ·  stab: L${L} ${s.V.length} v x2`;
    if (cutMode) {
      const nf = disp.F.filter(f => f.part === 'fin').length;
      t += ` · elevator cut (${nf}/${disp.F.length - nf} q)`;
    }
    stat.textContent += t;
  }
};
})();
