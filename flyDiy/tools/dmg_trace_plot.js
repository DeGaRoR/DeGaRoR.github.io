#!/usr/bin/env node
// G1869 (DMG-D4b): the crash trace (tools/dmg_crash_trace.js's JSON) as an SVG - one panel a case, each frame's time
// over sim time, the G1869 cuts off (as before) and on, the 16.7 / 33.3 ms lines, and under it the frame's split (the
// physics, the skin break, the rest of the scene, the render) for the cuts on.
//   node tools/dmg_trace_plot.js <trace.json> <out.svg>
'use strict';
const fs = require('fs');
const [inF, outF] = process.argv.slice(2);
const T = JSON.parse(fs.readFileSync(inF, 'utf8'));
const cases = [...new Set(Object.keys(T.cases).map(k => k.split(':')[0]))];
const W = 960, PH = 210, PAD = 46, H = 40 + cases.length * (PH + 40);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff"/>`;
s += `<text x="10" y="18" font-weight="bold">The crash's frames (the user's Cub, inline, the box's GPU): frame time (ms) over sim time - the G1869 cuts off (red) and on (green)</text>`;
cases.forEach((k, ci) => {
  const a = T.cases[k + ':before'], b = T.cases[k + ':fast'];
  const y0 = 40 + ci * (PH + 40), x0 = PAD, w = W - PAD - 20;
  const all = [].concat(a ? a.trace : [], b ? b.trace : []);
  if (!all.length) return;
  const tMin = Math.min(...all.map(r => r.t)), tMax = Math.max(...all.map(r => r.t));
  const yMax = Math.min(400, Math.max(100, ...all.map(r => r.ms)) * 1.05);
  const X = t => x0 + (t - tMin) / Math.max(1e-6, tMax - tMin) * w, Y = v => y0 + PH - Math.min(v, yMax) / yMax * PH;
  s += `<rect x="${x0}" y="${y0}" width="${w}" height="${PH}" fill="none" stroke="#ccc"/>`;
  const sum = c => c ? `worst ${c.worst.ms} ms, the impact second ${c.impactMean} ms, at rest ${c.rest ? c.rest.med : '-'} ms` : 'n/a';
  s += `<text x="${x0}" y="${y0 - 6}" font-weight="bold">${esc(k)} - ${esc((a || b).label || '')}</text>`;
  s += `<text x="${x0 + w}" y="${y0 - 6}" text-anchor="end" fill="#555">off: ${esc(sum(a))} | on: ${esc(sum(b))}</text>`;
  for (const g of [16.7, 33.3, 100]) if (g < yMax) s += `<line x1="${x0}" x2="${x0 + w}" y1="${Y(g)}" y2="${Y(g)}" stroke="#ddd" stroke-dasharray="3,3"/><text x="${x0 - 4}" y="${Y(g) + 4}" text-anchor="end" fill="#999">${g}</text>`;
  const line = (c, col) => { if (!c) return; s += `<polyline fill="none" stroke="${col}" stroke-width="1.2" points="${c.trace.map(r => X(r.t).toFixed(1) + ',' + Y(r.ms).toFixed(1)).join(' ')}"/>`; };
  // the cuts on: the frame's split as stacked bands (the physics, the skin break, the rest of the scene, the render)
  if (b) {
    const band = (f, col) => { s += `<polygon fill="${col}" opacity="0.35" points="${b.trace.map(r => X(r.t).toFixed(1) + ',' + Y(f(r)).toFixed(1)).join(' ')} ${b.trace.slice().reverse().map(r => X(r.t).toFixed(1) + ',' + Y(0).toFixed(1)).join(' ')}"/>`; };
    band(r => (r.phys || 0) + (r.scene || 0) + (r.render || 0), '#9ecae1');
    band(r => (r.phys || 0) + (r.scene || 0), '#fdd0a2');
    band(r => (r.phys || 0) + (r.brk || 0), '#fc9272');
    band(r => (r.phys || 0), '#bcbddc');
  }
  line(a, '#c0392b'); line(b, '#1e8449');
  const i0 = b ? b.trace.findIndex(r => r.broken > 0) : -1;
  if (i0 >= 0) s += `<line x1="${X(b.trace[i0].t)}" x2="${X(b.trace[i0].t)}" y1="${y0}" y2="${y0 + PH}" stroke="#000" stroke-dasharray="2,2"/><text x="${X(b.trace[i0].t) + 3}" y="${y0 + 12}">first break</text>`;
  s += `<text x="${x0}" y="${y0 + PH + 14}" fill="#555">bands (cuts on): purple the physics, red the skin break, orange the rest of the scene (the pose, the debris), blue the render; sim time ${tMin.toFixed(1)}-${tMax.toFixed(1)} s</text>`;
});
fs.writeFileSync(outF, s + '</svg>');
console.log('wrote ' + outF);
