// CAGE LIGHT LAYER (G96) — the aeroplane's own lights, and the switches that
// work them.
//
// THE RULE, AND IT IS THE USER'S: "there should be no light without emitting
// geometry." An aeroplane that gets brighter with nothing on it to be bright
// is the exact failure GATE LIGHT was written for — three separate reports of
// "the plane is lit from below", three different KINDS of invisible source.
// So every row in the table below OWNS a lamp, a lens or a strip you can point
// at, the gate asserts it, and every one of them is declared on the room's own
// switchboard so the census can see it.
//
// AND EVERY POSITION IS MEASURED. A navigation light goes on the wingtip — so
// it is placed at the extreme of the WING'S OWN geometry, not at a station
// somebody typed. The beacon goes on top of the fin, the panel lights in the
// coaming lip the crew layer measured, the pedalier lights in the footwell the
// floor already defines. Nothing here knows a number about the aeroplane that
// the aeroplane could not be asked for.
//
// Load after _cage_crew (anchors), _cage_wing and _cage_fin (the surfaces the
// outside lamps sit on), and before _cage_ui. Chains PAGE.post.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});

// ---------------------------------------------------------------------------
// THE DECLARED TABLE
// ---------------------------------------------------------------------------
// `grp` is the user's own split and it is not cosmetic: OUTSIDE lights are
// PHYSICAL SWITCHES — a landing light is on or it is off — and INSIDE lights
// are POTENTIOMETERS, because the one thing you do with a cabin light at night
// is turn it down until you can just read by it.
//
// `col` is the light's own colour, and the international ones are not a
// choice: port RED, starboard GREEN, tail WHITE, beacon RED. `w` is the lens
// or strip size in metres.
const LIGHTS = {
  // ---- OUTSIDE, on/off ----------------------------------------------------
  nav: { name: 'navigation', grp: 'ext', ctl: 'switch', order: 3,
         col: 0xfff0e0, w: 0.052,
         note: 'port red, starboard green, tail white' },
  // THE BEACON ROTATES (G99, user: "now do the beacon flash"). It is not a
  // strobe and it is not a pulsing lamp: a light aeroplane's anti-collision
  // beacon is a fixed red dome with a MIRROR TURNING INSIDE IT, and what you
  // see from any one place is that beam sweeping past you once a turn. So
  // `rpm` is a rotation rate and not a flash rate — and the flash you see IS
  // the rotation, computed against the camera, rather than a sine wave
  // pretending to be one. 45 rpm is the ordinary rate for the type.
  beacon: { name: 'beacon', grp: 'ext', ctl: 'switch', order: 1,
            col: 0xff2412, w: 0.060, rotor: true, rpm: 45 },
  taxi: { name: 'taxi', grp: 'ext', ctl: 'switch', order: 0,
          col: 0xfff2d6, w: 0.090, beam: 0.62, thr: 1.6 },
  land: { name: 'take-off & landing', grp: 'ext', ctl: 'switch', order: 2,
          col: 0xfffaf0, w: 0.110, beam: 0.30, thr: 4.0 },
  // ---- INSIDE, dimmable ---------------------------------------------------
  flood: { name: 'flood (overhead)', grp: 'int', ctl: 'dim', order: 0,
           col: 0xffd9a0, w: 0.075 },
  // THE INSTRUMENT LIGHT IS REAL (the panel arc, session 3): the dial faces
  // are painted surfaces on one emissive material (_cage_panel.js
  // `material('faces')`) and this dimmer is what lights the printing. No
  // lamp of its own: the faces ARE the emitting geometry, declared on the
  // switchboard by the panel layer. `byPanel` keeps this layer from
  // drawing or declaring anything for it.
  instr: { name: 'instrument', grp: 'int', ctl: 'dim', order: 1,
           col: 0xff9a4a, w: 0.030, byPanel: true },
  // (the `panel` strip in the glareshield lip is GONE — session 4b, the
  // user: "there's an horizontal bar for ages on top of the dash, I really
  // don't know what it's for, and I would want it removed". It was a 1 cm
  // lens across the whole panel under the coaming, seen from the seat as a
  // grey bar; the instrument light above lights the dials from their own
  // faces, which is what the strip was for.)
  pedal: { name: 'pedalier', grp: 'int', ctl: 'dim', order: 3,
           col: 0xffc27a, w: 0.026 },
  pax: { name: 'passenger', grp: 'int', ctl: 'dim', order: 4,
         col: 0xffd9a0, w: 0.048 },
};
const EXT = Object.keys(LIGHTS).filter(k => LIGHTS[k].grp === 'ext')
  .sort((a, b) => LIGHTS[a].order - LIGHTS[b].order);
const INT = Object.keys(LIGHTS).filter(k => LIGHTS[k].grp === 'int')
  .sort((a, b) => LIGHTS[a].order - LIGHTS[b].order);

// THE LAMP BAY, DECLARED ONCE AND READ BY TWO LAYERS. The wing has to CUT
// itself here and this layer has to put a lamp in the hole, and if the two
// disagreed by a centimetre the lamp would sit behind solid skin. So the bay
// is stated in the WING'S OWN COORDINATES — a span fraction and a chord
// fraction — and published at load time, before any build runs.
//
//   frac   how far out along the semispan the lamp sits
//   half   half the bay's spanwise width, in metres
//   chord  how far aft of the leading edge the cut reaches, as a chord
//          fraction. 0.13 stops SHORT OF THE FRONT SPAR at 0.15 — you may cut
//          a light into the D-nose, you may not cut the spar.
//   depth  how far into the D-nose the bay reaches, in metres — the back
//          wall of the little box the lamp sits in
//
// ALL FOUR ARE PARAMETERS (the user: "we need to be able to parametrize
// these, move them, size them"), so the bay is rebuilt from the panel's own
// rows rather than from these defaults whenever the rows exist.
window.CAGE_LIGHT_BAY = { frac: 0.24, half: 0.17, chord: 0.13, depth: 0.06 };
// the panel's rows drive it; the object above is the default and the shape
function bayFromP(P) {
  const B = window.CAGE_LIGHT_BAY;
  if (!P) return B;
  if (P.li_bayFrac != null) B.frac = +P.li_bayFrac;
  if (P.li_bayHalf != null) B.half = +P.li_bayHalf;
  if (P.li_bayChord != null) B.chord = +P.li_bayChord;
  if (P.li_bayDepth != null) B.depth = +P.li_bayDepth;
  return B;
}
// PUBLISHED, because THE WING CUTS THE HOLE AND THIS LAYER FILLS IT, and the
// wing's post hook runs FIRST. A declaration that is only resolved when its
// owner builds is resolved too late for the layer that reads it: all four
// rows moved nothing at all, because the wing had already cut the bay from
// the DEFAULTS by the time this file looked at the panel. Both layers now
// call this before they read the bay, so there is still one owner and one
// description, and the order they happen to run in stops mattering.
window.CAGE_BAY_FROM_P = bayFromP;

// ---- parameters -----------------------------------------------------------
// One row per light, plus the master. A switch stores 0/1 and a potentiometer
// stores 0..1, which is exactly the difference between the two control kinds.
const defaults = { lightOn: 1, lightSw: 1,
  // THE BAY, as rows (G98). Station and half-width place it, chord says how
  // far aft the cut reaches, depth how deep the box behind it is, and size
  // scales the lamp inside.
  li_bayFrac: 0.24, li_bayHalf: 0.17, li_bayChord: 0.13, li_bayDepth: 0.06,
  li_lampSize: 1.0, li_beaconRpm: LIGHTS.beacon.rpm,
  // THE FAIRING'S SHAPE, for every lamp that wears one. `li_lampSize` scaled
  // the LAMP; these two scale the pod around it, which is the other half of
  // "more options for the lights geometry in general" (user, 2026-08-31).
  li_podLen: 1.0, li_podGirth: 1.0,
  // HOW DEEP THE BEACON SITS IN THE FIN. 0.5 is the old straddle — centre ON
  // the fitted top line, so half the fairing is inside the fin and its inner
  // faces render through the surface (measured: 619 of 633 beacon vertices
  // inside the fin's own 44 mm slab, buried up to 221 mm). 0 sits it on top.
  // G315: 0.04 — ON TOP (the user: "not being positioned on top of it, as it
  // should, but inside it"): the fairing's foot seats on the edge, no more.
  li_beaconSink: 0.04,
  // THE WINGTIP NAV, which was five inline literals and no rows at all.
  li_navSpan: 0.02, li_navChord: 0.10, li_navRise: 0.0,
  // G185: on a biplane, which plane carries the bay and the tip lights
  li_plane: 0,
  // the reflector inside a lit fitting glows (user: "it feels strange to have
  // this reflector full dark with a lit bulb in it")
  li_reflect: 1 };
for (const k of EXT) defaults['li_' + k] = 0;
for (const k of INT) defaults['li_' + k] = 0;
PAGE.defaults = Object.assign(defaults, PAGE.defaults || {});

const items = [
  ['lightOn', 'lights', 0, 1, 1],
  ['lightSw', 'draw the switches', 0, 1, 1, { when: P => +P.lightOn }],
  ['outside', EXT.map(k => ['li_' + k, LIGHTS[k].name, 0, 1, 1]),
   { when: P => +P.lightOn }],
  ['inside (dimmers)', INT.filter(k => !LIGHTS[k].later)
    .map(k => ['li_' + k, LIGHTS[k].name, 0, 1, 0.05]),
   { when: P => +P.lightOn }],
  ['the wing bay', [
    ['li_plane', 'tip lights on which wing', 0, 1, 1, ['first', 'second'],
     { when: P => +P.lightOn && !!+P.w2On }],
    ['li_bayFrac', 'station (semispan)', 0.10, 0.80, 0.01],
    // THE RANGE HAS TO REACH THE NEXT ROW. The cut snaps to the loft's own
    // spanwise rows, which on this wing are 0.735 m apart — so a slider that
    // stopped at 0.45 could never widen the bay past one cell, and moving it
    // did nothing at all. Whatever the user asks for, the bay steps.
    // ...and since G189 the loft CUTS a row at each edge of the bay (the
    // wing spec's `cuts`), so the width is the width asked for, down to a
    // lamp's own size, instead of one loft strip
    ['li_bayHalf', 'half-width', 0.04, 2.0, 0.01,
     { dim: 'm' }],
    ['li_bayChord', 'cut aft to (chord)', 0.04, 0.14, 0.005],
    ['li_bayDepth', 'lamp setback', 0.03, 0.28, 0.005, { dim: 'm' }],
    ['li_lampSize', 'lamp size', 0.4, 1.8, 0.05],
  ], { when: P => +P.lightOn }],
  // EVERY FAIRING, not one row per lamp: the same economy GEN_ACCESS applies
  // to its own fittings. Three knobs across all of them, not fifteen.
  ['lamp fairings', [
    ['li_podLen',   'fairing length',  0.5, 2.0, 0.05],
    ['li_podGirth', 'fairing girth',   0.6, 1.8, 0.05],
    ['li_reflect',  'reflector glows', 0, 1, 1],
  ], { when: P => +P.lightOn }],
  ['the navigation lights', [
    ['li_navSpan',  'inboard from the tip', 0.00, 0.30, 0.005, { dim: 'm' }],
    ['li_navChord', 'aft of the leading edge', 0.00, 0.40, 0.005, { dim: 'm' }],
    ['li_navRise',  'up / down in the section', -1, 1, 0.05],
  ], { when: P => +P.lightOn && +P.li_nav }],
  ['the beacon', [
    // 0.5 is the old behaviour: the fairing's centre ON the fin's top edge,
    // so half of it is inside the fin. The user reported the consequence as
    // the red light rendering THROUGH the dorsal fin.
    ['li_beaconSink', 'sunk into the fin', 0, 0.5, 0.01],
    // 0 parks the mirror and the beacon burns steady, which is also what an
    // aeroplane with a failed beacon motor looks like
    ['li_beaconRpm', 'rotation', 0, 120, 1, { dim: 'rpm' }],
  ], { when: P => +P.lightOn }],
];
(PAGE.groupsOverride || (PAGE.groups = PAGE.groups || []))
  .push(['2e · lights', items]);

// ---------------------------------------------------------------------------
// MATERIALS
// ---------------------------------------------------------------------------
// A LENS IS EMISSIVE, NOT UNLIT. `MeshBasicMaterial` is the kind of source
// GATE LIGHT's census calls 'unlit' — "lit by nothing and therefore cannot be
// dimmed by anything" — and a lamp that cannot be dimmed is exactly what a
// potentiometer needs not to be. An emissive Standard material carries its
// own brightness in `emissiveIntensity`, which is the dimmer.
// THE LAYER'S OWN MATERIAL NAMES, declared as a table like every other
// layer's, so `AERO_HARD.light` can be checked against it in both directions
// (GATE SKINMAT parses this out of the source rather than trusting a list).
const MAT = {
  lodge: { col: 0x9aa1a9, rough: 0.45, metal: 0.70 },  // machined housing
  seal:  { col: 0x2a2d33, rough: 0.60, metal: 0.10 },  // the rubber joint
};
// scratch, so the frame drive allocates nothing
const vAx = new THREE.Vector3(), vCam = new THREE.Vector3(),
      mInv = new THREE.Matrix4();
const emMats = {};
function lensMat(key, level, colOver) {
  const L = LIGHTS[key];
  const col = colOver != null ? colOver : L.col;
  const id = key + '|' + level.toFixed(2) + '|' + col;
  if (emMats[id]) return emMats[id];
  const m = new THREE.MeshStandardMaterial({
    color: 0x14161a, emissive: new THREE.Color(col),
    emissiveIntensity: level * 2.4, roughness: 0.26, metalness: 0,
    side: THREE.DoubleSide });
  // the G38 understudy replaces every lit material with flat grey unless it is
  // told not to; a lamp that goes grey is a lamp nobody can see is on
  m.userData.aeroskin = 1;
  // the panel arc (session 4): WHICH LIGHT, so the join gives the lens its
  // own bucket and the flight can switch it
  m.userData.lampKey = key; m.userData.lampCol = col;
  return (emMats[id] = m);
}
// THE REFLECTOR IS LIT BY THE BULB IT SURROUNDS (user, 2026-08-31: "is it
// possible to set the inside reflector of the ceiling lamps use an emitting
// material when turned on? Now it feels strange to have this reflector full
// dark with a lit bulb in it").
//
// It is the lodge's own alloy, plus an emissive term driven by the SAME
// `level(P, key)` every lens already reads, so one dimmer moves both and they
// cannot disagree. Deliberately much weaker than the lens: a reflector is lit
// BY the lamp, it is not the lamp — at parity the cup reads as a second bulb
// and the fitting loses its shape.
//
// NOT an AERO_HARD change: `AERO_HARD.light` is `{lodge, seal}` and adding a
// third name there would make every layer that reads the table carry a
// finish for something that is a lighting state, not a material.
const cupMats = {};
function cupMat(level, colOver, on, key) {
  const lv = on ? level : 0;
  const col = colOver != null ? colOver : 0xfff0d8;
  const id = lv.toFixed(2) + '|' + col + '|' + (key || '');
  if (cupMats[id]) return cupMats[id];
  const row = MAT.lodge;
  const m = new THREE.MeshStandardMaterial({
    color: row.col, roughness: row.rough, metalness: row.metal,
    emissive: new THREE.Color(col), emissiveIntensity: lv * 0.55,
    side: THREE.DoubleSide });
  m.userData.aeroskin = 1;            // as for the lens: never the grey understudy
  if (key) { m.userData.lampCup = key; m.userData.lampCol = col; }   // the panel arc
  return (cupMats[id] = m);
}

const bodyMats = {};
function hwMat(kind) {
  if (bodyMats[kind]) return bodyMats[kind];
  const A = window.AEROSKIN, row = MAT[kind] || MAT.seal;
  let m = null;
  if (A && A.aeroHardMat)
    m = A.aeroHardMat(THREE, 'light', kind, row.col, { side: THREE.DoubleSide });
  if (!m) m = new THREE.MeshStandardMaterial({
    color: row.col, roughness: row.rough, metalness: row.metal,
    side: THREE.DoubleSide });
  return (bodyMats[kind] = m);
}

// ---- small builders (bag-based; one mesh per material) ---------------------
function Bag(mat) {
  const pos = [], idx = [];
  return {
    v: (x, y, z) => { pos.push(x, y, z); return pos.length / 3 - 1; },
    quad: (a, b, c, d) => { idx.push(a, b, c, a, c, d); },
    tri: (a, b, c) => { idx.push(a, b, c); },
    mesh: parent => {
      if (!idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(pos), 3));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      parent.add(m); return m;
    },
  };
}
// a dome on an axis: the shape of every lens and every lamp glass there is
// A DOME THAT IS CLOSED (G98, user: "I'm also not sure that your lamp and
// bulb are continuous ... They feel hollow"). They were: the rings ran from
// the rim to the pole and the rim was left open, so every lamp was a shell you
// could see the inside of. `cap` closes it with a fan to the rim's own centre,
// which makes each one a solid that reads from any angle.
function domeInto(bag, c, ax, r, h, seg, rows, cap) {
  const a = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = nrm(cross(ax, a)), e2 = cross(ax, e1);
  const ring = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows, rr = r * Math.cos(t * Math.PI / 2), hh = h * Math.sin(t * Math.PI / 2);
    const row = [];
    for (let i = 0; i < seg; i++) {
      const th = 2 * Math.PI * i / seg, cs = Math.cos(th), sn = Math.sin(th);
      row.push(bag.v(c[0] + e1[0] * cs * rr + e2[0] * sn * rr + ax[0] * hh,
                     c[1] + e1[1] * cs * rr + e2[1] * sn * rr + ax[1] * hh,
                     c[2] + e1[2] * cs * rr + e2[2] * sn * rr + ax[2] * hh));
    }
    ring.push(row);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) {
    const i2 = (i + 1) % seg;
    bag.quad(ring[j][i], ring[j][i2], ring[j + 1][i2], ring[j + 1][i]);
  }
  if (cap !== false) {
    const c0 = bag.v(c[0], c[1], c[2]);
    for (let i = 0; i < seg; i++)
      bag.tri(c0, ring[0][(i + 1) % seg], ring[0][i]);
  }
}
// A SOLID OF REVOLUTION FROM A PROFILE (G98, user: "I'm also not sure that
// your lamp and bulb are continuous, and form some clear geometry. They feel
// hollow atm"). They did, and a cap on a dome was not the answer: a reflector
// cup is not a dome, it is a WALL WITH TWO SIDES AND A THICKNESS, and a bulb
// is a body with a base on it. Both are one profile spun about the axis.
//
// `prof` is a list of [radius, axialOffset] in units of the lamp radius,
// walked in order. A profile that starts and ends on the axis (r === 0) comes
// out CLOSED with no cap needed, because the two poles are the same point on
// their ring — which is what makes the cup solid from the inside as well as
// the outside, and the bulb solid where it enters its collar.
function revolveInto(bag, c, ax, prof, seg, k) {
  const a = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = nrm(cross(ax, a)), e2 = cross(ax, e1);
  const at = (rr, tt, th) => {
    const cs = Math.cos(th), sn = Math.sin(th);
    return bag.v(c[0] + e1[0] * cs * rr + e2[0] * sn * rr + ax[0] * tt,
                 c[1] + e1[1] * cs * rr + e2[1] * sn * rr + ax[1] * tt,
                 c[2] + e1[2] * cs * rr + e2[2] * sn * rr + ax[2] * tt);
  };
  const rings = prof.map(([pr, pt]) => {
    const rr = pr * k, tt = pt * k;
    if (Math.abs(rr) < 1e-6) return { pole: at(0, tt, 0) };
    const row = [];
    for (let i = 0; i < seg; i++) row.push(at(rr, tt, 2 * Math.PI * i / seg));
    return { row };
  });
  for (let j = 0; j + 1 < rings.length; j++) {
    const A = rings[j], B = rings[j + 1];
    for (let i = 0; i < seg; i++) {
      const i2 = (i + 1) % seg;
      if (A.pole && B.row) bag.tri(A.pole, B.row[i2], B.row[i]);
      else if (B.pole && A.row) bag.tri(B.pole, A.row[i], A.row[i2]);
      else if (A.row && B.row) bag.quad(A.row[i], A.row[i2], B.row[i2], B.row[i]);
    }
  }
}
// THE PROFILES, once, so a lamp is the same object wherever it is fitted.
// t runs along the lamp axis and 0 is the lens plane, so everything with a
// negative t is BEHIND the glass — which is the whole reason the recessed
// installation stopped bulging through the underside of the wing.
const PROF = {
  // reflector: outside wall from the back pole out to the rim, then the
  // parabolic inside wall back to the back pole. One closed surface.
  cup: [[0.00, -1.18], [0.34, -1.14], [0.66, -0.80], [0.88, -0.26],
        [0.94, -0.04], [0.94, -0.02], [0.86, -0.05], [0.80, -0.26],
        [0.56, -0.76], [0.24, -1.05], [0.00, -1.02]],
  // bulb: base collar, shoulder, envelope, dome. Pole to pole.
  bulb: [[0.00, -0.86], [0.13, -0.84], [0.14, -0.66], [0.11, -0.60],
         [0.20, -0.50], [0.30, -0.36], [0.32, -0.22], [0.27, -0.10],
         [0.15, -0.02], [0.00, 0.01]],
  // proud housing: a barrel with a flange at the skin and a shoulder the
  // dome sits on — the reason a nav light reads as a fitting, not a blob.
  can: [[0.00, -0.62], [0.62, -0.62], [1.34, -0.58], [1.34, -0.48],
        [0.92, -0.44], [0.86, -0.06], [0.74, -0.02], [0.74, -0.10],
        [0.80, -0.46], [0.00, -0.50]],
  // the gasket under a flange: a flat ring, revolved about the lamp's axis so
  // it lies ON the skin whatever direction the lamp faces
  gasket: [[0.00, -0.10], [1.45, -0.10], [1.45, 0.00], [0.00, 0.00]],
};
// THE CUP'S OWN EXTENT, read off its profile rather than typed beside it —
// the recessed fit divides by these, and a profile edited without them is a
// lamp that pokes through the wing again.
PROF.cupRim = Math.max(...PROF.cup.map(q => q[0]));
PROF.cupBack = -Math.min(...PROF.cup.map(q => q[1]));
// A STREAMLINED FAIRING FOR A THIN SURFACE (G100, user: "you're also trying
// to fit discs to very slim surfaces ... do some teardrop design that fits
// better on thin surfaces").
//
// A fin is 40 mm thick and a wingtip is not much more; a 60 mm disc with an
// 87 mm gasket plate under it is wider than the thing it is bolted to, which
// is why every one of these read as a square stuck on a blade. What actually
// goes there is a TEARDROP: long along the chord, no wider than the surface
// it straddles, rounded at the nose and drawn out to a point aft.
//
// `along` is the chord, `up` is the direction the fitting stands off in, and
// the body is lofted as ellipses on the (side, up) plane — so its width is set
// by the SURFACE'S OWN THICKNESS and it can never overhang. The origin `c` is
// the widest station, which is where the lamp goes: a beacon over the fin's
// tip chord, a nav light at the tip's leading edge.
const POD_NOSE = 0.34;         // where the widest station sits, along the pod
// `u0`/`u1` cut the body at fractions of its length, so the SAME shape can be
// drawn in two materials: a wingtip light's lens is not a dome stuck on the
// side of the fairing, it IS the fairing's nose, and building it any other way
// gives you a green ball glued to a pod.
function podInto(bag, c, along, up, len, wide, high, seg, rows, u0, u1) {
  const A = nrm(along), U = nrm(up), Sd = nrm(cross(A, U));
  const S2 = seg || 14, R2 = rows || 16;
  const lo = u0 == null ? 0 : u0, hi2 = u1 == null ? 1 : u1;
  // the teardrop: a quarter ellipse to the shoulder, then a fine tail
  const f = u => u <= POD_NOSE
    ? Math.sqrt(Math.max(0, 1 - Math.pow((POD_NOSE - u) / POD_NOSE, 2)))
    : Math.pow(Math.max(0, (1 - u) / (1 - POD_NOSE)), 0.72);
  const ring = [];
  for (let j = 0; j <= R2; j++) {
    // COSINE-SPACED along the pod, not uniform. Both ends come to a point, so
    // uniform rows put the first ring at 58% of full width one step off the
    // nose and the fairing reads as a cut-off cylinder.
    const uu = 0.5 * (1 - Math.cos(Math.PI * j / R2));
    const u = lo + (hi2 - lo) * uu, k = f(u);
    const t = (u - POD_NOSE) * len;
    if (k < 1e-4) { ring.push({ pole: bag.v(c[0] + A[0] * t, c[1] + A[1] * t,
                                            c[2] + A[2] * t) }); continue; }
    const row = [];
    for (let i = 0; i < S2; i++) {
      const th = 2 * Math.PI * i / S2;
      const a2 = Math.cos(th) * wide / 2 * k, b2 = Math.sin(th) * high / 2 * k;
      row.push(bag.v(c[0] + A[0] * t + Sd[0] * a2 + U[0] * b2,
                     c[1] + A[1] * t + Sd[1] * a2 + U[1] * b2,
                     c[2] + A[2] * t + Sd[2] * a2 + U[2] * b2));
    }
    ring.push({ row });
  }
  for (let j = 0; j + 1 < ring.length; j++) {
    const P0 = ring[j], P1 = ring[j + 1];
    for (let i = 0; i < S2; i++) {
      const i2 = (i + 1) % S2;
      if (P0.pole && P1.row) bag.tri(P0.pole, P1.row[i2], P1.row[i]);
      else if (P1.pole && P0.row) bag.tri(P1.pole, P0.row[i], P0.row[i2]);
      else if (P0.row && P1.row)
        bag.quad(P0.row[i], P0.row[i2], P1.row[i2], P1.row[i]);
    }
  }
}
function boxInto(bag, c, s) {
  const [x, y, z] = c, [a, b, d] = s;
  const v = [];
  for (const sz of [-1, 1]) for (const sy of [-1, 1]) for (const sx of [-1, 1])
    v.push(bag.v(x + sx * a / 2, y + sy * b / 2, z + sz * d / 2));
  const q = (p, r, t, u) => bag.quad(v[p], v[r], v[t], v[u]);
  q(0, 1, 3, 2); q(4, 6, 7, 5); q(0, 2, 6, 4); q(1, 5, 7, 3);
  q(0, 4, 5, 1); q(2, 3, 7, 6);
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1;
                   return [a[0]/l, a[1]/l, a[2]/l]; };

// A LAMP IS FITTED TO THE SECTION IT SITS IN, not to the bay's box.
// (G98, user: "your lamp sticks out a tad. Have this not happen by
// default.") The box is wrong twice over for this job: its HEIGHT is the
// aerofoil at the aft cut, where the section is thickest, and its MIDDLE
// is the middle of that box — while the lamp sits well forward in the
// D-nose, where there is both less room and, on a cambered section, a
// different centreline. Sizing off the box put the reflector's rim 17 mm
// through the top skin. So the bay publishes its two branches per station
// (`profR`/`profL`) and everything below is read off them:
//
//   Z  — the setback the user dials, back from the leading edge
//   Y  — the MIDDLE OF THE SECTION at that chord, interpolated
//        across the bay's stations
//   R  — the smaller of two clearances, both 8 mm:
//          radial, against the section's half-thickness (the reflector's
//            rim is its widest ring and sits at the front of the cup,
//            which is the thinnest place it reaches)
//          axial, against the aft wall, 1.18 radii behind the lens
//
// `li_lampSize` scales the result, so 1 fits by construction on any
// aerofoil, any taper, and any bay the user dials in.
const CLR = 0.008;
const on = (poly, z) => {
  if (z <= poly[0][0]) return poly[0][1];
  const n = poly.length;
  if (z >= poly[n - 1][0]) return poly[n - 1][1];
  for (let i = 0; i + 1 < n; i++) {
    const a2 = poly[i], b2 = poly[i + 1];
    if (z >= a2[0] && z <= b2[0]) {
      const t = b2[0] - a2[0] < 1e-9 ? 0 : (z - a2[0]) / (b2[0] - a2[0]);
      return a2[1] + (b2[1] - a2[1]) * t;
    }
  }
  return poly[n - 1][1];
};
// the wing's upper and lower surface at THIS station and this chord.
// Interpolated across the bay's stations, never intersected: dihedral
// puts them at different heights, and the overlap of two offset sections
// is a shape the wing does not have anywhere.
const skin = (pf, x, z) => {
  if (!pf || !pf.length) return null;
  const st = pf.slice().sort((a2, b2) => a2.x - b2.x);
  let a2 = st[0], b2 = st[st.length - 1];
  for (let i = 0; i + 1 < st.length; i++)
    if (x >= st[i].x && x <= st[i + 1].x) { a2 = st[i]; b2 = st[i + 1]; break; }
  const t = Math.abs(b2.x - a2.x) < 1e-9 ? 0
          : Math.max(0, Math.min(1, (x - a2.x) / (b2.x - a2.x)));
  const u = on(a2.up, z) * (1 - t) + on(b2.up, z) * t;
  const d = on(a2.dn, z) * (1 - t) + on(b2.dn, z) * t;
  return u > d ? { u, d } : null;
};
// ---------------------------------------------------------------------------
// THE BEACON'S FLASH — the sweep, not a sine wave
// ---------------------------------------------------------------------------
// A rotating beacon has ONE bright direction at a time. What an observer sees
// is that beam crossing their line of sight, so the law is a lobe on the angle
// between the beam and the viewer, and the flash rate falls out of the
// rotation rate for free: turn the mirror faster and it flashes faster,
// without a second number anywhere that could disagree with the first.
//
// Both vectors are flattened onto the plane the mirror turns in, because the
// mirror sweeps in azimuth only — a beacon on a fin is just as bright to
// someone above it as to someone level with it, which is the whole point of an
// anti-collision light.
//
// `BEACON_LOBE` is the exponent. 26 gives a beam about 20 degrees wide at half
// brightness — a real one is narrower, but a narrower one flickers between
// frames at 60 Hz and reads as a fault rather than as a beacon.
const BEACON_LOBE = 26;      // the beam's sharpness
const BEACON_FLOOR = 0.12;   // the dome's own scatter, never black
function beaconPhase(tSec, rpm) { return tSec * (rpm / 60) * Math.PI * 2; }
// ax: the beacon's own axis. beam and view are 3-vectors in the same frame.
function beaconGain(phase, ax, e1, e2, view) {
  const d = view[0] * ax[0] + view[1] * ax[1] + view[2] * ax[2];
  const fx = view[0] - ax[0] * d, fy = view[1] - ax[1] * d,
        fz = view[2] - ax[2] * d;
  const fl = Math.hypot(fx, fy, fz);
  // straight up the axis there is no azimuth to compare against; the observer
  // sees the dome's own scatter and nothing sweeps
  if (fl < 1e-6) return BEACON_FLOOR;
  const c = Math.cos(phase), sn = Math.sin(phase);
  const bx = e1[0] * c + e2[0] * sn, by = e1[1] * c + e2[1] * sn,
        bz = e1[2] * c + e2[2] * sn;
  const dot = (bx * fx + by * fy + bz * fz) / fl;
  const lobe = dot > 0 ? Math.pow(dot, BEACON_LOBE) : 0;
  return BEACON_FLOOR + (1 - BEACON_FLOOR) * lobe;
}

// WHAT DRIVES IT, and why it is not a `requestAnimationFrame` loop in the
// game. `Object3D.onBeforeRender` is handed the CAMERA THAT IS ABOUT TO DRAW —
// which is the one thing the law needs and the one thing this layer has no
// other way to get. It also fires exactly when a frame is being produced, so a
// paused tab, a hidden pane and a headless run all cost nothing, and the phase
// comes from the wall clock rather than from a frame count, so the beacon
// turns at 45 rpm whatever the frame rate is doing.
//
// The BENCH still needs waking: its `draw()` is on demand, so nothing would
// ever ask for a second frame. A rAF ticker calls it — and ONLY on the bench.
// `window.CAGE_UI_SCENE` is set by the game and by nothing else, which is the
// same test the beacon's own placement uses.
const rotors = [];
let tickRAF = 0;
const nowSec = () => (typeof performance !== 'undefined' && performance.now
  ? performance.now() : 0) / 1000;
function driveRotor(R, camera) {
  const rpm = +R.rpm || 0;
  if (rpm <= 0) {                       // parked: steady, mirror stopped
    R.rot.rotation.set(0, 0, 0);
    R.mat.emissiveIntensity = R.base;
    return;
  }
  const ph = beaconPhase(nowSec(), rpm);
  R.rot.quaternion.setFromAxisAngle(vAx.set(R.ax[0], R.ax[1], R.ax[2]).normalize(), ph);
  if (!camera) return;
  // THE VIEWER, IN THE HOUSING'S FRAME — measured against the group the lamp
  // hangs in, NOT against the rotor. Two reasons, and the first cost an hour.
  // The rotor is turning, so its local frame turns with it and the camera
  // appears to circle in it; un-spinning that afterwards means committing to a
  // sign, and the sign that reads correctly is not the one the transform
  // algebra says it should be. The housing does not move, so measure there and
  // the question never arises. The second reason is the `edSit` trap of G98:
  // in the GAME this group is rotated and offset, so a camera compared in
  // world coordinates would give a beacon that flashes at the hangar.
  R.host.updateMatrixWorld(true);
  mInv.copy(R.host.matrixWorld).invert();
  vCam.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(mInv);
  const g = beaconGain(ph, R.ax, R.e1, R.e2,
                       [vCam.x - R.p[0], vCam.y - R.p[1], vCam.z - R.p[2]]);
  R.mat.emissiveIntensity = R.base * g;
}
function tick() {
  tickRAF = 0;
  if (!rotors.length) return;
  let live = false;
  for (const R of rotors) if (+R.rpm > 0) live = true;
  if (!live) return;
  if (!window.CAGE_UI_SCENE && window.CAGE_UI && window.CAGE_UI.draw)
    window.CAGE_UI.draw();                       // the bench, on demand
  tickRAF = requestAnimationFrame(tick);
}
function armRotors() {
  for (const R of rotors) {
    R.dome.onBeforeRender = (rn, sc, cam) => driveRotor(R, cam);
    driveRotor(R, null);
  }
  if (tickRAF) cancelAnimationFrame(tickRAF);
  tickRAF = 0;
  if (rotors.length && typeof requestAnimationFrame === 'function')
    tickRAF = requestAnimationFrame(tick);
}

// the catalogue tip light: a 14 cm teardrop, 55 mm wide, 48 mm high, a
// 20 mm lens — the same fitting on a Cub's wingtip and a glider's fin (G179.5)
const TIP_POD = { len: 0.14, wide: 0.055, high: 0.048, r: 0.020 };

function lampFit(q, pf, setback) {
  if (!q) return null;
  const x = (q.min[0] + q.max[0]) / 2;
  // THE SETBACK IS CLAMPED INTO THE BAY, and the radius is NOT floored.
  // The slider goes to 280 mm and a bay is about 200 mm deep, so a request
  // can land behind the aft wall — where the axial clearance is negative and
  // a floor on the radius quietly overrides it, which is how a lamp gets to
  // stick out with every constraint in the code satisfied. A floor on a
  // derived quantity is not a safety net; it is a way of ignoring the
  // measurement that was taken. Clamp the REQUEST instead, and let the lamp
  // be as small as the bay says it has to be.
  const d = q.max[2] - q.min[2];
  const z = Math.min(q.max[2] - d * 0.08,
            Math.max(q.min[2] + d * 0.22,
                     q.max[2] - Math.max(0.05, (setback || 0.10) * 1.35)));
  const sk = skin(pf, x, z);
  const y = sk ? (sk.u + sk.d) / 2 : (q.min[1] + q.max[1]) / 2;
  const half = sk ? (sk.u - sk.d) / 2 : (q.max[1] - q.min[1]) / 2;
  const r = Math.min((half - CLR) / PROF.cupRim,
                     (z - q.min[2] - CLR) / PROF.cupBack);
  if (!(r > 0)) return null;
  return { p: [x, y, z], ax: [0, -0.10, 1], recess: true, r };
}

// ---------------------------------------------------------------------------
// WHERE EACH LIGHT GOES — measured, never typed
// ---------------------------------------------------------------------------
// Every site below is read from a published bound of the thing the light is
// mounted ON. A wingtip is the extreme of the wing group; the fin top is the
// top of the fin mesh; the cabin roof, the coaming lip and the footwell are
// the crew layer's own anchors. If the aeroplane changes shape the lights move
// with it, which is the only way a light stays on the aeroplane.
// EVERY MEASUREMENT IS TAKEN IN THE LAMP GROUP'S OWN FRAME, and that is not
// a nicety. `Box3.setFromObject` reports WORLD coordinates; the lamps are
// children of a group that, IN THE GAME, hangs under a mount rotated -90
// degrees about y and lifted to the hangar floor (app.js `edSit`). On the
// BENCH that mount does not exist, so world and local are the same thing and
// everything measured in world landed correctly — the frame error was
// invisible in the one place the work was being checked, and showed up as
// lamps flying in mid-air above the aeroplane the first time it was looked at
// in the room.
//
// So the inverse of the group's own world matrix is taken once, and every
// point that comes out of a bound or a vertex goes through it.
function sites(scene, group, P) {
  const out = {};
  P = P || {};
  // the placement rows this function reads, clamped once at the top so a
  // stale save cannot reach the geometry below as a NaN
  const num = (k, d, lo, hi) => {
    const v = +P[k];
    return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
  };
  const beaconSink = num('li_beaconSink', 0.04, 0, 0.5);
  const navSpan = num('li_navSpan', 0.02, 0, 0.30);
  const navChord = num('li_navChord', 0.10, 0, 0.40);
  const navRise = num('li_navRise', 0, -1, 1);
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const V = new THREE.Vector3();
  const local = (x, y, z) => V.set(x, y, z).applyMatrix4(inv).toArray();
  // a bound taken in the group's frame rather than in the world's: the box of
  // an object's vertices AFTER they are brought home
  const box = o => {
    if (!o) return null;
    o.updateMatrixWorld(true);
    const b = new THREE.Box3();
    let any = false;
    o.traverse(m => {
      if (!m.isMesh || !m.geometry) return;
      const pos = m.geometry.getAttribute('position');
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        V.set(pos.getX(i), pos.getY(i), pos.getZ(i))
          .applyMatrix4(m.matrixWorld).applyMatrix4(inv);
        b.expandByPoint(V); any = true;
      }
    });
    return any ? b : null;
  };
  // THE TOP OF A SURFACE, AND THE LINE IT RUNS ALONG. Not just the apex: a
  // fin tip is SWEPT, so over the top 4% of its height the edge climbs 65 mm
  // across 200 mm of chord. A fairing laid flat at the apex floats clear of
  // the forward half of the very edge it is supposed to straddle, which is
  // exactly what the user saw. So the band's own top line is fitted and the
  // fitting is laid ALONG it.
  const topSlice = (obj, invM, frac) => {
    const v = new THREE.Vector3();
    let yTop = -1e9, yLo = 1e9;
    const P = [];
    obj.updateMatrixWorld(true);
    obj.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      const pos = o.geometry.getAttribute('position');
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i))
          .applyMatrix4(o.matrixWorld).applyMatrix4(invM);
        P.push(v.x, v.y, v.z);
        if (v.y > yTop) yTop = v.y;
        if (v.y < yLo) yLo = v.y;
      }
    });
    if (!P.length || !(yTop > yLo)) return null;
    const cut = yTop - (yTop - yLo) * (frac || 0.04);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, n = 0;
    for (let i = 0; i < P.length; i += 3) {
      if (P[i + 1] < cut) continue;
      n++;
      if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i];
      if (P[i + 2] < z0) z0 = P[i + 2]; if (P[i + 2] > z1) z1 = P[i + 2];
    }
    if (!n || !(z1 > z0)) return null;
    // the top line: the highest vertex in each of a few chord bins, then a
    // least-squares fit through them. Binning first stops the fit being
    // dragged by the crowd of vertices on the surfaces BELOW the edge.
    const NB = 8, hi = new Array(NB).fill(-1e9), zc = new Array(NB).fill(0);
    for (let i = 0; i < P.length; i += 3) {
      if (P[i + 1] < cut) continue;
      let k = Math.floor((P[i + 2] - z0) / (z1 - z0) * NB);
      if (k < 0) k = 0; if (k >= NB) k = NB - 1;
      if (P[i + 1] > hi[k]) { hi[k] = P[i + 1]; zc[k] = P[i + 2]; }
    }
    let sz = 0, sy = 0, szz = 0, szy = 0, m2 = 0;
    for (let k = 0; k < NB; k++) {
      if (hi[k] < -1e8) continue;
      m2++; sz += zc[k]; sy += hi[k]; szz += zc[k] * zc[k]; szy += zc[k] * hi[k];
    }
    const den = m2 * szz - sz * sz;
    const slope = m2 >= 2 && Math.abs(den) > 1e-9 ? (m2 * szy - sz * sy) / den : 0;
    const zMid = (z0 + z1) / 2;
    const yMid = m2 ? (sy - slope * sz) / m2 + slope * zMid : yTop;
    // ...and how far the edge RISES above the fitted line (G304): a swept
    // tip's top is a curve, and a pod seated on the line's midpoint sat
    // 1-3 mm deeper into the crown than its declared sink (GATE CLIP)
    let rise = 0;
    for (let k = 0; k < NB; k++) {
      if (hi[k] < -1e8) continue;
      const d = hi[k] - (yMid + slope * (zc[k] - zMid));
      if (d > rise) rise = d;
    }
    return { y: yTop, yMid, slope, zMid, x0, x1, z0, z1, n, rise };
  };
  // G185: on a biplane the tip lights sit on the plane the row chose (the
  // landing-light bay stays the first plane's — it is cut there)
  const W0 = window.CAGE_WING, C = window.CAGE_CREW;
  const liPl = +((window.CAGE_UI && window.CAGE_UI.P || {}).li_plane || 0);
  const W = (W0 && W0.planes && liPl && W0.planes[liPl]) ? W0.planes[liPl] : W0;
  const wb = W && box(W.group);
  if (wb) {
    // A WING IS NOT A BOX, AND THIS IS WHERE THAT BITES. The first cut took
    // the mounting height from the whole wing's bounding box — and a wing has
    // DIHEDRAL, so the box's mid-height is most of half a metre BELOW the tip.
    // Every lamp hung in clear air under the wing it was supposed to be in.
    //
    // The wing is asked about ITSELF instead: sample its own vertices in a
    // slice about the target station and take the local surface there. Same
    // instrument as the gear's `fitPad` and the pitot's root — put the part ON
    // the emitted surface rather than near it.
    const slice = (xAt, tol) => {
      let y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9, n = 0;
      const v = new THREE.Vector3();
      W.group.updateMatrixWorld(true);
      W.group.traverse(o => {
        if (!o.isMesh || !o.geometry) return;
        // THE WING GROUP IS NOT ONLY THE WING. It carries the LIFT STRUTS and
        // the PITOT MAST, both of which hang well below the aerofoil — and a
        // slice that includes them puts the local mid-thickness half a metre
        // low, which is a lamp in clear air under the wing it is supposed to
        // be in. The layer names its fittings `edFit_*` precisely so they can
        // be told apart; this is that name being used.
        if ((o.name || '').lastIndexOf('edFit_', 0) === 0) return;
        const pos = o.geometry.getAttribute('position');
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          v.set(pos.getX(i), pos.getY(i), pos.getZ(i))
            .applyMatrix4(o.matrixWorld).applyMatrix4(inv);
          if (Math.abs(v.x - xAt) > tol) continue;
          n++;
          if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y;
          if (v.z < z0) z0 = v.z; if (v.z > z1) z1 = v.z;
        }
      });
      return n ? { y: (y0 + y1) / 2, y0, y1, zLE: z1, zTE: z0, n } : null;
    };
    const span = wb.max.x - wb.min.x;
    // AT THE TIP, AND ONLY AT THE TIP. A 0.24 m band of span is not a tip: on
    // this wing it reports the section 120 mm inboard, which is 126 mm thick
    // against the tip's own 52 mm and a chord of 1.04 m against 0.43. A
    // fairing sized from it is more than twice the fitting the tip can carry,
    // and it hangs below the wing (G100).
    // `li_navSpan` replaces the 0.03 literal: how far INBOARD of the tip the
    // section is sampled. The 0.04 tolerance stays a tolerance — it is the
    // width of the sampling band, not a placement.
    const tipR = slice(wb.max.x - navSpan - 0.01, 0.04),
          tipL = slice(wb.min.x + navSpan + 0.01, 0.04);
    // THE LIGHT SITS AT THE TIP'S LEADING EDGE — forward, because being seen
    // from ahead is the entire purpose of a navigation light.
    // and each one carries the SIZE OF THE SURFACE IT SITS ON, so the fitting
    // can be shaped to a tip rather than stuck on it as a disc (G100)
    const tipLen = t => t ? Math.max(0.12, (t.zLE - t.zTE) * 0.45) : 0.20;
    // `li_navRise` moves the lamp within the section's OWN thickness rather
    // than by an absolute distance, so it means the same thing on a 52 mm tip
    // and a 126 mm one: -1 the lower surface, 0 the mid-thickness, +1 the upper.
    const tipY = t => t ? (t.y0 + t.y1) / 2 + navRise * (t.y1 - t.y0) * 0.5 : 0;
    // G209: cage +x is the PORT wing (model +z; the crew layer's "pilot's
    // right = -x"), so the lamp at max.x wears the port RED and the one at
    // min.x the starboard GREEN. They were the other way round: a green
    // lens on the left wing of every build since G96.
    if (tipR) out.navR = { p: [wb.max.x - navSpan, tipY(tipR),
                               tipR.zLE - navChord],
                           ax: [1, 0, 0], col: 0xff2a1e, chord: [0, 0, -1],
                           len: tipLen(tipR), thick: tipR.y1 - tipR.y0,
                           pod: true, noseLens: true };
    if (tipL) out.navL = { p: [wb.min.x + navSpan, tipY(tipL),
                               tipL.zLE - navChord],
                           ax: [-1, 0, 0], col: 0x18e04a, chord: [0, 0, -1],
                           len: tipLen(tipL), thick: tipL.y1 - tipL.y0,
                           pod: true, noseLens: true };
    // THE LANDING AND TAXI LAMPS LIVE IN THE LEADING EDGE, inboard, where the
    // spar is deep enough to carry them and the prop wash is not.
    //
    // A FRACTION OF THE SEMISPAN, which is what the wing's own classifier
    // measures against. The first cut took the same 0.24 against the FULL
    // span here and the semispan there, so the cut and the lamp landed a
    // metre apart — the bay was declared in one place precisely so this could
    // not happen, and it happened anyway because the two sides read the
    // fraction against different bases. The base is part of the declaration.
    // THE LAMP GOES BEHIND THE LENS, and it is placed from the LENS ITSELF.
    // Slicing the wing for a height was the first answer and it put the lamp
    // in clear air below the wing: at this station the LIFT STRUT crosses the
    // slice, and a strut hangs half a metre down. Excluding fittings by name
    // fixed one station and not this one.
    //
    // The wing layer already CUT the bay and named the glass `edLens_wing`.
    // That object is the hole, so it is also the answer: the lamp sits at the
    // lens's own centre, pushed aft into the D-nose behind it. Two layers, one
    // measurement, and it is the measurement one of them actually made.
    // ONE LENS SPANS BOTH WINGS — the bay class collects the faces from both
    // sides into one part, so its bounding box is centred on the aeroplane and
    // its middle is the fuselage. The STATION comes from what the wing says it
    // cut, and the height and the leading edge come from the lens itself.
    // EACH SIDE HAS ITS OWN BAY NOW (G98), published as a real box in this
    // same frame — so the lamp is placed from the hole it sits in rather than
    // from a station reconstructed out of the request that made it. It also
    // goes FAR ENOUGH AFT that the housing is inside the aerofoil: the wing is
    // thin near the leading edge and a cup at the lens bulges through both
    // surfaces.
    const B = window.CAGE_WING_BAY;
    const pR = B && lampFit(B.R, B.profR, B.depth),
          pL = B && lampFit(B.L, B.profL, B.depth);
    if (pR || pL) {
      if (pR) out.wingLampR = pR;
      if (pL) out.wingLampL = pL;
    } else {
      // NO BAY, NO LAMP (G304, the fitment study P2). The fallback put a
      // proud housing 10 mm BEHIND the leading edge, inside the D-nose —
      // 42 mm into the wing on the twin-boom build (GATE CLIP), a lamp
      // nobody could see and a skin nothing could pass through. The G296
      // rule for the cabin holds here too: a lamp goes on something the
      // wing offers, and a wing that cut no bay offers nothing.
      out.wingLampNone = 'no bay cut';
    }
  }
  // THE BEACON IS ON TOP OF THE FIN, so it is placed at the top of the fin's
  // own geometry. The layer publishes a mesh in cage units and no group, so
  // the bound is taken from the SCENE OBJECT that carries it — and from the
  // scene the post hook was handed, not from `window.CAGE_UI_SCENE`, which
  // only the GAME sets. Reading that global put the beacon on every aeroplane
  // in the game and none on the bench, which is a light that exists in one of
  // the two places it is supposed to.
  //
  // AND THE FIN GROUP IS NOT ONLY THE FIN (G100, user: "the beacon is wrongly
  // positioned ... really off, fore by 0.8 meter or so, and too much up by
  // 10-20 cm"). They were right to the decimetre, and the cause is the G96
  // wing lesson arriving on the tail. `cageLayer:fin` carries the STABILISER
  // as well, which reaches forward to the fuselage — so the group's box runs
  // z -2.62 to +0.41 and its midpoint is z -1.10, while the fin's own tip
  // chord is centred on z -2.05. Nearly a metre of tailplane, straight into
  // the beacon's station.
  //
  // The fin is asked about ITSELF, the same way the wing is above: take the
  // group's own vertices, keep the TOP SLICE, and read the chord centre and
  // the apex off that. The top of a fin is fin and nothing else, whatever the
  // group is called and whatever else is in it.
  if (scene && scene.children) {
    for (const ch of scene.children) {
      if ((ch.name || '').indexOf('cageLayer:fin') !== 0) continue;
      // THE CROWN'S OWNER (G300, the fitment study P1): with finCut 2 the
      // fin's crown IS the rudder (the horn keeps it, _fin_gen finCutMesh),
      // so a beacon sliced off the whole group sat on rudder geometry and
      // stayed still while the rudder turned; with finCut 1 the slice spanned
      // fin and rudder and its z-midpoint could land on the hinge line. The
      // slice is taken off the ONE object that owns the crown, and the lamp
      // names it (`partOf`) so the join bakes the beacon into that part.
      const wantRud = Math.round(+P.finCut || 0) === 2;
      const host = ch.children.find(o => (o.name || '').lastIndexOf(wantRud ? 'edSurf_rud' : 'edFinSkin', 0) === 0) || ch;
      const t = topSlice(host, inv);
      if (!t) continue;
      // laid along the fitted edge, and SEATED on it: `sink` says how much of
      // the fairing stays inside the fin. It used to straddle unconditionally
      // — centre ON the line, half the pod inside — and with DoubleSide on
      // both the lodge and the lens that reads as the red light showing
      // through the fin, which is what the user reported.
      const m = t.slope, k = Math.hypot(1, m);
      // `sink` replaces the straddle. The comment above described the old
      // behaviour and its reason ("which is where the bracketry of a real one
      // goes") — true of the BRACKETRY, and the fairing is not bracketry.
      // ONE BEACON PER FIN, ON THAT FIN (G267, the user: "a lamp that
      // expects a single boom/fin and that needs to be duplicated and
      // repositioned"). The station was x 0 whatever the fin's own x, and
      // the loop overwrote one record per fin group: on twin booms the one
      // beacon hung in mid-air on the centreline. The top slice knows the
      // fin's x; the second fin is `beacon2`.
      const site = { p: [0.5 * (t.x0 + t.x1), t.yMid + (t.rise || 0), t.zMid], ax: [0, 1 / k, -m / k],
                     chord: [0, -m / k, -1 / k], sink: beaconSink,
                     len: (t.z1 - t.z0) * k, thick: t.x1 - t.x0, pod: true,
                     partOf: host !== ch ? host.name : null };
      if (!out.beacon) out.beacon = site; else if (!out.beacon2) out.beacon2 = site;
    }
    // THE TAIL LIGHT IS WHITE AND FACES AFT (G295; the table's own note said
    // "tail white" and no lamp was ever drawn for it). On a fin it sits at
    // the rudder's trailing edge high up — the aft-most vertex of the fin
    // group's upper half; between twin booms at the stabiliser's centre
    // trailing edge — the aft-most vertex of the stab group near x 0. A
    // recessed lens on a lodge, its axis aft.
    // ...and the vertex's OWNER rides along (G300): the aft-most vertex of a
    // fin group is the RUDDER's trailing edge, and a lamp drawn there must
    // turn with the rudder — it names the `edSurf_*` / `ed*Skin*` object
    // the vertex belongs to, and the join bakes the lamp into that part
    const aftMost = (obj, pick) => {
      const v = new THREE.Vector3();
      let best = null, yTop = -1e9, yLo = 1e9;
      const pts = [];
      obj.updateMatrixWorld(true);
      obj.traverse(o => {
        if (!o.isMesh || !o.geometry) return;
        const pos = o.geometry.getAttribute('position');
        if (!pos) return;
        let owner = null;
        for (let a = o; a && a !== obj; a = a.parent)
          if (a.name && /^(edSurf_|edFinSkin|edStabSkin|edFinVentral)/.test(a.name)) { owner = a.name; break; }
        for (let i = 0; i < pos.count; i++) {
          v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
          pts.push([v.x, v.y, v.z, owner]);
          if (v.y > yTop) yTop = v.y;
          if (v.y < yLo) yLo = v.y;
        }
      });
      for (const q of pts) if (pick(q, yTop, yLo) && (!best || q[2] < best[2])) best = q;
      return best;
    };
    let tailPt = null;
    const booms = (typeof window !== 'undefined') && window.CAGE_BOOMS;
    for (const ch of scene.children) {
      const nm = ch.name || '';
      if (booms && nm === 'cageLayer:stab')
        tailPt = aftMost(ch, q => Math.abs(q[0]) < 0.06);
      else if (!booms && nm === 'cageLayer:fin' && !tailPt)
        tailPt = aftMost(ch, (q, yT, yL) => q[1] > yL + 0.55 * (yT - yL) && q[1] < yT - 0.08 * (yT - yL));
    }
    if (tailPt) out.navT = { p: [tailPt[0], tailPt[1], tailPt[2] + 0.012], ax: [0, 0, -1],
                             col: 0xfff6e8, recess: true, r: 0.018, partOf: tailPt[3] || null };
  }
  if (C && C.A) {
    const A = C.A;
    const seats = C.seatsAt || [];
    const pilot = seats.find(s => s.pilot) || seats[0];
    // THE CEILING IS MEASURED, NOT ASSUMED (user, 2026-08-31: "The interior
    // lights should indeed be on the ceiling, but right now they stick to the
    // wing... it should stick to the top of the fuselage, preferably on a
    // structural element, oriented correctly").
    //
    // WHAT THE REPORT IS, exactly: `A.roofY` is `spec.cabin.roofY`, a pure
    // fuselage number, and there is no wing-relative cabin-lamp anchor
    // anywhere in this file. But on a HIGH wing `yAnchor = deckY + 0.01`
    // (_cage_wing.js) puts the wing AT the deck — measured on the stock build,
    // roofY 0.607 against yAnchor 0.632, twenty-five millimetres apart — so a
    // roof lamp and the wing are in the same place and the lamp reads as hung
    // off the wing. It is not attached to it and never was.
    //
    // The fix is not a different number, it is a MEASUREMENT: ask the cage for
    // the ceiling it actually built over this seat, the way the wing lamps ask
    // the wing about itself, and hang the lamp from that with its axis along
    // the surface's own inward normal. Then it is right for a high wing, a low
    // wing and a parasol without knowing which it is on.
    const ceilAt = (x, z, rad) => {
      const M = window.CAGE_UI && window.CAGE_UI.MS;
      if (!M || !M.V || !M.F) return null;
      const k = (window.CAGE2 ? window.CAGE2.CAGE_UNIT : 1) *
                ((window.CAGE_UI.P && window.CAGE_UI.P.planeScale) || 1);
      // the CEILING is the interior's own liner where there is one and the
      // skin's roof band otherwise — both are named, so neither is guessed
      const ROOF = { ceilingLoop: 1, body: 1, plywood: 1, cloth: 1,
                     composite: 1, toele: 1, waistband: 1 };
      // A CEILING FACES DOWN AND IS IN THE UPPER HALF OF THE CABIN. Both
      // halves are needed and the first cut had neither: filtering only on
      // "above the waist" and taking the LOWEST match returned a face 34 mm
      // over the waist rail — a cabin SIDE, 573 mm below the roof line — and
      // the lamp would have been mounted on the wall.
      const hi = (A.waistY + A.roofY) / 2;
      const near = [];
      for (const f of M.F) {
        if (!ROOF[f.m] || f.v.length < 3) continue;
        let cx = 0, cy = 0, cz = 0;
        for (const vi of f.v) {
          cx += M.V[vi][0]; cy += M.V[vi][1]; cz += M.V[vi][2];
        }
        cx = cx / f.v.length * k; cy = cy / f.v.length * k;
        cz = cz / f.v.length * k;
        if (cy < hi) continue;                       // not in the roof half
        const d = Math.hypot(cx - x, cz - z);
        if (d > (rad || 0.45)) continue;             // near this seat, not the whole tube
        // the face's own normal, so a high SIDE panel cannot pass for a roof
        const a = M.V[f.v[0]], b = M.V[f.v[1]], c = M.V[f.v[2]];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const ny = uz * vx - ux * vz;
        const nl = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx);
        if (!(nl > 1e-12) || Math.abs(ny / nl) < 0.55) continue;
        // the face's INWARD normal (down into the cabin), for the lamp's axis
        const sg = ny > 0 ? -1 : 1;
        near.push({ y: cy, x: cx, z: cz,
                    n: [sg * (uy * vz - uz * vy) / nl, sg * ny / nl, sg * (ux * vy - uy * vx) / nl] });
      }
      if (!near.length) return null;
      // THE CROWN FIRST, THEN THE LINER UNDER IT. Taking the LOWEST qualifying
      // face was the first cut and it was wrong twice over: `body` is the whole
      // fuselage skin, not just its roof, so a high SIDE panel qualifies, and
      // the lowest of those sat 269 mm under the roof line — the lamp would
      // have been screwed to the cabin wall. The crown is unambiguous; the
      // liner, when the interior built one, is the first surface under it.
      let crown = -1e9;
      for (const q of near) if (q.y > crown) crown = q.y;
      let best = null;
      for (const q of near)
        if (q.y > crown - 0.06 && (!best || q.y < best.y)) best = q;
      return best;
    };
    // WHERE A CABIN LAMP MOUNTS IS WHAT THE CABIN'S TOP IS (G296, the user:
    // "a skylight, a closed canopy or a bubble will have the ceiling lamps
    // behave real differently. We need to be clever about this and stick
    // them where they should"; the audit: futureDesigns/INTERIOR-LIGHTING-
    // 2026-09-12.md). One rule and one exception (G267's bubble) served four
    // kinds of top: over a SKYLIGHT `ceilAt` refuses the glass, finds nothing
    // and the G94 fallback hung the dome in the middle of the pane; an open
    // cockpit got a lamp in the air; a convertible got one on its removable
    // top. Now each seat tries a LADDER of real structures, in order, and
    // the first that exists wins — every rung a measured face or ring of
    // the cage, never a spec number, each with its own aim:
    //   roof     a downward face of the liner / roof skin over the seat
    //   frame    the ceiling-loop rail beside the glass (a skylight bay)
    //   header   the windscreen's top bow (a convertible: fixed structure)
    //   arch     the canopy's rear bow (a bubble), aimed forward-down
    //   coaming  the glareshield's aft lip (an open cockpit): a map light
    // A seat with no rung gets no lamp — and no lamp is ever in the air.
    const P0 = window.CAGE_UI && window.CAGE_UI.P;
    const canopy = P0 ? Math.round(+P0.canopy || 0) : 0;     // 0 closed 1 convertible 2 open 3 bubble
    const aimAt = (p, q) => nrm([q[0] - p[0], q[1] - p[1], q[2] - p[2]]);
    // THE FLANGE MEETS THE STRUCTURE (the pedalier's lesson, G296): a
    // fitting's flange sits 0.62 r behind its face (PROF.can), so the face
    // stands that far off the surface along the aim, less a millimetre
    const sizeK0 = Math.max(0.2, +P.li_lampSize || 1);
    const sink = kind => 0.62 * (LIGHTS[kind].w / 2) * sizeK0 - 0.001;
    const off = (q, ax, d) => [q[0] + ax[0] * d, q[1] + ax[1] * d, q[2] + ax[2] * d];
    const headOf = s => [s.x, A.waistY + 0.22, s.zBack + 0.15];     // where the light is wanted
    const kU = (window.CAGE2 ? window.CAGE2.CAGE_UNIT : 1) * ((P0 && P0.planeScale) || 1);
    const ringPt = (name, lv) => {
      const r = (A.rings || []).find(q => q.name === name);
      const q = r && r.lv && r.lv[lv];
      return q ? [q.x * kU, q.y * kU, q.z * kU] : null;
    };
    const M0 = window.CAGE_UI && window.CAGE_UI.MS;
    // the ceiling-loop rail nearest a seat, with its centre and the aim
    const frameAt = s => {
      if (!M0 || !M0.V || !M0.F) return null;
      let best = null;
      for (const f of M0.F) {
        if (f.m !== 'ceilingLoop' || f.v.length < 3) continue;
        let cx = 0, cy = 0, cz = 0;
        for (const vi of f.v) { cx += M0.V[vi][0]; cy += M0.V[vi][1]; cz += M0.V[vi][2]; }
        cx = cx / f.v.length * kU; cy = cy / f.v.length * kU; cz = cz / f.v.length * kU;
        if (cy < (A.waistY + A.roofY) / 2) continue;               // the rail, not a lower band
        if (Math.abs(cz - (s.zBack + 0.15)) > 0.30) continue;      // this seat's bay
        if (Math.sign(cx) !== Math.sign(s.x) && Math.abs(s.x) > 0.05) continue;   // the seat's own side
        const d = Math.hypot(cx - s.x, cz - s.zBack - 0.15);
        if (!best || d < best.d) best = { p: [cx, cy, cz], d };
      }
      if (!best) return null;
      const ax = aimAt(best.p, headOf(s));
      return { p: off(best.p, ax, sink(s.kind)), ax, onCeiling: true, rung: 'frame' };
    };
    const roofAt = s => {
      // a face DIRECTLY over the seat (16 cm), and the lamp on that face —
      // not at the seat's own x under whatever the wider search found
      const cl = ceilAt(s.x, s.zBack + 0.12, 0.16);
      if (!cl) return null;
      const ax = cl.n || [0, -1, 0];
      return { p: off([cl.x, cl.y, cl.z], ax, sink(s.kind)), ax, onCeiling: true, rung: 'roof' };
    };
    const headerAt = s => {
      const h = ringPt('wsFront', 'roof') || ringPt('aeroWsA', 'roof');
      if (!h) return null;
      const q = [s.x * 0.6, h[1], h[2] - 0.02], ax = aimAt(q, headOf(s));
      return { p: off(q, ax, sink(s.kind)), ax, onCeiling: true, rung: 'header' };
    };
    // the bubble's rear bow: the aft-most station of the canopy glass over
    // the cabin, at the fuselage's own roof line there
    const archAt = s => {
      if (!M0 || !M0.V || !M0.F) return null;
      let zA = 1e9;
      for (const f of M0.F) {
        if (f.m !== 'windshield' && f.m !== 'pilotWindow' && f.m !== 'skyWindows') continue;
        for (const vi of f.v) { const z = M0.V[vi][2] * kU; if (z < zA) zA = z; }
      }
      if (zA > 1e8 || zA > s.zBack + 0.10) return null;           // no hood behind this seat
      // the fuselage's top at that station: the highest vertex of anything
      // that is not glass near the centreline there (the turtledeck's skin
      // is a pillar band here, not `body`)
      let yR = -1e9;
      const GLASS = { windshield: 1, pilotWindow: 1, pasengerWindow: 1, skyWindows: 1, joint: 1 };
      for (const f of M0.F) {
        if (GLASS[f.m]) continue;
        for (const vi of f.v) {
          const z = M0.V[vi][2] * kU, y = M0.V[vi][1] * kU;
          if (Math.abs(z - zA) < 0.06 && Math.abs(M0.V[vi][0] * kU) < 0.12 && y > yR) yR = y;
        }
      }
      if (yR < -1e8) yR = A.roofY;
      const q = [s.x * 0.5, yR, zA + 0.02], ax = aimAt(q, headOf(s));
      return { p: off(q, ax, sink(s.kind)), ax, onCeiling: false, rung: 'arch' };
    };
    const coamingAt = s => {
      if (A.dashTop == null || A.dashAftZ == null) return null;
      const yT = A.dashTopAt ? A.dashTopAt(s.x, 0.05, A.dashAftZ - 0.01, A.dashAftZ + 0.06) : A.dashTop;
      const q = [s.x, yT, A.dashAftZ + 0.035], ax = aimAt(q, [s.x, A.waistY - 0.05, s.zBack + 0.35]);
      return { p: off(q, ax, sink(s.kind)), ax, onCeiling: false, rung: 'coaming' };
    };
    const LADDER = {
      flood: [[roofAt, frameAt], [headerAt, frameAt], [coamingAt], [archAt, coamingAt]],
      pax:   [[roofAt, frameAt], [frameAt], [], []],
    };
    const mountAt = (kind, s) => {
      const s2 = Object.assign({}, s, { kind });
      for (const rung of (LADDER[kind][canopy] || [])) { const m = rung(s2); if (m) return m; }
      return null;
    };
    if (pilot) {
      const m = mountAt('flood', pilot);
      if (m) out.flood = m;
    }
    if (pilot) {
      // THE PEDALIER LAMP IS ON THE DASH'S UNDERSIDE (G291, the user: "there
      // is a lamp floating in the middle, what is it?"): it stood at a fixed
      // 0.30 m over the floor at the dash's station — 8 cm below the dash
      // box on the stock cabin, in mid-air between the pedals. The box's
      // lowest vertex is `dashLip` (the crew layer measures it), so the
      // fitting's flange sits against it there, 8 cm forward of the aft
      // face, aimed down at the pedals; a cabin without a measured dash
      // keeps the old station.
      // ...AND ITS FLANGE MEETS THE SURFACE (G296, the user: "there needs to
      // be an intersection, otherwise it floats"): the box's underside is
      // measured at the lamp's own place (`dashBotAt`, the lowest dash
      // vertex there — 20 mm under the lip was 12 mm of air), and the
      // fitting's flange (PROF.can: 0.62 r behind the face) is set 1 mm
      // INTO it. The size dial scales r, so it scales the offset too.
      const under = A.dashLip != null && A.dashAftZ != null;
      const zP = A.dashAftZ + 0.08;
      const rP = (LIGHTS.pedal.w / 2) * Math.max(0.2, +P.li_lampSize || 1);
      const yU = under ? (A.dashBotAt ? A.dashBotAt(pilot.x, 0.05, zP - 0.03, zP + 0.03) : A.dashLip) : null;
      out.pedal = { p: under ? [pilot.x, yU - 0.62 * rP + 0.001, zP]
                             : [pilot.x, A.floorAt(A.zDash) + 0.30, A.zDash - 0.02],
                    ax: [0, -1, 0] };
    }
    // the passenger lights are over every seat that is not the pilot's,
    // on the same ladder
    out.pax = seats.filter(s => !s.pilot).map(s => mountAt('pax', s)).filter(Boolean);
    // (the coaming strip's site went with the `panel` light — session 4b)
  }
  return out;
}

// ---------------------------------------------------------------------------
let group = null, board = null;
const level = (P, k) => {
  if (!+P.lightOn) return 0;
  const v = +P['li_' + k];
  return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
};

const prevPost = PAGE.post;
PAGE.post = (ctx) => {
  if (prevPost) prevPost(ctx);
  const { scene, P, stat } = ctx;
  if (group) {
    group.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    scene.remove(group);
    group = null;
  }
  // the old rotors belong to a group that has just been thrown away
  rotors.length = 0;
  if (tickRAF) { cancelAnimationFrame(tickRAF); tickRAF = 0; }
  if (!+P.lightOn) return;
  bayFromP(P);            // the same resolution the wing layer did, one owner
  const beaconRpm = P.li_beaconRpm != null ? +P.li_beaconRpm
                                           : LIGHTS.beacon.rpm;
  group = new THREE.Group();
  group.name = 'cageLayer:light';
  scene.add(group);

  const S = sites(scene, group, P);
  const drawn = {};
  const sizeK = Math.max(0.2, +P.li_lampSize || 1);
  const lenK = Math.max(0.2, +P.li_podLen || 1);
  const girthK = Math.max(0.2, +P.li_podGirth || 1);
  const reflectOn = P.li_reflect == null ? 1 : (+P.li_reflect ? 1 : 0);
  const lamp = (key, site, colOver) => {
    const L = LIGHTS[key], lv = level(P, key);
    const col = colOver != null ? colOver : L.col;
    // ONE SIZE, ONE SHAPE FOR EVERY TIP LIGHT (G179.5, the user: "they try
    // to size with IDK what. Keep the positioning, but give them a single
    // size and shape"). A pod used to take its girth from the surface's
    // thickness and its length from the tip chord, so a thick tip grew a
    // fat lamp and a thin fin a sliver. A navigation light is a catalogue
    // part: the same fitting on every aeroplane. `li_lampSize` still scales
    // it as one knob; nothing about the surface does.
    const r = (site.pod ? TIP_POD.r : (site.r || L.w / 2)) * sizeK;
    // WHERE THE FITTING ACTUALLY ENDED UP. A pod that is seated rather than
    // straddling moves its own origin, and the ROTOR has to move with it or
    // the mirror sweeps inside the fin while the dome stands on top of it.
    // Defaults to the site so every other installation is unchanged.
    let seat = site.p;
    // A LAMP IS THREE THINGS, and leaving any of them out is what makes one
    // read as a sticker: the LODGE it sits in, the JOINT that fairs it to the
    // skin, and the LENS.
    //
    // TWO INSTALLATIONS, because there are two kinds. A lamp on the OUTSIDE of
    // a surface — a nav light on a tip, a beacon on a fin — stands proud in
    // its own housing. A lamp RECESSED behind a cut, which is the wing
    // installation, has no lens of its own at all: the WING'S OWN GLASS is the
    // lens, and putting a second dome in front of it is how the first cut of
    // this ended up with a lamp poking through the panel it was supposed to be
    // behind. So a recessed lamp is a REFLECTOR CUP with a bulb in it and a
    // RIM round the cut, and the glass belongs to the wing.
    const lodge = Bag(hwMat('lodge')), seal = Bag(hwMat('seal'));
    const lens = Bag(lensMat(key, lv, col));
    // the reflector: the lodge's alloy, lit by the bulb it surrounds
    const cup = Bag(cupMat(lv, col, reflectOn, key));
    if (site.recess) {
      // THE REFLECTOR AND THE BULB ARE SOLIDS, and the bulb is the emitter —
      // it is drawn in the lens material because a bulb IS the light. The
      // wing's glass is the lens; there is no second dome here.
      revolveInto(lodge, site.p, site.ax, PROF.cup, 18, r);
      revolveInto(lens, site.p, site.ax, PROF.bulb, 14, r);
      // the mount: the cup hangs off the back of the bay on a bracket, which
      // is the difference between a lamp fitted in a bay and one floating in
      // the middle of it.
      boxInto(seal, [site.p[0] - site.ax[0] * r * 1.42,
                     site.p[1] - site.ax[1] * r * 1.42,
                     site.p[2] - site.ax[2] * r * 1.42],
              [r * 1.5, r * 0.22, r * 0.5]);
    } else if (site.pod) {
      // SEATED, NOT STRADDLING (2026-08-31). See `seat` below.
      // ON A THIN SURFACE: a teardrop fairing sized from the surface itself,
      // with the glass on top of it. NO GASKET PLATE — `boxInto` builds an
      // AXIS-ALIGNED box, so on a fin (which lies in the y-z plane) an 87 mm
      // square plate stood out sideways as a black square through the fin.
      // That is what the user saw on every one of these. The fairing IS the
      // joint here; there is nothing left for a plate to do.
      const wide = TIP_POD.wide * sizeK * girthK;
      const high = TIP_POD.high * sizeK * girthK;
      const chord = site.chord || [0, 0, -1], len = TIP_POD.len * sizeK * lenK;
      // THE FAIRING SITS ON THE SURFACE INSTEAD OF THROUGH IT. `site.sink` is
      // the fraction of the fairing's height that stays buried; 0.5 puts its
      // centre ON the fitted line, which is what this did unconditionally and
      // is why the beacon's inner faces rendered through the fin. A wingtip
      // light keeps 0.5 on purpose — there the fairing extends OUTBOARD along
      // its axis and there is no surface to stand on.
      const sink = site.sink == null ? 0.5 : site.sink;
      const lift = high * (0.5 - sink);
      site.buried = high * sink;               // what GATE CLIP allows below the skin
      const P0 = [site.p[0] + site.ax[0] * lift,
                  site.p[1] + site.ax[1] * lift,
                  site.p[2] + site.ax[2] * lift];
      seat = P0;
      if (site.noseLens) {
        // A WINGTIP LIGHT'S LENS IS THE NOSE OF THE FAIRING. Drawing a dome on
        // the pod's flank instead gives a coloured ball stuck to a tip, which
        // is what the first cut looked like — and the ball has to be as wide
        // as the declared lens, which on a 52 mm tip is the whole fitting.
        // The same body, cut at a fraction of its length, in two materials.
        podInto(lens, P0, chord, site.ax, len, wide, high, 14, 12, 0, 0.32);
        podInto(lodge, P0, chord, site.ax, len, wide, high, 14, 16, 0.30, 1);
        // the bulb inside, on the fairing's own axis
        revolveInto(lens, [P0[0] - chord[0] * len * 0.16,
                           P0[1] - chord[1] * len * 0.16,
                           P0[2] - chord[2] * len * 0.16],
                    chord, PROF.bulb, 10, Math.min(r, high * 0.34));
      } else {
        podInto(lodge, P0, chord, site.ax, len, wide, high);
        // the lamp sits ON the fairing's widest station: at 0.42 of the
        // half-height the dome's centre is still under the skin and the lens
        // reads as a flat sticker rather than as glass standing proud.
        const st = high * 0.50;
        const q = [P0[0] + site.ax[0] * st, P0[1] + site.ax[1] * st,
                   P0[2] + site.ax[2] * st];
        revolveInto(lens, q, site.ax, PROF.bulb, 14, r * 0.80);
        domeInto(lens, [q[0] - site.ax[0] * r * 0.10,
                        q[1] - site.ax[1] * r * 0.10,
                        q[2] - site.ax[2] * r * 0.10],
                 site.ax, r * 0.86, r * 0.72, 16, 5);
      }
    } else {
      // a proud fitting on a surface with room for it: housing, then the
      // REFLECTOR inside it, then the glass seated on its shoulder, then a
      // gasket ring under the flange — REVOLVED about the lamp's own axis,
      // not an axis-aligned box.
      //
      // THE CUP WAS MISSING FROM THIS BRANCH ENTIRELY, and that is why the
      // ceiling flood had a bulb standing in a bare barrel. `PROF.can` is a
      // barrel with a flange and a shoulder — a HOUSING — and `PROF.cup` (the
      // parabolic reflector) existed but was used only by the recessed wing
      // lamp and the beacon's rotating mirror. It goes in every proud fitting
      // now, on its own material so it can glow with the bulb.
      revolveInto(lodge, site.p, site.ax, PROF.can, 16, r);
      revolveInto(cup, [site.p[0] - site.ax[0] * r * 0.30,
                        site.p[1] - site.ax[1] * r * 0.30,
                        site.p[2] - site.ax[2] * r * 0.30],
                  site.ax, PROF.cup, 16, r * 0.74);
      revolveInto(lens, site.p, site.ax, PROF.bulb, 14, r * 0.85);
      domeInto(lens, [site.p[0] - site.ax[0] * r * 0.06,
                      site.p[1] - site.ax[1] * r * 0.06,
                      site.p[2] - site.ax[2] * r * 0.06],
               site.ax, r * 0.78, r * 0.62, 16, 4);
      revolveInto(seal, [site.p[0] - site.ax[0] * r * 0.60,
                         site.p[1] - site.ax[1] * r * 0.60,
                         site.p[2] - site.ax[2] * r * 0.60],
                  site.ax, PROF.gasket, 16, r);
    }
    const ms = [lodge.mesh(group), seal.mesh(group), cup.mesh(group)];
    const o = lens.mesh(group);
    for (const m of ms.concat([o])) {
      if (!m) continue;
      m.name = 'edLamp_' + key;
      m.userData.lampKey = key;               // GATE CLIP's identity per lamp
      if (site.partOf) m.userData.partOf = site.partOf;   // G300: rides its part
    }
    // THE MIRROR THAT MAKES IT FLASH. It is a child GROUP so that it can turn
    // while the housing and the dome stand still, and it is REAL GEOMETRY
    // aimed sideways — the user's rule again: no light without something to be
    // bright. The bulb rides at the cup's focus, on the axis of rotation, so
    // it stays put while the reflector sweeps round it, exactly as it does in
    // the fitting.
    if (L.rotor && !site.recess) {
      const rot = new THREE.Group();
      rot.name = 'liRotor_' + key;
      if (site.partOf) rot.userData.partOf = site.partOf;   // G300: the mirror too
      rot.position.set(seat[0], seat[1], seat[2]);
      // the mirror's own axis is ACROSS the beacon's, which is what makes the
      // beam horizontal on a beacon whose can stands vertical
      const a2 = Math.abs(site.ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const side = nrm(cross(site.ax, a2));
      const mir = Bag(hwMat('lodge')), fil = Bag(lensMat(key, lv, col));
      revolveInto(mir, [0, 0, 0], side, PROF.cup, 14, r * 0.52);
      revolveInto(fil, [0, 0, 0], site.ax, PROF.bulb, 10, r * 0.30);
      mir.mesh(rot); fil.mesh(rot);
      group.add(rot);
      rotors.push({ rot, host: group, dome: o, mat: o.material,
                    base: o.material.emissiveIntensity,
                    ax: nrm(site.ax), e1: side, e2: nrm(cross(site.ax, side)),
                    rpm: beaconRpm, p: seat.slice() });
    }
    drawn[key] = (drawn[key] || 0) + 1;
    return o;
  };

  // ---- OUTSIDE ------------------------------------------------------------
  if (S.navR) { lamp('nav', S.navR, S.navR.col); lamp('nav', S.navL, S.navL.col); }
  if (S.navT) lamp('nav', S.navT, S.navT.col);       // G295: the tail's white
  if (S.beacon) lamp('beacon', S.beacon);
  if (S.beacon2) lamp('beacon', S.beacon2);         // G267: the other fin's
  if (S.wingLampR) {
    lamp('taxi', S.wingLampL);
    lamp('land', S.wingLampR);
  }
  // ---- INSIDE -------------------------------------------------------------
  if (S.flood) lamp('flood', S.flood);
  if (S.pedal) lamp('pedal', S.pedal);
  for (const s of (S.pax || [])) lamp('pax', s);

  armRotors();       // the beacon starts turning as soon as it is built

  // ---- REAL LIGHT, AND ONLY WHERE IT EARNS ITS PLACE ----------------------
  // Every lamp above is emitting GEOMETRY, which is what the user's rule asks
  // for and what the census can see. A THREE.Light on top of that is a
  // different cost: r128 is a forward renderer, so each one is per-fragment
  // work on every material in the room, and the hangar already runs a
  // directional plus six spots against a realistic sixteen samplers.
  //
  // So exactly two are added, and each is the one that actually CHANGES the
  // picture rather than merely being visible: the landing lamp, which throws a
  // beam, and the cabin flood, which is the only interior source with anything
  // to light. Neither casts a shadow.
  const lit = [];
  if (S.wingLampR && level(P, 'land') > 0) {
    const l = new THREE.SpotLight(LIGHTS.land.col, level(P, 'land') * LIGHTS.land.thr,
      70, LIGHTS.land.beam, 0.5, 1.2);
    l.position.set(...S.wingLampR.p);
    l.target.position.set(S.wingLampR.p[0], S.wingLampR.p[1] - 8, S.wingLampR.p[2] + 60);
    l.castShadow = false;
    group.add(l); group.add(l.target); lit.push(['land', l]);
  }
  if (S.flood && level(P, 'flood') > 0) {
    const l = new THREE.PointLight(LIGHTS.flood.col, level(P, 'flood') * 0.9, 2.4, 1.6);
    l.position.set(...S.flood.p);
    l.castShadow = false;
    group.add(l); lit.push(['flood', l]);
  }
  // ...and the pedalier (G308): the flight has had it since G296; the shed
  // is where the user tests the switches from the seat, so it lights the
  // footwell here too — the same numbers as cockpit.js's
  if (S.pedal && level(P, 'pedal') > 0) {
    const l = new THREE.PointLight(LIGHTS.pedal.col, level(P, 'pedal') * 0.35, 1.2, 1.6);
    l.position.set(...S.pedal.p);
    l.castShadow = false;
    group.add(l); lit.push(['pedal', l]);
  }

  // ---- THE SWITCHBOARD ----------------------------------------------------
  // Declared on the room's own board (G-LIGHT's contract) so the CENSUS stays
  // complete: an emitting thing nobody claims is exactly what that gate exists
  // to catch, and an aeroplane full of lamps is the largest new population of
  // emitters this project has ever added at once.
  if (window.LIGHT_RIG && window.LIGHT_RIG.board) {
    board = window.LIGHT_RIG.board('aircraft');
    for (const k of Object.keys(LIGHTS)) {
      if (!drawn[k]) continue;
      board.declare('ac_' + k, 'aircraft: ' + LIGHTS[k].name, 'emissive', () => {
        group.traverse(o => {
          if (o.material && o.material.emissive) o.material.emissiveIntensity = 0;
        });
      });
    }
    for (const [k, l] of lit)
      board.declare('ac_' + k + '_src', 'aircraft: ' + LIGHTS[k].name + ' (source)',
                    'light', () => { l.intensity = 0; });
  }

  // ---- THE SWITCHES, ON THE DASH ------------------------------------------
  // the panel layer owns the switch row since session 3 of the panel arc —
  // levers, knobs, the key and the rockers as moving parts on the dash
  if (+P.lightSw && !(window.CAGE_PANEL && window.CAGE_PANEL.switches)) buildSwitches(group, P);

  window.CAGE_LIGHT = { LIGHTS, EXT, INT, sites: S, drawn,
                        lit: lit.map(x => x[0]),
                        // the panel arc (session 4): the flight rebuilds a
                        // lamp's lens and cup through the same factories
                        lensMat, cupMat };
  if (stat) {
    const on = Object.keys(LIGHTS).filter(k => drawn[k] && level(P, k) > 0);
    stat.textContent += '  ·  lights: ' + Object.keys(drawn).length + ' fitted' +
      (on.length ? ', ' + on.length + ' on' : ', all off') +
      (lit.length ? ' · ' + lit.length + ' real' : '');
  }
};

// ---------------------------------------------------------------------------
// THE SWITCHES
// ---------------------------------------------------------------------------
// TOGGLE LEVERS FOR THE OUTSIDE, KNOBS FOR THE INSIDE — the user's own split,
// and it is the split every light aeroplane has: a row of throws along the
// bottom of the panel and the dimmers beside them. The lever ANGLE and the
// knob ROTATION show the state, so the panel reads at a glance without a
// label on it.
function buildSwitches(parent, P) {
  const C = window.CAGE_CREW;
  if (!C || !C.panel || !C.panel.ext) return 0;
  const E = C.panel.ext;
  const body = Bag(hwMat('seal')), lever = Bag(hwMat('lodge'));
  const y = E.y0 - 0.030;                     // a row under the instruments
  const z = E.z - 0.004;
  const all = EXT.concat(INT.filter(k => !LIGHTS[k].later));
  const pitch = Math.min(0.040, (E.x1 - E.x0) / Math.max(1, all.length));
  let x = (E.x0 + E.x1) / 2 - pitch * (all.length - 1) / 2;
  for (const k of all) {
    const L = LIGHTS[k], v = +P['li_' + k] || 0;
    // the base plate every switch stands on
    boxInto(body, [x, y, z + 0.004], [pitch * 0.62, 0.020, 0.008]);
    if (L.ctl === 'switch') {
      // A LEVER THAT LEANS. Up is on, down is off, and the throw is 24 mm —
      // the same lever every DPDT toggle in an aeroplane has.
      const a = (v > 0.5 ? 1 : -1) * 0.42;
      const h = 0.020;
      const tip = [x + Math.sin(a) * 0, y + Math.cos(a) * h, z - 0.006 - Math.sin(a) * h];
      boxInto(lever, [(x + tip[0]) / 2, (y + tip[1]) / 2, (z - 0.003 + tip[2]) / 2],
              [0.005, h * 0.9, 0.006]);
    } else {
      // A KNOB THAT TURNS: a disc with a pointer, and the pointer IS the value
      const b2 = Bag(hwMat('lodge'));
      domeInto(b2, [x, y, z - 0.004], [0, 0, -1], 0.011, 0.006, 12, 2);
      const th = (0.75 + 1.5 * v) * Math.PI;
      const r0 = 0.004, r1 = 0.010;
      const c2 = Math.cos(th), s2 = Math.sin(th);
      b2.quad(b2.v(x + c2 * r0 - s2 * 0.0012, y + s2 * r0 + c2 * 0.0012, z - 0.011),
              b2.v(x + c2 * r0 + s2 * 0.0012, y + s2 * r0 - c2 * 0.0012, z - 0.011),
              b2.v(x + c2 * r1 + s2 * 0.0012, y + s2 * r1 - c2 * 0.0012, z - 0.011),
              b2.v(x + c2 * r1 - s2 * 0.0012, y + s2 * r1 + c2 * 0.0012, z - 0.011));
      b2.mesh(parent);
    }
    x += pitch;
  }
  body.mesh(parent); lever.mesh(parent);
  return all.length;
}

})();
