#!/usr/bin/env node
// link_waits.js <flightlog.json> [--until garage|reveal|world|all] [--top 24] [--json]
//
// THE PAGE BLOCKED ON A SHADER LINK, WITH NAMES (PERF-TRACE, 23 Nov). three asks a program's link status the first time
// it draws with it (onFirstUse: getProgramInfoLog, then LINK_STATUS); if the link is not done the driver holds the page
// until it is. The recorder clocks that call alone ('linkwait' [t, ms, the link's number]) and the registry knows whose
// program it is - so every blocked millisecond of a load has an owner and a boot step.
//   WHY IT EXISTS: a sampled CPU profile of a garage-first load listed `flight_recorder.js held` at 6.0 s of self time. It
//   is not the recorder's cost: a profile has no frame for a native GL call, so the call's time lands on the function that
//   made it - the recorder's wrapper, in place of three's. The log's own sum (5 990 ms) matched the profile's (6 022).
//   What it IS: 6 s of draws that waited for a link, 3.9 s of them the sky's programs, drawn the frame they were linked.
//
//   --until garage            the waits before THE GARAGE IS SHOWN (the 'boot' event "gone garage": the boot screen gone) - the
//                             default where the log has one
//   --until reveal            before the log's FIRST 'reveal' event (the default otherwise)
//   --until world             before the LAST 'reveal' (the world's)       --until all   the whole log
//   by owner; by boot step (BOOT.set : the step's id, as the registry stamped the program at its link - for a wait that
//   comes more than 100 ms after its link, the step of the last program linked before the wait, marked ~); the longest,
//   each with how it got there: "at once" = drawn within 100 ms of its link (nothing had a chance to wait for it: a
//   prelink ahead of the first draw removes it), "late" = linked long before and still not ready when first drawn.
'use strict';
const fs = require('fs'), path = require('path');
const PR = require(path.join(__dirname, 'program_report.js'));
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10;

function analyse(log, opt) {
  const o = opt || {}, H = log.header || {};
  const progs = PR.programs(log); PR.shares(progs); const byN = new Map(progs.map(p => [p.n, p]));
  const who = p => !p ? 'a program the log does not name' : (p.own && p.own.length ? p.own.join(' + ') : 'UNOWNED ' + ((p.mat && p.mat[0]) || p.name || p.type || ''));
  const events = (log.events || []).map(e => ({ t: e[0], kind: e[1], ms: e[2], d: e[3] })).sort((a, b) => a.t - b.t);
  const t0 = events.length ? events[0].t : 0, reveals = events.filter(e => e.kind === 'reveal').map(e => e.t);
  // (the garage's own reveal is not a 'reveal' event: the boot screen going is - the recorder's 'boot' event, "gone garage")
  const boots = events.filter(e => e.kind === 'boot' && typeof e.d === 'string'), gone = boots.find(e => /^gone garage/.test(e.d)) || boots.find(e => /^landing garage/.test(e.d));
  const until = o.until || (gone ? 'garage' : 'reveal'), end = until === 'all' ? Infinity : until === 'garage' ? (gone ? gone.t : Infinity) : !reveals.length ? Infinity : until === 'world' ? reveals[reveals.length - 1] : reveals[0];
  const linked = progs.filter(p => p.t != null).sort((a, b) => a.t - b.t);
  const stepAt = t => { let s = null; for (const p of linked) { if (p.t <= t) s = p.step; else break; } return s; };
  const all = events.filter(e => e.kind === 'linkwait' && e.ms > 0), W = all.filter(e => e.t < end);
  const rows = W.map(e => { const p = byN.get(e.d), gap = p && p.t != null ? e.t - p.t : null, own = gap != null && gap <= 100;
    return { s: r1((e.t - t0) / 1000), ms: r1(e.ms), n: typeof e.d === 'number' ? e.d : null, owner: who(p), kb: p && p.vs != null ? Math.round((p.vs + p.fs) / 1024) : null, afterLinkMs: gap == null ? null : Math.round(gap),
      how: gap == null ? '?' : own ? 'at once' : 'late', step: (own ? p.step : (stepAt(e.t) != null ? '~' + stepAt(e.t) : null)) || '?', target: p ? p.rt || null : null }; });
  const group = key => { const m = new Map(); for (const r of rows) { const k = r[key]; let g = m.get(k); if (!g) m.set(k, g = { name: k, ms: 0, waits: 0, longest: 0, atOnceMs: 0, firstS: r.s, others: new Map() }); g.ms += r.ms; g.waits++; if (r.ms > g.longest) g.longest = r.ms; if (r.how === 'at once') g.atOnceMs += r.ms;
      const k2 = key === 'owner' ? r.step : r.owner; g.others.set(k2, (g.others.get(k2) || 0) + r.ms); }
    return [...m.values()].sort((a, b) => b.ms - a.ms).map(g => ({ name: g.name, ms: r1(g.ms), waits: g.waits, longestMs: r1(g.longest), atOnceMs: r1(g.atOnceMs), firstS: g.firstS, top: [...g.others].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + Math.round(v)) })); };
  const sum = L => r1(L.reduce((a, e) => a + (e.ms || 0), 0));
  return { kind: 'flydiy-link-waits', v: 1, build: H.build || null, until, untilS: end === Infinity ? null : r1((end - t0) / 1000), boots: boots.map(e => r1((e.t - t0) / 1000) + ' s ' + e.d), reveals: reveals.map(t => r1((t - t0) / 1000)), programs: progs.length,
    wholeLog: { waits: all.length, ms: sum(all) }, waits: rows.length, ms: sum(W), atOnceMs: r1(rows.filter(r => r.how === 'at once').reduce((a, r) => a + r.ms, 0)),
    byOwner: group('owner'), byStep: group('step'), longest: rows.slice().sort((a, b) => b.ms - a.ms).slice(0, o.top || 24) };
}

function text(R) {
  const L = [], lp = (x, n) => String(x == null ? '-' : x).padStart(n);
  L.push('THE PAGE BLOCKED ON A LINK  build ' + (R.build || '?') + '  (' + R.programs + ' programs; the whole log: ' + R.wholeLog.waits + ' waits, ' + R.wholeLog.ms + ' ms)');
  L.push('  ' + (R.untilS == null ? 'the whole log' : 'before ' + (R.until === 'garage' ? 'THE GARAGE SHOWN (the boot screen gone)' : (R.until === 'world' ? 'the LAST' : 'the FIRST') + ' reveal') + ', ' + R.untilS + ' s into the log (reveals at ' + (R.reveals.join(', ') || 'none') + ' s; the boot: ' + (R.boots.join(', ') || 'no boot event') + ')') + ': ' + R.waits + ' waits, ' + R.ms + ' ms; ' + R.atOnceMs + ' ms of them on a program drawn within 100 ms of its own link (a prelink ahead of the first draw removes those)');
  for (const [title, G, other] of [['BY OWNER', R.byOwner, 'in the steps'], ['BY BOOT STEP (set:step at the link; ~ = the step of the last link before a late wait)', R.byStep, 'on']]) {
    L.push(''); L.push(title); L.push('  ' + lp('ms', 8) + lp('waits', 7) + lp('longest', 9) + lp('at once', 9) + lp('first s', 9) + '  name   [' + other + ': ms]');
    for (const g of G.slice(0, 30)) L.push('  ' + lp(g.ms, 8) + lp(g.waits, 7) + lp(g.longestMs, 9) + lp(g.atOnceMs, 9) + lp(g.firstS, 9) + '  ' + g.name + '   [' + g.top.join('; ') + ']'); }
  L.push(''); L.push('THE LONGEST'); L.push('  ' + lp('s', 8) + lp('ms', 8) + lp('KB', 5) + lp('after link', 12) + '  how      step  |  owner  [keyed for]');
  for (const r of R.longest) L.push('  ' + lp(r.s, 8) + lp(r.ms, 8) + lp(r.kb, 5) + lp(r.afterLinkMs, 12) + '  ' + r.how.padEnd(8) + ' ' + r.step + '  |  ' + r.owner + (r.target ? '  [' + r.target + ']' : ''));
  return L.join('\n');
}

module.exports = { analyse, text };
if (require.main === module) {
  const argv = process.argv.slice(2), file = argv.find(a => !a.startsWith('--') && /\.json$/.test(a)), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  if (!file) { console.error('usage: link_waits.js <flightlog.json> [--until garage|reveal|world|all] [--top 24] [--json]'); process.exit(2); }
  const R = analyse(JSON.parse(fs.readFileSync(file, 'utf8')), { until: opt('until', null), top: +opt('top', 24) });
  console.log(argv.includes('--json') ? JSON.stringify(R) : text(R));
}
