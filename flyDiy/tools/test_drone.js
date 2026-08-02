const { buildDrone, makeSim, makeAutopilot, makeWorld } = require('./flight_core.js');
const world = makeWorld();
const def = buildDrone();
const sim = makeSim(def, world);
const W = sim.totalM * 9.81;
sim.reset(0);
const cg0 = sim.cgPos();
console.log(`mass=${(sim.totalM*1000).toFixed(0)} g  CG x=${cg0[0].toFixed(3)} (LE 0.27, MAC 0.25 -> ${((cg0[0]-0.27)/0.25*100).toFixed(0)}% MAC)`);

// wind tunnel: CLmax, stall, trim
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

// full circuit
sim.reset(0);
for (let i = 0; i < sim.n; i++) { sim.p[i*3+2] += 0.8; sim.v[i*3+2] += 0.0005*Math.sin(i*2.7); }
for (let s0 = 0; s0 < 10*60; s0++) sim.step(1/60);
const ap = makeAutopilot(sim, def);
const iW0 = def.nodes.findIndex(n => n.tag === 'WF' && Math.abs(n.p[2] - 0.36) < 0.05 && n.p[2] > 0);
const iW1 = def.nodes.findIndex(n => n.tag === 'WF' && Math.abs(n.p[2] - 0.68) < 0.05 && n.p[2] > 0);
let smaxCh = 0, smaxGr = 0, lastPhase = '', log = [], rollPitchMin = 99;
let flapMin = 99, flapMax = -99, tipMin = 99, tipMax = -99;
let deP = 0, chat = 0, chatN = 0, toStrain = 0;
for (let s0 = 0; s0 < 240*60; s0++) {
  const t = s0/60;
  ap.update(1/60); sim.step(1/60);
  for (const b of sim.beams) {
    if (b.gear) smaxGr = Math.max(smaxGr, Math.abs(b.strain));
    else smaxCh = Math.max(smaxCh, Math.abs(b.strain));
  }
  if (sim.stats().bad) { console.log(`NaN t=${t.toFixed(1)} ${ap.phase}`); console.log('GATE DRONE: FAIL (NaN)'); process.exit(1); }
  if (ap.phase === 'ROLLOUT') rollPitchMin = Math.min(rollPitchMin, ap.dbg.th*57.3);
  if (ap.phase === 'CRUISE') { chat += Math.abs(sim.ctl.de - deP); chatN++; }
  deP = sim.ctl.de;
  if (ap.phase === 'ROLL' || ap.phase === 'LIFTOFF')
    for (const b of sim.beams) if (!b.gear) toStrain = Math.max(toStrain, Math.abs(b.strain));
  {
    const [xB, yB, zB] = sim.axes();
    const dx = sim.p[iW1*3]-sim.p[iW0*3], dy = sim.p[iW1*3+1]-sim.p[iW0*3+1], dz = sim.p[iW1*3+2]-sim.p[iW0*3+2];
    const ty = dx*yB[0]+dy*yB[1]+dz*yB[2];
    const flap = Math.atan2(ty, Math.abs(dx*zB[0]+dy*zB[1]+dz*zB[2])) * 57.3;
    flapMin = Math.min(flapMin, flap); flapMax = Math.max(flapMax, flap);
    if (ap.phase !== 'ROLL') { tipMin = Math.min(tipMin, ty); tipMax = Math.max(tipMax, ty); }
  }
  if (ap.phase !== lastPhase) { log.push(`t=${t.toFixed(1).padStart(6)} -> ${ap.phase} V=${ap.dbg.V.toFixed(1)} alt=${ap.dbg.alt.toFixed(1)} x=${sim.cgPos()[0].toFixed(0)} z=${ap.dbg.z.toFixed(1)}`); lastPhase = ap.phase; }
  if (ap.phase === 'STOPPED' && t > 5) break;
}
console.log(log.join('\n'));
const cg = sim.cgPos(), td = ap.tdInfo;
if (td) console.log(`TOUCHDOWN: sink=${td.sink.toFixed(2)} m/s x=${td.x.toFixed(0)} z=${td.z.toFixed(1)} V=${(td.V*3.6).toFixed(0)} km/h`);
console.log(`STOP: x=${cg[0].toFixed(0)} z=${cg[2].toFixed(1)} rolloutPitchMin=${rollPitchMin.toFixed(1)} strain ch=${(smaxCh*100).toFixed(0)}% gr=${(smaxGr*100).toFixed(0)}%`);
console.log(`WING: flap ${flapMin.toFixed(1)}..${flapMax.toFixed(1)} deg (dihedral 4) | tip osc p2p ${((tipMax-tipMin)*100).toFixed(1)} cm`);
console.log(`SMOOTHNESS: elevator chatter ${(chat/Math.max(1,chatN)*57.3*60).toFixed(1)} deg/s | takeoff wing strain ${(toStrain*100).toFixed(0)}%`);
const pass = td && td.sink < 0.9 && Math.abs(td.z) < 3 && td.x > -560 && td.x < -300
  && cg[0] < 20 && Math.abs(cg[2]) < 6 && smaxCh < 0.16 && smaxGr < 0.45 && rollPitchMin > -3 && flapMin > -4 && flapMax < 14 && (tipMax-tipMin) < 0.09 && chat/Math.max(1,chatN)*57.3*60 < 8 && toStrain < 0.12;
console.log(pass ? 'GATE DRONE: PASS' : 'GATE DRONE: FAIL');
process.exitCode = pass ? 0 : 1;
