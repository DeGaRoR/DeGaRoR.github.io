#!/usr/bin/env node
// hit_census.js - EVERY OBSTACLE THE BOOT RASTERISES, AND WHAT IT COST (HW-COVERAGE G1999, the town step on a slow CPU).
// The town step's profile (tools/perf/town_profile.js on a --cpu-throttle 4 boot, 6 Oct): 82 % of it is hitAdd -> shapeOf ->
// OBSTACLES.rasterise / addMesh / mark - the houses' (and the pending ones') obstacle columns, rasterised on the main thread.
// This says WHICH: the page in node (tools/_page_node.js, the house worker on its thread), OBSTACLES.rasterise wrapped (its
// vertices, triangles, cell, ms) and the registry's add paired with it (the tag, the place); the boot run to 'gone'. Prints the
// rasterisations by tag and the dearest twenty, with their group's name and its children's names (what was walked).
//   node tools/perf/hit_census.js [--json out.json] [--q 'premtally=0']
// node only - but a page run (~4 GB, a few minutes): take boxlock's cpu lock.
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
(async () => {
  const { openPage } = require('../_page_node.js');
  const calls = []; let last = null, wrapped = false, regWrapped = false;
  const hooks = {
    afterScript(name, P) {
      const O = P.win.OBSTACLES;
      if (!wrapped && O && O.rasterise) {
        wrapped = true; const r0 = O.rasterise;
        O.rasterise = function (pos, idx, cell, opts) {
          const t = process.hrtime.bigint(); const s = r0.apply(this, arguments);
          last = { verts: pos.length / 3, tris: idx ? idx.length / 3 : 0, pts: opts && opts.pts ? opts.pts.length / 3 : 0, cell, base: !!(opts && opts.base), ms: Number(process.hrtime.bigint() - t) / 1e6, stack: (new Error().stack || '').split('\n').slice(2, 6).map(l => l.trim().replace(/^at /, '').replace(/\(.*[\/\\]/, '(')).join(' < ') };
          if (cell === 0.25) last.tag = 'prop-key (once a key, G1999)';   // the per-key raster - not a registration
          calls.push(last); return s;
        };
      }
    },
  };
  const P = await openPage({ quiet: true, hooks, query: opt('q', ''), workers: /house_worker\.js|sim_host\.js/ });
  const W = P.win;
  P.onFrame(ph => {
    if (ph !== 'start' || regWrapped) return;
    const R = W.WORLD && W.WORLD.premises && W.WORLD.obstacles ? W.WORLD.obstacles : (W.FLIGHT_PROBE && W.FLIGHT_PROBE.world && W.FLIGHT_PROBE.world() && W.FLIGHT_PROBE.world().obstacles);
    if (!R || !R.add) return;
    regWrapped = true; const a0 = R.add;
    R.add = function (s) { if (last && !last.tag) { last.tag = s.tag; last.x = Math.round(s.x); last.z = Math.round(s.z); } return a0.apply(this, arguments); };
  });
  const t0 = Date.now();
  await P.until(() => W.BOOT && W.BOOT.state === 'gone' && !(W.BOOT.busy && W.BOOT.busy()), 1800000);
  const town = (W.BOOT.log || []).find(e => e.k === 'step' && e.id === 'town');
  const byTag = {};
  for (const c of calls) { const k = (c.tag || '?') + ' @' + c.cell + (c.base ? ' +shape0' : ''); const e = byTag[k] || (byTag[k] = { n: 0, ms: 0, tris: 0 }); e.n++; e.ms += c.ms; e.tris += c.tris; }
  const tot = calls.reduce((a, c) => a + c.ms, 0);
  console.log('hit_census: ' + calls.length + ' rasterisations, ' + tot.toFixed(0) + ' ms in node (the boot ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s wall; the town step ' + (town ? town.ms : '?') + ' virtual ms)');
  for (const [k, e] of Object.entries(byTag).sort((a, b) => b[1].ms - a[1].ms)) console.log('  ' + k.padEnd(28) + ' n ' + String(e.n).padStart(4) + '  ' + e.ms.toFixed(0).padStart(7) + ' ms  ' + (e.tris / 1000).toFixed(0).padStart(7) + ' k tris');
  console.log('  the dearest 20:');
  for (const c of calls.slice().sort((a, b) => b.ms - a.ms).slice(0, 20)) console.log('   ' + c.ms.toFixed(0).padStart(6) + ' ms  ' + String(c.tag) + ' @' + c.cell + (c.base ? ' +shape0' : '') + '  ' + (c.tris / 1000).toFixed(1) + ' k tris at (' + c.x + ', ' + c.z + ')  ' + c.stack.slice(0, 160));
  if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify({ calls, byTag }, null, 1));
  try { P.close(); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('hit_census: ' + (e && e.stack || e)); process.exit(1); });
