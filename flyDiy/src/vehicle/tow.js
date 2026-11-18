// ============================================================
// THE TOW LINE (TOW-LAUNCH phase 3, 2026-11-12) - a glider launched behind the car down a runway (an auto-tow). The user:
// "when you select something without an engine, then by default we are getting in a glider tow mode ... we start at the
// start line with the cable and the car". The glider study (futureDesigns/glider-launch/STUDY.md, probe_car_tow.js) proved
// the mechanism: a TENSION-ONLY spring-damper between the car's hitch and the glider's nose hook, applied to the
// aeroplane's solver through its own per-substep hook (sim.onSubstep) as impulses (sim.impulse) - no solver change.
// Pure: no THREE, no DOM. The car is makeVehicle's (vehicle.js); its share of the pull goes back as car.extF.
//
// THE COUPLING. The aeroplane steps its substeps (24-120 a frame), the car its own 4: the line reads the car's hitch at
// the frame's start and its velocity, extrapolated through the frame (the study's frame-lagged coupling, stable with a
// line of a few kN/m), and returns the frame's MEAN pull to the car for its next step.
// THE LINE. EA (N) / L0: a 400 m line of EA 1 MN is 2.5 kN/m - stretchy enough to take the snatch, the probes' nylon.
// Damping for zeta ~0.5 on the glider's mass. A weak link (default 6 kN; a real one is ~1.3-2 x the glider's weight
// class, the auto-tow's ~5-8 kN) breaks it.
// RELEASE. The line's angle above the horizon at the glider past `relDeg` (65 deg: the top of the launch, the glider
// over the car); the car stopped (the runway's end) with the line slack; the weak link; or the player's key (tow.release()).
// ============================================================

// THE TOW HOOK - THE CG RELEASE (the user, 15 Nov: "you should have them towed from an anchor at their main wheel
// position, just forward of it. That's more realistic and may avoid nose over"). A ground launch - the car's tow, a
// winch - pulls at the BELLY release a glider carries for it (Tost Europa G 88 class: GEN_RULES.towHook.cg), just ahead
// of the main wheel; the nose release is the aerotow's. The pull near the wheel and under the CG cannot lever the
// glider over its wheel onto its nose: it rotates into the climb on its own (the old hook - the most forward node in
// the lower half - was the Archaeopteryx's NOSEWHEEL: the line took it up and stood the glider on its nose, 23 deg,
// then rolled it onto a wingtip at 6 s).
//   1. the build's own CG release (refs.towHook, 61_gen_frame: a node on the belly's hard structure `ahead` of the
//      mains) - a hook within TOW_CG.near of the mains' station is the CG one (a nose release stands metres ahead);
//   2. else the same site, unfitted: the station TOW_CG.ahead ahead of the mains, the lowest structure there that is not
//      the gear - the keel node, or a corner ring's bottom pair - every glider and motorglider tows from there.
// With its neighbours within TOW_CG.spread (the release's ring: the pull over the hard nodes round it, not one light
// node). sim.refs() is the solver's def.refs; `refs` may be given (a caller holding the def)
const TOW_CG = { ahead: 0.25, near: 0.8, spread: 0.3, side: 0.6, band: 0.35 };
function towHookNodes(sim, refs) {
  const R = refs || (typeof sim.refs === 'function' ? sim.refs() : null) || {};
  const n = sim.n, p = sim.p, A = sim.axes(), fx = -A[0][0], fy = -A[0][1], fz = -A[0][2], zR = A[2];
  const P = i => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
  const mains = (R.mains || []).filter(i => i >= 0 && i < n), gear = new Set([...mains, R.tw, R.tw2].filter(i => i != null && i >= 0));
  // the mains' station (their mean), and a point's along / across / up from it
  let M = null;
  if (mains.length) { M = [0, 0, 0]; for (const i of mains) { const q = P(i); M[0] += q[0] / mains.length; M[1] += q[1] / mains.length; M[2] += q[2] / mains.length; } }
  const rel = (q, o) => { const dx = q[0] - o[0], dy = q[1] - o[1], dz = q[2] - o[2]; return { a: dx * fx + dy * fy + dz * fz, s: dx * zR[0] + dy * zR[1] + dz * zR[2] }; };
  let hook = -1;
  if (M && R.towHook && R.towHook.length) { const h = R.towHook[0], r = rel(P(h), M); if (h >= 0 && h < n && r.a > -0.1 && r.a < TOW_CG.near) hook = h; }
  if (hook < 0 && M) {
    // (unfitted: the belly at that station - the lowest structure node there, not the gear's, within the body's width; a
    //  frame of corner rings has no keel node, so the hook is that ring's bottom PAIR - the pull on the centreline between
    //  them, as 61_gen_frame ties a fitted release to them)
    let best = Infinity, bi = -1;
    for (let i = 0; i < n; i++) {
      if (gear.has(i)) continue;
      const q = P(i), r = rel(q, M);
      if (Math.abs(r.s) > TOW_CG.side || Math.abs(r.a - TOW_CG.ahead) > TOW_CG.band || q[1] < M[1] + 0.08) continue;   // (above the axle: the belly, not the wheel)
      if (q[1] < best) { best = q[1]; bi = i; }
    }
    if (bi >= 0) {
      const rb = rel(P(bi), M), pair = [];
      for (let i = 0; i < n; i++) { if (gear.has(i)) continue; const q = P(i), r = rel(q, M);
        if (Math.abs(r.a - rb.a) < 0.06 && Math.abs(q[1] - best) < 0.06 && Math.abs(r.s) <= TOW_CG.side) pair.push(i); }
      return pair;
    }
  }
  if (hook < 0) {   // (no mains at all - a float or a hull on the water: the nose, as before)
    const cg = sim.cgPos(); let best = -1e9;
    for (let i = 0; i < n; i++) { const r = rel(P(i), cg), dy = p[i * 3 + 1] - cg[1]; if (Math.abs(r.s) < 0.25 && dy < 0.3 && r.a > best) { best = r.a; hook = i; } }
  }
  const out = [hook], h = P(hook);
  for (let i = 0; i < n; i++) if (i !== hook && !gear.has(i) && Math.hypot(p[i * 3] - h[0], p[i * 3 + 1] - h[1], p[i * 3 + 2] - h[2]) < TOW_CG.spread) out.push(i);
  return out;
}

// THE NOSE RELEASE's site (the aerotow's; the car tow's before 15 Nov): the most forward node near the centre plane in the
// lower half, with its neighbours within 0.3 m - GATE TOW's TAKEUP row tows on it too, the before against the after
function towNoseNodes(sim) {
  const n = sim.n, p = sim.p, A = sim.axes(), cg = sim.cgPos();
  const fx = -A[0][0], fy = -A[0][1], fz = -A[0][2], zR = A[2];
  let hook = -1, best = -1e9;
  for (let i = 0; i < n; i++) {
    const dx = p[i * 3] - cg[0], dy = p[i * 3 + 1] - cg[1], dz = p[i * 3 + 2] - cg[2];
    const ahead = dx * fx + dy * fy + dz * fz, side = dx * zR[0] + dy * zR[1] + dz * zR[2];
    if (Math.abs(side) < 0.25 && dy < 0.3 && ahead > best) { best = ahead; hook = i; }
  }
  const out = [hook];
  for (let i = 0; i < n; i++) if (i !== hook && Math.hypot(p[i * 3] - p[hook * 3], p[i * 3 + 1] - p[hook * 3 + 1], p[i * 3 + 2] - p[hook * 3 + 2]) < 0.3) out.push(i);
  return out;
}

// sim: the glider's makeSim; car: makeVehicle; o: { L0 (400 m), EA (1e6 N), zeta (0.5), weak (6000 N), relDeg (65), hitch
// (the car's body point; default its rear bumper's middle, 0.5 m up), hook: [nodes] }
function makeTowLine(sim, car, o) {
  o = o || {};
  const hook = o.hook || towHookNodes(sim), nh = hook.length;
  const L0 = o.L0 || 400, k = (o.EA || 1e6) / L0;
  const mG = sim.totalM || 300, c = 2 * (o.zeta ?? 0.5) * Math.sqrt(k * mG);
  const weak = o.weak || 6000, relDeg = o.relDeg ?? 65;
  // (the car's drawn tow ball when its sheet has one - vehicleDef's def.hitch, the CAR session's garage cars; else the
  //  reference point's body x less the rear overhang, 0.5 m up: the conquer's)
  const hitchB = o.hitch || car.def.hitch || [car.def.steer.xRef - car.def.foot.rear, 0.5, 0];
  const T = { on: true, released: null, L: 0, T: 0, Tmax: 0, angle: 0, slack: 0, hook, hitch: hitchB, L0, k, c, weak,
              Fcar: [0, 0, 0], frameN: 0, carP: [0, 0, 0], carV: [0, 0, 0], tRel: null };
  const prevHook = sim.onSubstep;   // (no chaining in the solver's setter: one reader; the line is it while attached)
  const hookPos = () => { let x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0; for (const i of hook) { x += sim.p[i * 3]; y += sim.p[i * 3 + 1]; z += sim.p[i * 3 + 2]; vx += sim.v[i * 3]; vy += sim.v[i * 3 + 1]; vz += sim.v[i * 3 + 2]; } return [x / nh, y / nh, z / nh, vx / nh, vy / nh, vz / nh]; };
  let acc = [0, 0, 0], accT = 0;
  sim.onSubstep = (s, dt) => {
    if (!T.on) return;
    const t = (s + 1) * dt, hx = T.carP[0] + T.carV[0] * t, hy = T.carP[1] + T.carV[1] * t, hz = T.carP[2] + T.carV[2] * t;
    const H = hookPos(), dx = hx - H[0], dy = hy - H[1], dz = hz - H[2], L = Math.hypot(dx, dy, dz) || 1e-9;
    const ux = dx / L, uy = dy / L, uz = dz / L;
    const rate = (T.carV[0] - H[3]) * ux + (T.carV[1] - H[4]) * uy + (T.carV[2] - H[5]) * uz;   // the stretch rate
    let F = 0;
    if (L > L0) { F = k * (L - L0) + c * rate; if (F < 0) F = 0; }
    T.L = L; T.T = F; if (F > T.Tmax) T.Tmax = F;
    if (F > weak) { T.on = false; T.released = 'the weak link broke (' + (F / 1000).toFixed(1) + ' kN)'; return; }
    if (F > 0) { const J = F * dt / nh; for (const i of hook) sim.impulse(i, ux * J, uy * J, uz * J); }
    acc[0] -= ux * F * dt; acc[1] -= uy * F * dt; acc[2] -= uz * F * dt; accT += dt;
    if (F <= 0) T.slack++;
  };
  // before the frame's steps: the hitch's place and velocity (the car's state at the frame's start)
  T.before = () => {
    const P = car.toWorld(hitchB), A = car.axes(), v = car.st.v, w = car.st.w, cgW = car.toWorld(car.def.cg), r = [P[0] - cgW[0], P[1] - cgW[1], P[2] - cgW[2]];
    T.carP = P; T.carV = [v[0] + w[1] * r[2] - w[2] * r[1], v[1] + w[2] * r[0] - w[0] * r[2], v[2] + w[0] * r[1] - w[1] * r[0]];
    acc = [0, 0, 0]; accT = 0;
  };
  // after the aeroplane's frame: the mean pull back onto the car (for its step), the line's angle, the releases
  T.after = (dtFrame) => {
    if (!T.on) { car.extF = null; return; }
    const m = accT > 0 ? 1 / accT : 0;
    T.Fcar = [acc[0] * m, acc[1] * m, acc[2] * m];
    car.extF = { f: T.Fcar, at: hitchB };
    const H = hookPos(), dx = H[0] - T.carP[0], dz = H[2] - T.carP[2], dy = H[1] - T.carP[1];
    T.angle = Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI;
    // THE TOP OF THE LAUNCH: the line past relDeg, or the climb over - above 30 m with the line slack for 2 s (the glider
    // has caught up with its own line), or its angle no higher than 4 s ago (a pilot releases there: hanging on, the
    // glider overruns the car and porpoises on a slack line - measured: at 275 m, 45 s on, it banked 26 deg)
    const agl = H[1] - (o.groundAt ? o.groundAt(H[0], H[2]) : T.carP[1]);
    T.hist = T.hist || []; T.hist.push([T.tOn || 0, T.angle]); while (T.hist.length && T.hist[0][0] < (T.tOn || 0) - 4) T.hist.shift();
    T.slackT = T.T <= 0 ? (T.slackT || 0) + dtFrame : 0;
    if (T.angle > relDeg) T.release('the top of the launch (the line ' + T.angle.toFixed(0) + ' deg up)');
    else if (agl > 30 && T.slackT > 2) T.release('the top of the launch (the line slack at ' + agl.toFixed(0) + ' m)');
    else if (agl > 30 && T.angle > 20 && T.hist.length > 30 && (T.tOn || 0) > 10 && T.angle <= T.hist[0][1]) T.release('the top of the launch (the climb over at ' + agl.toFixed(0) + ' m)');
    else if (Math.abs(car.out.u) < 0.3 && T.T <= 0 && T.tOn > 5) T.release('the car stopped');
    T.tOn = (T.tOn || 0) + dtFrame;
  };
  T.release = (why) => { if (!T.on) return; T.on = false; T.released = why || 'released by the pilot'; car.extF = null; };
  T.detach = () => { T.on = false; car.extF = null; if (sim.onSubstep !== undefined) sim.onSubstep = prevHook || null; };
  return T;
}

// THE TOWED GLIDER'S HANDS (the gate's; the page's player flies): wings level on the ailerons, the nose on the line with
// the rudder, the pitch by height - never past `maxPitch`
function makeTowHands(sim, o) {
  o = o || {};
  const g0 = o.ground || 0, maxP = o.maxPitch ?? 32;
  const cl = (x, m) => Math.max(-m, Math.min(m, x));
  // (the signs are the glider study's, flown: probe_aerotow - bank + = the right wing down, a negative aileron rolls it up;
  //  the nose left of the line + , a negative rudder yaws it right)
  // THE WING RUNNER (the user via A0, 15 Nov - a glider on one wheel rests on a wingtip): a person at the right wingtip
  // holds the wings level - a vertical hand on the tip, a spring and a damper on the bank, at most WING_RUN.F - and runs
  // with it to WING_RUN.V (a sprint), then lets go; the ailerons have the air by then. Its tip: the node farthest to the
  // right at the start
  let tip = -1, bank0 = null, pitch0 = null, head0 = null, runner = o.wingRunner !== false;
  { const c0 = sim.cgPos(), z0 = sim.axes()[2]; let best = -1e9;
    for (let i = 0; i < sim.n; i++) { const s = (sim.p[i * 3] - c0[0]) * z0[0] + (sim.p[i * 3 + 1] - c0[1]) * z0[1] + (sim.p[i * 3 + 2] - c0[2]) * z0[2]; if (s > best) { best = s; tip = i; } } }
  const hands = (tow, dt) => {
    const A = sim.axes(), xA = A[0], zR = A[2], cg = sim.cgPos(), agl = cg[1] - g0, v = sim.cgVel(), V = Math.hypot(v[0], v[1], v[2]);
    const pitch = Math.asin(cl(-xA[1], 1)) * 57.3, bankR = -Math.asin(cl(zR[1], 1)) * 57.3;
    const rate = bank0 == null || !(dt > 0) ? 0 : (bankR - bank0) / dt; bank0 = bankR;
    const pRate = pitch0 == null || !(dt > 0) ? 0 : (pitch - pitch0) / dt; pitch0 = pitch;
    const gam = Math.atan2(v[1], Math.hypot(v[0], v[2])) * 57.3;   // (the flight path's angle)
    hands.runF = 0;
    if (runner && tip >= 0 && V < WING_RUN.V && sim.wheelsOnGround() > 0) {
      const F = cl(WING_RUN.k * bankR / 57.3 + WING_RUN.c * rate / 57.3, WING_RUN.F);   // (bank + = the right wing down: lift it)
      sim.impulse(tip, 0, F * dt, 0); hands.runF = F;
    } else if (V >= WING_RUN.V) runner = false;     // (let go - the run is over for good)
    const fx = -xA[0], fz = -xA[2];
    let headL = 0;
    if (tow && tow.on) { const dx = tow.carP[0] - cg[0], dz = tow.carP[2] - cg[2], l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;   // the line's direction
      headL = Math.atan2(fx * uz - fz * ux, fx * ux + fz * uz) * 57.3; }   // + the nose left of the line
    const onG = sim.wheelsOnGround() > 0;
    // the pitch: on the ground the elevator neutral to 15 m/s (the tail lifts with the speed), then the flying attitude;
    // in the air up by the height made - the auto-tow's steep climb under the line's pull
    if (onG && V < 15) sim.ctl.de = 0;
    else {
      let want = onG ? 6 : (!tow || !tow.on) ? (o.glidePitch ?? 0) : Math.min(maxP, 6 + Math.max(0, agl) * 0.45);   // (released - or no line at all, a push start down a slope: the glide's attitude)
      // THE ANGLE OF ATTACK HELD (15 Nov): a CG release rotates the glider nose-up by itself - the winch launch's whole
      // point - so on the line the attitude never leads the flight path by more than TOW_AOA (lower near the ground,
      // where a wing that drops has no room): the Archaeopteryx, lifted off at 18.6 m/s, pitched to 13 deg in a
      // second, stalled a wing and rolled to 80 deg on full aileron. The pitch's rate damps the elevator
      if (tow && tow.on && !onG) want = Math.min(want, gam + (agl < 15 ? TOW_AOA.low : TOW_AOA.high));
      sim.ctl.de = cl(0.06 * (want - pitch) - 0.015 * pRate, 0.7);
    }
    // (the wings on the ROLL: firmer, damped by the bank's rate and with no heading in them - on one wheel a drift of 8 deg
    //  puts a 15 m wing's tip on the grass, and its drag then rolls the glider over; in the air as before)
    sim.ctl.da = onG ? cl(-0.08 * bankR - 0.02 * rate, 0.7) : cl(-0.03 * bankR + 0.02 * headL, 0.7);
    // (the rudder DAMPED by the heading's rate: undamped, the nose swung 4.6 deg either side of the line in 0.7 s, and on
    //  one tall wheel each swing's tyre force - 0.8 m under the CG - rolled the glider; at the lift-off the ailerons lost it)
    const hRate = head0 == null || !(dt > 0) ? 0 : (headL - head0) / dt; head0 = headL;
    sim.ctl.dr = cl(-0.04 * headL - 0.03 * hRate, 0.7);
    sim.ctl.thr = 0;
    return { pitch, bank: bankR, agl, headL, runF: hands.runF };
  };
  return hands;
}
// (the runner: a hand of at most 200 N on the tip, ~700 N a radian of bank and its rate damped, to 6 m/s - a sprint)
const WING_RUN = { V: 6, F: 200, k: 700, c: 250 };
// (the angle of attack the hands allow on the line, deg: under 15 m up, and above)
const TOW_AOA = { low: 6, high: 9 };

// (THE SLOPE'S PULL, 12 Nov - the stopgap that rolled a push start down Skyline Altiport while the solver's ground pushed
//  straight up - is gone: the solver's ground pushes along the terrain's normal now (TOW-LAUNCH slope reaction, 30_solver.js,
//  GATE SLOPE), and the two together would have doubled the slope)

// THE LINE'S END (the user via A0, 15 Nov: "a ring, the line meeting it"): the Tost ring pair a tow rope ends in - the
// LARGE ring (54 mm, 6 mm stock) in the release's jaw, the SMALL one (40 mm) linked through it, crossed at right angles,
// and the rope's eye spliced round the small one (a thimble, 6 cm of doubled rope). For the page's rope: towRingRig(THREE)
// -> { group, pose(hook [x,y,z], toward [x,y,z]) } - the large ring hung at the release's jaw (the hook nodes' mean), the
// pair laid along the line to the first point of the drawn rope. Bright galvanised steel; ~1.3 k triangles.
function towRingRig(T) {
  const g = new T.Group(); g.name = 'towRings';
  const steel = new T.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.85, roughness: 0.32 });
  const rope = new T.MeshStandardMaterial({ color: 0xf2e6c8, metalness: 0, roughness: 0.9 });
  const big = new T.Mesh(new T.TorusGeometry(0.027, 0.003, 10, 32), steel);
  const small = new T.Mesh(new T.TorusGeometry(0.020, 0.0028, 10, 28), steel);
  // (the eye: 0.8 of a loop, its gap turned to face along the line - the two legs leave it forward into the doubled rope)
  const eyeG = new T.TorusGeometry(0.016, 0.0045, 8, 24, Math.PI * 1.6); eyeG.rotateZ(Math.PI * 1.2);
  const eye = new T.Mesh(eyeG, rope);
  const tail = new T.Mesh(new T.CylinderGeometry(0.0045, 0.0045, 0.06, 8), rope);
  for (const m of [big, small, eye, tail]) { m.castShadow = true; g.add(m); }
  const X = new T.Vector3(), Y = new T.Vector3(), Z = new T.Vector3(), M = new T.Matrix4(), q = new T.Quaternion();
  const place = (m, at, x, y, z) => { M.makeBasis(x, y, z); q.setFromRotationMatrix(M); m.quaternion.copy(q); m.position.copy(at); };
  return { group: g, pose(hook, toward) {
    // the line's direction (u), a side (s) square to it and level, and the third (w)
    const u = new T.Vector3(toward[0] - hook[0], toward[1] - hook[1], toward[2] - hook[2]); if (u.lengthSq() < 1e-9) u.set(1, 0, 0); u.normalize();
    const s = new T.Vector3().crossVectors(u, new T.Vector3(0, 1, 0)); if (s.lengthSq() < 1e-6) s.set(0, 0, 1); s.normalize();
    const w = new T.Vector3().crossVectors(s, u).normalize();
    const H = new T.Vector3(hook[0], hook[1], hook[2]);
    // a torus lies in its own x-y plane: the large ring's plane holds the line and the vertical (u, w); its far edge in the jaw
    const cBig = H.clone().addScaledVector(u, 0.022);
    place(big, cBig, X.copy(u), Y.copy(w), Z.copy(s));
    // the small ring through it, crossed: its plane (u, s)
    const cSmall = cBig.clone().addScaledVector(u, 0.027 + 0.020 - 0.006);
    place(small, cSmall, X.copy(u), Y.copy(s), Z.copy(w).negate());
    // the rope's eye round the small ring's far side, and the doubled rope leaving it
    const cEye = cSmall.clone().addScaledVector(u, 0.020);
    place(eye, cEye, X.copy(u).negate(), Y.copy(w), Z.copy(s).negate());
    const cTail = cEye.clone().addScaledVector(u, 0.016 + 0.03);
    place(tail, cTail, X.copy(s), Y.copy(u), Z.copy(w));   // (a right-handed basis: s x u = w; the cylinder's axis along the line)
    return cTail.clone().addScaledVector(u, 0.03).toArray();   // (where the drawn rope begins)
  } };
}

if (typeof module !== 'undefined') module.exports = { towHookNodes, towNoseNodes, makeTowLine, makeTowHands, towRingRig, TOW_CG, WING_RUN, TOW_AOA };
