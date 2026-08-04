// GATE XCTY — cross-country: the Cub flies HOME -> the paved town field
// (contract rule 6 made real: the AP reads W.aerodromes). Asserts the
// ENROUTE leg keeps terrain clearance, and the touchdown/stop land in
// the DESTINATION strip's frame windows (same tdz-relative windows as
// the home circuit — the frame transfer is the whole point).
const { buildCub, makeWorld } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

const world = makeWorld();
const dest = world.aerodromes.find(a =>
  a.kind === 'main' && a.id !== 'HOME' && a.surface === world.SURFACE.PAVED);
console.log(`XCTY: HOME -> ${dest.name} @ ${Math.round(dest.x)},${Math.round(dest.z)}` +
  ` (${(Math.hypot(dest.x + 520, dest.z) / 1000).toFixed(1)} km, hdg ${(dest.hdg * 57.3).toFixed(0)} deg)`);

runCircuit({
  id: 'XCTY', build: buildCub, world, dest: dest.id,
  perturb: { z: 1.2, v: 0.001 }, settleS: 15, maxS: 450,
  tip: { tag: 'WF', midZ: 3.4, tipZ: 5.0, tol: 0.1 },
  onStep: c => {
    const M = c.custom, ph = c.ap.phase;
    (M.seen ??= {})[ph] = true;
    if (ph === 'ENROUTE') {
      const cg = c.sim.cgPos();
      const cl = cg[1] - c.world.terrainH(cg[0], cg[2]);
      M.minClear = Math.min(M.minClear ?? 9e9, cl);
    }
  },
  extraLines: c => [
    `ENROUTE min terrain clearance: ${(c.custom.minClear ?? -1).toFixed(0)} m`,
  ],
  checks: c => {
    const M = c.custom, td = c.td;
    return {
      'touchdown': !!td,
      'reached STOPPED': !!(M.seen && M.seen.STOPPED),
      'flew ENROUTE': !!(M.seen && M.seen.ENROUTE),
      'sink<1.5': td && td.sink < 1.5,
      'tdX in (-660,-240)': td && td.x > -660 && td.x < -240,
      '|tdZ|<5': td && Math.abs(td.z) < 5,
      'stop on strip (s<215)': c.ap.dbg.s < 215,
      '|stop cross|<10': Math.abs(c.ap.dbg.z) < 10,
      'terrain clearance>40': (M.minClear ?? 0) > 40,
      'chassis<8%': c.smaxCh < 0.08,
      'gear<35%': c.smaxGr < 0.35,
    };
  },
});
