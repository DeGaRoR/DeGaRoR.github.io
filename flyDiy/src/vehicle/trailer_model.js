// ============================================================
// THE LAUNCH TRAILER'S MODEL (TOW-LAUNCH phase 4, 2026-11-12) - the user: "include the modeling of an appropriate
// trailer; professional quality modeling". A hot-dip galvanised TANDEM-AXLE launch trailer, built to the build it
// carries (trailer.js's fit): the frame's rails under the floats (or either side of a hull's keel), the bunks where the
// cradle's pads are, at the bottom's deadrise, the bow stops at the bows, the drawbar as long as the nose needs.
//
//   THE FRAME     two C-channel rails (125 x 50 x 4), C-channel cross members, an A-frame of 100 x 50 box with a
//                 centre tongue (80 x 80) to a cast ball coupling (its lever, its grip), two safety chains drooped to
//                 the ball, a jockey wheel stowed up on its clamp, the lighting cable clipped along the left rail
//   RUNNING GEAR  two rubber-torsion axles (60 x 60 square tube, trailing arms, spindles), four 185R14C tyres on
//                 pressed-steel 5-stud wheels (brake drum, hub cap, wheel nuts), a spare under the rear, tandem
//                 mudguards with a tread top and rubber mud flaps, the axle's U-bracket mounts
//   LIGHTS        a rear light board: two combination lamps (stop/tail red, indicator amber, reverse white), triangle
//                 reflectors, a plate board (blank) and its lamp, amber side reflectors, white front ones
//   THE CRADLE    floats: per float two carpeted timber bunks (50 x 140) tilted to the float's deadrise on swivel
//                 brackets and posts off saddle plates on the rails; a bow stop post per float (a rubber V-block)
//                 carrying the LATCH (a release hook, its red lever) and the yellow strap to the bow eye - drawn
//                 while the latch is shut. Hull: two bunks under the chines, black keel rollers on the centreline,
//                 one winch post at the bow (the hand winch: drum, gear case, crank) with the latch and strap.
//
// THE COST: one Group of merged meshes, one per material (10), and the wheels as 4 InstancedMesh (tyre, wheel, drum,
// chrome) of 5 instances (4 turning, the spare) - 14 draw calls, ~16k triangles (GATE TRAILER's MODEL measures); a
// frame's update: the group's matrix and 4 instance matrices x 4 meshes (~2 us). The materials are MeshStandard -
// they take the scene's environment like every prop.
//
// Frame: the trailer's (trailer.js): origin on the ground under the axles' centre, +x forward to the ball, +y up,
// +z right. buildTrailerModel(THREE, T [, o]) -> { group, update(T, latched), stats }; buildTowHitch(THREE) -> the
// car's half (the ball mount, for the car's rig at its ball point).
// ============================================================

function buildTrailerModel(THREE, Tr, o) {
  o = o || {};
  const T = THREE, fit = Tr.fit;
  const seg = o.lod === 'low' ? 0.5 : 1;
  const S = n => Math.max(3, Math.round(n * seg));
  // ---- materials ----
  const std = (c, m, r, extra) => new T.MeshStandardMaterial(Object.assign({ color: c, metalness: m, roughness: r }, extra || {}));
  const M = o.materials || {
    galv: std(0xaeb3b8, 0.72, 0.40),          // hot-dip galvanised: a matt silver
    galvDk: std(0x8f959b, 0.70, 0.52),        // the axles, the arms, the brackets (duller, older zinc)
    carpet: std(0x3a414a, 0.0, 0.98),         // the bunks' marine carpet
    rubber: std(0x18191b, 0.0, 0.88),         // tyres, mud flaps, V-blocks, keel rollers
    wheel: std(0xc8ccd0, 0.55, 0.32),         // the pressed-steel wheels, painted silver
    chrome: std(0xe9ebee, 1.0, 0.16),         // the hub caps, the wheel nuts, the ball
    black: std(0x121314, 0.15, 0.55),         // the lamp housings, the cable, the jockey wheel's tyre, the grips
    red: std(0xa8131b, 0.1, 0.25, { emissive: 0x3a0306 }),
    amber: std(0xd9781a, 0.1, 0.25, { emissive: 0x301302 }),
    white: std(0xf1f1ec, 0.05, 0.45),
    strap: std(0xe2b21c, 0.0, 0.8),          // the latch's webbing strap, the winch strap
    drum: std(0x3d4043, 0.6, 0.6),            // the brake drums (cast iron, painted)
  };
  const bins = new Map();   // material -> [geometries, in the trailer's frame]
  const put = (mat, g) => { if (!bins.has(mat)) bins.set(mat, []); bins.get(mat).push(g); return g; };
  const V3 = (x, y, z) => new T.Vector3(x, y, z);

  // ---- profiles (2D shapes in the member's cross-section: x across, y up) ----
  function rrect(w, h, r) {   // a rounded rectangle centred on 0
    const s = new T.Shape(), x0 = -w / 2, y0 = -h / 2;
    s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x0 + w, y0 + h - r); s.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x0 + r, y0 + h); s.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  function chan(h, b, t, open) {   // a C channel h tall, b flanges, t thick; open toward +x (open = 1) or -x (-1)
    const s = new T.Shape(), k = open || 1, ri = t * 0.8;
    const P = [[0, -h / 2], [b, -h / 2], [b, -h / 2 + t], [t + ri, -h / 2 + t], [t, -h / 2 + t + ri], [t, h / 2 - t - ri], [t + ri, h / 2 - t], [b, h / 2 - t], [b, h / 2], [0, h / 2]];
    P.forEach(([x, y], i) => { const X = k * (x - b / 2); if (i === 0) s.moveTo(X, y); else s.lineTo(X, y); });
    s.closePath(); return s;
  }
  function angle(a, t) {   // an equal angle a x a x t, the corner at the origin, legs along +x and +y
    const s = new T.Shape(); s.moveTo(0, 0); s.lineTo(a, 0); s.lineTo(a, t); s.lineTo(t * 1.6, t); s.quadraticCurveTo(t, t, t, t * 1.6); s.lineTo(t, a); s.lineTo(0, a); s.closePath(); return s;
  }
  // a member: the profile swept straight from a to b; `up` orients the profile's y
  function member(mat, shape, a, b, up, curveSeg) {
    const d = V3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
    const g = new T.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, curveSegments: curveSeg || S(3) });
    const z = d.clone().normalize(), u = V3(...(up || [0, 1, 0]));
    let x = new T.Vector3().crossVectors(u, z); if (x.lengthSq() < 1e-8) x = new T.Vector3().crossVectors(V3(1, 0, 0), z); x.normalize();
    const y = new T.Vector3().crossVectors(z, x);
    const m = new T.Matrix4().makeBasis(x, y, z).setPosition(a[0], a[1], a[2]);
    g.applyMatrix4(m); return put(mat, g);
  }
  const boxAt = (mat, w, h, d, at, rot) => { const g = new T.BoxGeometry(w, h, d); if (rot) g.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...rot))); g.translate(...at); return put(mat, g); };
  const rbox = (mat, sx, sy, sz, r, at, rotY) => {   // a rounded box: a rounded rect (x by y) extruded over z
    const g = new T.ExtrudeGeometry(rrect(sx, sy, r), { depth: sz, bevelEnabled: false, curveSegments: S(3) }); g.translate(0, 0, -sz / 2);
    if (rotY) g.rotateY(rotY); g.translate(...at); return put(mat, g);
  };
  const cyl = (mat, r0, r1, h, at, axis, n) => {   // axis: 'x' | 'y' | 'z'
    const g = new T.CylinderGeometry(r1, r0, h, n || S(16)); if (axis === 'x') g.rotateZ(-Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(...at); return put(mat, g);
  };
  const tube = (mat, pts, r, n, closed) => put(mat, new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => V3(...p))), n || 48, r, S(6), !!closed));

  // ---- the layout, from the fit ----
  const isF = fit.kind === 'floats', Ld = fit.Ld, ballY = 0.48;
  const wheelR = Tr.wheelR, wZ = Tr.wheelZ, ax = Tr.axleDx / 2;
  const railH = 0.125, railB = 0.05, railT = 0.004;
  const railTop = 0.585, railY = railTop - railH / 2;
  const zR = isF ? Math.max(...fit.floats.map(f => Math.abs(f.z))) : Math.max(0.45, Math.min(0.55, wZ - 0.42));
  const pads = fit.pads;
  const keelOf = side => pads.filter(p => p.kind === 'keel' && p.float === side).sort((a, b) => b.at[0] - a.at[0]);
  // the bows: the float's (the hull's) most forward keel station, the trailer's frame
  const bows = isF ? fit.floats.map(f => { const k = f.keel.slice().sort((a, b) => b[0] - a[0])[0]; return { z: f.z, x: k[0], y: k[1], B: f.B, beta: f.beta, side: f.side }; })
                   : [(k => ({ z: 0, x: k[0], y: k[1], B: fit.hull.B, beta: fit.hull.beta, side: 0 }))(fit.hull.keel.slice().sort((a, b) => b[0] - a[0])[0])];
  const xBow = Math.max(...bows.map(b => b.x));
  const xPadMin = Math.min(...pads.map(p => p.at[0])), xPadMax = Math.max(...pads.map(p => p.at[0]));
  const xRear = Math.min(-(ax + wheelR + 0.32), xPadMin - 0.42);
  const xFront = Math.max(xBow + 0.10, xPadMax + 0.45, ax + wheelR + 0.4);
  const xC = Ld - 0.40;   // the coupler's socket: the A-frame's apex
  const stations = [];    // the cross members' x (and what stands on them)

  // ---- THE FRAME ----
  for (const s of [-1, 1]) member(M.galv, chan(railH, railB, railT, -s), [xRear, railY, s * zR], [xFront, railY, s * zR]);   // the rails, open inward
  // the rails' ends: black plastic caps on the C's (the rear), the A-frame's ends welded
  const cross = (x, mat) => { stations.push(x); member(mat || M.galv, chan(0.1, 0.05, 0.004, 1), [x, railY, -zR + railB / 2], [x, railY, zR - railB / 2], [0, 1, 0]); };
  cross(xRear + 0.03); cross(xFront - 0.03); cross(0);
  if (xFront - 0.03 - ax > 1.2) cross((xFront + ax) / 2);
  if (-ax - (xRear + 0.03) > 0.9) cross((xRear - ax) / 2);
  // the A-frame: two 100 x 50 boxes from the front corners to the socket, the centre tongue 80 x 80
  const aY = railY;
  for (const s of [-1, 1]) member(M.galv, rrect(0.05, 0.1, 0.005), [xFront - 0.05, aY, s * (zR - 0.02)], [xC + 0.02, aY, s * 0.055]);
  member(M.galv, rrect(0.08, 0.08, 0.006), [xFront - 0.06, aY, 0], [xC + 0.03, aY, 0]);
  // gusset plates where the A-frame meets the front cross member
  // (the triangle in the corner between the cross member and the A-frame member, on the top flanges: forward and inward)
  for (const s of [-1, 1]) { const g = new T.Shape(); g.moveTo(0, 0); g.lineTo(0.26, 0); g.lineTo(0, -0.26 * s); g.closePath();
    const G = new T.ExtrudeGeometry(g, { depth: 0.006, bevelEnabled: false }); G.rotateX(Math.PI / 2); G.translate(xFront - 0.03, railTop + 0.006, s * (zR - 0.04)); put(M.galv, G); }
  // THE COUPLING (a cast ball coupling, the kind every light trailer carries): its housing drawn from a side profile - the
  // socket round the tongue's end, the neck rising to the head, the dome over the ball, the nose rounding down in front
  // of it - extruded 0.09 wide with a bevel; the lever along its top, hinged at the head, its black grip at the back;
  // the lock's button; the breakaway cable's ring under the socket
  { const sp = new T.Shape(), x0 = xC - Ld, yb = aY - ballY;   // (the profile about the ball's centre: x along, y up)
    sp.moveTo(x0 - 0.03, yb - 0.045); sp.lineTo(x0 + 0.2, yb - 0.045); sp.quadraticCurveTo(-0.07, -0.045, -0.05, -0.02);
    sp.lineTo(-0.035, -0.012); sp.absarc(0, 0, 0.036, Math.PI * 0.82, Math.PI * 0.18, true);   // (the cup round the ball's top)
    sp.lineTo(0.05, -0.012); sp.quadraticCurveTo(0.065, -0.01, 0.066, 0.01);
    sp.quadraticCurveTo(0.068, 0.07, 0.0, 0.074); sp.quadraticCurveTo(-0.06, 0.076, -0.1, 0.055);
    sp.quadraticCurveTo(-0.16, yb + 0.05, x0 + 0.2, yb + 0.045); sp.lineTo(x0 - 0.03, yb + 0.045); sp.closePath();
    const hg = new T.ExtrudeGeometry(sp, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2, curveSegments: S(8) });
    hg.translate(Ld, ballY, -0.035); put(M.galv, hg);
    // the lever: hinged at the head's top, along the housing to its grip
    const lev = []; for (let i = 0; i <= 12; i++) { const u = i / 12; lev.push([Ld - 0.005 - 0.27 * u, ballY + 0.088 + 0.012 * Math.sin(u * Math.PI) - 0.03 * u * u, 0]); }
    tube(M.galvDk, lev, 0.011, 24); tube(M.black, lev.slice(8), 0.016, 12);
    cyl(M.galvDk, 0.013, 0.013, 0.095, [Ld - 0.005, ballY + 0.085, 0], 'z', S(10));   // the hinge pin
    cyl(M.chrome, 0.008, 0.008, 0.02, [Ld - 0.12, ballY + 0.06, 0.045], 'z', S(8));    // the lock's button
    const ring = new T.TorusGeometry(0.02, 0.004, S(6), S(14)); ring.rotateY(Math.PI / 2); ring.translate(xC + 0.06, aY - 0.06, -0.05); put(M.chrome, ring); }
  // THE SAFETY CHAINS: from eyes on the A-frame either side, drooped and crossed under the coupling to the ball's mount
  for (const s of [-1, 1]) {
    const a = [xC - 0.08, aY - 0.03, s * 0.09], b = [Ld + 0.05, ballY - 0.07, -s * 0.03];
    const n = 16, L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, sag = 0.11 * 4 * u * (1 - u);
      const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u - sag, z = a[2] + (b[2] - a[2]) * u;
      const link = new T.TorusGeometry(0.011, 0.0028, S(5), S(10)); link.scale(1.55, 1, 1);
      if (i % 2) link.rotateX(Math.PI / 2);
      const dir = V3(b[0] - a[0], -0.4 * Math.cos(u * Math.PI) * 0.11 * 4 / Math.max(0.3, L) * L, b[2] - a[2]).normalize();
      link.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(V3(1, 0, 0), dir)));
      link.translate(x, y, z); put(M.galvDk, link);
    }
    cyl(M.galv, 0.012, 0.012, 0.03, [a[0], a[1] - 0.005, a[2]], 'z', S(8));   // the eye
  }
  // THE JOCKEY WHEEL (stowed up): the clamp on the right A-frame member, the tube, the crank, the wheel in its fork
  { const u = 0.62, jx = xFront + (xC - xFront) * u, jz = (zR - 0.02) + (0.055 - (zR - 0.02)) * u + 0.075;
    rbox(M.galvDk, 0.08, 0.11, 0.08, 0.006, [jx, aY, jz - 0.0], 0);
    cyl(M.galv, 0.024, 0.024, 0.62, [jx, aY + 0.08, jz], 'y', S(14));
    cyl(M.galv, 0.019, 0.019, 0.2, [jx, aY + 0.4, jz], 'y', S(12));
    const crank = [[jx, aY + 0.5, jz], [jx + 0.02, aY + 0.52, jz], [jx + 0.14, aY + 0.52, jz], [jx + 0.15, aY + 0.56, jz]];
    tube(M.galv, crank, 0.007, 16); cyl(M.black, 0.012, 0.012, 0.07, [jx + 0.15, aY + 0.6, jz], 'y', S(10));
    const wy = aY - 0.22;   // stowed: the wheel's bottom 0.2 m off the ground
    for (const s of [-1, 1]) boxAt(M.galv, 0.03, 0.12, 0.006, [jx, wy + 0.05, jz + s * 0.035]);
    const jt = new T.TorusGeometry(0.075, 0.022, S(8), S(18)); jt.translate(jx, wy, jz); put(M.black, jt);
    cyl(M.wheel, 0.055, 0.055, 0.05, [jx, wy, jz], 'z', S(14)); }
  // THE CABLE: from the plug by the coupling, along the left A-frame member and rail, to the light board; its clips
  { const zc = -(zR - 0.035), y0 = railY + 0.035;
    const pts = [[xC - 0.02, ballY - 0.06, -0.12], [xC - 0.25, aY + 0.01, -0.12], [xFront, y0, zc], [ax + 0.4, y0, zc], [xRear + 0.12, y0, zc], [xRear + 0.05, y0 - 0.05, -(wZ - 0.05)]];
    tube(M.black, pts, 0.0055, 96);
    cyl(M.black, 0.018, 0.018, 0.07, [xC - 0.02, ballY - 0.08, -0.12], 'y', S(10));   // the 13-pin plug, hung on its holder
    for (const x of [xFront - 0.3, 0.4, -0.6, xRear + 0.3]) boxAt(M.galvDk, 0.012, 0.012, 0.026, [x, y0, zc]); }

  // ---- RUNNING GEAR (the tandem: two rubber-torsion axles under the rails) ----
  const axY = 0.40, armL = 0.17, spX = -0.11;   // the axle tube's centre; the trailing arm's drop to the spindle
  for (const xa of [-ax, ax]) {
    member(M.galvDk, rrect(0.06, 0.06, 0.006), [xa, axY, -(wZ - 0.14)], [xa, axY, wZ - 0.14], [0, 1, 0]);
    for (const s of [-1, 1]) {
      // the U-bracket from the rail's bottom flange to the tube; the trailing arm; the spindle stub
      boxAt(M.galvDk, 0.1, railY - railH / 2 - axY + 0.03, 0.008, [xa, (railY - railH / 2 + axY) / 2, s * zR - s * 0.01]);
      boxAt(M.galvDk, 0.1, railY - railH / 2 - axY + 0.03, 0.008, [xa, (railY - railH / 2 + axY) / 2, s * zR + s * 0.07]);
      // the U-bolts clamping the tube to the bracket, their nuts on the top plate
      const rb = railY - railH / 2;
      for (const dz of [-0.035, 0.035]) {
        const zz = s * zR + s * 0.03 + dz, U = [];
        for (let i = 0; i <= 10; i++) { const a = Math.PI * (i / 10); U.push([xa - Math.cos(a) * 0.036, i === 0 || i === 10 ? rb + 0.004 : axY - Math.sin(a) * 0.036, zz]); }
        U[1][1] = axY; U[9][1] = axY;
        tube(M.galvDk, U, 0.006, 20);
        for (const sx of [-1, 1]) cyl(M.galvDk, 0.011, 0.011, 0.012, [xa + sx * 0.036, rb + 0.01, zz], 'y', 6);
      }
      boxAt(M.galvDk, 0.11, 0.008, 0.13, [xa, rb + 0.004, s * zR + s * 0.03]);
      const a0 = [xa, axY, s * (wZ - 0.15)], a1 = [xa + spX, wheelR, s * (wZ - 0.15)];
      member(M.galvDk, rrect(0.05, 0.03, 0.006), [a0[0], a0[1], a0[2]], [a1[0], a1[1], a1[2]], [0, 0, 1]);
      cyl(M.galvDk, 0.025, 0.025, 0.06, [a1[0], a1[1], s * (wZ - 0.11)], 'z', S(12));
    }
  }
  // THE MUDGUARDS: one tandem guard a side - the arcs over both wheels and the flat between, a rolled lip, a tread top;
  // its stays to the rail; a rubber flap behind the rear wheel
  { const Rf = wheelR + 0.055, gw = 0.27;
    const path = (r) => { const P = []; const n = S(14);
      for (let i = 0; i <= n; i++) { const a = -0.25 + (Math.PI / 2 + 0.25) * (i / n); P.push([ax + Math.cos(a) * r, wheelR + Math.sin(a) * r]); }
      for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + (Math.PI / 2 + 0.3) * (i / n); P.push([-ax + Math.cos(a) * r, wheelR + Math.sin(a) * r]); }
      return P; };
    const outer = path(Rf + 0.0035), inner = path(Rf);
    const sh = new T.Shape(); outer.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); inner.slice().reverse().forEach(([x, y]) => sh.lineTo(x, y)); sh.closePath();
    for (const s of [-1, 1]) {
      const g = new T.ExtrudeGeometry(sh, { depth: gw, bevelEnabled: false }); g.translate(0, 0, s > 0 ? wZ - gw / 2 + 0.01 : -(wZ + gw / 2) - 0.01 + 0.0); put(M.galv, g);
      // the rolled outer lip (a tube along the guard's outer edge)
      tube(M.galv, outer.map(([x, y]) => [x, y, s * (wZ + gw / 2 + 0.01)]), 0.006, 64);
      // the tread plate on the flat top, the stays
      boxAt(M.galvDk, 2 * ax + 0.02, 0.004, gw - 0.04, [0, wheelR + Rf + 0.006, s * (wZ + 0.01)]);
      // its mounting (12 Nov, the user: "your wheel arches are poking through" - the three 30 mm angle stays ran up into
      // the guard's skin and, over the wheels, into the tyres' shoulders): over each wheel a flat bar from the rail's
      // outer face out under the skin, above the tyre and inboard of it; between the tyres, where there is no tyre, one
      // angle stay from the rail's foot up to under the skin
      const yUnder = wheelR + Rf - 0.006, zIn = s * (wZ - gw / 2 + 0.035);
      for (const xw of [-ax + spX, ax + spX]) boxAt(M.galvDk, 0.04, 0.006, Math.abs(zIn - s * (zR + 0.025)), [xw, yUnder, (zIn + s * (zR + 0.025)) / 2]);
      member(M.galvDk, angle(0.03, 0.003), [spX, railY - railH / 2, s * (zR + 0.025)], [spX, yUnder - 0.035, zIn], [1, 0, 0]);
      // the mud flap
      boxAt(M.rubber, 0.006, 0.26, gw - 0.02, [-ax - Rf - 0.035, 0.215, s * (wZ + 0.01)], [0, 0, -0.08]);
      // the amber side reflector on the guard's front
      boxAt(M.amber, 0.06, 0.03, 0.006, [ax + Rf * 0.75, wheelR + Rf * 0.62, s * (wZ + gw / 2 + 0.018)]);
    }
  }

  // ---- THE LIGHTS: the rear board, the lamps, the plate, the reflectors ----
  { const yb = railY - 0.02, xb = xRear - 0.025, half = wZ + 0.05;
    member(M.galv, angle(0.05, 0.004), [xb, yb, -half], [xb, yb, half], [0, 1, 0]);
    for (const s of [-1, 1]) {
      const z0 = s * (half - 0.13);
      rbox(M.black, 0.065, 0.11, 0.24, 0.012, [xb - 0.03, yb + 0.06, z0], Math.PI / 2 * 0);   // the housing
      boxAt(M.red, 0.012, 0.045, 0.1, [xb - 0.064, yb + 0.085, z0 - s * 0.05]);              // tail / stop
      boxAt(M.amber, 0.012, 0.045, 0.07, [xb - 0.064, yb + 0.085, z0 + s * 0.045]);          // the indicator
      boxAt(M.white, 0.012, 0.035, 0.05, [xb - 0.064, yb + 0.032, z0 + s * 0.06]);            // reverse
      boxAt(M.red, 0.012, 0.035, 0.12, [xb - 0.064, yb + 0.032, z0 - s * 0.03]);              // fog
      // the triangle reflector under it
      const tri = new T.Shape(); tri.moveTo(-0.075, 0); tri.lineTo(0.075, 0); tri.lineTo(0, 0.13); tri.closePath();
      const tg = new T.ExtrudeGeometry(tri, { depth: 0.008, bevelEnabled: false }); tg.rotateY(-Math.PI / 2); tg.translate(xb - 0.04, yb - 0.17, z0); put(M.red, tg);
      boxAt(M.galvDk, 0.01, 0.12, 0.012, [xb - 0.03, yb - 0.08, z0]);
    }
    // the plate board (blank) and its lamp
    boxAt(M.galvDk, 0.012, 0.15, 0.56, [xb - 0.035, yb - 0.03, 0]);
    boxAt(M.white, 0.004, 0.115, 0.52, [xb - 0.043, yb - 0.03, 0]);
    rbox(M.black, 0.04, 0.025, 0.08, 0.006, [xb - 0.05, yb + 0.06, 0], 0);
    // the front white reflectors on the A-frame's corners
    for (const s of [-1, 1]) boxAt(M.white, 0.006, 0.05, 0.05, [xFront + 0.03, aY, s * (zR + 0.03)]);
  }

  // ---- THE CRADLE ----
  const strapParts = [];
  const bunkPart = (x0, x1, y0, y1, z, tilt, w, len) => {   // a carpeted bunk from x0 to x1, its top at y (the line), tilted about x
    const L = Math.hypot(x1 - x0, y1 - y0), th = 0.05;
    const g = new T.ExtrudeGeometry(rrect(w, th, 0.012), { depth: L, bevelEnabled: false, curveSegments: S(3) });
    g.translate(0, -th / 2, 0); g.rotateZ(tilt);
    const m = new T.Matrix4().makeBasis(V3(0, 0, -1).applyAxisAngle(V3(0, 1, 0), 0), V3(0, 1, 0), V3(1, 0, 0));
    // (extruded along +z; turned so +z runs along +x, then pitched with the line)
    const pitch = Math.atan2(y1 - y0, x1 - x0);
    g.applyMatrix4(new T.Matrix4().makeRotationY(Math.PI / 2)); g.applyMatrix4(new T.Matrix4().makeRotationZ(pitch));
    g.translate(x0, y0, z); put(M.carpet, g); void m; void len;
  };
  // a post from the rail (or a bolster) up to a bunk's bracket, with its swivel plate
  const post = (x, z, yTop, zBase) => {
    const yb = railTop;
    member(M.galv, rrect(0.05, 0.05, 0.005), [x, yb, zBase], [x, yTop - 0.03, z], [1, 0, 0]);
    boxAt(M.galvDk, 0.12, 0.008, 0.07, [x, yTop - 0.026, z]);
    cyl(M.galvDk, 0.012, 0.012, 0.09, [x, yTop - 0.04, z], 'z', S(8));
  };
  const bolster = (x, z0, z1) => member(M.galv, angle(0.06, 0.005), [x, railTop, z0], [x, railTop, z1], [0, 1, 0]);
  const latchAt = (x, y, z, toBow) => {
    // the release hook: its body, its red lever; the strap (drawn while shut) to the bow eye
    rbox(M.galvDk, 0.07, 0.06, 0.05, 0.008, [x, y, z], 0);
    member(M.red, rrect(0.016, 0.016, 0.004), [x + 0.02, y + 0.02, z + 0.03], [x + 0.11, y + 0.09, z + 0.03]);
    const len = Math.hypot(toBow[0] - x, toBow[1] - y, toBow[2] - z);
    const sg = new T.BoxGeometry(len, 0.004, 0.05);
    const dir = V3(toBow[0] - x, toBow[1] - y, toBow[2] - z).normalize();
    sg.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(V3(1, 0, 0), dir)));
    sg.translate((x + toBow[0]) / 2, (y + toBow[1]) / 2, (z + toBow[2]) / 2);
    strapParts.push(sg);
    const eye = new T.TorusGeometry(0.018, 0.004, S(6), S(12)); eye.translate(toBow[0], toBow[1], toBow[2]); put(M.chrome, eye);
  };
  if (isF) {
    for (const f of fit.floats) {
      const K = keelOf(f.side); if (K.length < 2) continue;
      const P1 = K[0].at, P0 = K[K.length - 1].at, b = Math.tan(f.beta * Math.PI / 180), d = f.B * 0.25;
      const yAt = x => P0[1] + (P1[1] - P0[1]) * (x - P0[0]) / ((P1[0] - P0[0]) || 1);
      const xa = P0[0] - 0.32, xb = P1[0] + 0.28;
      for (const s of [-1, 1]) {
        const z = f.z + s * d, lift = d * b;
        bunkPart(xa, xb, yAt(xa) + lift, yAt(xb) + lift, z, -s * Math.atan(b), 0.14);
        for (const x of [P0[0], P1[0]]) post(x, z, yAt(x) + lift - 0.05, f.z + s * 0.025);
      }
      for (const x of [P0[0], P1[0]]) bolster(x, f.z - d - 0.06, f.z + d + 0.06);
      // the bow stop: a post off the front cross member, a rubber V-block at the bow, the latch below it
      const bw = bows.find(q => q.side === f.side), xs = Math.max(bw.x + 0.07, xFront - 0.03), yTop = bw.y + 0.12;
      member(M.galv, rrect(0.06, 0.06, 0.006), [xs, railTop - 0.1, f.z], [xs, yTop, f.z], [1, 0, 0]);
      const vb = new T.Shape(); vb.moveTo(-0.07, 0.06); vb.lineTo(0, 0); vb.lineTo(0.07, 0.06); vb.lineTo(0.07, 0.09); vb.lineTo(0, 0.035); vb.lineTo(-0.07, 0.09); vb.closePath();
      const vg = new T.ExtrudeGeometry(vb, { depth: 0.08, bevelEnabled: false }); vg.rotateY(-Math.PI / 2); vg.rotateX(0); vg.translate(xs - 0.03, yTop - 0.06, f.z); put(M.rubber, vg);
      latchAt(xs - 0.05, bw.y + 0.02, f.z, [bw.x - 0.02, bw.y + 0.07, f.z]);
      member(M.galvDk, angle(0.04, 0.004), [xs - 0.25, railTop, f.z], [xs - 0.02, yTop - 0.15, f.z], [0, 0, 1]);   // its brace
    }
  } else {
    const H = fit.hull, b = Math.tan(H.beta * Math.PI / 180);
    // the keel rollers on their brackets, on bolsters across the rails
    for (const kp of keelOf(0)) {
      const x = kp.at[0], yk = kp.at[1];
      bolster(x, -zR, zR);
      const prof = []; for (let i = 0; i <= 8; i++) { const u = i / 8; prof.push(new T.Vector2(0.045 + 0.02 * Math.pow(Math.abs(u - 0.5) * 2, 1.6), (u - 0.5) * 0.16)); }
      const rg = new T.LatheGeometry(prof, S(16)); rg.rotateX(Math.PI / 2); rg.translate(x, yk - 0.05, 0); put(M.rubber, rg);
      for (const s of [-1, 1]) member(M.galv, rrect(0.05, 0.008, 0.002), [x, railTop, s * 0.1], [x, yk - 0.05, s * 0.1], [1, 0, 0]);
      cyl(M.galvDk, 0.01, 0.01, 0.22, [x, yk - 0.05, 0], 'z', S(8));
    }
    // the bunks under the chines
    for (const s of [-1, 1]) {
      const C = pads.filter(p => p.kind === 'chine' && p.float === s).sort((a, b2) => a.at[0] - b2.at[0]); if (C.length < 1) continue;
      const P0 = C[0].at, P1 = C[C.length - 1].at;
      const yAt = x => P0[1] + (P1[1] - P0[1]) * (x - P0[0]) / ((P1[0] - P0[0]) || 1);
      const z = P0[2], xa = P0[0] - 0.4, xb = P1[0] + 0.4;
      bunkPart(xa, xb, yAt(xa), yAt(xb), z, -s * Math.atan(b), 0.14);
      for (const x of [P0[0], P1[0]]) { bolster(x, -zR, zR); post(x, z, yAt(x) - 0.05, s * zR); }
    }
    // the winch post at the bow: its brace, the V-roller, the hand winch (drum, gear case, crank), the latch, the strap
    const bw = bows[0], xs = Math.max(bw.x + 0.1, xFront - 0.03), yTop = bw.y + 0.14;
    member(M.galv, rrect(0.07, 0.07, 0.007), [xs, railTop - 0.1, 0], [xs, yTop, 0], [1, 0, 0]);
    member(M.galvDk, rrect(0.05, 0.05, 0.005), [xs - 0.4, railTop, 0], [xs - 0.02, yTop - 0.2, 0], [0, 0, 1]);
    const vr = []; for (let i = 0; i <= 8; i++) { const u = i / 8; vr.push(new T.Vector2(0.03 + 0.035 * Math.abs(u - 0.5) * 2, (u - 0.5) * 0.14)); }
    const vg = new T.LatheGeometry(vr, S(14)); vg.rotateX(Math.PI / 2); vg.translate(xs - 0.06, yTop - 0.02, 0); put(M.rubber, vg);
    const wy = yTop - 0.24;
    cyl(M.strap, 0.035, 0.035, 0.07, [xs + 0.05, wy, 0], 'z', S(14));                 // the drum, its strap wound
    cyl(M.galv, 0.05, 0.05, 0.004, [xs + 0.05, wy, 0.038], 'z', S(16)); cyl(M.galv, 0.05, 0.05, 0.004, [xs + 0.05, wy, -0.038], 'z', S(16));
    rbox(M.galv, 0.1, 0.12, 0.05, 0.01, [xs + 0.05, wy, 0.07], 0);                     // the gear case
    const crank = [[xs + 0.05, wy, 0.1], [xs + 0.05, wy, 0.13], [xs + 0.05, wy - 0.18, 0.13], [xs + 0.05, wy - 0.18, 0.16]];
    tube(M.galv, crank, 0.008, 16); cyl(M.black, 0.013, 0.013, 0.09, [xs + 0.05, wy - 0.18, 0.2], 'z', S(10));
    latchAt(xs - 0.06, bw.y + 0.03, 0, [bw.x - 0.02, bw.y + 0.08, 0]);
  }

  // a SOLID lathe section from an open polyline (r, y): offset t/2 either side along its normal, the two sides joined
  // into one closed loop - a lathe of it has every face wound outward from the material, whatever side is seen
  function solidSection(line, t) {
    const N = line.map((q, i) => {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      let dr = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dr, dy) || 1; dr /= l; dy /= l;
      return [dy, -dr];   // (the lathe's own outward normal for a segment along (dr, dy))
    });
    const A = line.map((q, i) => new T.Vector2(q[0] + N[i][0] * t / 2, q[1] + N[i][1] * t / 2));
    const B = line.map((q, i) => new T.Vector2(q[0] - N[i][0] * t / 2, q[1] - N[i][1] * t / 2)).reverse();
    return A.concat(B, [A[0].clone()]);
  }
  // ---- THE WHEELS: one wheel's parts (its axis +z, the outer face +z), instanced x 5 ----
  const W = { tyre: [], wheel: [], drum: [], chrome: [] };
  { const r = wheelR, w = 0.185, rr = 0.178, n = S(32);
    // the tyre's section (r, z): bead, sidewall bulge, the shoulder, the tread with three grooves
    const P = [];
    const sec = [[rr, -w * 0.38], [rr + 0.02, -w * 0.46], [0.235, -w * 0.5], [0.262, -w * 0.47], [0.282, -w * 0.4], [0.29, -w * 0.33],
                 [0.292, -w * 0.22], [0.284, -w * 0.21], [0.284, -w * 0.17], [0.292, -w * 0.16], [0.292, -w * 0.03], [0.284, -w * 0.02], [0.284, w * 0.02], [0.292, w * 0.03],
                 [0.292, w * 0.16], [0.284, w * 0.17], [0.284, w * 0.21], [0.292, w * 0.22], [0.29, w * 0.33], [0.282, w * 0.4], [0.262, w * 0.47], [0.235, w * 0.5], [rr + 0.02, w * 0.46], [rr, w * 0.38]];
    for (const [R, Z] of sec) P.push(new T.Vector2(R * r / 0.292, Z));
    const tg = new T.LatheGeometry(P, n); tg.rotateX(Math.PI / 2); W.tyre.push(tg);
    // the pressed-steel wheel: the rim's flanges and well, the dished disc, its vent holes (dark), five studs' nuts
    const rim = [[rr - 0.004, w * 0.36], [rr + 0.012, w * 0.38], [rr + 0.008, w * 0.33], [rr - 0.006, w * 0.3], [rr - 0.02, w * 0.12], [rr - 0.02, -w * 0.12], [rr - 0.006, -w * 0.3], [rr + 0.008, -w * 0.33], [rr + 0.012, -w * 0.38], [rr - 0.004, -w * 0.36]];
    // (12 Nov, the user: "a normal flip issue on the walls of your rims": the rim and the disc were single sheets - their
    //  back faces, the rim's well and the flanges' inner walls, were culled: the wheel was see-through between the disc and
    //  the bead. Each is now a SOLID section 4 mm thick, its two faces wound outward from the metal)
    const rg = new T.LatheGeometry(solidSection(rim.map(([R, Z]) => [R, Z]).reverse(), 0.004), n); rg.rotateX(Math.PI / 2); W.wheel.push(rg);
    const disc = [[0.035, 0.035], [0.06, 0.036], [0.085, 0.03], [0.12, 0.012], [0.15, 0.0], [rr - 0.02, -0.01]];
    const dg = new T.LatheGeometry(solidSection(disc, 0.004), n); dg.rotateX(Math.PI / 2); W.wheel.push(dg);
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + Math.PI / 5;
      const h = new T.CylinderGeometry(0.018, 0.018, 0.004, S(12)); h.scale(1.5, 1, 1); h.rotateX(Math.PI / 2); h.rotateZ(a); h.translate(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0.011); W.drum.push(h); }
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5, R = 0.056;
      const nut = new T.CylinderGeometry(0.0095, 0.0095, 0.016, 6); nut.rotateX(Math.PI / 2); nut.translate(Math.cos(a) * R, Math.sin(a) * R, 0.044); W.chrome.push(nut); }
    const cap = []; for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; cap.push(new T.Vector2(Math.sin(a) * 0.032, 0.05 + Math.cos(a) * 0.018)); }
    cap.push(new T.Vector2(0.032, 0.035));
    const cg = new T.LatheGeometry(cap.reverse(), S(16)); cg.rotateX(Math.PI / 2); W.chrome.push(cg);   // (bottom to top: the faces out)
    // the brake drum behind the disc
    const drum = new T.CylinderGeometry(0.12, 0.12, 0.08, S(20)); drum.rotateX(Math.PI / 2); drum.translate(0, 0, -0.06); W.drum.push(drum);
  }

  // ---- MERGE: one mesh per material (the frame), one InstancedMesh per wheel part ----
  function merge(list) {
    let n = 0; const flat = list.map(g => { const q = g.index ? g.toNonIndexed() : g; n += q.attributes.position.count; return q; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let k = 0;
    for (const q of flat) { if (!q.attributes.normal) q.computeVertexNormals(); pos.set(q.attributes.position.array, k * 3); nor.set(q.attributes.normal.array, k * 3); k += q.attributes.position.count; }
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    out.computeBoundingSphere(); out.computeBoundingBox();
    for (const g of list) g.dispose(); return out;
  }
  const group = new T.Group(); group.name = 'trailer'; group.matrixAutoUpdate = false;
  let tris = 0, draws = 0;
  for (const [mat, list] of bins) { const g = merge(list); const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; m.name = 'trailer:' + (mat.name || ''); group.add(m); tris += g.attributes.position.count / 3; draws++; }
  const strap = strapParts.length ? new T.Mesh(merge(strapParts), M.strap) : null;
  if (strap) { strap.castShadow = true; strap.name = 'trailer:strap'; group.add(strap); tris += strap.geometry.attributes.position.count / 3; draws++; }
  const NW = 5, inst = [];
  for (const k of ['tyre', 'wheel', 'drum', 'chrome']) {
    const g = merge(W[k]), mat = k === 'tyre' ? M.rubber : k === 'wheel' ? M.wheel : k === 'drum' ? M.drum : M.chrome;
    const im = new T.InstancedMesh(g, mat, NW); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.name = 'trailer:wheels:' + k;
    group.add(im); inst.push(im); tris += g.attributes.position.count / 3 * NW; draws++;
  }
  // the wheels' places: four on the spindles, the spare flat under the rear (outer face down)
  const wheelAt = [[-ax + spX, -1], [-ax + spX, 1], [ax + spX, -1], [ax + spX, 1]].map(([x, s]) => ({ x, s, z: s * wZ }));
  const mtx = new T.Matrix4(), mR = new T.Matrix4(), mS = new T.Matrix4();
  function poseWheels(spin) {
    for (let i = 0; i < 4; i++) {
      const w = wheelAt[i];
      mtx.makeTranslation(w.x, wheelR, w.z);
      if (w.s < 0) mtx.multiply(mR.makeRotationY(Math.PI));   // the outer face out (-z on the left)
      mtx.multiply(mS.makeRotationZ(w.s < 0 ? spin : -spin));   // rolling forward: the top goes forward
      for (const im of inst) im.setMatrixAt(i, mtx);
    }
    mtx.makeTranslation(xRear + 0.42, railY - railH / 2 - 0.105, 0).multiply(mR.makeRotationX(Math.PI / 2));
    for (const im of inst) { im.setMatrixAt(4, mtx); im.instanceMatrix.needsUpdate = true; }
  }
  poseWheels(0);
  // the spare's carrier: two angle bars under the rails
  // (built after the wheels' list: a late member goes in its own small mesh)
  { const g = []; for (const s of [-1, 1]) { const a = new T.BoxGeometry(0.62, 0.006, 0.04); a.translate(xRear + 0.42, railY - railH / 2 - 0.006, s * 0.2); g.push(a); }
    for (const s of [-1, 1]) { const a = new T.BoxGeometry(0.006, 0.006, 2 * zR); a.translate(xRear + 0.42 + s * 0.3, railY - railH / 2 - 0.003, 0); g.push(a); }
    const m = new T.Mesh(merge(g), M.galvDk); m.castShadow = true; group.add(m); tris += m.geometry.attributes.position.count / 3; draws++; }

  const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3();
  function update(Tp, latched) {
    _a.set(Tp.f[0], Tp.f[1], Tp.f[2]); _b.set(Tp.u[0], Tp.u[1], Tp.u[2]); _c.set(Tp.r[0], Tp.r[1], Tp.r[2]);
    group.matrix.makeBasis(_a, _b, _c).setPosition(Tp.A[0], Tp.A[1], Tp.A[2]); group.matrixWorldNeedsUpdate = true;
    poseWheels(Tp.spin || 0);
    if (strap) strap.visible = latched !== false;
  }
  return { group, update, strap, materials: M, stats: { tris: Math.round(tris), draws, materials: bins.size, x: [xRear, Ld + 0.06], width: 2 * (wZ + 0.15), xFront, xRear } };
}

// THE CAR'S HALF: the tow bar's ball mount for the pickup's receiver (50 mm square shank, the drop plate, the 50 mm ball
// and its neck). Its origin is the ball's centre, +x forward (into the receiver); the car's rig carries it at the ball.
function buildTowHitch(THREE) {
  const T = THREE, gal = new T.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.45 }), chrome = new T.MeshStandardMaterial({ color: 0xe9ebee, metalness: 1, roughness: 0.16 });
  const g = new T.Group(); g.name = 'car:hitch';
  const sh = new T.BoxGeometry(0.32, 0.05, 0.05); sh.translate(0.2, 0.08, 0); g.add(new T.Mesh(sh, gal));
  const pl = new T.BoxGeometry(0.06, 0.11, 0.07); pl.translate(0.03, 0.045, 0); g.add(new T.Mesh(pl, gal));
  const nk = new T.CylinderGeometry(0.014, 0.02, 0.03, 12); nk.translate(0, -0.035 + 0.04 * 0, 0); g.add(new T.Mesh(nk, chrome));
  const ball = new T.SphereGeometry(0.025, 16, 12); g.add(new T.Mesh(ball, chrome));
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}

if (typeof module !== 'undefined') module.exports = { buildTrailerModel, buildTowHitch };
