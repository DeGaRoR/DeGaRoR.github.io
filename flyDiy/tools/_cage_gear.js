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
  gearPos: 1, gearFold: 0, gearFoldNose: 0, gearRetFrac: 1, gearWellCut: 0,
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
  ['s' + i + 'Leg',   'leg',          0, 3, 1, GP.LEGS, sOn(i)],
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
  ['s' + i + 'Steer', 'steering',     i === 2 ? 1 : 0, 2, 1, GP.STEERS, i === 2 ? Object.assign(sOn(i), { optOrder: () => [1, 2] }) : sOn(i)],
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
};
const FOLD_KEYS = ['inward', 'outward', 'aftFlat', 'aftBelly', 'skymaster', 'custom'];
const FOLD_NOSE_KEYS = ['aft', 'fwd', 'custom'];
const FOLD_LABELS = { inward: 'inward (into the wing root)', outward: 'outward', aftFlat: 'aft, the wheel turned flat',
  aftBelly: 'aft and in, flat (twist-and-tuck)', skymaster: 'two axes (Skymaster)', aft: 'aft', fwd: 'forward',
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
// THE CHAIN of one unit, its senses probed: u the leg unit (root, axle, the moving end, the wheel's axis), key L / R / T
function foldChain(u, key, P) {
  const h = (u.root || u.moving || u.axle).slice(), ax = u.axle, top = u.moving || u.axle;
  const F = foldOf(P, key === 'T'), side = key === 'R' ? -1 : 1;
  const leg = fNrm([top[0] - h[0], top[1] - h[1], top[2] - h[2]]);
  const C = { hinge: h, leg, twist: side * (F.twist || 0) * D2R, turns: [], frac: Math.max(0.3, Math.min(1, +P.gearRetFrac || 1)),
              R: u.R || 0.2, wAx: u.waxis ? fNrm(u.waxis) : [1, 0, 0], axle: ax.slice() };
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
  // the LIFT: how far the wheel's lowest point rises, the gear up (at the fraction), over the ground (the pitch's frame)
  const bottom = (c, a) => c[1] - C.R * Math.sqrt(Math.max(0, 1 - a[1] * a[1]));
  const Mup = foldPose(C, 0), axUp = fApp(Mup, [ax[0] - h[0], ax[1] - h[1], ax[2] - h[2]]);
  C.lift = Math.max(0, bottom([h[0] + axUp[0], h[1] + axUp[1], h[2] + axUp[2]], fApp(Mup, C.wAx)) - bottom(ax, C.wAx));
  return C;
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
const poseAll = (C, pts, g) => { const M = foldPose(C, g), h = C.hinge;
  return pts.map(p => { const q = fApp(M, [p[0] - h[0], p[1] - h[1], p[2] - h[2]]); return [h[0] + q[0], h[1] + q[1], h[2] + q[2]]; }); };
// the rows each test hands the builder, per unit (the mains' s1 rows and fold, the nose's s2 rows and fold)
const FIT_ROWS = {
  L: { fold: ['gearFold', 'gm1Ax', 'gm1Ang', 'gm2Ax', 'gm2Ang', 'gmTwist'], st: 's1' },
  R: { fold: ['gearFold', 'gm1Ax', 'gm1Ang', 'gm2Ax', 'gm2Ang', 'gmTwist'], st: 's1' },
  T: { fold: ['gearFoldNose', 'gn1Ax', 'gn1Ang', 'gn2Ax', 'gn2Ang', 'gnTwist'], st: 's2' },
};
const UNIT_WORD = { L: 'the left main', R: 'the right main', T: 'the nose wheel' };
function foldFit(P, swing, AF, W) {
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
  // the body: inside its section at the point's station and angle (AF's table, metres); depth > 0 inside
  const bodyIn = p => {
    if (!AF || p[2] < AF.z0 || p[2] > AF.z1) return -1;
    const cy = AF.cyAt(p[2]), ang = Math.atan2(p[0], cy - p[1]);
    const s = AF.surf(p[2], ang), r = Math.hypot(s[0], s[1] - cy), d = Math.hypot(p[0], p[1] - cy);
    return r - d;
  };
  // the wing: between its skins at the point's plan position (the drawn wing's probes); depth > 0 inside
  const wingIn = p => {
    if (!W || !W.underAt || !W.overAt) return -1;
    const u = W.underAt(p[0], p[2]); if (!u) return -1;
    const o = W.overAt(p[0], p[2]); if (!o) return -1;
    return Math.min(p[1] - u.y, o.y - p[1]);
  };
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
        const db = bodyIn(p), dw = wingIn(p);
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
      for (const p of up.W) if (wingIn(p) > 0 && !(bodyIn(p) > 0)) { const f = chordFrac(p); if (f != null) { lo = Math.min(lo, f); hi = Math.max(hi, f); } }
      if (lo < hi && ((lo < sparF && hi > sparF) || (lo < sparR && hi > sparR)))
        fail('spar', key, word + ' crosses the ' + (lo < sparF && hi > sparF ? 'front' : 'rear') + ' spar, up',
             R.fold.concat([st + 'Z', st + 'AxZ', st + 'R', 'wgChord'])); }
    // FLOOR (inside the body, at any position)
    { let worst = 0;
      for (const ps of posed[key]) for (const p of ps.W.concat(ps.L)) if (bodyIn(p) > 0 && p[1] > floorY - FIT.floor) worst = Math.max(worst, p[1] - floorY + FIT.floor);
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
  out.cuts = wellCutsOf(units, bodyIn, +P.gearWellCut === 1 ? 'box' : 'exact');
  out.ms = +((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0).toFixed(1);
  return out;
}
const WELL_G = Array.from({ length: 17 }, (_, i) => 1 - i / 16);
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
  // exact: the hull of the points each grown by the clearance (a 12-gon round each hull corner)
  const h = hull2(pz), grown = [];
  for (const p of h) for (let k = 0; k < 12; k++) grown.push([p[0] + clr * Math.cos(k * Math.PI / 6), p[1] + clr * Math.sin(k * Math.PI / 6)]);
  return hull2(grown);
}
function wellCutsOf(units, bodyIn, mode) {
  const cuts = [];
  for (const key in units) {
    const U = units[key], all = U.pts.W.concat(U.pts.L), inside = [];
    let prev = null, prevD = null;
    for (const g of WELL_G) {
      const ps = poseAll(U.C, all, g), ds = ps.map(bodyIn);
      for (let i = 0; i < ps.length; i++) {
        if (ds[i] > 0) inside.push(ps[i]);
        if (prev && (ds[i] > 0) !== (prevD[i] > 0)) {         // crossing the skin between two poses
          const t = prevD[i] / (prevD[i] - ds[i]), a = prev[i], b = ps[i];
          inside.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
        }
      }
      prev = ps; prevD = ds;
    }
    if (inside.length < 3) continue;
    let top = -Infinity;
    for (const p of inside) top = Math.max(top, p[1]);
    const pz = inside.map(p => [p[2], p[0]]);
    cuts.push({ units: [key], mode, pz, hull: wellOutline(pz, mode, FIT.clear), ceil: top + FIT.clear });
  }
  // merge the ones that meet (their points together, the higher ceiling)
  for (let again = true; again;) {
    again = false;
    for (let i = 0; i < cuts.length && !again; i++) for (let j = i + 1; j < cuts.length && !again; j++)
      if (hullsMeet(cuts[i].hull, cuts[j].hull)) {
        const pz = cuts[i].pz.concat(cuts[j].pz);
        cuts[i] = { units: cuts[i].units.concat(cuts[j].units), mode, pz, hull: wellOutline(pz, mode, FIT.clear),
                    ceil: Math.max(cuts[i].ceil, cuts[j].ceil) };
        cuts.splice(j, 1); again = true;
      }
  }
  return cuts.map(c => ({ units: c.units, mode: c.mode, hull: c.hull, ceil: c.ceil }));
}
// the cuts in the knife's terms: cage units (metres / FS), the outline in the well frame's (u, v) = (z, -x), CCW
function cutsCage(cuts, FS) {
  return (cuts || []).map(c => {
    let o = c.hull.map(p => [p[0] / FS, -p[1] / FS]);
    let a2 = 0;
    for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
    if (a2 < 0) o = o.slice().reverse();
    return { units: c.units, mode: c.mode, outline: o, ceil: c.ceil / FS };
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
const GEAR_RETRACTABLE = P => !!(+P.gearRetract && !+P.gearFloats && +P.s2On && Math.round(+P.s2Leg) !== 3 &&
                                 Math.round(+P.wgPos) === 2);
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
  // (shown on a low wing on wheels - ONE row from the stock aeroplane brings it, GATE PARTS' reach; the nose wheel the
  // retraction also needs is the join's and the swing's own test, GEAR_RETRACTABLE)
  ], { when: P => +P.gearOn * (1 - (+P.gearFloats || 0)) * (Math.round(+P.wgPos) === 2 ? 1 : 0) > 0 }],
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
  const stations = GP.gearStations(P);
  // RETRACT-1: a retracting gear is drawn bare (no spat, no trouser, no leg shroud: noRet above)
  if (GEAR_RETRACTABLE(P)) for (const st of stations) { st.fair = 0; st.legFair = 0; }
  for (const st of stations)
    if (st.leg === 3) st.z = AF.z0 + Math.max(0.02, st.z);

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
      return { zRoot: R.rodSpan.zRoot * FS, zTip: R.rodSpan.zTip * FS, r: S.rod.r * FS,
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
    provider.saddle = { ctr: [0, rodSpan.yAx(st.z), st.z], axis: [0, 0, -1], r: rodSpan.r };
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

  const contacts = [];
  // G188: the third wheel is the station the table FLAGS single (row 2), not
  // whichever contact happens to sit on the centreline; a tailwheel builder
  // is centreline by construction, so it gets one contact whatever its row's
  // lateral offset says (two identical contacts otherwise).
  const isSingle = st => st.single != null ? !!st.single : st.x <= 0.01;
  for (const st of stations) {
    const sides = (st.leg === 3 || st.x <= 0.01) ? [0] : [-1, 1];
    for (const s of sides) {
      const sgn = s === 0 ? 1 : s;
      let r;
      const lb = allBags();               // this unit's LEG bags
      const wu = wheelProxy(st.leg === 3 ? null : lb);
      // the fairing's instruments ride the station (G133)
      const fOpt = { full: st.fair === 2, skirt: st.fairSkirt,
                     tail: st.fairTail, rake: st.fairRake, width: st.fairW };
      // NEW-SHAPES-1 (the Camel, 27 Oct): a biplane's V bolts to the fuselage's lower longerons, ahead of and under
      // the lower plane - the low-wing rule below would root it on that plane. `s<i>Root` 1 says the fuselage.
      const m = st.root === 1 ? null : wingMount(st, sgn);
      // THE OPEN FRAME (2026-09-04, spec §1.7): with no skin the fuselage
      // contract is a surface that is not there — the leg roots on the
      // nearest truss member instead, with a pivot (see openMount); the
      // low-wing rule still wins where it applies
      const rm = m ? null : rodMount(st);
      const om = (m || rm) ? null : openMount(st, sgn);
      if (m) { st.mount = m; onWing++; }
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
        const cb = allBags();
        const proxy = Object.assign({}, lb, wu.wb, { castorBags: cb });
        // G326: the steering springs run to the RUDDER'S horn, which the
        // hinge layer draws — so it draws the runs too, from the ears the
        // castor publishes below. Without that layer (a bench without it)
        // the castor keeps its own picture.
        st.steerByHinge = !!window.HINGE_GEN;
        r = GG.legTailwheel(proxy, AFx, st.P, st);
        if (r.castor)
          castorUnitOut = { bags: cb, top: r.castor.top, ax: r.castor.ax,
                            axle: r.axle, ears: r.castor.ears };
      } else {
        if (st.leg === 0) r = GG.legBeam(lb, AFx, st.P, st, sgn);
        else if (st.leg === 1) r = GG.legLink(lb, AFx, st.P, st, sgn);
        else r = GG.legOleo(lb, AFx, st.P, st, sgn);
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
      delete st.mount;
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
                      waxis: r.axis || null, R: st.R });   // G1: the wheel's axis and radius (the lift)
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
  let swing = null, fit = null;
  if (GEAR_RETRACTABLE(P)) {
    swing = {};
    for (const u of legUnits) {
      const key = u.kind === 'T' ? 'T' : u.kind;
      if (!swing[key] && (u.axle || u.moving)) swing[key] = foldChain(u, key, P);
    }
    // G2: the fit (the gear layer runs after the wing: CAGE_WING is this build's)
    try { fit = foldFit(P, swing, AF, window.CAGE_WING); } catch (e) { fit = null; console.warn('gear fit:', e); }
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
    const g = Math.max(0, Math.min(1, P.gearPos == null ? 1 : +P.gearPos));
    if (g < 1) group.traverse(o => {
      const mm = /^ed(?:Leg|Wheel)([LRT])$/.exec(o.name || '') || (o.name === 'edCastorT' ? [0, 'T'] : null);
      const C = mm && swing[mm[1]];
      if (!C) return;
      const M = foldPose(C, g), h = C.hinge, Mh = fApp(M, h);
      o.matrix.set(M[0], M[1], M[2], h[0] - Mh[0], M[3], M[4], M[5], h[1] - Mh[1], M[6], M[7], M[8], h[2] - Mh[2], 0, 0, 0, 1);
      o.matrix.decompose(o.position, o.quaternion, o.scale);
    });
  }
  window.CAGE_GEAR = { AF, contacts, pitch, gy, saddles: saddlesOut,
    ...(swing ? { swing } : {}),
    ...(fit ? { fit } : {}),            // G2: does the fold fit (foldFit; the rows it turns red: CAGE_ROW_BAD)
    ...(fit && fit.wells ? { wells: fit.wells } : {}),   // G3: the reserved volumes (the join's gear.wells, the tanks' keep-out)
    // G4: the wells' cuts in the knife's terms (cage units, the plan outline, the ceiling) - _cage_ui cuts the DRAWN
    // fuselage with them (wellApply); the measured sheet is never cut (the legs stand on the skin the contracts read)
    ...(fit && fit.cuts && fit.cuts.length ? { cuts: cutsCage(fit.cuts, FS) } : {}),
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
