#!/usr/bin/env node
// load_brief.js - A LOAD IN TEN LINES (PERF-TRACE for PERF-LEAD's load matrix, 22 Nov 2026). One saved flight log of a
// boot -> what a row of a comparison needs, and nothing more:
//   the load's seconds (garage ready, the reveal), the compile step that waited longest (worldCompile, else the longest
//   of compile / frames / shedWarm) with its KIND - QUEUE-BOUND (in flight at the pacer's N), HEAVY-BOUND (one program,
//   alone), PAGE-BOUND (below N: the page did not feed the driver) - and its per-pacer figures; the 5 programs with the
//   largest pending share, by owner; the first uses' ms; the long tasks over 50 ms during the loading (count, sum, worst).
// Everything is tools/program_report.js's (the definitions are at the top of that file); this only picks and prints.
//
//   node tools/load_brief.js <flydiy-flightlog-*.json[.gz]> [--json] [--step worldCompile] [--label "pace=16"]
// THE LOG OF A BOOT, from any rig: at the end, in the page,
//   (window.__L = FLIGHT_REC.rec.logParts().join('')).length        then   window.__L.slice(a, a + 4000000)   in pieces
// (one answer of tens of MB is slow over CDP; tools/perf/log_capture.js and flight_script.js --runner page do exactly this).
'use strict';
const fs = require('fs'), path = require('path');
const AL = require(path.join(__dirname, 'analyze_log.js')), PR = require(path.join(__dirname, 'program_report.js'));
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10;

function brief(log, opt) {
  const o = opt || {}, R = PR.report(log, { top: 5 }), H = log.header || {}, B = H.boot || {}, T0 = +B.t0 || 0;
  const ev = log.events || [];
  // the load's end: the first reveal; else the last loading screen gone; else the log's end
  const reveal = (ev.find(e => e[1] === 'reveal') || [])[0];
  let garage = null, lastGone = null, set = 'garage';
  for (const e of (B.log || [])) { if (e.k === 'show') set = e.set || set; if (e.k === 'gone') { lastGone = T0 + e.t; if (set === 'garage' && garage == null) garage = T0 + e.t; } }
  const tEnd = reveal != null ? reveal : (lastGone != null ? lastGone : Infinity);
  const COMP = /^(worldCompile|compile|frames|firstFrame|shedWarm|shedCompile)$/;
  const cands = R.gates.filter(g => g.s != null && (o.step ? g.id === o.step : COMP.test(g.id)));
  const g = cands.find(x => x.id === 'worldCompile' && !o.step) || cands.slice().sort((a, b) => b.s - a.s)[0] || null;
  const lt = ev.filter(e => e[1] === 'longtask' && e[2] > 50 && e[0] <= tEnd), ltSum = lt.reduce((a, e) => a + e[2], 0);
  const rows = PR.programs(log), fu = rows.filter(r => r.firstUseMs > 0), fuLoad = fu.filter(r => r.useT != null && r.useT <= tEnd);
  return { label: o.label || null, build: H.build || null, url: H.url || null,
    garageS: garage == null ? null : r1((garage - T0) / 1000), revealS: reveal == null ? null : r1((reveal - T0) / 1000),
    programs: { links: R.totals.links, three: R.totals.three, unowned: R.totals.unowned, sourceMB: R.totals.sourceMB, distinctSourceMB: R.totals.distinctSourceMB, linkingWallS: R.totals.linkingWallS, late: R.totals.lateAfterReveal },
    pace: R.pace, load: { mean: R.load.mean, max: R.load.max, atNPct: R.load.atNPct, belowNPct: R.load.belowNPct, idlePct: R.load.idlePct },
    step: g ? { id: g.set + ':' + g.id, s: g.s, kind: g.kind || g.verdict, submitted: g.submitted, awaited: g.awaited, stillPending: g.stillPending, flight: g.flight ? { mean: g.flight.mean, max: g.flight.max, atNPct: g.flight.atNPct, belowNPct: g.flight.belowNPct, idlePct: g.flight.idlePct } : null,
      verdict: g.verdict, longest: g.longest ? { n: g.longest.n, who: g.longest.who, pendingS: g.longest.pendingS, crowd: g.longest.crowd } : null } : null,
    top: R.heavy.slice(0, 5).map(b => ({ n: b.n, who: b.who, shareS: b.shareS, pendingS: b.pendingS, crowd: b.crowd, kb: b.kb })),
    firstUse: { programs: fu.length, ms: Math.round(fu.reduce((a, r) => a + r.firstUseMs, 0)), duringLoadMs: Math.round(fuLoad.reduce((a, r) => a + r.firstUseMs, 0)), worst: fu.length ? fu.slice().sort((a, b) => b.firstUseMs - a.firstUseMs).slice(0, 1).map(r => ({ n: r.n, ms: r1(r.firstUseMs), who: (r.own && r.own.length ? r.own.join(' + ') : 'UNOWNED ' + (r.name || r.type)) }))[0] : null,
      heldMs: R.totals.linkWaitMs },
    longTasks: { over50: lt.length, sumMs: Math.round(ltSum), worstMs: lt.length ? Math.round(Math.max(...lt.map(e => e[2]))) : 0, until: reveal != null ? 'the reveal' : lastGone != null ? 'the last loading screen gone' : 'the log\'s end' } };
}
function text(b) {
  const L = [], s = b.step, P = b.programs;
  L.push((b.label ? '[' + b.label + '] ' : '') + 'build ' + (b.build || '?') + ': garage ' + (b.garageS == null ? '-' : b.garageS + ' s') + ', reveal ' + (b.revealS == null ? '-' : b.revealS + ' s') + '; ' + P.links + ' links (' + P.unowned + ' unowned), ' + P.sourceMB + ' MB of GLSL (' + P.distinctSourceMB + ' distinct), linking ' + P.linkingWallS + ' s of wall; pacer N = ' + b.pace.n + ', in flight over the load: mean ' + b.load.mean + ' (at N ' + b.load.atNPct + ' %, below ' + b.load.belowNPct + ' %)');
  if (s) { L.push(s.id + ': ' + s.s + ' s, ' + s.submitted + ' submitted, ' + s.awaited + ' awaited, ' + s.stillPending + ' left pending' + (s.flight ? '; in flight mean ' + s.flight.mean + ', at N ' + s.flight.atNPct + ' %, below ' + s.flight.belowNPct + ' %, idle ' + s.flight.idlePct + ' %' : ''));
    L.push('  ' + (s.kind || 'kind not judged (under 3 s or nothing awaited)') + (s.longest ? '; longest #' + s.longest.n + ' ' + s.longest.pendingS + ' s with ' + s.longest.crowd + ' others: ' + s.longest.who : '')); }
  else L.push('no compile step in this log');
  for (const t of b.top) L.push('  #' + String(t.n).padStart(4) + ' share ' + String(t.shareS).padStart(5) + ' s, pending ' + String(t.pendingS).padStart(5) + ' s, crowd ' + String(t.crowd).padStart(4) + ', ' + String(t.kb).padStart(4) + ' KB  ' + t.who);
  L.push('first uses: ' + b.firstUse.programs + ' programs, ' + b.firstUse.ms + ' ms (' + b.firstUse.duringLoadMs + ' during the load), draws held on a link ' + b.firstUse.heldMs + ' ms' + (b.firstUse.worst ? '; worst #' + b.firstUse.worst.n + ' ' + b.firstUse.worst.ms + ' ms ' + b.firstUse.worst.who : ''));
  L.push('long tasks over 50 ms until ' + b.longTasks.until + ': ' + b.longTasks.over50 + ', ' + b.longTasks.sumMs + ' ms in all, worst ' + b.longTasks.worstMs + ' ms');
  return L.join('\n');
}
module.exports = { brief, text };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--step', '--label'].includes(argv[i - 1])));
  if (!file) { console.error('usage: node tools/load_brief.js <flightlog.json[.gz]> [--json] [--step worldCompile] [--label "pace=16"]'); process.exit(2); }
  const b = brief(AL.load(file), { step: opt('step', null), label: opt('label', null) });
  console.log(argv.includes('--json') ? JSON.stringify(b) : text(b));
}
