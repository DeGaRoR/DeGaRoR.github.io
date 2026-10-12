// ============================================================
// THE GROUND VEHICLE (G2940 GROUND-VEHICLE, 2026-10-11) — the physics spike for
// driveable vehicles. Node only: no THREE, no DOM, and NOT in the bundle yet
// (tools/build.js MANIFEST.core does not list it, so the aeroplane's core, its
// hash and every page are untouched; the integration lands it as 45_vehicle.js).
//
// The user (11 Oct): "a long drive on the road I have traced and back, the
// ability to set a new destination (like the autopilot's in-flight re-routing),
// chase view, single vehicle, acceptable physics, NO manual take-over, the
// ability to U-turn properly for manoeuvres. A solid base for ground vehicles.
// All of this will be applied to BOATS at some point."
//
// WHY NOT THE AEROPLANE'S SOLVER (makeSim). Its ground pass is the gear of an
// aeroplane: wheels roll freely on `refs.mains` and one `refs.tw`, the ONLY
// steering is the tailwheel's (`twSteer * ctl.dr`), the brakes are on the mains,
// and the only propulsion is the propeller - no wheel is ever driven, nothing
// steers at the front, there is no reverse and no suspension travel (a tyre is
// a penalty spring under a node). Bending that pass for a car means `if car`
// checks through the hottest loop the fleet's anchored gates fly, so the car is
// a SHELL OF ITS OWN beside it: one rigid chassis (the limit of a stiff cluster:
// six degrees of freedom, no beams), and CONTACT and PROPULSION PROVIDERS that
// put forces on it. Wheels are the first contact provider and the driven wheels
// the first propulsion; a boat brings a HULL (the water's buoyancy and drag,
// world.waterH) and a THRUST (a propeller at a point, a rudder) through the same
// two seams - futureDesigns/GROUND-VEHICLE-2026-10.md §2.
//
// THE MODEL, one substep (1/240 s):
//   1. every wheel casts its strut down the chassis' -up axis onto the terrain's
//      PLANE under it (terrainH + its normal by finite differences): the
//      compression gives the spring + damper load Fn, pushed along the terrain
//      normal at the contact point - so a slope is felt through the normal, and
//      the tyre's frame (rolling direction, side) lies in the ground's plane;
//   2. the explicit forces: gravity, the air (CdA), the springs, the body
//      proxy's penalty contacts (the data sheet's two boxes: an overturned or
//      bottomed car scrapes, it does not sink), and the DRIVE: a power curve
//      (forward: min(F0, P / v); reverse: a geared ramp to vRev) shared over the
//      DRIVEN wheels that touch the ground, each share capped by traction
//      (tc x mu x Fn) - an airborne driven wheel delivers nothing;
//   3. the velocities step, then the TYRES as sequential impulses (Catto's
//      velocity-level contacts, iterated): along the wheel, rolling resistance
//      and the brake as a friction capped at (crr Fn + brake) - so a braked car
//      HOLDS on a grade instead of creeping; across it, a SOFT constraint whose
//      compliance is |v| / (C_alpha Fn): at speed it is the linear tyre
//      (F = C_alpha Fn alpha), parked it is a rigid no-slip; both inside the
//      friction ellipse mu Fn with the drive (the brake is ABS-capped below
//      mu Fn, so a braking car still steers - mild understeer at the limit);
//   4. the position and the orientation (a quaternion) step.
// Ackermann steering: the driver asks a BICYCLE angle (the rear axle's centre
// turns on R = wb / tan delta); each steered wheel takes its own angle round
// that centre (full Ackermann at `ackermann` 1). The steering slews at `rate`.
//
// FRAMES. World: x, y up, z (the aeroplane's). The chassis: +x forward, y up,
// +z right - the data sheet's frame (src/cars/car_<key>.json, tools/car_prep.py)
// - so a heading hdg = atan2(fwd.z, fwd.x) turns toward +z when it grows: a
// positive steer is a turn to the RIGHT, a positive path curvature (39_ground_
// path.js's `kap`, "toward increasing atan2") is the same turn.
// ============================================================

const VEH_G = 9.81;
const VEH_RHO = 1.225;
const VEH_DT = 1 / 240;
// THE SURFACE, for a TYRE (the aeroplane's GROUND_SURF rows are a light aircraft's tyres on grass - crr 0.05 on
// the calibration lawn - and are not a car's): [mu peak, crr], keyed by the world's SURFACE enum (20_world.js:
// GRASS 0, ROCK 1, SCREE 2, FOREST_FLOOR 3, WATER 4, PAVED 5, GRAVEL 6, SAND 7). A world without `surface` is
// PAVED; off every class (-1) reads GRASS. The world's road network is graded and classed GRAVEL today (23_).
const VEH_SURF = {
  0: [0.55, 0.035], 1: [0.75, 0.020], 2: [0.45, 0.050], 3: [0.50, 0.040],
  4: [0.10, 0.200], 5: [0.90, 0.013], 6: [0.65, 0.020], 7: [0.45, 0.060],
};
const VEH_SURF_NONE = VEH_SURF[5];

// THE TUNES: what the data sheet does not measure - the powertrain, the brakes, the springs, the tyres, the air.
// The sheet is GEOMETRY + MASS (measured by tools/car_prep.py off the asset; a re-run overwrites it), the tune is
// authored here, so a re-bake never loses a tuning. Wheel lists name the sheet's wheel keys.
const VEH_TUNES = {
  // the Conquer '89: a 1989 full-size regular-cab pickup, rear-wheel drive, a V8 (~150 kW at the crank, ~80 kW
  // at the wheels through an automatic), open-ish rear differential, front discs / rear drums
  conquer: {
    drive: { wheels: ['RL', 'RR'], P: 80e3, F0: 7200, Frev: 6200, vRev: 8.0, engBrake: 420, tc: 0.85 },
    brake: { F: 16500, front: 0.64, abs: 0.85, hand: ['RL', 'RR'], handF: 4200 },
    steer: { wheels: ['FL', 'FR'], innerDeg: 35, ackermann: 1.0, rate: 0.75 },
    susp: { bump: 0.09, droop: 0.12, hz: [1.35, 1.55], zeta: 0.38, kStop: 250e3 },
    tyre: { Ca: 11.0, u0: 1.5 },
    aero: { CdA: 1.25 },
  },
};

// ---- small vector helpers (plain arrays; the shell is not a hot loop of the fleet's) ----
const vDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vLen = a => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const vNorm = a => { const l = vLen(a) || 1e-12; return [a[0] / l, a[1] / l, a[2] / l]; };
function qToR(q) {   // body -> world, columns = the chassis' axes in the world (fwd, up, right)
  const [w, x, y, z] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
          2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
          2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}
const mulRv = (R, b) => [R[0] * b[0] + R[1] * b[1] + R[2] * b[2], R[3] * b[0] + R[4] * b[1] + R[5] * b[2], R[6] * b[0] + R[7] * b[1] + R[8] * b[2]];
function rToQ(R) {   // a rotation matrix (row-major) -> quaternion [w, x, y, z]
  const t = R[0] + R[4] + R[8];
  let w, x, y, z;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = s / 4; x = (R[7] - R[5]) / s; y = (R[2] - R[6]) / s; z = (R[3] - R[1]) / s; }
  else if (R[0] > R[4] && R[0] > R[8]) { const s = Math.sqrt(1 + R[0] - R[4] - R[8]) * 2; w = (R[7] - R[5]) / s; x = s / 4; y = (R[1] + R[3]) / s; z = (R[2] + R[6]) / s; }
  else if (R[4] > R[8]) { const s = Math.sqrt(1 + R[4] - R[0] - R[8]) * 2; w = (R[2] - R[6]) / s; x = (R[1] + R[3]) / s; y = s / 4; z = (R[5] + R[7]) / s; }
  else { const s = Math.sqrt(1 + R[8] - R[0] - R[4]) * 2; w = (R[3] - R[1]) / s; x = (R[2] + R[6]) / s; y = (R[5] + R[7]) / s; z = s / 4; }
  const l = Math.hypot(w, x, y, z); return [w / l, x / l, y / l, z / l];
}
const vehWrapPi = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };

// ---- THE DEFINITION: a data sheet (+ a tune) -> the generic vehicle the shell runs ----
// def = { kind: 'ground', key, mass, I [roll about fwd, yaw about up, pitch about right], cg (body),
//         wheels: [{ id, at (centre, static, body), r, width, steer, drive, brake, hand, k, c, bump, droop, sFree }],
//         drive, brake, steer: { dMax (bicycle rad), rate, ackermann, xRef (the unsteered axle's x) },
//         tyre, aero, proxy: [[x, y, z] body points], wb, track, rMin, foot: { front, rear, half } }
// `contacts` and `propulsion` name the providers: today 'wheels' + 'proxy' and 'wheels'; a boat: 'hull', 'thrust'.
function vehicleDef(sheet, tune) {
  tune = tune || VEH_TUNES[sheet.car];
  if (!tune) throw new Error('vehicleDef: no tune for ' + sheet.car);
  const E = sheet.estimates || {};
  const mass = E.mass_kg, cg = E.cg.slice(), I = E.inertia_kgm2.slice();
  const keys = Object.keys(sheet.wheels);
  const W = keys.map(id => Object.assign({ id }, sheet.wheels[id]));
  const steerSet = new Set(tune.steer.wheels), driveSet = new Set(tune.drive.wheels), handSet = new Set(tune.brake.hand || []);
  // the unsteered axle: its x is the reference of the bicycle geometry (the rear axle of a front-steered car)
  const un = W.filter(w => !steerSet.has(w.id)), st = W.filter(w => steerSet.has(w.id));
  const xRef = un.reduce((s, w) => s + w.centre[0], 0) / Math.max(1, un.length);
  const xSt = st.reduce((s, w) => s + w.centre[0], 0) / Math.max(1, st.length);
  const wb = Math.abs(xSt - xRef);
  // the static load per wheel: the axles share the weight by the CG's x, each wheel half of its axle
  const fFront = (cg[0] - xRef) / (xSt - xRef);
  const S = tune.susp, nFr = st.length || 1, nRe = un.length || 1;
  const wheels = W.map(w => {
    const front = steerSet.has(w.id);
    const Wst = mass * VEH_G * (front ? fFront / nFr : (1 - fFront) / nRe);
    const hz = front ? S.hz[0] : S.hz[1];
    const mc = Wst / VEH_G, k = mc * Math.pow(2 * Math.PI * hz, 2), c = 2 * S.zeta * Math.sqrt(k * mc);
    return {
      id: w.id, at: w.centre.slice(), r: w.radius, width: w.width,
      steer: front ? 1 : 0, drive: driveSet.has(w.id) ? 1 / driveSet.size : 0,
      brake: front ? tune.brake.front / nFr : (1 - tune.brake.front) / nRe, hand: handSet.has(w.id),
      k, c, bump: S.bump, droop: S.droop, sFree: S.bump + Wst / k, Wst,
    };
  });
  // the bicycle angle at the steered wheels' inner lock: tan(inner) = wb t / (wb - h t), h the half track
  const half = Math.max(...st.map(w => Math.abs(w.centre[2]))) || 0.7;
  const ti = Math.tan(tune.steer.innerDeg * Math.PI / 180), t = wb * ti / (wb + half * ti);
  const dMax = Math.atan(t);
  // the body proxy: the collision boxes' eight corners each (the wheels are the wheels)
  const proxy = [];
  for (const b of (sheet.collision && sheet.collision.boxes) || [])
    for (const x of [b.lo[0], b.hi[0]]) for (const y of [b.lo[1], b.hi[1]]) for (const z of [b.lo[2], b.hi[2]]) proxy.push([x, y, z]);
  const box = sheet.box || { lo: [-2.5, 0, -0.9], hi: [2.5, 1.8, 0.9] };
  const halfW = Math.max(0.5, ...((sheet.collision && sheet.collision.boxes) || []).map(b => Math.max(-b.lo[2], b.hi[2])));
  return {
    kind: 'ground', key: sheet.car, mass, I, cg, wheels,
    contacts: ['wheels', 'proxy'], propulsion: 'wheels',
    drive: Object.assign({}, tune.drive), brake: Object.assign({}, tune.brake),
    steer: { dMax, rate: tune.steer.rate, ackermann: tune.steer.ackermann, xRef, xSt },
    tyre: Object.assign({}, tune.tyre), aero: Object.assign({}, tune.aero), susp: Object.assign({}, S),
    proxy, wb, track: (sheet.track && sheet.track.front) || 2 * half, half,
    rMin: wb / Math.tan(dMax),
    // the footprint from the rear axle's centre (the point the driver plans and steers): forward to the front
    // bumper, back to the rear one, half the body's width
    foot: { front: box.hi[0] - xRef, rear: xRef - box.lo[0], half: halfW },
    ground: sheet.ground || 0,
  };
}

// ---- THE SHELL ----
function makeVehicle(def, world, opts) {
  opts = opts || {};
  const m = def.mass, Ib = def.I, cgB = def.cg;
  const H = (world && world.terrainH) ? world.terrainH : () => 0;
  const surfOf = (world && typeof world.surface === 'function')
    ? (x, z) => VEH_SURF[world.surface(x, z)] || VEH_SURF[0] : () => VEH_SURF_NONE;
  const NE = 0.35;                                // the terrain normal's finite-difference step, m
  const ITER = 8;
  const st = { x: [0, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0], t: 0 };
  const ctl = { thr: 0, brake: 0, steer: 0, gear: 1, hand: 0 };   // steer: -1..1 of the bicycle's dMax, + right
  const wh = def.wheels.map(w => ({ s: w.bump, delta: 0, spin: 0, on: false, Fn: 0, Fd: 0, lamL: 0, lamT: 0, vl: 0, slipT: 0 }));
  let delta = 0;                                  // the bicycle angle actually at the wheels (slewed)
  const out = { u: 0, V: 0, hdg: 0, onGround: 0, Fdrive: 0, aLong: 0, aLat: 0, proxyHit: false };
  // body point (chassis frame) -> world, and its offset from the CG in the world
  const rel = (R, pb) => mulRv(R, [pb[0] - cgB[0], pb[1] - cgB[1], pb[2] - cgB[2]]);
  function normalAt(x, z, h0) {
    const hx = H(x + NE, z), hz = H(x, z + NE);
    return vNorm([-(hx - h0) / NE, 1, -(hz - h0) / NE]);
  }
  function invIw(R) {   // R diag(1/I) R^T
    const a = 1 / Ib[0], b = 1 / Ib[1], c = 1 / Ib[2], M = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      M[i * 3 + j] = R[i * 3] * a * R[j * 3] + R[i * 3 + 1] * b * R[j * 3 + 1] + R[i * 3 + 2] * c * R[j * 3 + 2];
    return M;
  }
  function Iw(R) {
    const M = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      M[i * 3 + j] = R[i * 3] * Ib[0] * R[j * 3] + R[i * 3 + 1] * Ib[1] * R[j * 3 + 1] + R[i * 3 + 2] * Ib[2] * R[j * 3 + 2];
    return M;
  }
  // the effective mass of the chassis for an impulse along u at r
  const mEff = (Ii, r, u) => { const rc = vCross(r, u), a = mulRv(Ii, rc); return 1 / (1 / m + vDot(vCross(a, r), u)); };
  function applyImp(Ii, r, J) {
    st.v[0] += J[0] / m; st.v[1] += J[1] / m; st.v[2] += J[2] / m;
    const dw = mulRv(Ii, vCross(r, J)); st.w[0] += dw[0]; st.w[1] += dw[1]; st.w[2] += dw[2];
  }
  const ptVel = r => { const c = vCross(st.w, r); return [st.v[0] + c[0], st.v[1] + c[1], st.v[2] + c[2]]; };

  // each steered wheel's own angle round the bicycle's turning centre (Ackermann)
  function wheelDelta(w, d) {
    if (!w.steer || Math.abs(d) < 1e-9) return 0;
    const t = Math.tan(d), dx = w.at[0] - def.steer.xRef;
    const full = Math.atan2(dx * t, def.wb - w.at[2] * t);
    const dd = full > Math.PI / 2 ? full - Math.PI : full < -Math.PI / 2 ? full + Math.PI : full;
    return d + def.steer.ackermann * (dd - d);
  }
  // THE DRIVE FORCE at the wheels, signed along the chassis' forward axis, from the gear, the throttle and the
  // speed: forward a power curve (traction-geared F0 up to P / v), reverse a geared ramp that fades to 0 at vRev;
  // the engine's drag with the throttle closed, in gear (never a hold: it fades out below 2 m/s)
  function driveForce(u) {
    const D = def.drive, thr = Math.max(0, Math.min(1, ctl.thr));
    let F = 0;
    if (ctl.gear > 0) {
      F = thr * Math.min(D.F0, D.P / Math.max(0.5, u));
      if (u > 0) F -= (1 - thr) * D.engBrake * Math.min(1, u / 2);
    } else if (ctl.gear < 0) {
      const ub = -u;
      F = -thr * D.Frev * Math.max(0, Math.min(1, 1 - ub / D.vRev));
      if (ub > 0) F += (1 - thr) * D.engBrake * Math.min(1, ub / 2);
    }
    return F;
  }

  const C = def.wheels.map(() => ({}));            // per wheel contact scratch
  function substep(dt) {
    const R = qToR(st.q), Ii = invIw(R);
    const ex = [R[0], R[3], R[6]], ey = [R[1], R[4], R[7]], ez = [R[2], R[5], R[8]];
    const F = [0, -m * VEH_G, 0], T = [0, 0, 0];
    const addF = (r, f) => { F[0] += f[0]; F[1] += f[1]; F[2] += f[2]; const t = vCross(r, f); T[0] += t[0]; T[1] += t[1]; T[2] += t[2]; };
    // the air
    const V = vLen(st.v);
    if (V > 0.01 && def.aero.CdA > 0) { const k = -0.5 * VEH_RHO * def.aero.CdA * V; F[0] += k * st.v[0]; F[1] += k * st.v[1]; F[2] += k * st.v[2]; }
    // the steering slews toward the asked bicycle angle
    const dT = Math.max(-1, Math.min(1, ctl.steer)) * def.steer.dMax, dStep = def.steer.rate * dt;
    delta += Math.max(-dStep, Math.min(dStep, dT - delta));
    const u = vDot(st.v, ex);
    const Fdrv = driveForce(u);
    // PROVIDER 'wheels': the struts, the loads, the tyres' frames; the drive's share through each contacted wheel
    let nOn = 0, driveOn = 0;
    for (let i = 0; i < def.wheels.length; i++) {
      const w = def.wheels[i], S = wh[i], c = C[i];
      c.on = false; S.on = false; S.Fn = 0; S.Fd = 0;
      S.delta = wheelDelta(w, delta);
      const hpB = [w.at[0], w.at[1] + w.bump, w.at[2]];
      const rhp = rel(R, hpB), hp = [st.x[0] + rhp[0], st.x[1] + rhp[1], st.x[2] + rhp[2]];
      const Lmax = w.bump + w.droop;
      const cx = hp[0] - ey[0] * S.s, cz = hp[2] - ey[2] * S.s;
      const gy = H(cx, cz), n = normalAt(cx, cz, gy);
      const dn = -vDot(ey, n);                     // the strut's direction (-up) on the normal: < 0
      if (dn > -0.3) { S.s = Lmax; continue; }
      let s = (w.r - ((hp[0] - cx) * n[0] + (hp[1] - gy) * n[1] + (hp[2] - cz) * n[2])) / dn;
      if (s >= Lmax) { S.s = Lmax; continue; }      // hanging: the wheel is in the air
      let bottom = 0; if (s < 0) { bottom = -s; s = 0; }
      const vhp = ptVel(rhp), sdot = vDot(vhp, n) / (-dn);
      let Fs = w.k * (w.sFree - s) - w.c * sdot + def.susp.kStop * bottom;
      if (Fs < 0) Fs = 0;
      S.s = s;
      if (Fs <= 0) continue;
      const cp = [hp[0] - ey[0] * s - n[0] * w.r, hp[1] - ey[1] * s - n[1] * w.r, hp[2] - ey[2] * s - n[2] * w.r];
      const r = [cp[0] - st.x[0], cp[1] - st.x[1], cp[2] - st.x[2]];
      addF(r, [n[0] * Fs, n[1] * Fs, n[2] * Fs]);
      const cs = Math.cos(S.delta), sn = Math.sin(S.delta);
      const fw = [ex[0] * cs + ez[0] * sn, ex[1] * cs + ez[1] * sn, ex[2] * cs + ez[2] * sn];
      const fn = vDot(fw, n);
      const ft = vNorm([fw[0] - fn * n[0], fw[1] - fn * n[1], fw[2] - fn * n[2]]);
      const lt = vCross(ft, n);                    // the tyre's right, in the ground's plane
      const [mu, crr] = surfOf(cp[0], cp[2]);
      c.on = true; c.r = r; c.n = n; c.ft = ft; c.lt = lt; c.Fn = Fs; c.mu = mu; c.crr = crr;
      c.mL = mEff(Ii, r, ft); c.mT = mEff(Ii, r, lt); c.lamL = 0; c.lamT = 0;
      S.on = true; S.Fn = Fs; nOn++;
      // THE DRIVE: only a driven wheel ON THE GROUND carries its share, capped by its traction
      let Fd = 0;
      if (w.drive > 0) { const cap = def.drive.tc * mu * Fs; Fd = Math.max(-cap, Math.min(cap, Fdrv * w.drive)); driveOn++; }
      c.Fd = Fd; S.Fd = Fd;
      if (Fd) addF(r, [ft[0] * Fd, ft[1] * Fd, ft[2] * Fd]);
      // the brake this wheel can take (pedal, + the hand brake on its wheels), ABS-capped under the friction
      let B = Math.max(0, Math.min(1, ctl.brake)) * def.brake.F * w.brake + (w.hand ? Math.max(0, Math.min(1, ctl.hand)) * def.brake.handF / 2 : 0);
      B = Math.min(B, def.brake.abs * mu * Fs);
      c.capL = (crr * Fs + B) * dt;
    }
    // PROVIDER 'proxy': the body's boxes on the ground (an overturn, a ditch, a kerb the wheels cannot climb)
    out.proxyHit = false;
    const nP = def.proxy.length;
    for (let k = 0; k < nP; k++) {
      const rp = rel(R, def.proxy[k]), px = st.x[0] + rp[0], py = st.x[1] + rp[1], pz = st.x[2] + rp[2];
      const gy = H(px, pz), pen = gy - py;
      if (pen <= 0) continue;
      out.proxyHit = true;
      const vp = ptVel(rp);
      let Fn = 3e5 * pen - 2e4 * vp[1]; if (Fn < 0) Fn = 0;
      const sp = Math.hypot(vp[0], vp[2]);
      const kf = sp > 1e-6 ? Math.min(0.5 * Fn / sp, m / dt / nP) : 0;
      addF(rp, [-kf * vp[0], Fn, -kf * vp[2]]);
    }
    // the velocities step on the explicit forces (the gyroscopic term included)
    const Iwv = mulRv(Iw(R), st.w), gyr = vCross(st.w, Iwv);
    st.v[0] += F[0] / m * dt; st.v[1] += F[1] / m * dt; st.v[2] += F[2] / m * dt;
    const dw = mulRv(Ii, [T[0] - gyr[0], T[1] - gyr[1], T[2] - gyr[2]]);
    st.w[0] += dw[0] * dt; st.w[1] += dw[1] * dt; st.w[2] += dw[2] * dt;
    // THE TYRES: sequential impulses on the stepped velocities
    const Ca = def.tyre.Ca, u0 = def.tyre.u0;
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < C.length; i++) {
        const c = C[i]; if (!c.on) continue;
        let vc = ptVel(c.r);
        // along the wheel: rolling resistance + the brake, a capped friction (holds a parked car)
        const vl = vDot(vc, c.ft);
        let L = c.lamL - vl * c.mL;
        L = Math.max(-c.capL, Math.min(c.capL, L));
        let dL = L - c.lamL; c.lamL = L;
        if (dL) applyImp(Ii, c.r, [c.ft[0] * dL, c.ft[1] * dL, c.ft[2] * dL]);
        // across it: the soft (compliant) side force, the linear tyre at speed, a no-slip parked
        vc = ptVel(c.r);
        const vt = vDot(vc, c.lt), vlong = Math.abs(vDot(vc, c.ft));
        const gam = Math.max(vlong, u0) / (Ca * c.Fn * dt);
        let Tn = c.lamT - (vt + gam * c.lamT) / (1 / c.mT + gam);
        // the friction ellipse: what the wheel's grip leaves after the drive and the brake
        const lon = c.lamL + c.Fd * dt, cap2 = Math.pow(c.mu * c.Fn * dt, 2) - lon * lon;
        const capT = cap2 > 0 ? Math.sqrt(cap2) : 0;
        Tn = Math.max(-capT, Math.min(capT, Tn));
        const dT2 = Tn - c.lamT; c.lamT = Tn;
        if (dT2) applyImp(Ii, c.r, [c.lt[0] * dT2, c.lt[1] * dT2, c.lt[2] * dT2]);
      }
    }
    // the pose steps
    st.x[0] += st.v[0] * dt; st.x[1] += st.v[1] * dt; st.x[2] += st.v[2] * dt;
    const [qw, qx, qy, qz] = st.q, [wx, wy, wz] = st.w, h = 0.5 * dt;
    const q2 = [qw + h * (-wx * qx - wy * qy - wz * qz), qx + h * (wx * qw + wy * qz - wz * qy),
                qy + h * (wy * qw + wz * qx - wx * qz), qz + h * (wz * qw + wx * qy - wy * qx)];
    const ql = Math.hypot(q2[0], q2[1], q2[2], q2[3]); st.q = [q2[0] / ql, q2[1] / ql, q2[2] / ql, q2[3] / ql];
    // the wheels' spin (the renderer's), the outputs
    for (let i = 0; i < wh.length; i++) {
      const c = C[i], S = wh[i];
      S.lamL = c.on ? c.lamL / dt : 0; S.lamT = c.on ? c.lamT / dt : 0;
      if (c.on) { const vc = ptVel(c.r); S.vl = vDot(vc, c.ft); S.slipT = Math.atan2(vDot(vc, c.lt), Math.max(0.1, Math.abs(S.vl))); }
      S.spin += (S.vl / def.wheels[i].r) * dt;
    }
    out.onGround = nOn; out.driveOn = driveOn; out.Fdrive = wh.reduce((s, S) => s + S.Fd, 0);
    st.t += dt;
  }
  function step(dtFrame) {
    const n = Math.max(1, Math.ceil(dtFrame / VEH_DT - 1e-9)), dt = dtFrame / n;
    const v0 = st.v.slice();
    for (let i = 0; i < n; i++) substep(dt);
    const R = qToR(st.q), ex = [R[0], R[3], R[6]], ez = [R[2], R[5], R[8]];
    const a = [(st.v[0] - v0[0]) / dtFrame, (st.v[1] - v0[1]) / dtFrame, (st.v[2] - v0[2]) / dtFrame];
    out.u = vDot(st.v, ex); out.V = vLen(st.v); out.hdg = Math.atan2(ex[2], ex[0]);
    out.aLong = vDot(a, ex); out.aLat = vDot(a, ez);
    out.delta = delta;
  }
  // stand the vehicle at (x, z) heading `hdg` (atan2(z, x) of its nose), on the terrain's plane under its wheels,
  // the springs at their static length (so it settles in a few tenths of a second, not from a drop)
  function place(x, z, hdg) {
    const fx = Math.cos(hdg), fz = Math.sin(hdg);
    // the ground's plane over the wheelbase and the track
    const L = def.wb / 2 + 0.3, Wd = def.track / 2 + 0.2;
    const hF = H(x + fx * L, z + fz * L), hB = H(x - fx * L, z - fz * L);
    const hR = H(x - fz * Wd, z + fx * Wd), hL = H(x + fz * Wd, z - fx * Wd);
    const fwd0 = vNorm([fx * 2 * L, hF - hB, fz * 2 * L]);
    const rt0 = vNorm([-fz * 2 * Wd, hR - hL, fx * 2 * Wd]);
    const up = vNorm(vCross(rt0, fwd0));
    const fwd = vNorm(vCross(up, rt0)), rt = vCross(fwd, up);
    const R = [fwd[0], up[0], rt[0], fwd[1], up[1], rt[1], fwd[2], up[2], rt[2]];
    st.q = rToQ(R);
    // the body frame's origin on the ground plane (the sheet's `ground` is the y the tyres stand on)
    const g0 = (hF + hB + hR + hL) / 4;
    const o = [x - up[0] * def.ground, g0 - up[1] * def.ground, z - up[2] * def.ground];
    const rc = mulRv(R, cgB);
    st.x = [o[0] + rc[0], o[1] + rc[1], o[2] + rc[2]];
    st.v = [0, 0, 0]; st.w = [0, 0, 0];
    for (let i = 0; i < wh.length; i++) { wh[i].s = def.wheels[i].bump; wh[i].spin = 0; }
    delta = 0;
    step(1 / 240);
  }
  // body point (chassis frame) -> world
  function toWorld(pb) { const R = qToR(st.q), r = rel(R, pb); return [st.x[0] + r[0], st.x[1] + r[1], st.x[2] + r[2]]; }
  // THE POINT THE DRIVER STEERS: the unsteered axle's centre on the ground's plane (its path's curvature is
  // tan(delta) / wb, forward and in reverse alike)
  function refPoint() { return toWorld([def.steer.xRef, def.ground, 0]); }
  function axes() { const R = qToR(st.q); return { fwd: [R[0], R[3], R[6]], up: [R[1], R[4], R[7]], right: [R[2], R[5], R[8]] }; }
  // the body's footprint corners on the ground, from the reference point (the corridor checks')
  function footprint() {
    const P = refPoint(), A = axes(), F = def.foot, out_ = [];
    const fx = A.fwd[0], fz = A.fwd[2], fl = Math.hypot(fx, fz) || 1, ux = fx / fl, uz = fz / fl;
    for (const [a, b] of [[F.front, -F.half], [F.front, F.half], [-F.rear, F.half], [-F.rear, -F.half]])
      out_.push([P[0] + ux * a - uz * b, P[2] + uz * a + ux * b]);
    return out_;
  }
  function snap() { return JSON.parse(JSON.stringify({ st, ctl, wh, delta })); }
  function unsnap(S) { Object.assign(st, JSON.parse(JSON.stringify(S.st))); Object.assign(ctl, S.ctl); S.wh.forEach((w, i) => Object.assign(wh[i], w)); delta = S.delta; }
  return { def, world, st, ctl, out, wheels: wh, step, place, toWorld, refPoint, axes, footprint, snap, unsnap,
           heading: () => { const A = axes(); return Math.atan2(A.fwd[2], A.fwd[0]); },
           speed: () => vDot(st.v, axes().fwd), wheelDelta: d => def.wheels.map(w => wheelDelta(w, d)) };
}

if (typeof module !== 'undefined') module.exports = { VEH_SURF, VEH_TUNES, VEH_DT, vehicleDef, makeVehicle, vehWrapPi, qToR, rToQ };
