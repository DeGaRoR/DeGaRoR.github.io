const { buildCub, makeSim, makeAutopilot } = require('./flight_core.js');
const { makeWorld } = require('./flight_core.js');
const world = makeWorld();
console.log(`WORLD: ${world.trees.length} trees | terrain: runway=${world.terrainH(-320,0).toFixed(2)} corridor=${world.terrainH(-2500,-500).toFixed(1)} meadow1=${world.meadows[0].h.toFixed(0)}m`);
const def = buildCub();
const sim = makeSim(def, world);
sim.reset(0);
// mandatory asymmetric start: symmetric ICs mask directional instabilities
for (let i = 0; i < sim.n; i++) { sim.p[i*3+2] += 1.2; sim.v[i*3+2] += 0.001 * Math.sin(i * 2.7); }
// parked idle before engaging: catches instabilities seeded while sitting
for (let s0 = 0; s0 < 15*60; s0++) sim.step(1/60);
const ap = makeAutopilot(sim, def);
// wing integrity tracking: tip height relative to mid-spar node (flap/flip detector)
const iWF1 = def.nodes.findIndex(n => n.tag === 'WF' && Math.abs(n.p[2] - 3.4) < 0.1 && n.p[2] > 0);
const iWF2 = def.nodes.findIndex(n => n.tag === 'WF' && Math.abs(n.p[2] - 5.0) < 0.1 && n.p[2] > 0);
let flapMin = 99, flapMax = -99, drRMS = 0, drN = 0, tipMin = 99, tipMax = -99, rollPitchMin = 99;
let smaxCh = 0, smaxGr = 0, seen = {}, log = [], lastPhase = '';
for (let s = 0; s < 300*60; s++) {
  const t = s/60;
  ap.update(1/60); sim.step(1/60);
  const st = sim.stats();
  for (const b of sim.beams) {
    if (b.gear) smaxGr = Math.max(smaxGr, Math.abs(b.strain));
    else smaxCh = Math.max(smaxCh, Math.abs(b.strain));
  }
  if (st.bad) { console.log(`NaN at t=${t.toFixed(1)} ${ap.phase}`); console.log('GATE M3: FAIL (NaN)'); process.exit(1); }
  seen[ap.phase] = true;
  const [xB, yB, zB] = sim.axes();
  const dx = sim.p[iWF2*3]-sim.p[iWF1*3], dy = sim.p[iWF2*3+1]-sim.p[iWF1*3+1], dz = sim.p[iWF2*3+2]-sim.p[iWF1*3+2];
  const flap = Math.atan2(dx*yB[0]+dy*yB[1]+dz*yB[2], Math.abs(dx*zB[0]+dy*zB[1]+dz*zB[2])) * 57.3; // deg vs body
  flapMin = Math.min(flapMin, flap); flapMax = Math.max(flapMax, flap);
  if (ap.phase === 'CLIMB' || ap.phase === 'CRUISE') { drRMS += sim.ctl.dr**2; drN++; }
  if (ap.phase === 'ROLLOUT') rollPitchMin = Math.min(rollPitchMin, ap.dbg.th * 57.3);
  if (ap.phase === 'TURNBACK' || ap.phase === 'INBOUND') {
    const ty = dx*yB[0]+dy*yB[1]+dz*yB[2];   // tip height above inner spar node, body frame
    tipMin = Math.min(tipMin, ty); tipMax = Math.max(tipMax, ty);
  }
  if (ap.phase !== lastPhase) { log.push(`t=${t.toFixed(1).padStart(6)}  -> ${ap.phase}  V=${ap.dbg.V.toFixed(1)} alt=${ap.dbg.alt.toFixed(1)} x=${sim.cgPos()[0].toFixed(0)} z=${ap.dbg.z.toFixed(1)}`); lastPhase = ap.phase; }
  if (ap.phase === 'STOPPED' && t > 5) break;
}
console.log(log.join('\n'));
const cg = sim.cgPos(), td = ap.tdInfo;
const [xAf] = sim.axes();
const finalPitch = Math.asin(Math.max(-1, Math.min(1, -xAf[1]))) * 57.3;
console.log(`FINAL ATTITUDE: pitch ${finalPitch.toFixed(1)} deg (three-point ~11), cg alt ${cg[1].toFixed(2)} (rest 1.5), min rollout pitch ${rollPitchMin.toFixed(1)} deg`);
if (td) console.log(`\nTOUCHDOWN: sink=${td.sink.toFixed(2)} m/s  x=${td.x.toFixed(0)}  z=${td.z.toFixed(1)}  V=${td.V.toFixed(1)} m/s (${(td.V*3.6).toFixed(0)} km/h)`);
console.log(`STOP: x=${cg[0].toFixed(0)}  z=${cg[2].toFixed(1)}  strain chassis=${(smaxCh*100).toFixed(1)}% gear=${(smaxGr*100).toFixed(1)}%`);
console.log(`WING: flap ${flapMin.toFixed(1)}..${flapMax.toFixed(1)} deg | tip oscillation p2p in turn ${((tipMax-tipMin)*100).toFixed(1)} cm | rudder RMS ${(Math.sqrt(drRMS/Math.max(1,drN))*57.3).toFixed(2)} deg`);
const pass = td && seen.STOPPED && td.sink < 1.5 && Math.abs(td.z) < 4
  && td.x > -660 && td.x < -240 && cg[0] < 20 && Math.abs(cg[2]) < 8 && smaxCh < 0.08 && smaxGr < 0.35 && flapMin > -4 && flapMax < 12 && Math.sqrt(drRMS/Math.max(1,drN))*57.3 < 4 && (tipMax-tipMin) < 0.12 && finalPitch > 5 && finalPitch < 16 && cg[1] > 1.25 && rollPitchMin > 1;
console.log(pass ? 'GATE M3: PASS' : 'GATE M3: FAIL');
process.exitCode = pass ? 0 : 1;
