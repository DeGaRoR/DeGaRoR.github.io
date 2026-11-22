#!/usr/bin/env node
// GARAGE-VIEW, step 1b: THE DRAWN FOREST ROUND THE TWO HANGARS, tree by tree.
//
// The forest the player sees is not in the premises record: it is the fill's walk in render_world.js (the island's canopy
// map, the biomes' mixes, the runways' clearances, the town's trees), sized by the build. TREE_FILL.census returns each
// tree as the build stands it (species key, series, place, yaw, scale across / up, the model's height, its sink). This
// boots the page in node (tools/_page_node.js: dev.html's own scripts, no GPU), rolls out, and asks for the rectangle.
//
//   node tools/garage_view/census.js [--out dir] [--half 1500] [--cx x --cz z]
//     -> <out>/census.json   { box, n, keys: [species key], trees: [ki, ser, x, y, z, yaw, s, sy, h, town, ...] flat }
// ~5-10 min of one core (the node page's boot and roll-out). Run it through cpu_token.sh.
'use strict';
const fs = require('fs'), path = require('path');
const T = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = opt('out', path.join(T, 'perf', 'garage_view'));
const HALF = +opt('half', 1500);
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const t0 = Date.now();
  const { openPage } = require(path.join(T, '_page_node.js'));
  const P = await openPage({ quiet: true, storage: {}, query: '' });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  console.log('census: boot gone, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s; world ' + W.FLYDIY_WORLD);
  W.document.getElementById('bGo').click();
  const tripDone = () => { const Tr = W.FLYDIY_TRIPS; const t = Tr && Tr[Tr.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout'), 900000);
  console.log('census: rolled out, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  if (!(W.TREE_FILL && W.TREE_FILL.census)) throw new Error('census: TREE_FILL.census is not on the page');
  // the fill's shapes must be the real trees (the packs landed): a cone fallback has no keys
  await P.until(() => { try { const c = W.TREE_FILL.census(-200, 600, -150, 650); return c.length === 0 || c.some(t => t.key); } catch (e) { return false; } }, 300000);
  // THE WORLD SCENE'S GRAPH (for the capture rig's hide lists: what is ground, what stands on it): the scene the page hands
  // FLYDIY_AA.render while flying, three levels down - name, type, children, userData keys, the material's type / name
  try {
    const AA = W.FLYDIY_AA; let sc = null;
    if (AA && AA.render) { const o = AA.render; AA.render = function (s) { if (s && s.isScene) sc = s; return o.apply(this, arguments); }; await P.frames(3); AA.render = o; }
    const THREE = W.THREE;
    const sig = o => { const m = Array.isArray(o.material) ? o.material[0] : o.material, g = o.geometry;
      return [o.name ? o.name.replace(/[:|].*/, ':*') : '-', o.type, o.isInstancedMesh ? 'inst' : '', m ? m.type + (m.name ? ':' + m.name : '') : '', g ? Object.keys(g.attributes || {}).sort().join('+') : '', Object.keys(o.userData || {}).slice(0, 6).join(','), 'ro' + (o.renderOrder || 0), o.visible ? '' : 'HIDDEN', m && m.transparent ? 'transp' : '', m && m.userData && m.userData.progOwner ? 'own=' + m.userData.progOwner : ''].join('|'); };
    const V3 = new THREE.Vector3();
    const row = (o, d) => { const r = { n: o.name || '', s: sig(o), k: o.children.length, v: o.visible ? 1 : 0, groups: {}, ch: [] };
      for (const c of o.children) { if (c.children.length && d < 5) r.ch.push(row(c, d + 1)); else { const s = sig(c), G = r.groups[s] || (r.groups[s] = { n: 0, p: [] }); G.n++;
        if (G.p.length < 3) { c.getWorldPosition(V3); let rad = 0; if (c.geometry) { if (!c.geometry.boundingSphere) c.geometry.computeBoundingSphere(); rad = c.geometry.boundingSphere ? c.geometry.boundingSphere.radius : 0; } G.p.push([+V3.x.toFixed(0), +V3.y.toFixed(0), +V3.z.toFixed(0), +rad.toFixed(0), c.isInstancedMesh ? c.count : 0]); } } }
      return r; };
    if (sc) fs.writeFileSync(path.join(OUT, 'scene_graph.json'), JSON.stringify(row(sc, 0)));
    console.log('census: scene graph ' + (sc ? sc.children.length + ' top children -> scene_graph.json' : 'NOT captured (no FLYDIY_AA.render call)'));
  } catch (e) { console.log('census: scene graph failed: ' + (e && e.message)); }
  const w = W.FLIGHT_PROBE.world(), site = W.siteOf ? W.siteOf('HOME') : null;
  const H = site && site.hangar ? site.hangar : { x: -172.09, z: 640.58 };
  const P2 = site && site.plots ? site.plots.find(p => p.id === 'HOME.2') : null;
  const cx = +opt('cx', P2 ? (H.x + P2.x) / 2 : H.x), cz = +opt('cz', P2 ? (H.z + P2.z) / 2 : H.z);
  const list = W.TREE_FILL.census(cx - HALF, cz - HALF, cx + HALF, cz + HALF);
  const keys = [], ki = new Map(), flat = [];
  for (const t of list) {
    if (!ki.has(t.key)) { ki.set(t.key, keys.length); keys.push(t.key); }
    flat.push(ki.get(t.key), t.ser, +t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2), +t.yaw.toFixed(3), +t.s.toFixed(3), +t.sy.toFixed(3), +t.h.toFixed(2), t.town);
  }
  // the species' own numbers the scene needs (the pack's place: sink, size; the subject's height)
  const packs = {};
  try { for (const e of (W.treeList ? W.treeList() : [])) if (ki.has(e.key)) packs[e.key] = { h: e.sub && e.sub.h, sink: e.col && e.col.place && e.col.place.sink, size: e.col && e.col.place && e.col.place.size, dead: e.col && e.col.place && e.col.place.dead }; } catch (e) {}
  const out = { what: 'GARAGE-VIEW census: the trees the fill draws (render_world TREE_FILL.census)', made: new Date().toISOString(),
    world: W.FLYDIY_WORLD, box: [cx - HALF, cz - HALF, cx + HALF, cz + HALF], rec: 10, fields: ['key', 'ser', 'x', 'y', 'z', 'yaw', 's', 'sy', 'h', 'town'],
    n: list.length, keys, packs, ground: null, trees: flat, errors: (P.errors || []).slice(0, 8) };
  fs.writeFileSync(path.join(OUT, 'census.json'), JSON.stringify(out));
  const by = {}; for (const t of list) by[t.key + ' /' + t.ser] = (by[t.key + ' /' + t.ser] || 0) + 1;
  console.log('census: ' + list.length + ' trees in +-' + HALF + ' m of (' + cx.toFixed(1) + ', ' + cz.toFixed(1) + '), ' + keys.length + ' species; ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  for (const k of Object.keys(by).sort((a, b) => by[b] - by[a]).slice(0, 30)) console.log('  ' + String(by[k]).padStart(6) + '  ' + k);
  const near = r => list.filter(t => Math.hypot(t.x - cx, t.z - cz) < r).length;
  console.log('  within 100 m: ' + near(100) + '; 200 m: ' + near(200) + '; 400 m: ' + near(400) + '; 800 m: ' + near(800));
  if (P.errors && P.errors.length) console.log('  page errors: ' + P.errors.length + ' (first: ' + String(P.errors[0]).slice(0, 200) + ')');
  process.exit(0);
})().catch(e => { console.error('census FAILED: ' + (e && e.stack || e)); process.exit(1); });
