#!/usr/bin/env node
// roads_far_diag.js - G3214 (METLA-ON far roads): why the far switch did not engage on 18 Oct 07:00. The page in node
// (tools/_page_node.js), the town on (?town=1): booted to 'gone'; is the town's geo still pending (the town part, where the
// far ribbon is made)? Then the part driven to the end (premises.geoLaterSteps); what G.roads holds (merged meshes, those
// tagged townRoad, the far ribbon, stats.roadFarTris); then roadsFar from 9 km (HOME) and from the town: what turns off / on.
//   node tools/perf/roads_far_diag.js        (one page, ~4 GB: a CPU slot)
'use strict';
(async () => {
  const { openPage } = require('../_page_node.js');
  const P = await openPage({ quiet: true, query: 'town=1', workers: /house_worker\.js|sim_host\.js/ });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone' && !(W.BOOT.busy && W.BOOT.busy()), 1800000);
  await P.frames(30);
  const R = W.WORLD && W.WORLD.premises, G = R && R.groups;
  const roads = () => { const o = { kids: 0, merged: 0, town: 0, townVis: 0, far: 0, farVis: 0, names: {} };
    if (!G || !G.roads) return o;
    for (const c of G.roads.children) { o.kids++; const k = String(c.name || c.type).replace(/:[^:]*$/, ':*'); o.names[k] = (o.names[k] || 0) + 1;
      if (c.userData.pavMerged) o.merged++; if (c.userData.townRoad) { o.town++; if (c.visible) o.townVis++; } if (c.userData.roadFar) { o.far++; if (c.visible) o.farVis++; } }
    o.roadFarTris = R.stats.roadFarTris; o.roadFarOn = R.stats.roadFarOn; return o; };
  const out = { town: !!(W.FLYDIY_TOWN && W.FLYDIY_TOWN.all), api: { roadsFar: !!(R && R.roadsFar), geoPending: !!(R && R.geoPending), geoLaterSteps: !!(R && R.geoLaterSteps) } };
  out.pendingAtGone = R && R.geoPending ? R.geoPending() : null;
  out.atGone = roads();
  if (out.pendingAtGone && R.geoLaterSteps) { const g = R.geoLaterSteps(); let n = 0; for (;;) { const r = g.next(); n++; if (r.done || n > 200000) break; } out.partSteps = n; await P.frames(10); }
  out.afterPart = roads();
  const F = W.PREMISES_GEN && W.FLIGHT_PROBE && W.FLIGHT_PROBE.world ? W.PREMISES_GEN.frameOf(R.record, W.FLIGHT_PROBE.world()) : null;
  let mk = null; if (F && R.plots) { const pts = []; for (const p of R.plots()) if (/^mk_/.test(String(p.zone)) && p.poly && p.poly.length) { let x = 0, z = 0; for (const q of p.poly) { x += q[0]; z += q[1]; } pts.push(F.toWorld(x / p.poly.length, z / p.poly.length)); }
    if (pts.length) mk = [pts.map(t => t[0]).sort((a, b) => a - b)[pts.length >> 1], pts.map(t => t[1]).sort((a, b) => a - b)[pts.length >> 1]]; }
  out.mk = mk;
  if (R && R.roadsFar) { out.callFar = R.roadsFar(0, 0); out.whenFar = roads(); if (mk) { out.callNear = R.roadsFar(mk[0], mk[1]); out.whenNear = roads(); } }
  out.errors = P.errors.filter(e => /^(script |timer: |frame: )/.test(e)).slice(0, 6);
  console.log(JSON.stringify(out, null, 1));
  try { P.close(); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('roads_far_diag: ' + (e && e.stack || e)); process.exit(1); });
