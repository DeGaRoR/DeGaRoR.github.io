// ============================================================
// THE DRIVER (G2940 GROUND-VEHICLE, 2026-10-11) — the road a vehicle follows,
// the follower that steers it, the U-turn it plans at a roadside apron, the
// road graph and the destination it re-routes to. Pure: no THREE, no DOM; it
// drives a makeVehicle (vehicle.js) through its `ctl` and reads its pose.
// Node only, not in the bundle yet (as vehicle.js).
//
// WHAT IT REUSES AND WHAT IT CANNOT (futureDesigns/GROUND-VEHICLE-2026-10.md §3, §4):
//  - the path's SHAPE is 39_ground_path.js's: samples { x, z, hdg, kap, s }, kap
//    signed "toward increasing atan2", fillets at the corners, `from` = a join
//    from where the vehicle stands. Two of patternPath's choices are wrong for a
//    road, so the sampler here is its own (patternPath is the aeroplane's and
//    stays bit-identical):
//      * a bend under 2 deg is a drawn DOT and the path runs straight from corner
//        to corner - a traced C2 spline road bends ~1 deg a vertex all along a
//        curve, so patternPath would draw the CHORD of every gentle curve; here
//        every vertex is filleted, its tangent clamped to half its legs (on a dense
//        spline that gives back the spline's own radius);
//      * GP_MAXPTS (4 000): a longer path is RESAMPLED coarser (a 9 km road at
//        2.3 m, a 40 km one at 10 m - the fillets then 2-3 samples); here the road
//        is sampled at 1 m in a WINDOW of WIN_LEN ahead and the window is re-planned
//        from the vehicle as it runs out (the flight's planFromHere, on the road).
//  - the FOLLOWER is the taxi follower's law (43_pilot.js TAXI: the path's curvature
//    fed forward, the cross-track and the heading error trimmed) retuned for a
//    FRONT-steered car: the tracked point is the REAR axle's centre (the unsteered
//    axle - its path's curvature is tan(delta) / wb exactly, forward and reversing),
//    the curvature asked is kap(ahead) - ey / L^2 - 2 zeta e_psi / L with L a
//    speed-scaled lookahead, and the wheels are steered delta = atan(wb kap) -
//    the same law reversing, with the sign the kinematics give (kap = -tan(delta)/wb).
//  - the DESTINATION is the flight's To (38b_dest.js, ap.setDest): one To, the From
//    derived from where the vehicle is, a new To re-planned FROM HERE; setDest
//    answers as the autopilot does ('replan' / 'uturn' / 'queued' / 'same' / 'none').
// ============================================================

const VD_DS = 1.0;            // road samples, m
const VD_WIN = 1500;          // the road window sampled ahead, m
const VD_WIN_REPLAN = 400;    // re-plan the window when this much of it is left (and the leg goes on)
const VD_JOIN = 25;           // a join from the vehicle goes to the first node at least this far ahead
const VD_UTURN_COST = 80;     // a U-turn's cost in the router, metres of road

const vdWrap = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const vdClamp = (x, a, b) => x < a ? a : x > b ? b : x;

// ---- THE ROAD PATH: a polyline [[x, z], ...] -> samples, every vertex filleted ----
// opts: ds, r (the fillet radius a corner wants, default 60 m - a rural road; the legs clamp it), w (the road's width:
// a corner's fillet never cuts more than `dev` inside its vertex, so the vehicle stays on the road - the world's
// settlement roads turn 45 and 90 deg at a vertex, and a 60 m fillet put the wheels 4.6 m and 9 m inside them, off
// the graded bed, on the shoulder's feather), dev (that cut, default w/2 - 1.3 m), rFloor (no tighter than this:
// the vehicle's own turn), stop (true: the path ends in a stop), dir (+1 forward, -1 the vehicle reverses along it).
// Every corner's tangent is clamped to half its legs (the endpoints' too: a window re-sampled from a vertex behind
// the vehicle draws the corners it shares with the window before exactly as that one did).
function vehPath(poly, opts) {
  opts = opts || {};
  const ds = opts.ds || VD_DS, rDes = opts.r || 60, rFloor = opts.rFloor || 0;
  const dev = opts.dev ?? (opts.w ? Math.max(0.5, opts.w / 2 - 1.3) : Infinity);
  const P = [];
  for (const q of poly) { const l = P[P.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.05) P.push([q[0], q[1]]); }
  const pts = [];
  if (P.length < 2) return { pts, len: 0, sStop: null, dir: opts.dir || 1 };
  const n = P.length, tan = new Array(n).fill(0), rad = new Array(n).fill(Infinity), U = [];
  for (let i = 0; i < n - 1; i++) { const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz); U.push([dx / l, dz / l, l]); }
  for (let i = 1; i < n - 1; i++) {
    const a = U[i - 1], b = U[i], th = Math.acos(vdClamp(a[0] * b[0] + a[1] * b[1], -1, 1));
    if (th < 1e-4) continue;
    // the radius the road's width allows (the arc's middle is r (1 / cos(th / 2) - 1) inside the vertex)
    const rW = dev / Math.max(1e-9, 1 / Math.cos(th / 2) - 1);
    const r = Math.max(Math.min(rDes, rW), rFloor);
    const t = Math.min(r * Math.tan(th / 2), 0.5 * a[2], 0.5 * b[2]);
    tan[i] = t; rad[i] = t / Math.tan(th / 2);
  }
  let s = 0;
  const push = (x, z, hdg, kap) => { const q = pts[pts.length - 1]; if (q) s += Math.hypot(x - q.x, z - q.z); pts.push({ x, z, hdg, kap, s }); };
  const line = (ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz); if (l < 1e-6) return;
    const h = Math.atan2(dz, dx); if (!pts.length) push(ax, az, h, 0);
    const k = Math.max(1, Math.round(l / ds));
    for (let j = 1; j <= k; j++) push(ax + dx * j / k, az + dz * j / k, h, 0);
  };
  let cur = P[0];
  for (let i = 1; i < n; i++) {
    if (i === n - 1 || !tan[i]) { line(cur[0], cur[1], P[i][0], P[i][1]); cur = P[i]; continue; }
    const a = U[i - 1], b = U[i], t = tan[i], r = rad[i];
    const p1 = [P[i][0] - a[0] * t, P[i][1] - a[1] * t], p2 = [P[i][0] + b[0] * t, P[i][1] + b[1] * t];
    line(cur[0], cur[1], p1[0], p1[1]);
    const sg = a[0] * b[1] - a[1] * b[0] >= 0 ? 1 : -1;
    const cx = p1[0] - sg * a[1] * r, cz = p1[1] + sg * a[0] * r;   // the centre, on the turn's side (-a.z, a.x) is +atan2
    const a0 = Math.atan2(p1[1] - cz, p1[0] - cx), a1 = Math.atan2(p2[1] - cz, p2[0] - cx);
    const dA = vdWrap(a1 - a0), k = Math.max(1, Math.ceil(Math.abs(dA) * r / ds));
    if (!pts.length) push(p1[0], p1[1], Math.atan2(a[1], a[0]), 0);
    for (let j = 1; j <= k; j++) {
      const an = a0 + dA * j / k;
      push(cx + r * Math.cos(an), cz + r * Math.sin(an), vdWrap(an + sg * Math.PI / 2), sg / r);
    }
    cur = p2;
  }
  return { pts, len: s, sStop: opts.stop ? s : null, dir: opts.dir || 1 };
}

// a MANOEUVRE's primitive list -> one sampled path per run of the same direction. prims: [{ dir, kb, len }] from a
// pose { x, z, hdg } (the reference point - the rear axle - and the chassis' heading); kb is the chassis' curvature
// (tan(delta) / wb, + right) per metre FORWARD; the samples carry the TRAVEL heading and curvature (reversing: the
// heading + pi and -kb)
function vehManoeuvrePaths(pose, prims, ds) {
  ds = ds || 0.25;
  let x = pose.x, z = pose.z, h = pose.hdg;
  const out = [];
  let cur = null;
  for (const p of prims) {
    if (!cur || cur.dir !== p.dir) {
      cur = { pts: [], dir: p.dir, len: 0, sStop: 0 };
      out.push(cur);
      cur.pts.push({ x, z, hdg: p.dir > 0 ? h : vdWrap(h + Math.PI), kap: p.dir > 0 ? p.kb : -p.kb, s: 0 });
    }
    const k = Math.max(1, Math.ceil(p.len / ds)), d = p.len / k;
    for (let j = 0; j < k; j++) {
      const hm = h + 0.5 * p.kb * p.dir * d;      // the midpoint heading of the step
      x += Math.cos(hm) * p.dir * d; z += Math.sin(hm) * p.dir * d; h += p.kb * p.dir * d;
      const q = cur.pts[cur.pts.length - 1];
      cur.pts.push({ x, z, hdg: vdWrap(p.dir > 0 ? h : h + Math.PI), kap: p.dir > 0 ? p.kb : -p.kb, s: q.s + d });
    }
    cur.len = cur.pts[cur.pts.length - 1].s; cur.sStop = cur.len;
  }
  return { paths: out, end: { x, z, hdg: vdWrap(h) } };
}

// where the vehicle's point (x, z) is on the path: the nearest SEGMENT (interpolated), searched forward from the
// last index (a road and its way back, an apron's two legs, lie side by side). ey + = on the +atan2 side.
function vehLocate(path, i0, x, z, full) {
  const P = path.pts, N = P.length;
  if (N < 2) return { i: 0, f: 0, ey: 0, s: 0, sRem: 0, hdg: 0, dist: 0 };
  const a = full ? 0 : Math.max(0, (i0 | 0) - 3), b = full ? N - 2 : Math.min(N - 2, (i0 | 0) + 120);
  let best = a, bf = 0, bd = Infinity;
  for (let i = a; i <= b; i++) {
    const p = P[i], q = P[i + 1], dx = q.x - p.x, dz = q.z - p.z, l2 = dx * dx + dz * dz || 1e-12;
    let f = ((x - p.x) * dx + (z - p.z) * dz) / l2;
    f = f < 0 ? 0 : f > 1 ? 1 : f;
    const ex = p.x + dx * f - x, ez = p.z + dz * f - z, d = ex * ex + ez * ez;
    if (d < bd - 1e-9) { bd = d; best = i; bf = f; }
  }
  const p = P[best], q = P[best + 1];
  const hdg = p.hdg + vdWrap(q.hdg - p.hdg) * bf;
  const tx = Math.cos(hdg), tz = Math.sin(hdg), px = p.x + (q.x - p.x) * bf, pz = p.z + (q.z - p.z) * bf;
  // past the end the error along the path is the distance still to run, signed (an overshoot reads negative)
  const s = p.s + (q.s - p.s) * bf;
  let sRem = path.len - s;
  if (best === N - 2 && bf >= 1) sRem = -((x - q.x) * tx + (z - q.z) * tz);
  return { i: best, f: bf, ey: tx * (z - pz) - tz * (x - px), s, sRem, hdg, dist: Math.sqrt(bd) };
}
// the path's curvature at arc length s (the sample's own)
function vehKapAt(path, i, s) {
  const P = path.pts; let j = Math.max(0, i);
  while (j < P.length - 1 && P[j + 1].s <= s) j++;
  return P[j].kap;
}

// THE STEERING LAW: the bicycle angle the follower asks, from where the reference point is (loc) and how fast it
// travels. The taxi follower's feed-forward + trims, in the space domain: L the lookahead (speed-scaled), the
// error dynamics e'' + (2 zeta / L) e' + e / L^2 = 0 per metre run - the same settling distance at any speed.
function vehSteer(def, path, loc, uT, psiT, tune) {
  tune = tune || {};
  // (tuned on GATE VEHICLE's 300 m road: L = 2 m + 0.4 s of travel, a 0.15 s preview - a longer preview or
  // lookahead cut the curve's entry: 0.54 m off at L = 3 + 0.9 s, 0.27 m here)
  const L = vdClamp((tune.L0 ?? 2.0) + (tune.Lt ?? 0.4) * uT, tune.Lmin ?? 2.0, tune.Lmax ?? 25);
  const zeta = tune.zeta ?? 0.75;
  const kff = vehKapAt(path, loc.i, loc.s + Math.max(0.3, uT * (tune.tff ?? 0.15)));   // the steering's lag, previewed
  const ePsi = vdWrap(psiT - loc.hdg);
  const k = kff - loc.ey / (L * L) - 2 * zeta * Math.sin(vdClamp(ePsi, -1.2, 1.2)) / L;
  const tanD = path.dir > 0 ? def.wb * k : -def.wb * k;
  return Math.atan(tanD);
}
// THE SPEED THE ROAD ALLOWS here: the cruise, every sample ahead within the braking distance at its own lateral
// limit (v^2 <= aLat / |kap| + 2 aDec ds), and the stop at the path's end
// ...and THE ROAD'S PROFILE (a crest, a dip, a ford): v^2 <= aVert / |y''| with y'' the ground's curvature along the
// path (sampled once per path from world.terrainH, smoothed over 5 m) - the world's roads cross their streams on the
// ground (the hydrology's carve beats the road's grade: 2-8 fords a road on the analytic world)
function vehProfile(path, world) {
  if (path.kv || !world || typeof world.terrainH !== 'function') return path.kv || null;
  const P = path.pts, n = P.length, y = new Float64Array(n), kv = new Float64Array(n);
  for (let j = 0; j < n; j++) y[j] = world.terrainH(P[j].x, P[j].z);
  const h = 2;   // the second difference over +-2 samples (~2 m), the bumps of a metre smoothed out
  for (let j = h; j < n - h; j++) {
    const d1 = P[j].s - P[j - h].s, d2 = P[j + h].s - P[j].s;
    kv[j] = d1 > 0 && d2 > 0 ? 2 * ((y[j + h] - y[j]) / d2 - (y[j] - y[j - h]) / d1) / (d1 + d2) : 0;
  }
  return (path.kv = kv);
}
function vehSpeedTarget(path, loc, uT, tune) {
  const P = path.pts, vC = tune.vCruise, aLat = tune.aLat ?? 2.2, aDec = tune.aDec ?? 1.6, aV = tune.aVert ?? 2.0, KV = path.kv;
  // (the deceleration of the profile that binds is fed forward: `a`, so the pedals do not lag a braking curve)
  let v2 = vC * vC, a = 0;
  const look = uT * uT / (2 * aDec) + 15;
  for (let j = loc.i; j < P.length && P[j].s - loc.s < look; j++) {
    const k = Math.abs(P[j].kap), kz = KV ? Math.abs(KV[j]) : 0, lim = Math.min(k > 1e-5 ? aLat / k : Infinity, kz > 1e-4 ? aV / kz : Infinity);
    if (lim < Infinity) {
      const c = lim + 2 * aDec * Math.max(0, P[j].s - loc.s);
      if (c < v2) { v2 = c; a = P[j].s > loc.s + 0.5 ? -aDec : 0; }
    }
  }
  if (path.sStop != null) {
    const aS = tune.aStop ?? aDec, pad = tune.stopPad ?? 0.05;
    const c = 2 * aS * Math.max(0, loc.sRem - pad);
    if (c < v2) { v2 = c; a = -aS; }
    if (loc.sRem < pad) { v2 = 0; a = -aS; }
  }
  return { v: Math.sqrt(Math.max(0, v2)), a: uT > 0.05 ? a : 0 };
}
// THE PEDALS: an acceleration asked (a P + I on the speed error), the force it needs with the grade, the rolling
// and the air fed forward, then the throttle (the gear's force available) or the brake
function vehPedals(car, dir, uT, vT, Sx, dt, tune, aRef) {
  const def = car.def, m = def.mass, A = car.axes();
  const err = vT - uT;
  // stopping: the last of the speed is braked out firmly, and held
  if (vT < 0.02 && uT < 0.6) { Sx.I = 0; return { thr: 0, brake: 1 }; }
  Sx.I = vdClamp((Sx.I || 0) + (tune.ki ?? 0.25) * err * dt, -0.6, 0.6);
  const aDes = vdClamp((tune.kp ?? 0.9) * err + Sx.I + (aRef || 0), -(tune.aBrake ?? 4.0), tune.aMax ?? 2.5);
  const grade = dir * A.fwd[1];   // + uphill along the travel
  const Fneed = m * aDes + m * 9.81 * grade + 0.015 * m * 9.81 + 0.5 * 1.225 * def.aero.CdA * uT * uT;
  const D = def.drive;
  const Favail = dir > 0 ? Math.min(D.F0, D.P / Math.max(0.5, uT)) : D.Frev * Math.max(0.05, 1 - uT / D.vRev);
  if (Fneed >= 0) return { thr: vdClamp(Fneed / Favail, 0, 1), brake: 0 };
  return { thr: 0, brake: vdClamp(-Fneed / def.brake.F, 0, 1) };
}

// ---- THE U-TURN at a roadside apron (or on a road wide enough) ----
// site (local frame): { x, z, hdg: the arrival direction at the apron's centre (world), hw: the road's half width,
//   side: +1 the apron on the +atan2 side (right of the arrival), -1 left, a0, a1: its extent along the road from
//   the centre (a0 < 0 < a1), depth: from the road's edge, back, ahead: the straight road behind / ahead of the
//   centre the manoeuvre may use, xNow: where the vehicle's reference point is (local X; the start is ahead of it) }
// Three families, all ending on the road's centreline facing back:
//   'back-in'      stop past the apron's middle, reverse into it, drive out turning the other way (the short rear
//                  goes in - but the long front swings over the far edge: a wide road's)
//   'nose-in'      drive into the apron, reverse out steering away (two moves; the narrow road's)
//   'three-point'  forward toward the apron, reverse across the road, forward away (a road nearly a circle wide)
// The candidates are swept (the body's footprint at 0.2 m of travel) against the corridor shrunk by a margin;
// the shortest feasible wins, the widest margin first. Returns { family, start (local X), prims, len, margin } or null.
function vehUturnPlan(def, site, opts) {
  opts = opts || {};
  const F = def.foot, Rm = def.rMin, sg = site.side >= 0 ? 1 : -1, hw = site.hw;
  const xMin = -(site.back ?? 40), xMax = site.ahead ?? 40, xNow = site.xNow ?? -Infinity;
  const inside = (X, Z, mg) => {
    if (X < xMin + mg || X > xMax - mg) return false;
    if (Math.abs(Z) <= hw - mg) return true;
    const zs = sg * Z;
    return X >= site.a0 + mg && X <= site.a1 - mg && zs >= 0 && zs <= hw + site.depth - mg;
  };
  // the footprint's check points, from the reference point (front, rear, sides every ~0.6 m)
  const FP = [];
  for (let a = -F.rear; a <= F.front + 1e-6; a += (F.front + F.rear) / 8) { FP.push([a, F.half]); FP.push([a, -F.half]); }
  FP.push([F.front, 0]); FP.push([-F.rear, 0]);
  const sweep = (X0, prims, mg) => {
    let x = X0, z = 0, h = 0;
    const ok = () => { const c = Math.cos(h), s = Math.sin(h); for (const [a, b] of FP) if (!inside(x + c * a - s * b, z + s * a + c * b, mg)) return false; return true; };
    if (!ok()) return null;
    for (const p of prims) {
      const k = Math.max(1, Math.ceil(p.len / 0.2)), d = p.len / k;
      for (let j = 0; j < k; j++) {
        const hm = h + 0.5 * p.kb * p.dir * d;
        x += Math.cos(hm) * p.dir * d; z += Math.sin(hm) * p.dir * d; h += p.kb * p.dir * d;
        if (!ok()) return null;
      }
    }
    return { x, z, h };
  };
  const Rs = [1.15, 1.3, 1.5, 1.8].map(k => k * Rm), R3max = 60;
  const best = { cost: Infinity, plan: null };
  const consider = (family, X0, prims, mg) => {
    const len = prims.reduce((s, p) => s + p.len, 0), nRev = prims.filter((p, i) => i && p.dir !== prims[i - 1].dir).length;
    const cost = len + 6 * nRev + 0.05 * Math.abs(X0 - Math.max(xNow, site.a0));
    if (cost >= best.cost) return;
    const e = sweep(X0, prims, mg);
    if (!e || Math.abs(e.z) > 0.3 || Math.abs(vdWrap(e.h - Math.PI)) > 0.05) return;
    best.cost = cost; best.plan = { family, start: X0, prims, len, margin: mg, end: e };
  };
  const deg = Math.PI / 180;
  for (const mg of opts.margins || [0.4, 0.25, 0.12]) {
    best.cost = Infinity; best.plan = null;
    for (let X0 = Math.max(xNow, site.a0 - 6); X0 <= site.a1 + 14; X0 += 0.5) {
      // BACK-IN: reverse (steer toward the apron) by th1, straight back L2, forward out (steer away) to face back
      for (const R1 of Rs) for (let th = 50; th <= 120; th += 5) for (const L2 of [0, 0.5, 1, 1.5, 2, 3, 4]) {
        const t1 = th * deg;
        // the reference point after the reverse arc and the straight, in the apron's side's frame
        const Z2 = R1 * (1 - Math.cos(t1)) + L2 * Math.sin(t1);
        const R3 = Z2 / (1 + Math.cos(t1));
        if (!(R3 >= Rs[0] - 1e-9 && R3 <= R3max)) continue;
        const prims = [{ dir: -1, kb: sg / R1, len: R1 * t1 }];
        if (L2 > 0) prims.push({ dir: -1, kb: 0, len: L2 });
        prims.push({ dir: 1, kb: -sg / R3, len: R3 * (Math.PI - t1) });
        consider('back-in', X0, prims, mg);
      }
      // NOSE-IN, TWO MOVES: forward into the apron by th1 (+ L1 straight in), reverse out steering away to face back -
      // the front goes in first, so the far edge sees only the short rear's swing (back-in swings the long front
      // over it: 0.4 m past a 3 m road's edge for this pickup, at any radius)
      for (const R1 of Rs) for (let th = 50; th <= 120; th += 5) for (const L1 of [0, 0.5, 1, 1.5, 2, 3, 4]) {
        const t1 = th * deg;
        const Z1 = R1 * (1 - Math.cos(t1)) + L1 * Math.sin(t1);
        const R2 = Z1 / (1 + Math.cos(t1));
        if (!(R2 >= Rs[0] - 1e-9 && R2 <= R3max)) continue;
        const prims = [{ dir: 1, kb: sg / R1, len: R1 * t1 }];
        if (L1 > 0) prims.push({ dir: 1, kb: 0, len: L1 });
        prims.push({ dir: -1, kb: -sg / R2, len: R2 * (Math.PI - t1) });
        consider('nose-in', X0, prims, mg);
      }
      // THE THREE-POINT TURN: forward toward the apron by th1, reverse steering away by th2 (the rear across the
      // road), forward to face back. Z (the apron's side +): a right-steer arc moves it by R (cos h0 - cos h1), a
      // left-steer one by R (cos h1 - cos h0), h the heading turned toward the apron
      for (const R1 of Rs) for (let th = 30; th <= 110; th += 5) for (const R2 of Rs.slice(0, 3)) for (let th2 = 30; th + th2 <= 170; th2 += 10) {
        const t1 = th * deg, ps = t1 + (th2 * deg);
        const Z2 = R1 * (1 - Math.cos(t1)) + R2 * (Math.cos(ps) - Math.cos(t1));
        const R3 = -Z2 / (1 + Math.cos(ps));
        if (!(R3 >= Rs[0] - 1e-9 && R3 <= R3max)) continue;
        const prims = [{ dir: 1, kb: sg / R1, len: R1 * t1 }, { dir: -1, kb: -sg / R2, len: R2 * (ps - t1) }, { dir: 1, kb: sg / R3, len: R3 * (Math.PI - ps) }];
        consider('three-point', X0, prims, mg);
      }
    }
    if (best.plan) return best.plan;
  }
  return null;
}
// a site's local pose -> the world
function vehSiteToWorld(site, X, Z, h) {
  const c = Math.cos(site.hdg), s = Math.sin(site.hdg);
  return { x: site.x + c * X - s * Z, z: site.z + s * X + c * Z, hdg: vdWrap(site.hdg + (h || 0)) };
}

// ---- THE ROAD GRAPH ----
// spec: { roads: [{ pts: [[x, z], ...], w: width m, r?: fillet m }], places: [{ id, road, s, kind: 'apron' | 'stop',
//   side?: +1 right of the road's DRAWN direction / -1, len?, depth? }] }  (futureDesigns/GROUND-VEHICLE-2026-10.md §5:
// the shape SCENERY-ED-2's road graph is asked to carry). Roads meet where their vertices coincide (0.5 m).
function vehRoadGraph(spec) {
  const nodes = [], edges = [], key = new Map(), places = {};
  const nodeAt = (x, z, extra) => {
    const k = Math.round(x * 2) + ',' + Math.round(z * 2);
    if (key.has(k) && !extra) return key.get(k);
    const id = nodes.length; nodes.push(Object.assign({ id, x, z, adj: [] }, extra || {})); if (!extra) key.set(k, id); return id;
  };
  spec.roads.forEach((rd, ri) => {
    // the road's vertices with its places inserted at their arc length
    const pl = (spec.places || []).filter(p => p.road === ri).sort((a, b) => a.s - b.s);
    const V = []; let s = 0, pi = 0;
    for (let i = 0; i < rd.pts.length; i++) {
      const p = rd.pts[i];
      if (i) {
        const q = rd.pts[i - 1], l = Math.hypot(p[0] - q[0], p[1] - q[1]);
        while (pi < pl.length && pl[pi].s < s + l) {
          const f = (pl[pi].s - s) / l, P = pl[pi], dx = (p[0] - q[0]) / l, dz = (p[1] - q[1]) / l;
          V.push({ x: q[0] + (p[0] - q[0]) * f, z: q[1] + (p[1] - q[1]) * f, place: P, dx, dz });
          pi++;
        }
        s += l;
      }
      V.push({ x: p[0], z: p[1] });
    }
    let prev = -1;
    for (const v of V) {
      const id = v.place ? nodeAt(v.x, v.z, { place: v.place.id }) : nodeAt(v.x, v.z);
      if (v.place) places[v.place.id] = Object.assign({ ahead: vdStraight(rd.pts, v, 1), back: vdStraight(rd.pts, v, -1) }, v.place,
                                                      { node: id, x: v.x, z: v.z, dx: v.dx, dz: v.dz, w: rd.w || 4 });
      if (prev >= 0 && prev !== id) {
        const e = edges.length, l = Math.hypot(nodes[id].x - nodes[prev].x, nodes[id].z - nodes[prev].z);
        edges.push({ a: prev, b: id, len: l, road: ri, w: rd.w || 4, r: rd.r });
        nodes[prev].adj.push(e); nodes[id].adj.push(e);
      }
      prev = id;
    }
  });
  return { nodes, edges, places, spec };
}
// how far the road runs STRAIGHT from a point on it (within 0.3 m of its tangent), along its drawn direction (sg +1)
// or against it: the stretch a U-turn may use (the planner's corridor is that straight road and the apron)
function vdStraight(pts, v, sg) {
  const tx = v.dx * sg, tz = v.dz * sg;
  let best = 0;
  const order = sg > 0 ? pts.map((p, i) => i) : pts.map((p, i) => pts.length - 1 - i);
  let prevA = 0, prevD = 0;
  for (const i of order) {
    const p = pts[i], a = (p[0] - v.x) * tx + (p[1] - v.z) * tz;
    if (a <= 1e-6) continue;
    const d = Math.abs((p[0] - v.x) * tz - (p[1] - v.z) * tx);
    if (d > 0.3) return prevA + (a - prevA) * (0.3 - prevD) / Math.max(1e-6, d - prevD);
    prevA = a; prevD = d; best = a;
  }
  return best;
}
// Dijkstra from a node, an edge blocked (the one the vehicle stands on: no U-turn on the road itself)
function vehDijkstra(G, src, blocked) {
  const N = G.nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  dist[src] = 0;
  for (;;) {   // a plain O(N^2) scan: road graphs of a few thousand vertices, planned on a request
    let u = -1, du = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < du) { du = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = 1;
    for (const e of G.nodes[u].adj) {
      if (blocked && blocked.has(e)) continue;
      const E = G.edges[e], v = E.a === u ? E.b : E.a, d = du + E.len;
      if (d < dist[v]) { dist[v] = d; prev[v] = u; }
    }
  }
  return { dist, prev };
}
const vdPathTo = (D, n) => { const out = []; for (let k = n; k >= 0; k = D.prev[k]) out.unshift(k); return out; };
// where a pose is on the graph: the nearest edge, the node ahead along the heading, the one behind
function vehGraphLocate(G, x, z, hdg) {
  let best = null;
  for (let e = 0; e < G.edges.length; e++) {
    const E = G.edges[e], A = G.nodes[E.a], B = G.nodes[E.b], dx = B.x - A.x, dz = B.z - A.z, l2 = dx * dx + dz * dz || 1e-12;
    let f = ((x - A.x) * dx + (z - A.z) * dz) / l2; f = vdClamp(f, 0, 1);
    const d = Math.hypot(A.x + dx * f - x, A.z + dz * f - z);
    if (!best || d < best.d) best = { e, f, d };
  }
  const E = G.edges[best.e], A = G.nodes[E.a], B = G.nodes[E.b];
  const fwd = Math.cos(hdg) * (B.x - A.x) + Math.sin(hdg) * (B.z - A.z) >= 0;
  const ahead = fwd ? E.b : E.a, behind = fwd ? E.a : E.b;
  const N = G.nodes[ahead];
  return { e: best.e, d: best.d, ahead, behind, dAhead: Math.hypot(N.x - x, N.z - z) };
}

// ---- THE DRIVER ----
// makeDriver(car, G, tune): the vehicle's autopilot on the road. tune: { vCruise, aLat, aDec, ... } (vehSpeedTarget,
// vehPedals, vehSteer's), man: the manoeuvre's own { v, L0, Lt, Lmin }
function makeDriver(car, G, tune) {
  tune = Object.assign({ vCruise: 20, aLat: 2.2, aDec: 1.6, aStop: 1.4 }, tune || {});
  const manT = Object.assign({ vCruise: 1.5, aDec: 0.8, aStop: 0.6, L0: 2.0, Lt: 0.6, Lmin: 2.0, Lmax: 4, tff: 0.2, stopPad: 0.03, kp: 1.2 }, tune.man || {});
  const def = car.def;
  const D = {
    phase: 'IDLE', to: null, plan: null, leg: null, path: null, i: 0, man: null, manI: 0, wait: 0, Sx: {},
    log: [], stats: { xtMax: 0, xtSq: 0, xtN: 0, manXt: 0, uturns: 0, windows: 0 }, queued: null,
  };
  const say = (what, msg) => D.log.push({ t: +car.st.t.toFixed(2), what, msg });
  const pose = () => { const p = car.refPoint(); return { x: p[0], z: p[2], hdg: car.heading() }; };
  // THE ROUTE FROM HERE to a place: straight on, or a U-turn at an apron ahead and back (the cheaper)
  function route(to) {
    const P = G.places[to]; if (!P) return null;
    const p = pose(), L = vehGraphLocate(G, p.x, p.z, p.hdg);
    const blk = new Set([L.e]);
    const Df = vehDijkstra(G, L.ahead, blk);
    let bestR = null;
    // the place on the very edge ahead of the vehicle
    if (L.ahead === P.node || Df.dist[P.node] < Infinity) {
      const c = L.dAhead + Df.dist[P.node];
      bestR = { kind: 'drive', cost: c, nodes: vdPathTo(Df, P.node) };
    }
    // U-turns: an apron reachable ahead (or the one the vehicle stands at), then back the way it came
    for (const id in G.places) {
      const A = G.places[id]; if (A.kind !== 'apron') continue;
      let dA, nodesA, came;
      if (A.node === L.behind && Math.hypot(A.x - p.x, A.z - p.z) < 6) {
        // stopped just past it: the vehicle came from A's neighbour BEHIND it (the one most against its heading)
        dA = 0; nodesA = []; came = -1; let bd = Infinity;
        for (const e of G.nodes[A.node].adj) { const E = G.edges[e], o = E.a === A.node ? E.b : E.a, N = G.nodes[o];
          const d = (N.x - A.x) * Math.cos(p.hdg) + (N.z - A.z) * Math.sin(p.hdg); if (o !== L.ahead && d < bd) { bd = d; came = o; } }
        if (came < 0) continue;
      }
      else if (Df.dist[A.node] < Infinity) { dA = L.dAhead + Df.dist[A.node]; nodesA = vdPathTo(Df, A.node); came = nodesA.length > 1 ? nodesA[nodesA.length - 2] : L.behind; }
      else continue;
      // after the turn the vehicle heads back toward `came`: the edge on the far side of the apron is blocked
      const back = new Set();
      for (const e of G.nodes[A.node].adj) { const E = G.edges[e], o = E.a === A.node ? E.b : E.a; if (o !== came) back.add(e); }
      const Db = vehDijkstra(G, A.node, back);
      if (!(Db.dist[P.node] < Infinity) && A.node !== P.node) continue;
      const c = dA + VD_UTURN_COST + Db.dist[P.node];
      if (!bestR || c < bestR.cost) bestR = { kind: 'uturn', cost: c, nodes: nodesA, apron: id, came };
    }
    return bestR;
  }
  // the arrival direction at an apron, the site in its local frame, the manoeuvre planned there
  function uturnAt(apronId, came) {
    const A = G.places[apronId], C = G.nodes[came];
    // the arrival direction: from the node it came from (or the drawn direction's sign) toward the apron
    let ux = A.dx, uz = A.dz;
    if (C && (A.x - C.x) * ux + (A.z - C.z) * uz < 0) { ux = -ux; uz = -uz; }
    const hdg = Math.atan2(uz, ux);
    // the apron's side relative to the ARRIVAL (the place's side is relative to the road's drawn direction)
    const flip = ux * A.dx + uz * A.dz < 0;
    const side = (A.side >= 0 ? 1 : -1) * (flip ? -1 : 1);
    const p = pose();
    const xNow = (p.x - A.x) * ux + (p.z - A.z) * uz;
    const back = flip ? A.ahead : A.back, ahead = flip ? A.back : A.ahead;
    const site = { x: A.x, z: A.z, hdg, hw: A.w / 2, side, a0: -(A.len || 20) / 2, a1: (A.len || 20) / 2, depth: A.depth || 7,
                   back: Math.min(60, back), ahead: Math.min(60, ahead), xNow: Math.max(xNow, -Math.min(60, back) + def.foot.rear + 1) };
    const plan = vehUturnPlan(def, site);
    return plan ? { site, plan } : null;
  }
  // the road leg's node polyline from the vehicle, the first node a join's length ahead
  function legPoly(nodes, endPt) {
    const p = pose(), poly = [[p.x, p.z]];
    let started = false;
    const fx = Math.cos(p.hdg), fz = Math.sin(p.hdg);
    for (const n of nodes) {
      const N = G.nodes[n], ahead = (N.x - p.x) * fx + (N.z - p.z) * fz;
      if (!started && (ahead < VD_JOIN || Math.hypot(N.x - p.x, N.z - p.z) < VD_JOIN)) continue;
      started = true; poly.push([N.x, N.z]);
    }
    if (endPt) {
      // the end point lies on the last edge: drop the nodes past it along the leg
      while (poly.length > 1) {
        const a = poly[poly.length - 1], b = poly.length > 1 ? poly[poly.length - 2] : null;
        if (!b) break;
        const dx = a[0] - b[0], dz = a[1] - b[1], f = ((endPt[0] - b[0]) * dx + (endPt[1] - b[1]) * dz) / (dx * dx + dz * dz || 1);
        if (f < 1 && poly.length > 2) { poly.pop(); continue; }
        break;
      }
      poly.push(endPt);
    }
    return poly;
  }
  // a road leg sampled in a WINDOW (VD_WIN ahead): the GP_MAXPTS fix. A re-plan starts the window at the vertex
  // BEFORE the segment the vehicle is on - the corners it shares with the window before are drawn the same, so the
  // path under the wheels does not move (a re-plan from the vehicle's own pose, with a join, stepped the heading
  // 36 deg in the middle of a corner: the first cut spun the pickup off the world's road 0)
  function windowPath(leg, x, z) {
    let j = 0;
    if (x != null) {
      let bd = Infinity;
      for (let k = 0; k < leg.poly.length - 1; k++) {
        const a = leg.poly[k], b = leg.poly[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-12;
        const f = vdClamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1), d = Math.hypot(a[0] + dx * f - x, a[1] + dz * f - z);
        if (d < bd) { bd = d; j = k; }
      }
      j = Math.max(0, j - 1);
      leg.poly = leg.poly.slice(j); j = 0;
    }
    const out = [leg.poly[j]];
    let s = 0, k = j + 1;
    for (; k < leg.poly.length; k++) {
      const a = leg.poly[k - 1], b = leg.poly[k]; s += Math.hypot(b[0] - a[0], b[1] - a[1]);
      out.push(b); if (s > VD_WIN) break;
    }
    const last = k >= leg.poly.length - 1;
    D.stats.windows++;
    return vehPath(out, { stop: last && leg.stop, r: leg.r, w: leg.w, rFloor: 1.15 * def.rMin, dir: 1 });
  }
  // the narrowest road on a route (the corners' fillets are cut to it)
  function legW(nodes) {
    let w = Infinity;
    for (let k = 1; k < nodes.length; k++) for (const e of G.nodes[nodes[k]].adj) { const E = G.edges[e]; if (E.a === nodes[k - 1] || E.b === nodes[k - 1]) w = Math.min(w, E.w); }
    if (!isFinite(w)) { const p = pose(), L = vehGraphLocate(G, p.x, p.z, p.hdg); w = G.edges[L.e].w; }
    return w;
  }
  function startLeg(leg) {
    D.leg = leg; D.path = windowPath(leg); D.i = 0; D.phase = 'DRIVE'; D.Sx = {};
  }
  function plan(to, why) {
    const R = route(to);
    if (!R) { say('no-route', 'no road to ' + to); D.phase = 'IDLE'; return 'none'; }
    if (R.kind === 'drive') {
      const P = G.places[to];
      startLeg({ poly: legPoly(R.nodes.slice(0, -1), [P.x, P.z]), stop: true, then: 'arrive', w: legW(R.nodes) });
      say('route', (why || 'route') + ': ' + Math.round(R.cost) + ' m to ' + to);
      return 'replan';
    }
    const U = uturnAt(R.apron, R.came);
    if (!U) { say('no-uturn', 'no U-turn fits at ' + R.apron); D.phase = 'IDLE'; return 'none'; }
    const s0 = vehSiteToWorld(U.site, U.plan.start, 0, 0);
    D.man = { site: U.site, plan: U.plan, apron: R.apron };
    const atStart = Math.hypot(s0.x - pose().x, s0.z - pose().z) < 1.0 && Math.abs(car.out.u) < 0.3;
    say('route', (why || 'route') + ': a U-turn (' + U.plan.family + ', margin ' + U.plan.margin + ' m) at ' + R.apron + ', then ' + to);
    if (atStart) beginManoeuvre();
    else startLeg({ poly: legPoly(R.nodes.filter(n => n !== G.places[R.apron].node), [s0.x, s0.z]), stop: true, then: 'manoeuvre', w: legW(R.nodes) });
    return 'uturn';
  }
  function beginManoeuvre() {
    const U = D.man, s0 = vehSiteToWorld(U.site, U.plan.start, 0, 0);
    // planned from where the vehicle actually stopped, on the site's frame (its small error is the follower's)
    const M = vehManoeuvrePaths({ x: s0.x, z: s0.z, hdg: s0.hdg }, U.plan.prims);
    U.paths = M.paths; D.manI = 0; D.phase = 'MANOEUVRE'; D.wait = 0; D.path = U.paths[0]; D.i = 0; D.Sx = {};
    D.stats.uturns++;
    say('uturn', U.plan.family + ' at ' + U.apron + ': ' + U.paths.length + ' moves, ' + U.plan.len.toFixed(1) + ' m');
  }
  // setDest: the flight's To, on the road. 'replan' / 'uturn' (the new To is behind: re-routed via an apron),
  // 'queued' (a manoeuvre runs: planned when it ends), 'same', 'none'
  D.setDest = (to) => {
    if (!G.places[to]) return 'none';
    if (to === D.to && D.phase !== 'ARRIVED' && D.phase !== 'IDLE') return 'same';
    D.to = to;
    if (D.phase === 'MANOEUVRE') { D.queued = to; say('new-destination', to + ' - after the manoeuvre'); return 'queued'; }
    say('new-destination', 'the destination is now ' + to);
    return plan(to, D.phase === 'DRIVE' ? 're-planned from here' : 'route');
  };
  // one control step (call before car.step(dt))
  D.step = (dt) => {
    const c = car.ctl;
    if (D.phase === 'IDLE' || D.phase === 'ARRIVED' || D.phase === 'STUCK') { c.thr = 0; c.brake = 1; return; }
    const p = pose(), path = D.path, dir = path.dir, u = car.out.u, uT = dir * u;
    const loc = vehLocate(path, D.i, p.x, p.z);
    D.i = loc.i;
    const psiT = dir > 0 ? p.hdg : vdWrap(p.hdg + Math.PI);
    const man = D.phase === 'MANOEUVRE', T = man ? Object.assign({}, tune, manT) : tune;
    // the measured errors (the gate's)
    if (!man) { const a = Math.abs(loc.ey); D.stats.xtMax = Math.max(D.stats.xtMax, a); D.stats.xtSq += a * a; D.stats.xtN++; }
    else D.stats.manXt = Math.max(D.stats.manXt, Math.abs(loc.ey));
    // a manoeuvre's move begins at rest, in its gear, the wheels steered to its first arc (dry steering)
    if (man && D.wait >= 0) {
      const k0 = path.pts[0].kap, d0 = Math.atan(dir > 0 ? def.wb * k0 : -def.wb * k0);
      c.gear = dir; c.thr = 0; c.brake = 1; c.steer = vdClamp(d0 / def.steer.dMax, -1, 1);
      D.wait += dt;
      if (Math.abs(car.out.delta - d0) < 0.03 && Math.abs(u) < 0.05 && D.wait > 0.3) D.wait = -1;
      return;
    }
    c.gear = dir;
    const d = vehSteer(def, path, loc, Math.max(0, uT), psiT, T);
    c.steer = vdClamp(d / def.steer.dMax, -1, 1);
    if (!man) vehProfile(path, car.world);
    const sp = vehSpeedTarget(path, loc, Math.max(0, uT), T);
    const ped = vehPedals(car, dir, uT, sp.v, D.Sx, dt, T, sp.a);
    c.thr = ped.thr; c.brake = ped.brake;
    // the window runs out and the leg goes on: re-sample it from here
    if (!man && path.sStop == null && loc.sRem < VD_WIN_REPLAN) {
      D.path = windowPath(D.leg, p.x, p.z); D.i = vehLocate(D.path, 0, p.x, p.z, true).i;
      return;
    }
    // OFF THE ROAD (pushed off, a re-route's join gone wide): planned again from here, the flight's planFromHere
    if (!man && Math.abs(loc.ey) > 5 && car.st.t - (D.rejoinT ?? -1e9) > 5) {
      D.rejoinT = car.st.t; say('rejoin', Math.abs(loc.ey).toFixed(1) + ' m off the road - re-planned from here');
      plan(D.to, 'rejoin'); return;
    }
    // STUCK: the pedals down, nothing moving
    D.stuckT = (c.thr > 0.5 && Math.abs(u) < 0.3) ? (D.stuckT || 0) + dt : 0;
    if (D.stuckT > 20) { say('stuck', 'not moving for 20 s on the throttle'); D.phase = 'STUCK'; c.thr = 0; c.brake = 1; return; }
    // the end of a path that stops: stopped on it
    if (path.sStop != null && loc.sRem < 0.35 && Math.abs(u) < 0.08) {
      if (man) {
        D.manI++;
        if (D.manI < D.man.paths.length) { D.path = D.man.paths[D.manI]; D.i = 0; D.wait = 0; D.Sx = {}; return; }
        say('uturn-done', 'facing back at ' + D.man.apron);
        const q = D.queued || D.to; D.queued = null; D.man = null;
        plan(q, 'after the U-turn');
        return;
      }
      if (D.leg.then === 'manoeuvre') { beginManoeuvre(); return; }
      D.phase = 'ARRIVED'; c.thr = 0; c.brake = 1;
      say('arrived', 'at ' + D.to);
    }
  };
  return D;
}

if (typeof module !== 'undefined') module.exports = {
  VD_DS, VD_WIN, vehPath, vehManoeuvrePaths, vehLocate, vehKapAt, vehSteer, vehProfile, vehSpeedTarget, vehPedals,
  vehUturnPlan, vehSiteToWorld, vehRoadGraph, vehDijkstra, vehGraphLocate, makeDriver,
};
