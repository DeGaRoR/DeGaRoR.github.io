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
// `when` is the tool's own relevance condition, verbatim, as source: a control
// that does not apply to the current settings is hidden rather than left to
// do nothing. Evaluated against the cowl's P by whoever renders these.
'use strict';
const COWL_ROWS = [
  // ---- Cowl body ----
  { id: 'g_body', name: 'Cowl body', rows: [
    // Barrel
    { k: 'cowlLen', label: 'Length from firewall', lo: 0.05, hi: 2, step: 0.005 },
    { k: 'aftW', label: 'Half-width at firewall', lo: 0.15, hi: 0.9, step: 0.005 },
    { k: 'aftH', label: 'Half-height at firewall', lo: 0.15, hi: 0.9, step: 0.005 },
    { k: 'taperW', label: 'Width taper', lo: 0.3, hi: 1.15, step: 0.01 },
    { k: 'taperH', label: 'Height taper', lo: 0.3, hi: 1.15, step: 0.01 },
    // Lid
    { k: 'lidRise', label: 'Vertical offset', lo: -0.22, hi: 0.22, step: 0.002 },
    { k: 'faceRise', label: 'Face lift at end', lo: -0.12, hi: 0.12, step: 0.002 },
    { k: 'lidLen', label: 'Length', lo: 0.02, hi: 1, step: 0.005 },
    { k: 'lidShoulder', label: 'Tangent carry from barrel', lo: 0, hi: 0.92, step: 0.01 },
    { k: 'keelSweep', label: 'Bottom line sweep back into barrel', lo: 0, hi: 0.95, step: 0.01 },
    { k: 'deckSweep', label: 'Top line sweep back into barrel', lo: 0, hi: 0.95, step: 0.01 },
    { k: 'waistSweep', label: 'Waist line sweep back into barrel', lo: 0, hi: 0.95, step: 0.01 },
    { k: 'lidRound', label: 'Fullness  (cone → blunt)', lo: 0, hi: 1, step: 0.01 },
    { k: 'lidMode', label: 'End', lo: 0, hi: 1, step: 1, names: ['Independent radius', 'Matched to nose cone'] },
    { k: 'lidR', label: 'End radius', lo: 0.005, hi: 0.55, step: 0.002, when: 'P.lidMode===0' },
    { k: 'lidGap', label: 'Gap around cone', lo: 0, hi: 0.06, step: 0.001, when: 'P.lidMode===1' },
  ] },
  // ---- Section shape ----
  { id: 'g_sect', name: 'Section shape', rows: [
    { k: 'inheritStub', label: 'Cowl inherits the fuselage section', lo: 0, hi: 1, step: 1 },
    // Fuselage — master section
    { k: 'stubDeckH', label: 'Top line height', lo: 0.2, hi: 1.9, step: 0.01 },
    { k: 'stubWaist', label: 'Waist line height', lo: -0.85, hi: 0.85, step: 0.01 },
    { k: 'stubKeelH', label: 'Bottom line depth', lo: 0.2, hi: 1.9, step: 0.01 },
    { k: 'stubSqTop', label: 'Upper faces  (straight → flat)', lo: 0, hi: 1, step: 0.01 },
    { k: 'stubSqBot', label: 'Lower faces  (straight → flat)', lo: 0, hi: 1, step: 0.01 },
    { k: 'deckH', label: 'Top line height', lo: 0.2, hi: 1.9, step: 0.01 },
    { k: 'waist', label: 'Waist line height', lo: -0.85, hi: 0.85, step: 0.01 },
    { k: 'keelH', label: 'Bottom line depth', lo: 0.2, hi: 1.9, step: 0.01 },
    { k: 'sqAftTop', label: 'Upper faces  (straight → flat)', lo: 0, hi: 1, step: 0.01 },
    { k: 'sqAftBot', label: 'Lower faces  (straight → flat)', lo: 0, hi: 1, step: 0.01 },
    // Barrel end
    { k: 'sqFrontTop', label: 'Upper faces', lo: 0, hi: 1, step: 0.01 },
    { k: 'sqFrontBot', label: 'Lower faces', lo: 0, hi: 1, step: 0.01 },
    // Lid
    { k: 'lidSqTop', label: 'Upper faces', lo: 0, hi: 1, step: 0.01 },
    { k: 'lidSqBot', label: 'Lower faces', lo: 0, hi: 1, step: 0.01 },
  ] },
  // ---- Mesh ----
  { id: 'g_mesh', name: 'Mesh', rows: [
    { k: 'detail', label: 'Detail', lo: 0.35, hi: 2, step: 0.05 },
  ] },
  // ---- Panel seam ----
  { id: 'g_seam', name: 'Panel seam', rows: [
    { k: 'seamOn', label: 'Panel seam', lo: 0, hi: 1, step: 1 },
    { k: 'seamType', label: 'Joint', lo: 0, hi: 1, step: 1, names: ['Groove', 'Step — face panel proud'] },
    { k: 'seamPos', label: 'Station along cowl', lo: 0.05, hi: 0.98, step: 0.005 },
    { k: 'seamWidth', label: 'Width', lo: 0.001, hi: 0.03, step: 0.0005 },
    { k: 'seamDepth', label: 'Depth', lo: 0.0002, hi: 0.01, step: 0.0002 },
  ] },
  // ---- Apertures ----
  { id: 'g_ap', name: 'Apertures', rows: [
    { k: 'apMode', label: 'Openings', lo: 0, hi: 3, step: 1, names: ['None', 'One, on the axis', 'Pair, cone between them', 'One + pair'] },
    { k: 'apW', label: 'Half-width', lo: 0.02, hi: 0.7, step: 0.002 },
    { k: 'apH', label: 'Half-height', lo: 0.02, hi: 0.7, step: 0.002 },
    { k: 'apSq', label: 'Squareness  (round → rect)', lo: 0, hi: 1, step: 0.01 },
    { k: 'pairX', label: 'Spacing from axis', lo: 0.03, hi: 0.55, step: 0.005 },
    { k: 'pairW', label: 'Half-width', lo: 0.012, hi: 0.3, step: 0.002 },
    { k: 'pairH', label: 'Half-height', lo: 0.012, hi: 0.3, step: 0.002 },
    // Advanced
    { k: 'apOffX', label: 'Axis offset X', lo: -0.3, hi: 0.3, step: 0.002 },
    { k: 'apOffY', label: 'Axis offset Y', lo: -0.3, hi: 0.3, step: 0.002 },
    { k: 'pairY', label: 'Pair height offset', lo: -0.25, hi: 0.25, step: 0.002 },
    { k: 'pairSq', label: 'Pair squareness', lo: 0, hi: 1, step: 0.01 },
  ] },
  // ---- Lip ----
  { id: 'g_lip', name: 'Lip', rows: [
    { k: 'lipMode', label: 'Edge', lo: 0, hi: 1, step: 1, names: ['Plain cut (thickness only)', 'Rolled lip'] },
    { k: 'lipThick', label: 'Skin thickness', lo: 0.004, hi: 0.06, step: 0.001 },
    { k: 'lipDepth', label: 'Roll depth', lo: 0, hi: 0.35, step: 0.002, when: 'P.lipMode===1' },
    { k: 'ductLen', label: 'Inner duct length', lo: 0, hi: 0.5, step: 0.005 },
    // Advanced
    { k: 'lipProtrude', label: 'Leading-edge protrusion', lo: 0, hi: 1.5, step: 0.02, when: 'P.lipMode===1' },
    { k: 'lipInset', label: 'Throat inset', lo: 0, hi: 0.2, step: 0.002, when: 'P.lipMode===1' },
    { k: 'lipRound', label: 'Roll fullness', lo: 0, hi: 1, step: 0.01, when: 'P.lipMode===1' },
    { k: 'ductFlare', label: 'Duct flare', lo: -0.4, hi: 0.4, step: 0.01 },
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
  // ---- Bulges & cut-out ----
  { id: 'g_lobe', name: 'Bulges & cut-out', rows: [
    { k: 'lobeN', label: 'Bulge count', lo: 0, hi: 2, step: 1 },
    { k: 'lobeAmp', label: 'Amount', lo: 0, hi: 0.16, step: 0.002, when: 'P.lobeN>0' },
    { k: 'lobeT', label: 'Station along cowl', lo: 0, hi: 1, step: 0.01, when: 'P.lobeN>0' },
    { k: 'cutSpan', label: 'Cut-out span (horseshoe)', lo: 0, hi: 200, step: 1 },
    // Advanced
    { k: 'lobeAz', label: 'Bulge azimuth', lo: -90, hi: 90, step: 1, when: 'P.lobeN>0' },
    { k: 'lobeSig', label: 'Bulge angular spread', lo: 8, hi: 70, step: 1, when: 'P.lobeN>0' },
    { k: 'lobeTSig', label: 'Bulge lengthwise spread', lo: 0.05, hi: 0.6, step: 0.01, when: 'P.lobeN>0' },
    { k: 'cutAz', label: 'Cut-out azimuth', lo: 0, hi: 359, step: 1, when: 'P.cutSpan>0' },
  ] },
  // ---- Chin scoop ----
  { id: 'g_scoop', name: 'Chin scoop', rows: [
    { k: 'scoopOn', label: 'Chin scoop', lo: 0, hi: 1, step: 1 },
    { k: 'scoopLen', label: 'Length', lo: 0.05, hi: 0.8, step: 0.01 },
    { k: 'scoopW', label: 'Half-width', lo: 0.03, hi: 0.3, step: 0.005 },
    { k: 'scoopH', label: 'Half-height', lo: 0.02, hi: 0.2, step: 0.002 },
    { k: 'scoopSq', label: 'Angularity  (round → box)', lo: 0, hi: 1, step: 0.01 },
    { k: 'scoopLipH', label: 'Lip height', lo: 0.002, hi: 0.05, step: 0.001 },
    // Advanced
    { k: 'scoopDrop', label: 'Drop below axis', lo: 0.2, hi: 1.2, step: 0.02 },
    { k: 'scoopRake', label: 'Mouth rake', lo: 0, hi: 1.2, step: 0.02 },
    { k: 'scoopAp', label: 'Mouth opening', lo: 0.2, hi: 0.95, step: 0.02 },
    { k: 'scoopLipDepth', label: 'Lip roll depth', lo: 0, hi: 0.15, step: 0.002 },
    { k: 'scoopDuct', label: 'Inner duct length', lo: 0, hi: 0.3, step: 0.005 },
  ] },
  // ---- Fasteners, parting line, oil door ----
  { id: 'g_fast', name: 'Fasteners & access', rows: [
    { k: 'fastOn', label: 'Camloc fasteners', lo: 0, hi: 1, step: 1 },
    { k: 'fastPitch', label: 'Fastener pitch', lo: 0.05, hi: 0.30, step: 0.005 },
    { k: 'fastD', label: 'Head diameter', lo: 0.008, hi: 0.030, step: 0.001 },
    { k: 'partOn', label: 'Parting line', lo: 0, hi: 1, step: 1 },
    { k: 'partY', label: 'Parting line height  (waist -> deck)', lo: -0.9, hi: 0.9, step: 0.02 },
    { k: 'partW', label: 'Parting line width', lo: 0.001, hi: 0.006, step: 0.0002 },
    { k: 'oilOn', label: 'Oil door', lo: 0, hi: 1, step: 1 },
    { k: 'oilZ', label: 'Oil door station', lo: 0.05, hi: 0.95, step: 0.01 },
    { k: 'oilW', label: 'Oil door width', lo: 0.05, hi: 0.30, step: 0.005 },
    { k: 'oilL', label: 'Oil door length', lo: 0.05, hi: 0.35, step: 0.005 },
  ] },
  // ---- Aft termination ----
  { id: 'g_aft', name: 'Aft termination', rows: [
    { k: 'aftMode', label: 'Termination', lo: 0, hi: 1, step: 1, names: ['Blend into fuselage', 'Nacelle tail cone'] },
    { k: 'stubLen', label: 'Fuselage stub length', lo: 0.2, hi: 2, step: 0.02, when: 'P.aftMode===0' },
    { k: 'tailLen', label: 'Tail cone length', lo: 0.4, hi: 3, step: 0.02, when: 'P.aftMode===1' },
    // Advanced
    { k: 'tailDrop', label: 'Tail cone droop', lo: -0.2, hi: 0.2, step: 0.005, when: 'P.aftMode===1' },
    { k: 'pylon', label: 'Pylon + wing stub', lo: 0, hi: 1, step: 1, when: 'P.aftMode===1' },
  ] },
];

if (typeof module !== 'undefined') module.exports = { COWL_ROWS };
if (typeof window !== 'undefined') window.COWL_ROWS = COWL_ROWS;
