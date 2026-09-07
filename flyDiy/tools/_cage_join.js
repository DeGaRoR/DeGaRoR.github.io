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
// save pipeline (GARAGE_SPEC.update since G63: merge → rebuild → apply →
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
  'Verner Scarlett 7U': 'verner7u_wood',
  'Rotec R3600': 'rotec3600_std',
  'P&W R-985': 'r985_hs2b20',
  'P&W R-1830': 'r1830_hs23e50',
  // THE TWO G165 IN-LINES WERE ORPHANS until 2026-09-05: neither had a row
  // here, so an untouched Mikron or Gipsy preset flew as an A-65 through
  // the fallback below — the four-orphan trap, struck a fifth and sixth
  // time. GATE ENGID now asserts every non-fantasy preset maps to a row.
  'Walter Mikron III': 'mikron3_wood',
  'DH Gipsy Major': 'gipsymajor1_wood',
  // the aero Vs (2026-09-05, the V test)
  'Hirth HM 508D': 'hirth508_wood',
  'Argus As 10C': 'argus10c_wood',
  // the coverage fill (2026-09-05)
  'lycoming O-320': 'o320_mccauley',
  'lycoming O-540': 'o540_hartzell',
  'continental IO-550': 'io550_hartzell3',
  'lycoming IO-720': 'io720_hartzell3',
  'rotax 915 iS': 'rotax915_carbon',
  'Ranger L-440': 'ranger440_wood',
  'Continental W-670': 'w670_hs2b',
  'Jacobs R-755': 'r755_hs2b',
  'Vedeneyev M-14P': 'm14p_v530',
  'P&W R-1340': 'r1340_hs12d40',
  'rotax 503': 'rotax503_wood',
  'EMRAX 268': 'emrax268_carbon',
  'P&W PT6A-42': 'pt6a42_hartzell4',
  'P&W PT6A-60A': 'pt6a60a_hartzell4',
  'RC 2212 outrunner': 'outrunner2212_9x47',
  'RC 6374 outrunner': 'outrunner6374_18x10',
  'e-PPG 12 kW': 'eppg_direct_130',
  'FES sustainer': 'fes_folding_100',
  'EMRAX 228': 'emrax228_3blade',
  // TWO MORE ORPHANS (2026-09-05, found by GATE ENGID's new row): the two
  // certified-class electrics flew as an A-65 under their own names
  'pipistrel E-811': 'e811_velis',
  'SP260D-class': 'sp260d_class',
  // the turboprops (2026-09-05) — a preset without a row here flies as an
  // A-65 through the fallback below, which is the four-orphan trap
  'P&W PT6A-114A': 'pt6a114a_hartzell3',
  'P&W PT6A-34': 'pt6a34_hartzell4',
};

// G132: THE DRAWN BLADE IS THE PHYSICS' AUTHOR. cw_material indexes the cowl
// page's MATERIALS (append-only, its own header's rule); spec.prop.material
// must be a GEN_PROP_MATS key or clampSpec silently converts it to 'wood' —
// so the map is TOTAL over the eight finishes, by family:
//   0 birch, 1 beech      -> wood    (wood laminates — G125's own words,
//                                     "same physics family as wood")
//   2 aluminium           -> alu
//   3 carbon/epoxy        -> carbon
//   4 glass/epoxy         -> carbon  (composite family; glass earns its own
//   5 wood core + CFRP    -> carbon   GEN_PROP_MATS row when it is priced —
//                                     carbon over-prices it, which is the
//                                     safe direction, never an exploit)
//   6 maple, 7 walnut     -> their own G125 rows
// APPEND ONLY, in step with MATERIALS; _join_check walks every entry.
const CAGE_JOIN_PROP_MATS = ['wood', 'wood', 'alu', 'carbon', 'carbon',
                             'carbon', 'maple', 'walnut'];

// G189: THE LAMP BAY'S EDGES AS LOFT STATIONS. The light layer declares the
// bay (station as a fraction of the semispan, half-width in metres) and the
// wing layer cuts it; the flown loft has to carry the same two rows or the
// bay it was drawn with is a strip wide again in flight. One arithmetic, in
// the join (this) and the wing layer (wingCutsOf), off the same panel keys —
// through CAGE_BAY_FROM_P when the light layer is loaded, its defaults when
// a node gate builds without it. Null when no lamp is fitted (G98: the wing
// is cut when the lamp is FITTED, not when it is switched on).
function cageWingCuts(P) {
  if (!P || !+P.lightOn) return null;
  const B = (typeof window !== 'undefined' && window.CAGE_BAY_FROM_P)
    ? window.CAGE_BAY_FROM_P(P)
    : { frac: P.li_bayFrac != null ? +P.li_bayFrac : 0.24,
        half: P.li_bayHalf != null ? +P.li_bayHalf : 0.17 };
  const semi = 0.5 * (+P.wgSpan > 0 ? +P.wgSpan : 10);
  const z = semi * B.frac, h = Math.max(0.02, B.half);
  const cs = [z - h, z + h].filter(v => v > 0.05 && v < semi - 0.05);
  return cs.length === 2 ? cs.map(v => +v.toFixed(4)) : null;
}
if (typeof window !== 'undefined') window.CAGE_JOIN_WING_CUTS = cageWingCuts;

// G185: the SECOND plane, from its own rows — the fields of the first plus
// its position band, cabane height, stagger, nudge and its own controls
function cageJoinPlane2(P, T) {
  const c2 = Math.round(P.w2Camber), t2 = Math.round(P.w2Thick);
  const tip = (T.TIP_KEYS || [])[Math.round(P.w2Tip)] || 'rounded';
  const flap = (T.FLAP_KEYS || [])[Math.round(P.w2FlapType)] || 'none';
  return {
    span: P.w2Span, chord: P.w2Chord,
    taper: Math.max(0.2, Math.min(1.0, P.w2ChordTip / Math.max(0.2, P.w2Chord))),
    tipX: +P.w2TipX || 0,
    dihedral: P.w2Dihedral, incidence: P.w2Incidence, washout: P.w2Washout,
    naca: c2 * 1000 + (c2 > 0 ? 400 : 0) + t2,
    panels: Math.round(P.w2Panels),
    position: ['parasol', 'mid', 'low'][Math.round(P.w2Pos)] || 'low',
    cabaneH: Math.round(P.w2Pos) === 0 ? (+P.w2ParaH || 0.45) : null,
    stagger: +P.w2Stagger || 0,
    place: { dx: 0, dy: +P.w2Dy || 0 },
    tip,
    crankAt: P.w2CrankAt > 0 ? P.w2CrankAt : 0,
    crankChord: P.w2CrankAt > 0 ? +P.w2CrankChord : null,
    crankX: P.w2CrankAt > 0 ? (+P.w2CrankX || 0) : null,
    dihedralOut: P.w2CrankAt > 0 ? P.w2DihedralOut : null,
    centre: ['solid', 'glass', 'open', 'cutout'][Math.round(P.w2Centre)] || 'solid',
    controls: {
      flap: { type: flap, span: P.w2FlapSpan, chord: P.w2FlapChord },
      aileron: { span: +P.w2AilOn ? P.w2AilSpan : 0, chord: P.w2AilChord },
    },
    ...(Math.round(P.w2Cons) > 0
      ? { material: ['carbon', 'tubeFabric', 'wood', 'alloy'][Math.round(P.w2Cons) - 1] } : {}),
  };
}

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
      // G140: the three stations, explicit — sweep is never written (the
      // resolved wing derives sweepEff from what the stations do), and
      // tipX 0 is a real value: straight
      tipX: +P.wgTipX || 0,
      dihedral: P.wgDihedral, incidence: P.wgIncidence,
      washout: P.wgWashout,
      naca: cam * 1000 + (cam > 0 ? 400 : 0) + thk,
      panels: Math.round(P.wgPanels),
      position: ['high', 'mid', 'low', 'parasol'][Math.round(P.wgPos)] || 'high',
      // G185: a parasol's cabane height (null on every other position)
      cabaneH: Math.round(P.wgPos) === 3 ? (+P.wgParaH || 0.45) : null,
      tip,
      crankAt: P.wgCrankAt > 0 ? P.wgCrankAt : 0,
      crankChord: P.wgCrankAt > 0 ? +P.wgCrankChord : null,
      crankX: P.wgCrankAt > 0 ? (+P.wgCrankX || 0) : null,
      dihedralOut: P.wgCrankAt > 0 ? P.wgDihedralOut : null,
      centre: ['solid', 'glass', 'open', 'cutout'][Math.round(P.wgCentre)] || 'solid',
      // G189: the lamp bay's edges as loft stations (null = none), the same
      // arithmetic the wing layer uses, so the flown loft has the bay's rows
      cuts: cageWingCuts(P),
      // THE WING'S OWN CONSTRUCTION (G116): 0 says nothing — absent means
      // the aeroplane's own material, which is what every build before this
      // field existed already meant. 1..4 in intCons's display order.
      ...(Math.round(P.wgCons) > 0
        ? { material: ['carbon', 'tubeFabric', 'wood',
                       'alloy'][Math.round(P.wgCons) - 1] } : {}),
    }, ...(+P.w2On ? [cageJoinPlane2(P, T)] : [])],
    bracing: { type: Math.round(P.wgBrace) ? 'cantilever' : 'strut',
               // G185: the cabane's drawing style rides only when there is one
               ...(Math.round(P.wgPos) === 3 || +P.w2On
                   ? { cabane: Math.round(P.bpCabane || 0) ? 'V' : 'N' } : {}),
               // ...and the truss only on a biplane (absent = the defaults)
               ...(+P.w2On ? { interplane: ['N', 'I', 'none'][Math.round(P.bpInter || 0)] || 'N',
                               interplaneAt: +P.bpInterAt || 0.62,
                               wires: ['none', 'both', 'flying'][Math.round(P.bpWires == null ? 1 : P.bpWires)] || 'both' }
                           : {}) },
    controls: {
      flap: { type: flap, span: P.wgFlapSpan, chord: P.wgFlapChord },
      // G185: the aileron switch — off is a span of 0, which the clamp admits
      aileron: { span: (P.wgAilOn == null || +P.wgAilOn) ? P.wgAilSpan : 0,
                 chord: P.wgAilChord },
    },
    // ---- JOINED: the registry engine, in the CANONICAL form (the
    // spec's field is `engines: [{type,...}]`; flat `engine` is a
    // derived convenience the normaliser would overwrite) ----
    // JOINED (2026-09-04): THE MOUNT IS THE DRAWN MOUNT. engMount is the
    // engine layer's row; the station each drawn unit was placed at
    // (M.engUnits, measured off the layer in the model frame) rides in as
    // x/y/z so the frame hangs the mass and the thrust where the engine was
    // drawn; a wing pair is two entries. Absent measurements = the spec's
    // own derivation for that mount.
    engines: (() => {
      const mk = ['nose', 'pusher', 'wingTop', 'wing'][Math.round(P.engMount || 0)]
               || 'nose';
      const type = CAGE_JOIN_ENGINES[(T.PRESET_NAMES || [])[Math.round(P.engPreset)]]
                || 'a65_sensenich74';
      const EU = Array.isArray(M.engUnits) ? M.engUnits : [];
      const aimK = Math.round(P.engAim || 0);
      const aim = aimK === 1 ? 'puller' : aimK === 2 ? 'pusher' : null;
      const one = i => ({
        type, mount: mk, place: { dx: 0, dy: 0 },
        ...(aim && mk !== 'nose' && mk !== 'pusher' ? { aim } : {}),
        ...(mk !== 'nose' && EU[i] ? { x: EU[i].x, y: EU[i].y, z: Math.abs(EU[i].z) } : {}),
        ...(mk === 'wingTop' ? { pylon: Math.max(0.05, +P.engPylonH || 0.30) } : {}),
        // G134: THE DRAWN ENGINE IS THE PHYSICS' AUTHOR — the G132 prop rule,
        // applied to the engine itself. M.engineFacts is engResolve over the
        // same dial dict the mesh build renders (CAGE_ENG_FACTS, one keeper in
        // _cage_eng.js), and it is null exactly when the dials still ARE the
        // applied preset (identity ruling 2026-09-01: an untouched preset
        // flies the registry row under its certified name; a deviated one is
        // "modified <name>"/"custom ...", never a wrong name). The preset key
        // above survives as the fallback row and the prop-diameter default.
        ...(M.engineFacts ? { custom: M.engineFacts } : {}),
        // G194: the hand, seen from behind (+1 clockwise). A pair's row says
        // same hand / tops inward / tops outward; tops inward is port +1,
        // starboard -1 (down-going blades inboard). A single mount is +1.
        sense: mk === 'wing' && Math.round(P.engRotate || 0)
          ? ((i === 0) === (Math.round(P.engRotate) === 1) ? 1 : -1) : 1,
      });
      return mk === 'wing' ? [one(0), one(1)] : [one(0)];
    })(),
    // ---- G132: THE PROPELLER FLIES AS DRAWN. spec.prop is the thrust
    // model's whole input (Tstatic, kV2, disc, mass all derive from D,
    // blades, material — "a bigger disc really does pull harder"), and the
    // cowl page's blade rows have drawn D, count and finish since G21§4
    // with nothing wiring them across: a 3-m drawn disc flew on the
    // registry default's physics. The G121.1 fairing rule, applied: these
    // are PARAMS, not measurements — the drawn blade is generated FROM
    // them, so the switch is the geometry's own declaration. `pitch` stays
    // the design tile's alone (no drawn twist stands for it yet). clampSpec
    // bounds D and blades; the material map above keeps clampSpec's
    // unknown->wood fallback unreachable.
    prop: Object.assign({},
      +P.cw_propD > 0 ? { D: +P.cw_propD } : {},
      Math.round(P.cw_bladeN) >= 2
        ? { blades: Math.round(P.cw_bladeN) } : {},
      CAGE_JOIN_PROP_MATS[Math.round(P.cw_material)]
        ? { material: CAGE_JOIN_PROP_MATS[Math.round(P.cw_material)] } : {}),
  };
  // ---- MEASURED: the built cage through its contracts. SECTIONED keys
  // only (G48): `cab`/`fuse`/`seating`/`pilots` are DERIVED aliases that
  // genAlias rebuilds FROM the sections at the end of resolveSpec — a
  // measurement written flat survives normalisation as a dead top-level
  // key and is then overwritten by the default-derived section, so it
  // never reaches the frame (the same trap the engine row hit in G45,
  // one comment up). Likewise `contactR` is recomputed from `wheelR`
  // (× cos camber) inside resolveSpec, so the measured wheel radius
  // must land on `wheelR` to matter.
  if (M.gearType) {
    spec.gear = { type: M.gearType };
    if (M.track > 0) spec.gear.track = M.track;
    if (M.contactR > 0) spec.gear.wheelR = M.contactR;
    // G51: the measured third wheel — axle height in the keel datum,
    // station firewall-anchored. clampSpec bounds them.
    // G52: the mains STATION is measured (gear.x).
    // G53: the RIDE HEIGHT too (gear.y) — the snap-blocker made it safe.
    if (typeof M.gearX === 'number' && isFinite(M.gearX))
      spec.gear.x = M.gearX;
    if (typeof M.gearY === 'number' && isFinite(M.gearY))
      spec.gear.y = M.gearY;
    if (typeof M.twX === 'number' && isFinite(M.twX))
      spec.gear.twX = M.twX;
    if (typeof M.twY === 'number' && isFinite(M.twY))
      spec.gear.twY = M.twY;
    if (M.twR > 0) spec.gear.twR = M.twR;
    // G121.1: THE FAIRING SWITCH REACHES THE PHYSICS. The mains' three-state
    // row ('none'/'spat'/'trousers') has drawn the shell since the gear
    // bench, and since G115 the spec's `gear.fairing` prices it
    // (genGearCdA: spat 0.22 vs bare 0.55 on the wheel's frontal, trousers
    // fair the legs too) — this line is the wire between them. A PARAM, not
    // a measurement, deliberately: the drawn spat is generated FROM s1Fair,
    // so the switch IS the geometry's own declaration, the same way accOn
    // rides.
    spec.gear.fairing = ['none', 'spat', 'full'][Math.round(P.s1Fair || 0)]
                        || 'none';
    // G121.2: the third wheel's switch rides too — and since G133 the
    // castor draws its own shell, so genGearCdA prices it on EVERY leg
    // family (the tricycle-only gate is retired).
    spec.gear.twFairing = ['none', 'spat', 'full'][Math.round(P.s2Fair || 0)]
                          || 'none';
    // G133: the fairing's remaining physics-bearing fields, PARAMS all by
    // s1Fair's own rule (each drawn shell is generated FROM these rows).
    // Skirt, rake and width stay cage-side only — geometry the drag model
    // deliberately does not resolve; spec.cage carries them home.
    spec.gear.legFair = Math.round(P.s1LegFair || 0) ? 'fair' : 'none';
    spec.gear.twLegFair = Math.round(P.s2LegFair || 0) ? 'fair' : 'none';
    spec.gear.fairTail = +P.s1FairTail || 1;
    spec.gear.twFairTail = +P.s2FairTail || 1;
    spec.gear.fairMat = ['glass', 'carbon', 'alloy'][Math.round(P.fairCons || 0)]
                        || 'glass';
    // G132: THE DRAWN LEG IS THE SUSPENSION. GEN_SUSPENSION (spring rate,
    // damping, price) read spec.gear.suspension while the mains' shock rows
    // drew coil-over/bungee/oleo from s1_shockKind with nothing between
    // them — a bungee flew wearing an oleo. Same G121.1 rule as the
    // fairing: the drawn mechanism IS the declaration. The MAINS row wins
    // (the physics has one suspension arch; the third wheel's own shock
    // stays cosmetic until GEN_SUSPENSION grows a second seat) — the
    // _gear_gen mode order, spring(0)/bungee(1)/oleo(2), verbatim.
    // G133 (the slider-physics audit's flag): the LEG KIND is the outermost
    // drawn mechanism — a beam leg IS a spring-steel blade and a telescopic
    // leg IS an oleo, whatever the (link-only) shock row happens to hold.
    // Only the swinging link actually has a shock choice to read.
    const s1leg = Math.round(P.s1Leg);
    spec.gear.suspension =
      s1leg === 0 ? 'spring' : s1leg === 2 ? 'oleo' :
      ['spring', 'bungee', 'oleo'][Math.round(P.s1_shockKind)] || 'bungee';
  }
  const cabin = {};
  // JOINED (2026-09-04): glazing off is an open cockpit — no glass billed
  if (P.glazeOn != null && !+P.glazeOn) cabin.glazing = 'none';
  if (M.halfW > 0) cabin.halfW = M.halfW;
  if (M.cabH > 0) cabin.h = M.cabH;
  if (M.seating) cabin.seating = M.seating;
  if (M.pilots >= 1) cabin.pilots = M.pilots;
  // `pax` is a LOADING and 0 is a real value, so it is written whenever the
  // measurement produced one — `>= 1` would make an empty cabin unwriteable
  // and leave whatever the spec had before, which is the opposite of what a
  // snapshot is for.
  if (typeof M.pax === 'number' && M.pax >= 0) cabin.pax = M.pax;
  // G52: the cabin's x-extent from the pillar rings
  if (M.noseGap > 0) cabin.noseGap = M.noseGap;
  if (M.cabLen > 0) cabin.len = M.cabLen;
  // the measured seat stations (see M.seatsX above); absent = the frame's own
  // pillar rule, which is what every fiche and every older save still gets
  if (Array.isArray(M.seatsX) && M.seatsX.length) cabin.seatsX = M.seatsX;
  // G180: the drawn CAPACITY and the seat-by-seat OCCUPANCY, both off the same
  // seat list as seatsX (see M.seats / M.occupied above). Written whenever
  // measured — an all-empty cabin is a real answer, same ruling as `pax`.
  if (typeof M.seats === 'number' && M.seats >= 1) cabin.seats = M.seats;
  if (Array.isArray(M.occupied) && M.occupied.length) cabin.occupied = M.occupied;
  if (Object.keys(cabin).length) spec.cabin = cabin;
  // G52: the wing's fore-aft station, from the wing layer's own anchor
  if (typeof M.wingXLE === 'number' && isFinite(M.wingXLE))
    spec.wings[0].xLE = M.wingXLE;
  // G49: the tail-end section and the cowl deck ride with the tail arm —
  // clampSpec's envelope bounds them, and tailY stays 0 (it is the
  // editor's OFFSET knob; these are absolute measurements).
  const fus = {};
  // JOINED (2026-09-04): THE COVERING IS THE DRAWN COVERING. `skinOn` 0 has
  // culled the fuselage skin and every liner from the drawn (and so the
  // flown) mesh since G26.4 while the physics went on billing the cloth and
  // pricing a faired pod — a naked aeroplane that flew covered. The G121.1
  // rule: the drawn state IS the declaration. Absent = 'skin', the default.
  if (!(P.skinOn == null || +P.skinOn)) fus.covering = 'open';
  // G199.5: THE BOOM'S CONSTRUCTION is the cage's own declaration — the frame
  // keys a rod boom's stiffening on it (GEN_RULES.rodBoomK), because the
  // lattice it flies is not the tube it draws. Written on every join: the
  // cage IS the declaration, a save predating the field takes it on load.
  fus.boom = (+P.boomTwin || Math.round(+P.boomStyle || 0) === 2) ? 'twin'
           : Math.round(+P.boomStyle || 0) === 1 ? 'rod' : 'loft';
  if (M.tailArm > 0) fus.tailArm = M.tailArm;
  if (M.postGap > 0) fus.postGap = M.postGap;
  // G54: the boom's path between the measured endpoints. clampSpec
  // falls back to 'straight' if the key is ever not a GEN_SHAPES row.
  if (M.shape) fus.shape = M.shape;
  // G54.1: every boom section, measured. Wins over the family when set.
  if (Array.isArray(M.profile) && M.profile.length >= 2)
    fus.profile = M.profile;
  if (M.tailW > 0) fus.tailW = M.tailW;
  if (typeof M.tailBot === 'number' && isFinite(M.tailBot))
    fus.tailBot = M.tailBot;
  if (M.tailTop > 0) fus.tailTop = M.tailTop;
  if (M.cowlDeck > 0) fus.cowlDeck = M.cowlDeck;
  if (Object.keys(fus).length) spec.fuselage = fus;
  // G54.3: the tail surfaces, measured off the placed fin/stab layers.
  // clampSpec's envelope bounds every one; anything unmeasured keeps the
  // volume-coefficient derivation.
  const tl = {};
  if (M.hSpan > 0) tl.hSpan = M.hSpan;
  if (M.hChord > 0) tl.hChord = M.hChord;
  if (M.hX > 0) tl.hX = M.hX;
  if (M.vHeight > 0) tl.vHeight = M.vHeight;
  if (M.vChord > 0) tl.vChord = M.vChord;
  if (M.vX > 0) tl.vX = M.vX;
  if (M.vSweep === 0) tl.vSweep = 0;
  if (typeof M.stabH === 'number' && isFinite(M.stabH)) tl.stabH = M.stabH;
  // the V (2026-09-04): the cant the stab layer built, clampSpec's own
  // envelope (20-55) bounds it; absent = 'conventional', the default
  if (typeof M.tailCant === 'number' && M.tailCant >= 20) {
    tl.type = 'v'; tl.vAngle = M.tailCant;
  }
  // twin booms (2026-09-04): the type, the half-track and the length — the
  // two fins are one Sv (the spec doubles the measured fin)
  if (M.boomX > 0) {
    tl.type = 'twinBoom'; tl.boomX = M.boomX; tl.boomLen = M.boomLen;
    if (M.boomR > 0) tl.boomR = M.boomR;
  }
  // THE TAIL'S OWN CONSTRUCTIONS (G116), same contract as the wing's:
  // 0 says nothing, absent means the aeroplane's own material
  {
    const CONS4 = ['carbon', 'tubeFabric', 'wood', 'alloy'];
    if (Math.round(P.finCons) > 0)
      tl.finMaterial = CONS4[Math.round(P.finCons) - 1];
    if (Math.round(P.stCons) > 0)
      tl.stabMaterial = CONS4[Math.round(P.stCons) - 1];
  }
  if (Object.keys(tl).length) spec.tail = tl;
  // the SHAPE rides along (GEN_SPEC_V5 round-trips spec.cage) so the
  // save keeps what you built, even where physics does not read it yet
  if (M.cage) spec.cage = M.cage;
  // ...AND SO DOES THE FINISH (G105), one line below the shape and through the
  // same door, because it is the same kind of thing: a complete answer about
  // THIS aeroplane, written as deviations.
  //
  // `!== undefined` and not truthiness, unlike the shape above. NULL IS AN
  // ANSWER HERE — it means the factory finish — and skipping it would make
  // "I stripped the paint off" indistinguishable from "I did not measure the
  // paint", so a build that had a tint could never go back to plain.
  if (M.finish !== undefined) spec.finish = M.finish;
  if (M.energy !== undefined) spec.energy = M.energy;
  return spec;
}


// ===========================================================================
// THE VIEW IS NOT THE AEROPLANE (G106)
// ===========================================================================
// `snapshot` below freezes the editor's meshes into the mesh that FLIES, as
// drawn. So every control that changes how the build is DRAWN is one more way
// to fly the wrong aeroplane — and each one so far was found the same way, by
// somebody noticing their aeroplane looked wrong in the air:
//
//   G47  the section colours   "the fuselage is suddenly all grey"
//   G63  the explode distance  an aeroplane frozen mid-explosion
//   G106 the family alphas     a see-through aeroplane (4 translucent
//                              materials became 18)
//   G106 wireframe, the field  an aeroplane with NO FUSELAGE (409,944
//                              vertices down to 276,114)
//
// The first two were fixed with a save-force-restore pair each, which is the
// right shape at the wrong scale: four pairs is four chances to forget a
// restore, and — the actual failure — nothing anywhere LISTED the controls, so
// the other four sat there through two chantiers.
//
// So this is the list. Every display control the editor shows is in exactly
// one of these two tables, and GATE VIEW holds them against editor.js's own
// RAIL in BOTH directions: a control nobody decided is red, and a decision for
// a control that no longer exists is red too.
//
// The neutral is a CONSTANT, never computed from the state being neutralised.
// A `to` that reads the current value is a neutralisation that agrees with
// whatever it finds.
const _vEl = id => (typeof document !== 'undefined'
  ? document.getElementById(id) : null);
// NULL FROM A GETTER MEANS THIS BUILD HAS NO SUCH CONTROL, which is not the
// same as "already neutral": the game has no curvature-heat or template-step
// control at all (they are bench instruments), and forcing a value into a
// missing element would be writing to nothing and restoring nothing.
const _vChk = id => ({
  get: () => { const e = _vEl(id); return e ? e.checked : null; },
  set: v => { const e = _vEl(id); if (e) e.checked = v; } });
const _vSel = id => ({
  get: () => { const e = _vEl(id); return e ? e.value : null; },
  set: v => { const e = _vEl(id); if (e) e.value = v; } });
const _vView = k => ({
  get: () => ((typeof window !== 'undefined' && window.CAGE_VIEW)
    ? window.CAGE_VIEW[k] : null),
  set: v => { if (typeof window !== 'undefined' && window.CAGE_VIEW)
    window.CAGE_VIEW[k] = v; } });
const _vParam = k => ({
  get: () => ((typeof window !== 'undefined' && window.CAGE_UI)
    ? (+window.CAGE_UI.P[k] || 0) : null),
  set: v => { if (typeof window !== 'undefined' && window.CAGE_UI)
    window.CAGE_UI.P[k] = v; } });

const VIEW_STATE = [
  { row: 'explode',         ..._vParam('explodeD'), to: 0 },
  { row: 'section colours', ..._vChk('color'),      to: true },
  // THE THREE THAT REPLACE THE FUSELAGE MESH OUTRIGHT. build() picks one of
  // surfMesh / curvatureMesh / quadWire / meshFrom, so with any of these on
  // there is no skin in the scene for the capture to find at all.
  { row: 'wireframe',       ..._vChk('wire'),       to: false },
  { row: 'curvature heat',  ..._vChk('curv'),       to: false },
  { row: 'surface field',   ..._vSel('surf'),       to: 'off' },
  { row: 'template step',   ..._vSel('step'),       to: 'crease' },
  // THE X-RAY KNOBS. All four default to 1 and exist to see through the
  // aeroplane while you build it; the capture records `material.opacity`
  // verbatim, so a fuselage left at 0.30 to look at the seats flies at 0.30.
  { row: 'fuselage α',      ..._vView('bodyA'),     to: 1 },
  { row: 'int skin α',      ..._vView('skinA'),     to: 1 },
  { row: 'structure α',     ..._vView('structA'),   to: 1 },
  { row: 'cowl α',          ..._vView('cowlA'),     to: 1 },
  // SEE INSIDE is the sixth X-ray knob and the most dangerous of them: one
  // click takes the whole covering to 0.12, so an aeroplane captured with it
  // on would FLY see-through. It is neutralised here and not exempted for
  // exactly that reason — it changes `material.opacity`, which is what the
  // capture records verbatim.
  { row: 'see inside',      ..._vView('xray'),      to: 0 },
  // PINNED, AND NOT OFFERED (G106.1). The game shows no subsurf control at all
  // — editor.js's rail does not list it and _cage_ui.js does not adopt it —
  // so this is belt and braces rather than a neutralisation anybody can defeat
  // today. It is here because "the element happens to be hidden and happens to
  // default to 2" is not a guarantee, and because a bench page that ever grew
  // a capture would need it. `hidden` says the rail is right not to list it,
  // which is the one direction GATE VIEW would otherwise call a ghost.
  { row: 'subsurf', ..._vSel('lvl'), to: '2',
    hidden: 'a bench instrument, not a display option: the subdivision level ' +
      'is how smooth the aeroplane IS. The game pins it at 2 and offers no ' +
      'control for it' },
];

// LOOKED AT, AND DELIBERATELY LEFT ALONE. Each was MEASURED, not assumed —
// the numbers are in HANDOVER G106.
const VIEW_KEEP = {
  'glass α':
    'glazing is MEANT to be transparent: 0.35 is the designed look and not ' +
    'an X-ray setting, so forcing it to 1 would fly solid windows',
  'control cage':
    'a LineSegments overlay, and the capture takes meshes only (measured: ' +
    'no change to the vertex count with it on)',
  'canopy loops':
    'a Line overlay, same as the control cage (measured: no change)',
  'cutaway':
    'a renderer clipping plane — it hides geometry from the CAMERA and ' +
    'nothing from the capture (measured: no change)',
  'clicking':
    'what a CLICK on the covering or a longeron SELECTS — the bay you '
    + 'clicked, or the whole fuselage. It moves no vertex and touches no '
    + 'material: the capture takes geometry and materials, and which part '
    + 'the panel is heading is neither (measured: identical vertex counts '
    + 'in both positions, selected or not)',
  'smoothing':
    'the RESOLVE PASS\'s tier (G144: 4x MSAA / 8x MSAA / 8x + 1.25x + '
    + 'dither). It changes how the FRAME is resolved and nothing about the '
    + 'aeroplane: the pass runs after the scene has been drawn, and the '
    + 'capture bakes geometry and materials, neither of which it touches. '
    + 'It owns no colour either: the target is sRGB-encoded, so tone mapping '
    + 'and blending stay exactly where they were and the pass only filters '
    + 'and dithers what the materials already wrote',
  'selection':
    'the highlight STYLE (G132: detail outline / silhouette / soft glow). ' +
    'Every style is the editor\'s own `edHi` overlay and never the part; ' +
    'snapshot()\'s bake skips edHi meshes — a skip G132 itself had to add, ' +
    'because `fill` had leaked its wash meshes into the capture since G95 ' +
    '(measured: 105,102 extra vertices; identical counts in every style ' +
    'after the skip, selected or not)',
};

if (typeof module !== 'undefined' && module.exports)
  module.exports = { cageJoinSpec, cageWingCuts, CAGE_JOIN_ENGINES, CAGE_JOIN_PROP_MATS,
                     VIEW_STATE, VIEW_KEEP };

// ---- browser glue: measurements + the button (game bundle only) ----
if (typeof window !== 'undefined' && window.CAGE_UI_LAZY) (() => {
  // the editor's inner (pitch) mount — the frame every capture and every
  // layer-bounds measurement is taken in (shared by snapshot and measure)
  const edMount = () => {
    let g = window.CAGE_WING && window.CAGE_WING.group;
    while (g && g.parent && !g.parent.isScene &&
           g.parent.parent && !g.parent.parent.isScene) g = g.parent;
    return g;
  };
  // mount-frame bounds of the TAIL SURFACES, classified geometrically in
  // one traversal: aft of the pax pillar, OUTBOARD of the boom = stab, ABOVE
  // the boom's deck = fin. The boom skin fails both classifiers; the
  // tailwheel fails both.
  //
  // G199: THE WALK IS OVER THE TAIL LAYERS, NOT THE WHOLE MOUNT. "Wing,
  // struts and gear are forward of the region" was an assumption, and on a
  // short-cabin build it is false: the region starts 0.8 m ahead of the aft
  // pillar, which on the user's ultralight was 0.09 m AHEAD of the wing's
  // trailing edge, so the wing's TE vertices (|x| up to 5.9) were counted as
  // stab — hSpan 11.8 m, hChord 3.25 m, the stab 1.5 m forward of where it
  // is. The fin and stab layers are named groups on the mount
  // (`cageLayer:fin`, `cageLayer:stab` — layerBounds finds them the same
  // way), so the walk is over those and nothing else; the whole mount is
  // the fallback only when neither group exists, which is a bench without
  // the tail layers loaded.
  const tailSurfBounds = (zAft, boomHalfW, yDeckRel, yD) => {
    const mnt = edMount();
    if (!mnt || typeof THREE === 'undefined') return null;
    mnt.updateMatrixWorld(true);
    const roots = [];
    mnt.traverse(o => {
      if (o.name === 'cageLayer:stab' || o.name === 'cageLayer:fin') roots.push(o);
    });
    if (!roots.length) roots.push(mnt);
    const inv = new THREE.Matrix4().copy(mnt.matrixWorld).invert();
    const tmp = new THREE.Matrix4(), v = new THREE.Vector3();
    const mk = () => ({ x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9,
                        z0: 1e9, z1: -1e9, topZ: 0, n: 0 });
    const stab = mk(), fin = mk();
    const grow = (B, x, y, z) => { B.n++;
      if (x < B.x0) B.x0 = x; if (x > B.x1) B.x1 = x;
      // the TOP VERTEX rides along (user: "match it to the top point of
      // the fin") — the apex is placed from it, not from the z-midpoint
      // the dorsal drags forward
      if (y > B.y1) { B.y1 = y; B.topZ = z; }
      if (y < B.y0) B.y0 = y;
      if (z < B.z0) B.z0 = z; if (z > B.z1) B.z1 = z; };
    const xBand = Math.max(0.32, boomHalfW + 0.08);
    const each = fn => roots.forEach(root => root.traverse(o => {
      if (!o.isMesh || !o.visible || !o.geometry) return;
      // the highlight is never the part (G132) — an overlay re-draws the
      // same vertices in the same frame, so it could not MOVE these bounds,
      // but the boundary is declared in both walks, not one
      if (o.userData && o.userData.edHi) return;
      const p = o.geometry.attributes.position;
      if (!p) return;
      tmp.multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < p.count; i++) {
        v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(tmp);
        if (v.z <= zAft) fn(v);
      }
    }));
    // pass 1: the STAB is everything outboard of the boom
    each(v => { if (Math.abs(v.x) > xBand) grow(stab, v.x, v.y, v.z); });
    // pass 2: the FIN is the centreline surface above the deck — MINUS the
    // stab's own centre section (a high-mounted stab's root sits near the
    // centreline above the deck and would otherwise steal the fin's top
    // point; measured: fin.y1 read the stab root, apex 0.14 too high)
    const sOK = stab.n > 20;
    each(v => {
      if (Math.abs(v.x) > xBand || v.y - yD <= yDeckRel + 0.08) return;
      if (sOK && v.y >= stab.y0 - 0.04 && v.y <= stab.y1 + 0.04 &&
          v.z >= stab.z0 - 0.04 && v.z <= stab.z1 + 0.04) return;
      grow(fin, v.x, v.y, v.z);
    });
    return { stab: sOK ? stab : null, fin: fin.n > 20 ? fin : null };
  };
  // ONE LAYER'S OWN BOUNDS (2026-09-04): a V-tail's panels root on the
  // centreline, so tailSurfBounds' outboard-of-the-boom classifier would
  // split each panel between "stab" and "fin"; the stab LAYER is the V, and
  // its group is walked whole in the same mount frame.
  const layerBounds = (layerName) => {
    const mnt = edMount();
    if (!mnt || typeof THREE === 'undefined') return null;
    mnt.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(mnt.matrixWorld).invert();
    const tmp = new THREE.Matrix4(), v = new THREE.Vector3();
    const B = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9, n: 0 };
    let grp = null;
    mnt.traverse(o => { if (!grp && o.name === layerName) grp = o; });
    if (!grp) return null;
    grp.traverse(o => {
      if (!o.isMesh || !o.visible || !o.geometry) return;
      if (o.userData && o.userData.edHi) return;
      const p = o.geometry.attributes.position;
      if (!p) return;
      tmp.multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < p.count; i++) {
        v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(tmp);
        B.n++;
        if (v.x < B.x0) B.x0 = v.x; if (v.x > B.x1) B.x1 = v.x;
        if (v.y < B.y0) B.y0 = v.y; if (v.y > B.y1) B.y1 = v.y;
        if (v.z < B.z0) B.z0 = v.z; if (v.z > B.z1) B.z1 = v.z;
      }
    });
    return B.n > 20 ? B : null;
  };
  // WHAT THE MEASUREMENT COULD NOT TAKE (G64). One list, refilled by every
  // measure(), read by the engineering bench. A join that cannot measure the
  // build must not hand back a plausible aeroplane in silence — that is a
  // failed test, and the bench says so instead of posting a plaque for an
  // aeroplane nobody built.
  const ERRS = [];
  // G188: WHICH CONTACT IS THE THIRD WHEEL is the station's identity (the gear
  // layer flags its row 2 `single`), not its lateral offset. Four classifiers
  // here read `x <= 0.01`; a tailwheel row carrying 0.1 m was therefore a pair
  // of MAINS to all of them — the mains' station averaged with the tail's
  // (0.96 m instead of −1.42 m), the visual calibrated onto that mean, and no
  // third wheel measured at all, so twX/twY stayed stale. Older contacts
  // without the flag keep the offset reading.
  const isSingle = c => !!(c && c.st) &&
    (c.st.single != null ? !!c.st.single : c.st.x <= 0.01);
  const measure = () => {
    ERRS.length = 0;
    const P = window.CAGE_UI ? window.CAGE_UI.P : {};
    const M = {};
    const G2 = window.CAGE_GEAR || {};
    if (G2.contacts && G2.contacts.length) {
      const mains = G2.contacts.filter(c => c.st && !isSingle(c));
      const single = G2.contacts.find(isSingle);
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
      // G49: the fuselage knobs are MEASURED off the cage's own anatomy.
      // The x-anchor is the WINDSCREEN BASE ring — the lattice's firewall
      // (cowl deck forward of it, the glass step above it) — read from
      // cageResolve's named rings, replacing G45's "firewall ~ the
      // skin's forward extreme", which stretched the whole nose into the
      // tail arm. The ws rings SLOPE (roof z is aft of keel z), so the
      // base is their WAIST/KEEL z, not their roof. Ring z is cage
      // units; AF is metres — × FS (CAGE_UNIT × planeScale) converts.
      let zFw = AF.z1, fwOk = false, zPost = null;
      let zOf2 = () => null;               // named-ring z lookup, metres
      try {
        const C2 = window.CAGE2;
        const R = C2.cageResolve(C2.cageSpec({ ...P }));
        const FS = (C2.CAGE_UNIT || 1) * (P.planeScale || 1);
        zOf2 = (name) => {
          const r = R.rings.find(q => q.name === name);
          const l = r && r.lv && (r.lv.waist || r.lv.keel);
          return l && isFinite(l.z) ? l.z * FS : null;
        };
        const fw = zOf2('wsFront') != null ? zOf2('wsFront')
                 : zOf2('wsAft') != null ? zOf2('wsAft')
                 : zOf2('aeroWsA') != null ? zOf2('aeroWsA') : zOf2('ring');
        if (fw != null) { zFw = fw; fwOk = true; }
        zPost = zOf2('tailPost');          // a ROD boom has no tail rings
      } catch (e) {
        // NOT SWALLOWED (G64). `fwOk` false skips the whole firewall-anchored
        // block below — the cabin's x-extent, the gear station and ride
        // height, the wing station, the boom shape and profile, and all eight
        // tail rows — and the build that came out was a plausible generic
        // aeroplane with no sign anywhere that seven measurements had gone
        // missing. The bench reads this list and calls the test failed, which
        // is what a measurement you could not take actually means.
        ERRS.push('the cage would not resolve, so nothing could be measured '
                  + 'off it: ' + e.message);
      }
      // tail arm: firewall -> the cage's own tail post (the lattice's
      // last full station); the post/fin land postGap beyond it, still a
      // DEFAULT-v1 gap. Falls back to the G45 whole-skin measurement
      // when the anatomy cannot be resolved (rod booms fall back on the
      // aft skin extreme — the rod is in CAGE_MATS, G26).
      M.tailArm = zFw - (zPost != null ? zPost : AF.z0);
      // y is measured from the cabin keel — the same outer-skin datum
      // cab.h declares (interior is smaller by structure).
      const yD = AF.surf(zs, 0)[1];
      if (zPost != null) {
        M.tailW = AF.halfWAt(zPost);
        M.tailBot = AF.surf(zPost, 0)[1] - yD;
        M.tailTop = AF.surf(zPost, Math.PI)[1] - yD;
      }
      if (fwOk && M.cabH > 0.5) {
        // the deck just FORWARD of the windscreen base, as a fraction of
        // cabin height. Never measured off the fallback anchor: with
        // zFw = AF.z1 the sample would read the nose tip, not the cowl.
        const zCowl = Math.min(AF.z1 - 0.02, zFw + 0.10);
        M.cowlDeck = (AF.surf(zCowl, Math.PI)[1] - yD) / M.cabH;
      }
      // G51: the THIRD WHEEL is measured. The lattice used to hang it a
      // fixed twLeg below the tail post — so G49's honestly high measured
      // tail RAISED the tailwheel with it and steepened the three-point
      // attitude toward stall alpha (the "does not fly any more" report).
      // The gear editor already stood the built plane on its wheels; the
      // third wheel's axle is read from ITS contact, in the same keel
      // datum as the sections. The MAINS height stays DERIVED on purpose:
      // the prop-clearance rule owns gear.y, and a measured low axle
      // makes long soft levers of the class-k gear members (0.35 m of
      // sag onto the belly, measured — length-aware k is the real cure).
      // Gated on the same anatomy resolution: without it, no datum.
      // Wheel measurements gate on what they actually need (a ROD boom
      // has no tail rings, and its wheels deserve measuring too): the
      // keel DATUM exists whenever the airframe does; only the stations
      // (twX) additionally need the firewall anchor.
      if (G2.contacts && G2.contacts.length) {
        const single = G2.contacts.find(isSingle);
        // G188: a drawn third wheel that produced no single contact is SAID —
        // the merge would otherwise keep a stale twX/twY without a word
        if (!single && +P.s2On)
          ERRS.push('the third wheel is drawn but no single contact was '
                    + 'found: its station and height not measured');
        if (single && fwOk) {
          M.twX = zFw - single.p[2];      // model x aft of the firewall
          M.twY = single.p[1] - yD;
          if (single.R > 0) M.twR = single.R;
        }
        // G53: the RIDE HEIGHT — the mains' axle in the keel datum. This
        // is the row whose absence floated the whole frame 0.36 m above
        // the visual (gear.y sat on the legDrop default, yBoundBy said
        // so). Live only since the mains got their rule-10 snap-blocker:
        // without it a shallow measured stance reflected the axle through
        // the belly-plane anchors at 0.28% strain.
        const mainsY = G2.contacts.filter(c => c.st && !isSingle(c));
        if (mainsY.length)
          M.gearY = mainsY.reduce((s, c) => s + c.p[1], 0) / mainsY.length - yD;
      }
      // THE ENGINES' STATIONS (2026-09-04): each drawn unit's mount point,
      // model frame — x aft of the firewall, y over the cabin keel, z lateral
      {
        const CE = window.CAGE_ENG;
        if (CE && Array.isArray(CE.units) && CE.units.length)
          M.engUnits = CE.units.map(u =>
            ({ x: zFw - u.at[2], y: u.at[1] - yD, z: u.at[0] }));
      }
      // G52: the PILLAR PROPORTIONS and the wing's station (user: "the
      // visual fit remains very approximate"). The cabin's x-extent is
      // the pillars' own: noseGap = firewall -> cabin front pillar
      // (pilCabB), cab.len = front pillar -> aft cabin pillar (pilPaxA).
      // postGap = tail post -> the skin's aft extreme, so the derived
      // stab/fin stations land at the built tail rather than 0.47-0.60 m
      // behind it. The wing's xLE comes from where the wing layer
      // actually anchors the FRONT SPAR: the cage's `ring` station
      // (+ the panel's dx), minus sparFront x chord back to the LE.
      if (fwOk) {
        const zCabF = zOf2('pilCabB'), zCabA = zOf2('pilPaxA');
        if (zCabF != null && zFw > zCabF) M.noseGap = zFw - zCabF;
        if (zCabF != null && zCabA != null && zCabF > zCabA)
          M.cabLen = zCabF - zCabA;
        if (zPost != null && zPost > AF.z0) M.postGap = zPost - AF.z0;
        // WHERE THE PEOPLE SIT (2026-09-03). The frame used to bill every
        // occupant onto a cabin PILLAR RING — the front pillar for row one,
        // the aft pillar for row two — and nothing read the seats the crew
        // layer actually draws. On the user's Cub that put the pilot 0.27 m
        // and the passenger 0.86 m behind their seat backs: 13 % of MAC of
        // CG, an aeroplane built to the reference model and reading a
        // NEGATIVE static margin. (The user: "I'm suspecting something in our
        // balance and CG computation is wrong... it's odd that I get this
        // factor wrong while matching the reference models exactly.")
        //
        // The crew layer publishes each seat's BACK, in cage metres, in the
        // ring frame `zOf2` measures in; a seated adult's mass centre sits
        // about SEAT_CG_FWD ahead of the backrest (pelvis + torso + thighs).
        // One station per seat, pilot first — the same order genFrame fills
        // the seats in — as metres aft of the firewall.
        const CRW = window.CAGE_CREW;
        if (CRW && Array.isArray(CRW.seatsAt) && CRW.seatsAt.length) {
          const SEAT_CG_FWD = 0.20;
          const xs = CRW.seatsAt
            .map(s => zFw - s.zBack - SEAT_CG_FWD)
            .filter(x => isFinite(x) && x > 0.05);
          if (xs.length === CRW.seatsAt.length) M.seatsX = xs;
        }
        // the MAINS STATION: with gear.x measured, the wheels-to-axles
        // calibration collapses to off[0] = zFw − cg0[0] — the visual's
        // x-mapping becomes firewall-EXACT for every part, not just the
        // wheels. The CG/rake placement rule is bypassed; noseOver is
        // posted by the shakedown, which is the honest trade.
        const mains2 = (G2.contacts || []).filter(c => c.st && !isSingle(c));
        if (mains2.length)
          M.gearX = zFw - mains2.reduce((s, c) => s + c.p[2], 0) / mains2.length;
        const zRing = zOf2('ring');
        if (zRing != null) {
          const sparF = (typeof GEN_RULES !== 'undefined' &&
                         GEN_RULES.sparFront) || 0.15;
          M.wingXLE = (zFw - zRing - (P.wgDx || 0))
                    - sparF * (P.wgChord || 1.5);
        }
        // G54: the SHAPE FAMILY — the PATH of the boom between the
        // measured endpoints (user: "it starts diverging from the
        // passenger pillar onwards"). The lattice interpolates its
        // aft stations with the family's exponent; the cage's own
        // curve says which family. Sample belly/deck/width at the
        // boom midpoint, invert t^e per channel, average, and pick
        // the nearest GEN_SHAPES row. A frame belly that hangs below
        // the built one GROUNDS before the tailwheel and holds the
        // tail up — this row is why the sim's boom follows the built
        // boom.
        if (zPost != null && zCabA != null && zCabA > zPost + 0.5 &&
            typeof GEN_SHAPES !== 'undefined') {
          const zMid = (zCabA + zPost) / 2;
          const es = [];
          const chan = (v0, vm, v1) => {
            const d = v1 - v0;
            if (Math.abs(d) < 0.08) return;
            const u = (vm - v0) / d;
            if (u > 0.02 && u < 0.98) es.push(Math.log(u) / Math.log(0.5));
          };
          chan(AF.surf(zCabA, 0)[1], AF.surf(zMid, 0)[1],
               AF.surf(zPost, 0)[1]);                       // belly
          chan(AF.surf(zCabA, Math.PI)[1], AF.surf(zMid, Math.PI)[1],
               AF.surf(zPost, Math.PI)[1]);                 // deck
          chan(AF.halfWAt(zCabA), AF.halfWAt(zMid), AF.halfWAt(zPost));
          if (es.length) {
            const e = es.reduce((s, v) => s + v, 0) / es.length;
            let best = null, bd = 1e9;
            for (const k in GEN_SHAPES) {
              const d = Math.abs(GEN_SHAPES[k].taper - e);
              if (d < bd) { bd = d; best = k; }
            }
            if (best) M.shape = best;
          }
          // G54.1: the three-family exponent was too coarse for a real
          // boom (user: "adjust the height of every section of the
          // boom") — so EVERY section is measured: nine rows over the
          // same t-domain the lattice interpolates (boxRear..tailArm ↔
          // pax pillar..tail post), width + floor + deck each, in the
          // keel datum. The shape family stays measured as the
          // fallback for saves that predate the profile.
          const NP = 9, prof = [];
          for (let i = 0; i < NP; i++) {
            const t = i / (NP - 1);
            const z = zCabA + (zPost - zCabA) * t;
            prof.push({ t: +t.toFixed(4),
              w: AF.halfWAt(z),
              yb: AF.surf(z, 0)[1] - yD,
              yt: AF.surf(z, Math.PI)[1] - yD });
          }
          M.profile = prof;
        }
        // G54.3: THE TAIL SURFACES (user: "these ones seem never to have
        // been matched" — correct, they were declared cosmetic v1 at
        // G45). Measured from the placed fin/stab layers' own meshes:
        // stations from their z-midpoints, span/chord from extents,
        // heights in the keel datum. stabH and vHeight invert the
        // lattice's own placement formulas (stabY = tailY + stabH·
        // (finTop − tailY); finTop = tailTop + 0.82·vHeight) so the
        // frame's tips land where the built surfaces are. Areas follow
        // span × chord — the flown tail volume becomes the BUILT tail's,
        // and the shakedown posts the stability that results.
        if (fwOk && zPost != null &&
            typeof M.tailTop === 'number' && typeof M.tailBot === 'number') {
          const TB = tailSurfBounds(zCabA != null ? zCabA - 0.8 : zPost + 1.5,
                                    M.tailW || 0.2, M.tailTop, yD);
          const sB = TB && TB.stab, fB = TB && TB.fin;
          const tailYm = M.tailBot + 0.55 * (M.tailTop - M.tailBot);
          if (sB && (sB.x1 - sB.x0) > 0.5) {
            M.hSpan = 2 * Math.max(Math.abs(sB.x0), Math.abs(sB.x1));
            M.hChord = sB.z1 - sB.z0;
            M.hX = zFw - (sB.z0 + sB.z1) / 2;
            M.stabY = (sB.y0 + sB.y1) / 2 - yD;
          }
          // THE V-TAIL (2026-09-04): the stab layer says it is canted, so
          // the whole layer is the tail — horizontal projection as hSpan,
          // its chord, its station and root height; the cant is the type.
          // No fin is read (a V has none; a fin left switched on would be
          // a three-surface tail the frame does not build).
          const SBv = window.CAGE_STAB, TBj = window.CAGE_BOOMS;
          if (TBj) {
            // TWIN BOOMS (2026-09-04): the fin layer is TWO fins on the boom
            // tails, the stab layer the panel between them — both measured
            // whole; vHeight above the boom's line, hSpan the panel's own
            const fb2 = layerBounds('cageLayer:fin'), sb2 = layerBounds('cageLayer:stab');
            M.boomX = TBj.x; M.boomLen = TBj.len; M.boomR = TBj.r0;
            if (sb2 && (sb2.x1 - sb2.x0) > 0.5) {
              M.hSpan = 2 * Math.max(Math.abs(sb2.x0), Math.abs(sb2.x1));
              M.hChord = sb2.z1 - sb2.z0;
              M.hX = zFw - (sb2.z0 + sb2.z1) / 2;
              M.stabY = (sb2.y0 + sb2.y1) / 2 - yD;
            }
            if (fb2 && (fb2.y1 - fb2.y0) > 0.3) {
              const boomTop = TBj.y + TBj.r1 - yD;
              M.vHeight = Math.max(0.2, (fb2.y1 - yD - boomTop) / 0.82);
              M.vChord = fb2.z1 - fb2.z0;
              M.vX = zFw - (fb2.z0 + fb2.z1) / 2;
              M.vSweep = 0;
            }
          } else if (SBv && SBv.cant >= 20) {
            const vb = layerBounds('cageLayer:stab');
            if (vb && (vb.x1 - vb.x0) > 0.5) {
              M.tailCant = SBv.cant;
              M.hSpan = 2 * Math.max(Math.abs(vb.x0), Math.abs(vb.x1));
              M.hChord = vb.z1 - vb.z0;
              M.hX = zFw - (vb.z0 + vb.z1) / 2;
              M.stabY = vb.y0 - yD;
            }
          } else if (fB && (fB.y1 - fB.y0) > 0.3) {
            const finTop = fB.y1 - yD;
            M.vHeight = (finTop - M.tailTop) / 0.82;
            M.vChord = fB.z1 - fB.z0;
            // the apex lands ON the fin's top vertex: with vSweep 0 the
            // lattice puts FIN at (vX, finTop), so vX = the top point's
            // own station (user: "the top point of the fin"). The sweep
            // is BAKED into where that point is — so vSweep must be 0 or
            // the lattice leans the apex aft a second time.
            M.vX = zFw - fB.topZ;
            M.vSweep = 0;
            if (typeof M.stabY === 'number' && finTop > tailYm + 0.1)
              M.stabH = Math.max(0, Math.min(1,
                (M.stabY - tailYm) / (finTop - tailYm)));
          }
        }
      }
    }
    // CREW, PASSENGERS AND HOW MANY SEATS THERE ARE (2026-08-31). The cage
    // has always had PAX BAYS (`paxCount`, 0-4) and the join has always
    // thrown all but the first of them away: `seating` could only ever come
    // out `single` or a two-seater, so an aeroplane you had built four bays
    // into flew as a two-seater and weighed like one.
    //
    // The bays are the capacity now. The LOADING is still what the cage
    // shows: the pilot always, the second dummy when it is drawn, and the
    // rest of the seats empty — `cabin.pax` is a loading number and an
    // aeroplane is not flown full because it could be.
    //
    // G180 (the user: "every passenger bay should be able to hold as many
    // seats as the cabin ... for each section, we can decide whether
    // passengers are seated"): the crew layer draws a row as wide as the
    // cockpit's in every bay and marks each seat filled or not from the
    // section rows (`cabOcc`, `paxOcc<n>`). The join reads CAPACITY, the
    // OCCUPANCY and both loading numbers off that ONE seat list — the same
    // list seatsX came from, in the same order — so what is drawn is what
    // weighs, seat for seat. `seating` keeps naming the FAMILY (it still
    // sizes a cabin the join did not measure); `cabin.seats` carries the
    // count, which the table can no longer express (ten seats in a four-bay
    // side-by-side). Without the crew layer in the page the same numbers
    // are derived from the rows, so a build with the layer off still loads.
    const bays = Math.max(0, Math.round(+P.paxCount || 0));
    const abreast = Math.round(P.seatLayout) === 1;
    const perRow = abreast ? 2 : 1;
    M.seating = bays >= 3 ? (abreast ? 'side4' : 'tandem4')
             : bays >= 1 ? (abreast ? 'side2' : 'tandem2')
             : 'single';
    const CRW = window.CAGE_CREW;
    const drawn = CRW && Array.isArray(CRW.seatsAt) && CRW.seatsAt.length
               && CRW.seatsAt.every(s => typeof s.filled === 'boolean')
      ? CRW.seatsAt : null;
    if (drawn) {
      M.seats = drawn.length;
      M.occupied = drawn.map(s => s.filled ? 1 : 0);
      M.pilots = drawn.filter(s => !s.section && s.filled).length;
      M.pax = drawn.filter(s => s.section && s.filled).length;
    } else {
      M.seats = perRow * (1 + bays);
      const occ = [1];
      if (abreast) occ.push(+P.cabOcc ? 1 : 0);
      for (let n = 1; n <= bays; n++) {
        const k = Math.min(perRow, Math.max(0, Math.round(+P['paxOcc' + n] || 0)));
        for (let j = 0; j < perRow; j++) occ.push(j < k ? 1 : 0);
      }
      M.occupied = occ;
      M.pilots = occ.slice(0, perRow).reduce((a, b) => a + b, 0);
      M.pax = occ.slice(perRow).reduce((a, b) => a + b, 0);
    }
    if (window.CAGE2 && window.CAGE2.cageToSpec)
      try { M.cage = window.CAGE2.cageToSpec(P); }
      catch (e) { ERRS.push('the shape could not be written to the build: '
                            + e.message); }
    // ...AND THE FINISH RIDES WITH THE SHAPE (G105). Same shape of statement,
    // one line below it, because it is the same kind of thing: the editor's
    // complete answer to a question about THIS aeroplane, written as
    // deviations. Null is a legitimate answer — the factory finish — so it is
    // written rather than skipped, and garage.js's merge replaces this key
    // whole instead of merging it, or an override could never be taken off.
    if (window.CAGE_UI && window.CAGE_UI.finishToSpec)
      try { M.finish = window.CAGE_UI.finishToSpec(); }
      catch (e) { ERRS.push('the finish could not be written to the build: '
                            + e.message); }
    // ...AND THE TANKS (G99), through the same door and for the same reason:
    // the editor's complete answer about where this aeroplane's energy sits.
    // The list is written WHOLE - garage.js's merge replaces an array - so a
    // removed tank stays removed.
    if (window.CAGE_ENERGY && window.CAGE_ENERGY.toSpec)
      try { M.energy = window.CAGE_ENERGY.toSpec(); }
      catch (e) { ERRS.push('the tanks could not be written to the build: '
                            + e.message); }
    // G134: the drawn engine, resolved — null when the dials still ARE the
    // applied preset, so the registry row keeps flying under its own name.
    // A throw here is a real report, same rule as the shape and the finish.
    if (typeof window.CAGE_ENG_FACTS === 'function')
      try {
        const ef = window.CAGE_ENG_FACTS(P);
        if (ef) M.engineFacts = ef;
      } catch (e) { ERRS.push('the engine could not be resolved to facts: '
                              + e.message); }
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
  // THE VIEW IS PUT BACK WHATEVER HAPPENS. Held in the closure rather than in
  // the capture's own locals so the restore can be a `finally`: a capture that
  // threw half way used to leave the builder looking at a NEUTRALISED
  // aeroplane — explode zeroed, section colours forced on, the alphas back to
  // 1 — with nothing on screen to say why their settings had moved.
  let viewWas = null;
  const viewNeutral = () => {
    viewWas = VIEW_STATE.map(r => r.get());
    let bent = false;
    VIEW_STATE.forEach((r, i) => {
      if (viewWas[i] === null || viewWas[i] === r.to) return;
      r.set(r.to); bent = true;
    });
    if (!bent) { viewWas = null; return false; }
    window.CAGE_UI.build();
    return true;
  };
  const viewRestore = () => {
    if (!viewWas) return;
    const was = viewWas; viewWas = null;    // once, even if this throws
    VIEW_STATE.forEach((r, i) => { if (was[i] !== null) r.set(was[i]); });
    window.CAGE_UI.build();
  };

  const snapshotAt = spec => {
    const mount = (() => {           // edSitP: the editor's mount group
      let g = window.CAGE_WING && window.CAGE_WING.group;
      while (g && g.parent && !g.parent.isScene &&
             g.parent.parent && !g.parent.parent.isScene) g = g.parent;
      return g;                      // the inner (pitch) mount
    })();
    if (!mount) return null;
    // calibration: rest-lattice main axles vs cage mains. The sim's body
    // frame is CG-RELATIVE (makeSkinBinding subtracts defCG; the pose
    // adds cg back), so the lattice axle must be taken RELATIVE TO THE
    // REST CG — the raw-frame first cut floated the aeroplane a CG's
    // height above the runway (G47, user: "does not touch the ground").
    let off = [0, 0], beta = 0;
    try {
      const RS = resolveSpec(JSON.parse(JSON.stringify(spec)));
      const fr = genFrame(RS.spec);
      const cg0 = fr.cg0;
      const mains = fr.refs.mains.map(i => fr.nodes[i].p);
      const mfx = (mains[0][0] + mains[1][0]) / 2,
            mfy = (mains[0][1] + mains[1][1]) / 2;
      const G2 = window.CAGE_GEAR;
      const cm = G2.contacts.filter(c => c.st && !isSingle(c));
      const cz = cm.reduce((s, c) => s + c.p[2], 0) / cm.length,
            cy = cm.reduce((s, c) => s + c.p[1], 0) / cm.length;
      // G54.2 THE PITCH CALIBRATION (user: "it's like the plane has
      // rotated... would you get confused with the plane's resting
      // position?" — yes, for three rounds). poseModel maps the visual's
      // local x-axis onto the BODY AXIS (noseFrame→tailMid) — and the
      // measured-high boom INCLINES that axis in the design frame
      // (+3.69° on the default build). A level-captured visual therefore
      // rode tail-HIGH by the inclination: keel diverging aft, the
      // visual tailwheel floating ~15 cm off the ground the frame's TW
      // was touching. NOTE the first cut solved the rotation from the
      // WHEELS and got exactly 0 — the wheels are the two points the
      // measurements already agree on; they cannot see this. The angle
      // is the AXIS'S OWN: rotate the capture by −φ so that when the
      // pose lifts the axis, the visual lands on the frame.
      const meanP = ids => {
        const a = Array.isArray(ids) ? ids : [ids];
        let sx = 0, sy = 0;
        for (const i of a) { sx += fr.nodes[i].p[0]; sy += fr.nodes[i].p[1]; }
        return [sx / a.length, sy / a.length];
      };
      const nF = meanP(fr.refs.noseFrame), tM = meanP(fr.refs.tailMid);
      beta = -Math.atan2(tM[1] - nF[1], tM[0] - nF[0]);
      const cb = Math.cos(beta), sb = Math.sin(beta);
      const rmx = (-cz) * cb - cy * sb,        // cage mains, rotated
            rmy = (-cz) * sb + cy * cb;
      off = [(mfx - cg0[0]) - rmx, (mfy - cg0[1]) - rmy];
    } catch (e) { console.warn('cage visual calibration:', e); }
    const cB = Math.cos(beta), sB = Math.sin(beta);
    // THE CAPTURE IS OF THE AEROPLANE, NOT OF HOW YOU WERE LOOKING AT IT
    // (G106). Every display control goes to its neutral and the build is
    // redone once; the restore is the `finally` on the wrapper below, AFTER
    // everything that reads the scene. See VIEW_STATE / VIEW_KEEP at the top
    // of this file for the list, and for what is deliberately left alone.
    viewNeutral();
    // G55 MOVING PARTS: wheels and the prop peel off into their OWN
    // groups before the merge, each with a pivot, so the game can ride
    // them on their axle nodes (suspension = the physics showing
    // through) and spin the prop. Wheels classify geometrically — a
    // mesh whose centre sits within 2.4 R of a gear contact is that
    // wheel's tyre/hub/brake (the leg's centre is up the leg and stays
    // static). The prop cannot be found geometrically (it sits at the
    // cowl face, well BEHIND the cage's own nose tip), so the engine
    // layer NAMES it at the source (edSpinner/edProp — G47.2's rule).
    // ONE PROP PART PER ENGINE (2026-09-04): the engine layer suffixes unit
    // k's spinner/prop names with '#k', and each spins about its own hub
    const PARTS = { wheels: [], others: [], props: [] };
    const propPart = k => PARTS.props[k] ||
      (PARTS.props[k] = { kind: 'prop', groups: {}, unit: k, hub: null,
                          hubRaw: null, axis: null });
    const unitOf = nm => { const h = nm.indexOf('#'); return h < 0 ? 0 : (+nm.slice(h + 1) || 0); };
    try {
      const GB = window.CAGE_GEAR || {};
      for (const c of GB.contacts || [])
        PARTS.wheels.push({
          kind: c.st.x <= 0.01 ? 'tw' : (c.p[0] > 0 ? 'mainsL' : 'mainsR'),
          R: c.R, cx: c.p[0], cy2: c.p[1], cz2: c.p[2], groups: {} });
      // G58.3: the legs stretch-follow their axle (suspension visually
      // compresses); the castor fork yaws for ground manoeuvring
      for (const u of (GB.units && GB.units.legs) || [])
        PARTS.others.push({ src: 'edLeg' + u.kind,
          kind: 'leg' + (u.kind === 'T' ? 'T' : u.kind),
          stretch: true, axleC: u.moving || u.axle, rootC: u.root || null,
          groups: {} });
      // G59 CONTROL SURFACES. Each named surface becomes its own part
      // with a HINGE derived from its own geometry: the hinge line is
      // the surface's FORWARD edge (x is aft in the model frame, so its
      // minimum x), and the axis is the direction that edge runs —
      // SPANWISE (z) for ailerons/flaps/elevators, VERTICAL (y) for the
      // rudder. Sign and drive per surface, ailerons antisymmetric.
      // G185: the second plane's four surfaces ride the same way; their
      // names carry a '2', which the drive map strips below
      for (const nm of ['ailR', 'ailL', 'flapR', 'flapL', 'rud', 'rud2',
                        'elevR', 'elevL', 'ailR2', 'ailL2', 'flapR2', 'flapL2'])
        PARTS.others.push({ src: 'edSurf_' + nm, kind: 'surf_' + nm,
          surf: nm, groups: {} });
      if (GB.units && GB.units.castor)
        PARTS.others.push({ src: 'edCastorT', kind: 'castorT',
          topC: GB.units.castor.top, axC: GB.units.castor.ax,
          axleC: GB.units.castor.axle, groups: {} });
      // G179.2: THE LIFT STRUTS ARE A PART — every vertex a point on a
      // line between the member's own drawn pin (on the fuselage) and tip
      // (on the wing), published by the wing layer on the group it built
      // (userData.strutMembers, read in the traversal below). The old
      // two-end follow keyed on a rig NAME the snapshot only carried when
      // the strut's section survived the material merge — on the user's
      // twin it did not, and the wing-box selector cut the tube in three.
      PARTS.others.push({ src: 'edFit_liftstrut', kind: 'liftstrut',
        stretch: true, groups: {} });
      // G185: the truss — the cabane, the interplane struts and the wires
      // are parts of the same kind: every vertex a point on a line between
      // its member's two drawn ends, each end riding its own physics node
      for (const [src, kind] of [['edFit_cabane', 'cabane'],
                                 ['edFit_interplane', 'interplane'],
                                 ['edFit_wire', 'wire']])
        PARTS.others.push({ src, kind, stretch: true, groups: {} });
      // ...AND SO IS EACH ENGINE UNIT, block, exhaust and all, rigid about
      // its mount point (the thrust line), riding its own engine node in
      // the game instead of being split between the wing box and the
      // fuselage (a wing-mounted block read 6 cm apart on the roll).
      const CE = window.CAGE_ENG;
      ((CE && CE.units) || []).forEach((u, k) => {
        if (!u || !u.at) return;
        PARTS.others.push({ src: 'edEng' + (k ? '#' + k : ''), kind: 'eng',
          unit: k, axleC: u.at, groups: {} });
      });
    } catch (e) {}
    // merge the build's meshes into groups by material look
    const groups = {}, mats = {};
    mount.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(mount.matrixWorld).invert();
    const tmp = new THREE.Matrix4(), nm = new THREE.Matrix3(),
          v = new THREE.Vector3(), n = new THREE.Vector3();
    mount.traverse(o => {
      if (!o.isMesh || !o.visible || !o.geometry) return;
      // THE HIGHLIGHT IS NEVER THE PART (G132). The editor's selection
      // overlay re-draws part geometry as extra meshes marked `edHi`, and
      // this bake took them: measured before the skip, a fuselage selected
      // in `fill` flew 105,102 extra vertices and `silhouette` twice that
      // (its mask + shell pair). Latent since G95 — the default `outline`
      // style is LineSegments, which `isMesh` already refused.
      if (o.userData && o.userData.edHi) return;
      const matList = Array.isArray(o.material) ? o.material : [o.material];
      if (!matList[0] || !matList[0].color) return;
      const geo = o.geometry, idx = geo.index;
      const p = geo.attributes.position, na = geo.attributes.normal;
      tmp.multiplyMatrices(inv, o.matrixWorld);   // object -> cage frame
      nm.getNormalMatrix(tmp);
      // A MULTI-MATERIAL MESH SPLITS BY ITS GEOMETRY GROUPS (G47.2 fix,
      // user: "the fuselage mesh is still all grey" — the cage fuselage
      // is ONE mesh with a material array, and reading material[0]
      // collapsed every section band into the body grey). Each range
      // lands in its own colour group, vertices carried per-index so
      // the ORIGINAL normals survive (recomputing over merged unwelded
      // meshes flat-shades).
      // G55/G58.2: which part does this mesh belong to? EVERYTHING is
      // named at its source now — the engine layer names the prop
      // (edSpinner/edProp), the gear layer bakes each wheel's
      // tyre/hub/brake into its own named group (edWheelL/R/T). The
      // first cut sliced wheels out PER TRIANGLE and produced severed
      // forks and a tailwheel that spun with its castor (user: "the
      // weirdest thing"); identity beats surgery.
      let part = null;
      {
        let a = o;
        while (a && a !== mount) {
          if (a.name && (a.name.lastIndexOf('edProp', 0) === 0 ||
                         a.name.lastIndexOf('edSpinner', 0) === 0)) {
            part = propPart(unitOf(a.name)); break;
          }
          if (a.name === 'edWheelL' || a.name === 'edWheelR' ||
              a.name === 'edWheelT') {
            const want = a.name === 'edWheelT' ? 'tw'
                       : (a.name === 'edWheelL' ? 'mainsL' : 'mainsR');
            part = PARTS.wheels.find(w => w.kind === want) || null;
            break;
          }
          if (a.name && (a.name.lastIndexOf('edLeg', 0) === 0 ||
                         a.name.lastIndexOf('edSurf_', 0) === 0 ||
                         a.name === 'edCastorT')) {
            part = PARTS.others.find(u => u.src === a.name) || null;
            break;
          }
          // G179.2: the struts and the engine units (the prop and spinner
          // under a unit were matched above, deeper in the walk)
          if (a.name && (a.name === 'edFit_liftstrut' ||
                         a.name === 'edFit_cabane' || a.name === 'edFit_interplane' ||
                         a.name === 'edFit_wire' ||
                         a.name.lastIndexOf('edEng', 0) === 0)) {
            part = PARTS.others.find(u => u.src === a.name) || null;
            if (part && a.userData && a.userData.strutMembers)
              part.membersC = a.userData.strutMembers;
            break;
          }
          a = a.parent;
        }
      }
      const ranges = (matList.length > 1 && geo.groups && geo.groups.length)
        ? geo.groups
        : [{ start: 0, count: idx ? idx.count : p.count, materialIndex: 0 }];
      // THE SECTION NAME IS THE KEY, NOT THE COLOUR (G66). Merging by
      // colour hex threw away the one thing a material system needs: two
      // sections that happen to wear the same tint merged irreversibly, so
      // the flown aeroplane could never be told that THIS band is the
      // waistband and THAT one is the taper. meshFrom publishes the ordered
      // section names it built the groups from (userData.matNames) — one
      // description of the split — and the colour rides along as a
      // fallback key for every layer that has no section vocabulary.
      const secNames = o.userData && o.userData.matNames;
      const secField = o.userData && o.userData.surfMats;
      const sAttr = geo.attributes.aStruct;
      // AND THE UV, for the one family that has one. The cage has no unwrap —
      // `aStruct` is what stands in its place — so this bake has always
      // written an all-zero uv. A VESSEL is the exception: VESSEL_MESH lays
      // its uv out in real metres over the finish's tile, and without it the
      // scanned sheet has nothing to sample and a tank flies flat.
      const uAttr = geo.attributes.uv;
      for (const r of ranges) {
        const m0 = matList[r.materialIndex] || matList[0];
        if (!m0 || !m0.color) continue;
        const sec = secNames && secNames[r.materialIndex];
        // ...and the fallback key carries WHAT IT IS as well as its colour:
        // with the per-part livery, two layer materials can wear the same
        // resolved tint over different finishes, and a colour-only bucket
        // would merge them irreversibly (the exact failure the paragraph
        // above records for the cage).
        const kud = m0.userData || {};
        const key = sec ? 's' + sec
          : 'c' + m0.color.getHexString() +
            (m0.transparent ? 'a' + Math.round(m0.opacity * 100) : '') +
            // ...AND A TANK IS NOT THE AEROPLANE. The vessel materials are
            // the second factory in the capture, and their whites (a painted
            // shell is 0xffffff over the sheet) would otherwise merge into
            // whatever cage section happened to wear the same colour — which
            // is the same irreversible merge the paragraph above records. The
            // hue is in the key too, because it is a per-material uniform.
            (kud.vesSet ? 'v' + kud.vesSet +
                          (kud.hue ? 'h' + kud.hue.toFixed(4) : '') : '') +
            (kud.aeroFinish ? 'f' + kud.aeroFinish + (kud.aeroGrm || '') +
                              (kud.aeroSurf ? 'S' : '') +
                              (kud.aeroWing ? 'W' + kud.aeroWing : '') +
                              // the dials too (G113): two look-alike layer
                              // sections dialled apart must not merge
                              (kud.aeroTileK ? 'T' + kud.aeroTileK : '') +
                              (kud.aeroRoughK ? 'R' + kud.aeroRoughK : '') +
                              (kud.aeroNrmK ? 'N' + kud.aeroNrmK : '') +
                              (kud.aeroWearM ? 'M' + kud.aeroWearM : '') +
                              (kud.aeroCcK ? 'C' + kud.aeroCcK : '') +
                              (kud.aeroFieldK ? 'F' + kud.aeroFieldK : '') : '') +
            // G206.1: an inside bucket must not merge with an outside one
            ((kud.aeroInside || kud.charSkin) ? 'I' : '') +
            // G185: the second plane's materials are their own buckets — the
            // game binds each plane's skin to its own spar stations
            (kud.aeroPlane ? 'P' + kud.aeroPlane : '');
        // AEROSKIN (G67) rides across as WHAT IT IS, not as what it looked
        // like: the finish key and the shader branch, so the game rebuilds
        // the same material from the same factory rather than approximating
        // it with a colour and two scalars. `color` still carries the
        // resolved albedo (AEROSKIN keeps it on material.color for exactly
        // this reason), so a payload from a build made before this — or from
        // a layer that is not AEROSKIN — still reads correctly.
        const ud = m0.userData || {};
        if (!mats[key]) mats[key] = { color: m0.color.getHex(),
          ...(m0.transparent ? { opacity: m0.opacity } : {}),
          ...(sec ? { sec } : {}),
          ...(ud.aeroFinish ? { fin: ud.aeroFinish } : {}),
          // THE VESSELS' OWN FACTORY (2026-09-04, user: "the fuel tank
          // material does not seem to make it in game — red in the editor,
          // white in the flight interface"). Same contract as `fin` above and
          // for the same reason: what crosses is WHAT THE MATERIAL IS — the
          // scanned set and the paint hue — so app.js rebuilds it from
          // CAGE_ENERGY.material instead of approximating a textured, tinted,
          // hue-rotated shell with a colour and two scalars. The tint is
          // already in `color`, which the factory multiplies the sheet by.
          ...(ud.vesSet ? { ves: ud.vesSet } : {}),
          ...(ud.vesSet && ud.hue ? { vesHue: +ud.hue.toFixed(5) } : {}),
          ...(ud.vesSet && ud.vesHueOn ? { vesHueOn: 1 } : {}),
          ...(ud.aeroGrm ? { grm: ud.aeroGrm } : {}),
          // G185: which plane a wing material dresses (2 = the second) — the
          // game binds that group to the second plane's spar stations
          ...(ud.aeroPlane ? { plane: ud.aeroPlane } : {}),
          // G108: the SURFACE CLASS (1 wing, 2 tail; absent means the body),
          // so the flown aeroplane can be told which markings are its wing's
          // and which are its fuselage's. Without it every flown surface came
          // back class 0 and a livery aimed at one landed on all of them.
          ...(ud.aeroWing ? { wing: ud.aeroWing } : {}),
          // the dialled deviations and the metric rib pitch (G113): the
          // three dials multiply the finish's own numbers, ribM is the
          // tail's declared pitch, wearK the part's own ageing rate —
          // absent means the finish's defaults, exactly as in the editor
          ...(ud.aeroTileK ? { tileK: ud.aeroTileK } : {}),
          ...(ud.aeroRoughK ? { roughK: ud.aeroRoughK } : {}),
          ...(ud.aeroNrmK ? { nrmK: ud.aeroNrmK } : {}),
          // G206: the sheen and the field dials cross the same way
          ...(ud.aeroCcK ? { ccK: ud.aeroCcK } : {}),
          ...(ud.aeroFieldK ? { fieldK: ud.aeroFieldK } : {}),
          // G206.1: in the cabin — a liner, a seat, a person (charSkin)
          ...((ud.aeroInside || ud.charSkin) ? { inside: 1 } : {}),
          ...(ud.aeroRibM ? { ribM: ud.aeroRibM } : {}),
          ...(ud.aeroWearK != null ? { wearK: ud.aeroWearK } : {}),
          ...(ud.aeroWearM != null ? { wearM: ud.aeroWearM } : {}),
          // whether this group carries the surface field decides which
          // branch the shader takes for it, and the join is where that
          // fact has to survive into the game
          ...((ud.aeroSurf || (secField && secField[r.materialIndex]))
              ? { surf: 1 } : {}),
          rough: (ud.aeroFinish || ud.vesSet) ? m0.roughness : 0.85,
          metal: (ud.aeroFinish || ud.vesSet) ? m0.metalness : 0 };
        const end = Math.min(r.start + r.count, idx ? idx.count : p.count);
        // one vertex into a bucket: cage -> model frame, then the G54.2
        // pitch calibration about the model z (left) axis, so the pose's
        // body-axis alignment lands the visual exactly on the frame
        const pushV = (G3, vi) => {
          v.set(p.getX(vi), p.getY(vi), p.getZ(vi)).applyMatrix4(tmp);
          G3.idx.push(G3.pos.length / 3);
          const px = -v.z, py = v.y;
          G3.pos.push(px * cB - py * sB, px * sB + py * cB, v.x);
          if (na) { n.set(na.getX(vi), na.getY(vi), na.getZ(vi))
            .applyMatrix3(nm).normalize();
            const qx = -n.z, qy = n.y;
            G3.nrm.push(qx * cB - qy * sB, qx * sB + qy * cB, n.x); }
          else G3.nrm.push(0, 1, 0);
          // THE SURFACE FIELD CROSSES THE JOIN UNCHANGED (G66), and that is
          // the point of it being a SURFACE coordinate: sL and sC are arc
          // lengths measured on the skin, so the cage -> model rotation and
          // the pitch calibration do not touch them the way they touch a
          // position or a normal. The field the editor built is the field
          // the aeroplane flies with.
          if (G3.uv) {
            if (uAttr) G3.uv.push(uAttr.getX(vi), uAttr.getY(vi));
            else G3.uv.push(0, 0);
          }
          if (G3.srf) {
            if (sAttr) G3.srf.push(sAttr.getX(vi), sAttr.getY(vi),
                                   sAttr.getZ(vi), sAttr.getW(vi));
            else G3.srf.push(0, 0, 0, 0);
          }
        };
        const bucket = part ? part.groups : groups;
        // the uv rides only where a material can sample it: one bucket is one
        // material, so this is decided once per bucket and never mixes
        const G3 = bucket[key] || (bucket[key] = { pos: [], idx: [], nrm: [],
                                                   srf: sAttr ? [] : null,
                                                   uv: (m0.userData &&
                                                        m0.userData.vesSet)
                                                       ? [] : null });
        for (let i = r.start; i < end; i++) pushV(G3, idx ? idx.getX(i) : i);
      }
    });
    // (THE RESTORE USED TO BE HERE, AND THAT WAS THE BUG WITH TEETH. It runs
    // `build()`, which puts the whole scene back into the view state — and
    // four things below still read that scene: the spinner's world position,
    // its shaft axis, and the gear's nose reference. So the VERTICES were
    // captured un-exploded and the PROP'S PIVOT was read exploded, and the
    // propeller flew a metre off the nose. Measured at explodeD 0.9: the hub
    // at -3.4792 became -4.4828.
    //
    // It very probably also explains the G58.4 tripwire below — "the prop
    // sometimes ends up in the middle", never reproduced in four capture
    // cycles, whose own warning asks the reporter whether explode was on.
    //
    // The whole capture happens in ONE state now, and the restore is the
    // wrapper's `finally`.)
    // uv is an all-zero array for the AEROPLANE: the cage has no unwrap and
    // never will — `srf` is what replaces it, and it is FOUR numbers, not two.
    // It is kept because mkGeo still binds it and a missing attribute is a
    // different (louder) failure than an unused one. The one exception is a
    // VESSEL, which is not cage skin at all: it is a solid built by
    // VESSEL_MESH with metre-true uv, and its buckets carry the real thing.
    const bake = g => ({ pos: new Float32Array(g.pos),
      nrm: new Float32Array(g.nrm),
      uv: (g.uv && g.uv.length) ? new Float32Array(g.uv)
                                : new Float32Array((g.pos.length / 3) * 2),
      ...(g.srf && g.srf.length ? { srf: new Float32Array(g.srf) } : {}),
      idx: new Uint32Array(g.idx), nv: g.pos.length / 3 });
    // G55: finalize the parts — each rebased about its PIVOT (the wheel's
    // axle; the spinner's own origin for the prop), pitch-calibrated like
    // everything else, so the game spins/rides them about the right point
    const rotP = (x, y, z) => [x * cB - y * sB, x * sB + y * cB, z];
    let spinners = 0;
    mount.traverse(o => {
      if (o.name && o.name.lastIndexOf('edSpinner', 0) === 0) {
        spinners++;
        const pp = propPart(unitOf(o.name));
        if (!pp.hub) {
          o.getWorldPosition(v); v.applyMatrix4(inv);
          pp.hubRaw = [v.x, v.y, v.z];
          pp.hub = rotP(-v.z, v.y, v.x);
          // G59.1 THE SHAFT AXIS (user: "the propeller and nose cone are
          // wrongly rotated, and they oscillate. They should be perfectly
          // aligned with the engine's shaft"). The spinner is built along
          // its own +z; the thrustline is NOT the model x axis — the
          // engine carries its mount offsets and the whole capture is
          // pitch-calibrated (G54.2) — so spinning about x coned the disc.
          // Take the spinner's own axis through the same two transforms
          // the vertices take, and spin about THAT.
          try {
            const d = new THREE.Vector3(0, 0, 1)
              .transformDirection(o.matrixWorld).transformDirection(inv);
            const a2 = rotP(-d.z, d.y, d.x);
            const L2 = Math.hypot(a2[0], a2[1], a2[2]) || 1;
            pp.axis = [a2[0] / L2, a2[1] / L2, a2[2] / L2];
          } catch (e2) {}
        }
      }
    });
    // G58.4 TRIPWIRE (user: "the prop sometimes ends up in the middle" —
    // not reproduced in four capture cycles, so the degenerate state
    // must NAME ITSELF when it happens): a spinner captured behind the
    // windscreen is not a hub. Refuse it — the prop then rides the
    // static merge at its captured place instead of spinning around a
    // wrong pivot — and say so loudly with everything a repro needs.
    // (2026-09-04: the tripwire applies to a NOSE unit only — a pusher's or
    // a nacelle's hub is behind the nose by design, and the engine layer
    // says which each unit is)
    try {
      const G2t = window.CAGE_GEAR, CEu = window.CAGE_ENG;
      for (const pp of PARTS.props) {
        if (!pp || !pp.hub) continue;
        const un = CEu && CEu.units && CEu.units[pp.unit];
        if (un && un.kind !== 'nose') continue;
        if (G2t && G2t.AF && pp.hubRaw && pp.hubRaw[2] < G2t.AF.z1 - 0.6) {
          console.warn('CAGE JOIN: prop hub captured at', pp.hubRaw,
            'which is INSIDE the body (skin nose z =', G2t.AF.z1,
            ', spinners seen:', spinners,
            ') — prop left static this build. Please report what the',
            'editor was showing (explode? engine panel open?) when this',
            'logged.');
          pp.hub = null;
        }
      }
    } catch (e) {}
    // a refused hub folds the prop back into the STATIC merge — present
    // and correct at its captured place, just not spinning this build
    for (const pp of PARTS.props) {
      if (!pp || pp.hub) continue;
      for (const k in pp.groups) {
        const src = pp.groups[k];
        const dst = groups[k] || (groups[k] = { pos: [], idx: [], nrm: [] });
        const base0 = dst.pos.length / 3;
        for (const ix of src.idx) dst.idx.push(ix + base0);
        for (const pv2 of src.pos) dst.pos.push(pv2);
        for (const nv2 of src.nrm) dst.nrm.push(nv2);
        delete pp.groups[k];
      }
    }
    for (const k in groups) groups[k] = bake(groups[k]);
    const parts = [];
    for (const pt of PARTS.wheels.concat(PARTS.others, PARTS.props.filter(Boolean))) {
      const keys = Object.keys(pt.groups);
      if (!keys.length) continue;
      // pivot: wheel = its axle; castor = its swivel TOP (it yaws about
      // it); stretch legs keep their verts UNREBASED (the game deforms
      // them per-vertex toward the axle) with the axle as reference
      // G59: a control surface's pivot is the centre of its own FORWARD
      // edge — computed in the MODEL frame from the captured vertices,
      // so it needs no anchor from the layer that drew it.
      let hingeAxis = null;
      if (pt.surf) {
        let mnx = 1e9, mxx = -1e9;
        for (const k of keys) {
          const q = pt.groups[k].pos;
          for (let i = 0; i < q.length; i += 3) {
            const x0 = q[i] * cB - q[i + 1] * sB;
            if (x0 < mnx) mnx = x0; if (x0 > mxx) mxx = x0;
          }
        }
        const band = mnx + 0.18 * Math.max(0.02, mxx - mnx);
        let sx = 0, sy = 0, sz = 0, n2 = 0,
            y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (const k of keys) {
          const q = pt.groups[k].pos;
          for (let i = 0; i < q.length; i += 3) {
            const x0 = q[i] * cB - q[i + 1] * sB,
                  yy = q[i] * sB + q[i + 1] * cB, zz = q[i + 2];
            if (x0 > band) continue;
            sx += x0; sy += yy; sz += zz; n2++;
            if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
            if (zz < z0) z0 = zz; if (zz > z1) z1 = zz;
          }
        }
        if (!n2) continue;
        pt.pivotM = [sx / n2, sy / n2, sz / n2];
        // the hinge runs along the forward edge's longer extent
        hingeAxis = (y1 - y0) > (z1 - z0) ? [0, 1, 0] : [0, 0, 1];
      }
      // G179.2: a strut part pivots on its first tip (its verts stay
      // unrebased, like a leg's — the pivot only has to exist)
      const TRUSS = pt.kind === 'liftstrut' || pt.kind === 'cabane' ||
                    pt.kind === 'interplane' || pt.kind === 'wire';
      if (TRUSS && pt.membersC && pt.membersC.length && !pt.axleC)
        pt.axleC = pt.membersC[0].tip;
      const pv = pt.pivotM ? pt.pivotM
        : pt.kind === 'prop' ? pt.hub
        : pt.kind === 'castorT'
          ? rotP(-pt.topC[2], pt.topC[1], pt.topC[0])
          : pt.axleC ? rotP(-pt.axleC[2], pt.axleC[1], pt.axleC[0])
                     : rotP(-pt.cz2, pt.cy2, pt.cx);
      if (!pv) continue;
      const gs2 = {};
      for (const k of keys) {
        const g = bake(pt.groups[k]);
        if (!pt.stretch)
          for (let i = 0; i < g.pos.length; i += 3) {
            g.pos[i] -= pv[0]; g.pos[i + 1] -= pv[1]; g.pos[i + 2] -= pv[2];
          }
        gs2[k] = g;
      }
      const out2 = { kind: pt.kind, R: pt.R || 0, pivot: pv,
                     stretch: !!pt.stretch, groups: gs2 };
      if (pt.kind === 'prop' && pt.axis) out2.axis = pt.axis;  // G59.1
      if (TRUSS && pt.membersC)   // G179.2: each member's line (G185: the truss too)
        out2.members = pt.membersC.map(m => ({
          pin: rotP(-m.pin[2], m.pin[1], m.pin[0]),
          tip: rotP(-m.tip[2], m.tip[1], m.tip[0]),
          ...(m.pinAt ? { pinAt: m.pinAt, tipAt: m.tipAt } : {}) }));
      if (pt.kind === 'eng') out2.unit = pt.unit;
      if (pt.stretch && pt.rootC)          // G58.7: the fixed airframe end
        out2.root = rotP(-pt.rootC[2], pt.rootC[1], pt.rootC[0]);
      if (pt.surf) {                       // G59: what drives it, and how
        out2.surf = pt.surf;
        out2.axis = hingeAxis;
        // G185: a second-plane surface drives as its first-plane twin
        // (the '2' is only its name) and says which plane it belongs to
        const S2 = pt.surf.replace(/2$/, '');
        if (/2$/.test(pt.surf)) out2.plane = 2;
        out2.drive = (S2 === 'rud' || S2 === 'rud2') ? 'dr'
                   : (S2 === 'elevR' || S2 === 'elevL') ? 'de'
                   // G200: 'flap', the linkage's own key (50_model_codec makeLinkage
                   // carries de/da/dr/flap). It read 'fl' here, which the linkage
                   // never carried, so a cage build's flaps never moved on screen.
                   : (S2 === 'flapR' || S2 === 'flapL') ? 'flap' : 'da';
        // ailerons are ANTISYMMETRIC; the rest move together
        out2.sgn = (S2 === 'ailL') ? -1 : 1;
        // THE RUDDERVATOR (2026-09-04): on a V-tail each elevator panel
        // also answers the rudder — the codec's second drive (50_model_
        // codec applyHinges, written for exactly this). The solver's mix is
        // al -= elevTau*de + rudTau*dr*side, so the right panel (cage +x =
        // model +z, side +1) deflects de + dr and the left de - dr. The
        // hinge runs along the CANTED root: [0, ±sin, cos] in the model
        // frame, the y part mirrored so a symmetric `de` stays symmetric.
        const SBh = window.CAGE_STAB;
        if ((S2 === 'elevR' || S2 === 'elevL') && SBh && SBh.cant >= 20) {
          const G = SBh.cant * Math.PI / 180, sd = S2 === 'elevR' ? 1 : -1;
          out2.axis = [0, sd * Math.sin(G), Math.cos(G)];
          out2.drive2 = 'dr'; out2.sgn2 = sd;
        }
      }
      if (pt.kind === 'castorT') {
        const axm = rotP(-pt.axC[2], pt.axC[1], pt.axC[0]);
        out2.axis = axm;                     // swivel axis, model frame
        out2.axle = rotP(-pt.axleC[2], pt.axleC[1], pt.axleC[0]);
      }
      parts.push(out2);
    }
    return { cage: true, groups, mats, off, pitch: beta, parts,
             zRoot: 0, surfaces: null };
  };
  // ...and the view comes back, on the way out or on the way to a throw.
  const snapshot = spec => {
    try { return snapshotAt(spec); }
    finally { viewRestore(); }
  };
  // THE FIT REPORT (G52, user: "the visual fit remains very approximate").
  // Frame vs visual, in numbers, in the model frame the pose shares (the
  // snapshot's `off` applied to the visual). Printed at every build & fly
  // so a misfit is a ROW, not a squint at the overlay. LE compares the
  // frame's derived leading edge against the outboard band of the visual
  // (|z| beyond 40% semispan is wing out there, nothing else is).
  const fitReport = (spec, vis) => {
    if (!vis || !vis.groups) return null;
    const RS = resolveSpec(JSON.parse(JSON.stringify(spec)));
    const fr = genFrame(RS.spec);
    const W2 = RS.spec.wing, cg0 = fr.cg0;
    // THE DATUM. The pose puts the visual at cg + off, and the frame's own
    // node coordinates are lattice (x = 0 at the firewall) — so the visual
    // reaches the lattice datum by + off + cg0, NOT by + off alone. Getting
    // this wrong reads every x row as a metre of misfit that is not there.
    // With gear.x measured (G52) off[0] reduces to zFw − cg0[0], so this sum
    // is exactly "x aft of the firewall" for every vertex.
    const ox = (vis.off ? vis.off[0] : 0) + cg0[0],
          oy = (vis.off ? vis.off[1] : 0) + cg0[1];
    // G54.2: the snapshot is pitch-calibrated; comparisons happen in the
    // DESIGN frame, so un-rotate each visual vertex by the baked pitch
    const vB = vis.pitch || 0, cV = Math.cos(vB), sV = Math.sin(vB);
    const uX = (x, y) => x * cV + y * sV, uY = (x, y) => -x * sV + y * cV;
    // frame: the WING is what compares honestly — the fuselage's extremes are
    // different PARTS on the two sides (the frame's forward node is an engine
    // mount, the visual's is a spinner tip), so those rows are labelled as
    // extents and read as trends, not as errors.
    let fy1 = -1e9, fz = 0, fx0 = 1e9, fx1 = -1e9;
    for (const n of fr.nodes) {
      fx0 = Math.min(fx0, n.p[0]); fx1 = Math.max(fx1, n.p[0]);
      fy1 = Math.max(fy1, n.p[1]);
      if (n.tag === 'WF' || n.tag === 'WR') fz = Math.max(fz, Math.abs(n.p[2]));
    }
    let vx0 = 1e9, vx1 = -1e9, vy1 = -1e9, vz = 0;
    for (const k in vis.groups) {
      const p = vis.groups[k].pos;
      for (let i = 0; i < p.length; i += 3) {
        const x = uX(p[i], p[i + 1]) + ox, az = Math.abs(p[i + 2]);
        vx0 = Math.min(vx0, x); vx1 = Math.max(vx1, x);
        vy1 = Math.max(vy1, uY(p[i], p[i + 1]) + oy); vz = Math.max(vz, az);
      }
    }
    // the outboard band is wing and nothing else; measure its LE and TE
    const band = 0.55 * vz;
    let vLE = 1e9, vTE = -1e9;
    for (const k in vis.groups) {
      const p = vis.groups[k].pos;
      for (let i = 0; i < p.length; i += 3)
        if (Math.abs(p[i + 2]) > band) {
          const x = uX(p[i], p[i + 1]) + ox;
          if (x < vLE) vLE = x;
          if (x > vTE) vTE = x;
        }
    }
    // the frame's wing at that same station, sweep included
    const yB = band, sw = Math.tan((W2.sweep || 0) * Math.PI / 180);
    const ch = W2.chord * (1 - (1 - W2.taper) * (yB / Math.max(0.01, vz)));
    const fLE = W2.xLE + sw * yB;
    // the BOOM at its midpoint (G54): the path between the measured
    // endpoints is the shape family's exponent — this row is what said
    // "diverging from the passenger pillar onwards" in numbers
    const fu2 = RS.spec.fuse;
    const SHP2 = (typeof GEN_SHAPES !== 'undefined' && GEN_SHAPES[fu2.shape])
               || { taper: 1 };
    const tE = Math.pow(0.5, SHP2.taper);
    const xMid = fu2.boxRear + (fu2.tailArm - fu2.boxRear) * 0.5;
    const PR = Array.isArray(fu2.profile) && fu2.profile.length >= 2
             ? fu2.profile : null;
    const pAt = (t2) => {                    // profile row at t2 (G54.1)
      let a = PR[0], b = PR[PR.length - 1];
      for (let i = 1; i < PR.length; i++)
        if (PR[i].t >= t2) { b = PR[i]; a = PR[i - 1]; break; }
      const u = Math.max(0, Math.min(1,
        (t2 - a.t) / Math.max(1e-6, b.t - a.t)));
      return { yb: a.yb + (b.yb - a.yb) * u, yt: a.yt + (b.yt - a.yt) * u };
    };
    const fBelly = PR ? pAt(0.5).yb : -0.02 + (fu2.tailBot + 0.02) * tE;
    const fDeck = PR ? pAt(0.5).yt
                : RS.spec.cab.h + (fu2.tailTop - RS.spec.cab.h) * tE;
    let vBelly = 1e9, vDeck = -1e9;
    for (const k in vis.groups) {
      const p = vis.groups[k].pos;
      for (let i = 0; i < p.length; i += 3) {
        if (Math.abs(uX(p[i], p[i + 1]) + ox - xMid) > 0.15 ||
            Math.abs(p[i + 2]) > 0.5) continue;
        const y = uY(p[i], p[i + 1]) + oy;
        if (y < vBelly) vBelly = y;
        if (y > vDeck) vDeck = y;
      }
    }
    const row = (part, f, v) => ({ part, frame: +f.toFixed(2),
      visual: +v.toFixed(2), delta: +(v - f).toFixed(2) });
    const out = [
      row('semispan (m)', fz, vz),
      row('wing LE @ outboard', fLE, vLE),
      row('wing TE @ outboard', fLE + ch, vTE),
      row('top y (fin apex vs skin)', fy1, vy1),
      row('extent fwd (mount vs spinner)', fx0, vx0),
      row('extent aft (post vs rudder TE)', fx1, vx1),
    ];
    if (vBelly < 1e8) out.push(
      row('boom belly @ mid (' + (PR ? 'profile' : fu2.shape) + ')',
          fBelly, vBelly),
      row('boom deck @ mid', fDeck, vDeck));
    // THE TAIL CHECK (G54.2, user: "run a check comparing the coordinates
    // of the tail... would you get confused with the plane's resting
    // position?"). Three layers, so the failing one NAMES itself:
    //  1 IDENTITY  — resolved spec vs the cage's own contacts. A gating
    //    failure on this build (missing ring, odd wheel count) shows as a
    //    non-zero delta here and NOWHERE else.
    //  2 STANCE    — the deck angle the resolved wheels imply vs the one
    //    the cage's contacts imply. Equal identities force equal angles.
    //  3 SETTLED   — a real sim settle: the pitch the physics reaches and
    //    the tailwheel's height over ground. THIS is where suspension
    //    asymmetry (soft mains compressing more than the tail leg) or any
    //    resting-position confusion becomes a number.
    try {
      const M2 = measure(), R2 = RS.spec, D2R = 180 / Math.PI;
      const deckOf = (gx, gy2, cR, tx, ty, tR) =>
        Math.atan2((ty - tR) - (gy2 - cR), tx - gx) * D2R;
      if (typeof M2.twY === 'number' && R2.gear.twY != null) {
        out.push(row('IDENT TW x: resolved vs cage', R2.gear.twX, M2.twX));
        out.push(row('IDENT TW y: resolved vs cage', R2.gear.twY, M2.twY));
      }
      if (typeof M2.gearY === 'number' && R2.gear.y != null)
        out.push(row('IDENT mains y: resolved vs cage', R2.gear.y, M2.gearY));
      if (typeof M2.twY === 'number' && typeof M2.gearY === 'number')
        out.push(row('STANCE deck deg: resolved vs cage',
          deckOf(R2.gear.x, R2.gear.y, R2.gear.contactR,
                 R2.gear.twX, R2.gear.twY, R2.gear.twR),
          deckOf(M2.gearX, M2.gearY, M2.contactR, M2.twX, M2.twY,
                 M2.twR || R2.gear.twR)));
      const def2 = buildGen(JSON.parse(JSON.stringify(spec)));
      const sim2 = makeSim(def2, null); sim2.reset(0);
      for (let i = 0; i < 300; i++) sim2.step(1 / 60);
      const ix = {}; def2.nodes.forEach((n, i) => {
        if (n.tag && !(n.tag in ix)) ix[n.tag] = i; });
      const agl = t => ix[t] === undefined ? NaN
        : sim2.p[ix[t] * 3 + 1] - (def2.nodes[ix[t]].r || 0);
      const axv = sim2.axes();
      out.push(row('SETTLED TW over ground (want 0)', 0, agl('TW')));
      out.push(row('SETTLED mains over ground (want 0)', 0,
        Math.min(agl('AXLEL'), agl('AXLER'))));
      // the BODY AXIS (noseFrame→tailMid) is itself inclined in the
      // design frame — the settled axis pitch equals stance MINUS that
      // inclination. Comparing raw axis pitch to stance is the trap
      // that hid the G54.2 rotation for three rounds: name both.
      const mean = ids => {
        const a = Array.isArray(ids) ? ids : [ids];
        let sx = 0, sy = 0;
        for (const i of a) { sx += def2.nodes[i].p[0]; sy += def2.nodes[i].p[1]; }
        return [sx / a.length, sy / a.length];
      };
      const nF = mean(def2.refs.noseFrame), tM = mean(def2.refs.tailMid);
      const phiAxis = Math.atan2(tM[1] - nF[1], tM[0] - nF[0]) * D2R;
      const builtDeck = (typeof M2.twY === 'number' &&
                         typeof M2.gearY === 'number')
        ? deckOf(M2.gearX, M2.gearY, M2.contactR, M2.twX, M2.twY,
                 M2.twR || R2.gear.twR) : NaN;
      out.push(row('AXIS inclination deg (design)', 0, phiAxis));
      out.push(row('SETTLED axis pitch vs predicted (stance − axis)',
        builtDeck - phiAxis,
        Math.atan2(-axv[0][1], Math.hypot(axv[0][0], axv[0][2])) * D2R));
    } catch (e3) {
      out.push({ part: 'TAIL CHECK THREW', frame: 0, visual: 0,
                 delta: String(e3.message).slice(0, 40) });
    }
    return out;
  };
  window.CAGE_JOIN = {
    export: () => cageJoinSpec(window.CAGE_UI.P, measure(), tables()),
    // read AFTER export: measure() is what fills it
    errors: () => ERRS.slice(),
    snapshot, fitReport,
  };
  // THE BUTTON IS GONE (G65, user: "there's an intermediate step to build...
  // It's one too much"). `build & fly` did three things — export through this
  // table, freeze the visual, hand the result to the save pipeline — and then
  // closed the editor onto a stand whose only reason to exist was that the
  // plaque was hidden behind the panel. All three are still done, by
  // app.js's `syncBuild`, which runs as a STEP inside the two operations that
  // actually need a committed build: running a bench test, and rolling out.
  // What is left here is the table and the measurements, which is what this
  // file was always for.
})();
