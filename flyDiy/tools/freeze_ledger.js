#!/usr/bin/env node
// freeze_ledger.js - THE FREEZE LEDGER (PERF-TRACE, 22 Nov 2026; the review's View B; PERF-LEAD's order 2)
//
// Every frame over 50 ms of a flight-recorder log, each with WHAT IS KNOWN to have filled it and an explicit
// UNATTRIBUTED remainder - and the user's official numbers over them (flyDiy/PERF-OBJECTIVES.md rows 7-10):
//   - no freeze over 100 ms in the garage (7) and in the world (8);
//   - EVENNESS (9): at most 5 % of 20-second blocks with a frame over the limit (the profiler's ORANGE bar: over
//     35 ms - src/viewer/flight_recorder.js draws it), none with a freeze (its RED bar: over 100 ms);
//   - the loading screens stay responsive (10): the frames under a loading screen, on their own.
// Nothing is re-measured: the recorder's rows and events are the evidence (the loop's CPU slots, long tasks, long
// animation frames and the scripts they name, shader links and the draws held on them - by OWNER, program_id.js -,
// premises built, garage tasks, heap drops, the GPU's time where it was timed).
//
//   node tools/freeze_ledger.js <flydiy-flightlog-*.json[.gz]> [--out ledger.json] [--md ledger.md] [--min 50] [--show 40]
//
// HOW A FRAME IS READ (the recorder's and analyze_log.js's rule): a frame's interval dt is rAF's clock since the
// rendered frame before it. It holds (a) THE LOOP'S WORK of that previous frame, which the recorder split into slots,
// and (b) THE TIME OUTSIDE THE LOOP until this frame's rAF: timers, promises (a compile slice, a worker's answer),
// the browser's own work, the wait for the display. So for each long frame:
//     loop      each slot's ms OVER that slot's median in the same context (its usual cost is not the freeze's cause)
//     links     shader links and link waits that ran OUTSIDE the loop (inside it they are the loop's `shader` slot)
//     scripts   long-animation-frame scripts and garage tasks, by name (the part a long task cannot name)
//     tasks     long tasks nobody named, clipped to the outside time and to what the scripts did not cover
//     display   the usual wait for the display: up to one frame of the cap
//     UNATTRIBUTED   the rest. A legitimate result: it is what the recorder cannot see (the GPU process, the
//                    compositor, another tab, the driver). The GPU's own time is printed beside it when timed.
// A cause is NEVER inferred from nearness: a link 2 s earlier is not this frame's; only what overlaps the interval.
// CONFIDENCE: the named share of the frame's EXCESS over its budget: confirmed >= 80 %, partial >= 40 %, else open.
//
// THE ACTIONS (objectives 5 and 6): 'act' events (a garage change, the interior view) - click to the first frame
// drawn, to the last frame over 100 ms it caused (settled), the worst frame in it, against the user's target.
// AS A MODULE: require('./freeze_ledger.js').ledger(log, opt) -> the object
'use strict';
const fs = require('fs'), path = require('path');
const AL = require(path.join(__dirname, 'analyze_log.js'));
const PR = require(path.join(__dirname, 'program_report.js'));
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10;
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : null;
// THE LIMITS SIT ON MULTIPLES OF THE DISPLAY'S INTERVAL (PERF-LEAD, 23 Nov): 50.0, 100.0 and 250.0 ms are 3, 6 and 15
// intervals at 60 Hz, so "over 100 ms" flipped on the frame time's jitter (one log: 138 frames at 99 ms or more, 90 over
// 100.0, 61 over 104). ONE RULE, the same in tools/perf/user_log.py and written in PERF-OBJECTIVES.md: a frame counts as
// OVER 50 / 100 / 250 ms from 54 / 104 / 254 ms - 7 intervals or more is over 100; a frame of 6 intervals is AT 100.
// 35 ms stays (33.3 is clear of it). The frames AT a limit (within 4 ms of it) are counted and PRINTED beside the row,
// never dropped: a change that moves frames between 6 and 7 intervals stays visible.
const EDGE = 4, NOMINAL = { long: 50, freeze: 100, hard: 250 };
const ORANGE = 35, LONG = NOMINAL.long + EDGE, FREEZE = NOMINAL.freeze + EDGE, HARD = NOMINAL.hard + EDGE, BLOCK = 20000;
const atLimit = (dt, nom) => dt > nom - EDGE && dt <= nom + EDGE;
const F = { garage: 1, running: 2, held: 4, manual: 8, away: 16, freeze: 32, boot: 64, gpuForeign: 128, noRender: 256 };
const ACT_TARGET = { 'garage-change': { ms: 5000, row: 5 }, 'interior-view': { ms: 2000, row: 6 }, 'garage-to-world': { ms: 20000, row: 3 }, 'world-to-garage': { ms: 3000, row: 4 } };

// what a frame was: the loading screen wins, then the shed, then a held / paused loop, else the world
function contextOf(r) {
  const f = r.flags === r.flags ? r.flags : 0;
  if (f & F.away) return 'hidden';
  if (f & F.boot) return 'loading';
  if (f & F.garage) return 'garage';
  if (f & (F.held | F.noRender)) return 'paused';
  return 'world';
}
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
// the length of the union of [a, b) intervals
function unionLen(iv) {
  if (!iv.length) return 0;
  iv = iv.slice().sort((x, y) => x[0] - y[0]); let n = 0, a = iv[0][0], b = iv[0][1];
  for (let i = 1; i < iv.length; i++) { if (iv[i][0] > b) { n += b - a; a = iv[i][0]; b = iv[i][1]; } else if (iv[i][1] > b) b = iv[i][1]; }
  return n + (b - a);
}
const clip = (a, b, lo, hi) => { const x = Math.max(a, lo), y = Math.min(b, hi); return y > x ? [x, y] : null; };
// a long-animation-frame's text (flight_recorder.js): 'blocking Nms, render Nms; invoker fn @file:pos Nms; ...'
function loafScripts(detail) {
  const out = []; if (typeof detail !== 'string') return out;
  for (const part of detail.split('; ').slice(1)) { const m = /^(.*) (\d+)ms$/.exec(part); if (m) out.push({ name: m[1].trim(), ms: +m[2] }); }
  return out;
}

function ledger(log, opt) {
  const o = opt || {}, MIN = o.min || LONG, H = log.header || {};
  const rows = AL.frames(log), SL = H.slots || [];
  const events = (log.events || []).map(e => ({ t: e[0], kind: e[1], ms: e[2], d: e[3] })).sort((a, b) => a.t - b.t);
  const progs = new Map(PR.programs(log).map(p => [p.n, p]));
  const owner = n => { const p = progs.get(n); return p ? (p.own && p.own.length ? p.own.join(' + ') : 'UNOWNED ' + ((p.mat && p.mat[0]) || p.name || p.type || '')) : null; };
  const names = (H.codes || {}), phaseName = c => (names.phase && names.phase[c]) || '', camName = c => (names.cam && names.cam[c]) || '';
  const marks = events.filter(e => e.kind === 'mark' && typeof e.d === 'string' && e.d.startsWith('seg:'));
  const segAt = t => { let s = null; for (const m of marks) { if (m.t > t) break; s = m.d.slice(4); } return s === 'end' ? null : s; };
  for (const r of rows) r.ctx = contextOf(r);
  // each slot's usual cost in each context (the median): a frame's cause is what it spent OVER that
  const med = {};
  for (const c of ['loading', 'garage', 'world', 'paused']) { const R = rows.filter(r => r.ctx === c && r.dt === r.dt && r.dt <= ORANGE); med[c] = {}; for (const k of SL) med[c][k] = median(R.map(r => r[k]).filter(x => x === x)); med[c].work = median(R.map(r => r.work).filter(x => x === x)); }
  // the events by start time, for the interval look-ups (two pointers would do; the logs are small)
  const LONGEV = new Set(['longtask', 'loaf', 'link', 'linkwait', 'gtask', 'prem', 'edit', 'wkmsg', 'recupwalk']);
  const evIn = (a, b) => events.filter(e => { const end = e.t + (e.ms && LONGEV.has(e.kind) ? e.ms : 0); return end > a && e.t < b; });
  const budgetOf = r => { const cap = r.cap > 0 ? r.cap : 60; return 1000 / cap; };

  const entries = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!(r.dt > MIN) || r.ctx === 'hidden') continue;
    const p = rows[i - 1], t0 = r.t - r.dt, t1 = r.t, budget = budgetOf(r);
    const work = p.work === p.work ? Math.min(p.work, r.dt) : 0, loopEnd = t0 + work, outside = r.dt - work;
    const M = med[r.ctx] || {}, parts = [];
    // (a) the loop, slot by slot, over its usual cost
    let loopExcess = 0; const slots = {};
    for (const k of SL) { const v = p[k]; if (!(v >= 0.5)) continue; slots[k] = r1(v); const x = v - (M[k] || 0); if (x >= 2) { loopExcess += x; parts.push({ what: 'loop: ' + k, ms: x, kind: 'loop' }); } }
    // WHAT ARRIVED IN THIS FRAME AND WHAT ITS FIRST DRAW COST (PERF-LEAD, 22 Nov: the table the coordinator is built on).
    // The render slot's excess is split: the GPU data created in the loop (the recorder's 'gpuup': textures, buffers,
    // mipmaps - timed calls), the programs first used in it ('proguse': the first use's whole cost, less the link wait
    // the shader slot already holds), and what is left is the draws themselves. The streamers' own word ('deliver'
    // events: FLIGHT_REC.event('deliver', ms, { s, n, what })) says who brought it, where a streamer says so.
    const EA = evIn(t0, t1);
    const ups = EA.filter(e => e.kind === 'gpuup' && e.d && e.d.at === 'loop' && e.t <= loopEnd + 1), upMs = ups.reduce((a, e) => a + (e.ms || 0), 0);
    const sumA = (k, i) => ups.reduce((a, e) => a + ((e.d[k] || [])[i] || 0), 0);
    const uploads = ups.length ? { ms: r1(upMs), textures: sumA('tex', 0), textureMs: r1(sumA('tex', 1)), megapixels: r1(sumA('tex', 2)), compressedKB: sumA('tex', 3), buffers: sumA('buf', 0), bufferMs: r1(sumA('buf', 1)), bufferKB: sumA('buf', 2),
      updates: sumA('sub', 0), updateKB: sumA('sub', 1), mipmaps: sumA('mip', 0), mipmapMs: r1(sumA('mip', 1)), newGeometries: ups.reduce((a, e) => a + (e.d.geo || 0), 0), newTextures: ups.reduce((a, e) => a + (e.d.texNew || 0), 0) } : null;
    const uses = EA.filter(e => e.kind === 'proguse' && e.t >= t0 && e.t <= loopEnd + 1).map(e => ({ n: e.d, owner: (typeof e.d === 'number' && owner(e.d)) || 'a program the log does not name', ms: e.ms == null ? null : r1(e.ms) }));
    const useMs = uses.reduce((a, u) => a + (u.ms || 0), 0);
    const deliveries = EA.filter(e => e.kind === 'deliver' && e.d).map(e => ({ streamer: e.d.s || '?', n: e.d.n == null ? null : e.d.n, what: e.d.what || null, ms: r1(e.ms), inLoop: e.t < loopEnd }));
    {
      const ri = parts.findIndex(x => x.what === 'loop: render');
      if (ri >= 0 && (upMs >= 1 || useMs >= 1)) {
        const R0 = parts[ri]; let left = R0.ms;
        const waitIn = EA.filter(e => e.kind === 'linkwait' && e.t < loopEnd).reduce((a, e) => a + (e.ms || 0), 0);
        const a = Math.min(left, upMs); left -= a;
        const b = Math.min(left, Math.max(0, useMs - waitIn)); left -= b;
        parts.splice(ri, 1);
        if (a >= 1) parts.push({ what: 'loop: render: new GPU data (' + [uploads.textures ? uploads.textures + ' texture calls, ' + uploads.megapixels + ' MP' + (uploads.compressedKB ? ' + ' + uploads.compressedKB + ' KB compressed' : '') : '', uploads.buffers ? uploads.buffers + ' buffers, ' + uploads.bufferKB + ' KB' : '', uploads.mipmaps ? uploads.mipmaps + ' mipmap builds' : ''].filter(Boolean).join('; ') + ')', ms: a, kind: 'loop', group: 'loop: render: new GPU data' });
        if (b >= 1) parts.push({ what: 'loop: render: first use of ' + uses.length + ' program(s): ' + [...new Set(uses.map(u => u.owner))].slice(0, 3).join(', '), ms: b, kind: 'loop', group: 'loop: render: first use of programs' });
        if (left >= 1) parts.push({ what: 'loop: render: the draws themselves', ms: left, kind: 'loop', group: 'loop: render: the draws themselves' });
      }
    }
    // what the `shader` slot was: the links and the waits inside the loop, by owner
    const E = evIn(t0, t1), inLoop = e => e.t < loopEnd;
    const linkNames = (list) => { const by = new Map(); for (const e of list) { const n = typeof e.d === 'number' ? e.d : null, w = (n != null && owner(n)) || 'a program the log does not name'; by.set(w, (by.get(w) || 0) + (e.ms || 0)); }
      return [...by].sort((a, b) => b[1] - a[1]).map(([w, ms]) => ({ owner: w, ms: r1(ms) })); };
    const waitsIn = E.filter(e => e.kind === 'linkwait' && inLoop(e)), linksIn = E.filter(e => e.kind === 'link' && inLoop(e));
    // (b) outside the loop: named work first (links, waits, scripts, garage tasks, premises, editor actions) ...
    const named = [], out = E.filter(e => !inLoop(e) || e.t + (e.ms || 0) > loopEnd);
    const add = (e, what, kind) => { const c = clip(e.t, e.t + (e.ms || 0), loopEnd, t1); if (c) named.push({ iv: c, what, kind }); };
    for (const e of out) {
      if (e.kind === 'linkwait') add(e, 'draw/compile held on a link: ' + ((typeof e.d === 'number' && owner(e.d)) || 'a program the log does not name'), 'link');
      else if (e.kind === 'link') add(e, 'shader link call: ' + ((typeof e.d === 'number' && owner(e.d)) || 'a program the log does not name'), 'link');
      else if (e.kind === 'gtask') add(e, 'garage task: ' + e.d, 'script');
      else if (e.kind === 'recupwalk') add(e, 'DIAGNOSTIC: the ?recup=2 naming walk (not the game)', 'script');
      else if (e.kind === 'wkmsg') add(e, 'worker reply handled: ' + (e.d || '?'), 'script');   // (the recorder's worker instrument: a reply's handler of 16 ms or more, by the worker's name)
      else if (e.kind === 'gpuup' && e.d && e.d.at === 'out') { const c = clip(e.t - (e.ms || 0), e.t, loopEnd, t1); if (c) named.push({ iv: c, what: 'GPU data made between frames (textures / buffers)', kind: 'script' }); }
      else if (e.kind === 'deliver' && e.ms) add(e, 'streamer delivered: ' + ((e.d && e.d.s) || '?'), 'script');
      else if (e.kind === 'prem') add(e, 'premises built' + (e.d ? ': ' + String(typeof e.d === 'string' ? e.d : JSON.stringify(e.d)).slice(0, 60) : ''), 'script');
      else if (e.kind === 'edit') add(e, 'editor action' + (e.d ? ': ' + String(typeof e.d === 'string' ? e.d : (e.d.a || e.d.k || JSON.stringify(e.d))).slice(0, 60) : ''), 'script');
      else if (e.kind === 'loaf') { let at = Math.max(e.t, loopEnd);
        // (the game's own rAF callback named by the browser: what of it lies past the recorder's work is the loop's
        //  unrecorded edge - before FR.begin, after FR.end -, not a script outside it)
        for (const s of loafScripts(e.d)) { const own = /^FrameRequestCallback/.test(s.name); const c = clip(at, at + (own ? Math.max(0, s.ms - work) : s.ms), loopEnd, t1);
          if (c) named.push({ iv: c, what: own ? "loop: outside the recorder's begin/end (the rAF callback's remainder)" : 'script: ' + s.name, kind: own ? 'loop' : 'script' }); if (!own) at += s.ms; } }
    }
    // (a named piece counts once: the later ones only for what the earlier ones did not cover)
    const covered = []; const byWhat = new Map();
    for (const nmd of named.sort((a, b) => (b.iv[1] - b.iv[0]) - (a.iv[1] - a.iv[0]))) { const before = unionLen(covered); covered.push(nmd.iv); const got = unionLen(covered) - before;
      if (got > 0.5) { const k = nmd.kind + '|' + nmd.what; byWhat.set(k, (byWhat.get(k) || 0) + got); } }
    let namedMs = 0; for (const [k, ms] of byWhat) { const [kind, what] = k.split('|'); parts.push({ what, ms, kind }); namedMs += ms; }
    // ... then the long tasks nobody named, for what the named pieces left
    const taskIv = out.filter(e => e.kind === 'longtask' || e.kind === 'loaf').map(e => clip(e.t, e.t + (e.ms || 0), loopEnd, t1)).filter(Boolean);
    const taskOnly = Math.max(0, unionLen(covered.concat(taskIv)) - unionLen(covered));
    if (taskOnly >= 2) parts.push({ what: 'main-thread task, not named by the browser', ms: taskOnly, kind: 'task' });
    // the usual wait for the display, then the rest
    const baseLoop = Math.max(0, work - loopExcess);
    const display = Math.max(0, Math.min(budget, outside - namedMs - taskOnly));
    const un = Math.max(0, outside - namedMs - taskOnly - display);
    if (un >= 2) parts.push({ what: 'UNATTRIBUTED (outside the loop, no event)', ms: un, kind: 'none' });
    parts.sort((a, b) => b.ms - a.ms);
    const excess = Math.max(0, r.dt - budget), namedAll = loopExcess + namedMs;
    const conf = excess <= 0 ? 'n/a' : namedAll >= 0.8 * excess ? 'confirmed' : namedAll >= 0.4 * excess ? 'partial' : 'open';
    // WHAT KIND OF LONG FRAME. An OVERRUN: the loop's work passed its frame's budget while staying under twice its usual
    // cost - nothing exceptional happened, the steady cost sits too near the budget and the frame slipped a refresh or
    // two (the remedy is the steady cost). A SPIKE: the loop's work at twice its usual or more (something ran in it).
    // OUTSIDE: the loop was usual and the time went between frames (a timer, a compile slice, a worker's answer, the display).
    const usual = M.work || 0, cls = work >= 2 * Math.max(usual, 4) ? 'spike' : (outside - display) > Math.max(loopExcess, 8) ? 'outside' : work > budget ? 'overrun' : 'outside';
    const slip = Math.max(0, Math.round((r.dt - budget) / (1000 / 60)));
    const gc = E.filter(e => e.kind === 'gc').map(e => e.d), slow = E.filter(e => e.kind === 'shaderslow').map(e => String(e.d).slice(0, 160));
    const made = E.filter(e => e.kind === 'prog').map(e => (e.d.own || 'UNOWNED ' + (e.d.mat || e.d.name || e.d.type)) + ' [' + e.d.ctx + ']');
    entries.push({
      t: r1(r.t), s: r1(r.t / 1000), ms: r1(r.dt), ctx: r.ctx, class: cls, refreshesLate: slip, seg: segAt(r.t), over: r.dt > HARD ? 250 : r.dt > FREEZE ? 100 : 50,
      where: r.ctx === 'world' ? { x: r1(p.x), y: r1(p.y), z: r1(p.z), agl: r1(p.agl), spd: r1(p.spd), phase: phaseName(p.phase), cam: camName(p.cam) } : null,
      budget: r1(budget), excess: r1(excess), cause: parts.length ? parts[0].what : 'UNATTRIBUTED', confidence: conf,
      parts: parts.map(x => ({ what: x.what, ms: r1(x.ms), kind: x.kind, group: x.group || x.what })),
      loop: { work: r1(work), usual: r1(M.work || 0), slots }, outside: { ms: r1(outside), named: r1(namedMs), tasks: r1(taskOnly), display: r1(display), unattributed: r1(un) },
      shaderInLoop: (waitsIn.length || linksIn.length) ? { waits: linkNames(waitsIn), links: linkNames(linksIn) } : null,
      premises: (() => { const P = EA.filter(e => e.kind === 'premslow' && e.d); return P.length ? { built: [].concat(...P.map(e => e.d.built || [])), worst: P[P.length - 1].d.worst || null } : null; })(),
      arrived: (uploads || uses.length || deliveries.length) ? { uploads, firstUse: uses.length ? uses : null, deliveries: deliveries.length ? deliveries : null } : null,
      programsMade: made.length ? made : null, shaderslow: slow.length ? slow : null, gc: gc.length ? gc : null,
      gpuMs: p.gpu === p.gpu ? r1(p.gpu) : null, draws: p.calls === p.calls ? p.calls : null,
    });
  }

  // ---- the user's numbers, per context -------------------------------------------------------------------------
  const contexts = {};
  for (const c of ['world', 'garage', 'loading', 'paused']) {
    const R = rows.filter(r => r.ctx === c && r.dt === r.dt); if (!R.length) continue;
    const total = R.reduce((a, r) => a + r.dt, 0), over = lim => R.filter(r => r.dt > lim);
    const ex = lim => over(lim).reduce((a, r) => a + (r.dt - budgetOf(r)), 0);
    // the 20-second blocks of this context's own time, in order; a last block under 10 s is not a block
    const blocks = []; let acc = 0, b = { ms: 0, orange: 0, over50: 0, red: 0, hard: 0, worst: 0, t: R[0].t };
    for (const r of R) { b.ms += r.dt; if (r.dt > ORANGE) b.orange++; if (r.dt > LONG) b.over50++; if (r.dt > FREEZE) b.red++; if (r.dt > HARD) b.hard++; if (r.dt > b.worst) b.worst = r.dt;
      if (b.ms >= BLOCK) { blocks.push(b); b = { ms: 0, orange: 0, over50: 0, red: 0, hard: 0, worst: 0, t: r.t }; } }
    if (b.ms >= BLOCK / 2) blocks.push(b);
    const nb = blocks.length, withO = blocks.filter(x => x.orange).length, withR = blocks.filter(x => x.red).length;
    // ... and THE 120-FRAME METER WINDOWS (tools/perf_trace.js targets.meterWindows; Codex's flightlog_evidence rule): the
    // SAME 35 ms line over sliding windows of 120 frames (2-4 s each) - a different window, so a different share. Both
    // are printed by name so that the two tools agree; the user's table (row 9) is the 20-second blocks.
    let mw = 0, mwO = 0; { let run = 0, orIn = 0; for (let i = 0; i < R.length; i++) { run++; if (R[i].dt > ORANGE) orIn++; if (run > 120 && R[i - 120].dt > ORANGE) orIn--; if (run >= 120) { mw++; if (orIn) mwO++; } } }
    const E = entries.filter(e => e.ctx === c);
    const byCause = new Map();
    for (const e of E) for (const part of e.parts) { const k = part.group || part.what; let g = byCause.get(k); if (!g) byCause.set(k, g = { what: k, kind: part.kind, ms: 0, frames: 0, freezes: 0, worst: 0 });
      g.ms += part.ms; g.frames++; if (e.ms > FREEZE) g.freezes++; if (part.ms > g.worst) g.worst = part.ms; }
    const exAll = E.reduce((a, e) => a + e.excess, 0), unAll = E.reduce((a, e) => a + e.outside.unattributed, 0);
    contexts[c] = {
      frames: R.length, seconds: r1(total / 1000),
      over35: { n: over(ORANGE).length, pct: pct(over(ORANGE).length, R.length) }, over50: { n: over(LONG).length, pct: pct(over(LONG).length, R.length), excessMs: Math.round(ex(LONG)) },
      over100: { n: over(FREEZE).length, pct: pct(over(FREEZE).length, R.length), excessMs: Math.round(ex(FREEZE)) }, over250: { n: over(HARD).length, pct: pct(over(HARD).length, R.length) },
      at: { 50: R.filter(r => atLimit(r.dt, NOMINAL.long)).length, 100: R.filter(r => atLimit(r.dt, NOMINAL.freeze)).length, 250: R.filter(r => atLimit(r.dt, NOMINAL.hard)).length },
      worstMs: r1(Math.max(...R.map(r => r.dt))), timeInLongFramesPct: pct(over(LONG).reduce((a, r) => a + r.dt, 0), total),
      blocks: { seconds: BLOCK / 1000, n: nb, withOrange: withO, withOrangePct: pct(withO, nb), with50: blocks.filter(x => x.over50).length, withFreeze: withR, withFreezePct: pct(withR, nb), with250: blocks.filter(x => x.hard).length,
        list: blocks.map(x => ({ s: r1(x.t / 1000), orange: x.orange, over50: x.over50, red: x.red, worst: r1(x.worst) })) },
      meterWindows: { framesPerWindow: 120, eligible: mw, withOrange: mwO, withOrangePct: pct(mwO, mw), note: 'perf_trace.js targets.meterWindows: sliding 120-frame windows, the same 35 ms line' },
      classes: ['overrun', 'spike', 'outside'].map(k => { const X = E.filter(e => e.class === k); return { class: k, frames: X.length, over100: X.filter(e => e.ms > FREEZE).length, excessMs: Math.round(X.reduce((a, e) => a + e.excess, 0)), medianMs: r1(median(X.map(e => e.ms))) }; }),
      usualLoopMs: r1((med[c] || {}).work || 0), capFps: median(R.map(r => r.cap).filter(x => x > 0)) || null,
      attribution: { excessMs: Math.round(exAll), unattributedMs: Math.round(unAll), unattributedPct: pct(unAll, exAll), confirmed: E.filter(e => e.confidence === 'confirmed').length, partial: E.filter(e => e.confidence === 'partial').length, open: E.filter(e => e.confidence === 'open').length },
      causes: [...byCause.values()].sort((a, b) => b.ms - a.ms).map(g => ({ what: g.what, kind: g.kind, ms: Math.round(g.ms), frames: g.frames, freezes: g.freezes, worstMs: r1(g.worst) })),
    };
  }
  // ---- THE PICTURE STOOD STILL (PERF-LEAD, 23 Nov, with the user watching a crash) --------------------------------------
  // A frame the draw guard holds is rendered and NOT presented: its dt is a frame's, and the frames' rows above never see
  // it - "worst frame 233 ms" while the screen showed the page for 8 s. A still is ONE freeze of its whole length, from the
  // last picture presented to the next: the page's own 'still' events ([t at its end, ms, { f: frames held, keep }]), or,
  // where a log has none, the runs of frames flagged notShown. Its cause: the programs still linking over its span (a held
  // draw waits for one of them) and the materials the guard named ('guardhold').
  const STF = (H.flags || {}).notShown || 0;
  let stills = events.filter(e => e.kind === 'still' && e.ms > 0).map(e => ({ t0: e.t - e.ms, t1: e.t, ms: e.ms, frames: e.d && e.d.f != null ? e.d.f : null, keep: e.d && e.d.keep != null ? e.d.keep : null, by: 'event' }));
  if (!stills.length && STF) { let run = null;
    for (let i = 0; i < rows.length; i++) { const r = rows[i], ns = r.flags === r.flags && (r.flags & STF);
      if (ns) { if (!run) run = { t0: i > 0 ? rows[i - 1].t : r.t, n: 0 }; run.n++; }
      else if (run) { stills.push({ t0: run.t0, t1: r.t, ms: r.t - run.t0, frames: run.n, keep: null, by: 'flag' }); run = null; } }
    if (run && rows.length) stills.push({ t0: run.t0, t1: rows[rows.length - 1].t, ms: rows[rows.length - 1].t - run.t0, frames: run.n, keep: null, by: 'flag', open: true }); }
  const ctxAt = t => { let lo = 0, hi = rows.length - 1, b = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (rows[m].t <= t) { b = m; lo = m + 1; } else hi = m - 1; } return rows.length ? rows[b].ctx : null; };
  stills = stills.map(s => { const P = [...progs.values()].filter(p => p.t < s.t1 && (p.readyT == null || p.readyT > s.t0)), byO = new Map();
    for (const p of P) { const w = owner(p.n) || '?'; let g = byO.get(w); if (!g) byO.set(w, g = { owner: w, n: 0, pendMs: 0, lastReady: 0, never: 0 }); g.n++; const a = Math.max(p.t, s.t0), b = p.readyT == null ? s.t1 : Math.min(p.readyT, s.t1); g.pendMs += Math.max(0, b - a); if (p.readyT == null) g.never++; else if (p.readyT > g.lastReady) g.lastReady = p.readyT; }
    const gh = events.filter(e => e.kind === 'guardhold' && e.t >= s.t0 - 50 && e.t <= s.t1 + 50), names = [...new Set([].concat(...gh.map(e => (e.d && e.d.new) || [])))];
    return { t: r1(s.t1), s: r1(s.t0 / 1000), ms: r1(s.ms), frames: s.frames, keep: s.keep, by: s.by, open: !!s.open, ctx: ctxAt(s.t1 - 1), seg: segAt(s.t1 - 1),
      pending: [...byO.values()].sort((a, b) => b.pendMs - a.pendMs).slice(0, 8).map(g => ({ owner: g.owner, programs: g.n, pendingMs: Math.round(g.pendMs), readyBeforeEndMs: g.lastReady ? Math.round(s.t1 - g.lastReady) : null, never: g.never })),
      pendingPrograms: P.length, heldMax: gh.reduce((a, e) => Math.max(a, (e.d && e.d.held) || 0), 0), heldFirst: names.slice(0, 10),
      // (the lab's guard also says how many of the held draws are the GROUND family's - what ?holdframe=ground still holds a frame for; null where the event has no such count)
      heldGroundMax: gh.some(e => e.d && e.d.ground != null) ? gh.reduce((a, e) => Math.max(a, (e.d && e.d.ground) || 0), 0) : null, guardFrames: gh.length }; });
  const stillOf = c => stills.filter(s => s.ctx === c), stillSum = L0 => ({ n: L0.length, over100: L0.filter(s => s.ms > FREEZE).length, over250: L0.filter(s => s.ms > HARD).length, worstMs: L0.length ? Math.max(...L0.map(s => s.ms)) : 0, totalMs: Math.round(L0.reduce((a, s) => a + s.ms, 0)) });
  for (const c of Object.keys(contexts)) contexts[c].stills = stillSum(stillOf(c));
  const W = contexts.world, G = contexts.garage, L = contexts.loading;
  const verdict = (ok, text) => ({ ok, text });
  const objectives = {
    7: G ? verdict(G.over100.n === 0, 'garage: ' + G.over100.n + ' frame(s) over 100 ms in ' + G.seconds + ' s (worst ' + G.worstMs + ' ms; ' + G.at[100] + ' more AT 100 ms)') : null,
    8: W ? verdict(W.over100.n === 0 && W.stills.over100 === 0, 'world: ' + W.over100.n + ' frame(s) over 100 ms in ' + W.seconds + ' s (worst ' + W.worstMs + ' ms; ' + W.at[100] + ' more AT 100 ms)' +
      (W.stills.n ? '; AND THE PICTURE STOOD STILL ' + W.stills.n + ' time(s), ' + W.stills.over100 + ' over 100 ms, the worst ' + r1(W.stills.worstMs) + ' ms, ' + r1(W.stills.totalMs / 1000) + ' s in all (frames rendered and not presented: the frames\' own times do not show it)' :
       (STF || events.some(e => e.kind === 'still') ? '; no still picture' : '; STILL PICTURES NOT RECORDED in this log (a build before PERF-TRACE 7): a held frame reads as an ordinary one here'))) : null,
    9: W && W.blocks.n ? verdict(W.blocks.withOrangePct <= 5 && W.blocks.withFreeze === 0, 'world: ' + W.blocks.withOrange + ' of ' + W.blocks.n + ' 20-second blocks have a frame over 35 ms (' + W.blocks.withOrangePct + ' %; the target 5 %), ' + W.blocks.withFreeze + ' have a freeze over 100 ms (the target 0)') : null,
    10: L ? verdict(L.over100.n === 0, 'loading screens: ' + L.over100.n + ' frame(s) over 100 ms in ' + L.seconds + ' s (' + L.at[100] + ' more AT 100 ms), the worst ' + L.worstMs + ' ms (a frame that long is a screen that did not answer)') : null,
  };

  // ---- the actions (objectives 5 and 6, and any 'act' the page marks) ----------------------------------------------
  const acts = [], open = new Map();
  for (const e of events) {
    if (e.kind !== 'act' || !e.d || !e.d.a) continue;
    if (e.d.s === 1) { const was = open.get(e.d.a); if (was) acts.push(actRow(was, null)); open.set(e.d.a, e); continue; }   // (an action with no end event: closed by the next one)
    const st = open.get(e.d.a); if (!st) continue; open.delete(e.d.a);
    acts.push(actRow(st, e));
  }
  for (const st of open.values()) acts.push(actRow(st, null));
  function actRow(st, en) {
    const t0 = st.t, tEnd = en ? en.t : t0, tail = 3000, R = rows.filter(r => r.t > t0 && r.t - r.dt < tEnd + tail && r.dt === r.dt && r.ctx !== 'hidden');
    const first = rows.find(r => r.t > t0 && r.t - r.dt >= t0), longs = R.filter(r => r.dt > FREEZE), lastLong = longs[longs.length - 1];
    const settled = Math.max(tEnd, lastLong ? lastLong.t : 0, first ? first.t : 0), T = ACT_TARGET[st.d.a] || null;
    const worst = R.length ? Math.max(...R.map(r => r.dt)) : null, ms = settled - t0;
    return { act: st.d.a, detail: st.d, at: r1(t0 / 1000), doneMs: en ? r1(tEnd - t0) : null, firstFrameMs: first ? r1(first.t - t0) : null, settledMs: r1(ms), worstFrameMs: r1(worst), framesOver100: longs.length,
      target: T ? { row: T.row, ms: T.ms } : null, ok: T ? (ms <= T.ms && longs.length === 0) : null,
      frames: entries.filter(x => x.t > t0 && x.t <= settled + 1).map(x => ({ ms: x.ms, cause: x.cause, confidence: x.confidence })) };
  }
  return { kind: 'flydiy-freeze-ledger', v: 1, log: o.logFile || null, build: H.build || null, gpu: (H.gpu || {}).unmaskedRenderer || null,
    limits: { orangeMs: ORANGE, longMs: LONG, freezeMs: FREEZE, hardMs: HARD, blockS: BLOCK / 1000, listedOverMs: MIN, nominal: NOMINAL, edgeMs: EDGE },
    gpuTimer: H.gpuTimer ? { coverage: H.gpuTimer.coverage, ok: H.gpuTimer.ok } : null, recorder: H.overhead || null,
    // was the page seen? (a hidden or unfocused page is throttled: its frames mean nothing)
    page: { canvas: H.canvas ? H.canvas.w + 'x' + H.canvas.h : null, css: H.canvas ? H.canvas.cssW + 'x' + H.canvas.cssH : null, window: H.window ? H.window.w + 'x' + H.window.h : null, dpr: H.dpr || null,
      seen: H.seen || null, hiddenEvents: events.filter(e => e.kind === 'vis' && e.d === 'hidden').length, blurEvents: events.filter(e => e.kind === 'focus' && e.d === 'blur').length,
      hiddenFrames: rows.filter(r => r.ctx === 'hidden').length },
    // the steady GPU traffic of the run (the recorder's totals): what every frame uploads, whether anything is new or not
    gpuData: H.gpuData ? Object.assign({}, H.gpuData, { perFrame: H.gpuData.frames ? { texCalls: r1(H.gpuData.texCalls / H.gpuData.frames), bufferCalls: r1(H.gpuData.bufferCalls / H.gpuData.frames),
      updateCalls: r1(H.gpuData.updateCalls / H.gpuData.frames), updateKB: Math.round(H.gpuData.updateMB * 1024 / H.gpuData.frames), bufferKB: Math.round(H.gpuData.bufferMB * 1024 / H.gpuData.frames) } : null }) : null,
    objectives, contexts, stills, stillsRecorded: !!(STF || events.some(e => e.kind === 'still')), actions: acts, premises: log.premises || null, uploads: log.uploads || null, entries };
}

function text(R, show) {
  const L = [], lp = (s, n) => String(s == null ? '-' : s).padStart(n), pad = (s, n) => String(s == null ? '-' : s).padEnd(n);
  L.push('FREEZE LEDGER  ' + (R.log || '') + '  build ' + (R.build || '?') + '  ' + (R.gpu || ''));
  L.push('  limits: orange > ' + R.limits.orangeMs + ' ms; OVER 50 / 100 (the user\'s freeze) / 250 ms is counted from ' + R.limits.longMs + ' / ' + R.limits.freezeMs + ' / ' + R.limits.hardMs + ' ms - 3, 6 and 15 display intervals at 60 Hz are AT the limit, not over it (the rule of 23 Nov); blocks of ' + R.limits.blockS + ' s' +
    (R.gpuTimer ? '; GPU timed on ' + Math.round((R.gpuTimer.coverage || 0) * 100) + ' % of the frames asked' : '; no GPU timer'));
  { const P = R.page || {}, S = P.seen, f = x => x ? (x.state || '?') + (x.focus === true ? ', focused' : x.focus === false ? ', NOT FOCUSED' : '') : 'not recorded';
    const bad = (S && ((S.start && (S.start.state !== 'visible' || S.start.focus === false)) || (S.now && (S.now.state !== 'visible' || S.now.focus === false)))) || P.hiddenEvents > 0;
    L.push('  the page: canvas ' + (P.canvas || '?') + ' (css ' + (P.css || '?') + ', window ' + (P.window || '?') + ', dpr ' + (P.dpr || '?') + '); at the start ' + f(S && S.start) + ', at the end ' + f(S && S.now) +
      '; hidden ' + (P.hiddenEvents || 0) + ' time(s) (' + (P.hiddenFrames || 0) + ' frames left out), focus lost ' + (S ? S.blurs : P.blurEvents || 0) + ' time(s)' + (bad ? '   <-- A HIDDEN OR UNFOCUSED PAGE IS THROTTLED: READ THE FRAMES WITH CARE' : '')); }
  if (R.gpuData && R.gpuData.perFrame) { const G = R.gpuData, f = G.perFrame;
    L.push('  GPU data over the run: ' + G.frames + ' frames touched it; per such frame ' + f.texCalls + ' texture calls, ' + f.bufferCalls + ' buffer creations (' + f.bufferKB + ' KB), ' + f.updateCalls + ' buffer updates (' + f.updateKB + ' KB); in all ' +
      G.megapixels + ' MP + ' + G.compressedMB + ' MB compressed of textures in ' + G.texMs + ' ms, ' + G.bufferMB + ' MB of new buffers in ' + G.bufferMs + ' ms, ' + G.updateMB + ' MB of updates'); }
  L.push(''); L.push('THE OFFICIAL ROWS');
  for (const k of Object.keys(R.objectives)) { const v = R.objectives[k]; if (v) L.push('  ' + lp(k, 2) + '  ' + (v.ok ? 'MET     ' : 'NOT MET ') + v.text); }
  for (const a of R.actions) L.push('  ' + lp(a.target ? a.target.row : '', 2) + '  ' + (a.ok == null ? '        ' : a.ok ? 'MET     ' : 'NOT MET ') + a.act + ': first frame ' + a.firstFrameMs + ' ms, settled ' + a.settledMs + ' ms, worst frame ' + a.worstFrameMs + ' ms, ' + a.framesOver100 + ' over 100 ms' + (a.target ? ' (the target ' + a.target.ms / 1000 + ' s, none over 100 ms)' : ''));
  if (R.stills && R.stills.length) { L.push(''); L.push('THE PICTURE STOOD STILL (frames rendered and NOT presented - the draw guard held a draw; a still is ONE freeze, from the last picture shown to the next; read from ' + (R.stills[0].by === 'event' ? 'the page\'s still events' : 'the frames\' notShown flag') + ')');
    L.push('  ' + lp('at s', 9) + lp('ms', 9) + lp('frames', 8) + lp('context', 9) + lp('linking', 9) + '  the programs still linking over it (owner: programs, ms pending inside it, ready how long before its end)');
    for (const s of R.stills.slice().sort((a, b) => b.ms - a.ms).slice(0, 30)) L.push('  ' + lp(s.s, 9) + lp(s.ms, 9) + lp(s.frames, 8) + lp(s.ctx, 9) + lp(s.pendingPrograms, 9) + '  ' + (s.pending.map(p => p.owner + ': ' + p.programs + ', ' + p.pendingMs + ' ms' + (p.never ? ', ' + p.never + ' NEVER READY' : p.readyBeforeEndMs != null ? ', ready ' + p.readyBeforeEndMs + ' ms before' : '')).join(' | ') || 'no program linking over it') +
      (s.heldMax ? '   [the guard held up to ' + s.heldMax + ' draws' + (s.heldGroundMax != null ? ', ' + s.heldGroundMax + ' of them the ground family\'s' : '') + (s.heldFirst.length ? '; first held: ' + s.heldFirst.slice(0, 6).join('; ') : '') + ']' : (s.guardFrames === 0 ? '   [no guardhold event over it]' : '')) + (s.open ? '   (still held at the log\'s end)' : '')); }
  L.push(''); L.push('BY CONTEXT');
  L.push('  ' + pad('', 9) + lp('frames', 8) + lp('s', 8) + lp('>35', 7) + lp('>50', 6) + lp('>100', 6) + lp('>250', 6) + lp('worst', 8) + lp('excess>50', 10) + lp('blocks', 7) + lp('orange', 7) + lp('%', 6) + lp('red', 5) + lp('unattr %', 9));
  for (const c of Object.keys(R.contexts)) { const C = R.contexts[c];
    L.push('  ' + pad(c, 9) + lp(C.frames, 8) + lp(C.seconds, 8) + lp(C.over35.n, 7) + lp(C.over50.n, 6) + lp(C.over100.n, 6) + lp(C.over250.n, 6) + lp(C.worstMs, 8) + lp(C.over50.excessMs, 10) + lp(C.blocks.n, 7) + lp(C.blocks.withOrange, 7) + lp(C.blocks.withOrangePct, 6) + lp(C.blocks.withFreeze, 5) + lp(C.attribution.unattributedPct, 9)); }
  L.push('  (blocks = the official row 9: 20-second blocks. The same 35 ms line over perf_trace.js\'s sliding 120-frame meter windows: ' + Object.keys(R.contexts).map(c => c + ' ' + R.contexts[c].meterWindows.withOrangePct + ' % of ' + R.contexts[c].meterWindows.eligible).join(', ') + ')');
  for (const c of Object.keys(R.contexts)) { const C = R.contexts[c]; if (!C.causes.length) continue;
    L.push(''); L.push(c.toUpperCase() + ': the loop usually takes ' + C.usualLoopMs + ' ms' + (C.capFps ? ' at a ' + C.capFps + ' fps cap (' + r1(1000 / C.capFps) + ' ms a frame)' : '') + '. The frames over ' + R.limits.listedOverMs + ' ms: ' +
      C.classes.map(k => k.frames + ' ' + k.class.toUpperCase() + ' (median ' + k.medianMs + ' ms, ' + k.over100 + ' over 100, ' + k.excessMs + ' ms of excess)').join('; '));
    L.push('  overrun = the loop over its budget but under twice its usual cost (the steady cost too near the budget); spike = twice its usual or more; outside = the time went between frames');
    L.push('CAUSES, ' + c.toUpperCase() + ' (' + C.attribution.confirmed + ' frames confirmed, ' + C.attribution.partial + ' partial, ' + C.attribution.open + ' open; ' + C.attribution.unattributedMs + ' of ' + C.attribution.excessMs + ' ms of excess unattributed)');
    L.push('  ' + lp('ms', 8) + lp('frames', 7) + lp('>100', 6) + lp('worst', 8) + '  what');
    for (const g of C.causes.slice(0, 18)) L.push('  ' + lp(g.ms, 8) + lp(g.frames, 7) + lp(g.freezes, 6) + lp(g.worstMs, 8) + '  ' + g.what); }
  if (R.uploads && R.uploads.rows) { const U = R.uploads, by = new Map();
    for (const r of U.rows) { const k = r.owner || ('(no owner) ' + (r.site ? 'marked by ' + String(r.site).split(' < ')[0] : r.at)); let g = by.get(k); if (!g) by.set(k, g = { owner: k, MB: 0, objects: 0, everyFrame: 0, unchanged: 0, sampled: 0 }); g.MB += r.MB; g.objects++; if (r.per100 >= 90) g.everyFrame++; g.unchanged += r.unchanged; g.sampled += r.sampled; }
    L.push(''); L.push('WHAT THE GAME MARKS FOR THE GPU SINCE THE REVEAL, BY OWNER (?recup=1: ' + U.frames + ' frames, ' + U.objects + ' objects, ' + U.MB + ' MB in all = ' + U.perFrameKB + ' KB a frame; ' + U.namedMB + ' MB named' + (U.walks ? '; ' + U.walks + ' naming walks, ' + U.walkMs + ' ms in all: ?recup=2' : '') + ')');
    L.push('  ' + lp('MB', 9) + lp('objects', 8) + lp('each frame', 11) + lp('unchanged', 12) + '  owner');
    for (const g of [...by.values()].sort((a, b) => b.MB - a.MB).slice(0, 25)) L.push('  ' + lp(r1(g.MB), 9) + lp(g.objects, 8) + lp(g.everyFrame, 11) + lp(g.sampled ? g.unchanged + ' of ' + g.sampled : '-', 12) + '  ' + g.owner);
    L.push('  THE LARGEST OBJECTS (frames in 100 it is marked; unchanged = sampled marks whose content sample was the same as the last one)');
    L.push('  ' + lp('MB', 9) + lp('KB each', 9) + lp('in 100', 8) + lp('unchanged', 12) + '  what');
    for (const r of U.rows.slice(0, 30)) L.push('  ' + lp(r.MB, 9) + lp(r.KB, 9) + lp(r.per100, 8) + lp(r.sampled ? r.unchanged + ' of ' + r.sampled : '-', 12) + '  ' + r.kind + ' ' + r.what + (r.dim ? ' [' + r.dim + ']' : '') + (r.name ? ' "' + r.name + '"' : '') + (!r.owner && r.site ? '  <- ' + r.site : '') + '  ' + (r.owner || '(no owner)') + '  @' + r.at);
    if (U.gl && U.gl.rows) { const G = U.gl, gby = new Map();
      for (const r of G.rows) { const k = r.owner || ('(no owner) ' + (r.site ? 'called by ' + String(r.site).split(' < ')[0] : r.at)); let g = gby.get(k); if (!g) gby.set(k, g = { owner: k, MB: 0, objects: 0, calls: 0, everyFrame: 0 }); g.MB += r.MB; g.objects++; g.calls += r.calls; if (r.per100 >= 90) g.everyFrame++; }
      L.push(''); L.push('WHAT THE GL WAS SENT SINCE THE REVEAL, BY OWNER (every bufferData / bufferSubData / texImage call, by the array or image it read: ' + G.objects + ' objects, ' + G.MB + ' MB in all = ' + G.perFrameKB + ' KB a frame; ' + G.namedMB + ' MB named by a drawn scene; a texture counts 4 bytes a pixel)');
      L.push('  ' + lp('MB', 9) + lp('KB/frame', 10) + lp('objects', 8) + lp('calls', 9) + lp('each frame', 11) + '  owner');
      for (const g of [...gby.values()].sort((a, b) => b.MB - a.MB).slice(0, 25)) L.push('  ' + lp(r1(g.MB), 9) + lp(Math.round(g.MB * 1024 / U.frames), 10) + lp(g.objects, 8) + lp(g.calls, 9) + lp(g.everyFrame, 11) + '  ' + g.owner);
      L.push('  THE LARGEST (KB = its largest call)'); L.push('  ' + lp('MB', 9) + lp('KB', 7) + lp('calls', 9) + lp('in 100', 8) + '  what');
      for (const r of G.rows.slice(0, 30)) L.push('  ' + lp(r.MB, 9) + lp(r.KB, 7) + lp(r.calls, 9) + lp(r.per100, 8) + '  ' + r.kind + ' ' + r.call + ' [' + r.dim + ']' + (r.what ? ' ' + r.what : '') + '  ' + (r.owner || '(no owner)') + '  @' + r.at + (r.site ? '  <- ' + r.site : '')); } }
  const E = R.entries.slice().sort((a, b) => b.ms - a.ms).slice(0, show || 40);
  L.push(''); L.push('THE FRAMES (the ' + E.length + ' longest of ' + R.entries.length + ' over ' + R.limits.listedOverMs + ' ms)');
  for (const e of E) {
    L.push('  ' + lp(e.s, 8) + ' s ' + lp(e.ms, 8) + ' ms  ' + pad(e.ctx, 8) + pad(e.class, 8) + pad(e.confidence, 10) + (e.seg ? '[' + e.seg + '] ' : '') + (e.where ? (e.where.phase || '') + ' agl ' + e.where.agl + ' m at ' + e.where.x + ',' + e.where.z + '  ' : '') + (e.gpuMs != null ? 'gpu ' + e.gpuMs + ' ms' : ''));
    L.push('  ' + ' '.repeat(24) + e.parts.slice(0, 4).map(p => r1(p.ms) + ' ' + p.what).join('; ') + (e.outside.display ? '; ' + e.outside.display + ' display wait' : ''));
    if (e.premises) L.push('  ' + ' '.repeat(24) + 'premises built in it (over 60 ms each): ' + e.premises.built.map(b => b[0] + ' ' + b[1] + ' ms').join(', ') + (e.premises.worst ? '; the stream\'s dearest frame so far [ms, items, post-work ms, next m]: ' + JSON.stringify(e.premises.worst) : ''));
    if (e.arrived) { const A = e.arrived, bits = [];
      if (A.deliveries) bits.push('delivered: ' + A.deliveries.map(d => d.streamer + (d.n != null ? ' x' + d.n : '') + (d.ms ? ' ' + d.ms + ' ms' : '')).join(', '));
      if (A.uploads) bits.push('GPU data ' + A.uploads.ms + ' ms (' + A.uploads.textures + ' tex ' + A.uploads.megapixels + ' MP, ' + A.uploads.buffers + ' buf ' + A.uploads.bufferKB + ' KB, +' + A.uploads.newGeometries + ' geometries, +' + A.uploads.newTextures + ' textures)');
      if (A.firstUse) bits.push('first use: ' + A.firstUse.slice(0, 3).map(u => u.owner + (u.ms != null ? ' ' + u.ms + ' ms' : '')).join(', ') + (A.firstUse.length > 3 ? ' +' + (A.firstUse.length - 3) : ''));
      if (bits.length) L.push('  ' + ' '.repeat(24) + 'arrived: ' + bits.join('; ')); }
    if (e.shaderInLoop && (e.shaderInLoop.waits.length || e.shaderInLoop.links.length)) L.push('  ' + ' '.repeat(24) + 'in the loop\'s shader slot: ' + e.shaderInLoop.waits.map(w => 'held ' + w.ms + ' ms on ' + w.owner).concat(e.shaderInLoop.links.map(w => 'linked ' + w.owner)).slice(0, 3).join('; '));
  }
  return L.join('\n');
}
module.exports = { ledger, text, contextOf };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--md', '--min', '--show'].includes(argv[i - 1])));
  if (!file) { console.error('usage: node tools/freeze_ledger.js <flightlog.json[.gz]> [--out ledger.json] [--md ledger.md] [--min 50] [--show 40]'); process.exit(2); }
  const R = ledger(AL.load(file), { logFile: path.basename(file), min: +opt('min', LONG) });
  const out = opt('out', file.replace(/\.json(\.gz)?$/i, '') + '.freezes.json');
  fs.writeFileSync(out, JSON.stringify(R, null, 1));
  const txt = text(R, +opt('show', 40)); console.log(txt);
  if (opt('md', null)) fs.writeFileSync(opt('md'), '```\n' + txt + '\n```\n');
  console.log('\nfreeze_ledger: ' + out);
}
