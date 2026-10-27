#!/usr/bin/env node
// alloy_sec_census.js - DMG-LOOKS, ALLOY SECTIONS (27 Oct, PROTOTYPE ONLY): what the metal Cessna's formers and stringers
// ARE as drawn, which physics members they lie on, and what the standard crashes do to those members. Node only.
//   1. THE DRAWN SECTIONS: the flown snapshot's 'aluminium' group (tools/_dmg_wall_study.js prepare: the cage sheet and the
//      join, headless, in the design frame), split into its pieces (triangles joined by shared corners, welded at 0.5 mm);
//      each piece's axis (PCA), length, and its cross-section measured at mid-length (the corners of the slice, in the
//      plane across the axis) - an ANGLE (tools/_cage_gen.js metalAngle: two 5 mm prisms, an L of 6 corners) or a
//      PUNCHED web (punched(): a stamped web between an outer and an inner rail, every other bay a lightening hole).
//   2. THE MEMBERS: every physics member (def.beams, mat 'alloy', not gear) against the pieces: a member DRAWN as an alloy
//      section where a piece lies along it (its axis within 20 deg, its points within 6 cm of the member's line over 50 %
//      of the member's length).
//   3. THE CRASHES (tools/_dmg_scar_lib.js cases: the 30 m/s trunks, the 4 m/s nose-over): at the
//      end, the alloy members broken, buckled (set < -1 %, DEFORM's SET_MIN) - all of them, and those drawn as a section:
//      the alloy pool's slot need.
// Run: node futureDesigns/dmg-looks/alloy_sections/alloy_sec_census.js [--out alloy_sec_census.json]
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..', '..'), T = path.join(ROOT, 'tools');
const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : path.join(__dirname, 'alloy_sec_census.json');
const WS = require(path.join(T, '_dmg_wall_study.js')), S = require(path.join(T, '_dmg_scar_lib.js'));
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
const k = 'metal';
const t0 = Date.now(), P0 = WS.prepare(k), def = P0.def, rest = P0.rest;
const G = P0.groups.filter(g => g.sec === 'aluminium');
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// ---- 1. the pieces ----
const pieces = [];
for (const g of G) {
  const nv = g.nv, B = g.bD, key = new Map(), wid = new Int32Array(nv);
  for (let v = 0; v < nv; v++) { const q = Math.round(B[v * 3] / 5e-4) + ',' + Math.round(B[v * 3 + 1] / 5e-4) + ',' + Math.round(B[v * 3 + 2] / 5e-4);
    let w = key.get(q); if (w == null) key.set(q, w = key.size); wid[v] = w; }
  const par = new Int32Array(key.size).map((_, i) => i), f = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  for (let t = 0; t < g.idx.length; t += 3) { const a = f(wid[g.idx[t]]), b = f(wid[g.idx[t + 1]]), c = f(wid[g.idx[t + 2]]); par[b] = a; par[f(c)] = a; }
  const by = new Map();
  for (let t = 0; t < g.idx.length; t += 3) { const r = f(wid[g.idx[t]]); let P = by.get(r); if (!P) by.set(r, P = { tris: 0, vs: new Set() }); P.tris++; for (let j = 0; j < 3; j++) P.vs.add(g.idx[t + j]); }
  for (const P of by.values()) {
    const pts = [...P.vs].map(v => [B[v * 3], B[v * 3 + 1], B[v * 3 + 2]]);
    const c = [0, 0, 0]; for (const p of pts) for (let j = 0; j < 3; j++) c[j] += p[j] / pts.length;
    // the axis: power iteration on the covariance
    const C = [0, 0, 0, 0, 0, 0, 0, 0, 0]; for (const p of pts) { const d = sub(p, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] += d[i] * d[j]; }
    let ax = [1, 0.3, 0.1]; for (let it = 0; it < 60; it++) ax = nrm([C[0] * ax[0] + C[1] * ax[1] + C[2] * ax[2], C[3] * ax[0] + C[4] * ax[1] + C[5] * ax[2], C[6] * ax[0] + C[7] * ax[1] + C[8] * ax[2]]);
    let lo = Infinity, hi = -Infinity; for (const p of pts) { const s = dot(sub(p, c), ax); lo = Math.min(lo, s); hi = Math.max(hi, s); }
    // straightness: the largest distance off the axis line, and the slice at mid-length (the corners within 1 mm of it)
    let off = 0; for (const p of pts) { const d = sub(p, c), s = dot(d, ax); off = Math.max(off, Math.hypot(d[0] - s * ax[0], d[1] - s * ax[1], d[2] - s * ax[2])); }
    const e1 = nrm(cross(ax, Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), e2 = cross(ax, e1);
    const ends = pts.filter(p => dot(sub(p, c), ax) < lo + 1e-3).map(p => { const d = sub(p, c); return [+dot(d, e1).toFixed(4), +dot(d, e2).toFixed(4)]; });
    const uniq = []; for (const q of ends) if (!uniq.some(u => Math.hypot(u[0] - q[0], u[1] - q[1]) < 5e-4)) uniq.push(q);
    let w1 = 0, w2 = 0; if (uniq.length) { const xs = uniq.map(q => q[0]), ys = uniq.map(q => q[1]); w1 = Math.max(...xs) - Math.min(...xs); w2 = Math.max(...ys) - Math.min(...ys); }
    pieces.push({ tris: P.tris, nv: pts.length, c, ax, len: hi - lo, off, endCorners: uniq.length, w: [w1, w2].sort((a, b) => b - a), pts });
  }
}
const kindOf = p => (p.off < 0.04 && p.len > 0.05 ? (p.endCorners <= 8 ? 'angle' : 'straight-other') : 'curved/punched');
const hist = {}; for (const p of pieces) { const kk = kindOf(p); const h = hist[kk] || (hist[kk] = { n: 0, tris: 0, len: 0, corners: {}, w: [] }); h.n++; h.tris += p.tris; h.len += p.len; h.corners[p.endCorners] = (h.corners[p.endCorners] || 0) + 1; if (h.w.length < 400) h.w.push(p.w); }
// ---- 2. the members ----
const alloy = []; def.beams.forEach((b, bi) => { if (b.mat === 'alloy' && b.cls !== 'gear' && b.cls !== 'wire') alloy.push(bi); });
const drawnBy = new Map();   // bi -> { piece kinds, coverage }
const segPt = (p, a, b) => { const ab = sub(b, a), L2 = dot(ab, ab) || 1e-12; let t = dot(sub(p, a), ab) / L2; t = Math.max(0, Math.min(1, t)); const q = [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]]; return { d: Math.hypot(...sub(p, q)), t }; };
for (const bi of alloy) {
  const b = def.beams[bi], A = [rest[b.a * 3], rest[b.a * 3 + 1], rest[b.a * 3 + 2]], Bp = [rest[b.b * 3], rest[b.b * 3 + 1], rest[b.b * 3 + 2]], u = nrm(sub(Bp, A));
  const bins = new Uint8Array(20), kinds = new Set();
  for (const p of pieces) {
    if (kindOf(p) === 'curved/punched') { /* a ring: tested point by point below */ } else if (Math.abs(dot(p.ax, u)) < Math.cos(20 * Math.PI / 180)) continue;
    let hit = 0;
    for (const q of p.pts) { const s = segPt(q, A, Bp); if (s.d < 0.06) { bins[Math.min(19, Math.floor(s.t * 20))] = 1; hit++; } }
    if (hit > 3) kinds.add(kindOf(p));
  }
  const cov = bins.reduce((a, x) => a + x, 0) / 20;
  if (cov >= 0.5) drawnBy.set(bi, { cov, kinds: [...kinds] });
}
const byCls = {}; for (const bi of alloy) { const c = def.beams[bi].cls; const h = byCls[c] || (byCls[c] = { members: 0, drawn: 0 }); h.members++; if (drawnBy.has(bi)) h.drawn++; }
const out = { build: k, prepMs: Date.now() - t0, aluminiumGroups: G.length, pieces: pieces.length, kinds: Object.fromEntries(Object.entries(hist).map(([kk, h]) => [kk, { n: h.n, tris: h.tris, len: +h.len.toFixed(2), endCorners: h.corners, wSample: h.w.slice(0, 12).map(w => w.map(x => +x.toFixed(4))) }])),
  members: { alloy: alloy.length, byCls, drawnFus: [...drawnBy.keys()].filter(bi => def.beams[bi].cls === 'fus').length }, crashes: {} };
// ---- 3. the crashes ----
for (const id of ['fly0', 'fly25', 'noseover']) {
  const c = S.CASES.find(x => x.id === id), r = S.runCase(k, c, {}), sim = r.sim, D = sim.damage(), br = new Set(D.broken || []);
  const st = SH.simDmgSets(sim), set = new Map(); for (let i = 0; i < st.length; i += 2) set.set(st[i], st[i + 1]);
  const row = { broken: 0, buckled: 0, drawnBroken: 0, drawnBuckled: 0, fusBroken: 0, fusDrawnBroken: 0 };
  for (const bi of alloy) { const isB = br.has(bi), isK = !isB && (set.get(bi) || 0) < -0.01, dr = drawnBy.has(bi), fus = def.beams[bi].cls === 'fus';
    if (isB) { row.broken++; if (dr) row.drawnBroken++; if (fus) { row.fusBroken++; if (dr) row.fusDrawnBroken++; } }
    if (isK) { row.buckled++; if (dr) row.drawnBuckled++; } }
  row.slots = row.drawnBroken + row.drawnBuckled; out.crashes[id] = row;
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
