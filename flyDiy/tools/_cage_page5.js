// CAGE PAGE 5 — the aeroplane the light editor opens on, and its curated
// panel. Lifted out of the (since deleted) _cage5 bench so every later bench
// and the game's editor are ONE page definition with layers over it: a
// slider added here appears everywhere the page is loaded (_cage8.html, the
// game's MANIFEST.editor).
//
// `CAGE_PAGE_SETUP()` is the page's derived selectors (nose configuration,
// seating starters). It is a function rather than a bare IIFE because it needs
// window.CAGE_UI, which only exists once _cage_ui.js has run — so each page
// calls it in a trailing script.
'use strict';
// the crew models the select offers: the ATD first, then every registered
// character (52_char_codec.js CHAR_REG; empty in a page without them)
// (G204.1) 0 = 'mixed crew': the characters rotate through the seats, no
// two alike while there are enough of them; 1 = the ATD; 2.. = one person
const WHO_NAMES = ['mixed crew (rotate)', 'ATD-01 crash dummy'].concat(
  typeof CHAR_REG !== 'undefined' ? CHAR_REG.order.map(k => CHAR_REG.chars[k].label) : []);
// THE DEFAULT PILOT IS NAMED, NOT NUMBERED (2026-09-07, the user: 'by default,
// there is only the pilot, [...] the car driver in red combi, with the
// helmet'): Ch20's position in the registry, whatever order the table is
// in; mixed crew where no registry is loaded (the node gates)
const WHO_DEFAULT = (() => {
  const i = typeof CHAR_REG !== 'undefined' ? CHAR_REG.order.indexOf('ch20') : -1;
  return i >= 0 ? i + 2 : 0;
})();
// Jodel-ish defaults: near-semicircular top, full roundness, glass canopy.
window.CAGE_PAGE = {
  defaultStep: 'crease',
  // THE DEFAULT AEROPLANE — the user's own build, imported verbatim from
  // their export (newDefaultJodel.json, 2026-08-25; supersedes newDefault
  // 2026-08-24 and jodelSeating 2026-08-19). Now carries the full tail
  // (angular fin with the dorsal back ON, their re-tuned stabilizer using
  // stRootFwd/stBaseY) and the dressed cowl's parameter set. Opening any
  // cage page lands on THIS aeroplane; the scale slider reads x1.000
  // against it; keys for layers a page has not loaded are simply inert —
  // one default aeroplane, each page showing the parts it has loaded.
  defaults: {
    // ---- THE AEROPLANE — cage ----
    planeScale: 0.745, paxLen: 0.91, pilotLen: 0.42, cabPillarW: 0.115,
    paxPillarW: 0.11, pillarW: 0.1, halfW: 0.795, roofY: 0.815, waistY: 0.04,
    aftRoofY: 0.78, aftKeelY: -0.765, tailRoofY: 0.3, wsRun: 0.95,
    wsBaseBow: 0.45, wsCeilBow: 0.3, apilW: 0.92, apilPerp: 1, noseLen: 0.44,
    noseW: 0.97, pfW: 0.3, topRound: 1, topAngRoof: 81, topComp: 1.03,
    bubble: 1, skylight: 0, crSill: 0, crBand: 3, crCap: 3, crNoseCap: 3,
    noseCrown: 0.16, noseH: 1.07, wsBaseLift: 0.05, cowlEase: 0.29,
    cowlBulge: 0.99, noseTip: 0.25, ringCowl2W: -0.02, ringScrBot: -0.015,
    // G214: the door gap is DRAWN by default (the user asked for it twice)
    // rimDoor 0 (2026-09-11, the user: "disable draw gap by default"). G214
    // turned it on because the door was invisible without it; the door has a
    // real recess and a seal now, and a painted-on gap line on every build
    // read as a decal. The row is still there, under Cabin fit > doors.
    rimDoor: 0, intOn: 1, intCons: 2, dashCrease: 3, cutParts: 1,
    // ---- TAIL — stabilizer & elevator (_cage_stab.js) ----
    // stY is measured FROM THE BOOM/ROD UNDERSIDE (G26.5) — 0.408 here
    // reproduces the old absolute 0.33 over the jodel's -0.078 keel
    stOn: 1, stCut: 1, stCutGap: 0.012, stSolid: 1, stThick: 0.05,
    stThickTE: 0.012, stX: 0.05, stY: 0.408, stZ: -0.035, stRootGuard: 1,
    stTipZ: 0.22, stTipY: -0.05, stAftZ: -0.06, stAftY: -0.09, stBaseZ: -0.14,
    stBaseY: 0.335, stMidY: -0.14, stUY: 0.4, stRootFwd: -0.745,
    stLEZ: -0.015, stLEY: -0.2, stShoulderZ: 0.02, stShoulderY: 0.065,
    stTopY: -0.01, stTERoot: 0, stTEU: 0, stTEMid: 0, stSharpTip: 0.65,
    stSharpAft: 2.75, stSharpBase: 3, stSharpShoulder: 0.3, stSharpLE: 1.4,
    // ---- TAIL — fin & rudder (_cage_fin.js) ----
    // fin heights CONVERTED for the G26.5 vertical rebase (+0.204 =
    // the jodel deck's own offset from the sketch root): the fin now
    // TRANSLATES with the deck — same displayed tail as before, and
    // the rod height slider carries it whole
    finOn: 1, finProject: 1, finCut: 1, finCutGap: 0.012, finSolid: 1,
    finThick: 0.06, finThickTE: 0.015, finDorsal: 1, finRootGuard: 1,
    finKeel: 1, finCrA: 0, finCrB: 0, finTipZ: -0.45, finTipY: -0.246,
    finAftZ: 0.1, finAftY: -0.416, finBaseZ: -0.05, finBaseY: 0.15,
    finMidY: -0.096, finUY: 0.104, finRootFwd: 0, finLEZ: -0.25, finLEY: 0,
    finShoulderZ: 0.323, finShoulderY: 0, finTopY: 0, finTERoot: 0, finTEU: 0,
    finTEMid: 0, finSharpTip: 3, finSharpAft: 3, finSharpBase: 2.5,
    finSharpShoulder: 0, finSharpLE: 2.5,
    // ---- COWL + PROPELLER (_cage_cowl.js) ----
    // cw_cowlLen 0.455 (user, G29 playtest): the shell drawn out around
    // the dressed engine — the manual-fit era's first number
    cowlOn: 1, fitNose: 1, cowlGap: 0, propOn: 1, cw_cowlLen: 0.455,
    cw_aftW: 0.5346006505551372, cw_aftH: 0.3406349704887502, cw_taperW: 0.82,
    cw_taperH: 0.78, cw_lidRise: 0.06, cw_faceRise: 0.018, cw_lidLen: 0.125,
    cw_lidShoulder: 0.45, cw_keelSweep: 0.55, cw_deckSweep: 0,
    cw_waistSweep: 0, cw_lidRound: 0.53, cw_lidMode: 1, cw_lidR: 0.17,
    cw_lidGap: 0.009, cw_deckH: 1, cw_waist: 0.05337383734191484,
    cw_keelH: 1, cw_sqAftTop: 0.5329149083978864,
    cw_sqAftBot: 0.5639850552920584, cw_sqFrontTop: 0.54, cw_sqFrontBot: 0.48,
    cw_lidSqTop: 0.62, cw_lidSqBot: 0.6, cw_detail: 1, cw_seamOn: 1,
    cw_seamType: 1, cw_seamPos: 0.745, cw_seamWidth: 0.005,
    cw_seamDepth: 0.0022, cw_apMode: 1, cw_apW: 0.296, cw_apH: 0.108,
    cw_apSq: 0.47, cw_pairX: 0.2, cw_pairW: 0.08, cw_pairH: 0.048,
    cw_apOffX: 0, cw_apOffY: 0, cw_pairY: 0.012, cw_pairSq: 0.625,
    cw_lipMode: 0, cw_lipThick: 0.009, cw_lipDepth: 0.055, cw_ductLen: 0.12,
    cw_lipProtrude: 0.5, cw_lipInset: 0.028, cw_lipRound: 0.55,
    cw_ductFlare: 0, cw_noseOff: -0.04, cw_spinR: 0.101, cw_spinLen: 0.25,
    cw_spinRound: 0.6, cw_bladeStation: 0.42, cw_shaftR: 0.045,
    cw_shaftLen: 0.3, cw_bladeN: 2, cw_propD: 1.91, cw_material: 0,
    cw_rpm: 2400, cw_tas: 205, cw_power: 160, cw_rootChord: 0.165,
    cw_tipChord: 0.05, cw_chordBulge: 0.18, cw_sweep: 0, cw_thickRoot: 0.2,
    cw_thickTip: 0.09, cw_camb: 0.04, cw_tipRound: 0.1, cw_cuff: 0.22,
    cw_shankR: 0.045, cw_slip: 12, cw_lobeN: 2, cw_lobeAmp: 0.022,
    cw_lobeT: 0.45, cw_cutSpan: 0, cw_lobeAz: 0, cw_lobeSig: 34,
    cw_lobeTSig: 0.3, cw_cutAz: 270, cw_scoopOn: 1, cw_scoopLen: 0.22,
    cw_scoopW: 0.065, cw_scoopH: 0.055, cw_scoopSq: 0.5, cw_scoopLipH: 0.011,
    cw_scoopDrop: 0.7, cw_scoopRake: 0.18, cw_scoopAp: 0.68,
    cw_scoopLipDepth: 0.032, cw_scoopDuct: 0.125,
    // ---- UNDERCARRIAGE (_cage_gear.js / _gear_page.js) ----
    mass: 620, cgZ: 1.17, cgY: 0.05, propR: 0.875, propZ: 2.96, s1On: 1,
    s1Z: 2.04, s1X: 0.8, s1Leg: 1, s1R: 0.2, s1Drop: 0.33, s1Brake: 1,
    // s2Z is TAIL-RELATIVE for tailwheel legs (G26.4): fwd of the aft
    // extremity, so the wheel follows the boom length
    s1Steer: 0, s1Fair: 0, s2On: 1, s2Z: 0.06, s2X: 0, s2Leg: 3, s2R: 0.07,
    s2Drop: 0.22, s2Brake: 0, s2Steer: 1, s2Fair: 0, whProfile: 0, whTread: 0,
    whRibs: 3, whRim: 0, whBolts: 6, whCap: 1, whValve: 1, whBrake: 0,
    beamAng: 62, beamW: 0.075, beamT: 0.02, beamTaper: 0.72, beamBow: 1.06,
    beamRake: 0.1, linkAng: 58, linkArmW: 0.042, linkSwing: -42, linkVee: 1,
    linkSpread: 0.46, linkX: 0, linkPanel: 1, linkPanelT: 0.004, shockKind: 1,
    shockAt: 0.72, shockZ: 0.34, shockAng: 30, bungeeSpan: 0.26, oleoAng: 40,
    oleoDia: 0.058, oleoCyl: 0.55, oleoScissor: 0.052, oleoBrace: 1,
    oleoBraceZ: 0.42, twR: 0.1, twSpringLen: 0.52, twSpringDrop: 0.3,
    twSpringW: 0.052, twSpringT: 0.009, twLeaves: 3, twRake: 18,
    twTrail: 0.052, twLegDrop: 0.1, twSteer: 0, twSteerVis: 1, twHornY: 0.46,
    twHornZ: -0.3, s1_beamAng: 62, s1_beamW: 0.075, s1_beamT: 0.02,
    s1_beamTaper: 0.72, s1_beamBow: 1.06, s1_beamRake: 0.1, s1_linkAng: 25,
    s1_linkSwing: 17, s1_linkArmW: 0.042, s1_linkVee: 1, s1_linkSpread: 0.49,
    s1_linkX: 1, s1_linkPanel: 0, s1_shockKind: 1, s1_shockAt: 0.72,
    s1_shockZ: 0.17, s1_shockAng: 30, s1_bungeeSpan: 0.26, s1_oleoAng: 40,
    s1_oleoDia: 0.058, s1_oleoCyl: 0.55, s1_oleoScissor: 0.052,
    s1_oleoBrace: 1, s1_oleoBraceZ: 0.42, s1_twSpringLen: 0.55,
    s1_twSpringDrop: 0.3, s1_twSpringW: 0.052, s1_twSpringT: 0.009,
    s1_twLeaves: 3, s1_twRake: 18, s1_twTrail: 0.052, s1_twLegDrop: 0.1,
    s1_twSteer: 0, s1_twSteerVis: 1, s1_twHornY: 0.46, s1_twHornZ: -0.3,
    s2_beamAng: 62, s2_beamW: 0.075, s2_beamT: 0.02, s2_beamTaper: 0.72,
    s2_beamBow: 1.06, s2_beamRake: 0.1, s2_linkAng: 58, s2_linkSwing: -42,
    s2_linkArmW: 0.042, s2_linkVee: 1, s2_linkSpread: 0.46, s2_linkX: 0,
    s2_linkPanel: 1, s2_shockKind: 1, s2_shockAt: 0.72, s2_shockZ: 0.34,
    s2_shockAng: 30, s2_bungeeSpan: 0.26, s2_oleoAng: 40, s2_oleoDia: 0.058,
    s2_oleoCyl: 0.55, s2_oleoScissor: 0.052, s2_oleoBrace: 1,
    s2_oleoBraceZ: 0.42, s2_twSpringLen: 0.32, s2_twSpringDrop: 0.09,
    s2_twSpringW: 0.072, s2_twSpringT: 0.008, s2_twLeaves: 1, s2_twRake: 0,
    s2_twTrail: 0.048, s2_twLegDrop: 0.175, s2_twSteer: 0, s2_twSteerVis: 1,
    s2_twHornY: 0.17, s2_twHornZ: 0.25, gearOn: 1, gearSit: 1,
    // ---- CREW + COCKPIT (_cage_crew.js) ----
    crewOn: 1, seatLayout: 1, seatTilt: 3, seatBelt: 0,
    seatType: 0, seatZ: 0.205, seatH: 0.08, seatRake: 13,
    seatGap: 0.23, seat2H: -1, seat2Rake: -1, seat2Tilt: -1, ctlStick: 0,
    ctlThr: 0, ctlPed: 1, consoleOn: 0, stickX: 0, stickY: 0, stickZ: 0,
    stickLen: 0.44, stickCrank: 0, thrX: 0, thrY: 0, thrZ: 0, thrLen: 0.16, pedalZ: 0.9,
    pedalH: 0.18, pedalSpread: 0.10, pedalAngle: 25, dumOn: 1,
    dumSize: 1, dumElbows: 0.08, dumKnees: 0, dumRecline: 0, dumMarkers: 1,
    pilotWho: WHO_DEFAULT, copWho: 0, dumFist: 0.5, dumIdle: 0.5,
    paxFeetOn: 1, paxFeetZ: 0.55, paxFeetY: 0, paxFeetX: 0.14, paxIdle: 1,
    dumHandGrip: 0.075,
    // G180 — WHO IS ABOARD, per section, and the passengers' own seat and
    // pose. THE PILOT ALONE by default (2026-09-07, the user: 'by default,
    // there is only the pilot'); it was full — what `dum2On 1` (retired,
    // migrated in cageFromSpec) drew and billed — until then. A saved
    // design keeps whatever it says. `seatPitch` is gone with the tandem
    // layout — a bay's length is its pitch.
    cabOcc: 0, paxOcc1: 0, paxOcc2: 0, paxOcc3: 0, paxOcc4: 0,
    paxSeatZ: 0, paxSize: 1, paxRecline: 0,
  },

  // THE CURATED TREE — cage4's game-panel preview + the crew group.
  // Numbering matches the target layout; 6 wings / 8 tail / 9 wheels
  // live game-side. "don't touch" = frozen values, constants-to-be.
  groupsOverride: [
    ['1 · global', [
      ['longerons', [
        ['waistY',    'waist height',   -0.40, 0.50, 0.005, { dim: 'len' }],
        ['bandH',     'waistband height', 0.01, 0.30, 0.002, { dim: 'len' }],
        ['crSill',    'sill crease',     0, 3, 0.05],
        ['crCeil',    'roof crease',     0, 3, 0.05],
        ['ceilInset', 'ceiling inset ×', 0.20, 3.00, 0.01],
        ['ringPullIn','sill pull-in',    0.00, 0.15, 0.002],
      ], 'open'],
      // THE RING EDITOR (user design): the plane's shape = rings +
      // longerons. Global roundness shapes every section; the per-ring
      // rows move one main ring's top/bottom points bodily. Aft + tail
      // ring heights live in "7 · boom" (aft roof/keel y, cone roof/
      // keel y).
      ['rings', [
        ['topRound',  'top roundness',   0.00, 1.00, 0.01],
        ['botRound',  'bottom roundness',0.00, 1.00, 0.01],
        // the arc angles + CC compensation only act on a rounded section
        // (measured: inert at roundness 0/0 — G28 audit probe)
        ['topAngCeil','ceiling angle',   25, 70, 1,
         { when: P => +P.topRound > 0 || +P.botRound > 0 }],
        ['topAngRoof','roof angle',      55, 88, 1,
         { when: P => +P.topRound > 0 || +P.botRound > 0 }],
        ['ringNoseTop','nose deck lift', -0.35, 0.60, 0.005],
        ['ringNoseBot','nose bottom',    -0.35, 0.35, 0.005],
        ['ringScrBot', 'screen bottom',  -0.35, 0.35, 0.005],
        ['ringWinTop', 'window top',     -0.35, 0.35, 0.005],
        ['ringWinBot', 'window bottom',  -0.35, 0.35, 0.005],
        ['ringCabTop', 'cabin top',      -0.35, 0.35, 0.005],
        ['ringCabBot', 'cabin bottom',   -0.35, 0.35, 0.005],
        ['ringCabW',   'cabin width',    -0.25, 0.25, 0.005],
        ['ringWinW',   'window width',   -0.25, 0.25, 0.005],
        ['ringScrW',   'screen width',   -0.25, 0.25, 0.005],
        ['ringCowl1W', 'cowl 1 width',   -0.25, 0.25, 0.005],
        ['ringCowl2W', 'cowl 2 width',   -0.25, 0.25, 0.005],
      ], 'open'],
      ['conception', [
        // THE INTERIOR MASTER + its element flags. They live in the
        // BASE panel (_cage_ui) but this page REPLACES the tree, so
        // they were unreachable here — and the piper-cub preset sets
        // intOn 0, which then could not be undone (user 2026-08-19).
        ['intOn',     'interior',        0, 1, 1],
        ['intCons',   'construction',    0, 3, 1, ['composite', 'steel tube',
                                                  'plywood', 'aluminium']],
        // ZERO SKIN (G26.4): the fuselage family omitted outright —
        // beyond the alpha slider; glass and all structure stay
        ['skinOn',    'fuselage skin',   0, 1, 1],
        ['glazeOn',   'glazing',         0, 1, 1],
        ['shellT',    'shell thickness', 0.01, 0.10, 0.002, { dim: 'len' }],
        ['skinT',     'skin thickness',  0, 0.06, 0.001, { dim: 'len' }],
        // G214: the skin's screws along the rings and rails (metres)
        ['memFast',   'member screws',   0, 1, 1],
        ['memPitch',  'screw pitch (m)', 0.01, 0.10, 0.001,
         { when: P => +P.memFast }],
        ['memDia',    'screw head (m)',  0.001, 0.008, 0.0001,
         { when: P => +P.memFast }],
        ['memRise',   'screw rise (m)',  0, 0.002, 0.00005,
         { when: P => +P.memFast }],
        ['intPillars','pillar bodies',   0, 1, 1],
        ['intFire',   'firewall',        0, 1, 1],
        // the fireproof sheet's seal band on the engine side (2026-09-03) —
        // a sealant joint, so the range is the one a sealant is applied in;
        // 0 retires it and takes the sheet out to the plate's own outline
        ['fireSealW', 'fire seal',       0, 0.04, 0.002,
         { dim: 'len', when: P => +P.intOn && +P.intFire }],
        ['intDash',   'dashboard',       0, 1, 1],
        // moved from "7 · boom" (user, G28): a conception concern
        ['intBulk',   'aft bulkhead',    0, 1, 1],
        // WITHIN THE PILLAR, as a fraction of it: -1 the forward face,
        // 0 where it has always sat, +1 the aft face.
        ['bulkZ',     'bulkhead station', -1, 1, 0.05,
         { when: P => +P.intOn && +P.intBulk }],
        // was invisible on this curated tree — but the piper preset sets
        // it 0, and doors/explode silently do nothing without it (the
        // intOn trap of 2026-08-19, same shape)
        ['cutParts',  'cut parts',       0, 1, 1],
      ]],
    ], 'open'],
    ['2 · engine', [
      // THE NOSE'S OWN ROWS MOVED TO THE NOSE (2026-09-11). The front finish
      // and the three loft curves shape the CAGE's nose cap — they exist
      // whether or not an engine is bolted to it, and _cage_parts has filed
      // them under the nose PART since 2026-09-03 while the panel kept them
      // here. The derived `configuration` select that used to be injected at
      // the top of this group went with them.
    ]],
    ['3 · nose', [
      ['noseLen',   'length',          0.20, 2.50, 0.01, { dim: 'len' }],
      ['noseW',     'width ×',         0.50, 1.50, 0.01],
      ['noseH',     'height ×',         0.05, 1.20, 0.01],
      ['noseDroop', 'droop',          -0.20, 0.60, 0.005],
      ['noseCrown', 'deck crown',      0.00, 1.00, 0.005],
      ['wsBaseLift','windscreen base lift', 0.00, 0.80, 0.005],
      ['crSillNose','deck crease',     -1, 3, 0.05],
      // THE TIP (user 2026-08-19: "the aero nose remains quite pointy").
      // The rows that decide it, inline (G28: less nesting): how far the
      // last ring collapses, how the taper curves into it, and whether
      // the cap edge is a CREASE — a fully-sharp cap edge on a
      // collapsed ring is the spike.
      ['noseTip',   'tip collapse',   0.00, 0.98, 0.01],
      ['crNoseCap', 'tip sharpness',  0, 3, 0.05],
      ['crFrontCap','front cap crease', 0, 3, 0.05],
      // WHAT THE FRONT OF THE NOSE IS (2026-09-11, the user: "it should be
      // associated to the nose section, and should rather say firewall or
      // aerodynamic nose"). `noseFinish` was written by ONE derived selector
      // buried under `2 - engine` and labelled "engine nose-mounted / aero
      // nose" — a nose question filed under the engine, named after the
      // engine. It is a row here now, in the words the shape is in:
      //   firewall      the twin ring, the pillarFront band and the flat-ish
      //                 cap the game's cowl assembly bolts to
      //   aerodynamic   no aperture band; the loft ends in a small drooped
      //                 ring and a domed cap — the FINAL nose
      // The loft forces `aerodynamic` anyway wherever the engine is not on
      // the nose (cageSpec), so this row says what a nose-mounted build is
      // and gets out of the way of the ones that have no choice.
      ['noseFinish', 'nose front',    0, 1, 1, ['firewall', 'aerodynamic']],
      // THE CAP'S LOFT, moved out of `2 - engine` with it: how many rings the
      // front closes with, how they ease into the last one and how far they
      // bulge on the way. `cowlLoops` runs to 5 now — an aerodynamic nose is
      // SEVERAL rings and two was not several.
      ['cowlLoops', 'front rings',    0, 5, 1],
      ['cowlEase',  'ring ease',      0.00, 1.00, 0.01],
      ['cowlBulge', 'ring bulge',     0.85, 1.30, 0.005],
    ]],
    ['4 · cabin', [
      ['dimensions', [
        // seating starter select injected below
        ['pilotLen',  'length',         0.30, 2.00, 0.01, { dim: 'len' }],
        ['halfW',     'half width',     0.20, 1.00, 0.005, { dim: 'len' }],
        ['roofHalfW', 'roof half-width', 0.15, 0.90, 0.005, { dim: 'len' }],
        ['roofY',     'roof height',    0.40, 1.60, 0.005, { dim: 'len' }],
        ['keelY',     'keel height',   -1.60, -0.30, 0.005, { dim: 'len' }],
        ['floorY',    'floor height',  -1.20, 0.00, 0.005, { dim: 'len' }],
        // THE LEAN (study 2026-09-01, futureDesigns/LEAN-PILLAR-STUDY):
        // the aft bulkhead (passenger pillar; pilot pillar on a 0-bay
        // cabin) and the cabin pillar tilt top-aft as a SHEAR, in
        // degrees — the generator clamps on roof travel, not angle, so
        // a short neighbouring bay quietly limits the effective tilt.
        ['leanPaxDeg', 'aft bulkhead lean', -25, 30, 0.5],
        ['leanCabDeg', 'cabin pillar lean', -25, 30, 0.5],
      ], 'open'],
      ['windows', [
        ['wsRun',     'windscreen run', 0.20, 2.00, 0.01, { dim: 'len' }],
        ['wsTopOff',  'windscreen top offset', 0.00, 0.50, 0.005],
        ['wsBaseBow', 'base bow',       0.00, 1.20, 0.01],
        ['wsCeilBow', 'ceiling bow',    0.00, 0.60, 0.005],
        ['bubble',    'bubble glass',   0, 1, 1],
        ['skylight',  'skylight',       0, 1, 1],
        ['skyExt',    'sky extent',     0, 5, 1,
         { when: P => +P.skylight }],
        ['winSillPilot', 'window sill', 0, 0.9, 0.01],
        ['canopy',    'canopy',         0, 3, 1, ['closed', 'convertible',
                                                  'open', 'bubble']],
        // THE LABEL IS THE SHAPE, NOT THE MECHANISM (NEW-AIRCRAFT §5.3):
        // a builder chooses what the top of the fuselage does behind the
        // cockpit — cabin roof running aft, or a turtledeck falling away.
        // THE KEY STAYS `mirror`: it names the machinery (the aft body gets
        // the nose's own control set), CAGE_AFT_SUB and the forever-split
        // read it, and it rides spec.cage into every saved build — renaming
        // the key is a migration, renaming the label is a string. Do not
        // "fix" the mismatch.
        ['mirror',    'body & deck',    0, 1, 1, ['cabin roof',
                                                  'turtledeck']],
        // measured (G28 audit): only acts on a bubble canopy over a
        // mirrored pod — the sailplane arceau
        ['arcFit',    'arceau fit',     0, 1, 1,
         { when: P => +P.canopy === 3 && +P.mirror }],
        ['bubH',      'bubble height',  0.2, 1.4, 0.01,
         { when: P => +P.canopy === 3 }],
        ['bubAt',     'bubble apex',    0.15, 0.85, 0.01,
         { when: P => +P.canopy === 3 }],
        ['bubW',      'bubble width',   0.8, 1.5, 0.01,
         { when: P => +P.canopy === 3 }],
        ['canLoops',  'canopy loops',   1, 3, 1,
         { when: P => +P.canopy === 3 }],
        ['bubH2',     'loop2 height',   0, 1.4, 0.01,
         { when: P => +P.canopy === 3 && +P.canLoops >= 2 }],
        ['bubAt2',    'loop2 apex',     0.15, 0.85, 0.01,
         { when: P => +P.canopy === 3 && +P.canLoops >= 2 }],
        ['bubW2',     'loop2 width',    0.8, 1.5, 0.01,
         { when: P => +P.canopy === 3 && +P.canLoops >= 2 }],
        ['bubH3',     'loop3 height',   0, 1.4, 0.01,
         { when: P => +P.canopy === 3 && +P.canLoops >= 3 }],
        ['bubAt3',    'loop3 apex',     0.15, 0.85, 0.01,
         { when: P => +P.canopy === 3 && +P.canLoops >= 3 }],
        ['bubW3',     'loop3 width',    0.8, 1.5, 0.01,
         { when: P => +P.canopy === 3 && +P.canLoops >= 3 }],
        ['rimW',      'joint size',     0.00, 0.04, 0.001, { dim: 'len' }],
        // G206: the strip's rise (x rimW) and the pane's step down behind it
        ['rimRise',   'rim rise',       0.05, 1, 0.01],
        ['paneInset', 'pane inset',     -0.01, 0.01, 0.0005, { dim: 'len' }],
        ['paneThick', 'pane edge',      0, 0.01, 0.0005, { dim: 'len' }],
        ['rimRivet',  'frame rivets',    0, 0.10, 0.005, { dim: 'len' }],
        // THE REVEAL. `winFrameW` gates the whole frame/recess pass, so it and
        // `winDepth` were unreachable and `doorDepth` did nothing while it sat
        // at 0. At 0 the windows are flush, as they were before this row.
        ['winFrameW', 'window frame',   0.00, 0.05, 0.002, { dim: 'len' }],
        ['winDepth',  'window recess',  0.00, 0.06, 0.002,
         { when: P => +P.winFrameW > 0, dim: 'len' }],
      ], 'open'],
      ['doors', [
        ['doorOn',    'pilot door',     0, 1, 1],
        ['doorSill',  'door sill',      0, 0.25, 0.002,
         { when: P => +P.doorOn, dim: 'len' }],
        // THE GAP, filed under the DOOR. `rimW` (the seal's gauge, in the
        // glazing group above) was the only control over how visible a door
        // is, which is why the user could not find it from the door.
        ['doorRim',   'door gap',       0.004, 0.06, 0.001,
         { when: P => +P.doorOn, dim: 'len' }],
        ['rimDoor',   'draw the gap',   0, 1, 1,
         { when: P => +P.doorOn }],
        // G207: the recess is the cut door's step back now (and still the
        // reveal's depth when that pass is on)
        ['doorDepth', 'door recess',    0, 0.06, 0.001,
         { when: P => +P.doorOn && (+P.cutParts || +P.winFrameW > 0),
           dim: 'len' }],
        ['doorDeep',  'deep jamb',      0, 1, 1, { when: P => +P.doorOn }],
        // define the door, then take it away: the open doorway stays,
        // jambs and structure built as if it were hung (needs cut
        // parts on)
        ['doorGone',  'door removed',   0, 1, 1,
         { when: P => +P.doorOn && +P.cutParts }],
      ]],
      ['cockpit', [
        ['dashBack',  'dash setback',   0.01, 0.30, 0.005,
         { when: P => +P.intOn && +P.intDash, dim: 'len' }],
        ['dashLip',   'dash lip',       0.01, 0.10, 0.002,
         { when: P => +P.intOn && +P.intDash }],
        ['dashDepth', 'dash depth',     0.05, 0.80, 0.01,
         { when: P => +P.intOn && +P.intDash, dim: 'len' }],
        ['dashCrown', 'dash crown',     0, 0.30, 0.005,
         { when: P => +P.intOn && +P.intDash }],
      ]],
    ], 'open'],
    // aft half of the mirrored pod — the FULL front control set,
    // duplicated (user ruling). FOREVER-SPLIT: the aft params take a
    // one-shot copy of the front when the pod comes on; the "= front"
    // button each row now carries is that same gesture made visible
    // (the rows only exist with the pod on — rec §2's `when`)
    ['3b · aft deck', [
      ['aftNoseLen',  'length',        -1, 2.5, 0.01],
      ['aftNoseW',    'width ×',       -1, 1.5, 0.01],
      ['aftNoseH',    'height ×',       -1, 1.2, 0.01],
      ['aftDroop',    'droop',         -1, 0.6, 0.005],
      ['aftNoseCrown','deck crown',    -1, 1.0, 0.005],
      ['aftWsBaseLift','w/s base lift',-1, 0.8, 0.005],
      ['aftRingNoseTop','deck end lift',-1, 0.6, 0.005],
      ['aftRingNoseBot','deck end bottom',-1, 0.35, 0.005],
      ['aftNoseTip', 'tip point',      -1, 0.98, 0.01],
      ['aftCrSillNose','deck crease',  -1, 3, 0.05],
      ['aftRingCowl1W','cowl 1 width', -1, 0.25, 0.005],
      ['aftRingCowl2W','cowl 2 width', -1, 0.25, 0.005],
      ['aftCowlLoops','cowl loops',    -1, 2, 1],
      ['aftCowlEase', 'cowl ease',     -1, 1.0, 0.01],
      ['aftCowlBulge','cowl bulge',    -1, 1.3, 0.005],
    ], { when: P => +P.mirror }],
    ['4b · aft cabin', [
      ['aftPilotLen', 'cockpit len',   -1, 2.0, 0.01],
      ['aftWsRun',    'screen run',    -1, 2.0, 0.01],
      ['aftWsTopOff', 'screen top off',-1, 0.5, 0.005],
      ['aftWsBaseBow','base bow',      -1, 1.2, 0.01],
      ['aftWsCeilBow','ceil bow',      -1, 0.6, 0.005],
      ['aftRingWinW','window width',   -1, 0.25, 0.005],
      ['aftRingScrW','screen width',   -1, 0.25, 0.005],
    ], { when: P => +P.mirror }],
    // THE CREW LAYER (cage5): seats, controls, dummy — a disjoint THREE
    // layer over the cage (never in the mesh, the gates or the OBJ).
    ['4c · crew & controls', [
      ['seats', [
        ['crewOn',    'crew layer',     0, 1, 1],
        ['seatType',  'seat type',      0, 2, 1, ['tube frame',
                                                  'composite shell',
                                                  'airliner']],
        // G180: the ROW — one abreast or two — in the cockpit AND in every
        // passenger bay. Tandem is retired: it is 'single' with a bay
        // (cageFromSpec reads an older file's 2 as 0).
        ['seatLayout','row',            0, 1, 1, ['single', 'side-by-side']],
        ['seatZ',     'fore / aft', -0.50, 0.50, 0.005],
        ['seatH',     'up / down (squab height)', 0.06, 0.50, 0.005],
        ['seatRake',  'back recline',   5, 45, 0.5],
        ['seatTilt',  'squab recline',  0, 30, 0.5],
        ['seatGap',   'sbs seat gap',   0.18, 0.45, 0.005,
         { when: P => +P.seatLayout === 1 }],
        ['seatBelt',  'lap belts',      0, 1, 1],
      ], 'open'],
      // the second seat's own set — the sentinel (-1 = follows the front
      // seat, resolved live by the crew layer) is now a visible LINK
      // checkbox; unticking writes the front seat's value into the slider
      // G180: these are the PASSENGER seats' rows — every seat in a passenger
      // bay, one set for all of them (the cockpit's two seats are the set
      // above). `paxSeatZ` places the row inside its bay off the bay's own
      // aft ring, the way `seatZ` places the pilot's off the cockpit's.
      ['passenger seats', [
        ['paxSeatZ',  'fore / aft in bay', -0.50, 0.50, 0.005,
         { when: P => +P.crewOn && +P.paxCount > 0 }],
        ['seat2H',    'squab height',  -1, 0.50, 0.005,
         { link: { sentinel: -1, from: 'seatH', test: v => v < 0 } }],
        ['seat2Rake', 'back recline',  -1, 45, 0.5,
         { link: { sentinel: -1, from: 'seatRake', test: v => v < 0 } }],
        ['seat2Tilt', 'squab recline', -1, 30, 0.5,
         { link: { sentinel: -1, from: 'seatTilt', test: v => v < 0 } }],
      ], { when: P => +P.crewOn && +P.paxCount > 0 }],
      // ONE controls folder (G28: the three position subfolders merged —
      // each control's position rows sit right under its selector,
      // existing only while that control is fitted). 3-axis shifts off
      // the auto-laced place: +x pilot's left, +y up, +z toward the
      // nose. 0 = as laced.
      ['controls', [
        ['ctlStick',  'pitch/roll',     0, 3, 1, ['stick between legs',
                                                  'yoke', 'side stick R',
                                                  'none']],
        ['stickX',    'stick left',    -0.45, 0.45, 0.005,
         { when: P => +P.crewOn && +P.ctlStick !== 3 }],
        ['stickY',    'stick up',      -0.30, 0.45, 0.005,
         { when: P => +P.crewOn && +P.ctlStick !== 3 }],
        ['stickZ',    'stick fwd',     -0.35, 0.50, 0.005,
         { when: P => +P.crewOn && +P.ctlStick !== 3 }],
        ['stickLen',  'stick length',   0.18, 0.75, 0.005,
         { when: P => +P.crewOn && +P.ctlStick !== 3 }],
        // a double bend: the grip this much nearer the seat than the base
        ['stickCrank', 'stick crank',   0, 0.20, 0.005,
         { when: P => +P.crewOn && +P.ctlStick === 0 }],
        ['ctlThr',    'throttle',       0, 3, 1, ['left wall lever',
                                                  'dash push-pull',
                                                  'console quadrant',
                                                  'none']],
        ['thrX',      'throttle left', -0.60, 0.60, 0.005,
         { when: P => +P.crewOn && +P.ctlThr !== 3 }],
        ['thrY',      'throttle up',   -0.35, 0.45, 0.005,
         { when: P => +P.crewOn && +P.ctlThr !== 3 }],
        ['thrZ',      'throttle fwd',  -0.45, 0.60, 0.005,
         { when: P => +P.crewOn && +P.ctlThr !== 3 }],
        ['thrLen',    'lever length',   0.06, 0.40, 0.005,
         { when: P => +P.crewOn && +P.ctlThr !== 3 }],
        ['ctlPed',    'pedals',         0, 1, 1],
        ['pedalZ',    'pedal distance', 0.60, 1.40, 0.005,
         { when: P => +P.crewOn && +P.ctlPed }],
        ['pedalH',    'pedal height',   0.02, 0.40, 0.005,
         { when: P => +P.crewOn && +P.ctlPed }],
        ['pedalSpread','pedal spread',  0.05, 0.32, 0.005,
         { when: P => +P.crewOn && +P.ctlPed }],
        ['pedalAngle','pedal angle',    0, 60, 1,
         { when: P => +P.crewOn && +P.ctlPed }],
        ['consoleOn', 'centre console', 0, 1, 1],
      ], 'open'],
      // G180: WHO IS ABOARD is per SECTION. The cockpit's second seat is
      // here with the pilot dummy; each passenger bay's row is the bay's own
      // (`5 · passengers` below). A filled seat is a body drawn AND 80 kg
      // billed where the seat is; `dum2On` (every seat filled or none) is
      // retired and migrated in cageFromSpec.
      ['aboard', [
        ['dumOn',     'pilot dummy',    0, 1, 1],
        // WHO FLIES (G204/G204.1): the pilot and the co-pilot each pick from
        // the same list — mixed crew (the characters rotate through every
        // seat aboard, the passengers included), the ATD-01, or one declared
        // character (src/chars/, tools/chars_table.py order — the manifests
        // load ahead of this page, so the list is read here, once)
        ['pilotWho',  'pilot',          0, WHO_NAMES.length - 1, 1, WHO_NAMES],
        ['cabOcc',    'co-pilot seated', 0, 1, 1,
         { when: P => +P.crewOn && +P.seatLayout === 1 }],
        ['copWho',    'co-pilot',       0, WHO_NAMES.length - 1, 1, WHO_NAMES,
         { when: P => +P.crewOn && +P.seatLayout === 1 && +P.cabOcc }],
      ], 'open', { when: P => +P.crewOn }],
      ['pilot pose', [
        ['dumSize',   'stature',        0, 2, 1, ['5th %ile — 1.52 m',
                                                  '50th %ile — 1.75 m',
                                                  '95th %ile — 1.88 m']],
        ['dumElbows', 'elbows in/out', -0.25, 0.25, 0.005],
        ['dumKnees',  'knees in/out',  -0.25, 0.25, 0.005],
        ['dumRecline','recline offset',-15, 25, 0.5],
        ['dumHandGrip','hand on grip',  0, 0.16, 0.005],
        // G205: how far the fingers close (0 flat, 1 a fist; a character
        // only), and the pilot's breathing/glancing amplitude off the
        // sitting-idle clip (0 = a statue)
        ['dumFist',   'fist closed',    0, 1, 0.05],
        ['dumIdle',   'idle motion',    0, 1, 0.05],
        ['dumMarkers','eye point',      0, 1, 1],
      ], 'open', { when: P => +P.crewOn }],
      // one pose for every passenger (the user: "all the passenger and dummy
      // positions will be the same for all dummies"); a passenger holds no
      // control, so the reach rows above do not apply
      ['passenger pose', [
        ['paxSize',   'stature',        0, 2, 1, ['5th %ile — 1.52 m',
                                                  '50th %ile — 1.75 m',
                                                  '95th %ile — 1.88 m']],
        ['paxRecline','recline offset',-15, 25, 0.5],
        // G205: the feet, placed without pedals — fore-aft from the seat
        // back, height over the bay floor, half-spread (metres); and the
        // upper-body idle clip's weight
        ['paxFeetOn', 'feet placed',    0, 1, 1],
        ['paxFeetZ',  'feet forward',   0.15, 0.95, 0.01,
         { when: P => +P.crewOn && +P.paxCount > 0 && +P.paxFeetOn }],
        ['paxFeetY',  'feet height',    0, 0.45, 0.01,
         { when: P => +P.crewOn && +P.paxCount > 0 && +P.paxFeetOn }],
        ['paxFeetX',  'feet apart',     0, 0.35, 0.005,
         { when: P => +P.crewOn && +P.paxCount > 0 && +P.paxFeetOn }],
        ['paxIdle',   'idle motion',    0, 1, 0.05],
      ], 'open', { when: P => +P.crewOn && +P.paxCount > 0 }],
    ], 'open'],
    ['5 · passengers', [
      ['paxCount',  'pax bays',        0, 4, 1],
      ['paxLen',    'bay length',      0.4, 3.0, 0.01,
       { when: P => +P.paxCount > 0, dim: 'len' }],
      ['winSillPax','win sill',        0, 0.9, 0.01,
       { when: P => +P.paxCount > 0 && !+P.paxWinN }],
      // DRAWN WINDOWS (G245): 0 = the glazed band; else this many windows
      // drawn in the side view and knife-cut into the skin (_knife_gen.js).
      // Stations are ABSOLUTE (user ruling) — a window stays where it was
      // drawn when the cabin moves.
      ['paxWinN',   'drawn windows',   0, 4, 1,
       { when: P => +P.paxCount > 0 }],
      ['paxWinShape', 'shape',         0, 1, 1, ['rounded', 'oval'],
       { when: P => +P.paxCount > 0 && +P.paxWinN > 0 }],
      ['paxWinZ',   'first station',  -1.0, 2.5, 0.01,
       { when: P => +P.paxCount > 0 && +P.paxWinN > 0, dim: 'len' }],
      ['paxWinPitch', 'pitch',         0.2, 1.5, 0.01,
       { when: P => +P.paxCount > 0 && +P.paxWinN > 1, dim: 'len' }],
      ['paxWinY',   'centre height',  -0.3, 1.0, 0.01,
       { when: P => +P.paxCount > 0 && +P.paxWinN > 0, dim: 'len' }],
      ['paxWinW',   'width',           0.05, 1.2, 0.01,
       { when: P => +P.paxCount > 0 && +P.paxWinN > 0, dim: 'len' }],
      ['paxWinH',   'height',          0.05, 0.9, 0.01,
       { when: P => +P.paxCount > 0 && +P.paxWinN > 0, dim: 'len' }],
      ['paxWinR',   'corner radius',   0, 0.45, 0.005,
       { when: P => +P.paxCount > 0 && +P.paxWinN > 0 && !+P.paxWinShape,
         dim: 'len' }],
      ['paxWinDepth', 'reveal depth',  0, 0.03, 0.001,
       { when: P => +P.paxCount > 0 && +P.paxWinN > 0, dim: 'len' }],
      ['doorPax',   'pax doors',       0, 1, 1,
       { when: P => +P.paxCount > 0 }],
      ['doorSillPax','door sill',      0, 0.25, 0.002,
       { when: P => +P.paxCount > 0 && +P.doorPax, dim: 'len' }],
      // G180: WHO SITS IN EACH BAY, bays counted front to back from the
      // cockpit. A bay seats the cockpit's row (one abreast or two), so
      // 'two' on a single-row aeroplane seats the one seat there is — the
      // crew layer clamps, and the join bills the seats actually filled.
      ['paxOcc1',   'bay 1 seated',    0, 2, 1, ['nobody', 'one', 'two'],
       { when: P => +P.crewOn && +P.paxCount >= 1 }],
      ['paxOcc2',   'bay 2 seated',    0, 2, 1, ['nobody', 'one', 'two'],
       { when: P => +P.crewOn && +P.paxCount >= 2 }],
      ['paxOcc3',   'bay 3 seated',    0, 2, 1, ['nobody', 'one', 'two'],
       { when: P => +P.crewOn && +P.paxCount >= 3 }],
      ['paxOcc4',   'bay 4 seated',    0, 2, 1, ['nobody', 'one', 'two'],
       { when: P => +P.crewOn && +P.paxCount >= 4 }],
    ]],
    ['7 · boom', [
      // G26 — the dedicated tightening section + the rod boom. The
      // taper is an EXPLICIT section (taperOn), gated aft by its own
      // pillar; with it on, aft roof/keel y shape its aft ring (the
      // boom root) and the pax pillar reverts to the full cabin
      // section. Rod: the tube IS the boom and the tail — bare, fin
      // and stab clamp straight onto it; no skin over the tightening.
      // TWIN BOOMS (2026-09-04, TWIN-BOOM spec §1.3): the pod ends at the
      // bulkhead as on a rod, two tapering tubes leave the wing's trailing
      // edge at ±boomX and carry a fin each, the stab between them
      // TWO AXES (2026-09-04, the user: "lofted or rod, and dual or single
      // boom"): the construction and the count. Twin booms of either
      // construction leave the wing's trailing edge; the pod ends at the
      // bulkhead either way (the rod's table).
      ['boomStyle', 'boom style',      0, 1, 1, ['lofted skin',
                                                 'rod (tube)']],
      ['boomTwin',  'twin booms',      0, 1, 1],
      ['boomX',     'boom half-track', 0.6, 3.0, 0.01,
       { when: P => +P.boomTwin, dim: 'len' }],
      // G271 (the user: "nothing allowing me to control the position of the
      // booms relative to the wing. Can't go up, down"): the root's height
      // against the wing's trailing edge, metres, up positive
      ['boomDy',    'up / down (from the trailing edge)', -0.6, 0.6, 0.005,
       { when: P => +P.boomTwin, dim: 'len' }],
      // G267: THE LOFT (the user: "their vertical and horizontal thickness
      // at fore and aft ends", "their profile (square, round)", each end
      // "profiled ... from ogival to conical" with "the type of cap")
      ['boomWf',    'width, wing end',   0.05, 0.60, 0.005,
       { when: P => +P.boomTwin, dim: 'len' }],
      ['boomHf',    'height, wing end',  0.05, 0.80, 0.005,
       { when: P => +P.boomTwin, dim: 'len' }],
      ['boomWa',    'width, tail end',   0.04, 0.60, 0.005,
       { when: P => +P.boomTwin, dim: 'len' }],
      ['boomHa',    'height, tail end',  0.04, 0.80, 0.005,
       { when: P => +P.boomTwin, dim: 'len' }],
      ['boomSquare', 'section (round → square)', 0, 1, 0.01,
       { when: P => +P.boomTwin }],
      ['boomIncl',  'inclination (tail up)', -12, 12, 0.1,
       { when: P => +P.boomTwin }],
      ['boomCollar', 'collar at the wing', 0, 1, 0.01,
       { when: P => +P.boomTwin }],
      ['boomNoseLen', 'wing-end fairing length', 0, 1.5, 0.01,
       { when: P => +P.boomTwin, dim: 'len' }],
      ['boomNoseK', 'wing-end profile (cone → ogive)', 0, 1, 0.01,
       { when: P => +P.boomTwin }],
      ['boomNoseCap', 'wing-end cap', 0, 2, 1, ['point', 'flat', 'round'],
       { when: P => +P.boomTwin }],
      ['boomTailLen', 'tail-end fairing length', 0, 1.5, 0.01,
       { when: P => +P.boomTwin, dim: 'len' }],
      ['boomTailK', 'tail-end profile (cone → ogive)', 0, 1, 0.01,
       { when: P => +P.boomTwin }],
      ['boomTailCap', 'tail-end cap', 0, 2, 1, ['point', 'flat', 'round'],
       { when: P => +P.boomTwin }],
      ['taperOn',   'taper section',   0, 1, 1],
      // the `when` rules below are MEASURED, not assumed (P1 probe,
      // 2026-08-26): each hidden row was varied through the full display
      // pipeline in the mode that hides it and the mesh hash did not
      // move. Cone shape + pod ring are loft-only; aft roof/keel go
      // inert only when the rod's tightening TRUSS replaces the taper
      // bay; panels exist only on that truss.
      ['taperLen',  'taper length',    0.08, 1.6, 0.01,
       { when: P => +P.taperOn, dim: 'len' }],
      ['taperW',    'taper width ×',   0.15, 1.0, 0.005,
       { when: P => +P.taperOn && !+P.boomStyle }],
      ['taperPanels','taper panels',   0, 1, 1,
       { when: P => +P.taperOn && +P.boomStyle === 1 }],
      // THE AERO AFT (2026-09-04, TWIN-BOOM spec §1.2, cut 1): the pod's tail
      // when nothing sits on the bulkhead — off by a pusher (its cowl does
      // the job). Length, droop, and the tip from a rounded dome to a teardrop.
      // (2026-09-04: wherever the pod ENDS at the bulkhead — a rod boom or twin
      // booms of either construction — and no pusher sits on it)
      ['aeroAftOn', 'aero aft',        0, 1, 1,
       { when: P => (+P.boomStyle === 1 || +P.boomTwin) && Math.round(P.engMount || 0) !== 1 }],
      ['aeroAftLen', 'aero aft length', 0.3, 2.0, 0.01,
       { when: P => (+P.boomStyle === 1 || +P.boomTwin) && +P.aeroAftOn, dim: 'len' }],
      ['aeroAftDroop', 'aero aft droop', -0.3, 0.3, 0.005,
       { when: P => (+P.boomStyle === 1 || +P.boomTwin) && +P.aeroAftOn, dim: 'len' }],
      ['aeroAftTip', 'aero aft tip (dome → teardrop)', 0, 1, 0.01,
       { when: P => (+P.boomStyle === 1 || +P.boomTwin) && +P.aeroAftOn }],
      ['rodY',      'rod height',     -0.9, 0.9, 0.005,
       { when: P => +P.boomStyle === 1 && !+P.boomTwin, dim: 'len' }],
      ['rodD',      'rod diameter',    0.04, 0.32, 0.002,
       { when: P => +P.boomStyle === 1 && !+P.boomTwin, dim: 'len' }],
      // G267.1: the rod's inclination against the body, tail up positive,
      // about the bulkhead flange (the user: "set inclination for the twin
      // boom and boom rod options, compared to the body")
      ['rodIncl',   'rod inclination (tail up)', -12, 12, 0.1,
       { when: P => +P.boomStyle === 1 && !+P.boomTwin }],
      ['boomLen',   'length',          1.0, 6.0, 0.01, { dim: 'len' }],
      ['aftRoofY',  'aft roof height', 0.20, 1.20, 0.005,
       { when: P => !(+P.boomStyle && +P.taperOn), dim: 'len' }],
      ['aftKeelY',  'aft keel height',-1.20, -0.10, 0.005,
       { when: P => !(+P.boomStyle && +P.taperOn), dim: 'len' }],
      ['tailLen',   'cone length',     0.05, 0.6, 0.005, { dim: 'len' }],
      ['tailHalfW', 'cone half-width', 0.02, 0.40, 0.002,
       { when: P => !+P.boomStyle, dim: 'len' }],
      ['tailRoofY', 'cone roof height', 0.10, 1.00, 0.005,
       { when: P => !+P.boomStyle, dim: 'len' }],
      ['tailKeelY', 'cone keel height', -0.50, 0.30, 0.005,
       { when: P => !+P.boomStyle, dim: 'len' }],
      ['boomMidOn', 'pod ring',        0, 1, 1,
       { when: P => !+P.boomStyle }],
      ['boomMidT',  'pod ring station', 0.1, 0.9, 0.01,
       { when: P => !+P.boomStyle && +P.boomMidOn }],
      ['boomMidPinch','pod pinch',     0.2, 1.4, 0.01,
       { when: P => !+P.boomStyle && +P.boomMidOn }],
    ]],
    // POLYCOUNT (user, G28): every density dial in one place — grouped,
    // not merged. The subsurf selector joins this folder at runtime
    // (moved out of the header by _cage_ui); the cowl's own detail dial
    // renders here instead of inside the cowl folder (its lock/hide
    // machinery still owns it).
    ['polycount', [
      ['rimSides',  'seal sides',       4, 10, 1],
      ['rimArc',    'seal corner arcs', 1, 6, 1],
      ['cw_detail', 'cowl detail',      0.35, 2, 0.05,
       { when: P => +P.cowlOn }],
    ]],
    // rec §2's `level`: the frozen constants exist and are inspectable,
    // but sit behind the global "expert rows" switch instead of a name
    // that begs to be ignored. SCALE moved here (user, G28): it was the
    // recalibration tool, not a native design parameter — metres = cage
    // units × CAGE_UNIT × planeScale, slider shown relative to the
    // loaded design (see _cage_ui's sizeRef).
    ["don't touch", [
      ['planeScale','size ×',          0.50, 1.60, 0.005],
      ['pillarW',   'pillar width',    0.00, 0.30, 0.005],
      ['cabPillarW','cabin pillar',    0.02, 0.30, 0.005],
      ['paxPillarW','pax pillar',      0.02, 0.30, 0.005],
      ['apilW',     'A-pillar w ×',    0.20, 3.00, 0.01],
      ['apilPerp',  'A-pillar perp',   0, 1, 0.05],
      ['pfW',       'front pillar ×',  0.30, 3.00, 0.01],
      ['topComp',   'CC compensation', 1.00, 1.15, 0.005,
       { when: P => +P.topRound > 0 || +P.botRound > 0 }],
      ['crPillar',  'pillar crease',   0, 3, 0.05],
      ['crBand',    'band crease',     0, 3, 0.05],
      ['crCap',     'cap crease',      0, 3, 0.05],
      ['crFrame',   'frame crease',    0, 3, 0.05],
      ['dashCrease','dash crease',     0, 3, 0.05],
    ], { level: 'expert' }],
  ],

  // THE PRESETS. 'jodel' is the page default itself, so its override
  // set is empty; the other two carry the user's own builds verbatim.
  presets: {
    'jodel': {},
    // THE PIPER CUB — the user's own finished aeroplane, imported verbatim
    // from their export (My_finished_Cub.json, 2026-09-02; supersedes
    // piper.json 2026-08-19, which was a bare cage). The CAGE is here; the
    // rest of the aeroplane — wing, tail, gear, powerplant, paint and
    // finish — is in `builds` below, because a stock design is a whole
    // build now and not a shape.
    //
    // _base: 'template' — READ THIS BEFORE COPYING THE PATTERN. A saved
    // build's `spec.cage` is DEVIATIONS FROM THE TEMPLATE (CAGE_PARAMS),
    // not from this page's defaults, so applying one over `defaults` leaks
    // every jodel key the export happens not to mention: measured, 32 of
    // them landed on this aeroplane and 267 more on its layers. The old row
    // dealt with that by restating each one by hand, which is what the
    // sailplane row below still does and what goes stale the next time
    // `defaults` moves. This flag says where the row starts from instead,
    // and both consumers honour it — applyPreset here, and the shelf's
    // stock bake in garage.js.
    'piper cub': {
      _base: 'template', planeScale: 0.68, noseTip: 0.25,
      ringCowl2W: -0.02, ringScrBot: -0.015, intOn: 1, intCons: 1,
      dashBack: 0.115, dashDepth: 0.39, stY: 0.475, stZ: 0, stTipZ: -0.24,
      stTipY: -0.025, stAftZ: -0.2, stAftY: -0.27, stBaseZ: -0.24,
      stBaseY: 0.395, stMidY: -0.565, stUY: -0.385, stRootFwd: 0.04,
      stLEZ: -0.305, stLEY: 0.22, stShoulderZ: 0.5, stShoulderY: 0.045,
      stTopY: 0.16, stTERoot: 0.4, stTEU: 0.2, stTEMid: -0.345,
      stSharpTip: 0, stSharpAft: 0, stSharpBase: 0, stSharpShoulder: 0,
      stSharpLE: 0, finCut: 2, finDorsal: 0, finTipZ: -0.415,
      finTipY: -0.715, finAftZ: -0.03, finAftY: -0.8, finBaseZ: -0.33,
      finBaseY: 0.14, finMidY: -0.515, finUY: -0.26, finLEZ: -0.49,
      finShoulderZ: 0.17, finTopY: 0.09, finTERoot: -0.245, finTEU: -0.31,
      finTEMid: -0.18, finSharpTip: 0, finSharpAft: 0, finSharpBase: 0,
      finSharpLE: 0.15, seatLayout: 0, seatTilt: 13, seatZ: 0.215,
      seatH: 0.22, seatRake: 25.5, seatGap: 0.27,
      seat2H: -0.145, seat2Rake: 34.5, seat2Tilt: 2, pedalZ: 0.945,
      pedalH: 0.09, pedalAngle: 47, dumElbows: 0.01,
      cw_aftW: 0.358535049145553, cw_aftH: 0.3356979479364783,
      cw_waist: 0.34022534837088103, cw_sqAftTop: 0.5484943331479463,
      cw_sqAftBot: 0.5542005982733779, waistY: 0.095, noseLen: 0.48,
      skylight: 0, noseCrown: 0.28, crSillNose: 0.9, doorSill: 0,
      doorRim: 0.023, finRootFwd: 0.04, finLEY: -0.01, finShoulderY: 0.035,
      s1Z: 1.6, s1X: 0.89, s1R: 0.22, s1Drop: 0.46, s2Z: 0.12, s2R: 0.08,
      s2Drop: 0.27, whTread: 1, s1_linkAng: 26, s1_linkSwing: 33,
      s1_linkSpread: 0.55, s1_linkPanel: 1, s1_shockAt: 0.95,
      s1_shockZ: 0.29, s1_shockAng: 24, s2_twSpringLen: 0.4,
      s2_twSpringDrop: 0.05, s2_twTrail: 0.08, s2_twLegDrop: 0.105,
      wgSpan: 10.7, wgChord: 1.7, wgChordTip: 1.75, wgDihedral: 1,
      wgIncidence: 2.4, wgWashout: 0, wgCamber: 5, wgCentre: 2, wgDy: -0.1,
      wgFlapType: 3, wgFlapSpan: 0.38, wgFlapChord: 0.29, wgAilSpan: 0.55,
      wgAilChord: 0.29, engY: 0.085, eng_exStyle: 2, eng_exDrop: 1.74,
      eng_mountGap: 0.98, eng_mountR: 1.56, eng_fwSpread: 2.07,
      cw_cowlLen: 0.54, cw_taperW: 1.09, cw_taperH: 0.77, cw_lidRise: 0.038,
      cw_faceRise: 0.014, cw_lidShoulder: 0.42, cw_keelSweep: 0,
      cw_lidRound: 0.58, cw_lidR: 0.191, cw_seamDepth: 0.0026, cw_apMode: 2,
      cw_apW: 0.344, cw_apH: 0.17, cw_apSq: 0.73, cw_pairX: 0.295,
      cw_pairW: 0.124, cw_pairH: 0.082, cw_apOffY: 0.028, cw_pairY: 0.104,
      cw_pairSq: 0.86, cw_lipThick: 0.007, cw_lipDepth: 0.078,
      cw_ductLen: 0.22, cw_lipProtrude: 0.46, cw_lipInset: 0.046,
      cw_lipRound: 0.6, cw_noseOff: 0.06, cw_lobeSig: 53, cw_scoopLen: 0.34,
      cw_scoopH: 0.088,
    },
    // THE SAILPLANE — the user's own build, verbatim from their export
    // (sailPlane.json, 2026-08-19): mirrored pod, bubble canopy, aero
    // nose both ends, razorback aft deck, TANDEM seating with the
    // reclined seats and console quadrant they tuned. Every key their
    // export omits but this page's defaults change is restored to its
    // CAGE_PARAMS value, so the preset reproduces the export exactly
    // instead of inheriting a jodel default (intCons, explodeD).
    'sailplane': {
      aftCowlBulge: 0.985, aftCowlEase: 0.03, aftCowlLoops: 2,
      aftDroop: -0.005, aftKeelY: -0.765, aftNoseCrown: 0.585,
      aftNoseH: 1.2, aftNoseLen: 0.75, aftNoseTip: 0.21, aftNoseW: 0.98,
      aftPilotLen: 0.42, aftRingCowl1W: 0, aftRingCowl2W: 0,
      aftRingNoseBot: -0.14, aftRingNoseTop: 0.285, aftRingScrW: -0.03,
      aftRingWinW: 0.08, aftRoofY: 0.665, aftWsBaseBow: 0.45,
      aftWsBaseLift: 0.255, aftWsCeilBow: 0.3, aftWsRun: 0.95,
      aftWsTopOff: 0.081824, apilPerp: 1, apilW: 1.12, bandH: 0.084,
      botRound: 0.36, bubble: 0, bubAt: 0.55, bubAt2: 0.18,
      bubAt3: 0.78, bubH: 0.9,
      bubH2: 0.56, bubH3: 0.5, cabPillarW: 0.085, canLoops: 3, canopy: 3,
      ceilInset: 0.2, consoleOn: 1, cowlBulge: 0.975, cowlEase: 0.53,
      cowlLoops: 2, crBand: 3, crCap: 3, crNoseCap: 3, crSill: 0,
      crewOn: 1, ctlPed: 1, ctlStick: 0, ctlThr: 2, cutParts: 1,
      dashBack: 0.1, dashCrease: 3, dashDepth: 0.13, doorSill: 0.094,
      cabOcc: 0, dumElbows: 0, dumKnees: 0, dumMarkers: 1, dumOn: 1,
      dumRecline: 0, dumSize: 1, explodeD: 0, halfW: 0.525, intCons: 0,
      intOn: 1, mirror: 1, noseCrown: 0.16, noseFinish: 1, noseH: 1.07,
      noseLen: 0.97, noseTip: 0.97, noseW: 0.9, paxLen: 0.91,
      paxPillarW: 0.115, pedalH: 0.27, pedalSpread: 0.09, pedalZ: 0.965,
      pfW: 1.21, pillarW: 0.085, pilotLen: 0.42, planeScale: 0.595,
      rimDoor: 0, rimW: 0.01, ringCabW: 0.115, ringNoseTop: -0.35,
      ringPullIn: 0, ringWinW: 0.115, roofHalfW: 0.41, roofY: 0.79,
      seatBelt: 0, seatGap: 0.285, seatH: 0.06, seatLayout: 0,
      seatRake: 44, seatTilt: 3, seatZ: 0, skylight: 0,
      stickX: 0, stickY: -0.095, stickZ: 0, tailRoofY: 0.3, thrX: 0,
      thrY: 0, thrZ: 0, topAngRoof: 81, topComp: 1.15, topRound: 1,
      waistY: -0.05, wsBaseBow: 0.45, wsBaseLift: 0.05, wsCeilBow: 0.3,
      wsRun: 0.95,
    },
  },

  // THE WHOLE AEROPLANE, for the stock rows that are a BUILD and not just a
  // shape. `presets` above is the cage — it is what the bench's preset menu
  // applies, and a cage is all a bench can use. The shelf's stock list is
  // the GAME's, and a player picking "piper cub" out of it wants the
  // aeroplane the cage was drawn for: its wing, its tail, its undercarriage,
  // its engine and propeller, its paint and its finish. Keyed by the same
  // name, merged over the baked cage by garage.js; a preset with no entry
  // here stays what it always was, so nothing else moves.
  //
  // SECTIONS ONLY, never `cage`: one declaration of the shape, above.
  // NULLS ARE KEPT AND ARE LOAD-BEARING — a null field is one the generator
  // DERIVES, and freezing the derived number here would stop it following
  // what it was derived from (garage.js, "WHAT IS SAVED IS THE SPEC, NULLS
  // AND ALL").
  builds: {
    'piper cub': {
      meta: { name: "Piper Cub", reg: "F-PGAR", role: null, class: null },
      cabin:
        { seating: "tandem2", pilots: 2, pax: 0, baggage: 10,
        halfW: 0.37191165556805206, h: 1.3048818182739685,
        len: 1.31356348, noseGap: 0.9902989600000001, seatX: 0,
        seatY: 0.1, seatPitch: 0.86, glazing: "bubble",
        panel: { on: true, depth: 0.27, inset: 0.06, wrap: 0.5 },
        pilot: { show: true, stature: 1.75, lean: 17, thigh: -9,
        shank: 10, armDown: 40, fore: 6, head: -11, armIn: 26,
        ankle: 40, toeOut: 7, hipOut: 0, kneeOut: 3 },
        canopy: { height: 0, sill: 0.3, skew: 0.42, bubble: 0.7,
        lid: 1, width: 1, x0: null, x1: null, reach: null,
        joint: "square", jointRun: 3, facet: false, sun: 0,
        sunStart: 0.38, sides: false, sideTop: 0.34, sideDepth: 0.5,
        sideReach: 1, sideGap: 0.1, wsAngle: null, wsCurve: 1 } },
      cargo: { len: 0, kg: 0 },
      fuel: { litres: 50, tank: "nose" },
      systems: { fit: "basic" },
      controls:
        { flap: { type: "fowler", span: 0.38, chord: 0.29 },
        aileron: { span: 0.55, chord: 0.29 }, elevator: { chord: 0.4 },
        rudder: { chord: 0.42 } },
      fuselage:
        { material: "tubeFabric", shape: "straight",
        tailArm: 5.01295932, postGap: 0.11537419999999976, tailBays: 4,
        tailW: 0.03653992300985376, tailBot: 0.5717755395722337,
        tailTop: 0.964955688448873, profile: [{ t: 0,
        w: 0.3752804623131992, yb: 0.18516342924926094,
        yt: 1.085347639067249 }, { t: 0.125, w: 0.33423479000000006,
        yb: 0.23335626327396836, yt: 1.0707590932739686 }, { t: 0.25,
        w: 0.29167886, yb: 0.2817356282739685,
        yt: 1.0556337682739685 }, { t: 0.375, w: 0.24912293000000008,
        yb: 0.3301149932739684, yt: 1.0405084432739686 }, { t: 0.5,
        w: 0.2055661869686438, yb: 0.3784943582739684,
        yt: 1.0253831182739686 }, { t: 0.625, w: 0.16225743794287772,
        yb: 0.42687372327396844, yt: 1.0102577932739685 }, { t: 0.75,
        w: 0.11930762519927884, yb: 0.47525308827396845,
        yt: 0.9951324682739686 }, { t: 0.875, w: 0.07721732340563646,
        yb: 0.5236324532739685, yt: 0.9800071432739685 }, { t: 1,
        w: 0.03653992300985376, yb: 0.5717755395722337,
        yt: 0.964955688448873 }], tailY: 0,
        cowlDeck: 0.707739400386603, windRun: 0.26, crownTop: 0.72,
        crownSide: 0.07 },
      cowl:
        { fillet: 0.1, taper: 0.94, halfW: null, top: null, bot: null,
        intake: "chin" },
      engines:
        [{ type: "a65_sensenich74", mount: "nose", place: { dx: 0,
        dy: 0 } }],
      prop:
        { D: 1.91, blades: 2, material: "wood", pitch: "cruise",
        chord: 0.1, root: 0.16, spinner: { shape: "ogive", len: 2.2,
        dia: 0.17 } },
      wings:
        [{ span: 10.7, chord: 1.7, taper: 1, dihedral: 1,
        incidence: 2.4, washout: 0, naca: 5412, panels: 3,
        position: "high", sweep: 0, tip: "rounded", crankAt: 0,
        dihedralOut: null, crankChord: null, crankX: null, tipX: 0,
        centre: "open", xLE: 0.28475339999999993, place: { dx: 0,
        dy: 0 } }],
      bracing: { type: "strut" },
      // the tail rows below are G54.3's BOUNDING-BOX readouts (hChord and
      // vChord are box extents, not chords) and carry no areas; since TAIL
      // CHANTIER 2 P1 the join re-measures every one of them on load
      // (BUILD_SYNC) off the drawn sheets — mean chords, Sh, Sv — so what
      // is frozen here never flies. Kept as the file's own history.
      tail:
        { type: "conventional", vAngle: 33, hSpan: 2.906604804992676,
        hChord: 1.2756185054779055, hX: 5.0341699094937145, hTaper: 1,
        tip: "rounded", tipV: null, tipH: null, vSweep: 0,
        stabH: 0.09169749444333175, dorsal: { len: 0.34, height: 0.16,
        width: 0.55, angle: null }, vHeight: 1.2070848610429987,
        vChord: 1.4608036899566659, vX: 5.087938892380981,
        place: { dx: 0 } },
      gear:
        { type: "taildragger", fairing: "none", twFairing: "none",
        legFair: "none", twLegFair: "none", fairTail: 1, twFairTail: 1,
        fairMat: "glass", suspension: "bungee", track: 1.78,
        x: 0.3736674562787443, y: -0.4570995196467612, wheelR: 0.22,
        twX: 5.488333519999999, twY: 0.4161345006233944, twR: 0.08,
        stiffness: 1, legDrop: null, twLeg: null, camber: 0,
        place: { dx: 0, dtrack: 0 } },
      paint:
        { job: "full", base: 15909943, trim: 1784412, sweep: 0.55,
        gloss: 0.42, regX: 0.3 },
      finish:
        { sections: { strut: { fin: "castAlu", tint: 16777215 },
        body: { tint: 16764160 }, waistband: { tint: 2500134 },
        ceilingLoop: { tint: 16764160 },
        pillarFront: { tint: 16764160 },
        pillarCabin: { tint: 16764160 }, floorLoop: { tint: 16764160 },
        gearLeg: { tint: 16764160 }, pillarWindow: { tint: 16764160 },
        dummy2: { tint: 6083612 }, pillarPassenger: { tint: 16764160 },
        pillarTail: { tint: 16764160 }, joint: { tint: 7368816 },
        wingTip: { tint: 0 }, finRud: { tint: 16764160 },
        spinner: { tint: 3684408 } }, wear: 1, decals: { regH: 0.6,
        regL: 3.15, regC: 0.14, regW: 1, regLock: 0, imgW: 0.15,
        imgH: 0.15, wimL: 0.65 }, glass: { opacity: 0.35,
        rainbow: 0.5 } },
    },
  },
};

window.CAGE_PAGE_SETUP = () => {
// Page-level DERIVED SELECTORS — one intent writes several raw params
// (the ride-along philosophy: high-level choice, derived details, manual
// override still possible afterwards in the sliders).
(() => {
  const CU = window.CAGE_UI, P = CU.P;
  const $g = sel => document.querySelector(`details[data-g="${sel}"]`);
  const mkSel = (host, label, opts, apply) => {
    if (!host) return;
    const d = document.createElement('div'); d.className = 'r';
    d.innerHTML = `<span class="k">${label}</span><select style="flex:1">` +
      opts.map(o => `<option>${o}</option>`).join('') + '</select>';
    host.querySelector('summary').after(d);
    d.querySelector('select').onchange = e => {
      apply(e.target.value); CU.syncSliders(); CU.build();
    };
  };
  // (THE NOSE CONFIGURATION SELECT IS GONE, 2026-09-11. It was the only
  // writer of `noseFinish`, it lived under `2 - engine` because its two
  // options were named after the engine, and the user could not find it:
  // "the aeronose option you found is a deprecated one I did not even know
  // existed". `noseFinish` is a row in `3 - nose` now, saying firewall or
  // aerodynamic. The other two things the select set were both no-ops —
  // `rearAperture` 0 and `crCap` 2 are the defaults on both branches.)
  // SEATING STARTERS: template application — writes section values ONCE,
  // everything stays editable after (plays with the save system).
  // DECOUPLED from the crew layout (user 2026-08-19): the starter sizes
  // the CABIN, the seat layout is its own control — one intent per
  // slider, and you can put a tandem pair in a wide cabin if you want.
  // DOWNGRADED at the same time: the old widths came from the oversized
  // template (0.45 halfW = a 0.90 m cabin for a single-seater). These
  // are real light-aircraft cabins measured across the seats — Cub-class
  // 0.66 m for single/tandem, ~1.05 m side-by-side.
  //
  // ...AND THEY WERE NOT (2026-09-11, the user: "you underestimate
  // systematically the required cabin width by about 50 cm"). The paragraph
  // above is the bug written down: `halfW` is a CAGE length and metres are
  // halfW x CAGE_UNIT x planeScale, and the page's aeroplane is authored at
  // planeScale 0.745 — so 0.33 was not "0.66 m across", it was 0.49 m, and
  // 0.525 was not 1.05 m but 0.78 m. Every starter, and the birth flow's
  // class seeds that were copied from them, built a cabin a quarter narrower
  // than the number being reasoned about. Corrected AND widened to what the
  // drawn occupants need, in metres across the waist: 0.70 single, 0.78
  // tandem, 1.27 side-by-side, 1.37 for the four-seater.
  const START = {
    'single':         { halfW: 0.47, roofHalfW: 0.38, pilotLen: 0.42,
                        paxCount: 0 },
    'tandem 2':       { halfW: 0.52, roofHalfW: 0.42, pilotLen: 0.42,
                        paxCount: 1, paxLen: 0.85 },
    'side-by-side 2': { halfW: 0.85, roofHalfW: 0.71,
                        pilotLen: 0.42, paxCount: 1, paxLen: 0.91 },
    'passenger':      { halfW: 0.92, roofHalfW: 0.77, pilotLen: 0.45,
                        paxCount: 3, paxLen: 0.95, boomLen: 4.6 },
  };
  mkSel($g('4 · cabin/dimensions'), 'starter',
    ['—'].concat(Object.keys(START)), v => {
      if (START[v]) Object.assign(P, START[v]);
    });
})();
};
