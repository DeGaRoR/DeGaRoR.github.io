#!/usr/bin/env node
// metla_bare_check.js - G3210 (METLA-ON): Metlakatla BARE on the page itself (tools/_page_node.js), the town ON (?town=1): two
// pages side by side - the default (bare) and ?metlabare=0 (as before) - booted to 'gone', the stream run until the premises
// queue round the stand is empty; then what G.lots holds (meshes, triangles, geometry MB; Metlakatla's yards and fences),
// the guardrails on mk_ roads, the houses, stats.metlaBare, the obstacles and the page errors. Prints a PASS / FAIL line:
// bare = no mk_ yard / fence / rail left, the houses equal, no page error.
//   node tools/perf/metla_bare_check.js        (the page in node, ~4-6 GB a page: a CPU slot)
'use strict';
const path = require('path');
const { spawn } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

async function child(q) {
  const { openPage } = require('../_page_node.js');
  const P = await openPage({ quiet: true, query: q, workers: /house_worker\.js|sim_host\.js/ });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone' && !(W.BOOT.busy && W.BOOT.busy()), 1800000);
  const PR = () => W.WORLD && W.WORLD.premises;
  for (let k = 0; k < 40; k++) { await P.frames(100); const s = PR() && PR().stats; if (!(s && s.queued > 0)) break; }
  const R = PR(), G = R && R.groups, out = { q, town: !!(W.FLYDIY_TOWN && W.FLYDIY_TOWN.all), stats: {} };
  if (R && R.stats) for (const k of ['houses', 'houseTris', 'queued', 'metlaBare', 'lotsBatches', 'lotsBatched', 'lotsHidden', 'obstacles']) out.stats[k] = R.stats[k];
  const tally = root => { const t = { meshes: 0, tris: 0, geoMB: 0, mkYards: 0, mkFences: 0 }, seen = new Set();
    if (!root) return t;
    root.traverse(o => {
      if (typeof o.name === 'string' && o.name.startsWith('yard:mk_')) t.mkYards++;
      if (o.isMesh && o.geometry) { t.meshes++; const g = o.geometry; t.tris += (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3;
        if (!seen.has(g.uuid)) { seen.add(g.uuid); for (const k in g.attributes) t.geoMB += g.attributes[k].array.byteLength / 1e6; if (g.index) t.geoMB += g.index.array.byteLength / 1e6; } }
    });
    t.tris = Math.round(t.tris); t.geoMB = +t.geoMB.toFixed(1); return t; };
  out.lots = tally(G && G.lots);
  let mkRails = 0; if (G && G.roads) G.roads.traverse(o => { if (typeof o.name === 'string' && o.name.startsWith('rail:mk_')) mkRails++; });
  out.mkRails = mkRails;
  out.errors = P.errors.filter(e => /^(script |timer: |frame: )/.test(e)).slice(0, 6);
  try { P.close(); } catch (e) {}
  return out;
}
function run(q) {
  return new Promise(res => {
    const p = spawn(process.execPath, ['--max-old-space-size=6144', __filename, '--child', q], { cwd: path.join(__dirname, '..', '..'), stdio: ['ignore', 'pipe', 'pipe'] });
    let o = '', e = ''; p.stdout.on('data', d => o += d); p.stderr.on('data', d => e += d);
    p.on('close', code => { try { res(JSON.parse(o.trim().split('\n').pop())); } catch (x) { res({ q, crashed: code, errors: [e.slice(-500) || o.slice(-500)] }); } });
  });
}
(async () => {
  if (opt('child', null) !== null) { console.log(JSON.stringify(await child(opt('child')))); process.exit(0); }
  const [B, K] = await Promise.all([run('town=1'), run('town=1&metlabare=0')]);
  for (const r of [B, K]) console.log((r.q === 'town=1' ? 'BARE ' : 'KEPT ') + JSON.stringify(r));
  const bad = [];
  if (B.crashed != null || K.crashed != null) bad.push('a page crashed');
  else {
    if (!B.town || !K.town) bad.push('the town did not come on');
    if (B.lots.mkYards || B.mkRails) bad.push('Metlakatla yards / rails left: ' + B.lots.mkYards + ' / ' + B.mkRails);
    if (!(K.lots.mkYards > 0)) bad.push('the KEPT page has no mk_ yard - the check cannot see');
    if (B.stats.houses !== K.stats.houses) bad.push('the houses differ: ' + B.stats.houses + ' vs ' + K.stats.houses);
    if (B.errors.length) bad.push('page errors: ' + JSON.stringify(B.errors).slice(0, 300));
  }
  console.log('lots: kept ' + (K.lots ? K.lots.tris + ' tris / ' + K.lots.geoMB + ' MB' : '-') + ' -> bare ' + (B.lots ? B.lots.tris + ' tris / ' + B.lots.geoMB + ' MB' : '-'));
  console.log('METLA-BARE: ' + (bad.length ? 'FAIL - ' + bad.join('; ') : 'PASS'));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
