// GATE XCTY2 — the hard cross-country: C172 HOME -> Holtorham Field,
// 9.9 km SOUTH over the mountain belt to a 650 m grass strip approached
// from abeam. This exact route broke four ways during development
// (instant INBOUND from abeam, velocity-aimed terrain guard, high fix
// arrival overflying, fiche aim point short of a 650 m threshold) —
// each failure mode is pinned here.
const { buildC172, makeWorld } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

const world = makeWorld();
const dest = world.aerodromes.find(a => a.name === 'Holtorham Field');
console.log(`XCTY2: HOME -> ${dest.name} @ ${Math.round(dest.x)},${Math.round(dest.z)}` +
  ` (${(Math.hypot(dest.x + 520, dest.z) / 1000).toFixed(1)} km over the belt, len ${dest.len})`);
const thr = -450 - 0.25 * dest.len;

runCircuit({
  id: 'XCTY2', build: buildC172, world, dest: dest.id,
  perturb: { z: 1.2, v: 0.001 }, settleS: 10, maxS: 700,
  tip: { tag: 'WF', midZ: 2.30, tipZ: 5.50, tol: 0.2 },
  onStep: c => {
    const M = c.custom, ph = c.ap.phase;
    (M.seen ??= {})[ph] = true;
    if (ph === 'ENROUTE') {
      const cg = c.sim.cgPos();
      M.minClear = Math.min(M.minClear ?? 9e9, cg[1] - c.world.terrainH(cg[0], cg[2]));
    }
  },
  extraLines: c => [
    `ENROUTE min terrain clearance: ${(c.custom.minClear ?? -1).toFixed(0)} m | strip [${thr.toFixed(0)}, ${(thr + dest.len).toFixed(0)}]`,
  ],
  checks: c => {
    const M = c.custom, td = c.td;
    return {
      'touchdown': !!td,
      'reached STOPPED': !!(M.seen && M.seen.STOPPED),
      'flew ENROUTE': !!(M.seen && M.seen.ENROUTE),
      'sink<1.5': td && td.sink < 1.5,
      'td past threshold': td && td.x > thr,
      'td in first half': td && td.x < thr + dest.len * 0.55,
      '|tdZ|<5': td && Math.abs(td.z) < 5,
      'stop before strip end': c.ap.dbg.s < thr + dest.len,
      '|stop cross|<10': Math.abs(c.ap.dbg.z) < 10,
      'terrain clearance>35': (M.minClear ?? 0) > 35,
      'chassis<8%': c.smaxCh < 0.08,
      'gear<40%': c.smaxGr < 0.40,
    };
  },
});
