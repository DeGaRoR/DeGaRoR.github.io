// CAGE DESIGN — THE MACRO ROWS. The birth certificate's one declaration
// (futureDesigns/NEW-AIRCRAFT.md), beside _cage_parts.js for the same reason
// that file gives in its own header: several things read it and none of them
// is a panel.
//
//   the TILES        the creation flow, and the grid the properties panel
//                    shows when `Design & construction` is selected
//                    (src/viewer/design_flow.js renders; it never declares)
//   the ROWS         the raw params stay on their own sliders — a tile is a
//                    second rendering of state the panel already owns, never
//                    a second home for it
//   the ARCHETYPES   the named canonical builds are rows of this table with
//                    values filled in (GATE ARCHETYPES flies the live ones)
//   GATE DESIGN      tools/_design_check.js — every row claimed, every option
//                    writing something or carrying a reason, every written
//                    key real
//
// TWO KINDS OF ROW, and the test when unclear (NEW-AIRCRAFT §2):
//   discriminator    decides WHICH PARTS EXIST. Editable any time. Never
//                    destructive — undoing one makes controls disappear.
//   starter          writes a COHERENT SET OF VALUES, once. Applying it a
//                    second time overwrites hand-tuned work, so the renderer
//                    must state how many non-default values it is about to
//                    overwrite and the apply must be undoable as ONE step
//                    (`engPreset`'s own label is the precedent: "preset
//                    (applies once)").
//
// FOUR HONESTY FIELDS (G132, the multiplicity audit — futureDesigns/
// DESIGN-TAB-AUDIT-2026-08-31.md; "a tile is a second rendering of state,
// never a second home for it" was the law, these are its enforcement):
//   once: true       the row's read CANNOT faithfully recover what its
//                    options wrote (a lossy classifier, a multi-key seed) —
//                    so the renderer never lights a "current" tile off it:
//                    initialization that cannot claim to be state cannot
//                    go stale. GATE DESIGN skips these in read-fidelity.
//   arm: true        a discriminator whose options overwrite hand-tunable
//                    values (the canopy's hood pair) arms like a starter —
//                    the warn/undo contract follows the WRITE, not the kind.
//   seed: {...}      an option's ONE-SHOT half, beside its live `writes`:
//                    the birth flow and the archetypes apply both
//                    (designApply seeds:true); the panel's pick applies
//                    `writes` alone, and offers the seed as an explicit
//                    "apply the starting values" action. This is how role
//                    and class stopped being lit tiles claiming a geometry
//                    that sliders had long since walked away from.
//   pair: [...]      {cage, spec, via} — the row writes ONE FACT into both
//                    parameter homes, and `via` names what keeps them one:
//                    'join' (the join measures the cage side back into the
//                    spec — _join_check proves it behaviorally) or 'tile'
//                    (the tile is the only writer of both). GATE DESIGN
//                    asserts every dual-channel row declares its pairs.
//
// TWO WRITE CHANNELS, because the project has two parameter homes:
//   writes.cage      keys of the editor's P (CAGE_PARAMS + page defaults).
//                    A value may be a FUNCTION (P) => v, resolved against P
//                    with every earlier write already applied — that is how
//                    an archetype's wing patch can set the tip as a fraction
//                    of whatever chord the class just wrote (G140: the
//                    planform TILES retired; the fractions live on in the
//                    archetypes' over.cage).
//   writes.spec      a nested patch over the game spec (GARAGE_SPEC.update's
//                    shape). Paths must exist in GEN_DEFAULT; GATE DESIGN
//                    walks them.
//
// EVERYTHING IS LAZY. This file sits right after _cage_parts.js in
// MANIFEST.editor ("pure data, no deps"), which is BEFORE the layers that
// carry ENG_PAGE and the page defaults — so nothing here reads a table at
// load time. Options that depend on one (the engine models) are functions.
'use strict';
(function () {

// reach a global in either host — the _cage_parts.js ACC_FIT_KEYS pattern,
// one literal guard per name, because a top-level `const` in the page is a
// lexical global (never on window) while the gate's core lands on `global`
// and its panel tables land on the window SHIM. Each accessor runs at CALL
// time: this file loads before the layers that fill these in.
const W = (typeof window !== 'undefined') ? window
        : (typeof global !== 'undefined') ? global : {};
const gSect = () => (typeof genSect !== 'undefined') ? genSect : W.genSect;
const gCrownToN = () =>
  (typeof genCrownToN !== 'undefined') ? genCrownToN : W.genCrownToN;
const gTips = () => (typeof GEN_TIPS !== 'undefined') ? GEN_TIPS : W.GEN_TIPS;
const gFlaps = () =>
  (typeof GEN_FLAPS !== 'undefined') ? GEN_FLAPS : W.GEN_FLAPS;
const gEngPage = () =>
  (typeof ENG_PAGE !== 'undefined') ? ENG_PAGE : W.ENG_PAGE;

// ---------------------------------------------------------------------------
// THE ICON BUILDERS. Generated where geometry exists (§8.3), and the drawn
// ones are themselves parameterised off four tiny view builders, so a tile
// cannot drift from the choice it stands for the way sixty hand-drawn SVGs
// eventually would. Every builder returns { vb, paths: [{ d, fill? }] } —
// stroke styling belongs to the renderer, never to the declaration.
// ---------------------------------------------------------------------------
const P2 = (x, y) => x.toFixed(1) + ' ' + y.toFixed(1);

// a closed outline from points
const poly = pts => 'M' + pts.map(p => P2(p[0], p[1])).join(' L') + ' Z';

// SECTION PROFILE — the real generator's own section, swept. genSect gives
// [dy, dz] for one theta; the crown knobs go through genCrownToN exactly as
// the cage does it, so the four tiles are the four shapes the option builds.
function iconSection(topRound, botRound) {
  const gS = gSect(), gN = gCrownToN();
  const pts = [];
  const nTop = gN ? gN(topRound) : (2 + 6 * (1 - topRound));
  const nBot = gN ? gN(botRound) : (2 + 6 * (1 - botRound));
  for (let i = 0; i <= 40; i++) {
    const th = (i / 40) * Math.PI * 2;
    let dy, dz;
    if (gS) { [dy, dz] = gS(th, 22, 16, 14, nTop, nBot); }
    else { dy = Math.sin(th) * (Math.sin(th) > 0 ? 16 : 14); dz = Math.cos(th) * 22; }
    pts.push([32 + dz, 20 - dy]);
  }
  return { vb: '0 0 64 40', paths: [{ d: poly(pts) }] };
}

// TIP — the planform's outboard end with GEN_TIPS' own `bow` closing it on a
// half-ellipse, the same construction chordAt() uses (a winglet lifts the
// last station instead).
function iconTip(key) {
  const tab = gTips() || {};
  const t = tab[key] || { bow: 0, fin: 0 };
  const c = 16, semi = 52, y0 = 12, bow = t.bow * c;
  const pts = [[4, y0], [semi - bow, y0]];
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * Math.PI / 2;
    pts.push([semi - bow + Math.sin(a) * bow, y0 + c / 2 - Math.cos(a) * c / 2]);
  }
  for (let i = 8; i >= 1; i--) {
    const a = (i / 8) * Math.PI / 2;
    pts.push([semi - bow + Math.sin(a) * bow, y0 + c / 2 + Math.cos(a) * c / 2]);
  }
  pts.push([semi - bow, y0 + c], [4, y0 + c]);
  const paths = [{ d: poly(pts) }];
  if (t.fin) paths.push({ d: 'M' + P2(semi - 2, y0 + 2) + ' L' + P2(semi + 6, y0 - 8) });
  return { vb: '0 0 64 40', paths };
}

// FLAP — the classic trailing-edge cross-sections: none, hinged plain, the
// slotted gap, the fowler sliding aft. Drawn, because the generator prices a
// flap and does not draw its section.
function iconFlap(key) {
  const wing = 'M4 18 Q20 8 40 14 L40 22 Q20 26 4 24 Z';
  const p = [{ d: wing }];
  if (key === 'plain') p.push({ d: 'M40 15 L58 24 L40 21 Z' });
  if (key === 'slotted') p.push({ d: 'M43 17 L60 26 L44 23 Z' });
  if (key === 'fowler') p.push({ d: 'M46 20 L63 28 L47 26 Z' });
  return { vb: '0 0 64 40', paths: p };
}

// SIDE VIEW — one parameterised aeroplane profile. `o`: canopy 'screen' |
// 'half' | 'full' | 'none'; deck 'cabin' | 'turtle'; gear 'tail' | 'trike' |
// 'none'; tail 'conv' | 't' | 'v' | 'cruci' | 'twin'; pod (rod boom), radial
// (blunt nose), span (glider proportions). The DRAWN silhouettes all come out
// of this one builder so they read as one family.
function iconSide(o) {
  o = o || {};
  const paths = [];
  const noseX = 6, tailX = 58, keel = 26, deck = 18;
  let d = 'M' + P2(noseX, deck + 3);
  d += o.radial ? ' L' + P2(noseX, keel) : ' L' + P2(noseX + 2, keel);
  d += ' L' + P2(o.pod ? 34 : tailX - 4, keel + (o.pod ? 0 : -2));
  d += ' L' + P2(tailX, keel - 6);
  if (o.deck === 'turtle') d += ' L' + P2(30, deck - 2) + ' L' + P2(24, deck - 2);
  else d += ' L' + P2(26, deck) + ' L' + P2(22, deck);
  d += ' L' + P2(14, deck) + ' Z';
  paths.push({ d });
  if (o.pod) paths.push({ d: 'M32 24 L' + P2(tailX, keel - 6) });
  const cn = o.canopy;
  if (cn === 'screen') paths.push({ d: 'M22 18 L19 12 L15 18 Z' });
  if (cn === 'half') paths.push({ d: 'M15 18 Q20 11 27 18 Z' });
  if (cn === 'full') paths.push({ d: 'M14 18 Q21 6 29 18 Z' });
  const tl = o.tail || 'conv';
  if (tl === 'conv') paths.push({ d: 'M54 20 L58 8 L61 8 L61 20 Z' },
                                { d: 'M50 20 L64 18 L64 21 L50 22 Z' });
  if (tl === 't') paths.push({ d: 'M54 20 L58 6 L61 6 L61 20 Z' },
                             { d: 'M52 8 L66 8 L66 11 L52 11 Z' });
  if (tl === 'cruci') paths.push({ d: 'M54 20 L58 6 L61 6 L61 20 Z' },
                                 { d: 'M52 13 L66 13 L66 16 L52 16 Z' });
  if (tl === 'v') paths.push({ d: 'M54 20 L60 7 L63 8 L58 21 Z' });
  if (tl === 'twin') paths.push({ d: 'M50 20 L52 8 L55 8 L54 20 Z' },
                                { d: 'M50 21 L64 21 L64 24 L50 24 Z' });
  const gr = o.gear;
  if (gr === 'tail') paths.push({ d: 'M18 26 L18 33', w: 1 }, { d: 'M56 25 L56 30', w: 1 },
                                { d: 'M18 33 a3.2 3.2 0 1 0 0.1 0', w: 1 },
                                { d: 'M56 30 a1.8 1.8 0 1 0 0.1 0', w: 1 });
  if (gr === 'trike') paths.push({ d: 'M10 26 L10 32', w: 1 }, { d: 'M30 26 L30 32', w: 1 },
                                 { d: 'M10 32 a2.6 2.6 0 1 0 0.1 0', w: 1 },
                                 { d: 'M30 32 a2.6 2.6 0 1 0 0.1 0', w: 1 });
  if (o.bigTyres) paths.push({ d: 'M18 30 a5 5 0 1 0 0.1 0', w: 1 });
  // THE PROPELLER IS WHERE THE MOUNT PUTS IT (2026-09-04, the user: "the
  // pusher does not push"): `prop: true` stays the nose line; 'pusher' is
  // an engine block behind the pod with its disc aft; 'wingTop' a block on a
  // pylon over the deck, disc behind; 'twin' a nacelle on the wing line.
  const pr = o.prop === true ? 'nose' : o.prop;
  if (pr === 'nose') paths.push({ d: 'M4 10 L4 32', w: 1 });
  if (pr === 'pusher')
    paths.push({ d: 'M34 15 L40 15 L40 22 L34 22 Z', w: 1 },
               { d: 'M42 9 L42 28', w: 1 });
  if (pr === 'wingTop')
    paths.push({ d: 'M27 7 L34 7 L34 12 L27 12 Z', w: 1 },
               { d: 'M30 12 L30 18', w: 1 }, { d: 'M36 3 L36 16', w: 1 });
  if (pr === 'twin')
    paths.push({ d: 'M24 14 L32 14 L32 20 L24 20 Z', w: 1 },
               { d: 'M23 9 L23 25', w: 1 });
  // an open frame: the truss showing through the body
  if (o.open) paths.push({ d: 'M12 20 L31 25', w: 0.8 },
                         { d: 'M12 25 L31 20', w: 0.8 },
                         { d: 'M22 18 L22 26', w: 0.8 });
  return { vb: '0 0 68 40', paths };
}

// AN ARCHETYPE'S OWN ICON (2026-09-04): drawn from its selection, so the card
// shows the aeroplane it bakes — the pod, the tail, the gear and where the
// propeller is — instead of its size class's silhouette.
function archIcon(a) {
  const s = (a && a.sel) || {};
  const prop = s.engMount === 'pusher' ? 'pusher'
             : s.engMount === 'wingTop' ? 'wingTop'
             : s.engCount === 2 ? 'twin' : 'nose';
  return iconSide({
    canopy: s.canopy || 'screen',
    gear: s.gearLayout === 'trike' ? 'trike' : 'tail',
    tail: s.empennage || 'conv',
    pod: s.boomStyle === 1, prop,
    radial: s.engFamily === 'radial', open: s.covering === 'open',
    deck: s.mirror === 1 ? 'turtle' : undefined });
}

// FRONT VIEW — wing position and bracing.
function iconFront(pos, brace) {
  const paths = [];
  const y = pos === 'high' ? 12 : pos === 'mid' ? 19 : 26;
  paths.push({ d: 'M28 12 Q34 8 40 12 L40 28 Q34 32 28 28 Z' });
  paths.push({ d: poly([[2, y], [66, y], [66, y + 3], [2, y + 3]]) });
  if (brace === 'strut') paths.push({ d: 'M12 ' + (y + 3) + ' L30 27', w: 1 },
                                    { d: 'M56 ' + (y + 3) + ' L38 27', w: 1 });
  return { vb: '0 0 68 40', paths };
}

// TOP VIEW — seats and bays. THE BODY ELONGATES with the bay count (user,
// 2026-08-31: "your bay symbol should elongate... not simply subdivise") —
// each bay is fuselage you pay for, so the silhouette grows a segment per
// bay instead of ruling lines across a fixed one.
function iconSeats(layout, bays) {
  const n = bays || 0;
  const aft = 20 + n * 3.4;                    // where the cabin section ends
  const paths = [{ d: 'M30 2 Q38 6 38 12 L38 ' + aft.toFixed(1) +
    ' L33 ' + (aft + 5).toFixed(1) + ' L31 ' + (aft + 5).toFixed(1) +
    ' L26 ' + aft.toFixed(1) + ' L26 12 Q26 6 30 2 Z' }];
  const seat = (x, y) => paths.push({ d: 'M' + P2(x, y) + ' a3 3 0 1 0 0.1 0', w: 1 });
  if (layout === 'single') seat(32, 13);
  if (layout === 'side') { seat(29, 13); seat(35, 13); }
  if (layout === 'tandem') { seat(32, 10); seat(32, 16); }
  for (let i = 1; i <= n; i++)                 // each bay keeps its ring
    paths.push({ d: 'M26 ' + (20 + i * 3.4).toFixed(1) +
                    ' L38 ' + (20 + i * 3.4).toFixed(1), w: 1 });
  return { vb: '0 0 64 40', paths };
}

// TOP VIEW — the powerplant layout (user, 2026-08-31: "represent the plane
// from the top, with nose engine, wing engines and 3 engines, nose plus
// wings, and 4 engines on the wings"). Count and placement are ONE fact up
// here — a twin IS wing-mounted — which is why this row carries the wing-
// nacelle backlog and the mount row keeps only nose/pusher.
function iconTopEngines(nose, wingN) {
  const paths = [];
  paths.push({ d: 'M32 2 Q35 5 35 11 L35 29 L33 37 L31 37 L29 29 L29 11 ' +
                  'Q29 5 32 2 Z' });                       // body
  paths.push({ d: poly([[4, 15], [60, 15], [60, 19], [4, 19]]) });   // wing
  paths.push({ d: poly([[23, 33], [41, 33], [41, 36], [23, 36]]) }); // stab
  const eng = x => {
    paths.push({ d: poly([[x - 2, 9], [x + 2, 9], [x + 1.6, 19],
                          [x - 1.6, 19]]) });              // nacelle
    paths.push({ d: 'M' + P2(x - 5, 8) + ' L' + P2(x + 5, 8), w: 1.8 });
  };
  if (nose) paths.push({ d: 'M25 2 L39 2', w: 1.8 });      // the nose prop
  if (wingN === 2) { eng(17, 0); eng(47, 0); }
  if (wingN === 4) { eng(12, 0); eng(22, 0); eng(42, 0); eng(52, 0); }
  return { vb: '0 0 64 40', paths };
}

// swatch tiles carry their colour and no drawing
const iconSwatch = hex => ({ vb: '0 0 64 40',
  paths: [{ d: 'M6 4 L58 4 L58 36 L6 36 Z', fill: '#' + hex.toString(16).padStart(6, '0') }] });

// simple glyphs for the rest
const ICON = {
  engElectric: { vb: '0 0 64 40', paths: [{ d: 'M36 2 L20 24 L30 24 L26 38 L44 16 L33 16 Z' }] },
  engFlat: { vb: '0 0 64 40', paths: [{ d: 'M24 14 L40 14 L40 26 L24 26 Z' },
    { d: 'M4 16 L24 16 L24 24 L4 24 Z' }, { d: 'M40 16 L60 16 L60 24 L40 24 Z' }] },
  engInline: { vb: '0 0 64 40', paths: [{ d: 'M26 20 L38 20 L38 34 L26 34 Z' },
    { d: 'M28 6 L36 6 L36 20 L28 20 Z' }, { d: 'M40 24 a6 8 0 1 0 0.1 0', w: 1 }] },
  engVee: { vb: '0 0 64 40', paths: [{ d: 'M26 26 L38 26 L38 36 L26 36 Z' },
    { d: 'M26 26 L12 6 L20 4 L32 24 Z' }, { d: 'M38 26 L52 6 L44 4 L32 24 Z' }] },
  engRadial: { vb: '0 0 64 40', paths: [{ d: 'M32 20 a7 7 0 1 0 0.1 0' },
    ...[0, 1, 2, 3, 4, 5, 6].map(i => {
      const a = i * Math.PI * 2 / 7 - Math.PI / 2;
      return { d: 'M' + P2(32 + Math.cos(a) * 9, 20 + Math.sin(a) * 9) +
                  ' L' + P2(32 + Math.cos(a) * 17, 20 + Math.sin(a) * 17), w: 2 };
    })] },
  mountNose: iconSide({ canopy: 'screen', deck: 'cabin', gear: 'none', prop: true }),
  boomTwin: iconSide({ canopy: 'none', gear: 'none', tail: 'twin', pod: true }),
  // the covering tiles: a closed pod, and the same pod as a bare truss
  coverSkin: { vb: '0 0 64 40', paths: [{ d: 'M6 20 Q14 8 32 8 Q52 8 58 20 Q52 32 32 32 Q14 32 6 20 Z' }] },
  coverOpen: { vb: '0 0 64 40', paths: [
    { d: 'M6 20 Q14 8 32 8 Q52 8 58 20 Q52 32 32 32 Q14 32 6 20 Z', w: 1 },
    { d: 'M14 12 L50 28', w: 1 }, { d: 'M14 28 L50 12', w: 1 },
    { d: 'M32 8 L32 32', w: 1 }, { d: 'M20 10 L20 30', w: 1 }, { d: 'M44 10 L44 30', w: 1 }] },
  mountPusher: { vb: '0 0 68 40', paths: [{ d: 'M8 16 Q20 10 32 16 L32 26 Q20 30 8 26 Z' },
    { d: 'M32 21 L58 19' }, { d: 'M34 10 L34 30', w: 1 }] },
  // which way a wing engine faces: a nacelle on the wing line, the disc
  // ahead (puller) or behind (pusher); 'as the mount' shows both, dimmed
  aimPull: { vb: '0 0 64 40', paths: [{ d: 'M4 19 L60 19 L60 22 L4 22 Z' },
    { d: 'M26 13 L40 13 L40 27 L26 27 Z', w: 1 }, { d: 'M24 6 L24 34', w: 1.6 }] },
  aimPush: { vb: '0 0 64 40', paths: [{ d: 'M4 19 L60 19 L60 22 L4 22 Z' },
    { d: 'M24 13 L38 13 L38 27 L24 27 Z', w: 1 }, { d: 'M40 6 L40 34', w: 1.6 }] },
  aimMount: { vb: '0 0 64 40', paths: [{ d: 'M4 19 L60 19 L60 22 L4 22 Z' },
    { d: 'M26 13 L38 13 L38 27 L26 27 Z', w: 1 }, { d: 'M24 8 L24 32', w: 0.8 },
    { d: 'M40 8 L40 32', w: 0.8 }] },
  // the over-the-wing pusher: a pod, the wing line, a pylon and a disc above
  mountWingTop: { vb: '0 0 68 40', paths: [{ d: 'M8 24 Q20 18 34 24 L34 32 Q20 36 8 32 Z' },
    { d: 'M14 22 L62 22', w: 2 }, { d: 'M34 22 L36 12 L44 12', w: 1 },
    { d: 'M46 4 L46 20', w: 1 }] },
  fixed: { vb: '0 0 64 40', paths: [{ d: 'M30 6 L34 6 L34 24 L30 24 Z' },
    { d: 'M32 26 a5 5 0 1 0 0.1 0', w: 1 }] },
  retract: { vb: '0 0 64 40', paths: [{ d: 'M30 6 L34 6 L34 14 L30 14 Z' },
    { d: 'M34 14 L48 24', w: 1 }, { d: 'M48 24 a5 5 0 1 0 0.1 0', w: 1 }] },
  suspBungee: { vb: '0 0 64 40', paths: [{ d: 'M20 8 L44 8', w: 2 },
    ...[0, 1, 2, 3].map(i => ({ d: 'M' + (24 + i * 5) + ' 8 a2.5 4 0 1 0 0.1 0', w: 1 })),
    { d: 'M32 16 L32 34', w: 1 }] },
  suspSpring: { vb: '0 0 64 40', paths: [{ d: 'M14 8 Q32 26 50 8', w: 2 },
    { d: 'M14 12 Q32 30 50 12', w: 1 }] },
  suspOleo: { vb: '0 0 64 40', paths: [{ d: 'M28 6 L36 6 L36 20 L28 20 Z' },
    { d: 'M30 20 L34 20 L34 34 L30 34 Z' }, { d: 'M26 22 L38 26', w: 1 }] },
  fairNone: { vb: '0 0 64 40', paths: [{ d: 'M32 8 L32 22', w: 1 },
    { d: 'M32 22 a6 6 0 1 0 0.1 0', w: 1 }] },
  fairSpat: { vb: '0 0 64 40', paths: [{ d: 'M32 8 L32 20', w: 1 },
    { d: 'M20 24 Q32 14 46 24 L40 32 L24 32 Z' }] },
  fairFull: { vb: '0 0 64 40', paths: [{ d: 'M28 6 Q20 22 22 30 L44 30 Q44 14 34 6 Z' }] },
  conCompo: { vb: '0 0 64 40', paths: [{ d: 'M8 8 L56 8 L56 32 L8 32 Z', w: 1 },
    { d: 'M8 20 Q32 12 56 20', w: 1 }, { d: 'M8 26 Q32 18 56 26', w: 1 }] },
  conTube: { vb: '0 0 64 40', paths: [{ d: 'M8 10 L56 10 L56 30 L8 30 Z', w: 1 },
    { d: 'M8 10 L24 30 M24 30 L40 10 M40 10 L56 30', w: 1 }] },
  conPly: { vb: '0 0 64 40', paths: [{ d: 'M8 8 L56 8 L56 32 L8 32 Z', w: 1 },
    { d: 'M14 8 L14 32 M26 8 L26 32 M38 8 L38 32 M50 8 L50 32', w: 1 }] },
  conAlu: { vb: '0 0 64 40', paths: [{ d: 'M8 8 L56 8 L56 32 L8 32 Z', w: 1 },
    { d: 'M8 20 L56 20', w: 1 },
    ...[12, 22, 32, 42, 52].map(x => ({ d: 'M' + x + ' 11 a1 1 0 1 0 0.1 0', w: 1 })),
    ...[12, 22, 32, 42, 52].map(x => ({ d: 'M' + x + ' 27 a1 1 0 1 0 0.1 0', w: 1 }))] },
  seatTube: { vb: '0 0 64 40', paths: [{ d: 'M22 6 L26 6 L26 24 L44 24 L44 34 L18 34 L18 24 L22 24 Z', w: 1 }] },
  seatShell: { vb: '0 0 64 40', paths: [{ d: 'M24 4 Q18 20 22 26 L42 26 L44 34 L18 34 Q14 18 24 4 Z' }] },
  seatAirliner: { vb: '0 0 64 40', paths: [{ d: 'M22 4 L30 4 L30 24 L46 24 L46 34 L18 34 L18 4 Z' },
    { d: 'M22 8 L28 8', w: 1 }] },
  boomLoft: { vb: '0 0 68 40', paths: [{ d: 'M6 14 Q30 10 62 17 L62 23 Q30 30 6 28 Z' }] },
  boomRod: { vb: '0 0 68 40', paths: [{ d: 'M6 14 Q18 10 30 16 L30 26 Q18 30 6 28 Z' },
    { d: 'M30 20 L62 19 L62 22 L30 24 Z' }] },
  schemeBare: { vb: '0 0 64 40', paths: [{ d: 'M6 10 L58 10 L58 30 L6 30 Z', w: 1 }] },
  schemeTrim: { vb: '0 0 64 40', paths: [{ d: 'M6 10 L58 10 L58 30 L6 30 Z', w: 1 },
    { d: 'M6 24 L58 20 L58 24 L6 28 Z' }] },
  schemeSweep: { vb: '0 0 64 40', paths: [{ d: 'M6 10 L58 10 L58 30 L6 30 Z', w: 1 },
    { d: 'M6 18 Q30 26 58 14 L58 24 Q30 34 6 28 Z' }] },
};

// ---------------------------------------------------------------------------
// THE CLASSES (§5.2). Five live, three declared with the §5.2 decision's own
// reason. The figures are game-facing approximations of the real categories,
// and the class is A LABEL, NOT A CONSTRAINT — an ultralight that weighs
// 900 kg is gameplay information, not an error. The writes lean on the page's
// own measured cabin numbers (the seating STARTER table in _cage_page5.js)
// rather than inventing new ones.
//
// `preset` is an ENGINE PRESET NAME, applied through the same edge-detected
// `engPreset` mechanism the row uses, so a class cannot fit an engine the
// panel could not.
// ---------------------------------------------------------------------------
// 2026-09-04: the envelope opened for the SAILPLANE — clampSpec holds the wing
// to 6.5–18 m span and 0.80–2.10 m chord now (aspect ratio to 20); the
// utility class stays out for its own measured reason.
const ENV_REASON = 'outside the buildable envelope: clampSpec holds the wing ' +
  'to 6.5–18 m span and 0.80–2.10 m chord';
const UTIL_REASON = 'the R-1830 class: no airframe the clamps allow can carry ' +
  'it (measured 2026-08-31 — the tourer could not be landed); wants the ' +
  'heavy-structure chantier';

const CLASS_ROWS = [
  { value: 'rc', label: 'RC model', note: 'park flyer → large sport',
    inactive: ENV_REASON, icon: iconSide({ canopy: 'none', gear: 'trike', prop: true }) },
  // MEASURED (2026-08-31): the Rotax 277 cannot climb what the cage BILLS
  // for even the smallest buildable airframe — empty 208 kg where a US-103
  // frame is ~115, climbRate 0.09 m/s, take-off rejected by the test pilot.
  // The class fits the 582 until a lighter-structure chantier exists; the
  // 277 stays on the family list for builders who want to learn why.
  // G132: the LABEL is the live write; everything the class used to pour
  // over the sliders is its SEED — birth and archetypes take both, the
  // panel takes the label and offers the seed as an explicit action
  { value: 'ul1', label: 'Ultralight (single seat)', note: '~180 kg · 1 seat',
    icon: iconSide({ canopy: 'none', deck: 'turtle', gear: 'tail', pod: true, prop: true }),
    writes: { spec: { meta: { class: 'ul1' } } },
    seed: { cage: { wgSpan: 9.4, wgChord: 1.45, wgChordTip: 1.45,
                    seatLayout: 0, paxCount: 0, halfW: 0.33, roofHalfW: 0.26,
                    pilotLen: 0.42, intCons: 1, engPreset: 'rotax 582' },
            spec: { fuel: { litres: 20 },
                    systems: { fit: 'minimal' }, cabin: { baggage: 0 } } } },
  { value: 'ulm', label: 'Microlight / ULM', note: '472–600 kg · 2 seats',
    icon: iconSide({ canopy: 'screen', gear: 'tail', prop: true }),
    writes: { spec: { meta: { class: 'ulm' } } },
    // 2026-09-04 (the user: "your side by side setups are generally too
    // narrow, and the pilots stick out from the sides"): 1.12 m across at the
    // waist and 0.94 at the roof — two pairs of shoulders fit
    seed: { cage: { wgSpan: 9.2, wgChord: 1.45, wgChordTip: 1.45,
                    seatLayout: 1, paxCount: 1, halfW: 0.56, roofHalfW: 0.47,
                    pilotLen: 0.42, paxLen: 0.91, intCons: 1,
                    engPreset: 'rotax 582' },
            spec: { fuel: { litres: 50 },
                    systems: { fit: 'basic' }, cabin: { baggage: 10 } } } },
  { value: 'lsa', label: 'Light Sport', note: '600 kg · 2 seats · 45 kt stall',
    icon: iconSide({ canopy: 'half', gear: 'trike', prop: true }),
    writes: { spec: { meta: { class: 'lsa' } } },
    seed: { cage: { wgSpan: 9.0, wgChord: 1.40, wgChordTip: 1.15,
                    seatLayout: 1, paxCount: 1, halfW: 0.56, roofHalfW: 0.47,
                    pilotLen: 0.42, paxLen: 0.91, intCons: 3,
                    engPreset: 'rotax 912 (flat)' },
            spec: { fuel: { litres: 65 },
                    systems: { fit: 'basic' }, cabin: { baggage: 15 } } } },
  { value: 'eab', label: 'Experimental (amateur-built)', note: 'Jodel · Cub · RV',
    icon: iconSide({ canopy: 'screen', deck: 'cabin', gear: 'tail', prop: true }),
    writes: { spec: { meta: { class: 'eab' } } },
    seed: { cage: { wgSpan: 9.8, wgChord: 1.55, wgChordTip: 1.55,
                    seatLayout: 2, paxCount: 1, halfW: 0.34, roofHalfW: 0.27,
                    pilotLen: 0.42, paxLen: 0.85, intCons: 1,
                    engPreset: 'continental O-200' },
            spec: { fuel: { litres: 70 },
                    systems: { fit: 'basic' }, cabin: { baggage: 20 } } } },
  { value: 'n23', label: 'Normal category', note: 'C172 · DR400 · 4 seats',
    icon: iconSide({ canopy: 'screen', gear: 'trike', prop: true }),
    writes: { spec: { meta: { class: 'n23' } } },
    seed: { cage: { wgSpan: 11.0, wgChord: 1.60, wgChordTip: 1.15,
                    seatLayout: 1, paxCount: 3, halfW: 0.59, roofHalfW: 0.49,
                    pilotLen: 0.45, paxLen: 0.95, intCons: 3,
                    engPreset: 'lycoming IO-360' },
            spec: { fuel: { litres: 120 },
                    systems: { fit: 'ifr' }, cabin: { baggage: 40 } } } },
  { value: 'util', label: 'Utility / cargo', note: 'Beaver · DC-3',
    inactive: UTIL_REASON, icon: iconSide({ canopy: 'screen', gear: 'tail', radial: true, prop: true }) },
  // 2026-09-04: LIVE (the user: "we have a sailplane model from the old days
  // ... and electrical engines"). A single seat under a full canopy, a slender
  // 15 m wing at 1.0 m chord tapering to 0.55, composite, no fuel — the
  // sustainer is electric.
  { value: 'sail', label: 'Sailplane / motorglider', note: '15–18 m span',
    icon: iconSide({ canopy: 'full', deck: 'turtle', gear: 'none', pod: true }),
    writes: { spec: { meta: { class: 'sail' } } },
    seed: { cage: { wgSpan: 15.0, wgChord: 1.00, wgChordTip: 0.55,
                    seatLayout: 0, paxCount: 0, halfW: 0.33, roofHalfW: 0.26,
                    pilotLen: 0.42, intCons: 0, engPreset: 'FES sustainer' },
            spec: { fuel: { litres: 0 },
                    systems: { fit: 'minimal' }, cabin: { baggage: 0 } } } },
];

// ---------------------------------------------------------------------------
// THE ROLES (§5.1). An INTENTION, not a geometry: what gives every other
// choice a meaning, and the hook P5 (missions) and P6 (the WHY report) will
// read. Writes are DEFAULTS AND NOTHING MORE — ROADMAP P8 §3's ruling stands,
// role never clamps.
//
// `targets` are DECLARED NOW AND READ BY NOTHING (the §5.1 decision): each in
// the unit genShakedown already returns for that key — speeds m/s, TORun m,
// climbRate m/s, climbGrad %, wingLoad kg/m², powerLoad kg/kW, staticMargin a
// fraction of chord, payload kg. GATE DESIGN holds the key set to the
// shakedown's own; GATE ARCHETYPES prints (never judges) the distance. RANGE
// and ENDURANCE are deliberately absent until the energy arc produces them.
// ---------------------------------------------------------------------------
const FLAP_IDX = { none: 0, plain: 1, slotted: 2, fowler: 3 };

// G132: a role's LABEL is its live write — the tile can stay lit for ever
// because it claims only the intention. The geometry it used to pour over
// the sliders is its SEED, applied at birth and on explicit request, so
// "Aerobatic" lighting up over a strut-braced high-wing you built since is
// the honest state of affairs (the gap is content), not a stale claim.
const ROLE_ROWS = [
  { value: 'bush', label: 'Bush', note: 'short field, rough ground, load',
    icon: iconSide({ canopy: 'screen', gear: 'tail', bigTyres: true, prop: true }),
    writes: { spec: { meta: { role: 'bush' } } },
    seed: { cage: { wgFlapType: FLAP_IDX.slotted, wgPos: 0, wgBrace: 0,
                    s1R: 0.26 } },
    // climbGrad is a FRACTION on the shakedown's sheet (measured 0.10 on
    // the Cub-alike run), not a percent — §5.1's whole point of declaring
    // targets in the instrument's own units, caught by the first printout
    targets: { TORun: 180, Vs: 13, climbGrad: 0.12 } },
  { value: 'touring', label: 'Touring', note: 'distance, comfort, speed',
    icon: iconSide({ canopy: 'screen', gear: 'trike', prop: true }),
    writes: { spec: { meta: { role: 'touring' } } },
    seed: { cage: { wgBrace: 1, wgFlapType: FLAP_IDX.plain, s1Fair: 1 },
            spec: { fuel: { litres: 90 } } },
    targets: { VCruise: 50, LD: 12, TORun: 420 } },
  { value: 'aerobatic', label: 'Aerobatic', note: 'strength and roll rate',
    icon: iconSide({ canopy: 'full', deck: 'turtle', gear: 'tail', prop: true }),
    writes: { spec: { meta: { role: 'aerobatic' } } },
    seed: { cage: { wgPos: 2, wgBrace: 1, wgCamber: 0, wgTipX: 0,
                    wgAilSpan: 0.5, wgAilChord: 0.30,
                    wgFlapType: FLAP_IDX.none } },
    targets: { climbRate: 8, wingLoad: 60, staticMargin: 0.08 } },
  { value: 'glider', label: 'Glider', note: 'L/D above all',
    icon: iconSide({ canopy: 'full', deck: 'turtle', gear: 'none', pod: true }),
    writes: { spec: { meta: { role: 'glider' } } },
    seed: { cage: { wgBrace: 1, wgFlapType: FLAP_IDX.none, wgAilSpan: 0.45 },
            spec: { fuel: { litres: 5 } } },
    targets: { LD: 22, Vs: 16, wingLoad: 34 } },
  { value: 'cargo', label: 'Cargo', note: 'payload and volume',
    icon: iconSide({ canopy: 'screen', gear: 'tail', tail: 'conv', prop: true }),
    writes: { spec: { meta: { role: 'cargo' } } },
    seed: { cage: { wgPos: 0, wgBrace: 0 },
            spec: { cargo: { len: 1.0 } } },
    targets: { payload: 350, TORun: 500, VCruise: 42 } },
  { value: 'trainer', label: 'Trainer', note: 'forgiving, cheap — the middle of everything',
    icon: iconSide({ canopy: 'screen', gear: 'trike', prop: true }),
    // the trainer deliberately seeds almost nothing: the middle of
    // everything IS the default aeroplane
    writes: { spec: { meta: { role: 'trainer' } } },
    seed: { spec: { systems: { fit: 'basic' } } },
    targets: { Vs: 15, TORun: 300, staticMargin: 0.15 } },
];

// ---------------------------------------------------------------------------
// THE ENGINE MODELS (§6), lazily: ENG_PAGE loads after this file. The family
// of a preset is its own `arch` (default flat; electric marks itself), so the
// filter cannot disagree with what applying the preset builds.
// NOTE the CORRECTION to the spec, measured 2026-08-31: the two-stroke split
// ALREADY EXISTS and IS the inline row (`_eng_page.js` labels the arch
// 'inline (2-stroke)' and `_eng_mesh.js` forces twoStroke=1) — Rotax 277/582
// are its two models, not orphans. And `flat` has EIGHT models, not six.
// ---------------------------------------------------------------------------
function designEngineFamilies() {
  return [
    { value: 'electric', label: 'Electric', icon: ICON.engElectric,
      writes: { cage: { engPower: 1 } } },
    { value: 'inline', label: 'Two-stroke (inline)', icon: ICON.engInline,
      writes: { cage: { engPower: 0, eng_arch: 1 } } },
    { value: 'flat', label: 'Flat (boxer)', icon: ICON.engFlat,
      writes: { cage: { engPower: 0, eng_arch: 0 } } },
    { value: 'vee', label: 'V engine', icon: ICON.engVee,
      inactive: 'no registry model, and ENG_ARCH marks the row UNVALIDATED ' +
        '— the seam where the procedural engine generator arrives' },
    { value: 'radial', label: 'Radial', icon: ICON.engRadial,
      writes: { cage: { engPower: 0, eng_arch: 2 } } },
  ];
}

// preset name -> family key, from the preset table itself
function designPresetFamily(name) {
  const EP = gEngPage();
  const p = EP && EP.PRESETS && EP.PRESETS[name];
  return (p && p.arch) || 'flat';
}

// the model options, each carrying its family for the tile filter; `value`
// is the PRESET'S NAME — designApply resolves it to the panel's own index so
// a reordered preset list cannot silently re-engine every archetype.
function designEngineModels() {
  const EP = gEngPage();
  if (!EP || !EP.PRESETS) return [];
  return Object.keys(EP.PRESETS).filter(n => n !== 'bare engine').map(n => ({
    value: n, label: n, family: designPresetFamily(n),
    writes: { cage: { engPreset: n } },
  }));
}

// engPreset is an INDEX into the panel's filtered name list; resolve a name
function designPresetIndex(name) {
  const EP = gEngPage();
  if (!EP || !EP.PRESETS) return null;
  const names = Object.keys(EP.PRESETS).filter(n => n !== 'bare engine');
  const i = names.indexOf(name);
  return i >= 0 ? i : null;
}

// ---------------------------------------------------------------------------
// THE ROWS (§5, with the 2026-08-31 verification's corrections applied).
//
//   key      stable id (a param key where one param carries the row)
//   kind     'discriminator' | 'starter' | 'field'
//   group    the tile grid's headings, in DESIGN_GROUPS order
//   status   'live' | 'declared' — GATE DESIGN counts both
//   help     ONE line under the row heading (per-tile prose turns a grid
//            into a form — §8.2)
//   read     (P, S) => the option value currently in force; S is the game
//            spec (may be null on the first host)
//   options  [{ value, label, icon, note?, writes?, inactive?, def? }]
//            `def: true` marks the option that IS the current sole live
//            state and therefore writes nothing (the mount's 'nose').
//
// NOT ROWS, by ruling:
//   name             the save-slot name IS meta.name (G65, garage.js — a
//                    birth-flow name field would be a second writer)
//   cabin.seating    DERIVED by the join from paxCount + seatLayout (§5.3)
//   cabin.pilots/pax LOADINGS, not birth settings
// ---------------------------------------------------------------------------
const DESIGN_GROUPS = ['identity', 'cabin', 'structure', 'wing', 'propulsion',
                       'tail', 'undercarriage', 'livery'];

const DESIGN_ROWS = [

  // ---- identity -----------------------------------------------------------
  { key: 'reg', label: 'Registration', kind: 'field', group: 'identity',
    status: 'live', help: 'painted along the boom; paint.regX places it',
    specPath: ['meta', 'reg'], maxLen: 8 },

  // G132: role and class are DISCRIMINATORS over their labels now — the
  // pick writes meta and nothing else, so the lit tile is always true. The
  // one-shot geometry lives in each option's `seed` (birth applies it; the
  // panel offers it as an explicit action).
  { key: 'role', label: 'Role', kind: 'discriminator', group: 'identity',
    status: 'live',
    help: 'an intention, not a geometry — the label is live, the starting ' +
          'values apply on request, and missions will judge the gap',
    read: (P, S) => S && S.meta && S.meta.role || null,
    options: ROLE_ROWS },

  { key: 'class', label: 'Size class', kind: 'discriminator',
    group: 'identity', status: 'live',
    help: 'a label, not a constraint — the gap between the declared ' +
          'class and the built aeroplane is content',
    read: (P, S) => S && S.meta && S.meta.class || null,
    options: CLASS_ROWS },

  // ---- cabin --------------------------------------------------------------
  { key: 'seatLayout', label: 'Seat arrangement', kind: 'discriminator',
    group: 'cabin', status: 'live',
    help: 'the join derives the seating table from this and the bays — ' +
          'there is no separate seating control on purpose',
    read: P => Math.round(P.seatLayout),
    options: [
      { value: 0, label: 'Single', icon: iconSeats('single'),
        writes: { cage: { seatLayout: 0 } } },
      { value: 1, label: 'Side-by-side', icon: iconSeats('side'),
        writes: { cage: { seatLayout: 1 } } },
      { value: 2, label: 'Tandem', icon: iconSeats('tandem'),
        writes: { cage: { seatLayout: 2 } } },
    ] },

  // labelled by what they BUILD, never by what they seat: bays 1 and 2 both
  // give a two-seater, 3 and 4 both a four-seater (the §5.3 finding — real
  // structure, real drag, and no extra crew billed until GEN_SEATING grows)
  { key: 'paxCount', label: 'Passenger bays', kind: 'discriminator',
    group: 'cabin', status: 'live',
    help: 'each bay is fuselage you pay for; seats follow the seating table',
    read: P => Math.round(P.paxCount),
    options: [0, 1, 2, 3, 4].map(n => ({
      value: n, label: n === 0 ? 'No bay' : n + (n === 1 ? ' bay' : ' bays'),
      icon: iconSeats(null, n), writes: { cage: { paxCount: n } } })) },

  // TWO questions, not one (§5.3): `canopy` is the glazing, `mirror` is what
  // the top of the fuselage does BEHIND the cockpit, and all four
  // combinations are real aeroplanes.
  //
  // The half/full bubble pair is ONE discriminator value plus a STARTER over
  // the shell's own controls. CORRECTED against _cage_gen.js (2026-08-31):
  // `bubH` rises off the SILL RAILS and its floor is 0.2 (the "0 = flush"
  // prose the spec quoted belongs to the DEAD spec.cabin.canopy.height) — so
  // a half-bubble is bubH near the floor with bubW flush, not a zero.
  { key: 'canopy', label: 'Canopy style', kind: 'discriminator',
    group: 'cabin', status: 'live', arm: true,
    // arm (G132): the bubble pair writes bubH/bubW/canLoops — a hand-tuned
    // hood deserves the same warning a starter gives, whatever the kind
    help: 'convertible and open stay on the slider (kept for later)',
    read: P => {
      const c = Math.round(P.canopy);
      if (c !== 3) return c === 0 ? 'screen' : null;
      return +P.bubH < 0.55 ? 'half' : 'full';
    },
    options: [
      { value: 'screen', label: 'Windscreen',
        icon: iconSide({ canopy: 'screen', gear: 'none' }),
        note: 'no cut, no shell — the body’s own glazing',
        writes: { cage: { canopy: 0 } } },
      { value: 'half', label: 'Half bubble',
        icon: iconSide({ canopy: 'half', gear: 'none' }),
        note: 'a hood let into the deck',
        writes: { cage: { canopy: 3, bubH: 0.30, bubW: 1.0, canLoops: 1 } } },
      { value: 'full', label: 'Full bubble',
        icon: iconSide({ canopy: 'full', gear: 'none' }),
        note: 'a blown hood standing proud',
        writes: { cage: { canopy: 3, bubH: 0.79, bubW: 1.25, canLoops: 1 } } },
    ] },

  // the key stays `mirror` (it rides spec.cage into every save; renaming it
  // is a migration, renaming the LABEL is a string — §5.3's own ruling). The
  // label is the shape, not the mechanism.
  { key: 'mirror', label: 'Body & deck', kind: 'discriminator',
    group: 'cabin', status: 'live',
    help: 'what the fuselage top does behind the cockpit',
    read: P => Math.round(P.mirror),
    options: [
      { value: 0, label: 'Cabin',
        icon: iconSide({ canopy: 'screen', deck: 'cabin', gear: 'none' }),
        note: 'the roof runs aft to the boom — Cub, C172',
        writes: { cage: { mirror: 0 } } },
      { value: 1, label: 'Turtledeck',
        icon: iconSide({ canopy: 'full', deck: 'turtle', gear: 'none' }),
        note: 'the deck falls away and the cockpit stands proud — ' +
              'Spitfire, RV-4',
        writes: { cage: { mirror: 1 } } },
    ] },

  { key: 'seatType', label: 'Interior style', kind: 'starter',
    group: 'cabin', status: 'live',
    help: 'the seats; headliner, console and trim are owed to a later pass',
    read: P => Math.round(P.seatType),
    options: [
      { value: 0, label: 'Tube frame', icon: ICON.seatTube,
        writes: { cage: { seatType: 0, seatBelt: 1 } } },
      { value: 1, label: 'Composite shell', icon: ICON.seatShell,
        writes: { cage: { seatType: 1, seatBelt: 1 } } },
      { value: 2, label: 'Airliner', icon: ICON.seatAirliner,
        writes: { cage: { seatType: 2, seatBelt: 1 } } },
    ] },

  // ---- structure ----------------------------------------------------------
  { key: 'intCons', label: 'Construction', kind: 'discriminator',
    group: 'structure', status: 'live',
    help: 'what the aeroplane is made of; each surface can override later',
    read: P => Math.round(P.intCons),
    options: [
      { value: 0, label: 'Composite', icon: ICON.conCompo,
        writes: { cage: { intCons: 0 } } },
      { value: 1, label: 'Steel tube', icon: ICON.conTube,
        writes: { cage: { intCons: 1 } } },
      { value: 2, label: 'Plywood', icon: ICON.conPly,
        writes: { cage: { intCons: 2 } } },
      { value: 3, label: 'Aluminium', icon: ICON.conAlu,
        writes: { cage: { intCons: 3 } } },
    ] },

  { key: 'boomStyle', label: 'Fuselage style', kind: 'discriminator',
    group: 'structure', status: 'live',
    help: 'the taper section stays its own switch on the slider',
    read: P => Math.round(P.boomStyle),
    options: [
      { value: 0, label: 'Lofted skin', icon: ICON.boomLoft,
        writes: { cage: { boomStyle: 0 } } },
      // 2026-09-04 (the user): "the rod settings should automatically turn
      // the taper section on. It can be removed manually afterwards"
      { value: 1, label: 'Rod & pod', icon: ICON.boomRod,
        note: 'an always-bare tube carries the tail; the taper section comes on with it',
        writes: { cage: { boomStyle: 1, taperOn: 1 } } },
      // 2026-09-04 (TWIN-BOOM spec §1.1/1.3): the pod ends at the bulkhead,
      // two booms off the wing carry a fin each, the stab between them
      { value: 2, label: 'Twin booms', icon: ICON.boomTwin,
        note: 'two booms off the wing, a fin each, the stab between them',
        writes: { cage: { boomStyle: 2, taperOn: 1, stMount: 3, stX: 0,
                          stCant: 0, finOn: 1 } } },
    ] },

  // THE COVERING (2026-09-04, the user: "ability to remove all fuselage and
  // interior skin, naked structure"). `skinOn` is the one row (Structure &
  // skin > covering); the open tile also switches the interior structure ON,
  // because with the skin culled the drawn truss is the interior pass's
  // (nothing else draws a member). JOINED: fuselage.covering.
  { key: 'covering', label: 'Covering', kind: 'discriminator',
    group: 'structure', status: 'live',
    help: 'an open frame flies lighter and draggier — the truss is the airframe',
    read: P => (P.skinOn == null || +P.skinOn) ? 'skin' : 'open',
    options: [
      { value: 'skin', label: 'Covered', icon: ICON.coverSkin,
        writes: { cage: { skinOn: 1 } } },
      { value: 'open', label: 'Open frame', icon: ICON.coverOpen,
        note: 'no fuselage covering, no liner — the truss in the wind',
        writes: { cage: { skinOn: 0, intOn: 1, intPillars: 1 } } },
    ] },

  { key: 'section', label: 'Section profile', kind: 'starter',
    group: 'structure', status: 'live', once: true,
    help: 'a starting point, not a cage — the roundness stays continuous',
    read: P => (+P.topRound >= 0.5 ? 1 : 0) + (+P.botRound >= 0.5 ? 2 : 0),
    options: [
      { value: 0, label: 'Box', icon: iconSection(0, 0),
        writes: { cage: { topRound: 0, botRound: 0 } } },
      { value: 1, label: 'Round top', icon: iconSection(1, 0),
        writes: { cage: { topRound: 1, botRound: 0, topAngCeil: 45,
                          topAngRoof: 78 } } },
      { value: 2, label: 'Round bottom', icon: iconSection(0, 1),
        writes: { cage: { topRound: 0, botRound: 1, topAngCeil: 45,
                          topAngRoof: 78 } } },
      { value: 3, label: 'Round', icon: iconSection(1, 1),
        writes: { cage: { topRound: 1, botRound: 1, topAngCeil: 45,
                          topAngRoof: 81 } } },
    ] },

  // ---- wing ---------------------------------------------------------------
  { key: 'wgPos', label: 'Wing position', kind: 'discriminator',
    group: 'wing', status: 'live',
    read: P => Math.round(P.wgPos),
    options: [
      { value: 0, label: 'High', icon: iconFront('high'),
        writes: { cage: { wgPos: 0 } } },
      { value: 1, label: 'Mid', icon: iconFront('mid'),
        writes: { cage: { wgPos: 1 } } },
      { value: 2, label: 'Low', icon: iconFront('low'),
        writes: { cage: { wgPos: 2 } } },
    ] },

  { key: 'wgBrace', label: 'Bracing', kind: 'discriminator',
    group: 'wing', status: 'live',
    help: 'cantilever buys a real spar box; struts buy their drag',
    read: P => Math.round(P.wgBrace),
    options: [
      { value: 0, label: 'Lift struts', icon: iconFront('high', 'strut'),
        writes: { cage: { wgBrace: 0 } } },
      { value: 1, label: 'Cantilever', icon: iconFront('low'),
        writes: { cage: { wgBrace: 1 } } },
    ] },

  // G140: THE PLANFORM ROW IS RETIRED (the user: "retire this option from
  // the design entirely"). The wing is three stations on the SHAPE panel
  // now — root chord, crank chord + seat, tip chord + seat — and three
  // buckets could never mirror that. The archetypes carry their planform
  // choices as over.cage writes instead (designBake grew the channel).

  // G132: one key, faithful read, nothing destroyed — that is a
  // discriminator's contract, whatever a tip's flavour text says
  { key: 'wgTip', label: 'Wing tips', kind: 'discriminator',
    group: 'wing', status: 'live',
    read: P => Math.round(P.wgTip),
    options: () => ['square', 'clipped', 'rounded', 'elliptic', 'hoerner',
                    'winglet'].map((k, i) => ({
      value: i, label: ((gTips() || {})[k] || { name: k }).name,
      icon: iconTip(k), writes: { cage: { wgTip: i } } })) },

  { key: 'wgFlapType', label: 'Flaps', kind: 'discriminator',
    group: 'wing', status: 'live',
    read: P => Math.round(P.wgFlapType),
    options: () => ['none', 'plain', 'slotted', 'fowler'].map((k, i) => ({
      value: i, label: ((gFlaps() || {})[k] || { name: k }).name,
      icon: iconFlap(k), writes: { cage: { wgFlapType: i } } })) },

  // ---- propulsion ---------------------------------------------------------
  { key: 'engFamily', label: 'Powertrain family', kind: 'discriminator',
    group: 'propulsion', status: 'live',
    help: 'selects into ENG_ARCH; the model list below follows it',
    read: P => Math.round(P.engPower) ? 'electric'
             : (['flat', 'inline', 'radial'][Math.round(P.eng_arch)] || 'flat'),
    options: designEngineFamilies },

  // `plain`: the model list renders as a LIST, not icon tiles — eighteen
  // near-identical silhouettes would be noise, and §6's level 2 is about
  // reading names ("choosing electric then picking among seven")
  { key: 'engModel', label: 'Engine model', kind: 'starter',
    group: 'propulsion', status: 'live', plain: true, once: true,
    help: 'a preset (applies once) — every engine row stays yours after',
    read: P => null,   // applied-once; the panel's own row shows the last pick
    options: designEngineModels },

  // 2026-09-04: THE MOUNTS ARE LIVE. `engMount` is the engine layer's row
  // (0 nose / 1 pusher / 2 over the wing / 3 a wing pair); the pusher needs
  // the pod to END at the aft bulkhead (a rod boom), the over-the-wing
  // engine a high wing — each tile writes what it needs. The pair is the
  // ENGINES row's (count and placement are one fact).
  { key: 'engMount', label: 'Engine mount', kind: 'discriminator',
    group: 'propulsion', status: 'live',
    read: P => Math.round(P.engMount) === 1 ? 'pusher'
             : Math.round(P.engMount) === 2 ? 'wingTop' : 'nose',
    options: [
      // 2026-09-04 (the user): "pusher configs should have no cowl by
      // default, possible to manually reactivate it" — the two pushing
      // mounts switch the cowl off, the nose puts it back; the rod brings
      // its taper section (the Fuselage-style tile's own rule)
      { value: 'nose', label: 'Nose', icon: ICON.mountNose,
        writes: { cage: { engMount: 0, cowlOn: 1 } } },
      { value: 'pusher', label: 'Pusher', icon: ICON.mountPusher,
        note: 'on the back of the aft bulkhead — the pod ends there (rod boom); no cowl',
        writes: { cage: { engMount: 1, boomStyle: 1, taperOn: 1, cowlOn: 0 } } },
      { value: 'wingTop', label: 'Over the wing', icon: ICON.mountWingTop,
        note: 'one engine on a pylon over the centre section, pushing; high wing; no cowl',
        writes: { cage: { engMount: 2, wgPos: 0, cowlOn: 0 } } },
    ] },

  { key: 'engCount', label: 'Engines', kind: 'discriminator',
    group: 'propulsion', status: 'live',
    help: 'count and placement are one choice — a twin puts them on the wing',
    read: P => Math.round(P.engMount) === 3 ? 2 : 1,
    options: [
      // one engine: back to the nose unless a single mount is already chosen
      { value: 1, label: 'Single engine', icon: iconTopEngines(true, 0),
        writes: { cage: { engMount: P => Math.round(P.engMount) === 3 ? 0
                                       : Math.round(P.engMount || 0) } } },
      { value: 2, label: 'Twin (wings)', icon: iconTopEngines(false, 2),
        note: 'a tractor nacelle a side, at the front spar; both pull',
        writes: { cage: { engMount: 3 } } },
      { value: 3, label: 'Three (nose + wings)', icon: iconTopEngines(true, 2),
        inactive: 'wing nacelles: ROADMAP P7' },
      { value: 4, label: 'Four (wings)', icon: iconTopEngines(false, 4),
        inactive: 'wing nacelles: ROADMAP P7' },
    ] },

  // 2026-09-04 (the user: "a wing-mounted engine can be configured as pusher
  // or puller ... the same for the dual wing mounted engines")
  { key: 'engAim', label: 'Wing engines face', kind: 'discriminator',
    group: 'propulsion', status: 'live',
    help: 'over the wing pushes and a pair pulls unless told otherwise',
    read: P => Math.round(P.engAim) === 1 ? 'puller'
             : Math.round(P.engAim) === 2 ? 'pusher' : 'mount',
    options: [
      { value: 'mount', label: 'As the mount', icon: ICON.aimMount,
        writes: { cage: { engAim: 0 } } },
      { value: 'puller', label: 'Puller', icon: ICON.aimPull,
        writes: { cage: { engAim: 1 } } },
      { value: 'pusher', label: 'Pusher', icon: ICON.aimPush,
        writes: { cage: { engAim: 2 } } },
    ] },

  { key: 'prop', label: 'Propeller', kind: 'starter',
    group: 'propulsion', status: 'live',
    // G132: blades and material joined (the drawn blade is the physics'
    // author now); pitch has no drawn twist and stays the tile's alone
    pair: [{ cage: 'cw_bladeN', spec: 'prop.blades', via: 'join' },
           { cage: 'cw_material', spec: 'prop.material', via: 'join' }],
    help: 'disc, blades and pitch are the physics; the shape rides along',
    read: (P, S) => {
      const p = S && S.prop; if (!p) return null;
      return p.material + p.blades;
    },
    // Each tile ALSO dresses the drawn blade (cw_material / cw_bladeN are the
    // cowl page's own params, by index into COWL MATERIALS) — before G125 the
    // spec choice and the cage's blade were two unconnected answers to the
    // same question, and a "3-blade carbon" tile drew two birch blades.
    options: [
      { value: 'wood2', label: '2-blade wood',
        icon: { vb: '0 0 64 40', paths: [{ d: 'M32 20 L32 2 M32 20 L32 38', w: 2 },
                                         { d: 'M30 16 a3 5 0 1 0 4 0', w: 1 }] },
        note: 'the Cub’s cruise club',
        writes: { spec: { prop: { blades: 2, material: 'wood', pitch: 'cruise' } },
                  cage: { cw_material: 0, cw_bladeN: 2 } } },
      { value: 'alu2', label: '2-blade metal',
        icon: { vb: '0 0 64 40', paths: [{ d: 'M32 20 L28 2 M32 20 L36 38', w: 2 },
                                         { d: 'M30 16 a3 5 0 1 0 4 0', w: 1 }] },
        writes: { spec: { prop: { blades: 2, material: 'alu', pitch: 'standard' } },
                  cage: { cw_material: 2, cw_bladeN: 2 } } },
      { value: 'carbon3', label: '3-blade carbon',
        icon: { vb: '0 0 64 40', paths: [{ d: 'M32 20 L32 2 M32 20 L18 30 M32 20 L46 30', w: 2 },
                                         { d: 'M30 16 a3 5 0 1 0 4 0', w: 1 }] },
        note: 'climb pitch — the STOL pick',
        writes: { spec: { prop: { blades: 3, material: 'carbon', pitch: 'climb' } },
                  cage: { cw_material: 3, cw_bladeN: 3 } } },
      // G125: the scanned woods — same physics family as wood, their own
      // mass and price rows (GEN_PROP_MATS) and their own scanned finishes
      { value: 'maple2', label: '2-blade maple',
        icon: { vb: '0 0 64 40', paths: [{ d: 'M32 20 L31 2 M32 20 L33 38', w: 2.5 },
                                         { d: 'M30 16 a3 5 0 1 0 4 0', w: 1 }] },
        note: 'the pale show blank, varnished',
        writes: { spec: { prop: { blades: 2, material: 'maple', pitch: 'cruise' } },
                  cage: { cw_material: 6, cw_bladeN: 2 } } },
      { value: 'walnut2', label: '2-blade walnut',
        icon: { vb: '0 0 64 40', paths: [{ d: 'M32 20 L30 3 M32 20 L34 37', w: 2.5 },
                                         { d: 'M30 16 a3 5 0 1 0 4 0', w: 1 }] },
        note: 'the vintage blank — dark, light, dear',
        writes: { spec: { prop: { blades: 2, material: 'walnut', pitch: 'cruise' } },
                  cage: { cw_material: 7, cw_bladeN: 2 } } },
    ] },

  // ---- tail ---------------------------------------------------------------
  // `tail.stabH` is MEASURED off the built cage by the join (the gear.type
  // correction's twin) — so the T-tail tile is a STARTER over the CAGE's own
  // stab placement (stY off the boom underside), and the read leans on it.
  // The V-tail reason is re-sourced (2026-08-31): _cage_fin.js does NOT say
  // "conventional only" — its classifier is deliberately V-tail-proof; the
  // cage simply builds no V-tail yet, by absence.
  { key: 'empennage', label: 'Empennage', kind: 'starter',
    group: 'tail', status: 'live',
    help: 'where the tailplane sits; the fin bench owns its exact corners',
    // the values are MEASURED against the join's own stabH readout
    // (2026-08-31, on the page's fin): stY 0.408 -> 0.10, 1.05 -> ~0.40,
    // 2.35 -> ~0.97 — a first guess of 1.25 measured 0.52, which is a
    // cruciform wearing a T-tail's tile, and only the measurement said so
    // 2026-09-04: the T-tail is a SEAT now (stMount 2 = the fin tip, whatever
    // the fin's height — the 2.35 guess only fitted the page's fin), and the
    // V is live: the stab layer cants its panels (stCant), roots them on the
    // boom deck at the centreline and the fin goes; the join writes
    // tail.type 'v' from the cant, the ruddervator mix is the solver's own
    read: P => +P.stCant >= 20 ? 'v'
             : (Math.round(P.stMount) === 2 || +P.stY >= 1.8) ? 't'
             : +P.stY >= 0.75 ? 'cruci' : 'conv',
    options: [
      { value: 'conv', label: 'Conventional',
        icon: iconSide({ canopy: 'none', gear: 'none', tail: 'conv' }),
        writes: { cage: { stY: 0.408, stCant: 0, finOn: 1,
                          stMount: P => Math.round(P.boomStyle) === 2 ? 3 : 0,
                          stX: P => Math.round(P.boomStyle) === 2 ? 0 : 0.05 } } },
      { value: 't', label: 'T-tail',
        icon: iconSide({ canopy: 'none', gear: 'none', tail: 't' }),
        note: 'the stab rides the fin tip',
        writes: { cage: { stMount: 2, stY: 0.02, stZ: -0.10, stCant: 0,
                          stX: 0.05, finOn: 1 } } },
      { value: 'cruci', label: 'Cruciform',
        icon: iconSide({ canopy: 'none', gear: 'none', tail: 'cruci' }),
        writes: { cage: { stY: 1.05, stZ: -0.12, stMount: 0, stCant: 0,
                          stX: 0.05, finOn: 1 } } },
      { value: 'v', label: 'V-tail',
        icon: iconSide({ canopy: 'none', gear: 'none', tail: 'v' }),
        note: 'two canted panels, no fin — ruddervators',
        writes: { cage: { stCant: 35, stMount: 1, stX: 0, stY: 0, stZ: 0,
                          finOn: 0 } } },
      { value: 'twin', label: 'Twin boom',
        icon: iconSide({ canopy: 'none', gear: 'none', tail: 'twin' }),
        inactive: 'needs a twin tail CARRIER, not a new tail — the one ' +
          'empennage that is a boom question (ROADMAP-adjacent, unclaimed)' },
    ] },

  // ---- undercarriage ------------------------------------------------------
  // `gear.type` is a MEASUREMENT (_cage_join.js): the join reads taildragger
  // vs tricycle off where the built third wheel stands. So the layout tile is
  // a STARTER over the cage's own stations, and the read mirrors the join's
  // rule through the leg kind. TUNE: the tricycle values are first-cut and
  // GATE ARCHETYPES' C172-alike is what proves them (it must MEASURE
  // tricycle after the starter runs).
  { key: 'gearLayout', label: 'Undercarriage', kind: 'starter',
    group: 'undercarriage', status: 'live',
    pair: [{ cage: 's2Leg', spec: 'gear.type', via: 'join' }],
    help: 'different aeroplanes on the ground — the placement rule ' +
          'inverts and the rest attitude follows',
    read: P => +P.s2Leg === 3 ? 'tail' : 'trike',
    // the spec channel carries the INTENT (`gear.type` is a real spec field
    // with a default); the join then measures the built cage and overwrites
    // it, and the two agreeing is exactly what the starter's cage values are
    // for. GATE ARCHETYPES flies the birth spec — pre-join — so without the
    // intent write every tricycle archetype would fly the default taildragger.
    options: [
      { value: 'tail', label: 'Taildragger',
        icon: iconSide({ canopy: 'screen', gear: 'tail' }),
        writes: { cage: { s2On: 1, s2Leg: 3, s2Z: 0.06, s2X: 0, s2R: 0.07,
                          s2Steer: 1, s2Brake: 0, s1Z: 2.00, s1Steer: 0 },
                  spec: { gear: { type: 'taildragger' } } } },
      { value: 'trike', label: 'Tricycle',
        icon: iconSide({ canopy: 'screen', gear: 'trike' }),
        writes: { cage: { s2On: 1, s2Leg: 2, s2Z: 2.60, s2X: 0, s2R: 0.14,
                          s2Steer: 1, s2Brake: 0, s1Z: 0.95, s1Steer: 0 },
                  spec: { gear: { type: 'tricycle' } } } },
    ] },

  { key: 'retract', label: 'Retraction', kind: 'discriminator',
    group: 'undercarriage', status: 'declared',
    read: () => 'fixed',
    options: [
      { value: 'fixed', label: 'Fixed', icon: ICON.fixed, def: true },
      { value: 'retract', label: 'Retractable', icon: ICON.retract,
        inactive: 'declared (§5.8): a real discriminator — mass, ' +
          'drag, price, complexity — and none of that model is built; ' +
          'no spec field exists until it is' },
    ] },

  { key: 'suspension', label: 'Suspension', kind: 'starter',
    group: 'undercarriage', status: 'live',
    // G132: the join measures the drawn shock back into the spec, so the
    // mains' own shock-kind slider can no longer fly a bungee wearing an
    // oleo — the pair is what _join_check proves
    pair: [{ cage: 's1_shockKind', spec: 'gear.suspension', via: 'join' }],
    read: (P, S) => S && S.gear && S.gear.suspension || null,
    options: [
      { value: 'bungee', label: 'Bungee cord', icon: ICON.suspBungee,
        writes: { spec: { gear: { suspension: 'bungee' } },
                  cage: { s1_shockKind: 1 } } },
      { value: 'spring', label: 'Spring steel', icon: ICON.suspSpring,
        writes: { spec: { gear: { suspension: 'spring' } },
                  cage: { s1_shockKind: 0 } } },
      { value: 'oleo', label: 'Oleo strut', icon: ICON.suspOleo,
        writes: { spec: { gear: { suspension: 'oleo' } },
                  cage: { s1_shockKind: 2 } } },
    ] },

  { key: 's1Fair', label: 'Wheel fairings', kind: 'starter',
    group: 'undercarriage', status: 'live',
    // 2026-09-04 (the user: "the fairing is missing for the front wheel of
    // tricycle"): the tile wrote the MAINS' row only, so a trike's nose wheel
    // stayed bare whatever the card said. Both stations, one choice.
    read: P => Math.round(P.s1Fair),
    options: [
      { value: 0, label: 'None', icon: ICON.fairNone,
        writes: { cage: { s1Fair: 0, s2Fair: 0 } } },
      { value: 1, label: 'Spats', icon: ICON.fairSpat,
        writes: { cage: { s1Fair: 1, s2Fair: 1 } } },
      { value: 2, label: 'Full trousers', icon: ICON.fairFull,
        writes: { cage: { s1Fair: 2, s2Fair: 2 } } },
    ] },

  // ---- livery -------------------------------------------------------------
  // WRITE `paint`, NOT `finish` (§5.9): paint is the generated three-colour
  // scheme every aeroplane has had since G4; finish stays null — the factory
  // finish — and the FINISH tab is where the fine work already lives.
  { key: 'scheme', label: 'Scheme', kind: 'starter',
    group: 'livery', status: 'live',
    read: (P, S) => {
      const p = S && S.paint; if (!p) return null;
      if (p.job === 'bare') return 'bare';
      return p.sweep >= 0.5 ? 'sweep' : 'trim';
    },
    options: [
      { value: 'bare', label: 'Bare / primer', icon: ICON.schemeBare,
        writes: { spec: { paint: { job: 'bare' } } } },
      { value: 'trim', label: 'Trim line', icon: ICON.schemeTrim,
        writes: { spec: { paint: { job: 'full', sweep: 0.35 } } } },
      { value: 'sweep', label: 'Full sweep', icon: ICON.schemeSweep,
        writes: { spec: { paint: { job: 'full', sweep: 0.65 } } } },
    ] },

  { key: 'base', label: 'Base colour', kind: 'starter',
    group: 'livery', status: 'live',
    read: (P, S) => S && S.paint ? S.paint.base : null,
    options: [
      ['Cub yellow', 0xf2c437], ['Cream', 0xefe6cf], ['Signal red', 0xb5342a],
      ['Sky blue', 0x7fa8c9], ['Forest', 0x3d5c40], ['Silver', 0xc7c9cc],
    ].map(([label, hex]) => ({ value: hex, label, icon: iconSwatch(hex),
      writes: { spec: { paint: { base: hex } } } })) },

  { key: 'trim', label: 'Trim colour', kind: 'starter',
    group: 'livery', status: 'live',
    read: (P, S) => S && S.paint ? S.paint.trim : null,
    options: [
      ['Night blue', 0x1b3a5c], ['Black', 0x20211f], ['Oxide red', 0x7c3327],
      ['White', 0xf4f2ea], ['Dark green', 0x2c4a31], ['Orange', 0xc96f2a],
    ].map(([label, hex]) => ({ value: hex, label, icon: iconSwatch(hex),
      writes: { spec: { paint: { trim: hex } } } })) },
];

// ---------------------------------------------------------------------------
// THE ARCHETYPES (§7) — a DECLARED LIST, not a cartesian product. Each is a
// selection over the rows above (class and role first, so later fractions see
// the class's chord), plus the odd direct write where a recognisable
// aeroplane needs one. GATE ARCHETYPES flies every archetype whose every
// option is live; the others are SKIPPED WITH THEIR REASON PRINTED, so the
// gate log is also the backlog.
//
// CORRECTED from the spec (2026-08-31): the "radial biplane-alike" is a
// radial MONOPLANE tourer — nothing in the generator builds a second wing,
// and an archetype must be a build the table can actually ask for.
// ---------------------------------------------------------------------------
// G140: the retired planform tiles' writes, kept as archetype wing patches
// (over.cage — resolved by designBake against the class's own chord)
const PLAN_RECT = { wgChordTip: P => +P.wgChord, wgTipX: 0 };
const PLAN_TAPER = { wgChordTip: P => +(+P.wgChord * 0.62).toFixed(2),
                     wgTipX: 0 };
// ...and the C172-alike finally wears its REAL wing: constant chord to the
// crank, taper and a small aft seat outboard — and the crank is where the
// strut lands (the frame's G140 ruling), which is what a C172 is
const PLAN_C172 = { wgCrankAt: 0.42, wgCrankChord: P => +P.wgChord,
                    wgCrankX: 0, wgDihedralOut: 3,
                    wgChordTip: P => +(+P.wgChord * 0.72).toFixed(2),
                    wgTipX: 0.30 };

const ARCHETYPES = [
  { key: 'cub', kind: 'recreation', name: 'Cub-alike', note: 'taildragger, strut-braced high ' +
      'wing, windscreen, tube & fabric, tandem',
    sel: { class: 'eab', role: 'bush', seatLayout: 2, paxCount: 1,
           canopy: 'screen', mirror: 0, intCons: 1, boomStyle: 0, section: 1,
           wgPos: 0, wgBrace: 0, wgTip: 2, wgFlapType: 0,
           engFamily: 'flat', engModel: 'continental A-65', engMount: 'nose',
           gearLayout: 'tail', suspension: 'bungee', s1Fair: 0,
           empennage: 'conv', scheme: 'sweep', base: 0xf2c437, trim: 0x1b3a5c },
    // 2026-09-04 (the user: "be a little more inventive with the liveries
    // ... use at least the preset decals"): the Cub's lightning flash
    over: { cage: PLAN_RECT,
            spec: { finish: { decals: { m1On: 1, m1Pat: 3, m1A: 0x1b3a5c,
                                        m1B: 0xffffff, m1D: 0x1b3a5c } } } } },
  { key: 'jodel', kind: 'recreation', name: 'Jodel-alike', note: 'cantilever wood wing, ' +
      'side-by-side, the page’s own aeroplane reborn',
    sel: { class: 'eab', role: 'touring', seatLayout: 1, paxCount: 1,
           canopy: 'screen', mirror: 0, intCons: 2, boomStyle: 0, section: 1,
           wgPos: 2, wgBrace: 1, wgTip: 2, wgFlapType: 1,
           engFamily: 'flat', engModel: 'continental O-200', engMount: 'nose',
           gearLayout: 'tail', suspension: 'spring', s1Fair: 1,
           empennage: 'conv', scheme: 'trim', base: 0xefe6cf, trim: 0x7c3327 },
    // a cheat line along the Jodel's waist
    over: { cage: PLAN_TAPER,
            spec: { finish: { decals: { m1On: 1, m1Pat: 0, m1A: 0x7c3327,
                                        m1B: 0xefe6cf, m1D: 0x7c3327 } } } } },
  { key: 'c172', kind: 'recreation', name: 'C172-alike', note: 'alloy, tricycle, 2+2 cabin, ' +
      'slotted flaps',
    sel: { class: 'n23', role: 'touring', seatLayout: 1, paxCount: 3,
           canopy: 'screen', mirror: 0, intCons: 3, boomStyle: 0, section: 1,
           wgPos: 0, wgBrace: 0, wgTip: 1, wgFlapType: 2,
           engFamily: 'flat', engModel: 'lycoming IO-360', engMount: 'nose',
           gearLayout: 'trike', suspension: 'spring', s1Fair: 1,
           empennage: 'conv', scheme: 'sweep', base: 0xefe6cf, trim: 0x2c4a31 },
    // the twin stripe every 172 of the seventies wore
    over: { cage: PLAN_C172,
            spec: { finish: { decals: { m1On: 1, m1Pat: 1, m1A: 0x2c4a31,
                                        m1B: 0xc96f2a, m1D: 0xefe6cf } } } } },
  { key: 'rv', kind: 'recreation', name: 'RV-alike', note: 'low wing, bubble, cantilever alloy, fast',
    sel: { class: 'eab', role: 'touring', seatLayout: 1, paxCount: 1,
           canopy: 'full', mirror: 1, intCons: 3, boomStyle: 0, section: 3,
           wgPos: 2, wgBrace: 1, wgTip: 1, wgFlapType: 1,
           engFamily: 'flat', engModel: 'lycoming IO-360', engMount: 'nose',
           gearLayout: 'trike', suspension: 'spring', s1Fair: 1,
           empennage: 'conv', scheme: 'sweep', base: 0xc7c9cc, trim: 0x7c3327 },
    // the RV's two-tone sweep, bent up aft
    over: { cage: PLAN_TAPER,
            spec: { finish: { decals: { m1On: 1, m1Pat: 2, m1A: 0x7c3327,
                                        m1B: 0xc7c9cc, m1D: 0x7c3327 } } } } },
  { key: 'savannah', kind: 'recreation', name: 'Savannah-alike', note: 'STOL microlight, high ' +
      'wing, big flaps, bush role',
    sel: { class: 'ulm', role: 'bush', seatLayout: 1, paxCount: 1,
           canopy: 'screen', mirror: 0, intCons: 3, boomStyle: 0, section: 0,
           wgPos: 0, wgBrace: 0, wgTip: 0, wgFlapType: 3,
           engFamily: 'flat', engModel: 'rotax 912 (flat)', engMount: 'nose',
           gearLayout: 'tail', suspension: 'bungee', s1Fair: 0,
           empennage: 'conv', scheme: 'trim', base: 0x7fa8c9, trim: 0xf4f2ea },
    over: { cage: PLAN_RECT } },
  { key: 'ul1', kind: 'fiction', name: 'Single-seat ultralight', note: 'the smallest ' +
      'buildable, minimum systems',
    sel: { class: 'ul1', role: 'trainer', seatLayout: 0, paxCount: 0,
           canopy: 'screen', mirror: 0, intCons: 1, boomStyle: 1, section: 0,
           wgPos: 0, wgBrace: 0, wgTip: 0, wgFlapType: 0,
           engFamily: 'inline', engModel: 'rotax 582', engMount: 'nose',
           gearLayout: 'tail', suspension: 'bungee', s1Fair: 0,
           empennage: 'conv', scheme: 'bare' },
    over: { cage: PLAN_RECT } },
  // 2026-09-04: LIVE. The pod ends at the aft bulkhead (no mirror — a
  // mirrored pod has no bulkhead face, its aft half is a second nose), the
  // rod runs from there and the engine sits on the bulkhead's back.
  { key: 'pusherPod', kind: 'fiction', name: 'Pod-and-boom pusher', note: 'rod + pusher',
    sel: { class: 'ulm', role: 'trainer', canopy: 'full', mirror: 0,
           boomStyle: 1, engFamily: 'inline', engModel: 'rotax 582',
           engMount: 'pusher', gearLayout: 'trike' } },
  // 2026-09-04: LIVE with the sail class — a cantilever mid wing on a round
  // slender body, T-tail, the electric sustainer in the nose, a tailwheel.
  { key: 'motorglider', kind: 'fiction', name: 'Motorglider', note: '15 m cantilever wing, ' +
      'electric sustainer, T-tail',
    sel: { class: 'sail', role: 'glider', seatLayout: 0, paxCount: 0,
           canopy: 'full', mirror: 1, intCons: 0, boomStyle: 0, section: 3,
           wgPos: 1, wgBrace: 1, wgTip: 2, wgFlapType: 0,
           engFamily: 'electric', engModel: 'pipistrel E-811', engMount: 'nose',
           gearLayout: 'tail', suspension: 'spring', s1Fair: 1,
           empennage: 't', scheme: 'trim', base: 0xefe6cf, trim: 0x1b3a5c },
    // MEASURED (2026-09-04): at the class's 15 m the test pilot reports
    // 'wont-climb' at 88 s and never completes the circuit; at 13 m x 1.15
    // (AR 11) it completes in 330 s, sink 0.79. The 15 m wing's flight is a
    // debt of the opened envelope (HANDOVER G176), not of the card.
    over: { cage: Object.assign({}, PLAN_TAPER, { wgSpan: 13.0, wgChord: 1.15,
                                                   wgChordTip: 0.65 }),
            spec: { fuel: { litres: 0 } } } },
  // MEASURED OUT (2026-08-31): the R-1830 tourer FLIES (TORun 187 m,
  // VCruise 67 m/s) and cannot be LANDED — the test pilot gave up still
  // INBOUND at 900 s; carded circuits refuse (cant-hold-speed at 45 and a
  // clamped 38 m/s); fowler flaps do not tip it. 895 kW at idle outruns the
  // pattern on any airframe the wing clamps allow — which is the spec's own
  // finding 3 ("an R-1830 has an engine and no airframe that can carry it")
  // arriving as a flight result. Unblocks with the `util` class, i.e. the
  // envelope chantier. `blocked` is archetype-level backlog: the family and
  // the engine stay live on the tiles.
  // 2026-09-04: LIVE on an AMATEUR radial (the user: "we have more radial
  // engines now") — the Rotec R3600, 150 hp, on the touring airframe the
  // R-1830 could not be landed on; the R-1830 stays on the family list.
  { key: 'radial', kind: 'fiction', name: 'Radial tourer', note: 'a nine-cylinder Rotec on ' +
      'a low-wing tourer, oleo legs, trousers',
    sel: { class: 'n23', role: 'touring', seatLayout: 1, paxCount: 1,
           canopy: 'screen', mirror: 0, intCons: 3, boomStyle: 0, section: 3,
           wgPos: 2, wgBrace: 1, wgTip: 2, wgFlapType: 1,
           engFamily: 'radial', engModel: 'Rotec R3600', engMount: 'nose',
           gearLayout: 'tail', suspension: 'oleo', s1Fair: 2,
           empennage: 'conv', scheme: 'sweep', base: 0x3d5c40, trim: 0xf4f2ea },
    over: { cage: PLAN_TAPER } },
  { key: 'etrainer', kind: 'fiction', name: 'Electric trainer', note: 'no fuel; the altitude ' +
      'model’s other branch',
    sel: { class: 'lsa', role: 'trainer', seatLayout: 1, paxCount: 1,
           canopy: 'half', mirror: 0, intCons: 0, boomStyle: 0, section: 3,
           wgPos: 2, wgBrace: 1, wgTip: 3, wgFlapType: 1,
           engFamily: 'electric', engModel: 'pipistrel E-811', engMount: 'nose',
           gearLayout: 'trike', suspension: 'spring', s1Fair: 1,
           empennage: 'conv', scheme: 'sweep', base: 0xefe6cf, trim: 0xc96f2a },
    over: { cage: PLAN_TAPER, spec: { fuel: { litres: 0 } } } },
  // 2026-09-04: LIVE — the stab rides the fin tip (G173's seat); the
  // retraction it once asked for stays declared and is not asked for
  { key: 'ttail', kind: 'fiction', name: 'T-tail tourer', note: 'stab on the fin tip, low ' +
      'cantilever wing, half bubble',
    sel: { class: 'n23', role: 'touring', seatLayout: 1, paxCount: 1,
           canopy: 'half', mirror: 0, intCons: 3, boomStyle: 0, section: 3,
           wgPos: 2, wgBrace: 1, wgTip: 1, wgFlapType: 1,
           engFamily: 'flat', engModel: 'lycoming IO-360', engMount: 'nose',
           gearLayout: 'trike', suspension: 'oleo',
           s1Fair: 1, empennage: 't', scheme: 'sweep',
           base: 0xefe6cf, trim: 0x1b3a5c },
    over: { cage: PLAN_TAPER } },
  { key: 'vtail', kind: 'fiction', name: 'V-tail tourer', note: 'two canted panels, no fin — ' +
      'ruddervators',
    sel: { class: 'n23', role: 'touring', canopy: 'half', mirror: 0,
           wgPos: 2, wgBrace: 1, engFamily: 'flat',
           engModel: 'lycoming IO-360', gearLayout: 'trike',
           empennage: 'v' } },
  // 2026-09-04 (the user): "a more-than-ultra-light, basically a suspended
  // cabin, bare metal tubes, and the engine mounted on top of the wing.
  // Maybe even a swept wing. I'm thinking of the Whittaker MW5/6" — an
  // assembly of wing + rod + engine with a suspended nacelle: the open
  // frame (no covering, the truss in the wind), a strut-braced high wing
  // with a little sweep, the two-stroke on a pylon over the centre section
  // pushing, a rod boom, a trike.
  { key: 'mw5', kind: 'recreation', name: 'Whittaker-alike', note: 'open-frame nacelle, engine ' +
      'over a swept high wing, rod boom',
    sel: { class: 'ul1', role: 'trainer', seatLayout: 0, paxCount: 0,
           canopy: 'screen', mirror: 0, intCons: 1, covering: 'open',
           boomStyle: 1, section: 0,
           wgPos: 0, wgBrace: 0, wgTip: 0, wgFlapType: 0,
           engFamily: 'inline', engModel: 'rotax 582', engMount: 'wingTop',
           gearLayout: 'trike', suspension: 'bungee', s1Fair: 0,
           empennage: 'conv', scheme: 'bare' },
    // (the sweep is the tip's own station since G140 — wgTipX walks the tip aft)
    over: { cage: Object.assign({}, PLAN_RECT, { wgTipX: 0.30, engPylonH: 0.32 }) } },
  // ...and "the Archaeopteryx is probably one of the strangest designs out
  // there. Rod almost directly on the high wing, a suspended cabin with aero
  // nose, and an electric engine in pusher config, at the bottom" — the pod
  // keeps its skin and its full canopy, the aero nose follows from the
  // mount, the rod rides high on the bulkhead and the electric pusher hangs
  // LOW on the bulkhead's back (engY down).
  { key: 'archaeopteryx', kind: 'recreation', name: 'Archaeopteryx-alike', note: 'suspended pod, ' +
      'rod on the wing, electric pusher low on the bulkhead',
    sel: { class: 'ul1', role: 'glider', seatLayout: 0, paxCount: 0,
           canopy: 'full', mirror: 0, intCons: 0, covering: 'skin',
           boomStyle: 1, section: 3,
           wgPos: 0, wgBrace: 0, wgTip: 2, wgFlapType: 0,
           engFamily: 'electric', engModel: 'pipistrel E-811', engMount: 'pusher',
           gearLayout: 'trike', suspension: 'bungee', s1Fair: 0,
           empennage: 'conv', scheme: 'trim', base: 0xefe6cf, trim: 0xc96f2a },
    over: { cage: Object.assign({}, PLAN_RECT, { rodY: 0.42, engY: -0.30,
                                                 wgSpan: 11.0, wgChord: 1.30,
                                                 wgChordTip: 1.30 }),
            spec: { fuel: { litres: 0 } } } },
  // 2026-09-04 (the user): "We need a twin engine aircraft archetype, maybe
  // a couple of them. I'm thinking a luxury, small tourer, like the Diamond
  // DA62 or the Beechcraft Baron, and a larger plane (maybe our first)".
  // THE LUXURY TWIN: a low cantilever composite wing carrying an IO-360 a
  // side, four seats under a half bubble, a T-tail, spatted trike gear, a
  // 14 m span. Count and placement are one fact — the ENGINES row writes
  // the pair (engMount 3) after the mount row's nose, in row order.
  { key: 'da62', kind: 'recreation', name: 'DA62-alike', note: 'luxury twin: ' +
      'low composite wing, an engine a side, T-tail, four seats',
    sel: { class: 'n23', role: 'touring', seatLayout: 1, paxCount: 3,
           canopy: 'half', mirror: 0, intCons: 0, boomStyle: 0, section: 3,
           wgPos: 2, wgBrace: 1, wgTip: 1, wgFlapType: 1,
           engFamily: 'flat', engModel: 'lycoming IO-360', engMount: 'nose',
           engCount: 2, gearLayout: 'trike', suspension: 'oleo', s1Fair: 1,
           empennage: 't', scheme: 'trim', base: 0xefe6cf, trim: 0x1b3a5c },
    over: { cage: Object.assign({}, PLAN_TAPER, { wgSpan: 14.0, wgChord: 1.55,
                                                   wgChordTip: 0.95 }),
            spec: { finish: { decals: { m1On: 1, m1Pat: 2, m1A: 0x1b3a5c,
                                        m1B: 0xefe6cf, m1D: 0x1b3a5c } } } } },
  // THE LARGER TWIN — the first "larger plane": a strut-braced high wing on
  // a boxy alloy body, four bays, an IO-360 a side at the front spar, fixed
  // trike gear, a conventional tail; the Twin Otter's shape at the size the
  // registry's pistons can lift.
  { key: 'twinBush', kind: 'fiction', name: 'Twin bush hauler', note: 'the ' +
      'first larger aeroplane: high strut wing, an engine a side, four bays',
    sel: { class: 'n23', role: 'cargo', seatLayout: 1, paxCount: 4,
           canopy: 'screen', mirror: 0, intCons: 3, boomStyle: 0, section: 0,
           wgPos: 0, wgBrace: 0, wgTip: 0, wgFlapType: 2,
           engFamily: 'flat', engModel: 'lycoming IO-360', engMount: 'nose',
           engCount: 2, gearLayout: 'trike', suspension: 'oleo', s1Fair: 0,
           empennage: 'conv', scheme: 'trim', base: 0xefe6cf, trim: 0xc96f2a },
    over: { cage: Object.assign({}, PLAN_RECT, { wgSpan: 16.0, wgChord: 1.95,
                                                  wgChordTip: 1.95 }),
            spec: { finish: { decals: { m1On: 1, m1Pat: 0, m1A: 0xc96f2a,
                                        m1B: 0x1b3a5c, m1D: 0xc96f2a } } } } },
  // TWIN BOOMS (2026-09-04, spec §3): the 337's shape with its nose engine —
  // the rear pusher is push-pull, the mixed-mount list the frame does not loop
  // over yet — and a small P-38: two pullers on the booms' own stations.
  { key: 'skymaster', kind: 'recreation', name: 'Skymaster-alike', note: 'twin ' +
      'booms off a high wing, four seats, nose engine (the rear pusher is owed)',
    sel: { class: 'n23', role: 'touring', seatLayout: 1, paxCount: 3,
           canopy: 'screen', mirror: 0, intCons: 3, boomStyle: 2, section: 3,
           wgPos: 0, wgBrace: 1, wgTip: 1, wgFlapType: 1,
           engFamily: 'flat', engModel: 'lycoming IO-360', engMount: 'nose',
           gearLayout: 'trike', suspension: 'oleo', s1Fair: 0,
           empennage: 'conv', scheme: 'trim', base: 0xefe6cf, trim: 0x1b3a5c },
    over: { cage: Object.assign({}, PLAN_TAPER, { boomX: 1.25, boomLen: 3.2,
                                                   boomD: 0.18 }),
            spec: { finish: { decals: { m1On: 1, m1Pat: 0, m1A: 0x1b3a5c,
                                        m1B: 0xefe6cf, m1D: 0x1b3a5c } } } } },
  { key: 'p38', kind: 'recreation', name: 'P-38-alike', note: 'a puller a boom, ' +
      'mid wing, one seat under a bubble, twin booms and fins',
    sel: { class: 'eab', role: 'aerobatic', seatLayout: 0, paxCount: 0,
           canopy: 'full', mirror: 0, intCons: 3, boomStyle: 2, section: 3,
           wgPos: 1, wgBrace: 1, wgTip: 2, wgFlapType: 1,
           engFamily: 'flat', engModel: 'rotax 912 (flat)', engMount: 'nose',
           engCount: 2, engAim: 'puller', gearLayout: 'trike',
           suspension: 'oleo', s1Fair: 0,
           empennage: 'conv', scheme: 'bare' },
    over: { cage: Object.assign({}, PLAN_TAPER, { wgSpan: 11.0, wgChord: 1.55,
                                                   wgChordTip: 0.95,
                                                   boomX: 1.35, boomLen: 3.0,
                                                   boomD: 0.22, engNacAt: 0.245 }) } },
  // "a mono engine larger aircraft ... something like the Beaver now that we
  // have large radial engines": the R-985 Wasp Junior (this batch's registry
  // row) on a strut-braced high wing, four bays, a taildragger on oleos.
  { key: 'beaver', kind: 'recreation', name: 'Beaver-alike', note: 'the bush ' +
      'radial: R-985, strut high wing, four bays, taildragger',
    sel: { class: 'n23', role: 'bush', seatLayout: 1, paxCount: 4,
           canopy: 'screen', mirror: 0, intCons: 3, boomStyle: 0, section: 1,
           wgPos: 0, wgBrace: 0, wgTip: 0, wgFlapType: 2,
           engFamily: 'radial', engModel: 'P&W R-985', engMount: 'nose',
           gearLayout: 'tail', suspension: 'oleo', s1Fair: 0,
           empennage: 'conv', scheme: 'sweep', base: 0xf2c437, trim: 0x2c4a31 },
    over: { cage: Object.assign({}, PLAN_RECT, { wgSpan: 14.6, wgChord: 1.95,
                                                  wgChordTip: 1.95 }),
            spec: { finish: { decals: { m1On: 1, m1Pat: 1, m1A: 0x3d5c40,
                                        m1B: 0xefe6cf, m1D: 0x3d5c40 } } } } },
];

// ---------------------------------------------------------------------------
// APPLY — the one code path the tiles AND the gate go through, so the
// aeroplane the gate flies is the aeroplane the tile builds.
// ---------------------------------------------------------------------------
const rowByKey = {};
for (const r of DESIGN_ROWS) rowByKey[r.key] = r;

const rowOptions = r =>
  typeof r.options === 'function' ? r.options() : (r.options || []);

function optionOf(rowKey, value) {
  const r = rowByKey[rowKey];
  if (!r) return null;
  return rowOptions(r).find(o => o.value === value) || null;
}

// deep-merge b into a (plain objects only — the spec patch shape)
function designMerge(a, b) {
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]))
      designMerge(a[k] || (a[k] = {}), b[k]);
    else a[k] = b[k];
  }
  return a;
}

// resolve one selection map { rowKey: optionValue } into { cage, spec,
// missing }. `base` is the P the function-values see — every earlier write
// already applied, in DESIGN_ROWS order with `class` and `role` hoisted
// first (the archetype contract). engPreset name-values resolve to the
// panel's index here, and an unknown option lands in `missing` instead of
// silently writing nothing.
//
// G132: `opts.seeds` (default TRUE — birth, archetypes and the gate all
// compose the whole recipe) folds each option's one-shot `seed` in after
// its live `writes`; the PANEL passes seeds:false, which is the whole
// label-vs-starting-values split.
function designApply(P, sel, opts) {
  const seeds = !opts || opts.seeds !== false;
  const cage = {}, spec = {}, missing = [];
  const work = Object.assign({}, P);
  const order = ['class', 'role'].concat(
    DESIGN_ROWS.map(r => r.key).filter(k => k !== 'class' && k !== 'role'));
  for (const rowKey of order) {
    if (!(rowKey in sel)) continue;
    const opt = optionOf(rowKey, sel[rowKey]);
    if (!opt) { missing.push(rowKey + '=' + sel[rowKey]); continue; }
    if (opt.inactive) continue;          // greyed tiles never write
    const chans = [opt.writes || {}];
    if (seeds && opt.seed) chans.push(opt.seed);
    for (const wr of chans) {
      for (const k in (wr.cage || {})) {
        let v = wr.cage[k];
        if (typeof v === 'function') v = v(work);
        if (k === 'engPreset' && typeof v === 'string') {
          const i = designPresetIndex(v);
          if (i === null) { missing.push('engPreset ' + v); continue; }
          v = i;
        }
        cage[k] = v; work[k] = v;
      }
      if (wr.spec) designMerge(spec, wr.spec);
    }
  }
  return { cage, spec, missing };
}

// G132: ONE option's seed, resolved against the live P — the panel's
// explicit "apply the starting values" action. Same resolution rules as
// designApply (function values, engPreset names), one code path's worth
// of them, so the pill and the birth cannot disagree about what a seed is.
function designSeed(P, rowKey, value) {
  const opt = optionOf(rowKey, value);
  if (!opt || !opt.seed) return { cage: {}, spec: {} };
  const cage = {}, work = Object.assign({}, P);
  for (const k in (opt.seed.cage || {})) {
    let v = opt.seed.cage[k];
    if (typeof v === 'function') v = v(work);
    if (k === 'engPreset' && typeof v === 'string') {
      const i = designPresetIndex(v);
      if (i === null) continue;
      v = i;
    }
    cage[k] = v; work[k] = v;
  }
  return { cage,
           spec: JSON.parse(JSON.stringify(opt.seed.spec || {})) };
}

// how many CURRENTLY NON-DEFAULT values a write set is about to change — the
// number a starter must state before it runs (§2). `defaults` is the panel's
// own base (CAGE_PARAMS + page defaults); tolerance is relative, the same
// float-noise argument as editor.js's dirtyOf.
function designOverwriteCount(P, cageWrites, defaults) {
  let n = 0;
  const near = (a, b) => Math.abs((+a) - (+b)) <=
    Math.max(1e-9, Math.abs(+b) * 1e-6) ||
    (isNaN(+a) && isNaN(+b) && a === b);
  for (const k in cageWrites) {
    const cur = P[k], def = defaults ? defaults[k] : undefined;
    if (near(cur, cageWrites[k])) continue;          // no change at all
    if (def !== undefined && near(cur, def)) continue; // default -> free
    n++;
  }
  return n;
}

// BAKE A BIRTH — the whole recipe, in the declaration, so the overlay and
// GATE ARCHETYPES compose the identical spec (the STOCK recipe garage.js
// bakes its shelf by: template + page defaults + the selection, out through
// cageToSpec as deviations). The engine preset's ~40 values land through the
// panel's own exported mapping — an index alone would bake a default engine
// wearing the preset's name.
function designBake(sel, over) {
  const C2 = W.CAGE2 || ((typeof CAGE2 !== 'undefined') ? CAGE2 : null);
  const PG = W.CAGE_PAGE || ((typeof CAGE_PAGE !== 'undefined') ? CAGE_PAGE : null);
  if (!C2 || !C2.cageToSpec) throw new Error('CAGE2 not loaded');
  const base = Object.assign(C2.cageDefaults(), (PG && PG.defaults) || {});
  const { cage, spec, missing } = designApply(base, sel);
  if (missing.length) throw new Error('unresolved: ' + missing.join(', '));
  // G140: the archetype's own cage patch — the retired planform tiles'
  // writes live here now. Function values resolve against the selection's
  // result, so "tip = 0.72 of the chord" reads the class's chord.
  if (over && over.cage) {
    const work = Object.assign({}, base, cage);
    for (const k in over.cage) {
      let v = over.cage[k];
      if (typeof v === 'function') v = v(work);
      cage[k] = v; work[k] = v;
    }
  }
  const full = Object.assign(base, cage);
  if ('engPreset' in cage && W.CAGE_ENG_APPLY_PRESET) {
    const names = designEngineModels().map(o => o.value);
    const nm = names[cage.engPreset];
    if (nm) W.CAGE_ENG_APPLY_PRESET(full, nm);
  }
  const out = { cage: C2.cageToSpec(full) };
  // THE BIRTH SPEC STATES WHAT IT CHOSE. spec.cage carries the wing and the
  // engine as PANEL values, and in the app the join measures them back into
  // the spec on the very next build (loadSpec calls BUILD_SYNC) — but the
  // spec as COMPOSED must already be the aeroplane it names: GATE ARCHETYPES
  // flies it pre-join, and a birth document whose wing is GEN_DEFAULT's
  // whatever the class said would be wrong on its own terms. The mappings
  // are the join's own verbatim ones (_join_check gates them); where the
  // join MEASURES rather than passes (gear stations, tail arm, the cabin
  // box) nothing is stated here — the intent channel carries only choices.
  const tipKeys = Object.keys(gTips() || {});
  const flapKeys = Object.keys(gFlaps() || {});
  const wing = {
    span: +full.wgSpan, chord: +full.wgChord,
    taper: +full.wgChord > 0
      ? +(+full.wgChordTip / +full.wgChord).toFixed(4) : 1,
    sweep: +full.wgSweep, dihedral: +full.wgDihedral,
    position: ['high', 'mid', 'low'][Math.round(full.wgPos)] || 'high',
  };
  if (tipKeys[Math.round(full.wgTip)])
    wing.tip = tipKeys[Math.round(full.wgTip)];
  designMerge(out, { wings: [wing], bracing: {
    type: Math.round(full.wgBrace) ? 'cantilever' : 'strut' } });
  if (flapKeys[Math.round(full.wgFlapType)])
    designMerge(out, { controls: { flap: {
      type: flapKeys[Math.round(full.wgFlapType)] } } });
  const JE = (typeof CAGE_JOIN_ENGINES !== 'undefined') ? CAGE_JOIN_ENGINES
           : W.CAGE_JOIN_ENGINES;
  const names = designEngineModels().map(o => o.value);
  const engKey = JE && JE[names[Math.round(full.engPreset)]];
  // THE MOUNT IS INTENT (2026-09-04): the pre-join spec GATE ARCHETYPES flies
  // must carry the mount the tiles chose, or a pusher archetype flies as a
  // tractor until the page's join runs. A wing pair is two entries.
  const mk = ['nose', 'pusher', 'wingTop', 'wing'][Math.round(full.engMount || 0)]
           || 'nose';
  const eng = Object.assign(engKey ? { type: engKey } : {}, { mount: mk });
  if (mk === 'wingTop') eng.pylon = Math.max(0.05, +full.engPylonH || 0.30);
  designMerge(out, { engines: mk === 'wing' ? [eng, Object.assign({}, eng)] : [eng] });
  // ...and so is an open frame (G172's joined row)
  if (!(full.skinOn == null || +full.skinOn))
    designMerge(out, { fuselage: { covering: 'open' } });
  designMerge(out, spec);
  if (over) designMerge(out, over.spec || over);
  return out;
}

// an archetype is skippable exactly when one of its selected options is
// inactive — DERIVED, never declared, so the two cannot disagree. The one
// exception is `blocked`: a MEASURED archetype-level reason (every option
// live, the combination un-flyable — the radial tourer). It is declared
// prose because the measurement cannot be re-taken cheaply; the guard on it
// going stale is loud, not silent — deleting the field makes GATE ARCHETYPES
// fly the build and fail.
function archInactive(a) {
  if (a.blocked) return a.blocked;
  for (const rowKey in a.sel) {
    const opt = optionOf(rowKey, a.sel[rowKey]);
    if (opt && opt.inactive)
      return rowByKey[rowKey].label + ' · ' + opt.label + ': ' + opt.inactive;
  }
  return null;
}

const API = { DESIGN_ROWS, DESIGN_GROUPS, ARCHETYPES, rowByKey, rowOptions,
              optionOf, designApply, designSeed, designMerge,
              designOverwriteCount, designBake, archInactive, archIcon,
              designEngineModels, designEngineFamilies, designPresetFamily,
              designPresetIndex };

if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.CAGE_DESIGN = API;

})();
