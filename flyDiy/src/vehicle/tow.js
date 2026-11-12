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

// the glider's nose hook: the most forward node near the centre plane in the lower half (the study's), with its
// neighbours within 0.3 m (the pull spread over a cluster, not one light node)
function towHookNodes(sim) {
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
  const hitchB = o.hitch || [car.def.steer.xRef - car.def.foot.rear, 0.5, 0];   // (the reference point's body x less the rear overhang)
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
  return (tow, dt) => {
    const A = sim.axes(), xA = A[0], zR = A[2], cg = sim.cgPos(), agl = cg[1] - g0, v = sim.cgVel(), V = Math.hypot(v[0], v[1], v[2]);
    const pitch = Math.asin(cl(-xA[1], 1)) * 57.3, bankR = -Math.asin(cl(zR[1], 1)) * 57.3;
    const fx = -xA[0], fz = -xA[2];
    let headL = 0;
    if (tow && tow.on) { const dx = tow.carP[0] - cg[0], dz = tow.carP[2] - cg[2], l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;   // the line's direction
      headL = Math.atan2(fx * uz - fz * ux, fx * ux + fz * uz) * 57.3; }   // + the nose left of the line
    const onG = sim.wheelsOnGround() > 0;
    // the pitch: on the ground the elevator neutral to 15 m/s (the tail lifts with the speed), then the flying attitude;
    // in the air up by the height made - the auto-tow's steep climb under the line's pull
    if (onG && V < 15) sim.ctl.de = 0;
    else { const want = onG ? 6 : (!tow || !tow.on) ? (o.glidePitch ?? 0) : Math.min(maxP, 6 + Math.max(0, agl) * 0.45); sim.ctl.de = cl(0.05 * (want - pitch), 0.7); }   // (released - or no line at all, a push start down a slope: the glide's attitude)
    sim.ctl.da = cl(-0.03 * bankR + 0.02 * headL, 0.7);
    sim.ctl.dr = cl(-0.04 * headL, 0.7);
    sim.ctl.thr = 0;
    return { pitch, bank: bankR, agl, headL };
  };
}

// THE SLOPE'S PULL (TOW-LAUNCH, 12 Nov - a push start down Skyline Altiport): the solver's ground pushes each contact
// STRAIGHT UP (30_solver.js: f[y] += Fn; the friction horizontal), so a slope never rolls an aeroplane downhill - a
// glider pushed off on Skyline's 10 % stopped in 13 s. Until the solver's ground knows its normal (a core change, the
// user's call), a launch down a slope adds it: while a wheel is on the ground, g x the terrain's grade along the roll
// direction (dx, dz), on every node's mass, one frame's impulse. The cost: 3 terrain reads and n impulses a frame
function slopePull(sim, world, dx, dz, dt) {
  if (!(sim.wheelsOnGround() > 0)) return 0;
  const q = sim.cgPos(), gr = (world.terrainH(q[0] + dx, q[2] + dz) - world.terrainH(q[0] - dx, q[2] - dz)) / 2;
  for (let i = 0; i < sim.n; i++) { const J = -9.81 * gr * sim.m[i] * dt; sim.impulse(i, dx * J, 0, dz * J); }
  return gr;
}

if (typeof module !== 'undefined') module.exports = { towHookNodes, makeTowLine, makeTowHands, slopePull };
