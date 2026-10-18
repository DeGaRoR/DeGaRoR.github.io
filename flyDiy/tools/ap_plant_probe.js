// ap_plant_probe.js (G3301, AP-ADAPT) - THE PLANT EACH BUILD HANDS THE PILOT, from its own numbers (genDesignDerivs:
// the solver's probe, live propeller, stability axes), set against the gains the pilot flies it with. Asserts nothing.
//   yaw    Cn_dr x q Sw b / Izz = the rudder's yaw acceleration per unit pedal (rad/s^2), at VTailUp (the steer's
//          reference speed) and at Vs; the steer's loop gain kP x that, tail down and tail up at the tail-up speed
//          (39b S.steerK's schedule, re-derived here: a change there must be mirrored), and Cnr's yaw damping per Izz
//   pitch  Cm_de x q Sw c / Iyy (elevator per pitch inertia) and Cmq's damping per Iyy at VCruise - the altitude loop's plant
//   roll   Cl_da x q Sw b / Ixx and Clp per Ixx at VCruise
//   node tools/ap_plant_probe.js <build.json> [<build.json> ...]
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname;
process.chdir(path.join(T, '..'));
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(process.env.PILOT_CORE || path.join(T, 'flight_core.js'));
const r3 = v => v == null || !isFinite(v) ? null : Math.round(v * 1000) / 1000;
for (const f of process.argv.slice(2)) {
  const spec = PT.specOf(f).spec;
  const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
  const sim = C.makeSim(def, null); sim.reset(0);
  const A = def.params.ap || {}, G = C.SERVO_GAINS || {};
  const g = k => A[k] != null ? A[k] : G[k];
  const VTU = g('VTailUp'), Vs = (def.params.gen && def.params.gen.Vs) || 15, VC = A.VCruise || 30;
  const at = V => C.genDesignDerivs(def, sim, V);
  const Dt = at(Math.max(VTU, 0.8 * Vs)), Dc = at(VC);
  const nDr = D => D.dr.Cn * D.q * D.Sw * D.b / D.Izz;
  const nR = D => D.Cnr * D.q * D.Sw * D.b * D.b / (2 * D.V) / D.Izz;
  const kM = Math.sqrt(Math.max(G.steerMassMin, sim.totalM) / G.steerMassRef);
  const V = Dt.V, kS = Math.min(1, Math.max(G.steerMin, (VTU / Math.max(V, 5)) ** 2));
  const kPdown = G.steerP * kS / kM, kPup = G.steerP * G.steerTailUpK * Math.min(G.steerTailUpMax, Math.max(G.steerTailUpMin, (VTU / Math.max(V, 5)) ** 2)) / kM;
  const kDdown = G.steerD * kS * kM, kDup = G.steerTailUpD * kM;
  const out = {
    build: path.basename(f), m: r3(sim.totalM), Izz: r3(Dt.Izz), Iyy: r3(Dc.Iyy), Ixx: r3(Dc.Ixx), VTailUp: VTU, Vs: r3(Vs), VCruise: r3(VC),
    yaw: { V: r3(V), CnDr: r3(Dt.dr.Cn), nDr: r3(nDr(Dt)), nR: r3(nR(Dt)), kPdown: r3(kPdown), kPup: r3(kPup), kDdown: r3(kDdown), kDup: r3(kDup),
           loopDown: r3(kPdown * Math.abs(nDr(Dt))), loopUp: r3(kPup * Math.abs(nDr(Dt))), dampDown: r3(kDdown * Math.abs(nDr(Dt))), dampUp: r3(kDup * Math.abs(nDr(Dt))) },
    pitch: { CmDe: r3(Dc.de.Cm), mDe: r3(Dc.de.Cm * Dc.q * Dc.Sw * Dc.c / Dc.Iyy), mQ: r3(Dc.Cmq * Dc.q * Dc.Sw * Dc.c * Dc.c / (2 * Dc.V) / Dc.Iyy),
             pitchP: g('pitchP'), pitchD: g('pitchD'), pitchI: g('pitchI') },
    roll: { ClDa: r3(Dc.da.Cl), lDa: r3(Dc.da.Cl * Dc.q * Dc.Sw * Dc.b / Dc.Ixx), lP: r3(Dc.Clp * Dc.q * Dc.Sw * Dc.b * Dc.b / (2 * Dc.V) / Dc.Ixx),
            rollP: g('rollP'), rollD: g('rollD') },
  };
  console.log(JSON.stringify(out));
}
