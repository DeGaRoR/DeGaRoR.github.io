#!/usr/bin/env node
// sim_clock_table.js - G2660-G2664 SIM-CLOCK-GPU: the window's numbers as one text table (no browser).
//   --jumps <sim_clock_gpu.json>          the jumps (garage / stand): per target the worst frame, long tasks, programs,
//                                         LUT re-bakes, probe bakes, back to the baseline; hitches named against the strict
//                                         gate's slack (a frame over 100 ms: over100's 1; a task over 150 ms: taskWorst's
//                                         150; the worst frame over the baseline's p99 + 17 ms: p99's one frame)
//   --picture <ref.json>,<branch.json>    the default boot's state, side by side (the clock, the sun, the light, the jumps)
//   --flight <a1>,<b1>,<a2>,<b2> [--names rate60,rate0]   rollout_perf runs ABAB: rollout_ratchet.js's metrics + the
//                                         loop / render / shadow medians over EVERY frame after the reveal, per side the
//                                         median, A against B within the ratchet's RULES slack; the --eval counters
//                                         (programs, LUT re-bakes, probe bakes, the light's applies) per run
//   --void <file,...>                     runs taken while a CPU battery held the box (boxlock): printed VOID, out of the medians;
//                                         `jumps` in the list voids the jumps' verdict the same way
//   --pixels <file>                       simclk_pixdiff's PIXELS lines (the default-picture check)
//   SUMMARY: the last lines, at most five, are the result for the coordinator
// Rigs have no --help.
'use strict';
const fs = require('fs'), path = require('path');
const RT = require('../rollout_ratchet.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const rd = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const med = a => { const s = a.filter(x => x != null && x === x).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const f1 = x => x == null ? '-' : (typeof x === 'number' ? +x.toFixed(2) : x);
const out = [];
const VOID = new Set(String(opt('void', '') || '').split(',').filter(Boolean).map(f => path.basename(f)));
const SUM = [];
const P = s => out.push(s);

if (opt('jumps', null)) {
  const J = rd(opt('jumps'));
  if (!J) P('jumps: no file');
  else {
    P('JUMPS ' + J.label + ' ' + J.sha + ' build ' + J.build + ' rung cpu x' + J.rung.cpu + ' gpu x' + J.rung.gpux + ' ' + J.q + ' ' + J.size.join('x'));
    for (const w of Object.keys(J.baseline || {})) { const b = J.baseline[w]; P('  baseline ' + w + ': ' + b.fps + ' fps, dt p50 ' + b.dt50 + ' / p99 ' + b.dt99 + ' / max ' + b.dtMax + ' ms, over50 ' + b.over50 + ', render p50 ' + b.render50 + ', calls ' + b.calls); }
    if (J.standFrames != null) P('  the held stand drew ' + J.standFrames + ' frames in 2 s');
    P('  where  target   rep ok  call ms  worst (frame#)  first frames            long tasks      prog lut probe back hitch  sun');
    for (const j of J.jumps) P('  ' + [j.where.padEnd(6), String(j.target).padEnd(8), String(j.rep).padEnd(3), (j.ok ? 'y' : 'N' + (j.why ? ' ' + j.why : '')).padEnd(3),
      String(f1(j.callMs)).padEnd(8), (f1(j.worst) + ' (' + j.worstAt + ')').padEnd(14), JSON.stringify(j.first || []).slice(0, 22).padEnd(23), JSON.stringify(j.longTasks || []).slice(0, 15).padEnd(15),
      String(f1(j.programs)).padEnd(4), String(f1(j.lut)).padEnd(3), String(f1(j.probeBakes)).padEnd(5), String(j.back).padEnd(4), String(j.hitch).padEnd(6), f1(j.sunEl) + ' deg ' + f1(j.localH) + ' h'].join(' '));
    const by = {};
    for (const j of J.jumps) { const k = j.where; (by[k] = by[k] || []).push(j); }
    for (const [k, a] of Object.entries(by)) {
      const hit = a.filter(j => j.hitch);
      SUM.push((VOID.has('jumps') ? 'VOID (a CPU battery up) ' : '') + 'JUMPS ' + k + ': ' + a.filter(j => j.ok).length + '/' + a.length + ' ok, worst frame ' + Math.max(...a.map(j => j.worst || 0)).toFixed(0) + ' ms, longest task ' + Math.max(0, ...a.flatMap(j => j.longTasks || [])) + ' ms, programs +' + a.reduce((s, j) => s + (j.programs > 0 ? j.programs : 0), 0) + ', LUT ' + a.reduce((s, j) => s + (j.lut || 0), 0) + ', back ' + a.filter(j => j.back).length + '/' + a.length + ', hitches: ' + (hit.length ? hit.map(j => j.target + ' ' + f1(j.worst) + 'ms').join(' ') : 'none'));
      P('  ' + k + ': ' + a.length + ' jumps, worst frame ' + Math.max(...a.map(j => j.worst || 0)).toFixed(1) + ' ms, longest task ' + Math.max(0, ...a.flatMap(j => j.longTasks || [])) + ' ms, programs +' + a.reduce((s, j) => s + (j.programs > 0 ? j.programs : 0), 0)
        + ', LUT re-bakes ' + a.reduce((s, j) => s + (j.lut || 0), 0) + ', probe bakes ' + a.reduce((s, j) => s + (j.probeBakes || 0), 0) + ', back to baseline ' + a.filter(j => j.back).length + '/' + a.length
        + ', HITCHES over the slack: ' + (hit.length ? hit.map(j => j.target + '#' + j.rep + ' ' + f1(j.worst) + ' ms' + (j.longTasks && j.longTasks.length ? ' (tasks ' + j.longTasks.join('/') + ')' : '')).join(', ') : 'none'));
    }
    if (J.lutMs) P('  the LUT re-bake itself (bakeT + bakeMS, CPU): ' + JSON.stringify(J.lutMs) + ' ms');
    for (const l of J.log || []) if (/FAILED|DEADLINE|DISCARD|refused/.test(l)) P('  ! ' + l);
  }
}

if (opt('picture', null)) {
  const [a, b] = opt('picture').split(',').map(rd);
  P('DEFAULT PICTURE (no clock set): ' + (a ? a.label + ' ' + a.sha + ' build ' + a.build : '-') + '  vs  ' + (b ? b.label + ' ' + b.sha + ' build ' + b.build : '-'));
  const keys = ['date', 'utc', 'localH', 'sunEl', 'version', 'rate', 'turbidity', 'cloudCover', 'exposure', 'jumps'];
  for (const where of ['garage', 'world']) {
    const x = a && a.picture && a.picture[where], y = b && b.picture && b.picture[where];
    P('  ' + where + ': ' + keys.map(k => k + ' ' + f1(x && x[k]) + (x && y && x[k] !== y[k] ? ' / ' + f1(y && y[k]) : '')).join(', '));
    if (x && y && x.le && y.le) P('    light targets sun ' + x.le.sunI + ' / ' + y.le.sunI + ', hemi ' + x.le.hemiI + ' / ' + y.le.hemiI + ', exposure ' + x.le.ex + ' / ' + y.le.ex);
  }
  if (a && b && a.boot && b.boot) P('  at the boot: ' + ['date', 'utc', 'sunEl', 'rate'].map(k => k + ' ' + f1(a.boot[k]) + ' / ' + f1(b.boot[k])).join(', '));
}

if (opt('flight', null)) {
  const files = opt('flight').split(','), names = opt('names', 'A,B').split(',');
  const all = files.map((f, i) => ({ f, side: names[i % 2], j: rd(f) })).filter(r => r.j);
  for (const r of all) if (VOID.has(path.basename(r.f))) P('  VOID (a CPU battery held the box): ' + path.basename(r.f));
  const runs = all.filter(r => !VOID.has(path.basename(r.f)));
  P('FLIGHT ABAB (' + runs.length + ' runs): ' + runs.map(r => r.side + ' ' + path.basename(r.f)).join(', '));
  const allMed = (j, i) => med((j.frames || []).filter(r => r[1] > 0).map(r => r[i]));
  const rows = runs.map(r => { const m = RT.metrics(r.j); let ev = null; try { ev = typeof r.j.eval === 'string' ? JSON.parse(r.j.eval) : r.j.eval; } catch (e) { ev = r.j.eval; }
    return { side: r.side, m: Object.assign({}, m, { loopAll: allMed(r.j, 2), renderAll: allMed(r.j, 10), shadowAll: allMed(r.j, 11), frames: (r.j.frames || []).length }), ev }; });
  for (const r of rows) P('  ' + r.side + ': fps ' + f1(r.m.fps) + ', p99 taxi ' + f1(r.m.p99) + ', p99 all ' + f1(r.m.p99all) + ', over15 ' + f1(r.m.over15) + ', over100 ' + f1(r.m.over100) + ', worst task ' + f1(r.m.taskWorst)
    + ', loop ' + f1(r.m.loop) + ' / all ' + f1(r.m.loopAll) + ', render ' + f1(r.m.render) + ' / all ' + f1(r.m.renderAll) + ', shadow all ' + f1(r.m.shadowAll) + ', frames ' + r.m.frames + '  | counters ' + JSON.stringify(r.ev));
  const side = s => rows.filter(r => r.side === s);
  const A = side(names[0]), B = side(names[1]);
  const extra = { loopAll: RT.RULES.loop, renderAll: RT.RULES.render, shadowAll: { up: false, rel: 0.10, abs: 0.6, unit: 'ms' } };
  let red = 0;
  for (const [k, R] of Object.entries(Object.assign({}, RT.RULES, extra))) {
    if (['garage', 'rollout', 'flight', 'compile', 'settings', 'slice', 'below30s'].includes(k)) continue;   // loads: not this question
    const a = med(A.map(r => r.m[k])), b = med(B.map(r => r.m[k]));
    if (a == null || b == null) continue;
    const slack = Math.max(Math.abs(b) * R.rel, R.abs), d = a - b, bad = !R.info && (R.up ? -d > slack : d > slack);
    if (bad) red++;
    P('  ' + (bad ? 'RED  ' : R.info ? 'info ' : 'ok   ') + k.padEnd(11) + names[0] + ' ' + String(f1(a)).padEnd(8) + names[1] + ' ' + String(f1(b)).padEnd(8) + 'd ' + String(f1(d)).padEnd(8) + 'slack ' + f1(slack) + ' ' + (R.unit || ''));
  }
  const verdict = (red ? red + ' row(s) past the slack' : 'every row within the slack') + ' (' + names[0] + ' against ' + names[1] + ', medians of ' + A.length + ' / ' + B.length + ' runs' + (all.length > runs.length ? ', ' + (all.length - runs.length) + ' VOID' : '') + ')';
  P('  FLIGHT VERDICT: ' + verdict);
  const evs = k => rows.map(r => r.side + ' ' + (r.ev && r.ev[k] != null ? r.ev[k] : '-')).join(' ');
  SUM.push('FLIGHT 90 s chase rate 60 vs 0 ABAB: ' + verdict + '; render ' + f1(med(A.map(r => r.m.renderAll))) + '/' + f1(med(B.map(r => r.m.renderAll))) + ' loop ' + f1(med(A.map(r => r.m.loopAll))) + '/' + f1(med(B.map(r => r.m.loopAll))) + ' p99 ' + f1(med(A.map(r => r.m.p99all))) + '/' + f1(med(B.map(r => r.m.p99all))) + ' ms; in flight LUT re-bakes ' + evs('lut') + ', programs ' + evs('programs') + ', probe bakes ' + evs('probe'));
}
if (opt('pixels', null)) { let px = ''; try { px = fs.readFileSync(opt('pixels'), 'utf8').trim().split(/\r?\n/).filter(l => /^PIXELS/.test(l)).join('; '); } catch (e) {} if (px) { P(px); SUM.push('DEFAULT PICTURE (pixel check, no clock set, ref vs branch): ' + px.replace(/PIXELS /g, '')); } }
P('SUMMARY');
for (const l of SUM.slice(0, 5)) P(l);
const txt = out.join('\n');
console.log(txt);
if (opt('out', null)) fs.writeFileSync(opt('out'), txt + '\n');
