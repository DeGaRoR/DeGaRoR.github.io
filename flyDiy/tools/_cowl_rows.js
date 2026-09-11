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
  // ---- Nose bowl ----
  { id: 'g_bowl', name: 'Nose bowl', rows: [
    { k: 'lidLen', label: 'length, barrel end → nose ring', lo: 0.02, hi: 1, step: 0.005 },
    { k: 'lidShoulder', label: 'carries the barrel line (bend late)', lo: 0, hi: 0.92, step: 0.01 },
    { k: 'lidRound', label: 'fullness (cone → blunt)', lo: 0, hi: 1, step: 0.01 },
    { k: 'faceRise', label: 'axis lift, barrel end → nose ring', lo: -0.12, hi: 0.12, step: 0.002 },
    // the bowl's curve can reach back INTO the barrel, per line: 0 = the
    // line runs straight to the barrel end, 0.95 = it starts bending almost
    // at the firewall
    { k: 'deckSweep', label: 'top line bends from (barrel end → firewall)', lo: 0, hi: 0.95, step: 0.01 },
    { k: 'keelSweep', label: 'bottom line bends from (barrel end → firewall)', lo: 0, hi: 0.95, step: 0.01 },
    // a line at the axis has nothing to bend: the widest line's own sweep
    // means something only once the widest line is off the axis
    { k: 'waistSweep', label: 'widest line bends from (barrel end → firewall)', lo: 0, hi: 0.95, step: 0.01,
      when: 'Math.abs(P.waist)>0.005' },
    { k: 'lidMode', label: 'nose ring', lo: 0, hi: 1, step: 1, names: ['its own radius', 'matched to the spinner'] },
    { k: 'lidR', label: 'nose ring radius', lo: 0.005, hi: 0.55, step: 0.002, when: 'P.lidMode===0' },
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
    { k: 'lobeN', label: 'cheeks (bulges over the cylinder heads)', lo: 0, hi: 2, step: 1 },
    { k: 'lobeAmp', label: 'cheek height', lo: 0, hi: 0.16, step: 0.002, when: 'P.lobeN>0' },
    { k: 'lobeT', label: 'cheek station (firewall → nose ring)', lo: 0, hi: 1, step: 0.01, when: 'P.lobeN>0' },
    { k: 'lobeAz', label: 'cheek azimuth (0 = the flanks)', lo: -90, hi: 90, step: 1, when: 'P.lobeN>0' },
    { k: 'lobeSig', label: 'cheek spread round the section', lo: 8, hi: 70, step: 1, when: 'P.lobeN>0' },
    { k: 'lobeTSig', label: 'cheek spread along the cowl', lo: 0.05, hi: 0.6, step: 0.01, when: 'P.lobeN>0' },
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
  // ---- Chin scoop ----
  { id: 'g_scoop', name: 'Chin scoop', rows: [
    { k: 'scoopOn', label: 'chin scoop', lo: 0, hi: 1, step: 1 },
    // 2026-09-05 (TURBOPROP §7): where along the cowl the scoop sits —
    // 0 is the lip (every cowl drawn before this row), 1 is the firewall,
    // which is where a PT6 breathes
    { k: 'scoopZ', label: 'station (nose ring → firewall)', lo: 0, hi: 1, step: 0.01, when: 'P.scoopOn>0' },
    { k: 'scoopLen', label: 'length', lo: 0.05, hi: 0.8, step: 0.01, when: 'P.scoopOn>0' },
    { k: 'scoopW', label: 'half-width', lo: 0.03, hi: 0.3, step: 0.005, when: 'P.scoopOn>0' },
    { k: 'scoopH', label: 'half-height', lo: 0.02, hi: 0.2, step: 0.002, when: 'P.scoopOn>0' },
    { k: 'scoopSq', label: 'angularity (round → box)', lo: 0, hi: 1, step: 0.01, when: 'P.scoopOn>0' },
    { k: 'scoopDrop', label: 'drop below the axis', lo: 0.2, hi: 1.2, step: 0.02, when: 'P.scoopOn>0' },
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
    { k: 'noseOff', label: 'Base from cowl end', lo: -0.35, hi: 0.4, step: 0.005 },
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
    { k: 'stubLen', label: 'Fuselage stub length', lo: 0.2, hi: 2, step: 0.02, when: 'P.aftMode===0' },
    { k: 'tailLen', label: 'tail cone length', lo: 0.4, hi: 3, step: 0.02, when: 'P.aftMode===1' },
    // Advanced
    { k: 'tailDrop', label: 'tail cone droop', lo: -0.2, hi: 0.2, step: 0.005, when: 'P.aftMode===1' },
    { k: 'pylon', label: 'Pylon + wing stub', lo: 0, hi: 1, step: 1, when: 'P.aftMode===1' },
  ] },
];

if (typeof module !== 'undefined') module.exports = { COWL_ROWS };
if (typeof window !== 'undefined') window.COWL_ROWS = COWL_ROWS;
