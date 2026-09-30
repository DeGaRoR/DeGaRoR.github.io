#!/usr/bin/env node
// lc_abtable.js - LOAD-COMPILE (G1085): one line per rollout_perf run, the ratchet's own metrics (rollout_ratchet.js
// metrics(), read from its source so the two never disagree) plus the one loading's compile steps one by one.
//   node tools/perf/lc_abtable.js run1.json [run2.json ...]
'use strict';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'rollout_ratchet.js'), 'utf8');
const body = src.slice(src.indexOf('function metrics(j)'), src.indexOf('// the ratchet: direction'));
const REFRESH = 1000 / 60;
const metrics = new Function('REFRESH', body + '\nreturn metrics;')(REFRESH);
const f1 = x => x == null ? '-' : (+x).toFixed(1);
console.log(['run', 'flight', 'garage', 'rollout', 'compile', 'wComp', 'shed', 'craft', 'frames', 'tasks>=1s', 'worst', 'fps', 'uneven', 'p99'].join('\t'));
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8')), m = metrics(j);
  const st = id => { const s = (j.bootLog || []).find(b => b.k === 'step' && b.id === id); return s ? s.ms / 1000 : null; };
  console.log([path.basename(f, '.json'), f1(m.flight), f1(m.garage), f1(m.rollout), f1(m.compile / 1000), f1(st('worldCompile')), f1(st('compile')), f1(st('craft')), f1(st('frames')),
    m.tasks1s, Math.round(m.taskWorst), f1(m.fps), m.uneven == null ? '-' : (100 * m.uneven).toFixed(0) + '%', f1(m.p99)].join('\t'));
}
