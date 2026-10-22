#!/usr/bin/env node
// G2361-G2364 (DMG-MOUNTRIG): THE NOSE-ENGINE RIG DRAWN - a side view (x forward to the left, y up) and a plan view (z
// across) of each validated nose-engine build's rig as the game flies it (tools/_load_build.js): the firewall ring, the
// engine's nodes (the flange pair ENGL / ENGR, the CG node CGE, the mount's cups MNT*), the nose leg, every member with an
// end on them, coloured by what it is. Run on a tree, it draws that tree's rig:
//   node tools/dmg_mountrig_svg.js <outDir> <old|new>     -> <outDir>/rig_<build>_<old|new>.svg
'use strict';
const path = require('path'), fs = require('fs');
const L = require('./_treecrash_lib.js');
const [outDir, which] = [process.argv[2] || '.', process.argv[3] || 'new'];
const isE = t => /^(ENG|CGE|MNT)/.test(t);
const kindOf = (b, N, d) => {
  const ta = N[b.a].tag, tb = N[b.b].tag, cup = t => /^MNT[TB][LR]$/.test(t);
  if (b.cls === 'gear') return 'leg';
  if (d && d.parts.dmg.iso.indexOf(d.beams.indexOf(b)) >= 0) return 'iso';
  if (/^(ENG|CGE)/.test(ta) && /^(ENG|CGE)/.test(tb)) return 'case';
  if (cup(ta) && cup(tb)) return 'ring';
  if (isE(ta) || isE(tb)) return 'bearer';
  return 'frame';
};
const COL = { case: '#b4542a', iso: '#7a3fb0', bearer: '#1f6fb2', ring: '#14857a', leg: '#4a4a4a', frame: '#c9c9c9' };
for (const k of ['cub', 'jodel', 'metal', 'floats']) {
  const d = L.defOf(k), N = d.nodes, B = d.beams;
  const keepN = i => isE(N[i].tag) || /^S0[TB][LR]$/.test(N[i].tag) || N[i].tag === 'TW' || /^VSN/.test(N[i].tag);
  const bs = B.filter(b => (isE(N[b.a].tag) || isE(N[b.b].tag)) || (b.cls === 'gear' && (N[b.a].tag === 'TW' || N[b.b].tag === 'TW') && N[d.refs.tw] && N[d.refs.tw].p[0] < 0.5)
    || (/^S0[TB][LR]$/.test(N[b.a].tag) && /^S0[TB][LR]$/.test(N[b.b].tag)));
  const ids = new Set(); bs.forEach(b => { ids.add(b.a); ids.add(b.b); }); N.forEach((n, i) => { if (keepN(i)) ids.add(i); });
  const pts = [...ids].map(i => N[i].p);
  const x0 = Math.min(...pts.map(p => p[0])) - 0.15, x1 = 1.1;
  const y0 = Math.min(...pts.map(p => p[1])) - 0.15, y1 = Math.max(...pts.map(p => p[1])) + 0.15, zW = 0.8;
  const S = 360 / Math.max(x1 - x0, y1 - y0, 2 * zW), W = (x1 - x0) * S, H1 = (y1 - y0) * S, H2 = 2 * zW * S;
  const sx = x => 20 + (x - x0) * S, sy = y => 40 + (y1 - y) * S, pz = z => 40 + H1 + 40 + (z + zW) * S;
  let o = '';
  const line = (a, b, c, w, py) => `<line x1="${sx(a[0]).toFixed(1)}" y1="${py(a).toFixed(1)}" x2="${sx(b[0]).toFixed(1)}" y2="${py(b).toFixed(1)}" stroke="${c}" stroke-width="${w}"/>`;
  for (const [py, title, ty] of [[p => sy(p[1]), 'side (x forward to the left, y up)', 30], [p => pz(p[2]), 'plan (z across)', 40 + H1 + 30]]) {
    o += `<text x="20" y="${ty + 10}" font-size="11" fill="#222">${title}</text>`;
    for (const b of bs) { const kd = kindOf(b, N, d); o += line(N[b.a].p, N[b.b].p, COL[kd], kd === 'frame' ? 1 : 2.2, py); }
    for (const i of ids) { const p = N[i].p, t = N[i].tag;
      o += `<circle cx="${sx(p[0]).toFixed(1)}" cy="${py(p).toFixed(1)}" r="${Math.max(2.5, Math.min(9, 1.6 * Math.sqrt(N[i].m)))}" fill="${isE(t) ? '#b4542a' : '#666'}" fill-opacity="0.55"/>`;
      if (py === sy || p[2] <= 0) o += `<text x="${(sx(p[0]) + 5).toFixed(1)}" y="${(py(p) - 5).toFixed(1)}" font-size="9" fill="#333">${t}</text>`; }
  }
  const leg = Object.keys(COL).map((c, j) => `<rect x="${20 + j * 90}" y="${40 + H1 + 40 + H2 + 12}" width="12" height="4" fill="${COL[c]}"/><text x="${36 + j * 90}" y="${40 + H1 + 40 + H2 + 18}" font-size="10">${c === 'leg' ? 'nose leg' : c === 'frame' ? 'firewall' : c}</text>`).join('');
  const len = bs.filter(b => kindOf(b, N, d) === 'bearer').map(b => b.L);
  const head = `<text x="20" y="14" font-size="12" font-weight="bold">${L.BUILDS[k].label} - the ${which === 'old' ? 'OLD rig (the base)' : 'NEW rig (DMG-MOUNTRIG)'}</text><text x="20" y="27" font-size="10">mount members ${len.length ? Math.min(...len).toFixed(2) + '-' + Math.max(...len).toFixed(2) + ' m' : '-'} (bearers); circle area ~ node mass</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(W + 40, 580).toFixed(0)}" height="${(40 + H1 + 40 + H2 + 30).toFixed(0)}" style="background:#fff;font-family:sans-serif">${head}${o}${leg}</svg>`;
  fs.writeFileSync(path.join(outDir, 'rig_' + k + '_' + which + '.svg'), svg);
  console.log(k, which, bs.length, 'members drawn');
}
