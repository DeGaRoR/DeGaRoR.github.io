#!/usr/bin/env node
// _revealcam_page.js - THE FIRST FLIGHT FRAME'S EYE (G1119): dev.html in node (FRAMECOST's harness), the first boot's Cub,
// `Roll out` pressed; the cover ring's cells (cover_ring.js STAT: built ever / live) at the click, at the reveal (the trip
// done) and after 60 flight frames, and the camera's distance from the CG at the first world update after the reveal.
// Before the fix the first flight frame's world update read the camera the shed left (~700 m off): the ring dropped every
// cell and planted them all again. node tools/_revealcam_page.js [--q 'rollanim=0']
'use strict';
const { openPage } = require('./_page_node.js');
const argv = process.argv.slice(2);
const Q = (i => i >= 0 ? argv[i + 1] : '')(argv.indexOf('--q'));
(async () => {
  const P = await openPage({ quiet: true, wip: 'default', query: Q });
  const W = P.win;
  const ring = () => { try { const r = W.TREE_FILL && W.TREE_FILL.cover && W.TREE_FILL.cover(); const s = r && r.stat ? r.stat() : null; return s ? s.built + ' built / ' + s.live + ' live' : 'no ring'; } catch (e) { return 'err'; } };
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  await P.frames(30);
  // the camera the world's update sees: wrap worldUpdate once
  let firstEye = null, armed = false;
  const WU = W.WORLD.worldUpdate;
  W.WORLD.worldUpdate = function (cg) { if (armed && !firstEye && W.FLIGHT_PROBE) { const c = W.FLIGHT_PROBE.sim().cgPos(), cam = W.WORLD.camera || null;
      firstEye = cam ? Math.hypot(cam.position.x - c[0], cam.position.z - c[2]).toFixed(1) + ' m' : '(no camera handle)'; } return WU.apply(this, arguments); };
  const r0 = ring();
  W.document.getElementById('bGo').click();
  const T = () => { const L = W.FLYDIY_TRIPS; const t = L && L[L.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(T, 900000);
  const r1 = ring(); armed = true;
  await P.frames(60);
  console.log('REVEALCAM: the ring at the click ' + r0 + ', at the reveal ' + r1 + ', after 60 flight frames ' + ring() + '; the eye at the first update after the reveal ' + firstEye);
  const errs = P.errors.filter(e => !/sheet EMPTY/.test(e));
  console.log('REVEALCAM: ' + (errs.length ? 'page errors: ' + errs.slice(0, 2).join(' | ') : 'no page error'));
  process.exit(0);
})().catch(e => { console.log(e && e.stack); process.exit(1); });
