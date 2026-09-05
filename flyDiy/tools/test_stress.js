// GATE STRESS — full-deflection abuse of the GARAGE BUILD at cruise (the
// seven fiches flew it too until the fleet retired, 2026-09-05).
const { buildGen, makeSim, makeAutopilot, makeWorld } = require('./flight_core.js');
const world = makeWorld();
function stress(name, build, tipTag, tipZ, midZ, flapLim) {
  const def = build();
  const sim = makeSim(def, world);
  sim.reset(0);
  const iM = def.nodes.findIndex(n => n.tag === tipTag && Math.abs(n.p[2] - midZ) < 0.1 && n.p[2] > 0);
  const iT = def.nodes.findIndex(n => n.tag === tipTag && Math.abs(n.p[2] - tipZ) < 0.1 && n.p[2] > 0);
  const ap = makeAutopilot(sim, def);
  // fly to cruise
  let t = 0;
  while (ap.phase !== 'CRUISE' && t < 120) { ap.update(1/60); sim.step(1/60); t += 1/60; }
  if (ap.phase !== 'CRUISE') { console.log(`${name}: never reached cruise`); return false; }
  let flapMin = 99, flapMax = -99, bad = false;
  const measure = () => {
    const [xB, yB, zB] = sim.axes();
    const dx = sim.p[iT*3]-sim.p[iM*3], dy = sim.p[iT*3+1]-sim.p[iM*3+1], dz = sim.p[iT*3+2]-sim.p[iM*3+2];
    const flap = Math.atan2(dx*yB[0]+dy*yB[1]+dz*yB[2], Math.abs(dx*zB[0]+dy*zB[1]+dz*zB[2])) * 57.3;
    flapMin = Math.min(flapMin, flap); flapMax = Math.max(flapMax, flap);
    if (sim.stats().bad) bad = true;
  };
  // maneuver battery: [de, da, dr, seconds] full-deflection abuse, AP overridden
  const seq = [[0.35, 0, 0, 1.5], [0, 0.30, 0, 2.0], [-0.30, 0, 0, 1.0],
               [0.35, 0.30, 0.25, 1.5], [0, -0.30, -0.25, 2.0]];
  for (const [de, da, dr, dur] of seq) {
    for (let s = 0; s < dur*60; s++) {
      sim.ctl.de = de; sim.ctl.da = da; sim.ctl.dr = dr; sim.ctl.thr = 1;
      sim.step(1/60); measure();
    }
  }
  let smax = 0;
  for (const b of sim.beams) if (!b.gear) smax = Math.max(smax, Math.abs(b.strain));
  const ok = !bad && flapMin > -flapLim && flapMax < flapLim + 8 && smax < 0.25;
  console.log(`${name}: flap ${flapMin.toFixed(1)}..${flapMax.toFixed(1)} deg  strain ${(smax*100).toFixed(0)}%  NaN=${bad}  ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}
// GARAGE preset: tip/mid stations come from the spec, not a literal, because
// the generated wing moves when a slider does
const gd = buildGen();
const h = stress('GEN   full-deflection abuse', buildGen, 'WF',
                 gd.parts.zs[gd.parts.zs.length - 1], gd.parts.zs[0], 10);
const pass = h;
console.log(pass ? 'GATE STRESS: PASS' : 'GATE STRESS: FAIL');
process.exitCode = pass ? 0 : 1;
