#!/usr/bin/env node
// program_diff.js - TWO LOADS: WHICH PROGRAMS ONE HAS AND THE OTHER NOT, AND WHAT THAT DID TO THE STEPS (PERF-TRACE, 22 Nov 2026)
//
// PERF-LEAD's rows of 22 Nov: LATELINKS links 427 programs where BASE links 451-456, and its worldCompile drops from
// 33-39 s to 26.5 s. Which 24 are gone - the heavy ones? - or does the pavement program just get its turn sooner?
// From two saved flight logs (the recorder's `programs` table: one row a link, its owner, its source's fingerprint):
//   THE STEPS      each loading step in both: seconds, programs submitted in it, awaited, the last one ready
//   ONLY IN A / B  the programs whose source text the other load never linked (by fingerprint, counted: a text linked
//                  twice in A and once in B is one "only in A"), by owner: programs, KB, pending share, drawn
//   THE HEAVY ONES the programs with the largest pending share in A, each found again in B by its text: when it was
//                  SUBMITTED and first SEEN READY on the loading clock, how long it was pending, its crowd, its share
//   BY LIGHTS      the whole load's programs by light signature (a log with the body's axes)
// Two loads of the same build differ by a few full-screen passes (their text is identical: they do not show here) and
// by the box; a difference of one or two programs or of a second is not a finding.
//
//   node tools/program_diff.js <A.flightlog.json> <B.flightlog.json> [--label-a BASE --label-b LATELINKS] [--top 25] [--step worldCompile] [--json]
'use strict';
const path = require('path');
const AL = require(path.join(__dirname, 'analyze_log.js')), PR = require(path.join(__dirname, 'program_report.js'));
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10;

function side(log) {
  const rows = PR.programs(log).filter(p => p.three); PR.shares(rows);
  const B = (log.header || {}).boot || {}, T0 = +B.t0 || 0, steps = PR.steps(log);
  const who = p => p.own && p.own.length ? p.own.join(' + ') : 'UNOWNED ' + ((p.mat && p.mat[0]) || p.name || p.type || '');
  const key = p => p.fp || ((p.type || '') + '|' + (p.name || '') + '|' + p.vs + '|' + p.fs);
  const kb = p => p.vs != null ? (p.vs + p.fs) / 1024 : 0;
  const lights = p => { const d = p.body || []; let L = null, S = null; for (const x of d) { if (x.indexOf('LIGHTS=') === 0) L = x.slice(7); else if (x.indexOf('SHADOWS=') === 0) S = x.slice(8); } return Array.isArray(p.body) ? (L ? L + ' / sh ' + (S || 'none') : 'unlit') : '-'; };
  const stepOf = t => { for (const s of steps) if (s.t1 != null && t >= s.t0 && t < s.t1) return s.set + ':' + s.id; return '-'; };
  return { rows, steps, T0, who, key, kb, lights, stepOf, s: t => t == null ? null : r1((t - T0) / 1000) };
}

function diff(logA, logB, opt) {
  const o = opt || {}, A = side(logA), B = side(logB);
  // the steps
  const ids = []; for (const s of A.steps.concat(B.steps)) { const k = s.set + ':' + s.id; if (ids.indexOf(k) < 0) ids.push(k); }
  const stepRow = (S, k) => { const s = S.steps.find(x => x.set + ':' + x.id === k); if (!s || s.t1 == null) return null;
    const sub = S.rows.filter(p => p.t >= s.t0 && p.t < s.t1), aw = S.rows.filter(p => p.t < s.t1 && (p.readyT == null ? p.pendT != null && p.pendT >= s.t0 : p.readyT > s.t0));
    const rd = aw.filter(p => p.readyT != null && p.readyT <= s.t1).sort((x, y) => x.readyT - y.readyT), last = rd[rd.length - 1];
    return { s: r1(s.ms / 1000), start: S.s(s.t0), submitted: sub.length, submittedKB: Math.round(sub.reduce((a, p) => a + S.kb(p), 0)), awaited: aw.length, last: last ? { owner: S.who(last), n: last.n, beforeEndS: r1((s.t1 - last.readyT) / 1000), pendingS: r1((last.readyT - last.t) / 1000), submittedS: S.s(last.t) } : null }; };
  const steps = ids.map(k => ({ step: k, a: stepRow(A, k), b: stepRow(B, k) })).filter(r => (r.a && r.a.s >= 0.3) || (r.b && r.b.s >= 0.3));
  // only in one: by the source's fingerprint, counted
  const only = (X, Y) => { const left = new Map(); for (const p of Y.rows) left.set(Y.key(p), (left.get(Y.key(p)) || 0) + 1);
    const out = []; for (const p of X.rows) { const k = X.key(p), n = left.get(k) || 0; if (n > 0) left.set(k, n - 1); else out.push(p); } return out; };
  const group = (X, list) => { const m = new Map(); for (const p of list) { const k = X.who(p); let g = m.get(k); if (!g) m.set(k, g = { owner: k, programs: 0, kb: 0, shareS: 0, drawn: 0, steps: new Map(), lights: new Map() });
      g.programs++; g.kb += X.kb(p); g.shareS += (p.share || 0) / 1000; if (p.useT != null) g.drawn++; const st = X.stepOf(p.t); g.steps.set(st, (g.steps.get(st) || 0) + 1); const li = X.lights(p); g.lights.set(li, (g.lights.get(li) || 0) + 1); }
    return [...m.values()].map(g => ({ owner: g.owner, programs: g.programs, kb: Math.round(g.kb), shareS: r1(g.shareS), drawn: g.drawn, steps: [...g.steps].sort((a, b) => b[1] - a[1]).map(([k, n]) => n + ' ' + k).join(', '),
      lights: [...g.lights].sort((a, b) => b[1] - a[1]).map(([k, n]) => n + ' x ' + k).join(', ') })).sort((a, b) => b.shareS - a.shareS || b.programs - a.programs); };
  const tot = (X, list) => ({ programs: list.length, kb: Math.round(list.reduce((a, p) => a + X.kb(p), 0)), shareS: r1(list.reduce((a, p) => a + (p.share || 0), 0) / 1000), drawn: list.filter(p => p.useT != null).length });
  const oa = only(A, B), ob = only(B, A);
  // the heavy ones of A, found again in B by their text
  const bByKey = new Map(); for (const p of B.rows) { const k = B.key(p); if (!bByKey.has(k)) bByKey.set(k, p); }
  const line = (X, p) => p ? { n: p.n, submittedS: X.s(p.t), readyS: X.s(p.readyT), pendingS: p.readyT != null ? r1((p.readyT - p.t) / 1000) : null, crowd: r1(p.crowd), shareS: r1((p.share || 0) / 1000), step: X.stepOf(p.t), via: p.via || null } : null;
  const heavy = A.rows.filter(p => p.share != null).sort((x, y) => y.share - x.share).slice(0, o.top || 25).map(p => ({ owner: A.who(p), kb: Math.round(A.kb(p)), a: line(A, p), b: line(B, bByKey.get(A.key(p))) }));
  const heavyB = B.rows.filter(p => p.share != null && !A.rows.some(q => A.key(q) === B.key(p))).sort((x, y) => y.share - x.share).slice(0, 8).map(p => ({ owner: B.who(p), kb: Math.round(B.kb(p)), a: null, b: line(B, p) }));
  // the whole load by light signature
  const byL = new Map(); const addL = (X, s) => { for (const p of X.rows) { const k = X.lights(p); let g = byL.get(k); if (!g) byL.set(k, g = { lights: k, a: { programs: 0, kb: 0, shareS: 0, drawn: 0 }, b: { programs: 0, kb: 0, shareS: 0, drawn: 0 } }); const c = g[s]; c.programs++; c.kb += X.kb(p); c.shareS += (p.share || 0) / 1000; if (p.useT != null) c.drawn++; } };
  addL(A, 'a'); addL(B, 'b');
  const lights = [...byL.values()].map(g => ({ lights: g.lights, a: { programs: g.a.programs, kb: Math.round(g.a.kb), shareS: r1(g.a.shareS), drawn: g.a.drawn }, b: { programs: g.b.programs, kb: Math.round(g.b.kb), shareS: r1(g.b.shareS), drawn: g.b.drawn } })).sort((x, y) => (y.a.programs + y.b.programs) - (x.a.programs + x.b.programs));
  return { kind: 'flydiy-program-diff', v: 1, a: Object.assign({ build: (logA.header || {}).build || null }, tot(A, A.rows)), b: Object.assign({ build: (logB.header || {}).build || null }, tot(B, B.rows)),
    steps, onlyA: Object.assign(tot(A, oa), { byOwner: group(A, oa) }), onlyB: Object.assign(tot(B, ob), { byOwner: group(B, ob) }), heavy: heavy.concat(heavyB), lights };
}

function text(R, la, lb) {
  const L = [], lp = (s, n) => String(s == null ? '-' : s).padStart(n), pad = (s, n) => String(s == null ? '' : s).padEnd(n), top = R.top || 30;
  L.push('PROGRAM DIFF   ' + la + ' (' + R.a.build + '): ' + R.a.programs + ' programs, ' + R.a.kb + ' KB, ' + R.a.drawn + ' drawn    ' + lb + ' (' + R.b.build + '): ' + R.b.programs + ' programs, ' + R.b.kb + ' KB, ' + R.b.drawn + ' drawn');
  L.push(''); L.push('THE STEPS (s; programs submitted in the step / awaited by it; "last" = the last awaited program seen ready and how long before the step\'s end: under 0.3 s = the step ended WITH it)');
  L.push('  ' + pad('step', 24) + lp(la + ' s', 10) + lp(lb + ' s', 12) + lp('diff', 7) + lp('subm', 6) + lp('->', 6) + lp('await', 7) + lp('->', 6) + '  last ready: ' + la + '  |  ' + lb);
  const lastT = x => x && x.last ? x.last.owner.slice(0, 44) + ' (' + x.last.beforeEndS + ' s before, pending ' + x.last.pendingS + ', submitted at ' + x.last.submittedS + ')' : '-';
  for (const s of R.steps) L.push('  ' + pad(s.step, 24) + lp(s.a ? s.a.s : null, 10) + lp(s.b ? s.b.s : null, 12) + lp(s.a && s.b ? r1(s.b.s - s.a.s) : null, 7) + lp(s.a ? s.a.submitted : null, 6) + lp(s.b ? s.b.submitted : null, 6) + lp(s.a ? s.a.awaited : null, 7) + lp(s.b ? s.b.awaited : null, 6) + '  ' + lastT(s.a) + '  |  ' + lastT(s.b));
  for (const [nm, O, lab] of [['ONLY IN ' + la, R.onlyA, la], ['ONLY IN ' + lb, R.onlyB, lb]]) {
    L.push(''); L.push(nm + ' (a source text the other load never linked): ' + O.programs + ' programs, ' + O.kb + ' KB, ' + O.shareS + ' s of pending share in ' + lab + ', ' + O.drawn + ' of them drawn there');
    L.push('  ' + lp('progs', 7) + lp('KB', 8) + lp('share s', 9) + lp('drawn', 7) + '  owner   [made in]   {lights}');
    for (const g of O.byOwner.slice(0, top)) L.push('  ' + lp(g.programs, 7) + lp(g.kb, 8) + lp(g.shareS, 9) + lp(g.drawn, 7) + '  ' + g.owner + '   [' + g.steps + ']' + (g.lights && g.lights !== g.programs + ' x -' ? '   {' + g.lights + '}' : '')); }
  L.push(''); L.push('THE HEAVY ONES of ' + la + ' and where each is in ' + lb + ' (s on the loading clock: submitted, first seen ready; pending; crowd = the others in flight with it; share)');
  L.push('  ' + lp('KB', 5) + lp(la + ':subm', 12) + lp('ready', 8) + lp('pend', 7) + lp('crowd', 7) + lp('share', 7) + lp(lb + ':subm', 14) + lp('ready', 8) + lp('pend', 7) + lp('crowd', 7) + lp('share', 7) + '  owner');
  for (const h of R.heavy) { const a = h.a || {}, b = h.b; L.push('  ' + lp(h.kb, 5) + lp(a.submittedS, 12) + lp(a.readyS, 8) + lp(a.pendingS, 7) + lp(a.crowd, 7) + lp(a.shareS, 7) + (b ? lp(b.submittedS, 14) + lp(b.readyS, 8) + lp(b.pendingS, 7) + lp(b.crowd, 7) + lp(b.shareS, 7) : lp('NOT LINKED', 14) + ' '.repeat(29)) + '  ' + h.owner + (h.a ? '' : '   (only in ' + lb + ')')); }
  if (R.lights.some(g => g.lights !== '-')) { L.push(''); L.push('THE WHOLE LOAD BY LIGHT SIGNATURE (dir.point.spot.hemi / shadows dir.point.spot; programs, share s, drawn)');
    L.push('  ' + lp(la, 8) + lp('share', 7) + lp('drawn', 7) + lp(lb, 10) + lp('share', 7) + lp('drawn', 7) + '  lights');
    for (const g of R.lights) L.push('  ' + lp(g.a.programs, 8) + lp(g.a.shareS, 7) + lp(g.a.drawn, 7) + lp(g.b.programs, 10) + lp(g.b.shareS, 7) + lp(g.b.drawn, 7) + '  ' + g.lights); }
  return L.join('\n');
}
module.exports = { diff, text };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const files = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--label-a', '--label-b', '--top', '--step'].includes(argv[i - 1])));
  if (files.length < 2) { console.error('usage: node tools/program_diff.js <A.flightlog.json> <B.flightlog.json> [--label-a A --label-b B] [--top 25] [--json]'); process.exit(2); }
  const nm = f => path.basename(f).replace(/\.flightlog\.json.*$|\.json.*$/, '');
  const R = diff(AL.load(files[0]), AL.load(files[1]), { top: +opt('top', 25) });
  console.log(argv.includes('--json') ? JSON.stringify(R) : text(R, opt('label-a', nm(files[0])), opt('label-b', nm(files[1]))));
}
