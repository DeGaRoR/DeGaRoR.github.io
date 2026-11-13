// ============================================================
// THE GROUND VEHICLE (G2940 GROUND-VEHICLE, 2026-10-11) — the physics spike for
// driveable vehicles. Pure: no THREE, no DOM. NOT in MANIFEST.core (the
// aeroplane's core and its hash are untouched): since TOW-LAUNCH (11 Nov) it is
// a LAZY file of the page (tools/build.js MANIFEST.lazy), fetched with the drive
// mode (src/viewer/drive_mode.js) - GROUND-VEHICLE-2026-10.md §9.
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
  tune = tune || sheet.tune || VEH_TUNES[sheet.car];   // (13 Nov: a garage car's sheet carries its own tune - tools/car_sheet.js)
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
    // the tow hitch (CAR-3, the seam agreed with TOW-LAUNCH): the sheet's (a garage car's drawn ball, body frame), else
    // none - tow.js then takes its own default at the rear
    hitch: sheet.hitch ? sheet.hitch.slice() : undefined,
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
  let ext = null;                                 // (TOW-LAUNCH) an external pull, car.extF
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

  // THE SUBSTEP'S SCRATCH (TOW-LAUNCH, GROUND-VEHICLE §8.1): the spike made ~250 small arrays a substep (the vector
  // helpers' returns) - 60 000 a second at 240 Hz, the browser's young collector's to sweep. Every vector below is a
  // preallocated slot or scalars, and every expression keeps the spike's arithmetic IN ITS ORDER (a + b + c left to right,
  // the same products): GATE VEHICLE and GATE DRIVE-TRIP print the same digits, bit for bit
  const C = def.wheels.map(() => ({ on: false, r: [0, 0, 0], n: [0, 0, 0], ft: [0, 0, 0], lt: [0, 0, 0], Fn: 0, mu: 0, crr: 0, mL: 0, mT: 0, lamL: 0, lamT: 0, Fd: 0, capL: 0 }));
  const SR = new Float64Array(9), SI = new Float64Array(9), SW = new Float64Array(9);   // R, its inverse inertia, its inertia (world)
  const SF = new Float64Array(3), ST = new Float64Array(3), SV = new Float64Array(3), SA = new Float64Array(3);   // force, torque, a point's velocity, a scratch
  function qToRInto(q, R) {
    const w = q[0], x = q[1], y = q[2], z = q[3];
    R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - w * z); R[2] = 2 * (x * z + w * y);
    R[3] = 2 * (x * y + w * z); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - w * x);
    R[6] = 2 * (x * z - w * y); R[7] = 2 * (y * z + w * x); R[8] = 1 - 2 * (x * x + y * y);
  }
  function invIwInto(R, M) {   // R diag(1/I) R^T
    const a = 1 / Ib[0], b = 1 / Ib[1], c = 1 / Ib[2];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      M[i * 3 + j] = R[i * 3] * a * R[j * 3] + R[i * 3 + 1] * b * R[j * 3 + 1] + R[i * 3 + 2] * c * R[j * 3 + 2];
  }
  function IwInto(R, M) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      M[i * 3 + j] = R[i * 3] * Ib[0] * R[j * 3] + R[i * 3 + 1] * Ib[1] * R[j * 3 + 1] + R[i * 3 + 2] * Ib[2] * R[j * 3 + 2];
  }
  // M b, b = (b0, b1, b2), into o
  const mulInto = (M, b0, b1, b2, o) => { o[0] = M[0] * b0 + M[1] * b1 + M[2] * b2; o[1] = M[3] * b0 + M[4] * b1 + M[5] * b2; o[2] = M[6] * b0 + M[7] * b1 + M[8] * b2; };
  // a body point's offset from the CG in the world, into o
  const relInto = (R, p0, p1, p2, o) => mulInto(R, p0 - cgB[0], p1 - cgB[1], p2 - cgB[2], o);
  // the velocity of the chassis at r (world offset from the CG), into SV: v + w x r
  const ptVelInto = r => { const w = st.w, v = st.v; SV[0] = v[0] + (w[1] * r[2] - w[2] * r[1]); SV[1] = v[1] + (w[2] * r[0] - w[0] * r[2]); SV[2] = v[2] + (w[0] * r[1] - w[1] * r[0]); };
  const addFs = (rx, ry, rz, fx, fy, fz) => { SF[0] += fx; SF[1] += fy; SF[2] += fz; ST[0] += ry * fz - rz * fy; ST[1] += rz * fx - rx * fz; ST[2] += rx * fy - ry * fx; };
  // the effective mass of the chassis for an impulse along u at r
  const mEffS = (Ii, r, u) => {
    mulInto(Ii, r[1] * u[2] - r[2] * u[1], r[2] * u[0] - r[0] * u[2], r[0] * u[1] - r[1] * u[0], SA);
    const a = SA; return 1 / (1 / m + ((a[1] * r[2] - a[2] * r[1]) * u[0] + (a[2] * r[0] - a[0] * r[2]) * u[1] + (a[0] * r[1] - a[1] * r[0]) * u[2]));
  };
  function applyImpS(Ii, r, J0, J1, J2) {
    const v = st.v, w = st.w;
    v[0] += J0 / m; v[1] += J1 / m; v[2] += J2 / m;
    mulInto(Ii, r[1] * J2 - r[2] * J1, r[2] * J0 - r[0] * J2, r[0] * J1 - r[1] * J0, SA); w[0] += SA[0]; w[1] += SA[1]; w[2] += SA[2];
  }
  function substep(dt) {
    const R = SR, Ii = SI; qToRInto(st.q, R); invIwInto(R, Ii);
    const ex0 = R[0], ex1 = R[3], ex2 = R[6], ey0 = R[1], ey1 = R[4], ey2 = R[7], ez0 = R[2], ez1 = R[5], ez2 = R[8];
    const X = st.x;
    SF[0] = 0; SF[1] = -m * VEH_G; SF[2] = 0; ST[0] = 0; ST[1] = 0; ST[2] = 0;
    // the air
    { const v = st.v, V = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      if (V > 0.01 && def.aero.CdA > 0) { const k = -0.5 * VEH_RHO * def.aero.CdA * V; SF[0] += k * v[0]; SF[1] += k * v[1]; SF[2] += k * v[2]; } }
    // the steering slews toward the asked bicycle angle
    const dT = Math.max(-1, Math.min(1, ctl.steer)) * def.steer.dMax, dStep = def.steer.rate * dt;
    delta += Math.max(-dStep, Math.min(dStep, dT - delta));
    const u = st.v[0] * ex0 + st.v[1] * ex1 + st.v[2] * ex2;
    const Fdrv = driveForce(u);
    // PROVIDER 'wheels': the struts, the loads, the tyres' frames; the drive's share through each contacted wheel
    let nOn = 0, driveOn = 0;
    for (let i = 0; i < def.wheels.length; i++) {
      const w = def.wheels[i], S = wh[i], c = C[i];
      c.on = false; S.on = false; S.Fn = 0; S.Fd = 0;
      S.delta = wheelDelta(w, delta);
      relInto(R, w.at[0], w.at[1] + w.bump, w.at[2], SA);
      const rh0 = SA[0], rh1 = SA[1], rh2 = SA[2], hp0 = X[0] + rh0, hp1 = X[1] + rh1, hp2 = X[2] + rh2;
      const Lmax = w.bump + w.droop;
      const cx = hp0 - ey0 * S.s, cz = hp2 - ey2 * S.s;
      const gy = H(cx, cz);
      // the ground's normal (normalAt: finite differences, normalised)
      const hx = H(cx + NE, cz), hz = H(cx, cz + NE);
      let n0 = -(hx - gy) / NE, n1 = 1, n2 = -(hz - gy) / NE;
      { const l = Math.sqrt(n0 * n0 + n1 * n1 + n2 * n2) || 1e-12; n0 = n0 / l; n1 = n1 / l; n2 = n2 / l; }
      const dn = -(ey0 * n0 + ey1 * n1 + ey2 * n2);   // the strut's direction (-up) on the normal: < 0
      if (dn > -0.3) { S.s = Lmax; continue; }
      let s = (w.r - ((hp0 - cx) * n0 + (hp1 - gy) * n1 + (hp2 - cz) * n2)) / dn;
      if (s >= Lmax) { S.s = Lmax; continue; }      // hanging: the wheel is in the air
      let bottom = 0; if (s < 0) { bottom = -s; s = 0; }
      SA[0] = rh0; SA[1] = rh1; SA[2] = rh2; ptVelInto(SA);
      const sdot = (SV[0] * n0 + SV[1] * n1 + SV[2] * n2) / (-dn);
      let Fs = w.k * (w.sFree - s) - w.c * sdot + def.susp.kStop * bottom;
      if (Fs < 0) Fs = 0;
      S.s = s;
      if (Fs <= 0) continue;
      const cp0 = hp0 - ey0 * s - n0 * w.r, cp1 = hp1 - ey1 * s - n1 * w.r, cp2 = hp2 - ey2 * s - n2 * w.r;
      const r = c.r; r[0] = cp0 - X[0]; r[1] = cp1 - X[1]; r[2] = cp2 - X[2];
      addFs(r[0], r[1], r[2], n0 * Fs, n1 * Fs, n2 * Fs);
      const cs = Math.cos(S.delta), sn = Math.sin(S.delta);
      const fw0 = ex0 * cs + ez0 * sn, fw1 = ex1 * cs + ez1 * sn, fw2 = ex2 * cs + ez2 * sn;
      const fn = fw0 * n0 + fw1 * n1 + fw2 * n2;
      const ft = c.ft; { let a0 = fw0 - fn * n0, a1 = fw1 - fn * n1, a2 = fw2 - fn * n2; const l = Math.sqrt(a0 * a0 + a1 * a1 + a2 * a2) || 1e-12; ft[0] = a0 / l; ft[1] = a1 / l; ft[2] = a2 / l; }
      const lt = c.lt; lt[0] = ft[1] * n2 - ft[2] * n1; lt[1] = ft[2] * n0 - ft[0] * n2; lt[2] = ft[0] * n1 - ft[1] * n0;   // the tyre's right, in the ground's plane
      const sf = surfOf(cp0, cp2), mu = sf[0], crr = sf[1];
      c.on = true; c.n[0] = n0; c.n[1] = n1; c.n[2] = n2; c.Fn = Fs; c.mu = mu; c.crr = crr;
      c.mL = mEffS(Ii, r, ft); c.mT = mEffS(Ii, r, lt); c.lamL = 0; c.lamT = 0;
      S.on = true; S.Fn = Fs; nOn++;
      // THE DRIVE: only a driven wheel ON THE GROUND carries its share, capped by its traction
      let Fd = 0;
      if (w.drive > 0) { const cap = def.drive.tc * mu * Fs; Fd = Math.max(-cap, Math.min(cap, Fdrv * w.drive)); driveOn++; }
      c.Fd = Fd; S.Fd = Fd;
      if (Fd) addFs(r[0], r[1], r[2], ft[0] * Fd, ft[1] * Fd, ft[2] * Fd);
      // the brake this wheel can take (pedal, + the hand brake on its wheels), ABS-capped under the friction
      let B = Math.max(0, Math.min(1, ctl.brake)) * def.brake.F * w.brake + (w.hand ? Math.max(0, Math.min(1, ctl.hand)) * def.brake.handF / 2 : 0);
      B = Math.min(B, def.brake.abs * mu * Fs);
      c.capL = (crr * Fs + B) * dt;
    }
    // PROVIDER 'proxy': the body's boxes on the ground (an overturn, a ditch, a kerb the wheels cannot climb)
    out.proxyHit = false;
    const nP = def.proxy.length;
    for (let k = 0; k < nP; k++) {
      const pb = def.proxy[k]; relInto(R, pb[0], pb[1], pb[2], SA);
      const px = X[0] + SA[0], py = X[1] + SA[1], pz = X[2] + SA[2];
      const gy = H(px, pz), pen = gy - py;
      if (pen <= 0) continue;
      out.proxyHit = true;
      ptVelInto(SA);
      const vp0 = SV[0], vp1 = SV[1], vp2 = SV[2];
      let Fn = 3e5 * pen - 2e4 * vp1; if (Fn < 0) Fn = 0;
      const sp = Math.hypot(vp0, vp2);
      const kf = sp > 1e-6 ? Math.min(0.5 * Fn / sp, m / dt / nP) : 0;
      addFs(SA[0], SA[1], SA[2], -kf * vp0, Fn, -kf * vp2);
    }
    // (TOW-LAUNCH phase 3) AN EXTERNAL PULL: `car.extF` = { f: [x, y, z] N world, at: [x, y, z] body point } - the tow line's
    // mean pull on the hitch (tow.js); unset, nothing here (the spike's digits)
    if (ext !== null) { relInto(R, ext.at[0], ext.at[1], ext.at[2], SA); addFs(SA[0], SA[1], SA[2], ext.f[0], ext.f[1], ext.f[2]); }
    // the velocities step on the explicit forces (the gyroscopic term included)
    {
      const w = st.w, v = st.v; IwInto(R, SW); mulInto(SW, w[0], w[1], w[2], SA);
      const g0 = w[1] * SA[2] - w[2] * SA[1], g1 = w[2] * SA[0] - w[0] * SA[2], g2 = w[0] * SA[1] - w[1] * SA[0];
      v[0] += SF[0] / m * dt; v[1] += SF[1] / m * dt; v[2] += SF[2] / m * dt;
      mulInto(Ii, ST[0] - g0, ST[1] - g1, ST[2] - g2, SA);
      w[0] += SA[0] * dt; w[1] += SA[1] * dt; w[2] += SA[2] * dt;
    }
    // THE TYRES: sequential impulses on the stepped velocities
    const Ca = def.tyre.Ca, u0 = def.tyre.u0;
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < C.length; i++) {
        const c = C[i]; if (!c.on) continue;
        const r = c.r, ft = c.ft, lt = c.lt;
        ptVelInto(r);
        // along the wheel: rolling resistance + the brake, a capped friction (holds a parked car)
        const vl = SV[0] * ft[0] + SV[1] * ft[1] + SV[2] * ft[2];
        let L = c.lamL - vl * c.mL;
        L = Math.max(-c.capL, Math.min(c.capL, L));
        let dL = L - c.lamL; c.lamL = L;
        if (dL) applyImpS(Ii, r, ft[0] * dL, ft[1] * dL, ft[2] * dL);
        // across it: the soft (compliant) side force, the linear tyre at speed, a no-slip parked
        ptVelInto(r);
        const vt = SV[0] * lt[0] + SV[1] * lt[1] + SV[2] * lt[2], vlong = Math.abs(SV[0] * ft[0] + SV[1] * ft[1] + SV[2] * ft[2]);
        const gam = Math.max(vlong, u0) / (Ca * c.Fn * dt);
        let Tn = c.lamT - (vt + gam * c.lamT) / (1 / c.mT + gam);
        // the friction ellipse: what the wheel's grip leaves after the drive and the brake
        const lon = c.lamL + c.Fd * dt, cap2 = Math.pow(c.mu * c.Fn * dt, 2) - lon * lon;
        const capT = cap2 > 0 ? Math.sqrt(cap2) : 0;
        Tn = Math.max(-capT, Math.min(capT, Tn));
        const dT2 = Tn - c.lamT; c.lamT = Tn;
        if (dT2) applyImpS(Ii, r, lt[0] * dT2, lt[1] * dT2, lt[2] * dT2);
      }
    }
    // the pose steps
    st.x[0] += st.v[0] * dt; st.x[1] += st.v[1] * dt; st.x[2] += st.v[2] * dt;
    { const q = st.q, qw = q[0], qx = q[1], qy = q[2], qz = q[3], wx = st.w[0], wy = st.w[1], wz = st.w[2], h = 0.5 * dt;
      const a0 = qw + h * (-wx * qx - wy * qy - wz * qz), a1 = qx + h * (wx * qw + wy * qz - wz * qy),
            a2 = qy + h * (wy * qw + wz * qx - wx * qz), a3 = qz + h * (wz * qw + wx * qy - wy * qx);
      const ql = Math.hypot(a0, a1, a2, a3); q[0] = a0 / ql; q[1] = a1 / ql; q[2] = a2 / ql; q[3] = a3 / ql; }
    // the wheels' spin (the renderer's), the outputs
    let Fsum = 0;
    for (let i = 0; i < wh.length; i++) {
      const c = C[i], S = wh[i];
      S.lamL = c.on ? c.lamL / dt : 0; S.lamT = c.on ? c.lamT / dt : 0;
      if (c.on) { ptVelInto(c.r); S.vl = SV[0] * c.ft[0] + SV[1] * c.ft[1] + SV[2] * c.ft[2]; S.slipT = Math.atan2(SV[0] * c.lt[0] + SV[1] * c.lt[1] + SV[2] * c.lt[2], Math.max(0.1, Math.abs(S.vl))); }
      S.spin += (S.vl / def.wheels[i].r) * dt;
      Fsum = Fsum + S.Fd;
    }
    out.onGround = nOn; out.driveOn = driveOn; out.Fdrive = Fsum;
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
    // the ground's plane over the wheelbase and the track, centred on the AXLES' midpoint (MASTER-GREEN 8 Nov: the baked
    // sheet's origin is 0.21 m ahead of it - a plane sampled about the origin put the back sample 0.21 m behind the rear
    // tyres, and over a ledge they still stand on it tilted the car 29 deg nose-up off its front wheels)
    const L = def.wb / 2 + 0.3, Wd = def.track / 2 + 0.2;
    const xm = (def.steer.xSt + def.steer.xRef) / 2, cx = x + fx * xm, cz = z + fz * xm;
    const hF = H(cx + fx * L, cz + fz * L), hB = H(cx - fx * L, cz - fz * L);
    const hR = H(cx - fz * Wd, cz + fx * Wd), hL = H(cx + fz * Wd, cz - fx * Wd);
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
           get extF() { return ext; }, set extF(e) { ext = e && e.f && e.at ? e : null; },
           heading: () => { const A = axes(); return Math.atan2(A.fwd[2], A.fwd[0]); },
           speed: () => vDot(st.v, axes().fwd), wheelDelta: d => def.wheels.map(w => wheelDelta(w, d)) };
}

if (typeof module !== 'undefined') module.exports = { VEH_SURF, VEH_TUNES, VEH_DT, vehicleDef, makeVehicle, vehWrapPi, qToR, rToQ };
