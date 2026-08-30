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
  beacon: { name: 'beacon', grp: 'ext', ctl: 'switch', order: 1,
            col: 0xff2412, w: 0.060 },
  taxi: { name: 'taxi', grp: 'ext', ctl: 'switch', order: 0,
          col: 0xfff2d6, w: 0.090, beam: 0.62, thr: 1.6 },
  land: { name: 'take-off & landing', grp: 'ext', ctl: 'switch', order: 2,
          col: 0xfffaf0, w: 0.110, beam: 0.30, thr: 4.0 },
  // ---- INSIDE, dimmable ---------------------------------------------------
  flood: { name: 'flood (overhead)', grp: 'int', ctl: 'dim', order: 0,
           col: 0xffd9a0, w: 0.075 },
  instr: { name: 'instrument', grp: 'int', ctl: 'dim', order: 1,
           col: 0xff9a4a, w: 0.030, later: true,
           note: 'declared and not drawn — the instruments light themselves ' +
                 'and that wants the faces to be lit surfaces first' },
  panel: { name: 'panel', grp: 'int', ctl: 'dim', order: 2,
           col: 0xffb060, w: 0.010 },
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
  li_lampSize: 1.0 };
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
    ['li_bayFrac', 'station (semispan)', 0.10, 0.80, 0.01],
    // THE RANGE HAS TO REACH THE NEXT ROW. The cut snaps to the loft's own
    // spanwise rows, which on this wing are 0.735 m apart — so a slider that
    // stopped at 0.45 could never widen the bay past one cell, and moving it
    // did nothing at all. Whatever the user asks for, the bay steps.
    ['li_bayHalf', 'half-width (snaps to ribs)', 0.06, 2.0, 0.01,
     { dim: 'm' }],
    ['li_bayChord', 'cut aft to (chord)', 0.04, 0.14, 0.005],
    ['li_bayDepth', 'lamp setback', 0.03, 0.28, 0.005, { dim: 'm' }],
    ['li_lampSize', 'lamp size', 0.4, 1.8, 0.05],
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
  return (emMats[id] = m);
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
};
// THE CUP'S OWN EXTENT, read off its profile rather than typed beside it —
// the recessed fit divides by these, and a profile edited without them is a
// lamp that pokes through the wing again.
PROF.cupRim = Math.max(...PROF.cup.map(q => q[0]));
PROF.cupBack = -Math.min(...PROF.cup.map(q => q[1]));
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
function sites(scene, group) {
  const out = {};
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
  const W = window.CAGE_WING, C = window.CAGE_CREW;
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
      return n ? { y: (y0 + y1) / 2, zLE: z1, zTE: z0, n } : null;
    };
    const span = wb.max.x - wb.min.x;
    const tipR = slice(wb.max.x - 0.12, 0.16), tipL = slice(wb.min.x + 0.12, 0.16);
    // THE LIGHT SITS AT THE TIP'S LEADING EDGE — forward, because being seen
    // from ahead is the entire purpose of a navigation light.
    if (tipR) out.navR = { p: [wb.max.x - 0.03, tipR.y, tipR.zLE - 0.05],
                           ax: [1, 0, 0], col: 0x18e04a };
    if (tipL) out.navL = { p: [wb.min.x + 0.03, tipL.y, tipL.zLE - 0.05],
                           ax: [-1, 0, 0], col: 0xff2a1e };
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
      // no bay cut (the lamps are switched off, so the wing did not cut one):
      // fall back to the leading edge measured off the wing skin alone
      const inb = (span / 2) * ((window.CAGE_LIGHT_BAY || {}).frac || 0.24);
      const inR = slice(inb, 0.18), inL = slice(-inb, 0.18);
      if (inR) out.wingLampR = { p: [inb, inR.y, inR.zLE - 0.010],
                                 ax: [0, -0.12, 1] };
      if (inL) out.wingLampL = { p: [-inb, inL.y, inL.zLE - 0.010],
                                 ax: [0, -0.12, 1] };
    }
  }
  // THE BEACON IS ON TOP OF THE FIN, so it is placed at the top of the fin's
  // own geometry. The layer publishes a mesh in cage units and no group, so
  // the bound is taken from the SCENE OBJECT that carries it — and from the
  // scene the post hook was handed, not from `window.CAGE_UI_SCENE`, which
  // only the GAME sets. Reading that global put the beacon on every aeroplane
  // in the game and none on the bench, which is a light that exists in one of
  // the two places it is supposed to.
  if (scene && scene.children) {
    for (const ch of scene.children) {
      if ((ch.name || '').indexOf('cageLayer:fin') !== 0) continue;
      const b = box(ch);
      if (b) out.beacon = { p: [0, b.max.y + 0.012, (b.min.z + b.max.z) / 2],
                            ax: [0, 1, 0] };
    }
  }
  if (C && C.A) {
    const A = C.A;
    const seats = C.seatsAt || [];
    const pilot = seats.find(s => s.pilot) || seats[0];
    if (pilot) {
      // the flood is in the ROOF over the pilot, aimed down
      out.flood = { p: [pilot.x, A.roofY - 0.03, pilot.zBack + 0.12],
                    ax: [0, -1, 0] };
      // the pedalier lights are under the coaming, aimed into the footwell
      out.pedal = { p: [pilot.x, A.floorAt(A.zDash) + 0.30, A.zDash - 0.02],
                    ax: [0, -1, 0] };
    }
    // the passenger lights are over every seat that is not the pilot's
    out.pax = seats.filter(s => !s.pilot).map(s =>
      ({ p: [s.x, A.roofY - 0.03, s.zBack + 0.10], ax: [0, -1, 0] }));
    // the panel lights are IN THE COAMING LIP, shining down onto the
    // instruments — which is the realistic answer and the reason the lip had
    // to be measured for the panel in the first place
    if (C.panel && C.panel.ext && A.dashLip != null)
      out.panel = { x0: C.panel.ext.x0, x1: C.panel.ext.x1,
                    y: A.dashLip - 0.004, z: C.panel.ext.z - 0.030 };
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
  if (!+P.lightOn) return;
  bayFromP(P);            // the same resolution the wing layer did, one owner
  group = new THREE.Group();
  group.name = 'cageLayer:light';
  scene.add(group);

  const S = sites(scene, group);
  const drawn = {};
  const sizeK = Math.max(0.2, +P.li_lampSize || 1);
  const lamp = (key, site, colOver) => {
    const L = LIGHTS[key], lv = level(P, key);
    const col = colOver != null ? colOver : L.col;
    const r = (site.r || L.w / 2) * sizeK;
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
    } else {
      // a proud fitting: housing, then the glass seated on its shoulder
      revolveInto(lodge, site.p, site.ax, PROF.can, 16, r);
      revolveInto(lens, site.p, site.ax, PROF.bulb, 14, r * 0.85);
      domeInto(lens, [site.p[0] - site.ax[0] * r * 0.06,
                      site.p[1] - site.ax[1] * r * 0.06,
                      site.p[2] - site.ax[2] * r * 0.06],
               site.ax, r * 0.78, r * 0.62, 16, 4);
      // the joint: a gasket plate under the flange, on the skin
      boxInto(seal, [site.p[0] - site.ax[0] * r * 0.66,
                     site.p[1] - site.ax[1] * r * 0.66,
                     site.p[2] - site.ax[2] * r * 0.66],
              [r * 2.9, r * 2.9, r * 0.22]);
    }
    lodge.mesh(group); seal.mesh(group);
    const o = lens.mesh(group);
    drawn[key] = (drawn[key] || 0) + 1;
    return o;
  };

  // ---- OUTSIDE ------------------------------------------------------------
  if (S.navR) { lamp('nav', S.navR, S.navR.col); lamp('nav', S.navL, S.navL.col); }
  if (S.beacon) lamp('beacon', S.beacon);
  if (S.wingLampR) {
    lamp('taxi', S.wingLampL);
    lamp('land', S.wingLampR);
  }
  // ---- INSIDE -------------------------------------------------------------
  if (S.flood) lamp('flood', S.flood);
  if (S.pedal) lamp('pedal', S.pedal);
  for (const s of (S.pax || [])) lamp('pax', s);
  // THE PANEL LIGHT IS A STRIP IN THE LIP, not a lamp: it is the one interior
  // light you are never supposed to see the source of.
  if (S.panel) {
    const lv = level(P, 'panel');
    const b = Bag(lensMat('panel', lv));
    const y = S.panel.y, z = S.panel.z, w = LIGHTS.panel.w;
    b.quad(b.v(S.panel.x0, y, z), b.v(S.panel.x1, y, z),
           b.v(S.panel.x1, y - w, z + w * 0.6),
           b.v(S.panel.x0, y - w, z + w * 0.6));
    b.mesh(group);
    drawn.panel = 1;
  }

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
  if (+P.lightSw) buildSwitches(group, P);

  window.CAGE_LIGHT = { LIGHTS, EXT, INT, sites: S, drawn,
                        lit: lit.map(x => x[0]) };
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
