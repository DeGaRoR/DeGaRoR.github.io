#!/usr/bin/env node
// G1838 (DMG-D2b GEAR): the evidence from two GATE DMGGEAR runs (`node tools/_dmg_gear_check.js --json <file>`): the
// base's (DMG-D2a's certificate, its core - DMGGEAR_PARTS=ops,circ,xw) and this branch's. Writes, under --out
// (default reports/evidence/DMG-D2b/):
//   headroom.json / headroom.svg  every validated build x every ordinary case: the worst member over its certified
//                                 yield, before and after (the 23.473 row: the airframe's), the 2/3 line;
//   bracket.json                  the gear bracket per build (every gear joint's envelope and limits) and its drops;
//   rows.json                     §7.4's gear rows (the ground loop, the porpoise, the float dig-in).
// Run: node tools/dmg_gear_evidence.js --before <base.json> --after <mine.json> [--out <dir>]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-D2b')));
fs.mkdirSync(OUT, { recursive: true });
const before = JSON.parse(fs.readFileSync(opt('before'), 'utf8')), after = JSON.parse(fs.readFileSync(opt('after'), 'utf8'));
const LAB = { cub: 'the user\'s Cub', jodel: 'Jodel', metal: 'metal Cessna', floats: 'Cessna floats', twinFloats: 'twin floatplane' };

// the headroom rows of one run: [case, value, the member]
function rowsOf(P) {
  const out = [];
  const O = (P && P.ops) || {};
  for (const t of (O.td || [])) out.push([t.kind === 'ord' ? 'touchdown ' + t.sink.toFixed(1) + ' m/s' : 'touchdown at FAR 23.473 (airframe)', t.kind === 'ord' ? t.w.max : t.w.air, t.kind === 'ord' ? t.w.tags : t.w.atags]);
  for (const t of (O.taxi || [])) out.push(['taxi ' + t.lab.replace(/ \(.*\)/, ''), t.w.max, t.w.tags]);
  for (const p of ['circ', 'xw']) { const c = P && P[p] && P[p].circ; if (c) out.push([c.xw ? 'crosswind circuit' : 'circuit', c.w.max, c.w.tags + (c.w.phase ? ' (' + c.w.phase + ')' : '')]); }
  return out;
}
const H = {};
for (const k of Object.keys(LAB)) {
  const b = rowsOf(before[k]), a = rowsOf(after[k]);
  H[k] = a.map(([nm, v, m]) => { const o = b.find(x => x[0] === nm); return { case: nm, before: o ? o[1] : null, beforeMember: o ? o[2] : null, after: v, afterMember: m }; });
}
fs.writeFileSync(path.join(OUT, 'headroom.json'), JSON.stringify(H, null, 1));
const BR = {}, RW = {};
for (const k of Object.keys(LAB)) { if (after[k] && after[k].bracket) BR[k] = { bracket: after[k].bracket.bracket, drops: after[k].bracket.drops }; if (after[k] && after[k].rows) RW[k] = after[k].rows; }
fs.writeFileSync(path.join(OUT, 'bracket.json'), JSON.stringify(BR, null, 1));
fs.writeFileSync(path.join(OUT, 'rows.json'), JSON.stringify(RW, null, 1));

// THE PLOT: a dot plot, one row per build x case, x = the worst member over its certified yield; before (slot 1 blue,
// hollow) and after (slot 2 orange, filled), joined by a hairline; the 2/3 target and the yield (1) as reference lines
const COL = { before: '#2a78d6', after: '#eb6834', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', surf: '#fcfcfb', ref: '#8a8984' };
const rows = []; for (const k of Object.keys(H)) for (const r of H[k]) rows.push(Object.assign({ build: LAB[k] }, r));
const W = 900, rowH = 18, top = 70, left = 330, right = 40, xMax = Math.max(1.2, ...rows.map(r => Math.max(r.before || 0, r.after || 0))) * 1.02;
const Hh = top + rows.length * rowH + 50, X = v => left + (W - left - right) * v / xMax;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" font-family="system-ui, sans-serif" font-size="11">
<rect width="${W}" height="${Hh}" fill="${COL.surf}"/>
<text x="16" y="22" font-size="14" font-weight="600" fill="${COL.ink}">Ordinary operations: the worst member over its certified yield</text>
<text x="16" y="40" fill="${COL.ink2}">DMG-D2a's certificate (before) and DMG-D2b's (after); target at most 2/3 (dm14), 1 = the certified yield</text>
<circle cx="${left}" cy="56" r="4" fill="none" stroke="${COL.before}" stroke-width="2"/><text x="${left + 9}" y="60" fill="${COL.ink2}">before (DMG-D2a)</text>
<circle cx="${left + 130}" cy="56" r="4.5" fill="${COL.after}" stroke="${COL.surf}" stroke-width="2"/><text x="${left + 140}" y="60" fill="${COL.ink2}">after (DMG-D2b)</text>
`;
for (const v of [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].filter(v => v <= xMax)) svg += `<line x1="${X(v)}" x2="${X(v)}" y1="${top - 6}" y2="${top + rows.length * rowH}" stroke="${COL.grid}"/><text x="${X(v)}" y="${top + rows.length * rowH + 16}" text-anchor="middle" fill="${COL.ink2}">${v}</text>`;
svg += `<line x1="${X(2 / 3)}" x2="${X(2 / 3)}" y1="${top - 6}" y2="${top + rows.length * rowH}" stroke="${COL.ref}" stroke-dasharray="4 3"/><text x="${X(2 / 3) + 3}" y="${top - 10}" fill="${COL.ink2}">2/3</text>`;
svg += `<line x1="${X(1)}" x2="${X(1)}" y1="${top - 6}" y2="${top + rows.length * rowH}" stroke="${COL.ink2}"/><text x="${X(1) + 3}" y="${top - 10}" fill="${COL.ink2}">yield</text>`;
let last = null;
rows.forEach((r, i) => {
  const y = top + i * rowH + rowH / 2;
  if (r.build !== last) { svg += `<line x1="16" x2="${W - right}" y1="${y - rowH / 2}" y2="${y - rowH / 2}" stroke="${COL.grid}"/>`; svg += `<text x="16" y="${y + 4}" font-weight="600" fill="${COL.ink}">${esc(r.build)}</text>`; last = r.build; }
  svg += `<text x="${left - 8}" y="${y + 4}" text-anchor="end" fill="${COL.ink2}">${esc(r.case)}</text>`;
  if (r.before != null) svg += `<line x1="${X(r.before)}" x2="${X(r.after)}" y1="${y}" y2="${y}" stroke="${COL.ref}"/>`;
  if (r.before != null) svg += `<circle cx="${X(r.before)}" cy="${y}" r="4" fill="none" stroke="${COL.before}" stroke-width="2"><title>${esc(r.build + ', ' + r.case + ' - before ' + r.before.toFixed(2) + ' (' + r.beforeMember + ')')}</title></circle>`;
  svg += `<circle cx="${X(r.after)}" cy="${y}" r="4.5" fill="${COL.after}" stroke="${COL.surf}" stroke-width="2"><title>${esc(r.build + ', ' + r.case + ' - after ' + r.after.toFixed(2) + ' (' + r.afterMember + ')')}</title></circle>`;
});
svg += `<text x="${(left + W - right) / 2}" y="${Hh - 10}" text-anchor="middle" fill="${COL.ink2}">peak member force / certified yield</text></svg>\n`;
fs.writeFileSync(path.join(OUT, 'headroom.svg'), svg);
console.log('wrote ' + ['headroom.json', 'headroom.svg', 'bracket.json', 'rows.json'].map(f => path.join(OUT, f)).join(', '));
for (const k of Object.keys(H)) console.log(LAB[k].padEnd(16), H[k].map(r => r.case + ' ' + (r.before == null ? '-' : r.before.toFixed(2)) + ' -> ' + r.after.toFixed(2)).join(' | '));
