// COWL PANEL ROWS — the tool's OWN panel, extracted from
// cowl-generator-v19.html, not retyped. Every slider, toggle and dropdown it
// declares, with that control's label, range and visibility condition.
//
// This file exists because hand-picking the list lost things silently: three
// keys typed from memory ('apY', 'apSpread', 'apN') are not parameters of the
// tool at all, so the aperture offsets and most of the chin scoop simply never
// appeared, and an unknown key produces no row and no error. Extracted, the
// panel cannot drift from the generator it drives.
//
// `when` is the row's relevance condition, as source over the cowl's own P: a
// control that does not apply to the current settings is hidden rather than
// left to do nothing. Evaluated against the cowl's P by whoever renders these
// (the bench against COWL_GEN.P directly, the game's inspector against the
// panel's `cw_` copy — _cage_cowl.js compiles both).
//
// THE ANATOMY, AND THE GROUPS FOLLOW IT (G213, the user: "lots of sliders do
// nothing, are confusing, wrongly grouped ... we probably need proper
// terminology for the different parts of the cowl for unambiguous
// groupings"). A cowl, from the back forward:
//
//   FIREWALL      the aft edge — the fuselage's engine face. Its size is the
//                 fuselage's whenever the cowl is fitted or sealed to it, and
//                 the edge itself is a FOLD: the skin rolls back on itself and
//                 returns a couple of centimetres inside, because this is the
//                 one edge of the cowl a pilot looks straight at.
//   BARREL        the straight, tapering panel from the firewall forward.
//   NOSE BOWL     the curved forward piece that closes the barrel down onto
//                 the NOSE RING — the opening the spinner sits in.
//   SECTION       the cross-section shape, set at three stations: the
//                 firewall, the barrel end and the nose ring. Each half (top,
//                 bottom) has its own squareness; the firewall's also sets
//                 how high the TOP LINE, the BOTTOM LINE and the WIDEST LINE
//                 (the tool's deck, keel and waist) sit.
//   CHEEKS        the bulges over the cylinder heads (the tool's lobes);
//                 and the horseshoe CUT-OUT of an old open-cylinder cowl.
//   INLETS        the cooling openings cut in the nose bowl, and their LIP.
//   CHIN SCOOP    the carburettor / oil-cooler scoop under the nose.
//   PANEL JOINT   the seam where the nose bowl meets the barrel panels.
//   SPLIT LINE    where the upper and lower cowl halves part, with camlocs.
//   OIL DOOR      the little door on the top deck you check the oil through.
//   NACELLE       the tail cone that closes a cowl standing off the body.
//
// The tool's own "stub fuselage" section rows (inheritStub, stubDeckH,
// stubWaist, stubKeelH, stubSqTop, stubSqBot) are NOT here: they shape the
// bench's stand-in fuselage, which the aeroplane replaces, and _cage_cowl.js
// forces inheritStub off — so on the aeroplane they moved nothing. Their
// values still live in COWL_GEN.P for the bench's own use.
'use strict';
const COWL_ROWS = [
  // ---- Firewall lip ----
  // Aft to forward, the anatomy starts at the FIREWALL, and its own edge is
  // the first thing on the list. Millimetre ranges on purpose: this is a
  // folded sheet-metal edge a hand's breadth from the windscreen, not a
  // styling curve, and every value here is a dimension a real cowl has.
  { id: 'g_fire', name: 'Firewall lip', rows: [
    { k: 'fwLipOn', label: 'folded edge at the firewall', lo: 0, hi: 1, step: 1 },
    { k: 'fwLipR', label: 'fold radius', lo: 0.0015, hi: 0.014, step: 0.0005, when: 'P.fwLipOn>0' },
    { k: 'fwLipRise', label: 'lap over the fuselage skin', lo: 0, hi: 0.016, step: 0.0005, when: 'P.fwLipOn>0' },
    { k: 'fwLipIn', label: 'inner return (how deep you see)', lo: 0.004, hi: 0.08, step: 0.002, when: 'P.fwLipOn>0' },
  ] },
  // ---- Barrel ----
  { id: 'g_barrel', name: 'Barrel', rows: [
    { k: 'cowlLen', label: 'length, firewall → barrel end', lo: 0.05, hi: 2, step: 0.005 },
    { k: 'aftW', label: 'half-width at the firewall', lo: 0.15, hi: 0.9, step: 0.005 },
    { k: 'aftH', label: 'half-height at the firewall', lo: 0.15, hi: 0.9, step: 0.005 },
    // hi 1.15 -> 1.30 (2026-09-04): a big boxer's heads need a cowl that
    // bulges past its firewall — see COWL_TAPER_HI in _cage_cowl.js
    { k: 'taperW', label: 'width at the barrel end (× firewall)', lo: 0.3, hi: 1.15, step: 0.01 },
    { k: 'taperH', label: 'height at the barrel end (× firewall)', lo: 0.3, hi: 1.15, step: 0.01 },
    // spineY: the axis climbs linearly over the BARREL to lidRise, then on
    // over the nose bowl by faceRise — so this is the barrel's rise, whatever
    // the tool's key says
    { k: 'lidRise', label: 'axis rise, firewall → barrel end', lo: -0.22, hi: 0.22, step: 0.002 },
  ] },
  // ---- PROPER-COWLS: the side gills (the Carbon Cub's) ----
  { id: 'g_gill', name: 'Side gills', rows: [
    { k: 'gillOn', label: 'side gills (a raised panel of slanted slots, each flank)', lo: 0, hi: 1, step: 1 },
    { k: 'gillN', label: 'slots', lo: 2, hi: 12, step: 1, when: 'P.gillOn>0' },
    { k: 'gillZ', label: 'station (in the clear band, aft → forward)', lo: 0, hi: 1, step: 0.01, when: 'P.gillOn>0' },
    { k: 'gillL', label: 'panel length (m)', lo: 0.06, hi: 0.5, step: 0.005, when: 'P.gillOn>0' },
    { k: 'gillH', label: 'panel height (m)', lo: 0.04, hi: 0.3, step: 0.005, when: 'P.gillOn>0' },
    { k: 'gillSlant', label: 'slant (deg, the top leaning aft)', lo: -45, hi: 45, step: 1, when: 'P.gillOn>0' },
    { k: 'gillLip', label: 'hood height (m)', lo: 0.003, hi: 0.03, step: 0.0005, when: 'P.gillOn>0' },
    { k: 'gillT', label: 'panel thickness (m)', lo: 0.0015, hi: 0.012, step: 0.0005, when: 'P.gillOn>0' },
  ] },
  // ---- PROPER-COWLS: the way out at the bottom of the aft edge ----
  { id: 'g_exit', name: 'Air and exhaust exit', rows: [
    { k: 'exitGap', label: 'bottom lowered under the firewall\'s (m)', lo: 0, hi: 0.08, step: 0.002 },
    { k: 'exitHold', label: 'held to the bottom\'s bend (else tilts back up over the length)', lo: 0, hi: 1, step: 1, when: 'P.exitGap>0' },
    { k: 'exitLen', label: 'tilts back up over (x the cowl length)', lo: 0.1, hi: 0.9, step: 0.01, when: 'P.exitGap>0&&!P.exitHold' },
    { k: 'exCut', label: 'exhaust way out', lo: 0, hi: 2, step: 1, names: ['none', 'a cut in the aft edge', 'a faired ramp'] },
    { k: 'exRampH', label: 'ramp depth at the aft edge (m)', lo: 0.01, hi: 0.12, step: 0.002, when: 'P.exCut===2' },
    { k: 'exCutSpan', label: 'cut width (deg)', lo: 10, hi: 140, step: 1, when: 'P.exCut>0' },
    { k: 'exCutLen', label: 'cut depth from the firewall (m)', lo: 0.02, hi: 0.4, step: 0.005, when: 'P.exCut>0' },
    { k: 'exCutAz', label: 'cut azimuth (270 = the bottom)', lo: 180, hi: 360, step: 1, when: 'P.exCut>0' },
  ] },
  // ---- Nose bowl ----
  { id: 'g_bowl', name: 'Nose bowl', rows: [
    { k: 'lidLen', label: 'length, barrel end → nose ring', lo: 0.02, hi: 1, step: 0.005 },
    { k: 'lidShoulder', label: 'carries the barrel line (bend late)', lo: 0, hi: 0.92, step: 0.01 },
    { k: 'lidRound', label: 'fullness (cone → blunt)', lo: 0, hi: 1, step: 0.01 },
    // PROPER-COWLS: +-0.25 (was 0.12) - a straight cowl puts a Cessna's or a Rotax's thrust line in its face
    { k: 'faceRise', label: 'axis lift, barrel end → nose ring', lo: -0.25, hi: 0.25, step: 0.002 },
    // PROPER-COWLS: the lift moves the ring round the spinner only, the lip keeps the barrel's lines (absent = 0)
    { k: 'faceRing', label: 'lift the ring only (the lip stays on the barrel)', lo: 0, hi: 1, step: 1 },
    // the bowl's curve can reach back INTO the barrel, per line: 0 = the
    // line runs straight to the barrel end, 0.95 = it starts bending almost
    // at the firewall
    { k: 'deckSweep', label: 'top line bends from (barrel end → firewall)', lo: 0, hi: 0.95, step: 0.01 },
    { k: 'keelSweep', label: 'bottom line bends from (barrel end → firewall)', lo: 0, hi: 0.95, step: 0.01 },
    // PROPER-COWLS V4: the bottom's own bend (absent = the bowl's shoulder and fullness)
    { k: 'keelShoulder', label: 'bottom line: carries the barrel (bend late)', lo: 0, hi: 0.92, step: 0.01 },
    { k: 'keelRound', label: 'bottom line: fullness (cone → round)', lo: 0, hi: 1, step: 0.01 },
    // PROPER-COWLS V5: the top line's own bend (absent = the bowl's pair)
    { k: 'deckShoulder', label: 'top line: carries the barrel (bend late)', lo: 0, hi: 0.92, step: 0.01 },
    { k: 'deckRound', label: 'top line: fullness (cone → round)', lo: 0, hi: 1, step: 0.01 },
    // a line at the axis has nothing to bend: the widest line's own sweep
    // means something only once the widest line is off the axis
    { k: 'waistSweep', label: 'widest line bends from (barrel end → firewall)', lo: 0, hi: 0.95, step: 0.01,
      when: 'Math.abs(P.waist)>0.005' },
    { k: 'lidMode', label: 'nose ring', lo: 0, hi: 1, step: 1, names: ['its own radius', 'matched to the spinner'] },
    { k: 'lidR', label: 'nose ring radius', lo: 0.005, hi: 0.55, step: 0.002, when: 'P.lidMode===0' },
    // PROPER-COWLS: the ring's own shape - a flat face as tall as an inverted engine's block (follow = the round ring)
    { k: 'lidRW', label: 'nose ring half-width', lo: 0.004, hi: 0.8, step: 0.002 },
    { k: 'lidRTop', label: 'nose ring reach above the propeller', lo: 0.004, hi: 0.8, step: 0.002 },
    { k: 'lidRBot', label: 'nose ring reach below the propeller', lo: 0.004, hi: 0.8, step: 0.002 },
    { k: 'lidGap', label: 'gap round the spinner', lo: 0, hi: 0.06, step: 0.001, when: 'P.lidMode===1' },
  ] },
  // ---- The section, station by station ----
  // Squareness is the superellipse exponent, on the same 0..1 the apertures,
  // the scoop and the oil door speak: 0 a diamond, 0.5 a true ellipse, 1 a
  // rounded rectangle (sqExp).
  { id: 'g_secFire', name: 'Section at the firewall', rows: [
    { k: 'deckH', label: 'top line height (× half-height)', lo: 0.2, hi: 1.9, step: 0.01 },
    { k: 'keelH', label: 'bottom line depth (× half-height)', lo: 0.2, hi: 1.9, step: 0.01 },
    { k: 'waist', label: 'widest line height (bottom → top)', lo: -0.85, hi: 0.85, step: 0.01 },
    // CABIN-CRAFT (2026-11-02): the width at the top line and at the bottom line, × the width at the widest line
    // (`aftW`) - a cabin that tightens at the roof. Absent = 1 (the rounded rectangle); see wAftTop in _cowl_gen.js
    // PROPER-COWLS: the widest line's height at the barrel end (x the front's half-height); absent = follows `waist`
    { k: 'waistF', label: 'widest line height at the barrel end', lo: -0.85, hi: 0.85, step: 0.01 },
    { k: 'wAftTop', label: 'width at the top line (× widest)', lo: 0.4, hi: 1.3, step: 0.01 },
    { k: 'wAftBot', label: 'width at the bottom line (× widest)', lo: 0.4, hi: 1.3, step: 0.01 },
    { k: 'sqAftTop', label: 'top half (diamond · round · square)', lo: 0, hi: 1, step: 0.01 },
    { k: 'sqAftBot', label: 'bottom half (diamond · round · square)', lo: 0, hi: 1, step: 0.01 },
  ] },
  { id: 'g_secBarrel', name: 'Section at the barrel end', rows: [
    { k: 'sqFrontTop', label: 'top half (diamond · round · square)', lo: 0, hi: 1, step: 0.01 },
    { k: 'sqFrontBot', label: 'bottom half (diamond · round · square)', lo: 0, hi: 1, step: 0.01 },
  ] },
  { id: 'g_secRing', name: 'Section at the nose ring', rows: [
    { k: 'lidSqTop', label: 'top half (diamond · round · square)', lo: 0, hi: 1, step: 0.01 },
    { k: 'lidSqBot', label: 'bottom half (diamond · round · square)', lo: 0, hi: 1, step: 0.01 },
  ] },
  // ---- Mesh ----
  { id: 'g_mesh', name: 'Mesh', rows: [
    { k: 'detail', label: 'Detail', lo: 0.35, hi: 2, step: 0.05 },
  ] },
  // ---- Cheeks & cut-out ----
  { id: 'g_lobe', name: 'Cheeks & cut-out', rows: [
    // PROPER-COWLS: 3-14 = a helmet over each cylinder of a radial (lobeAz the first one's azimuth)
    { k: 'lobeN', label: 'cheeks (bulges over the cylinder heads; 3+ = one per radial cylinder)', lo: 0, hi: 14, step: 1 },
    { k: 'lobeAmp', label: 'cheek height', lo: 0, hi: 0.16, step: 0.002, when: 'P.lobeN>0' },
    { k: 'lobeT', label: 'cheek station (firewall → nose ring)', lo: 0, hi: 1, step: 0.01, when: 'P.lobeN>0' },
    { k: 'lobeAz', label: 'cheek azimuth (0 = the flanks)', lo: -90, hi: 360, step: 1, when: 'P.lobeN>0' },
    { k: 'lobeSig', label: 'cheek spread round the section', lo: 8, hi: 70, step: 1, when: 'P.lobeN>0' },
    { k: 'lobeTSig', label: 'cheek spread along the cowl', lo: 0.05, hi: 0.6, step: 0.01, when: 'P.lobeN>0' },
    // a two-row radial: every other helmet on the rear row's station, and the places the engine leaves bare
    { k: 'lobeT2', label: 'helmets: every other one\'s station (a two-row radial)', lo: 0, hi: 1, step: 0.01, when: 'P.lobeN>=3' },
    { k: 'lobeCount', label: 'helmets drawn (0 = one per place)', lo: 0, hi: 14, step: 1, when: 'P.lobeN>=3' },
    // streamlined: full over the head, a short rise in front, a long taper behind, stopping inside the cowl
    { k: 'lobeStream', label: 'cheeks streamlined (long taper aft)', lo: 0, hi: 1, step: 1, when: 'P.lobeN>0' },
    { k: 'lobeNose', label: 'streamlined: where the front ends', lo: 0.3, hi: 1, step: 0.01, when: 'P.lobeN>0&&P.lobeStream>0' },
    { k: 'lobeTail', label: 'streamlined: where the tail ends', lo: 0, hi: 0.7, step: 0.01, when: 'P.lobeN>0&&P.lobeStream>0' },
    { k: 'cutSpan', label: 'cut-out span (horseshoe)', lo: 0, hi: 200, step: 1 },
    { k: 'cutAz', label: 'cut-out azimuth', lo: 0, hi: 359, step: 1, when: 'P.cutSpan>0' },
  ] },
  // ---- Inlets ----
  { id: 'g_ap', name: 'Inlets', rows: [
    { k: 'apMode', label: 'inlets', lo: 0, hi: 3, step: 1, names: ['none', 'one, round the spinner', 'a pair, spinner between', 'one + a pair'] },
    { k: 'apW', label: 'half-width', lo: 0.02, hi: 0.7, step: 0.002, when: 'P.apMode===1||P.apMode===3' },
    { k: 'apH', label: 'half-height', lo: 0.02, hi: 0.7, step: 0.002, when: 'P.apMode===1||P.apMode===3' },
    { k: 'apSq', label: 'squareness (round → rect)', lo: 0, hi: 1, step: 0.01, when: 'P.apMode===1||P.apMode===3' },
    { k: 'apOffX', label: 'off the axis, sideways', lo: -0.3, hi: 0.3, step: 0.002, when: 'P.apMode===1||P.apMode===3' },
    { k: 'apOffY', label: 'off the axis, up / down', lo: -0.3, hi: 0.3, step: 0.002, when: 'P.apMode===1||P.apMode===3' },
    { k: 'pairX', label: 'pair: spacing from the axis', lo: 0.03, hi: 0.55, step: 0.005, when: 'P.apMode>=2' },
    { k: 'pairW', label: 'pair: half-width', lo: 0.012, hi: 0.3, step: 0.002, when: 'P.apMode>=2' },
    { k: 'pairH', label: 'pair: half-height', lo: 0.012, hi: 0.3, step: 0.002, when: 'P.apMode>=2' },
    { k: 'pairY', label: 'pair: up / down', lo: -0.25, hi: 0.25, step: 0.002, when: 'P.apMode>=2' },
    { k: 'pairSq', label: 'pair: squareness (round → rect)', lo: 0, hi: 1, step: 0.01, when: 'P.apMode>=2' },
  ] },
  // ---- Inlet lip ----
  { id: 'g_lip', name: 'Inlet lip', rows: [
    { k: 'lipMode', label: 'edge', lo: 0, hi: 1, step: 1, names: ['plain cut (thickness only)', 'rolled lip'] },
    { k: 'lipThick', label: 'skin thickness', lo: 0.004, hi: 0.06, step: 0.001 },
    { k: 'lipDepth', label: 'roll depth', lo: 0, hi: 0.35, step: 0.002, when: 'P.lipMode===1' },
    { k: 'lipRound', label: 'roll fullness', lo: 0, hi: 1, step: 0.01, when: 'P.lipMode===1' },
    { k: 'lipProtrude', label: 'roll stands proud of the face', lo: 0, hi: 1.5, step: 0.02, when: 'P.lipMode===1' },
    { k: 'lipInset', label: 'throat inset', lo: 0, hi: 0.2, step: 0.002, when: 'P.lipMode===1' },
    { k: 'ductLen', label: 'duct length inside', lo: 0, hi: 0.5, step: 0.005 },
    { k: 'ductFlare', label: 'duct flare', lo: -0.4, hi: 0.4, step: 0.01 },
  ] },
  // ---- Chin scoop (or a top one) ----
  { id: 'g_scoop', name: 'Chin scoop', rows: [
    { k: 'scoopOn', label: 'chin scoop', lo: 0, hi: 1, step: 1 },
    // ENGINE-COOLING (12 Nov): the same scoop on the cowl's top (absent 0: under it, as every scoop was)
    { k: 'scoopTop', label: 'sits', lo: 0, hi: 1, step: 1, names: ['under the cowl (a chin scoop)', 'on top of the cowl'], when: 'P.scoopOn>0' },
    // ENGINE-COOLING 3: a push-pull's AFT cowl (the nose cowl turned round) with its scoop turned on its own (absent 0)
    { k: 'scoopAft', label: 'the rear engine\'s scoop (push-pull)', lo: 0, hi: 1, step: 1, names: ['as the nose cowl\'s', 'turned: into the air'], when: 'P.scoopOn>0' },
    // ENGINE-COOLING (12 Nov): the mouth turned round - on a pusher the cowl runs from the firewall to the propeller, so
    // only a turned scoop faces the air (absent 0: every scoop as it was)
    { k: 'scoopRev', label: 'mouth faces', lo: 0, hi: 1, step: 1, names: ['the propeller', 'the firewall (a pusher: into the air)'], when: 'P.scoopOn>0' },
    // PROPER-COWLS V5: the scoop rides the keel (absent 0)
    { k: 'scoopFollow', label: 'rides the bottom line', lo: 0, hi: 1, step: 1, when: 'P.scoopOn>0' },
    // 2026-09-05 (TURBOPROP §7): where along the cowl the scoop sits —
    // 0 is the lip (every cowl drawn before this row), 1 is the firewall,
    // which is where a PT6 breathes
    { k: 'scoopZ', label: 'station (nose ring → firewall)', lo: 0, hi: 1, step: 0.01, when: 'P.scoopOn>0' },
    // (11 Nov, FIT-PROCEDURE: the PC-6's chin runs the whole cowl, 2 m, and is nearly as wide as it - the ranges reach
    // it; a range widening, nothing drawn moves)
    { k: 'scoopLen', label: 'length', lo: 0.05, hi: 2.2, step: 0.01, when: 'P.scoopOn>0' },
    { k: 'scoopW', label: 'half-width', lo: 0.03, hi: 0.6, step: 0.005, when: 'P.scoopOn>0' },
    { k: 'scoopH', label: 'half-height', lo: 0.02, hi: 0.3, step: 0.002, when: 'P.scoopOn>0' },
    // (11 Nov) the share of the length held at the FULL section, from the mouth aft (0 = the taper it always had)
    { k: 'scoopHold', label: 'full section held (share of the length)', lo: 0, hi: 1, step: 0.01, when: 'P.scoopOn>0' },
    // (12 Nov) the half-width as a share of the cowl's own bottom half-width at each station (0 = scoopW, fixed)
    { k: 'scoopWFit', label: 'width follows the cowl (share of its width)', lo: 0, hi: 1, step: 0.01, when: 'P.scoopOn>0' },
    // (12 Nov) the taper from the mouth to the aft end: the aft end's height / width as a share of the mouth's
    { k: 'scoopTaperH', label: 'taper: aft-end height (× the mouth)', lo: 0.2, hi: 1.5, step: 0.01, when: 'P.scoopOn>0' },
    { k: 'scoopTaperW', label: 'taper: aft-end width (× the mouth)', lo: 0.2, hi: 1.5, step: 0.01, when: 'P.scoopOn>0' },
    { k: 'scoopSq', label: 'angularity (round → box)', lo: 0, hi: 1, step: 0.01, when: 'P.scoopOn>0' },
    { k: 'scoopDrop', label: 'distance from the axis', lo: 0.2, hi: 1.2, step: 0.02, when: 'P.scoopOn>0' },
    { k: 'scoopRake', label: 'mouth rake', lo: 0, hi: 1.2, step: 0.02, when: 'P.scoopOn>0' },
    { k: 'scoopAp', label: 'mouth opening', lo: 0.2, hi: 0.95, step: 0.02, when: 'P.scoopOn>0' },
    { k: 'scoopLipH', label: 'lip height', lo: 0.002, hi: 0.05, step: 0.001, when: 'P.scoopOn>0' },
    { k: 'scoopLipDepth', label: 'lip roll depth', lo: 0, hi: 0.15, step: 0.002, when: 'P.scoopOn>0' },
    { k: 'scoopDuct', label: 'duct length inside', lo: 0, hi: 0.3, step: 0.005, when: 'P.scoopOn>0' },
  ] },
  // ---- Panel joint ----
  { id: 'g_seam', name: 'Panel joint', rows: [
    { k: 'seamOn', label: 'panel joint (nose bowl / barrel)', lo: 0, hi: 1, step: 1 },
    { k: 'seamType', label: 'joint', lo: 0, hi: 1, step: 1, names: ['groove', 'step — nose bowl proud'], when: 'P.seamOn>0' },
    { k: 'seamPos', label: 'station (firewall → nose ring)', lo: 0.05, hi: 0.98, step: 0.005, when: 'P.seamOn>0' },
    { k: 'seamWidth', label: 'width', lo: 0.001, hi: 0.03, step: 0.0005, when: 'P.seamOn>0' },
    { k: 'seamDepth', label: 'depth', lo: 0.0002, hi: 0.01, step: 0.0002, when: 'P.seamOn>0' },
  ] },
  // ---- Split line ----
  // the line the upper and lower halves come apart along; it runs from the
  // firewall to the panel joint (the nose bowl is one piece) and carries the
  // camlocs that hold the halves together
  { id: 'g_part', name: 'Split line', rows: [
    { k: 'partOn', label: 'split line (upper / lower cowl)', lo: 0, hi: 1, step: 1 },
    { k: 'partY', label: 'height (widest line → top line)', lo: -0.9, hi: 0.9, step: 0.02, when: 'P.partOn>0' },
    { k: 'partW', label: 'width', lo: 0.001, hi: 0.006, step: 0.0002, when: 'P.partOn>0' },
    // PROPER-COWLS: held level at the firewall's height, the groove a constant width (partW, metres)
    // (partLevel: no row - the split line is always level, a fixed height and width; the user 13 Nov via A0)
    // PROPER-COWLS: the groove's width in metres on a parameter split too (0 = the old width by the section's turn)
    { k: 'partArc', label: 'groove width even (metres)', lo: 0, hi: 1, step: 1, when: 'P.partOn>0' },
  ] },
  // ---- Fasteners ----
  { id: 'g_fast', name: 'Fasteners', rows: [
    { k: 'fastOn', label: 'camlocs (firewall edge + split line)', lo: 0, hi: 1, step: 1 },
    { k: 'fastPitch', label: 'pitch', lo: 0.05, hi: 0.30, step: 0.005, when: 'P.fastOn>0' },
    { k: 'fastD', label: 'head diameter', lo: 0.008, hi: 0.030, step: 0.001, when: 'P.fastOn>0' },
  ] },
  // ---- Oil door ----
  { id: 'g_oil', name: 'Oil door', rows: [
    { k: 'oilOn', label: 'oil door (on the top deck)', lo: 0, hi: 1, step: 1 },
    { k: 'oilZ', label: 'station (firewall → nose ring)', lo: 0.05, hi: 0.95, step: 0.01, when: 'P.oilOn>0' },
    { k: 'oilW', label: 'width', lo: 0.05, hi: 0.30, step: 0.005, when: 'P.oilOn>0' },
    { k: 'oilL', label: 'length', lo: 0.05, hi: 0.35, step: 0.005, when: 'P.oilOn>0' },
    // 1 = a rounded rectangle (the shape it has always had), 0.5 = a true
    // ellipse, 0 = a diamond. Same 0..1 roundness the sections, the apertures
    // and the scoop already speak.
    { k: 'oilSq', label: 'outline (diamond · round · square)', lo: 0, hi: 1, step: 0.05, when: 'P.oilOn>0' },
  ] },
  // ---- Nose cone & shaft ----
  { id: 'g_spin', name: 'Nose cone & shaft', rows: [
    { k: 'noseOff', label: 'Base from cowl end', lo: -0.35, hi: 1.5, step: 0.005 },   // (to 1.5: the cage's prop shaft)
    { k: 'spinR', label: 'Base radius', lo: 0.04, hi: 0.35, step: 0.001 },
    { k: 'spinLen', label: 'Length', lo: 0.05, hi: 0.8, step: 0.005 },
    { k: 'spinRound', label: 'Roundness  (cone → ogive)', lo: 0, hi: 1, step: 0.01 },
    // Advanced
    { k: 'bladeStation', label: 'Blade plane on cone', lo: 0.05, hi: 0.9, step: 0.01 },
    { k: 'shaftR', label: 'Shaft radius', lo: 0.015, hi: 0.12, step: 0.001 },
    { k: 'shaftLen', label: 'Shaft length aft', lo: 0.05, hi: 0.9, step: 0.005 },
  ] },
  // ---- Propeller ----
  { id: 'g_prop', name: 'Propeller', rows: [
    { k: 'bladeN', label: 'Blades', lo: 2, hi: 6, step: 1 },
    { k: 'propD', label: 'Diameter', lo: 0.8, hi: 4.2, step: 0.01 },
    { k: 'material', label: 'Blade material', lo: 0, hi: 0, step: 1, names: ['MATERIALS.map(m=>m.name+\'  \\u00b7  \'+m.rho+\' kg/m\\u00b3\')'] },
    // Operating point
    { k: 'rpm', label: 'Cruise RPM', lo: 600, hi: 3200, step: 10 },
    { k: 'tas', label: 'Cruise TAS', lo: 60, hi: 700, step: 5 },
    { k: 'power', label: 'Engine power', lo: 40, hi: 2000, step: 5 },
    // Advanced · Planform
    { k: 'rootChord', label: 'Root chord', lo: 0.05, hi: 0.4, step: 0.005 },
    { k: 'tipChord', label: 'Tip chord', lo: 0.03, hi: 0.3, step: 0.005 },
    { k: 'chordBulge', label: 'Planform bulge', lo: 0, hi: 0.6, step: 0.01 },
    { k: 'sweep', label: 'Tip sweep', lo: -0.25, hi: 0.25, step: 0.01 },
    // Advanced · Section
    { k: 'thickRoot', label: 'Root thickness t/c', lo: 0.08, hi: 0.35, step: 0.005 },
    { k: 'thickTip', label: 'Tip thickness t/c', lo: 0.03, hi: 0.2, step: 0.005 },
    { k: 'camb', label: 'Camber', lo: 0, hi: 0.09, step: 0.002 },
    { k: 'tipRound', label: 'Tip rounding span', lo: 0.02, hi: 0.3, step: 0.005 },
    { k: 'cuff', label: 'Root cuff extent', lo: 0.05, hi: 0.5, step: 0.01 },
    { k: 'shankR', label: 'Root shank radius', lo: 0.012, hi: 0.14, step: 0.001 },
    // Advanced · Aerodynamic assumption
    { k: 'slip', label: 'Assumed slip', lo: 0, hi: 35, step: 1 },
  ] },
  // ---- Aft termination ----
  { id: 'g_aft', name: 'Nacelle', rows: [
    { k: 'aftMode', label: 'termination', lo: 0, hi: 1, step: 1, names: ['blend into the fuselage', 'nacelle tail cone'] },
    // PROPER-COWLS: a free pod houses its engine - the mount sized to the pod, no plate (absent 0: the saved plate)
    { k: 'podFit', label: 'pod houses the engine (no plate)', lo: 0, hi: 1, step: 1, when: 'P.aftMode>0' },
    { k: 'stubLen', label: 'Fuselage stub length', lo: 0.2, hi: 2, step: 0.02, when: 'P.aftMode===0' },
    { k: 'tailLen', label: 'tail cone length', lo: 0.4, hi: 4, step: 0.02, when: 'P.aftMode===1' },   // DC3-EDITABLE: the DC-3's nacelle cone, 3.35
    // Advanced
    { k: 'tailDrop', label: 'tail cone droop', lo: -0.2, hi: 0.2, step: 0.005, when: 'P.aftMode===1' },
    { k: 'pylon', label: 'Pylon + wing stub', lo: 0, hi: 1, step: 1, when: 'P.aftMode===1' },
    // G3914: the nacelle's air inlet, in the tail cone's tip (on a pusher, the nacelle's nose)
    { k: 'inletOn', label: 'air inlet (in the tail cone)', lo: 0, hi: 1, step: 1, names: ['none', 'inlet'], when: 'P.aftMode===1' },
    { k: 'inletW', label: 'inlet width (of the section)', lo: 0.12, hi: 0.85, step: 0.01, when: 'P.aftMode===1&&P.inletOn' },
    { k: 'inletH', label: 'inlet height (of the section)', lo: 0.12, hi: 0.85, step: 0.01, when: 'P.aftMode===1&&P.inletOn' },
    { k: 'inletLip', label: 'inlet lip', lo: 0.002, hi: 0.05, step: 0.001, when: 'P.aftMode===1&&P.inletOn' },
    { k: 'inletDuct', label: 'inlet duct depth', lo: 0.02, hi: 0.6, step: 0.01, when: 'P.aftMode===1&&P.inletOn' },
    { k: 'inletY', label: 'inlet up / down (of the height)', lo: -0.5, hi: 0.5, step: 0.01, when: 'P.aftMode===1&&P.inletOn' },
  ] },
];

if (typeof module !== 'undefined') module.exports = { COWL_ROWS };
if (typeof window !== 'undefined') window.COWL_ROWS = COWL_ROWS;
