#!/usr/bin/env node
// scene_attrib.js - WHAT MADE EACH LONG FRAME, PER BENCH SCENE (G1295, EVEN-30). Node only, no browser.
// Reads a master_bench report run with --rec <dir> (each scene's page-clock window t0 / t1; the flight recorder's ring per
// page in <dir>/NN_<build>.json, the GL sync stalls in NN_<build>_gl.json) and prints, per scene:
//   - the frame-length distribution (tools/frame_dist.js) and the share over 1.5x the cap;
//   - THE LONG FRAMES' CAUSE: the recorder's `dt` is the gap BEFORE a frame (its rAF timestamp less the last), so a frame
//     that arrives late was delayed by the PREVIOUS frame's work - each long frame (> 50 ms) is charged to the top slot of
//     the frame before it (EVEN-30's key: read on the late frame itself, every slot looked normal and the cost "outside
//     the loop");
//   - the window's events (long tasks, LoAF scripts, GCs) and the GL sync stalls (clientWaitSync / getBufferSubData /
//     readPixels over 2 ms), and the fence callers (who reads back) per page.
// Usage: node tools/perf/scene_attrib.js <master_bench report.json> <rec dir> [-v]   (-v: every long frame, its events)
'use strict';
const fs = require('fs'), path = require('path');
const FD = require('../frame_dist.js');
const R = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), dir = process.argv[3], verbose = process.argv.includes('-v');
const recOf = {};
for (const f of fs.readdirSync(dir)) if (/^\d\d_.*\.json$/.test(f) && !/_gl\.json$/.test(f)) recOf[f.replace(/^\d\d_/, '').replace(/\.json$/, '')] = f;
const cache = {};
const load = tag => {
  if (cache[tag] !== undefined) return cache[tag];
  const f = recOf[tag]; if (!f) return (cache[tag] = null);
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  let gl = null; try { gl = JSON.parse(fs.readFileSync(path.join(dir, f.replace(/\.json$/, '_gl.json')), 'utf8')); } catch (e) {}
  return (cache[tag] = { j, gl });
};
for (const s of R.scenes) {
  if (s.t0 == null) continue;
  const L = load(s.build); if (!L) { console.log(s.build + ' | ' + s.scene + ': no recorder log'); continue; }
  const f = L.j.frames, SL = L.j.header.slots, ev = L.j.events;
  const idx = []; for (let i = 1; i < f.t.length; i++) if (f.t[i] > s.t0 && f.t[i] <= s.t1 && f.dt[i] != null) idx.push(i);
  const d = FD.dist(idx.map(i => f.dt[i]), idx.map(i => f.cap[i]));
  console.log('\n== ' + s.build + ' | ' + s.scene + ' | ' + d.n + ' frames, ' + (1000 * d.n / (s.t1 - s.t0)).toFixed(1) + ' fps | > 1.5x cap ' + FD.pc(d.over15.share) +
    ' | ' + d.buckets.map(b => b.k + ' ' + FD.pc(b.share)).join(' · ') + ' | p99 ' + d.p99 + ', worst ' + d.worst);
  const long = idx.filter(i => f.dt[i] > 50), by = {};
  for (const i of long) { const p = i - 1; let top = 'none', v = 0; for (const k of SL) if (f[k][p] > v) { v = f[k][p]; top = k; } (by[top] = by[top] || []).push(+v.toFixed(0)); }
  if (long.length) console.log('   long frames by the PREVIOUS frame\'s top slot: ' + Object.entries(by).map(([k, v]) => k + ' ' + v.length + 'x (' + v.sort((a, b) => b - a).slice(0, 6).join(', ') + ' ms)').join(' | '));
  const W = ev.filter(e => e[0] > s.t0 && e[0] <= s.t1), c = {};
  for (const e of W) c[e[1]] = (c[e[1]] || 0) + 1;
  console.log('   events ' + JSON.stringify(c));
  const agg = {};
  for (const e of W.filter(e => e[1] === 'loaf')) for (const part of String(e[3]).split(';').slice(1)) {
    const m = part.trim().match(/^(.*?)\s(\d+)ms$/); if (!m || +m[2] < 15) continue; const k = m[1].replace(/:\d+$/, ''); (agg[k] = agg[k] || [0, 0]); agg[k][0]++; agg[k][1] += +m[2]; }
  const top = Object.entries(agg).sort((a, b) => b[1][1] - a[1][1]).slice(0, 5);
  if (top.length) console.log('   LoAF scripts: ' + top.map(([k, v]) => v[0] + 'x ' + v[1] + ' ms ' + k).join(' | '));
  if (L.gl && L.gl.gs) { const g = L.gl.gs.filter(x => x[0] > s.t0 && x[0] <= s.t1), gc = {};
    for (const x of g) { gc[x[1]] = gc[x[1]] || [0, 0, 0]; gc[x[1]][0]++; gc[x[1]][1] += x[2]; gc[x[1]][2] = Math.max(gc[x[1]][2], x[2]); }
    if (g.length) console.log('   GL sync stalls > 2 ms: ' + Object.entries(gc).map(([k, v]) => k + ' ' + v[0] + 'x, sum ' + v[1].toFixed(0) + ' ms, max ' + v[2]).join(' | ')); }
  if (verbose) for (const i of long) { const p = i - 1;
    console.log('     ' + f.t[i].toFixed(0) + ' dt ' + f.dt[i] + ' | previous frame: work ' + f.work[p] + ' ' + SL.filter(k => f[k][p] >= 2).map(k => k + ' ' + f[k][p]).join(' ')); }
}
for (const [tag, x] of Object.entries(cache)) if (x && x.gl && x.gl.fc) {
  console.log('\nfence callers (' + tag + '):');
  for (const [k, v] of Object.entries(x.gl.fc).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log('  ' + v + 'x ' + k.slice(0, 200));
}
