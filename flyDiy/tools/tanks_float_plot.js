#!/usr/bin/env node
// tanks_float_plot.js - G1385 TANKS-FLOAT: the evidence's plots and table, from tools/tanks_float.js's runs.
// Per build x entry one SVG of four panels sharing the time axis - the freeboard at the wing roots (the two sides'
// mean), the pitch, the roll, the airframe's highest point over the water (under 0: sunk) - one line per fuel state
// (full / half / empty) on this branch, and G1384's (the base, no tanks) full-tanks run dashed grey for the before.
// Plus summary.json and summary.md (the times to the wing roots under and to sunk, the attitude at 10 / 60 s).
// Usage: node tools/tanks_float_plot.js [--dir reports/evidence/TANKS-FLOAT]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const DIR = path.resolve(opt('dir', path.join(__dirname, '..', 'reports', 'evidence', 'TANKS-FLOAT')));
const RUNS = path.join(DIR, 'runs');
const R = {};
for (const f of fs.readdirSync(RUNS).filter(f => f.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(RUNS, f), 'utf8'));
  R[`${j.core}|${j.build}|${j.entry}|${j.fuel}`] = j;
}
const NAMES = { cub: "the user's Cub (45 L nose tank)", cubWing: "the user's Cub, its 45 L in the wing roots", metal: 'the metal Cessna (28 L nose tank)', jodel: 'the Jodel (45 L nose tank)' };
const ENTRY = { settle: 'set down on the water, still', ditch: 'ditched at 80 km/h, sinking 1 m/s' };
// the reference palette's first three categorical slots (validated all-pairs), the before in muted grey
const COL = { full: '#2a78d6', half: '#eb6834', empty: '#1baf7a', base: '#8a8984' };
const INK = '#0b0b0b', INK2 = '#52514e', GRID = '#e4e3df', SURF = '#fcfcfb';
const PANELS = [
  { key: 'fb', label: 'freeboard at the wing roots (m; clipped to +-1.5 - the sinking is the last panel)', clip: [-1.5, 1.5], get: r => r.fbL == null ? null : (r.fbL + r.fbR) / 2 },
  { key: 'pitch', label: 'pitch (deg, nose-up +)', get: r => r.pitch },
  { key: 'roll', label: 'roll (deg)', get: r => r.roll },
  { key: 'top', label: 'highest point over the water (m; under 0 = sunk)', get: r => r.top },
];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const nice = (lo, hi) => { const span = hi - lo || 1, st = Math.pow(10, Math.floor(Math.log10(span / 4))), k = [1, 2, 5, 10].find(m => span / (st * m) <= 5) * st;
  const a = Math.floor(lo / k) * k, b = Math.ceil(hi / k) * k, t = []; for (let v = a; v <= b + k / 2; v += k) t.push(+v.toFixed(6)); return { a, b, t }; };

function svgFor(build, entry) {
  const series = [];
  for (const fk of ['full', 'half', 'empty']) { const j = R[`this|${build}|${entry}|${fk}`]; if (j) series.push({ id: fk, name: `${fk} tanks (${j.mass.toFixed(0)} kg)`, j, col: COL[fk], dash: '' }); }
  const b = R[`base|${build}|${entry}|full`];
  if (b) series.push({ id: 'base', name: `before (G1384, no tanks), full`, j: b, col: COL.base, dash: '6 4' });
  if (!series.length) return null;
  const W = 880, PH = 150, GAP = 34, L = 64, RT = 24, TOP = 78, H = TOP + PANELS.length * (PH + GAP) + 30;
  const T = Math.max(...series.map(s => s.j.secs));
  const X = t => L + (W - L - RT) * t / T;
  let g = '';
  g += `<text x="${L}" y="26" font-size="16" font-weight="600" fill="${INK}">${esc(NAMES[build] || build)} - ${esc(ENTRY[entry])}</text>`;
  // legend (always present: more than one series), in the series order
  let lx = L;
  for (const s of series) { g += `<line x1="${lx}" y1="50" x2="${lx + 22}" y2="50" stroke="${s.col}" stroke-width="2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
    g += `<text x="${lx + 28}" y="54" font-size="12" fill="${INK2}">${esc(s.name)}</text>`; lx += 40 + 6.6 * s.name.length; }
  PANELS.forEach((P, k) => {
    const y0 = TOP + k * (PH + GAP);
    let lo = Infinity, hi = -Infinity;
    for (const s of series) for (const r of s.j.rows) { const v = P.get(r); if (v != null && Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
    if (P.key === 'fb' || P.key === 'top') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (P.clip) { lo = Math.max(lo, P.clip[0]); hi = Math.min(hi, P.clip[1]); }
    const n = nice(lo, hi), Y = v => y0 + PH - PH * (v - n.a) / ((n.b - n.a) || 1);
    g += `<text x="${L}" y="${y0 - 8}" font-size="12" font-weight="600" fill="${INK2}">${esc(P.label)}</text>`;
    for (const v of n.t) { g += `<line x1="${L}" x2="${W - RT}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? '#b9b8b2' : GRID}" stroke-width="1"/>`;
      g += `<text x="${L - 6}" y="${Y(v) + 4}" font-size="11" text-anchor="end" fill="${INK2}">${v}</text>`; }
    if (k === PANELS.length - 1) { const tt = nice(0, T).t;
      for (const t of tt) if (t <= T) g += `<text x="${X(t)}" y="${y0 + PH + 16}" font-size="11" text-anchor="middle" fill="${INK2}">${t}${t === tt[tt.length - 1] || t + (tt[1] - tt[0]) > T ? ' s' : ''}</text>`; }
    for (const s of series) {
      let d = '', pen = false;
      for (const r of s.j.rows) { const v = P.get(r); if (v == null || !Number.isFinite(v)) { pen = false; continue; }
        d += `${pen ? 'L' : 'M'}${X(r.t).toFixed(1)},${Y(Math.max(n.a, Math.min(n.b, v))).toFixed(1)}`; pen = true; }
      g += `<path d="${d}" fill="none" stroke="${s.col}" stroke-width="2" stroke-linejoin="round" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}><title>${esc(s.name)}</title></path>`;
      // the moment it sank, marked on the last panel
      if (P.key === 'top' && s.j.tSunk != null) { const xs = X(s.j.tSunk);
        g += `<circle cx="${xs}" cy="${Y(0)}" r="4.5" fill="${s.col}" stroke="${SURF}" stroke-width="2"><title>${esc(s.name)}: sunk at ${s.j.tSunk} s</title></circle>`; }
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, -apple-system, Segoe UI, sans-serif">` +
         `<rect width="${W}" height="${H}" fill="${SURF}"/>${g}</svg>\n`;
}

const at = (j, s) => j.rows.find(r => r.t >= s) || j.rows[j.rows.length - 1];
const sum = [];
const md = ['| build | entry | fuel | mass kg | wing roots under | sunk | 10 s: freeboard / pitch / roll | 60 s: freeboard / pitch / roll | before (G1384): sunk |', '|---|---|---|---|---|---|---|---|---|'];
const fmt = (r) => r ? `${(((r.fbL ?? NaN) + (r.fbR ?? NaN)) / 2).toFixed(2)} m / ${r.pitch.toFixed(0)} / ${r.roll.toFixed(0)}` : '-';
for (const build of Object.keys(NAMES)) for (const entry of Object.keys(ENTRY)) {
  const svg = svgFor(build, entry);
  if (svg) fs.writeFileSync(path.join(DIR, `${build}_${entry}.svg`), svg);
  const b = R[`base|${build}|${entry}|full`];
  for (const fk of ['full', 'half', 'empty']) {
    const j = R[`this|${build}|${entry}|${fk}`]; if (!j) continue;
    const row = { build, entry, fuel: fk, mass: +j.mass.toFixed(1), tRootsUnder: j.tRootsUnder, tSunk: j.tSunk, secs: j.secs,
                  at10: at(j, 10), at60: at(j, 60), baseSunk: b ? b.tSunk : undefined, tanks: j.tanks };
    sum.push(row);
    md.push(`| ${build} | ${entry} | ${fk} | ${row.mass.toFixed(0)} | ${j.tRootsUnder ?? 'never'} s | ${j.tSunk == null ? `afloat at ${j.secs} s` : j.tSunk + ' s'} | ${fmt(row.at10)} | ${fmt(row.at60)} | ${fk === 'full' && b ? (b.tSunk == null ? `afloat at ${b.secs} s` : b.tSunk + ' s') : ''} |`);
  }
}
fs.writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify(sum, null, 1));
fs.writeFileSync(path.join(DIR, 'summary.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
