#!/usr/bin/env node
// poseback_plot.js - THE EVIDENCE PLOT FOR POSE-BACK (G1532): two traces of GATE POSEBACK (--trace) as one SVG.
//   node tools/poseback_plot.js <old.csv> <new.csv> <out.svg> [title]
// Panel A: the drawn CG's move along the motion, frame by frame (m; below 0 = drawn BACKWARD).
// Panel B: a zoom on the worst one - the drawn CG's distance along the motion (m, from the window's first frame)
// against the page's time: the old clock steps back, the fix holds and goes on.
// Every frame a marker with a hover title (the frame's page time, sim time, move); the take-off marked.
'use strict';
const fs = require('fs');
const [OLD, NEW, OUT, TITLE] = process.argv.slice(2);
const read = f => { const L = fs.readFileSync(f, 'utf8').trim().split('\n'); const h = L[0].split(','); return L.slice(1).map(l => { const v = l.split(',').map(Number); const o = {}; h.forEach((k, i) => { o[k] = v[i]; }); return o; }); };
const A = read(OLD), B = read(NEW);
const C = { old: '#eb6834', new: '#2a78d6', ink: '#1a1a19', ink2: '#5f5e58', grid: '#e4e3dc', surf: '#ffffff' };
const W = 1040, PL = 70, PR = 210, PW = W - PL - PR, H1 = 260, H2 = 220, TOP = 96, GAP = 70, H = TOP + H1 + GAP + H2 + 56;
const t0 = Math.min(A[0].T_ms, B[0].T_ms), tx = r => (r.T_ms - t0) / 1000;
const xMax = Math.max(tx(A[A.length - 1]), tx(B[B.length - 1]));
const X = x => PL + (x / xMax) * PW;
const take = rs => { for (let i = 1; i < rs.length; i++) if (rs[i - 1].wheels > 0 && rs[i].wheels === 0) return tx(rs[i]); return null; };
const ds = rs => rs.slice(1).map(r => ({ x: tx(r), y: r.ds_mm / 1000, r }));
const dA = ds(A), dB = ds(B);
const yMin = Math.min(-0.2, ...dA.map(p => p.y), ...dB.map(p => p.y)), yMax = Math.max(...dA.map(p => p.y), ...dB.map(p => p.y)) * 1.05;
const Y1 = y => TOP + H1 - ((y - yMin) / (yMax - yMin)) * H1;
const top2 = TOP + H1 + GAP;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const o = [];
o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">`);
o.push(`<rect width="${W}" height="${H}" fill="${C.surf}"/>`);
o.push(`<text x="${PL}" y="28" font-size="17" font-weight="600" fill="${C.ink}">${esc(TITLE || 'POSE-BACK: the drawn aeroplane through a take-off at ~2 fps')}</text>`);
o.push(`<text x="${PL}" y="48" font-size="12.5" fill="${C.ink2}">GATE POSEBACK: the worker's view on sim_host's clock (a fake wall clock), the real solver; frames 425-575 ms, one in six quick (1-4 vsyncs)</text>`);
// axes helpers
const gridY = (Yf, lo, hi, step, top, h, fmt, label) => {
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    const y = Yf(v); o.push(`<line x1="${PL}" x2="${PL + PW}" y1="${y}" y2="${y}" stroke="${Math.abs(v) < 1e-9 ? C.ink2 : C.grid}" stroke-width="${Math.abs(v) < 1e-9 ? 1.2 : 1}"/>`);
    o.push(`<text x="${PL - 8}" y="${y + 4}" font-size="11" text-anchor="end" fill="${C.ink2}">${fmt(v)}</text>`);
  }
  o.push(`<text x="${PL}" y="${top - 10}" font-size="12.5" font-weight="600" fill="${C.ink}">${esc(label)}</text>`);
};
const gridX = (top, h) => { for (let x = 0; x <= xMax + 1e-9; x += 2) { o.push(`<line x1="${X(x)}" x2="${X(x)}" y1="${top}" y2="${top + h}" stroke="${C.grid}"/>`); } };
const xLabels = (top, h) => { for (let x = 0; x <= xMax + 1e-9; x += 2) o.push(`<text x="${X(x)}" y="${top + h + 16}" font-size="11" text-anchor="middle" fill="${C.ink2}">${x}</text>`); };
const toff = take(B);
const takeMark = (top, h) => { if (toff == null) return; o.push(`<line x1="${X(toff)}" x2="${X(toff)}" y1="${top}" y2="${top + h}" stroke="${C.ink2}" stroke-dasharray="4 4"/>`);
  o.push(`<text x="${X(toff) + 4}" y="${top + 12}" font-size="11" fill="${C.ink2}">wheels off</text>`); };
// PANEL A
gridX(TOP, H1);
gridY(Y1, yMin, yMax, 1, TOP, H1, v => v.toFixed(0), 'A. the drawn CG\'s move along the motion, frame to frame (m) - below 0: drawn BACKWARD');
takeMark(TOP, H1);
xLabels(TOP, H1);
const series = (pts, col, Yf, key) => {
  o.push(`<polyline fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" points="${pts.map(p => X(p.x).toFixed(1) + ',' + Yf(p[key]).toFixed(1)).join(' ')}"/>`);
  for (const p of pts) o.push(`<circle cx="${X(p.x).toFixed(1)}" cy="${Yf(p[key]).toFixed(1)}" r="${p.y < -0.0005 && key === 'y' ? 5 : 3.5}" fill="${col}" stroke="${C.surf}" stroke-width="2"><title>page ${p.x.toFixed(2)} s, sim ${p.r.t_drawn.toFixed(3)} s drawn (newest ${p.r.t_newest.toFixed(3)} s), moved ${(p.r.ds_mm / 1000).toFixed(3)} m</title></circle>`);
};
series(dA, C.old, Y1, 'y'); series(dB, C.new, Y1, 'y');
const worst = dA.reduce((m, p) => (p.y < m.y ? p : m), dA[0]);
o.push(`<text x="${X(worst.x) + 8}" y="${Y1(worst.y) + 4}" font-size="11.5" fill="${C.ink}">${(-worst.y).toFixed(2)} m back</text>`);
// PANEL B: the zoom
const cum = rs => { let a = 0; return rs.map((r, k) => { if (k) a += r.ds_mm / 1000; return { x: tx(r), s: a, r, y: r.ds_mm / 1000 }; }); };
const zA = cum(A), zB = cum(B), w0 = worst.x - 0.1, w1 = worst.x + 0.55;
const inW = z => z.filter(p => p.x >= w0 && p.x <= w1);
const zA2 = inW(zA), zB2 = inW(zB), base = Math.min(zA2[0].s, zB2[0].s);
for (const p of zA2.concat(zB2)) p.z = p.s - base;
const zMax = Math.max(...zA2.map(p => p.z), ...zB2.map(p => p.z)) * 1.08, zMin = Math.floor(Math.min(0, ...zA2.map(p => p.z), ...zB2.map(p => p.z)) - 0.2);
const XZ = x => PL + ((x - w0) / (w1 - w0)) * PW, Y2 = z => top2 + H2 - ((z - zMin) / (zMax - zMin)) * H2;
for (let v = zMin; v <= zMax; v += 1) { o.push(`<line x1="${PL}" x2="${PL + PW}" y1="${Y2(v)}" y2="${Y2(v)}" stroke="${C.grid}"/><text x="${PL - 8}" y="${Y2(v) + 4}" font-size="11" text-anchor="end" fill="${C.ink2}">${v}</text>`); }
for (let x = Math.ceil(w0 * 10) / 10; x <= w1; x += 0.1) o.push(`<line x1="${XZ(x)}" x2="${XZ(x)}" y1="${top2}" y2="${top2 + H2}" stroke="${C.grid}"/><text x="${XZ(x)}" y="${top2 + H2 + 16}" font-size="11" text-anchor="middle" fill="${C.ink2}">${x.toFixed(2)}</text>`);
o.push(`<text x="${PL}" y="${top2 - 10}" font-size="12.5" font-weight="600" fill="${C.ink}">B. zoom on the worst frame: the drawn CG's distance along the motion (m) - the old clock steps back ${(-worst.y).toFixed(2)} m, the fix holds</text>`);
const zser = (pts, col) => { o.push(`<polyline fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" points="${pts.map(p => XZ(p.x).toFixed(1) + ',' + Y2(p.z).toFixed(1)).join(' ')}"/>`);
  for (const p of pts) o.push(`<circle cx="${XZ(p.x).toFixed(1)}" cy="${Y2(p.z).toFixed(1)}" r="4" fill="${col}" stroke="${C.surf}" stroke-width="2"><title>page ${p.x.toFixed(3)} s: ${p.z.toFixed(2)} m along, sim ${p.r.t_drawn.toFixed(3)} s drawn (newest ${p.r.t_newest.toFixed(3)} s)</title></circle>`); };
zser(zA2, C.old); zser(zB2, C.new);
o.push(`<text x="${PL + PW / 2}" y="${top2 + H2 + 36}" font-size="12" text-anchor="middle" fill="${C.ink2}">the page's time (s)</text>`);
// legend + direct labels
const nb = a => a.filter(p => p.y < -0.0005).length;
const lg = [[C.old, 'old clock (?poseback=0)', nb(dA) + ' frames backward'], [C.new, 'G1530 clock (the fix)', nb(dB) + ' frames backward']];
lg.forEach(([c, t, s], i) => { const y = TOP + 20 + i * 42; o.push(`<line x1="${PL + PW + 14}" x2="${PL + PW + 34}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="2"/><circle cx="${PL + PW + 24}" cy="${y}" r="3.5" fill="${c}"/>`);
  o.push(`<text x="${PL + PW + 40}" y="${y + 4}" font-size="11.5" fill="${C.ink}">${esc(t)}</text><text x="${PL + PW + 40}" y="${y + 19}" font-size="11" fill="${C.ink2}">${esc(s)}</text>`); });
o.push('</svg>');
fs.writeFileSync(OUT, o.join('\n') + '\n');
console.log('wrote ' + OUT);
