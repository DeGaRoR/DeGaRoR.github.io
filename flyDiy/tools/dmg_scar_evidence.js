#!/usr/bin/env node
// dmg_scar_evidence.js - G2357-G2360 (DMG-SCAR): THE SCARS, SEEN FROM ABOVE. The standard crashes (tools/_dmg_scar_lib.js)
// on the three validated builds, the certificate stamped; per crash one panel, top-down, at its own scale: the ground's
// contacts the gate's reader saw (grey dots: a node that is not a wheel, its bottom on the ground, every frame), the CG's
// track (blue), the engines' hub (orange), and the scar the solver sealed - the sweep (a pale band), the gouges (brown
// strips at their width, the prop's slots darker), the craters (dark discs at their torn-turf radius).
//   node tools/dmg_scar_evidence.js [--out reports/evidence/DMG-SCAR] [--nocert]
// Writes scars.svg (the grid) and scars.json (every case's primitives, counts, bytes, the record's counters).
'use strict';
const fs = require('fs'), path = require('path');
const S = require('./_dmg_scar_lib.js');
const argv = process.argv.slice(2);
const OUT = path.resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : path.join(__dirname, '..', 'reports', 'evidence', 'DMG-SCAR'));
const CERT = !argv.includes('--nocert');
fs.mkdirSync(OUT, { recursive: true });
const LAB = { cub: "the user's Cub", jodel: 'the Jodel', metal: 'the metal Cessna' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const PW = 300, PH = 260, PAD = 18, TOP = 34;
const rows = [], J = [];
for (const k of S.BUILDS) {
  const row = [];
  for (const c of S.CASES) {
    const r = S.runCase(k, c, { cert: CERT });
    row.push(r);
    J.push({ key: k, id: c.id, label: c.label, v: r.v, prims: r.prims, bytes: r.bytes, rec: r.rec, crashed: r.crashed, reason: r.reason, strike: r.strike,
      contacts: r.contacts.length / 4 });
    console.log(k + ' ' + c.id + ': ' + r.prims.length + ' primitives, ' + r.bytes + ' B, ' + r.contacts.length / 4 + ' contact samples');
  }
  rows.push(row);
}
// a panel's extent: the scar, the contacts, the CG's track while low (the whole track for an empty case)
function panel(r, ox, oy) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  const ext = (x, z, h) => { h = h || 0; x0 = Math.min(x0, x - h); x1 = Math.max(x1, x + h); z0 = Math.min(z0, z - h); z1 = Math.max(z1, z + h); };
  for (let j = 0; j < r.contacts.length; j += 4) ext(r.contacts[j], r.contacts[j + 1]);
  for (const p of r.prims) { if (p.k === 'c') ext(p.x, p.z, p.r); else for (let j = 0; j < p.p.length; j += 2) ext(p.p[j], p.p[j + 1], p.k === 's' ? 0 : p.w / 2); }
  if (!(x0 <= x1)) for (let j = 0; j < r.cg.length; j += 3) ext(r.cg[j], r.cg[j + 1]);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, span = Math.max(4, x1 - x0, (z1 - z0) * (PW - 2 * PAD) / (PH - TOP - PAD)) * 1.15;
  const sc = (PW - 2 * PAD) / span;
  const X = x => ox + PW / 2 + (x - cx) * sc, Y = z => oy + TOP + (PH - TOP - PAD) / 2 + (z - cz) * sc;
  const g = [], id = 'c' + Math.round(ox) + '_' + Math.round(oy);
  g.push(`<clipPath id="${id}"><rect x="${ox + 2}" y="${oy + TOP}" width="${PW - 4}" height="${PH - TOP - 2}"/></clipPath>`);
  g.push(`<rect x="${ox + 2}" y="${oy + 2}" width="${PW - 4}" height="${PH - 4}" fill="#f4f1e6" stroke="#bbb"/>`);
  const nc = r.prims.filter(p => p.k === 'c').length, ng = r.prims.filter(p => p.k === 'g').length, ns = r.prims.filter(p => p.k === 's').length;
  g.push(`<text x="${ox + 8}" y="${oy + 16}" font-size="11" font-weight="bold">${esc(r.label)}</text>`);
  g.push(`<text x="${ox + 8}" y="${oy + 29}" font-size="10" fill="#444">${nc} craters, ${ng} gouges, ${ns} sweep - ${r.bytes} B${r.crashed ? ' - crashed' : ''}${r.strike ? ' - prop ' + esc(r.strike) : ''}</text>`);
  const line = (P, w, col, op, cap) => `<polyline points="${Array.from({ length: P.length / 2 }, (_, j) => X(P[j * 2]).toFixed(1) + ',' + Y(P[j * 2 + 1]).toFixed(1)).join(' ')}" fill="none" stroke="${col}" stroke-width="${Math.max(0.8, w * sc).toFixed(2)}" stroke-opacity="${op}" stroke-linecap="${cap || 'round'}" stroke-linejoin="round"/>`;
  g.push(`<g clip-path="url(#${id})">`);
  for (const p of r.prims) if (p.k === 's') { if (!p.ws || p.p.length < 4) g.push(line(p.p, p.w, '#9bb36a', 0.35));
    else for (let j = 0; j + 3 < p.p.length; j += 2) g.push(line(p.p.slice(j, j + 4), Math.max(p.ws[j / 2], p.ws[j / 2 + 1]), '#9bb36a', 0.3)); }
  const cgL = []; for (let j = 0; j < r.cg.length; j += 3) cgL.push(r.cg[j], r.cg[j + 1]);
  if (cgL.length >= 4) g.push(line(cgL, 0, '#3a6fd8', 0.8));
  for (const p of r.prims) if (p.k === 'g') g.push(line(p.p, p.w, p.ps ? '#3b2412' : '#7a4a22', 0.75, p.ps ? 'butt' : 'round'));
  for (const p of r.prims) if (p.k === 'c') g.push(`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.z).toFixed(1)}" r="${Math.max(1, p.r * sc).toFixed(1)}" fill="#4a2c14" fill-opacity="0.7" stroke="#2a180a"/>`);
  { const seen = new Set();   // (one dot a pixel: the readings are thousands)
    for (let j = 0; j < r.contacts.length; j += 4) { const px = Math.round(X(r.contacts[j])), py = Math.round(Y(r.contacts[j + 1])), key = px * 4096 + py;
      if (seen.has(key)) continue; seen.add(key); g.push(`<circle cx="${px}" cy="${py}" r="0.9" fill="#555" fill-opacity="0.6"/>`); } }
  if (r.hubs.length >= 2) g.push(`<circle cx="${X(r.hubs[r.hubs.length - 2]).toFixed(1)}" cy="${Y(r.hubs[r.hubs.length - 1]).toFixed(1)}" r="3" fill="#e08a1a"/>`);
  g.push('</g>');
  // the scale: a metre bar
  const m = span > 30 ? 10 : span > 10 ? 5 : 1;
  g.push(`<line x1="${ox + PW - PAD - m * sc}" y1="${oy + PH - 10}" x2="${ox + PW - PAD}" y2="${oy + PH - 10}" stroke="#000" stroke-width="2"/><text x="${ox + PW - PAD - m * sc}" y="${oy + PH - 14}" font-size="9">${m} m</text>`);
  return g.join('');
}
const W = S.CASES.length * PW + 160, H = rows.length * PH + 70;
const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif">`, `<rect width="${W}" height="${H}" fill="#fff"/>`,
  `<text x="10" y="22" font-size="15" font-weight="bold">DMG-SCAR: the scar each standard crash leaves, from above (grey: the ground contacts the gate saw; blue: the CG; orange: the hub; green: the sweep; brown: gouges, dark: the prop's slots; discs: craters)</text>`,
  `<text x="10" y="40" font-size="11" fill="#444">${CERT ? 'the certificate stamped (the game\'s)' : 'the members\' physics (no certificate)'}; each panel at its own scale (the bar); a heading of its own per case</text>`];
rows.forEach((row, ri) => {
  svg.push(`<text x="10" y="${60 + ri * PH + PH / 2}" font-size="13" font-weight="bold">${esc(LAB[row[0].key])}</text>`);
  row.forEach((r, ci) => svg.push(panel(r, 150 + ci * PW, 50 + ri * PH)));
});
svg.push('</svg>');
fs.writeFileSync(path.join(OUT, 'scars.svg'), svg.join('\n'));
fs.writeFileSync(path.join(OUT, 'scars.json'), JSON.stringify({ cert: CERT, cases: J }, null, 1));
console.log('wrote ' + path.join(OUT, 'scars.svg'));
