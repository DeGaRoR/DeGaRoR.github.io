// CAGE PAGE 5 — the aeroplane the light editor opens on, and its curated
// panel. Lifted out of _cage5.html so cage5 and cage6 are ONE page definition
// with different layers over it: cage6 is this plus the undercarriage, and a
// slider added here appears in both.
//
// `CAGE_PAGE_SETUP()` is the page's derived selectors (nose configuration,
// seating starters). It is a function rather than a bare IIFE because it needs
// window.CAGE_UI, which only exists once _cage_ui.js has run — so each page
// calls it in a trailing script.
'use strict';
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
    cw_lidGap: 0.009, cw_inheritStub: 1, cw_stubDeckH: 0.99,
    cw_stubWaist: 0.34, cw_stubKeelH: 0.98, cw_stubSqTop: 0.81,
    cw_stubSqBot: 0.79, cw_deckH: 1, cw_waist: 0.05337383734191484,
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
    propSpin: 0, crewOn: 1, seatLayout: 1, seatTilt: 3, seatBelt: 0,
    seatType: 0, seatZ: 0.205, seatH: 0.08, seatRake: 13, seatPitch: 0.84,
    seatGap: 0.23, seat2H: -1, seat2Rake: -1, seat2Tilt: -1, ctlStick: 0,
    ctlThr: 0, ctlPed: 1, consoleOn: 0, stickX: 0, stickY: 0, stickZ: 0,
    stickLen: 0.44, thrX: 0, thrY: 0, thrZ: 0, thrLen: 0.16, pedalZ: 0.9,
    pedalH: 0.18, pedalSpread: 0.15, pedalAngle: 25, dumOn: 1, dum2On: 1,
    dumSize: 1, dumElbows: 0.08, dumKnees: 0, dumRecline: 0, dumMarkers: 1,
    dumHandGrip: 0.075,
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
        ['shellT',    'shell thickness', 0.01, 0.10, 0.002, { dim: 'len' }],
        ['skinT',     'skin thickness',  0, 0.06, 0.001, { dim: 'len' }],
        ['intPillars','pillar bodies',   0, 1, 1],
        ['intFire',   'firewall',        0, 1, 1],
        ['intDash',   'dashboard',       0, 1, 1],
        // moved from "7 · boom" (user, G28): a conception concern
        ['intBulk',   'aft bulkhead',    0, 1, 1],
        // was invisible on this curated tree — but the piper preset sets
        // it 0, and doors/explode silently do nothing without it (the
        // intOn trap of 2026-08-19, same shape)
        ['cutParts',  'cut parts',       0, 1, 1],
      ]],
    ], 'open'],
    ['2 · engine', [
      // configuration select injected below (nose / aero nose); the
      // cowl-curve rows live inline now (G28: less nesting)
      ['cowlLoops', 'cowl loops',      0, 2, 1],
      ['cowlEase',  'cowl ease',       0.00, 1.00, 0.01],
      ['cowlBulge', 'cowl bulge',      0.85, 1.30, 0.005],
    ]],
    ['3 · nose', [
      ['noseLen',   'length',          0.20, 2.50, 0.01, { dim: 'len' }],
      ['noseW',     'width ×',         0.50, 1.50, 0.01],
      ['noseH',     'depth ×',         0.05, 1.20, 0.01],
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
        ['mirror',    'mirrored pod',   0, 1, 1],
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
      ], 'open'],
      ['doors', [
        ['doorOn',    'pilot door',     0, 1, 1],
        ['doorSill',  'door sill',      0, 0.25, 0.002,
         { when: P => +P.doorOn, dim: 'len' }],
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
      ['aftNoseW',    'width x',       -1, 1.5, 0.01],
      ['aftNoseH',    'depth x',       -1, 1.2, 0.01],
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
        ['seatLayout','layout',         0, 2, 1, ['single', 'side-by-side',
                                                  'tandem']],
        ['seatZ',     'seat fore-aft', -0.50, 0.50, 0.005],
        ['seatH',     'squab height',   0.06, 0.50, 0.005],
        ['seatRake',  'back recline',   5, 45, 0.5],
        ['seatTilt',  'squab recline',  0, 30, 0.5],
        ['seatPitch', 'tandem pitch',   0.55, 1.35, 0.01,
         { when: P => +P.seatLayout === 2 }],
        ['seatGap',   'sbs seat gap',   0.18, 0.45, 0.005,
         { when: P => +P.seatLayout === 1 }],
        ['seatBelt',  'lap belts',      0, 1, 1],
      ], 'open'],
      // the second seat's own set — the sentinel (-1 = follows the front
      // seat, resolved live by the crew layer) is now a visible LINK
      // checkbox; unticking writes the front seat's value into the slider
      ['seat 2', [
        ['seat2H',    'squab height',  -1, 0.50, 0.005,
         { link: { sentinel: -1, from: 'seatH', test: v => v < 0 } }],
        ['seat2Rake', 'back recline',  -1, 45, 0.5,
         { link: { sentinel: -1, from: 'seatRake', test: v => v < 0 } }],
        ['seat2Tilt', 'squab recline', -1, 30, 0.5,
         { link: { sentinel: -1, from: 'seatTilt', test: v => v < 0 } }],
      ], { when: P => +P.crewOn && +P.seatLayout > 0 }],
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
      ['dummy', [
        ['dumOn',     'pilot dummy',    0, 1, 1],
        ['dum2On',    'second dummy',   0, 1, 1],
        ['dumSize',   'stature',        0, 2, 1, ['5th %ile — 1.52 m',
                                                  '50th %ile — 1.75 m',
                                                  '95th %ile — 1.88 m']],
        ['dumElbows', 'elbows in/out', -0.25, 0.25, 0.005],
        ['dumKnees',  'knees in/out',  -0.25, 0.25, 0.005],
        ['dumRecline','recline offset',-15, 25, 0.5],
        ['dumHandGrip','hand on grip',  0, 0.16, 0.005],
        ['dumMarkers','eye point',      0, 1, 1],
      ], 'open', { when: P => +P.crewOn }],
    ], 'open'],
    ['5 · passengers', [
      ['paxCount',  'pax bays',        0, 4, 1],
      ['paxLen',    'bay length',      0.4, 3.0, 0.01,
       { when: P => +P.paxCount > 0, dim: 'len' }],
      ['winSillPax','win sill',        0, 0.9, 0.01,
       { when: P => +P.paxCount > 0 }],
      ['doorPax',   'pax doors',       0, 1, 1,
       { when: P => +P.paxCount > 0 }],
      ['doorSillPax','door sill',      0, 0.25, 0.002,
       { when: P => +P.paxCount > 0 && +P.doorPax, dim: 'len' }],
    ]],
    ['7 · boom', [
      // G26 — the dedicated tightening section + the rod boom. The
      // taper is an EXPLICIT section (taperOn), gated aft by its own
      // pillar; with it on, aft roof/keel y shape its aft ring (the
      // boom root) and the pax pillar reverts to the full cabin
      // section. Rod: the tube IS the boom and the tail — bare, fin
      // and stab clamp straight onto it; no skin over the tightening.
      ['boomStyle', 'boom style',      0, 1, 1, ['lofted skin',
                                                 'rod (tube)']],
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
      ['rodY',      'rod height',     -0.9, 0.9, 0.005,
       { when: P => +P.boomStyle === 1, dim: 'len' }],
      ['rodD',      'rod diameter',    0.04, 0.32, 0.002,
       { when: P => +P.boomStyle === 1, dim: 'len' }],
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
      ['crNoseCap', 'nose cap crease', 0, 3, 0.05],
      ['dashCrease','dash crease',     0, 3, 0.05],
    ], { level: 'expert' }],
  ],

  // THE PRESETS. 'jodel' is the page default itself, so its override
  // set is empty; the other two carry the user's own builds verbatim.
  presets: {
    'jodel': {},
    // THE PIPER CUB — the user's own build, verbatim from their
    // export (piper.json, 2026-08-19): the template identity in the
    // cage (box top, template dims, skylights, no cut parts) plus a
    // STEEL-TUBE interior, tandem seating and its tuned cockpit.
    // planeScale 0.68 is its real size; the slider opens at x1.000.
    'piper cub': {
      aftKeelY: -0.656475, aftRoofY: 0.677945, apilPerp: 0, apilW: 1,
      bubble: 0, cabPillarW: 0.1, cowlBulge: 1.05, cowlEase: 0, crBand: 1,
      crCap: 2, crNoseCap: 2, crSill: 2, cutParts: 0, dashBack: 0.115,
      dashCrease: 1.5, dashDepth: 0.39, dumElbows: 0, halfW: 0.554104,
      intCons: 1, noseCrown: 0, noseH: 1, noseLen: 0.646272, noseW: 1,
      paxLen: 1.75667, paxPillarW: 0.075041, pedalAngle: 47, pedalH: 0.09,
      pedalZ: 0.945, pfW: 1, pillarW: 0, pilotLen: 0.662567,
      planeScale: 0.68, rimDoor: 1, roofY: 1, seat2H: -0.145,
      seat2Rake: 34.5, seat2Tilt: 2, seatGap: 0.27, seatH: 0.06,
      seatLayout: 2, seatPitch: 0.96, seatRake: 25.5, seatTilt: 13,
      seatZ: 0.175, skylight: 1, tailRoofY: 0.5, topAngRoof: 76,
      topComp: 1.045, topRound: 0, waistY: 0.091103, wsBaseBow: 0.55888,
      wsBaseLift: 0, wsCeilBow: 0.129299, wsRun: 0.793755,
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
      dum2On: 0, dumElbows: 0, dumKnees: 0, dumMarkers: 1, dumOn: 1,
      dumRecline: 0, dumSize: 1, explodeD: 0, halfW: 0.525, intCons: 0,
      intOn: 1, mirror: 1, noseCrown: 0.16, noseFinish: 1, noseH: 1.07,
      noseLen: 0.97, noseTip: 0.97, noseW: 0.9, paxLen: 0.91,
      paxPillarW: 0.115, pedalH: 0.27, pedalSpread: 0.09, pedalZ: 0.965,
      pfW: 1.21, pillarW: 0.085, pilotLen: 0.42, planeScale: 0.595,
      rimDoor: 0, rimW: 0.01, ringCabW: 0.115, ringNoseTop: -0.35,
      ringPullIn: 0, ringWinW: 0.115, roofHalfW: 0.41, roofY: 0.79,
      seatBelt: 0, seatGap: 0.285, seatH: 0.06, seatLayout: 2,
      seatPitch: 0.92, seatRake: 44, seatTilt: 3, seatZ: 0, skylight: 0,
      stickX: 0, stickY: -0.095, stickZ: 0, tailRoofY: 0.3, thrX: 0,
      thrY: 0, thrZ: 0, topAngRoof: 81, topComp: 1.15, topRound: 1,
      waistY: -0.05, wsBaseBow: 0.45, wsBaseLift: 0.05, wsCeilBow: 0.3,
      wsRun: 0.95,
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
  // NOSE CONFIGURATION (user ruling 2026-08-18: two REAL options —
  // pusher / wing engines were hypothetical and are dropped). The
  // choice derives noseFinish + rear aperture + cap crease.
  mkSel($g('2 · engine'), 'configuration',
    ['engine nose-mounted', 'aero nose'], v => {
      if (v === 'engine nose-mounted') {
        P.noseFinish = 0; P.rearAperture = 0; P.crCap = 2;
      }
      if (v === 'aero nose') {
        P.noseFinish = 1; P.rearAperture = 0; P.crCap = 2;
      }
    });
  // SEATING STARTERS: template application — writes section values ONCE,
  // everything stays editable after (plays with the save system).
  // DECOUPLED from the crew layout (user 2026-08-19): the starter sizes
  // the CABIN, the seat layout is its own control — one intent per
  // slider, and you can put a tandem pair in a wide cabin if you want.
  // DOWNGRADED at the same time: the old widths came from the oversized
  // template (0.45 halfW = a 0.90 m cabin for a single-seater). These
  // are real light-aircraft cabins measured across the seats — Cub-class
  // 0.66 m for single/tandem, ~1.05 m side-by-side.
  const START = {
    'single':         { halfW: 0.33, roofHalfW: 0.26, pilotLen: 0.42,
                        paxCount: 0 },
    'tandem 2':       { halfW: 0.34, roofHalfW: 0.27, pilotLen: 0.42,
                        paxCount: 1, paxLen: 0.85 },
    'side-by-side 2': { halfW: 0.525, roofHalfW: 0.41,
                        pilotLen: 0.42, paxCount: 1, paxLen: 0.91 },
    'passenger':      { halfW: 0.55, roofHalfW: 0.43, pilotLen: 0.45,
                        paxCount: 3, paxLen: 0.95, boomLen: 4.6 },
  };
  mkSel($g('4 · cabin/dimensions'), 'starter',
    ['—'].concat(Object.keys(START)), v => {
      if (START[v]) Object.assign(P, START[v]);
    });
})();
};
