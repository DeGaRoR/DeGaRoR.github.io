#!/usr/bin/env node
// cowl_res_rig.js - THE EYE SHEET'S VARIANTS, MEASURED (G3713, COWL-RES)
//
//   node tools/cowl_res_rig.js [--builds a.json,b.json] [--variants 2,3,4] [--reps 3] [--json out.json]
//
// The user (26 Oct, their marked-up still from the C172's seat): the arch's silhouette against the runway shows
// straight facets and kinks - the windscreen base, where the glass panes meet the deck, which is the level-2 polygon.
// "It's in the construction of the plane, we need 3 levels rather than 2." This puts numbers on each eye variant
// (cageSheet's opts.eye: 2 the nose section, 3 the whole fuselage, 4 all but aft of the aft bulkhead) against the
// level-2 sheet, per build, with no browser:
//   BASE   the windscreen's base polygon (the glass faces' edges shared with the skin, forward half): its segment
//          length and the sharpest turn between neighbours - the silhouette the user marked
//   DECK   the skin forward of the windscreen base, upper half: edge length and the angle between neighbours
//   COST   the sheet's build ms (best of --reps), triangles and vertices
//   CLEAN  the open borders' total length (a crack would add to it) and the measured sheet unchanged (the level-2
//          build is the same call with no eye: its vertices hash the same before and after the eye builds ran)
//   COWL   _cowl_gen's top at its aft station: samples on the top and the longest chord, detail 1 and detail 2
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const BUILDS = opt('builds', ['cessna172_2026-09-20_corrected', 'cessna172_2026-09-20', 'cub_2026-09-20_corrected',
  'jodel_2026-09-20_corrected', 'rufus_2026-10-18_certified'].map(b => 'builds/' + b + '.json').join(',')).split(',');
const VARIANTS = opt('variants', '2,3,4').split(',').map(Number);
const REPS = +opt('reps', 3);
const G = require('./_cage_gen.js');

const pct = (a, q) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const f2 = x => isFinite(x) ? x.toFixed(2) : '-';
const key = (a, b) => a < b ? a + '_' + b : b + '_' + a;
const newell = (V, f) => {
  const n = [0, 0, 0], q = f.v.length;
  for (let i = 0; i < q; i++) {
    const a = V[f.v[i]], b = V[f.v[(i + 1) % q]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
};
const edgeFaces = (m, sel) => {
  const ER = new Map();
  m.F.forEach((f, fi) => {
    if (sel && !sel(f)) return;
    const q = f.v.length;
    for (let i = 0; i < q; i++) {
      const k = key(f.v[i], f.v[(i + 1) % q]);
      if (!ER.has(k)) ER.set(k, []);
      ER.get(k).push(fi);
    }
  });
  return ER;
};
// the skin forward of the windscreen base, upper half: facets
function deck(m, zN, unit) {
  const sel = f => (f.m === 'body' || f.m === 'pillarFront') && f.v.every(i => m.V[i][2] >= zN - 1e-6) && newell(m.V, f)[1] > 0.2;
  const ER = edgeFaces(m, sel), len = [], ang = [];
  for (const [k, fs2] of ER) {
    const [a, b] = k.split('_').map(Number);
    len.push(Math.hypot(...[0, 1, 2].map(i => m.V[a][i] - m.V[b][i])) * unit);
    if (fs2.length === 2) {
      const n0 = newell(m.V, m.F[fs2[0]]), n1 = newell(m.V, m.F[fs2[1]]);
      ang.push(Math.acos(Math.max(-1, Math.min(1, n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]))) * 180 / Math.PI);
    }
  }
  return { faces: m.F.filter(sel).length, len50: pct(len, 0.5), ang50: pct(ang, 0.5), ang90: pct(ang, 0.9) };
}
// the windscreen's base: edges of 'windshield' faces shared with a non-glass face, chained; the sharpest turn
function wsBase(m, unit) {
  const ER = edgeFaces(m, null), segs = [];
  for (const [k, fs2] of ER) {
    const ws = fs2.filter(fi => m.F[fi].m === 'windshield'), other = fs2.filter(fi => m.F[fi].m !== 'windshield' && !G.CAGE_GLASS_MATS.has(m.F[fi].m));
    if (ws.length && other.length) segs.push(k.split('_').map(Number));
  }
  if (!segs.length) return null;
  // the base, not the sides or the top: the segments in the lowest 30 % of the windscreen's height
  let y0 = Infinity, y1 = -Infinity;
  for (const [a, b] of segs) for (const i of [a, b]) { y0 = Math.min(y0, m.V[i][1]); y1 = Math.max(y1, m.V[i][1]); }
  const base = segs.filter(([a, b]) => Math.max(m.V[a][1], m.V[b][1]) <= y0 + 0.3 * (y1 - y0));
  const adj = new Map();
  for (const [a, b] of base) { for (const [p, q] of [[a, b], [b, a]]) { if (!adj.has(p)) adj.set(p, []); adj.get(p).push(q); } }
  const len = base.map(([a, b]) => Math.hypot(...[0, 1, 2].map(i => m.V[a][i] - m.V[b][i])) * unit);
  let turn = 0;
  for (const [v, ns] of adj) {
    if (ns.length !== 2) continue;
    const P = m.V[v], A = m.V[ns[0]], B = m.V[ns[1]];
    const u = [0, 1, 2].map(i => P[i] - A[i]), w = [0, 1, 2].map(i => B[i] - P[i]);
    const c = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / ((Math.hypot(...u) * Math.hypot(...w)) || 1);
    turn = Math.max(turn, Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI);
  }
  return { segs: base.length, len50: pct(len, 0.5), lenMax: Math.max(...len), turnMax: turn };
}
const openLen = m => {
  const c = new Map();
  for (const f of m.F) for (let i = 0; i < f.v.length; i++) {
    const a = f.v[i], b = f.v[(i + 1) % f.v.length], k = key(a, b);
    if (!c.has(k)) c.set(k, [a, b, 0]);
    c.get(k)[2]++;
  }
  let len = 0;
  for (const [a, b, q] of c.values()) if (q === 1) len += Math.hypot(...[0, 1, 2].map(i => m.V[a][i] - m.V[b][i]));
  return len;
};
const tris = m => m.F.reduce((s, f) => s + f.v.length - 2, 0);
const hashV = m => { let h = 0; for (const v of m.V) for (const x of v) h = (h * 31 + Math.round(x * 1e6)) | 0; return h; };
const best = fn => { let t = Infinity, r = null; for (let i = 0; i < REPS; i++) { const t0 = process.hrtime.bigint(); r = fn(); t = Math.min(t, Number(process.hrtime.bigint() - t0) / 1e6); } return [r, t]; };

// a fresh _cowl_gen with its sample array readable (the module keeps it private)
function cowlTop(cage, detail) {
  const file = path.join(__dirname, '_cowl_gen.js');
  const mod = new Module(file, module);
  mod.filename = file; mod.paths = Module._nodeModulePaths(__dirname);
  mod._compile(fs.readFileSync(file, 'utf8') + '\nmodule.exports.__AZ = () => AZ.slice();\n', file);
  const C = mod.exports;
  for (const k in cage) if (k.startsWith('cw_') && C.P[k.slice(3)] !== undefined && cage[k] != null) C.P[k.slice(3)] = cage[k];
  C.P.inheritStub = 0; C.P.detail = detail;
  C.prepareLid(); C.prepareMesh();
  const AZ = C.__AZ(), z = C.aftStart();
  let chord = 0, nTop = 0;
  const pts = AZ.map(th => C.surfPoint(th, z));
  for (let j = 0; j < AZ.length; j++) {
    const j1 = (j + 1) % AZ.length;
    if (!(Math.sin(AZ[j]) > 0.2 || Math.sin(AZ[j1]) > 0.2)) continue;
    nTop++;
    chord = Math.max(chord, Math.hypot(pts[j1][0] - pts[j][0], pts[j1][1] - pts[j][1]));
  }
  return { az: AZ.length, top: nTop, chordMax: chord };
}

const report = [];
for (const b of BUILDS) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, b), 'utf8'));
  const spec = raw.spec || raw;
  const P = G.cageFromSpec(spec);
  const unit = (G.CAGE_UNIT || 1) * (P.planeScale || 1);
  const [sh2, ms2] = best(() => G.cageSheet(P));
  const m2 = sh2.mesh, h0 = hashV(m2);
  const zn = G.cageBodyZones(sh2.spec).find(z => z.key === 'nose');
  const row = { build: path.basename(b), cowlOn: !!P.cowlOn, rows: [] };
  const line = (name, m, ms) => ({ name, ms, tris: tris(m), verts: m.V.length, open: openLen(m) * unit,
    base: wsBase(m, unit), deck: zn ? deck(m, zn.z0, unit) : null });
  row.rows.push(line('level 2', m2, ms2));
  for (const v of VARIANTS) {
    let r;
    try { const [shE, msE] = best(() => G.cageSheet(P, { eye: { variant: v } })); r = line('eye v' + v, shE.mesh, msE); }
    catch (e) { r = { name: 'eye v' + v, err: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }; }
    row.rows.push(r);
  }
  row.measuredSame = hashV(G.cageSheet(P).mesh) === h0;
  if (P.cowlOn) { row.cowl1 = cowlTop(P, 1); row.cowl2 = cowlTop(P, 2); }
  report.push(row);
}

let bad = 0;
for (const r of report) {
  console.log('== ' + r.build + (r.measuredSame ? '' : '   MEASURED SHEET CHANGED'));
  if (!r.measuredSame) bad++;
  const o0 = r.rows[0].open;
  for (const x of r.rows) {
    if (x.err) { console.log('  ' + x.name.padEnd(9) + ' THREW ' + x.err); bad++; continue; }
    const crack = Math.abs(x.open - o0) > 0.01 * o0 + 1e-6;
    if (crack) bad++;
    console.log('  ' + x.name.padEnd(9) + ' ' + String(Math.round(x.ms)).padStart(5) + ' ms  tris ' + String(x.tris).padStart(7) +
      (x.name === 'level 2' ? '         ' : ' (+' + String(x.tris - r.rows[0].tris).padStart(6) + ')') +
      '  base ' + (x.base ? x.base.segs + ' segs p50 ' + f2(x.base.len50 * 100) + ' cm max turn ' + f2(x.base.turnMax) + ' deg' : '-') +
      '  deck ' + (x.deck ? 'edge p50 ' + f2(x.deck.len50 * 100) + ' cm angle p50/p90 ' + f2(x.deck.ang50) + '/' + f2(x.deck.ang90) : '-') +
      '  open ' + f2(x.open) + ' m' + (crack ? '  OPEN LENGTH MOVED (crack?)' : ''));
  }
  if (r.cowl1) console.log('  cowl      detail 1: ' + r.cowl1.az + ' samples (' + r.cowl1.top + ' on the top), longest chord ' + f2(r.cowl1.chordMax * 100) +
    ' cm; detail 2: ' + r.cowl2.az + ' (' + r.cowl2.top + '), ' + f2(r.cowl2.chordMax * 100) + ' cm');
}
console.log(bad ? 'cowl_res_rig: NOT CLEAN (' + bad + ')' : 'cowl_res_rig: clean - the measured sheet unchanged, no variant threw or opened a border, on ' + report.length + ' builds');
if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify({ variants: VARIANTS, report }, null, 1));
process.exit(bad ? 1 : 0);
