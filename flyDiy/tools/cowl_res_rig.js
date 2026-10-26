#!/usr/bin/env node
// cowl_res_rig.js - THE NOSE DECK AND THE COWL'S TOP, MEASURED AGAINST THE DASH (G3712, COWL-RES)
//
//   node tools/cowl_res_rig.js [--builds a.json,b.json] [--arc 0.016] [--edge 0.016 | --k 4] [--json out.json]
//
// The user (25 Oct): the top arch of the cowl and nose "do not hold up" from the cockpit while the dash beside them
// is smooth. This puts numbers on it, per validated build, with no browser:
//   DASH   the dash's own faces (dash, dashFace): edge length and the angle between neighbouring faces - the target
//   DECK   the fuselage skin forward of the windscreen base, upper half: the same two numbers, the sheet as drawn
//          today and after cageEyeRefine (G3710), plus what the pass costs (ms, triangles, vertices) and that it
//          is clean (no vertex of the sheet moved; the open borders' total length unchanged = a border is split
//          straight, nothing opened = no crack)
//   COWL   _cowl_gen's top arch at its aft station (the part nearest the eye): the longest chord and the turn
//          between chords on the upper half, today's samples and with prepareMesh's eyeArc (G3711)
// One process, the cage in node (cageSheet = the page's own sheet); the cowl section from the build's cw_ rows
// (the fitted firewall size is the page's - the build's rows are close enough for a density number).
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const BUILDS = opt('builds', ['cessna172_2026-09-20_corrected', 'cessna172_2026-09-20', 'cub_2026-09-20_corrected',
  'jodel_2026-09-20_corrected', 'rufus_2026-10-18_certified'].map(b => 'builds/' + b + '.json').join(',')).split(',');
const ARC = +opt('arc', 0.016);
const K = +opt('k', 4);
const EDGE = opt('k', null) ? 0 : +opt('edge', 0.016);   // metres, the page's default
const G = require('./_cage_gen.js');

const pct = (a, q) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const f2 = x => isFinite(x) ? x.toFixed(2) : '-';
const newell = (V, f) => {
  const n = [0, 0, 0], q = f.v.length;
  for (let i = 0; i < q; i++) {
    const a = V[f.v[i]], b = V[f.v[(i + 1) % q]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
};
// edges whose faces all pass `sel`: length (m) and the angle between the two faces (deg)
function facets(m, sel, unit) {
  const ER = new Map();
  m.F.forEach((f, fi) => {
    if (!sel(f, fi)) return;
    const q = f.v.length;
    for (let i = 0; i < q; i++) {
      const a = f.v[i], b = f.v[(i + 1) % q], k = a < b ? a + '_' + b : b + '_' + a;
      if (!ER.has(k)) ER.set(k, { a, b, f: [] });
      ER.get(k).f.push(fi);
    }
  });
  const len = [], ang = [];
  for (const e of ER.values()) {
    const A = m.V[e.a], B = m.V[e.b];
    len.push(Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) * unit);
    if (e.f.length === 2) {
      const n0 = newell(m.V, m.F[e.f[0]]), n1 = newell(m.V, m.F[e.f[1]]);
      ang.push(Math.acos(Math.max(-1, Math.min(1, n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]))) * 180 / Math.PI);
    }
  }
  return { faces: m.F.filter(sel).length, len50: pct(len, 0.5), len90: pct(len, 0.9), ang50: pct(ang, 0.5), ang90: pct(ang, 0.9), angMax: ang.length ? Math.max(...ang) : NaN };
}
const openEdges = m => {              // [count, total length]
  const c = new Map();
  for (const f of m.F) for (let i = 0; i < f.v.length; i++) {
    const a = f.v[i], b = f.v[(i + 1) % f.v.length], k = a < b ? a + '_' + b : b + '_' + a;
    if (!c.has(k)) c.set(k, [a, b, 0]);
    c.get(k)[2]++;
  }
  let n = 0, len = 0;
  for (const [a, b, q] of c.values()) if (q === 1) { n++; len += Math.hypot(m.V[a][0] - m.V[b][0], m.V[a][1] - m.V[b][1], m.V[a][2] - m.V[b][2]); }
  return [n, len];
};
const tris = m => m.F.reduce((s, f) => s + f.v.length - 2, 0);

// a fresh _cowl_gen per build, with its sample array readable (the module keeps it private)
function cowlGen() {
  const file = path.join(__dirname, '_cowl_gen.js');
  const mod = new Module(file, module);
  mod.filename = file; mod.paths = Module._nodeModulePaths(__dirname);
  mod._compile(fs.readFileSync(file, 'utf8') + '\nmodule.exports.__AZ = () => AZ.slice();\n', file);
  return mod.exports;
}
function cowlTop(cage, eyeArc) {
  const C = cowlGen();
  for (const k in cage) if (k.startsWith('cw_') && C.P[k.slice(3)] !== undefined && cage[k] != null) C.P[k.slice(3)] = cage[k];
  C.P.inheritStub = 0;
  C.prepareLid();
  C.prepareMesh(eyeArc ? { eyeArc } : undefined);
  const AZ = C.__AZ(), z = C.aftStart(), out = [];
  let chord = 0, turn = 0, nTop = 0;
  const pts = AZ.map(th => C.surfPoint(th, z));
  for (let j = 0; j < AZ.length; j++) {
    const j1 = (j + 1) % AZ.length, j2 = (j + 2) % AZ.length;
    const tm = AZ[j] + (((AZ[j1] - AZ[j]) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / 2;
    if (!(Math.sin(tm) > 0.2)) continue;
    nTop++;
    const a = pts[j], b = pts[j1], c = pts[j2];
    chord = Math.max(chord, Math.hypot(b[0] - a[0], b[1] - a[1]));
    const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]), t2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = Math.abs(t2 - t1); if (d > Math.PI) d = 2 * Math.PI - d;
    turn = Math.max(turn, d * 180 / Math.PI);
  }
  return { az: AZ.length, top: nTop, chordMax: chord, turnMax: turn };
}

const report = [];
for (const b of BUILDS) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, b), 'utf8'));
  const spec = raw.spec || raw;
  const P = G.cageFromSpec(spec);
  const t0 = Date.now();
  const sheet = G.cageSheet(P);
  const tSheet = Date.now() - t0;
  const m = sheet.mesh, unit = (G.CAGE_UNIT || 1) * (P.planeScale || 1);
  const zones = G.cageBodyZones(sheet.spec), zn = zones.find(z => z.key === 'nose');
  const row = { build: path.basename(b), cowlLoops: P.cowlLoops, cowlOn: P.cowlOn, sheetMs: tSheet };
  row.dash = facets(m, f => f.m === 'dash' || f.m === 'dashFace', unit);
  if (!zn) { row.deck = null; report.push(row); continue; }
  const ro = EDGE ? { zNose: zn.z0, edge: EDGE / unit } : { zNose: zn.z0, k: K };
  const r = G.cageEyeRefine(m, ro);
  // the deck as the pass picks it, before and after: the faces it split (before) and their children (after)
  const nS = r.nSheet || m.V.length;
  const deckSel = mm => (f) => ['body', 'pillarFront'].includes(f.m) && f.v.length === 4 && f.v.every(i => mm.V[i][2] >= zn.z0 - 1e-6)
    && newell(mm.V, f)[1] > 0.2;
  row.deckBefore = facets(m, deckSel(m), unit);
  row.deckAfter = r === m ? null : facets(r, deckSel(r), unit);
  // the cost and the cleanliness
  const N = 30, t1 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) G.cageEyeRefine(m, ro);
  row.refineMs = Number(process.hrtime.bigint() - t1) / 1e6 / N;
  row.trisBefore = tris(m); row.trisAfter = tris(r); row.vertsAdded = r.V.length - m.V.length;
  let moved = 0; for (let i = 0; i < nS; i++) if (r.V[i] !== m.V[i]) moved++;
  row.sheetVertsMoved = moved;
  const o0 = openEdges(m), o1 = openEdges(r);
  row.openBefore = o0[0]; row.openAfter = o1[0]; row.openLenDelta = Math.abs(o1[1] - o0[1]);
  row.fieldPure = !m.A || r.V.length === (r.A || []).length;
  row.cowlBefore = P.cowlOn ? cowlTop(P, 0) : null;
  row.cowlAfter = P.cowlOn ? cowlTop(P, ARC) : null;
  report.push(row);
}

for (const r of report) {
  console.log('== ' + r.build + '  (front rings ' + r.cowlLoops + ', cowl ' + (r.cowlOn ? 'on' : 'off') + ', sheet ' + r.sheetMs + ' ms)');
  const line = (k, s) => s && console.log('  ' + k.padEnd(12) + 'faces ' + String(s.faces).padStart(5) + '  edge p50/p90 ' + f2(s.len50 * 100) + '/' + f2(s.len90 * 100) + ' cm' + '  angle p50/p90/max ' + f2(s.ang50) + '/' + f2(s.ang90) + '/' + f2(s.angMax) + ' deg');
  line('dash', r.dash); line('deck now', r.deckBefore); line('deck after', r.deckAfter);
  if (r.refineMs != null) console.log('  pass ' + r.refineMs.toFixed(2) + ' ms, tris ' + r.trisBefore + ' -> ' + r.trisAfter + ' (+' + (r.trisAfter - r.trisBefore) + '), +' + r.vertsAdded + ' verts; sheet verts moved ' + r.sheetVertsMoved + ', open edges ' + r.openBefore + ' -> ' + r.openAfter + ' (length +' + (r.openLenDelta || 0).toExponential(1) + ')' + (r.fieldPure ? '' : ', FIELD SHORT'));
  const cl = (k, c) => c && console.log('  ' + k.padEnd(12) + 'samples ' + c.az + ' (' + c.top + ' on the top)  longest chord ' + f2(c.chordMax * 100) + ' cm  turn max ' + f2(c.turnMax) + ' deg');
  cl('cowl now', r.cowlBefore); cl('cowl after', r.cowlAfter);
}
const bad = report.filter(r => r.sheetVertsMoved || r.openLenDelta > 1e-6 || r.fieldPure === false);
console.log(bad.length ? 'cowl_res_rig: NOT CLEAN on ' + bad.map(r => r.build).join(', ') : 'cowl_res_rig: clean (no sheet vertex moved, no border opened, the field aligned) on ' + report.length + ' builds');
if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify({ arc: ARC, k: K, edge: EDGE, report }, null, 1));
process.exit(bad.length ? 1 : 0);
