// _tram_gen.js — THE AERIAL TRAMWAY'S TOP STATION (G342), a composite of the
// house generator the way the mill is (G329): the station houses are house
// builds, and the steel around them - the lattice mast, the deck it carries,
// the great curved saddle girder and its bull wheel, the raked strut, the
// passageway truss - is drawn into the same bags after.
//
// THE STRUCTURE, read off the Goldbelt tram's top terminal (Juneau) rather
// than its look:
//   THE TRUSS     (G347) one footing forward on the slope and two lattice
//                 legs opening upward from it like a V - the rear leg to
//                 the deck under the machine house, the front leg under the
//                 wings - four chords each, an X on every face of every
//                 panel, a laced tie between them. The rope pulls forward
//                 and down: the front leg takes it in compression.
//   THE DECK      two plate girders along the line on top of the mast,
//                 cantilevered forward toward the valley (the cabin docks
//                 under the tip) and back toward the ridge; cross beams, a
//                 floor plate; knee braces from the mast's chords carry the
//                 cantilevers. The station houses stand on it: the machine
//                 house at the back (two storeys), the middle house, the
//                 docking gallery at the tip - three staggered boxes, ribbon
//                 windows, no window into a joint.
//   THE SLOTS     (G347) the front of the station is three dock wings off
//                 the middle house - a centre wing and two outer wings -
//                 and the two slots between them are a cabin's width and a
//                 hand: the cabin comes in from the valley between the
//                 wings, docks on both sides, its floor the wings' floor.
//   THE GIRDERS   two arches, one over each line, braced into one (G347);
//                 the ropes come up from the valley at the line's angle and
//                 must bend over to go down to their anchors behind - a
//                 track rope cannot be bent sharply, so the saddle is a
//                 CURVED plate girder of large radius: it rises from the
//                 portal frame above the mast's rear, arches over the
//                 houses and noses down toward the valley. The track ropes
//                 ride its top surface (two saddle strips), tangent at the
//                 line's angle in front and at the anchor's angle behind.
//                 Stiffener ribs along it; a prop from the portal under the
//                 arch, two struts from the deck tips under the nose, where
//                 the rope load lands.
//   THE WHEELS    (G349) one bull wheel under each arch's nose, in the
//                 line's plane, the haul rope's bull wheel;
//                 hung under the nose so the rope arrives tangent to it at
//                 the line's angle: a rim, a hub, an axle, eight spokes, the
//                 hangers down from the girder. Both strands of the loop
//                 leave it down the line.
//   THE ANCHORS   (G347) each track rope leaves the back of its arch
//                 tangentially and runs as a cable to an anchor plate in
//                 the terminal house's front wall - the arch is a cantilever
//                 held back by the building behind it.
//   THE PASSAGE   an enclosed bridge back to the terminal house on the
//                 ridge, a house turned lengthways on a Warren truss with
//                 trestle bents to the ground where the ground is far.
//   THE DOCK      two guide frames hanging under the deck's tip, laced,
//                 where the cabin comes in.
//   THE HOOKS     stats.station.hooks: every rope's tangent point and
//                 direction (track ropes on the saddle, front and back; the
//                 haul rope's two strands off the wheel), the dock, so the
//                 cables and the cabins can be drawn later.
//
// The frame: +z is the valley (the ropes go down that way), -z the ridge,
// x across the line, the mast's footings at the origin's ground.
(() => {
const D2R = Math.PI / 180;

// a four-chord lattice column from a to b, its section hu x hv at a and
// hu2 x hv2 at b, an X on every face of every panel, a plan diaphragm
// every second - the tram's legs and anchor posts
function latticeColumn(ST, a, b, hu, hv, hu2, hv2, panel, lo, beamFn) {
  const { add, sub, mul, nrm, len, crs } = window.HOUSE_KIT;
  const axis = sub(b, a), Ll = len(axis), X = nrm(axis);
  let U = [1, 0, 0]; if (Math.abs(X[0]) > 0.9) U = [0, 0, 1];
  U = nrm(sub(U, mul(X, U[0] * X[0] + U[1] * X[1] + U[2] * X[2])));
  const V = nrm(crs(X, U));
  const corner = (t, su, sv) => { const c = add(a, mul(X, Ll * t)); const h1 = hu + (hu2 - hu) * t, h2 = hv + (hv2 - hv) * t; return add(add(c, mul(U, su * h1)), mul(V, sv * h2)); };
  for (const su of [-1, 1]) for (const sv of [-1, 1]) beamFn(ST, corner(0, su, sv), corner(1, su, sv), 0.14, 0.14, V);
  const nPan = Math.max(2, Math.round(Ll / panel));
  const ring = t => [corner(t, -1, 1), corner(t, 1, 1), corner(t, 1, -1), corner(t, -1, -1)];
  for (let k = 0; k <= nPan; k++) {
    const t = k / nPan, c = ring(t);
    for (let i = 0; i < 4; i++) beamFn(ST, c[i], c[(i + 1) % 4], 0.06, 0.06, V);
    if (k > 0) {
      const d = ring((k - 1) / nPan);
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; beamFn(ST, d[i], c[j], 0.05, 0.05, V); if (!lo) beamFn(ST, d[j], c[i], 0.05, 0.05, V); }
      if (k % 2 === 0 && !lo) { beamFn(ST, c[0], c[2], 0.05, 0.05, V); beamFn(ST, c[1], c[3], 0.05, 0.05, V); }
    }
  }
  return { X, U, V, L: Ll };
}

// a four-chord lattice column from a to b, its section hu x hv at a and
// hu2 x hv2 at b, an X on every face of every panel, a plan diaphragm
// every second - the tram's legs and anchor posts
function latticeColumn(ST, a, b, hu, hv, hu2, hv2, panel, lo, beamFn) {
  const { add, sub, mul, nrm, len, crs } = window.HOUSE_KIT;
  const axis = sub(b, a), Ll = len(axis), X = nrm(axis);
  let U = [1, 0, 0]; if (Math.abs(X[0]) > 0.9) U = [0, 0, 1];
  U = nrm(sub(U, mul(X, U[0] * X[0] + U[1] * X[1] + U[2] * X[2])));
  const V = nrm(crs(X, U));
  const corner = (t, su, sv) => { const c = add(a, mul(X, Ll * t)); const h1 = hu + (hu2 - hu) * t, h2 = hv + (hv2 - hv) * t; return add(add(c, mul(U, su * h1)), mul(V, sv * h2)); };
  for (const su of [-1, 1]) for (const sv of [-1, 1]) beamFn(ST, corner(0, su, sv), corner(1, su, sv), 0.14, 0.14, V);
  const nPan = Math.max(2, Math.round(Ll / panel));
  const ring = t => [corner(t, -1, 1), corner(t, 1, 1), corner(t, 1, -1), corner(t, -1, -1)];
  for (let k = 0; k <= nPan; k++) {
    const t = k / nPan, c = ring(t);
    for (let i = 0; i < 4; i++) beamFn(ST, c[i], c[(i + 1) % 4], 0.06, 0.06, V);
    if (k > 0) {
      const d = ring((k - 1) / nPan);
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; beamFn(ST, d[i], c[j], 0.05, 0.05, V); if (!lo) beamFn(ST, d[j], c[i], 0.05, 0.05, V); }
      if (k % 2 === 0 && !lo) { beamFn(ST, c[0], c[2], 0.05, 0.05, V); beamFn(ST, c[1], c[3], 0.05, 0.05, V); }
    }
  }
  return { X, U, V, L: Ll };
}

function buildStation(P, lod, F) {
  if (Math.round(P.station) === 2) return buildBase(P, lod, F);   // the base station (G346)
  const HG = window.HOUSE_GEN, K = window.HOUSE_KIT;
  const { add, sub, mul, nrm, len, crs, beam, cyl, face, boxAB } = K;
  const g = typeof P.ground === 'function' ? P.ground
    : (x, z) => -Math.tan(P.slopeX * D2R) * x - Math.tan(P.slopeZ * D2R) * z;
  const H = P.mastH;
  const deckY = H, zF = P.deckFront, zB = -P.deckBack, hw = P.deckW / 2;
  const floorY = deckY + 0.3;
  const lo = lod > 0;
  const fake = y => () => y;             // a house on the deck: its posts are stubs into the deck

  // ---- THE HOUSES: the machine house, the wide middle house, the dock wings, the passage, the terminal
  const wallSet = HG.SET_IDX('wall', 'boxprof'), roofSet = HG.SET_IDX('roof', 'galv');
  const box = (L, w, storeys, floorH, z, o) => Object.assign({
    L, w, storeys, floorH, floorY, stance: 0, skirt: 0, roofFam: 0, pitch: 7, eaveOver: 0.35, rakeOver: 0.25,
    hip: 0, door: 0, backDoor: 0, porch: 0, stairs: 0, chim: 0, gutter: 0, downpipe: 0, dormers: 0, gableWin: 0,
    winW: 1.35, winH: 1.05, winSill: 1.05, muntin: 0, curtains: 0, trimW: 0.08,
    wallSet, wallCol: 7, trimSet: HG.SET_IDX('trim', 'veneerpale'), trimCol: 6, roofSet, roofCol: 0,
    // a whisper of the factory's clouds on the station's walls (G349, "very subtle")
    weather: 0.5, dirt: 0.15, dirtH: 0.6, paintPunch: 0.2, clouds: P.clouds === undefined ? 0.2 : P.clouds, ribs: 0,
  }, o || {});
  const boxes = [];
  const parts = [];
  const houseAt = (tag, Pb, x, z, yaw, slot) => {
    const L = Pb.L, w = Pb.w, c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
    const hx = Math.abs(L / 2 * c) + Math.abs(w / 2 * s), hz = Math.abs(L / 2 * s) + Math.abs(w / 2 * c);
    const b = { tag, x, z, x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, y0: Pb.floorY, y1: Pb.floorY + Pb.storeys * Pb.floorH };
    boxes.push(b);
    parts.push({ tag, P: Pb, x, z, yaw: yaw || 0, box: b, slot: slot || 1, ground: Pb.groundFake ? fake(Pb.floorY - 0.25) : undefined });
    return b;
  };
  // THE SLOTS (G347): three dock wings off the middle house's front and the
  // two slots between them a cabin's width and a hand
  const dx = P.topDx, slotW = P.slotW, wingW = P.wingW, slotD = P.slotD;
  const cW = Math.max(1.2, 2 * (dx - slotW / 2)), midL = 2 * (dx + slotW / 2 + wingW);
  const rearL = P.houseL;
  // the machine house: one tall storey, so the arch can come down behind it
  houseAt('machine house', box(rearL, 6.6, 1, P.machineH, 0, { nFront: 6, nBack: 5, nLeft: 3, nRight: 3, winH: 1.4, winSill: 1.3, groundFake: 1 }), 0, -1.2, 0);
  const zMid = 2.1 + P.midW / 2;
  houseAt('middle house', box(midL, P.midW, 1, 3.5, 0, { nFront: 7, nBack: 0, nLeft: 2, nRight: 2, winH: 1.25, winSill: 1.0, groundFake: 1 }), 0, zMid, 0);
  const zWing0 = zMid + P.midW / 2, zWing = zWing0 + slotD / 2;
  const wing = (tag, x, w, nOut, nIn, yaw) => houseAt(tag, box(slotD, w, 1, 2.9, 0, { nFront: nOut, nBack: nIn, nLeft: 0, nRight: 0, winW: 1.2, winH: 1.2, winSill: 0.95, groundFake: 1, eaveOver: 0.25, rakeOver: 0.15 }), x, zWing, yaw);
  wing('centre wing', 0, cW, 2, 2, Math.PI / 2);
  wing('right wing', dx + slotW / 2 + wingW / 2, wingW, 2, 2, Math.PI / 2);
  wing('left wing', -(dx + slotW / 2 + wingW / 2), wingW, 2, 2, -Math.PI / 2);
  // the passageway (slot 3, its own cladding) from the machine house's back wall to the terminal's front wall
  const zT = -P.terminalZ, termL = 14, termW = 9.5;
  const zPass0 = boxes[0].z0 + 0.3, zPass1 = P.terminal ? zT + termW / 2 - 0.3 : zB - 12;
  const passL = P.passage ? zPass0 - zPass1 : 0;
  if (P.passage) houseAt('passageway', box(passL, 2.9, 1, 2.75, 0, { nFront: Math.round(passL / 2.4), nBack: Math.round(passL / 2.4), nLeft: 0, nRight: 0, winW: 1.5, winH: 1.15, winSill: 1.0, groundFake: 1, eaveOver: 0.25 }), 0, (zPass0 + zPass1) / 2, Math.PI / 2, 3);
  // THE TERMINAL HOUSE on the ridge (slot 2: the arrival station - a
  // restaurant, the tourist centre - painted, on the real ground)
  let termFloor = 0, termRidge = 0;
  if (P.terminal) {
    let gT = -1e9;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gT = Math.max(gT, g(sx * termL / 2, zT + sz * termW / 2));
    termFloor = gT + 0.45;
    termRidge = termFloor + 2 * 2.9 + 0.14 + termW / 2 * Math.tan(30 * D2R);
    houseAt('terminal house', {
      L: termL, w: termW, storeys: 2, floorH: 2.9, floorY: termFloor, stance: 1, skirt: 2, roofFam: 0, pitch: 30, eaveOver: 0.55, rakeOver: 0.4,
      nFront: 5, nBack: 4, nLeft: 2, nRight: 2, winW: 1.2, winH: 1.4, winSill: 0.9, muntin: 1, curtains: 0.3, door: 0, porch: 0, stairs: 1,
      chim: 1, chimR: 0.14, chimXF: -0.6, gutter: 1, downpipe: 1, backDoor: 1, backPorch: 1, dormers: 0, gableWin: 1,
      wallSet: HG.SET_IDX('wall', 'paintwood'), wallCol: 6, trimSet: HG.SET_IDX('trim', 'veneerpale'), trimCol: 2,
      roofSet: HG.SET_IDX('roof', 'galv'), roofCol: 0, postSet: HG.SET_IDX('post', 'rough'),
      weather: 0.6, dirt: 0.4, dirtH: 1.0, paintPunch: 0.5, clouds: 0.2,
    }, 0, zT, 0, 2);
  }
  for (const part of parts) {
    const c = Math.cos(part.yaw), s = Math.sin(part.yaw), me = part.box;
    part.P.winKeep = (lx, lz, y0, y1) => {
      const wx = lx * c + lz * s + part.x, wz = -lx * s + lz * c + part.z, y = (y0 + y1) / 2;
      return !boxes.some(b => b !== me && wx > b.x0 - 0.3 && wx < b.x1 + 0.3 && wz > b.z0 - 0.3 && wz < b.z1 + 0.3 && y > b.y0 - 0.3 && y < b.y1 + 0.3);
    };
  }

  // ---- THE STEEL, after the houses
  const S = { deckY, hooks: {}, kind: 'top', hang: P.hangH };
  const lamps = [];
  const extra = (bags, built, Q) => {
    const ST = bags.steel, GD = bags.girder, CO = bags.stone;
    const bm = (bag, a, b, w, t, up) => beam(bag, a, b, w, t, up || [0, 1, 0]);
    const gy0 = deckY - P.deckD, gy1 = deckY;
    // THE RAKED TRUSS (G347/G349, the user: "put its base point back higher
    // up on the mountain, so it forms an angle - like in italic"): one
    // footing BEHIND the machine house, up the slope, and from it two
    // lattice legs leaning forward - the rear leg to the deck under the
    // machine house, the front leg out to under the wings - a laced tie
    // between them. The deck is a cantilever off this foot, held back by
    // the cables into the terminal house.
    const zFoot = P.footZ, yFoot = g(0, zFoot), foot = [0, yFoot, zFoot];
    boxAB(CO, [-2.2, yFoot - 1.0, zFoot - 1.6], [2.2, yFoot + 0.5, zFoot + 1.6]);
    const legs = [{ zTop: P.legRearZ, tag: 'rear' }, { zTop: P.legFrontZ, tag: 'front' }];
    S.mast = { H, foot, legs: [] };
    const legAxes = [];
    for (const leg of legs) {
      const head = [0, gy0, leg.zTop], a = [0, yFoot + 0.5, zFoot];
      const lat = latticeColumn(ST, a, head, 0.55, 0.3, P.legW / 2, P.legD / 2, P.panel, lo, bm);
      boxAB(ST, [-P.legW / 2 - 0.2, gy0 - 0.5, leg.zTop - P.legD / 2 - 0.3], [P.legW / 2 + 0.2, gy0, leg.zTop + P.legD / 2 + 0.3]);
      S.mast.legs.push({ tag: leg.tag, head, L: lat.L, dir: lat.X });
      legAxes.push(lat);
    }
    {
      const a = add([0, yFoot + 0.5, zFoot], mul(legAxes[0].X, legAxes[0].L * 0.5)), b = add([0, yFoot + 0.5, zFoot], mul(legAxes[1].X, legAxes[1].L * 0.5));
      for (const sx of [-1, 1]) { bm(ST, add(a, [sx * 0.9, 0.35, 0]), add(b, [sx * 0.9, 0.35, 0]), 0.08, 0.08); bm(ST, add(a, [sx * 0.9, -0.35, 0]), add(b, [sx * 0.9, -0.35, 0]), 0.08, 0.08); }
      const n = Math.max(2, Math.round(len(sub(b, a)) / 1.8));
      for (let i = 0; i <= n; i++) { const p = add(a, mul(sub(b, a), i / n)); for (const sx of [-1, 1]) bm(ST, add(p, [sx * 0.9, -0.35, 0]), add(p, [sx * 0.9, 0.35, 0]), 0.05, 0.05); if (i < n) { const q = add(a, mul(sub(b, a), (i + 1) / n)); for (const sx of [-1, 1]) bm(ST, add(p, [sx * 0.9, i % 2 ? 0.35 : -0.35, 0]), add(q, [sx * 0.9, i % 2 ? -0.35 : 0.35, 0]), 0.04, 0.04); } }
    }
    // THE DECK: two girders along the line, cross beams (wider under the wings), the floor plate
    for (const sx of [-1, 1]) {
      const x = sx * hw;
      boxAB(ST, [x - 0.06, gy0, zB], [x + 0.06, gy1, zF]);
      boxAB(ST, [x - 0.22, gy1 - 0.08, zB], [x + 0.22, gy1, zF]);
      boxAB(ST, [x - 0.22, gy0, zB], [x + 0.22, gy0 + 0.08, zF]);
    }
    const xWide = midL / 2 + 0.2;
    for (let z = zB + 1.0; z < zF; z += 2.0) { const w = z > zMid - P.midW / 2 - 1 ? xWide : hw; bm(ST, [-w, gy0 + 0.3, z], [w, gy0 + 0.3, z], 0.12, 0.2); }
    for (const sx of [-1, 1]) boxAB(ST, [sx * xWide - 0.1, gy0 + 0.2, zMid - P.midW / 2 - 1], [sx * xWide + 0.1, gy0 + 0.5, zF]);
    boxAB(ST, [-hw - 0.3, gy1, zB], [hw + 0.3, gy1 + 0.06, zMid - P.midW / 2 - 1]);
    boxAB(ST, [-xWide - 0.1, gy1, zMid - P.midW / 2 - 1], [xWide + 0.1, gy1 + 0.06, zF]);
    bm(ST, [0, gy0 - 0.4, P.legRearZ], [0, gy0, zB + 0.5], 0.12, 0.14);
    for (const sx of [-1, 1]) { bm(ST, [sx * hw, gy0, zB + 0.5], [sx * hw, gy0 - 2.2, P.legRearZ], 0.1, 0.12); bm(ST, [sx * hw, gy0 - 2.2, P.legFrontZ], [sx * hw, gy0, zF - 0.5], 0.1, 0.12); }
    if (!lo) {
      const rail = (a, b) => {
        const n = Math.max(1, Math.round(len(sub(b, a)) / 1.6));
        for (let i = 0; i <= n; i++) { const p = add(a, mul(sub(b, a), i / n)); bm(ST, p, [p[0], p[1] + 1.05, p[2]], 0.02, 0.02); }
        for (const h of [0.55, 1.05]) bm(ST, [a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], 0.02, 0.02);
      };
      for (const sx of [-1, 1]) rail([sx * (hw + 0.2), gy1, zB], [sx * (hw + 0.2), gy1, zMid - P.midW / 2 - 1]);
    }
    // THE ARCHES, SOLVED FROM THE CABIN (G349, the user: "match the cable
    // height with the cabin height and the building height, so the cabin
    // slots in perfectly like now, but also rests on the actual cables"):
    // a docked cabin's floor is the wings' floor, its carriage sits `hangH`
    // over its floor origin, so the track rope over the dock is at yD; the
    // rope leaves the saddle `tanBack` metres up the line from the dock at
    // the line's angle; the arch's centre is then the tangent point less
    // the saddle radius along the radial. The arch comes down at the back
    // to the portal on the deck (its foot angle solved so the foot lands
    // at portalH over the deck when it can).
    const L = P.lineDeg * D2R, R = P.girderR, gw = P.girderW / 2, xt = P.trackX;
    // (G351: the dock's centre is where the cabin's PIVOT stands, `hangH` over its floor origin; the rope's contact line is `ropeUp` over the pivot square to the line, so over the dock's centre the rope is this - and a cabin facing either way docks with its pivot on the centre)
    const zD = zWing0 + 0.3 + P.cabinL / 2, yD = floorY - 0.2 + P.hangH + P.ropeUp / Math.cos(L);
    const depthAt = phi => P.girderD + (P.girderDn - P.girderD) * (phi - (-95 * D2R)) / (P.noseDeg * D2R + 95 * D2R);
    const Rs = R + depthAt(L) / 2 + 0.16;
    const Pt = [0, yD + P.tanBack * Math.sin(L), zD - P.tanBack * Math.cos(L)];
    const C = [0, Pt[1] - Rs * Math.cos(L), Pt[2] - Rs * Math.sin(L)];
    const yFootWant = H + P.portalH + 0.3;
    const phi0 = -Math.acos(K.clamp((yFootWant - C[1]) / R, -0.35, 0.99)), phi1 = Math.min(P.noseDeg, P.lineDeg + 14) * D2R;
    const A = (phi, x) => [x || 0, C[1] + R * Math.cos(phi), C[2] + R * Math.sin(phi)];
    const N = phi => [0, Math.cos(phi), Math.sin(phi)];
    const T = phi => [0, -Math.sin(phi), Math.cos(phi)];
    const depth = phi => P.girderD + (P.girderDn - P.girderD) * (phi - phi0) / (phi1 - phi0);
    const gFoot = A(phi0), pz = Math.max(zB + 0.5, gFoot[2]), pH = Math.max(0.6, gFoot[1] - 0.3 - H), top = xt + 0.4;
    // THE PORTAL FRAME on the deck at the arches' feet
    for (const sx of [-1, 1]) {
      bm(ST, [sx * top, H, pz], [sx * top, H + pH, pz], 0.15, 0.15);
      if (pH > 1.5) bm(ST, [sx * top, H + pH - 0.2, pz], [sx * top, H + 0.2, pz - 2.2], 0.08, 0.08);
    }
    bm(ST, [-top, H + pH, pz], [top, H + pH, pz], 0.16, 0.16);
    if (pH > 1.5) { bm(ST, [-top, H + 0.3, pz], [top, H + pH - 0.3, pz], 0.05, 0.05); if (!lo) bm(ST, [top, H + 0.3, pz], [-top, H + pH - 0.3, pz], 0.05, 0.05); }
    const ring = (phi, x) => {
      const a = A(phi, x), n = N(phi), d = depth(phi) / 2;
      return [add(add(a, mul(n, d)), [-gw, 0, 0]), add(add(a, mul(n, d)), [gw, 0, 0]),
              add(add(a, mul(n, -d)), [gw, 0, 0]), add(add(a, mul(n, -d)), [-gw, 0, 0])];
    };
    const step = (lo ? 9 : 4.5) * D2R, nSeg = Math.ceil((phi1 - phi0) / step);
    for (const sx of [-1, 1]) {
      const xa = sx * xt;
      let rPrev = ring(phi0, xa), sPrev = 0;
      face(GD, rPrev.slice().reverse(), mul(T(phi0), -1), p => [p[0], p[1]]);
      for (let i = 1; i <= nSeg; i++) {
        const phi = phi0 + (phi1 - phi0) * i / nSeg, r = ring(phi, xa), sHere = sPrev + R * (phi1 - phi0) / nSeg;
        const phiM = phi0 + (phi1 - phi0) * (i - 0.5) / nSeg, ca = A(phiM, xa);
        for (let j = 0; j < 4; j++) {
          const k = (j + 1) % 4, q = [rPrev[j], rPrev[k], r[k], r[j]];
          const mid = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25);
          face(GD, q, nrm(sub(mid, ca)), p => [sPrev + len(sub(p, rPrev[j])) * 0.5, j % 2 ? p[1] : p[0]]);
        }
        for (const sg of [1, -1]) {
          const phiP = phi0 + (phi1 - phi0) * (i - 1) / nSeg;
          bm(GD, add(A(phiP, xa), mul(N(phiP), sg * depth(phiP) / 2)), add(A(phi, xa), mul(N(phi), sg * depth(phi) / 2)), gw + 0.16, 0.05, N(phiM));
        }
        if (!lo && Math.floor(sHere / 1.3) !== Math.floor(sPrev / 1.3)) {
          const n = N(phi), a = A(phi, xa), d = depth(phi) / 2;
          for (const s2 of [-1, 1]) bm(GD, add(add(a, mul(n, d - 0.05)), [s2 * (gw + 0.05), 0, 0]), add(add(a, mul(n, -d + 0.05)), [s2 * (gw + 0.05), 0, 0]), 0.05, 0.1, [1, 0, 0]);
        }
        if (sx > 0 && i % 2 === 0) {
          for (const sg of [1, -1]) bm(ST, add(A(phi, -xt + gw), mul(N(phi), sg * (depth(phi) / 2 - 0.15))), add(A(phi, xt - gw), mul(N(phi), sg * (depth(phi) / 2 - 0.15))), 0.08, 0.1, N(phi));
          if (!lo && i >= 2) {
            const phiQ = phi0 + (phi1 - phi0) * (i - 2) / nSeg;
            bm(ST, add(A(phiQ, -xt + gw), mul(N(phiQ), depth(phiQ) / 2 - 0.15)), add(A(phi, xt - gw), mul(N(phi), depth(phi) / 2 - 0.15)), 0.05, 0.05, N(phi));
            bm(ST, add(A(phiQ, xt - gw), mul(N(phiQ), depth(phiQ) / 2 - 0.15)), add(A(phi, -xt + gw), mul(N(phi), depth(phi) / 2 - 0.15)), 0.05, 0.05, N(phi));
          }
        }
        rPrev = r; sPrev = sHere;
      }
      face(GD, rPrev, T(phi1), p => [p[0], p[1]]);
      let prev = null;
      for (let i = 0; i <= nSeg; i++) {
        const phi = Math.max(phi0, -75 * D2R) + (phi1 - Math.max(phi0, -75 * D2R)) * i / nSeg;
        const p = add(A(phi, xa), mul(N(phi), depth(phi) / 2 + 0.08));
        if (prev) bm(GD, prev, p, 0.09, 0.08, N(phi));
        prev = p;
      }
    }
    for (const sx of [-1, 1]) bm(ST, [sx * top, H + pH, pz + 0.3], add(A(-40 * D2R, sx * xt), mul(N(-40 * D2R), -depth(-40 * D2R) / 2)), 0.1, 0.12);
    if (!lo) for (const phi of [-30 * D2R, -48 * D2R]) { const a = add(A(phi, xt), mul(N(phi), depth(phi) / 2)); cyl(bags.metal, a, N(phi), 0.03, 4.0, 6, true); }
    // THE HOOKS: the track ropes' tangent points (the line), at the cabin's height over the dock
    const topAt = (phi, x) => add(A(phi, x), mul(N(phi), depth(phi) / 2 + 0.16));
    S.hooks.track = [-1, 1].map(sx => ({ p: topAt(L, sx * xt), dir: T(L) }));
    S.ropeAtDock = yD;
    // THE BULL WHEELS, one under each arch's nose (G349, "2 wheels for each
    // line"): the haul rope arrives tangent at the line's angle
    const wr = P.wheelR;
    S.wheels = []; S.hooks.haul = [];
    for (const sx of [-1, 1]) {
      const xa = sx * xt;
      const hl = add(A(L, xa), mul(N(L), -depth(L) / 2 - P.haulDrop));
      const wc = add(hl, mul(N(L), -wr));
      S.wheels.push({ c: wc, r: wr, axis: [1, 0, 0] });
      S.hooks.haul.push({ p: add(wc, mul(N(L), wr)), dir: T(L) }, { p: add(wc, mul(N(L), -wr)), dir: T(L) });
      const segs = lo ? 24 : 48, rw = 0.13, rd = 0.28;
      let prevR = null;
      for (let i = 0; i <= segs; i++) {
        const a = 2 * Math.PI * i / segs, rad = [0, Math.cos(a), Math.sin(a)];
        const o = add(wc, mul(rad, wr)), ii = add(wc, mul(rad, wr - rd));
        const r = [add(o, [-rw, 0, 0]), add(o, [rw, 0, 0]), add(ii, [rw, 0, 0]), add(ii, [-rw, 0, 0])];
        if (prevR) for (let j = 0; j < 4; j++) {
          const k = (j + 1) % 4, q = [prevR[j], prevR[k], r[k], r[j]];
          const mid = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25);
          face(GD, q, nrm(sub(mid, wc)), p => [(q.indexOf(p) >= 2 ? a : a - 2 * Math.PI / segs) * wr, j % 2 ? Math.hypot(p[1] - wc[1], p[2] - wc[2]) : p[0]]);   // (G351: u along the rim by each corner's own angle, v across the rim or down the cheek - the quad had one u)
        }
        prevR = r;
      }
      cyl(ST, add(wc, [-0.3, 0, 0]), [1, 0, 0], 0.3, 0.6, 16, true);
      cyl(ST, add(wc, [-gw - 0.3, 0, 0]), [1, 0, 0], 0.08, 2 * gw + 0.6, 10, true);
      const nSp = lo ? 4 : 8;
      for (let i = 0; i < nSp; i++) { const a = 2 * Math.PI * i / nSp, rad = [0, Math.cos(a), Math.sin(a)]; bm(ST, add(wc, mul(rad, 0.28)), add(wc, mul(rad, wr - rd + 0.02)), 0.04, 0.07, [1, 0, 0]); }
      for (const s2 of [-1, 1]) {
        const xh = xa + s2 * (gw + 0.12), ax = add(wc, [s2 * (gw + 0.12), 0, 0]);
        bm(GD, add(A(L, xh), mul(N(L), -depth(L) / 2)), ax, 0.1, 0.07);
        bm(GD, add(A(L - 14 * D2R, xh), mul(N(L - 14 * D2R), -depth(L - 14 * D2R) / 2)), ax, 0.07, 0.05);
        boxAB(ST, [ax[0] - 0.1, ax[1] - 0.25, ax[2] - 0.25], [ax[0] + 0.1, ax[1] + 0.25, ax[2] + 0.25]);
      }
    }
    // THE ANCHOR FRAME on the terminal house (G349, "a dedicated structure
    // holding them on the white house"): two lattice posts on the ground
    // just before the terminal's front wall, up past its ridge, a crossbeam
    // and an X between them, tied into the house's wall, and two backstays
    // from its top over the roof to deadmen behind the house. The
    // cantilever's CABLES all land on it: from each arch's upper back, from
    // the portal's top corners, from the deck's rear corners.
    S.hooks.anchor = []; S.cables = [];
    const xA = P.anchorX, zA = P.terminal ? zT + termW / 2 + 1.2 : zB - 26, yA = P.terminal ? termRidge + P.anchorUp : g(0, zB - 26) + 12;
    for (const sx of [-1, 1]) {
      const f = [sx * xA, g(sx * xA, zA), zA];
      boxAB(CO, [f[0] - 0.7, f[1] - 0.8, f[2] - 0.7], [f[0] + 0.7, f[1] + 0.3, f[2] + 0.7]);
      latticeColumn(ST, [f[0], f[1] + 0.25, f[2]], [f[0], yA, f[2]], 0.32, 0.32, 0.26, 0.26, P.panel, lo, bm);
      if (P.terminal) bm(ST, [f[0], termFloor + 3.0, f[2]], [sx * Math.min(xA, termL / 2 - 0.5), termFloor + 3.0, zT + termW / 2 - 0.1], 0.1, 0.12);   // tied into the wall
      const dead = [f[0], g(f[0], zT - termW / 2 - 9), zT - termW / 2 - 9];
      if (P.terminal) { boxAB(CO, [dead[0] - 1.0, dead[1] - 1.6, dead[2] - 1.0], [dead[0] + 1.0, dead[1] + 0.3, dead[2] + 1.0]); cyl(ST, [f[0], yA, f[2]], nrm(sub(dead, [f[0], yA, f[2]])), 0.035, len(sub(dead, [f[0], yA, f[2]])), 6, false); S.cables.push({ a: [f[0], yA, f[2]], b: dead, kind: 'backstay' }); }
    }
    bm(ST, [-xA, yA, zA], [xA, yA, zA], 0.18, 0.2);
    bm(ST, [-xA, yA - 0.6, zA], [xA, yA - 0.6, zA], 0.08, 0.08);
    if (!lo) { bm(ST, [-xA, yA - 3.0, zA], [xA, yA - 0.2, zA], 0.05, 0.05); bm(ST, [xA, yA - 3.0, zA], [-xA, yA - 0.2, zA], 0.05, 0.05); }
    const cable = (a, b, kind) => { cyl(ST, a, nrm(sub(b, a)), 0.04, len(sub(b, a)), 6, false); S.cables.push({ a, b, kind }); };
    for (const sx of [-1, 1]) {
      const phiA = -P.stayDeg * D2R, Pa = topAt(phiA, sx * xt), Qa = [sx * xt, yA - 0.25, zA];
      cable(Pa, Qa, 'arch');
      S.hooks.anchor.push({ p: Pa, dir: nrm(sub(Qa, Pa)) });
      cable([sx * top, H + pH + 0.1, pz], [sx * xA, yA - 0.9, zA], 'portal');
      cable([sx * hw, H + 0.1, zB + 0.3], [sx * xA, H + 2.0, zA], 'deck');
    }
    // THE DOCK GUIDES: a laced frame hanging under each slot's edges
    const guideX = [];
    for (const sx of [-1, 1]) { guideX.push(sx * dx - slotW / 2, sx * dx + slotW / 2); }
    for (const x of guideX) for (const z of [zWing0 + 0.8, zWing0 + slotD - 0.8]) bm(ST, [x, gy0, z], [x, gy0 - P.dockDrop, z], 0.08, 0.08);
    for (const x of guideX) for (let y = gy0 - 1.0; y > gy0 - P.dockDrop + 0.2; y -= 1.0) {
      bm(ST, [x, y, zWing0 + 0.8], [x, y, zWing0 + slotD - 0.8], 0.04, 0.04);
      if (!lo) bm(ST, [x, y, zWing0 + 0.8], [x, y + 1.0, zWing0 + slotD - 0.8], 0.03, 0.03);
    }
    S.hooks.dock = { p: [0, floorY - 0.2, zD], dx, w: slotW, depth: slotD };
    S.slots = [-1, 1].map(sx => ({ x0: sx * dx - slotW / 2, x1: sx * dx + slotW / 2, z0: zWing0, z1: zWing0 + slotD }));
    // THE PASSAGE TRUSS and its bents
    if (P.passage) {
      const x1 = 1.35, ty0 = deckY - 1.5, ty1 = deckY + 0.1, zEnd = zPass1;
      for (const sx of [-1, 1]) {
        bm(ST, [sx * x1, ty1, zB], [sx * x1, ty1, zEnd], 0.1, 0.12);
        bm(ST, [sx * x1, ty0, zB], [sx * x1, ty0, zEnd], 0.1, 0.12);
        let flip = 1;
        for (let z = zB; z > zEnd + 0.1; z -= 2.5) {
          bm(ST, [sx * x1, ty0, z], [sx * x1, ty1, z], 0.05, 0.05);
          const z2 = Math.max(zEnd, z - 2.5);
          if (!lo || flip > 0) bm(ST, [sx * x1, flip > 0 ? ty0 : ty1, z], [sx * x1, flip > 0 ? ty1 : ty0, z2], 0.05, 0.05);
          flip = -flip;
        }
      }
      for (let z = zB; z > zEnd + 0.1; z -= 2.5) bm(ST, [-x1, ty0, z], [x1, ty0, z], 0.06, 0.06);
      for (let z = zB - 5; z > zEnd + 2; z -= 8) {
        const gz = g(0, z);
        if (ty0 - gz < 1.5) continue;
        for (const sx of [-1, 1]) {
          const f = [sx * (x1 + 0.9), g(sx * (x1 + 0.9), z), z];
          boxAB(CO, [f[0] - 0.5, f[1] - 0.6, f[2] - 0.5], [f[0] + 0.5, f[1] + 0.3, f[2] + 0.5]);
          bm(ST, [f[0], f[1] + 0.25, f[2]], [sx * x1, ty0, z], 0.09, 0.09);
        }
        const yM = (ty0 + gz) / 2;
        bm(ST, [-(x1 + 0.45), yM, z], [x1 + 0.45, yM, z], 0.05, 0.05);
        if (!lo) { bm(ST, [-(x1 + 0.45), yM, z], [x1, ty0, z], 0.04, 0.04); bm(ST, [x1 + 0.45, yM, z], [-x1, ty0, z], 0.04, 0.04); }
      }
    }
    // THE LANTERNS (G349): the wings' outer walls, the machine house's front
    // corners, the passage's ends, the terminal's front, two under the deck
    // over the dock, one on the portal
    if (P.lamps !== 0) {
      const wt = P.wallT / 2 + 0.02;
      lamps.push(HG.lampAt(bags, Q, [dx + slotW / 2 + wingW + wt, floorY + 2.3, zWing0 + slotD / 2], [1, 0, 0]));
      lamps.push(HG.lampAt(bags, Q, [-(dx + slotW / 2 + wingW + wt), floorY + 2.3, zWing0 + slotD / 2], [-1, 0, 0]));
      for (const sx of [-1, 1]) lamps.push(HG.lampAt(bags, Q, [sx * (rearL / 2 - 0.8), floorY + P.machineH - 0.6, 2.1 + wt], [0, 0, 1]));
      for (const sx of [-1, 1]) lamps.push(HG.lampAt(bags, Q, [sx * dx, gy0 - 0.05, zD], [0, 0, 1], { down: true, k: 0.9, range: 12 }));
      if (P.passage) for (const sx of [-1, 1]) lamps.push(HG.lampAt(bags, Q, [sx * (1.45 + wt), floorY + 2.2, zPass0 - 1.2], [sx, 0, 0]));
      if (P.terminal) for (const sx of [-1, 1]) lamps.push(HG.lampAt(bags, Q, [sx * 4.5, termFloor + 2.4, zT + termW / 2 + wt], [0, 0, 1]));
      lamps.push(HG.lampAt(bags, Q, [top + 0.1, H + pH - 0.4, pz], [1, 0, 0]));
    }
    S.girder = { C, R, phi0, phi1, w: gw * 2, dFoot: P.girderD, dNose: P.girderDn, foot: gFoot, apex: A(0), nose: A(phi1), xs: [-xt, xt], tangent: Pt };
    S.portal = { z: pz, h: pH };
    S.anchorFrame = { x: xA, z: zA, top: yA };
    S.boxes = boxes;
  };

  const built = HG.buildComposite(parts, {
    P, ground: g, extra,
    stats: { station: S },
  }, lod, F);
  built.stats.ridgeY = Math.max(built.stats.ridgeY, S.girder.apex[1] + P.girderD / 2, S.anchorFrame.top);
  S.lamps = lamps.length;
  return built;
}

// ---------------------------------------------------------------------------
// THE BASE STATION (G346, rebuilt G349 - the user: "Your base station is
// currently pretty poor. The cable go through the roof and the beam
// structure. The beam structure in front is too close for letting the cabin
// actually go through. The structure inside should not be rusty. There
// should be a road facing entrance and office, with the signs I provided").
//
// THE LINE COMES FIRST. A docked cabin's floor is the dock's floor and its
// carriage sits `hangH` over its floor origin, so the track rope over the
// dock is at yD; from there it climbs at the line's angle toward the open
// end. Everything else is set from that rope:
//   - the BARN is as tall as it must be for the roof to clear the ropes
//     where they leave through the open gable (the eave rises until the
//     roof's underside over the outer rope is a metre above it) - the
//     lintel over the open end stays under the ropes;
//   - the ROPE TOWER stands at `towerIn` inside the open end, its legs OUTSIDE
//     the cabins' path (a cabin and a stride either side of the slots), its
//     crossbeam under the ropes with a saddle shoe under each track rope;
//   - the TENSION WHEELS, one per line, stand just behind the dock where the
//     line is still high enough, in the line's plane, with the haul rope's
//     two strands leaving them up the line at the same offsets under the
//     track rope as at the top station (the wheels are the same radius);
//   - the DOCKING GUIDES are outboard of the cabins;
//   - the steel is PAINTED (`steelRust` low): a working station, not a ruin;
//   - the OFFICE is a two-storey house across the barn's road end, facing
//     the road, with its door, porch and stairs, the sky-tram sign over the
//     porch (the bench draws the banner on the published slot);
//   - lanterns at the open end's corners, on the office, inside over the
//     dock, and on the tower.
// The frame: +z is the LINE (the ropes go up that way to the top station),
// -z the road, x across, the slab on the ground at the origin.
function buildBase(P, lod, F) {
  const HG = window.HOUSE_GEN, K = window.HOUSE_KIT;
  const { add, sub, mul, nrm, len, crs, beam, cyl, face, boxAB } = K;
  const g = typeof P.ground === 'function' ? P.ground
    : (x, z) => -Math.tan(P.slopeX * D2R) * x - Math.tan(P.slopeZ * D2R) * z;
  const L = P.barnL, W = P.barnW, lo = lod > 0, rT = P.roofT;
  const floorY = P.floorY;
  const dxL = P.dockDx, ang = P.lineDeg * D2R, tL = Math.tan(ang);
  const zT = L / 2 - P.towerIn, zD = zT - P.dockIn;
  const yD = floorY + P.dockH - 0.2 + P.hangH + P.ropeUp / Math.cos(ang);   // the track rope over the dock's centre (G351: the cabin's pivot stands there, the contact line ropeUp over it square to the line)
  const ropeAt = z => yD + (z - zD) * tL;
  const tpB = Math.tan(P.barnPitch * D2R);
  // the barn's eave from the ropes at the open end: the roof's underside over the outer rope a metre above it
  const Hb = Math.max(P.barnH, ropeAt(L / 2) + 1.0 - rT - (W / 2 - dxL - 0.9) * tpB - floorY);
  const wallSet = HG.SET_IDX('wall', 'greywood'), roofSet = HG.SET_IDX('roof', 'corrworn');
  const parts = [], boxes = [];
  const houseAt = (tag, Pb, x, z, yaw, slot) => {
    const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
    const hx = Math.abs(Pb.L / 2 * c) + Math.abs(Pb.w / 2 * s), hz = Math.abs(Pb.L / 2 * s) + Math.abs(Pb.w / 2 * c);
    const b = { tag, x, z, x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, y0: Pb.floorY, y1: Pb.floorY + Pb.storeys * Pb.floorH };
    boxes.push(b);
    parts.push({ tag, P: Pb, x, z, yaw: yaw || 0, box: b, slot: slot || 1 });
    return b;
  };
  // THE BARN: turned a quarter so its gable ends face along the line; the
  // left end (local -x) lands on +z, the line's side, and is the open one
  houseAt('barn', {
    L, w: W, storeys: 1, floorH: Hb, floorY, stance: 0, skirt: 0, roofFam: 0, pitch: P.barnPitch, eaveOver: 0.8, rakeOver: 0.7,
    hip: 0, door: 0, backDoor: 0, porch: 0, stairs: 0, chim: 0, gutter: 0, downpipe: 0, dormers: 0, gableWin: 1, openFront: 4,
    openClear: dxL + 1.7 + 0.5,   // no post across the cabins' path (G349)
    nFront: P.barnWin, nBack: P.barnWin, nLeft: 0, nRight: 0, winW: 1.0, winH: 0.9, winSill: Hb - 3.2, muntin: 1, curtains: 0, trimW: 0.1,
    wallSet, wallCol: 0, trimSet: HG.SET_IDX('trim', 'veneerpale'), trimCol: 0, roofSet, roofCol: 0,
    postSet: HG.SET_IDX('post', 'rough'),
    weather: 0.85, dirt: 0.6, dirtH: 1.4, paintPunch: 0, clouds: 0.35, ribs: 0, ao: 0,
  }, 0, 0, Math.PI / 2);
  // THE OFFICE across the road end, facing the road (slot 2: its own cladding)
  let office = null;
  if (P.annexOn) {
    const oL = P.annexL, oW = P.annexW, oz = -L / 2 - oW / 2 - 0.15;
    let gO = -1e9;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gO = Math.max(gO, g(sx * oL / 2, oz + sz * oW / 2));
    const oFloor = gO + 0.4;
    houseAt('office', {
      L: oL, w: oW, storeys: 2, floorH: 2.8, floorY: oFloor, stance: 1, skirt: 2, roofFam: 0, pitch: 30, eaveOver: 0.55, rakeOver: 0.4,
      hip: 0, door: 1, doorPos: 0.5, doorW: 1.2, doorH: 2.2, doorLight: 1, porch: 1, porchD: 2.2, porchLenF: 0.5, porchRoof: 1, railStyle: 1, stairs: 1,
      backDoor: 0, chim: 1, chimR: 0.14, chimXF: -0.55, gutter: 1, downpipe: 1, dormers: 0, gableWin: 1,
      nFront: 4, nBack: 0, nLeft: 2, nRight: 2, winW: 1.15, winH: 1.35, winSill: 0.9, muntin: 1, curtains: 0.4,
      wallSet: HG.SET_IDX('wall', 'paintwood'), wallCol: 6, trimSet: HG.SET_IDX('trim', 'veneerpale'), trimCol: 2, roofSet: HG.SET_IDX('roof', 'galv'), roofCol: 0,
      postSet: HG.SET_IDX('post', 'rough'),
      weather: 0.6, dirt: 0.45, dirtH: 1.0, paintPunch: 0.5, clouds: 0.2,
    }, 0, oz, Math.PI, 2);
    office = { x: 0, z: oz, L: oL, w: oW, floor: oFloor, eave: oFloor + 5.6, front: oz - oW / 2 };
  }
  for (const part of parts) {
    const c = Math.cos(part.yaw), s = Math.sin(part.yaw), me = part.box;
    part.P.winKeep = (lx, lz, y0, y1) => {
      const wx = lx * c + lz * s + part.x, wz = -lx * s + lz * c + part.z, y = (y0 + y1) / 2;
      return !boxes.some(b => b !== me && wx > b.x0 - 0.3 && wx < b.x1 + 0.3 && wz > b.z0 - 0.3 && wz < b.z1 + 0.3 && y > b.y0 - 0.3 && y < b.y1 + 0.3);
    };
  }

  const S = { kind: 'base', hooks: {}, barn: { L, W, H: Hb }, hang: P.hangH, ropeAtDock: yD };
  const lamps = [];
  const extra = (bags, built, Q) => {
    const ST = bags.steel, GD = bags.girder, CO = bags.stone, PO = bags.post, DK = bags.deck;
    const bm = (bag, a, b, w, t, up) => beam(bag, a, b, w, t, up || [0, 1, 0]);
    const eaveY = floorY + Hb, rise = W / 2 * tpB, ridgeY = eaveY + rise;
    const roofAt = x => ridgeY - Math.abs(x) * tpB;
    // THE TIMBER FRAME: a bay every `barnBay` metres from the back end to the open end
    const nBay = Math.max(2, Math.round(L / P.barnBay)), xi = W / 2 - 0.45, ps = 0.2;
    for (let i = 0; i <= nBay; i++) {
      const z = -L / 2 + 0.45 + (L - 0.9) * i / nBay;
      for (const sx of [-1, 1]) {
        bm(PO, [sx * xi, floorY, z], [sx * xi, roofAt(xi) - 0.35, z], ps, ps);
        bm(PO, [sx * xi, eaveY - 1.6, z], [sx * (xi - 1.4), eaveY - 0.32, z], 0.08, 0.1);
      }
      bm(PO, [-xi, eaveY - 0.32, z], [xi, eaveY - 0.32, z], 0.15, 0.18);
      bm(PO, [0, eaveY - 0.2, z], [0, ridgeY - 0.3, z], 0.12, 0.12);
      if (!lo) for (const sx of [-1, 1]) bm(PO, [0, eaveY + rise * 0.3, z], [sx * W * 0.27, roofAt(W * 0.27) - 0.28, z], 0.08, 0.08);
    }
    for (const sx of [-1, 1]) for (const f of [0.33, 0.66]) {
      const x = sx * W / 2 * (1 - f);
      bm(PO, [x, roofAt(x) - 0.2, -L / 2 + 0.3], [x, roofAt(x) - 0.2, L / 2 - 0.3], 0.08, 0.1);
    }
    bm(PO, [-W / 2 + 0.3, eaveY - 0.32, L / 2 - 0.45], [W / 2 - 0.3, eaveY - 0.32, L / 2 - 0.45], 0.16, 0.2);
    // THE ROPE TOWER: legs outside the cabins' path, a crossbeam under the ropes, saddle shoes on it
    const xT = dxL + 1.7 + 0.9, hT = ropeAt(zT) - 0.5;
    for (const sx of [-1, 1]) {
      const foot = [sx * xT, floorY, zT - P.towerRake], head = [sx * xT, hT, zT];
      boxAB(CO, [foot[0] - 0.7, floorY - 0.05, foot[2] - 0.7], [foot[0] + 0.7, floorY + 0.25, foot[2] + 0.7]);
      bm(ST, [foot[0], floorY + 0.2, foot[2]], head, 0.22, 0.28);
      bm(ST, [sx * xT, floorY + 0.2, zT + 1.6], head, 0.12, 0.16);
      if (!lo) { const m = mul(add(foot, head), 0.5); bm(ST, [m[0], m[1], m[2]], [sx * xT, floorY + 0.2, zT + 1.6], 0.06, 0.06); }
    }
    bm(ST, [-xT, hT, zT], [xT, hT, zT], 0.3, 0.35);
    if (!lo) bm(ST, [-xT, hT - 0.6, zT], [xT, hT - 0.6, zT], 0.1, 0.1);
    const tLine = [0, Math.sin(ang), Math.cos(ang)], nLine = [0, Math.cos(ang), -Math.sin(ang)];   // up the line; its perpendicular, upward
    S.hooks.track = []; S.hooks.haul = []; S.hooks.anchor = []; S.wheels = [];
    for (const sx of [-1, 1]) {
      const x = sx * dxL;
      // the saddle shoe: a block on the crossbeam the track rope rides over, at the line's angle
      const shoe = [x, hT + 0.4, zT];
      bm(GD, add(shoe, mul(tLine, -0.6)), add(shoe, mul(tLine, 0.6)), 0.22, 0.12, nLine);
      S.hooks.track.push({ p: [x, ropeAt(zT), zT], dir: tLine });
      // the anchor drum for the track rope, behind the tower on the floor
      const drum = [x, floorY + 1.2, zT - P.dockIn - 6.5];
      cyl(GD, add(drum, [-0.5, 0, 0]), [1, 0, 0], 0.55, 1.0, lo ? 10 : 20, true);
      for (const ddx of [-0.6, 0.6]) bm(ST, [x + ddx, floorY + 0.2, drum[2]], [x + ddx, drum[1] + 0.2, drum[2]], 0.12, 0.12);
      boxAB(CO, [x - 0.9, floorY - 0.05, drum[2] - 0.8], [x + 0.9, floorY + 0.25, drum[2] + 0.8]);
      S.hooks.anchor.push({ p: add(drum, [0, 0.55, 0]), dir: [0, 0, -1] });
    }
    // THE TENSION WHEELS, one per line, just behind the dock in the line's plane
    const wr = P.wheelR, gap1 = P.girderDn + 0.16 + P.haulDrop;    // the top strand's offset under the track rope, as at the top station
    for (const sx of [-1, 1]) {
      const x = sx * dxL, zW = zD - P.cabinL / 2 - 1.6;
      const onLine = [x, ropeAt(zW), zW];
      const wc = add(onLine, mul(nLine, -(gap1 + wr)));
      S.wheels.push({ c: wc, r: wr, axis: [1, 0, 0] });
      S.hooks.haul.push({ p: add(wc, mul(nLine, wr)), dir: tLine }, { p: add(wc, mul(nLine, -wr)), dir: tLine });
      const segs = lo ? 24 : 48, rw = 0.13, rd = 0.28;
      let prevR = null;
      for (let i = 0; i <= segs; i++) {
        const a = 2 * Math.PI * i / segs, rad = [0, Math.cos(a), Math.sin(a)];
        const o = add(wc, mul(rad, wr)), ii = add(wc, mul(rad, wr - rd));
        const r = [add(o, [-rw, 0, 0]), add(o, [rw, 0, 0]), add(ii, [rw, 0, 0]), add(ii, [-rw, 0, 0])];
        if (prevR) for (let j = 0; j < 4; j++) {
          const k = (j + 1) % 4, q = [prevR[j], prevR[k], r[k], r[j]];
          const mid = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25);
          face(GD, q, nrm(sub(mid, wc)), p => [(q.indexOf(p) >= 2 ? a : a - 2 * Math.PI / segs) * wr, j % 2 ? Math.hypot(p[1] - wc[1], p[2] - wc[2]) : p[0]]);   // (G351: u along the rim by each corner's own angle, v across the rim or down the cheek - the quad had one u)
        }
        prevR = r;
      }
      cyl(ST, add(wc, [-0.3, 0, 0]), [1, 0, 0], 0.3, 0.6, 16, true);
      cyl(ST, add(wc, [-0.9, 0, 0]), [1, 0, 0], 0.08, 1.8, 10, true);
      const nSp = lo ? 4 : 8;
      for (let i = 0; i < nSp; i++) { const a = 2 * Math.PI * i / nSp, rad = [0, Math.cos(a), Math.sin(a)]; bm(ST, add(wc, mul(rad, 0.28)), add(wc, mul(rad, wr - rd + 0.02)), 0.04, 0.07, [1, 0, 0]); }
      // the carriage: two cheek plates on rails, the counterweight under
      for (const s2 of [-1, 1]) {
        const xc = x + s2 * 0.9;
        boxAB(ST, [xc - 0.12, wc[1] - 0.4, wc[2] - 0.55], [xc + 0.12, wc[1] + 0.4, wc[2] + 0.55]);
        bm(ST, [xc, floorY + 0.2, wc[2] - 0.7], [xc, Math.min(eaveY - 0.5, wc[1] + wr + 1.2), wc[2] - 0.7], 0.08, 0.08);
        bm(ST, [xc, floorY + 0.2, wc[2] + 0.7], [xc, Math.min(eaveY - 0.5, wc[1] + wr + 1.2), wc[2] + 0.7], 0.08, 0.08);
      }
      const cwTop = wc[1] - wr - 0.5;
      if (cwTop > floorY + 0.6) boxAB(CO, [x - 0.7, floorY + 0.05, wc[2] - 0.7], [x + 0.7, cwTop, wc[2] + 0.7]);
      boxAB(CO, [x - 1.4, floorY - 0.05, wc[2] - 1.1], [x + 1.4, floorY + 0.15, wc[2] + 1.1]);
    }
    // THE DOCKING GUIDES outboard of each cabin: a curved plate, vertical at
    // the floor, turning to the line's angle at the top, the top under the rope
    const Rg = P.guideR, phi0 = -Math.PI / 2, phi1 = -Math.PI / 2 + (90 - P.lineDeg) * D2R;
    const guideC = [0, floorY + 0.4 + Rg, zD - Rg];
    const ringAt = (x, phi) => {
      const a = [x, guideC[1] + Rg * Math.sin(phi), guideC[2] + Rg * Math.cos(phi)], n = [0, Math.sin(phi), Math.cos(phi)], d = 0.45;
      return [add(add(a, mul(n, d)), [-0.16, 0, 0]), add(add(a, mul(n, d)), [0.16, 0, 0]), add(add(a, mul(n, -d)), [0.16, 0, 0]), add(add(a, mul(n, -d)), [-0.16, 0, 0])];
    };
    const nSeg = lo ? 6 : 12;
    S.guides = [];
    for (const sx of [-1, 1]) {
      const x = sx * (dxL + 1.7 + 0.35);
      let prev = ringAt(x, phi0);
      for (let i = 1; i <= nSeg; i++) {
        const phi = phi0 + (phi1 - phi0) * i / nSeg, r = ringAt(x, phi);
        const ca = [x, guideC[1] + Rg * Math.sin(phi0 + (phi1 - phi0) * (i - 0.5) / nSeg), guideC[2] + Rg * Math.cos(phi0 + (phi1 - phi0) * (i - 0.5) / nSeg)];
        for (let j = 0; j < 4; j++) {
          const k = (j + 1) % 4, q = [prev[j], prev[k], r[k], r[j]];
          const mid = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25);
          face(GD, q, nrm(sub(mid, ca)), p => [p[2] + p[1], j % 2 ? p[1] : p[0]]);
        }
        prev = r;
      }
      face(GD, prev, [0, Math.sin(phi1), Math.cos(phi1)], p => [p[0], p[1]]);
      const bot = ringAt(x, phi0);
      boxAB(CO, [x - 0.5, floorY - 0.05, bot[2][2] - 0.5], [x + 0.5, floorY + 0.4, bot[2][2] + 0.5]);
      const topP = [x, guideC[1] + Rg * Math.sin(phi1), guideC[2] + Rg * Math.cos(phi1)];
      bm(ST, [x, floorY + 0.2, topP[2] + 1.8], [x, topP[1] - 0.6, topP[2] + 0.2], 0.1, 0.12);
      S.guides.push({ x, top: topP, bottom: [x, floorY + 0.4, zD] });
    }
    // THE DOCK (G351, the user: "a 2 slot concrete structure with proper
    // stairs for access and guard rails"): concrete at the cabin's floor -
    // an ISLAND between the two lines and an OUTER platform beyond each,
    // the cabins docking in the two slots between them a hand clear of the
    // cabin's flanks; a straight concrete flight down to the barn floor at
    // the road end of each, handrails both sides of every flight; guard
    // rails along every edge that is not a boarding edge (the outer
    // platforms' outer sides and mountain ends, the island's mountain end)
    const dY = floorY + P.dockH, dz0 = zD - 3.2, dz1 = zD + 2.6;
    const cabW = 3.44, gap = 0.12, isl = dxL - cabW / 2 - gap, out0 = dxL + cabW / 2 + gap, out1 = out0 + 1.15;
    const nSt = Math.max(3, Math.ceil(P.dockH / 0.17)), riser = P.dockH / nSt, run = 0.28;
    const slab = (x0, x1) => boxAB(CO, [x0, floorY - 0.05, dz0], [x1, dY, dz1]);
    slab(-isl, isl); slab(out0, out1); slab(-out1, -out0);
    const flights = [], rails = [];
    const railRun = (a, b) => {
      const n = Math.max(1, Math.round(len(sub(b, a)) / 1.3));
      for (let i = 0; i <= n; i++) { const q = add(a, mul(sub(b, a), i / n)); bm(ST, q, [q[0], q[1] + 1.05, q[2]], 0.03, 0.03); }
      for (const h of [0.55, 1.05]) bm(ST, [a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], 0.025, 0.025);
      rails.push({ a, b });
    };
    const flight = (x0, x1) => {
      for (let i = 0; i < nSt; i++) boxAB(CO, [x0, floorY - 0.05, dz0 - (i + 1) * run], [x1, dY - i * riser, dz0 - i * run]);
      flights.push({ x0, x1, zTop: dz0, zFoot: dz0 - nSt * run, steps: nSt });
      if (!lo) for (const x of [x0 + 0.04, x1 - 0.04]) railRun([x, dY, dz0], [x, floorY, dz0 - nSt * run]);
    };
    flight(-isl, isl); flight(out0, out1); flight(-out1, -out0);
    if (!lo) {
      railRun([-isl, dY, dz1], [isl, dY, dz1]);
      for (const sx of [-1, 1]) { railRun([sx * out1, dY, dz0], [sx * out1, dY, dz1]); railRun([sx * out0, dY, dz1], [sx * out1, dY, dz1]); }
    }
    S.dock = { top: dY, island: [-isl, isl], outer: [[out0, out1], [-out1, -out0]], z0: dz0, z1: dz1, slots: [[-out0, -isl], [isl, out0]], flights, rails: rails.length, cabW };
    S.hooks.dock = { p: [0, dY - 0.2, zD], dx: dxL, w: out1 * 2, depth: dz1 - dz0 };
    // THE SIGN on the barn's road gable, over the office's ridge - the tall
    // wall the road sees; the bench hangs the banner on the published slot
    if (office) {
      const oRidge = office.floor + 5.6 + 0.14 + office.w / 2 * Math.tan(30 * D2R);
      const sw = Math.min(10.0, W - 3), sh = sw / 3.0, sy = oRidge + 0.7 + sh / 2, zG = -L / 2 - P.wallT / 2;
      boxAB(ST, [-sw / 2 - 0.1, sy - sh / 2 - 0.1, zG - 0.1], [sw / 2 + 0.1, sy + sh / 2 + 0.1, zG - 0.02]);
      S.sign = { p: [0, sy, zG - 0.11], n: [0, 0, -1], w: sw, h: sh, livery: P.signLivery || 'admiralty' };
    }
    // THE LANTERNS: the open end's corners, the office's front (its door
    // has its own), inside over the dock, on the tower
    if (P.lamps !== 0) {
      const wt = P.wallT / 2 + 0.02;
      for (const sx of [-1, 1]) lamps.push(HG.lampAt(bags, Q, [sx * (W / 2 + wt), floorY + 3.2, L / 2 - 1.0], [sx, 0, 0]));
      for (const sx of [-1, 1]) lamps.push(HG.lampAt(bags, Q, [sx * xi, floorY + 3.4, zD], [-sx, 0, 0], { k: 0.9, range: 12 }));
      for (const sx of [-1, 1]) lamps.push(HG.lampAt(bags, Q, [sx * (xT + 0.14), hT - 1.2, zT], [sx, 0, 0]));
      if (office) for (const sx of [-1, 1]) lamps.push(HG.lampAt(bags, Q, [sx * (office.L / 2 - 1.2), office.floor + 2.3, office.front - wt], [0, 0, -1]));
    }
    S.tower = { x: xT, z: zT, h: hT };
    S.office = office;
    S.boxes = boxes;
  };
  const built = HG.buildComposite(parts, { P, ground: g, extra, stats: { station: S } }, lod, F);
  S.lamps = lamps.length;
  return built;
}

window.TRAM_GEN = { buildStation, buildBase, CATALOGUE_V: 1, CATALOGUE: [], CATALOGUE_ALIASES: {} };   // (G352: the stations are HOUSE presets - their catalogue entries are on HOUSE_GEN.CATALOGUE, keys house/tram top station and house/tram base station)
})();
