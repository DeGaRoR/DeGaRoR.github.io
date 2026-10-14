#!/usr/bin/env node
// G2030-G2034 DMG-RECAL: the evidence plots (reports/evidence/DMG-RECAL/*.svg) from the measured data in
// reports/evidence/DMG-RECAL/data/ (each file's provenance in that folder's README.md). Plain SVG, no dependency.
//   node tools/dmgrecal_evidence.js
'use strict';
const fs = require('fs'), path = require('path');
const E = path.join(__dirname, '..', 'reports', 'evidence', 'DMG-RECAL'), D = path.join(E, 'data');
const rd = f => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8').replace(/^RESULT /, ''));
const has = f => fs.existsSync(path.join(D, f));
const COL = ['#2a6fdb', '#d9480f', '#2b8a3e', '#7048e8', '#868e96'];

// one panel: series [{name, pts: [[x, y]], col, dash}], axes, optional bands [{y0, y1, col, label}] and marks
function panel(o) {
  const W = o.W || 620, H = o.H || 300, L = 56, R = 16, T = 30, B = 42;
  const xs = o.series.flatMap(s => s.pts.map(p => p[0])), ys = o.series.flatMap(s => s.pts.map(p => p[1]));
  const x0 = o.x0 ?? Math.min(...xs), x1 = o.x1 ?? Math.max(...xs);
  const y0 = o.y0 ?? Math.min(...ys), y1 = o.y1 ?? Math.max(...ys);
  const X = x => L + (x - x0) / (x1 - x0) * (W - L - R), Y = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  let s = `<g transform="translate(${o.ox || 0},${o.oy || 0})">`;
  s += `<text x="${L}" y="18" font-size="13" font-weight="bold">${o.title}</text>`;
  (o.bands || []).forEach((b, bi) => { s += `<rect x="${L}" y="${Y(Math.min(y1, b.y1))}" width="${W - L - R}" height="${Y(Math.max(y0, b.y0)) - Y(Math.min(y1, b.y1))}" fill="${b.col}" opacity="0.18"/><text x="${W - R - 4}" y="${Y(Math.min(y1, b.y1)) + 12 + 12 * bi}" font-size="10" text-anchor="end" fill="#495057">${b.label}</text>`; });
  const tick = (a, b, n) => { const st = Math.pow(10, Math.floor(Math.log10((b - a) / n))), m = [1, 2, 5, 10].find(k => (b - a) / (k * st) <= n) * st; const out = []; for (let v = Math.ceil(a / m) * m; v <= b + 1e-9; v += m) out.push(+v.toFixed(6)); return out; };
  for (const v of tick(x0, x1, 8)) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H - B}" stroke="#e9ecef"/><text x="${X(v)}" y="${H - B + 14}" font-size="10" text-anchor="middle">${v}</text>`;
  for (const v of tick(y0, y1, 6)) s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e9ecef"/><text x="${L - 6}" y="${Y(v) + 3}" font-size="10" text-anchor="end">${v}</text>`;
  s += `<rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="none" stroke="#adb5bd"/>`;
  s += `<text x="${(L + W - R) / 2}" y="${H - 8}" font-size="11" text-anchor="middle">${o.xl}</text><text x="14" y="${(T + H - B) / 2}" font-size="11" text-anchor="middle" transform="rotate(-90 14 ${(T + H - B) / 2})">${o.yl}</text>`;
  o.series.forEach((se, i) => {
    const pts = se.pts.filter(p => p[0] >= x0 && p[0] <= x1).map(p => `${X(p[0]).toFixed(1)},${Y(Math.max(y0, Math.min(y1, p[1]))).toFixed(1)}`).join(' ');
    s += `<polyline points="${pts}" fill="none" stroke="${se.col || COL[i]}" stroke-width="1.8"${se.dash ? ` stroke-dasharray="${se.dash}"` : ''}/>`;
    s += `<line x1="${L + 8}" x2="${L + 28}" y1="${T + 14 + 14 * i}" y2="${T + 14 + 14 * i}" stroke="${se.col || COL[i]}" stroke-width="2"${se.dash ? ` stroke-dasharray="${se.dash}"` : ''}/><text x="${L + 32}" y="${T + 18 + 14 * i}" font-size="10.5">${se.name}</text>`;
  });
  for (const m of o.marks || []) s += `<circle cx="${X(m[0])}" cy="${Y(m[1])}" r="3.5" fill="${m[2] || '#000'}"/><text x="${X(m[0]) + 5}" y="${Y(m[1]) - 5}" font-size="10">${m[3] || ''}</text>`;
  return s + '</g>';
}
const svg = (W, H, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>\n`;
const out = (f, s) => { fs.writeFileSync(path.join(E, f), s); console.log('wrote', f); };

// G2030 - DMGHULL: the side term over U w against the slip angle (the wetted keel's m(TE)), and the wetted keel
if (has('hull_law_cessna_game.json')) {
  const sets = [['Cessna on floats, the game\'s (hump: 0.343 m, 10.3 deg)', 'hull_law_cessna_game.json'], ['Cessna on floats, the file as written (hump: 0.274 m, 10.6 deg)', 'hull_law_cessna_file.json'], ['twin on floats, the game\'s (hump)', 'hull_law_twin_game.json']].filter(x => has(x[1]));
  const ser = sets.map(([n, f]) => { const c = rd(f).curves.hump; return { name: n, pts: c.filter(x => x[3] != null).map(x => [x[0], x[3] / c[1][3]]) }; });
  const wet = sets.map(([n, f]) => { const c = rd(f).curves.hump; return { name: n, pts: c.map(x => [x[0], x[4]]) }; });
  const sid = sets.map(([n, f]) => { const c = rd(f).curves.hump, m = Math.max(...c.map(x => x[1])); return { name: n, pts: c.map(x => [x[0], x[1] / m]) }; });
  out('hull_side.svg', svg(640, 940,
    panel({ title: 'G2030 - the side term over U w (normalised to its small-slip value): Jones\' form at a fixed wetted hull', xl: 'slip angle (deg)', yl: 'F_side / (U w) / its 5-deg value', series: ser, x0: 0, x1: 90, y0: 0.95, y1: 1.4 }) +
    panel({ oy: 310, title: 'the keel stations under the water at the same pose (the afterbody re-wets as U = V cos b falls)', xl: 'slip angle (deg)', yl: 'wet keel stations', series: wet, x0: 0, x1: 90 }) +
    panel({ oy: 620, title: 'the side term itself (normalised to its peak): the peak moves to 50-55 deg where the stern re-wets', xl: 'slip angle (deg)', yl: 'F_side / max', series: sid, x0: 0, x1: 90, y0: 0, y1: 1.05 })));
}
// G2032 - DMGPLOUGH: the keel trim and the floats' resistance against C_V through the hump
if (has('plough_cessna_game.json')) {
  const cur = f => rd(f).curve, B = rd('plough_cessna_game.json').B, cv = V => V / Math.sqrt(9.81 * B);
  const txt = f => fs.readFileSync(path.join(D, f), 'utf8').split('\n').filter(l => l.startsWith('Cv')).map(l => l.split(/\s+/)).map(a => [+a[1], +a[5], +a[7]]);
  const tS = [{ name: 'the game\'s Cessna on floats (951.5 kg)', pts: cur('plough_cessna_game.json').map(x => [cv(x[1]), x[3]]) },
    { name: 'the file as written (1018.2 kg)', pts: cur('plough_cessna_file.json').map(x => [cv(x[1]), x[3]]) }];
  if (has('plough_cessna_game_ballast1018.txt')) tS.push({ name: 'the game\'s, ballasted to 1018 kg (instrument)', pts: txt('plough_cessna_game_ballast1018.txt').map(a => [a[0], a[2]]), dash: '5 3' });
  const rS = [{ name: 'the game\'s', pts: cur('plough_cessna_game.json').map(x => [cv(x[1]), x[2]]) }, { name: 'the file as written', pts: cur('plough_cessna_file.json').map(x => [cv(x[1]), x[2]]) }];
  const hg = rd('plough_cessna_game.json').hump, hf = rd('plough_cessna_file.json').hump;
  out('plough_hump.svg', svg(640, 640,
    panel({ title: 'G2032 - the keel trim through the plough (calm, THE PILOT, the stick neutral: G396.4)', xl: 'C_V = V / sqrt(g B)', yl: 'keel trim (deg)', series: tS, x0: 1, x1: 4.2, y0: 0, y1: 16,
      bands: [{ y0: 6, y1: 12, col: '#2b8a3e', label: 'asserted 6-12 (G2032)' }, { y0: 8, y1: 12, col: '#868e96', label: 'recalled 8-12 (reported)' }],
      marks: [[hg.Cv, hg.trim, COL[0], 'hump ' + hg.trim.toFixed(1)], [hf.Cv, hf.trim, COL[1], 'hump ' + hf.trim.toFixed(1)]] }) +
    panel({ oy: 320, title: 'the floats\' water resistance / W (its maximum is the hump)', xl: 'C_V', yl: 'R / W', series: rS, x0: 1, x1: 4.2, y0: 0, y1: 0.1 })));
}
// G2034 - DMGTYRE: the user's Cub's crosswind roll-out (the heading error from the touchdown)
{
  const csv = f => { const L = fs.readFileSync(path.join(D, f), 'utf8').trim().split('\n'), h = L[0].split(','); return L.slice(1).map(l => { const a = l.split(','); const o = {}; h.forEach((k, i) => { o[k] = /^-?[\d.]+$/.test(a[i]) ? +a[i] : a[i]; }); return o; }); };
  const roll = f => { const r = csv(f), i0 = r.findIndex(x => x.phase === 'ROLLOUT'); if (i0 < 0) return []; const t0 = r[i0].t; return r.slice(i0).filter(x => x.phase === 'ROLLOUT' || x.phase === 'STOPPED').map(x => [x.t - t0, x.e]); };
  const sets = [['4 m/s: before (7846e790) - full flap, touched 1.03 Vs0', 'cub_rollout_before_4.csv'], ['4 m/s: after (G2034) - flapless, touched 1.14 Vs', 'cub_rollout_after_4.csv'],
    ['5 m/s: before', 'cub_rollout_before_5.csv', '5 3'], ['5 m/s: after', 'cub_rollout_after_5.csv', '5 3'], ['4 m/s: the file as written (flapless)', 'cub_rollout_file_4.csv', '2 2']].filter(x => has(x[1]));
  if (sets.length) out('cub_rollout.svg', svg(640, 320, panel({ title: 'G2034 - the user\'s Cub, crosswind roll-out at HOME (GATE DMGTYRE 3): heading error', xl: 's from the touchdown', yl: 'heading error (deg)',
    series: sets.map(([n, f, d], i) => ({ name: n, pts: roll(f), dash: d, col: COL[[0, 2, 0, 2, 4][i]] })), x0: 0, x1: 20, y0: -32, y1: 32,
    bands: [{ y0: -15, y1: 15, col: '#2b8a3e', label: 'PILOTMATRIX\'s 15 deg (no ground loop)' }] })));
}
// G2033 - FLOATS: the water's lift from the touch, frame by frame
if (has('floats_landing_game.json')) {
  const g = rd('floats_landing_game.json'), f = has('floats_landing_file.json') ? rd('floats_landing_file.json') : null;
  const ser = [{ name: 'the game\'s twin (drawn floats): touch 0.95 m/s, then 4 skips', pts: g.map(x => [x[0], x[1]]) }];
  if (f) ser.push({ name: 'the file as written: touch 0.38 m/s, no skip', pts: f.map(x => [x[0], x[1]]) });
  out('floats_landing.svg', svg(640, 320, panel({ title: 'G2033 - GATE FLOATS\' hands-off landing: L_water / W from the first touch', xl: 's from the first touch', yl: 'L / W', series: ser, x0: 0, x1: 12, y0: 0, y1: 2.8,
    bands: [{ y0: 0, y1: 2, col: '#2b8a3e', label: 'the touchdown\'s 2 W bound' }] })));
}
