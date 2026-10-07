// G2387 (DMG-RECAL2): one landing's trace as SVG - pitch, sink, speed, bank, the spreaders' worst load over its certified
// yield, and the floats wet - BEFORE (90ebbbff, grey) and AFTER (this branch, blue), each from its own first float
// contact (t = 0), from water_landing.js's JSON.
// Run from flyDiy/: node reports/evidence/DMG-RECAL2/scripts/trace_svg.js <before.json> <after.json> <out.svg> [title]
const fs = require('fs');
const [fb, fa, out, title] = process.argv.slice(2);
const load = f => { const o = JSON.parse(fs.readFileSync(f, 'utf8')); const c = o.cols; const ix = k => c.indexOf(k);
  const r0 = o.rows.find(r => r[ix('wet')] > 0); const t0 = r0 ? r0[0] : o.rows[o.rows.length - 1][0];
  const rows = o.rows.filter(r => r[0] >= t0 - 4 && r[0] <= t0 + 14);
  return { o, t0, s: k => rows.map(r => [r[0] - t0, k === 'sink' ? -r[ix('vy')] : r[ix(k)]]) }; };
const B = load(fb), A = load(fa);
const P = [['pitch', 'pitch (deg, nose up)'], ['sink', 'sink (m/s, down +)'], ['V', 'speed (m/s)'], ['bank', 'bank (deg)'], ['spreader', 'spreaders: worst / certified yield'], ['wet', 'floats wet (0-2)']];
const W = 900, H = 150, L = 70, R = 20, T = 40, G = 26, x0 = -4, x1 = 14;
const X = t => L + (t - x0) / (x1 - x0) * (W - L - R);
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${T + P.length * (H + G) + 30}" font-family="sans-serif" font-size="11">\n`;
svg += `<rect width="100%" height="100%" fill="#fff"/>\n<text x="${L}" y="18" font-size="14">${title || ''}</text>\n`;
svg += `<text x="${L}" y="33" fill="#888">grey: before (90ebbbff) - ${B.o.contacts} contact phase(s), spreaders ${B.o.peakSpreader.toFixed(2)}; blue: after - ${A.o.contacts} contact phase(s), spreaders ${A.o.peakSpreader.toFixed(2)}; t = 0 at each run's first float contact</text>\n`;
P.forEach(([k, lab], i) => {
  const y0 = T + i * (H + G) + 10, sb = B.s(k), sa = A.s(k), all = sb.concat(sa).map(p => p[1]);
  let lo = Math.min(...all), hi = Math.max(...all); if (k === 'spreader') { lo = 0; hi = Math.max(hi, 1.05); } if (hi - lo < 1e-6) hi = lo + 1;
  const Y = v => y0 + H - (v - lo) / (hi - lo) * H;
  svg += `<rect x="${L}" y="${y0}" width="${W - L - R}" height="${H}" fill="none" stroke="#ccc"/>\n<text x="4" y="${y0 + 12}">${lab}</text>\n`;
  svg += `<text x="${L - 4}" y="${Y(hi) + 4}" text-anchor="end">${hi.toFixed(2)}</text><text x="${L - 4}" y="${Y(lo)}" text-anchor="end">${lo.toFixed(2)}</text>\n`;
  if (k === 'spreader') for (const [v, c] of [[1, '#c00'], [2 / 3, '#e90']]) svg += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${c}" stroke-dasharray="4 3"/><text x="${W - R - 2}" y="${Y(v) - 2}" text-anchor="end" fill="${c}">${v === 1 ? 'the envelope (1)' : 'ordinary operations (2/3)'}</text>\n`;
  if (lo < 0 && hi > 0) svg += `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#eee"/>\n`;
  svg += `<line x1="${X(0)}" x2="${X(0)}" y1="${y0}" y2="${y0 + H}" stroke="#ddd"/>\n`;
  for (const [s, c] of [[sb, '#999'], [sa, '#1f6fd1']]) svg += `<polyline fill="none" stroke="${c}" stroke-width="1.3" points="${s.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>\n`;
});
const yb = T + P.length * (H + G) + 10;
for (let t = x0; t <= x1; t += 2) svg += `<text x="${X(t)}" y="${yb}" text-anchor="middle">${t} s</text>\n`;
svg += '</svg>\n';
fs.writeFileSync(out, svg);
console.log('wrote', out);
