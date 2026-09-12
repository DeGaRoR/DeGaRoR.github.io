#!/usr/bin/env node
// _join_check.js — the JOIN verdict (G45). Feeds canned panel params and
// canned measurements through cageJoinSpec, asserts the declared table's
// field mappings, then runs the REAL pipeline (resolveSpec + genFrame)
// on the result and requires a finite CG — the join must always hand the
// game a spec it can build. Run: node tools/_join_check.js
'use strict';
const C = require('./flight_core.js');
const { GEN_TIPS, GEN_FLAPS, POWERPLANTS, resolveSpec, genFrame,
        GEN_PROP_MATS, GEN_SUSPENSION } = C;
const { cageJoinSpec, CAGE_JOIN_ENGINES, CAGE_JOIN_PROP_MATS } =
  require('./_cage_join.js');

let fails = 0;
const ok = (cond, label) => {
  console.log((cond ? '  ok     ' : '  FAIL   ') + label);
  if (!cond) fails++;
};

const T = {
  TIP_KEYS: Object.keys(GEN_TIPS),
  FLAP_KEYS: Object.keys(GEN_FLAPS),
  PRESET_NAMES: ['continental A-65', 'continental O-200', 'lycoming IO-360',
    'jabiru 2200', 'VW 2180', 'flat twin', 'flat six', 'rotax 912 (flat)',
    'rotax 277', 'rotax 582', 'P&W R-1830', 'RC 2212 outrunner',
    'RC 6374 outrunner', 'e-PPG 12 kW', 'FES sustainer', 'EMRAX 228'],
};
const P = {
  // G140: the stations, at NON-default values (tipX 0.24 is the old sweep
  // 3's own walk; crank fields ride the crank switch below)
  wgSpan: 11.2, wgChord: 1.55, wgChordTip: 1.09, wgTipX: 0.24,
  wgDihedral: 2.5, wgIncidence: 1.6, wgWashout: 1.2,
  wgCamber: 4, wgThick: 12,
  wgTip: T.TIP_KEYS.indexOf('rounded'), wgPos: 0, wgCentre: 1,
  wgBrace: 0, wgCrankAt: 0, wgCrankChord: 1.30, wgCrankX: 0.1,
  wgDihedralOut: 6, wgPanels: 3,
  wgFlapType: T.FLAP_KEYS.indexOf('slotted') >= 0
    ? T.FLAP_KEYS.indexOf('slotted') : 0,
  wgFlapSpan: 0.45, wgFlapChord: 0.22, wgAilSpan: 0.36, wgAilChord: 0.22,
  engPreset: T.PRESET_NAMES.indexOf('rotax 912 (flat)'),
  // G121.1: the fairing switch, at a NON-default state (1 = spat; the spec
  // default is 'none', so "it landed" cannot be impersonated by the default)
  s1Fair: 1,
  s2Fair: 2,                       // G121.2: the third wheel's, likewise
  // G133: the fairing's physics-bearing instruments, all at NON-default
  // states (defaults: tail 1 / legFair 0 / glassfibre). s2LegFair stays 0:
  // the trouser state (s2Fair 2) already fairs that leg.
  s1FairTail: 1.30, s2FairTail: 0.85, s1LegFair: 1, fairCons: 1,
  // G132: the drawn suspension and the drawn blade, every one at a
  // NON-default state for the same reason (defaults: bungee / 2 / wood /
  // the engine registry's own D)
  s1_shockKind: 2,                 // oleo
  cw_bladeN: 3, cw_propD: 2.10, cw_material: 3,   // 3-blade carbon, 2.10 m
};
// Every measured value here is chosen to DIFFER from what resolveSpec
// would derive on its own (side2 vs the default tandem2, 0.52 vs the
// side2 seat's 0.53, wheelR 0.21 vs the default 0.20...) — the resolved-
// spec assertions below cannot tell "the measurement landed" from "the
// default happens to match" otherwise. That is exactly how the G48 alias
// bug hid: the export carried the rows, the check read the EXPORT, and
// resolveSpec quietly rebuilt every one of them from the defaults.
const M = {
  gearType: 'taildragger', track: 1.62, contactR: 0.21,
  twX: 4.8, twY: 0.05, twR: 0.11,
  halfW: 0.52, cabH: 1.21, tailArm: 5.1,
  tailW: 0.14, tailBot: 0.31, tailTop: 0.52, cowlDeck: 0.66,
  noseGap: 0.93, cabLen: 1.24, postGap: 0.42, wingXLE: 0.55, gearX: 0.82,
  gearY: -0.31, shape: 'boom',
  hSpan: 2.4, hChord: 0.875, hX: 5.0, vHeight: 1.1, vChord: 0.9, vX: 5.2,
  stabH: 0.15,
  // TAIL CHANTIER 2 P1: the AREAS off the sheets (hChord = Sh / hSpan and
  // vChord = Sv / vHeight, as the join writes them), the dorsal apart, and
  // the control chords as area fractions — all NON-default (the rule would
  // size a very different tail for this wing; the defaults are 0.40 / 0.42)
  Sh: 2.1, Sv: 0.99, dorsalArea: 0.12, elevChord: 0.38, rudChord: 0.31,
  hTaper: 0.6, vTaper: 0.7,                    // P4: the trusses' trapezoids (defaults 1.0)
  profile: [{ t: 0, w: 0.45, yb: -0.05, yt: 1.15 },
            { t: 0.5, w: 0.22, yb: 0.28, yt: 0.66 },
            { t: 1, w: 0.14, yb: 0.31, yt: 0.52 }],
  seating: 'side2', pilots: 2,
  // G180: the drawn capacity and the seat-by-seat occupancy — four chairs
  // (a side-by-side with one bay), the cockpit's two filled, the bay's empty.
  // NON-default on purpose: the table's side2 would say 2 seats.
  seats: 4, occupied: [1, 1, 0, 0], pax: 0,
  cage: { waistY: -0.05 },
};

const s = cageJoinSpec(P, M, T);
ok(s.wings[0].span === 11.2, 'span passes verbatim');
ok(Math.abs(s.wings[0].taper - 1.09 / 1.55) < 1e-9, 'chord tip -> taper');
ok(s.wings[0].naca === 4412, 'camber 4 / thick 12 -> NACA 4412');
ok(s.wings[0].position === 'high' && s.wings[0].centre === 'glass',
   'position + centre map by name');
ok(s.wings[0].tip === 'rounded', 'tip maps by name');
// G140: the stations pass, sweep is never written, and crank fields stay
// null while the crank is off (a claim about a station that does not exist)
ok(s.wings[0].tipX === 0.24 && s.wings[0].sweep === undefined,
   'tip seat passes; sweep never written (G140)');
ok(s.wings[0].crankChord === null && s.wings[0].crankX === null,
   'crank fields null while the crank is off');
{
  const Pc = Object.assign({}, P, { wgCrankAt: 0.45 });
  const sc = cageJoinSpec(Pc, M, T);
  ok(sc.wings[0].crankChord === 1.30 && sc.wings[0].crankX === 0.1,
     'crank chord + seat pass when the crank is on');
}
ok(s.bracing.type === 'strut', 'bracing maps');
ok(s.bracing.cabane === undefined && s.wings[0].cabaneH === null,
   'G185: no cabane key and a null cabane height off a high wing');
{
  // G185: the parasol writes its position, its cabane height and the cabane
  // style; the aileron switch off writes a span of 0
  const Pp = Object.assign({}, P, { wgPos: 3, wgParaH: 0.61, bpCabane: 1, wgAilOn: 0 });
  const sp = cageJoinSpec(Pp, M, T);
  ok(sp.wings[0].position === 'parasol' && sp.wings[0].cabaneH === 0.61,
     'G185: parasol position + cabane height');
  ok(sp.bracing.cabane === 'V', 'G185: cabane style rides with the parasol');
  ok(sp.controls.aileron.span === 0, 'G185: ailerons off -> span 0');
  // the second plane: two entries, its own fields, and the truss keys — and
  // NONE of them when the switch is off
  ok(s.wings.length === 1 && s.bracing.interplane === undefined,
     'G185: one plane and no truss keys with w2On off');
  const Pb = Object.assign({}, P, { w2On: 1, w2Pos: 2, w2Stagger: 0.41, w2Span: 8.7, w2Chord: 1.31,
    w2ChordTip: 1.31, w2Camber: 2, w2Thick: 12, w2Panels: 3, w2Tip: T.TIP_KEYS.indexOf('rounded'),
    w2CrankAt: 0, w2Centre: 0, w2Dy: -0.05, w2AilOn: 0, w2AilSpan: 0.3, w2AilChord: 0.2,
    w2FlapType: 0, w2FlapSpan: 0.5, w2FlapChord: 0.2, w2Dihedral: 2, w2Incidence: 2, w2Washout: 1,
    w2TipX: 0.1, w2Cons: 3, bpInter: 1, bpInterAt: 0.55, bpWires: 2, bpCabane: 0 });
  const sb = cageJoinSpec(Pb, M, T);
  ok(sb.wings.length === 2 && sb.wings[1].span === 8.7 && sb.wings[1].stagger === 0.41 &&
     sb.wings[1].position === 'low' && sb.wings[1].place.dy === -0.05 &&
     sb.wings[1].controls.aileron.span === 0 && sb.wings[1].material === 'fabric' &&
     sb.wings[1].tipX === 0.1 && sb.wings[1].naca === 2412,
     'G185: the second plane carries its own rows');
  ok(sb.bracing.interplane === 'I' && sb.bracing.interplaneAt === 0.55 &&
     sb.bracing.wires === 'flying' && sb.bracing.cabane === 'N',
     'G185: the truss keys map (I strut at 0.55, flying wires only)');
}
ok(s.gear.fairing === 'spat', 'fairing switch -> gear.fairing (G121.1)');
ok(s.gear.twFairing === 'full',
   'third-wheel switch -> gear.twFairing (G121.2)');
ok(s.gear.legFair === 'fair' && s.gear.twLegFair === 'none',
   'leg-fairing switches -> gear.legFair / twLegFair (G133)');
ok(s.gear.fairTail === 1.30 && s.gear.twFairTail === 0.85,
   'droplet sliders -> gear.fairTail / twFairTail (G133)');
ok(s.gear.fairMat === 'carbon', 'fairing build row -> gear.fairMat (G133)');
ok(s.gear.suspension === 'oleo',
   'drawn shock -> gear.suspension (G132)');
ok(s.prop && s.prop.D === 2.10 && s.prop.blades === 3 &&
   s.prop.material === 'carbon',
   'drawn blade -> prop D / blades / material (G132)');
ok(s.prop.pitch === undefined,
   'pitch stays the design tile\'s alone — the join claims no twist');
// the map is TOTAL and lands only on real physics rows — a hole would fall
// through clampSpec's unknown->wood fallback and fly a silent birch blade
ok(Array.isArray(CAGE_JOIN_PROP_MATS) && CAGE_JOIN_PROP_MATS.length === 8 &&
   CAGE_JOIN_PROP_MATS.every(k => GEN_PROP_MATS[k]),
   'prop material map total over the 8 finishes, every entry a real row');
ok(['spring', 'bungee', 'oleo'].every(k => GEN_SUSPENSION[k]),
   'every drawn shock kind is a real GEN_SUSPENSION row');
ok(s.controls.flap.type !== undefined && s.controls.aileron.span === 0.36,
   'control surfaces pass');
ok(s.engines[0].type === 'rotax912_warp', 'preset -> registry key');
ok(POWERPLANTS[s.engines[0].type] != null, 'registry row exists');
for (const k in CAGE_JOIN_ENGINES)
  ok(POWERPLANTS[CAGE_JOIN_ENGINES[k]] != null, 'registry row for "' + k + '"');
ok(s.gear.type === 'taildragger' && s.gear.track === 1.62 &&
   s.gear.wheelR === 0.21, 'gear measurements pass (wheelR, not contactR)');
ok(s.gear.twX === 4.8 && s.gear.twY === 0.05 && s.gear.twR === 0.11,
   'measured third wheel passes (G51)');
ok(s.cabin.halfW === 0.52 && s.cabin.h === 1.21, 'cabin envelope passes');
ok(s.fuselage.tailArm === 5.1, 'tail arm passes');
ok(s.fuselage.tailW === 0.14 && s.fuselage.tailBot === 0.31 &&
   s.fuselage.tailTop === 0.52, 'tail-end section passes (G49)');
ok(s.fuselage.cowlDeck === 0.66, 'cowl deck passes (G49)');
ok(s.cabin.noseGap === 0.93 && s.cabin.len === 1.24 &&
   s.fuselage.postGap === 0.42, 'pillar proportions pass (G52)');
ok(s.wings[0].xLE === 0.55, 'wing station passes (G52)');
ok(s.gear.x === 0.82, 'mains station passes (G52)');
ok(s.gear.y === -0.31, 'ride height passes (G53)');
ok(s.fuselage.shape === 'boom', 'shape family passes (G54)');
ok(Array.isArray(s.fuselage.profile) && s.fuselage.profile.length === 3,
   'boom profile passes (G54.1)');
ok(s.tail.hSpan === 2.4 && s.tail.hX === 5.0 && s.tail.vHeight === 1.1 &&
   s.tail.vX === 5.2 && s.tail.stabH === 0.15,
   'tail surfaces pass (G54.3)');
ok(s.tail.Sh === 2.1 && s.tail.Sv === 0.99 && s.tail.hChord === 0.875 &&
   s.tail.vChord === 0.9 && s.tail.dorsal && s.tail.dorsal.area === 0.12 &&
   s.controls && s.controls.elevator.chord === 0.38 && s.controls.rudder.chord === 0.31,
   'P1: the areas, the mean chords, the dorsal and the control chords pass');
ok(s.tail.hTaper === 0.6 && s.tail.vTaper === 0.7, 'P4: the measured tapers pass');
ok(s.cabin.seating === 'side2' && s.cabin.pilots === 2,
   'seating + pilots pass (sectioned)');
ok(s.cabin.seats === 4 && Array.isArray(s.cabin.occupied) &&
   s.cabin.occupied.join() === '1,1,0,0' && s.cabin.pax === 0,
   'capacity + occupancy pass (G180: seats 4, occupied 1,1,0,0, pax 0)');
ok(s.cage && s.cage.waistY === -0.05, 'spec.cage rides along');

// the pipeline must BUILD what the join hands it — and the MEASURED rows
// must SURVIVE it. Asserting the export alone is how the G48 bug stayed
// green: genAlias overwrites the flat cab/fuse/seating/pilots aliases
// from the sections at the end of resolveSpec, so a row can be present
// in the export and gone from the aeroplane. Every measured row is
// therefore asserted on the RESOLVED spec, plus its `auto` flag — a row
// that arrived must NOT be marked as derived.
try {
  const RS = resolveSpec(JSON.parse(JSON.stringify(s)));
  const R = RS.spec;
  const fr = genFrame(R);
  const cg = fr.cg0;
  ok(cg.every(v => Number.isFinite(v)) && cg[3] > 50,
     'resolveSpec + genFrame -> finite CG, mass ' + cg[3].toFixed(0) + ' kg');
  ok(R.engine === 'rotax912_warp', 'engine survives normalisation');
  ok(R.cabin.halfW === 0.52 && !RS.auto['cab.halfW'],
     'RESOLVED cab halfW = measured 0.52, not auto');
  ok(R.cabin.h === 1.21 && !RS.auto['cab.h'],
     'RESOLVED cab h = measured 1.21, not auto');
  ok(R.fuselage.tailArm === 5.1 && !RS.auto['fuse.tailArm'],
     'RESOLVED tail arm = measured 5.1, not auto');
  ok(R.fuselage.tailW === 0.14 && R.fuselage.tailBot === 0.31 &&
     R.fuselage.tailTop === 0.52,
     'RESOLVED tail-end section = measured (tailY 0)');
  ok(R.fuselage.cowlDeck === 0.66 && !RS.auto['fuse.cowlDeck'],
     'RESOLVED cowl deck = measured 0.66, not auto');
  ok(R.cabin.noseGap === 0.93 && R.cabin.len === 1.24 && !RS.auto['cab.len'],
     'RESOLVED pillar proportions = measured, len not auto');
  // G121.1: the switch survives clampSpec and reaches the drag model's own
  // field — asserted on the RESOLVED spec, and at all three states, because
  // a mapping table with a hole is exactly the kind of thing that hides.
  ok(R.gear.fairing === 'spat', 'RESOLVED fairing = spat, through the clamp');
  ok(R.gear.twFairing === 'full',
     'RESOLVED third-wheel fairing = full, through the clamp');
  for (const [v, want] of [[0, 'none'], [2, 'full']]) {
    const Pv = Object.assign({}, P, { s1Fair: v });
    const Rv = resolveSpec(JSON.parse(JSON.stringify(
      cageJoinSpec(Pv, M, T)))).spec;
    ok(Rv.gear.fairing === want,
       'RESOLVED fairing state ' + v + ' -> ' + want);
  }
  // G133: the fairing instruments survive the clamp — and the clamp is a
  // real clamp (an out-of-range droplet lands on the bound, not verbatim)
  ok(R.gear.legFair === 'fair' && R.gear.twLegFair === 'none' &&
     R.gear.fairTail === 1.30 && R.gear.twFairTail === 0.85 &&
     R.gear.fairMat === 'carbon',
     'RESOLVED fairing instruments = drawn, through the clamp');
  {
    const Pv = Object.assign({}, P, { s1FairTail: 9, fairCons: 7 });
    const Rv = resolveSpec(JSON.parse(JSON.stringify(
      cageJoinSpec(Pv, M, T)))).spec;
    ok(Rv.gear.fairTail === 1.60 && Rv.gear.fairMat === 'glass',
       'RESOLVED out-of-range droplet clamps to 1.60, unknown layup -> glass');
  }
  // G132: the drawn suspension survives the clamp, at every state
  ok(R.gear.suspension === 'oleo',
     'RESOLVED suspension = drawn oleo, through the clamp');
  for (const [v, want] of [[0, 'spring'], [1, 'bungee']]) {
    const Pv = Object.assign({}, P, { s1_shockKind: v });
    const Rv = resolveSpec(JSON.parse(JSON.stringify(
      cageJoinSpec(Pv, M, T)))).spec;
    ok(Rv.gear.suspension === want,
       'RESOLVED suspension state ' + v + ' -> ' + want);
  }
  // G133: the leg KIND outranks the (link-only) shock row — an oleo leg
  // flies an oleo and a beam leg flies spring steel, whatever the hidden
  // shock row holds
  for (const [leg, want] of [[0, 'spring'], [2, 'oleo']]) {
    const Pv = Object.assign({}, P, { s1Leg: leg, s1_shockKind: 1 });
    const Rv = resolveSpec(JSON.parse(JSON.stringify(
      cageJoinSpec(Pv, M, T)))).spec;
    ok(Rv.gear.suspension === want,
       'RESOLVED suspension from leg kind ' + leg + ' -> ' + want);
  }
  // G132: the drawn blade reaches the THRUST MODEL — D sticks through the
  // null-means-derive door (put only fills null), and the derived name
  // carries the family, which is the one string a plaque will print
  ok(R.prop.D === 2.10 && R.prop.blades === 3 && R.prop.material === 'carbon',
     'RESOLVED prop = drawn 3-blade carbon 2.10 m');
  ok(typeof R.prop.name === 'string' && /carbon/i.test(R.prop.name) &&
     /2.10/.test(R.prop.name),
     'RESOLVED prop name derived from the drawn blade: ' + R.prop.name);
  ok(R.fuselage.postGap === 0.42, 'RESOLVED post gap = measured 0.42');
  ok(R.wings[0].xLE === 0.55 && !RS.auto['wing.xLE'],
     'RESOLVED wing LE station = measured 0.55, not auto');
  ok(R.gear.x === 0.82, 'RESOLVED mains station = measured 0.82');
  ok(R.cabin.seating === 'side2' && R.crew === 2,
     'RESOLVED seating side2, crew 2');
  ok(R.seats === 4 && R.occupants === 2 && R.pax === 0 &&
     Array.isArray(R.occupied) && R.occupied.join() === '1,1,0,0',
     'RESOLVED capacity 4 off cabin.seats (not the table\'s 2), two aboard off the list (G180)');
  ok(R.gear.track === 1.62 && R.gear.wheelR === 0.21,
     'RESOLVED gear track + wheelR = measured');
  ok(R.gear.y === -0.31 && !RS.auto['gear.y'],
     'RESOLVED ride height = measured -0.31, not auto (G53)');
  ok(R.fuselage.shape === 'boom', 'RESOLVED shape family = measured boom');
  ok(Array.isArray(R.fuselage.profile) && R.fuselage.profile.length === 3 &&
     Math.abs(R.fuselage.profile[1].yb - 0.28) < 1e-9,
     'RESOLVED boom profile = measured rows, clamped envelope');
  ok(R.tail.hSpan === 2.4 && R.tail.hX === 5.0 && !RS.auto['tail.hX'] &&
     R.tail.vHeight === 1.1 && R.tail.vX === 5.2 && R.tail.stabH === 0.15,
     'RESOLVED tail surfaces = measured, stations not auto');
  // P1: THE DRAWN TAIL IS THE FLOWN TAIL — the areas survive resolve (the
  // volume rule is `put` and stands down), the chords are the MEAN ones,
  // the control chords reach the tau, and the frame's strips sum to the
  // measured areas: measured -> resolved -> frame, end to end
  ok(R.tail.Sh === 2.1 && !RS.auto['tail.Sh'] && R.tail.Sv === 0.99 && !RS.auto['tail.Sv'] &&
     R.tail.hChord === 0.875 && !RS.auto['tail.hChord'] &&
     R.tail.vChord === 0.9 && !RS.auto['tail.vChord'] &&
     R.tail.dorsal.area === 0.12 &&
     R.controls.elevator.chord === 0.38 && R.controls.rudder.chord === 0.31,
     'P1 RESOLVED: Sh 2.1 / Sv 0.99 stand (not auto), mean chords, dorsal 0.12, control chords 0.38 / 0.31');
  try {
    const dP1 = C.buildGen(JSON.parse(JSON.stringify(s)));
    const st = dP1.strips || [];
    const shS = st.filter(q => q.kind === 'stab').reduce((t, q) => t + q.area, 0);
    const svS = st.filter(q => q.kind === 'fin').reduce((t, q) => t + q.area, 0);
    ok(Math.abs(shS - 2.1) < 1e-9 && Math.abs(svS - 0.99) < 1e-9,
       'P1 FRAME: the stab strips sum to Sh 2.1 and the fin strip is Sv 0.99 (' +
       shS.toFixed(4) + ' / ' + svS.toFixed(4) + ')');
    const d0 = C.buildGen(JSON.parse(JSON.stringify(Object.assign({}, s, { controls: undefined }))));
    ok(dP1.params.elevTau < d0.params.elevTau - 1e-6 && dP1.params.rudTau < d0.params.rudTau - 1e-6,
       'P1 FRAME: the measured (smaller) control chords reach the tau (' +
       dP1.params.elevTau.toFixed(3) + ' < ' + d0.params.elevTau.toFixed(3) + ', ' +
       dP1.params.rudTau.toFixed(3) + ' < ' + d0.params.rudTau.toFixed(3) + ')');
    // P4: THE TAIL IS A TRUSS — spar nodes on both surfaces, the tip nodes
    // FIRST under their old tags (every consumer keys on the first so
    // tagged), every tail member class 'tail', the strips on the bays with
    // their four spar nodes, the measured tapers on the trapezoid (the tip
    // station's chord over the root's = hTaper), the carry-through tied
    const tg = {}; for (const n of dP1.nodes) tg[n.tag] = (tg[n.tag] || 0) + 1;
    ok(tg.HF >= 6 && tg.HR >= 6 && tg.VF >= 3 && tg.VR >= 3 && tg.HTL === 1 && tg.HTR === 1 && tg.FIN === 1,
       'P4 FRAME: the tail has spar nodes (HF ' + tg.HF + ', HR ' + tg.HR + ', VF ' + tg.VF + ', VR ' + tg.VR + ') and one tip a side');
    ok(dP1.nodes.findIndex(n => n.tag === 'HTL') < dP1.nodes.findIndex(n => n.tag === 'HF') &&
       dP1.nodes.findIndex(n => n.tag === 'FIN') < dP1.nodes.findIndex(n => n.tag === 'VF'),
       'P4 FRAME: the tip nodes and the apex are made before their spars (the first-tagged rule)');
    const tailB = dP1.beams.filter(b => b.cls === 'tail');
    ok(tailB.length >= 40 && !dP1.beams.some(b => b.cls === 'fus' && dP1.nodes[b.a].tag === 'HTL'),
       'P4 FRAME: ' + tailB.length + ' tail-class members, none of the tail on the fuselage class');
    const T = dP1.parts.TAIL;
    ok(T && st.filter(q => q.kind === 'stab').every(q => q.fIn != null && q.rOut != null) &&
       st.filter(q => q.kind === 'fin').every(q => q.fIn != null),
       'P4 FRAME: every stab and fin strip names its four spar nodes');
    ok(T && Math.abs(T.chordH(T.semiH) / T.chordH(0) - M.hTaper) < 1e-9 &&
       Math.abs(T.chordV(1) / T.chordV(0) - M.vTaper) < 1e-9,
       'P4 FRAME: the trusses stand on the measured tapers (' + M.hTaper + ' / ' + M.vTaper + ')');
    const ct = dP1.beams.some(b => (dP1.nodes[b.a] === dP1.nodes[T.HF.L[0]] && b.b === T.HF.R[0]) ||
                                   (b.a === T.HF.L[0] && b.b === T.HF.R[0]));
    ok(ct, 'P4 FRAME: the front spar carries through (HF0L–HF0R)');
    // ...and the solver reads the deformed spars: a stab strip's normal comes
    // off its nodes (kind stays 'stab' — the alpha law, the elevator and the
    // downwash key on it), so a tail-only pitch of the frame is seen
    ok(st.filter(q => q.kind === 'stab').every(q => q.kind === 'stab'), 'P4: the strips keep their kind');
  } catch (e) { ok(false, 'P1 frame row threw: ' + e.message); }
  // the frame must actually FOLLOW the profile: the mid-boom station's floor
  // sits at the measured 0.28, not on the family curve
  {
    const fr2 = genFrame(R);
    const bx = R.fuse.boxRear, ta = R.fuse.tailArm;
    let bestI = -1, bestD = 1e9;
    fr2.nodes.forEach((n, i) => {
      if (!n.tag || n.tag.indexOf('S') !== 0 || n.tag.indexOf('B') < 0) return;
      const t = (n.p[0] - bx) / Math.max(1e-6, ta - bx);
      if (t > 0.05 && Math.abs(t - 0.5) < bestD) { bestD = Math.abs(t - 0.5); bestI = i; }
    });
    const tB = (fr2.nodes[bestI].p[0] - bx) / (ta - bx);
    const want = 0.28 * ((tB <= 0.5 ? tB / 0.5 : (1 - (tB - 0.5) / 0.5))) +
      (tB <= 0.5 ? -0.05 * (1 - tB / 0.5) : 0.31 * ((tB - 0.5) / 0.5));
    ok(Math.abs(fr2.nodes[bestI].p[1] - want) < 0.02,
       'FRAME mid-boom floor follows the measured profile (' +
       fr2.nodes[bestI].p[1].toFixed(3) + ' vs ' + want.toFixed(3) + ')');
  }
  ok(R.gear.twX === 4.8 && R.gear.twY === 0.05 && R.gear.twR === 0.11,
     'RESOLVED tailwheel station/height/radius = measured');
  ok(Math.abs(R.gear.contactR -
      0.21 * Math.cos((R.gear.camber || 0) * Math.PI / 180)) < 1e-9,
     'RESOLVED contactR derives from the measured wheelR');
} catch (e) {
  ok(false, 'pipeline threw: ' + e.message);
}

// a bare-minimum export (no measurements) must still build
try {
  const s2 = cageJoinSpec(P, null, T);
  const fr2 = genFrame(resolveSpec(JSON.parse(JSON.stringify(s2))).spec);
  ok(fr2.cg0.every(Number.isFinite), 'measurement-less export still builds');
} catch (e) {
  ok(false, 'measurement-less export threw: ' + e.message);
}

// THE COVERING IS JOINED (2026-09-04): skinOn 0 -> fuselage.covering 'open',
// absent otherwise; resolved, an open frame is LIGHTER (no cloth on the
// fuselage bays) and DRAGGIER (the truss in the wind) than the same build
// covered — and the covered build's own numbers are the ones it always had
// (the delta rule, as the gear's).
try {
  ok(s.fuselage.covering === undefined, 'default skinOn writes no covering');
  const sO = cageJoinSpec(Object.assign({}, P, { skinOn: 0 }), M, T);
  ok(sO.fuselage.covering === 'open', 'skinOn 0 -> fuselage.covering open');
  const RO = resolveSpec(JSON.parse(JSON.stringify(sO))).spec;
  ok(RO.fuselage.covering === 'open', 'RESOLVED covering = open');
  const dS = C.buildGen(JSON.parse(JSON.stringify(s)));
  const dO = C.buildGen(JSON.parse(JSON.stringify(sO)));
  const mS = dS.nodes.reduce((t, n) => t + n.m, 0);
  const mO = dO.nodes.reduce((t, n) => t + n.m, 0);
  ok(mO < mS - 2, 'an open frame is lighter than the covered one (' +
     mS.toFixed(1) + ' -> ' + mO.toFixed(1) + ' kg)');
  ok(dO.params.fusCdA[0] > dS.params.fusCdA[0] + 0.05,
     'an open frame is draggier (fusCdA ' + dS.params.fusCdA[0].toFixed(3) +
     ' -> ' + dO.params.fusCdA[0].toFixed(3) + ' m2)');
  const sB = JSON.parse(JSON.stringify(s)); sB.fuselage.covering = 'bogus';
  const RC = resolveSpec(sB).spec;
  ok(RC.fuselage.covering === 'skin', 'a nonsense covering clamps to skin');
} catch (e) {
  ok(false, 'covering join threw: ' + e.message);
}

// THE MOUNTS ARE JOINED (2026-09-04): engMount 1/2/3 -> engines[].mount, the
// drawn units' stations ride in as x/y/z, a pair is two entries; resolved,
// the frame hangs the engine where the join said and a pair pulls twice.
try {
  ok(s.engines.length === 1 && s.engines[0].mount === 'nose' &&
     s.engines[0].x === undefined, 'default mount: nose, no station written');
  const MU = Object.assign({}, M, { engUnits: [{ x: 3.1, y: 0.62, z: 0 }] });
  const sP = cageJoinSpec(Object.assign({}, P, { engMount: 1 }), MU, T);
  ok(sP.engines[0].mount === 'pusher' && sP.engines[0].x === 3.1 &&
     sP.engines[0].y === 0.62, 'engMount 1 -> pusher at the drawn station');
  const RP = resolveSpec(JSON.parse(JSON.stringify(sP))).spec;
  ok(RP.engAt && RP.engAt[0].mount === 'pusher' && RP.engAt[0].x === 3.1,
     'RESOLVED engAt = the drawn pusher station');
  const dP = C.buildGen(JSON.parse(JSON.stringify(sP)));
  const eN = dP.refs.engine.map(i => dP.nodes[i]);
  // the mount nodes carry the BLADES; the engine hangs on its own CG node,
  // AHEAD of a pusher's flange (2026-09-05, the cgFwd half-session)
  const cgN = dP.nodes.filter(n => n.tag === 'CGE');
  ok(eN.length === 2 && eN.every(n => Math.abs(n.p[0] - 3.1) < 1e-9 && n.m > 0) &&
     cgN.length === 1 && cgN[0].p[0] < 3.1 - 0.05 && cgN[0].m > 20,
     'pusher frame: two mount nodes at x 3.1 (' + eN.map(n => n.m.toFixed(1)).join('/') +
     ' kg of blades), the engine (' + (cgN[0] ? cgN[0].m.toFixed(1) : '?') +
     ' kg) on its CG node ' + (cgN[0] ? (3.1 - cgN[0].p[0]).toFixed(2) : '?') +
     ' m ahead of the flange');
  ok(dP.params.nEngines === 1, 'a pusher is one engine');
  const MW = Object.assign({}, M, { engUnits: [{ x: 0.9, y: 1.4, z: 2.1 }, { x: 0.9, y: 1.4, z: -2.1 }] });
  const sW = cageJoinSpec(Object.assign({}, P, { engMount: 3 }), MW, T);
  ok(sW.engines.length === 2 && sW.engines.every(e => e.mount === 'wing' && e.z === 2.1),
     'engMount 3 -> a wing pair, |z| 2.1');
  const dW = C.buildGen(JSON.parse(JSON.stringify(sW)));
  const wN = dW.refs.engine.map(i => dW.nodes[i]);
  ok(dW.params.nEngines === 2 && wN.length === 2 &&
     Math.abs(wN[0].p[2] + wN[1].p[2]) < 1e-9 && Math.abs(Math.abs(wN[0].p[2]) - 2.1) < 1e-9,
     'wing pair: nEngines 2, mirrored nacelle nodes at |z| 2.1');
  // G194: THE HAND AND THE LEVERS. engRotate 1 (tops inward) is port +1 /
  // starboard -1 through the join and the resolve; the frame says which
  // engine each node carries; the solver shares thrust per ENGINE and is
  // bit-identical with the levers null.
  const sR = cageJoinSpec(Object.assign({}, P, { engMount: 3, engRotate: 1 }), MW, T);
  ok(sR.engines[0].sense === 1 && sR.engines[1].sense === -1,
     'engRotate 1 -> port +1, starboard -1 (tops inward)');
  const RR = resolveSpec(JSON.parse(JSON.stringify(sR))).spec;
  ok(RR.engines[0].sense === 1 && RR.engines[1].sense === -1 &&
     RR.engines[1].z === RR.engines[0].z && RR.engines[1].type === RR.engines[0].type,
     'RESOLVED: the pair keeps its hands and stays mirrored in everything else');
  ok(RR.engAt[0].side === -1 && RR.engAt[1].side === 1 && RR.engAt[1].sense === -1,
     'engAt carries side (-1 port, +1 starboard) and sense');
  const sO = cageJoinSpec(Object.assign({}, P, { engMount: 3, engRotate: 2 }), MW, T);
  ok(sO.engines[0].sense === -1 && sO.engines[1].sense === 1, 'engRotate 2 -> tops outward');
  ok(JSON.stringify(dW.refs.engineOf) === '[0,1]' && dW.nodes[dW.refs.engine[0]].p[2] < 0,
     'refs.engineOf: node 0 (port, z < 0) is engine 0, node 1 is engine 1');
  ok(dW.params.engines && dW.params.engines.length === 2 && dW.params.engines[0].side === -1,
     'params.engines carries side and sense to the viewer');
  {
    const simW = C.makeSim(dW); simW.reset(0);
    for (let i = 0; i < 120; i++) simW.step(1 / 60);
    simW.ctl.thr = 1; simW.ctl.eng = null; simW.step(1 / 60);
    const T0 = simW.out.thrust, P0 = simW.out.thrustPer.slice();
    ok(P0.length === 2 && Math.abs(P0[0] - P0[1]) < 1e-9 && Math.abs(T0 - P0[0] - P0[1]) < 1e-6,
       'levers null: two equal engines, thrust their sum (' + T0.toFixed(0) + ' N)');
    simW.ctl.eng = [{ on: 1, thr: 1 }, { on: 1, thr: 0.5 }]; simW.step(1 / 60);
    const P1 = simW.out.thrustPer.slice();
    ok(Math.abs(P1[1] - 0.5 * P1[0]) < 1e-6 * Math.max(1, P1[0]),
       'starboard lever at 50 %: half the port thrust (' + P1[0].toFixed(0) + ' / ' + P1[1].toFixed(0) + ' N)');
    simW.ctl.eng = [{ on: 1, thr: 1 }, { on: 0, thr: 1 }]; simW.step(1 / 60);
    ok(simW.out.thrustPer[1] === 0 && simW.out.thrust > 0, 'a cut engine makes no thrust, the other still does');
    // the yaw couple: with the starboard engine cut, the port thrust at -z is
    // a moment about the CG — exact off the node position — and the nose
    // swings within three seconds
    const zL = dW.nodes[dW.refs.engine[0]].p[2];
    ok(Math.abs(simW.out.thrustPer[0] * zL) > 100,
       'port thrust alone is a real yaw moment (' + Math.abs(simW.out.thrustPer[0] * zL).toFixed(0) + ' N m)');
    const hdg = () => { const x = simW.axes()[0]; return Math.atan2(-x[2], -x[0]); };
    const h0 = hdg();
    for (let i = 0; i < 180; i++) simW.step(1 / 60);
    let dh = hdg() - h0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    ok(Math.abs(dh) > 0.01, 'the nose swings on one engine (' + (dh * 57.3).toFixed(1) + ' deg in 3 s)');
    simW.ctl.eng = null; simW.step(1 / 60);
    ok(Math.abs(simW.out.thrustPer[0] - simW.out.thrustPer[1]) < 1e-9, 'levers null again: even again');
  }
  const sT = cageJoinSpec(Object.assign({}, P, { engMount: 2, engPylonH: 0.4 }), M, T);
  ok(sT.engines[0].mount === 'wingTop' && sT.engines[0].pylon === 0.4 &&
     sT.engines[0].x === undefined, 'engMount 2 -> over the wing, pylon 0.4, station derived');
  const RT = resolveSpec(JSON.parse(JSON.stringify(sT))).spec;
  ok(RT.engAt[0].mount === 'wingTop' && RT.engAt[0].y > RT.cab.h + 0.4 - 1e-9,
     'RESOLVED over-the-wing engine sits a pylon above the deck (' +
     RT.engAt[0].y.toFixed(2) + ' m)');
  const dT = C.buildGen(JSON.parse(JSON.stringify(sT)));
  ok(dT.refs.engine.length === 2 && dT.nodes[dT.refs.engine[0]].p[1] > RT.cab.h,
     'over-the-wing frame: mount nodes above the cabin');
} catch (e) {
  ok(false, 'mount join threw: ' + e.message);
}

// THE TWIN BOOMS ARE JOINED (2026-09-04, cut 1): the booms' half-track and
// length write tail.type twinBoom; a measured fin counts twice in Sv; the
// frame still builds (the centreline post stands in — the stated approximation)
try {
  // (P1: with no MEASURED Sv the twin rule doubles the fin's height × chord;
  // with one, the join has already doubled the drawn fin and the rule stands
  // down — both pinned)
  const sT = cageJoinSpec(P, Object.assign({}, M, { boomX: 1.25, boomLen: 3.2, vHeight: 0.9, vChord: 0.8, Sv: undefined }), T);
  ok(sT.tail.type === 'twinBoom' && sT.tail.boomX === 1.25, 'boomX -> tail.type twinBoom');
  const RT2 = resolveSpec(JSON.parse(JSON.stringify(sT))).spec;
  ok(Math.abs(RT2.tail.Sv - 2 * 0.9 * 0.8) < 1e-9, 'RESOLVED Sv = two measured fins (' + RT2.tail.Sv.toFixed(3) + ')');
  {
    const sT3 = cageJoinSpec(P, Object.assign({}, M, { boomX: 1.25, boomLen: 3.2, vHeight: 0.9, vChord: 0.8, Sv: 1.6 }), T);
    const RT3 = resolveSpec(JSON.parse(JSON.stringify(sT3))).spec;
    ok(Math.abs(RT3.tail.Sv - 1.6) < 1e-9, 'P1: a measured twin Sv (the join doubled the drawn fin) stands over the twin rule');
  }
  const frT = genFrame(RT2);
  ok(frT.cg0.every(Number.isFinite), 'a twin-boom spec builds');
  ok(frT.parts.BOOMS && frT.parts.FIN2 != null &&
     Math.abs(frT.nodes[frT.parts.HTR].p[2] - 1.25) < 1e-9 &&
     Math.abs(frT.nodes[frT.parts.FIN2].p[2] + 1.25) < 1e-9,
     'the frame has two booms: the stab nodes at ±boomX, a fin node a boom');
} catch (e) { ok(false, 'twin-boom join threw: ' + e.message); }

// THE GLAZING IS JOINED (2026-09-04): glazeOn 0 -> cabin.glazing 'none' and
// a lighter frame (no glass); absent = glass, a nonsense value clamps
try {
  ok(s.cabin.glazing === undefined, 'default glazing writes nothing');
  const sG = cageJoinSpec(Object.assign({}, P, { glazeOn: 0 }), M, T);
  ok(sG.cabin.glazing === 'none', 'glazeOn 0 -> cabin.glazing none');
  const dG = C.buildGen(JSON.parse(JSON.stringify(sG)));
  const dS0 = C.buildGen(JSON.parse(JSON.stringify(s)));
  const mG = dG.nodes.reduce((t, n) => t + n.m, 0), mS0 = dS0.nodes.reduce((t, n) => t + n.m, 0);
  ok(mG < mS0 - 1, 'an open cockpit is lighter (' + mS0.toFixed(1) + ' -> ' + mG.toFixed(1) + ' kg)');
  const sB2 = JSON.parse(JSON.stringify(s)); sB2.cabin.glazing = 'bogus';
  ok(resolveSpec(sB2).spec.cabin.glazing === 'glass', 'a nonsense glazing clamps to glass');
} catch (e) { ok(false, 'glazing join threw: ' + e.message); }

// THE V-TAIL IS JOINED (2026-09-04): the stab layer's cant >= 20 deg writes
// tail.type 'v' + vAngle; the panels' measured projection survives resolve
// (a built V keeps its span, the AR rule does not re-size it) and the frame
// builds with no FIN node; a flat stab writes no type at all.
try {
  ok(s.tail.type === undefined, 'a flat stab writes no tail.type');
  const sV = cageJoinSpec(P, Object.assign({}, M, { tailCant: 35 }), T);
  ok(sV.tail.type === 'v' && sV.tail.vAngle === 35,
     'cant 35 -> tail.type v, vAngle 35');
  const RSV = resolveSpec(JSON.parse(JSON.stringify(sV)));
  const RV = RSV.spec;
  ok(RV.tail.type === 'v' && Math.abs(RV.tail.vG - 35 * Math.PI / 180) < 1e-9,
     'RESOLVED type v, vG = 35 deg');
  ok(Math.abs(RV.tail.hSpan - 2.4) < 1e-9 && !RSV.auto['tail.hSpan'],
     'RESOLVED V-tail keeps the measured projection 2.4 (' +
     RV.tail.hSpan.toFixed(3) + ')');
  ok(Math.abs(RV.tail.Svt - (2.4 / Math.cos(RV.tail.vG)) * M.hChord) < 1e-9,
     'RESOLVED V panel area = (span / cos) x chord');
  // P1: a MEASURED panel area (the join's Svt off the drawn sheets) is the
  // area; the mean chord follows over the uncanted span
  {
    const sV2 = cageJoinSpec(P, Object.assign({}, M, { tailCant: 35, Svt: 2.2 }), T);
    const RV2 = resolveSpec(JSON.parse(JSON.stringify(sV2))).spec;
    ok(sV2.tail.Svt === 2.2 && Math.abs(RV2.tail.Svt - 2.2) < 1e-9 &&
       Math.abs(RV2.tail.hChord - 2.2 / (2.4 / Math.cos(RV2.tail.vG))) < 1e-9,
       'P1: a measured V Svt 2.2 stands and its mean chord is Svt over the uncanted span');
  }
  const frV = genFrame(RV);
  ok(frV.cg0.every(Number.isFinite) && !frV.nodes.some(n => n.tag === 'FIN'),
     'V-tail frame builds, and has no FIN node');
  const sC = cageJoinSpec(P, Object.assign({}, M, { tailCant: 10 }), T);
  ok(sC.tail.type === undefined, 'a 10 deg dihedral stab is not a V');
} catch (e) {
  ok(false, 'V-tail join threw: ' + e.message);
}

// G134: the CUSTOM ENGINE row — facts in, clamped, priced, flown. And its
// ABSENCE is load-bearing: no engineFacts = the registry preset flies, which
// is the identity ruling's untouched-preset half.
try {
  const M3 = Object.assign({}, M, { engineFacts: {
    name: 'modified Rotax 912 UL', mass: 62, powerW: 66000, rpm: 5600,
    torque: 113, aspiration: 'na', family: 'four', cooling: 'liquid' } });
  const s3 = cageJoinSpec(P, M3, T);
  ok(s3.engines[0].custom && s3.engines[0].custom.powerW === 66000,
     'engineFacts land as engines[0].custom');
  ok(s3.engines[0].type === (CAGE_JOIN_ENGINES[T.PRESET_NAMES[
       Math.round(P.engPreset)]] || 'a65_sensenich74'),
     'the preset key survives as the fallback row');
  const RS3 = resolveSpec(JSON.parse(JSON.stringify(s3)));
  const R3 = RS3.spec;
  ok(R3.pplant && R3.pplant.engine.mass === 62 &&
     R3.pplant.engine.name === 'modified Rotax 912 UL',
     'RESOLVED pplant flies the custom facts under the honest name');
  ok(R3.pplant.price > 0, 'an unpriced custom row takes the market curve');
  const fr3 = genFrame(R3);
  ok(fr3.cg0.every(Number.isFinite) && fr3.cg0[3] > 50,
     'a custom-engined spec builds to a finite CG');
  const s4 = cageJoinSpec(P, M, T);         // same M, no engineFacts
  ok(!s4.engines[0].custom,
     'no facts -> no custom row (the registry preset flies)');
} catch (e) {
  ok(false, 'custom engine block threw: ' + e.message);
}


// ---- G199.3: ROWS THE JOIN DID NOT MEASURE ARE NOT WRITTEN --------------
// The merge writes a fuselage or tail row only from a measurement; a save's
// own rows stand otherwise. This is the whole of what let the user's rod-boom
// ultralight fly on 2026-09-04, and what G188's ring-less fallback took away.
try {
  const M9 = Object.assign({}, M);
  for (const k of ['postGap', 'tailW', 'tailBot', 'tailTop', 'profile',
                   'hSpan', 'hChord', 'hX', 'vHeight', 'vChord', 'vX', 'stabH'])
    delete M9[k];
  const s9 = cageJoinSpec(P, M9, T);
  ok(s9.fuselage.postGap == null && s9.fuselage.tailW == null &&
     s9.fuselage.tailBot == null && s9.fuselage.tailTop == null,
     "G199.3: unmeasured post rows are not written (the save's own stand)");
  ok(!s9.tail || (s9.tail.hSpan == null && s9.tail.hX == null &&
                  s9.tail.vHeight == null),
     'G199.3: unmeasured tail surface rows are not written');
} catch (e) {
  ok(false, 'G199.3 block threw: ' + e.message);
}

// ---- G199.5: A ROD BOOM DECLARES ITSELF, AND THE FRAME CAN STIFFEN ITS BAYS
// The truss has no tube class: a rod-boom build flies the lofted default
// section, ~12x too soft in torsion, and the tail rolls with the tailwheel.
// The cage's boomStyle reaches the spec as fuselage.boom, survives the
// resolve, and the frame multiplies k on the boom's members by
// GEN_RULES.rodBoomK — and nothing else: same lattice, same mass. The rule
// is 1 today (its own comment has the measured trade), so the ratio is
// pinned to WHATEVER the rule says, not to a number.
try {
  const sRod = cageJoinSpec(Object.assign({}, P, { boomStyle: 1 }), M, T);
  const sLoft = cageJoinSpec(Object.assign({}, P, { boomStyle: 0 }), M, T);
  const sTwin = cageJoinSpec(Object.assign({}, P, { boomStyle: 2 }), M, T);
  ok(sRod.fuselage.boom === 'rod' && sLoft.fuselage.boom === 'loft' &&
     sTwin.fuselage.boom === 'twin',
     'G199.5: the cage\'s boom construction reaches the spec (rod / loft / twin)');
  const RR = resolveSpec(sRod), RL = resolveSpec(sLoft);
  ok(RR.spec.fuse.boom === 'rod' && RL.spec.fuse.boom === 'loft',
     'G199.5: ...and survives resolveSpec');
  const fR = genFrame(RR.spec), fL = genFrame(RL.spec);
  ok(fR.beams.length === fL.beams.length && fR.nodes.length === fL.nodes.length,
     'G199.5: the rod boom builds the same lattice (nodes and members)');
  // TAIL CHANTIER 2 P6: the rule may be a NUMBER or the word 'computed' —
  // the frame then derives it from the tube's own GJ over the lattice's
  // (61_gen_frame rodK). Either way it is ONE factor, the same on every
  // boom member and nowhere else, so the row reads the factor off the
  // members themselves and holds the rest of the aeroplane to 1.
  const xb = RL.spec.fuse.boxRear;
  let boom = 0, other = 0, bad = 0, KR = null;
  for (let i = 0; i < fL.beams.length; i++) {
    const b = fL.beams[i], r = fR.beams[i];
    const aft = fL.nodes[b.a].p[0] >= xb - 1e-6 && fL.nodes[b.b].p[0] >= xb - 1e-6;
    const ratio = r.k / b.k, cr = r.c / b.c;
    if (b.cls === 'fus' && aft) {
      boom++;
      if (KR === null) KR = ratio;
      if (Math.abs(ratio - KR) > 1e-9 || Math.abs(cr - Math.sqrt(KR)) > 1e-9) bad++;
    } else { other++; if (Math.abs(ratio - 1) > 1e-9 || Math.abs(cr - 1) > 1e-9) bad++; }
  }
  ok(KR >= 1 && boom > 20 && bad === 0,
     'G199.5: every boom member carries ONE rodBoomK (' + (KR == null ? '—' : KR.toFixed(3)) +
     ', the rule says ' + C.GEN_RULES.rodBoomK + ') on k and its root on c, nothing else moved (' +
     boom + ' boom, ' + other + ' other)');
  const mR = fR.nodes.reduce((s, n) => s + n.m, 0), mL = fL.nodes.reduce((s, n) => s + n.m, 0);
  ok(Math.abs(mR - mL) < 1e-9, 'G199.5: the stiffening weighs nothing');
  const s0 = cageJoinSpec(P, M, T);
  ok(s0.fuselage.boom === 'loft', 'G199.5: a cage without a boomStyle row declares a loft');
  // the switch itself, exercised: with the rule at 4 the rod's members are 4x
  const saved = C.GEN_RULES.rodBoomK;
  C.GEN_RULES.rodBoomK = 4;
  try {
    const f4 = genFrame(resolveSpec(sRod).spec);
    let n4 = 0, bad4 = 0;
    for (let i = 0; i < fL.beams.length; i++) {
      const b = fL.beams[i], aft = fL.nodes[b.a].p[0] >= xb - 1e-6 && fL.nodes[b.b].p[0] >= xb - 1e-6;
      if (b.cls === 'fus' && aft) { n4++; if (Math.abs(f4.beams[i].k / b.k - 4) > 1e-9) bad4++; }
    }
    ok(n4 > 20 && bad4 === 0, 'G199.5: turned to 4, every boom member is 4x (the switch works)');
  } finally { C.GEN_RULES.rodBoomK = saved; }
} catch (e) {
  ok(false, 'G199.5 block threw: ' + e.message);
}

// ---------------------------------------------------------------------------
// G209 — THE SURFACES TURN THE WAY THE SOLVER FLIES THEM. cageSurfHinge is
// the join's one measurement of a control surface (pivot, hinge axis, drive,
// sign); each expectation below is a physical fact, not a table read back:
//   de > 0 nose up      -> elevator TE UP
//   da > 0 roll right   -> PORT (+z) aileron TE DOWN, starboard TE UP
//   dr > 0 nose LEFT    -> rudder TE to PORT (+z); castor already steers so
//   flap > 0            -> TE DOWN
//   V-tail, dr > 0      -> port panel TE DOWN, starboard TE UP
// and the hinge follows the panel: a cranked 14 deg outer panel hinges
// along its own root, not along the model z. The old table failed the first
// four of these on every cage build (ailerons, flaps and rudder reversed,
// only the elevator right) and put a 17 deg error on a Jodel's aileron.
// ---------------------------------------------------------------------------
try {
  const { cageSurfHinge } = require('./_cage_join.js');
  // a panel in the MODEL frame: chord 0.3 aft (+x), span 1 about zc (+z is
  // PORT), `dih` of rise per metre outboard, `rake` of aft lean per metre
  const panel = (zc, dih, rake, vertical) => {
    const pts = [];
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 3; j++) {
      const s = -0.5 + i / 10, x = j * 0.1;
      pts.push(vertical ? [x + rake * s, s + 1, 0] : [x + rake * s, dih * s * Math.sign(zc || 1), zc + s]);
    }
    return pts;
  };
  const rot = (v, ax, ang) => {
    const ca = Math.cos(ang), sa = Math.sin(ang), C1 = 1 - ca, d = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2];
    return [v[0] * ca + (ax[1] * v[2] - ax[2] * v[1]) * sa + ax[0] * d * C1,
            v[1] * ca + (ax[2] * v[0] - ax[0] * v[2]) * sa + ax[1] * d * C1,
            v[2] * ca + (ax[0] * v[1] - ax[1] * v[0]) * sa + ax[2] * d * C1];
  };
  const TE = [0.3, 0, 0];                       // a trailing-edge point, pivot-relative
  const swing = (H, drive2) => rot(TE, H.axis, drive2 ? H.sgn2 * 0.3 : H.sgn * 0.3);
  const hP = cageSurfHinge(panel(2, 0, 0), 'ailR'), hS = cageSurfHinge(panel(-2, 0, 0), 'ailL');
  ok(hP && hP.drive === 'da' && hP.pivot[2] > 0 && swing(hP)[1] < -0.05,
     'G209: the PORT aileron (the cage\'s "ailR", at +z) goes DOWN for da > 0 (roll right)');
  ok(hS && hS.drive === 'da' && hS.pivot[2] < 0 && swing(hS)[1] > 0.05,
     'G209: the starboard aileron goes UP for da > 0');
  const fP = cageSurfHinge(panel(1, 0, 0), 'flapR'), fS = cageSurfHinge(panel(-1, 0, 0), 'flapL');
  ok(fP && fP.drive === 'flap' && swing(fP)[1] < -0.05 && fS && swing(fS)[1] < -0.05,
     'G209: both flaps go DOWN for flap > 0');
  const eP = cageSurfHinge(panel(1, 0, 0), 'elevR'), eS = cageSurfHinge(panel(-1, 0, 0), 'elevL');
  ok(eP && eP.drive === 'de' && !eP.drive2 && swing(eP)[1] > 0.05 && swing(eS)[1] > 0.05,
     'G209: the elevator goes UP for de > 0 (nose up), no second drive on a flat stab');
  const r = cageSurfHinge(panel(0, 0, 0, true), 'rud');
  ok(r && r.drive === 'dr' && Math.abs(r.axis[1]) > 0.99 && swing(r)[2] > 0.05,
     'G209: the rudder swings to PORT (+z) for dr > 0 (nose left)');
  const r2 = cageSurfHinge(panel(0, 0, 0.12, true), 'rud2');
  ok(r2 && r2.drive === 'dr' && Math.abs(r2.axis[0] - 0.12 / Math.hypot(1, 0.12)) < 0.02,
     'G209: a raked post hinges along its rake; the twin-boom\'s second rudder reads as a rudder');
  // the crank: 14 deg of dihedral and 6 deg of plan taper on the outer panel
  const dih = Math.tan(14 / 57.3), rk = Math.tan(6 / 57.3);
  const cP = cageSurfHinge(panel(3, dih, rk), 'ailR'), cS = cageSurfHinge(panel(-3, dih, rk), 'ailL');
  const want = [rk, dih, 1].map((x, _, a) => x / Math.hypot(a[0], a[1], a[2]));
  const dotP = cP.axis[0] * want[0] + cP.axis[1] * want[1] + cP.axis[2] * want[2];
  const dotS = cS.axis[0] * want[0] - cS.axis[1] * want[1] + cS.axis[2] * want[2];
  ok(dotP > 0.9998 && dotS > 0.9998 && cP.axis[2] > 0 && cS.axis[2] > 0,
     'G209: a cranked panel\'s aileron hinges along its own root, within 1 deg, either side');
  ok(swing(cP)[1] < -0.05 && swing(cS)[1] > 0.05,
     'G209: ...and still antisymmetric: port down, starboard up for da > 0');
  // the V-tail: 35 deg of cant, the panel rising outboard on each side
  const vd = Math.tan(35 / 57.3);
  const vP = cageSurfHinge(panel(1, vd, 0), 'elevR', { cant: 35 }), vS = cageSurfHinge(panel(-1, vd, 0), 'elevL', { cant: 35 });
  ok(vP && vP.drive2 === 'dr' && vS && vS.drive2 === 'dr' && Math.abs(vP.axis[1] - Math.sin(35 / 57.3)) < 0.02,
     'G209: past 20 deg of cant both panels answer the rudder too, hinged along the canted root');
  ok(swing(vP)[1] > 0.05 && swing(vS)[1] > 0.05,
     'G209: V-tail de > 0: both panels UP');
  ok(swing(vP, 1)[1] < -0.05 && swing(vS, 1)[1] > 0.05 && swing(vP, 1)[2] > 0 && swing(vS, 1)[2] > 0,
     'G209: V-tail dr > 0 (nose left): port panel DOWN, starboard UP, both trailing edges to port');
  ok(!cageSurfHinge(panel(1, 0, 0), 'elevR', { cant: 10 }).drive2,
     'G209: 10 deg of stab dihedral is not a V-tail');
  // TAIL CHANTIER 2 P1 — THE DECLARED HINGE (the user: "when horn balance
  // option, the pivot point is wrong"). A horn-balanced rudder keeps a tab
  // FORWARD of the hinge at its tip: the forward-edge heuristic puts the
  // pivot in the tab; the layer's declared plane puts it on the post.
  {
    const horn = panel(0, 0, 0, true);                 // the rudder, x 0..0.3, y 1..2
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 3; j++)
      horn.push([-0.15 + 0.15 * j / 3, 1.9 + 0.1 * i / 4, 0]);   // the horn: x −0.15..0 at the top
    const h0 = cageSurfHinge(horn, 'rud');
    const h1 = cageSurfHinge(horn, 'rud', { hinge: { n: [1, 0, 0], d: 0, eps: 0.03 } });
    ok(h0 && h0.hingeFrom === 'vertices' && h0.pivot[0] < -0.05,
       'P1: the vertex heuristic puts a horn-balanced rudder\'s pivot in the HORN (x ' + h0.pivot[0].toFixed(3) + ')');
    ok(h1 && h1.hingeFrom === 'declared' && Math.abs(h1.pivot[0]) < 0.02 &&
       Math.abs(h1.axis[1]) > 0.999 && h1.drive === 'dr' && h1.sgn === -1,
       'P1: the declared plane puts it on the post (x ' + h1.pivot[0].toFixed(3) + '), axis up the post, drive and sign unchanged');
    ok(cageSurfHinge(horn, 'rud', { hinge: { n: [1, 0, 0], d: 9, eps: 0.03 } }).hingeFrom === 'vertices',
       'P1: a declared plane that catches no vertex falls back to the heuristic, and says so');
  }
  // ...and on the REAL horn-cut fin: the page fixture's aeroplane with
  // finCut 2, built headless, its rudder part mapped the way the bake maps
  // every vertex (px = −z·FS, py = y·FS, pz = x·FS, then the frame's pitch
  // β), the declared plane through the same map — the pivot lies on the
  // plane and the axis is the pitched post
  try {
    const TH = require('./_tail_headless.js');
    const raw = require('./fixtures/tail_measure_2026-09-07_boot.json');
    const t = TH.tailBuild(Object.assign({}, raw.P, { finCut: 2 }), { level: raw.level });
    const sh = t.fin.sheet, FS = t.FS, beta = 0.08, cB = Math.cos(beta), sB = Math.sin(beta);
    const seen = new Set(), pts = [];
    for (const f of sh.F) if (f.part === 'rudder') for (const vi of f.v) {
      if (seen.has(vi)) continue;
      seen.add(vi);
      const v = sh.V[vi], px = -v[2] * FS, py = v[1] * FS;
      pts.push([px * cB - py * sB, px * sB + py * cB, v[0] * FS]);
    }
    const zM = t.fin.measure.hinge.zM;
    const H = { n: [cB, sB, 0], d: -zM };
    const hd = cageSurfHinge(pts, 'rud', { hinge: H });
    const hv = cageSurfHinge(pts, 'rud');
    const onPlane = p => H.n[0] * p[0] + H.n[1] * p[1] - H.d;
    const post = [-sB, cB, 0];
    ok(hd && hd.hingeFrom === 'declared' && Math.abs(onPlane(hd.pivot)) < 0.02 &&
       hd.axis[0] * post[0] + hd.axis[1] * post[1] > 0.998,
       'P1: the real horn-cut rudder (' + pts.length + ' verts) pivots ON the declared plane (' +
       onPlane(hd.pivot).toFixed(4) + ' m off), axis along the pitched post');
    ok(hv && onPlane(hv.pivot) < -0.05,
       'P1: ...where the vertex heuristic had put it ' + (-onPlane(hv.pivot)).toFixed(3) + ' m forward, in the horn');
  } catch (e) { ok(false, 'P1 real horn row threw: ' + e.message); }
  // and the solver agrees with the drawn ruddervator: a V-tail spec yaws
  // nose-LEFT for dr > 0 and pitches up for de > 0 (the inward normal, G209)
  {
    const { makeSim, makeWorld, buildGen } = C;
    const sv = cageJoinSpec(P, Object.assign({}, M, { tailCant: 35 }), T);
    ok(sv.tail.type === 'v' && sv.tail.vAngle === 35, 'G209: the measured cant makes the spec a V-tail');
    const def = buildGen(sv), sim = makeSim(def, makeWorld());
    sim.reset(0); for (let i = 0; i < 120; i++) sim.step(1 / 60);
    const ax = sim.axes(), vel = [-ax[0][0] * 30, -ax[0][1] * 30, -ax[0][2] * 30];
    const pr = c => { sim.ctl.de = c.de || 0; sim.ctl.dr = c.dr || 0; return sim.probe(vel); };
    const b = pr({}), d = pr({ dr: 0.3 }), e = pr({ de: 0.3 });
    ok(d.yawLeft - b.yawLeft > 100, 'G209: V-tail dr > 0 yaws nose LEFT (' + (d.yawLeft - b.yawLeft).toFixed(0) + ')');
    ok(e.pitchUp - b.pitchUp > 100, 'G209: V-tail de > 0 pitches nose UP (' + (e.pitchUp - b.pitchUp).toFixed(0) + ')');
  }
} catch (e) {
  ok(false, 'G209 block threw: ' + e.message);
}

// G300 — A FITTING NAMES THE PART IT IS BOLTED TO. cagePartMatch is the
// join's ancestor walk as a pure function of one ancestor: a `userData.partOf`
// tag wins over every name, the boom and tail skins are parts only on twin
// booms, and an unknown name keeps walking (null). The walk that bakes the
// snapshot reads it; this pins what it answers.
try {
  const { cagePartMatch } = require('./_cage_join.js');
  const m = (n, ud, twin) => cagePartMatch(n, ud || {}, twin);
  ok(m('edHinge_edFinSkin_metal', { partOf: 'edFinSkin2' }, true).src === 'edFinSkin2' &&
     m('edHinge_edFinSkin_metal', { partOf: 'edFinSkin2' }, true).tag === true,
     'G300: a partOf tag names the part, whatever the mesh is called');
  ok(m('edHinge_edFinSkin_metal', { partOf: 'edFinSkin' }, false).src === 'edFinSkin',
     'G300: ...and on a single boom it still names it (the join finds no such part and keeps it static)');
  ok(m('edAcc_edBoomL_metal', { partOf: 'edBoomL' }, true).src === 'edBoomL',
     'G300: a boom fitting names its boom');
  ok(m('edLamp_nav', { partOf: 'edSurf_rud' }, false).src === 'edSurf_rud',
     'G300: the tail light names the rudder');
  ok(m('edFinSkin', {}, true).src === 'edFinSkin' && m('edFinSkin', {}, true).members === true &&
     m('edFinSkin', {}, false) === null,
     'G267.2: the fin skin is a part on twin booms only');
  ok(m('edFinFillet2', {}, true).src === 'edFinFillet2' && m('edFinFillet', {}, false) === null,
     'G300: the root fillet belongs to the fin on twin booms');
  ok(m('edSurf_rud', {}, false).src === 'edSurf_rud' && m('edSurf_rud', {}, false).ctl === true &&
     m('edLink_rud_b', {}, false).src === 'edLink_rud_b' && m('edCastorT', {}, false).src === 'edCastorT',
     'the surfaces, links and the castor match by name as before');
  ok(m('edWheelT', {}, false).wheel === 'tw' && m('edWheelL', {}, false).wheel === 'mainsL' &&
     m('edProp_1', {}, false).prop === true && m('edSpinner', {}, false).prop === true,
     'the wheels and the prop match by name as before');
  ok(m('edFit_liftstrut', {}, false).members === true && m('edEngL', {}, false).members === true,
     'the struts and the engine units carry their members');
  ok(m('cageLayer:hinge', {}, true) === null && m('', {}, true) === null && m('edStabSkinR', {}, false) === null,
     'an unknown name, an unnamed group and a stab skin on a single boom keep walking (static)');
} catch (e) {
  ok(false, 'G300 block threw: ' + e.message);
}

// THE VERDICT CONTRACT (G67.1): this checker joins the battery, and the
// runner requires BOTH signals — the line and the exit code.
if (fails) console.log('\n  ' + fails + ' check(s) failed');
console.log('GATE JOIN: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
