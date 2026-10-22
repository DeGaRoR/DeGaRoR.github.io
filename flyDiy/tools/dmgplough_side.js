#!/usr/bin/env node
// G1808 DMG-PLOUGH: DMG-HULL's side force (G1847) re-read against the hump trim. The float on the rigid bench at the
// hump speed DMG-HULL measured, carrying the vertical load it carried there, at a sweep of trims (the draft found for
// each); 3 deg of slip; the side force, its centre from the step, and from the aeroplane's CG.
// node tools/dmgplough_side.js [--json]
'use strict';
const path = require('path'), fs = require('fs');
const C = require(path.join(__dirname, 'flight_core.js'));
const L = require(path.join(__dirname, '_treecrash_lib.js'));
const H = C.HYDRO, D2R = Math.PI / 180;
function floatP(key) {
  // G2031 (DMG-RECAL): the twin AS THE GAME FLIES IT (tools/_load_build.js `twinFloats`); FLYDIY_RAW_BUILDS=1: the fixture
  return L.defOf(key === 'twin' ? 'twinFloats' : 'floats', { elastic: true }).parts.floats[0].P;
}
// DMG-HULL's hump poses (GATE DMGHULL's law table: V, step keel draft, trim) and the CG in the float frame (x aft of
// the step keel, measured at rest off the sim: the twin 0.22 m ahead of the step, the Cessna 0.67 m)
const CASES = { twin: { V: 7.1, draft: 0.272, trim: 4.6, cgX: -0.22 }, cessna: { V: 11.1, draft: 0.274, trim: 10.5, cgX: -0.67 } };
const out = {};
for (const key of Object.keys(CASES)) {
  const c = CASES[key], P = floatP(key), F = H.makeFloat(P), sc = H.makeScratch(F);
  const run = (trim, keelY, U, w) => { const S = H.makeBody(F, { trim, keelY }); S.v[0] = -U; S.v[2] = w; H.hydroForces(F, S, H.stillWater, sc); return sc; };
  const Fy0 = run(c.trim, -c.draft, c.V, 0).F[1];
  const rows = [];
  for (const trim of [2, 4, 4.6, 6, 6.5, 8, 10, 10.5, 12, 14]) {
    let lo = -1, hi = 0.5;
    for (let it = 0; it < 50; it++) { const m = 0.5 * (lo + hi); if (run(trim, m, c.V, 0).F[1] > Fy0) lo = m; else hi = m; }
    const ky = 0.5 * (lo + hi), v1 = Math.tan(3 * D2R) * c.V;
    const s = run(trim, ky, c.V, v1);
    const side = Math.abs(s.terms.side[2]), xcp = s.side.xcp, wetA = s.wetA;
    rows.push({ trim, draft: -ky, side: +side.toFixed(1), xcp: +xcp.toFixed(3), fromCG: +(xcp - c.cgX).toFixed(3), wetA: +wetA.toFixed(3), afterDraft: +Math.max(0, s.d[F.edge.KA]).toFixed(3) });
  }
  out[key] = { case: c, aftAngle: P.aftAngle, rows };
  console.log(`${key}: V ${c.V} m/s, the load DMG-HULL's hump carried (${Fy0.toFixed(0)} N on one float); the afterbody keel rises ${P.aftAngle} deg; CG ${-c.cgX} m ahead of the step`);
  console.log('   trim | step draft | side N (3 deg) | centre from step m | from CG m (+ = aft) | afterbody wet m2 | afterbody keel draft at the step m');
  for (const r of rows) console.log(`   ${String(r.trim).padStart(4)} | ${r.draft.toFixed(3)} | ${r.side.toFixed(1).padStart(7)} | ${r.xcp.toFixed(3).padStart(7)} | ${r.fromCG.toFixed(3).padStart(7)} | ${r.wetA.toFixed(3)} | ${r.afterDraft.toFixed(3)}`);
}
if (process.argv.includes('--json')) console.log('JSON ' + JSON.stringify(out));
