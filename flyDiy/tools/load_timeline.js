#!/usr/bin/env node
// load_timeline.js - THE LOADING TIMELINE (PERF-TRACE, 22 Nov 2026; the review's View A; the brief's item 3)
//
// One flight-recorder log of a load -> (1) a CHROME-TRACE JSON that opens in Perfetto (ui.perfetto.dev) and in
// Chrome DevTools' Performance panel, with LANES and NAMED operations, and (2) a table of the loading steps saying,
// each, what it was BOUND by - where the log can prove it, and "not proven" where it cannot.
//
//   node tools/load_timeline.js <flydiy-flightlog-*.json[.gz]> [--out trace.json] [--summary load.json]
//        [--bootperf tools/perf/boot_perf_cold.json]   (boot_perf.js's capture of the same build: its network rows,
//                                                       for a log saved before the recorder kept the resources)
//
// THE LANES (one process "Wingsmith load", one named thread a lane; time = the page's own clock, performance.now)
//   milestones            the page's script, the loading screens' states, the first frame, GARAGE READY, the roll-out
//                         asked, THE REVEAL, the actions the page marks ('act': a garage change, the interior view)
//   loading: <set>        the loading screen's steps (BOOT.log: its real ids and labels - 'worldCompile compiling the
//                         world', never "shaders"), a lane a screen (garage, rollout, ...)
//   main: loop            every rendered frame's recorded work (args: its slots; a frame over 100 ms is named so)
//   main: tasks           long tasks, the scripts a long animation frame names, the garage's named tasks
//   network               every resource the page fetched (name, KB), as the browser timed it
//   assets landed         the loading screen's own arrivals (BOOT.log 'landed': the asset's key)
//   programs              every WebGL program from its link to the first time it was seen ready, BY OWNER
//                         (src/viewer/program_id.js), overlapping ones on rows of their own; args: variant, KB, step
//   programs: heavy N     the heaviest links, a lane each (so an arrow can start on them)
//   draws held            a draw or a compile that WAITED on a link (the recorder's linkwait), by owner
//   scene                 premises built by the stream, programs made by a frame (late), the sky's state
//   workers               NOT RECORDED: the page's workers (houses, forest, physics) leave nothing in this log yet
//
// THE ARROWS (causal links, only where one is RECORDED or DECLARED)
//   - a loading step that ended WITH its last program (within 0.3 s of the first time three's own poll saw it ready):
//     program -> the step's end. Direct evidence that the step waited on that link.
//   - the roll-out plan's declared prerequisites (app.js TRIP_STEPS `deps`): step -> step.
//   Nothing else is drawn. Two bars that overlap are NOT a cause: where a step has no recorded link to what held it,
//   its `bound` says "not proven".
//
// WHAT BOUND A STEP (the table; the same words in each step's args)
//   main thread   the page's thread was busy (the loop's recorded work + long tasks) for >= 70 % of the step
//   programs      it ended with its last awaited program (the arrow above)
//   network       it ended within 0.3 s of the last resource in flight during it
//   not proven    none of these: it waited on something this log does not record (a worker, a timer, the GPU process)
// A step's own seconds are its ELAPSED time. They add up to the load only along one screen's chain (boot.js runs a
// screen's steps one after the other: that chain IS the critical path of that screen, by construction).
'use strict';
const fs = require('fs'), path = require('path');
const AL = require(path.join(__dirname, 'analyze_log.js'));
const PR = require(path.join(__dirname, 'program_report.js'));
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10;
const us = ms => Math.round(ms * 1000);
const F = { garage: 1, held: 4, away: 16, boot: 64, noRender: 256 };

function unionLen(iv) {
  if (!iv.length) return 0;
  iv = iv.slice().sort((x, y) => x[0] - y[0]); let n = 0, a = iv[0][0], b = iv[0][1];
  for (let i = 1; i < iv.length; i++) { if (iv[i][0] > b) { n += b - a; a = iv[i][0]; b = iv[i][1]; } else if (iv[i][1] > b) b = iv[i][1]; }
  return n + (b - a);
}
const clip = (a, b, lo, hi) => { const x = Math.max(a, lo), y = Math.min(b, hi); return y > x ? [x, y] : null; };

// the roll-out plan's declared prerequisites, read off the source (app.js TRIP_STEPS: { id: 'x', ..., deps: ['a', 'b'] })
function declaredDeps(appSrc) {
  const out = new Map(), re = /\{ id: '(\w+)', part: '(\w+)', label: ("[^"]*"|'[^']*')[^\n]*?deps: \[([^\]]*)\]/g; let m;
  while ((m = re.exec(appSrc))) out.set(m[1], m[4].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean));
  return out;
}

// the steps' labels as the game shows them (the log keeps a step's id): bootStep('id', 'label', ...) and the plans' { id, label }
function declaredLabels(appSrc) {
  const out = new Map(); let m;
  const a = /bootStep\('(\w+)', '([^']*)'/g; while ((m = a.exec(appSrc))) if (!out.has(m[1])) out.set(m[1], m[2]);
  const b = /\{ id: '(\w+)',(?: part: '\w+',)? label: (?:"([^"]*)"|'([^']*)')/g; while ((m = b.exec(appSrc))) if (!out.has(m[1])) out.set(m[1], m[2] || m[3]);
  return out;
}

function timeline(log, opt) {
  const o = opt || {}, H = log.header || {}, B = H.boot || {}, T0 = +B.t0 || 0;
  const rows = AL.frames(log), SL = H.slots || [];
  const events = (log.events || []).map(e => ({ t: e[0], kind: e[1], ms: e[2], d: e[3] })).sort((a, b) => a.t - b.t);
  const progs = PR.programs(log), steps = PR.steps(log); PR.shares(progs);
  const who = p => p.own && p.own.length ? p.own.join(' + ') : 'UNOWNED ' + ((p.mat && p.mat[0]) || p.name || p.type || '');
  const labels = o.appSrc ? declaredLabels(o.appSrc) : new Map();
  // the resources: the recorder's own (log.resources: [name, start, end, KB, type]) or boot_perf's network rows
  let res = Array.isArray(log.resources) ? log.resources.map(r => ({ name: r[0], t0: r[1], t1: r[2], kb: r[3], type: r[4] })) : [], resFrom = res.length ? 'the recorder (resource timing)' : null;
  if (!res.length && o.bootperf && Array.isArray(o.bootperf.net)) { res = o.bootperf.net.map(r => ({ name: r.url, t0: r.t0, t1: r.t1, kb: r.kb, type: r.type })); resFrom = 'boot_perf.js (its own clock: aligned to the navigation, within ~0.3 s)'; }

  const TE = [], PID = 1; let tidN = 0; const lanes = new Map();
  const lane = (name) => { let t = lanes.get(name); if (!t) { t = ++tidN; lanes.set(name, t);
    TE.push({ ph: 'M', pid: PID, tid: t, name: 'thread_name', args: { name } }, { ph: 'M', pid: PID, tid: t, name: 'thread_sort_index', args: { sort_index: t } }); } return t; };
  TE.push({ ph: 'M', pid: PID, tid: 0, name: 'process_name', args: { name: 'Wingsmith load  ' + (H.build || '') + '  ' + ((H.gpu || {}).unmaskedRenderer || '') } });
  const X = (ln, name, t, ms, args, cat) => TE.push({ ph: 'X', pid: PID, tid: lane(ln), name, cat: cat || ln, ts: us(t), dur: Math.max(1, us(ms)), args: args || {} });
  const I = (ln, name, t, args) => TE.push({ ph: 'i', s: 't', pid: PID, tid: lane(ln), name, cat: ln, ts: us(t), args: args || {} });
  let flowN = 0;
  const arrow = (name, fromLane, fromT, toLane, toT) => { const id = ++flowN;
    TE.push({ ph: 's', id, pid: PID, tid: lane(fromLane), name, cat: 'cause', ts: us(fromT) }, { ph: 'f', bp: 'e', id, pid: PID, tid: lane(toLane), name, cat: 'cause', ts: us(toT) }); };

  // ---- milestones ------------------------------------------------------------------------------------------------
  const ML = 'milestones', miles = [];
  const mile = (name, t, args) => { if (t == null) return; miles.push({ name, s: r1((t - T0) / 1000), page: r1(t / 1000) }); I(ML, name, t, args); };
  lane(ML);
  mile('the loading screen\'s clock starts (boot.js)', T0);
  const bl = (B.log || []);
  let set = 'garage'; const shows = [];
  for (const e of bl) {
    if (e.k === 'show') { set = e.set || set; shows.push({ set, t: T0 + e.t }); mile('loading screen up: ' + set, T0 + e.t); }
    else if (e.k === 'frame1') mile('first frame', T0 + e.t);
    else if (e.k === 'gone') mile('loading screen gone: ' + set + (set === 'garage' ? '  (GARAGE READY)' : ''), T0 + e.t);
    else if (e.k === 'waiting') mile('the load done, the screen waits for Fly: ' + set, T0 + e.t);
    else if (e.k === 'fail') mile('LOADING FAILED: ' + (e.reason || ''), T0 + e.t, e);
  }
  for (const e of events) {
    if (e.kind === 'reveal') mile('THE REVEAL (' + (e.d || '') + ')', e.t);
    else if (e.kind === 'act' && e.d) I(ML, 'act: ' + e.d.a + (e.d.s === 1 ? ' asked' : ' done'), e.t, e.d);
    else if (e.kind === 'mark') I(ML, 'mark: ' + e.d, e.t);
    else if (e.kind === 'contextlost' || e.kind === 'err') I(ML, e.kind + ': ' + String(e.d).slice(0, 80), e.t);
  }

  // ---- main thread: the loop's frames, the tasks -----------------------------------------------------------------
  const LOOP = 'main: loop', TASK = 'main: tasks';
  const tEndLoad = (events.filter(e => e.kind === 'reveal').pop() || {}).t;
  const horizon = o.all ? Infinity : (tEndLoad != null ? tEndLoad + 60000 : Infinity);
  const busyIv = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const r = rows[i], n = rows[i + 1]; if (!(r.work === r.work) || r.t > horizon) continue;
    const fl = r.flags === r.flags ? r.flags : 0; if (fl & F.away) continue;
    const dt = n.dt, a = { dt: r1(dt), work: r1(r.work) }; for (const k of SL) if (r[k] >= 0.5) a[k] = r1(r[k]);
    if (r.calls === r.calls) a.draws = r.calls; if (r.gpu === r.gpu) a.gpuMs = r1(r.gpu);
    const name = dt > 250 ? 'frame > 250 ms' : dt > 100 ? 'frame > 100 ms' : dt > 50 ? 'frame > 50 ms' : (fl & F.boot) ? 'frame (loading screen)' : (fl & F.garage) ? 'frame (garage)' : 'frame';
    X(LOOP, name, r.t, Math.min(r.work, Math.max(0.05, dt - 0.05)), a);
    busyIv.push([r.t, r.t + r.work]);
  }
  // (tasks may overlap one another - a long task and the animation frame that holds it: each kind on its own lane)
  for (const e of events) {
    if (e.t > horizon) break;
    if (e.kind === 'longtask' && e.ms) { X(TASK, 'long task', e.t, e.ms, { ms: e.ms, attribution: e.d }); busyIv.push([e.t, e.t + e.ms]); }
    else if (e.kind === 'loaf' && e.ms) X('main: long animation frames', 'long animation frame: ' + String(e.d || '').split('; ').slice(1, 2).join('').slice(0, 90), e.t, e.ms, { ms: e.ms, scripts: e.d });
    else if (e.kind === 'gtask' && e.ms) X('main: named tasks', 'garage task: ' + e.d, e.t - e.ms, e.ms, { ms: e.ms });
    else if (e.kind === 'gc') I(TASK, 'heap drop: ' + e.d, e.t);
  }

  // ---- network, assets -------------------------------------------------------------------------------------------
  if (res.length) {
    // overlapping fetches: async slices on one named track (Perfetto rows them)
    const tid = lane('network'); let k = 0;
    for (const r of res) { const id = 'net' + (++k), nm = String(r.name).replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '');
      TE.push({ ph: 'b', cat: 'network', name: nm, id, pid: PID, tid, ts: us(r.t0), args: { KB: r.kb, type: r.type } }, { ph: 'e', cat: 'network', name: nm, id, pid: PID, tid, ts: us(Math.max(r.t1, r.t0 + 0.01)) }); }
  } else I('network', 'NOT RECORDED in this log (a log saved by a build with PERF-TRACE keeps the browser\'s resource timing; or pass --bootperf)', T0);
  for (const e of bl) if (e.k === 'landed') I('assets landed', (e.ok === false ? 'FAILED ' : '') + e.key + (e.what ? ' ' + e.what : ''), T0 + e.t);

  // ---- programs ----------------------------------------------------------------------------------------------------
  {
    const tid = lane('programs');
    if (!progs.length) I('programs', 'NOT RECORDED: no link in this log', T0);
    for (const p of progs) {
      const end = p.readyT != null ? p.readyT : (p.pendT != null ? p.pendT : p.t + Math.max(0.05, p.linkMs || 0)), id = 'prog' + p.n;
      const nm = who(p) + (p.readyT == null ? '  (never seen ready: not polled)' : '');
      const args = { n: p.n, three: (p.type || '') + (p.name ? ' "' + p.name + '"' : ''), owner: p.own, material: p.mat, object: p.obj, variant: p.defs ? p.defs.join(' ') : null, sourceKB: p.vs != null ? Math.round((p.vs + p.fs) / 1024) : null,
        fingerprint: p.fp, madeIn: (p.ctx || '') + ' ' + (p.step || ''), target: p.rt, pendingS: p.readyT != null ? r1((p.readyT - p.t) / 1000) : null, pendingShareS: p.share != null ? r1(p.share / 1000) : null,
        lastSeenPendingS: p.pendT != null ? r1((p.pendT - T0) / 1000) : null, seenReadyBy: p.via, firstDrawnS: p.useT != null ? r1((p.useT - T0) / 1000) : null, drawHeldMs: p.waitMs };
      TE.push({ ph: 'b', cat: 'program', name: nm, id, pid: PID, tid, ts: us(p.t), args }, { ph: 'e', cat: 'program', name: nm, id, pid: PID, tid, ts: us(Math.max(end, p.t + 0.01)) });
      if (p.useT != null) I('programs: first drawn', '#' + p.n + ' ' + who(p), p.useT, { n: p.n });
      if (p.ctx && p.ctx !== 'compile' && p.three) I('scene', 'LATE program (made by a ' + p.ctx + ', not a compile step): ' + who(p), p.t, { n: p.n, object: p.obj });
    }
    for (const e of events) if (e.kind === 'linkwait' && e.ms > 1) { const p = typeof e.d === 'number' ? progs.find(x => x.n === e.d) : null; X('draws held', 'held on a link: ' + (p ? who(p) : 'a program the log does not name'), e.t, e.ms, { ms: e.ms, n: e.d }); }
  }
  const heavy = progs.filter(p => p.share != null && p.readyT != null).sort((a, b) => b.share - a.share).slice(0, o.heavy || 10);
  const heavyLane = new Map();
  heavy.forEach((p, i) => { const ln = 'programs: heavy ' + String(i + 1).padStart(2, '0') + '  #' + p.n; heavyLane.set(p.n, ln);
    X(ln, who(p), p.t, p.readyT - p.t, { n: p.n, pendingS: r1((p.readyT - p.t) / 1000), pendingShareS: r1(p.share / 1000), sourceKB: p.vs != null ? Math.round((p.vs + p.fs) / 1024) : null, variant: p.defs ? p.defs.join(' ') : null }); });

  // ---- scene, workers ----------------------------------------------------------------------------------------------
  for (const e of events) {
    if (e.kind === 'prem') (e.ms ? X('scene', 'premises built' + (e.d ? ': ' + String(typeof e.d === 'string' ? e.d : JSON.stringify(e.d)).slice(0, 70) : ''), e.t, e.ms, { ms: e.ms }) : I('scene', 'premises: ' + String(e.d).slice(0, 70), e.t));
    else if (e.kind === 'sky') I('scene', 'sky at ' + (e.d && e.d.at), e.t, e.d);
    else if (e.kind === 'shaderslow') I('scene', 'shader watchdog: ' + String(e.d).slice(0, 100), e.t, { ms: e.ms });
    else if (e.kind === 'gfx' || e.kind === 'setting') I('scene', 'setting: ' + String(typeof e.d === 'string' ? e.d : JSON.stringify(e.d)).slice(0, 80), e.t);
  }
  I('workers', 'NOT RECORDED: the page\'s workers (houses, forest, physics) leave no event in this log - a step waiting on one reads "not proven"', T0);

  // ---- the loading steps, and what bound each ----------------------------------------------------------------------
  const deps = o.appSrc ? declaredDeps(o.appSrc) : new Map();
  const stepOut = [], lastEnd = new Map();
  for (const S of steps) {
    const ln = 'loading: ' + S.set, t1 = S.t1 == null ? null : S.t1, ms = S.ms == null ? 0 : S.ms;
    const busy = t1 == null ? null : unionLen(busyIv.map(iv => clip(iv[0], iv[1], S.t0, t1)).filter(Boolean));
    const awaited = t1 == null ? [] : progs.filter(p => p.t < t1 && (p.readyT == null ? p.pendT != null && p.pendT >= S.t0 : p.readyT > S.t0));
    const readyIn = awaited.filter(p => p.readyT != null && p.readyT <= t1).sort((a, b) => a.readyT - b.readyT), lastP = readyIn[readyIn.length - 1] || null;
    const left = awaited.filter(p => p.readyT == null || p.readyT > t1).length;
    const inFlight = t1 == null ? [] : res.filter(r => r.t0 < t1 && r.t1 > S.t0), lastR = inFlight.filter(r => r.t1 <= t1).sort((a, b) => a.t1 - b.t1).pop() || null;
    let bound = 'not proven', why = 'no recorded link to what held it';
    if (t1 == null) { bound = 'unfinished'; why = 'the step never ended in this log'; }
    else if (ms < 50) { bound = 'instant'; why = 'under 50 ms'; }
    else if (busy >= 0.7 * ms) { bound = 'main thread'; why = 'the page\'s thread was busy ' + r1(busy / 1000) + ' of its ' + r1(ms / 1000) + ' s (the loop\'s work + long tasks)'; }
    else if (lastP && !left && t1 - lastP.readyT <= 300) { bound = 'programs'; why = 'it ended with program #' + lastP.n + ' (' + who(lastP) + '), pending ' + r1((lastP.readyT - lastP.t) / 1000) + ' s'; }
    else if (lastR && t1 - lastR.t1 <= 300 && lastR.t1 - S.t0 > 0.5 * ms) { bound = 'network'; why = 'it ended with ' + String(lastR.name).split('/').pop().replace(/\?.*$/, '') + ' (' + lastR.kb + ' KB)'; }
    else why = 'main thread busy ' + r1((busy || 0) / 1000) + ' s of ' + r1(ms / 1000) + '; ' + (awaited.length ? awaited.length + ' programs awaited' + (lastP ? ', the last ready ' + r1((t1 - lastP.readyT) / 1000) + ' s before its end' : '') + (left ? ', ' + left + ' still pending at its end' : '') : 'no program awaited') +
      (res.length ? '; ' + inFlight.length + ' fetches in flight' : '; network not recorded') + '; workers not recorded';
    const label = labels.get(S.id) || '';
    const row = { set: S.set, id: S.id, label, startS: r1(S.bootT / 1000), endS: S.ms == null ? null : r1((S.bootT + S.ms) / 1000), s: S.ms == null ? null : r1(S.ms / 1000), bound, why,
      mainBusyS: busy == null ? null : r1(busy / 1000), programsSubmitted: t1 == null ? null : progs.filter(p => p.t >= S.t0 && p.t < t1).length, programsAwaited: awaited.length, programsStillPending: left,
      lastProgram: lastP ? { n: lastP.n, owner: who(lastP), readyBeforeEndS: r1((t1 - lastP.readyT) / 1000), pendingS: r1((lastP.readyT - lastP.t) / 1000) } : null, fetchesInFlight: res.length ? inFlight.length : null, deps: deps.get(S.id) || null };
    stepOut.push(row);
    if (t1 != null) {
      X(ln, S.id + (label ? '  ' + label : ''), S.t0, Math.max(ms, 0.05), row, 'loading');
      if (bound === 'programs' && heavyLane.has(lastP.n)) arrow('the step waited on this link', heavyLane.get(lastP.n), lastP.readyT - 0.01, ln, t1 - 0.01);
      for (const d of (deps.get(S.id) || [])) { const de = lastEnd.get(S.set + ':' + d); if (de != null && de <= S.t0 + 1) arrow('declared prerequisite (TRIP_STEPS deps)', ln, Math.max(de - 0.02, 0), ln, S.t0 + 0.01); }
      lastEnd.set(S.set + ':' + S.id, t1);
    }
  }
  // the screens: each chain's elapsed time, and how much of it each kind of bound holds
  const screens = [];
  for (const sName of [...new Set(stepOut.map(s => s.set))]) {
    const SS = stepOut.filter(s => s.set === sName && s.s != null), tot = SS.reduce((a, s) => a + s.s, 0), by = {};
    for (const s of SS) by[s.bound] = r1((by[s.bound] || 0) + s.s);
    screens.push({ set: sName, steps: SS.length, stepsS: r1(tot), byBound: by, notProvenPct: tot ? Math.round(100 * (by['not proven'] || 0) / tot) : null,
      longest: SS.slice().sort((a, b) => b.s - a.s).slice(0, 6).map(s => ({ id: s.id, label: s.label, s: s.s, bound: s.bound })) });
  }
  const trace = { traceEvents: TE, displayTimeUnit: 'ms', metadata: { tool: 'flyDiy tools/load_timeline.js', log: o.logFile || null, build: H.build || null, clock: 'performance.now of the page; the loading screen\'s clock (BOOT) starts at ' + r1(T0) + ' ms',
    network: resFrom || 'not recorded', criticalPath: 'a screen\'s steps run one after the other (boot.js): that chain is its critical path by construction; INSIDE a step only the arrows are proven' } };
  const summary = { kind: 'flydiy-load-timeline', v: 1, log: o.logFile || null, build: H.build || null, gpu: (H.gpu || {}).unmaskedRenderer || null, bootT0: T0, milestones: miles, screens, steps: stepOut,
    heavyPrograms: heavy.map(p => ({ n: p.n, owner: who(p), pendingS: r1((p.readyT - p.t) / 1000), shareS: r1(p.share / 1000) })), lanes: [...lanes.keys()], arrows: flowN, events: TE.length,
    notRecorded: ['workers'].concat(res.length ? [] : ['network']).concat(progs.length ? [] : ['programs']) };
  return { trace, summary };
}

function text(S) {
  const L = [], lp = (s, n) => String(s == null ? '-' : s).padStart(n), pad = (s, n) => String(s == null ? '-' : s).padEnd(n);
  L.push('LOADING TIMELINE  ' + (S.log || '') + '  build ' + (S.build || '?') + '  ' + (S.gpu || ''));
  L.push(''); L.push('MILESTONES (s on the loading screen\'s clock)'); for (const m of S.milestones) L.push('  ' + lp(m.s, 8) + '  ' + m.name);
  L.push(''); L.push('THE SCREENS');
  for (const sc of S.screens) L.push('  ' + pad(sc.set, 10) + lp(sc.stepsS, 7) + ' s in ' + sc.steps + ' steps: ' + Object.entries(sc.byBound).sort((a, b) => b[1] - a[1]).map(([k, v]) => v + ' s ' + k).join(', ') + '  (' + sc.notProvenPct + ' % not proven)');
  L.push(''); L.push('THE STEPS (each named as the game names it; bound = what held its end, where the log proves it)');
  L.push('  ' + pad('screen:step', 24) + lp('start', 7) + lp('s', 7) + lp('busy s', 8) + lp('progs', 6) + '  ' + pad('bound', 12) + 'why');
  for (const s of S.steps) if (s.s == null || s.s >= 0.3) L.push('  ' + pad(s.set + ':' + s.id, 24) + lp(s.startS, 7) + lp(s.s, 7) + lp(s.mainBusyS, 8) + lp(s.programsAwaited, 6) + '  ' + pad(s.bound.toUpperCase(), 12) + s.why);
  if (S.notRecorded.length) { L.push(''); L.push('NOT RECORDED in this log: ' + S.notRecorded.join(', ') + ' - a wait on one of them reads "not proven", never "shaders" or "world"'); }
  return L.join('\n');
}
module.exports = { timeline, text, declaredDeps, declaredLabels };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--summary', '--bootperf', '--heavy'].includes(argv[i - 1])));
  if (!file) { console.error('usage: node tools/load_timeline.js <flightlog.json[.gz]> [--out trace.json] [--summary load.json] [--bootperf boot_perf.json] [--all]'); process.exit(2); }
  let bootperf = null; const bp = opt('bootperf', null);
  if (bp) { const j = JSON.parse(fs.readFileSync(bp, 'utf8')); bootperf = { net: j.net || j.netRows || null }; }
  let appSrc = ''; try { appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'app.js'), 'utf8'); } catch (e) {}
  const R = timeline(AL.load(file), { logFile: path.basename(file), bootperf, appSrc, all: argv.includes('--all'), heavy: +opt('heavy', 10) });
  const base = file.replace(/\.json(\.gz)?$/i, ''), out = opt('out', base + '.trace.json'), sum = opt('summary', base + '.load.json');
  fs.writeFileSync(out, JSON.stringify(R.trace)); fs.writeFileSync(sum, JSON.stringify(R.summary, null, 1));
  console.log(text(R.summary));
  console.log('\nload_timeline: ' + out + '  (' + R.summary.events + ' events, ' + R.summary.lanes.length + ' lanes, ' + R.summary.arrows + ' arrows; open in ui.perfetto.dev or DevTools > Performance > Load profile)\n               ' + sum);
}
