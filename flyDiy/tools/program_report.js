#!/usr/bin/env node
// program_report.js - THE PROGRAMS OF A LOAD, EACH BY ITS OWNER, AND WHAT EACH LOADING STEP WAITED FOR
// (PERF-TRACE, 22 Nov 2026; PERF-LEAD's order 1; src/viewer/program_id.js makes the rows)
//
// Reads ONE thing: the game's flight-recorder log of a load (the in-game "Export my log", tools/master_bench.js's
// capture, any rig that saves FLIGHT_REC's log). Nothing is re-measured and nothing is polled: a program's readiness
// is the bracket three's own poll gave (last seen pending, first seen ready - program_id.js).
//
//   node tools/program_report.js <flydiy-flightlog-*.json[.gz]> [--out report.json] [--md report.md] [--top 25]
//
// WHAT IT SAYS
//   1. THE PROGRAMS: links, three.js programs, owned / UNOWNED (listed), distinct sources, source MB.
//   2. PER LOADING STEP (BOOT.log's steps, on the BOOT clock): the programs it submitted, the ones it was still
//      awaiting when it began, the LAST one seen ready inside it and how long after that the step ended:
//        "ended WITH its last program" (<= 0.3 s): the step waited on that program - direct evidence;
//        "ended N s AFTER its last program": the links were not what held its end;
//        "ended with K still pending": it did not wait for them - they are the next step's.
//   3. THE HEAVY ONES: each program's pending time (submit -> first seen ready) and its PENDING SHARE: the wall time
//      it was pending divided, instant by instant, by how many were pending with it. The shares sum to the wall time
//      during which anything was linking - so a program's share is what the load would lose, at most, without it.
//      AN ESTIMATE of the driver's queue, not a CPU measurement: the driver's threads are not ours to time.
//   4. BY OWNER: programs, variants (distinct #define sets), source KB, pending share, late and blocking ones.
//   5. LATE programs (made by a frame, not by a compile step), programs a draw WAITED on (the recorder's linkwait),
//      programs warmed and never drawn, programs whose source carries a name another material shares the key of.
// AS A MODULE: require('./program_report.js').report(log) -> the object
'use strict';
const fs = require('fs'), path = require('path');
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10;
const s1 = ms => ms == null || ms !== ms ? null : Math.round(ms / 100) / 10;      // ms -> s, one decimal

// the rows: the log's `programs` table when it has one (sizes, defines, the census), else rebuilt from the events
function programs(log) {
  const ev = (log.events || []), by = new Map();
  const row = n => { let r = by.get(n); if (!r) by.set(n, r = { n, id: null, name: null, type: null, own: [], mat: [], obj: [], key: null, fp: null, vs: null, fs: null, defs: null, ctx: null, step: null, rt: null,
    t: null, linkMs: null, polls: 0, pendT: null, readyT: null, via: null, waitMs: null, useT: null, blocked: false, three: false }); return r; };
  for (const e of ev) {
    const t = e[0], k = e[1], ms = e[2], d = e[3];
    if (k === 'link' && typeof d === 'number') { const r = row(d); r.t = t; r.linkMs = ms; }
    else if (k === 'prog' && d && d.n != null) { const r = row(d.n); Object.assign(r, { id: d.id, name: d.name, type: d.type, own: d.own ? String(d.own).split(' | ') : [], mat: d.mat ? String(d.mat).split(' | ') : [],
      obj: d.obj ? String(d.obj).split(' | ') : [], key: d.key, fp: d.fp, vs: d.vs, fs: d.fs, ctx: d.ctx, step: d.step, rt: d.rt, three: true }); if (r.t == null) r.t = t; }
    else if (k === 'progready' && Array.isArray(d)) { const r = row(d[0]); if (r.readyT == null) { r.readyT = t; r.pendT = d[1]; r.via = d[2]; r.polls = d[3] || 0; } }
    else if (k === 'proguse' && typeof d === 'number') { const r = row(d); if (r.useT == null) r.useT = t; }
    else if (k === 'linkwait' && typeof d === 'number') { const r = row(d); r.waitMs = (r.waitMs || 0) + (ms || 0); }
  }
  if (Array.isArray(log.programs)) for (const p of log.programs) { if (p.n == null) continue; const r = row(p.n); for (const k of Object.keys(p)) if (p[k] != null && !(Array.isArray(p[k]) && !p[k].length && r[k] && r[k].length)) r[k] = p[k]; }
  const rows = [...by.values()].filter(r => r.t != null).sort((a, b) => a.n - b.n);
  for (const r of rows) r.blocked = !!r.blocked || (r.via === 'status' && r.waitMs > 1);   // the page learnt its readiness by waiting on it
  return rows;
}

// the loading steps on the recorder's clock (performance.now): BOOT.log's t is ms since BOOT.t0
function steps(log) {
  const B = (log.header || {}).boot; if (!B || !Array.isArray(B.log)) return [];
  const t0 = +B.t0 || 0, out = []; let set = 'garage';
  for (const e of B.log) {
    if (e.k === 'show' || e.k === 'run') { if (e.set) set = e.set; continue; }
    if (e.k === 'step') out.push({ set, id: e.id, t0: t0 + e.t, t1: e.ms == null ? null : t0 + e.t + e.ms, ms: e.ms == null ? null : e.ms, bootT: e.t, programs: e.programs });
  }
  return out;
}
const bootClock = log => { const B = (log.header || {}).boot; return B && B.t0 ? +B.t0 : 0; };

// the pending share: sweep the brackets [t, readyT); each instant's wall time is split between the programs pending in it
function shares(rows) {
  const ev = [];
  for (const r of rows) if (r.readyT != null && r.readyT > r.t) { ev.push([r.t, 1, r]); ev.push([r.readyT, -1, r]); }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const live = new Set(); let last = 0, busy = 0, peak = 0;
  for (const r of rows) r.share = r.readyT != null ? 0 : null;
  for (const [t, d, r] of ev) {
    if (live.size) { const dt = t - last, each = dt / live.size; for (const x of live) x.share += each; busy += dt; }
    last = t; if (d > 0) live.add(r); else live.delete(r);
    if (live.size > peak) peak = live.size;
  }
  return { busyMs: busy, peak };
}

function who(r) { return r.own && r.own.length ? r.own.join(' + ') : 'UNOWNED ' + ((r.mat && r.mat.join(' | ')) || r.name || r.type || '(no three program)') + (r.obj && r.obj.length ? ' @' + r.obj[0] : ''); }

function report(log, opt) {
  const o = opt || {}, TOP = o.top || 25, T0 = bootClock(log);
  const rows = programs(log), st = steps(log), sh = shares(rows);
  const bt = t => t == null ? null : s1(t - T0);
  const brief = r => ({ n: r.n, who: who(r), name: r.name || r.type, submit: bt(r.t), pendingUntil: bt(r.pendT), ready: bt(r.readyT), via: r.via, pendingS: r.readyT != null ? s1(r.readyT - r.t) : null,
    shareS: s1(r.share), kb: r.vs != null ? Math.round((r.vs + r.fs) / 1024) : null, ctx: r.ctx, step: r.step, drawn: bt(r.useT), waitMs: r1(r.waitMs) });
  // per step
  const gates = st.map(S => {
    const t1 = S.t1 == null ? Infinity : S.t1;
    const made = rows.filter(r => r.t >= S.t0 && r.t < t1);
    const awaited = rows.filter(r => r.t < t1 && (r.readyT == null ? r.pendT != null && r.pendT >= S.t0 : r.readyT > S.t0));
    const readyIn = awaited.filter(r => r.readyT != null && r.readyT <= t1).sort((a, b) => a.readyT - b.readyT);
    const stillPending = awaited.filter(r => r.readyT == null || r.readyT > t1);
    const last = readyIn[readyIn.length - 1] || null, gap = last && S.t1 != null ? S.t1 - last.readyT : null;
    let verdict;
    if (!awaited.length) verdict = 'no program awaited';
    else if (S.t1 == null) verdict = 'the step never ended in this log';
    else if (stillPending.length) verdict = 'ended with ' + stillPending.length + ' still pending (it did not wait for them)';
    else if (gap != null && gap <= 300) verdict = 'ended WITH its last program (it waited on #' + last.n + ')';
    else verdict = 'ended ' + s1(gap) + ' s AFTER its last program (the links did not hold its end)';
    return { set: S.set, id: S.id, start: s1(S.bootT), end: S.ms == null ? null : s1(S.bootT + S.ms), s: s1(S.ms), submitted: made.length, awaited: awaited.length, readyInside: readyIn.length,
      stillPending: stillPending.length, last: last ? brief(last) : null, gapS: s1(gap), verdict,
      lastFive: readyIn.slice(-5).reverse().map(brief), pendingAtEnd: stillPending.slice(0, 8).map(brief) };
  });
  // by owner (a program of two owners counts for each; its share is split between them)
  const by = new Map();
  for (const r of rows) {
    const ows = r.own && r.own.length ? r.own : ['(UNOWNED)'];
    for (const w of ows) {
      let g = by.get(w); if (!g) by.set(w, g = { owner: w, programs: 0, variants: new Set(), sources: new Set(), kb: 0, shareS: 0, maxPendingS: 0, late: 0, blocked: 0, waitMs: 0, neverDrawn: 0, shared: 0 });
      g.programs++; if (r.defs) g.variants.add(r.defs.join(' ')); if (r.fp) g.sources.add(r.fp);
      if (r.vs != null) g.kb += (r.vs + r.fs) / 1024 / ows.length;
      if (r.share != null) g.shareS += r.share / 1000 / ows.length;
      if (r.readyT != null) g.maxPendingS = Math.max(g.maxPendingS, (r.readyT - r.t) / 1000);
      if (r.ctx && r.ctx !== 'compile') g.late++; if (r.blocked) g.blocked++; if (r.waitMs) g.waitMs += r.waitMs; if (r.useT == null) g.neverDrawn++; if (ows.length > 1) g.shared++;
    }
  }
  const owners = [...by.values()].map(g => ({ owner: g.owner, programs: g.programs, variants: g.variants.size || null, sources: g.sources.size || null, kb: Math.round(g.kb), shareS: r1(g.shareS),
    maxPendingS: r1(g.maxPendingS), late: g.late, drawnBeforeReady: g.blocked, waitMs: Math.round(g.waitMs), neverDrawn: g.neverDrawn, sharedWithOthers: g.shared })).sort((a, b) => b.shareS - a.shareS || b.programs - a.programs);
  const three = rows.filter(r => r.three), unowned = three.filter(r => !r.own || !r.own.length), raw = rows.filter(r => !r.three);
  const fps = new Set(rows.filter(r => r.fp).map(r => r.fp)), reveal = ((log.events || []).find(e => e[1] === 'reveal') || [])[0];
  const srcB = rows.reduce((a, r) => a + (r.vs != null ? r.vs + r.fs : 0), 0);
  const multiName = rows.filter(r => Array.isArray(r.heldNames) && r.heldNames.length > 1).map(r => ({ n: r.n, name: r.name, names: r.heldNames, owners: r.heldOwners || r.own, kb: Math.round((r.vs + r.fs) / 1024) }));
  return {
    kind: 'flydiy-program-report', v: 1, log: o.logFile || null, build: (log.header || {}).build || null, gpu: ((log.header || {}).gpu || {}).unmaskedRenderer || null, registry: (log.header || {}).programs || null,
    bootT0: T0, revealS: bt(reveal),
    totals: { links: rows.length, three: three.length, owned: three.length - unowned.length, unowned: unowned.length, rawGL: raw.length, distinctSources: fps.size || null, relinkedSources: fps.size ? rows.filter(r => r.fp).length - fps.size : null,
      sourceMB: r1(srcB / 1048576), seenReady: rows.filter(r => r.readyT != null).length, neverPolled: rows.filter(r => r.readyT == null).length, linkingWallS: s1(sh.busyMs), peakPending: sh.peak,
      drawn: rows.filter(r => r.useT != null).length, neverDrawn: rows.filter(r => r.useT == null).length, late: rows.filter(r => r.ctx && r.ctx !== 'compile').length,
      lateAfterReveal: reveal != null ? rows.filter(r => r.t > reveal).length : null, drawnBeforeReady: rows.filter(r => r.blocked).length, linkWaitMs: Math.round(rows.reduce((a, r) => a + (r.waitMs || 0), 0)) },
    gates, heavy: rows.filter(r => r.share != null).sort((a, b) => b.share - a.share).slice(0, TOP).map(brief),
    longestPending: rows.filter(r => r.readyT != null).sort((a, b) => (b.readyT - b.t) - (a.readyT - a.t)).slice(0, TOP).map(brief),
    owners, unowned: unowned.map(brief), rawGL: raw.map(brief),
    late: rows.filter(r => r.ctx && r.ctx !== 'compile').map(brief), waited: rows.filter(r => r.waitMs > 1).sort((a, b) => b.waitMs - a.waitMs).slice(0, TOP).map(brief),
    neverDrawn: rows.filter(r => r.useT == null).map(r => ({ n: r.n, who: who(r), kb: r.vs != null ? Math.round((r.vs + r.fs) / 1024) : null, shareS: s1(r.share) })),
    multiName, sizes: rows.map(r => [r.n, r.vs, r.fs]),
  };
}

function text(R) {
  const L = [], T = R.totals, pad = (s, n) => String(s == null ? '-' : s).padEnd(n), lp = (s, n) => String(s == null ? '-' : s).padStart(n);
  L.push('PROGRAM REPORT  ' + (R.log || '') + '  build ' + (R.build || '?') + '  ' + (R.gpu || ''));
  L.push('  ' + T.links + ' links, ' + T.three + ' three.js programs: ' + T.owned + ' owned, ' + T.unowned + ' UNOWNED' + (T.rawGL ? ', ' + T.rawGL + ' raw GL (no three program)' : '') +
    (T.distinctSources ? '; ' + T.distinctSources + ' distinct sources (' + T.relinkedSources + ' links of a source linked before), ' + T.sourceMB + ' MB of GLSL' : ''));
  L.push('  seen ready ' + T.seenReady + ' (never polled ' + T.neverPolled + '); something was linking for ' + T.linkingWallS + ' s, at most ' + T.peakPending + ' at once; drawn ' + T.drawn + ', never drawn ' + T.neverDrawn +
    '; made outside a compile ' + T.late + (T.lateAfterReveal != null ? ' (' + T.lateAfterReveal + ' after the reveal at ' + R.revealS + ' s)' : '') + '; drawn before ready ' + T.drawnBeforeReady + ', draws held ' + T.linkWaitMs + ' ms');
  L.push(''); L.push('THE LOADING STEPS (BOOT clock, s)');
  L.push('  ' + pad('set:step', 24) + lp('start', 7) + lp('end', 7) + lp('s', 7) + lp('made', 6) + lp('await', 6) + lp('left', 5) + '  verdict / the last program ready inside it');
  for (const g of R.gates) {
    L.push('  ' + pad(g.set + ':' + g.id, 24) + lp(g.start, 7) + lp(g.end, 7) + lp(g.s, 7) + lp(g.submitted, 6) + lp(g.awaited, 6) + lp(g.stillPending, 5) + '  ' + g.verdict);
    if (g.last) L.push('  ' + ' '.repeat(62) + '  last: #' + g.last.n + ' ready ' + g.last.ready + ' (submitted ' + g.last.submit + ', pending ' + g.last.pendingS + ' s, ' + g.last.kb + ' KB)  ' + g.last.who);
  }
  const tab = (title, list) => { if (!list.length) return; L.push(''); L.push(title);
    L.push('  ' + lp('#', 5) + lp('submit', 8) + lp('ready', 8) + lp('pend s', 8) + lp('share s', 8) + lp('KB', 6) + '  ' + pad('made in', 26) + 'owner');
    for (const b of list) L.push('  ' + lp(b.n, 5) + lp(b.submit, 8) + lp(b.ready, 8) + lp(b.pendingS, 8) + lp(b.shareS, 8) + lp(b.kb, 6) + '  ' + pad((b.ctx || '') + ' ' + (b.step || ''), 26) + b.who); };
  tab('THE HEAVY ONES (by pending share: the wall time of the link queue each one stands for - an estimate)', R.heavy.slice(0, 15));
  L.push(''); L.push('BY OWNER');
  L.push('  ' + lp('progs', 6) + lp('variants', 9) + lp('KB', 7) + lp('share s', 8) + lp('max pend', 9) + lp('late', 5) + lp('held ms', 8) + lp('undrawn', 8) + '  owner');
  for (const g of R.owners) L.push('  ' + lp(g.programs, 6) + lp(g.variants, 9) + lp(g.kb, 7) + lp(g.shareS, 8) + lp(g.maxPendingS, 9) + lp(g.late, 5) + lp(g.waitMs, 8) + lp(g.neverDrawn, 8) + '  ' + g.owner);
  tab('UNOWNED (' + R.unowned.length + ')', R.unowned.slice(0, 60));
  tab('MADE OUTSIDE A COMPILE STEP (' + R.late.length + ')', R.late.slice(0, 40));
  tab('A DRAW WAITED ON THESE', R.waited);
  if (R.multiName.length) { L.push(''); L.push('ONE PROGRAM, SEVERAL MATERIAL NAMES (three writes the FIRST requester\'s name into the source: #define SHADER_NAME)');
    for (const m of R.multiName.slice(0, 40)) L.push('  #' + m.n + ' ' + m.kb + ' KB  source name "' + (m.name || '') + '"  held as: ' + m.names.map(x => '"' + x + '"').join(', ')); }
  return L.join('\n');
}
module.exports = { report, programs, steps, shares, text };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--md', '--top'].includes(argv[i - 1])));
  if (!file) { console.error('usage: node tools/program_report.js <flightlog.json[.gz]> [--out report.json] [--md report.md] [--top 25]'); process.exit(2); }
  const AL = require(path.join(__dirname, 'analyze_log.js'));
  const R = report(AL.load(file), { logFile: path.basename(file), top: +opt('top', 25) });
  const out = opt('out', file.replace(/\.json(\.gz)?$/i, '') + '.programs.json');
  fs.writeFileSync(out, JSON.stringify(R, null, 1));
  const txt = text(R); console.log(txt);
  if (opt('md', null)) fs.writeFileSync(opt('md'), '```\n' + txt + '\n```\n');
  console.log('\nprogram_report: ' + out);
}
