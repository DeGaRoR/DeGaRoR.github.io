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
//   zone      which BODY ZONE of the covering this part is (the user: "the
//             fuselage divides into nose, the pilot cabin, the passenger bays,
//             the boom ... these parts would need to highlight accordingly").
//             The fuselage skin is ONE material end to end — one finish, one
//             livery — so it is claimed once, by the Fuselage assembly, and
//             the sections under it claim STATIONS instead. The station table
//             is `cageBodyZones` in tools/_cage_gen.js and the keys here are
//             its keys; a hit on a ZONED section (below) resolves through
//             this, and the highlight draws that zone's faces only.
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

// THE DECLARED FITTINGS, read from GEN_ACCESS itself. `_cage_access.js`
// generates two nudge rows per key; this claims exactly those, from the same
// list, so the two can never drift. Node-side the core is loaded by the gate
// before this file; in the page it is on window. Empty is safe — the group
// simply carries nothing and GATE PARTS' own coverage rule stays true.
const ACC_FIT_KEYS = (function () {
  const T = (typeof GEN_ACCESS !== 'undefined') ? GEN_ACCESS
          : (typeof window !== 'undefined' ? window.GEN_ACCESS : null);
  return T ? Object.keys(T) : [];
})();

const CAGE_PARTS = [

  // =========================================================================
  // THE ROOT. Selecting it shows EVERY row — the user's own requirement:
  // "we should still have a top layer where everything is visible". The tree
  // narrows the panel; it must never be the only way to see the whole set.
  // =========================================================================
  { key: 'craft', name: 'My Plane', parent: null, root: true },

  // =========================================================================
  // DESIGN & CONSTRUCTION — the discriminators, first under the aeroplane
  // (UI-MODEL section 2.4; ROADMAP P8 section 3's "configure THEN shape",
  // preserved by ORDER rather than enforced by a mode).
  //
  // These rows decide WHAT THE AEROPLANE IS before any of it is shaped: what
  // it is made of, whether it has a boom or a tail cone, a pod or a cabin,
  // where the wing sits and whether it is braced, and which of the big
  // assemblies exist at all. Every one of them was filed under a PART of the
  // aeroplane while deciding something about ALL of it — `intCons` under
  // `Fuselage -> Structure & skin` is the case the user could not find twice
  // ("where is the conception slider?", then "the construction material and
  // type should definitely be in structure, and not in finish").
  //
  // IT IS AN ASSEMBLY WITH NO PARTS UNDER IT, deliberately: it is a top-level
  // row that carries its OWN rows, which is what makes it a peer of Fuselage
  // rather than a heading over one. GATE PARTS' "assembly with no parts under
  // it" rule was widened for exactly this, and only this — an assembly with
  // neither children nor groups is still a part that forgot to say so.
  //
  // NOT HERE, and it is a judgement worth stating: `engPreset`. UI-MODEL lists
  // "powertrain" among the discriminators, but choosing a Rotax 912 does not
  // decide which parts EXIST — it names a model, and a builder looks for it
  // under Engine. The two DERIVED selectors (the nose configuration and the
  // seating starter) DO belong here and are re-pointed in editor.js's DERIVED
  // map, because they write several raw params at once and that is precisely
  // what a discriminator is.
  //
  // REVISED, deliberately (NEW-AIRCRAFT §5.6, 2026-08-31): the DESIGN TILES
  // (tools/_cage_design.js, rendered by design_flow.js when this part is
  // selected) DO offer the engine model — as level 2 under the powertrain
  // FAMILY, "preset (applies once)", filtered by family. That is a second
  // RENDERING of the same engPreset row, not a second home: the slider above
  // keeps its claim here-not-here unchanged, and the paragraph above stays
  // true of the ROWS view it was written about.
  // =========================================================================
  { key: 'design', name: 'Design & construction', parent: null, layer: 'cage',
    groups: [
      ['construction', ['intCons']],
      ['configuration', ['boomStyle', 'mirror', 'canopy']],
      ['wing', ['wgPos', 'wgBrace']],
      ['what it has', ['wingOn', 'gearOn', 'crewOn']],
    ] },


  // =========================================================================
  // FUSELAGE — the cage itself, AND THE THINGS THAT RUN THE WHOLE LENGTH OF
  // IT. The covering (`body`) and the three longerons (`waistband`,
  // `ceilingLoop`, `floorLoop`) are one material each from the firewall to
  // the tail, so the assembly owns them and a CLICK on any of them asks which
  // BAY it struck (CAGE_ZONE_PICK below) — the material answer, "the whole
  // aeroplane", is no answer at all.
  //
  // `Rings & longerons` USED TO SIT UNDER HERE and owned the three rails (the
  // user: "the whole rings and longerons cause an issue. I don't think they
  // should be directly selectable. The longerons should be part of either the
  // cabin, or the passenger bay, or the nose, or the boom towards the tail...
  // The rings are accessed through the part selection menu, under fuselage").
  // It is dissolved: the rails and the WHOLE-SHELL rows are the Fuselage's own
  // — which is what "under fuselage" means, and what selecting the assembly
  // now shows — and the per-STATION ring offsets went to the bays whose rings
  // they move. What was left over was an assembly's rows wearing a part's
  // name.
  //
  // WHAT DID NOT MOVE, and it is a limit worth stating rather than papering
  // over: `waistY`, `bandH`, `ceilInset` and `ringPullIn` are ONE VALUE EACH
  // for the whole aeroplane — there is one waist line, not four — so they
  // cannot be filed under a bay without inventing per-station longeron
  // parameters, which is a change to the cage and not to this table.
  // =========================================================================
  { key: 'fuselage', name: 'Fuselage', parent: null, layer: 'cage',
    sections: ['body', 'ceilingLoop', 'floorLoop', 'waistband'],
    place: { up: 'waistY', at: 'the whole shell' },
    groups: [
      ['longerons', ['waistY', 'bandH', 'crSill', 'crCeil', 'ceilInset',
                     'ringPullIn']],
      ['section', ['topRound', 'botRound', 'topAngCeil', 'topAngRoof']],
      ['creases', ['crPillar', 'crBand', 'crCap', 'crFrame'], EXPERT],
      ['compensation', ['topComp'], EXPERT],
    ] },

  { key: 'nose', name: 'Nose · deck', parent: 'fuselage', layer: 'cage',
    sections: ['pillarFront'],
    zone: 'nose',
    place: { up: 'noseDroop', len: 'noseLen', wide: 'noseW',
             at: 'forward of the windscreen' },
    groups: [
      ['shape', ['noseLen', 'noseW', 'noseH', 'noseDroop', 'noseCrown',
                 'wsBaseLift', 'crSillNose']],
      ['tip', ['noseTip', 'crNoseCap', 'crFrontCap']],
      // THE NOSE'S OWN RINGS. `ringNoseTop` lifts the deck at the nose/
      // aperture pair, `ringNoseBot` drops its keel and floor, and the two
      // cowl widths pull that pair in or out — every one of them moves a ring
      // THIS PART IS, which is why they are here and not in a table of twelve
      // offsets under the whole shell.
      ['rings', ['ringNoseTop', 'ringNoseBot', 'ringCowl1W', 'ringCowl2W']],
      ['pillar', ['pfW'], EXPERT],
    ] },

  { key: 'cabin', name: 'Cabin', parent: 'fuselage', layer: 'cage',
    sections: ['pillarCabin'],
    zone: 'cabin',
    place: { up: 'roofY', len: 'pilotLen', wide: 'halfW',
             at: 'aft of the windscreen' },
    groups: [
      ['dimensions', ['pilotLen', 'halfW', 'roofHalfW', 'roofY', 'keelY',
                      'floorY']],
      // mirror + canopy -> `design`: they decide whether there IS a pod and
      // what kind, which is a configuration question. What is left here is
      // the SHAPE of the one you chose.
      ['pod & canopy', ['bubble', 'arcFit', 'bubH', 'bubAt',
                        'bubW', 'canLoops', 'bubH2', 'bubAt2', 'bubW2', 'bubH3',
                        'bubAt3', 'bubW3']],
      // THE CABIN'S TWO RINGS: the window ring at its forward end (Win) and
      // the cabin pillar pair at its aft (Cab). Both are the bay's own
      // cross-sections, moved bodily in metres — the ring editor G18 built,
      // filed where the ring is.
      ['rings', ['ringWinTop', 'ringWinBot', 'ringWinW',
                 'ringCabTop', 'ringCabBot', 'ringCabW']],
      // the cabin pillar (this part's pillarCabin section) leans too —
      // set with the aft bulkhead's for the parallelogram rear window
      ['aft pillar', ['leanCabDeg']],
      ['pillars', ['pillarW', 'cabPillarW'], EXPERT],
    ] },

  // the section leaves the design draws under Cabin. Each is a real material
  // group in the mesh, which is what makes them clickable in the view.
  { key: 'windscreen', name: 'windscreen', parent: 'cabin', layer: 'cage',
    sections: ['windshield'],
    place: { up: 'wsTopOff', len: 'wsRun', at: 'on the cabin front ring' },
    groups: [
      ['shape', ['wsRun', 'wsTopOff', 'wsBaseBow', 'wsCeilBow']],
      // the screen BASE ring pair (wsFront + wsAft): where the screen stands
      // on the shell, and how wide the shell is there
      ['rings', ['ringScrBot', 'ringScrW']],
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
    // THE GAP BELONGS TO THE DOOR, the seal's gauge to the joints. Both were
    // `rimW` before, filed under `joints` — so the one control over how
    // visible a door is did not appear when you selected a door, which is
    // exactly what the user reported as "the door gap is too small".
    groups: [['door', ['doorOn', 'doorSill', 'doorGone', 'doorDeep']],
             ['the gap', ['doorRim', 'rimDoor', 'doorDepth']]] },

  { key: 'joints', name: 'window joints', parent: 'cabin', layer: 'cage',
    sections: ['joint'],
    // the REVEAL is the windows' own: it is what `winFrameW` gates, and it
    // reaches every glazed zone rather than any one part
    groups: [['seal', ['rimW']],
             ['the reveal', ['winFrameW', 'winDepth']]] },

  // the mirrored pod's aft half. FOREVER-SPLIT (the user's ruling): these are
  // the front's full control set duplicated, not a mirror that tracks.
  { key: 'aftDeck', name: 'Aft deck', parent: 'fuselage', layer: 'cage',
    when: P => +P.mirror,
    zone: 'aftDeck',
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
    zone: 'aftCabin',
    place: { len: 'aftPilotLen', at: 'aft of the cabin' },
    groups: [
      ['dimensions', ['aftPilotLen']],
      ['screen', ['aftWsRun', 'aftWsTopOff', 'aftWsBaseBow', 'aftWsCeilBow']],
      ['rings', ['aftRingWinW', 'aftRingScrW']],
    ] },

  { key: 'pax', name: 'Passenger bay', parent: 'fuselage', layer: 'cage',
    sections: ['pasengerWindow', 'pillarPassenger'],
    zone: 'pax',
    count: P => +P.paxCount,
    place: { len: 'paxLen', at: 'aft of the cabin' },
    groups: [
      ['bays', ['paxCount', 'paxLen']],
      // THE LEAN (study 2026-09-01): the aft bulkhead (this part's own
      // pillarPassenger section) rakes top-aft as a shear, in degrees —
      // the generator clamps on roof travel. Claimed HERE because this
      // part owns that pillar; the part stays in the tree at 0 bays
      // (count decorates the name, it does not hide the part), so a
      // two-seater's pilot pillar keeps its row.
      ['aft bulkhead', ['leanPaxDeg']],
      ['glazing', ['winSillPax']],
      ['doors', ['doorPax', 'doorSillPax']],
      ['pillars', ['paxPillarW'], EXPERT],
    ] },

  { key: 'taper', name: 'Taper section', parent: 'fuselage', layer: 'cage',
    when: P => +P.taperOn,
    sections: ['taper', 'pillarTaper', 'taperPanel'],
    zone: 'taper',
    place: { len: 'taperLen', wide: 'taperW', at: 'aft of the last bay' },
    groups: [['tightening', ['taperOn', 'taperLen', 'taperW', 'taperPanels']]] },

  { key: 'boom', name: 'Boom', parent: 'fuselage', layer: 'cage',
    sections: ['boomTube'],
    zone: 'boom',
    place: { up: 'rodY', len: 'boomLen', at: 'aft of the taper' },
    groups: [
      ['style', ['rodY', 'rodD']],   // boomStyle -> `design`
      ['length & rings', ['boomLen', 'aftRoofY', 'aftKeelY']],
      ['pod ring', ['boomMidOn', 'boomMidT', 'boomMidPinch']],
    ] },

  { key: 'tailcone', name: 'Tail cone', parent: 'fuselage', layer: 'cage',
    sections: ['pillarTail'],
    zone: 'tail',
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
    sections: ['accPaint'],
    groups: [
      ['fitted', ['accOn']],
      ['families', ['accFluids', 'accAccess', 'accInstr', 'accAerials',
                    'accHandling']],
      ['detail', ['accDetail']],
      // THE FINE PLACEMENT (2026-08-31). Two nudges per declared fitting, in
      // GEN_ACCESS's own units — `sL` metres aft of the firewall, `lv` a rail
      // index — GENERATED from the same key list `_cage_access.js` generates
      // its rows from, so a fitting added to the table cannot leave an
      // unclaimed row behind and one removed cannot leave an orphan claim.
      ['fine placement', ACC_FIT_KEYS.reduce((a2, k) =>
        a2.concat(['acc_' + k + '_sL', 'acc_' + k + '_lv']), []), EXPERT],
    ] },

  { key: 'structure', name: 'Structure & skin', parent: 'fuselage',
    layer: 'cage',
    sections: ['bulkhead', 'firewall', 'tube', 'plywood', 'woodFrame', 'cloth',
               'composite', 'aluminium', 'toele'],
    groups: [
      ['construction', ['intOn']],   // intCons -> `design` (it decides ALL of it)
      ['covering', ['skinOn', 'skinT', 'shellT']],
      ['members', ['intPillars', 'intFire', 'intBulk', 'bulkZ']],
      ['cutting', ['cutParts']],
    ] },

  // =========================================================================
  // WINGS — game-side geometry (src/core/6x_gen_*) imported into the cage at
  // G30, and fully editable here. The design handoff's second open question
  // asked whether these render read-only until P2 finishes; they do not, and
  // never needed to: the layer is in the bundle with its complete param table.
  // =========================================================================
  { key: 'wings', name: 'Wings', parent: null, layer: 'wing' },

  { key: 'wingPanel', name: 'Wing panels', parent: 'wings', layer: 'wing',
    when: P => +P.wingOn,
    place: { fore: 'wgDx', up: 'wgDy', len: 'wgChord', wide: 'wgSpan',
             at: 'on the cabin carry-through' },
    // LAYER sections (AEROSKIN's AERO_SEC), not cage mesh names: the wing's
    // own livery rows, following the fuselage until overridden
    sections: ['wingSkin', 'wingTip'],
    groups: [
      // G140: the planform is three stations — root chord, the crank's own
      // chord and seat, the tip's chord and seat. Sweep retired (it falls
      // out of the seats); the design tab's planform tile retired with it.
      ['planform', ['wgSpan', 'wgChord', 'wgCrankAt', 'wgCrankChord',
                    'wgCrankX', 'wgChordTip', 'wgTipX', 'wgTip']],
      ['rigging', ['wgDihedral', 'wgDihedralOut', 'wgIncidence',
                   'wgWashout']],   // wgPos -> `design`
      ['aerofoil', ['wgCamber', 'wgThick']],
      ['structure', ['wgCentre', 'wgPanels', 'wgCons']],
      ['placement', ['wgDx', 'wgDy']],
    ] },

  { key: 'struts', name: 'Lift struts', parent: 'wings', layer: 'wing',
    when: P => +P.wingOn,
    sections: ['strut'],
    // G88: the foot is the strut's own place on the fuselage, so it is the
    // strut part's rows and not the wing panel's — the plate, its bolts and
    // both members move together when they move.
    // wgBrace -> `design`: whether the wing is braced at all decides
    // whether this part exists. What is left is where its foot sits.
    groups: [['foot', ['wgStrutZ', 'wgStrutX']]] },

  { key: 'wingCtl', name: 'Control surfaces', parent: 'wings', layer: 'wing',
    when: P => +P.wingOn,
    sections: ['wingAil', 'wingFlap'],
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
    sections: ['finSkin', 'finRud'],
    groups: [
      ['layer', ['finOn', 'finProject', 'finRootGuard', 'finDorsal',
                 'finKeel']],
      ['construction', ['finCons']],
      ['cut', ['finCut', 'finCutGap']],
      // `tailRimN` is claimed HERE and not by the stabiliser, because it is one
      // knob for both surfaces (they are one drawing, G23) and GATE PARTS
      // requires every rendered key to be claimed by exactly one part.
      ['thickness', ['finSolid', 'finThick', 'finThickTE', 'tailRimN']],
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
    sections: ['stabSkin', 'stabElev'],
    groups: [
      ['layer', ['stOn', 'stRootGuard']],
      ['construction', ['stCons']],
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
    // THE ENGINE IS FINISHED IN THREE (G113.4). AERO_HARD still says what
    // every part IS — a plug is chrome, a lead is rubber — but the castings
    // are painted, and the user asked for the block and the covers by name.
    // Without this claim the three sections land in the root's 'unclaimed'
    // bucket, which is a home but not an ANSWER.
    sections: ['engBlock', 'engJug', 'engCover', 'engMount'],
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
                               'eng_intake', 'eng_exStyle', 'eng_exDrop',
                               'eng_exOut', 'eng_exAim', 'eng_exOutX',
                               'eng_exOutY', 'eng_exOutZ']],
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
    sections: ['cowlSkin'],
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
                              'cw_oilOn', 'cw_oilZ', 'cw_oilW', 'cw_oilL',
                              'cw_oilSq']],
    ] },

  // the propeller's GEOMETRY is the engine layer's (_cage_eng.js names the
  // spinner and the blades), even though its parameters are the cowl page's
  { key: 'prop', name: 'Propeller', parent: 'power', layer: 'eng',
    when: P => +P.propOn,
    place: { fore: 'cw_noseOff', at: 'on the crankshaft flange' },
    sections: ['prop', 'spinner'],
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
  { key: 'gear', name: 'Running gear', parent: null, layer: 'gear' },

  { key: 'mains', name: 'Main gear', parent: 'gear', layer: 'gear',
    when: P => +P.gearOn,
    place: { fore: 's1Z', up: 's1Drop', wide: 's1X', at: 'station 1' },
    // gearLeg dresses EVERY painted leg member (mains, third's castor) —
    // one section, claimed here where most of the legs are
    sections: ['gearLeg'],
    groups: [
      ['station', ['s1On', 's1Z', 's1X', 's1Leg', 's1R', 's1Drop', 's1Brake',
                   's1Steer']],
      // G133: the fairing's own instruments, one group per station
      ['fairing', ['s1Fair', 's1FairSkirt', 's1FairTail', 's1FairRake',
                   's1FairW', 's1LegFair']],
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
                   's2Steer']],
      ['fairing', ['s2Fair', 's2FairSkirt', 's2FairTail', 's2FairRake',
                   's2FairW', 's2LegFair']],
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
    sections: ['spat'],
    groups: [
      ['carcass', ['whProfile', 'whTread', 'whBulge', 'whRibs']],
      ['rim', ['whRim', 'whBolts', 'whCap', 'whValve', 'whBrake']],
      // G133: one layup for the whole fairing set — it lives with the part
      // that owns the spat section
      ['fairing build', ['fairCons']],
    ] },

  // =========================================================================
  // CABIN FIT — the crew layer (cage5): seats, controls, the dashboard and the
  // dummy. A disjoint layer over the cage; never in the mesh, the gates or the
  // OBJ.
  // =========================================================================
  { key: 'fit', name: 'Cabin fit', parent: null, layer: 'crew' },

  { key: 'seats', name: 'Seats', parent: 'fit', layer: 'crew',
    sections: ['seatTrim'],
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
    sections: ['dummy1', 'dummy2'],
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
      ['lamp fairings', ['li_podLen', 'li_podGirth', 'li_reflect']],
      ['the navigation lights', ['li_navSpan', 'li_navChord', 'li_navRise']],
      ['the beacon', ['li_beaconRpm', 'li_beaconSink']],
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

// THE SECTIONS THAT DIVIDE BY STATION — and the two questions that asks, put
// in two tables because they have different answers.
//
// CAGE_ZONED     what a SELECTION of a bay is cut to. Select the Cabin and
//                you get the cabin's covering and the cabin's seals, not the
//                whole aeroplane's. Selecting the Fuselage names every bay
//                under it and the zones partition the skin, so that selection
//                asks for all of it by saying so rather than by an exception.
// CAGE_ZONE_PICK what a CLICK asks the station before it asks the material.
//                Only where the material answer is useless on its own: `body`
//                is owned by the Fuselage ASSEMBLY, so "which material did I
//                strike" answers "the whole aeroplane" and the station is the
//                only thing that can narrow it. A seal is NOT in here — the
//                material still answers, because `window joints` is a real
//                part with its own rows, and clicking a bead should get you
//                to them the same way clicking a pane gets you to the window
//                ("it is still OK to get straight to the windows" — the user).
//
// THE LONGERONS DIVIDE TOO, and that reversed a ruling made one revision
// earlier. `waistband`, `ceilingLoop` and `floorLoop` are one rail each
// running the whole length of the aeroplane, and the first cut left them
// whole for exactly that reason — a rail cut at every pillar is six pieces of
// one stringer. The user's answer (and it is the better one): "the whole
// rings and longerons cause an issue. I don't think they should be directly
// selectable. The longerons should be part of either the cabin, or the
// passenger bay, or the nose, or the boom towards the tail." A rail is a
// THROUGH-RUNNING member, so pointing at one never means the rail — it means
// the bay you are pointing at. That is the difference from a SEAL, which is a
// bead round one window and can be meant on its own; the two are in different
// tables for that reason and not by accident.
//
// The glazing does not divide: a window is its own section, in one bay,
// already.
const CAGE_ZONED = new Set(['body', 'joint',
                            'waistband', 'ceilingLoop', 'floorLoop']);
const CAGE_ZONE_PICK = new Set(['body',
                                'waistband', 'ceilingLoop', 'floorLoop']);

// which part is which body zone (the other half of sectionOwner)
const zoneOwner = {};
for (const p of CAGE_PARTS) if (p.zone) zoneOwner[p.zone] = p.key;

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
              partByKey, sectionOwner, paramOwner, expertGroup, EXPERT,
              CAGE_ZONED, CAGE_ZONE_PICK, zoneOwner };

if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.CAGE_PARTS = API;

})();
