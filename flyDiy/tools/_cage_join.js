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
  // THE VISUAL SNAPSHOT (G46): the aeroplane the game FLIES should be
  // the one you built — so build & fly also freezes the editor's meshes
  // (cage frame) into the MODEL frame (x aft, y up, z left: the mesh-
  // aircraft convention) and calibrates the mount the way the PA-18's
  // is calibrated — main wheels onto the sim's axle nodes. app.js's
  // buildModel consumes window.CAGE_VISUAL through the imported-model
  // path: rigid body-frame pose + makeSkinBinding wing flex. Cage ->
  // model is the pure rotation (x,y,z)m = (-z, y, x)c. v1 declared
  // gaps: the visual is not in the save (a reload flies the generated
  // skin until the next build & fly); control surfaces and the prop do
  // not animate on the visual.
  const snapshot = spec => {
    const mount = (() => {           // edSitP: the editor's mount group
      let g = window.CAGE_WING && window.CAGE_WING.group;
      while (g && g.parent && !g.parent.isScene &&
             g.parent.parent && !g.parent.parent.isScene) g = g.parent;
      return g;                      // the inner (pitch) mount
    })();
    if (!mount) return null;
    // calibration: rest-lattice main axles (body frame) vs cage mains
    let off = [0, 0];
    try {
      const RS = resolveSpec(JSON.parse(JSON.stringify(spec)));
      const fr = genFrame(RS.spec);
      const mains = fr.refs.mains.map(i => fr.nodes[i].p);
      const bx = (mains[0][0] + mains[1][0]) / 2,
            by = (mains[0][1] + mains[1][1]) / 2;
      const G2 = window.CAGE_GEAR;
      const cm = G2.contacts.filter(c => c.st && c.st.x > 0.01);
      const cz = cm.reduce((s, c) => s + c.p[2], 0) / cm.length,
            cy = cm.reduce((s, c) => s + c.p[1], 0) / cm.length;
      off = [bx - (-cz), by - cy];   // model x = -cage z, y shared
    } catch (e) { console.warn('cage visual calibration:', e); }
    // merge the build's meshes into groups by material look
    const groups = {}, mats = {};
    mount.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(mount.matrixWorld).invert();
    const tmp = new THREE.Matrix4(), v = new THREE.Vector3();
    mount.traverse(o => {
      if (!o.isMesh || !o.visible || !o.geometry) return;
      const m0 = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m0 || !m0.color) return;
      const key = 'c' + m0.color.getHexString() +
        (m0.transparent ? 'a' + Math.round(m0.opacity * 100) : '');
      if (!mats[key]) mats[key] = { color: m0.color.getHex(),
        ...(m0.transparent ? { opacity: m0.opacity } : {}),
        rough: 0.85, metal: 0 };
      const G3 = groups[key] || (groups[key] = { pos: [], idx: [] });
      tmp.multiplyMatrices(inv, o.matrixWorld);   // object -> cage frame
      const p = o.geometry.attributes.position;
      const base = G3.pos.length / 3;
      for (let i = 0; i < p.count; i++) {
        v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(tmp);
        G3.pos.push(-v.z, v.y, v.x);              // cage -> model frame
      }
      const idx = o.geometry.index;
      if (idx) for (let i = 0; i < idx.count; i++) G3.idx.push(base + idx.getX(i));
      else for (let i = 0; i < p.count; i++) G3.idx.push(base + i);
    });
    for (const k in groups) {
      const g = groups[k];
      groups[k] = { pos: new Float32Array(g.pos),
        uv: new Float32Array((g.pos.length / 3) * 2),
        idx: new Uint32Array(g.idx), nv: g.pos.length / 3 };
    }
    return { cage: true, groups, mats, off, zRoot: 0, surfaces: null };
  };
  window.CAGE_JOIN = {
    export: () => cageJoinSpec(window.CAGE_UI.P, measure(), tables()),
    snapshot,
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
        const spec = window.CAGE_JOIN.export();
        // the visual freezes BEFORE the spec applies: setAircraft('gen')
        // rebuilds the model and must find it already standing
        window.CAGE_VISUAL = snapshot(spec);
        window.GARAGE_SPEC.set(spec);
        const c = document.getElementById('edClose');
        if (c && c.onclick) c.onclick();
      } catch (e) { console.error('build & fly:', e); }
    };
  }
})();
