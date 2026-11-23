#!/usr/bin/env node
// big_uploads.js - THE BIG GPU UPLOADS OF A RUN, AND WHAT THE LOOP DID JUST BEFORE EACH (PERF-TRACE, 22 Nov 2026)
//
// PERF-LEAD, on the 27-minute journey: 46 frames created 30 ms or more of new GPU buffers ("buf: [4, 60-90 ms, 44 000
// KB]", every 3.8 s at the median), 16 of the 35 frames over 100 ms sit on one, and they fall in whichever pass draws
// first (the mirror's or the main render's). WHOSE are they? A buffer is uploaded at its first DRAW; it was BUILT on
// the CPU a frame or a few before, by a streamer whose work has its own slot in the loop (world, prem, cover, fill,
// scene). So for every frame whose new GPU data took `--ms` or more, this prints the slots of that frame and of the
// `--back` frames before it against their usual cost - and, over all of them, how often each slot ran long just
// before a big upload against how often it runs long anyway (the base rate: a slot that is long before 40 of 46
// uploads and in 3 % of all frames is the builder; one that is long in 50 % of all frames says nothing).
// It also prints the uploads' own shape (how many buffers, how many MB, the gap between two) and what the log says
// arrived in those frames (streamer deliveries, premises built, programs first used).
// THIS IS AN INFERENCE FROM TIMING, and says so: the owner by NAME is ?recup=2's GL table (program_id.js), which holds
// the array each bufferData read and the object that wears it.
//
//   node tools/big_uploads.js <flightlog.json[.gz]> [--ms 30] [--back 3] [--long 4] [--context world] [--top 20] [--json]
'use strict';
const path = require('path');
const AL = require(path.join(__dirname, 'analyze_log.js')), PR = require(path.join(__dirname, 'program_report.js')), FL = require(path.join(__dirname, 'freeze_ledger.js'));
const r1 = v => v == null || v !== v ? null : Math.round(v * 10) / 10;
const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

function bigUploads(log, opt) {
  const o = opt || {}, MS = o.ms != null ? +o.ms : 30, BACK = o.back != null ? +o.back : 3, LONG = o.long != null ? +o.long : 4, CTX = o.context || 'world';
  const H = log.header || {}, SL = H.slots || [], rows = AL.frames(log);
  const events = (log.events || []).map(e => ({ t: e[0], kind: e[1], ms: e[2], d: e[3] })).sort((a, b) => a.t - b.t);
  const progs = PR.programs(log), byN = new Map(progs.map(p => [p.n, p]));
  const who = p => !p ? 'a program the log does not name' : (p.own && p.own.length ? p.own.join(' + ') : 'UNOWNED ' + ((p.mat && p.mat[0]) || p.name || p.type || ''));
  const reveal = (events.find(e => e.kind === 'reveal') || {}).t;
  for (const r of rows) r.ctx = FL.contextOf(r);
  const C0 = rows.filter(r => r.ctx === CTX && (reveal == null || r.t >= reveal)), usual = C0.filter(r => r.dt === r.dt && r.dt <= 35);
  const med = {}; for (const k of SL) med[k] = median(usual.map(r => r[k]).filter(x => x === x));
  const isLong = (r, k) => r[k] - med[k] >= LONG;
  const base = {}; for (const k of SL) base[k] = C0.length ? C0.filter(r => isLong(r, k)).length / C0.length : 0;
  // the frame an event's time falls in (the row whose start is the last one at or before it)
  const T = rows.map(r => r.t), rowAt = t => { let lo = 0, hi = T.length - 1, b = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (T[m] <= t) { b = m; lo = m + 1; } else hi = m - 1; } return b; };
  const ups = events.filter(e => e.kind === 'gpuup' && e.d && (reveal == null || e.t >= reveal) && ((e.d.buf || [])[1] >= MS || e.ms >= MS));
  const out = [];
  for (const e of ups) {
    // a loop's 'gpuup' is stamped at the frame's END: the frame is the one that began last before it
    // (NOT simply "the row that began last before it": a frame that ran long ends AFTER the next frame's rAF timestamp -
    //  the display's time, not the callback's - so of the last three rows begun before the event, the one whose own
    //  end, start + work, is nearest the event's time)
    let i = rowAt(e.t - 0.01); if (i < 0) continue;
    if (e.d.at === 'loop') { let best = i, bd = Infinity; for (let k = i; k >= Math.max(0, i - 2); k--) { const d = Math.abs(rows[k].t + (rows[k].work || 0) - e.t); if (d < bd) { bd = d; best = k; } } i = best; }
    const p = rows[i], n = rows[i + 1];
    if (p.ctx !== CTX) continue;
    const before = []; for (let k = 0; k <= BACK; k++) { const r = rows[i - k]; if (!r) break; const x = {}; for (const s of SL) { const d = r[s] - med[s]; if (d >= LONG) x[s] = r1(d); } before.push(x); }
    const a = p.t - 0.5, b = p.t + (p.work || 0) + 0.5, E = events.filter(v => v.t >= a - 2000 && v.t < b && v.t + (v.ms || 0) > a);
    const paid = (p.mirror - med.mirror) > (p.render - med.render) ? 'mirror' : 'render';
    out.push({ s: reveal != null ? r1((e.t - reveal) / 1000) : r1(e.t / 1000), at: e.d.at, ms: r1(e.ms), buffers: (e.d.buf || [])[0] || 0, bufferMs: r1((e.d.buf || [])[1] || 0), bufferMB: r1(((e.d.buf || [])[2] || 0) / 1024),
      textures: (e.d.tex || [])[0] || 0, textureMs: r1((e.d.tex || [])[1] || 0), megapixels: (e.d.tex || [])[2] || 0, mipmaps: (e.d.mip || [])[0] || 0, newGeometries: e.d.geo || 0, newTextures: e.d.texNew || 0,
      x: p.x === p.x ? Math.round(p.x) : null, z: p.z === p.z ? Math.round(p.z) : null, bufferKB: (e.d.buf || [])[2] || 0,
      paidIn: paid, mirrorMs: r1(p.mirror), renderMs: r1(p.render), work: r1(p.work), nextDt: n ? r1(n.dt) : null, calls: p.calls === p.calls ? p.calls : null, agl: p.agl === p.agl ? Math.round(p.agl) : null, spd: p.spd === p.spd ? Math.round(p.spd) : null,
      before, deliveries: E.filter(v => v.kind === 'deliver' && v.d && v.t >= a).map(v => (v.d.s || '?') + (v.d.kb != null ? ' ' + v.d.kb + ' KB' + (v.d.was != null ? ' (' + v.d.was + '->' + v.d.n + ' nodes)' : '') : '')),
      deliveredKB: E.filter(v => v.kind === 'deliver' && v.d && v.t >= a - 200).reduce((s, v) => s + (v.d.kb || 0), 0), premises: E.filter(v => (v.kind === 'premslow' || v.kind === 'prem') && v.t >= a).length,
      firstUses: E.filter(v => v.kind === 'proguse' && v.t >= a).map(v => who(byN.get(v.d))) });
  }
  const N = out.length, gaps = []; for (let k = 1; k < N; k++) gaps.push(out[k].s - out[k - 1].s);
  // how often each slot ran long in the frame of the upload or the BACK before it, against its base rate over the flight
  const slots = SL.map(s => { const hit = out.filter(u => u.before.some(x => x[s] != null)).length, same = out.filter(u => u.before[0] && u.before[0][s] != null).length, prev = out.filter(u => u.before.slice(1).some(x => x[s] != null)).length;
    const exp = 1 - Math.pow(1 - base[s], BACK + 1);
    return { slot: s, usualMs: r1(med[s]), longBefore: hit, sameFrame: same, framesBefore: prev, pct: N ? Math.round(100 * hit / N) : 0, expectedPct: Math.round(100 * exp), basePct: r1(100 * base[s]),
      medianExcess: r1(median(out.map(u => Math.max(0, ...u.before.map(x => x[s] || 0))).filter(x => x > 0))) }; }).sort((a, b) => (b.pct - b.expectedPct) - (a.pct - a.expectedPct));
  // THE PLACE (PERF-LEAD: the uploads are place-bound - two a circuit lap, at the same points): each upload's nearest OTHER
  // upload made 60 s or more apart in time, by the eye's x, z - and the same for as many random frames of the flight (what
  // "near" would be by chance on this route)
  const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z);
  const nearest = (u, set, tOf) => { let best = Infinity; for (const v of set) { if (v === u || v.x == null || Math.abs(tOf(v) - tOf(u)) < 60) continue; const d = d2(u, v); if (d < best) best = d; } return Math.sqrt(best); };
  const withXZ = out.filter(u => u.x != null);
  for (const u of withXZ) u.nearestOtherM = Math.round(nearest(u, withXZ, v => v.s));
  const Cx = C0.filter(r => r.x === r.x), step = Math.max(1, Math.floor(Cx.length / Math.max(1, withXZ.length))), rnd = []; for (let k = Math.floor(step / 2); k < Cx.length && rnd.length < withXZ.length; k += step) rnd.push({ x: Cx[k].x, z: Cx[k].z, s: Cx[k].t / 1000 });
  const place = { uploads: withXZ.length, medianNearestM: Math.round(median(withXZ.map(u => u.nearestOtherM).filter(x => x < 1e9))), within200m: withXZ.filter(u => u.nearestOtherM <= 200).length,
    chanceMedianM: Math.round(median(rnd.map(u => nearest(u, rnd, v => v.s)).filter(x => x < 1e9))), chanceWithin200m: rnd.filter(u => nearest(u, rnd, v => v.s) <= 200).length };
  // THE FAR TERRAIN'S UNIT (render_world.js buildQuad: a re-cut quadrant = nodes x [NV x 32 bytes (position, normal, uv) + the
  // index template x 4], NV = N2 + 4 N, the template 6 Pn2 + 24 Pn, N = Pn + 1): are the uploads' bytes whole numbers of nodes?
  // (the event keeps KB: half a KB of rounding each way; a frame with other buffers in it will not fit)
  const farUnit = Pn => { const N = Pn + 1, NV = N * N + 4 * N; return NV * 32 + (6 * Pn * Pn + 24 * Pn) * 4; };
  const far = [8, 16, 32, 64].map(Pn => { const U = farUnit(Pn), tol = Math.max(0.02, 700 / U), fit = out.filter(u => u.buffers > 0 && u.buffers % 4 === 0 && Math.abs(u.bufferKB * 1024 / U - Math.round(u.bufferKB * 1024 / U)) <= tol);
    return { patch: Pn, unitBytes: U, tolNodes: r1(tol * 100) / 100, of: out.filter(u => u.buffers > 0 && u.buffers % 4 === 0).length, fit: fit.length, chancePct: Math.round(200 * tol), medianNodes: Math.round(median(fit.map(u => u.bufferKB * 1024 / U))) }; });
  const sizes = new Map(); for (const u of out) { const k = u.buffers + ' buffers, ' + Math.round(u.bufferMB) + ' MB'; sizes.set(k, (sizes.get(k) || 0) + 1); }
  return { kind: 'flydiy-big-uploads', v: 1, build: H.build || null, context: CTX, ms: MS, back: BACK, long: LONG, flightFrames: C0.length, uploads: N,
    totalMs: Math.round(out.reduce((a, u) => a + u.ms, 0)), bufferMB: Math.round(out.reduce((a, u) => a + u.bufferMB, 0)), medianBuffers: median(out.map(u => u.buffers)), medianMB: r1(median(out.map(u => u.bufferMB))), medianMs: r1(median(out.map(u => u.bufferMs))),
    gapS: { median: r1(median(gaps)), min: gaps.length ? r1(Math.min(...gaps)) : null }, paidIn: { mirror: out.filter(u => u.paidIn === 'mirror').length, render: out.filter(u => u.paidIn === 'render').length },
    followedByFreeze: out.filter(u => u.nextDt > 104).length,   // (the limit rule of 23 Nov: over 100 ms is counted from 104)
     all: out.map(u => ({ s: u.s, x: u.x, z: u.z, agl: u.agl, MB: u.bufferMB, buffers: u.buffers, ms: u.ms, paidIn: u.paidIn })), withNewGeometries: out.filter(u => u.newGeometries > 0).length, medianNewGeometries: median(out.map(u => u.newGeometries)),
    shapes: [...sizes].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => ({ shape: k, n })), slots, place, far,
    deliveredKB: out.reduce((s, u) => s + (u.deliveredKB || 0), 0),
    withDeliveries: out.filter(u => u.deliveries.length).length, withPremises: out.filter(u => u.premises).length, withFirstUses: out.filter(u => u.firstUses.length).length, list: out.slice().sort((a, b) => b.ms - a.ms).slice(0, o.top || 20) };
}

function text(R) {
  const L = [], lp = (s, n) => String(s == null ? '-' : s).padStart(n);
  L.push('THE BIG GPU UPLOADS  build ' + (R.build || '?') + '  (' + R.context + ' after the reveal: ' + R.flightFrames + ' frames; a frame whose new GPU data took ' + R.ms + ' ms or more)');
  L.push('  ' + R.uploads + ' of them, ' + R.totalMs + ' ms in all, ' + R.bufferMB + ' MB of new buffers; at the median ' + R.medianBuffers + ' buffers, ' + R.medianMB + ' MB, ' + R.medianMs + ' ms; one every ' + R.gapS.median + ' s (the closest two ' + R.gapS.min + ' s apart)');
  L.push('  paid in the mirror\'s pass ' + R.paidIn.mirror + ', in the main render ' + R.paidIn.render + ' (the pass whose slot ran longer); ' + R.followedByFreeze + ' followed by an interval over 100 ms; ' + R.withNewGeometries + ' came with new geometries (' + R.medianNewGeometries + ' at the median)');
  L.push('  their shapes: ' + R.shapes.map(s => s.n + ' x ' + s.shape).join('; '));
  const P = R.place;
  L.push(''); L.push('THE PLACE: the nearest OTHER upload (60 s or more apart in time) is ' + P.medianNearestM + ' m away at the median, ' + P.within200m + ' of ' + P.uploads + ' have one within 200 m; for as many frames taken evenly along the flight: ' + P.chanceMedianM + ' m, ' + P.chanceWithin200m + ' within 200 m');
  L.push('  (far under the evenly-taken figure = the uploads come back to the same places: something keyed on WHERE the eye is)');
  L.push(''); L.push('THE FAR TERRAIN\'S UNIT (render_world.js buildQuad: a re-cut quadrant makes 4 buffers = nodes x a fixed number of bytes; are the uploads whole numbers of nodes?)');
  L.push('  ' + lp('patch', 7) + lp('bytes a node', 14) + lp('fit', 6) + lp('of', 5) + lp('by chance %', 13) + lp('median nodes', 14) + '   (of = the uploads whose buffer count is a multiple of 4; fit = within ' + '+-' + 'the KB rounding of a whole number)');
  for (const f of R.far) L.push('  ' + lp(f.patch, 7) + lp(f.unitBytes, 14) + lp(f.fit, 6) + lp(f.of, 5) + lp(f.chancePct, 13) + lp(f.medianNodes, 14));
  if (R.deliveredKB) L.push('  the streamers\' own word in those frames (\'deliver\' events with their bytes): ' + Math.round(R.deliveredKB / 1024) + ' MB of the ' + R.bufferMB + ' MB');
  L.push(''); L.push('WHAT THE LOOP DID JUST BEFORE (a slot ' + R.long + ' ms or more over its usual cost, in the upload\'s frame or the ' + R.back + ' before; "expected" = how often that would be true of any ' + (R.back + 1) + ' frames of this flight)');
  L.push('  ' + lp('before', 8) + lp('of', 5) + lp('%', 6) + lp('expected %', 12) + lp('same frame', 12) + lp('frames before', 15) + lp('median +ms', 12) + lp('usual ms', 10) + '  slot');
  for (const s of R.slots) L.push('  ' + lp(s.longBefore, 8) + lp(R.uploads, 5) + lp(s.pct, 6) + lp(s.expectedPct, 12) + lp(s.sameFrame, 12) + lp(s.framesBefore, 15) + lp(s.medianExcess, 12) + lp(s.usualMs, 10) + '  ' + s.slot);
  L.push('  (mirror and render are where the upload itself is paid: they are long by construction. The builder is a slot far over its expected % that is NOT one of those two.)');
  L.push('  in those frames the log also has: streamer deliveries in ' + R.withDeliveries + ', premises built in ' + R.withPremises + ', programs first used in ' + R.withFirstUses);
  L.push(''); L.push('THE ' + R.list.length + ' LARGEST (s since the reveal; before = the slots over their usual cost: [the upload\'s frame | 1 before | 2 before ...])');
  L.push('  ' + lp('s', 9) + lp('ms', 7) + lp('bufs', 6) + lp('MB', 7) + lp('geo+', 6) + lp('paid', 8) + lp('next', 7) + lp('agl', 6) + lp('x', 8) + lp('z', 8) + lp('other m', 9) + '  before');
  for (const u of R.list) L.push('  ' + lp(u.s, 9) + lp(u.ms, 7) + lp(u.buffers, 6) + lp(u.bufferMB, 7) + lp(u.newGeometries, 6) + lp(u.paidIn, 8) + lp(u.nextDt, 7) + lp(u.agl, 6) + lp(u.x, 8) + lp(u.z, 8) + lp(u.nearestOtherM > 1e8 ? '-' : u.nearestOtherM, 9) + '  ' +
    u.before.map(x => Object.keys(x).filter(k => k !== 'mirror' && k !== 'render').map(k => k + ' +' + x[k]).join(' ') || '.').join(' | ') + (u.deliveries.length ? '  delivered: ' + u.deliveries.join(',') : '') + (u.firstUses.length ? '  first use: ' + u.firstUses.slice(0, 2).join(', ') : ''));
  L.push(''); L.push('THIS IS TIMING, NOT A NAME: ?recup=2 (program_id.js, the GL table) holds the array each bufferData read and the object that wears it.');
  return L.join('\n');
}
module.exports = { bigUploads, text };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--ms', '--back', '--long', '--context', '--top'].includes(argv[i - 1])));
  if (!file) { console.error('usage: node tools/big_uploads.js <flightlog.json[.gz]> [--ms 30] [--back 3] [--long 4] [--context world] [--top 20] [--json]'); process.exit(2); }
  const R = bigUploads(AL.load(file), { ms: opt('ms', 30), back: opt('back', 3), long: opt('long', 4), context: opt('context', 'world'), top: +opt('top', 20) });
  console.log(argv.includes('--json') ? JSON.stringify(R) : text(R));
}
