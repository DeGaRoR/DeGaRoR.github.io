#!/usr/bin/env node
// G2043 (DMG-FABRIC): the pictures and the table from dmg_fabric_evidence.js's sweep JSON.
//   node tools/dmg_fabric_plots.js --sweep <sweep.json> --out <dir> [--sens56 <json>] [--sens108 <json>]
// pieces.svg: the pieces over time after first contact - before (the ties off: the base's physics) and after (the HELD
// pieces: the live members, the clusters and the live cover ties), one panel per build and 30 m/s crash;
// share.svg: the largest piece's share of the aeroplane's mass over time, likewise; tears.svg: each tie, made -> torn;
// table.md: the brief's measures for every build and standard crash.
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SW = JSON.parse(fs.readFileSync(opt('sweep'), 'utf8')), OUT = opt('out');
fs.mkdirSync(OUT, { recursive: true });
const LAB = { cub: 'the user\'s Cub', jodel: 'Jodel', metal: 'metal Cessna', floats: 'Cessna floats', twinFloats: 'twin floatplane' };
const CR = { taxi: '3 m/s taxi', noseover: 'nose-over', trunk0: '30 m/s centreline', trunk25: '30 m/s, 2.5 m out', hard: 'drop 1.5 x 23.473', digin: 'float dig-in' };
const runs = SW.runs.filter(r => !r.err), get = (k, id, m) => runs.find(r => r.k === k && r.id === id && r.mode === m);
const builds = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];

// ---- SVG (the repo's dataviz instance: before = slot 1 blue, after = slot 2 orange; light + dark; <title> = hover) ----
const PAL = { light: ['#2a78d6', '#eb6834'], dark: ['#3987e5', '#d95926'] };
const style = '<style>.bg{fill:#fcfcfb}.t1{fill:#0b0b0b}.t2{fill:#52514e}.grid{stroke:#e4e3de}.l0{stroke:' + PAL.light[0] + '}.l1{stroke:' + PAL.light[1] + '}.f0{fill:' + PAL.light[0] + '}.f1{fill:' + PAL.light[1] + '}'
  + '@media (prefers-color-scheme: dark){.bg{fill:#1a1a19}.t1{fill:#ffffff}.t2{fill:#c3c2b7}.grid{stroke:#3a3a37}.l0{stroke:' + PAL.dark[0] + '}.l1{stroke:' + PAL.dark[1] + '}.f0{fill:' + PAL.dark[0] + '}.f1{fill:' + PAL.dark[1] + '}}'
  + 'text{font-family:system-ui,-apple-system,Segoe UI,sans-serif}.ln{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}.dash{stroke-dasharray:5 4}</style>';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function smallMultiples(file, title, sub, field0, field1, yMax, yFmt, yTicks) {
  const panels = [];
  for (const k of builds) for (const id of ['trunk0', 'trunk25']) { const a = get(k, id, 'off'), b = get(k, id, 'on'); if (a && b) panels.push({ k, id, a, b }); }
  const cols = 2, pw = 330, ph = 150, padL = 44, padT = 96, gx = 30, gy = 56, W = padL + cols * pw + (cols - 1) * gx + 20, rowsN = Math.ceil(panels.length / cols), H = padT + 30 + rowsN * (ph + gy);
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(title) + '">' + style + '<rect class="bg" width="100%" height="100%"/>';
  const words = sub.split(' '), lines = ['']; for (const w of words) { if ((lines[lines.length - 1] + ' ' + w).length > 110) lines.push(''); lines[lines.length - 1] += (lines[lines.length - 1] ? ' ' : '') + w; }
  s += '<text class="t1" x="16" y="22" font-size="15" font-weight="600">' + esc(title) + '</text>' + lines.map((l, i) => '<text class="t2" x="16" y="' + (40 + i * 15) + '" font-size="11.5">' + esc(l) + '</text>').join('');
  // legend
  s += '<g transform="translate(16,' + (44 + lines.length * 15) + ')"><line class="l0 ln dash" x1="0" y1="6" x2="22" y2="6"/><text class="t2" x="28" y="10" font-size="11.5">before (ties off)</text><line class="l1 ln" x1="140" y1="6" x2="162" y2="6"/><text class="t2" x="168" y="10" font-size="11.5">after (held by the covering)</text></g>';
  panels.forEach((P, j) => {
    const x0 = padL + (j % cols) * (pw + gx), y0 = padT + 30 + Math.floor(j / cols) * (ph + gy), T = 4.5;
    const X = t => x0 + t / T * pw, Y = v => y0 + ph - v / yMax * ph;
    s += '<text class="t1" x="' + x0 + '" y="' + (y0 - 10) + '" font-size="12" font-weight="600">' + esc(LAB[P.k] + ' - ' + CR[P.id]) + '</text>';
    for (const v of yTicks) s += '<line class="grid" x1="' + x0 + '" x2="' + (x0 + pw) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="t2" x="' + (x0 - 6) + '" y="' + (Y(v) + 4) + '" font-size="10" text-anchor="end">' + yFmt(v) + '</text>';
    for (const t of [0, 1, 2, 3, 4]) s += '<text class="t2" x="' + X(t) + '" y="' + (y0 + ph + 14) + '" font-size="10" text-anchor="middle">' + t + (t === 4 ? ' s' : '') + '</text>';
    const line = (rows, f, cls, dash) => { const pts = rows.filter(r => r.t <= T).map(r => X(Math.max(0, r.t)).toFixed(1) + ',' + Y(Math.min(yMax, r[f])).toFixed(1)); return pts.length ? '<polyline class="' + cls + ' ln' + (dash ? ' dash' : '') + '" points="' + pts.join(' ') + '"/>' : ''; };
    s += line(P.a.series, field0, 'l0', true) + line(P.b.series, field1, 'l1', false);
    // hover: the marks at 0.5 / 1 / 2 / 4 s
    for (const m of ['0.5', '1', '2', '4']) { const A = P.a.at[m], B = P.b.at[m]; if (!A || !B) continue;
      s += '<g><title>' + esc(LAB[P.k] + ', ' + CR[P.id] + ', ' + m + ' s: before ' + yFmt(A[field0]) + ', after ' + yFmt(B[field1]) + ' (ties ' + B.ties + ', live ' + B.live + ')') + '</title><circle class="f0" cx="' + X(+m) + '" cy="' + Y(Math.min(yMax, A[field0])) + '" r="4"/><circle class="f1" cx="' + X(+m) + '" cy="' + Y(Math.min(yMax, B[field1])) + '" r="4"/></g>'; }
    const tz = P.b.ties ? P.b.ties.made + ' ties, ' + P.b.ties.torn + ' torn' : '';
    s += '<text class="t2" x="' + (x0 + pw) + '" y="' + (y0 - 10) + '" font-size="10.5" text-anchor="end">' + esc(tz) + '</text>';
  });
  fs.writeFileSync(path.join(OUT, file), s + '</svg>\n');
}
smallMultiples('pieces.svg', 'Pieces after first contact - before and after the cover ties', 'The 30 m/s trunks, the certificate stamped. A piece is 1 kg or more; after = the pieces the live members, the clusters and the live cover ties hold together. Hover the dots for 0.5 / 1 / 2 / 4 s.',
  'pieces', 'held', 16, v => String(v), [0, 4, 8, 12, 16]);
smallMultiples('share.svg', 'The largest piece\'s share of the aeroplane\'s mass after first contact', 'The 30 m/s trunks, the certificate stamped; after = the largest piece the covering holds together (the struck wing kept on: 0.96 -> 1.00 on the Cub for 2 s).',
  'share', 'shareH', 1, v => (v * 100).toFixed(0) + ' %', [0, 0.25, 0.5, 0.75, 1]);

// ---- tears.svg: every tie, made -> torn (or live to the end), per crash with ties ----
{
  const rows = []; for (const k of builds) for (const id of Object.keys(CR)) { const b = get(k, id, 'on'); if (b && b.ties && b.ties.made) rows.push(b); }
  const W = 800, rowH = 26, padL = 236, H = 70 + rows.length * rowH + 30, T = 4.5, X = t => padL + Math.max(0, Math.min(T, t)) / T * (W - padL - 30);
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="cover ties torn over time">' + style + '<rect class="bg" width="100%" height="100%"/>';
  s += '<text class="t1" x="16" y="22" font-size="15" font-weight="600">The cover ties: when each tore (seconds after first contact)</text><text class="t2" x="16" y="40" font-size="11.5">One dot a tear; the bar from the first tie to the run\'s end is the covering holding (n live at the end at its right). The certificate stamped.</text>';
  for (const t of [0, 0.5, 1, 2, 3, 4]) s += '<line class="grid" x1="' + X(t) + '" x2="' + X(t) + '" y1="56" y2="' + (H - 24) + '"/><text class="t2" x="' + X(t) + '" y="' + (H - 10) + '" font-size="10" text-anchor="middle">' + t + ' s</text>';
  rows.forEach((b, j) => { const y = 66 + j * rowH;
    s += '<text class="t1" x="' + (padL - 8) + '" y="' + (y + 4) + '" font-size="11" text-anchor="end">' + esc(LAB[b.k] + ' - ' + CR[b.id]) + '</text>';
    if (b.ties.live) s += '<g><title>' + esc(b.ties.live + ' ties live at the end') + '</title><rect class="f1" x="' + X(b.ties.first || 0) + '" y="' + (y - 2) + '" width="' + (X(T) - X(b.ties.first || 0)) + '" height="4" rx="2" opacity="0.55"/><text class="t2" x="' + (X(T) + 4) + '" y="' + (y + 4) + '" font-size="10">' + b.ties.live + '</text></g>';
    for (const t of b.ties.tears) s += '<circle class="f0" cx="' + X(t) + '" cy="' + y + '" r="4"><title>' + esc('torn at ' + t + ' s') + '</title></circle>';
  });
  fs.writeFileSync(path.join(OUT, 'tears.svg'), s + '</svg>\n');
}

// ---- table.md ----
const sens = {}; for (const [nm, f] of [['56', opt('sens56')], ['108', opt('sens108')]]) if (f) sens[nm] = JSON.parse(fs.readFileSync(f, 'utf8')).runs.filter(r => !r.err);
const at = (r, m, f) => r.at[m] ? r.at[m][f] : '-';
let md = '# DMG-FABRIC - the standard crashes, before and after the cover ties (G2042)\n\nDamage ON, the certificate stamped (FLYDIY_CERT_DIR), the Cessnas on JOIN-PARITY\'s page-loaded spec (FLYDIY_SPEC_DIR=reports/evidence/DMG-TUNE/specs, DMG-TUNE\'s). BEFORE = GEN_COVER.on false (the base\'s physics, bit for bit - GATE DMGFABRIC); AFTER = this branch. "pieces" = pieces of 1 kg or more held by the live members and the clusters still on; "held" = the same with the live cover ties. t = 0 at first contact (the trunk), 7 s flown. "far" = the furthest piece\'s centre of mass from the largest\'s at the end (at rest).\n\n';
md += '| build | crash | broken before / after | pieces before @ 0.5 / 1 / 2 / 4 s | held after @ 0.5 / 1 / 2 / 4 s (pieces after) | largest share before -> after @ 1 s / 4 s | ties made / torn (at birth) | tears (s) | far before -> after (m) | covering took |\n|---|---|---|---|---|---|---|---|---|---|\n';
for (const k of builds) for (const id of Object.keys(CR)) {
  const a = get(k, id, 'off'), b = get(k, id, 'on'); if (!a || !b) continue;
  const m = ['0.5', '1', '2', '4'];
  const tz = b.ties || { made: 0, torn: 0, born: 0, tears: [], work: 0 };
  const tears = tz.tears.length ? (tz.tears.length > 6 ? tz.tears.slice(0, 3).join(', ') + ' ... ' + tz.tears[tz.tears.length - 1] : tz.tears.join(', ')) : '-';
  md += '| ' + LAB[k] + ' | ' + CR[id] + ' | ' + a.broken + ' / ' + b.broken + ' | ' + m.map(x => at(a, x, 'pieces')).join(' / ') + ' | ' + m.map(x => at(b, x, 'held')).join(' / ') + ' (' + m.map(x => at(b, x, 'pieces')).join(' / ') + ') | '
    + at(a, '1', 'share') + ' -> ' + at(b, '1', 'shareH') + ' / ' + at(a, '4', 'share') + ' -> ' + at(b, '4', 'shareH') + ' | ' + tz.made + ' / ' + tz.torn + ' (' + tz.born + ') | ' + tears + ' | ' + a.end.far + ' -> ' + b.end.farH + ' | ' + (tz.work / 1000).toFixed(2) + ' kJ |\n';
}
if (Object.keys(sens).length) {
  md += '\n## Sensitivity: the fabric\'s strength (the crashes with fabric ties)\n\nThe same crashes with GEN_COVER.fabric.tuN at the AC 43.13-1B replace-at (56 lb/in, 9.8 kN/m) and at Ceconite 102\'s 108 lb/in (18.9 kN/m; Aircraft Spruce\'s catalogue, a search summary), against the 80 lb/in taken.\n\n| build | crash | strength | held @ 0.5 / 1 / 2 / 4 s | ties made / torn | far (m) |\n|---|---|---|---|---|---|\n';
  for (const k of ['cub', 'jodel', 'twinFloats']) for (const id of ['trunk0', 'trunk25']) {
    const rowOf = (r, lab) => r ? '| ' + LAB[k] + ' | ' + CR[id] + ' | ' + lab + ' | ' + ['0.5', '1', '2', '4'].map(x => at(r, x, 'held')).join(' / ') + ' | ' + (r.ties ? r.ties.made + ' / ' + r.ties.torn : '-') + ' | ' + r.end.farH + ' |\n' : '';
    md += rowOf((sens['56'] || []).find(r => r.k === k && r.id === id), '56 lb/in (replace-at)') + rowOf(get(k, id, 'on'), '80 lb/in (taken)') + rowOf((sens['108'] || []).find(r => r.k === k && r.id === id), '108 lb/in (Ceconite 102)');
  }
}
fs.writeFileSync(path.join(OUT, 'table.md'), md);
console.log('wrote', fs.readdirSync(OUT).join(', '));
