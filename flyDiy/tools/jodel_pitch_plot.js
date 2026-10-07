#!/usr/bin/env node
// G2470 JODEL-PITCH - the evidence sheet: the Jodel's WP3 -> WP4 descent on GATE ROUTE's flight, BEFORE (the integration's
// tree) and AFTER (this branch), from tools/jodel_pitch_probe.js's CSVs. Four panels against time: the pitch (and TECS's
// pitch demand), the elevator, the vertical speed (and the one asked), the Munk body couple as the solver applied it before
// (the world x-y arm) and as it is (the arm along the body). Plain SVG, no dependency.
//   node tools/jodel_pitch_plot.js <before.csv> <after.csv> <out.svg> [title]
'use strict';
const fs = require('fs');
const [fb, fa, out, title] = process.argv.slice(2);
const read = f => { const L = fs.readFileSync(f, 'utf8').trim().split('\n'), h = L[0].split(','); return L.slice(1).map(l => { const v = l.split(','), o = {}; h.forEach((k, i) => o[k] = k === 'phase' ? v[i] : +v[i]); return o; }); };
const B = read(fb), A = read(fa);
const t0 = Math.min(B[0].t, A[0].t), t1 = Math.max(B[B.length - 1].t, A[A.length - 1].t);
const W = 960, PH = 170, ML = 70, MR = 20, MT = 40, GAP = 34;
const panels = [
  { name: 'pitch (deg)', lines: [[B, 'pitch_deg', '#c0392b', 'before'], [B, 'thC_deg', '#e8a39b', 'before: TECS demand', '4 3'], [A, 'pitch_deg', '#1f6fb2', 'after'], [A, 'thC_deg', '#9cc3e6', 'after: TECS demand', '4 3']] },
  { name: 'elevator (rad, + nose-up)', lines: [[B, 'de', '#c0392b', 'before'], [A, 'de', '#1f6fb2', 'after']] },
  { name: 'vertical speed (m/s)', lines: [[B, 'vs', '#c0392b', 'before'], [B, 'vs_asked', '#e8a39b', 'before: asked', '4 3'], [A, 'vs', '#1f6fb2', 'after'], [A, 'vs_asked', '#9cc3e6', 'after: asked', '4 3']] },
  { name: 'Munk body couple (N.m, + nose-up)', lines: [[B, 'munk_worldarm_Nm', '#c0392b', 'before: as applied (world x-y arm)'], [A, 'munk_true_Nm', '#1f6fb2', 'after: as applied (the arm along the body)']] },
];
const H = MT + panels.length * (PH + GAP) + 20;
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff"/>`;
s += `<text x="${ML}" y="22" font-size="14" font-weight="bold">${(title || 'G2470 JODEL-PITCH').replace(/&/g, '&amp;')}</text>`;
const X = t => ML + (t - t0) / (t1 - t0) * (W - ML - MR);
panels.forEach((P, k) => {
  const y0 = MT + k * (PH + GAP);
  let lo = Infinity, hi = -Infinity;
  for (const [D, c] of P.lines) for (const r of D) if (Number.isFinite(r[c])) { lo = Math.min(lo, r[c]); hi = Math.max(hi, r[c]); }
  const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
  const Y = v => y0 + PH - (v - lo) / (hi - lo) * PH;
  s += `<rect x="${ML}" y="${y0}" width="${W - ML - MR}" height="${PH}" fill="none" stroke="#999"/>`;
  s += `<text x="${ML + 4}" y="${y0 + 13}" font-weight="bold">${P.name}</text>`;
  for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4; s += `<text x="${ML - 6}" y="${Y(v) + 4}" text-anchor="end" fill="#555">${Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)}</text><line x1="${ML}" x2="${W - MR}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eee"/>`; }
  if (lo < 0 && hi > 0) s += `<line x1="${ML}" x2="${W - MR}" y1="${Y(0)}" y2="${Y(0)}" stroke="#bbb"/>`;
  let lx = ML + 200;
  P.lines.forEach(([D, c, col, lab, dash]) => {
    const pts = D.filter(r => Number.isFinite(r[c])).map(r => X(r.t).toFixed(1) + ',' + Y(r[c]).toFixed(1)).join(' ');
    s += `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.6"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
    s += `<line x1="${lx}" x2="${lx + 20}" y1="${y0 + 9}" y2="${y0 + 9}" stroke="${col}" stroke-width="2"${dash ? ` stroke-dasharray="${dash}"` : ''}/><text x="${lx + 24}" y="${y0 + 13}">${lab}</text>`;
    lx += 40 + lab.length * 6;
  });
  for (let t = Math.ceil(t0 / 10) * 10; t <= t1; t += 10) s += `<text x="${X(t)}" y="${y0 + PH + 13}" text-anchor="middle" fill="#555">${t}</text>`;
});
s += `<text x="${W - MR}" y="${H - 6}" text-anchor="end" fill="#555">t (s, the flight's clock)</text></svg>\n`;
fs.writeFileSync(out, s);
console.log('wrote ' + out);
