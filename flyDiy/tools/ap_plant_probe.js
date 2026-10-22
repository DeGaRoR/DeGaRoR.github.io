// ap_plant_probe.js (G3301, AP-ADAPT) - THE PLANT EACH BUILD HANDS THE PILOT, from its own numbers (genDesignDerivs:
// the solver's probe, live propeller, stability axes), set against the gains the pilot flies it with. Asserts nothing.
//   yaw    Cn_dr x q Sw b / Izz = the rudder's yaw acceleration per unit pedal (rad/s^2), at VTailUp (the steer's
//          reference speed); the steer's gains as FLOWN (39b S.steerK itself, tail down and tail up at that speed) and the
//          loop gain they make with it (kP x N_dr: the heading loop's crossover, 1/s^2 per rad); Cnr's yaw damping per Izz
//          (one line per build: the mismatch reads across the lines)
//   pitch  Cm_de x q Sw c / Iyy (elevator per pitch inertia) and Cmq's damping per Iyy at VCruise - the altitude loop's plant
//   roll   Cl_da x q Sw b / Ixx and Clp per Ixx at VCruise
//   node tools/ap_plant_probe.js <build.json | archetype key> [...]   (the STEER lines on stderr: one a build)
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
  // THE GAINS ACTUALLY FLOWN: 39b's own S.steerK (makeServos as 43 makes it - the trike / rotateTD tests are 43's lines
  // 330 / 340), asked at the tail-up speed with the tail down and up; a trike has no tail-up (both are its one law)
  const trike = A.rolloutMode === 'trike' || (def.params.twSteer || 0.5) < 0;
  const rotateTD = !trike && (A.rotate != null ? !!A.rotate : true);
  const SV = C.makeServos(sim, def, { pilot: 'pilot', trike, rotateTD, features: { trimCalm: true, groundP1D: true, xwBank: true, water: true, porpoise: true } });
  const V = Dt.V;
  SV.V = V; SV.Vg = V;
  const [kPdown, kDdown] = SV.steerK(false), [kPup, kDup] = SV.steerK(true);
  const out = {
    build: path.basename(f), m: r3(sim.totalM), Izz: r3(Dt.Izz), Iyy: r3(Dc.Iyy), Ixx: r3(Dc.Ixx), VTailUp: VTU, Vs: r3(Vs), VCruise: r3(VC),
    yaw: { V: r3(V), trike, CnDr: r3(Dt.dr.Cn), nDr: r3(nDr(Dt)), nR: r3(nR(Dt)), kPdown: r3(kPdown), kPup: r3(kPup), kDdown: r3(kDdown), kDup: r3(kDup),
           loopDown: r3(kPdown * Math.abs(nDr(Dt))), loopUp: r3(kPup * Math.abs(nDr(Dt))), dampDown: r3(kDdown * Math.abs(nDr(Dt))), dampUp: r3(kDup * Math.abs(nDr(Dt))) },
    pitch: { CmDe: r3(Dc.de.Cm), mDe: r3(Dc.de.Cm * Dc.q * Dc.Sw * Dc.c / Dc.Iyy), mQ: r3(Dc.Cmq * Dc.q * Dc.Sw * Dc.c * Dc.c / (2 * Dc.V) / Dc.Iyy),
             pitchP: g('pitchP'), pitchD: g('pitchD'), pitchI: g('pitchI') },
    roll: { ClDa: r3(Dc.da.Cl), lDa: r3(Dc.da.Cl * Dc.q * Dc.Sw * Dc.b / Dc.Ixx), lP: r3(Dc.Clp * Dc.q * Dc.Sw * Dc.b * Dc.b / (2 * Dc.V) / Dc.Ixx),
            rollP: g('rollP'), rollD: g('rollD') },
  };
  // G3303: THE STEER LINE - the generator's own numbers (62 genPlant / genSteerWD / genSteerYawK) as the def carries them:
  // the tail-up rate loop's crossover at VRot, the reference, the factor the build flies
  const yp = C.genYawPlant ? C.genYawPlant(def.nodes, def.strips, def.params) : null;
  if (yp) out.steer = { nPerQ: +yp.nPerQ.toPrecision(4), Izz: r3(yp.Izz), Mdesign: r3(yp.M), Mflight: r3(sim.totalM), VRot: A.VRot,
    wD: r3(C.genSteerWD(yp, A, Vs)), wDflight: r3(C.genSteerWD(yp, A, Vs, sim.totalM)), ref: C.GEN_STEER_WD_REF, steerYawK: A.steerYawK != null ? A.steerYawK : 1 };
  console.log(JSON.stringify(out));
  if (out.steer) console.error('STEER ' + out.build.padEnd(40) + ' wD ' + String(out.steer.wD).padStart(7) + ' rad/s (design ' + out.steer.Mdesign + ' kg) ' + String(out.steer.wDflight).padStart(7) + ' (flight ' + out.steer.Mflight + ' kg)  N_dr/q/Izz ' + out.steer.nPerQ + '  steerYawK ' + out.steer.steerYawK);
}
