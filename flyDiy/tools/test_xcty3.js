// GATE XCTY3 — spawn-at-aerodrome + return leg: the Cub spawns at
// Morford Airfield (rotated onto its heading, W10 placeAtAerodrome),
// takes off from the 900 m paved strip and flies home, landing in the
// standard HOME windows — the same numbers every home circuit is gated
// on. Proves departure generalization end to end.
const { buildCub, makeWorld } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

const world = makeWorld();
const from = world.aerodromes.find(a =>
  a.kind === 'main' && a.id !== 'HOME' && a.surface === world.SURFACE.PAVED);
console.log(`XCTY3: ${from.name} -> HOME (return leg, spawn hdg ${(from.hdg * 57.3).toFixed(0)} deg)`);

runCircuit({
  id: 'XCTY3', build: buildCub, world, from: from.id, dest: 'HOME',
  perturb: { z: 1.2, v: 0.001 }, settleS: 15, maxS: 450,
  tip: { tag: 'WF', midZ: 3.4, tipZ: 5.0, tol: 0.1 },
  onStep: c => {
    const M = c.custom, ph = c.ap.phase;
    (M.seen ??= {})[ph] = true;
    if (ph === 'ENROUTE') {
      const cg = c.sim.cgPos();
      M.minClear = Math.min(M.minClear ?? 9e9, cg[1] - c.world.terrainH(cg[0], cg[2]));
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
      'stopX<100': c.ap.dbg.s < 100,
      '|stop cross|<10': Math.abs(c.ap.dbg.z) < 10,
      'terrain clearance>40': (M.minClear ?? 0) > 40,
      'chassis<8%': c.smaxCh < 0.08,
      'gear<35%': c.smaxGr < 0.35,
    };
  },
});
