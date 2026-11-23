#!/usr/bin/env node
// slot_frames.js - WHAT HAPPENED INSIDE ONE SLOT OF THE LOOP, IN THE FRAMES WHERE THAT SLOT RAN LONG (PERF-TRACE, 22 Nov 2026)
//
// PERF-LEAD, on the 27-minute journey: the freeze ledger's first cause in the world is "loop: mirror" (12.8 s of excess
// over 557 frames, 18 of the 35 frames over 100 ms). The mirror is the scene drawn a second time (water.js
// mirrorRender); a second render does not spike by itself. Is it where things are drawn FIRST? This prints, for the
// frames whose slot ran `--min` ms or more over its usual cost in the same context:
//   - what the log's events say happened INSIDE the slot: programs first used (owner, the target they were keyed for,
//     the ms of the first use, linked during the load or in flight), links submitted, draws held on a link, streamer
//     deliveries; and the frame's new GPU data (textures, buffers, mipmaps);
//   - the frame's draw calls, triangles and GPU time against the context's usual ones (a jump in draws = the pass drew
//     more, not something new);
//   - how many of those frames have NO recorded event inside the slot (the draws themselves, or what no event covers);
//   - the programs by the TARGET they were keyed for: linked during the load / in flight, first used during the load /
//     in flight / never - a target whose programs are linked at the load and first USED in flight pays its first uses
//     in flight.
// WHERE THE SLOT IS IN THE FRAME. A build with PERF-TRACE 6 logs a 'laps' event for a frame of 50 ms or more (when each
// lap ended, with the GPU-data counters): the slot's window is then exact, and so is its share of the frame's uploads.
// An older log has only each slot's total: the window is placed by the loop's order (other, world, scene, hud, mirror,
// render), which leaves two unknowns - where the `other` slot's time lies and how the shadow and shader slots divide
// between the mirror and the render. An event is then IN (inside the window whatever those are), MAYBE or OUT, and the
// table says which.
//
//   node tools/slot_frames.js <flightlog.json[.gz]> [--slot mirror] [--min 8] [--over 50] [--target mirror] [--context world] [--top 15] [--json]
//        [--from S --to S]   a stretch of the flight (s since the reveal) against the rest: the slot's ms, the frame's draws
// With the laps census (one frame in 256, or ?reclaps=N) it also prints the slot over time: its own ms, draw calls and triangles.
'use strict';
const path = require('path');
const AL = require(path.join(__dirname, 'analyze_log.js')), PR = require(path.join(__dirname, 'program_report.js')), FL = require(path.join(__dirname, 'freeze_ledger.js'));
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10;
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const ORDER = ['other', 'world', 'scene', 'hud', 'mirror', 'render'];               // the loop's laps, in order (app.js); a last `other` closes the frame
const NEST = { other: ['script', 'solver'], world: ['prem', 'cover', 'fill'] };     // pushed inside a lap; shadow and shader are pushed inside mirror AND render

function slotFrames(log, opt) {
  const o = opt || {}, slot = o.slot || 'mirror', MIN = o.min != null ? +o.min : 8, OVER = o.over != null ? +o.over : 50, CTX = o.context || 'world';
  const H = log.header || {}, SL = H.slots || [], rows = AL.frames(log);
  if (SL.indexOf(slot) < 0) throw new Error('no slot "' + slot + '" in this log (' + SL.join(', ') + ')');
  const events = (log.events || []).map(e => ({ t: e[0], kind: e[1], ms: e[2], d: e[3] })).sort((a, b) => a.t - b.t);
  const progs = PR.programs(log), byN = new Map(progs.map(p => [p.n, p]));
  const who = p => !p ? 'a program the log does not name' : (p.own && p.own.length ? p.own.join(' + ') : 'UNOWNED ' + ((p.mat && p.mat[0]) || p.name || p.type || ''));
  const reveal = (events.find(e => e.kind === 'reveal') || {}).t;
  for (const r of rows) r.ctx = FL.contextOf(r);
  const usual = rows.filter(r => r.ctx === CTX && r.dt === r.dt && r.dt <= 35);
  const med = {}; for (const k of SL.concat(['work', 'calls', 'tris', 'gpu'])) med[k] = median(usual.map(r => r[k]).filter(x => x === x));
  // the laps of the long frames (PERF-TRACE 6), by the frame's start
  // (the long frames' events, and the census' rows of the log's `laps` table: [work, then the laps] - the same shape once the work is taken off)
  const laps = events.filter(e => e.kind === 'laps' && Array.isArray(e.d)).concat(((log.laps && log.laps.long) || []).concat((log.laps && log.laps.rows) || []).filter(a => a.length >= 15).map(a => ({ t: a[2], kind: 'laps', ms: a[0], d: a.slice(1) }))).sort((a, b) => a.t - b.t);
  const lapOf = (p) => { let lo = 0, hi = laps.length - 1, best = null; while (lo <= hi) { const m = (lo + hi) >> 1; if (laps[m].t < p.t - 0.5) lo = m + 1; else { best = laps[m]; hi = m - 1; } } return best && best.t - p.t < Math.max(8, p.work || 0) ? best : null; };
  // a lap event's window of the slot: [slot, t, GPU ms, GPU calls, updated KB, draw calls, triangles] x n, each lap's numbers the frame's totals so far
  const lapWin = a => { for (let k = 7; k + 6 < a.length; k += 7) if (SL[a[k]] === slot) return { t0: a[k - 6], t1: a[k + 1], ms: r1(a[k + 2] - a[k - 5]), calls: a[k + 3] - a[k - 4], updateKB: a[k + 4] - a[k - 3], draws: a[k + 5] - a[k - 2], tris: a[k + 6] - a[k - 1] }; return null; };
  const evIn = (a, b) => { let lo = 0, hi = events.length; while (lo < hi) { const m = (lo + hi) >> 1; if (events[m].t < a - 3000) lo = m + 1; else hi = m; } const out = []; for (let i = lo; i < events.length && events[i].t < b; i++) { const e = events[i]; if (e.t + (e.ms || 0) > a) out.push(e); } return out; };

  const sel = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const p = rows[i], n = rows[i + 1]; if (p.ctx !== CTX || !(p[slot] - med[slot] >= MIN)) continue;
    const work = p.work === p.work ? p.work : 0, excess = p[slot] - med[slot];
    // the frame's own start on the events' clock: the lap event's, else its end (a 'gpuup' of the loop is stamped there) less its work, else rAF's timestamp
    const L = lapOf(p), E0 = evIn(p.t - 1, p.t + work + 40), gu = E0.find(e => e.kind === 'gpuup' && e.d && e.d.at === 'loop' && e.t >= p.t + work - 2 && e.t <= p.t + work + 40);
    const begin = L ? L.t : gu ? gu.t - work : p.t, beginBy = L ? 'laps' : gu ? 'end' : 'rAF';
    let win, core, exact = false, up = null;
    if (L) { const w = lapWin(L.d); if (w) { win = core = [w.t0, w.t1]; exact = true; up = w; } }
    if (!win) {
      let before = 0; for (const s of ORDER) { if (s === slot) break; if (s === 'other') continue; before += (p[s] || 0); for (const x of (NEST[s] || [])) before += (p[x] || 0); }
      for (const x of NEST.other) before += (p[x] || 0);
      const shared = (slot === 'mirror' || slot === 'render') ? (p.shadow || 0) + (p.shader || 0) : 0, own = (p[slot] || 0) + (NEST[slot] || []).reduce((a, x) => a + (p[x] || 0), 0);
      const U0 = (p.other || 0) + (slot === 'render' ? (p.shadow || 0) + (p.shader || 0) : 0), A = begin + before;
      win = [A, A + U0 + own + shared]; core = A + U0 < A + own ? [A + U0, A + own] : null;
    }
    const where = e => { const a = e.kind === 'proguse' ? e.t - (e.ms || 0) : e.t, b = e.kind === 'proguse' ? e.t : e.t + (e.ms || 0), mid = (a + b) / 2;
      if (core && mid >= core[0] - 0.05 && mid <= core[1] + 0.05) return 'in'; return mid >= win[0] - 0.05 && mid <= win[1] + 0.05 ? (exact ? 'in' : 'maybe') : 'out'; };
    const E = evIn(begin - 0.5, begin + work + 0.5);
    const uses = E.filter(e => e.kind === 'proguse').map(e => { const pr = byN.get(e.d); return { n: e.d, owner: who(pr), ms: e.ms == null ? null : r1(e.ms), rt: pr ? pr.rt : null, linked: !pr || reveal == null ? '?' : pr.t < reveal ? 'load' : 'flight',
      linkedAgoS: pr ? r1((e.t - pr.t) / 1000) : null, where: where(e) }; });
    const links = E.filter(e => e.kind === 'link').map(e => ({ n: e.d, owner: who(byN.get(e.d)), ms: r1(e.ms), where: where(e) }));
    const waits = E.filter(e => e.kind === 'linkwait').map(e => ({ n: e.d, owner: who(byN.get(e.d)), ms: r1(e.ms), where: where(e) }));
    const deliv = E.filter(e => e.kind === 'deliver' && e.d).map(e => ({ streamer: e.d.s || '?', n: e.d.n == null ? null : e.d.n, ms: r1(e.ms), where: where(e), plantMs: e.d.plantMs || 0, blocks: e.d.blocks || 0, blockMs: e.d.blockMs || 0, kb: e.d.kb || 0 }));
    const prem = E.filter(e => e.kind === 'premslow' && e.d).length;
    const g = gu && gu.d ? { ms: r1(gu.ms), textures: (gu.d.tex || [])[0] || 0, megapixels: (gu.d.tex || [])[2] || 0, buffers: (gu.d.buf || [])[0] || 0, bufferKB: (gu.d.buf || [])[2] || 0, updates: (gu.d.sub || [])[0] || 0, updateKB: (gu.d.sub || [])[1] || 0,
      mipmaps: (gu.d.mip || [])[0] || 0, mipmapMs: (gu.d.mip || [])[1] || 0, newTextures: gu.d.texNew || 0, newGeometries: gu.d.geo || 0 } : null;
    const inside = x => x.filter(y => y.where !== 'out');
    sel.push({ i, t: r1(p.t), s: reveal != null ? r1((p.t - reveal) / 1000) : null, nextDt: r1(n.dt), work: r1(work), slotMs: r1(p[slot]), excess: r1(excess), exact, beginBy,
      calls: p.calls === p.calls ? p.calls : null, tris: p.tris === p.tris ? p.tris : null, gpuMs: p.gpu === p.gpu ? r1(p.gpu) : null, agl: p.agl === p.agl ? Math.round(p.agl) : null, spd: p.spd === p.spd ? Math.round(p.spd) : null,
      uses, links, waits, deliveries: deliv, premises: prem, gpuData: g, slotUploads: up,
      quiet: !inside(uses).length && !inside(links).length && !inside(waits).length && !inside(deliv).length && !(up ? up.ms >= 1 : g && g.ms >= 1) });
  }
  // ---- the sums --------------------------------------------------------------------------------------------------
  const sum = (a, f) => a.reduce((x, y) => x + (f(y) || 0), 0), cnt = (a, f) => a.filter(f).length;
  const long = sel.filter(f => f.nextDt > OVER), fz = sel.filter(f => f.nextDt > 100);
  const group = (items, key, add) => { const m = new Map(); for (const it of items) { const k = key(it); let g = m.get(k); if (!g) m.set(k, g = { key: k, n: 0, ms: 0, in: 0, maybe: 0 }); g.n++; g.ms += it.ms || 0; g[it.where === 'in' ? 'in' : 'maybe']++; if (add) add(g, it); } return [...m.values()].sort((a, b) => b.ms - a.ms || b.n - a.n).map(g => Object.assign(g, { ms: r1(g.ms) })); };
  const allUses = [].concat(...sel.map(f => f.uses.filter(u => u.where !== 'out'))), allLinks = [].concat(...sel.map(f => f.links.filter(u => u.where !== 'out'))),
    allWaits = [].concat(...sel.map(f => f.waits.filter(u => u.where !== 'out'))), allDel = [].concat(...sel.map(f => f.deliveries.filter(u => u.where !== 'out')));
  const G = sel.filter(f => f.gpuData);
  const quiet = sel.filter(f => f.quiet);
  // ---- the programs by the target they were keyed for ----------------------------------------------------------------
  const byRt = new Map();
  for (const p of progs) { if (!p.three) continue; const k = String(p.rt || '?');
    let g = byRt.get(k); if (!g) byRt.set(k, g = { target: k, programs: 0, kb: 0, linkedLoad: 0, linkedFlight: 0, usedLoad: 0, usedFlight: 0, never: 0, firstUseMsFlight: 0 });
    g.programs++; g.kb += p.vs != null ? (p.vs + p.fs) / 1024 : 0;
    if (reveal != null && p.t >= reveal) g.linkedFlight++; else g.linkedLoad++;
    if (p.useT == null) g.never++; else if (reveal != null && p.useT >= reveal) { g.usedFlight++; g.firstUseMsFlight += p.firstUseMs || 0; } else g.usedLoad++; }
  const targets = [...byRt.values()].map(g => Object.assign(g, { kb: Math.round(g.kb), firstUseMsFlight: Math.round(g.firstUseMsFlight) })).sort((a, b) => b.programs - a.programs);
  const TG = o.target ? new RegExp(o.target, 'i') : new RegExp(slot, 'i');
  const tprogs = progs.filter(p => p.three && TG.test(String(p.rt || ''))).map(p => ({ n: p.n, owner: who(p), rt: p.rt, linked: reveal == null ? '?' : p.t < reveal ? 'load' : 'flight', linkedS: reveal != null ? r1((p.t - reveal) / 1000) : r1(p.t / 1000),
    firstUsed: p.useT == null ? 'never' : reveal != null && p.useT >= reveal ? 'flight' : 'load', firstUsedS: p.useT == null ? null : reveal != null ? r1((p.useT - reveal) / 1000) : r1(p.useT / 1000), firstUseMs: r1(p.firstUseMs), kb: p.vs != null ? Math.round((p.vs + p.fs) / 1024) : null }));
  // (every first use of the flight, whatever the frame: where the first uses of the run went, by the lap they fell in - exact frames only)
  const flightUses = progs.filter(p => p.useT != null && reveal != null && p.useT >= reveal);
  // THE SLOT OVER TIME, from every lap event (the long frames and the one-in-N census): its own ms, draw calls and triangles, in 30 s bins since the reveal
  const series = []; { const bins = new Map();
    for (const e of laps) { const w = lapWin(e.d); if (!w || reveal == null || e.t < reveal) continue; const b = Math.floor((e.t - reveal) / 30000); let g = bins.get(b); if (!g) bins.set(b, g = { ms: [], draws: [], tris: [], long: 0 }); if (e.ms >= 50) { g.long++; continue; } g.ms.push(w.t1 - w.t0); g.draws.push(w.draws); g.tris.push(w.tris); }
    for (const [b, g] of [...bins].sort((x, y) => x[0] - y[0])) series.push({ fromS: b * 30, samples: g.ms.length, longFrames: g.long, slotMs: r1(median(g.ms)), draws: median(g.draws), tris: median(g.tris) }); }
  // A STRETCH OF THE FLIGHT against the rest (--from / --to, s since the reveal): the slot's ms and the FRAME's draws (a log without laps has no per-pass draws)
  let stretch = null;
  if (o.from != null && o.to != null && reveal != null) { const a = reveal + 1000 * o.from, b = reveal + 1000 * o.to, pct = (v, q) => { const s = v.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };
    const st = R0 => { const v = k => R0.map(r => r[k]).filter(x => x === x); return { frames: R0.length, slotMs: r1(median(v(slot))), slotP90: r1(pct(v(slot), 0.9)), workMs: r1(median(v('work'))), calls: median(v('calls')), tris: median(v('tris')), gpuMs: r1(median(v('gpu'))), agl: Math.round(median(v('agl'))), spd: Math.round(median(v('spd'))) }; };
    const C0 = rows.filter(r => r.ctx === CTX && r.t >= reveal); stretch = { fromS: +o.from, toS: +o.to, inside: st(C0.filter(r => r.t >= a && r.t < b)), outside: st(C0.filter(r => r.t < a || r.t >= b)) }; }
  return { kind: 'flydiy-slot-frames', v: 1, slot, context: CTX, min: MIN, over: OVER, series, stretch, build: H.build || null, frames: rows.length, contextFrames: rows.filter(r => r.ctx === CTX).length,
    usual: { slotMs: r1(med[slot]), workMs: r1(med.work), calls: med.calls, tris: med.tris, gpuMs: r1(med.gpu) }, hasLaps: laps.length > 0, exactFrames: cnt(sel, f => f.exact),
    selected: { frames: sel.length, excessMs: Math.round(sum(sel, f => f.excess)), followedByOver: long.length, followedByFreeze: fz.length, worstMs: sel.length ? Math.max(...sel.map(f => f.slotMs)) : 0,
      calls: median(sel.map(f => f.calls).filter(x => x != null)), tris: median(sel.map(f => f.tris).filter(x => x != null)), gpuMs: r1(median(sel.map(f => f.gpuMs).filter(x => x != null))) },
    firstUses: { frames: cnt(sel, f => f.uses.some(u => u.where !== 'out')), programs: allUses.length, ms: Math.round(sum(allUses, u => u.ms)), in: cnt(allUses, u => u.where === 'in'), maybe: cnt(allUses, u => u.where === 'maybe'),
      byOwner: group(allUses, u => u.owner + '  [keyed for ' + (u.rt || '?') + ', linked in the ' + u.linked + ']').slice(0, 25), excessOfThoseFrames: Math.round(sum(sel.filter(f => f.uses.some(u => u.where !== 'out')), f => f.excess)) },
    links: { frames: cnt(sel, f => f.links.some(u => u.where !== 'out')), n: allLinks.length, ms: Math.round(sum(allLinks, u => u.ms)), byOwner: group(allLinks, u => u.owner).slice(0, 12) },
    waits: { frames: cnt(sel, f => f.waits.some(u => u.where !== 'out')), n: allWaits.length, ms: Math.round(sum(allWaits, u => u.ms)), byOwner: group(allWaits, u => u.owner).slice(0, 12) },
    deliveries: { frames: cnt(sel, f => f.deliveries.some(u => u.where !== 'out')), n: allDel.length, byStreamer: group(allDel, u => u.streamer, (g, u) => { g.items = (g.items || 0) + (u.n || 0); g.plantMs = (g.plantMs || 0) + u.plantMs; g.blocks = (g.blocks || 0) + u.blocks; g.blockMs = (g.blockMs || 0) + u.blockMs; g.kb = (g.kb || 0) + u.kb; }).slice(0, 12) },
    gpuData: { frames: G.length, ms: Math.round(sum(G, f => f.gpuData.ms)), textures: sum(G, f => f.gpuData.textures), megapixels: Math.round(sum(G, f => f.gpuData.megapixels)), buffers: sum(G, f => f.gpuData.buffers), bufferMB: Math.round(sum(G, f => f.gpuData.bufferKB) / 1024),
      mipmaps: sum(G, f => f.gpuData.mipmaps), mipmapMs: Math.round(sum(G, f => f.gpuData.mipmapMs)), newTextures: sum(G, f => f.gpuData.newTextures), newGeometries: sum(G, f => f.gpuData.newGeometries),
      excessOfThoseFrames: Math.round(sum(G, f => f.excess)), inTheSlot: sel.some(f => f.slotUploads) ? { frames: cnt(sel, f => f.slotUploads && f.slotUploads.ms >= 1), ms: Math.round(sum(sel, f => f.slotUploads ? f.slotUploads.ms : 0)), calls: sum(sel, f => f.slotUploads ? f.slotUploads.calls : 0) } : null },
    quiet: { frames: quiet.length, excessMs: Math.round(sum(quiet, f => f.excess)), calls: median(quiet.map(f => f.calls).filter(x => x != null)), tris: median(quiet.map(f => f.tris).filter(x => x != null)), gpuMs: r1(median(quiet.map(f => f.gpuMs).filter(x => x != null))) },
    premisesFrames: cnt(sel, f => f.premises > 0), targets, targetPrograms: tprogs, flightFirstUses: { programs: flightUses.length, ms: Math.round(sum(flightUses, p => p.firstUseMs)) },
    worst: sel.slice().sort((a, b) => b.excess - a.excess).slice(0, o.top || 15) };
}

function text(R) {
  const L = [], lp = (s, n) => String(s == null ? '-' : s).padStart(n), S = R.selected;
  L.push('INSIDE THE "' + R.slot.toUpperCase() + '" SLOT  build ' + (R.build || '?') + '  (' + R.context + ': ' + R.contextFrames + ' frames; the slot usually takes ' + R.usual.slotMs + ' ms of a ' + R.usual.workMs + ' ms loop)');
  L.push('  ' + S.frames + ' frames ran it ' + R.min + ' ms or more over that: ' + S.excessMs + ' ms of excess in all, the worst ' + S.worstMs + ' ms; ' + S.followedByOver + ' were followed by an interval over ' + R.over + ' ms, ' + S.followedByFreeze + ' by one over 100 ms');
  L.push('  WHERE THE SLOT IS IN THE FRAME: ' + (R.exactFrames ? R.exactFrames + ' of them have their laps logged (exact)' : 'this log has no lap times (a build before PERF-TRACE 6)') + (R.exactFrames < S.frames ? '; the others are placed by the loop\'s order - an event is IN the slot whatever the unknowns, or MAYBE' : ''));
  L.push('  THE DRAWS OF THOSE FRAMES: ' + S.calls + ' draw calls, ' + S.tris + ' triangles, GPU ' + S.gpuMs + ' ms (median) against the usual ' + R.usual.calls + ' / ' + R.usual.tris + ' / ' + R.usual.gpuMs + ' ms');
  const pct = x => S.excessMs ? Math.round(100 * x / S.excessMs) + ' %' : '-';
  L.push(''); L.push('WHAT THE EVENTS SAY HAPPENED INSIDE IT');
  const U = R.firstUses;
  L.push('  PROGRAMS FIRST USED: ' + U.programs + ' in ' + U.frames + ' of the ' + S.frames + ' frames (' + U.in + ' in, ' + U.maybe + ' maybe), ' + U.ms + ' ms of first use; those frames hold ' + U.excessOfThoseFrames + ' ms of the slot\'s excess (' + pct(U.excessOfThoseFrames) + ')');
  if (U.byOwner.length) { L.push('  ' + lp('progs', 7) + lp('ms', 8) + lp('in', 5) + lp('maybe', 6) + '  owner  [the target it was keyed for, linked in the load or in flight]'); for (const g of U.byOwner) L.push('  ' + lp(g.n, 7) + lp(g.ms, 8) + lp(g.in, 5) + lp(g.maybe, 6) + '  ' + g.key); }
  L.push('  LINKS SUBMITTED: ' + R.links.n + ' in ' + R.links.frames + ' frames, ' + R.links.ms + ' ms of link calls' + (R.links.byOwner.length ? ': ' + R.links.byOwner.slice(0, 5).map(g => g.n + ' ' + g.key).join('; ') : ''));
  L.push('  DRAWS HELD ON A LINK: ' + R.waits.n + ' in ' + R.waits.frames + ' frames, ' + R.waits.ms + ' ms (that time is the shader slot\'s, not this one\'s)' + (R.waits.byOwner.length ? ': ' + R.waits.byOwner.slice(0, 5).map(g => g.ms + ' ms ' + g.key).join('; ') : ''));
  L.push('  STREAMER DELIVERIES: ' + R.deliveries.n + ' in ' + R.deliveries.frames + ' frames' + (R.deliveries.byStreamer.length ? ': ' + R.deliveries.byStreamer.map(g => g.n + ' ' + g.key).join(', ') : ' (no streamer says what it delivered in this log)') + '; premises built in ' + R.premisesFrames + ' frames');
  // (a streamer that says what its time was made of - cover_ring.js update(): the cells planted, the blocks rebuilt - gets its split)
  if (R.deliveries.byStreamer.some(g => g.plantMs || g.blockMs || g.kb)) { L.push('  ' + lp('reports', 9) + lp('ms', 9) + lp('items', 8) + lp('plant ms', 10) + lp('blocks', 8) + lp('block ms', 10) + lp('rest ms', 9) + lp('KB', 9) + '  streamer (rest = its ms less the planting and the block rebuilds)');
    for (const g of R.deliveries.byStreamer) L.push('  ' + lp(g.n, 9) + lp(g.ms, 9) + lp(g.items, 8) + lp(r1(g.plantMs), 10) + lp(g.blocks, 8) + lp(r1(g.blockMs), 10) + lp(r1(g.ms - (g.plantMs || 0) - (g.blockMs || 0)), 9) + lp(g.kb || 0, 9) + '  ' + g.key); }
  const G = R.gpuData;
  L.push('  NEW GPU DATA (the WHOLE frame' + (G.inTheSlot ? '; in the slot itself, from the laps: ' + G.inTheSlot.ms + ' ms in ' + G.inTheSlot.frames + ' frames, ' + G.inTheSlot.calls + ' calls' : ': the log cannot split it between the passes') + '): ' + G.frames + ' frames made 1 ms or more of it, ' + G.ms + ' ms in all: ' +
    G.textures + ' texture calls (' + G.megapixels + ' MP), ' + G.buffers + ' buffers (' + G.bufferMB + ' MB), ' + G.mipmaps + ' mipmap builds (' + G.mipmapMs + ' ms), +' + G.newTextures + ' textures, +' + G.newGeometries + ' geometries; those frames hold ' + G.excessOfThoseFrames + ' ms of the excess (' + pct(G.excessOfThoseFrames) + ')');
  L.push('  NOTHING RECORDED INSIDE: ' + R.quiet.frames + ' frames, ' + R.quiet.excessMs + ' ms of the excess (' + pct(R.quiet.excessMs) + '); their draws: ' + R.quiet.calls + ' calls, ' + R.quiet.tris + ' triangles, GPU ' + R.quiet.gpuMs + ' ms  <- the draws themselves, or what no event covers');
  L.push(''); L.push('THE PROGRAMS BY THE TARGET THEY WERE KEYED FOR (linked / first used: during the load, or in flight after the reveal)');
  L.push('  ' + lp('progs', 7) + lp('KB', 8) + lp('linked:load', 13) + lp('flight', 8) + lp('used:load', 11) + lp('flight', 8) + lp('never', 7) + lp('1st-use ms in flight', 22) + '  target');
  for (const g of R.targets) L.push('  ' + lp(g.programs, 7) + lp(g.kb, 8) + lp(g.linkedLoad, 13) + lp(g.linkedFlight, 8) + lp(g.usedLoad, 11) + lp(g.usedFlight, 8) + lp(g.never, 7) + lp(g.firstUseMsFlight, 22) + '  ' + g.target);
  L.push('  (all the first uses of the flight: ' + R.flightFirstUses.programs + ' programs, ' + R.flightFirstUses.ms + ' ms)');
  if (R.targetPrograms.length) { L.push('  THE PROGRAMS KEYED FOR THE SLOT\'S OWN TARGET (' + R.targetPrograms.length + ')'); L.push('  ' + lp('#', 6) + lp('KB', 6) + lp('linked', 8) + lp('at s', 9) + lp('1st used', 10) + lp('at s', 9) + lp('ms', 8) + '  owner');
    for (const p of R.targetPrograms.slice(0, 60)) L.push('  ' + lp(p.n, 6) + lp(p.kb, 6) + lp(p.linked, 8) + lp(p.linkedS, 9) + lp(p.firstUsed, 10) + lp(p.firstUsedS, 9) + lp(p.firstUseMs, 8) + '  ' + p.owner + '  [' + p.rt + ']'); }
  else L.push('  NO PROGRAM is keyed for a target named like the slot (' + R.slot + '): either its pass keys no program of its own - it draws with the programs of another target of the same output - or its target has no name in this build (water.js names it from PERF-TRACE 6: "water mirror")');
  if (R.stretch) { const A = R.stretch.inside, B = R.stretch.outside, row = (n, x) => '  ' + n.padEnd(22) + lp(x.frames, 8) + lp(x.slotMs, 9) + lp(x.slotP90, 8) + lp(x.workMs, 8) + lp(x.calls, 8) + lp(x.tris, 10) + lp(x.gpuMs, 8) + lp(x.agl, 7) + lp(x.spd, 6);
    L.push(''); L.push('THE STRETCH ' + R.stretch.fromS + ' .. ' + R.stretch.toS + ' s AGAINST THE REST OF THE FLIGHT (medians; the draw calls and triangles are the WHOLE frame\'s: every render of it summed)');
    L.push('  ' + ''.padEnd(22) + lp('frames', 8) + lp('slot ms', 9) + lp('p90', 8) + lp('work', 8) + lp('draws', 8) + lp('tris', 10) + lp('GPU ms', 8) + lp('agl m', 7) + lp('m/s', 6)); L.push(row('inside the stretch', A)); L.push(row('the rest', B)); }
  if (R.series && R.series.some(s => s.samples)) { L.push(''); L.push('THE SLOT OVER TIME, from the laps census (30 s bins since the reveal: the slot\'s OWN ms, draw calls and triangles; long = frames of 50 ms or more, left out of the medians)');
    L.push('  ' + lp('from s', 8) + lp('samples', 9) + lp('long', 6) + lp('slot ms', 9) + lp('draws', 8) + lp('tris', 10)); for (const s of R.series) L.push('  ' + lp(s.fromS, 8) + lp(s.samples, 9) + lp(s.longFrames, 6) + lp(s.slotMs, 9) + lp(s.draws, 8) + lp(s.tris, 10)); }
  L.push(''); L.push('THE ' + R.worst.length + ' WORST (s since the reveal; next = the interval that followed)');
  L.push('  ' + lp('s', 9) + lp('slot ms', 9) + lp('work', 7) + lp('next', 7) + lp('draws', 7) + lp('GPU ms', 8) + lp('agl', 6) + '  inside');
  for (const f of R.worst) { const bits = [];
    const us = f.uses.filter(u => u.where !== 'out'); if (us.length) bits.push('first use: ' + us.slice(0, 3).map(u => u.owner + ' ' + u.ms + ' ms' + (u.where === 'maybe' ? ' (maybe)' : '')).join(', ') + (us.length > 3 ? ' +' + (us.length - 3) : ''));
    const ls = f.links.filter(u => u.where !== 'out'); if (ls.length) bits.push(ls.length + ' links (' + ls[0].owner + ')');
    const ws = f.waits.filter(u => u.where !== 'out'); if (ws.length) bits.push('held ' + r1(ws.reduce((a, w) => a + (w.ms || 0), 0)) + ' ms on ' + ws[0].owner);
    if (f.deliveries.length) bits.push('delivered: ' + f.deliveries.map(d => d.streamer).join(', '));
    if (f.slotUploads && f.slotUploads.ms >= 1) bits.push('GPU data in the slot ' + f.slotUploads.ms + ' ms, ' + f.slotUploads.calls + ' calls');
    else if (f.gpuData) bits.push('GPU data in the frame ' + f.gpuData.ms + ' ms (' + f.gpuData.textures + ' tex ' + f.gpuData.megapixels + ' MP, ' + f.gpuData.buffers + ' buf, ' + f.gpuData.mipmaps + ' mip ' + f.gpuData.mipmapMs + ' ms, +' + f.gpuData.newTextures + ' tex)');
    if (f.premises) bits.push('premises built');
    L.push('  ' + lp(f.s, 9) + lp(f.slotMs, 9) + lp(f.work, 7) + lp(f.nextDt, 7) + lp(f.calls, 7) + lp(f.gpuMs, 8) + lp(f.agl, 6) + '  ' + (bits.join('; ') || 'nothing recorded')); }
  return L.join('\n');
}
module.exports = { slotFrames, text };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--slot', '--min', '--over', '--target', '--context', '--top', '--from', '--to'].includes(argv[i - 1])));
  if (!file) { console.error('usage: node tools/slot_frames.js <flightlog.json[.gz]> [--slot mirror] [--min 8] [--over 50] [--target mirror] [--context world] [--top 15] [--json]'); process.exit(2); }
  const R = slotFrames(AL.load(file), { slot: opt('slot', 'mirror'), min: opt('min', 8), over: opt('over', 50), target: opt('target', null), context: opt('context', 'world'), top: +opt('top', 15), from: opt('from', null), to: opt('to', null) });
  console.log(argv.includes('--json') ? JSON.stringify(R) : text(R));
}
