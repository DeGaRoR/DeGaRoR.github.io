#!/usr/bin/env node
// treecrash_evidence.js - TREE-CRASH's pictures (G1470-G1479), node only: reports/evidence/TREE-CRASH/
//   trajectories.svg   the CG along the track against time, BEFORE (params.damage false: the elastic airframe, master's
//                      trunk behaviour to the bit) and NOW, for a 3 m/s taxi, GATE TREEHIT's taxi and a 30 m/s flight
//   damage_time.svg    members set, members broken and the plastic work against time, the 30 m/s flights
//   topdown_<case>.svg the aeroplane's beams from above at the end, before and now: bent members, broken ones, the trunk
//   perf.json / perf   sim.step(1/60) with nothing touching: master's core against this one, alternating processes
// Run: node tools/treecrash_evidence.js [--perf-base <master's tools/flight_core.js>] [--no-perf | --perf-only]
//      (the perf child loads _treecrash_lib.js beside the core it is given: copy it next to master's)
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.join(__dirname, '..', 'reports', 'evidence', 'TREE-CRASH');

// ---- the perf child: sim.step(1/60) timed with nothing touching (the lib's loader on a given core) ----
if (argv[0] === '--perf-child') {
  const core = argv[1], key = argv[2], mode = argv[3];
  const dir = path.dirname(core);
  const L = require(path.join(dir, '_treecrash_lib.js'));
  const C = L.core(), def = L.defOf(key), { W, strip } = L.flatWorld(0);
  // a forest set far away (registered, nothing near): trunkFrame's own one-length-check and its set walk
  const TH = W.treeHits, A = []; for (let i = 0; i < 4000; i++) A.push(5000 + (i % 63) * 9, 5000 + Math.floor(i / 63) * 9, 0, 0.3, 10);
  TH.set('far', A);
  const sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: mode === 'air' ? 300 : 0 }));
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg), V = mode === 'air' ? 1.6 * def.params.gen.Vs : 0;
  if (V) for (let i = 0; i < sim.n; i++) { sim.v[i*3] = V * fx; sim.v[i*3+2] = V * fz; }
  sim.ctl.thr = mode === 'air' ? 0.75 : 0.3;
  for (let f = 0; f < 120; f++) sim.step(1 / 60);
  const ms = [];
  for (let f = 0; f < 600; f++) { const a = process.hrtime.bigint(); sim.step(1 / 60); ms.push(Number(process.hrtime.bigint() - a) / 1e6); }
  ms.sort((a, b) => a - b);
  console.log('PERF ' + JSON.stringify({ med: ms[300], p90: ms[540], mean: ms.reduce((a, b) => a + b, 0) / ms.length }));
  process.exit(0);
}

const L = require('./_treecrash_lib.js');
fs.mkdirSync(OUT, { recursive: true });
const PERF_ONLY = argv.includes('--perf-only');
// the palette (dataviz reference instance): before = slot 1 blue, now = slot 2 orange; bent = yellow, broken = red (+ dashes)
const COL = { before: '#2a78d6', now: '#eb6834', bent: '#c98500', broken: '#e34948', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', beam: '#8a8984', surf: '#fcfcfb' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svgDoc = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif"><title>${esc(title)}</title><rect width="${w}" height="${h}" fill="${COL.surf}"/>${body}</svg>`;

// a small line chart: series [{ label, color, dash, pts: [[x, y]] }], its own axes
function lineChart(x0, y0, w, h, title, series, xl, yl, o = {}) {
  const pts = series.flatMap(s => s.pts);
  const xmin = o.xmin ?? Math.min(...pts.map(p => p[0])), xmax = o.xmax ?? Math.max(...pts.map(p => p[0]));
  let ymin = o.ymin ?? Math.min(...pts.map(p => p[1])), ymax = o.ymax ?? Math.max(...pts.map(p => p[1]), o.hline != null ? o.hline + 0.5 : -Infinity);
  if (ymax - ymin < 1e-6) ymax = ymin + 1;
  const pl = 48, pr = 10, pt = 44, pb = 34, W = w - pl - pr, H = h - pt - pb;
  const X = x => x0 + pl + (x - xmin) / (xmax - xmin) * W, Y = y => y0 + pt + H - (y - ymin) / (ymax - ymin) * H;
  let s = `<text x="${x0 + pl}" y="${y0 + 16}" font-size="13" font-weight="bold" fill="${COL.ink}">${esc(title)}</text>`;
  const nice = (a, b, n) => { const st = Math.pow(10, Math.floor(Math.log10((b - a) / n))); const m = [1, 2, 5, 10].find(k => (b - a) / (st * k) <= n) * st; const r = []; for (let v = Math.ceil(a / m) * m; v <= b + 1e-9; v += m) r.push(+v.toFixed(6)); return r; };
  for (const v of nice(ymin, ymax, 5)) s += `<line x1="${x0 + pl}" x2="${x0 + pl + W}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.grid}"/><text x="${x0 + pl - 6}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="${COL.ink2}">${v}</text>`;
  for (const v of nice(xmin, xmax, 6)) s += `<text x="${X(v)}" y="${y0 + pt + H + 14}" font-size="10" text-anchor="middle" fill="${COL.ink2}">${v}</text>`;
  s += `<text x="${x0 + pl + W / 2}" y="${y0 + h - 4}" font-size="10" text-anchor="middle" fill="${COL.ink2}">${esc(xl)}</text>`;
  s += `<text x="${x0 + 12}" y="${y0 + pt + H / 2}" font-size="10" text-anchor="middle" fill="${COL.ink2}" transform="rotate(-90 ${x0 + 12} ${y0 + pt + H / 2})">${esc(yl)}</text>`;
  if (o.hline != null) s += `<line x1="${x0 + pl}" x2="${x0 + pl + W}" y1="${Y(o.hline)}" y2="${Y(o.hline)}" stroke="${COL.ink2}" stroke-dasharray="3 3"/><text x="${x0 + pl + W - 2}" y="${Y(o.hline) - 4}" font-size="10" text-anchor="end" fill="${COL.ink2}">${esc(o.hlineLabel || '')}</text>`;
  series.forEach((S, i) => {
    s += `<polyline fill="none" stroke="${S.color}" stroke-width="2" ${S.dash ? 'stroke-dasharray="' + S.dash + '"' : ''} points="${S.pts.map(p => X(p[0]).toFixed(1) + ',' + Y(Math.max(ymin, Math.min(ymax, p[1]))).toFixed(1)).join(' ')}"/>`;
    const lx = x0 + pl + i * 170, ly = y0 + 30;
    s += `<line x1="${lx}" x2="${lx + 18}" y1="${ly}" y2="${ly}" stroke="${S.color}" stroke-width="2" ${S.dash ? 'stroke-dasharray="' + S.dash + '"' : ''}/><text x="${lx + 22}" y="${ly + 4}" font-size="10" fill="${COL.ink}">${esc(S.label)}</text>`;
  });
  return s;
}

// the beams from above (the track along x, left up), from a recorded frame: grey whole, yellow bent / set, red dashed
// broken; the trunk. `view` [cx, cy, span] in the track's frame
function topdown(x0, y0, w, h, title, r, F, view, foot) {
  const F0 = r.frames[0], len = (F, i) => Math.hypot(F.beams[i][1][0] - F.beams[i][0][0], F.beams[i][1][1] - F.beams[i][0][1]);
  const sc = Math.min(w, h - 30) / view[2];
  const X = x => x0 + w / 2 + (x - view[0]) * sc, Y = y => y0 + 30 + (h - 30) / 2 - (y - view[1]) * sc;
  let s = `<text x="${x0 + 6}" y="${y0 + 16}" font-size="13" font-weight="bold" fill="${COL.ink}">${esc(title)}</text>`;
  s += `<circle cx="${X(r.trunk[0])}" cy="${Y(r.trunk[1])}" r="${Math.max(2, r.trunkR * sc)}" fill="#6b4f2a"/>`;
  const st = new Uint8Array(F.beams.length); for (const i of F.bent) st[i] = 1; for (const i of F.broken) st[i] = 2;
  const order = F.beams.map((b, i) => i).sort((a, b) => st[a] - st[b]);
  for (const bi of order) {
    if (st[bi] === 2 && len(F, bi) > 1.3 * len(F0, bi) + 0.05) continue;   // a broken member whose ends have parted: gone
    const [A, B] = F.beams[bi], c = st[bi] === 2 ? COL.broken : st[bi] === 1 ? COL.bent : COL.beam, wd = st[bi] ? 1.6 : 0.8;
    s += `<line x1="${X(A[0]).toFixed(1)}" y1="${Y(A[1]).toFixed(1)}" x2="${X(B[0]).toFixed(1)}" y2="${Y(B[1]).toFixed(1)}" stroke="${c}" stroke-width="${wd}" ${st[bi] === 2 ? 'stroke-dasharray="3 2"' : ''}/>`;
  }
  s += `<text x="${x0 + 6}" y="${y0 + h - 4}" font-size="10" fill="${COL.ink2}">${esc(foot)}</text>`;
  return s;
}
const legendTD = (x, y) => `<g font-size="11" fill="${COL.ink}"><line x1="${x}" x2="${x + 18}" y1="${y}" y2="${y}" stroke="${COL.beam}" stroke-width="1"/><text x="${x + 22}" y="${y + 4}">a member, whole</text>
  <line x1="${x + 140}" x2="${x + 158}" y1="${y}" y2="${y}" stroke="${COL.bent}" stroke-width="2"/><text x="${x + 162}" y="${y + 4}">bent / set (yielded)</text>
  <line x1="${x + 300}" x2="${x + 318}" y1="${y}" y2="${y}" stroke="${COL.broken}" stroke-width="2" stroke-dasharray="3 2"/><text x="${x + 322}" y="${y + 4}">broken</text>
  <circle cx="${x + 420}" cy="${y}" r="5" fill="#6b4f2a"/><text x="${x + 430}" y="${y + 4}">the trunk (r 0.3 m)</text></g>`;

const CASES = {
  taxi3: { label: 'a taxi at 3 m/s into the trunk, the throttle shut', o: { D: 4, V: 3, thr: 0, secs: 8 } },
  treehit: { label: 'GATE TREEHIT\'s taxi (full power, then a third)', o: { D: 60, thr: 1, rollThen: 0.35, secs: 14 } },
  fly30: { label: 'flown at 30 m/s, 4 m AGL, the trunk on the centreline', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 5 } },
  wing30: { label: 'flown at 30 m/s, the trunk 2.5 m out on the left wing', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 2.5 } },
};
const BUILDS = ['cub', 'metal'];
const runs = {};
if (!PERF_ONLY) for (const k of BUILDS) for (const c of Object.keys(CASES)) for (const el of [true, false]) {
  const r = L.atTrunk(k, Object.assign({ elastic: el, every: 3 }, CASES[c].o));
  runs[k + ':' + c + ':' + (el ? 'before' : 'now')] = r;
  console.log(k, c, el ? 'before' : 'now   ', 'reach', r.reach.toFixed(2), 'end', r.end.toFixed(2), 'back', (r.reach - r.end).toFixed(2), r.dmg.crashed ? 'CRASH ' + r.dmg.reason : '-', r.dmg.members + ' set ' + r.dmg.breaks + ' broken');
}
if (!PERF_ONLY) {
const summary = {};
for (const key of Object.keys(runs)) { const r = runs[key]; summary[key] = { reach: +r.reach.toFixed(3), end: +r.end.toFixed(3), back: +(r.reach - r.end).toFixed(3), crashed: r.dmg.crashed, reason: r.dmg.reason, members: r.dmg.members, breaks: r.dmg.breaks, brokenCls: r.dmg.brokenCls, work: +r.dmg.work.toFixed(1), gPeak: +r.dmg.gPeak.toFixed(2), prop: r.dmg.propStrike, keMaxOverKe0: +(r.keMax / r.ke0).toFixed(4), finite: r.finite }; }
fs.writeFileSync(path.join(OUT, 'runs.json'), JSON.stringify(summary, null, 1));

// trajectories.svg: 3 cases x 2 builds
{
  const w = 440, h = 230; let body = '';
  const cs = ['taxi3', 'treehit', 'fly30'];
  cs.forEach((c, row) => BUILDS.forEach((k, col) => {
    const lab = L.BUILDS[k].label, b = runs[k + ':' + c + ':before'], n = runs[k + ':' + c + ':now'];
    const D = CASES[c].o.D;
    body += lineChart(col * w, 40 + row * h, w, h, lab + ': ' + CASES[c].label.replace(/, the throttle shut|, 4 m AGL, the trunk on the centreline/, ''),
      [{ label: 'before (elastic: master)', color: COL.before, pts: b.trace.map(x => [x.t - b.trace[0].t, x.along]) },
       { label: 'now (yield, bend, break)', color: COL.now, pts: n.trace.map(x => [x.t - n.trace[0].t, x.along]) }],
      'seconds', 'CG along the track (m)', { hline: D, hlineLabel: 'the trunk' });
  }));
  const head = `<text x="10" y="24" font-size="15" font-weight="bold" fill="${COL.ink}">TREE-CRASH: the aeroplane's CG along its track, before and now - the springback is the line falling after its peak</text>`;
  fs.writeFileSync(path.join(OUT, 'trajectories.svg'), svgDoc(2 * w, 40 + cs.length * h, head + body, 'TREE-CRASH trajectories'));
}
// damage_time.svg: the 30 m/s flights (now): members set, broken, plastic work
{
  const w = 440, h = 230; let body = '';
  ['fly30', 'wing30'].forEach((c, row) => BUILDS.forEach((k, col) => {
    const n = runs[k + ':' + c + ':now'], t0 = n.trace[0].t, lab = L.BUILDS[k].label;
    const sub = n.trace.filter(x => x.t - t0 > 0.9 && x.t - t0 < 2.6);
    body += lineChart(col * w, 40 + row * h, w, h, lab + ': ' + (c === 'fly30' ? 'the centreline' : 'the wing 2.5 m out') + ' at 30 m/s',
      [{ label: 'members set (count)', color: COL.bent, pts: sub.map(x => [x.t - t0, x.members]) },
       { label: 'members broken (count)', color: COL.broken, dash: '4 2', pts: sub.map(x => [x.t - t0, x.breaks]) }],
      'seconds', 'members', { ymin: 0 });
    const kJ = (n.dmg.work / 1000).toFixed(1);
    body += `<text x="${col * w + 58}" y="${40 + row * h + h - 40}" font-size="10" fill="${COL.ink2}">plastic work at the end: ${kJ} kJ of the impact's ${(n.ke0 / 1000).toFixed(0)} kJ (kinetic + potential) · ${esc(n.dmg.reason || '')}</text>`;
  }));
  const head = `<text x="10" y="24" font-size="15" font-weight="bold" fill="${COL.ink}">TREE-CRASH: the damage against time (now) - the members that took a set and the members that broke</text>`;
  fs.writeFileSync(path.join(OUT, 'damage_time.svg'), svgDoc(2 * w, 40 + 2 * h, head + body, 'TREE-CRASH damage over time'));
}
// topdown_<case>.svg: per build, before and now 0.6 s after the impact (the view on the trunk), and now at the end (the
// view on the wreck)
for (const c of Object.keys(CASES)) {
  const w = 400, h = 380, D = CASES[c].o.D; let body = '';
  BUILDS.forEach((k, row) => {
    const rb = runs[k + ':' + c + ':before'], rn = runs[k + ':' + c + ':now'];
    const imp = (r => { const T = r.trace.find(x => x.along >= D - 3); return T ? T.t : r.trace[r.trace.length - 1].t; })(rb);
    const at = (r, t) => r.frames.reduce((a, F) => (Math.abs(F.t - t) < Math.abs(a.t - t) ? F : a), r.frames[0]);
    const span = c === 'taxi3' || c === 'treehit' ? 14 : 20, t0 = rb.trace[0].t - 1 / 60;
    const Fb = at(rb, imp + 0.6), Fn = at(rn, imp + 0.6), Fe = rn.frames[rn.frames.length - 1];
    // the wreck's middle: the median of the members' ends (a torn-off piece left behind does not drag it)
    const cen = F => { const xs = [], ys = []; for (const [A, B] of F.beams) { xs.push(A[0], B[0]); ys.push(A[1], B[1]); } xs.sort((a, b) => a - b); ys.sort((a, b) => a - b); return [xs[xs.length >> 1], ys[ys.length >> 1]]; };
    const near = (F, r) => { const c = cen(F); return Math.hypot(c[0] - r.trunk[0], c[1] - r.trunk[1]) < span / 3 ? [r.trunk[0], r.trunk[1], span] : [c[0], c[1], span]; };
    const ce = cen(Fe);
    const lab = L.BUILDS[k].label, dn = rn.dmg;
    body += topdown(0, 40 + row * h, w, h, lab + ' - before, ' + (Fb.t - t0).toFixed(1) + ' s', rb, Fb, [rb.trunk[0], rb.trunk[1], span], 'elastic (master): nothing yields');
    body += topdown(w, 40 + row * h, w, h, lab + ' - now, ' + (Fn.t - t0).toFixed(1) + ' s', rn, Fn, near(Fn, rn), Fn.bent.length + ' set, ' + Fn.broken.length + ' broken by then');
    body += topdown(2 * w, 40 + row * h, w, h, lab + ' - now, the end (' + (Fe.t - t0).toFixed(1) + ' s)', rn, Fe, [ce[0], ce[1], span],
      (dn.crashed ? 'CRASHED: ' + dn.reason : dn.members ? 'dented, no crash' : 'no set') + ' · ' + dn.members + ' set · ' + dn.breaks + ' broken · ' + (dn.work / 1000).toFixed(1) + ' kJ');
  });
  const head = `<text x="10" y="22" font-size="15" font-weight="bold" fill="${COL.ink}">TREE-CRASH: ${esc(CASES[c].label)} - the beams from above (a broken member is drawn while its ends are still together)</text>` + legendTD(10, 34);
  fs.writeFileSync(path.join(OUT, 'topdown_' + c + '.svg'), svgDoc(3 * w, 40 + 2 * h, head + body, 'TREE-CRASH top-down ' + c));
}
console.log('wrote', fs.readdirSync(OUT).join(', '));
}

// perf: master's core (--perf-base) against this one, alternating child processes, nothing touching
if (!argv.includes('--no-perf')) {
  const base = opt('perf-base', null), mine = path.join(__dirname, 'flight_core.js');
  const { spawnSync } = require('child_process');
  const one = (core, k, mode) => { const r = spawnSync(process.execPath, [__filename, '--perf-child', core, k, mode], { encoding: 'utf8' }); const l = (r.stdout || '').split('\n').find(x => x.startsWith('PERF ')); return l ? JSON.parse(l.slice(5)) : null; };
  const P = {};
  for (const k of BUILDS) for (const mode of ['ground', 'air']) {
    const rows = { base: [], mine: [] };
    for (let rep = 0; rep < 5; rep++) { if (base) rows.base.push(one(base, k, mode)); rows.mine.push(one(mine, k, mode)); }
    const med = a => { const v = a.filter(Boolean).map(x => x.med).sort((x, y) => x - y); return v.length ? v[v.length >> 1] : null; };
    P[k + ':' + mode] = { base: med(rows.base), mine: med(rows.mine), runs: rows };
    console.log('perf', k, mode, 'master', P[k + ':' + mode].base && P[k + ':' + mode].base.toFixed(3), 'ms, now', P[k + ':' + mode].mine.toFixed(3), 'ms (the median of 5 processes\' medians, 600 steps each)');
  }
  fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(P, null, 1));
}
