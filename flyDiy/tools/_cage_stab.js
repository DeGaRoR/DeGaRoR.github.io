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
// from FIN_CUB so they cannot drift from the checked reference values
const ST2FIN = {
  stRootGuard: 'finRootGuard',
  stTipZ: 'finTipZ', stTipY: 'finTipY',
  stAftZ: 'finAftZ', stAftY: 'finAftY',
  stBaseZ: 'finBaseZ', stBaseY: 'finBaseY',
  stMidY: 'finMidY', stUY: 'finUY',
  stRootFwd: 'finRootFwd',
  stLEZ: 'finLEZ', stLEY: 'finLEY',
  stShoulderZ: 'finShoulderZ', stShoulderY: 'finShoulderY',
  stTopY: 'finTopY',
  stTERoot: 'finTERoot', stTEU: 'finTEU', stTEMid: 'finTEMid',
  stSharpTip: 'finSharpTip', stSharpAft: 'finSharpAft',
  stSharpBase: 'finSharpBase', stSharpShoulder: 'finSharpShoulder',
  stSharpLE: 'finSharpLE',
};
const stDef = { stOn: 1, stCut: 1, stCutGap: 0.012,
  stSolid: 1, stThick: 0.05, stThickTE: 0.012,
  stX: 0.05, stY: 0.25, stZ: 0, stCons: 0,
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
   ['as the aeroplane', 'composite', 'steel tube', 'plywood', 'aluminium'],
   { when: P => +P.stOn }],
  ['position', [
    ['stMount', 'root sits', 0, 2, 1,
     ['on the boom keel', 'on the boom deck', 'on the fin tip']],
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
  ['corners', [
    ['stTipZ',  'tip fore / aft (sweep)',     -0.60, 0.60, 0.005],
    ['stTipY',  'span (tip in / out)',     -0.80, 0.80, 0.005],
    ['stAftZ',  'tip-aft fore / aft', -0.50, 0.30, 0.005],
    ['stAftY',  'tip-aft in / out', -0.90, 0.60, 0.005],
    ['stBaseZ', 'root-aft fore / aft', -0.50, 0.30, 0.005],
    ['stBaseY', 'root-aft in / out', -0.15, 0.50, 0.005],
  ], 'open', { when: P => +P.stOn }],
  ['rows & points', [
    ['stRootFwd',   'root length (forward point)',   -1.20, 2.00, 0.005],
    ['stMidY',      'mid row in / out',          -0.80, 0.40, 0.005],
    ['stUY',        'u row in / out',            -0.40, 0.40, 0.005],
    ['stLEZ',       'LE root fore / aft', -0.80, 0.30, 0.005],
    ['stLEY',       'LE root in / out',    -0.20, 0.40, 0.005],
    ['stShoulderZ', 'shoulder fore / aft (of the tip)', -0.10, 0.50, 0.005],
    ['stShoulderY', 'shoulder in / out (over the mid row)',   -0.10, 0.30, 0.005],
    ['stTopY',      'tip pair bulge',   -0.30, 0.30, 0.005],
  ], { when: P => +P.stOn }],
  // positive root offset = the classic rudder-clearance notch: the
  // elevator's inboard TE eases forward so the rudder can swing; its
  // spanwise reach is the u row's position
  ['trailing edge', [
    ['stTERoot', 'root aft− / notch+', -0.40, 0.40, 0.005],
    ['stTEU',    'u bulge aft',    -0.40, 0.20, 0.005],
    ['stTEMid',  'mid bulge aft',  -0.40, 0.20, 0.005],
  ], { when: P => +P.stOn }],
  ['corner sharpness', [
    ['stSharpTip',      'tip',      0, 3, 0.05],
    ['stSharpAft',      'tip-aft',  0, 3, 0.05],
    ['stSharpBase',     'root-aft', 0, 3, 0.05],
    ['stSharpShoulder', 'shoulder', 0, 3, 0.05],
    ['stSharpLE',       'LE root',  0, 3, 0.05],
  ], { when: P => +P.stOn }],
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
  const deck = FIN.finCentreline(mesh, deckSkin);
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
  // the root, dead straight WHERE THE FUSELAGE IS — aft of the cap the
  // strand is the elevator's inboard edge, and baseY may pull its TE end
  // outboard (the centre-apart clearance), so it must keep its shape
  FIN.finProjectRoot(s, m0.deckTop, S.deck.z0);
  let disp = s;
  if (cutMode)
    disp = FIN.finCutMesh(s, { mode: cutMode, zCut: m0.cutZ,
      gap: P.stCutGap || 0 });
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
      group.add(obj);
    }
  }
  group.scale.setScalar(FS);
  scene.add(group);

  // THE LAY, published with the cage (2026-09-03). `cage` is in FIN space —
  // the stab is the fin model laid flat (G23) — so a caller holding a named
  // fin vertex cannot place it without the same `finToStab` opts this build
  // used. The editor's hover pin is the caller; `side` is its own (both).
  // `cant` (degrees) and `mount` ride along for the join: >= 20 deg of cant
  // is a V-tail (tail.type 'v', the physics' own ruddervator mix)
  window.CAGE_STAB = { spec: S, cage: m0, mesh: s, disp, lay,
    cant: cantDeg, mount };
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
