#!/usr/bin/env node
// flight_table.js (PILOT, 15 Nov 2026; DESCENT, the user via A0: "a flight_script case 'high on final' ... and its table: time to
// land, min IAS, max sink"): flight_script JSONL logs -> one table row per run, read from its LANDING step (the last step, or
// --step <name part>). Columns: the run, pass, the step's time (s), go-arounds, the least air speed and the most sink while
// airborne (m/s), the highest CG (m), the touch (sink m/s, air speed m/s, pitch deg), what the pilot said (slips, diverts),
// the failed step's WHY. A prop strike fails the step it happens in (flight_script's faults), so it shows as FAIL + its why.
// Usage: node tools/flight_table.js run1.jsonl run2.jsonl ... [--step "down and stop"] [--md]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const stepPart = opt('step'), md = argv.includes('--md');
const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--step');
if (!files.length) { console.log('usage: node tools/flight_table.js <run.jsonl> ... [--step <name part>] [--md]'); process.exit(2); }
const rows = [];
for (const f of files) {
  const L = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  const run = L.find(r => r.type === 'run') || {}, end = L.find(r => r.type === 'end') || {};
  const steps = L.filter(r => r.type === 'step');
  const st = stepPart ? steps.find(r => r.name.includes(stepPart)) : steps[steps.length - 1];
  if (!st) { rows.push({ run: path.basename(f, '.jsonl'), ok: 'no step' }); continue; }
  const ga = st.phases.filter(p => p === 'GOAROUND').length;
  const fl = st.fly || {}, tc = fl.touch || {};
  const said = [...new Set(st.said.filter(c => /slip|divert|go-around|flap|gave-up|energy/.test(c)))].join(' ');
  rows.push({ run: path.basename(f, '.jsonl'), plane: (run.plane || '').replace(/ \[.*\]$/, ''), ok: st.ok ? 'pass' : 'FAIL', s: st.dur, ga,
              iasMin: fl.iasMin, sinkMax: fl.sinkMax, hMax: fl.hMax, touch: tc.sink != null ? tc.sink + ' / ' + tc.Va + ' / ' + tc.pitch : '-',
              said: said || '-', why: st.why ? st.why.what : (end.failed ? 'run failed at ' + end.failed.name : '') });
}
const cols = [['run', 'run'], ['plane', 'plane'], ['ok', 'step'], ['s', 'time s'], ['ga', 'go-arounds'], ['iasMin', 'min IAS'], ['sinkMax', 'max sink'],
              ['hMax', 'top m'], ['touch', 'touch sink/IAS/pitch'], ['said', 'said'], ['why', 'why']];
if (md) {
  console.log('| ' + cols.map(c => c[1]).join(' | ') + ' |');
  console.log('|' + cols.map(() => '---').join('|') + '|');
  for (const r of rows) console.log('| ' + cols.map(c => r[c[0]] == null ? '-' : String(r[c[0]])).join(' | ') + ' |');
} else {
  const w = cols.map(c => Math.max(c[1].length, ...rows.map(r => String(r[c[0]] == null ? '-' : r[c[0]]).length)));
  console.log(cols.map((c, i) => c[1].padEnd(w[i])).join('  '));
  for (const r of rows) console.log(cols.map((c, i) => String(r[c[0]] == null ? '-' : r[c[0]]).padEnd(w[i])).join('  '));
}
