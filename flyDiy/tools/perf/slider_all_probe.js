// slider_all_probe.js <build json> [layer] - PERF-SLIDERS (23 Nov 2026): WHO ENUMERATES THE ROWS inside a layer's turn (CAGE_CHAIN's `all`: such a layer re-runs
// on every tick of any row). The page in node, the build on the stand, Reflect.ownKeys of the page wrapped: the stacks
// of the calls made while the named layer (default cowl) is the one recording. Run from the worktree's flyDiy folder:
//   node --max-old-space-size=8192 tools/perf/slider_all_probe.js "builds/candidates/pawnee (1).json" cowl   (through the box's token)
// FOUND WITH IT, 23 Nov: the Pawnee's cowl layer - its own slider sync (tools/_cage_cowl.js syncFitted -> CAGE_UI.syncSliders ->
// applyRowVis / syncFollow -> frameVal -> CAGE2.cageQuadRect -> cageWinRow's Object.assign of the rows) runs INSIDE the layer's
// turn while CAGE_UI.P is the recording view, so the UI's reads of every row are booked as the cowl's. Not fixed yet.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.cwd(), file = process.argv[2], LAYER = process.argv[3] || 'cowl';
(async () => {
  const { openPage } = require(path.join(ROOT, 'tools', '_page_node.js'));
  const P = await openPage({ quiet: true, storage: { 'flydiy.wip': fs.readFileSync(path.join(ROOT, file), 'utf8') }, query: 'fleet=0' });
  const W = P.win, run = c => vm.runInContext(c, P.ctx);
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  await P.until(() => !!W.CAGE_UI, 60000);
  await P.until(() => false, 6000);
  console.log('on the stand: ' + file + '; layers that read every row: ' + Array.from(W.CAGE_CHAIN.layers).filter(l => l.all).map(l => l.name).join(' '));
  run(`(() => { const R0 = Reflect.ownKeys, seen = new Map(); window.__ALLP = seen;
    Reflect.ownKeys = function (t) { try { const c = window.CAGE_CHAIN && window.CAGE_CHAIN.cur && window.CAGE_CHAIN.cur(); if (c && c.name === ${JSON.stringify(LAYER)}) { const st = String(new Error().stack).split('\\n').slice(2, 9).map(s => s.trim().replace(/^at /, '')).join(' < '); seen.set(st, (seen.get(st) || 0) + 1); } } catch (e) {} return R0(t); }; return 1; })()`);
  W.CAGE_UI.build();
  await P.until(() => false, 3000);
  const seen = run('JSON.stringify([...window.__ALLP])');
  for (const [st, n] of JSON.parse(seen)) console.log(n + ' x  ' + st);
  console.log('after a plain build: layers that read every row: ' + Array.from(W.CAGE_CHAIN.layers).filter(l => l.all).map(l => l.name).join(' '));
  try { P.close(); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('all_probe: ' + (e && e.stack || e)); process.exit(1); });
