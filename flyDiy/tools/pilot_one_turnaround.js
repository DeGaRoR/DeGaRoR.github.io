#!/usr/bin/env node
// PILOT-ONE (G1938): THE TURN-AROUND AT THE END OF A ONE-WAY STRIP, MEASURED. The aeroplane stands where a landing
// ends - on the centreline, 20 m from the far end, nose to it - and THE PILOT is asked to depart again (departFrom,
// the site's own plan). Every step until the roll begins is judged: the CG's distance off the centreline, past an
// end, and whether the ground under it is still the strip's surface (a site may lay its taxi lane beside the strip
// on the same surface - G710's clearance round parked aeroplanes - so the surface is the judge, not the width).
//
//   node tools/pilot_one_turnaround.js [builds] [strip]   e.g.  cub,jodel,cessna172 nv_strip
//   env CORE=<flight_core.js> flies another core (the before / after evidence); DBG=1 prints the 0.5 s trace
'use strict';
const fs = require('fs'), path = require('path');
const C = require(process.env.CORE || path.join(__dirname, 'flight_core.js'));
const IN = require(path.join(__dirname, 'island_node.js'));
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8') });
const id = process.argv[3] || 'nv_strip';
const a = W.aerodromes.find(q => q.id === id);
const site = C.siteOf(id);
const builds = (process.argv[2] || 'cub,jodel,cessna172').split(',');
function turnaround(b) {
  const d = C.buildGen(C.genMigrateSpec(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'builds', b + '_2026-09-20_corrected.json'))).spec));
  const lh = typeof a.landHdg === 'number' ? a.landHdg : a.hdg;
  const ux = Math.cos(lh), uz = Math.sin(lh);
  const pose = { x: a.x + ux * (a.len / 2 - 20), z: a.z + uz * (a.len / 2 - 20), hdg: lh };
  const sim = C.makeSim(d, W); sim.reset(0); if (sim.stance) sim.stance();
  C.placeAtLineup(sim, a, pose, W, d.refs);
  for (let i = 0; i < 300; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, d, W); ap.setRoute(a, a); ap.departFrom(a, a, site);
  const R = { b, tRoll: null, maxX: 0, beyond: -1e9, offSurf: 0, phases: [], end: null, verdicts: null, lift: false };
  let t = 0, last = '';
  const ax = Math.cos(a.hdg), az = Math.sin(a.hdg);
  for (let i = 0; i < 60 * 200; i++) {
    ap.update(1 / 60); sim.step(1 / 60); t += 1 / 60;
    const cg = sim.cgPos(); const rx = cg[0] - a.x, rz = cg[2] - a.z;
    const al = rx * ax + rz * az, cr = -rx * az + rz * ax;
    if (ap.phase !== last) { R.phases.push(t.toFixed(1) + ' ' + ap.phase); last = ap.phase; }
    if (R.tRoll == null) {
      R.maxX = Math.max(R.maxX, Math.abs(cr)); R.beyond = Math.max(R.beyond, Math.abs(al) - a.len / 2);
      if (W.surface(cg[0], cg[2]) !== a.surface || Math.abs(al) > a.len / 2) R.offSurf += 1 / 60;
    }
    if (process.env.DBG && i % 30 === 0) { const [xA] = sim.axes(), v = sim.cgVel(); console.log(t.toFixed(1), ap.phase, 'al', al.toFixed(1), 'cr', cr.toFixed(1), 'Vg', Math.hypot(v[0], v[2]).toFixed(2), 'hdg', (Math.atan2(-xA[2], -xA[0]) * 57.3).toFixed(0), 'thr', sim.ctl.thr.toFixed(2), 'dr', sim.ctl.dr.toFixed(2), 'brk', sim.ctl.brake.toFixed(2), 'brkD', (sim.ctl.brakeD || 0).toFixed(2)); }
    if (ap.phase === 'ROLL' && R.tRoll == null) R.tRoll = t;
    if (ap.phase === 'LIFTOFF' || ap.phase === 'CLIMB') { R.lift = true; break; }
    if (ap.phase === 'ABORT') break;
  }
  R.end = ap.phase; R.verdicts = ap.report.verdicts.map(v => v.code).join(',');
  return R;
}
if (require.main === module) {
  for (const b of builds) {
    const R = turnaround(b);
    console.log(`${b} at ${id} (len ${a.len}, wid ${a.wid}): roll at ${R.tRoll != null ? R.tRoll.toFixed(1) : 'never'} s; before it: max |cross| ${R.maxX.toFixed(1)} m, ` +
                `past an end ${R.beyond.toFixed(1)} m, off the strip's surface ${R.offSurf.toFixed(1)} s; then ${R.end}${R.lift ? ' (airborne)' : ''}; ${R.phases.join(' ')}; ${R.verdicts}`);
  }
}
module.exports = { turnaround };
