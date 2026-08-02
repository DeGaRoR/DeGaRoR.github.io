const { buildChinook, makeSim, makeAutopilot, makeWorld } = require('./flight_core.js');
const world = makeWorld();
const def = buildChinook();
const sim = makeSim(def, world);
sim.reset(0);
for (let i = 0; i < sim.n; i++) { sim.p[i*3+2] += 1.0; sim.v[i*3+2] += 0.001*Math.sin(i*2.7); }
for (let s0 = 0; s0 < 10*60; s0++) sim.step(1/60);
const ap = makeAutopilot(sim, def);
const iW0 = def.nodes.findIndex(n => n.tag === 'WF' && Math.abs(n.p[2] - 2.00) < 0.2 && n.p[2] > 0);
const iW1 = def.nodes.findIndex(n => n.tag === 'WF' && Math.abs(n.p[2] - 5.34) < 0.2 && n.p[2] > 0);
let smaxCh = 0, smaxGr = 0, lastPhase = '', log = [], rollPitchMin = 99;
let xLiftoff = null, xTD = null, xStop = null;
let flapMin = 99, flapMax = -99, deP = 0, chat = 0, chatN = 0;
for (let s0 = 0; s0 < 300*60; s0++) {
  const t = s0/60;
  ap.update(1/60); sim.step(1/60);
  for (const b of sim.beams) {
    if (b.gear) smaxGr = Math.max(smaxGr, Math.abs(b.strain));
    else smaxCh = Math.max(smaxCh, Math.abs(b.strain));
  }
  if (sim.stats().bad) { console.log(`NaN t=${t.toFixed(1)} ${ap.phase}`); process.exit(1); }
  if (ap.phase === 'ROLLOUT') rollPitchMin = Math.min(rollPitchMin, ap.dbg.th*57.3);
  if (xLiftoff === null && ap.phase === 'LIFTOFF') xLiftoff = sim.cgPos()[0];
  if (xTD === null && ap.phase === 'ROLLOUT') xTD = sim.cgPos()[0];
  if (xStop === null && ap.phase === 'STOPPED') xStop = sim.cgPos()[0];
  if (ap.phase === 'CRUISE') { chat += Math.abs(sim.ctl.de - deP); chatN++; }
  deP = sim.ctl.de;
  {
    const [xB, yB, zB] = sim.axes();
    const dx = sim.p[iW1*3]-sim.p[iW0*3], dy = sim.p[iW1*3+1]-sim.p[iW0*3+1], dz = sim.p[iW1*3+2]-sim.p[iW0*3+2];
    const flap = Math.atan2(dx*yB[0]+dy*yB[1]+dz*yB[2], Math.abs(dx*zB[0]+dy*zB[1]+dz*zB[2])) * 57.3;
    if (ap.phase !== 'ROLL' && ap.phase !== 'STOPPED')
      { flapMin = Math.min(flapMin, flap); flapMax = Math.max(flapMax, flap); }
  }
  if (ap.phase !== lastPhase) { log.push(`t=${t.toFixed(1).padStart(6)} -> ${ap.phase} V=${ap.dbg.V.toFixed(1)} alt=${ap.dbg.alt.toFixed(1)} x=${sim.cgPos()[0].toFixed(0)} z=${ap.dbg.z.toFixed(1)}`); lastPhase = ap.phase; }
  if (ap.phase === 'STOPPED' && t > 5) break;
}
console.log(log.join('\n'));
const cg = sim.cgPos(), td = ap.tdInfo;
if (td) console.log(`TOUCHER: sink=${td.sink.toFixed(2)} m/s x=${td.x.toFixed(0)} z=${td.z.toFixed(1)} V=${(td.V*3.6).toFixed(0)} km/h`);
console.log(`ARRET: x=${cg[0].toFixed(0)} z=${cg[2].toFixed(1)} rolloutPitchMin=${rollPitchMin.toFixed(1)} contraintes ch=${(smaxCh*100).toFixed(1)}% tr=${(smaxGr*100).toFixed(0)}%`);
console.log(`AILE (Chinook): battement ${flapMin.toFixed(1)}..${flapMax.toFixed(1)} deg | gouverne ${(chat/Math.max(1,chatN)*57.3*60).toFixed(1)} deg/s`);
const toRoll = xLiftoff === null ? 999 : Math.abs(xLiftoff - 2);
const ldgRoll = (xTD === null || xStop === null) ? 999 : Math.abs(xStop - xTD);
console.log(`STOL: roulage decollage ${toRoll.toFixed(0)} m | roulage atterrissage ${ldgRoll.toFixed(0)} m`);
const pass = td && Math.abs(td.z) < 5 && td.x > -680 && td.x < -380
  && cg[0] < 20 && Math.abs(cg[2]) < 7 && smaxCh < 0.115 && smaxGr < 0.40
  && rollPitchMin > -2.5 && flapMin > -10 && flapMax < 20 && chat/Math.max(1,chatN)*57.3*60 < 6;
console.log(pass ? 'CHINOOK GATE: VERT' : 'JODEL GATE: ROUGE');
