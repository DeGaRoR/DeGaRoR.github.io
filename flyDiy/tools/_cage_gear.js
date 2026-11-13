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
  // ENGINE-DIALS C (9 Nov): the mains' spring rate over the suspension kind's (GEN_SUSPENSION), spec.gear.stiffness -
  // a physics field no row reached (every build flew 1); absent at 1 (CAGE_DEFAULT_ABSENT)
  s1Stiff: 1,
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
  gearPos: 1, gearFold: 0, gearFoldNose: 0, gearRetFrac: 1, gearWellCut: 0, gearDoors: 2, gearLegDoor: 1, gearNacFit: 1, gearNacPod: 0, gearShort: 0, gearShortNose: 0, gearKneeDoor: 0,
  gm1Ax: 0, gm1Ang: 90, gm2Ax: 1, gm2Ang: 0, gmTwist: 0,
  gn1Ax: 1, gn1Ang: 90, gn2Ax: 0, gn2Ang: 0, gnTwist: 0,
  shockKind: 1, linkSwing: -42,
  gearLvPos: 0,            // WILGA-GEAR: the trailing-link leg's preview (0 extended .. 1 full stroke; a view, never saved)
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
  if (key === 'lvBoot')                                   // (WILGA-GEAR: the leg fairing's shape, with the leg fairing)
    return P => kw(P) && Math.round(+P['s' + i + 'LegFair'] || 0) > 0;
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
// WILGA-GEAR: and so do the WHEEL's on the trailing link (the mains' leg 4: the leg-fairing row is its fairing)
const noLever = (P, i) => !(i === 1 && Math.round(+P['s' + i + 'Leg'] || 0) === 4);
const fairOn = i => ({ when: P => +P['s' + i + 'On'] && noRet(P) && noLever(P, i)
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
  // DC3-EDITABLE: to the big box's 8 m track (4 m), 0.90 m wheel and 1.80 m leg (gear.legDrop's clampBig)
  ['s' + i + 'X',     'in / out (half track)',   0, 4.0, 0.01, sOnM(i)],
  // RETRACT GM1: a retracting gear's legs are oleos on trunnions, whatever this row holds (it is kept for the gear down)
  ['s' + i + 'Leg',   'leg',          0, i === 1 ? 4 : 3, 1, GP.LEGS, Object.assign({}, sOn(i), {   // (WILGA-GEAR: 4 the mains')
    note: P => GEAR_RETRACTABLE(P) && Math.round(+P['s' + i + 'Leg']) !== 2 ? 'retractable: drawn and flown as an oleo on a trunnion' : '' })],
  ['s' + i + 'R',     i === 2 ? 'third wheel radius' : 'main wheel radius', 0.05, 0.90, 0.005, sOnM(i)],
  ['s' + i + 'Drop',  'up / down (leg drop)',     0.05, 1.80, 0.01, sOnM(i)],
  // the wheel's fore/aft FROM the fitting — the leg's rake, on every family;
  // hidden on a tailwheel, whose spring length already is that knob
  // NEW-SHAPES-1: the legs' root - no default (an old file keeps the rule it was built by)
  ['s' + i + 'Root',  'legs root on', 0, 1, 1, ['auto (a wing under the body)', 'the fuselage'],
   { when: P => +P['s' + i + 'On'] && Math.round(P['s' + i + 'Leg']) !== 3 }],
  ['s' + i + 'AxZ',   'wheel fore / aft (from fitting)', -1.2, 1.2, 0.01,
   { when: P => +P['s' + i + 'On'] && Math.round(P['s' + i + 'Leg']) !== 3,
     dim: 'm' }],
  ['s' + i + 'Brake', 'brake',        0, 1, 1, sOn(i)],
  // ENGINE-DIALS C: the suspension's stiffness, the mains' only (the physics has one suspension arch: G132) - a stiffer
  // or softer bungee pack, spring blade or oleo charge than the kind's own rate; the frame scales the legs' k by it and
  // their damping by its root (61_gen_frame SUS / CG)
  ...(i === 1 ? [['s1Stiff', 'suspension stiffness ×', 0.35, 3.0, 0.01, sOn(1)]] : []),
  // (G3575, the user 26 Oct: "remove fixed" - on the THIRD wheel: it flew as 'linked' anyway; the mains keep their 'fixed',
  // their own and only value. A saved third wheel at 0 still flies linked, as it always did)
  // G3800: the third wheel's own four kinds (GP.TW_STEERS; 0 an old save's, shown and flown as 1)
  ['s' + i + 'Steer', i === 2 ? 'tail contact' : 'steering', i === 2 ? 1 : 0, i === 2 ? 4 : 2, 1, i === 2 ? GP.TW_STEERS : GP.STEERS,
   i === 2 ? Object.assign(sOn(i), { optOrder: () => [1, 2, 3, 4] }) : sOn(i)],
  // G133: the castor exclusion is GONE — legTailwheel draws its own shell
  // now, so the switch that was two lies (G121.2) is two truths everywhere
  ['s' + i + 'Fair',  'fairing',      0, 2, 1, ['none', 'spat', 'trousers'],
   { when: P => +P['s' + i + 'On'] && noRet(P) && noLever(P, i) }],
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
             && (Math.round(P['s' + i + 'Fair'] || 0) < 2 || !noLever(P, i))
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
  // P2 v3 (the PBY-5A's operator's handbook, Figs 12-13 - v2's aft-and-tuck was not it): the leg's head on links, not
  // a trunnion - it RISES (the whole unit, the shortening's slide carrying it: the V-strut's jack) and SWINGS IN (one
  // small turn about the fore-aft axis through a far pole, solved per build) - up and in, the wheel upright, into the
  // well in the hull's side; foldChain solves the rise and the pole
  catalina:  { turns: [[0, 10]], twist: 0 },
  // GR: INTO THE NACELLE - about the lateral axis, forward or aft whichever way the nacelle runs further from the pin (the
  // DC-3, the Aztec, the Twin Otter forward; the B-25 aft), trimmed to centre the wheel in the nacelle's depth
  nacelle:   { turns: [[1, 90]], twist: 0 },
  // P2 (the user's sketch, 6 Nov): THE FOLDING KNEE, hidden in the side - an arm from a pivot just inside the hull's
  // wall out to a knee, the leg straight down from the knee to the wheel (outboard of it); a piston from high inside
  // the hull swings the arm up about its pivot and the knee opens as much: the leg stays upright, the wheel translates
  // on a quarter circle, up and in, to its round recess - arm, leg and piston behind the skin, the wheel half out. No
  // turn: the arc (`C.arc`, the core's gearArc), solved per build (kneeGeom)
  knee:      { turns: [], twist: 0 },
  // P2 (the Super Petrel's V2, the user's sketch relayed by the hull-types session, 6 Nov: "it just stows below the wing,
  // no doors. It's a fixed 90 deg angle that rotates 90 degrees and the wheel slots partly into the bottom wing"): THE
  // RIGID L - an arm level from a pivot on the hull's side out to a corner, the leg straight down from the corner, at a
  // fixed 90 deg; ONE 90 deg turn about the pivot (fore-aft), outboard and up: the arm stands up along the side, the leg
  // lies level under the lower wing, the tyre FLAT, half into the wing's underside through an exact round cut. Solved
  // per build (lGeom)
  lfold:     { turns: [], twist: 0 },
};
const FOLD_KEYS = ['inward', 'outward', 'aftFlat', 'aftBelly', 'skymaster', 'custom', 'catalina', 'nacelle', 'knee', 'lfold'];   // (appended: a saved index keeps its fold)
const FOLD_NOSE_KEYS = ['aft', 'fwd', 'custom'];
const FOLD_LABELS = { inward: 'inward (into the wing root)', outward: 'outward', aftFlat: 'aft, the wheel turned flat',
  aftBelly: 'aft and in, flat (twist-and-tuck)', skymaster: 'two axes (Skymaster)', catalina: 'up against the hull side (Catalina)', nacelle: 'into the engine nacelle', knee: 'folding knee, hidden in the side', lfold: 'rigid L, turned up flat under the lower wing', aft: 'aft', fwd: 'forward',
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
// (P2: the leg's head - the hinge, but for a unit whose fold turns about a pole off the leg (the Catalina's), C.top)
const topOf = C => C.top || C.hinge;
// (P2: the side-stowed folds - the Catalina's and the folding knee's: a round recess in the side, the wheel half out)
const SIDE_FOLDS = new Set(['catalina', 'knee']);
const sideFold = P => SIDE_FOLDS.has(FOLD_KEYS[Math.round(+P.gearFold || 0)]);
const kneeFold = P => FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'knee';
const lFold = P => FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'lfold';
// THE FOLDING KNEE'S GEOMETRY, solved once per side at the station (the leg is drawn to it) and read by the fold:
//   the down axle A0 (the station's rows: half track, drop under the keel); the hub `hub` outboard of the leg;
//   the stowed wheel centred ON the side line at its height (half out), the wheel's top 20 mm under the lowest wing over
//   it; the arm's length a = the inward travel = the rise (a quarter circle with the leg upright: A1 = A0 + a (-out, up));
//   the leg b (knee over the axle): long enough that the arm clears the tyre (R + 30 mm), short enough that the stowed
//   knee keeps 20 mm under that wing; the pivot P = the down knee less a (just inside the wall); the piston's fitting F
//   inboard of P and up, under the wing
const KNEE = {};
// (`full`, gearKneeDoor - the user, 6 Nov: "a version with full doors": the stowed wheel WHOLLY inside, its tyre's
// outer face KNEE_IN behind the skin over its whole height - the door, riding the leg, closes the side over it)
const KNEE_IN = 0.025;
const kneeDoor = P => kneeFold(P) && Math.round(+P.gearKneeDoor || 0) >= 1;
// (gearKneeDoor 2 - the user, 6 Nov: "the door also full attached to the hull. Same cut, but the top part attaches to the
// top of the cut, and rotates 90 deg upwards, comes right below the wing": ONE door over the whole keyhole, hinged on
// the hull along the cut's top, swung 90 deg up and out - level under the wing - while the gear travels and stands down)
const kneeHullDoor = P => kneeFold(P) && Math.round(+P.gearKneeDoor || 0) === 2;
const KNEE_DOOR_ANG = Math.PI / 2, KNEE_DOOR_SEQ = 0.10;
function kneeGeom(AF, st, sgn, full) {
  const z = st.z + (st.axZ || 0), R = st.R, hub = R * 0.40 + 0.020, A0 = [sgn * st.x, AF.keelAt(st.z) - st.drop, z];
  const sideX = y => { let best = null;          // (the section's half width at height y: the side's crossing)
    for (let d = 0; d < 180; d += 1) { const a = AF.surf(st.z, d * D2R), b = AF.surf(st.z, (d + 1) * D2R);
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const t = (y - a[1]) / (b[1] - a[1]), x = Math.abs(a[0] + (b[0] - a[0]) * t); if (best == null || x > best) best = x; } }
    return best; };
  // (the arm: a = the inward travel = the rise, the stowed centre on the side line - |A0.x| - a = sideX(A0.y + a), by
  // bisection: the left side falls with a, the side's half width grows with height up to the beam; no side yet: 0)
  let lo = 0.05, hi = Math.max(0.06, Math.abs(A0[0]) - 0.02);
  const hw = 0.38 * R;
  const f = full ? a => { const cx = Math.abs(A0[0]) - a, cy = A0[1] + a; let m = -Infinity;
      for (let i = 0; i <= 12; i++) { const y = cy - R + 2 * R * i / 12; m = Math.max(m, cx + hw - (sideX(y) || 0)); }
      return m + KNEE_IN; }
    : a => Math.abs(A0[0]) - a - (sideX(A0[1] + a) || 0);
  for (let it = 0; it < 50; it++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
  const a = (lo + hi) / 2;
  const y1 = A0[1] + a, xs1 = sideX(y1) || Math.abs(A0[0]) - a;
  const wU = wingUnderIn(sgn * (xs1 - 0.10), sgn * (Math.abs(A0[0]) + 0.05), z - R, z + R);
  // (the leg: the arm clears the tyre (R + 30 mm), and the arm's pivot P sits INSIDE the hull - at a height where the
  // section's half width is 30 mm past P's)
  const xP = Math.abs(A0[0]) - hub - a;
  // (and the arm's horn, stowed - in and down from P, 0.87 h in and 0.5 h down - 20 mm inside too: a short leg's low
  // pivot put its end out of the bottom)
  const h = Math.min(0.09, Math.max(0.05, 0.22 * a));
  let yIn = null; for (let y = A0[1]; y <= A0[1] + 2.0; y += 0.005) { const xs = sideX(y), xh = sideX(y - 0.5 * h);
    if (xs != null && xs >= xP + 0.03 && xh != null && xh >= xP - 0.866 * h + 0.02) { yIn = y; break; } }
  const bMin = Math.max(R + 0.03, yIn != null ? yIn - A0[1] : 0), bWing = wU != null ? wU - 0.02 - a - A0[1] : Infinity;
  const b = Math.max(bMin, Math.min(bMin + 0.07, bWing));
  const knee0 = [A0[0] - sgn * hub, A0[1] + b, z], P = [knee0[0] - sgn * a, knee0[1], z];
  const kUp = [P[0], P[1] + a, z];
  // (the user, 6 Nov: "a little piston on the folding knee, at the place where the rotating joint is, and anchoring
  // higher up on the fuselage"): THE ARM'S HORN - a short lever on the arm at its pivot, 120 deg round from the arm
  // (gear down: up and in; stowed: in and down), h long; the little piston from its fitting F high up inside the hull,
  // over the pivot and inboard, to the horn's end: it pushes the horn round, the arm swings up - a short stroke
  const hornR = h * Math.cos(2 * Math.PI / 3), hornS = h * Math.sin(2 * Math.PI / 3);
  const horn0 = [P[0] + sgn * hornR, P[1] + hornS, z];
  let F = null;
  for (const [fx, fy] of [[0.16, 0.36], [0.14, 0.32], [0.12, 0.28], [0.10, 0.24], [0.08, 0.20]]) {
    const y = Math.min(P[1] + fy, wU != null ? wU - 0.04 : Infinity), xs = sideX(y);
    if (y - P[1] < 0.15) continue;
    // (never across the centre line - the other main's mirror is there: 50 mm off it at the most)
    const x = Math.max(Math.min(Math.abs(P[0]), 0.05), Math.abs(P[0]) - fx); if (xs == null || x > xs - 0.04) continue;
    F = [sgn * x, y, z]; break; }
  if (!F) F = [P[0] - sgn * 0.12, P[1] + 0.20, z];
  const why = [];
  if (wU != null && y1 + R > wU - 0.02 + 0.005) why.push('the stowed wheel stands ' + Math.round((y1 + R - wU + 0.02) * 1000) + ' mm into the wing over it (narrow the track: a shorter arm rises less)');
  if (wU != null && bWing < bMin) why.push('the knee, stowed, stands ' + Math.round((bMin - bWing) * 1000) + ' mm into the wing over it (raise the wing, or narrow the track)');
  return { A0, hub, a, b, knee0, P, kUp, F, full: !!full, h, hornR, hornS, horn0, ang: sgn * Math.PI / 2, wU, y1, why };
}
// THE RIGID L'S GEOMETRY (lfold), solved once per side at the station and read by the fold. With the hub `hub` outboard
// of the leg (the wheel beside it), the down axle A0 (the station's rows), the leg's line x_L = |A0.x| - hub:
//   the pivot P on the hull's side - its axis 30 mm off the skin over the arm's stowed height (the arm, stood up, stays
//   outside the side), its horn and the piston inside the hull;
//   the arm a = x_L - |P.x| (THE TRACK SETS THE ARM), the leg b = P.y - A0.y (the corner over the axle);
//   turned 90 deg outboard and up, the corner stands a over P, the leg lies level out to x_c = |P.x| + b and the hub's
//   offset turns UP: the flat tyre's mid-plane at y_c = P.y + a + hub - set ON the lower wing's underside at x_c (the
//   tyre half in the wing; a wing too thin for that: its top 12 mm under the upper skin). So THE WING'S HEIGHT SETS P,
//   AND P THE LEG: a wing too low for a leg that clears the tyre (b < R + 30 mm) is red, with how much higher it wants
//   to be; the horn at P (as the knee's), 120 deg round from the arm, inside the hull; the piston's fitting F higher up
//   inside, inboard, under the wing
const LFOLD = {};
const lowestPlane = () => { const W0 = window.CAGE_WING; if (!W0) return null;
  const pl = W0.planes && W0.planes.length ? (W0.planes[W0.lowest] || W0.planes[0]) : W0; return pl && pl.underAt && pl.overAt ? pl : null; };
function lGeom(AF, st, sgn) {
  const z = st.z + (st.axZ || 0), R = st.R, hub = R * 0.40 + 0.020, hw = 0.38 * R, A0 = [sgn * st.x, AF.keelAt(st.z) - st.drop, z];
  const sideX = y => { let best = null;
    for (let d = 0; d < 180; d += 1) { const a = AF.surf(st.z, d * D2R), b = AF.surf(st.z, (d + 1) * D2R);
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const t = (y - a[1]) / (b[1] - a[1]), x = Math.abs(a[0] + (b[0] - a[0]) * t); if (best == null || x > best) best = x; } }
    return best; };
  const WL = lowestPlane(), xL = Math.abs(A0[0]) - hub;
  // (the tyre's mid-plane target at x: the lower wing's underside, or 12 mm + half the tyre under its upper skin)
  const yT = x => { if (!WL) return null; const u = WL.underAt(sgn * x, z), o = u ? WL.overAt(sgn * x, z) : null;
    return u && o ? Math.min(u.y, o.y - 0.012 - hw) : u ? u.y : null; };
  const pX = (y0, a) => { let m = 0; for (let y = y0 - 0.02; y <= y0 + Math.max(0.02, a) + 1e-9; y += 0.01) m = Math.max(m, sideX(y) || 0); return m + 0.03; };
  // (the fixed point: P.y from the wing over the stowed tyre, P.x from the side over the arm's stowed run)
  let Py = A0[1] + R + 0.03, Px = pX(Py, 0.2), a = xL - Px, ok = !!WL;
  for (let it = 0; it < 40 && ok; it++) {
    const b = Py - A0[1], xc = Px + b, y = yT(xc);
    if (y == null) { ok = false; break; }
    const ny = y - a - hub; Px = pX(ny, a); a = xL - Px; if (Math.abs(ny - Py) < 1e-5) { Py = ny; break; } Py = ny; }
  const why = [];
  if (!WL) why.push('no lower wing over the mains - the rigid L stows into a wing\'s underside');
  else if (!ok) why.push('the stowed tyre has no wing over it (a wider span, or a narrower track)');
  if (a < 0.06) why.push('the track leaves the arm ' + Math.round(a * 1000) + ' mm (a wider track: s1X)');
  let b = Py - A0[1];
  if (ok && b < R + 0.03) why.push('the lower wing is ' + Math.round((R + 0.03 - b) * 1000) + ' mm too low for the leg to clear the tyre (raise it - w2Dy - or narrow the track)');
  b = Math.max(b, R + 0.03); Py = A0[1] + b;
  if (ok && sideX(Py) == null) why.push('the pivot falls below the hull\'s side (a narrower track, or a lower axle: s1Drop)');
  const P = [sgn * Px, Py, z], knee0 = [sgn * xL, Py, z], xc = Px + b, yc = Py + a + hub, wantU = yc;
  // (THE PISTON, the user's sketch: from a fitting INSIDE the hull, through the side, to the corner. Its fitting F is
  // searched inside the hull (40 mm in), under the wing (60 mm) and over the pivot, for a stroke a real piston makes - its
  // longest no more than 1.7 times its shortest over the turn (a barrel and its rod side by side): the highest such
  // place, as drawn; none: the least ratio, and the fit says so)
  const wRoot = WL ? WL.underAt(sgn * Px, z) : null, cOf = t => [P[0] + sgn * a * Math.cos(t), Py + a * Math.sin(t)];
  const ratioAt = (x, y) => { let mx = 0, mn = Infinity; for (let i = 0; i <= 18; i++) { const c = cOf(i / 18 * Math.PI / 2), d = Math.hypot(c[0] - x, c[1] - y); mx = Math.max(mx, d); mn = Math.min(mn, d); } return [mx / mn, mn, mx]; };
  let F = null, best = null;
  for (let fy = 0.30; fy >= -0.06; fy -= 0.02) for (let fx = 0.08; fx <= 0.40; fx += 0.02) {
    const y = Py + fy; if (wRoot && y > wRoot.y - 0.06) continue;
    const xs = sideX(y), x = Px - 0.03 - fx; if (xs == null || x > xs - 0.04 || x < 0.05) continue;
    const r = ratioAt(sgn * x, y);
    if (!best || r[0] < best.r[0]) best = { p: [sgn * x, y, z], r };
    if (!F && r[0] <= 1.7) F = { p: [sgn * x, y, z], r }; }
  if (!F) F = best;
  const Fp = F ? F.p : [sgn * Math.max(0.05, Px - 0.2), Py, z];
  if (F && F.r[0] > 1.8) why.push('the piston to the corner would need a stroke ' + F.r[0].toFixed(1) + ' times its shortest length - no piston does (a longer arm: a wider track)');
  // (the stowed tyre's top and the leg against the wing: the corner's top under the wing at the pivot)
  if (wRoot && Py + a + 0.022 > wRoot.y - 0.01) why.push('the stowed corner stands ' + Math.round((Py + a + 0.032 - wRoot.y) * 1000) + ' mm into the lower wing at the hull (a shorter arm: narrow the track)');
  return { A0, hub, a, b, knee0, P, F: Fp, ratio: F ? F.r[0] : null, ang: sgn * Math.PI / 2, xc, yc, wantU, why };
}
// every wing plane's skins (a biplane's or a sesquiplane's two; else the one), for the Catalina's clearances
const wingPlanes = () => { const W0 = window.CAGE_WING; if (!W0) return [];
  return (W0.planes && W0.planes.length ? W0.planes : [W0]).filter(pl => pl && pl.underAt && pl.overAt); };
// (P2, the Super Petrel's sesquiplane: the lower wing roots on the hull's side over the Catalina mains) - the lowest
// wing underside over a plan band (x0..x1 outboard, z0..z1), null where no wing is over it
function wingUnderIn(x0, x1, z0, z1) { let y = null;
  for (const pl of wingPlanes()) for (let i = 0; i <= 8; i++) for (let j = 0; j <= 4; j++) {
    const x = x0 + (x1 - x0) * i / 8, z = z0 + (z1 - z0) * j / 4, u = pl.underAt(x, z);
    if (u && (y == null || u.y < y)) y = u.y; }
  return y; }
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
  const h = topOf(C), t = (p[0] - h[0]) * S.dir[0] + (p[1] - h[1]) * S.dir[1] + (p[2] - h[2]) * S.dir[2];
  return t > S.t0 ? [p[0] - S.dir[0] * d, p[1] - S.dir[1] * d, p[2] - S.dir[2] * d] : p;
}
// the cage's copy of the core's arc (gearArc): the folding knee's translation
function arcT(C, g) {
  const A = C && C.arc; if (!A || !A.ang) return null;
  const s = Math.max(0, Math.min(1, 1 - g)) * (C.frac == null ? 1 : C.frac), t = s * s * (3 - 2 * s);
  const v = [A.knee[0] - A.p[0], A.knee[1] - A.p[1], A.knee[2] - A.p[2]], q = fApp(fRot(A.axis, A.ang * t), v);
  return [A.p[0] + q[0] - A.knee[0], A.p[1] + q[1] - A.knee[1], A.p[2] + q[2] - A.knee[2]];
}
// the cage's copy of the core's lift (src/core/62c_gear_mech.js gearLift): the whole unit up its leg
function liftD(C, g) {
  const L = C && C.hoist; if (!L || !(L.d > 0)) return 0;
  const s = Math.max(0, Math.min(1, 1 - g)) * (C.frac == null ? 1 : C.frac), t = Math.max(0, Math.min(1, s / (L.k || 0.6)));
  return L.d * t * t * (3 - 2 * t);
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
  // (the Catalina, P2 v3: THE RISE AND THE POLE SOLVED - the wheel's centre goes from where it stands to its stowed
  // place: level with the leg's head as drawn (the head's height is the side's fitting height, the stations' rule: a
  // wheel's radius and the clearance over the turn of the bilge), its centre 40 mm inside the hull's side (the tyre
  // about half out, as the PBY's); the whole unit rises (the slide, done 60 % of the way up) and turns by the preset's
  // small angle, its head INWARD, about the pole that lands the wheel there)
  const catF = key !== 'T' && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'catalina';
  if (catF && C.turns.length === 1 && SP) {
    const T = C.turns[0], sg = Math.sign(ax[0]) || 1, c0 = ax;
    // (P2, the Super Petrel - the user: "the mechanism needs to be small and the wheel should fit below the wing"): A
    // WING OVER THE MAINS - the lowest wing underside over the leg (its head's plan place to 0.4 m outboard, the wheel's
    // length fore and aft). The head (and the V-strut jack on it) is LIFTED only as far as 30 mm under it (`C.hoist`, the
    // whole unit); the OLEO TELESCOPES the rest (`C.shorten`, the piston and the wheel up the leg), so the stowed wheel's
    // top tucks 20 mm under the wing, half in its round recess. No wing over it: the head lifts the whole way, level
    // with the stowed wheel (v4). The oleo's travel is its piston's length less 50 mm; short of it, the fit says how much
    // higher the wing must be
    const dir = fNrm([c0[0] - h[0], c0[1] - h[1], c0[2] - h[2]]), sDir = u.strut ? fNrm(u.strut) : dir;
    const wU = wingUnderIn(h[0] - sg * 0.05, h[0] + sg * 0.40, c0[2] - C.R, c0[2] + C.R);
    C.catCap = wU != null ? wU - 0.03 : null; C.catWingRaise = 0;
    const trav = u.strutL ? Math.max(0, u.strutL * (1 - (u.cylF || 0.42)) - 0.05) : 0;
    let y1 = h[1], lw = Math.max(0, h[1] - c0[1]), dT = 0;
    if (wU != null) {
      y1 = Math.min(h[1], wU - 0.02 - C.R);
      lw = Math.max(0, Math.min(y1 - c0[1], C.catCap - h[1]));
      dT = Math.max(0, (y1 - c0[1]) - lw);
      if (dT > trav) { C.catWingRaise = dT - trav; dT = trav; y1 = c0[1] + lw + dT; }
      if (C.catWingRaise > 0.01 || y1 - c0[1] < 0.05)
        C.catCapWhy = 'the wing over it leaves ' + Math.round(Math.max(0, y1 - c0[1]) * 1000) + ' mm to rise (the head ' + Math.round(lw * 1000) + ', the oleo ' + Math.round(dT * 1000) + ') - tucked under it, the wheel needs the wing ' + Math.round(Math.max(C.catWingRaise, 0.05) * 1000) + ' mm higher (or a shorter leg)';
    }
    let lo = 0, hi = 3; for (let it = 0; it < 40; it++) { const m2 = (lo + hi) / 2; if (SP.bodyIn([sg * m2, y1, c0[2]]) > 0) lo = m2; else hi = m2; }
    const c1 = [sg * (lo - 0.04), y1, c0[2]];
    const rise = Math.max(0, y1 - c0[1]);
    C.top = h.slice();
    C.hoist = lw > 0 ? { d: lw / Math.max(0.2, -dir[1]), k: 0.6, dir } : null;
    C.shorten = dT > 0 ? { t0: (u.cylF || 0.42) * (u.strutL || Math.hypot(c0[0] - h[0], c0[1] - h[1])), d: dT / Math.max(0.2, -sDir[1]), k: 0.7, dir: sDir } : null;
    C.low = !!u.low; if (C.shorten) C.scissor = u.scissor || null;        // (the piston drawn apart rides the unit always; it slides only when the oleo telescopes)
    // (the turn's sense: the head inward; its angle SOLVED, 6 .. 40 degrees: the least that keeps the stowed leg inside
    // the side - a PBY's side is upright and its leg too, a hull with tumblehome leans it in along its side)
    const vUp = [h[0] - c0[0], h[1] - c0[1], 0], tq = fApp(fRot(T.axis, 0.1), vUp);
    if (sg * tq[0] > sg * vUp[0]) T.axis = T.axis.map(c => -c);
    const cs0 = [c0[0] - dir[0] * (C.hoist ? C.hoist.d : 0) - sDir[0] * (C.shorten ? C.shorten.d : 0), c0[1] - dir[1] * (C.hoist ? C.hoist.d : 0) - sDir[1] * (C.shorten ? C.shorten.d : 0)];
    const poleFor = a => { const th = a * T.axis[2], cs = Math.cos(th), sn = Math.sin(th);
      const rx = c1[0] - (cs * cs0[0] - sn * cs0[1]), ry = c1[1] - (sn * cs0[0] + cs * cs0[1]), det = 2 * (1 - cs);
      return [((1 - cs) * rx - sn * ry) / det, (sn * rx + (1 - cs) * ry) / det, c0[2]]; };
    // (P2 v4, the user 6 Nov: "a single round opening that the wheel comes and closes ... The little leg there will
    // have almost a single point of travel through the wall": the leg stays OUTSIDE, along the hull's side, the wheel
    // inboard of it in the round recess - its lean solved (-20 .. 40 deg, the least) to keep the leg 15 mm off the skin)
    const legPts = []; for (let f = 0; f <= 1.0001; f += 0.05) legPts.push([h[0], h[1] + (c0[1] - h[1]) * f, h[2]]);
    let bestA = null;
    for (let deg = -20; deg <= 40; deg += 1) { if (!deg) continue; T.ang = deg * D2R; C.hinge = poleFor(T.ang);
      let inn = 0; for (const p of poseAll(C, legPts, 0)) inn = Math.max(inn, SP.bodyIn(p) + 0.015);
      const e = Math.max(0, inn) + 0.0005 * Math.abs(deg); if (!bestA || e < bestA.e) bestA = { e, deg }; }
    T.ang = bestA.deg * D2R; C.hinge = poleFor(T.ang);
    C.solved = [+(T.ang / D2R).toFixed(1), +rise.toFixed(3), +lw.toFixed(3), +dT.toFixed(3)];
  }
  // (P2: THE FOLDING KNEE - no turn; the arc carries the unit: its knee from the down place about the arm's pivot, a
  // quarter circle, the leg upright; solved at the station - KNEE[key])
  if (key !== 'T' && kneeFold(P) && KNEE[key]) { const K = KNEE[key];
    C.top = K.knee0.slice(); C.hinge = K.knee0.slice(); C.knee = K;
    C.arc = { p: K.P.slice(), knee: K.knee0.slice(), axis: [0, 0, 1], ang: K.ang };
    C.solved = [+K.a.toFixed(3), +K.b.toFixed(3)]; }
  // (P2, the Super Petrel's V2: THE RIGID L - one 90 deg turn about the pivot, outboard and up; the corner the leg's head)
  const lF = key !== 'T' && lFold(P) && LFOLD[key];
  if (lF) { const K = LFOLD[key];
    C.hinge = K.P.slice(); C.top = K.knee0.slice(); C.lfold = K; C.twist = 0;
    C.turns = [{ axis: [0, 0, 1], ang: K.ang }];
    C.solved = [+K.a.toFixed(3), +K.b.toFixed(3)]; }
  if (SP && preset && !catF && !lF && C.frac >= 0.999 && C.turns.length) {
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
  // P2 (the Skymaster's twist-and-tuck): A MAIN NEVER STOWS ACROSS THE CENTRE LINE - the other main's wheel stows
  // mirrored there; a preset's last turn backs off, a degree at a time, till the stowed tyre keeps 20 mm off it
  // (a TUCK's only - a last turn about the vertical axis, the twist-and-tuck's: an inward fold's crossing is a red fit,
  // the builder's track to widen, never a fold backed off out of the body)
  if (key !== 'T' && preset && !catF && !lF && C.turns.length && C.frac >= 0.999 && Math.abs(C.turns[C.turns.length - 1].axis[1]) > 0.9) {
    const T = C.turns[C.turns.length - 1], sg = Math.sign(h[0]) || 1, rim = wheelRims(C, 16, [1]);
    const inner = () => { const M = foldPose(C, 0); let m = Infinity;
      for (const p0 of rim) { const p = slidePt(C, p0, slideD(C, 0)), q = fApp(M, [p[0] - h[0], p[1] - h[1], p[2] - h[2]]); m = Math.min(m, sg * (h[0] + q[0])); }
      return m; };
    for (let i = 0; i < 60 && inner() < 0.02 && Math.abs(T.ang) > D2R; i++) T.ang -= Math.sign(T.ang) * D2R;
  }
  // the LIFT: how far the wheel's lowest point rises, the gear up (at the fraction), over the ground (the pitch's frame)
  const bottom = (c, a) => c[1] - C.R * Math.sqrt(Math.max(0, 1 - a[1] * a[1]));
  const Mup = foldPose(C, 0), axUp = poseAll(C, [ax], 0)[0];          // (P2: about the fold's own pivot, with its slide)
  C.lift = Math.max(0, bottom(axUp, fApp(Mup, C.wAx)) - bottom(ax, C.wAx));
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
// WELL-CLAMP (the user 9 Nov): a well's ceiling stands WELL_SKIN under the skin over it - the skin and its stringer (the
// 8 mm the nacelle's well kept before) and room. THE UPPER SKIN OVER A PLAN PLACE in a section table's own frame (x off
// its centre line): the top half of its section (surf's angle PI the top, PI/2 the side - nacIn's convention) sampled
// from the top out and read at |x|; null where the section is narrower than |x| there
const WELL_SKIN = 0.015;
function skinTopAt(A, x, z) {
  const ax = Math.abs(x), K = 24;
  let prev = null;
  for (let i = 0; i <= K; i++) {
    const s = A.surf(z, Math.PI - 0.5 * Math.PI * i / K), q = [Math.abs(s[0]), s[1]];
    if (i === 0 && ax <= q[0]) return q[1];
    if (prev && ax >= prev[0] && ax <= q[0]) return prev[1] + (q[0] > prev[0] ? (ax - prev[0]) / (q[0] - prev[0]) : 0) * (q[1] - prev[1]);
    prev = q;
  }
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
  const h = topOf(C), L = [];
  for (const f of [0.25, 0.4, 0.55, 0.7, 0.85]) L.push([h[0] + (c[0] - h[0]) * f, h[1] + (c[1] - h[1]) * f, h[2] + (c[2] - h[2]) * f]);
  return { W, L };
}
const poseAll = (C, pts, g) => { const M = foldPose(C, g), h = C.hinge, d = slideD(C, g), l = liftD(C, g), Lf = C.hoist, ar = arcT(C, g);
  return pts.map(p0 => { const p1 = d ? slidePt(C, p0, d) : p0, p = l && Lf ? [p1[0] - Lf.dir[0] * l, p1[1] - Lf.dir[1] * l, p1[2] - Lf.dir[2] * l] : p1, q = fApp(M, [p[0] - h[0], p[1] - h[1], p[2] - h[2]]); return ar ? [h[0] + q[0] + ar[0], h[1] + q[1] + ar[1], h[2] + q[2] + ar[2]] : [h[0] + q[0], h[1] + q[1], h[2] + q[2]]; }); };
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
  // HULL-B55: a boat hull's cabin ends at its aft bulkhead (the cage's pilPaxA ring, else pilCabA: its floor's station,
  // metres, z forward) - the floor test stands forward of it; null on any other build
  // (and at its front, the windscreen's front ring wsFront: ahead of it is the bow - the nose wheel folds forward into
  // the nose there, as an EDO amphibian float's does)
  const [zCabA, zCabF] = !+P.hullOn ? [null, null] : (() => { try {
    const RR = CG2.cageResolve(CG2.cageSpec(P)), zOf = (...nm) => { for (const n of nm) { const rr = RR.rings.find(q => q.name === n);
      const lv = rr && rr.lv && (rr.lv.floor || rr.lv.waist); if (lv && isFinite(lv.z)) return lv.z * FSm; } return null; };
    return [zOf('pilPaxA', 'pilCabA'), zOf('wsFront')]; } catch (e) { return [null, null]; } })();
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
    // (P2 v4: the Catalina's mains stow OUTSIDE by design - the leg along the hull's side, the wheel half in its round
    // recess, the links' fittings on the skin: its skin test is the recess's - the stowed wheel's centre inside the side)
    const lU = key !== 'T' && lFold(P) && !!C.lfold, catU = key !== 'T' && (sideFold(P) || lU), kneeU = catU && kneeFold(P);
    // (P2: and a Catalina unit's leg, side strut or jack never crosses a wing's skin - any plane, any position)
    if (catU) {
      if (C.catCapWhy) fail('wing', key, word + ': ' + C.catCapWhy, R.fold.concat([st + 'Drop', st + 'R', 'w2Dy']));
      let hit = null;
      FIT_G.forEach((g, gi) => { if (hit) return;
        const pts = posed[key][gi].L.concat(poseAll(C, [topOf(C)], g), MX ? wellMechPts(MX, key, g) : []);
        for (const p of pts) for (const pl of wingPlanes()) { const u = pl.underAt(p[0], p[2]), o = u ? pl.overAt(p[0], p[2]) : null;
          if (u && o && p[1] > u.y - 0.005 && p[1] < o.y + 0.005) { hit = { g, pl: pl.k || 0 }; break; } } });
      if (hit) fail('wing', key, word + '\'s leg, strut or jack crosses the ' + (wingPlanes().length > 1 ? (hit.pl === 1 ? 'second' : 'first') + ' plane' : 'wing') + ' (at gear ' + hit.g + ')',
                    R.fold.concat([st + 'X', st + 'Drop', 'w2Dy'])); }
    // (P2: the folding knee's - the stowed wheel CENTRED on the side line, and its arm, leg and piston hidden: behind
    // the skin, stowed)
    if (kneeU && C.frac >= 0.999) { const c = poseAll(C, [C.axle], 0)[0];
      // (gearKneeDoor: the whole stowed wheel behind the skin, the door's room - KNEE_IN less a few mm - over it)
      if (C.knee && C.knee.full) { let o = 0; for (const p of poseAll(C, wheelRims(C, 24, [1]), 0)) o = Math.max(o, KNEE_IN - 0.008 - bodyIn(p));
        if (o > 0) fail('skin', key, word + ', up, stands ' + Math.round(o * 1000) + ' mm into its door (the full door needs the wheel wholly inside)', R.fold.concat([st + 'X', st + 'R'])); }
      else if (Math.abs(bodyIn(c)) > 0.03) fail('skin', key, word + ', up, is not centred on the side line: its centre ' + Math.round(-bodyIn(c) * 1000) + ' mm ' + (bodyIn(c) < 0 ? 'out of' : 'into') + ' it', R.fold.concat([st + 'X', st + 'R']));
      for (const k of (C.knee && C.knee.why) || []) fail('wing', key, word + ': ' + k, R.fold.concat([st + 'X', st + 'Drop', 'w2Dy']));
      let out = 0; for (const p of posed[key][FIT_G.length - 1].L.concat(poseAll(C, [topOf(C)], 0), MX ? wellMechPts(MX, key, 0) : [])) out = Math.max(out, 0.002 - bodyIn(p));
      if (out > 0) fail('skin', key, word + '\'s arm, leg or piston shows ' + Math.round(out * 1000) + ' mm outside the skin, stowed', R.fold.concat([st + 'X', st + 'Drop', st + 'R'])); }
    // (P2, the Super Petrel's V2: THE RIGID L's - the solve's own words; the flat stowed tyre half in the lower wing
    // (its mid-plane within 15 mm of the underside, its top 8 mm under the upper skin), clear of the hull's side
    // (10 mm), the arm and the leg outside the body at every position)
    if (lU && C.frac >= 0.999) { const K = C.lfold, WL = lowestPlane(), rows = R.fold.concat([st + 'X', st + 'Drop', st + 'R', 'w2Dy']);
      for (const k of K.why) fail('wing', key, word + ': ' + k, rows);
      const rim = poseAll(C, wheelRims(C, 24, [1]), 0), c = poseAll(C, [C.axle], 0)[0];
      if (WL) { const u = WL.underAt(c[0], c[2]);
        if (!u) fail('wing', key, word + ', up, has no lower wing over its tyre', rows);
        else if (Math.abs(c[1] - Math.min(u.y, K.yc)) > 0.015) fail('wing', key, word + '\'s flat tyre, up, sits ' + Math.round((c[1] - u.y) * 1000) + ' mm off the lower wing\'s underside', rows);
        let top = -Infinity; for (const p of rim) { const o = WL.overAt(p[0], p[2]); if (o) top = Math.max(top, p[1] - (o.y - 0.008)); }
        if (top > 0) fail('wing', key, word + '\'s flat tyre, up, stands ' + Math.round(top * 1000) + ' mm through the lower wing\'s top', rows); }
      let inH = 0; for (const p of rim) inH = Math.max(inH, bodyIn(p) + 0.01);
      if (inH > 0) fail('skin', key, word + '\'s flat tyre, up, runs ' + Math.round(inH * 1000) + ' mm into the hull\'s side (a longer leg: a higher lower wing, or a lower axle)', rows);
      let inB = 0; FIT_G.forEach((g, gi) => { for (const p of posed[key][gi].L.concat(poseAll(C, [C.hinge, topOf(C)], g))) inB = Math.max(inB, bodyIn(p) + 0.005); });
      if (inB > 0) fail('skin', key, word + '\'s arm or leg runs ' + Math.round(inB * 1000) + ' mm into the hull', rows); }
    if (catU && !kneeU && !lU && C.frac >= 0.999) { const c = poseAll(C, [C.axle], 0)[0];
      if (!(bodyIn(c) > 0.015)) fail('skin', key, word + ', up, does not sit in its recess: its centre ' + Math.round(-bodyIn(c) * 1000) + ' mm out of the side', R.fold.concat([st + 'R', st + 'Drop'])); }
    // SKIN (fully up, a whole retraction only)
    if (C.frac >= 0.999 && !catU) {
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
    // (HULL-B55: a BOAT's cabin floor runs from its aft bulkhead to its windscreen's front ring - behind it the buoyant
    // hull, ahead of it the bow, no floor: the Super Petrel's mains stow in the hull's side under the lower wing, aft of
    // the cabin, its nose wheel forward into the nose. zCabA / zCabF above; any other build as ever)
    { let worst = 0;
      const inT = catU ? 0.02 : 0;                     // (the Catalina's: its fittings on the skin are not in the cabin)
      posed[key].forEach((ps, gi) => { for (const p of ps.W.concat(ps.L, MX ? wellMechPts(MX, key, FIT_G[gi]) : [])) if (bodyIn(p) > inT && p[1] > floorY - FIT.floor && !(zCabA != null && p[2] < zCabA) && !(zCabF != null && p[2] > zCabF)) worst = Math.max(worst, p[1] - floorY + FIT.floor); });
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
    const catK = sideFold(P) ? new Set(['L', 'R']) : null;                // (P2: the Catalina's, the folding knee's)
    const rawAll = wellRaw(units, bodyIn, MX, catK);
    // GR (the Catalina): A UNIT ENTERING THE BODY THROUGH ITS SIDE is cut from the side - its swept points near the skin
    // (within 40 mm of it), their section's outward direction averaged: mostly lateral (|nx| > 0.6) is a side well
    const sideOf = r => { let nx = 0, n = 0;
      for (const p of r.pts) { if (bodyIn(p) > 0.04) continue; const cy = AF.cyAt(p[2]), l = Math.hypot(p[0], p[1] - cy) || 1; nx += p[0] / l; n++; }
      return n && Math.abs(nx / n) > 0.6 ? Math.sign(nx) : 0; };
    const rawB = [], rawS = [];
    // (the Catalina's recesses are side wells by design - v4's stowed wheel sits where the side turns into the bilge,
    // and the average normal read it as a belly well)
    for (const r of rawAll) { const sd = catK && r.units.every(k => catK.has(k)) ? Math.sign(r.pts.reduce((a, p) => a + p[0], 0)) || 1 : AF ? sideOf(r) : 0;
      if (sd) rawS.push(Object.assign(r, { side: sd })); else rawB.push(r); }
    out.cuts = wellMerge(rawB, mode);
    out.cutsSide = wellMergeSide(rawS, mode);
    if (catK && kneeFold(P)) kneeSlots(out.cutsSide, units, bodyIn, MX);
    if (lFold(P)) lSlots(out.cutsSide, units, bodyIn, MX);
    // GR: THE NACELLES' WELLS - the units' swept points inside a nacelle, cut from below into its skin (the wing's way)
    out.cutsNac = NACS.length ? wellMerge(wellRaw(units, nacIn, MX), mode) : [];
    // (a nacelle well's ceiling held under the nacelle's top: a wheel taller than the nacelle never opens its top)
    // WELL-CLAMP (REAL-FIGURES' TAIL-RETRACT finding, the user 9 Nov: "the well depth clamped to the skin's inner face
    // minus 15 mm, the wheel left proud"): the ceiling was the CENTRE LINE's top less 8 mm for every cell, and a round
    // nacelle's top falls off its centre line - on a shallow one the cells beside it opened the upper skin (a sliver).
    // Each cell now stands WELL_SKIN under the skin over that very cell (skinTopAt); how far the stowed wheel stands
    // above its clamped ceiling is the fit's note (wellClamp: the gearWellCut row's "well clamped: wheel N cm proud")
    let proud = 0;
    for (const c of out.cutsNac) { const H = c.hf;
      for (let j = 0; j < H.nz; j++) for (let i = 0; i < H.nx; i++) {
        const x = H.x0 + i * H.d, z = H.z0 + j * H.d, N = nacAt(x, z);
        if (!N) continue;
        const t = skinTopAt(N.AF, x - N.xc, z), lim = (t != null ? t : N.AF.surf(z, Math.PI)[1]) - WELL_SKIN, k = j * H.nx + i;
        if (H.y[k] > lim) { proud = Math.max(proud, H.y[k] - FIT.clear - lim); H.y[k] = lim; }
      } }
    if (proud >= 0.005) out.wellClamp = { cm: +(proud * 100).toFixed(1) };
    // G5: THE WING'S CUTS - where the units go into the wing (its skins), and where they go into the body (a low wing's
    // centre section runs through a belly well), merged where they meet: the wing layer's skin is cut by these
    // (the wing's sweep takes the leg's AXIS, not its tube: a wing's rest slot sits in its lower skin by the trunnion,
    // and the tube's 70 mm carried the root's well over the centre section's seam, where its loops cannot close)
    // (P2, the Super Petrel's V2 - the rigid L: the mains' cut is in the LOWEST plane, the stowed flat tyre's own round
    // outline, exact - its rims' plan hull, as the Catalina's side recess - and its ceiling the tyre's top and the
    // clearance, under that plane's upper skin)
    const lFw = lFold(P), WW = lFw ? lowestPlane() : W;
    const wingInW = !lFw ? wingIn : p => { if (!WW) return -1; const u = WW.underAt(p[0], p[2]), o = u ? WW.overAt(p[0], p[2]) : null; return u && o ? Math.min(p[1] - u.y, o.y - p[1]) : -1; };
    const lUnits = lFw ? Object.fromEntries(Object.entries(units).filter(([k]) => k !== 'T')) : units;
    out.cutsWing = WW && WW.underAt ? wellMerge(wellRaw(lUnits, wingInW, MX, lFw ? new Set(['L', 'R']) : null, !lFw).concat(lFw ? [] : rawB), lFw ? 'exact' : mode) : [];
    // (each wing cut names the plane whose skin it is cut into: the knife cuts a mesh with its own plane's cuts only)
    { const W0 = window.CAGE_WING, pl = lFw && W0 && W0.planes ? (W0.lowest || 0) : 0; for (const c of out.cutsWing) c.plane = pl; }
    // GR R4 (the user: "when they are not getting it in completely, we would still do the cutouts ... the round cutout for
    // the wheel"): WHERE THE STOWED WHEEL STANDS PROUD of a skin - its points over the wing's upper skin (the top: a hole
    // the knife cuts from above) and its points under the structure's lower skin (the bottom: the doors are cut round
    // it) - each set's plan hull, grown 12 mm. Top in (z, x), bottom in (z, -x), both counter-clockwise
    out.pierce = { top: [], bottom: [] };
    for (const key in units) {
      const Wp = poseAll(units[key].C, wheelRims(units[key].C), 0), top = [], bot = [];   // (the fine rims: a round cutout)
      for (const p of Wp) {
        const o = WW && WW.overAt ? WW.overAt(p[0], p[2]) : null, u = WW && WW.underAt ? WW.underAt(p[0], p[2]) : null;
        const inB = bodyIn(p) > 0.002 || nacIn(p) > 0.002, Nn = nacAt(p[0], p[2]);
        if (o && !inB && p[1] > o.y - 0.002) top.push([p[2], p[0]]);
        if (!inB && !(wingInW(p) > 0.002) && ((Nn && p[1] < Nn.AF.keelAt(p[2]) + 0.002) || (u && p[1] < u.y + 0.002) ||
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
        const o = WW.overAt(x, z); if (o) H.y[j * H.nx + i] = Math.min(H.y[j * H.nx + i], o.y - 0.008);
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
  for (const P of R.parts || []) if (P.rule === 'aim' && (P.name === 'edMech' + key + '_cyl' || P.name === 'edMech' + key + '_arm')) seg(Q.pt(P.from), Q.pt(P.to));
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
  const h = topOf(C), ax = C.axle, d = fNrm([ax[0] - h[0], ax[1] - h[1], ax[2] - h[2]]), r = C.legR || 0.05;
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
    // (`wheelOnly` keys - the Catalina's mains: the recess is the stowed wheel's alone, round (v4: the leg stays outside
    // along the side; the links pass the wall at their fittings))
    const U = units[key], inside = [], wo = wheelOnly && wheelOnly.has(key);
    // (the swept points once per unit and kind, shared by the body's, the nacelles' and the wing's sweeps)
    const ck = wo ? '_swW' : axisOnly ? '_swA' : '_sw';
    if (!U[ck] && wo) U[ck] = [poseAll(U.C, wheelRims(U.C), 0)];        // (v4: the STOWED wheel's rims only - the round opening it closes)
    if (!U[ck]) { const all = wheelRims(U.C, 24, [1]).concat(U.pts.W.filter((p, i) => i === 0 || ((i - 1) % 24) >= 12), axisOnly ? legTube(Object.assign({}, U.C, { legR: 1e-9 })) : legTube(U.C));
      if (MX && !wo && !U._mech) U._mech = WELL_G.map(g => wellMechPts(MX, key, g));    // (the mechanism's, once per unit)
      // (the wing's axis sweep every other pose: its outline is the wheel's and the axis', coarser in time than the tube's)
      U[ck] = WELL_G.map((g, gi) => axisOnly && gi % 2 ? null : poseAll(U.C, all, g).concat(MX && !wo ? U._mech[gi] : [])).filter(Boolean); }
    let prev = null, prevD = null;
    for (const ps of U[ck]) {
      const ds = ps.map(inFn);
      for (let i = 0; i < ps.length; i++) {
        // (P2: a side-stowed wheel's recess is its WHOLE silhouette - the round opening it closes - not just the rim
        // points inside the body: where the side leans in over it, those clipped the circle's top)
        if (ds[i] > 0 || wo) inside.push(ps[i]);
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
// P2 (the user, 6 Nov, the folding knee: "it needs a little cut on top so the folded leg can fit"): THE SLOT OVER THE
// ROUND RECESS - where the leg and the arm pass through the side on their way up and in (the leg pierces the skin above
// the stowed wheel's circle, higher as it goes), a narrow rounded slot from the circle's centre up to the highest
// piercing, the leg's width and the clearance; cut as a side well of its own (`slot`, with its circle's `group`: the
// knife drops the walls between the two - one keyhole opening) on ONE flat floor with the circle, behind the stowed leg
function kneeSlots(cuts, units, bodyIn, MX) {
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (const key of ['L', 'R']) {
    const U = units[key]; if (!U || !U.C || !U.C.knee) continue;
    const C = U.C, K = C.knee, s = K.knee0[0] >= 0 ? 1 : -1, ci = cuts.findIndex(c => c.side === s && c.units.includes(key) && !c.slot);
    if (ci < 0) continue;
    const lr = Math.max(C.legR || 0.05, 0.030), ax = C.axle, kn = K.knee0;
    // (the leg's axis, knee to axle, and the arm's, pivot to knee, every 1 cm, at every pose: where each crosses the skin)
    const legL = [], n = Math.max(4, Math.ceil(dist(kn, ax) / 0.01));
    for (let i = 0; i <= n; i++) legL.push(lerp(kn, [kn[0], ax[1], kn[2]], i / n));
    let yTop = -Infinity, deep = -Infinity;
    for (const g of WELL_G) {
      const L = poseAll(C, legL, g), A = MX ? MX.CM.gearMechPoints(MX.R, g) : null;
      const arm = A ? (() => { const k1 = A.pt({ unit: key, p: kn }), o = []; for (let i = 0; i <= 20; i++) o.push(lerp(K.P, k1, i / 20)); return o; })() : [];
      for (const line of [L, arm]) { const d = line.map(bodyIn);
        for (let i = 0; i + 1 < line.length; i++) if ((d[i] > 0) !== (d[i + 1] > 0) || Math.abs(d[i]) < lr) {
          const t = Math.abs(d[i] - d[i + 1]) > 1e-9 && (d[i] > 0) !== (d[i + 1] > 0) ? d[i] / (d[i] - d[i + 1]) : 0, q = lerp(line[i], line[i + 1], t);
          yTop = Math.max(yTop, q[1]); } }
      for (const q of L.concat(arm)) if (bodyIn(q) > 0) deep = Math.max(deep, -s * q[0]); }
    const c0 = poseAll(C, [ax], 0)[0], top = c0[1] + C.R + FIT.clear;
    if (!(yTop + lr > top + 0.01)) continue;
    const z = kn[2], uv = [];
    for (const y of [c0[1], yTop + lr]) for (const u of [z - lr, z + lr]) uv.push([u, -s * y]);
    const hull = wellOutline(uv, 'exact', FIT.clear);
    // (one flat floor for the keyhole: behind the stowed leg and the wheel both)
    const A0 = cuts[ci], fl = Math.max(deep + FIT.clear, A0.hf.e[0]);
    A0.hf.e = A0.hf.e.map(() => fl); A0.ceil = Math.max(A0.ceil, fl); A0.group = key;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of hull) { u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]); }
    const d = WELL_CELL, nu = Math.max(2, Math.ceil((u1 - u0) / d) + 1), nv = Math.max(2, Math.ceil((v1 - v0) / d) + 1);
    cuts.push({ units: [key], side: s, mode: A0.mode, frame: A0.frame, hull, ceil: fl, slot: true, group: key,
                yTop: yTop + lr, hf: { u0, v0, d, nu, nv, e: new Array(nu * nv).fill(fl) } });
  }
}
// P2 (the Super Petrel's V2, the rigid L): THE PISTON'S SLOT - where the piston from inside the hull passes the side to
// the corner over the turn (its line's crossings of the skin, at every WELL_G pose), a rounded slot its width and 20 mm
// round it; a side well of its own, 70 mm deep (the piston runs on through its floor, inside)
function lSlots(cuts, units, bodyIn, MX) {
  if (!MX) return;
  for (const key of ['L', 'R']) {
    const U = units[key]; if (!U || !U.C || !U.C.lfold) continue;
    const C = U.C, K = C.lfold, s = K.knee0[0] >= 0 ? 1 : -1, cr = [];
    for (const g of WELL_G) { const Q = MX.CM.gearMechPoints(MX.R, g), e = Q.pt({ unit: key, p: K.knee0 }), line = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40; line.push([K.F[0] + (e[0] - K.F[0]) * t, K.F[1] + (e[1] - K.F[1]) * t, K.F[2] + (e[2] - K.F[2]) * t]); }
      const d = line.map(bodyIn);
      for (let i = 0; i + 1 < line.length; i++) if ((d[i] > 0) !== (d[i + 1] > 0)) { const t = d[i] / (d[i] - d[i + 1]);
        cr.push([line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t, line[i][2] + (line[i + 1][2] - line[i][2]) * t]); } }
    if (cr.length < 2) continue;
    const rc = MECH.rCyl[0] + 0.02, uv = cr.map(p => [p[2], -s * p[1]]), hull = wellOutline(uv, 'exact', rc);
    const fl = 0.07 - Math.min(...cr.map(p => Math.abs(p[0])));
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of hull) { u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]); }
    const d = WELL_CELL, nu = Math.max(2, Math.ceil((u1 - u0) / d) + 1), nv = Math.max(2, Math.ceil((v1 - v0) / d) + 1);
    cuts.push({ units: [key], side: s, mode: 'exact', frame: { n0: [s, 0, 0], c0: [0, 0, 0], t1: [0, 0, 1], t2: [0, -s, 0] }, hull, ceil: fl, pistonSlot: true,
                hf: { u0, v0, d, nu, nv, e: new Array(nu * nv).fill(fl) } });
  }
}
function cutsSideCage(cuts, FS) {
  return (cuts || []).map(c => {
    let o = c.hull.map(p => [p[0] / FS, p[1] / FS]), a2 = 0;
    for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
    if (a2 < 0) o = o.slice().reverse();
    return { units: c.units, side: c.side, mode: c.mode, frame: c.frame, outline: o, ceil: c.ceil / FS, ...(c.group ? { group: c.group } : {}), ...(c.slot ? { slot: true } : {}),
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
    return { units: c.units, mode: c.mode, outline: o, ceil: c.ceil / FS, ...(hf ? { hf } : {}), ...(c.plane ? { plane: c.plane } : {}) };
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
  // WILGA-GEAR: a trailing-link leg whose tyre enters the body at full stroke turns its drop and its full-stroke rows red
  const lvBad = G && G.leverBad;
  if (!fit) return lvBad && Object.keys(lvBad).length ? Object.assign({}, lvBad) : null;
  const rows = Object.assign({}, fit.rows, lvBad || {});
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
// RETRACT-LAB (SEAPLANES-LAND 7 Nov; the user: the retract wheels are "not great yet ... not final"): THE RETRACT
// OPTIONS STAND BEHIND ONE SWITCH until a retract quality pass - the developer's toggle (the flight rail's "dev ›",
// pref flydiy.flDev), ?retract=lab, or window.FLYDIY_RETRACT_LAB (the headless rigs set it: they see every row). Off,
// the player's garage: a build that does not retract shows no retract row (nor the Retraction tile); a build that does
// (the Super Petrel) shows the preview, the cycle time and the actuation - never the fold, the wells or the doors it was
// tuned on. ROWS ONLY: the spec, the save, the flight, the gear key, the lamps and the autopilot never read it.
const RETRACT_LAB = () => {
  try {
    if (typeof window.FLYDIY_RETRACT_LAB === 'boolean') return window.FLYDIY_RETRACT_LAB;
    // no page (node: the gates, the tools) - no player to hide it from: the lab's rows are all there
    if (typeof location === 'undefined') return true;
    // SEA-ON (10 Nov, the user: "I need to see these things and play with it; I'm still the sole player"): the hulls
    // and the retractable gear are ON by default in the player's garage too. ?retract=off is the way back (a session's
    // look at the old garage); ?retract=lab and the dev toggle still say on
    if (/[?&]retract=off\b/.test(location.search || '')) return false;
    return true;
  } catch (e) { return true; }
};
window.CAGE_RETRACT_LAB = RETRACT_LAB;
// SEA-OFF (SEAPLANES-LAND 8 Nov; the user: seaplanes + retract land on master SWITCHED OFF first, then a thorough
// testing round): THE SAME SWITCH HIDES THE MERGE'S OTHER NEW ROWS from the player's garage - the boat hull (hullOn:
// every hull row hangs off it), the pylon / fin / nacelle-over engine rows, the cabane's pylon and drawn rows, the tip's
// own shape. A row shows while the switch is on (the dev toggle, ?retract=lab, every node rig) or while the build
// holds it off its OFF value here (a lab build stays editable); hidden at OFF, the build is master's. The values are
// the rows' own defaults (60_gen_spec GEN_HULL_ROW_OFF, _cage_gen CAGE_DEFAULT_ABSENT). ROWS ONLY, as RETRACT_LAB:
// _cage_ui applyRowVis reads it; the spec, the save, the flight and the certificate never do. The retract and
// amphibian rows keep their own rules (gearRetract, fltAmph above and in _cage_float).
window.CAGE_LAB_ROWS = {
  hullOn: 0,
  engPylonAt: 0, engPylonAft: 0.15, engPylonFwd: 0, engPylonForm: 0, engPylonFair: 0,
  engNacOver: 0, engNacLift: 0, engFinAt: 0.55, engFinFwd: 0,
  bpCabPylon: 0, bpCabDraw: 1, bpStrutK: 1,
  wgTipBow: 0, wgTipDroop: 0, wgTipFull: 1,
  cw_inletOn: 0,   // the pusher nacelle's air inlet (HULL-B25; its own rows hang off it)
};
// (A0 7 Nov: "fixing gearRetract shows on every build is welcome"): the switch is offered where it can act -
// GEAR_RETRACTABLE's own wheels (a nose wheel, not floats: the group's own when) - and stays while it is on, so a
// build saved retractable on a tailwheel can still switch it off
const RETRACT_CAN = P => !!(+P.s2On && Math.round(+P.s2Leg) !== 3);
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
    ['gearRetract', 'retraction (a tricycle\'s)', 0, 1, 1, ['fixed', 'retractable'], { when: P => RETRACT_LAB() && (RETRACT_CAN(P) || +P.gearRetract > 0), note: P => +P.gearRetract ? fitNote() : '' }],
    ['gearRetT', 'cycle time, s (one way)', 2, 20, 0.5, { when: P => +P.gearRetract }],
    ['gearRetAct', 'actuation', 0, 2, 1, ['electric', 'hydraulic', 'manual (Johnson bar)'], { when: P => +P.gearRetract }],
    // G1 (RETRACT-STUDY §8.1): THE FOLD. A preset per unit, or 'custom': up to two turns, each about a body axis
    // (fore-aft / lateral / vertical) by a signed angle whose + is PROBED (the axle moves inboard on fore-aft and
    // vertical, aft on lateral), plus the wheel's own twist about its leg (to lie flatter); the mains' rows are the
    // port unit's, the starboard mirrors them. The fraction stops the whole chain part way (the wheel in its inset)
    ['gearPos', 'gear position (preview: 1 down, 0 up)', 0, 1, 0.01, { when: P => +P.gearRetract }],
    // WILGA-GEAR: the trailing-link leg's compression, previewed (0 extended, as in flight .. 1 full stroke)
    ['gearLvPos', 'trailing-link preview (0 extended .. 1 full stroke)', 0, 1, 0.01, { when: P => Math.round(+P.s1Leg) === 4 && +P.s1On }],
    ['gearFold', 'mains fold', 0, FOLD_KEYS.length - 1, 1, FOLD_KEYS.map(k => FOLD_LABELS[k]), { when: P => RETRACT_LAB() && +P.gearRetract }],
    ['gm1Ax', 'mains turn 1: axis', 0, 2, 1, FOLD_AX_LABELS, { when: P => RETRACT_LAB() && +P.gearRetract && foldCustom(P) }],
    ['gm1Ang', 'mains turn 1: angle °', -180, 180, 1, { when: P => RETRACT_LAB() && +P.gearRetract && foldCustom(P) }],
    ['gm2Ax', 'mains turn 2: axis', 0, 2, 1, FOLD_AX_LABELS, { when: P => RETRACT_LAB() && +P.gearRetract && foldCustom(P) }],
    ['gm2Ang', 'mains turn 2: angle ° (0: none)', -180, 180, 1, { when: P => RETRACT_LAB() && +P.gearRetract && foldCustom(P) }],
    ['gmTwist', 'mains wheel twist ° (about the leg)', -90, 90, 1, { when: P => RETRACT_LAB() && +P.gearRetract && foldCustom(P) }],
    ['gearFoldNose', 'nose fold', 0, FOLD_NOSE_KEYS.length - 1, 1, FOLD_NOSE_KEYS.map(k => FOLD_LABELS[k]), { when: P => RETRACT_LAB() && +P.gearRetract }],
    ['gn1Ax', 'nose turn 1: axis', 0, 2, 1, FOLD_AX_LABELS, { when: P => RETRACT_LAB() && +P.gearRetract && foldNoseCustom(P) }],
    ['gn1Ang', 'nose turn 1: angle °', -180, 180, 1, { when: P => RETRACT_LAB() && +P.gearRetract && foldNoseCustom(P) }],
    ['gn2Ax', 'nose turn 2: axis', 0, 2, 1, FOLD_AX_LABELS, { when: P => RETRACT_LAB() && +P.gearRetract && foldNoseCustom(P) }],
    ['gn2Ang', 'nose turn 2: angle ° (0: none)', -180, 180, 1, { when: P => RETRACT_LAB() && +P.gearRetract && foldNoseCustom(P) }],
    ['gnTwist', 'nose wheel twist ° (about the leg)', -90, 90, 1, { when: P => RETRACT_LAB() && +P.gearRetract && foldNoseCustom(P) }],
    ['gearRetFrac', 'retracts (fraction of the fold)', 0.3, 1, 0.05, { when: P => RETRACT_LAB() && +P.gearRetract }],
    // G4 (RETRACT-STUDY §8.10): THE WELL'S OUTLINE, always cut exactly into the skin - the swept unit's own plan hull,
    // or a rounded box round it (the fallback the user asked to keep: "so we have a fallback in case we struggle")
    ['gearWellCut', 'well outline', 0, 1, 1, ['exact (the swept unit\'s hull)', 'box (a rounded rectangle)'], { when: P => RETRACT_LAB() && +P.gearRetract,
     // WELL-CLAMP: a nacelle well held under its skin with the stowed wheel above it - how far, the fit's own number
     note: () => { const F = window.CAGE_GEAR && window.CAGE_GEAR.fit; return F && F.wellClamp ? 'well clamped: wheel ' + F.wellClamp.cm + ' cm proud' : ''; } }],
    // G6 (§8.13): THE DOORS - the exact outline's skin rides on the leg (the leg door) and what is left is the well's
    // door(s); the box's are its door(s) alone: one, or two split along the well (the user: "One, or 2, slitting in
    // the middle")
    ['gearLegDoor', 'leg door (the skin on the leg)', 0, 1, 1, ['off', 'on'], { when: P => RETRACT_LAB() && +P.gearRetract && +P.gearWellCut !== 1 }],
    // GR: the shortening (the piston slides into its cylinder as the gear comes up: a long leg stows shorter)
    ['gearShort', 'mains shorten as they retract (share of the leg)', 0, 0.45, 0.05, { when: P => RETRACT_LAB() && +P.gearRetract }],
    ['gearShortNose', 'nose leg shortens as it retracts', 0, 0.45, 0.05, { when: P => RETRACT_LAB() && +P.gearRetract }],
    // GR: THE NACELLE FITTED TO THE GEAR (the cowl layer's nacGearFit: deeper, lower, longer - the engine, the cowl and
    // the nacelle together) - on by default; and the stand-alone gear pod under the nacelle (nacPodBuild), a separate
    // option
    ['gearNacFit', 'fit the nacelle to the gear (deeper, lower, longer)', 0, 1, 1, ['off', 'on'], { when: P => RETRACT_LAB() && +P.gearRetract && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'nacelle' }],
    // P2 (the user, 6 Nov: "a version with full doors"): the folding knee's - an open recess (the wheel half out), or
    // the wheel wholly inside and a door riding the leg that closes the side over it
    ['gearKneeDoor', 'folding knee: the side recess', 0, 2, 1, ['open (the wheel half out)', 'full door on the leg (the wheel inside)', 'full door on the hull, hinged at the top'], { when: P => RETRACT_LAB() && +P.gearRetract && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'knee' }],
    ['gearNacPod', 'a separate gear pod under the nacelle', 0, 1, 1, ['off', 'on'], { when: P => RETRACT_LAB() && +P.gearRetract && FOLD_KEYS[Math.round(+P.gearFold || 0)] === 'nacelle' }],
    ['gearDoors', 'well doors', 0, 2, 1, ['none (open well)', 'one door', 'two doors (split)'], { when: P => RETRACT_LAB() && +P.gearRetract }],
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
                          wellHitsTank,                                                         // G3: the reservation
                          // WELL-CLAMP: the skin over a plan place and this build's nacelle there (GATE RETRACT 20)
                          skinTopAt, WELL_SKIN, nacAt: (x, z) => nacAt(x, z) };

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
    if (C.low) R.parts.push(Object.assign({ name: 'edMechLow' + k, rule: 'rigid', unit: k, o0: C.hinge.slice() }, C.shorten ? { slide: true } : {}));
    // the torque scissor as a knee: its upper arm on the cylinder, its lower on the piston (slid), the knee forward
    if (C.shorten && C.scissor) { const Sc = C.scissor, kid = 'sc' + k, la = dist(Sc.a0, Sc.knee), lb2 = dist(Sc.knee, Sc.a2);
      const bendP = [Sc.knee[0] + Sc.fwd[0] * 0.05, Sc.knee[1] + Sc.fwd[1] * 0.05, Sc.knee[2] + Sc.fwd[2] * 0.05];
      // (the bend's reference rides the cylinder: its point moved up the leg above the gland)
      const bRef = (() => { const S = C.shorten, h = topOf(C), t = sub3(bendP, h), tt = t[0] * S.dir[0] + t[1] * S.dir[1] + t[2] * S.dir[2];
        return tt > S.t0 - 0.01 ? [bendP[0] - S.dir[0] * (tt - S.t0 + 0.02), bendP[1] - S.dir[1] * (tt - S.t0 + 0.02), bendP[2] - S.dir[2] * (tt - S.t0 + 0.02)] : bendP; })();
      R.knees[kid] = { s: { unit: k, p: Sc.a0 }, l: { unit: k, p: Sc.a2 }, a: la, b: lb2, bend: { unit: k, p: bRef } };
      R.parts.push({ name: 'edMech' + k + '_sc1', rule: 'aim', from: { unit: k, p: Sc.a0 }, to: { knee: kid }, o0: Sc.a0, d0: nrm(sub3(Sc.knee, Sc.a0)) },
                   { name: 'edMech' + k + '_sc2', rule: 'aim', from: { unit: k, p: Sc.a2 }, to: { knee: kid }, o0: Sc.a2, d0: nrm(sub3(Sc.knee, Sc.a2)) });
      for (const [nm, p0, q0] of [['_sc1', Sc.a0, Sc.knee], ['_sc2', Sc.a2, Sc.knee]]) partGroup('edMech' + k + nm, b => {
        const path = KT.resample([p0, q0], 4);
        KT.sweep(b.alloy, path, t => KT.secBlade(0.030 - 0.006 * Math.abs(t - 0.5), 0.011), true, Sc.pax);
        for (const p of [p0, q0]) KT.revolve(b.bronze, KT.off(p, Sc.pax, -0.012), Sc.pax, [[0.008, 0], [0.008, 0.024]], 10, true);
      }); }
    const h = topOf(C), ax = C.axle, Mup = CM.gearFoldPose(C, 0), D0up = CM.gearSlide(C, 0), L0up = CM.gearLift(C, 0), up = p => CM.gearUnitPt(C, Mup, p, D0up, L0up);
    const legPt = f => lerp(h, ax, f);
    // (P2: THE FOLDING KNEE'S LINKS - the arm from its pivot P just inside the wall to the knee (the leg's head), with
    // its HORN at the pivot (the user, 6 Nov: "a little piston on the folding knee, at the place where the rotating joint
    // is, and anchoring higher up on the fuselage"); the little piston from its fitting F high inside the hull to the
    // horn's end: barrel from F, rod from the horn; lugs at P and F, the knee's pin on the leg. Stowed, all behind the skin)
    // (P2, the Super Petrel's V2: THE RIGID L's ARM - rigid with the unit, from the pivot's boss on the hull's side out
    // to the corner; the piston (the user's sketch) from its fitting F inside the hull, through the side, to the corner;
    // lugs at P and F)
    if (k !== 'T' && C.lfold) { const K = C.lfold, kn = K.knee0, sg = kn[0] >= 0 ? 1 : -1, pn = [0, 0, 1];
      const dA = nrm(sub3(kn, K.P));
      R.parts.push({ name: 'edMech' + k + '_arm', rule: 'rigid', unit: k });
      partGroup('edMech' + k + '_arm', b => {
        KT.boxIn(b.alloy, lerp(K.P, kn, 0.5), [dist(K.P, kn) / 2 + 0.02, 0.022, 0.030], dA, nrm(crs(pn, dA)), pn);
        for (const q of [K.P, kn]) KT.revolve(b.steel, KT.off(q, pn, -0.040), pn, [[0.020, 0], [0.020, 0.080]], 14, true);
      });
      const hornPt = { unit: k, p: kn };          // (the piston's end: the corner's pin)
      let Dmax = 0, Dmin = Infinity; for (let i = 0; i <= 24; i++) { const d = dist(K.F, CM.gearMechPoints(R, 1 - i / 24).pt(hornPt)); Dmax = Math.max(Dmax, d); Dmin = Math.min(Dmin, d); }
      const hn = kn, rc = MECH.rCyl[0], Lb = Math.max(0.08, Dmin - 0.03), Lr = Math.max(0.05, Math.min(Dmin - 0.02, Dmax - Lb + 0.04)), d0 = nrm(sub3(hn, K.F));
      R.parts.push({ name: 'edMech' + k + '_lcyl', rule: 'aim', from: { fix: K.F }, to: hornPt, o0: K.F, d0 },
                   { name: 'edMech' + k + '_lrod', rule: 'aim', from: hornPt, to: { fix: K.F }, o0: hn, d0: d0.map(x => -x) });
      partGroup('edMech' + k + '_lcyl', b => { KT.revolve(b.alloy, K.F, d0, [[0.008, 0], [rc, 0.016], [rc, Lb - 0.010], [rc * 0.8, Lb]], 16, true); });
      partGroup('edMech' + k + '_lrod', b => { KT.revolve(b.chrome || b.steel, hn, d0.map(x => -x), [[MECH.rRod * 0.8, 0], [MECH.rRod * 0.8, Lr]], 12, true); });
      for (const q of [K.P, K.F]) { for (const s2 of [-1, 1]) KT.lug(fix.alloy, KT.off(q, pn, s2 * 0.045), pn, [sg, 0, 0], 0.022, 0.008, 0.040);
        KT.revolve(fix.bronze, KT.off(q, pn, -0.055), pn, [[0.007, 0], [0.007, 0.110]], 10, true); }
      info[k] = { lGeo: { P: K.P, a: +K.a.toFixed(3), b: +K.b.toFixed(3), F: K.F, ratio: K.ratio && +K.ratio.toFixed(2), stroke: +(Dmax - Dmin).toFixed(3), Dmin: +Dmin.toFixed(3),
                          xc: +K.xc.toFixed(3), yc: +K.yc.toFixed(3) } };
      continue; }
    if (k !== 'T' && C.knee && C.arc) { const K = C.knee, kn = K.knee0, sg = kn[0] >= 0 ? 1 : -1, pn = [0, 0, 1];
      const dA = nrm(sub3(kn, K.P)), armTo = { unit: k, p: kn };
      R.parts.push({ name: 'edMech' + k + '_arm', rule: 'aim', from: { fix: K.P }, to: armTo, o0: K.P, d0: dA });
      partGroup('edMech' + k + '_arm', b => {
        KT.boxIn(b.alloy, lerp(K.P, kn, 0.5), [dist(K.P, kn) / 2, 0.022, 0.030], dA, nrm(crs(pn, dA)), pn);
        // (the horn: a plate from the pivot's boss to the horn's pin, as thick as the arm)
        const dH = nrm(sub3(K.horn0, K.P));
        KT.boxIn(b.alloy, lerp(K.P, K.horn0, 0.5), [K.h / 2 + 0.012, 0.020, 0.024], dH, nrm(crs(pn, dH)), pn);
        for (const q of [K.P, kn]) KT.revolve(b.steel, KT.off(q, pn, -0.040), pn, [[0.020, 0], [0.020, 0.080]], 14, true);
        KT.revolve(b.steel, KT.off(K.horn0, pn, -0.032), pn, [[0.012, 0], [0.012, 0.064]], 12, true);
      });
      // (the horn's end rides the arm: on the arm's line from P, hornR along it and hornS across, in the swing's sense)
      const hornPt = { along: [{ fix: K.P }, armTo], r: K.hornR, s: K.hornS, ax: [0, 0, sg] };
      const Qh = g => CM.gearMechPoints(R, g).pt(hornPt);
      let Dmax = 0, Dmin = Infinity; for (let i = 0; i <= 24; i++) { const d = dist(K.F, Qh(1 - i / 24)); Dmax = Math.max(Dmax, d); Dmin = Math.min(Dmin, d); }
      const hn = K.horn0, rc = MECH.rCyl[0], Lb = Math.max(0.08, Dmin - 0.03), Lr = Math.max(0.05, Math.min(Dmin - 0.02, Dmax - Lb + 0.04)), d0 = nrm(sub3(hn, K.F));
      R.parts.push({ name: 'edMech' + k + '_cyl', rule: 'aim', from: { fix: K.F }, to: hornPt, o0: K.F, d0 },
                   { name: 'edMech' + k + '_rod', rule: 'aim', from: hornPt, to: { fix: K.F }, o0: hn, d0: d0.map(x => -x) });
      partGroup('edMech' + k + '_cyl', b => { KT.revolve(b.alloy, K.F, d0, [[0.008, 0], [rc, 0.016], [rc, Lb - 0.010], [rc * 0.8, Lb]], 16, true); });
      partGroup('edMech' + k + '_rod', b => { KT.revolve(b.chrome || b.steel, hn, d0.map(x => -x), [[MECH.rRod * 0.8, 0], [MECH.rRod * 0.8, Lr]], 12, true); });
      for (const q of [K.P, K.F]) { for (const s2 of [-1, 1]) KT.lug(fix.alloy, KT.off(q, pn, s2 * 0.045), pn, [sg, 0, 0], 0.022, 0.008, 0.040);
        KT.revolve(fix.bronze, KT.off(q, pn, -0.055), pn, [[0.007, 0], [0.007, 0.110]], 10, true); }
      info[k] = { kneeGeo: { P: K.P, a: +K.a.toFixed(3), b: +K.b.toFixed(3), F: K.F, horn: +K.h.toFixed(3), stroke: +(Dmax - Dmin).toFixed(3), Dmin: +Dmin.toFixed(3), y1: +K.y1.toFixed(3) } };
      continue; }
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
          const g = i / 10, Mg = CM.gearFoldPose(C, g), l = CM.gearUnitPt(C, Mg, Lp, CM.gearSlide(C, g), CM.gearLift(C, g)), kn = CM.gearKnee(S, l, D / 2, D / 2, B, null);
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
      // P2 v3 - THE PBY-5A's SIDE STRUT (the Canso handbook, Fig 12-13): from a fitting INSIDE the hull to the leg near
      // its head, straight and locked gear down, folding its knee DOWN as the leg rises and comes in. Its hull pivot is
      // searched inside the side (20-300 mm in, from the head's stowed height down to its rest height) for the strut
      // longest gear down - a link that must stretch is no link - and the most level there
      const sg = h[0] >= 0 ? 1 : -1, Lp = legPt(0.10), dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const path = []; for (let i = 0; i <= 24; i++) { const g = 1 - i / 24; path.push(CM.gearUnitPt(C, CM.gearFoldPose(C, g), Lp, CM.gearSlide(C, g), CM.gearLift(C, g))); }
      const yTop = Math.min(Math.max(...path.map(q => q[1])), C.catCap != null ? C.catCap : Infinity);
      let bestS = null;
      for (let yi = 0; yi <= 12; yi++) { const y = Lp[1] + (yTop - Lp[1]) * yi / 12;
        let lo = 0, hi = 3; for (let it = 0; it < 40; it++) { const m2 = (lo + hi) / 2; if (SP.bodyIn([sg * m2, y, Lp[2]]) > 0) lo = m2; else hi = m2; }
        for (const dIn of [0.004]) {                                       // (v4: the fitting ON the skin - one point through the wall)
          const S0 = [sg * (lo - dIn), y, Lp[2]], D0 = dist2(S0, Lp);
          let mx = 0; for (const q of path) mx = Math.max(mx, dist2(S0, q));
          const ok = mx <= D0 + 0.002, lev = Math.abs(S0[1] - Lp[1]) / D0;
          const sc = (ok ? 0 : 10 + (mx - D0)) + lev;
          if (!bestS || sc < bestS.sc) bestS = { sc, S: S0, D: D0, ok }; } }
      const S = bestS.S, D = bestS.D;
      br = { Lp, S, D, bend: [(S[0] + Lp[0]) / 2, Math.min(S[1], Lp[1]) - 2 * D, S[2]], worst: bestS.ok ? 0 : -0.01 };
      info.catStrut = bestS.ok;
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
    // THE ACTUATOR
    // (P2 v3 - THE PBY-5A's V-STRUT AND ITS JACK, the Canso handbook: "the main actuating cylinder floats between a
    // bracket near the upper end of the main strut and a bracket on the forward leg of the upper V-strut. By
    // contracting ... pulling the gear upward and into the well": from a fitting high inside the hull's side to the
    // leg's head - its barrel from the hull, its rod from the head, the barrel as long as the shortest it closes to; the
    // fitting raised (0.6 .. 1.6 x the leg's length over the head) till the stroke is a real cylinder's)
    if (catM && SP) {
      const sg = h[0] >= 0 ? 1 : -1, Lg = dist(h, ax), dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const hp = []; for (let i = 0; i <= 24; i++) { const g = 1 - i / 24; hp.push(CM.gearUnitPt(C, CM.gearFoldPose(C, g), h, CM.gearSlide(C, g), CM.gearLift(C, g))); }
      let pickU = null;
      for (let f = C.catCap != null ? 0.2 : 0.6; f <= 1.61; f += 0.1) { const y = h[1] + f * Lg;
        if (C.catCap != null && y > C.catCap) break;                         // (P2: never over the wing over it)
        let lo = 0, hi = 3; for (let it = 0; it < 40; it++) { const m2 = (lo + hi) / 2; if (SP.bodyIn([sg * m2, y, h[2]]) > 0) lo = m2; else hi = m2; }
        if (lo < 0.6 * Math.abs(h[0])) break;                          // (above the side: the cabin's top, not a fitting's place)
        const U = [sg * (lo - 0.004), y, h[2]], ds = hp.map(q => dist2(U, q)), Dmax = Math.max(...ds), Dmin = Math.min(...ds);
        pickU = { U, Dmax, Dmin }; if (Dmax <= 2 * Dmin - 0.08) break; }
      if (!pickU) { const U = [h[0] - sg * 0.05, Math.min(h[1] + 0.6 * Lg, C.catCap != null ? C.catCap : Infinity), h[2]], ds = hp.map(q => dist2(U, q)); pickU = { U, Dmax: Math.max(...ds), Dmin: Math.min(...ds) }; }
      const { U, Dmax, Dmin } = pickU, Lb = Math.max(0.10, Dmin - 0.03), Lr = Math.min(Dmin - 0.02, Dmax - Lb + 0.04), d0 = nrm(sub3(h, U));
      const pnV = [0, 0, 1], rc = MECH.rCyl[1];   // (its pins fore-aft: the swing is in the section's plane)
      R.parts.push({ name: 'edMech' + k + '_cyl', rule: 'aim', from: { fix: U }, to: { unit: k, p: h }, o0: U, d0 },
                   { name: 'edMech' + k + '_rod', rule: 'aim', from: { unit: k, p: h }, to: { fix: U }, o0: h, d0: d0.map(x => -x) });
      partGroup('edMech' + k + '_cyl', b => {
        KT.revolve(b.alloy, U, d0, [[0.010, 0], [rc, 0.018], [rc, Lb - 0.012], [rc * 0.8, Lb]], 18, true);
        KT.revolve(b.steel, KT.off(U, pnV, -0.010), pnV, [[0.015, 0], [0.015, 0.020]], 12, true);
      });
      partGroup('edMech' + k + '_rod', b => {
        KT.revolve(b.chrome || b.steel, h, d0.map(x => -x), [[MECH.rRod, 0], [MECH.rRod, Lr]], 12, true);
        KT.revolve(b.steel, KT.off(h, pnV, -0.010), pnV, [[0.013, 0], [0.013, 0.020]], 12, true);
      });
      for (const s2 of [-1, 1]) KT.lug(fix.alloy, KT.off(U, pnV, s2 * 0.018), pnV, [sg, 0, 0], 0.020, 0.008, 0.040);
      KT.revolve(fix.bronze, KT.off(U, pnV, -0.026), pnV, [[0.007, 0], [0.007, 0.052]], 10, true);
      info[k].jack = { U, stroke: +(Dmax - Dmin).toFixed(3), ok: Dmax <= 2 * Dmin - 0.08 };
    }
    if (act === 2 || catM) continue;
    // GR R2 (the user: "you have your piston still sticking out at the end"): THE BASE IS PLACED INSIDE - searched along
    // the actuator point's stowed line from the trunnion (2.8 .. 1.5 x its offset) and turned off it in the swing plane
    // (0, +-15, +-30, +-45 deg), the first whose base AND barrel (stowed, to the leg) are 8 mm inside the structure and
    // whose stroke is a real cylinder's; none: the deepest with a real stroke, and the fit's 'actuator' turns red
    const La = legPt(MECH.actPt), Lu = up(La);
    const swAx = C.turns.length ? C.turns[0].axis : nrm(crs(legUp0, [1, 0, 0]));
    const stroke = A0 => { let lo = Infinity, hi = -Infinity;
      for (let i = 0; i <= 32; i++) { const d = dist(A0, CM.gearUnitPt(C, CM.gearFoldPose(C, 1 - i / 32), La, CM.gearSlide(C, 1 - i / 32), CM.gearLift(C, 1 - i / 32))); lo = Math.min(lo, d); hi = Math.max(hi, d); }
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
function fittingsDraw(fits, fit, group, KT, roomX) {
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
    const yc = ceilAt(c); let reach = Math.max(0.025, Math.min(0.40, yc != null ? yc - c[1] : 0.05));
    const lugR = Math.min(reach, 0.055), at = d => KT.off(c, up, d), lug = F.w + F.t / 2;
    // (P2: inside a nacelle the plate keeps inside its skin - where the nacelle's top narrows to a ridge under the wing,
    // it lands lower, on the nacelle's own frame, where the skin leaves the lugs their room)
    const roomAt = d => roomX && Math.abs(pax[0]) > 0.7 ? roomX(c, at(d)[1]) - 0.004 : Infinity;
    while (reach > lugR + 0.012 && roomAt(reach) < lug + 0.006) reach -= 0.004;
    for (const s of [-1, 1]) KT.lug(al, KT.off(c, pax, s * F.w), pax, up, F.r, F.t, lugR);
    // the block between the lugs' roots and the plate (a long drop)
    if (reach > lugR + 0.004) KT.boxIn(al, at((lugR + reach) / 2), [F.w + F.t / 2, (reach - lugR) / 2, F.r * 0.72], pax, up, side);
    // the base plate, flat on the structure, and its four bolts (their heads under it)
    // (P2: inside a nacelle, no wider than the room its skin leaves at the plate - the lugs kept, the lip and gussets trimmed)
    const room = roomAt(reach);
    const pw = Math.max(lug + 0.004, Math.min(lug + 0.026, room)), pd = F.r + 0.012;
    KT.boxIn(al, at(reach - 0.003), [pw, 0.003, pd], pax, up, side);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      KT.bolt(dk, KT.off(KT.off(at(reach - 0.006), pax, sx * (pw - 0.008)), side, sz * (pd - 0.008)), up, 0.004, 0.008);
    // the gussets: outside each lug, from its root on the plate down the lug, and out along the plate
    const gh = Math.min(reach * 0.75, 0.05), gw = Math.min(0.020, pw - lug - 0.004);
    if (gw > 0.006) for (const s of [-1, 1]) { const x0 = s * (F.w + F.t / 2 + 0.0015);
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
const DOOR_T = 0.006, DOOR_BEV = 0.0015;      // P2: a door's thickness and its edge's chamfer (out and in)
const nrm1 = x => x;                          // (a component kept: the side wall's normal is the outward direction)
// the skin's material with vertex colours, once per material (a door's grime)
const DOOR_MATS = new Map();
function doorMat(m) {
  if (!m || !m.clone) return m;
  if (!DOOR_MATS.has(m.uuid)) { const c = m.clone(); c.vertexColors = true; c.needsUpdate = true; DOOR_MATS.set(m.uuid, c); if (DOOR_MATS.size > 64) DOOR_MATS.clear(); }
  return DOOR_MATS.get(m.uuid);
}
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
// THE HINGE ON A CURVED SKIN (the user, 6 Nov, on the Petrel's bow doors: "If they hit a curve, they should take the
// middle point and rotate along the tangent at this point"): a door turns about its hinge edge's TANGENT at the edge's
// MIDDLE - not a level line through the edge points' mean, which on a rising bow (or any sloped piece) swung the door
// off the skin. `edge`: the hinge edge's points; `d`: its run (a unit vector, rough); `tan(h, d)`: the skin's own
// tangent through h along d (else the edge points' fit, else d)
function doorHinge(edge, d, tan) {
  const t = edge.map(q => q[0] * d[0] + q[1] * d[1] + q[2] * d[2]);
  const t0 = Math.min(...t), t1 = Math.max(...t), tm = (t0 + t1) / 2, span = t1 - t0;
  let near = edge.filter((q, i) => Math.abs(t[i] - tm) <= Math.max(0.01, 0.15 * span));
  if (!near.length) { let bi = 0; t.forEach((x, i) => { if (Math.abs(x - tm) < Math.abs(t[bi] - tm)) bi = i; }); near = [edge[bi]]; }
  const hinge = [0, 1, 2].map(i => near.reduce((a, q) => a + q[i], 0) / near.length);
  let ax = tan ? tan(hinge, d) : null;
  if (!ax) {                                  // (the edge points' least-squares run, over the middle's neighbourhood)
    const w = edge.map((q, i) => [q, t[i]]).filter(e => Math.abs(e[1] - tm) <= Math.max(0.03, 0.3 * span));
    const tb = w.reduce((a, e) => a + e[1], 0) / (w.length || 1), qb = [0, 1, 2].map(i => w.reduce((a, e) => a + e[0][i], 0) / (w.length || 1));
    let stt = 0; const b = [0, 0, 0]; for (const [q, x] of w) { stt += (x - tb) ** 2; for (let i = 0; i < 3; i++) b[i] += (x - tb) * (q[i] - qb[i]); }
    if (stt > 0.02 * 0.02 * Math.max(1, w.length / 4)) ax = b;
  }
  ax = ax ? fNrm(ax) : d.slice();
  if (ax[0] * d[0] + ax[1] * d[1] + ax[2] * d[2] < 0) ax = ax.map(x => -x);
  // (`off`: how far the edge's middle stretch (its middle 60 %) lies off the axis line - a door turning about a line
  // its own edge leaves swings that edge off the skin)
  const offOf = (h, a) => { let m = 0; edge.forEach((q, i) => { if (Math.abs(t[i] - tm) > 0.3 * span) return;
    const v = [q[0] - h[0], q[1] - h[1], q[2] - h[2]], k = v[0] * a[0] + v[1] * a[1] + v[2] * a[2]; m = Math.max(m, Math.hypot(v[0] - a[0] * k, v[1] - a[1] * k, v[2] - a[2] * k)); }); return m; };
  return { hinge, axis: ax, off: offOf(hinge, ax), offLevel: offOf([0, 1, 2].map(i => edge.reduce((a, q) => a + q[i], 0) / edge.length), fNrm([d[0], 0, d[2]])), span };
}
// the skin's lowest surface over a plan place (x, z), from polygons (a bucket grid, 10 cm): a door's under-skin
function lowSkin(faces) {
  const g = new Map(), key = (i, j) => i + ':' + j, C = 0.1;
  for (const f of faces) for (let k = 1; k + 1 < f.length; k++) { const T = [f[0], f[k], f[k + 1]];
    const x0 = Math.min(T[0][0], T[1][0], T[2][0]), x1 = Math.max(T[0][0], T[1][0], T[2][0]), z0 = Math.min(T[0][2], T[1][2], T[2][2]), z1 = Math.max(T[0][2], T[1][2], T[2][2]);
    for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) { const k2 = key(i, j); if (!g.has(k2)) g.set(k2, []); g.get(k2).push(T); } }
  return (x, z) => { const ts = g.get(key(Math.floor(x / C), Math.floor(z / C))); if (!ts) return null; let best = null;
    for (const [A, B, Cc] of ts) { const den = (B[2] - Cc[2]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[2] - Cc[2]); if (Math.abs(den) < 1e-14) continue;
      const l1 = ((B[2] - Cc[2]) * (x - Cc[0]) + (Cc[0] - B[0]) * (z - Cc[2])) / den, l2 = ((Cc[2] - A[2]) * (x - Cc[0]) + (A[0] - Cc[0]) * (z - Cc[2])) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue; const y = l1 * A[1] + l2 * B[1] + l3 * Cc[1]; if (best == null || y < best) best = y; }
    return best; };
}
// a skin's faces facing down (Newell) whose plan box meets the outline's, clipped to it
function doorPatch(faces, outline, anyWinding, steep) {
  let z0 = Infinity, z1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  for (const p of outline) { z0 = Math.min(z0, p[0]); z1 = Math.max(z1, p[0]); x0 = Math.min(x0, -p[1]); x1 = Math.max(x1, -p[1]); }
  const out = [];
  // (P2: a shell wound either way - its faces turned AWAY from its own centre line (each 5 cm station's middle, from
  // its faces near the outline): |ny| alone let the nacelle's top skin at its edge into a door)
  let cenAt = null;
  if (anyWinding) { const st = new Map();
    for (const f of faces) for (const q of f) { if (q[0] < x0 - 0.3 || q[0] > x1 + 0.3 || q[2] < z0 - 0.1 || q[2] > z1 + 0.1) continue;
      const k = Math.round(q[2] / 0.05), b = st.get(k) || st.set(k, [Infinity, -Infinity, Infinity, -Infinity]).get(k);
      b[0] = Math.min(b[0], q[0]); b[1] = Math.max(b[1], q[0]); b[2] = Math.min(b[2], q[1]); b[3] = Math.max(b[3], q[1]); }
    cenAt = z => { const b = st.get(Math.round(z / 0.05)); return b ? [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2] : null; }; }
  for (const f of faces) {
    let fx0 = Infinity, fx1 = -Infinity, fz0 = Infinity, fz1 = -Infinity, nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length];
      fx0 = Math.min(fx0, a[0]); fx1 = Math.max(fx1, a[0]); fz0 = Math.min(fz0, a[2]); fz1 = Math.max(fz1, a[2]);
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
    // (Newell's normal: a door's face looks DOWN - more than 24 degrees off the vertical; a spar's closing face, a
    // trailing edge's lip, is not the door's)
    // (a cowl's or a nacelle's shells may be wound either way - the generator's aft lofts march inside out: there the
    // face need only lie flat enough, and the lowest skin over each place, below, is the door's)
    // (`steep`: a wing's door - the closing face ahead of its flap is not its; a body's or a nacelle's rounded underside
    // curves up steeply round its well and is the door's to 84 degrees)
    if (fx1 < x0 || fx0 > x1 || fz1 < z0 || fz0 > z1) continue;
    if (cenAt) { let mx = 0, my = 0, mz = 0; for (const q of f) { mx += q[0] / f.length; my += q[1] / f.length; mz += q[2] / f.length; }
      const ce = cenAt(mz); if (ce && nx * (mx - ce[0]) + ny * (my - ce[1]) < 0) { nx = -nx; ny = -ny; nz = -nz; } }
    if ((cenAt ? -ny : anyWinding ? Math.abs(ny) : -ny) <= (steep ? 0.4 : 0.1) * Math.hypot(nx, ny, nz)) continue;
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
  const kneeD = kneeDoor(P) && (fit.cutsSide || []).some(c => c.group);
  if (!nDoors && !legOn && !kneeD) return out;
  // the skins' faces, metres: the fuselage's sheet (its skin sections) and the wing's skin meshes outside the body
  const bodyF = [], wingF = [];
  let bodyMat = null, wingMat = null;
  const MS = ctx.mesh;
  if (MS && MS.V && MS.F) for (const f of MS.F) if (f.v.length >= 3 && DOOR_SKIN.has(f.m) && !f.knife && !f.cutOff)
    bodyF.push(f.v.map(i => [MS.V[i][0] * FS, MS.V[i][1] * FS, MS.V[i][2] * FS]));
  ctx.scene.traverse(o => {
    if (!o.isMesh || !o.userData) return;
    if (o.userData.matNames && !bodyMat) { const k = o.userData.matNames.indexOf('body'); if (k >= 0) bodyMat = Array.isArray(o.material) ? o.material[k] : o.material; }
    if (!o.userData.wingSkin || o.userData.wingPlane || o.position.lengthSq() > 1e-12) return;      // (the first plane's skin)
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
  for (const k in swing) { const C = swing[k], h = topOf(C), ax = C.axle, ld = fNrm([ax[0] - h[0], ax[1] - h[1], ax[2] - h[2]]);
    const cut = (ax[0] - h[0]) * ld[0] + (ax[1] - h[1]) * ld[1] + (ax[2] - h[2]) * ld[2] - 0.2 * C.R;
    const near = wheelRims(C, 32, [1, 0.6]).filter(p => (p[0] - h[0]) * ld[0] + (p[1] - h[1]) * ld[1] + (p[2] - h[2]) * ld[2] <= cut);
    // (the leg from a quarter of the way down: its root is in the structure, by the trunnion)
    const L4 = 0.25 * Math.hypot(ax[0] - h[0], ax[1] - h[1], ax[2] - h[2]);
    const leg = legTube(C).filter(p => { const t = (p[0] - h[0]) * ld[0] + (p[1] - h[1]) * ld[1] + (p[2] - h[2]) * ld[2]; return t >= L4 && t <= cut; });
    const up = poseAll(C, near.concat(leg), 0);
    if (up.length >= 3) foot[k] = wellOutline(up.map(p => [p[2], -p[0]]), 'exact', 0.01); }
  // the points the down gear holds through the skin (a well door over them cannot close gear down)
  // (the down gear's lines: the leg from its trunnion to its axle, and each 6-point run of the mechanism's links)
  const downLines = k => { const C = swing[k], h = topOf(C), ax = C.axle, m = wellMechPts({ R: mech.R, CM }, k, 1), out = [[h, ax]];
    for (let i = 0; i + 5 < m.length; i += 6) out.push(m.slice(i, i + 6));
    return out; };
  // P2 (the user: "the doors, give them some thickness, and proper edge beveling ... seams and light shadow/dirt in the
  // corners and to highlight the seams"): A DOOR IS A SLAB - the skin's own faces welded into one smooth front (its
  // normals averaged), a 45-degree chamfer round its edge (DOOR_BEV out and in), a side wall down to the back face
  // DOOR_T in (the dark inner skin); the front's vertex colours darken gently toward the edge and a little more into
  // its corners (the seam's shadow, the grime a door collects - no noise: on the skin's irregular triangles it read as
  // crumpled); the chamfer catches the light a
  // shade lighter, the side wall stays in the seam's shadow. The skin's material is cloned once with vertex colours
  const panel = (name, polys, front, xf, look) => {
    const LK = look || [0, -1, 0];
    const X = xf || (v => v), gp = new THREE.Group(); gp.name = name;
    const key = q => Math.round(q[0] * 2e4) + ',' + Math.round(q[1] * 2e4) + ',' + Math.round(q[2] * 2e4);
    const W = [], WI = new Map(), F = [];
    for (const p0 of polys) { if (p0.length < 3) continue;
      const ids = p0.map(q => { const k = key(q); if (!WI.has(k)) { WI.set(k, W.length); W.push(q.slice()); } return WI.get(k); })
        .filter((v, i, a) => v !== a[(i + 1) % a.length]);
      if (ids.length < 3) continue;
      // (each face turned to look DOWN, out of the aircraft: a door is cut from a down-facing skin)
      // (P2: a side door - the folding knee's - looks out of the side, `look`)
      let nl = 0; for (let i = 0; i < ids.length; i++) { const a = W[ids[i]], b = W[ids[(i + 1) % ids.length]];
        nl += LK[0] * (a[1] - b[1]) * (a[2] + b[2]) + LK[1] * (a[2] - b[2]) * (a[0] + b[0]) + LK[2] * (a[0] - b[0]) * (a[1] + b[1]); }
      F.push(nl < 0 ? ids.slice().reverse() : ids); }
    if (!F.length) return;
    // the smooth front's normals (Newell per face, averaged at the welded vertices)
    const VN = W.map(() => [0, 0, 0]);
    for (const f of F) { let nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < f.length; i++) { const a = W[f[i]], b = W[f[(i + 1) % f.length]];
        nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
      for (const v of f) { VN[v][0] += nx; VN[v][1] += ny; VN[v][2] += nz; } }
    for (const n of VN) { const l = Math.hypot(n[0], n[1], n[2]) || 1; n[0] /= l; n[1] /= l; n[2] /= l; }
    // (smoothed over their neighbours, three passes: the clipped fragments' own normals are noisy - a door read crumpled)
    { const nb = W.map(() => new Set()); for (const f of F) for (let i = 0; i < f.length; i++) { nb[f[i]].add(f[(i + 1) % f.length]); nb[f[(i + 1) % f.length]].add(f[i]); }
      for (let it = 0; it < 3; it++) { const nv = VN.map((n, v) => { const a = n.slice(); for (const u of nb[v]) { a[0] += VN[u][0]; a[1] += VN[u][1]; a[2] += VN[u][2]; }
          const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }); for (let v = 0; v < VN.length; v++) VN[v] = nv[v]; } }
    // the boundary: directed edges used once, followed into loops
    const ecount = new Map(), dir = [];
    for (const f of F) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], k = a < b ? a + '_' + b : b + '_' + a;
      ecount.set(k, (ecount.get(k) || 0) + 1); dir.push([a, b, k]); }
    const next = new Map(); for (const [a, b, k] of dir) if (ecount.get(k) === 1) next.set(a, b);
    const loops = [], seen = new Set();
    for (const s0 of next.keys()) { if (seen.has(s0)) continue; const L = []; let v = s0;
      while (v != null && !seen.has(v)) { seen.add(v); L.push(v); v = next.get(v); }
      if (L.length >= 3) loops.push(L); }
    // each boundary vertex's outward direction in the door's plane (its two edges', mitred) and its corner's sharpness
    const OUT = new Map(), CORN = new Map(), sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    for (const L of loops) { const n = L.length, eo = [];
      for (let i = 0; i < n; i++) { const a = W[L[i]], b = W[L[(i + 1) % n]], d = nrm(sub3(b, a)), nn = VN[L[i]];
        eo.push(nrm(crs(d, nn))); }
      // (outward: away from the faces - checked once on the loop against the welded vertices' centroid)
      let cx = 0, cy = 0, cz = 0; for (const q of W) { cx += q[0]; cy += q[1]; cz += q[2]; } const C = [cx / W.length, cy / W.length, cz / W.length];
      let sgn = 0; for (let i = 0; i < n; i++) { const a = W[L[i]]; sgn += eo[i][0] * (a[0] - C[0]) + eo[i][1] * (a[1] - C[1]) + eo[i][2] * (a[2] - C[2]); }
      const fl = sgn < 0 ? -1 : 1;
      for (let i = 0; i < n; i++) { const e0 = eo[(i - 1 + n) % n].map(x => x * fl), e1 = eo[i].map(x => x * fl);
        const m = nrm([e0[0] + e1[0], e0[1] + e1[1], e0[2] + e1[2]]), c = Math.max(0.5, m[0] * e1[0] + m[1] * e1[1] + m[2] * e1[2]);
        OUT.set(L[i], m.map(x => x / c)); CORN.set(L[i], 1 - Math.max(-1, Math.min(1, e0[0] * e1[0] + e0[1] * e1[1] + e0[2] * e1[2]))); } }
    // the front's grime: darker within ~15 mm of the edge, more at a corner; a faint, large, smooth variation
    const bnd = [...OUT.keys()].map(v => W[v]);
    const shade = (q, v) => { let d = Infinity; for (const b of bnd) d = Math.min(d, Math.hypot(q[0] - b[0], q[1] - b[1], q[2] - b[2]));
      const corner = CORN.has(v) ? Math.min(1, CORN.get(v)) : 0;
      return Math.max(0.6, Math.min(1, 1 - 0.16 * Math.exp(-d / 0.025) - 0.10 * corner * Math.exp(-d / 0.02))); };
    const T = DOOR_T, BV = DOOR_BEV;
    const P = [], NN = [], CC = [], IX = [];
    const put = (q, n, c) => { const a = X(q), b = X([q[0] + n[0] * 0.01, q[1] + n[1] * 0.01, q[2] + n[2] * 0.01]);
      P.push(a[0], a[1], a[2]); const m = nrm(sub3(b, a)); NN.push(m[0], m[1], m[2]); CC.push(c, c, c); return P.length / 3 - 1; };
    // the front (welded, smooth)
    const fid = W.map((q, v) => put(q, VN[v], shade(q, v)));
    for (const f of F) for (let i = 1; i + 1 < f.length; i++) IX.push(fid[f[0]], fid[f[i]], fid[f[i + 1]]);
    // the chamfer and the side wall, round each loop
    const inw = v => [-VN[v][0], -VN[v][1], -VN[v][2]];                  // (into the aircraft)
    const at = (v, o, i) => { const q = W[v], d = OUT.get(v), n = inw(v); return [q[0] + d[0] * o + n[0] * i, q[1] + d[1] * o + n[1] * i, q[2] + d[2] * o + n[2] * i]; };
    for (const L of loops) { const n = L.length;
      for (let i = 0; i < n; i++) { const a = L[i], b = L[(i + 1) % n];
        const nc = v => nrm([OUT.get(v)[0] - inw(v)[0], OUT.get(v)[1] - inw(v)[1], OUT.get(v)[2] - inw(v)[2]]);
        const p0 = put(W[a], nc(a), 0.62), p1 = put(W[b], nc(b), 0.62), r1 = put(at(b, BV, BV), nc(b), 0.62), r0 = put(at(a, BV, BV), nc(a), 0.62);
        IX.push(p0, r1, p1, p0, r0, r1);
        const s0 = put(at(a, BV, BV), OUT.get(a).map(nrm1), 0.42), s1 = put(at(b, BV, BV), OUT.get(b).map(nrm1), 0.42), t1 = put(at(b, BV, T), OUT.get(b).map(nrm1), 0.42), t0 = put(at(a, BV, T), OUT.get(a).map(nrm1), 0.42);
        IX.push(s0, t1, s1, s0, t0, t1); } }
    // (each triangle wound to look along its own normal: the front out, the chamfer and the wall outward)
    for (let t = 0; t < IX.length; t += 3) { const A = [P[IX[t] * 3], P[IX[t] * 3 + 1], P[IX[t] * 3 + 2]], B = [P[IX[t + 1] * 3], P[IX[t + 1] * 3 + 1], P[IX[t + 1] * 3 + 2]], Cq = [P[IX[t + 2] * 3], P[IX[t + 2] * 3 + 1], P[IX[t + 2] * 3 + 2]];
      const fn = crs(sub3(B, A), sub3(Cq, A)), vn = [NN[IX[t] * 3], NN[IX[t] * 3 + 1], NN[IX[t] * 3 + 2]];
      if (fn[0] * vn[0] + fn[1] * vn[1] + fn[2] * vn[2] < 0) { const k = IX[t + 1]; IX[t + 1] = IX[t + 2]; IX[t + 2] = k; } }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(NN, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(CC, 3)); g.setIndex(IX);
    const fm = new THREE.Mesh(g, doorMat(front || GG.gearMat('alloy'))); fm.userData.doorOuterN = W.length; gp.add(fm);   // (its first W.length vertices: the outer face)
    // the back face, DOOR_T in (the boundary on the side wall's foot), dark, looking into the aircraft
    const bb = KT.Bag(), bid = W.map((q, v) => bb.v(X(OUT.has(v) ? at(v, BV, T) : [q[0] - VN[v][0] * T, q[1] - VN[v][1] * T, q[2] - VN[v][2] * T])));
    for (const f of F) for (let i = 1; i + 1 < f.length; i++) bb.tri(bid[f[0]], bid[f[i + 1]], bid[f[i]]);
    bb.mesh(gp, darkM);
    group.add(gp);
    return gp;
  };
  // P2 (the user, 6 Nov: "a version with full doors"): THE FOLDING KNEE'S DOOR - the side's skin over the keyhole (the
  // round recess and the slot over it, DOOR_SEAM in), one slab riding the unit: the fold is a pure translation, so
  // drawn where the down gear holds it (the stowed place less the arc) it lands flush in the side when the wheel is up -
  // arriving level, inward, as the arc ends; a stay from the axle's outer end holds it
  if (kneeD) for (const k of ['L', 'R']) {
    const C = swing[k], cs = (fit.cutsSide || []).filter(c => c.group === k);
    if (!C || !C.arc || !cs.length) continue;
    const s = cs[0].side, ccw = h => { let a2 = 0; for (let i = 0; i < h.length; i++) { const p = h[i], q = h[(i + 1) % h.length]; a2 += p[0] * q[1] - q[0] * p[1]; } return a2 < 0 ? h.slice().reverse() : h; };
    const circ = ccw(cs.find(c => !c.slot).hull), slot = cs.find(c => c.slot), sl = slot ? ccw(slot.hull) : null;
    // (the side frame's (u, v) = (z, -s y) fed to the plan clip, whose (u, v) is (z, -x): x' = s y, y' = x)
    const to = q => [s * q[1], q[0], q[2]], fro = q => [q[1], s * q[0], q[2]];
    // (a side hinge's tangent: along the hull at the hinge's height - the side's x at z -+ 5 cm, from the airframe's sections)
    const halfX = (y, z) => { let best = null; for (let d = 0; d < 360; d++) { const a = AF.surf(z, d * Math.PI / 360), b = AF.surf(z, (d + 1) * Math.PI / 360);
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const t = (y - a[1]) / (b[1] - a[1]), x = Math.abs(a[0] + (b[0] - a[0]) * t); if (best == null || x > best) best = x; } } return best; };
    const sideTan = h => { const dl = 0.05, a = halfX(h[1], h[2] - dl), b = halfX(h[1], h[2] + dl); return a != null && b != null ? [s * (b - a), 0, 2 * dl] : null; };
    const polys = [], low = [], hullD = kneeHullDoor(P);
    // (the leg's door ends 0.8 R under the stowed axle: gear down it hangs a fifth of a radius clear of the ground, as a
    // leg door does; the circle's foot under that line is a little door of its own, hinged on the hull at its bottom)
    const yA = CM.gearUnitPt(C, CM.gearFoldPose(C, 0), C.axle, 0, 0, CM.gearArc(C, 0))[1], yCut = yA - 0.8 * C.R, vc = -s * yCut;
    const hiA = s > 0 ? [1, vc] : [0, vc], hiB = s > 0 ? [0, vc] : [1, vc];
    for (const f of bodyF) {
      let nx = 0, ny = 0, nz = 0, cx = 0;
      for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; cx += a[0] / f.length;
        nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
      if (s * cx <= 0 || s * nx <= 0.05 * Math.hypot(nx, ny, nz)) continue;
      const f2 = f.map(to), a = clipConvex(f2, circ, DOOR_SEAM);
      if (a && hullD) polys.push(a.map(fro));
      else if (a) { const up = planClip(a, hiA, hiB, DOOR_SEAM / 2), dn = planClip(a, hiB, hiA, DOOR_SEAM / 2);
        if (up) polys.push(up.map(fro)); if (dn) low.push(dn.map(fro)); }
      if (sl) { const b = clipConvex(f2, sl, DOOR_SEAM); if (b) for (const q of minusConvex(b, circ, -DOOR_SEAM)) polys.push(q.map(fro)); }
    }
    // (the outermost skin over each place only - a liner, a frame's flange behind it is not the door)
    const cell = p => { let z = 0, y = 0; for (const q of p) { z += q[2]; y += q[1]; } return Math.round(z / p.length / 0.03) + ':' + Math.round(y / p.length / 0.03); };
    const xo = p => s * p.reduce((a, q) => a + q[0], 0) / p.length, hi = new Map();
    for (const p of polys) { const kk = cell(p), x = xo(p); if (!hi.has(kk) || x > hi.get(kk)) hi.set(kk, x); }
    for (const p of low) { const kk = cell(p), x = xo(p); if (!hi.has(kk) || x > hi.get(kk)) hi.set(kk, x); }
    const mine = polys.filter(p => xo(p) >= hi.get(cell(p)) - 0.015), foot = low.filter(p => xo(p) >= hi.get(cell(p)) - 0.015);
    if (polyArea(mine) < 0.01) continue;
    // (gearKneeDoor 2: the whole keyhole one door, hinged on the hull along the cut's top edge (fore-aft), swung 90 deg
    // up and out: gear down it lies level, out from the side, its back to the wing; shut only once the wheel is in)
    if (hullD) {
      let y1 = -Infinity; for (const p of mine) for (const q of p) y1 = Math.max(y1, q[1]);
      const edge = []; for (const p of mine) for (const q of p) if (q[1] > y1 - 0.008) edge.push(q);
      let { hinge, axis } = doorHinge(edge, [0, 0, 1], sideTan);
      const cen = [0, 1, 2].map(i => { let a = 0, n = 0; for (const p of mine) for (const q of p) { a += q[i]; n++; } return a / n; });
      const d0 = [cen[0] - hinge[0], cen[1] - hinge[1], cen[2] - hinge[2]], mv = CM.gearApp(CM.gearRot(axis, 0.1), d0);
      if (s * (mv[0] - d0[0]) < 0) axis = axis.map(x => -x);
      const name = 'edMechDoor' + k + '_kneeHull', seq = { k: KNEE_DOOR_SEQ, closedDown: false };
      const Rd = CM.gearRot(axis, KNEE_DOOR_ANG * CM.gearDoorOpen(seq, 1));
      const gp = panel(name, mine, bodyMat, v => { const q = CM.gearApp(Rd, [v[0] - hinge[0], v[1] - hinge[1], v[2] - hinge[2]]); return [hinge[0] + q[0], hinge[1] + q[1], hinge[2] + q[2]]; }, [s, 0, 0]);
      // (its hinge: two knuckles on the cut's top edge, the pin fore-aft - drawn open, as the door)
      if (gp) { const bk = KT.Bag(); let z0 = Infinity, z1 = -Infinity; for (const q of edge) { z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]); }
        const hp = [hinge[0] - s * 0.008, hinge[1] + 0.004, 0];
        for (const zz of [z0 + 0.012, z1 - 0.042]) if (z1 - z0 > 0.06) KT.revolve(bk, [hp[0], hp[1], zz], [0, 0, 1], [[0.007, 0], [0.007, 0.03]], 10, true);
        bk.mesh(group, GG.gearMat('steel')); }
      mech.R.parts.push({ name, rule: 'door', hinge, axis, ang: KNEE_DOOR_ANG, seq, o0: hinge.slice() });
      // (open, it must clear every wing's skin over it: its far edge and its face, swung)
      const Ro = CM.gearRot(axis, KNEE_DOOR_ANG); let hit = 0;
      for (const p of mine) for (const q of p) { const r = CM.gearApp(Ro, [q[0] - hinge[0], q[1] - hinge[1], q[2] - hinge[2]]), w = [hinge[0] + r[0], hinge[1] + r[1] + DOOR_T, hinge[2] + r[2]];
        for (const pl of wingPlanes()) { const u = pl.underAt(w[0], w[2]); if (u && w[1] > u.y - 0.005) hit = Math.max(hit, w[1] - u.y + 0.005); } }
      if (hit > 0) { const why = UNIT_WORD[k] + '\'s door, swung up, stands ' + Math.round(hit * 1000) + ' mm into the wing over it (lower the cut\'s top: a narrower track, or raise the wing)';
        fit.ok = false; fit.why.push(why); (fit.tests.wing = fit.tests.wing || []).push({ unit: k, why });
        for (const r of FIT_ROWS[k].fold.concat(['gearKneeDoor', 'w2Dy'])) if (!fit.rows[r]) fit.rows[r] = why; }
      out.push({ name, kind: 'kneeHull', unit: k, area: polyArea(mine), hinge, closedDown: false, wingHit: hit });
      continue;
    }
    const a0 = CM.gearArc(C, 0), back = v => [v[0] - a0[0], v[1] - a0[1], v[2] - a0[2]];
    const name = 'edMechDoor' + k + '_knee';
    const gp = panel(name, mine, bodyMat, back, [s, 0, 0]);
    // (the stay: from the axle's outer end, level, out to the door's back - its place on the door read off the patch)
    const ax = CM.gearUnitPt(C, CM.gearFoldPose(C, 0), C.axle, 0, 0, a0), hw = 0.38 * C.R;
    let xd = null; for (const p of mine) for (let i = 1; i + 1 < p.length; i++) { const A = p[0], B = p[i], Cq = p[i + 1];
      const den = (B[2] - Cq[2]) * (A[1] - Cq[1]) + (Cq[1] - B[1]) * (A[2] - Cq[2]); if (Math.abs(den) < 1e-12) continue;
      const l1 = ((B[2] - Cq[2]) * (ax[1] - Cq[1]) + (Cq[1] - B[1]) * (ax[2] - Cq[2])) / den, l2 = ((Cq[2] - A[2]) * (ax[1] - Cq[1]) + (A[1] - Cq[1]) * (ax[2] - Cq[2])) / den;
      if (l1 >= -1e-6 && l2 >= -1e-6 && l1 + l2 <= 1 + 1e-6) { const x = l1 * A[0] + l2 * B[0] + (1 - l1 - l2) * Cq[0]; if (xd == null || s * x > s * xd) xd = x; } }
    if (gp && xd != null && s * (xd - ax[0]) > hw + DOOR_T + 0.01) {
      const b0 = back([ax[0] + s * (hw + 0.012), ax[1], ax[2]]), L = Math.abs(xd - ax[0]) - hw - 0.012 - DOOR_T, bk = KT.Bag();
      KT.revolve(bk, b0, [s, 0, 0], [[0.016, 0], [0.016, 0.01], [0.011, 0.02], [0.011, Math.max(0.02, L - 0.012)], [0.024, L - 0.004], [0.024, L]], 12, true);
      bk.mesh(gp, GG.gearMat('alloy')); }
    mech.R.parts.push({ name, rule: 'rigid', unit: k, o0: C.hinge.slice() });
    out.push({ name, kind: 'knee', unit: k, area: polyArea(mine) });
    // (the foot's door: hinged along its lowest edge, fore-aft, its top swung OUT of the side and down (120 deg: it hangs
    // out and down, clear of the wheel's path) as the gear leaves up, shut again once it is down - the wheel enters over it)
    if (polyArea(foot) > 0.002) {
      let y0 = Infinity; for (const p of foot) for (const q of p) y0 = Math.min(y0, q[1]);
      const edge = []; for (const p of foot) for (const q of p) if (q[1] < y0 + 0.008) edge.push(q);
      let { hinge, axis } = doorHinge(edge, [0, 0, 1], sideTan); const cen = [0, 1, 2].map(i => { let a = 0, n = 0; for (const p of foot) for (const q of p) { a += q[i]; n++; } return a / n; });
      const mv = CM.gearApp(CM.gearRot(axis, 0.1), [cen[0] - hinge[0], cen[1] - hinge[1], cen[2] - hinge[2]]);
      if (s * (mv[0] - (cen[0] - hinge[0])) < 0) axis = axis.map(x => -x);
      const fn = 'edMechDoor' + k + '_kneeFoot', seq = { k: DOOR_SEQ, closedDown: true };
      panel(fn, foot, bodyMat, null, [s, 0, 0]);
      mech.R.parts.push({ name: fn, rule: 'door', hinge, axis, ang: 120 * Math.PI / 180, seq, o0: hinge.slice() });
      out.push({ name: fn, kind: 'kneeFoot', unit: k, area: polyArea(foot), closedDown: true });
    }
  }
  // GR: THE NACELLES' doors - their skin's faces (the cowl units' skin meshes, the layer's frame), their wells, their finish
  const nacF = []; let nacMat = null;
  { const inv = new THREE.Matrix4().copy(ctx.scene.matrixWorld).invert(), M4 = new THREE.Matrix4(), vv = new THREE.Vector3();
    for (const N of NACS) for (const o of N.meshes) {
      if (o.userData.innerTwin || o.userData.nacSkin === 'shell') continue;     // (P2: the outer skins' doors, as their wells)
      if (!nacMat) nacMat = o.material;
      M4.multiplyMatrices(inv, o.matrixWorld);
      const g = o.userData.wellGeo0 || o.geometry, pa = g.attributes.position, ix = g.index ? g.index.array : null, n = (ix ? ix.length : pa.count) / 3;
      for (let t = 0; t < n; t++) nacF.push([0, 1, 2].map(q => { vv.fromBufferAttribute(pa, ix ? ix[t * 3 + q] : t * 3 + q).applyMatrix4(M4); return [vv.x, vv.y, vv.z]; }));
    } }
  const LOWS = new Map();
  // (the rigid L's wing recess has no doors)
  const sets = [['B', fit.cuts || [], bodyF, bodyMat], ['W', lFold(P) ? [] : fit.cutsWing || [], wingF, wingMat], ['N', fit.cutsNac || [], nacF, nacMat]];
  for (const [tag, cuts, faces, mat] of sets) cuts.forEach((c, ci) => {
    const outline = c.hull.map(p => [p[0], -p[1]]);                  // the gear layer's (z, x) hull -> (z, -x), then CCW
    let a2 = 0; for (let i = 0; i < outline.length; i++) { const p = outline[i], q = outline[(i + 1) % outline.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
    if (a2 < 0) outline.reverse();
    let rest = doorPatch(faces, outline, tag === 'N', tag === 'W');
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
      // (the hinge: the edge's middle, its axis the skin's tangent there along the edge's run - the plan direction e1, in
      // 3D (u, v) = (z, -x) - climbing with the skin: a bow rising, a nacelle's belly, a wing's dihedral)
      const low = LOWS.get(faces) || LOWS.set(faces, lowSkin(faces)).get(faces);
      let { hinge, axis, off, offLevel } = doorHinge(edge, [-e1[1], 0, e1[0]], (h, d) => { const dl = 0.05, a = low(h[0] - d[0] * dl, h[2] - d[2] * dl), b = low(h[0] + d[0] * dl, h[2] + d[2] * dl);
        return a != null && b != null && Math.abs(b - a) < 2 * dl * 3 ? [2 * dl * d[0], b - a, 2 * dl * d[2]] : null; });
      const cen = [0, 1, 2].map(i => { let s = 0, n = 0; for (const p of hp) for (const q of p) { s += q[i]; n++; } return s / n; });
      const R1 = CM.gearRot(axis, 0.1), d = [cen[0] - hinge[0], cen[1] - hinge[1], cen[2] - hinge[2]];
      // + opens it OUT of the skin (P2: along the door's own outward normal - a nacelle's door wraps its round belly, its
      // centroid nearly under the hinge: 'down' alone swung one in, through the nacelle's top)
      const on = [0, 0, 0]; for (const p of hp) { let nx = 0, ny = 0, nz = 0;
        for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
        const sg = ny > 0 ? -1 : 1; on[0] += nx * sg; on[1] += ny * sg; on[2] += nz * sg; }
      const mv1 = CM.gearApp(R1, d).map((x, i) => x - d[i]);
      if (mv1[0] * on[0] + mv1[1] * on[1] + mv1[2] * on[2] < 0) axis = axis.map(x => -x);
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
      // (the user, 6 Nov, the Super Petrel - carried from claude/hull-types HULL-B64: "when extended, the doors stay open,
      // they don't close. They close only for the retracted position"): with NO leg door the down leg stands in the
      // opening, so the well's doors stay open while it is down - two split doors had shut on it, the leg running along
      // their seam and crossing neither half; with a leg door, a door the down gear does not pass through shuts down)
      const name = 'edMechDoor' + tag + ci + '_' + (di + 1), seq = { k: DOOR_SEQ, closedDown: !through && !!+P.gearLegDoor };
      // drawn as it stands gear down (every part's rest): a door the down gear passes through stands open
      const Rd = CM.gearRot(axis, DOOR_ANG * CM.gearDoorOpen(seq, 1));
      panel(name, hp, mat, v => { const q = CM.gearApp(Rd, [v[0] - hinge[0], v[1] - hinge[1], v[2] - hinge[2]]); return [hinge[0] + q[0], hinge[1] + q[1], hinge[2] + q[2]]; });
      mech.R.parts.push({ name, rule: 'door', hinge, axis, ang: DOOR_ANG, seq, o0: hinge.slice() });
      out.push({ name, kind: 'well', units: c.units.slice(), area: polyArea(hp), closedDown: seq.closedDown, hinge, axis, edgeOff: off, edgeOffLevel: offLevel });
    });
  });
  return out;
}

// ---- the build ------------------------------------------------------------
// ---- THE SPARE WHEEL (CAR-1) ---------------------------------------------------------------------------------------
// The user (12 Nov): "put a spare wheel on one of the sides, at the back, like the ref picture", then "it's in the
// wrong direction ... do a little mount for it and do a little strap ... very close to the body, so it actually mounts
// on it ... high quality modeling on the strap and the buckle". spareOn: the rearmost road wheel OF THE SPARE'S OWN SIDE
// copied (its hubcap faces out, as a road wheel's does; the other side's copy turned about the vertical), its brake
// left off (a spare has none), its tyre seated a carrier's depth off the flank - the body's half-width taken over the
// tyre's whole height and length; a carrier (a domed base flange bolted to the flank, a stub axle, a chrome hub nut)
// and a LEATHER STRAP round the tyre's crown, anchored at a bracket on the body, fastened by a buckle on the outer face
// (a rounded chrome frame, its roller, the tongue, a leather keeper, the punched tail with a rounded tip). All in the
// group's own frame (the layers' metres). A picture: not a unit, not a contact; named edSpare.
// CAR-3/CAR-4 (the user, 12 Nov: "back and front bumpers ... don't just slap a bar in front of it ... a nice assembly,
// professional quality modeling ... a back bumper plus the hitch for the tow"): bumpF / bumpR draw a BUMPER ahead of the
// bonnet's face / behind the rear wall - a 1940s blade (a convex face between rolled lips, swept along the body's width,
// its ends wrapping back round the corners), two teardrop overriders, two bracket arms back to the frame with their
// bolts; the rear one carries a ribbed rubber step pad and THE HITCH under its centre: a square receiver tube with its
// cross plate, the drawbar, the drop plate, a 50 mm ball on its nut, the cross pin and its clip, two safety-chain loops.
// The ball's centre is published (window.CAGE_GEAR_HITCH, the layers' metres) - the drive test's rope pulls there.
// Rows (absent = no bumper): bumpY the beam's centre over the body's bottom line, bumpGap off the face, bumpW the span
// (x the body's half-width), bumpH the blade's height, bumpFin 0 chrome / 1 black, bumpGuards 0/1, hitchOn (rear).
function bumperBuild(group, P, AF, scene, front) {
  const sZ = front ? 1 : -1;                               // outward along the car
  const LIGHT = Math.round(+P.bumpStyle || 0) === 1;      // CAR-4: a light tubular bumper (a UTV's), a smaller hitch
  const H = LIGHT ? Math.max(0.04, +P.bumpH || 0.06) : Math.max(0.06, +P.bumpH || 0.15), D = LIGHT ? H : Math.max(0.05, 0.45 * H), gap = +P.bumpGap >= 0 ? +P.bumpGap : 0.07;
  let zFace = front ? AF.z1 : AF.z0;
  // the bonnet's face from its own rows (metres off the firewall, the airframe's forward end) - a scene lookup found a
  // stale cowl group in the page and lost the front bumper
  if (front && +P.engOn !== 0 && +P.cw_cowlLen > 0) zFace = AF.z1 + (+P.cw_cowlLen) + Math.max(0, +P.cw_lidLen || 0);
  const zRef = front ? AF.z1 - 0.05 : AF.z0 + 0.05;
  let bot = Infinity, half = 0;
  for (let a = 0; a <= 180; a += 3) { const q = AF.surf(zRef, a * D2R); if (q && isFinite(q[1])) { bot = Math.min(bot, q[1]); half = Math.max(half, Math.abs(q[0])); } }
  // CAR-4: on TWIN BOOMS the back of the vehicle is the booms' tail ends (the UTV's chassis rails, its bed over them):
  // the rear bumper rides there, its height off the booms' underside
  const TB = window.CAGE_BOOMS;
  if (!front && TB && TB.yBot && isFinite(TB.zTip) && TB.zTip < zFace) { zFace = TB.zTip; bot = TB.yBot(TB.zTip + 0.05); }
  const zIn = zFace + sZ * gap;                            // the beam's inner (body-side) face
  // (CAR-3: bumpYF, the FRONT bumper's own height - absent = bumpY, the pair's)
  const yB = bot + (front && P.bumpYF != null ? +P.bumpYF : (+P.bumpY || 0));
  const rw = 0.12, A = 75 * D2R, X = Math.max(0.2, half * (+P.bumpW > 0 ? +P.bumpW : 0.92) - rw * Math.sin(A));
  const fin = Math.round(+P.bumpFin || 0) === 1 ? GG.gearMat('dark') : GG.gearMat('chrome');
  const steel = GG.gearMat('steel'), dark = GG.gearMat('dark'), chrome = GG.gearMat('chrome');
  const root = new THREE.Group(); root.name = front ? 'edBumperF' : 'edBumperR';
  const add = (geo, mat, x, y, z, q) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (q) m.quaternion.copy(q); root.add(m); return m; };
  // ---- the path: left tip -> left wrap -> the straight -> right wrap -> right tip (x, z), in the beam's inner face ----
  const path = [];
  const NA = 10, NS = 24;
  for (let k = NA; k >= 1; k--) { const a = A * k / NA; path.push([-X - rw * Math.sin(a), zIn - sZ * rw * (1 - Math.cos(a))]); }
  for (let k = 0; k <= NS; k++) path.push([-X + 2 * X * k / NS, zIn]);
  for (let k = 1; k <= NA; k++) { const a = A * k / NA; path.push([X + rw * Math.sin(a), zIn - sZ * rw * (1 - Math.cos(a))]); }
  // ---- the profile (d out from the inner face, h up): the rolled lower lip, the convex face, the rolled upper lip,
  // the return flange inside - a closed loop ----
  const prof = [];
  const lip = 0.012;
  if (LIGHT) for (let k = 0; k < 20; k++) { const a = -Math.PI / 2 + 2 * Math.PI * k / 20; prof.push([D / 2 + D / 2 * Math.cos(a), D / 2 * Math.sin(a)]); }
  else {
  prof.push([0.004, -H / 2 + lip]);
  for (let k = 0; k <= 5; k++) { const a = Math.PI * (1 + k / 10); prof.push([0.018 + lip * Math.cos(a) * -1 + 0.0, -H / 2 + lip + lip * Math.sin(a)]); }
  for (let k = 0; k <= 14; k++) { const t = k / 14; prof.push([D * (0.62 + 0.38 * Math.sin(Math.PI * t)), -H / 2 + 0.004 + (H - 0.008) * t]); }
  for (let k = 0; k <= 5; k++) { const a = Math.PI * (k / 10); prof.push([0.018 + lip * Math.cos(a), H / 2 - lip + lip * Math.sin(a)]); }
  prof.push([0.004, H / 2 - lip]);
  }
  const NPf = prof.length;
  const pos = [], idx = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const nx = -sZ * tz, nz = sZ * tx;
    for (const [d, h] of prof) pos.push(path[i][0] + nx * d, yB + h, path[i][1] + nz * d);
  }
  for (let i = 0; i + 1 < path.length; i++) for (let j = 0; j < NPf; j++) {
    const j2 = (j + 1) % NPf, A0 = i * NPf + j, B0 = i * NPf + j2, C0 = (i + 1) * NPf + j, D0 = (i + 1) * NPf + j2;
    if (sZ > 0) idx.push(A0, C0, B0, B0, C0, D0); else idx.push(A0, B0, C0, B0, D0, C0);
  }
  // the end caps
  for (const i of [0, path.length - 1]) { const c = pos.length / 3; let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < NPf; j++) { cx += pos[3 * (i * NPf + j)]; cy += pos[3 * (i * NPf + j) + 1]; cz += pos[3 * (i * NPf + j) + 2]; }
    pos.push(cx / NPf, cy / NPf, cz / NPf);
    for (let j = 0; j < NPf; j++) { const j2 = (j + 1) % NPf; if ((i === 0) === (sZ > 0)) idx.push(c, i * NPf + j2, i * NPf + j); else idx.push(c, i * NPf + j, i * NPf + j2); } }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setIndex(idx); bg.computeVertexNormals();
  const beam = new THREE.Mesh(bg, fin); beam.name = 'edBumperBeam'; root.add(beam);
  const zOut = zIn + sZ * D;                               // the face's crown
  // ---- the overriders: teardrop guards standing proud of the face ----
  if (+P.bumpGuards !== 0 && !LIGHT) {
    const g = [];
    // a stubby rounded guard: an elongated dome, full width over most of its height, rounded ends (never a point)
    const Rg = 0.034, Hg = H * 1.45;
    for (let k = 0; k <= 18; k++) { const t = k / 18, u = 2 * t - 1; g.push(new THREE.Vector2(Rg * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 4)), 0.25) + 0.0003, u * Hg / 2)); }
    const gg = new THREE.LatheGeometry(g, 28);
    for (const sx of [-1, 1]) { const m = add(gg, fin, sx * X * 0.62, yB + H * 0.12, zOut - sZ * 0.01); m.scale.set(1, 1, 0.8); m.name = 'edBumperGuard'; }
  }
  // ---- the bracket arms: flat bar from the beam's back to the frame, a gusset, two bolt heads at each end ----
  const armL = gap + 0.30, armZ = zIn - sZ * armL / 2;
  for (const sx of [-1, 1]) {
    const xa = sx * X * 0.55;
    add(LIGHT ? new THREE.CylinderGeometry(0.016, 0.016, armL, 12) : new THREE.BoxGeometry(0.045, 0.07, armL), steel, xa, yB, armZ,
        LIGHT ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)) : null).name = 'edBumperArm';
    add(new THREE.BoxGeometry(0.010, 0.05, armL * 0.5), steel, xa + sx * 0.0275, yB - 0.01, zIn - sZ * armL * 0.3).name = 'edBumperArm';
    for (const dy of [-0.018, 0.018]) add(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 6), chrome, xa, yB + dy, zIn - sZ * 0.004, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)));
  }
  // ---- the rear: the rubber step pad and THE HITCH ----
  if (!front) {
    if (!LIGHT) for (let k = -4; k <= 4; k++) add(new THREE.BoxGeometry(0.30, 0.006, 0.010), dark, 0, yB + H / 2 + 0.003, zIn - sZ * (D * 0.5 + k * 0.006)).name = 'edBumperStep';
    if (+P.hitchOn !== 0) {
      const S = LIGHT ? 0.05 : 0.065, Tn = LIGHT ? 0.005 : 0.006, yR = yB - H / 2 - S / 2 - 0.01, L = LIGHT ? 0.26 : 0.34, zc = zOut - sZ * (L / 2 - 0.05);
      const R = new THREE.Group(); R.name = 'edHitch'; root.add(R);
      const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); R.add(m); return m; };
      // the receiver tube: four walls
      box(S, Tn, L, steel, 0, yR + S / 2 - Tn / 2, zc); box(S, Tn, L, steel, 0, yR - S / 2 + Tn / 2, zc);
      box(Tn, S, L, steel, S / 2 - Tn / 2, yR, zc); box(Tn, S, L, steel, -S / 2 + Tn / 2, yR, zc);
      // the collar at the mouth, the cross plate welded to the bumper's arms
      box(S + 0.016, S + 0.016, 0.02, steel, 0, yR, zOut + sZ * 0.04);
      box(X * 1.1, 0.05, 0.008, steel, 0, yR + S / 2 + 0.025, zIn - sZ * 0.06);
      // the drawbar in the receiver, out past the mouth, and the drop plate
      const zD = zOut + sZ * 0.05, bL = 0.15;
      box(0.050, 0.050, bL, steel, 0, yR, zD + sZ * (bL / 2 - 0.06));
      const zP = zD + sZ * (bL - 0.06);
      box(0.10, 0.12, 0.018, steel, 0, yR + 0.02, zP);
      // the ball: its nut, its neck, the 50 mm ball
      const up = new THREE.Vector3(0, 1, 0);
      const zBall = zP + sZ * 0.045, yTop = yR + 0.02 + 0.06;
      const m1 = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.018, 6), chrome); m1.position.set(0, yTop - 0.016 - 0.009, zBall); R.add(m1);   // under the shelf the ball's shank bolts through
      const plate2 = box(0.10, 0.016, 0.10, steel, 0, yTop - 0.008, zP + sZ * 0.04);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.03, 20), chrome); neck.position.set(0, yTop + 0.015, zBall); R.add(neck);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.025, 28, 18), chrome); ball.position.set(0, yTop + 0.03 + 0.022, zBall); R.add(ball);
      // the cross pin through the receiver, its head and clip ring
      const across = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(1, 0, 0));
      const zPin = zOut + sZ * 0.0;
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, S + 0.05, 12), chrome); pin.quaternion.copy(across); pin.position.set(0, yR, zPin); R.add(pin);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.008, 16), chrome); head.quaternion.copy(across); head.position.set(-(S / 2 + 0.025), yR, zPin); R.add(head);
      const clip = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0025, 8, 20), chrome); clip.position.set(S / 2 + 0.03, yR, zPin); clip.rotation.y = Math.PI / 2; R.add(clip);
      // the safety-chain loops, welded either side of the mouth
      for (const sx of [-1, 1]) { const lp = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 8, 20), steel); lp.position.set(sx * (S / 2 + 0.02), yR - S / 2 + 0.004, zOut + sZ * 0.03); lp.rotation.x = Math.PI / 2; R.add(lp); }
      for (const o of R.children) o.name = o.name || 'edHitch';
      window.CAGE_GEAR_HITCH = [0, ball.position.y, zBall];
    }
  }
  group.add(root);
}
// CAR-3 (the user: "two opening doors on the back ... use the existing hinges"): the rear doors the sheet drew
// (extRelief 4, m.rearDoors - cage units) take the garage's own butt hinges (HINGE_GEN.buttHinge, the cabin doors'),
// two on each door's outer edge, and a T-handle with its escutcheon at the split. A picture: the doors do not swing yet.
function rearDoorHardware(group, P, mesh) {
  const RD = mesh && mesh.rearDoors, HG = window.HINGE_GEN, K = window.GEAR_KIT;
  if (!RD || !HG || !HG.buttHinge || !K || !K.Bag) return;
  const C2 = window.CAGE2, FS = ((C2 && C2.CAGE_UNIT) || 1) * (+P.planeScale || 1);
  const HCd = window.GEN_HINGE || { pinR: 0.0045, strapT: 0.0022, strapW: 0.018, strapReach: 0.06, gap: 0.004 };
  const sz = Math.max(0.6, +P.hgSize || 1.4);
  const S = { r: (HCd.pinR || 0.0045) * 2.1 * sz, t: (HCd.strapT || 0.0022) * Math.sqrt(sz), w: (HCd.strapW || 0.018) * sz,
              reach: 0.045, pinR: (HCd.pinR || 0.0045) * sz, gap: HCd.gap || 0.004 };
  const zF = RD.z * FS - S.r, yA = RD.y0 * FS, yB2 = RD.y1 * FS, len = 0.11;
  const bF = K.Bag(), bM = K.Bag();
  for (const [xe, into] of [[RD.x0 * FS + 0.01, 1], [RD.x1 * FS - 0.01, -1]])
    for (const t of [0.2, 0.8]) {
      const p = [xe, yA + (yB2 - yA) * t, zF], x = [into, 0, 0], y = [0, 0, -1];
      const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
      HG.buttHinge(bF, bM, { p, x, y, z }, S, len);
    }
  const root = new THREE.Group(); root.name = 'edRearDoors';
  const chrome = GG.gearMat('chrome');
  for (const b of [bF, bM]) if (b.mesh) b.mesh(root, chrome);
  // the handle: an escutcheon plate on the right-hand door, a T lever across the split's side
  const xh = RD.xm * FS - 0.06, yh = yA + (yB2 - yA) * 0.42, zh = RD.z * FS;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.006), chrome); plate.position.set(xh, yh, zh - 0.004); root.add(plate);
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.022, 16), chrome);
  boss.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)); boss.position.set(xh, yh + 0.02, zh - 0.018); root.add(boss);
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.11, 12), chrome);
  lever.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)); lever.position.set(xh - 0.03, yh + 0.02, zh - 0.03); root.add(lever);
  const key = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.004, 16), GG.gearMat('dark'));
  key.quaternion.copy(boss.quaternion); key.position.set(xh, yh - 0.035, zh - 0.008); root.add(key);
  group.add(root);
}
// CAR-3 (the user, 12 Nov: "the TOW session has also developed a trailer, and for this trailer it has developed some tail
// lights ... inherit them"): carTail - the trailer's combination lamp (src/vehicle/trailer_model.js: a black housing,
// stop / tail red, the amber indicator, the white reverse) stood upright on each of the rear wall's rounded corners,
// facing back and out along the corner's own 45-degree line (the airframe's sections just ahead of the wall: where the
// half-width grows as fast as the body runs forward), its foot 5 cm over the rear bumper. A sharp corner (no 45-degree
// run inside 25 cm) takes it on the wall's face, 6 cm in from the side. Absent = none.
const CAR_LENS = {};
function carLensMat(col, em) {
  const k = col + '|' + em; if (CAR_LENS[k]) return CAR_LENS[k];
  const m = new THREE.MeshStandardMaterial({ color: col, emissive: em, emissiveIntensity: 1, roughness: 0.22, metalness: 0.05 });
  m.userData.aeroskin = 1;                                   // a lens is never the grey understudy
  return (CAR_LENS[k] = m);
}
function carTailLamps(group, P, AF) {
  const z0 = AF.z0, H = 0.27, W = 0.075;
  const halfX = (y, z) => { let best = null; for (let d = 0; d < 180; d++) { const a = AF.surf(z, d * Math.PI / 180), b = AF.surf(z, (d + 1) * Math.PI / 180);
    if (a && b && (a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const t = (y - a[1]) / (b[1] - a[1]), x = Math.abs(a[0] + (b[0] - a[0]) * t); if (best == null || x > best) best = x; } } return best; };
  // the lamp's foot: the rear bumper's top (bumperBuild's own height) + 5 cm, else a fifth of the way up the wall
  let bot = Infinity, top = -Infinity;
  for (let a = 0; a <= 180; a += 3) { const q = AF.surf(z0 + 0.05, a * D2R); if (q && isFinite(q[1])) { bot = Math.min(bot, q[1]); top = Math.max(top, q[1]); } }
  if (!isFinite(bot)) return;
  const yFoot = +P.bumpR ? bot + (+P.bumpY || 0) + Math.max(0.06, +P.bumpH || 0.15) / 2 + 0.05 : bot + 0.2 * (top - bot);
  const yc = yFoot + H / 2;
  // the corner's 45-degree station: d ahead of the wall where d(half)/dd falls to 1
  let dc = null, xc = null;
  for (let d = 0.004; d < 0.25; d += 0.004) {
    const h0 = halfX(yc, z0 + d), h1 = halfX(yc, z0 + d + 0.004);
    if (h0 == null || h1 == null) continue;
    if ((h1 - h0) / 0.004 <= 1) { dc = d; xc = h0; break; }
  }
  const root = new THREE.Group(); root.name = 'edTailLamps';
  const black = GG.gearMat('dark'), chrome = GG.gearMat('chrome');
  const red = carLensMat(0xb3141c, 0x5a0408), amber = carLensMat(0xe08a1e, 0x4a2404), white = carLensMat(0xf2f0e8, 0x2a2a26);
  for (const sg of [-1, 1]) {
    let pos, nrm;
    if (dc != null) { pos = new THREE.Vector3(sg * xc, yc, z0 + dc); nrm = new THREE.Vector3(sg, 0, -1).normalize(); }
    else { const h = halfX(yc, z0 + 0.01); if (h == null) continue; pos = new THREE.Vector3(sg * (h - 0.06), yc, z0); nrm = new THREE.Vector3(0, 0, -1); }
    const lamp = new THREE.Group();
    const add = (w, h, d, mat, y, out) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(0, y, out); lamp.add(m); };
    add(W + 0.016, H + 0.016, 0.022, black, 0, 0.002);            // the housing, half in the skin
    add(W + 0.006, H + 0.006, 0.006, chrome, 0, 0.012);          // the bezel
    add(W, H * 0.58, 0.01, red, H * 0.21, 0.016);                // stop / tail
    add(W, H * 0.24, 0.01, amber, -H * 0.2, 0.016);              // the indicator
    add(W, H * 0.14, 0.01, white, -H * 0.415, 0.016);            // reverse
    lamp.position.copy(pos);
    lamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
    root.add(lamp);
  }
  group.add(root);
}
function spareBuild(group, P, AF) {
  const localBox = o => { const b2 = new THREE.Box3(); o.updateMatrixWorld(true);
    o.traverse(m => { if (!m.isMesh || !m.geometry) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const bm = m.geometry.boundingBox.clone(); let n = m; const M = new THREE.Matrix4();
      while (n && n !== group) { n.updateMatrix(); M.premultiply(n.matrix); n = n.parent; }
      b2.union(bm.applyMatrix4(M)); });
    return b2; };
  // (CAR-3, the user 13 Nov: "for the back to be nice to look at, just put a spare wheel in the middle of the left
  // door, centered on the part without the window at the bottom"): spareAt 1 = ON THE REAR WALL - the same wheel,
  // carrier, strap and buckle, drawn in a RIG whose +x is aft (the wall's outward normal) and whose +z runs across the
  // car, stood on the wall plane AF.z0 at spareX across (spareSide's side) and spareY over the wall's own mid-height;
  // spareK scales the wheel (absent 1 = the road wheels' size). Absent spareAt = the flank, as before.
  const REAR = Math.round(+P.spareAt || 0) === 1;
  const side = +P.spareSide < 0 ? -1 : 1;
  const sg = REAR ? 1 : side;
  const zW = REAR ? AF.z0 + 0.05 : +P.spareZ;
  const z = REAR ? 0 : zW;
  const R = Math.max(0.1, +P.s1R || 0.3) * (+P.spareK > 0 ? +P.spareK : 1);   // the road wheels' size
  const yAbs = (typeof AF.cyAt === 'function' ? AF.cyAt(zW) : 0) + (+P.spareY || 0);
  const y = REAR ? 0 : yAbs;
  const root = new THREE.Group(); root.name = 'edSpare';
  const rig = REAR ? new THREE.Group() : root;
  if (REAR) { rig.position.set(side * Math.abs(+P.spareX || 0), yAbs, AF.z0); rig.rotation.y = Math.PI / 2; root.add(rig); }
  // THE WHEEL, drawn fresh by the road wheels' own builder - no brake, NO HUB CAP (the user: "remove the little hubcap so
  // that it presents a flatter surface"), built at the origin first to measure its tyre, then seated
  const wb = { tyre: GG.Bag(), hub: GG.Bag(), brake: GG.Bag(), alloy: GG.Bag(), dark: GG.Bag(), brakefix: GG.Bag(), steel: GG.Bag() };
  GG.wheel(wb, [0, 0, 0], [sg, 0, 0], R, { brake: false, inboard: sg, P: Object.assign({}, P, { whCap: 0 }) });
  const wg = new THREE.Group();
  for (const k of ['tyre', 'hub', 'alloy', 'dark']) if (wb[k] && wb[k].mesh) wb[k].mesh(wg, GG.gearMat(k));
  rig.add(wg);
  const tb = new THREE.Box3().setFromObject(wg);
  const hwT = Math.max(Math.abs(tb.min.x), Math.abs(tb.max.x));     // the tyre's half-width (its widest, the bulge)
  const Rr = R * (+P.whRimD > 0 ? Math.min(0.85, +P.whRimD) : 0.42);
  // the flank: the body's half-width over the tyre's height and length
  let half = 0;
  if (!REAR) for (let zz = z - R; zz <= z + R + 1e-6; zz += R / 6)
    for (let a = 0; a <= 180; a += 2) { const q = AF.surf(zz, a * D2R);
      if (q && isFinite(q[0]) && q[1] >= y - R && q[1] <= y + R) half = Math.max(half, Math.abs(q[0])); }
  const CARRIER = 0.034;                                   // flange + clearance between the flank and the tyre's inner wall
  const xc = sg * (half + CARRIER + hwT);
  wg.position.set(xc, y, z);
  // the frame the fittings are drawn in: u outward from the wheel's centre, v up, w along the car
  const W = (u, v, w) => new THREE.Vector3(xc + sg * u, y + v, z + w);
  const chrome = GG.gearMat('chrome'), alloy = GG.gearMat('alloy'), steel = GG.gearMat('steel');
  const leather = new THREE.MeshStandardMaterial({ color: 0x5a3822, roughness: 0.68, metalness: 0, side: THREE.DoubleSide });
  const leatherEdge = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  const add = (geo, mat, pos, rot) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.copy(pos); if (rot) m.quaternion.copy(rot); rig.add(m); return m; };
  const qTo = (x, yy, zz) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, yy, zz).normalize());
  const alongU = qTo(sg, 0, 0), alongW = qTo(0, 0, 1);
  // ---- THE CARRIER: a domed flange on the flank, four bolts, the stub axle through the hub - and past it, THE SPIKE
  const uFl = -(hwT + CARRIER) + 0.004;
  const fl = new THREE.LatheGeometry([new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.075, 0.0), new THREE.Vector2(0.074, 0.004),
    new THREE.Vector2(0.06, 0.009), new THREE.Vector2(0.035, 0.013), new THREE.Vector2(0.0, 0.014)], 40);
  add(fl, steel, W(uFl - 0.004, 0, 0), alongU);
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2;
    add(new THREE.CylinderGeometry(0.0065, 0.0065, 0.006, 6), chrome, W(uFl + 0.005, 0.055 * Math.sin(a), 0.055 * Math.cos(a)), alongU); }
  // THE DISC'S OWN FACE: its outermost point at every radius, read off the built wheel (hub, rim, spokes - not the tyre),
  // so the strap and the tab lie ON the disc rather than behind it (an estimate put them behind its boss)
  const tyreM = GG.gearMat('tyre'), BIN = 0.01, prof = [];
  wg.traverse(m => { if (!m.isMesh || m.material === tyreM) return; const A = m.geometry.attributes.position;
    for (let k = 0; k < A.count; k++) { const r = Math.hypot(A.getY(k), A.getZ(k)), u = sg * A.getX(k), b = Math.floor(r / BIN);
      if (r < Rr + 0.01 && (prof[b] == null || u > prof[b])) prof[b] = u; } });
  const discU = r => { let u = -1; const b0 = Math.floor(Math.max(0, r - 0.025) / BIN), b1 = Math.floor((r + 0.025) / BIN);
    for (let b = b0; b <= b1; b++) if (prof[b] != null) u = Math.max(u, prof[b]); return u > -1 ? u : 0.5 * hwT; };
  const tS = 0.0045, wS = 0.036, off = tS / 2 + 0.0015;
  const face0 = discU(0.02), spikeEnd = face0 + 0.05;
  add(new THREE.CylinderGeometry(0.019, 0.022, face0 - uFl, 20), alloy, W((uFl + face0) / 2, 0, 0), alongU);   // the stub
  add(new THREE.CylinderGeometry(0.011, 0.011, spikeEnd - face0, 16), alloy, W((face0 + spikeEnd) / 2, 0, 0), alongU);   // the spike
  for (let k = 0; k < 6; k++) add(new THREE.TorusGeometry(0.0112, 0.0012, 6, 16), alloy, W(face0 + 0.024 + k * 0.004, 0, 0),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(sg, 0, 0)));        // its thread
  add(new THREE.SphereGeometry(0.011, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), alloy, W(spikeEnd, 0, 0), alongU);   // the rounded point
  // the wing nut, clamping the strap's tab on the spike
  const uN = face0 + tS + 0.011;
  add(new THREE.CylinderGeometry(0.016, 0.018, 0.014, 16), chrome, W(uN, 0, 0), alongU);
  for (const s2 of [-1, 1]) {
    const wing = new THREE.Shape(); wing.moveTo(0, -0.008); wing.lineTo(0.03, -0.006); wing.quadraticCurveTo(0.042, 0.004, 0.03, 0.014); wing.lineTo(0, 0.009); wing.lineTo(0, -0.008);
    const g = new THREE.ExtrudeGeometry(wing, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2, curveSegments: 10 });
    const m = add(g, chrome, W(uN + 0.002, 0, 0));
    m.rotation.set(0, sg > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
    m.rotateZ(s2 > 0 ? 0 : Math.PI);
  }
  // ---- THE STRAP, over the whole wheel: a bracket on the flank, over the tyre's crown following its section, down the
  // outer wall, on over the rim onto the disc, to the BUCKLE low on the disc; from there the lower strap to a tab on the
  // spike, the free end through the buckle and down, held by a keeper
  const vC = (R + Rr) / 2, aU = hwT, aV = (R - Rr) / 2;
  const onSec = th => [(aU + off) * Math.cos(th), vC + (aV + off) * Math.sin(th)];
  const sweep = (pts, mat, width) => {
    const ww = width || wS, n = pts.length, pos = [], idx = [];
    for (let k = 0; k < n; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const nu = ty, nv = -tx, [u, v] = pts[k];
      for (const [s1, s2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const q = W(u + nu * s1 * tS / 2, v + nv * s1 * tS / 2, s2 * ww / 2); pos.push(q.x, q.y, q.z); }
    }
    for (let k = 0; k < n - 1; k++) { const a = k * 4, b = (k + 1) * 4;
      for (let e = 0; e < 4; e++) { const e1 = (e + 1) % 4; idx.push(a + e, b + e, b + e1, a + e, b + e1, a + e1); } }
    for (const a of [0, (n - 1) * 4]) idx.push(a, a + 1, a + 2, a, a + 2, a + 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g.computeVertexNormals(); return add(g, mat);
  };
  // the anchor: a bracket and its D-ring on the flank, level with the tyre's upper inner wall
  const vA = vC + aV * 0.85, uA = uFl + 0.004;
  add(new THREE.BoxGeometry(0.008, 0.05, wS + 0.016), steel, W(uA - 0.006, vA, 0));
  add(new THREE.TorusGeometry(0.012, 0.0026, 8, 20, Math.PI), chrome, W(uA + 0.004, vA, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sg > 0 ? -Math.PI / 2 : Math.PI / 2, -Math.PI / 2)));
  // the strap's whole line, top to the spike: the crown arc, then the disc's face down to the centre
  const line = [[uA + 0.01, vA]];
  // (the arc ends on the outer wall's lower shoulder - past it the section turns in behind the rim - then steps onto the rim)
  for (let k = 0; k <= 36; k++) line.push(onSec(0.9 * Math.PI + (-0.3 * Math.PI - 0.9 * Math.PI) * k / 36));
  const [uS, vS] = onSec(-0.3 * Math.PI), uR = discU(Rr) + off;
  for (let k = 1; k <= 4; k++) { const t = k / 4; line.push([uS + (uR - uS) * t, vS + (Rr - 0.01 - vS) * t]); }
  for (let v = Rr - 0.025; v >= 0.03; v -= 0.012) line.push([Math.max(discU(v) + off, 0), v]);
  // the buckle low on the disc, at vB: the line splits there (upper strap ends at the buckle's roller, the lower begins)
  const vB = 0.5 * Rr + 0.02;
  const kB = line.findIndex((p, k) => k > 10 && p[1] <= vB);
  sweep(line.slice(0, kB + 1), leather);
  sweep(line.slice(kB + 2), leather);
  add(new THREE.CylinderGeometry(wS / 2, wS / 2, tS, 28), leather, W(face0 + tS / 2 + 0.0015, 0, 0), alongU);   // the tab round the spike
  // the buckle: in the strap's plane at the split (t down the strap, n out of the disc, w across)
  const [ub, vb] = line[kB + 1], tu = 0, tv = -1, nu = 1, nv = 0;
  const BK = (s, w, h) => W(ub + nu * h + tu * s, vb + nv * h + tv * s, w);
  const fw = wS / 2 + 0.006, fh = 0.018, fr = 0.006, frame = [];
  for (const [cw, cs, a0] of [[fw - fr, fh - fr, 0], [-(fw - fr), fh - fr, Math.PI / 2], [-(fw - fr), -(fh - fr), Math.PI], [fw - fr, -(fh - fr), 1.5 * Math.PI]])
    for (let k = 0; k <= 5; k++) { const a = a0 + k / 5 * Math.PI / 2; frame.push(BK(cs + fr * Math.sin(a), cw + fr * Math.cos(a), tS + 0.002)); }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(frame, true, 'catmullrom', 0.05), 96, 0.0028, 10, true), chrome);
  add(new THREE.CylinderGeometry(0.0034, 0.0034, 2 * fw - 0.004, 14), chrome, BK(-fh, 0, tS + 0.0025), alongW);   // the roller
  add(new THREE.CylinderGeometry(0.0034, 0.0034, 2 * fw - 0.004, 14), chrome, BK(0, 0, tS + 0.0015), alongW);     // the centre bar
  const tA = BK(0, 0, tS + 0.004), tB = BK(fh + 0.003, 0, tS + 0.0055);
  add(new THREE.CylinderGeometry(0.0017, 0.0017, tA.distanceTo(tB), 10), chrome, tA.clone().add(tB).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tB.clone().sub(tA).normalize()));   // the tongue
  // the upper strap's free end: out through the frame, down over the lower strap, punched, a rounded tip
  const tail = []; for (let k = 0; k <= 8; k++) { const v = vb - fh - 0.004 - k * 0.009; tail.push([discU(v) + off + tS * 1.15, v]); }
  sweep(tail, leather);
  const [ue, ve] = tail[tail.length - 1];
  add(new THREE.CylinderGeometry(wS / 2, wS / 2, tS, 24, 1, false, Math.PI / 2, Math.PI), leather, W(ue, ve, 0), alongU);   // its rounded tip
  for (let k = 0; k < 3; k++) { const [u, v] = tail[2 + k * 2];
    add(new THREE.CylinderGeometry(0.0026, 0.0026, tS * 1.7, 10), leatherEdge, W(u, v, 0), alongU); }             // the holes
  // the keeper, round both layers just under the buckle
  const kv = vb - fh - 0.02, ku = discU(kv) + off, kt = 0.0035, kp = [];
  for (const [h, w] of [[tS * 2.2 + kt, wS / 2 + kt], [tS * 2.2 + kt, -(wS / 2 + kt)], [-tS / 2 - kt, -(wS / 2 + kt)], [-tS / 2 - kt, wS / 2 + kt]])
    kp.push(W(ku + h, kv, w));
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(kp, true, 'catmullrom', 0.2), 40, 0.004, 6, true), leatherEdge);
  rig.traverse(m => { if (m.isMesh && m.parent === rig) m.name = 'edSpareFit'; });
  group.add(root);
  return root;
}

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
  // WILGA-GEAR (the user, 9 Nov: "allow only a fairing for the leg, not the wheel on this suspension type"): the trailing
  // link's wheel swings on its arm under the boot - it wears no spat and no trousers (the leg-fairing row is its fairing)
  for (const st of stations) if (st.leg === 4 && !st.single) st.fair = 0;
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
    // CAR-4 (the user, 12 Nov: "back wheels track should be equal to the front wheel track"): twBoomOut sets the boom
    // wheels that far OUTBOARD of the booms (metres; absent 0 = under the boom, as before) - a UTV's rear track off rails
    // that sit inboard
    const x0 = sgn * (TBg.x + Math.max(0, +P.twBoomOut || 0));
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
  // (P2, the user: "the shading inside the cuts looks odd ... a closed section, where we first cut, then extrude the cut
  // and close it": ONE well per cut - its walls and its ceiling from the nacelle's or the cowl's MAIN skin (its largest
  // mesh) and from a gear pod; every other shell of it - the inner twin, the lips, the ducts, the seams - only has the
  // hole cut, so no second box stands inside the first and fights it)
  // (the OUTER skins: those whose box lies inside no other skin mesh's box; an inlet's duct, a lip, a seam lie inside the
  // cowl's own - an adjoining barrel and tail cone are both outer, each building the well where the cut crosses it)
  { const bx = new THREE.Box3();
    for (const N of NACS) { const sk = N.meshes.filter(o => !o.userData.innerTwin).map(o => ({ o, b: bx.setFromObject(o).clone() }));
      const vol = b => (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z);
      const inner = e => sk.some(f => f !== e && vol(f.b) > vol(e.b) && f.b.clone().expandByScalar(0.01).containsBox(e.b));
      for (const o of N.meshes) { const e = sk.find(x => x.o === o);
        o.userData.nacSkin = o.userData.innerTwin ? 'twin' : (!e || !inner(e)) ? 'skin' : 'shell'; } } }

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
    // HULL-B67 (the user: "your front wheel rotation point still pokes through a little. Place it higher maybe?"): on a
    // BOAT HULL the nose's trunnion stands where the V bottom is wide enough to hold it (its half-length 0.08 m) and
    // 20 mm more - the cabin-floor rule below sat it 5 cm over the keel, its ends out through the V's sides
    if (+P.hullOn && st.single && AF && AF.surf) {
      const kz = AF.keelAt(st.z);
      for (let d = 0.03; d <= 0.35; d += 0.005) { const y = kz + d; let hw = null;
        for (let a = 0; a < 180; a++) { const p0 = AF.surf(st.z, a * D2R), p1 = AF.surf(st.z, (a + 1) * D2R);
          if ((p0[1] - y) * (p1[1] - y) <= 0 && p0[1] !== p1[1]) { const t = (y - p0[1]) / (p1[1] - p0[1]), x = Math.abs(p0[0] + (p1[0] - p0[0]) * t); hw = hw == null ? x : Math.max(hw, x); } }
        if (hw != null && hw >= 0.08) return d + 0.02; }
    }
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
                    // (P2: the folding knee - its geometry solved here, the leg drawn to it: its head the knee)
                    const lS = !st.single && lFold(P), kneeS = !st.single && (kneeFold(P) || lS);
                    const KG = lS ? (LFOLD[sgn > 0 ? 'L' : 'R'] = lGeom(AF, st, sgn)) : kneeS ? (KNEE[sgn > 0 ? 'L' : 'R'] = kneeGeom(AF, st, sgn, kneeDoor(P))) : null;
                    st.ret = { in: retIn(st, m), pin: retPin(st), fix: bags, free: catS || kneeS, flip: catS, kneeB: KG ? KG.b : null, fits: catS || kneeS ? null : retFits };
                    st.leg = 2;
                    // GR: a shortening leg - its piston's own bags (they slide), its cylinder shortened for the travel
                    // (P2: a Catalina's oleo telescopes to tuck its wheel under a wing: its piston drawn apart, its cylinder 42 %)
                    if (catS) { st.ret.low = allBags(); st.P = Object.assign({}, st.P, { oleoCyl: Math.min(+st.P.oleoCyl || 0.55, 0.42) }); }
                    else if (shortRow(P, !!st.single) > 0) { st.ret.low = allBags(); st.P = Object.assign({}, st.P, { oleoCyl: cylFOf(st.P.oleoCyl, P, !!st.single) }); }
                    retMounts.push({ key: st.single ? 'T' : (sgn > 0 ? 'L' : 'R'), wing: !!m, depth: 2 * st.ret.in, z: st.z }); }
        if (st.leg === 0) r = GG.legBeam(lb, AFx, st.P, st, sgn);
        else if (st.leg === 1) r = GG.legLink(lb, AFx, st.P, st, sgn);
        // WILGA-GEAR: the trailing-link leg - its arm and the strut's two halves in their own bags (each posed apart)
        else if (st.leg === 4 && !st.single && GG.legLever) { lb.lever = { arm: allBags(), cyl: allBags(), rod: allBags() }; r = GG.legLever(lb, AFx, st.P, st, sgn); }
        else r = GG.legOleo(lb, AFx, st.P, st, sgn);
        rOleo = r; retLow = st.ret ? st.ret.low || null : null; retSc = st.ret ? st.ret.scissor || null : null;
        if (retLow && wu.proxy) wu.proxy.brakefix = retLow.brakefix;      // (the caliper rides the piston with its wheel)
        if (lb.lever && wu.proxy) wu.proxy.brakefix = lb.lever.arm.brakefix;   // (WILGA-GEAR: and the trailing arm's)
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
                      low: retLow, scissor: retSc,
                      lever: r.lever ? Object.assign({}, r.lever, { bags: lb.lever }) : null });   // WILGA-GEAR
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
  for (const k in bags) {
    const mb = bags[k].mesh(group, k === 'fair' && bags[k].tris ? spatM()
                                                                : GG.gearMat(k));
    if (mb && k === 'fair') mb.userData.gearFair = 1;   // WING-STRUCTURE: the fiche's cutaway shows the gear bare (metadata only)
  }
  // G58.2/.3: bake each unit into its own NAMED group — the join's
  // snapshot picks these up by name, exactly as it does the prop's
  for (const wb of wheelUnits) {
    const wg = new THREE.Group();
    wg.name = 'edWheel' + (wb.kind || 'T');
    for (const k of ['tyre', 'hub', 'brake', 'alloy', 'dark'])
      if (wb[k] && wb[k].mesh) wb[k].mesh(wg, GG.gearMat(k));
    group.add(wg);
  }
  // CAR-1 (the user, 12 Nov: "put a spare wheel on one of the sides, at the back, like the ref picture"): spareOn - the
  // rearmost drawn road wheel, copied and stood against the body's flank (spareSide 1 the left / port +x, -1 the right) at spareZ (metres,
  // the layers' z), its hub at the body's mid-height plus spareY. A picture only: it is not a unit, not a contact, and
  // it rides the body (named edSpare, not edWheel*). Absent = no spare.
  if (+P.spareOn && AF && typeof AF.surf === 'function') spareBuild(group, P, AF);
  if (typeof window !== 'undefined') window.CAGE_GEAR_HITCH = null;
  if (AF && typeof AF.surf === 'function') {
    if (+P.bumpF) bumperBuild(group, P, AF, scene, true);
    if (+P.bumpR) bumperBuild(group, P, AF, scene, false);
    if (Math.round(+P.extRelief || 0) === 4) rearDoorHardware(group, P, mesh);
    if (+P.carTail) carTailLamps(group, P, AF);
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
      if (k === 'lever') continue;                       // (WILGA-GEAR: the moving parts' own bags, meshed below)
      const mf = lu.bags[k].mesh(lg, legM(k, lu.bags[k]));
      if (k === 'fair' && mf) mf.userData.fair = 1;      // (WILGA-GEAR: GATE WILGAGEAR finds the fairings by it)
      if (mf && k === 'fair') mf.userData.gearFair = 1;   // (a spat or a leg shroud: WING-STRUCTURE's cutaway leaves it out)
      if (k === 'fair' && mf && exG > 0) {
        const sx = lu.axle ? Math.sign(lu.axle[0]) : 0;
        if (sx) mf.position.x += sx * exG; else mf.position.z += 0.6 * exG;
      }
    }
    group.add(lg);
    // WILGA-GEAR: THE TRAILING-LINK LEG'S MOVING PARTS, each its own named group (the arm with its horn and axle stub,
    // the strut's cylinder, its rod) - the preview row below and the flight (app.js, from the physics nodes) pose them
    if (lu.lever && lu.lever.bags) for (const [nm, key] of [['edLvArm', 'arm'], ['edLvCyl', 'cyl'], ['edLvRod', 'rod']]) {
      const gp = new THREE.Group(); gp.name = nm + lu.kind;
      const B = lu.lever.bags[key];
      for (const k in B) if (B[k].tris) { const m = B[k].mesh(gp, legM(k, B[k])); if (k === 'fair' && m) m.userData.fair = 1; }
      group.add(gp);
    }
  }
  // WILGA-GEAR: the legs' records (the drawing's frame, metres) - the join writes spec.gear.lever from them
  const leverOut = legUnits.filter(u => u.lever).map(u => ({ kind: u.kind, piv: u.lever.piv, ax: u.lever.ax, w: u.lever.w,
    axle: u.lever.axle, horn: u.lever.horn, top: u.lever.top, root: u.lever.root, rows: u.lever.rows,
    ...(u.lever.boot ? { boot: u.lever.boot } : {}) }));                    // (the fairing's own figures: GATE WILGAGEAR 7b)
  if (castorUnitOut) {
    const cgp = new THREE.Group();
    cgp.name = 'edCastorT';
    for (const k in castorUnitOut.bags) {
      const mf = castorUnitOut.bags[k].mesh(cgp, legM(k, castorUnitOut.bags[k]));
      if (mf && k === 'fair') mf.userData.gearFair = 1;
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
    // (P2: in a nacelle the plate keeps inside its skin - the nacelle's outer skin points, the layer's frame; a narrow
    // nacelle's top is narrower than a trunnion's plate)
    let nacPts = null;
    const roomX = (c, y) => {
      if (!nacPts) { nacPts = []; const inv = new THREE.Matrix4().copy(ctx.scene.matrixWorld).invert(), M4 = new THREE.Matrix4(), vv = new THREE.Vector3();
        for (const N of NACS) for (const o of N.meshes) { if (o.userData.nacSkin !== 'skin') continue; M4.multiplyMatrices(inv, o.matrixWorld);
          const pa = (o.userData.wellGeo0 || o.geometry).attributes.position; for (let i = 0; i < pa.count; i++) { vv.fromBufferAttribute(pa, i).applyMatrix4(M4); nacPts.push([vv.x, vv.y, vv.z]); } } }
      let lo = -Infinity, hi = Infinity, n = 0;
      for (const q of nacPts) if (Math.abs(q[2] - c[2]) < 0.04 && Math.abs(q[1] - y) < 0.02 && Math.abs(q[0] - c[0]) < 0.6) { n++; if (q[0] < c[0]) lo = Math.max(lo, q[0] - c[0]); else hi = Math.min(hi, q[0] - c[0]); }
      return n >= 2 && isFinite(lo) && isFinite(hi) ? Math.min(-lo, hi) : Infinity; };
    try { fittingsDraw(retFits.concat(mech && mech.fits || []), fit, group, KT, NACS.length ? roomX : null); } catch (e) { console.warn('gear fittings:', e); }
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
          for (const g of WELL_G) { const [hP, aP] = poseAll(C, [topOf(C), C.axle], g);
            gap = Math.min(gap, segDist(hP, aP, st.pin, st.tip) - (C.legR || 0.05) - 0.02, segDist(aP, aP, st.pin, st.tip) - C.R - 0.02); }
          if (gap < 0) red('strut', k, 'the mains meet a lift strut as they fold (' + Math.round(-gap * 1000) + ' mm into it)', FIT_ROWS[k].fold.concat(['s1X', 's1Z'])); } }
      for (const F of flaps) { const a = F.line[0], b = F.line[1], x0 = Math.min(Math.abs(a[0]), Math.abs(b[0])), x1 = Math.max(Math.abs(a[0]), Math.abs(b[0]));
        const zh = x => { const t = Math.max(0, Math.min(1, (Math.abs(x) - Math.abs(a[0])) / ((Math.abs(b[0]) - Math.abs(a[0])) || 1))); return a[2] + (b[2] - a[2]) * t; };
        for (const N of NACS) { if (N.kind === 'cowl' || Math.sign(N.xc) !== Math.sign(a[0])) continue;
          if (Math.abs(N.xc) + N.bb.hw > x0 && Math.abs(N.xc) - N.bb.hw < x1 && N.z0 < zh(N.xc) - 0.02)
            red('flap', 'L', 'the engine nacelle\'s tail runs through the flap at ' + Math.abs(N.xc).toFixed(2) + ' m (split the flap round it, or shorten the flap\'s span)', ['wgFlapSpan', 'engNacAt']); }
        for (const k of mainsK) { const C = swing[k]; if (Math.sign(topOf(C)[0]) !== Math.sign(a[0])) continue;
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
  // WILGA-GEAR: THE PREVIEW ROW (gearLvPos 0 extended .. 1 full stroke - the editor's slider, never saved): the arm, the
  // strut's halves and the wheel posed by the core's GEAR_LEVER (62c), the very arithmetic the flight poses them by
  const lvPos = Math.max(0, Math.min(1, +P.gearLvPos || 0)), GLv = (typeof GEAR_LEVER !== 'undefined') ? GEAR_LEVER : window.GEAR_LEVER;
  if (lvPos > 0 && leverOut.length && GLv) for (const u of leverOut) {
    const L = GLv.gearLeverInit({ piv: u.piv, ax: u.ax, w: u.w, axle: u.axle, horn: u.horn, top: u.top });
    const comp = (u.rows.ang - u.rows.comp) * Math.PI / 180, q = GLv.gearLeverAt(L, lvPos * comp);
    const pa = [u.piv[0] + u.ax[0], u.piv[1] + u.ax[1], u.piv[2] + u.ax[2]];
    const T = { edLvArm: GLv.gearNodeFrame([u.piv, u.axle, pa], [u.piv, q.axle, pa]),
                edLvCyl: GLv.gearNodeFrame([u.top, u.horn, [u.top[0] + u.ax[0], u.top[1] + u.ax[1], u.top[2] + u.ax[2]]],
                                           [u.top, q.horn, [u.top[0] + u.ax[0], u.top[1] + u.ax[1], u.top[2] + u.ax[2]]]),
                edLvRod: GLv.gearNodeFrame([u.horn, u.top, [u.horn[0] + u.ax[0], u.horn[1] + u.ax[1], u.horn[2] + u.ax[2]]],
                                           [q.horn, u.top, [q.horn[0] + u.ax[0], q.horn[1] + u.ax[1], q.horn[2] + u.ax[2]]]) };
    T.edWheel = T.edLvArm;
    group.traverse(o => {
      if (!o.name || o.name.slice(-1) !== u.kind) return;
      const t = T[o.name.slice(0, -1)];
      if (!t) return;
      o.matrix.set(t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8], t[9], t[10], t[11], 0, 0, 0, 1);
      o.matrix.decompose(o.position, o.quaternion, o.scale);
    });
  }
  // WILGA-GEAR: DOES THE TYRE CLEAR THE BODY AT FULL STROKE (the arm at its full-stroke angle, the tyre's inner face and its
  // upper half sampled, each point against the body's section at its station - clearBody's radial test): if not, the drop
  // and the full-stroke angle go red (CAGE_ROW_BAD) - a side view's overlap is not a hit, the wheel is outboard of the body
  let leverBad = null;
  if (leverOut.length && GLv && AF && typeof AF.surf === 'function' && typeof AF.cyAt === 'function') for (const u of leverOut) {
    const L = GLv.gearLeverInit({ piv: u.piv, ax: u.ax, w: u.w, axle: u.axle, horn: u.horn, top: u.top });
    const q = GLv.gearLeverAt(L, (u.rows.ang - u.rows.comp) * Math.PI / 180), st = contacts.find(c => Math.sign(c.p[0]) === Math.sign(u.axle[0]));
    const R = st ? st.R : 0.2, sg = Math.sign(u.axle[0]) || 1;
    let hit = false;
    for (let k = 0; k <= 12 && !hit; k++) {
      const a = Math.PI * k / 12, p = [q.axle[0] - sg * 0.45 * R, q.axle[1] + R * Math.sin(a), q.axle[2] + R * Math.cos(a)];
      const cy = AF.cyAt(p[2]), dx = p[0], dy = p[1] - cy, rp = Math.hypot(dx, dy);
      if (rp < 1e-6) { hit = true; break; }
      const sf = AF.surf(p[2], Math.atan2(dx, -dy));
      if (sf && isFinite(sf[0]) && rp < Math.hypot(sf[0], sf[1] - cy) + 0.02) hit = true;
    }
    if (hit) { const why = 'at full stroke the tyre meets the body (a longer leg, or less swing)';
      leverBad = Object.assign(leverBad || {}, { s1Drop: why, s1_lvComp: why }); }
  }
  // (CAR-1: `group` - the join's mount walk starts from the wing layer's group, and a wingless build has none)
  window.CAGE_GEAR = { AF, contacts, pitch, gy, saddles: saddlesOut, group,
    ...(leverOut.length ? { lever: leverOut } : {}),                // WILGA-GEAR: the trailing-link legs as drawn
    ...(leverBad ? { leverBad } : {}),
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
  // CAR (the user, 12 Nov: "for retractable wheels we have pretty much everything we need. We can cut the fuselage at
  // the shape of the wheel and do a little wheel well in it"): archOn 1 the rear axle, 2 the front, 3 both - a WHEEL
  // ARCH round each road wheel of that axle: the side wells' own cut (the knife looking at the flank, _cage_ui wellApply
  // and quickshot apply CAGE_GEAR.cutsSide) - the wheel's circle plus archGap, open below the body's bottom edge,
  // recessed inward to a wall archGap inboard of the drawn tyre's inner face. Absent = none.
  const archK = Math.round(+P.archOn || 0);
  if (archK && AF && typeof AF.surf === 'function' && contacts && contacts.length) {
    const gap = +P.archGap > 0 ? +P.archGap : 0.04;
    const byst = new Map();
    for (const c of contacts) { if (!byst.has(c.st)) byst.set(c.st, []); byst.get(c.st).push(c); }
    const axles = [...byst.values()].filter(g => g.length === 2).sort((a, b) => a[0].p[2] - b[0].p[2]);
    const pick = [];
    if (axles.length && (archK & 1)) pick.push(axles[0]);
    if (axles.length > 1 && (archK & 2)) pick.push(axles[axles.length - 1]);
    // the drawn tyres' boxes, the group's frame (the AF's)
    const tyreBoxes = [];
    group.updateMatrixWorld(true);
    group.traverse(o => { if (!/^edWheel/.test(o.name || '')) return;
      const b = new THREE.Box3(); const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
      o.traverse(m => { if (m.isMesh && m.geometry) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        b.union(m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))); } });
      if (isFinite(b.min.x)) tyreBoxes.push(b); });
    const arch = [];
    for (const ax of pick) for (const c of ax) {
      const sg = c.p[0] >= 0 ? 1 : -1, R = c.R, zc = c.p[2], yc = c.p[1];
      let hwT = 0.15 * R;
      for (const b of tyreBoxes) { const cx = 0.5 * (b.min.x + b.max.x), cz = 0.5 * (b.min.z + b.max.z);
        if (Math.abs(cx - c.p[0]) < R && Math.abs(cz - zc) < R) hwT = Math.max(0.02, 0.5 * (b.max.x - b.min.x)); }
      const xIn = Math.abs(c.p[0]) - hwT - gap;
      let yb = Infinity;
      for (let a = 0; a <= 180; a += 4) { const q = AF.surf(zc, a * D2R); if (q && isFinite(q[1])) yb = Math.min(yb, q[1]); }
      if (!isFinite(yb)) continue;
      const Ra = R + gap, s0 = Math.max(-0.999, Math.min(0.999, (yb - 0.03 - yc) / Ra)), t0 = Math.asin(s0);
      let o = [];
      for (let k = 0; k <= 40; k++) { const t = t0 + (Math.PI - 2 * t0) * k / 40;
        o.push([(zc + Ra * Math.cos(t)) / FS, -sg * (yc + Ra * Math.sin(t)) / FS]); }
      let a2 = 0; for (let i = 0; i < o.length; i++) { const p0 = o[i], q0 = o[(i + 1) % o.length]; a2 += p0[0] * q0[1] - q0[0] * p0[1]; }
      if (a2 < 0) o = o.reverse();
      const fl = -xIn / FS, us = o.map(q => q[0]), vs = o.map(q => q[1]);
      const u0 = Math.min(...us) - 0.1, v0 = Math.min(...vs) - 0.1, d = Math.max(Math.max(...us) - u0, Math.max(...vs) - v0) + 0.2;
      arch.push({ units: ['arch' + (sg > 0 ? 'R' : 'L') + Math.round(zc * 100)], side: sg, mode: 'box',
                  frame: { n0: [sg, 0, 0], c0: [0, 0, 0], t1: [0, 0, 1], t2: [0, -sg, 0] }, outline: o, ceil: fl,
                  hf: { u0, v0, d, nu: 2, nv: 2, e: [fl, fl, fl, fl] }, arch: 1 });
    }
    if (arch.length) window.CAGE_GEAR.cutsSide = (window.CAGE_GEAR.cutsSide || []).concat(arch);
  }
  if (stat && notes.length) stat.textContent += '  ·  gear: ' + notes.join(' · ');
};
})();
