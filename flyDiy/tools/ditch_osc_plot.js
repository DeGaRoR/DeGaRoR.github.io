#!/usr/bin/env node
// ditch_osc_plot.js - the sheet of tools/ditch_osc.js's CSVs: per case the heave (m, about the water) and the pitch (deg)
// over time, the thrust beside them; an SVG (and a PNG through ImageMagick when the box has it).
//   node tools/ditch_osc_plot.js <csv dir> [--cases cub_thr0,cub_thr60,cessna_thr0,floats_drop] [--secs 40]
'use strict';
const fs = require('fs'), path = require('path');
const { execSync } = require('child_process');
const dir = process.argv[2];
const opt = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const CASES = opt('cases', 'cub_thr0,cub_thr60,cessna_thr0,floats_drop').split(','), SECS = +opt('secs', 40);
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
