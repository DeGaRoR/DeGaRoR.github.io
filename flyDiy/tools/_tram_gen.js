// _tram_gen.js — THE AERIAL TRAMWAY'S TOP STATION (G342), a composite of the
// house generator the way the mill is (G329): the station houses are house
// builds, and the steel around them - the lattice mast, the deck it carries,
// the great curved saddle girder and its bull wheel, the raked strut, the
// passageway truss - is drawn into the same bags after.
//
// THE STRUCTURE, read off the Goldbelt tram's top terminal (Juneau) rather
// than its look:
//   THE MAST      a tapered four-chord lattice column on four footings:
//                 horizontal struts at every panel, an X on every face of
//                 every panel, a plan diaphragm every second panel. It takes
//                 the vertical load of everything above.
//   THE DECK      two plate girders along the line on top of the mast,
//                 cantilevered forward toward the valley (the cabin docks
//                 under the tip) and back toward the ridge; cross beams, a
//                 floor plate; knee braces from the mast's chords carry the
//                 cantilevers. The station houses stand on it: the machine
//                 house at the back (two storeys), the middle house, the
//                 docking gallery at the tip - three staggered boxes, ribbon
//                 windows, no window into a joint.
//   THE GIRDER    the ropes come up from the valley at the line's angle and
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
//   THE WHEEL     the haul rope's bull wheel, vertical in the line's plane,
//                 hung under the nose so the rope arrives tangent to it at
//                 the line's angle: a rim, a hub, an axle, eight spokes, the
//                 hangers down from the girder. Both strands of the loop
//                 leave it down the line.
//   THE STRUT     a raked two-chord lattice leg from under the front
//                 cantilever down to a footing forward on the slope - the
//                 rope pulls the station toward the valley and down; the
//                 strut takes the forward push in compression.
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

function buildStation(P, lod, F) {
  if (Math.round(P.station) === 2) return buildBase(P, lod, F);   // the base station (G346)
  const HG = window.HOUSE_GEN, K = window.HOUSE_KIT;
  const { add, sub, mul, nrm, len, crs, beam, cyl, face, boxAB } = K;
  const g = typeof P.ground === 'function' ? P.ground
    : (x, z) => -Math.tan(P.slopeX * D2R) * x - Math.tan(P.slopeZ * D2R) * z;
  const H = P.mastH, top = P.mastTop / 2, base = P.mastBase / 2;
  const deckY = H, zF = P.deckFront, zB = -P.deckBack, hw = P.deckW / 2;
  const floorY = deckY + 0.3;
  const lo = lod > 0;
  const fake = y => () => y;             // a house on the deck: its posts are stubs into the deck

  // ---- THE HOUSES: three staggered boxes on the deck, the passage, the terminal
  const wallSet = HG.SET_IDX('wall', 'boxprof'), roofSet = HG.SET_IDX('roof', 'galv');
  const box = (L, w, storeys, floorH, z, o) => Object.assign({
    L, w, storeys, floorH, floorY, stance: 0, skirt: 0, roofFam: 0, pitch: 7, eaveOver: 0.35, rakeOver: 0.25,
    hip: 0, door: 0, backDoor: 0, porch: 0, stairs: 0, chim: 0, gutter: 0, downpipe: 0, dormers: 0, gableWin: 0,
    winW: 1.35, winH: 1.05, winSill: 1.05, muntin: 0, curtains: 0, trimW: 0.08,
    wallSet, wallCol: 7, trimSet: HG.SET_IDX('trim', 'veneerpale'), trimCol: 6, roofSet, roofCol: 0,
    weather: 0.5, dirt: 0.15, dirtH: 0.6, paintPunch: 0.2, clouds: 0.25, ribs: 0,
  }, o || {});
  const boxes = [];
  const parts = [];
  const houseAt = (tag, Pb, x, z, yaw) => {
    const L = Pb.L, w = Pb.w, c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
    // the box in the station's frame (an axis-aligned bound is enough: the
    // houses stand square to the line)
    const hx = Math.abs(L / 2 * c) + Math.abs(w / 2 * s), hz = Math.abs(L / 2 * s) + Math.abs(w / 2 * c);
    const b = { tag, x, z, x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, y0: Pb.floorY, y1: Pb.floorY + Pb.storeys * Pb.floorH };
    boxes.push(b);
    parts.push({ tag, P: Pb, x, z, yaw: yaw || 0, box: b, ground: Pb.groundFake ? fake(Pb.floorY - 0.25) : undefined });
    return b;
  };
  const rearL = P.houseL, midL = P.houseL * 0.82, frontL = P.houseL * 0.68;
  houseAt('machine house', box(rearL, 6.6, 2, 2.9, 0, { nFront: 6, nBack: 5, nLeft: 3, nRight: 3, groundFake: 1 }), 0, -1.2, 0);
  houseAt('middle house', box(midL, 5.2, 1, 3.5, 0, { nFront: 5, nBack: 0, nLeft: 2, nRight: 2, winH: 1.25, winSill: 1.0, groundFake: 1 }), 0, 4.7, 0);
  houseAt('docking gallery', box(frontL, 4.4, 1, 3.0, 0, { nFront: 4, nBack: 0, nLeft: 2, nRight: 2, winH: 1.3, winSill: 0.95, groundFake: 1 }), 0, zF - 2.0, 0);
  // the passageway: a narrow house turned lengthways, windows down both sides
  // from the machine house's back wall to the terminal's front wall
  const zT = -P.terminalZ, termL = 14, termW = 9.5;
  const zPass0 = boxes[0].z0 + 0.3, zPass1 = P.terminal ? zT + termW / 2 - 0.3 : zB - 12;
  const passL = P.passage ? zPass0 - zPass1 : 0;
  if (P.passage) houseAt('passageway', box(passL, 2.9, 1, 2.75, 0, { nFront: Math.round(passL / 2.4), nBack: Math.round(passL / 2.4), nLeft: 0, nRight: 0, winW: 1.5, winH: 1.15, winSill: 1.0, groundFake: 1, eaveOver: 0.25 }), 0, (zPass0 + zPass1) / 2, Math.PI / 2);
  // the terminal house on the ridge: a plain red house on the real ground
  if (P.terminal) {
    let gT = -1e9;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gT = Math.max(gT, g(sx * termL / 2, zT + sz * termW / 2));
    houseAt('terminal house', {
      L: termL, w: termW, storeys: 2, floorH: 2.9, floorY: gT + 0.45, stance: 1, skirt: 2, roofFam: 0, pitch: 30, eaveOver: 0.55, rakeOver: 0.4,
      // the passage comes in at the front; the door is at the back, on the
      // ridge (a front door on a 28-degree slope drew a stair that chased
      // the ground forty metres down the hill)
      nFront: 5, nBack: 4, nLeft: 2, nRight: 2, winW: 1.2, winH: 1.4, winSill: 0.9, muntin: 1, curtains: 0.3, door: 0, porch: 0, stairs: 1,
      chim: 1, chimR: 0.14, chimXF: -0.6, gutter: 1, downpipe: 1, backDoor: 1, backPorch: 1, dormers: 0, gableWin: 1,
      wallSet: HG.SET_IDX('wall', 'paintwood'), wallCol: 10, trimSet: HG.SET_IDX('trim', 'veneerpale'), trimCol: 6,
      roofSet: HG.SET_IDX('roof', 'galv'), roofCol: 0, postSet: HG.SET_IDX('post', 'rough'),
      weather: 0.7, dirt: 0.5, dirtH: 1.2, paintPunch: 0.5, clouds: 0.4,
    }, 0, zT, 0);
  }
  // NO WINDOW INTO A JOINT: a hole whose centre is inside another box (with a
  // margin) is not cut
  for (const part of parts) {
    const c = Math.cos(part.yaw), s = Math.sin(part.yaw), me = part.box;
    part.P.winKeep = (lx, lz, y0, y1) => {
      const wx = lx * c + lz * s + part.x, wz = -lx * s + lz * c + part.z, y = (y0 + y1) / 2;
      return !boxes.some(b => b !== me && wx > b.x0 - 0.3 && wx < b.x1 + 0.3 && wz > b.z0 - 0.3 && wz < b.z1 + 0.3 && y > b.y0 - 0.3 && y < b.y1 + 0.3);
    };
  }

  // ---- THE STEEL, after the houses
  const S = { deckY, hooks: {} };
  const extra = (bags, built, Q) => {
    const ST = bags.steel, GD = bags.girder, CO = bags.stone;
    const bm = (bag, a, b, w, t, up) => beam(bag, a, b, w, t, up || [0, 1, 0]);
    const chordAt = (sx, sz, y) => {        // a chord's point at height y: the mast tapers
      const t = Math.max(0, Math.min(1, (y - g(0, 0)) / (H - g(0, 0))));
      const r = base + (top - base) * t;
      return [sx * r, y, sz * r];
    };
    // THE FOOTINGS and THE MAST
    const y0 = g(0, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const c = chordAt(sx, sz, y0);
      const yg = g(c[0], c[2]);
      boxAB(CO, [c[0] - 0.7, yg - 0.8, c[2] - 0.7], [c[0] + 0.7, yg + 0.35, c[2] + 0.7]);
      bm(ST, [c[0], yg + 0.3, c[2]], chordAt(sx, sz, H), 0.16, 0.16);
    }
    const nPan = Math.max(3, Math.round((H - y0) / P.panel));
    const levels = [];
    for (let k = 0; k <= nPan; k++) levels.push(y0 + 0.3 + (H - y0 - 0.3) * k / nPan);
    const corners = y => [chordAt(-1, 1, y), chordAt(1, 1, y), chordAt(1, -1, y), chordAt(-1, -1, y)];
    for (let k = 0; k <= nPan; k++) {
      const c = corners(levels[k]);
      for (let i = 0; i < 4; i++) bm(ST, c[i], c[(i + 1) % 4], 0.07, 0.07);   // the struts
      if (k > 0) {
        const d = corners(levels[k - 1]);
        for (let i = 0; i < 4; i++) {         // the X on every face
          const j = (i + 1) % 4;
          bm(ST, d[i], c[j], 0.06, 0.06);
          if (!lo) bm(ST, d[j], c[i], 0.06, 0.06);
        }
        if (k % 2 === 0 && !lo) { bm(ST, c[0], c[2], 0.05, 0.05); bm(ST, c[1], c[3], 0.05, 0.05); }   // the plan diaphragm
      }
    }
    // the ladder up the inside
    if (!lo) {
      const lx = [-0.25, 0.25];
      for (const x of lx) bm(ST, [x, y0 + 0.3, -top + 0.5], [x, H + 1.0, -top + 0.5], 0.03, 0.03);
      for (let y = y0 + 0.6; y < H + 0.9; y += 0.3) bm(ST, [lx[0], y, -top + 0.5], [lx[1], y, -top + 0.5], 0.015, 0.015);
    }
    // THE DECK: two girders along the line, cross beams, the floor plate, knee braces
    const gy0 = deckY - P.deckD, gy1 = deckY;
    for (const sx of [-1, 1]) {
      const x = sx * hw;
      boxAB(ST, [x - 0.06, gy0, zB], [x + 0.06, gy1, zF]);                       // the web
      boxAB(ST, [x - 0.22, gy1 - 0.08, zB], [x + 0.22, gy1, zF]);                // the flanges
      boxAB(ST, [x - 0.22, gy0, zB], [x + 0.22, gy0 + 0.08, zF]);
    }
    for (let z = zB + 1.0; z < zF; z += 2.0) bm(ST, [-hw, gy0 + 0.3, z], [hw, gy0 + 0.3, z], 0.12, 0.2);
    boxAB(ST, [-hw - 0.3, gy1, zB], [hw + 0.3, gy1 + 0.06, zF]);                 // the floor plate
    for (const sx of [-1, 1]) {                                                   // the knee braces from the chords
      const cf = chordAt(sx, 1, H - 7), cb = chordAt(sx, -1, H - 7);
      bm(ST, cf, [sx * hw, gy0, zF - 1.0], 0.1, 0.14);
      bm(ST, cb, [sx * hw, gy0, zB + 1.0], 0.1, 0.14);
      bm(ST, [sx * hw, gy0, zF - 1.0], [sx * hw, gy0, zF], 0.1, 0.1);
    }
    // the handrail round the deck's free edges
    if (!lo) {
      const rail = (a, b) => {
        const n = Math.max(1, Math.round(len(sub(b, a)) / 1.6));
        for (let i = 0; i <= n; i++) { const p = add(a, mul(sub(b, a), i / n)); bm(ST, p, [p[0], p[1] + 1.05, p[2]], 0.02, 0.02); }
        for (const h of [0.55, 1.05]) bm(ST, [a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], 0.02, 0.02);
      };
      for (const sx of [-1, 1]) rail([sx * (hw + 0.2), gy1, zB], [sx * (hw + 0.2), gy1, zF]);
    }
    // THE PORTAL FRAME behind the machine house, on the deck: the girder's foot
    const pH = P.portalH, pz = Math.max(zB + 0.4, boxes[0].z0 - 0.7);
    for (const sx of [-1, 1]) {
      bm(ST, [sx * top, H, pz], [sx * top, H + pH, pz], 0.15, 0.15);
      bm(ST, [sx * top, H + pH - 0.2, pz], [sx * top, H + 0.2, pz - 2.2], 0.08, 0.08);   // the knee back onto the deck
    }
    bm(ST, [-top, H + pH, pz], [top, H + pH, pz], 0.16, 0.16);
    bm(ST, [-top, H + 0.3, pz], [top, H + pH - 0.3, pz], 0.05, 0.05);
    if (!lo) bm(ST, [top, H + 0.3, pz], [-top, H + pH - 0.3, pz], 0.05, 0.05);
    // THE GIRDER: an arc from the portal's crossbar over the houses to the nose
    const R = P.girderR, phi0 = -95 * D2R, phi1 = P.noseDeg * D2R, gw = P.girderW / 2;
    const foot = [0, H + pH + 0.3, pz];
    const C = [0, foot[1] - R * Math.cos(phi0), foot[2] - R * Math.sin(phi0)];
    const A = phi => [0, C[1] + R * Math.cos(phi), C[2] + R * Math.sin(phi)];
    const N = phi => [0, Math.cos(phi), Math.sin(phi)];                 // radial, outward
    const T = phi => [0, -Math.sin(phi), Math.cos(phi)];                // along, toward the nose
    const depth = phi => P.girderD + (P.girderDn - P.girderD) * (phi - phi0) / (phi1 - phi0);
    const ring = phi => {
      const a = A(phi), n = N(phi), d = depth(phi) / 2;
      return [add(add(a, mul(n, d)), [-gw, 0, 0]), add(add(a, mul(n, d)), [gw, 0, 0]),
              add(add(a, mul(n, -d)), [gw, 0, 0]), add(add(a, mul(n, -d)), [-gw, 0, 0])];
    };
    const step = (lo ? 9 : 4.5) * D2R, nSeg = Math.ceil((phi1 - phi0) / step);
    let rPrev = ring(phi0), sPrev = 0;
    face(GD, rPrev.slice().reverse(), mul(T(phi0), -1), p => [p[0], p[1]]);   // the foot cap
    for (let i = 1; i <= nSeg; i++) {
      const phi = phi0 + (phi1 - phi0) * i / nSeg, r = ring(phi), sHere = sPrev + R * (phi1 - phi0) / nSeg;
      const ca = A(phi0 + (phi1 - phi0) * (i - 0.5) / nSeg);
      for (let j = 0; j < 4; j++) {
        const k = (j + 1) % 4, q = [rPrev[j], rPrev[k], r[k], r[j]];
        const mid = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25);
        face(GD, q, nrm(sub(mid, ca)), p => [sPrev + len(sub(p, rPrev[j])) * 0.5, j % 2 ? p[1] : p[0]]);
      }
      // the flanges: plates a hand wider than the webs along the top and the bottom edges
      for (const sg of [1, -1]) {
        const p0 = add(A(phi0 + (phi1 - phi0) * (i - 1) / nSeg), mul(N(phi0 + (phi1 - phi0) * (i - 1) / nSeg), sg * depth(phi0 + (phi1 - phi0) * (i - 1) / nSeg) / 2));
        const p1 = add(A(phi), mul(N(phi), sg * depth(phi) / 2));
        bm(GD, p0, p1, gw + 0.16, 0.05, N(phi0 + (phi1 - phi0) * (i - 0.5) / nSeg));
      }
      // a stiffener rib across each web, every metre and a bit
      if (!lo && Math.floor(sHere / 1.3) !== Math.floor(sPrev / 1.3)) {
        const n = N(phi), a = A(phi), d = depth(phi) / 2;
        for (const sx of [-1, 1]) bm(GD, add(add(a, mul(n, d - 0.05)), [sx * (gw + 0.05), 0, 0]), add(add(a, mul(n, -d + 0.05)), [sx * (gw + 0.05), 0, 0]), 0.05, 0.1, [1, 0, 0]);
      }
      rPrev = r; sPrev = sHere;
    }
    face(GD, rPrev, T(phi1), p => [p[0], p[1]]);                                 // the nose cap
    // the saddle strips the track ropes ride, along the top, from behind the apex to the nose
    const xt = P.trackX;
    for (const sx of [-1, 1]) {
      let prev = null;
      for (let i = 0; i <= nSeg; i++) {
        const phi = Math.max(phi0, -75 * D2R) + (phi1 - Math.max(phi0, -75 * D2R)) * i / nSeg;
        const p = add(add(A(phi), mul(N(phi), depth(phi) / 2 + 0.08)), [sx * xt, 0, 0]);
        if (prev) bm(GD, prev, p, 0.09, 0.08, N(phi));
        prev = p;
      }
    }
    // the prop from the portal under the arch (the nose is carried by the raked leg, below)
    bm(ST, [0, H + pH, pz + 0.3], add(A(-40 * D2R), mul(N(-40 * D2R), -depth(-40 * D2R) / 2)), 0.1, 0.12);
    // the antennae on the back of the arch
    if (!lo) for (const phi of [-30 * D2R, -48 * D2R]) { const a = add(A(phi), mul(N(phi), depth(phi) / 2)); cyl(bags.metal, a, N(phi), 0.03, 4.0, 6, true); }
    // THE HOOKS: the track ropes' tangent points front (the line) and back (the anchors)
    const phiL = P.lineDeg * D2R, phiA = -P.anchorDeg * D2R;
    const topAt = (phi, x) => add(add(A(phi), mul(N(phi), depth(phi) / 2 + 0.16)), [x, 0, 0]);
    S.hooks.track = [-1, 1].map(sx => ({ p: topAt(phiL, sx * xt), dir: T(phiL) }));
    S.hooks.anchor = [-1, 1].map(sx => ({ p: topAt(phiA, sx * xt), dir: mul(T(phiA), -1) }));
    // THE BULL WHEEL under the nose: the haul rope arrives tangent at the line's angle
    const wr = P.wheelR, hl = add(A(phiL), mul(N(phiL), -depth(phiL) / 2 - P.haulDrop));   // the top strand's line
    const wc = add(hl, mul(N(phiL), -wr));
    S.wheel = { c: wc, r: wr, axis: [1, 0, 0] };
    const tL = T(phiL);
    S.hooks.haul = [add(wc, mul(N(phiL), wr)), add(wc, mul(N(phiL), -wr))].map(p => ({ p, dir: tL }));
    const segs = lo ? 24 : 48, rw = 0.15, rd = 0.3;
    let prevR = null;
    for (let i = 0; i <= segs; i++) {
      const a = 2 * Math.PI * i / segs, rad = [0, Math.cos(a), Math.sin(a)];
      const o = add(wc, mul(rad, wr)), ii = add(wc, mul(rad, wr - rd));
      const r = [add(o, [-rw, 0, 0]), add(o, [rw, 0, 0]), add(ii, [rw, 0, 0]), add(ii, [-rw, 0, 0])];
      if (prevR) for (let j = 0; j < 4; j++) {
        const k = (j + 1) % 4, q = [prevR[j], prevR[k], r[k], r[j]];
        const mid = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25);
        face(GD, q, nrm(sub(mid, wc)), p => [a * wr, j % 2 ? p[1] : p[0]]);
      }
      prevR = r;
    }
    cyl(ST, add(wc, [-0.4, 0, 0]), [1, 0, 0], 0.32, 0.8, 16, true);            // the hub
    cyl(ST, add(wc, [-0.9, 0, 0]), [1, 0, 0], 0.09, 1.8, 10, true);            // the axle
    const nSp = lo ? 4 : 8;
    for (let i = 0; i < nSp; i++) { const a = 2 * Math.PI * i / nSp, rad = [0, Math.cos(a), Math.sin(a)]; bm(ST, add(wc, mul(rad, 0.3)), add(wc, mul(rad, wr - rd + 0.02)), 0.045, 0.08, [1, 0, 0]); }
    for (const sx of [-1, 1]) {                                                 // the hangers from the girder
      const ax = add(wc, [sx * 0.85, 0, 0]);
      bm(GD, add(add(A(phiL), mul(N(phiL), -depth(phiL) / 2)), [sx * 0.85, 0, 0]), ax, 0.12, 0.08);
      bm(GD, add(add(A(phiL - 14 * D2R), mul(N(phiL - 14 * D2R), -depth(phiL - 14 * D2R) / 2)), [sx * 0.85, 0, 0]), ax, 0.08, 0.06);
      boxAB(ST, [ax[0] - 0.12, ax[1] - 0.3, ax[2] - 0.3], [ax[0] + 0.12, ax[1] + 0.3, ax[2] + 0.3]);   // the bearing
    }
    // THE RAKED LEG toward the valley (the photographs: one lattice leg from
    // a footing forward on the slope up to the girder's nose, beside the
    // houses): the rope pulls the nose toward the valley and down, and the
    // leg takes it in compression. An outrigger off the girder's underside
    // carries the leg's head clear of the docking gallery.
    if (P.strut) {
      const zs = P.strutZ, xl = hw + 1.6, dz = 0.65, phiN = 24 * D2R;
      const gS = g(xl, zs);
      boxAB(CO, [xl - 1.0, gS - 0.8, zs - 1.2], [xl + 1.0, gS + 0.35, zs + 1.2]);
      const head = add(A(phiN), mul(N(phiN), -depth(phiN) / 2 - 0.3));
      bm(GD, add(head, [-gw, 0, 0]), add(head, [xl + 0.3, 0, 0]), 0.35, 0.22, N(phiN));     // the outrigger
      const topP = sz => [xl, head[1] - 0.2, head[2] + sz * dz], botP = sz => [xl, gS + 0.3, zs + sz * dz];
      for (const sz of [-1, 1]) bm(ST, botP(sz), topP(sz), 0.11, 0.11);
      const L = len(sub(topP(1), botP(1))), nL = Math.max(2, Math.round(L / 1.6));
      for (let i = 0; i <= nL; i++) {
        const a = add(botP(-1), mul(sub(topP(-1), botP(-1)), i / nL)), b = add(botP(1), mul(sub(topP(1), botP(1)), i / nL));
        bm(ST, a, b, 0.05, 0.05);
        if (i < nL) { const c = add(botP(i % 2 ? -1 : 1), mul(sub(topP(i % 2 ? -1 : 1), botP(i % 2 ? -1 : 1)), (i + 1) / nL)); bm(ST, i % 2 ? b : a, c, 0.05, 0.05); }
      }
      // a tie from the leg's head back to the deck's edge, so the leg and the deck act together
      bm(ST, [xl, head[1] - 0.4, head[2]], [hw, gy1, zF - 0.5], 0.07, 0.07);
    }
    // THE DOCK GUIDES under the tip
    for (const sx of [-1, 1]) for (const z of [zF - 4.2, zF - 0.6]) bm(ST, [sx * hw, gy0, z], [sx * hw, gy0 - P.dockDrop, z], 0.08, 0.08);
    for (const sx of [-1, 1]) for (let y = gy0 - 1.0; y > gy0 - P.dockDrop + 0.2; y -= 1.0) {
      bm(ST, [sx * hw, y, zF - 4.2], [sx * hw, y, zF - 0.6], 0.04, 0.04);
      if (!lo) bm(ST, [sx * hw, y, zF - 4.2], [sx * hw, y + 1.0, zF - 0.6], 0.03, 0.03);
    }
    // the dock: where a cabin stands with its floor level with the gallery's, past the tip
    S.hooks.dock = { p: [0, deckY + 0.3, zF + 2.2], dx: 2.2, w: hw * 2 };
    S.kind = 'top';
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
      for (let z = zB - 5; z > zEnd + 2; z -= 8) {                             // the bents
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
    S.mast = { H, top: top * 2, base: base * 2, panels: nPan };
    S.girder = { C, R, phi0, phi1, w: gw * 2, dFoot: P.girderD, dNose: P.girderDn, foot, apex: A(0), nose: A(phi1) };
    S.boxes = boxes;
  };

  const built = HG.buildComposite(parts, {
    P, ground: g, extra,
    stats: { station: S },
  }, lod, F);
  built.stats.ridgeY = Math.max(built.stats.ridgeY, S.girder.apex[1] + P.girderD / 2);
  return built;
}


// ---------------------------------------------------------------------------
// THE BASE STATION (G346, the user: "I have references for the base station
// ... we'll do less grand, more rustic. Keep the architecture, but drop the
// giant windows, so it looks more like a giant open barn, wooden structure").
//
// THE ARCHITECTURE, read off the Goldbelt lower terminal: a tall hall whose
// whole end toward the line is OPEN - the ropes come in over that end and the
// cabin comes down through it into the dock; inside, the rope tower (two
// raked legs to a crossbeam under the roof, the sheave carriages on it at
// the line's angle, the track ropes' anchor drums behind), the curved plate
// GUIDES that take the cabin's hanger as it comes in, a raised DOCK at the
// cabin's floor with its rails and stairs, and the haul rope's tension
// wheel on its carriage at the back with the counterweight under it; a
// lower building beside it for the tickets. Here the hall is a BARN: a
// house build ten metres to the eave in weathered boards under worn
// corrugated iron, its gable end left open (`openFront` on the end that
// faces the line), a few small windows high in the long walls instead of
// the glass front, and the timber frame that holds such a roof drawn
// inside - posts at every bay, tie beams, king posts, struts, purlins,
// knee braces. The annex is a two-storey house against one long wall.
//
// The frame: +z is the LINE (the ropes go up that way to the top station),
// -z the back of the barn, x across, the slab on the ground at the origin.
function buildBase(P, lod, F) {
  const HG = window.HOUSE_GEN, K = window.HOUSE_KIT;
  const { add, sub, mul, nrm, len, crs, beam, cyl, face, boxAB } = K;
  const g = typeof P.ground === 'function' ? P.ground
    : (x, z) => -Math.tan(P.slopeX * D2R) * x - Math.tan(P.slopeZ * D2R) * z;
  const L = P.barnL, W = P.barnW, Hb = P.barnH, lo = lod > 0;
  const floorY = P.floorY;
  const wallSet = HG.SET_IDX('wall', 'greywood'), roofSet = HG.SET_IDX('roof', 'corrworn');
  const parts = [], boxes = [];
  const houseAt = (tag, Pb, x, z, yaw) => {
    const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
    const hx = Math.abs(Pb.L / 2 * c) + Math.abs(Pb.w / 2 * s), hz = Math.abs(Pb.L / 2 * s) + Math.abs(Pb.w / 2 * c);
    const b = { tag, x, z, x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, y0: Pb.floorY, y1: Pb.floorY + Pb.storeys * Pb.floorH };
    boxes.push(b);
    parts.push({ tag, P: Pb, x, z, yaw: yaw || 0, box: b });
    return b;
  };
  // THE BARN: turned a quarter so its gable ends face along the line; the
  // left end (local -x) lands on +z, the line's side, and is the open one
  houseAt('barn', {
    L, w: W, storeys: 1, floorH: Hb, floorY, stance: 0, skirt: 0, roofFam: 0, pitch: P.barnPitch, eaveOver: 0.8, rakeOver: 0.7,
    hip: 0, door: 0, backDoor: 0, porch: 0, stairs: 0, chim: 0, gutter: 0, downpipe: 0, dormers: 0, gableWin: 1, openFront: 4,
    nFront: P.barnWin, nBack: P.barnWin, nLeft: 0, nRight: 0, winW: 1.0, winH: 0.9, winSill: Hb - 3.2, muntin: 1, curtains: 0, trimW: 0.1,
    wallSet, wallCol: 0, trimSet: HG.SET_IDX('trim', 'veneerpale'), trimCol: 0, roofSet, roofCol: 0,
    postSet: HG.SET_IDX('post', 'rough'),
    weather: 0.85, dirt: 0.6, dirtH: 1.4, paintPunch: 0, clouds: 0.5, ribs: 0, ao: 0,
  }, 0, 0, Math.PI / 2);
  // THE ANNEX against the +x wall, its door on its outer side
  if (P.annexOn) {
    const aL = P.annexL, aW = P.annexW;
    houseAt('annex', {
      L: aL, w: aW, storeys: 2, floorH: 2.8, floorY: floorY + 0.35, stance: 1, skirt: 2, roofFam: 0, pitch: 30, eaveOver: 0.55, rakeOver: 0.4,
      hip: 0, door: 1, doorPos: 0.5, doorW: 1.1, porch: 1, porchD: 1.8, porchLenF: 0.3, porchRoof: 1, railStyle: 1, stairs: 1,
      backDoor: 0, chim: 1, chimR: 0.14, chimXF: -0.55, gutter: 1, downpipe: 1, dormers: 0, gableWin: 1,
      nFront: 4, nBack: 0, nLeft: 2, nRight: 2, winW: 1.15, winH: 1.35, winSill: 0.9, muntin: 1, curtains: 0.4,
      wallSet, wallCol: 0, trimSet: HG.SET_IDX('trim', 'veneerpale'), trimCol: 0, roofSet, roofCol: 0,
      postSet: HG.SET_IDX('post', 'rough'),
      weather: 0.8, dirt: 0.55, dirtH: 1.2, paintPunch: 0, clouds: 0.45,
    }, W / 2 + aW / 2 - 0.1, -L / 2 + aL / 2 + 1.5, Math.PI / 2);
  }
  for (const part of parts) {
    const c = Math.cos(part.yaw), s = Math.sin(part.yaw), me = part.box;
    part.P.winKeep = (lx, lz, y0, y1) => {
      const wx = lx * c + lz * s + part.x, wz = -lx * s + lz * c + part.z, y = (y0 + y1) / 2;
      return !boxes.some(b => b !== me && wx > b.x0 - 0.3 && wx < b.x1 + 0.3 && wz > b.z0 - 0.3 && wz < b.z1 + 0.3 && y > b.y0 - 0.3 && y < b.y1 + 0.3);
    };
  }

  const S = { kind: 'base', hooks: {}, barn: { L, W, H: Hb } };
  const extra = (bags, built, Q) => {
    const ST = bags.steel, GD = bags.girder, CO = bags.stone, PO = bags.post, DK = bags.deck;
    const bm = (bag, a, b, w, t, up) => beam(bag, a, b, w, t, up || [0, 1, 0]);
    const eaveY = floorY + Hb, rise = W / 2 * Math.tan(P.barnPitch * D2R), ridgeY = eaveY + rise;
    const roofAt = x => ridgeY - Math.abs(x) * Math.tan(P.barnPitch * D2R);   // the roof's underside line at the wall's inner face
    // THE TIMBER FRAME: a bay every `bay` metres from the back end to the open end
    const nBay = Math.max(2, Math.round(L / P.barnBay)), xi = W / 2 - 0.45, ps = 0.2;
    for (let i = 0; i <= nBay; i++) {
      const z = -L / 2 + 0.45 + (L - 0.9) * i / nBay;
      for (const sx of [-1, 1]) {
        bm(PO, [sx * xi, floorY, z], [sx * xi, roofAt(xi) - 0.35, z], ps, ps);            // the post
        bm(PO, [sx * xi, eaveY - 1.6, z], [sx * (xi - 1.4), eaveY - 0.32, z], 0.08, 0.1);   // the knee brace
      }
      bm(PO, [-xi, eaveY - 0.32, z], [xi, eaveY - 0.32, z], 0.15, 0.18);                    // the tie beam
      bm(PO, [0, eaveY - 0.2, z], [0, ridgeY - 0.3, z], 0.12, 0.12);                          // the king post
      if (!lo) for (const sx of [-1, 1]) bm(PO, [0, eaveY + rise * 0.3, z], [sx * W * 0.27, roofAt(W * 0.27) - 0.28, z], 0.08, 0.08);   // the struts
    }
    for (const sx of [-1, 1]) for (const f of [0.33, 0.66]) {                                 // the purlins
      const x = sx * W / 2 * (1 - f);
      bm(PO, [x, roofAt(x) - 0.2, -L / 2 + 0.3], [x, roofAt(x) - 0.2, L / 2 - 0.3], 0.08, 0.1);
    }
    bm(PO, [-W / 2 + 0.3, eaveY - 0.32, L / 2 - 0.45], [W / 2 - 0.3, eaveY - 0.32, L / 2 - 0.45], 0.16, 0.2);   // the lintel over the open end
    // THE ROPE TOWER: two raked legs from footings to a crossbeam under the roof, at the open end
    const zT = L / 2 - P.towerIn, hT = floorY + P.towerH, xT = P.dockDx + 1.4;
    for (const sx of [-1, 1]) {
      const foot = [sx * xT, floorY, zT - P.towerRake], head = [sx * xT, hT, zT];
      boxAB(CO, [foot[0] - 0.7, floorY - 0.05, foot[2] - 0.7], [foot[0] + 0.7, floorY + 0.25, foot[2] + 0.7]);
      bm(ST, [foot[0], floorY + 0.2, foot[2]], head, 0.22, 0.28);
      bm(ST, [sx * xT, floorY + 0.2, zT + 1.6], head, 0.12, 0.16);                             // the back stay
      if (!lo) { const m = mul(add(foot, head), 0.5); bm(ST, [m[0], m[1], m[2]], [sx * xT, floorY + 0.2, zT + 1.6], 0.06, 0.06); }
    }
    bm(ST, [-xT, hT, zT], [xT, hT, zT], 0.3, 0.35);                                           // the crossbeam
    if (!lo) bm(ST, [-xT, hT - 0.6, zT], [xT, hT - 0.6, zT], 0.1, 0.1);
    // THE SHEAVE CARRIAGES on the crossbeam, one per cabin, at the line's angle
    const tL = [0, Math.sin(P.lineDeg * D2R), Math.cos(P.lineDeg * D2R)], nL = [0, Math.cos(P.lineDeg * D2R), -Math.sin(P.lineDeg * D2R)];
    S.hooks.track = []; S.hooks.haul = []; S.hooks.anchor = [];
    for (const sx of [-1, 1]) {
      const x = sx * P.dockDx, c = [x, hT + 0.5, zT];
      const a = add(c, mul(tL, -1.6)), b = add(c, mul(tL, 1.6));
      for (const dx of [-0.3, 0.3]) bm(ST, add(a, [dx, 0, 0]), add(b, [dx, 0, 0]), 0.05, 0.14, nL);   // the carriage's cheeks
      const nSh = lo ? 2 : 4;
      for (let i = 0; i < nSh; i++) {
        const p = add(a, mul(tL, 0.4 + (2.4 * i) / Math.max(1, nSh - 1)));
        cyl(GD, add(p, [-0.16, 0, 0]), [1, 0, 0], 0.26, 0.32, lo ? 10 : 18, true);              // a sheave
      }
      bm(ST, add(c, [0, -0.5, 0]), c, 0.3, 0.2);                                              // its pedestal
      // the track rope's anchor: a drum behind the tower, the rope down to it over the carriage's back
      const drum = [x, hT - 2.2, zT - 3.2];
      cyl(GD, add(drum, [-0.5, 0, 0]), [1, 0, 0], 0.55, 1.0, lo ? 10 : 20, true);
      for (const dx of [-0.6, 0.6]) bm(ST, [x + dx, floorY + 0.2, drum[2]], [x + dx, drum[1] + 0.2, drum[2]], 0.12, 0.12);
      boxAB(CO, [x - 0.9, floorY - 0.05, drum[2] - 0.8], [x + 0.9, floorY + 0.25, drum[2] + 0.8]);
      S.hooks.track.push({ p: add(b, mul(nL, 0.34)), dir: tL });
      S.hooks.haul.push({ p: add(b, mul(nL, 0.34 - 0.26 * 2)), dir: tL });
      S.hooks.anchor.push({ p: add(drum, [0, 0.55, 0]), dir: [0, 0, -1] });
    }
    // THE DOCKING GUIDES: a curved plate either side of each cabin, vertical at
    // the floor and turning to the line's angle at the top - the hanger rides it in
    const zD = zT - P.dockIn, Rg = P.guideR, phi0 = -Math.PI / 2, phi1 = -Math.PI / 2 + (90 - P.lineDeg) * D2R;
    const guideC = [0, floorY + 0.4 + Rg, zD - Rg];
    const ringAt = (x, phi) => {
      const a = [x, guideC[1] + Rg * Math.sin(phi), guideC[2] + Rg * Math.cos(phi)], n = [0, Math.sin(phi), Math.cos(phi)], d = 0.45;
      return [add(add(a, mul(n, d)), [-0.16, 0, 0]), add(add(a, mul(n, d)), [0.16, 0, 0]), add(add(a, mul(n, -d)), [0.16, 0, 0]), add(add(a, mul(n, -d)), [-0.16, 0, 0])];
    };
    const nSeg = lo ? 6 : 12;
    S.guides = [];
    for (const sx of [-1, 1]) {
      const x = sx * (P.dockDx + 2.1);
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
      // the guide's stanchions to the floor
      const bot = ringAt(x, phi0);
      boxAB(CO, [x - 0.5, floorY - 0.05, bot[2][2] - 0.5], [x + 0.5, floorY + 0.4, bot[2][2] + 0.5]);
      const topP = [x, guideC[1] + Rg * Math.sin(phi1), guideC[2] + Rg * Math.cos(phi1)];
      bm(ST, [x, floorY + 0.2, topP[2] + 1.8], [x, topP[1] - 0.6, topP[2] + 0.2], 0.1, 0.12);
      S.guides.push({ x, top: topP, bottom: [x, floorY + 0.4, zD] });
    }
    // THE DOCK: a raised deck at the cabin's floor between the guides, rails, two stairs
    const dY = floorY + P.dockH, dz0 = zD - 3.2, dz1 = zD + 2.6, dx = P.dockDx + 1.6;
    boxAB(DK, [-dx, dY - 0.12, dz0], [dx, dY, dz1]);
    for (let z = dz0 + 0.5; z < dz1; z += 1.5) for (const sx of [-1, 1]) bm(PO, [sx * dx * 0.92, floorY, z], [sx * dx * 0.92, dY - 0.12, z], 0.09, 0.09);
    if (!lo) {
      const rail = (a, b) => {
        const n = Math.max(1, Math.round(len(sub(b, a)) / 1.4));
        for (let i = 0; i <= n; i++) { const p = add(a, mul(sub(b, a), i / n)); bm(ST, p, [p[0], p[1] + 1.05, p[2]], 0.025, 0.025); }
        for (const h of [0.55, 1.05]) bm(ST, [a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], 0.02, 0.02);
      };
      rail([-dx, dY, dz0], [dx, dY, dz0]);
      for (const sx of [-1, 1]) rail([sx * dx, dY, dz0], [sx * dx, dY, dz1]);
    }
    for (const sx of [-1, 1]) {                                                                 // the stairs down, off the back edge
      const n = Math.max(3, Math.round(P.dockH / 0.18)), run = 0.28, x0 = sx * (dx - 1.4);
      for (let i = 0; i < n; i++) boxAB(DK, [x0 - 0.6, dY - (i + 1) * P.dockH / n, dz0 - (i + 1) * run], [x0 + 0.6, dY - i * P.dockH / n, dz0 - i * run]);
    }
    S.hooks.dock = { p: [0, dY, zD], dx: P.dockDx, w: dx * 2 };
    // THE TENSION WHEEL at the back: the haul rope's bull wheel on its carriage
    // between two guide rails, the counterweight under it
    const wc = [0, floorY + P.wheelH, -L / 2 + 3.0], wr = P.wheelR;
    S.wheel = { c: wc, r: wr, axis: [1, 0, 0] };
    const segs = lo ? 24 : 48, rw = 0.15, rd = 0.3;
    let prevR = null;
    for (let i = 0; i <= segs; i++) {
      const a = 2 * Math.PI * i / segs, rad = [0, Math.cos(a), Math.sin(a)];
      const o = add(wc, mul(rad, wr)), ii = add(wc, mul(rad, wr - rd));
      const r = [add(o, [-rw, 0, 0]), add(o, [rw, 0, 0]), add(ii, [rw, 0, 0]), add(ii, [-rw, 0, 0])];
      if (prevR) for (let j = 0; j < 4; j++) {
        const k = (j + 1) % 4, q = [prevR[j], prevR[k], r[k], r[j]];
        const mid = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25);
        face(GD, q, nrm(sub(mid, wc)), p => [a * wr, j % 2 ? p[1] : p[0]]);
      }
      prevR = r;
    }
    cyl(ST, add(wc, [-0.4, 0, 0]), [1, 0, 0], 0.32, 0.8, 16, true);
    cyl(ST, add(wc, [-1.1, 0, 0]), [1, 0, 0], 0.09, 2.2, 10, true);
    const nSp = lo ? 4 : 8;
    for (let i = 0; i < nSp; i++) { const a = 2 * Math.PI * i / nSp, rad = [0, Math.cos(a), Math.sin(a)]; bm(ST, add(wc, mul(rad, 0.3)), add(wc, mul(rad, wr - rd + 0.02)), 0.045, 0.08, [1, 0, 0]); }
    for (const sx of [-1, 1]) {                                                                 // the carriage and its rails
      const x = sx * 1.1;
      boxAB(ST, [x - 0.15, wc[1] - 0.45, wc[2] - 0.6], [x + 0.15, wc[1] + 0.45, wc[2] + 0.6]);
      bm(ST, [x, floorY + 0.2, wc[2] - 0.75], [x, eaveY - 0.5, wc[2] - 0.75], 0.09, 0.09);
      bm(ST, [x, floorY + 0.2, wc[2] + 0.75], [x, eaveY - 0.5, wc[2] + 0.75], 0.09, 0.09);
    }
    bm(ST, [-1.1, eaveY - 0.5, wc[2] - 0.75], [1.1, eaveY - 0.5, wc[2] - 0.75], 0.09, 0.09);
    bm(ST, [-1.1, eaveY - 0.5, wc[2] + 0.75], [1.1, eaveY - 0.5, wc[2] + 0.75], 0.09, 0.09);
    boxAB(CO, [-0.9, floorY + 0.05, wc[2] - 0.9], [0.9, wc[1] - wr - 0.5, wc[2] + 0.9]);       // the counterweight
    boxAB(CO, [-1.6, floorY - 0.05, wc[2] - 1.3], [1.6, floorY + 0.15, wc[2] + 1.3]);
    S.tower = { x: xT, z: zT, h: hT };
    S.boxes = boxes;
  };
  const built = HG.buildComposite(parts, { P, ground: g, extra, stats: { station: S } }, lod, F);
  return built;
}

window.TRAM_GEN = { buildStation, buildBase };
})();
