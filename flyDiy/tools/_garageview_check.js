#!/usr/bin/env node
// _garageview_check.js - GATE GARAGEVIEW (GARAGE-VIEW, 22 Nov 2026): THE COOKED WORLD OUT OF A HANGAR'S DOOR IS TODAY'S WORLD.
//
// The user, 22 Nov: "It will measure in the world what are the distances. It will recreate a scene that is exactly like
// this" - and "generalise this so we can update / re-use on other hangars automatically or semi automatically". A cooked
// scene (tools/garage_view/, media/garage_view/<pack>/) is a snapshot: it goes stale the day a hangar is moved or the
// world's record changes. This gate says so, by name, instead of the garage quietly showing yesterday's airfield.
//
//   1 every pack of src/core/garage_view_packs.json has its site file (tools/garage_view/sites/<pack>.json) and they agree
//   2 FRESH: each shed's place and yaw in the pack are the composed record's TODAY (1 cm, 0.001 rad), and the pack's
//     signature is the record's rev + those sheds' (site.js sigOf) - a miss names the pack and the command that re-cooks it
//   3 the scene is whole and light: every file scene.json names is there; its arrays fit scene.bin; under the budget
//     (BUDGET: triangles, scene.bin, pictures, meshes = draws)
//   4 the scene's frame: its origin stands within 300 m of every shed it serves; a shed's room frame (the door at local -x)
//     puts the scene's ground out of the door (the nearest ground vertex in front of the door is lower than the sill)
//   5 the page's seams: garage_view.js is in the build manifest after hangar.js's view, the room has gviewFrom and keeps the
//     hand-drawn outdoors down while a scene stands, the runtime places the scene by the shed's TRUE yaw (no siteToLocal)
// Usage: node tools/_garageview_check.js. Exit 1 on any FAIL. An empty pack list passes 1-4 (nothing cooked yet).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, msg, detail) => { if (!c) fails++; console.log((c ? '  PASS ' : '  FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); };
const BUDGET = { tris: 160000, bin: 6 * 1048576, textures: 24 * 1048576, meshes: 10 };
const SITES = require(path.join(__dirname, 'garage_view', 'site.js'));
const PF = path.join(ROOT, 'src', 'core', 'garage_view_packs.json');
const PK = fs.existsSync(PF) ? JSON.parse(fs.readFileSync(PF, 'utf8')) : { v: 1, packs: [] };
console.log('GATE GARAGEVIEW: ' + PK.packs.length + ' pack' + (PK.packs.length === 1 ? '' : 's') + (PK.packs.length ? ' (' + PK.packs.map(p => p.id).join(', ') + ')' : ' (none cooked: the rooms keep their own outdoors)'));

const worlds = new Map();
const worldOf = (world, fixture) => { const k = world + '|' + fixture; if (!worlds.has(k)) { const C = require(path.join(__dirname, 'flight_core.js')), IN = require(path.join(__dirname, 'island_node.js'));
    const txt = fs.readFileSync(path.join(__dirname, 'fixtures', fixture), 'utf8'), W = IN.islandWorld(world, { premises: txt }); worlds.set(k, { C, W, rev: JSON.parse(txt).rev || null }); } return worlds.get(k); };
for (const P of PK.packs) {
  const redo = 'node tools/garage_view/measure.js --site ' + P.id + ' ... (tools/GARAGE_VIEW.md: survey, capture, build)';
  let S = null; try { S = SITES.read(P.id); } catch (e) {}
  ok(!!S && S.world === P.world && S.field === P.field && P.sheds.every(s => S.sheds.some(q => q.id === s.id)), '1 ' + P.id + ': its site file names the same world, field and sheds', S ? '' : 'no tools/garage_view/sites/' + P.id + '.json');
  if (!S) continue;
  // 2 fresh
  const { C, W, rev } = worldOf(S.world, S.fixture), site = W ? C.siteOf(S.field) : null, bad = [], now = [];
  for (const s of P.sheds) { const H = site ? ((s.id === S.field && site.hangar) ? site.hangar : (site.plots || []).find(p => p.id === s.id)) : null;
    if (!H) { bad.push(s.id + ': no such plot today'); continue; }
    const ry = H.ry !== undefined ? +H.ry : Math.PI - H.hdg; now.push({ id: s.id, x: H.x, z: H.z, ry });
    if (Math.hypot(H.x - s.x, H.z - s.z) > 0.01) bad.push(s.id + ' moved ' + Math.hypot(H.x - s.x, H.z - s.z).toFixed(2) + ' m');
    if (Math.abs(Math.atan2(Math.sin(ry - s.ry), Math.cos(ry - s.ry))) > 0.001) bad.push(s.id + ' turned ' + ((ry - s.ry) * 180 / Math.PI).toFixed(2) + ' deg'); }
  ok(!bad.length, '2a ' + P.id + ': every shed stands where the scene was cooked (' + P.sheds.map(s => s.id).join(', ') + ')', bad.length ? bad.join('; ') + ' -> STALE: ' + redo : '');
  ok(P.sig === SITES.sigOf(rev, now), '2b ' + P.id + ': cooked from today\'s record (rev ' + rev + ')', P.sig === SITES.sigOf(rev, now) ? '' : 'the pack was cooked from rev ' + P.rev + ' -> STALE: ' + redo);
  // 3 whole and light
  const dir = path.join(ROOT, P.base), jf = path.join(dir, 'scene.json');
  if (!fs.existsSync(jf)) { ok(false, '3 ' + P.id + ': ' + P.base + 'scene.json exists'); continue; }
  const J = JSON.parse(fs.readFileSync(jf, 'utf8')), names = Object.keys(J.textures || {}).map(k => J.textures[k].file), miss = ['scene.bin'].concat(names).filter(f => !fs.existsSync(path.join(dir, f)));
  ok(!miss.length, '3a ' + P.id + ': every file the scene names is there (' + (names.length + 1) + ')', miss.join(', '));
  if (miss.length) continue;
  const binN = fs.statSync(path.join(dir, 'scene.bin')).size, texN = names.reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0), tris = J.meshes.reduce((a, m) => a + m.tris, 0), BYTES = { f32: 4, u32: 4, u16: 2, u8: 1 };
  const over = []; for (const m of J.meshes) for (const k of ['pos', 'nrm', 'uv', 'col', 'idx']) if (m[k] && m[k].at + m[k].n * BYTES[m[k].t] > binN) over.push(m.name + '.' + k);
  const untex = J.meshes.filter(m => m.kind !== 'ring' && !m.tex).map(m => m.name);
  ok(!over.length, '3b ' + P.id + ': every array lies inside scene.bin', over.join(', '));
  ok(!untex.length, '3c ' + P.id + ': every mesh but the far ring wears a picture (the look is whole)', untex.join(', '));
  ok(tris <= BUDGET.tris && binN <= BUDGET.bin && texN <= BUDGET.textures && J.meshes.length <= BUDGET.meshes, '3d ' + P.id + ': under the budget - ' + tris + ' triangles (' + BUDGET.tris + '), scene.bin ' + (binN / 1048576).toFixed(2) + ' MB (' + BUDGET.bin / 1048576 + '), pictures ' + (texN / 1048576).toFixed(2) + ' MB (' + BUDGET.textures / 1048576 + '), ' + J.meshes.length + ' meshes (' + BUDGET.meshes + ')');
  // 4 the frame
  const far = P.sheds.map(s => Math.hypot(J.origin[0] - s.x, J.origin[2] - s.z));
  ok(far.every(d => d < 300), '4a ' + P.id + ': the scene\'s origin within 300 m of every shed (' + far.map(d => d.toFixed(0)).join(', ') + ' m)');
  const B = fs.readFileSync(path.join(dir, 'scene.bin')), G = J.meshes.find(m => m.kind === 'ground');
  if (G) { const pos = new Float32Array(B.buffer.slice(B.byteOffset + G.pos.at, B.byteOffset + G.pos.at + G.pos.n * 4)), outOf = [];
    for (const s of P.sheds) { const c = Math.cos(s.ry), sn = Math.sin(s.ry), HD = (J.sheds.find(q => q.id === s.id) || {}).HD || 12.5; let best = null;
      for (let i = 0; i < pos.length; i += 3) { const dx = pos[i] + J.origin[0] - s.x, dz = pos[i + 2] + J.origin[2] - s.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c; if (lx < -HD - 2 && lx > -HD - 12 && Math.abs(lz) < 4) { const y = pos[i + 1] + J.origin[1] - s.y; if (best === null || Math.abs(y) < Math.abs(best)) best = y; } }
      outOf.push(s.id + ' ' + (best === null ? 'no ground' : best.toFixed(2) + ' m')); if (best === null || Math.abs(best) > 0.6) fails++; }
    console.log('  ' + (outOf.every(t => !/no ground/.test(t)) ? 'INFO ' : 'FAIL ') + '4b ' + P.id + ': the ground 2-12 m out of each door against its sill: ' + outOf.join('; ')); }
}
// 5 the page's seams
{ const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), build = src('tools/build.js'), han = src('src/viewer/hangar.js'), gv = src('src/viewer/garage_view.js'), app = src('src/viewer/app.js');
  ok(/'hangar_view\.js',[^\n]*\n\s*'garage_view\.js'/.test(build), '5a the build manifest carries garage_view.js after hangar_view.js');
  ok(/gviewFrom: pack =>/.test(han) && /GARAGE_VIEW\.build\(THREE, pack, \{ shed: SHED_W/.test(han), '5b the room stands a scene by its shed\'s place in the world (gviewFrom, SHED_W)');
  ok(/o\.visible = !viewOut && \(!GVIEW \|\| o === GVIEW\.group\)/.test(han) && /ROOM_PAD\.visible = !viewOut && !GVIEW/.test(han), '5c the hand-drawn outdoors stay down while a scene stands (outdoorsShow)');
  ok(/group\.rotation\.y = -sh\.ry/.test(gv) && !/siteToLocal/.test(gv), '5d the scene is placed by the shed\'s TRUE yaw (no siteToLocal quarter turn)');
  ok(/fog: false/.test(gv) && /customProgramCacheKey = \(\) => 'gview-haze'/.test(gv), '5e the scene\'s materials: no room fog, ONE haze injection (one program key)');
  ok(/gviewTick\(\)/.test(app) && /GARAGE_VIEW\.find\(window\.FLYDIY_WORLD, roomBase\(\), roomId\(\)\)/.test(app), '5f app.js asks for the room\'s scene by its world, field and shed, behind the room (gviewTick, GARAGE_VIEW.find)');
}
console.log(fails ? 'GATE GARAGEVIEW: FAIL (' + fails + ')' : 'GATE GARAGEVIEW: PASS');
process.exit(fails ? 1 : 0);
