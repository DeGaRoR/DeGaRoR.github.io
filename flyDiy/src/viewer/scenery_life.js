// scenery_life.js - THE LIFE IN THE SCENERY (SCENERY LIFE, 2026-09-23; the user: "People in the streets, driving
// cars, props and rubbish disposed next to walls and corners, random rubbish, small structures, communication
// antennas ... proper LODs, discarded at high distances ... Applying to all generic elements like roads, aprons,
// maybe lots ... controls in the world editor, including turning off").
//
// Nothing here is authored. The premises renderer (render_premises.js) hands over what it has BUILT - every
// house, outbuilding and site item with its generator's own report (the walls, the doors, the eaves and the
// ridge, every blocker on the ground: stats.groundAO), the plots with their frontages, the roads, the aprons,
// the zones, the parked aeroplanes - and this module stands the life around it by LAWS, from the record's seed:
//
//   people     standing about: at a door, two talking at a frontage, on the shoulder, round a parked aeroplane
//   clutter    against the back and side walls and in the corners, never at a door or on a stair: bins, drums,
//              barrels, crates, cartons, tyres, jerrycans, the two tall propane bottles, pallets, cinder blocks
//   rubbish    cans, bottles, paper, a plastic bag, a flattened carton: road shoulders (more in a zone), yards,
//              lots, along the fences, round the bins
//   cars       parked on the shoulder along a zone's road, never across a drive; traffic on every road the record
//              left without (the proto traffic of G432, its own density)
//   small      mailboxes at the frontages, the house's fuel (a 500-gallon propane tank or a 275-gallon oil tank),
//              a dumpster behind a shop or a works, utility cabinets, road signs, cones on the apron
//   antennas   a satellite dish on the wall that faces the southern sky, a TV aerial on a ridge, a lattice mast
//              with its equipment shelter by each settlement (the high ground) and each aerodrome (clear of the
//              runway's funnel), its red light lit at dusk
//
// THE RECORD: `rec.life` (contract v1.22) - { on, dist, seed, people, clutter, rubbish, cars, traffic, small,
// antennas }, every key optional (DEF below); the premises editor's LIFE section writes it and the life re-stands
// at once (no recompose: the premises are not touched).
//
// THE COST. The frame is CPU-bound on its draw count (PERF 2026-09-23: ~7 us of three.js a draw), so the life is
// drawn in a handful of draws whatever its count: every procedural piece (the kit below - vertex-coloured,
// no texture, a few hundred triangles at most) is ONE BatchedMesh per shadow class, and every scanned prop ONE
// InstancedMesh per level of detail per material part, as props.js's G515 instancer. Nothing is an Object3D per
// item (the matrix walk was 12 % of the frame). Every kind has LEVELS by distance - the scans their own baked
// cuts (a 350 k-triangle person starts at its 24 k cut), a scan with no cuts a procedural stand-in in its own
// mean colour past 25-40 m - and a LAST distance past which it is not drawn at all (rubbish 45 m, clutter 110,
// people 220, cars 450, a mast 6 km), times the record's `dist` and the GRAPHICS tier. The lists are re-cut
// when the eye has moved 3 m (or every 20 frames), over 64 m cells within reach only.
//
//   SCENERY_LIFE.make(THREE, host) -> L      host: see make()
//     L.set(cfg)    the record's life block changed: re-stand (debounced)
//     L.dirty()     the premises rebuilt / a house landed: re-stand when the build queue is empty
//     L.tick()      once a frame: re-stand if owed; the draw lists from the eye
//     L.trafficOf(rd)  vehicles per km on a road the record left without traffic
//     L.stats, L.items(cat), L.dispose()
(function () {
'use strict';
if (typeof window === 'undefined') return;

const DEF = { on: true, dist: 1, seed: 1, people: 1, clutter: 1, rubbish: 1, cars: 1, traffic: 1, small: 1, antennas: 1 };
// the editor's rows: key, label, max, what it stands
const CATS = [
  ['people', 'people', 3, 'standing about: at a door, two at a frontage, on the shoulder, round a parked aeroplane'],
  ['clutter', 'wall clutter', 3, 'bins, drums, crates, tyres, bottles and pallets against back and side walls and in corners'],
  ['rubbish', 'rubbish', 3, 'cans, bottles, paper, bags: road shoulders, yards, lots, fences'],
  ['cars', 'parked cars', 3, 'on the shoulder along a zone\'s roads, never across a drive'],
  ['traffic', 'traffic', 4, 'vehicles a km on every road the record gave no traffic (taxiways excluded)'],
  ['small', 'small structures', 3, 'mailboxes, fuel tanks, dumpsters, cabinets, road signs, cones'],
  ['antennas', 'antennas', 3, 'dishes on the south walls, TV aerials on ridges, a lattice mast by each settlement and field'],
];
// the GRAPHICS tier scales every distance (the potato draws the life at half its reach)
const TIER_DIST = { potato: 0.5, retro: 0.7, current: 0.85, gamer: 1, ultra: 1.3 };
const CELL = 64;

// ---- the procedural kit ---------------------------------------------------------------------------------------
// Each piece: origin at its ground contact (or its wall plate), +z its front, true size in metres; ONE geometry
// of position + normal + colour (sRGB hex -> linear), non-indexed so any two can share a BatchedMesh. `ao` darkens
// the vertices near the ground (the contact a scan bakes and a box has not).
function kitBuilder(T) {
  const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), P = new T.Vector3(), S = new T.Vector3();
  return function piece(parts, opts) {
    const o = opts || {};
    const pos = [], nor = [], col = [];
    const c = new T.Color();
    for (const [geo, hex, x, y, z, rx, ry, rz, sx, sy, sz] of parts) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      E.set(rx || 0, ry || 0, rz || 0); Q.setFromEuler(E);
      M.compose(P.set(x || 0, y || 0, z || 0), Q, S.set(sx || 1, sy === undefined ? (sx || 1) : sy, sz === undefined ? (sx || 1) : sz));
      g.applyMatrix4(M);
      if (!g.attributes.normal) g.computeVertexNormals();
      const p = g.attributes.position, n = g.attributes.normal;
      c.set(hex);
      for (let i = 0; i < p.count; i++) {
        const py = p.getY(i);
        const k = o.ao ? 0.62 + 0.38 * Math.min(1, Math.max(0, py / o.ao)) : 1;
        pos.push(p.getX(i), py, p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r * k, c.g * k, c.b * k);
      }
      g.dispose();
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  };
}
// the pieces (T = THREE, piece = kitBuilder(T)); `r` a radius, `h` a height, H = half pi
function buildKit(T) {
  const piece = kitBuilder(T), H = Math.PI / 2;
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const cyl = (r0, r1, h, n, open) => new T.CylinderGeometry(r0, r1, h, n || 10, 1, !!open);
  const ball = (r, d) => new T.IcosahedronGeometry(r, d || 0);
  const K = {};
  // -- rubbish: under half a metre, no shadow, gone at 45 m
  K.can = piece([[cyl(0.033, 0.033, 0.122, 8), 0xffffff, 0, 0.033, 0, 0, 0, H]]);
  K.bottle = piece([[cyl(0.036, 0.036, 0.2, 8), 0xffffff, 0, 0.036, 0, H, 0, 0], [cyl(0.013, 0.02, 0.08, 6), 0xffffff, 0, 0.036, 0.14, H, 0, 0]]);
  K.paper = piece([[ball(0.055, 0), 0xb9b5aa, 0, 0.035, 0, 0.3, 0.7, 0.2, 1, 0.65, 1.15]]);
  K.sheet = piece([[box(0.3, 0.008, 0.22), 0xffffff, 0, 0.004, 0, 0, 0, 0.02]]);
  K.bag = piece([[ball(0.12, 1), 0xffffff, 0, 0.045, 0, 0, 0, 0, 1.25, 0.38, 0.9], [ball(0.05, 0), 0xffffff, 0.14, 0.03, 0.02, 0, 0, 0, 1, 0.5, 1]]);
  // -- tyres: one lying, a stack, one on its tread (against a wall)
  const tor = () => new T.TorusGeometry(0.29, 0.1, 6, 14);
  K.tyre = piece([[tor(), 0x1d1d1c, 0, 0.1, 0, H]], { ao: 0.2 });
  K.tyres = piece([[tor(), 0x1d1d1c, 0, 0.1, 0, H], [tor(), 0x222221, 0.03, 0.3, -0.02, H], [tor(), 0x1b1b1a, -0.02, 0.5, 0.03, H]], { ao: 0.3 });
  K.tyreUp = piece([[tor(), 0x1d1d1c, 0, 0.39, 0, 0.12]], { ao: 0.25 });
  // -- a carton (and three stacked), flattened card
  K.carton = piece([[box(0.5, 0.38, 0.4), 0xffffff, 0, 0.19, 0], [box(0.505, 0.02, 0.06), 0xd8c6a0, 0, 0.375, 0]], { ao: 0.3 });
  K.cartons = piece([[box(0.5, 0.38, 0.4), 0xffffff, 0, 0.19, 0], [box(0.46, 0.34, 0.38), 0xffffff, 0.03, 0.55, -0.01, 0, 0.2], [box(0.5, 0.38, 0.4), 0xffffff, 0.55, 0.19, 0.05, 0, -0.15]], { ao: 0.4 });
  // -- the house's fuel: two 100 lb propane bottles; the 500-gallon 'pig' on its saddles; the 275-gallon oil tank on legs
  const bottle100 = x => [[cyl(0.185, 0.185, 1.0, 12), 0xe9e8e2, x, 0.5, 0], [new T.SphereGeometry(0.185, 12, 4, 0, Math.PI * 2, 0, H), 0xe9e8e2, x, 1.0, 0], [cyl(0.13, 0.13, 0.16, 10, true), 0xd0d0cc, x, 1.19, 0], [cyl(0.02, 0.02, 0.08, 6), 0x8a7a30, x, 1.2, 0]];
  K.propane2 = piece(bottle100(-0.22).concat(bottle100(0.22)), { ao: 0.5 });
  K.pig = piece([[cyl(0.48, 0.48, 2.1, 16), 0xeeeeea, 0, 0.83, 0, 0, 0, H], [new T.SphereGeometry(0.48, 16, 6), 0xeeeeea, 1.05, 0.83, 0, 0, 0, 0, 0.45, 1, 1], [new T.SphereGeometry(0.48, 16, 6), 0xeeeeea, -1.05, 0.83, 0, 0, 0, 0, 0.45, 1, 1],
    [box(0.16, 0.4, 0.7), 0x77776f, 0.6, 0.2, 0], [box(0.16, 0.4, 0.7), 0x77776f, -0.6, 0.2, 0], [cyl(0.14, 0.14, 0.18, 10), 0xdcdcd6, 0, 1.36, 0]], { ao: 0.6 });
  K.oiltank = piece([[cyl(0.55, 0.55, 1.5, 14), 0x6d735f, 0, 1.0, 0, 0, 0, H, 1, 1, 0.52], [box(0.06, 0.45, 0.06), 0x3a3a36, 0.6, 0.225, 0.18], [box(0.06, 0.45, 0.06), 0x3a3a36, -0.6, 0.225, 0.18],
    [box(0.06, 0.45, 0.06), 0x3a3a36, 0.6, 0.225, -0.18], [box(0.06, 0.45, 0.06), 0x3a3a36, -0.6, 0.225, -0.18], [cyl(0.05, 0.05, 0.14, 8), 0x444440, 0.4, 1.6, 0]], { ao: 0.7 });
  // -- a rural mailbox on its post (the flag up on one of three), a dumpster, a utility cabinet
  K.mailbox = piece([[box(0.09, 1.05, 0.09), 0x6a5034, 0, 0.525, -0.1], [box(0.1, 0.03, 0.34), 0x6a5034, 0, 1.03, 0.05], [box(0.2, 0.14, 0.46), 0xffffff, 0, 1.12, 0.05],
    [cyl(0.1, 0.1, 0.46, 10, false), 0xffffff, 0, 1.19, 0.05, H, 0, 0, 1, 1, 0.7], [box(0.015, 0.16, 0.04), 0xc41e1e, 0.11, 1.24, -0.05]], { ao: 0.4 });
  K.dumpster = piece([[box(1.8, 1.05, 1.1), 0xffffff, 0, 0.6, 0], [box(1.86, 0.06, 1.2), 0x1e1f1e, 0, 1.15, -0.02, -0.06], [box(1.9, 0.08, 0.12), 0x2a2b2a, 0, 1.0, 0.6],
    [cyl(0.07, 0.07, 0.06, 8), 0x151515, 0.75, 0.07, 0.42, 0, 0, H], [cyl(0.07, 0.07, 0.06, 8), 0x151515, -0.75, 0.07, 0.42, 0, 0, H], [cyl(0.07, 0.07, 0.06, 8), 0x151515, 0.75, 0.07, -0.42, 0, 0, H], [cyl(0.07, 0.07, 0.06, 8), 0x151515, -0.75, 0.07, -0.42, 0, 0, H]], { ao: 0.5 });
  K.cabinet = piece([[box(0.85, 0.1, 0.5), 0x6a6a64, 0, 0.05, 0], [box(0.8, 1.2, 0.45), 0x7b8878, 0, 0.7, 0], [box(0.86, 0.04, 0.5), 0x6e7b6b, 0, 1.32, 0], [box(0.01, 0.9, 0.36), 0x6f7c6c, 0.405, 0.7, 0]], { ao: 0.4 });
  // -- road signs: a speed limit (white, black rim), a warning diamond (yellow, black rim)
  K.signSpeed = piece([[cyl(0.035, 0.035, 2.3, 8), 0x9ea1a1, 0, 1.15, -0.03], [box(0.64, 0.8, 0.012), 0x141414, 0, 1.95, 0.004], [box(0.58, 0.74, 0.014), 0xf0efe9, 0, 1.95, 0.008], [box(0.36, 0.2, 0.002), 0x1a1a1a, 0, 1.88, 0.016]]);
  K.signWarn = piece([[cyl(0.035, 0.035, 2.2, 8), 0x9ea1a1, 0, 1.1, -0.03], [box(0.6, 0.6, 0.012), 0x141414, 0, 1.95, 0.004, 0, 0, Math.PI / 4], [box(0.54, 0.54, 0.014), 0xe9c21b, 0, 1.95, 0.008, 0, 0, Math.PI / 4]]);
  // -- an apron cone
  K.cone = piece([[box(0.36, 0.03, 0.36), 0x1b1b1b, 0, 0.015, 0], [cyl(0.028, 0.15, 0.68, 12), 0xff5a14, 0, 0.37, 0], [cyl(0.075, 0.098, 0.1, 12), 0xf2f2ee, 0, 0.43, 0]]);
  // -- far stand-ins for the scans with no cuts of their own (their colour is the scan's mean, per instance)
  K.farBox = piece([[box(1, 1, 1), 0xffffff, 0, 0.5, 0]], { ao: 0.6 });
  K.farCyl = piece([[cyl(0.5, 0.5, 1, 10), 0xffffff, 0, 0.5, 0]], { ao: 0.6 });
  // a person past 90 m (7-20 px tall there): legs, a coat, arms, a head - 1.75 m, tinted by the scan's own mean
  K.figure = piece([[box(0.13, 0.82, 0.16), 0x6e6e6e, -0.1, 0.41, 0], [box(0.13, 0.82, 0.16), 0x6e6e6e, 0.1, 0.41, 0], [box(0.44, 0.62, 0.26), 0xffffff, 0, 1.13, 0],
    [box(0.1, 0.58, 0.12), 0xf0f0f0, -0.28, 1.1, 0, 0, 0, 0.08], [box(0.1, 0.58, 0.12), 0xf0f0f0, 0.28, 1.1, 0, 0, 0, -0.08], [box(0.2, 0.24, 0.22), 0xd9bca4, 0, 1.6, 0]]);
  // a car past 120 m (a 4 m car is under 40 px there): the body, the glasshouse, four wheels - unit size, scaled to the scan's
  K.carBody = piece([[box(1, 0.36, 1), 0xffffff, 0, 0.33, 0], [box(0.86, 0.3, 0.52), 0x2a2c30, 0, 0.66, -0.04], [box(0.9, 0.05, 0.54), 0xffffff, 0, 0.83, -0.04],
    [cyl(0.15, 0.15, 0.1, 8), 0x141414, 0.46, 0.15, 0.32, 0, 0, H], [cyl(0.15, 0.15, 0.1, 8), 0x141414, -0.46, 0.15, 0.32, 0, 0, H], [cyl(0.15, 0.15, 0.1, 8), 0x141414, 0.46, 0.15, -0.32, 0, 0, H], [cyl(0.15, 0.15, 0.1, 8), 0x141414, -0.46, 0.15, -0.32, 0, 0, H]], { ao: 0.3 });
  // -- a satellite dish on its wall bracket (the plate at z = 0, the dish looking along +z and 22 deg up)
  const dishPts = []; for (let i = 0; i <= 6; i++) { const r = 0.38 * i / 6; dishPts.push(new T.Vector2(r, 0.12 * (r / 0.38) * (r / 0.38))); }
  const dish = new T.LatheGeometry(dishPts, 16);
  K.dish = piece([[box(0.16, 0.22, 0.02), 0x8e8e8a, 0, 0, 0.01], [box(0.04, 0.04, 0.3), 0x8e8e8a, 0, 0, 0.16], [dish, 0xe7e7e3, 0, 0.12, 0.36, H - 0.38, 0, 0],
    [box(0.022, 0.022, 0.42), 0x9a9a96, 0, 0.02, 0.5, -0.5, 0, 0], [box(0.06, 0.06, 0.1), 0x2d2d2d, 0, 0.22, 0.66]]);
  // -- a TV aerial (a Yagi on a 2.4 m mast, the boom along +z)
  const yagi = [[cyl(0.02, 0.02, 2.4, 6), 0xa6a8a6, 0, 1.2, 0], [box(0.022, 0.022, 1.7), 0xa6a8a6, 0, 2.3, 0.2]];
  for (let i = 0; i < 9; i++) yagi.push([box(i === 0 ? 1.0 : 0.86 - i * 0.05, 0.012, 0.012), 0xb4b6b4, 0, 2.3, -0.55 + i * 0.19]);
  yagi.push([box(0.012, 0.012, 0.9), 0xa6a8a6, 0, 1.9, 0.0, 0.5, 0, 0]);
  K.tvant = piece(yagi);
  // -- the lattice mast (30 m; stood scaled 0.75-1.35 in height), aviation orange and white in seven bands, a
  //    panel antenna on each face, a microwave dish, the lightning rod; its equipment shelter separately
  {
    const Hm = 30, parts = [], nSec = 17, face = h => 2.2 - 1.2 * h / Hm;
    const band = y => (Math.floor(y / Hm * 7) % 2 === 0) ? 0xe2561d : 0xf1f0ea;
    const leg = (k, y) => { const r = face(y) / Math.sqrt(3), a = k * 2 * Math.PI / 3; return [Math.cos(a) * r, Math.sin(a) * r]; };
    for (let s = 0; s < nSec; s++) {
      const y0 = Hm * s / nSec, y1 = Hm * (s + 1) / nSec, ym = (y0 + y1) / 2;
      for (let k = 0; k < 3; k++) {
        const a0 = leg(k, y0), a1 = leg(k, y1), b0 = leg((k + 1) % 3, y0), b1 = leg((k + 1) % 3, y1);
        const seg = (p, q, r, c) => { const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], L = Math.hypot(dx, dy, dz);
          const g = cyl(r, r, L, 5); g.lookAt && 0; const m = new T.Matrix4(), up = new T.Vector3(0, 1, 0), dir = new T.Vector3(dx, dy, dz).normalize();
          m.makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(up, dir)); m.setPosition((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2); g.applyMatrix4(m); parts.push([g, c]); };
        seg([a0[0], y0, a0[1]], [a1[0], y1, a1[1]], 0.055, band(ym));                       // the leg
        seg([a0[0], y0, a0[1]], [b1[0], y1, b1[1]], 0.022, band(ym));                       // the diagonal
        seg([a1[0], y1, a1[1]], [b1[0], y1, b1[1]], 0.02, band(y1));                        // the girt
      }
    }
    for (let k = 0; k < 3; k++) { const a = (k + 0.5) * 2 * Math.PI / 3, r = face(Hm - 3) / 2 + 0.25; parts.push([box(0.3, 1.3, 0.12), 0xe9e9e4, Math.cos(a) * r, Hm - 2.6, Math.sin(a) * r, 0, -a + H]); }
    const mw = new T.CylinderGeometry(0.5, 0.5, 0.35, 16); parts.push([mw, 0xdedfdb, 0, Hm - 6, 0.75, H]);
    parts.push([cyl(0.025, 0.025, 2.5, 6), 0x8f918f, 0, Hm + 1.25, 0]);
    K.mast = piece(parts);
  }
  K.shelter = piece([[box(3.0, 2.5, 2.4), 0xc9c1a8, 0, 1.25, 0], [box(3.2, 0.12, 2.6), 0x8d8f8c, 0, 2.56, 0], [box(0.95, 2.05, 0.03), 0x5d6266, 0.7, 1.03, 1.21], [box(0.5, 0.4, 0.3), 0x9c9c98, -0.8, 1.9, 1.3], [box(0.3, 0.06, 2.6), 0x6d6d6a, 0, 2.2, 0, 0, 0, 0.2]], { ao: 0.8 });
  return K;
}

// ---- the kinds: what an item IS, its levels and its last distance ----------------------------------------------
// levels: [{ prop, to } | { proc, to, far }] ascending; `to` the level's far edge in metres (x dist x tier); past the
// last nothing is drawn. A scan whose cuts start with a full level heavier than `skip0` triangles starts at its
// first cut. `mean` = the scan's own mean colour for a procedural stand-in (props with no cuts).
const CUT = { people: 220, clutter: 110, rubbish: 45, cars: 450, small: 220, antennas: 300 };
const SCANS = {
  // wall clutter (the hangar's and the yard's scans)
  bin_metal: { cat: 'clutter', far: ['farBox', 0.78, 0.91, 0.56], near: 35 }, bin_metal_rust: { cat: 'clutter', far: ['farBox', 0.77, 0.91, 0.55], near: 35 },
  barrel_plastic: { cat: 'clutter', far: ['farCyl', 0.49, 0.88, 0.49], near: 35 }, drum_steel: { cat: 'clutter', far: ['farCyl', 0.63, 0.93, 0.63], near: 40 },
  jerrycan: { cat: 'clutter', far: ['farBox', 0.27, 0.32, 0.34], near: 22 }, crate_wood_a: { cat: 'clutter', far: ['farBox', 0.41, 0.41, 0.42], near: 40 },
  crate_wood_b: { cat: 'clutter', far: ['farBox', 0.41, 0.82, 0.42], near: 40 }, crate_wood_c: { cat: 'clutter', far: ['farBox', 1.01, 0.41, 0.42], near: 40 },
  bottle_propane: { cat: 'clutter', far: ['farCyl', 0.34, 0.55, 0.34], near: 20 },
};
function levelsOf(key, cut, skip0, far) {
  const PR = propReg(); if (!PR || !PR.props[key]) return null;
  const lv = typeof propLevels === 'function' ? propLevels(key) : [];
  const S = SCANS[key];
  if (!lv.length) {
    const near = S ? S.near : cut;
    const out = [{ prop: key, to: Math.min(near, cut) }];
    if (S && S.far && cut > near) out.push({ proc: S.far[0], dims: S.far.slice(1), mean: key, to: cut });
    return out;
  }
  const out = [], full = PR.props[key];
  const heavy = skip0 && full.nt > skip0;
  if (!heavy) out.push({ prop: key, to: lv[0].dist });
  for (let i = 0; i < lv.length; i++) out.push({ prop: lv[i].key, to: i + 1 < lv.length ? lv[i + 1].dist : cut });
  // a procedural stand-in from `far.at` metres on: the scan's levels end there (the one batched draw takes it past)
  if (far && far.at < cut) {
    const keep = out.filter((l, i) => i === 0 || out[i - 1].to < far.at).map(l => ({ ...l, to: Math.min(l.to, far.at) }));
    const d = full.dim || [1, 1, 1];
    keep.push({ proc: far.proc, dims: far.proc === 'figure' ? [1, d[1] / 1.75, 1] : [d[0], d[1], d[2]], mean: keep[keep.length - 1].prop, to: cut });
    return keep;
  }
  // a cut past the category's last distance is not drawn
  return out.filter((l, i) => i === 0 || out[i - 1].to < cut).map(l => ({ ...l, to: Math.min(l.to, cut) }));
}
const propReg = () => (typeof PROP_REG !== 'undefined' ? PROP_REG : (window.PROP_REG || null));

// ---- the make ------------------------------------------------------------------------------------------------
// host: { root, frame() -> {toWorld, toLocal, yaw}, heightAt(x, z), waterY(), houses() -> Map, plots(), roads(),
//         aprons() [premises polys], zones(), runways(), aircraft() [{x, z, yaw} world], record(), eye() -> Vector3,
//         lampsOn() 0..1, queued() -> n, obstacles() -> registry|null, game, onTraffic() }
function make(THREE, host) {
  const T = THREE;
  const PG = window.PREMISES_GEN;
  let cfg = Object.assign({}, DEF);
  const root = new T.Group(); root.name = 'premises:life'; root.matrixAutoUpdate = false;
  host.root.add(root);
  let KIT = null;                                   // the procedural geometries, built on the first stand
  const stats = { on: false, items: 0, byCat: {}, visible: 0, draws: 0, placeMs: 0, updMs: 0, batches: 0, procVisible: 0 };
  // THE ITEMS: parallel arrays, one entry per placed thing (world matrix, kind, tint, cell)
  let IT = { n: 0, M: new Float32Array(0), kind: new Uint16Array(0), tint: new Float32Array(0), cat: [], cells: new Map() };
  const KINDS = [];                                 // [{ id, cat, levels, shadowTo }]
  const KIND_BY = new Map();
  let owed = true, owedAt = 0, frame = 0, lastEye = null, lastObst = [];

  const tierK = () => { try { const G = window.GFX && window.GFX.get && window.GFX.get(); return (G && TIER_DIST[G.preset]) || 1; } catch (e) { return 1; } };
  const reach = () => Math.max(0.1, +cfg.dist || 1) * tierK();

  // a kind by id, made once: `levels` of a scan from its cuts; a procedural piece is one level
  function kindOf(id, cat, levels, opts) {
    let k = KIND_BY.get(id);
    if (k) return k;
    k = Object.assign({ id, cat, levels, idx: KINDS.length, shadowTo: 40 }, opts || {});
    KINDS.push(k); KIND_BY.set(id, k);
    return k;
  }
  const procKind = (id, cat, to, opts) => kindOf('p:' + id, cat, [{ proc: id, to }], opts);
  const scanKind = (key, cat, cut, skip0, far) => { const L = levelsOf(key, cut, skip0, far); return L ? kindOf('s:' + key, cat, L) : null; };

  // ---- the stand -------------------------------------------------------------------------------------------------
  const TMP = { m: new T.Matrix4(), q: new T.Quaternion(), q2: new T.Quaternion(), e: new T.Euler(), p: new T.Vector3(), s: new T.Vector3(), n: new T.Vector3(), up: new T.Vector3(0, 1, 0) };
  let LIST = [];
  // one item, WORLD position; `tilt` true = stood on the ground's slope; `y` absolute (a wall mount) or null = the ground
  function put(kind, x, z, ry, o) {
    if (!kind) return false;
    const q = o || {};
    const gy = q.y !== undefined ? q.y : host.heightAt(x, z) + (q.lift || 0);
    if (!isFinite(gy)) return false;
    TMP.e.set(q.rx || 0, ry || 0, q.rz || 0, 'YXZ'); TMP.q.setFromEuler(TMP.e);
    if (q.tilt) {
      const e = 0.3, gx = (host.heightAt(x + e, z) - host.heightAt(x - e, z)) / (2 * e), gz = (host.heightAt(x, z + e) - host.heightAt(x, z - e)) / (2 * e);
      TMP.n.set(-gx, 1, -gz).normalize(); TMP.q2.setFromUnitVectors(TMP.up, TMP.n); TMP.q.premultiply(TMP.q2);
    }
    const s = q.s || 1, sy = q.sy || s;
    TMP.m.compose(TMP.p.set(x, gy, z), TMP.q, TMP.s.set(q.sx || s, sy, q.sz || s));
    LIST.push({ k: kind.idx, m: TMP.m.elements.slice(), t: q.tint || null, cat: kind.cat });
    return true;
  }

  // the free-ground test: not in water, not steep, not on a pavement (the world's coverAt, v1.17.1 - the law the trees
  // and the rocks keep; an apron's edge asks with `paved` true), not on another item
  function clear(x, z, r, paved) {
    const gy = host.heightAt(x, z);
    if (!isFinite(gy) || gy < wet(x, z) + 0.15) return false;
    // (coverAt's kill is the vegetation's fade - 0.5 four metres past a gravel road - so ON the pavement is kill ~1: the
    // carriageway and its gravel band; a road's own things - the parked car, the sign, the litter, someone walking - ask
    // with `paved` true and keep off the carriageway by their offset)
    if (!paved && host.cover) { const cv = host.cover(x, z); if (cv && cv.kill > 0.97) return false; }
    const e = Math.max(0.4, r);
    if (Math.abs(host.heightAt(x + e, z) - host.heightAt(x - e, z)) > 0.45 * e * 2 || Math.abs(host.heightAt(x, z + e) - host.heightAt(x, z - e)) > 0.45 * e * 2) return false;
    const g = OCCG;
    const bx = Math.floor(x / 8), bz = Math.floor(z / 8);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = g.get((bx + a) + ',' + (bz + b)); if (L) for (const o of L) if (Math.hypot(o[0] - x, o[1] - z) < o[2] + r) return false; }
    return true;
  }
  // the water AT the point (a pond, a lake, the sea), not the sea level: a mast stood in a muskeg pond once
  const wet = (x, z) => { const w = host.waterAt ? host.waterAt(x, z) : host.waterY(); return Number.isFinite(w) ? w : -1e9; };
  let OCCG = new Map();
  function occupy(x, z, r) { const k = Math.floor(x / 8) + ',' + Math.floor(z / 8); let L = OCCG.get(k); if (!L) OCCG.set(k, L = []); L.push([x, z, r]); }
  // road clearance: distance (premises frame) to any road's edge
  let ROADS = [];
  function offRoad(lx, lz, m) { for (const r of ROADS) { if (Math.abs(lx - r.cx) > r.R + m || Math.abs(lz - r.cz) > r.R + m) continue; if (PG.roadDist(r, lx, lz) < r.w / 2 + m) return false; } return true; }

  const TINTS = {
    can: [[0.8, 0.08, 0.06], [0.75, 0.76, 0.78], [0.1, 0.25, 0.7], [0.1, 0.5, 0.2], [0.9, 0.75, 0.1]],
    bottle: [[0.23, 0.12, 0.04], [0.08, 0.3, 0.1], [0.55, 0.62, 0.55]],
    bag: [[0.9, 0.9, 0.88], [0.15, 0.3, 0.7], [0.08, 0.08, 0.08], [0.85, 0.8, 0.2]],
    sheet: [[0.46, 0.35, 0.22], [0.52, 0.4, 0.25], [0.62, 0.6, 0.56]],
    carton: [[0.62, 0.47, 0.29], [0.55, 0.42, 0.26], [0.7, 0.56, 0.36]],
    mailbox: [[0.1, 0.1, 0.1], [0.45, 0.46, 0.47], [0.55, 0.1, 0.08], [0.12, 0.2, 0.42], [0.18, 0.28, 0.16]],
    dumpster: [[0.14, 0.3, 0.17], [0.12, 0.2, 0.42], [0.5, 0.36, 0.12], [0.35, 0.36, 0.34]],
  };
  const pickTint = (rnd, id) => { const L = TINTS[id]; return L ? L[Math.floor(rnd() * L.length)] : null; };

  // the scan's MEAN colour (its base map averaged over an 8 x 8 draw, times the material colour), for the far box
  const MEAN = new Map();
  function meanOf(key) {
    if (MEAN.has(key)) return MEAN.get(key);
    let out = null;
    try {
      if (typeof propBuild === 'function' && typeof propReady === 'function' && propReady(key)) {
        const b = propBuild(T, key), m = b.mats[0], img = m && m.map && m.map.image;
        if (img && img.complete && img.naturalWidth) {
          const cv = document.createElement('canvas'); cv.width = cv.height = 8;
          const g = cv.getContext('2d'); g.drawImage(img, 0, 0, 8, 8);
          const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, bb = 0;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; }
          const lin = v => { v /= 64 * 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
          out = [lin(r) * m.color.r, lin(gg) * m.color.g, lin(bb) * m.color.b];
        } else if (m) out = [m.color.r * 0.35, m.color.g * 0.35, m.color.b * 0.35];
      }
    } catch (e) { out = null; }
    if (out) MEAN.set(key, out);
    return out || [0.25, 0.25, 0.24];
  }

  // THE LAWS -------------------------------------------------------------------------------------------------------
  const RECIPES = {
    residential: [['bins', 3], ['propane2', 2], ['tyres', 2], ['crates', 1.5], ['jerry', 1], ['barrel', 1.5], ['cartons', 1], ['tyreUp', 1]],
    shed: [['tyres', 2], ['drum', 2], ['crates', 2], ['jerry', 1.5], ['tyreUp', 1.5], ['blocks', 0.8]],
    commercial: [['bins', 2], ['cartons', 3], ['crates', 2], ['barrel', 1], ['dumpsterSide', 1.5], ['pallets', 1.5]],
    // a works, a cannery, a packing plant: pallets and blocks, drums, crates, cones (the yard, not the street)
    industrial: [['drums', 3], ['pallets', 3], ['tyres', 2], ['crates', 2], ['blocks', 1.5], ['barrel', 1.5], ['cartons', 1], ['drum', 2], ['cones', 0.8]],
    hangar: [['drums', 3], ['jerry', 2], ['tyres', 2], ['drum', 2], ['crates', 1], ['pallets', 1]],
    official: [['bins', 2], ['cartons', 1], ['crates', 1]],
  };
  const pickW = (rnd, L) => { let t = 0; for (const x of L) t += x[1]; let u = rnd() * t; for (const x of L) { u -= x[1]; if (u <= 0) return x[0]; } return L[0][0]; };
  // a recipe -> the kinds laid side by side along the wall, with their widths (along) and depths (out)
  function recipe(name, rnd) {
    const S = id => scanKind(id, 'clutter', CUT.clutter), P = id => procKind(id, 'clutter', CUT.clutter);
    switch (name) {
      case 'bins': { const n = 1 + (rnd() < 0.55 ? 1 : 0); const a = []; for (let i = 0; i < n; i++) a.push([S(rnd() < 0.4 ? 'bin_metal_rust' : 'bin_metal'), 0.85, 0.6]); return a; }
      case 'propane2': return [[procKind('propane2', 'clutter', CUT.small + 30), 0.9, 0.45]];
      case 'tyres': return [[P('tyres'), 0.8, 0.8]];
      case 'tyreUp': return [[P('tyreUp'), 0.3, 0.3], [P('tyreUp'), 0.3, 0.3]];
      case 'crates': { const a = []; const n = 1 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) a.push([S(['crate_wood_a', 'crate_wood_b', 'crate_wood_c'][Math.floor(rnd() * 3)]), 0.5, 0.45]); return a; }
      case 'jerry': return [[S('jerrycan'), 0.35, 0.3], [S('jerrycan'), 0.35, 0.3]];
      case 'barrel': return [[S('barrel_plastic'), 0.55, 0.55]];
      case 'drum': return [[S('drum_steel'), 0.7, 0.7]];
      case 'drums': return [[S('drum_steel'), 0.7, 0.7], [S('drum_steel'), 0.7, 0.7], [S(rnd() < 0.5 ? 'drum_steel' : 'barrel_plastic'), 0.7, 0.7]];
      case 'cartons': return [[procKind(rnd() < 0.5 ? 'cartons' : 'carton', 'clutter', CUT.clutter), 1.1, 0.5]];
      case 'dumpsterSide': return [[procKind('dumpster', 'small', CUT.small + 30), 1.95, 1.2]];
      case 'pallets': { const k = ['pallets_three', 'pallets_stack', 'pallet_one'][Math.floor(rnd() * 3)], D = { pallets_three: [1.8, 1.35], pallets_stack: [2.2, 1.6], pallet_one: [1.75, 1.2] }[k]; return [[S(k), D[0], D[1]]]; }
      case 'blocks': return rnd() < 0.5 ? [[S('cinder_pallet'), 1.05, 1.85]] : [[S('cement_bags'), 2.0, 1.9]];
      case 'cones': return [[procKind('cone', 'small', CUT.small - 80), 0.45, 0.4], [procKind('cone', 'small', CUT.small - 80), 0.45, 0.4], [procKind('cone', 'small', CUT.small - 80), 0.45, 0.4]];
    }
    return [];
  }
  const rubbishKinds = () => [['can', 3], ['bottle', 2], ['paper', 3], ['sheet', 1.5], ['bag', 1.5], ['tyre', 0.25]];
  function litter(rnd, x, z, R, n, paved, keep) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (!clear(px, pz, 0.12, paved) || (keep && !keep(px, pz))) continue;
      const id = pickW(rnd, rubbishKinds());
      put(procKind(id, 'rubbish', id === 'tyre' ? CUT.clutter : CUT.rubbish, { shadowTo: 0 }), px, pz, rnd() * 6.283, { tilt: true, tint: pickTint(rnd, id), lift: 0.005 });
    }
  }
  const people = () => {
    const PR = propReg(); if (!PR) return [];
    return ['person_andrew', 'person_john', 'person_charles', 'person_luke', 'person_koky'].filter(k => PR.props[k]);
  };
  function person(rnd, x, z, ry, paved, key) {
    const L = people(); if (!L.length) return false;
    if (!clear(x, z, 0.35, paved)) return false;
    const k = scanKind(key || L[Math.floor(rnd() * L.length)], 'people', CUT.people, 60000, { proc: 'figure', at: 90 });
    if (!k) return false;
    k.shadowTo = 60;
    const ok = put(k, x, z, ry, { tint: [0.92 + rnd() * 0.1, 0.92 + rnd() * 0.1, 0.92 + rnd() * 0.1] });
    if (ok) occupy(x, z, 0.35);
    return ok;
  }
  function group(rnd, x, z, n, paved) {
    // n people round a point, facing its middle (a conversation) - never the same scan twice in one group
    let k = 0; const a0 = rnd() * 6.283, L = people().slice();
    for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = L[i]; L[i] = L[j]; L[j] = t; }
    for (let i = 0; i < n; i++) { const a = a0 + i * 6.283 / n + (rnd() - 0.5) * 0.5, r = n === 1 ? 0 : 0.55 + rnd() * 0.2;
      if (person(rnd, x + Math.cos(a) * r, z + Math.sin(a) * r, Math.atan2(-Math.cos(a), -Math.sin(a)) + (n === 1 ? rnd() * 6.283 : 0), paved, L[i % L.length])) k++; }
    return k;
  }

  // THE HOUSE (and the outbuilding, the site item): its own frame from its group; the blockers its generator published
  // ONE STREAM A LAW (per thing, per law): a category's slider moves only its own kind - the dish on a wall does not
  // move because the clutter under it was switched off
  const streams = seed => k => PG.mulberry32(PG.hash32(seed >>> 0, PG.fnv(k)));
  function houseLife(h, seed) {
    const S = streams(seed);
    let rnd = S('clutter');
    const rL = S('litter');
    const st = h.built && h.built.stats; if (!st || !h.grp) return;
    const g = h.grp, px = g.position.x, py = g.position.y, pz = g.position.z, yaw = g.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw);
    const W = (lx, lz) => [px + lx * c + lz * s, pz - lx * s + lz * c];
    const occ = st.groundAO || [];
    // the walls: the largest rectangle the generator shaded the ground against, else its box
    let main = null;
    for (const o of occ) if (o.hx && (!main || o.hx * o.hz > main.hx * main.hz)) main = o;
    if (!main && st.bbox && isFinite(st.bbox.x0)) main = { x: (st.bbox.x0 + st.bbox.x1) / 2, z: (st.bbox.z0 + st.bbox.z1) / 2, hx: (st.bbox.x1 - st.bbox.x0) / 2, hz: (st.bbox.z1 - st.bbox.z0) / 2 };
    if (!main || main.hx < 1 || main.hz < 1) return;
    const plot = h.plot || {};
    const it = plot.rec || null;
    const cat = h.cat || plot.cat || (it && it.entry && it.entry.cat) || (st.role ? 'commercial' : 'residential');
    const hangar = (it && it.gen === 'HANGAR_GEN') || /hangar/.test(String((it && it.key) || ''));
    const theme = hangar ? 'hangar' : (plot.kind === 'harbour' && cat !== 'residential' ? 'industrial' : (RECIPES[cat] ? cat : (cat === 'landmark' || cat === 'sports' || it ? 'official' : 'residential')));   // a site item with a word of its own ('airport s') is an institution
    // what stands already (house frame): the rectangles and discs, the doors (2.4 m kept clear before each)
    const blocks = [];
    for (const o of occ) if (o !== main) blocks.push(o);
    const doors = (Array.isArray(st.doors) ? st.doors : []).filter(d => d && isFinite(d.x)).map(d => [d.x, d.z]);
    const blocked = (lx, lz, r) => {
      for (const d of doors) if (Math.hypot(d[0] - lx, d[1] - lz) < 2.4 + r) return true;
      for (const o of blocks) {
        if (o.r) { if (Math.hypot(o.x - lx, o.z - lz) < o.r + r + 0.1) return true; continue; }
        const cr = Math.cos(o.ry || 0), sr = Math.sin(o.ry || 0), dx = lx - o.x, dz = lz - o.z, ux = dx * cr - dz * sr, uz = dx * sr + dz * cr;
        if (Math.abs(ux) < o.hx + r + 0.1 && Math.abs(uz) < o.hz + r + 0.1) return true;
      }
      return false;
    };
    const Winv = (wx, wz) => { const dx = wx - px, dz = wz - pz; return [dx * c - dz * s, dx * s + dz * c]; };   // world -> the house frame
    const keep = (wx, wz) => { const l = Winv(wx, wz), du = l[0] - main.x, dv = l[1] - main.z, u = du * mc - dv * ms, v = du * ms + dv * mc;
      return !(Math.abs(u) < main.hx + 0.15 && Math.abs(v) < main.hz + 0.15) && !blocked(l[0], l[1], 0.1) && inPlot(wx, wz); };
    const inPlot = (wx, wz) => { if (!plot.poly || !plot.poly.length) return true; const L = host.frame().toLocal(wx, wz); return PG.inPoly(plot.poly, L[0], L[1]) && PG.sdPoly(plot.poly, L[0], L[1]) < -0.5; };
    const mr = main.ry || 0, mc = Math.cos(mr), ms = Math.sin(mr);
    const M2 = (u, v) => [main.x + u * mc + v * ms, main.z - u * ms + v * mc];      // the main rectangle's frame -> the house frame
    // the four walls: [u0, v0, along-u, along-v, out-u, out-v, length]
    const walls = [
      [-main.hx, main.hz, 1, 0, 0, 1, 2 * main.hx], [main.hx, -main.hz, -1, 0, 0, -1, 2 * main.hx],
      [main.hx, main.hz, 0, -1, 1, 0, 2 * main.hz], [-main.hx, -main.hz, 0, 1, -1, 0, 2 * main.hz],
    ];
    // which wall faces the road (the plot's frontage) - clutter goes to the others first
    const frontWall = (() => { if (!plot.n) return -1; const F = host.frame(); let best = -1, bd = -2;
      for (let i = 0; i < 4; i++) { const w = walls[i], o = M2(w[4], w[5]), o0 = M2(0, 0), ox = o[0] - o0[0], oz = o[1] - o0[1];
        const wx = ox * c + oz * s, wz = -ox * s + oz * c;   // house frame -> world rotation
        const l = [wx * Math.cos(F.yaw) - wz * Math.sin(F.yaw), wx * Math.sin(F.yaw) + wz * Math.cos(F.yaw)];   // world -> premises rotation
        const d = -(l[0] * plot.n[0] + l[1] * plot.n[1]); if (d > bd) { bd = d; best = i; } } return best; })();
    // THE OPENINGS (the generator's own: side, s0..s1 along the wall, y0..y1 over the house's origin): walls[i] is its
    // side [0, 2, 1, 3][i] and t along the wall is its s. Nothing is hung over a window or a door; nothing stands
    // before a door or a window that comes down to knee height (a shop front)
    const SIDE = [0, 2, 1, 3], opens = Array.isArray(st.openings) ? st.openings : [];
    const openAt = (wi, t, y0, y1, m) => opens.some(o => o.side === SIDE[wi] && t > o.s0 - m && t < o.s1 + m && y1 > o.y0 - m && y0 < o.y1 + m);
    const wallYaw = i => { const w = walls[i]; const o = M2(w[4], w[5]), o0 = M2(0, 0); return Math.atan2(o[0] - o0[0], o[1] - o0[1]) + yaw; };   // the world yaw that looks OUT of wall i
    // -- clutter against the walls (corners first)
    const nC = Math.round((theme === 'industrial' || theme === 'hangar' ? 2.5 + rnd() * 3 : theme === 'commercial' ? 1.5 + rnd() * 2 : 0.6 + rnd() * 2.2) * cfg.clutter * Math.min(2, Math.sqrt(main.hx * main.hz) / 5));
    let placed = 0, tries = 0;
    while (placed < nC && tries++ < nC * 6 + 6) {
      let wi = Math.floor(rnd() * 4); if (wi === frontWall && rnd() < 0.8) wi = (wi + 2) % 4;
      const w = walls[wi], L = w[6];
      const set = recipe(pickW(rnd, RECIPES[theme]), rnd).filter(q => q[0]);
      if (!set.length) continue;
      const span = set.reduce((a, q) => a + q[1], 0) + 0.1 * (set.length - 1);
      if (span > L - 0.6) continue;
      const corner = rnd() < 0.55;
      let t = corner ? (rnd() < 0.5 ? 0.25 : L - 0.25 - span) : 0.4 + rnd() * (L - 0.8 - span);
      const cand = [];
      let ok = true;
      for (const [k, wid, dep] of set) {
        const tu = t + wid / 2, off = 0.12 + dep / 2 + rnd() * 0.08;
        if (openAt(wi, tu, -1, 1.1, wid / 2 + 0.15)) { ok = false; break; }
        const hu = w[0] + w[2] * tu + w[4] * off, hv = w[1] + w[3] * tu + w[5] * off;
        const lp = M2(hu, hv);
        if (blocked(lp[0], lp[1], Math.max(wid, dep) / 2)) { ok = false; break; }
        const wp = W(lp[0], lp[1]);
        if (!inPlot(wp[0], wp[1]) || !clear(wp[0], wp[1], Math.max(wid, dep) / 2 - 0.05)) { ok = false; break; }
        cand.push([k, wp, wid, dep]);
        t += wid + 0.1;
      }
      if (!ok) continue;
      const ry = wallYaw(wi);   // its back to the wall, its front looking out
      for (const [k, wp, wid, dep] of cand) {
        put(k, wp[0], wp[1], ry + (rnd() - 0.5) * 0.35, { tilt: true, tint: k.levels[0].proc ? pickTint(rnd, k.levels[0].proc) : null });
        occupy(wp[0], wp[1], Math.max(wid, dep) / 2);
      }
      if (cfg.rubbish > 0 && rL() < 0.5 * cfg.rubbish) litter(rL, cand[0][1][0], cand[0][1][1], 1.6, 1 + Math.floor(rL() * 3 * cfg.rubbish), false, keep);
      placed++;
    }
    // -- the house's fuel: a propane pig or an oil tank along a gable (residential / shed)
    rnd = S('fuel');
    if ((theme === 'residential' || theme === 'shed') && cfg.small > 0 && rnd() < 0.55 * Math.min(1, cfg.small)) {
      const pig = rnd() < 0.45, k = procKind(pig ? 'pig' : 'oiltank', 'small', CUT.small + 30);
      for (const wi of [2, 3].sort(() => rnd() - 0.5)) {
        if (wi === frontWall) continue;
        const w = walls[wi], L = w[6], len = pig ? 3.0 : 1.7; if (L < len + 1) continue;
        const tu = L / 2 + (rnd() - 0.5) * (L - len - 0.6), off = (pig ? 1.4 : 0.55);
        const lp = M2(w[0] + w[2] * tu + w[4] * off, w[1] + w[3] * tu + w[5] * off);
        if (blocked(lp[0], lp[1], pig ? 1.5 : 0.9)) continue;
        const wp = W(lp[0], lp[1]); if (!inPlot(wp[0], wp[1]) || !clear(wp[0], wp[1], pig ? 1.4 : 0.85)) continue;
        put(k, wp[0], wp[1], wallYaw(wi), { tilt: false }); occupy(wp[0], wp[1], pig ? 1.5 : 0.9);   // its long axis (x) along the wall
        break;
      }
    }
    // -- the dish on the wall that faces the southern sky (world +z), just under the eaves; a TV aerial on the ridge
    const eave = isFinite(st.eaveY) ? st.eaveY : (st.bbox ? st.bbox.y1 * 0.7 : 3);
    rnd = S('dish');
    if (cfg.antennas > 0 && theme !== 'hangar' && rnd() < (theme === 'residential' ? 0.55 : 0.35) * Math.min(1.6, cfg.antennas)) {
      let bi = -1, bz = -2;
      for (let i = 0; i < 4; i++) { const zy = Math.cos(wallYaw(i)); if (zy > bz) { bz = zy; bi = i; } }
      const w = walls[bi], L = w[6];
      const top = opens.filter(o => o.side === SIDE[bi]).reduce((a, o) => Math.max(a, o.y1), 0);
      const dy = Math.min(eave - 0.4, Math.max(top + 0.45, eave - 0.9 - rnd() * 0.5));   // under the eaves, over the windows when there is room
      for (let k2 = 0; k2 < 8; k2++) {
        const tu = 0.6 + rnd() * (L - 1.2);
        if (openAt(bi, tu, dy - 0.3, dy + 0.35, 0.3)) continue;
        const lp = M2(w[0] + w[2] * tu + w[4] * 0.02, w[1] + w[3] * tu + w[5] * 0.02), wp = W(lp[0], lp[1]);
        put(procKind('dish', 'antennas', CUT.antennas), wp[0], wp[1], wallYaw(bi) + (rnd() - 0.5) * 0.25, { y: py + dy });
        break;
      }
    }
    rnd = S('aerial');
    if (cfg.antennas > 0 && isFinite(st.ridgeY) && st.pitch > 5 && theme !== 'hangar' && rnd() < 0.22 * Math.min(2, cfg.antennas)) {
      const side = rnd() < 0.5 ? -1 : 1, hx = main.x + side * (main.hx - 0.9);
      const ch = st.chimney; if (!(ch && isFinite(ch.x) && Math.abs(ch.x - hx) < 1.2)) {
        const wp = W(hx, main.z);
        put(procKind('tvant', 'antennas', CUT.antennas + 60), wp[0], wp[1], yaw + (rnd() - 0.5) * 0.6 + Math.PI, { y: py + st.ridgeY - 0.15 });
      }
    }
    // -- someone at a door (residential), a mailbox at the frontage
    rnd = S('door');
    if (cfg.people > 0 && doors.length && rnd() < (theme === 'commercial' ? 0.35 : 0.12) * cfg.people) {
      const d = doors[Math.floor(rnd() * doors.length)];
      const ox = d[0] - main.x, oz = d[1] - main.z, L = Math.hypot(ox, oz) || 1, lp = [d[0] + ox / L * 1.6, d[1] + oz / L * 1.6];
      if (!blocked(lp[0], lp[1], 0.3)) { const wp = W(lp[0], lp[1]); if (inPlot(wp[0], wp[1])) group(rnd, wp[0], wp[1], rnd() < 0.3 ? 2 : 1); }
    }
    rnd = S('mailbox');
    if (plot.front && plot.tg && plot.n && theme === 'residential' && cfg.small > 0 && rnd() < 0.7 * Math.min(1, cfg.small)) {
      const F = host.frame(), sd = (rnd() < 0.5 ? -1 : 1) * (2.2 + rnd() * 2.0);
      const lx = plot.front[0] + plot.tg[0] * sd + plot.n[0] * 0.7, lz = plot.front[1] + plot.tg[1] * sd + plot.n[1] * 0.7;
      const wp = F.toWorld(lx, lz);
      if (offRoad(lx, lz, 0.4) && clear(wp[0], wp[1], 0.3)) { put(procKind('mailbox', 'small', CUT.small - 70), wp[0], wp[1], Math.atan2(-plot.n[0], -plot.n[1]) + F.yaw, { tint: pickTint(rnd, 'mailbox') }); occupy(wp[0], wp[1], 0.3); }
    }
    rnd = S('frontage');
    if (plot.front && plot.tg && plot.n && cfg.people > 0 && rnd() < (theme === 'commercial' ? 0.3 : 0.14) * cfg.people) {
      const F = host.frame(), sd = (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * 3), lx = plot.front[0] + plot.tg[0] * sd + plot.n[0] * 1.2, lz = plot.front[1] + plot.tg[1] * sd + plot.n[1] * 1.2;
      if (offRoad(lx, lz, 0.6)) { const wp = F.toWorld(lx, lz); group(rnd, wp[0], wp[1], rnd() < 0.6 ? 2 : (rnd() < 0.5 ? 3 : 1)); }
    }
    // -- a dumpster behind a shop or a works
    rnd = S('dumpster');
    if ((theme === 'commercial' || theme === 'industrial') && cfg.small > 0 && rnd() < 0.6 * Math.min(1, cfg.small)) {
      const bw = frontWall >= 0 ? [1, 0, 3, 2][frontWall] : Math.floor(rnd() * 4), w = walls[bw];
      const tu = 1.2 + rnd() * Math.max(0.1, w[6] - 2.4), lp = M2(w[0] + w[2] * tu + w[4] * 1.6, w[1] + w[3] * tu + w[5] * 1.6);
      const wp = W(lp[0], lp[1]);
      if (!blocked(lp[0], lp[1], 1.1) && inPlot(wp[0], wp[1]) && clear(wp[0], wp[1], 1.1)) { put(procKind('dumpster', 'small', CUT.small + 30), wp[0], wp[1], wallYaw(bw) + Math.PI, { tint: pickTint(rnd, 'dumpster'), tilt: true }); occupy(wp[0], wp[1], 1.1);
        if (cfg.rubbish > 0) litter(rL, wp[0], wp[1], 2.5, Math.round((2 + rL() * 4) * cfg.rubbish), false, keep); }
    }
    // -- the yard's odd bit of rubbish
    if (cfg.rubbish > 0 && rL() < 0.5 * cfg.rubbish) { const a = rL() * 6.283, r = Math.max(main.hx, main.hz) + 2 + rL() * 5, lp = [main.x + Math.cos(a) * r, main.z + Math.sin(a) * r], wp = W(lp[0], lp[1]); if (inPlot(wp[0], wp[1])) litter(rL, wp[0], wp[1], 1.5, 1 + Math.floor(rL() * 2 * cfg.rubbish), false, keep); }
  }

  // THE ROADS: the shoulder's rubbish, the signs, the parked cars in a zone, someone walking
  function roadLife(rd, seed, zones, plots) {
    const S = streams(seed);
    let rnd = S('litter');
    const F = host.frame(), pr = PG.polyRoad(rd.pts, rd.w), L = pr.length, w = rd.w || 4;
    if (w >= 13 || L < 20) return;            // a taxiway (24 m) is the apron's, not a street
    const inZone = (x, z) => zones.some(zn => PG.inPoly(zn.poly, x, z));
    const nearFront = (x, z, m) => plots.some(p => p.front && Math.hypot(p.front[0] - x, p.front[1] - z) < m);
    const nearPlot = (x, z, m) => plots.some(p => p.poly && Math.abs(p.front ? p.front[0] - x : 0) < 60 && Math.abs(p.front ? p.front[1] - z : 0) < 60 && PG.sdPoly(p.poly, x, z) < m);
    // rubbish: ~1.5 a 100 m in a zone, 0.3 outside
    if (cfg.rubbish > 0) for (let s = rnd() * 20; s < L; s += 8 + rnd() * 12) {
      const a = pr.at(s), z1 = inZone(a.p[0], a.p[1]);
      if (rnd() > (z1 ? 0.2 : 0.04) * cfg.rubbish) continue;
      const side = rnd() < 0.5 ? -1 : 1, off = w / 2 + 0.3 + rnd() * 1.6, lx = a.p[0] + a.n[0] * off * side, lz = a.p[1] + a.n[1] * off * side, wp = F.toWorld(lx, lz);
      litter(rnd, wp[0], wp[1], 0.8, 1 + (rnd() < 0.3 ? 1 : 0), true);
    }
    // signs: at each end, facing the traffic that arrives there, and every ~600 m
    rnd = S('signs');
    if (cfg.small > 0) {
      const at = [[14, 1], [L - 14, -1]];
      for (let s = 600; s < L - 300; s += 550 + rnd() * 150) at.push([s, rnd() < 0.5 ? 1 : -1]);
      for (const [s, dir] of at) {
        if (rnd() > 0.8 * Math.min(1, cfg.small)) continue;
        const a = pr.at(s), off = w / 2 + 1.3, rx = -a.tg[1] * dir, rz = a.tg[0] * dir;          // the right-hand side of the arriving traffic
        const lx = a.p[0] + rx * off, lz = a.p[1] + rz * off, wp = F.toWorld(lx, lz);
        if (!clear(wp[0], wp[1], 0.4, true) || nearPlot(lx, lz, 0.2)) continue;
        put(procKind(rnd() < 0.6 ? 'signSpeed' : 'signWarn', 'small', CUT.small + 80), wp[0], wp[1], Math.atan2(-a.tg[0] * dir, -a.tg[1] * dir) + F.yaw);
        occupy(wp[0], wp[1], 0.4);
      }
    }
    // parked cars: in a zone, on the shoulder, every 25-60 m on a chance, never before a frontage (a drive)
    rnd = S('cars');
    const HG = window.HOUSE_GEN, PR = propReg();
    const menu = HG && HG.AUTO_KEYS && PR ? HG.AUTO_KEYS(['car', 'pickup', 'suv', 'van']).filter(k => PR.props[k]) : [];
    if (cfg.cars > 0 && menu.length) for (let s = 10 + rnd() * 20; s < L - 10; s += 25 + rnd() * 35) {
      const a = pr.at(s);
      if (!inZone(a.p[0], a.p[1]) || rnd() > 0.45 * cfg.cars) continue;
      const side = rnd() < 0.5 ? -1 : 1, key = menu[Math.floor(rnd() * menu.length)], K = (HG.YARD_KIT || {})[key] || { L: 4.5, W: 1.8 };
      const off = w / 2 + K.W / 2 + 0.25, lx = a.p[0] + a.n[0] * off * side, lz = a.p[1] + a.n[1] * off * side;
      if (nearFront(lx, lz, 6) || nearPlot(lx, lz, K.W / 2 + 0.3)) continue;
      const wp = F.toWorld(lx, lz);
      if (!clear(wp[0], wp[1], K.L / 2, true)) continue;
      const dir = side > 0 ? 1 : -1, ry = Math.atan2(a.tg[0] * dir, a.tg[1] * dir) + F.yaw;   // parked the way its side's traffic runs
      const k = scanKind(key, 'cars', CUT.cars, 0, { proc: 'carBody', at: 120 });
      if (k && put(k, wp[0], wp[1], ry, { tilt: true })) { occupy(wp[0], wp[1], K.L / 2); CARS.push({ x: wp[0], z: wp[1], yaw: ry, L: K.L, W: K.W, H: K.H || 1.6 }); }
    }
    // someone on the shoulder, in a zone
    rnd = S('people');
    if (cfg.people > 0) for (let s = rnd() * 80; s < L; s += 60 + rnd() * 90) {
      const a = pr.at(s); if (!inZone(a.p[0], a.p[1]) || rnd() > 0.5 * cfg.people) continue;
      const side = rnd() < 0.5 ? -1 : 1, off = w / 2 + 0.7 + rnd() * 0.8, lx = a.p[0] + a.n[0] * off * side, lz = a.p[1] + a.n[1] * off * side, wp = F.toWorld(lx, lz);
      if (nearPlot(lx, lz, 0.3)) continue;
      group(rnd, wp[0], wp[1], rnd() < 0.35 ? 2 : 1, true);
    }
  }
  const CARS = [];

  // THE APRONS: the edge's clutter (drums, jerrycans, tyres, cones), people round the parked aeroplanes
  function apronLife(poly, rnd, craft) {
    const F = host.frame();
    const A = Math.abs(PG.polyArea(poly));
    if (A < 200) return;
    const ccw = PG.polyArea(poly) > 0;
    const nearCraft = (wx, wz, m) => craft.some(c => Math.hypot(c.x - wx, c.z - wz) < m);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 8) continue;
      const tg = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], inn = ccw ? [-tg[1], tg[0]] : [tg[1], -tg[0]];
      for (let s = 3 + rnd() * 10; s < L - 3; s += 14 + rnd() * 18) {
        if (rnd() > 0.35 * cfg.clutter) continue;
        const lx = a[0] + tg[0] * s + inn[0] * 1.6, lz = a[1] + tg[1] * s + inn[1] * 1.6;
        if (!PG.inPoly(poly, lx, lz) || !offRoad(lx, lz, 1)) continue;
        const wp = F.toWorld(lx, lz); if (nearCraft(wp[0], wp[1], 12)) continue;
        const set = recipe(pickW(rnd, RECIPES.hangar), rnd).filter(q => q[0]);
        const ry = Math.atan2(-inn[0], -inn[1]) + F.yaw;
        let t = 0;
        for (const [k, wid, dep] of set) {
          const x2 = lx + tg[0] * t, z2 = lz + tg[1] * t, w2 = F.toWorld(x2, z2);
          if (!clear(w2[0], w2[1], Math.max(wid, dep) / 2, true)) break;
          put(k, w2[0], w2[1], ry + (rnd() - 0.5) * 0.4, { tilt: true }); occupy(w2[0], w2[1], Math.max(wid, dep) / 2); t += wid + 0.1;
        }
      }
      // a line of cones at a corner
      if (cfg.small > 0 && rnd() < 0.3 * Math.min(1.5, cfg.small)) {
        const n = 3 + Math.floor(rnd() * 3);
        for (let j = 0; j < n; j++) { const lx = a[0] + tg[0] * (4 + j * 2.2) + inn[0] * 3.5, lz = a[1] + tg[1] * (4 + j * 2.2) + inn[1] * 3.5, wp = F.toWorld(lx, lz);
          if (PG.inPoly(poly, lx, lz) && clear(wp[0], wp[1], 0.25, true) && !nearCraft(wp[0], wp[1], 8)) { put(procKind('cone', 'small', CUT.small - 80), wp[0], wp[1], rnd() * 6.283); occupy(wp[0], wp[1], 0.25); } }
      }
    }
    if (cfg.rubbish > 0) { const n = Math.round(A / 900 * cfg.rubbish * rnd()); for (let i = 0; i < n; i++) { const e = poly[Math.floor(rnd() * poly.length)], lx = e[0] * 0.85 + PG.polyCentroid(poly)[0] * 0.15, lz = e[1] * 0.85 + PG.polyCentroid(poly)[1] * 0.15, wp = F.toWorld(lx, lz); litter(rnd, wp[0], wp[1], 3, 1, true); } }
  }
  function craftLife(c, rnd) {
    // one or two people by a parked aeroplane: at its side, 4-7 m off its middle, looking at it
    if (cfg.people <= 0 || rnd() > 0.7 * cfg.people) return;
    const a = c.yaw + (rnd() < 0.5 ? 1 : -1) * (Math.PI / 2 + (rnd() - 0.5) * 0.9), r = 5.8 + rnd() * 2.5;
    const x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r;
    group(rnd, x, z, rnd() < 0.5 ? 2 : 1, true);   // on the apron
  }

  // THE MASTS: one by each settlement (a zone of houses), on the highest free ground 150-500 m out; one by each
  // aerodrome, 60-140 m from its site, clear of the runway's funnel (150 m either side of the centreline, 600 m
  // past the ends)
  const MASTS = [];
  function mastAt(rnd, x, z, h) {
    const k = procKind('mast', 'antennas', 6000, { shadowTo: 400 }), sh = procKind('shelter', 'antennas', 900, { shadowTo: 150 });
    const s = h / 30;
    put(k, x, z, rnd() * 6.283, { sy: s, s: 1 });
    const a = rnd() * 6.283; put(sh, x + Math.cos(a) * 4.2, z + Math.sin(a) * 4.2, a + Math.PI / 2, { tilt: false });
    occupy(x, z, 3); MASTS.push({ x, z, h, y: host.heightAt(x, z) });
  }
  let APRONS = [], BUILT = [];
  function clearAround(x, z, R) { if (!clear(x, z, 3)) return false; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (!clear(x + Math.cos(a) * R, z + Math.sin(a) * R, 1.6)) return false; } return true; }
  function freeForMast(lx, lz, runways) {
    if (!offRoad(lx, lz, 25)) return false;
    for (const p of APRONS) if (PG.inPoly(p, lx, lz) || PG.sdPoly(p, lx, lz) < 25) return false;
    const w = host.frame().toWorld(lx, lz);
    for (const b of BUILT) if (Math.hypot(b[0] - w[0], b[1] - w[1]) < 40) return false;
    for (const m of MASTS) if (Math.hypot(m.x - w[0], m.z - w[1]) < 700) return false;
    for (const r of runways) if (PG.inPoly(PG.runwayBox(r, 150), lx, lz)) return false;
    return true;
  }
  function mastLife(rnd, zones, runways, plots, sites) {
    if (cfg.antennas <= 0) return;
    const F = host.frame();
    const nearPlot = (x, z) => plots.some(p => p.front && Math.hypot(p.front[0] - x, p.front[1] - z) < 45);
    for (const st of sites) {
      if (rnd() > Math.min(1, 0.9 * cfg.antennas)) continue;
      for (let i = 0; i < 60; i++) {
        const a = rnd() * 6.283, r = 70 + rnd() * 90, lx = st.x + Math.cos(a) * r, lz = st.z + Math.sin(a) * r, wp = F.toWorld(lx, lz);
        if (!freeForMast(lx, lz, runways) || !clearAround(wp[0], wp[1], 7) || host.heightAt(wp[0], wp[1]) < wet(wp[0], wp[1]) + 2) continue;
        mastAt(rnd, wp[0], wp[1], 18 + rnd() * 8); break;
      }
    }
    for (const zn of zones) {
      if (!/residential|commercial|harbour|industrial/.test(zn.kind) || rnd() > Math.min(1, 0.9 * cfg.antennas)) continue;
      const c = PG.polyCentroid(zn.poly);
      let best = null, bh = -Infinity;
      for (let i = 0; i < 40; i++) {
        const a = rnd() * 6.283, r = 150 + rnd() * 350, lx = c[0] + Math.cos(a) * r, lz = c[1] + Math.sin(a) * r, wp = F.toWorld(lx, lz), gy = host.heightAt(wp[0], wp[1]);
        if (!isFinite(gy) || gy < wet(wp[0], wp[1]) + 3 || !freeForMast(lx, lz, runways) || nearPlot(lx, lz) || !clearAround(wp[0], wp[1], 7)) continue;
        if (gy > bh) { bh = gy; best = wp; }
      }
      if (best) mastAt(rnd, best[0], best[1], 26 + rnd() * 14);
    }
  }

  // THE STAND: every law over what is built, from the seed; the items packed into cells
  function place() {
    const t0 = performance.now();
    LIST = []; OCCG = new Map(); CARS.length = 0; MASTS.length = 0;
    dropObstacles();
    if (!cfg.on) { pack(); stats.placeMs = performance.now() - t0; return; }
    if (!KIT) KIT = buildKit(T);
    const rec = host.record() || {}, seed = PG.hash32((rec.seed | 0) + 1, (cfg.seed | 0) * 7919 + 17);
    const zones = (host.zones() || []).filter(z => z.poly && z.poly.length > 2);
    const plots = host.plots() || [];
    const runways = host.runways() || [];
    ROADS = (host.roads() || []).filter(r => r.pts && r.pts.length > 1).map(r => { const bb = PG.polyBBox ? PG.polyBBox(r.pts) : null; const cx = bb ? (bb.x0 + bb.x1) / 2 : r.pts[0][0], cz = bb ? (bb.z0 + bb.z1) / 2 : r.pts[0][1];
      const R = bb ? Math.hypot(bb.x1 - bb.x0, bb.z1 - bb.z0) / 2 : 1e9; return Object.assign({}, r, { cx, cz, R }); });
    const craft = host.aircraft() || [];
    // what stands already is occupied: the parked aeroplanes
    for (const c of craft) occupy(c.x, c.z, 4.5);   // the fuselage's reach (a wing tip is walked round, not into)
    for (const ob of (host.objects ? host.objects() : [])) occupy(ob.x, ob.z, ob.r);   // what the record placed by hand (a prop, a board, a herd)
    const houses = host.houses();
    APRONS = host.aprons() || [];
    BUILT = []; if (houses) for (const [, h] of houses) if (h && h.grp && h.grp.position) BUILT.push([h.grp.position.x, h.grp.position.z]);
    const sites = [];
    if (houses) for (const [id, h] of houses) {
      if (!h || h.failed || !h.grp || !h.built) continue;
      try { houseLife(h, PG.hash32(seed, PG.fnv(String(id)))); } catch (e) { console.warn('life: house', id, e && e.message); }
      const ob = h.plot && h.plot.out;   // the outbuilding: placed as placeBuilt places it (the frame's yaw on the house's)
      if (ob && ob.built && isFinite(ob.x)) { const F = host.frame(), w = F.toWorld(ob.x, ob.z);
        try { houseLife({ built: ob.built, grp: { position: { x: w[0], y: ob.y || 0, z: w[1] }, rotation: { y: (ob.yaw || 0) + F.yaw } }, plot: h.plot, cat: 'shed' }, PG.hash32(seed, PG.fnv('out:' + id))); } catch (e) { console.warn('life: outbuilding', id, e && e.message); } }
    }
    for (const rd of ROADS) { try { roadLife(rd, PG.hash32(seed, PG.fnv('r:' + rd.id)), zones, plots); } catch (e) { console.warn('life: road', rd.id, e && e.message); } }
    for (const [i, ap] of (host.aprons() || []).entries()) { try { apronLife(ap, PG.mulberry32(PG.hash32(seed, PG.fnv('a:' + i))), craft); } catch (e) { console.warn('life: apron', e && e.message); } }
    for (const [i, c] of craft.entries()) craftLife(c, PG.mulberry32(PG.hash32(seed, PG.fnv('c:' + i))));
    for (const s of (host.sites() || [])) sites.push(s);
    try { mastLife(PG.mulberry32(PG.hash32(seed, 0x6d617374)), zones, runways, plots, sites); } catch (e) { console.warn('life: masts', e && e.message); }
    pack();
    addObstacles();
    stats.placeMs = performance.now() - t0;
  }
  function pack() {
    const n = LIST.length;
    IT = { n, M: new Float32Array(n * 16), kind: new Uint16Array(n), tint: new Float32Array(n * 3), cat: new Array(n), cells: new Map() };
    const byCat = {};
    for (let i = 0; i < n; i++) {
      const it = LIST[i];
      IT.M.set(it.m, i * 16); IT.kind[i] = it.k; IT.cat[i] = it.cat;
      const t = it.t || [1, 1, 1]; IT.tint[i * 3] = t[0]; IT.tint[i * 3 + 1] = t[1]; IT.tint[i * 3 + 2] = t[2];
      byCat[it.cat] = (byCat[it.cat] || 0) + 1;
      const key = Math.floor(it.m[12] / CELL) + ',' + Math.floor(it.m[14] / CELL);
      let c = IT.cells.get(key); if (!c) IT.cells.set(key, c = { x: (Math.floor(it.m[12] / CELL) + 0.5) * CELL, z: (Math.floor(it.m[14] / CELL) + 0.5) * CELL, far: 0, list: [] });
      c.list.push(i);
      const K = KINDS[it.k], far = K.levels[K.levels.length - 1].to; if (far > c.far) c.far = far;
    }
    for (const c of IT.cells.values()) c.list = Int32Array.from(c.list);
    LIST = [];
    stats.items = n; stats.byCat = byCat;
    // the bytes of every scan level used, on their way now (a level not landed is simply not drawn yet)
    const want = new Set();
    for (const K of KINDS) for (const l of K.levels) if (l.prop) want.add(l.prop); else if (l.mean) want.add(l.mean);
    for (const k of want) if (typeof propReady === 'function' && !propReady(k) && typeof propWarm === 'function') propWarm(k).then(() => { dirtyDraw = true; }).catch(() => {});
    dirtyDraw = true;
  }
  // the masts and the parked cars are solid (the aeroplane can hit them); nothing smaller is
  function addObstacles() {
    const R = host.obstacles && host.obstacles(); if (!R || typeof OBSTACLES === 'undefined') return;
    try {
      for (const m of MASTS) lastObst.push(R.add({ x: m.x, z: m.z, yaw: 0, y0: m.y, shape: OBSTACLES.box(2.6, 2.6, m.h + 2, 0.5), tag: 'mast' }));
      for (const c of CARS) lastObst.push(R.add({ x: c.x, z: c.z, yaw: c.yaw, y0: host.heightAt(c.x, c.z), shape: OBSTACLES.box(c.L, c.W, c.H, 0.5), tag: 'car' }));
    } catch (e) { console.warn('life: obstacles', e && e.message); }
  }
  function dropObstacles() { const R = host.obstacles && host.obstacles(); if (R) for (const id of lastObst) if (id) R.remove(id); lastObst = []; }

  // ---- the draw: per level per part, one InstancedMesh (a scan) or a slot of the BatchedMesh (a piece) -----------
  const BATCH = new Map();                          // 'key#part' -> { geo, mat, mesh, cap, idx: [] , shadow }
  let PROC = null;                                  // { cast: {mesh, cap, geoId: Map}, flat: {...} }
  let dirtyDraw = true;
  const procMat = () => { const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05, side: T.DoubleSide }); m.name = 'life:kit'; return m; };
  function procSet(shadow) {
    const ids = Object.keys(KIT);
    let nv = 0; for (const k of ids) nv += KIT[k].attributes.position.count;
    return { shadow, mesh: null, cap: 0, nv, geoId: new Map(), list: [], mat: null };
  }
  function procEnsure(P, n) {
    if (P.mesh && n <= P.cap) return;
    if (P.mesh) { root.remove(P.mesh); P.mesh.dispose(); }
    P.cap = Math.max(64, n * 2);
    if (!P.mat) P.mat = procMat();
    const M = new T.BatchedMesh(P.cap, P.nv, 0, P.mat);
    M.name = 'life:pieces' + (P.shadow ? ':cast' : ''); M.castShadow = P.shadow; M.receiveShadow = true; M.frustumCulled = false; M.matrixAutoUpdate = false;
    M.sortObjects = false; M.perObjectFrustumCulled = true;
    P.geoId = new Map();
    for (const k of Object.keys(KIT)) P.geoId.set(k, M.addGeometry(KIT[k]));
    for (let i = 0; i < P.cap; i++) { const id = M.addInstance(P.geoId.get('farBox')); M.setVisibleAt(id, false); }
    P.mesh = M; root.add(M);
  }
  function batchOf(levelKey, part) {
    const id = levelKey + '#' + part;
    let b = BATCH.get(id);
    if (b) return b;
    if (typeof propReady !== 'function' || !propReady(levelKey)) return null;
    const built = propBuild(T, levelKey);
    if (part >= built.geos.length) return null;
    b = { id, geo: built.geos[part], mat: built.mats[part], mesh: null, cap: 0, idx: [], shadow: false };
    BATCH.set(id, b);
    return b;
  }
  const colTmp = new T.Color(), SCL = new T.Matrix4();
  function draw(eye) {
    const t0 = performance.now();
    for (const b of BATCH.values()) { b.idx.length = 0; b.shadow = false; }
    if (!PROC && KIT) PROC = { cast: procSet(true), flat: procSet(false) };
    if (PROC) { PROC.cast.list.length = 0; PROC.flat.list.length = 0; }
    const K = reach();
    let vis = 0;
    if (cfg.on && IT.n) {
      const ex = eye.x, ey = eye.y, ez = eye.z, cr = CELL * 0.71;
      for (const c of IT.cells.values()) {
        const dc = Math.hypot(c.x - ex, c.z - ez) - cr;
        if (dc > c.far * K) continue;
        for (let j = 0; j < c.list.length; j++) {
          const i = c.list[j], o = i * 16, kd = KINDS[IT.kind[i]];
          const dx = IT.M[o + 12] - ex, dy = IT.M[o + 13] - ey, dz = IT.M[o + 14] - ez, d = Math.sqrt(dx * dx + dy * dy + dz * dz) / K;
          let L = null, from = 0;
          for (const l of kd.levels) { if (d < l.to) { L = l; break; } from = l.to; }
          if (!L) continue;
          const shadow = from * K < kd.shadowTo;
          if (L.proc) {
            const P = shadow ? PROC.cast : PROC.flat;
            P.list.push(i, L);
          } else {
            for (let part = 0; ; part++) { const b = batchOf(L.prop, part); if (!b) break; b.idx.push(i); if (shadow) b.shadow = true; }
          }
          vis++;
        }
      }
    }
    // the scans
    let draws = 0;
    for (const b of BATCH.values()) {
      const n = b.idx.length;
      if (n > b.cap) {
        if (b.mesh) { root.remove(b.mesh); b.mesh.dispose(); }
        b.cap = Math.max(16, n * 2);
        b.mesh = new T.InstancedMesh(b.geo, b.mat, b.cap);
        b.mesh.name = 'life:' + b.id; b.mesh.receiveShadow = true; b.mesh.frustumCulled = false; b.mesh.matrixAutoUpdate = false;
        b.mesh.userData.sharedGeo = true;
        b.mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(b.cap * 3).fill(1), 3);
        root.add(b.mesh);
      }
      if (!b.mesh) continue;
      const a = b.mesh.instanceMatrix.array, ca = b.mesh.instanceColor.array;
      for (let k = 0; k < n; k++) { const i = b.idx[k]; a.set(IT.M.subarray(i * 16, i * 16 + 16), k * 16); ca[k * 3] = IT.tint[i * 3]; ca[k * 3 + 1] = IT.tint[i * 3 + 1]; ca[k * 3 + 2] = IT.tint[i * 3 + 2]; }
      b.mesh.count = n; b.mesh.visible = n > 0; b.mesh.castShadow = b.shadow;
      b.mesh.instanceMatrix.needsUpdate = true; b.mesh.instanceColor.needsUpdate = true;
      if (n) draws++;
    }
    // the pieces: the visible ones in the first slots, the rest hidden
    let pv = 0;
    if (PROC) for (const P of [PROC.cast, PROC.flat]) {
      const n = P.list.length / 2;
      if (!n && !P.mesh) continue;
      procEnsure(P, n);
      const M = P.mesh;
      for (let k = 0; k < n; k++) {
        const i = P.list[k * 2], L = P.list[k * 2 + 1];
        M.setGeometryIdAt(k, P.geoId.get(L.proc));
        if (L.dims) { // a far stand-in: the unit box / cylinder scaled to the scan's size, in the scan's mean colour
          TMP.m.fromArray(IT.M, i * 16); TMP.m.multiply(SCL.makeScale(L.dims[0], L.dims[1], L.dims[2])); M.setMatrixAt(k, TMP.m);
          const mc = meanOf(L.mean); colTmp.setRGB(mc[0], mc[1], mc[2]);
        } else { TMP.m.fromArray(IT.M, i * 16); M.setMatrixAt(k, TMP.m); colTmp.setRGB(IT.tint[i * 3], IT.tint[i * 3 + 1], IT.tint[i * 3 + 2]); }
        M.setColorAt(k, colTmp);
        M.setVisibleAt(k, true);
      }
      for (let k = n; k < P.cap; k++) M.setVisibleAt(k, false);
      if (P.lastN > n) for (let k = n; k < P.lastN; k++) M.setVisibleAt(k, false);
      P.lastN = n;
      M.visible = n > 0;
      if (n) draws++;
      pv += n;
    }
    stats.visible = vis; stats.procVisible = pv; stats.draws = draws; stats.batches = BATCH.size; stats.updMs = performance.now() - t0;
  }
  // the mast's red light: lit at dusk (the lamps' own hand), a glow by day
  let beacon = null;
  function beaconSync() {
    if (beacon) { root.remove(beacon); beacon.geometry.dispose(); beacon.material.dispose(); beacon = null; }
    if (!MASTS.length) return;
    const g = new T.SphereGeometry(0.18, 8, 6), m = new T.MeshStandardMaterial({ color: 0x300000, emissive: 0xff1a0a, emissiveIntensity: 1 });
    beacon = new T.InstancedMesh(g, m, MASTS.length);
    const M4 = new T.Matrix4();
    MASTS.forEach((q, i) => { M4.makeTranslation(q.x, q.y + q.h + 0.25, q.z); beacon.setMatrixAt(i, M4); });
    beacon.castShadow = false; beacon.frustumCulled = false; beacon.name = 'life:beacons'; root.add(beacon);
  }

  // ---- the clock ------------------------------------------------------------------------------------------------
  function tick() {
    frame++;
    if (owed && performance.now() >= owedAt && !(host.queued && host.queued() > 0)) {
      owed = false;
      try { place(); } catch (e) { console.warn('life: stand', e); }
      beaconSync();
      if (host.onTraffic) host.onTraffic();
    }
    const eye = host.eye && host.eye();
    if (!eye) return;
    if (beacon) { const on = host.lampsOn ? host.lampsOn() : 0; beacon.material.emissiveIntensity = cfg.on && cfg.antennas > 0 ? 0.6 + 7 * on : 0; beacon.visible = cfg.on && cfg.antennas > 0; }
    const moved = !lastEye || Math.abs(eye.x - lastEye.x) + Math.abs(eye.y - lastEye.y) + Math.abs(eye.z - lastEye.z) > 3;
    if (!moved && !dirtyDraw && frame % 20 !== 0) return;
    if (!lastEye) lastEye = eye.clone(); else lastEye.copy(eye);
    dirtyDraw = false;
    draw(eye);
  }
  function set(c) {
    const was = JSON.stringify(cfg);
    cfg = Object.assign({}, DEF, c || {});
    stats.on = !!cfg.on;
    root.visible = !!cfg.on;
    if (JSON.stringify(cfg) === was) return;
    owed = true; owedAt = performance.now() + 150;   // a slider's drag re-stands once it pauses
  }
  function dirty() { owed = true; owedAt = performance.now() + 300; }
  // TRAFFIC on a road the record left without: vehicles a km (taxiways, tracks and the short stubs excluded)
  function trafficOf(rd) {
    if (!cfg.on || !(cfg.traffic > 0) || !rd || rd.traffic > 0) return 0;
    if ((rd.w || 4) >= 13 || rd.cls === 'track' || /taxi/i.test(String(rd.id))) return 0;
    const pr = PG.polyRoad(rd.pts, rd.w); if (pr.length < 150) return 0;
    return 0.8 * cfg.traffic;
  }
  function dispose() {
    dropObstacles();
    for (const b of BATCH.values()) if (b.mesh) { root.remove(b.mesh); b.mesh.dispose(); }
    BATCH.clear();
    if (PROC) for (const P of [PROC.cast, PROC.flat]) if (P.mesh) { root.remove(P.mesh); P.mesh.dispose(); if (P.mat) P.mat.dispose(); }
    PROC = null;
    if (beacon) { root.remove(beacon); beacon.geometry.dispose(); beacon.material.dispose(); beacon = null; }
    if (KIT) for (const k in KIT) KIT[k].dispose();
    KIT = null;
    if (root.parent) root.parent.remove(root);
  }
  // the placed items of a category, world positions (a probe for scripts and the gate)
  function items(cat) {
    const out = [];
    for (let i = 0; i < IT.n; i++) if (!cat || IT.cat[i] === cat) out.push({ kind: KINDS[IT.kind[i]].id, cat: IT.cat[i], x: +IT.M[i * 16 + 12].toFixed(2), y: +IT.M[i * 16 + 13].toFixed(2), z: +IT.M[i * 16 + 14].toFixed(2) });
    return out;
  }
  // the stand NOW (the gate, a script): what tick does once the build queue is empty
  function standNow() { owed = false; place(); beaconSync(); return stats.items; }
  return { root, stats, set, dirty, tick, standNow, draw: e => draw(e), trafficOf, dispose, items, get cfg() { return Object.assign({}, cfg); }, masts: () => MASTS.slice(), kinds: () => KINDS.map(k => ({ id: k.id, cat: k.cat, levels: k.levels.map(l => (l.prop || l.proc) + '<' + l.to) })), redraw: () => { dirtyDraw = true; } };
}

window.SCENERY_LIFE = { make, DEF, CATS, CUT, TIER_DIST, buildKit };
})();
