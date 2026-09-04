// FIN GEN — the vertical tail as the user drew it (G22). The primitive is the
// user's own Blender sketch (Downloads/proceduralPlaneFinCage.obj, byte-copied
// to tools/_fin_ref.obj), reproduced exactly the way _cage_gen.js reproduces
// the fuselage template: FIN_DEFAULT is the fiche (every measured number),
// buildFin2 emits the cage, FIN_PARAMS is the slider identity, and
// _fin_check.js is the verdict.
//
// METHOD RULING (user, G21 §5 and again on delivery of the sketch): 2D FIRST.
// The fin is a FLAT quad sheet in the x = 0 plane; Catmull-Clark runs on the
// 2D shape, and thickness comes later, as does the post-subsurf cut into fin
// and rudder. So this module emits an OPEN sheet, and the mesh is safe through
// cageSubdivide because every boundary edge is max-creased (THE CREASE LAW: a
// boundary must stay put — its edge points never average missing faces). A
// creased boundary refines as the cubic B-spline of the boundary verts, which
// is exactly what Blender's subsurf does to an open sheet, so the outline here
// rounds its corners the way the user's sketch does under their modifier.
//
// WHAT THE SKETCH SAYS (materials are annotations):
//   leadingA / leadingB   the dorsal: the leading edge continues FORWARD along
//                         the fuselage top in two sections; the kink at each
//                         section's aft vertical edge is a controllable
//                         semi-sharp crease (crA at the A/B column, crB where
//                         B meets the fin proper)
//   doubleLoopH           TWO strands 0.1–14 mm apart running the root: the
//                         guard pair that keeps the sheet flat where it meets
//                         the fuselage. The LOWER strand is the root boundary
//                         and belongs to the SKIN (see deck below)
//   doubleLoopV           the guard pair of columns at the tailpost — holds
//                         the surface flat through the future rudder hinge
//   optionalKeelExtension the bottom part, optional: anchors the rudder base
//                         down at the keel
//   topFwd / topAft       the tip, split at the hinge columns
//
// THE ROOT FOLLOWS THE SKIN (G21: a line between two points on a curved body
// goes inside it). With S.deck = { top(z), bot(z) } — the fuselage centreline
// polylines, live from whatever cage the editor holds — the root strands are
// placed ON the deck keeping only the sketch's guard gap, the dorsal keeps its
// fiche height over the root line, and the keel row rides the keel. Aft of the
// hinge column the deck is ANCHORED level at its tailpost value: the raw
// centreline dives around the tail-cap corner rounding, which is the cap's
// geometry, not the deck's. After subdivision, finProjectRoot puts the
// boundary offspring back on the deck exactly — that is the cure for the
// rounded artifact that went through the fuselage in the sketch.
// With S.deck null the fiche's absolute values are used and the sketch is
// reproduced bit-exactly (the fit check runs this way).
//
// THE 3 CORNERS (user ask: free on two axes each): tip (fore-aft carries the
// shoulder with it), top-aft, and the rudder-base corner. The trailing edge
// re-derives as the line top-aft -> base with the sketch's residuals, so the
// identity deltas rebuild the sketch exactly and a raked TE stays straight.
'use strict';
(() => {

const FIN_DEFAULT = {
  // columns (z, + toward the nose; the sketch shares the template's units)
  zA: -0.545272,        // dorsal forward tip, on the fuselage top
  zB: -1.984325,        // section A/B junction (crA creases here)
  zC: -2.742262,        // dorsal joins the fin proper (crB creases here)
  zTip: -3.465211,      // tip corner column
  zShoulder: -3.449056, // the LE shoulder under the tip (moves with it)
  zH1: -4.153548,       // hinge guard column 1 — the tailpost
  zH2: -4.177224,       // hinge guard column 2
  zTE: -4.522893,       // trailing edge
  zCap: -4.162269,      // the TEMPLATE's tail cap, the sketch's anchor: with
                        // a live deck the whole fin translates by (deck aft
                        // end - zCap), so the hinge pair lands on the actual
                        // tailpost of whatever aeroplane the editor holds —
                        // measured on the jodel the fuselage is a full unit
                        // shorter than the template the sketch was drawn on
  // rows
  yTip: 2.552222,       // tip corner (4.4 mm proud of the top row)
  yTop: 2.547858,       // top row at H1/H2/TE
  yMid: 1.923337,       // mid row (tip quads sit on it)
  yShoulder: 1.943856,  // the shoulder, 20.5 mm above the mid row
  yU: 0.827620,         // upper-root row (the fin body's lower interior row)
  yKeel: -0.043367,     // keel-extension row
  // root strands, absolute sketch y per column: lo is the boundary that sits
  // on the fuselage, hi its guard — the gap (hi - lo) is the design, the
  // absolute values are the sketch's own approximation of the template deck
  lo: { A: 0.653574, B: 0.604850, C: 0.564827, H: 0.510651 },
  hi: { A: 0.653697, B: 0.605764, C: 0.579066, H: 0.524890 },
  // dorsal leading-edge heights (kept relative to the root line under deck)
  le: { A: 0.669103, B: 0.720054, C: 0.881796 },
  // keel-row stand-off above the fuselage keel at the tailpost, measured on
  // the step-2 template subdivided x2 (keel(zH1) = -0.063774); the check
  // re-measures it
  offKeel: 0.020407,
};

// boundary crease weight: sharp through any subsurf level the bench offers
const FIN_BOUNDARY_W = 9;

// material names, in the sketch's own usemtl order (used by the check and by
// the layer's palette)
const FIN_MATS = ['all', 'doubleLoopV', 'doubleLoopH', 'optionalKeelExtension',
                  'topFwd', 'topAft', 'leadingA', 'leadingB'];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerpAt = (z1, y1, z2, y2, z) => y1 + (y2 - y1) * (z - z1) / (z2 - z1);
const ekey = (a, b) => a < b ? a + '_' + b : b + '_' + a;

// S = { dorsal, keelExt, crA, crB, tipZ, tipY, aftZ, aftY, baseZ, baseY,
//       midY, uY, leZ, leY, shoulderZ, shoulderY, topY, teRoot, teU, teMid,
//       deck }
function buildFin2(S) {
  const D = FIN_DEFAULT;
  const deck = S.deck || null;
  const dorsal = S.dorsal === undefined ? 1 : Math.round(S.dorsal);
  // ROOT LOOPS (user ask: "could we be more economical through clever use
  // of creasing?"): the sketch's doubleLoopH guard pair is the identity,
  // but the boundary is max-creased anyway (the crease law), so the hi
  // strand can be dropped entirely — every face table below resolves 'hi'
  // names to 'lo' and degenerate quads vanish. G12.2's move, on the fin.
  const guard = S.rootGuard === undefined ? 1 : Math.round(S.rootGuard);
  const R = n => (!guard && n[0] === 'h' && n[1] === 'i')
    ? 'lo' + n.slice(2) : n;
  // CUT PREP (1 = hinge cut, 2 = horn cut): a mesh-aligned cut needs its
  // rails — THE TWO ARTERIES, the user's term — to STAY PUT through
  // subdivision, so they are max-creased: a creased run of same-coordinate
  // verts is an affine average of itself, so the guard columns stay exact
  // vertical lines and the row stays exactly horizontal (verts may slide
  // ALONG a rail, which is harmless). Without this the drawn guard band
  // ballooned to 6-8x its width (topH1 slides forward under the tip's
  // pull, topH2 aft; the creased row's own B-spline walked midH1 toward
  // the shoulder). The columns crease FULL HEIGHT in both modes; horn prep
  // adds the row crease and snaps the shoulder onto the row, so the horn
  // line terminates on a mesh vertex.
  const prep = Math.round(S.cutPrep !== undefined ? S.cutPrep
                          : (S.hornPrep ? 2 : 0));
  const horn = prep === 2 ? 1 : 0;
  const def = (v, d) => v === undefined ? d : v;
  // rebase: the sketch is anchored at the TEMPLATE's tail cap; a live deck
  // translates the whole fin so the hinge pair lands on the actual tailpost
  // (deck.z0 is the live cap — the aft end of the skin's centreline).
  // Measured on the jodel: its fuselage is a full unit shorter than the
  // template the sketch was drawn on, so without this the fin floats in air
  // behind the aeroplane.
  const dz = deck ? deck.z0 - D.zCap : 0;
  const Z = z => z + dz;
  // tailpost anchor: aft of the hinge the strand continues LEVEL
  const topAt = deck ? z => deck.top(Math.max(z, Z(D.zH1))) : null;
  const botAt = deck ? z => deck.bot(Math.max(z, Z(D.zH1))) : null;
  // VERTICAL REBASE (G26.5, user): the root rows already ride the live
  // deck, but the upper rows and corners were template-absolute — a
  // deck that MOVES (the rod height slider) stretched the fin between
  // a cured root and a fixed top. The whole fin now TRANSLATES with
  // the deck: dyR = the live deck at the hinge station vs the sketch's
  // own root level, added to every absolute height (rows and top/aft
  // corners; the keel side, the dorsal and the shoulders were already
  // relative). No deck = 0 = the sketch identity — and the stab's
  // FLAT deck sits exactly at the sketch root, so it stays 0 there.
  const dyR = deck ? topAt(Z(D.zH1)) - D.lo.H : 0;

  // the movable ROWS (the ring-editor rule: rows + corners is the shape).
  // The Cub tail is the proof case: it drops the mid row 0.46 and the u row
  // 0.19, and aligns its LE root and shoulder ONTO those rows.
  const yMid = D.yMid + (S.midY || 0) + dyR;
  const yU = D.yU + (S.uY || 0) + dyR;

  // THE ROOT'S FORWARD POINT IS ITS OWN STATION (user ask: shifting the
  // whole surface is not the control): rootFwd moves the drawn front
  // column, clamped between the dorsal's B column (dorsal on) or the
  // dorsal-tip station (off) and the hinge
  const zCc = clamp(D.zC + (S.rootFwd || 0),
                    D.zH1 + 0.15, dorsal ? D.zB - 0.05 : D.zA);

  // root rows per column: on the deck keeping the sketch's gaps, or the
  // fiche's absolute sketch values when no deck is given
  const lo = {}, hi = {}, le = {};
  for (const [c, z] of [['A', D.zA], ['B', D.zB], ['C', zCc]]) {
    lo[c] = deck ? topAt(Z(z)) : D.lo[c];
    hi[c] = lo[c] + (D.hi[c] - D.lo[c]);
    le[c] = lo[c] + (D.le[c] - D.lo[c]);
  }
  const loH = deck ? topAt(Z(D.zH1)) : D.lo.H;
  const hiH = loH + (D.hi.H - D.lo.H);
  const kY = deck ? botAt(Z(D.zH1)) + D.offKeel : D.yKeel;

  // corners, clamped so no column can cross its neighbour. baseY moves the
  // BASE CORNER ONLY: the Cub sweeps its rudder bottom up for tailwheel
  // clearance while kH1/kH2 stay on the keel at the tailpost.
  const leCz = zCc + (dorsal ? 0 : (S.leZ || 0));
  const tipZ = clamp(D.zTip + (S.tipZ || 0), D.zH1 + 0.12, leCz - 0.05);
  const tipY = Math.max(yMid + 0.10, D.yTip + (S.tipY || 0) + dyR);
  const taZ = clamp(D.zTE + (S.aftZ || 0), D.zTE - 0.5, D.zH2 - 0.03);
  const taY = Math.max(yMid + 0.10, D.yTop + (S.aftY || 0) + dyR);
  const baZ = clamp(D.zTE + (S.baseZ || 0), D.zTE - 0.5, D.zH2 - 0.03);
  const baY = kY + (S.baseY || 0);

  // the shoulder rides the tip and the mid row at its fiche offsets — both
  // offsets are sliders (defaults = the fiche, so identity moves nothing;
  // the Cub zeroes the y offset and pushes the shoulder 0.28 fwd)
  const shoulderZ = tipZ + def(S.shoulderZ, D.zShoulder - D.zTip);
  const shoulderY = horn ? yMid
    : yMid + def(S.shoulderY, D.yShoulder - D.yMid);

  // top guard pair: ONE shared y — on the moved tip->top-aft chord at the
  // pair's own mid-z, plus the sketch's residual over its own chord (exact
  // for the identity), plus the topY bulge (the Cub's rounded top sits 83 mm
  // proud of its chord)
  const zHmid = (D.zH1 + D.zH2) / 2;
  const topPairY = lerpAt(tipZ, tipY, taZ, taY, zHmid)
    + (D.yTop - lerpAt(D.zTip, D.yTip, D.zTE, D.yTop, zHmid))
    + (S.topY || 0);

  // trailing edge: the top-aft -> base chord, plus per-row BULGE offsets.
  // In the sketch both corners share z, so every height lands on zTE and the
  // bulges are 0 (the identity). The Cub's D-shaped rudder is drawn here:
  // furthest aft at the root rows, easing to both corners. The strand pair
  // takes ONE shared z (a guard pair is a vertical-aligned pair by role).
  // the base corner's PERPENDICULAR pull, keel-off (user ruling: the
  // clearance is centre-apart, not fore-aft): the strand's own TE end
  // lifts off the root line, guard partner riding along — on the stab that
  // is the elevator's inboard-aft corner pulled OUTBOARD, on a keel-less
  // fin the rudder's bottom corner pulled up. With the keel tab, baseY
  // keeps its kTE (up-down) meaning and the strand stays level.
  const loTEy = S.keelExt ? loH : loH + (S.baseY || 0);
  const hiTEy = loTEy + (D.hi.H - D.lo.H);
  const yBA = S.keelExt ? baY : loTEy;
  const teZ = y => taZ + (baZ - taZ) * (taY - y) / ((taY - yBA) || 1);
  // positive offsets pull a TE row FORWARD (the clearance notch); clamped
  // aft of the hinge band so the surface can never fold through its own
  // hinge columns
  const teLim = D.zH2 - 0.05;
  const teRootZ = Math.min(teZ((loTEy + hiTEy) / 2) + (S.teRoot || 0), teLim);
  const teUZ = Math.min(teZ(yU) + (S.teU || 0), teLim);
  const teMidZ = Math.min(teZ(yMid) + (S.teMid || 0), teLim);

  // ---- emission, in the sketch OBJ's own vertex order -----------------------
  // (all z through Z(): the rebase, the identity when there is no deck)
  const V = [], IX = {};
  const P = (name, y, z) => { IX[name] = V.length; V.push([0, y, Z(z)]); };
  if (dorsal) {
    P('leA', le.A, D.zA);               // 321
    P('loA', lo.A, D.zA);               // 322
    P('leB', le.B, D.zB);               // 323
    P('loB', lo.B, D.zB);               // 324
  }
  P('midH2', yMid, D.zH2);              // 325
  P('midH1', yMid, D.zH1);              // 326
  // the LE root: with the dorsal it rides the deck at its fiche height over
  // the root line; WITHOUT the dorsal (the Cub) it becomes the fin's own
  // leading-edge corner — on the u row, free fore-aft — and the whole front
  // column turns boundary, so the LE rounds off like the reference tail
  if (dorsal) P('leC', le.C, zCc);      // 327
  else P('leC', yU + (S.leY || 0), leCz);
  P('loC', lo.C, zCc);                  // 328
  P('uH1', yU, D.zH1);                  // 329
  P('loH1', loH, D.zH1);                // 330
  P('uTE', yU, teUZ);                   // 331
  P('loTE', loTEy, teRootZ);            // 332
  if (S.keelExt) {
    P('kH1', kY, D.zH1);                // 333
    P('kTE', baY, teZ(baY));            // 334 — the base corner
  }
  if (dorsal && guard) {
    P('hiA', hi.A, D.zA);               // 335
    P('hiB', hi.B, D.zB);               // 336
  }
  P('shoulder', shoulderY, shoulderZ);  // 337
  if (guard) P('hiC', hi.C, zCc);       // 338
  if (guard) P('hiH1', hiH, D.zH1);     // 339
  if (guard) P('hiTE', hiTEy, teRootZ); // 340
  P('loH2', loH, D.zH2);                // 341
  P('uH2', yU, D.zH2);                  // 342
  if (S.keelExt) P('kH2', kY, D.zH2);   // 343
  if (guard) P('hiH2', hiH, D.zH2);     // 344
  P('midTE', yMid, teMidZ);             // 345
  P('topH2', topPairY, D.zH2);          // 346
  P('topTE', taY, taZ);                 // 347
  P('topH1', topPairY, D.zH1);          // 348
  P('tip', tipY, tipZ);                 // 349

  const F = [];
  const Q = (m, ...names) => {
    // resolve hi->lo in single-loop root mode; strips collapse and vanish
    const v = [];
    for (const n of names) {
      const i = IX[R(n)];
      if (v[v.length - 1] !== i && v[0] !== i) v.push(i);
    }
    if (v.length >= 3) F.push({ v, m });
  };
  Q('all', 'uH2', 'uTE', 'midTE', 'midH2');
  Q('all', 'uH2', 'hiH2', 'hiTE', 'uTE');
  Q('all', 'leC', 'hiC', 'hiH1', 'uH1');
  Q('all', 'leC', 'uH1', 'midH1', 'shoulder');
  Q('doubleLoopV', 'uH1', 'uH2', 'midH2', 'midH1');
  Q('doubleLoopV', 'midH1', 'midH2', 'topH2', 'topH1');
  Q('doubleLoopV', 'uH1', 'hiH1', 'hiH2', 'uH2');
  if (dorsal) Q('doubleLoopH', 'hiA', 'loA', 'loB', 'hiB');
  Q('doubleLoopH', 'hiC', 'loC', 'loH1', 'hiH1');
  Q('doubleLoopH', 'hiH2', 'loH2', 'loTE', 'hiTE');
  Q('doubleLoopH', 'hiH1', 'loH1', 'loH2', 'hiH2');
  if (dorsal) Q('doubleLoopH', 'loB', 'loC', 'hiC', 'hiB');
  if (S.keelExt) {
    Q('optionalKeelExtension', 'loH2', 'loH1', 'kH1', 'kH2');
    Q('optionalKeelExtension', 'loTE', 'loH2', 'kH2', 'kTE');
  }
  Q('topFwd', 'shoulder', 'midH1', 'topH1', 'tip');
  Q('topAft', 'midH2', 'midTE', 'topTE', 'topH2');
  if (dorsal) {
    Q('leadingA', 'leA', 'hiA', 'hiB', 'leB');
    Q('leadingB', 'hiC', 'leC', 'leB', 'hiB');
  }

  // ---- creases --------------------------------------------------------------
  const E = new Map();
  const tag = (w, a, b) => {
    const ia = IX[R(a)], ib = IX[R(b)];
    if (w > 0 && ia !== undefined && ib !== undefined && ia !== ib)
      E.set(ekey(ia, ib), w);
  };
  // the sections' vertical edges — semi-sharp, the same semantics as the
  // fuselage's crease sliders (weight = levels held sharp, fractions lerp).
  // Without the dorsal crA has no edges and crB's column is boundary anyway
  // (the boundary weight below wins, which is what a leading edge wants).
  tag(S.crA || 0, 'leB', 'hiB'); tag(S.crA || 0, 'hiB', 'loB');
  tag(S.crB || 0, 'leC', 'hiC'); tag(S.crB || 0, 'hiC', 'loC');
  // every boundary edge max-creased (open sheet through cageSubdivide)
  const use = new Map();
  for (const f of F) for (let i = 0; i < f.v.length; i++) {
    const k = ekey(f.v[i], f.v[(i + 1) % f.v.length]);
    use.set(k, (use.get(k) || 0) + 1);
  }
  for (const [k, n] of use)
    if (n === 1) E.set(k, Math.max(E.get(k) || 0, FIN_BOUNDARY_W));
  // THE RUDDER-BASE LINE STAYS PUT. With the keel extension on, the aft
  // strand is no longer a boundary — it is the fold the tab hangs from, and
  // its 0.55-unit quads pull the fold (and, through it, a metre of root line)
  // 86 mm down through the tail cone. That IS the sketch's rounded artifact.
  // Same law as the boundary, same weight: the fold refines as the B-spline
  // of its own verts, level, exactly as drawn — and the tab toggle no longer
  // changes how the line above it behaves.
  if (S.keelExt) {
    E.set(ekey(IX.loH1, IX.loH2), FIN_BOUNDARY_W);
    E.set(ekey(IX.loH2, IX.loTE), FIN_BOUNDARY_W);
  }

  // the root boundary strand, recorded as a chain so its offspring can be
  // projected back onto the deck after subdivision (cageSubdivide propagates
  // any key named in seamKeys)
  const strand = (dorsal ? ['loA', 'loB'] : [])
    .concat(['loC', 'loH1', 'loH2', 'loTE']);
  const finRootLo = [];
  for (let i = 0; i + 1 < strand.length; i++)
    finRootLo.push([IX[strand[i]], IX[strand[i + 1]]]);
  // the mid row and the two hinge guard COLUMNS, recorded the same way —
  // these are the horn cut's rails: the cut runs ALONG their offspring edge
  // loops, so it never crosses a quad (user ruling after the clipped-
  // triangle wireframe). Columns are split at the row so the horn cut can
  // use only their below-row halves (the crown stays whole over the slot).
  const chainOf = names => {
    const c = [];
    let prev = null;
    for (const n of names) {
      const i = IX[R(n)];
      if (i === undefined || i === prev) continue;
      if (prev !== null) c.push([prev, i]);
      prev = i;
    }
    return c;
  };
  const finMidRow = chainOf(['shoulder', 'midH1', 'midH2', 'midTE']);
  const kTail = S.keelExt ? ['kH1'] : [];
  const kTail2 = S.keelExt ? ['kH2'] : [];
  const finColH1a = chainOf(['topH1', 'midH1']);
  const finColH1b = chainOf(['midH1', 'uH1', 'hiH1', 'loH1'].concat(kTail));
  const finColH2a = chainOf(['topH2', 'midH2']);
  const finColH2b = chainOf(['midH2', 'uH2', 'hiH2', 'loH2'].concat(kTail2));
  // cut prep: crease THE TWO ARTERIES the cuts run along (user ruling: one
  // straight vertical, one straight horizontal, defining the cuts). The
  // vertical artery is the drawn guard pair, creased FULL HEIGHT — an
  // exact narrow parallel strip through the crown, no drift, no spread.
  // The horizontal artery is the row, creased FULL LENGTH: the line stays
  // dead horizontal to its very end (user ruling v2, on the wireframe: the
  // straight line outranks the soft TE corner — pinning midTE puts the
  // outline's corner exactly ON the line, which is what a full-horizontal
  // edge means). The earlier fade-and-snap compromise is gone: it also
  // sheared the quad row above the line after subdivision.
  const creaseChains = [];
  if (prep) creaseChains.push(finColH1a, finColH1b, finColH2a, finColH2b);
  if (prep === 2) creaseChains.push(finMidRow);
  for (const ch of creaseChains)
    for (const [a, b] of ch) E.set(ekey(a, b), FIN_BOUNDARY_W);
  // and the LEADING EDGE (the aerodynamic one), kept as the outline's
  // identity marker. With the dorsal it is the ridge from the dorsal tip to
  // the fin tip; without it, the fin's own front column down to the root.
  const finLE = chainOf(dorsal ? ['leA', 'leB', 'leC', 'shoulder', 'tip']
                               : ['loC', 'hiC', 'leC', 'shoulder', 'tip']);

  // CORNER SHARPNESS (the slider the original plan promised): semi-sharp
  // VERTEX weights on the outline's corners — an outline quad corner has
  // only two (boundary) edges, so no edge crease can ever pin it (the G21
  // trap); the vertex weight can. 0 = the B-spline round (the identity),
  // 3 = crisp through three levels; fractions in between are the radius
  // family. The Jodel's angular profile is straight outline runs with
  // these at high weight.
  const VW = new Map();
  const vwSet = (name, w) => {
    const i = IX[R(name)];
    if (i !== undefined && w > 0) VW.set(i, w);
  };
  vwSet('tip', S.sharpTip || 0);
  vwSet('topTE', S.sharpAft || 0);
  vwSet(S.keelExt ? 'kTE' : 'loTE', S.sharpBase || 0);
  vwSet('shoulder', S.sharpShoulder || 0);
  vwSet('leC', S.sharpLE || 0);

  // THE VERTEX NAMES GO OUT WITH THE MESH (2026-09-03). `IX` is the map this
  // function builds anyway — the sketch's own names against the emitted
  // order — and publishing it is what lets a caller ask WHERE a named corner
  // ended up: the editor pins the tip, the shoulder, the rows and the guard
  // strands from it while you hover their sliders. A caller must resolve
  // through it defensively: with the guard pair off there is no `hi*`, with
  // the keel tab off no `k*`, and without the dorsal no `leA`/`loA`/`leB`/`loB`.
  const out = { V, F, E, IX, finRootLo, finMidRow, finLE,
                finColH1a, finColH1b, finColH2a, finColH2b,
                seamKeys: ['finRootLo', 'finMidRow', 'finLE',
                           'finColH1a', 'finColH1b',
                           'finColH2a', 'finColH2b'] };
  if (VW.size) out.VW = VW;
  out.deckTop = topAt;              // for finProjectRoot (lost on subdivide —
  out.deckBot = botAt;              // callers keep the built mesh)
  // the band's centre (the row-shift transition hides on its far side of
  // this) and the row height, for the cutter and the thickness taper
  out.cutZ = Z((D.zH1 + D.zH2) / 2);
  out.rowY = yMid;                  // the mid row = the horn cut's own rail
  return out;
}

// put the root boundary (and its subdivision offspring) ON the skin. topAt is
// the anchored deck from the mesh buildFin2 returned; zMin bounds the
// projection to WHERE THE FUSELAGE EXISTS (pass the deck polyline's aft end).
// Aft of it the strand is the rudder-base line hanging in air — and, with the
// keel extension on, an interior fold that subsurf legitimately eases toward
// the keel row — so it keeps the shape subdivision gave it. Returns the
// largest correction, which is the measured size of the artifact this cures.
function finProjectRoot(m, topAt, zMin) {
  if (!m.finRootLo || !topAt) return { n: 0, max: 0 };
  if (zMin === undefined) zMin = -Infinity;
  const ids = new Set();
  for (const [a, b] of m.finRootLo) { ids.add(a); ids.add(b); }
  let max = 0, n = 0;
  for (const i of ids) {
    const v = m.V[i];
    if (v[2] < zMin) continue;
    const y = topAt(v[2]);
    max = Math.max(max, Math.abs(v[1] - y));
    v[1] = y; n++;
  }
  return { n, max };
}

// ---- THE CUT (fin / rudder), ALONG THE MESH --------------------------------
// USER RULING v2, from the wireframes: NO clipped polygons anywhere. The
// hinge slot IS the drawn doubleLoopV guard band — the strip of faces
// between the two guard columns is DELETED, and each part keeps its own
// guard column at its cut face, which is exactly what the pair was drawn
// for. The horn line is the mid row's own edge loop: faces partition
// topologically (a flood fill that never crosses a rail edge), and the slot
// opens by shifting the two copies of the row apart by gap/2. Every output
// face is a sheet quad, untouched except those row shifts.
//
// Rim flatness is TOPOLOGICAL too: every emitted copy of a rail vert (row
// or column chains) is recorded in cutKeys, and finThicken keeps a rim edge
// flat when both its ends are rail verts — no geometric line matching, so a
// rail that is not perfectly straight (the columns are not creased) still
// makes flat slot faces.
//   mode 1  hinge only: the full columns cut crown and all; the fin keeps
//           its crown forward of the band
//   mode 2  horn balance: the columns cut below the row only, the rudder
//           wraps over the fin through the crown
const keyOf = p => Math.round(p[1] * 1e7) + '_' + Math.round(p[2] * 1e7);

function finCutMesh(s, opts) {
  const mode = Math.round(opts.mode || 0);
  if (!mode) return s;
  const gap = opts.gap || 0;
  const chain = k => s[k] || [];
  const barrier = new Set();
  const add = k => { for (const [a, b] of chain(k)) barrier.add(ekey(a, b)); };
  add('finColH1b'); add('finColH2b');
  if (mode === 1) { add('finColH1a'); add('finColH2a'); }
  const rowV = new Set();
  if (mode === 2)
    for (const [a, b] of chain('finMidRow')) {
      barrier.add(ekey(a, b));
      rowV.add(a); rowV.add(b);
    }
  const colV = new Set();
  for (const k of ['finColH1a', 'finColH1b', 'finColH2a', 'finColH2b'])
    for (const [a, b] of chain(k)) { colV.add(a); colV.add(b); }
  // flood-fill the faces with the rails as barriers
  const EF = new Map();
  s.F.forEach((f, fi) => {
    for (let i = 0; i < f.v.length; i++) {
      const k = ekey(f.v[i], f.v[(i + 1) % f.v.length]);
      if (barrier.has(k)) continue;
      if (!EF.has(k)) EF.set(k, []);
      EF.get(k).push(fi);
    }
  });
  const comp = new Array(s.F.length).fill(-1);
  let nc = 0;
  for (let seed = 0; seed < s.F.length; seed++) {
    if (comp[seed] >= 0) continue;
    const c = nc++;
    const stack = [seed];
    comp[seed] = c;
    while (stack.length) {
      const fi = stack.pop(), f = s.F[fi];
      for (let i = 0; i < f.v.length; i++)
        for (const gi of (EF.get(ekey(f.v[i], f.v[(i + 1) % f.v.length]))
                          || []))
          if (comp[gi] < 0) { comp[gi] = c; stack.push(gi); }
    }
  }
  // classify components by their extremes: the crown is the topmost (horn
  // mode), the fin the forward-most of the rest, the aft rudder the
  // rearmost; whatever remains is the hinge band — the slot — and drops
  const cy = new Array(nc).fill(-1e9);
  const czMax = new Array(nc).fill(-1e9), czMin = new Array(nc).fill(1e9);
  s.F.forEach((f, fi) => {
    let y = 0, z = 0;
    for (const i of f.v) { y += s.V[i][1]; z += s.V[i][2]; }
    y /= f.v.length; z /= f.v.length;
    const c = comp[fi];
    cy[c] = Math.max(cy[c], y);
    czMax[c] = Math.max(czMax[c], z);
    czMin[c] = Math.min(czMin[c], z);
  });
  let aboveC = -1;
  if (mode === 2)
    for (let c = 0; c < nc; c++)
      if (aboveC < 0 || cy[c] > cy[aboveC]) aboveC = c;
  let fwdC = -1, aftC = -1;
  for (let c = 0; c < nc; c++)
    if (c !== aboveC && (fwdC < 0 || czMax[c] > czMax[fwdC])) fwdC = c;
  for (let c = 0; c < nc; c++)
    if (c !== aboveC && c !== fwdC &&
        (aftC < 0 || czMin[c] < czMin[aftC])) aftC = c;
  const V = [], F = [], cutKeys = new Set();
  s.F.forEach((f, fi) => {
    const c = comp[fi];
    let part = null;
    if (c === fwdC) part = 'fin';
    else if (c === aftC || c === aboveC) part = 'rudder';
    else return;                               // the band: the slot itself
    const ids = f.v.map(id => {
      const p = s.V[id];
      let q = p;
      // the horn slot: ONLY the fin's copy of the row drops, by the full
      // gap — the rudder's underside stays exactly ON the row line, so the
      // crown's underside and the aft body's top read as ONE horizontal
      // line (user ruling: the half-and-half shift misaligned them)
      if (gap && rowV.has(id) && part === 'fin')
        q = [p[0], p[1] - gap, p[2]];
      V.push(q);
      if (rowV.has(id) || colV.has(id)) cutKeys.add(keyOf(q));
      return V.length - 1;
    });
    F.push({ v: ids, m: f.m, part });
  });
  return { V, F, cutKeys };
}

// ---- THICKNESS (post-subsurf, post-cut) ------------------------------------
// The sheet is settled flat FIRST (the 2D-first ruling), then each part is
// thickened on its own: two offset copies of the part's faces plus a rim
// band around its boundary. Because the cut happened in 2D, there is no 3D
// slab to cut and G21 §5's Eulerian pinch cannot occur — every part is a
// closed all-quad manifold BY CONSTRUCTION, and the cost is ~2x the sheet
// plus the rim (against 4x per level had the shell been subdivided).
//
// THE SECTION: flat sides at +-t(p)/2 and a ROUNDED RIM EVERYWHERE on the
// outline ("everything needs to be rounded") — an N-segment arc bulging
// along the in-plane outward normal, the drawn outline as the arc's crown.
// Only the cut's RAIL edges stay flat: finCutMesh records every rail vert
// in cutKeys, so slot faces identify themselves topologically. At a corner
// where a rounded outline meets a rail, THE CUT CUTS THE ROUND (user
// ruling): the arc keeps the outline's own normal and its points are
// projected into the cut's half-plane — the corner is the uncut nose's
// cross-section, aligned with the flat cut face.
//
// THICKNESS IS A FIELD, NOT A NUMBER: t = thick everywhere forward of the
// hinge, tapering linearly to thickTE at the aft extreme — a control
// surface is thickest at its spar and thins to its trailing end. No other
// deformation: the sheet's own shape is never touched.
// RIM SEGMENTS across the rounded edge. It was a module constant at 4, with no
// row anywhere, and four facets across a 60 mm edge is what the user saw:
// "the fin and slabs rounding is too low poly, its sides show easily".
// It is `opts.rimN` now, and the constant is the DEFAULT rather than the
// value, so nothing moves for a caller that does not ask.
const FIN_NOSE_N = 4;                    // rim segments (the LE nose arc)
const FIN_NOSE_N_MAX = 12;

function finThicken(m, opts) {
  // clamped AND NaN-guarded: a stale save or a blank field reaches here as
  // NaN, and NaN survives Math.max/min silently — the loop below then runs
  // zero times and the part comes out with no rim at all, which is a hole.
  const rimAsked = Math.round(+opts.rimN);
  const N = Number.isFinite(rimAsked)
    ? Math.max(2, Math.min(FIN_NOSE_N_MAX, rimAsked))
    : FIN_NOSE_N;
  const base = opts.thick, te = opts.thickTE === undefined
    ? opts.thick : opts.thickTE;
  const zH = opts.zHinge, zA = opts.zAftEnd;
  const tOf = p => {
    if (zH === undefined || zA === undefined || p[2] >= zH) return base;
    const u = Math.min(1, (zH - p[2]) / Math.max(1e-9, zH - zA));
    return base + (te - base) * u;
  };
  // the cut rails (from finCutMesh): a rim edge between two rail verts is a
  // slot face and stays FLAT; every other boundary edge is outline, ROUNDS
  const ck = m.cutKeys || null;
  const onCut = (A, B) => !!ck && ck.has(keyOf(A)) && ck.has(keyOf(B));

  const parts = new Map();
  for (const f of m.F) {
    const k = f.part || 'all';
    if (!parts.has(k)) parts.set(k, []);
    parts.get(k).push(f);
  }
  const OV = [], OF = [];
  for (const [part, faces] of parts) {
    const fStart = OF.length;
    // weld by position (the same keyOf as cutKeys): the cutter emits
    // per-face vertices, and a rim needs real topology to know its boundary
    const wIdx = new Map(), WV = [];
    const wf = [];
    for (const f of faces) {
      const v = [];
      for (const i of f.v) {
        const p = m.V[i], k = keyOf(p);
        if (!wIdx.has(k)) { wIdx.set(k, WV.length); WV.push(p); }
        const wi = wIdx.get(k);
        if (v[v.length - 1] !== wi) v.push(wi);       // drop micro-edges
      }
      while (v.length > 1 && v[0] === v[v.length - 1]) v.pop();
      if (v.length >= 3) wf.push({ v, m: f.m });
    }
    // the two sides
    const t = WV.map(tOf);
    const top = WV.map((p, i) => {
      OV.push([t[i] / 2, p[1], p[2]]); return OV.length - 1;
    });
    const bot = WV.map((p, i) => {
      OV.push([-t[i] / 2, p[1], p[2]]); return OV.length - 1;
    });
    for (const f of wf) {
      OF.push({ v: f.v.map(i => top[i]), m: f.m, part });
      OF.push({ v: f.v.slice().reverse().map(i => bot[i]), m: f.m, part });
    }
    // boundary edges, directed as their face traverses them
    const eCount = new Map(), eDir = new Map();
    wf.forEach(f => {
      for (let i = 0; i < f.v.length; i++) {
        const a = f.v[i], b = f.v[(i + 1) % f.v.length];
        const k = a < b ? a + '_' + b : b + '_' + a;
        eCount.set(k, (eCount.get(k) || 0) + 1);
        eDir.set(k, { a, b, m: f.m });
      }
    });
    const bEdges = [];
    for (const [k, n] of eCount) if (n === 1) bEdges.push(eDir.get(k));
    // per-vertex in-plane outward normal: average of the adjacent boundary
    // edges' normals, each oriented away from its face's own centroid
    const centroid = new Map();               // boundary edge key -> face mid
    wf.forEach(f => {
      let cy = 0, cz = 0;
      for (const i of f.v) { cy += WV[i][1]; cz += WV[i][2]; }
      cy /= f.v.length; cz /= f.v.length;
      for (let i = 0; i < f.v.length; i++) {
        const a = f.v[i], b = f.v[(i + 1) % f.v.length];
        const k = a < b ? a + '_' + b : b + '_' + a;
        if (eCount.get(k) === 1) centroid.set(k, [cy, cz]);
      }
    });
    // per-vertex adjacency: each boundary vertex sees its incident boundary
    // edges with their in-plane outward normals and their flat/round nature
    const adj = new Map();                    // welded vert -> [{ny,nz,flat}]
    for (const e of bEdges) {
      const A = WV[e.a], B = WV[e.b];
      let ny = B[2] - A[2], nz = -(B[1] - A[1]);      // a perpendicular
      const k = e.a < e.b ? e.a + '_' + e.b : e.b + '_' + e.a;
      const c = centroid.get(k);
      const my = (A[1] + B[1]) / 2 - c[0], mz = (A[2] + B[2]) / 2 - c[1];
      if (ny * my + nz * mz < 0) { ny = -ny; nz = -nz; }  // away from face
      const L = Math.hypot(ny, nz) || 1;
      const rec = { ny: ny / L, nz: nz / L, flat: onCut(A, B) };
      for (const vi of [e.a, e.b]) {
        if (!adj.has(vi)) adj.set(vi, []);
        adj.get(vi).push(rec);
      }
    }
    // one rim profile per boundary vertex: N+1 points, ends reusing the
    // side verts so the tube closes onto the sheets exactly.
    //   all edges flat -> square (a slot corner stays a corner)
    //   otherwise -> THE CUT CUTS THE ROUND (user ruling: "imagine the
    //     uncut piece, and just cut through the rounded profile too"): the
    //     arc runs along the ROUND edges' own normal — never the bisector —
    //     and where the vertex also touches a flat (cut) edge, every arc
    //     point is PROJECTED into the cut plane, UNCONDITIONALLY: the
    //     corner is the nose's cross-section IN the plane. One-sided
    //     clamping was not enough — on the horn's underside the crown's LE
    //     bulges AWAY from the plane, so the nose curled around the corner
    //     instead of being sliced like the fin's edge just below it
    //     (user report, wireframe 4).
    const prof = new Map(), pNrm = new Map();
    for (const [vi, edges] of adj) {
      const rounds = edges.filter(e => !e.flat);
      const flats = edges.filter(e => e.flat);
      let ny = 0, nz = 0;
      for (const e of (rounds.length ? rounds : edges)) {
        ny += e.ny; nz += e.nz;
      }
      const L = Math.hypot(ny, nz) || 1;
      ny /= L; nz /= L;
      const p = WV[vi], r = t[vi] / 2;
      const pts = [top[vi]];
      // THE RIM'S NORMAL IS KNOWN EXACTLY, HERE AND NOWHERE ELSE (user,
      // 2026-08-31: "the edge... should have smooth shading on the tranche...
      // only apply smooth shading to the rim, so we don't generate shading
      // artifacts on the flat surfaces").
      //
      // finMesh emits NON-INDEXED geometry and calls computeVertexNormals,
      // which on a non-indexed buffer hands every vertex its own triangle's
      // face normal — so the fin and the stab are faceted everywhere by
      // construction, and there is no flatShading flag to turn off. The fix
      // is not to weld: it is to AUTHOR the normal on the rim and leave the
      // sheets alone, and the arc's normal is already in hand at the exact
      // point it is being placed. At phi = +-PI/2 it is (+-1, 0, 0), which is
      // the sheet's own direction, so the rim meets the flat sides tangentially
      // and the junction needs no crease.
      //
      // Two cases keep the face normal instead, and both are right:
      //   * a SQUARE corner (no round edges at this vertex — a slot corner
      //     stays a corner)
      //   * a vertex whose arc is PROJECTED into a cut plane, where the
      //     surface is no longer the ideal arc: the normal is projected the
      //     same way and renormalised, so the shading follows the geometry
      //     rather than an arc that is not there.
      const nrm = rounds.length ? [] : null;
      const nAt = phi => {
        const q = [Math.sin(phi), ny * Math.cos(phi), nz * Math.cos(phi)];
        for (const f of flats) {
          const d = q[1] * f.ny + q[2] * f.nz;
          q[1] -= f.ny * d; q[2] -= f.nz * d;
        }
        const L = Math.hypot(q[0], q[1], q[2]);
        return L > 1e-9 ? [q[0] / L, q[1] / L, q[2] / L] : [1, 0, 0];
      };
      if (nrm) nrm.push(nAt(Math.PI / 2));
      for (let k = 1; k < N; k++) {
        const phi = Math.PI / 2 - Math.PI * k / N;
        const x = r * Math.sin(phi);
        const out = rounds.length ? r * Math.cos(phi) : 0;
        const q = [x, p[1] + ny * out, p[2] + nz * out];
        for (const f of flats) {
          const d = (q[1] - p[1]) * f.ny + (q[2] - p[2]) * f.nz;
          q[1] -= f.ny * d; q[2] -= f.nz * d;
        }
        OV.push(q);
        pts.push(OV.length - 1);
        if (nrm) nrm.push(nAt(phi));
      }
      pts.push(bot[vi]);
      if (nrm) nrm.push(nAt(-Math.PI / 2));
      prof.set(vi, pts);
      pNrm.set(vi, nrm);
    }
    for (const e of bEdges) {
      const Pa = prof.get(e.a), Pb = prof.get(e.b);
      const Na = pNrm.get(e.a), Nb = pNrm.get(e.b);
      for (let k = 0; k < N; k++) {
        // `n` is one normal per CORNER, in the face's own vertex order. Only
        // the rim carries it; every other face falls through to the face
        // normal, which is what keeps the flat sheets flat.
        const f = { v: [Pb[k], Pa[k], Pa[k + 1], Pb[k + 1]], m: e.m, part };
        if (Na && Nb) f.n = [Nb[k], Na[k], Na[k + 1], Nb[k + 1]];
        OF.push(f);
      }
    }
    // outward (per part): the sides + rim are coherent by construction, so
    // one signed volume decides the global flip
    let vol = 0;
    for (let fi = fStart; fi < OF.length; fi++) {
      const p = OF[fi].v.map(i => OV[i]);
      for (let k = 1; k + 1 < p.length; k++) {
        const [a, b, c] = [p[0], p[k], p[k + 1]];
        vol += a[0] * (b[1] * c[2] - b[2] * c[1])
             - a[1] * (b[0] * c[2] - b[2] * c[0])
             + a[2] * (b[0] * c[1] - b[1] * c[0]);
      }
    }
    // THE FLIP REORDERS THE AUTHORED NORMALS AND DOES NOT NEGATE THEM, and
    // getting that backwards is the one way this whole change goes silently
    // wrong. `n` is a GEOMETRIC outward normal — built from (ny, nz), which
    // is oriented away from the face's own centroid, and from the profile's
    // own x — so it is already correct whichever way the winding came out.
    // What the flip changes is the CORNER ORDER, so `n` has to be reordered
    // to stay with its vertex; negating it as well would point the rim
    // inward on exactly the parts the flip exists to fix.
    // (GATE FIN forces this branch — no fin or stab built today reaches it.)
    if (vol < 0)
      for (let fi = fStart; fi < OF.length; fi++) {
        OF[fi].v.reverse();
        if (OF[fi].n) OF[fi].n.reverse();
      }
  }
  return { V: OV, F: OF };
}

// ---- THE HORIZONTAL TAIL RIDES THE SAME MODEL ------------------------------
// (user ruling: the fin is the base for the stabilizer + elevator, and both
// the Cub's and the 172's tailplanes are this sheet WITHOUT the dorsal — the
// Cub's rounded planform is literally the FIN_CUB shape, the 172's taper is
// the corner sliders with the bulges at zero.) The fin builds in the (y, z)
// plane; a stab is the same finished solid laid FLAT: span = the fin's
// root->tip axis, thickness goes vertical, and the surface mirrors across
// the centreline. sRef is the fin-space root line (the flat "deck" the
// sheet was built against), so the root lands at rootX exactly.
// side +1 = right (a reflection — faces reverse to stay outward), -1 = left
// (two reflections = a rotation — winding survives).
function finToStab(m, opts) {
  const side = (opts.side || 1) >= 0 ? 1 : -1;
  const rootX = opts.rootX || 0, stabY = opts.stabY || 0;
  const sRef = opts.sRef || 0, zOff = opts.zOff || 0;
  const V = m.V.map(p => [side * (rootX + (p[1] - sRef)),
                          stabY + p[0], p[2] + zOff]);
  const F = m.F.map(f => ({
    v: side > 0 ? f.v.slice().reverse() : f.v.slice(),
    m: f.m, part: f.part }));
  return { V, F };
}

// the fuselage centreline polylines from a built cage mesh: top is the deck
// the fin rides, bot the keel its extension anchors to. Faces filtered by
// isSkin(mat) — the airframe contract's lesson: with the interior on, an
// unfiltered sweep would put the dash in the deck. Interpolators clamp to
// their ends; .z0/.z1 report the polyline's domain (z0 = the tail cap, which
// is also finProjectRoot's zMin).
function finCentreline(mesh, isSkin) {
  const pts = [], seen = new Set();
  for (const f of mesh.F) {
    if (isSkin && !isSkin(f.m)) continue;
    for (const i of f.v) {
      const [x, y, z] = mesh.V[i];
      if (Math.abs(x) > 1e-4) continue;
      const k = Math.round(z * 1e5) + '_' + Math.round(y * 1e5);
      if (seen.has(k)) continue;
      seen.add(k);
      pts.push([z, y]);
    }
  }
  if (!pts.length) return null;
  pts.sort((a, b) => a[0] - b[0]);
  // split the points into the TOP surface (the deck) and the BOTTOM (the
  // keel) by each point's position in its z-neighbourhood. A per-z-bucket
  // max alone put KEEL points on the deck wherever a keel station had no
  // deck twin at the same z — the box booms hid it (every ring carries
  // both), the sailplane's drooping aero nose interleaved them and the
  // dorsal rode a 1.07-unit sawtooth (user report).
  const W = 0.3;
  const top = [], bot = [];
  for (let i = 0; i < pts.length; i++) {
    const [z, y] = pts[i];
    let lo = 1e9, hi = -1e9;
    for (let j = i; j >= 0 && pts[j][0] > z - W; j--) {
      lo = Math.min(lo, pts[j][1]); hi = Math.max(hi, pts[j][1]);
    }
    for (let j = i; j < pts.length && pts[j][0] < z + W; j++) {
      lo = Math.min(lo, pts[j][1]); hi = Math.max(hi, pts[j][1]);
    }
    const conv = hi - lo < 0.05;          // a converged tip is both
    if (conv || y >= (lo + hi) / 2) top.push([z, y]);
    if (conv || y < (lo + hi) / 2) bot.push([z, y]);
  }
  const fn = (arr, pickMax) => {
    const m = new Map();
    for (const [z, y] of arr) {
      const k = Math.round(z * 1e5);
      if (!m.has(k) || (pickMax ? y > m.get(k) : y < m.get(k))) m.set(k, y);
    }
    const ps = [...m.entries()].map(([k, y]) => [k / 1e5, y])
      .sort((a, b) => a[0] - b[0]);
    const at = z => {
      if (z <= ps[0][0]) return ps[0][1];
      if (z >= ps[ps.length - 1][0]) return ps[ps.length - 1][1];
      let i = 0;
      while (ps[i + 1][0] < z) i++;
      const [za, ya] = ps[i], [zb, yb] = ps[i + 1];
      return ya + (yb - ya) * (z - za) / (zb - za);
    };
    at.z0 = ps[0][0]; at.z1 = ps[ps.length - 1][0];
    return at;
  };
  const T = fn(top, true);
  return { top: T, bot: fn(bot, false), z0: T.z0, z1: T.z1 };
}

// ---- the slider layer ------------------------------------------------------
// identity: finSpec(FIN_PARAMS) rebuilds the sketch bit-exactly (no deck)
const FIN_PARAMS = {
  finDorsal: 1,     // the dorsal (leadingA/B + the fwd root strand) — the
                    // Cub tail deletes it and roots the LE at the fin proper
  finRootGuard: 1,  // 1 = the sketch's doubleLoopH pair (the identity);
                    // 0 = single creased root, the hi strand economised away
  finKeel: 1,       // the optional keel extension (the sketch has it)
  finCrA: 0,        // section A crease, 0..3 (the sketch is uncreased)
  finCrB: 0,        // section B crease
  finTipZ: 0, finTipY: 0,     // tip corner, fore-aft / up-down
  finAftZ: 0, finAftY: 0,     // top-aft corner
  finBaseZ: 0, finBaseY: 0,   // rudder-base corner (corner ONLY — the keel
                              // row at the tailpost stays put)
  finMidY: 0,       // mid row up-down
  finUY: 0,         // u row up-down
  finRootFwd: 0,    // the root's forward point (the front column station)
  finLEZ: 0,        // dorsal-less LE root corner fore-aft (from column C)
  finLEY: 0,        // ...and up-down (from the u row)
  // the shoulder's offsets from the tip / the mid row; defaults ARE the
  // fiche (computed from it, so the identity moves nothing)
  finShoulderZ: FIN_DEFAULT.zShoulder - FIN_DEFAULT.zTip,
  finShoulderY: FIN_DEFAULT.yShoulder - FIN_DEFAULT.yMid,
  finTopY: 0,       // top guard pair, bulge above the tip->top-aft chord
  finTERoot: 0,     // TE bulges aft of the top-aft -> base chord, per row
  finTEU: 0,
  finTEMid: 0,
  // corner sharpness, 0 round .. 3 crisp (semi-sharp vertex weights)
  finSharpTip: 0, finSharpAft: 0, finSharpBase: 0,
  finSharpShoulder: 0, finSharpLE: 0,
};

function finSpec(P) {
  const g = k => (P && P[k] !== undefined) ? P[k] : FIN_PARAMS[k];
  return {
    dorsal: Math.round(g('finDorsal')),
    rootGuard: Math.round(g('finRootGuard')),
    keelExt: Math.round(g('finKeel')),
    crA: g('finCrA'), crB: g('finCrB'),
    tipZ: g('finTipZ'), tipY: g('finTipY'),
    aftZ: g('finAftZ'), aftY: g('finAftY'),
    baseZ: g('finBaseZ'), baseY: g('finBaseY'),
    midY: g('finMidY'), uY: g('finUY'),
    rootFwd: g('finRootFwd'),
    leZ: g('finLEZ'), leY: g('finLEY'),
    shoulderZ: g('finShoulderZ'), shoulderY: g('finShoulderY'),
    topY: g('finTopY'),
    teRoot: g('finTERoot'), teU: g('finTEU'), teMid: g('finTEMid'),
    sharpTip: g('finSharpTip'), sharpAft: g('finSharpAft'),
    sharpBase: g('finSharpBase'), sharpShoulder: g('finSharpShoulder'),
    sharpLE: g('finSharpLE'),
    deck: null,
  };
}

// THE CUB TAIL — the user's second reference cage (tools/_fin_cub_ref.obj,
// from Downloads/finCub.obj 2026-08-25): the same topology family with the
// dorsal deleted, reproduced by these settings alone. The numbers are solved
// from the reference by tools/_fin_check.js's own formulas and asserted
// there against the file, so they cannot silently drift.
const FIN_CUB = {
  finDorsal: 0, finKeel: 1, finCrA: 0, finCrB: 0,
  finTipZ: -0.371031, finTipY: -0.601326,
  finAftZ: 0.072501, finAftY: -0.780444,
  finBaseZ: -0.358237, finBaseY: 0.140736,
  finMidY: -0.455461, finUY: -0.191163,
  finLEZ: -0.349707, finLEY: 0,
  finShoulderZ: 0.284833, finShoulderY: 0,
  finTopY: 0.082651,
  finTERoot: -0.146812, finTEU: -0.177424, finTEMid: -0.153038,
};

const API = { FIN_DEFAULT, FIN_PARAMS, FIN_CUB, FIN_MATS, FIN_BOUNDARY_W,
              buildFin2, finSpec, finProjectRoot, finCentreline,
              finCutMesh, finThicken, finToStab };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.FIN_GEN = API;
})();
