// ap_gs_table.js (G3305, AP-ADAPT) - THE APPROACH SLOPE PER BUILD, from genTuneAP's own numbers (no flight): the idle
// gradient at the approach (gsIdle = dragAppr / W - thrFloor x TavailAppr / W, the flapped approach drag), the slope
// flown (A.gs), the final's length from the circuit height (hC / gs), and what the G3305 floor makes of it:
// max(gs, min(0.052, 0.8 gsIdle)). Asserts nothing.
//   node tools/ap_gs_table.js <build.json | archetype key> [...]
'use strict';
const path = require('path');
const T = __dirname;
process.chdir(path.join(T, '..'));
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(process.env.PILOT_CORE || path.join(T, 'flight_core.js'));
const r3 = v => Math.round(v * 1000) / 1000;
for (const f of process.argv.slice(2)) {
  const spec = PT.specOf(f).spec;
  const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
  const A = def.params.ap, g = def.params.gen;
  const gsIdle = g.dragAppr / g.W - A.thrFloor * g.TavailAppr / g.W;
  const floored = Math.max(A.gs, Math.min(0.052, 0.8 * gsIdle));
  const hC = (A.hCruise || 100);
  console.log((PT.specOf(f).name || path.basename(f)).slice(0, 28).padEnd(28), 'gsIdle', r3(gsIdle).toFixed(3), '| gs', A.gs.toFixed(3),
    '(' + (Math.atan(A.gs) * 57.3).toFixed(1) + ' deg, final ~' + Math.round(hC / A.gs) + ' m) | G3305', r3(floored).toFixed(3),
    '(' + (Math.atan(floored) * 57.3).toFixed(1) + ' deg, ~' + Math.round(hC / floored) + ' m)', floored > A.gs + 1e-9 ? 'MOVES' : 'same');
}
