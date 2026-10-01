#!/usr/bin/env node
// tank_bay_probe.js - WHAT A BODY BAY REALLY HOLDS (G1109, CUB-COCKPIT 2026-09-30)
//
// A0's doubt, before any capacity cut: the J-3 carries 12 US gal (45 L) in
// exactly the Cub's nose bay - high, above the pilot's feet, the firewall
// ahead and the panel aft - so if our search finds 16 L, suspect the SHAPES
// (a box or a cylinder cannot fill a curved deck) or the crew's envelope
// before the bay. This measures the bay itself, as the game builds it (the
// joined card, the crew layer loaded), on a grid in the energy layer's frame:
//   per station z in the bay (firewall .. panel) and lateral x:
//     yTop    the deck's inner surface (the sheet, first hit going up from
//             the bay's band floor), less the 35 mm wall the fit keeps
//     yCrew   the crew's highest point in that column (feet, pedals, seat)
//     yDash   the dash's lowest point in that column, if the dash is there
//   and the volume between max(yCrew, band floor) + margin and yTop - wall,
//   where the column is also clear of the dash: the litres a tank that
//   FOLLOWED the deck could hold. Printed per station, and in total.
//
//   node tools/tank_bay_probe.js --only cub [--bay nose] [--json out.json]
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const key = opt('only', 'cub'), bayKey = opt('bay', 'nose');
const T = __dirname;
const SH = require(path.join(T, '_scene_headless.js'));
for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js',
                 '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
const BJ = require(path.join(T, '_bake_joined.js'));
const { C } = BJ.loadPanel();
const X = SH.context(); const W = X.ctx, THREE = X.THREE;
SH.stubCanvas(); console.error = () => {};
const spec = BJ.bakeCard(key).spec, def = C.buildGen(spec);
W.CAGE_ENERGY.fromSpec(spec.energy);
const r = SH.sceneBuild(spec, { garage: spec, resolved: () => def.spec, inGame: true });
const E = W.CAGE_ENERGY;
const res = (E.results() || []).find(q => q.v && q.v.bay === bayKey) || (E.results() || [])[0];
const bay = E.bays().find(b => b.key === bayKey);
const sec = res && res.section, c0 = res && res.c;
if (!bay || !sec || !c0) { console.log('no bay / placement for ' + key + ' ' + bayKey); process.exit(1); }
// the energy group's frame is the scene's (identity), metres; z forward
const FS = r.FS;
const zOf = along => c0[2] - (along - (res.along != null ? res.along : 0));
const z0 = zOf(bay.x1), z1 = zOf(bay.x0);               // aft (panel side) .. forward (firewall side)
// the sheet as a raycast mesh, split: dash faces apart
const M = r.built.sheet, posAll = [], posDash = [];
for (const f of M.F) { const v = f.v; if (!v || v.length < 3) continue;
  const dst = (f.m === 'dash' || f.m === 'dashFace') ? posDash : posAll;
  for (let i = 1; i + 1 < v.length; i++) for (const k of [v[0], v[i], v[i + 1]]) { const q = M.V[k]; dst.push(q[0] * FS, q[1] * FS, q[2] * FS); } }
const meshOf = pos => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.updateMatrixWorld(true); return m; };
const skin = meshOf(posAll), dash = meshOf(posDash);
// the crew's points
const crew = []; const V = new THREE.Vector3();
for (const ch of r.scene.children) if (ch.name === 'cageLayer:crew') ch.traverse(o => { if (!o.isMesh) return; const P = o.geometry.attributes.position;
  for (let i = 0; i < P.count; i++) { V.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); crew.push([V.x, V.y, V.z]); } });
const rc = new THREE.Raycaster();
const WALL = 0.035, MARGIN = 0.02, NZ = 12, NX = 16, dx = (sec.xHi - sec.xLo) / NX;
const floor0 = sec.band[0];
let litres = 0; const rows = [];
for (let iz = 0; iz < NZ; iz++) {
  const z = z0 + (z1 - z0) * (iz + 0.5) / NZ, dz = (z1 - z0) / NZ;
  let rowL = 0; const cols = [];
  for (let ix = 0; ix < NX; ix++) {
    const x = sec.xLo + dx * (ix + 0.5);
    rc.set(new THREE.Vector3(x, floor0, z), new THREE.Vector3(0, 1, 0)); rc.far = 3;
    const up = rc.intersectObject(skin, false);
    if (!up.length) { cols.push(null); continue; }
    const yTop = up[0].point.y - WALL;
    let yCrew = -Infinity;
    for (const p of crew) if (Math.abs(p[0] - x) <= dx / 2 && Math.abs(p[2] - z) <= dz / 2 && p[1] < yTop + 0.2 && p[1] > yCrew) yCrew = p[1];
    rc.set(new THREE.Vector3(x, floor0, z), new THREE.Vector3(0, 1, 0));
    const dh = rc.intersectObject(dash, false).filter(h => h.point.y < yTop + WALL);
    const yLo = Math.max(floor0, isFinite(yCrew) ? yCrew + MARGIN : floor0);
    // a dash face in the column caps it from below the deck (the tank stops under the dash)
    const yHi = dh.length ? Math.min(yTop, dh[0].point.y - MARGIN) : yTop;
    const h = Math.max(0, yHi - yLo);
    rowL += h * dx * dz * 1000;
    cols.push({ x: +x.toFixed(3), yTop: +yTop.toFixed(3), yCrew: isFinite(yCrew) ? +yCrew.toFixed(3) : null, yDash: dh.length ? +dh[0].point.y.toFixed(3) : null, h: +h.toFixed(3) });
  }
  litres += rowL;
  rows.push({ z: +z.toFixed(3), litres: +rowL.toFixed(2), cols });
}
console.log(key + ' ' + bayKey + ': bay x ' + bay.x0.toFixed(3) + '..' + bay.x1.toFixed(3) + ' m (' + ((bay.x1 - bay.x0) * 1000).toFixed(0) + ' mm), band ' + sec.band.map(v => v.toFixed(3)).join('..') +
  ', section x ' + sec.xLo.toFixed(3) + '..' + sec.xHi.toFixed(3));
for (const rw of rows) console.log('  z ' + rw.z.toFixed(3) + '  ' + rw.litres.toFixed(1) + ' L   h(mm) ' + rw.cols.map(c => c ? (c.h * 1000).toFixed(0) : '-').join(' ') +
  '   crew top ' + Math.max(...rw.cols.filter(c => c && c.yCrew != null).map(c => c.yCrew)).toFixed(3));
console.log('  the volume a deck-following tank could hold (wall 35 mm, 20 mm over the crew and under the dash): ' + litres.toFixed(1) + ' L (x0.94 ullage -> ' + (litres * 0.94).toFixed(1) + ' L of fuel)');
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ key, bay: bayKey, rows, litres }, null, 1));
