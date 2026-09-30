#!/usr/bin/env node
// lc_proftasks.js - LOAD-COMPILE (G1085): the long tasks of a CPU profile (rollout_perf --profile-boot's
// <label>_boot.cpuprofile), found in the profile itself: every stretch of consecutive non-idle samples longer than
// --min ms (default 800), with its self time by function and its heaviest call chains (five frames up). No clock
// alignment needed - the stretch IS the task.
//   node tools/perf/lc_proftasks.js run_boot.cpuprofile [--min 800] [--top 12]
'use strict';
const fs = require('fs');
const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
const num = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? +argv[i + 1] : d; };
const MIN = num('min', 800), TOP = num('top', 12);
const pr = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(pr.nodes.map(n => [n.id, n])), parent = new Map();
for (const n of pr.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
const name = id => { const n = byId.get(id), f = n.callFrame; return (f.functionName || '(anon)') + ' ' + (f.url || '').split('/').pop() + ':' + (f.lineNumber + 1); };
const idle = id => { const f = byId.get(id).callFrame.functionName; return f === '(idle)'; };   // ((program): native time inside a task - kept)
let t = pr.startTime, spans = [], cur = null;
for (let i = 0; i < pr.samples.length; i++) {
  t += pr.timeDeltas[i] || 0;
  const id = pr.samples[i], dt = (pr.timeDeltas[i + 1] || 0) / 1000;
  if (idle(id)) { if (cur) { spans.push(cur); cur = null; } continue; }
  if (!cur) cur = { t0: (t - pr.startTime) / 1000, ms: 0, idx: [] };
  cur.ms += dt; cur.idx.push(i);
}
if (cur) spans.push(cur);
const long = spans.filter(s => s.ms >= MIN);
console.log(file + ': ' + long.length + ' busy stretches over ' + MIN + ' ms');
for (const s of long) {
  const self = new Map(), chain = new Map();
  for (const i of s.idx) {
    const id = pr.samples[i], dt = (pr.timeDeltas[i + 1] || 0) / 1000;
    const k = name(id); self.set(k, (self.get(k) || 0) + dt);
    const ch = []; let p = id; for (let d = 0; d < 7 && p != null; d++) { ch.push(byId.get(p).callFrame.functionName || '(anon)'); p = parent.get(p); }
    const ck = ch.join(' < '); chain.set(ck, (chain.get(ck) || 0) + dt);
  }
  const top = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, TOP);
  console.log('\n== @' + (s.t0 / 1000).toFixed(1) + ' s from the profile start: ' + Math.round(s.ms) + ' ms');
  console.log('  self:'); for (const [k, v] of top(self)) console.log('    ' + v.toFixed(0).padStart(6) + ' ms  ' + k);
  console.log('  chains:'); for (const [k, v] of top(chain).slice(0, 8)) console.log('    ' + v.toFixed(0).padStart(6) + ' ms  ' + k);
}
