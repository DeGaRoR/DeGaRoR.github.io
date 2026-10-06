#!/usr/bin/env node
// ditch_osc_plot.js - THE EVIDENCE SHEET FOR WATER-DAMP (G2105): tools/ditch_osc.js's CSVs, master's core against this
// one, as one SVG. A row per build; left the heave (the mass centre over the water, m) 0-30 s, right the same from 8 s
// on, its own scale (cm) - where master's limit cycle lives. Each sample a hover title (t, heave).
//   node tools/ditch_osc_plot.js <beforeDir> <afterDir> <out.svg> [builds=cub,jodel,metal] [title]
'use strict';
const fs = require('fs'), path = require('path');
const [BEF, AFT, OUT, BL, TITLE] = process.argv.slice(2);
const builds = (BL || 'cub,jodel,metal').split(',');
const NAME = { cub: "the user's Cub", jodel: 'the Jodel', metal: 'the metal Cessna', cfloats: 'the Cessna on floats', twin: 'the twin on floats' };
const read = f => fs.readFileSync(f, 'utf8').trim().split('\n').slice(1).map(l => l.split(',').map(Number));
const C = { old: '#eb6834', new: '#2a78d6', ink: '#1a1a19', ink2: '#5f5e58', grid: '#e4e3dc', surf: '#fcfcfb' };
const W = 1100, PL = 64, GAPX = 70, PR = 24, PWa = 440, PWb = W - PL - PWa - GAPX - PR, RH = 190, TOP = 92, GAPY = 58;
const H = TOP + builds.length * (RH + GAPY) + 20;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const o = [];
o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">`);
o.push(`<rect width="${W}" height="${H}" fill="${C.surf}"/>`);
o.push(`<text x="${PL}" y="28" font-size="17" font-weight="600" fill="${C.ink}">${esc(TITLE || 'WATER-DAMP: a ditched aeroplane, before and after')}</text>`);
o.push(`<text x="${PL}" y="48" font-size="12.5" fill="${C.ink2}">tools/ditch_osc.js: 0.3 m over the SEA lane, 22 m/s, sinking 1 m/s, throttle closed; the mass centre's height over the water, every 1/60 s</text>`);
// legend
o.push(`<line x1="${PL}" y1="68" x2="${PL + 22}" y2="68" stroke="${C.old}" stroke-width="2"/><text x="${PL + 28}" y="72" font-size="12.5" fill="${C.ink}">master (train 37b)</text>`);
o.push(`<line x1="${PL + 160}" y1="68" x2="${PL + 182}" y2="68" stroke="${C.new}" stroke-width="2"/><text x="${PL + 188}" y="72" font-size="12.5" fill="${C.ink}">G2105 (radiation + the held force fixed)</text>`);
const panel = (x0, y0, w, h, series, t0, t1, unit, k, label) => {
  const pts = series.map(s => s.filter(r => r[0] >= t0 && r[0] <= t1));
  let lo = Infinity, hi = -Infinity; for (const p of pts) for (const r of p) { lo = Math.min(lo, r[1] * k); hi = Math.max(hi, r[1] * k); }
  const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
  const X = t => x0 + (t - t0) / (t1 - t0) * w, Y = v => y0 + h - (v * k - lo) / (hi - lo) * h;
  const step = (() => { const r = hi - lo, m = Math.pow(10, Math.floor(Math.log10(r / 4))); for (const s of [1, 2, 5, 10]) if (r / (s * m) <= 6) return s * m; return 10 * m; })();
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    const y = y0 + h - (v - lo) / (hi - lo) * h;
    o.push(`<line x1="${x0}" y1="${y.toFixed(1)}" x2="${x0 + w}" y2="${y.toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>`);
    o.push(`<text x="${x0 - 6}" y="${(y + 4).toFixed(1)}" font-size="11" fill="${C.ink2}" text-anchor="end">${+v.toFixed(3)}</text>`);
  }
  for (let t = Math.ceil(t0 / 5) * 5; t <= t1; t += 5) o.push(`<text x="${X(t).toFixed(1)}" y="${y0 + h + 15}" font-size="11" fill="${C.ink2}" text-anchor="middle">${t} s</text>`);
  o.push(`<text x="${x0}" y="${y0 - 8}" font-size="12" fill="${C.ink}">${esc(label)} (${unit})</text>`);
  pts.forEach((p, i) => {
    const d = p.map((r, j) => (j ? 'L' : 'M') + X(r[0]).toFixed(1) + ' ' + Y(r[1]).toFixed(1)).join('');
    o.push(`<path d="${d}" fill="none" stroke="${i ? C.new : C.old}" stroke-width="${i ? 2 : 1.5}" stroke-linejoin="round"/>`);
  });
  // hover: one title per 0.25 s, both series
  for (let j = 0; j < pts[0].length; j += 15) {
    const r0 = pts[0][j], r1 = pts[1][j]; if (!r0 || !r1) continue;
    o.push(`<rect x="${(X(r0[0]) - 2).toFixed(1)}" y="${y0}" width="4" height="${h}" fill="transparent"><title>t ${r0[0].toFixed(2)} s: master ${(r0[1] * k).toFixed(unit === 'cm' ? 1 : 3)} ${unit}, G2105 ${(r1[1] * k).toFixed(unit === 'cm' ? 1 : 3)} ${unit}</title></rect>`);
  }
};
builds.forEach((b, i) => {
  const A = read(path.join(BEF, b + '.csv')), B = read(path.join(AFT, b + '.csv'));
  const y0 = TOP + i * (RH + GAPY) + 26;
  o.push(`<text x="${PL - 50}" y="${y0 - 22}" font-size="14" font-weight="600" fill="${C.ink}">${esc(NAME[b] || b)}</text>`);
  panel(PL, y0, PWa, RH - 26, [A, B], 0, 30, 'm', 1, 'heave, 0-30 s');
  panel(PL + PWa + GAPX, y0, PWb, RH - 26, [A, B], 8, 30, 'cm', 100, 'heave from 8 s, zoomed');
});
o.push('</svg>');
fs.writeFileSync(OUT, o.join('\n'));
console.log('wrote ' + OUT);
