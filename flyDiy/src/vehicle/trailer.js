// ============================================================
// THE LAUNCH TRAILER (TOW-LAUNCH phase 4, 2026-11-12) - a floatplane (or a flying boat) carried down a runway on a
// trailer behind the car, and flying off it: "floatplanes / boatplanes launched from a trailer pulled by the car down a
// runway" (the brief), an exception to the floats-need-water rule. The glider study's probe_trailer.js proved the
// mechanism (futureDesigns/glider-launch/STUDY.md, `[Vdeck]`): the trailer is PADS ON THE AIRCRAFT'S KEEL NODES, through
// the solver's own per-substep hook (sim.onSubstep + sim.impulse, the tow line's way) - not a moving ground: the solver's
// ground stays the static world's (its clearance cone, its ceiling box, its terrain memo untouched). No solver change.
// Pure: no THREE, no DOM (the model is trailer_model.js).
//
// THE FIT (trailerFit). The cradle is fitted to the build: the float keels (the floats' own keel nodes, 32_hydro's
// rec.K) or the hull's keel and chines; the bunks sit under them at the keel's height, the plane's CG a little ahead of
// the axles (the tongue's 6-10 %), the drawbar long enough that the nose (the prop) stays clear of the pickup's tailgate.
//
// THE TRAILER (makeTrailer). Kinematic behind the car's tow ball: the axles' centre follows the ball on the drawbar's
// length (a two-wheeled trailer's tractrix - its tyres do not slip sideways), on the ground under its wheels. Its share
// of the pull goes back to the car through the ball as car.extF, from the trailer's own equations each frame:
//   along:    m a = H + R_f - Crr N           (the ball's pull H, the aeroplane's push on the cradle R, the tyres' roll)
//   vertical: the moments about the axles      (the ball carries the tongue's share; the plane lifting off, it lightens)
//   sideways: the moments about the axles      (the cradle's side loads the ball's share)
// The plane's push R is the cradle's reaction, summed over the aeroplane's substeps (the frame's mean, the tow line's
// frame-lagged coupling: stable for a trailer a fifth of the car's mass).
//
// THE CRADLE. Each pad a spring-damper to its bunk point, which PUSHES UP ONLY (a dolly never holds a plane down - the
// study's first probe held down and the plane could never rotate) and holds in the bunk's plane by its carpet's friction
// (mu 0.6). THE LATCH, closed: a strap from the bow stop to each float's bow eye holds the plane fore and aft and
// sideways whatever its weight on the bunks (its strength, 7 kN: past it the strap's release lets go and says so);
// it OPENS when the cradle's load averaged over 0.25 s falls under 10 % of the weight (the study's: the wing carries
// it) - a pilot's tug never; the bunks stay under it (an aborted run keeps the plane on its trailer).
//
// THE COSTS, a 60 Hz frame: the cradle 4-6 pads a solver substep (a dozen flops each, the impulse); the trailer's pose
// and its loads once a frame (~2 us). Measured by GATE TRAILER's PERF.
// ============================================================

const TR_G = 9.81;

// the bottom of the build: the keel nodes the cradle carries. Floats: each float's keel (the hydro's rec.K) - the two
// lowest of each, fore and aft of the step (the planing bottom). Hull: the keel's two lowest and a chine node each side
// fore and aft (a V on two keel pads would roll off).
// (pitchDeg: the cradle's attitude - the build's frame turned nose-up by it about its CG before it is read)
function trailerKeel(sim, pitchDeg, P0) {
  const n = sim.n, p = P0 || sim.p, A = sim.axes(), cg = sim.cgPos();
  const F = [-A[0][0], -A[0][1], -A[0][2]], U = A[1], R = A[2];
  const th = (pitchDeg || 0) * Math.PI / 180, ct = Math.cos(th), st = Math.sin(th);
  const loc0 = i => { const dx = p[i * 3] - cg[0], dy = p[i * 3 + 1] - cg[1], dz = p[i * 3 + 2] - cg[2];
    return [dx * F[0] + dy * F[1] + dz * F[2], dx * U[0] + dy * U[1] + dz * U[2], dx * R[0] + dy * R[1] + dz * R[2]]; };
  const loc = i => { const q = loc0(i); return [q[0] * ct - q[1] * st, q[0] * st + q[1] * ct, q[2]]; };
  // (the pads are CHOSEN on the build's own frame - its keel as built, the planing bottom's two lowest stations - and
  //  READ on the cradle's: turned nose-up, the lowest would be the step's and the tail's, a bunk under the CG)
  const rot = q => [q[0] * ct - q[1] * st, q[0] * st + q[1] * ct, q[2]];
  let lowY = Infinity, lowY0 = Infinity; for (let i = 0; i < n; i++) { lowY = Math.min(lowY, loc(i)[1]); lowY0 = Math.min(lowY0, loc0(i)[1]); }
  const H = sim.hydro, recs = H && H.floats ? H.floats.map(f => f.rec) : [];
  const hullRec = recs.find(r => r.hull), floats = recs.filter(r => !r.hull && !r.tip);
  const pads = [], keels = [];
  if (!hullRec && floats.length) {
    for (const r of floats) {
      const K = r.K.map(i => ({ i, q: loc0(i) }));
      keels.push({ side: r.side, P: r.P, K: K.map(k => rot(k.q)) });
      const bot = K.slice().sort((a, b) => a.q[1] - b.q[1]).slice(0, 2).sort((a, b) => b.q[0] - a.q[0]);   // the two lowest, bow first
      for (const k of bot) pads.push({ i: k.i, q: rot(k.q), kind: 'keel', float: r.side });
    }
    return { kind: 'floats', pads, keels, lowY, loc };
  }
  // A HULL: its keel's two lowest nodes (the keel rollers) and, each side, the structure's lowest node fore and aft of
  // the CG within the hull's beam (the bunks: the frames' bottom corners - the solver's hull is a keel and its frames;
  // a V on its keel alone would roll off). The wing-tip floats ride clear (high, out at the tips).
  const Kh = hullRec ? hullRec.K : null, B = hullRec ? hullRec.P.B : 1.2;
  const near = []; for (let i = 0; i < n; i++) { const q = loc0(i); if (q[1] - lowY0 < 0.3 && Math.abs(q[0]) < 3) near.push({ i, q }); }
  const keel = (Kh ? Kh.map(i => ({ i, q: loc0(i) })) : near.filter(k => Math.abs(k.q[2]) < 0.08)).sort((a, b) => a.q[1] - b.q[1]).slice(0, 2).sort((a, b) => b.q[0] - a.q[0]);
  for (const k of keel) pads.push({ i: k.i, q: rot(k.q), kind: 'keel', float: 0 });
  for (const s of [-1, 1]) {
    const side = near.filter(k => k.q[2] * s > 0.2 && Math.abs(k.q[2]) < B / 2 + 0.1 && !(Kh && Kh.includes(k.i)));
    const fore = side.filter(k => k.q[0] > 0).sort((a, b) => a.q[1] - b.q[1])[0], aft = side.filter(k => k.q[0] <= 0).sort((a, b) => a.q[1] - b.q[1])[0];
    for (const k of [fore, aft]) if (k) pads.push({ i: k.i, q: rot(k.q), kind: 'chine', float: s });
  }
  keels.push({ side: 0, P: hullRec ? hullRec.P : null, K: (Kh ? Kh.map(loc) : keel.map(k => rot(k.q))) });
  return { kind: 'hull', pads, keels, lowY, loc };
}

// trailerFit(sim, o): the cradle fitted to the build standing on its bottom (settled). o: { deckH (the keel's height
// over the ground, 0.78 m), cgAhead (the plane's CG ahead of the axles, 0.25 m), clear (the nose to the tow ball, 1.4 m),
// pitch (the cradle's attitude, 6 deg nose-up: a launch dolly holds the wing near its lift-off angle - on a level cradle
// the wing sat at ~1 deg and 1.45 VRot lifted a quarter of the weight, measured; the aft bunks lower, the fore higher) }
// -> { kind, pads [{ i, at [x, y, z] the trailer's frame }], deckH, Ld (the ball to the axles), cgX, frame [x0, x1],
//      floats [{ z, B, beta, keel [[x, y]...] }] | hull, front (the build's nose ahead of the axles) }
// THE TRAILER'S FRAME: origin on the ground under the axles' centre, +x forward (to the ball), +y up, +z right.
function trailerFit(sim, o) {
  o = o || {};
  const pitch = o.pitch ?? 6;
  const B = trailerKeel(sim, pitch), deckH = o.deckH ?? 0.78, cgX = o.cgAhead ?? 0.25, lowY = B.lowY;
  const toT = q => [q[0] + cgX, q[1] - lowY + deckH, q[2]];
  const pads = B.pads.map(pd => ({ i: pd.i, kind: pd.kind, float: pd.float, at: toT(pd.q) }));
  // the build's extent in the trailer's frame: the nose (the spinner, the bows) and the tail, the span
  let front = -Infinity, back = Infinity; for (let i = 0; i < sim.n; i++) { const q = B.loc(i); front = Math.max(front, q[0] + cgX); back = Math.min(back, q[0] + cgX); }
  const floats = B.kind === 'floats' ? B.keels.map(k => ({ side: k.side, z: k.K.reduce((s, q) => s + q[2], 0) / k.K.length, B: k.P.B, beta: k.P.beta, L: k.P.L,
    keel: k.K.map(q => { const t = toT(q); return [t[0], t[1]]; }) })) : null;
  const hull = B.kind === 'hull' ? { keel: (B.keels[0].K || []).map(q => { const t = toT(q); return [t[0], t[1]]; }), B: B.keels[0].P ? B.keels[0].P.B : 1.2, beta: B.keels[0].P ? B.keels[0].P.beta : 22,
    chines: pads.filter(p => p.kind === 'chine').map(p => p.at) } : null;
  const Ld = Math.max(4.2, front + (o.clear ?? 1.4));
  // the frame under the bunks: from behind the aft pads to ahead of the fore ones, a margin either end
  const xs = pads.map(p => p.at[0]);
  const frame = [Math.min(-1.3, Math.min(...xs) - 0.9), Math.max(1.3, Math.max(...xs) + 0.6)];
  return { kind: B.kind, pads, deckH, Ld, cgX, frame, floats, hull, front, back, pitch, mPlane: sim.totalM };
}

// makeTrailer(car, world, fit, o): the trailer behind the car's ball. o: { mass (kg, 420), cgX (its own CG ahead of the
// axles, 0.6 m), Crr (0.015), ball (the car's body point; its rear bumper's middle, 0.48 m up), axleDx (the tandem's
// spacing, 0.86 m), wheelR (0.292), wheelZ (half the track) }
function makeTrailer(car, world, fit, o) {
  o = o || {};
  const ball = o.ball || [car.def.steer.xRef - car.def.foot.rear - 0.08, 0.48, 0];
  const m = o.mass ?? 420, cgX = o.cgX ?? 0.6, Crr = o.Crr ?? 0.015, Ld = fit.Ld;
  const axleDx = o.axleDx ?? 0.86, wheelR = o.wheelR ?? 0.292;
  const half = fit.floats ? Math.max(...fit.floats.map(f => Math.abs(f.z))) : Math.max(0.6, (fit.hull ? fit.hull.B : 1.2) / 2);
  const wheelZ = o.wheelZ ?? Math.max(0.95, half + 0.27);
  const H = (x, z) => world.terrainH(x, z);
  const T = { m, cgX, Ld, ball, axleDx, wheelR, wheelZ, A: [0, 0, 0], f: [1, 0, 0], u: [0, 1, 0], r: [0, 0, 1], vA: [0, 0, 0], aF: 0,
              Hb: [0, 0, 0], N: 0, spin: 0, hitchV: [0, 0, 0], fit };
  // the pose from the ball's place and the axles' (the tractrix: the axles' centre is drawn along the drawbar)
  function pose(P) {
    let dx = P[0] - T.A[0], dz = P[2] - T.A[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const ax = P[0] - dx * Ld, az = P[2] - dz * Ld;
    const gL = H(ax - dz * -wheelZ, az + dx * -wheelZ), gR = H(ax - dz * wheelZ, az + dx * wheelZ);   // (right = (-dz, dx))
    const g0 = (gL + gR) / 2;
    T.A = [ax, g0, az];
    // the axes: forward to the ball (it sets the pitch), right across the wheels (the roll)
    // (the ball 0.48 m over the ground the axles stand on: the frame level; the car's squat or a crest pitches it)
    let f = [P[0] - ax, P[1] - 0.48 - g0, P[2] - az];
    const fl = Math.hypot(f[0], f[1], f[2]); f = [f[0] / fl, f[1] / fl, f[2] / fl];
    let r = [-dz, (gR - gL) / (2 * wheelZ), dx]; const rl = Math.hypot(r[0], r[1], r[2]); r = [r[0] / rl, r[1] / rl, r[2] / rl];
    let u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]; const ul = Math.hypot(u[0], u[1], u[2]); u = [u[0] / ul, u[1] / ul, u[2] / ul];
    r = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
    T.f = f; T.u = u; T.r = r;
  }
  // the trailer's point (its frame) -> the world
  T.toWorld = q => [T.A[0] + T.f[0] * q[0] + T.u[0] * q[1] + T.r[0] * q[2], T.A[1] + T.f[1] * q[0] + T.u[1] * q[1] + T.r[1] * q[2], T.A[2] + T.f[2] * q[0] + T.u[2] * q[1] + T.r[2] * q[2]];
  T.ballWorld = () => car.toWorld(ball);
  // stand it behind the car, straight
  T.place = () => {
    const P = T.ballWorld(), A = car.axes(); const fx = A.fwd[0], fz = A.fwd[2], l = Math.hypot(fx, fz) || 1;
    T.A = [P[0] - fx / l * Ld * 1.01, 0, P[2] - fz / l * Ld * 1.01];
    pose(P); T.vA = [0, 0, 0]; T.prevA = T.A.slice(); T.aF = 0;
  };
  // a frame: the pose after the car's step; the velocity, the acceleration along; the loads at the ball (R: the
  // cradle's mean reaction on the trailer this frame, the world's, and its moment arms - from the cradle)
  T.step = (dt, R) => {
    pose(T.ballWorld());
    const v = [(T.A[0] - T.prevA[0]) / dt, (T.A[1] - T.prevA[1]) / dt, (T.A[2] - T.prevA[2]) / dt];
    const vf = v[0] * T.f[0] + v[1] * T.f[1] + v[2] * T.f[2], vf0 = T.vA[0] * T.f[0] + T.vA[1] * T.f[1] + T.vA[2] * T.f[2];
    T.aF += ((vf - vf0) / dt - T.aF) * 0.35;   // (smoothed: a frame's difference of a kinematic point is noisy)
    T.vA = v; T.prevA = T.A.slice();
    T.spin += vf / wheelR * dt;
    // the loads: the cradle's reaction (R.F, the world's; R.My its moment about the axles' line, R.Mz the yaw's)
    const RF = R ? R.F : [0, 0, 0], Rf = RF[0] * T.f[0] + RF[1] * T.f[1] + RF[2] * T.f[2], Ru = RF[0] * T.u[0] + RF[1] * T.u[1] + RF[2] * T.u[2];
    const Rr = RF[0] * T.r[0] + RF[1] * T.r[1] + RF[2] * T.r[2];
    const gU = -TR_G * T.u[1], gF = -TR_G * T.f[1];   // gravity in the trailer's frame (per kg)
    // vertical: moments about the axles: Hu Ld + Ru xR + m gU cgX = 0 (R's moment arm: R.xu = sum(Ru_k x_k) / sum - its centre)
    const Hu = -((R ? R.Mu : 0) + m * gU * cgX) / Ld;
    const N = Math.max(0, -(Hu + Ru + m * gU));
    // along: m aF = Hf + Rf + m gF - Crr N sign(v)
    const Hf = m * T.aF - Rf - m * gF + Crr * N * Math.sign(vf || 0);
    // sideways: moments about the axles (the yaw): Hr Ld + R.Mr = 0 (the tyres take the rest)
    const Hr = -(R ? R.Mr : 0) / Ld;
    T.N = N;
    // the force ON THE CAR at the ball: minus the ball's force on the trailer
    T.Hb = [-(Hf * T.f[0] + Hu * T.u[0] + Hr * T.r[0]), -(Hf * T.f[1] + Hu * T.u[1] + Hr * T.r[1]), -(Hf * T.f[2] + Hu * T.u[2] + Hr * T.r[2])];
    car.extF = { f: T.Hb, at: ball };
  };
  T.detach = () => { car.extF = null; };
  return T;
}

// makeCradle(sim, T, fit, o): the bunks and the latch on the aeroplane's keel nodes. o: { k (N/m a pad), zeta (0.6),
// mu (0.6, carpet on aluminium), latchN (7000 N), open (0.10: the latch opens under this share of the weight) }
function makeCradle(sim, T, fit, o) {
  o = o || {};
  const pads = fit.pads, np = pads.length, W = sim.totalM * TR_G;
  // (a bunk gives 1.5 cm under its share of the weight - a carpeted timber on a galvanised bracket; 30 kN/m, the probe's,
  //  let a pylon's thrust press a flying boat's bow 0.2 m into its bunks and tip it 16 deg)
  const k = o.k ?? W / np / 0.015, c = 2 * (o.zeta ?? 0.6) * Math.sqrt(k * sim.totalM / np), mu = o.mu ?? 0.6;
  const latchN = o.latchN ?? 7000, open = o.open ?? 0.10;
  const C = { latched: true, opened: null, tOpen: null, load: 1, loadAvg: 1, Fz: 0, Fmax: 0, latchF: 0, latchMax: 0, k, c, mu, W, t: 0,
              R: { F: [0, 0, 0], Mu: 0, Mr: 0 }, padF: new Float64Array(np), on: true };
  const prev = sim.onSubstep;
  // the bow stop: the most forward pad of each float (of the keel, a hull's) - a forward push there is the stop's
  const bow = pads.map(pd => pd.kind === 'keel' && pd.at[0] === Math.max(...pads.filter(p2 => p2.kind === 'keel' && p2.float === pd.float).map(p2 => p2.at[0])));
  const wA = pads.map(pd => [0, 0, 0]);   // the bunk points, the world's, at the frame's start
  let A0 = [0, 0, 0], vA = [0, 0, 0];
  let accF = [0, 0, 0], accU = 0, accR = 0, accT = 0, accZ = 0;
  sim.onSubstep = (s, dt) => {
    if (!C.on) return;
    const t = (s + 1) * dt, ox = vA[0] * t, oy = vA[1] * t, oz = vA[2] * t, f = T.f, u = T.u, r = T.r;
    let Fz = 0, Sf = 0, Sr = 0;
    for (let q = 0; q < np; q++) {
      const i = pads[q].i, a = wA[q];
      const ex = a[0] + ox - sim.p[i * 3], ey = a[1] + oy - sim.p[i * 3 + 1], ez = a[2] + oz - sim.p[i * 3 + 2];
      const wx = vA[0] - sim.v[i * 3], wy = vA[1] - sim.v[i * 3 + 1], wz = vA[2] - sim.v[i * 3 + 2];
      // in the bunk's frame: up (the normal), along, across
      const eu = ex * u[0] + ey * u[1] + ez * u[2], wu = wx * u[0] + wy * u[1] + wz * u[2];
      let Fu = k * eu + c * wu;
      C.padF[q] = 0;
      if (eu <= 0 || Fu <= 0) { if (!C.latched) continue; Fu = 0; }   // up only: a plane above its bunk is off it
      let Ff = k * (ex * f[0] + ey * f[1] + ez * f[2]) + c * (wx * f[0] + wy * f[1] + wz * f[2]);
      let Fr = k * (ex * r[0] + ey * r[1] + ez * r[2]) + c * (wx * r[0] + wy * r[1] + wz * r[2]);
      if (C.latched) { Sf += Ff; Sr += Fr; }   // the strap holds it whatever the bunks carry (its load: the net, not the pads' squeeze)
      else {
        // the carpet's grip, and the bow stop: forward of its bunk point the plane is pushed back whatever its weight
        const cap = mu * Fu; Fr = Math.max(-cap, Math.min(cap, Fr));
        Ff = Ff > cap ? cap : Ff < -cap && !bow[q] ? -cap : Ff;   // (Ff < 0: the plane ahead of its place - the bow pad's stop holds it)
      }
      const Fx = Fu * u[0] + Ff * f[0] + Fr * r[0], Fy = Fu * u[1] + Ff * f[1] + Fr * r[1], Fzz = Fu * u[2] + Ff * f[2] + Fr * r[2];
      sim.impulse(i, Fx * dt, Fy * dt, Fzz * dt);
      C.padF[q] = Fu; Fz += Fu;
      // the reaction on the trailer, and its moments about the axles (the pad's place along, across)
      accF[0] -= Fx * dt; accF[1] -= Fy * dt; accF[2] -= Fzz * dt;
      const Ru = -(Fx * u[0] + Fy * u[1] + Fzz * u[2]), Rr = -(Fx * r[0] + Fy * r[1] + Fzz * r[2]);
      accU += Ru * pads[q].at[0] * dt; accR += Rr * pads[q].at[0] * dt;
    }
    accZ += Fz * dt; accT += dt;
    C.Fz = Fz; if (Fz > C.Fmax) C.Fmax = Fz;
    // (the strap's load over 0.1 s: a structure ringing on its pads after the seat - a flying boat's frames - pulls a
    //  few kN for a few milliseconds, which a strap's stretch never feels)
    const Fl = C.latchF += (Math.hypot(Sf, Sr) - C.latchF) * Math.min(1, dt / 0.1); if (Fl > C.latchMax) C.latchMax = Fl;
    if (C.latched && Fl > latchN) { C.latched = false; C.opened = 'the latch\'s strap let go (' + (Fl / 1000).toFixed(1) + ' kN)'; C.tOpen = C.t + t; }
  };
  // before the aeroplane's frame: the bunk points from the trailer's pose, its velocity carried through the frame
  C.before = () => {
    for (let q = 0; q < np; q++) { const w = T.toWorld(pads[q].at); wA[q][0] = w[0]; wA[q][1] = w[1]; wA[q][2] = w[2]; }
    A0 = T.A.slice(); vA = T.vA.slice();
    accF = [0, 0, 0]; accU = 0; accR = 0; accT = 0; accZ = 0;
  };
  // after it: the frame's mean reaction for the trailer, the load and the latch
  C.after = (dtFrame) => {
    const m_ = accT > 0 ? 1 / accT : 0;
    C.R = { F: [accF[0] * m_, accF[1] * m_, accF[2] * m_], Mu: accU * m_, Mr: accR * m_ };
    C.load = accZ * m_ / W;
    const a = Math.min(1, dtFrame / 0.25); C.loadAvg += (C.load - C.loadAvg) * a;
    C.t += dtFrame;
    if (C.latched && C.t > 2 && C.loadAvg < open) { C.latched = false; C.opened = 'the wing carries it (the cradle ' + Math.round(C.loadAvg * 100) + ' % of the weight)'; C.tOpen = C.t; }
  };
  C.detach = () => { C.on = false; if (sim.onSubstep !== undefined) sim.onSubstep = prev || null; };
  return C;
}

// trailerSeat(sim, T, fit): the aeroplane lifted onto its bunks (a teleport of its nodes: the settled build, standing on
// its keels, moved so each pad's node sits on its bunk point, at rest)
function trailerSeat(sim, T, fit) {
  // the plane's frame now (the settled build) -> the trailer's: a rigid move taking the pads' nodes onto their points
  const P = Float64Array.from(sim.p), B = trailerKeel(sim, fit.pitch, P), lowY = B.lowY;
  // (a reset first: the solver's ground contacts hold their stick points - a node moved off its contact without it is
  //  pulled back toward it in the first substep, measured 16 m/s on a float keel moved 30 m)
  const Q = []; for (let i = 0; i < sim.n; i++) Q.push(B.loc(i));   // (read before the reset: loc reads the axes and the CG)
  if (typeof sim.reset === 'function') sim.reset(0);
  for (let i = 0; i < sim.n; i++) {
    const q0 = Q[i], q = [q0[0] + fit.cgX, q0[1] - lowY + fit.deckH, q0[2]];
    const w = T.toWorld(q);
    sim.p[i * 3] = w[0]; sim.p[i * 3 + 1] = w[1] + 0.004; sim.p[i * 3 + 2] = w[2];
    sim.v[i * 3] = sim.v[i * 3 + 1] = sim.v[i * 3 + 2] = 0;
  }
}

// makeTrailerLaunch(sim, car, world, o): the whole rig - the fit, the trailer behind the car, the plane seated, the
// cradle on. The aeroplane's frame wraps in before() / after(dt); the car's step follows, then carAfter:
//   L.before(); <the aeroplane's step>; L.after(dt); <the driver's step>; L.carCtl(car); <the car's step>; L.carAfter(dt)
// THE RUN (L.phase): 'loaded' (the latch shut), 'opened' (the latch open, the plane still over its bunks), 'clear' (its
// keel 5 m over them: the car eases off and stops, its driver's steering kept), 'abort' (no release 20 s after the
// car reached its speed: it stops with the plane on its bunks - they hold it).
// THE CAR'S SPEED (L.vCar): 1.6 the build's rotation speed (genAP's VRot), 20-42 m/s: the wing lifts the plane off
// before the car is at it, the car holds it while the plane climbs off its bunks.
function makeTrailerLaunch(sim, car, world, o) {
  o = o || {};
  const fit = trailerFit(sim, o.fit);
  const T = makeTrailer(car, world, fit, o.trailer);
  T.place();
  trailerSeat(sim, T, fit);
  const C = makeCradle(sim, T, fit, o.cradle);
  const ap = (o.vRot ? { VRot: o.vRot } : null) || (o.def && o.def.params && o.def.params.ap) || { VRot: 22 };
  const L = { fit, trailer: T, cradle: C, phase: 'loaded', vRot: ap.VRot, vCar: o.vCar || Math.max(20, Math.min(42, 1.6 * ap.VRot)),
              keelUp: 0, tPhase: 0, tAtSpeed: null, why: null };
  const pad0 = fit.pads.map(pd => pd.i);
  L.before = () => C.before();
  L.after = (dt) => {
    C.after(dt);
    // the keel over its bunks (the lowest pad node over its bunk point, along the trailer's up)
    let up = Infinity; for (let q = 0; q < pad0.length; q++) { const i = pad0[q], w = T.toWorld(fit.pads[q].at);
      up = Math.min(up, (sim.p[i * 3] - w[0]) * T.u[0] + (sim.p[i * 3 + 1] - w[1]) * T.u[1] + (sim.p[i * 3 + 2] - w[2]) * T.u[2]); }
    L.keelUp = up; L.tPhase += dt;
    if (L.phase === 'loaded' && !C.latched) { L.phase = 'opened'; L.tPhase = 0; L.why = C.opened; }
    if (L.phase === 'opened' && up > 5) { L.phase = 'clear'; L.tPhase = 0; }
    if (L.phase === 'loaded' && Math.abs(car.out.u) > L.vCar - 1.5 && L.tAtSpeed === null) L.tAtSpeed = 0;
    if (L.tAtSpeed !== null) L.tAtSpeed += dt;
    if ((L.phase === 'loaded' || L.phase === 'opened') && L.tAtSpeed !== null && L.tAtSpeed > 20) { L.phase = 'abort'; L.tPhase = 0; L.why = 'no lift-off 20 s at ' + Math.round(L.vCar * 3.6) + ' km/h: stopping with the plane on its bunks'; }
  };
  // after the driver's step: the launch's say over the pedals (the driver keeps the wheel)
  L.carCtl = (car_) => {
    if (L.phase === 'clear' && L.tPhase > 1.5 || L.phase === 'abort') { car_.ctl.thr = 0; car_.ctl.brake = Math.min(0.35, (L.phase === 'abort' ? 0.15 : 0.35) * Math.min(1, L.tPhase / 2)); }
  };
  L.carAfter = (dt) => T.step(dt, C.R);
  L.detach = () => { C.detach(); T.detach(); };
  return L;
}

// makeTrailerHands(sim, L, o): THE GATE'S HANDS on a trailer launch (the page's player flies himself): full power,
// wings level, the rudder holding the trailer's line; on the bunks the elevator holds the cradle's attitude (back stick
// only) to 1.05 VRot, then pulls to a 10 deg attitude (it rotates on its aft bunks - they push up only), off the bunks the climb's 7 deg
function makeTrailerHands(sim, L, o) {
  o = o || {};
  const cl = (x, m) => Math.max(-m, Math.min(m, x)), vR = (o.vRot || L.vRot) * 1.05;
  return () => {
    const A = sim.axes(), xA = A[0], zR = A[2], v = sim.cgVel(), V = Math.hypot(v[0], v[1], v[2]);
    const pitch = Math.asin(cl(-xA[1], 1)) * 57.3, bank = -Math.asin(cl(zR[1], 1)) * 57.3;
    const f = L.trailer.f, fx = -xA[0], fz = -xA[2];
    const headL = Math.atan2(fx * f[2] - fz * f[0], fx * f[0] + fz * f[2]) * 57.3;   // + the nose left of the trailer's line
    // (the power in as the speed comes: a pylon's thrust line, high over the bunks, tips a boat onto its nose at full power
    //  from rest - measured -36 deg on the classic hull - and the car's pull carries it through the first 12 m/s)
    sim.ctl.thr = L.phase === 'abort' ? 0 : Math.min(1, (o.thr0 ?? 0.45) + V / 12);
    // (on the bunks: the cradle's attitude held - the stick back as a pylon's thrust tips the bow down, never forward -
    //  then from 1.05 VRot the pull to the lift-off attitude)
    const p0 = L.fit.pitch + (Math.asin(cl(L.trailer.f[1], 1)) * 57.3);
    if (L.phase === 'loaded' || L.phase === 'opened') sim.ctl.de = V < vR ? cl(0.1 * (p0 - pitch), 1) * (pitch < p0 ? 1 : 0) : cl(0.4 * ((o.rotPitch ?? 10) - pitch), 1);
    else {   // off the bunks: the attitude by the speed - level in ground effect until 1.3 Vs, then the climb's (a boat lifted
             // off at 34 m/s and pushed to a 7 deg climb attitude at once sank back onto its trailer: measured)
      const Vs = L.vRot / 0.99, want = Math.max(2, Math.min(o.climbPitch ?? 12, 4 + 1.2 * (V - 1.3 * Vs)));
      sim.ctl.de = cl(0.05 * (want - pitch), 0.7);
    }
    sim.ctl.da = cl(-0.03 * bank, 0.7);
    sim.ctl.dr = cl(-0.04 * headL, 0.7);
    return { pitch, bank, headL, V };
  };
}

if (typeof module !== 'undefined') module.exports = { trailerKeel, trailerFit, makeTrailer, makeCradle, trailerSeat, makeTrailerLaunch, makeTrailerHands };
