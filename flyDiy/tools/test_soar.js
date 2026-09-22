// GATE SOAR — the sailplane in the climate's air (K1, 2026-09-22; K3 adds the thermal).
// The motorglider archetype, ENGINE OFF, flown on the pilot's own GLIDE recipe (HDG / TECS / TECS
// with the throttle dead, the sheet's Vbg):
//   S1  STILL AIR   — the flown sink agrees with the sheet's sinkBg (the polar is what the plaque says)
//   S2  THE RIDGE   — 8 m/s (a 20 kt day) onto the analytic world's steepest windward face: a beat
//                     along the band, flown at the sheet's minimum-sink speed with the reversals turned
//                     into wind, GAINS energy height and stays up; the same beat with the terrain term
//                     off is on the ground inside the run (the negative control)
//   S3  THE THERMAL — a summer afternoon: the glider is put in the strongest live column and
//                     circles it at minimum-sink speed, and CLIMBS; the same circle with the
//                     thermals off sinks at the polar's own rate (the negative control)
//
//   tools/_bake_joined.js (the card as the game flies it) + flight_core.js  ->  here
// Run: node tools/test_soar.js [--show]   (contract: one final `GATE SOAR: ...`)
'use strict';
const path = require('path');
const BJ = require('./_bake_joined.js');
BJ.loadPanel();
const C = require('./flight_core.js');
const SHOW = process.argv.includes('--show');

let fails = 0;
const fail = (m) => { console.log('  FAIL ' + m); fails++; };
const ok = (m) => console.log('  ok   ' + m);
const yes = (c, m) => (c ? ok : fail)(m);

// ---- the aeroplane -------------------------------------------------------------------------
const card = BJ.bakeCard('motorglider');
if (card.errors && card.errors.length) console.log('  join errors: ' + card.errors.join('; '));
const def = C.buildGen(card.spec);
const sh = C.genShakedown(def);
const SH = C.machineSheet(def, { shakedown: sh });
console.log(`the motorglider: mass ${SH.mass != null ? SH.mass.toFixed(0) : '?'} kg, Vs ${SH.Vs.toFixed(1)}, Vbg ${SH.Vbg.toFixed(1)} m/s, L/D ${SH.LDbest.toFixed(1)}, sinkBg ${SH.sinkBg.toFixed(2)} m/s, sinkMin ${SH.sinkMin.toFixed(2)}`);

// launch(sim, x, z, y, hdg, V): the aeroplane in the air at the ALTITUDE y (msl) over (x, z) - reset
// that far above the datum, turned onto the heading and set down (placeAtAerodrome's own transform,
// a record with the pose), every node moving at V along the nose
function launch(sim, x, z, y, hdg, V) {
  sim.reset(Math.max(1, y - 1.5));
  C.placeAtAerodrome(sim, { hdg, spawn: [x, z], elev: 0 });
  const c = Math.cos(hdg), s = Math.sin(hdg);
  for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = V * c; sim.v[i * 3 + 1] = 0; sim.v[i * 3 + 2] = V * s; }
}
let WORLD = null;
// fly(windSpec, plan) -> the record. Launched per the plan, engine off, boxed on the pilot's own GLIDE
// combination (TECS on the sheet's Vbg, the throttle dead). The plan's `track(t, x, z)` names the GROUND
// TRACK to hold and the gate hands it straight to the pilot's HDG mode.
//
// MEASURED (K1): the pilot's 'HDG' HOLDS THE GROUND TRACK, not the heading - airLateral steers the
// VELOCITY vector onto targetDir, so in a 13 m/s crosswind the aeroplane settles 29 deg crabbed with
// its track exactly on the command. A crab computed by the gate on top of that doubles the correction
// and walks the aeroplane upwind (it did, 3.4 m/s of it). So: no crab here. The pilot flies the line.
function fly(windSpec, plan) {
  WORLD = C.makeWorld();
  // the DAY first when the plan names one (a thermal day is a day, not a wind:
  // the sun that drives it, the lid that caps it and the sky that marks it all
  // live there), then the wind over it
  if (plan.day) WORLD.setDay(plan.day);
  WORLD.setWind(windSpec);
  const sim = C.makeSim(def, WORLD);
  launch(sim, plan.x, plan.z, plan.y, plan.hdg0, plan.V);
  sim.setEngine(0, { key: 'off' });
  const ap = C.makePilot(sim, def, WORLD, { shakedown: sh });
  const tec = { ias: plan.V, vs: -(plan.sink || SH.sinkBg), alt: null, gs: null, vsUp: null, vsDn: null, deadThr: true, bank: plan.bank || 0.35 };
  ap.engage({ lat: 'HDG', vert: 'TECS', thr: 'TECS' }, Object.assign({ hdg: plan.hdg0 }, tec));
  const rec = { t: [], y: [], vs: [], V: [], e: [], x: [], z: [], wy: [], nan: false };
  const T = plan.T, dt = 1 / 60;
  for (let k = 0; k < T * 60; k++) {
    const t = k * dt, o = sim.out, m = ap._m;
    if (k % 15 === 0 && plan.track && m) ap.select({ hdg: Math.atan2(plan.track(t, m.x, m.z)[1], plan.track(t, m.x, m.z)[0]) });
    ap.update(dt); sim.step(dt);
    if (sim.stats().bad) { rec.nan = true; break; }
    if (k % 60 === 0 && m) {
      const y = o.alt != null ? o.alt : 0, V = o.V || 0;
      rec.t.push(t); rec.y.push(y); rec.vs.push(o.vs || 0); rec.V.push(V); rec.e.push(y + V * V / (2 * 9.81));
      rec.x.push(m.x); rec.z.push(m.z); rec.wy.push(o.windY || 0);
      if (SHOW && k % 600 === 0) console.log(`    t ${t.toFixed(0).padStart(4)} at ${m.x.toFixed(0)},${m.z.toFixed(0)} y ${y.toFixed(0)} vs ${(o.vs || 0).toFixed(2)} V ${V.toFixed(1)} wind ${(o.windX || 0).toFixed(1)}/${(o.windY || 0).toFixed(2)}/${(o.windZ || 0).toFixed(1)} ${ap.status && ap.status.goal}`);
    }
  }
  return rec;
}
const mean = (a, i0, i1) => { let s = 0, n = 0; for (let i = i0; i < Math.min(i1, a.length); i++) { s += a[i]; n++; } return n ? s / n : NaN; };

// ---- S1. still air --------------------------------------------------------------------------
console.log('S1. still air');
{
  const r = fly(null, { x: -2000, z: 0, y: 800, V: SH.Vbg, hdg0: 0, T: 75 });
  const vs = mean(r.vs, 15, 75);
  yes(!r.nan, 'the sim stays finite');
  yes(Math.abs(vs + SH.sinkBg) < 0.25 * SH.sinkBg, `flown sink ${(-vs).toFixed(2)} m/s at ${mean(r.V, 15, 75).toFixed(1)} m/s vs the sheet's ${SH.sinkBg.toFixed(2)} (within 25 %)`);
}

// ---- S2. the ridge ----------------------------------------------------------------------------
console.log('S2. the ridge');
{
  // the steepest windward face for a west wind, from the climate's own raster
  const W0 = C.makeWorld(); W0.setWind({ mps: 10, dirDeg: 270, refH: 10, terrain: 1 });
  const R = W0.climate.relief, CH = C.CLIMATE.CH;
  let best = null;
  for (let k = 0; k < R.nx * R.nz; k++) {
    const i = k % R.nx, j = Math.floor(k / R.nx);
    if (i < 6 || j < 6 || i >= R.nx - 6 || j >= R.nz - 6) continue;            // not at the world's edge
    const g = R.data[k * R.NCH + CH.gxc] + R.data[k * R.NCH + CH.gxf];
    if (!best || g > best.g) best = { k, g, i, j };
  }
  const fx = R.x0 + (best.i + 0.5) * R.cell, fz = R.z0 + (best.j + 0.5) * R.cell;
  // the crest: walk east (downwind) up the coarse band to its top
  let cx = fx, cz = fz, ch = W0.terrainH(fx, fz);
  for (let s = 100; s <= 1500; s += 100) { const h = W0.terrainH(fx + s, fz); if (h > ch) { ch = h; cx = fx + s; } else break; }
  const gf = W0.terrainH(fx, fz);
  console.log(`  the face at (${fx.toFixed(0)}, ${fz.toFixed(0)}) slope ${best.g.toFixed(3)}, ground ${gf.toFixed(0)} m, the crest ${(cx - fx).toFixed(0)} m east at ${ch.toFixed(0)} m`);
  // the lift's core at crest height: the best (x, z) on the face for the line
  // THE BAND. Ridge lift is strongest CLOSE to the slope (the local band decays over 80 m, the fine
  // over 200), so a ridge pilot works a line a hundred metres or so off the face, not the air above the
  // crest. The gate finds the best point at 80 m AGL on the windward face and flies the beat there.
  let core = null;
  const sm = [0, 0, 0];
  W0.setWind({ mps: 8, dirDeg: 270, refH: 10, terrain: 1 });
  for (let x = cx - 900; x <= cx - 150; x += 50) for (let z = fz - 700; z <= fz + 700; z += 50) {
    const g = W0.terrainH(x, z);
    W0.climate.sample(x, g + 80, z, 0, sm);
    if (!core || sm[1] > core.wy) core = { x, z, g, wy: sm[1] };
  }
  const Y0 = core.g + 120;
  const bandAt = (z, y) => { W0.climate.sample(core.x, y, z, 0, sm); return sm[1]; };
  console.log(`  the band at 80 m over the face: (${core.x.toFixed(0)}, ${core.z.toFixed(0)}) ground ${core.g.toFixed(0)} m, ${core.wy.toFixed(2)} m/s in the 8 m/s ridge day; the beat flies it at ${Y0.toFixed(0)} m (${bandAt(core.z, Y0).toFixed(2)} m/s there against ${SH.sinkBg.toFixed(2)} of sink)`);
  // THE BEAT: north and south along the band, which runs ~800 m. EVERY REVERSAL COSTS GROUND: a 180 deg
  // turn takes ~25 s and the wind carries the glider ~300 m downwind through it, over the crest and into
  // the sink if nothing answers. So the leg's track leans INTO the wind in proportion to how far downwind
  // the aeroplane has been carried (up to 45 deg) - which is what a ridge pilot does, and why a beat is
  // flown leaning on the slope rather than as a straight line.
  // EVERY REVERSAL IS FLOWN INTO THE WIND, AWAY FROM THE HILL - the ridge pilot's rule, and here a
  // measured necessity: a 180 deg turn takes ~25 s and a downwind one carries the glider ~300 m into
  // the rising ground (it flew into the face three times before the turn was written this way). So the
  // end of a leg commands a WEST track for 12 s, which the wind pays for, and the new leg starts from
  // upwind. Between the turns the leg leans back onto the line in proportion to the drift.
  const LEG = 450, TURN = 12;
  let dir = -1, turnT = -1;                                                    // -z (north) first
  const track = (t, x, z) => {
    if (turnT >= 0) { if (t - turnT < TURN) return [-1, 0]; turnT = -1; }
    if ((dir < 0 && z < core.z - LEG) || (dir > 0 && z > core.z + LEG)) { dir = -dir; turnT = t; return [-1, 0]; }
    const back = Math.max(-1, Math.min(1, -(x - core.x) / 120));
    const ux = back, uz = dir, m = Math.hypot(ux, uz);
    return [ux / m, uz / m];
  };
  // 8 m/s at 10 m is a 20 kt ridge day (the surface layer's law lifts it to 12 m/s at the band), which a
  // 15:1 glider at 21 m/s can beat into with something in hand
  // THE SPEED TO FLY: in lift a soaring pilot slows toward minimum sink, and the beat is flown at the
  // sheet's Vms (0.76 Vbg) - fast enough to penetrate this wind across the ridge, and 0.16 m/s of sink
  // cheaper than best glide, which is most of the margin on a band like this one
  const plan = { x: core.x, z: core.z, y: Y0, V: SH.Vms, sink: SH.sinkMin, hdg0: -Math.PI / 2, track, T: 260, bank: 0.45 };
  const RIDGE_W = { mps: 8, dirDeg: 270, refH: 10, terrain: 1, gust: 0 };
  dir = -1; turnT = -1; const ridge = fly(RIDGE_W, plan);
  dir = -1; turnT = -1; const calm = fly(Object.assign({}, RIDGE_W, { terrain: 0 }), plan);
  const eR0 = mean(ridge.e, 20, 30), eR1 = mean(ridge.e, 245, 260), eC0 = mean(calm.e, 20, 30), eC1 = mean(calm.e, 245, 260);
  yes(!ridge.nan && !calm.nan, 'both runs stay finite');
  yes(eR1 - eR0 >= 0, `on the ridge the energy height goes ${eR0.toFixed(0)} -> ${eR1.toFixed(0)} m over 230 s (${(eR1 - eR0).toFixed(0)} m, mean vs ${mean(ridge.vs, 20, 260).toFixed(2)}, mean updraft ${mean(ridge.wy, 20, 260).toFixed(2)})`);
  // THE NEGATIVE CONTROL is flown on the same beat with the terrain term off: the same wind, the same
  // turns, no slope. It has only its launch height to spend (120 m over the face), so the test is that
  // it spends it - on the ground inside the run, having lost at least 60 m of energy height.
  const cEnd = calm.y[calm.y.length - 1];
  yes(cEnd - core.g < 30 && eC1 - eC0 < -60,
      `with the terrain term off it goes ${eC0.toFixed(0)} -> ${eC1.toFixed(0)} m (${(eC1 - eC0).toFixed(0)} m, mean vs ${mean(calm.vs, 20, 260).toFixed(2)}) and is down at ${cEnd.toFixed(0)} m, on the face's own ${core.g.toFixed(0)}`);
  const yEnd = ridge.y[ridge.y.length - 1];
  yes(yEnd > core.g + 60, `and it is still flying the face (${yEnd.toFixed(0)} m, the ground under it ${core.g.toFixed(0)})`);
}

// ---- S3. the thermal ---------------------------------------------------------------------------
console.log('S3. the thermal');
{
  // A SUMMER AFTERNOON: a mixed layer to 1800 m under a light lid, cumulus at a
  // third cover, and almost no wind - the day a glider pilot waits for.
  const DAY = { date: '2026-06-21', localHours: 14, oatC: 24, dewC: 9,
                lapse: 'mixed', mixH: 1800, cloudCover: 0.35, cloudType: 'cu', cloudSeed: 3 };
  // CALM AIR, and deliberately: a thermal drifts with the wind and a glider
  // circling it drifts with it too, but the pilot's lateral law holds a GROUND
  // track, so a commanded circle stands still while the column walks away (4 kt
  // at circuit height is 650 m over this run - measured, and it left the glider
  // in dead air). Thermalling in a wind is re-centring, which is the pilot's
  // work, not the field's; S2 already flies the field in 20 kt.
  const WIND = { kts: 0, dirDeg: 0, refH: 10, thermals: 1 };
  const W0 = C.makeWorld();
  W0.setDay(Object.assign({ wind: WIND }, DAY));
  const cl = W0.climate;
  // the strongest column within reach of the home strip, and the height to work it at
  const th = cl.thermals(0, 0, 12000);
  if (!th.length) { fail('no thermal on a summer afternoon'); } else {
    const t = th[0];
    const Y0 = t.ground + 0.35 * t.zi;                    // low in the layer, where the core is strongest
    const s3 = [0, 0, 0];
    cl.sample(t.x, Y0, t.z, 0, s3);
    console.log(`  the column at (${t.x.toFixed(0)}, ${t.z.toFixed(0)}) tops at ${t.top.toFixed(0)} m, peaks ${t.wpk.toFixed(2)} m/s;` +
                ` ${s3[1].toFixed(2)} m/s where the glider is put in, against ${SH.sinkMin.toFixed(2)} of sink at Vms`);
    // THE CIRCLE. A glider centres a thermal by flying a steady banked turn, so
    // the gate flies one: the track is rotated at the rate that bank and speed
    // give (g tan(phi) / V), about the column's own axis. 45 deg at Vms is a
    // 40 m radius, well inside a 130 m core - which is what centring means.
    const bank = 0.72;                                     // rad, a working thermalling bank (41 deg)
    const Vc = SH.Vms;
    const Rturn = Vc * Vc / (9.80665 * Math.tan(bank));
    // AN ORBIT LAW, not a rotating heading. A commanded track that simply turns
    // at the bank's rate is open loop: the small errors integrate and the
    // aeroplane spirals off the column (measured: 272 m off a 128 m core). What
    // a pilot actually does is RE-CENTRE - fly the tangent, and lean in or out
    // by how far off the radius you are. That is this, and it holds the circle
    // wherever the aeroplane can fly it.
    // CHASE A POINT THAT KEEPS MOVING AHEAD. The tangent alone will not do it:
    // the pilot's lateral law NULLS the track error, so the moment the aeroplane
    // is flying the tangent it stops banking and leaves the circle straight
    // (measured: 8 deg of bank and a 181 m radius where 41 deg and 29 m were
    // asked). A point a fixed angle ahead ON the circle always leaves an error
    // to chase, and chasing it IS the turn.
    const LEAD = 1.0;                                      // rad ahead on the circle (57 deg)
    const circle = () => (tt, x, z) => {
      const dx = x - t.x, dz = z - t.z;
      const a = Math.atan2(dz, dx) + LEAD;
      const gx = t.x + Rturn * Math.cos(a), gz = t.z + Rturn * Math.sin(a);
      const ux = gx - x, uz = gz - z, m = Math.max(1e-6, Math.hypot(ux, uz));
      return [ux / m, uz / m];
    };
    const plan = { x: t.x + Rturn, z: t.z, y: Y0, V: Vc, sink: SH.sinkMin, day: DAY,
                   hdg0: Math.PI / 2, track: circle(), T: 200, bank };
    console.log(`  circling at ${(bank * 180 / Math.PI).toFixed(0)}° and ${Vc.toFixed(1)} m/s: a ${Rturn.toFixed(0)} m radius inside a ${t.r2.toFixed(0)} m core`);
    const lift = fly(WIND, plan);
    const flat = fly(Object.assign({}, WIND, { thermals: 0 }), plan);
    const vL = mean(lift.vs, 20, 200), vF = mean(flat.vs, 20, 200);
    const wL = mean(lift.wy, 20, 200);
    const off = lift.t.map((_, i) => Math.hypot(lift.x[i] - t.x, lift.z[i] - t.z));
    const offMax = Math.max.apply(null, off.slice(10));
    yes(!lift.nan && !flat.nan, 'both runs stay finite');
    yes(offMax < 2 * t.r2, `it stays on the column: never more than ${offMax.toFixed(0)} m off its axis (the core is ${t.r2.toFixed(0)})`);
    yes(vL > 0.4, `in the thermal it climbs ${vL.toFixed(2)} m/s (the air under it averaging ${wL.toFixed(2)})`);
    yes(vF < -0.6, `with the thermals off the same circle sinks ${vF.toFixed(2)} m/s - a banked turn's own polar`);
    yes(vL - vF > 1.2, `the column is worth ${(vL - vF).toFixed(2)} m/s of climb`);
    // IT GOES UP, and that is the whole claim. The margin is modest because the
    // circle is not centred (it wanders 170 m about a 128 m core, so a third of
    // every turn is spent in the sink ring) and because a 41 deg turn costs
    // about 0.9 m/s over the wings-level polar - both of them real, and both of
    // them the reason a soaring pilot's first skill is centring. The control
    // flying the identical circle in the same air with the columns switched off
    // loses 420 m over the same run.
    const gain = lift.y[lift.y.length - 1] - lift.y[0];
    const lost = flat.y[flat.y.length - 1] - flat.y[0];
    yes(gain > 25 && gain - lost > 300,
        `and it GAINS ${gain.toFixed(0)} m in ${plan.T} s (${lift.y[0].toFixed(0)} -> ${lift.y[lift.y.length - 1].toFixed(0)}) where the same circle without the columns loses ${(-lost).toFixed(0)}`);
    // THE NETTO VARIOMETER: what the air is doing, with the glider's own sink
    // added back. In the core it must read the air, not the climb.
    if (SH.sinkAt) {
      // A VARIOMETER IS AN AVERAGE. The instantaneous reading carries the
      // aeroplane's own pitching and the turn's load factor (the polar is a
      // wings-level curve), which is exactly why a soaring pilot flies the
      // 20-second mean - so that is what is held here, with the spread printed.
      let dMean = 0, worst = 0, n = 0;
      for (let i = 30; i < lift.t.length; i++) {
        const d = (lift.vs[i] + SH.sinkAt(lift.V[i])) - lift.wy[i];
        dMean += d; worst = Math.max(worst, Math.abs(d)); n++;
      }
      dMean /= Math.max(1, n);
      yes(Math.abs(dMean) < 0.8, `the netto vario reads the AIR to ${dMean.toFixed(2)} m/s of the field itself on the mean of ${n} samples (the instantaneous spread ${worst.toFixed(2)}: a turn's load factor is not on a wings-level polar)`);
    } else fail('the sheet has no polar to read a netto from');
  }
}

console.log(`GATE SOAR: ${fails ? 'FAIL (' + fails + ' check' + (fails > 1 ? 's' : '') + ')' : 'PASS'}`);
process.exit(fails ? 1 : 0);
