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
const PRESET_LABELS = PRESET_NAMES.map(n => {
  if (n === CUSTOM) return 'custom (the dials as they are)';
  const R = HY0 && HY0.FLOAT_PRESETS[n];
  return R ? `${n} — ${R.L.toFixed(2)} m, ${R.disp} kg${R.est ? ' (est.)' : ''}` : n;
});

// ---- defaults ------------------------------------------------------------
// The hull rows are the family's (HYDRO.DEF) at the Wipline 1450's size —
// the smallest of the line, the one a fresh ultralight would wear; the
// preset row is a starter, so a builder who wants the 172's floats picks
// the 2350 and the rows follow. The frame's own sizing rule
// (HYDRO.floatParamsFor: a pair displaces 180 % of the gross) is what a
// spec with no drawn float still gets.
const rowsOfParams = Q => ({
  fltL: Q.L, fltStep: Q.xs / Q.L, fltB: Q.B, fltH: Q.H, fltBeta: Q.beta, fltBetaBow: Q.betaBow,
  fltBetaA: Q.betaA, fltHs: Q.hs, fltAft: Q.aftAngle, fltAftCurve: Q.aftCurve, fltFlat: Q.flatK,
  fltStem: Q.stemK, fltRake: Q.rake, fltNoseR: Q.noseR, fltPlan: Q.planK, fltStern: Q.bStern,
  fltFlare: Q.flare, fltMass: Q.mFloat,
  fltSpreadAft: +(0.28 * (Q.scale || 1)).toFixed(2),      // the aft spreader bar, just aft of the step
});
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
  fltStrutAng: 55, fltSpread: 1, fltSpreadAft: 0.36,
});

const on = { when: P => +P.gearFloats };
const onM = { when: P => +P.gearFloats, dim: 'm' };
const GROUP = ['9b · floats', [
  // the switch itself, so a builder can reach the floats without the starter
  // (and GATE PARTS can see the feature is reachable); the wheel stations
  // are off while it is on (the join reads the flag before the contacts)
  ['gearFloats', 'floats (instead of wheels)', 0, 1, 1],
  // THE CATALOGUE (G451): a Wipline row writes the hull rows once
  ['fltPreset', 'Wipline preset (applies once)', 0, Math.max(1, PRESET_NAMES.length - 1), 1, PRESET_NAMES,
   { when: P => +P.gearFloats, optLabels: PRESET_LABELS }],
  ['fltDetail', 'details (covers, hatch, cleats, straps, bumper)', 0, 1, 1, on],
  ['fltRudder', 'water rudders', 0, 1, 1, on],
  // RETRACT-STUDY §8.25: THE AMPHIBIAN - Wipline wheels in the floats (the manufacturer's tyres and layout; the gear
  // position is the gear page's preview row, gearPos)
  // (2: the EDO style - the user's photographs and close-ups, 5 Nov: the nose leg pivots low on the bow's leading edge,
  // pushed down by a piston through a triangle, folding forward and up to hug the stem; no EDO data reached - the
  // geometry is the photographs', the tyres the same hull's Wipline row's)
  ['fltAmph', 'amphibian (wheels in the floats)', 0, 2, 1, ['none', 'Wipline', 'EDO style'], on],
  ['fltPaddle', 'paddle', 0, 2, 1, ['none', 'on the left float', 'on both floats'], on],
  ['hull', [
    ['fltL',      'length',                        2.5, 11.0, 0.01, onM],
    ['fltStep',   'step (fraction from bow)',       0.45, 0.65, 0.005, on],
    ['fltB',      'hull width (deck)',              0.40, 1.50, 0.01, onM],
    ['fltH',      'hull height (step keel to deck)', 0.30, 1.30, 0.01, onM],
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
    ['fltMass',   'hull mass (each)',               10, 400, 1, { when: P => +P.gearFloats, dim: 'kg' }],
  ], on],
  ['placement', [
    ['fltZ',     'step fore / aft (from the rule)', -1.5, 1.5, 0.01, onM],
    ['fltDrop',  'keel below the belly',  0.20, 1.50, 0.01, onM],
    ['fltInc',   'keel incidence °',     -5, 10, 0.5, onM],
    ['fltTrack', 'half track',            0.40, 1.60, 0.01, onM],
  ], on],
  ['struts', [
    ['fltStrutR',  'strut thickness',      0.008, 0.040, 0.001, onM],
    ['fltStrutAng','strut root angle °',  20, 85, 1, on],
    ['fltSpread',  'spreader bars',       0, 1, 1, on],
    ['fltSpreadAft','aft spreader (aft of the step)', 0.10, 1.20, 0.01, onM],
    ['fltWires',   'cross wires',         0, 1, 1, on],
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
  Q.scale = k;
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
  return true;
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
const setPitch = p => { if (!p) return; setTimeout(() => { try { if (window.GARAGE_SPEC && window.GARAGE_SPEC.update) window.GARAGE_SPEC.update({ prop: { pitch: p } }); } catch (e) {} }, 0); };
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
    setPitch(row.pitch);
    return { kind: 'fit', model, row, prev };
  }
  if (!row && +P.fltKit) {
    const back = { D: +P.fltKitPrevD, N: +P.fltKitPrevN, pitch: KIT_PITCHES[+P.fltKitPrevPitch] || null };
    if (back.D > 0) Object.assign(P, { cw_propD: back.D, cw_bladeN: back.N, cw_material: +P.fltKitPrevMat });
    P.fltKit = 0;
    setPitch(back.pitch);
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
    const HY = HYc(), R = HY && ev.model && HY.FLOAT_PRESETS && HY.FLOAT_PRESETS[ev.model];
    const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const propOf = q => (q && q.D > 0 ? q.D.toFixed(2) + ' m' + (q.N ? ', ' + q.N + '-blade' : '') + (q.pitch ? ', ' + q.pitch + ' pitch' : '') : 'the previous propeller');
    const lines = [];
    if (ev.kind === 'fit') lines.push(['Propeller', 'the certified seaplane propeller: <b>' + esc(ev.row.name) + '</b>, replacing ' + esc(propOf(ev.prev)) + '. Taking the floats off puts yours back.']);
    else if (ev.kind === 'restore') lines.push(['Propeller', 'your own propeller is back (' + esc(propOf(ev.prev)) + ').']);
    else lines.push(['Propeller', ev.model && ev.model !== CUSTOM ? 'unchanged: no certified seaplane propeller is listed for the ' + esc(ev.model) + '.'
                                     : 'unchanged. Pick a Wipline model: one with a certified propeller (the 2350, for the Cessna 172) fits it.']);
    if (+P.gearFloats) {
      lines.push(['Ventral fin', +P.finOn && +P.finVentralOn ? 'added under the tail (it comes with floats).' : 'not fitted (switch it on in the fin rows).']);
      lines.push(['Water rudders', +P.fltRudder ? 'fitted on both float sterns.' : 'off.']);
      const pairKg = R ? R.mSys : 2 * (+P.fltMass || 0);
      lines.push(['Weight', '+' + Math.round(pairKg) + ' kg for the pair' + (R ? ' with its rigging (Wipaire)' : ' (the two hulls)') +
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
    a[i * 4] = along; a[i * 4 + 1] = around; a[i * 4 + 2] = along / FLT_FRAME; a[i * 4 + 3] = around / FLT_RAIL;
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
//   ASSUMED (Wipaire publishes none of them; the study lists them as missing): the wheels' drop - their bottoms 0.5 of
//     the main's radius under the step's keel; the stowed main tyre flush with its keel; the trunnion at half the
//     hull's height; the nose trolley's travel (what lands the wheel at the bow tip); the leg's rake (20 deg).
function amphib(HP, HY, at, mirror, ug, tag, hullMesh, P, rec, out) {
  const A = HY.amphibOf(HP.preset, HP.L, HP.H); if (!A) return;
  const G = HY.AMPHIB_GEOM, sec = x => HY.sectionOf(HP, x === 0 ? -1e-9 : x);
  const Rm = HY.TYRE_OD(A.main) / 2, Wm = HY.TYRE_W(A.main), Rn = HY.TYRE_OD(A.nose) / 2, Wn = HY.TYRE_W(A.nose);
  const xs = HP.xs, H = HP.H, xb = -xs, dL = (A.dL != null ? A.dL : 6) * 0.0254, La = HP.L + dL;
  const ykS = sec(0).yk, yg = ykS - 0.5 * Rm;                        // (the ground line: the wheels' bottoms)
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
  rec.amph = rec.amph || { style: Math.round(+P.fltAmph) === 2 ? 'EDO (photographs)' : 'Wipline', model: A.name, est: A.est, main: A.main, mainN: A.mainN, nose: A.nose, dKg: A.dKg, assumed: ['drop', 'stowFlush', 'trunnionH', 'noseTravel', 'noseRake'], fitWhy };
  rec.amph[tag] = { edoPivot: edoNose ? C3(edoNose.pivot) : null, edoRake: edoNose ? edoNose.rake : null, capY: C3([0, yCap, 0])[1], mainAxle: C3(ax0), mainUp: C3(rot(ax0, T, thM)), trunnion: C3(T), noseAxle: C3((edoNose || wipNose).noseAxle), noseUp: C3((edoNose || wipNose).noseUp), thM: +(thM / D2R).toFixed(1) };
}
const prevPost = PAGE.post;
PAGE.post = ctx => {
  const { scene, mesh, P, stat } = ctx;
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
  const hullM = () => (SM && SM('float', { cons: 'alloy', surf: 0, fieldM: 1, tint0: 0xd8d2c2 }))
    || new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.55, metalness: 0.05 });
  const hullSkinM = () => (SM && SM('float', { cons: 'alloy', struct: 1, surf: 1, fieldM: 1, tint0: 0xd8d2c2 }))
    || hullM();
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
    const rig = out ? out.rig : { fwd: -HP.flatK * HP.xs, aft: HP.xAft };
    const fit = (x, inb) => {
      const s = HY.sectionOf(HP, x === 0 ? -1e-9 : x);
      const zOut = s.bd - 0.05 * sc;
      // inboard is the model's -z for the starboard float (toward the
      // centreline at cage +x), which the mirror handles for the port one
      const zm = (inb ? -1 : 1) * zOut * (mirror ? -1 : 1);
      return toCage([x + 0.12 * sc, s.yd, zm], at);
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
    roots[tag] = { rF, rA };
    member(rF, d.fwdIn, sg, t);            // front
    member(rF, d.aftIn, sg, t);            // centre
    member(rA, d.aftIn, sg, t);            // rear
    // the fuselage fittings: a lug pair at each root
    for (const r of [rF, rA]) GK.boxIn(hg, r, [0.03, 0.012, 0.03], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    if (+P.fltWires) wire(d.fwdIn, rA);    // the drag wire
  }
  if (+P.fltWires) {
    // the wire pulls: crossed in the transverse plane at each bar
    const L = rec.deck.L, R = rec.deck.R;
    wire(L.fwdIn, roots.R.rF); wire(R.fwdIn, roots.L.rF);
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
  // what the roots stand on, for the status line: the pillar, or the door whose skin a root is on (a finding)
  rec.roots = { fwd: pilF ? pilF.key : null, aft: pilA ? pilA.key : null };
  // (snap off: the editor's status line only - the game's builds never ask)
  if (PSx || (!window.CAGE_IN_GAME && PSm && CG2 && CG2.cageResolve && mesh && ctx.spec)) {
    try {
      const PSy = PSx || PSm.pillarsOf(mesh, CG2.cageResolve(ctx.spec), FS);
      const hit = [];
      for (const tag of ['L', 'R']) for (const r of [roots[tag].rF, roots[tag].rA]) {
        const h = PSm.inDoor(PSy, r, 0.03, { panelOnly: true });
        if (h && !hit.includes(h.door)) hit.push(h.door);
      }
      rec.rootsOnDoor = hit;
    } catch (e) {}
  }
  const sgp = new THREE.Group(); sgp.name = 'edFloatStruts';
  sg.mesh(sgp, strutM()); wg.mesh(sgp, wireM()); hg.mesh(sgp, hardM());
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
    const R = HP.preset && HY.FLOAT_PRESETS[HP.preset];
    const pilTxt = Math.round(+P.pilSnap || 0) === 1
      ? `struts on ${[pilF && pilF.key, pilA && pilA.key].filter(Boolean).join(' + ') || 'no'} pillar${pilF && pilA ? 's' : ''}${pilWhy.length ? ' (' + pilWhy.join(', ') + ')' : ''}, ` : '';
    const doorTxt = rec.rootsOnDoor && rec.rootsOnDoor.length ? `a strut root ON the ${rec.rootsOnDoor.join(' / ')} door, ` : '';
    stat.textContent += `  ·  floats: ${HP.preset || 'custom'} ${HP.L.toFixed(2)} x ${HP.B.toFixed(2)} x ${HP.H.toFixed(2)} m, step z ${zc.toFixed(2)}, keel ${keelY.toFixed(2)}, ` + pilTxt + doorTxt +
      `the pair displaces ${(2 * F.volDeck * 1000).toFixed(0)} kg to the deck${R ? ` (catalogue ${2 * R.flot} max, ${2 * R.disp} rated)` : ''}, ${(2 * HP.mFloat).toFixed(0)} kg of hull`;
    // S1 (G451.1): THE SIZING ADVISOR — the flown aeroplane's all-up mass
    // (app.js publishes it with the CG) against the pair that is fitted
    const M = window.FLYDIY_MASS_MODEL;
    if (M > 0 && HY.floatAdvice) stat.textContent += `  ·  ADVISOR ${HY.floatAdvice(M, HP).line}`;
  }
};
})();
