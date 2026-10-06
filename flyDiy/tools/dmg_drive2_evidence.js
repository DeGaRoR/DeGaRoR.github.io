// G2038 (DMG-DRIVE2): THE EVIDENCE from tools/dmg_drive2_probe.js's JSON (base and this branch, per build) - the sweep's
// table (sweep.md) and two SVGs: where the trunk stood against the disc when DMG-DRIVE graded the strike (gap.svg), and the
// Cub's 3 m/s taxi at the rig's 0.62 throttle frame by frame (timeline.svg, from --trace runs).
//   node tools/dmg_drive2_evidence.js <dir with base_<key>.json / after_<key>.json [/ trace_base.json / trace_after.json]> <out dir>
'use strict';
const fs = require('fs'), path = require('path');
const [IN, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const keys = ['cub', 'jodel', 'metal'], LAB = { cub: 'Cub', jodel: 'Jodel', metal: 'metal Cessna' };
const rd = f => { const p = path.join(IN, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const B = {}, A = {};
for (const k of keys) { B[k] = rd('base_' + k + '.json') || []; A[k] = rd('after_' + k + '.json') || []; }
const f2 = x => x == null ? '-' : (+x).toFixed(2);
const cell = r => !r ? '-' : (r.strike || 'none') + (r.strikeAt ? ' (biteR ' + f2(r.strikeAt.biteR) + ', ' + Math.round(r.strikeAt.rpm) + ' rpm, gap ' + f2(r.gapAtStrike) + ' m)' : '') +
  '; ' + r.broken + ' broken' + (r.mountBroken ? ', ' + r.mountBroken + ' mount' : '') + '; crush ' + (r.crush * 100).toFixed(1) + ' cm ' + (r.crushLayer || '');
let md = '# DMG-DRIVE2 - the taxi into a trunk, 1-5 m/s, before (9500f19) and after\n\n' +
  'tools/dmg_drive2_probe.js: TREECRASH\'s flat world (tools/_treecrash_lib.js atTrunk; the fixture builds - JOIN-PARITY\'s _load_build.js is not on the integration branch), ' +
  'the certificate stamped, damage ON, a trunk r 0.3 m 6 m ahead of the CG on the centreline, the throttle held from the push. ' +
  '`gap` = the trunk\'s face ahead of the engine\'s thrust nodes (the flange) when DMG-DRIVE graded the strike; the hub runs 0-0.12 m (wood) / 0-0.07 m (alloy) ahead of it.\n\n';
for (const k of keys) {
  md += '## ' + LAB[k] + '\n\n| V m/s | throttle | before | after |\n|---|---|---|---|\n';
  for (const a of A[k]) { const b = B[k].find(x => x.V === a.V && x.thr === a.thr); md += '| ' + a.V + ' | ' + a.thr + ' | ' + cell(b) + ' | ' + cell(a) + ' |\n'; }
  md += '\n';
}
fs.writeFileSync(path.join(OUT, 'sweep.md'), md);

// ---- gap.svg: a dot per case, before and after, on one axis (the gap at grading, m); the hub's band shaded
const C1 = '#2a78d6', C2 = '#eb6834', INK = '#0b0b0b', INK2 = '#52514e', GRID = '#e4e3df', SURF = '#fcfcfb';
const rows = [];
for (const k of keys) for (const a of A[k]) { const b = B[k].find(x => x.V === a.V && x.thr === a.thr); rows.push({ k, V: a.V, thr: a.thr, b, a }); }
const W = 760, rowH = 15, top = 70, left = 190, right = 40, H = top + rows.length * rowH + 50, x0 = -0.1, x1 = 1.1;
const X = g => left + (g - x0) / (x1 - x0) * (W - left - right);
let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, sans-serif" font-size="11">` +
  `<rect width="${W}" height="${H}" fill="${SURF}"/>` +
  `<text x="16" y="22" font-size="14" font-weight="600" fill="${INK}">Where the trunk stood when DMG-DRIVE graded the strike</text>` +
  `<text x="16" y="40" fill="${INK2}">the trunk's face ahead of the flange (m); the shaded band is the hub, where the blades are. No dot: no strike graded.</text>` +
  `<rect x="${X(0)}" y="${top - 8}" width="${X(0.12) - X(0)}" height="${rows.length * rowH + 4}" fill="${GRID}"/>`;
for (const g of [0, 0.25, 0.5, 0.75, 1]) s += `<line x1="${X(g)}" x2="${X(g)}" y1="${top - 8}" y2="${top + rows.length * rowH}" stroke="${GRID}"/><text x="${X(g)}" y="${top + rows.length * rowH + 16}" text-anchor="middle" fill="${INK2}">${g}</text>`;
s += `<text x="${(X(x0) + X(x1)) / 2}" y="${top + rows.length * rowH + 34}" text-anchor="middle" fill="${INK2}">gap at grading (m ahead of the flange)</text>`;
rows.forEach((r, i) => {
  const y = top + i * rowH + 4;
  s += `<text x="${left - 8}" y="${y + 4}" text-anchor="end" fill="${INK2}">${LAB[r.k]} ${r.V} m/s thr ${r.thr}</text>`;
  for (const [o, c, nm] of [[r.b, C2, 'before'], [r.a, C1, 'after']]) if (o && o.strikeAt && o.gapAtStrike != null)
    s += `<circle cx="${X(o.gapAtStrike)}" cy="${y}" r="4.5" fill="${c}" stroke="${SURF}" stroke-width="2"><title>${nm}: ${o.strike}, gap ${f2(o.gapAtStrike)} m, biteR ${f2(o.strikeAt.biteR)}, ${Math.round(o.strikeAt.rpm)} rpm</title></circle>`;
});
s += `<circle cx="${W - 230}" cy="56" r="4.5" fill="${C2}"/><text x="${W - 220}" y="60" fill="${INK}">before (9500f19)</text><circle cx="${W - 90}" cy="56" r="4.5" fill="${C1}"/><text x="${W - 80}" y="60" fill="${INK}">after</text></svg>`;
fs.writeFileSync(path.join(OUT, 'gap.svg'), s);

// ---- timeline.svg: the Cub's 3 m/s taxi at 0.62 throttle - the gap (m) against t, before and after, the grade marked
const TB = rd('trace_base.json'), TA = rd('trace_after.json');
if (TB && TA) {
  const tb = TB[0].trace, ta = TA[0].trace, t0 = 2.6, t1 = 3.6, g0 = -0.05, g1 = 1.6, W2 = 760, H2 = 360, L2 = 60, R2 = 30, T2 = 60, Bm = 50;
  const XX = t => L2 + (t - t0) / (t1 - t0) * (W2 - L2 - R2), YY = g => T2 + (g1 - g) / (g1 - g0) * (H2 - T2 - Bm);
  const path_ = tr => tr.filter(p => p.t >= t0 && p.t <= t1).map((p, i) => (i ? 'L' : 'M') + XX(p.t).toFixed(1) + ',' + YY(p.gap).toFixed(1)).join('');
  let z = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W2} ${H2}" width="${W2}" height="${H2}" font-family="system-ui, sans-serif" font-size="11"><rect width="${W2}" height="${H2}" fill="${SURF}"/>` +
    `<text x="16" y="22" font-size="14" font-weight="600" fill="${INK}">The Cub, 3 m/s into a trunk at the rig's 0.62 throttle (1713 rpm)</text>` +
    `<text x="16" y="40" fill="${INK2}">the trunk's face ahead of the flange (m) against time; the dot is where DMG-DRIVE graded the strike</text>` +
    `<rect x="${L2}" y="${YY(0.12)}" width="${W2 - L2 - R2}" height="${YY(0) - YY(0.12)}" fill="${GRID}"/><text x="${L2 + 6}" y="${YY(0.12) - 4}" fill="${INK2}">the hub (0-0.12 m)</text>` +
    `<clipPath id="pl"><rect x="${L2}" y="${T2}" width="${W2 - L2 - R2}" height="${H2 - T2 - Bm}"/></clipPath>`;
  for (const g of [0, 0.5, 1, 1.5]) z += `<line x1="${L2}" x2="${W2 - R2}" y1="${YY(g)}" y2="${YY(g)}" stroke="${GRID}"/><text x="${L2 - 6}" y="${YY(g) + 4}" text-anchor="end" fill="${INK2}">${g}</text>`;
  for (let t = 2.6; t <= 3.601; t += 0.2) z += `<text x="${XX(t)}" y="${H2 - Bm + 16}" text-anchor="middle" fill="${INK2}">${t.toFixed(1)}</text>`;
  z += `<text x="${(L2 + W2 - R2) / 2}" y="${H2 - 12}" text-anchor="middle" fill="${INK2}">t (s)</text>`;
  for (const [tr, c, nm] of [[tb, C2, 'before'], [ta, C1, 'after']]) {
    z += `<path d="${path_(tr)}" fill="none" stroke="${c}" stroke-width="2" clip-path="url(#pl)"/>`;
    const g = tr.find(p => p.strike);
    if (g) z += `<circle cx="${XX(g.t)}" cy="${YY(g.gap)}" r="5" fill="${c}" stroke="${SURF}" stroke-width="2"><title>${nm}: '${g.strike}' at t ${g.t} s, the trunk ${g.gap} m ahead of the flange</title></circle>` +
      `<text x="${XX(g.t) + 8}" y="${YY(g.gap) - (nm === 'after' ? 30 : 8)}" fill="${INK}">${nm}: '${g.strike}' graded, the trunk ${g.gap.toFixed(2)} m out</text>`;
  }
  z += `<circle cx="${W2 - 200}" cy="56" r="4.5" fill="${C2}"/><text x="${W2 - 190}" y="60" fill="${INK}">before</text><circle cx="${W2 - 120}" cy="56" r="4.5" fill="${C1}"/><text x="${W2 - 110}" y="60" fill="${INK}">after</text></svg>`;
  fs.writeFileSync(path.join(OUT, 'timeline.svg'), z);
}
console.log('wrote', OUT);
