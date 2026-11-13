// CAGE FLOAT LAYER — the seaplane's floats, drawn on the live cage (H2, G389;
// THE WIPLINE FLOATS, G451, 2026-09-20).
//
// WATER-2026-09-13.md §1.5 and ruling (as): "the join MEASURES the drawn
// float — planing length, beam, deadrise, step station, and the buoyant
// volume". This layer draws the float from the SAME hull generator the water
// physics runs on (src/core/32_hydro.js, `HYDRO.makeFloat`, at drawing
// resolution through tools/_float_gen.js): the mesh the builder sees and the
// panels the water pushes on are one section family, so the join has
// nothing to reconstruct — it reads the hull's parameters and WHERE the
// float stands (the step station, the keel height, the track) off the drawn
// record, and the frame (61_gen_frame) builds the float's nodes and the
// solver's hull from exactly those numbers. One source of truth, twice
// drawn.
//
// G451 — THE WIPAIRE RANGE (the user: "we'll model our procedural floats
// according to the Wipaire range of floats. Like the engines, we'll have
// presets corresponding to the Wipline line"). The hull family is the
// 2350's, the catalogue is HYDRO.FLOAT_PRESETS (fifteen rows, 1450 to
// 13000, the four measured dimensions of each honoured by the family's
// fineness fit), and `fltPreset` is a STARTER on the engine-preset pattern:
// picking a row writes the hull rows ONCE, and every one of them stays the
// builder's to edit afterwards (the row's own label says "applies once";
// a load never re-fires it — PAGE.load, GATE STARTER). The details, the
// water rudder and the paddle are FLOAT_GEN's (see its header for the list
// and the parts-manual references), sized by the hull; the water rudder is
// its own part so the game can steer and retract it.
//
// Load order: after _cage_gear.js (it stands on the same airframe contract
// and roots its struts where the gear layer's legs would), before _cage_fin.
// Chains PAGE.post like every layer. Needs FLOAT_GEN (tools/_float_gen.js,
// loaded just before this file) to draw; without it the record is still
// published (the physics needs no drawing).
//
// UNITS: metres, in the cage frame (+x port, +y up, +z forward). The hull
// generator works in the MODEL frame (x aft, y up, z right): cage =
// (-mz, my, -mx) plus the float's placement. `planeScale` reaches the
// airframe through cageAirframe as the gear layer does; the float itself is
// hardware, metric, and never scales — a float is a ruler like a wheel is.
//
// THE PLACEMENT RULE: the step goes AFT of the CG, 12 deg off the vertical
// from the CG down to the keel (the seaplane's 10-15; G382 measured a float
// with its step at the wheels' station sitting on its tail at 18 deg). The
// row `fltZ` is an OFFSET from that rule (0 = the rule), so a builder can
// slide the floats without losing the datum they were placed by.
//
// THE RIGGING, as the 2350 parts manual lists it (section 9, "struts, wires,
// steps & spreader bars"): streamlined struts a side from the two deck
// fitting stations (the front spreader bar's, at the keel flat's forward
// end, and the aft spreader bar's, just aft of the step) up to the fuselage
// flank at the family's angle — the same fitting sites the gear legs use
// (AF.surf); two SPREADER BARS of airfoil section right across both decks,
// flush with them; drag wires fore and aft on each side; cross wires between
// the bars. Drawn as members with `strutMembers` on the unit, so the join
// rides each end on its own physics node (the G179.2 contract): the frame
// builds a beam for every one of them.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const GG = window.GEAR_GEN, GK = window.GEAR_KIT, CG2 = window.CAGE2;
if (!GG || !GK) { console.error('cage float layer: gear modules not loaded'); return; }
const D2R = Math.PI / 180;
const HYc = () => window.HYDRO_GEN || (typeof HYDRO !== 'undefined' ? HYDRO : null);

// ---- the catalogue, as the row sees it ----------------------------------------
const HY0 = HYc();
const PRESET_NAMES = HY0 ? HY0.FLOAT_PRESET_NAMES.slice() : ['Wipline 2350'];
const CUSTOM = 'custom';
PRESET_NAMES.push(CUSTOM);
const CUSTOM_IDX = PRESET_NAMES.length - 1;
// FLOATS-CLASSIC: the EDO rows come AFTER `custom`, so every saved fltPreset index (a Wipline row, or custom at 15)
// still names what it named; picking one also turns the style row to the classic deck
const EDO_NAMES = HY0 && HY0.EDO_PRESET_NAMES ? HY0.EDO_PRESET_NAMES.slice() : [];
PRESET_NAMES.push(...EDO_NAMES);
const isEdo = n => EDO_NAMES.indexOf(n) >= 0;
const rowOf = n => HY0 && (HY0.FLOAT_PRESETS[n] || (HY0.EDO_PRESETS && HY0.EDO_PRESETS[n])) || null;
const PRESET_LABELS = PRESET_NAMES.map(n => {
  if (n === CUSTOM) return 'custom (the dials as they are)';
  const R = rowOf(n);
  // (FLOATS-CLASSIC: the pair's weight with rigging and its price, rigged and installed - the ledger bills it)
  const pr = HY0 && HY0.floatPrice ? HY0.floatPrice(HY0.presetParams(n)) : 0;
  return R ? `${n} — ${R.L.toFixed(2)} m, ${R.disp} kg, pair ${R.mSys} kg, ${pr.toLocaleString('en')} cr${R.est ? ' (est.)' : ''}` : n;
});

// ---- defaults ------------------------------------------------------------
// The hull rows are the family's (HYDRO.DEF) at the Wipline 1450's size —
// the smallest of the line, the one a fresh ultralight would wear; the
// preset row is a starter, so a builder who wants the 172's floats picks
// the 2350 and the rows follow. The frame's own sizing rule
// (HYDRO.floatParamsFor: a pair displaces 180 % of the gross) is what a
// spec with no drawn float still gets.
const rowsOfParams = Q => Object.assign({
  fltL: Q.L, fltStep: Q.xs / Q.L, fltB: Q.B, fltH: Q.H, fltBeta: Q.beta, fltBetaBow: Q.betaBow,
  fltBetaA: Q.betaA, fltHs: Q.hs, fltAft: Q.aftAngle, fltAftCurve: Q.aftCurve, fltFlat: Q.flatK,
  fltStem: Q.stemK, fltRake: Q.rake, fltNoseR: Q.noseR, fltPlan: Q.planK, fltStern: Q.bStern,
  fltFlare: Q.flare, fltMass: Q.mFloat,
  fltSpreadAft: +(0.28 * (Q.scale || 1)).toFixed(2),      // the aft spreader bar, just aft of the step
  // FLOATS-CLASSIC: a catalogue row says its own style (an EDO row the classic deck, a Wipline row the flat one)
  fltStyle: Q.style === 'edo' ? 1 : 0,
}, Q.style === 'edo' ? { finVentralShape: 1 } : null);   // ...and an EDO kit's ventral is the plan's vintage lobe (once, like every row here)
const DEF_ROWS = HY0 ? rowsOfParams(HY0.presetParams('Wipline 1450')) : {};
// (the preset row itself boots at `custom`: a build saved before G451 must
// not come back labelled as a catalogue row its dials never were)
Object.assign(PAGE.defaults = PAGE.defaults || {}, {
  fltPreset: CUSTOM_IDX, fltDetail: 1, fltPaddle: 1, fltRudder: 1,
  fltL: 4.60, fltStep: 0.553, fltB: 0.64, fltH: 0.50, fltBeta: 25, fltBetaBow: 48, fltBetaA: 20,
  fltHs: 0.058, fltAft: 6.9, fltAftCurve: 0.08, fltFlat: 0.29, fltStem: 0.34, fltRake: 12,
  fltNoseR: 0.17, fltPlan: 2.7, fltStern: 0.39, fltFlare: 4, fltMass: 27,
}, DEF_ROWS, {
  fltZ: 0, fltDrop: 0.55, fltInc: 0, fltTrack: 0.80, fltStrutR: 0.018, fltWires: 1,
  fltStrutAng: 55, fltFrontRing: 0, fltSpread: 1, fltSpreadAft: 0.36,
  // FLOATS-CLASSIC: 0 = the Wipline (every build saved before), 1 = the EDO-style rounded deck; the deck board (EDO)
  fltStyle: 0, fltBoard: 0,
});

const on = { when: P => +P.gearFloats };
const STYLE_NAMES = ['Wipline (flat deck)', 'EDO classic (round top)'];
const onM = { when: P => +P.gearFloats, dim: 'm' };
const GROUP = ['9b · floats', [
  // the switch itself, so a builder can reach the floats without the starter
  // (and GATE PARTS can see the feature is reachable); the wheel stations
  // are off while it is on (the join reads the flag before the contacts)
  ['gearFloats', 'floats (instead of wheels)', 0, 1, 1],
  // THE CATALOGUE (G451): a Wipline row writes the hull rows once
  ['fltPreset', 'float model (applies once)', 0, Math.max(1, PRESET_NAMES.length - 1), 1, PRESET_NAMES,
   { when: P => +P.gearFloats, optLabels: PRESET_LABELS }],
  // FLOATS-CLASSIC (the user, 3 Nov: "another model of floats. A rougher one, with rounded top ... use the same
  // controls"): the style is the deck and the bow above the water, the finish and the fittings; every row below drives both
  ['fltStyle', 'style', 0, 1, 1, STYLE_NAMES, on],
  ['fltBoard', 'deck board across the spreaders', 0, 1, 1, { when: P => +P.gearFloats && Math.round(+P.fltStyle || 0) === 1 }],
  ['fltDetail', 'details (covers, hatch, cleats, straps, bumper)', 0, 1, 1, on],
  ['fltRudder', 'water rudders', 0, 1, 1, on],
  // RETRACT-STUDY §8.25: THE AMPHIBIAN - Wipline wheels in the floats (the manufacturer's tyres and layout; the gear
  // position is the gear page's preview row, gearPos)
  // (2: the EDO style - the user's photographs and close-ups, 5 Nov: the nose leg pivots low on the bow's leading edge,
  // pushed down by a piston through a triangle, folding forward and up to hug the stem; no EDO data reached - the
  // geometry is the photographs', the tyres the same hull's Wipline row's)
  // RETRACT-LAB (SEAPLANES-LAND 7 Nov): the amphibian floats are drawn, not flown yet (no wheel reaches the spec): behind
  // the retract switch (_cage_gear.js RETRACT_LAB), still shown on a build that already has them so it can switch them off
  ['fltAmph', 'amphibian (wheels in the floats)', 0, 2, 1, ['none', 'Wipline', 'EDO style'],
   { when: P => +P.gearFloats && (+P.fltAmph > 0 || !window.CAGE_RETRACT_LAB || window.CAGE_RETRACT_LAB()) }],
  ['fltPaddle', 'paddle', 0, 2, 1, ['none', 'on the left float', 'on both floats'], on],
  ['hull', [
    ['fltL',      'length',                        2.5, 14.0, 0.01, onM],
    ['fltStep',   'step (fraction from bow)',       0.45, 0.65, 0.005, on],
    ['fltB',      'hull width (deck)',              0.40, 1.90, 0.01, onM],
    ['fltH',      'hull height (step keel to deck)', 0.30, 1.50, 0.01, onM],
    ['fltBeta',   'deadrise at the step °',         8, 40, 0.5, on],
    ['fltBetaBow','deadrise at the bow °',          20, 65, 0.5, on],
    ['fltBetaA',  'deadrise (afterbody) °',         8, 35, 0.5, on],
    ['fltHs',     'step depth',                     0.02, 0.15, 0.002, onM],
    ['fltAft',    'afterbody keel °',               3, 12, 0.1, on],
    ['fltAftCurve','afterbody keel curve',          0, 0.25, 0.005, on],
    ['fltFlat',   'keel flat (fraction of forebody)', 0.10, 0.60, 0.01, on],
    ['fltStem',   'stem height (fraction of H)',    0.10, 0.60, 0.01, on],
    ['fltRake',   'stem rake °',                    0, 30, 0.5, on],
    ['fltNoseR',  'nose round (fraction of H)',     0.05, 0.40, 0.01, on],
    ['fltPlan',   'plan fullness',                  1.2, 4.0, 0.05, on],
    ['fltStern',  'stern beam ×',                   0.20, 0.80, 0.01, on],
    ['fltFlare',  'side flare °',                   0, 12, 0.5, on],
    ['fltMass',   'hull mass (each)',               10, 1200, 1, { when: P => +P.gearFloats, dim: 'kg' }],
  ], on],
  ['placement', [
    ['fltZ',     'step fore / aft (from the rule)', -1.5, 1.5, 0.01, onM],
    ['fltDrop',  'keel below the belly',  0.20, 3.00, 0.01, onM],
    ['fltInc',   'keel incidence °',     -5, 10, 0.5, onM],
    ['fltTrack', 'half track',            0.40, 3.50, 0.01, onM],
  ], on],
  ['struts', [
    ['fltStrutR',  'strut thickness',      0.008, 0.090, 0.001, onM],
    ['fltStrutAng','strut root angle °',  20, 85, 1, on],
    ['fltFrontRing','front strut root', 0, 1, 1, ['with the rear V', 'over its deck fitting']],
    ['fltSpread',  'spreader bars',       0, 1, 1, on],
    ['fltSpreadAft','aft spreader (aft of the step)', 0.10, 2.40, 0.01, onM],
    ['fltWires',   'cross wires',         0, 1, 1, on],
    // FLOAT-RIG-FWD (13 Nov, the user on the PC-6's Wiplines: "the anchors on the floats does not seem completely correct,
    // if you may move these"): the FRONT strut's deck fitting moved forward (+) of its station (the keel flat's forward
    // end) - the drawing, the spec (gear.floats.rigFwd) and the flown truss (61_gen_frame) together. ABSENT at 0
    ['fltRigFwd',  'front strut fitting (+ forward)', -1.0, 2.0, 0.01, { absent: 0, when: P => +P.gearFloats, dim: 'm' }],
    // FLOAT-LADDER (13 Nov, the user on the PC-6's Wiplines: "an option for generating these reinforcements on the floats
    // struts, I guess doubling as a ladder"): fore-and-aft rails a side, front strut to rear strut, the steps up from the
    // float to the cabin. ABSENT at 0 (no saved build gains the key)
    ['fltLadder',  'step rails on the struts (a ladder)', 0, 3, 1, ['none', 'one rail', 'two rails', 'three rails'],
     { absent: 0, when: P => +P.gearFloats }],
  ], on],
]];
(PAGE.groupsOverride || (PAGE.groups = PAGE.groups || [])).push(GROUP);

// the hull's parameters as 32_hydro reads them, from the rows: the family
// scaled to the row's length (the details, the radii, the water rudder
// follow the size), the rows over it
function hullParams(P) {
  const HY = HYc();
  const L = +P.fltL, k = L / HY.DEF.L;
  const Q = HY.scaleParams(HY.DEF, k, {
    L, xs: +P.fltStep * L, B: +P.fltB, H: +P.fltH, beta: +P.fltBeta, betaBow: +P.fltBetaBow, betaA: +P.fltBetaA,
    hs: +P.fltHs, aftAngle: +P.fltAft, aftCurve: +P.fltAftCurve, flatK: +P.fltFlat, stemK: +P.fltStem,
    rake: +P.fltRake, noseR: +P.fltNoseR, planK: +P.fltPlan, bStern: +P.fltStern, flare: +P.fltFlare,
    mFloat: +P.fltMass, inc: +P.fltInc, xAft: +P.fltSpreadAft,
    // G1930 (FLOAT-SHAPE): the Wipline afterbody's plan - held to the aft spreader bar, closing as the square (not a
    // row: the family's; the keel and the stern's beam are the rows above)
    aftHold: HY.WIPLINE_AFT ? HY.WIPLINE_AFT.aftHold : HY.DEF.aftHold, aftPow: HY.WIPLINE_AFT ? HY.WIPLINE_AFT.aftPow : HY.DEF.aftPow,
  });
  // FLOATS-CLASSIC: the EDO deck over the same rows (absent on a Wipline: its record is the one it was)
  // ...and the EDO's own afterbody PLAN (held 0, closing linearly: HY.EDO_AFT; the keel and the stern's beam stay rows)
  if (Math.round(+P.fltStyle || 0) === 1 && HY.EDO_STYLE) Object.assign(Q, HY.EDO_STYLE, HY.EDO_AFT ? { aftHold: HY.EDO_AFT.aftHold, aftPow: HY.EDO_AFT.aftPow } : null);
  Q.scale = k;
  // TWIN4B-STRUTS: the front strut pair on the ring over its deck fitting (61_gen_frame; absent: on the step's ring)
  if (Math.round(+P.fltFrontRing || 0) === 1) Q.frontRing = 1;
  // FLOAT-RIG-FWD: present only when moved (a record without it is the one it was)
  if (+P.fltRigFwd) Q.rigFwd = +P.fltRigFwd;
  const name = PRESET_NAMES[Math.round(P.fltPreset)];
  if (name && name !== CUSTOM) Q.preset = name;
  return Q;
}

// ---- THE STARTER (the engine-preset pattern) ---------------------------------
// "has the preset ROW changed since I last looked?" — the first look records,
// a change fires, and a LOAD is not a row change (PAGE.load forgets).
// Published for GATE STARTER, which drives it without a scene.
let lastPreset = null;
function floatPresetStarter(P) {
  const psel = Math.round(P.fltPreset);
  if (lastPreset === null) { lastPreset = psel; return null; }
  if (psel === lastPreset) return null;
  lastPreset = psel;
  const name = PRESET_NAMES[psel];
  return name && name !== CUSTOM ? name : null;
}
// write a catalogue row's hull into the rows (the fineness-fitted family:
// what presetParams solved for the row's four numbers)
function applyFloatPreset(P, name) {
  const HY = HYc();
  const Q = HY && HY.presetParams(name);
  if (!Q) return false;
  Object.assign(P, rowsOfParams(Q));
  // FLOATS-CLASSIC: an EDO kit's ventral is the plan's vintage lobe at the plan's proportions - its chord 3.0 times
  // its depth (the long forward point; the plate's 0.6 x 0.4 drew a short bucket) - the depth row kept
  if (Q.style === 'edo') P.finVentralC = Math.min(2.5, +((+P.finVentralH || 0.4) / 0.33).toFixed(2));
  return true;
  // (rowsOfParams writes fltStyle: an EDO row turns the classic deck on, a Wipline row the flat one)
}
// ---- A LOAD STANDS THE FLOATS WHERE THE FILE SAVED THEM (G3700) ------------
// The step follows the flown CG (the placement rule above, and the energy
// layer's CG handshake rebuilds when that CG moves 2 cm). On a LOAD that is
// wrong: a saved build must come back exactly as saved (WYSIWYG), and the
// CG the page reads while a load settles is not the CG the file was saved
// on - the certified PA-18 floats came back 8 cm aft on the page (A0, 26
// Oct: never re-place on a load, only on an edit). So a load that carries a
// measured station (`gear.floats.x`, metres aft of the firewall) holds it
// until a row changes; the first build after the load records the rows, and
// the build that sees them differ (the builder's edit) hands the step back
// to the rule. A preset, a reset or a file with no station: the rule.
let held = null;                                  // { x, rows } while a load holds
const rowsOf = P => {
  const VK = (CG2 && CG2.CAGE_VIEW_KEYS) || {};
  return JSON.stringify(Object.keys(P).filter(k => !(k in VK)).sort().map(k => [k, P[k]]));
};
const prevLoad = PAGE.load;
PAGE.load = spec => {
  if (prevLoad) prevLoad(spec);
  lastPreset = null;
  const f = spec && spec.gear && spec.gear.floats;
  held = f && typeof f.x === 'number' && isFinite(f.x) ? { x: f.x, rows: null } : null;
};
// ---- G3445 THE FLOAT KIT (the user 22 Oct: "4 yes" - fitting floats fits the certified seaplane propeller, other
// planes are left alone; "have a popup or something when we choose floats, it says what else it changes") -----------
// A float model with a row in GEN_SEAPLANE_PROPS (60_gen_spec.js: the 2350 -> the 172's McCauley 82 x 43) brings its
// STC propeller: the cowl page's blade rows (cw_propD, cw_bladeN, cw_material: what the join flies, G132) and the
// spec's pitch class ('seaplane', through GARAGE_SPEC.update as a design tile writes it). The propeller it replaced is
// kept in the cage's own numbers (fltKitPrev*) and comes back when the floats go off or the float model has no row.
// A STARTER like the preset's: it fires on a CHANGE of (floats on, float model) - the first look records, and a LOAD
// is not a change (PAGE.load forgets) - so no saved aeroplane is ever refitted by opening it. The builder can still
// change the propeller after; the kit does not fight them (it re-acts only on the next floats / model change).
const KIT_PITCHES = ['auto', 'climb', 'standard', 'cruise', 'seaplane'];
const KIT_MATS = ['wood', 'wood', 'alu', 'carbon', 'carbon', 'carbon', 'maple', 'walnut'];   // _cage_join's CAGE_JOIN_PROP_MATS
Object.assign(PAGE.defaults, { fltKit: 0, fltKitPrevD: 0, fltKitPrevN: 0, fltKitPrevMat: 0, fltKitPrevPitch: -1 });
const seaProps = () => (typeof GEN_SEAPLANE_PROPS !== 'undefined' ? GEN_SEAPLANE_PROPS : (window.GEN_SEAPLANE_PROPS || {}));
const kitModel = P => (+P.gearFloats ? PRESET_NAMES[Math.round(P.fltPreset)] || null : null);
const specPitch = () => { try { const S = window.GARAGE_SPEC && window.GARAGE_SPEC.get(); return (S && S.prop && S.prop.pitch) || null; } catch (e) { return null; } };
// (ENGINE-DIALS B: the kit sets the propeller's pitch ROW, the same writer a builder's move on it uses - _cage_eng.js
// CAGE_PROP_PITCH - which writes the spec; with no engine layer on the page, the spec as before)
const setPitch = (p, P) => { if (!p) return; const PR = window.CAGE_PROP_PITCH; if (PR && PR.set && P) { PR.set(P, p); return; }
  setTimeout(() => { try { if (window.GARAGE_SPEC && window.GARAGE_SPEC.update) window.GARAGE_SPEC.update({ prop: { pitch: p } }); } catch (e) {} }, 0); };
let lastKit = null;
// -> null (nothing changed) or { kind: 'fit' | 'restore' | 'floats' | 'off', model, row, prev }; writes the rows
function floatKitStep(P) {
  const model = kitModel(P), row = model ? seaProps()[model] || null : null;
  const key = (+P.gearFloats ? 1 : 0) + ':' + (model || '');
  if (lastKit === null) { lastKit = key; return null; }
  if (key === lastKit) return null;
  lastKit = key;
  const prev = { D: +P.cw_propD, N: Math.round(P.cw_bladeN), mat: KIT_MATS[Math.round(P.cw_material)] || null, pitch: specPitch() };
  if (row && !+P.fltKit) {
    Object.assign(P, { fltKitPrevD: prev.D, fltKitPrevN: prev.N, fltKitPrevMat: Math.round(P.cw_material),
                       fltKitPrevPitch: KIT_PITCHES.indexOf(prev.pitch) });
    Object.assign(P, { cw_propD: row.D, cw_bladeN: row.blades, cw_material: Math.max(0, KIT_MATS.indexOf(row.material)), fltKit: 1 });
    setPitch(row.pitch, P);
    return { kind: 'fit', model, row, prev };
  }
  if (!row && +P.fltKit) {
    const back = { D: +P.fltKitPrevD, N: +P.fltKitPrevN, pitch: KIT_PITCHES[+P.fltKitPrevPitch] || null };
    if (back.D > 0) Object.assign(P, { cw_propD: back.D, cw_bladeN: back.N, cw_material: +P.fltKitPrevMat });
    P.fltKit = 0;
    setPitch(back.pitch, P);
    return { kind: 'restore', model, row: null, prev: back };
  }
  return { kind: +P.gearFloats ? 'floats' : 'off', model, row: null, prev };
}
// THE CARD: what else the floats change. The garage's look (--ed tokens, redeclared on the body as bench.css does for
// its cards), buttons not hover, top right of the shed - an editor card, never shown in flight (PAGE.post runs only
// when the editor builds, and only after a builder's change). OK keeps it; UNDO puts the floats off (the kit then
// gives the propeller back).
function floatKitCard(ev, P) {
  if (!ev || ev.kind === 'off' || typeof document === 'undefined' || !document.createElement || !document.body) return;
  try {
    let el = document.getElementById('fkCard');
    if (!el) { el = document.createElement('div'); el.id = 'fkCard'; document.body.appendChild(el); }
    const HY = HYc(), R = HY && ev.model && rowOf(ev.model);
    const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const propOf = q => (q && q.D > 0 ? q.D.toFixed(2) + ' m' + (q.N ? ', ' + q.N + '-blade' : '') + (q.pitch ? ', ' + q.pitch + ' pitch' : '') : 'the previous propeller');
    const lines = [];
    if (ev.kind === 'fit') lines.push(['Propeller', 'the certified seaplane propeller: <b>' + esc(ev.row.name) + '</b>, replacing ' + esc(propOf(ev.prev)) + '. Taking the floats off puts yours back.']);
    else if (ev.kind === 'restore') lines.push(['Propeller', 'your own propeller is back (' + esc(propOf(ev.prev)) + ').']);
    else lines.push(['Propeller', ev.model && ev.model !== CUSTOM ? 'unchanged: no certified seaplane propeller is listed for the ' + esc(ev.model) + '.'
                                     : 'unchanged. Pick a Wipline model: one with a certified propeller (the 2350, for the Cessna 172) fits it.']);
    if (+P.gearFloats) {
      lines.push(['Ventral fin', +P.finOn && +P.finVentralOn ? 'added under the tail (it comes with floats)' +
                  (Math.round(+P.finVentralShape || 0) === 1 ? ' - the vintage lobe of the EDO kits.' : '.') : 'not fitted (switch it on in the fin rows).']);
      lines.push(['Water rudders', +P.fltRudder ? 'fitted on both float sterns.' : 'off.']);
      const pairKg = R ? R.mSys : 2 * (+P.fltMass || 0);
      // FLOATS-CLASSIC: what the pair costs (HYDRO.floatPrice: the catalogue's, else the family's rate on its mass)
      const HPc = hullParams(P), price = HY && HY.floatPrice ? HY.floatPrice(HPc) : 0;
      if (price) lines.push(['Price', Math.round(price).toLocaleString('en') + ' credits for the pair, rigged and installed' +
                             (HPc.style === 'edo' ? ' (EDO: out of production - the used market)' : ' (new)') + '; it replaces the wheels on the bill.']);
      lines.push(['Weight', '+' + Math.round(pairKg) + ' kg for the pair' + (R ? ' with its rigging (' + (isEdo(ev.model) ? 'EDO' : 'Wipaire') + ')' : ' (the two hulls)') +
                  (R ? '; the ' + esc(ev.model) + ' is rated for ' + Math.round(R.gross).toLocaleString('en') + ' kg gross (' + Math.round(R.gross * 2.20462).toLocaleString('en') + ' lb).' : '; the bench re-measures the gross.')]);
    }
    el.innerHTML = '<div class="fkT">' + (+P.gearFloats ? 'Floats fitted' + (ev.model && ev.model !== CUSTOM ? ' - ' + esc(ev.model) : '') : 'Floats removed') + '</div>' +
      '<div class="fkL">' + lines.map(l => '<div class="fkR"><span class="fkK">' + l[0] + '</span><span class="fkV">' + l[1] + '</span></div>').join('') + '</div>' +
      '<div class="fkB"><button id="fkOk">OK</button>' + (+P.gearFloats ? '<button id="fkUndo">undo the floats</button>' : '') + '</div>';
    el.hidden = false;
    const ok = document.getElementById('fkOk'); if (ok) ok.onclick = () => { el.hidden = true; };
    const un = document.getElementById('fkUndo');
    if (un) un.onclick = () => {
      el.hidden = true;
      P.gearFloats = 0;
      const UI = window.CAGE_UI;
      if (UI && UI.syncSliders) UI.syncSliders();
      if (UI && UI.build) UI.build();
    };
  } catch (e) { /* a card is never worth a build */ }
}
const prevLoadKit = PAGE.load;                    // (A0 L28b: G3700's load hold is chained before; the spec passes through)
PAGE.load = spec => { if (prevLoadKit) prevLoadKit(spec); lastPreset = null; lastKit = null; };
if (typeof window !== 'undefined') {
  window.CAGE_FLOAT_STARTER = floatPresetStarter;
  window.CAGE_FLOAT_APPLY_PRESET = applyFloatPreset;
  window.CAGE_FLOAT_KIT = floatKitStep;          // G3445 (GATE FLOATKIT drives it without a scene)
  window.CAGE_FLOAT_KIT_CARD = floatKitCard;
  window.CAGE_FLOAT_PRESETS = PRESET_NAMES;
  window.CAGE_FLOAT_CUSTOM = CUSTOM_IDX;
  window.CAGE_FLOAT_STYLES = STYLE_NAMES;
  // the energy layer's CG handshake asks before it rebuilds for a moved CG
  window.CAGE_FLOAT_HELD = () => !!held;
}

// ---- the build ------------------------------------------------------------
let group = null;
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};
// model (x aft, y up, z right) -> cage (+x port, +y up, +z forward)
// THE RIGGING (G396.3): the hull is rotated about its step keel by the
// keel incidence — positive is bow DOWN relative to the datum, the way a
// real float is rigged (2-5 deg keel to the wing chord), so that on the
// step, keel level with the water, the wing flies at a useful angle. The
// frame rotates its nodes by the same angle about the same point
// (61_gen_frame.js), so the drawn hull and the flown one agree.
let INC = 0;
const rotInc = m => { const c = Math.cos(INC), s = Math.sin(INC); return [m[0] * c - m[1] * s, m[0] * s + m[1] * c, m[2]]; };
const toCage = (m, at) => { const r = rotInc(m); return [-r[2] + at[0], r[1] + at[1], -r[0] + at[2]]; };
// a direction (no placement)
const dirCage = m => { const r = rotInc(m); return [-r[2], r[1], -r[0]]; };
// a FLOAT_GEN part -> a mesh in the cage frame (indexed, smooth normals);
// `mirror` flips the model's z (the port float is the starboard build
// mirrored, so its paddle and its pump-out cups land inboard and outboard)
// G3873 (the user, 29 Oct: "do the floats fix"): THE HULL'S SURFACE FIELD. The hulls drew on AEROSKIN's triplanar
// branch (surf 0): no rivet rows, no seams, nothing a field-placed marking could land on - and a Wipline float is
// riveted aluminium. The field is the fuselage's contract (_cage_ui.js surfAttr: metres along, metres around,
// station, rail), read off the model frame (metres, mx along the hull, my up, mz across): along from the hull's
// first station, around = the girth from the keel (|mz| across the bottom plus the rise above that station's keel,
// so a chine and a side wall keep counting), a frame every FLT_FRAME m, a rivet row every FLT_RAIL m. |mz|, so the
// mirrored port float carries the same field.
const FLT_FRAME = 0.75, FLT_RAIL = 0.25;
// FLOATS-CLASSIC: an EDO's bulkheads every ~2 ft (a seam and a rivet row every 0.6 m along, a rivet line every 0.3 m
// round), growing with the float (x sqrt(scale) past the family's 4.6 m: a 12.8 m Model 78 is not a 2000 with more
// rows) - the same field, the shader's grammar draws it, nothing new compiles. (0.45 x 0.17 m was tried: every bay
// is an oil-can dish in the grammar, and that dense a grid read as reptile scales.)
const EDO_FRAME = 0.60, EDO_RAIL = 0.30;
let FIELD_FRAME = FLT_FRAME, FIELD_RAIL = FLT_RAIL;
function hullField(part) {
  const n = part.pos.length / 3, NB = 64;
  let x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < n; i++) { const x = part.pos[i * 3]; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  const span = Math.max(1e-6, x1 - x0), binOf = x => Math.min(NB - 1, Math.floor((x - x0) / span * NB));
  const keel = new Float32Array(NB).fill(Infinity);
  for (let i = 0; i < n; i++) { const b = binOf(part.pos[i * 3]); keel[b] = Math.min(keel[b], part.pos[i * 3 + 1]); }
  for (let b = 1; b < NB; b++) if (!isFinite(keel[b])) keel[b] = keel[b - 1];
  for (let b = NB - 2; b >= 0; b--) if (!isFinite(keel[b])) keel[b] = keel[b + 1];
  const a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = part.pos[i * 3], y = part.pos[i * 3 + 1], z = Math.abs(part.pos[i * 3 + 2]);
    const along = x - x0, around = z + Math.max(0, y - keel[binOf(x)]);
    a[i * 4] = along; a[i * 4 + 1] = around; a[i * 4 + 2] = along / FIELD_FRAME; a[i * 4 + 3] = around / FIELD_RAIL;
  }
  return new THREE.BufferAttribute(a, 4);
}
function partMesh(part, at, mat, mirror, name, field) {
  if (!part || !part.idx.length) return null;
  const n = part.pos.length / 3, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const m = [part.pos[i * 3], part.pos[i * 3 + 1], mirror ? -part.pos[i * 3 + 2] : part.pos[i * 3 + 2]];
    const c = toCage(m, at);
    pos[i * 3] = c[0]; pos[i * 3 + 1] = c[1]; pos[i * 3 + 2] = c[2];
  }
  // the model->cage map (-mz, my, -mx) is a REFLECTION (det -1): it flips
  // the winding, and the mirror flips it back — so it is the unmirrored
  // starboard float whose triangles are swapped here
  const idx = !mirror ? part.idx.map((v, i) => (i % 3 === 1 ? part.idx[i + 1] : i % 3 === 2 ? part.idx[i - 1] : v)) : part.idx;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (field) g.setAttribute('aStruct', hullField(part));
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat);
  if (name) mesh.name = name;
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
// a streamlined member: an airfoil-ish section, its chord along the cage's
// forward axis (the flight direction), thickness `t`, chord 2.6 t
function streamlined(bag, a, b, t, chordK) {
  const c = (chordK || 2.6) * t;
  const sect = [];
  for (let k = 0; k < 16; k++) {
    const ang = 2 * Math.PI * k / 16;
    const u = 0.5 * c * Math.cos(ang), v = 0.5 * t * Math.sin(ang) * (0.82 + 0.18 * Math.cos(ang));   // fatter forward
    sect.push([u, v]);
  }
  return GK.sweep(bag, [a, b], () => sect, true, [0, 0, 1]);
}

// HULL-B5: THE BOAT'S TIP FLOATS, DRAWN FROM THE ROWS THE FRAME FLIES. The frame (61_gen_frame HULL-B3) hangs two
// small Wipline-family floats: each one's hull for hullTipKg (HYDRO.tipFloatParams), its keel hullTipY over the step
// keel, under the spar station nearest hullTipAt of the semispan (the step 0.10 L aft of the spars' mid-chord), on
// struts from its deck edges to that station's front and rear spar nodes (and a wire each). The drawing reads THE SAME
// ROWS, the same functions and the DRAWN wing's own spar nodes (the wing layer's def, through its node map - the
// wing the join measures and the frame flies), and stands the float on the drawn step keel (the hull's own table,
// cageHullTable): drawn = flown by construction. Rows not fitted yet (kg 0 / y -1): nothing drawn until the Hull
// tile's fit writes them (hullFitStep below: the frame flies the gross rule meanwhile). Called by the wing layer once
// it has published (the float layer's own post runs before the wing exists).
let tipGroup = null;
window.CAGE_TIPFLOAT_DRAW = ctx => {
  if (tipGroup) { dispose(tipGroup); tipGroup = null; }
  window.CAGE_TIPFLOATS = null;
  const P = ctx && ctx.P, W = window.CAGE_WING, scene = ctx && ctx.scene;
  if (!P || !+P.hullOn || !+P.hullTips || !W || !W.def || !W.nodeCage || !scene || !CG2 || !CG2.cageHullTable) return;
  // (HULL-B26: buoyant wing tips are the wing's own tip - the wing layer draws them, bent and filled by its own rows;
  // there is no float to hang)
  if (Math.round(+P.hullTips) === 2) return;
  const kg = +P.hullTipKg, yRel = +P.hullTipY;
  if (!(kg > 0) || !(yRel > -0.999)) return;
  const HY = HYc(), FG = window.FLOAT_GEN;
  // (HULL-B45: under the second plane on request - its own spar stations and semispan, the frame's planes[1])
  const PL2 = Math.round(+P.hullTipPlane || 0) === 1 && W.def.parts && W.def.parts.planes && W.def.parts.planes[1] && W.def.parts.planes[1].wf
    ? W.def.parts.planes[1] : null;
  const wf = PL2 ? PL2.wf : W.def.parts && W.def.parts.wf, nodes = W.def.nodes,
        semi = PL2 && PL2.semi > 0 ? PL2.semi : W.def.spec && W.def.spec.geom && W.def.spec.geom.semi;
  if (!HY || !HY.tipFloatParams || !wf || !wf.L || !wf.R || !(semi > 0)) return;
  const FS = (CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const TB = CG2.cageHullTable(CG2.cageHullLines(P), FS);
  if (!TB) return;
  const yK = TB.yStep * FS + yRel;                       // the tip float's keel, cage metres
  const Pt = HY.tipFloatParams(kg), tAt = +P.hullTipAt || 0.85;
  tipGroup = new THREE.Group();
  tipGroup.name = 'cageLayer:float';
  scene.add(tipGroup);
  const SM = typeof window !== 'undefined' && window.CAGE_SECMAT;
  const skinM = (SM && SM('float', { cons: 'alloy', surf: 0, fieldM: 1, tint0: 0xd8d2c2 }))
    || new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.55, metalness: 0.05 });
  const deckM = (SM && SM('floatDeck', { surf: 0, fieldM: 1, tint0: 0x2e3135 }))
    || new THREE.MeshStandardMaterial({ color: 0x2e3135, roughness: 0.95, metalness: 0.0 });
  const strutM = (SM && SM('gearLeg', { surf: 0, fieldM: 1, tint0: 0x98a2ad })) || GG.gearMat('steel');
  const out = [];
  for (const [sd, Wn] of [[-1, wf.L], [1, wf.R]]) {
    // the spar station nearest tAt of the semispan - the frame's own choice, on the drawn wing's nodes
    let jj = 1, dB = Infinity;
    for (let q = 1; q < Wn.F.length; q++) { const e = Math.abs(Math.abs(nodes[Wn.F[q]].p[2]) - tAt * semi); if (e < dB) { dB = e; jj = q; } }
    const cF = W.nodeCage(nodes[Wn.F[jj]].p), cR = W.nodeCage(nodes[Wn.R[jj]].p);
    // (HULL-B46: the frame's own rule - the deck held 0.07 m under the spars' line, the float under a low wing; the
    // nodes' y in the frame's metres, the deck off the same sections)
    const yDeck = Math.max(...[-0.80 * Pt.xs, 0, 0.80 * (Pt.L - Pt.xs)].map(xs => HY.sectionOf(Pt, xs === 0 ? -1e-9 : xs).yd));
    const yKs = Math.min(yK, Math.min(cF[1], cR[1]) - 0.07 - yDeck);
    // the step: 0.10 L aft of the spars' mid-chord (cage z is forward), under their mid-span line
    const zS = 0.5 * (cF[2] + cR[2]) - 0.10 * Pt.L, xS = 0.5 * (cF[0] + cR[0]);
    // the float frame (x aft of its step, y up from its keel, z across) -> the cage (the frame's axes: cage x = model z)
    const toC = v => [xS + v[2], yKs + v[1], zS - v[0]];
    const ug = new THREE.Group();
    ug.name = 'edTipFloat' + (sd < 0 ? 'L' : 'R');
    tipGroup.add(ug);
    const meshOf = (part, mat, nm) => {
      if (!part || !part.idx || !part.idx.length) return;
      const n = part.pos.length / 3, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const c = toC([part.pos[i * 3], part.pos[i * 3 + 1], part.pos[i * 3 + 2]]); pos[i * 3] = c[0]; pos[i * 3 + 1] = c[1]; pos[i * 3 + 2] = c[2]; }
      // the winding: faces outward whatever the frames' handedness (the closed hull's signed volume)
      let vol = 0; const I = part.idx;
      for (let t = 0; t + 2 < I.length; t += 3) {
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        vol += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c])
             + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
      }
      const idx = vol < 0 ? Array.from(I, (v, i) => (i % 3 === 1 ? I[i + 1] : i % 3 === 2 ? I[i - 1] : v)) : I;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); if (nm) m.name = nm; m.castShadow = true; m.receiveShadow = true;
      ug.add(m);
    };
    if (FG) {
      const o = FG.build(Pt, { HY, detail: 0, rudder: 0, paddle: 0, xAft: Pt.xAft });
      meshOf(o.hull, skinM, ug.name + 'Hull');
      if (o.deck) meshOf(o.deck, deckM);
      if (o.protrusions) meshOf(o.protrusions, skinM);
    }
    // the rigging, the frame's members (61_gen_frame HULL-B3): the deck edges at the step to the front spar node,
    // the aft deck edges to the rear one, a wire from each bow deck edge
    const st3 = [-0.80 * Pt.xs, 0, 0.80 * (Pt.L - Pt.xs)];
    const deck = st3.map(xs => { const sc = HY.sectionOf(Pt, xs === 0 ? -1e-9 : xs); return [toC([xs, sc.yd, -sc.b]), toC([xs, sc.yd, sc.b])]; });
    if (Math.round(+P.hullTips) === 3) {
      // HULL-B28: AN OUTRIGGER HULL'S SUPPORT (the user: "proper supports"): ONE FAIRED BLADE round the frame's four
      // struts (61_gen_frame: the deck edges at the step to the front spar node, the aft deck edges to the rear) - at
      // the float its section is the deck's whole width over the struts' fore-aft run, flared flat into the deck; up
      // the height it narrows to a 12 % section over the spars' chord, flared again into the wing's underside (the
      // pylon's cooling-tower fillet, both ends). The flown struts stand inside it
      const yB = 0.5 * (deck[1][0][1] + deck[2][0][1]) - 0.01, xB = 0.5 * (deck[1][0][0] + deck[1][1][0]);
      const zB0 = Math.max(deck[1][0][2], deck[2][0][2]) + 0.06, zB1 = Math.min(deck[1][0][2], deck[2][0][2]) - 0.06;
      const yT = 0.5 * (cF[1] + cR[1]) + 0.02, xT = 0.5 * (cF[0] + cR[0]);
      const zT0 = Math.max(cF[2], cR[2]) + 0.05, zT1 = Math.min(cF[2], cR[2]) - 0.05;
      const wB = Math.abs(deck[1][1][0] - deck[1][0][0]) + 0.03, H = Math.max(0.05, yT - yB);
      const bag = GK.Bag(), NR = 18, NS = 28, path = [], rows = [];
      for (let i = 0; i <= NR; i++) {
        // (a 14 % blade over the struts' own chord; the deck fillet - to the deck's width - over its lowest fifth, a
        // small root fillet into the wing over its top tenth: the first cut flared both ends over a quarter of the
        // height and read as a sail)
        const u = i / NR, e0 = Math.max(0, 1 - u / 0.20) ** 2, e1 = Math.max(0, (u - 0.90) / 0.10) ** 2;
        const zc = 0.5 * ((zB0 + zB1) + ((zT0 + zT1) - (zB0 + zB1)) * u);
        const ch0 = (zB0 - zB1) + ((zT0 - zT1) - (zB0 - zB1)) * u, ch = ch0 + 0.10 * ch0 * e0 + 0.12 * ch0 * e1;
        const th = 0.14 * ch0 + (0.7 * wB - 0.14 * ch0) * e0 ** 3 + 0.05 * ch0 * e1;
        path.push([xB, yB + H * u, zc]); rows.push([ch, Math.max(0.03, th)]);   // (vertical: it stands on the float's centreline)
      }
      GK.sweep(bag, path, (tt, i) => { const [c, th] = rows[i], pts = [];
        for (let k = 0; k < NS; k++) { const ang = 2 * Math.PI * k / NS, ca = Math.cos(ang), sa = Math.sin(ang), xc = 0.5 * (1 - ca);
          const yt = 5 * 0.2 * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4) / 0.2;
          pts.push([(0.5 - xc) * c, (sa >= 0 ? 1 : -1) * 0.5 * th * Math.min(1, yt / 0.6)]); }
        return pts; }, true, [0, 0, 1]);
      bag.mesh(ug, skinM);
    } else {
      const sg = GK.Bag(), wg = GK.Bag(), t = Math.max(0.012, +P.fltStrutR || 0.018);
      for (const [a, b] of [[deck[1][0], cF], [deck[1][1], cF], [deck[2][0], cR], [deck[2][1], cR]]) streamlined(sg, a, b, t);
      for (const [a, b] of [[deck[0][0], cF], [deck[0][1], cR]])
        GK.sweep(wg, [a, b], () => [[0.003, 0], [0, 0.003], [-0.003, 0], [0, -0.003]], true, [0, 0, 1]);
      sg.mesh(ug, strutM); wg.mesh(ug, strutM);
    }
    out.push({ side: sd, step: [xS, yK, zS], L: Pt.L, kg, spar: [cF, cR] });
  }
  window.CAGE_TIPFLOATS = out;
};

// HULL-B3: THE HULL TILE'S FIT (_cage_design.js gearLayout 'hull', `after: hullFit`): on the builds that follow the
// pick, the step by the 12-deg rule off the FLOWN CG and the afterbody keel onto a 7-deg run (_cage_gen.js
// cageHullFit - the same function GATE HULL fits with), written once into the rows - the step moves the CG by grams,
// so up to three passes, each one only while the rows still move. The CG and the datums are the ones the float step
// reads (app.js FLYDIY_CG_MODEL, the join's CAGE_DATUM)
let hullFitPasses = 0, hullTipArmed = false;
window.CAGE_HULL_FIT_NEXT = () => { hullFitPasses = 3; };
function hullFitStep(P, stat) {
  // (a hull whose tip floats were never fitted - a saved boat, a hand-set switch - is fitted once, the tile's way)
  if (!hullFitPasses && +P.hullOn && +P.hullTips && !(+P.hullTipKg > 0 && +P.hullTipY > -0.999) && !hullTipArmed) { hullTipArmed = true; hullFitPasses = 3; }
  if (!hullFitPasses) return;
  if (!+P.hullOn) { hullFitPasses = 0; return; }
  const DAT = window.CAGE_DATUM, CGM = window.FLYDIY_CG_MODEL;
  if (!CG2 || !CG2.cageHullFit || !DAT || !DAT.fwOk || !CGM) return;      // the next build, when the CG is in
  hullFitPasses--;
  const FS = (CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  // HULL-B8: THE WHOLE FIT, the gate's and the matrix's own function (_cage_gen.js cageHullFitAll): the step by the
  // 12-deg rule and the afterbody keel, the rest balance (the bow lengthened while the boat would rest bow down), the
  // propellers' clearance over the water (a wing pair's block, a pylon's height), a wing pair counter-rotating, the
  // tip floats (HYDRO.hullTipFit off the flown mass)
  const HY = HYc(), M = window.FLYDIY_MASS_MODEL;
  if (!CG2.cageHullFitAll || !(M > 0)) { hullFitPasses = 0; return; }
  const W = window.CAGE_WING, semi = W && W.def && W.def.spec && W.def.spec.geom && W.def.spec.geom.semi;
  // (HULL-B26: the buoyant tips' fit - the flown wing's tip joint and the core's own shaping, genTipFit)
  const tipO = typeof genTipFit === 'function' ? { joint: window.FLYDIY_TIPJOINT_MODEL || null, fit: genTipFit,
                                                    drooped: Object.keys(GEN_TIPS).indexOf('drooped') } : null;
  const fa = CG2.cageHullFitAll(P, { cg: CGM, mass: M, zFw: DAT.zFw, yD: DAT.yD, props: window.FLYDIY_PROPS_MODEL || null }, HY, { semi, tip: tipO });
  if (!fa) { hullFitPasses = 0; return; }
  const fit = fa.rows;
  window.CAGE_HULL_REST = { rest: fa.rest, notes: fa.notes };
  const moved = Object.keys(fit).some(k => Math.abs((+P[k] || 0) - fit[k]) > 1e-3);
  if (!moved) { hullFitPasses = 0; return; }
  Object.assign(P, fit);
  if (stat) stat.textContent += '  ·  hull: the step 12 deg aft of the CG, the afterbody keel on 7 deg' +
    (fa.rest ? ', rests ' + fa.rest.trim.toFixed(1) + ' deg' : '') + (fa.notes.length ? ' - ' + fa.notes.join('; ') : '');
  setTimeout(() => { const UI = window.CAGE_UI; if (UI && UI.syncSliders) UI.syncSliders(); if (UI && UI.build) UI.build(); }, 0);
}
// ---- THE AMPHIBIAN (RETRACT-STUDY §8.25; the data: HYDRO.WIPLINE_AMPHIB, read off Wipaire's manuals and guides) -----
// Per float, in the hull's MODEL frame (x aft from the step, y up from the step's keel, z across), mirrored for the
// port float like every other part:
//   THE MAIN GEAR - a drag link on trunnions at the STEP BULKHEAD (Wipline 13000/6100 manuals: "drag link from
//     trunnions on step bulkhead"), low in the float; its axle aft of the step, where every guide's 3-view puts the
//     wheel (the main axle at AMPHIB_GEOM.mainK of the amphibian length from its front, never ahead of the step);
//     single or dual wheels as the model's tyres; the shock strut from the drag link up to the slide track's carriage
//     under the deck. It swings UP into an open wheel well just aft of the step - no doors (no door in any parts list).
//   THE NOSE GEAR - a composite spring leg ("very similar to a Cessna style") from a trolley at the foot of the nose
//     box's end track, raked forward and down to a castering pivot block and fork; retracting, the trolley climbs the
//     end track, turns the corner and is drawn aft (the 3730 manual: rollers "go around the corner"), so the leg swings
//     from hanging down to lying forward and the wheel ends at the bow tip, half out - "retracts into the float nose
//     to provide a dock bumper" (Wipaire, the 13000). No doors.
//   MEASURED off Wipaire's 3-views: the keel 0.8 of the main's radius over the ground at the step (HYDRO.AMPHIB_GEOM.
//     clearK). ASSUMED (Wipaire publishes none of them; the study lists them as missing): the stowed main tyre flush with its keel; the trunnion at half the
//     hull's height; the nose trolley's travel (what lands the wheel at the bow tip); the leg's rake (20 deg).
function amphib(HP, HY, at, mirror, ug, tag, hullMesh, P, rec, out) {
  const A = HY.amphibOf(HP.preset, HP.L, HP.H); if (!A) return;
  const G = HY.AMPHIB_GEOM, sec = x => HY.sectionOf(HP, x === 0 ? -1e-9 : x);
  const Rm = HY.TYRE_OD(A.main) / 2, Wm = HY.TYRE_W(A.main), Rn = HY.TYRE_OD(A.nose) / 2, Wn = HY.TYRE_W(A.nose);
  const xs = HP.xs, H = HP.H, xb = -xs, dL = (A.dL != null ? A.dL : 6) * 0.0254, La = HP.L + dL;
  const ykS = sec(0).yk, yg = ykS - (G.clearK || 0.8) * Rm;          // (the ground line: the keel 0.8 R over it - the guides' 3-views)
  const xn = xb - dL * 0.5, xm = Math.max(xb - dL + G.mainK * La, Rm + 0.05);
  // THE BLACK CAP (the rubber nose bumper): the stowed nose wheel comes to ITS height, at the tip, and slides through a
  // slot cut in it as wide as the tyre (the user, 5 Nov: "your little wheel is coming too low, so it should really
  // come at the level of the black little tip there, and this black little tip should even be cut so that the wheel
  // can slide through it") - both styles
  let yCap = sec(xb + 0.02).yd - 0.6 * Rn;
  if (out && out.bumper && out.bumper.pos && out.bumper.pos.length) {
    const B = out.bumper, ps = B.pos; let sy = 0, n = 0, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < ps.length; i += 3) { y0 = Math.min(y0, ps[i + 1]); y1 = Math.max(y1, ps[i + 1]); }
    yCap = (y0 + y1) / 2;
    const half = Wn / 2 + 0.015, keep = [];
    for (let t = 0; t < B.idx.length; t += 3) { let cz = 0, cy = 0; for (let q = 0; q < 3; q++) { cz += ps[B.idx[t + q] * 3 + 2] / 3; cy += ps[B.idx[t + q] * 3 + 1] / 3; }
      if (Math.abs(cz) < half && cy < yCap + Rn * 0.9) continue; keep.push(B.idx[t], B.idx[t + 1], B.idx[t + 2]); }
    B.idx = keep; }
  const stowN = [xb + 0.25 * Rn, yCap, 0];                    // (the stowed nose wheel's centre: a quarter of it inside the tip)
  const g = Math.max(0, Math.min(1, P.gearPos == null ? 1 : +P.gearPos)), s = 1 - g;
  const sm = (a, b) => { const t = Math.max(0, Math.min(1, (s - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rot = (p, c, a) => { const ca = Math.cos(a), sa = Math.sin(a), dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * ca - dy * sa, c[1] + dx * sa + dy * ca, p[2]]; };
  const mz = v => [v[0], v[1], mirror ? -v[2] : v[2]], C3 = v => toCage(mz(v), at), D3 = v => dirCage(mz(v));
  const bags = { tyre: GG.Bag(), hub: GG.Bag(), brake: GG.Bag(), brakefix: GG.Bag(), alloy: GG.Bag(), dark: GG.Bag() }, st = GG.Bag(), al = GG.Bag(), dk = GG.Bag();
  // THE MAIN: the trunnion, the axle down, the angle that stows the tyre flush with the keel (searched)
  const T = [-0.02, ykS + 0.5 * H, 0], ax0 = [xm, yg + Rm, 0];
  // (stowed FLUSH with the keel where the hull is deep enough; else as high as the deck allows - 30 mm under it - the
  // tyre showing under the keel by the rest, recorded: Wipaire does not say which a Wipline does)
  let thM = 0, flush = false;
  const topOk = q => q[1] + Rm <= sec(Math.max(0.01, q[0])).yd - 0.03, botOk = q => q[1] - Rm >= sec(Math.max(0.01, q[0])).yk - 0.002;
  for (let d = 0; d <= 170; d += 0.5) { const q = rot(ax0, T, d * D2R); if (!topOk(q)) break; thM = d * D2R; if (botOk(q)) { flush = true; break; } }
  const qUp = rot(ax0, T, thM), fitWhy = [];
  if (!flush) fitWhy.push('the stowed main tyre (' + A.main + ') shows ' + Math.round((sec(Math.max(0.01, qUp[0])).yk - (qUp[1] - Rm)) * 1000) + ' mm under the keel: the hull is too shallow to take it flush');
  const am = rot(ax0, T, thM * sm(0.1, 1)), lm = rot([xm, yg + Rm + 0.5 * Rm, 0], T, thM * sm(0.1, 1));
  const zs = A.mainN === 2 ? [-0.62 * Wm - 0.02, 0.62 * Wm + 0.02] : [0];
  for (const z of zs) GG.wheel(bags, C3([am[0], am[1], z]), D3([0, 0, 1]), Rm, { P: {}, brake: true });
  GK.tube(st, C3(T), C3([am[0], am[1], 0]), 0.022, 10);                                       // the drag link
  GK.tube(al, C3([am[0], am[1], -Math.max(...zs.map(Math.abs)) - 0.03]), C3([am[0], am[1], Math.max(...zs.map(Math.abs)) + 0.03]), 0.016, 10);   // the axle
  const top = [T[0] + 0.35 * (xm - T[0]), ykS + 0.85 * H, 0];                                  // the carriage under the deck
  if (Math.round(+P.fltAmph) === 2) {                    // (EDO style: a horizontal shock cylinder along the bottom - the close-ups)
    const mid = rot([T[0] + 0.55 * (xm - T[0]), T[1] + 0.55 * (ax0[1] - T[1]), 0], T, thM * sm(0.1, 1)), Fh = [T[0] - 0.35 * H, ykS + 0.12 * H, 0];
    GK.tube(al, C3(Fh), C3([(Fh[0] + mid[0]) / 2, (Fh[1] + mid[1]) / 2, 0]), 0.034, 12); GK.tube(st, C3([(Fh[0] + mid[0]) / 2, (Fh[1] + mid[1]) / 2, 0]), C3(mid), 0.016, 10);
  } else { GK.tube(al, C3(top), C3(lm), 0.028, 12); GK.tube(dk, C3([top[0] - 0.05, top[1], 0]), C3([top[0] + 0.25, top[1], 0]), 0.02, 8); }   // the shock strut, its slide track
  // THE EDO STYLE'S NOSE (the user's photographs and his reading of them, 5 Nov - no EDO document reached): the leg's
  // anchor is at the BOTTOM of the float's front - on the keel where it turns up into the stem (the forefoot), not at
  // the tip (the tip is the Wipline's trolley) - outside the hull. Gear down the leg hangs from it, nearly upright; a
  // small piston from a fitting on the float's bottom, aft of the anchor, swings it FORWARD AND UP about the anchor,
  // so the leg lies along the stem and the wheel ends at the bow tip, in front of the float in its black cap. The
  // anchor is placed where its distance to that stowed place is the leg's length; no well, so no doors
  let edoNose = null, wipNose = null;
  if (Math.round(+P.fltAmph) === 2) {
    // (the user, 5 Nov: "your rotation point should still follow the bottom of the hull further by, let's say, maybe 20
    // centimeters ... the landing position of your arm is not almost vertical ... It is between 45 degrees and
    // horizontal ... Then it goes up using a little piston ... so that the little wheel goes straight at the tip"):
    // the anchor walks aft along the keel to where a leg raked forward at ~35 deg below level (its length set by the
    // ground line) reaches the stowed place at the tip exactly - the rake solved from the anchor's height and distance
    const tip = stowN, RAKE = 35 * D2R;
    let best = null;
    for (let x = xb + 0.10; x <= xb + 0.6 * xs; x += 0.005) {
      const P0 = [x, sec(x).yk - 0.02, 0], drop = P0[1] - (yg + Rn), D = Math.hypot(tip[0] - P0[0], tip[1] - P0[1]);
      if (drop <= 0.02 || D <= drop) continue;
      const a = Math.asin(drop / D), e = Math.abs(a - RAKE);
      if (!best || e < best.e) best = { e, P0, a, D }; }
    const Pe = best ? best.P0 : [xb + 0.2, sec(xb + 0.2).yk - 0.02, 0], ra = best ? best.a : RAKE, Lg = best ? best.D : 0.3;
    const an0 = [Pe[0] - Lg * Math.cos(ra), Pe[1] - Lg * Math.sin(ra), 0];
    // (the swing: forward and up about the anchor till the wheel's centre points at the stowed place)
    const a0 = Math.atan2(an0[1] - Pe[1], an0[0] - Pe[0]), a1 = Math.atan2(tip[1] - Pe[1], tip[0] - Pe[0]);
    let thE = a1 - a0; while (thE > 0) thE -= 2 * Math.PI; while (thE <= -2 * Math.PI) thE += 2 * Math.PI;   // (clockwise: down, forward, up)
    const r = thE * sm(0.05, 0.95), an = rot(an0, Pe, r), blk = rot([an0[0], an0[1] + Rn + 0.04, 0], Pe, r);
    GG.wheel(bags, C3(an), D3([0, 0, 1]), Rn, { P: {}, brake: false });
    const u = [blk[0] - Pe[0], blk[1] - Pe[1], 0], l = Math.hypot(u[0], u[1]) || 1, c = [(blk[0] + Pe[0]) / 2, (blk[1] + Pe[1]) / 2, 0];
    const e1 = D3([u[0] / l, u[1] / l, 0]), e2 = D3([-u[1] / l, u[0] / l, 0]), e3 = D3([0, 0, 1]);
    GK.boxIn(st, C3(c), [l / 2, 0.016, 0.022], e1, e2, e3);                                         // the oleo leg
    GK.boxIn(al, C3(c), [l * 0.42, 0.006, 0.05], e1, e2, e3);                                       // its fairing
    GK.tube(al, C3(blk), C3(an), 0.016, 10);                                                        // the castering fork
    GK.tube(dk, C3([Pe[0], Pe[1], -0.06]), C3([Pe[0], Pe[1], 0.06]), 0.022, 10);                     // the anchor's pin and lugs
    // (the little piston: from a fitting on the bottom, aft of the anchor, to the leg a quarter down - the triangle)
    const Fb = [Pe[0] + 0.45 * l, sec(Pe[0] + 0.45 * l).yk - 0.015, 0], Lq = [Pe[0] + u[0] * 0.28, Pe[1] + u[1] * 0.28, 0];
    const mid = [(Fb[0] + Lq[0]) / 2, (Fb[1] + Lq[1]) / 2, 0];
    GK.tube(al, C3(Fb), C3(mid), 0.020, 10); GK.tube(st, C3(mid), C3(Lq), 0.010, 8);                // barrel, rod
    GK.tube(dk, C3([Fb[0], Fb[1], -0.04]), C3([Fb[0], Fb[1], 0.04]), 0.016, 8);                     // its fitting
    edoNose = { noseAxle: an0, noseUp: rot(an0, Pe, thE), pivot: Pe, rake: +(ra / D2R).toFixed(1) };
  } else {
  // THE NOSE: the trolley at the end track's foot, the leg raked forward to the castering block over the wheel
    const Pn = [xb + 0.18 * H, sec(xb + 0.18 * H).yk + 0.12 * H, 0], an0 = [xn, yg + Rn, 0], blk0 = [an0[0] + 0.25 * Rn, an0[1] + Rn + 0.04, 0];
    const leg0 = Math.atan2(blk0[1] - Pn[1], blk0[0] - Pn[0]);                                   // (down and forward)
    // (forward and up - the short way - till the wheel's centre is at the cap's height; the trolley then draws it aft
    // into the tip)
    let thN = 0; for (let d = 0; d <= 170; d += 0.5) { thN = -d * D2R; if (rot(an0, Pn, thN)[1] >= stowN[1]) break; }
    const rN = thN * sm(0, 0.7), blkR = rot(blk0, Pn, rN), axR = rot(an0, Pn, rN);
    const tipX = stowN[0], slideFull = Math.max(0, tipX - rot(an0, Pn, thN)[0]), slideN = slideFull * sm(0.5, 1);
    const sh = v => [v[0] + slideN, v[1], v[2]], Pn2 = sh(Pn), blk = sh(blkR), an = sh(axR);
    GG.wheel(bags, C3(an), D3([0, 0, 1]), Rn, { P: {}, brake: false });
    { const u = [blk[0] - Pn2[0], blk[1] - Pn2[1], 0], l = Math.hypot(u[0], u[1]) || 1, c = [(blk[0] + Pn2[0]) / 2, (blk[1] + Pn2[1]) / 2, 0];
      GK.boxIn(st, C3(c), [l / 2, 0.012, 0.035], D3([u[0] / l, u[1] / l, 0]), D3([-u[1] / l, u[0] / l, 0]), D3([0, 0, 1])); }   // the spring leg
    GK.tube(al, C3(blk), C3(an), 0.018, 10);                                                       // the castering block and fork
    GK.tube(dk, C3([Pn2[0] - 0.04, Pn2[1], -0.05]), C3([Pn2[0] - 0.04, Pn2[1], 0.05]), 0.02, 8);  // the trolley
    wipNose = { noseAxle: an0, noseUp: (q => [q[0] + slideFull, q[1], q[2]])(rot(an0, Pn, thN)) };
  }
  for (const [b, m] of [[st, 'steel'], [al, 'alloy'], [dk, 'dark']]) if (b.tris) b.mesh(ug, GG.gearMat(m));
  for (const k in bags) if (bags[k].tris) bags[k].mesh(ug, GG.gearMat(k));
  // THE MAIN WHEEL WELL: the main's sweep in plan (the wheels' rims, gear down to up), cut from below into the hull
  // to a ceiling over the stowed tyre (the knife's closed box) - open at the bottom, no door
  const KG = window.KNIFE_GEN;
  if (hullMesh && KG && KG.knifeWellsGeo) {
    let x0 = Infinity, x1 = -Infinity, top2 = -Infinity;
    for (let i = 0; i <= 12; i++) { const q = rot(ax0, T, thM * i / 12); x0 = Math.min(x0, q[0] - Rm); x1 = Math.max(x1, q[0] + Rm); top2 = Math.max(top2, q[1] + Rm); }
    x0 = Math.max(x0, 0.03); const zw = Math.max(...zs.map(Math.abs)) + Wm / 2 + 0.03;
    const ring = [[x0, -zw], [x1, -zw], [x1, zw], [x0, zw]].map(([x, z]) => C3([x, 0, z]));
    let outline = ring.map(p => [p[2], -p[0]]);
    let a2 = 0; for (let i = 0; i < outline.length; i++) { const p = outline[i], q = outline[(i + 1) % outline.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
    if (a2 < 0) outline.reverse();
    const ceil = C3([0, top2 + 0.02, 0])[1];
    const r = KG.knifeWellsGeo(THREE, hullMesh.geometry, [{ units: [tag], mode: 'box', outline, ceil }], null, null);
    if (r.skin) { hullMesh.geometry.dispose(); hullMesh.geometry = r.skin; }
    if (r.well) { const wm = new THREE.Mesh(r.well, new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.8, side: THREE.DoubleSide })); wm.name = 'edFloatWell' + tag; ug.add(wm); }
  }
  rec.amph = rec.amph || { style: Math.round(+P.fltAmph) === 2 ? 'EDO (photographs)' : 'Wipline', model: A.name, est: A.est, main: A.main, mainN: A.mainN, nose: A.nose, dKg: A.dKg, assumed: ['stowFlush', 'trunnionH', 'noseTravel', 'noseRake'], measured: { keelClearance: +(ykS - yg).toFixed(3) }, fitWhy };
  rec.amph[tag] = { edoPivot: edoNose ? C3(edoNose.pivot) : null, edoRake: edoNose ? edoNose.rake : null, capY: C3([0, yCap, 0])[1], mainAxle: C3(ax0), mainUp: C3(rot(ax0, T, thM)), trunnion: C3(T), noseAxle: C3((edoNose || wipNose).noseAxle), noseUp: C3((edoNose || wipNose).noseUp), thM: +(thM / D2R).toFixed(1) };
}
const prevPost = PAGE.post;
// HULL-B18: THE TUB'S AFTERBODY, drawn from the hull's own lines (_cage_gen.js cageHullTub: the stations the water
// reads) - a loft of V sections (gunwale, chine, keel, chine, gunwale, the deck's centre) from the pod's last ring aft
// under the boom, its end closed. Drawn = flown by construction
let tubGroup = null;
function drawTub(scene, P) {
  if (tubGroup) { dispose(tubGroup); tubGroup = null; }
  if (!scene || !+P.hullOn || !(+P.hullTubLen > 0.05) || !CG2 || !CG2.cageHullLines) return;
  const L = CG2.cageHullLines(P);
  if (!L || !L.tub) return;
  const FS = (CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const rings = [L.tub.from].concat(L.tub.ext).map(s => [[-s.bd, s.yd], [-s.b, s.yc], [0, s.yk], [s.b, s.yc], [s.bd, s.yd], [0, s.yd]]
    .map(([x, y]) => [x * FS, y * FS, s.z * FS]));
  const pos = [], idx = [], n = 6;
  for (const r of rings) for (const p of r) pos.push(p[0], p[1], p[2]);
  for (let k = 0; k + 1 < rings.length; k++)
    for (let j = 0; j < n; j++) { const a = k * n + j, b = k * n + (j + 1) % n, c = (k + 1) * n + j, d = (k + 1) * n + (j + 1) % n; idx.push(a, c, b, b, c, d); }
  const e0 = (rings.length - 1) * n;
  for (let j = 1; j + 1 < n; j++) idx.push(e0, e0 + j + 1, e0 + j);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const SM = typeof window !== 'undefined' && window.CAGE_SECMAT;
  const mat = (SM && SM('float', { cons: 'glass', surf: 0, fieldM: 1, tint0: 0xc9ced3 }))
    || new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
  if (mat && 'side' in mat) mat.side = THREE.DoubleSide;
  tubGroup = new THREE.Group(); tubGroup.name = 'cageLayer:float';
  const m = new THREE.Mesh(g, mat); m.name = 'edHullTub'; m.castShadow = true; m.receiveShadow = true;
  tubGroup.add(m); scene.add(tubGroup);
}
// HULL-B39: THE SPRAY STRAKES (the user, the Super Petrel: "the front ridge really looks like the one of a boat, it has
// protrusions in the fore-aft axis"): hullStrakes a side on the forebody's bottom, evenly across the chine half-beam
// (1/(n+1) apart), from hullStrakeLen of the forebody aft of the bow to the bow. Each is a boat's strake - a flat
// landing hullStrakeW wide, level with its inboard edge, and a vertical face up to the bottom at its outboard edge (a
// wedge, as deep as the deadrise makes it), tapered in over its ends. Laid ON THE DRAWN BOTTOM: each station's heights
// are the drawn skin's under a vertical line (the mesh's own triangles, cage units), so the inboard edge sits flush on
// a flute or a V alike. Spray hardware: like a float's straps and keelsons, the water does not read it
let strakeGroup = null;
function drawStrakes(scene, mesh, P) {
  if (strakeGroup) { dispose(strakeGroup); strakeGroup = null; }
  const n = Math.round(+P.hullStrakes || 0);
  if (!scene || !+P.hullOn || !(n > 0) || !mesh || !mesh.V || !mesh.F || !CG2 || !CG2.cageHullLines) return;
  const L = CG2.cageHullLines(P);
  if (!L || !L.sta || L.sta.length < 3) return;
  const FS = (CG2.CAGE_UNIT || 1) * (P.planeScale || 1), V = mesh.V;
  const sta = L.sta.slice().sort((a, b) => a.z - b.z);
  const zS = L.on ? L.zStep : sta[0].z, zB = L.zBow;
  const len = Math.max(0.2, Math.min(1, +P.hullStrakeLen || 0.8)), w = Math.max(0.01, +P.hullStrakeW || 0.05) / FS;
  const zA = zB - len * (zB - zS) + 0.03 / FS, zF = zB - 0.06 / FS;
  if (!(zF > zA + 0.1 / FS)) return;
  const bAt = z => { let i = 0; while (i + 2 < sta.length && sta[i + 1].z < z) i++;
    const a = sta[i], c = sta[i + 1], t = c.z - a.z > 1e-9 ? Math.max(0, Math.min(1, (z - a.z) / (c.z - a.z))) : 0; return a.b + (c.b - a.b) * t; };
  // the drawn bottom's triangles in the run, bucketed by z
  const NB = 64, bucket = Array.from({ length: NB }, () => []), bz = z => Math.floor((z - zA) / (zF - zA) * NB);
  for (const f of mesh.F) {
    const v = f && f.v; if (!v || v.length < 3) continue;
    for (let t = 1; t + 1 < v.length; t++) {
      const tri = [V[v[0]], V[v[t]], V[v[t + 1]]];
      const lo = Math.min(tri[0][2], tri[1][2], tri[2][2]), hi = Math.max(tri[0][2], tri[1][2], tri[2][2]);
      if (hi < zA || lo > zF) continue;
      for (let k = Math.max(0, bz(lo)); k <= Math.min(NB - 1, bz(hi)); k++) bucket[k].push(tri);
    }
  }
  // the lowest skin under (x, z): a vertical line through the triangles' plan
  const yAt = (x, z) => {
    let best = Infinity;
    for (const [a, b, c] of bucket[Math.max(0, Math.min(NB - 1, bz(z)))] || []) {
      const d = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((x - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (z - a[2])) / d, v2 = ((b[0] - a[0]) * (z - a[2]) - (x - a[0]) * (b[2] - a[2])) / d;
      if (u < -1e-6 || v2 < -1e-6 || u + v2 > 1 + 1e-6) continue;
      best = Math.min(best, a[1] + u * (b[1] - a[1]) + v2 * (c[1] - a[1]));
    }
    return best;
  };
  const SM = typeof window !== 'undefined' && window.CAGE_SECMAT;
  const mat = (SM && SM('fuselage', { surf: 0, fieldM: 1 })) || new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.5 });
  if ('side' in mat) mat.side = THREE.DoubleSide;
  strakeGroup = new THREE.Group(); strakeGroup.name = 'cageLayer:float';
  const NS = 40, sink = 0.003 / FS;
  for (let i = 0; i < n; i++) {
    const q = (i + 1) / (n + 1);
    for (const sd of [-1, 1]) {
      const pos = [], idx = [];
      let ok = 0;
      for (let j = 0; j <= NS; j++) {
        const u = j / NS, z = zA + (zF - zA) * u;
        const tp = Math.min(1, u / 0.12, (1 - u) / 0.12), ww = w * Math.max(0.05, tp);
        const x0 = q * bAt(z), x1 = x0 + ww;
        let y0 = yAt(sd * x0, z), y1 = yAt(sd * x1, z);
        if (!isFinite(y0) || !isFinite(y1)) { y0 = y1 = NaN; } else ok++;
        const yl = Math.min(y0, y1);
        for (const [x, y] of [[x0, y0 + sink], [x1, y1 + sink], [x1, yl]]) pos.push(sd * x * FS, y * FS, z * FS);
      }
      if (ok < NS * 0.6) continue;
      // (a station that missed the skin takes its neighbour's section - the run stays one strip)
      for (let j = 0; j <= NS; j++) if (!isFinite(pos[j * 9 + 1])) {
        const k = j > 0 && isFinite(pos[(j - 1) * 9 + 1]) ? j - 1 : j + 1;
        for (let m = 0; m < 9; m++) if (m % 3 !== 2) pos[j * 9 + m] = pos[k * 9 + m];
      }
      for (let j = 0; j < NS; j++) for (let e = 0; e < 3; e++) {
        const a = j * 3 + e, b = j * 3 + (e + 1) % 3, c = a + 3, d = b + 3;
        if (sd > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
      }
      const e0 = NS * 3;
      if (sd > 0) idx.push(0, 2, 1, e0, e0 + 1, e0 + 2); else idx.push(0, 1, 2, e0, e0 + 2, e0 + 1);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.name = 'edHullStrake' + (sd < 0 ? 'L' : 'R') + i; m.castShadow = true; m.receiveShadow = true;
      strakeGroup.add(m);
    }
  }
  scene.add(strakeGroup);
}
// HULL-B19: THE SPONSONS, drawn from the rows the frame flies (hullSponKg / Y / X / W: a float of the family sized for
// its displacement, HYDRO.tipFloatParams) at the hull's side at their station (the hull's own table, cageHullTable) -
// no struts: the sponson is part of the hull. Rows not fitted yet: nothing drawn (the frame flies the gross rule)
let sponGroup = null;
function drawSponsons(scene, P) {
  if (sponGroup) { dispose(sponGroup); sponGroup = null; }
  if (!scene || !+P.hullOn || !+P.hullSpon || !CG2 || !CG2.cageHullTable) return;
  if (Math.round(+P.hullSpon) === 1) return drawStubs(scene, P);
  if (Math.round(+P.hullSpon) === 3) return;            // (HULL-B29: planing wing roots - the wing draws itself)
  const kg = +P.hullSponKg, yRel = +P.hullSponY, HY = HYc(), FG = window.FLOAT_GEN;
  if (!(kg > 0) || !(yRel > -0.999) || !HY || !HY.tipFloatParams || !FG) return;
  const FS = (CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const TB = CG2.cageHullTable(CG2.cageHullLines(P), FS);
  if (!TB) return;
  const Pt = HY.tipFloatParams(kg), xsS = -(+P.hullSponX || 0.3), w = +P.hullSponW || 0.32;
  const near = TB.sta.reduce((a, s) => Math.abs(s.x - xsS) < Math.abs(a.x - xsS) ? s : a, TB.sta[0]);
  const yK = TB.yStep * FS + yRel, zSt = TB.zStep * FS - xsS - 0.10 * Pt.L;   // (the frame's xT, the cage's z forward)
  const SM = window.CAGE_SECMAT;
  const skinM = (SM && SM('float', { cons: 'glass', surf: 0, fieldM: 1, tint0: 0xd8d2c2 })) || new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.55 });
  sponGroup = new THREE.Group(); sponGroup.name = 'cageLayer:float';
  const o = FG.build(Pt, { HY, detail: 0, rudder: 0, paddle: 0, xAft: Pt.xAft });
  for (const sd of [-1, 1]) {
    const xC = sd * (near.bd + w);
    const toC = v => [xC + v[2], yK + v[1], zSt - v[0]];
    for (const part of [o.hull, o.deck]) {
      if (!part || !part.idx || !part.idx.length) continue;
      const n = part.pos.length / 3, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const c = toC([part.pos[i * 3], part.pos[i * 3 + 1], part.pos[i * 3 + 2]]); pos[i * 3] = c[0]; pos[i * 3 + 1] = c[1]; pos[i * 3 + 2] = c[2]; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(part.idx, 1) : new THREE.Uint16BufferAttribute(part.idx, 1)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, skinM); m.name = 'edSponson' + (sd < 0 ? 'L' : 'R'); if (skinM.side !== undefined) skinM.side = THREE.DoubleSide;
      sponGroup.add(m);
    }
  }
  scene.add(sponGroup);
}
// HULL-B21: THE STUB SPONSONS, the stub the water reads (HYDRO.sponsonTable: mean chord hullSponC, span hullSponK x it,
// thickness hullSponT, flat underneath): a tapered stub wing (tip hullSponTaper of the root, the same mean chord) from
// the hull's side at its station (hullSponX forward of the step), its underside hullSponY over the step keel, rising
// hullSponDih deg out to its tip; a flat-bottomed NACA thickness up top, the tip closed
function drawStubs(scene, P) {
  const c = +P.hullSponC, yRel = +P.hullSponY;
  if (!(c > 0) || !(yRel > -0.999)) return;
  const FS = (CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const TB = CG2.cageHullTable(CG2.cageHullLines(P), FS);
  if (!TB) return;
  const k = +P.hullSponK || 0.75, t = +P.hullSponT || 0.22, tp = Math.max(0.2, Math.min(1, +P.hullSponTaper || 0.65));
  const dih = Math.tan((+P.hullSponDih || 0) * Math.PI / 180), span = k * c, cR = 2 * c / (1 + tp);
  const xsS = -(+P.hullSponX || 0.3), near = TB.sta.reduce((a, s) => Math.abs(s.x - xsS) < Math.abs(a.x - xsS) ? s : a, TB.sta[0]);
  const yLow0 = TB.yStep * FS + yRel, zMid = TB.zStep * FS - xsS;
  const SM = window.CAGE_SECMAT;
  const mat = (SM && SM('fuselage', { surf: 0, fieldM: 1 })) || (SM && SM('float', { cons: 'glass', surf: 0, fieldM: 1, tint0: 0xc9ced3 }))
    || new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.5 });
  if ('side' in mat) mat.side = THREE.DoubleSide;
  sponGroup = new THREE.Group(); sponGroup.name = 'cageLayer:float';
  // HULL-B27 (the user: "proper sponsons, with love into the model"): THE STUB, MODELLED. The section is the stub's
  // NACA thickness over a flat planing bottom, the bottom ROUNDED UP INTO THE NOSE over the first 30 % (a leading edge,
  // not a knife where the flat meets the curve); the planform's leading edge sweeps (the chord closes 70 % from the
  // front) and the tip closes on the wing's own half-ellipse over the outer quarter (no flat cap); the root FLARES into
  // the hull's side - the chord and the thickness swell over the inner 14 % and the root section starts inside the hull,
  // a fillet. 18 cosine-spaced stations x 40 around, one smooth grid. The water reads the stub's table (sponsonTable:
  // the straight-tapered stub at its mean chord); the tip's rounding and the fillet are within ~5 % of its volume
  const NC = 20, NSp = 18, U0 = 0.75, UF = 0.14, sec = [];
  for (let i = 0; i <= NC; i++) sec.push([0.5 * (1 - Math.cos(Math.PI * i / NC)), 1]);          // upper, LE -> TE
  for (let i = NC - 1; i >= 1; i--) sec.push([0.5 * (1 - Math.cos(Math.PI * i / NC)), 0]);      // lower, TE -> LE
  const yt = xc => 5 * t * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
  const nose = xc => xc < 0.3 ? (1 - xc / 0.3) ** 2 : 0;                                      // the bottom's rise into the LE
  for (const sd of [-1, 1]) {
    const pos = [], idx = [], n = sec.length;
    for (let j = 0; j <= NSp; j++) {
      const u = 0.5 * (1 - Math.cos(Math.PI * j / NSp));
      const fil = u < UF ? (1 - u / UF) ** 2 : 0;                                            // the root fillet's swell
      const tipK = u > U0 ? Math.sqrt(Math.max(0.0064, 1 - ((u - U0) / (1 - U0)) ** 2)) : 1;   // the tip's half-ellipse
      const cl = cR * (1 - (1 - tp) * u) * tipK * (1 + 0.28 * fil);
      const zLE = zMid + 0.5 * cR * (1 + 0.28 * fil) - 0.7 * (cR * (1 + 0.28 * fil) - cl);
      const xL = sd * (near.bd - 0.06 + u * (span + 0.06)), yL = yLow0 + u * span * dih;
      const th = 1 + 0.9 * fil;
      for (const [xc, up] of sec) {
        const T = 2 * yt(xc) * cl * th;
        pos.push(xL, yL + (up ? T * (1 - 0.18 * nose(xc)) : -0.18 * T * nose(xc)) + (up ? 0 : 0), zLE - xc * cl);
      }
    }
    for (let j = 0; j < NSp; j++) for (let i = 0; i < n; i++) {
      const a = j * n + i, b = j * n + (i + 1) % n, c2 = (j + 1) * n + i, d = (j + 1) * n + (i + 1) % n;
      idx.push(a, c2, b, b, c2, d);
    }
    // the tip's last section is ~8 % of the chord: closed on its own centre (a point, the grid's normals round it)
    const e0 = NSp * n, ctr = [0, 0, 0];
    for (let i = 0; i < n; i++) for (let q = 0; q < 3; q++) ctr[q] += pos[(e0 + i) * 3 + q] / n;
    const ci = pos.length / 3; pos.push(...ctr);
    for (let i = 0; i < n; i++) idx.push(e0 + i, ci, e0 + (i + 1) % n);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    // (the winding: outward whatever the side - the mirror flips it, so the left stub's faces are turned)
    if (sd < 0) { const I = g.index.array; for (let q = 0; q < I.length; q += 3) { const tq = I[q + 1]; I[q + 1] = I[q + 2]; I[q + 2] = tq; } g.computeVertexNormals(); }
    const m = new THREE.Mesh(g, mat); m.name = 'edSponson' + (sd < 0 ? 'L' : 'R'); m.castShadow = true; m.receiveShadow = true;
    sponGroup.add(m);
  }
  scene.add(sponGroup);
}
PAGE.post = ctx => {
  const { scene, mesh, P, stat } = ctx;
  hullFitStep(P, stat);
  try { drawTub(scene, P); } catch (e) {}
  try { drawSponsons(scene, P); } catch (e) {}
  try { drawStrakes(scene, mesh, P); } catch (e) {}
  // THE STARTER FIRES BEFORE THE CHAIN, like the engine's: the rows it
  // writes are read by this layer's own build below and by the join after
  if (+P.gearFloats) {
    const fire = floatPresetStarter(P);
    if (fire && applyFloatPreset(P, fire)) {
      const UI = window.CAGE_UI;
      if (UI && UI.syncSliders) UI.syncSliders();
    }
  }
  // G3445: the float kit (the seaplane propeller in / out) and its card, after the preset wrote its rows
  {
    const ev = floatKitStep(P);
    if (ev) {
      if (ev.kind === 'fit' || ev.kind === 'restore') { const UI = window.CAGE_UI; if (UI && UI.syncSliders) UI.syncSliders(); }
      floatKitCard(ev, P);
    }
  }
  if (prevPost) prevPost(ctx);
  dispose(group); group = null;
  window.CAGE_FLOAT = null;
  if (!+P.gearFloats) return;
  const HY = HYc();
  if (!HY || !HY.makeFloat) { if (stat) stat.textContent += '  ·  floats: 32_hydro not loaded'; return; }
  const FG = window.FLOAT_GEN;
  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const AF = GG.cageAirframe(mesh, FS);
  if (!AF) { if (stat) stat.textContent += '  ·  floats: no skin to hang on'; return; }

  const HP = hullParams(P);
  const edo = HP.style === 'edo';
  const fk = edo ? Math.sqrt(Math.max(1, HP.scale || 1)) : 1;
  FIELD_FRAME = edo ? EDO_FRAME * fk : FLT_FRAME; FIELD_RAIL = edo ? EDO_RAIL * fk : FLT_RAIL;
  INC = (+P.fltInc || 0) * D2R;
  const F = HY.makeFloat(Object.assign({}, HP, { mLoad: 0, cgLoad: [0, 0, 0], loadI: [0, 0, 0] }));
  // THE STEP STATION: 12 deg aft of the CG at the keel's depth below it,
  // plus the builder's offset. THE CG IS THE FLOWN AEROPLANE'S (app.js
  // publishes it, the join's datums bring it into the cage frame); the gear
  // page's hand-set cgZ is the fallback before the first build, and it was
  // 0.5 m off on the user's ultralight
  const DAT = window.CAGE_DATUM, CGM = window.FLYDIY_CG_MODEL;
  const cgZ = (DAT && DAT.fwOk && CGM) ? DAT.zFw - CGM[0] : +P.cgZ;
  const cgY = (DAT && CGM) ? CGM[1] + DAT.yD : +P.cgY;
  const keelY0 = AF.keelAt(cgZ) - +P.fltDrop;
  let zStep = cgZ - Math.tan(12 * D2R) * Math.max(0.2, cgY - keelY0) + +P.fltZ;
  // the load's station, while no row has changed since (the hold above)
  if (held) {
    const rows = rowsOf(P);
    if (held.rows === null) held.rows = rows;
    if (rows !== held.rows) held = null;
    else if (DAT && DAT.fwOk) zStep = DAT.zFw - held.x;
  }
  // FLAGSHIP (2 Nov, the user's Twin busher floats): A TWIN-BOOM'S POD ENDS AT THE WING, and its CG sits behind it
  // (the engine, the booms, the tail): held 0.3 m inside the pod, the step stood 4-8 deg AHEAD of that CG whatever
  // fltZ said. On twin booms the step may stand up to AFT_REACH behind the pod's end; the rear struts then rake
  // forward to its last frame (root, below). Every other airframe keeps the 0.3 m it had.
  const twin = !!+P.boomTwin, AFT_REACH = 0.6;
  const zc = Math.max(AF.z0 + (twin ? -AFT_REACH : 0.3), Math.min(AF.z1 - 0.3, zStep));
  const keelY = AF.keelAt(Math.max(AF.z0 + 0.05, zc)) - +P.fltDrop;
  const track = +P.fltTrack;

  group = new THREE.Group();
  group.name = 'cageLayer:float';
  scene.add(group);
  const SM = typeof window !== 'undefined' && window.CAGE_SECMAT;
  // G3873: the hull skin wears the field (surf 1, the aluminium grammar: frames, rivet rows, seams); the parts
  // without one (protrusions, the rudder blade, the deck hardware) stay triplanar - one material never mixes the two
  // branches (_surf_check.js). Both are the 'float' section, so the livery paints them as one, and both alloy: every
  // float preset is a Wipline (riveted aluminium), whatever the fuselage is built of.
  // FLOATS-CLASSIC: an EDO hull is BARE, AGED ALLOY whatever the aeroplane is painted (the section `floatBare`, its
  // own finish `agedAlu`: a baked sheet of mismatched skins and seams, rougher and less metallic than a new sheet);
  // the same two materials a Wipline's hull asks for, one section swapped - no new program, no new draw
  const HSEC = edo ? 'floatBare' : 'float', HTINT = edo ? 0xa9afb4 : 0xd8d2c2;
  const hullM = () => (SM && SM(HSEC, { cons: 'alloy', surf: 0, fieldM: 1, tint0: HTINT }))
    || new THREE.MeshStandardMaterial({ color: HTINT, roughness: edo ? 0.62 : 0.55, metalness: 0.05 });
  const hullSkinM = () => (SM && SM(HSEC, { cons: 'alloy', struct: 1, surf: 1, fieldM: 1, tint0: HTINT }))
    || hullM();
  const boardM = () => (SM && SM('floatBoard', { surf: 0, fieldM: 1, tint0: 0x8a6a45 }))
    || new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8, metalness: 0.0 });
  const deckM = () => (SM && SM('floatDeck', { surf: 0, fieldM: 1, tint0: 0x2e3135 }))
    || new THREE.MeshStandardMaterial({ color: 0x2e3135, roughness: 0.95, metalness: 0.0 });
  const strutM = () => (SM && SM('gearLeg', { surf: 0, fieldM: 1, tint0: 0x98a2ad }))
    || GG.gearMat('steel');
  const wireM = () => GG.gearMat('steel');
  const hardM = () => GG.gearMat('alloy');
  const rubberM = () => GG.gearMat('dark');

  const sc = HP.scale;
  const rec = { P: HP, zStep: zc, keelY, track, tetraC: {}, members: [], deck: {}, rud: {}, vol: F.volDeck, cgZ, cgY,
                cgFrom: (DAT && CGM) ? 'flown' : 'page', preset: HP.preset || null,
                // FLOAT-CG (2 Nov): the model-frame CG this step was stood on - the CG handshake's reference (balanceApply)
                cgM: (DAT && DAT.fwOk && CGM) ? [CGM[0], CGM[1]] : null };
  const exG = Math.max(0, P.explodeD || 0) * FS;
  const paddleK = Math.round(P.fltPaddle || 0);
  const fits = {};                                 // per side: the deck fitting points (cage)
  for (const sd of [-1, 1]) {                     // -1 starboard (cage -x), +1 port
    const at = [sd * track, keelY, zc];
    const mirror = sd > 0;                          // the port float is the starboard build mirrored
    const tag = sd > 0 ? 'L' : 'R';
    const ug = new THREE.Group();
    ug.name = 'edFloat' + tag;
    group.add(ug);
    if (exG > 0) ug.position.x += sd * exG;         // explode: outboard (display only)
    // the paddle: "on the left float" = the port float (sd +1); both = both;
    // -1 in the model frame is the float's own port side, which the mirror
    // turns inboard on the port float and which IS inboard on the starboard
    const paddle = paddleK === 2 || (paddleK === 1 && sd > 0) ? -1 : 0;
    let out = null;
    if (FG) {
      out = FG.build(HP, { HY, detail: +P.fltDetail ? 1 : 0, rudder: +P.fltRudder ? 1 : 0, paddle, xAft: HP.xAft });
      const add = (part, mat, nm, field) => { const m = partMesh(part, at, mat, mirror, nm, field); if (m) ug.add(m); return m; };
      const skin = hullSkinM();
      const hullMesh = add(out.hull, skin, 'edFloatHull' + tag, !!SM);
      if (+P.fltAmph && HY.amphibOf) try { amphib(HP, HY, at, mirror, ug, tag, hullMesh, P, rec, out); } catch (e) { console.warn('amphibian floats:', e); }
      if (out.protrusions) add(out.protrusions, hullM());
      if (out.bumper) add(out.bumper, rubberM());
      if (out.deck) add(out.deck, deckM());
      if (out.hard) add(out.hard, hardM());
      if (out.paddle) { add(out.paddle.shaft, hardM()); add(out.paddle.blade, rubberM()); }
      if (out.rudder) {
        add(out.rudder.hard, hardM());
        // THE BLADE IS ITS OWN PART: the game steers it about the post and
        // retracts it about the arms' pivot (app.js reads `rud`)
        const rg = new THREE.Group();
        rg.name = 'edFloatRud' + tag;
        const bm = partMesh(out.rudder.blade, at, hullM(), mirror, 'edFloatRudBlade' + tag);
        if (bm) rg.add(bm);
        group.add(rg);
        const mz = v => [v[0], v[1], mirror ? -v[2] : v[2]];
        rec.rud[tag] = { post: toCage(mz(out.rudder.post), at), axis: dirCage(mz(out.rudder.axis)),
                         pivot: toCage(mz(out.rudder.pivot), at), hinge: dirCage(mz(out.rudder.hinge)) };
      }
    } else {
      // no generator (a headless page without it): the physics loft, bare
      const bag = GK.Bag();
      const vidBy = {};
      const vid = (kind, i) => { const m = vidBy[kind] || (vidBy[kind] = new Map()); if (!m.has(i)) m.set(i, bag.v(toCage(F.V[i], at))); return m.get(i); };
      for (const pn of F.panels) bag.tri(vid(pn.kind, pn.v[0]), vid(pn.kind, pn.v[1]), vid(pn.kind, pn.v[2]));
      bag.mesh(ug, hullM());
    }
    // the tetra the physics rides (32_hydro tetraCtx): step keel, bow keel,
    // step deck edges — the frame's own four nodes, in cage metres
    const sK = F.sta[F.nF], sB = F.sta[0];
    const K = F.V[sK.K], KB = F.V[sB.K], DL = F.V[sK.Dm], DR = F.V[sK.Dp];
    rec.tetraC[tag] = [K, KB, DL, DR].map(v => toCage(v, at));
    // the deck fitting points at the two rigging stations (the same
    // stations FLOAT_GEN put its fitting plates on): inboard and outboard
    const rig = out ? out.rig : { fwd: -Math.min(0.9 * HP.xs, HP.flatK * HP.xs + (+HP.rigFwd || 0)), aft: HP.xAft };
    const fit = (x, inb) => {
      const s = HY.sectionOf(HP, x === 0 ? -1e-9 : x);
      // (FLOATS-CLASSIC: an EDO's fittings sit on the arc just inside its shoulder, FLOAT_GEN's EDO_FIT of it -
      // its topside is an ellipse from the chine, so the old "5 cm in from the edge" is low on the flank)
      const zOut = edo ? 0.85 * s.bd + 0.01 * sc : s.bd - 0.05 * sc;
      // inboard is the model's -z for the starboard float (toward the
      // centreline at cage +x), which the mirror handles for the port one
      const zm = (inb ? -1 : 1) * zOut * (mirror ? -1 : 1);
      // (FLOATS-CLASSIC: on a dome the fitting sits on the shoulder's own height; a flat deck's is yd)
      return toCage([x + 0.12 * sc, HY.deckYAt ? HY.deckYAt(HP, s, zOut) : s.yd, zm], at);
    };
    rec.deck[tag] = { fwdIn: fit(rig.fwd, true), fwdOut: fit(rig.fwd, false), aftIn: fit(rig.aft, true), aftOut: fit(rig.aft, false) };
    fits[tag] = rec.deck[tag];
  }
  // THE RIGGING: struts, spreader bars, wires — members published for the
  // join; drawn as streamlined tubes / airfoil bars / cables
  const ang = +P.fltStrutAng * D2R;
  const sg = GK.Bag(), wg = GK.Bag(), hg = GK.Bag();
  const t = +P.fltStrutR;
  // (a twin-boom's rear strut roots on the pod's last frame, never in the air behind it)
  const root = (z, sd) => { const q = AF.surf(twin ? Math.max(AF.z0 + 0.05, z) : z, sd * ang); return [q[0], q[1], q[2]]; };
  // PILLAR-ANCHORS (2026-11-02, the user: "Floats struts should also preferably go onto these pillars, and not try
  // to go on the door areas, when possible"). The frame hangs the float truss on two fuselage RINGS (61_gen_frame:
  // F[iFwd], the last ring more than 0.10 m ahead of the step, and F[iAft], the first more than 0.10 m aft of it) and
  // those rings are the pillars' (the join measures the cabin off pilCabB / pilPaxA) - but the drawing rooted the
  // struts at the float's own deck stations, wherever the flank was there (measured on the user's twin _4b: 0.4 m
  // and 0.2 m from the nodes they ride, the forward root on the pilot door's skin). `pilSnap` 1 roots each end on
  // the pillar carrying the frame's own ring (PILLAR_SITE.floatRootStations, the frame's rule over the pillars'
  // stations): raked struts, from the deck fittings up to the pillars, as a real installation is rigged. A ring
  // with no pillar on it (the firewall's mount, a long cabin's sub-frame) keeps the deck station and says so.
  let pilF = null, pilA = null, pilWhy = [];
  const PSm = window.PILLAR_SITE;
  let PSx = null;
  if (Math.round(+P.pilSnap || 0) === 1 && PSm && CG2 && CG2.cageResolve && mesh && ctx.spec) {
    try {
      PSx = PSm.pillarsOf(mesh, CG2.cageResolve(ctx.spec), FS);
      let cargoLen = 0;
      try { const RS = window.GARAGE_SPEC && window.GARAGE_SPEC.resolved && window.GARAGE_SPEC.resolved(); cargoLen = +(RS && RS.fuse && RS.fuse.cargoLen) || 0; } catch (e) {}
      const st = PSm.frameStations(PSx, { zFw: PSx.zFw != null ? PSx.zFw : DAT && DAT.fwOk ? DAT.zFw : null, cargoLen });
      const fr = PSm.floatRootStations(st, zc);
      pilF = fr.fwd && fr.fwd.pillar ? fr.fwd.pillar : null;
      pilA = fr.aft && fr.aft.pillar ? fr.aft.pillar : null;
      if (!pilF) pilWhy.push('fwd ' + (fr.fwd ? 'ring ' + fr.fwd.tag : 'no ring') + ' has no pillar');
      if (!pilA) pilWhy.push('aft ' + (fr.aft ? 'ring ' + fr.aft.tag : 'no ring') + ' has no pillar');
    } catch (e) { pilF = pilA = null; pilWhy = ['no pillar record']; }
  }
  // ON A PILLAR THE ROOT GOES DOWN TO THE FRAME'S LOWER LONGERON, UNDER THE DOORS' SILLS: the frame's node is the
  // ring's bottom corner (F[i].BL / BR), and a pillar between two deep doors at the row's angle (45 deg on _4b) put
  // the root at door height, so the raked struts fanned out fore and aft ACROSS the doors' bottoms. The row's angle
  // is walked toward the keel until the root stands 40 mm under the lowest sill of a door on that flank within reach
  // of the struts' fan (or 12 deg off the keel, the least a fitting may take)
  const pilRoot = (z, sd) => {
    let a = ang;
    const sills = ((PSx && PSx.doors) || []).filter(dd => dd.sgn === sd && dd.z1 > z - 1.0 && dd.z0 < z + 1.0).map(dd => dd.yLo);
    if (sills.length) {
      const yMax = Math.min(...sills) - 0.04;
      while (a > 12 * D2R && AF.surf(z, sd * a)[1] > yMax) a -= 0.5 * D2R;
    }
    const q = AF.surf(z, sd * a); return [q[0], q[1], q[2]];
  };
  const member = (pin, tip, bag, tt) => { streamlined(bag, pin, tip, tt); rec.members.push({ pin, tip }); };
  const wire = (a, b) => {
    GK.tube(wg, a, b, 0.0025, 6);
    // a turnbuckle a third of the way from the deck end
    const m = [a[0] + (b[0] - a[0]) * 0.3, a[1] + (b[1] - a[1]) * 0.3, a[2] + (b[2] - a[2]) * 0.3];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]) || 1;
    const e = [m[0] + d[0] / L * 0.045, m[1] + d[1] / L * 0.045, m[2] + d[2] / L * 0.045];
    GK.tube(hg, m, e, 0.007, 8);
    rec.members.push({ pin: a, tip: b });
  };
  // THE WIPLINE TRUSS (G451, the 2350 parts manual section 9 and the
  // installation profile on its p. 97): a side carries THREE struts, all
  // rooted on the spreader bars' inboard deck fittings — the FRONT strut
  // (front bar up to the forward fuselage fitting), the CENTRE strut (aft
  // bar forward-and-up to the same forward fitting) and the REAR strut (aft
  // bar up to the main fitting) — and the fore-aft DRAG WIRE that opposes
  // the centre strut (front bar to the main fitting). Between the floats,
  // at each bar, the "wire pulls" cross: each float's fitting to the
  // fuselage fitting on the OTHER side. The frame flies its own truss
  // (61_gen_frame); this is the drawing, every member two-ended on nodes.
  const roots = {};
  for (const sd of [-1, 1]) {
    const tag = sd > 0 ? 'L' : 'R', d = rec.deck[tag];
    const rF = pilF ? pilRoot(pilF.zc, sd) : root(d.fwdIn[2], sd), rA = pilA ? pilRoot(pilA.zc, sd) : root(d.aftIn[2], sd);
    // TWIN4B-STRUTS (the user, 5 Nov: the 4b "hovers", no front pair; "just do it like in the middle of the passenger door
    // if need be"): the front pair stands over its deck fitting, between pillars if it must, its root under the door's sill
    const rFf = Math.round(+P.fltFrontRing || 0) === 1 ? pilRoot(d.fwdIn[2], sd) : rF;
    roots[tag] = { rF, rA, rFf };
    member(rFf, d.fwdIn, sg, t);           // front
    member(rF, d.aftIn, sg, t);            // centre
    member(rA, d.aftIn, sg, t);            // rear
    // the fuselage fittings: a lug pair at each root
    for (const r of (rFf === rF ? [rF, rA] : [rFf, rF, rA])) GK.boxIn(hg, r, [0.03, 0.012, 0.03], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    if (+P.fltWires) wire(d.fwdIn, rA);    // the drag wire
  }
  // FLOAT-LADDER (the row above): on each side, rails at 1/(n+1) .. n/(n+1) of the front strut's rise, each from the
  // front strut to the rear strut at the same height, run on 0.30 m ahead of the front strut and 0.06 m past the rear
  // (the user's drawing on the sheet, 13 Nov). Round tubes in the struts' paint. DRAWN, NOT FLOWN: their ends sit mid-strut, never on
  // a physics node, so they are not in rec.members (the join's contract: every member two-ended on nodes); a few kg
  const nLad = Math.max(0, Math.min(3, Math.round(+P.fltLadder || 0)));
  if (nLad) {
    const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    const at = (a, b, y) => lerp(a, b, Math.max(0, Math.min(1, (y - a[1]) / ((b[1] - a[1]) || 1e-9))));
    const rr = Math.max(0.010, 0.7 * t), ovF = 0.30 * sc, ovA = 0.06 * sc;
    rec.ladder = [];
    for (const sd of [-1, 1]) {
      const tag = sd > 0 ? 'L' : 'R', d = rec.deck[tag], R0 = roots[tag];
      for (let i = 1; i <= nLad; i++) {
        const y = d.fwdIn[1] + (R0.rFf[1] - d.fwdIn[1]) * i / (nLad + 1);
        const p = at(d.fwdIn, R0.rFf, y), q = at(d.aftIn, R0.rA, y);
        const v = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], L = Math.hypot(v[0], v[1], v[2]) || 1;
        const a = [p[0] - v[0] / L * ovF, p[1] - v[1] / L * ovF, p[2] - v[2] / L * ovF];
        const b = [q[0] + v[0] / L * ovA, q[1] + v[1] / L * ovA, q[2] + v[2] / L * ovA];
        GK.tube(sg, a, b, rr, 10);
        rec.ladder.push({ side: tag, y: +y.toFixed(3), len: +(L + ovF + ovA).toFixed(3) });
      }
    }
  }
  if (+P.fltWires) {
    // the wire pulls: crossed in the transverse plane at each bar
    const L = rec.deck.L, R = rec.deck.R;
    wire(L.fwdIn, roots.R.rFf); wire(R.fwdIn, roots.L.rFf);
    wire(L.aftIn, roots.R.rA); wire(R.aftIn, roots.L.rA);
  }
  if (+P.fltSpread) {
    // THE SPREADER BARS: airfoil section, right across both decks, flush
    // with them (their tops level with the deck), ends on the outboard
    // fittings; the members the frame reads run inboard edge to inboard edge
    const L = rec.deck.L, R = rec.deck.R;
    const tb = 0.055 * sc, cb = 0.16 * sc;
    const lower = p => [p[0], p[1] - 0.5 * tb + 0.002, p[2]];
    for (const [a, b] of [[L.fwdOut, R.fwdOut], [L.aftOut, R.aftOut]]) {
      const sect = [];
      for (let k = 0; k < 18; k++) { const q = 2 * Math.PI * k / 18; sect.push([0.5 * cb * Math.cos(q), 0.5 * tb * Math.sin(q) * (0.85 + 0.15 * Math.cos(q))]); }
      GK.sweep(sg, [lower(a), lower(b)], () => sect, true, [0, 0, 1]);
    }
    rec.members.push({ pin: L.fwdIn, tip: R.fwdIn }, { pin: L.aftIn, tip: R.aftIn });
  }
  // FLOATS-CLASSIC: THE DECK BOARD - planks laid fore and aft across the two spreader bars between the floats (the
  // user's photo: "a wooden board across the spreaders"), a loading step; drawn only with the EDO style and the bars.
  // It takes the draw the EDO's absent non-skid decks gave back (two), so the classic pair is a draw under the Wipline
  const bdg = GK.Bag();
  if (edo && +P.fltBoard && +P.fltSpread) {
    const L = rec.deck.L, R = rec.deck.R, tb = 0.055 * sc;
    // (the bars' tops are their fittings' height + 2 mm - lower() below: the planks lie ON them)
    const yTop = Math.max(L.fwdOut[1], R.fwdOut[1], L.aftOut[1], R.aftOut[1]) + 0.003;
    const zF = 0.5 * (L.fwdOut[2] + R.fwdOut[2]) + 0.12 * sc, zA = 0.5 * (L.aftOut[2] + R.aftOut[2]) - 0.12 * sc;
    const span = Math.abs(L.fwdIn[0] - R.fwdIn[0]), w = Math.min(0.24, 0.10 * span), th = 0.022;
    for (const dx of [-1.05 * w, 0, 1.05 * w])
      GK.boxIn(bdg, [dx, yTop + 0.5 * th, 0.5 * (zF + zA)], [0.5 * w, 0.5 * th, 0.5 * Math.abs(zF - zA) + 0.10 * sc], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  }
  // what the roots stand on, for the status line: the pillar, or the door whose skin a root is on (a finding)
  rec.roots = { fwd: pilF ? pilF.key : null, aft: pilA ? pilA.key : null };
  // (snap off: the editor's status line only - the game's builds never ask)
  if (PSx || (!window.CAGE_IN_GAME && PSm && CG2 && CG2.cageResolve && mesh && ctx.spec)) {
    try {
      const PSy = PSx || PSm.pillarsOf(mesh, CG2.cageResolve(ctx.spec), FS);
      const hit = [];
      for (const tag of ['L', 'R']) for (const r of [roots[tag].rFf, roots[tag].rF, roots[tag].rA]) {
        const h = PSm.inDoor(PSy, r, 0.03, { panelOnly: true });
        if (h && !hit.includes(h.door)) hit.push(h.door);
      }
      rec.rootsOnDoor = hit;
    } catch (e) {}
  }
  const sgp = new THREE.Group(); sgp.name = 'edFloatStruts';
  sg.mesh(sgp, strutM()); wg.mesh(sgp, wireM()); hg.mesh(sgp, hardM());
  if (bdg.tris > 0) bdg.mesh(sgp, boardM());
  sgp.userData.strutMembers = rec.members.map(m => ({ pin: m.pin.slice(), tip: m.tip.slice() }));
  group.add(sgp);

  // THE STAND (the user, live: "the plane renders mostly below the
  // ground. It assumed 3 wheels"). The gear layer found no contacts, so it
  // published pitch 0 and gy 0 and the garage stood the cage with its
  // datum on the floor — the floats and half the fuselage under it. A
  // seaplane on a hard stand sits LEVEL ON ITS KEELS (the flat from the
  // flat's end to the step is the lowest line): the ground is the hulls'
  // lowest point, published on the gear layer's own record so placeEditor
  // (app.js) and the gear's grid read one stand. Gear-layer post ran first
  // (load order), so the record exists; its grid is moved onto the keels.
  let gLow = Infinity;
  for (const sd of ['L', 'R']) for (const q of rec.tetraC[sd]) gLow = Math.min(gLow, q[1]);
  for (const v of F.V) gLow = Math.min(gLow, v[1] + keelY);
  if (isFinite(gLow) && window.CAGE_GEAR && !(window.CAGE_GEAR.contacts && window.CAGE_GEAR.contacts.length)) {
    window.CAGE_GEAR.pitch = 0; window.CAGE_GEAR.gy = gLow;
    scene.traverse(o => { if (o.parent && o.parent.name === 'cageLayer:gear' && o.type === 'GridHelper') { o.rotation.x = 0; o.position.set(0, gLow, 0); } });
    if (+P.gearSit && !scene.children.some(o => o.name === 'cageLayer:gear' && o.children.some(c => c.type === 'GridHelper'))) {
      const grid = new THREE.GridHelper(12, 48, 0x39424e, 0x232a33);
      grid.position.set(0, gLow, 0);
      group.add(grid);
    }
  }
  rec.gy = gLow;
  window.CAGE_FLOAT = rec;
  if (stat) {
    const R = HP.preset && rowOf(HP.preset);
    const pilTxt = Math.round(+P.pilSnap || 0) === 1
      ? `struts on ${[pilF && pilF.key, pilA && pilA.key].filter(Boolean).join(' + ') || 'no'} pillar${pilF && pilA ? 's' : ''}${pilWhy.length ? ' (' + pilWhy.join(', ') + ')' : ''}, ` : '';
    const doorTxt = rec.rootsOnDoor && rec.rootsOnDoor.length ? `a strut root ON the ${rec.rootsOnDoor.join(' / ')} door, ` : '';
    stat.textContent += `  ·  floats${edo ? ' (EDO classic)' : ''}: ${HP.preset || 'custom'} ${HP.L.toFixed(2)} x ${HP.B.toFixed(2)} x ${HP.H.toFixed(2)} m, step z ${zc.toFixed(2)}, keel ${keelY.toFixed(2)}, ` + pilTxt + doorTxt +
      `the pair displaces ${(2 * F.volDeck * 1000).toFixed(0)} kg to the deck${R ? ` (catalogue ${2 * R.flot} max, ${2 * R.disp} rated)` : ''}, ${(2 * HP.mFloat).toFixed(0)} kg of hull` +
      (HY.floatPrice ? `, ${HY.floatPrice(HP).toLocaleString('en')} credits the pair` : '');
    // S1 (G451.1): THE SIZING ADVISOR — the flown aeroplane's all-up mass
    // (app.js publishes it with the CG) against the pair that is fitted
    const M = window.FLYDIY_MASS_MODEL;
    if (M > 0 && HY.floatAdvice) stat.textContent += `  ·  ADVISOR ${HY.floatAdvice(M, HP).line}`;
  }
};
})();
