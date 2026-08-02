const { makeWorld } = require('./flight_core.js');
const { buildCub } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

const world = makeWorld();
console.log(`WORLD: ${world.trees.length} trees | terrain: runway=${world.terrainH(-320,0).toFixed(2)} corridor=${world.terrainH(-2500,-500).toFixed(1)} meadow1=${world.meadows[0].h.toFixed(0)}m`);

runCircuit({
  id: 'M3', build: buildCub, world,
  perturb: { z: 1.2, v: 0.001 }, settleS: 15, maxS: 300,
  tip: { tag: 'WF', midZ: 3.4, tipZ: 5.0, tol: 0.1 },
  flapDuring: () => true,
  // extras: phase coverage, rudder-activity RMS, tip oscillation in the turn
  onStep: c => {
    const M = c.custom, ph = c.ap.phase;
    (M.seen ??= {})[ph] = true;
    if (ph === 'CLIMB' || ph === 'CRUISE') { M.drRMS = (M.drRMS ?? 0) + c.sim.ctl.dr ** 2; M.drN = (M.drN ?? 0) + 1; }
    if (ph === 'TURNBACK' || ph === 'INBOUND') {
      M.tipMin = Math.min(M.tipMin ?? 99, c.step.ty); M.tipMax = Math.max(M.tipMax ?? -99, c.step.ty);
    }
  },
  lines: c => {
    const M = c.custom, td = c.td, cg = c.cg;
    const [xAf] = c.sim.axes();
    M.finalPitch = Math.asin(Math.max(-1, Math.min(1, -xAf[1]))) * 57.3;
    M.rudRMS = Math.sqrt((M.drRMS ?? 0) / Math.max(1, M.drN ?? 0)) * 57.3;
    M.tipP2P = (M.tipMax ?? 0) - (M.tipMin ?? 0);
    const L = [`FINAL ATTITUDE: pitch ${M.finalPitch.toFixed(1)} deg (three-point ~11), cg alt ${cg[1].toFixed(2)} (rest 1.5), min rollout pitch ${c.rollPitchMin.toFixed(1)} deg`];
    if (td) L.push(`\nTOUCHDOWN: sink=${td.sink.toFixed(2)} m/s  x=${td.x.toFixed(0)}  z=${td.z.toFixed(1)}  V=${td.V.toFixed(1)} m/s (${(td.V*3.6).toFixed(0)} km/h)`);
    L.push(`STOP: x=${cg[0].toFixed(0)}  z=${cg[2].toFixed(1)}  strain chassis=${(c.smaxCh*100).toFixed(1)}% gear=${(c.smaxGr*100).toFixed(1)}%`);
    L.push(`WING: flap ${c.flapMin.toFixed(1)}..${c.flapMax.toFixed(1)} deg | tip oscillation p2p in turn ${(M.tipP2P*100).toFixed(1)} cm | rudder RMS ${M.rudRMS.toFixed(2)} deg`);
    return L;
  },
  checks: c => {
    const M = c.custom, td = c.td, cg = c.cg;
    return {
      'touchdown': !!td,
      'reached STOPPED': !!(M.seen && M.seen.STOPPED),
      'sink<1.5': td && td.sink < 1.5,
      '|tdZ|<4': td && Math.abs(td.z) < 4,
      'tdX in (-660,-240)': td && td.x > -660 && td.x < -240,
      'stopX<20': cg[0] < 20,
      '|stopZ|<8': Math.abs(cg[2]) < 8,
      'chassis<8%': c.smaxCh < 0.08,
      'gear<35%': c.smaxGr < 0.35,
      'flapMin>-4': c.flapMin > -4,
      'flapMax<12': c.flapMax < 12,
      'rudderRMS<4': M.rudRMS < 4,
      'tipOsc<12cm': M.tipP2P < 0.12,
      'finalPitch in (5,16)': M.finalPitch > 5 && M.finalPitch < 16,
      'cgAlt>1.25': cg[1] > 1.25,
      'rolloutPitchMin>1': c.rollPitchMin > 1,
    };
  },
});
