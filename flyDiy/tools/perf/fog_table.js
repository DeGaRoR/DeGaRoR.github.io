#!/usr/bin/env node
// fog_table.js - the FOG study's §1 table out of frame_perf_fog.json (one row per place x probe)
'use strict';
const fs = require('fs'), path = require('path');
const J = JSON.parse(fs.readFileSync(path.join(__dirname, 'frame_perf_fog.json'), 'utf8'));
const t = (r, k) => r.tags[k] ? r.tags[k].median : 0;
const places = [...new Set(J.rows.map(r => r.place))];
console.log('GPU: ' + J.gpu + ' · ' + J.date.slice(0, 16).replace('T', ' ') + ' · ' + J.frames + ' frames · tier ' + [...new Set(J.rows.map(r => r.tier))].join(','));
for (const p of places) {
  const rows = J.rows.filter(r => r.place === p);
  const base = rows.find(r => r.probe === 'base');
  console.log('\n**' + p + '**' + (base ? ' — ' + JSON.stringify(base.where.at) : ''));
  console.log('\n| probe | frame ms (p90) | scene | shadow maps | cloud march | atmo sky+ap | calls | Mtris | vs base | GPU % before |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const d = base ? (r.frame.median - base.frame.median) : 0;
    console.log('| ' + [r.probe, r.frame.median + ' (' + r.frame.p90 + ')', t(r, 'scene').toFixed(2), t(r, 'shadow:maps').toFixed(2),
      t(r, 'clouds:march').toFixed(2), (t(r, 'atmo:sky') + t(r, 'atmo:ap')).toFixed(2), r.calls, (r.tris / 1e6).toFixed(1),
      (r.probe === 'base' ? '—' : (d >= 0 ? '+' : '') + d.toFixed(1) + ' ms' + (base && base.frame.median ? ' (' + (100 * d / base.frame.median).toFixed(0) + ' %)' : '')),
      r.gpuUtilBefore + (r.gpuUtilBefore > 15 ? ' CONTENDED' : '')].join(' | ') + ' |');
  }
}
