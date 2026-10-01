#!/usr/bin/env node
// _rollout_plan.js - THE FIXED SHOT'S FRAMING IN THE REAL GARAGE (G1115): dev.html in node, the build in the shed, the app's
// own plan (window.FLYDIY_ROLLPLAN: rollanim's plan with the app's room, kit, camera and aeroplane - nothing moved) printed:
// the eye, its aim, the lens, how many of the aeroplane's sight lines the room's kit hides, how many picture rays meet kit
// in front, and the plan's time. The gate's room (GATE ROLLANIM) has no kit: this is where the clutter is judged.
//   node tools/_rollout_plan.js [--build default|<file.json>] [--q 'rollanim=follow']
'use strict';
const fs = require('fs'), path = require('path');
const { openPage } = require('./_page_node.js');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
(async () => {
  const B = arg('build', 'default'), storage = {};
  if (B !== 'default') storage['flydiy.wip'] = fs.readFileSync(path.resolve(B), 'utf8');
  const P = await openPage(Object.assign({ quiet: true, storage, query: arg('q', '') }, B === 'default' ? { wip: 'default' } : {}));
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  await P.frames(30);
  const t0 = process.hrtime.bigint();
  const pl = W.FLYDIY_ROLLPLAN();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (!pl || !pl.fixed) { console.log('ROLLOUT PLAN: none (' + (pl && pl.skip) + ')'); process.exit(1); }
  const f = pl.fixed, r = v => v.map(x => +x.toFixed(2));
  console.log('ROLLOUT PLAN ' + B + ': eye ' + r(f.eye) + ' look ' + r(f.look) + ' fov ' + f.fov + ' (host ' + pl.fov0 + '), corners out ' + f.out +
    ', sight lines hidden ' + f.hid + ' / 9, kit in front ' + f.clut + ' / 20 ' + JSON.stringify(f.by) + '; roll ' + pl.L.toFixed(1) + ' m in ' + pl.T.Tr.toFixed(1) + ' s; plan ' + ms.toFixed(1) + ' ms (node)');
  process.exit(0);
})().catch(e => { console.log(e && e.stack); process.exit(1); });
