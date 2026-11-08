// SEA-AMPHIB (test tool): THE AMPHIBIOUS FLOATS AS DRAWN vs AS FLOWN. Draws the float Cessna's game spec with the
// editor's own row fltAmph = 1 / 2 at gearPos 1 (down) and 0 (up) through the page's float layer (_scene_headless), and
// asks the built def (the physics) what it has at the drawn axles: nodes, contact radius, refs.
//   node reports/evidence/SEA-AMPHIB/probe_drawn.js
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..', '..'), T = path.join(R, 'tools');
const LB = require(path.join(T, '_load_build.js'));
const SH = require(path.join(T, '_scene_headless.js'));
const C = require(path.join(T, 'flight_core.js'));
for (const k of [1, 2]) {
  const g = LB.gameSpec(JSON.parse(fs.readFileSync(path.join(__dirname, 'cessna_floats_amph' + k + '.json'), 'utf8')));
  const F = SH.sceneBuild(g, { over: { gearPos: 1 }, garage: g }).W.CAGE_FLOAT;
  const A = F && F.amph;
  console.log('fltAmph ' + k + ' DRAWN: ' + (A ? A.style + ' / ' + A.model + (A.est ? ' (nearest by height)' : '') + ', mains ' + A.mainN + ' x ' + A.main + ', nose ' + A.nose + ', dKg ' + (A.dKg == null ? 'null' : A.dKg.toFixed(1)) + ', keel clearance gear down ' + (A.measured.keelClearance * 1000).toFixed(0) + ' mm' : 'NO amph record'));
  if (A) for (const s of Object.keys(A).filter(q => A[q] && A[q].mainAxle)) console.log('   ' + s + ': main axle ' + A[s].mainAxle.map(v => v.toFixed(3)) + '  nose axle ' + A[s].noseAxle.map(v => v.toFixed(3)) + ' (editor frame)');
  const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(g) : g);
  const wheelsR = def.nodes.map((n, i) => [i, n]).filter(([i, n]) => n.r > 0);
  console.log('   FLOWN: gear.type ' + def.spec.gear.type + ', parts.amph ' + !!(def.parts && def.parts.amph) + ', parts.floats ' + (def.parts.floats ? def.parts.floats.length : 0) +
    ', refs.mains ' + JSON.stringify(def.refs.mains) + ' tw ' + def.refs.tw + ', nodes with a contact radius (wheels): ' + wheelsR.length + ', params.retract ' + JSON.stringify(def.params.retract || null) + ', mass ' + def.nodes.reduce((s, n) => s + n.m, 0).toFixed(1) + ' kg');
  const lo = def.nodes.map((n, i) => [i, n.p[1], n.tag || n.name || '']).sort((a, b) => a[1] - b[1]).slice(0, 4);
  console.log('   lowest flown nodes: ' + lo.map(q => '#' + q[0] + ' ' + q[2] + ' y ' + q[1].toFixed(3)).join(', '));
}
