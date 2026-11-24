#!/usr/bin/env node
// gpu_passes.js <flightlog.json> [--from S] [--to S] [--mark name] [--against other.json --label-a A --label-b B] [--json]
//
// THE GPU'S TIME BY PASS (PERF-TRACE 9, 24 Nov 2026). The user, 23 Nov: "we should try something for the general FPS
// again, try and get some headroom on the graphic card, maybe reach below 30 ms per frame". At 5120x1440 the GPU takes
// 32.7 ms a frame in cruise (a frame has 33.3) and the log had one number for it.
//
// A page run with ?recgpu=pass[:N] times one frame in N (4) as a chain of GPU timer queries, one a pass (the recorder's
// table `gpuPasses`, flight_recorder.js THE GPU'S TIME BY PASS): the loop's laps (world = the streamers' uploads, mirror =
// the water mirror's capture, other), the shadow maps, and the passes aa_resolve.js marks inside the render (clouds
// march, scene pass, clouds overlay, aa resolve, post, frame tap). This reads it:
//   - each pass over the window: frames it appears in, median and 90th percentile ms, its share of the passes' sum, the
//     draw calls and triangles of the renders that returned in it, ms a megapixel of the canvas;
//   - the passes' sum beside the WHOLE-FRAME GPU time of the other frames of the same window (they must agree: a chain
//     that added time of its own would show here);
//   - the render scale as it changed ('aascale' events: the automatic scale's steps), time-weighted over the window, and
//     the whole-frame GPU ms at each scale;
//   - --against: two logs side by side, pass by pass (the same seconds flown with a family or a setting off: THAT is how
//     a family INSIDE the scene pass - the cover ring, the far terrain, the trees - gets a GPU cost; a chain cannot split
//     one pass, three draws it sorted by material and depth).
// THE WINDOW: the world's frames after the log's last reveal, or --from / --to in seconds after it, or --mark name = a
// flight script's step ('seg:<name>' to the next mark). Frames flagged boot, away or not rendered are left out.
// WHAT IT DOES NOT SAY: a query's time is the GPU's span between its first and last command - a pass that waits for the
// one before it shares that wait; the multisample resolve belongs to the segment that ends the render into the target;
// the presentation of the canvas is in no segment.
'use strict';
const fs = require('fs'), path = require('path');
const AL = require(path.join(__dirname, 'analyze_log.js')), FL = require(path.join(__dirname, 'freeze_ledger.js'));
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10, r2 = v => v == null || v !== v ? null : Math.round(v * 100) / 100;
const q = (a, p) => { a = a.filter(x => x === x && x != null).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null; };

function analyse(log, opt) {
  const o = opt || {}, H = log.header || {}, G = log.gpuPasses || null;
  const events = (log.events || []).map(e => ({ t: e[0], kind: e[1], ms: e[2], d: e[3] })).sort((a, b) => a.t - b.t);
  const rows = AL.frames(log); for (const r of rows) r.ctx = FL.contextOf(r);
  const FLAGS = H.flags || {}, skip = (FLAGS.boot || 0) | (FLAGS.away || 0) | (FLAGS.noRender || 0);
  const reveals = events.filter(e => e.kind === 'reveal').map(e => e.t), reveal = reveals.length ? reveals[reveals.length - 1] : (rows.length ? rows[0].t : 0);
  let a = reveal, b = Infinity, how = 'the world\'s frames after the last reveal';
  if (o.mark) { const marks = events.filter(e => e.kind === 'mark' && typeof e.d === 'string'), i = marks.findIndex(m => m.d === o.mark || m.d === 'seg:' + o.mark || m.d.indexOf(o.mark) >= 0);
    if (i >= 0) { a = marks[i].t; b = i + 1 < marks.length ? marks[i + 1].t : Infinity; how = 'the script\'s step "' + marks[i].d + '"'; } else how = 'NO MARK "' + o.mark + '" in this log: ' + how; }
  if (o.from != null) { a = reveal + 1000 * +o.from; how = 'from ' + o.from + ' s after the reveal'; }
  if (o.to != null) { b = reveal + 1000 * +o.to; how += ' to ' + o.to + ' s'; }
  const inWin = r => r.t >= a && r.t < b && r.ctx === 'world' && !((r.flags === r.flags ? r.flags : 0) & skip);
  const W = rows.filter(inWin);
  // (a pass row is its frame's by the frame's time: the nearest row of the window, within half a millisecond)
  const frameAt = t => { let lo = 0, hi = W.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (W[m].t < t) lo = m + 1; else hi = m; }
    let best = null; for (const k of [lo - 1, lo]) if (k >= 0 && k < W.length && Math.abs(W[k].t - t) <= 0.5 && (!best || Math.abs(W[k].t - t) < Math.abs(best.t - t))) best = W[k]; return best; };
  const canvas = H.canvas || null, mp = canvas && canvas.w && canvas.h ? canvas.w * canvas.h / 1e6 : null;
  const R = { kind: 'flydiy-gpu-passes', v: 1, build: H.build || null, gpu: (H.gpu || {}).unmaskedRenderer || null, canvas: canvas ? canvas.w + 'x' + canvas.h : null, megapixels: r2(mp), gfx: H.gfx || null,
    window: { how, seconds: W.length ? r1((W[W.length - 1].t - W[0].t) / 1000) : 0, frames: W.length, fromS: W.length ? r1((W[0].t - reveal) / 1000) : null, toS: W.length ? r1((W[W.length - 1].t - reveal) / 1000) : null },
    recorded: !!G, every: G ? G.every : null, lost: G ? G.lost : null, disjoint: G ? G.disjoint : null, frames: 0, passes: [], sumMed: null, sumP90: null };
  // the whole-frame GPU time of the window (every timed frame; and the ones that are NOT pass frames, for the check)
  const passF = new Set(), L = G ? G.labels.length : 0;
  const PR = G ? G.rows.filter(r => { const fr = frameAt(r[0]); if (fr) passF.add(fr); return !!fr; }) : [];
  const gAll = W.map(r => r.gpu).filter(x => x === x), gOther = W.filter(r => !passF.has(r)).map(r => r.gpu).filter(x => x === x);
  R.whole = { frames: gAll.length, med: r1(q(gAll, 0.5)), p90: r1(q(gAll, 0.9)), otherFrames: gOther.length, otherMed: r1(q(gOther, 0.5)), otherP90: r1(q(gOther, 0.9)),
    workMed: r1(q(W.map(r => r.work), 0.5)), dtMed: r1(q(W.map(r => r.dt), 0.5)), fpsMed: q(W.map(r => r.dt), 0.5) ? r1(1000 / q(W.map(r => r.dt), 0.5)) : null,
    callsMed: q(W.map(r => r.calls), 0.5), trisMed: q(W.map(r => r.tris), 0.5), over33Pct: gAll.length ? r1(100 * gAll.filter(x => x > 33.3).length / gAll.length) : null, over30Pct: gAll.length ? r1(100 * gAll.filter(x => x > 30).length / gAll.length) : null };
  if (G) {
    R.frames = PR.length;
    const sums = PR.map(r => { let s = 0; for (let i = 0; i < L; i++) s += r[2 + i] || 0; return s; });
    R.sumMed = r2(q(sums, 0.5)); R.sumP90 = r2(q(sums, 0.9));
    R.passes = G.labels.map((name, i) => { const ms = PR.map(r => r[2 + i]).filter(x => x != null), all = PR.map(r => r[2 + i] || 0);
      return { name, n: ms.length, med: r2(q(all, 0.5)), p90: r2(q(all, 0.9)), max: r2(q(all, 1)), mean: r2(all.length ? all.reduce((x, y) => x + y, 0) / all.length : null),
        draws: q(PR.map(r => r[2 + L + i] || 0), 0.5), tris: q(PR.map(r => r[2 + 2 * L + i] || 0), 0.5) }; })
      .filter(p => p.n > 0).sort((x, y) => (y.mean || 0) - (x.mean || 0));
    const tot = R.passes.reduce((x, p) => x + (p.mean || 0), 0);
    for (const p of R.passes) { p.sharePct = tot ? r1(100 * p.mean / tot) : null; p.msPerMP = mp && p.med != null ? r2(p.med / mp) : null; }
    R.sumMean = r2(tot);
  }
  // the render scale: its changes, and the GPU's time at each
  const sc = events.filter(e => e.kind === 'aascale' && e.d && e.d.scale != null), spans = [];
  if (W.length) { let cur = null; for (const e of sc) if (e.t <= W[0].t) cur = e; const inside = sc.filter(e => e.t > W[0].t && e.t <= W[W.length - 1].t);
    let t0 = W[0].t; for (const e of inside.concat([null])) { const t1 = e ? e.t : W[W.length - 1].t; spans.push({ scale: cur ? cur.d.scale : null, auto: cur ? cur.d.auto : null, target: cur && cur.d.w ? cur.d.w + 'x' + cur.d.h : null, t0, t1 }); t0 = t1; cur = e; } }
  const byScale = new Map(); for (const s of spans) { const k = s.scale == null ? 'not logged' : String(s.scale); let g = byScale.get(k); if (!g) byScale.set(k, g = { scale: k, auto: s.auto, target: s.target, seconds: 0, gpu: [], dt: [] }); g.seconds += (s.t1 - s.t0) / 1000;
    for (const r of W) if (r.t >= s.t0 && r.t < s.t1) { if (r.gpu === r.gpu) g.gpu.push(r.gpu); if (r.dt === r.dt) g.dt.push(r.dt); } }
  R.scale = { changes: sc.length, inWindow: spans.length - 1, by: [...byScale.values()].map(g => ({ scale: g.scale, auto: g.auto, target: g.target, seconds: r1(g.seconds), gpuMed: r1(q(g.gpu, 0.5)), gpuP90: r1(q(g.gpu, 0.9)), frameMed: r1(q(g.dt, 0.5)) })).sort((x, y) => y.seconds - x.seconds) };
  return R;
}

function text(R, B, la, lb) {
  const L = [], lp = (x, n) => String(x == null ? '-' : x).padStart(n);
  L.push('THE GPU BY PASS  build ' + (R.build || '?') + '  ' + (R.gpu || '') + '  canvas ' + (R.canvas || '?') + (R.megapixels ? ' (' + R.megapixels + ' MP)' : ''));
  L.push('  the window: ' + R.window.how + ' - ' + R.window.frames + ' frames, ' + R.window.seconds + ' s (' + R.window.fromS + ' to ' + R.window.toS + ' s after the reveal)');
  const w = R.whole;
  L.push('  THE WHOLE FRAME: GPU ' + w.med + ' ms median, ' + w.p90 + ' at the 90th percentile over ' + w.frames + ' timed frames; ' + w.over33Pct + ' % of them over 33.3 ms, ' + w.over30Pct + ' % over 30; the loop ' + w.workMed + ' ms, the frame ' + w.dtMed + ' ms (' + w.fpsMed + ' a second); ' + w.callsMed + ' draw calls, ' + (w.trisMed != null ? r1(w.trisMed / 1e6) + ' M triangles' : '-'));
  if (R.gfx) L.push('  the settings: ' + JSON.stringify(R.gfx).slice(0, 420));
  if (!R.recorded) { L.push(''); L.push('  NO PASS TABLE IN THIS LOG: run the page with ?recgpu=pass (one frame in 4; ?recgpu=pass:1 every frame the recorder owns).'); }
  else { L.push(''); L.push('  BY PASS (' + R.frames + ' frames timed pass by pass, one in ' + R.every + '; ' + R.lost + ' lost to another timer or a broken frame, ' + R.disjoint + ' disjoint)');
    L.push('  ' + lp('median', 9) + lp('p90', 8) + lp('max', 8) + lp('mean', 8) + lp('share', 8) + lp('ms/MP', 8) + lp('draws', 8) + lp('tris M', 8) + '  pass');
    for (const p of R.passes) L.push('  ' + lp(p.med, 9) + lp(p.p90, 8) + lp(p.max, 8) + lp(p.mean, 8) + lp(p.sharePct + ' %', 8) + lp(p.msPerMP, 8) + lp(p.draws, 8) + lp(p.tris ? r1(p.tris / 1e6) : 0, 8) + '  ' + p.name);
    L.push('  ' + lp(R.sumMed, 9) + lp(R.sumP90, 8) + lp('', 8) + lp(R.sumMean, 8) + '  THE PASSES\' SUM a frame - against the whole-frame timer on the OTHER frames of the window: ' + w.otherMed + ' median, ' + w.otherP90 + ' p90 (' + w.otherFrames + ' frames)' +
      (R.sumMed != null && w.otherMed != null ? (Math.abs(R.sumMed - w.otherMed) <= Math.max(1.5, 0.08 * w.otherMed) ? '  - they agree' : '  <- THEY DIFFER BY ' + r1(R.sumMed - w.otherMed) + ' ms: read the split as shares, not as absolute ms') : '')); }
  L.push(''); L.push('  THE RENDER SCALE: ' + (R.scale.changes ? R.scale.changes + ' change(s) in the log, ' + R.scale.inWindow + ' inside the window' : 'no change logged (a build before PERF-TRACE 9, or the scale never moved: the settings above say what it was)'));
  for (const s of R.scale.by) L.push('  ' + lp(s.scale, 12) + (s.auto != null ? (s.auto ? '  auto' : '  set ') : '      ') + lp(s.target, 12) + lp(s.seconds, 8) + ' s   GPU ' + lp(s.gpuMed, 6) + ' ms median, ' + lp(s.gpuP90, 6) + ' p90   frame ' + lp(s.frameMed, 6) + ' ms');
  if (B) { L.push(''); L.push('  SIDE BY SIDE: ' + (la || 'A') + ' (this log) | ' + (lb || 'B') + '  build ' + (B.build || '?') + ', ' + B.window.frames + ' frames, ' + B.window.seconds + ' s');
    L.push('  ' + lp(la || 'A', 10) + lp(lb || 'B', 10) + lp('B - A', 10) + '  median ms');
    const names = [...new Set(R.passes.map(p => p.name).concat(B.passes.map(p => p.name)))], m = (X, n) => { const p = X.passes.find(p => p.name === n); return p ? p.med : null; };
    for (const n of names) { const x = m(R, n), y = m(B, n); L.push('  ' + lp(x, 10) + lp(y, 10) + lp(x != null && y != null ? r2(y - x) : null, 10) + '  ' + n); }
    L.push('  ' + lp(R.sumMed, 10) + lp(B.sumMed, 10) + lp(R.sumMed != null && B.sumMed != null ? r2(B.sumMed - R.sumMed) : null, 10) + '  the passes\' sum');
    L.push('  ' + lp(R.whole.med, 10) + lp(B.whole.med, 10) + lp(R.whole.med != null && B.whole.med != null ? r1(B.whole.med - R.whole.med) : null, 10) + '  the whole frame\'s GPU, median (p90 ' + R.whole.p90 + ' | ' + B.whole.p90 + '); frames a second ' + R.whole.fpsMed + ' | ' + B.whole.fpsMed + '; draw calls ' + R.whole.callsMed + ' | ' + B.whole.callsMed); }
  return L.join('\n');
}

module.exports = { analyse, text };
if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const vals = new Set(['from', 'to', 'mark', 'against', 'label-a', 'label-b'].map(k => opt(k, null)).filter(x => x != null));
  const file = argv.find(a => !a.startsWith('--') && /\.json(\.gz)?$/.test(a) && !vals.has(a)) || argv.find(a => !a.startsWith('--') && /\.json(\.gz)?$/.test(a));
  if (!file) { console.error('usage: node tools/gpu_passes.js <flightlog.json> [--from S] [--to S] [--mark name] [--against other.json --label-a A --label-b B] [--json]'); process.exit(2); }
  const read = f => JSON.parse(/\.gz$/.test(f) ? require('zlib').gunzipSync(fs.readFileSync(f)).toString('utf8') : fs.readFileSync(f, 'utf8'));
  const o = { from: opt('from', null), to: opt('to', null), mark: opt('mark', null) };
  const R = analyse(read(file), o), other = opt('against', null), B = other ? analyse(read(other), o) : null;
  console.log(argv.includes('--json') ? JSON.stringify(B ? { a: R, b: B } : R) : text(R, B, opt('label-a', null), opt('label-b', null)));
}
