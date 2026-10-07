#!/usr/bin/env node
// G2389-G2392 (DMG-POLES): THE EVIDENCE - the whole matrix (tools/_dmg_poles_lib.js: the Cub, the Jodel, the metal
// Cessna; the wooden and the steel pole; 85 / 65 / 45 % of the semispan; 8 m/s, the lift-off speed, 35 m/s 2 m up; and
// the 65 % rows with the aeroplane 0.5 m right of the gap's centre) flown on this tree's core (G2391 in) and on the same
// core with G2391 taken out (the bug as found), into reports/evidence/DMG-POLES/:
//   matrix.json      every case, both cores (the lib's analyse, compact)
//   cases.md         a table per build: per case and wing, where it parted against the pole, the pieces, what broke
//                    inboard and its load path, what the aeroplane did after - before | after
//   span_<build>.svg the broken members along the span, every case a strip (the left wing drawn left), before | after
//   time_<build>.svg the root load (both wings) and the yaw over time, the gate's four key rows
//   staging.md       the exact staging, to replay on the box for the stills
// Run: node tools/dmg_poles_evidence.js [--jobs=N] [--only=after]   (~8 min a core at 3 jobs)
//      node tools/dmg_poles_evidence.js --replot                    (the tables and plots again from matrix.json)
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const PL = require('./_dmg_poles_lib.js');
const argv = process.argv.slice(2);
const OUT = path.join(__dirname, '..', 'reports', 'evidence', 'DMG-POLES');
const JOBS = +((argv.find(a => a.startsWith('--jobs=')) || '').slice(7) || 3);
const SPEEDS = ['taxi', 'lof', 'air'], POLES = ['wood', 'steel'];
const KEYROWS = ['wood/taxi/0.85', 'wood/air/0.65', 'steel/lof/0.45', 'wood/lof/0.65/0.5'];

function cases() {
  const out = [];
  for (const key of PL.KEYS) {
    for (const pole of POLES) for (const speed of SPEEDS) for (const frac of PL.FRACS) out.push({ key, pole, speed, frac, off: 0, dmg: 'on' });
    for (const pole of POLES) for (const speed of SPEEDS) out.push({ key, pole, speed, frac: 0.65, off: 0.5, dmg: 'on' });
  }
  return out;
}
function bugCore(dir) {
  const src = fs.readFileSync(path.join(__dirname, 'flight_core.js'), 'utf8'), a = 'if (CERT_WING[bi] && MPP[bi] < Infinity && fuP < Infinity) b.mp =';
  if (src.split(a).length !== 2) throw new Error('the G2391 line not found once in the core');
  const f = path.join(dir, 'flight_core_g2391off.js');
  fs.writeFileSync(f, src.replace(a, 'if (false && CERT_WING[bi] && MPP[bi] < Infinity && fuP < Infinity) b.mp ='));
  return f;
}

const f2 = (x, d = 2) => x == null || !Number.isFinite(+x) ? '-' : (+x).toFixed(d);
const n0 = x => { const v = Math.round(x); return String(v === 0 ? 0 : v); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// the member classes folded to three identities (the palette's first three slots validate all-pairs): the spars; the drag
// bracing (diagonals, ribs); the fittings to the fuselage (the root, the strut, the strut's hidden fan)
const GROUP = { spar: 0, diag: 1, rib: 1, root: 2, strut: 2, fan: 2 };
const GNAME = ['spar', 'drag brace (diagonal, rib)', 'fitting (root, strut, fan)'];
const STYLE = '<style>' +
  '.s{--bg:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e4e3df;--c0:#2a78d6;--c1:#eb6834;--c2:#1baf7a}' +
  '@media (prefers-color-scheme: dark){.s{--bg:#1a1a19;--ink:#ffffff;--ink2:#c3c2b7;--grid:#3a3a37;--c0:#3987e5;--c1:#d95926;--c2:#199e70}}' +
  '.bg{fill:var(--bg)}.t{fill:var(--ink);font:12px system-ui,sans-serif}.t2{fill:var(--ink2);font:11px system-ui,sans-serif}.h{fill:var(--ink);font:600 14px system-ui,sans-serif}' +
  '.g{stroke:var(--grid);stroke-width:1}.wing{stroke:var(--ink2);stroke-width:1;stroke-dasharray:2 3}.pole{stroke:var(--ink);stroke-width:2}' +
  '.m0{stroke:var(--c0)}.m1{stroke:var(--c1)}.m2{stroke:var(--c2)}.m{stroke-width:3;stroke-linecap:round}.after{opacity:.45}' +
  '.l0{stroke:var(--c0);fill:none;stroke-width:2}.l1{stroke:var(--c1);fill:none;stroke-width:2}.ax{stroke:var(--ink2);stroke-width:1}' +
  '</style>';

// SPAN: one strip per case; the semispan scaled to the strip's half width, the left wing drawn left; each wing's broken
// members (the pole phase solid, the wreck's landing after faded) as segments over their stations, stacked by class; the
// pole a tick at its station; the bay boundaries (the ribs) grid lines
function spanSvg(key, rows) {
  const label = 150, colW = 520, W = label + 2 * colW + 20, rowH = 44, top = 76, H = top + rows.length * rowH + 40, semi = rows[0].after.semi;
  let s = '<svg xmlns="http://www.w3.org/2000/svg" class="s" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="system-ui,sans-serif">' + STYLE +
    '<title>' + esc(key) + ': the broken members along the span, every case, before and after G2391</title><rect class="bg" width="' + W + '" height="' + H + '"/>';
  s += '<text class="h" x="16" y="24">' + esc(PL.L.BUILDS[key].label) + ' - the members broken along the span (left wing drawn left), before | after G2391</text>';
  let lx = 16; GNAME.forEach((g, i) => { s += '<line class="m m' + i + '" x1="' + lx + '" y1="44" x2="' + (lx + 22) + '" y2="44"/><text class="t2" x="' + (lx + 28) + '" y="48">' + esc(g) + '</text>'; lx += 40 + g.length * 6.2; });
  s += '<line class="pole" x1="' + lx + '" y1="37" x2="' + lx + '" y2="51"/><text class="t2" x="' + (lx + 8) + '" y="48">the pole\'s station</text>';
  s += '<text class="t2" x="' + (lx + 130) + '" y="48">faded: broken after the pole phase (the landing)</text>';
  ['before (the bug as found)', 'after G2391'].forEach((h, c) => { s += '<text class="t" x="' + (label + c * colW + colW / 2 - 40) + '" y="68">' + esc(h) + '</text>'; });
  rows.forEach((row, r) => {
    const y0 = top + r * rowH, cy = y0 + rowH / 2;
    s += '<text class="t2" x="16" y="' + (cy + 4) + '">' + esc(PL.caseName(row.case).replace(key + '/', '')) + '</text>';
    ['before', 'after'].forEach((which, c) => {
      const A = row[which]; if (!A || A.err) return;
      const x0 = label + c * colW + 10, wpx = colW - 30, mid = x0 + wpx / 2, sc = (wpx / 2 - 6) / semi;
      s += '<line class="g" x1="' + x0 + '" y1="' + (y0 + rowH - 2) + '" x2="' + (x0 + wpx) + '" y2="' + (y0 + rowH - 2) + '"/>';
      for (const z of A.stations) for (const sg of [-1, 1]) s += '<line class="g" x1="' + (mid + sg * z * sc) + '" y1="' + (y0 + 4) + '" x2="' + (mid + sg * z * sc) + '" y2="' + (y0 + rowH - 6) + '"/>';
      s += '<line class="wing" x1="' + (mid - semi * sc) + '" y1="' + cy + '" x2="' + (mid + semi * sc) + '" y2="' + cy + '"/>';
      for (const sd of ['R', 'L']) {
        const Wg = A.wings[sd], sg = sd === 'R' ? 1 : -1, lane = [0, 0, 0];
        s += '<line class="pole" x1="' + (mid + sg * Wg.sC * sc) + '" y1="' + (y0 + 3) + '" x2="' + (mid + sg * Wg.sC * sc) + '" y2="' + (y0 + rowH - 5) + '"><title>' + esc(sd + ' pole at ' + f2(Wg.sC) + ' m') + '</title></line>';
        for (const m of Wg.members) {
          const [t, cls, z0, z1, how, phase] = m, g = GROUP[cls] == null ? 2 : GROUP[cls], k = lane[g]++ % 3;
          const yy = y0 + 7 + g * 11 + k * 3, a = mid + sg * Math.max(z0, 0.02) * sc, b = mid + sg * Math.max(z1, z0 + 0.06) * sc;
          s += '<line class="m m' + g + (phase === 'after' ? ' after' : '') + '" x1="' + a.toFixed(1) + '" y1="' + yy + '" x2="' + b.toFixed(1) + '" y2="' + yy + '"><title>' +
            esc(sd + ' ' + cls + ' ' + f2(z0) + '-' + f2(z1) + ' m, ' + how + ', t ' + f2(t) + ' s (' + phase + ')') + '</title></line>';
        }
      }
    });
  });
  s += '<text class="t2" x="16" y="' + (H - 14) + '">Strips: build/pole/speed/fraction of the semispan[/the aeroplane right of the gap, m]. Grid lines: the lattice\'s rib stations. Hover a member for its class, station, how and when it broke.</text>';
  return s + '</svg>\n';
}
// TIME: the gate's four key rows, after G2391 - the root load (each wing's members on the fuselage, kN) and the yaw (deg)
// in two charts per row (one axis each), from the start to the end of the run
function timeSvg(key, rows) {
  const W = 1180, panelW = 540, panelH = 120, rowH = 175, top = 60, H = top + rows.length * rowH + 20;
  let s = '<svg xmlns="http://www.w3.org/2000/svg" class="s" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="system-ui,sans-serif">' + STYLE +
    '<title>' + esc(key) + ': the root load and the yaw over time, the key rows, after G2391</title><rect class="bg" width="' + W + '" height="' + H + '"/>';
  s += '<text class="h" x="16" y="24">' + esc(PL.L.BUILDS[key].label) + ' - the wing root\'s load (kN) and the yaw (deg) over time, after G2391</text>';
  s += '<line class="l0" x1="16" y1="42" x2="38" y2="42"/><text class="t2" x="44" y="46">right wing</text><line class="l1" x1="130" y1="42" x2="152" y2="42"/><text class="t2" x="158" y="46">left wing</text>' +
    '<text class="t2" x="260" y="46">the pole phase shaded; yaw + toward the right wing</text>';
  rows.forEach((A, r) => {
    const y0 = top + r * rowH, H2 = A.hist.map(h => Object.assign({}, h, { rootRk: h.rootR / 1000, rootLk: h.rootL / 1000 }));
    const tA = H2.length ? H2[0].t : 0, tMax = H2.length ? H2[H2.length - 1].t : 1;
    s += '<text class="t" x="16" y="' + (y0 + 14) + '">' + esc(PL.caseName(A.case)) + ' - ' + f2(A.V, 1) + ' m/s, contact ' + f2(A.tFirst) + '-' + f2(A.tLast) + ' s</text>';
    const panel = (px, label, series, unit) => {
      const py = y0 + 26; let lo = 0, hi = 0;
      for (const [k] of series) for (const h of H2) { lo = Math.min(lo, h[k]); hi = Math.max(hi, h[k]); }
      if (hi - lo < 1e-9) hi = lo + 1;
      const X = t => px + 40 + ((t - tA) / Math.max(1e-9, tMax - tA)) * (panelW - 50), Y = v => py + panelH - (v - lo) / (hi - lo) * panelH;
      let p = '<rect x="' + X(A.tFirst || 0) + '" y="' + py + '" width="' + Math.max(1, X((A.tLast || 0) + 0.25) - X(A.tFirst || 0)) + '" height="' + panelH + '" fill="var(--grid)" opacity=".6"/>';
      p += '<line class="ax" x1="' + (px + 40) + '" y1="' + (py + panelH) + '" x2="' + (px + panelW - 10) + '" y2="' + (py + panelH) + '"/><line class="ax" x1="' + (px + 40) + '" y1="' + py + '" x2="' + (px + 40) + '" y2="' + (py + panelH) + '"/>';
      if (lo < 0 && hi > 0) p += '<line class="g" x1="' + (px + 40) + '" y1="' + Y(0) + '" x2="' + (px + panelW - 10) + '" y2="' + Y(0) + '"/>';
      p += '<text class="t2" x="' + (px + 2) + '" y="' + (py + 9) + '">' + (hi - lo < 5 ? f2(hi, 1) : n0(hi)) + '</text><text class="t2" x="' + (px + 2) + '" y="' + (py + panelH) + '">' + (hi - lo < 5 ? f2(lo, 1) : n0(lo)) + '</text>';
      p += '<text class="t2" x="' + (px + panelW - 60) + '" y="' + (py + panelH + 14) + '">' + f2(tMax, 1) + ' s</text><text class="t2" x="' + (px + 30) + '" y="' + (py + panelH + 26) + '">' + f2(tA, 1) + ' s</text><text class="t2" x="' + (px + 44) + '" y="' + (py + panelH + 14) + '">' + esc(label + ' (' + unit + ')') + '</text>';
      series.forEach(([k, cl, nm]) => { p += '<polyline class="' + cl + '" points="' + H2.map(h => X(h.t).toFixed(1) + ',' + Y(h[k]).toFixed(1)).join(' ') + '"><title>' + esc(nm) + '</title></polyline>'; });
      return p;
    };
    s += panel(0, 'root load', [['rootRk', 'l0', 'right wing root, kN'], ['rootLk', 'l1', 'left wing root, kN']], 'kN') + panel(panelW + 40, 'yaw', [['yaw', 'l0', 'yaw, deg']], 'deg');
  });
  return s + '</svg>\n';
}

function mdTable(key, rows) {
  let s = '\n## ' + PL.L.BUILDS[key].label + ' (`' + PL.L.BUILDS[key].build + '`)\n\n';
  s += 'Semispan ' + f2(rows[0].after.semi) + ' m; the lattice\'s rib stations ' + rows[0].after.stations.map(z => f2(z)).join(', ') + ' m; the lift strut\'s station ' + (rows[0].after.strutZ > 0 ? f2(rows[0].after.strutZ) + ' m' : 'none (cantilever)') + '.\n\n';
  s += '| case | V m/s | wing | pole at m | its bay m | parted (spars broken) before -> after | pieces off before -> after | kept to m before -> after | inboard of the cut, after (load path) | after: yaw / roll deg, ran to m, V end |\n|---|---|---|---|---|---|---|---|---|---|\n';
  for (const row of rows) for (const sd of ['R', 'L']) {
    const B = row.before && !row.before.err ? row.before.wings[sd] : null, A = row.after.wings[sd];
    const pt = W => !W ? '-' : W.parted ? f2(W.parted.z0) + '-' + f2(W.parted.z1) + (W.sparsOut ? ' (' + W.sparsOut + ' outside)' : '') : 'none';
    const pc = W => !W ? '-' : W.pieces + (W.crumbs ? '+' + W.crumbs + 'c' : '') + (W.piecesOff.length ? ' (' + W.piecesOff.map(p => f2(p.mass, 1) + ' kg').join(', ') + ')' : '');
    const inb = A.inboard.length ? A.inboard.map(x => x.cls + ' ' + f2(x.z0, 1) + '-' + f2(x.z1, 1) + ' ' + x.how.split(':')[0] + ' [' + (x.path || '**unexplained**') + ']').join('; ') : '-';
    const af = row.after.after;
    s += '| ' + PL.caseName(row.case).replace(key + '/', '') + ' | ' + f2(row.after.V, 1) + ' | ' + sd + ' | ' + f2(A.sC) + ' | ' + f2(A.bay[0]) + '-' + f2(A.bay[1]) + ' | ' + pt(B) + ' -> ' + pt(A) +
      ' | ' + pc(B) + ' -> ' + pc(A) + ' | ' + (B ? f2(B.zKept) : '-') + ' -> ' + f2(A.zKept) + ' | ' + inb + ' | ' + (sd === 'R' ? f2(af.yawMax, 0) + ' / ' + f2(af.rollMax, 0) + ', ' + f2(af.end, 0) + ' m, ' + f2(af.Vend, 1) + ' m/s' + (af.flipped ? ', OVER' : '') : '') + ' |\n';
  }
  return s;
}

(async () => {
  const t0 = Date.now(), C = cases();
  fs.mkdirSync(OUT, { recursive: true });
  const tick = n => i => { if (i % 6 === 5) process.stderr.write(n + ' ' + (i + 1) + '/' + C.length + '\n'); };
  let after, before = null;
  if (argv.includes('--replot')) {
    const M = JSON.parse(fs.readFileSync(path.join(OUT, 'matrix.json'), 'utf8'));
    after = M.map(r => r.after); before = M.some(r => r.before) ? M.map(r => r.before) : null;
  } else after = await PL.matrix(C, { jobs: JOBS, tick: tick('after') });
  if (!argv.includes('--only=after') && !argv.includes('--replot')) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poles-ev-'));
    try { before = await PL.matrix(C, { jobs: JOBS, core: bugCore(dir), tick: tick('before') }); }
    finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* stays */ } }
  }
  const bad = after.concat(before || []).filter(r => r.err);
  if (bad.length) { console.log(bad.length + ' cases died: ' + bad[0].err); process.exit(1); }
  const rows = C.map((c, i) => ({ case: c, after: after[i], before: before ? before[i] : null }));
  // (the time histories kept for the key rows only - the plots'; every number to 6 significant figures)
  const isKey = c => KEYROWS.some(n => PL.caseName(c) === c.key + '/' + n);
  const slim = (A, c) => A && Object.assign({}, A, { hist: isKey(c) ? A.hist : undefined });
  const r4 = (k, v) => typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(6) : v;
  if (!argv.includes('--replot')) fs.writeFileSync(path.join(OUT, 'matrix.json'), JSON.stringify(rows.map(r => ({ case: r.case, before: slim(r.before, r.case), after: slim(r.after, r.case) })), r4) + '\n');
  let md = '# DMG-POLES - the matrix, before and after G2391\n\nGenerated by `node tools/dmg_poles_evidence.js` (' + new Date().toISOString().slice(0, 10) + '). "before" is this tree\'s core with G2391\'s one line taken out (the bug as found, the train-41 behaviour); "after" is the core as committed. ' +
    'Each wing judged over the pole phase (first contact to the last new one + 0.25 s); breaks after it are the wreck landing. R = the right wing (+ yaw toward it). The staging: `staging.md`.\n';
  for (const key of PL.KEYS) {
    const kr = rows.filter(r => r.case.key === key);
    md += mdTable(key, kr);
    fs.writeFileSync(path.join(OUT, 'span_' + key + '.svg'), spanSvg(key, kr));
    fs.writeFileSync(path.join(OUT, 'time_' + key + '.svg'), timeSvg(key, KEYROWS.map(n => kr.find(r => PL.caseName(r.case) === key + '/' + n).after)));
  }
  // the totals: wings clean (the gate's four checks) before and after
  const clean = W => W.parted && W.sparsOut === 0 && W.pieces <= 1 && W.crumbs === 0 && W.piecesOff.every(p => p.zMin >= W.bay[0] - 1e-6) && W.zKept >= W.bay[0] - 1e-6 && W.unexplained === 0;
  const tally = which => { let n = 0, k = 0; for (const r of rows) if (r[which]) for (const sd of ['R', 'L']) { n++; if (clean(r[which].wings[sd])) k++; } return k + ' / ' + n; };
  md = md.replace('\n', '\n\n**Wings that broke cleanly (the gate\'s cut / pieces / kept / inboard checks): before ' + (before ? tally('before') : '-') + ', after ' + tally('after') + '.**\n');
  fs.writeFileSync(path.join(OUT, 'cases.md'), md);
  console.log('wrote ' + OUT + ' (' + C.length + ' cases' + (before ? ' x 2 cores' : '') + ', ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s); clean wings: before ' + (before ? tally('before') : '-') + ', after ' + tally('after'));
})();
