// CAGE JOIN (G45, ROADMAP P3) — the declared physics-bearing table, as
// code. HANDOVER G45 is the authority: a knob reaches the flown
// aeroplane ONLY through the mapping below — JOINED rows write spec
// fields, MEASURED rows read the built cage through its contracts,
// everything else is the game's default (declared gap) or declared
// cosmetic. Every deepening of physics EDITS THE TABLE FIRST, then this
// file.
//
// `cageJoinSpec(P, M, T)` is PURE — P the panel params, M the
// measurements, T the name tables — so tools/_join_check.js can gate it
// in node against flight_core.js. The browser glue below (game bundle
// only, gated on CAGE_UI_LAZY) gathers M from the live contracts and
// wires the `build & fly` button into the editor bar: export → the G7
// save pipeline (GARAGE_SPEC.set: loadSpec → rebuild → apply →
// enterGarage → WIP autosave) → the editor closes onto the stand, where
// the flown aeroplane IS the one this table just built.
'use strict';

// The engine registry map (JOINED): bench dress presets → POWERPLANTS
// rows. The two fantasy presets (flat twin / flat six) have no registry
// row and fall back to the A-65 — declared in HANDOVER G45.
const CAGE_JOIN_ENGINES = {
  'continental A-65': 'a65_sensenich74',
  'continental O-200': 'o200_eprops',
  'lycoming IO-360': 'io360_mccauley',
  'jabiru 2200': 'jabiru2200_std',
  'VW 2180': 'vw2180_wood',
  'flat twin': 'a65_sensenich74',
  'flat six': 'a65_sensenich74',
  'rotax 912 (flat)': 'rotax912_warp',
  'rotax 277': 'rotax277_pusher',
  'rotax 582': 'rotax582_ivo',
  'P&W R-1830': 'r1830_hs23e50',
  'RC 2212 outrunner': 'outrunner2212_9x47',
  'RC 6374 outrunner': 'outrunner6374_18x10',
  'e-PPG 12 kW': 'eppg_direct_130',
  'FES sustainer': 'fes_folding_100',
  'EMRAX 228': 'emrax228_3blade',
};

function cageJoinSpec(P, M, T) {
  M = M || {}; T = T || {};
  const cam = Math.round(P.wgCamber), thk = Math.round(P.wgThick);
  const tip = (T.TIP_KEYS || [])[Math.round(P.wgTip)] || 'rounded';
  const flap = (T.FLAP_KEYS || [])[Math.round(P.wgFlapType)] || 'none';
  const spec = {
    // ---- JOINED: the wing rows are the game's own params (G31) ----
    wings: [{
      span: P.wgSpan, chord: P.wgChord,
      taper: Math.max(0.2, Math.min(1.0,
        P.wgChordTip / Math.max(0.2, P.wgChord))),
      sweep: P.wgSweep, dihedral: P.wgDihedral, incidence: P.wgIncidence,
      washout: P.wgWashout,
      naca: cam * 1000 + (cam > 0 ? 400 : 0) + thk,
      panels: Math.round(P.wgPanels),
      position: ['high', 'mid', 'low'][Math.round(P.wgPos)] || 'high',
      tip,
      crankAt: P.wgCrankAt > 0 ? P.wgCrankAt : 0,
      dihedralOut: P.wgCrankAt > 0 ? P.wgDihedralOut : null,
      centre: ['solid', 'glass', 'open'][Math.round(P.wgCentre)] || 'solid',
    }],
    bracing: { type: Math.round(P.wgBrace) ? 'cantilever' : 'strut' },
    controls: {
      flap: { type: flap, span: P.wgFlapSpan, chord: P.wgFlapChord },
      aileron: { span: P.wgAilSpan, chord: P.wgAilChord },
    },
    // ---- JOINED: the registry engine, in the CANONICAL form (the
    // spec's field is `engines: [{type,...}]`; flat `engine` is a
    // derived convenience the normaliser would overwrite) ----
    engines: [{
      type: CAGE_JOIN_ENGINES[(T.PRESET_NAMES || [])[Math.round(P.engPreset)]]
        || 'a65_sensenich74',
      mount: 'nose', place: { dx: 0, dy: 0 },
    }],
  };
  // ---- MEASURED: the built cage through its contracts ----
  if (M.gearType) {
    spec.gear = { type: M.gearType };
    if (M.track > 0) spec.gear.track = M.track;
    if (M.contactR > 0) spec.gear.contactR = M.contactR;
  }
  const cab = {};
  if (M.halfW > 0) cab.halfW = M.halfW;
  if (M.cabH > 0) cab.h = M.cabH;
  if (Object.keys(cab).length) spec.cab = cab;
  if (M.tailArm > 0) spec.fuse = { tailArm: M.tailArm };
  if (M.seating) spec.seating = M.seating;
  if (M.pilots >= 1) spec.pilots = M.pilots;
  // the SHAPE rides along (GEN_SPEC_V5 round-trips spec.cage) so the
  // save keeps what you built, even where physics does not read it yet
  if (M.cage) spec.cage = M.cage;
  return spec;
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = { cageJoinSpec, CAGE_JOIN_ENGINES };

// ---- browser glue: measurements + the button (game bundle only) ----
if (typeof window !== 'undefined' && window.CAGE_UI_LAZY) (() => {
  const measure = () => {
    const P = window.CAGE_UI ? window.CAGE_UI.P : {};
    const M = {};
    const G2 = window.CAGE_GEAR || {};
    if (G2.contacts && G2.contacts.length) {
      const mains = G2.contacts.filter(c => c.st && c.st.x > 0.01);
      const single = G2.contacts.find(c => c.st && c.st.x <= 0.01);
      if (mains.length) {
        M.track = 2 * Math.max(...mains.map(c => Math.abs(c.p[0])));
        M.contactR = mains[0].R;
        const mz = mains.reduce((s, c) => s + c.p[2], 0) / mains.length;
        M.gearType = single && single.p[2] > mz ? 'tricycle' : 'taildragger';
      }
    }
    const AF = G2.AF, W = window.CAGE_WING;
    if (AF) {
      const zCab = W && W.anchor ? W.anchor.zCab : 2.0;
      const zs = Math.max(AF.z0 + 0.05, Math.min(AF.z1 - 0.05, zCab - 0.3));
      M.halfW = AF.halfWAt(zs);
      M.cabH = AF.surf(zs, Math.PI)[1] - AF.surf(zs, 0)[1];
      // firewall ~ the skin's forward extreme; tailpost its aft one
      M.tailArm = AF.z1 - AF.z0;
    }
    // crew: the pilot always; seating from the cage's own layout rows
    M.pilots = 1 + ((P.dum2On && P.paxCount >= 1) ? 1 : 0);
    M.seating = (P.paxCount >= 1)
      ? (P.seatLayout === 1 ? 'side2' : 'tandem2') : 'single';
    if (window.CAGE2 && window.CAGE2.cageToSpec)
      try { M.cage = window.CAGE2.cageToSpec(P); } catch (e) {}
    return M;
  };
  const tables = () => ({
    TIP_KEYS: typeof GEN_TIPS !== 'undefined' ? Object.keys(GEN_TIPS) : [],
    FLAP_KEYS: typeof GEN_FLAPS !== 'undefined' ? Object.keys(GEN_FLAPS) : [],
    PRESET_NAMES: (window.ENG_PAGE && window.ENG_PAGE.PRESETS)
      ? Object.keys(window.ENG_PAGE.PRESETS).filter(n => n !== 'bare engine')
      : [],
  });
  window.CAGE_JOIN = {
    export: () => cageJoinSpec(window.CAGE_UI.P, measure(), tables()),
  };
  // THE BUTTON. The editor bar exists in the game DOM at load; the
  // handler runs the whole loop turn: export -> the save pipeline ->
  // back to the stand with the aeroplane this table built.
  const bar = document.getElementById('edBar');
  if (bar) {
    const b = document.createElement('button');
    b.id = 'edFly';
    b.textContent = 'build & fly';
    b.title = 'Export the build through the physics table and put it on the stand';
    bar.appendChild(b);
    b.onclick = () => {
      if (!window.CAGE_UI || !window.GARAGE_SPEC) return;
      try {
        window.GARAGE_SPEC.set(window.CAGE_JOIN.export());
        const c = document.getElementById('edClose');
        if (c && c.onclick) c.onclick();
      } catch (e) { console.error('build & fly:', e); }
    };
  }
})();
