#!/usr/bin/env node
// DMG-D3 CLUSTERS (G1840-G1843) - the evidence, reports/evidence/DMG-D3/ (node only, ~3 min):
//   loads_pulls.svg   each scripted pull of GATE DMGCLUSTERS: the cut's load over its break limit (bending, torque) against
//                     time, to the moment the part comes off
//   loads_water.svg   the twin floatplane's float nose-ins (90 km/h / 5 m/s / 20 deg, and the severe 150 / 10 / 60): the rod's
//                     root and station and the left float's root over their limits, per frame (the probe: nothing breaks)
//   view_<case>.svg   the beams after each part came off (a side view; the fin from behind): the part's own members, the
//                     broken ones, the rest
//   runs.json         the numbers
// Run: node tools/dmg_clusters_evidence.js
'use strict';
const path = require('path'), fs = require('fs');
const L = require('./_treecrash_lib.js');
const G = require('./_dmg_clusters_check.js');
const OUT = path.join(__dirname, '..', 'reports', 'evidence', 'DMG-D3');
fs.mkdirSync(OUT, { recursive: true });
const C = L.core();
// the palette (dataviz reference: slots 1-3 blue / orange / aqua, validated; red = broken, the TREE-CRASH evidence's)
const COL = { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', broken: '#e34948', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', beam: '#b5b4ae', surf: '#fcfcfb' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svgDoc = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif"><title>${esc(title)}</title><rect width="${w}" height="${h}" fill="${COL.surf}"/>${body}</svg>`;
const txt = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size || 11}" fill="${o.fill || COL.ink2}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.bold ? ' font-weight="bold"' : ''}>${esc(s)}</text>`;
// one panel: series [{lab, col, pts: [[t, y]]}], the limit at 1, an event time
function panel(x0, y0, w, h, title, series, tEv, yMax) {
  const tMax = Math.max(0.1, ...series.flatMap(s => s.pts.map(p => p[0])));
  const ym = yMax || Math.max(1.2, ...series.flatMap(s => s.pts.map(p => p[1]))) * 1.05;
  const X = t => x0 + 40 + (w - 120) * t / tMax, Y = y => y0 + h - 22 - (h - 48) * Math.min(y, ym) / ym;
  let b = txt(x0 + 4, y0 + 14, title, { size: 12, fill: COL.ink, bold: true });
  const step = ym > 6 ? 2 : ym > 3 ? 1 : 0.25;
  for (let v = 0; v <= ym; v += step) b += `<line x1="${X(0)}" x2="${X(tMax)}" y1="${Y(v)}" y2="${Y(v)}" stroke="${COL.grid}"/>` + txt(X(0) - 4, Y(v) + 4, v.toFixed(step < 1 ? 2 : 0), { anchor: 'end', size: 10 });
  for (let t = 0; t <= tMax + 1e-9; t += tMax > 3 ? 1 : 0.5) b += txt(X(t), y0 + h - 8, t.toFixed(tMax > 3 ? 0 : 1) + ' s', { anchor: 'middle', size: 10 });
  b += `<line x1="${X(0)}" x2="${X(tMax)}" y1="${Y(1)}" y2="${Y(1)}" stroke="${COL.ink}" stroke-dasharray="5 3"/>` + txt(X(tMax) + 4, Y(1) + 4, 'break limit', { size: 10, fill: COL.ink });
  if (tEv != null) b += `<line x1="${X(tEv)}" x2="${X(tEv)}" y1="${Y(0)}" y2="${Y(ym)}" stroke="${COL.broken}" stroke-dasharray="2 3"/>` + txt(X(tEv) - 3, y0 + 30, 'off', { anchor: 'end', size: 10, fill: COL.ink });
  for (const s of series) {
    if (!s.pts.length) continue;
    b += `<polyline fill="none" stroke="${s.col}" stroke-width="2" stroke-linejoin="round" points="${s.pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`;
    const e = s.pts.reduce((a, p) => (p[1] > a[1] ? p : a), s.pts[0]);
    b += txt(X(e[0]) + 4, Y(e[1]) - 4, s.lab + ' ' + e[1].toFixed(2), { size: 10, fill: COL.ink });
  }
  return b;
}
const legend = (x, y, items) => items.map((it, i) => `<line x1="${x + i * 170}" x2="${x + i * 170 + 18}" y1="${y}" y2="${y}" stroke="${it.col}" stroke-width="2"${it.dash ? ' stroke-dasharray="5 3"' : ''}/>` + txt(x + i * 170 + 24, y + 4, it.lab, { fill: COL.ink })).join('');

// ---- the pulls (GATE DMGCLUSTERS' rigs) ----
const runs = { pulls: [], water: [] };
function pullCase(k, lab, tag, kind, mk, view) {
  const def = L.defOf(k), sim = C.makeSim(def, null); sim.reset(0);
  const ct = G.findCut(sim, tag, kind), o = mk(def, sim, ct);
  if (!o.rate) {   // (GATE DMGCLUSTERS' ramp: the limit in ~3 s at the load's crude lever)
    const refN = ct.P, rc = [0, 1, 2].map(j => refN.reduce((a, i) => a + def.nodes[i].p[j], 0) / refN.length);
    const lev = i => Math.hypot(def.nodes[i].p[0] - rc[0], def.nodes[i].p[1] - rc[1], def.nodes[i].p[2] - rc[2]);
    let M = 0; if (o.body) for (const i of o.free) M += sim.m[i] * 9.81 * lev(i);
    o.rate = o.lim / Math.max(1e-9, M) / 3;
  }
  const r = G.pinPull(k, Object.assign({ watch: [[tag, kind]], part: ct.P }, o));
  const h = r.hist, ev = r.D.cl[0] || null;
  runs.pulls.push({ k, lab, tag, kind, ev, lim: { Mu: ct.Mu, Mv: ct.Mv, T: ct.T }, groups: r.D.groups.map(g => g.key), broken: r.D.breaks, rigid: r.rigid });
  // the beams at the end, the part's own members picked out
  const inP = new Set((ev && r.X.cuts.find(c => c.tag === ev.tag && c.kind === ev.cut) || ct).P);
  return { lab, k, ev, tEv: r.tEv, series: [
    { lab: 'bending', col: COL.s1, pts: h.filter(x => x.cuts[0]).map(x => [x.t, x.cuts[0].done ? null : x.cuts[0].rb]).filter(p => p[1] != null) },
    { lab: 'torque', col: COL.s2, pts: h.filter(x => x.cuts[0]).map(x => [x.t, x.cuts[0].done ? null : x.cuts[0].rt]).filter(p => p[1] != null) }],
    view: Object.assign({ sim: r.sim, def, inP, broken: new Set(r.D.broken), title: lab }, view) };
}
const ax = (i, j) => [i, j];   // which coordinates the view draws (0 x, 1 y, 2 z)
const cases = [];
const nd = (def, i) => def.nodes[i].p;
// the fins
for (const k of ['cub', 'jodel'])
  cases.push(pullCase(k, L.BUILDS[k].label + ': the fin pulled sideways', 'FIN', 'root', (def, sim, ct) => ({ free: new Set(ct.P), body: [0, 0, 1], lim: ct.Mu, secs: 12 }), { file: 'fin_' + k, ax: ax(2, 1), side: 'from behind' }));
// the twin's rod at its root, at its station, in twist
const twin = 'twinFloats';
cases.push(pullCase(twin, 'twin floatplane: the rod loaded down at its tail', 'ROD', 'root', (def, sim, ct) => ({ free: G.freeOf(def, ct), body: [0, -1, 0], lim: ct.Mu, secs: 12 }), { file: 'rod_root', ax: ax(0, 1), side: 'from the left' }));
cases.push(pullCase(twin, 'twin floatplane: the rod levered over an obstacle at its station', 'ROD', 'station', (def, sim, ct) => {
  const cd = def.clusters.find(q => q.tag === 'ROD'), k0 = cd.dmg.station, up = cd.rings[k0], dn = cd.rings[cd.rings.length - 1].concat(cd.nodes.filter(i => /^TP/.test(def.nodes[i].tag)));
  return { free: G.freeOf(def, G.findCut(sim, 'ROD', 'root')), loads: up.map(i => [i, [0, 1500 / up.length, 0]]).concat(dn.map(i => [i, [0, -1000 / dn.length, 0]])), rate: 1.2, secs: 12 };
}, { file: 'rod_station', ax: ax(0, 1), side: 'from the left' }));
cases.push(pullCase(twin, 'twin floatplane: the rod twisted (a torque on its last ring)', 'ROD', 'station', (def, sim, ct) => {
  const cd = def.clusters.find(q => q.tag === 'ROD'), ring = cd.rings[cd.rings.length - 1], a0 = nd(def, cd.dmg.ax[0]), a1 = nd(def, cd.dmg.ax[1]);
  const a = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], la = Math.hypot(...a); for (let j = 0; j < 3; j++) a[j] /= la;
  const cen = [0, 1, 2].map(j => ring.reduce((s, i) => s + nd(def, i)[j], 0) / ring.length);
  const loads = ring.map(i => { const r = [0, 1, 2].map(j => nd(def, i)[j] - cen[j]), d = r[0] * a[0] + r[1] * a[1] + r[2] * a[2]; for (let j = 0; j < 3; j++) r[j] -= d * a[j];
    const t = [a[1] * r[2] - a[2] * r[1], a[2] * r[0] - a[0] * r[2], a[0] * r[1] - a[1] * r[0]], r2 = r[0] ** 2 + r[1] ** 2 + r[2] ** 2; return [i, t.map(x => 1000 * x / r2 / ring.length)]; });
  return { free: G.freeOf(def, G.findCut(sim, 'ROD', 'root')), loads, rate: 1, secs: 12 };
}, { file: 'rod_twist', ax: ax(0, 1), side: 'from the left' }));
// a float dug in (its attachment's own members let go: the struts' fittings)
cases.push(pullCase(twin, 'twin floatplane: the left float dug in', 'FLTL', 'root', (def, sim, ct) => {
  const cd = def.clusters.find(q => q.tag === 'FLTL'), bow = cd.dmg.ax[0], st = cd.dmg.ax[1], a = [nd(def, st)[0] - nd(def, bow)[0], 0, nd(def, st)[2] - nd(def, bow)[2]], la = Math.hypot(...a);
  return { free: new Set(ct.P), loads: [[bow, [1000 * a[0] / la, 1000, 1000 * a[2] / la]]], rate: 40, secs: 12 };
}, { file: 'float', ax: ax(0, 1), side: 'from the left' }));
// the twin-boom FIXTURE (not a validated build): its left boom levered at its station
L.BUILDS.twinBoom = { label: 'twin boom (fixture)', build: 'tools/fixtures/build_v8_twin-boom_2026-09-11.json' };
cases.push(pullCase('twinBoom', 'twin-boom FIXTURE: the left boom levered at its station', 'BML', 'station', (def, sim, ct) => {
  const cd = def.clusters.find(q => q.tag === 'BML'), k0 = cd.dmg.station, up = cd.rings[k0], dn = cd.rings[cd.rings.length - 1];
  const rootCuts = sim.clusterCuts().cuts.filter(q => q.kind === 'root' && q.cls === 'boom');
  return { free: G.freeOf(def, G.findCut(sim, 'BML', 'root'), rootCuts.flatMap(q => q.X)), loads: up.map(i => [i, [0, 1500 / up.length, 0]]).concat(dn.map(i => [i, [0, -1000 / dn.length, 0]])), rate: 3, secs: 12 };
}, { file: 'boom_station', ax: ax(0, 1), side: 'from the left' }));

{
  const W = 520, H = 210, cols = 2, rows = Math.ceil(cases.length / cols);
  let b = txt(10, 22, 'DMG-D3: each part pulled until its root gives - the cut\'s load over its break limit', { size: 15, fill: COL.ink, bold: true })
    + legend(10, 44, [{ lab: 'bending (both axes)', col: COL.s1 }, { lab: 'torque', col: COL.s2 }, { lab: 'break limit', col: COL.ink, dash: true }]);
  cases.forEach((c, i) => { b += panel(10 + (i % cols) * W, 60 + Math.floor(i / cols) * H, W - 10, H - 10, c.lab + (c.ev ? ' (off by ' + c.ev.why + ', ' + c.ev.cut + ')' : ''), c.series, c.tEv); });
  fs.writeFileSync(path.join(OUT, 'loads_pulls.svg'), svgDoc(cols * W + 20, 70 + rows * H, b, 'DMG-D3 loads in the pulls'));
}
// the views
function view(v) {
  const { sim, def, inP, broken } = v, [a, c] = v.ax, sg = a === 2 ? 1 : -1;   // (nose at -x: the side view flips x so the nose is left... kept as built: x aft to the right)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < sim.n; i++) { const X = sim.p[i*3+a], Y = sim.p[i*3+c]; if (!Number.isFinite(X + Y)) continue; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
  const W = 900, H = 520, s = Math.min((W - 40) / (x1 - x0 || 1), (H - 90) / (y1 - y0 || 1));
  const PX = X => 20 + (X - x0) * s, PY = Y => H - 20 - (Y - y0) * s;
  let b = txt(10, 22, v.title + ' - the beams ' + v.side + ', 0.5 s after the part came off', { size: 14, fill: COL.ink, bold: true })
    + legend(10, 44, [{ lab: 'the part that came off', col: COL.s1 }, { lab: 'broken', col: COL.broken }, { lab: 'the rest', col: COL.beam }]);
  const draw = (pred, col, wd) => { for (let bi = 0; bi < sim.beams.length; bi++) { const m = sim.beams[bi]; if (!pred(bi, m)) continue;
    b += `<line x1="${PX(sim.p[m.a*3+a]).toFixed(1)}" y1="${PY(sim.p[m.a*3+c]).toFixed(1)}" x2="${PX(sim.p[m.b*3+a]).toFixed(1)}" y2="${PY(sim.p[m.b*3+c]).toFixed(1)}" stroke="${col}" stroke-width="${wd}"/>`; } };
  draw((bi, m) => !broken.has(bi) && !(inP.has(m.a) && inP.has(m.b)), COL.beam, 1);
  draw((bi, m) => !broken.has(bi) && inP.has(m.a) && inP.has(m.b), COL.s1, 1.6);
  draw(bi => broken.has(bi), COL.broken, 1.6);
  void sg;
  fs.writeFileSync(path.join(OUT, 'view_' + v.file + '.svg'), svgDoc(W, H, b, 'DMG-D3 ' + v.title));
}
for (const c of cases) view(c.view);

// ---- the water: the twin's nose-ins under the probe, per frame ----
const wcase = (lab, o) => {
  const mk = C.makeSim, rec = [];
  C.makeSim = (d, w) => { const s = mk(d, w); const st = s.step; s.step = (dt, sub) => { st(dt, sub); const X = s.clusterCuts(), f = t => X.cuts.find(c => c.tag + '/' + c.kind === t);
    rec.push({ t: s.t, root: Math.max(f('ROD/root').rb, f('ROD/root').rt), station: Math.max(f('ROD/station').rb, f('ROD/station').rt), flt: Math.max(f('FLTL/root').rb, f('FLTL/root').rt) }); }; return s; };
  L.waterCase(twin, Object.assign({ secs: 3, probe: true }, o));
  C.makeSim = mk;
  const t0 = rec[0].t;
  runs.water.push({ lab, peak: { root: Math.max(...rec.map(r => r.root)), station: Math.max(...rec.map(r => r.station)), flt: Math.max(...rec.map(r => r.flt)) } });
  return { lab, series: [{ lab: 'rod root', col: COL.s1, pts: rec.map(r => [r.t - t0, r.root]) }, { lab: 'rod station', col: COL.s2, pts: rec.map(r => [r.t - t0, r.station]) },
                         { lab: 'left float root', col: COL.s3, pts: rec.map(r => [r.t - t0, r.flt]) }] };
};
{
  const ws = [wcase('the float nose-in: 90 km/h, 5 m/s, 20 deg', { V: 90 / 3.6, sink: 5, pitch: 20 }), wcase('SEVERE: 150 km/h, 10 m/s, 60 deg', { V: 150 / 3.6, sink: 10, pitch: 60 })];
  let b = txt(10, 22, 'DMG-D3: the twin floatplane\'s nose-ins - each cut\'s load over its break limit, per frame (the probe: nothing breaks)', { size: 15, fill: COL.ink, bold: true })
    + legend(10, 44, [{ lab: 'rod root', col: COL.s1 }, { lab: 'rod station', col: COL.s2 }, { lab: 'left float root', col: COL.s3 }, { lab: 'break limit', col: COL.ink, dash: true }]);
  ws.forEach((w, i) => { b += panel(10, 60 + i * 260, 1020, 250, w.lab, w.series, null); });
  fs.writeFileSync(path.join(OUT, 'loads_water.svg'), svgDoc(1040, 590, b, 'DMG-D3 loads in the water'));
}
fs.writeFileSync(path.join(OUT, 'runs.json'), JSON.stringify(runs, null, 1));
console.log('wrote', fs.readdirSync(OUT).join(', '));
for (const p of runs.pulls) console.log(p.lab, p.ev ? p.ev.tag + ' ' + p.ev.cut + ' by ' + p.ev.why + ' at ' + p.ev.t.toFixed(2) : 'nothing', 'groups', p.groups.join(' '), 'rigid', JSON.stringify(p.rigid));
for (const w of runs.water) console.log(w.lab, JSON.stringify(w.peak));
