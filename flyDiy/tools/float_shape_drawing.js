#!/usr/bin/env node
// float_shape_drawing.js - THE FLOAT'S LINES AGAINST THE REFERENCE, AS A DRAWING (FLOAT-SHAPE, G1930, 2026-10-05)
//
// An orthographic SVG of one preset's hull: the PROFILE (keel, chine and deck lines), the PLAN (the deck edge and the
// chine), the afterbody's SECTIONS (step, u 0.25 / 0.5 / 0.75, stern) and the AREA PER STATION along the hull - the
// hull BEFORE (dashed, a baseline core) and AFTER (solid, this tree's core), over the REFERENCE (magenta: the
// catalogue's box, the 7-9 deg sternpost band from the step's keel point, the stern's minimum depth and width band,
// the step's station; FLOAT_GEN.REF). Every line comes from 32_hydro's sectionOf - the section family the drawn float
// and the physics share.
//
//   node tools/float_shape_drawing.js --before <base>/flyDiy/tools/flight_core.js [--preset "Wipline 2350"]
//        [--out reports/evidence/FLOAT-SHAPE/Wipline2350_lines.svg]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const FG = require('./_float_gen.js');
const NAME = opt('preset', 'Wipline 2350');
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'FLOAT-SHAPE', NAME.replace(/\s+/g, '') + '_lines.svg')));
const cores = [['after', path.join(__dirname, 'flight_core.js')]];
if (opt('before')) cores.unshift(['before', path.resolve(opt('before'))]);
const hulls = cores.map(([tag, file]) => {
  const H = require(file).HYDRO, P = H.presetParams(NAME), LA = P.L - P.xs, N = 160;
  const xs = []; for (let i = 0; i <= N; i++) { const x = -P.xs + P.L * i / N; xs.push(x === 0 ? -1e-9 : Math.min(LA - 1e-6, Math.max(-P.xs + 1e-6, x))); }
  xs.push(1e-9); xs.sort((a, b) => a - b);
  const sec = xs.map(x => H.sectionOf(P, x));
  const area = s => H.secAreaTo(P, s, s.yd + 1);   // both sides
  const cuts = [0, 0.25, 0.5, 0.75, 1].map(u => H.sectionOf(P, Math.min(LA - 1e-6, Math.max(1e-9, u * LA))));
  return { tag, H, P, LA, sec, area, cuts, m: FG.measure(P, H), R: H.FLOAT_PRESETS[NAME] };
});
const A = hulls[hulls.length - 1], P = A.P, R = A.R, LA = A.LA, Ho = R.H;
// layout: metres -> px
const k = 150, pad = 40, W = Math.round(P.L * k + 2 * pad + 420), sideH = Ho * k, topH = R.B * k;
const X = x => pad + (x + P.xs) * k;
let svg = [];
const line = (pts, st) => svg.push(`<polyline fill="none" ${st} points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/>`);
const text = (x, y, s, st = '') => svg.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" ${st}>${s}</text>`);
const STY = { before: 'stroke="#9aa3ad" stroke-width="1.6" stroke-dasharray="6 4"', after: 'stroke="#1f6fd1" stroke-width="2"' };
const REFS = 'stroke="#d0249f" stroke-width="1.2"';
let y0 = 70;
text(pad, 28, `${NAME} - lines against the reference (G1930 FLOAT-SHAPE). Solid blue: after; dashed grey: before; magenta: reference.`, 'font-size="15" font-weight="600"');
text(pad, 48, `catalogue (CAT, wipaire.com): L ${R.L} m, hull width ${R.B} m, hull height ${R.H} m, maximum flotation ${R.flot} kg / displacement ${R.disp} kg. Rules: sternpost 7-9 deg (RULE); stern depth, width, held deck (INF, inferred).`, 'font-size="11"');
// PROFILE
const SY = y => y0 + sideH - y * k;
text(pad, y0 - 6, 'PROFILE (side): keel, chine, deck', 'font-size="12" font-weight="600"');
line([[X(-P.xs), SY(0)], [X(LA), SY(0)], [X(LA), SY(Ho)], [X(-P.xs), SY(Ho)], [X(-P.xs), SY(0)]], REFS);
line([[X(0), SY(0)], [X(0), SY(Ho)]], REFS + ' stroke-dasharray="2 3"');
for (const a of FG.REF.sternpost) line([[X(0), SY(0)], [X(LA), SY(LA * Math.tan(a * Math.PI / 180))]], REFS);
text(X(LA) + 6, SY(LA * Math.tan(7 * Math.PI / 180)) + 4, 'sternpost 7-9 deg', 'font-size="10" fill="#d0249f"');
for (const h of hulls) {
  line(h.sec.map(s => [X(s.x), SY(s.yk)]), STY[h.tag]);
  line(h.sec.map(s => [X(s.x), SY(s.yc)]), STY[h.tag] + ' stroke-opacity="0.55"');
  line(h.sec.map(s => [X(s.x), SY(s.yd)]), STY[h.tag]);
  const st = h.sec[h.sec.length - 1];
  line([[X(st.x), SY(st.yk)], [X(st.x), SY(st.yd)]], STY[h.tag]);
}
{ const sF = A.H.sectionOf(P, -1e-6), sT = A.H.sectionOf(P, LA - 1e-6), yMin = sT.yd - FG.REF.sternDepth * (sF.yd - sF.yk);
  line([[X(LA) - 14, SY(yMin)], [X(LA) + 14, SY(yMin)]], REFS); text(X(LA) + 16, SY(yMin) + 18, 'stern depth >= 0.25 step', 'font-size="10" fill="#d0249f"'); }
y0 += sideH + 60;
// PLAN
const TY = z => y0 + topH / 2 + z * k;
text(pad, y0 - 6, 'PLAN (top): deck edge, chine', 'font-size="12" font-weight="600"');
line([[X(-P.xs), TY(-R.B / 2)], [X(LA), TY(-R.B / 2)], [X(LA), TY(R.B / 2)], [X(-P.xs), TY(R.B / 2)], [X(-P.xs), TY(-R.B / 2)]], REFS);
line([[X(0), TY(-R.B / 2)], [X(0), TY(R.B / 2)]], REFS + ' stroke-dasharray="2 3"');
for (const w of FG.REF.sternWidth) for (const sd of [-1, 1]) line([[X(LA) - 10, TY(sd * w * R.B / 2)], [X(LA) + 10, TY(sd * w * R.B / 2)]], REFS);
text(X(LA) + 14, TY(-R.B / 2) + 4, 'stern 0.45-0.65 W', 'font-size="10" fill="#d0249f"');
for (const h of hulls) for (const sd of [-1, 1]) {
  line(h.sec.map(s => [X(s.x), TY(sd * s.bd)]), STY[h.tag]);
  line(h.sec.map(s => [X(s.x), TY(sd * s.b)]), STY[h.tag] + ' stroke-opacity="0.45"');
}
y0 += topH + 60;
// SECTIONS (the afterbody, seen from astern, all at one origin: the step keel)
text(pad, y0 - 6, 'AFTERBODY SECTIONS (from astern, step keel at the origin): u = 0 (step), 0.25, 0.5, 0.75, 1 (stern)', 'font-size="12" font-weight="600"');
const k2 = 220, cxs = [0, 1, 2, 3, 4].map(i => pad + 90 + i * (R.B * k2 + 40));
const sectPts = (h, s) => { const q = h.H.secPoly(h.P, s); const pts = [q.K, q.C, q.E, q.D].map(p => [p[1], p[0]]); return pts.slice().reverse().map(p => [-p[0], p[1]]).concat(pts); };
for (let i = 0; i < 5; i++) {
  const cx = cxs[i], base = y0 + Ho * k2 + 10, PX = p => [cx + p[0] * k2, base - p[1] * k2];
  line([[-R.B / 2, 0], [R.B / 2, 0], [R.B / 2, Ho], [-R.B / 2, Ho], [-R.B / 2, 0]].map(PX), REFS);
  for (const h of hulls) { const pts = sectPts(h, h.cuts[i]); pts.push(pts[0]); line(pts.map(PX), STY[h.tag]); }
  const rel = hulls.map(h => (h.area(h.cuts[i]) / h.area(h.H.sectionOf(h.P, -1e-6))).toFixed(2)).join(' -> ');
  text(cx - R.B * k2 / 2, base + 16, `u ${[0, 0.25, 0.5, 0.75, 1][i]}: ${rel}`, 'font-size="11"');
  if (i === 0) text(cx - R.B * k2 / 2, base + 30, `(area / the step's section${hulls.length > 1 ? ', before -> after' : ''})`, 'font-size="10"');
}
y0 += Ho * k2 + 70;
// AREA PER STATION
const aH = 150, aMax = Math.max(...hulls.map(h => Math.max(...h.sec.map(s => h.area(s))))) * 1.05;
text(pad, y0 - 6, 'SECTION AREA PER STATION (m2), bow -> stern; the step at the dotted line', 'font-size="12" font-weight="600"');
line([[X(-P.xs), y0 + aH], [X(LA), y0 + aH]], 'stroke="#555" stroke-width="1"');
line([[X(0), y0], [X(0), y0 + aH]], REFS + ' stroke-dasharray="2 3"');
for (const h of hulls) line(h.sec.map(s => [X(s.x), y0 + aH - h.area(s) / aMax * aH]), STY[h.tag]);
text(pad, y0 + aH + 16, `0 .. ${aMax.toFixed(2)} m2`, 'font-size="10"');
y0 += aH + 40;
// THE NUMBERS
const rows = hulls.map(h => `${h.tag}: ` + FG.check(h.m).map(r => `${r.ok ? '' : '!'}${r.key} ${r.value.toFixed(r.key === 'sternpost' ? 1 : 2)}`).join('  ') + `  | deadrise ${h.P.beta.toFixed(1)}/${h.P.betaA.toFixed(1)} fineness ${h.P.fineK.toFixed(2)}`);
rows.forEach((r, i) => text(pad, y0 + i * 16, r, 'font-size="11" font-family="monospace"'));
y0 += rows.length * 16 + 20;
const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Math.round(y0)}" viewBox="0 0 ${W} ${Math.round(y0)}" font-family="sans-serif">\n<rect width="100%" height="100%" fill="#ffffff"/>\n${svg.join('\n')}\n</svg>\n`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, doc);
console.log(path.relative(process.cwd(), OUT));
