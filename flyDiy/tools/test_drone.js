const { buildDrone, makeSim, makeWorld } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

// ---- wind tunnel: CLmax, stall, trim (probe-only sim) ----
{
  const world = makeWorld();
  const def = buildDrone();
  const sim = makeSim(def, world);
  const W = sim.totalM * 9.81;
  sim.reset(0);
  const cg0 = sim.cgPos();
  console.log(`mass=${(sim.totalM*1000).toFixed(0)} g  CG x=${cg0[0].toFixed(3)} (LE 0.27, MAC 0.25 -> ${((cg0[0]-0.27)/0.25*100).toFixed(0)}% MAC)`);

  const S = 0.35, c = 0.25;
  function LD(V, al) {
    const r = sim.probe([-V*Math.cos(al), -V*Math.sin(al), 0]);
    return { L: -r.Fx*Math.sin(al) + r.Fy*Math.cos(al),
             D: -(r.Fx*(-Math.cos(al)) + r.Fy*(-Math.sin(al))),
             Cm: r.pitchUp/(0.5*1.225*V*V*S*c) };
  }
  let CLmax = 0;
  for (let a = 6; a <= 18; a += 0.5) CLmax = Math.max(CLmax, LD(10, a*Math.PI/180).L/(0.5*1.225*100*S));
  const Vs = Math.sqrt(2*W/(1.225*S*CLmax));
  console.log(`CLmax=${CLmax.toFixed(2)}  Vs=${Vs.toFixed(1)} m/s (design ~6.5-7)`);
  for (const V of [10, 13]) {
    let lo=-0.1, hi=0.3;
    for (let k=0;k<40;k++){ const m=(lo+hi)/2; (LD(V,m).L < W ? lo=m : hi=m); }
    const al=(lo+hi)/2, r=LD(V,al);
    console.log(`V=${V}: trim alpha=${(al*57.3).toFixed(1)} deg  Cm=${r.Cm.toFixed(3)}  D=${r.D.toFixed(2)} N  T_avail=${(8-0.0155*V*V).toFixed(2)} N`);
  }
}

// ---- full circuit ----
runCircuit({
  id: 'DRONE', build: buildDrone,
  perturb: { z: 0.8, v: 0.0005 }, settleS: 10, maxS: 240,
  tip: { tag: 'WF', midZ: 0.36, tipZ: 0.68, tol: 0.05 },
  flapDuring: () => true,
  // extras: takeoff wing strain, tip oscillation outside the takeoff roll
  onStep: c => {
    const M = c.custom, ph = c.ap.phase;
    if (ph === 'ROLL' || ph === 'LIFTOFF')
      for (const b of c.sim.beams) if (!b.gear) M.toStrain = Math.max(M.toStrain ?? 0, Math.abs(b.strain));
    if (ph !== 'ROLL') {
      M.tipMin = Math.min(M.tipMin ?? 99, c.step.ty); M.tipMax = Math.max(M.tipMax ?? -99, c.step.ty);
    }
  },
  lines: c => {
    const M = c.custom, td = c.td, cg = c.cg;
    M.tipP2P = (M.tipMax ?? 0) - (M.tipMin ?? 0);
    const L = [];
    if (td) L.push(`TOUCHDOWN: sink=${td.sink.toFixed(2)} m/s x=${td.x.toFixed(0)} z=${td.z.toFixed(1)} V=${(td.V*3.6).toFixed(0)} km/h`);
    L.push(`STOP: x=${cg[0].toFixed(0)} z=${cg[2].toFixed(1)} rolloutPitchMin=${c.rollPitchMin.toFixed(1)} strain ch=${(c.smaxCh*100).toFixed(0)}% gr=${(c.smaxGr*100).toFixed(0)}%`);
    L.push(`WING: flap ${c.flapMin.toFixed(1)}..${c.flapMax.toFixed(1)} deg (dihedral 4) | tip osc p2p ${(M.tipP2P*100).toFixed(1)} cm`);
    L.push(`SMOOTHNESS: elevator chatter ${c.chatRate().toFixed(1)} deg/s | takeoff wing strain ${((M.toStrain ?? 0)*100).toFixed(0)}%`);
    return L;
  },
  checks: c => {
    const M = c.custom, td = c.td, cg = c.cg;
    return {
      'touchdown': !!td,
      'sink<0.9': td && td.sink < 0.9,
      '|tdZ|<3': td && Math.abs(td.z) < 3,
      'tdX in (-560,-300)': td && td.x > -560 && td.x < -300,
      'stopX<20': cg[0] < 20,
      '|stopZ|<6': Math.abs(cg[2]) < 6,
      'chassis<16%': c.smaxCh < 0.16,
      'gear<45%': c.smaxGr < 0.45,
      'rolloutPitchMin>-3': c.rollPitchMin > -3,
      'flapMin>-4': c.flapMin > -4,
      'flapMax<14': c.flapMax < 14,
      'tipOsc<9cm': M.tipP2P < 0.09,
      'chatter<8': c.chatRate() < 8,
      'takeoffStrain<12%': (M.toStrain ?? 0) < 0.12,
    };
  },
});
