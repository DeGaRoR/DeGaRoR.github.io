// ENGINE GENERATOR — a simple, physical light-aero engine.
//
// WHY THIS EXISTS. The propeller graduated out of the registry in G4.7: its
// mass comes from material, diameter and blade count, its thrust from momentum
// theory, calibrated exactly on the A-65. The ENGINE never did. It is still
// `POWERPLANTS[t].engine.mass` — one number, dropped on two mount nodes at the
// front of the aeroplane (61_gen_frame.js: `pt(EL, 0.5 * (PP.engine.mass +
// S.prop.mass))`), which is the longest moment arm on the machine and so the
// costliest place to be approximate. It also gives the cowl something real to
// wrap, and it creates the hub node G4.7 said did not exist.
//
// THE MODEL, in three steps, each calibrated against the registry rather than
// asserted (tools/_eng_check.js is the verdict):
//
//   1. DISPLACEMENT is geometry:  Vd = n * pi/4 * bore^2 * stroke
//   2. POWER is BMEP:             P  = BMEP * Vd * rev/s / strokeDiv
//      Normally-aspirated four-strokes in this class run 9.0-10.4 bar and the
//      registry's own engines land inside that band — A-65 9.0, O-200 9.9,
//      IO-360 10.1, Jabiru 10.4. BMEP is therefore a real, narrow parameter,
//      not a fudge factor.
//   3. MASS TRACKS DISPLACEMENT, NOT POWER, AND SUB-LINEARLY. Per kW the
//      registry spreads 0.84-1.65 kg — twofold, correlating with nothing
//      useful. Per LITRE it is far tighter but still slides DOWNWARD with
//      size (A-65 28.6, Jabiru 27.1, O-200 25.8, IO-360 23.3, R-1830 19.5),
//      because the metal around a swept volume does not thicken in proportion
//      to it. A least-squares fit over those five gives
//
//          mass = 30.51 * litres^0.8735          (worst error 6.2%)
//
//      and ONE law covers a 2.2 litre flat four and a 38.5 litre radial
//      alike, which is why architecture does NOT get its own kg/litre. The
//      6.2% outlier is the A-65 reading light — and the registry's own note
//      says its 80 kg stands against a real 77, so the model is arguably
//      nearer the engine than the entry is.
//
//      A first cut used a flat 27 kg/litre and ran +31% on the IO-360 and
//      +45% on the R-1830. A constant looked right on the engine it was read
//      from and was wrong everywhere else; the exponent is the finding.
//
//      A gearbox and a water jacket are declared additions, never folded in
//      (the Rotax 912 reads 48 kg/litre, which is not a different rule — it
//      is a geared, liquid-cooled engine being three things at once).
//
// GEOMETRY. Cylinders are placed by ONE rule for every architecture: each sits
// at an ANGLE about the crank axis and a STATION along it, and the family is
// only a table of those. A flat four is two banks at +/-90 deg, a radial is one
// bank of n spread over 360, an inline is one bank at 0. That is why adding a
// V12 costs a table row and not a builder.
//
// Frame: crank axis along +z (the thrustline, nose at +z), y up, x lateral —
// the cage's frame, so the mesh drops into the same scenes. Metres, kg, W, Pa.
'use strict';

const ENG_UNIT = 1.0;                       // metres per unit; this file is SI

// ---------------------------------------------------------------------------
// MASS LAW, shared by every architecture (see 3 above). Fitted over the five
// air-cooled direct-drive engines in 00_registry.js.
const ENG_MASS_K = 30.51;        // kg at one litre
const ENG_MASS_E = 0.8735;       // exponent on litres

// ---------------------------------------------------------------------------
// ARCHITECTURES. `angles` gives each cylinder's angle about the crank axis, in
// degrees, 0 = straight up; `stations` which station along the axis it sits at.
// A radial puts every cylinder on ONE station, an inline gives each its own —
// that pair of tables IS the family, which is why a V12 costs a row and not a
// builder.
//
// `kM` multiplies the shared mass law. Flat and radial are 1.00 because they
// are what the fit was made from. INLINE WAS FITTED AT G165, when the first
// four-stroke in-lines could exist to fit it on — two of them, and the row
// below says which and what the residuals are. THE V WAS FITTED LAST
// (2026-09-05, the V test), on three published air-cooled aero Vs; its row
// says why its residuals are the widest of the four families.
// ---------------------------------------------------------------------------
// WHICH WAY A THING POINTS, once (G164). The engine already had one of
// these — `_eng_mesh.js` carried `AIM = [[0,-1],[0,1],[-1,0],[1,0]]` for the
// exhaust outlet (G155) — and the in-line bank needed the same four
// directions under the same four names. Two copies of "which way is left" on
// one engine is precisely the shape of the defect G163 spent a chantier
// undoing, so there is one table and both consumers derive from it: the
// exhaust wants the unit vector, the bank wants the angle about the crank.
//
// THE FRAME IS THE AEROPLANE'S: -x is the pilot's left, +y up, looking
// forward down the crank. The ORDER is the exhaust's own, because a builder
// setting two "points" rows on one engine must not meet two vocabularies.
const ENG_AIM = [
  { name: 'down',  v: [0, -1] },
  { name: 'up',    v: [0,  1] },
  { name: 'left',  v: [-1, 0] },
  { name: 'right', v: [1,  0] },
];
// degrees about the crank, 0 = straight up — the convention `angles` uses
const engAimDeg = i => {
  const a = ENG_AIM[Math.max(0, Math.min(ENG_AIM.length - 1, Math.round(+i || 0)))];
  return Math.atan2(a.v[0], a.v[1]) * 180 / Math.PI;
};

const ENG_ARCH = {
  flat: {
    name: 'Flat (boxer)', counts: [2, 4, 6, 8], kM: 1.00, bmep: 9.8,   // 8: the IO-720 (2026-09-05)
    // alternating banks, one cylinder per station per side
    angles: n => Array.from({ length: n }, (_, i) => (i % 2 ? 90 : -90)),
    stations: n => Array.from({ length: n }, (_, i) => Math.floor(i / 2)),
    nStations: n => Math.ceil(n / 2),
  },
  inline: {
    // MEASURED AT LAST (G165). `kM` and `bmep` were marked UNVALIDATED
    // because there was no registry example of an in-line — and there was
    // none because an in-line could only be a two-stroke, which the mass law
    // was never fitted on. Now that a four-stroke in-line can exist, two
    // well-documented ones settle it:
    //
    //   Walter Mikron III  2.44 L, 2600 rpm — 48 kW, 74 kg published
    //   Gipsy Major 1      6.12 L, 2100 rpm — 97 kW, 139 kg published
    //
    // FITTED ON kM ALONE, keeping the shared exponent. Two points cannot
    // honestly move an exponent, and pretending otherwise would be a curve
    // through its own noise: at kM 1.02 the residuals are -8% on the Mikron
    // and +9% on the Gipsy, which is the model over-predicting big engines
    // and under-predicting small ones — the exponent's own signature, left
    // declared rather than fudged. bmep 9.5 needed no change and is the
    // half that came out well: 50.3 kW and 101.8 kW against 48 and 97, so
    // under 5% on both, which is better than the mass law manages anywhere.
    name: 'Inline', counts: [4, 6], kM: 1.02, bmep: 9.5,
    // WHICH WAY THE BANK POINTS IS THE BUILDER'S (G164, the user's own item
    // "in line engine choice up/down/r/l"). 0 = straight up, which is why a
    // boxer is +/-90 — and since G163 the MESH honours this table, so the
    // whole feature is this one line: the envelope is measured off these
    // angles, the cowl is built on the envelope, and every route in the mesh
    // follows the cylinder. UP is the default because it is what an in-line
    // has always drawn; DOWN is the inverted engine a Gipsy Major is.
    angles: (n, P) => {
      const d = engAimDeg(P && P.inlineAim != null ? P.inlineAim : 1);
      return Array.from({ length: n }, () => d);
    },
    stations: n => Array.from({ length: n }, (_, i) => i),
    nStations: n => n,
  },
  vee: {
    // FITTED (2026-09-05, the V test — the user: "test the V configs, since
    // they've never been done"). Three published air-cooled aero Vs, all
    // inverted, none in the registry until this date:
    //   Hirth HM 508D   8.0 L, 3000 rpm — 209 kW, 186 kg   (V8 60°, NA)
    //   Argus As 10C   12.7 L, 2000 rpm — 176 kW, 213 kg   (V8 90°, NA)
    //   Ranger V-770   12.6 L, 3150 rpm — 388 kW, 320 kg   (V12 60°, blown)
    // kM ALONE, least squares in the log, the shared exponent kept (G165's
    // rule): 1.10 was the guess and read +11 % / +45 % / -4 % on mass; 0.95
    // reads -5 % / +25 % / -17 %. The scatter IS the finding: an Argus is
    // magnesium and light, a Ranger is long and heavy for its litres, and
    // one exponent cannot hold both — declared, not fudged. bmep from the two
    // NA rows (10.5 and 8.5 bar): 9.5, the in-line's own figure, which is
    // what a V is — two in-lines on one crank. An automobile V8 conversion
    // (an LS: 6.2 L, 205 kg with its drive) reads 27 % light under this law
    // and is a published-row engine, never a bench-derived one.
    name: 'V', counts: [6, 8, 12], kM: 0.95, bmep: 9.5, vee: 60,
    // two banks `vee` degrees apart, about the AIM the in-line already has
    // (G164's row: 1 up, 0 down — an aero V is almost always inverted)
    angles: (n, P) => {
      const d = engAimDeg(P && P.inlineAim != null ? P.inlineAim : 1);
      const half = (P && P.vee != null ? P.vee : 60) / 2;
      return Array.from({ length: n }, (_, i) => d + (i % 2 ? 1 : -1) * half);
    },
    stations: n => Array.from({ length: n }, (_, i) => Math.floor(i / 2)),
    nStations: n => Math.ceil(n / 2),
  },
  radial: {
    name: 'Radial', counts: [5, 7, 9], kM: 1.00, bmep: 9.6,
    // ONE row, spread evenly about the axis; 0 = straight up
    angles: n => Array.from({ length: n }, (_, i) => i * 360 / n),
    stations: n => Array.from({ length: n }, () => 0),
    nStations: () => 1,
  },
  electric: {
    name: 'Electric', counts: [0], kM: 1.00, bmep: 0,
    angles: () => [], stations: () => [], nStations: () => 1,
  },
  // THE TURBOPROP (2026-09-05, futureDesigns/TURBOPROP-2026-09-05.md §3):
  // no cylinders, so `counts` is EMPTY (the shape census in _eng_check has
  // nothing to iterate) and the resolve is turbResolve's, beside the
  // electric one. `kM`/`bmep` are the combustion law's and mean nothing here.
  turbine: {
    name: 'Turboprop', counts: [], kM: 1.00, bmep: 0,
    angles: () => [], stations: () => [], nStations: () => 1,
  },
};

// ---------------------------------------------------------------------------
// ELECTRIC (G25). A different engine, same epistemology — three steps, each
// a physical law calibrated on real machines, not a fudge:
//
//   1. TORQUE IS GEOMETRY:  T = 2 * sigma * Vrotor
//      A PM machine's torque is airgap shear stress times rotor surface
//      times radius, which collapses to twice the rotor volume times sigma.
//      Sigma is a REAL, NARROW parameter, the electric BMEP: continuous
//      shear comes out 15 kPa for a bare RC outrunner and 25-28 kPa for
//      aerospace axial-flux and liquid-cooled machines — one order of
//      magnitude below BMEP's bar, same kind of number.
//   2. POWER IS RPM:  P = T * omega. That is the whole story, and it is
//      why a 57-gram can at 8500 rpm keeps a park flyer up while the same
//      torque law's big brother turns 2500 on a Velis.
//   3. MASS TRACKS TORQUE, NOT POWER, AND SUB-LINEARLY. Fitted log-log
//      over five real motors spanning 0.15 to 220 Nm continuous — the
//      2212 outrunner (0.057 kg), EMRAX 188 (7.0), EMRAX 228 (12.3),
//      EMRAX 268 (20.3), Pipistrel E-811 (22.7):
//
//          mass = 0.274 * T^0.822          (worst error ~5%)
//
//      ONE law covers a 57 g park-flyer can and a certified trainer motor
//      — a 1500x torque span — and the exponent lands within 6% of the
//      combustion mass law's 0.8735 on displacement, which is the same
//      finding wearing two hats: the material around a working volume
//      does not thicken in proportion to it. The declared outlier is the
//      SP260D class (Siemens' record one-off reads 5.2 kW/kg; the law
//      says 80 kg where it weighs 50) — excluded from the fit and noted,
//      the A-65 move.
//
// THE FICHE INPUT IS THE CAN — outer diameter and length, the two numbers
// a caliper gives you — plus rpm. Style constants map can to rotor:
// an outrunner's magnet ring runs close to the can wall (kD 0.82), an
// axial-flux pancake works nearly its whole disc (0.90), a housed
// inrunner gives up radius to stator iron and case (0.75). Liquid
// cooling multiplies sigma by 1.30: that is WHAT COOLING BUYS, shear you
// may sustain, and it is why the E-811 and the pancakes read hotter
// than the bare RC can.
//
// THE CONTROLLER IS PART OF THE POWERPLANT AS NORMALLY EQUIPPED (the
// registry's dry-engine convention): escOn folds ~0.085 kg per cont-kW
// in. THE BATTERY IS NOT — it is the fuel tank's analog and belongs to
// the energy module (see HANDOVER riders), exactly as the combustion
// rows exclude their fuel.
// ---------------------------------------------------------------------------
// `kL` is the active-length fraction OF THE CAN LENGTH — except the pancake,
// whose torque rides its DISC: an axial-flux machine's airgap is the annular
// face, so its effective length scales with DIAMETER (diskL) and the can's
// axial length barely matters. The cylindrical rule read the EMRAX 268 36%
// low; the disc rule is the physical fix, not a tuned one.
const ELEC_STYLE = [
  { key: 'outrunner', name: 'Outrunner', kD: 0.82, kL: 0.55, sigma: 15e3 },
  { key: 'pancake', name: 'Axial pancake', kD: 0.90, diskL: 0.23, sigma: 28e3 },
  { key: 'housed', name: 'Housed inrunner', kD: 0.75, kL: 0.55, sigma: 25e3 },
];
// ---------------------------------------------------------------------------
// THE TURBINE'S CLASS CONSTANTS (2026-09-05, TURBOPROP §3 — the user's
// ruling: power FROM GEOMETRY, the electric can's precedent). A gas
// generator's first compressor stage is an annulus inside the can: its tip is
// `kD` of the can, its hub `kH` of the tip, and the air enters at `vax`
// metres a second — so the MASS FLOW is inlet geometry, and the core's
// THERMODYNAMIC power is `specKW` kilowatts per kilogram a second (pressure
// ratio 7-8, ~1000 °C turbine inlet). `specKW` and `vax` were fitted as ONE
// PRODUCT on the PT6A-114A and -34 (the kM lesson: two anchors cannot
// honestly move two constants): 0.40 m of can gives 3.49 kg/s and 629 kW,
// which a 1.26 margin flat-rates to 499 kW against the -114A's 503; 0.435 m
// gives 743 kW, 559 rated against the -34's 560. `n1` is the gas-generator
// spool (a readout), `n2` the power turbine the gearbox reduces from.
// ONE style today, the reverse-flow PT6 (ruling 3); a straight-through row
// (TPE331, Walter M601) is the next entry, not a rewrite.
const TURB_STYLE = [
  { key: 'pt6', name: 'PT6 reverse-flow', kD: 0.55, kH: 0.50, vax: 100,
    specKW: 180, n1: 37500, n2: 33000 },
];
const TURB_RHO0 = 1.225;        // the ISA datum, the same 1.225 05_atmos declares
// MASS TRACKS THE CORE'S POWER, sub-linearly: m = K * kWthermo^E. Fitted on
// the -114A (160 kg, 629 kWth) and the -34 (150 kg, 743 kWth) with the
// exponent DECLARED, the way kM was: K 3.75 puts the residuals at -8 % and
// +8 %, which is the two engines disagreeing about how heavy a gearbox is,
// left declared rather than fudged. The registry rows keep P&W's own numbers.
const TURB_MASS_K = 3.75;
const TURB_MASS_E = 0.57;

const ELEC_MASS_K = 0.274;      // kg at one newton-metre (continuous)
const ELEC_MASS_E = 0.822;      // exponent on torque
const ELEC_ESC_KGKW = 0.085;    // controller kg per continuous kW
const ELEC_LIQ_K = 1.30;        // sigma multiplier a water jacket buys
const ELEC_PEAK_K = 2.0;        // burst/continuous ratio (declared, not rated)

// ---------------------------------------------------------------------------
// THE FICHE. Defaults are a Continental A-65 — the engine the whole fleet's
// thrust model is anchored on (G4.7), so the identity case is the one aeroplane
// whose numbers are already validated.
// ---------------------------------------------------------------------------
const ENG_DEFAULT = {
  arch: 'flat',
  cyl: 4,
  bore: 0.0983,            // m  (3.875 in)
  stroke: 0.0921,          // m  (3.625 in)
  rpm: 2300,
  twoStroke: 0,
  vee: 60,                 // degrees, `vee` architecture only
  // WHICH WAY AN IN-LINE'S BANK POINTS — an index into ENG_AIM, `inline`
  // architecture only, exactly as `vee` is the V's own. 1 is UP, which is
  // what an in-line has always drawn; the index is the exhaust outlet's own
  // (0 down, 1 up, 2 left, 3 right) so the two "points" rows on one engine
  // cannot mean different things by "left".
  inlineAim: 1,
  // DECLARED ADDITIONS, never folded into kMass: a reduction gearbox and a
  // water jacket are things an engine HAS, and a single kg/litre that hid them
  // would make one number mean three.
  geared: 0, gearRatio: 2.27,
  liquid: 0,
  // THE BLOWER (2026-09-05): 0 none, 1 turbocharger, 2 supercharger.
  // `boost` is the rated manifold pressure over ambient (a 914's 40 inHg is
  // 1.34) and multiplies bmep; `critAlt` is metres of ISA altitude the rating
  // holds to (05_atmos reads it through the row's aspiration).
  blower: 0, boost: 1.0, critAlt: 0,
  // ELECTRIC (arch 'electric'): the can IS the fiche. Defaults are the
  // registry's own 2212 outrunner — the electric anchor, as the A-65 is
  // the combustion one. rpm rides the shared key (electric default 8500
  // when the spec is silent — a can spins an order of magnitude faster
  // than a crank, and inheriting 2300 would make the anchor read dead).
  eStyle: 0,               // index into ELEC_STYLE
  canD: 0.0278,            // m — can / housing outer diameter
  canL: 0.026,             // m — can / housing length, bearing to bearing
  volts: 11.1,             // pack voltage (readout: cells, implied KV)
  escOn: 1,                // controller in the mass, as normally equipped
  // TURBOPROP (arch 'turbine', 2026-09-05): the gas generator IS the fiche.
  // Its own keys (tCanD/tCanL, not the electric can's) so the two groups do
  // not double-render one row. Defaults are the PT6A-114A's — the Caravan's.
  tStyle: 0,               // index into TURB_STYLE
  tCanD: 0.40,             // m — gas generator case diameter
  tCanL: 1.05,             // m — gas generator length, gearbox face to accessory case
  gearK: 1.20,             // reduction gearbox diameter / can diameter
  flatK: 1.26,             // flat-rating margin, core over rated (05_atmos reads it)
  tRpm: 1900,              // propeller rpm (the gearbox's output)
  stackStyle: 1,           // 1 = the PT6's paired stacks, 0 = bare
  // installation
  accessories: 1,          // magnetos, pumps, starter, alternator
  exhaust: 1,
  // geometry knobs (fractions of bore unless stated)
  finR: 1.34,              // fin diameter / bore
  finN: 9,                 // cooling fins per barrel
  headR: 1.46,             // head diameter / bore
  caseK: 1.0,              // scales the derived crankcase radius
  cylK: 1.85,              // cylinder projection beyond the stroke, / bore
  sump: 0.55,              // sump + induction depth below the case, / caseR
  pitch: 1.30,             // station spacing / bore
  flangeR: 0.44, flangeLen: 0.055,   // prop flange, metres for the length
  accLen: 0.16,            // accessory case length, metres
  sect: 12,                // sides on a barrel
};

const ENG_MAT = {
  case: 'engCase', barrel: 'engBarrel', head: 'engHead',
  fin: 'engFin', flange: 'engFlange', exhaust: 'engExhaust', acc: 'engAcc',
};

// ---------------------------------------------------------------------------
// RESOLVE, ELECTRIC — same output shape as the combustion resolve (env, cgZ,
// items, place), so the cowl fit, the mount and the mesh read one contract.
// Every dimension is a ratio of canD/canL — no metre constants (the electric
// registry span is 28 mm to 420 mm of can, the same 15x the scale check
// guards on the combustion side).
// ---------------------------------------------------------------------------
function elecResolve(P, spec) {
  const s = Math.max(0, Math.min(ELEC_STYLE.length - 1, Math.round(P.eStyle)));
  const ST = ELEC_STYLE[s];
  const rpm = (spec && spec.rpm !== undefined) ? P.rpm : 8500;

  // 1. torque is geometry
  const rotorD = ST.kD * P.canD;
  const rotorL = ST.diskL ? ST.diskL * P.canD : ST.kL * P.canL;
  const Vr = Math.PI / 4 * rotorD * rotorD * rotorL;
  const sigma = ST.sigma * (P.liquid ? ELEC_LIQ_K : 1);
  const torque = 2 * sigma * Vr;                       // Nm, continuous

  // 2. power is rpm
  const omega = rpm / 60 * 2 * Math.PI;
  const powerW = torque * omega;                       // continuous
  const powerPeakW = ELEC_PEAK_K * powerW;             // burst, declared

  // 3. mass tracks torque, sub-linearly; the extras declared, never folded
  const motorMass = ELEC_MASS_K * Math.pow(torque, ELEC_MASS_E);
  const escMass = P.escOn ? ELEC_ESC_KGKW * powerW / 1000 : 0;
  let mass = motorMass + escMass;
  // a belt/planetary reduction is rare on electric and light when it
  // exists — a ratio of the motor, never the combustion rule's +3 kg
  // constant (which would triple a park-flyer can)
  if (P.geared) mass += 0.22 * motorMass;
  if (P.liquid) mass += 0.06 * motorMass;              // jacket + pump share

  // ---- ENVELOPE + CG ------------------------------------------------------
  // The BARE MOTOR, like the combustion envelope is the bare engine: fins
  // and ribs stand a little proud on the dressed styles, the controller is
  // airframe-side and excluded — a cowl carries its own clearance anyway.
  const canR = P.canD / 2;
  const rE = canR * (s === 0 ? 1.0 : 1.07);
  const flangeL = 0.30 * P.canD;                       // shaft + prop flange
  const aftL = (s === 0 ? 0.30 : 0.18) * P.canL;       // stator base / resolver
  const zCanF = -flangeL, zCanB = zCanF - P.canL;
  const zAft = zCanB - aftL;
  const hull = [];
  for (let k = 0; k < 16; k++) {
    const t = k / 16 * Math.PI * 2;
    hull.push([Math.sin(t) * rE, Math.cos(t) * rE]);
  }
  const env = { x0: -rE, x1: rE, y0: -rE, y1: rE, z0: zAft, z1: 0, hull,
                width: 2 * rE, height: 2 * rE, length: -zAft, radius: rE };

  // CG: the motor is one dense lump at mid-can — the whole point of the
  // electric nose is how SHORT that arm is. The controller's arm is style-
  // dependent (an RC ESC rides the motor, a big inverter the firewall);
  // it is carried AT THE AFT FACE here, the conservative end of the
  // engine's own envelope — the airframe will place it properly.
  const items = [{ what: 'motor', m: motorMass * 0.96,
                   z: zCanF - 0.5 * P.canL },
                 { what: 'flange', m: motorMass * 0.04, z: -0.5 * flangeL }];
  if (escMass) items.push({ what: 'controller', m: escMass, z: zAft });
  const mTot = items.reduce((q, it) => q + it.m, 0) || 1;
  const cgZ = items.reduce((q, it) => q + it.m * it.z, 0) / mTot;

  return {
    arch: 'electric', archName: ST.name + ' electric', styleKey: ST.key,
    cyl: 0, displacement: 0, litres: 0, bmep: 0,
    torque, sigma, powerW, powerPeakW, powerHP: powerW / 745.7, rpm,
    kv: P.volts > 0 ? rpm / (0.85 * P.volts) : 0,      // loaded ~0.85*KV*V
    cells: Math.max(1, Math.round(P.volts / 3.7)),
    mass, motorMass, escMass,
    kgPerLitre: 0, kgPerKW: powerW ? mass / (powerW / 1000) : 0,
    env, cgZ, items,
    place: { canR, canD: P.canD, canL: P.canL, rotorD, rotorL, flangeL,
             zCanF, zCanB, zAft, eStyle: s,
             // the combustion place contract, satisfied trivially so the
             // shared consumers (governor, mount, check rulers) read one
             // shape: caseR IS the can radius
             caseR: canR, ang: [], stn: [], nSt: 1, pitch: 0,
             r0: canR, cylLen: 0, rTip: canR, headR: 0, sump: 0,
             zOf: () => zCanB },
    P: Object.assign({}, P, { rpm }),
  };
}

// ---------------------------------------------------------------------------
// RESOLVE, TURBOPROP (2026-09-05, TURBOPROP §3) — the electric resolve's
// shape exactly: the same output contract (env, cgZ, items, place with the
// combustion keys satisfied trivially AND the electric's canR/zCanF/zCanB so
// the mesh gate's rulers read it through the branch they already have), and
// every dimension a ratio of tCanD/tCanL — no metre constants.
//
//   1. mass flow is inlet geometry     mdot = rho0 * vax * A(kD, kH, canD)
//   2. the core's power is mass flow   Pthermo = specKW * mdot
//   3. rated power is the flat rating  P = Pthermo / flatK
//   4. mass tracks the core's power    m = K * kWthermo^E
//   5. the gearbox reduces n2 to the prop rpm the builder dials
//
// The layout along the crank, flange at z = 0, aft is -z: flange, the
// reduction gearbox (fatter than the core — a PT6's nose is not a taper),
// the gas generator can, the accessory case. The inlet plenum wraps the
// rear of the can, which is why `env.radius` is the larger of gearbox and
// plenum and not the can itself.
// ---------------------------------------------------------------------------
function turbResolve(P, spec) {
  const s = Math.max(0, Math.min(TURB_STYLE.length - 1, Math.round(P.tStyle)));
  const ST = TURB_STYLE[s];
  const canD = Math.max(0.05, P.tCanD), canL = Math.max(0.1, P.tCanL);

  // 1. mass flow is inlet geometry
  const dTip = ST.kD * canD, dHub = ST.kH * dTip;
  const inletA = Math.PI / 4 * (dTip * dTip - dHub * dHub);
  const mdot = TURB_RHO0 * ST.vax * inletA;                 // kg/s

  // 2-3. the core's power, flat-rated to what the gearbox is sold for
  const powerThermoW = ST.specKW * 1e3 * mdot;
  const flatK = Math.max(1, Math.min(2, +P.flatK || 1));
  const powerW = powerThermoW / flatK;

  // 5. the prop turns what the builder dialled; the gearbox makes it so
  const rpm = Math.max(1, +P.tRpm || 1);
  const gearRatio = ST.n2 / rpm;
  const torque = powerW / (rpm / 60 * 2 * Math.PI);        // Nm at the prop

  // 4. mass, from the core's power; the extras declared, never folded
  let mass = TURB_MASS_K * Math.pow(powerThermoW / 1000, TURB_MASS_E);
  if (!P.accessories) mass *= 0.93;       // starter-generator, FCU, pumps
  if (!P.exhaust) mass *= 0.985;          // the two stacks

  // ---- ENVELOPE + CG ------------------------------------------------------
  const canR = canD / 2;
  const gearK = Math.max(0.9, Math.min(1.5, +P.gearK || 1.2));
  const gearR = gearK * canR;
  const flangeL = 0.12 * canD, gearL = 0.55 * canD, accL = 0.35 * canD;
  const plenR = 1.12 * canR;                                // the inlet plenum
  const zGearF = -flangeL, zCanF = zGearF - gearL;
  const zCanB = zCanF - canL, zAft = zCanB - accL;
  const rE = Math.max(gearR, plenR);
  const hull = [];
  for (let k = 0; k < 16; k++) {
    const t = k / 16 * Math.PI * 2;
    hull.push([Math.sin(t) * rE, Math.cos(t) * rE]);
  }
  const env = { x0: -rE, x1: rE, y0: -rE, y1: rE, z0: zAft, z1: 0, hull,
                width: 2 * rE, height: 2 * rE, length: -zAft, radius: rE };

  // CG: the gearbox is a third of the engine and sits right behind the
  // flange; the core is most of the rest, mid-can; the accessories hang
  // aft. A PT6's CG is well AHEAD of its mount ring, which is the number the
  // frame cannot use yet (TURBOPROP §8, `cgFwd` owed).
  const accShare = P.accessories ? 0.10 : 0.03;
  const items = [
    { what: 'gearbox', m: mass * 0.35, z: zGearF - 0.5 * gearL },
    { what: 'core', m: mass * (0.65 - accShare), z: zCanF - 0.5 * canL },
    { what: 'accessories', m: mass * accShare, z: zCanB - 0.5 * accL },
  ];
  const mTot = items.reduce((q, it) => q + it.m, 0) || 1;
  const cgZ = items.reduce((q, it) => q + it.m * it.z, 0) / mTot;

  return {
    arch: 'turbine', archName: ST.name + ' turboprop', styleKey: ST.key,
    cyl: 0, displacement: 0, litres: 0, bmep: 0,
    mdot, inletA, powerThermoW, flatK, torque,
    powerW, powerHP: powerW / 745.7, rpm, n1: ST.n1, n2: ST.n2, gearRatio,
    mass, kgPerLitre: 0, kgPerKW: powerW ? mass / (powerW / 1000) : 0,
    env, cgZ, items,
    place: { canR, canD, canL, gearR, gearL, flangeL, accL, plenR,
             zGearF, zCanF, zCanB, zAft, tStyle: s,
             // the combustion place contract, satisfied trivially (the
             // electric's own ruling): caseR IS the can radius
             caseR: canR, ang: [], stn: [], nSt: 1, pitch: 0,
             r0: canR, cylLen: 0, rTip: canR, headR: 0, sump: 0,
             zOf: () => zCanB },
    P: Object.assign({}, P, { rpm }),
  };
}

// ---------------------------------------------------------------------------
// RESOLVE — the numbers. Pure; no geometry, no THREE, node-callable.
// ---------------------------------------------------------------------------
function engResolve(spec) {
  const P = Object.assign({}, ENG_DEFAULT, spec || {});
  if (P.arch === 'electric') return elecResolve(P, spec);
  if (P.arch === 'turbine') return turbResolve(P, spec);
  const A = ENG_ARCH[P.arch] || ENG_ARCH.flat;
  const n = Math.max(1, Math.round(P.cyl));

  // 1. displacement
  const swept = Math.PI / 4 * P.bore * P.bore * P.stroke;   // m3 per cylinder
  const Vd = swept * n;                                     // m3
  const litres = Vd * 1000;

  // 2. power. A four-stroke fires once every two revolutions, a two-stroke
  // every one — that is the whole of `strokeDiv`, and it is why a 500 cc
  // two-stroke keeps up with a litre of four-stroke.
  const strokeDiv = P.twoStroke ? 1 : 2;
  const revS = P.rpm / 60;
  // a blower raises the charge density and so the bmep, by the manifold
  // pressure ratio — the whole of a supercharger, at rated power
  const blown = Math.round(P.blower || 0) > 0;
  const boost = blown ? Math.max(1, Math.min(2.5, +P.boost || 1)) : 1;
  const powerW = (A.bmep * boost * 1e5) * Vd * revS / strokeDiv;

  // 3. mass, from swept volume, sub-linearly, with the extras declared.
  // The law was fitted against the registry's DRY ENGINE masses, which are
  // engines as normally equipped — so accessories and an exhaust are IN the
  // baseline and their flags REMOVE them. Adding them on top of a fit that
  // already contained them is how a model double-counts and reads 12% heavy
  // on every row at once.
  let mass = ENG_MASS_K * Math.pow(litres, ENG_MASS_E) * (A.kM || 1);
  if (!P.accessories) mass *= 0.91;
  if (!P.exhaust) mass *= 0.965;
  if (P.geared) mass += 0.14 * mass + 3.0;    // reduction unit
  if (P.liquid) mass += 0.11 * mass + 2.5;    // jacket, pump, radiator, coolant
  // THE BLOWER'S MASS, declared like the gearbox's: a turbocharger is a
  // housing, a wastegate and an intercooler outside the engine (a 914 over a
  // 912: +6 kg on 58 — 8 % + 2 kg); a mechanical supercharger is an impeller
  // in the rear case, and the big radials the mass law was fitted on already
  // carry one, so it adds the drive alone
  if (blown) mass += Math.round(P.blower) === 1 ? 0.08 * mass + 2.0 : 0.04 * mass;

  // ---- ENVELOPE + CG ------------------------------------------------------
  // The cowl is built around THIS, so it is measured off the same placement
  // rule the geometry uses rather than a second guess at the same shape.
  const ang = A.angles(n, P).map(d => d * Math.PI / 180);
  const stn = A.stations(n);
  const nSt = A.nStations(n);
  const pitch = P.pitch * P.bore;
  // THE CRANKCASE IS SIZED BY WHAT IT HOUSES, not by a fraction of the bore:
  // it has to clear the crank throw (stroke/2) and carry a main bearing round
  // it. As a bore fraction it came out 0.12 m across on an A-65, which is
  // narrower than the crankshaft, and the whole engine read as a toy.
  const caseR = P.caseK * (0.55 * P.stroke + 0.45 * P.bore);
  // A GEARED FLAT ENGINE IS LONGER (G25.1, the 912 review): the reduction
  // gearbox is a real conical housing AHEAD of the case, so the crank —
  // and everything on it — moves aft to make room. Flat only: the radial's
  // nose cone and the two-strokes' compact end-boxes already read right,
  // and the R-1830's approved look must not move.
  const gearLen = (P.geared && P.arch === 'flat') ? 0.85 * caseR : 0;
  // A CYLINDER IS MOSTLY NOT ITS STROKE. Measured off the real engines: an
  // A-65 is 0.79 m across a 0.22 m crankcase, so each cylinder projects
  // 0.285 m on a 0.092 m stroke — three times it. The finned barrel and a
  // deep head are the rest, and both scale with BORE.
  const cylLen = P.stroke + P.cylK * P.bore;
  const r0 = caseR + 0.06 * P.bore;                 // base sits on the case
  const rTip = r0 + cylLen;
  const headR = P.headR * P.bore / 2;
  // sump/induction depth below the case — not modelled in detail, but a real
  // engine is not a bare barrel and a cowl has to clear this
  const sump = P.sump * caseR;

  // stations run aft from the flange; z = 0 is the CRANK NOSE (flange face);
  // a geared flat engine's stations sit a gearbox further aft
  const zOf = s => -(P.flangeLen + gearLen + 0.5 * pitch + s * pitch);
  let x0 = -caseR, x1 = caseR, y0 = -caseR - sump, y1 = caseR;
  for (let i = 0; i < n; i++) {
    const c = Math.cos(ang[i]), s = Math.sin(ang[i]);
    const tx = s * rTip, ty = c * rTip;
    // THE HEAD'S RADIUS IS PERPENDICULAR TO ITS CYLINDER, not along it. The
    // first cut added headR to x AND y for every cylinder, which on a flat
    // engine widened the aeroplane by a head at each end — the head disc lies
    // across the axis, so it spans (cos a, -sin a) in plane and z out of it.
    const px = Math.abs(Math.cos(ang[i])) * headR;
    const py = Math.abs(Math.sin(ang[i])) * headR;
    x0 = Math.min(x0, tx - px); x1 = Math.max(x1, tx + px);
    y0 = Math.min(y0, ty - py); y1 = Math.max(y1, ty + py);
  }
  // WHAT THE ENVELOPE IS, stated because a cowl is going to be built on it:
  // the BARE ENGINE — crankcase, cylinders and heads, sump. The induction and
  // the accessories that sit ON TOP of a real flat engine are not modelled, so
  // the height is a floor rather than the installed height (the A-65 reads
  // 0.24 m here against roughly twice that installed; the width, 0.75 against
  // ~0.79, is right because that IS cylinders). A cowl must therefore carry
  // its own clearance rather than hug this — which is what a cowl does anyway.
  // THE SILHOUETTE, not just the box. A cowl is a rounded section, and asking
  // it to contain the CORNERS of a bounding box is asking it to contain metal
  // that is not there — a radial's box corners are empty, its real outline is
  // a circle through the head rims. So the envelope publishes the points that
  // are actually occupied, looking down the crank axis, and whatever wraps
  // this engine fits to those.
  const hull = [];
  const NC = 16;
  for (let k = 0; k < NC; k++) {              // the crankcase, and its sump
    const t = k / NC * Math.PI * 2;
    hull.push([Math.sin(t) * caseR,
               Math.cos(t) * caseR - (Math.cos(t) < 0 ? sump : 0)]);
  }
  for (let i = 0; i < n; i++) {               // each head's rim, edge on
    const c = Math.cos(ang[i]), s = Math.sin(ang[i]);
    const px = Math.cos(ang[i]), py = -Math.sin(ang[i]);   // in-plane normal
    for (let k = -1; k <= 1; k += 2)
      hull.push([s * rTip + px * headR * k, c * rTip + py * headR * k]);
    hull.push([s * rTip, c * rTip]);
  }
  const zAft = zOf(nSt - 1) - 0.5 * pitch - (P.accessories ? P.accLen : 0);
  const env = { x0, x1, y0, y1, z0: zAft, z1: 0, hull,
                width: x1 - x0, height: y1 - y0, length: -zAft,
                // what a cowl actually needs: the radius that encloses
                // everything, about the THRUSTLINE (G4.7's datum ruling)
                radius: Math.max(Math.abs(x0), Math.abs(x1),
                                 Math.abs(y0), Math.abs(y1)) };

  // CG along the crank axis, from the parts that carry the mass. The point of
  // the exercise: a lump at the mount nodes cannot tell a long six from a
  // short radial, and they balance an aeroplane very differently.
  const items = [];
  const caseMass = mass * (n ? 0.46 : 0.85);
  const cylMass = n ? mass * 0.34 / n : 0;
  const accMass = P.accessories ? mass * 0.13 : 0;
  const flMass = mass * 0.07;
  const zCase = (zOf(0) + zOf(nSt - 1)) / 2;
  items.push({ what: 'crankcase', m: caseMass, z: zCase });
  for (let i = 0; i < n; i++)
    items.push({ what: 'cylinder' + i, m: cylMass, z: zOf(stn[i]) });
  if (accMass) items.push({ what: 'accessories', m: accMass, z: zAft + 0.5 * P.accLen });
  items.push({ what: 'flange', m: flMass, z: -0.5 * P.flangeLen });
  const mTot = items.reduce((s, it) => s + it.m, 0) || 1;
  const cgZ = items.reduce((s, it) => s + it.m * it.z, 0) / mTot;

  return {
    arch: P.arch, archName: A.name, cyl: n,
    displacement: Vd, litres, bmep: A.bmep,
    powerW, powerHP: powerW / 745.7, rpm: P.rpm,
    // the blower (2026-09-05): what the row's aspiration and critAlt become
    blower: blown ? Math.round(P.blower) : 0, boost,
    critAlt: blown ? Math.max(0, +P.critAlt || 0) : 0,
    aspiration: blown ? (Math.round(P.blower) === 1 ? 'turbo' : 'super') : 'na',
    mass, kgPerLitre: litres ? mass / litres : 0,
    kgPerKW: powerW ? mass / (powerW / 1000) : 0,
    env, cgZ, items,
    // the placement rule, published so the geometry and the cowl agree
    place: { ang, stn, nSt, pitch, r0, cylLen, rTip, caseR, headR, sump,
             gearLen, zOf, zAft },
    P,
  };
}

// ---------------------------------------------------------------------------
// GEOMETRY — the cage's mesh shape ({V, F:[{v, m}]}) so it drops into the same
// viewers, the same OBJ export and, later, the same skin pipeline. Quads only,
// which is what the subdivision and the manifold checks expect.
// ---------------------------------------------------------------------------
function engBuild(spec) {
  const R = engResolve(spec);
  const P = R.P, L = R.place;
  const V = [], F = [];
  const v = p => { V.push(p); return V.length - 1; };
  const quad = (a, b, c, d, m) => F.push({ v: [a, b, c, d], m });

  // a ring of `sect` points about an axis, centred at c, in the plane whose
  // in-plane axes are u and w
  const ring = (c, u, w, r, sect) => {
    const out = [];
    for (let k = 0; k < sect; k++) {
      const t = k / sect * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
      out.push(v([c[0] + (u[0] * ct + w[0] * st) * r,
                  c[1] + (u[1] * ct + w[1] * st) * r,
                  c[2] + (u[2] * ct + w[2] * st) * r]));
    }
    return out;
  };
  const band = (A, B, m) => {
    for (let k = 0; k < A.length; k++) {
      const k2 = (k + 1) % A.length;
      quad(A[k], A[k2], B[k2], B[k], m);
    }
  };
  // a closed tube through a list of [centre, radius] along one axis
  const tube = (axis, u, w, steps, m, capA, capB) => {
    const rings = steps.map(s => ring(s.c, u, w, s.r, s.sect || P.sect));
    for (let i = 0; i + 1 < rings.length; i++) band(rings[i], rings[i + 1], m);
    // caps as fans of quads through the centre, kept as quads by pairing
    const cap = (rg, c, flip) => {
      const ci = v(c);
      for (let k = 0; k < rg.length; k++) {
        const k2 = (k + 1) % rg.length;
        quad(ci, flip ? rg[k2] : rg[k], flip ? rg[k] : rg[k2], ci, m);
      }
    };
    if (capA) cap(rings[0], steps[0].c, true);
    if (capB) cap(rings[rings.length - 1], steps[steps.length - 1].c, false);
    return rings;
  };

  const Z = [0, 0, 1], X = [1, 0, 0], Y = [0, 1, 0];

  // ---- crankcase: a barrel along the crank axis ---------------------------
  const zFront = -P.flangeLen, zBack = L.zAft + (P.accessories ? P.accLen : 0);
  tube(Z, X, Y, [
    { c: [0, 0, zFront], r: L.caseR * 0.86 },
    { c: [0, 0, zFront - 0.03], r: L.caseR },
    { c: [0, 0, zBack + 0.03], r: L.caseR },
    { c: [0, 0, zBack], r: L.caseR * 0.86 },
  ], ENG_MAT.case, true, true);

  // ---- prop flange + shaft ------------------------------------------------
  tube(Z, X, Y, [
    { c: [0, 0, 0], r: P.flangeR * P.bore },
    { c: [0, 0, -0.012], r: P.flangeR * P.bore },
    { c: [0, 0, -0.012], r: L.caseR * 0.52 },
    { c: [0, 0, zFront], r: L.caseR * 0.52 },
  ], ENG_MAT.flange, true, false);

  // ---- cylinders ----------------------------------------------------------
  // ONE builder for every architecture: the family only changed the angle and
  // the station, which is the whole design of ENG_ARCH.
  for (let i = 0; i < R.cyl; i++) {
    const a = L.ang[i], z = L.zOf(L.stn[i]);
    const dir = [Math.sin(a), Math.cos(a), 0];              // cylinder axis
    const u = [Math.cos(a), -Math.sin(a), 0], w = Z;        // its section plane
    const at = r => [dir[0] * r, dir[1] * r, z];
    const bore2 = P.bore / 2;
    // barrel, from the case wall out
    tube(dir, u, w, [
      { c: at(L.r0 * 0.72), r: bore2 * 1.06 },
      { c: at(L.r0), r: bore2 * 1.02 },
      { c: at(L.r0 + P.stroke * 0.96), r: bore2 * 1.02 },
    ], ENG_MAT.barrel, false, false);
    // COOLING FINS: what makes an air-cooled engine read as one. Discs, not a
    // texture — they are the silhouette inside an open cowl.
    for (let k = 0; k < P.finN; k++) {
      const t = (k + 0.5) / P.finN;
      const rr = L.r0 + P.stroke * 0.96 * t;
      const th = P.stroke * 0.96 / P.finN * 0.34;
      const A0 = ring(at(rr - th), u, w, bore2 * 1.04, P.sect);
      const A1 = ring(at(rr - th), u, w, P.finR * bore2, P.sect);
      const B1 = ring(at(rr + th), u, w, P.finR * bore2, P.sect);
      const B0 = ring(at(rr + th), u, w, bore2 * 1.04, P.sect);
      band(A0, A1, ENG_MAT.fin); band(A1, B1, ENG_MAT.fin);
      band(B1, B0, ENG_MAT.fin);
    }
    // head
    const hz = L.r0 + P.stroke * 0.96;
    tube(dir, u, w, [
      { c: at(hz), r: bore2 * 1.06 },
      { c: at(hz + 0.012), r: L.headR },
      { c: at(hz + P.bore * 0.50), r: L.headR },
      { c: at(hz + P.bore * 0.62), r: L.headR * 0.80 },
    ], ENG_MAT.head, false, true);
    // exhaust stub, angled aft off the head
    if (P.exhaust) {
      const eb = at(hz + P.bore * 0.30);
      const ed = [dir[0] * 0.45, dir[1] * 0.45, -0.89];
      const en = Math.hypot(ed[0], ed[1], ed[2]);
      const e = [ed[0] / en, ed[1] / en, ed[2] / en];
      const eu = [Math.cos(a), -Math.sin(a), 0];
      const ew = [-(e[1] * eu[2] - e[2] * eu[1]), -(e[2] * eu[0] - e[0] * eu[2]),
                  -(e[0] * eu[1] - e[1] * eu[0])];
      const p1 = [eb[0] + e[0] * P.bore * 0.9, eb[1] + e[1] * P.bore * 0.9,
                  eb[2] + e[2] * P.bore * 0.9];
      tube(e, eu, ew, [
        { c: eb, r: P.bore * 0.17, sect: 8 },
        { c: p1, r: P.bore * 0.15, sect: 8 },
      ], ENG_MAT.exhaust, false, true);
    }
  }

  // ---- sump / induction below the case ------------------------------------
  // A radial has neither (its case is round and the induction is behind), so
  // this follows the same rule the envelope uses rather than a second one.
  if (L.sump > 1e-4 && R.arch !== 'radial' && R.cyl) {
    const yTop = -L.caseR * 0.55, yBot = -L.caseR - L.sump;
    const zA = zFront - 0.02, zB = zBack + 0.02;
    const xw = L.caseR * 0.82;
    const P4 = (a, b, c, d, m) => quad(a, b, c, d, m);
    const rowAt = (z, y, w) => [v([-w, y, z]), v([w, y, z])];
    const t0 = rowAt(zA, yTop, xw), t1 = rowAt(zB, yTop, xw);
    const b0 = rowAt(zA, yBot, xw * 0.66), b1 = rowAt(zB, yBot, xw * 0.66);
    P4(t0[0], t0[1], t1[1], t1[0], ENG_MAT.case);      // top (inside the case)
    P4(b0[1], b0[0], b1[0], b1[1], ENG_MAT.case);      // bottom
    P4(t0[1], t0[0], b0[0], b0[1], ENG_MAT.case);      // front
    P4(t1[0], t1[1], b1[1], b1[0], ENG_MAT.case);      // back
    P4(t0[0], b0[0], b1[0], t1[0], ENG_MAT.case);      // left
    P4(t1[1], b1[1], b0[1], t0[1], ENG_MAT.case);      // right
  }

  // ---- accessory case at the back ----------------------------------------
  if (P.accessories) {
    tube(Z, X, Y, [
      { c: [0, 0, zBack], r: L.caseR * 0.94 },
      { c: [0, 0, L.zAft + P.accLen * 0.5], r: L.caseR * 0.82 },
      { c: [0, 0, L.zAft], r: L.caseR * 0.58 },
    ], ENG_MAT.acc, false, true);
  }

  return { V, F, resolved: R };
}

if (typeof module !== 'undefined')
  module.exports = { ENG_ARCH, ENG_AIM, engAimDeg, ELEC_STYLE, TURB_STYLE,
                     ENG_DEFAULT, ENG_MAT, ENG_UNIT, engResolve, engBuild };
if (typeof window !== 'undefined')
  window.ENG_GEN = { ENG_ARCH, ENG_AIM, engAimDeg, ELEC_STYLE, TURB_STYLE,
                     ENG_DEFAULT, ENG_MAT, ENG_UNIT, engResolve, engBuild };
