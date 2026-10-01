#!/usr/bin/env node
// craft_order_probe.js - WHAT THE PAVEMENT CAN PAINT OVER (2026-10-01, the user: "the spinning prop does not render on
// top of the runway texture"). The page in node (tools/_page_node.js, GATE FRAMECOST's harness), the build rolled out;
// then every TRANSPARENT mesh under the flown aeroplane is listed with its renderOrder, beside the pavement's and the
// world's other transparent decals. three draws the transparent list sorted by renderOrder FIRST (then distance), and
// the pavement writes no depth - so a craft transparent with a renderOrder under the pavement's is painted over by it
// wherever the two overlap on screen. Read-only.
//   node tools/craft_order_probe.js [cub|cessna]   (FRAMECOST_QUERY='...' for a page query)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const BUILDS = { cub: null, cessna: 'bugReports/cessnaMetal (1).json' };
(async () => {
  const build = process.argv[2] || 'cessna';
  const { openPage } = require('./_page_node.js');
  const storage = {}; if (BUILDS[build]) storage['flydiy.wip'] = fs.readFileSync(path.join(ROOT, BUILDS[build]), 'utf8');
  const P = await openPage({ quiet: true, storage, query: process.env.FRAMECOST_QUERY || '' });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  W.document.getElementById('bGo').click();
  const done = () => { const T = W.FLYDIY_TRIPS, t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => (W.FLYDIY_TRIPS ? done() : W.BOOT.state === 'gone'), 900000);
  await P.frames(10);
  const sc = W.WORLD.scene, FP = W.FLIGHT_PROBE;
  // the flown aeroplane: the scene's direct child that holds the prop parts (the disc's parent) or FLIGHT_PROBE's group
  let craft = FP && (typeof FP.group === 'function' ? FP.group() : FP.group) || null;
  if (!craft) sc.traverse(o => { if (!craft && o.userData && o.userData.propDisc) { let n = o; while (n.parent && n.parent !== sc) n = n.parent; craft = n; } });
  const pathOf = o => { const p = []; for (let n = o; n && n !== sc; n = n.parent) if (n.name) p.push(n.name); return p.reverse().slice(-3).join('/'); };
  const rows = [], world = [];
  sc.traverse(o => {
    if (!(o.isMesh || o.isPoints || o.isSprite || o.isLine)) return;
    const ms = [].concat(o.material).filter(Boolean); if (!ms.some(m => m.transparent)) return;
    let inCraft = false; for (let n = o; n; n = n.parent) if (n === craft) { inCraft = true; break; }
    const chain = []; for (let n = o; n && n !== craft && chain.length < 5; n = n.parent) chain.push((n.name || n.type) + (n.userData && Object.keys(n.userData).length ? '{' + Object.keys(n.userData).slice(0, 4).join(',') + '}' : ''));
    const who = chain.join(' < ') + ' | ' + ms.map(m => m.type + ' ' + (m.name || '') + (m.map ? ' map:' + (m.map.name || 'tex') + (m.map.image ? '[' + m.map.image.width + 'x' + m.map.image.height + ']' : '') : '') + (m.userData && Object.keys(m.userData).length ? ' ud{' + Object.keys(m.userData).slice(0, 5).join(',') + '}' : '') + (m.side === 2 ? ' double' : '') + (m.depthTest === false ? ' noDepthTest' : '') + ' blend' + m.blending + (m.color ? ' #' + m.color.getHexString() : '')).join('+') + ' | ' + (o.geometry && o.geometry.attributes.position ? o.geometry.attributes.position.count + 'v' + (o.geometry.userData && Object.keys(o.geometry.userData).length ? ' gud{' + Object.keys(o.geometry.userData).slice(0, 5).join(',') + '}' : '') : '') + ' at ' + (o.getWorldPosition ? o.getWorldPosition(new o.position.constructor()).toArray().map(v => v.toFixed(1)).join(',') : '');
    const r = { who, name: pathOf(o) || o.type, order: o.renderOrder, mat: ms.map(m => (m.name || m.type) + (m.depthWrite ? ' dw' : '') + (m.opacity < 1 ? ' op' + (+m.opacity).toFixed(2) : '')).join('+'), visible: o.visible, disc: !!(o.userData && o.userData.propDisc) };
    (inCraft ? rows : world).push(r);
  });
  const pav = world.filter(r => /^(pavement|road|pave)/.test(r.name.split('/').pop()) || /merged/.test(r.name));
  const top = Math.max(...pav.map(r => r.order));
  const by = new Map(); for (const r of rows) { const k = r.order + ' | ' + r.mat + (r.disc ? ' | DISC' : ''); const e = by.get(k) || { n: 0, ex: r.name }; e.n++; by.set(k, e); }
  console.log('build ' + build + ' - craft: ' + (craft ? craft.name || craft.type : 'NOT FOUND'));
  console.log('pavement transparents (renderOrder): ' + Array.from(new Set(pav.map(r => r.order))).sort((a, b) => a - b).join(', ') + '  (the highest ' + top + ')');
  console.log('the world\'s other transparents in the pavement\'s range [' + Math.min(...pav.map(r => r.order)) + ', ' + top + ']: ' +
    world.filter(r => pav.indexOf(r) < 0 && r.order >= Math.min(...pav.map(q => q.order)) && r.order <= top).map(r => r.name + '@' + r.order).slice(0, 12).join(', '));
  console.log('craft transparents (renderOrder | material | example), ' + rows.length + ' meshes:');
  const seen = new Set(); console.log('craft transparents UNDER, identified:'); for (const r of rows) if (r.order <= Math.max(...world.filter(q => /^(pavement|road|pave)/.test(q.name.split('/').pop()) || /merged/.test(q.name)).map(q => q.order)) && !seen.has(r.who)) { seen.add(r.who); console.log('    @' + r.order + '  ' + r.who); }
  for (const [k, e] of Array.from(by).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))) console.log('  ' + (parseFloat(k) <= top ? 'UNDER ' : 'over  ') + k + '  x' + e.n + '  e.g. ' + e.ex);
  const under = rows.filter(r => r.order <= top);
  console.log('RESULT: ' + under.length + ' craft transparent mesh(es) sort at or under the pavement (renderOrder <= ' + top + ')' + (under.length ? ': ' + Array.from(new Set(under.map(r => r.name + '@' + r.order))).slice(0, 10).join(', ') : ''));
  process.exit(0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
