// CAGE PARTS (G76) — THE DECLARED ASSEMBLY OF THE AEROPLANE.
//
// ROADMAP P8 §4 asks for "a part tree + inspector [that] replaces the flat
// slider tree". This file is the declaration that tree is made of, and it is
// deliberately NOT in the UI: the design handoff's first open question says the
// param -> part mapping "should live beside the spec, not in the UI", because
// four different things read it and none of them is a panel:
//
//   the TREE          which rows exist, nested by parent anchor
//   the INSPECTOR     which rows a part owns, in which groups, in which order
//   the VIEW          which mesh sections are that part (tint, raycast — G79)
//   the BADGES        which rows count toward a part's "changed" dot (P8 §6)
//
// It is a DECLARATION, not a derivation. The panel's own group names (`1 ·
// global`, `3 · nose`, `4b · aft cabin`, `don't touch`, `polycount`) are a
// numbering that grew with the benches; the assembly below is what the
// aeroplane actually is. Where the two disagree the assembly wins, and the
// numbering disappears with the accordion.
//
// GATE PARTS (tools/_parts_check.js) is what keeps it honest: every parameter
// the panel renders lands in exactly one part, every section a real build emits
// is claimed by exactly one part, and every `when` below actually discriminates
// on some buildable aeroplane. A row added to a layer and forgotten here is a
// FAILING GATE, not a slider that quietly went missing from the editor.
//
// ---------------------------------------------------------------------------
// THE ROW FORMAT
//
//   key       stable id. The selection key, the localStorage value, and what
//             `parent` points at. Never renamed once a build has been saved
//             against it (nothing in a save file names a part yet, but the
//             selection restore does).
//   name      what the tree shows. `count(P)` may suffix it — "Passenger bay ×2".
//   parent    null for an ASSEMBLY (the tree's uppercase headings); otherwise
//             the key of the assembly or part this hangs under.
//   when(P)   existence. The discriminators are the ones the panel already
//             carries — mirror, paxCount, boomStyle, taperOn, wingOn, gearOn,
//             s1On/s2On, finOn, stOn, cowlOn, engOn, crewOn — so a part appears
//             and disappears exactly as its rows do today.
//   place     the SHARED PLACEMENT STRIP (P8 §5): { fore, up, len, wide, at }.
//             Each is a param key this part already owns; any may be absent.
//             They are shown FIRST, in that order, under one `placement`
//             heading, with `at` as the heading's right-hand meta — the anchor
//             the part is placed against. The rows keep their OWN labels: the
//             design shows `base lift · top offset · run` under `placement`,
//             not four renamed sliders, and renaming a row in one context and
//             not another is how a glossary rots.
//   groups    [[name, [param keys…]], …] — the inspector's quiet headings, in
//             order. A key listed here is claimed by this part; the same key
//             may appear TWICE in the panel (the engine page renders `eng_rpm`
//             under both `electric` and `engine geometry`) and both rows follow
//             the one part that claims the key.
//   sections  the mesh material names this part owns. The ~24 names real builds
//             emit are the key set the material system already uses (G67), so
//             the tree and AEROSKIN are two views of one part model.
//   layer     which THREE group holds this part's geometry: the cage's own
//             mesh, or one of the disjoint layers. G79's raycast resolves a hit
//             to a part through this plus `sections`.
// ---------------------------------------------------------------------------
'use strict';
(function () {

// EXPERT rows, declared per GROUP rather than per row: the `don't touch` folder
// was a name that begged to be ignored, and P1 §2 replaced it with one global
// switch. The groups named here are the frozen constants — they exist and are
// inspectable, but they are not what building an aeroplane is about.
const EXPERT = 'expert';

const CAGE_PARTS = [

  // =========================================================================
  // THE ROOT. Selecting it shows EVERY row — the user's own requirement:
  // "we should still have a top layer where everything is visible". The tree
  // narrows the panel; it must never be the only way to see the whole set.
  // =========================================================================
  { key: 'craft', name: 'Build plane', parent: null, root: true },

  // =========================================================================
  // FUSELAGE — the cage itself. `body` is the whole covering, so it belongs to
  // the assembly: clicking bare skin selects the fuselage, clicking a window
  // selects that window.
  // =========================================================================
  { key: 'fuselage', name: 'Fuselage', parent: null, layer: 'cage',
    sections: ['body'] },

  { key: 'rings', name: 'Rings & longerons', parent: 'fuselage', layer: 'cage',
    sections: ['ceilingLoop', 'floorLoop', 'waistband'],
    place: { up: 'waistY', at: 'the whole shell' },
    groups: [
      ['longerons', ['waistY', 'bandH', 'crSill', 'crCeil', 'ceilInset',
                     'ringPullIn']],
      ['section', ['topRound', 'botRound', 'topAngCeil', 'topAngRoof']],
      ['ring offsets', ['ringNoseTop', 'ringNoseBot', 'ringScrBot',
                        'ringWinTop', 'ringWinBot', 'ringCabTop', 'ringCabBot',
                        'ringCabW', 'ringWinW', 'ringScrW', 'ringCowl1W',
                        'ringCowl2W']],
      ['creases', ['crPillar', 'crBand', 'crCap', 'crFrame'], EXPERT],
      ['compensation', ['topComp'], EXPERT],
    ] },

  { key: 'nose', name: 'Nose · deck', parent: 'fuselage', layer: 'cage',
    sections: ['pillarFront'],
    place: { up: 'noseDroop', len: 'noseLen', wide: 'noseW',
             at: 'forward of the windscreen' },
    groups: [
      ['shape', ['noseLen', 'noseW', 'noseH', 'noseDroop', 'noseCrown',
                 'wsBaseLift', 'crSillNose']],
      ['tip', ['noseTip', 'crNoseCap', 'crFrontCap']],
      ['pillar', ['pfW'], EXPERT],
    ] },

  { key: 'cabin', name: 'Cabin', parent: 'fuselage', layer: 'cage',
    sections: ['pillarCabin'],
    place: { up: 'roofY', len: 'pilotLen', wide: 'halfW',
             at: 'aft of the windscreen' },
    groups: [
      ['dimensions', ['pilotLen', 'halfW', 'roofHalfW', 'roofY', 'keelY',
                      'floorY']],
      ['pod & canopy', ['mirror', 'canopy', 'bubble', 'arcFit', 'bubH', 'bubAt',
                        'bubW', 'canLoops', 'bubH2', 'bubAt2', 'bubW2', 'bubH3',
                        'bubAt3', 'bubW3']],
      ['pillars', ['pillarW', 'cabPillarW'], EXPERT],
    ] },

  // the section leaves the design draws under Cabin. Each is a real material
  // group in the mesh, which is what makes them clickable in the view.
  { key: 'windscreen', name: 'windscreen', parent: 'cabin', layer: 'cage',
    sections: ['windshield'],
    place: { up: 'wsTopOff', len: 'wsRun', at: 'on the cabin front ring' },
    groups: [
      ['shape', ['wsRun', 'wsTopOff', 'wsBaseBow', 'wsCeilBow']],
      ['A-pillars', ['apilW', 'apilPerp'], EXPERT],
    ] },

  { key: 'pilotWindow', name: 'pilot window', parent: 'cabin', layer: 'cage',
    sections: ['pilotWindow', 'pillarWindow'],
    place: { up: 'winSillPilot', at: 'in the cabin side' },
    groups: [['glazing', ['winSillPilot']]] },

  { key: 'skylight', name: 'skylight', parent: 'cabin', layer: 'cage',
    sections: ['skyWindows'],
    groups: [['glazing', ['skylight', 'skyExt']]] },

  { key: 'pilotDoor', name: 'pilot door', parent: 'cabin', layer: 'cage',
    place: { up: 'doorSill', at: 'cut from the cabin side' },
    groups: [['door', ['doorOn', 'doorSill', 'doorGone']]] },

  { key: 'joints', name: 'window joints', parent: 'cabin', layer: 'cage',
    sections: ['joint'],
    groups: [['seal', ['rimW']]] },

  // the mirrored pod's aft half. FOREVER-SPLIT (the user's ruling): these are
  // the front's full control set duplicated, not a mirror that tracks.
  { key: 'aftDeck', name: 'Aft deck', parent: 'fuselage', layer: 'cage',
    when: P => +P.mirror,
    place: { up: 'aftDroop', len: 'aftNoseLen', wide: 'aftNoseW',
             at: 'aft of the aft cabin' },
    groups: [
      ['shape', ['aftNoseLen', 'aftNoseW', 'aftNoseH', 'aftDroop',
                 'aftNoseCrown', 'aftWsBaseLift', 'aftCrSillNose']],
      ['end rings', ['aftRingNoseTop', 'aftRingNoseBot', 'aftNoseTip',
                     'aftRingCowl1W', 'aftRingCowl2W']],
      ['cowl curve', ['aftCowlLoops', 'aftCowlEase', 'aftCowlBulge']],
    ] },

  { key: 'aftCabin', name: 'Aft cabin', parent: 'fuselage', layer: 'cage',
    when: P => +P.mirror,
    place: { len: 'aftPilotLen', at: 'aft of the cabin' },
    groups: [
      ['dimensions', ['aftPilotLen']],
      ['screen', ['aftWsRun', 'aftWsTopOff', 'aftWsBaseBow', 'aftWsCeilBow']],
      ['rings', ['aftRingWinW', 'aftRingScrW']],
    ] },

  { key: 'pax', name: 'Passenger bay', parent: 'fuselage', layer: 'cage',
    sections: ['pasengerWindow', 'pillarPassenger'],
    count: P => +P.paxCount,
    place: { len: 'paxLen', at: 'aft of the cabin' },
    groups: [
      ['bays', ['paxCount', 'paxLen']],
      ['glazing', ['winSillPax']],
      ['doors', ['doorPax', 'doorSillPax']],
      ['pillars', ['paxPillarW'], EXPERT],
    ] },

  { key: 'taper', name: 'Taper section', parent: 'fuselage', layer: 'cage',
    when: P => +P.taperOn,
    sections: ['taper', 'pillarTaper', 'taperPanel'],
    place: { len: 'taperLen', wide: 'taperW', at: 'aft of the last bay' },
    groups: [['tightening', ['taperOn', 'taperLen', 'taperW', 'taperPanels']]] },

  { key: 'boom', name: 'Boom', parent: 'fuselage', layer: 'cage',
    sections: ['boomTube'],
    place: { up: 'rodY', len: 'boomLen', at: 'aft of the taper' },
    groups: [
      ['style', ['boomStyle', 'rodY', 'rodD']],
      ['length & rings', ['boomLen', 'aftRoofY', 'aftKeelY']],
      ['pod ring', ['boomMidOn', 'boomMidT', 'boomMidPinch']],
    ] },

  { key: 'tailcone', name: 'Tail cone', parent: 'fuselage', layer: 'cage',
    sections: ['pillarTail'],
    place: { up: 'tailRoofY', len: 'tailLen', wide: 'tailHalfW',
             at: 'the aft extremity' },
    groups: [['cone', ['tailLen', 'tailHalfW', 'tailRoofY', 'tailKeelY']]] },

  // THE FITTINGS (G81-G83). They are not a shape you draw — they are what
  // GEN_ACCESS says this aeroplane must carry, resolved against the built
  // skin, so there are no position sliders here and there should not be: a
  // fitting whose station you can drag is decoration, and the table's whole
  // claim is that each one is where it is because of what it serves.
  //
  // The rows are therefore a switch per FAMILY and a fastener density, which
  // is what somebody actually wants to change. `layer: 'access'` matches the
  // group _cage_access.js names, so G79's raycast can resolve a hit to it.
  { key: 'access', name: 'Fittings', parent: 'fuselage', layer: 'access',
    when: P => +P.accOn,
    groups: [
      ['fitted', ['accOn']],
      ['families', ['accFluids', 'accAccess', 'accInstr', 'accAerials',
                    'accHandling']],
      ['detail', ['accDetail']],
    ] },

  { key: 'structure', name: 'Structure & skin', parent: 'fuselage',
    layer: 'cage',
    sections: ['bulkhead', 'firewall', 'tube', 'plywood', 'woodFrame', 'cloth',
               'composite', 'aluminium', 'toele'],
    groups: [
      ['construction', ['intOn', 'intCons']],
      ['covering', ['skinOn', 'skinT', 'shellT']],
      ['members', ['intPillars', 'intFire', 'intBulk']],
      ['cutting', ['cutParts']],
    ] },

  // =========================================================================
  // WINGS — game-side geometry (src/core/6x_gen_*) imported into the cage at
  // G30, and fully editable here. The design handoff's second open question
  // asked whether these render read-only until P2 finishes; they do not, and
  // never needed to: the layer is in the bundle with its complete param table.
  // =========================================================================
  { key: 'wings', name: 'Wings', parent: null, layer: 'wing',
    groups: [['fitted', ['wingOn']]] },

  { key: 'wingPanel', name: 'Wing panels', parent: 'wings', layer: 'wing',
    when: P => +P.wingOn,
    place: { fore: 'wgDx', up: 'wgDy', len: 'wgChord', wide: 'wgSpan',
             at: 'on the cabin carry-through' },
    groups: [
      ['planform', ['wgSpan', 'wgChord', 'wgChordTip', 'wgTip', 'wgCrankAt',
                    'wgSweep']],
      ['rigging', ['wgPos', 'wgDihedral', 'wgDihedralOut', 'wgIncidence',
                   'wgWashout']],
      ['aerofoil', ['wgCamber', 'wgThick']],
      ['structure', ['wgCentre', 'wgPanels']],
      ['placement', ['wgDx', 'wgDy']],
    ] },

  { key: 'struts', name: 'Lift struts', parent: 'wings', layer: 'wing',
    when: P => +P.wingOn,
    // G88: the foot is the strut's own place on the fuselage, so it is the
    // strut part's rows and not the wing panel's — the plate, its bolts and
    // both members move together when they move.
    groups: [['fixation', ['wgBrace']],
             ['foot', ['wgStrutZ', 'wgStrutX']]] },

  { key: 'wingCtl', name: 'Control surfaces', parent: 'wings', layer: 'wing',
    when: P => +P.wingOn,
    groups: [
      ['flaps', ['wgFlapType', 'wgFlapSpan', 'wgFlapChord']],
      ['ailerons', ['wgAilSpan', 'wgAilChord']],
    ] },

  // =========================================================================
  // TAIL — the two 2D benches (G22/G23), each a sheet drawn from its corners
  // and rows. The design's mock tree has no tail branch; the mock is one
  // aeroplane's tree, not the schema.
  // =========================================================================
  { key: 'tail', name: 'Tail', parent: null, layer: 'fin' },

  { key: 'fin', name: 'Fin & rudder', parent: 'tail', layer: 'fin',
    when: P => +P.finOn,
    place: { fore: 'finRootFwd', at: 'on the boom deck' },
    groups: [
      ['layer', ['finOn', 'finProject', 'finRootGuard', 'finDorsal',
                 'finKeel']],
      ['cut', ['finCut', 'finCutGap']],
      ['thickness', ['finSolid', 'finThick', 'finThickTE']],
      ['corners', ['finTipZ', 'finTipY', 'finAftZ', 'finAftY', 'finBaseZ',
                   'finBaseY']],
      ['rows & points', ['finRootFwd', 'finMidY', 'finUY', 'finLEZ', 'finLEY',
                         'finShoulderZ', 'finShoulderY', 'finTopY']],
      ['trailing edge', ['finTERoot', 'finTEU', 'finTEMid']],
      ['corner sharpness', ['finSharpTip', 'finSharpAft', 'finSharpBase',
                            'finSharpShoulder', 'finSharpLE']],
      ['dorsal creases', ['finCrA', 'finCrB']],
    ] },

  { key: 'stab', name: 'Stabiliser & elevator', parent: 'tail', layer: 'stab',
    when: P => +P.stOn,
    place: { fore: 'stZ', up: 'stY', wide: 'stX', at: 'on the boom keel' },
    groups: [
      ['layer', ['stOn', 'stRootGuard']],
      ['position', ['stX', 'stY', 'stZ']],
      ['cut', ['stCut', 'stCutGap']],
      ['thickness', ['stSolid', 'stThick', 'stThickTE']],
      ['corners', ['stTipZ', 'stTipY', 'stAftZ', 'stAftY', 'stBaseZ',
                   'stBaseY']],
      ['rows & points', ['stRootFwd', 'stMidY', 'stUY', 'stLEZ', 'stLEY',
                         'stShoulderZ', 'stShoulderY', 'stTopY']],
      ['trailing edge', ['stTERoot', 'stTEU', 'stTEMid']],
      ['corner sharpness', ['stSharpTip', 'stSharpAft', 'stSharpBase',
                            'stSharpShoulder', 'stSharpLE']],
    ] },

  // =========================================================================
  // POWERPLANT — the dressed engine (G24/G25), the shell drawn around it
  // (G26/G29) and the propeller. Nose-mount only; pushers and wing nacelles
  // are ROADMAP P7.
  // =========================================================================
  { key: 'power', name: 'Powerplant', parent: null, layer: 'eng' },

  { key: 'engine', name: 'Engine', parent: 'power', layer: 'eng',
    when: P => +P.engOn,
    place: { up: 'engY', at: 'on the firewall face' },
    groups: [
      ['fitted', ['engOn', 'engPower', 'engPreset', 'engY']],
      ['electric', ['eng_eStyle', 'eng_canD', 'eng_canL', 'eng_volts',
                    'eng_eFins', 'eng_escOn']],
      ['geometry', ['eng_arch', 'eng_cyl', 'eng_radialRows', 'eng_bore',
                    'eng_stroke', 'eng_rpm', 'eng_stagger']],
      ['architecture', ['eng_twoStroke', 'eng_liquid', 'eng_geared']],
      ['cylinder dress', ['eng_finN', 'eng_finR', 'eng_headFins', 'eng_rockerW',
                          'eng_rockerH', 'eng_rockerR', 'eng_rockerBoss',
                          'eng_rockerBossW', 'eng_rodPos', 'eng_finShape',
                          'eng_rockerSpan', 'eng_baseFins']],
      ['induction + exhaust', ['eng_injected', 'eng_airStyle', 'eng_airbox',
                               'eng_intake', 'eng_exStyle', 'eng_exDrop']],
      ['ignition + accessories', ['eng_leads', 'eng_leadR', 'eng_mags',
                                  'eng_genOn', 'eng_oilFill']],
      ['radiator', ['eng_radX', 'eng_radY', 'eng_radZ', 'eng_radW', 'eng_radH',
                    'eng_radD']],
      ['engine bay', ['eng_starter', 'eng_oilFilter', 'eng_battOn',
                      'eng_ecuOn']],
      ['services', ['eng_fuelX', 'eng_fuelY', 'eng_thrX', 'eng_thrY',
                    'eng_plumb']],
      ['mount + firewall', ['eng_mount', 'eng_mountX', 'eng_mountGap',
                            'eng_mountR', 'eng_fwSpread']],
    ] },

  { key: 'cowl', name: 'Cowl', parent: 'power', layer: 'cowl',
    when: P => +P.cowlOn,
    place: { len: 'cw_cowlLen', at: 'wrapped round the engine' },
    groups: [
      ['fitted', ['cowlOn', 'fitNose', 'cowlGap']],
      ['nose curve', ['cowlLoops', 'cowlEase', 'cowlBulge']],
      ['body', ['cw_cowlLen', 'cw_aftW', 'cw_aftH', 'cw_taperW', 'cw_taperH',
                'cw_lidRise', 'cw_faceRise', 'cw_lidLen', 'cw_lidShoulder',
                'cw_keelSweep', 'cw_deckSweep', 'cw_waistSweep', 'cw_lidRound',
                'cw_lidMode', 'cw_lidR', 'cw_lidGap']],
      ['section shape', ['cw_inheritStub', 'cw_stubDeckH', 'cw_stubWaist',
                         'cw_stubKeelH', 'cw_stubSqTop', 'cw_stubSqBot',
                         'cw_deckH', 'cw_waist', 'cw_keelH', 'cw_sqAftTop',
                         'cw_sqAftBot', 'cw_sqFrontTop', 'cw_sqFrontBot',
                         'cw_lidSqTop', 'cw_lidSqBot']],
      ['panel seam', ['cw_seamOn', 'cw_seamType', 'cw_seamPos', 'cw_seamWidth',
                      'cw_seamDepth']],
      ['apertures', ['cw_apMode', 'cw_apW', 'cw_apH', 'cw_apSq', 'cw_pairX',
                     'cw_pairW', 'cw_pairH', 'cw_apOffX', 'cw_apOffY',
                     'cw_pairY', 'cw_pairSq']],
      ['lip', ['cw_lipMode', 'cw_lipThick', 'cw_lipDepth', 'cw_ductLen',
               'cw_lipProtrude', 'cw_lipInset', 'cw_lipRound', 'cw_ductFlare']],
      ['bulges & cut-out', ['cw_lobeN', 'cw_lobeAmp', 'cw_lobeT', 'cw_cutSpan',
                            'cw_lobeAz', 'cw_lobeSig', 'cw_lobeTSig',
                            'cw_cutAz']],
      ['chin scoop', ['cw_scoopOn', 'cw_scoopLen', 'cw_scoopW', 'cw_scoopH',
                      'cw_scoopSq', 'cw_scoopLipH', 'cw_scoopDrop',
                      'cw_scoopRake', 'cw_scoopAp', 'cw_scoopLipDepth',
                      'cw_scoopDuct']],
      // G94: what says this panel comes off. The fasteners and the parting
      // line belong to the cowl and to nothing else — they are drawn on its
      // own surface, and a camloc's pitch is a property of the panel it holds.
      ['fasteners & access', ['cw_fastOn', 'cw_fastPitch', 'cw_fastD',
                              'cw_partOn', 'cw_partY', 'cw_partW',
                              'cw_oilOn', 'cw_oilZ', 'cw_oilW', 'cw_oilL']],
    ] },

  // the propeller's GEOMETRY is the engine layer's (_cage_eng.js names the
  // spinner and the blades), even though its parameters are the cowl page's
  { key: 'prop', name: 'Propeller', parent: 'power', layer: 'eng',
    when: P => +P.propOn,
    place: { fore: 'cw_noseOff', at: 'on the crankshaft flange' },
    groups: [
      ['fitted', ['propOn']],
      ['nose cone', ['cw_noseOff', 'cw_spinR', 'cw_spinLen', 'cw_spinRound',
                     'cw_bladeStation']],
      ['blades', ['cw_bladeN', 'cw_propD', 'cw_material', 'cw_rootChord',
                  'cw_tipChord', 'cw_chordBulge', 'cw_sweep', 'cw_thickRoot',
                  'cw_thickTip', 'cw_camb', 'cw_tipRound', 'cw_cuff',
                  'cw_shankR']],
      ['design point', ['cw_rpm', 'cw_tas', 'cw_power', 'cw_slip']],
    ] },

  // =========================================================================
  // RUNNING GEAR — the undercarriage bench (G20), two stations and one wheel
  // kit shared between them.
  // =========================================================================
  { key: 'gear', name: 'Running gear', parent: null, layer: 'gear',
    groups: [['fitted', ['gearOn']]] },

  { key: 'mains', name: 'Main gear', parent: 'gear', layer: 'gear',
    when: P => +P.gearOn,
    place: { fore: 's1Z', up: 's1Drop', wide: 's1X', at: 'station 1' },
    groups: [
      ['station', ['s1On', 's1Z', 's1X', 's1Leg', 's1R', 's1Drop', 's1Brake',
                   's1Steer', 's1Fair']],
      ['blade', ['s1_beamAng', 's1_beamW', 's1_beamT', 's1_beamTaper',
                 's1_beamBow', 's1_beamRake']],
      ['linkage', ['s1_linkAng', 's1_linkSwing', 's1_linkArmW', 's1_linkVee',
                   's1_linkSpread', 's1_linkX', 's1_linkPanel']],
      ['shock', ['s1_shockKind', 's1_shockAt', 's1_shockZ', 's1_shockAng',
                 's1_bungeeSpan']],
      ['oleo', ['s1_oleoAng', 's1_oleoDia', 's1_oleoCyl', 's1_oleoScissor',
                's1_oleoBrace', 's1_oleoBraceZ']],
      ['castor', ['s1_twSpringLen', 's1_twSpringDrop', 's1_twSpringW',
                  's1_twSpringT', 's1_twLeaves', 's1_twRake', 's1_twTrail',
                  's1_twLegDrop', 's1_twSteer', 's1_twSteerVis', 's1_twHornY',
                  's1_twHornZ']],
    ] },

  { key: 'third', name: 'Third wheel', parent: 'gear', layer: 'gear',
    when: P => +P.gearOn,
    place: { fore: 's2Z', up: 's2Drop', wide: 's2X', at: 'station 2' },
    groups: [
      ['station', ['s2On', 's2Z', 's2X', 's2Leg', 's2R', 's2Drop', 's2Brake',
                   's2Steer', 's2Fair']],
      ['blade', ['s2_beamAng', 's2_beamW', 's2_beamT', 's2_beamTaper',
                 's2_beamBow', 's2_beamRake']],
      ['linkage', ['s2_linkAng', 's2_linkSwing', 's2_linkArmW', 's2_linkVee',
                   's2_linkSpread', 's2_linkX', 's2_linkPanel']],
      ['shock', ['s2_shockKind', 's2_shockAt', 's2_shockZ', 's2_shockAng',
                 's2_bungeeSpan']],
      ['oleo', ['s2_oleoAng', 's2_oleoDia', 's2_oleoCyl', 's2_oleoScissor',
                's2_oleoBrace', 's2_oleoBraceZ']],
      ['castor', ['s2_twSpringLen', 's2_twSpringDrop', 's2_twSpringW',
                  's2_twSpringT', 's2_twLeaves', 's2_twRake', 's2_twTrail',
                  's2_twLegDrop', 's2_twSteer', 's2_twSteerVis', 's2_twHornY',
                  's2_twHornZ']],
    ] },

  { key: 'wheels', name: 'Wheels & tyres', parent: 'gear', layer: 'gear',
    when: P => +P.gearOn,
    groups: [
      ['carcass', ['whProfile', 'whTread', 'whBulge', 'whRibs']],
      ['rim', ['whRim', 'whBolts', 'whCap', 'whValve', 'whBrake']],
    ] },

  // =========================================================================
  // CABIN FIT — the crew layer (cage5): seats, controls, the dashboard and the
  // dummy. A disjoint layer over the cage; never in the mesh, the gates or the
  // OBJ.
  // =========================================================================
  { key: 'fit', name: 'Cabin fit', parent: null, layer: 'crew',
    groups: [['fitted', ['crewOn']]] },

  { key: 'seats', name: 'Seats', parent: 'fit', layer: 'crew',
    when: P => +P.crewOn,
    place: { fore: 'seatZ', up: 'seatH', at: 'on the cabin floor' },
    groups: [
      ['seating', ['seatType', 'seatLayout', 'seatZ', 'seatH', 'seatRake',
                   'seatTilt', 'seatPitch', 'seatGap', 'seatBelt']],
      ['seat 2', ['seat2H', 'seat2Rake', 'seat2Tilt']],
    ] },

  { key: 'controls', name: 'Controls', parent: 'fit', layer: 'crew',
    when: P => +P.crewOn,
    groups: [
      ['pitch & roll', ['ctlStick', 'stickX', 'stickY', 'stickZ', 'stickLen']],
      ['throttle', ['ctlThr', 'thrX', 'thrY', 'thrZ', 'thrLen']],
      ['rudder', ['ctlPed', 'pedalZ', 'pedalH', 'pedalSpread', 'pedalAngle']],
      ['console', ['consoleOn']],
    ] },

  { key: 'cockpit', name: 'Cockpit & dash', parent: 'fit', layer: 'cage',
    sections: ['dash'],
    place: { fore: 'dashBack', at: 'off the windscreen base' },
    groups: [
      ['dashboard', ['intDash', 'dashBack', 'dashLip', 'dashDepth',
                     'dashCrown']],
      ['crease', ['dashCrease'], EXPERT],
    ] },

  { key: 'crew', name: 'Crew', parent: 'fit', layer: 'crew',
    when: P => +P.crewOn,
    groups: [
      ['dummies', ['dumOn', 'dum2On', 'dumSize']],
      ['posture', ['dumElbows', 'dumKnees', 'dumRecline', 'dumHandGrip']],
      ['markers', ['dumMarkers']],
    ] },

  // LIGHTS ARE A CABIN FITTING and not a fuselage one, because the thing you
  // actually interact with is the SWITCH: the row of throws and dimmers under
  // the instruments belongs with the seats and the controls. The lamps
  // themselves are hung all over the aeroplane, which is exactly why they are
  // one part rather than nine — a light is a circuit, not a place.
  { key: 'lights', name: 'Lights', parent: 'fit', layer: 'light',
    when: P => +P.lightOn,
    groups: [
      ['fitted', ['lightOn', 'lightSw']],
      ['outside (switches)', ['li_taxi', 'li_beacon', 'li_land', 'li_nav']],
      ['inside (dimmers)', ['li_flood', 'li_panel', 'li_pedal', 'li_pax']],
      // the wing bay is the lights' own geometry: where it is cut, how big it
      // is, how deep the box behind it goes, and how big the lamp in it is
      ['the wing bay', ['li_bayFrac', 'li_bayHalf', 'li_bayChord',
                        'li_bayDepth', 'li_lampSize']],
    ] },

  // =========================================================================
  // BUILD — what is true of the aeroplane rather than of one of its parts.
  // Scale is here and not on the fuselage because it is the recalibration
  // tool, not a design parameter (G28's ruling); balance is here because the
  // CG and the prop circle are whole-aeroplane facts the gear reads.
  // =========================================================================
  { key: 'build', name: 'Build', parent: null },

  { key: 'balance', name: 'Balance & stance', parent: 'build', layer: 'gear',
    groups: [
      ['centre of gravity', ['cgZ', 'cgY']],
      ['propeller circle', ['propR', 'propZ']],
      ['stance', ['gearSit']],
    ] },

  { key: 'poly', name: 'Polycount', parent: 'build',
    groups: [
      ['seals', ['rimSides', 'rimArc']],
      ['layers', ['cw_detail', 'engDetail', 'eng_screws']],
    ] },

  { key: 'scale', name: 'Scale', parent: 'build',
    groups: [['size', ['planeScale'], EXPERT]] },
];

// ---------------------------------------------------------------------------
// Derived helpers. Kept here rather than in the panel so the gate checks the
// same walk the UI does.
// ---------------------------------------------------------------------------
const partByKey = {};
for (const p of CAGE_PARTS) partByKey[p.key] = p;

// every param key this part claims, placement included (placement re-presents
// rows the part already owns — it never introduces one)
function cagePartParams(p) {
  const out = [];
  for (const g of (p.groups || [])) for (const k of g[1]) out.push(k);
  return out;
}

// the parts under a key, depth-first, INCLUDING it — what the inspector shows
// when an assembly or the root is selected ("the top layer where everything is
// visible"). The root returns everything.
function cagePartsUnder(key) {
  const out = [];
  const walk = k => {
    const p = partByKey[k];
    if (p && !p.root) out.push(p);
    for (const c of CAGE_PARTS) if (c.parent === k) walk(c.key);
  };
  if (key === 'craft' || !partByKey[key]) {
    for (const c of CAGE_PARTS) if (c.parent === null && !c.root) walk(c.key);
  } else walk(key);
  return out;
}

// which part owns a mesh section name (G79's raycast, and the tint)
const sectionOwner = {};
for (const p of CAGE_PARTS)
  for (const s of (p.sections || [])) sectionOwner[s] = p.key;

// which part claims a param key (the badges, and the gate's coverage check)
const paramOwner = {};
for (const p of CAGE_PARTS)
  for (const k of cagePartParams(p)) if (!(k in paramOwner)) paramOwner[k] = p.key;

// the expert flag for a group, by [partKey, groupName]
const expertGroup = {};
for (const p of CAGE_PARTS)
  for (const g of (p.groups || []))
    if (g[2] === EXPERT) expertGroup[p.key + '/' + g[0]] = 1;

const API = { CAGE_PARTS, cagePartParams, cagePartsUnder,
              partByKey, sectionOwner, paramOwner, expertGroup, EXPERT };

if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.CAGE_PARTS = API;

})();
