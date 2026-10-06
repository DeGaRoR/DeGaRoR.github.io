#!/usr/bin/env node
// _roommerge_check.js - GATE ROOMMERGE (G2074, GARAGE-LAPTOP 2026-10-06): THE GARAGE ROOM'S SHELL MERGED IS THE SAME ROOM.
// hangar.js merges the interior shell's static meshes by (material, attribute layout, casts, receives, renderOrder) -
// render_world's mergeShell rules (A1-STAND G600), which the world's exterior copy has had since - and keeps the sources
// aside behind a live switch (hangar.roomMerge). In the page in node (tools/_page_node.js; the Jodel on retro):
//   1 THE MERGE RAN: hundreds of sources into a few dozen meshes, no error
//   2 THE SAME TRIANGLES: every visible mesh of the room, every triangle in world space, oriented (its corners in their
//     winding, from the smallest), with its material, casts / receives and renderOrder - the merged room and its sources
//     swapped back give the SAME multiset (positions to 0.1 mm, vertex normals to 1e-3, uvs to 1e-5)
//   3 THE DRAWS: the garage frame's main-pass draws fall by at least 300; the shadow cache's static set holds the same
//   4 THE PARTS HOLD: every dressable part's material (setPart) is still worn by a visible mesh; a part dressed while merged
//     shows on the merged mesh (it IS the material)
//   5 THE SWITCH: off and on again gives the same soup; the exterior build (render_world's stand) is not touched by it
//     (no merged record); opts.merge false builds the room unmerged
// Usage: node tools/_roommerge_check.js [--build jodel] (it re-runs itself with a 6 GB heap). Exit 1 on any FAIL. No --help.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json' };
const BK = opt('build', 'jodel');
if (require('v8').getHeapStatistics().heap_size_limit < 5e9 && !process.env.ROOMMERGE_CHILD) {
  const r = require('child_process').spawnSync(process.execPath, ['--max-old-space-size=6144', __filename].concat(argv), { stdio: 'inherit', env: Object.assign({}, process.env, { ROOMMERGE_CHILD: '1' }) });
  process.exit(r.status == null ? 1 : r.status);
}
let fails = 0;
const ok = (c, msg, detail) => { if (!c) fails++; console.log((c ? '  PASS ' : '  FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); };

(async () => {
  const { openPage } = require('./_page_node.js');
  const hooks = { afterScript(name, P) { if (/gfx_settings\.js/.test(name) && P.win.GFX) P.win.GFX.set('preset', 'retro'); } };
  const P = await openPage({ quiet: true, hooks, query: 'gfx=retro', storage: { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[BK] || BK), 'utf8') } });
  const W = P.win, TH = W.THREE;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  await P.frames(20);
  const H = W.GARAGE_ENV && W.GARAGE_ENV._debug ? W.GARAGE_ENV._debug().hangar : null;
  ok(!!H, 'the garage has its room');
  if (!H) process.exit(1);
  // 1
  const mg = H.merged;
  ok(!!mg && !mg.error && mg.sources >= 300 && mg.meshes > 0 && mg.meshes <= 60, '1 the shell merged', JSON.stringify(mg));
  // the soup: every visible mesh under the room's group, every triangle in world space
  const soup = () => {
    H.group.updateMatrixWorld(true);
    const out = new Map(), v = new TH.Vector3(), n = new TH.Vector3(), nm = new TH.Matrix3();
    const vis = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    let tris = 0;
    H.group.traverse(o => {
      if (!o.isMesh || !vis(o) || o.isInstancedMesh || o.isLOD) return;
      const g = o.geometry, pa = g && g.attributes && g.attributes.position; if (!pa) return;
      const na = g.attributes.normal, ua = g.attributes.uv, ix = g.index, cnt = ix ? ix.count : pa.count;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      nm.getNormalMatrix(o.matrixWorld);
      const flip = o.matrixWorld.determinant() < 0;
      const corner = i => { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); let s = v.x.toFixed(4) + ',' + v.y.toFixed(4) + ',' + v.z.toFixed(4);
        if (na) { n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); s += '|' + n.x.toFixed(3) + ',' + n.y.toFixed(3) + ',' + n.z.toFixed(3); }
        if (ua) s += '|' + ua.getX(i).toFixed(5) + ',' + ua.getY(i).toFixed(5); return s; };
      for (let t = 0; t + 2 < cnt; t += 3) {
        let a = ix ? ix.getX(t) : t, b = ix ? ix.getX(t + 1) : t + 1, c = ix ? ix.getX(t + 2) : t + 2;
        if (flip) { const x = b; b = c; c = x; }
        let mat = mats[0];
        if (mats.length > 1 && g.groups.length) { const gr = g.groups.find(q => t >= q.start && t < q.start + q.count); mat = gr ? mats[gr.materialIndex] : mats[0]; }
        if (!mat || !mat.visible) continue;
        const k = [corner(a), corner(b), corner(c)];
        let r = 0; for (let i = 1; i < 3; i++) if (k[i] < k[r]) r = i;           // the winding kept, from its smallest corner
        const key = mat.uuid + '#' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + ':' + o.renderOrder + '#' + k[r] + ';' + k[(r + 1) % 3] + ';' + k[(r + 2) % 3];
        out.set(key, (out.get(key) || 0) + 1); tris++;
      }
    });
    return { out, tris };
  };
  const diff = (A, B) => { let only = 0; const ex = [];
    for (const [k, c] of A.out) { const d = c - (B.out.get(k) || 0); if (d > 0) { only += d; if (ex.length < 3) ex.push('A ' + k.slice(0, 90)); } }
    for (const [k, c] of B.out) { const d = c - (A.out.get(k) || 0); if (d > 0) { only += d; if (ex.length < 3) ex.push('B ' + k.slice(0, 90)); } }
    return { only, ex }; };
  // 2
  const sOn = soup();
  H.roomMerge(false); await P.frames(2);
  const sOff = soup();
  const d = diff(sOn, sOff);
  ok(d.only === 0 && sOn.tris > 1000, '2 THE SAME TRIANGLES: the merged room == its sources (oriented, world space, material, casts, order)', sOn.tris + ' vs ' + sOff.tris + ' tris, ' + d.only + ' unmatched ' + d.ex.join(' | '));
  // 3 the draws (the main pass: the canvas / scene target; the shadow cache's static set)
  const R = W.FLIGHT_PROBE.renderer();
  const count = async () => { let draws = 0, inMap = false; const s0 = R.setRenderTarget, b0 = R.renderBufferDirect;
    const maps = new Set(); H.group.traverse(o => { if (o.isLight && o.shadow && o.shadow.map) maps.add(o.shadow.map); });
    R.setRenderTarget = function (t) { inMap = !!(t && maps.has(t)); return s0.apply(this, arguments); };
    R.renderBufferDirect = function () { if (!inMap) draws++; return b0.apply(this, arguments); };
    try { await P.frames(1); } finally { R.setRenderTarget = s0; R.renderBufferDirect = b0; } return draws; };
  await P.frames(30); const offDraws = await count(); const ssOff = W.SHED_SHADOW ? W.SHED_SHADOW.stat() : {};
  H.roomMerge(true); await P.frames(30); const onDraws = await count(); const ssOn = W.SHED_SHADOW ? W.SHED_SHADOW.stat() : {};
  ok(offDraws - onDraws >= 300, '3 the garage frame: at least 300 fewer draws outside the shadow maps', offDraws + ' -> ' + onDraws);
  ok(ssOn.baked < ssOff.baked && ssOn.live <= ssOff.live, '3 the shadow cache bakes the merged shell (fewer, bigger casters; no more live)', 'baked ' + ssOff.baked + ' -> ' + ssOn.baked + ', live ' + ssOff.live + ' -> ' + ssOn.live);
  // 4 the parts
  const visMats = new Set(); H.group.traverse(o => { if (o.isMesh) { let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; if (v) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => visMats.add(m)); } });
  const parts = (H.parts || []).map(p => p.key);
  const mats = H.mats || {};
  const PM = { wallSides: 'wall', wallBack: 'wallBack', roof: 'roofIn', beamsMain: 'beamMain', beamsSec: 'beamSec', doorMan: 'manDoor', doorMain: 'door', stem: 'stem' };
  const orphan = parts.filter(k => PM[k] && mats[PM[k]] && !visMats.has(mats[PM[k]]));
  ok(parts.length > 0 && !orphan.length, '4 every dressable part\'s material is still worn by a visible mesh', parts.length + ' parts' + (orphan.length ? ', orphaned: ' + orphan.join(',') : '') + (H.mats ? '' : ' (no mats map: by name only)'));
  // 5 the switch and the other builds
  H.roomMerge(false); H.roomMerge(true); await P.frames(2);
  const sAgain = soup(), d2 = diff(sOn, sAgain);
  ok(d2.only === 0, '5 off and on again: the same soup', d2.only + ' unmatched');
  let ext = null, plain = null;
  try { ext = W.genHangarBuild(TH, H.dims, { exterior: true }); } catch (e) { ext = { err: e.message }; }
  ok(!!ext && !ext.err && ext.merged === undefined, '5 the exterior build carries no room merge (render_world merges it its own way)', ext && ext.err);
  try { plain = W.genHangarBuild(TH, H.dims, { merge: false }); } catch (e) { plain = { err: e.message }; }
  ok(!!plain && !plain.err && plain.merged === null, '5 opts.merge false: the room built unmerged', plain && (plain.err || JSON.stringify(plain.merged)));
  console.log(fails ? 'GATE ROOMMERGE: ' + fails + ' FAIL' : 'GATE ROOMMERGE: PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
