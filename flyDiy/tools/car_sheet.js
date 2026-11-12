#!/usr/bin/env node
// CAR SHEET (CAR-1, 2026-11-12) - a garage CAR card (or a saved build) -> the GROUND VEHICLE's data sheet + tune, and
// a drive test on the vehicle shell (src/vehicle/vehicle.js, the AI car's physics: one rigid chassis, the driven rear
// wheels through a power curve, Ackermann front steering, springs, tyres in the friction ellipse).
//
// The user (12 Nov): "reuse the mechanics that we have for powering the wheels from the engine, because we already
// have an AI car that reuses this physics. We allow for four wheels and directional wheels". The aeroplane's solver
// (makeSim) is not that: its ground pass rolls two mains and one steered third wheel and nothing is driven (the
// vehicle shell's own header says why it is a shell of its own). So the garage DRAWS the car (the card in
// tools/_cage_design.js, key 'roadster') and this tool MEASURES the drawing into the sheet the shell reads - the
// same WYSIWYG rule the join applies to an aeroplane:
//   THE WHEELS   the gear layer's four drawn contacts (CAGE_GEAR.contacts): the mains are the rear axle, the third
//                station drawn as a pair (s2X > 0) the front axle; centre, radius, the ground under them
//   THE BODY     the drawn airframe (CAGE_GEAR.AF: its stations and sections) + every drawn layer's box: the
//                collision box and the footprint
//   THE MASS     the build's own LEDGER (buildGen(joined spec).parts.ledger) less what a car does not carry (the
//                wings, their bracing, the tail), plus the CHASSIS a garage aeroplane has no row for (a GAP: a ladder
//                frame and two axles, authored below); the CG along the car from the ledger's moments (x aft of the
//                firewall, placed on the drawing by the mains' measured station: zFw = z(rear axle) + gear.x)
//   THE ENGINE   the custom engine's own facts (engines[0].custom) or the registry row the card names
//                (POWERPLANTS[type].engine.powerW), through a gearbox (DRIVELINE.eta)
//   THE TUNE     what the drawing does not say (brakes, springs, tyres, air): authored here as the conquer's is in
//                vehicle.js, scaled to the car's mass
// Frames: the garage is x right (+ = the contacts' sgn 1 side), y up, z forward, metres; the sheet is +x forward, y
// up, +z right (vehicle.js), its origin under the garage's (x = z_garage, y = y_garage - ground, z = x_garage).
//
//   node tools/car_sheet.js --key roadster                 the sheet + tune printed, and the drive test
//   node tools/car_sheet.js my_car_build.json              a saved build (an envelope or a bare spec)
//   node tools/car_sheet.js --key roadster --out src/cars/car_roadster.json   write the sheet (+ its tune)
//   node tools/car_sheet.js --key roadster --no-drive      the sheet only
//   node tools/car_sheet.js --key roadster --save builds/candidates/roadster_2026-11.json   THE SAVED BUILD: the card born as
//                                                          the shed births it, through the page's load door (_load_build.js,
//                                                          newshapes_build.js's way) - the file the garage's lists open
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const V = require(path.join(ROOT, 'src/vehicle/vehicle.js'));

// what a car does not carry of an aeroplane's ledger, and the car's own lumps the garage has no row for (GAPS)
const NOT_A_CAR = ['wings', 'bracing', 'tail'];
const CHASSIS = { kg: 120, note: 'GAP: a ladder frame, two beam axles, the steering box and the differential - ' +
                  'no garage row (a 1930s light car\'s, ~110-140 kg); placed at the wheelbase\'s middle, axle height' };
const DRIVELINE = { eta: 0.85, note: 'a manual gearbox and a live rear axle: ~85 % of the crank power at the wheels' };
// THE CAR'S OWN ROWS (CAR-3): what the drawing cannot say, carried by the build in spec.meta.car (absent = CAR-1's
// rear-drive light car): drive '4wd' (a transfer case: all four wheels driven, ~80 % at the wheels), chassisKg (a
// utility's ladder frame, two live axles and the transfer case weigh ~250-300 kg, not a 1930s roadster's 120)
const DRIVELINE_4WD = { eta: 0.80, note: 'a manual gearbox, a transfer case and two live axles: ~80 % of the crank power at the wheels' };
const carRows = spec => Object.assign({ drive: 'rwd', chassisKg: CHASSIS.kg }, (spec && spec.meta && spec.meta.car) || {});

function sheetFromBake(bj, C, opts) {
  opts = opts || {};
  const W = bj.W, G = W.CAGE_GEAR;
  if (!G || !G.contacts || G.contacts.length !== 4) throw new Error('car_sheet: the drawing has ' +
    (G && G.contacts ? G.contacts.length : 0) + ' wheel contacts, a car needs 4 (the mains + the third station as a pair: s2X > 0)');
  const spec = bj.spec, CR = carRows(spec), chKg = CR.chassisKg, awd = CR.drive === '4wd';
  // ---- THE WHEELS: front = the two most forward contacts ----
  const cs = G.contacts.slice().sort((a, b) => b.p[2] - a.p[2]);
  const front = cs.slice(0, 2), rear = cs.slice(2);
  const ground = Math.min(...cs.map(c => c.p[1] - c.R));
  const wheel = (c, steered) => ({ centre: [+c.p[2].toFixed(4), +(c.p[1] - ground).toFixed(4), +c.p[0].toFixed(4)],
                                    radius: +c.R.toFixed(4), width: +(0.32 * c.R).toFixed(4),
                                    side: c.p[0] > 0 ? 'right' : 'left', steered });
  const byX = a => a.slice().sort((p, q) => p.p[0] - q.p[0]);
  const [FL, FR] = byX(front), [RL, RR] = byX(rear);
  const wheels = { FL: wheel(FL, true), FR: wheel(FR, true), RL: wheel(RL, false), RR: wheel(RR, false) };
  const zRear = (RL.p[2] + RR.p[2]) / 2, zFront = (FL.p[2] + FR.p[2]) / 2;
  // ---- THE BODY: the airframe's stations and sections, and every drawn layer ----
  const AF = G.AF, THREE = W.THREE;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const grow = (x, y, z) => { lo[0] = Math.min(lo[0], z); hi[0] = Math.max(hi[0], z); lo[1] = Math.min(lo[1], y - ground);
    hi[1] = Math.max(hi[1], y - ground); lo[2] = Math.min(lo[2], x); hi[2] = Math.max(hi[2], x); };
  if (AF && AF.surf) for (let k = 0; k <= 40; k++) {
    const z = AF.z0 + (AF.z1 - AF.z0) * k / 40;
    for (let a = 0; a < 24; a++) { const q = AF.surf(z, a * Math.PI / 12); if (q && isFinite(q[0]) && isFinite(q[1])) { grow(q[0], q[1], z); grow(-q[0], q[1], z); } }
  }
  const box = new THREE.Box3();
  bj.scene.traverse(o => { if (!o.isMesh || !o.geometry) return; box.setFromObject(o);
    if (!isFinite(box.min.x)) return;
    // the wheels and their legs are the wheels' (cylinders, not the body proxy): only what is inside the track
    if (Math.max(Math.abs(box.min.x), Math.abs(box.max.x)) > Math.abs(FR.p[0]) - 0.5 * FR.R * 0.32) return;
    grow(box.min.x, box.min.y, box.min.z); grow(box.max.x, box.max.y, box.max.z); });
  // ---- THE MASS: the ledger less the aeroplane, plus the chassis ----
  const def = C.buildGen(spec), L = def.parts.ledger || {};
  let m = 0, mx = 0;
  const items = [];
  for (const k in L) { if (NOT_A_CAR.includes(k) || !(L[k].mass > 0)) continue;
    m += L[k].mass; mx += L[k].mx || 0; items.push([k, +L[k].mass.toFixed(1)]); }
  const g = spec.gear || {};
  if (!(typeof g.x === 'number')) throw new Error('car_sheet: the join measured no mains station (gear.x)');
  // the ledger's datum on the drawing: the MAINS' station + gear.x (the join's mains aft of it) - CAR-4: the mains are
  // the first station drawn (s1), not always the rear axle (a UTV's mains are its FRONT pair, the boom wheels its rear;
  // the rear axle's station put the UTV's CG on its rear axle)
  const mains = G.contacts.filter(c => c.st && c.st === G.contacts[0].st);
  const zMains = mains.length === 2 ? (mains[0].p[2] + mains[1].p[2]) / 2 : zRear;
  const zFw = zMains + g.x;
  const xLedger = mx / m;                           // the ledger's CG, aft of the firewall
  const zCh = (zRear + zFront) / 2;
  const mTot = m + chKg;
  const zCg = ((zFw - xLedger) * m + zCh * chKg) / mTot;
  // the CG's height: the body's (no ledger row carries it) - 40 % of the drawn body's height over the ground, the
  // chassis at the axles' height; an ESTIMATE, as the conquer's is
  const rAx = (FL.p[1] + RL.p[1]) / 2 - ground;
  const yCg = (0.40 * hi[1] * m + rAx * chKg) / mTot;
  // a uniform box of the body's size (car_prep.py's rule)
  const Lx = hi[0] - lo[0], Ly = hi[1] - Math.max(0, lo[1]), Lz = hi[2] - lo[2];
  const I = [mTot * (Ly * Ly + Lz * Lz) / 12, mTot * (Lx * Lx + Lz * Lz) / 12, mTot * (Lx * Lx + Ly * Ly) / 12];
  // ---- THE ENGINE ----
  const E = (spec.engines && spec.engines[0]) || {};
  const PP = (C.POWERPLANTS || {})[E.type] || {};
  // a CUSTOM engine flies its own resolved facts (the join's engines[].custom, 60_gen_spec G134), a catalogue one its row
  const CU = E.custom && E.custom.powerW > 0 ? E.custom : null;
  const powerW = CU ? CU.powerW : (PP.engine && PP.engine.powerW) || 0;
  const engName = CU ? CU.name : PP.engine ? PP.engine.name : null;
  const sheet = {
    car: opts.key || 'garage', authored: 'MEASURED off the garage drawing by tools/car_sheet.js (CAR-1); the mass, the CG ' +
      'height and the inertia are ESTIMATES (the ledger less the wings and tail, plus a chassis; 40 % of the body height; a uniform box)',
    frame: '+x forward, y up, +z right; metres; x = the garage z, z = the garage x, y over the ground under the tyres',
    wheels, wheelbase: +(zFront - zRear).toFixed(4),
    track: { front: +(FR.p[0] - FL.p[0]).toFixed(4), rear: +(RR.p[0] - RL.p[0]).toFixed(4) },
    ground: 0,
    box: { lo: lo.map(v => +v.toFixed(3)), hi: hi.map(v => +v.toFixed(3)) },
    collision: { boxes: [{ name: 'body', lo: [lo[0], Math.max(lo[1], 0.12), lo[2]].map(v => +v.toFixed(3)),
                                         hi: hi.map(v => +v.toFixed(3)) }] },
    estimates: { mass_kg: +mTot.toFixed(1), cg: [+zCg.toFixed(4), +yCg.toFixed(4), 0], inertia_kgm2: I.map(v => +v.toFixed(1)),
                 ledger: items, chassis: Object.assign({}, CHASSIS, { kg: chKg }), firewall_z: +zFw.toFixed(4) },
    engine: { type: CU ? 'custom' : (E.type || null), name: engName, powerW, mass: CU ? CU.mass : (PP.engine && PP.engine.mass), driveline: awd ? DRIVELINE_4WD : DRIVELINE },
    drive: awd ? '4wd' : 'rwd',
  };
  return sheet;
}

// THE TUNE: the powertrain from the engine row, the rest a 1930s light car's (drums, beam axles on leaf springs,
// cross-ply tyres), scaled to the mass - authored, as the conquer's is (vehicle.js VEH_TUNES)
function tuneFor(sheet) {
  const m = sheet.estimates.mass_kg, gW = m * 9.81, P = sheet.engine.powerW * sheet.engine.driveline.eta;
  return {
    drive: { wheels: sheet.drive === '4wd' ? ['FL', 'FR', 'RL', 'RR'] : ['RL', 'RR'], P: Math.round(P), F0: Math.round(0.75 * gW), Frev: Math.round(0.45 * gW), vRev: 6.0,
             engBrake: Math.round(0.03 * gW), tc: 0.85 },
    brake: { F: Math.round(0.80 * gW), front: 0.60, abs: 0.80, hand: ['RL', 'RR'], handF: Math.round(0.25 * gW) },
    steer: { wheels: ['FL', 'FR'], innerDeg: 36, ackermann: 1.0, rate: 0.9 },
    susp: { bump: 0.07, droop: 0.09, hz: [1.6, 1.8], zeta: 0.35, kStop: 150e3 },
    tyre: { Ca: 9.0, u0: 1.5 },
    // open wheels, an open cockpit and a boat tail: Cd ~0.6 on ~1.3 m2
    aero: { CdA: 0.8 },
  };
}

// THE DRIVE TEST: the vehicle check's own rows (tools/_vehicle_check.js), on the car
function driveTest(sheet, tune, log) {
  const def = V.vehicleDef(sheet, tune), DT = 1 / 60, flat = { terrainH: () => 0 };
  const run = (car, s, fn) => { for (let t = 0; t < s; t += DT) { if (fn && fn(t) === false) break; car.step(DT); } };
  const mk = () => { const c = V.makeVehicle(def, flat); c.place(0, 0, 0); run(c, 0.5); return c; };
  const R = {};
  { const c = mk(), p0 = c.refPoint(); run(c, 2); const p1 = c.refPoint();
    R.parked = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); R.onGround = c.out.onGround;
    const Wsum = def.wheels.reduce((s, w) => s + w.Wst, 0);
    R.front = def.wheels.filter(w => w.steer).reduce((s, w) => s + w.Wst, 0) / Wsum; }
  { const c = mk(); c.ctl.thr = 1; let t100 = null; run(c, 40, t => { if (t100 == null && c.out.u >= 100 / 3.6) t100 = t; });
    R.t100 = t100; R.v40 = c.out.u; }
  { const c = mk(); c.st.v = [100 / 3.6, 0, 0]; run(c, 0.3); const x0 = c.st.x[0]; c.ctl.brake = 1;
    run(c, 15, () => c.out.u > 0.02); R.brake100 = c.st.x[0] - x0; R.brakeOff = Math.abs(c.st.x[2]); }
  { const c = mk(); c.ctl.gear = -1; c.ctl.thr = 1; run(c, 8); R.rev = c.out.u; }
  for (const sgn of [1, -1]) {
    const c = mk(); c.ctl.steer = sgn; c.ctl.thr = 0.12; run(c, 3);
    const pts = []; run(c, 25, () => { pts.push(c.refPoint()); });
    // the rear axle's circle: its diameter from the extreme points, then kerb to kerb + the outer front wheel's offset
    let dMax = 0; for (let i = 0; i < pts.length; i += 5) for (let j = i; j < pts.length; j += 5)
      dMax = Math.max(dMax, Math.hypot(pts[i][0] - pts[j][0], pts[i][2] - pts[j][2]));
    R['circle' + (sgn > 0 ? 'R' : 'L')] = dMax;
  }
  // A LANE CHANGE at 60 km/h, part throttle: one full sine of steer over 2.5 s (amp: a fraction of full lock), then 2 s
  // straight - the peak lateral g, the largest heading excursion and the heading it ends on (a car that holds comes back
  // near 0; a spin does not: the first sheet, 64 % front, went round at 0.25 of lock - CAR-1)
  for (const amp of [0.06, 0.12]) {
    const c = mk(); c.st.v = [60 / 3.6, 0, 0]; run(c, 0.5); c.ctl.thr = 0.25; let aMax = 0, upMin = 1, hMax = 0;
    run(c, 4.5, t => { c.ctl.steer = t < 2.5 ? amp * Math.sin(2 * Math.PI * t / 2.5) : 0; aMax = Math.max(aMax, Math.abs(c.out.aLat));
      upMin = Math.min(upMin, c.axes().up[1]); hMax = Math.max(hMax, Math.abs(c.heading())); });
    R['lane' + amp] = { g: aMax / 9.81, up: upMin, hMax: hMax * 180 / Math.PI, hEnd: c.heading() * 180 / Math.PI, u: c.out.u };
  }
  // THE TOW (CAR-3, the user: "able to pull the glider"): a rope on the hitch pulling aft at a steady tension (ramped in
  // over 2 s) from a standing start, full throttle, on the paved strip and on grass (VEH_SURF: mu 0.90 / 0.55) - the
  // time to 100 km/h (a glider's auto-tow launch speed) and the speed it holds at 30 s. A glider's auto-tow / winch
  // pulls ~1.0-1.3 x its weight on the climb: 4-5 kN for a 350-400 kg two-seater. The rope runs back along the launch
  // line (the world's -x, the car placed heading +x)
  for (const [srf, sName] of [[5, 'paved'], [0, 'grass']]) for (const kN of [3, 4.5, 6]) {
    const w = { terrainH: () => 0, surface: () => srf }, c = V.makeVehicle(def, w); c.place(0, 0, 0); run(c, 0.5);
    c.ctl.thr = 1; let t100 = null;
    run(c, 30, t => { c.ctl.tow = Math.min(1, t / 2) * kN * 1000; c.ctl.towDir = [-1, 0]; if (t100 == null && c.out.u >= 100 / 3.6) t100 = t; });
    R['tow_' + sName + '_' + kN] = { t100, u30: c.out.u, up: c.axes().up[1] };
  }
  // AN AUTO-TOW (CAR-3): a 450 kg two-seat trainer glider on the rope - on its wheel the rope pulls what the glider
  // needs (m a + its rolling and air drag; the rope taut, the glider at the car's speed), it lifts off at 70 km/h and
  // over 6 s the rope comes up to 1.2 x its weight at 25 deg (the climb); the run passes if the car reaches 70 km/h
  // and then holds 90 km/h or more through 20 s of climb
  const GL = { m: 450, crr: { 5: 0.02, 0: 0.06 }, CdA: 0.25, vOff: 70 / 3.6, kClimb: 1.2, elClimb: 25 * Math.PI / 180, tClimb: 6 };
  for (const [srf, sName] of [[5, 'paved'], [0, 'grass']]) {
    const w = { terrainH: () => 0, surface: () => srf }, c = V.makeVehicle(def, w); c.place(0, 0, 0); run(c, 0.5);
    c.ctl.thr = 1; let tOff = null, uMin = 1e9, Tmax = 0, uPrev = c.out.u;
    run(c, 60, t => {
      const u = c.out.u, a = (u - uPrev) * 60; uPrev = u;
      let T, el = 0;
      if (tOff == null) { T = GL.m * Math.max(0, a) + GL.crr[srf] * GL.m * 9.81 + 0.5 * 1.225 * GL.CdA * u * u; if (u >= GL.vOff) tOff = t; }
      else { const k = Math.min(1, (t - tOff) / GL.tClimb); T = (1 - k) * (0.5 * 1.225 * GL.CdA * u * u) + k * GL.kClimb * GL.m * 9.81; el = k * GL.elClimb;
             if (t - tOff > GL.tClimb) uMin = Math.min(uMin, u); if (t - tOff > GL.tClimb + 20) return false; }
      c.ctl.tow = T; c.ctl.towEl = el; c.ctl.towDir = [-1, 0]; Tmax = Math.max(Tmax, T);
    });
    R['auto_' + sName] = { tOff, uMin: uMin < 1e9 ? uMin : null, Tmax, ok: tOff != null && uMin >= 90 / 3.6 };
  }
  if (log) {
    const f = (x, n = 2) => (x == null ? '-' : (+x).toFixed(n));
    log('DEF      wb ' + f(def.wb) + ' m, track ' + f(def.track) + ' m, r ' + f(def.wheels[0].r) + ' m, ' + f(def.mass, 0) + ' kg (' +
        f(100 * R.front, 1) + ' % front), ' + f(def.drive.P / 1000, 0) + ' kW at the wheels; parked 2 s ' + f(1000 * R.parked, 2) +
        ' mm, ' + R.onGround + ' wheels on the ground');
    log('ACCEL    0-100 km/h ' + f(R.t100, 1) + ' s, ' + f(R.v40 * 3.6, 0) + ' km/h at 40 s');
    log('BRAKE    100-0 km/h in ' + f(R.brake100, 1) + ' m (' + f((100 / 3.6) ** 2 / 2 / R.brake100 / 9.81) + ' g), ' + f(1000 * R.brakeOff, 0) + ' mm off the line');
    log('REVERSE  ' + f(R.rev) + ' m/s (the gear ' + def.drive.vRev + ')');
    log('TURN     the rear axle\'s circle ' + f(R.circleR, 1) + ' m right, ' + f(R.circleL, 1) + ' m left (rMin ' + f(def.rMin) + ' m)');
    for (const amp of [0.06, 0.12]) { const L = R['lane' + amp];
      log('LANE     60 km/h, a sine of ' + amp + ' lock: ' + f(L.g) + ' g peak, heading out to ' + f(L.hMax, 1) + ' deg and back to ' +
          f(L.hEnd, 1) + ' deg, ' + f(L.u * 3.6, 0) + ' km/h after, upright ' + f(L.up, 3) + (Math.abs(L.hEnd) > 10 ? '  << SPUN / DID NOT RECOVER' : '')); }
    for (const sName of ['paved', 'grass']) log('TOW      ' + sName.padEnd(5) + ' ' + [3, 4.5, 6].map(kN => { const T = R['tow_' + sName + '_' + kN];
      return kN + ' kN: 100 km/h ' + (T.t100 == null ? 'NEVER' : 'in ' + f(T.t100, 1) + ' s') + ', ' + f(T.u30 * 3.6, 0) + ' km/h at 30 s'; }).join(' | ') + '  (negative: the rope drags it back)');
    for (const sName of ['paved', 'grass']) { const A = R['auto_' + sName];
      log('AUTOTOW  ' + sName.padEnd(5) + ' a 450 kg glider: ' + (A.tOff == null ? 'NEVER reached the 70 km/h lift-off' :
          'lift-off speed at ' + f(A.tOff, 1) + ' s, then the climb (' + f(A.Tmax / 1000, 1) + ' kN at 25 deg) held at ' +
          f(A.uMin * 3.6, 0) + ' km/h or more') + (A.ok ? '  - LAUNCHES' : '  - DOES NOT LAUNCH')); }
  }
  return { def, R };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
  const key = opt('key'), out = opt('out'), save = opt('save');
  const file = key ? null : argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
  if (!key && !file) { console.error('usage: node tools/car_sheet.js <--key <card> | build.json> [--out sheet.json] [--no-drive]'); process.exit(2); }
  const BJ = require(path.join(T, '_bake_joined.js'));
  const { C } = BJ.loadPanel();
  let bj;
  if (key) { bj = BJ.bakeCard(key); if (!bj) { console.error('no card ' + key); process.exit(2); } }
  else { const raw = JSON.parse(fs.readFileSync(file, 'utf8')); bj = BJ.bakeJoined(raw.spec || raw); }
  if (save && key) {
    const { D } = BJ.loadPanel(), a = D.ARCHETYPES.find(x => x.key === key);
    const spec0 = D.designBake(a.sel, a.over);
    const r = require(path.join(T, '_load_build.js')).gameSpecFull({ v: spec0.v, birth: 1, spec: spec0 });
    const env = { what: 'CAR-1 - ' + a.name + ': ' + a.note + ' (tools/car_sheet.js --save; a car: it drives on the ground ' +
                        'vehicle shell, src/cars/car_' + key + '.json, it does not fly)', v: spec0.v, name: a.name, spec: r.spec };
    fs.writeFileSync(path.resolve(save), JSON.stringify(env, null, 1) + '\n');
    console.log('saved ' + save + (r.errors && r.errors.length ? ' (join: ' + r.errors.join(' | ') + ')' : ''));
  }
  if (bj.errors && bj.errors.length) console.log('join: ' + bj.errors.length + ' error(s): ' + bj.errors.slice(0, 2).join(' | '));
  const sheet = sheetFromBake(bj, C, { key: key || path.basename(file, '.json') });
  const tune = tuneFor(sheet);
  const E = sheet.estimates;
  console.log('SHEET    ' + sheet.car + ': wheelbase ' + sheet.wheelbase + ' m, track ' + sheet.track.front + ' / ' + sheet.track.rear +
              ' m, wheels r ' + sheet.wheels.FL.radius + ' m; body ' + (sheet.box.hi[0] - sheet.box.lo[0]).toFixed(2) + ' x ' +
              (sheet.box.hi[2] - sheet.box.lo[2]).toFixed(2) + ' x ' + sheet.box.hi[1].toFixed(2) + ' m (L x W x H)');
  console.log('MASS     ' + E.mass_kg + ' kg = ' + E.ledger.map(([k, v]) => k + ' ' + v).join(' + ') + ' + chassis ' + E.chassis.kg +
              '; CG x ' + E.cg[0] + ' (rear axle ' + sheet.wheels.RL.centre[0] + ', front ' + sheet.wheels.FL.centre[0] + '), y ' + E.cg[1]);
  console.log('ENGINE   ' + sheet.engine.name + ' (' + sheet.engine.type + '): ' + (sheet.engine.powerW / 1000).toFixed(0) + ' kW, ' +
              (tune.drive.P / 1000).toFixed(0) + ' kW at the ' + (sheet.drive === '4wd' ? 'four' : 'rear') + ' wheels');
  if (out) { fs.writeFileSync(path.resolve(out), JSON.stringify(Object.assign({}, sheet, { tune }), null, 1) + '\n'); console.log('wrote ' + out); }
  if (!argv.includes('--no-drive')) driveTest(sheet, tune, console.log);
}

module.exports = { sheetFromBake, tuneFor, driveTest, NOT_A_CAR, CHASSIS, DRIVELINE };
