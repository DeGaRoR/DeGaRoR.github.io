#!/usr/bin/env node
// _rollreal_shadowdiff.js - WHAT CASTS AT THE STAND AFTER THE ROLL-OUT (G1119): dev.html in node, the Cub rolled out, 60 flight
// frames at the stand, then ONE frame's shadow-pass draws listed by object (name / type / its chain), written to <out>.json -
// run it with and without the world roll (--q rollreal=0) and diff: what the roll left casting.
//   node tools/_rollreal_shadowdiff.js <out.json> [--q 'rollreal=0']
'use strict';
const fs = require('fs');
const { openPage } = require('./_page_node.js');
const argv = process.argv.slice(2);
const OUT = argv[0];
const Q = (i => i >= 0 ? argv[i + 1] : '')(argv.indexOf('--q'));
(async () => {
  const P = await openPage({ quiet: true, wip: 'default', query: 'parkcook=0' + (Q ? '&' + Q : '') });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  await P.frames(30);
  W.document.getElementById('bGo').click();
  const T = () => { const L = W.FLYDIY_TRIPS; const t = L && L[L.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(T, 900000);
  await P.frames(+((i => i >= 0 ? argv[i + 1] : 60)(argv.indexOf('--after'))));   // (frames at the stand before the listed two)
  const RD = W.WORLD.renderer, SM = RD.shadowMap, list = [];
  let inShadow = false, grab = false;
  const sr = SM.render; SM.render = function () { inShadow = true; try { return sr.apply(this, arguments); } finally { inShadow = false; } };
  const rb = RD.renderBufferDirect; RD.renderBufferDirect = function (cam, scene, geo, mat, obj) {
    if (grab && inShadow) { const chain = []; for (let o = obj, k = 0; o && k < 4; o = o.parent, k++) chain.push(o.name || o.type);
      list.push({ chain: chain.join(' < '), tris: geo && geo.index ? geo.index.count / 3 : 0, inst: obj.isInstancedMesh ? obj.count : 0, layer: obj.layers.mask }); }
    return rb.apply(this, arguments);
  };
  // two frames (the far map draws every 2nd): both
  grab = true; await P.frames(2); grab = false;
  const by = {}; for (const e of list) { const k = e.chain; by[k] = by[k] || { n: 0, tris: 0, inst: 0 }; by[k].n++; by[k].tris += e.tris; by[k].inst += e.inst; }
  fs.writeFileSync(OUT, JSON.stringify(by, null, 1));
  console.log('SHADOWDIFF: ' + list.length + ' shadow draws over 2 frames, ' + Object.keys(by).length + ' kinds -> ' + OUT);
  process.exit(0);
})().catch(e => { console.log(e && e.stack); process.exit(1); });
