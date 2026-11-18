#!/usr/bin/env node
// perf_trace.js - THE BENCHMARK REPORT (Pilot, 17 Nov 2026; flydiy-notes/PERF-TRACE-FORMAT.md). The user's own benchmark (flydiy-notes/
// PERF-WEEK-METHOD-2026-11-14.md) played by the page runner (tools/flight_script.js --runner page) or by the in-game Benchmark button
// (Game's src/viewer/bench.js) leaves ONE thing behind: the game's flight-recorder log (src/viewer/flight_recorder.js, G620) with the
// scenario's SEGMENT MARKS in it ('seg:<step name>' ... 'seg:end'). This turns that log into the report - nothing is re-measured:
//   - per segment: the frames (n, p50, p99, max, over 50 / 100 / 250 ms, the share within 1.5x the median), the recorder's CPU split
//     (mean ms a slot), GPU ms, draws, and A0's steady-30 verdict (p50 <= 33.3 AND p99 <= 50)
//   - EVERY frame over 50 ms with what happened in it: the frame before it (its work and split - analyze_log's rule: a long interval
//     is the previous frame's work plus what ran between), the time outside the loop, and the recorder's events inside the interval
//     (long tasks + long-animation-frame scripts, shader links = programs compiled, premises built = chunks, heap drops = GC-ish,
//     settings, marks)
//   - the load (the boot's states, first contact -> garage, -> world, reloads around the roll-out), the machine and the settings
//
//   node tools/perf_trace.js <flydiy-flightlog-*.json[.gz]> [--out file.perftrace.json] [--scenario name] [--runner page|ingame|hand]
//   (no marks in the log: one segment 'all', from the reveal)
// AS A MODULE: require('./perf_trace.js').trace(log, { scenario, runner }) -> the report object
'use strict';
const fs = require('fs'), path = require('path');
const AL = require(path.join(__dirname, 'analyze_log.js'));

const q = (s, p) => s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null;
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10;
const LONG = new Set(['longtask', 'loaf', 'link', 'linkwait', 'prem']);
// (REUSED from Codex's tools/perf/flightlog_evidence.js: a WORLD frame is one the recorder did not flag 1|4|16|64|256 - the loading
//  screens, the shed, the pause; the meter's ORANGE is > 35 ms; its 120-frame METER WINDOWS; a stutter's KIND by the 80 % rule)
const isWorld = r => !(r.flags === r.flags && (r.flags & (1 | 4 | 16 | 64 | 256)));

function trace(log, opt) {
  const o = opt || {}, H = log.header || {};
  const rows = AL.frames(log);
  const events = (log.events || []).map(e => ({ t: e[0], kind: e[1], ms: e[2], detail: e[3] })).sort((a, b) => a.t - b.t);
  const SL = H.slots || ['script', 'solver', 'world', 'prem', 'cover', 'fill', 'scene', 'hud', 'mirror', 'render', 'shadow', 'shader', 'other'];
  const reveal = (events.find(e => e.kind === 'reveal') || {}).t;
  // the segments: 'seg:<name>' marks, each closed by the next (or 'seg:end', or the log's end)
  const marks = events.filter(e => e.kind === 'mark' && typeof e.detail === 'string' && e.detail.startsWith('seg:')).map(e => ({ t: e.t, name: e.detail.slice(4) }));
  const bench = (events.find(e => e.kind === 'bench') || {}).detail || null;
  const tEnd = rows.length ? rows[rows.length - 1].t : 0;
  const segDefs = [];
  if (marks.length) for (let i = 0; i < marks.length; i++) { if (marks[i].name === 'end') continue; segDefs.push({ name: marks[i].name, t0: marks[i].t, t1: i + 1 < marks.length ? marks[i + 1].t : tEnd }); }
  else segDefs.push({ name: 'all', t0: reveal != null ? reveal : (rows[0] ? rows[0].t : 0), t1: tEnd });
  const stepOf = name => bench && Array.isArray(bench.steps) ? bench.steps.find(s => s.name === name) : null;
  const segments = segDefs.map(S => {
    const R0 = rows.filter(r => r.t > S.t0 && r.t <= S.t1 && r.dt === r.dt), Rw = R0.filter(isWorld), R = Rw.length ? Rw : R0;
    const d = R.map(r => r.dt).sort((a, b) => a - b), med = q(d, 0.5);
    const cpu = {}; for (const k of SL) { const v = R.map(r => r[k]).filter(x => x === x); cpu[k] = v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null; }
    const mean = k => { const v = R.map(r => r[k]).filter(x => x === x); return v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    const fr = { n: d.length, p50: r1(med), p99: r1(q(d, 0.99)), max: r1(d[d.length - 1]), over50: d.filter(x => x > 50).length, over100: d.filter(x => x > 100).length,
                 over250: d.filter(x => x > 250).length, orange: d.filter(x => x > 35).length, worldOnly: Rw.length > 0, even: d.length ? Math.round(d.filter(x => x <= 1.5 * med).length / d.length * 1000) / 1000 : null };
    const st = stepOf(S.name);
    return { name: S.name, do: st ? (st.do || null) : null, t0: S.t0, t1: S.t1, s: r1((S.t1 - S.t0) / 1000), frames: fr, cpu, gpuMs: mean('gpu'), draws: mean('calls'),
             steady30: d.length ? (fr.p50 <= 33.3 && fr.p99 <= 50) : null };
  });
  // every frame over 50 ms, with what happened in it
  const segAt = t => { const S = segments.find(s => t > s.t0 && t <= s.t1); return S ? S.name : null; };
  const evIn = (a, b) => events.filter(e => { const end = e.t + (e.ms && LONG.has(e.kind) ? e.ms : 0); return end >= a && e.t <= b && e.kind !== 'boot'; })
    .map(e => ({ type: e.kind, t: e.t, ms: e.ms, what: e.detail }));
  const stutters = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]; if (!(r.dt > 50)) continue;
    const p = i > 0 ? rows[i - 1] : null, before = p ? { work: r1(p.work) } : null;
    if (p) for (const k of SL) if (p[k] >= 0.5) before[k] = r1(p[k]);
    const kind = p ? ((p.shader || 0) > 0.8 * r.dt ? 'shader-dominated' : (p.work || 0) > 0.8 * r.dt ? 'recorded-frame-work' : 'outside-recorded-frame-work') : null;
    stutters.push({ t: r.t, ms: r1(r.dt), kind, seg: segAt(r.t), world: isWorld(r), afterReveal: reveal != null ? r.t >= reveal : null, before, outside: p ? r1(r.dt - (p.work || 0)) : null, events: evIn(r.t - r.dt, r.t) });
  }
  // the load: the boot's states, first contact (page 0) -> garage / -> world, reloads around the roll-out
  const boots = events.filter(e => e.kind === 'boot');
  const boot = boots.map((e, i) => ({ state: e.detail, t: e.t, ms: i + 1 < boots.length ? r1(boots[i + 1].t - e.t) : null }));
  const gone = boots.find(e => /^gone/.test(String(e.detail || '')));
  const reveals = events.filter(e => e.kind === 'reveal');
  // targets: frames over 100 ms after the reveal; 30 s windows with >= 98 % even frames; segments steady at 30
  const post = rows.filter(r => reveal == null || r.t >= reveal);
  let wins = 0, good = 0;
  for (let t = post.length ? post[0].t : 0; post.length && t + 30000 <= post[post.length - 1].t; t += 30000) {
    const w = post.filter(r => r.t > t && r.t <= t + 30000).map(r => r.dt).sort((a, b) => a - b); if (!w.length) continue;
    const m = q(w, 0.5); wins++; if (w.filter(x => x <= 1.5 * m).length / w.length >= 0.98) good++;
  }
  const segOK = segments.filter(s => s.steady30 !== null);
  // the meter's 120-frame windows over the world frames (flightlog_evidence.js): the share with an orange frame, the longest green run
  let run = 0, orIn = 0, win = 0, orWin = 0, green = 0, longGreen = 0;
  for (let i = 0; i < rows.length; i++) { const r = rows[i]; if (!isWorld(r)) { run = 0; orIn = 0; green = 0; continue; }
    run++; if (r.dt > 35) orIn++; if (run > 120 && rows[i - 120].dt > 35) orIn--; if (run >= 120) { win++; if (orIn) orWin++; }
    if (r.dt <= 35) { green += r.dt; longGreen = Math.max(longGreen, green); } else green = 0; }
  return {
    kind: 'flydiy-perf-trace', v: 1, runner: o.runner || (bench && bench.runner) || 'hand',
    scenario: o.scenario ? { name: o.scenario, file: o.scenarioFile || null } : (bench && bench.scenario ? { name: bench.scenario, file: bench.file || null } : null),
    build: H.build || null, sha: (bench && bench.sha) || null, at: H.started || null,
    machine: { gpu: H.gpu || H.renderer || (H.gl && H.gl.renderer) || null, ua: H.ua || null, cores: H.cores || null, memGB: H.memGB || null, screen: H.screen || null,
               canvas: H.w && H.h ? H.w + 'x' + H.h : null, dpr: H.dpr || H.pixelRatio || null },
    settings: H.gfx || H.settings || null,
    load: { cold: bench && typeof bench.cold === 'boolean' ? bench.cold : null, boot, toGarageS: gone ? r1(gone.t / 1000) : null, toWorldS: reveal != null ? r1(reveal / 1000) : null,
            rolloutReloads: Math.max(0, reveals.length - 1) },
    segments, stutters,
    targets: { meterWindows: { framesPerWindow: 120, eligible: win, withOrange: orWin, withOrangePct: win ? Math.round(1000 * orWin / win) / 10 : null, longestGreenS: r1(longGreen / 1000), thresholdMs: 35 },
               noFreeze100: post.filter(r => r.dt > 100).length, even98: wins ? Math.round(good / wins * 1000) / 1000 : null,
               steady30: segOK.length ? Math.round(segOK.filter(s => s.steady30).length / segOK.length * 1000) / 1000 : null },
    log: o.logFile || null,
  };
}
module.exports = { trace };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const file = argv.find(a => !a.startsWith('--') && !['--out', '--scenario', '--runner'].includes(argv[argv.indexOf(a) - 1]));
  if (!file) { console.error('usage: node tools/perf_trace.js <flightlog.json[.gz]> [--out f] [--scenario name] [--runner page|ingame|hand]'); process.exit(2); }
  const R = trace(AL.load(file), { scenario: opt('scenario', null), runner: opt('runner', null), logFile: file });
  const out = opt('out', file.replace(/\.json(\.gz)?$/i, '') + '.perftrace.json');
  fs.writeFileSync(out, JSON.stringify(R, null, 1));
  console.log('perf_trace: ' + R.segments.length + ' segment(s), ' + R.stutters.length + ' frame(s) over 50 ms -> ' + out);
  for (const s of R.segments) console.log('  ' + s.name.padEnd(30) + ' ' + String(s.frames.n).padStart(6) + ' frames  p50 ' + s.frames.p50 + '  p99 ' + s.frames.p99 + '  max ' + s.frames.max +
    '  >50 ' + s.frames.over50 + '  >100 ' + s.frames.over100 + '  >250 ' + s.frames.over250 + '  ' + (s.steady30 ? 'steady30' : s.steady30 === false ? 'NOT steady30' : ''));
}
