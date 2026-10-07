#!/usr/bin/env node
// ditch_osc.js - WATER-LOOK G2094: WHY A DITCHED AEROPLANE KEEPS OSCILLATING (the user, on the damage tests on the water:
// "the oscillation seems a little long, like if the engine was still running, or there was a source of force, or an
// oscillation not damped enough"). Node, the real solver (tools/flight_core.js), STAGED INLINE (the aeroplane placed over
// the SEA lane, no page, no worker, no field: the drawn waves never reach the physics - water.js's field is the page's).
// Per case, every 1/60 s: the CG's height over the water (heave), pitch, roll, the vertical speed, the THRUST the solver
// applies (out.thrust), whether the engine runs, the prop's depth under the water, the wet body's buoyancy and drag.
// The free decay once the aeroplane has stopped (ground speed under 1 m/s): the heave's and the pitch's peaks about their
// final mean, the logarithmic decrement -> the damping ratio zeta, the period, the cycles to settle (amplitude < 2 cm /
// 1 deg). A floating body that settles in "a few cycles" has zeta ~0.1-0.3.
//   node tools/ditch_osc.js [--secs 40] [--csv <dir>]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SECS = +opt('secs', 40), CSV = opt('csv', null);
const C = require('./flight_core.js');
const ROOT = path.join(__dirname, '..');
const specOf = f => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); return j.spec; };
const CASES = [
  { id: 'cub_thr0', label: 'Cub, ditched at 22 m/s, 1.5 m/s sink, throttle CLOSED', build: 'builds/cub_2026-09-20_corrected.json', V: 22, sink: 1.5, thr: 0 },
  { id: 'cub_thr0_dmg', label: 'the same, damage ON', build: 'builds/cub_2026-09-20_corrected.json', V: 22, sink: 1.5, thr: 0, dmg: true },
  { id: 'cub_thr60', label: 'Cub, the same ditch, throttle LEFT at 0.6 (a pilot that keeps power)', build: 'builds/cub_2026-09-20_corrected.json', V: 22, sink: 1.5, thr: 0.6 },
  { id: 'cub_thr60_dmg', label: 'the same, damage ON', build: 'builds/cub_2026-09-20_corrected.json', V: 22, sink: 1.5, thr: 0.6, dmg: true },
  { id: 'cessna_thr0', label: 'metal Cessna, ditched at 25 m/s, 1.5 m/s sink, throttle closed', build: 'bugReports/cessnaMetal (1).json', V: 25, sink: 1.5, thr: 0 },
  { id: 'floats_drop', label: 'Cessna floats, a hard touchdown: 15 m/s, 2.3 m/s sink, throttle closed', build: 'bugReports/cessnaFloatsWOrks.json', V: 15, sink: 2.3, thr: 0 },
];
function run(cs) {
  const world = C.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA');
  const def = C.buildGen(specOf(cs.build));
  def.params.damage = !!cs.dmg;   // (the def's own switch: genDamageOn / the solver's DMG_ON read it first)
  const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  const n = def.nodes.length, p = sim.p, v = sim.v, [xA] = sim.axes(), c0 = sim.cgPos(), wh = world.waterH(c0[0], c0[2]);
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i * 3 + 1] - (def.nodes[i].r || 0));
  const hl = Math.hypot(xA[0], xA[2]);
  for (let i = 0; i < n; i++) { p[i * 3 + 1] += wh + 0.5 - yMin; v[i * 3] = -cs.V * xA[0] / hl; v[i * 3 + 1] = -cs.sink; v[i * 3 + 2] = -cs.V * xA[2] / hl; }
  sim.ctl.thr = cs.thr;
  const engN = (def.refs.engine || [])[0];
  const rows = [];
  for (let s = 0; s < SECS * 60; s++) {
    sim.ctl.thr = cs.thr;
    sim.step(1 / 60);
    const c = sim.cgPos(), cv = sim.cgVel(), [xa, ya, za] = sim.axes(), w = world.waterH(c[0], c[2]);
    const o = sim.out, e = sim.eng && sim.eng[0];
    rows.push({ t: (s + 1) / 60, heave: c[1] - w, pitch: Math.asin(Math.max(-1, Math.min(1, -xa[1]))) * 57.2958, roll: Math.asin(Math.max(-1, Math.min(1, za[1]))) * 57.2958,
      vy: cv[1], gs: Math.hypot(cv[0], cv[2]), thrust: o.thrust || 0, running: e ? !!e.running : null,
      propDepth: engN != null ? w - p[engN * 3 + 1] : null, buoy: o.wetBuoy != null ? o.wetBuoy : (o.hydroWet ? NaN : 0), drag: o.wetDrag || 0,
      crashed: sim.damage ? !!sim.damage().crashed : false });
  }
  return { cs, rows, mass: sim.totalM, seaA: world.sea ? world.sea.A : null, dmgOn: typeof C.genDamageOn === 'function' ? C.genDamageOn(def) : null };
}
// the free decay of x(t) after t0: peaks about the final mean (the last quarter), log decrement over successive same-sign
// peaks, zeta, the period, the cycles until |x - mean| stays under tol
function decay(rows, key, t0, tol) {
  const R = rows.filter(r => r.t >= t0); if (R.length < 120) return null;
  const tail = R.slice(Math.floor(R.length * 0.75)), mean = tail.reduce((a, r) => a + r[key], 0) / tail.length;
  const x = R.map(r => r[key] - mean), pk = [];
  for (let i = 1; i + 1 < x.length; i++) if (Math.abs(x[i]) >= Math.abs(x[i - 1]) && Math.abs(x[i]) > Math.abs(x[i + 1]) && Math.abs(x[i]) > tol * 0.25) pk.push({ t: R[i].t, a: x[i] });
  const pos = pk.filter(q => q.a > 0);
  const dec = []; for (let i = 0; i + 1 < pos.length && i < 6; i++) if (pos[i + 1].a > 0) dec.push(Math.log(pos[i].a / pos[i + 1].a));
  const d = dec.length ? dec.reduce((a, b) => a + b, 0) / dec.length : NaN;
  const zeta = d / Math.sqrt(4 * Math.PI * Math.PI + d * d);
  const T = pos.length > 1 ? (pos[Math.min(pos.length - 1, 4)].t - pos[0].t) / Math.min(pos.length - 1, 4) : NaN;
  let tSettle = null; for (let i = x.length - 1; i >= 0; i--) if (Math.abs(x[i]) > tol) { tSettle = R[i].t; break; }
  return { mean, a0: pk.length ? Math.max(...pk.slice(0, 3).map(q => Math.abs(q.a))) : 0, peaks: pk.length, zeta, T, tSettle, cycles: Number.isFinite(T) && tSettle != null ? (tSettle - t0) / T : null };
}
const f = (x, d) => Number.isFinite(x) ? x.toFixed(d == null ? 2 : d) : String(x);
const out = [];
for (const cs of CASES) {
  let r; try { r = run(cs); } catch (e) { console.log('== ' + cs.id + ': threw ' + e.message); continue; }
  const rows = r.rows, stop = rows.find(q => q.t > 1 && q.gs < 1);
  // the window: from the stop - or, an aeroplane still gliding on (a floatplane), from 1.5 s after its touchdown
  const t0 = stop && stop.t < 10 ? stop.t : 1.5;
  const H = decay(rows, 'heave', t0, 0.02), P = decay(rows, 'pitch', t0, 1), Rl = decay(rows, 'roll', t0, 1);
  const thrAfter = rows.filter(q => q.t >= t0), thrMax = Math.max(...thrAfter.map(q => q.thrust)), runEnd = rows[rows.length - 1].running;
  const propUnder = thrAfter.filter(q => q.propDepth > 0).length / Math.max(1, thrAfter.length);
  console.log('\n== ' + cs.id + ': ' + cs.label + ' (staged inline, ' + f(r.mass, 0) + ' kg, damage ' + (r.dmgOn ? 'ON' : 'off') + ', sea wave amplitude ' + r.seaA + ' m)');
  console.log('  stopped (gs < 1 m/s) at ' + f(t0, 2) + ' s; crashed ' + rows[rows.length - 1].crashed + '; engine running at the end ' + runEnd +
    '; thrust after the stop up to ' + f(thrMax, 0) + ' N with the prop under water ' + f(100 * propUnder, 0) + ' % of the time');
  for (const [k, D, u] of [['heave', H, 'm'], ['pitch', P, 'deg'], ['roll', Rl, 'deg']]) if (D)
    console.log('  ' + k.padEnd(6) + ' about ' + f(D.mean, 2) + ' ' + u + ': first swing ' + f(D.a0, 2) + ' ' + u + ', period ' + f(D.T, 2) + ' s, zeta ' + f(D.zeta, 3) +
      ', settled (' + (u === 'm' ? '2 cm' : '1 deg') + ') at ' + (D.tSettle == null ? 'never moved' : f(D.tSettle, 1) + ' s') + ' = ' + f(D.cycles, 1) + ' cycles');
  out.push({ id: cs.id, label: cs.label, t0, heave: H, pitch: P, roll: Rl, thrustAfterMax: thrMax, propUnder, runningEnd: runEnd });
  if (CSV) { fs.mkdirSync(CSV, { recursive: true }); fs.writeFileSync(path.join(CSV, cs.id + '.csv'), 't,heave,pitch,roll,vy,gs,thrust,running,propDepth,buoy,drag,crashed\n' +
    rows.map(q => [q.t.toFixed(4), q.heave.toFixed(4), q.pitch.toFixed(3), q.roll.toFixed(3), q.vy.toFixed(3), q.gs.toFixed(3), q.thrust.toFixed(1), q.running ? 1 : 0, q.propDepth == null ? '' : q.propDepth.toFixed(3), Number.isFinite(q.buoy) ? q.buoy.toFixed(0) : '', q.drag.toFixed(0), q.crashed ? 1 : 0].join(',')).join('\n')); }
}
if (CSV) fs.writeFileSync(path.join(CSV, 'summary.json'), JSON.stringify(out, null, 1));
