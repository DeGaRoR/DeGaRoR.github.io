#!/usr/bin/env node
// town_meter.js - THE TOWN METER, READ OFF rollout_perf's JSON (G3415, CITY-B). rollout_perf records, a frame, the town's ticks'
// ms (render_world's sum round the premises' stream, the patch, the lots' cut and the premises' tick), the items they visited
// and their parts (render_premises TM_PARTS); with --town-alloc the KB they allocated. This prints, per run (an arm):
// the town ms (median, p90, p99, max, mean), the share of frames over 2 / 5 ms, the items visited, the parts' means, the KB a
// frame, and every frame over 100 ms with the town's share of it - and, for two or more runs, the table side by side.
//
//   node tools/perf/town_meter.js <rollout_perf json> [more ...] [--window a,b]   (a,b: seconds after the reveal)
//   node tools/perf/town_meter.js <dir> --prefix ab                              (every <dir>/<prefix>*.json)
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const W = (opt('window', '') || '').split(',').filter(Boolean).map(Number);
const prefix = opt('prefix', null);
let files = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
files = files.flatMap(f => (fs.existsSync(f) && fs.statSync(f).isDirectory() ? fs.readdirSync(f).filter(x => x.endsWith('.json') && (!prefix || x.startsWith(prefix))).sort().map(x => path.join(f, x)) : [f]));
if (!files.length) { console.log('usage: node tools/perf/town_meter.js <rollout_perf json | dir --prefix p> [...] [--window a,b]'); process.exit(1); }
const sorted = a => a.slice().sort((x, y) => x - y);
const pct = (a, p) => (a.length ? sorted(a)[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN);
const rows = [];
for (const f of files) {
  const J = JSON.parse(fs.readFileSync(f, 'utf8'));
  const TF = J.townFrames || [], FR = J.frames || [], parts = J.townParts || [];
  const idx = []; for (let i = 0; i < TF.length; i++) { const t = FR[i] ? FR[i][0] : NaN; if (TF[i] && (!W.length || (t >= W[0] && t <= W[1]))) idx.push(i); }
  if (!idx.length) { console.log(path.basename(f) + ': no town meter frames (a run before G3415, or the window is empty)'); continue; }
  const ms = idx.map(i => TF[i][0]), n = idx.map(i => TF[i][1]), kb = idx.map(i => TF[i][2]).filter(x => x != null);
  const dt = idx.map(i => FR[i][1]);
  const r = { file: path.basename(f), frames: idx.length, med: pct(ms, 0.5), p90: pct(ms, 0.9), p99: pct(ms, 0.99), max: Math.max(...ms), mean: ms.reduce((a, b) => a + b, 0) / ms.length,
    over2: ms.filter(x => x > 2).length / ms.length, over5: ms.filter(x => x > 5).length / ms.length, visMed: pct(n, 0.5), visMax: Math.max(...n),
    kb: kb.length ? kb.reduce((a, b) => a + b, 0) / kb.length : null, kbP99: kb.length ? pct(kb, 0.99) : null,
    parts: parts.map((k, j) => [k, idx.reduce((a, i) => a + (TF[i][3 + j] || 0), 0) / idx.length]).sort((a, b) => b[1] - a[1]),
    over100: idx.filter((i, k) => dt[k] > 100).map(i => [FR[i][0], Math.round(FR[i][1]), +TF[i][0].toFixed(2)]) };
  rows.push(r);
  console.log(r.file + ' - ' + r.frames + ' frames' + (W.length ? ' in ' + W.join('-') + ' s' : ''));
  console.log('  town ms: med ' + r.med.toFixed(3) + ' p90 ' + r.p90.toFixed(3) + ' p99 ' + r.p99.toFixed(3) + ' max ' + r.max.toFixed(2) + ' mean ' + r.mean.toFixed(3)
    + ' · over 2 ms ' + (r.over2 * 100).toFixed(2) + ' %, over 5 ms ' + (r.over5 * 100).toFixed(2) + ' % · items med ' + r.visMed + ' max ' + r.visMax
    + (r.kb != null ? ' · KB/frame ' + r.kb.toFixed(3) + ' (p99 ' + r.kbP99.toFixed(2) + ')' : ''));
  console.log('  parts (mean ms): ' + r.parts.filter(x => x[1] > 0.0005).map(x => x[0] + ' ' + x[1].toFixed(3)).join(' · '));
  if (r.over100.length) console.log('  frames over 100 ms [s, ms, town ms]: ' + r.over100.slice(0, 40).map(x => x[0] + '/' + x[1] + '/' + x[2]).join(' '));
}
if (rows.length > 1) {
  console.log('\n' + ['run', 'frames', 'med', 'p99', 'max', 'mean', '>2ms %', 'items', 'KB/fr'].join('\t'));
  for (const r of rows) console.log([r.file, r.frames, r.med.toFixed(3), r.p99.toFixed(3), r.max.toFixed(2), r.mean.toFixed(3), (r.over2 * 100).toFixed(2), r.visMed, r.kb != null ? r.kb.toFixed(3) : '-'].join('\t'));
}
