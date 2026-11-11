// refpage2.js - THE REFERENCE PAGE (prototype 2): REAL-FIGURES' own scoring (tools/real_report.js scorePlane on the newest
// result per plane, its verdicts recomputed from the current real_refs.js, exactly as the report does): the global score,
// the triangle (geometry / specs / performance), the score per section, then the discrepancy of every item, per section.
'use strict';
const fs = require('fs'), path = require('path');
const FLY = '/workspace/pp-wt/flyDiy', EV = path.join(FLY, 'reports', 'evidence');
const RREP = require(path.join(FLY, 'tools', 'real_report.js')), RC = require(path.join(FLY, 'tools', 'real_check.js')), RR = require(path.join(FLY, 'tools', 'real_refs.js'));
const TH = { bg: '#f3ede0', ink: '#2b2924', dim: '#6d675b', faint: '#9a9283', hair: '#d8cdb8', rule: 'rgba(43,41,36,.14)' };
const BAND = s => s == null ? ['#9a9283', 'no data'] : s >= 80 ? ['#6f8a3a', 'close'] : s >= 60 ? ['#c27a3e', 'fair'] : ['#b5462a', 'far'];
const LABEL = { span: 'span', S: 'wing area', length: 'length', cRoot: 'root chord', cTip: 'tip chord', hSpan: 'tailplane span', Sh: 'tailplane area', Sv: 'fin area',
  track: 'wheel track', height: 'height', engine: 'engine', hp: 'power', nE: 'engines', propD: 'propeller diameter', blades: 'blades', empty: 'empty weight',
  mtow: 'max weight', fuelL: 'fuel', seats: 'seats', Vs1: 'stall, clean', V75: 'cruise 75 %', Vmax: 'top speed', roc: 'rate of climb', roc2: 'climb, 2nd weight',
  LD: 'best glide', TO: 'take-off roll', TO50: 'take-off to 50 ft', LDG: 'landing roll', LDG50: 'landing from 50 ft', TOW: 'water run', TOW2: 'water run, 2nd weight', TOWs: 'water time', TOW50: 'water to 50 ft' };
const UNIT = { span: 'm', S: 'm²', length: 'm', cRoot: 'm', cTip: 'm', hSpan: 'm', Sh: 'm²', Sv: 'm²', track: 'm', height: 'm', hp: 'hp', propD: 'm', empty: 'kg', mtow: 'kg',
  fuelL: 'L', Vs1: 'km/h', V75: 'km/h', Vmax: 'km/h', roc: 'm/s', roc2: 'm/s', LD: ':1', TO: 'm', TO50: 'm', LDG: 'm', LDG50: 'm', TOW: 'm', TOW2: 'm', TOWs: 's', TOW50: 'm' };
const DEC = { span: 2, S: 1, length: 2, cRoot: 2, cTip: 2, hSpan: 2, Sh: 2, Sv: 2, track: 2, height: 2, propD: 2, roc: 1, roc2: 1, LD: 1, TOWs: 1 };
const fv = (v, k) => { const d = DEC[k] || 0; if (Array.isArray(v)) { const a = Math.min(...v), b = Math.max(...v); return Math.abs(a - b) < Math.pow(10, -d) / 2 ? a.toFixed(d) : a.toFixed(d) + '–' + b.toFixed(d); } return typeof v === 'number' ? v.toFixed(d) : String(v); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const T = (x, y, s, o) => { o = o || {}; return `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${o.sz || 13}" fill="${o.c || TH.ink}"${o.w ? ` font-weight="${o.w}"` : ''}${o.a ? ` text-anchor="${o.a}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${esc(s)}</text>`; };
const L = (a, b, c, w, d) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w || 1}"${d ? ` stroke-dasharray="${d}"` : ''}/>`;
const r0 = x => x == null ? '—' : String(Math.round(x));
function load(key) {
  let o = null, sh = null, d0 = null;
  for (const d of ['REAL-CHECK-2026-11-07', 'REAL-CHECK-2026-11-08', 'REAL-CHECK-2026-11-09']) {
    const f = path.join(EV, d, key + '.json'), s = path.join(EV, d, key + '.shape.json');
    if (fs.existsSync(f)) { o = JSON.parse(fs.readFileSync(f, 'utf8')); d0 = d; } if (fs.existsSync(s)) sh = JSON.parse(fs.readFileSync(s, 'utf8')); }
  if (!o) return null; if (sh && sh.shape) o.shape = sh.shape;
  try { o.verdicts = RC.verdicts(o); } catch (e) {}
  return { o, d: d0, sc: RREP.scorePlane(o) };
}
function wrapText(s, n) { const w = String(s).split(' '), out = []; let a = ''; for (const x of w) { if ((a + ' ' + x).trim().length > n) { out.push(a.trim()); a = x; } else a += ' ' + x; } if (a.trim()) out.push(a.trim()); return out; }
function page(key, title) {
  const got = load(key); if (!got) return null;
  const { o, sc } = got, ref = RR.REFS[o.ref] || {}, W = 1200, H = 800;
  const out = [`<rect width="${W}" height="${H}" fill="${TH.bg}"/>`, `<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="14" fill="none" stroke="${TH.hair}" stroke-width="1.5"/>`];
  out.push(T(48, 58, 'AGAINST THE REAL ONE · REAL-FIGURES, ' + got.d.slice(-10), { sz: 12.5, c: TH.faint, w: 600, ls: 1.8 }));
  out.push(T(48, 94, (title || o.label.split(' (')[0]) + ' against the ' + ref.name, { sz: 25, w: 600 }));
  // THE GLOBAL SCORE
  const [gc, gw] = BAND(sc.overall);
  out.push(T(W - 48, 100, r0(sc.overall), { sz: 52, w: 600, c: gc, a: 'end' }) + T(W - 48, 122, '/ 100 · ' + gw + ' · evidence ' + (sc.confBand || '—'), { sz: 13, c: TH.dim, a: 'end' }));
  // THE TRIANGLE
  const cx = 190, cy = 290, R = 108, ax = ['geometry', 'specs', 'performance'], NM = { geometry: 'Geometry', specs: 'Specs', performance: 'Performance' };
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / 3, pt = (i, v) => [cx + Math.cos(ang(i)) * R * v / 100, cy + Math.sin(ang(i)) * R * v / 100];
  for (const lv of [25, 50, 75, 100]) out.push(`<polygon points="${ax.map((a, i) => pt(i, lv).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${TH.rule}" stroke-width="${lv === 100 ? 1.3 : 1}"/>`);
  ax.forEach((a, i) => out.push(L([cx, cy], pt(i, 100), TH.rule, 1)));
  out.push(`<polygon points="${ax.map((a, i) => pt(i, sc[a] || 0).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="${gc}" fill-opacity=".28" stroke="${gc}" stroke-width="2"/>`);
  ax.forEach((a, i) => { const p = pt(i, sc[a] || 0), q = pt(i, 128), c = BAND(sc[a])[0]; out.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" fill="${c}"/>`);
    out.push(T(q[0], q[1] + (i === 0 ? -4 : 6), NM[a], { sz: 13, w: 600, a: 'middle' }) + T(q[0], q[1] + (i === 0 ? 12 : 22), r0(sc[a]), { sz: 13, c, w: 600, a: 'middle' })); });
  // THE SECTIONS
  const sx = 380; let sy = 196;
  for (const a of ax) { const [c, w] = BAND(sc[a]), n = sc.items[a].length;
    out.push(T(sx, sy, NM[a], { sz: 16, w: 600 }) + T(sx + 330, sy, r0(sc[a]), { sz: 26, w: 600, c, a: 'end' }) + T(sx + 336, sy, '/ 100', { sz: 12, c: TH.dim }));
    out.push(`<rect x="${sx}" y="${sy + 10}" width="330" height="8" rx="4" fill="rgba(43,41,36,.08)"/><rect x="${sx}" y="${sy + 10}" width="${(3.3 * (sc[a] || 0)).toFixed(1)}" height="8" rx="4" fill="${c}"/>`);
    out.push(T(sx, sy + 36, n + ' items · ' + w + (a === 'performance' ? ' · the airframe\'s reading, else the handbook-flown' : a === 'specs' ? ' · engine, power, propeller, weights, fuel, seats' : ' · the key dimensions the book states'), { sz: 12, c: TH.dim }));
    sy += 74; }
  // THE REFERENCES: each source by its title (the figures themselves are on the rows below), grouped
  { let by = 196; const titles = str => { const out = []; for (const ch of String(str || '').split(';')) { const t = ch.split(':')[0].replace(/\(perf_study[^)]*\)/g, '').trim(); if (t && t.length > 3 && !out.includes(t)) out.push(t); } return out; };
    out.push(T(800, by - 22, 'REFERENCES', { sz: 11, c: TH.faint, w: 600, ls: 1.2 }));
    const block = (head, list) => { if (!list.length) return; out.push(T(800, by, head, { sz: 12, w: 600, c: TH.dim })); by += 18;
      for (const t of list.slice(0, 4)) { const lines = wrapText(t, 46); lines.forEach((ln, i) => { if (!i) out.push(`<circle cx="804" cy="${by - 4}" r="2.2" fill="${TH.dim}"/>`); out.push(T(814, by, ln, { sz: 12.5 })); by += 16; }); by += 4; } by += 6; };
    block('Performance', titles(ref.src)); block('Dimensions', titles(ref.geoSrc));
    if (o.engineNote) { out.push(T(800, by, 'Not like for like', { sz: 12, w: 600, c: '#c27a3e' })); by += 17; for (const ln of wrapText(o.engineNote, 50).slice(0, 3)) { out.push(T(800, by, ln, { sz: 12, c: '#c27a3e' })); by += 16; } } }
  // THE DISCREPANCY, per section: every item a bar from zero (ours against the book, signed), coloured by its score
  const top = 438; out.push(T(48, top - 22, 'THE DISCREPANCY, ITEM BY ITEM', { sz: 11, c: TH.faint, w: 600, ls: 1.2 }));
  out.push(`<text x="1152" y="${top - 22}" font-size="12" text-anchor="end"><tspan font-weight="600" fill="${TH.ink}">ours</tspan><tspan fill="${TH.faint}" dx="8">the real one</tspan></text>`);
  ax.forEach((a, ci) => {
    const x0 = 48 + ci * 372, mid = x0 + 252, span = 0.30, half = 88, X = e => mid + half * Math.max(-1, Math.min(1, e / span));
    out.push(T(x0, top, NM[a], { sz: 13, w: 600 }) + L([mid, top + 8], [mid, 748], 'rgba(43,41,36,.4)', 1) + T(X(-span), top, '−30 %', { sz: 10, c: TH.faint, a: 'middle' }) + T(X(span), top, '+30 %', { sz: 10, c: TH.faint, a: 'middle' }));
    for (const g of [-0.3, -0.15, 0.15, 0.3]) out.push(L([X(g), top + 8], [X(g), 748], TH.rule, 1, '2 3'));
    const items = sc.items[a].slice().sort((p, q) => (p.score == null ? 101 : p.score) - (q.score == null ? 101 : q.score));
    const step = Math.min(34, (748 - top - 14) / Math.max(1, items.length));
    items.forEach((it, i) => {
      const y = top + 24 + i * step, e = it.signed != null ? it.signed : it.err, [c] = BAND(it.score), nm = LABEL[it.k] || it.k, u = UNIT[it.k] || '';
      out.push(T(x0, y + 1, nm + (a === 'performance' && it.src && !/^airframe/.test(it.src) ? ' (handbook)' : ''), { sz: 12.5, w: 500 }));
      const cut = (v, n) => { v = String(v); return v.length > n ? v.slice(0, n - 1) + '…' : v; };
      // the values: ours in bold black, the real figure in grey (the key is in the section's header)
      const ov = typeof it.ours === 'string' ? cut(it.ours, 15) : fv(it.ours, it.k), rv = typeof it.ref === 'string' ? cut(it.ref, 15) : fv(it.ref, it.k);
      out.push(`<text x="${x0}" y="${(y + 15).toFixed(1)}" font-size="11.5"><tspan font-weight="600" fill="${TH.ink}">${esc(ov)}</tspan><tspan fill="${TH.faint}" dx="6">${esc(rv)}</tspan>${u ? `<tspan fill="${TH.faint}" dx="4">${esc(u)}</tspan>` : ''}</text>`);
      if (typeof e === 'number' && isFinite(e)) { const xa = X(0), xb = X(e);
        out.push(`<rect x="${Math.min(xa, xb).toFixed(1)}" y="${y - 2}" width="${Math.max(2, Math.abs(xb - xa)).toFixed(1)}" height="9" rx="2" fill="${c}"/>` + T(Math.abs(e) > span ? (e > 0 ? X(span) + 4 : X(-span) - 4) : xb + (e >= 0 ? 4 : -4), y + 6, (e >= 0 ? '+' : '−') + Math.abs(Math.round(e * 100)) + ' %', { sz: 10.5, c, a: e >= 0 ? 'start' : 'end', w: 600 })); }
      else out.push(T(mid, y + 6, it.score >= 100 ? 'the same' : 'different', { sz: 11, c, a: 'middle', w: 600 }));
    });
  });
  out.push(T(48, H - 32, 'Flown in node at the lightest, typical and maximum loads. Scores as REAL-FIGURES computes them (tools/real_report.js): 100 when ours holds the real figure, less with the distance outside it.', { sz: 11, c: TH.faint }));
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="'IBM Plex Sans', system-ui, sans-serif">${out.join('')}</svg>`;
}
module.exports = { page, load };
if (require.main === module) { const k = process.argv[2] || 'c172v2'; fs.writeFileSync(__dirname + '/ref_try.html', `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap"></head><body style="margin:0">${page(k)}</body></html>`); }
