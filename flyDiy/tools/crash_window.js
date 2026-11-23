#!/usr/bin/env node
// crash_window.js - THE SECONDS AFTER A CRASH: what froze, what linked, what was drawn for the first time, what drew nothing
// (PERF-TRACE, 22 Nov 2026; the user's official row 14: "less than 250 ms freeze on crash, and no sky blue screen (failed
// render frame) during those" - "a crash could cause up to 10 seconds of full freeze, getting full blue renders")
//
// From one saved flight log, the window from `--before` s ahead of the impact to `--after` s past it:
//   ROW 14          the frames after the impact: the worst, how many over 100 and 250 ms, the time spent over 250 ms
//   THE FRAMES      the longest ones: when, the slots over their usual cost, the draws, and what the events put inside
//                   (links, draws held on a link, first uses, new GPU data, deliveries, the draw guard's holds, errors)
//   LINKED AFTER    every program SUBMITTED after the impact, by what it is (the scuff's wake, a cut copy, the member
//                   pool, the wreck, the ground scar, dust ... by its owner) with its link call, its pending time, the ms
//                   a draw was held on it and its first use - and, for each, THE PROGRAM OF THE SAME OWNER LINKED BEFORE
//                   THE IMPACT THAT IS NEAREST TO IT and the defines that differ: a prelink that keyed a twin "almost"
//                   (another light count, a missing DMG_ switch) shows there
//   FIRST USED      programs linked BEFORE the impact and drawn for the first time after it: the first use's ms
//   NOT THREE'S     links with no three.js program (raw GL: SKIN_GPU's riding program)
//   THE BLUE FRAME  frames that drew few calls (the recorder's fewDraws flag from PERF-TRACE 7; before it: under a
//                   quarter of the calls usual before the impact), the draw guard's holds ('guardhold': draws kept out
//                   because their material had no program yet), errors and lost contexts
// THE IMPACT: the recorder's 'crash' event (PERF-TRACE 7: the first broken member); in an older log `--at S` (s since the
// reveal) or, failing both, the speed's collapse near the ground - and the header says which.
//
//   node tools/crash_window.js <flightlog.json[.gz]> [--at S | --mark name] [--before 3] [--after 20] [--top 14] [--stills-recorded] [--json]
//   (--mark: the flight script's own mark, 'seg:<name>'; the marks of a log are printed with every run)
'use strict';
const path = require('path');
const AL = require(path.join(__dirname, 'analyze_log.js')), PR = require(path.join(__dirname, 'program_report.js')), FL = require(path.join(__dirname, 'freeze_ledger.js'));
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10;
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
// what a program is at a crash, by its owner (the labels of src/viewer: aeroskin's '+ scuff' / '+ cutaway', dmg_members, ground_scar, dust ...)
const KINDS = [['the scuff\'s wake (a skin\'s scuff twin)', /\+ scuff/], ['a cut copy (see-through / cutaway twin)', /\+ cut|cutaway|cut copy/i], ['the damage members\' pool', /damage members|dmglook/i],
  ['the wreck (debris, wires, scraps)', /wreck|debris|scrap|wires/i], ['the ground scar', /ground scar/i], ['dust, clods, spray, smoke', /dust|clod|spray|puff|smoke|plume/i], ['the shadow pass (a depth twin)', /^shadow pass/], ['the aircraft\'s skin (not a twin)', /aircraft \/ skin/]];
const kindOf = w => { for (const [k, re] of KINDS) if (re.test(w)) return k; return 'other'; };

function crashWindow(log, opt) {
  const o = opt || {}, BEFORE = 1000 * (o.before != null ? +o.before : 3), AFTER = 1000 * (o.after != null ? +o.after : 20);
  const H = log.header || {}, SL = H.slots || [], FLAGS = H.flags || {}, rows = AL.frames(log);
  const events = (log.events || []).map(e => ({ t: e[0], kind: e[1], ms: e[2], d: e[3] })).sort((a, b) => a.t - b.t);
  const progs = PR.programs(log); PR.shares(progs); const byN = new Map(progs.map(p => [p.n, p]));
  const who = p => !p ? 'a program the log does not name' : (p.own && p.own.length ? p.own.join(' + ') : 'UNOWNED ' + ((p.mat && p.mat[0]) || p.name || p.type || ''));
  const reveals = events.filter(e => e.kind === 'reveal').map(e => e.t), reveal = reveals.length ? reveals[reveals.length - 1] : (rows.length ? rows[0].t : 0);
  for (const r of rows) r.ctx = FL.contextOf(r);
  // ---- the impact ---------------------------------------------------------------------------------------------------
  let T = null, by = null;
  const ce = events.filter(e => e.kind === 'crash' && e.d && e.d.k === 'impact');
  if (o.at != null) { T = reveal + 1000 * +o.at; by = '--at ' + o.at + ' s after the reveal'; }
  else if (ce.length) { T = ce[ce.length - 1].t; by = 'the recorder\'s crash event (the first broken member: ' + ce[ce.length - 1].d.breaks + ' broken, ' + ce[ce.length - 1].d.spd + ' m/s)'; }
  // (the rest: from a MARK of the flight script. PERF-LEAD's crash scenarios - crash_cub_nosedown.json - push the stick forward at the step
  //  "the nose down, into the ground"; the impact is the first frame AFTER that mark where the aeroplane is under 1 m above the ground or its
  //  3-D speed collapses, whichever comes first. --mark names another step; with no --mark a mark that reads like one is taken.)
  const v3 = r => Math.hypot(r.spd === r.spd ? r.spd : 0, r.vs === r.vs ? r.vs : 0);
  const collapseFrom = (W, i0) => { for (let i = Math.max(i0, 15); i < W.length; i++) { const va = v3(W[i - 15]), vb = v3(W[i]); if (W[i].agl < 1) return { k: i, how: 'under 1 m above the ground (AGL ' + r1(W[i].agl) + ' m, ' + r1(vb) + ' m/s)' };
      if (va >= 6 && vb <= 0.5 * va && W[i].agl < 8) { let k = i - 15, steep = 0; for (let j = i - 15; j < i; j++) { const d = v3(W[j]) - v3(W[j + 1]); if (d > steep) { steep = d; k = j + 1; } } return { k, how: 'the 3-D speed collapsing (' + r1(va) + ' -> ' + r1(vb) + ' m/s in half a second, AGL ' + r1(W[k].agl) + ' m)' }; } } return null; };
  if (T == null && o.at == null) {
    const W = rows.filter(r => r.ctx === 'world' && r.t >= reveal), MK = events.filter(e => e.kind === 'mark' && typeof e.d === 'string');
    const want = o.mark ? String(o.mark).replace(/^seg:/, '') : null;
    const mk = want ? MK.filter(e => e.d.replace(/^seg:/, '') === want).pop() : MK.filter(e => /nose down|into the ground|crash|impact/i.test(e.d)).pop();
    if (mk) { const i0 = W.findIndex(r => r.t >= mk.t), hit = i0 >= 0 ? collapseFrom(W, i0) : null;
      if (hit) { T = W[hit.k].t; by = 'the script\'s mark "' + mk.d.replace(/^seg:/, '') + '", then ' + hit.how + ', ' + r1((T - mk.t) / 1000) + ' s after the mark' + (ce.length ? '' : ' - no crash event in this log'); }
      else if (want) { T = mk.t; by = 'the script\'s mark "' + want + '" itself (no touch-down or collapse of the speed found after it)'; } }
    else if (want) by = null;
    if (T == null && !want) { // no mark: the largest collapse of the 3-D speed near the ground in the whole flight - a guess, and it says so
      let best = 0, bi = -1; for (let i = 15; i < W.length; i++) { const va = v3(W[i - 15]), vb = v3(W[i]); if (!(va >= 6) || !(vb <= 0.5 * va) || !(W[i].agl < 8)) continue; if (va - vb > best) { best = va - vb; bi = i; } }
      if (bi >= 0) { let k = bi - 15, steep = 0; for (let j = bi - 15; j < bi; j++) { const d = v3(W[j]) - v3(W[j + 1]); if (d > steep) { steep = d; k = j + 1; } } T = W[k].t;
        by = 'the 3-D speed\'s largest collapse (' + r1(v3(W[bi - 15])) + ' -> ' + r1(v3(W[bi])) + ' m/s in half a second, AGL ' + r1(W[k].agl) + ' m) - NO crash event and no mark in this log: a guess'; } }
  }
  const marksAll = events.filter(e => e.kind === 'mark' && typeof e.d === 'string').map(e => ({ s: r1((e.t - reveal) / 1000), mark: e.d }));
  if (T == null) return { kind: 'flydiy-crash-window', v: 1, build: H.build || null, impact: null, marks: marksAll, why: 'no crash event, no --at, no --mark found, and no collapse of the speed near the ground in this log' };
  const A = T - BEFORE, Z = T + AFTER, s = t => r1((t - T) / 1000);
  const rest = events.find(e => e.kind === 'crash' && e.d && e.d.k === 'rest' && e.t >= T);
  // ---- the frames: row i's work is drawn in the interval that ends at row i + 1 ----------------------------------------
  const pre = rows.filter(r => r.ctx === 'world' && r.t >= T - 20000 && r.t < T), med = {};
  for (const k of SL.concat(['work', 'calls', 'tris', 'gpu'])) med[k] = median(pre.map(r => r[k]).filter(x => x === x));
  const fewBit = FLAGS.fewDraws || 0, fewUnder = H.fewDrawsUnder || null, quarter = Math.max(1, Math.round((med.calls || 0) / 4));
  const frames = [];
  for (let i = 0; i + 1 < rows.length; i++) { const p = rows[i], n = rows[i + 1]; if (p.t < A || p.t > Z) continue;
    const work = p.work === p.work ? p.work : 0, a = p.t - 0.5, b = p.t + Math.max(work, n.dt === n.dt ? n.dt : 0) + 0.5;
    const E = events.filter(e => e.t < b && e.t + (e.kind === 'proguse' ? 0 : (e.ms || 0)) > a && e.t >= a - 3000);
    const slots = {}; for (const k of SL) { const d = p[k] - (med[k] || 0); if (d >= 4) slots[k] = r1(d); }
    const fl = p.flags === p.flags ? p.flags : 0, few = fewBit ? !!(fl & fewBit) : (p.calls === p.calls && p.calls < quarter && !(fl & 256));
    frames.push({ s: s(p.t), dt: r1(n.dt), work: r1(work), ctx: p.ctx, calls: p.calls === p.calls ? p.calls : null, tris: p.tris === p.tris ? p.tris : null, gpuMs: p.gpu === p.gpu ? r1(p.gpu) : null, spd: r1(p.spd), agl: r1(p.agl), few, noRender: !!(fl & 256), slots,
      links: E.filter(e => e.kind === 'link' && e.t >= a).map(e => ({ owner: who(byN.get(e.d)), ms: r1(e.ms) })), waits: E.filter(e => e.kind === 'linkwait' && e.t >= a).map(e => ({ owner: who(byN.get(e.d)), ms: r1(e.ms) })),
      uses: E.filter(e => e.kind === 'proguse' && e.t >= a).map(e => ({ owner: who(byN.get(e.d)), ms: r1(e.ms) })), gpuData: E.filter(e => e.kind === 'gpuup' && e.t >= a).map(e => ({ ms: r1(e.ms), buffers: (e.d.buf || [])[0] || 0, MB: r1(((e.d.buf || [])[2] || 0) / 1024), textures: (e.d.tex || [])[0] || 0, megapixels: (e.d.tex || [])[2] || 0 })),
      delivered: E.filter(e => e.kind === 'deliver' && e.d && e.t >= a).map(e => (e.d.s || '?') + ' ' + r1(e.ms) + ' ms' + (e.d.what ? ' (' + e.d.what + ')' : '')), guard: E.filter(e => e.kind === 'guardhold' && e.t >= a).map(e => e.d),
      errs: E.filter(e => (e.kind === 'err' || e.kind === 'contextlost' || e.kind === 'contextrestored') && e.t >= a).map(e => e.kind + ': ' + String(e.d).slice(0, 120)),
      tasks: E.filter(e => (e.kind === 'longtask' || e.kind === 'loaf') && e.t >= a).reduce((x, e) => Math.max(x, e.ms || 0), 0) }); }
  // (the limit rule of 23 Nov, freeze_ledger.js: over 100 / 250 ms is counted from 104 / 254 ms; the frames AT a limit are counted beside)
  const EDGE = 4, after = frames.filter(f => f.s >= 0), over = ms => after.filter(f => f.dt > ms + EDGE), at = ms => after.filter(f => f.dt > ms - EDGE && f.dt <= ms + EDGE).length;
  const row14 = { frames: after.length, worstMs: after.length ? Math.max(...after.map(f => f.dt || 0)) : null, over100: over(100).length, over250: over(250).length, at100: at(100), at250: at(250), msOver250: Math.round(over(250).reduce((a, f) => a + f.dt, 0)), msOver100: Math.round(over(100).reduce((a, f) => a + f.dt, 0)),
    met: after.length ? over(250).length === 0 : null, firstOver100S: over(100).length ? over(100)[0].s : null, lastOver100S: over(100).length ? over(100)[over(100).length - 1].s : null };
  // ---- the programs -----------------------------------------------------------------------------------------------
  const tags = p => new Set((p.defs || []).filter(x => !/^SHADER_NAME/.test(x)));
  const baseOf = w => String(w).replace(/( \+ (scuff|cutaway))+$/, '');   // (a twin's owner is its source's + what it is: X + scuff + cutaway is X's)
  const nearestBefore = p => { const w = who(p), mine = tags(p); let best = null, bd = Infinity;
    for (const q of progs) { if (!q.three || q.t >= T || q === p) continue; const wq = who(q); if (wq !== w && baseOf(wq) !== baseOf(w)) continue;
      const tq = tags(q); let d = 0; for (const x of mine) if (!tq.has(x)) d++; for (const x of tq) if (!mine.has(x)) d++; if (q.type !== p.type) d += 50; if (wq !== w) d += 0.5; if (d < bd) { bd = d; best = q; } }
    if (!best) return null; const tq = tags(best);
    return { n: best.n, owner: who(best), differs: Math.floor(bd), onlyNew: [...mine].filter(x => !tq.has(x)).slice(0, 10), onlyOld: [...tq].filter(x => !mine.has(x)).slice(0, 10), sameText: best.fp && best.fp === p.fp, linkedS: s(best.t), drawnBefore: best.useT != null && best.useT < T }; };
  const row = p => ({ n: p.n, owner: who(p), kind: kindOf(who(p)), kb: p.vs != null ? Math.round((p.vs + p.fs) / 1024) : null, s: s(p.t), linkMs: r1(p.linkMs), pendingMs: p.readyT != null ? Math.round(p.readyT - p.t) : null, heldMs: r1(p.waitMs), firstUseS: p.useT != null ? s(p.useT) : null, firstUseMs: r1(p.firstUseMs),
    ctx: p.ctx, target: p.rt, via: p.via, lights: (p.body || []).filter(x => /^(LIGHTS|SHADOWS)=/.test(x)).join(' '), hooks: (p.body || []).filter(x => /^(DMG|GD|BAND)_|FLOWN_FADE/.test(x)).join(' '), obj: (p.obj || [])[0] || null });
  const linked = progs.filter(p => p.three && p.t >= T && p.t <= Z).map(p => Object.assign(row(p), { nearest: nearestBefore(p) }));
  const firstUsed = progs.filter(p => p.three && p.t < T && p.useT != null && p.useT >= T && p.useT <= Z).map(p => Object.assign(row(p), { linkedBeforeS: s(p.t), linkedIn: p.step || null }));
  const raw = progs.filter(p => !p.three && p.t >= T && p.t <= Z).map(p => ({ n: p.n, s: s(p.t), linkMs: r1(p.linkMs), waitMs: r1(p.waitMs) }));
  const group = list => { const m = new Map(); for (const p of list) { let g = m.get(p.kind); if (!g) m.set(p.kind, g = { kind: p.kind, programs: 0, kb: 0, linkMs: 0, pendingMs: 0, heldMs: 0, firstUseMs: 0, owners: new Map(), firstS: Infinity });
      g.programs++; g.kb += p.kb || 0; g.linkMs += p.linkMs || 0; g.pendingMs = Math.max(g.pendingMs, p.pendingMs || 0); g.heldMs += p.heldMs || 0; g.firstUseMs += p.firstUseMs || 0; g.owners.set(p.owner, (g.owners.get(p.owner) || 0) + 1); if (p.s < g.firstS) g.firstS = p.s; }
    return [...m.values()].map(g => ({ kind: g.kind, programs: g.programs, kb: g.kb, linkMs: r1(g.linkMs), longestPendingMs: g.pendingMs, heldMs: r1(g.heldMs), firstUseMs: r1(g.firstUseMs), firstS: g.firstS === Infinity ? null : g.firstS,
      owners: [...g.owners].sort((a, b) => b[1] - a[1]).map(([k, n]) => n + ' ' + k) })).sort((a, b) => (b.heldMs + b.firstUseMs + b.linkMs) - (a.heldMs + a.firstUseMs + a.linkMs)); };
  // ---- the blue frame ----------------------------------------------------------------------------------------------
  // THE PICTURE STOOD STILL (PERF-LEAD, 23 Nov): a frame the draw guard holds is rendered and not presented - the page's
  // 'still' events (one a run: [t at its end, ms from the last picture shown to the next, { f, keep }]) and, in the rows,
  // the notShown flag. THIS is what the user sees at a crash; the frames' own times do not show it.
  const nsBit = FLAGS.notShown || 0;
  const stills = events.filter(e => e.kind === 'still' && e.ms > 0 && e.t >= T && e.t - e.ms <= Z).map(e => ({ s: s(e.t - e.ms), ms: r1(e.ms), frames: e.d && e.d.f != null ? e.d.f : null, keep: e.d && e.d.keep != null ? e.d.keep : null,
    linking: progs.filter(p => p.three && p.t < e.t && (p.readyT == null || p.readyT > e.t - e.ms)).map(p => who(p)) }));
  if (!stills.length && nsBit) { let run = null; for (let i = 0; i < rows.length; i++) { const r = rows[i]; if (r.t < T || r.t > Z + 30000) { if (run && r.t > Z) break; if (r.t < T) continue; }
      const ns = r.flags === r.flags && (r.flags & nsBit); if (ns) { if (!run) run = { t0: i > 0 ? rows[i - 1].t : r.t, n: 0 }; run.n++; } else if (run) { stills.push({ s: s(run.t0), ms: r1(r.t - run.t0), frames: run.n, keep: null, linking: progs.filter(p => p.three && p.t < r.t && (p.readyT == null || p.readyT > run.t0)).map(p => who(p)) }); run = null; } } }
  const stillsRecorded = !!nsBit || events.some(e => e.kind === 'still') || !!o.stillsRecorded;   // (--stills-recorded: a build that has the 'still' event and fired none says nothing in its log)
  row14.stills = stills.length; row14.worstStillMs = stills.length ? Math.max(...stills.map(x => x.ms)) : 0; row14.stillMs = Math.round(stills.reduce((a, x) => a + x.ms, 0)); row14.stillsRecorded = stillsRecorded;
  if (row14.met !== null) row14.met = row14.met && row14.worstStillMs <= 250 + EDGE;
  const blue = after.filter(f => f.few && !f.noRender && f.ctx === 'world'), guards = events.filter(e => e.kind === 'guardhold' && e.t >= T && e.t <= Z);
  const errs = events.filter(e => (e.kind === 'err' || e.kind === 'contextlost' || e.kind === 'contextrestored') && e.t >= A && e.t <= Z).map(e => ({ s: s(e.t), what: e.kind + ': ' + String(e.d).slice(0, 160) }));
  return { kind: 'flydiy-crash-window', v: 1, build: H.build || null, gpu: (H.gpu || {}).unmaskedRenderer || null, canvas: H.canvas ? H.canvas.w + 'x' + H.canvas.h : null, impact: { t: r1(T), sinceRevealS: r1((T - reveal) / 1000), by, restS: rest ? s(rest.t) : null }, marks: marksAll,
    before: BEFORE / 1000, after: AFTER / 1000, usual: { workMs: r1(med.work), calls: med.calls, tris: med.tris, gpuMs: r1(med.gpu) }, row14, hasBody: progs.some(p => Array.isArray(p.body)),
    linked: { programs: linked.length, kb: linked.reduce((a, p) => a + (p.kb || 0), 0), heldMs: r1(linked.reduce((a, p) => a + (p.heldMs || 0), 0)), byKind: group(linked), rows: linked.sort((a, b) => a.s - b.s) },
    firstUsed: { programs: firstUsed.length, firstUseMs: r1(firstUsed.reduce((a, p) => a + (p.firstUseMs || 0), 0)), byKind: group(firstUsed), rows: firstUsed.sort((a, b) => (b.firstUseMs || 0) - (a.firstUseMs || 0)) }, raw,
    stills: stills.map(x => { const m = new Map(); for (const w of x.linking) m.set(w, (m.get(w) || 0) + 1); return { s: x.s, ms: x.ms, frames: x.frames, keep: x.keep, linking: x.linking.length, by: [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => n + ' ' + k) }; }),
    blue: { fewFlag: !!fewBit, under: fewBit ? fewUnder : quarter, frames: blue.length, list: blue.slice(0, 40).map(f => ({ s: f.s, dt: f.dt, calls: f.calls, tris: f.tris })), guardHolds: guards.length, guardHeldMax: guards.reduce((a, e) => Math.max(a, (e.d && e.d.held) || (typeof e.d === 'number' ? e.d : 0)), 0),
      guardFirstS: guards.length ? s(guards[0].t) : null, guardLastS: guards.length ? s(guards[guards.length - 1].t) : null, guardWhat: [...new Set([].concat(...guards.map(e => (e.d && e.d.new) || [])))].slice(0, 30), errs },
    longest: after.slice().sort((a, b) => (b.dt || 0) - (a.dt || 0)).slice(0, o.top || 14), frames: o.all ? frames : undefined };
}

function text(R) {
  const L = [], lp = (x, n) => String(x == null ? '-' : x).padStart(n);
  const mk = R.marks && R.marks.length ? '  the script\'s marks (s after the reveal): ' + R.marks.map(m => m.mark + ' ' + m.s).join(', ') : '  the log has no script marks';
  if (!R.impact) { L.push('CRASH WINDOW  build ' + (R.build || '?') + ': NO IMPACT FOUND - ' + R.why); L.push(mk + '   (--at S or --mark name places it)'); return L.join('\n'); }
  L.push('CRASH WINDOW  build ' + (R.build || '?') + '  ' + (R.gpu || '') + '  canvas ' + (R.canvas || '?'));
  L.push('  THE IMPACT: ' + R.impact.sinceRevealS + ' s after the reveal, by ' + R.impact.by + (R.impact.restS != null ? '; the wreck at rest ' + R.impact.restS + ' s later' : ''));
  L.push(mk);
  L.push('  before it the loop took ' + R.usual.workMs + ' ms a frame with ' + R.usual.calls + ' draw calls, ' + R.usual.tris + ' triangles, GPU ' + R.usual.gpuMs + ' ms');
  const W = R.row14;
  L.push(''); L.push('ROW 14 (under 250 ms of freeze at a crash, no blue frame): ' + (W.met === null ? 'no frame after the impact in this log' : (!W.met || R.blue.frames ? 'NOT MET' : W.stillsRecorded ? 'MET' : 'NOT JUDGED (the frames\' own times pass, but this log does not record the still pictures: what the screen showed is unknown)') + ' - in the ' + R.after + ' s after the impact: ' + W.frames + ' frames, the worst ' + W.worstMs + ' ms; ' + W.over250 + ' over 250 ms (' + W.msOver250 + ' ms in them; ' + W.at250 + ' more AT 250), ' + W.over100 + ' over 100 ms (' + W.msOver100 + ' ms; ' + W.at100 + ' more AT 100 ms: counted from 104 and 254, the rule of 23 Nov)' +
    (W.over100 ? ', from ' + W.firstOver100S + ' to ' + W.lastOver100S + ' s after it' : '') + '; ' + (W.stillsRecorded ? 'THE PICTURE STOOD STILL ' + W.stills + ' time(s), the worst ' + W.worstStillMs + ' ms, ' + W.stillMs + ' ms in all' : 'STILL PICTURES NOT RECORDED in this log (frames rendered and not presented read as ordinary frames: the figures before this are a floor, not what the screen showed)') + '; ' + R.blue.frames + ' frame(s) that drew ' + (R.blue.fewFlag ? 'under ' + R.blue.under + ' calls (the recorder\'s flag)' : 'under ' + R.blue.under + ' calls (a quarter of the usual: this log has no flag)')));
  if (R.stills && R.stills.length) { L.push(''); L.push('THE PICTURE STOOD STILL (rendered frames not presented: the draw guard held a draw; each is one freeze as the user sees it)');
    L.push('  ' + lp('from s', 8) + lp('ms', 9) + lp('frames', 8) + lp('linking', 9) + '  the programs still linking over it');
    for (const x of R.stills) L.push('  ' + lp(x.s, 8) + lp(x.ms, 9) + lp(x.frames, 8) + lp(x.linking, 9) + '  ' + (x.by.join('; ') || 'none: the hold is not a link wait')); }
  L.push(''); L.push('THE LONGEST FRAMES AFTER THE IMPACT (s after it; over = the slots 4 ms+ over their usual cost before the impact)');
  L.push('  ' + lp('s', 7) + lp('ms', 8) + lp('work', 8) + lp('draws', 7) + lp('tris M', 8) + lp('GPU', 7) + lp('m/s', 6) + '  what');
  for (const f of R.longest) { const bits = [];
    const sl = Object.keys(f.slots).sort((a, b) => f.slots[b] - f.slots[a]).map(k => k + ' +' + f.slots[k]); if (sl.length) bits.push('over: ' + sl.join(' '));
    if (f.waits.length) bits.push('HELD ON A LINK ' + r1(f.waits.reduce((a, w) => a + (w.ms || 0), 0)) + ' ms: ' + [...new Set(f.waits.map(w => w.owner))].slice(0, 3).join(', '));
    if (f.links.length) bits.push(f.links.length + ' links submitted (' + r1(f.links.reduce((a, w) => a + (w.ms || 0), 0)) + ' ms of calls): ' + [...new Set(f.links.map(w => w.owner))].slice(0, 3).join(', ') + (f.links.length > 3 ? ' ...' : ''));
    if (f.uses.length) bits.push(f.uses.length + ' first uses ' + r1(f.uses.reduce((a, w) => a + (w.ms || 0), 0)) + ' ms: ' + f.uses.slice().sort((a, b) => (b.ms || 0) - (a.ms || 0)).slice(0, 2).map(u => u.owner + ' ' + u.ms).join(', '));
    for (const g of f.gpuData) if (g.ms >= 1) bits.push('new GPU data ' + g.ms + ' ms (' + g.buffers + ' buffers ' + g.MB + ' MB, ' + g.textures + ' texture calls ' + g.megapixels + ' MP)');
    if (f.delivered.length) bits.push('delivered: ' + f.delivered.slice(0, 3).join('; '));
    if (f.guard.length) bits.push('GUARD HELD ' + f.guard.map(g => (g && g.held) || g).join('+') + ' draws');
    if (f.few) bits.push('FEW DRAWS'); if (f.noRender) bits.push('no render'); if (f.tasks >= 50) bits.push('a task of ' + Math.round(f.tasks) + ' ms'); if (f.errs.length) bits.push(f.errs.join('; '));
    L.push('  ' + lp(f.s, 7) + lp(f.dt, 8) + lp(f.work, 8) + lp(f.calls, 7) + lp(f.tris != null ? r1(f.tris / 1e6) : null, 8) + lp(f.gpuMs, 7) + lp(f.spd, 6) + '  ' + (bits.join(' | ') || 'nothing recorded')); }
  for (const [title, S, kind] of [['PROGRAMS LINKED AFTER THE IMPACT', R.linked, 'l'], ['LINKED BEFORE THE IMPACT, FIRST DRAWN AFTER IT', R.firstUsed, 'u']]) {
    L.push(''); L.push(title + ': ' + S.programs + (kind === 'l' ? ' (' + S.kb + ' KB; draws held on them ' + S.heldMs + ' ms)' : ' (' + S.firstUseMs + ' ms of first use)'));
    if (!S.programs) continue;
    L.push('  ' + lp('progs', 7) + lp('KB', 7) + lp('link ms', 9) + lp('longest pend', 14) + lp('held ms', 9) + lp('1st use ms', 12) + lp('from s', 8) + '  what   [owners]');
    for (const g of S.byKind) L.push('  ' + lp(g.programs, 7) + lp(g.kb, 7) + lp(g.linkMs, 9) + lp(g.longestPendingMs, 14) + lp(g.heldMs, 9) + lp(g.firstUseMs, 12) + lp(g.firstS, 8) + '  ' + g.kind + '   [' + g.owners.slice(0, 6).join('; ') + (g.owners.length > 6 ? '; ...' : '') + ']');
    L.push('  ' + lp('#', 6) + lp('s', 7) + lp('KB', 5) + lp('pend ms', 9) + lp('held', 7) + lp('1st use', 9) + '  owner  {lights; hooks}  [made in, for]' + (kind === 'l' ? '  <- the nearest program of the same owner linked BEFORE the impact, and what differs' : ''));
    for (const p of S.rows.slice(0, 60)) L.push('  ' + lp(p.n, 6) + lp(kind === 'l' ? p.s : p.firstUseS, 7) + lp(p.kb, 5) + lp(p.pendingMs, 9) + lp(p.heldMs, 7) + lp(p.firstUseMs, 9) + '  ' + p.owner + '  {' + (p.lights || '-') + (p.hooks ? '; ' + p.hooks : '') + '}  [' + (p.ctx || '?') + ', ' + (p.target || '?') + ']' +
      (kind === 'l' ? (p.nearest ? '  <- #' + p.nearest.n + ' (linked ' + p.nearest.linkedS + ' s, ' + (p.nearest.drawnBefore ? 'drawn' : 'NEVER DRAWN before the impact') + ')' + (p.nearest.sameText ? ' THE SAME TEXT under another key' : ': +' + (p.nearest.onlyNew.join(' ') || 'nothing') + ' / -' + (p.nearest.onlyOld.join(' ') || 'nothing')) : '  <- NO program of this owner was linked before the impact') : '  linked ' + p.linkedBeforeS + ' s (' + (p.linkedIn || '?') + ')')); }
  if (!R.hasBody) L.push('  (this log has no body axes - a build before PERF-TRACE 4: the light counts and the DMG_ switches are not in the defines compared)');
  if (R.raw.length) { L.push(''); L.push('LINKS WITH NO three.js PROGRAM (raw GL - SKIN_GPU\'s own): ' + R.raw.map(p => '#' + p.n + ' at ' + p.s + ' s, link call ' + p.linkMs + ' ms' + (p.waitMs ? ', held ' + p.waitMs + ' ms' : '')).join('; ')); }
  const B = R.blue;
  L.push(''); L.push('THE BLUE FRAME: ' + B.frames + ' frame(s) of the world after the impact drew under ' + B.under + ' calls' + (B.fewFlag ? '' : ' (no flag in this log: a quarter of the usual count)') + (B.frames ? ': ' + B.list.map(f => f.s + ' s (' + f.calls + ' calls, ' + f.dt + ' ms)').join(', ') : ''));
  L.push('  the draw guard: ' + (B.guardHolds ? B.guardHolds + ' frames with draws held (up to ' + B.guardHeldMax + ' at once), from ' + B.guardFirstS + ' to ' + B.guardLastS + ' s' + (B.guardWhat.length ? ': ' + B.guardWhat.join('; ') : '') : 'no hold recorded (the \'guardhold\' event is PERF-TRACE 7\'s: an older build says nothing either way)'));
  L.push('  errors, lost contexts: ' + (B.errs.length ? B.errs.map(e => e.s + ' s ' + e.what).join(' | ') : 'none'));
  return L.join('\n');
}
module.exports = { crashWindow, text, kindOf };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--at', '--mark', '--before', '--after', '--top'].includes(argv[i - 1])));
  if (!file) { console.error('usage: node tools/crash_window.js <flightlog.json[.gz]> [--at S | --mark name] [--before 3] [--after 20] [--top 14] [--json]'); process.exit(2); }
  const R = crashWindow(AL.load(file), { at: opt('at', null), mark: opt('mark', null), stillsRecorded: argv.includes('--stills-recorded'), before: opt('before', 3), after: opt('after', 20), top: +opt('top', 14) });
  console.log(argv.includes('--json') ? JSON.stringify(R) : text(R));
}
