// ============================================================
// THE WINCH LAUNCH (WINCH, 2026-11-13; the user: "why wouldn't you plan for the winch"; A0: "tow.js's line with its far
// end a FIXED drum at the runway's end, reeling in at 20-30 m/s with the drum's tension law; the glider's steep climb on
// the line (pitch limited by tension and rope angle), release near overhead"). Pure: no THREE, no DOM.
//
// THE LINE is tow.js's (a tension-only spring-damper on the glider's nose hook, through the solver's own sim.onSubstep +
// sim.impulse - no solver change), with the far end a FIXED point - the winch's fairlead - and the line's REST LENGTH
// shrinking at the drum's speed: stretch = |hook - fairlead| - Lrest, its rate d/dt = -v_hook.u + v_drum. The coupling is
// per substep and exact (nothing at the far end moves), so it holds a stiff line: EA / L stiffens as the cable comes in.
// The object it returns has tow.js's surface (on / released / T / Tmax / L / angle / carP / hook / before / after /
// release / detach), so the page's tow plumbing (app.js towOn / towTick / towHud / the R key / the handover) drives it.
//
// THE DRUM: an engine of `power` W with a force cap `Fmax` at the cable (the torque converter's stall, the gearing), the
// drum and the cable on it an equivalent mass `mEq`, a little drag. Its speed vd >= 0 (a brake, never a pay-out).
// THE DRIVER (the winch driver's hand on the throttle - every club's, written down): the slack taken up gently (2 m/s
// until the line pulls a tenth of the glider's weight), then full power for the ground run; once the glider is climbing
// the throttle holds ITS AIRSPEED at `vTarget` (a PI on the error: fast - ease off, slow - more), and over the top of the
// launch (the line past `easeDeg` above the horizon) the power comes off so the glider is not hauled down at the end;
// after the release the throttle closes and the brake stops the drum. A line still on past `cutDeg` (a back-release that
// did not let go) or pulling past `cutT`: the driver fires the GUILLOTINE.
// THE RELEASE: the glider's back-release (automatic, the hook's own: the line past `relDeg` at the glider), the line slack
// for 2 s above 30 m, the cable wound in to 40 m, the WEAK LINK (default 1.6 x the glider's weight: the NZGA rule of
// thumb is ~1.33 x the type's gross weight, its spec's weak link the stronger side of it), the pilot's key, the guillotine.
// Measured in the study (futureDesigns/glider-launch/probe_winch.js): 1000 m of line -> 239 m; GATE WINCH holds it.
// ============================================================

// THE CG HOOK (a winch launch's, not the aerotow's nose hook): the line pulls at the belly just ahead of the centre of
// gravity, so the glider can rotate into the steep climb - on the nose hook the pull holds the nose down (measured, GATE
// WINCH's first launch: the elevator full up, the pitch falling from 30 to 7 deg, 187 m off 1000 m). A lattice has no
// node there (the motorglider's frame: its nearest is the nose's, 1.06 m ahead), so the hook is a POINT `ahead` (0.25 m)
// in front of the CG on the belly line, and the pull is SHARED between the belly's nodes either side of it - the two
// lowest centre-plane frame stations bracketing the point, weighted linearly, so the pull's moment about the CG is the
// point's. Returns { nodes, w } (weights summing to 1)
function winchHookNodes(sim, ahead0) {
  const n = sim.n, p = sim.p, A = sim.axes(), cg = sim.cgPos(), a0 = ahead0 ?? 0.25;
  const fx = -A[0][0], fy = -A[0][1], fz = -A[0][2], zR = A[2], yU = A[1];
  // the belly line: per 0.25 m station along the body, the lowest node within 0.3 m of the centre plane
  const st = new Map();
  for (let i = 0; i < n; i++) {
    const dx = p[i * 3] - cg[0], dy = p[i * 3 + 1] - cg[1], dz = p[i * 3 + 2] - cg[2];
    const ahead = dx * fx + dy * fy + dz * fz, side = dx * zR[0] + dy * zR[1] + dz * zR[2], up = dx * yU[0] + dy * yU[1] + dz * yU[2];
    if (Math.abs(side) > 0.3 || up > 0 || ahead < -2.5 || ahead > 2.5) continue;
    const k = Math.round(ahead / 0.25), b = st.get(k);
    if (!b || up < b.up) st.set(k, { i, ahead, up });
  }
  const L = [...st.values()].sort((a, b) => a.ahead - b.ahead);
  let fwd = null, aft = null;
  for (const q of L) { if (q.ahead >= a0 && (!fwd || q.ahead < fwd.ahead)) fwd = q; if (q.ahead < a0 && (!aft || q.ahead > aft.ahead)) aft = q; }
  if (!fwd || !aft) { const h = towHookNodes(sim); return { nodes: h, w: h.map(() => 1 / h.length) }; }   // (no belly: the nose hook)
  const t = (a0 - aft.ahead) / Math.max(1e-6, fwd.ahead - aft.ahead);
  return { nodes: [aft.i, fwd.i], w: [1 - t, t] };
}

// the winch: o = { anchor: [x, y, z] the fairlead (world), power (W), Fmax (N), mEq (kg), vMax (m/s), drag (N per m/s) }
function makeWinch(o) {
  o = o || {};
  return { anchor: o.anchor.slice(), power: o.power || 150e3, Fmax: o.Fmax || 9000, mEq: o.mEq || 350, vMax: o.vMax || 32,
           drag: o.drag ?? 40, vd: 0, thr: 0, I: 0, phase: 'idle', brake: 0, wound: 0, hold: !!o.hold };
}

// the line from the glider's nose hook to the winch's fairlead. o: { L0 (the rest length: default the distance + 1 m of
// slack), EA (1e6 N), zeta (0.5), weak (N), vTarget (m/s), relDeg (70), easeDeg (50), cutDeg (80), cutT (N), hook,
// groundAt(x, z), autoRelease (true) }
function makeWinchLine(sim, W, o) {
  o = o || {};
  const HK = o.hook ? (Array.isArray(o.hook) ? { nodes: o.hook, w: o.hook.map(() => 1 / o.hook.length) } : o.hook) : winchHookNodes(sim);
  const hook = HK.nodes, hw = HK.w, mG = sim.totalM || 300, Wt = mG * 9.81;
  const hookPos = () => { let x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0; for (let k = 0; k < hook.length; k++) { const i = hook[k], w = hw[k]; x += sim.p[i * 3] * w; y += sim.p[i * 3 + 1] * w; z += sim.p[i * 3 + 2] * w; vx += sim.v[i * 3] * w; vy += sim.v[i * 3 + 1] * w; vz += sim.v[i * 3 + 2] * w; } return [x, y, z, vx, vy, vz]; };
  const A = W.anchor, H0 = hookPos();
  const EA = o.EA || 1e6, zeta = o.zeta ?? 0.5;
  const T = { on: true, kind: 'winch', released: null, L: 0, T: 0, Tmax: 0, angle: 0, slack: 0, hook, hookW: hw, hookPos, carP: A.slice(), hitch: null,
              L0: o.L0 || Math.hypot(A[0] - H0[0], A[1] - H0[1], A[2] - H0[2]) + 1, Lrest: 0, weak: o.weak || 1.6 * Wt,
              vTarget: o.vTarget || 24, relDeg: o.relDeg ?? 70, easeDeg: o.easeDeg ?? 50, cutDeg: o.cutDeg ?? 80, cutT: o.cutT || 2.2 * Wt,
              Tlaunch: o.Tlaunch || 1.1 * Wt, Tclimb: o.Tclimb || 1.3 * Wt, k: 0, c: 0, W, tOn: 0, agl: 0, Vg: 0, cut: false, Tmean: 0 };
  T.Lrest = T.L0;
  let acc = 0, accT = 0;
  const prevHook = sim.onSubstep;
  sim.onSubstep = (s, dt) => {
    if (!T.on) return;
    const H = hookPos(), dx = A[0] - H[0], dy = A[1] - H[1], dz = A[2] - H[2], L = Math.hypot(dx, dy, dz) || 1e-9;
    const ux = dx / L, uy = dy / L, uz = dz / L;
    T.Lrest = Math.max(1, T.Lrest - W.vd * dt);
    const k = EA / T.Lrest, c = 2 * zeta * Math.sqrt(k * mG);
    const rate = -(H[3] * ux + H[4] * uy + H[5] * uz) + W.vd;     // d(L - Lrest)/dt
    let F = 0;
    if (L > T.Lrest) { F = k * (L - T.Lrest) + c * rate; if (F < 0) F = 0; }
    T.L = L; T.T = F; T.k = k; T.c = c; if (F > T.Tmax) T.Tmax = F;
    if (F > T.weak) { T.release('the weak link broke (' + (F / 1000).toFixed(1) + ' kN)'); return; }
    if (F > 0) for (let k = 0; k < hook.length; k++) { const J = F * dt * hw[k]; sim.impulse(hook[k], ux * J, uy * J, uz * J); }
    acc += F * dt; accT += dt;
    if (F <= 0) T.slack++;
  };
  T.before = () => { acc = 0; accT = 0; };
  // after the aeroplane's frame: the drum (its driver, its engine, the line's mean pull), the line's angle, the releases
  T.after = (dt) => {
    const Tm = T.on && accT > 0 ? acc / accT : 0; T.Tmean = Tm;
    const H = hookPos(), hd = Math.hypot(H[0] - A[0], H[2] - A[2]);
    T.angle = Math.atan2(H[1] - A[1], hd) * 180 / Math.PI;
    const agl = H[1] - (o.groundAt ? o.groundAt(H[0], H[2]) : A[1]); T.agl = agl;
    const Vair = sim.out && sim.out.V > 0 ? sim.out.V : Math.hypot(H[3], H[4], H[5]); T.Vg = Vair;
    // THE DRIVER (held: the winch idles - the page's start line, before the launch is called)
    if (T.on && W.hold) { W.thr = 0; W.phase = 'idle'; }
    else if (T.on) {
      if (W.phase === 'idle' || W.phase === 'takeup') { W.phase = Tm > 0.1 * Wt && W.vd > 1.5 ? 'launch' : 'takeup'; W.thr = W.phase === 'takeup' ? (W.vd < 2 ? 0.08 : 0) : W.thr; }
      // the ground run: open up over 1.5 s, but never pull the glider harder than `Tlaunch` (about its weight: a winch
      // launch accelerates at ~1 g) - the driver watches the pull, the engine would snatch a light glider off its link
      if (W.phase === 'launch') { W.thr = Tm > T.Tlaunch ? Math.max(0, W.thr - dt * 2.5 * (Tm / T.Tlaunch)) : Math.min(1, W.thr + dt / 1.5); if (agl > 8 || Vair > T.vTarget) { W.phase = 'climb'; W.I = Math.max(-0.6, Math.min(0.6, W.thr - 0.55)); } }
      if (W.phase === 'climb') {
        const e = T.vTarget - Vair;                                   // + slow: more power
        W.I = Math.max(-0.6, Math.min(0.6, W.I + e * dt * 0.04));
        let thr = 0.55 + 0.09 * e + W.I;
        if (T.angle > T.easeDeg) thr *= Math.max(0, 1 - (T.angle - T.easeDeg) / (T.relDeg - T.easeDeg + 5));   // over the top: easing off
        if (Tm > T.Tclimb) thr = Math.min(thr, W.thr - dt * 2.5 * (Tm / T.Tclimb - 1) * 4);                       // the pull's own limit
        W.thr = Math.max(0, Math.min(1, thr));
      }
      if (T.angle > T.cutDeg || Tm > T.cutT) { T.cut = true; T.release('the winch driver cut the cable (the guillotine: ' + (T.angle > T.cutDeg ? 'the line ' + T.angle.toFixed(0) + '° up and still on' : (Tm / 1000).toFixed(1) + ' kN') + ')'); }
    } else { W.thr = 0; W.brake = 1; W.phase = 'stopped'; }
    // THE ENGINE AND THE DRUM
    const Feng = W.thr * Math.min(W.Fmax, W.power / Math.max(W.vd, 2));
    const Fbrake = W.brake ? Math.min(6000, W.mEq * W.vd / dt) : 0;
    W.vd = Math.max(0, Math.min(W.vMax, W.vd + (Feng - Tm - W.drag * W.vd - Fbrake) / W.mEq * dt));
    W.wound += W.vd * dt;
    // THE GLIDER'S RELEASES (the back-release, a slack line at the top, the cable wound in)
    if (T.on && o.autoRelease !== false) {
      T.slackT = T.T <= 0 ? (T.slackT || 0) + dt : 0;
      if (T.angle > T.relDeg) T.release('the top of the launch (the back-release: the line ' + T.angle.toFixed(0) + '° up)');
      else if (agl > 30 && T.slackT > 2) T.release('the top of the launch (the line slack at ' + agl.toFixed(0) + ' m)');
      else if (T.Lrest < 40) T.release('the cable wound in to ' + T.Lrest.toFixed(0) + ' m');
    }
    T.tOn += dt;
  };
  T.release = (why) => { if (!T.on) return; T.on = false; T.released = why || 'released by the pilot'; T.T = 0; T.tRel = T.tOn; T.relAt = hookPos(); };
  T.detach = () => { T.on = false; if (sim.onSubstep !== undefined) sim.onSubstep = prevHook || null; };
  return T;
}

// THE GLIDER'S HANDS ON THE WINCH (the gate's and the autopilot's; by hand the player flies): wings level on the ailerons,
// the nose on the line with the rudder; the pitch: the ground run with the elevator neutral to 15 m/s, a shallow
// attitude off the ground to 8 m, then the full climb - `maxPitch` (42 deg) reached by height, eased whenever the speed
// falls under 1.1 x vMin (the stall's margin: a winch climb flown slow is the classic accident) and over the top of the
// launch as the line steepens; released, the glide's attitude
function makeWinchHands(sim, o) {
  o = o || {};
  const g0 = o.ground || 0, maxP = o.maxPitch ?? 42, vMin = o.vMin || 20;
  const cl = (x, m) => Math.max(-m, Math.min(m, x));
  // (the signs are tow.js's, flown: bank + = the right wing down, a negative aileron rolls it up; the nose left of the
  //  line +, a negative rudder yaws it right)
  return (line, dt) => {
    const Ax = sim.axes(), xA = Ax[0], zR = Ax[2], cg = sim.cgPos(), agl = cg[1] - g0, v = sim.cgVel(), V = sim.out && sim.out.V > 0 ? sim.out.V : Math.hypot(v[0], v[1], v[2]);
    const pitch = Math.asin(cl(-xA[1], 1)) * 57.3, bankR = -Math.asin(cl(zR[1], 1)) * 57.3;
    const fx = -xA[0], fz = -xA[2];
    let headL = 0;
    if (line && line.on) { const dx = line.carP[0] - cg[0], dz = line.carP[2] - cg[2], l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
      headL = Math.atan2(fx * uz - fz * ux, fx * ux + fz * uz) * 57.3; }
    const onG = sim.wheelsOnGround() > 0;
    if (onG && V < 15) sim.ctl.de = 0;
    else {
      let want;
      if (!line || !line.on) want = o.glidePitch ?? 0;
      else if (onG || agl < 8) want = 7;
      else {
        want = Math.min(maxP, 10 + (agl - 8) * 1.2);
        if (V < 1.1 * vMin) want -= 4 * (1.1 * vMin - V);                   // slow: lower the nose
        if (line.angle > 45) want = Math.min(want, maxP - (line.angle - 45) * 0.9);   // the top: flatten as the line steepens
        want = Math.max(2, want);
      }
      sim.ctl.de = cl(0.06 * (want - pitch), 0.8);
    }
    sim.ctl.da = cl(-0.03 * bankR + 0.02 * headL, 0.7);
    sim.ctl.dr = cl(-0.04 * headL, 0.7);
    sim.ctl.thr = 0;
    return { pitch, bank: bankR, agl, headL, V };
  };
}

// the fairlead's height over the ground and its distance back from the winch's middle (tools/_winch_gen.js DIM: deckY
// 1.00 + 0.36, fairZ -2.80), so a page that places the drawn winch and a gate that has none agree on the line's far end
const WINCH_FAIRLEAD = { y: 1.36, back: 2.80 };

if (typeof module !== 'undefined') module.exports = { winchHookNodes, makeWinch, makeWinchLine, makeWinchHands, WINCH_FAIRLEAD };
