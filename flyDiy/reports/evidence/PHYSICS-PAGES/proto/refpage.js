// refpage.js - THE REFERENCE PAGE (prototype): a plane against the real one it stands for, from REAL-FIGURES' own
// measurement (tools/real_check.js results in reports/evidence/REAL-CHECK-*, the rows and sources of tools/real_refs.js).
// One deviation axis for every figure: the book's band (its own scatter), our range across the weights the book's figure
// could have been stated at, the verdict (inside: they overlap; near: within 10 %; outside). The dimensions beside it.
'use strict';
const fs = require('fs'), path = require('path');
const FLY = '/workspace/pp-wt/flyDiy', EV = path.join(FLY, 'reports', 'evidence');
const R = require(path.join(FLY, 'tools', 'real_refs.js'));
const TH = { bg: '#f3ede0', ink: '#2b2924', dim: '#6d675b', faint: '#9a9283', hair: '#d8cdb8', rule: 'rgba(43,41,36,.14)' };
const VC = { inside: '#6f8a3a', near: '#c27a3e', outside: '#b5462a' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const T = (x, y, s, o) => { o = o || {}; return `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${o.sz || 13}" fill="${o.c || TH.ink}"${o.w ? ` font-weight="${o.w}"` : ''}${o.a ? ` text-anchor="${o.a}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${esc(s)}</text>`; };
const L = (a, b, c, w, d) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w || 1}"${d ? ` stroke-dasharray="${d}"` : ''}/>`;
const IND = { empty: ['Empty weight', 'kg', 0], Vs1: ['Stall, clean', 'km/h', 0], V75: ['Cruise, 75 % power', 'km/h', 0], Vmax: ['Top speed', 'km/h', 0], roc: ['Best climb', 'm/s', 1],
  LD: ['Best glide', ':1', 1], TO: ['Take-off run', 'm', 0], TO50: ['Take-off to 50 ft', 'm', 0], LDG: ['Landing roll', 'm', 0], LDG50: ['Landing from 50 ft', 'm', 0],
  TOW: ['Take-off run on water', 'm', 0], TOW50: ['Off water to 50 ft', 'm', 0], TOWs: ['Time to lift off water', 's', 0] };
const DIM = { span: ['Span', 'm'], length: ['Length', 'm'], height: ['Height', 'm'], S: ['Wing area', 'm²'], cRoot: ['Root chord', 'm'], cTip: ['Tip chord', 'm'], hSpan: ['Tailplane span', 'm'], Sh: ['Tailplane area', 'm²'], Sv: ['Fin area', 'm²'], track: ['Wheel track', 'm'] };
const fmt = (v, d) => (v == null || !isFinite(v) ? '—' : (+v).toFixed(d));
const rng = (a0, d) => { const a = Array.isArray(a0) ? a0.slice().sort((p, q) => p - q) : a0; return Array.isArray(a) ? (Math.abs(a[0] - a[1]) < 1e-9 ? fmt(a[0], d) : fmt(a[0], d) + '–' + fmt(a[1], d)) : fmt(a, d); };
const mid = a => Array.isArray(a) ? (a[0] + a[1]) / 2 : a;

function latest(key) {
  for (const d of ['REAL-CHECK-2026-11-09', 'REAL-CHECK-2026-11-08', 'REAL-CHECK-2026-11-07']) { const f = path.join(EV, d, key + '.json'); if (fs.existsSync(f)) return { d, r: JSON.parse(fs.readFileSync(f, 'utf8')) }; }
  return null;
}
function wrapText(s, n) { const w = String(s).split(' '), out = []; let a = ''; for (const x of w) { if ((a + ' ' + x).trim().length > n) { out.push(a.trim()); a = x; } else a += ' ' + x; } if (a.trim()) out.push(a.trim()); return out; }

function page(key, title) {
  const got = latest(key); if (!got) return null;
  const r = got.r, ref = R.REFS[r.ref] || {}, V = r.verdicts.filter(v => IND[v.k]);
  const n = w => V.filter(v => v.verdict === w).length;
  const W = 1200, H = 800, out = [`<rect width="${W}" height="${H}" fill="${TH.bg}"/>`, `<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="14" fill="none" stroke="${TH.hair}" stroke-width="1.5"/>`];
  out.push(T(48, 58, 'AGAINST THE REAL ONE · REAL-FIGURES, ' + got.d.slice(-10), { sz: 12.5, c: TH.faint, w: 600, ls: 1.8 }));
  out.push(T(48, 94, (title || r.label.split(' (')[0]) + ' and the ' + ref.name, { sz: 26, w: 600 }));
  out.push(T(48, 120, n('inside') + ' figures inside the book\'s own scatter, ' + n('near') + ' near (within 10 %), ' + n('outside') + ' outside. Flown in node through the game\'s own doors, at the lightest, typical and maximum loads.', { sz: 14, c: TH.dim }));
  // the deviation chart
  const x0 = 440, x1 = 720, span = 0.5, X = d => x0 + (x1 - x0) * (Math.max(-span, Math.min(span, d)) + span) / (2 * span);
  const top = 176, step = Math.min(40, 556 / Math.max(1, V.length));
  out.push(T(48, top - 18, 'EACH FIGURE AGAINST THE BOOK · OURS / BOOK', { sz: 11, c: TH.faint, w: 600, ls: 1.2 }));
  for (const g of [-0.5, -0.25, 0, 0.25, 0.5]) out.push(L([X(g), top - 10], [X(g), top + step * V.length - 14], g === 0 ? 'rgba(43,41,36,.45)' : TH.rule, g === 0 ? 1.2 : 1, g === 0 ? null : '2 3') + T(X(g), top - 14, (g > 0 ? '+' : '') + Math.round(g * 100) + ' %', { sz: 10.5, c: TH.faint, a: 'middle' }));
  const SRC = s => /^airframe/.test(s) ? 'the airframe' + (/grass/.test(s) ? ', grass' : '') : s === 'POH' ? 'the handbook\'s technique' : s === 'game' ? 'the game\'s pilot' : s === 'ledger' ? 'the mass ledger' : s;
  V.forEach((v, i) => {
    const y = top + i * step + 8, [nm, unit, d] = IND[v.k], m0 = mid(v.ref), rel = x => x / m0 - 1;
    const many = V.filter(q => q.k === v.k).length > 1;
    out.push(T(48, y + 4.5, nm, { sz: 13.5, w: 500 }) + (many ? T(48 + nm.length * 7.4 + 6, y + 4.5, SRC(v.src), { sz: 12, c: TH.dim }) : ''));
    out.push(T(x0 - 14, y + 4.5, rng(v.ours, d) + ' / ' + rng(v.ref, d) + ' ' + unit, { sz: 12, c: TH.dim, a: 'end' }));
    out.push(`<rect x="${X(rel(v.refBand[0])).toFixed(1)}" y="${y - 8}" width="${(X(rel(v.refBand[1])) - X(rel(v.refBand[0]))).toFixed(1)}" height="16" rx="3" fill="rgba(43,41,36,.09)"/>`);
    out.push(`<rect x="${X(rel(v.ref[0])).toFixed(1)}" y="${y - 8}" width="${Math.max(2, X(rel(v.ref[1])) - X(rel(v.ref[0]))).toFixed(1)}" height="16" fill="rgba(43,41,36,.28)"/>`);
    const c = VC[v.verdict] || TH.dim, a = X(rel(v.ours[0])), b = X(rel(v.ours[1]));
    out.push(`<rect x="${(Math.min(a, b) - 1.5).toFixed(1)}" y="${y - 4}" width="${Math.max(6, Math.abs(b - a) + 3).toFixed(1)}" height="8" rx="4" fill="${c}"/>`);
    if (Math.abs(rel(v.ours[0])) > span || Math.abs(rel(v.ours[1])) > span) out.push(T(rel(v.ours[1]) > 0 ? x1 + 6 : x0 - 6, y + 5, rel(v.ours[1]) > 0 ? '▶' : '◀', { sz: 9, c, a: 'middle' }));
    out.push(T(745, y + 4.5, v.verdict, { sz: 12.5, w: 600, c }));
  });
  // the key under the chart
  const ky = top + step * V.length + 6;
  out.push(`<rect x="48" y="${ky}" width="22" height="12" fill="rgba(43,41,36,.28)"/>` + T(76, ky + 10, 'the book\'s figure', { sz: 11.5, c: TH.dim }) + `<rect x="190" y="${ky}" width="22" height="12" fill="rgba(43,41,36,.09)"/>` + T(218, ky + 10, 'its own scatter', { sz: 11.5, c: TH.dim }) +
    `<rect x="320" y="${ky + 2.5}" width="26" height="7" rx="3.5" fill="${VC.inside}"/>` + T(352, ky + 10, 'ours, lightest to heaviest load', { sz: 11.5, c: TH.dim }));
  // the dimensions: real against ours
  const cx = 830; let y = top - 18;
  out.push(T(cx, y, 'THE SHAPE', { sz: 11, c: TH.faint, w: 600, ls: 1.2 })); y += 26;
  const ours = (r.shape && r.shape.dims) || {}, real = ref.dims || {};
  for (const k in DIM) { if (real[k] == null || ours[k] == null) continue; const rm = mid(real[k]), d = ours[k] / rm - 1, c = Math.abs(d) <= 0.03 ? VC.inside : Math.abs(d) <= 0.10 ? VC.near : VC.outside;
    out.push(T(cx, y, DIM[k][0], { sz: 13 }) + T(cx + 190, y, rng(real[k], 2), { sz: 12.5, c: TH.dim, a: 'end' }) + T(cx + 262, y, fmt(ours[k], 2), { sz: 12.5, a: 'end' }) + T(1152, y, (d > 0 ? '+' : '') + Math.round(d * 100) + ' %', { sz: 12.5, w: 600, c, a: 'end' }));
    y += 21; }
  out.push(T(cx + 190, top + 8 - 18, 'real', { sz: 10.5, c: TH.faint, a: 'end' }) + T(cx + 262, top + 8 - 18, 'ours', { sz: 10.5, c: TH.faint, a: 'end' }));
  y += 14; out.push(T(cx, y, 'THE BOOK', { sz: 11, c: TH.faint, w: 600, ls: 1.2 })); y += 20;
  for (const ln of wrapText(ref.src || '', 52).slice(0, 7)) { out.push(T(cx, y, ln, { sz: 11.5, c: TH.dim })); y += 16; }
  if (r.engineNote) { y += 8; for (const ln of wrapText('Not like for like: ' + r.engineNote, 52).slice(0, 4)) { out.push(T(cx, y, ln, { sz: 11.5, c: VC.near })); y += 16; } }
  out.push(T(48, H - 32, 'Inside: our range and the book\'s scatter overlap. Near: within 10 % of it. Outside: further. Method: tools/real_check.js (REAL-FIGURES).', { sz: 11.5, c: TH.faint }));
  out.push(T(W - 48, H - 32, 'Wingsmith', { sz: 12, c: TH.faint, a: 'end' }));
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="'IBM Plex Sans', system-ui, sans-serif">${out.join('')}</svg>`;
}
module.exports = { page, latest };
if (require.main === module) {
  const k = process.argv[2] || 'cub160';
  fs.writeFileSync(__dirname + '/ref_try.html', `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap"></head><body style="margin:0">${page(k)}</body></html>`);
}
