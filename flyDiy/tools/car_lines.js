#!/usr/bin/env node
// CAR LINES (CAR-1, 2026-11-12) - the drawn body's LINES station by station, and the bonnet's against them: where a
// profile breaks (a frame's step at a pillar, a waist that slopes, a bonnet that swells), in millimetres rather than by
// eye on a picture. Found the roadster's: the windscreen frame's 1 cm step in the bottom line, the birth fit's sloping
// bonnet waist, the head lobes' 2.5 cm swell (futureDesigns/CAR-1-2026-11.md "The second review").
//   node tools/car_lines.js --key roadster [--over '{"row":v}']   the body (CAGE_GEAR.AF: top, bottom, widest half-width
//                                                                  and its height, every 0.1 m) and the cowl's vertices
//                                                                  binned by station; then both sections at the joint,
//                                                                  height by height (half-widths and their difference)
// Garage frame, metres: x right, y up, z forward.
'use strict';
const path = require('path');
const T = __dirname;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const KEY = opt('key'); if (!KEY) { console.error('usage: node tools/car_lines.js --key <card> [--over JSON]'); process.exit(2); }
const BJ = require(path.join(T, '_bake_joined.js')), SH = require(path.join(T, '_scene_headless.js'));
const { D } = BJ.loadPanel();
const a = D.ARCHETYPES.find(x => x.key === KEY); if (!a) { console.error('no card ' + KEY); process.exit(2); }
const o = JSON.parse(JSON.stringify(a.over || {})); o.cage = Object.assign({}, o.cage, JSON.parse(opt('over') || '{}'));
const spec = D.designBake(a.sel, o);
const S = SH.sceneBuild(spec, { garage: spec }), AF = S.W.CAGE_GEAR.AF, THREE = S.W.THREE;
const f3 = v => v.toFixed(3).padStart(7);
console.log('BODY    z      top     bot   halfW  y(widest)   (airframe z ' + AF.z0.toFixed(2) + ' .. ' + AF.z1.toFixed(2) + ')');
for (let z = AF.z0 + 0.02; z <= AF.z1 - 0.01; z += 0.1) {
  let top = -9, bot = 9, w = 0, yW = 0;
  for (let k = 0; k <= 180; k++) { const q = AF.surf(z, k * Math.PI / 180); if (!q || !isFinite(q[1])) continue;
    top = Math.max(top, q[1]); bot = Math.min(bot, q[1]); if (Math.abs(q[0]) > w + 1e-4) { w = Math.abs(q[0]); yW = q[1]; } }
  console.log('     ' + [z, top, bot, w, yW].map(f3).join(' '));
}
const cowl = [];
S.scene.traverse(m => { if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
  let n = m, c = false; while (n) { if (/cowl/i.test(n.name || '')) c = true; n = n.parent; } if (!c) return;
  m.updateMatrixWorld(true); const P = m.geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); cowl.push([v.x, v.y, v.z]); } });
if (cowl.length) {
  const bins = {};
  for (const [x, y, z] of cowl) { if (z < AF.z1 - 0.15) continue; const b = Math.round(z * 10) / 10;
    const B = bins[b] || (bins[b] = { top: -9, bot: 9, w: 0, yW: 0 }); B.top = Math.max(B.top, y); B.bot = Math.min(B.bot, y);
    if (Math.abs(x) > B.w + 1e-4) { B.w = Math.abs(x); B.yW = y; } }
  console.log('COWL    z      top     bot   halfW  y(widest)');
  for (const z of Object.keys(bins).map(Number).sort((p, q) => p - q)) { const B = bins[z]; console.log('     ' + [z, B.top, B.bot, B.w, B.yW].map(f3).join(' ')); }
  // the two sections at the joint
  const zb = AF.z1 - 0.12, zc = AF.z1 + 0.2;
  const body = []; for (let k = 0; k <= 360; k++) { const q = AF.surf(zb, k * Math.PI / 360); if (q) body.push(q); }
  const cw = cowl.filter(p => Math.abs(p[2] - zc) < 0.06);
  const wAt = (pts, y) => { let w = 0; for (const p of pts) if (Math.abs(p[1] - y) < 0.025) w = Math.max(w, Math.abs(p[0])); return w; };
  console.log('JOINT   y   body(z ' + zb.toFixed(2) + ')  cowl(z ' + zc.toFixed(2) + ')  cowl - body, mm');
  for (let y = 0.48; y >= -0.42; y -= 0.06) { const b = wAt(body, y), c = wAt(cw, y); if (!(b > 0 && c > 0)) continue;
    console.log('     ' + y.toFixed(2).padStart(6) + f3(b) + '      ' + f3(c) + '     ' + ((c - b) * 1000).toFixed(0).padStart(5)); }
}
