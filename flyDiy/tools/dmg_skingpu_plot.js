#!/usr/bin/env node
// G1818 (DMG-SKINGPU): the crash's frame times, before (the CPU's riding, D4b's G1869 cuts on) and after (the GPU's), as
// one SVG - a panel a case, the frame's ms against the time from the first break, both runs on one axis (capped at
// 200 ms; a frame past it drawn at the top with its value), the 33 ms line (30 fps) and each run's impact-second mean.
//   node tools/dmg_skingpu_plot.js <box.json from tools/dmg_skingpu_box.js> <out.svg> [title]
'use strict';
const fs = require('fs');
const [IN, OUT, TITLE] = process.argv.slice(2);
const J = JSON.parse(fs.readFileSync(IN, 'utf8'));
const keys = Object.keys(J.cases), cases = [...new Set(keys.map(k => k.replace(/:(cpu|gpu)$/, '')))];
const PW = 460, PH = 210, M = { l: 44, r: 12, t: 30, b: 30 }, COLS = 2, CAP = 200, T0 = -0.5, T1 = 3.5;
const rows = Math.ceil(cases.length / COLS), W = COLS * PW, H = rows * PH + 46;
const C = { cpu: '#c2410c', gpu: '#0f766e', grid: '#d4d4d8', ink: '#27272a', soft: '#71717a' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui,Segoe UI,Arial" font-size="11">\n`;
svg += `<rect width="${W}" height="${H}" fill="#ffffff"/>\n<text x="12" y="20" font-size="14" fill="${C.ink}">${esc(TITLE || 'The crash frame by frame: the CPU riding (before) and the GPU riding (after)')}</text>\n`;
svg += `<g transform="translate(${W - 300},10)"><rect width="12" height="3" y="6" fill="${C.cpu}"/><text x="16" y="11" fill="${C.ink}">before: the CPU riding (G1869 cuts)</text><rect x="0" y="18" width="12" height="3" fill="${C.gpu}"/><text x="16" y="23" fill="${C.ink}">after: the GPU riding (G1818)</text></g>\n`;
cases.forEach((cs, i) => {
  const ox = (i % COLS) * PW, oy = 46 + Math.floor(i / COLS) * PH, iw = PW - M.l - M.r, ih = PH - M.t - M.b;
  const X = t => ox + M.l + (Math.min(T1, Math.max(T0, t)) - T0) / (T1 - T0) * iw, Y = ms => oy + M.t + ih - Math.min(CAP, ms) / CAP * ih;
  svg += `<g><text x="${ox + M.l}" y="${oy + 18}" font-size="12" fill="${C.ink}">${esc(cs)}</text>\n`;
  for (const v of [0, 50, 100, 150, 200]) svg += `<line x1="${ox + M.l}" x2="${ox + M.l + iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.grid}" stroke-width="0.6"/><text x="${ox + M.l - 4}" y="${Y(v) + 3}" text-anchor="end" fill="${C.soft}">${v}</text>\n`;
  for (let t = 0; t <= 3; t++) svg += `<text x="${X(t)}" y="${oy + M.t + ih + 14}" text-anchor="middle" fill="${C.soft}">${t} s</text>\n`;
  svg += `<line x1="${ox + M.l}" x2="${ox + M.l + iw}" y1="${Y(33.3)}" y2="${Y(33.3)}" stroke="${C.ink}" stroke-dasharray="3 3" stroke-width="0.7"/><text x="${ox + M.l + iw - 2}" y="${Y(33.3) - 3}" text-anchor="end" fill="${C.soft}">33 ms (30 fps)</text>\n`;
  let ly = 0;
  for (const mode of ['cpu', 'gpu']) {
    const R = J.cases[cs + ':' + mode]; if (!R || !R.trace) continue;
    const T = R.trace, i0 = T.findIndex(r => r.broken > 0), t0 = i0 >= 0 ? T[i0].t : 0;
    const pts = T.map(r => [r.t - t0, r.ms]).filter(([t]) => t >= T0 && t <= T1);
    svg += `<polyline fill="none" stroke="${C[mode]}" stroke-width="1.2" stroke-linejoin="round" points="${pts.map(([t, ms]) => X(t).toFixed(1) + ',' + Y(ms).toFixed(1)).join(' ')}"/>\n`;
    for (const [t, ms] of pts) if (ms > CAP) svg += `<text x="${X(t) + 2}" y="${Y(CAP) + 10}" fill="${C[mode]}">${Math.round(ms)}</text>\n`;
    svg += `<text x="${ox + M.l + 6}" y="${oy + M.t + 12 + ly}" fill="${C[mode]}">${mode === 'cpu' ? 'before' : 'after'}: impact second ${R.impactMean} ms mean, worst ${Math.round((R.crash || {}).max || 0)} ms, at rest ${(R.rest || {}).med} ms</text>\n`;
    ly += 13;
  }
  svg += `</g>\n`;
});
svg += '</svg>\n';
fs.writeFileSync(OUT, svg);
console.log('PLOT ' + OUT + ' (' + cases.length + ' cases)');
