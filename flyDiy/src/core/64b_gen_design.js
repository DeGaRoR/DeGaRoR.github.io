// ============================================================
// THE DESIGN CHECK (G2640 DESIGN-TRUST) — what the numbers alone say, before
// any flight, with pointers.
//
// The user, 10 Oct, on their own design: "This plane is extremely unstable,
// while the bench check finds nothing wrong with it ... the first bench check
// should be able to detect something bad from the numbers alone, no? I think
// it should, deterministic check with real pointers on problems."
//
// So: the BUILT aeroplane in the wind tunnel (the solver's own probe - the
// strips, the downwash, the body, exactly what flies), its stability and
// control derivatives measured by small perturbations (sideslip, alpha, roll,
// pitch and yaw RATE - 30_solver probe's `omega` - and each control at full
// travel), its inertias off the lattice's own masses, and the classical
// light-aircraft modes solved from them:
//
//   lateral    the 4-state linear model (beta, p, r, phi) - Nelson, "Flight
//              Stability and Automatic Control" (2nd ed., ch. 5) - its four
//              roots: the SPIRAL, the ROLL subsidence, the DUTCH ROLL
//   pitch      the short-period pair (alpha, q), the static margin as drawn
//              and at the worst loading corner (genShakedown's envelope)
//
// and each row judged against a published criterion where there is one -
// MIL-F-8785C (the handling-qualities spec every light-aircraft text quotes:
// Class I, flight-phase category B, Level 1 = pass, Level 2 = warn, worse =
// fail), FAR 23.233 for the crosswind, Raymer's tail-volume table (Aircraft
// Design: A Conceptual Approach, table 6.4) for the sizing rows - with WHAT TO
// CHANGE sized from the same numbers: how much fin, how far aft, how many
// degrees of dihedral.
//
// DATA FIRST (A0, for CERT-SLIM G2840's red list): genDesignCheck returns
// { verdict, rows: [{ id, group, label, level, value, unit, limit, why, fix }],
//   modes, deriv } and the bench only renders it. Nothing here moves the
// aeroplane; it measures it.
// ============================================================

// the probe's velocity for an attitude: alpha (wind from below, +), beta
// (the aeroplane moving to its right: wind from the right, +)
function genDcVel(V, a, b) {
  return [-V * Math.cos(a) * Math.cos(b), -V * Math.sin(a) * Math.cos(b), -V * Math.sin(b)];
}

// the derivatives, standard signs (Y right, L right-wing-down, N nose-right,
// M nose-up; p, q, r the same), coefficients on Sw, span b and mean chord c
function genDesignDerivs(def, sim, V, opts) {
  // LIVE by default: the propeller's thrust at the cruise setting and its wash
  // over the tail, as the aeroplane flies (opts.live === false: the dead tunnel)
  const live = !(opts && opts.live === false);
  const g = def.params.gen || {};
  const Sw = g.Sw || 10, b = g.span || Math.sqrt(Sw * (g.AR || 6)), c = g.cBar || Sw / b;
  const W = sim.totalM * 9.81;
  const aMax = 0.85 * def.params.polarWing.aStall;
  const a0 = genAlphaForLift(sim, V, W, aMax);
  const q = 0.5 * RHO * V * V;
  const ctl0 = { de: sim.ctl.de, da: sim.ctl.da, dr: sim.ctl.dr, flap: sim.ctl.flap, thr: sim.ctl.thr };
  sim.ctl.de = sim.ctl.da = sim.ctl.dr = 0;
  if (live) sim.ctl.thr = def.params.ap.thrCruise != null ? def.params.ap.thrCruise : 0.6;
  // STABILITY AXES: x along the trimmed flight path (the body's forward
  // turned down by alpha0 about the pitch axis), z down - the axes the 4-state
  // model is written in. Measured in BODY axes, the roll damping (the biggest
  // derivative) leaks into the yaw-roll cross terms at the trim alpha: the
  // Cub's Clr read 0.15 for 0.11, and its spiral twice as divergent as it flies.
  const ca = Math.cos(a0), sa = Math.sin(a0);
  const fwd = [-ca, -sa, 0], up = [-sa, ca, 0];          // in the sim's axes (x aft, y up, z left)
  const P = (a, bt, w) => {
    const r = sim.probe(genDcVel(V, a, bt), live, w || null);
    const Lb = -r.rollLeft, Nb = -r.yawLeft;              // body: right roll, nose right
    return { Y: -r.Fz, L: Lb * ca + Nb * sa, N: -Lb * sa + Nb * ca, M: r.pitchUp, Z: r.Fy };
  };
  // a rate about a stability axis, as the probe's omega: roll right (p) about
  // the flight path, yaw right (r) about its down axis, pitch up (q) about -z
  const wP = p => [p * fwd[0], p * fwd[1], 0], wR = rr => [rr * up[0] * -1, rr * up[1] * -1, 0];
  const nd = (r) => ({ CY: r.Y / (q * Sw), Cl: r.L / (q * Sw * b), Cn: r.N / (q * Sw * b),
                       Cm: r.M / (q * Sw * c), CL: r.Z / (q * Sw) });
  const D = {};
  const base = nd(P(a0, 0));
  // sideslip
  { const db = 0.04, u = nd(P(a0, db)), d = nd(P(a0, -db));
    D.CYb = (u.CY - d.CY) / (2 * db); D.Clb = (u.Cl - d.Cl) / (2 * db); D.Cnb = (u.Cn - d.Cn) / (2 * db); }
  // alpha
  { const da = 0.02, u = nd(P(a0 + da, 0)), d = nd(P(a0 - da, 0));
    D.CLa = (u.CL - d.CL) / (2 * da); D.Cma = (u.Cm - d.Cm) / (2 * da); }
  // rates: p right wing down = -x, q nose up = -z, r nose right = -y (x aft, y up, z left)
  { const ph = 0.04, w = ph * 2 * V / b;
    const u = nd(P(a0, 0, wP(w))), d = nd(P(a0, 0, wP(-w)));
    D.CYp = (u.CY - d.CY) / (2 * ph); D.Clp = (u.Cl - d.Cl) / (2 * ph); D.Cnp = (u.Cn - d.Cn) / (2 * ph); }
  { const rh = 0.04, w = rh * 2 * V / b;
    const u = nd(P(a0, 0, wR(w))), d = nd(P(a0, 0, wR(-w)));
    D.CYr = (u.CY - d.CY) / (2 * rh); D.Clr = (u.Cl - d.Cl) / (2 * rh); D.Cnr = (u.Cn - d.Cn) / (2 * rh); }
  { const qh = 0.02, w = qh * 2 * V / c;
    const u = nd(P(a0, 0, [0, 0, -w])), d = nd(P(a0, 0, [0, 0, w]));
    D.Cmq = (u.Cm - d.Cm) / (2 * qh); D.CLq = (u.CL - d.CL) / (2 * qh); }
  // controls at full travel (ctl +-1), per unit
  const ctlD = (k) => {
    sim.ctl[k] = 1; const u = nd(P(a0, 0));
    sim.ctl[k] = -1; const d = nd(P(a0, 0));
    sim.ctl[k] = 0;
    return { CY: (u.CY - d.CY) / 2, Cl: (u.Cl - d.Cl) / 2, Cn: (u.Cn - d.Cn) / 2, Cm: (u.Cm - d.Cm) / 2, CL: (u.CL - d.CL) / 2 };
  };
  D.de = ctlD('de'); D.da = ctlD('da'); D.dr = ctlD('dr');
  sim.ctl.de = ctl0.de; sim.ctl.da = ctl0.da; sim.ctl.dr = ctl0.dr; sim.ctl.flap = ctl0.flap; sim.ctl.thr = ctl0.thr;
  // inertias about the mass centre, off the lattice (roll about x, pitch
  // about z, yaw about y in the sim's axes)
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < sim.n; i++) { cx += sim.p[i*3] * sim.m[i]; cy += sim.p[i*3+1] * sim.m[i]; cz += sim.p[i*3+2] * sim.m[i]; }
  cx /= sim.totalM; cy /= sim.totalM; cz /= sim.totalM;
  // ...in the same stability axes: roll about the flight path, yaw about its
  // down axis, and their product Ixz (forward x down)
  let Ixx = 0, Iyy = 0, Izz = 0, Ixz = 0;
  for (let i = 0; i < sim.n; i++) {
    const dx = sim.p[i*3] - cx, dy = sim.p[i*3+1] - cy, dz = sim.p[i*3+2] - cz, mi = sim.m[i];
    const xf = dx * fwd[0] + dy * fwd[1], zd = -(dx * up[0] + dy * up[1]);   // forward, down
    Ixx += mi * (zd * zd + dz * dz); Iyy += mi * (xf * xf + zd * zd); Izz += mi * (xf * xf + dz * dz);
    Ixz += mi * xf * zd;
  }
  return Object.assign(D, { V, q, Sw, b, c, m: sim.totalM, W, alpha: a0, Cm0: base.Cm,
                            Ixx, Iyy, Izz, Ixz });     // Iyy PITCH, Izz YAW (standard names)
}

// roots of a real polynomial (coefficients highest first, monic after
// normalising) - Durand-Kerner, a fixed number of sweeps (deterministic)
function genDcRoots(co) {
  const n = co.length - 1, a = co.map(v => v / co[0]);
  const R = [];
  for (let k = 0; k < n; k++) { const t = 2 * Math.PI * k / n + 0.4; R.push([0.9 * Math.cos(t), 0.9 * Math.sin(t)]); }
  const mul = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]];
  const div = (x, y) => { const d = y[0] * y[0] + y[1] * y[1] || 1e-300; return [(x[0] * y[0] + x[1] * y[1]) / d, (x[1] * y[0] - x[0] * y[1]) / d]; };
  // scale: start the guesses on the roots' own size (Cauchy bound)
  let bound = 0; for (let k = 1; k <= n; k++) bound = Math.max(bound, Math.abs(a[k]));
  const s = Math.max(0.1, Math.min(50, 1 + bound));
  for (const r of R) { r[0] *= s; r[1] *= s; }
  for (let it = 0; it < 400; it++) {
    for (let i = 0; i < n; i++) {
      let pv = [1, 0];
      for (let k = 1; k <= n; k++) pv = [pv[0] * R[i][0] - pv[1] * R[i][1] + a[k], pv[0] * R[i][1] + pv[1] * R[i][0]];
      let den = [1, 0];
      for (let j = 0; j < n; j++) if (j !== i) den = mul(den, [R[i][0] - R[j][0], R[i][1] - R[j][1]]);
      const d = div(pv, den);
      R[i] = [R[i][0] - d[0], R[i][1] - d[1]];
    }
  }
  return R;
}

// the characteristic polynomial of a square matrix (Faddeev-LeVerrier)
function genDcCharPoly(A) {
  const n = A.length;
  let Mk = A.map((r, i) => r.map((_, j) => (i === j ? 1 : 0)));
  const c = [1];
  for (let k = 1; k <= n; k++) {
    const AM = A.map((r, i) => r.map((_, j) => { let s = 0; for (let t = 0; t < n; t++) s += r[t] * Mk[t][j]; return s; }));
    let tr = 0; for (let i = 0; i < n; i++) tr += AM[i][i];
    const ck = -tr / k;
    c.push(ck);
    Mk = AM.map((r, i) => r.map((v, j) => v + (i === j ? ck : 0)));
  }
  return c;
}

// the lateral modes from the derivatives (Nelson's 4-state model, stability
// axes, the roll-yaw product of inertia neglected)
function genDcLateral(D) {
  const { V, q, Sw, b, m, Ixx, Izz } = D, Ixz = D.Ixz || 0;
  const gr = 9.81, k = b / (2 * V);
  const Yb = q * Sw * D.CYb / m, Yp = q * Sw * b * D.CYp * k / m, Yr = q * Sw * b * D.CYr * k / m;
  // L = Ixx p' - Ixz r', N = Izz r' - Ixz p' (Etkin): solved for p' and r'
  const iL = q * Sw * b / Ixx, iN = q * Sw * b / Izz, ea = Ixz / Ixx, eb = Ixz / Izz, den = 1 - ea * eb;
  const mix = (cl, cn, kk) => [(cl * iL + ea * cn * iN) * kk / den, (cn * iN + eb * cl * iL) * kk / den];
  const [Lb, Nb] = mix(D.Clb, D.Cnb, 1), [Lp, Np] = mix(D.Clp, D.Cnp, k), [Lr, Nr] = mix(D.Clr, D.Cnr, k);
  const A = [[Yb / V, Yp / V, Yr / V - 1, gr / V],
             [Lb, Lp, Lr, 0],
             [Nb, Np, Nr, 0],
             [0, 1, 0, 0]];
  const R = genDcRoots(genDcCharPoly(A));
  const cplx = R.filter(r => Math.abs(r[1]) > 1e-4), real = R.filter(r => Math.abs(r[1]) <= 1e-4).map(r => r[0]);
  real.sort((x, y) => x - y);                        // most negative first
  const out = { roots: R, dims: { Yb, Yp, Yr, Lb, Lp, Lr, Nb, Np, Nr } };
  if (cplx.length >= 2 && real.length === 2) {
    const r = cplx[0], wn = Math.hypot(r[0], r[1]);
    out.dutch = { wn, zeta: -r[0] / wn, oscillatory: true };
    out.roll = { lambda: real[0], tau: real[0] < 0 ? -1 / real[0] : Infinity };
    out.spiral = { lambda: real[1] };
  } else if (real.length === 4) {
    // the dutch roll split into two real roots (heavily damped or diverging
    // in yaw): the roll is the fastest, the spiral the slowest
    const byMag = real.slice().sort((x, y) => Math.abs(x) - Math.abs(y));
    out.spiral = { lambda: byMag[0] };
    out.roll = { lambda: real[0], tau: real[0] < 0 ? -1 / real[0] : Infinity };
    const rest = real.filter(x => x !== byMag[0] && x !== real[0]);
    out.dutch = { wn: Math.sqrt(Math.abs(rest[0] * rest[1])), zeta: rest.every(x => x < 0) ? 1 : -1,
                  oscillatory: false, real: rest };
  } else {
    // the roll and spiral coalesced into an oscillation (a 'lateral
    // phugoid'): report the pair as the spiral, unstable if its real part is
    const r = cplx.slice().sort((x, y) => Math.hypot(x[0], x[1]) - Math.hypot(y[0], y[1]));
    const slow = r[0], fast = r[r.length - 1];
    out.spiral = { lambda: slow[0], coupled: true };
    out.roll = { lambda: fast[0], tau: fast[0] < 0 ? -1 / fast[0] : Infinity, coupled: true };
    out.dutch = { wn: Math.hypot(fast[0], fast[1]), zeta: -fast[0] / Math.max(1e-9, Math.hypot(fast[0], fast[1])), oscillatory: true };
  }
  return out;
}

// the short period (alpha, q): Zalpha from the lift slope, Malpha and Mq off
// the probe (M-alpha-dot neglected: the downwash lag; it adds damping)
function genDcShort(D) {
  const { V, q, Sw, c, m, Iyy } = D;
  const Za = -q * Sw * D.CLa / m;
  const Ma = q * Sw * c * D.Cma / Iyy, Mq = q * Sw * c * D.Cmq * (c / (2 * V)) / Iyy;
  const tr = Za / V + Mq, det = (Za / V) * Mq - Ma;
  const disc = tr * tr / 4 - det;
  if (det <= 0) return { wn: 0, zeta: -1, unstable: true, Ma, Mq, Za };
  const wn = Math.sqrt(det);
  return { wn, zeta: -tr / (2 * wn), Ma, Mq, Za, disc };
}

// "or move it aft by X" - only while X is a move a builder can make (a longer
// boom by up to 2 m); past that the surface itself is what is short
function genDcMove(d) {
  return d > 0 && d <= 2 ? ', or move it aft by ' + (Math.round(d * 100) / 100) + ' m'
       : d > 2 ? ' (moving it aft would take ' + Math.round(d) + ' m: the area is what is missing)' : '';
}

// the check: rows with levels and pointers
function genDesignCheck(def, sh, simIn, opts) {
  const S = def.spec;
  const sim = simIn || makeSim(def, null);
  if (!simIn) sim.reset(0);
  const g = def.params.gen || {};
  const V = def.params.ap.VCruise;
  const D = genDesignDerivs(def, sim, V, opts);
  const lat = genDcLateral(D), sp = genDcShort(D);
  // the approach: the speed the crosswind and the elevator's authority are judged at
  const Vs = (sh && sh.Vs) || g.Vs || 20;
  const rows = [];
  const row = (o) => rows.push(Object.assign({ level: 'pass', unit: '', fix: '' }, o));
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
  const t = S && S.tail, geom = S && S.geom;
  // ---- PITCH ------------------------------------------------------------
  const smD = sh ? sh.staticMargin : -D.Cma / Math.max(1e-6, D.CLa);
  const smA = sh && sh.envelope && isFinite(sh.envelope.staticMarginAft) ? sh.envelope.staticMarginAft : smD;
  {
    const lvl = smA < 0 ? 'fail' : (smA < 0.02 || smD > 0.40) ? 'warn' : 'pass';
    const cbar = D.c;
    row({ id: 'pitch.sm', group: 'pitch', label: 'Static margin (CG ahead of the neutral point)',
          value: r3(smA), unit: 'MAC', level: lvl,
          limit: 'fail < 0 at any loading; warn < 0.02 (nearly neutral) or > 0.40 as drawn (nose-heavy)',
          why: 'as drawn ' + r3(smD) + (sh && sh.envelope ? ', at the worst loading corner (' + sh.envelope.worst.label + ') ' + r3(smA)
                                                          : ' (the loading corners were not run: the drawn loading only)') +
               ' of the mean chord. Below zero the aeroplane diverges in pitch: any bump grows.',
          fix: smA < 0.02 ? 'move the CG forward by ' + r2((0.05 - smA) * cbar) + ' m (ballast in the nose, the wing aft, ' +
                            'or the tanks/seats forward), or grow the stabiliser'
             : smD > 0.40 ? 'the CG is far forward: the elevator must hold the nose up at every speed - move the wing ' +
                            'forward or the load aft by ' + r2((smD - 0.25) * cbar) + ' m' : '' });
  }
  if (t && geom && t.Sh > 0) {
    const Vh = t.Sh * t.lh / (geom.Sw * geom.cBar);
    const need = 0.30, lvl = Vh < 0.20 ? 'fail' : Vh < need ? 'warn' : 'pass';
    row({ id: 'pitch.Vh', group: 'pitch', label: 'Horizontal tail volume Vh', value: r3(Vh), level: lvl,
          limit: 'warn < 0.30, fail < 0.20 (Raymer: homebuilt 0.50, GA single 0.70; the Cub 0.36)',
          why: 'stabiliser area ' + r2(t.Sh) + ' m2 on a ' + r2(t.lh) + ' m arm against the wing\'s ' + r2(geom.Sw) + ' m2 x ' + r2(geom.cBar) + ' m',
          fix: lvl === 'pass' ? '' : 'grow the stabiliser by ' + r2(need * geom.Sw * geom.cBar / t.lh - t.Sh) + ' m2' +
               genDcMove(need * geom.Sw * geom.cBar / t.Sh - t.lh) });
  }
  {
    const ok = !sp.unstable;
    const lvl = !ok ? 'fail' : sp.zeta < 0.25 ? (sp.zeta < 0.15 ? 'fail' : 'warn') : sp.zeta > 2.0 ? 'warn' : 'pass';
    row({ id: 'pitch.short', group: 'pitch', label: 'Short-period pitch mode', value: ok ? r2(sp.zeta) : null, unit: 'damping',
          level: lvl,
          limit: 'damping 0.30-2.0 (MIL-F-8785C Level 1); warn 0.15-0.25; fail below 0.15 or no restoring',
          why: ok ? 'frequency ' + r2(sp.wn) + ' rad/s, damping ratio ' + r2(sp.zeta) : 'no pitch stiffness: the nose has no restoring moment',
          fix: lvl === 'pass' ? '' : !ok ? 'see the static margin' : 'a bigger or longer-armed stabiliser damps pitch (damping grows with area x arm squared)' });
  }
  // the elevator: can it hold the nose up near the stall at the FORWARD CG?
  {
    const env = sh && sh.envelope, fwdX = env && env.fwd ? env.fwd.cgX : (sh ? sh.cgX : null);
    const Va = 1.2 * Vs, Wt = D.W;
    const aMax = 0.85 * def.params.polarWing.aStall;
    const aA = genAlphaForLift(sim, Va, Wt, aMax);
    sim.ctl.de = 0;
    const r0 = sim.probe(genDcVel(Va, aA, 0));
    // full up and full down: the one that pitches up is the authority
    sim.ctl.de = 1; const rU = sim.probe(genDcVel(Va, aA, 0));
    sim.ctl.de = -1; const rD = sim.probe(genDcVel(Va, aA, 0));
    sim.ctl.de = 0;
    const up = rU.pitchUp > rD.pitchUp ? rU : rD;
    // the moment about the forward CG: shifting the reference by dx moves
    // the pitch moment by dx x lift (nose-up positive, x aft)
    const dx = fwdX != null ? fwdX - r0.cg[0] : 0;
    const Mfull = up.pitchUp + dx * up.Fy;
    const qA = 0.5 * RHO * Va * Va, Cm = Mfull / (qA * D.Sw * D.c);
    const lvl = Cm < 0 ? 'fail' : Cm < 0.02 ? 'warn' : 'pass';
    row({ id: 'ctl.elevator', group: 'control', label: 'Elevator: nose-up authority near the stall, forward CG',
          value: r3(Cm), unit: 'Cm', level: lvl,
          limit: 'full up elevator must still pitch the nose up at 1.2 Vs with the CG at its forward limit (fail < 0, warn < 0.02)',
          why: 'pitch moment left with full up elevator at ' + r2(Va * 3.6) + ' km/h, CG at the forward corner',
          fix: lvl === 'pass' ? '' : 'the elevator cannot flare it: a bigger elevator chord, a bigger stabiliser, or the CG further aft' });
  }
  // THE FLARE, POWER OFF (G3271, RUFUS-CERT): the row above asks for nose-up
  // moment at 1.2 Vs, and the user's Rufus (CG 12 % of the chord, a 915 on the
  // nose) passed it at 0.099 - yet flown power off with the stick on its stop
  // it settles at 1.16 Vs and never stalls, so it can never be flared to a slow
  // landing (every touchdown 1.33 Vs, 210 m of roll). So the question is asked
  // at the stall: full up elevator, engine idle (the dead tunnel), CG at the
  // forward corner, alpha swept from the 1.2 Vs attitude up to the wing's stall
  // angle; where the nose-down moment wins, that lift against the wing's best
  // is the slowest speed the elevator can hold (FAR 23.201 lets an elevator on
  // its stop define the stall - which is this number, the speed a pilot can
  // flare to). Free air: ground effect's lost downwash is not modelled here.
  {
    const env = sh && sh.envelope, fwdX = env && env.fwd ? env.fwd.cgX : (sh ? sh.cgX : null);
    const W = D.W, aS = def.params.polarWing.aStall;
    const a1 = genAlphaForLift(sim, 1.2 * Vs, W, 0.85 * aS);
    sim.ctl.de = 1; const pU = sim.probe(genDcVel(Vs, a1, 0)).pitchUp;
    sim.ctl.de = -1; const pD = sim.probe(genDcVel(Vs, a1, 0)).pitchUp;
    sim.ctl.de = pU > pD ? 1 : -1;
    const N = 16, pts = [];
    for (let k = 0; k <= N; k++) {
      const a = a1 + (aS - a1) * k / N, r = sim.probe(genDcVel(Vs, a, 0));
      const dx = fwdX != null ? fwdX - r.cg[0] : 0;
      pts.push({ a, Fy: r.Fy, M: r.pitchUp + dx * r.Fy });
    }
    sim.ctl.de = 0;
    const FyMax = pts.reduce((m, p) => Math.max(m, p.Fy), 0);
    let FyHold = FyMax, held = true;
    for (let k = 1; k <= N; k++) if (pts[k].M < 0) {
      const p = pts[k - 1], c = pts[k], u = p.M > 0 ? p.M / (p.M - c.M) : 0;
      FyHold = Math.min(FyMax, p.Fy + (c.Fy - p.Fy) * u); held = false; break;
    }
    const ratio = Math.sqrt(FyMax / Math.max(1e-6, FyHold));
    const last = pts[N], cgAft = last.Fy > 0 ? -last.M / last.Fy : 0;
    const lvl = ratio > 1.30 ? 'fail' : ratio > 1.05 ? 'warn' : 'pass';
    row({ id: 'ctl.flare', group: 'control', label: 'Flare, power off: full up elevator reaches the stall',
          value: r2(ratio), unit: 'x Vs', level: lvl,
          limit: 'engine idle, CG at its forward limit, the stick on its stop: the slowest speed held must be the stall (pass <= 1.05 Vs; warn to 1.30 Vs - it lands fast; fail above: it cannot be slowed to an approach speed)',
          why: held ? 'full up elevator takes the wing to its stall angle with the engine idle'
                    : 'full up elevator, engine idle, CG at the forward corner: the nose stops rising at ' + r2(ratio * Vs * 3.6) + ' km/h (the stall is ' + r2(Vs * 3.6) + ' km/h)',
          fix: lvl === 'pass' ? '' : 'it is nose-heavy for its elevator: the CG ' + r2(cgAft) + ' m further aft (a lighter engine, or the wing moved forward by about that), or a bigger elevator chord' });
  }
  // ---- YAW AND ROLL -------------------------------------------------------
  if (t && geom && t.Sv > 0) {
    const Vv = t.Sv * t.lv / (geom.Sw * (geom.span || 1));
    const need = 0.020, lvl = Vv < 0.012 ? 'fail' : Vv < need ? 'warn' : 'pass';
    row({ id: 'yaw.Vv', group: 'yaw', label: 'Vertical tail volume Vv', value: r3(Vv), level: lvl,
          limit: 'warn < 0.020, fail < 0.012 (Raymer: homebuilt 0.04, sailplane 0.02; the Cub 0.023)',
          why: 'fin area ' + r2(t.Sv) + ' m2 on a ' + r2(t.lv) + ' m arm against the wing\'s ' + r2(geom.Sw) + ' m2 x ' + r2(geom.span) + ' m span',
          fix: lvl === 'pass' ? '' : 'the fin is too small or too close: grow it by ' + r2(need * geom.Sw * geom.span / t.lv - t.Sv) + ' m2' +
               genDcMove(need * geom.Sw * geom.span / t.Sv - t.lv) });
  }
  {
    const v = D.Cnb, lvl = v <= 0 ? 'fail' : v < 0.03 ? 'warn' : 'pass';
    const finK = t && t.lv > 0 ? t.lv : 4;
    row({ id: 'yaw.cnb', group: 'yaw', label: 'Weathercock stability (yaw stiffness)', value: r3(v), unit: '/rad', level: lvl,
          limit: 'fail <= 0 (it swaps ends), warn < 0.03; light aircraft 0.05-0.15',
          why: 'the yawing moment per radian of sideslip, the whole aeroplane in the tunnel (the fuselage ahead of the CG pulls the other way)',
          fix: lvl === 'pass' ? '' : 'more fin, further aft: each 0.1 m2 of fin at ' + r2(finK) + ' m adds about ' +
               r3(0.1 * finK * 2.8 / (D.Sw * D.b)) + '/rad' });
  }
  {
    const v = D.Clb, lvl = v >= 0 ? 'fail' : v > -0.02 ? 'warn' : 'pass';
    const dihedral = S && S.wings && S.wings[0] ? S.wings[0].dihedral || 0 : 0;
    // Raymer/Etkin: a wing's dihedral effect is about -a(1+2taper)/(6(1+taper)) per radian of dihedral
    const tp = S && S.wings && S.wings[0] ? (S.wings[0].taper || 1) : 1;
    const perDeg = -(def.params.polarWing.a3d || 4.5) * (1 + 2 * tp) / (6 * (1 + tp)) * Math.PI / 180;
    row({ id: 'roll.clb', group: 'roll', label: 'Dihedral effect (roll away from a sideslip)', value: r3(v), unit: '/rad', level: lvl,
          limit: 'fail >= 0 (it rolls INTO a sideslip), warn > -0.02; light aircraft -0.05 to -0.15',
          why: 'the rolling moment per radian of sideslip: dihedral, wing position (high wing helps, low wing hurts) and the fin\'s height',
          fix: lvl === 'pass' ? '' : 'add about ' + r2(Math.max(1, (-0.05 - v) / perDeg)) + ' deg of dihedral (now ' + r2(dihedral) + ' deg)' });
  }
  // the spiral: MIL-F-8785C Class I, Level 1 time-to-double >= 20 s (cat B),
  // Level 2 >= 8 s, Level 3 >= 4 s
  {
    const l = lat.spiral.lambda, T2 = l > 1e-6 ? Math.log(2) / l : Infinity;
    const lvl = T2 >= 20 ? 'pass' : T2 >= 8 ? 'warn' : 'fail';
    row({ id: 'roll.spiral', group: 'roll', label: 'Spiral mode (hands off, wings level)', value: isFinite(T2) ? r2(T2) : null,
          unit: 's to double', level: lvl,
          limit: 'stable, or a bank that doubles no faster than 20 s (MIL-F-8785C Level 1); warn 8-20 s; fail < 8 s',
          why: l <= 1e-6 ? 'stable: a bank dies away by itself' + (l < 0 ? ' (halves in ' + r2(Math.log(2) / -l) + ' s)' : '')
                         : 'unstable: a bank of 5 deg becomes 10 in ' + r2(T2) + ' s, then tightens into a spiral dive',
          fix: lvl === 'pass' ? '' : 'the dihedral effect is weak against the fin: more dihedral (or a higher wing); ' +
               'a smaller fin also helps the spiral but costs the dutch roll' });
  }
  {
    const d = lat.dutch, ok = d && isFinite(d.zeta);
    const zw = ok ? d.zeta * d.wn : -1;
    const lvl = !ok ? 'fail' : (d.zeta < 0 ? 'fail' : (d.zeta >= 0.08 && zw >= 0.15) ? 'pass' : d.zeta >= 0.02 ? 'warn' : 'fail');
    row({ id: 'yaw.dutch', group: 'yaw', label: 'Dutch roll (the yaw-roll wallow)', value: ok ? r3(d.zeta) : null, unit: 'damping',
          level: lvl,
          limit: 'damping >= 0.08 and damping x frequency >= 0.15 (MIL-F-8785C Level 1); warn >= 0.02; fail below or negative',
          why: ok ? (d.oscillatory ? 'frequency ' + r2(d.wn) + ' rad/s (period ' + r2(2 * Math.PI / Math.max(1e-6, d.wn)) + ' s), damping ' + r3(d.zeta)
                                   : 'not oscillatory: ' + (d.zeta > 0 ? 'heavily damped' : 'one root diverges - the yaw does not come back'))
                  : 'not measurable',
          fix: lvl === 'pass' ? '' : 'more fin area further aft (yaw damping grows with fin area x arm squared); less dihedral ' +
               'also calms it, at the spiral\'s expense' });
  }
  {
    const r = lat.roll, lvl = !(r.lambda < 0) ? 'fail' : r.tau <= 1.4 ? 'pass' : r.tau <= 3.0 ? 'warn' : 'fail';
    row({ id: 'roll.mode', group: 'roll', label: 'Roll response (time constant)', value: isFinite(r.tau) ? r2(r.tau) : null, unit: 's',
          level: lvl, limit: '<= 1.4 s (MIL-F-8785C Class I Level 1); warn <= 3.0 s',
          why: 'how fast the roll rate settles after an aileron input (roll damping against roll inertia)',
          fix: lvl === 'pass' ? '' : 'heavy wingtips or a short span with big inertia: lighter tips, or more span' });
  }
  // ---- CONTROL -----------------------------------------------------------
  {
    // steady roll at full aileron: pb/2V = Cl_da / -Clp
    const pb = Math.abs(D.da.Cl) / Math.max(1e-6, -D.Clp);
    const lvl = pb >= 0.07 ? 'pass' : pb >= 0.04 ? 'warn' : 'fail';
    row({ id: 'ctl.aileron', group: 'control', label: 'Aileron roll power', value: r3(pb), unit: 'pb/2V', level: lvl,
          limit: '>= 0.07 (the classic light-aircraft target); warn 0.04-0.07; fail below',
          why: 'steady roll rate at full aileron: ' + r2(pb * 2 * V / D.b * 180 / Math.PI) + ' deg/s at ' + r2(V * 3.6) + ' km/h',
          fix: lvl === 'pass' ? '' : 'longer or wider ailerons (their span outboard counts most)' });
  }
  {
    // the steady sideslip full rudder holds, and the crosswind that is at the approach
    const bMax = Math.abs(D.dr.Cn) / Math.max(1e-6, D.Cnb);
    const Va = 1.3 * Vs, xw = Va * Math.sin(Math.min(0.6, bMax));
    const need = 0.2 * Vs;                                     // FAR 23.233: 0.2 Vso demonstrated
    const lvl = D.Cnb <= 0 ? 'fail' : xw >= need ? 'pass' : xw >= 0.5 * need ? 'warn' : 'fail';
    row({ id: 'ctl.rudder', group: 'control', label: 'Rudder: crosswind it can hold', value: r2(xw * 1.944), unit: 'kt', level: lvl,
          limit: 'full rudder must hold the sideslip of a 0.2 Vs crosswind at the approach (FAR 23.233): ' + r2(need * 1.944) + ' kt here',
          why: 'full rudder holds ' + r2(bMax * 180 / Math.PI) + ' deg of sideslip at ' + r2(Va * 3.6) + ' km/h',
          fix: lvl === 'pass' ? '' : 'a bigger rudder (more of the fin\'s chord, or more fin)' });
  }
  const worst = rows.some(r => r.level === 'fail') ? 'fail' : rows.some(r => r.level === 'warn') ? 'warn' : 'pass';
  return { verdict: worst, rows,
           modes: { spiral: lat.spiral, roll: lat.roll, dutch: lat.dutch, short: sp },
           deriv: D };
}
