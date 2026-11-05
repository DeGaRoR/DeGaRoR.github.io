// CAGE GEAR LAYER — the undercarriage, standing on the LIVE cage.
//
// The gear bench (_gear.html) built its legs against an AIRFRAME CONTRACT so
// that the same modules could later be bolted to the real fuselage instead of
// its stub. This is that later: `cageAirframe` answers the identical contract
// from the cage the editor has just built, so not one leg, pad, lug or bolt
// changed to get here — which was the whole point of the contract.
//
// Load order: _cage_gen -> _gear_kit -> _gear_gen -> _gear_page -> _cage_crew
// -> THIS -> _cage_ui. It CHAINS PAGE.post rather than replacing it (the crew
// layer assigns post directly), and it appends its own panel group to whatever
// tree the page declared.
//
// UNITS. The cage is generated at its own size and worn at `planeScale`; the
// hardware is metric and never scales — the crew layer's rule, and the reason
// a wheel can be a ruler. cageAirframe converts once, on the vertices, so
// everything here is metres.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const GG = window.GEAR_GEN, GP = window.GEAR_PAGE, CG2 = window.CAGE2;
if (!GG || !GP) { console.error('cage gear layer: gear modules not loaded'); return; }
const D2R = Math.PI / 180;

// ---- defaults ------------------------------------------------------------
// The bench's own defaults, minus the STUB airframe's dimensions: there is no
// stub here, and leaving `afLen` and friends in the set would put five dead
// sliders on the panel describing a body that does not exist.
const STUB_KEYS = ['afLen', 'afHalfW', 'afHeight', 'afKeelY', 'afKeelRise'];
const gearDef = GP.gearDefaults();
for (const k of STUB_KEYS) delete gearDef[k];

// SITED ON THE DEFAULT CAGE, in metres. The bench's station numbers were tuned
// against an OBJ export, which is in cage units — carrying them over unchanged
// would have put the wheels in the wrong place by exactly `planeScale`, so
// these were measured off the page's own body instead (jodel: 5.27 m long,
// nose z +2.96, tail z -2.31, keel y -0.69).
//
// NOTE, for when the mass model arrives: `cgZ`/`cgY` are still hand-set here,
// which means the CG-angle and nose-load checks below are judging a CG nobody
// computed. They become derived the moment the body has a mass integral.
Object.assign(gearDef, {
  gearOn: 1, gearSit: 1,
  // s1Z is the FUSELAGE FITTING, not the axle: a swinging link trails its
  // wheel well aft of its own station (at linkSwing -42 the axle sits 0.65 m
  // behind it), and siting the fitting where the wheel should go put the
  // contact BEHIND the CG — CG angle -1.3 deg, an aeroplane that sits on its
  // tail. Measured back to 16.2 deg, inside the 15-18 window, at 2.00.
  s1On: 1, s1Z: 2.00, s1X: 0.80, s1Leg: 1, s1R: 0.20, s1Drop: 0.45,
  s1Brake: 1, s1Steer: 0, s1Fair: 0,
  // G26.4 (user): a TAILWHEEL station follows the tail — when the leg
  // is a tailwheel, station z is measured FORWARD OF THE AFT EXTREMITY
  // (AF.z0, which tracks the boom/rod length by construction), so
  // shortening the boom carries the wheel with the tail. Non-tailwheel
  // legs (a trike's nose unit) keep the absolute station.
  s2On: 1, s2Z: 0.06, s2X: 0, s2Leg: 3, s2R: 0.10, s2Drop: 0.20,
  s2Brake: 0, s2Steer: 1, s2Fair: 0,
  // THE FLOATS (H1, G383): 1 = the undercarriage is a pair of floats. The
  // wheel stations go off with it; the join reads it as gear.type 'floats'
  // and the frame builds the floats (61_gen_frame). Nothing is drawn in the
  // cage for them yet — the drawn float is H2; in flight the physics hull
  // itself is drawn (app.js).
  gearFloats: 0,
  // RETRACT-1: fixed (0) by default; the cycle (s) and the actuation (0 electric, 1 hydraulic, 2 manual)
  gearRetract: 0, gearRetT: 6, gearRetAct: 1,
  // G1 (the fold): the preview's position, the mains' and the nose's fold (a preset, or 'custom': up to two turns + the
  // wheel's twist), the fraction it retracts (1 all the way; 0.6 a Catalina's or a DC-3's, the wheel left in its inset)
  gearPos: 1, gearFold: 0, gearFoldNose: 0, gearRetFrac: 1, gearWellCut: 0, gearDoors: 2, gearLegDoor: 1, gearNacFit: 1, gearNacPod: 0, gearShort: 0, gearShortNose: 0,
  gm1Ax: 0, gm1Ang: 90, gm2Ax: 1, gm2Ang: 0, gmTwist: 0,
  gn1Ax: 1, gn1Ang: 90, gn2Ax: 0, gn2Ang: 0, gnTwist: 0,
  shockKind: 1, linkSwing: -42,
  cgZ: 1.17, cgY: 0.05, propR: 0.875, propZ: 2.96,
});
// the page's own defaults still win — this only fills what it did not say
PAGE.defaults = Object.assign(gearDef, PAGE.defaults || {});

// ---- panel ---------------------------------------------------------------
// The leg detail rows are GENERATED from the bench's own LEG_ROWS, prefixed
// per station. That is the dividend of the parameter model being shared: the
// ranges and labels here cannot drift from the bench's, because they ARE the
// bench's.
// G28 (user): the kind subfolders are GONE — conditional rows made the
// nesting unnecessary. Every leg kind's detail rows splice FLAT into the
// station group, each gated on the fitted kind (and the station being
// on), so only the fitted leg's ~6-12 rows exist at a time. The two rows
// whose discriminator is another row in the same set follow it too
// (bungee wrap <- shock kind, brace top <- drag brace), per station.
const legRowWhen = (i, key, kind) => {
  const kw = P => +P['s' + i + 'On'] && +P['s' + i + 'Leg'] === +kind;
  if (key === 'bungeeSpan')
    return P => kw(P) && +P['s' + i + '_shockKind'] === 1;
  if (key === 'oleoBraceZ')
    return P => kw(P) && +P['s' + i + '_oleoBrace'];
  return kw;
};
const legRows = i => {
  const out = [];
  for (const kind of Object.keys(GP.LEG_ROWS))
    for (const r of GP.LEG_ROWS[kind])
      out.push(['s' + i + '_' + r[0], r[1], r[2], r[3], r[4], r[5],
                { when: legRowWhen(i, r[0], kind) }]);
  return out;
};
const sOn = i => ({ when: P => +P['s' + i + 'On'] });
// ...AND THE UNDERCARRIAGE IS IN METRES (2026-09-11, the audit the user asked
// for after the cabin-width slip: "Did you audit for measurement errors like
// the cabin width?"). It is, and the gear is the other half of the same trap.
// The panel has TWO length systems — `dim: 'len'` is CAGE units and prints
// value x CAGE_UNIT x planeScale, `dim: 'm'` is metres and prints itself —
// and this layer works in the AIRFRAME's metre frame: measured on the
// Jodel-alike, `s1R` 0.20 draws a wheel 0.400 m across and 0.30 draws 0.600,
// exactly, while `halfW` 0.52 draws a cabin 0.775 m wide (x 0.745). Not one
// gear row declared either, so every one of them printed NO metre readout at
// all — no cue, in the one place where the cue is the difference between a
// 15-inch wheel and an 11-inch one. `sOnM` is `sOn` that says so.
const sOnM = i => ({ when: P => +P['s' + i + 'On'], dim: 'm' });
// RETRACT-1 (the user, 3 Nov: "wheels with fairings - a strange choice for retractable wheels"): a retracting gear
// wears no spat, no trouser and no leg shroud - its doors will be its fairing (step 4) - so the fairing rows step aside
const noRet = P => !GEAR_RETRACTABLE(P);
const fairOn = i => ({ when: P => +P['s' + i + 'On'] && noRet(P)
                             && Math.round(P['s' + i + 'Fair'] || 0) > 0 });
// any fairing anywhere — the build-material row prices the whole set
const fairAny = P =>
  Math.round(P.s1Fair || 0) > 0 || Math.round(P.s2Fair || 0) > 0 ||
  Math.round(P.s1LegFair || 0) > 0 || Math.round(P.s2LegFair || 0) > 0;
const station = (i, name) => [name, [
  ['s' + i + 'On',    i === 2 ? 'third wheel' : 'main gear', 0, 1, 1],
  // s<i>Z is the FITTING (see the defaults note); the wheel's own station
  // is the fitting plus the family's law plus s<i>AxZ (2026-09-04)
  ['s' + i + 'Z',     'fitting fore / aft',
                                     -4, 4, 0.01, sOnM(i)],
  // G3503 (DC3-BUILD): the half track to 3.2 m, the wheel to 0.65 m and the leg drop to
  // 1.6 m (metres, unscaled: a DC-3's 2.82 m half track and 1.14 m tyres under the nacelles)
  ['s' + i + 'X',     'in / out (half track)',   0, 3.2, 0.01, sOnM(i)],
  // RETRACT GM1: a retracting gear's legs are oleos on trunnions, whatever this row holds (it is kept for the gear down)
  ['s' + i + 'Leg',   'leg',          0, 3, 1, GP.LEGS, Object.assign({}, sOn(i), {
    note: P => GEAR_RETRACTABLE(P) && Math.round(+P['s' + i + 'Leg']) !== 2 ? 'retractable: drawn and flown as an oleo on a trunnion' : '' })],
  ['s' + i + 'R',     i === 2 ? 'third wheel radius' : 'main wheel radius', 0.05, 0.65, 0.005, sOnM(i)],
  ['s' + i + 'Drop',  'up / down (leg drop)',     0.05, 1.60, 0.01, sOnM(i)],
  // the wheel's fore/aft FROM the fitting — the leg's rake, on every family;
  // hidden on a tailwheel, whose spring length already is that knob
  // NEW-SHAPES-1: the legs' root - no default (an old file keeps the rule it was built by)
  ['s' + i + 'Root',  'legs root on', 0, 1, 1, ['auto (a wing under the body)', 'the fuselage'],
   { when: P => +P['s' + i + 'On'] && Math.round(P['s' + i + 'Leg']) !== 3 }],
  ['s' + i + 'AxZ',   'wheel fore / aft (from fitting)', -1.2, 1.2, 0.01,
   { when: P => +P['s' + i + 'On'] && Math.round(P['s' + i + 'Leg']) !== 3,
     dim: 'm' }],
  ['s' + i + 'Brake', 'brake',        0, 1, 1, sOn(i)],
  // (G3575, the user 26 Oct: "remove fixed" - on the THIRD wheel: it flew as 'linked' anyway; the mains keep their 'fixed',
  // their own and only value. A saved third wheel at 0 still flies linked, as it always did)
  // G3800: the third wheel's own four kinds (GP.TW_STEERS; 0 an old save's, shown and flown as 1)
  ['s' + i + 'Steer', i === 2 ? 'tail contact' : 'steering', i === 2 ? 1 : 0, i === 2 ? 4 : 2, 1, i === 2 ? GP.TW_STEERS : GP.STEERS,
   i === 2 ? Object.assign(sOn(i), { optOrder: () => [1, 2, 3, 4] }) : sOn(i)],
  // G133: the castor exclusion is GONE — legTailwheel draws its own shell
  // now, so the switch that was two lies (G121.2) is two truths everywhere
  ['s' + i + 'Fair',  'fairing',      0, 2, 1, ['none', 'spat', 'trousers'],
   { when: P => +P['s' + i + 'On'] && noRet(P) }],
  // ...and the shape is an instrument (G133): skirt around the mode's own
  // base, tail run-out to a droplet, rake for a taildragger's flying
  // attitude, width for a fat tyre. Rows exist only where a shell does.
  ['s' + i + 'FairSkirt', 'skirt depth +', -0.12, 0.30, 0.01,
   Object.assign({ dim: 'm' }, fairOn(i))],
  ['s' + i + 'FairTail', 'tail droplet ×', 0.70, 1.60, 0.01, fairOn(i)],
  ['s' + i + 'FairRake', 'fairing rake °', -25, 25, 1, fairOn(i)],
  ['s' + i + 'FairW',   'fairing width ×', 0.80, 1.50, 0.01, fairOn(i)],
  // the leg's own streamline shroud, without buying the wheel a spat.
  // Hidden on trousers (they already shroud the leg) and on the castor
  // (its spring shroud is the trouser state's own).
  ['s' + i + 'LegFair', 'leg fairing', 0, 1, 1, ['bare', 'streamlined'],
   { when: P => +P['s' + i + 'On'] && noRet(P)
             && Math.round(P['s' + i + 'Fair'] || 0) < 2
             && !(i === 2 && Math.round(P.s2Leg) === 3) }],
  ...legRows(i),
]];

// G1 (RETRACT-STUDY §8.1): THE FOLD PRESETS - turns [axis, deg] about BODY axes through the leg's airframe end (axis 0
// fore-aft, 1 lateral, 2 vertical; + the probed sense: inboard on 0 and 2, aft on 1), applied in order, and the wheel's
// twist about its own leg (deg), applied first. The mains' are the port unit's; the starboard mirrors them. [TUNE]
// each on its reference aeroplane (the Arrow first, §8.6): the angles here are the motions' shapes, not anyone's numbers
const FOLD_PRESETS = {
  inward:    { turns: [[0, 90]], twist: 0 },                 // Mooney, Bonanza, Arrow: inboard into the wing root
  outward:   { turns: [[0, -90]], twist: 0 },                // Spitfire, Bf 109: outboard into the wing
  aftFlat:   { turns: [[1, 90]], twist: 90 },                // P-40, F4U: aft, the wheel turned flat on the way
  aftBelly:  { turns: [[1, 85], [2, 35]], twist: 90 },       // the Cessna RG's twist-and-tuck: aft and in, flat
  skymaster: { turns: [[0, 45], [1, 90]], twist: 0 },        // two axes, then along the body (to check on a reference)
  aft:       { turns: [[1, 90]], twist: 0 },                 // a nose leg aft (Arrow, Bonanza, 210)
  fwd:       { turns: [[1, -90]], twist: 0 },                // a nose leg forward (air and gravity help it down)
  // GR (the user, 5 Nov: "study the catalina ... a popular way of retracting gear for boat planes ... cut into a fuselage or
  // a Hull ... not necessarily requiring doors"; again: "an inset in the fuselage in which the wheel really slots in ... a
  // nice round"): THE PBY-5A's MAINS, in two turns - the leg, on an EXTERNAL fitting on the hull's side, swings AFT and up
  // about the lateral axis till it lies level (the wheel, inboard of the leg and kept just outside the side by the leg's
  // splay, rising along the side, upright), then TUCKS inward about the vertical axis: the wheel moves sideways into a
  // round recess in the side, its outer face near flush, the leg outside. Both angles are solved (the leg level; the
  // wheel's centre 50 mm into the side); the strut runs aft along the side to the leg; the jack is inside the hull
  catalina:  { turns: [[1, 90], [2, 15]], twist: 0 },
  // GR: INTO THE NACELLE - about the lateral axis, forward or aft whichever way the nacelle runs further from the pin (the
  // DC-3, the Aztec, the Twin Otter forward; the B-25 aft), trimmed to centre the wheel in the nacelle's depth
  nacelle:   { turns: [[1, 90]], twist: 0 },
};
const FOLD_KEYS = ['inward', 'outward', 'aftFlat', 'aftBelly', 'skymaster', 'custom', 'catalina', 'nacelle'];   // (appended: a saved index keeps its fold)
const FOLD_NOSE_KEYS = ['aft', 'fwd', 'custom'];
const FOLD_LABELS = { inward: 'inward (into the wing root)', outward: 'outward', aftFlat: 'aft, the wheel turned flat',
  aftBelly: 'aft and in, flat (twist-and-tuck)', skymaster: 'two axes (Skymaster)', catalina: 'up against the hull side (Catalina)', nacelle: 'into the engine nacelle', aft: 'aft', fwd: 'forward',
  custom: 'custom (the turns below)' };
const FOLD_AX_LABELS = ['fore-aft', 'lateral', 'vertical'];
const foldCustom = P => FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'custom';
const foldNoseCustom = P => FOLD_NOSE_KEYS[Math.round(+P.gearFoldNose || 0)] === 'custom';
// the unit's fold as written: { turns: [[axis, deg]], twist } - its preset's, or its custom rows'
function foldOf(P, nose) {
  if (nose) {
    const k = FOLD_NOSE_KEYS[Math.round(+P.gearFoldNose || 0)] || 'aft';
    if (k !== 'custom') return FOLD_PRESETS[k];
    return { turns: [[Math.round(+P.gn1Ax || 0), +P.gn1Ang || 0], [Math.round(+P.gn2Ax || 0), +P.gn2Ang || 0]], twist: +P.gnTwist || 0 };
  }
  const k = FOLD_KEYS[Math.round(+P.gearFold || 0)] || 'inward';
  if (k !== 'custom') return FOLD_PRESETS[k];
  return { turns: [[Math.round(+P.gm1Ax || 0), +P.gm1Ang || 0], [Math.round(+P.gm2Ax || 0), +P.gm2Ang || 0]], twist: +P.gmTwist || 0 };
}
// ---- the chain's arithmetic (3 x 3 row-major) ----
const fRot = (k, a) => { const c = Math.cos(a), s = Math.sin(a), C = 1 - c, x = k[0], y = k[1], z = k[2];
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s,
          z * x * C - y * s, z * y * C + x * s, c + z * z * C]; };
const fMul = (A, B) => { const o = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return o; };
const fApp = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
const fNrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// THE POSE at position g (1 down .. 0 up): s = (1 - g) x frac walks the chain - the twist across all of it, the turns one
// after the other - and the 3 x 3 the unit turns by about its hinge
function foldPose(C, g) {
  const s = Math.max(0, Math.min(1, 1 - g)) * C.frac, n = C.turns.length;
  let M = fRot(C.leg, C.twist * s);
  C.turns.forEach((T, k) => { M = fMul(fRot(T.axis, T.ang * Math.max(0, Math.min(1, s * n - k))), M); });
  return M;
}
// GR (the user: "allow these very long landing trains to half retract before you put them back into their pod ...
// make these options in the sliders"): THE SHORTENING rows (gearShort, the mains; gearShortNose) - a share of the leg's
// length the piston slides into its cylinder as the gear comes up (the core's gearSlide: done half way up). The cylinder
// is shortened to leave the piston that travel (cylF); the slide stops 50 mm short of the gland
const shortRow = (P, single) => Math.max(0, Math.min(0.45, +(single ? P.gearShortNose : P.gearShort) || 0));
const cylFOf = (oleoCyl, P, single) => { const c = Math.max(0.30, Math.min(0.80, +oleoCyl || 0.55)), f = shortRow(P, single);
  return f > 0 ? Math.max(0.30, Math.min(c, 1 - f - 0.06)) : c; };
function shortenOf(P, single, L, cylF) {
  const f = shortRow(P, single); if (!(f > 0) || !(L > 0)) return null;
  const t0 = cylF * L, d = Math.min(f * L, L - t0 - 0.05);
  return d > 0.01 ? { t0, d, k: 0.5 } : null;
}
// the cage's copy of the core's slide (src/core/62c_gear_mech.js gearSlide / gearSlidePt - the same arithmetic)
function slideD(C, g) {
  const S = C && C.shorten; if (!S || !(S.d > 0)) return 0;
  const s = Math.max(0, Math.min(1, 1 - g)) * (C.frac == null ? 1 : C.frac), t = Math.max(0, Math.min(1, s / (S.k || 0.5)));
  return S.d * t * t * (3 - 2 * t);
}
function slidePt(C, p, d) {
  const S = C && C.shorten; if (!d || !S) return p;
  const h = C.hinge, t = (p[0] - h[0]) * S.dir[0] + (p[1] - h[1]) * S.dir[1] + (p[2] - h[2]) * S.dir[2];
  return t > S.t0 ? [p[0] - S.dir[0] * d, p[1] - S.dir[1] * d, p[2] - S.dir[2] * d] : p;
}
// THE CHAIN of one unit, its senses probed: u the leg unit (root, axle, the moving end, the wheel's axis), key L / R / T
function foldChain(u, key, P, SP) {
  const h = (u.root || u.moving || u.axle).slice(), ax = u.axle, top = u.moving || u.axle;
  const F = foldOf(P, key === 'T'), side = key === 'R' ? -1 : 1;
  const leg = fNrm([top[0] - h[0], top[1] - h[1], top[2] - h[2]]);
  const C = { hinge: h, leg, twist: side * (F.twist || 0) * D2R, turns: [], frac: Math.max(0.3, Math.min(1, +P.gearRetFrac || 1)),
              R: u.R || 0.2, wAx: u.waxis ? fNrm(u.waxis) : [1, 0, 0], axle: ax.slice(), legR: u.legR || 0.05 };
  // (GR: the shortening, along the strut as drawn - its piston's axis)
  if (u.strut && u.strutL) { const S = shortenOf(P, key === 'T', u.strutL, u.cylF || 0.55); if (S) C.shorten = Object.assign(S, { dir: u.strut.slice() }); }
  if (C.shorten) { C.low = !!u.low; C.scissor = u.scissor || null; }
  const axS = slidePt(C, ax, slideD(C, 0));            // the axle where the shortening leaves it, gear up
  // the turns' senses, each on the axle where the turns before it left it
  let M = fRot(leg, C.twist);
  for (const [ai, deg] of F.turns) {
    if (!deg) continue;
    const base = ai === 1 ? [1, 0, 0] : ai === 2 ? [0, 1, 0] : [0, 0, 1];
    const v = fApp(M, [ax[0] - h[0], ax[1] - h[1], ax[2] - h[2]]), w = fApp(fRot(base, 0.1), v);
    const moved = ai === 1 ? w[2] - v[2]                                   // lateral: aft is -z
                : Math.abs(h[0] + w[0]) - Math.abs(h[0] + v[0]);           // fore-aft, vertical: inboard is |x| down
    const k = moved < -1e-9 ? base : moved > 1e-9 ? base.map(c => -c) : base;
    C.turns.push({ axis: k, ang: deg * D2R });
    M = fMul(fRot(k, deg * D2R), M);
  }
  // GR R3 (the user: "maybe you want to get the wheels higher so that really penetrate the wing"): A PRESET'S LAST TURN IS
  // TRIMMED (-15..+25 degrees, further on) so the stowed wheel's centre sits at the structure's mid-depth over its plan
  // place (the wing's between its skins outside the body, else half way from the keel to the floor) - a wheel riding its
  // stub outboard of the leg folds inward ~ its offset UNDER the pin otherwise. A custom fold, a partial one: as set
  const preset = (key === 'T' ? FOLD_NOSE_KEYS[Math.round(+P.gearFoldNose || 0)] : FOLD_KEYS[Math.round(+P.gearFold || 0)]) !== 'custom';
  C.trim = 0;
  // (into the nacelle: forward when the nacelle runs further ahead of the pin than behind it, else aft)
  if (key !== 'T' && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'nacelle' && C.turns.length === 1) {
    const N = nacAtW(h[0], h[2]) || NACS.find(n => n.kind !== 'cowl' && Math.abs(h[0] - n.xc) < 0.6);
    if (N) { const fwd = N.z1 - h[2], aft = h[2] - N.z0; C.turns[0].ang = (fwd > aft ? -1 : 1) * Math.abs(C.turns[0].ang); C.nacelle = fwd > aft ? 'forward' : 'aft'; }
  }
  // (the Catalina: its two turns SOLVED - the first till the leg lies level, the second till the wheel's centre is 50 mm
  // into the hull's side)
  const catF = key !== 'T' && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'catalina';
  if (catF && C.turns.length === 2 && C.frac >= 0.999) {
    const [T1, T2] = C.turns, v0 = [axS[0] - h[0], axS[1] - h[1], axS[2] - h[2]];
    let b1 = null;
    for (let d = 45; d <= 135; d += 0.25) { const q = fApp(fRot(T1.axis, d * D2R), v0); const e = Math.abs(q[1]); if (!b1 || e < b1.e) b1 = { e, d }; }
    T1.ang = b1.d * D2R;
    let b2 = null;
    if (SP) for (let d = 0; d <= 40; d += 0.25) {
      T2.ang = d * D2R;
      const Mz = foldPose(C, 0), q = fApp(Mz, v0), c = [h[0] + q[0], h[1] + q[1], h[2] + q[2]];
      const e = Math.abs(SP.bodyIn(c) - 0.05); if (!b2 || e < b2.e) b2 = { e, d }; }
    T2.ang = (b2 ? b2.d : 15) * D2R;
    C.solved = [b1.d, b2 ? b2.d : null];
  }
  if (SP && preset && !catF && C.frac >= 0.999 && C.turns.length) {
    const T = C.turns[C.turns.length - 1], a0 = T.ang, sg = a0 < 0 ? -1 : 1;
    let best = null;
    const dLo = C.nacelle ? -10 : -15, dHi = C.nacelle ? 10 : 25;          // (a nacelle's fold: a trim, never a different fold)
    for (let d = dLo; d <= dHi; d++) {
      T.ang = a0 + sg * d * D2R;
      const Mz = foldPose(C, 0), q = fApp(Mz, [axS[0] - h[0], axS[1] - h[1], axS[2] - h[2]]), c = [h[0] + q[0], h[1] + q[1], h[2] + q[2]];
      // (into a nacelle: ITS depth, at the wheel's station held in it, and a heavy price for a wheel past its ends - the
      // trim never chases another structure's depth once the wheel has left the nacelle)
      const Nn = C.nacelle ? (nacAtW(h[0], h[2]) || NACS.find(n => n.kind !== 'cowl' && Math.abs(h[0] - n.xc) < 0.6)) : null;
      let mid, over = 0;
      if (Nn) { const zc = Math.max(Nn.z0 + 0.02, Math.min(Nn.z1 - 0.02, c[2]));
        mid = (Nn.AF.keelAt(zc) + Nn.AF.surf(zc, Math.PI)[1]) / 2;
        over = Math.max(0, c[2] + C.R - (Nn.z1 - 0.02)) + Math.max(0, (Nn.z0 + 0.02) - (c[2] - C.R)); }
      else mid = SP.midAt(c[0], c[2]);
      if (mid == null) continue;
      const e = Math.abs(c[1] - mid) + 10 * over + 0.0004 * Math.abs(d);
      if (!best || e < best.e) best = { e, d };
    }
    T.ang = a0 + sg * (best ? best.d : 0) * D2R;
    C.trim = best ? best.d : 0;
  }
  // the LIFT: how far the wheel's lowest point rises, the gear up (at the fraction), over the ground (the pitch's frame)
  const bottom = (c, a) => c[1] - C.R * Math.sqrt(Math.max(0, 1 - a[1] * a[1]));
  const Mup = foldPose(C, 0), axUp = fApp(Mup, [axS[0] - h[0], axS[1] - h[1], axS[2] - h[2]]);
  C.lift = Math.max(0, bottom([h[0] + axUp[0], h[1] + axUp[1], h[2] + axUp[2]], fApp(Mup, C.wAx)) - bottom(ax, C.wAx));
  return C;
}

// ---- GR (the user, 5 Nov: "nacelle mounted retractable wheels ... engines are wing mounted ... mount this, let's say,
// more or less under the engine, and then it folds back into the nacelle ... should work with low wing, high wing"):
// THE NACELLES - each wing engine's cowl unit (the cowl layer's off-centre units: |x| > 0.3 m), its skin meshes in the
// layer's frame, a section table of its own (meshAirframe, the vertices taken about the nacelle's own centreline).
// NACS is this build's (set before the stations are drawn; read by the probe, the mounts, the fold, the cuts, the doors)
let NACS = [], AFT_BAYS = [];
const NAC_AF = new Map();
function nacellesOf(scene) {
  const out = [];
  AFT_BAYS = [];
  if (!scene || !GG || !GG.meshAirframe) return out;
  scene.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(scene.matrixWorld).invert(), M = new THREE.Matrix4(), v = new THREE.Vector3();
  const units = [];
  for (const top of scene.children) if (top.name === 'cageLayer:cowl')
    for (const u of top.children) if (u.isGroup || u.isObject3D) units.push(u);
  for (const u of units) {
    const meshes = [];
    u.traverse(o => { if (o.isMesh && o.visible !== false && o.geometry && o.geometry.attributes.position) meshes.push(o); });
    const skins = meshes.filter(o => !o.userData.innerTwin);
    if (!skins.length) continue;
    let x0 = Infinity, x1 = -Infinity;
    const V = [], F = [];
    for (const o of skins) {
      M.multiplyMatrices(inv, o.matrixWorld);
      const pa = o.geometry.attributes.position, ix = o.geometry.index, base = V.length;
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(M); V.push([v.x, v.y, v.z]); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); }
      const n = ix ? ix.count : pa.count;
      for (let t = 0; t + 2 < n; t += 3) F.push([0, 1, 2].map(q => base + (ix ? ix.getX(t + q) : t + q)));
    }
    const xc0 = (x0 + x1) / 2;
    if (!F.length) continue;
    // (GR, the user: "cut into a cowl"): a NOSE COWL (on the centre line) is structure too - kind 'cowl': the nose wheel
    // folding forward stows in it and is cut into it, as into a nacelle; the mains' nacelle logic skips it
    const kind = Math.abs(xc0) < 0.3 ? 'cowl' : 'nacelle', xc = kind === 'cowl' ? 0 : xc0;
    // (P2, the Skymaster: an AFT cowl on the centre line - a pusher's, a push-pull's rear engine - is the engine bay, never
    // a gear's stowage: kept as AFT_BAYS for the fit's test, not cut)
    if (kind === 'cowl' && Math.abs(Math.abs(u.rotation.y) - Math.PI) < 0.1) { AFT_BAYS.push({ x0, x1, z0: Math.min(...V.map(p => p[2])), z1: Math.max(...V.map(p => p[2])), y0: Math.min(...V.map(p => p[1])), y1: Math.max(...V.map(p => p[1])) }); continue; }
    const Vc = V.map(p => [p[0] - xc, p[1], p[2]]);
    // (the section table cached on the skin's own vertices: a rebuild that did not move the nacelle reuses it)
    let sig = Vc.length * 31 + F.length; for (let i = 0; i < Vc.length; i += 7) sig = (sig * 1.000003 + Vc[i][0] * 7.1 + Vc[i][1] * 13.3 + Vc[i][2] * 17.7) % 1e9;
    const ck = sig.toFixed(6);
    let NA = NAC_AF.get(ck);
    if (!NA) { NA = GG.meshAirframe(Vc, F); if (NA) { if (NAC_AF.size > 16) NAC_AF.clear(); NAC_AF.set(ck, NA); } }
    if (!NA) continue;
    out.push({ xc, kind, AF: NA, z0: NA.z0, z1: NA.z1, meshes, V: Vc, F, bb: nacBox(Vc) });
  }
  return out;
}
// depth inside a nacelle's section (> 0 inside), and the nacelle (or null) over a plan place
function nacIn(p) {
  let best = -1;
  for (const N of NACS) {
    if (p[2] < N.z0 || p[2] > N.z1) continue;
    if (N.bb && (Math.abs(p[0] - N.xc) > N.bb.hw || p[1] < N.bb.y0 || p[1] > N.bb.y1)) continue;   // (outside its box)
    const q = [p[0] - N.xc, p[1], p[2]], A = N.AF, cy = A.cyAt(q[2]), ang = Math.atan2(q[0], cy - q[1]);
    const sf = A.surf(q[2], ang), d = Math.hypot(sf[0], sf[1] - cy) - Math.hypot(q[0], q[1] - cy);
    if (d > best) best = d;
  }
  return best;
}
// (the wing's nacelles only - the mains' mount, fold and tests; a nose cowl is the nose wheel's)
function nacAtW(x, z) { const N = nacAt(x, z, true); return N; }
function nacAt(x, z, wingOnly) {
  for (const N of NACS) if ((!wingOnly || N.kind !== 'cowl') && z >= N.z0 && z <= N.z1 && Math.abs(x - N.xc) <= N.AF.halfWAt(z)) return N;
  return null;
}
// GR: THE GEAR NACELLE (the F27's, the Dash 8's, the An-24's: a high wing's engine nacelle carried on down and aft as
// the mains' bay). A nacelle that cannot take the folded leg - too short both ways from the pin (a high wing's leg is a
// long one) or too shallow for the wheel - is GROWN by the gear layer: a fairing under the wing, the engine nacelle's
// width, a wheel's depth and the clearance below the wing's underside, from a nose tucked under the engine to a tail
// past the stowed wheel. It joins its nacelle (one section table: the union's), so the mount, the pin, the fold's
// trim, the well and its doors all read it as the nacelle; it folds AFT (the engine fills the front). The pod is
// structure: its mesh is unnamed (the join's static merge), tagged as the nacelle's skin for the well's knife.
const POD = { clr: 0.06, top: 0.03, ex: 2.8, NA: 36 };
// (the leg's stowed length: its length less the shortening's slide, when the rows ask for one)
const stowLen = (P, st, L) => { const S = P ? shortenOf(P, false, L, cylFOf(st.P && st.P.oleoCyl, P, false)) : null; return L - (S ? S.d : 0); };
function nacNeedsPod(N, st, ya, P) {
  const A = N.AF, zc = Math.max(N.z0 + 0.06, Math.min(N.z1 - 0.06, st.z));
  const keel = A.keelAt(zc), top = A.surf(zc, Math.PI)[1], R = st.R;
  const yh = keel + Math.max(0.04, 0.45 * (top - keel)), L = stowLen(P, st, Math.max(0, yh - ya));
  const fwd = st.z + L + R + 0.03 <= N.z1, aft = st.z - L - R - 0.03 >= N.z0;
  return !(fwd || aft) || (top - keel) < 2 * R + 0.04;
}
function nacPodBuild(N, st, sgn, ya, under, P) {
  const R = st.R, zs = st.z, x = sgn * st.x;
  const uAt = z => { const u = under ? under(N.xc, z) : null; return u ? u.y : null; };
  let yTs = uAt(zs);
  if (yTs == null) yTs = N.AF.keelAt(Math.max(N.z0 + 0.06, Math.min(N.z1 - 0.06, zs)));
  yTs += POD.top;
  const yh = yTs - R - POD.clr - 0.01, yB = yh - R - POD.clr, D = yTs - yB;
  const L = Math.max(0.05, stowLen(P, st, yh - ya));
  const zB0 = zs + R + 0.12, zN = Math.max(zB0 + 0.3, Math.min(N.z1 - 0.12, zs + R + 0.5 + 1.4 * D));
  const zE = zs - L - R - 0.08, zT = zE - Math.max(0.55, 1.4 * D);
  // the half width: the tyre's and a margin (about the nacelle's centre, the wheel's offset with it), widened toward the
  // engine nacelle's own at the station (70 %) so the bay reads as the nacelle carried on - never wider than that nacelle
  const hwN = N.AF.halfWAt(Math.max(N.z0 + 0.06, Math.min(N.z1 - 0.06, zs)));
  // (the wheel rides its stub outboard of the leg - 60 mm allowed - and the section narrows toward its top and bottom)
  const hwT = Math.max(0.55 * R + 0.07, Math.abs(x - N.xc) + 0.06 + 0.38 * R + 0.06);
  const hw = Math.max(hwT, Math.min(0.7 * hwN, 1.6 * hwT));
  // the top along the wing's underside (behind the trailing edge: level with it; ahead of the leading edge: the last)
  let yLast = yTs;
  const NZ = 40, zs_ = [];
  for (let i = 0; i <= NZ; i++) zs_.push(zN + (zT - zN) * i / NZ);
  for (const zk of [zB0, zE]) zs_.push(zk);
  zs_.sort((a, b) => b - a);
  const tops = zs_.map(z => { const u = uAt(z); return u == null ? null : u + POD.top; });
  // (fill the misses from the nearest answered station, aft of the trailing edge from the last one)
  for (let i = 0; i < tops.length; i++) if (tops[i] == null) {
    let j = i; while (j >= 0 && tops[j] == null) j--;
    tops[i] = j >= 0 ? tops[j] : yTs; }
  const prof = z => z > zB0 ? Math.pow(Math.max(0, 1 - Math.pow((z - zB0) / (zN - zB0), 2)), 0.75)
                   : z >= zE ? 1 : Math.max(0, 1 - Math.pow((zE - z) / (zE - zT), 1.7));
  const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), 2 / e);
  const V = [], F = [], NA = POD.NA;
  zs_.forEach((z, i) => {
    const f = Math.max(0.015, prof(z)), yt = Math.min(tops[i], yTs + 0.25);
    const hh = Math.max(0.004, (yt - (yTs - D)) * f) / 2, yc = yt - hh, w = hw * Math.max(0.03, Math.sqrt(f));
    for (let k = 0; k < NA; k++) { const a = 2 * Math.PI * k / NA;
      V.push([N.xc + w * sp(Math.sin(a), POD.ex), yc - hh * sp(Math.cos(a), POD.ex), z]); }
  });
  for (let i = 0; i + 1 < zs_.length; i++) for (let k = 0; k < NA; k++) {
    const a = i * NA + k, b = i * NA + (k + 1) % NA, c = (i + 1) * NA + k, d = (i + 1) * NA + (k + 1) % NA;
    F.push([a, c, b], [b, c, d]); }
  // the end caps (fans to the end sections' centres)
  for (const [i, flip] of [[0, false], [zs_.length - 1, true]]) {
    let cx = 0, cy = 0; for (let k = 0; k < NA; k++) { cx += V[i * NA + k][0]; cy += V[i * NA + k][1]; }
    const ci = V.length; V.push([cx / NA, cy / NA, zs_[i]]);
    for (let k = 0; k < NA; k++) { const a = i * NA + k, b = i * NA + (k + 1) % NA; F.push(flip ? [ci, b, a] : [ci, a, b]); } }
  return { V, F, yh, yB, yTop: yTs, D, L, zN, zB0, zE, zT, hw };
}
// the closest distance between two segments (P2: a strut and a leg)
function segDist(p1, q1, p2, q2) {
  const d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]], d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]], r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  if (a <= 1e-12 && e <= 1e-12) return Math.hypot(...r);
  if (a <= 1e-12) t = Math.max(0, Math.min(1, f / e));
  else { const c = dot(d1, r);
    if (e <= 1e-12) s = Math.max(0, Math.min(1, -c / a));
    else { const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); } else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); } } }
  const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s], c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  return Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]);
}
// a nacelle's box about its centreline (a quick reject for nacIn): half width, bottom and top
function nacBox(V) { let hw = 0, y0 = Infinity, y1 = -Infinity;
  for (const p of V) { hw = Math.max(hw, Math.abs(p[0])); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  return { hw: hw + 0.01, y0: y0 - 0.01, y1: y1 + 0.01 }; }
// the pod joins its nacelle: one table over the union (meshAirframe reads the farthest skin along each ray)
function nacJoinPod(N, pod) {
  const base = N.V.length, V = N.V.concat(pod.V.map(p => [p[0] - N.xc, p[1], p[2]]));
  const F = N.F.concat(pod.F.map(f => f.map(i => i + base)));
  const A = GG.meshAirframe(V, F);
  if (!A) return false;
  Object.assign(N, { AF: A, z0: A.z0, z1: A.z1, V, F, pod, bb: nacBox(V) });
  return true;
}

// THE STRUCTURE'S PROBE (GR): depth inside the body's section (AF's table) and between the wing's skins, metres, > 0
// inside - the fit's own tests, shared with the fold's trim (R3) and the mechanism's placing (R2)
function structProbe(AF, W, P) {
  const bodyIn = p => {
    if (!AF || p[2] < AF.z0 || p[2] > AF.z1) return -1;
    const cy = AF.cyAt(p[2]), ang = Math.atan2(p[0], cy - p[1]);
    const s = AF.surf(p[2], ang), r = Math.hypot(s[0], s[1] - cy), d = Math.hypot(p[0], p[1] - cy);
    return r - d;
  };
  // (the skins' heights memoised on a 1 cm plan grid - the wells' sweep asks thousands of places; GR)
  const wMemo = new Map(), semi = W && W.semi ? W.semi + 0.05 : Infinity;
  const wingIn = p => {
    if (!W || !W.underAt || !W.overAt || Math.abs(p[0]) > semi) return -1;
    const kx = Math.round(p[0] * 100), kz = Math.round(p[2] * 100), key = kx * 100003 + kz;
    let e = wMemo.get(key);
    if (e === undefined) {
      const u = W.underAt(kx / 100, kz / 100), o = u ? W.overAt(kx / 100, kz / 100) : null;
      e = u && o ? [u.y, o.y] : null; wMemo.set(key, e);
    }
    if (!e) return -1;
    return Math.min(p[1] - e[0], e[1] - p[1]);
  };
  const FSm = (CG2 && CG2.CAGE_UNIT || 1) * ((P && P.planeScale) || 1);
  const floorY = (P && P.floorY != null ? +P.floorY : -0.5) * FSm;
  // the structure's mid-depth over a plan place: a nacelle's (between its keel and its top), else the wing's (outside the
  // body), else half way from the keel to the floor
  const midAt = (x, z) => {
    const N = nacAt(x, z);
    // (a nose cowl: its lower quarter - the engine fills the rest; a nacelle: its middle)
    if (N) { const k = N.AF.keelAt(z), t = N.AF.surf(z, Math.PI)[1]; return N.kind === 'cowl' ? k + 0.25 * (t - k) : (k + t) / 2; }
    const inBody = AF && z >= AF.z0 && z <= AF.z1 && Math.abs(x) <= AF.halfWAt(z);
    if (!inBody && W && W.underAt && W.overAt) { const u = W.underAt(x, z), o = W.overAt(x, z); if (u && o) return (u.y + o.y) / 2; }
    if (AF && z >= AF.z0 && z <= AF.z1) return (AF.keelAt(z) + floorY) / 2;
    return null;
  };
  return { bodyIn, wingIn, nacIn, inside: p => Math.max(bodyIn(p), wingIn(p), nacIn(p)), midAt, floorY };
}
// ---- G2 (RETRACT-STUDY §8.2): DOES IT FIT? ------------------------------------------------------------------------------
// The unit's points - the tyre (two faces x two rings x 12, the hub) and the leg (from a quarter of the way down: its
// root end is in the structure by construction) - posed at six positions along the fold; four tests, each with the rows
// a builder turns to put it right (they go RED in the editor - CAGE_ROW_BAD - and back the moment it fits):
//   SKIN   fully up (a partial gear's exposure is declared), every point inside the body or the wing (15 mm in)
//   SPAR   the stowed wheel inside the wing sits in ONE bay: it crosses neither spar (GEN_RULES.sparFront / sparRear)
//   FLOOR  nothing inside the body rises over the cabin floor (floorY, 20 mm under it), at any position
//   UNITS  the units clear each other (30 mm) at every position - the two mains under the belly, a main and the nose
// (the TANKS are the fifth test, read when the rows are refreshed: the energy layer runs after this one - fitTanks)
const FIT_G = [1, 0.8, 0.6, 0.4, 0.2, 0];
const MOUNT_MIN = 0.08;        // GM1: the structure depth a retracting leg's trunnion needs (the 'mount' test)
const FIT = { wall: 0.015, floor: 0.02, gap: 0.03, clear: 0.03 };   // clear: a well's room round its stowed unit (G3)
function unitPts(C) {
  const a = C.wAx, R = C.R, hw = 0.38 * R, c = C.axle;
  const ref = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = fNrm([a[1] * ref[2] - a[2] * ref[1], a[2] * ref[0] - a[0] * ref[2], a[0] * ref[1] - a[1] * ref[0]]);
  const v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const W = [c.slice()];
  for (const s of [-hw, hw]) for (const r of [R, 0.6 * R]) for (let k = 0; k < 12; k++) {
    const ca = Math.cos(k * Math.PI / 6) * r, sa = Math.sin(k * Math.PI / 6) * r;
    W.push([c[0] + a[0] * s + u[0] * ca + v[0] * sa, c[1] + a[1] * s + u[1] * ca + v[1] * sa, c[2] + a[2] * s + u[2] * ca + v[2] * sa]);
  }
  const h = C.hinge, L = [];
  for (const f of [0.25, 0.4, 0.55, 0.7, 0.85]) L.push([h[0] + (c[0] - h[0]) * f, h[1] + (c[1] - h[1]) * f, h[2] + (c[2] - h[2]) * f]);
  return { W, L };
}
const poseAll = (C, pts, g) => { const M = foldPose(C, g), h = C.hinge, d = slideD(C, g);
  return pts.map(p0 => { const p = d ? slidePt(C, p0, d) : p0, q = fApp(M, [p[0] - h[0], p[1] - h[1], p[2] - h[2]]); return [h[0] + q[0], h[1] + q[1], h[2] + q[2]]; }); };
// the rows each test hands the builder, per unit (the mains' s1 rows and fold, the nose's s2 rows and fold)
const FIT_ROWS = {
  L: { fold: ['gearFold', 'gm1Ax', 'gm1Ang', 'gm2Ax', 'gm2Ang', 'gmTwist'], st: 's1' },
  R: { fold: ['gearFold', 'gm1Ax', 'gm1Ang', 'gm2Ax', 'gm2Ang', 'gmTwist'], st: 's1' },
  T: { fold: ['gearFoldNose', 'gn1Ax', 'gn1Ang', 'gn2Ax', 'gn2Ang', 'gnTwist'], st: 's2' },
};
const UNIT_WORD = { L: 'the left main', R: 'the right main', T: 'the nose wheel' };
function foldFit(P, swing, AF, W, MX) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const out = { ok: true, why: [], rows: {}, tests: {} };
  const fail = (test, unit, why, rows) => {
    out.ok = false; out.why.push(why);
    (out.tests[test] = out.tests[test] || []).push({ unit, why });
    for (const k of rows) if (!out.rows[k]) out.rows[k] = why;
  };
  const sparF = (typeof GEN_RULES !== 'undefined' && GEN_RULES.sparFront) || 0.15;
  const sparR = (typeof GEN_RULES !== 'undefined' && GEN_RULES.sparRear) || 0.65;
  const FSm = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const floorY = (P.floorY != null ? +P.floorY : -0.5) * FSm;
  // the body and the wing: depth inside (structProbe)
  const { bodyIn, wingIn } = structProbe(AF, W, P);
  const leTe = new Map();
  const chordFrac = p => {
    if (!W || !W.leAt || !W.teAt) return null;
    const kx = Math.round(p[0] * 50);
    if (!leTe.has(kx)) { const le = W.leAt(kx / 50), te = W.teAt(kx / 50); leTe.set(kx, le && te ? [le.z, te.z] : null); }
    const lt = leTe.get(kx);
    return lt && lt[0] > lt[1] ? (lt[0] - p[2]) / (lt[0] - lt[1]) : null;
  };
  const units = {};
  for (const key of Object.keys(swing)) units[key] = { C: swing[key], pts: unitPts(swing[key]) };
  const posed = {};
  for (const key in units) posed[key] = FIT_G.map(g => { const U = units[key];
    return { W: poseAll(U.C, U.pts.W, g), L: poseAll(U.C, U.pts.L, g) }; });
  for (const key in units) {
    const C = units[key].C, R = FIT_ROWS[key], st = R.st, word = UNIT_WORD[key];
    const up = posed[key][FIT_G.length - 1], all = up.W.concat(up.L);
    // SKIN (fully up, a whole retraction only)
    if (C.frac >= 0.999) {
      // each point outside, classified: through the wing's skin (in its planform: by how much), out of the body (in
      // its width: by how much), or OFF the wing's chord (aft of the trailing edge / ahead of the leading edge)
      let wingMM = 0, bodyMM = 0, aftTE = 0, foreLE = 0, beyond = 0;
      for (const p of all) {
        const db = Math.max(bodyIn(p), nacIn(p)), dw = wingIn(p);     // (GR: a nacelle is inside too)
        if (Math.max(db, dw) >= FIT.wall) continue;
        // within the body's width the envelope is the body and the wing's centre section together: out of the body
        if (AF && p[2] >= AF.z0 && p[2] <= AF.z1 && Math.abs(p[0]) <= AF.halfWAt(p[2]) + 0.05) { bodyMM = Math.max(bodyMM, FIT.wall - Math.max(db, dw)); continue; }
        const u = W && W.underAt ? W.underAt(p[0], p[2]) : null;
        if (u) { wingMM = Math.max(wingMM, FIT.wall - dw); continue; }
        const f = chordFrac(p);
        if (f == null) beyond++; else if (f > 1) aftTE++; else if (f < 0) foreLE++; else beyond++;
      }
      const w = [];
      if (wingMM > 0) w.push(Math.round(wingMM * 1000) + ' mm through the wing\'s skin');
      if (bodyMM > 0) w.push(Math.round(bodyMM * 1000) + ' mm out of the body');
      if (aftTE) w.push('aft of the wing\'s trailing edge');
      if (foreLE) w.push('ahead of the leading edge');
      if (beyond && !w.length) w.push('outside the wing and the body');
      if (w.length) fail('skin', key, word + ', up, is not inside: ' + w.join(', '),
                         R.fold.concat([st + 'R', st + 'Drop', 'gearRetFrac', 'wgThick'], aftTE || foreLE ? [st + 'Z', st + 'AxZ'] : []));
    }
    // SPAR (the stowed wheel's points inside the wing, one bay)
    { let lo = Infinity, hi = -Infinity;
      for (const p of up.W) if (wingIn(p) > 0 && !(bodyIn(p) > 0) && !(nacIn(p) > 0)) { const f = chordFrac(p); if (f != null) { lo = Math.min(lo, f); hi = Math.max(hi, f); } }
      if (lo < hi && ((lo < sparF && hi > sparF) || (lo < sparR && hi > sparR)))
        fail('spar', key, word + ' crosses the ' + (lo < sparF && hi > sparF ? 'front' : 'rear') + ' spar, up',
             R.fold.concat([st + 'Z', st + 'AxZ', st + 'R', 'wgChord'])); }
    // FLOOR (inside the body, at any position)
    { let worst = 0;
      posed[key].forEach((ps, gi) => { for (const p of ps.W.concat(ps.L, MX ? wellMechPts(MX, key, FIT_G[gi]) : [])) if (bodyIn(p) > 0 && p[1] > floorY - FIT.floor) worst = Math.max(worst, p[1] - floorY + FIT.floor); });
      if (worst > 0) fail('floor', key, word + ' rises ' + Math.round(worst * 1000) + ' mm into the cabin floor',
                          R.fold.concat([st + 'Drop', st + 'R', 'floorY', 'gearRetFrac'])); }
  }
  // UNITS (pairwise, at every position)
  const keys = Object.keys(units);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = keys[i], b = keys[j];
    let dmin = Infinity;
    for (let k = 0; k < FIT_G.length; k++) {
      const A = posed[a][k].W.concat(posed[a][k].L), B = posed[b][k].W.concat(posed[b][k].L);
      for (const p of A) for (const q of B) { const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (d < dmin) dmin = d; }
    }
    if (dmin < FIT.gap) {
      const both = a !== 'T' && b !== 'T';
      fail('units', a + b, (both ? 'the two mains meet' : UNIT_WORD[a === 'T' ? b : a] + ' meets the nose wheel') + ' as they fold',
           (both ? ['s1X'] : ['s1Z', 's2Z']).concat(FIT_ROWS[a].fold, FIT_ROWS[b].fold, [FIT_ROWS[a].st + 'Drop', FIT_ROWS[b].st + 'Drop', 's1R']));
    }
  }
  out.posed = posed;
  // ---- G3 (RETRACT-STUDY §8.3): THE WELLS - the volume each stowed unit RESERVES. The box round its stowed points
  // (the tyre and the leg, fully up at its fraction) and FIT.clear more, in this layer's frame; how much of it lies in
  // the body and how much in the wing (by its points - a partial gear reserves only what goes inside); its band of the
  // body's section (lv: 0 keel .. 1 top, at its station) and its span fractions (|x| over the semispan). The join
  // writes it into the spec (gear.wells) and the core's bays give its litres up (60c genBayResolve); the energy layer
  // keeps every tank out of it (wellHitsTank). Fixed: absent
  out.wells = [];
  const semi = W && W.semi > 0 ? W.semi : null;
  for (const key in units) {
    const up = posed[key][FIT_G.length - 1], pts = up.W.concat(up.L);
    let nb = 0, nw = 0;
    for (const p of pts) { if (bodyIn(p) > 0) nb++; else if (wingIn(p) > 0) nw++; }
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const p of pts) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i] - FIT.clear); mx[i] = Math.max(mx[i], p[i] + FIT.clear); }
    const vol = (mx[0] - mn[0]) * (mx[1] - mn[1]) * (mx[2] - mn[2]);
    const zm = 0.5 * (mn[2] + mx[2]);
    let lv = null;
    if (AF && zm >= AF.z0 && zm <= AF.z1) { const kl = AF.keelAt(zm), tp = AF.surf(zm, Math.PI)[1];
      if (tp > kl) lv = [Math.max(0, (mn[1] - kl) / (tp - kl)), Math.min(1, (mx[1] - kl) / (tp - kl))]; }
    const ax = [Math.abs(mn[0]), Math.abs(mx[0])];
    out.wells.push({ unit: key, min: mn, max: mx, vol, fBody: nb / pts.length, fWing: nw / pts.length, lv,
                     span: semi ? [Math.min(...ax) / semi, Math.max(...ax) / semi] : null,
                     straddle: mn[0] < 0 && mx[0] > 0 });
  }
  // ---- G4 (RETRACT-STUDY §8.10): THE CUTS - where each unit goes through the body's skin, as a plan outline the knife
  // cuts from below (_knife_gen.js knifeCut with a frame and a ceiling). The unit's points swept through the whole fold
  // (WELL_G: finer than the fit's poses) and the points where a swept point crosses the skin between two poses; those
  // inside the body (bodyIn) are the well's. The outline is their plan hull (exact) or their plan box with rounded
  // corners (box, gearWellCut 1: the fallback), FIT.clear wider all round; the ceiling is their highest point and
  // FIT.clear more. Two outlines that meet are cut as one (their hull, the higher ceiling). In the layer's metres here;
  // the knife takes them in cage units (cutsCage)
  { const mode = +P.gearWellCut === 1 ? 'box' : 'exact';
    const catK = FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'catalina' ? new Set(['L', 'R']) : null;
    const rawAll = wellRaw(units, bodyIn, MX, catK);
    // GR (the Catalina): A UNIT ENTERING THE BODY THROUGH ITS SIDE is cut from the side - its swept points near the skin
    // (within 40 mm of it), their section's outward direction averaged: mostly lateral (|nx| > 0.6) is a side well
    const sideOf = r => { let nx = 0, n = 0;
      for (const p of r.pts) { if (bodyIn(p) > 0.04) continue; const cy = AF.cyAt(p[2]), l = Math.hypot(p[0], p[1] - cy) || 1; nx += p[0] / l; n++; }
      return n && Math.abs(nx / n) > 0.6 ? Math.sign(nx) : 0; };
    const rawB = [], rawS = [];
    for (const r of rawAll) { const sd = AF ? sideOf(r) : 0; if (sd) rawS.push(Object.assign(r, { side: sd })); else rawB.push(r); }
    out.cuts = wellMerge(rawB, mode);
    out.cutsSide = wellMergeSide(rawS, mode);
    // GR: THE NACELLES' WELLS - the units' swept points inside a nacelle, cut from below into its skin (the wing's way)
    out.cutsNac = NACS.length ? wellMerge(wellRaw(units, nacIn, MX), mode) : [];
    // (a nacelle well's ceiling held 8 mm under the nacelle's top: a wheel taller than the nacelle never opens its top)
    for (const c of out.cutsNac) { const H = c.hf;
      for (let j = 0; j < H.nz; j++) for (let i = 0; i < H.nx; i++) {
        const x = H.x0 + i * H.d, z = H.z0 + j * H.d, N = nacAt(x, z);
        if (N) H.y[j * H.nx + i] = Math.min(H.y[j * H.nx + i], N.AF.surf(z, Math.PI)[1] - 0.008);
      } }
    // G5: THE WING'S CUTS - where the units go into the wing (its skins), and where they go into the body (a low wing's
    // centre section runs through a belly well), merged where they meet: the wing layer's skin is cut by these
    // (the wing's sweep takes the leg's AXIS, not its tube: a wing's rest slot sits in its lower skin by the trunnion,
    // and the tube's 70 mm carried the root's well over the centre section's seam, where its loops cannot close)
    out.cutsWing = W && W.underAt ? wellMerge(wellRaw(units, wingIn, MX, null, true).concat(rawB), mode) : [];
    // GR R4 (the user: "when they are not getting it in completely, we would still do the cutouts ... the round cutout for
    // the wheel"): WHERE THE STOWED WHEEL STANDS PROUD of a skin - its points over the wing's upper skin (the top: a hole
    // the knife cuts from above) and its points under the structure's lower skin (the bottom: the doors are cut round
    // it) - each set's plan hull, grown 12 mm. Top in (z, x), bottom in (z, -x), both counter-clockwise
    out.pierce = { top: [], bottom: [] };
    for (const key in units) {
      const Wp = poseAll(units[key].C, wheelRims(units[key].C), 0), top = [], bot = [];   // (the fine rims: a round cutout)
      for (const p of Wp) {
        const o = W && W.overAt ? W.overAt(p[0], p[2]) : null, u = W && W.underAt ? W.underAt(p[0], p[2]) : null;
        const inB = bodyIn(p) > 0.002 || nacIn(p) > 0.002, Nn = nacAt(p[0], p[2]);
        if (o && !inB && p[1] > o.y - 0.002) top.push([p[2], p[0]]);
        if (!inB && !(wingIn(p) > 0.002) && ((Nn && p[1] < Nn.AF.keelAt(p[2]) + 0.002) || (u && p[1] < u.y + 0.002) ||
                                              (!u && AF && p[2] >= AF.z0 && p[2] <= AF.z1 && p[1] < AF.cyAt(p[2]))))
          bot.push([p[2], -p[0]]);
      }
      if (top.length >= 3) out.pierce.top.push({ unit: key, outline: wellOutline(top, 'exact', 0.012) });
      if (bot.length >= 3) out.pierce.bottom.push({ unit: key, outline: wellOutline(bot, 'exact', 0.012) });
    }
    // a wing well's ceiling stays under the wing's upper skin (8 mm: the skin and its stringer) outside the body - a unit
    // thicker than the wing pokes through it, as the fit's red rows say; it does not open the wing's top
    for (const c of out.cutsWing) { const H = c.hf;
      for (let j = 0; j < H.nz; j++) for (let i = 0; i < H.nx; i++) {
        const x = H.x0 + i * H.d, z = H.z0 + j * H.d;
        if (AF && z >= AF.z0 && z <= AF.z1 && Math.abs(x) <= AF.halfWAt(z) + 0.02) continue;
        const o = W.overAt(x, z); if (o) H.y[j * H.nx + i] = Math.min(H.y[j * H.nx + i], o.y - 0.008);
      } } }
  out.ms = +((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(1);
  return out;
}
// (GR, the user: "the cut is not that clean ... it doesn't feel like the cut is round at all": 25 poses, not 17 - the
// swept envelope's facets were the outline's)
const WELL_G = Array.from({ length: 25 }, (_, i) => 1 - i / 24);
// the plan hull (Andrew's monotone chain) of [z, x] points, CCW
function hull2(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 1e-12) hi.pop(); hi.push(p); }
  lo.pop(); hi.pop();
  return lo.concat(hi);
}
// two convex plan outlines overlap (separating axes)
function hullsMeet(A, B) {
  for (const H of [A, B]) for (let i = 0; i < H.length; i++) {
    const a = H[i], b = H[(i + 1) % H.length], n = [b[1] - a[1], a[0] - b[0]];
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const p of A) { const d = p[0] * n[0] + p[1] * n[1]; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const p of B) { const d = p[0] * n[0] + p[1] * n[1]; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}
function wellOutline(pz, mode, clr) {
  if (mode === 'box') {
    let z0 = Infinity, z1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    for (const p of pz) { z0 = Math.min(z0, p[0]); z1 = Math.max(z1, p[0]); x0 = Math.min(x0, p[1]); x1 = Math.max(x1, p[1]); }
    // (grown as the exact outline is - its 32-gons circumscribed - so the box always holds it)
    clr = clr / Math.cos(Math.PI / 32);
    z0 -= clr; z1 += clr; x0 -= clr; x1 += clr;
    // the corners rounded by the clearance at most: a larger radius would cut a corner point's own clearance (the box
    // must hold the exact hull - GATE RETRACT §13)
    const r = Math.min(clr, (z1 - z0) / 2, (x1 - x0) / 2), out = [];
    const cs = [[z1 - r, x1 - r], [z0 + r, x1 - r], [z0 + r, x0 + r], [z1 - r, x0 + r]];
    // each quarter in 4 chords, CIRCUMSCRIBED (its points r / cos(pi/16) out): the chords never cut inside the arc
    const rc = r / Math.cos(Math.PI / 16);
    for (let c = 0; c < 4; c++) for (let i = 0; i <= 4; i++) {
      const t = (c + i / 4) * Math.PI / 2;
      out.push([cs[c][0] + rc * Math.cos(t), cs[c][1] + rc * Math.sin(t)]);
    }
    return hull2(out);
  }
  // exact: the hull of the points each grown by the clearance (a 32-gon round each hull corner, circumscribed: the
  // chords never cut inside the clearance)
  const h = hull2(pz), grown = [], rc = clr / Math.cos(Math.PI / 32);
  for (const p of h) for (let k = 0; k < 32; k++) grown.push([p[0] + rc * Math.cos(k * Math.PI / 16), p[1] + rc * Math.sin(k * Math.PI / 16)]);
  return hull2(grown);
}
// GM (the user, 4 Nov: "now that you have good rotation points, you should include a cut for the rest position too. A
// cut in which the rotation point slots"): the leg is sampled FROM ITS TRUNNION (every 5 %), so where it leaves the skin
// gear down - the rest slot - is in the outline; and the mechanism's brace links and actuator (MX: the record and the
// core) are swept with it, at every position
const WELL_LEG = Array.from({ length: 21 }, (_, i) => i / 20);
function wellMechPts(MX, key, g) {
  const R = MX.R, K = R.knees && R.knees[key], Q = MX.CM.gearMechPoints(R, g), out = [];
  const seg = (a, b) => { for (let i = 0; i <= 5; i++) { const t = i / 5; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); } };
  if (K) { const s = Q.pt(K.s), l = Q.pt(K.l), k = Q.knees[key]; seg(s, k); seg(k, l); }
  for (const P of R.parts || []) if (P.rule === 'aim' && P.name === 'edMech' + key + '_cyl') seg(Q.pt(P.from), Q.pt(P.to));
  return out;
}
// a unit's swept points inside a structure (`inFn` > 0: the body's section, or the wing's skins), with the points where a
// swept point crosses that structure's skin between two poses
// the tyre's two rims finely (48 points each, at the full radius and 96 %): a wheel-only recess's outline comes out ROUND
function wheelRims(C, n, radii) {
  n = n || 48; radii = radii || [1, 0.96];
  const a = C.wAx, R = C.R, hw = 0.38 * R, c = C.axle;
  const ref = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = fNrm([a[1] * ref[2] - a[2] * ref[1], a[2] * ref[0] - a[0] * ref[2], a[0] * ref[1] - a[1] * ref[0]]);
  const v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]], out = [c.slice()];
  for (const sd of [-hw, hw]) for (const rf of radii) for (let k = 0; k < n; k++) {
    const r = rf * R, ca = Math.cos(k * 2 * Math.PI / n) * r, sa = Math.sin(k * 2 * Math.PI / n) * r;
    out.push([c[0] + a[0] * sd + u[0] * ca + v[0] * sa, c[1] + a[1] * sd + u[1] * ca + v[1] * sa, c[2] + a[2] * sd + u[2] * ca + v[2] * sa]);
  }
  return out;
}
// GR (the user: "you should really cut and allow for some margin around that ... It should really not clip at any
// points"): THE LEG AS A TUBE - from its trunnion to its axle (every 5 %), 8 points round it at its radius and its links'
// room (C.legR), every 10 %, 6 round: the rest slot holds the leg's skin, not its axis
function legTube(C) {
  const h = C.hinge, ax = C.axle, d = fNrm([ax[0] - h[0], ax[1] - h[1], ax[2] - h[2]]), r = C.legR || 0.05;
  const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = fNrm([d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]]);
  const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]], out = [];
  const at = f => [h[0] + (ax[0] - h[0]) * f, h[1] + (ax[1] - h[1]) * f, h[2] + (ax[2] - h[2]) * f];
  // the axis every 5 % (where it crosses the skin); the rings - 6 round, growing from the trunnion (the pin's own fitting
  // is drawn there, deep in the structure) to the full radius a fifth of the way down, where the leg leaves the skin -
  // at 20, 35, 50, 65, 80 and 100 % (a convex hull needs no more)
  for (const f of WELL_LEG) out.push(at(f));
  if (r > 1e-6) for (const f of [0.2, 0.35, 0.5, 0.65, 0.8, 1]) { const c = at(f), rf = r * Math.min(1, f / 0.2);
    for (let k = 0; k < 6; k++) { const ca = Math.cos(k * Math.PI / 3) * rf, sa = Math.sin(k * Math.PI / 3) * rf;
      out.push([c[0] + u[0] * ca + v[0] * sa, c[1] + u[1] * ca + v[1] * sa, c[2] + u[2] * ca + v[2] * sa]); } }
  return out;
}
function wellRaw(units, inFn, MX, wheelOnly, axisOnly) {
  const raw = [];
  for (const key in units) {
    // (`wheelOnly` keys - the Catalina's mains: their leg and strut stay outside the hull, the recess is the wheel's alone)
    const U = units[key], inside = [], wo = wheelOnly && wheelOnly.has(key);
    // (the swept points once per unit and kind, shared by the body's, the nacelles' and the wing's sweeps)
    const ck = wo ? '_swW' : axisOnly ? '_swA' : '_sw';
    if (!U[ck]) { const all = wo ? wheelRims(U.C) : wheelRims(U.C, 24, [1]).concat(U.pts.W.filter((p, i) => i === 0 || ((i - 1) % 24) >= 12), axisOnly ? legTube(Object.assign({}, U.C, { legR: 1e-9 })) : legTube(U.C));
      if (MX && !wo && !U._mech) U._mech = WELL_G.map(g => wellMechPts(MX, key, g));    // (the mechanism's, once per unit)
      // (the wing's axis sweep every other pose: its outline is the wheel's and the axis', coarser in time than the tube's)
      U[ck] = WELL_G.map((g, gi) => axisOnly && gi % 2 ? null : poseAll(U.C, all, g).concat(MX && !wo ? U._mech[gi] : [])).filter(Boolean); }
    let prev = null, prevD = null;
    for (const ps of U[ck]) {
      const ds = ps.map(inFn);
      for (let i = 0; i < ps.length; i++) {
        if (ds[i] > 0) inside.push(ps[i]);
        if (prev && (ds[i] > 0) !== (prevD[i] > 0)) {         // crossing the skin between two poses
          const t = prevD[i] / (prevD[i] - ds[i]), a = prev[i], b = ps[i];
          inside.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
        }
      }
      prev = ps; prevD = ds;
    }
    if (inside.length >= 3) raw.push({ units: [key], pts: inside });
  }
  return raw;
}
// the outlines (exact or box), merged where they meet (their points together), each with its top and fitted ceiling
function wellMerge(raw, mode) {
  let cuts = raw.map(r => {
    let top = -Infinity; for (const p of r.pts) top = Math.max(top, p[1]);
    const pz = r.pts.map(p => [p[2], p[0]]);
    return { units: r.units.slice(), mode, pz, pts: r.pts, hull: wellOutline(pz, mode, FIT.clear), ceil: top + FIT.clear };
  });
  for (let again = true; again;) {
    again = false;
    for (let i = 0; i < cuts.length && !again; i++) for (let j = i + 1; j < cuts.length && !again; j++)
      if (hullsMeet(cuts[i].hull, cuts[j].hull)) {
        const pz = cuts[i].pz.concat(cuts[j].pz);
        cuts[i] = { units: [...new Set(cuts[i].units.concat(cuts[j].units))], mode, pz, pts: cuts[i].pts.concat(cuts[j].pts),
                    hull: wellOutline(pz, mode, FIT.clear), ceil: Math.max(cuts[i].ceil, cuts[j].ceil) };
        cuts.splice(j, 1); again = true;
      }
  }
  return cuts.map(c => ({ units: c.units, mode: c.mode, hull: c.hull, ceil: c.ceil, hf: wellHeights(c) }));
}
function wellCutsOf(units, bodyIn, mode, MX) { return wellMerge(wellRaw(units, bodyIn, MX), mode); }
// GM: THE FITTED CEILING - a height map over the cut's plan (WELL_CELL cells): each cell the highest swept point within
// the clearance of it, plus the clearance; a cell no point reaches takes the lowest reached one (a shallow floor, not
// the skin) - the well is deep only where the unit, its trunnion and its brace go
const WELL_CELL = 0.03;
function wellHeights(c) {
  let z0 = Infinity, z1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  for (const p of c.hull) { z0 = Math.min(z0, p[0]); z1 = Math.max(z1, p[0]); x0 = Math.min(x0, p[1]); x1 = Math.max(x1, p[1]); }
  const d = WELL_CELL, nx = Math.max(2, Math.ceil((x1 - x0) / d) + 1), nz = Math.max(2, Math.ceil((z1 - z0) / d) + 1);
  // GR (the user: "the backside should be as flat as possible ... cut through it, extrude that, and do a flat surface"):
  // THE CEILING IS FLAT - the outline extruded to the highest swept point and the clearance; the grid stays (the
  // structure's caps - a wing's upper skin, a nacelle's top - still hold it under them, cell by cell, after)
  let hi = -Infinity; for (const p of c.pts) if (p[1] > hi) hi = p[1];
  return { x0, z0, d, nx, nz, y: new Array(nx * nz).fill(hi + FIT.clear) };
}
// GR: A SIDE WELL (the Catalina's recess in the hull's side): the knife's frame looks at the side (n0 = [s, 0, 0]), the
// outline in its (u, v) = (z, -s y), the recess inward to a fitted floor: the depth coordinate e = -s x (inward +), each
// cell the deepest swept point's e within the clearance, plus the clearance. Same side's wells merge where they meet
function wellMergeSide(raw, mode) {
  const frameOf = s => ({ n0: [s, 0, 0], c0: [0, 0, 0], t1: [0, 0, 1], t2: [0, -s, 0] });
  let cuts = raw.map(r => { const s = r.side, uv = r.pts.map(p => [p[2], -s * p[1]]);
    let top = -Infinity; for (const p of r.pts) top = Math.max(top, -s * p[0]);
    return { units: r.units.slice(), side: s, mode, uv, pts: r.pts, hull: wellOutline(uv, mode, FIT.clear), ceil: top + FIT.clear }; });
  for (let again = true; again;) {
    again = false;
    for (let i = 0; i < cuts.length && !again; i++) for (let j = i + 1; j < cuts.length && !again; j++)
      if (cuts[i].side === cuts[j].side && hullsMeet(cuts[i].hull, cuts[j].hull)) {
        const uv = cuts[i].uv.concat(cuts[j].uv);
        cuts[i] = Object.assign({}, cuts[i], { units: [...new Set(cuts[i].units.concat(cuts[j].units))], uv, pts: cuts[i].pts.concat(cuts[j].pts),
                                               hull: wellOutline(uv, mode, FIT.clear), ceil: Math.max(cuts[i].ceil, cuts[j].ceil) });
        cuts.splice(j, 1); again = true;
      }
  }
  return cuts.map(c => {
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of c.hull) { u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]); }
    const d = WELL_CELL, nu = Math.max(2, Math.ceil((u1 - u0) / d) + 1), nv = Math.max(2, Math.ceil((v1 - v0) / d) + 1);
    const e = new Array(nu * nv).fill(-Infinity), r = FIT.clear + d * 0.75, rc = Math.ceil(r / d);
    for (const p of c.pts) {
      const u = p[2], v = -c.side * p[1], ep = -c.side * p[0] + FIT.clear, ci = Math.round((u - u0) / d), cj = Math.round((v - v0) / d);
      for (let j = Math.max(0, cj - rc); j <= Math.min(nv - 1, cj + rc); j++) for (let i = Math.max(0, ci - rc); i <= Math.min(nu - 1, ci + rc); i++) {
        if (Math.hypot(u0 + i * d - u, v0 + j * d - v) > r) continue;
        const k = j * nu + i; if (ep > e[k]) e[k] = ep; }
    }
    let hi = -Infinity; for (const x of e) if (x > hi) hi = x;          // (GR: the floor flat, as the ceilings)
    return { units: c.units, side: c.side, mode, frame: frameOf(c.side), hull: c.hull, ceil: c.ceil,
             hf: { u0, v0, d, nu, nv, e: e.map(() => hi) } };
  });
}
function cutsSideCage(cuts, FS) {
  return (cuts || []).map(c => {
    let o = c.hull.map(p => [p[0] / FS, p[1] / FS]), a2 = 0;
    for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
    if (a2 < 0) o = o.slice().reverse();
    return { units: c.units, side: c.side, mode: c.mode, frame: c.frame, outline: o, ceil: c.ceil / FS,
             hf: { u0: c.hf.u0 / FS, v0: c.hf.v0 / FS, d: c.hf.d / FS, nu: c.hf.nu, nv: c.hf.nv, e: c.hf.e.map(x => +(x / FS).toFixed(5)) } };
  });
}
// the cuts in the knife's terms: cage units (metres / FS), the outline in the well frame's (u, v) = (z, -x), CCW
function cutsCage(cuts, FS) {
  return (cuts || []).map(c => {
    let o = c.hull.map(p => [p[0] / FS, -p[1] / FS]);
    let a2 = 0;
    for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
    if (a2 < 0) o = o.slice().reverse();
    const hf = c.hf ? { x0: c.hf.x0 / FS, z0: c.hf.z0 / FS, d: c.hf.d / FS, nx: c.hf.nx, nz: c.hf.nz, y: c.hf.y.map(v => +(v / FS).toFixed(5)) } : null;
    return { units: c.units, mode: c.mode, outline: o, ceil: c.ceil / FS, ...(hf ? { hf } : {}) };
  });
}
// the fifth test, the TANKS - read when the rows are refreshed (the energy layer runs after the gear): the stowed and
// swept points inside a placed body tank's box or a wing tank's side boxes (_vessel_gen bodyPlace / wingPlace)
function fitTanks(fit) {
  const E = window.CAGE_ENERGY, res = E && E.results ? E.results() : null;
  if (!fit || !fit.posed || !res || !res.length) return [];
  const hits = [];
  for (const r of res) {
    if (!r) continue;
    let inside = null;
    if (r.on === 'body' && r.c && r.e) {
      const c = r.c, e = r.e, cs = Math.cos(-(r.rot || 0)), sn = Math.sin(-(r.rot || 0));
      inside = p => { const dx = p[0] - c[0], dz = p[2] - c[2], x = dx * cs - dz * sn, z = dx * sn + dz * cs;
        return Math.abs(x) <= e[0] && Math.abs(p[1] - c[1]) <= e[1] && Math.abs(z) <= e[2]; };
    } else if (r.on === 'wing' && Array.isArray(r.sides) && r.sides.length) {
      inside = p => r.sides.some(s => { const x0 = Math.min(s.x0, s.x1), x1 = Math.max(s.x0, s.x1);
        if (p[0] < x0 || p[0] > x1) return false;
        const f = (Math.abs(p[0]) - Math.abs(s.x0)) / Math.max(1e-6, Math.abs(s.x1) - Math.abs(s.x0));
        const zF = s.zF0 + (s.zF1 - s.zF0) * f, zR = s.zR0 + (s.zR1 - s.zR0) * f;
        return p[2] <= zF && p[2] >= zR && Math.abs(p[1] - s.y) <= (s.d || 0.1) / 2; });
    }
    if (!inside) continue;
    for (const key in fit.posed) {
      if (fit.posed[key].some(ps => ps.W.some(inside) || ps.L.some(inside))) { hits.push({ unit: key, tank: r }); break; }
    }
  }
  return hits;
}
// G3: DOES A PLACED TANK MEET A WELL - a body tank's box (centre c, half extents e, yaw rot) or a wing tank's side boxes
// against the well's box (separating axes in plan - the tank turned about y - and the heights' overlap)
function wellHitsTank(w, r) {
  if (!w || !r) return false;
  const boxes = [];
  if (r.on === 'body' && r.c && r.e) boxes.push({ c: r.c, e: r.e, rot: r.rot || 0 });
  else if (r.on === 'wing' && Array.isArray(r.sides))
    for (const s of r.sides) { const x0 = Math.min(s.x0, s.x1), x1 = Math.max(s.x0, s.x1), zs = [s.zF0, s.zF1, s.zR0, s.zR1];
      const z0 = Math.min(...zs), z1 = Math.max(...zs), hd = (s.d || 0.1) / 2;
      boxes.push({ c: [(x0 + x1) / 2, s.y, (z0 + z1) / 2], e: [(x1 - x0) / 2, hd, (z1 - z0) / 2], rot: 0 }); }
  const wc = [(w.min[0] + w.max[0]) / 2, (w.min[1] + w.max[1]) / 2, (w.min[2] + w.max[2]) / 2];
  const we = [(w.max[0] - w.min[0]) / 2, (w.max[1] - w.min[1]) / 2, (w.max[2] - w.min[2]) / 2];
  for (const b of boxes) {
    if (Math.abs(b.c[1] - wc[1]) > b.e[1] + we[1]) continue;
    const cs = Math.cos(b.rot), sn = Math.sin(b.rot), dx = b.c[0] - wc[0], dz = b.c[2] - wc[2];
    // the plan's four axes: the well's x and z, the tank's turned u (cs, -sn) and v (sn, cs)
    const ax = [[1, 0], [0, 1], [cs, -sn], [sn, cs]];
    let sep = false;
    for (const [ux, uz] of ax) {
      const rW = we[0] * Math.abs(ux) + we[2] * Math.abs(uz);
      const rT = b.e[0] * Math.abs(ux * cs - uz * sn) + b.e[2] * Math.abs(ux * sn + uz * cs);
      if (Math.abs(dx * ux + dz * uz) > rW + rT) { sep = true; break; }
    }
    if (!sep) return true;
  }
  return false;
}

// THE RED ROWS (_cage_ui.js applyRowVis reads this after every build): row key -> the reason, or null when it fits
window.CAGE_ROW_BAD = () => {
  const G = window.CAGE_GEAR, fit = G && G.fit;
  if (!fit) return null;
  const rows = Object.assign({}, fit.rows);
  for (const h of fitTanks(fit)) {
    const why = UNIT_WORD[h.unit] + ' meets a tank (' + ((h.tank.bay && (h.tank.bay.name || h.tank.bay.key)) || h.tank.on) + ')';
    for (const k of FIT_ROWS[h.unit].fold.concat([FIT_ROWS[h.unit].st + 'Z', 'gearRetFrac'])) if (!rows[k]) rows[k] = why;
    if (!rows.gearRetract) rows.gearRetract = why;
  }
  return Object.keys(rows).length ? rows : null;
};
// the retraction row's own line: the first reason, or nothing
const fitNote = () => { const B = window.CAGE_ROW_BAD ? window.CAGE_ROW_BAD() : null; if (!B) return '';
  const w = [...new Set(Object.values(B))]; return 'does not fit: ' + w[0] + (w.length > 1 ? ' (+' + (w.length - 1) + ')' : ''); };

// RETRACT-1: the build may retract its gear - the switch on, wheels (not floats), a nose wheel, a low wing
// (GR: any wing - a low wing's mains root on the wing, any other's on the body: the Catalina's hull)
const GEAR_RETRACTABLE = P => !!(+P.gearRetract && !+P.gearFloats && +P.s2On && Math.round(+P.s2Leg) !== 3);
const GROUP = ['9 · undercarriage', [
  ['gearOn',  'undercarriage', 0, 1, 1],
  ['gearSit', 'stand it on the ground', 0, 1, 1,
   { when: P => +P.gearOn }],
  // S1 (G451.1): the wheel stations are not there under a float build (one gear kind)
  station(1, 'station 1 — mains').concat([{ when: P => +P.gearOn * (1 - (+P.gearFloats || 0)) > 0 }]),
  station(2, 'station 2 — third wheel').concat([{ when: P => +P.gearOn * (1 - (+P.gearFloats || 0)) > 0 }]),
  // RETRACT-1 (futureDesigns/RETRACT-STUDY-2026-11.md §3.1): THE RETRACTABLE GEAR, a LOW-WING tricycle's (the third
  // wheel a nose wheel: s2Leg not the tailwheel's 3; the mains rooted on the wing fold inward into its root - the
  // user's ruling, the low-wing tourer first; a body-rooted main's twist-and-tuck is step 3's). The join writes
  // spec.gear.retract from these; the flown aeroplane swings the units (app.js gearSwingRig) - no well is cut yet,
  // the stowed gear lies inside the skin (step 4 cuts the wells). The one predicate: GEAR_RETRACTABLE
  ['retraction', [
    ['gearRetract', 'retraction (a tricycle\'s)', 0, 1, 1, ['fixed', 'retractable'], { note: P => +P.gearRetract ? fitNote() : '' }],
    ['gearRetT', 'cycle time, s (one way)', 2, 20, 0.5, { when: P => +P.gearRetract }],
    ['gearRetAct', 'actuation', 0, 2, 1, ['electric', 'hydraulic', 'manual (Johnson bar)'], { when: P => +P.gearRetract }],
    // G1 (RETRACT-STUDY §8.1): THE FOLD. A preset per unit, or 'custom': up to two turns, each about a body axis
    // (fore-aft / lateral / vertical) by a signed angle whose + is PROBED (the axle moves inboard on fore-aft and
    // vertical, aft on lateral), plus the wheel's own twist about its leg (to lie flatter); the mains' rows are the
    // port unit's, the starboard mirrors them. The fraction stops the whole chain part way (the wheel in its inset)
    ['gearPos', 'gear position (preview: 1 down, 0 up)', 0, 1, 0.01, { when: P => +P.gearRetract }],
    ['gearFold', 'mains fold', 0, FOLD_KEYS.length - 1, 1, FOLD_KEYS.map(k => FOLD_LABELS[k]), { when: P => +P.gearRetract }],
    ['gm1Ax', 'mains turn 1: axis', 0, 2, 1, FOLD_AX_LABELS, { when: P => +P.gearRetract && foldCustom(P) }],
    ['gm1Ang', 'mains turn 1: angle °', -180, 180, 1, { when: P => +P.gearRetract && foldCustom(P) }],
    ['gm2Ax', 'mains turn 2: axis', 0, 2, 1, FOLD_AX_LABELS, { when: P => +P.gearRetract && foldCustom(P) }],
    ['gm2Ang', 'mains turn 2: angle ° (0: none)', -180, 180, 1, { when: P => +P.gearRetract && foldCustom(P) }],
    ['gmTwist', 'mains wheel twist ° (about the leg)', -90, 90, 1, { when: P => +P.gearRetract && foldCustom(P) }],
    ['gearFoldNose', 'nose fold', 0, FOLD_NOSE_KEYS.length - 1, 1, FOLD_NOSE_KEYS.map(k => FOLD_LABELS[k]), { when: P => +P.gearRetract }],
    ['gn1Ax', 'nose turn 1: axis', 0, 2, 1, FOLD_AX_LABELS, { when: P => +P.gearRetract && foldNoseCustom(P) }],
    ['gn1Ang', 'nose turn 1: angle °', -180, 180, 1, { when: P => +P.gearRetract && foldNoseCustom(P) }],
    ['gn2Ax', 'nose turn 2: axis', 0, 2, 1, FOLD_AX_LABELS, { when: P => +P.gearRetract && foldNoseCustom(P) }],
    ['gn2Ang', 'nose turn 2: angle ° (0: none)', -180, 180, 1, { when: P => +P.gearRetract && foldNoseCustom(P) }],
    ['gnTwist', 'nose wheel twist ° (about the leg)', -90, 90, 1, { when: P => +P.gearRetract && foldNoseCustom(P) }],
    ['gearRetFrac', 'retracts (fraction of the fold)', 0.3, 1, 0.05, { when: P => +P.gearRetract }],
    // G4 (RETRACT-STUDY §8.10): THE WELL'S OUTLINE, always cut exactly into the skin - the swept unit's own plan hull,
    // or a rounded box round it (the fallback the user asked to keep: "so we have a fallback in case we struggle")
    ['gearWellCut', 'well outline', 0, 1, 1, ['exact (the swept unit\'s hull)', 'box (a rounded rectangle)'], { when: P => +P.gearRetract }],
    // G6 (§8.13): THE DOORS - the exact outline's skin rides on the leg (the leg door) and what is left is the well's
    // door(s); the box's are its door(s) alone: one, or two split along the well (the user: "One, or 2, slitting in
    // the middle")
    ['gearLegDoor', 'leg door (the skin on the leg)', 0, 1, 1, ['off', 'on'], { when: P => +P.gearRetract && +P.gearWellCut !== 1 }],
    // GR: the shortening (the piston slides into its cylinder as the gear comes up: a long leg stows shorter)
    ['gearShort', 'mains shorten as they retract (share of the leg)', 0, 0.45, 0.05, { when: P => +P.gearRetract }],
    ['gearShortNose', 'nose leg shortens as it retracts', 0, 0.45, 0.05, { when: P => +P.gearRetract }],
    // GR: THE NACELLE FITTED TO THE GEAR (the cowl layer's nacGearFit: deeper, lower, longer - the engine, the cowl and
    // the nacelle together) - on by default; and the stand-alone gear pod under the nacelle (nacPodBuild), a separate
    // option
    ['gearNacFit', 'fit the nacelle to the gear (deeper, lower, longer)', 0, 1, 1, ['off', 'on'], { when: P => +P.gearRetract && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'nacelle' }],
    ['gearNacPod', 'a separate gear pod under the nacelle', 0, 1, 1, ['off', 'on'], { when: P => +P.gearRetract && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'nacelle' }],
    ['gearDoors', 'well doors', 0, 2, 1, ['none (open well)', 'one door', 'two doors (split)'], { when: P => +P.gearRetract }],
  // (shown on a low wing on wheels - ONE row from the stock aeroplane brings it, GATE PARTS' reach; the nose wheel the
  // retraction also needs is the join's and the swing's own test, GEAR_RETRACTABLE)
  ], { when: P => +P.gearOn * (1 - (+P.gearFloats || 0)) > 0 }],
  // G133: one build material for the whole set of fairings — a set of
  // spats is laid up as one job, and the row exists only when one is worn
  ['fairCons', 'fairing build', 0, 2, 1, ['glassfibre', 'carbon', 'alloy'],
   { when: P => +P.gearOn && fairAny(P) }],
  // the wheel dressing — shared rows (G33: this group never made the
  // cage port; G3852: the tundra's own 'tundra tread' row, lugs or smooth)
  ['wheel', GP.WHEEL_ROWS.map(r => r.slice()), { when: P => +P.gearOn * (1 - (+P.gearFloats || 0)) > 0 }],
  ['balance + prop', [
    ['cgZ',   'CG station z', -2, 4, 0.01, { dim: 'm' }],
    ['cgY',   'CG height y',  -1, 1, 0.01, { dim: 'm' }],
    ['propR', 'prop radius',  0.20, 2.00, 0.005, { dim: 'm' }],
    ['propZ', 'prop plane z', -1, 5, 0.01, { dim: 'm' }],
  ], { when: P => +P.gearOn }],
]];
// a page that curated its own tree replaced the base panel outright, so an
// appended group has to go into THAT array; otherwise the base append list.
(PAGE.groupsOverride || (PAGE.groups = PAGE.groups || [])).push(GROUP);
window.CAGE_GEAR_FOLD = { FOLD_PRESETS, FOLD_KEYS, FOLD_NOSE_KEYS, foldOf, foldChain, foldPose,   // G1: the one fold
                          wellHitsTank };                                                       // G3: the reservation

// ---- GM2 (RETRACT-STUDY §8.11): THE ACTUATION - a brace and an actuator per unit, drawn at rest, posed by the core --
// The record GEAR_MECH poses (src/core/62c_gear_mech.js): the units' chains (rigid: the leg, the wheel, the castor),
// and per unit:
//   THE BRACE: two links and a knee, from a pivot on the STRUCTURE (S: 85 % of the way from the trunnion to where the
//   leg's brace point stows - inside the well's own volume) to the leg's brace point (40 % down the leg); straight (locked)
//   down, the knee folding up into the structure (over the trunnion, in the swing plane) as the leg comes up;
//   THE ACTUATOR (the actuation row; manual: none, the Johnson bar works the brace): from a structure pivot A (2.8 x
//   the leg's actuator point's stowed offset from the trunnion, on its line) to that point (30 % down the leg) - its
//   body from A, its rod from the leg, sliding in each other. The body is as long as the closed length leaves (closed
//   length less 30 mm of rod); it holds the whole stroke only if the extended length is at most twice the closed less
//   60 mm (`ok`, GATE RETRACT).
const MECH = { bracePt: 0.40, braceS: 0.85, actPt: 0.30, actK: 2.8, rCyl: [0.020, 0.024], rRod: 0.0095, rBrace: 0.013 };
function mechBuild(P, swing, group, KT, CM, SP) {
  const R = { units: {}, knees: {}, parts: [] }, info = {}, fits = [];
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const M = k => GG.gearMat(k);
  const act = Math.round(+P.gearRetAct || 0);              // 0 electric, 1 hydraulic, 2 manual
  const fix = { alloy: KT.Bag(), steel: KT.Bag(), bronze: KT.Bag(), dark: KT.Bag() };
  const partGroup = (name, fill) => {
    const b = { alloy: KT.Bag(), steel: KT.Bag(), chrome: KT.Bag(), bronze: KT.Bag(), dark: KT.Bag() };
    fill(b);
    const gp = new THREE.Group(); gp.name = name;
    for (const k in b) if (b[k].tris) b[k].mesh(gp, M(k));
    group.add(gp);
  };
  const onLeg = (k, fill) => {
    let lg = null; group.traverse(o => { if (o.name === 'edLeg' + k) lg = o; });
    if (!lg) return;
    const b = { alloy: KT.Bag(), bronze: KT.Bag() };
    fill(b);
    for (const q in b) if (b[q].tris) b[q].mesh(lg, M(q));
  };
  for (const k in swing) {
    const C = swing[k];
    R.units[k] = C;
    // (GR: a shortening unit's wheel, castor and piston ride the piston up the leg - `slide`)
    const sl = C.shorten ? { slide: true } : {};
    R.parts.push({ name: 'edLeg' + k, rule: 'rigid', unit: k }, Object.assign({ name: 'edWheel' + k, rule: 'rigid', unit: k }, sl));
    if (k === 'T') R.parts.push(Object.assign({ name: 'edCastorT', rule: 'rigid', unit: 'T' }, sl));
    if (C.shorten && C.low) R.parts.push({ name: 'edMechLow' + k, rule: 'rigid', unit: k, slide: true, o0: C.hinge.slice() });
    // the torque scissor as a knee: its upper arm on the cylinder, its lower on the piston (slid), the knee forward
    if (C.shorten && C.scissor) { const Sc = C.scissor, kid = 'sc' + k, la = dist(Sc.a0, Sc.knee), lb2 = dist(Sc.knee, Sc.a2);
      const bendP = [Sc.knee[0] + Sc.fwd[0] * 0.05, Sc.knee[1] + Sc.fwd[1] * 0.05, Sc.knee[2] + Sc.fwd[2] * 0.05];
      // (the bend's reference rides the cylinder: its point moved up the leg above the gland)
      const bRef = (() => { const S = C.shorten, h = C.hinge, t = sub3(bendP, h), tt = t[0] * S.dir[0] + t[1] * S.dir[1] + t[2] * S.dir[2];
        return tt > S.t0 - 0.01 ? [bendP[0] - S.dir[0] * (tt - S.t0 + 0.02), bendP[1] - S.dir[1] * (tt - S.t0 + 0.02), bendP[2] - S.dir[2] * (tt - S.t0 + 0.02)] : bendP; })();
      R.knees[kid] = { s: { unit: k, p: Sc.a0 }, l: { unit: k, p: Sc.a2 }, a: la, b: lb2, bend: { unit: k, p: bRef } };
      R.parts.push({ name: 'edMech' + k + '_sc1', rule: 'aim', from: { unit: k, p: Sc.a0 }, to: { knee: kid }, o0: Sc.a0, d0: nrm(sub3(Sc.knee, Sc.a0)) },
                   { name: 'edMech' + k + '_sc2', rule: 'aim', from: { unit: k, p: Sc.a2 }, to: { knee: kid }, o0: Sc.a2, d0: nrm(sub3(Sc.knee, Sc.a2)) });
      for (const [nm, p0, q0] of [['_sc1', Sc.a0, Sc.knee], ['_sc2', Sc.a2, Sc.knee]]) partGroup('edMech' + k + nm, b => {
        const path = KT.resample([p0, q0], 4);
        KT.sweep(b.alloy, path, t => KT.secBlade(0.030 - 0.006 * Math.abs(t - 0.5), 0.011), true, Sc.pax);
        for (const p of [p0, q0]) KT.revolve(b.bronze, KT.off(p, Sc.pax, -0.012), Sc.pax, [[0.008, 0], [0.008, 0.024]], 10, true);
      }); }
    const h = C.hinge, ax = C.axle, Mup = CM.gearFoldPose(C, 0), up = p => CM.gearUnitPt(C, Mup, p);
    const legPt = f => lerp(h, ax, f);
    // THE BRACE
    // the knee folds UP into the structure, in the leg's own swing plane: toward a point over the trunnion (off the
    // brace's line at every position - the trunnion itself is ON it, stowed)
    const legUp0 = nrm(sub3(h, ax));
    // GR R2: THE BRACE STAYS INSIDE - its knee folds up into the structure (in the swing plane), or fore, or aft (in a thin
    // wing's plane), whichever keeps it deepest over the fold's first 60 % up; and a brace whose knee still comes out is
    // shortened (its leg point 40 -> 30 -> 22 % down the leg: a shorter brace folds a lower knee). SP: the structure's probe
    const braceAt = bp => {
      const Lp = legPt(bp), S = lerp(h, up(Lp), MECH.braceS), D = dist(S, Lp);
      let best = null;
      for (const dv of [legUp0, [0, 0, 1], [0, 0, -1]]) {
        const B = [h[0] + dv[0] * D, h[1] + dv[1] * D, h[2] + dv[2] * D];
        let worst = Infinity;
        if (SP) for (let i = 0; i <= 6; i++) {
          const g = i / 10, Mg = CM.gearFoldPose(C, g), l = CM.gearUnitPt(C, Mg, Lp), kn = CM.gearKnee(S, l, D / 2, D / 2, B, null);
          worst = Math.min(worst, SP.inside(kn));
        }
        if (!best || worst > best.worst + 0.005) best = { worst, B };
        if (!SP) break;
      }
      return { Lp, S, D, bend: best.B, worst: best.worst };
    };
    let br = null;
    const catM = k !== 'T' && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'catalina';
    if (catM && SP) {
      // THE CATALINA'S STRUT: from a fitting on the hull's side (found on the skin by bisection, 30 mm out) to the leg
      // (45 % down); its knee folding OUTWARD (the PBY's strut ran to the wing; the jack that works it is inside the
      // hull - not drawn)
      // (v2: the strut's fitting AFT along the side at the pin's height - 40 % of the leg's length aft, 60 mm under - so
      // it is longest gear down (straight, locked) and folds as the leg swings aft and level; its knee goes outward)
      const L = dist(h, ax), sg = h[0] >= 0 ? 1 : -1, y = h[1] - 0.06, z = h[2] - 0.4 * L;
      let lo = 0, hi = 3; for (let it = 0; it < 40; it++) { const m2 = (lo + hi) / 2; if (SP.bodyIn([sg * m2, y, z]) > 0) lo = m2; else hi = m2; }
      const S = [sg * (lo + 0.03), y, z], Lp = legPt(0.45), D = dist(S, Lp);
      br = { Lp, S, D, bend: [S[0] + sg * D, S[1] - 0.2 * D, S[2]], worst: 0 };
    } else for (const bp of [MECH.bracePt, 0.30, 0.22]) {
      const c = braceAt(bp);
      if (!br || c.worst > br.worst + 0.002) br = c;
      if (!SP || br.worst >= 0.005) break;
    }
    const { Lp, S, D } = br, K0 = lerp(S, Lp, 0.5), bend = br.bend;
    const pn = nrm(crs(sub3(S, Lp), sub3(h, Lp)));            // the brace's pins, square to its plane
    if (SP) info.knee = +br.worst.toFixed(3);
    R.knees[k] = { s: { fix: S }, l: { unit: k, p: Lp }, a: D / 2, b: D / 2, bend: { fix: bend } };
    R.parts.push({ name: 'edMech' + k + '_brace1', rule: 'aim', from: { fix: S }, to: { knee: k }, o0: S, d0: nrm(sub3(K0, S)) },
                 { name: 'edMech' + k + '_brace2', rule: 'aim', from: { unit: k, p: Lp }, to: { knee: k }, o0: Lp, d0: nrm(sub3(K0, Lp)) });
    partGroup('edMech' + k + '_brace1', b => {
      KT.taper(b.steel, S, K0, MECH.rBrace, MECH.rBrace * 0.85, 12);
      KT.revolve(b.steel, KT.off(S, pn, -0.012), pn, [[0.017, 0], [0.017, 0.024]], 14, true);
    });
    partGroup('edMech' + k + '_brace2', b => {
      KT.taper(b.steel, Lp, K0, MECH.rBrace, MECH.rBrace * 0.85, 12);
      KT.revolve(b.steel, KT.off(Lp, pn, -0.012), pn, [[0.017, 0], [0.017, 0.024]], 14, true);
      KT.revolve(b.bronze, KT.off(K0, pn, -0.020), pn, [[0.008, 0], [0.008, 0.040]], 10, true);      // the knee's pin
      KT.revolve(b.steel, KT.off(K0, pn, -0.012), pn, [[0.016, 0], [0.016, 0.024]], 14, true);
    });
    const legUp = nrm(sub3(h, ax));
    // (GR: the brace's fitting drawn by fittingsDraw once the well's ceiling is known; the Catalina's on the hull's side)
    if (catM) for (const sg of [-1, 1]) KT.lug(fix.alloy, KT.off(S, pn, sg * 0.018), pn, legUp, 0.020, 0.008, 0.040);
    else fits.push({ c: S.slice(), pax: pn.slice(), w: 0.018, r: 0.020, t: 0.008, kind: 'brace' });
    KT.revolve(fix.bronze, KT.off(S, pn, -0.026), pn, [[0.007, 0], [0.007, 0.052]], 10, true);
    onLeg(k, b => {
      for (const sg of [-1, 1]) KT.lug(b.alloy, KT.off(Lp, pn, sg * 0.018), pn, sub3(h, Lp), 0.020, 0.008, 0.030);
      KT.revolve(b.bronze, KT.off(Lp, pn, -0.026), pn, [[0.007, 0], [0.007, 0.052]], 10, true);
    });
    info[k] = Object.assign({ S, Lp, D }, info.knee != null ? { knee: info.knee } : {}); delete info.knee;
    // THE ACTUATOR (the Catalina's works its strut from inside the hull: none drawn)
    if (act === 2 || catM) continue;
    // GR R2 (the user: "you have your piston still sticking out at the end"): THE BASE IS PLACED INSIDE - searched along
    // the actuator point's stowed line from the trunnion (2.8 .. 1.5 x its offset) and turned off it in the swing plane
    // (0, +-15, +-30, +-45 deg), the first whose base AND barrel (stowed, to the leg) are 8 mm inside the structure and
    // whose stroke is a real cylinder's; none: the deepest with a real stroke, and the fit's 'actuator' turns red
    const La = legPt(MECH.actPt), Lu = up(La);
    const swAx = C.turns.length ? C.turns[0].axis : nrm(crs(legUp0, [1, 0, 0]));
    const stroke = A0 => { let lo = Infinity, hi = -Infinity;
      for (let i = 0; i <= 32; i++) { const d = dist(A0, CM.gearUnitPt(C, CM.gearFoldPose(C, 1 - i / 32), La)); lo = Math.min(lo, d); hi = Math.max(hi, d); }
      return { lo, hi, ok: hi <= 2 * lo - 0.06 }; };
    let pick = null;
    for (const kk of [2.8, 2.4, 2.0, 1.7, 1.5]) for (const ph of [0, 15, -15, 30, -30, 45, -45]) {
      const q = CM.gearApp(CM.gearRot(swAx, ph * Math.PI / 180), sub3(Lu, h)), A0 = [h[0] + q[0] * kk, h[1] + q[1] * kk, h[2] + q[2] * kk];
      const st = stroke(A0);
      if (!st.ok) continue;
      let dep = SP ? Infinity : 1;
      if (SP) for (let i = 0; i <= 4; i++) dep = Math.min(dep, SP.inside(lerp(A0, Lu, i / 4)));
      const cand = { A: A0, st, dep };
      if (dep >= 0.008) { pick = cand; break; }
      if (!pick || dep > pick.dep) pick = cand;
    }
    if (pick && pick.dep >= 0.008) { /* found */ }
    const A = pick ? pick.A : lerp(h, Lu, MECH.actK);
    const st0 = pick ? pick.st : stroke(A);
    let Lmin = st0.lo, Lmax = st0.hi;
    const Lb = Lmin - 0.03, Lrod = Lmax - Lb + 0.03, d0 = nrm(sub3(La, A));
    const rc = MECH.rCyl[act === 1 ? 1 : 0], an = nrm(crs(d0, pn));
    Object.assign(info[k], { A, La, Lmin, Lmax, Lb, Lrod, ok: Lmax <= 2 * Lmin - 0.06, inside: pick ? +pick.dep.toFixed(3) : null });
    R.parts.push({ name: 'edMech' + k + '_cyl', rule: 'aim', from: { fix: A }, to: { unit: k, p: La }, o0: A, d0 },
                 { name: 'edMech' + k + '_rod', rule: 'aim', from: { unit: k, p: La }, to: { fix: A }, o0: La, d0: d0.map(x => -x) });
    partGroup('edMech' + k + '_cyl', b => {
      // hydraulic: the barrel, its end caps and the two hose bosses; electric: the screw jack's tube, the motor on it
      KT.revolve(b.alloy, A, d0, [[0.010, 0], [rc, 0.018], [rc, Lb - 0.012], [rc * 0.8, Lb]], 18, true);
      KT.revolve(b.steel, KT.off(A, pn, -0.010), pn, [[0.015, 0], [0.015, 0.020]], 12, true);   // the base eye
      if (act === 1) for (const f of [0.15, 0.85]) KT.revolve(b.dark, KT.off(A, d0, Lb * f), an, [[0.006, rc - 0.004], [0.006, rc + 0.014]], 8, true);
      else KT.boxIn(b.dark, KT.off(KT.off(A, d0, 0.06), an, rc + 0.030), [0.045, 0.030, 0.030], d0, an, pn);
    });
    partGroup('edMech' + k + '_rod', b => {
      const rd = d0.map(x => -x);
      KT.revolve(act === 1 ? b.chrome : b.steel, La, rd, [[MECH.rRod, 0], [MECH.rRod, Lrod]], 12, true);
      KT.revolve(b.steel, KT.off(La, pn, -0.010), pn, [[0.013, 0], [0.013, 0.020]], 12, true);  // the rod's eye
    });
    fits.push({ c: A.slice(), pax: pn.slice(), w: 0.016, r: 0.018, t: 0.007, kind: 'actuator' });
    KT.revolve(fix.bronze, KT.off(A, pn, -0.023), pn, [[0.006, 0], [0.006, 0.046]], 10, true);     // its pin
    onLeg(k, b => { for (const sg of [-1, 1]) KT.lug(b.alloy, KT.off(La, pn, sg * 0.016), pn, sub3(h, La), 0.018, 0.007, 0.026); });
  }
  for (const q in fix) if (fix[q].tris) fix[q].mesh(group, M(q));
  return { R, info, fits };
}
// GR (the user: "you have a metal plate sticking 90 degrees out of the fuselage ... you need to have like a triangle
// structure so that you can have another plate that comes flat on the fuselage"): THE FIXED PIVOTS' FITTINGS - each
// trunnion, brace anchor and actuator anchor hangs from the structure ABOVE it: the well's flat ceiling over its plan
// place (the body's, the wing's, the nacelle's - capped under a skin), else 50 mm up. Two lugs from the pin, a block
// between their roots where the drop is longer than a lug, a base plate flat on the ceiling with four bolts, and a
// triangular gusset outside each lug from the lug to the plate
function fittingsDraw(fits, fit, group, KT) {
  if (!fits || !fits.length || !KT) return;
  const al = KT.Bag(), dk = KT.Bag(), up = [0, 1, 0];
  const cutsAll = fit ? [].concat(fit.cuts || [], fit.cutsWing || [], fit.cutsNac || []) : [];
  const inHull = (H, z, x) => H.every((a, i) => { const b = H[(i + 1) % H.length]; return (b[0] - a[0]) * (x - a[1]) - (b[1] - a[1]) * (z - a[0]) >= -1e-9; });
  const ceilAt = c => {
    let best = null;
    for (const w of cutsAll) { if (!w.hull || !w.hf || !inHull(w.hull, c[2], c[0])) continue;
      const H = w.hf, i = Math.max(0, Math.min(H.nx - 1, Math.round((c[0] - H.x0) / H.d))), j = Math.max(0, Math.min(H.nz - 1, Math.round((c[2] - H.z0) / H.d)));
      const y = H.y[j * H.nx + i]; if (y > c[1] + 0.015 && (best == null || y < best)) best = y; }
    return best;
  };
  const prism = (A, B, C, n, th) => {        // a triangle plate th thick along n
    const o = v => [v[0] + n[0] * th / 2, v[1] + n[1] * th / 2, v[2] + n[2] * th / 2], u = v => [v[0] - n[0] * th / 2, v[1] - n[1] * th / 2, v[2] - n[2] * th / 2];
    const a1 = al.v(o(A)), b1 = al.v(o(B)), c1 = al.v(o(C)), a2 = al.v(u(A)), b2 = al.v(u(B)), c2 = al.v(u(C));
    al.tri(a1, b1, c1); al.tri(a2, c2, b2); al.quad(a1, a2, b2, b1); al.quad(b1, b2, c2, c1); al.quad(c1, c2, a2, a1);
  };
  for (const F of fits) {
    const c = F.c, pax = KT.nrm(F.pax), side = KT.nrm(KT.crs(pax, up));
    if (!isFinite(side[0])) continue;
    const yc = ceilAt(c), reach = Math.max(0.025, Math.min(0.40, yc != null ? yc - c[1] : 0.05));
    const lugR = Math.min(reach, 0.055), at = d => KT.off(c, up, d);
    for (const s of [-1, 1]) KT.lug(al, KT.off(c, pax, s * F.w), pax, up, F.r, F.t, lugR);
    // the block between the lugs' roots and the plate (a long drop)
    if (reach > lugR + 0.004) KT.boxIn(al, at((lugR + reach) / 2), [F.w + F.t / 2, (reach - lugR) / 2, F.r * 0.72], pax, up, side);
    // the base plate, flat on the structure, and its four bolts (their heads under it)
    const pw = F.w + F.t / 2 + 0.026, pd = F.r + 0.012;
    KT.boxIn(al, at(reach - 0.003), [pw, 0.003, pd], pax, up, side);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      KT.bolt(dk, KT.off(KT.off(at(reach - 0.006), pax, sx * (pw - 0.008)), side, sz * (pd - 0.008)), up, 0.004, 0.008);
    // the gussets: outside each lug, from its root on the plate down the lug, and out along the plate
    const gh = Math.min(reach * 0.75, 0.05), gw = 0.020;
    for (const s of [-1, 1]) { const x0 = s * (F.w + F.t / 2 + 0.0015);
      prism(KT.off(at(reach - 0.006), pax, x0), KT.off(at(reach - 0.006), pax, x0 + s * gw), KT.off(at(reach - 0.006 - gh), pax, x0), side, 0.004); }
  }
  if (al.tris) al.mesh(group, GG.gearMat('alloy'));
  if (dk.tris) dk.mesh(group, GG.gearMat('dark'));
}

// ---- G6 (RETRACT-STUDY §8.13): THE DOORS - the skin the wells took out, given back as doors ------------------------
// The user (5 Nov): "Most of the fuselage actually goes onto the leg that retracts, and only a little part is left as a
// door that needs to open and close ... Did you keep the square cut option? This one could have simple doors based on
// the square cut; One, or 2, slitting in the middle". Per cut, its PATCH - the skin's down-facing faces clipped to the
// outline in plan, exactly (the body's sheet, or a wing skin outside the body) - is shared out:
//   THE LEG DOOR (exact outline, gearLegDoor on): the part inside each unit's stowed plan footprint - its leg and the
//   wheel's half on the trunnion's side, short of the axle (GR: a door down to the tyre would meet the ground) -
//   carried by the unit (rigid): drawn where the leg holds it gear down, it lands flush in the opening when the gear is up;
//   THE WELL DOORS (gearDoors: none, one, two split along the well's long axis): the rest (or the whole box), each
//   hinged on its outer long edge, opening down (DOOR_ANG). They open as the gear leaves either end and close once it
//   is up; gear down they close too unless the down gear passes through them (then they stand open).
// Each door is a panel of the skin's own finish over a dark inner face, posed by the core's rule 'door' (gearMechPose).
const DOOR_ANG = 85 * Math.PI / 180, DOOR_SEQ = 0.15, DOOR_IN = 0.004;
// a convex polygon (3D points) clipped in plan (u, v) = (z, -x) to the left of a -> b
function planClip(poly, a, b, off) {
  // (GR R1: `off` metres further in - the seam)
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, o = (off || 0) * L;
  const sd = p => (b[0] - a[0]) * (-p[0] - a[1]) - (b[1] - a[1]) * (p[2] - a[0]) - o;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], dp = sd(p), dq = sd(q);
    if (dp >= 0) out.push(p);
    if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]); }
  }
  return out.length >= 3 ? out : null;
}
const clipConvex = (poly, hull, off) => { let p = poly; for (let i = 0; i < hull.length && p; i++) p = planClip(p, hull[i], hull[(i + 1) % hull.length], off); return p; };
// the pieces of a polygon outside a convex hull grown by `gap` (the part inside each edge in turn carried on)
function minusConvex(poly, hull, gap) {
  const outs = []; let rest = poly;
  for (let i = 0; i < hull.length && rest; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const o = planClip(rest, b, a, gap || 0); if (o) outs.push(o);
    rest = planClip(rest, a, b, -(gap || 0));
  }
  return outs;
}
const DOOR_SEAM = 0.004;       // GR R1 (the user: "you need to leave a gap in your opening"): every door's edge, 4 mm in
const polyArea = ps => { let a = 0; for (const p of ps) for (let i = 1; i + 1 < p.length; i++) {
  const u = [p[i][0] - p[0][0], p[i][1] - p[0][1], p[i][2] - p[0][2]], v = [p[i + 1][0] - p[0][0], p[i + 1][1] - p[0][1], p[i + 1][2] - p[0][2]];
  a += 0.5 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]); } return a; };
// a skin's faces facing down (Newell) whose plan box meets the outline's, clipped to it
function doorPatch(faces, outline) {
  let z0 = Infinity, z1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  for (const p of outline) { z0 = Math.min(z0, p[0]); z1 = Math.max(z1, p[0]); x0 = Math.min(x0, -p[1]); x1 = Math.max(x1, -p[1]); }
  const out = [];
  for (const f of faces) {
    let fx0 = Infinity, fx1 = -Infinity, fz0 = Infinity, fz1 = -Infinity, nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length];
      fx0 = Math.min(fx0, a[0]); fx1 = Math.max(fx1, a[0]); fz0 = Math.min(fz0, a[2]); fz1 = Math.max(fz1, a[2]);
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
    // (Newell's normal: a door's face looks DOWN - more than 24 degrees off the vertical; a spar's closing face, a
    // trailing edge's lip, is not the door's)
    if (ny >= -0.4 * Math.hypot(nx, ny, nz) || fx1 < x0 || fx0 > x1 || fz1 < z0 || fz0 > z1) continue;
    const c = clipConvex(f, outline, DOOR_SEAM);
    if (c) out.push(c);
  }
  // (GR: a cowl is shells in shells - its skin, its inlets' ducts, its lips: only the OUTERMOST down-facing skin over
  // each plan place is the door's - a face more than 15 mm over the lowest face on a 3 cm plan grid is an inner one)
  const cell = p => { let z = 0, x = 0; for (const q of p) { z += q[2]; x += q[0]; } return Math.round(z / p.length / 0.03) + ':' + Math.round(x / p.length / 0.03); };
  const yOf = p => p.reduce((a, q) => a + q[1], 0) / p.length, lo = new Map();
  for (const p of out) { const k = cell(p), y = yOf(p); if (!lo.has(k) || y < lo.get(k)) lo.set(k, y); }
  return out.filter(p => yOf(p) <= lo.get(cell(p)) + 0.015);
}
const DOOR_SKIN = new Set(['body', 'taper', 'taperPanel', 'waistband', 'floorLoop', 'ceilingLoop', 'pillarWindow',
  'pillarCabin', 'pillarPassenger', 'pillarTail', 'pillarFront', 'pillarTaper', 'boomTube']);
function doorBuild(P, fit, mech, swing, ctx, group, FS, AF, KT, CM) {
  const out = [];
  if (!fit || !mech || !KT || !CM) return out;
  const nDoors = Math.round(P.gearDoors == null ? 2 : +P.gearDoors), legOn = +P.gearWellCut !== 1 && (P.gearLegDoor == null || +P.gearLegDoor === 1);
  if (!nDoors && !legOn) return out;
  // the skins' faces, metres: the fuselage's sheet (its skin sections) and the wing's skin meshes outside the body
  const bodyF = [], wingF = [];
  let bodyMat = null, wingMat = null;
  const MS = ctx.mesh;
  if (MS && MS.V && MS.F) for (const f of MS.F) if (f.v.length >= 3 && DOOR_SKIN.has(f.m) && !f.knife && !f.cutOff)
    bodyF.push(f.v.map(i => [MS.V[i][0] * FS, MS.V[i][1] * FS, MS.V[i][2] * FS]));
  ctx.scene.traverse(o => {
    if (!o.isMesh || !o.userData) return;
    if (o.userData.matNames && !bodyMat) { const k = o.userData.matNames.indexOf('body'); if (k >= 0) bodyMat = Array.isArray(o.material) ? o.material[k] : o.material; }
    if (!o.userData.wingSkin || o.position.lengthSq() > 1e-12) return;
    if (!wingMat) wingMat = o.material;
    const g = o.userData.wellGeo0 || o.geometry, p = g.attributes.position, ix = g.index ? g.index.array : null, n = (ix ? ix.length : p.count) / 3;
    for (let t = 0; t < n; t++) {
      const f = [0, 1, 2].map(q => { const i = ix ? ix[t * 3 + q] : t * 3 + q; return [p.getX(i), p.getY(i), p.getZ(i)]; });
      const cx = (f[0][0] + f[1][0] + f[2][0]) / 3, cz = (f[0][2] + f[1][2] + f[2][2]) / 3;
      if (AF && cz >= AF.z0 && cz <= AF.z1 && Math.abs(cx) < AF.halfWAt(cz)) continue;    // (inside the body: hidden)
      wingF.push(f);
    }
  });
  const darkM = (window.CAGE_MAT_OF && window.CAGE_MAT_OF('wheelWell')) || GG.gearMat('dark');
  // each unit's LEG DOOR SHARE, its stowed plan footprint (u, v) = (z, -x): the leg from its trunnion and the wheel's half
  // on the trunnion's side of the axle, short of it by a fifth of the radius (GR, the user: "you put the whole part of
  // the cut on top of the wheel, of course, then the wheel wouldn't be able to roll because that would hit the ground ...
  // until half of the wheel or something like that. And the other cut part that remains has to be a little opening door")
  // - gear down the leg door ends over the axle, a radius clear of the ground; the rest is the well's doors
  const foot = {};
  for (const k in swing) { const C = swing[k], h = C.hinge, ax = C.axle, ld = fNrm([ax[0] - h[0], ax[1] - h[1], ax[2] - h[2]]);
    const cut = (ax[0] - h[0]) * ld[0] + (ax[1] - h[1]) * ld[1] + (ax[2] - h[2]) * ld[2] - 0.2 * C.R;
    const near = wheelRims(C, 32, [1, 0.6]).filter(p => (p[0] - h[0]) * ld[0] + (p[1] - h[1]) * ld[1] + (p[2] - h[2]) * ld[2] <= cut);
    // (the leg from a quarter of the way down: its root is in the structure, by the trunnion)
    const L4 = 0.25 * Math.hypot(ax[0] - h[0], ax[1] - h[1], ax[2] - h[2]);
    const leg = legTube(C).filter(p => { const t = (p[0] - h[0]) * ld[0] + (p[1] - h[1]) * ld[1] + (p[2] - h[2]) * ld[2]; return t >= L4 && t <= cut; });
    const up = poseAll(C, near.concat(leg), 0);
    if (up.length >= 3) foot[k] = wellOutline(up.map(p => [p[2], -p[0]]), 'exact', 0.01); }
  // the points the down gear holds through the skin (a well door over them cannot close gear down)
  // (the down gear's lines: the leg from its trunnion to its axle, and each 6-point run of the mechanism's links)
  const downLines = k => { const C = swing[k], h = C.hinge, ax = C.axle, m = wellMechPts({ R: mech.R, CM }, k, 1), out = [[h, ax]];
    for (let i = 0; i + 5 < m.length; i += 6) out.push(m.slice(i, i + 6));
    return out; };
  const panel = (name, polys, front, xf) => {          // a door's panel: the skin's face, a dark face 4 mm in (flush, then placed)
    const fb = KT.Bag(), bb = KT.Bag(), X = xf || (v => v);
    for (const p0 of polys) {
      const a = p0.map(q => fb.v(X(q))), b = p0.map(q => bb.v(X([q[0], q[1] + DOOR_IN, q[2]])));
      const p = p0;
      for (let i = 1; i + 1 < p.length; i++) { fb.tri(a[0], a[i], a[i + 1]); bb.tri(b[0], b[i + 1], b[i]); }
    }
    const gp = new THREE.Group(); gp.name = name;
    fb.mesh(gp, front || GG.gearMat('alloy')); bb.mesh(gp, darkM);
    group.add(gp);
  };
  // GR: THE NACELLES' doors - their skin's faces (the cowl units' skin meshes, the layer's frame), their wells, their finish
  const nacF = []; let nacMat = null;
  { const inv = new THREE.Matrix4().copy(ctx.scene.matrixWorld).invert(), M4 = new THREE.Matrix4(), vv = new THREE.Vector3();
    for (const N of NACS) for (const o of N.meshes) {
      if (o.userData.innerTwin) continue;
      if (!nacMat) nacMat = o.material;
      M4.multiplyMatrices(inv, o.matrixWorld);
      const g = o.userData.wellGeo0 || o.geometry, pa = g.attributes.position, ix = g.index ? g.index.array : null, n = (ix ? ix.length : pa.count) / 3;
      for (let t = 0; t < n; t++) nacF.push([0, 1, 2].map(q => { vv.fromBufferAttribute(pa, ix ? ix[t * 3 + q] : t * 3 + q).applyMatrix4(M4); return [vv.x, vv.y, vv.z]; }));
    } }
  const sets = [['B', fit.cuts || [], bodyF, bodyMat], ['W', fit.cutsWing || [], wingF, wingMat], ['N', fit.cutsNac || [], nacF, nacMat]];
  for (const [tag, cuts, faces, mat] of sets) cuts.forEach((c, ci) => {
    const outline = c.hull.map(p => [p[0], -p[1]]);                  // the gear layer's (z, x) hull -> (z, -x), then CCW
    let a2 = 0; for (let i = 0; i < outline.length; i++) { const p = outline[i], q = outline[(i + 1) % outline.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
    if (a2 < 0) outline.reverse();
    let rest = doorPatch(faces, outline);
    // GR R4: where a stowed wheel stands proud of this skin, the doors are cut round it (its section, the seam round it)
    for (const pb of ((fit.pierce && fit.pierce.bottom) || [])) if (c.units.includes(pb.unit)) rest = rest.flatMap(p => minusConvex(p, pb.outline, DOOR_SEAM));
    if (!rest.length) return;
    // THE LEG DOORS: each unit's share, carried by the unit - drawn where the down leg holds it
    if (legOn) for (const k of c.units) {
      if (!swing[k] || !foot[k]) continue;
      const mine = [], left = [];
      for (const p of rest) { const i = clipConvex(p, foot[k], DOOR_SEAM / 2); if (i) mine.push(i); left.push(...minusConvex(p, foot[k], DOOR_SEAM / 2)); }
      if (polyArea(mine) < 0.002) continue;
      rest = left;
      const C = swing[k], M0 = CM.gearFoldPose(C, 0), h = C.hinge;
      const back = v => { const d = [v[0] - h[0], v[1] - h[1], v[2] - h[2]];   // the stowed pose undone (M0 transposed)
        return [h[0] + M0[0] * d[0] + M0[3] * d[1] + M0[6] * d[2], h[1] + M0[1] * d[0] + M0[4] * d[1] + M0[7] * d[2], h[2] + M0[2] * d[0] + M0[5] * d[1] + M0[8] * d[2]]; };
      const name = 'edMechDoor' + k + '_leg' + tag + ci;
      panel(name, mine, mat, back);
      mech.R.parts.push({ name, rule: 'rigid', unit: k, o0: h.slice() });
      out.push({ name, kind: 'leg', unit: k, area: polyArea(mine) });
    }
    // THE WELL DOORS: the rest, one or two (split along the well's long axis), hinged on their outer long edges
    if (!nDoors || polyArea(rest) < 0.002) return;
    const uv = []; for (const p of rest) for (const q of p) uv.push([q[2], -q[0]]);
    let mu = 0, mv = 0; for (const q of uv) { mu += q[0] / uv.length; mv += q[1] / uv.length; }
    let suu = 0, svv = 0, suv = 0; for (const q of uv) { suu += (q[0] - mu) ** 2; svv += (q[1] - mv) ** 2; suv += (q[0] - mu) * (q[1] - mv); }
    const th = 0.5 * Math.atan2(2 * suv, suu - svv), e1 = [Math.cos(th), Math.sin(th)], e2 = [-e1[1], e1[0]];
    const ca = [mu, mv], cb = [mu + e1[0], mv + e1[1]];
    const halves = nDoors === 2 ? [rest.map(p => planClip(p, ca, cb, DOOR_SEAM / 2)).filter(Boolean), rest.map(p => planClip(p, cb, ca, DOOR_SEAM / 2)).filter(Boolean)] : [rest];
    halves.forEach((hp, di) => {
      if (polyArea(hp) < 0.001) return;
      // the outer long edge: two doors - each its own side (e2 / -e2); one door - the side away from the centreline
      let nOut = nDoors === 2 ? (di === 0 ? e2 : [-e2[0], -e2[1]]) : e2;
      const proj = q => (q[2] - mu) * nOut[0] + (-q[0] - mv) * nOut[1];
      if (nDoors !== 2) { const xs = s => { let m = -Infinity, ax = 0; for (const p of hp) for (const q of p) if (s * proj(q) > m) { m = s * proj(q); ax = q[0]; } return Math.abs(ax); };
        if (xs(-1) > xs(1) + 1e-6) nOut = [-nOut[0], -nOut[1]]; }
      let mx = -Infinity; for (const p of hp) for (const q of p) mx = Math.max(mx, proj(q));
      const edge = []; for (const p of hp) for (const q of p) if (proj(q) > mx - 0.012) edge.push(q);
      const hinge = [0, 1, 2].map(i => edge.reduce((s, q) => s + q[i], 0) / edge.length);
      let axis = [-e1[1], 0, e1[0]];                                   // (u, v) = (z, -x): the plan direction e1 in 3D
      const cen = [0, 1, 2].map(i => { let s = 0, n = 0; for (const p of hp) for (const q of p) { s += q[i]; n++; } return s / n; });
      const R1 = CM.gearRot(axis, 0.1), d = [cen[0] - hinge[0], cen[1] - hinge[1], cen[2] - hinge[2]];
      if (hinge[1] + CM.gearApp(R1, d)[1] > cen[1]) axis = axis.map(x => -x);     // + opens it DOWN
      // gear down: closed unless the down gear passes through it
      const hull = (() => { const pz = []; for (const p of hp) for (const q of p) pz.push([q[2], -q[0]]); return wellOutline(pz, 'exact', 0.005); })();
      let y0 = Infinity, y1 = -Infinity; for (const p of hp) for (const q of p) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
      // (GR: the down gear passes THROUGH the door when one of its lines - the leg, the brace's links, the actuator -
      // crosses the door's own surface inside it; a trunnion or a brace anchor above it, in the structure, does not)
      const surfY = q => { const u = q[2], v = -q[0];
        for (const p of hp) for (let i = 1; i + 1 < p.length; i++) { const A = p[0], B = p[i], Cc = p[i + 1];
          const ax = A[2], ay = -A[0], bx = B[2], by = -B[0], cx = Cc[2], cy = -Cc[0], den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
          if (Math.abs(den) < 1e-12) continue;
          const l1 = ((by - cy) * (u - cx) + (cx - bx) * (v - cy)) / den, l2 = ((cy - ay) * (u - cx) + (ax - cx) * (v - cy)) / den, l3 = 1 - l1 - l2;
          if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * A[1] + l2 * B[1] + l3 * Cc[1]; }
        return null; };
      const crosses = line => { for (let i = 0; i + 1 < line.length; i++) { const a = line[i], b = line[i + 1];
          for (let t = 0; t <= 4; t++) { const f0 = t / 4, f1 = (t + 1) / 4; if (t === 4) break;
            const p0 = [a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0, a[2] + (b[2] - a[2]) * f0], p1 = [a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1, a[2] + (b[2] - a[2]) * f1];
            const s0 = surfY(p0), s1 = surfY(p1);
            if (s0 != null && Math.abs(p0[1] - s0) < 0.012) return true;
            if (s0 != null && s1 != null && (p0[1] - s0) * (p1[1] - s1) < 0) return true; } }
        return false; };
      const through = c.units.some(k => swing[k] && downLines(k).some(crosses));
      const name = 'edMechDoor' + tag + ci + '_' + (di + 1), seq = { k: DOOR_SEQ, closedDown: !through };
      // drawn as it stands gear down (every part's rest): a door the down gear passes through stands open
      const Rd = CM.gearRot(axis, DOOR_ANG * CM.gearDoorOpen(seq, 1));
      panel(name, hp, mat, v => { const q = CM.gearApp(Rd, [v[0] - hinge[0], v[1] - hinge[1], v[2] - hinge[2]]); return [hinge[0] + q[0], hinge[1] + q[1], hinge[2] + q[2]]; });
      mech.R.parts.push({ name, rule: 'door', hinge, axis, ang: DOOR_ANG, seq, o0: hinge.slice() });
      out.push({ name, kind: 'well', units: c.units.slice(), area: polyArea(hp), closedDown: !through });
    });
  });
  return out;
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
  const { scene, mesh, P, stat } = ctx;
  dispose(group); group = null;
  if (!P.gearOn) return;

  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const AF = GG.cageAirframe(mesh, FS);
  if (!AF) { if (stat) stat.textContent += '  ·  gear: no skin to stand on'; return; }
  // THE LEGS STAND ON THE DRAWN SKIN (G304, the fitment study P2): the
  // table the contract interpolates is ±3.5 mm off across a crease (the
  // strut foot's lesson, _strut_gen.js §3), and a doubler draped over the
  // floor-loop corner sat 6-8 mm inside it (GATE CLIP). `strutSkin` over
  // the whole body — the same contract with an exact radius — is what the
  // leg builders draw against; the table is still what is PUBLISHED
  // (CAGE_GEAR.AF: solidAt, open, the fitting sites every other layer asks).
  const AFx = GG.exactAirframe ? GG.exactAirframe(AF) : AF;

  group = new THREE.Group();
  // NAMED for the editor (G76/G77): the part table says which layer a
  // part lives in, and G79's raycast resolves a hit to a part through
  // that. One string, no behaviour.
  group.name = 'cageLayer:gear';
  scene.add(group);

  const bags = {};
  for (const k of ['tyre', 'hub', 'brake', 'brakefix', 'steel', 'alloy',
                   'chrome', 'dark', 'bronze', 'fair'])
    bags[k] = GG.Bag();
  // G58.2: EACH WHEEL GETS ITS OWN BAGS, so the join can ride it on its
  // axle node and SPIN it (G47.2's "per-wheel bags in the gear kit",
  // user: "identify the individual meshes corresponding to the wheel and
  // move those"). A PROXY hands the wheel() call its own bags while the
  // leg, castor fork and spat keep writing into the shared bags — so
  // exactly the parts that turn, turn, and the fork does NOT rotate with
  // the wheel. Zero changes inside the gear kit itself.
  //
  // G148: EVERY bag wheel() writes must be ROUTED, or it is a fuselage-
  // welded part (the shared bags mesh unnamed into the static merge).
  // The old 3-bag proxy left the bolt heads, hub caps, valve stems, the
  // brake caliper and its pipe frozen on the craft — hardware standing
  // mid-air inside a travelling, spinning wheel (the user's circles).
  // Spinning set {tyre,hub,brake,alloy,dark} -> the wheel unit; leg-
  // riding set {brakefix: caliper + pipe} -> that wheel's LEG unit, which
  // travels with the axle without turning. _gear_check §3 pins wheel()'s
  // write-set to exactly this routing. The tailwheel keeps the 3-bag
  // proxy: its call site routes alloy/dark to the leg unit itself.
  const wheelUnits = [];
  const allBags = () => { const b = {};
    for (const k in bags) b[k] = GG.Bag(); return b; };
  const wheelProxy = (lb) => {
    const wb = lb
      ? { tyre: GG.Bag(), hub: GG.Bag(), brake: GG.Bag(),
          alloy: GG.Bag(), dark: GG.Bag() }
      : { tyre: GG.Bag(), hub: GG.Bag(), brake: GG.Bag() };
    wheelUnits.push(wb);
    return { proxy: Object.assign({}, bags,
                                  lb ? { brakefix: lb.brakefix } : null, wb),
             wb };
  };
  // G58.3: the LEGS are separable units too — the join stretch-binds them
  // between their airframe attachment and the moving axle, so the
  // suspension visually compresses and stays lined up with the wheel.
  // The tailwheel additionally splits its CASTOR assembly (fork), which
  // yaws for ground manoeuvring; its leaf SPRING stays in the leg unit.
  const legUnits = [];
  let castorUnitOut = null;

  // IDENTICAL to the bench's loop, deliberately: if this had to be written
  // differently to run on a real body, the contract would not be one.
  // (One cage-side remap first: tailwheel stations are TAIL-RELATIVE —
  // see the defaults note above. The bench keeps absolute stations.)
  NACS = nacellesOf(scene);                       // GR: this build's nacelles (the mounts, the probe, the fold, the cuts)
  const stations = GP.gearStations(P);
  // RETRACT-1: a retracting gear is drawn bare (no spat, no trouser, no leg shroud: noRet above)
  if (GEAR_RETRACTABLE(P)) for (const st of stations) { st.fair = 0; st.legFair = 0; }
  // G3800 (TAILWHEELS, the user 3 Nov: "one wheel per boom, same settings for the twin planes"): on TWIN BOOMS the
  // tailwheel is a pair, one under each boom's tail end (CAGE_BOOMS, the wing layer's; tail-relative to the boom's own
  // end as it is to the pod's on a single body), the same row for both
  const TBg = (+P.boomTwin && typeof window !== 'undefined' && window.CAGE_BOOMS && window.CAGE_BOOMS.yBot) ? window.CAGE_BOOMS : null;
  for (const st of stations)
    if (st.leg === 3) st.z = (TBg ? TBg.zTip : AF.z0) + Math.max(0.02, st.z);
  // G3800: THE INVERTED V (the stab layer's mount 4): the tail's contacts at the panel tips - x the gap's half, y the
  // boom's centre less the panel's drop (cant, the booms' half-track less the half gap), z the tip the stab layer drew
  // on the last build (window.CAGE_IV_TIPS, metres; it draws after this layer) or a quarter metre ahead of the boom end
  const IVD = window.CAGE_IV_DIR ? window.CAGE_IV_DIR(P) : { up: false, out: false };   // G3801: the way
  const IVg = !!TBg && Math.round(+P.stMount || 0) === 4 && +P.stOn !== 0 && !IVD.up;   // (an upward V: the booms' wheels)
  const tipMount = (st, sgn) => {
    if (!IVg || st.leg !== 3) return null;
    const gap = window.CAGE_IV_GAP ? window.CAGE_IV_GAP(P) : 0.30, G = Math.max(20, Math.min(55, +P.stCant || 35)) * D2R;
    const pub = window.CAGE_IV_TIPS && window.CAGE_IV_TIPS.find(q => Math.sign(q[0]) === sgn);
    const z = pub ? pub[2] : TBg.zTip + 0.25;
    const reach = window.CAGE_IV_REACH ? window.CAGE_IV_REACH(P, TBg.x) : TBg.x - 0.5 * gap;
    const y = pub ? pub[1] : 0.5 * (TBg.yTop(z) + TBg.yBot(z)) - reach * Math.tan(G);
    const x0 = IVD.out ? (pub ? pub[0] : sgn * (TBg.x + reach)) : sgn * 0.5 * gap;
    const provider = () => ({ p: [x0, y, z], n: [0, -1, 0], fore: [0, 0, 1], side: [1, 0, 0] });
    provider.x0 = x0; provider.tip = true;
    return provider;
  };
  const boomMount = (st, sgn) => {
    if (!TBg || st.leg !== 3) return null;
    if (IVg) return tipMount(st, sgn);
    const x0 = sgn * TBg.x;
    const provider = (zOff, dx) => {
      const z = st.z + (zOff || 0);
      return { p: [x0 + (dx || 0), TBg.yBot(z), z], n: [0, -1, 0], fore: [0, 0, 1], side: [1, 0, 0] };
    };
    provider.x0 = x0; provider.keelAt = z => TBg.yBot(z);
    return provider;
  };
  // GR: THE GEAR NACELLES - a nacelle too short or too shallow for its folded mains grows its bay (nacPodBuild)
  const pods = [];
  // (GR, the user: "the enormous pod you've created is also unacceptable ... We could have a stand-alone pod option, but
  // separate": the pod is that option only - gearNacPod 1; the nacelle itself is fitted to the gear by the cowl layer,
  // _cage_cowl.js nacGearFit, gearNacFit)
  if (GEAR_RETRACTABLE(P) && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'nacelle' && Math.round(+P.gearNacPod || 0) === 1) {
    const W0 = window.CAGE_WING, WL = W0 && W0.planes ? (W0.planes[W0.lowest] || W0) : W0, under = WL && WL.underAt ? WL.underAt : null;
    for (const st of stations) { if (st.single || st.leg === 3) continue;
      for (const sgn of [1, -1]) {
        const x = sgn * st.x, N = NACS.find(n => { if (n.kind === 'cowl') return false; const zc = Math.max(n.z0 + 0.06, Math.min(n.z1 - 0.06, st.z)); return Math.abs(x - n.xc) <= n.AF.halfWAt(zc) + 0.02; });
        if (!N || N.pod) continue;
        const ya = AF.keelAt(st.z) - st.drop;
        const pod = nacPodBuild(N, st, sgn, ya, under, P);
        if (!nacJoinPod(N, pod)) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pod.V.flat(), 3));
        g.setIndex(pod.F.flat()); g.computeVertexNormals();
        const skin = N.meshes.find(o => !o.userData.innerTwin);
        const m = new THREE.Mesh(g, skin ? skin.material : GG.gearMat('alloy'));
        m.name = 'gearNacPod' + (sgn > 0 ? 'L' : 'R');
        group.add(m); N.meshes.push(m); pods.push(m);
      } }
  }
  for (const N of NACS) for (const o of N.meshes) o.userData.nacSkin = o.userData.innerTwin ? 'twin' : 'skin';

  // G133: THE NEAREST SURFACE ABOVE THE WHEEL (user's rule). When the
  // WING'S UNDERSIDE at the axle's own span sits lower than the fuselage
  // section's MIDDLE, the leg roots on the wing instead of the flank — a
  // low-wing's gear is the wing's, automatically, as the track slider
  // walks the wheels outboard. The centreline guard is what keeps a high
  // wing from capturing its gear (a Cub's wing IS the nearest surface
  // straight above its wheels; its legs still belong to the belly).
  // `underAt` is published by the wing layer off its BUILT skin — the
  // load order moved (build.js/dev.html) so the wing builds first and the
  // probe is never one edit stale. The leg builders stay wing-ignorant:
  // they take a mount FRAME, and the axle is keel-datum'd either way, so
  // where the leg roots never moves the wheel, the stance or the join's
  // measured rows.
  // G185: on a biplane the wheel meets the LOWEST plane
  const WCW = (typeof window !== 'undefined' && window.CAGE_WING) || null;
  const WLO = WCW && WCW.planes ? (WCW.planes[WCW.lowest] || WCW) : WCW;
  const WUA = (WLO && WLO.underAt) || null;
  let onWing = 0;
  // THE OPEN-FRAME MOUNT: a frame provider (zOff, dx) -> {p, n, fore, side}
  // like the wing's, over the interior pass's published members
  // (`window.CAGE_MEMBERS`, cage units -> metres). The target is the point the
  // fuselage contract gives — the flank at the family's own angle; the nearest
  // member's surface toward it is the root, the member's direction is `fore`,
  // and `pivot` tells the builders to draw lugs, not a plate. The search
  // itself is GEAR_GEN's `memberFrame`, which the lift struts ask the same
  // question of: one description of "the nearest tube", not two.
  //
  // WHAT MAKES IT FIRE (2026-09-05, the user: the fittings "look for a plate
  // to attach to ... it fails in some cases, resulting in a distorted mesh").
  // It is not "this aeroplane has no covering" — it is "there is no covering
  // HERE". A door taken off (`doorGone`) leaves the flank open at exactly the
  // stations a main leg roots at, and a doubler bolted over an opening is a
  // plate spread across a hole. `solidAt` is the contract's own answer to
  // that, and it is the only thing this asks.
  const openMount = (st, sgn) => {
    const MB = window.CAGE_MEMBERS;
    if (!MB || !MB.length) return null;
    const bare = !(P.skinOn == null || +P.skinOn);
    const cen = st.x <= 0.01;
    const angDeg = cen ? 0
      : st.leg === 0 ? +st.P.beamAng : st.leg === 1 ? +st.P.linkAng
      : st.leg === 2 ? +st.P.oleoAng : 0;
    const ang = sgn * (angDeg || 0) * Math.PI / 180;
    // an airframe that cannot say (the bench's analytic stub) is taken at its
    // word, which is what it has always been taken at
    if (!bare && (!AF.solidAt || AF.solidAt(st.z, ang))) return null;
    // ...AND THERE HAS TO BE A TUBE WITHIN REACH. The published members are
    // the interior pass's; a rod boom is not one of them, so a tailwheel
    // asking at the tailpost was being handed the cabin frame a metre and a
    // half forward. Past a bay's worth of the local body, the leg keeps the
    // surface it does have — which on a rod boom is the rod, and real.
    const reach = Math.max(0.25, AF.halfWAt(st.z) * 1.2);
    if (!GG.memberFrame(MB, AF.surf(st.z, ang), FS, reach)) return null;
    const provider = (zOff, dx) => {
      const z = st.z + (zOff || 0);
      const tgt = AF.surf(z, ang);
      if (dx) tgt[0] += dx;
      return GG.memberFrame(MB, tgt, FS) ||
             { p: tgt, n: [0, -1, 0], fore: [0, 0, 1], side: [1, 0, 0] };
    };
    provider.pivot = true;
    return provider;
  };
  // THE ROD MOUNT (G307, the fitment study P3; the user's ruling: the
  // tailwheel on a rod meets a bolted SADDLE, not a doubler wrapped a
  // quarter of the way round a 120 mm tube). On a single bare tube a
  // station inside the tube's span takes a frame provider on the tube's
  // BELLY, and hands the builder the saddle to draw instead of the pad
  // (`padOn` reads `mount.saddle`): a split collar with a plate under it,
  // the leg's root on the plate. The fin layer, which draws after this one,
  // reads the saddles drawn here (CAGE_GEAR.saddles) and shares the collar.
  const RF = (typeof window !== 'undefined') && window.ROD_FIT;
  const rodSpan = (() => {
    if (!RF || !+P.boomStyle || +P.boomTwin || !CG2 || !CG2.cageResolve) return null;
    try {
      const S = CG2.cageSpec(P), R = CG2.cageResolve(S);
      if (!S.rod || !R.rodSpan) return null;
      // G474: `S.rod.incl` is RADIANS already (_cage_gen cageSpec converts the
      // row); this converted it again, so the saddle's axis line (G307) and
      // the rise below read 1/57 of the inclination - the saddle sat off an
      // inclined tube by the whole rise, and the tailwheel rode it
      const tI = Math.tan(S.rod.incl || 0);
      return { zRoot: R.rodSpan.zRoot * FS, zTip: R.rodSpan.zTip * FS, r: S.rod.r * FS, tI,
               yAx: z => (S.rod.y + tI * (R.rodSpan.zRoot - z / FS)) * FS };
    } catch (e) { return null; }
  })();
  const saddlesOut = [];
  const rodMount = st => {
    if (!rodSpan || st.leg !== 3) return null;
    if (st.z > rodSpan.zRoot - 0.03 || st.z < rodSpan.zTip + 0.03) return null;
    const hS = RF.SADDLE.hS;
    const provider = (zOff, dx) => {
      const z = st.z + (zOff || 0);
      return { p: [dx || 0, rodSpan.yAx(z) - rodSpan.r - hS, z], n: [0, -1, 0],
               fore: [0, 0, 1], side: [1, 0, 0] };
    };
    // (HULL-B37: the collar square to an inclined tube - its axis climbs tI a metre aft)
    provider.saddle = { ctr: [0, rodSpan.yAx(st.z), st.z], axis: [0, rodSpan.tI / Math.hypot(1, rodSpan.tI), -1 / Math.hypot(1, rodSpan.tI)], r: rodSpan.r };
    provider.onDrawn = rec => saddlesOut.push(rec);
    // G474 (playtest item 130, the birdman: "the rod inclination impacts the
    // position of everything related to the tail wheel"): the saddle rides
    // the tube, so an inclined rod (tail up +) lifted the whole tailwheel
    // with it - 0.265 m at 6 deg on the birdman, measured - and the stance
    // solver then dropped the tail until the wheel touched: the row that
    // says "tail up" sat the aeroplane MORE tail-down. The rise of the tube
    // at the station over its root is handed to the leg, which lengthens
    // its spring by it so the wheel's contact stays on the design line.
    provider.rise = rodSpan.yAx(st.z) - rodSpan.yAx(rodSpan.zRoot);
    return provider;
  };
  // GR: THE NACELLE MOUNT - a main station whose wheel is under a nacelle (within its width) roots its leg on the
  // nacelle's bottom, at the station (held inside the nacelle's length, 60 mm in): low wing or high, the leg hangs from
  // the nacelle as it does from a wing's underside (the frame: the nacelle's own table at the bottom, about its centre)
  const nacMount = (st, sgn) => {
    if (!RETR || st.single || st.leg === 3 || !NACS.length) return null;     // (a retracting gear's only: a fixed build as it was)
    const x = sgn * st.x;
    const N = NACS.find(n => { if (n.kind === 'cowl') return false; const zc = Math.max(n.z0 + 0.06, Math.min(n.z1 - 0.06, st.z)); return Math.abs(x - n.xc) <= n.AF.halfWAt(zc) + 0.02; });
    if (!N) return null;
    const prov = (zOff, dx) => {
      const z = Math.max(N.z0 + 0.06, Math.min(N.z1 - 0.06, st.z + (zOff || 0)));
      const F = GG.fitFrame(N.AF, z, 0);
      return { p: [F.p[0] + N.xc, F.p[1], F.p[2]], n: F.n, fore: F.fore, side: F.side };
    };
    prov.nac = N;
    return prov;
  };
  const wingMount = (st, sgn) => {
    if (!WUA || st.x <= 0.01 || st.leg === 3) return null;
    // the WHEEL may sit a little ahead of the leading edge (a low-wing's
    // axle rides forward of the spar) — seek the nearest wing chordwise
    // within 0.6 m of the station, the way a real leg roots at the spar
    // and rakes to its wheel. Beyond that reach the wing is not "above
    // the wheel" in any honest sense and the fuselage keeps the leg.
    let q = null, zBase = st.z;
    for (const dz of [0, -0.1, 0.1, -0.2, 0.2, -0.3, 0.3, -0.45, 0.45,
                      -0.6, 0.6]) {
      q = WUA(sgn * st.x, st.z + dz);
      if (q) { zBase = st.z + dz; break; }
    }
    if (!q || !(q.y < AF.cyAt(st.z))) return null;
    // G133.1 (user): the builders ask for their root a little INBOARD of
    // the wheel (`dx`), above the strut's own foot — so a mounted leg
    // hangs dead straight and the wheel rides its stub axle outboard.
    return (zOff, dx) => {
      const xq = sgn * st.x + (dx || 0);
      let z = zBase + (zOff || 0);
      let w = WUA(xq, z);
      // a foot cannot land ahead of the leading edge it bolts to: walk the
      // request back toward the base until the wing answers
      for (let t = 0.25; t <= 1.001 && !w; t += 0.25) {
        const zt = z + (zBase - z) * t;
        w = WUA(xq, zt);
        if (w) z = zt;
      }
      if (!w) { w = WUA(xq, zBase) || q; z = zBase; }
      let n = (w.n && w.n[1] < -0.2) ? w.n : [0, -1, 0];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / nl, n[1] / nl, n[2] / nl];
      let f = [-n[2] * n[0], -n[2] * n[1], 1 - n[2] * n[2]];
      const fl = Math.hypot(f[0], f[1], f[2]) || 1;
      f = [f[0] / fl, f[1] / fl, f[2] / fl];
      return { p: [xq, w.y, z], n, fore: f,
               side: [n[1] * f[2] - n[2] * f[1], n[2] * f[0] - n[0] * f[2],
                      n[0] * f[1] - n[1] * f[0]] };
    };
  };

  // RETRACT GM1: the trunnion's depth inside the structure and the pin's axis (see the station loop)
  const RETR = GEAR_RETRACTABLE(P);
  const retFits = [];          // GR: the fixed pivots' fittings (the trunnions here, the brace's and actuator's from mechBuild)
  const retMounts = [];        // each retracting leg's structure depth at its trunnion (the fit's 'mount' test)
  const retIn = (st, m) => {
    // (a nacelle's: 45 % of its depth there - the gear bay's middle)
    if (m && m.nac && m.nac.pod) return Math.max(0.04, m.nac.pod.yh - m.nac.AF.keelAt(st.z));   // (a grown bay: its pin)
    if (m && m.nac) { const A = m.nac.AF, z = Math.max(m.nac.z0 + 0.06, Math.min(m.nac.z1 - 0.06, st.z));
      return Math.max(0.04, 0.45 * (A.surf(z, Math.PI)[1] - A.keelAt(z))); }
    // (the Catalina's mains pivot on an EXTERNAL fitting, just outside the hull's skin)
    if (!st.single && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'catalina') return -(0.009 + (+st.P.oleoDia || 0.06) * 0.42);
    const W = window.CAGE_WING;
    if (m && W && W.overAt && W.underAt) {
      const q = m(0, 0), o = W.overAt(q.p[0], q.p[2]), u = W.underAt(q.p[0], q.p[2]);
      if (o && u && o.y > u.y) return Math.max(0.03, (o.y - u.y) / 2);
    }
    if (m) return 0.05;
    const keel = AF.keelAt(st.z), floor = (P.floorY != null ? +P.floorY : -0.5) * FS;
    return Math.max(0.05, Math.min(0.16, 0.45 * (floor - keel)));
  };
  const retPin = st => {
    const F = foldOf(P, !!st.single);
    const t = (F.turns || []).find(T => T && T[1]) || [0, 0];
    return t[0] === 1 ? [1, 0, 0] : t[0] === 2 ? [0, 1, 0] : [0, 0, 1];
  };
  // GR (the Catalina): THE MAINS' PIVOT HIGH ENOUGH ON THE HULL'S SIDE - the leg's root angle round the section raised
  // till the stowed wheel (level with the pin) and its recess clear the turn of the bilge: the pin at least a wheel's
  // radius and the clearance over the lowest point of the side whose outward normal is mostly lateral (|nx| >= 0.85)
  if (RETR && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'catalina') for (const st of stations) {
    if (st.single || st.leg === 3) continue;
    let yLo = Infinity;
    for (let a = 10; a <= 170; a += 2) { const n = AF.nrmAt(st.z, a * D2R), q = AF.surf(st.z, a * D2R); if (Math.abs(n[0]) >= 0.85) yLo = Math.min(yLo, q[1]); }
    if (!isFinite(yLo)) continue;
    const need = yLo + st.R + FIT.clear;
    for (let a = Math.max(20, +st.P.oleoAng || 40); a <= 120; a++) if (AF.surf(st.z, a * D2R)[1] >= need) { st.P.oleoAng = a; break; }
  }
  const contacts = [];
  // G188: the third wheel is the station the table FLAGS single (row 2), not
  // whichever contact happens to sit on the centreline; a tailwheel builder
  // is centreline by construction, so it gets one contact whatever its row's
  // lateral offset says (two identical contacts otherwise).
  const isSingle = st => st.single != null ? !!st.single : st.x <= 0.01;
  for (const st of stations) {
    const sides = (st.leg === 3 && TBg) ? [-1, 1] : (st.leg === 3 || st.x <= 0.01) ? [0] : [-1, 1];
    for (const s of sides) {
      const sgn = s === 0 ? 1 : s;
      let r, rOleo = null, retLow = null, retSc = null;
      const lb = allBags();               // this unit's LEG bags
      const wu = wheelProxy(st.leg === 3 ? null : lb);
      // the fairing's instruments ride the station (G133)
      const fOpt = { full: st.fair === 2, skirt: st.fairSkirt,
                     tail: st.fairTail, rake: st.fairRake, width: st.fairW };
      // NEW-SHAPES-1 (the Camel, 27 Oct): a biplane's V bolts to the fuselage's lower longerons, ahead of and under
      // the lower plane - the low-wing rule below would root it on that plane. `s<i>Root` 1 says the fuselage.
      const bm = boomMount(st, sgn);             // G3800: a twin boom's tailwheel on its boom
      const m = (st.root === 1 || bm) ? null : (nacMount(st, sgn) || wingMount(st, sgn));
      // THE OPEN FRAME (2026-09-04, spec §1.7): with no skin the fuselage
      // contract is a surface that is not there — the leg roots on the
      // nearest truss member instead, with a pivot (see openMount); the
      // low-wing rule still wins where it applies
      const rm = (m || bm) ? null : rodMount(st);
      const om = (m || rm || bm) ? null : openMount(st, sgn);
      if (bm) st.mount = bm;
      else if (m) { st.mount = m; onWing++; }
      else if (rm) st.mount = rm;
      else if (om) st.mount = om;
      else delete st.mount;
      if (st.leg === 3) {
        // G474 (item 130): the rod's rise at this station over its root,
        // whatever the mount (the tailwheel usually sits past the saddle's
        // reach, on the rod's tip cap) - the spring lengthens by it
        if (rodSpan) st.rodRise = rodSpan.yAx(st.z) - rodSpan.yAx(rodSpan.zRoot);
        else delete st.rodRise;
        // legTailwheel builds spring AND wheel into one bag-set; the
        // proxies route the spinning parts to the wheel unit, the fork
        // (and now its spat, G133) to the castor unit, and the spring —
        // with its trouser shroud — stays in the leg unit
        // (G3800: on twin booms the -x boom's fork is THE castor - refs.tw, model z < 0; the other boom's fork is
        // drawn with its leg: it rides its spring, it does not yaw in the picture)
        const cb = allBags();
        const yaws = !TBg || sgn < 0;
        const proxy = Object.assign({}, lb, wu.wb, yaws ? { castorBags: cb } : {});
        // G326: the steering springs run to the RUDDER'S horn, which the
        // hinge layer draws — so it draws the runs too, from the ears the
        // castor publishes below. Without that layer (a bench without it)
        // the castor keeps its own picture.
        st.steerByHinge = !!window.HINGE_GEN;
        r = (st.mount && st.mount.tip && GG.legTipWheel) ? GG.legTipWheel(proxy, AFx, st.P, st)   // G3800: the V's tips
          : GG.legTailwheel(proxy, AFx, st.P, st);
        if (r.castor && yaws)
          castorUnitOut = { bags: cb, top: r.castor.top, ax: r.castor.ax,
                            axle: r.axle, ears: r.castor.ears };
      } else {
        // RETRACT GM1 (§8.11): A RETRACTING LEG IS AN OLEO ON A TRUNNION INSIDE THE STRUCTURE (blade and bungee V do
        // not retract; the join flies it as an oleo) - the pin along the fold's first axis, its point the wing's mid-
        // depth over the leg's root (a low wing's mains) or 45 % of the way from the keel to the cabin floor (a body
        // leg, 50-160 mm); its lugs and fitting plate are the static structure's
        if (RETR) { const catS = !st.single && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'catalina';
                    st.ret = { in: retIn(st, m), pin: retPin(st), fix: bags, flip: catS, fits: catS ? null : retFits };
                    st.leg = 2;
                    // GR: a shortening leg - its piston's own bags (they slide), its cylinder shortened for the travel
                    if (shortRow(P, !!st.single) > 0) { st.ret.low = allBags(); st.P = Object.assign({}, st.P, { oleoCyl: cylFOf(st.P.oleoCyl, P, !!st.single) }); }
                    retMounts.push({ key: st.single ? 'T' : (sgn > 0 ? 'L' : 'R'), wing: !!m, depth: 2 * st.ret.in, z: st.z }); }
        if (st.leg === 0) r = GG.legBeam(lb, AFx, st.P, st, sgn);
        else if (st.leg === 1) r = GG.legLink(lb, AFx, st.P, st, sgn);
        else r = GG.legOleo(lb, AFx, st.P, st, sgn);
        rOleo = r; retLow = st.ret ? st.ret.low || null : null; retSc = st.ret ? st.ret.scissor || null : null;
        if (retLow && wu.proxy) wu.proxy.brakefix = retLow.brakefix;      // (the caliper rides the piston with its wheel)
        // G133: spats ride their UNITS now, not the static shared bags —
        // a nose spat sits on its fork, a main spat on its own leg, so
        // the flown aeroplane carries them with the moving parts
        if (st.steer > 0 && st.x < 0.01) {
          // 2026-09-04 (the user: "the tricycle configuration tries strange
          // things for the front wheel"): the nose castor used to be drawn
          // INTO THE LEG'S bags, so the join stretched fork and spat with the
          // spring, and it never yawed — only the tailwheel's castor was
          // registered as the yawing part. It is its own bag-set now, handed
          // out through castorUnitOut exactly as legTailwheel's is; the wheel
          // rides inside it in the game (app.js: the tw wheel is the castor's
          // child, and refs.tw IS the nosewheel on a tricycle).
          const cb = allBags();
          const u = GG.castorUnit(cb, st.P, r.axle, sgn, st.R, st.P.twSteer, false);
          GG.wheel(wu.proxy, u.hub, u.axis, st.R, { brake: !!st.brake, P: st.P });
          if (st.fair) GG.spat(cb, u.hub, u.axis, st.R, fOpt);
          castorUnitOut = { bags: cb, top: u.top, ax: u.ax, axle: u.hub };
          r = { axle: u.hub, axis: u.axis, root: r.root, tip: u.top,
                travel: r.travel };
        } else {
          GG.wheel(wu.proxy, r.axle, r.axis, st.R,
                   { brake: !!st.brake, inboard: sgn, P: st.P });
          if (st.fair) GG.spat(lb, r.axle, r.axis, st.R, fOpt);
        }
      }
      delete st.mount; delete st.ret;
      wu.wb.axle = r.axle; wu.wb.R = st.R;
      wu.wb.kind = (st.leg === 3 || isSingle(st)) ? 'T'
                 : (r.axle[0] > 0 ? 'L' : 'R');
      // G58.7: BOTH ends are anchors. `root` bolts to the airframe and
      // must stay put; the moving end is the spring's own tip (the
      // castor's swivel top) on a tailwheel, the axle otherwise — the
      // user's rule: "the spring should elongate or shrink, but both
      // the start and end anchor points remain in original position".
      legUnits.push({ bags: lb, kind: wu.wb.kind, axle: r.axle,
                      root: r.root || null, moving: r.tip || r.axle,
                      wing: !!m,      // RETRACT-1: rooted on the wing (the inward fold) or on the body (aft)
                      waxis: r.axis || null, R: st.R,      // G1: the wheel's axis and radius (the lift)
                      legR: (+(st.P && st.P.oleoDia) || 0.06) / 2 + 0.02,   // GR: the leg's radius and its links' room (the wells)
                      // GR: the strut as drawn (the shortening's axis and length), the piston's bags and the scissor
                      strut: rOleo && rOleo.strutDir || null, strutL: rOleo && rOleo.strutL || 0, cylF: rOleo && rOleo.cylF || 0.55,
                      low: retLow, scissor: retSc });
      contacts.push({ st, sgn, p: r.axle, R: st.R });
    }
  }
  // the SPAT is the builder's to paint (phase C): its own livery section,
  // trim by default, borrowing the fuselage's colour — everything else in
  // the general bags stays on the gear's own hardware table
  const SM = typeof window !== 'undefined' && window.CAGE_SECMAT;
  const spatM = () => (SM && SM('spat', { surf: 0, fieldM: 1, tint0: 0xcfd6de }))
    || GG.gearMat('fair');
  // ...and only when there ARE spats: the section registry lists what this
  // build actually drew, and an empty bag draws nothing
  for (const k in bags)
    bags[k].mesh(group, k === 'fair' && bags[k].tris ? spatM()
                                                     : GG.gearMat(k));
  // G58.2/.3: bake each unit into its own NAMED group — the join's
  // snapshot picks these up by name, exactly as it does the prop's
  for (const wb of wheelUnits) {
    const wg = new THREE.Group();
    wg.name = 'edWheel' + (wb.kind || 'T');
    for (const k of ['tyre', 'hub', 'brake', 'alloy', 'dark'])
      if (wb[k] && wb[k].mesh) wb[k].mesh(wg, GG.gearMat(k));
    group.add(wg);
  }
  // the LEGS take a livery section too (phase C): steel tube by default,
  // following nobody — but a builder can paint a leg without repainting the
  // chrome piston or the tyres, which stay hardware. Only the 'steel' bag
  // moves: it is the painted member (legs, blades, leaf springs) — and
  // since G133 a unit's 'fair' bag (its spat or shroud) takes the spat
  // section, guarded on tris so an unfaired build registers no section.
  const legM = (k, bag) => (k === 'steel' && SM &&
    SM('gearLeg', { surf: 0, fieldM: 1, tint0: 0x98a2ad }))
    || (k === 'fair' && bag && bag.tris ? spatM() : 0)
    || GG.gearMat(k);
  // G316 (the user: "the wheel fairings should also be exploded"): a leg's
  // 'fair' bag — its spat and its shroud — unbolts OUTBOARD by the explode
  // distance (a centreline unit's forward), the leg and the wheel stay.
  // Display only: the join resets explodeD before it reads the layers.
  const exG = Math.max(0, P.explodeD || 0) * FS;
  for (const lu of legUnits) {
    // GR: the piston's own group (it slides up the leg as it retracts - the core's rule 'rigid' with `slide`)
    if (lu.low) { const lw = new THREE.Group(); lw.name = 'edMechLow' + lu.kind;
      for (const k in lu.low) if (lu.low[k].tris) lu.low[k].mesh(lw, legM(k, lu.low[k]));
      group.add(lw); }
    const lg = new THREE.Group();
    lg.name = 'edLeg' + lu.kind;
    for (const k in lu.bags) {
      const mf = lu.bags[k].mesh(lg, legM(k, lu.bags[k]));
      if (k === 'fair' && mf && exG > 0) {
        const sx = lu.axle ? Math.sign(lu.axle[0]) : 0;
        if (sx) mf.position.x += sx * exG; else mf.position.z += 0.6 * exG;
      }
    }
    group.add(lg);
  }
  if (castorUnitOut) {
    const cgp = new THREE.Group();
    cgp.name = 'edCastorT';
    for (const k in castorUnitOut.bags) {
      const mf = castorUnitOut.bags[k].mesh(cgp, legM(k, castorUnitOut.bags[k]));
      if (k === 'fair' && mf && exG > 0) mf.position.z += 0.6 * exG;   // G316
    }
    group.add(cgp);
  }

  // ---- THE GROUND COMES TO THE AEROPLANE ---------------------------------
  // The bench pitches the whole machine until the extreme contacts share a
  // ground line. Here the cage is the thing being edited and must not tilt
  // under the editor, so the SAME attitude is expressed by tilting the ground
  // instead: identical geometry, and the fuselage stays where you put it.
  //
  // Rotating the body by `pitch` about x and dropping to y = 0 puts the ground,
  // read back in body coordinates, at the plane through gy along
  // n = (0, cos p, -sin p) — which is the grid's own normal once it is rolled
  // by -pitch. Nothing is approximated: it is the same transform, inverted.
  let pitch = 0, gy = 0, note = '';
  if (contacts.length > 1) {
    const byZ = contacts.slice().sort((a, b) => a.p[2] - b.p[2]);
    const A = byZ[0], B = byZ[byZ.length - 1];
    pitch = Math.atan2((B.p[1] - B.R) - (A.p[1] - A.R), B.p[2] - A.p[2]);
  }
  const cs = Math.cos(pitch), sn = Math.sin(pitch);
  const rot = p => [p[0], p[1] * cs - p[2] * sn, p[1] * sn + p[2] * cs];
  gy = Infinity;
  for (const c of contacts) gy = Math.min(gy, rot(c.p)[1] - c.R);
  if (!isFinite(gy)) gy = 0;

  if (P.gearSit && contacts.length) {
    const n = [0, cs, -sn];
    const grid = new THREE.GridHelper(12, 48, 0x39424e, 0x232a33);
    grid.rotation.x = -pitch;
    grid.position.set(n[0] * gy, n[1] * gy, n[2] * gy);
    group.add(grid);
  }

  // ---- the checks (the bench's, on the real body) -------------------------
  // Measured in the SAT frame — rotated and dropped — because a CG angle read
  // off an untilted drawing is not the angle the aeroplane has.
  const toG = p => { const q = rot(p); return [q[0], q[1] - gy, q[2]]; };
  const mains = contacts.filter(c => !isSingle(c.st)).map(c => toG(c.p));
  const singles = contacts.filter(c => isSingle(c.st)).map(c => toG(c.p));
  const notes = [];
  if (mains.length) {
    const mz = mains.reduce((s, p) => s + p[2], 0) / mains.length;
    notes.push('track ' + (Math.max(...mains.map(p => Math.abs(p[0]))) * 2).toFixed(2));
    const cg = toG([0, P.cgY, P.cgZ]);
    const tail = singles.find(p => p[2] < mz), nose = singles.find(p => p[2] > mz);
    if (tail) {
      notes.push('wb ' + (mz - tail[2]).toFixed(2));
      const ang = Math.atan2(mz - cg[2], Math.max(0.01, cg[1])) / D2R;
      notes.push('CG ang ' + ang.toFixed(1) + (ang >= 15 && ang <= 18 ? '' : '!'));
      notes.push('deck ' + (-pitch / D2R).toFixed(1));
    }
    if (nose) {
      const wb = nose[2] - mz;
      notes.push('wb ' + wb.toFixed(2));
      const share = 100 * (cg[2] - mz) / wb;
      notes.push('nose ' + share.toFixed(1) + '%' +
                 (share >= 8 && share <= 15 ? '' : '!'));
    }
    const gap = toG([0, AF.cyAt(P.propZ), P.propZ])[1] - P.propR;
    const req = nose ? 0.178 : 0.229;
    notes.push('prop clr ' + gap.toFixed(3) + (gap >= req ? '' : '!'));
  }
  // G133: say so when the low-wing rule took the legs — the one visible
  // trace of an automatic decision the builder never clicked
  if (onWing) notes.push('mains on wing');
  // RETRACT-1 / G1 (futureDesigns/RETRACT-STUDY-2026-11.md §8.1): THE FOLD, a retractable build's only - per unit (L / R
  // mains, T the nose) the chain foldChain makes of its rows: the hinge (the leg's airframe end), the leg's axis, the twist,
  // the turns with their probed senses, the fraction, and the LIFT the stowed wheel's lowest point rises by (the physics'
  // contact plane, carried by the join). The join takes it to the flown model (gearSwing, app.js gearSwingRig); THE
  // PREVIEW poses the units here at `gearPos` (the editor's slider, quickshot --gear) - the capture takes them down
  // (_cage_join.js VIEW_STATE 'gear position')
  let swing = null, fit = null, mech = null, doors = [];
  const SPx = structProbe(AF, window.CAGE_WING, P);          // GR: the structure's probe (the trim, the mechanism)
  if (GEAR_RETRACTABLE(P)) {
    swing = {};
    for (const u of legUnits) {
      const key = u.kind === 'T' ? 'T' : u.kind;
      if (!swing[key] && (u.axle || u.moving)) swing[key] = foldChain(u, key, P, SPx);
    }
    // GM2: the brace and the actuator, drawn at rest (gear down) in their own named groups - before the fit: the wells'
    // cuts take their swept points too
    const KT = window.GEAR_KIT, CM = (typeof GEAR_MECH !== 'undefined') ? GEAR_MECH : window.GEAR_MECH;
    if (KT && CM) try { mech = mechBuild(P, swing, group, KT, CM, SPx); } catch (e) { mech = null; console.warn('gear mechanism:', e); }
    // G2: the fit (the gear layer runs after the wing: CAGE_WING is this build's)
    try { fit = foldFit(P, swing, AF, window.CAGE_WING, mech && CM ? { R: mech.R, CM } : null); } catch (e) { fit = null; console.warn('gear fit:', e); }
    // GR: the fixed pivots' fittings, on the wells' ceilings (the trunnions' records, the brace's and actuator's)
    try { fittingsDraw(retFits.concat(mech && mech.fits || []), fit, group, KT); } catch (e) { console.warn('gear fittings:', e); }
    // GM1: THE MOUNT - a trunnion needs structure round its pin: MOUNT_MIN of depth (the lug's eye under the pin, the
    // fitting plate over it); a wing leg's station near the trailing edge, or a thin section, has not got it
    if (fit) for (const mt of retMounts) if (mt.wing && mt.depth < MOUNT_MIN && mt.key !== 'R') {
      const why = 'the mains\' trunnion has ' + Math.round(mt.depth * 1000) + ' mm of wing depth (it needs ' + Math.round(MOUNT_MIN * 1000) + ')';
      fit.ok = false; fit.why.push(why);
      (fit.tests.mount = fit.tests.mount || []).push({ unit: mt.key, why });
      for (const k of ['s1Z', 's1X', 'wgThick']) if (!fit.rows[k]) fit.rows[k] = why;
    }
    // GR: THE NACELLE'S LENGTH - a wheel folded into a nacelle must stow within its length (an engine fills its front, a
    // propeller turns ahead of it): the stowed wheel past either end turns the station's rows red
    if (fit) for (const k of ['L', 'R']) { const C = swing[k]; if (!C || !C.nacelle) continue;
      const N = nacAtW(C.hinge[0], C.hinge[2]) || NACS.find(n => n.kind !== 'cowl' && Math.abs(C.hinge[0] - n.xc) < 0.6); if (!N) continue;
      const axS = slidePt(C, C.axle, slideD(C, 0));
      const q = fApp(foldPose(C, 0), [axS[0] - C.hinge[0], axS[1] - C.hinge[1], axS[2] - C.hinge[2]]), cz = C.hinge[2] + q[2];
      const past = Math.max(cz + C.R - N.z1, N.z0 - (cz - C.R));
      if (past <= 0.005 || k === 'R') continue;
      const why = 'the mains go ' + Math.round(past * 1000) + ' mm past the nacelle\'s ' + (cz > (N.z0 + N.z1) / 2 ? 'front' : 'tail') +
                  ' (the leg ' + Math.hypot(...q).toFixed(2) + ' m; the nacelle ' + (N.z1 - N.z0).toFixed(2) + ' m long)';
      fit.ok = false; fit.why.push(why);
      (fit.tests.nacelle = fit.tests.nacelle || []).push({ unit: k, why });
      for (const r of ['s1Z', 's1Drop', 'gearFold']) if (!fit.rows[r]) fit.rows[r] = why; }
    // P2 (the user: "you don't even constrain it to the size of the wing, but we can start without this sort of
    // constraint and add them later"): THE WING'S LIMITS -
    //   STRUT   a lift strut (CAGE_WING.struts, pin -> tip) through a gear nacelle, or within 40 mm of the mains' points
    //           anywhere along their fold;
    //   FLAP    a gear nacelle's tail, or a folded wheel, behind a flap's hinge line within the flap's span (the flap
    //           comes down through it)
    if (fit) { const WGx = window.CAGE_WING, struts = (WGx && WGx.struts) || [], flaps = ((WGx && WGx.surfs) || []).filter(f => f.kind === 'flap');
      const mainsK = Object.keys(swing).filter(k => k !== 'T'), seen = new Set();
      const red = (test, unit, why, rows) => { if (seen.has(why)) return; seen.add(why); fit.ok = false; fit.why.push(why);
        (fit.tests[test] = fit.tests[test] || []).push({ unit, why }); for (const r of rows) if (!fit.rows[r]) fit.rows[r] = why; };
      for (const st of struts) { if (!st || !st.pin || !st.tip) continue;
        const sp = []; for (let i = 0; i <= 40; i++) { const t = i / 40; sp.push([st.pin[0] + (st.tip[0] - st.pin[0]) * t, st.pin[1] + (st.tip[1] - st.pin[1]) * t, st.pin[2] + (st.tip[2] - st.pin[2]) * t]); }
        for (const N of NACS) { if (N.kind === 'cowl') continue;
          const hit = sp.some(q => nacIn(q) > -0.02 && Math.abs(q[0] - N.xc) < N.bb.hw + 0.05);
          if (hit) red('strut', 'L', 'a lift strut runs through the engine nacelle at ' + Math.abs(N.xc).toFixed(2) + ' m (move the nacelle or the strut)', ['engNacAt', 's1X']); }
        // (the leg's axis and the strut's, segment to segment, at every sweep pose: the leg's radius and the strut's
        // 20 mm off; the wheel: its centre within its radius and 20 mm of the strut)
        for (const k of mainsK) { const C = swing[k]; let gap = Infinity;
          for (const g of WELL_G) { const [hP, aP] = poseAll(C, [C.hinge, C.axle], g);
            gap = Math.min(gap, segDist(hP, aP, st.pin, st.tip) - (C.legR || 0.05) - 0.02, segDist(aP, aP, st.pin, st.tip) - C.R - 0.02); }
          if (gap < 0) red('strut', k, 'the mains meet a lift strut as they fold (' + Math.round(-gap * 1000) + ' mm into it)', FIT_ROWS[k].fold.concat(['s1X', 's1Z'])); } }
      for (const F of flaps) { const a = F.line[0], b = F.line[1], x0 = Math.min(Math.abs(a[0]), Math.abs(b[0])), x1 = Math.max(Math.abs(a[0]), Math.abs(b[0]));
        const zh = x => { const t = Math.max(0, Math.min(1, (Math.abs(x) - Math.abs(a[0])) / ((Math.abs(b[0]) - Math.abs(a[0])) || 1))); return a[2] + (b[2] - a[2]) * t; };
        for (const N of NACS) { if (N.kind === 'cowl' || Math.sign(N.xc) !== Math.sign(a[0])) continue;
          if (Math.abs(N.xc) + N.bb.hw > x0 && Math.abs(N.xc) - N.bb.hw < x1 && N.z0 < zh(N.xc) - 0.02)
            red('flap', 'L', 'the engine nacelle\'s tail runs through the flap at ' + Math.abs(N.xc).toFixed(2) + ' m (split the flap round it, or shorten the flap\'s span)', ['wgFlapSpan', 'engNacAt']); }
        for (const k of mainsK) { const C = swing[k]; if (Math.sign(C.hinge[0]) !== Math.sign(a[0])) continue;
          const up = poseAll(C, unitPts(C).W, 0);
          if (up.some(q => Math.abs(q[0]) > x0 && Math.abs(q[0]) < x1 && q[2] < zh(q[0]) && SPx.wingIn(q) > -0.05))
            red('flap', k, UNIT_WORD[k] + ', folded, lies behind the flap\'s hinge (the flap comes down through it)', FIT_ROWS[k].fold.concat(['s1Z', 'wgFlapSpan'])); } } }
    // P2 (the Skymaster): THE REAR ENGINE'S BAY - the mains' folded points inside an aft engine's cowl box (a push-pull's
    // rear engine): the 337's mains stow in the belly AHEAD of it
    if (fit && AFT_BAYS.length) for (const k of Object.keys(swing)) { if (k === 'T') continue;
      const up = poseAll(swing[k], unitPts(swing[k]).W, 0), B = AFT_BAYS.find(b => up.some(q => q[0] > b.x0 && q[0] < b.x1 && q[1] > b.y0 && q[1] < b.y1 && q[2] > b.z0 && q[2] < b.z1));
      if (!B) continue;
      const why = UNIT_WORD[k] + ', folded, ends in the rear engine\'s bay (stow it ahead of the rear firewall: shorten the leg, or move it forward)';
      if (fit.why.includes(why)) continue;
      fit.ok = false; fit.why.push(why); (fit.tests.bay = fit.tests.bay || []).push({ unit: k, why });
      for (const r of FIT_ROWS[k].fold.concat(['s1Z', 'gearShort', 's1Drop'])) if (!fit.rows[r]) fit.rows[r] = why; }
    // GR R2: THE BRACE'S KNEE inside the structure over the fold (its shortest brace's)
    // (a partial fold's exposure is declared - its wheel's, and so its brace's and actuator's: GATE RETRACT §11)
    if (fit && mech) for (const k in mech.info) { const I = mech.info[k];
      if (I.knee == null || I.knee >= -0.005 || (swing[k] && swing[k].frac < 0.999)) continue;
      const why = UNIT_WORD[k] + '\'s brace folds ' + Math.round(-I.knee * 1000) + ' mm out of the structure';
      fit.ok = false; fit.why.push(why);
      (fit.tests.brace = fit.tests.brace || []).push({ unit: k, why });
      for (const r of FIT_ROWS[k].fold.concat([FIT_ROWS[k].st + 'Drop', 'wgThick'])) if (!fit.rows[r]) fit.rows[r] = why; }
    // GR R2: THE ACTUATOR'S PLACE - its base and barrel inside the structure stowed (8 mm), its stroke a real cylinder's
    if (fit && mech) for (const k in mech.info) { const I = mech.info[k];
      if (I.inside == null || (I.inside >= 0.008 && I.ok) || (I.ok && swing[k] && swing[k].frac < 0.999)) continue;
      const why = UNIT_WORD[k] + '\'s actuator ' + (I.ok ? 'stands ' + Math.round(-I.inside * 1000 + 8) + ' mm out of the structure, stowed' : 'has no real stroke');
      fit.ok = false; fit.why.push(why);
      (fit.tests.actuator = fit.tests.actuator || []).push({ unit: k, why });
      for (const r of FIT_ROWS[k].fold.concat(['gearRetAct'])) if (!fit.rows[r]) fit.rows[r] = why; }
    if (fit && !fit.ok && stat) stat.textContent += '  ·  gear: ' + fit.why[0] + '!';
    // G3: THE WELLS SHOWN - each reserved box as edges (a LineSegments overlay: the capture takes meshes only, GATE
    // VIEW's 'control cage' rule), amber when the fold fits, red when it does not
    if (fit && fit.wells && fit.wells.length && THREE.LineSegments && THREE.EdgesGeometry) {
      const wg = new THREE.Group(); wg.name = 'edWellGhost';
      const lm = new THREE.LineBasicMaterial({ color: fit.ok ? 0xe0a23a : 0xe04a33, transparent: true, opacity: 0.9, depthTest: false });
      for (const w of fit.wells) {
        const bx = new THREE.BoxGeometry(w.max[0] - w.min[0], w.max[1] - w.min[1], w.max[2] - w.min[2]);
        const ls = new THREE.LineSegments(new THREE.EdgesGeometry(bx), lm);
        ls.position.set((w.min[0] + w.max[0]) / 2, (w.min[1] + w.max[1]) / 2, (w.min[2] + w.max[2]) / 2);
        ls.renderOrder = 999; wg.add(ls); bx.dispose();
      }
      group.add(wg);
    }
    // G6: THE DOORS - the skin the wells took, given back: the leg doors on the units, the well doors on their hinges
    if (mech && fit) try { doors = doorBuild(P, fit, mech, swing, ctx, group, FS, AF, KT, CM); } catch (e) { doors = []; console.warn('gear doors:', e); }
    // GM3: EVERY PART POSED BY THE ONE KINEMATICS (src/core/62c_gear_mech.js gearMechPose) - the legs, the wheels, the
    // castor rigid with their unit, the brace's links and the actuator's body and rod aimed - as the flight poses them
    const g = Math.max(0, Math.min(1, P.gearPos == null ? 1 : +P.gearPos));
    if (g < 1 && mech) {
      const T = CM.gearMechPose(mech.R, g);
      group.traverse(o => {
        const t = o.name && T[o.name];
        if (!t) return;
        o.matrix.set(t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8], t[9], t[10], t[11], 0, 0, 0, 1);
        o.matrix.decompose(o.position, o.quaternion, o.scale);
      });
    }
  }
  window.CAGE_GEAR = { AF, contacts, pitch, gy, saddles: saddlesOut,
    ...(swing ? { swing } : {}),
    ...(fit ? { fit } : {}),            // G2: does the fold fit (foldFit; the rows it turns red: CAGE_ROW_BAD)
    ...(mech ? { mech: mech.R, mechInfo: mech.info } : {}),   // GM2/GM3: the mechanism's record (gearMechPose) and its numbers
    ...(mech ? { doors: doors } : {}),                         // G6: the doors made (name, kind, unit(s), area, closedDown)
    ...(fit && fit.wells ? { wells: fit.wells } : {}),   // G3: the reserved volumes (the join's gear.wells, the tanks' keep-out)
    // G4: the wells' cuts in the knife's terms (cage units, the plan outline, the ceiling) - _cage_ui cuts the DRAWN
    // fuselage with them (wellApply); the measured sheet is never cut (the legs stand on the skin the contracts read)
    ...(fit && fit.cuts && fit.cuts.length ? { cuts: cutsCage(fit.cuts, FS) } : {}),
    // GR: the side wells (the Catalina's recesses in the hull's side), the knife's terms with their own frames
    ...(fit && fit.cutsSide && fit.cutsSide.length ? { cutsSide: cutsSideCage(fit.cutsSide, FS) } : {}),
    // G5: the wing's cuts (its own and the body's, merged) in the layer's own metres (the wing's skin is drawn in them)
    ...(fit && fit.cutsWing && fit.cutsWing.length ? { cutsM: cutsCage(fit.cutsWing, 1) } : {}),
    // GR: the nacelles' wells (metres; _cage_ui and quickshot cut the cowl units' skin meshes with them)
    ...(fit && fit.cutsNac && fit.cutsNac.length ? { cutsNacM: cutsCage(fit.cutsNac, 1) } : {}),
    // GR R4: the holes the stowed wheels stand proud through the wing's upper skin (metres, (z, x) counter-clockwise)
    ...(fit && fit.pierce && fit.pierce.top.length ? { pierceTopM: fit.pierce.top.map(t => ({ units: [t.unit], outline: t.outline })) } : {}),
    onWing,                              // G1441: legs rooted on the wing (the drag preview's wing -> gear edge)
    // G58.3: the separable units' anchors, for the join's moving parts
    units: { legs: legUnits.map(u => ({ kind: u.kind, axle: u.axle,
                                        root: u.root, moving: u.moving, wing: u.wing })),
             castor: castorUnitOut
               ? { top: castorUnitOut.top, ax: castorUnitOut.ax,
                   axle: castorUnitOut.axle,
                   ears: castorUnitOut.ears || null } : null } };
  if (stat && notes.length) stat.textContent += '  ·  gear: ' + notes.join(' · ');
};
})();
