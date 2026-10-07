#!/usr/bin/env node
// PILOT-ONE (G1935): THE TAKE-OFF, TRACED. One take-off per build on THE
// PILOT (43_pilot.js), from the build's own strip (HOME's grass for wheels,
// the SEA lane for floats), sampled every physics step until the aeroplane is
// 2 x hSafe up (or the bound). An instrument, it asserts nothing:
//
//   node tools/pilot_one_trace.js                  -> one summary line per build
//   node tools/pilot_one_trace.js --csv=DIR        -> + a 10 Hz trace per build (DIR/<build>.csv)
//   node tools/pilot_one_trace.js --only=cub,c172f -> a subset
//   node tools/pilot_one_trace.js --wind=3,0,0     -> a wind [x, y, z]
//
// THE NUMBERS (what GATE TAKEOFF's TECHNIQUE section judges):
//   Vr      the airspeed when the pilot first asks the rotation (the first step
//           of ROLL whose pitch target is the lift-off attitude)
//   Vlof    the airspeed at the lift-off: the last time the contacts leave the
//           surface for good (dry / off the wheels for 2 s)
//   lifts   how many times the contacts left the surface (for >= 0.1 s)
//           before the aeroplane was away for good: exactly one is clean;
//           every extra one is a HOP (a skip on the water)
//   hopV    the airspeed of the first lift (a hop before Vr is the user's
//           "hops before taking off")
//   qMax    the largest pitch rate (deg/s, 0.25 s filtered) from the roll to
//           2 x hSafe - the rotation's rate
//   dist    the ground run: brake release (the first ROLL step) to Vlof (m)
//   d15     brake release to 15 m (50 ft) over the surface (m)
//   trim    the attitude at Vr and at Vlof (deg)
//   Vs      the build's shakedown Vs1 (clean) for the ratios
'use strict';
const fs = require('fs'), path = require('path');
const C = require(process.env.CORE || './flight_core.js');   // CORE=<file>: another core (the before / after evidence)
const arg = (k, d) => { const a = process.argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const CSV = arg('csv', null);
const WIND = arg('wind', null) ? arg('wind').split(',').map(Number) : null;
const ROOT = path.join(__dirname, '..');
const loadSpec = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).spec;
const BUILDS = {
  cub:     { file: 'builds/cub_2026-09-20_corrected.json' },
  jodel:   { file: 'builds/jodel_2026-09-20_corrected.json' },
  c172:    { file: 'builds/cessna172_2026-09-20_corrected.json' },
  c172f:   { file: 'builds/cessna172_2026-09-20_corrected.json', floats: true },
  wip:     { file: 'tools/fixtures/build_v10_c172_wipline2350_2026-09-20.json' },
  ultraf:  { file: 'tools/fixtures/build_v7_ultralight_2026-09-05.json', floats: true },
  twinf:   { file: 'tools/fixtures/build_v7_twin_2026-09-04.json', floats: true },
};
const ONLY = arg('only', Object.keys(BUILDS).join(',')).split(',');

function defOf(B) {
  const spec = loadSpec(B.file);
  if (B.floats) spec.gear.type = 'floats';
  return C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
}

function trace(name, opts) {
  opts = opts || {};
  const B = BUILDS[name], def = defOf(B);
  const world = C.makeWorld();
  if (WIND && world.setWind) world.setWind({ base: WIND, gust: 0 });
  const float = !!(def.parts && def.parts.floats);
  const a = float ? world.aerodromes.find(x => x.id === 'SEA') : world.aerodromes[0];
  const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, a);
  const ap = C.makePilot(sim, def, world, opts.pilot || {});
  ap.setRoute(a, a);
  const A = def.params.ap;
  let shake = null; try { shake = C.genShakedown(def); } catch (e) { shake = null; }
  const Vs = shake && (shake.Vs || shake.VsClean || shake.Vs1) || null;
  const dt = 1 / 60;
  const R = { name, float, Vr: null, thVr: null, Vlof: null, thLof: null, lifts: 0, hopV: null, qMax: 0, qMaxAt: null,
              dist: null, d15: null, x0: null, phases: [], away: false, Vs, VRot: A.VRot, liftoffTh: A.liftoffTh, out: null,
              touchAfter: 0, trimMax: -99, trimMin: 99 };
  let T = 0, last = '', off = false, offT = 0, offV = 0, rows = [], qF = 0, thP = null, s0 = null, sAlong = 0;
  const hS = A.hSafe || 10;
  const surfH = (x, z) => float ? world.waterH(x, z) : world.terrainH(x, z);
  let restAGL = null;
  for (let s = 0; s < (opts.maxS || 150) / dt; s++) {
    ap.update(dt);
    if (opts.hook) opts.hook(sim, ap, { T, def, A, Vs });   // an experiment's stick law, after the pilot's
    sim.step(dt); T += dt;
    const cg = sim.cgPos(), v = sim.cgVel(), [xA] = sim.axes();
    if (!Number.isFinite(cg[0])) { R.out = 'NaN'; break; }
    const o = sim.out;
    const V = Math.hypot(v[0] - (o.windX || 0), v[1] - (o.windY || 0), v[2] - (o.windZ || 0));
    const th = Math.asin(Math.max(-1, Math.min(1, -xA[1])));
    if (thP != null) qF += Math.min(1, dt / 0.25) * ((th - thP) / dt - qF);
    thP = th;
    const onG = sim.wheelsOnGround();
    const agl = cg[1] - surfH(cg[0], cg[2]);
    if (restAGL == null) restAGL = agl;
    if (ap.phase !== last) { R.phases.push(T.toFixed(1) + ' ' + ap.phase); last = ap.phase; }
    const rolling = ap.phase === 'ROLL' || ap.phase === 'LIFTOFF' || ap.phase === 'CLIMB';
    if (ap.phase === 'ROLL' && s0 == null) { s0 = [cg[0], cg[2]]; R.t0 = T; }
    if (s0) sAlong = Math.hypot(cg[0] - s0[0], cg[2] - s0[1]);
    // the rotation asked: ROLL's pitch target leaves the run attitude
    if (ap.phase === 'ROLL' && R.Vr == null && ap.afcs && ap.afcs.vert === 'PITCH' && ap.afcs.sel && ap.afcs.sel.pitch != null
        && ap.afcs.sel.pitch >= (A.thRotate ?? A.liftoffTh) - 1e-9) { R.Vr = V; R.thVr = th * 180 / Math.PI; }
    if (ap.phase === 'ROLL' && R.Vr == null && ap.dbg && ap.dbg.rotating) { R.Vr = V; R.thVr = th * 180 / Math.PI; }
    // the contacts are judged from 5 m/s (the spawn's settle and a float's bob are not lifts)
    if (s0 && !R.away && V > 5) {
      R.trimMax = Math.max(R.trimMax, th * 180 / Math.PI); if (onG > 0) R.trimMin = Math.min(R.trimMin, th * 180 / Math.PI);
      if (onG === 0 && !off) { off = true; offT = T; offV = V; R.distAtOff = sAlong; R.thOff = th * 180 / Math.PI; }
      if (onG > 0 && off) {
        if (T - offT >= 0.1) { R.lifts++; if (R.hopV == null) R.hopV = offV; }
        off = false;
      }
      if (off && T - offT >= 2) {
        R.away = true; R.lifts++; if (R.hopV == null) R.hopV = offV;
        R.Vlof = offV; R.dist = R.distAtOff; R.thLof = R.thOff;
      }
    } else if (R.away && onG > 0) R.touchAfter++;
    if (s0 && rolling && V > 5 && agl - restAGL < 2 * hS) { if (Math.abs(qF) > Math.abs(R.qMax)) { R.qMax = qF; R.qMaxAt = V; } }
    if (R.d15 == null && s0 && agl - restAGL >= 15) R.d15 = sAlong;
    if (CSV && s % 6 === 0 && s0) rows.push([T.toFixed(2), ap.phase, V.toFixed(2), (th * 180 / Math.PI).toFixed(2), (qF * 180 / Math.PI).toFixed(2),
                                           onG, (agl - restAGL).toFixed(2), sim.ctl.de.toFixed(3), sim.ctl.thr.toFixed(2), sim.ctl.flap.toFixed(2), sAlong.toFixed(1)].join(','));
    if (R.away && agl - restAGL > 2 * hS + 5) break;
    if (ap.phase === 'ABORT' || ap.phase === 'STOPPED') { R.out = ap.phase; break; }
  }
  R.qMax = R.qMax * 180 / Math.PI;
  R.verdicts = ap.report.verdicts.map(v => v.code).join(',');
  if (CSV) {
    fs.mkdirSync(CSV, { recursive: true });
    fs.writeFileSync(path.join(CSV, name + '.csv'), 't,phase,V,pitch_deg,q_dps,contacts,height_m,de,thr,flap,run_m\n' + rows.join('\n') + '\n');
  }
  return R;
}

const f = (v, n = 1) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : '-';
if (require.main === module) {
  for (const n of ONLY) {
    const R = trace(n);
    console.log(`${n.padEnd(7)} ${R.float ? 'water' : 'wheels'}  Vs ${f(R.Vs)}  VRot ${f(R.VRot)}  Vr ${f(R.Vr)} (${f(R.Vr / R.Vs, 2)} Vs, th ${f(R.thVr)})  ` +
                `Vlof ${f(R.Vlof)} (${f(R.Vlof / R.Vs, 2)} Vs, th ${f(R.thLof)})  lifts ${R.lifts} (first at ${f(R.hopV)})  touch-after ${R.touchAfter}  ` +
                `qMax ${f(R.qMax)} deg/s at ${f(R.qMaxAt)}  run ${f(R.dist, 0)} m  to-15m ${f(R.d15, 0)} m  trim ${f(R.trimMin)}..${f(R.trimMax)}  ${R.out || ''} ${R.verdicts}`);
  }
}
module.exports = { trace, BUILDS };
