// frame_dist.js - THE FRAME-LENGTH DISTRIBUTION (G1360, GATE-TOOLS; the user, 2026-10-03: a distribution instead of one
// "uneven %"). One reading for every rig that has frame intervals: tools/analyze_log.js (the flight recorder's log),
// tools/rollout_perf.js and tools/rollout_ratchet.js, tools/master_bench.js, tools/perf/train_gate.js.
//
//   dist(dts, caps) -> { n, buckets, p50, p90, p99, p999, over15, over3x, over100, over1s, worst }
//     dts   - the frame intervals (ms); a non-finite or non-positive one is not a frame and is left out
//     caps  - the frame cap in fps: one number for every frame, or an array beside dts (the frame's own cap, e.g. the
//             recorder's `cap` column, rollout_perf's r[6]). 0 / null / 'auto' unknown = the display's 60 Hz refresh
//   buckets  - [{ k: '<20', lo, hi, n, share }] over < 20, 20-40, 40-60, 60-100, 100-250, 250-1000, > 1000 ms
//              (a frame exactly on an edge is in the upper bucket: 20.0 ms is 20-40)
//   p50/p90/p99/p999 - nearest rank on the sorted intervals (index floor(q * n), the rigs' own convention)
//   over15 / over3x  - { n, share }: frames longer than 1.5x / 3x THEIR cap's frame time (33.3 ms at 30, 16.7 at 60):
//              1.5x is one refresh missed at 60 (a doubled frame), 3x a visible hitch at any cap
//   over100 / over1s - counts of frames over 100 ms and over 1 s
//   line(d) -> one line of text; table(d, indent) -> the histogram as rows with a bar
'use strict';

const EDGES = [20, 40, 60, 100, 250, 1000];
const KEYS = ['<20', '20-40', '40-60', '60-100', '100-250', '250-1000', '>1000'];

function capMs(c) { const f = +c; return f > 0 && isFinite(f) ? 1000 / f : 1000 / 60; }

function dist(dts, caps) {
  const per = Array.isArray(caps);
  const d = [], cm = [];
  for (let i = 0; i < (dts ? dts.length : 0); i++) {
    const x = +dts[i]; if (!(x > 0) || !isFinite(x)) continue;
    d.push(x); cm.push(capMs(per ? caps[i] : caps));
  }
  const n = d.length;
  const counts = new Array(KEYS.length).fill(0);
  let o15 = 0, o3 = 0, o100 = 0, o1s = 0;
  for (let i = 0; i < n; i++) {
    const x = d[i];
    let b = 0; while (b < EDGES.length && x >= EDGES[b]) b++;
    counts[b]++;
    if (x > 1.5 * cm[i]) o15++;
    if (x > 3 * cm[i]) o3++;
    if (x > 100) o100++;
    if (x > 1000) o1s++;
  }
  const s = d.slice().sort((a, b) => a - b);
  const q = p => n ? +s[Math.min(n - 1, Math.floor(p * n))].toFixed(1) : null;
  const sh = k => n ? +(k / n).toFixed(4) : null;
  return {
    n,
    buckets: KEYS.map((k, i) => ({ k, lo: i ? EDGES[i - 1] : 0, hi: i < EDGES.length ? EDGES[i] : null, n: counts[i], share: sh(counts[i]) })),
    p50: q(0.5), p90: q(0.9), p99: q(0.99), p999: q(0.999), worst: n ? +s[n - 1].toFixed(1) : null,
    over15: { n: o15, share: sh(o15) }, over3x: { n: o3, share: sh(o3) }, over100: o100, over1s: o1s,
  };
}

// a share as text: 86 %, 1.6 %, 0.31 %, 0.004 %
function pc(x) {
  if (x == null) return '-';
  const v = 100 * x;
  return (v === 0 ? '0' : v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v.toFixed(3)) + ' %';
}
// a bucket: its share, or its COUNT when it holds few frames (10 frames of 250-1000 ms read better than "0.004 %")
function bk(b) { return b.n && b.n < 100 && b.share < 0.01 ? b.n + ' fr' : pc(b.share); }

function line(d) {
  if (!d || !d.n) return 'no frames';
  return d.buckets.map(b => b.k + ' ' + bk(b)).join(' · ') +
    ' | p50 ' + d.p50 + ' p90 ' + d.p90 + ' p99 ' + d.p99 + ' p99.9 ' + d.p999 + ' ms' +
    ' | >1.5x cap ' + pc(d.over15.share) + ', >3x ' + pc(d.over3x.share) + ' | >100 ms ' + d.over100 + ', >1 s ' + d.over1s + ' (' + d.n + ' fr)';
}

function table(d, indent) {
  const I = indent == null ? '  ' : indent;
  if (!d || !d.n) return [I + 'no frames'];
  const L = [];
  for (const b of d.buckets) {
    const bar = '#'.repeat(Math.round(40 * b.share)) || (b.n ? '.' : '');
    L.push(I + (b.k + ' ms').padEnd(12) + String(b.n).padStart(8) + pc(b.share).padStart(10) + '  ' + bar);
  }
  L.push(I + 'p50 ' + d.p50 + ' · p90 ' + d.p90 + ' · p99 ' + d.p99 + ' · p99.9 ' + d.p999 + ' · worst ' + d.worst + ' ms');
  L.push(I + 'over 1.5x the cap\'s frame time ' + d.over15.n + ' (' + pc(d.over15.share) + ') · over 3x ' + d.over3x.n + ' (' + pc(d.over3x.share) + ') · over 100 ms ' + d.over100 + ' · over 1 s ' + d.over1s + '  (' + d.n + ' frames)');
  return L;
}

module.exports = { dist, line, table, pc, EDGES, KEYS };
