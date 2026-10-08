#!/usr/bin/env node
// ditch_osc_plot.js - THE EVIDENCE SHEET FOR WATER-DAMP (G2105): tools/ditch_osc.js's CSVs, master's core against this
// one, as one SVG. A row per build; left the heave (the mass centre over the water, m) 0-30 s, right the same from 8 s
// on, its own scale (cm) - where master's limit cycle lives. Each sample a hover title (t, heave).
//   node tools/ditch_osc_plot.js <beforeDir> <afterDir> <out.svg> [builds=cub,jodel,metal] [title]
// MERGED (G2105 x WATER-LOOK G2094): `--cases <dir> [--list a,b] [--secs 40]` draws WATER-LOOK's case sheet instead - per case
// (tools/ditch_osc.js --cases wl --csv <dir>) the heave and the pitch over time, the thrust beside them, the damping
// ratios from summary.json -> <dir>/osc_sheet.svg (and .png through ImageMagick when the box has it)
'use strict';
const fs = require('fs'), path = require('path');
if (process.argv[2] === '--cases') {
  const dir = process.argv[3];
  const optC = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
  const { execSync } = require('child_process');
  const CASES = optC('list', 'cub_thr0,cub_thr60,cessna_thr0,floats_drop').split(','), SECS = +optC('secs', 40);
  const sum = (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8')); } catch (e) { return []; } })();
  const W = 1200, PH = 170, M = { l: 70, r: 70, t: 30 }, H = M.t + CASES.length * (PH + 46) + 40;
  const pw = W - M.l - M.r;
  const X = t => M.l + pw * t / SECS;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Segoe UI, Arial" font-size="12">
  <rect width="100%" height="100%" fill="#fff"/>
  <text x="${M.l}" y="20" font-size="15" font-weight="600">A ditched aeroplane's heave and pitch (WATER-LOOK G2094) - STAGED INLINE (node, tools/ditch_osc.js: placed over the SEA lane, no page, no drawn field)</text>`;
  CASES.forEach((id, k) => {
    const f = path.join(dir, id + '.csv'); if (!fs.existsSync(f)) return;
    const L = fs.readFileSync(f, 'utf8').trim().split('\n').slice(1).map(l => l.split(',').map(Number)).filter(r => r[0] <= SECS);
    const y0 = M.t + k * (PH + 46) + 26, info = sum.find(q => q.id === id) || {};
    const hv = L.map(r => r[1]), pt = L.map(r => r[2]), th = L.map(r => r[6]);
    const hMin = Math.min(...hv), hMax = Math.max(...hv), pMin = Math.min(...pt), pMax = Math.max(...pt), tMax = Math.max(1, ...th);
    const Yh = v => y0 + PH - (v - hMin) / Math.max(1e-6, hMax - hMin) * PH, Yp = v => y0 + PH - (v - pMin) / Math.max(1e-6, pMax - pMin) * PH;
    const line = (ys, col, w) => `<polyline fill="none" stroke="${col}" stroke-width="${w}" points="${L.map((r, i) => X(r[0]).toFixed(1) + ',' + ys(i).toFixed(1)).join(' ')}"/>`;
    const z = info.heave ? 'heave zeta ' + (info.heave.zeta || 0).toFixed(3) + ', period ' + (info.heave.T || 0).toFixed(2) + ' s' : '';
    const zp = info.pitch && Number.isFinite(info.pitch.zeta) ? '; pitch zeta ' + info.pitch.zeta.toFixed(3) : '';
    s += `<text x="${M.l}" y="${y0 - 8}" font-weight="600">${(info.label || id).replace(/&/g, '&amp;')}</text>`;
    s += `<text x="${W - M.r}" y="${y0 - 8}" text-anchor="end" fill="#444">${z}${zp}; thrust after the stop up to ${Math.round(info.thrustAfterMax || 0)} N</text>`;
    s += `<rect x="${M.l}" y="${y0}" width="${pw}" height="${PH}" fill="#f7f8fa" stroke="#ccc"/>`;
    for (let t = 0; t <= SECS; t += 5) s += `<line x1="${X(t)}" x2="${X(t)}" y1="${y0}" y2="${y0 + PH}" stroke="#e2e2e2"/><text x="${X(t)}" y="${y0 + PH + 14}" text-anchor="middle" fill="#666">${t} s</text>`;
    if (info.t0) s += `<line x1="${X(info.t0)}" x2="${X(info.t0)}" y1="${y0}" y2="${y0 + PH}" stroke="#999" stroke-dasharray="3,3"/>`;
    if (tMax > 1) s += line(i => y0 + PH - th[i] / tMax * PH * 0.9, '#e0a030', 1);
    s += line(i => Yp(pt[i]), '#c0392b', 1.2) + line(i => Yh(hv[i]), '#1f5fa8', 1.6);
    s += `<text x="${M.l - 6}" y="${y0 + 10}" text-anchor="end" fill="#1f5fa8">${hMax.toFixed(2)} m</text><text x="${M.l - 6}" y="${y0 + PH}" text-anchor="end" fill="#1f5fa8">${hMin.toFixed(2)} m</text>`;
    s += `<text x="${W - M.r + 6}" y="${y0 + 10}" fill="#c0392b">${pMax.toFixed(0)} deg</text><text x="${W - M.r + 6}" y="${y0 + PH}" fill="#c0392b">${pMin.toFixed(0)} deg</text>`;
  });
  s += `<text x="${M.l}" y="${H - 14}" fill="#444"><tspan fill="#1f5fa8">blue: the CG's height over the water (heave)</tspan>  <tspan fill="#c0392b">red: pitch</tspan>  <tspan fill="#e0a030">orange: the thrust applied</tspan>  dashed: the aeroplane stopped (ground speed under 1 m/s)</text></svg>`;
  const out = path.join(dir, 'osc_sheet.svg'); fs.writeFileSync(out, s);
  try { execSync('magick -density 110 "' + out + '" "' + out.replace(/\.svg$/, '.png') + '"', { stdio: 'ignore' }); } catch (e) {}
  console.log(out);
  process.exit(0);
}
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
