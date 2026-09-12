// TAIL HEADLESS — the drawn tail without the page (TAIL CHANTIER 2, P0).
//
// The fin and stab LAYERS (_cage_fin.js, _cage_stab.js) compose a spec, pick
// a deck, build, subdivide, project the root, cut — then draw. This module
// is the first half of that with no THREE and no DOM, so a node gate, the
// sweep and the design flow can hold the SAME sheets the page draws and the
// same `measure` the layers publish (finMeasure, _fin_gen.js). GATE FIN pins
// the two on a captured page fixture (tools/fixtures/tail_measure_*.json).
//
//   tailBuild(P, opts)
//     P      the FULL cage param set — cageDefaults ⊕ the page's defaults ⊕
//            the build's values (the page's own P; designFull gives an
//            archetype's)
//     opts   { level: subsurf L (the page's #lvl; 2),
//              mesh:  a cage sheet to root on (CAGE2.cageSheet(P).sheet);
//                     built here when absent,
//              step:  the cage step ('crease') }
//   -> { fin:  { spec, cage, mesh, sheet, disp, deck, proj, measure } | null,
//        stab: { spec, cage, mesh, sheet, lay, cant, mount, measure } | null,
//        FS, level, approx: [what this build could not reproduce] }
//
// `approx` names the one thing the page has that this does not: a TWIN-BOOM
// deck. The layers root a twin-boom tail on window.CAGE_BOOMS, which the
// WING layer publishes when it draws — not built here, so a twin-boom build
// roots on the fuselage centreline and the row says so. Everything else is
// the layers' own arithmetic, line for line: change a layer, change this.
//
// Loads in node (require) and in the browser (window.TAIL_HEADLESS).
'use strict';
(() => {
const NODE = typeof module !== 'undefined' && module.exports;
const W = typeof window !== 'undefined' ? window : null;
const FIN = NODE ? require('./_fin_gen.js') : (W && W.FIN_GEN);
const CG2 = NODE ? require('./_cage_gen.js') : (W && W.CAGE2);
if (!FIN || !CG2) throw new Error('_tail_headless: _fin_gen.js and _cage_gen.js first');

// ---- the skin filter — the fin layer's own (_cage_fin.js) -----------------
// the gear module's set when it is loaded (one description of "skin"); the
// copy is the fallback the fin layer itself carries for a page without the
// gear. A FIN ROOTS ON STRUCTURE, NOT GLASS: the deck sweep skips the glazing
let GGM = null;
try { GGM = (W && W.GEAR_GEN && W.GEAR_GEN.CAGE_MATS) ||
            (NODE && require('./_gear_gen.js').CAGE_MATS) || null; } catch (e) {}
const SKIN = GGM || new Set(['body', 'pillarWindow',
  'pillarCabin', 'pillarPassenger', 'pillarTail', 'pillarFront', 'windshield',
  'skyWindows', 'pilotWindow', 'pasengerWindow', 'ceilingLoop', 'floorLoop',
  'waistband', 'boomTube', 'taper', 'pillarTaper', 'taperPanel']);
const GLASS = new Set(['windshield', 'skyWindows', 'pilotWindow',
                       'pasengerWindow']);
const deckSkin = m => SKIN.has(m) && !GLASS.has(m);

const scaleOf = P => (CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
const D = () => FIN.FIN_DEFAULT;

// the twin-boom deck the layers take from the wing layer, when it exists
function boomDeck(P) {
  const TB = W && W.CAGE_BOOMS;
  if (!TB) return null;
  const FSd = scaleOf(P);
  return { top: z => TB.yTop(z * FSd) / FSd, bot: z => TB.yBot(z * FSd) / FSd,
           z0: TB.zTip / FSd, z1: TB.zRoot / FSd, x: TB.x };
}

// ---- the fin, as _cage_fin.js builds it -----------------------------------
function buildFin(P, mesh, L, approx) {
  if (!+P.finOn) return null;
  const cutMode = Math.round(P.finCut || 0);
  // ROD BOOM (G26.4): no keel wrap, no dorsal on a bare tube
  const S = FIN.finSpec(P.boomStyle ? { ...P, finKeel: 0, finDorsal: 0 } : P);
  S.cutPrep = cutMode;
  const TB = boomDeck(P);
  if (!TB && +P.boomTwin) approx.push('fin: twin-boom deck (rooted on the fuselage centreline)');
  const deck = TB || FIN.finCentreline(mesh, deckSkin);
  S.deck = deck;
  const m0 = FIN.buildFin2(S);
  let s = m0;
  for (let i = 0; i < L; i++) s = CG2.cageSubdivide(s);
  let proj = null;
  if (deck && Math.round(P.finProject))
    proj = FIN.finProjectRoot(s, m0.deckTop, deck.z0);
  let sheet = s;
  if (cutMode)
    sheet = FIN.finCutMesh(s, { mode: cutMode, zCut: m0.cutZ, gap: P.finCutGap || 0 });
  // the solid too: the stab's T-tail seat (stMount 2) reads the built fin's
  // highest vertex off the THICKENED fin
  let disp = sheet;
  if (Math.round(P.finSolid === undefined ? 1 : P.finSolid)) {
    let zA = Infinity;
    for (const p of s.V) zA = Math.min(zA, p[2]);
    disp = FIN.finThicken(sheet, { thick: P.finThick || 0.06, thickTE: P.finThickTE,
      zHinge: m0.cutZ, zAftEnd: zA, rimN: P.tailRimN });
  }
  const FS = scaleOf(P);
  return { spec: S, cage: m0, mesh: s, sheet, disp, deck, proj, clamped: m0.clamped || [],
           measure: FIN.finMeasure(sheet, { FS, zCut: m0.cutZ, cut: cutMode, hingeLine: m0.hingeLine }) };
}

// ---- the stab, as _cage_stab.js builds it ---------------------------------
function buildStab(P, mesh, L, fin, approx) {
  if (!Math.round(P.stOn === undefined ? 1 : P.stOn)) return null;
  const finP = {};
  for (const [sk, fk] of Object.entries(FIN.ST2FIN)) finP[fk] = P[sk];
  const cutMode = Math.round(P.stCut || 0);
  const S = FIN.finSpec(finP);
  S.dorsal = 0;
  S.keelExt = 0;
  S.cutPrep = cutMode;
  const TB = boomDeck(P);
  if (!TB && +P.boomTwin) approx.push('stab: twin-boom deck (seated on the fuselage centreline)');
  const deck = TB || FIN.finCentreline(mesh, deckSkin);
  const rootLine = D().lo.H;
  S.deck = { top: () => rootLine, bot: () => D().yKeel - D().offKeel,
             z0: deck ? deck.z0 : D().zCap, z1: 1e9 };
  const m0 = FIN.buildFin2(S);
  const dzS = deck ? deck.z0 - D().zCap : 0;
  let yRef = deck ? deck.bot(D().zH1 + dzS) : 0;
  const mount = Math.round(P.stMount || 0);
  const cantDeg = Math.max(0, +P.stCant || 0);
  const cant = cantDeg * Math.PI / 180;
  let zSeat = 0;
  if (mount >= 1 && deck) yRef = deck.top(D().zH1 + dzS);
  if (mount === 3 && deck)
    yRef = 0.5 * (deck.top(D().zH1 + dzS) + deck.bot(D().zH1 + dzS));
  if (mount === 2 && fin && fin.disp && fin.disp.V.length) {
    let top = -Infinity;
    for (const p of fin.disp.V) top = Math.max(top, p[1]);
    let zs = 0, n = 0;
    for (const p of fin.disp.V) if (p[1] > top - 0.06) { zs += p[2]; n++; }
    const zTip = n ? zs / n : 0;
    yRef = top + 0.5 * (P.stThick || 0.05);
    let zr = 0, nr = 0;
    for (const p of FIN.buildFin2(S).V)
      if (Math.abs(p[1] - rootLine) < 0.02) { zr += p[2]; nr++; }
    zSeat = zTip - (nr ? zr / nr : 0);
  }
  let s = m0;
  for (let i = 0; i < L; i++) s = CG2.cageSubdivide(s);
  // G271: between twin booms the panel is stretched to the booms' centre
  // planes plus the overhang — as _cage_stab.js does, before the cut
  if (TB && TB.x > 0) {
    let H = -Infinity;
    for (const p of s.V) H = Math.max(H, p[1] - rootLine);
    const want = (TB.x + Math.max(0, +P.stOver || 0)) / scaleOf(P) - (P.stX || 0);
    if (H > 1e-6 && want > 0.05) {
      const k = want / H;
      s = Object.assign({}, s, { V: s.V.map(p => [p[0], rootLine + (p[1] - rootLine) * k, p[2]]) });
    }
  }
  FIN.finProjectRoot(s, m0.deckTop, S.deck.z0);
  let sheet = s;
  if (cutMode)
    sheet = FIN.finCutMesh(s, { mode: cutMode, zCut: m0.cutZ, gap: P.stCutGap || 0 });
  const FS = scaleOf(P);
  const lay = { rootX: P.stX || 0, stabY: yRef + (P.stY || 0),
                sRef: rootLine, zOff: zSeat + (P.stZ || 0), cant };
  return { spec: S, cage: m0, mesh: s, sheet, lay, cant: cantDeg, mount, clamped: m0.clamped || [],
           measure: Object.assign(
             FIN.finMeasure(sheet, { FS, zCut: m0.cutZ, cut: cutMode, hingeLine: m0.hingeLine }),
             { rootX: (P.stX || 0) * FS, cant: cantDeg, mount }) };
}

function tailBuild(P, opts) {
  const L = (opts && opts.level != null) ? +opts.level : 2;
  const mesh = (opts && opts.mesh) ||
    CG2.cageSheet(P, { level: L, step: (opts && opts.step) || 'crease' }).sheet;
  const approx = [];
  const fin = buildFin(P, mesh, L, approx);        // the fin first: the stab
  const stab = buildStab(P, mesh, L, fin, approx); // may seat on its tip
  return { fin, stab, FS: scaleOf(P), level: L, approx };
}

// the measure with its function dropped: what a fixture stores
function measurePlain(m) {
  if (!m) return null;
  const o = {};
  for (const k in m) if (typeof m[k] !== 'function') o[k] = m[k];
  return o;
}

// THE ROWS THE JOIN WRITES, off a headless build (TAIL CHANTIER 2 P5): the
// same arithmetic the join does on the page (ruling (l): Sh GROSS = both
// panels + the carry-through, Sv = fin proper + rudder + keel, the dorsal
// out; Svt a V's panels; the mean chords; the tapers as the 75 % slice over
// the 25 %; the control chords as the cut's area fraction), for the sweep,
// GATE ARCHETYPES and the birth seed — one home for the three readers that
// have no page. The extents the join takes off the bounding box (hSpan tip
// to tip, vHeight through the lattice's 0.82) are approximated here from
// the sheets: hSpan = 2·(span + rootX), vHeight = the fin's rise / 0.82.
function tailRows(t) {
  const out = {};
  const taperOf = m => {
    const a = m.chordAt(0.25 * m.span), b = m.chordAt(0.75 * m.span);
    return a > 1e-6 ? Math.max(0.05, Math.min(1, b / a)) : 1;
  };
  const isV = !!(t.stab && t.stab.cant >= 20);
  if (t.stab && t.stab.measure.areaTail > 0) {
    const m = t.stab.measure;
    out.hSpan = 2 * (m.span + m.rootX);
    if (isV) { out.Svt = 2 * m.areaTail; out.tailCant = t.stab.cant; }
    else out.Sh = 2 * m.areaTail + 2 * m.rootX * m.chordRoot;
    out.hTaper = taperOf(m);
    if (m.ctlFrac > 0) out.elevChord = m.ctlFrac;
  }
  if (t.fin && t.fin.measure.areaTail > 0 && !isV) {
    const m = t.fin.measure;
    out.Sv = m.areaTail;
    out.dorsalArea = m.areaDorsal;
    out.vHeight = m.span / 0.82;
    out.vTaper = taperOf(m);
    if (m.ctlFrac > 0) out.rudChord = m.ctlFrac;
  }
  if (out.Sh > 0 && out.hSpan > 0) out.hChord = out.Sh / out.hSpan;
  if (out.Svt > 0 && out.hSpan > 0) out.hChord = out.Svt / (out.hSpan / Math.cos(out.tailCant * Math.PI / 180));
  if (out.Sv > 0 && out.vHeight > 0) out.vChord = out.Sv / out.vHeight;
  return out;
}

// ...written into a spec the way cageJoinSpec writes them (assignment; the
// rule's `put` stands down) — the pre-join spec becomes the drawn tail's
function tailApply(spec, rows) {
  if (!rows) return spec;
  const tl = spec.tail || (spec.tail = {});
  for (const k of ['hSpan', 'hChord', 'vHeight', 'vChord', 'Sh', 'Sv', 'Svt', 'hTaper', 'vTaper'])
    if (rows[k] > 0) tl[k] = rows[k];
  if (rows.tailCant >= 20) { tl.type = 'v'; tl.vAngle = rows.tailCant; }
  if (typeof rows.dorsalArea === 'number') tl.dorsal = Object.assign({}, tl.dorsal || {}, { area: rows.dorsalArea });
  if (rows.elevChord > 0 || rows.rudChord > 0) {
    const ct = spec.controls || (spec.controls = {});
    if (rows.elevChord > 0) ct.elevator = Object.assign({}, ct.elevator || {}, { chord: rows.elevChord });
    if (rows.rudChord > 0) ct.rudder = Object.assign({}, ct.rudder || {}, { chord: rows.rudChord });
  }
  return spec;
}

const API = { tailBuild, tailRows, tailApply, measurePlain, deckSkin };
if (NODE) module.exports = API;
if (W) W.TAIL_HEADLESS = API;
})();
