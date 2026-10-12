#!/usr/bin/env node
// GATE VEHICLE (G2940 GROUND-VEHICLE, 2026-10-11) - the ground vehicle's physics spike, node only.
// src/vehicle/vehicle.js (the shell) + src/vehicle/vehicle_drive.js (the driver) on src/cars/car_conquer.json, the
// feasibility study's acceptance list adapted (futureDesigns/GROUND-VEHICLE-2026-10.md §6):
//   DEF       the sheet -> the generic definition: geometry, the static loads, parked on the flat it does not move
//   ACCEL     0-100 km/h, the speed at 40 s of full throttle (the power curve)
//   COAST     the throttle closed from 25 m/s: the air, the rolling, the engine's drag
//   BRAKE     full brake from 100 km/h: the distance, straight
//   REVERSE   the reverse gear: backward, capped by its gear
//   AIRBORNE  no drive force from a wheel off the ground: dropped at full throttle; the driven axle over a ledge
//   TURN      full lock both ways: the kerb-to-kerb turning circle, symmetric, Ackermann (inner > outer)
//   HILL      a 10 % grade: parked on the brake it holds; released it rolls; a hill start (the driver's pedals)
//             with no roll-back; downhill from 15 m/s, braked to a stop that holds
//   ROAD      a 300 m curved road (a traced road's 2.5 m vertices) followed: the cross-track, the stop
//   UTURN     re-routed back while driving out: a U-turn at a gravel apron, the body inside the road + apron at
//             every frame, ending facing back - a 3 m road (nose-in) and a 6 m road, the apron on the left (back-in)
//   LONG      the MVP's drive: one of the world's roads (makeWorld().roadNet, ~4 km, graded, gravel) out, a new
//             destination behind (re-routed via the apron ahead), home, then out again to the far end; the road
//             sampled in windows (GP_MAXPTS)
//   FORD      the world's road 0 fords a stream: the profile slows for it, and the driver crosses or says STUCK
//   TRAPS     the two reasons the road has its own sampler: patternPath's 2 deg dots (a traced road's chords) and
//             GP_MAXPTS (a long road resampled coarse), measured
//   BITS      the aeroplane untouched: the vehicle is not in MANIFEST.core and the core is fresh from src/core
// Every row prints its numbers; the verdict is the last line. ~13 s.
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const V = require(path.join(ROOT, 'src/vehicle/vehicle.js'));
const Dr = require(path.join(ROOT, 'src/vehicle/vehicle_drive.js'));
const SHEET = require(path.join(ROOT, 'src/cars/car_conquer.json'));
const def = V.vehicleDef(SHEET);
const DT = 1 / 60;
let fails = 0;
const row = (id, ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + id.padEnd(9) + ' ' + msg); if (!ok) fails++; };
const f = (x, n = 2) => (+x).toFixed(n);
const flat = { terrainH: () => 0 };
const run = (car, s, fn) => { for (let t = 0; t < s; t += DT) { if (fn && fn(t) === false) break; car.step(DT); } };
const mk = (world, x = 0, z = 0, h = 0) => { const c = V.makeVehicle(def, world); c.place(x, z, h); run(c, 0.5); return c; };

// ---- DEF ----
{
  const Wsum = def.wheels.reduce((s, w) => s + w.Wst, 0), front = def.wheels.filter(w => w.steer).reduce((s, w) => s + w.Wst, 0) / Wsum;
  const car = mk(flat), p0 = car.refPoint(); run(car, 2); const p1 = car.refPoint();
  const drift = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const ok = Math.abs(def.wb - 3.01) < 1e-9 && Math.abs(def.track - 1.41) < 1e-9 && def.wheels.every(w => w.r === 0.35) && def.mass === 1850 &&
    Math.abs(Wsum - def.mass * 9.81) < 1e-6 && Math.abs(front - 0.56) < 0.005 && drift < 1e-3 && car.out.onGround === 4 &&
    def.wheels.filter(w => w.drive).map(w => w.id).join() === 'RL,RR' && def.wheels.filter(w => w.steer).map(w => w.id).join() === 'FL,FR';
  row('DEF', ok, 'wb ' + def.wb + ' m, track ' + def.track + ' m, r ' + def.wheels[0].r + ' m, ' + def.mass + ' kg (' + f(100 * front, 1) + ' % front), rMin ' + f(def.rMin) +
    ' m at the rear axle, steer ' + f(def.steer.dMax * 57.2958, 1) + ' deg (bicycle); parked 2 s: ' + f(1000 * drift, 3) + ' mm');
}
// ---- ACCEL / COAST / BRAKE / REVERSE ----
{
  const car = mk(flat); car.ctl.thr = 1; car.ctl.brake = 0;
  let t100 = null, t = 0; run(car, 40, tt => { t = tt; if (t100 == null && car.out.u >= 100 / 3.6) t100 = tt; });
  const v40 = car.out.u;
  row('ACCEL', t100 > 8 && t100 < 16 && v40 > 35 && v40 < 50, '0-100 km/h ' + f(t100, 1) + ' s, ' + f(v40 * 3.6, 0) + ' km/h at 40 s (80 kW at the wheels, F0 7.2 kN)');
  const c2 = mk(flat); c2.st.v = [25, 0, 0]; run(c2, 0.5); const u0 = c2.out.u; c2.ctl.thr = 0; run(c2, 10); const dec = (u0 - c2.out.u) / 10;
  row('COAST', dec > 0.3 && dec < 1.0, 'from ' + f(u0, 1) + ' m/s, the throttle closed: ' + f(dec) + ' m/s2 over 10 s');
  const c3 = mk(flat); c3.st.v = [100 / 3.6, 0, 0]; run(c3, 0.3); const ub = c3.out.u, xb = c3.st.x[0]; c3.ctl.brake = 1; c3.ctl.thr = 0;
  let tb = 0; run(c3, 15, tt => { tb = tt; return c3.out.u > 0.02; });
  const db = c3.st.x[0] - xb;
  row('BRAKE', db > 36 && db < 60 && Math.abs(c3.st.x[2]) < 0.1 && Math.abs(c3.heading()) < 0.01,
    'from ' + f(ub * 3.6, 0) + ' km/h: ' + f(db, 1) + ' m in ' + f(tb) + ' s (' + f(ub * ub / 2 / db / 9.81) + ' g), ' + f(Math.abs(c3.st.x[2]) * 1000, 0) + ' mm off the line');
  const c4 = mk(flat); c4.ctl.gear = -1; c4.ctl.thr = 1; c4.ctl.brake = 0; run(c4, 8);
  row('REVERSE', c4.out.u < -5 && c4.out.u > -def.drive.vRev - 0.01 && c4.st.x[0] < -10, 'full throttle in reverse 8 s: ' + f(c4.out.u) + ' m/s (the gear ' + def.drive.vRev + '), ' + f(c4.st.x[0], 1) + ' m');
}
// ---- AIRBORNE ----
{
  const car = mk(flat); car.st.x[1] += 1.2; car.st.v = [10, 0, 0]; car.ctl.thr = 1; car.ctl.brake = 0;
  let air = 0, dvMax = 0, FdMax = 0; const u0 = car.st.v[0];
  run(car, 0.35, () => { if (car.out.onGround === 0) { air++; FdMax = Math.max(FdMax, Math.abs(car.out.Fdrive)); dvMax = Math.max(dvMax, car.st.v[0] - u0); } });
  // the driven axle over a ledge: the rear wheels hang over a 2 m drop for the first instants
  const ledge = { terrainH: x => x < 0.6 ? -2 : 0 };
  const c2 = V.makeVehicle(def, ledge); c2.place(2.0, 0, 0); c2.ctl.thr = 1; c2.ctl.brake = 0;
  let rearAir = 0, rearFd = 0, frontOn = 0, perWheel = true;
  run(c2, 0.15, () => {
    const W = c2.wheels;
    if (!W[2].on && !W[3].on) { rearAir++; rearFd = Math.max(rearFd, Math.abs(c2.out.Fdrive)); }
    if (W[0].on || W[1].on) frontOn++;
    for (const w of W) if (!w.on && w.Fd !== 0) perWheel = false;
  });
  row('AIRBORNE', air > 10 && FdMax === 0 && dvMax < 0.01 && rearAir > 3 && rearFd === 0 && frontOn > 3 && perWheel,
    'dropped at full throttle: ' + air + ' frames off the ground, drive ' + FdMax + ' N, dv ' + f(dvMax * 1000, 1) + ' mm/s; the rear axle over a ledge: ' + rearAir + ' frames, drive ' + rearFd + ' N (the fronts on: ' + frontOn + ')');
}
// ---- TURN ----
{
  const res = [];
  for (const sg of [1, -1]) {
    const car = mk(flat); car.ctl.steer = sg; const P = [], O = [];
    const oi = sg > 0 ? 0 : 1, ow = def.wheels[oi];
    run(car, 30, t => {
      const u = car.out.u; car.ctl.thr = Math.max(0, Math.min(1, 0.25 + 0.6 * (2.5 - u))); car.ctl.brake = u > 3 ? 0.2 : 0;
      if (t > 10) { P.push(car.refPoint()); O.push(car.toWorld([ow.at[0], def.ground, ow.at[2] + Math.sign(ow.at[2]) * ow.width / 2])); }
    });
    const fit = Q => { let cx = 0, cz = 0; for (const p of Q) { cx += p[0]; cz += p[2]; } cx /= Q.length; cz /= Q.length; let r = 0; for (const p of Q) r += Math.hypot(p[0] - cx, p[2] - cz); return [cx, cz, r / Q.length]; };
    const A = fit(P), B = fit(O);
    const dl = car.wheels.map(w => w.delta * 57.2958);
    res.push({ sg, rRef: A[2], kerb: 2 * B[2], side: Math.sign(A[1]), inner: Math.abs(dl[sg > 0 ? 1 : 0]), outer: Math.abs(dl[sg > 0 ? 0 : 1]) });
  }
  const [R, L] = res;
  row('TURN', R.kerb > 11.5 && R.kerb < 14 && Math.abs(R.kerb - L.kerb) < 0.1 && R.side === 1 && L.side === -1 && R.inner > R.outer + 3 && Math.abs(R.rRef - def.rMin) < 0.3,
    'full lock at 2.5 m/s: kerb-to-kerb ' + f(R.kerb) + ' m right, ' + f(L.kerb) + ' m left; the rear axle on ' + f(R.rRef) + ' m (kinematic ' + f(def.rMin) +
    '); inner ' + f(R.inner, 1) + ' deg, outer ' + f(R.outer, 1) + ' deg (Ackermann)');
}
// ---- HILL ----
{
  const grade = { terrainH: x => 0.1 * x };   // + x uphill: a 10 % grade
  const car = mk(grade); car.ctl.brake = 1; car.ctl.thr = 0; run(car, 1);
  const p0 = car.refPoint(); run(car, 10); const p1 = car.refPoint(); const hold = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
  car.ctl.brake = 0; run(car, 1); const rolled = car.out.u;
  // the hill start, on the driver's pedals: from rest on the brake to 5 m/s up the grade
  const c2 = mk(grade); c2.ctl.brake = 1; run(c2, 1); const x0 = c2.refPoint()[0];
  let xMin = x0, t5 = null; const Sx = {};
  run(c2, 12, t => { const ped = Dr.vehPedals(c2, 1, c2.out.u, 5, Sx, DT, {}); c2.ctl.thr = ped.thr; c2.ctl.brake = ped.brake; c2.ctl.gear = 1;
    xMin = Math.min(xMin, c2.refPoint()[0]); if (t5 == null && c2.out.u > 4.9) t5 = t; });
  const back = x0 - xMin;
  // downhill: from 15 m/s down the grade, full brake, stopped; then held
  const c3 = mk(grade, 0, 0, Math.PI); c3.st.v = [-15 * 0.995, -1.5 * 0.995, 0]; run(c3, 0.3);
  const xs = c3.refPoint()[0]; c3.ctl.brake = 1; c3.ctl.thr = 0; let ts = 0; run(c3, 10, t => { ts = t; return Math.abs(c3.out.u) > 0.01; });
  const dStop = xs - c3.refPoint()[0]; const q0 = c3.refPoint(); run(c3, 10); const q1 = c3.refPoint(); const hold2 = Math.hypot(q1[0] - q0[0], q1[2] - q0[2]);
  row('HILL', hold < 0.005 && rolled < -0.3 && back < 0.10 && t5 != null && t5 < 8 && dStop > 12 && dStop < 30 && hold2 < 0.005,
    '10 % up: parked ' + f(hold * 1000, 2) + ' mm in 10 s, released ' + f(rolled) + ' m/s after 1 s; hill start ' + f(back * 1000, 0) + ' mm back, 5 m/s in ' + f(t5, 1) +
    ' s; down from 15 m/s: stopped in ' + f(dStop, 1) + ' m (' + f(ts, 1) + ' s), held ' + f(hold2 * 1000, 2) + ' mm in 10 s');
}
// ---- ROAD: 300 m, a traced road's dense vertices (2.5 m), curves of 60 m and 40 m ----
function curvedRoad() {
  const P = [[0, 0]]; let x = 0, z = 0, h = 0, s = 0;
  for (const [L, k] of [[40, 0], [60 * 70 * Math.PI / 180, -1 / 60], [30, 0], [40 * 100 * Math.PI / 180, 1 / 40], [1000, 0]])
    for (let d = 0; d < L - 1e-9 && s < 300 - 1e-9; d += 0.25) { h += k * 0.25; x += Math.cos(h) * 0.25; z += Math.sin(h) * 0.25; s += 0.25; if (Math.abs(s / 2.5 - Math.round(s / 2.5)) < 1e-6) P.push([x, z]); }
  return P;
}
{
  const pts = curvedRoad();
  const G = Dr.vehRoadGraph({ roads: [{ pts, w: 6 }], places: [{ id: 'A', road: 0, s: 5, kind: 'stop' }, { id: 'B', road: 0, s: 295, kind: 'stop' }] });
  const car = mk(flat, pts[2][0] + (def.cg[0] - def.steer.xRef), pts[2][1], 0);
  const D = Dr.makeDriver(car, G, { vCruise: 15 });
  const r0 = D.setDest('B');
  let t = 0, vMax = 0; run(car, 60, tt => { t = tt; D.step(DT); vMax = Math.max(vMax, car.out.u); return D.phase !== 'ARRIVED'; });
  const p = car.refPoint(), endErr = Math.hypot(p[0] - G.places.B.x, p[2] - G.places.B.z), S = D.stats, rms = Math.sqrt(S.xtSq / S.xtN);
  row('ROAD', r0 === 'replan' && D.phase === 'ARRIVED' && S.xtMax < 0.5 && rms < 0.25 && endErr < 0.3 && t < 45,
    '290 m (R 60 m, R 40 m): ' + f(t, 1) + ' s, ' + f(vMax, 1) + ' m/s at most; cross-track ' + f(S.xtMax) + ' m max, ' + f(rms) + ' m rms; stopped ' + f(endErr) + ' m from B');
}
// ---- UTURN ----
function uturnCase(W, DEP, SIDE) {
  const ap = { x0: 40, x1: 60, z0: SIDE > 0 ? W / 2 : -W / 2 - DEP, z1: SIDE > 0 ? W / 2 + DEP : -W / 2 };
  const inRoad = (x, z) => Math.abs(z) <= W / 2 && x >= -100 && x <= 200;
  const inApron = (x, z) => x >= ap.x0 && x <= ap.x1 && z >= ap.z0 && z <= ap.z1;
  const world = { terrainH: () => 0, surface: (x, z) => inApron(x, z) ? 6 : inRoad(x, z) ? 5 : 0 };
  const G = Dr.vehRoadGraph({ roads: [{ pts: [[-100, 0], [200, 0]], w: W }],
    places: [{ id: 'S', road: 0, s: 20, kind: 'stop' }, { id: 'U', road: 0, s: 150, kind: 'apron', side: SIDE, len: 20, depth: DEP }, { id: 'E', road: 0, s: 290, kind: 'stop' }] });
  const car = mk(world, -80 + (def.cg[0] - def.steer.xRef), 0, 0);
  const D = Dr.makeDriver(car, G, { vCruise: 12 });
  const r0 = D.setDest('E');
  let r1 = null, t = 0, worst = 0;
  run(car, 200, tt => {
    t = tt;
    if (r1 == null && car.refPoint()[0] > 0) r1 = D.setDest('S');
    D.step(DT);
    for (const [x, z] of car.footprint()) if (!(inRoad(x, z) || inApron(x, z))) {
      const d = Math.min(Math.max(Math.abs(z) - W / 2, 0), Math.max(ap.x0 - x, x - ap.x1, ap.z0 - z, z - ap.z1, 0)); worst = Math.max(worst, d || 1e-6);
    }
    return D.phase !== 'ARRIVED';
  });
  const p = car.refPoint(), fam = (D.log.find(l => l.what === 'uturn') || {}).msg || '';
  return { r0, r1, t, worst, arrived: D.phase === 'ARRIVED', hdgErr: Math.abs(V.vehWrapPi(car.heading() - Math.PI)),
           at: Math.hypot(p[0] - G.places.S.x, p[2] - G.places.S.z), fam: fam.split(' ')[0], moves: (fam.match(/(\d+) moves/) || [])[1], manXt: D.stats.manXt };
}
// a new To behind while PARKED at an apron (just short of its centre, and just past it - the vehicle came from the
// neighbour behind it either way): the U-turn there, home
function parkedCase(off) {
  const G = Dr.vehRoadGraph({ roads: [{ pts: [[-100, 0], [200, 0]], w: 6 }], places: [{ id: 'S', road: 0, s: 20, kind: 'stop' }, { id: 'U', road: 0, s: 150, kind: 'apron', side: 1, len: 20, depth: 5 }] });
  const car = mk(flat, 50 + off + (def.cg[0] - def.steer.xRef), 0, 0), D = Dr.makeDriver(car, G, { vCruise: 10 });
  const r = D.setDest('S'); let t = 0; run(car, 120, tt => { t = tt; D.step(DT); return D.phase !== 'ARRIVED' && D.phase !== 'IDLE'; });
  return r === 'uturn' && D.phase === 'ARRIVED' && D.stats.uturns === 1;
}
{
  const A = uturnCase(3, 9, 1), B = uturnCase(6, 5, -1), parked = [-0.3, 2.5].map(parkedCase);
  const ok = c => c.r0 === 'replan' && c.r1 === 'uturn' && c.arrived && c.worst === 0 && c.hdgErr < 3 / 57.3 && c.at < 0.3;
  const say = (n, c) => n + ': re-routed "' + c.r1 + '", ' + c.fam + ' (' + c.moves + ' moves, tracked within ' + f(c.manXt * 100, 0) + ' cm), body outside the road + apron ' +
    f(c.worst, 3) + ' m, home in ' + f(c.t, 1) + ' s facing ' + f(180 - c.hdgErr * 57.3, 1) + ' deg back, ' + f(c.at) + ' m from S';
  row('UTURN', ok(A) && ok(B) && A.fam === 'nose-in' && B.fam === 'back-in' && parked.every(Boolean), say('3 m road + 9 m apron right', A) + ' | ' + say('6 m road + 5 m apron left', B) +
    ' | parked 0.3 m short of / 2.5 m past an apron, a To behind: ' + parked.map(b => b ? 'U-turn, home' : 'FAILED').join(' / '));
}
// ---- LONG: one of the world's roads, out and back and out ----
{
  const t0 = Date.now();
  const C = require(path.join(ROOT, 'tools/flight_core.js'));
  const world = C.makeWorld();
  const rd = world.roadNet.roads[0];
  let len = 0; for (let i = 1; i < rd.pts.length; i++) len += Math.hypot(rd.pts[i][0] - rd.pts[i - 1][0], rd.pts[i][1] - rd.pts[i - 1][1]);
  // three aprons: home's, one on the way, the far end's - all before the road's first FORD (s 2 696 m: the stream's
  // carve is 2.7 m under the road's grade there, 0.4 m of water, 50 % banks 15 m past a 45 deg corner; met at the
  // corner's speed the pickup slid down the bank and stalled - the world's finding, GROUND-VEHICLE-2026-10.md §7)
  const G = Dr.vehRoadGraph({ roads: [{ pts: rd.pts, w: 7 }], places: [
    { id: 'HOME', road: 0, s: 60, kind: 'apron', side: 1, len: 20, depth: 5 },
    { id: 'MID', road: 0, s: 1300, kind: 'apron', side: -1, len: 20, depth: 5 },
    { id: 'END', road: 0, s: 2600, kind: 'apron', side: 1, len: 20, depth: 5 }] });
  const H = G.places.HOME, h0 = Math.atan2(H.dz, H.dx);
  const car = V.makeVehicle(def, world); car.place(H.x + H.dx * (def.cg[0] - def.steer.xRef), H.z + H.dz * (def.cg[0] - def.steer.xRef), h0); run(car, 0.5);
  const D = Dr.makeDriver(car, G, { vCruise: 20 });
  const ev = [D.setDest('END')];
  let t = 0, phaseB = 0, vMax = 0, dist = 0, prev = car.refPoint(), proxy = 0;
  run(car, 1500, tt => {
    t = tt;
    const p = car.refPoint(); dist += Math.hypot(p[0] - prev[0], p[2] - prev[2]); prev = p;
    if (phaseB === 0 && dist > 800) { ev.push(D.setDest('HOME')); phaseB = 1; }
    if (phaseB === 1 && D.phase === 'ARRIVED') { ev.push(D.setDest('END')); phaseB = 2; }
    D.step(DT); vMax = Math.max(vMax, car.out.u); if (car.out.proxyHit) proxy++;
    return !(phaseB === 2 && D.phase === 'ARRIVED');
  });
  const p = car.refPoint(), E = G.places.END, at = Math.hypot(p[0] - E.x, p[2] - E.z), S = D.stats, rms = Math.sqrt(S.xtSq / S.xtN);
  const arrivals = D.log.filter(l => l.what === 'arrived').length, ut = D.log.filter(l => l.what === 'uturn').map(l => l.msg.split(' ')[0] + ' at ' + l.msg.split(' ')[2].replace(':', ''));
  const ok = ev.join() === 'replan,uturn,uturn' && arrivals === 2 && at < 0.5 && S.uturns === 2 && S.windows > 3 && S.xtMax < 1.5 && rms < 0.3 && proxy === 0;
  row('LONG', ok, 'road 0 of the world (' + f(len, 0) + ' m, the first 2.6 km, ' + rd.pts.length + ' vertices, graded, ' + (world.surface(rd.pts[5][0], rd.pts[5][1]) === 6 ? 'gravel' : 'surface ' + world.surface(rd.pts[5][0], rd.pts[5][1])) + '): ' +
    f(dist / 1000, 2) + ' km in ' + f(t / 60, 1) + ' min (' + f(vMax * 3.6, 0) + ' km/h at most); setDest ' + ev.join(' / ') + '; U-turns ' + ut.join(', ') + '; ' + S.windows +
    ' windows (' + Dr.VD_WIN + ' m); cross-track ' + f(S.xtMax) + ' m max, ' + f(rms) + ' m rms; at END ' + f(at) + ' m; body on the ground ' + proxy + ' frames; ' + f((Date.now() - t0) / 1000, 1) + ' s');
}
// ---- FORD: the world's road 0 fords a stream at s ~2 696 m (§7): taken at the profile's speed, crossed or STUCK said ----
{
  const C = require(path.join(ROOT, 'tools/flight_core.js'));
  const world = C.makeWorld(), rd = world.roadNet.roads[0];
  const G = Dr.vehRoadGraph({ roads: [{ pts: rd.pts, w: 7 }], places: [{ id: 'A', road: 0, s: 2450, kind: 'stop' }, { id: 'B', road: 0, s: 2950, kind: 'stop' }] });
  const A = G.places.A, car = V.makeVehicle(def, world);
  car.place(A.x + A.dx * (def.cg[0] - def.steer.xRef), A.z + A.dz * (def.cg[0] - def.steer.xRef), Math.atan2(A.dz, A.dx)); run(car, 0.5);
  const D = Dr.makeDriver(car, G, { vCruise: 20 }); D.setDest('B');
  let t = 0, proxy = 0, vIn = Infinity, wet = 0;
  run(car, 120, tt => { t = tt; D.step(DT); if (car.out.proxyHit) proxy++;
    const p = car.refPoint(); if (world.waterH(p[0], p[2]) > -1e8) { wet++; vIn = Math.min(vIn, car.out.u); }
    return D.phase === 'DRIVE'; });
  const crossed = D.phase === 'ARRIVED', stuck = D.phase === 'STUCK';
  row('FORD', (crossed && proxy === 0) || (stuck && t < 60),
    'road 0 s 2 450 -> 2 950 across the stream: ' + D.phase + ' at ' + f(t, 1) + ' s (' + (wet ? 'in the water ' + wet + ' frames, ' + f(Math.max(0, vIn), 1) + ' m/s at the least' : 'dry') +
    ', the body on the ground ' + proxy + ' frames) - never a silent stop: the road\'s grade must win at a crossing (world)');
}
// ---- TRAPS: why the road is not sampled by the aeroplane's patternPath (39_ground_path.js, untouched) ----
{
  const C = require(path.join(ROOT, 'tools/flight_core.js'));
  // (1) the 2 deg rule: a traced road's dense vertices (2.5 m) round a gentle curve (R 150 m) bend ~1 deg each, so
  // patternPath sees no corner at all and draws the chord
  const pts = [[0, 0]]; { let x = 0, z = 0, h = 0, s = 0;
    for (const [L, k] of [[30, 0], [150 * 80 * Math.PI / 180, 1 / 150], [60, 0]]) for (let d = 0; d < L - 1e-9; d += 0.25) {
      h += k * 0.25; x += Math.cos(h) * 0.25; z += Math.sin(h) * 0.25; s += 0.25; if (Math.abs(s / 2.5 - Math.round(s / 2.5)) < 1e-6) pts.push([x, z]); } }
  const nodes = pts.map((q, i) => ({ id: 'n' + i, x: q[0], z: q[1], kind: 'taxi' }));
  const PP = C.patternPath({ nodes, fillet: 60 }, nodes.map(n => n.id), 1.0);
  const VP = Dr.vehPath(pts, { w: 6 });
  const off = P => { let m = 0; for (const q of P.pts) { let d = Infinity; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((q.x - a[0]) * dx + (q.z - a[1]) * dz) / l2)); d = Math.min(d, Math.hypot(a[0] + dx * t - q.x, a[1] + dz * t - q.z)); } m = Math.max(m, d); } return m; };
  const kapPP = Math.max(...PP.pts.map(q => Math.abs(q.kap))), offPP = off(PP), offVP = off(VP);
  // (2) GP_MAXPTS: one of the world's long roads as one pattern path - resampled coarser past 4 000 samples
  const world = C.makeWorld(), rd = world.roadNet.roads[3];
  const n3 = rd.pts.map((q, i) => ({ id: 'r' + i, x: q[0], z: q[1], kind: 'taxi' }));
  const P3 = C.patternPath({ nodes: n3, fillet: 30 }, n3.map(n => n.id), 1.0), ds3 = P3.len / (P3.pts.length - 1);
  row('TRAPS', offPP > 1.0 && offVP < 0.1 && kapPP === 0 && ds3 > 2 && P3.pts.length <= 4000,
    'a traced road round R 150 m (2.5 m vertices, ~1 deg each): patternPath (bends < 2 deg are dots) strays ' + f(offPP, 1) + ' m off it, its curvature ' + f(kapPP, 4) + '; vehPath ' + f(offVP, 3) +
    ' m; the world\'s road 3 (' + f(P3.len, 0) + ' m) as one pattern path: ' + P3.pts.length + ' samples at ' + f(ds3) + ' m (GP_MAXPTS) - the driver samples ' + Dr.VD_WIN + ' m windows at 1 m');
}
// ---- BITS ----
{
  const B = require(path.join(ROOT, 'tools/build.js'));
  const notIn = !B.MANIFEST.core.some(n => /vehicle|cars?[_/]/i.test(n));
  const F = require(path.join(ROOT, 'tools/_core_fresh.js')).fresh(path.join(ROOT, 'tools/flight_core.js'));
  row('BITS', notIn && F.ok && F.judged, 'the vehicle is ' + (notIn ? 'not ' : '') + 'in MANIFEST.core; tools/flight_core.js ' + (F.ok ? 'fresh' : 'STALE') + ' from src/core (' + F.header + ') - the aeroplane\'s core is not touched');
}
console.log(fails ? 'GATE VEHICLE: FAIL (' + fails + ' rows)' : 'GATE VEHICLE: PASS');
process.exitCode = fails ? 1 : 0;
