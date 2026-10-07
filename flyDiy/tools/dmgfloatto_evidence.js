#!/usr/bin/env node
// G1882 (DMG-FLOATTO): the evidence plots - from GATE DMGFLOATTO's JSON (`--evidence=<dir> --name=<n>`) for the base
// core and this branch's, and the base core with the sea flattened (`--flatSea`, the cause). Static SVG, one caption
// line each in the README.
//   node tools/dmgfloatto_evidence.js --base=<base.json> --after=<after.json> --flat=<base_flat.json> --out=<dir>
'use strict';
const fs = require('fs'), path = require('path');
const arg = (k, d) => { const a = process.argv.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const OUT = arg('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-FLOATTO'));
const B = JSON.parse(fs.readFileSync(arg('base'), 'utf8')), A = JSON.parse(fs.readFileSync(arg('after'), 'utf8'));
const F = arg('flat', null) ? JSON.parse(fs.readFileSync(arg('flat'), 'utf8')) : null;
fs.mkdirSync(OUT, { recursive: true });

// the reference palette's light surface and its first categorical slots: after = blue, before = orange, a third = aqua
const SURF = '#fcfcfb', GRID = '#e4e3df', INK = '#0b0b0b', INK2 = '#52514e', AFTER = '#2a78d6', BEFORE = '#eb6834', THIRD = '#1baf7a';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const f1 = x => (Math.round(x * 10) / 10).toFixed(1);

// one panel: x / y ranges, ticks, series [{ pts: [[x, y]], color, dash, label, dots }], the -20 deg bar
function panel(o) {
  const { x0, y0, w, h, xr, yr, xt, yt, title, xl, yl, series, bar } = o;
  const X = x => x0 + (x - xr[0]) / (xr[1] - xr[0]) * w, Y = y => y0 + h - (y - yr[0]) / (yr[1] - yr[0]) * h;
  let s = `<text x="${x0}" y="${y0 - 10}" font-size="13" font-weight="600" fill="${INK}">${esc(title)}</text>`;
  for (const t of yt) s += `<line x1="${x0}" y1="${Y(t)}" x2="${x0 + w}" y2="${Y(t)}" stroke="${GRID}"/><text x="${x0 - 5}" y="${Y(t) + 3.5}" font-size="10" fill="${INK2}" text-anchor="end">${t}</text>`;
  for (const t of xt) s += `<text x="${X(t)}" y="${y0 + h + 14}" font-size="10" fill="${INK2}" text-anchor="middle">${t}</text>`;
  s += `<line x1="${x0}" y1="${y0 + h}" x2="${x0 + w}" y2="${y0 + h}" stroke="${INK2}" stroke-width="1"/>`;
  if (xl) s += `<text x="${x0 + w / 2}" y="${y0 + h + 30}" font-size="10.5" fill="${INK2}" text-anchor="middle">${esc(xl)}</text>`;
  if (yl) s += `<text transform="translate(${x0 - 36},${y0 + h / 2}) rotate(-90)" font-size="10.5" fill="${INK2}" text-anchor="middle">${esc(yl)}</text>`;
  if (bar != null) s += `<line x1="${x0}" y1="${Y(bar)}" x2="${x0 + w}" y2="${Y(bar)}" stroke="${INK2}" stroke-dasharray="5 4"/><text x="${x0 + w - 3}" y="${Y(bar) - 4}" font-size="9.5" fill="${INK2}" text-anchor="end">nose-over bar ${bar}</text>`;
  const cl = v => Math.max(yr[0], Math.min(yr[1], v));
  for (const se of series) {
    if (se.dots) for (const [x, y, tip] of se.pts) s += `<circle cx="${X(x)}" cy="${Y(cl(y))}" r="4.5" fill="${se.color}" stroke="${SURF}" stroke-width="2"><title>${esc(tip || se.label + ': ' + f1(y))}</title></circle>`;
    else {
      const d = se.pts.filter(p => p[0] >= xr[0] && p[0] <= xr[1]).map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(cl(p[1])).toFixed(1)).join('');
      s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round"${se.dash ? ' stroke-dasharray="' + se.dash + '"' : ''}><title>${esc(se.label)}</title></path>`;
    }
  }
  return s;
}
function legend(x, y, items) {
  let s = '', cx = x;
  for (const it of items) {
    s += it.dots ? `<circle cx="${cx + 8}" cy="${y - 4}" r="4.5" fill="${it.color}"/>` : `<line x1="${cx}" y1="${y - 4}" x2="${cx + 18}" y2="${y - 4}" stroke="${it.color}" stroke-width="2.5"${it.dash ? ' stroke-dasharray="' + it.dash + '"' : ''}/>`;
    s += `<text x="${cx + 24}" y="${y}" font-size="11" fill="${INK}">${esc(it.label)}</text>`;
    cx += 30 + it.label.length * 6.1;
  }
  return s;
}
const svg = (w, h, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif"><title>${esc(title)}</title><rect width="${w}" height="${h}" fill="${SURF}"/>${body}</svg>\n`;
const run = (J, key, w) => (J.sweep || []).find(r => r.key === key && r.wind === w);
// the pitch from the roll's start to CLIMB (or the end), only while a float is wet (the pitch ON THE WATER), NaN gaps split
// (a run that noses over is drawn to 1 s past it: what follows is the wreck afloat)
const wetPitch = r => r ? r.tr.filter(t => r.tNose == null || t[0] <= r.tNose - r.roll0 + 1).map(t => [t[0], t[6] ? t[2] : null]) : [];
const lineOf = pts => { const out = []; let cur = []; for (const p of pts) { if (p[1] == null) { if (cur.length) out.push(cur); cur = []; } else cur.push(p); } if (cur.length) out.push(cur); return out; };

// 1. pitch_twin.svg - the twin's pitch on the water, before / after, at 0 / 2 / 4 / 5 m/s
{
  const W = 1100, H = 560, winds = [0, 2, 4, 5];
  let body = `<text x="20" y="24" font-size="15" font-weight="700" fill="${INK}">The twin on floats: pitch while a float is wet, from the throttle to CLIMB (THE PILOT, the SEA lane, straight across)</text>`;
  body += legend(20, 46, [{ label: 'before (the assembled base)', color: BEFORE }, { label: 'after (G1880-G1881)', color: AFTER }]);
  winds.forEach((w, i) => {
    const x0 = 70 + (i % 2) * 530, y0 = 90 + Math.floor(i / 2) * 240;
    const rb = run(B, 'twinFloats', w), ra = run(A, 'twinFloats', w);
    const series = [];
    for (const seg of lineOf(wetPitch(rb))) series.push({ pts: seg, color: BEFORE, label: `before, ${w} m/s` });
    for (const seg of lineOf(wetPitch(ra))) series.push({ pts: seg, color: AFTER, label: `after, ${w} m/s` });
    const tag = r => !r ? '-' : r.noseOver ? 'NOSE-OVER (' + f1(r.pitchMin) + ')' : r.climb ? 'away, lowest ' + f1(r.pitchMin) : 'not away';
    body += panel({ x0, y0, w: 470, h: 170, xr: [0, 20], yr: [-90, 60], xt: [0, 5, 10, 15, 20], yt: [-90, -60, -30, 0, 30, 60], bar: -20,
      title: `${w} m/s across - before: ${tag(rb)}; after: ${tag(ra)}`, xl: 's from the throttle', yl: 'pitch, deg', series });
  });
  fs.writeFileSync(path.join(OUT, 'pitch_twin.svg'), svg(W, H, 'DMG-FLOATTO: the twin on floats, pitch on the water before / after', body));
}

// 2. sweep.svg - GATE DMGFLOATTO's sweep: the lowest pitch at a float contact, and the run's swing, against the wind
{
  const W = 1100, H = 600, winds = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  let body = `<text x="20" y="24" font-size="15" font-weight="700" fill="${INK}">GATE DMGFLOATTO's sweep: the validated floatplanes, 0-5 m/s straight across, judged to CLIMB</text>`;
  body += legend(20, 46, [{ label: 'before', color: BEFORE, dots: true }, { label: 'after', color: AFTER, dots: true }]);
  const keys = [['twinFloats', 'twin on floats'], ['floats', 'Cessna on floats']];
  keys.forEach(([k, name], c) => {
    const x0 = 80 + c * 530;
    const pts = (J, m) => winds.map(w => run(J, k, w)).filter(Boolean).map(r => [r.wind + (J === B ? -0.07 : 0.07), m(r), `${J === B ? 'before' : 'after'} ${r.wind} m/s: ${m === lo ? 'lowest pitch ' + f1(r.pitchMin) + ' deg' : 'swing ' + f1(r.swingRun) + ' deg'}${r.climb ? '' : ' (not away)'}${r.noseOver ? ' NOSE-OVER' : ''}`]);
    const lo = r => r.pitchMin, sw = r => r.swingRun;
    body += panel({ x0, y0: 90, w: 460, h: 190, xr: [-0.3, 5.3], yr: [-90, 10], xt: winds.filter(w => w % 1 === 0), yt: [-90, -60, -30, 0], bar: -20,
      title: `${name}: the lowest pitch at a float contact (deg)`, xl: 'crosswind, m/s', yl: 'deg', series: [{ dots: true, color: BEFORE, label: 'before', pts: pts(B, lo) }, { dots: true, color: AFTER, label: 'after', pts: pts(A, lo) }] });
    body += panel({ x0, y0: 360, w: 460, h: 170, xr: [-0.3, 5.3], yr: [0, 180], xt: winds.filter(w => w % 1 === 0), yt: [0, 30, 90, 180], bar: null,
      title: `${name}: the run's heading swing, deg (bound 30)`, xl: 'crosswind, m/s', yl: 'deg', series: [{ dots: true, color: BEFORE, label: 'before', pts: pts(B, sw) }, { dots: true, color: AFTER, label: 'after', pts: pts(A, sw) }] });
    body += `<line x1="${x0}" y1="${360 + 170 - 30 / 180 * 170}" x2="${x0 + 460}" y2="${360 + 170 - 30 / 180 * 170}" stroke="${INK2}" stroke-dasharray="5 4"/>`;
  });
  fs.writeFileSync(path.join(OUT, 'sweep.svg'), svg(W, H, 'DMG-FLOATTO: the crosswind sweep before / after', body));
}

// 3. cause.svg - the twin at 2 and 5 m/s on the base core: the chop the wind raises vs the sea flattened
if (F) {
  const W = 1100, H = 330;
  let body = `<text x="20" y="24" font-size="15" font-weight="700" fill="${INK}">The cause: the chop the wind raises on the lane (the base core, the twin on floats; the same wind, the sea flattened)</text>`;
  body += legend(20, 46, [{ label: 'base, the wind and its chop', color: BEFORE }, { label: 'base, the wind, the sea flat', color: THIRD }, { label: 'after, the wind and its chop', color: AFTER }]);
  [2, 5].forEach((w, i) => {
    const series = [];
    for (const [J, col, lab] of [[B, BEFORE, 'base, chop'], [F, THIRD, 'base, flat'], [A, AFTER, 'after, chop']]) for (const seg of lineOf(wetPitch(run(J, 'twinFloats', w)))) series.push({ pts: seg, color: col, label: `${lab}, ${w} m/s` });
    body += panel({ x0: 70 + i * 530, y0: 90, w: 470, h: 170, xr: [0, 16], yr: [-90, 60], xt: [0, 4, 8, 12, 16], yt: [-90, -60, -30, 0, 30, 60], bar: -20,
      title: `${w} m/s across (waves ${w === 2 ? '0.07' : '0.18'} m crest to trough, beam-on)`, xl: 's from the throttle', yl: 'pitch on the water, deg', series });
  });
  fs.writeFileSync(path.join(OUT, 'cause.svg'), svg(W, H, 'DMG-FLOATTO: the crosswind failures are the chop', body));
}
console.log('written to ' + OUT);
