// THE STOL WING'S FINGERPRINTS (G2821, STOL-WING-2) - one source for the
// instruments GATE STOL (tools/_stol_check.js) compares and the capture /
// before-after tool (tools/_stol_samebits.js) writes, so a fixture and the
// gate that reads it can never hash two different things. Every function
// takes the core it measures (`C`): the capture runs them on an UNTOUCHED
// master's core, the gate on this tree's.
//
//   def   sha1 of the def's nodes / beams / strips / params
//   fly   4 s of free flight from rest (thr 0.7, flap 1 at 1 s, da / de at
//         2 s) - the strips, the flap lever and the ailerons all reached
//   draw  genWing's groups (positions, indices, skin weights) + its moving list
//   check the design check's rows and the machine sheet (fpCheck)
//   lap   THE PILOT'S CIRCUIT off HOME in calm air (perf_study's fly(), the
//         damage layer as the build has it - ON by default): every phase
//         change and its time, the lift-off run, the landing run, the
//         outcome, and the hash of the final state. A circuit is ~5-10 min
//         of simulated flight through take-off, climb, the pattern, the
//         approach, the flare and the roll-out: if one bit of the solver's
//         wing branch moved for an aeroplane without a STOL part, it shows.
'use strict';
const crypto = require('crypto');
const h = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const rep = (k, v) => typeof v === 'function' ? undefined : v;

function fpDef(def) { return h(JSON.stringify({ n: def.nodes, b: def.beams, s: def.strips, p: def.params }, rep)); }
function fpFly(C, def) {
  const sim = C.makeSim(def, null); sim.reset(0); sim.ctl.thr = 0.7;
  for (let i = 0; i < 240; i++) {
    if (i === 60) sim.ctl.flap = 1;
    if (i === 120) { sim.ctl.da = 0.3; sim.ctl.de = -0.2; }
    sim.step(1 / 60);
  }
  return h(Array.from(sim.p).join(','));
}
function fpDraw(C, def) {
  const w = C.genWing(def), parts = [];
  for (const [g, m] of Object.entries(w.groups))
    parts.push(g, Array.from(m.pos).join(','), Array.from(m.idx).join(','), Array.from(m.ww).join(','));
  parts.push(JSON.stringify(w.moving));
  return h(parts.join('|'));
}
// the pilot's circuit; `maxS` bounds it (s of simulated time)
function fpLap(C, def, maxS) {
  const world = C.makeWorld();
  const sim = C.makeSim(def, world); sim.reset(0);
  for (let i = 0; i < 300; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, world);
  const trace = [];
  let ph = null, sRoll = null, lift = null, vsMin = Infinity;
  const N = Math.round((maxS || 900) * 60);
  let s = 0;
  for (; s < N; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (ap.phase !== ph) { ph = ap.phase; trace.push(ph + '@' + (s / 60).toFixed(2)); }
    if (ap.phase === 'ROLL' && sRoll == null && ap.dbg) sRoll = ap.dbg.s;
    if (ap.phase === 'LIFTOFF' && lift == null && sRoll != null && ap.dbg) lift = Math.abs(ap.dbg.s - sRoll);
    if (sim.stats().bad) { trace.push('NAN'); break; }
    if (ap.phase === 'STOPPED' && ap.t > 5) break;
  }
  const L = ap.report && ap.report.landing;
  return { hash: h(trace.join(' ') + '|' + Array.from(sim.p).join(',') + '|' + Array.from(sim.v || []).join(',')),
           phases: trace.length, t: s / 60, liftRun: lift, ldgRun: L ? L.run : null,
           outcome: (ap.report && ap.report.outcome) || ph };
}
// the design check (genShakedown with its loading corners: every row's level and value) and the machine sheet the
// pilot flies its speeds from (Vref, Vs0, the take-off run ...) - the bench's verdict and the autopilot's ladder
function fpCheck(C, def) {
  const sh = C.genShakedown(def, { corners: true });
  const dc = sh.design || C.genDesignCheck(def, sh);
  const S = C.machineSheet(def, { shakedown: sh });
  const sheet = {}; for (const k of Object.keys(S)) if (typeof S[k] === 'number') sheet[k] = S[k];
  return { check: h(JSON.stringify({ v: dc.verdict, r: dc.rows.map(r => [r.id, r.level, r.value]), sheet })),
           checkWords: dc.verdict + ' Vref ' + (S.Vref * 3.6).toFixed(2) + ' km/h, Vs0 ' + (S.Vs0 * 3.6).toFixed(2) + ', TO ' + S.TORun + ' m' };
}
module.exports = { h, fpDef, fpFly, fpDraw, fpLap, fpCheck };
